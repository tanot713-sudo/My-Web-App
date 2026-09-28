/* แทน Worker tanot-cors-proxy (ต้นฉบับ: docs/cors-proxy-worker-original.js) — เรียกแบบ same-origin จึงไม่ต้องมี
   header CORS อีกแล้ว แต่ยังจำกัดปลายทางด้วย allowlist เดิม กันไม่ให้กลายเป็น open proxy */

const ALLOWED_HOSTS = new Set([
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'news.google.com',
  'api.alternative.me',
]);

function text(status, body) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export async function onRequestGet({ request }) {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) return text(400, 'Missing ?url= parameter');

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch (e) {
    return text(400, 'Invalid target URL');
  }
  if (targetUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(targetUrl.hostname)) {
    return text(403, 'Host not allowed: ' + targetUrl.hostname);
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TanotCorsProxy/1.0)' },
    });
  } catch (e) {
    return text(502, 'Upstream fetch failed: ' + e.message);
  }

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'text/plain',
      'Cache-Control': 'private, max-age=60',
    },
  });
}
