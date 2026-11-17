// @ts-check
// ไลบรารี *Craft ที่เก็บใน R2 ("store": "r2" — ROADMAP แถว 11f)
// A) functions/_lib/craft.js + functions/api/craft/[[path]].js ตัวจริงใน Node กับ R2/ASSETS ตัวหลอก: อ่านได้เฉพาะคีย์ใน manifest ของไลบรารี store r2,
//    path แปลก/encoded = 404, method อื่น = 405, header (type/cache/ETag/nosniff), HEAD, brotli, R2 ยังไม่มีไฟล์ = 404 · อยู่หลัง _middleware.js
// B) craft-loader.js: store r2 → /api/craft/<ชื่อโฟลเดอร์>/<ไฟล์> (Node + Worker ในเบราว์เซอร์กับ route จำลอง) · sha256 ตรวจเหมือนเดิม
// C) sw.js: /api/craft/ cache-first ใน tanot-craft-v1 · /api/ อื่นไม่แตะ · activate เก็บ/ลบตาม manifest (URL แบบใหม่)
// D) tools/wasm/craft-r2.mjs verify: ชุดไฟล์/sha256/ขนาดต้องตรง manifest ไม่งั้นไม่อัปโหลด
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const LOADER = fs.readFileSync(path.join(ROOT, 'craft-loader.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const REAL_MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor', 'craft', 'manifest.json'), 'utf8'));

const WASM = Buffer.from('0061736d0100000001070160027f7f017f030201000707010361646400000a09010700200020016a0b', 'hex');
const GLUE = 'let fake_bindgen = (function () { async function init(o) { const r = await WebAssembly.instantiate(o.module_or_path, {}); init.add = r.instance.exports.add; } return init; })();\n';
const FONT = Buffer.from('fake-font');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const meta = (b) => ({ sha256: sha(b), bytes: b.length });
const r2Lib = (name, over) => Object.assign({
  name: 'FakeBig', dir: 'vendor/craft/' + name, store: 'r2', build: 'tools/wasm/fake/build.sh', source: 'https://github.com/example/fake',
  commit: 'b'.repeat(40), license: 'MIT', licenseFile: 'fake.js',
  files: { 'fake.wasm': meta(WASM), 'fake.js': meta(Buffer.from(GLUE)), 'fonts/a.ttf': meta(FONT) },
}, over || {});
const MAN = { v: 1, libs: Object.assign({}, REAL_MAN.libs, { big: r2Lib('big-1'), brlib: r2Lib('brlib-1', { encoding: 'br' }) }) };

/* โหลดไฟล์ ESM ของ functions/ (แบบเดียวกับ hf.spec.js): ตัด import/export ออกแล้วรันใน realm นี้ */
function loadEsm(rel, names, deps) {
  let src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const n of names) expect(src, rel + ' export ' + n).toMatch(new RegExp('export (async )?(function|const) ' + n + '\\b'));
  src = src.replace(/^import \{([^}]+)\} from '[^']+';$/gm, (m, ids) => 'const {' + ids + '} = __deps;').replace(/^export /gm, '');
  return new Function('__deps', src + '\nreturn { ' + names.join(', ') + ' };')(deps || {});
}
const LIB = () => loadEsm('functions/_lib/craft.js', ['MANIFEST_PATH', 'KEY_PREFIX', 'parseCraftPath', 'lookup', 'contentType', 'serveCraft']);
const ROUTE = () => {
  const src = fs.readFileSync(path.join(ROOT, 'functions/api/craft/[[path]].js'), 'utf8');
  expect(src).toContain("import { serveCraft } from '../../_lib/craft.js';");
  return loadEsm('functions/api/craft/[[path]].js', ['onRequest'], LIB());
};
const req = (p, init) => new Request('https://my-web-app-5w2.pages.dev' + p, init);

/* R2 ตัวหลอก: เก็บไบต์ต่อคีย์ + บันทึกทุกคีย์ที่ถูกอ่าน */
function fakeEnv(objects, man) {
  const asked = [];
  const obj = (k) => ({ size: objects[k].length, httpEtag: '"e-' + sha(objects[k]).slice(0, 8) + '"' });
  const FILES = {
    async get(k) { asked.push(['get', k]); return objects[k] ? Object.assign(obj(k), { body: new Blob([objects[k]]).stream() }) : null; },
    async head(k) { asked.push(['head', k]); return objects[k] ? obj(k) : null; },
  };
  const ASSETS = {
    async fetch(r) {
      return new URL(r.url).pathname === '/vendor/craft/manifest.json' && man !== null
        ? new Response(JSON.stringify(man || MAN), { headers: { 'Content-Type': 'application/json' } }) : new Response('nf', { status: 404 });
    },
  };
  return { env: { FILES, ASSETS }, asked };
}
const OBJ = { 'craft/big-1/fake.wasm': WASM, 'craft/big-1/fake.js': Buffer.from(GLUE), 'craft/big-1/fonts/a.ttf': FONT, 'craft/brlib-1/fake.wasm': zlib.brotliCompressSync(WASM) };

test.describe('A) /api/craft/ — Function ตัวจริงกับ R2 ตัวหลอก', () => {
  test('parseCraftPath: รับ <ชื่อ>/<ไฟล์ (มีโฟลเดอร์ย่อยได้)> · ปฏิเสธ .. / encoded / segment ว่าง / อักขระนอกชุด', () => {
    const { parseCraftPath } = LIB();
    expect(parseCraftPath('/api/craft/big-1/fake.wasm')).toEqual({ name: 'big-1', file: 'fake.wasm' });
    expect(parseCraftPath('/api/craft/big-1/fonts/a.ttf')).toEqual({ name: 'big-1', file: 'fonts/a.ttf' });
    for (const bad of ['/api/craft/big-1', '/api/craft/', '/api/craft/../x', '/api/craft/big-1/../../files/u1', '/api/craft/big-1/%2e%2e/x',
      '/api/craft/big-1/a%2Fb', '/api/craft/big-1//a', '/api/craft/big-1/./a', '/api/craft/../big-1/a', '/api/craft/big 1/a', '/api/crafts/big-1/a']) {
      expect(parseCraftPath(bad), bad).toBeNull();
    }
  });

  test('GET ไฟล์ใน manifest ของ store r2 → 200 + type/cache/ETag/nosniff/Content-Length + ไบต์ตรง · คีย์ที่อ่าน = craft/<ชื่อ>/<ไฟล์>', async () => {
    const { onRequest } = ROUTE();
    const { env, asked } = fakeEnv(OBJ);
    const cases = [['fake.wasm', 'application/wasm', WASM], ['fake.js', 'text/javascript; charset=utf-8', Buffer.from(GLUE)], ['fonts/a.ttf', 'font/ttf', FONT]];
    for (const [f, type, body] of cases) {
      const res = await onRequest({ request: req('/api/craft/big-1/' + f), env });
      expect(res.status, f).toBe(200);
      expect(res.headers.get('Content-Type')).toBe(type);
      expect(res.headers.get('Cache-Control')).toBe('private, max-age=31536000, immutable');
      expect(res.headers.get('ETag')).toMatch(/^"e-[0-9a-f]{8}"$/);
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('Content-Length')).toBe(String(body.length));
      expect(res.headers.get('Content-Encoding')).toBeNull();
      expect(Buffer.from(await res.arrayBuffer()).equals(body)).toBe(true);
    }
    expect(asked.map((a) => a[1])).toEqual(['craft/big-1/fake.wasm', 'craft/big-1/fake.js', 'craft/big-1/fonts/a.ttf']);
  });

  test('HEAD = ไม่มี body + Content-Length · method อื่น = 405 (Allow) โดยไม่แตะ R2', async () => {
    const { serveCraft } = LIB();
    const { env, asked } = fakeEnv(OBJ);
    const h = await serveCraft(req('/api/craft/big-1/fake.wasm', { method: 'HEAD' }), env);
    expect(h.status).toBe(200);
    expect(h.headers.get('Content-Length')).toBe(String(WASM.length));
    expect(await h.text()).toBe('');
    for (const m of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
      const r = await serveCraft(req('/api/craft/big-1/fake.wasm', { method: m }), env);
      expect(r.status, m).toBe(405);
      expect(r.headers.get('Allow')).toBe('GET, HEAD');
    }
    expect(asked).toEqual([['head', 'craft/big-1/fake.wasm']]);
  });

  test('404 โดยไม่อ่าน R2: ไฟล์ไม่อยู่ใน manifest / ไลบรารีไม่ใช่ store r2 / ชื่อโฟลเดอร์ไม่ตรง / path แปลก · คีย์ของผู้ใช้อ่านไม่ได้', async () => {
    const { serveCraft } = LIB();
    const objs = Object.assign({ 'craft/big-1/secret.wasm': WASM, 'insurance/u1': Buffer.from('user file') }, OBJ);
    const { env, asked } = fakeEnv(objs);
    const gc = REAL_MAN.libs.gridcraft;
    for (const p of ['/api/craft/big-1/secret.wasm', '/api/craft/big-1/FAKE.wasm', '/api/craft/' + gc.dir.replace('vendor/craft/', '') + '/' + Object.keys(gc.files)[0],
      '/api/craft/big-2/fake.wasm', '/api/craft/insurance/u1', '/api/craft/big-1/%2e%2e/%2e%2e/insurance/u1', '/api/craft/big-1/..%2Finsurance', '/api/craft/big-1/fonts']) {
      const r = await serveCraft(req(p), env);
      expect(r.status, p).toBe(404);
    }
    // URL ที่มี /../ ถูก URL parser ทำให้เป็น path ปกติก่อน (ไม่ใช่ /api/craft/ แล้ว) → 404 เหมือนกัน
    expect((await serveCraft(req('/api/craft/big-1/../../files?id=1'), env)).status).toBe(404);
    expect(asked).toEqual([]);
  });

  test('ยังไม่ได้อัปโหลด = 404 · ไม่มี binding FILES = 503 · อ่าน manifest ไม่ได้ = 503 · R2 ล้ม = 502', async () => {
    const { serveCraft } = LIB();
    expect((await serveCraft(req('/api/craft/big-1/fake.wasm'), fakeEnv({}).env)).status).toBe(404);
    expect((await serveCraft(req('/api/craft/big-1/fake.wasm'), { ASSETS: fakeEnv({}).env.ASSETS })).status).toBe(503);
    expect((await serveCraft(req('/api/craft/big-1/fake.wasm'), fakeEnv(OBJ, null).env)).status).toBe(503);
    const env = fakeEnv(OBJ).env;
    env.FILES.get = async () => { throw new Error('boom'); };
    const r = await serveCraft(req('/api/craft/big-1/fake.wasm'), env);
    expect(r.status).toBe(502);
    expect(await r.text()).not.toContain('boom');
  });

  test('encoding br: object เป็น brotli → Content-Encoding br + encodeBody manual + Vary · ไม่รับ br = 406', async () => {
    const { serveCraft } = LIB();
    const { env } = fakeEnv(OBJ);
    const seen = [];
    const Orig = globalThis.Response;
    globalThis.Response = class extends Orig { constructor(b, init) { super(b, init); seen.push(init); } };
    try {
      const r = await serveCraft(req('/api/craft/brlib-1/fake.wasm', { headers: { 'Accept-Encoding': 'gzip, deflate, br' } }), env);
      expect(r.status).toBe(200);
      expect(r.headers.get('Content-Encoding')).toBe('br');
      expect(r.headers.get('Vary')).toBe('Accept-Encoding');
      expect(seen[seen.length - 1].encodeBody).toBe('manual');
      expect(zlib.brotliDecompressSync(Buffer.from(await r.arrayBuffer())).equals(WASM)).toBe(true);
      const plain = await serveCraft(req('/api/craft/big-1/fake.wasm', { headers: { 'Accept-Encoding': 'br' } }), env);
      expect(seen[seen.length - 1].encodeBody).toBeUndefined();
      expect(plain.headers.get('Content-Encoding')).toBeNull();
    } finally { globalThis.Response = Orig; }
    expect((await serveCraft(req('/api/craft/brlib-1/fake.wasm', { headers: { 'Accept-Encoding': 'gzip' } }), env)).status).toBe(406);
  });

  test('อยู่หลัง Access: route อยู่ใต้ functions/api/ (ขอบเขต _middleware.js) และ middleware ปฏิเสธ /api/craft/ ที่ไม่มี JWT', async () => {
    expect(fs.existsSync(path.join(ROOT, 'functions/api/_middleware.js'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'functions/api/craft/[[path]].js'))).toBe(true);
    const { onRequest } = loadEsm('functions/api/_middleware.js', ['onRequest']);
    let next = 0;
    const ctx = (headers) => ({ request: req('/api/craft/big-1/fake.wasm', { headers }), env: { ACCESS_AUD: 'a', TEAM_DOMAIN: 't.example', OWNER_EMAIL: 'o@example.com' }, data: {}, next: async () => { next++; return new Response('x'); } });
    expect((await onRequest(ctx({}))).status).toBe(401);
    expect((await onRequest(ctx({ Cookie: 'CF_Authorization=not.a.jwt' }))).status).toBe(403);
    expect(next).toBe(0);
  });
});

/* ── B) craft-loader.js ── */
function loadLoader(routes) {
  const calls = [];
  const fetch = async (u) => {
    const p = new URL(u).pathname;
    calls.push(p);
    const r = routes[p];
    if (!r) return { ok: false, status: 404, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) };
    const buf = Buffer.isBuffer(r) ? r : Buffer.from(typeof r === 'string' ? r : JSON.stringify(r));
    return { ok: true, status: 200, json: async () => JSON.parse(buf.toString()), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) };
  };
  const G = { fetch, crypto: globalThis.crypto, WebAssembly, URL, Promise, Uint8Array, location: { href: 'https://x.pages.dev/solid-pro.html' } };
  G.self = G;
  vm.runInContext(LOADER, vm.createContext(G));
  return { C: G.TanotCraft, calls };
}

test.describe('B) craft-loader.js — store r2', () => {
  test('url/fetchFile → /api/craft/<ชื่อโฟลเดอร์>/<ไฟล์> · ไลบรารีเดิมยังเป็น vendor/craft/ · sha256 ไม่ตรง = integrity · ไม่มีใน R2 = missing', async () => {
    const { C, calls } = loadLoader({ '/vendor/craft/manifest.json': MAN, '/api/craft/big-1/fake.wasm': WASM, '/api/craft/big-1/fonts/a.ttf': Buffer.from('x') });
    expect(await C.url('big', 'fake.wasm')).toBe('https://x.pages.dev/api/craft/big-1/fake.wasm');
    expect(await C.url('big', 'fonts/a.ttf')).toBe('https://x.pages.dev/api/craft/big-1/fonts/a.ttf');
    expect(await C.url('gridcraft', 'gridcraft_recalc.js')).toBe('https://x.pages.dev/' + REAL_MAN.libs.gridcraft.dir + '/gridcraft_recalc.js');
    const r = await C.instantiate('big', 'fake.wasm');
    expect(r.instance.exports.add(2, 3)).toBe(5);
    expect(calls).not.toContain('/vendor/craft/big-1/fake.wasm');
    await expect(C.fetchFile('big', 'fonts/a.ttf')).rejects.toMatchObject({ craft: true, code: 'integrity', file: 'fonts/a.ttf' });
    await expect(C.fetchFile('big', 'fake.js')).rejects.toMatchObject({ craft: true, code: 'missing' });
  });
});

const WORKER = `importScripts('craft-loader.js');
self.onmessage = function () {
  TanotCraft.bindgen('big', 'fake.js', 'fake.wasm', 'fake_bindgen').then(function (ns) { postMessage({ ok: true, v: ns.add(20, 22) }); },
    function (e) { postMessage({ ok: false, m: TanotCraft.toMessage(e) }); });
};`;
async function setup(page, opt) {
  opt = opt || {};
  const hits = [];
  await page.route('**/vendor/craft/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(MAN) }));
  await page.route('**/vendor/craft/big-1/**', (r) => { hits.push(r.request().url()); return r.fulfill({ status: 404, body: '' }); });
  await page.route('**/api/craft/big-1/**', (r) => {
    const u = new URL(r.request().url());
    hits.push(u.pathname);
    if (u.pathname.endsWith('/fake.js')) return r.fulfill({ contentType: 'text/javascript', body: GLUE });
    if (opt.wasm === 404) return r.fulfill({ status: 404, body: 'Not uploaded to R2 yet' });
    return r.fulfill({ contentType: 'application/wasm', body: opt.wasm || WASM });
  });
  await page.route('**/__craft-r2-worker.js', (r) => r.fulfill({ contentType: 'text/javascript', body: WORKER }));
  await page.goto('/credits.html');
  await page.waitForFunction(() => window.TanotMedia && window.OME_LANG);
  await page.addScriptTag({ url: '/craft-loader.js' });
  const out = await page.evaluate(() => new Promise((ok) => {
    const w = new Worker('__craft-r2-worker.js');
    w.onmessage = (e) => { w.terminate(); ok(e.data); };
    w.onerror = (e) => ok({ ok: false, m: { message: 'onerror ' + e.message } });
    w.postMessage(1);
  }));
  return { out, hits };
}

test.describe('B) craft-loader.js ในเบราว์เซอร์ (Worker) — ไลบรารีจำลอง store r2 ผ่าน route', () => {
  test('bindgen โหลด glue + wasm จาก /api/craft/ (ไม่แตะ vendor/craft/) แล้วใช้ได้', async ({ page }) => {
    const { out, hits } = await setup(page);
    expect(out).toEqual({ ok: true, v: 42 });
    expect(hits.sort()).toEqual(['/api/craft/big-1/fake.js', '/api/craft/big-1/fake.wasm']);
  });

  test('ยังไม่อัปโหลด (404) → missing + ข้อความ th/en + problem log ชื่อไลบรารีของเรา · sha256 ไม่ตรง → integrity', async ({ page }) => {
    const { out } = await setup(page, { wasm: 404 });
    expect(out.m).toMatchObject({ craft: true, code: 'missing', lib: 'big', file: 'fake.wasm' });
    const msg = await page.evaluate((m) => { const e = TanotCraft.fromMessage(m); TanotCraft.report(e); return { th: TanotCraft.message(e), en: TanotCraft.message(e, 'en') }; }, out.m);
    expect(msg.th).toBe('ไม่พบไฟล์ของเครื่องมือนี้บนเซิร์ฟเวอร์ — โหลดหน้าใหม่แล้วลองอีกครั้ง');
    expect(msg.en).toBe('This tool’s files were not found on the server — reload the page and try again');
    const log = JSON.parse(await page.evaluate(() => localStorage.getItem('tanot:media:log') || '[]'));
    expect(log[0]).toMatchObject({ kind: 'craft', stage: 'missing', model: 'big/fake.wasm' });
  });

  test('sha256 ไม่ตรง → integrity', async ({ page }) => {
    const { out } = await setup(page, { wasm: Buffer.concat([WASM, Buffer.from([1])]) });
    expect(out.m).toMatchObject({ craft: true, code: 'integrity', lib: 'big', file: 'fake.wasm' });
  });
});

/* ── C) sw.js ── */
const SCOPE = 'https://x.pages.dev/';
function fakeCaches(init) {
  const store = new Map();
  const open = (name) => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name);
    const key = (r) => (typeof r === 'string' ? r : r.url);
    return { put: async (r, res) => { m.set(key(r), res); }, match: async (r) => m.get(key(r)), keys: async () => [...m.keys()].map((url) => ({ url })), delete: async (r) => m.delete(key(r)) };
  };
  for (const [name, entries] of Object.entries(init || {})) { const c = open(name); for (const [k, v] of entries) c.put(k, v); }
  return { store, api: { keys: async () => [...store.keys()], open: async (n) => open(n), delete: async (n) => store.delete(n), match: async () => undefined } };
}
const res = (body, extra) => Object.assign({ ok: true, type: 'basic', status: 200, body, clone() { return this; }, json: async () => JSON.parse(body) }, extra || {});
function loadSw(cachesApi, net) {
  const listeners = {};
  const fetched = [];
  const self = { addEventListener: (t, f) => { listeners[t] = f; }, registration: { scope: SCOPE }, clients: { claim: async () => {}, matchAll: async () => [] }, skipWaiting: async () => {} };
  const fetch = async (r) => { fetched.push(r.url || r); return net(r); };
  vm.runInContext(SW, vm.createContext({ self, location: new URL(SCOPE + 'sw.js'), URL, Promise, console, caches: cachesApi, fetch }));
  return {
    fetched,
    activate: async () => { const w = []; listeners.activate({ waitUntil: (p) => w.push(p) }); await Promise.all(w); },
    get: async (url, opt) => {
      let out = null; const w = [];
      listeners.fetch({ request: Object.assign({ url, method: 'GET', mode: 'cors', cache: 'default' }, opt || {}), respondWith: (p) => { out = p; }, waitUntil: (p) => w.push(p) });
      const r = out && await out; await Promise.all(w); return r;
    },
  };
}

test.describe('C) sw.js — /api/craft/ ในแคชแยก', () => {
  const CUR = SW.match(/const CACHE = '([^']+)'/)[1];
  const CRAFT = SW.match(/const CRAFT_CACHE = '([^']+)'/)[1];

  test('fetch: /api/craft/ cache-first ใน tanot-craft-v1 · 404/redirect ไม่ถูกแคช · /api/ อื่นไม่ถูกแตะ', async () => {
    const fc = fakeCaches();
    let n = 0;
    const sw = loadSw(fc.api, () => res('net' + (++n)));
    const u = SCOPE + 'api/craft/big-1/fake.wasm';
    expect((await sw.get(u)).body).toBe('net1');
    expect((await sw.get(u)).body).toBe('net1');
    expect(sw.fetched).toHaveLength(1);
    expect(fc.store.get(CRAFT).get(u).body).toBe('net1');
    expect(fc.store.has(CUR)).toBe(false);
    expect((await sw.get(u, { cache: 'reload' })).body).toBe('net2');
    const sw2 = loadSw(fc.api, () => res('x', { ok: false, status: 404 }));
    await sw2.get(SCOPE + 'api/craft/big-1/nope.wasm');
    const sw3 = loadSw(fc.api, () => res('', { ok: false, status: 0, type: 'opaqueredirect' }));
    await sw3.get(SCOPE + 'api/craft/big-1/fake.js');
    expect([...fc.store.get(CRAFT).keys()]).toEqual([u]);
    for (const p of ['api/files?id=1', 'api/hf/Tanotfin/x/resolve/main/a.onnx', 'api/crafty/x', 'api/sync']) expect(await sw.get(SCOPE + p), p).toBeNull();
  });

  test('activate: เก็บ /api/craft/ ของไลบรารี store r2 ใน manifest · ลบรุ่นที่ไม่อยู่แล้ว · ไลบรารีเดิมยังเป็น vendor/craft/', async () => {
    const gc = REAL_MAN.libs.gridcraft;
    const keep = [SCOPE + 'api/craft/big-1/fake.wasm', SCOPE + 'api/craft/big-1/fonts/a.ttf', SCOPE + gc.dir + '/gridcraft_recalc.js'];
    const fc = fakeCaches({
      [CUR]: [[SCOPE + 'vendor/craft/manifest.json', res(JSON.stringify(MAN))]],
      [CRAFT]: keep.concat([SCOPE + 'api/craft/big-0/fake.wasm', SCOPE + 'vendor/craft/big-1/fake.wasm', SCOPE + 'api/craft/big-1/old.wasm']).map((k) => [k, 'x']),
    });
    await loadSw(fc.api).activate();
    expect([...fc.store.get(CRAFT).keys()].sort()).toEqual(keep.sort());
  });
});

/* ── D) tools/wasm/craft-r2.mjs ── */
test.describe('D) tools/wasm/craft-r2.mjs verify', () => {
  test('ตรงทุกไฟล์ = ผ่าน · ขาด/เกิน/sha256/ขนาดไม่ตรง/ไม่ใช่ store r2/ชื่อแปลก = รายการปัญหา (ไม่อัปโหลด)', async () => {
    const { verify } = await import(path.join(ROOT, 'tools/wasm/craft-r2.mjs'));
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-r2-'));
    try {
      const dir = path.join(root, 'vendor/craft/big-1');
      fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'fake.wasm'), WASM);
      fs.writeFileSync(path.join(dir, 'fake.js'), GLUE);
      fs.writeFileSync(path.join(dir, 'fonts/a.ttf'), FONT);
      const ok = verify('big', root, MAN);
      expect(ok.bad).toEqual([]);
      expect(ok.files.map((f) => f.file)).toEqual(['fake.js', 'fake.wasm', 'fonts/a.ttf']);
      fs.writeFileSync(path.join(dir, 'fonts/a.ttf'), 'diff');
      fs.writeFileSync(path.join(dir, 'extra.txt'), 'x');
      fs.rmSync(path.join(dir, 'fake.js'));
      const bad = verify('big', root, MAN).bad.join('\n');
      expect(bad).toContain('ไม่มี fake.js');
      expect(bad).toContain('extra.txt');
      expect(bad).toContain('fonts/a.ttf sha256');
      expect(bad).toContain('fonts/a.ttf ขนาด');
      expect(verify('gridcraft', root, MAN).bad[0]).toContain('store');
      expect(verify('../x', root, MAN).bad.length).toBe(1);
      expect(verify('nope', root, MAN).bad[0]).toContain('ไม่มี');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
