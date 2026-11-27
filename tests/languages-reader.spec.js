// @ts-check
// ภาษา L3 (ROADMAP แถว 24): อ่านจากข้อความของตัวเอง — known-answer ของ LangCalc.reader + หน้าจริงกับ AI ปลอม
// ข้อความผู้ใช้อยู่ในหน่วยความจำ + ร่างล่าสุดใน lang-practice:reader (local) เท่านั้น — ไม่ซิงก์ ไม่เข้า problem log ไม่มีคำขอนอก /api/ai/*
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');
const LC = require(path.resolve(__dirname, '..', 'lang-calc.js'));
const R = LC.reader;

// pack จิ๋วที่ prepare() รับได้ (ภาษาอังกฤษ)
function pack() {
  const w = [['the', 1, 'ที่/นี่'], ['dog', 300, 'สุนัข'], ['runs', 900, 'วิ่ง'], ['quickly', 2000, ''], ['serendipity', 9000, '']];
  return LC.prepare({
    v: 2, lang: 'lang-en', src: 'test',
    w: w.map(([id, r, th]) => ({ id, r, th })),
    s: [{ id: 1, t: 'The dog runs.', th: 'หมาวิ่ง', en: 'The dog runs.', au: 0 }],
  }, 'lang-en');
}

test.describe('LangCalc.reader (ตรรกะล้วน)', () => {
  test('clip: ≤ 20,000 ตัวอักษร · NFC · CRLF → LF', () => {
    expect(R.MAX_TEXT).toBe(20000);
    expect(R.clip('a'.repeat(25000)).length).toBe(20000);
    expect(R.clip('a\r\nb\rc')).toBe('a\nb\nc');
    expect(R.clip('é')).toBe('é');
    expect(R.clip(null)).toBe('');
  });

  test('pieces: คำ + ช่องว่าง/วรรคตอนต่อกันได้ข้อความเดิมครบทุกตัวอักษร · tok ตรง tokenize', () => {
    const text = "Don't stop, the DOG runs!\nNew line.";
    const ps = R.pieces(text, 'en');
    expect(ps.map((p) => p.s).join('')).toBe(text);
    expect(ps.filter((p) => p.tok).map((p) => p.tok)).toEqual(LC.tokenize(text, 'en'));
    expect(ps.find((p) => p.s === 'DOG').tok).toBe('dog');
    expect(ps.find((p) => p.s === "Don't").tok).toBe("don't");
    expect(ps.filter((p) => !p.tok).every((p) => !/[a-z]/i.test(p.s))).toBe(true);
    expect(R.pieces('', 'en')).toEqual([]);
  });

  test('pieces: ไม่มีคำ = ชิ้นเดียวไม่มี tok · ญี่ปุ่นตัดคำด้วย Segmenter', () => {
    expect(R.pieces('123 ... 456', 'en')).toEqual([{ s: '123 ... 456', tok: null, start: 0, end: 11 }]);
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const ps = R.pieces('私は学生です。', 'ja');
      expect(ps.map((p) => p.s).join('')).toBe('私は学生です。');
      expect(ps.filter((p) => p.tok).length).toBeGreaterThanOrEqual(3);
    }
  });

  test('sentenceAt: ประโยคที่มีคำ — จบที่ . ! ? 。 และขึ้นบรรทัดใหม่', () => {
    const t = 'First one. Second is here! Third?\nFourth line';
    const at = (w) => { const i = t.indexOf(w); return R.sentenceAt(t, i, i + w.length).text; };
    expect(at('First')).toBe('First one.');
    expect(at('Second')).toBe('Second is here!');
    expect(at('Third')).toBe('Third?');
    expect(at('Fourth')).toBe('Fourth line');
    const j = '私は学生です。彼は先生です。';
    expect(R.sentenceAt(j, 8, 9).text).toBe('彼は先生です。');
  });

  test('example: ประโยคที่เจอยาวเกิน 200 → ตัดเป็นหน้าต่างรอบคำ ≤ 200 ตัวอักษร ที่ยังมีคำนั้น', () => {
    const long = ('word' + ' filler').repeat(80) + ' TARGET ' + ('more' + ' filler').repeat(80) + '.';
    const i = long.indexOf('TARGET');
    const ex = R.example(long, i, i + 6);
    expect(ex.length).toBeLessThanOrEqual(R.EXAMPLE_MAX);
    expect(ex).toContain('TARGET');
    expect(R.example('Short one.', 0, 5)).toBe('Short one.');
  });

  test('classify: card / hard / unknown / ว่าง ตามการ์ด+ระดับ+pack', () => {
    const prep = pack();
    const srs = { 'lang-en::u::serendipity': { dueAt: 1 }, 'lang-en::w::dog': { dueAt: 1 } };
    const ctx = { prep, srs, langId: 'lang-en', level: 2 };
    expect(R.classify('serendipity', ctx)).toBe('card');     // การ์ดจากข้อความ ::u::
    expect(R.classify('dog', ctx)).toBe('card');             // การ์ดชุดคำ ::w::
    expect(R.classify('runs', ctx)).toBe('');                // อยู่ใน pack ระดับ ≤ ที่เลือก ไม่มีการ์ด
    expect(R.classify('quickly', ctx)).toBe('hard');          // r 2000 = ระดับ 3 > 2
    expect(R.classify('zzzz', ctx)).toBe('unknown');          // ไม่อยู่ใน pack
    expect(R.classify('quickly', { ...ctx, level: 0 })).toBe('');  // ไม่เลือกระดับ = ไม่มี "ยากกว่า"
    expect(R.classify('zzzz', { prep: null, srs, langId: 'lang-en', level: 2 })).toBe('');  // ไม่มี pack = ไม่ไฮไลต์ unknown
    expect(R.classify('serendipity', { prep: null, srs, langId: 'lang-en', level: 2 })).toBe('card');
    expect(R.classify('x', { prep, srs: null, langId: 'lang-en', level: 1 })).toBe('unknown');
  });

  test('entry: คำแปลจาก pack (ไทยในไฟล์ → AI cache → gloss อังกฤษ) · ไม่เจอ = null', () => {
    const prep = pack();
    expect(R.entry(prep, 'dog', null)).toMatchObject({ lemma: 'dog', th: 'สุนัข', src: 'pack', lv: 1 });
    expect(R.entry(prep, 'quickly', null)).toMatchObject({ lemma: 'quickly', th: '', src: '', lv: 3 }); // มีรายการแต่ยังไม่มีคำแปล
    expect(R.entry(prep, 'quickly', { v: 1, m: { 'lang-en::w::quickly': 'อย่างรวดเร็ว' } })).toMatchObject({ th: 'อย่างรวดเร็ว', src: 'ai' });
    expect(R.entry(prep, 'zzz', null)).toBe(null);
    expect(R.entry(null, 'dog', null)).toBe(null);
  });

  test('lookupMessages: system บอกภาษา/รูปแบบ JSON + user มีคำและประโยค', () => {
    const m = R.lookupMessages('running', 'The dog is running.', 'อังกฤษ');
    expect(m[0].role).toBe('system');
    expect(m[0].content).toContain('อังกฤษ');
    ['lemma', 'th', 'pos', 'note'].forEach((k) => expect(m[0].content).toContain('"' + k + '"'));
    expect(m[m.length - 1].role).toBe('user');
    expect(m[m.length - 1].content).toContain('running');
    expect(m[m.length - 1].content).toContain('The dog is running.');
  });

  test('parseLookup: JSON ล้วน / code fence / ข้อความนำหน้า / ตัดความยาว', () => {
    expect(R.parseLookup('{"lemma":"run","th":"วิ่ง","pos":"verb","note":"ใช้กับคน/สัตว์"}')).toEqual({ lemma: 'run', th: 'วิ่ง', pos: 'verb', note: 'ใช้กับคน/สัตว์' });
    expect(R.parseLookup('```json\n{"lemma":"run","th":"วิ่ง","pos":"verb","note":""}\n```').th).toBe('วิ่ง');
    expect(R.parseLookup('นี่คือคำตอบ:\n{"lemma":"run","th":"วิ่ง"} จบ')).toEqual({ lemma: 'run', th: 'วิ่ง', pos: '', note: '' });
    const big = R.parseLookup(JSON.stringify({ lemma: 'x'.repeat(300), th: 'ก'.repeat(500), pos: 'p'.repeat(100), note: 'n'.repeat(900) }));
    expect(big.lemma.length).toBe(80);
    expect(big.th.length).toBe(120);
    expect(big.pos.length).toBe(20);
    expect(big.note.length).toBe(200);
  });

  test('parseLookup: ไม่ใช่ JSON / ไม่มีคำแปลและ lemma / ค่าไม่ใช่ข้อความ = null', () => {
    expect(R.parseLookup('ไม่ใช่ JSON')).toBe(null);
    expect(R.parseLookup('{"lemma": "run", ')).toBe(null);
    expect(R.parseLookup('{"pos":"verb"}')).toBe(null);
    expect(R.parseLookup('[1,2]')).toBe(null);
    expect(R.parseLookup('')).toBe(null);
    expect(R.parseLookup(null)).toBe(null);
    expect(R.parseLookup('{"lemma": 5, "th": {"a":1}}')).toBe(null);
    expect(R.parseLookup('{"lemma":"run"}')).toEqual({ lemma: 'run', th: '', pos: '', note: '' });
  });

  test('translateMessages + parseTranslation: ตัดเครื่องหมายคำพูด/code fence · ≤ 400', () => {
    const m = R.translateMessages('The dog runs.', 'อังกฤษ');
    expect(m[0].role).toBe('system');
    expect(m[m.length - 1].content).toContain('The dog runs.');
    expect(R.parseTranslation('"หมาวิ่ง"')).toBe('หมาวิ่ง');
    expect(R.parseTranslation('```\nหมาวิ่ง\n```')).toBe('หมาวิ่ง');
    expect(R.parseTranslation('  หมาวิ่ง  ')).toBe('หมาวิ่ง');
    expect(R.parseTranslation('ก'.repeat(900)).length).toBe(400);
    expect(R.parseTranslation(null)).toBe('');
  });

  test('cardFor: คีย์ ::u::<lemma> + หน้าการ์ด [คำ, คำแปล, ประโยค ≤ 200] · ไม่มีคำ = null', () => {
    const c = R.cardFor('lang-en', { word: 'Running', thai: 'วิ่ง', example: 'The dog is running.' });
    expect(c.key).toBe('lang-en::u::running');
    expect(c.face).toEqual(['Running', 'วิ่ง', 'The dog is running.']);
    expect(c.face[2]).toBe('The dog is running.');
    expect(R.cardFor('lang-en', { word: 'x', thai: 'ก', example: 'e'.repeat(500) }).face[2].length).toBe(200);
    expect(R.cardFor('lang-en', { word: 'x', thai: '', example: '' }).face).toEqual(['x', '', '']);
    expect(R.cardFor('lang-en', { word: '  ', thai: 'ก' })).toBe(null);
    expect(R.cardFor('lang-en', { word: '...', thai: 'ก' })).toBe(null);
  });
});

// ───────────────────────── หน้าจริง ─────────────────────────
const zlib = require('zlib');
const WORDS = [['the', 1, 'ที่/นี้'], ['dog', 300, 'สุนัข'], ['runs', 900, 'วิ่ง'], ['quickly', 2000, ''], ['serendipity', 9000, '']];
const PACK = {
  v: 2, lang: 'lang-en', src: {},
  w: WORDS.map(([id, r, th]) => ({ id, r, th, ipa: '' })),
  s: [{ id: 1, t: 'The dog runs.', th: 'หมาวิ่ง', en: 'The dog runs.' }],
};
const GZ = zlib.gzipSync(Buffer.from(JSON.stringify(PACK)));
const INDEX = { v: 1, packs: { 'lang-en': { file: 'lang-en-0a1b2c3d.json.gz', words: WORDS.length, sentences: 1, sources: [] } } };
const TEXT = 'The dog runs quickly. Serendipity found zebra!\nSecond line here.';

// ai: 'ok' | 'down' | 'none' (ไม่มีคลาวด์) · คำขอทั้งหมดที่ออกจากหน้าถูกเก็บไว้ตรวจ
async function openReader(page, { ai = 'ok', pack = true, lang = 'th', draft = null, routes = null } = {}) {
  const errors = await prepare(page);
  if (routes) await routes(page);    // หลัง prepare (route ที่ลงทีหลังชนะ)
  const reqs = [];
  const chats = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (/^\/api\//.test(u.pathname)) reqs.push(u.pathname); });
  await page.addInitScript((l) => { try { localStorage.setItem('ome:lang', l); } catch (e) {} }, lang);
  if (draft) await page.addInitScript((d) => { try { localStorage.setItem('lang-practice:reader', JSON.stringify(d)); } catch (e) {} }, draft);
  if (ai !== 'none') await page.addInitScript(() => { window.TANOT_AI = { enabled: true }; });
  await page.route('**/lang-packs/index.json', (r) => r.fulfill(pack ? { status: 200, contentType: 'application/json', body: JSON.stringify(INDEX) } : { status: 404, body: '' }));
  await page.route('**/lang-packs/lang-*', (r) => r.fulfill({ status: 200, contentType: 'application/gzip', body: GZ }));
  await page.route('**/api/ai/chat', (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    chats.push(body);
    if (ai === 'down') return route.fulfill({ status: 502, contentType: 'application/json', body: '{"code":"upstream"}' });
    const sys = (body.messages[0] || {}).content || '';
    const reply = /"lemma"/.test(sys)
      ? '```json\n{"lemma":"zebra","th":"ม้าลาย","pos":"noun","note":"สัตว์ลายขาวดำ"}\n```'
      : '"หมาวิ่งอย่างรวดเร็ว"';
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ t: reply }) + '\n\ndata: {"done":true}\n\n' });
  });
  await page.goto('/languages.html#lang-en');
  await page.click('[data-k="tab-listen"]');
  await page.click('[data-k="lsub-reader"]');
  return { errors, reqs, chats };
}
const lsGet = (page, k) => page.evaluate((key) => localStorage.getItem(key), k);
async function readText(page, text = TEXT) {
  await page.fill('[data-k="rd-input"]', text);
  await page.click('[data-k="rd-read"]');
  await expect(page.locator('[data-k="rd-text"]')).toBeVisible();
}

test.describe('หน้า: อ่านจากข้อความ', () => {
  test('วางข้อความ → คำแตะได้ ไฮไลต์ตามสถานะ (การ์ด/ยากกว่า/ไม่รู้จัก) · ไม่มีคำขอ /api ตอนอ่านอย่างเดียว', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lang-practice:srs', JSON.stringify({ 'lang-en::u::serendipity': { dueAt: 5 } })));
    const { errors, reqs } = await openReader(page);
    await readText(page);
    const w = (t) => page.locator('[data-k="rd-word"]', { hasText: new RegExp('^' + t + '$') }).first();
    await expect(w('Serendipity')).toHaveClass(/rd-card/);
    await expect(w('quickly')).toHaveClass(/rd-hard/);       // ระดับ 3 > ค่าเริ่มต้น A2
    await expect(w('zebra')).toHaveClass(/rd-unknown/);
    await expect(w('dog')).toHaveClass(/rd-plain/);
    await page.click('[data-k="rd-level-3"]');
    await expect(w('quickly')).toHaveClass(/rd-plain/);
    await expect(page.locator('[data-k="rd-text"]')).toContainText('Second line here.');
    expect(reqs).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('แตะคำที่อยู่ใน pack: คำแปลจาก pack (ไม่เรียก AI) → เพิ่มเป็นการ์ด ::u:: + หน้าการ์ด 3 ช่อง', async ({ page }) => {
    const { errors, chats, reqs } = await openReader(page);
    await readText(page);
    await page.locator('[data-k="rd-word"]', { hasText: /^dog$/ }).click();
    await expect(page.locator('[data-k="rd-dialog"]')).toBeVisible();
    await expect(page.locator('[data-k="rd-meaning"]')).toHaveText('สุนัข');
    await expect(page.locator('[data-k="rd-sentence"]')).toHaveText('The dog runs quickly.');
    await expect(page.locator('[data-k="rd-ask"]')).toHaveCount(0);       // มีคำแปลแล้ว ไม่ต้องถาม AI
    await page.click('[data-k="rd-add"]');
    const st = await page.evaluate(() => ({ faces: JSON.parse(localStorage.getItem('lang-practice:faces') || '{}'), srs: JSON.parse(localStorage.getItem('lang-practice:srs') || '{}') }));
    expect(st.faces['lang-en::u::dog']).toEqual(['dog', 'สุนัข', 'The dog runs quickly.']);
    expect(st.srs['lang-en::u::dog'].dueAt).toBeGreaterThan(0);
    await expect(page.locator('[data-k="rd-hascard"]')).toBeVisible();
    await expect(page.locator('[data-k="rd-add"]')).toHaveCount(0);
    await page.click('[data-k="rd-close"]');
    await expect(page.locator('[data-k="rd-dialog"]')).not.toBeVisible();
    await expect(page.locator('[data-k="rd-word"]', { hasText: /^dog$/ })).toHaveClass(/rd-card/);
    expect(chats).toEqual([]);
    expect(reqs).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('คำนอก pack: ถาม AI (main, JSON ในโค้ดบล็อก) → ใช้ lemma ของ AI ทำการ์ด · แปลประโยค = fast · ไม่มีคำขอนอก /api/ai/*', async ({ page }) => {
    const { errors, chats, reqs } = await openReader(page);
    await readText(page);
    await page.locator('[data-k="rd-word"]', { hasText: /^zebra$/ }).click();
    await expect(page.locator('[data-k="rd-nomean"]')).toBeVisible();
    await expect(page.locator('[data-k="rd-add"]')).toBeDisabled();
    await page.click('[data-k="rd-ask"]');
    await expect(page.locator('[data-k="rd-ai-th"]')).toContainText('ม้าลาย');
    await expect(page.locator('[data-k="aiBadge"]')).toBeVisible();
    expect(chats[0].model).toBe('main');
    expect(JSON.stringify(chats[0].messages)).toContain('zebra');
    await page.click('[data-k="rd-translate"]');
    await expect(page.locator('[data-k="rd-tr"]')).toHaveText('หมาวิ่งอย่างรวดเร็ว');
    expect(chats[1].model).toBe('fast');
    expect(JSON.stringify(chats[1].messages)).toContain('Serendipity found zebra!');
    await page.click('[data-k="rd-add"]');
    const faces = await page.evaluate(() => JSON.parse(localStorage.getItem('lang-practice:faces') || '{}'));
    expect(faces['lang-en::u::zebra']).toEqual(['zebra', 'ม้าลาย', 'Serendipity found zebra!']);
    expect(reqs.every((u) => u.startsWith('/api/ai/'))).toBe(true);
    expect(reqs).not.toContain('/api/ocr');
    expect(errors).toEqual([]);
  });

  test('AI ล่ม: ข้อความ error ในกล่อง ไม่พัง · ปุ่มเพิ่มการ์ดยังกดไม่ได้จนมีคำแปล', async ({ page }) => {
    const { errors } = await openReader(page, { ai: 'down' });
    await readText(page);
    await page.locator('[data-k="rd-word"]', { hasText: /^zebra$/ }).click();
    await page.click('[data-k="rd-ask"]');
    await expect(page.locator('[data-k="rd-ai-err"]')).toBeVisible();
    await expect(page.locator('[data-k="rd-add"]')).toBeDisabled();
    expect(errors.filter((e) => !/status of 50[0-9]|Failed to load resource/i.test(e))).toEqual([]);
  });

  test('ไม่มีคลาวด์: ไม่มีปุ่ม AI เลย · ไม่มีคำขอ /api · คำใน pack ยังเพิ่มการ์ดได้', async ({ page }) => {
    const { reqs } = await openReader(page, { ai: 'none' });
    await readText(page);
    await page.locator('[data-k="rd-word"]', { hasText: /^zebra$/ }).click();
    await expect(page.locator('[data-k="rd-ask"]')).toHaveCount(0);
    await expect(page.locator('[data-k="rd-translate"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-k="rd-dialog"]')).not.toBeVisible();
    await page.locator('[data-k="rd-word"]', { hasText: /^runs$/ }).click();
    await page.click('[data-k="rd-add"]');
    expect(JSON.parse((await lsGet(page, 'lang-practice:srs')) || '{}')['lang-en::u::runs']).toBeTruthy();
    expect(reqs).toEqual([]);
  });

  test('ไม่มี pack ของภาษา: อ่านได้ ไฮไลต์เฉพาะที่มีการ์ด ไม่ไฮไลต์ทุกคำเป็น "ไม่รู้จัก"', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lang-practice:srs', JSON.stringify({ 'lang-en::u::zebra': { dueAt: 5 } })));
    await openReader(page, { pack: false });
    await readText(page);
    await expect(page.locator('[data-k="rd-word"].rd-unknown')).toHaveCount(0);
    await expect(page.locator('[data-k="rd-word"].rd-hard')).toHaveCount(0);
    await expect(page.locator('[data-k="rd-word"].rd-card')).toHaveCount(1);
  });

  test('ร่างล่าสุดอยู่ใน lang-practice:reader (local ≤ 20,000) · ข้อความไม่อยู่ใน problem log/คิวซิงก์ · คืนร่างเมื่อเปิดใหม่', async ({ page }) => {
    await openReader(page);
    await page.fill('[data-k="rd-input"]', TEXT + ' ' + 'x'.repeat(30000));
    await expect(page.locator('[data-k="rd-count"]')).toContainText('20,000 / 20,000');
    await expect.poll(async () => { const d = JSON.parse((await lsGet(page, 'lang-practice:reader')) || '{}'); return (d.text || '').length; }).toBe(20000);
    const d = JSON.parse(await lsGet(page, 'lang-practice:reader'));
    expect(d.lang).toBe('lang-en');
    expect(await lsGet(page, 'tanot:media:log')).toBeNull();
    expect((await lsGet(page, 'tanot-sync:dirty')) || '').not.toContain('reader');
    await page.reload();
    await page.click('[data-k="tab-listen"]');
    await page.click('[data-k="lsub-reader"]');
    await expect(page.locator('[data-k="rd-text"]')).toContainText('The dog runs quickly.');   // มีร่าง = เปิดมาที่หน้าอ่านเลย
    await page.click('[data-k="rd-edit"]');
    await expect(page.locator('[data-k="rd-input"]')).toHaveValue(/^The dog runs quickly\./);
  });

  test('นำเข้าไฟล์ .txt: ข้อความเข้าช่อง (ตัด 20,000 + แจ้ง) · ไฟล์ว่าง = ข้อความ ไม่พัง', async ({ page }) => {
    const { errors, reqs } = await openReader(page);
    await page.setInputFiles('[data-k="rd-file"]', { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('Hello zebra.\r\nNext line.', 'utf8') });
    await expect(page.locator('[data-k="rd-input"]')).toHaveValue('Hello zebra.\nNext line.');
    await page.setInputFiles('[data-k="rd-file"]', { name: 'big.txt', mimeType: 'text/plain', buffer: Buffer.from('a '.repeat(15000), 'utf8') });
    await expect(page.locator('[data-k="rd-note"]')).toContainText('20,000');
    await expect(page.locator('[data-k="rd-count"]')).toContainText('20,000 / 20,000');
    await page.setInputFiles('[data-k="rd-file"]', { name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.from('   ', 'utf8') });
    await expect(page.locator('[data-k="rd-note"]')).toBeVisible();
    expect(reqs).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('นำเข้า .docx: โหลด mammoth ตอนเลือกไฟล์ (ตัวหลอก) แล้วอ่านผ่าน TanotFileReader · โหลดไม่ได้ = ข้อความ', async ({ page }) => {
    let mammothHits = 0;
    await openReader(page, { routes: (pg) => pg.route('**/mammoth*', (r) => { mammothHits++; return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.mammoth={extractRawText:function(){return Promise.resolve({value:"From docx zebra."})}};' }); }) });
    expect(mammothHits).toBe(0);
    await page.setInputFiles('[data-k="rd-file"]', { name: 'a.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('PK') });
    await expect(page.locator('[data-k="rd-input"]')).toHaveValue('From docx zebra.');
    expect(mammothHits).toBe(1);
  });

  test('นำเข้า .docx โหลดตัวอ่านไม่ได้ → ข้อความบอก ไม่ throw', async ({ page }) => {
    const { errors } = await openReader(page, { routes: (pg) => pg.route('**/mammoth*', (r) => r.abort()) });
    await page.setInputFiles('[data-k="rd-file"]', { name: 'a.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK') });
    await expect(page.locator('[data-k="rd-note"]')).toBeVisible();
    expect(errors.filter((e) => !/net::ERR|Failed to load resource/i.test(e))).toEqual([]);
  });

  test('EN: ข้อความ UI แปล · เนื้อหาของผู้ใช้ไม่ถูกแปล', async ({ page }) => {
    await openReader(page, { lang: 'en' });
    await expect(page.locator('[data-k="rd-read"]')).toHaveText('Read');
    await readText(page, 'Hola mundo');
    await expect(page.locator('[data-k="rd-legend"]')).toContainText('Has a card');
    await expect(page.locator('[data-k="rd-edit"]')).toHaveText('Edit text');
    await expect(page.locator('[data-k="rd-text"]')).toHaveText('Hola mundo');
  });

  test('มือถือ 390px: กล่องคำเป็นแผ่นล่าง ไม่ล้นจอ · แตะนอกกล่องปิด', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await openReader(page);
    await readText(page);
    await page.locator('[data-k="rd-word"]', { hasText: /^dog$/ }).click();
    const box = await page.locator('[data-k="rd-dialog"]').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390.5);
    expect(box.y + box.height).toBeGreaterThan(780 - 2);       // ชิดล่างจอ
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= 390)).toBe(true);
    await page.mouse.click(195, 20);
    await expect(page.locator('[data-k="rd-dialog"]')).not.toBeVisible();
  });

  test('review.html: การ์ด ::u:: จากข้อความแสดงประโยคที่เจอใต้คำแปล', async ({ page }) => {
    await prepare(page);
    await page.addInitScript(() => {
      localStorage.setItem('lang-practice:srs', JSON.stringify({ 'lang-en::u::zebra': { dueAt: 1 } }));
      localStorage.setItem('lang-practice:faces', JSON.stringify({ 'lang-en::u::zebra': ['zebra', 'ม้าลาย', 'Serendipity found zebra!'] }));
    });
    await page.goto('/review.html#lang');
    await expect(page.locator('.rv-card .q')).toHaveText('zebra');
    await expect(page.locator('.rv-card .a')).toContainText('ม้าลาย');
    await expect(page.locator('.rv-card .a')).toContainText('Serendipity found zebra!');
  });

  test('data-registry: lang-practice:reader เป็น local เหนือ prefix (ไม่ซิงก์/ไม่สำรอง)', async () => {
    const src = require('fs').readFileSync(path.resolve(__dirname, '..', 'data-registry.js'), 'utf8');
    const i = src.indexOf("key: 'lang-practice:reader'");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(src.indexOf("{ prefix: 'lang-practice:'"));
    expect(src.slice(i, i + 60)).toContain("kind: 'local'");
  });
});
