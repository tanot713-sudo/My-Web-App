/* ตัวเสิร์ฟไฟล์ของไลบรารี *Craft ที่เก็บใน R2 (ใช้โดย functions/api/craft/[[path]].js) — ไฟล์นี้ไม่ export onRequest* จึงไม่ใช่ route
   เหตุผล (เจ้าของตัดสิน 2026-11-17, ROADMAP แถว 11f): wasm ใหญ่ (SolidCraft ~100 MB) ไม่อยู่ใน GitHub — เก็บใน R2 bucket FILES
   (tanot-files, ไม่เปิด public) แล้วเสิร์ฟผ่าน Function ที่อยู่หลัง Cloudflare Access + _middleware.js (JWT ของเจ้าของ) = ใช้เองคนเดียว
   • bucket เดียวกันเก็บไฟล์ของผู้ใช้ (files.js) → อ่านได้เฉพาะคีย์ craft/<ชื่อโฟลเดอร์>/<ไฟล์> ที่อยู่ใน vendor/craft/manifest.json
     ของ deploy ปัจจุบัน และไลบรารีนั้นต้องมี "store": "r2" — ไม่มีทางประกอบคีย์อื่นจาก URL (เทียบชื่อไฟล์กับ manifest ตรงตัว)
   • manifest อ่านจาก static asset ของ deploy เดียวกัน (env.ASSETS) — เปลี่ยนพร้อมโค้ดทุก deploy
   • ไลบรารีที่ "encoding": "br" = object ใน R2 เป็น brotli ของไฟล์ (สคริปต์อัปโหลดบีบให้) → ส่ง Content-Encoding: br แบบ encodeBody 'manual'
     (sha256/bytes ใน manifest = ไฟล์ก่อนบีบ ซึ่งเบราว์เซอร์คลายให้ก่อน craft-loader.js ตรวจ) · เบราว์เซอร์ไม่รับ br = 406
   • body ส่งแบบ stream (ห้าม arrayBuffer()) · path มีรุ่นในชื่อโฟลเดอร์และห้ามเปลี่ยนเนื้อ (repo-guards) → immutable 1 ปี
     แต่ "private" (อยู่หลังการล็อกอิน — ห้าม shared cache เก็บ) */

export const MANIFEST_PATH = '/vendor/craft/manifest.json';
export const KEY_PREFIX = 'craft/';
const SEG = /^[A-Za-z0-9._-]+$/;
const TYPES = {
  wasm: 'application/wasm', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', json: 'application/json',
  txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', ttf: 'font/ttf', otf: 'font/otf', woff2: 'font/woff2',
};

/* pathname → { name, file } (name = ชื่อโฟลเดอร์ใต้ vendor/craft/, file อาจมี / ได้) หรือ null · ไม่ decode — %2e%2e ฯลฯ ไม่ผ่าน SEG */
export function parseCraftPath(pathname) {
  const m = /^\/api\/craft\/([^/]+)\/(.+)$/.exec(String(pathname || ''));
  if (!m) return null;
  const segs = m[2].split('/');
  if (!SEG.test(m[1]) || m[1] === '.' || m[1] === '..') return null;
  if (segs.some((s) => !SEG.test(s) || s === '.' || s === '..')) return null;
  return { name: m[1], file: m[2] };
}

/* manifest + { name, file } → { lib, L, meta } เมื่อเป็นไฟล์ของไลบรารี store r2 ใน manifest เท่านั้น ไม่งั้น null */
export function lookup(man, p) {
  if (!man || !man.libs || typeof man.libs !== 'object' || !p) return null;
  const own = Object.prototype.hasOwnProperty;
  for (const lib of Object.keys(man.libs)) {
    const L = man.libs[lib];
    if (!L || L.store !== 'r2' || L.dir !== 'vendor/craft/' + p.name) continue;
    if (!L.files || !own.call(L.files, p.file)) return null;
    const meta = L.files[p.file];
    if (!meta || !/^[0-9a-f]{64}$/.test(meta.sha256 || '')) return null;
    return { lib, L, meta };
  }
  return null;
}

export function contentType(file) {
  const ext = (/\.([A-Za-z0-9]+)$/.exec(file) || [])[1];
  return TYPES[String(ext || '').toLowerCase()] || 'application/octet-stream';
}

function text(status, body, extra) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...(extra || {}) } });
}

async function readManifest(request, env) {
  if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== 'function') return null;
  try {
    const res = await env.ASSETS.fetch(new Request(new URL(MANIFEST_PATH, request.url)));
    return res.ok ? await res.json() : null;
  } catch (e) { return null; }
}

export async function serveCraft(request, env) {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') return text(405, 'Method not allowed', { Allow: 'GET, HEAD' });
  const p = parseCraftPath(new URL(request.url).pathname);
  if (!p) return text(404, 'Not found');
  if (!env || !env.FILES) return text(503, 'R2 binding FILES is missing');
  const man = await readManifest(request, env);
  if (!man) return text(503, 'Could not read the craft manifest');
  const hit = lookup(man, p);
  if (!hit) return text(404, 'Not found');
  const br = hit.L.encoding === 'br';
  if (br && !/\bbr\b/i.test(request.headers.get('Accept-Encoding') || '')) return text(406, 'This file is only stored brotli-compressed');

  const key = KEY_PREFIX + p.name + '/' + p.file;
  let obj;
  try { obj = method === 'HEAD' ? await env.FILES.head(key) : await env.FILES.get(key); } catch (e) { return text(502, 'R2 read failed'); }
  if (!obj) return text(404, 'Not uploaded to R2 yet');

  const headers = new Headers({
    'Content-Type': contentType(p.file),
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  if (typeof obj.size === 'number') headers.set('Content-Length', String(obj.size));
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag);
  if (br) { headers.set('Content-Encoding', 'br'); headers.set('Vary', 'Accept-Encoding'); }
  const init = { status: 200, headers };
  if (br) init.encodeBody = 'manual'; // object เป็น brotli อยู่แล้ว — ห้าม runtime บีบซ้ำ
  return new Response(method === 'HEAD' ? null : obj.body, init);
}
