// @ts-check
// ภาษา L2 (ROADMAP แถว 23, docs/languages-design.md L2): เกมเติมคำ / เรียงประโยค / จับคู่ ในหน้า languages
//   known-answer ของ LangCalc (บล็อก "L2 เกม") + หน้าจริงกับ pack ปลอมที่สร้างในเทสต์
const zlib = require('zlib');
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');
const LC = require('../lang-calc.js');

// ── pack ปลอม: คำระดับ 1 หลายตัว + คำระดับไกล (6) ไว้เช็กว่าตัวหลอกเลือกระดับใกล้ก่อน
const WORDS = [['the', 1, 'คำนำหน้านาม'], ['cat', 2, 'แมว'], ['sleeps', 3, 'นอน'], ['dog', 4, 'หมา'], ['runs', 5, 'วิ่ง'], ['fast', 6, 'เร็ว'], ['bird', 7, 'นก'], ['flies', 8, 'บิน'],
  ['quietly', 9000, 'อย่างเงียบๆ'], ['house', 600, 'บ้าน'], ['big', 601, 'ใหญ่']];
const PACK = {
  v: 2, lang: 'lang-en', src: {},
  w: WORDS.map(([id, r, th]) => ({ id, r, th, ipa: '' })),
  s: [
    { id: 20, t: 'The cat sleeps.', th: 'แมวนอน', en: 'The cat sleeps.' },
    { id: 31, t: 'The cat sleeps quietly.', th: '', en: 'The cat sleeps quietly.' },
    { id: 40, t: 'The dog runs fast.', th: 'หมาวิ่งเร็ว', en: '' },
    { id: 41, t: 'The bird flies.', th: 'นกบิน', en: '' },
  ],
};
const prep = LC.prepare(PACK, 'lang-en');

test('spans: ตำแหน่งคำในประโยค (ตรงกับ tokenize)', () => {
  expect(LC.spans("Let's go, Cat!", 'en')).toEqual([{ start: 0, end: 5, tok: "let's" }, { start: 6, end: 8, tok: 'go' }, { start: 10, end: 13, tok: 'cat' }]);
  ['The cat sleeps.', "Let's go, Cat!", 'été'].forEach((t) => expect(LC.spans(t, 'en').map((x) => x.tok)).toEqual(LC.tokenize(t, 'en')));
  ['私は猫が好きです。', '我喜欢看书。'].forEach((t, i) => { const c = i ? 'zh' : 'ja'; expect(LC.spans(t, c).map((x) => x.tok)).toEqual(LC.tokenize(t, c)); });
});

test('rng/shuffle: seed เดิมได้ผลเดิม · เป็นการสลับที่ครบ ไม่แก้ต้นฉบับ', () => {
  const a = LC.rng(7), b = LC.rng(7), c = LC.rng(8);
  const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
  expect(sa).toEqual(sb);
  expect(sa).not.toEqual(sc);
  sa.forEach((x) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); });
  const src = [1, 2, 3, 4, 5, 6];
  const s1 = LC.shuffle(src, 3);
  expect(src).toEqual([1, 2, 3, 4, 5, 6]);
  expect(s1.slice().sort()).toEqual(src);
  expect(LC.shuffle(src, 3)).toEqual(s1);
  expect([1, 2, 3, 4, 5, 6, 7, 8].map((s) => LC.shuffle(src, s).join()).filter((v, i, ar) => ar.indexOf(v) === i).length).toBeGreaterThan(3);
});

test('cloze: ซ่อนคำ + ตัวเลือก 4 ตัว (หลอกระดับใกล้, ไม่ซ้ำ, ไม่อยู่ในประโยค), seed เดิมได้เหมือนเดิม', () => {
  const q = LC.cloze(prep, prep.sents[0], 'cat', 5);
  expect(q.before).toBe('The ');
  expect(q.after).toBe(' sleeps.');
  expect(q.answer).toBe('cat');
  expect(q.options).toHaveLength(4);
  expect(q.options[q.correct]).toBe('cat');
  expect(new Set(q.options).size).toBe(4);
  q.options.forEach((o, i) => { if (i !== q.correct) expect(['cat', 'the', 'sleeps']).not.toContain(o); });
  // ระดับ: 'cat' = A1 → หลอกต้องไม่ใช่ 'quietly' (C2) เมื่อมีคำระดับ 1–2 พอ
  for (let s = 0; s < 20; s++) expect(LC.cloze(prep, prep.sents[0], 'cat', s).options).not.toContain('quietly');
  expect(LC.cloze(prep, prep.sents[0], 'cat', 5)).toEqual(q);
  const corrects = new Set(); for (let s = 0; s < 30; s++) corrects.add(LC.cloze(prep, prep.sents[0], 'cat', s).correct);
  expect(corrects.size).toBeGreaterThan(1);
});

test('cloze: คงตัวพิมพ์ในประโยค · ไม่มีคำในประโยค/ไม่มีตัวหลอก = null · ตัวหลอกน้อยได้ตัวเลือกน้อยลง', () => {
  const p = LC.prepare({ v: 2, lang: 'lang-en', w: [{ id: 'cat', r: 1 }, { id: 'dog', r: 2 }, { id: 'sleeps', r: 3 }], s: [{ id: 1, t: 'Cat sleeps.' }] }, 'lang-en');
  const q = LC.cloze(p, p.sents[0], 'cat', 1);
  expect(q.answer).toBe('Cat');
  expect(q.before).toBe('');
  expect(q.options).toHaveLength(2);           // ตัวหลอกมีแค่ dog (sleeps อยู่ในประโยค)
  expect(q.options[q.correct]).toBe('cat');
  expect(LC.cloze(p, p.sents[0], 'dog', 1)).toBeNull();
  const lone = LC.prepare({ v: 2, lang: 'lang-en', w: [{ id: 'cat', r: 1 }], s: [{ id: 1, t: 'Cat.' }] }, 'lang-en');
  expect(LC.cloze(lone, lone.sents[0], 'cat', 1)).toBeNull();
});

test('cloze: ภาษาไม่เว้นวรรค (ญี่ปุ่น) ซ่อนตามขอบคำของ Segmenter', () => {
  const p = LC.prepare({ v: 2, lang: 'lang-jp', w: [{ id: '私', r: 1 }, { id: '猫', r: 2 }, { id: '好き', r: 3 }, { id: '犬', r: 4 }, { id: '本', r: 5 }], s: [{ id: 1, t: '私は猫が好きです。' }] }, 'lang-jp');
  const q = LC.cloze(p, p.sents[0], '猫', 2);
  expect(q.before + q.answer + q.after).toBe('私は猫が好きです。');
  expect(q.answer).toBe('猫');
  expect(q.options[q.correct]).toBe('猫');
});

test('scramble: แบ่งชิ้นตามภาษา · สลับด้วย seed ไม่เท่าลำดับเดิม · เกิน 12 ชิ้นหรือน้อยกว่า 3 = null', () => {
  const g = LC.scramble('The cat sleeps quietly.', 'en', 4);
  expect(g.pieces.map((x) => x.t)).toEqual(['The', 'cat', 'sleeps', 'quietly.']);
  expect(g.order.slice().sort()).toEqual([0, 1, 2, 3]);
  expect(g.order).not.toEqual([0, 1, 2, 3]);
  expect(LC.scramble('The cat sleeps quietly.', 'en', 4)).toEqual(g);
  expect(LC.scramble('Hello world', 'en', 1)).toBeNull();
  expect(LC.scramble('a b c d e f g h i j k l m', 'en', 1)).toBeNull();
  expect(LC.scramble('a b c d e f g h i j k l', 'en', 1).pieces).toHaveLength(12);
  const jp = LC.scramble('私は猫が好きです。', 'ja', 2);
  expect(jp.pieces.map((x) => x.t).join('')).toBe('私は猫が好きです。');
  expect(jp.pieces.length).toBeGreaterThanOrEqual(3);
  expect(jp.pieces.length).toBeLessThanOrEqual(12);
});

test('scramble: ไม่มี Intl.Segmenter = ทีละตัวอักษร รวมเป็น ≤ 12 ชิ้น', () => {
  const g = LC.scramble('私は猫が好きです。', 'ja', 2, { noSegmenter: true });
  expect(g.pieces.map((x) => x.t)).toEqual(['私', 'は', '猫', 'が', '好', 'き', 'で', 'す', '。']);
  const long = LC.scramble('一二三四五六七八九十一二三四五', 'zh', 2, { noSegmenter: true });
  expect(long.pieces.length).toBeLessThanOrEqual(12);
  expect(long.pieces.map((x) => x.t).join('')).toBe('一二三四五六七八九十一二三四五');
});

test('checkOrder: ชิ้นซ้ำสลับกันได้ · นับตำแหน่งที่ถูก', () => {
  const g = LC.scramble('a b a c', 'en', 1);
  expect(LC.checkOrder(g, [0, 1, 2, 3])).toEqual({ ok: true, right: 4 });
  expect(LC.checkOrder(g, [2, 1, 0, 3])).toEqual({ ok: true, right: 4 });
  expect(LC.checkOrder(g, [1, 0, 2, 3])).toEqual({ ok: false, right: 2 });
  expect(LC.checkOrder(g, [0, 1])).toEqual({ ok: false, right: 2 });
  expect(LC.checkOrder(g, [0, 1, 2, 3, 3])).toEqual({ ok: false, right: 4 });
});

test('pairs: คำ ↔ คำแปล สลับคอลัมน์ขวาด้วย seed · ข้ามคำไม่มีแปล/แปลซ้ำ · น้อยกว่า 2 = null', () => {
  const items = prep.words.slice(0, 6);
  const p = LC.pairs(items, null, 4, 9);
  expect(p.left).toHaveLength(4);
  expect(p.right).toHaveLength(4);
  expect(p.left.map((x) => x.id)).toEqual(items.slice(0, 4).map((x) => x.id));
  expect(p.right.map((x) => x.id).sort()).toEqual(p.left.map((x) => x.id).sort());
  p.left.forEach((l) => { const r = p.right.find((x) => x.id === l.id); expect(r.text).toBe(LC.thaiOf(items.find((i) => i.id === l.id), null).text); });
  expect(LC.pairs(items, null, 4, 9)).toEqual(p);
  expect(p.right.map((x) => x.id)).not.toEqual(p.left.map((x) => x.id));
  const mixed = [{ key: 'k1', id: 'a', t: 'a', th: 'หนึ่ง' }, { key: 'k2', id: 'b', t: 'b', th: '' }, { key: 'k3', id: 'c', t: 'c', th: 'หนึ่ง' }, { key: 'k4', id: 'd', t: 'd', th: 'สอง' }];
  const q = LC.pairs(mixed, null, 4, 1);
  expect(q.left.map((x) => x.id)).toEqual(['a', 'd']);    // b ไม่มีแปล · c แปลซ้ำกับ a
  expect(LC.pairs(mixed.slice(0, 2), null, 4, 1)).toBeNull();
});

test('gameItems: การ์ดถึงกำหนดก่อน · เฉพาะคำที่เล่นโหมดนั้นได้', () => {
  const srs = { 'lang-en::w::dog': { dueAt: 1 }, 'lang-en::w::house': { dueAt: 2 } };
  const cl = LC.gameItems(prep, srs, { mode: 'cloze', level: 0, n: 5, now: 10 });
  expect(cl[0].id).toBe('dog');            // house ไม่มีประโยค → ข้าม
  expect(cl.map((x) => x.id)).not.toContain('house');
  expect(cl.map((x) => x.id)).not.toContain('big');
  cl.forEach((x) => expect(LC.sentencesFor(prep, x.id, 1).length).toBe(1));
  const pr = LC.gameItems(prep, srs, { mode: 'pairs', level: 0, n: 3, now: 10 });
  expect(pr.map((x) => x.id)).toEqual(['dog', 'house', 'the']);
  const sc = LC.gameItems(prep, {}, { mode: 'scramble', level: 0, n: 20, now: 10 });
  sc.forEach((x) => expect(LC.scrambleFor(prep, x, 3)).not.toBeNull());
  expect(LC.clozeFor(prep, prep.words.find((w) => w.id === 'cat'), 3).answer).toBe('cat');
});

/* ── หน้าจริง ── */
const GZ = zlib.gzipSync(Buffer.from(JSON.stringify(PACK)));
const INDEX = { v: 1, packs: { 'lang-en': { file: 'lang-en-0a1b2c3d.json.gz', words: WORDS.length, sentences: 4, sources: [] } } };
async function openGames(page, mode) {
  const hits = { ocr: 0 };
  await page.route('**/lang-packs/index.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INDEX) }));
  await page.route('**/lang-packs/lang-*', (r) => r.fulfill({ status: 200, contentType: 'application/gzip', body: GZ }));
  await page.route('**/api/ocr**', (r) => { hits.ocr++; return r.fulfill({ status: 500, body: '{}' }); });
  await page.goto('/languages.html#lang-en');
  await page.click('[data-k="src-pack"]');
  await expect(page.locator('[data-k="packCard"]')).toBeVisible();
  await page.click('[data-k="pmode-' + mode + '"]');
  await expect(page.locator('[data-k="gameCard"]')).toBeVisible();
  return hits;
}
const stored = (page) => page.evaluate(() => ({
  srs: JSON.parse(localStorage.getItem('lang-practice:srs') || '{}'),
  faces: JSON.parse(localStorage.getItem('lang-practice:faces') || '{}'),
  xp: Number(JSON.parse(localStorage.getItem('lang-practice:xp') || '0')) || 0,
}));
const TH = Object.fromEntries(WORDS.map(([id, , th]) => [id, th]));

test('หน้า: เติมคำ — เลือกตัวเลือกถูก = การ์ด ::w:: + หน้าการ์ด + XP 2 · ข้อต่อไปได้', async ({ page }) => {
  const errors = await prepare(page);
  const hits = await openGames(page, 'cloze');
  const sentence = (await page.locator('[data-k="clozeSentence"]').innerText()).replace(/\s+/g, ' ').trim();
  const src = PACK.s.find((s) => new RegExp('^' + s.t.replace(/\b(?:the|cat|dog|bird|sleeps|runs|flies|fast|quietly)\b/i, '＿＿＿') + '$').test(sentence));
  expect(src).toBeTruthy();
  const opts = await page.locator('[data-k="clozeOpt"]').allInnerTexts();
  expect(opts).toHaveLength(4);
  const word = (WORDS.map((w) => w[0]).filter((w) => new RegExp('\\b' + w + '\\b', 'i').test(src.t)).find((w) => src.t.replace(new RegExp('\\b' + w + '\\b', 'i'), '＿＿＿') === sentence));
  const idx = opts.findIndex((o) => o.replace(/^\d+\s*/, '').trim() === word);
  expect(idx).toBeGreaterThanOrEqual(0);
  await page.locator('[data-k="clozeOpt"]').nth(idx).click();
  await expect(page.locator('[data-k="gameResult"]')).toHaveAttribute('data-r', 'correct');
  await expect(page.locator('[data-k="clozeBlank"]')).toHaveText(new RegExp(word, 'i'));
  await expect(page.locator('[data-k="gameNext"]')).toBeFocused();
  const st = await stored(page);
  expect(Object.keys(st.srs)).toContain('lang-en::w::' + word);
  expect(st.faces['lang-en::w::' + word]).toEqual([word, TH[word]]);
  expect(st.xp).toBe(2);
  await page.keyboard.press('Enter');                       // ปุ่มข้อต่อไปมีโฟกัส
  await expect(page.locator('[data-k="gameResult"]')).toHaveCount(0);
  expect(hits.ocr).toBe(0);
  expect(errors).toEqual([]);
});

test('หน้า: เติมคำ — ตอบผิด = คะแนน 1 ไม่ได้ XP · กดเลขบนคีย์บอร์ดเลือกข้อได้', async ({ page }) => {
  const errors = await prepare(page);
  await openGames(page, 'cloze');
  await page.locator('[data-k="clozeSentence"]').click();   // ให้โฟกัสอยู่บนหน้า ไม่ใช่ช่องกรอก
  await page.keyboard.press('1');
  await expect(page.locator('[data-k="gameResult"]')).toBeVisible();
  const r = await page.locator('[data-k="gameResult"]').getAttribute('data-r');
  const st = await stored(page);
  expect(Object.keys(st.srs)).toHaveLength(1);
  expect(st.xp).toBe(r === 'correct' ? 2 : 0);
  await page.keyboard.press('2');                            // ตอบแล้ว = ไม่รับซ้ำ
  expect(Object.keys((await stored(page)).srs)).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('หน้า: เรียงประโยค — แตะชิ้นตามลำดับครบ → ตรวจ = ถูก · Backspace เอาชิ้นล่าสุดกลับ', async ({ page }) => {
  const errors = await prepare(page);
  await openGames(page, 'scramble');
  const bankTexts = await page.locator('[data-k="scrPiece"]').allInnerTexts();
  const src = PACK.s.find((s) => s.t.split(' ').slice().sort().join('|') === bankTexts.slice().sort().join('|'));
  expect(src).toBeTruthy();
  await expect(page.locator('[data-k="scrCheck"]')).toBeDisabled();
  const want = src.t.split(' ');
  for (const w of want) await page.locator('[data-k="scrBank"] [data-k="scrPiece"]', { hasText: new RegExp('^' + w.replace(/[.]/g, '\\.') + '$') }).first().click();
  await expect(page.locator('[data-k="scrAnsPiece"]')).toHaveCount(want.length);
  await page.keyboard.press('Backspace');
  await expect(page.locator('[data-k="scrAnsPiece"]')).toHaveCount(want.length - 1);
  await expect(page.locator('[data-k="scrCheck"]')).toBeDisabled();
  await page.locator('[data-k="scrBank"] [data-k="scrPiece"]').first().click();
  await page.click('[data-k="scrCheck"]');
  await expect(page.locator('[data-k="gameResult"]')).toHaveAttribute('data-r', 'correct');
  const st = await stored(page);
  expect(st.xp).toBe(2);
  expect(Object.keys(st.srs)).toHaveLength(1);
  await page.click('[data-k="gameNext"]');
  await expect(page.locator('[data-k="scrAnsPiece"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('หน้า: เรียงประโยค — เรียงผิด = แสดงประโยคที่ถูก ไม่ได้ XP การ์ดได้ 1', async ({ page }) => {
  const errors = await prepare(page);
  await openGames(page, 'scramble');
  const n = await page.locator('[data-k="scrPiece"]').count();
  // วางตามลำดับในคลัง (สลับแล้ว ≠ ลำดับถูก) — ถ้าบังเอิญถูกต้องจะไม่เกิดเพราะ scramble ไม่คืนลำดับเดิม
  for (let i = 0; i < n; i++) await page.locator('[data-k="scrBank"] [data-k="scrPiece"]').first().click();
  await page.click('[data-k="scrCheck"]');
  await expect(page.locator('[data-k="gameResult"]')).toHaveAttribute('data-r', 'wrong');
  await expect(page.locator('[data-k="gameResult"]')).toContainText('The ');
  const st = await stored(page);
  expect(st.xp).toBe(0);
  expect(Object.values(st.srs)).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('หน้า: จับคู่ — คู่ผิดแจ้ง · คู่ถูกล็อก · จับครบ = รอบต่อไป, คู่ที่ผิดก่อนไม่ได้ XP', async ({ page }) => {
  const errors = await prepare(page);
  await openGames(page, 'pairs');
  await expect(page.locator('[data-k="pairL"]')).toHaveCount(5);
  const left = await page.locator('[data-k="pairL"]').evaluateAll((els) => els.map((e) => [e.dataset.id, e.textContent]));
  // ผิดครั้งแรกกับคำแรก
  const first = left[0][0], other = left[1][0];
  await page.locator(`[data-k="pairL"][data-id="${first}"]`).click();
  await page.locator(`[data-k="pairR"][data-id="${other}"]`).click();
  await expect(page.locator('[data-k="pairBad"]')).toBeVisible();
  for (const [id] of left) {
    await page.locator(`[data-k="pairL"][data-id="${id}"]`).click();
    await page.locator(`[data-k="pairR"][data-id="${id}"]`).click();
    await expect(page.locator(`[data-k="pairL"][data-id="${id}"]`)).toBeDisabled();
  }
  await expect(page.locator('[data-k="gameResult"]')).toBeVisible();
  const st = await stored(page);
  expect(Object.keys(st.srs)).toHaveLength(5);
  expect(st.xp).toBe(2 * 3);                  // ผิด 2 คำ (first/other) ไม่ได้ XP
  expect(st.faces['lang-en::w::' + first]).toEqual([first, TH[first]]);
  await page.click('[data-k="gameNext"]');
  await expect(page.locator('[data-k="gameResult"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('หน้า: มือถือ 390px — ปุ่มเกมแตะ ≥ 40px ไม่ล้นแนวนอน · ข้อความกรณีแย่สุด (ประโยคยาว/คำยาว) ไม่ทะลุกรอบ', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const long = 'Supercalifragilisticexpialidocious' + 'x'.repeat(60);
  const pack = JSON.parse(JSON.stringify(PACK));
  pack.w.push({ id: 'tiny', r: 12, th: 'ก'.repeat(80) }, { id: long, r: 13, th: 'ข'.repeat(120) });
  pack.s.push({ id: 90, t: `The cat ${long} quietly sleeps a b c d e f g`, th: 'ค'.repeat(200) });
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(pack)));
  const errors = await prepare(page);
  await page.route('**/lang-packs/index.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INDEX) }));
  await page.route('**/lang-packs/lang-*', (r) => r.fulfill({ status: 200, contentType: 'application/gzip', body: gz }));
  await page.goto('/languages.html#lang-en');
  await page.click('[data-k="src-pack"]');
  for (const mode of ['cloze', 'scramble', 'pairs']) {
    await page.click('[data-k="pmode-' + mode + '"]');
    await expect(page.locator('[data-k="gameCard"]')).toBeVisible();
    const small = await page.locator('[data-k="gameCard"] button:visible').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 39.5).map((e) => e.textContent));
    expect(small, mode).toEqual([]);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, mode).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});

test('หน้า: ภาษาอังกฤษไม่มีไทยหลุดในปุ่ม/ข้อความของเกม (นอกเนื้อหา data-i18n-skip)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('ome:lang', 'en'); } catch (e) {} });
  await prepare(page);
  await openGames(page, 'cloze');
  // ตรวจเฉพาะข้อความของตัวเอง (text node ตรงๆ) + aria-label ของแต่ละ element — ไม่รวมลูกที่เป็นเนื้อหา data-i18n-skip
  const thai = (sel) => page.evaluate((s) => Array.from(document.querySelectorAll(s)).filter((e) => !e.closest('[data-i18n-skip]'))
    .map((e) => (e.getAttribute('aria-label') || '') + ' ' + Array.from(e.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')).filter((t) => /[฀-๿]/.test(t)), sel);
  await page.locator('[data-k="clozeOpt"]').first().click();
  for (const mode of ['cloze', 'scramble', 'pairs']) {
    await page.click('[data-k="pmode-' + mode + '"]');
    await expect(page.locator('[data-k="gameCard"]')).toBeVisible();
    expect(await thai('[data-k="gameCard"], [data-k="gameCard"] *'), mode).toEqual([]);
  }
});
