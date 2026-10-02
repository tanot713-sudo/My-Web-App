/* งาน D1 ของ Web Push + การแจ้งเตือน — ใช้ร่วมกันใน functions/api/push/* และ Scheduler Worker (ผ่าน functions/_lib/scheduler.js)
   ตาราง: push_subs (migrations/0001), reminders (0001 + คอลัมน์ kind จาก 0002) */
import { sendPush } from './webpush.js';
import { cleanItems, payloadOf } from './reminders.js';

export const MAX_FAILS = 10; // ส่งไม่ผ่านติดกันเท่านี้ครั้ง (ที่ไม่ใช่ 404/410) = เลิกส่งให้เครื่องนั้น

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** คำขอที่แก้ข้อมูลต้องมาจากหน้าของเราเอง (กัน CSRF ที่อาศัยคุกกี้ Access) + ต้องมี D1 */
export function guard(request, env) {
  const origin = request.headers.get('Origin');
  if (request.method !== 'GET' && origin && origin !== new URL(request.url).origin) return json(403, { error: 'Forbidden origin' });
  if (!env.DB) return json(500, { error: 'D1 binding DB missing' });
  return null;
}

export async function readJson(request) {
  const text = await request.text();
  if (text.length > 256 * 1024) throw new Error('too large');
  return text ? JSON.parse(text) : {};
}

/** ส่ง payload ถึงทุกเครื่องที่สมัครไว้ (หรือเฉพาะ endpoint) — อัปเดต last_ok_at/fail_count, ลบเครื่องที่ยกเลิกไปแล้ว */
export async function deliver(env, payload, opts = {}) {
  const now = opts.now || Date.now();
  const q = opts.endpoint
    ? env.DB.prepare('SELECT endpoint, p256dh, auth, fail_count FROM push_subs WHERE endpoint = ?1').bind(opts.endpoint)
    : env.DB.prepare('SELECT endpoint, p256dh, auth, fail_count FROM push_subs');
  const subs = (await q.all()).results || [];
  const body = typeof payload === 'string' ? payload : payloadOf(payload);
  const out = { subs: subs.length, sent: 0, failed: 0, removed: 0 };
  for (const s of subs) {
    const r = await sendPush(s, body, env, { now, ttl: opts.ttl });
    if (r.ok) {
      out.sent++;
      await env.DB.prepare('UPDATE push_subs SET last_ok_at = ?2, fail_count = 0 WHERE endpoint = ?1').bind(s.endpoint, now).run();
    } else if (r.gone || (s.fail_count || 0) + 1 >= MAX_FAILS) {
      out.removed++;
      await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?1').bind(s.endpoint).run();
    } else {
      out.failed++;
      await env.DB.prepare('UPDATE push_subs SET fail_count = fail_count + 1 WHERE endpoint = ?1').bind(s.endpoint).run();
    }
  }
  return out;
}

/** แทนที่ชุดการแจ้งเตือนทั้ง scope ด้วย items (หน้าเว็บคำนวณใหม่จากข้อมูลทุกครั้ง) — เขียนเฉพาะแถวที่เปลี่ยนจริง
 *  sent_at เดิมคงไว้ถ้า due_at ไม่เปลี่ยน (ไม่ส่งซ้ำ) และล้างเมื่อเลื่อนวัน */
export async function replaceScope(env, scope, items, now = Date.now()) {
  const { rows, dropped } = cleanItems(scope, items);
  const have = new Map();
  for (const r of (await env.DB.prepare('SELECT id, title, body, url, due_at, kind, repeat FROM reminders WHERE source = ?1').bind(scope).all()).results || []) have.set(r.id, r);
  const stmts = [];
  const keep = new Set(rows.map((r) => r.id));
  for (const id of have.keys()) if (!keep.has(id)) stmts.push(env.DB.prepare('DELETE FROM reminders WHERE id = ?1').bind(id));
  let changed = 0;
  for (const r of rows) {
    const o = have.get(r.id);
    if (o && o.title === r.title && (o.body || null) === r.body && (o.url || null) === r.url && o.due_at === r.due_at && o.kind === r.kind && (o.repeat || null) === r.repeat) continue;
    changed++;
    stmts.push(env.DB.prepare(
      'INSERT INTO reminders (id, title, body, url, due_at, repeat, source, kind, sent_at, done, created_at, updated_at) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, 0, ?9, ?9) ' +
      'ON CONFLICT(id) DO UPDATE SET title = excluded.title, body = excluded.body, url = excluded.url, repeat = excluded.repeat, ' +
      'source = excluded.source, kind = excluded.kind, done = 0, ' +
      'sent_at = CASE WHEN reminders.due_at = excluded.due_at THEN reminders.sent_at ELSE NULL END, ' +
      'due_at = excluded.due_at, updated_at = excluded.updated_at'
    ).bind(r.id, r.title, r.body, r.url, r.due_at, r.repeat, r.source, r.kind, now));
  }
  const removed = stmts.length - changed;
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return { scope, total: rows.length, changed, removed, dropped };
}
