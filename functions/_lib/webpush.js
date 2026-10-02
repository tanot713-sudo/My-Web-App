/* Web Push แบบไม่พึ่งไลบรารี (WebCrypto ล้วน — ใช้ได้ทั้ง Pages Functions, Worker และ Node ในเทสต์)
   - VAPID (RFC 8292): JWT ES256 ลงชื่อด้วย VAPID_PRIVATE_KEY → header  Authorization: vapid t=<jwt>, k=<public key>
   - เข้ารหัสเนื้อหา aes128gcm (RFC 8291 + RFC 8188): ECDH กับ p256dh ของเบราว์เซอร์ + auth secret → HKDF → AES-128-GCM
   คีย์: VAPID_PUBLIC_KEY (wrangler.toml [vars], 65 ไบต์ uncompressed P-256, base64url)
         VAPID_PRIVATE_KEY (secret ใน dashboard เท่านั้น — ค่า d 32 ไบต์ base64url) — ห้าม commit */

const enc = new TextEncoder();

export function b64u(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64u(s) {
  s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/* ── ปลายทางที่ยอมส่ง: บริการ push ของเบราว์เซอร์หลักเท่านั้น (endpoint มาจากผู้ใช้ — กัน SSRF ไปที่อื่น) ── */
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com', 'push.apple.com', 'notify.windows.com'];

export function validEndpoint(endpoint, env) {
  const s = String(endpoint || '');
  if (s.length > 1000) return false;
  // เฉพาะชุดทดสอบ (tests/sync-server.mjs) — production ไม่มีตัวแปรนี้
  if (env && env.PUSH_DEV_ENDPOINT && s.startsWith(env.PUSH_DEV_ENDPOINT)) return true;
  let u;
  try { u = new URL(s); } catch (e) { return false; }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return false;
  const h = u.hostname.toLowerCase();
  return PUSH_HOSTS.some((d) => h === d || h.endsWith('.' + d));
}

export function validKeys(p256dh, auth) {
  try {
    const k = unb64u(p256dh), a = unb64u(auth);
    return k.length === 65 && k[0] === 4 && a.length === 16;
  } catch (e) {
    return false;
  }
}

/* ── VAPID ── */
async function importVapid(env) {
  const pub = unb64u(env.VAPID_PUBLIC_KEY);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY ต้องเป็น P-256 uncompressed 65 ไบต์');
  const jwk = { kty: 'EC', crv: 'P-256', d: String(env.VAPID_PRIVATE_KEY).trim(), x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true };
  const priv = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return { pub, priv };
}

/** สถานะคีย์: 'ok' | 'missing' | 'invalid' (public/private ไม่เข้าคู่หรือรูปแบบผิด) */
export async function vapidStatus(env) {
  if (!env || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return 'missing';
  try {
    const { pub, priv } = await importVapid(env);
    const msg = enc.encode('tanot-vapid-check');
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, msg);
    const pk = await crypto.subtle.importKey('raw', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return (await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pk, sig, msg)) ? 'ok' : 'invalid';
  } catch (e) {
    return 'invalid';
  }
}

async function vapidHeader(endpoint, env, now) {
  const { priv } = await importVapid(env);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'mailto:' + (env.OWNER_EMAIL || 'owner@example.com'),
  })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, enc.encode(head + '.' + body));
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + String(env.VAPID_PUBLIC_KEY).trim();
}

/* ── aes128gcm ── */
async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

/** เข้ารหัส payload (สตริง) ให้ subscription { p256dh, auth } → body ของคำขอ (Uint8Array) */
export async function encrypt(payload, p256dh, auth) {
  const uaPub = unb64u(p256dh), authSecret = unb64u(auth);
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(enc.encode(payload), new Uint8Array([2])); // 0x02 = record สุดท้าย (ไม่เติม padding)
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, cipher);
}

/** ส่ง 1 ข้อความถึง 1 subscription — คืน { ok, status, gone } (gone = 404/410 ให้ลบ subscription ทิ้ง) */
export async function sendPush(sub, payload, env, opts = {}) {
  if (!validEndpoint(sub.endpoint, env)) return { ok: false, status: 0, gone: true, error: 'endpoint' };
  const now = opts.now || Date.now();
  const body = await encrypt(payload, sub.p256dh, sub.auth);
  let res;
  try {
    res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidHeader(sub.endpoint, env, now),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(opts.ttl || 24 * 3600),
        Urgency: opts.urgency || 'normal',
      },
      body,
    });
  } catch (e) {
    return { ok: false, status: 0, gone: false, error: String(e && e.message || e) };
  }
  const ok = res.status >= 200 && res.status < 300;
  return { ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
