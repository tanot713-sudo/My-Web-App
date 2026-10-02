/* งานตามเวลาของ Scheduler Worker (workers/scheduler/index.js เรียกไฟล์นี้) — แยกไว้ใน functions/_lib ให้เทสต์รันกับ D1/R2 ตัวหลอกได้
   runTick  (ทุก 15 นาที)       ส่งการแจ้งเตือน kind 'push' ที่ถึงเวลา
   runDaily (00:00 UTC = 07:00 ไทย) สรุปประจำวันจากแถว kind 'digest' ของวันนี้ + ล้างแถวเก่า + สำรอง D1 → R2 */
import { deliver } from './push.js';
import { pickDue, digestFor, advance, ictDate, ictDayStart, DAY_MS } from './reminders.js';

export const BACKUP_PREFIX = 'backups/d1/';
export const BACKUP_KEEP_DAYS = 30;
// ai_cache สร้างใหม่ได้ (และใหญ่) จึงไม่สำรอง
export const BACKUP_TABLES = ['docs', 'reminders', 'push_subs', 'learn_cards', 'learn_log', 'ai_usage', 'files'];

export async function runTick(env, now = Date.now()) {
  const rows = (await env.DB.prepare(
    "SELECT * FROM reminders WHERE done = 0 AND kind = 'push' AND sent_at IS NULL AND due_at <= ?1 ORDER BY due_at LIMIT 50"
  ).bind(now).all()).results || [];
  const { send, stale } = pickDue(rows, now);
  const out = { due: send.length, stale: stale.length, sent: 0, subs: 0 };
  for (const r of stale) await markSent(env, r, now);
  for (const r of send) {
    const res = await deliver(env, { title: r.title, body: r.body || '', url: r.url || 'index.html', tag: r.id.slice(0, 64) }, { now });
    out.subs = res.subs;
    out.sent += res.sent;
    // ไม่มีเครื่องสมัครไว้ = ไม่มีใครรับ ไม่ต้องรอส่งซ้ำ · ส่งไม่ผ่านทุกเครื่อง (บริการ push ล่มชั่วคราว) = ลองใหม่รอบหน้า จนกว่าจะเกิน STALE_MS
    if (res.subs && !res.sent && res.failed) continue;
    await markSent(env, r, now);
  }
  return out;
}

async function markSent(env, r, now) {
  const next = r.repeat ? advance(r.due_at, r.repeat, now) : null;
  if (next) await env.DB.prepare('UPDATE reminders SET due_at = ?2, sent_at = NULL, updated_at = ?3 WHERE id = ?1').bind(r.id, next, now).run();
  else await env.DB.prepare('UPDATE reminders SET sent_at = ?2, updated_at = ?2 WHERE id = ?1').bind(r.id, now).run();
}

export async function runDaily(env, now = Date.now()) {
  const start = ictDayStart(now);
  const rows = (await env.DB.prepare(
    "SELECT * FROM reminders WHERE done = 0 AND kind = 'digest' AND sent_at IS NULL AND due_at >= ?1 AND due_at < ?2"
  ).bind(start, start + DAY_MS).all()).results || [];
  const d = digestFor(rows, now);
  const out = { date: ictDate(now), digest: d ? d.ids.length : 0, sent: 0, backup: null, cleaned: 0 };
  if (d) {
    const res = await deliver(env, d, { now, ttl: 12 * 3600 });
    out.sent = res.sent;
    for (const id of d.ids) await env.DB.prepare('UPDATE reminders SET sent_at = ?2 WHERE id = ?1').bind(id, now).run();
  }
  const del = await env.DB.prepare(
    "DELETE FROM reminders WHERE (kind = 'digest' AND due_at < ?1) OR (kind = 'push' AND repeat IS NULL AND sent_at IS NOT NULL AND due_at < ?2) OR (done = 1 AND updated_at < ?2)"
  ).bind(start - 7 * DAY_MS, now - 60 * DAY_MS).run();
  out.cleaned = (del && del.meta && del.meta.changes) || 0;
  if (env.FILES) out.backup = await backupD1(env, now);
  return out;
}

/** สำรองตารางใน D1 เป็น JSON (gzip) ที่ R2 backups/d1/<วันที่ไทย>.json.gz — เก็บ BACKUP_KEEP_DAYS วันล่าสุด */
export async function backupD1(env, now = Date.now()) {
  const tables = {};
  for (const t of BACKUP_TABLES) {
    const rows = [];
    for (let off = 0; ; off += 1000) {
      const page = (await env.DB.prepare('SELECT * FROM ' + t + ' LIMIT 1000 OFFSET ?1').bind(off).all()).results || [];
      rows.push(...page);
      if (page.length < 1000) break;
    }
    tables[t] = rows;
  }
  const text = JSON.stringify({ v: 1, at: now, tables });
  const gz = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const key = BACKUP_PREFIX + ictDate(now) + '.json.gz';
  await env.FILES.put(key, gz, { httpMetadata: { contentType: 'application/gzip' } });
  const cutoff = BACKUP_PREFIX + ictDate(now - BACKUP_KEEP_DAYS * DAY_MS);
  const list = await env.FILES.list({ prefix: BACKUP_PREFIX });
  let pruned = 0;
  for (const o of (list && list.objects) || []) {
    if (o.key < cutoff) { await env.FILES.delete(o.key); pruned++; }
  }
  return { key, bytes: gz.byteLength, rows: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])), pruned };
}
