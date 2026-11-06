// @ts-check
// ไลบรารี wasm ตระกูล *Craft (vendor/craft/): ตัวโหลดกลาง craft-loader.js + แคชแยก tanot-craft-v1 ใน sw.js
// wasm ตัวหลอกสร้างในเทสต์ (add(a,b) ~40 ไบต์) — ไม่ commit ไบนารี · GridCraft ตัวจริงตรวจใน compare.spec.js
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const LOADER = fs.readFileSync(path.join(ROOT, 'craft-loader.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const REAL_MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor', 'craft', 'manifest.json'), 'utf8'));

// (module (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add))
const WASM = Buffer.from('0061736d0100000001070160027f7f017f030201000707010361646400000a09010700200020016a0b', 'hex');
const GLUE = 'let fake_bindgen = (function () { async function init(o) { const r = await WebAssembly.instantiate(o.module_or_path, {}); init.add = r.instance.exports.add; } return init; })();\n';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const fakeMan = (over) => ({
  v: 1,
  libs: {
    fake: {
      name: 'FakeCraft', dir: 'vendor/craft/fake-1', source: 'https://github.com/example/fake', commit: 'a'.repeat(40), license: 'MIT', licenseFile: 'LICENSE',
      files: Object.assign({ 'fake.wasm': { sha256: sha(WASM), bytes: WASM.length }, 'fake.js': { sha256: sha(GLUE), bytes: GLUE.length } }, over || {}),
    },
  },
});

/* craft-loader.js ใน sandbox ของ Node: fetch ตัวหลอก (ตอบตาม path) — บันทึกทุกคำขอ */
function loadLoader(routes, extra) {
  const calls = [];
  const fetch = async (u, opt) => {
    const p = new URL(u).pathname;
    calls.push({ p, cache: (opt && opt.cache) || '' });
    let r = routes[p];
    if (typeof r === 'function') r = r(calls.filter((c) => c.p === p).length);
    if (r === 'throw') throw new TypeError('Failed to fetch');
    if (!r) return { ok: false, status: 404, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) };
    if (typeof r.status === 'number') return { ok: r.status < 400, status: r.status, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) };
    const buf = Buffer.isBuffer(r) ? r : Buffer.from(typeof r === 'string' ? r : JSON.stringify(r));
    return { ok: true, status: 200, json: async () => JSON.parse(buf.toString()), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) };
  };
  const G = Object.assign({ fetch, crypto: globalThis.crypto, WebAssembly, URL, Promise, Uint8Array, location: { href: 'https://x.pages.dev/compare.html' } }, extra || {});
  G.self = G;
  vm.runInContext(LOADER, vm.createContext(G));
  return { C: G.TanotCraft, calls };
}

test.describe('craft-loader.js (Node sandbox)', () => {
  test('โหลดสำเร็จ: manifest → path = dir/file → sha256 ตรง → instantiate ใช้ได้ · manifest โหลดครั้งเดียว', async () => {
    const { C, calls } = loadLoader({ '/vendor/craft/manifest.json': fakeMan(), '/vendor/craft/fake-1/fake.wasm': WASM });
    const r = await C.instantiate('fake', 'fake.wasm');
    expect(r.instance.exports.add(2, 3)).toBe(5);
    expect(await C.url('fake', 'fake.wasm')).toBe('https://x.pages.dev/vendor/craft/fake-1/fake.wasm');
    await C.fetchFile('fake', 'fake.wasm');
    expect(calls.filter((c) => c.p === '/vendor/craft/manifest.json')).toHaveLength(1);
    expect(calls.filter((c) => c.p.endsWith('fake.wasm')).map((c) => c.cache)).toEqual(['', '']);
  });

  test('sha256 ไม่ตรง → ขอใหม่ด้วย cache:reload 1 ครั้ง · ครั้งที่สองถูก = ผ่าน · ยังไม่ตรง = integrity', async () => {
    const bad = Buffer.concat([WASM, Buffer.from([0])]);
    const a = loadLoader({ '/vendor/craft/manifest.json': fakeMan(), '/vendor/craft/fake-1/fake.wasm': (n) => (n === 1 ? bad : WASM) });
    expect((await a.C.instantiate('fake', 'fake.wasm')).instance.exports.add(1, 1)).toBe(2);
    expect(a.calls.filter((c) => c.p.endsWith('fake.wasm')).map((c) => c.cache)).toEqual(['', 'reload']);

    const b = loadLoader({ '/vendor/craft/manifest.json': fakeMan(), '/vendor/craft/fake-1/fake.wasm': bad });
    const err = await b.C.fetchFile('fake', 'fake.wasm').catch((e) => e);
    expect(err).toMatchObject({ craft: true, code: 'integrity', lib: 'fake', file: 'fake.wasm', name: 'CraftError' });
    expect(b.calls.filter((c) => c.p.endsWith('fake.wasm'))).toHaveLength(2);
  });

  test('404 = missing (ไม่ลองซ้ำ) · ไม่อยู่ใน manifest = missing ไม่ fetch · เครือข่ายล้ม = network · manifest ล้มแล้วครั้งหน้าลองใหม่', async () => {
    const a = loadLoader({ '/vendor/craft/manifest.json': fakeMan() });
    expect(await a.C.fetchFile('fake', 'fake.wasm').catch((e) => e)).toMatchObject({ code: 'missing', file: 'fake.wasm' });
    expect(a.calls.filter((c) => c.p.endsWith('fake.wasm'))).toHaveLength(1);
    expect(await a.C.fetchFile('fake', 'other.wasm').catch((e) => e)).toMatchObject({ code: 'missing', file: 'other.wasm' });
    expect(await a.C.fetchFile('nope', 'fake.wasm').catch((e) => e)).toMatchObject({ code: 'missing', lib: 'nope' });
    expect(await a.C.fetchFile('__proto__', 'x').catch((e) => e)).toMatchObject({ code: 'missing' });
    expect(a.calls.some((c) => /other|nope|proto/.test(c.p))).toBe(false);

    const b = loadLoader({ '/vendor/craft/manifest.json': fakeMan(), '/vendor/craft/fake-1/fake.wasm': 'throw' });
    expect(await b.C.fetchFile('fake', 'fake.wasm').catch((e) => e)).toMatchObject({ code: 'network' });
    const c = loadLoader({ '/vendor/craft/manifest.json': { status: 503 }, '/vendor/craft/fake-1/fake.wasm': WASM });
    expect(await c.C.fetchFile('fake', 'fake.wasm').catch((e) => e)).toMatchObject({ code: 'network', lib: 'manifest' });
    const d = loadLoader({ '/vendor/craft/manifest.json': (n) => (n === 1 ? 'throw' : fakeMan()), '/vendor/craft/fake-1/fake.wasm': WASM });
    expect(await d.C.fetchFile('fake', 'fake.wasm').catch((e) => e)).toMatchObject({ code: 'network' });
    expect((await d.C.fetchFile('fake', 'fake.wasm')).byteLength).toBe(WASM.length);
  });

  test('ไม่มี WebAssembly / crypto.subtle = unsupported · bindgen นอก Worker = unsupported · wasm พัง = init', async () => {
    const routes = { '/vendor/craft/manifest.json': fakeMan({ 'junk.wasm': { sha256: sha(Buffer.from('junk')), bytes: 4 } }), '/vendor/craft/fake-1/fake.wasm': WASM, '/vendor/craft/fake-1/junk.wasm': Buffer.from('junk') };
    expect(await loadLoader(routes, { WebAssembly: undefined }).C.instantiate('fake', 'fake.wasm').catch((e) => e)).toMatchObject({ code: 'unsupported' });
    expect(await loadLoader(routes, { crypto: {} }).C.fetchFile('fake', 'fake.wasm').catch((e) => e)).toMatchObject({ code: 'unsupported' });
    expect(await loadLoader(routes).C.bindgen('fake', 'fake.js', 'fake.wasm').catch((e) => e)).toMatchObject({ code: 'unsupported' });
    expect(await loadLoader(routes).C.instantiate('fake', 'junk.wasm').catch((e) => e)).toMatchObject({ code: 'init', file: 'junk.wasm' });
  });

  test('ข้อความผู้ใช้ th/en ทุกรหัส · toMessage/fromMessage ข้าม postMessage · report → problem log ชื่อไลบรารีของเราเท่านั้น', async () => {
    const rows = [];
    const { C } = loadLoader({}, { TanotMedia: { logError: (kind, err, ctx) => { rows.push({ kind, msg: err.message, ctx }); return rows[rows.length - 1]; } } });
    for (const code of ['missing', 'integrity', 'network', 'unsupported', 'init']) {
      const e = C.CraftError(code, 'fake', 'fake.wasm');
      expect(C.message(e, 'th')).toMatch(/[ก-๙]/);
      expect(C.message(e, 'en')).toMatch(/^[\x20-\x7e’—]+$/);
      expect(C.fromMessage(C.toMessage(e))).toMatchObject({ craft: true, code, lib: 'fake', file: 'fake.wasm' });
    }
    expect(C.message(new Error('x'), 'en')).toBe(C.message(C.CraftError('init'), 'en'));
    C.report(C.CraftError('missing', 'fake', 'fake.wasm'), { stage: 'load' });
    C.report(new Error('boom'), { lib: 'fake' });
    expect(rows).toEqual([
      { kind: 'craft', msg: 'craft:missing fake/fake.wasm', ctx: { stage: 'load', engine: 'local', model: 'fake/fake.wasm' } },
      { kind: 'craft', msg: 'craft:init fake — boom', ctx: { stage: 'init', engine: 'local', model: 'fake' } },
    ]);
  });
});

/* ── sw.js ใน vm (แบบ push.spec.js) + Cache Storage ตัวหลอก ── */
const SCOPE = 'https://my-web-app-5w2.pages.dev/';
function fakeCaches(init) {
  const store = new Map();
  const open = (name) => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name);
    const key = (r) => (typeof r === 'string' ? r : r.url);
    return {
      add: async (u) => { m.set(new URL(u, SCOPE).href, 'pre'); },
      put: async (r, res) => { m.set(key(r), res); },
      match: async (r) => m.get(key(r)),
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (r) => m.delete(key(r)),
    };
  };
  for (const [name, entries] of Object.entries(init || {})) { const c = open(name); for (const [k, v] of entries) c.put(k, v); }
  return {
    store,
    api: {
      keys: async () => [...store.keys()],
      open: async (n) => open(n),
      delete: async (n) => store.delete(n),
      match: async (r) => { for (const m of store.values()) { const v = m.get(typeof r === 'string' ? r : r.url); if (v) return v; } return undefined; },
    },
  };
}
const res = (body, extra) => Object.assign({ ok: true, type: 'basic', status: 200, body, clone() { return this; }, json: async () => JSON.parse(body) }, extra || {});
function loadSw(cachesApi, net) {
  const listeners = {};
  const fetched = [];
  const self = { addEventListener: (t, f) => { listeners[t] = f; }, registration: { scope: SCOPE }, clients: { claim: async () => {}, matchAll: async () => [] }, skipWaiting: async () => {} };
  const fetch = async (req) => { fetched.push(req.url || req); if (!net) throw new Error('offline'); return net(req); };
  const ctx = vm.createContext({ self, location: new URL(SCOPE + 'sw.js'), URL, Promise, console, caches: cachesApi, fetch });
  vm.runInContext(SW, ctx);
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

test.describe('sw.js — แคชแยกของ vendor/craft', () => {
  const CUR = SW.match(/const CACHE = '([^']+)'/)[1];
  const CRAFT = SW.match(/const CRAFT_CACHE = '([^']+)'/)[1];
  const gc = REAL_MAN.libs.gridcraft;
  const gcUrl = (f) => SCOPE + gc.dir + '/' + f;

  test('PRECACHE มี craft-loader.js + manifest.json แต่ไม่มีไฟล์ของไลบรารี', () => {
    const block = SW.match(/const PRECACHE = \[([\s\S]*?)\n\];/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
    expect(block).toContain("'./craft-loader.js'");
    expect(block).toMatch(/\bCRAFT_MANIFEST,/);
    expect(SW).toContain("const CRAFT_MANIFEST = './vendor/craft/manifest.json'");
    expect(block).not.toMatch(/vendor\/craft\/[a-z0-9-]+\//);
    expect(block).not.toContain('gridcraft');
  });

  test('activate ด้วย CACHE ใหม่: แคชแยกอยู่รอด · ลบเฉพาะไฟล์ที่ manifest ไม่มีแล้ว (รุ่นเก่า)', async () => {
    const man = JSON.stringify(REAL_MAN);
    const fc = fakeCaches({
      'ome-v1': [[gcUrl('gridcraft_recalc_bg.wasm'), 'old-main']],
      [CUR]: [[SCOPE + 'vendor/craft/manifest.json', res(man)]],
      [CRAFT]: [[gcUrl('gridcraft_recalc_bg.wasm'), 'w'], [gcUrl('gridcraft_recalc.js'), 'j'], [SCOPE + 'vendor/craft/gridcraft-0000000/gridcraft_recalc_bg.wasm', 'old']],
    });
    await loadSw(fc.api).activate();
    expect([...fc.store.keys()].sort()).toEqual([CUR, CRAFT].sort());
    expect([...fc.store.get(CRAFT).keys()].sort()).toEqual([gcUrl('gridcraft_recalc.js'), gcUrl('gridcraft_recalc_bg.wasm')]);
  });

  test('activate: อ่าน manifest ไม่ได้ = ไม่ลบอะไรในแคชแยก', async () => {
    const fc = fakeCaches({ [CRAFT]: [[SCOPE + 'vendor/craft/x-1/x.wasm', 'x']] });
    await loadSw(fc.api).activate();
    expect(fc.store.get(CRAFT).size).toBe(1);
  });

  test('fetch: ไฟล์ไลบรารี cache-first ใน tanot-craft-v1 (ไม่ลงแคชหลัก) · cache:reload ไปเครือข่ายแล้วเขียนทับ · manifest ใช้แคชหลัก', async () => {
    const fc = fakeCaches();
    let n = 0;
    const sw = loadSw(fc.api, () => res('net' + (++n)));
    const u = gcUrl('gridcraft_recalc_bg.wasm');
    expect((await sw.get(u)).body).toBe('net1');
    expect(fc.store.get(CRAFT).get(u).body).toBe('net1');
    expect(fc.store.has(CUR)).toBe(false);
    expect((await sw.get(u)).body).toBe('net1'); // แคช ไม่ไปเครือข่าย
    expect(sw.fetched).toHaveLength(1);
    expect((await sw.get(u, { cache: 'reload' })).body).toBe('net2');
    expect(fc.store.get(CRAFT).get(u).body).toBe('net2');
    // 404/ไม่ใช่ basic ไม่ถูกแคช
    const sw2 = loadSw(fc.api, () => res('x', { ok: false, status: 404 }));
    await sw2.get(SCOPE + 'vendor/craft/x-1/missing.wasm');
    expect(fc.store.get(CRAFT).has(SCOPE + 'vendor/craft/x-1/missing.wasm')).toBe(false);
    // manifest.json → ทาง cache-first ปกติ (แคชหลัก)
    await sw.get(SCOPE + 'vendor/craft/manifest.json');
    expect(fc.store.get(CRAFT).has(SCOPE + 'vendor/craft/manifest.json')).toBe(false);
  });
});

/* ── เบราว์เซอร์จริง: Worker ใช้ bindgen + หน้าเว็บรายงาน problem log ── */
const WORKER = `importScripts('craft-loader.js');
self.onmessage = function () {
  TanotCraft.bindgen('fake', 'fake.js', 'fake.wasm', 'fake_bindgen').then(function (ns) { postMessage({ ok: true, v: ns.add(20, 22) }); },
    function (e) { postMessage({ ok: false, m: TanotCraft.toMessage(e) }); });
};`;
async function setup(page, opt) {
  opt = opt || {};
  await page.route('**/vendor/craft/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(fakeMan()) }));
  await page.route('**/vendor/craft/fake-1/fake.js', (r) => r.fulfill({ contentType: 'text/javascript', body: GLUE }));
  await page.route('**/vendor/craft/fake-1/fake.wasm', (r) => (opt.wasm === 404 ? r.fulfill({ status: 404, body: 'nope' }) : r.fulfill({ contentType: 'application/wasm', body: opt.wasm || WASM })));
  await page.route('**/__craft-worker.js', (r) => r.fulfill({ contentType: 'text/javascript', body: WORKER }));
  await page.goto('/credits.html');
  await page.waitForFunction(() => window.TanotMedia && window.OME_LANG);
  await page.addScriptTag({ url: '/craft-loader.js' });
  return page.evaluate(() => new Promise((ok) => {
    const w = new Worker('__craft-worker.js');
    w.onmessage = (e) => { w.terminate(); ok(e.data); };
    w.onerror = (e) => ok({ ok: false, m: { message: 'onerror ' + e.message } });
    w.postMessage(1);
  }));
}

test.describe('craft-loader.js ในเบราว์เซอร์ (Worker)', () => {
  test('bindgen: glue + wasm ผ่าน sha256 → namespace ใช้ได้ใน Worker', async ({ page }) => {
    expect(await setup(page)).toEqual({ ok: true, v: 42 });
  });

  test('sha256 ไม่ตรง → integrity + ข้อความ th/en + problem log (ไม่มีชื่อไฟล์ผู้ใช้)', async ({ page }) => {
    const r = await setup(page, { wasm: Buffer.concat([WASM, Buffer.from([1])]) });
    expect(r.ok).toBe(false);
    expect(r.m).toMatchObject({ craft: true, code: 'integrity', lib: 'fake', file: 'fake.wasm' });
    const out = await page.evaluate((m) => { const e = TanotCraft.fromMessage(m); TanotCraft.report(e); return { th: TanotCraft.message(e), en: TanotCraft.message(e, 'en') }; }, r.m);
    expect(out.th).toBe('ไฟล์ของเครื่องมือนี้เสียหายหรือไม่ครบ — โหลดหน้าใหม่แล้วลองอีกครั้ง');
    expect(out.en).toBe('This tool’s files are damaged or incomplete — reload the page and try again');
    const log = JSON.parse(await page.evaluate(() => localStorage.getItem('tanot:media:log') || '[]'));
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ kind: 'craft', stage: 'integrity', model: 'fake/fake.wasm' });
  });

  test('404 → missing + problem log · ภาษาอังกฤษตาม OME_LANG', async ({ page }) => {
    const r = await setup(page, { wasm: 404 });
    expect(r.m).toMatchObject({ craft: true, code: 'missing', file: 'fake.wasm' });
    const msg = await page.evaluate((m) => { OME_LANG.set('en'); const e = TanotCraft.fromMessage(m); TanotCraft.report(e, { stage: 'load' }); return TanotCraft.message(e); }, r.m);
    expect(msg).toBe('This tool’s files were not found on the server — reload the page and try again');
    const log = JSON.parse(await page.evaluate(() => localStorage.getItem('tanot:media:log') || '[]'));
    expect(log[0]).toMatchObject({ kind: 'craft', stage: 'load', model: 'fake/fake.wasm' });
    expect(log[0].msg).toContain('craft:missing');
  });
});
