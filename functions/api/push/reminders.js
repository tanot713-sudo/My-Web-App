/* /api/push/reminders — ชุดการแจ้งเตือนที่หน้าต่างๆ ลงทะเบียน (ตาราง reminders)
   GET  → { items: [...] } รายการที่ยังไม่ถึง/วันนี้ (เวลาไทย) เรียงตามเวลา
   POST { scope, items: [{ id, title, body, url, due_at, kind: 'push'|'digest', repeat }] }
        → แทนที่ทั้ง scope (ลบรายการเดิมที่ไม่อยู่ใน items) → { scope, total, changed, removed, dropped }
   scope ที่ใช้อยู่: insurance (insurance-calc.js), tax (tax-calc.js), maintenance (mnt-calc.js), receipts (receipts-calc.js), car (car-calc.js) */
import { json, guard, readJson, replaceScope } from '../../_lib/push.js';
import { ictDayStart } from '../../_lib/reminders.js';

export async function onRequestGet({ request, env }) {
  const bad = guard(request, env);
  if (bad) return bad;
  const rows = (await env.DB.prepare(
    'SELECT id, title, body, url, due_at, kind, repeat, source, sent_at FROM reminders WHERE done = 0 AND due_at >= ?1 ORDER BY due_at LIMIT 300'
  ).bind(ictDayStart(Date.now())).all()).results || [];
  return json(200, { items: rows });
}

export async function onRequestPost({ request, env }) {
  const bad = guard(request, env);
  if (bad) return bad;
  let body;
  try { body = await readJson(request); } catch (e) { return json(400, { error: 'JSON ไม่ถูกต้อง' }); }
  try {
    return json(200, await replaceScope(env, body && body.scope, body && body.items));
  } catch (e) {
    const m = String(e && e.message || e);
    if (m === 'scope' || m === 'items' || m === 'too many') return json(400, { error: m });
    throw e;
  }
}
