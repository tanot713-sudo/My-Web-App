// เสียงพูดไทย (MMS-TTS) ชุด stable + เว้นขอบท่อน + ปรับความดังอัตโนมัติ (2026-10)
// A) ตรรกะล้วน (Node: audio-gain.js, media-models.js) · B) หน้า text-to-speech จริงใน Chromium + C) วิดเจ็ตแชท (transformers.js หลอก — CI ไม่โหลดโมเดลจริง)
// ข้อความตัวอย่างทุกชุดแต่งขึ้นเอง
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const G = require('../audio-gain.js');
const N = require('../tts-normalize.js');

const STABLE = { fm: 'Tanotfin/mms-tts-2081-FM-stable-onnx', m: 'Tanotfin/mms-tts-2081-M-stable-onnx', pod: 'Tanotfin/mms-thai-female-podcast-spk0-stable-onnx' };
const OLD = { fm: 'Tanotfin/mms-tts-2081-FM-onnx', m: 'Tanotfin/mms-tts-2081-M-onnx', pod: 'phlebotomy1996/mms-thai-female-podcast-spk0', def: 'Tanotfin/mms-tts-2081-onnx' };

function models() {
  const sandbox = { self: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'media-models.js'), 'utf8'), sandbox);
  return sandbox.self.TanotMediaModels;
}
const db = (x) => 20 * Math.log10(x);
const sine = (n, amp, rate = 16000) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = Math.sin((2 * Math.PI * 220 * i) / rate) * amp; return a; };
const rmsDb = (a) => { let s = 0; for (const v of a) s += v * v; return db(Math.sqrt(s / a.length)); };
const peakDb = (a) => { let p = 0; for (const v of a) p = Math.max(p, Math.abs(v)); return db(p); };

/* ═══════════════ A) ตรรกะล้วน ═══════════════ */
test.describe('A) audio-gain.js — ปรับความดังอัตโนมัติ (known-answer)', () => {
  test('สัญญาณเบา → RMS ใกล้ −20 dBFS · peak ≤ −1 dBFS', () => {
    const a = sine(16000 * 3, 0.01); // RMS ≈ −43 dBFS
    const r = G.apply(a, 16000);
    expect(r.gain).toBeGreaterThan(10);
    expect(rmsDb(a)).toBeGreaterThan(-20.3); expect(rmsDb(a)).toBeLessThan(-19.7);
    expect(peakDb(a)).toBeLessThanOrEqual(-1 + 1e-6);
  });
  test('สัญญาณเบามากที่ peak จำกัด → ไม่เกิน −1 dBFS (เป้า RMS ไม่ถึงก็ยอม)', () => {
    const a = sine(16000, 0.01); a[100] = 0.3; // peak/RMS สูง
    const before = G.measure(a, 16000);
    const g = G.gainFor(before);
    expect(g).toBeCloseTo(Math.pow(10, -1 / 20) / 0.3, 5);
    G.apply(a, 16000);
    expect(peakDb(a)).toBeLessThanOrEqual(-1 + 1e-6);
  });
  test('ดังพออยู่แล้ว (RMS −15, peak −3) → gain = 1 ไม่ลดเสียง', () => {
    const a = sine(16000, Math.pow(10, -15 / 20) * Math.SQRT2);
    a[5] = 0.7; // peak ~ −3 dBFS
    expect(peakDb(a)).toBeLessThan(-1);
    const copy = Float32Array.from(a);
    const r = G.apply(a, 16000);
    expect(r.gain).toBe(1);
    expect(Array.from(a)).toEqual(Array.from(copy));
  });
  test('ดังเกิน (peak > −1 dBFS) → ลดลงให้ peak = −1 dBFS', () => {
    const a = sine(16000, 1.5);
    G.apply(a, 16000);
    expect(peakDb(a)).toBeCloseTo(-1, 3);
  });
  test('ช่วงเงียบไม่นับใน RMS: เสียง 50% + เงียบสนิท 50% → ช่วงมีเสียงได้ −20 dBFS (ไม่ใช่ −17) · ช่วงเงียบยังเป็น 0', () => {
    const speech = sine(16000, 0.02), a = new Float32Array(32000); a.set(speech, 0);
    G.apply(a, 16000);
    expect(rmsDb(a.subarray(0, 16000))).toBeGreaterThan(-20.3); expect(rmsDb(a.subarray(0, 16000))).toBeLessThan(-19.7);
    expect(Math.max(...a.subarray(16000).map(Math.abs))).toBe(0);
  });
  test('เสียงรบกวนต่ำกว่า −50 dBFS ไม่ถูกนับ/ไม่ถูกขยายเกินสัดส่วนของเสียงพูด: gain มาจากช่วงพูดเท่านั้น', () => {
    const a = new Float32Array(32000); a.set(sine(16000, 0.02), 0);
    for (let i = 16000; i < 32000; i++) a[i] = (i % 2 ? 1 : -1) * 0.0005; // −66 dBFS
    const g = G.gainFor(G.measure(a, 16000));
    const g2 = G.gainFor(G.measure(sine(16000, 0.02), 16000));
    expect(g).toBeCloseTo(g2, 6);
    G.apply(a, 16000);
    expect(Math.max(...a.subarray(16000).map(Math.abs))).toBeCloseTo(0.0005 * g, 6);
    expect(rmsDb(a.subarray(16000))).toBeLessThan(-45); // ยังเบากว่าเสียงพูดมาก
  });
  test('ก้อนที่เงียบทั้งก้อน/มีแต่ noise ต่ำกว่า −50 dBFS/ว่าง → gain 1', () => {
    const z = new Float32Array(16000); expect(G.apply(z, 16000).gain).toBe(1);
    const n = new Float32Array(16000).fill(0.001); expect(G.apply(n, 16000).gain).toBe(1); expect(n[0]).toBe(Math.fround(0.001));
    expect(G.apply(new Float32Array(0), 16000).gain).toBe(1);
  });
});

test.describe('A) media-models.js — เสียงไทยชุด stable', () => {
  const M = models();
  test('migrate ทั้ง 4 id เดิม → stable คู่กัน ("ค่าเริ่มต้น" เดิม → หญิง ทั่วไป) · id ใหม่/อังกฤษคงเดิม', () => {
    expect(M.ttsMigrate(OLD.def)).toBe(STABLE.fm);
    expect(M.ttsMigrate(OLD.fm)).toBe(STABLE.fm);
    expect(M.ttsMigrate(OLD.m)).toBe(STABLE.m);
    expect(M.ttsMigrate(OLD.pod)).toBe(STABLE.pod);
    for (const id of Object.values(STABLE).concat(['Xenova/mms-tts-eng', 'x/y'])) expect(M.ttsMigrate(id)).toBe(id);
    expect(M.TTS_DEFAULT_VOICE).toBe(STABLE.fm);
  });
  test('legacy ของ stable = repo เดิมของเสียงนั้น', () => {
    expect(M.ttsLegacy(STABLE.fm)).toBe(OLD.fm); expect(M.ttsLegacy(STABLE.m)).toBe(OLD.m); expect(M.ttsLegacy(STABLE.pod)).toBe(OLD.pod);
    expect(M.ttsLegacy('Xenova/mms-tts-eng')).toBe(null);
  });
  test('dtype ต่อ id: พอดแคสต์ (stable + เดิม) fp32 · FM/M stable = ค่าเริ่มต้น (q8) · WebGPU fp32 ทุกตัว', () => {
    expect(M.ttsDtype(STABLE.pod)).toBe('fp32'); expect(M.ttsDtype(OLD.pod)).toBe('fp32');
    expect(M.ttsDtype(STABLE.fm)).toBe(null); expect(M.ttsDtype(STABLE.m)).toBe(null);
    for (const id of Object.values(STABLE)) expect(M.ttsGpuDtype(id)).toBe('fp32');
  });
});

/* ═══════════════ B) หน้า text-to-speech ═══════════════ */
const BIG_DEVICE = `Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 8 }); Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 8 });`;

/* cfg.missing = [model id ที่ "โหลดไม่ได้" (404)] · cfg.mem = [model id ที่โหลดแล้วหน่วยความจำไม่พอ] · cfg.loud = ท่อนที่มีคำว่า "ดัง" ใช้แอมพลิจูดนี้ · cfg.amp = แอมพลิจูดปกติ · cfg.gap = ครึ่งหลังของเสียงเป็นความเงียบสนิท */
function fakeTransformers(cfg) {
  return `
const VOCAB = new Set(${JSON.stringify(N.VALID_CHARS.split(''))});
const CFG = ${JSON.stringify(cfg || {})};
export const env = { backends: { onnx: { wasm: {} } } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export class TextStreamer { constructor(tok, o) { this.o = o; } }
export async function pipeline(task, model, opts) {
  const device = (opts && opts.device) || 'wasm';
  if (task === 'text-to-speech') self.postMessage({ type: 'fake-pipeline', model, device, dtype: (opts && opts.dtype) || null });
  if (opts && opts.progress_callback) opts.progress_callback({ status: 'progress', file: 'onnx/model.onnx', progress: 50 });
  if ((CFG.missing || []).includes(model)) throw new Error('Could not locate file: "https://huggingface.co/' + model + '/resolve/main/onnx/model_quantized.onnx" (404)');
  if ((CFG.mem || []).includes(model)) throw new Error('Aborted(). Build with -sASSERTIONS for more info. out of memory');
  const CHAT = ${JSON.stringify((cfg && cfg.chat) || ['สวัสดีครับ ทดสอบเสียงพูด'])};
  if (task !== 'text-to-speech') { const g = async (messages, o) => { for (const t of CHAT) { o.streamer.o.callback_function(t); await sleep(5); } return []; }; g.tokenizer = {}; return g; }
  return async (text) => {
    const out = /mms-tts-eng/.test(model) ? [] : [...text].filter((c) => !VOCAB.has(c));
    if (out.length) throw new Error('Gather node index out of bounds: ' + JSON.stringify(out.join('')));
    const amp = text.includes('ดัง') && CFG.loud != null ? CFG.loud : (CFG.amp != null ? CFG.amp : 0.3);
    const a = new Float32Array(16000);
    for (let i = 0; i < (CFG.gap ? 8000 : a.length); i++) a[i] = Math.sin((2 * Math.PI * 220 * i) / 16000) * amp;
    return { audio: a, sampling_rate: 16000 };
  };
}`;
}
const SPY = `(() => {
  const W = window.Worker;
  window.__batches = []; window.__wmsgs = []; window.__workers = [];
  function Spy(url, opts) {
    const w = new W(url, opts);
    const u = String(url); window.__workers.push(u);
    const post = w.postMessage.bind(w);
    w.postMessage = function (m, tr) { if (m && m.type === 'synthesize-batch') window.__batches.push({ model: m.modelId, device: m.device, rawItems: m.items.map((i) => i.text) }); return post(m, tr); };
    if (/tts-worker/.test(u)) w.addEventListener('message', (e) => { const d = e.data; if (d && (d.type === 'fake-pipeline' || d.type === 'fallback')) window.__wmsgs.push(d); });
    return w;
  }
  Spy.prototype = W.prototype; window.Worker = Spy;
  window.__played = [];
  const st = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when) {
    if (this.buffer) { const d = this.buffer.getChannelData(0); let s = 0, p = 0; for (let i = 0; i < d.length; i++) { s += d[i] * d[i]; p = Math.max(p, Math.abs(d[i])); } window.__played.push({ rms: Math.sqrt(s / d.length), peak: p }); }
    return st.apply(this, arguments);
  };
})();`;

async function setup(context, page, { cfg, init } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await context.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (/\/vendor\/transformers\/transformers\.web\.min\.js$/.test(u.pathname)) return r.fulfill({ contentType: 'text/javascript', body: fakeTransformers(cfg) });
    if (u.pathname === '/api/ai/usage') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ used: 10, limit: 10000 }) });
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return r.continue();
    return r.abort('internetdisconnected');
  });
  await page.addInitScript(SPY);
  await page.addInitScript((i) => { try { localStorage.setItem('ome:theme', 'light'); localStorage.setItem('tanot:asr:lang', 'auto'); } catch (e) {} if (i) (0, eval)(i); }, init || '');
  return errors;
}
const ok = (page) => expect(page.locator('#dlStatus')).toHaveClass(/ok/, { timeout: 30000 });
const logRows = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));
const TEXT = 'ประโยคทดสอบหนึ่ง สร้างเสียงพูดภาษาไทย\n\nประโยคทดสอบสอง สร้างเสียงพูดภาษาไทย';
/* วิเคราะห์ไฟล์ wav (PCM16 mono) ที่ลิงก์ให้ → { rms, peak } เป็น dBFS · seg = [จาก, ถึง) sample */
const wavStats = (page, sel, seg) => page.evaluate(async ([s, sg]) => {
  const b = await (await fetch(document.querySelector(s).href)).arrayBuffer();
  const pcm = new Int16Array(b.slice(44)); const from = sg ? sg[0] : 0, to = sg ? sg[1] : pcm.length;
  /* RMS เฉพาะช่วงมีเสียง (เฟรม 20 ms ที่ RMS ≥ −50 dBFS) เหมือนที่ตัววัดในเว็บทำ — ช่องว่างเงียบระหว่างท่อนไม่ถ่วงค่า */
  let sum = 0, n = 0, p = 0; const F = 320;
  for (let s0 = from; s0 < to; s0 += F) { const e = Math.min(to, s0 + F); let fs = 0; for (let i = s0; i < e; i++) { const v = pcm[i] / 32768; fs += v * v; p = Math.max(p, Math.abs(v)); } if (fs / (e - s0) >= 1e-5) { sum += fs; n += e - s0; } }
  return { rms: 20 * Math.log10(Math.sqrt(sum / (n || 1)) || 1e-9), peak: 20 * Math.log10(p || 1e-9), samples: pcm.length };
}, [sel, seg || null]);

test.describe('B) รายการเสียงไทย + ทางถอย', () => {
  test('รายการ: 3 เสียง stable ไม่มี "ค่าเริ่มต้น" · ค่าเริ่มต้น = หญิง (ทั่วไป) stable · EN มีตัวเดียวเหมือนเดิม', async ({ context, page }) => {
    const errors = await setup(context, page);
    await page.goto('/text-to-speech.html');
    const opts = await page.$$eval('#dlVoice option', (os) => os.map((o) => [o.value, o.textContent]));
    expect(opts).toEqual([[STABLE.fm, 'หญิง (ทั่วไป)'], [STABLE.m, 'ชาย (ทั่วไป)'], [STABLE.pod, 'หญิง (โทนพอดแคสต์)']]);
    expect(opts.some(([v, t]) => v === OLD.def || t === 'ค่าเริ่มต้น')).toBe(false);
    expect(await page.inputValue('#dlVoice')).toBe(STABLE.fm);
    await page.selectOption('#dlLang', 'en');
    expect(await page.$$eval('#dlVoice option', (os) => os.map((o) => o.value))).toEqual(['Xenova/mms-tts-eng']);
    expect(errors).toEqual([]);
  });

  for (const [name, old, want] of [['ค่าเริ่มต้นเดิม', OLD.def, STABLE.fm], ['หญิง ทั่วไป เดิม', OLD.fm, STABLE.fm], ['ชาย ทั่วไป เดิม', OLD.m, STABLE.m], ['พอดแคสต์ เดิม', OLD.pod, STABLE.pod]]) {
    test('ค่าที่เคยเลือกไว้ (' + name + ') → แปลงเป็น stable ตัวคู่กัน ทั้งในรายการและตอนสร้างไฟล์', async ({ context, page }) => {
      const errors = await setup(context, page, { init: BIG_DEVICE });
      await page.goto('/text-to-speech.html');
      await page.evaluate((id) => { const s = document.getElementById('dlVoice'), o = document.createElement('option'); o.value = id; s.appendChild(o); s.value = id; }, old);
      await page.selectOption('#dlLang', 'th'); // วาดรายการใหม่ (เก็บค่าที่เลือกไว้)
      await page.evaluate(() => document.getElementById('dlLang').dispatchEvent(new Event('change')));
      expect(await page.inputValue('#dlVoice')).toBe(want);
      // ค่าเก่าที่ยังค้างในตัวเลือก (ไม่ผ่านการวาดใหม่) ก็แปลงตอนสร้าง
      await page.evaluate((id) => { const s = document.getElementById('dlVoice'), o = document.createElement('option'); o.value = id; s.appendChild(o); s.value = id; }, old);
      await page.fill('#ttsText', TEXT);
      await page.click('#dlGenerateBtn'); await ok(page);
      expect((await page.evaluate(() => window.__batches)).every((b) => b.model === want)).toBe(true);
      expect(errors).toEqual([]);
    });
  }

  test('dtype ต่อ id ที่ Worker โหลดจริง: พอดแคสต์ stable = fp32 · หญิง/ชาย stable = ค่าเริ่มต้น (ไม่ส่ง dtype)', async ({ context, page }) => {
    const errors = await setup(context, page, { init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    for (const id of [STABLE.pod, STABLE.m, STABLE.fm]) {
      await page.selectOption('#dlVoice', id);
      await page.fill('#ttsText', TEXT);
      await page.click('#dlGenerateBtn'); await ok(page);
    }
    const msgs = (await page.evaluate(() => window.__wmsgs)).filter((m) => m.type === 'fake-pipeline');
    const by = Object.fromEntries(msgs.map((m) => [m.model, m.dtype]));
    expect(by[STABLE.pod]).toBe('fp32'); expect(by[STABLE.m]).toBe(null); expect(by[STABLE.fm]).toBe(null);
    expect(errors).toEqual([]);
  });

  test('โหลด repo stable ไม่ได้ (404) → ใช้ repo เดิมของเสียงนั้น 1 ครั้ง + problem log (ไม่มีเนื้อหาผู้ใช้) · ไฟล์ยังสร้างได้', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { missing: [STABLE.m] }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.selectOption('#dlVoice', STABLE.m);
    await page.fill('#ttsText', TEXT);
    await page.click('#dlGenerateBtn'); await ok(page);
    const msgs = await page.evaluate(() => window.__wmsgs);
    const fb = msgs.filter((m) => m.type === 'fallback');
    expect(fb.length).toBeGreaterThanOrEqual(1); // Worker ละ 1 ครั้ง (พูลอาจมีหลายตัว)
    expect(fb[0]).toMatchObject({ what: 'model', from: STABLE.m, to: OLD.m, stage: 'load' });
    expect([...new Set(msgs.filter((m) => m.type === 'fake-pipeline').map((m) => m.model))]).toEqual([STABLE.m, OLD.m]);
    expect(fb.every((m) => m.what === 'model' && m.to === OLD.m)).toBe(true);
    const rows = (await logRows(page)).filter((r) => r.kind === 'tts' && r.code !== 'info');
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ engine: 'local', stage: 'model-load', model: STABLE.m });
    expect(JSON.stringify(rows)).not.toContain('ประโยคทดสอบ');
    const n1 = msgs.filter((m) => m.type === 'fake-pipeline').length;
    // สร้างซ้ำ: Worker จำไว้แล้ว ไม่ลอง stable ซ้ำ
    await page.click('#dlGenerateBtn'); await ok(page);
    expect((await page.evaluate(() => window.__wmsgs)).filter((m) => m.type === 'fake-pipeline').length).toBe(n1); // Worker จำไว้แล้ว ไม่โหลดซ้ำ/ไม่ลอง stable ซ้ำ
    expect(errors).toEqual([]);
  });

  test('หน่วยความจำไม่พอ ≠ 404 → ไม่ถอยไป repo เดิม (แจ้ง error ตามปกติ)', async ({ context, page }) => {
    await setup(context, page, { cfg: { mem: [STABLE.fm] }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', TEXT);
    await page.click('#dlGenerateBtn');
    await expect(page.locator('#dlStatus')).toHaveClass(/err/, { timeout: 30000 });
    expect((await page.evaluate(() => window.__wmsgs)).filter((m) => m.type === 'fallback')).toEqual([]);
    expect((await page.evaluate(() => window.__wmsgs)).filter((m) => m.type === 'fake-pipeline').map((m) => m.model)).toEqual([STABLE.fm]);
  });
});

test.describe('B) เว้นขอบท่อน', () => {
  test('ทุกท่อนที่ Worker ได้รับขึ้นต้น/ลงท้ายด้วยช่องว่าง 1 ตัว · ตัวท่อนยัง ≤ MAX_CHUNK · "ดูข้อความที่จะอ่านจริง" ไม่มีช่องว่างพิเศษ', async ({ context, page }) => {
    const errors = await setup(context, page, { init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', TEXT + '\n\n' + 'คำ '.repeat(80));
    await page.click('#dlGenerateBtn'); await ok(page);
    const items = (await page.evaluate(() => window.__batches)).flatMap((b) => b.rawItems);
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const t of items) { expect(t).toMatch(/^ \S/); expect(t).toMatch(/\S $/); expect(t.length).toBeLessThanOrEqual(N.MAX_CHUNK + 2); }
    await page.click('#pvMmsBox > summary');
    const pv = await page.locator('#pvMms').evaluate((e) => e.value !== undefined && e.value !== '' ? e.value : e.textContent);
    expect(pv).toContain('ประโยคทดสอบหนึ่ง สร้างเสียงพูดภาษาไทย');
    expect(errors).toEqual([]);
  });
  test('ภาษาอังกฤษ (mms-tts-eng) ไม่เว้นขอบท่อน', async ({ context, page }) => {
    await setup(context, page, { init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.selectOption('#dlLang', 'en');
    await page.fill('#ttsText', 'This is the first test sentence. This is another one.');
    await page.click('#dlGenerateBtn'); await ok(page);
    expect((await page.evaluate(() => window.__batches)).every((b) => b.model === 'Xenova/mms-tts-eng')).toBe(true);
    const items = (await page.evaluate(() => window.__batches)).flatMap((b) => b.rawItems);
    expect(items.length).toBeGreaterThan(0);
    for (const t of items) expect(t).toBe(t.trim());
  });
});

test.describe('B) ปรับความดังตอนสร้างไฟล์', () => {
  test('เสียงเบา (แอมพลิจูด 0.01 ≈ −43 dBFS) → ไฟล์ .wav RMS ใกล้ −20 dBFS · peak ≤ −1 dBFS', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { amp: 0.01 }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', TEXT);
    await page.click('#dlGenerateBtn'); await ok(page);
    const s = await wavStats(page, '#dlWavLink');
    expect(s.rms).toBeGreaterThan(-20.6); expect(s.rms).toBeLessThan(-19.4);
    expect(s.peak).toBeLessThanOrEqual(-0.99);
    expect(errors).toEqual([]);
  });
  test('เสียงดังเกิน (แอมพลิจูด 1.5) → ลดลง peak = −1 dBFS', async ({ context, page }) => {
    await setup(context, page, { cfg: { amp: 1.5 }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', TEXT);
    await page.click('#dlGenerateBtn'); await ok(page);
    const s = await wavStats(page, '#dlWavLink');
    expect(s.peak).toBeGreaterThan(-1.1); expect(s.peak).toBeLessThanOrEqual(-0.95);
  });
  test('ดังพออยู่แล้ว (แอมพลิจูด 0.3 → RMS ≈ −13.5) → ไม่ถูกลดเสียง', async ({ context, page }) => {
    await setup(context, page, { cfg: { amp: 0.3 }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', TEXT);
    await page.click('#dlGenerateBtn'); await ok(page);
    const s = await wavStats(page, '#dlWavLink');
    expect(s.peak).toBeGreaterThan(db(0.3) - 0.3); expect(s.peak).toBeLessThan(db(0.3) + 0.3);
  });
  test('ช่วงเงียบสนิทไม่ถูกนับ/ขยาย: ครึ่งหลังของทุกท่อนเงียบ → ช่วงพูดยังได้ ≈ −20 dBFS ไม่ใช่ดังกว่า', async ({ context, page }) => {
    await setup(context, page, { cfg: { amp: 0.02, gap: true }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', 'ประโยคเดียวสั้นๆ ทดสอบ');
    await page.click('#dlGenerateBtn'); await ok(page);
    const sp = await wavStats(page, '#dlWavLink', [0, 8000]);
    const si = await wavStats(page, '#dlWavLink', [9000, 15000]);
    expect(sp.rms).toBeGreaterThan(-20.6); expect(sp.rms).toBeLessThan(-19.4);
    expect(si.peak).toBeLessThan(-80);
  });
  test('แบ่งไฟล์ตามตอน: ปรับความดังต่อตอน (ตอนที่ท่อนเบากับตอนที่ท่อนดัง ได้ RMS ใกล้ −20 ทั้งคู่)', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { amp: 0.01, loud: 0.05 }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', ['1. ตอนเบา', 'ประโยคของตอนแรก เบา', '', '2. ตอนดัง', 'ประโยคของตอนสอง ดัง ดัง'].join('\n'));
    await page.check('#optSplit');
    await page.click('#dlGenerateBtn'); await ok(page);
    await expect(page.locator('#dlParts a[data-ext=wav]')).toHaveCount(2);
    for (const i of [0, 1]) {
      const s = await wavStats(page, '#dlParts .list-row:nth-child(' + (i + 1) + ') a[data-ext=wav]');
      expect(s.rms, 'ตอน ' + (i + 1)).toBeGreaterThan(-20.7); expect(s.rms).toBeLessThan(-19.3);
      expect(s.peak).toBeLessThanOrEqual(-0.99);
    }
    expect(errors).toEqual([]);
  });
});

/* ═══════════════ C) วิดเจ็ตแชท ═══════════════ */
test.describe('C) วิดเจ็ตแชท', () => {
  async function ask(page, text) {
    await page.click('.ome-ai-fab');
    await page.fill('.ome-ai-inputrow textarea', text);
    await page.click('.ome-ai-btn.send');
  }
  test('พูดด้วยหญิง (ทั่วไป) stable · ท่อนที่ Worker ได้รับเว้นขอบ · เล่นเสียงที่ปรับความดังแล้ว (เบา → RMS ใกล้ −20, peak ≤ −1)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await ctx.newPage();
    const errors = await setup(ctx, page, { cfg: { amp: 0.01, chat: ['ราคา 3,599 บาท ลดห้าสิบเปอร์เซ็นต์ ', 'ขอบคุณมากครับ'] }, init: 'window.TANOT_AI = { enabled: true };' });
    await page.addInitScript(() => localStorage.setItem('ome:aiChatSpeak', 'on'));
    await page.goto('/credits.html');
    await ask(page, 'ทดสอบ');
    await expect.poll(() => page.evaluate(() => window.__batches.length), { timeout: 15000 }).toBe(1);
    const b = (await page.evaluate(() => window.__batches))[0];
    expect(b.model).toBe(STABLE.fm);
    expect(b.rawItems.length).toBeGreaterThanOrEqual(1);
    for (const t of b.rawItems) { expect(t).toMatch(/^ \S/); expect(t).toMatch(/\S $/); }
    await expect.poll(() => page.evaluate(() => window.__played.length), { timeout: 15000 }).toBe(b.rawItems.length);
    const played = await page.evaluate(() => window.__played);
    for (const p of played) {
      expect(20 * Math.log10(p.rms)).toBeGreaterThan(-20.6); expect(20 * Math.log10(p.rms)).toBeLessThan(-19.4);
      expect(20 * Math.log10(p.peak)).toBeLessThanOrEqual(-0.99);
    }
    expect(errors).toEqual([]);
    await ctx.close();
  });
  test('โหลดเสียง stable ไม่ได้ (404) → วิดเจ็ตพูดด้วย repo เดิมได้ + problem log', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await ctx.newPage();
    await setup(ctx, page, { cfg: { missing: [STABLE.fm], chat: ['สวัสดีครับ ทดสอบเสียงพูด'] }, init: 'window.TANOT_AI = { enabled: true };' });
    await page.addInitScript(() => localStorage.setItem('ome:aiChatSpeak', 'on'));
    await page.goto('/credits.html');
    await ask(page, 'ทดสอบ');
    await expect.poll(() => page.evaluate(() => window.__played.length), { timeout: 15000 }).toBeGreaterThan(0);
    const msgs = await page.evaluate(() => window.__wmsgs);
    expect(msgs.filter((m) => m.type === 'fake-pipeline').map((m) => m.model)).toEqual([STABLE.fm, OLD.fm]);
    expect(msgs.filter((m) => m.type === 'fallback')[0]).toMatchObject({ what: 'model', from: STABLE.fm, to: OLD.fm });
    await ctx.close();
  });
});
