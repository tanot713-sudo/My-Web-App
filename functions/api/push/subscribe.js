/* POST /api/push/subscribe  { subscription: PushSubscription.toJSON(), device }  → { ok:true }
   1 แถวต่อเบราว์เซอร์ (endpoint เป็นคีย์) — สมัครซ้ำ = อัปเดตคีย์ + ล้างตัวนับส่งไม่ผ่าน */
import { json, guard, readJson } from '../../_lib/push.js';
import { validEndpoint, validKeys } from '../../_lib/webpush.js';

export async function onRequestPost({ request, env }) {
  const bad = guard(request, env);
  if (bad) return bad;
  let body;
  try { body = await readJson(request); } catch (e) { return json(400, { error: 'JSON ไม่ถูกต้อง' }); }
  const sub = body && body.subscription;
  const endpoint = sub && String(sub.endpoint || '');
  const keys = (sub && sub.keys) || {};
  if (!validEndpoint(endpoint, env)) return json(400, { error: 'endpoint ไม่รองรับ' });
  if (!validKeys(keys.p256dh, keys.auth)) return json(400, { error: 'คีย์ไม่ถูกต้อง' });
  const device = String(body.device || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80) || null;
  await env.DB.prepare(
    'INSERT INTO push_subs (endpoint, p256dh, auth, device, created_at, fail_count) VALUES (?1, ?2, ?3, ?4, ?5, 0) ' +
    'ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device, fail_count = 0'
  ).bind(endpoint, keys.p256dh, keys.auth, device, Date.now()).run();
  return json(200, { ok: true });
}
