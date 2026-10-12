// หน้าทดลอง "F5 ในเบราว์เซอร์" (f5-lab.html · f5-calc.js · f5-engine.js · f5-worker.js)
// A) known-answer ของ f5-calc.js เทียบ tests/fixtures/f5-thai.json (ค่าจาก Colab): ขั้น 1 ข้อความ, 2 ข้อความเสียงตัวอย่าง, 3 vocab/text_ids, 5 ความยาว
//    + ตัดเงียบเสียงตัวอย่าง (−42 dBFS แบบ pydub + เงียบ 50 ms) / ท่อนที่สร้าง (−45 dB แบบ Colab) · แบ่งท่อนที่เกิน 4096 เฟรม · WAV · float16
// B) หน้าเว็บ — ไม่โหลดโมเดลจริง: onnxruntime-web ถูกแทนด้วยโมดูลหลอก (ตรวจชนิด/ชื่อ input ทุก run, นับ step 0..31) · ไฟล์โมเดลหลอกที่ /api/hf/ · .wasm หลอก
//    CI ไม่มี WebGPU (บังคับด้วยการลบ navigator.gpu ทั้งหน้าและ Worker) → ข้อความ + ปุ่ม CPU · โฮสต์ *.pages.dev จำลองด้วย --host-resolver-rules
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const C = require('../f5-calc.js');
const Norm = require('../tts-normalize.js');
const FX = require('./fixtures/f5-thai.json');

const PAGES_HOST = 'f5-test.pages.dev';
const BASE = `http://${PAGES_HOST}:8123`;
// pages.dev จริงเป็น https (secure context) — ให้ Chromium ถือโฮสต์จำลองเป็น secure ด้วย ไม่งั้นไม่มี Cache Storage
test.use({ launchOptions: { args: [`--host-resolver-rules=MAP ${PAGES_HOST} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${BASE}`] } });

/* ═══════════════ A) known-answer ═══════════════ */
test.describe('A) f5-calc.js known-answer (Colab)', () => {
  test('ขั้น 2: ข้อความเสียงตัวอย่างลงท้าย ". " · ซ้ำได้ไม่เติมซ้ำ · "." เติมช่องว่าง', () => {
    expect(C.refText(FX.ref_text_raw)).toBe(FX.ref_text);
    expect(C.refText(FX.ref_text)).toBe(FX.ref_text);
    expect(C.refText('ทดสอบ.')).toBe('ทดสอบ. ');
    expect(C.refText('  ทดสอบ\nสอง  ')).toBe('ทดสอบ สอง. ');
  });

  for (const c of FX.cases) {
    test(`ขั้น 1 + 5: ${c.input.slice(0, 24)}…`, () => {
      const items = C.planText(c.input, Norm);
      const norm = items.map((x) => x.norm).join(' ');
      expect(norm).toBe(c.norm);
      const frames = C.estFrames(norm, FX.ref_frames);
      expect(frames).toBe(c.frames); // สูตรเดียวกับ Colab ต้องตรงพอดี
      expect(Math.abs(frames - c.frames_colab) / c.frames_colab).toBeLessThanOrEqual(0.15); // ห่างจาก IPA จริงไม่เกิน 15%
      const full = C.fullText(FX.ref_text, norm);
      expect(full).toBe(FX.ref_text + '  ' + norm);
      expect(full.indexOf('ใหม่นะ.   ' + norm)).toBeGreaterThan(0); // เว้นวรรค 3 ช่อง
      const p = C.prepare(norm, FX.ref_text, FX.ref_frames);
      expect(p.maxDuration).toBe(Math.max(Math.max(Array.from(full).length, FX.ref_frames + 1) + 1, frames));
    });
  }

  test('ขั้น 1: ลบสัญลักษณ์ทุกตัว · ํา → ำ · " ๆ" → "ๆ" · trim · ท่อนว่างยกช่วงเงียบให้ท่อนก่อน', () => {
    expect(C.normChunk(' ก,.{}[]()-_?/\\|!*%$&@#^<>+";:~`=“”ข ')).toBe('กข');
    expect(C.normChunk('ทํางาน ๆ')).toBe('ทำงานๆ');
    expect(C.SYMBOLS).toBe(',.{}[]()-_?/\\|!*%$&@#^<>+-";:~`=“”');
    const items = C.planText('บรรทัดหนึ่ง\n\n---\n\nบรรทัดสอง', Norm);
    expect(items.map((x) => x.norm)).toEqual(['บรรทัดหนึ่ง', 'บรรทัดสอง']);
    expect(items[items.length - 1].gap).toBe(0);
    expect(items[0].gap).toBeGreaterThan(0);
  });

  test('ขั้น 3: vocab = บรรทัด → index (เหมือน Python char[:-1]) · ไม่มีใน vocab = 0', () => {
    const v = C.parseVocab(' \nก\nข\nำ\n');
    expect(v[' ']).toBe(0); expect(v['ก']).toBe(1); expect(v['ำ']).toBe(3);
    expect(Array.from(C.textIds('กข ำx', v))).toEqual([1, 2, 0, 3, 0]);
    expect(Object.keys(C.parseVocab('a\nb'))).toEqual(['a', '']); // บรรทัดท้ายไม่มี \n ถูกตัด 1 ตัวเหมือน Python
  });

  test('ขั้น 5: feats/สูตร · n < 50 คูณ 2 · max_duration', () => {
    expect(C.feats('ไก่ abc ')).toEqual([1, 1, 1, 0, 3, 2, 1]);
    expect(C.genFrames('ก')).toBe(Math.floor((1.728750122650088 + 0.5805508400533895) * 5) * 2);
    expect(C.maxDuration(10, 602, 700)).toBe(700);
    expect(C.maxDuration(900, 602, 700)).toBe(901);
  });

  test('ท่อนที่ max_duration > 4096 แบ่งครึ่งที่ช่องว่างจนพอดี · เสียงตัวอย่างยาวเกินไป = tooLong', () => {
    const items = [{ norm: 'สวัสดีครับ วันนี้อากาศดีมาก เหมาะกับการออกไปเดินเล่นที่สวนสาธารณะ', gap: 0.4 }];
    const ok = C.fitChunks(items, FX.ref_text, 602);
    expect(ok.length).toBe(1);
    const split = C.fitChunks(items, FX.ref_text, 3700);
    expect(split.length).toBeGreaterThan(1);
    expect(split.every((x) => x.maxDuration <= C.MAX_SIGNAL)).toBe(true);
    expect(split.map((x) => x.norm).join(' ')).toBe(items[0].norm);
    expect(split[split.length - 1].gap).toBe(0.4);
    expect(() => C.fitChunks(items, FX.ref_text, 4090)).toThrow(/max_duration/);
  });

  test('ขั้น 4: ตัดเงียบหัว-ท้าย < −42 dBFS (หัว 10 ms, ท้าย 1 ms) + เงียบ 50 ms · ref_frames = floor(n/256)', () => {
    const sr = 24000, x = new Float32Array(sr * 2);
    for (let i = 4800; i < 4800 + 24000; i++) x[i] = 0.3 * Math.sin(i / 5); // เงียบ 0.2 วิ · เสียง 1 วิ · เงียบ 0.8 วิ
    for (let i = 0; i < 4800; i++) x[i] = 0.001 * Math.sin(i); // −63 dBFS = เงียบ
    const y = C.trimRef(x, sr);
    expect(Math.abs(y.length - (24000 + 1200))).toBeLessThanOrEqual(24);
    expect(Array.from(y.subarray(y.length - 1200)).every((v) => v === 0)).toBe(true);
    expect(C.refFrames(154200)).toBe(602);
    expect(C.trimRef(new Float32Array(1000), sr).length).toBe(1200); // เงียบล้วน = เหลือแค่เงียบ 50 ms
  });

  test('ท่อนที่สร้าง: ตัดเงียบ −45 dB เฟรม 20 ms เว้น 50 ms (Colab trim) · ต่อด้วยช่วงเงียบ · WAV · float16', () => {
    const sr = 24000, x = new Float32Array(sr);
    for (let i = 12000; i < 14400; i++) x[i] = 0.5;
    const y = C.trimOut(x, sr);
    expect(y.length).toBe(2400 + 2 * 1200);
    const z = C.concat([new Float32Array(10), new Float32Array(20)], [0.5, 0.4], sr);
    expect(z.length).toBe(10 + 12000 + 20);
    const wav = new DataView(C.encodeWav(new Float32Array([0, 1, -1, 0.5]), sr));
    expect(wav.byteLength).toBe(44 + 8);
    expect(wav.getUint32(24, true)).toBe(sr);
    expect([wav.getInt16(44, true), wav.getInt16(46, true), wav.getInt16(48, true)]).toEqual([0, 32767, -32768]);
    const f = C.fromF16(C.toF16(new Float32Array([0, 1, -2.5, 65504, 0.1])));
    expect(Array.from(f).map((v) => +v.toFixed(3))).toEqual([0, 1, -2.5, 65504, 0.1]);
  });

  test('URL โมเดล = huggingface.co (คีย์แคช) · ขนาด', () => {
    expect(C.modelUrl('q4', 'F5_Transformer.onnx')).toBe('https://huggingface.co/Tanotfin/f5-tts-thai-v1-onnx/resolve/main/q4/F5_Transformer.onnx');
    expect(C.variantMb('q4')).toBe(323);
    expect(C.variantMb('fp16')).toBe(759);
    expect(C.CACHE_NAME).toBe('tanot-f5-models-v1');
  });

  test('sw.js ไม่ลบแคชโมเดล F5 ตอน bump CACHE · ไม่ลงแคชหลัก', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    expect(sw).toMatch(/const F5_CACHE_PREFIX = 'tanot-f5-models-';/);
    expect(C.CACHE_NAME.startsWith('tanot-f5-models-')).toBe(true);
    const act = sw.slice(sw.indexOf("addEventListener('activate'"), sw.indexOf("addEventListener('activate'") + 400);
    expect(act).toMatch(/!k\.startsWith\(F5_CACHE_PREFIX\)/);
    for (const f of ['f5-lab.html', 'f5-lab.js', 'f5-calc.js', 'f5-engine.js', 'f5-worker.js']) expect(sw).toContain("'./" + f + "'");
  });
});

/* ═══════════════ B) หน้าเว็บ ═══════════════ */
/* onnxruntime-web หลอก — ตรวจ input ของทุก run แล้วโยน error ถ้าผิด (หน้าแสดง error = เทสต์ล้ม) */
const FAKE_ORT = `
const md = (n, t) => ({ name: n, isTensor: true, type: t, shape: [] });
export const env = { wasm: {}, webgpu: {} };
const live = new Set(); // tensor บน "GPU" ที่ยังไม่ dispose
export class Tensor {
  constructor(type, data, dims) { this.type = type; this.data = data; this.dims = dims; this.location = 'cpu'; }
  async getData() { return this.data; }
  dispose() { live.delete(this); }
}
function need(c, m) { if (!c) throw new Error('fake-ort: ' + m); }
let step = 0, T = 0, REF = 0;
function out(sess, name, type, data, dims) {
  const p = sess.opts.preferredOutputLocation, loc = typeof p === 'string' ? p : (p && p[name]) || 'cpu';
  const t = new Tensor(type, data, dims); t.location = loc;
  if (loc === 'gpu-buffer') live.add(t);
  return t;
}
const gpu = (s) => s.opts.executionProviders[0] === 'webgpu';
const sessions = {
  pre: { inputNames: ['audio', 'text_ids', 'max_duration'],
    outputNames: ['noise', 'rope_cos', 'rope_sin', 'cat_mel_text', 'cat_mel_text_drop', 'ref_signal_len', 'rms_scale', 'ref_mel_tail'],
    inputMetadata: [md('audio', 'float32'), md('text_ids', 'int32'), md('max_duration', 'int64')],
    async run(f) {
      need(f.audio && f.audio.data instanceof Float32Array && f.audio.dims.length === 3 && f.audio.dims[2] === f.audio.data.length, 'audio [1,1,n] float32');
      need(f.text_ids.data instanceof Int32Array && f.text_ids.dims[0] === 1 && f.text_ids.dims[1] === f.text_ids.data.length, 'text_ids int32 [1,len]');
      need(f.max_duration.data instanceof BigInt64Array && f.max_duration.dims[0] === 1, 'max_duration int64 [1]');
      T = Number(f.max_duration.data[0]); REF = Math.floor(f.audio.data.length / 256); step = 0;
      need(T <= 4096 && T > REF, 'max_duration range');
      need(live.size === 0, 'gpu tensors of the previous chunk were not disposed: ' + live.size);
      const o = (n, t, d, dims) => out(this, n, t, d, dims);
      return { noise: o('noise', 'float32', new Float32Array(T * 100), [1, T, 100]), rope_cos: o('rope_cos', 'float32', new Float32Array(1), [2, 1, T, 64]),
        rope_sin: o('rope_sin', 'float32', new Float32Array(1), [2, 1, T, 64]), cat_mel_text: o('cat_mel_text', 'float32', new Float32Array(1), [1, T, 612]),
        cat_mel_text_drop: o('cat_mel_text_drop', 'float32', new Float32Array(1), [1, T, 612]), ref_signal_len: o('ref_signal_len', 'int64', BigInt64Array.of(BigInt(REF)), []),
        rms_scale: o('rms_scale', 'float32', Float32Array.of(1), [1]), ref_mel_tail: o('ref_mel_tail', 'float32', new Float32Array(100), [1, 1, 100]) };
    } },
  tr: { inputNames: ['noise', 'rope_cos', 'rope_sin', 'cat_mel_text', 'cat_mel_text_drop', 'time_step'], outputNames: ['denoised'],
    inputMetadata: [md('noise', 'float32'), md('time_step', 'int32')],
    async run(f) {
      need(f.time_step.data instanceof Int32Array && f.time_step.data[0] === step, 'time_step ' + step);
      for (const k of ['rope_cos', 'rope_sin', 'cat_mel_text', 'cat_mel_text_drop']) need(f[k] && f[k].dims[0], k);
      need(f.noise.dims[1] === T, 'noise T');
      if (gpu(this)) need(f.noise.location === 'gpu-buffer' && f.cat_mel_text.location === 'gpu-buffer' && live.has(f.noise), 'step input not on gpu / disposed too early');
      step++;
      return { denoised: out(this, 'denoised', 'float32', f.noise.data, f.noise.dims) };
    } },
  dec: { inputNames: ['denoised', 'ref_signal_len', 'rms_scale', 'ref_mel_tail'], outputNames: ['output_audio'], inputMetadata: [],
    async run(f) {
      need(step === 32, 'nfe 32 got ' + step);
      need(f.denoised.dims[1] === T && f.ref_signal_len.type === 'int64' && f.ref_mel_tail.dims[2] === 100, 'decode inputs');
      if (gpu(this)) need(f.denoised.location === 'gpu-buffer' && f.ref_signal_len.location === 'cpu', 'decode input locations');
      const n = (T - REF) * 256, a = new Float32Array(n);
      for (let i = 0; i < n; i++) a[i] = 0.3 * Math.sin(i / 6);
      return { output_audio: out(this, 'output_audio', 'float32', a, [1, 1, n]) };
    } }
};
export const InferenceSession = { async create(bytes, opts) {
  need(env.wasm.wasmBinary && env.wasm.wasmBinary.length > 0, 'wasmBinary set');
  need(opts.executionProviders && opts.executionProviders.length === 1, 'EP');
  const kind = new TextDecoder().decode(bytes).trim();
  const s = sessions[kind]; need(s, 'model bytes ' + kind);
  if (opts.executionProviders[0] === 'webgpu') need(kind === 'dec' ? opts.preferredOutputLocation === 'cpu' : kind === 'tr' ? opts.preferredOutputLocation === 'gpu-buffer' : opts.preferredOutputLocation.noise === 'gpu-buffer', 'preferredOutputLocation ' + kind);
  else need(!opts.preferredOutputLocation, 'cpu EP has no gpu outputs');
  return Object.assign({ async release() {}, opts }, s);
} };
export default { env, Tensor, InferenceSession };`;

const VOCAB = [' ', ...'กขคฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮะัาำิีึืุูเแโใไ็่้๊๋์.'].join('\n') + '\n';
const BODIES = { 'F5_Preprocess.onnx': 'pre', 'F5_Transformer.onnx': 'tr', 'F5_Decode.onnx': 'dec', 'vocab.txt': VOCAB };

function refWav() {
  const sr = 24000, x = new Float32Array(Math.round(sr * 3.6));
  for (let i = Math.round(sr * 0.3); i < Math.round(sr * 3.3); i++) x[i] = 0.3 * Math.sin(2 * Math.PI * 220 * i / sr);
  return Buffer.from(C.encodeWav(x, sr));
}

const FAKE_GPU = "{ requestAdapter: async () => ({ features: new Set(['shader-f16']), isFallbackAdapter: false, info: { vendor: 'fakevendor', architecture: 'fake-arch' } }) }";
async function setup(context, page, { hf = 200, worker = true, gpu = false } = {}) {
  const errors = [], hfReq = [], direct = [], wasm = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (process.env.F5_DEBUG) console.log('console', m.type(), m.text()); if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const workerSrc = fs.readFileSync(path.join(ROOT, 'f5-worker.js'), 'utf8');
  await context.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (/\/vendor\/transformers\/ort\.webgpu\.bundle\.min\.mjs$/.test(u.pathname)) return r.fulfill({ contentType: 'text/javascript', body: FAKE_ORT });
    // CI ไม่มี WebGPU — ทำให้แน่นอนใน Worker ด้วย (หน้าใช้ addInitScript)
    if (u.pathname === '/f5-worker.js') return r.fulfill({ contentType: 'text/javascript', body: "Object.defineProperty(WorkerNavigator.prototype, 'gpu', { get() { return " + (gpu ? FAKE_GPU : 'undefined') + "; } });\n" + workerSrc });
    if (u.hostname === 'cdn.jsdelivr.net' && /ort-wasm-simd-threaded\.asyncify\.wasm$/.test(u.pathname)) { wasm.push(u.href); return r.fulfill({ contentType: 'application/wasm', body: 'fake-wasm' }); }
    if (u.hostname === PAGES_HOST && u.pathname.startsWith('/api/hf/')) {
      const h = await r.request().allHeaders();
      hfReq.push({ path: u.pathname, cookie: h.cookie || '' });
      if (hf !== 200) return r.fulfill({ status: hf, contentType: 'application/json', body: '{}' });
      const m = /^\/api\/hf\/Tanotfin\/f5-tts-thai-v1-onnx\/resolve\/main\/(q4|fp16)\/([\w.]+)$/.exec(u.pathname);
      if (!m || !BODIES[m[2]]) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ status: 200, contentType: 'application/octet-stream', body: BODIES[m[2]] });
    }
    if (u.hostname === PAGES_HOST && u.pathname.startsWith('/api/')) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"test"}' });
    if (u.hostname === 'huggingface.co' || u.hostname === 'hf.co') { direct.push(u.href); return r.abort('internetdisconnected'); }
    if (u.hostname === PAGES_HOST || u.protocol === 'data:' || u.protocol === 'blob:') return r.continue();
    return r.abort('internetdisconnected');
  });
  await context.addCookies([{ name: 'CF_Authorization', value: 'test-jwt', url: BASE }]);
  await page.addInitScript(({ w, g }) => {
    try { localStorage.setItem('ome:theme', 'light'); } catch (e) {}
    const fake = g ? (0, eval)('(' + g + ')') : undefined;
    Object.defineProperty(Navigator.prototype, 'gpu', { get() { return fake; } });
    if (!w) delete window.Worker;
  }, { w: worker, g: gpu ? FAKE_GPU : null });
  return { errors, hfReq, direct, wasm };
}

async function useCpu(page) {
  await expect(page.locator('#cpuBtn')).toBeVisible();
  await page.click('#cpuBtn');
  const dlg = page.locator('dialog[open]');
  await expect(dlg).toContainText('CPU ช้ามาก');
  await dlg.getByRole('button', { name: 'ใช้ CPU' }).click();
  await expect(page.locator('#envText')).toContainText('กำลังใช้ CPU');
}

async function addVoice(page) {
  await page.click('#addVoice > summary');
  await page.setInputFiles('#vFile', { name: 'ref.wav', mimeType: 'audio/wav', buffer: refWav() });
  await page.fill('#vName', 'เสียงทดสอบ');
  await page.fill('#vText', FX.ref_text_raw);
  await page.click('#vSave');
  await expect(page.locator('#vStatus')).toHaveClass(/ok/);
  await expect(page.locator('#voiceList .list-row')).toHaveCount(1);
}

test.describe('B) หน้า f5-lab.html', () => {
  test('localhost ไม่มี WebGPU/ไม่มี /api/hf/: ข้อความชัดเจน + ลิงก์ Colab + ปุ่ม CPU · โหลดโมเดลไม่ได้ · ไม่มี error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'gpu', { get() { return undefined; } }); });
    await page.route('**/*', (r) => { const u = new URL(r.request().url()); return u.hostname === 'localhost' ? r.continue() : r.abort('internetdisconnected'); });
    await page.goto('/f5-lab.html');
    await expect(page.locator('#envMsg')).toBeVisible();
    await expect(page.locator('#envText')).toContainText('ใช้ WebGPU ไม่ได้');
    await expect(page.locator('#envText')).toContainText('เฉพาะบนเว็บหลัก');
    await expect(page.locator('#colabLink')).toHaveAttribute('href', 'text-to-speech.html#f5Card');
    await expect(page.locator('#cpuBtn')).toBeVisible();
    await expect(page.locator('#loadBtn')).toBeDisabled();
    await expect(page.locator('#needSize')).toContainText('349'); // q4 323 + .wasm 26
    await expect(page.locator('#voiceEmpty')).toBeVisible();
    // สลับภาษาสด
    await page.evaluate(() => OME_LANG.set('en'));
    await expect(page.locator('#envText')).toContainText('cannot use WebGPU');
    await expect(page.locator('h1')).toHaveText('F5 in the browser');
    expect(errors).toEqual([]);
  });

  for (const worker of [true, false]) {
    test(`pages.dev (${worker ? 'Worker' : 'เธรดหลัก'}): โมเดลผ่าน /api/hf/ เท่านั้น → แคช · เสียงตัวอย่างใน IndexedDB · สร้างทีละท่อน 32 step · WAV · ผลวัด/problem log ไม่มีข้อความผู้ใช้ · เปิดใหม่ไม่โหลดจากเน็ต`, async ({ context, page }) => {
      const { errors, hfReq, direct, wasm } = await setup(context, page, { worker });
      await page.goto(BASE + '/f5-lab.html');
      await expect(page.locator('#envText')).toContainText('ใช้ WebGPU ไม่ได้');
      await useCpu(page);
      await addVoice(page);
      // เสียงตัวอย่างอยู่ใน IndexedDB ของเครื่องนี้เท่านั้น — ไม่อยู่ใน snapshot ที่ใช้สำรอง/ย้าย
      const snap = await page.evaluate(() => TanotData.snapshot().then((s) => Object.keys(s.idb).concat(Object.keys(s.ls))));
      expect(snap.some((k) => /f5/.test(k))).toBe(false);
      const SECRET = 'ประโยคลับเฉพาะ ทดสอบเสียงหนึ่ง\n\nย่อหน้าที่สอง ราคา 1,250 บาท';
      await page.fill('#genText', SECRET);
      await page.click('#genBtn');
      await expect(page.locator('#genStatus')).toHaveClass(/ok/, { timeout: 30000 });
      await expect(page.locator('#genStatus')).toContainText('เสร็จ 2 ท่อน');
      await expect(page.locator('#wavBtn')).toBeVisible();
      const wavHead = await page.evaluate(() => fetch(document.getElementById('wavBtn').href).then((r) => r.arrayBuffer()).then((b) => { const d = new DataView(b); return [String.fromCharCode(d.getUint8(0), d.getUint8(1), d.getUint8(2), d.getUint8(3)), d.getUint32(24, true), b.byteLength]; }));
      expect(wavHead[0]).toBe('RIFF'); expect(wavHead[1]).toBe(24000); expect(wavHead[2]).toBeGreaterThan(44 + 24000);
      // ไฟล์โมเดลทั้ง 4 ผ่าน /api/hf/ พร้อมคุกกี้ · ไม่มีคำขอไป huggingface.co ตรง · .wasm โหลด 1 ครั้ง
      expect(hfReq.map((h) => h.path).sort()).toEqual(['F5_Decode.onnx', 'F5_Preprocess.onnx', 'F5_Transformer.onnx', 'vocab.txt'].map((f) => '/api/hf/Tanotfin/f5-tts-thai-v1-onnx/resolve/main/q4/' + f));
      expect(hfReq.every((h) => /CF_Authorization=test-jwt/.test(h.cookie))).toBe(true);
      expect(direct).toEqual([]);
      expect(wasm.length).toBe(1);
      // ผลวัด
      const stats = await page.locator('#stats').innerText();
      expect(stats).toContain('wasm');
      expect(stats).toContain(worker ? 'Worker' : 'หน้าเว็บ');
      const log = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));
      const f5 = log.filter((r) => r.kind === 'f5');
      expect(f5.some((r) => r.stage === 'stats' && /chunks=2/.test(r.msg) && /rtf=/.test(r.msg))).toBe(true);
      expect(JSON.stringify(log)).not.toContain('ประโยคลับ');
      expect(JSON.stringify(log)).not.toContain(FX.ref_text_raw.slice(0, 10));
      await expect(page.locator('#cachedSize')).toContainText('ครบ');
      // เปิดหน้าใหม่: โมเดลมาจากแคช ไม่มีคำขอใหม่
      const before = hfReq.length;
      await page.reload();
      await useCpu(page);
      await page.click('#loadBtn');
      await expect(page.locator('#modelStatus')).toContainText('จากเครื่อง', { timeout: 15000 });
      expect(hfReq.length).toBe(before);
      expect(wasm.length).toBe(1);
      // ลบโมเดล → แคชว่าง
      await page.click('#clearBtn');
      await page.locator('dialog[open]').getByRole('button', { name: 'ลบโมเดลที่โหลดไว้' }).click();
      await expect(page.locator('#modelStatus')).toContainText('ลบโมเดลแล้ว');
      await expect(page.locator('#cachedSize')).toHaveText('ยังไม่มี');
      expect(await page.evaluate(() => caches.has('tanot-f5-models-v1'))).toBe(false);
      // ลบเสียงตัวอย่าง
      await page.locator('#voiceList .list-row .btn.icon').click();
      await page.locator('dialog[open] .btn.danger').click();
      await expect(page.locator('#voiceEmpty')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('WebGPU (จำลอง): ปุ่มโหลดใช้ได้ทันที · tensor ระหว่าง step อยู่บน GPU (preferredOutputLocation) และถูก dispose ทุกท่อน · ผลวัดบอก adapter/shader-f16', async ({ context, page }) => {
    const { errors, hfReq } = await setup(context, page, { gpu: true });
    await page.goto(BASE + '/f5-lab.html');
    await expect(page.locator('#loadBtn')).toBeEnabled();
    await expect(page.locator('#envMsg')).toBeHidden();
    await expect(page.locator('#cpuBtn')).toBeHidden();
    await addVoice(page);
    await page.fill('#genText', 'ทดสอบหนึ่ง\n\nทดสอบสอง\n\nทดสอบสาม');
    await page.click('#genBtn');
    await expect(page.locator('#genStatus')).toHaveClass(/ok/, { timeout: 30000 });
    await expect(page.locator('#genStatus')).toContainText('เสร็จ 3 ท่อน');
    const stats = await page.locator('#stats').innerText();
    for (const s of ['webgpu', 'fakevendor', 'อยู่บน GPU', 'Worker']) expect(stats).toContain(s);
    expect(hfReq.length).toBe(4);
    expect(errors).toEqual([]);
  });

  for (const hf of [401, 403]) {
    test(`เซสชันหมดอายุ (/api/hf/ → ${hf}): ข้อความ "เข้าสู่ระบบใหม่" + ถาม → ?relogin=1 · problem log code session`, async ({ context, page }) => {
      const { errors, hfReq } = await setup(context, page, { hf });
      await page.goto(BASE + '/f5-lab.html');
      await useCpu(page);
      await page.click('#loadBtn');
      await expect(page.locator('#modelStatus')).toHaveClass(/err/, { timeout: 15000 });
      await expect(page.locator('#modelStatus')).toContainText('เซสชันหมดอายุ');
      expect(hfReq.length).toBe(1); // ไม่ลองซ้ำ
      const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));
      expect(rows.filter((r) => r.kind === 'f5' && r.code === 'session').length).toBe(1);
      const dlg = page.locator('dialog[open]');
      await Promise.all([page.waitForURL(/[?&]relogin=1/), dlg.getByRole('button', { name: 'เข้าสู่ระบบใหม่' }).click()]);
      expect(new URL(page.url()).pathname).toMatch(/\/f5-lab(\.html)?$/);
      expect(errors).toEqual([]);
    });
  }
});

/* ═══════════════ C) ตัวตรวจธีม/ภาษา/มือถือตอนมีข้อมูล (เป้า = 0 ทุกตัวชี้วัด) ═══════════════ */
const AUDIT_JS = path.join(__dirname, 'theme-audit-page.js');
const AXE_JS = require.resolve('axe-core/axe.min.js');
async function measure(page, width) {
  await page.addScriptTag({ path: AUDIT_JS });
  const res = await page.evaluate((m) => window.__tanotAudit.audit({ mobile: m }), width < 700);
  const out = { contrast: res.contrast, controlBorder: res.controlBorder, nonCentral: res.nonCentral };
  await page.addScriptTag({ path: AXE_JS });
  out.axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations'] });
    return (r.violations || []).flatMap((v) => v.nodes.map((n) => (n.target || []).join(' ')));
  });
  if (width < 700) { out.targetSize = res.targetSize; Object.assign(out, await page.evaluate(() => window.__tanotAudit.mobile({ shell: false }))); }
  const bad = {};
  Object.keys(out).forEach((k) => { if (out[k] && out[k].length) bad[k] = out[k].slice(0, 6); });
  return bad;
}
async function thaiLeak(page) {
  return page.evaluate(() => {
    const THAI = /[฀-฾เ-๿]/, out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      const p = t.parentElement;
      if (!THAI.test(t.nodeValue) || !p || p.closest('script,style,[data-i18n-skip],.ome-nav,footer.ome-footer,.ome-ai-fab,.ome-ai-panel,textarea')) continue;
      const r = p.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && t.nodeValue.trim() !== 'ไทย') out.push((p.id || p.tagName) + ' → ' + t.nodeValue.trim().slice(0, 40));
    }
    return out;
  });
}

test.describe('C) f5-lab.html ตอนมีข้อมูล — ตัวตรวจธีม/มือถือ/ภาษา', () => {
  for (const width of [360, 390, 1100]) {
    for (const theme of ['light', 'dark']) {
      test(`${width}|${theme}`, async ({ context, page }) => {
        const { errors } = await setup(context, page, { gpu: true });
        await page.addInitScript((t) => { try { localStorage.setItem('ome:theme', t); } catch (e) {} }, theme);
        await page.setViewportSize({ width, height: 800 });
        await page.goto(BASE + '/f5-lab.html');
        await addVoice(page);
        await page.fill('#genText', 'ทดสอบหนึ่ง\n\nทดสอบสอง');
        await page.click('#genBtn');
        await expect(page.locator('#genStatus')).toHaveClass(/ok/, { timeout: 30000 });
        await page.evaluate(() => document.fonts && document.fonts.ready);
        const bad = {};
        bad.done = await measure(page, width);
        if (process.env.F5_SHOTS) await page.screenshot({ path: path.join(process.env.F5_SHOTS, `f5-${width}-${theme}.png`), fullPage: true }); // ดูด้วยตา
        // กล่องเพิ่มเสียงกางอยู่ + เตือนเสียงยาว · ข้อความ WebGPU ใช้ไม่ได้ + ปุ่ม CPU/Colab
        await page.click('#addVoice > summary');
        await page.evaluate(() => { const s = document.getElementById('vStatus'); s.className = 'status warn'; s.textContent = 'x'; document.getElementById('envMsg').hidden = false; document.getElementById('envText').textContent = 'x'; document.getElementById('cpuBtn').hidden = false; document.getElementById('colabLink').hidden = false; });
        bad.form = await measure(page, width);
        // กล่องยืนยันลบโมเดล
        await page.click('#clearBtn');
        await page.addStyleTag({ content: 'body > *:not(dialog[open]){visibility:hidden !important}' });
        bad.dialog = await measure(page, width);
        Object.keys(bad).forEach((k) => { if (!Object.keys(bad[k]).length) delete bad[k]; });
        expect(bad).toEqual({});
        expect(errors).toEqual([]);
      });
    }
  }

  test('EN: ไม่มีภาษาไทยหลุด (ยกเว้นข้อมูลผู้ใช้) · สลับ th → en → th สด', async ({ context, page }) => {
    const { errors } = await setup(context, page, { gpu: true });
    await page.goto(BASE + '/f5-lab.html');
    await addVoice(page);
    await page.fill('#genText', 'ทดสอบหนึ่ง');
    await page.click('#genBtn');
    await expect(page.locator('#genStatus')).toHaveClass(/ok/, { timeout: 30000 });
    await page.click('#addVoice > summary');
    await page.evaluate(() => OME_LANG.set('en'));
    await expect(page.locator('#genStatus')).toContainText('Done: 1 chunks');
    expect(await thaiLeak(page)).toEqual([]);
    await page.evaluate(() => OME_LANG.set('th'));
    await expect(page.locator('#genStatus')).toContainText('เสร็จ 1 ท่อน');
    await expect(page.locator('#stats')).toContainText('อยู่บน GPU');
    expect(errors).toEqual([]);
  });
});
