// เสียงพูดไทย (MMS-TTS) ชุด stable2 (ทางถอย stable2 → stable → ต้นฉบับ) + เว้นขอบท่อน + ปรับความดังอัตโนมัติ + ลดเสียงแหลม (low-pass) + ลองโหลดใหม่เมื่อเครือข่ายสะดุด (2026-10)
// A) ตรรกะล้วน (Node: audio-gain.js, media-models.js) · B) หน้า text-to-speech จริงใน Chromium + C) วิดเจ็ตแชท (transformers.js หลอก — CI ไม่โหลดโมเดลจริง)
// ข้อความตัวอย่างทุกชุดแต่งขึ้นเอง
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const G = require('../audio-gain.js');
const N = require('../tts-normalize.js');

const S2 = { fm: 'Tanotfin/mms-tts-2081-FM-stable2-onnx', m: 'Tanotfin/mms-tts-2081-M-stable2-onnx', pod: 'Tanotfin/mms-thai-female-podcast-spk0-stable2-onnx' };
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

test.describe('A) media-models.js — เสียงไทยชุด stable2', () => {
  const M = models();
  test('migrate: id ต้นฉบับทั้ง 4 + ชุด stable ทั้ง 3 → stable2 คู่กัน ("ค่าเริ่มต้น" เดิม → หญิง ทั่วไป) · id stable2/อังกฤษ/อื่นคงเดิม', () => {
    expect(M.ttsMigrate(OLD.def)).toBe(S2.fm);
    expect(M.ttsMigrate(OLD.fm)).toBe(S2.fm); expect(M.ttsMigrate(OLD.m)).toBe(S2.m); expect(M.ttsMigrate(OLD.pod)).toBe(S2.pod);
    expect(M.ttsMigrate(STABLE.fm)).toBe(S2.fm); expect(M.ttsMigrate(STABLE.m)).toBe(S2.m); expect(M.ttsMigrate(STABLE.pod)).toBe(S2.pod);
    for (const id of Object.values(S2).concat(['Xenova/mms-tts-eng', 'x/y', ''])) expect(M.ttsMigrate(id)).toBe(id);
    expect(M.TTS_DEFAULT_VOICE).toBe(S2.fm);
  });
  test('ทางถอย = "ขั้นถัดไป": stable2 → stable → ต้นฉบับ → null (ห่วงโซ่ 2 ขั้น ไม่วนกลับ)', () => {
    for (const k of ['fm', 'm', 'pod']) {
      expect(M.ttsLegacy(S2[k])).toBe(STABLE[k]); expect(M.ttsLegacy(STABLE[k])).toBe(OLD[k]); expect(M.ttsLegacy(OLD[k])).toBe(null);
      expect(M.ttsLegacyChain(S2[k])).toEqual([STABLE[k], OLD[k]]);
      expect(M.ttsLegacyChain(OLD[k])).toEqual([]);
    }
    expect(M.ttsLegacy('Xenova/mms-tts-eng')).toBe(null);
  });
  test('dtype ต่อ id: พอดแคสต์ (stable2 + stable + เดิม) fp32 · FM/M stable2 และ stable = ค่าเริ่มต้น (q8) · WebGPU fp32 ทุกตัว', () => {
    for (const id of [S2.pod, STABLE.pod, OLD.pod]) expect(M.ttsDtype(id)).toBe('fp32');
    for (const id of [S2.fm, S2.m, STABLE.fm, STABLE.m]) expect(M.ttsDtype(id)).toBe(null);
    for (const id of [...Object.values(S2), ...Object.values(STABLE)]) expect(M.ttsGpuDtype(id)).toBe('fp32');
  });
  test('ธง "ลดเสียงแหลม" เริ่มต้น: เปิดเฉพาะ หญิง ทั่วไป (stable2 / stable / เดิม) · ชาย พอดแคสต์ อังกฤษ = ปิด · 7 kHz', () => {
    for (const id of [S2.fm, STABLE.fm, OLD.fm]) expect(M.ttsLowpassDefault(id), id).toBe(true);
    for (const id of [S2.m, S2.pod, STABLE.m, OLD.pod, 'Xenova/mms-tts-eng', 'x/y']) expect(M.ttsLowpassDefault(id), id).toBe(false);
    expect(M.TTS_LOWPASS_HZ).toBe(7000);
  });
  test('isNetworkError: network error / Failed to fetch / Load failed = ใช่ · 404 / ไม่พบไฟล์ / หน่วยความจำ / บั๊กโค้ดทั่วไป = ไม่ใช่', () => {
    const E = (m) => M.isNetworkError(new TypeError(m));
    for (const m of ['network error', 'Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.', 'net::ERR_CONNECTION_RESET', 'The network connection was lost.']) expect(E(m), m).toBe(true);
    for (const m of ['Could not locate file: "https://huggingface.co/x/resolve/main/onnx/model.onnx" (404).', 'Unauthorized access to file (401)', 'Aborted(). Build with -sASSERTIONS. out of memory', "Cannot read properties of undefined (reading 'x')", '']) expect(E(m), m).toBe(false);
    expect(M.isNetworkError(undefined)).toBe(false);
    expect(M.NET_RETRY_MS).toBeGreaterThanOrEqual(1000); expect(M.NET_RETRY_MS).toBeLessThanOrEqual(2000);
  });
});

test.describe('A) audio-gain.js — ลดเสียงแหลม (biquad low-pass 2nd-order, Q 0.707, 7 kHz)', () => {
  const tone = (f, rate, n, amp = 0.5) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = amp * Math.sin((2 * Math.PI * f * i) / rate); return a; };
  const level = (a) => { let s = 0; const from = 4000; for (let i = from; i < a.length; i++) s += a[i] * a[i]; return db(Math.sqrt(s / (a.length - from))); }; // ข้ามช่วงเริ่มตัวกรอง
  const change = (f, rate) => { const a = tone(f, rate, rate * 2), b = Float32Array.from(a); G.lowpass(b, rate); return level(b) - level(a); };
  test('ไซน์ 9 kHz @22.05 kHz ลดลง ≥ 10 dB (ได้ ~13.7) · 1 kHz เปลี่ยน ≤ 0.5 dB · 7 kHz = −3 dB (จุดตัด)', () => {
    expect(change(9000, 22050)).toBeLessThanOrEqual(-10);
    expect(Math.abs(change(1000, 22050))).toBeLessThanOrEqual(0.5);
    expect(change(7000, 22050)).toBeGreaterThan(-3.3); expect(change(7000, 22050)).toBeLessThan(-2.7);
    expect(change(10500, 22050)).toBeLessThan(-30);
  });
  test('ไซน์ 9 kHz @24 kHz / 1 kHz @24 kHz ก็เข้าเกณฑ์เดียวกัน (ไม่ผูกกับ 22.05)', () => {
    expect(change(9000, 24000)).toBeLessThanOrEqual(-10); expect(Math.abs(change(1000, 24000))).toBeLessThanOrEqual(0.5);
  });
  test('โมเดล 16 kHz (rate ≤ 16000) ไม่ถูกกรอง: คืน false และ samples ไม่เปลี่ยนแม้แต่ตัวเดียว · lowpassApplies', () => {
    const a = tone(7000, 16000, 16000), b = Float32Array.from(a);
    expect(G.lowpass(b, 16000)).toBe(false);
    expect(Array.from(b)).toEqual(Array.from(a));
    expect(G.lowpass(Float32Array.from(a), 8000)).toBe(false);
    expect(G.lowpassApplies(16000)).toBe(false); expect(G.lowpassApplies(22050)).toBe(true); expect(G.lowpassApplies(16001)).toBe(true);
  });
  test('process: ขอ lowpass แล้ว "กรองก่อนปรับความดัง" (gain คำนวณจากเสียงที่กรองแล้ว) · ไม่ขอ = ไม่กรอง · normalize:false = กรองอย่างเดียว · rate 16 kHz = lowpass:false', () => {
    const mix = () => { const a = tone(1000, 22050, 44100, 0.01), b = tone(9000, 22050, 44100, 0.01); for (let i = 0; i < a.length; i++) a[i] += b[i]; return a; };
    const on = mix(), off = mix();
    const r1 = G.process(on, 22050, { lowpass: true }), r2 = G.process(off, 22050, {});
    expect(r1.lowpass).toBe(true); expect(r2.lowpass).toBe(false);
    expect(rmsDb(on)).toBeGreaterThan(-20.4); expect(rmsDb(on)).toBeLessThan(-19.6);   // ทั้งคู่ถูกปรับความดังเป็น −20 dBFS
    expect(rmsDb(off)).toBeGreaterThan(-20.4); expect(rmsDb(off)).toBeLessThan(-19.6);
    // ... แต่ฝั่งที่กรองมีพลังงาน 9 kHz น้อยกว่ามาก (วัดด้วย Goertzel)
    const g = (a, f, rate = 22050) => { const w = (2 * Math.PI * f) / rate, c = 2 * Math.cos(w); let s1 = 0, s2 = 0; for (let i = 4000; i < a.length; i++) { const s0 = a[i] + c * s1 - s2; s2 = s1; s1 = s0; } return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)); };
    expect(g(on, 9000) / g(on, 1000)).toBeLessThan(0.32); expect(g(off, 9000) / g(off, 1000)).toBeGreaterThan(0.9);
    const only = mix(); const r3 = G.process(only, 22050, { lowpass: 7000, normalize: false });
    expect(r3.gain).toBe(1); expect(r3.lowpass).toBe(true);
    const s16 = tone(1000, 16000, 16000, 0.01); expect(G.process(s16, 16000, { lowpass: true }).lowpass).toBe(false);
  });
  test('NaN ในเสียงไม่ทำให้ตัวกรองค้าง (ทั้งก้อนไม่เป็น NaN) · ก้อนว่างไม่ error', () => {
    const a = tone(1000, 22050, 4000); a[100] = NaN;
    G.lowpass(a, 22050);
    expect(a.every((v) => Number.isFinite(v))).toBe(true);
    expect(G.lowpass(new Float32Array(0), 22050)).toBe(true);
  });
});

test.describe('A) tts-normalize.js — เพดานท่อน MAX_CHUNK = 60', () => {
  /* ข้อความตัวอย่างแต่งเอง: ย่อหน้าแรก 10 บรรทัดสั้น (ต่อกันโดยไม่มีบรรทัดว่าง) + ย่อหน้าที่สอง 3 ประโยค */
  const para1 = Array.from({ length: 10 }, (_, i) => 'บรรทัดตัวอย่างที่ ' + (i + 1) + ' เล่าเรื่องสมมติสั้นๆ ต่อกัน').join('\n');
  const para2 = 'ประโยคแรกของย่อหน้าที่สอง. ประโยคที่สองยาวขึ้นอีกนิดเพื่อทดสอบการตัดท่อนตามเพดาน. ประโยคสุดท้าย';
  const TEXT2 = para1 + '\n\n' + para2;
  test('MAX_CHUNK = 60 · ทุกท่อน ≤ 60 · จำนวนท่อนของข้อความตัวอย่าง = 13 (เพดาน 100 ได้ 9) · ย่อหน้า/ช่วงเงียบ 3 ระดับยังทำงาน · ต่อท่อนกลับได้ข้อความเดิม', () => {
    expect(N.MAX_CHUNK).toBe(60);
    const p = N.plan(TEXT2);
    expect(p.chunks.length).toBe(13);
    expect(Math.max(...p.chunks.map((c) => c.length))).toBeLessThanOrEqual(60);
    p.chunks.forEach((c) => expect(c.length).toBeGreaterThan(0));
    expect(p.paras.join('')).toBe('0000000000111');                       // ย่อหน้า 0 = 10 ท่อน (รวมบรรทัดในย่อหน้า) · ย่อหน้า 1 = 3 ท่อน
    expect(p.gaps.at(-1)).toBe(0);
    expect(p.gaps[9]).toBe(0.4);                                           // ท่อนสุดท้ายของย่อหน้าแรก → ช่วงเงียบข้ามย่อหน้า
    expect(new Set(p.gaps.slice(0, 9))).toEqual(new Set([0.25]));          // ขอบท่อนตรงกับการขึ้นบรรทัดในย่อหน้าเดียวกัน
    expect(N.plan(TEXT2, { max: 100 }).chunks.length).toBe(9);             // ค่าเดิม (100) ยังเรียกผ่านตัวเลือก max ได้ — ใช้วัดผลเท่านั้น
    expect(N.plan(para1).chunks.join(' ')).toBe(N.forMms(para1));          // ตัดแล้วต่อกันได้ข้อความเดิม
  });
  test('ข้อความไทยยาวไม่เว้นวรรค/เลขที่ขยายเป็นคำแล้วยาว ก็ไม่เกิน 60', () => {
    const long = 'ราคาสินค้ารวมทั้งหมดเท่ากับ 1,234,567,890 บาท'.repeat(5) + 'ก'.repeat(200);
    N.plan(long).chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(60));
  });
  test('หน้าสร้างไฟล์เสียงส่ง Worker ท่อนละ ≤ 62 ตัวอักษร (ท่อน ≤ 60 + ช่องว่างเว้นขอบ 2 ตัว) และจำนวนท่อนเท่ากับ plan()', async ({ context, page }) => {
    const errors = await setup(context, page, { init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', TEXT2);
    await page.click('#dlGenerateBtn'); await ok(page);
    const items = (await page.evaluate(() => window.__batches)).flatMap((b) => b.rawItems);
    expect(items.length).toBe(13);
    for (const t of items) expect(t.length).toBeLessThanOrEqual(62);
    expect(errors).toEqual([]);
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
  if (task === 'text-to-speech') self.postMessage({ type: 'fake-pipeline', model, device, dtype: (opts && opts.dtype) || null, t: Date.now() });
  // netFail: { <model>: n } = n ครั้งแรกที่ Worker นี้โหลดโมเดลนั้นล้มด้วยเครือข่ายสะดุด (TypeError: network error)
  const NF = CFG.netFail || {}, cnt = (self.__nf = self.__nf || {});
  if (NF[model] != null) { cnt[model] = (cnt[model] || 0) + 1; if (cnt[model] <= NF[model]) throw new TypeError('network error'); }
  if (opts && opts.progress_callback) opts.progress_callback({ status: 'progress', file: 'onnx/model.onnx', progress: 50 });
  if ((CFG.missing || []).includes(model)) throw new Error('Could not locate file: "https://huggingface.co/' + model + '/resolve/main/onnx/model_quantized.onnx" (404)');
  if ((CFG.mem || []).includes(model)) throw new Error('Aborted(). Build with -sASSERTIONS for more info. out of memory');
  const CHAT = ${JSON.stringify((cfg && cfg.chat) || ['สวัสดีครับ ทดสอบเสียงพูด'])};
  if (task !== 'text-to-speech') { const g = async (messages, o) => { for (const t of CHAT) { o.streamer.o.callback_function(t); await sleep(5); } return []; }; g.tokenizer = {}; return g; }
  return async (text) => {
    const out = /mms-tts-eng/.test(model) ? [] : [...text].filter((c) => !VOCAB.has(c));
    if (out.length) throw new Error('Gather node index out of bounds: ' + JSON.stringify(out.join('')));
    const amp = text.includes('ดัง') && CFG.loud != null ? CFG.loud : (CFG.amp != null ? CFG.amp : 0.3);
    const rate = CFG.rate || 16000;
    const a = new Float32Array(rate);
    const tones = CFG.tones || [[220, 1]]; // [[Hz, สัดส่วนแอมพลิจูด]] — ผสมหลายความถี่ (ทดสอบ low-pass)
    for (let i = 0; i < (CFG.gap ? rate / 2 : a.length); i++) { let v = 0; for (const [f, k] of tones) v += Math.sin((2 * Math.PI * f * i) / rate) * k; a[i] = v * amp; }
    return { audio: a, sampling_rate: rate };
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
    if (/tts-worker/.test(u)) w.addEventListener('message', (e) => { const d = e.data; if (d && (d.type === 'fake-pipeline' || d.type === 'fallback' || d.type === 'retry')) window.__wmsgs.push(d); });
    return w;
  }
  Spy.prototype = W.prototype; window.Worker = Spy;
  window.__played = [];
  const st = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when) {
    if (this.buffer) {
      const d = this.buffer.getChannelData(0), rate = this.buffer.sampleRate; let s = 0, p = 0; for (let i = 0; i < d.length; i++) { s += d[i] * d[i]; p = Math.max(p, Math.abs(d[i])); }
      const gz = (f) => { const w = (2 * Math.PI * f) / rate, c = 2 * Math.cos(w); let s1 = 0, s2 = 0; for (let i = 2000; i < d.length; i++) { const s0 = d[i] + c * s1 - s2; s2 = s1; s1 = s0; } return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)); };
      window.__played.push({ rms: Math.sqrt(s / d.length), peak: p, rate, a1: gz(1000), a9: gz(9000) });
    }
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
  test('รายการ: 3 เสียง stable2 ไม่มี "ค่าเริ่มต้น" · ค่าเริ่มต้น = หญิง (ทั่วไป) stable2 · EN มีตัวเดียวเหมือนเดิม', async ({ context, page }) => {
    const errors = await setup(context, page);
    await page.goto('/text-to-speech.html');
    const opts = await page.$$eval('#dlVoice option', (os) => os.map((o) => [o.value, o.textContent]));
    expect(opts).toEqual([[S2.fm, 'หญิง (ทั่วไป)'], [S2.m, 'ชาย (ทั่วไป)'], [S2.pod, 'หญิง (โทนพอดแคสต์)']]);
    expect(opts.some(([v, t]) => v === OLD.def || t === 'ค่าเริ่มต้น')).toBe(false);
    expect(await page.inputValue('#dlVoice')).toBe(S2.fm);
    await page.selectOption('#dlLang', 'en');
    expect(await page.$$eval('#dlVoice option', (os) => os.map((o) => o.value))).toEqual(['Xenova/mms-tts-eng']);
    expect(errors).toEqual([]);
  });

  for (const [name, old, want] of [['ค่าเริ่มต้นเดิม', OLD.def, S2.fm], ['หญิง ทั่วไป เดิม', OLD.fm, S2.fm], ['ชาย ทั่วไป เดิม', OLD.m, S2.m], ['พอดแคสต์ เดิม', OLD.pod, S2.pod],
    ['หญิง ทั่วไป stable', STABLE.fm, S2.fm], ['ชาย ทั่วไป stable', STABLE.m, S2.m], ['พอดแคสต์ stable', STABLE.pod, S2.pod]]) {
    test('ค่าที่เคยเลือกไว้ (' + name + ') → แปลงเป็น stable2 ตัวคู่กัน ทั้งในรายการและตอนสร้างไฟล์', async ({ context, page }) => {
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

  test('dtype ต่อ id ที่ Worker โหลดจริง: พอดแคสต์ stable2 = fp32 · หญิง/ชาย stable2 = ค่าเริ่มต้น (ไม่ส่ง dtype)', async ({ context, page }) => {
    const errors = await setup(context, page, { init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    for (const id of [S2.pod, S2.m, S2.fm]) {
      await page.selectOption('#dlVoice', id);
      await page.fill('#ttsText', TEXT);
      await page.click('#dlGenerateBtn'); await ok(page);
    }
    const msgs = (await page.evaluate(() => window.__wmsgs)).filter((m) => m.type === 'fake-pipeline');
    const by = Object.fromEntries(msgs.map((m) => [m.model, m.dtype]));
    expect(by[S2.pod]).toBe('fp32'); expect(by[S2.m]).toBe(null); expect(by[S2.fm]).toBe(null);
    expect(errors).toEqual([]);
  });

  const ONE = 'ประโยคเดียวสั้นๆ ทดสอบเสียงพูด'; // ท่อนเดียว → Worker ตัวเดียว นับครั้งที่โหลดได้แน่นอน
  const pipelines = (page) => page.evaluate(() => window.__wmsgs.filter((m) => m.type === 'fake-pipeline').map((m) => m.model));
  const fallbacks = (page) => page.evaluate(() => window.__wmsgs.filter((m) => m.type === 'fallback'));
  const errRows = async (page) => (await logRows(page)).filter((r) => r.kind === 'tts' && r.code !== 'info');

  test('ทางถอยขั้นที่ 1: โหลด stable2 ไม่ได้ (404) → stable 1 ครั้ง + problem log (ไม่มีเนื้อหาผู้ใช้) · ไฟล์ยังสร้างได้', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { missing: [S2.m] }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.selectOption('#dlVoice', S2.m);
    await page.fill('#ttsText', TEXT);
    await page.click('#dlGenerateBtn'); await ok(page);
    const msgs = await page.evaluate(() => window.__wmsgs);
    const fb = msgs.filter((m) => m.type === 'fallback');
    expect(fb.length).toBeGreaterThanOrEqual(1); // Worker ละ 1 ครั้ง (พูลอาจมีหลายตัว)
    expect(fb[0]).toMatchObject({ what: 'model', from: S2.m, to: STABLE.m, stage: 'load', retried: false });
    expect([...new Set(msgs.filter((m) => m.type === 'fake-pipeline').map((m) => m.model))]).toEqual([S2.m, STABLE.m]); // ไม่แตะต้นฉบับ
    expect(fb.every((m) => m.what === 'model' && m.to === STABLE.m)).toBe(true);
    const rows = await errRows(page);
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ engine: 'local', stage: 'model-load', model: S2.m });
    expect(JSON.stringify(rows)).not.toContain('ประโยคทดสอบ');
    const n1 = msgs.filter((m) => m.type === 'fake-pipeline').length;
    // สร้างซ้ำ: Worker จำไว้แล้ว ไม่ลอง stable2 ซ้ำ
    await page.click('#dlGenerateBtn'); await ok(page);
    expect((await page.evaluate(() => window.__wmsgs)).filter((m) => m.type === 'fake-pipeline').length).toBe(n1);
    expect(errors).toEqual([]);
  });

  test('ทางถอย 2 ขั้น: stable2 และ stable โหลดไม่ได้ → ต้นฉบับ · ขั้นละ 1 ครั้ง · problem log 2 แถว (stable2→stable, stable→ต้นฉบับ)', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { missing: [S2.pod, STABLE.pod] }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.selectOption('#dlVoice', S2.pod);
    await page.fill('#ttsText', ONE);
    await page.click('#dlGenerateBtn'); await ok(page);
    expect(await pipelines(page)).toEqual([S2.pod, STABLE.pod, OLD.pod]);   // ทีละขั้น ขั้นละ 1 ครั้ง ตามลำดับ
    const fb = await fallbacks(page);
    expect(fb.map((m) => [m.from, m.to])).toEqual([[S2.pod, STABLE.pod], [STABLE.pod, OLD.pod]]);
    const rows = await errRows(page);
    expect(rows.map((r) => [r.stage, r.model])).toEqual([['model-load', S2.pod], ['model-load', STABLE.pod]]);
    expect(JSON.stringify(rows)).not.toContain('ประโยคเดียว');
    expect(errors).toEqual([]);
  });

  test('ทางถอยหมดห่วงโซ่ (ทั้ง 3 ตัวโหลดไม่ได้) → แจ้ง error ไม่วนซ้ำ ไม่ลองเกิน 3 ตัว', async ({ context, page }) => {
    await setup(context, page, { cfg: { missing: [S2.fm, STABLE.fm, OLD.fm] }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', ONE);
    await page.click('#dlGenerateBtn');
    await expect(page.locator('#dlStatus')).toHaveClass(/err/, { timeout: 30000 });
    expect(await pipelines(page)).toEqual([S2.fm, STABLE.fm, OLD.fm]);
  });

  test('หน่วยความจำไม่พอ ≠ 404 → ไม่ถอยไปชุดอื่น (แจ้ง error ตามปกติ)', async ({ context, page }) => {
    await setup(context, page, { cfg: { mem: [S2.fm] }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', TEXT);
    await page.click('#dlGenerateBtn');
    await expect(page.locator('#dlStatus')).toHaveClass(/err/, { timeout: 30000 });
    expect(await fallbacks(page)).toEqual([]);
    expect(await pipelines(page)).toEqual([S2.fm]);
  });

  test('เครือข่ายสะดุด (TypeError: network error) ตอนโหลด 1 ครั้ง → รอ ≥ 1.4 วิ ลองโหลดชุดเดิมซ้ำ → ผ่าน ไม่ถอย · problem log บันทึกว่าลองซ้ำ (code info, ไม่ใช่ error)', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { netFail: { [S2.pod]: 1 } }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.selectOption('#dlVoice', S2.pod);
    await page.fill('#ttsText', ONE);
    await page.click('#dlGenerateBtn'); await ok(page);
    expect(await pipelines(page)).toEqual([S2.pod, S2.pod]);
    expect(await fallbacks(page)).toEqual([]);
    const ts = await page.evaluate(() => window.__wmsgs.filter((m) => m.type === 'fake-pipeline').map((m) => m.t));
    expect(ts[1] - ts[0]).toBeGreaterThanOrEqual(1400); expect(ts[1] - ts[0]).toBeLessThan(6000);
    const retry = (await page.evaluate(() => window.__wmsgs)).filter((m) => m.type === 'retry');
    expect(retry.length).toBe(1);
    const rows = (await logRows(page)).filter((r) => r.kind === 'tts' && r.stage !== 'stats'); // แถวสถิติหลังสร้างเสร็จไม่นับ
    expect(rows.map((r) => [r.code, r.stage, r.model])).toEqual([['info', 'load-retry', S2.pod]]);
    expect(rows[0].msg).toBe('retry=1 network');
    expect(await errRows(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('เครือข่ายสะดุดซ้ำหลังลองใหม่แล้ว → เข้าทางถอยขั้นถัดไป (stable) · fallback ระบุ retried · log: ลองซ้ำ 1 + ถอย 1', async ({ context, page }) => {
    await setup(context, page, { cfg: { netFail: { [S2.fm]: 2 } }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', ONE);
    await page.click('#dlGenerateBtn'); await ok(page);
    expect(await pipelines(page)).toEqual([S2.fm, S2.fm, STABLE.fm]);
    const fb = await fallbacks(page);
    expect(fb.length).toBe(1);
    expect(fb[0]).toMatchObject({ what: 'model', from: S2.fm, to: STABLE.fm, retried: true });
    const rows = (await logRows(page)).filter((r) => r.kind === 'tts' && r.stage !== 'stats');
    expect(rows.map((r) => [r.code === 'info' ? 'info' : 'err', r.stage])).toEqual([['info', 'load-retry'], ['err', 'model-load']]);
  });

  test('404 ไม่ลองซ้ำ (ไปทางถอยทันที) — แต่ละ id ถูกโหลดครั้งเดียว ไม่มีแถว load-retry', async ({ context, page }) => {
    await setup(context, page, { cfg: { missing: [S2.fm] }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', ONE);
    await page.click('#dlGenerateBtn'); await ok(page);
    expect(await pipelines(page)).toEqual([S2.fm, STABLE.fm]);
    expect((await page.evaluate(() => window.__wmsgs)).filter((m) => m.type === 'retry')).toEqual([]);
    expect((await logRows(page)).filter((r) => r.stage === 'load-retry')).toEqual([]);
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
  test('พูดด้วยหญิง (ทั่วไป) stable2 · ท่อนที่ Worker ได้รับเว้นขอบ · เล่นเสียงที่ปรับความดังแล้ว (เบา → RMS ใกล้ −20, peak ≤ −1)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await ctx.newPage();
    const errors = await setup(ctx, page, { cfg: { amp: 0.01, chat: ['ราคา 3,599 บาท ลดห้าสิบเปอร์เซ็นต์ ', 'ขอบคุณมากครับ'] }, init: 'window.TANOT_AI = { enabled: true };' });
    await page.addInitScript(() => localStorage.setItem('ome:aiChatSpeak', 'on'));
    await page.goto('/credits.html');
    await ask(page, 'ทดสอบ');
    await expect.poll(() => page.evaluate(() => window.__batches.length), { timeout: 15000 }).toBe(1);
    const b = (await page.evaluate(() => window.__batches))[0];
    expect(b.model).toBe(S2.fm);
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
  test('โหลด stable2 ไม่ได้ (404) → วิดเจ็ตถอยไป stable (1 ขั้น) พูดต่อได้ + problem log', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await ctx.newPage();
    await setup(ctx, page, { cfg: { missing: [S2.fm], chat: ['สวัสดีครับ ทดสอบเสียงพูด'] }, init: 'window.TANOT_AI = { enabled: true };' });
    await page.addInitScript(() => localStorage.setItem('ome:aiChatSpeak', 'on'));
    await page.goto('/credits.html');
    await ask(page, 'ทดสอบ');
    await expect.poll(() => page.evaluate(() => window.__played.length), { timeout: 15000 }).toBeGreaterThan(0);
    const msgs = await page.evaluate(() => window.__wmsgs);
    expect(msgs.filter((m) => m.type === 'fake-pipeline').map((m) => m.model)).toEqual([S2.fm, STABLE.fm]);
    expect(msgs.filter((m) => m.type === 'fallback')[0]).toMatchObject({ what: 'model', from: S2.fm, to: STABLE.fm });
    await ctx.close();
  });
  test('stable2 และ stable โหลดไม่ได้ → วิดเจ็ตถอยถึงต้นฉบับ (ทีละขั้น) แล้วพูดได้', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await ctx.newPage();
    await setup(ctx, page, { cfg: { missing: [S2.fm, STABLE.fm], chat: ['สวัสดีครับ ทดสอบเสียงพูด'] }, init: 'window.TANOT_AI = { enabled: true };' });
    await page.addInitScript(() => localStorage.setItem('ome:aiChatSpeak', 'on'));
    await page.goto('/credits.html');
    await ask(page, 'ทดสอบ');
    await expect.poll(() => page.evaluate(() => window.__played.length), { timeout: 15000 }).toBeGreaterThan(0);
    const msgs = await page.evaluate(() => window.__wmsgs);
    expect(msgs.filter((m) => m.type === 'fake-pipeline').map((m) => m.model)).toEqual([S2.fm, STABLE.fm, OLD.fm]);
    expect(msgs.filter((m) => m.type === 'fallback').map((m) => [m.from, m.to])).toEqual([[S2.fm, STABLE.fm], [STABLE.fm, OLD.fm]]);
    await ctx.close();
  });
  test('เครือข่ายสะดุดตอนโหลดเสียงของวิดเจ็ต 1 ครั้ง → ลองใหม่แล้วพูดได้ ไม่ถอย', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await ctx.newPage();
    await setup(ctx, page, { cfg: { netFail: { [S2.fm]: 1 }, chat: ['สวัสดีครับ ทดสอบเสียงพูด'] }, init: 'window.TANOT_AI = { enabled: true };' });
    await page.addInitScript(() => localStorage.setItem('ome:aiChatSpeak', 'on'));
    await page.goto('/credits.html');
    await ask(page, 'ทดสอบ');
    await expect.poll(() => page.evaluate(() => window.__played.length), { timeout: 15000 }).toBeGreaterThan(0);
    const msgs = await page.evaluate(() => window.__wmsgs);
    expect(msgs.filter((m) => m.type === 'fake-pipeline').map((m) => m.model)).toEqual([S2.fm, S2.fm]);
    expect(msgs.filter((m) => m.type === 'fallback')).toEqual([]);
    expect(msgs.filter((m) => m.type === 'retry').length).toBe(1);
    await ctx.close();
  });
});

/* ═══════════════ D) ลดเสียงแหลม (ตัวเลือกในการ์ดสร้างไฟล์เสียง + วิดเจ็ต) ═══════════════ */
const TONES = [[1000, 0.5], [9000, 0.5]]; // 1 kHz + 9 kHz แอมพลิจูดเท่ากัน — อัตราส่วน A9/A1 ≈ 1 เมื่อไม่กรอง
/* แอมพลิจูดที่ความถี่ f ของไฟล์ .wav ที่ลิงก์ให้ (Goertzel) + sampleRate ในหัวไฟล์ */
const toneAmp = (page, sel, freqs) => page.evaluate(async ([s, fs]) => {
  const b = await (await fetch(document.querySelector(s).href)).arrayBuffer();
  const rate = new DataView(b).getUint32(24, true), pcm = new Int16Array(b.slice(44));
  const amp = (f) => { const w = (2 * Math.PI * f) / rate, c = 2 * Math.cos(w); let s1 = 0, s2 = 0; for (let i = 2000; i < pcm.length; i++) { const s0 = pcm[i] / 32768 + c * s1 - s2; s2 = s1; s1 = s0; } return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) * 2 / (pcm.length - 2000); };
  return { rate, amps: fs.map(amp) };
}, [sel, freqs]);
const ONE_LINE = 'ประโยคเดียวสั้นๆ ทดสอบเสียงพูด';

test.describe('D) ลดเสียงแหลม — หน้า text-to-speech', () => {
  const gen = async (page) => { await page.fill('#ttsText', ONE_LINE); await page.click('#dlGenerateBtn'); await ok(page); };
  const ratio = async (page, f2 = 9000) => { const r = await toneAmp(page, '#dlWavLink', [1000, f2]); return { rate: r.rate, ratio: r.amps[1] / r.amps[0] }; };

  test('หญิง (ทั่วไป) 22.05 kHz: ตัวเลือกติ๊กไว้เป็นค่าเริ่มต้น → ไฟล์ .wav มี 9 kHz ลดลง ≥ 10 dB เทียบ 1 kHz · ชาย/พอดแคสต์ ค่าเริ่มต้นไม่ติ๊ก', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { rate: 22050, tones: TONES, amp: 0.2 }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#optLowpass')).toBeChecked();
    await gen(page);
    const on = await ratio(page);
    expect(on.rate).toBe(22050);
    expect(on.ratio).toBeLessThan(0.316);       // ≥ 10 dB
    await page.selectOption('#dlVoice', S2.m); await expect(page.locator('#optLowpass')).not.toBeChecked();
    await page.selectOption('#dlVoice', S2.pod); await expect(page.locator('#optLowpass')).not.toBeChecked();
    await page.selectOption('#dlVoice', S2.fm); await expect(page.locator('#optLowpass')).toBeChecked();
    expect(errors).toEqual([]);
  });

  test('ปิดตัวเลือกแล้วไม่กรอง (9 kHz เท่าเดิม) · จำค่าใน tanot:tts:opts · โหลดหน้าใหม่ยังปิดอยู่ แม้เลือกเสียงหญิง', async ({ context, page }) => {
    await setup(context, page, { cfg: { rate: 22050, tones: TONES, amp: 0.2 }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.uncheck('#optLowpass');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:tts:opts')).lowpass)).toBe(false);
    await gen(page);
    expect((await ratio(page)).ratio).toBeGreaterThan(0.9);
    await page.reload();
    await expect(page.locator('#optLowpass')).not.toBeChecked();
    // ชาย: ผู้ใช้ติ๊กเอง → จำ true (ใช้กับเสียงอื่นด้วย จนกว่าจะเปลี่ยน)
    await page.selectOption('#dlVoice', S2.m);
    await page.check('#optLowpass');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:tts:opts')).lowpass)).toBe(true);
    await gen(page);
    expect((await ratio(page)).ratio).toBeLessThan(0.316);
  });

  test('ยังไม่เคยตั้งเอง → ไม่เขียน lowpass ลง tanot:tts:opts (ตามค่าเริ่มต้นของเสียง) · ตัวเลือกอื่นยังบันทึกเหมือนเดิม', async ({ context, page }) => {
    await setup(context, page, { init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.check('#optSplit');
    const o = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:tts:opts')));
    expect(o).toEqual({ skipParen: true, split: true, gpu: false });
  });

  test('โมเดล 16 kHz ไม่ถูกกรองแม้ติ๊กตัวเลือกไว้ (7 kHz เท่าเดิม ไม่ใช่ −3 dB)', async ({ context, page }) => {
    await setup(context, page, { cfg: { rate: 16000, tones: [[1000, 0.5], [7000, 0.5]], amp: 0.2 }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#optLowpass')).toBeChecked();
    await gen(page);
    const r = await ratio(page, 7000);
    expect(r.rate).toBe(16000);
    expect(r.ratio).toBeGreaterThan(0.9);
  });

  test('ภาษาอังกฤษ: ซ่อนตัวเลือก · กลับไทยแล้วกลับมา · ไม่กรองไฟล์อังกฤษแม้ rate 22.05 kHz', async ({ context, page }) => {
    await setup(context, page, { cfg: { rate: 22050, tones: TONES, amp: 0.2 }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.selectOption('#dlLang', 'en');
    await expect(page.locator('#optLowpassWrap')).toBeHidden();
    await page.fill('#ttsText', 'This is a short test sentence.');
    await page.click('#dlGenerateBtn'); await ok(page);
    expect((await ratio(page)).ratio).toBeGreaterThan(0.9);
    await page.selectOption('#dlLang', 'th');
    await expect(page.locator('#optLowpassWrap')).toBeVisible();
    await expect(page.locator('#optLowpass')).toBeChecked();
  });

  test('แบ่งไฟล์ตามตอน: ทุกตอนถูกกรอง (ต่อส่วน)', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { rate: 22050, tones: TONES, amp: 0.2 }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', ['1. ตอนแรก', 'ประโยคของตอนแรก', '', '2. ตอนสอง', 'ประโยคของตอนสอง'].join('\n'));
    await page.check('#optSplit');
    await page.click('#dlGenerateBtn'); await ok(page);
    await expect(page.locator('#dlParts a[data-ext=wav]')).toHaveCount(2);
    for (const i of [1, 2]) {
      const r = await toneAmp(page, '#dlParts .list-row:nth-child(' + i + ') a[data-ext=wav]', [1000, 9000]);
      expect(r.amps[1] / r.amps[0], 'ตอน ' + i).toBeLessThan(0.316);
    }
    expect(errors).toEqual([]);
  });

  test('EN: ป้ายตัวเลือกแปลแล้ว ไม่มีไทยหลุด', async ({ context, page }) => {
    await setup(context, page);
    await page.addInitScript(() => localStorage.setItem('ome:lang', 'en'));
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#optLowpassWrap')).toContainText('Reduce shrill treble');
    expect(await page.locator('#optLowpassWrap').innerText()).not.toMatch(/[ก-๙]/);
  });
});

test.describe('D) ลดเสียงแหลม — วิดเจ็ตแชท', () => {
  async function widgetPlay(browser, cfg, preset) {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await ctx.newPage();
    await setup(ctx, page, { cfg: Object.assign({ rate: 22050, tones: TONES, amp: 0.2, chat: ['สวัสดีครับ ทดสอบเสียงพูด'] }, cfg || {}), init: 'window.TANOT_AI = { enabled: true };' });
    await page.addInitScript((p) => { localStorage.setItem('ome:aiChatSpeak', 'on'); if (p) localStorage.setItem('tanot:tts:opts', JSON.stringify(p)); }, preset || null);
    await page.goto('/credits.html');
    await page.click('.ome-ai-fab');
    await page.fill('.ome-ai-inputrow textarea', 'ทดสอบ');
    await page.click('.ome-ai-btn.send');
    await expect.poll(() => page.evaluate(() => window.__played.length), { timeout: 15000 }).toBeGreaterThan(0);
    const played = await page.evaluate(() => window.__played);
    await ctx.close();
    return played;
  }
  test('หญิง (ทั่วไป) 22.05 kHz: ค่าเริ่มต้นกรอง (9 kHz ลด ≥ 10 dB เทียบ 1 kHz) · ปิดใน tanot:tts:opts.lowpass=false = ไม่กรอง · 16 kHz ไม่กรอง', async ({ browser }) => {
    const on = await widgetPlay(browser);
    expect(on[0].rate).toBe(22050);
    expect(on[0].a9 / on[0].a1).toBeLessThan(0.316);
    const off = await widgetPlay(browser, null, { lowpass: false });
    expect(off[0].a9 / off[0].a1).toBeGreaterThan(0.9);
    const lo = await widgetPlay(browser, { rate: 16000, tones: [[1000, 0.5], [7000, 0.5]] });
    expect(lo[0].rate).toBe(16000);
  });
});
