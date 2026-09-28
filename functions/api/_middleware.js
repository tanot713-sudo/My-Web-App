/* ด่านตรวจสิทธิ์ของทุก /api/* — Cloudflare Access ครอบทั้งโดเมนอยู่แล้ว แต่ endpoint ที่มีค่าใช้จ่ายจริง
   (ocr/asr) ต้องไม่พึ่งการตั้งค่า Access ใน dashboard อย่างเดียว: ถ้า policy ถูกแก้/ปิดไปโดยไม่ตั้งใจ
   ด่านนี้ยังปฏิเสธทุกคำขอที่ไม่มี JWT ของ Access ที่ถูกต้อง (aud/iss/อายุ/ลายเซ็น) และเป็นอีเมลเจ้าของ
   ค่า ACCESS_AUD / TEAM_DOMAIN / OWNER_EMAIL มาจาก [vars] ใน wrangler.toml — ขาดตัวใดตัวหนึ่ง = ปิดตาย (500) */

const KEY_TTL_MS = 60 * 60 * 1000;
let keyCache = { domain: '', fetchedAt: 0, byKid: new Map() };

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlJson(s) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

async function loadKeys(teamDomain) {
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('certs fetch failed: ' + res.status);
  const { keys } = await res.json();
  const byKid = new Map();
  for (const jwk of keys || []) {
    if (jwk.kty !== 'RSA' || !jwk.kid) continue;
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
    byKid.set(jwk.kid, key);
  }
  keyCache = { domain: teamDomain, fetchedAt: Date.now(), byKid };
}

async function keyFor(kid, teamDomain) {
  const stale = keyCache.domain !== teamDomain || Date.now() - keyCache.fetchedAt > KEY_TTL_MS;
  if (stale || !keyCache.byKid.has(kid)) await loadKeys(teamDomain);
  return keyCache.byKid.get(kid) || null;
}

function readToken(request) {
  const header = request.headers.get('Cf-Access-Jwt-Assertion');
  if (header) return header;
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return m ? m[1] : null;
}

async function verify(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header, payload;
  try {
    header = b64urlJson(parts[0]);
    payload = b64urlJson(parts[1]);
  } catch (e) {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;

  const key = await keyFor(header.kid, env.TEAM_DOMAIN);
  if (!key) return null;
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1])
  );
  if (!ok) return null;

  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (payload.iss !== `https://${env.TEAM_DOMAIN}`) return null;
  if (typeof payload.exp !== 'number' || payload.exp < now - 60) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null;
  const email = String(payload.email || '').toLowerCase();
  if (!email || email !== String(env.OWNER_EMAIL).toLowerCase()) return null;
  return { email };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.ACCESS_AUD || !env.TEAM_DOMAIN || !env.OWNER_EMAIL) {
    return json(500, { error: 'Access config missing (ACCESS_AUD / TEAM_DOMAIN / OWNER_EMAIL)' });
  }
  const token = readToken(request);
  if (!token) return json(401, { error: 'Not signed in' });

  let user;
  try {
    user = await verify(token, env);
  } catch (e) {
    return json(503, { error: 'Could not verify sign-in: ' + (e && e.message ? e.message : String(e)) });
  }
  if (!user) return json(403, { error: 'Forbidden' });

  context.data.user = user;
  const res = await context.next();
  const out = new Response(res.body, res);
  if (!out.headers.has('Cache-Control')) out.headers.set('Cache-Control', 'no-store');
  return out;
}
