// โมเดลของ Tanotfin ผ่าน /api/hf/ (เตรียมตั้ง repo บน Hugging Face เป็น private — 2026-10)
// A) functions/_lib/hf.js + functions/api/hf/[[path]].js ตัวจริงใน Node กับ upstream ตัวหลอก: ปฏิเสธ path/method ที่ไม่ใช่, ไม่มี HF_TOKEN → 503,
//    Authorization ไป huggingface.co เท่านั้น (ไม่ส่งต่อหลัง redirect ไป CDN), Range, header ที่ส่งต่อ, stream ไม่ buffer, token ไม่หลุดใน response
// B) media-models.js useHfProxy/hfFetch (vm): เปลี่ยนเฉพาะ URL ของ Tanotfin บน *.pages.dev · เซสชันหมดอายุ = SessionError ไม่ใช่เครือข่ายสะดุด
// C) หน้า text-to-speech บนโฮสต์ *.pages.dev จำลอง (--host-resolver-rules) กับ transformers.js หลอกที่ fetch ผ่าน env.fetch:
//    tts-worker.js / asr-worker.js / เธรดหลักโหลด Tanotfin ผ่าน /api/hf/ · repo อื่นโหลดตรง · 401 → "เข้าสู่ระบบใหม่" ไม่ถอยรุ่น
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const TOKEN = 'hf_TEST_TOKEN_do_not_leak_123';
/* โหลดไฟล์ ESM ของ functions/ ในเทสต์: ตัวโหลดของ Playwright อ่าน .js ใต้ repo เป็น CommonJS (import()/require ใช้ไม่ได้) จึงตัด
   "export"/"import" ออกแล้วรันใน realm นี้ — ตรวจว่าโค้ดที่ตัดแล้วยังมีชื่อที่ export ครบ (ไฟล์ถูกเปลี่ยนรูปแบบ = เทสต์ล้ม ไม่ผ่านเงียบๆ) */
function loadEsm(rel, names, deps) {
  let src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const n of names) expect(src, rel + ' export ' + n).toMatch(new RegExp('export (async )?(function|const) ' + n + '\\b'));
  src = src.replace(/^import \{([^}]+)\} from '[^']+';$/gm, (m, ids) => 'const {' + ids + '} = __deps;').replace(/^export /gm, '');
  return new Function('__deps', src + '\nreturn { ' + names.join(', ') + ' };')(deps || {});
}
const LIB_NAMES = ['HF_OWNER', 'HF_ORIGIN', 'MAX_REDIRECTS', 'parseHfPath', 'hfUrl', 'allowedRedirect', 'proxyHf'];
const lib = async () => loadEsm('functions/_lib/hf.js', LIB_NAMES);
const route = async () => {
  const src = fs.readFileSync(path.join(ROOT, 'functions/api/hf/[[path]].js'), 'utf8');
  expect(src).toContain("import { proxyHf } from '../../_lib/hf.js';");
  return loadEsm('functions/api/hf/[[path]].js', ['onRequest'], await lib());
};
const req = (p, init) => new Request('https://my-web-app-5w2.pages.dev' + p, init);
// จำลองโฮสต์ *.pages.dev (ส่วน C) ชี้ไปเซิร์ฟเวอร์ static พอร์ต 8123 — ต้องตั้งระดับไฟล์ (บังคับเบราว์เซอร์ใหม่)
const PAGES_HOST = 'hf-test.pages.dev';
test.use({ launchOptions: { args: [`--host-resolver-rules=MAP ${PAGES_HOST} 127.0.0.1`] } });
const FILE = '/api/hf/Tanotfin/mms-tts-2081-FM-stable2-onnx/resolve/main/onnx/model_quantized.onnx';

/* upstream ตัวหลอก: handler(url, init) → Response · เก็บทุกคำขอ */
function fakeFetch(handler) {
  const calls = [];
  const f = async (url, init) => {
    const h = new Headers((init && init.headers) || {});
    calls.push({ url: String(url), method: (init && init.method) || 'GET', redirect: init && init.redirect, auth: h.get('Authorization'), range: h.get('Range') });
    return handler(String(url), init, calls.length);
  };
  f.calls = calls;
  return f;
}
const bytes = (n, v = 7) => new Uint8Array(n).fill(v);
async function noLeak(res) {
  const body = res.body ? await res.clone().text() : '';
  expect(body).not.toContain(TOKEN);
  for (const [, v] of res.headers) expect(v).not.toContain(TOKEN);
}

/* ═══════════════ A) Function ═══════════════ */
test.describe('A) /api/hf/ — Function ตัวจริงกับ upstream ตัวหลอก', () => {
  test('parseHfPath: รับเฉพาะ Tanotfin/<repo>/resolve/<main|commit>/<ไฟล์> · ปฏิเสธ owner อื่น/../segment ว่าง/อักขระนอกชุด/rev อื่น', async () => {
    const { parseHfPath } = await lib();
    expect(parseHfPath(FILE)).toEqual({ repo: 'mms-tts-2081-FM-stable2-onnx', rev: 'main', file: 'onnx/model_quantized.onnx' });
    expect(parseHfPath('/api/hf/Tanotfin/distill-whisper-th-small-onnx/resolve/0123456789abcdef0123456789abcdef01234567/config.json'))
      .toEqual({ repo: 'distill-whisper-th-small-onnx', rev: '0123456789abcdef0123456789abcdef01234567', file: 'config.json' });
    for (const bad of [
      '/api/hf/Xenova/whisper-tiny/resolve/main/config.json', '/api/hf/tanotfin/x/resolve/main/config.json', '/api/hf/Tanotfin2/x/resolve/main/a',
      '/api/hf/Tanotfin/x/resolve/main/../../Xenova/y/config.json', '/api/hf/Tanotfin/../x/resolve/main/a', '/api/hf/Tanotfin/x..y/resolve/main/a',
      '/api/hf/Tanotfin/x/resolve/main/a/..', '/api/hf/Tanotfin/x/resolve/main//a', '/api/hf/Tanotfin/x/resolve/main/./a', '/api/hf/Tanotfin/x/resolve/main/a%2F..%2Fb',
      '/api/hf/Tanotfin/x/resolve/dev/a', '/api/hf/Tanotfin/x/resolve/0123abc/a', '/api/hf/Tanotfin/x/resolve/main/', '/api/hf/Tanotfin/x/blob/main/a',
      '/api/hf/Tanotfin/x/resolve/main/a?b', '/api/hf/Tanotfin/x/resolve/main/a b', '/api/hf/Tanotfin/x/raw/main/a', '/api/hf/Tanotfin/x', '/api/hf/', '/api/hf/Tanotfin/x/resolve/main/a\\b',
      '/api/hf/Tanotfin/x/resolve/main/https://evil.example/a',
    ]) expect(parseHfPath(bad), bad).toBe(null);
  });

  test('method อื่นนอกจาก GET/HEAD → 405 · path ไม่ใช่ → 404 · ทั้งคู่ไม่เรียก upstream', async () => {
    const { proxyHf } = await lib();
    const f = fakeFetch(() => new Response('x'));
    for (const m of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
      const r = await proxyHf(req(FILE, { method: m, body: m === 'OPTIONS' ? undefined : (m === 'DELETE' ? undefined : 'x') }), { HF_TOKEN: TOKEN }, f);
      expect(r.status, m).toBe(405);
      expect(r.headers.get('Allow')).toBe('GET, HEAD');
    }
    for (const p of ['/api/hf/Xenova/whisper-tiny/resolve/main/config.json', '/api/hf/Tanotfin/x/resolve/main/../y']) {
      const r = await proxyHf(req(p), { HF_TOKEN: TOKEN }, f);
      expect(r.status, p).toBe(404);
    }
    expect(f.calls).toEqual([]);
  });

  test('ไม่มี HF_TOKEN → 503 บอกว่ายังไม่ได้ตั้ง secret · ไม่เรียก upstream', async () => {
    const { proxyHf } = await lib();
    const f = fakeFetch(() => new Response('x'));
    for (const env of [{}, { HF_TOKEN: '' }, undefined]) {
      const r = await proxyHf(req(FILE), env, f);
      expect(r.status).toBe(503);
      expect(await r.text()).toMatch(/HF_TOKEN secret is not set/);
    }
    expect(f.calls).toEqual([]);
  });

  test('ส่งไป huggingface.co/Tanotfin/… พร้อม Authorization: Bearer HF_TOKEN · redirect:manual · ส่งต่อ header ที่จำเป็น + Cache-Control/CSP · token ไม่หลุด', async () => {
    const { proxyHf } = await lib();
    const f = fakeFetch(() => new Response(bytes(10), { status: 200, headers: {
      'Content-Length': '10', 'Content-Type': 'application/octet-stream', ETag: '"abc"', 'Accept-Ranges': 'bytes', 'Last-Modified': 'Mon, 01 Jan 2026 00:00:00 GMT',
      'Set-Cookie': 'hf=1', 'X-Linked-Etag': 'zzz', 'Access-Control-Allow-Origin': '*' } }));
    const r = await proxyHf(req(FILE), { HF_TOKEN: TOKEN }, f);
    expect(f.calls).toEqual([{ url: 'https://huggingface.co/Tanotfin/mms-tts-2081-FM-stable2-onnx/resolve/main/onnx/model_quantized.onnx', method: 'GET', redirect: 'manual', auth: 'Bearer ' + TOKEN, range: null }]);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-length')).toBe('10');
    expect(r.headers.get('content-type')).toBe('application/octet-stream');
    expect(r.headers.get('etag')).toBe('"abc"');
    expect(r.headers.get('accept-ranges')).toBe('bytes');
    expect(r.headers.get('last-modified')).toBe('Mon, 01 Jan 2026 00:00:00 GMT');
    expect(r.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('content-security-policy')).toMatch(/sandbox/);
    // ไม่ส่งต่อ header อื่นของ HF (คุกกี้/CORS) — เว็บเรียกแบบ same-origin
    expect(r.headers.get('set-cookie')).toBe(null);
    expect(r.headers.get('access-control-allow-origin')).toBe(null);
    expect(r.headers.get('x-linked-etag')).toBe(null);
    await noLeak(r);
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes(10));
  });

  test('upstream บีบอัด (Content-Encoding gzip) → ไม่ส่ง Content-Length เดิม (ขนาดก่อนคลาย) แต่ส่ง Content-Encoding ต่อ', async () => {
    const { proxyHf } = await lib();
    const f = fakeFetch(() => ({ status: 200, body: null, headers: new Headers({ 'Content-Encoding': 'gzip', 'Content-Length': '123', 'Content-Type': 'application/json', ETag: '"j"' }) }));
    const r = await proxyHf(req('/api/hf/Tanotfin/x/resolve/main/config.json'), { HF_TOKEN: TOKEN }, f);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-length')).toBe(null);
    expect(r.headers.get('content-encoding')).toBe('gzip');
    expect(r.headers.get('etag')).toBe('"j"');
  });

  test('rev เป็น commit hash → Cache-Control immutable 1 ปี', async () => {
    const { proxyHf } = await lib();
    const f = fakeFetch(() => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const r = await proxyHf(req('/api/hf/Tanotfin/x/resolve/0123456789abcdef0123456789abcdef01234567/config.json'), { HF_TOKEN: TOKEN }, f);
    expect(r.headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
    expect(f.calls[0].url).toBe('https://huggingface.co/Tanotfin/x/resolve/0123456789abcdef0123456789abcdef01234567/config.json');
  });

  test('redirect ไป CDN/xet ของ HF: ตามเอง ไม่ส่ง Authorization ไปโฮสต์อื่น · Range ส่งทุกขั้น · 206 + Content-Range ส่งต่อ', async () => {
    const { proxyHf } = await lib();
    const f = fakeFetch((url, init, n) => {
      if (n === 1) return new Response(null, { status: 302, headers: { Location: 'https://cas-bridge.xethub.hf.co/xet-bridge-us/abc?X-Amz-Signature=sig' } });
      return new Response(bytes(4, 9), { status: 206, headers: { 'Content-Length': '4', 'Content-Range': 'bytes 0-3/661000000', 'Content-Type': 'binary/octet-stream', 'Accept-Ranges': 'bytes' } });
    });
    const r = await proxyHf(req(FILE, { headers: { Range: 'bytes=0-3' } }), { HF_TOKEN: TOKEN }, f);
    expect(f.calls.map((c) => [new URL(c.url).hostname, c.auth, c.range, c.redirect])).toEqual([
      ['huggingface.co', 'Bearer ' + TOKEN, 'bytes=0-3', 'manual'],
      ['cas-bridge.xethub.hf.co', null, 'bytes=0-3', 'manual'],
    ]);
    expect(f.calls[1].url).toBe('https://cas-bridge.xethub.hf.co/xet-bridge-us/abc?X-Amz-Signature=sig');
    expect(r.status).toBe(206);
    expect(r.headers.get('content-range')).toBe('bytes 0-3/661000000');
    expect(r.headers.get('content-length')).toBe('4');
    await noLeak(r);
  });

  test('redirect แบบ relative บน huggingface.co (resolve-cache) ยังแนบ token · ต่อด้วย cdn-lfs.hf.co ไม่แนบ', async () => {
    const { proxyHf } = await lib();
    const f = fakeFetch((url, init, n) => {
      if (n === 1) return new Response(null, { status: 307, headers: { Location: '/api/resolve-cache/models/Tanotfin/x/abc/config.json' } });
      if (n === 2) return new Response(null, { status: 302, headers: { Location: 'https://cdn-lfs.hf.co/repos/aa/bb?sig=1' } });
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const r = await proxyHf(req('/api/hf/Tanotfin/x/resolve/main/config.json'), { HF_TOKEN: TOKEN }, f);
    expect(f.calls.map((c) => [c.url, c.auth])).toEqual([
      ['https://huggingface.co/Tanotfin/x/resolve/main/config.json', 'Bearer ' + TOKEN],
      ['https://huggingface.co/api/resolve-cache/models/Tanotfin/x/abc/config.json', 'Bearer ' + TOKEN],
      ['https://cdn-lfs.hf.co/repos/aa/bb?sig=1', null],
    ]);
    expect(r.status).toBe(200);
  });

  test('redirect ไปโฮสต์นอก HF / http / วนเกิน 5 ขั้น → 502 และไม่เรียกโฮสต์นั้น', async () => {
    const { proxyHf } = await lib();
    for (const loc of ['https://evil.example/steal', 'http://cdn-lfs.hf.co/a', 'https://hf.co.evil.example/a', 'https://huggingface.co.evil.example/a', 'javascript:alert(1)']) {
      const f = fakeFetch(() => new Response(null, { status: 302, headers: { Location: loc } }));
      const r = await proxyHf(req(FILE), { HF_TOKEN: TOKEN }, f);
      expect(r.status, loc).toBe(502);
      expect(f.calls.length, loc).toBe(1);
      await noLeak(r);
    }
    const loop = fakeFetch(() => new Response(null, { status: 302, headers: { Location: 'https://cdn-lfs.hf.co/again' } }));
    const r = await proxyHf(req(FILE), { HF_TOKEN: TOKEN }, loop);
    expect(r.status).toBe(502);
    expect(loop.calls.length).toBe(6); // ครั้งแรก + redirect 5 ขั้น
    expect(loop.calls.slice(1).every((c) => c.auth === null)).toBe(true);
  });

  test('HF ตอบ 401/403 (token ผิด/ไม่มีสิทธิ์) → 502 (401/403 สงวนให้เซสชัน Access) · 404 → 404 · 5xx → 502 · upstream ล้ม → 502 · ไม่ส่ง body ของ HF ต่อ', async () => {
    const { proxyHf } = await lib();
    for (const [st, want] of [[401, 502], [403, 502], [404, 404], [500, 502], [503, 502], [429, 502]]) {
      const f = fakeFetch(() => new Response('{"error":"Repository not found ' + TOKEN + '"}', { status: st }));
      const r = await proxyHf(req(FILE), { HF_TOKEN: TOKEN }, f);
      expect(r.status, String(st)).toBe(want);
      expect(await r.clone().text()).not.toMatch(/Repository not found/);
      await noLeak(r);
    }
    const boom = fakeFetch(() => { throw new TypeError('network down ' + TOKEN); });
    const r = await proxyHf(req(FILE), { HF_TOKEN: TOKEN }, boom);
    expect(r.status).toBe(502);
    await noLeak(r);
  });

  test('HEAD → ส่ง HEAD ไป HF ตาม redirect เหมือนกัน · ไม่มี body · Content-Length/ETag ส่งต่อ', async () => {
    const { proxyHf } = await lib();
    const f = fakeFetch((url, init, n) => n === 1
      ? new Response(null, { status: 302, headers: { Location: 'https://cdn-lfs.hf.co/x' } })
      : new Response(null, { status: 200, headers: { 'Content-Length': '661000000', ETag: '"e"' } }));
    const r = await proxyHf(req(FILE, { method: 'HEAD' }), { HF_TOKEN: TOKEN }, f);
    expect(f.calls.map((c) => [c.method, c.auth != null])).toEqual([['HEAD', true], ['HEAD', false]]);
    expect(r.status).toBe(200);
    expect(r.body).toBe(null);
    expect(r.headers.get('content-length')).toBe('661000000');
    expect(r.headers.get('etag')).toBe('"e"');
  });

  test('body ส่งต่อแบบ stream: upstream ไม่มีวันจบ (จำลองไฟล์ ~661 MB) — Function ตอบกลับทันทีโดยยังไม่อ่าน body · อ่านทีละก้อนตามที่ผู้รับดึง', async () => {
    const { proxyHf } = await lib();
    let pulled = 0, cancelled = false;
    const CHUNK = 1 << 20;
    const f = fakeFetch(() => new Response(new ReadableStream({
      pull(c) { pulled++; c.enqueue(new Uint8Array(CHUNK)); },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 }), { status: 200, headers: { 'Content-Length': String(661 * CHUNK), 'Content-Type': 'application/octet-stream' } }));
    const r = await Promise.race([proxyHf(req(FILE), { HF_TOKEN: TOKEN }, f), new Promise((_, rej) => setTimeout(() => rej(new Error('Function รอ body ทั้งก้อน (buffer)')), 3000))]);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-length')).toBe(String(661 * CHUNK));
    expect(pulled).toBeLessThanOrEqual(1); // ยังไม่ได้อ่าน body เกินก้อนแรก
    const rd = r.body.getReader();
    let got = 0;
    for (let i = 0; i < 3; i++) { const { value } = await rd.read(); got += value.length; }
    expect(got).toBe(3 * CHUNK);
    expect(pulled).toBeLessThanOrEqual(5); // ดึงจาก upstream ตามที่อ่าน ไม่ล่วงหน้าทั้งไฟล์
    await rd.cancel();
    await expect.poll(() => cancelled).toBe(true); // ผู้รับยกเลิก → ยกเลิก upstream ด้วย
  });

  test('route file functions/api/hf/[[path]].js ใช้ fetch ของ runtime + env ของ context', async () => {
    const { onRequest } = await route();
    const orig = globalThis.fetch;
    const f = fakeFetch(() => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = f;
    try {
      const r = await onRequest({ request: req('/api/hf/Tanotfin/x/resolve/main/config.json'), env: { HF_TOKEN: TOKEN }, data: {} });
      expect(r.status).toBe(200);
      expect(f.calls[0]).toMatchObject({ url: 'https://huggingface.co/Tanotfin/x/resolve/main/config.json', auth: 'Bearer ' + TOKEN });
      const r2 = await onRequest({ request: req('/api/hf/Tanotfin/x/resolve/main/config.json'), env: {}, data: {} });
      expect(r2.status).toBe(503);
    } finally { globalThis.fetch = orig; }
  });

  test('ไม่มี HF_TOKEN หรือค่าโทเคนใดๆ ในไฟล์ของ repo (wrangler.toml / functions) · ไม่มี console.* ใน Function', async () => {
    const wr = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');
    expect(wr).not.toMatch(/HF_TOKEN\s*=/);
    expect(wr).not.toMatch(/hf_[A-Za-z0-9]{20,}/);
    for (const f of ['functions/_lib/hf.js', 'functions/api/hf/[[path]].js']) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      expect(src, f).not.toMatch(/console\./);
      expect(src, f).not.toMatch(/hf_[A-Za-z0-9]{20,}/);
    }
  });
});

/* ═══════════════ B) media-models.js ═══════════════ */
function models(host) {
  const sandbox = { self: { location: { hostname: host, origin: 'https://' + host } } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'media-models.js'), 'utf8'), sandbox);
  return sandbox.self.TanotMediaModels;
}
function recorder(res) {
  const calls = [];
  const f = async (input, init) => { calls.push({ url: String(input), init: init || null }); return typeof res === 'function' ? res(input, init) : res || { type: 'basic', status: 200 }; };
  f.calls = calls;
  return f;
}

test.describe('B) media-models.js — env.fetch กลาง', () => {
  const HOST = 'my-web-app-5w2.pages.dev';
  test('hfProxyUrl: เฉพาะ huggingface.co|hf.co/Tanotfin/… บน *.pages.dev → <origin>/api/hf/Tanotfin/… (ตัด query)', () => {
    const M = models(HOST);
    expect(M.hfProxyUrl('https://huggingface.co/Tanotfin/mms-tts-2081-FM-stable2-onnx/resolve/main/onnx/model_quantized.onnx'))
      .toBe('https://' + HOST + '/api/hf/Tanotfin/mms-tts-2081-FM-stable2-onnx/resolve/main/onnx/model_quantized.onnx');
    expect(M.hfProxyUrl('https://hf.co/Tanotfin/x/resolve/main/config.json?download=1')).toBe('https://' + HOST + '/api/hf/Tanotfin/x/resolve/main/config.json');
    for (const u of ['https://huggingface.co/Xenova/whisper-tiny/resolve/main/config.json', 'https://huggingface.co/onnx-community/whisper-small/resolve/main/config.json',
      'https://huggingface.co/phlebotomy1996/mms-thai-female-podcast-spk0/resolve/main/onnx/model.onnx', 'https://huggingface.co/TanotfinX/a/resolve/main/b',
      'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.asyncify.wasm', 'http://huggingface.co/Tanotfin/a/resolve/main/b',
      'https://evil.example/https://huggingface.co/Tanotfin/a', '/vendor/transformers/ort-wasm-simd-threaded.mjs']) expect(M.hfProxyUrl(u), u).toBe(null);
    // ไม่ใช่ pages.dev (เครื่อง/GitHub Pages) = โหลดตรงเหมือนเดิม
    for (const h of ['localhost', '127.0.0.1', 'tanot713-sudo.github.io', 'pages.dev.evil.example']) expect(models(h).hfProxyUrl('https://huggingface.co/Tanotfin/a/resolve/main/b'), h).toBe(null);
  });

  test('TANOT_HF_PROXY override (เทสต์) เปิด/ปิดได้', () => {
    const sandbox = { self: { location: { hostname: 'localhost', origin: 'http://localhost:1' }, TANOT_HF_PROXY: { enabled: true } } };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'media-models.js'), 'utf8'), sandbox);
    expect(sandbox.self.TanotMediaModels.hfProxyUrl('https://huggingface.co/Tanotfin/a/resolve/main/b')).toBe('http://localhost:1/api/hf/Tanotfin/a/resolve/main/b');
    sandbox.self.TANOT_HF_PROXY = { enabled: false };
    expect(sandbox.self.TanotMediaModels.hfProxyUrl('https://huggingface.co/Tanotfin/a/resolve/main/b')).toBe(null);
  });

  test('useHfProxy: Tanotfin → /api/hf/ (same-origin, redirect:manual, header เดิม เช่น Range) · repo อื่นส่งต่อ fetch เดิมตามเดิมทุกอย่าง · ตั้งซ้ำไม่ห่อซ้อน', async () => {
    const M = models(HOST);
    const base = recorder();
    const env = { fetch: base };
    M.useHfProxy(env); const once = env.fetch; M.useHfProxy(env);
    expect(env.fetch).toBe(once);
    const h = { Range: 'bytes=0-0' };
    await env.fetch('https://huggingface.co/Tanotfin/a/resolve/main/onnx/model.onnx', { method: 'GET', headers: h, cache: 'no-store' });
    await env.fetch(new URL('https://huggingface.co/Tanotfin/a/resolve/main/config.json'));
    const other = { headers: { x: '1' } };
    await env.fetch('https://huggingface.co/Xenova/whisper-tiny/resolve/main/config.json', other);
    await env.fetch('https://cdn.jsdelivr.net/npm/x.wasm');
    expect(base.calls[0].url).toBe('https://' + HOST + '/api/hf/Tanotfin/a/resolve/main/onnx/model.onnx');
    expect(base.calls[0].init).toEqual({ method: 'GET', headers: h, cache: 'no-store', credentials: 'same-origin', redirect: 'manual' });
    expect(base.calls[1].url).toBe('https://' + HOST + '/api/hf/Tanotfin/a/resolve/main/config.json');
    expect(base.calls[1].init).toEqual({ credentials: 'same-origin', redirect: 'manual' });
    expect(base.calls[2]).toEqual({ url: 'https://huggingface.co/Xenova/whisper-tiny/resolve/main/config.json', init: other });
    expect(base.calls[3]).toEqual({ url: 'https://cdn.jsdelivr.net/npm/x.wasm', init: null });
  });

  test('เซสชันหมดอายุ: opaqueredirect / 401 / 403 → SessionError (code session) · ไม่ใช่ network error · 404/503 ส่งต่อให้ transformers.js ตามเดิม', async () => {
    const M = models(HOST);
    for (const res of [{ type: 'opaqueredirect', status: 0 }, { type: 'basic', status: 401 }, { type: 'basic', status: 403 }]) {
      const env = { fetch: recorder(res) }; M.useHfProxy(env);
      const err = await env.fetch('https://huggingface.co/Tanotfin/a/resolve/main/b').then(() => null, (e) => e);
      expect(err && err.name).toBe('SessionError');
      expect(err.code).toBe('session');
      expect(M.isSessionError(err)).toBe(true);
      expect(M.isNetworkError(err)).toBe(false);
      // ข้าม Worker มาเหลือแค่ name/message ก็ยังจำได้ (หน้า/วิดเจ็ตใช้)
      expect(M.isSessionError({ name: 'Error', message: err.message })).toBe(true);
      expect(M.isSessionError({ causeName: 'SessionError', causeMessage: '' })).toBe(true);
    }
    for (const st of [200, 206, 404, 503]) {
      const env = { fetch: recorder({ type: 'basic', status: st }) }; M.useHfProxy(env);
      expect((await env.fetch('https://huggingface.co/Tanotfin/a/resolve/main/b')).status).toBe(st);
    }
    // repo อื่นได้ 401 → ไม่ใช่เรื่องเซสชัน (ส่งต่อตามเดิม)
    const env = { fetch: recorder({ type: 'cors', status: 401 }) }; M.useHfProxy(env);
    expect((await env.fetch('https://huggingface.co/Xenova/a/resolve/main/b')).status).toBe(401);
    expect(M.isSessionError(new TypeError('network error'))).toBe(false);
    expect(M.isNetworkError(new TypeError('network error'))).toBe(true);
  });
});

/* ═══════════════ C) หน้าเว็บบน *.pages.dev จำลอง ═══════════════ */
const BASE = `http://${PAGES_HOST}:8123`;
test.describe('C) หน้า text-to-speech บนโฮสต์ pages.dev — โมเดลของ Tanotfin ผ่าน /api/hf/', () => {

  /* transformers.js หลอก: pipeline() ขอ config.json ผ่าน env.fetch (เหมือนตัวจริง) — ตอบ ≠ 200 = โยน error แบบ transformers.js */
  const FAKE = `
export const env = { backends: { onnx: { wasm: {} } }, fetch: (...a) => fetch(...a) };
export class TextStreamer { constructor(t, o) { this.o = o; } }
export async function pipeline(task, model, opts) {
  const r = await env.fetch('https://huggingface.co/' + model + '/resolve/main/config.json', { headers: new Headers() });
  if (r.status !== 200) throw new Error('Could not locate file (' + r.status + '): "https://huggingface.co/' + model + '/resolve/main/config.json".');
  await r.text();
  if (task === 'text-to-speech') return async (text) => { const a = new Float32Array(16000); for (let i = 0; i < a.length; i++) a[i] = Math.sin(i / 8) * 0.3; return { audio: a, sampling_rate: 16000 }; };
  return async () => ({ text: 'ทดสอบ', chunks: [{ timestamp: [0, 1], text: 'ทดสอบ' }] });
}`;

  async function setup(context, page, { hfStatus = 200 } = {}) {
    const errors = [], hf = [], direct = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await context.route('**/*', async (r) => {
      const u = new URL(r.request().url());
      if (/\/vendor\/transformers\/transformers\.web\.min\.js$/.test(u.pathname)) return r.fulfill({ contentType: 'text/javascript', body: FAKE });
      if (u.hostname === PAGES_HOST && u.pathname.startsWith('/api/hf/')) {
        hf.push({ path: u.pathname, cookie: (await r.request().allHeaders()).cookie || '' });
        return hfStatus === 'redirect'
          ? r.fulfill({ status: 302, headers: { Location: 'https://tanot.cloudflareaccess.com/cdn-cgi/access/login' } })
          : r.fulfill({ status: hfStatus, contentType: 'application/json', body: '{}' });
      }
      if (u.hostname === PAGES_HOST && u.pathname.startsWith('/api/')) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"test"}' });
      if (u.hostname === 'huggingface.co') { direct.push(u.pathname); return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); }
      if (u.hostname === PAGES_HOST || u.protocol === 'data:' || u.protocol === 'blob:') return r.continue();
      return r.abort('internetdisconnected');
    });
    await context.addCookies([{ name: 'CF_Authorization', value: 'test-jwt', url: BASE }]);
    await page.addInitScript(() => { try { localStorage.setItem('ome:theme', 'light'); localStorage.setItem('tanot:asr:lang', 'auto'); localStorage.setItem('tanot:asr:engine', 'local'); } catch (e) {} });
    return { errors, hf, direct };
  }
  const TEXT = 'ประโยคทดสอบหนึ่ง สร้างเสียงพูดภาษาไทย';

  test('สร้างไฟล์เสียง (tts-worker.js): config ของเสียง Tanotfin ขอผ่าน /api/hf/ พร้อมคุกกี้ Access · ไม่ขอ huggingface.co ตรง', async ({ context, page }) => {
    const { errors, hf, direct } = await setup(context, page);
    await page.goto(BASE + '/text-to-speech.html');
    await page.fill('#ttsText', TEXT);
    await page.click('#dlGenerateBtn');
    await expect(page.locator('#dlStatus')).toHaveClass(/ok/, { timeout: 30000 });
    expect(hf.map((h) => h.path)).toContain('/api/hf/Tanotfin/mms-thai-female-podcast-spk0-stable2-onnx/resolve/main/config.json');
    expect(hf.every((h) => /CF_Authorization=test-jwt/.test(h.cookie))).toBe(true);
    expect(direct.filter((p) => /^\/Tanotfin\//.test(p))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('ถอดเสียงในเบราว์เซอร์ (asr-worker.js): Thonburian ผ่าน /api/hf/ · Xenova โหลดตรงจาก huggingface.co', async ({ context, page }) => {
    const { errors, hf, direct } = await setup(context, page);
    await page.goto(BASE + '/text-to-speech.html');
    await page.waitForFunction(() => window.TanotMedia && window.AsrCalc);
    const run = (m) => page.evaluate((id) => TanotMedia.transcribeLocalDetailed({ pcm: new Float32Array(16000 * 2), modelId: id, lang: 'thai' }).then((r) => r.text), m);
    expect(await run('Tanotfin/distill-whisper-th-small-onnx')).toBe('ทดสอบ');
    expect(hf.map((h) => h.path)).toEqual(['/api/hf/Tanotfin/distill-whisper-th-small-onnx/resolve/main/config.json']);
    expect(await run('Xenova/whisper-tiny')).toBe('ทดสอบ');
    expect(direct).toEqual(['/Xenova/whisper-tiny/resolve/main/config.json']);
    expect(hf.length).toBe(1);
    expect(errors).toEqual([]);
  });

  test('เธรดหลัก (ไม่มี Worker) ก็ผ่าน /api/hf/ — text-to-speech.js loadTtsPipeline', async ({ context, page }) => {
    const { errors, hf } = await setup(context, page);
    await page.addInitScript(() => { delete window.Worker; });
    await page.goto(BASE + '/text-to-speech.html');
    await page.fill('#ttsText', TEXT);
    await page.click('#dlGenerateBtn');
    await expect(page.locator('#dlStatus')).toHaveClass(/ok/, { timeout: 30000 });
    expect(hf.map((h) => h.path)).toContain('/api/hf/Tanotfin/mms-thai-female-podcast-spk0-stable2-onnx/resolve/main/config.json');
    expect(errors).toEqual([]);
  });

  for (const hfStatus of [401, 403, 'redirect']) {
    test(`เซสชันหมดอายุ (/api/hf/ → ${hfStatus}): ข้อความ "เข้าสู่ระบบใหม่" + ถามครั้งเดียว · ไม่ลองซ้ำ/ไม่ถอยรุ่น · problem log code session · กดแล้วไป ?relogin=1`, async ({ context, page }) => {
      const { errors, hf } = await setup(context, page, { hfStatus });
      await page.goto(BASE + '/text-to-speech.html');
      await page.fill('#ttsText', TEXT);
      await page.click('#dlGenerateBtn');
      await expect(page.locator('#dlStatus')).toHaveClass(/err/, { timeout: 30000 });
      await expect(page.locator('#dlStatus')).toContainText('เซสชันหมดอายุ — เข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
      // stable2 → stable → ต้นฉบับ ไม่ถูกลอง (เซสชันหมดอายุ รุ่นอื่นของ Tanotfin ก็โหลดไม่ได้) · ไม่ลองซ้ำแบบเครือข่ายสะดุด
      expect(hf.map((h) => h.path)).toEqual(['/api/hf/Tanotfin/mms-thai-female-podcast-spk0-stable2-onnx/resolve/main/config.json']);
      const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));
      expect(rows.filter((r) => r.code === 'session').length).toBe(1);
      expect(rows.some((r) => r.stage === 'model-load' || r.stage === 'load-retry')).toBe(false);
      const dlg = page.locator('dialog[open]');
      await expect(dlg).toContainText('เซสชันหมดอายุ จึงโหลดโมเดลไม่ได้');
      await Promise.all([page.waitForURL(/[?&]relogin=1/), dlg.getByRole('button', { name: 'เข้าสู่ระบบใหม่' }).click()]);
      expect(new URL(page.url()).pathname).toMatch(/\/text-to-speech(\.html)?$/);
      expect(errors).toEqual([]);
    });
  }

  test('ถอดเสียง Thonburian เซสชันหมดอายุ → error ชนิด session ไม่ถอยไป Xenova', async ({ context, page }) => {
    const { errors, hf, direct } = await setup(context, page, { hfStatus: 401 });
    await page.goto(BASE + '/text-to-speech.html');
    await page.waitForFunction(() => window.TanotMedia && window.AsrCalc);
    const r = await page.evaluate(() => TanotMedia.transcribeLocalDetailed({ pcm: new Float32Array(16000 * 2), modelId: 'Tanotfin/distill-whisper-th-small-onnx', lang: 'thai' })
      .then(() => null, (e) => ({ cls: TanotMedia.classify(e), text: TanotMedia.errorText(e) })));
    expect(r).toEqual({ cls: 'session', text: 'เซสชันหมดอายุ — เข้าสู่ระบบใหม่แล้วลองอีกครั้ง' });
    expect(hf.length).toBe(1);
    expect(direct).toEqual([]); // ไม่ถอยไป Xenova/whisper-small
    expect(errors).toEqual([]);
  });
});
