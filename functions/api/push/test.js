/* POST /api/push/test  { endpoint }  → ส่งข้อความทดสอบถึงเครื่องนั้น → { sent, failed, removed } */
import { json, guard, readJson, deliver } from '../../_lib/push.js';
import { vapidStatus } from '../../_lib/webpush.js';

export async function onRequestPost({ request, env }) {
  const bad = guard(request, env);
  if (bad) return bad;
  if ((await vapidStatus(env)) !== 'ok') return json(503, { error: 'ยังไม่ได้ตั้งคีย์ VAPID', code: 'vapid' });
  let body;
  try { body = await readJson(request); } catch (e) { return json(400, { error: 'JSON ไม่ถูกต้อง' }); }
  const endpoint = String((body && body.endpoint) || '');
  if (!endpoint) return json(400, { error: 'ต้องระบุ endpoint' });
  const out = await deliver(env, { title: 'Tanot', body: 'ทดสอบการแจ้งเตือน', url: 'notifications.html', tag: 'test' }, { endpoint, ttl: 600 });
  if (!out.subs) return json(404, { error: 'เครื่องนี้ยังไม่ได้สมัคร', code: 'not-subscribed' });
  return json(200, out);
}
