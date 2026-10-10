// ถอดเสียงในเบราว์เซอร์ (2026-10): ตัดท่อน ≤ 30 วิที่ฝั่งหน้า (AsrCalc.planChunks) + ต่อด้วย AsrCalc.mergeChunks แทนการต่อท่อนภายใน pipeline (chunk_length_s / stride_length_s)
// สาเหตุที่เปลี่ยน: ถอดเสียงไฟล์ 3 นาทีด้วย Thonburian small บน WebGPU แล้วข้อความ "ซ้ำ" 3 จุดตรงรอยต่อ ~30 วิ (ประโยคส่วนที่ 1 ออกมาสองรอบ)
// CI ห้ามโหลดโมเดลจริง: transformers.js หลอก — "Whisper" ตัวหลอกอ่านระดับแอมพลิจูดของเสียงเพื่อรู้ว่าท่อนนี้ครอบคลุมประโยคไหน แล้วถอดทุกประโยคที่ท่อนครอบคลุมอยู่ ≥ 0.5 วิ
// (ประโยคที่คร่อมรอยต่อ/อยู่ในส่วนเหลื่อม 1.5 วิ จึงโผล่ทั้งท้ายท่อนก่อนและต้นท่อนถัดไป — เหมือน pipeline จริงที่ซ้ำ) · ข้อความตัวอย่างแต่งเอง
const { test, expect } = require('@playwright/test');

const TH_SMALL = 'Tanotfin/distill-whisper-th-small-onnx';
const SENT = (k) => 'ประโยคที่ ' + (k + 1) + ' เป็นข้อความทดสอบ';   // 22–25 ตัวอักษรหลังตัดวรรคตอน — สั้นกว่าเพดานรอยต่อ 47 ตัว (AsrCalc.MAX_SEAM_CHARS) เหมือนคำพูดในส่วนเหลื่อม 1.5 วิ
const SLOT = 3.5, TONE = 3.0;                                     // ค่าเริ่มต้น: ประโยคละ 3.0 วิ เว้นเงียบ 0.5 วิ → ช่องเงียบทุก 3.5 วิ (จุดตัดที่เงียบที่สุดจึงอยู่ในช่องเงียบ)

function fakeTransformers(cfg) {
  return `
const CFG = ${JSON.stringify(cfg || {})};
export const env = { backends: { onnx: { wasm: {} } } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function busy(ms) { const t = Date.now(); while (Date.now() - t < ms) {} }
const SENT = (k) => 'ประโยคที่ ' + (k + 1) + ' เป็นข้อความทดสอบ';
let calls = 0;
export async function pipeline(task, model, opts) {
  const device = (opts && opts.device) || 'wasm';
  self.postMessage({ type: 'fake-load', model, device, t: Date.now() });
  const NF = CFG.netFail || {}, cnt = (self.__nf = self.__nf || {});
  if (NF[model] != null) { cnt[model] = (cnt[model] || 0) + 1; if (cnt[model] <= NF[model]) throw new TypeError('network error'); }
  if ((CFG.missing || []).includes(model)) throw new Error('Could not locate file: "https://huggingface.co/' + model + '/resolve/main/onnx/encoder_model_quantized.onnx" (404).');
  if (opts && opts.progress_callback) opts.progress_callback({ status: 'progress', file: 'onnx/model.onnx', progress: 50 });
  const f = async (pcm, o) => {
    calls++;
    if (device === 'webgpu' && CFG.gpuRunFail) throw new Error('GPUBuffer mapAsync failed: device lost');
    busy(CFG.busyMs || 0);
    if (CFG.oomAt && calls === CFG.oomAt) throw new RangeError('Out of memory');
    // อ่านระดับเสียงทีละหน้าต่าง 0.25 วิ → หมายเลขประโยค k (แอมพลิจูด 0.05 + 0.01k) · หน้าต่างที่ระดับไม่ตรงสัก k (ขอบเงียบ) ข้าม
    const W = 4000, found = new Map();
    for (let s = 0; s < pcm.length; s += W) {
      const e = Math.min(pcm.length, s + W); let sum = 0;
      for (let i = s; i < e; i++) sum += pcm[i] * pcm[i];
      const amp = Math.sqrt(sum / (e - s)) * Math.SQRT2, k = Math.round((amp - 0.05) / 0.01);
      if (k < 0 || Math.abs(amp - (0.05 + 0.01 * k)) > 0.003) continue;
      const cur = found.get(k) || { first: s, last: e, n: 0 };
      cur.last = e; cur.n += (e - s); found.set(k, cur);
    }
    const sentences = [...found.entries()].filter(([, v]) => v.n >= 8000).sort((a, b) => a[1].first - b[1].first); // ครอบคลุม ≥ 0.5 วิ
    self.postMessage({ type: 'fake-asr', n: pcm.length, keys: Object.keys(o || {}), ts: !!(o && o.return_timestamps), language: (o && o.language) || null, device, sentences: sentences.map(([k]) => k) });
    const r = { text: sentences.map(([k]) => SENT(k)).join(' ') };
    if (o && o.return_timestamps) r.chunks = sentences.map(([k, v]) => ({ timestamp: [v.first / 16000, v.last / 16000], text: SENT(k) }));
    return r;
  };
  f.dispose = async () => {};
  return f;
}`;
}

/* WAV 16 kHz โมโน: N ประโยค (ประโยคละ 3.0 วิ ระดับ 0.05 + 0.01k) คั่นเงียบ 0.5 วิ */
function wavSentences(n, { tail = 0, slot = SLOT } = {}) {
  const rate = 16000, total = Math.round(rate * (n * slot + tail)), pcm = Buffer.alloc(44 + total * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + total * 2, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(rate, 24);
  pcm.writeUInt32LE(rate * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(total * 2, 40);
  for (let k = 0; k < n; k++) {
    const a = 0.05 + 0.01 * k, from = Math.round(k * slot * rate), to = Math.round((k * slot + TONE) * rate);
    for (let i = from; i < to; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 7) * a * 32767), 44 + i * 2);
  }
  return pcm;
}
const GPU_STUB = `Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({ features: new Set(['shader-f16']), isFallbackAdapter: false }) } });`;

const SPY = `(() => {
  const W = window.Worker;
  window.__wlog = []; window.__fake = [];
  function Spy(url, opts) {
    const w = new W(url, opts);
    const rec = { url: String(url), end: null, posts: [] };
    window.__wlog.push(rec);
    const post = w.postMessage.bind(w);
    w.postMessage = function (m, tr) { rec.posts.push(m && m.type); return post(m, tr); };
    const term = w.terminate.bind(w);
    w.terminate = function () { if (rec.end == null) rec.end = performance.now(); return term(); };
    w.addEventListener('message', (e) => { const d = e.data; if (d && /^fake-/.test(d.type)) window.__fake.push(d); });
    return w;
  }
  Spy.prototype = W.prototype;
  window.Worker = Spy;
})();`;

async function setup(context, page, { cfg, model, gpu } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (/\/vendor\/transformers\/transformers\.web\.min\.js$/.test(u.pathname)) return route.fulfill({ contentType: 'text/javascript', body: fakeTransformers(cfg) });
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort('internetdisconnected');
  });
  await page.addInitScript(SPY);
  await page.addInitScript((g) => {
    try { localStorage.setItem('ome:theme', 'light'); localStorage.setItem('tanot:asr:engine', 'local'); localStorage.setItem('tanot:asr:lang', 'auto'); } catch (e) {}
    if (g) (0, eval)(g);
  }, gpu ? GPU_STUB : '');
  return errors;
}
const logRows = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));
const fake = (page, type) => page.evaluate((t) => window.__fake.filter((m) => m.type === t), type);
async function run(page, buf, model) {
  await page.goto('/text-to-speech.html');
  if (model) await page.selectOption('#asrModel', model);
  await page.setInputFiles('#asrFile', { name: 'meeting.wav', mimeType: 'audio/wav', buffer: buf });
  await page.click('#asrGoBtn');
}
const done = (page, re = /ok/) => expect(page.locator('#asrStatus')).toHaveClass(re, { timeout: 60000 });

test.describe('ถอดเสียงในเบราว์เซอร์: ตัดท่อนเอง ≤ 30 วิ + ต่อด้วย mergeChunks (ไม่มีประโยคซ้ำที่รอยต่อ)', () => {
  const N = 20;                                  // 70 วิ → 3 ท่อน (จุดตัดราว 24 / 48 วิ)
  test('pipeline หลอกถอดประโยคท้ายท่อนก่อนซ้ำที่ต้นท่อนถัดไป → ผลรวมแต่ละประโยคมีครั้งเดียว ลำดับถูก · ไม่ส่ง chunk_length_s/stride_length_s · ทุกท่อน ≤ 30 วิ · ขอ timestamps', async ({ context, page }) => {
    const errors = await setup(context, page);
    await run(page, wavSentences(N), 'Xenova/whisper-base');
    await done(page);
    const calls = await fake(page, 'fake-asr');
    expect(calls.length).toBeGreaterThanOrEqual(3); expect(calls.length).toBeLessThanOrEqual(4);
    for (const c of calls) {
      expect(c.n).toBeLessThanOrEqual(30 * 16000);
      expect(c.keys).not.toContain('chunk_length_s'); expect(c.keys).not.toContain('stride_length_s');
      expect(c.keys).toEqual(expect.arrayContaining(['task', 'no_repeat_ngram_size', 'return_timestamps']));
      expect(c.ts).toBe(true);
    }
    // ฉากที่ทดสอบจริง: ประโยคท้ายท่อนก่อน = ประโยคแรกของท่อนถัดไป (ซ้ำที่รอยต่อ) อย่างน้อย 2 รอยต่อ
    let seams = 0;
    for (let i = 1; i < calls.length; i++) if (calls[i - 1].sentences.at(-1) === calls[i].sentences[0]) seams++;
    expect(seams).toBeGreaterThanOrEqual(2);
    const text = await page.inputValue('#asrResult');
    let last = -1;
    for (let k = 0; k < N; k++) {
      const m = text.match(new RegExp('ประโยคที่ ' + (k + 1) + '(?!\\d) เป็นข้อความทดสอบ', 'g'));
      expect(m ? m.length : 0, 'ประโยคที่ ' + (k + 1)).toBe(1);   // ไม่ซ้ำ ไม่หาย
      const at = text.indexOf(SENT(k)); expect(at, 'ลำดับประโยคที่ ' + (k + 1)).toBeGreaterThan(last); last = at;
    }
    expect(errors).toEqual([]);
  });

  test('เวลาของ segments เป็นเวลาจริงในไฟล์ (เลื่อนตามออฟเซ็ตท่อน ไม่ใช่เวลาสัมพัทธ์ของท่อน) → ป้าย [hh:mm:ss] ของแต่ละย่อหน้าตรงกับตำแหน่งประโยคในไฟล์', async ({ context, page }) => {
    await setup(context, page);
    // ประโยคละ 3 วิ คั่นเงียบ 2 วิ (ช่องเงียบ ≥ 1.6 วิ → ขึ้นย่อหน้าใหม่ได้) → ประโยคที่ k เริ่มที่ k × 5 วิ · 18 ประโยค = 90 วิ → 4 ท่อน
    await run(page, wavSentences(18, { slot: 5 }), 'Xenova/whisper-base');
    await done(page);
    await page.check('#asrTimeChk');
    const text = await page.inputValue('#asrResult');
    const stamps = [...text.matchAll(/\[(\d\d):(\d\d):(\d\d)\]/g)].map((m) => +m[1] * 3600 + +m[2] * 60 + +m[3]);
    expect(stamps.length).toBeGreaterThanOrEqual(4);
    expect(stamps[0]).toBe(0);
    for (let i = 1; i < stamps.length; i++) expect(stamps[i]).toBeGreaterThan(stamps[i - 1]);
    expect(stamps.at(-1)).toBeGreaterThan(50);                       // ถ้าเป็นเวลาสัมพัทธ์ของท่อน จะไม่เกิน ~30
    for (const t of stamps) { const near = Math.round(t / 5) * 5; expect(Math.abs(t - near), '[' + t + ']').toBeLessThanOrEqual(1); } // เริ่มย่อหน้าที่จุดเริ่มประโยค (k × 5 วิ)
    for (let k = 0; k < 18; k++) expect((text.match(new RegExp('ประโยคที่ ' + (k + 1) + '(?!\\d) เป็นข้อความทดสอบ', 'g')) || []).length).toBe(1);
  });

  test('ไฟล์สั้น ≤ 25 วิ → ท่อนเดียว (ไม่เหลื่อม ไม่ต่อ) · ผลเหมือนเดิม', async ({ context, page }) => {
    await setup(context, page);
    await run(page, wavSentences(5), 'Xenova/whisper-base');
    await done(page);
    expect((await fake(page, 'fake-asr')).length).toBe(1);
    const text = await page.inputValue('#asrResult');
    for (let k = 0; k < 5; k++) expect(text).toContain(SENT(k));
  });

  test('ความคืบหน้าแสดงเป็นท่อน i/n ("กำลังถอดเสียงท่อนที่ i/n…")', async ({ context, page }) => {
    await setup(context, page, { cfg: { busyMs: 1200 } });
    await run(page, wavSentences(N), 'Xenova/whisper-base');
    await expect(page.locator('#asrStatus')).toContainText(/กำลังถอดเสียงท่อนที่ \d+\/\d+…/, { timeout: 30000 });
    await expect(page.locator('#asrStatus')).toContainText(/ท่อนที่ [12]\/[34]/);
    await page.click('#asrCancelBtn');
  });

  test('Thonburian (บังคับ language=thai) ใช้การตัดท่อนแบบเดียวกัน · ไม่ซ้ำเช่นกัน', async ({ context, page }) => {
    await setup(context, page);
    await run(page, wavSentences(N), TH_SMALL);
    await done(page);
    const calls = await fake(page, 'fake-asr');
    expect(calls.every((c) => c.language === 'thai' && !c.keys.includes('chunk_length_s'))).toBe(true);
    const text = await page.inputValue('#asrResult');
    for (let k = 0; k < N; k++) expect((text.match(new RegExp('ประโยคที่ ' + (k + 1) + '(?!\\d) เป็นข้อความทดสอบ', 'g')) || []).length).toBe(1);
  });

  test('ยกเลิกกลางทาง: ไม่ส่งท่อนที่เหลือ · Worker ถูกปิด · ไม่บันทึกเป็นปัญหา', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { busyMs: 2500 } });
    await run(page, wavSentences(N), 'Xenova/whisper-base');
    await expect.poll(async () => (await fake(page, 'fake-asr')).length, { timeout: 30000 }).toBeGreaterThanOrEqual(1);
    await page.click('#asrCancelBtn');
    await expect(page.locator('#asrStatus')).toHaveText('ยกเลิกแล้ว');
    const posted = await page.evaluate(() => window.__wlog.find((w) => /asr-worker/.test(w.url)).posts.filter((p) => p === 'transcribe').length);
    await page.waitForTimeout(3500);
    expect(await page.evaluate(() => window.__wlog.find((w) => /asr-worker/.test(w.url)).posts.filter((p) => p === 'transcribe').length)).toBe(posted);
    expect(posted).toBeLessThan(3);
    expect(await page.evaluate(() => window.__wlog.find((w) => /asr-worker/.test(w.url)).end)).not.toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('tanot:media:log'))).toBeNull();
    expect(errors).toEqual([]);
  });

  test('หน่วยความจำไม่พอที่ท่อนที่ 2 → ข้อความอ่านเข้าใจ · หยุดส่งท่อนต่อไป · Worker ถูกปิด · log oom ไม่มีเนื้อหา', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { oomAt: 2 } });
    await run(page, wavSentences(N), 'Xenova/whisper-base');
    await done(page, /err/);
    await expect(page.locator('#asrStatus')).toContainText('หน่วยความจำ');
    expect((await fake(page, 'fake-asr')).length).toBe(1);   // ท่อนที่ 1 สำเร็จ · ท่อนที่ 2 ล้ม (ไม่ได้ส่ง fake-asr) · ไม่มีท่อนที่ 3
    expect(await page.evaluate(() => window.__wlog.find((w) => /asr-worker/.test(w.url)).posts.filter((p) => p === 'transcribe').length)).toBe(2);
    expect(await page.evaluate(() => window.__wlog.find((w) => /asr-worker/.test(w.url)).end)).not.toBeNull();
    const log = await logRows(page);
    expect(log.length).toBe(1);
    expect(log[0]).toMatchObject({ kind: 'asr', code: 'oom', engine: 'local' });
    expect(JSON.stringify(log)).not.toContain('ประโยคที่');
    expect(errors).toEqual([]);
  });

  test('WebGPU ล้มตอนรันที่ท่อนแรก → ถอย WASM 1 ครั้ง ถอดครบทุกท่อนไม่ซ้ำ · log 1 แถว · ท่อนที่เหลือไม่ลอง WebGPU อีก', async ({ context, page }) => {
    const errors = await setup(context, page, { gpu: true, cfg: { gpuRunFail: true } });
    await run(page, wavSentences(N), 'onnx-community/whisper-small');
    await done(page);
    const calls = await fake(page, 'fake-asr');
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(calls.every((c) => c.device === 'wasm')).toBe(true);
    const loads = await fake(page, 'fake-load');
    expect(loads.filter((l) => l.device === 'webgpu').length).toBe(1);
    const text = await page.inputValue('#asrResult');
    for (let k = 0; k < N; k++) expect((text.match(new RegExp('ประโยคที่ ' + (k + 1) + '(?!\\d) เป็นข้อความทดสอบ', 'g')) || []).length).toBe(1);
    const log = await logRows(page);
    expect(log.length).toBe(1);
    expect(log[0]).toMatchObject({ kind: 'asr', code: 'webgpu', stage: 'webgpu-run' });
    expect(errors).toEqual([]);
  });
});

test.describe('ถอดเสียงในเบราว์เซอร์: เครือข่ายสะดุดตอนโหลดโมเดล → ลองใหม่ 1 ครั้งก่อนทางถอย', () => {
  const SHORT = () => wavSentences(2);
  const loads = (page) => fake(page, 'fake-load');
  const rows = async (page) => (await logRows(page)).filter((r) => r.kind === 'asr');

  test('ล้มด้วย TypeError: network error 1 ครั้ง → รอ ≥ 1.4 วิ ลองใหม่ → ผ่าน · ไม่ถอย · log: แถว load-retry (code info) เท่านั้น', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { netFail: { 'Xenova/whisper-base': 1 } } });
    await run(page, SHORT(), 'Xenova/whisper-base');
    await done(page);
    const ls = await loads(page);
    expect(ls.map((l) => l.model)).toEqual(['Xenova/whisper-base', 'Xenova/whisper-base']);
    expect(ls[1].t - ls[0].t).toBeGreaterThanOrEqual(1400); expect(ls[1].t - ls[0].t).toBeLessThan(8000);
    expect(await page.inputValue('#asrResult')).toContain(SENT(0));
    const r = await rows(page);
    expect(r.map((x) => [x.code, x.stage, x.model, x.engine])).toEqual([['info', 'load-retry', 'Xenova/whisper-base', 'local']]);
    expect(r[0].msg).toBe('retry=1 network');
    expect(errors).toEqual([]);
  });

  test('ล้มซ้ำหลังลองใหม่ (Thonburian) → ถอยไปรุ่นเทียบเท่า Xenova/whisper-small · โหลด th-small 2 ครั้ง + legacy 1 ครั้ง · log: ลองซ้ำ 1 + ถอยรุ่น 1', async ({ context, page }) => {
    await setup(context, page, { cfg: { netFail: { [TH_SMALL]: 2 } } });
    await run(page, SHORT(), TH_SMALL);
    await done(page);
    expect((await loads(page)).map((l) => l.model)).toEqual([TH_SMALL, TH_SMALL, 'Xenova/whisper-small']);
    const r = await rows(page);
    expect(r.map((x) => [x.code === 'info' ? 'info' : 'err', x.stage])).toEqual([['info', 'load-retry'], ['err', 'model-load']]);
    expect(await page.inputValue('#asrResult')).toContain(SENT(0));
  });

  test('ล้มซ้ำและไม่มีรุ่นให้ถอย (Xenova/whisper-base) → แจ้ง error · โหลดแค่ 2 ครั้ง (ไม่วนซ้ำ) · log: ลองซ้ำ + ข้อผิดพลาด', async ({ context, page }) => {
    await setup(context, page, { cfg: { netFail: { 'Xenova/whisper-base': 2 } } });
    await run(page, SHORT(), 'Xenova/whisper-base');
    await done(page, /err/);
    expect((await loads(page)).length).toBe(2);
    const r = await rows(page);
    expect(r.map((x) => x.code === 'info' ? 'info:' + x.stage : 'err')).toEqual(['info:load-retry', 'err']);
  });

  test('404 (ไม่ใช่เครือข่าย) ไม่ลองซ้ำ → ถอยรุ่นทันที · ไม่มีแถว load-retry', async ({ context, page }) => {
    await setup(context, page, { cfg: { missing: [TH_SMALL] } });
    await run(page, SHORT(), TH_SMALL);
    await done(page);
    expect((await loads(page)).map((l) => l.model)).toEqual([TH_SMALL, 'Xenova/whisper-small']);
    expect((await rows(page)).filter((x) => x.stage === 'load-retry')).toEqual([]);
  });
});
