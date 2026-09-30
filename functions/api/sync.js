/* /api/sync — ซิงก์ข้อมูล local-first (ROADMAP Phase 1) บนตาราง docs ของ D1
   GET  /api/sync?since=<rev>&limit=<n>  → { docs:[...], rev:<rev สุดท้ายในชุดนี้>, max:<rev สูงสุดในตาราง>, more:bool }
        ดึงเฉพาะแถว rev > since ผ่าน index docs_rev (ห้ามอ่านทั้งตาราง — ลิมิตอ่านฟรี 5M แถว/วัน)
   POST /api/sync  { device, docs:[{ns,id,data,updated_at,deleted}] } (≤40 รายการ — D1 จำกัด 50 query ต่อ request)
        → { results:[{ns,id,applied,rev}], rejected:[แถวบนเซิร์ฟเวอร์ที่ใหม่กว่า] }
   กติกา: รายการที่ updated_at ใหม่กว่าชนะ (last-write-wins); เท่ากันตัดสินด้วยชื่อ device; ลบ = deleted=1 (tombstone)
   rev แจกแบบ MAX(rev)+1 ในคำสั่งเดียว — D1 เขียนทีละคำสั่งตามลำดับ (single writer) จึงไม่ชนกัน และมี UNIQUE index กันไว้อีกชั้น
   ด่าน Access JWT อยู่ที่ _middleware.js แล้ว */

const MAX_BATCH = 40;
const MAX_PULL = 200;
const MAX_PULL_BYTES = 4 * 1024 * 1024;
const MAX_DATA = 1024 * 1024;          // 1 แถว D1 ได้ไม่เกิน ~2MB — เผื่อไว้ครึ่งหนึ่ง
const MAX_FUTURE_MS = 5 * 60 * 1000;   // นาฬิกาเครื่องที่เดินเร็วเกินไปจะชนะทุกครั้ง — ตัดไว้ที่เวลาเซิร์ฟเวอร์ + 5 นาที

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function rowOut(r) {
  return { ns: r.ns, id: r.id, data: r.data, updated_at: r.updated_at, rev: r.rev, deleted: r.deleted ? 1 : 0, device: r.device || '' };
}

function validDoc(d) {
  if (!d || typeof d !== 'object') return 'doc ไม่ใช่ object';
  if (typeof d.ns !== 'string' || !d.ns || d.ns.length > 256) return 'ns ไม่ถูกต้อง';
  if (typeof d.id !== 'string' || !d.id || d.id.length > 1024) return 'id ไม่ถูกต้อง';
  if (typeof d.updated_at !== 'number' || !isFinite(d.updated_at) || d.updated_at < 0) return 'updated_at ไม่ถูกต้อง';
  if (!d.deleted && typeof d.data !== 'string') return 'data ต้องเป็น string';
  if (typeof d.data === 'string' && d.data.length > MAX_DATA) return 'data ใหญ่เกิน ' + MAX_DATA;
  return null;
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json(500, { error: 'D1 binding DB missing' });
  const url = new URL(request.url);
  const since = Math.max(0, parseInt(url.searchParams.get('since') || '0', 10) || 0);
  const limit = Math.min(MAX_PULL, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10) || 100));

  const [rows, max] = await env.DB.batch([
    env.DB.prepare('SELECT ns, id, data, updated_at, rev, deleted, device FROM docs WHERE rev > ?1 ORDER BY rev LIMIT ?2').bind(since, limit),
    env.DB.prepare('SELECT COALESCE(MAX(rev), 0) AS m FROM docs'),
  ]);
  const list = rows.results || [];
  const docs = [];
  let bytes = 0;
  for (const r of list) {
    bytes += (r.data ? r.data.length : 0) + r.ns.length + r.id.length;
    if (docs.length && bytes > MAX_PULL_BYTES) break; // ส่วนที่เหลือไปรอบถัดไป (ลูกค้าวนดึงต่อจาก rev สุดท้าย)
    docs.push(rowOut(r));
  }
  const maxRev = (max.results && max.results[0] && max.results[0].m) || 0;
  const rev = docs.length ? docs[docs.length - 1].rev : since;
  return json(200, { docs, rev, max: maxRev, more: docs.length < list.length || list.length === limit });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json(500, { error: 'D1 binding DB missing' });
  let body;
  try { body = await request.json(); } catch (e) { return json(400, { error: 'invalid JSON' }); }
  const docs = body && Array.isArray(body.docs) ? body.docs : null;
  if (!docs) return json(400, { error: 'docs[] required' });
  if (docs.length > MAX_BATCH) return json(413, { error: 'สูงสุด ' + MAX_BATCH + ' รายการต่อครั้ง' });
  const device = String((body && body.device) || '').slice(0, 64);
  const seen = new Set();
  for (const d of docs) {
    const err = validDoc(d);
    if (err) return json(400, { error: err, ns: d && d.ns, id: d && d.id });
    const k = d.ns + '\u0000' + d.id;
    if (seen.has(k)) return json(400, { error: 'ns/id ซ้ำในชุดเดียวกัน', ns: d.ns, id: d.id });
    seen.add(k);
  }
  if (!docs.length) return json(200, { results: [], rejected: [] });

  const now = Date.now();
  const stmts = docs.map((d) => {
    const ts = Math.min(Math.floor(d.updated_at), now + MAX_FUTURE_MS);
    const del = d.deleted ? 1 : 0;
    return env.DB.prepare(
      'INSERT INTO docs (ns, id, data, updated_at, rev, deleted, device) ' +
      'VALUES (?1, ?2, ?3, ?4, (SELECT COALESCE(MAX(rev), 0) + 1 FROM docs), ?5, ?6) ' +
      'ON CONFLICT (ns, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, rev = excluded.rev, ' +
      'deleted = excluded.deleted, device = excluded.device ' +
      'WHERE excluded.updated_at > docs.updated_at OR (excluded.updated_at = docs.updated_at AND excluded.device > COALESCE(docs.device, \'\')) ' +
      'RETURNING rev'
    ).bind(d.ns, d.id, del ? null : d.data, ts, del, device);
  });
  const out = await env.DB.batch(stmts);
  const results = [];
  const lost = [];
  out.forEach((r, i) => {
    const row = r.results && r.results[0];
    results.push({ ns: docs[i].ns, id: docs[i].id, applied: !!row, rev: row ? row.rev : null });
    if (!row) lost.push(docs[i]);
  });

  // รายการที่แพ้ (บนเซิร์ฟเวอร์ใหม่กว่า) ส่งฉบับบนเซิร์ฟเวอร์กลับไปให้ลูกค้าใช้แทนทันที — 1 query รวม (ns,id ≤ 80 พารามิเตอร์)
  let rejected = [];
  if (lost.length) {
    const where = lost.map((_, i) => '(ns = ?' + (i * 2 + 1) + ' AND id = ?' + (i * 2 + 2) + ')').join(' OR ');
    const params = [];
    lost.forEach((d) => params.push(d.ns, d.id));
    const q = await env.DB.prepare('SELECT ns, id, data, updated_at, rev, deleted, device FROM docs WHERE ' + where).bind(...params).all();
    rejected = (q.results || []).map(rowOut);
  }
  return json(200, { results, rejected });
}
