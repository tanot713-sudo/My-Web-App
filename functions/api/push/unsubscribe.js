/* POST /api/push/unsubscribe  { endpoint }  → { ok:true, removed } */
import { json, guard, readJson } from '../../_lib/push.js';

export async function onRequestPost({ request, env }) {
  const bad = guard(request, env);
  if (bad) return bad;
  let body;
  try { body = await readJson(request); } catch (e) { return json(400, { error: 'JSON ไม่ถูกต้อง' }); }
  const endpoint = String((body && body.endpoint) || '');
  if (!endpoint) return json(400, { error: 'ต้องระบุ endpoint' });
  const r = await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?1').bind(endpoint).run();
  return json(200, { ok: true, removed: (r && r.meta && r.meta.changes) || 0 });
}
