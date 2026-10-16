// บันทึกคำอ่านผิด (tts-misread.js + ส่วนในหน้า text-to-speech) — ตรรกะล้วน (Node) + หน้าจริงใน Chromium (transformers.js หลอก — ไม่โหลดโมเดลจริง)
// ข้อความตัวอย่างทุกชุดแต่งขึ้นเอง — ห้ามใส่ข้อความ/เสียงของผู้ใช้จริงใน fixtures
const { test, expect } = require('@playwright/test');
const M = require('../tts-misread.js');
const N = require('../tts-normalize.js');

const KEY = 'tanot:tts:misread';

/* ═══════════════ A) ตรรกะล้วน ═══════════════ */
test.describe('A) tts-misread.js (Node)', () => {
  test('key/cleanWord: ตัดช่องว่างซ้ำ + ตัวพิมพ์เล็ก · ว่าง/ยาวเกิน/__proto__ ใช้ไม่ได้', () => {
    expect(M.key('  Origin   BLOOD ')).toBe('origin blood');
    expect(M.cleanWord('  Origin   Blood ')).toBe('Origin Blood');
    expect(M.key('')).toBe(''); expect(M.key('   ')).toBe(''); expect(M.key(null)).toBe('');
    expect(M.key('x'.repeat(81))).toBe(''); expect(M.key('x'.repeat(80))).toBe('x'.repeat(80));
    expect(M.key('__proto__')).toBe(''); expect(M.cleanWord('__PROTO__')).toBe('');
  });

  test('examplesFor: ตัดที่ขอบประโยค/บรรทัด · ไม่ซ้ำ · ≤ 3 · ไม่ตัดกลางคำละติน · ไม่สนตัวพิมพ์', () => {
    const t = 'เมื่อวานนี้ Zorp ปรากฏตัวที่หน้าเมือง. แล้วเขาก็หนีไปอย่างรวดเร็ว! ใครจะไปรู้ว่า Zorp กลับมา?\nบรรทัดใหม่มี zorp อีกครั้ง\n\nZorpish ไม่ใช่คำนั้น แต่ ZORP ใช่';
    expect(M.examplesFor(t, 'Zorp')).toEqual([
      'เมื่อวานนี้ Zorp ปรากฏตัวที่หน้าเมือง.', 'ใครจะไปรู้ว่า Zorp กลับมา?', 'บรรทัดใหม่มี zorp อีกครั้ง']);          // 3 ประโยคแรก (ZORP ท้ายสุดเกินเพดาน 3) · Zorpish ไม่นับ
    expect(M.examplesFor(t, 'zorp', 2)).toHaveLength(2);
    expect(M.examplesFor('Zorp ซ้ำ. Zorp ซ้ำ. Zorp ซ้ำ.', 'Zorp')).toEqual(['Zorp ซ้ำ.']); // ประโยคเดียวกัน = 1
    expect(M.examplesFor(t, 'Zorpish')).toEqual(['Zorpish ไม่ใช่คำนั้น แต่ ZORP ใช่']);
    expect(M.examplesFor(t, 'ไม่มีคำนี้')).toEqual([]);
    expect(M.examplesFor('', 'Zorp')).toEqual([]);
    expect(M.examplesFor('3.5 กิโลของ Zorp ราคา 2.5 บาท', 'Zorp')).toEqual(['3.5 กิโลของ Zorp ราคา 2.5 บาท']); // จุดทศนิยมไม่ใช่จบประโยค
  });

  test('examplesFor: ประโยคยาว > 200 ถูกตัดเป็นหน้าต่างรอบคำ ที่ขอบคำ (ไม่ตัดกลางคำ) และยังมีคำนั้นอยู่', () => {
    const filler = Array.from({ length: 80 }, (_, i) => 'คำที่' + i).join(' ');     // ช่องว่างคั่น
    const t = filler + ' Zorp ' + filler;
    const ex = M.examplesFor(t, 'Zorp');
    expect(ex).toHaveLength(1);
    expect(ex[0].length).toBeLessThanOrEqual(M.MAX_EXAMPLE_LEN);
    expect(ex[0]).toContain(' Zorp ');
    expect(/^คำที่\d+/.test(ex[0])).toBe(true);                                        // ขึ้นต้นด้วยคำเต็ม ไม่ใช่เศษ
    expect(/คำที่\d+$/.test(ex[0])).toBe(true);
    // ไทยล้วนไม่มีช่องว่าง/ไม่มีจุดจบประโยค — ตัดที่ขอบคำของ Intl.Segmenter
    const thai = 'เขาเดินไปตามทางเรื่อยเปื่อยโดยไม่มีจุดหมาย'.repeat(10) + 'Zorp' + 'แล้วก็กลับบ้านไปนอนหลับสบายอย่างมีความสุข'.repeat(10);
    const ex2 = M.examplesFor(thai, 'Zorp')[0];
    expect(ex2.length).toBeLessThanOrEqual(M.MAX_EXAMPLE_LEN);
    expect(ex2).toContain('Zorp');
    const seg = new Intl.Segmenter('th', { granularity: 'word' });
    const bounds = new Set(); let pos = 0; for (const s of seg.segment(thai)) { bounds.add(s.index); pos = s.index + s.segment.length; } bounds.add(pos);
    const at = thai.indexOf(ex2); expect(at).toBeGreaterThanOrEqual(0);
    expect(bounds.has(at) && bounds.has(at + ex2.length)).toBe(true);
  });

  test('apply: เพิ่ม/นับซ้ำ · report ชนะ skip · คำอ่านใหม่ทับ · ตัวอย่าง ≤ 3 ไม่ซ้ำ · first คงเดิม last ใหม่ · voice ล่าสุด', () => {
    let m = M.apply({}, [{ word: 'Zorp', type: 'skip', count: 2, examples: ['ก', 'ข'] }], { now: 100, voice: 'voice-a' });
    expect(m).toEqual({ zorp: { word: 'Zorp', type: 'skip', reading: '', count: 2, first: 100, last: 100, voice: 'voice-a', examples: ['ก', 'ข'] } });
    m = M.apply(m, [{ word: 'ZORP', type: 'skip', count: 3, examples: ['ข', 'ค', 'ง', 'จ'] }], { now: 200, voice: 'voice-b' });
    expect(m.zorp).toMatchObject({ word: 'Zorp', type: 'skip', count: 5, first: 100, last: 200, voice: 'voice-b', examples: ['ก', 'ข', 'ค'] });
    m = M.apply(m, [{ word: 'zorp', type: 'report', reading: 'ซอร์ป' }], { now: 300 });
    expect(m.zorp).toMatchObject({ type: 'report', reading: 'ซอร์ป', count: 6, last: 300, voice: 'voice-b' });
    m = M.apply(m, [{ word: 'Zorp', type: 'skip', count: 1 }], { now: 400 });
    expect(m.zorp).toMatchObject({ type: 'report', reading: 'ซอร์ป', count: 7 });       // skip ไม่ลดชนิด/ไม่ล้างคำอ่าน
    expect(Object.keys(m)).toEqual(['zorp']);
  });

  test('apply: ตัวอย่างยาวเกินถูกตัด ≤ 200 · ข้อมูลเสีย/ชนิดแปลกไม่ทำให้พัง · __proto__ ไม่เข้า', () => {
    const m = M.apply({ bad: 'x', ok: { word: 'Ok', type: 'weird', count: 'many', examples: [1, 'ก', 'ก'] } }, [{ word: '__proto__', type: 'skip' }, { word: 'New', type: 'skip', examples: ['ย'.repeat(500)] }], { now: 5 });
    expect(Object.keys(m).sort()).toEqual(['new', 'ok']);                                 // 'bad' (ไม่ใช่ object) ถูกทิ้ง · __proto__ ไม่เข้า
    expect(m.new.examples[0].length).toBe(M.MAX_EXAMPLE_LEN);
    expect(m.ok).toMatchObject({ word: 'Ok', type: 'skip', count: 1, examples: ['ก'] });          // ชนิดแปลก/จำนวนเสีย/ตัวอย่างซ้ำ → ทำความสะอาด
    expect(M.apply({ wrongkey: { word: 'Other' } }, [], { now: 5 })).toEqual({});                   // key ไม่ตรงคำ = ทิ้ง
    expect(({}).polluted).toBeUndefined();
  });

  test('apply: เพดาน 500 คำ — เกินแล้วตัดรายการที่ last เก่าสุด · ต่อครั้งรับ skip ได้ ≤ MAX_PER_RUN คำ', () => {
    let m = {};
    for (let i = 0; i < 500; i++) m = M.apply(m, [{ word: 'w' + i, type: 'skip' }], { now: 1000 + i });
    expect(Object.keys(m)).toHaveLength(500);
    m = M.apply(m, [{ word: 'fresh', type: 'report' }], { now: 9999 });
    expect(Object.keys(m)).toHaveLength(500);
    expect(m.w0).toBeUndefined(); expect(m.w1).toBeDefined(); expect(m.fresh).toBeDefined();
    // อัปเดตคำเก่าให้ last ใหม่ → รอด
    m = M.apply(m, [{ word: 'w1', type: 'skip' }, { word: 'fresh2', type: 'skip' }], { now: 10000 });
    expect(m.w1).toBeDefined(); expect(m.w2).toBeUndefined(); expect(Object.keys(m)).toHaveLength(500);
    const many = Array.from({ length: 300 }, (_, i) => ({ word: 'k' + i, count: 300 - i }));
    expect(M.skipItems('x', many)).toHaveLength(M.MAX_PER_RUN);
    expect(M.skipItems('x', many)[0].word).toBe('k0');                                    // คำที่พบบ่อยสุดก่อน
  });

  test('trainingTexts: แทนคำด้วยคำอ่าน (ไม่สนตัวพิมพ์/ยาวสุดก่อน) · หนึ่งประโยคต่อหนึ่งย่อหน้า · ประโยคที่ยังมีคำไม่มี reading ไปไฟล์ที่สอง · ไม่ซ้ำ', () => {
    const text = 'วันนี้ Zorp Blood มาถึงแล้ว. เขาเห็น zorp ด้วย\nและ Qux ก็มา พร้อมกับ Zorp';
    let m = {};
    m = M.apply(m, M.skipItems(text, [{ word: 'Zorp Blood', count: 1 }, { word: 'Zorp', count: 3 }, { word: 'Qux', count: 1 }]), { now: 1 });
    m = M.apply(m, [{ word: 'Zorp', type: 'report', reading: 'ซอร์ป' }, { word: 'Zorp Blood', type: 'report', reading: 'ซอร์ป บลัด' }], { now: 2 });
    const t = M.trainingTexts(m);
    expect(t.main).toBe('วันนี้ ซอร์ป บลัด มาถึงแล้ว.\n\nเขาเห็น ซอร์ป ด้วย\n');
    expect(t.pending).toBe('และ Qux ก็มา พร้อมกับ ซอร์ป\n');                                 // ยังมี Qux (ไม่มี reading)
    expect(t.mainCount).toBe(2); expect(t.pendingCount).toBe(1);
    expect(M.trainingTexts({})).toMatchObject({ main: '', pending: '' });
    // report ที่ยังไม่มี reading ก็ถือว่ายังอ่านไม่ได้ → ไฟล์ที่สอง
    const m2 = M.apply({}, [M.reportItem('ประโยคเดียวมี Bar อยู่', 'Bar', '')], { now: 1 });
    expect(M.trainingTexts(m2)).toMatchObject({ main: '', pending: 'ประโยคเดียวมี Bar อยู่\n' });
  });

  test('inLexicon / dateStamp (เวลาไทย) / fileNames / exportJson', () => {
    const rows = N.parseLexicon('Zorp = ซอร์ป\nอสุรา = อะสุรา').rows;
    expect(M.inLexicon(rows, 'zorp')).toBe(true); expect(M.inLexicon(rows, ' ZORP ')).toBe(true); expect(M.inLexicon(rows, 'Qux')).toBe(false);
    expect(M.dateStamp(Date.UTC(2026, 9, 15, 20, 0))).toBe('20261016');                    // 03:00 วันที่ 16 เวลาไทย
    expect(M.fileNames(Date.UTC(2026, 9, 15, 5, 0))).toEqual({ txt: 'tts-misread-20261015.txt', pending: 'tts-misread-pending-20261015.txt', json: 'tts-misread-20261015.json' });
    const m = M.apply({}, [{ word: 'Zorp', type: 'report', reading: 'ซอร์ป', examples: ['ก'] }], { now: 7, voice: 'v' });
    expect(JSON.parse(M.exportJson(m))).toEqual({ zorp: m.zorp });
  });
});

/* ═══════════════ B) หน้า text-to-speech ═══════════════ */
function fakeTransformers() {
  return `
const VOCAB = new Set(${JSON.stringify(N.VALID_CHARS.split(''))});
export const env = { backends: { onnx: { wasm: {} } } };
export async function pipeline(task, model) {
  const eng = /eng/.test(String(model));
  return async (text) => {
    const bad = eng ? [] : [...text].filter((c) => !VOCAB.has(c));
    if (bad.length) throw new Error('Gather node index out of bounds: ' + bad.join(''));
    const a = new Float32Array(1600); for (let i = 0; i < a.length; i++) a[i] = Math.sin(i / 5) * 0.3;
    return { audio: a, sampling_rate: 16000 };
  };
}`;
}
async function setup(context, page, init) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await context.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (/\/vendor\/transformers\/transformers\.web\.min\.js$/.test(u.pathname)) return r.fulfill({ contentType: 'text/javascript', body: fakeTransformers() });
    if (u.pathname === '/api/ai/usage') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ used: 10, limit: 10000 }) });
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return r.continue();
    return r.abort('internetdisconnected');
  });
  await page.addInitScript((i) => { try { localStorage.setItem('ome:theme', 'light'); localStorage.setItem('tanot:asr:lang', 'auto'); } catch (e) {} if (i) (0, eval)(i); }, init || '');
  return errors;
}
const ok = (page) => expect(page.locator('#dlStatus')).toHaveClass(/ok/, { timeout: 30000 });
const more = (page) => page.evaluate(() => { document.getElementById('moreBox').open = true; }); // บันทึกคำอ่านผิด/ตัวเลือก อยู่ในส่วนพับ "ตัวเลือกเพิ่มเติม"
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
const generate = async (page, text) => { await page.fill('#ttsText', text); await page.click('#dlGenerateBtn'); await ok(page); };
const SAMPLE = 'อสุรา (Asura) หมุน Zorp Blood แล้วเขาเรียก zorp blood อีกครั้ง.\nบรรทัดที่สองมี Qux อยู่ด้วย';

test.describe('B) บันทึกอัตโนมัติ (type skip)', () => {
  test('คีย์เป็น sync map ใน data-registry · สร้างไฟล์เสียงไทยสำเร็จ → บันทึกคำที่ถูกข้าม + ตัวอย่าง · ไม่นับวงเล็บที่ตั้งใจข้าม · ไม่เข้า problem log', async ({ context, page }) => {
    const errors = await setup(context, page);
    await page.goto('/text-to-speech.html');
    expect(await page.evaluate((k) => TanotRegistry.classify(k), KEY)).toMatchObject({ kind: 'sync', mode: 'map' });
    await generate(page, SAMPLE);
    await expect.poll(() => page.evaluate((k) => !!localStorage.getItem(k), KEY)).toBe(true);
    const m = await stored(page);
    expect(Object.keys(m).sort()).toEqual(['qux', 'zorp blood']);                              // Asura (ในวงเล็บ) ไม่ถูกบันทึก
    expect(m['zorp blood']).toMatchObject({ word: 'Zorp Blood', type: 'skip', reading: '', count: 2 });
    expect(m['zorp blood'].examples).toEqual(['อสุรา (Asura) หมุน Zorp Blood แล้วเขาเรียก zorp blood อีกครั้ง.']);
    expect(m.qux.examples).toEqual(['บรรทัดที่สองมี Qux อยู่ด้วย']);
    expect(typeof m.qux.first).toBe('number'); expect(m.qux.last).toBeGreaterThanOrEqual(m.qux.first);
    expect(m.qux.voice).toMatch(/\S/);
    const log = await page.evaluate(() => localStorage.getItem('tanot:media:log') || '');
    expect(log).not.toMatch(/Zorp|Qux|zorp|ซอร์ป/);                                          // problem log ไม่มีเนื้อหาผู้ใช้
    expect(errors).toEqual([]);
  });

  test('สร้างซ้ำ → นับเพิ่ม · ตัวอย่างไม่เกิน 3 ไม่ซ้ำ · ยาวไม่เกิน 200', async ({ context, page }) => {
    const errors = await setup(context, page);
    await page.goto('/text-to-speech.html');
    const text = ['ประโยคหนึ่งมี Zed', 'ประโยคสองมี Zed', 'ประโยคสามมี Zed', 'ประโยคสี่มี Zed', 'ประโยคห้ามี Zed ' + 'ก '.repeat(200)].join('\n');
    await generate(page, text);
    await expect.poll(async () => (await stored(page)).zed && (await stored(page)).zed.count).toBe(5);
    await generate(page, 'ประโยคหกมี Zed');
    await expect.poll(async () => (await stored(page)).zed.count).toBe(6);
    const z = (await stored(page)).zed;
    expect(z.examples).toEqual(['ประโยคหนึ่งมี Zed', 'ประโยคสองมี Zed', 'ประโยคสามมี Zed']);
    z.examples.forEach((e) => expect(e.length).toBeLessThanOrEqual(200));
    expect(errors).toEqual([]);
  });

  test('ปิดสวิตช์ → ไม่บันทึก · จำสวิตช์ใน tanot:tts:opts · เสียงภาษาอังกฤษไม่บันทึก · คำที่อยู่ใน "คำอ่านของฉัน" ไม่ถูกข้าม ไม่บันทึก', async ({ context, page }) => {
    const errors = await setup(context, page);
    await page.goto('/text-to-speech.html');
    await more(page);
    await expect(page.locator('#optMisread')).toBeChecked();
    await page.uncheck('#optMisread');
    await generate(page, 'ประโยคมี Zorp อยู่');
    await page.waitForTimeout(300);
    expect(await stored(page)).toEqual({});
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('tanot:tts:opts')))).toMatchObject({ misread: false });
    await page.reload();
    await more(page);
    await expect(page.locator('#optMisread')).not.toBeChecked();
    await page.check('#optMisread');
    // อังกฤษล้วน (ไม่มีอักษรไทย) = เสียงอังกฤษอัตโนมัติ → ไม่บันทึก
    await generate(page, 'Zorp is here');
    await page.waitForTimeout(300);
    expect(await stored(page)).toEqual({});
    // คำอ่านของฉัน
    await page.click('#lexBox > summary');
    await page.fill('#lexText', 'Zorp = ซอร์ป');
    await page.locator('#lexText').blur();
    await generate(page, 'ประโยคมี Zorp และ Qux');
    await expect.poll(async () => Object.keys(await stored(page)).join()).toBe('qux');
    expect(errors).toEqual([]);
  });
});

test.describe('B) แจ้งคำอ่านผิดเอง (type report)', () => {
  test('เติมคำจากข้อความที่เลือก · บันทึกพร้อมคำอ่าน + ตัวอย่าง + เสียง · ติ๊กเพิ่มเข้าคำอ่านของฉัน', async ({ context, page }) => {
    const errors = await setup(context, page);
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', 'เขาพบ Zorp ที่ริมทาง. อีกวัน Zorp กลับมา');
    await page.evaluate(() => { const t = document.getElementById('ttsText'); const i = t.value.indexOf('Zorp'); t.focus(); t.setSelectionRange(i, i + 4); });
    await page.click('#mrReportBtn');
    await expect(page.locator('#mrDialog')).toBeVisible();
    await expect(page.locator('#mrWord')).toHaveValue('Zorp');
    await page.fill('#mrReading', 'ซอร์ป');
    await page.check('#mrAddLex');
    await page.click('#mrSave');
    await expect(page.locator('#mrDialog')).toBeHidden();
    const m = await stored(page);
    expect(m.zorp).toMatchObject({ word: 'Zorp', type: 'report', reading: 'ซอร์ป', count: 1, examples: ['เขาพบ Zorp ที่ริมทาง.', 'อีกวัน Zorp กลับมา'] });
    expect(m.zorp.voice).toMatch(/\S/);
    expect(await page.inputValue('#lexText')).toBe('Zorp = ซอร์ป');
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('tanot:tts:lexicon')))).toEqual({ v: 1, text: 'Zorp = ซอร์ป' });
    // บันทึกอีกครั้ง = นับเพิ่ม ไม่ซ้ำแถว
    await page.click('#mrReportBtn');
    await page.fill('#mrWord', 'ZORP');
    await page.click('#mrSave');
    await expect.poll(async () => (await stored(page)).zorp.count).toBe(2);
    expect(Object.keys(await stored(page))).toEqual(['zorp']);
    expect(errors).toEqual([]);
  });

  test('ตรวจก่อนบันทึก: ไม่ใส่คำ / ติ๊กเพิ่มโดยไม่มีคำอ่าน / คำอ่านนอก vocab → ข้อความเตือน ไม่บันทึกอะไร · ไม่ติ๊กเพิ่ม = คำอ่านอะไรก็ได้', async ({ context, page }) => {
    const errors = await setup(context, page);
    await page.goto('/text-to-speech.html');
    await page.click('#mrReportBtn');
    await expect(page.locator('#mrWord')).toHaveValue('');
    await page.click('#mrSave');
    await expect(page.locator('#mrMsg')).toContainText('ใส่คำหรือวลีก่อน');
    await page.fill('#mrWord', 'Zorp');
    await page.check('#mrAddLex');
    await page.click('#mrSave');
    await expect(page.locator('#mrMsg')).toContainText('ใส่คำอ่านที่ถูกก่อน');
    await page.fill('#mrReading', 'zorp');
    await page.click('#mrSave');
    await expect(page.locator('#mrMsg')).toContainText('z o r p');
    expect(await stored(page)).toEqual({});
    expect(await page.inputValue('#lexText')).toBe('');
    await page.uncheck('#mrAddLex');
    await page.click('#mrSave');
    await expect(page.locator('#mrDialog')).toBeHidden();
    expect((await stored(page)).zorp).toMatchObject({ type: 'report', reading: 'zorp', examples: [] });
    expect(await page.inputValue('#lexText')).toBe('');
    expect(errors).toEqual([]);
  });
});

test.describe('B) หน้าดู log + ส่งออก', () => {
  const SEED = {
    zorp: { word: 'Zorp', type: 'report', reading: 'ซอร์ป', count: 2, first: 1, last: 30, voice: 'v', examples: ['วันนี้ Zorp มา. แล้วไป', 'Zorp กลับมาอีก'] },
    qux: { word: 'Qux', type: 'skip', reading: '', count: 5, first: 2, last: 20, voice: 'v', examples: ['มี Qux ในประโยคนี้', 'ประโยค Zorp กับ Qux'] },
    bar: { word: 'Bar', type: 'skip', reading: '', count: 1, first: 3, last: 10, voice: 'v', examples: ['มี Bar ด้วย'] }
  };
  const init = `try { if (!localStorage.getItem('${KEY}')) localStorage.setItem('${KEY}', ${JSON.stringify(JSON.stringify(SEED))}); } catch (e) {}`;

  test('รายการ: คำ · ชนิด · จำนวนครั้ง · คำอ่าน · ใหม่สุดก่อน · เพิ่มคำอ่านแล้วขึ้น "มีคำอ่านแล้ว" แต่คำยังอยู่ · ลบรายคำ · EN', async ({ context, page }) => {
    const errors = await setup(context, page, init);
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#mrCount')).toHaveText('3');
    await more(page);
    await page.click('#mrBox > summary');
    const rows = page.locator('#mrList .list-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Zorp'); await expect(rows.nth(0)).toContainText('แจ้งเอง'); await expect(rows.nth(0)).toContainText('2 ครั้ง'); await expect(rows.nth(0)).toContainText('อ่านว่า ซอร์ป');
    await expect(rows.nth(1)).toContainText('Qux'); await expect(rows.nth(1)).toContainText('ข้ามอัตโนมัติ'); await expect(rows.nth(1)).toContainText('5 ครั้ง');
    await expect(rows.nth(2)).toContainText('Bar');
    // ปุ่ม "เพิ่มคำอ่าน": มีคำอ่านจากการแจ้ง → ใส่ครบเลย · ไม่มี → ใส่ "คำ = " รอพิมพ์
    await rows.nth(0).locator('[data-mr=add]').click();
    await expect(page.locator('#lexText')).toHaveValue('Zorp = ซอร์ป');
    await expect(rows.nth(0).locator('[data-mr=has]')).toHaveText('มีคำอ่านแล้ว');
    await expect(rows.nth(0).locator('[data-mr=add]')).toHaveCount(0);
    await rows.nth(1).locator('[data-mr=add]').click();
    await expect(page.locator('#lexText')).toHaveValue('Zorp = ซอร์ป\nQux = ');
    await expect(rows.nth(1).locator('[data-mr=has]')).toHaveCount(0);
    await page.keyboard.type('คักซ์'); await page.locator('#lexText').blur();
    await expect(rows.nth(1).locator('[data-mr=has]')).toBeVisible();
    expect(Object.keys(await stored(page)).sort()).toEqual(['bar', 'qux', 'zorp']);           // ไม่ลบจาก log
    // EN
    await page.evaluate(() => OME_LANG.set('en'));
    await expect(rows.nth(0)).toContainText('Reported'); await expect(rows.nth(0)).toContainText('2 times'); await expect(rows.nth(0)).toContainText('read as ซอร์ป');
    await expect(rows.nth(0).locator('[data-mr=has]')).toHaveText('Has reading');
    await expect(page.locator('#mrReportBtn')).toContainText('Report a misreading');
    await page.evaluate(() => OME_LANG.set('th'));
    // ลบรายคำ
    await rows.nth(2).locator('[data-mr=del]').click();
    await expect(rows).toHaveCount(2);
    expect(Object.keys(await stored(page)).sort()).toEqual(['qux', 'zorp']);
    expect(errors).toEqual([]);
  });

  test('ส่งออกสำหรับฝึก: .txt แทนคำอ่านที่ถูก · หนึ่งประโยคต่อย่อหน้า · ประโยคที่ยังมีคำไม่มีคำอ่านอยู่ไฟล์ที่สอง · ชื่อไฟล์มีวันที่', async ({ context, page }) => {
    const errors = await setup(context, page, init);
    await page.goto('/text-to-speech.html');
    await more(page);
    await page.click('#mrBox > summary');
    const got = []; page.on('download', (d) => got.push(d));
    await page.click('#mrExportTxt');
    await expect.poll(() => got.length).toBe(2);
    const [d1, d2] = got;
    expect(d1.suggestedFilename()).toMatch(/^tts-misread-\d{8}\.txt$/);
    expect(d2.suggestedFilename()).toMatch(/^tts-misread-pending-\d{8}\.txt$/);
    const read = async (d) => require('fs').readFileSync(await d.path(), 'utf8');
    expect(await read(d1)).toBe('วันนี้ ซอร์ป มา. แล้วไป\n\nซอร์ป กลับมาอีก\n');
    expect(await read(d2)).toBe('มี Qux ในประโยคนี้\n\nประโยค ซอร์ป กับ Qux\n\nมี Bar ด้วย\n');
    await expect(page.locator('#mrStatus')).toContainText('ส่งออกแล้ว 5 ประโยค');
    expect(errors).toEqual([]);
  });

  test('ส่งออก JSON = ข้อมูลดิบทั้งหมด · ล้างทั้งหมดต้องยืนยันก่อน (ยกเลิก = ยังอยู่)', async ({ context, page }) => {
    const errors = await setup(context, page, init);
    await page.goto('/text-to-speech.html');
    await more(page);
    await page.click('#mrBox > summary');
    const dl = page.waitForEvent('download');
    await page.click('#mrExportJson');
    const d = await dl;
    expect(d.suggestedFilename()).toMatch(/^tts-misread-\d{8}\.json$/);
    expect(JSON.parse(require('fs').readFileSync(await d.path(), 'utf8'))).toEqual(SEED);
    // ล้างทั้งหมด
    await page.click('#mrClear');
    await expect(page.locator('dialog[open] .dialog-msg')).toContainText('ล้างบันทึกคำอ่านผิดทั้งหมด 3 คำ');
    await page.locator('dialog[open] .dialog-foot .btn:not(.primary):not(.danger)').click();
    expect(Object.keys(await stored(page))).toHaveLength(3);
    await page.click('#mrClear');
    await page.locator('dialog[open] .dialog-foot .btn.danger').click();
    await expect(page.locator('#mrList .list-row')).toHaveCount(0);
    await expect(page.locator('#mrEmpty')).toBeVisible();
    expect(await stored(page)).toEqual({});
    // ไม่มีอะไรให้ส่งออก → ข้อความ ไม่ดาวน์โหลด
    await page.click('#mrExportTxt');
    await expect(page.locator('#mrStatus')).toContainText('ยังไม่มีประโยคตัวอย่างให้ส่งออก');
    expect(errors).toEqual([]);
  });

  test('เพดาน 500 คำ: สร้างไฟล์เสียงเมื่อเต็มแล้ว → ตัดรายการที่ last เก่าสุด เหลือ 500', async ({ context, page }) => {
    const seed = {}; for (let i = 0; i < 500; i++) seed['w' + i] = { word: 'W' + i, type: 'skip', reading: '', count: 1, first: 1000 + i, last: 1000 + i, voice: 'v', examples: [] };
    const errors = await setup(context, page, `try { if (!localStorage.getItem('${KEY}')) localStorage.setItem('${KEY}', ${JSON.stringify(JSON.stringify(seed))}); } catch (e) {}`);
    await page.goto('/text-to-speech.html');
    await generate(page, 'ประโยคมี Alpha และ Beta อยู่');
    await expect.poll(async () => Object.keys(await stored(page)).includes('alpha')).toBe(true);
    const m = await stored(page);
    expect(Object.keys(m)).toHaveLength(500);
    expect(m.w0).toBeUndefined(); expect(m.w1).toBeUndefined(); expect(m.w2).toBeDefined(); expect(m.beta).toBeDefined();
    expect(JSON.stringify(m).length).toBeLessThan(300 * 1024);                                 // ต่ำกว่า MAX_DATA ของ /api/sync (1 MiB ต่อ doc) สบายๆ
    expect(errors).toEqual([]);
  });

  test('มือถือ 390px: ปุ่มแจ้ง/สวิตช์/รายการไม่ล้นจอ · กล่องแจ้งไม่ล้น', async ({ context, page }) => {
    const errors = await setup(context, page, init);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/text-to-speech.html');
    await more(page);
    await page.click('#mrBox > summary');
    await page.click('#mrReportBtn');
    const dlg = await page.locator('#mrDialog').boundingBox();
    expect(dlg.x).toBeGreaterThanOrEqual(0); expect(dlg.x + dlg.width).toBeLessThanOrEqual(390);
    await page.click('#mrCancel');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
});
