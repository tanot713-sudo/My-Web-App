// @ts-check
// ภาษา E2 (ROADMAP แถว 34): สมุดคำที่สะกดผิด — known-answer ของ LangCalc.spell + หน้าจริง + ซิงก์ 2 context
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');
const LC = require(path.resolve(__dirname, '..', 'lang-calc.js'));
const S = LC.spell;

const SRV = 'http://localhost:8146';
const NOW = 1790000000000;

// ───────────────────────── ตรรกะล้วน ─────────────────────────
test.describe('LangCalc.spell (ตรรกะล้วน)', () => {
  const KIND_CASES = [
    // [target, typed, kind]
    ['receive', 'recieve', 'vowel-pair'],
    ['believe', 'beleive', 'vowel-pair'],
    ['weird', 'wierd', 'vowel-pair'],
    ['foreign', 'foriegn', 'vowel-pair'],
    ['beach', 'beech', 'vowel-pair'],
    ['meet', 'meat', 'vowel-pair'],
    ['sea', 'see', 'vowel-pair'],
    ['pay', 'pai', 'vowel-pair'],
    ['beautiful', 'beutiful', 'vowel-pair'],
    ['language', 'langauge', 'vowel-pair'],
    ['coffee', 'coffe', 'vowel-pair'],
    ['separate', 'seperate', 'vowel-swap'],
    ['definitely', 'definately', 'vowel-swap'],
    ['definite', 'definate', 'vowel-swap'],
    ['grammar', 'grammer', 'vowel-swap'],
    ['system', 'sistem', 'vowel-swap'],
    ['different', 'diffrent', 'vowel-swap'],
    ['occurred', 'occured', 'double'],
    ['necessary', 'neccessary', 'double'],
    ['accommodate', 'accomodate', 'double'],
    ['tomorrow', 'tommorow', 'double'],
    ['apple', 'aple', 'double'],
    ['hello', 'helo', 'double'],
    ['coffee', 'cofee', 'double'],
    ['write', 'writ', 'silent-e'],
    ['hope', 'hop', 'silent-e'],
    ['hop', 'hope', 'silent-e'],
    ['independent', 'independant', 'suffix'],
    ['important', 'importent', 'suffix'],
    ['possible', 'possable', 'suffix'],
    ['responsible', 'responsable', 'suffix'],
    ['attention', 'attension', 'suffix'],
    ['decision', 'decistion', 'suffix'],
    ['importance', 'importence', 'suffix'],
    ['café', 'cafe', 'accent'],
    ['niño', 'nino', 'accent'],
    ['which', 'wich', 'other'],
    ['ocean', 'oshun', 'other'],
    ['science', 'sciense', 'other'],
    ['rhythm', 'rythm', 'other'],
    ['library', 'libary', 'other'],
  ];
  for (const [t, ty, k] of KIND_CASES) {
    test(`diffKind: ${t} ← ${ty} = ${k}`, () => { expect(S.diffKind(t, ty)).toBe(k); });
  }

  test('diffKind: เหมือนกัน/ต่างแค่ตัวพิมพ์/ช่องว่างขอบ = "" (ไม่ใช่การสะกดผิด)', () => {
    expect(S.diffKind('cat', 'cat')).toBe('');
    expect(S.diffKind('Cat', 'cat')).toBe('');
    expect(S.diffKind(' cat ', 'CAT')).toBe('');
    expect(S.diffKind('', '')).toBe('');
  });

  test('diffKind: หลายจุดผิด = รูปแบบหลักตามลำดับความสำคัญ (suffix > silent-e > double > vowel-pair > vowel-swap > accent)', () => {
    expect(S.diffKind('accommodate', 'acomodete')).toBe('double'); // ซ้ำตัว + สระ a→e → double ก่อน
    expect(S.diffKind('independent', 'indepandent')).toBe('vowel-swap');
    expect(S.diffKind('definite', 'definate')).toBe('vowel-swap');
    expect(S.diffKind('responsible', 'responsable')).toBe('suffix');
  });

  test('KINDS เรียงตามลำดับความสำคัญ + other ท้ายสุด', () => {
    expect(S.KINDS).toEqual(['suffix', 'silent-e', 'double', 'vowel-pair', 'vowel-swap', 'accent', 'other']);
  });

  test('wordsOf: คำที่สะกดผิดในประโยค + รูปแบบ', () => {
    expect(S.wordsOf('I received the package', 'I recieved the package')).toEqual([{ word: 'received', typed: 'recieved', kind: 'vowel-pair' }]);
    expect(S.wordsOf('The definite separate thing', 'The definate seperate thing')).toEqual([
      { word: 'definite', typed: 'definate', kind: 'vowel-swap' },
      { word: 'separate', typed: 'seperate', kind: 'vowel-swap' },
    ]);
  });
  test('wordsOf: เหมือนกัน / ต่างแค่ตัวพิมพ์-วรรคตอน-อะพอสทรอฟี = ไม่มีคำผิด', () => {
    expect(S.wordsOf('See you tomorrow.', 'See you tomorrow.')).toEqual([]);
    expect(S.wordsOf('See you tomorrow.', 'see you tomorrow')).toEqual([]);
    expect(S.wordsOf("I don't know", 'I dont know')).toEqual([]);
  });
  test('wordsOf: คำขาด/คำเกิน/คนละคำ ไม่ใช่การสะกดผิด · คำสั้น < 3 ตัว ข้าม', () => {
    expect(S.wordsOf('a big red car', 'a big car')).toEqual([]);
    expect(S.wordsOf('see you tomorrow', 'see you friday')).toEqual([]);
    expect(S.wordsOf('He will accommodate us.', 'He will accomodate as.')).toEqual([{ word: 'accommodate', typed: 'accomodate', kind: 'double' }]);
  });
  test('wordsOf: ตัวอักษรที่ไม่ใช่ละติน (ญี่ปุ่น/ไทย/อาหรับ) ไม่เข้า · ตัวเลขข้าม', () => {
    expect(S.wordsOf('こんにちは', 'こんにちわ')).toEqual([]);
    expect(S.wordsOf('call 191 now', 'call 192 now')).toEqual([]);
  });
  test('wordsOf: ภาษาที่ใช้อักษรละตินอื่น (เฟรนช์/สเปน) — accent', () => {
    expect(S.wordsOf('Je vais au café', 'Je vais au cafe')).toEqual([{ word: 'café', typed: 'cafe', kind: 'accent' }]);
  });
  test('wordsOf: ค่าไม่ใช่ข้อความ = []', () => {
    expect(S.wordsOf(null, 'x')).toEqual([]);
    expect(S.wordsOf('abc', undefined)).toEqual([]);
  });

  test('nearIn (แต่งประโยค): คำที่ต้องใช้แต่พิมพ์ใกล้เคียง = คำผิด · พิมพ์ถูก/ไม่ใช้เลย = ไม่นับ', () => {
    expect(S.nearIn(['receive', 'believe'], 'I recieve things and belive in them')).toEqual([
      { word: 'receive', typed: 'recieve', kind: 'vowel-pair' },
      { word: 'believe', typed: 'belive', kind: 'vowel-pair' },
    ]);
    expect(S.nearIn(['receive'], 'I receive it')).toEqual([]);
    expect(S.nearIn(['receive'], 'Nothing here')).toEqual([]);
    expect(S.nearIn(['cat'], 'a cot')).toEqual([]); // สั้นเกิน
  });

  test('keyOf: ภาษา::คำตัวพิมพ์เล็ก NFC · ว่าง/ไม่ใช่ละติน/__proto__ = ""', () => {
    expect(S.keyOf('lang-en', ' Receive ')).toBe('lang-en::receive');
    expect(S.keyOf('lang-fr', 'Café')).toBe('lang-fr::café');
    expect(S.keyOf('lang-en', '')).toBe('');
    expect(S.keyOf('lang-jp', 'こんにちは')).toBe('');
    expect(S.keyOf('lang-en', '__proto__')).toBe('');
    expect(S.keyOf('', 'cat')).toBe('');
    expect(S.keyOf('lang-en', 'a'.repeat(41))).toBe('');
  });

  test('record: คำใหม่ → count 1 · ซ้ำ → count เพิ่ม + kinds + last · ไม่แก้ map เดิม', () => {
    const m0 = {};
    const m1 = S.record(m0, 'lang-en', 'receive', 'vowel-pair', NOW);
    expect(m0).toEqual({});
    expect(m1['lang-en::receive']).toEqual({ lang: 'lang-en', word: 'receive', kind: 'vowel-pair', count: 1, last: NOW, kinds: { 'vowel-pair': 1 } });
    const m2 = S.record(m1, 'lang-en', 'Receive', 'vowel-pair', NOW + 5);
    expect(m2['lang-en::receive'].count).toBe(2);
    expect(m2['lang-en::receive'].last).toBe(NOW + 5);
    expect(m2['lang-en::receive'].kinds).toEqual({ 'vowel-pair': 2 });
    expect(m1['lang-en::receive'].count).toBe(1);
  });
  test('record: รูปแบบที่เจอบ่อยสุดเป็น kind หลัก (เท่ากัน = ล่าสุดชนะ)', () => {
    let m = S.record({}, 'lang-en', 'tomorrow', 'double', NOW);
    m = S.record(m, 'lang-en', 'tomorrow', 'vowel-swap', NOW + 1);
    expect(m['lang-en::tomorrow'].kind).toBe('vowel-swap');
    m = S.record(m, 'lang-en', 'tomorrow', 'double', NOW + 2);
    expect(m['lang-en::tomorrow'].kind).toBe('double');
    expect(m['lang-en::tomorrow'].kinds).toEqual({ double: 2, 'vowel-swap': 1 });
  });
  test('record: ปฏิเสธ __proto__ / รูปแบบแปลก / คำไม่ใช่ละติน (คืน map เดิม)', () => {
    const m = S.record({}, 'lang-en', 'cat', 'double', NOW);
    expect(S.record(m, 'lang-en', '__proto__', 'double', NOW)).toBe(m);
    expect(S.record(m, 'lang-en', 'dog', 'nonsense', NOW)).toBe(m);
    expect(S.record(m, 'lang-jp', 'こんにちは', 'other', NOW)).toBe(m);
    expect(Object.keys(m)).toEqual(['lang-en::cat']);
    expect(({}).polluted).toBeUndefined();
  });
  test('record: เพดาน 500 คำ ตัดที่ last เก่าสุด', () => {
    let m = {};
    for (let i = 0; i < 500; i++) m = S.record(m, 'lang-en', 'w' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + ((i / 26) | 0) % 26) + String.fromCharCode(97 + ((i / 676) | 0)), 'other', NOW + i);
    expect(Object.keys(m).length).toBe(500);
    m = S.record(m, 'lang-en', 'newest', 'other', NOW + 9999);
    expect(Object.keys(m).length).toBe(500);
    expect(m['lang-en::newest']).toBeTruthy();
    expect(Object.values(m).some((e) => e.last === NOW)).toBe(false); // คำเก่าสุดหลุด
  });
  test('recordAll: บันทึกหลายคู่ในครั้งเดียว', () => {
    const m = S.recordAll({}, 'lang-en', [{ word: 'received', typed: 'recieved', kind: 'vowel-pair' }, { word: 'definite', typed: 'definate', kind: 'vowel-swap' }], NOW);
    expect(Object.keys(m).sort()).toEqual(['lang-en::definite', 'lang-en::received']);
    expect(S.recordAll(m, 'lang-en', [], NOW)).toBe(m);
  });

  test('clean: ข้อมูลที่ซิงก์มา — ทิ้งแถวผิดรูป/__proto__/คีย์ไม่ตรงคำ · แก้ค่าติดลบ/ไม่ใช่เลข', () => {
    const raw = JSON.parse('{"__proto__":{"word":"x","count":1},"lang-en::cat":{"lang":"lang-en","word":"cat","kind":"double","count":3,"last":5,"kinds":{"double":3}},' +
      '"lang-en::bad":{"lang":"lang-en","word":"other","kind":"double","count":1,"last":1,"kinds":{"double":1}},' +
      '"lang-en::neg":{"lang":"lang-en","word":"neg","kind":"zzz","count":-4,"last":"x","kinds":{"zzz":2,"double":-1}},' +
      '"lang-en::str":"nope","lang-en::arr":[1],"lang-jp::ひら":{"lang":"lang-jp","word":"ひら","kind":"other","count":1,"last":1,"kinds":{}}}');
    const c = S.clean(raw);
    expect(Object.keys(c).sort()).toEqual(['lang-en::cat', 'lang-en::neg']);
    expect(c['lang-en::cat']).toEqual({ lang: 'lang-en', word: 'cat', kind: 'double', count: 3, last: 5, kinds: { double: 3 } });
    expect(c['lang-en::neg'].count).toBe(1);
    expect(c['lang-en::neg'].kind).toBe('other');
    expect(c['lang-en::neg'].last).toBe(0);
    expect(S.clean(null)).toEqual({});
    expect(S.clean([1, 2])).toEqual({});
    expect(S.clean('x')).toEqual({});
  });
  test('clean: เกิน 500 = ตัดที่ last เก่าสุด', () => {
    const o = {};
    const wd = (i) => 'x' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + ((i / 26) | 0) % 26) + String.fromCharCode(97 + ((i / 676) | 0));
    for (let i = 0; i < 520; i++) { const w = wd(i); o['lang-en::' + w] = { lang: 'lang-en', word: w, kind: 'other', count: 1, last: i, kinds: { other: 1 } }; }
    const c = S.clean(o);
    expect(Object.keys(c).length).toBe(500);
    expect(Object.values(c).every((e) => e.last >= 20)).toBe(true);
  });

  test('groups: จัดกลุ่มตามรูปแบบหลัก เรียงตามจำนวนครั้ง · กรองตามภาษา', () => {
    let m = {};
    m = S.record(m, 'lang-en', 'receive', 'vowel-pair', NOW);
    m = S.record(m, 'lang-en', 'receive', 'vowel-pair', NOW + 1);
    m = S.record(m, 'lang-en', 'believe', 'vowel-pair', NOW + 2);
    m = S.record(m, 'lang-en', 'occurred', 'double', NOW + 3);
    m = S.record(m, 'lang-fr', 'café', 'accent', NOW + 4);
    const g = S.groups(m, 'lang-en');
    expect(g.map((x) => x.kind)).toEqual(['vowel-pair', 'double']);
    expect(g[0]).toMatchObject({ kind: 'vowel-pair', total: 3, n: 2 });
    expect(g[0].words.map((e) => e.word)).toEqual(['receive', 'believe']);
    expect(g[1].words.map((e) => e.word)).toEqual(['occurred']);
    expect(S.groups(m, 'lang-fr').map((x) => x.kind)).toEqual(['accent']);
    expect(S.groups(m, 'lang-de')).toEqual([]);
    expect(S.groups({}, 'lang-en')).toEqual([]);
  });
  test('groups: จำนวนครั้งเท่ากัน = รูปแบบตามลำดับ KINDS · คำเท่ากัน = ล่าสุดก่อน', () => {
    let m = S.record({}, 'lang-en', 'aaa', 'double', NOW);
    m = S.record(m, 'lang-en', 'bbb', 'suffix', NOW + 1);
    expect(S.groups(m, 'lang-en').map((x) => x.kind)).toEqual(['suffix', 'double']);
    m = S.record(m, 'lang-en', 'ccc', 'suffix', NOW + 5);
    expect(S.groups(m, 'lang-en')[0].words.map((e) => e.word)).toEqual(['ccc', 'bbb']);
  });

  test('remove: ลบรายคำ ไม่แก้ map เดิม · ไม่มี = คืนเดิม', () => {
    const m = S.record({}, 'lang-en', 'receive', 'vowel-pair', NOW);
    const r = S.remove(m, 'lang-en::receive');
    expect(r).toEqual({});
    expect(m['lang-en::receive']).toBeTruthy();
    expect(S.remove(m, 'lang-en::nope')).toBe(m);
    expect(S.remove(m, '__proto__')).toBe(m);
  });

  test('eligible: ภาษาที่ใช้อักษรละติน (ไม่ผูกอังกฤษ)', () => {
    expect(S.eligible('lang-en')).toBe(true);
    expect(S.eligible('lang-fr')).toBe(true);
    expect(S.eligible('lang-vn')).toBe(true);
    expect(S.eligible('lang-jp')).toBe(false);
    expect(S.eligible('lang-cn')).toBe(false);
    expect(S.eligible('lang-ru')).toBe(false);
    expect(S.eligible('lang-ar')).toBe(false);
  });
});

// ───────────────────────── หน้าจริง ─────────────────────────
const fs = require('fs');
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'languages.html'), 'utf8');
const jsonBlock = (id) => JSON.parse(HTML.match(new RegExp('<script id="' + id + '"[^>]*>([\\s\\S]*?)</script>'))[1]);
const EN_PHRASE = (() => { const ph = jsonBlock('lang-data')['lang-en'].phrases; return ph[Object.keys(ph)[0]][0].target; })(); // 'Hello, nice to meet you.'
const EN_VOCAB = jsonBlock('vocab-data')['lang-en'];
const EN_CAT0 = Object.keys(EN_VOCAB)[0];
const EN_WORD_IDX = EN_VOCAB[EN_CAT0].findIndex((w) => w.word === 'friend'); // คำที่ใช้ในเทสต์ฟังแล้วเขียน/แต่งประโยค
const EN_SCRIPT_N = jsonBlock('en-script-data').characters.length;
// SRS: ทุกคำอังกฤษเลยกำหนดไปไกล เหลือคำเดียวที่ถึงกำหนด → คิวของโหมดฟังแล้วเขียน/แต่งประโยคเป็นคำนั้นแน่นอน
const SRS_ONLY_FRIEND = (() => {
  const m = {}, far = 4e12;
  Object.keys(EN_VOCAB).forEach((c) => EN_VOCAB[c].forEach((_, i) => { m[`lang-en::vocab-${c}::${i}`] = { dueAt: far }; }));
  for (let i = 0; i < EN_SCRIPT_N; i++) m[`lang-en::script::${i}`] = { dueAt: far };
  delete m[`lang-en::vocab-${EN_CAT0}::${EN_WORD_IDX}`];
  return m;
})();
const misspell = (text) => text.replace(/[A-Za-z]{5,}/, (w) => w.slice(0, 2) + w.slice(3));

async function open(page, hash, o = {}) {
  const errors = await prepare(page);
  const apiReqs = [];
  page.on('request', (r) => { if (/\/api\//.test(r.url())) apiReqs.push(r.url()); });
  await page.addInitScript(({ seed, lang }) => {
    if (lang) localStorage.setItem('ome:lang', lang);
    if (seed && !localStorage.getItem('__seeded')) { Object.keys(seed).forEach((k) => localStorage.setItem(k, typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k]))); localStorage.setItem('__seeded', '1'); }
    if (window.__sync) window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
  }, { seed: o.seed, lang: o.lang });
  if (o.sync) await page.addInitScript(() => { window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 }; });
  await page.goto('/languages.html' + (hash || ''));
  await page.waitForSelector('nav.ome-nav');
  return { errors, apiReqs };
}
const spellStore = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('lang-practice:spell') || '{}'));

test('ฝึกฝน (พิมพ์คำแปล): พิมพ์ผิดหนึ่งคำ → เข้าสมุด ใช้ชนิดตรงกับ known-answer · พิมพ์ถูกไม่เข้า · ไม่เรียก /api/ocr', async ({ page }) => {
  const { errors, apiReqs } = await open(page, '#lang-en');
  const typed = misspell(EN_PHRASE); // Helo, nice to meet you.
  const exp = S.wordsOf(EN_PHRASE, typed);
  expect(exp).toEqual([{ word: 'hello', typed: 'helo', kind: 'double' }]);
  await page.fill('[data-k="answer"]', typed);
  await page.click('[data-k="check"]');
  const st = await spellStore(page);
  expect(Object.keys(st)).toEqual(['lang-en::hello']);
  expect(st['lang-en::hello']).toMatchObject({ lang: 'lang-en', word: 'hello', kind: 'double', count: 1, kinds: { double: 1 } });
  // ประโยคถัดไปพิมพ์ถูก → ไม่เพิ่มอะไร
  await page.click('[data-k="next"]');
  await page.fill('[data-k="answer"]', 'My name is ...');
  await page.click('[data-k="check"]');
  expect(await spellStore(page)).toEqual(st);
  expect(apiReqs.filter((u) => /\/api\/ocr/.test(u))).toEqual([]);
  expect(errors).toEqual([]);
});

test('ฟังแล้วเขียน: พิมพ์ผิด → เข้าสมุด · ครั้งที่สองคำเดิม = count 2 · สมุดคำแสดงกลุ่ม/จำนวน · ลบรายคำ', async ({ page }) => {
  const { errors } = await open(page, '', { seed: { 'lang-practice:srs': SRS_ONLY_FRIEND } });
  await page.click('[data-k="tab-writing"]');
  await page.click('[data-k="sub-dictation"]');
  for (let round = 1; round <= 2; round++) {
    await page.fill('[data-k="dictInput"]', 'freind');
    await page.click('[data-k="dictCheck"]');
    await expect.poll(async () => ((await spellStore(page))['lang-en::friend'] || {}).count).toBe(round);
    if (round === 1) {
      // ถึงกำหนดคำเดียว — ตอบแล้ว SRS เลื่อนกำหนดออกไป คิวว่าง: ทำให้ถึงกำหนดอีกครั้งแล้วโหลดหน้าใหม่
      await page.evaluate((k) => { const m = JSON.parse(localStorage.getItem('lang-practice:srs')); m[k] = { dueAt: 0 }; localStorage.setItem('lang-practice:srs', JSON.stringify(m)); }, `lang-en::vocab-${EN_CAT0}::${EN_WORD_IDX}`);
      await page.reload();
      await page.click('[data-k="tab-writing"]');
      await page.click('[data-k="sub-dictation"]');
    }
  }
  const st = await spellStore(page);
  expect(st['lang-en::friend']).toMatchObject({ kind: 'vowel-pair', count: 2 });
  await page.click('[data-k="sub-spell"]');
  const g = page.locator('[data-k="spell-group"][data-kind="vowel-pair"]');
  await expect(g).toContainText('สระคู่');
  await expect(g.locator('[data-k="spell-count"]')).toContainText('1 คำ · 2 ครั้ง');
  await expect(g.locator('[data-k="spell-word"]')).toContainText('friend');
  await g.locator('[data-k="spell-del"]').click();
  await expect(page.locator('[data-k="spell-empty"]')).toBeVisible();
  expect(await spellStore(page)).toEqual({});
  expect(errors).toEqual([]);
});

test('แต่งจากคำที่ทวน: ใช้คำที่ต้องใช้แต่พิมพ์ผิด → เข้าสมุด · พิมพ์ถูกไม่เข้า', async ({ page }) => {
  const { errors } = await open(page, '', { seed: { 'lang-practice:srs': SRS_ONLY_FRIEND } });
  await page.click('[data-k="tab-writing"]');
  await page.click('[data-k="sub-srsCompose"]');
  await page.locator('textarea.textarea').first().fill('My friend is here');
  await page.click('[data-k="checkUsage"]');
  expect(await spellStore(page)).toEqual({});
  // พิมพ์ถูกแล้ว SRS เลื่อนกำหนดออกไป — ทำให้ถึงกำหนดอีกครั้งแล้วโหลดหน้าใหม่
  await page.evaluate((k) => { const m = JSON.parse(localStorage.getItem('lang-practice:srs')); m[k] = { dueAt: 0 }; localStorage.setItem('lang-practice:srs', JSON.stringify(m)); }, `lang-en::vocab-${EN_CAT0}::${EN_WORD_IDX}`);
  await page.reload();
  await page.click('[data-k="tab-writing"]');
  await page.click('[data-k="sub-srsCompose"]');
  await page.locator('textarea.textarea').first().fill('My freind is here');
  await page.click('[data-k="checkUsage"]');
  expect((await spellStore(page))['lang-en::friend']).toMatchObject({ kind: 'vowel-pair', count: 1 });
  expect(errors).toEqual([]);
});

test('ภาษาที่ไม่ใช่อักษรละติน (ญี่ปุ่น): ไม่มีแท็บสมุดคำ · พิมพ์ผิดไม่เขียนคีย์', async ({ page }) => {
  const { errors } = await open(page, '#lang-jp');
  await page.fill('[data-k="answer"]', 'ばばば');
  await page.click('[data-k="check"]');
  expect(await spellStore(page)).toEqual({});
  await page.click('[data-k="tab-writing"]');
  await expect(page.locator('[data-k="sub-spell"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

const SEED_SPELL = (() => {
  let m = {};
  m = S.record(m, 'lang-en', 'receive', 'vowel-pair', NOW);
  m = S.record(m, 'lang-en', 'receive', 'vowel-pair', NOW + 1);
  m = S.record(m, 'lang-en', 'believe', 'vowel-pair', NOW + 2);
  m = S.record(m, 'lang-en', 'occurred', 'double', NOW + 3);
  m = S.record(m, 'lang-fr', 'café', 'accent', NOW + 4);
  return m;
})();

test('สมุดคำ: จัดกลุ่มตามรูปแบบ · ฝึกกลุ่มนี้ (ถูก = ข้ามไปข้อต่อไป + XP · ผิด = จดซ้ำ count เพิ่ม) · EN ไม่มีไทยหลุด · ภาษาอื่นไม่ปน', async ({ page }) => {
  const { errors } = await open(page, '', { seed: { 'lang-practice:spell': SEED_SPELL }, lang: 'en' });
  await page.click('[data-k="tab-writing"]');
  await page.click('[data-k="sub-spell"]');
  const book = page.locator('[data-k="spell-book"]');
  await expect(book.locator('[data-k="spell-group"]')).toHaveCount(2);
  await expect(book.locator('[data-k="spell-group"]').first()).toHaveAttribute('data-kind', 'vowel-pair'); // 3 ครั้ง > 1 ครั้ง
  await expect(book.locator('[data-k="spell-group"]').first().locator('[data-k="spell-count"]')).toHaveText('2 words · 3 times');
  await expect(book).not.toContainText('café'); // ฝรั่งเศสไม่ปนในหน้าภาษาอังกฤษ
  expect(await book.innerText()).not.toMatch(/[฀-๿]/);
  // ฝึก vowel-pair: receive (2 ครั้ง) มาก่อน
  await page.locator('[data-k="spell-group"][data-kind="vowel-pair"] [data-k="spell-drill-btn"]').click();
  await page.fill('[data-k="spell-input"]', 'recieve');
  await page.click('[data-k="spell-check"]');
  await expect(page.locator('[data-k="spell-wrong"]')).toContainText('receive');
  await page.click('[data-k="spell-next"]');
  await page.fill('[data-k="spell-input"]', 'believe');
  await page.click('[data-k="spell-check"]');
  await expect(page.locator('[data-k="spell-correct"]')).toBeVisible();
  await page.click('[data-k="spell-next"]');
  await expect(page.locator('[data-k="spell-done"]')).toBeVisible();
  await page.click('[data-k="spell-back"]');
  const st = await spellStore(page);
  expect(st['lang-en::receive'].count).toBe(3); // ตอบผิดจดซ้ำ
  expect(st['lang-en::believe'].count).toBe(1); // ตอบถูกไม่เพิ่ม
  expect(st['lang-fr::café'].count).toBe(1);
  const xp = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:learn:xp') || '[]').filter((r) => r.src === 'lang').reduce((s, r) => s + r.xp, 0));
  expect(xp).toBeGreaterThanOrEqual(10);
  expect(errors).toEqual([]);
});

test('ข้อมูลซิงก์ที่ผิดรูป (__proto__, ค่าติดลบ, คีย์ไม่ตรงคำ) ถูกล้างก่อนใช้ — หน้าไม่พัง', async ({ page }) => {
  const raw = '{"__proto__":{"word":"x","count":9},"lang-en::cat":{"lang":"lang-en","word":"cat","kind":"double","count":-5,"last":"x","kinds":{"zzz":1}},"lang-en::fake":{"lang":"lang-en","word":"other","kind":"double","count":1,"last":1,"kinds":{}},"lang-en::str":"nope"}';
  const { errors } = await open(page, '', { seed: { 'lang-practice:spell': raw } });
  await page.click('[data-k="tab-writing"]');
  await page.click('[data-k="sub-spell"]');
  await expect(page.locator('[data-k="spell-word"]')).toHaveCount(1);
  await expect(page.locator('[data-k="spell-word"]')).toContainText('cat');
  await expect(page.locator('[data-k="spell-word"]')).toContainText('1×');
  expect(await page.evaluate(() => ({}).word)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('data-registry: lang-practice:spell เป็น sync map เหนือ prefix · wrong ไม่ถูกแก้', async () => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'data-registry.js'), 'utf8');
  const i = src.indexOf("key: 'lang-practice:spell'");
  expect(i).toBeGreaterThan(0);
  expect(i).toBeLessThan(src.indexOf("{ prefix: 'lang-practice:'"));
  expect(src.slice(i, i + 60)).toContain("mode: 'map'");
  expect(src).toContain("{ key: 'lang-practice:wrong', kind: 'sync', mode: 'map' }");
});

// ───────────────────────── ซิงก์ 2 เครื่อง ─────────────────────────
test.describe('ซิงก์ 2 เครื่อง (พอร์ต 8146)', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('2 เครื่องจดคนละคำ → รวมกัน · สมุดวาดใหม่เอง (ไม่เด้งแถบโหลดใหม่) · ลบที่เครื่อง A ไปถึง B', async ({ browser }) => {
    const mk = async () => {
      const ctx = await browser.newContext({ baseURL: SRV });
      const page = await ctx.newPage();
      const o = await open(page, '', { sync: true });
      return { ctx, page, errors: o.errors };
    };
    const A = await mk(), B = await mk();
    const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));
    const both = async () => { for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); } };
    for (const d of [A, B]) { await d.page.click('[data-k="tab-writing"]'); await d.page.click('[data-k="sub-spell"]'); }

    // A จดผ่านหน้า (ฝึกฝน → พิมพ์ผิด 'Hello') แล้วกลับไปสมุด · B จดคำอื่นลง localStorage ตรงๆ (ผ่าน setItem ที่ดักซิงก์)
    await A.page.goto('/languages.html?r=1#lang-en');
    await A.page.fill('[data-k="answer"]', misspell(EN_PHRASE));
    await A.page.click('[data-k="check"]');
    expect(Object.keys(await spellStore(A.page))).toEqual(['lang-en::hello']);
    await B.page.evaluate((v) => {
      const m = JSON.parse(localStorage.getItem('lang-practice:spell') || '{}');
      m['lang-en::receive'] = v;
      localStorage.setItem('lang-practice:spell', JSON.stringify(m));
    }, S.record({}, 'lang-en', 'receive', 'vowel-pair', NOW)['lang-en::receive']);
    await both();
    for (const d of [A, B]) expect(Object.keys(await spellStore(d.page)).sort()).toEqual(['lang-en::hello', 'lang-en::receive']);
    // B ยังอยู่ที่สมุด — เห็นคำของ A โดยไม่ reload และไม่มีแถบโหลดใหม่
    await expect(B.page.locator('[data-k="spell-word"]')).toHaveCount(2);
    await expect(B.page.locator('.ome-reload-bar, [data-reload-bar]')).toHaveCount(0);

    // A ลบ 'hello' (นาฬิกา A เดินหน้า) → B หายตาม
    await A.page.click('[data-k="tab-writing"]');
    await A.page.click('[data-k="sub-spell"]');
    await A.page.clock.setFixedTime(new Date(Date.now() + 120000));
    await A.page.locator('[data-k="spell-word"]', { hasText: 'hello' }).locator('[data-k="spell-del"]').click();
    await both();
    expect(Object.keys(await spellStore(B.page))).toEqual(['lang-en::receive']);
    for (const d of [A, B]) expect(d.errors).toEqual([]);
    await A.ctx.close(); await B.ctx.close();
  });
});
