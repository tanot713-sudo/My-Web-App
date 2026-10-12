/* ตัวส่งต่อไฟล์โมเดลของ Tanotfin จาก Hugging Face (ใช้โดย functions/api/hf/[[path]].js) — ไฟล์นี้ไม่ export onRequest* จึงไม่ใช่ route
   เหตุผล: เจ้าของจะตั้ง repo ทุกตัวใต้ huggingface.co/Tanotfin/* เป็น private → เบราว์เซอร์โหลดตรงไม่ได้ ต้องผ่าน Function ที่อยู่หลัง
   Cloudflare Access (+ _middleware.js ตรวจ JWT ของเจ้าของ) แล้วแนบ HF_TOKEN (Secret ใน dashboard เท่านั้น — ห้ามอยู่ในไฟล์/log/response)
   • ไม่ใช่ open proxy: owner ตายตัว "Tanotfin" · รูปแบบเดียว /api/hf/Tanotfin/<repo>/resolve/<main|commit 40 hex>/<ไฟล์>
     repo/ไฟล์ = [A-Za-z0-9._/-] ไม่มี ".." ไม่มี segment ว่าง · GET/HEAD เท่านั้น
   • ตาม redirect ของ HF เอง (redirect:'manual' ทีละขั้น ≤ MAX_REDIRECTS): Authorization แนบเฉพาะคำขอที่ไป https://huggingface.co
     (เช่น /api/resolve-cache/… แบบ relative) — ปลายทาง CDN/xet (*.hf.co) เป็น URL ที่เซ็นแล้ว ไม่ส่ง token · redirect ไปโฮสต์อื่นนอก HF = 502
   • body ส่งต่อแบบ stream (ไฟล์ใหญ่สุด ~661 MB) — ห้าม arrayBuffer()/text() ของคำตอบที่สำเร็จ
   • 401/403 จาก HF (token ผิด/ไม่มีสิทธิ์ repo) → 502 ไม่ส่งต่อ — 401/403 ฝั่งเบราว์เซอร์สงวนไว้ให้ "เซสชัน Access หมดอายุ" (media-models.js) */

export const HF_OWNER = 'Tanotfin';
export const HF_ORIGIN = 'https://huggingface.co';
export const MAX_REDIRECTS = 5;
const PATH_RE = /^\/api\/hf\/Tanotfin\/([A-Za-z0-9._-]+)\/resolve\/(main|[0-9a-f]{40})\/([A-Za-z0-9._/-]+)$/;
const PASS_HEADERS = ['content-length', 'content-type', 'etag', 'accept-ranges', 'content-range', 'last-modified'];

/* pathname ของคำขอ → { repo, rev, file } หรือ null (ปฏิเสธ) */
export function parseHfPath(pathname) {
  const m = PATH_RE.exec(String(pathname || ''));
  if (!m) return null;
  const [, repo, rev, file] = m;
  if (/\.\./.test(repo) || /\.\./.test(file)) return null;
  if (file.split('/').some((seg) => seg === '' || seg === '.')) return null;
  return { repo, rev, file };
}

export function hfUrl({ repo, rev, file }) {
  return `${HF_ORIGIN}/${HF_OWNER}/${repo}/resolve/${rev}/${file}`;
}

/* ปลายทาง redirect ที่ยอมตาม: https + โฮสต์ของ Hugging Face เท่านั้น */
export function allowedRedirect(u) {
  if (u.protocol !== 'https:') return false;
  const h = u.hostname;
  return h === 'huggingface.co' || h.endsWith('.huggingface.co') || h === 'hf.co' || h.endsWith('.hf.co');
}

function text(status, body, extra) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...(extra || {}) } });
}

/* ส่งต่อ 1 คำขอ · fetchImpl ให้เทสต์ใส่ upstream ปลอมได้ (ค่าเริ่มต้น = fetch ของ runtime) */
export async function proxyHf(request, env, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') return text(405, 'Method not allowed', { Allow: 'GET, HEAD' });
  const p = parseHfPath(new URL(request.url).pathname);
  if (!p) return text(404, 'Not a Tanotfin model file path');
  if (!env || !env.HF_TOKEN) return text(503, 'HF_TOKEN secret is not set on this Pages project');

  const range = request.headers.get('Range');
  let url = hfUrl(p);
  let upstream;
  for (let hop = 0; ; hop++) {
    const target = new URL(url);
    const headers = new Headers();
    if (range) headers.set('Range', range);
    if (target.origin === HF_ORIGIN) headers.set('Authorization', 'Bearer ' + env.HF_TOKEN);
    try {
      upstream = await doFetch(target.toString(), { method, headers, redirect: 'manual' });
    } catch (e) {
      return text(502, 'Upstream fetch failed');
    }
    const loc = upstream.status >= 300 && upstream.status < 400 ? upstream.headers.get('Location') : null;
    if (!loc) break;
    try { if (upstream.body) await upstream.body.cancel(); } catch (e) { /* ไม่มี body ให้ปิด */ }
    if (hop >= MAX_REDIRECTS) return text(502, 'Too many redirects from Hugging Face');
    let next;
    try { next = new URL(loc, target); } catch (e) { return text(502, 'Bad redirect from Hugging Face'); }
    if (!allowedRedirect(next)) return text(502, 'Redirect host not allowed');
    url = next.toString();
  }

  const st = upstream.status;
  if (st === 401 || st === 403) {
    try { if (upstream.body) await upstream.body.cancel(); } catch (e) {}
    return text(502, 'Hugging Face refused the token (check HF_TOKEN scope)');
  }
  if (st >= 400) {
    try { if (upstream.body) await upstream.body.cancel(); } catch (e) {}
    return text(st === 404 ? 404 : 502, st === 404 ? 'Not found on Hugging Face (404)' : 'Hugging Face error (' + st + ')');
  }

  const headers = new Headers();
  // fetch ของ runtime คลายการบีบอัด (gzip/br) ให้เอง → Content-Length ของ HF เป็นขนาดก่อนคลาย ส่งต่อไม่ได้ (transformers.js จองบัฟเฟอร์ตามค่านี้)
  // ส่ง Content-Encoding ต่อแทน ให้ runtime บีบอัดกลับตอนส่ง · ไฟล์โมเดล (.onnx จาก CDN) ไม่บีบอัด → Content-Length ส่งต่อตามเดิม
  const enc = (upstream.headers.get('content-encoding') || '').toLowerCase();
  const encoded = enc && enc !== 'identity';
  for (const h of PASS_HEADERS) {
    if (h === 'content-length' && encoded) continue;
    const v = upstream.headers.get(h); if (v) headers.set(h, v);
  }
  if (encoded) headers.set('Content-Encoding', enc);
  if (!headers.has('content-type')) headers.set('Content-Type', 'application/octet-stream');
  // ไฟล์ตาม commit hash ไม่เปลี่ยนอีก · main เปลี่ยนได้เมื่อเจ้าของอัปโหลดใหม่ (transformers.js เก็บสำเนาใน Cache Storage ของตัวเองอยู่แล้ว)
  headers.set('Cache-Control', p.rev === 'main' ? 'private, max-age=3600' : 'private, max-age=31536000, immutable');
  // เสิร์ฟจาก origin ของเว็บ — กันไฟล์ใน repo ถูกตีความเป็นหน้าเว็บ/สคริปต์
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
  return new Response(method === 'HEAD' ? null : upstream.body, { status: st, headers });
}
