// งานปรับปรุงเสียง/OCR Section 1 "ไม่ให้ล่ม" — media-core.js, asr-worker.js, tts-worker.js (พูล), audio-encode-worker.js, วิดเจ็ตแชท, data.html (บันทึกปัญหา)
// CI ห้ามโหลดโมเดลจริง: vendor/transformers/transformers.web.min.js ถูก route เป็นโมดูลหลอก (fakeTransformers) ที่จำลอง
// โหลดช้า / คืนผลปกติ / โยน RangeError('Out of memory') / Worker พัง (error ที่ไม่มีใคร catch) — route ของ page ครอบ import() ใน Worker ด้วย
const { test, expect } = require('@playwright/test');

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

/* โมดูลหลอกของ transformers.js — cfg: { asr|tts|chat: { loadMs, busyMs, mode:'ok'|'oom'|'crash', text } } · busyMs = คำนวณแบบ synchronous (เหมือน WASM เธรดเดียว) */
function fakeTransformers(cfg) {
  return `
const CFG = ${JSON.stringify(cfg || {})};
export const env = { backends: { onnx: { wasm: {} } } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function busy(ms) { const t = Date.now(); while (Date.now() - t < ms) {} }
export class TextStreamer { constructor(tok, o) { this.o = o; } }
export async function pipeline(task, model, opts) {
  const c = (task === 'automatic-speech-recognition' ? CFG.asr : task === 'text-to-speech' ? CFG.tts : CFG.chat) || {};
  if (opts && opts.progress_callback) opts.progress_callback({ status: 'progress', file: 'onnx/model.onnx', progress: 50 });
  await sleep(c.loadMs || 0);
  if (task === 'automatic-speech-recognition') {
    const f = async (pcm, o) => {
      busy(c.busyMs || 0);
      if (c.mode === 'oom') throw new RangeError('Out of memory');
      if (c.mode === 'crash') { setTimeout(() => { throw new Error('simulated worker crash'); }); await sleep(60000); }
      // นับครั้งที่เรียก (ต่อ Worker) ใส่ในข้อความ — ท่อนที่ติดกันต้องไม่เหมือนกันเป๊ะ ไม่งั้นตัวตัดคำซ้ำที่รอยต่อ (AsrCalc.mergeChunks) จะตัดท่อนที่สองทิ้งเป็นรอยต่อ
      const n = (self.__asrN = (self.__asrN || 0) + 1);
      return { text: (c.text || 'seg') + n + ':' + pcm.length + ':' + ((o && o.language) || 'auto') + ':' + model };
    };
    f.dispose = async () => {};
    return f;
  }
  if (task === 'text-to-speech') {
    const f = async () => {
      busy(c.busyMs || 0);
      if (c.mode === 'oom') throw new RangeError('Out of memory');
      const a = new Float32Array(1600);
      for (let i = 0; i < a.length; i++) a[i] = Math.sin(i / 5) * 0.3;
      return { audio: a, sampling_rate: 16000 };
    };
    return f;
  }
  const g = async (messages, o) => { for (const t of (c.tokens || ['สวัสดี', 'ครับ'])) { o.streamer.o.callback_function(t); await sleep(5); } return []; };
  g.tokenizer = {};
  return g;
}`;
}

/* บันทึกทุก Worker ที่หน้าสร้าง: url, เวลาสร้าง/ปิด, ข้อความที่ส่ง/รับ — ใช้ตรวจลำดับการโหลด (พูล) และจำนวนที่มีชีวิตพร้อมกัน (งบหน่วยความจำ) */
const WORKER_SPY = `(() => {
  const W = window.Worker;
  window.__wlog = [];
  function Spy(url, opts) {
    const w = new W(url, opts);
    const rec = { url: String(url), t0: performance.now(), end: null, posts: [], recv: [] };
    window.__wlog.push(rec);
    const post = w.postMessage.bind(w);
    w.postMessage = function (m, tr) { rec.posts.push({ type: m && m.type, t: performance.now() }); return post(m, tr); };
    const term = w.terminate.bind(w);
    w.terminate = function () { if (rec.end == null) rec.end = performance.now(); return term(); };
    w.addEventListener('message', (e) => rec.recv.push({ type: e.data && e.data.type, t: performance.now() }));
    return w;
  }
  Spy.prototype = W.prototype;
  window.Worker = Spy;
  window.__longtasks = [];
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longtasks.push({ start: e.startTime, dur: e.duration }))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
})();`;

const MODEL_WORKER = /(ai-chat|asr|tts)-worker\.js/;

async function setup(context, page, { cfg, init, engine } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (/\/vendor\/transformers\/transformers\.web\.min\.js$/.test(u.pathname)) {
      return route.fulfill({ contentType: 'text/javascript', body: fakeTransformers(cfg) });
    }
    if (u.pathname === '/api/ai/usage') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ used: 10, limit: 10000 }) });
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort('internetdisconnected');
  });
  await page.addInitScript(WORKER_SPY);
  await page.addInitScript(({ init, engine }) => {
    try {
      localStorage.setItem('ome:theme', 'light');
      if (engine) localStorage.setItem('tanot:asr:engine', engine);
      // Section 4: ภาษาถอดเสียงเริ่มต้นเปลี่ยนเป็นไทย (→ Thonburian) · spec นี้ทดสอบกลไก Worker/OOM ด้วยค่าเดิม (ตรวจจับอัตโนมัติ → Xenova/whisper-tiny) จึงตรึงไว้ — ค่าเริ่มต้นใหม่ทดสอบใน tts-normalize.spec.js
      localStorage.setItem('tanot:asr:lang', 'auto');
    } catch (e) {}
    if (init) (0, eval)(init);
  }, { init: init || '', engine: engine || '' });
  return errors;
}

/* WAV PCM 16-bit — chFn(c, i, rate) คืนค่า -1..1 */
function wav({ rate, seconds, channels = 1, chFn }) {
  const n = Math.round(rate * seconds), bytes = 44 + n * channels * 2, b = Buffer.alloc(bytes);
  b.write('RIFF', 0); b.writeUInt32LE(bytes - 8, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(channels, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * channels * 2, 28); b.writeUInt16LE(channels * 2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * channels * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) { b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, chFn(c, i, rate))) * 32767), o); o += 2; }
  return b;
}
const speech = (c, i, rate) => (Math.floor(i / rate) % 4 === 3 ? 0 : 0.3 * Math.sin(i / 7));

async function workers(page, re) { return page.evaluate((src) => window.__wlog.filter((w) => new RegExp(src).test(w.url)), re.source); }

test.describe('media-core: ถอดรหัส 16kHz + แบ่งช่วง', () => {
  test('decode16k: WAV 44.1kHz สเตอริโอ 1.5 วิ → 24,000 sample โมโน (ไม่ decode ที่ความถี่เดิมแล้ว resample)', async ({ context, page }) => {
    await setup(context, page);
    await page.goto('/text-to-speech.html');
    const buf = wav({ rate: 44100, seconds: 1.5, channels: 2, chFn: (c, i) => (c === 0 ? 0.5 : -0.5) * Math.sin(i / 9) });
    const r = await page.evaluate(async (b64) => {
      const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const dec = await TanotMedia.decode16k(u.buffer);
      const mono = dec.mono();
      let max = 0; for (const v of mono) max = Math.max(max, Math.abs(v));
      const left = dec.channels;
      return { length: dec.length, monoLen: mono.length, rate: dec.sampleRate, channels: left, max, dur: dec.duration };
    }, buf.toString('base64'));
    expect(r.rate).toBe(16000);
    expect(Math.abs(r.length - 24000)).toBeLessThanOrEqual(2);
    expect(r.monoLen).toBe(r.length);
    expect(r.channels).toBe(2);
    expect(r.max).toBeLessThan(0.02); // L = -R → โมโนเฉลี่ยแล้วเกือบเงียบ
    expect(r.dur).toBeCloseTo(1.5, 2);
  });

  test('planSegments (เดิม): 11 นาที → ช่วง ~5 นาที ต่อกันพอดีไม่ขาดไม่ซ้อน — ยังใช้ได้เป็นตัวช่วย แต่การถอดเสียงในเบราว์เซอร์ใช้ planAsrChunks (≤ 30 วิ) แล้ว', async ({ context, page }) => {
    await setup(context, page);
    await page.goto('/text-to-speech.html');
    const segs = await page.evaluate(() => TanotMedia.planSegments(TanotMedia.fromPcm(new Float32Array(16000 * 660)), 300));
    expect(segs.length).toBe(3);
    expect(segs[0][0]).toBe(0);
    expect(segs[2][1]).toBe(16000 * 660);
    for (let i = 1; i < segs.length; i++) expect(segs[i][0]).toBe(segs[i - 1][1]);
    for (const [a, b] of segs.slice(0, 2)) expect(Math.abs(b - a - 16000 * 300)).toBeLessThanOrEqual(16000 * 3);
  });

  test('planAsrChunks: 11 นาที → ทุกท่อน ≤ 30 วิ (Whisper รับ 30 วิต่อหน้าต่าง) · ท่อนแรกเริ่ม 0 · ท่อนสุดท้ายจบที่ท้ายไฟล์ · ท่อนถัดไปเริ่มก่อนจุดตัด 1.5 วิ (เหลื่อม) · จุดตัดต่อกันพอดี', async ({ context, page }) => {
    await setup(context, page);
    await page.goto('/text-to-speech.html');
    for (const sec of [0.5, 12, 29, 31, 60, 660, 3601]) {
      const ch = await page.evaluate((n) => TanotMedia.planAsrChunks(TanotMedia.fromPcm(new Float32Array(Math.round(16000 * n)))), sec);
      expect(ch.length, sec + ' วิ').toBeGreaterThanOrEqual(1);
      expect(ch[0].a).toBe(0); expect(ch[ch.length - 1].b).toBe(Math.round(16000 * sec));
      for (const c of ch) expect((c.b - c.a) / 16000, sec + ' วิ').toBeLessThanOrEqual(30);
      for (let i = 1; i < ch.length; i++) { expect(ch[i].start).toBe(ch[i - 1].end); expect(ch[i].start - ch[i].a).toBe(24000); } // เหลื่อมหลัง 1.5 วิ
    }
  });
});

test.describe('ถอดเสียงในเบราว์เซอร์ (asr-worker.js)', () => {
  test('รันใน Worker ทีละท่อน ≤ 30 วิ (ตัดที่จุดเงียบ เหลื่อม 1.5 วิ) — เธรดหลักไม่มี long task ≥ 200ms ระหว่างถอด, ผลรวมทุกท่อนตามลำดับ', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { asr: { loadMs: 200, busyMs: 150 } }, engine: 'local' });
    await page.goto('/text-to-speech.html');
    await page.setInputFiles('#asrFile', { name: 'meeting.wav', mimeType: 'audio/wav', buffer: wav({ rate: 8000, seconds: 360, chFn: speech }) });
    await page.selectOption('#asrModel', 'Xenova/whisper-base');
    const t0 = await page.evaluate(() => performance.now());
    await page.click('#asrGoBtn');
    await expect(page.locator('#asrCancelBtn')).toBeVisible();
    await expect(page.locator('#asrStatus')).toHaveClass(/ok/, { timeout: 60000 });
    const text = await page.inputValue('#asrResult');
    const parts = text.split(/\s+/).filter(Boolean);
    // ก้าว 25 วิ ค้นจุดเงียบ ±3 วิ → ท่อนละ 22–28 วิ (ไม่รวมส่วนเหลื่อม) → 360 วิ ได้ 13–17 ท่อน (ไม่ใช่ 2 ช่วง 5 นาทีแบบเดิม)
    expect(parts.length).toBeGreaterThanOrEqual(13); expect(parts.length).toBeLessThanOrEqual(17);
    expect(parts.every((p) => /^seg\d+:\d+:auto:Xenova\/whisper-base$/.test(p))).toBe(true);
    expect(parts.map((p) => +p.match(/^seg(\d+)/)[1])).toEqual(parts.map((_, i) => i + 1)); // ตามลำดับท่อน
    const lens = parts.map((p) => +p.split(':')[1]);
    for (const n of lens) expect(n).toBeLessThanOrEqual(30 * 16000);
    // เสียงทั้งหมดถูกส่งครบ: ผลรวม = ความยาวไฟล์ + ส่วนเหลื่อม 1.5 วิ ต่อรอยต่อ
    const total = lens.reduce((x, y) => x + y, 0);
    expect(Math.abs(total - (360 * 16000 + (lens.length - 1) * 24000))).toBeLessThanOrEqual(4);
    const asr = await workers(page, /asr-worker/);
    expect(asr.length).toBe(1);
    expect(asr[0].posts.filter((p) => p.type === 'transcribe').length).toBe(parts.length);
    const longest = await page.evaluate((t) => Math.max(0, ...window.__longtasks.filter((l) => l.start >= t).map((l) => l.dur)), t0);
    expect(longest).toBeLessThan(200);
    await expect(page.locator('#asrCancelBtn')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('หน่วยความจำไม่พอ → ข้อความอ่านเข้าใจ + ปุ่มสลับไปคลาวด์, บันทึกปัญหาไม่มีชื่อไฟล์/ข้อความ, หน้าไม่พัง', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { asr: { mode: 'oom', text: 'TOPSECRET' } }, init: 'window.TANOT_AI = { enabled: true };', engine: 'local' });
    await page.goto('/text-to-speech.html');
    await page.setInputFiles('#asrFile', { name: 'secret-meeting.wav', mimeType: 'audio/wav', buffer: wav({ rate: 16000, seconds: 3, chFn: speech }) });
    await page.click('#asrGoBtn');
    await expect(page.locator('#asrStatus')).toHaveClass(/err/, { timeout: 15000 });
    await expect(page.locator('#asrStatus')).toContainText('หน่วยความจำ');
    await expect(page.locator('#asrUseCloudBtn')).toBeVisible();
    const asr = await workers(page, /asr-worker/);
    expect(asr[0].end).not.toBeNull(); // Worker ที่หน่วยความจำเสียถูกปิดทิ้ง
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));
    expect(log.length).toBe(1);
    expect(log[0]).toMatchObject({ kind: 'asr', code: 'oom', engine: 'local', stage: 'transcribe', model: 'Xenova/whisper-tiny' });
    expect(log[0].file).toMatchObject({ type: 'audio/wav', ext: 'wav', dur: 3 });
    expect(JSON.stringify(log)).not.toMatch(/secret|TOPSECRET/i);
    await page.click('#asrUseCloudBtn');
    await expect(page.locator('#asrEngineToggle [data-ae="cloud"]')).toHaveClass(/active/);
    await expect(page.locator('#asrUseCloudBtn')).toBeHidden();
    await expect(page.locator('#asrModelField')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('Worker พังกลางทาง → ข้อความ + ปิดตัวที่พัง, กดใหม่สร้าง Worker ใหม่', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { asr: { mode: 'crash' } }, engine: 'local' });
    await page.goto('/text-to-speech.html');
    await page.setInputFiles('#asrFile', { name: 'a.wav', mimeType: 'audio/wav', buffer: wav({ rate: 16000, seconds: 2, chFn: speech }) });
    await page.click('#asrGoBtn');
    await expect(page.locator('#asrStatus')).toHaveClass(/err/, { timeout: 15000 });
    await expect(page.locator('#asrStatus')).toContainText('หยุดทำงาน');
    await expect(page.locator('#asrUseCloudBtn')).toBeHidden(); // ไม่มีคลาวด์ (ไม่ใช่ pages.dev) — ไม่มีปุ่ม
    await expect(page.locator('#asrGoBtn')).toBeEnabled();
    await page.click('#asrGoBtn');
    await expect(page.locator('#asrStatus')).toHaveClass(/err/, { timeout: 15000 });
    const asr = await workers(page, /asr-worker/);
    expect(asr.length).toBe(2);
    expect(asr.every((w) => w.end != null)).toBe(true);
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));
    expect(log.map((r) => r.code)).toEqual(['crash', 'crash']);
    expect(errors).toEqual([]);
  });

  test('ยกเลิกได้ระหว่างถอด — Worker ถูกปิด, ไม่บันทึกเป็นปัญหา', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { asr: { busyMs: 4000 } }, engine: 'local' });
    await page.goto('/text-to-speech.html');
    await page.setInputFiles('#asrFile', { name: 'a.wav', mimeType: 'audio/wav', buffer: wav({ rate: 8000, seconds: 360, chFn: speech }) });
    await page.click('#asrGoBtn');
    await expect.poll(async () => (await workers(page, /asr-worker/)).length ? (await workers(page, /asr-worker/))[0].posts.length : 0).toBeGreaterThan(0);
    await page.click('#asrCancelBtn');
    await expect(page.locator('#asrStatus')).toHaveText('ยกเลิกแล้ว');
    await expect(page.locator('#asrGoBtn')).toBeEnabled();
    await expect(page.locator('#asrCancelBtn')).toBeHidden();
    const asr = await workers(page, /asr-worker/);
    expect(asr[0].end).not.toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('tanot:media:log'))).toBeNull();
    expect(errors).toEqual([]);
  });

  test('มือถือ: ไม่มีโมเดล small/medium + แนะนำโหมดคลาวด์ (pages.dev) · คอมมีครบ 4 ขนาด', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: ANDROID_UA, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = await setup(ctx, page, { init: 'window.TANOT_AI = { enabled: true };', engine: 'local' });
    await page.goto('/text-to-speech.html');
    const opts = await page.$$eval('#asrModel option', (o) => o.map((x) => x.value));
    expect(opts).toEqual(['Xenova/whisper-tiny', 'Xenova/whisper-base']);
    await expect(page.locator('#asrMobileNote')).toBeVisible();
    await expect(page.locator('#asrUseCloudBtn')).toBeVisible();
    await ctx.close();
    expect(errors).toEqual([]);

    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await setup(ctx2, p2, { init: 'window.TANOT_AI = { enabled: true };' });
    await p2.goto('/text-to-speech.html');
    // Xenova เดิมครบ 4 ขนาด (Thonburian เพิ่มทีหลังตอนตรวจ adapter เสร็จ — ดู asr.spec.js)
    expect(await p2.$$eval('#asrModel option', (o) => o.filter((x) => /^Xenova\//.test(x.value)).length)).toBe(4);
    await expect(p2.locator('#asrMobileNote')).toBeHidden();
    // pages.dev + ยังไม่เคยเลือก = คลาวด์เป็นค่าเริ่มต้น
    await expect(p2.locator('#asrEngineToggle [data-ae="cloud"]')).toHaveClass(/active/);
    await ctx2.close();
  });
});

test.describe('สร้างไฟล์เสียง (พูล tts-worker.js + audio-encode-worker.js)', () => {
  const N_CHUNKS = 24;
  // Section 4: เลขถูกแปลงเป็นคำ "ก่อน" ตัดท่อน (≤ MAX_CHUNK ตัวอักษรหลังแปลง) — ประโยคต้องสั้นพอที่ 1 ย่อหน้า = 1 ท่อนแม้เลขเป็น "ยี่สิบสี่"
  // Section 5: บรรทัดที่ต่อกันโดยไม่มีบรรทัดว่างคั่นถูกรวมเป็นท่อนเดียว → คั่นด้วยบรรทัดว่าง (ย่อหน้าละ 1 ท่อน) ให้ได้ N_CHUNKS ท่อนเหมือนเดิม
  const LONG = Array.from({ length: N_CHUNKS }, (_, i) => 'ประโยคทดสอบที่ ' + (i + 1) + ' สร้างเสียงพูดภาษาไทย').join('\n\n');
  const BIG_DEVICE = `Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 8 }); Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 8 });`;

  async function generate(page, voice) {
    await page.fill('#ttsText', LONG);
    if (voice) await page.selectOption('#dlVoice', voice);
    await page.click('#dlGenerateBtn');
    await expect(page.locator('#dlStatus')).toHaveClass(/ok/, { timeout: 30000 });
  }

  test('ทยอยโหลดทีละตัว: ตัวถัดไปเริ่มหลังตัวก่อนหน้าทำท่อนแรกเสร็จ · ไฟล์ mp3/wav ทำใน Worker · ว่างแล้วปิดพูล', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { tts: { loadMs: 300, busyMs: 120 } }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.evaluate(() => window.__tts.TTS_IDLE_MS(800));
    await generate(page);
    const tts = await workers(page, /tts-worker/);
    expect(tts.length).toBe(4);
    for (let k = 1; k < tts.length; k++) {
      const prevFirstDone = tts[k - 1].recv.find((m) => m.type === 'item-done');
      expect(prevFirstDone, 'worker ' + (k - 1) + ' ทำท่อนแรกเสร็จก่อน').toBeTruthy();
      expect(tts[k].t0).toBeGreaterThanOrEqual(prevFirstDone.t);
    }
    const done = tts.reduce((s, w) => s + w.recv.filter((m) => m.type === 'item-done').length, 0);
    expect(done).toBe(N_CHUNKS);
    const enc = await workers(page, /audio-encode-worker/);
    expect(enc.length).toBe(1);
    const files = await page.evaluate(async () => {
      const mp3 = new Uint8Array(await (await fetch(document.getElementById('dlMp3Link').href)).arrayBuffer());
      const wav = new Uint8Array(await (await fetch(document.getElementById('dlWavLink').href)).arrayBuffer());
      return { mp3: Array.from(mp3.slice(0, 2)), mp3Len: mp3.length, wavHead: String.fromCharCode(...wav.slice(0, 4)), wavLen: wav.length };
    });
    expect(files.mp3[0]).toBe(0xff);
    expect(files.mp3[1] & 0xe0).toBe(0xe0); // frame sync ของ MP3
    expect(files.wavHead).toBe('RIFF');
    expect(files.wavLen).toBe(44 + (N_CHUNKS * 1600 + (N_CHUNKS - 1) * Math.round(16000 * 0.4)) * 2); // ทุกท่อน + ความเงียบ 0.4 วิ ระหว่างย่อหน้า (Section 4: ทุกบรรทัดคือย่อหน้า; เดิมคงที่ 0.3 วิ)
    await expect.poll(async () => (await workers(page, /tts-worker/)).every((w) => w.end != null), { timeout: 5000 }).toBe(true);
    expect(await page.evaluate(() => TanotMedia.budget.active())).not.toContain('tts');
    expect(errors).toEqual([]);
  });

  test('โมเดล fp32 (หญิง โทนพอดแคสต์) = Worker เดียวแม้เครื่องแรง', async ({ context, page }) => {
    await setup(context, page, { cfg: { tts: { busyMs: 20 } }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await generate(page, 'Tanotfin/mms-thai-female-podcast-spk0-stable2-onnx');
    expect((await workers(page, /tts-worker/)).length).toBe(1);
  });

  test('iPhone = Worker เดียวเสมอ', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: IOS_UA });
    const page = await ctx.newPage();
    await setup(ctx, page, { cfg: { tts: { busyMs: 20 } }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await generate(page);
    expect((await workers(page, /tts-worker/)).length).toBe(1);
    await ctx.close();
  });

  test('หน่วยความจำไม่พอระหว่างสร้างเสียง → ข้อความ + ไม่ย้ายไปรันบนเธรดหลัก + บันทึกปัญหา', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { tts: { mode: 'oom' } } });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', 'ข้อความลับมาก');
    await page.click('#dlGenerateBtn');
    await expect(page.locator('#dlStatus')).toHaveClass(/err/, { timeout: 15000 });
    await expect(page.locator('#dlStatus')).toContainText('หน่วยความจำ');
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ kind: 'tts', code: 'oom', stage: 'synth' });
    expect(JSON.stringify(log)).not.toContain('ข้อความลับ');
    expect(errors).toEqual([]);
  });
});

test.describe('วิดเจ็ตแชทบนมือถือ — โมเดลในเบราว์เซอร์ได้ครั้งละ 1 ตัว', () => {
  test('แชท (LLM) แล้วพูดคำตอบ (TTS): ปิด Worker แชทก่อนสร้าง Worker เสียง — ไม่มีเกิน 1 ตัวพร้อมกัน', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: ANDROID_UA, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = await setup(ctx, page, { cfg: { chat: { tokens: ['สวัสดี', 'ครับ'] }, tts: { busyMs: 10 } } });
    await page.addInitScript(() => localStorage.setItem('ome:aiChatSpeak', 'on'));
    await page.goto('/credits.html');
    await page.click('.ome-ai-fab');
    await page.fill('.ome-ai-inputrow textarea', 'ทดสอบ');
    await page.click('.ome-ai-btn.send');
    await expect(page.locator('.ome-ai-row.bot .ome-ai-bubble')).toHaveText('สวัสดีครับ', { timeout: 15000 });
    await expect.poll(async () => (await workers(page, /tts-worker/)).length, { timeout: 10000 }).toBe(1);
    const all = await workers(page, MODEL_WORKER);
    expect(all.map((w) => w.url.replace(/^.*\//, ''))).toEqual(['ai-chat-worker.js', 'tts-worker.js']);
    for (const w of all) {
      const alive = all.filter((o) => o !== w && o.t0 <= w.t0 && (o.end == null || o.end > w.t0));
      expect(alive, w.url + ' เกิดขณะที่ Worker โมเดลอื่นยังไม่ถูกปิด').toEqual([]);
    }
    // ถามต่อ → Worker แชทถูกสร้างใหม่ และ Worker เสียงถูกปิดก่อน
    await page.fill('.ome-ai-inputrow textarea', 'อีกครั้ง');
    await page.click('.ome-ai-btn.send');
    await expect(page.locator('.ome-ai-row.bot')).toHaveCount(2, { timeout: 15000 });
    const all2 = await workers(page, MODEL_WORKER);
    for (const w of all2) {
      const alive = all2.filter((o) => o !== w && o.t0 <= w.t0 && (o.end == null || o.end > w.t0));
      expect(alive).toEqual([]);
    }
    await ctx.close();
    expect(errors).toEqual([]);
  });
});

test.describe('บันทึกปัญหา (data.html)', () => {
  test('แสดง / คัดลอก / ล้าง · ภาษาอังกฤษ · ไม่มีเนื้อหาผู้ใช้', async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = await setup(context, page, { cfg: { asr: { mode: 'oom' } }, engine: 'local' });
    await page.goto('/text-to-speech.html');
    await page.setInputFiles('#asrFile', { name: 'private-call.wav', mimeType: 'audio/wav', buffer: wav({ rate: 16000, seconds: 2, chFn: speech }) });
    await page.click('#asrGoBtn');
    await expect(page.locator('#asrStatus')).toHaveClass(/err/, { timeout: 15000 });

    await page.goto('/data.html');
    const rows = page.locator('#dtLog .list-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('ถอดเสียง · หน่วยความจำไม่พอ · ในเบราว์เซอร์');
    await expect(rows.first()).toContainText('Xenova/whisper-tiny');
    await expect(page.locator('#dtLogCard')).not.toContainText('private-call');
    await page.click('#dtLogCopy');
    await expect(page.locator('#dtLogMsg')).toHaveText('คัดลอกแล้ว');
    const clip = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    expect(clip).toHaveLength(1);
    expect(clip[0]).toMatchObject({ kind: 'asr', code: 'oom' });
    expect(JSON.stringify(clip)).not.toContain('private-call');

    // สลับภาษาสด
    await page.evaluate(() => OME_LANG.set('en'));
    await expect(rows.first()).toContainText('Transcription · Out of memory · in browser');
    await expect(page.locator('#dtLogCard h2')).toHaveText('Problem log');
    await page.evaluate(() => OME_LANG.set('th'));

    await page.click('#dtLogClear');
    await page.locator('dialog[open] .btn.danger').click();
    await expect(page.locator('#dtLog .empty')).toHaveText('ยังไม่มีปัญหาที่บันทึกไว้');
    expect(await page.evaluate(() => localStorage.getItem('tanot:media:log'))).toBeNull();
    await expect(page.locator('#dtModelSize')).not.toHaveText('—');
    expect(errors).toEqual([]);
  });
});
