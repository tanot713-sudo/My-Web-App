// @ts-check
// ภาษา L1 (ROADMAP แถว 22, docs/languages-design.md L1): ชุดคำที่ใช้บ่อย + ประโยคตัวอย่างในหน้า languages
//   known-answer ของ lang-calc.js (คีย์ไม่อิงดัชนี, ระดับ, ตัดคำตรงกับตัวสร้าง tools/lang-data/lib.js, pickNew, AI แปลไทย)
//   + หน้าจริงกับ pack ปลอม (สร้าง .json.gz ในเทสต์ — ไม่มีข้อมูลจริงของแหล่งใดใน repo) + review.html + ซิงก์ 2 เครื่อง
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');
const LCALC = require('../lang-calc.js');

// ตัวสร้าง (แถว 21) อยู่คนละ branch — มีไฟล์เมื่อไรเทียบเมื่อนั้น (ชี้ที่อื่นได้ด้วย LANG_DATA_LIB)
const LIB_PATH = process.env.LANG_DATA_LIB || path.join(__dirname, '..', 'tools', 'lang-data', 'lib.js');
const HAS_LIB = fs.existsSync(LIB_PATH);

/* ── pack ปลอม (รูปแบบ v2: ไม่มี s[].w / w[].lv) ── */
const PACK = {
  v: 2, lang: 'lang-en', src: { freq: 'FrequencyWords@test', tatoeba: '2026-11-01', wikt: '' },
  w: [
    { id: 'the', r: 1, th: 'คำนำหน้านาม', ipa: 'ðə' },
    { id: 'cat', r: 2, th: 'แมว', ipa: 'kæt' },
    { id: 'sleeps', r: 3, th: '', ipa: '', g: 'is asleep' },
    { id: "let's", r: 4, th: 'มา…กันเถอะ', ipa: '' },
    { id: 'go', r: 5, th: 'ไป', ipa: 'ɡoʊ' },
    { id: 'try', r: 6, th: '', ipa: '' },
    { id: 'something', r: 700, th: 'บางอย่าง', ipa: '' },
    { id: 'quietly', r: 9000, th: 'อย่างเงียบๆ', ipa: '' },
  ],
  s: [
    { id: 1276, t: "Let's try something.", th: '', en: "Let's try something.", au: 0 },
    { id: 20, t: 'The cat sleeps.', th: 'แมวนอน', en: 'The cat sleeps.', au: 1 },
    { id: 31, t: 'The cat sleeps quietly.', th: '', en: 'The cat sleeps quietly.', au: 0 },
    { id: 5, t: "Let's go.", th: 'ไปกันเถอะ', en: "Let's go.", au: 0 },
  ],
};
const GZ = zlib.gzipSync(Buffer.from(JSON.stringify(PACK)));
const PACK_FILE = 'lang-en-0a1b2c3d.json.gz';
const INDEX = { v: 1, packs: { 'lang-en': { file: PACK_FILE, words: 8, sentences: 4, sources: ['FrequencyWords@test', 'Tatoeba 2026-11-01'] } } };

/* ── known-answer: lang-calc.js ── */
test('LEVEL_BANDS + levelOf: ระดับจากอันดับ (≤500 A1 … >8000 C2)', () => {
  expect(LCALC.LEVEL_BANDS).toEqual([[500, 1], [1200, 2], [2500, 3], [5000, 4], [8000, 5]]);
  expect([1, 500, 501, 1200, 1201, 2500, 2501, 5000, 5001, 8000, 8001, 99999].map(LCALC.levelOf)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
});

test('LEVEL_BANDS / tokenize / รหัสภาษา ตรงกับตัวสร้าง tools/lang-data/lib.js', () => {
  test.skip(!HAS_LIB, 'ยังไม่มี tools/lang-data/lib.js ใน branch นี้ (แถว 21 ยังไม่ merge) — ตั้ง LANG_DATA_LIB เพื่อเทียบ');
  const LIB = require(LIB_PATH);
  expect(LCALC.LEVEL_BANDS).toEqual(LIB.LEVEL_BANDS);
  for (let r = 1; r <= 9000; r += 37) expect(LCALC.levelOf(r)).toBe(LIB.levelOfRank(r));
  Object.keys(LIB.LANGS).forEach((id) => expect([id, LCALC.LANG_CODE[id]]).toEqual([id, LIB.LANGS[id].code]));
  expect(Object.keys(LCALC.LANG_CODE).sort()).toEqual(Object.keys(LIB.LANGS).sort());
  const samples = [
    ['en', "Let's try something — it’s FUN, isn't it? 42 cats."], ['en', 'Café déjà vu'], ['de', 'Straße über Äpfel'],
    ['fr', "J'ai l’habitude d'aller à l'école."], ['ru', 'Я люблю читать книги.'], ['ar', 'أنا أحب القراءة'], ['hi', 'मैं किताब पढ़ता हूँ।'],
    ['vi', 'Tôi thích đọc sách.'], ['ko', '나는 책을 읽어요.'], ['es', '¿Dónde está el baño?'], ['pt', 'Não sei.'],
    ['ja', '私は猫が好きです。'], ['zh', '我喜欢看书。'], ['yue', '我鍾意睇書。'], ['km', 'ខ្ញុំចូលចិត្តអានសៀវភៅ'], ['lo', 'ຂ້ອຍມັກອ່ານປຶ້ມ'], ['my', 'ကျွန်တော် စာအုပ်ဖတ်တယ်'],
    ['en', 'été'], ['en', ''], ['en', '123 ... !!!'],
  ];
  samples.forEach(([code, text]) => expect([code, text, LCALC.tokenize(text, code)]).toEqual([code, text, LIB.tokenize(text, code)]));
});

test('tokenize: อังกฤษแบบละติน (เครื่องหมาย ’ เป็น \' · ตัวเลขไม่นับ · NFC)', () => {
  expect(LCALC.tokenize("Let's try something — it’s FUN, 42 cats.", 'en')).toEqual(["let's", 'try', 'something', "it's", 'fun', 'cats']);
  expect(LCALC.tokenize('été', 'en')).toEqual(['été']);
});

test('cardKey ไม่อิงดัชนี + parseKey + packFile ตรวจชื่อไฟล์', () => {
  expect(LCALC.cardKey('lang-en', 'w', 'the')).toBe('lang-en::w::the');
  expect(LCALC.cardKey('lang-en', 's', 1276)).toBe('lang-en::s::1276');
  expect(LCALC.parseKey('lang-en::w::let\'s')).toEqual({ langId: 'lang-en', kind: 'w', id: "let's" });
  expect(LCALC.parseKey('lang-en::vocab-food::3')).toBe(null);
  expect(LCALC.packFile(INDEX, 'lang-en')).toBe('lang-packs/' + PACK_FILE);
  expect(LCALC.packFile(INDEX, 'lang-jp')).toBe(null);
  expect(LCALC.packFile({ packs: { 'lang-en': { file: '../evil.json' } } }, 'lang-en')).toBe(null);
  expect(LCALC.packFile({ packs: { 'lang-en': { file: 'lang-jp-0a1b2c3d.json.gz' } } }, 'lang-en')).toBe(null);
  expect(LCALC.packFile({ packs: { 'lang-en': { file: 'lang-en-0a1b2c3d.json' } } }, 'lang-en')).toBe('lang-packs/lang-en-0a1b2c3d.json');
  expect(LCALC.packFile(null, 'lang-en')).toBe(null);
  expect(LCALC.isGzip(GZ)).toBe(true);
  expect(LCALC.isGzip(Buffer.from('{"v":2}'))).toBe(false);
});

test('prepare: ระดับคิดจาก r, ประโยคตัดคำเอง, ระดับประโยค = คำที่ยากสุด, แถวผิดรูปถูกทิ้ง', () => {
  const bad = JSON.parse(JSON.stringify(PACK));
  bad.w.push({ id: 'x::y', r: 10 }, { id: 'ok', r: -1 }, { id: 42, r: 11 }, { id: 'the', r: 12, th: 'ซ้ำ' }, null, { id: '1984', r: 13 });
  bad.s.push({ id: 'abc', t: 'x' }, { id: 77, t: '' }, { id: 20, t: 'ซ้ำ' }, { id: 1.5, t: 'x' });
  const p = LCALC.prepare(bad, 'lang-en');
  expect(p.words.map((w) => w.id)).toEqual(['the', 'cat', 'sleeps', "let's", 'go', 'try', 'something', 'quietly']);
  expect(p.words.map((w) => w.lv)).toEqual([1, 1, 1, 1, 1, 1, 2, 6]);
  expect(p.words[2].en).toBe('is asleep');
  expect(p.sents.map((s) => [s.n, s.lv])).toEqual([[5, 1], [20, 1], [31, 6], [1276, 2]]);
  expect(p.sents.find((s) => s.n === 1276).toks).toEqual(["let's", 'try', 'something']);
  expect(p.levels).toEqual([0, 6, 1, 0, 0, 0, 1]);
  expect(LCALC.prepare(PACK, 'lang-jp')).toBe(null);
  expect(LCALC.prepare({ v: 9, lang: 'lang-en', w: [], s: [] }, 'lang-en')).toBe(null);
  // ไฟล์ v1 (มี lv / s.w) ก็ใช้ได้ — คิดใหม่จาก r และข้อความเสมอ
  const v1 = { v: 1, lang: 'lang-en', w: [{ id: 'go', r: 900, lv: 1 }], s: [{ id: 1, t: 'Go.', w: ['zzz'], lv: 1 }] };
  const p1 = LCALC.prepare(v1, 'lang-en');
  expect([p1.words[0].lv, p1.sents[0].lv, p1.sents[0].toks]).toEqual([2, 2, ['go']]);
});

test('pickNew ข้ามการ์ดที่มี + ไม่เปลี่ยนเมื่อเรียงไฟล์ใหม่ · dueItems/queue · sentencesFor', () => {
  const p = LCALC.prepare(PACK, 'lang-en');
  const srs = { 'lang-en::w::the': { dueAt: 100 }, 'lang-en::w::go': { dueAt: 9e15 }, 'lang-en::vocab-food::0': { dueAt: 1 } };
  expect(LCALC.pickNew(p, srs, { level: 1, n: 3 }).map((x) => x.key)).toEqual(['lang-en::w::cat', 'lang-en::w::sleeps', "lang-en::w::let's"]);
  expect(LCALC.pickNew(p, srs, { level: 2, n: 5 }).map((x) => x.id)).toEqual(['something']);
  expect(LCALC.pickNew(p, srs, { level: 0, n: 20 }).length).toBe(6);
  expect(LCALC.pickNew(p, {}, { kind: 's', level: 1, n: 5 }).map((x) => x.key)).toEqual(['lang-en::s::5', 'lang-en::s::20']);
  const shuffled = JSON.parse(JSON.stringify(PACK));
  shuffled.w.reverse(); shuffled.s.reverse();
  const q = LCALC.prepare(shuffled, 'lang-en');
  expect(LCALC.pickNew(q, srs, { level: 1, n: 3 }).map((x) => x.key)).toEqual(LCALC.pickNew(p, srs, { level: 1, n: 3 }).map((x) => x.key));
  expect(LCALC.pickNew(q, {}, { kind: 's', level: 0, n: 9 }).map((x) => x.id)).toEqual(['5', '20', '31', '1276']);
  expect(LCALC.dueItems(p, srs, { now: 1000 }).map((x) => x.id)).toEqual(['the']);
  expect(LCALC.queue(p, srs, { level: 1, n: 3, now: 1000 }).map((x) => x.id)).toEqual(['the', 'cat', 'sleeps']);
  expect(LCALC.sentencesFor(p, 'cat').map((s) => s.n)).toEqual([20, 31]);
  expect(LCALC.sentencesFor(p, 'Something', 3).map((s) => s.n)).toEqual([1276]);
  expect(LCALC.sentencesFor(p, 'nope')).toEqual([]);
  const pool = LCALC.toPoolItems(p, 'w', null);
  expect(pool[1]).toEqual({ key: 'lang-en::w::cat', word: 'cat', thai: 'แมว', extra: p.words[1] });
});

test('คำแปล: ไทยในไฟล์ → AI → อังกฤษ · thMessages/parseTh/mergeTh/chunk', () => {
  const p = LCALC.prepare(PACK, 'lang-en');
  const [, cat, sleeps, , , tryW] = p.words;
  const cache = { v: 1, m: { 'lang-en::w::try': 'ลอง' } };
  expect(LCALC.thaiOf(cat, cache)).toEqual({ text: 'แมว', src: 'pack' });
  expect(LCALC.thaiOf(tryW, cache)).toEqual({ text: 'ลอง', src: 'ai' });
  expect(LCALC.thaiOf(sleeps, cache)).toEqual({ text: 'is asleep', src: 'en' });
  expect(LCALC.thaiOf(tryW, null)).toEqual({ text: '', src: '' });
  expect(LCALC.face(tryW, cache)).toEqual(['try', 'ลอง']);
  expect(LCALC.missingThai([cat, sleeps, tryW], cache).map((x) => x.id)).toEqual(['sleeps']);
  const msgs = LCALC.thMessages([sleeps, p.sents[3]], 'English');
  expect(msgs[0].role).toBe('system');
  expect(msgs[1].content).toBe("1. sleeps (English: is asleep)\n2. Let's try something. (English: Let's try something.)");
  expect(LCALC.thMessages(new Array(30).fill(cat), 'x')[1].content.split('\n').length).toBe(20);
  expect(LCALC.parseTh('```json\n["นอนหลับ", "ลองอะไรสักอย่าง"]\n```', 2)).toEqual(['นอนหลับ', 'ลองอะไรสักอย่าง']);
  expect(LCALC.parseTh('นี่คือคำแปล\n1. นอน\n3. เกิน\n2) ลองดู', 2)).toEqual(['นอน', 'ลองดู']);
  expect(LCALC.parseTh('["a", 5]', 3)).toEqual(['a', '', '']);
  expect(LCALC.parseTh('ไม่รู้', 1)).toEqual(['']);
  const merged = LCALC.mergeTh(cache, [sleeps, tryW], ['นอนหลับ', '']);
  expect(merged).toEqual({ v: 1, m: { 'lang-en::w::try': 'ลอง', 'lang-en::w::sleeps': 'นอนหลับ' } });
  expect(cache.m['lang-en::w::sleeps']).toBe(undefined);
  const big = { v: 1, m: {} };
  for (let i = 0; i < LCALC.TH_CACHE_MAX; i++) big.m['lang-en::w::k' + i] = 'x';
  const m2 = LCALC.mergeTh(big, [sleeps], ['นอน']);
  expect(Object.keys(m2.m).length).toBe(LCALC.TH_CACHE_MAX);
  expect(m2.m['lang-en::w::k0']).toBe(undefined);
  expect(m2.m['lang-en::w::sleeps']).toBe('นอน');
  expect(LCALC.chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

/* ── หน้าจริง ── */
async function routePacks(page, opts = {}) {
  const hits = { index: 0, pack: 0, ocr: 0, summarize: [] };
  await page.route('**/lang-packs/index.json', (route) => {
    hits.index++;
    if (opts.noIndex) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INDEX) });
  });
  await page.route('**/lang-packs/lang-*', (route) => {
    hits.pack++;
    if (opts.packFail) return route.fulfill({ status: 500, body: 'x' });
    return route.fulfill({ status: 200, contentType: 'application/gzip', body: GZ });
  });
  await page.route('**/api/ocr**', (route) => { hits.ocr++; return route.fulfill({ status: 500, body: '{}' }); });
  await page.route('**/api/ai/summarize', (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    hits.summarize.push(body);
    const n = String(body.messages[1].content).split('\n').length;
    const out = Array.from({ length: n }, (_, i) => 'แปลAI' + (i + 1));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: JSON.stringify(out), cached: false, model: 'fast' }) });
  });
  return hits;
}

async function openPacks(page) {
  await page.goto('/languages.html#lang-en');
  await page.click('[data-k="src-pack"]');
  await expect(page.locator('[data-k="packCard"]')).toBeVisible();
}

test('หน้า: เลือก "คำที่ใช้บ่อย" → โหลด index + .json.gz (DecompressionStream) → การ์ด + ประโยคตัวอย่าง', async ({ page }) => {
  const errors = await prepare(page);
  const hits = await routePacks(page);
  await page.goto('/languages.html#lang-en');
  expect(hits.index + hits.pack).toBe(0); // ไม่โหลดจนกว่าจะเลือก
  await page.click('[data-k="src-pack"]');
  await expect(page.locator('[data-k="packCard"]')).toBeVisible();
  expect(hits.index).toBe(1);
  expect(hits.pack).toBe(1);
  // คำแรกของระดับ A1 = อันดับ 1
  await expect(page.locator('[data-k="packWord"]')).toHaveText('the');
  await page.click('[data-k="packFlip"]');
  await expect(page.locator('[data-k="packThai"]')).toContainText('คำนำหน้านาม');
  // ไปคำถัดไป: cat มีประโยคตัวอย่าง 2 ประโยค (สั้นก่อน)
  await page.click('[data-k="packGood"]');
  await expect(page.locator('[data-k="packWord"]')).toHaveText('cat');
  await page.click('[data-k="packFlip"]');
  await expect(page.locator('[data-k="packSent"]')).toHaveCount(2);
  await expect(page.locator('[data-k="packSent"]').first()).toContainText('The cat sleeps.');
  // สลับระดับกลับมาโหมดเดิมไม่โหลดซ้ำ
  await page.click('[data-k="lv-2"]');
  await expect(page.locator('[data-k="packWord"]')).toHaveText('something');
  await page.click('[data-k="src-basic"]');
  await page.click('[data-k="src-pack"]');
  expect(hits.pack).toBe(1);
  // การ์ดที่ให้คะแนนแล้ว: srs คีย์ ::w:: + หน้าการ์ดใน lang-practice:faces
  const st = await page.evaluate(() => ({ srs: JSON.parse(localStorage.getItem('lang-practice:srs') || '{}'), faces: JSON.parse(localStorage.getItem('lang-practice:faces') || '{}') }));
  expect(Object.keys(st.srs)).toContain('lang-en::w::the');
  expect(st.srs['lang-en::w::the'].dueAt).toBeGreaterThan(Date.now());
  expect(st.faces['lang-en::w::the']).toEqual(['the', 'คำนำหน้านาม']);
  expect(hits.ocr).toBe(0);
  expect(errors).toEqual([]);
});

test('หน้า: พิมพ์คำแปล / ฟังแล้วพิมพ์ / ประโยค ใช้ชุดใหม่ได้', async ({ page }) => {
  const errors = await prepare(page);
  await routePacks(page);
  await openPacks(page);
  await page.click('[data-k="pmode-translate"]');
  await expect(page.locator('[data-k="packPrompt"]')).toContainText('คำนำหน้านาม');
  await page.fill('[data-k="packAnswer"]', 'the');
  await page.click('[data-k="packCheck"]');
  await expect(page.locator('[data-k="packResult"]')).toHaveAttribute('data-r', 'correct');
  await page.click('[data-k="packNext"]');
  await expect(page.locator('[data-k="packPrompt"]')).toContainText('แมว');
  await page.fill('[data-k="packAnswer"]', 'dog');
  await page.click('[data-k="packCheck"]');
  await expect(page.locator('[data-k="packResult"]')).toHaveAttribute('data-r', 'wrong');
  await page.click('[data-k="packNext"]'); // ให้คะแนนตอนกด "ข้อต่อไป" (ตอบผิด = Again)
  await page.click('[data-k="pmode-dictation"]');
  await expect(page.locator('[data-k="packListen"]')).toBeVisible();
  await page.click('[data-k="kind-s"]');
  await page.click('[data-k="pmode-flashcard"]');
  await expect(page.locator('[data-k="packWord"]')).toHaveText("Let's go.");
  await page.click('[data-k="packFlip"]');
  await page.click('[data-k="packGood"]');
  const srs = await page.evaluate(() => JSON.parse(localStorage.getItem('lang-practice:srs') || '{}'));
  expect(Object.keys(srs).sort()).toEqual(['lang-en::s::5', 'lang-en::w::cat', 'lang-en::w::the']);
  expect(srs['lang-en::w::cat'].dueAt).toBeLessThan(srs['lang-en::w::the'].dueAt); // ผิด = กลับมาเร็วกว่า
  expect(errors).toEqual([]);
});

test('หน้า: แปลไทยด้วย AI (summarize task lang-th model fast) → แคช tanot:lang:th + ป้าย "แปลโดย AI" · ไม่มี /api/ocr', async ({ page }) => {
  const errors = await prepare(page);
  await page.addInitScript(() => { window.TANOT_AI = { enabled: true }; });
  const hits = await routePacks(page);
  await openPacks(page);
  await page.click('[data-k="lv-0"]');
  // ไปที่ try (ไม่มีไทยในไฟล์) — ข้าม the/cat/sleeps/let's/go
  for (let i = 0; i < 5; i++) { await page.click('[data-k="packFlip"]'); await page.click('[data-k="packGood"]'); }
  await expect(page.locator('[data-k="packWord"]')).toHaveText('try');
  await page.click('[data-k="packFlip"]');
  await page.click('[data-k="packTranslate"]');
  await expect(page.locator('[data-k="packThai"]')).toContainText('แปลAI1');
  await expect(page.locator('[data-k="aiBadge"]').first()).toBeVisible();
  expect(hits.summarize.length).toBe(1);
  expect(hits.summarize[0].task).toBe('lang-th');
  expect(hits.summarize[0].model).toBe('fast');
  const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:lang:th') || 'null'));
  expect(cache.m['lang-en::w::try']).toBe('แปลAI1');
  expect(cache.m['lang-en::s::1276']).toBe('แปลAI2');
  await page.click('[data-k="packGood"]');
  const faces = await page.evaluate(() => JSON.parse(localStorage.getItem('lang-practice:faces') || '{}'));
  expect(faces['lang-en::w::try']).toEqual(['try', 'แปลAI1']);
  expect(hits.ocr).toBe(0);
  expect(errors).toEqual([]);
});

test('หน้า: ไม่มีคลาวด์ → ไม่มีปุ่มแปล แสดงคำแปลอังกฤษ · ไม่มีชุด/โหลดไม่ได้/ไม่รองรับ gzip = ข้อความ ไม่พัง', async ({ page }) => {
  const errors = await prepare(page);
  await routePacks(page);
  await openPacks(page);
  await page.click('[data-k="lv-0"]');
  for (let i = 0; i < 2; i++) { await page.click('[data-k="packFlip"]'); await page.click('[data-k="packGood"]'); }
  await expect(page.locator('[data-k="packWord"]')).toHaveText('sleeps');
  await page.click('[data-k="packFlip"]');
  await expect(page.locator('[data-k="packThai"]')).toContainText('is asleep');
  await expect(page.locator('[data-k="packTranslate"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('หน้า: index 404 = ยังไม่มีชุดของภาษานี้ · ไฟล์ล้ม = ลองใหม่ได้ · ไม่มี DecompressionStream = ข้อความ', async ({ page }) => {
  const errors = await prepare(page);
  await routePacks(page, { noIndex: true });
  await page.goto('/languages.html#lang-en');
  await page.click('[data-k="src-pack"]');
  await expect(page.locator('[data-k="packEmpty"]')).toBeVisible();
  await page.unroute('**/lang-packs/index.json');
  await page.unroute('**/lang-packs/lang-*');
  const hits = await routePacks(page, { packFail: true });
  await page.reload();
  await page.click('[data-k="src-pack"]');
  await expect(page.locator('[data-k="packError"]')).toBeVisible();
  await page.unroute('**/lang-packs/lang-*');
  await page.route('**/lang-packs/lang-*', (route) => route.fulfill({ status: 200, contentType: 'application/gzip', body: GZ }));
  await page.click('[data-k="packRetry"]');
  await expect(page.locator('[data-k="packCard"]')).toBeVisible();
  expect(hits.index).toBeGreaterThan(0);
  await page.addInitScript(() => { delete window.DecompressionStream; });
  await page.reload();
  await page.click('[data-k="src-pack"]');
  await expect(page.locator('[data-k="packError"]')).toBeVisible();
  // เบราว์เซอร์ log "Failed to load resource" เองเมื่อ fetch ได้ 404/500 — ไม่ใช่ error ของโค้ด
  expect(errors.filter((e) => !/Failed to load resource: the server responded with a status of (404|500)/.test(e))).toEqual([]);
});

test.describe('ออฟไลน์', () => {
test.use({ serviceWorkers: 'allow' });
// ให้ context.route / setOffline มีผลกับคำขอที่ service worker ส่งเอง (Chromium อ่านค่านี้ตอน SW เริ่ม) — เปิดเฉพาะกลุ่มนี้
test.beforeAll(() => { process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1'; });
test.afterAll(() => { delete process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS; });
test('เปิดชุดซ้ำได้หลังใช้ครั้งแรก (sw.js แคช index + ไฟล์ชุด)', async ({ page, context }) => {
  await prepare(page);
  // service worker ต้องเห็นคำขอจริง → เสิร์ฟไฟล์จาก context.route (page.route ไม่ผ่าน SW)
  await context.route('**/lang-packs/index.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INDEX) }));
  await context.route('**/lang-packs/lang-*', (r) => r.fulfill({ status: 200, contentType: 'application/gzip', body: GZ }));
  await page.goto('/languages.html#lang-en');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.click('[data-k="src-pack"]');
  await expect(page.locator('[data-k="packCard"]')).toBeVisible();
  await page.waitForFunction(async () => {
    const keys = await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).map((r) => r.url)));
    const all = keys.flat();
    return all.some((u) => /lang-packs\/index\.json$/.test(u)) && all.some((u) => /lang-packs\/lang-en-/.test(u));
  });
  await context.unroute('**/lang-packs/index.json');
  await context.unroute('**/lang-packs/lang-*');
  await context.setOffline(true);
  await page.reload();
  await page.click('[data-k="src-pack"]');
  await expect(page.locator('[data-k="packCard"]')).toBeVisible();
  await context.setOffline(false);
});
});

test('review.html แสดงการ์ด ::w:: / ::s:: จาก lang-practice:faces และเขียนผลกลับ', async ({ page }) => {
  const errors = await prepare(page);
  const past = Date.now() - 3600e3;
  await page.addInitScript((t) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('lang-practice:srs', JSON.stringify({
      'lang-en::w::cat': { stability: 1, difficulty: 5, reps: 1, lapses: 0, lastReview: t - 86400e3, dueAt: t },
      'lang-en::s::20': { stability: 1, difficulty: 5, reps: 1, lapses: 0, lastReview: t - 86400e3, dueAt: t },
    }));
    localStorage.setItem('lang-practice:faces', JSON.stringify({ 'lang-en::w::cat': ['cat', 'แมว'], 'lang-en::s::20': ['The cat sleeps.', 'แมวนอน'] }));
  }, past);
  await page.goto('/review.html#lang');
  await expect(page.locator('#rvDue')).toContainText('2');
  await expect(page.locator('#rvCard .q')).toHaveText(/^(cat|The cat sleeps\.)$/);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('lang-practice:srs')));
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Space');
    await expect(page.locator('#rvCard .a')).toHaveText(/^(แมว|แมวนอน)$/);
    await page.keyboard.press('3');
  }
  await expect(page.locator('#rvArea .empty')).toBeVisible();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('lang-practice:srs')));
  Object.keys(before).forEach((k) => expect(after[k].dueAt).toBeGreaterThan(before[k].dueAt));
  expect(errors).toEqual([]);
});

test.describe('ซิงก์ 2 เครื่อง', () => {
  const SRV = 'http://localhost:8148';
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });
  test('การ์ดชุดคำจากเครื่อง A → เครื่อง B เห็นหน้าการ์ดใน review.html (lang-practice:faces) · ทั้งสองเครื่องให้คะแนนคนละคำไม่ทับกัน', async ({ browser }) => {
    const mk = async () => {
      const ctx = await browser.newContext({ baseURL: SRV });
      const page = await ctx.newPage();
      const errors = await prepare(page);
      await routePacks(page);
      await page.addInitScript(() => { window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 }; });
      return { ctx, page, errors };
    };
    const A = await mk(), B = await mk();
    const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));
    for (const d of [A, B]) await openPacks(d.page);
    // A ให้คะแนน the · B (ยังไม่ซิงก์) ข้าม the ไปไม่ได้ — ใช้ระดับ A2 ให้คะแนน something
    await A.page.click('[data-k="packFlip"]'); await A.page.click('[data-k="packGood"]');
    await B.page.click('[data-k="lv-2"]');
    await B.page.click('[data-k="packFlip"]'); await B.page.click('[data-k="packGood"]');
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    for (const d of [A, B]) {
      const st = await d.page.evaluate(() => ({ srs: JSON.parse(localStorage.getItem('lang-practice:srs') || '{}'), faces: JSON.parse(localStorage.getItem('lang-practice:faces') || '{}') }));
      expect(Object.keys(st.srs).sort()).toEqual(['lang-en::w::something', 'lang-en::w::the']);
      expect(st.faces).toEqual({ 'lang-en::w::the': ['the', 'คำนำหน้านาม'], 'lang-en::w::something': ['something', 'บางอย่าง'] });
    }
    // เครื่อง B เปิด review.html (ไม่ได้โหลดชุดคำ) โดยการ์ดของ A ถึงกำหนดแล้ว → เห็นหน้าการ์ด
    await B.page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('lang-practice:srs'));
      s['lang-en::w::the'].dueAt = Date.now() - 1000;
      localStorage.setItem('lang-practice:srs', JSON.stringify(s));
      localStorage.removeItem('tanot:learn:faces:lang');
    });
    await B.page.goto('/review.html#lang');
    await expect(B.page.locator('#rvCard .q')).toHaveText('the');
    for (const d of [A, B]) { expect(d.errors).toEqual([]); await d.ctx.close(); }
  });
});
