// @ts-check
// ภาษา L6 — เสียงอ่านจากโมเดล MMS-TTS เมื่อเครื่องไม่มีเสียงของภาษานั้น (ROADMAP แถว 27, docs/languages-design.md L6)
// A) ตรรกะล้วนของ media-models.js (LANG_TTS / langTtsChunks) · B) หน้า languages.html จริงกับ transformers.js หลอก + speechSynthesis จำลอง (CI ไม่โหลดโมเดลจริง)
// ข้อความตัวอย่างแต่งเอง
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function models() {
  const sandbox = { self: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'media-models.js'), 'utf8'), sandbox);
  return sandbox.self.TanotMediaModels;
}
const M = models();
const KM = 'VanNet2003/mms-tts-khm-onnx';

/* ═══════════════ A) ตรรกะล้วน ═══════════════ */
test.describe('A) LANG_TTS + langTtsChunks (known-answer)', () => {
  test('ตาราง: ทุกโมเดลล็อก commit 40 hex · ไม่มี Tanotfin · ไม่มีภาษาที่ต้อง uroman (ko) / ไม่มี ONNX (lo, ms)', () => {
    const keys = Object.keys(M.LANG_TTS).sort();
    expect(keys).toEqual(['ar', 'de', 'es', 'fr', 'hi', 'km', 'my', 'pt', 'ru', 'vi']);
    for (const k of keys) {
      const t = M.LANG_TTS[k];
      expect(t.revision).toMatch(/^[0-9a-f]{40}$/);
      expect(t.model).not.toMatch(/^Tanotfin\//);
      expect(t.vocab).toContain(' ');
      expect(M.ttsRevision(t.model)).toBe(t.revision);
    }
    for (const c of ['ko', 'lo', 'ms', 'en', 'ja', 'zh', 'zh-HK', 'it', '', null]) expect(M.langTtsInfo(c)).toBe(null);
    expect(M.langTtsInfo('pt-BR').model).toBe('Xenova/mms-tts-por');
    expect(M.ttsDtype(KM)).toBe('fp32');
    expect(M.ttsDtype('233contentisContent/mms-tts-mya-onnx')).toBe('fp32');
    expect(M.ttsDtype('Xenova/mms-tts-hin')).toBe(null); // q8 ค่าเริ่มต้นของ WASM
    // ตารางเสียงไทยเดิมไม่เปลี่ยน
    expect(M.ttsDtype('Tanotfin/mms-thai-jori-f5-onnx')).toBe('fp32');
    expect(M.ttsRevision('Xenova/mms-tts-eng')).toBe('main');
  });

  test('กรองตาม vocab: ตัวนอก vocab = ช่องว่าง · ตัวพิมพ์ใหญ่ → เล็ก · ฮะรากัตอาหรับตัดทิ้งไม่แยกคำ · เลขตัดทั้งหมด · ตัดท่อนที่จบประโยค', () => {
    expect(M.langTtsChunks('km', 'សួស្តី! ខ្ញុំ​ឈ្មោះ Tan។ 123')).toEqual(['សួស្តី', 'ខ្ញុំ ឈ្មោះ']);
    expect(M.langTtsChunks('ar', 'مَرْحَبًا، كيف حالك؟')).toEqual(['مرحبا', 'كيف حالك']);
    expect(M.langTtsChunks('vi', 'Xin CHÀO bạn. Tôi tên là Tan!')).toEqual(['xin chào bạn', 'tôi tên là tan']);
    expect(M.langTtsChunks('vi', 'Xin chào')).toEqual(['xin chào']); // NFD → NFC
    expect(M.langTtsChunks('hi', 'नमस्ते, आप कैसे हैं?')).toEqual(['नमस्ते आप कैसे हैं']);
    expect(M.langTtsChunks('my', 'မင်္ဂလာပါ။')).toEqual(['မင်္ဂလာပါ']);
    expect(M.langTtsChunks('de', 'Grüß Gott 2026')).toEqual(['grüß gott']);
    expect(M.langTtsChunks('pt-BR', 'Olá, tudo bem?')).toEqual(['olá tudo bem']);
    expect(M.langTtsChunks('km', 'Hello 123 !!')).toEqual([]); // ไม่มีตัวที่พูดได้ = ไม่ส่งเข้าโมเดล
    expect(M.langTtsChunks('lo', 'ສະບາຍດີ')).toEqual([]);
  });

  test('ท่อนยาว ≤ LANG_TTS_MAX: ตัดที่ช่องว่าง · ไม่มีช่องว่าง = ไม่ฉีกเครื่องหมายกำกับออกจากพยัญชนะ', () => {
    const long = Array.from({ length: 40 }, () => 'hola').join(' ');
    const c1 = M.langTtsChunks('es', long);
    expect(c1.every((c) => c.length <= M.LANG_TTS_MAX)).toBe(true);
    expect(c1.join(' ')).toBe(long);
    const km = 'កា'.repeat(80); // ไม่มีช่องว่าง · ា เป็นเครื่องหมายกำกับ
    const c2 = M.langTtsChunks('km', km);
    expect(c2.every((c) => c.length <= M.LANG_TTS_MAX)).toBe(true);
    expect(c2.join('')).toBe(km);
    for (const c of c2.slice(1)) expect(c.charAt(0)).toBe('ក');
  });

  test('ทุกท่อนของทุกภาษามีแต่ตัวใน vocab ของโมเดลนั้น (fuzz)', () => {
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pool = 'Aa Éé Ññ 12 ,.!?؟។။।َّ กข ក ខ ា ្ မ ် क ि ب ة đ ư Ж ж ß ç œ 😀 ​\n-\'';
    for (const k of Object.keys(M.LANG_TTS)) {
      const V = new Set(M.LANG_TTS[k].vocab);
      for (let n = 0; n < 200; n++) {
        let s = ''; const len = 1 + Math.floor(rnd() * 200);
        for (let i = 0; i < len; i++) s += pool[Math.floor(rnd() * pool.length)];
        for (const c of M.langTtsChunks(k, s)) {
          expect(c.length).toBeLessThanOrEqual(M.LANG_TTS_MAX);
          for (const ch of c) expect(V.has(ch)).toBe(true);
        }
      }
    }
  });
});

/* ═══════════════ B) หน้า languages.html ═══════════════ */
/* cfg.missing = [model ที่โหลดไม่ได้ (404)] · cfg.mem = [model ที่หน่วยความจำไม่พอ] */
function fakeTransformers(cfg) {
  const vocab = {}; for (const t of Object.values(M.LANG_TTS)) vocab[t.model] = t.vocab;
  return `
const VOCAB = ${JSON.stringify(vocab)};
const CFG = ${JSON.stringify(cfg || {})};
export const env = { backends: { onnx: { wasm: {} } } };
export async function pipeline(task, model, opts) {
  self.postMessage({ type: 'fake-pipeline', model, dtype: (opts && opts.dtype) || null, revision: (opts && opts.revision) || null });
  if (opts && opts.progress_callback) opts.progress_callback({ status: 'progress', file: 'onnx/model.onnx', progress: 40 });
  if ((CFG.missing || []).includes(model)) throw new Error('Could not locate file: "https://huggingface.co/' + model + '/resolve/x/onnx/model.onnx" (404)');
  if ((CFG.mem || []).includes(model)) throw new Error('Aborted(). out of memory');
  const V = new Set([...(VOCAB[model] || '')]);
  return async (text) => {
    const out = [...text].filter((c) => !V.has(c));
    if (out.length) throw new Error('Gather node index out of bounds: ' + JSON.stringify(out.join('')));
    const a = new Float32Array(1600); for (let i = 0; i < a.length; i++) a[i] = Math.sin(i / 5) * 0.3;
    return { audio: a, sampling_rate: 16000 };
  };
}`;
}
/* voices = รายชื่อเสียงของเครื่อง (lang) · บันทึก speechSynthesis.speak + batch ที่ส่งเข้า tts-worker + ข้อความจาก Worker + เสียงที่เล่น */
const SPY = (voices) => `(() => {
  const mk = (l) => l.map((lang) => ({ lang, name: 'v-' + lang, voiceURI: 'v-' + lang, localService: true, default: false }));
  let VOICES = mk(${JSON.stringify(voices)});
  window.__spoken = [];
  const ls = [];
  const synth = { getVoices: () => VOICES.slice(), speak: (u) => window.__spoken.push({ text: u.text, lang: u.lang }), cancel() {}, pause() {}, resume() {}, speaking: false, pending: false, onvoiceschanged: null,
    addEventListener(t, f) { if (t === 'voiceschanged') ls.push(f); }, removeEventListener() {} };
  /* จำลอง Chrome: รายชื่อเสียงมาทีหลังพร้อม voiceschanged */
  window.__setVoices = (l) => { VOICES = mk(l); ls.forEach((f) => f({})); if (synth.onvoiceschanged) synth.onvoiceschanged({}); };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => synth });
  const W = window.Worker;
  window.__batches = []; window.__wmsgs = []; window.__workers = [];
  function Spy(url, opts) {
    const w = new W(url, opts); const u = String(url); window.__workers.push(u);
    const post = w.postMessage.bind(w);
    w.postMessage = function (m, tr) { if (m && m.type === 'synthesize-batch') window.__batches.push({ model: m.modelId, items: m.items.map((i) => i.text) }); return post(m, tr); };
    if (/tts-worker/.test(u)) w.addEventListener('message', (e) => { if (e.data && e.data.type === 'fake-pipeline') window.__wmsgs.push(e.data); });
    return w;
  }
  Spy.prototype = W.prototype; window.Worker = Spy;
  window.__played = 0;
  const st = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function () { window.__played++; return st.apply(this, arguments); };
})();`;

async function setup(context, page, { cfg, voices = [], init = '' } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const external = [];
  await context.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (/\/vendor\/transformers\/transformers\.web\.min\.js$/.test(u.pathname)) return r.fulfill({ contentType: 'text/javascript', body: fakeTransformers(cfg) });
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return r.continue();
    if (/huggingface|hf\.co/.test(u.hostname)) external.push(u.href);
    return r.abort('internetdisconnected');
  });
  await page.addInitScript(SPY(voices));
  await page.addInitScript((i) => { try { localStorage.setItem('ome:theme', 'light'); } catch (e) {} if (i) (0, eval)(i); }, init);
  return { errors, external };
}
const listen = (page) => page.getByRole('button', { name: /^(ฟังเสียง|Play audio)$/ }).first().click();
const logRows = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));

test.describe('B) หน้า languages — เลือกเสียงเครื่อง/โมเดล', () => {
  test('เครื่องไม่มีเสียงเขมร → โมเดล (fp32 + commit ที่ล็อก) · ข้อความกรองตาม vocab · เล่นเสียง · ไม่เรียก speechSynthesis · budget tts-lang', async ({ context, page }) => {
    const { errors, external } = await setup(context, page, { voices: ['en-US', 'th-TH'] });
    await page.goto('/languages.html#lang-kh');
    const picker = page.locator('[data-k="voice-picker"]');
    await expect(picker).toBeVisible();
    await expect(page.locator('[data-k="voice-model"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-k="voice-device"]')).toBeDisabled();
    await listen(page);
    await expect.poll(() => page.evaluate(() => window.__played)).toBeGreaterThan(0);
    const b = await page.evaluate(() => window.__batches);
    expect(b.length).toBe(1);
    expect(b[0].model).toBe(KM);
    const V = new Set(M.LANG_TTS.km.vocab);
    for (const t of b[0].items) { expect(t.length).toBeGreaterThan(0); for (const ch of t) expect(V.has(ch)).toBe(true); }
    expect(await page.evaluate(() => window.__wmsgs)).toEqual([{ type: 'fake-pipeline', model: KM, dtype: 'fp32', revision: M.LANG_TTS.km.revision }]);
    expect(await page.evaluate(() => window.__spoken)).toEqual([]);
    expect(await page.evaluate(() => window.TanotMedia && window.TanotMedia.budget.active())).toContain('tts-lang');
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('เครื่องมีเสียงเขมร → เสียงเครื่อง ไม่สร้าง tts-worker · เลือก "เสียงโมเดล" → ใช้โมเดล + จำใน lang-practice:ttsvoice (local) หลังโหลดหน้าใหม่', async ({ context, page }) => {
    const { errors } = await setup(context, page, { voices: ['km-KH', 'en-US'] });
    await page.goto('/languages.html#lang-kh');
    await expect(page.locator('[data-k="voice-device"]')).toHaveAttribute('aria-pressed', 'true');
    await listen(page);
    const spoken = await page.evaluate(() => window.__spoken);
    expect(spoken.length).toBe(1);
    expect(spoken[0].lang).toBe('km');
    expect(await page.evaluate(() => window.__workers.filter((u) => /tts-worker/.test(u)))).toEqual([]);
    await page.locator('[data-k="voice-model"]').click();
    await expect(page.locator('[data-k="voice-model"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('lang-practice:ttsvoice'))).toBe('{"km":"model"}');
    expect(await page.evaluate(() => TanotRegistry.classify('lang-practice:ttsvoice').kind)).toBe('local');
    await page.reload();
    await expect(page.locator('[data-k="voice-model"]')).toHaveAttribute('aria-pressed', 'true');
    await listen(page);
    await expect.poll(() => page.evaluate(() => window.__played)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__spoken)).toEqual([]);
    // กลับเป็นเสียงเครื่อง → ลบค่าออก
    await page.locator('[data-k="voice-device"]').click();
    expect(await page.evaluate(() => localStorage.getItem('lang-practice:ttsvoice'))).toBe('{}');
    expect(errors).toEqual([]);
  });

  test('รายชื่อเสียงยังว่างตอนกด (โหลด async) → รอ voiceschanged · มีเสียงเขมรมาทีหลัง = เสียงเครื่อง ไม่สร้าง Worker · ระหว่างรอไม่แสดงว่าเครื่องไม่มีเสียง', async ({ context, page }) => {
    const { errors } = await setup(context, page, { voices: [], init: 'window.TANOT_LANG_TTS = { voiceWaitMs: 5000 }' });
    await page.goto('/languages.html#lang-kh');
    await expect(page.locator('[data-k="voice-device"]')).toBeEnabled();
    await expect(page.locator('[data-k="voice-device"]')).toHaveAttribute('aria-pressed', 'true');
    await listen(page);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__spoken.length)).toBe(0); // ยังรออยู่ ไม่พูดและไม่โหลดโมเดล
    await page.evaluate(() => window.__setVoices(['km-KH', 'en-US']));
    await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1);
    expect(await page.evaluate(() => window.__workers.filter((u) => /tts-worker/.test(u)))).toEqual([]);
    await expect(page.locator('[data-k="voice-device"]')).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  });

  test('รายชื่อเสียงว่างตลอด → หลังรอครบใช้โมเดล · ปุ่มเสียงเครื่องกดไม่ได้หลังรู้แล้ว', async ({ context, page }) => {
    const { errors } = await setup(context, page, { voices: [], init: 'window.TANOT_LANG_TTS = { voiceWaitMs: 800 }' });
    await page.goto('/languages.html#lang-kh');
    await listen(page);
    await expect.poll(() => page.evaluate(() => window.__played)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__spoken)).toEqual([]);
    await expect(page.locator('[data-k="voice-device"]')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('โหลดโมเดลไม่ได้ (404) → แจ้งผู้ใช้ + กลับเสียงเครื่อง + problem log ไม่มีข้อความ · ครั้งต่อไปใช้เสียงเครื่องเลย ไม่โหลดซ้ำ', async ({ context, page }) => {
    const { errors } = await setup(context, page, { voices: [], cfg: { missing: [KM] } });
    await page.goto('/languages.html#lang-kh');
    const phrase = await page.locator('[data-i18n-skip]').filter({ hasText: /[ក-៿]/ }).first().textContent();
    await listen(page);
    await expect(page.locator('[data-k="ttsToast"]')).toHaveText('เสียงโมเดลใช้ไม่ได้ (ไม่พบไฟล์) — ใช้เสียงเครื่องแทน');
    await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1);
    const rows = await logRows(page);
    const row = rows.find((r) => r.kind === 'tts');
    expect(row).toMatchObject({ stage: 'model-load', engine: 'local', model: KM, lang: 'km' });
    expect(JSON.stringify(rows)).not.toContain(String(phrase).trim().slice(0, 6));
    await expect(page.locator('[data-k="voice-model"]')).toBeDisabled();
    const before = await page.evaluate(() => window.__batches.length);
    await listen(page);
    await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(2);
    expect(await page.evaluate(() => window.__batches.length)).toBe(before);
    expect(errors).toEqual([]);
  });

  test('หน่วยความจำไม่พอ → ข้อความหน่วยความจำ + เสียงเครื่อง · EN', async ({ context, page }) => {
    const { errors } = await setup(context, page, { voices: [], cfg: { mem: ['Xenova/mms-tts-hin'] }, init: "localStorage.setItem('ome:lang','en')" });
    await page.goto('/languages.html#lang-in');
    await expect(page.locator('[data-k="voice-device"]')).toHaveText('Device voice');
    await expect(page.locator('[data-k="voice-model"]')).toHaveText('Model voice');
    await listen(page);
    await expect(page.locator('[data-k="ttsToast"]')).toHaveText('Not enough memory for the model voice — using the device voice');
    await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1);
    expect(errors).toEqual([]);
  });

  test('ภาษาที่ไม่มีโมเดล (ลาว) → ไม่มีตัวเลือกเสียง ไม่สร้าง tts-worker · ข้อความเดิมว่าเครื่องไม่มีเสียง', async ({ context, page }) => {
    const { errors } = await setup(context, page, { voices: ['en-US'] });
    await page.goto('/languages.html#lang-la');
    await expect(page.locator('[data-k="voice-picker"]')).toHaveCount(0);
    await listen(page);
    await expect(page.locator('[data-k="ttsToast"]')).toBeVisible();
    expect(await page.evaluate(() => window.__workers.filter((u) => /tts-worker/.test(u)))).toEqual([]);
    expect(await page.evaluate(() => window.__spoken.length)).toBe(1);
    expect(errors).toEqual([]);
  });
});
