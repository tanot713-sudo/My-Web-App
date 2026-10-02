/* GET /api/push/config[?endpoint=<endpoint ของเครื่องนี้>]
   → { publicKey, vapid: 'ok'|'missing'|'invalid', subs: จำนวนเครื่องที่สมัคร, subscribed: เครื่องนี้อยู่ในตารางไหม, lastOkAt, failCount } */
import { json, guard } from '../../_lib/push.js';
import { vapidStatus } from '../../_lib/webpush.js';

export async function onRequestGet({ request, env }) {
  const bad = guard(request, env);
  if (bad) return bad;
  const endpoint = new URL(request.url).searchParams.get('endpoint') || '';
  const vapid = await vapidStatus(env);
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subs').first();
  const row = endpoint
    ? await env.DB.prepare('SELECT last_ok_at, fail_count FROM push_subs WHERE endpoint = ?1').bind(endpoint).first()
    : null;
  return json(200, {
    publicKey: vapid === 'ok' ? String(env.VAPID_PUBLIC_KEY).trim() : '',
    vapid,
    subs: (count && count.n) || 0,
    subscribed: !!row,
    lastOkAt: row ? row.last_ok_at : null,
    failCount: row ? row.fail_count : 0,
  });
}
