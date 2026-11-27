// @ts-check
// ภาษา L7 (ROADMAP แถว 28): วัดระดับ + แผนเรียนรายวัน — known-answer ของ LangCalc.level + หน้าจริง + ซิงก์ 2 context
const { test, expect } = require('@playwright/test');
const path = require('path');
const LC = require(path.resolve(__dirname, '..', 'lang-calc.js'));
const L = LC.level;

const NOW = Date.UTC(2026, 10, 27, 5, 0, 0); // 27 พ.ย. 2026 12:00 เวลาไทย
const DAY = 86400000;

function nm(i) { let s = ''; let n = i; do { s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } while (n > 0); return 'w' + s.replace(/[0-9]/g, ''); }
const WORDS = [];
for (let i = 1; i <= 3000; i++) WORDS.push({ id: 'x' + nm(i), r: i, th: 'แปล' + i });
const PACK = { v: 2, lang: 'lang-en', w: WORDS, s: [] };
const prep = LC.prepare(PACK, 'lang-en');

test.describe('LangCalc.level — ข้อสอบ + ประมาณระดับ (ตรรกะล้วน)', () => {
  test('buildTest: แถบละ 8 คำ (ระดับ 1–4 ในชุด 3,000 คำ) + ข้อตรวจ 4 ข้อ ตัวเลือกไม่ซ้ำและมีคำตอบ', () => {
    const t = L.buildTest(prep, null, 7);
    expect(t.items).toHaveLength(32);
    for (let lv = 1; lv <= 4; lv++) expect(t.items.filter(i => i.lv === lv)).toHaveLength(8);
    expect(new Set(t.items.map(i => i.key)).size).toBe(32);
    expect(t.items.every(i => prep.words.find(w => w.key === i.key).lv === i.lv)).toBe(true);
    expect(t.checks).toHaveLength(4);
    for (const c of t.checks) {
      expect(c.options).toHaveLength(4);
      expect(new Set(c.options).size).toBe(4);
      const w = prep.words.find(x => x.key === c.key);
      expect(c.options[c.answer]).toBe(w.th);
      expect(w.lv).toBeLessThanOrEqual(2);
    }
    expect(new Set(t.checks.map(c => c.key)).size).toBe(4);
  });
  test('buildTest: seed เดิม = ผลเดิม · seed ต่าง = ต่าง', () => {
    expect(L.buildTest(prep, null, 7)).toEqual(L.buildTest(prep, null, 7));
    expect(L.buildTest(prep, null, 7).items.map(i => i.key)).not.toEqual(L.buildTest(prep, null, 8).items.map(i => i.key));
  });
  test('buildTest: แถบที่มีคำน้อย = ใช้เท่าที่มี · ไม่มีคำแปลพอ = ไม่มีข้อตรวจ · ชุดว่าง = null', () => {
    const small = LC.prepare({ v: 2, lang: 'lang-en', w: [{ id: 'cat', r: 1 }, { id: 'dog', r: 2 }, { id: 'sun', r: 600 }], s: [] }, 'lang-en');
    const t = L.buildTest(small, null, 1);
    expect(t.items).toHaveLength(3);
    expect(t.checks).toHaveLength(0);
    expect(L.buildTest(null, null, 1)).toBeNull();
    expect(L.buildTest(LC.prepare({ v: 2, lang: 'lang-en', w: [], s: [] }, 'lang-en'), null, 1)).toBeNull();
  });
  test('buildTest: คำแปลจากแคช AI ใช้เป็นตัวเลือกได้', () => {
    const bare = LC.prepare({ v: 2, lang: 'lang-en', w: Array.from({ length: 40 }, (_, i) => ({ id: 'q' + nm(i + 1), r: i + 1 })), s: [] }, 'lang-en');
    expect(L.buildTest(bare, null, 3).checks).toHaveLength(0);
    const m = {}; bare.words.forEach((w, i) => { m[w.key] = 'ไทย' + i; });
    expect(L.buildTest(bare, { v: 1, m }, 3).checks).toHaveLength(4);
  });

  const ans = (lv, know, n) => Array.from({ length: n }, (_, i) => ({ lv, know: i < know }));
  test('estimateLevel: รู้ทุกคำ = ระดับสูงสุดที่ถามได้ (capped) · ไม่รู้เลย = A1 0 คำ', () => {
    const all = L.estimate([].concat(ans(1, 8, 8), ans(2, 8, 8), ans(3, 8, 8), ans(4, 8, 8)));
    expect(all).toMatchObject({ lv: 4, name: 'B2', words: 5000, capped: true, reliable: true });
    const none = L.estimate([].concat(ans(1, 0, 8), ans(2, 0, 8)));
    expect(none).toMatchObject({ lv: 1, name: 'A1', words: 0, capped: false });
  });
  test('estimateLevel: ระดับ = แถบแรกที่รู้ < 60% · คำโดยประมาณ = Σ สัดส่วน × ขนาดแถบ', () => {
    const r = L.estimate([].concat(ans(1, 8, 8), ans(2, 5, 8), ans(3, 2, 8), ans(4, 0, 8)));
    expect(r.lv).toBe(3);
    expect(r.name).toBe('B1');
    expect(r.words).toBe(1263); // 500 + .625×700 + .25×1300 + 0 = 1262.5
    expect(r.ratios).toEqual({ 1: 1, 2: 0.625, 3: 0.25, 4: 0 });
    // เกณฑ์เป๊ะ: 5/8 = .625 ผ่าน, 4/8 = .5 ไม่ผ่าน
    expect(L.estimate([].concat(ans(1, 8, 8), ans(2, 4, 8))).lv).toBe(2);
  });
  test('estimateLevel: ข้อตรวจผิด ≥ 2 จาก 4 = ไม่น่าเชื่อถือ · ถูก 3/4 = ผ่าน · ไม่มีข้อตรวจ = ผ่าน', () => {
    const a = [].concat(ans(1, 8, 8), ans(2, 8, 8));
    const ck = (...v) => v.map(ok => ({ ok }));
    expect(L.estimate(a, ck(true, true, true, false)).reliable).toBe(true);
    expect(L.estimate(a, ck(true, true, false, false)).reliable).toBe(false);
    expect(L.estimate(a, ck(false, false, false, false)).reliable).toBe(false);
    expect(L.estimate(a, []).reliable).toBe(true);
  });
  test('estimateLevel: ไม่มีคำตอบ/ข้อมูลผิดรูป = null · lv นอกช่วงถูกทิ้ง', () => {
    expect(L.estimate([])).toBeNull();
    expect(L.estimate(null)).toBeNull();
    expect(L.estimate([{ lv: 9, know: true }, { lv: 0, know: true }, null, { lv: 1 }])).toBeNull();
  });

  test('cleanLevels: เก็บเฉพาะภาษาที่รู้จัก ค่าอยู่ในช่วง · __proto__ ถูกทิ้ง', () => {
    const raw = JSON.parse('{"lang-en":{"lv":3,"words":1263.4,"at":1790000000000},"lang-xx":{"lv":2,"words":1,"at":1},"lang-de":{"lv":9,"words":1,"at":1},"lang-fr":{"lv":2,"words":-5,"at":"x"},"__proto__":{"lv":1,"words":1,"at":1}}');
    const c = L.cleanLevels(raw);
    expect(Object.keys(c)).toEqual(['lang-en']);
    expect(c['lang-en']).toEqual({ lv: 3, words: 1263, at: 1790000000000 });
    expect(L.cleanLevels(null)).toEqual({});
    expect(L.cleanLevels([1, 2])).toEqual({});
  });
  test('levelOf/setLevel: อ่านค่าเริ่มต้นตามภาษา · บันทึกแล้วคืนก้อนใหม่ไม่แก้ของเดิม', () => {
    const m = {};
    const n = L.setLevel(m, 'lang-en', { lv: 3, words: 1263 }, NOW);
    expect(m).toEqual({});
    expect(L.levelFor(n, 'lang-en')).toBe(3);
    expect(L.levelFor(n, 'lang-de')).toBe(0);
    expect(L.levelFor(null, 'lang-en')).toBe(0);
    expect(L.setLevel(n, 'lang-xx', { lv: 3, words: 1 }, NOW)).toEqual(n);
    expect(L.roleplayLevel(3)).toBe('B1');
    expect(L.roleplayLevel(6)).toBe('B2');
    expect(L.roleplayLevel(0)).toBe('A1');
  });

  test('cleanPlans/planFor/setPlan: ใหม่/วัน ค่าเริ่มต้น 10 · ช่วง 1–50 · ค่าผิด = 10', () => {
    expect(L.planFor(null, 'lang-en')).toEqual({ n: 10 });
    const p = L.setPlan({}, 'lang-en', 25);
    expect(L.planFor(p, 'lang-en')).toEqual({ n: 25 });
    expect(L.planFor(L.setPlan(p, 'lang-en', 0), 'lang-en').n).toBe(1);
    expect(L.planFor(L.setPlan(p, 'lang-en', 999), 'lang-en').n).toBe(50);
    expect(L.planFor(L.setPlan(p, 'lang-en', 'abc'), 'lang-en').n).toBe(10);
    expect(L.cleanPlans(JSON.parse('{"lang-en":{"n":"7"},"lang-zz":{"n":5},"__proto__":{"n":3}}'))).toEqual({ 'lang-en': { n: 7 } });
  });

  test('dayStart: เที่ยงคืนเวลาไทย', () => {
    expect(L.dayStart(NOW)).toBe(Date.UTC(2026, 10, 26, 17, 0, 0));
    expect(L.dayStart(Date.UTC(2026, 10, 26, 16, 59, 59))).toBe(Date.UTC(2026, 10, 25, 17, 0, 0));
    expect(L.dayStart(Date.UTC(2026, 10, 26, 17, 0, 0))).toBe(Date.UTC(2026, 10, 26, 17, 0, 0));
  });
  test('today: ใหม่วันนี้ = การ์ดคำที่ทวนครั้งแรกวันนี้ · ทวน = ถึงกำหนดทุกการ์ดของภาษา (w/s/u/เดิม) ภาษาอื่นไม่นับ', () => {
    const ds = L.dayStart(NOW);
    const srs = {
      'lang-en::w::xaa': { reps: 1, lapses: 0, lastReview: ds + 1000, dueAt: NOW + DAY },       // ใหม่วันนี้
      'lang-en::w::xab': { reps: 0, lapses: 1, lastReview: ds + 2000, dueAt: NOW + 3600000 },    // ใหม่วันนี้ (ตอบผิด)
      'lang-en::w::xac': { reps: 3, lapses: 0, lastReview: ds + 3000, dueAt: NOW + DAY },        // เคยเรียนแล้ว ไม่ใช่ใหม่
      'lang-en::w::xad': { reps: 1, lapses: 0, lastReview: ds - 1000, dueAt: NOW - 5 },          // เมื่อวาน ถึงกำหนด
      'lang-en::s::12': { reps: 2, lapses: 0, lastReview: ds - DAY, dueAt: NOW - 1 },            // ประโยค ถึงกำหนด
      'lang-en::u::go': { reps: 2, lapses: 0, lastReview: ds - DAY, dueAt: NOW },                // คำของผู้ใช้ (L5) ถึงกำหนด
      'lang-en::greetings::3': { reps: 2, lapses: 0, lastReview: ds - DAY, dueAt: NOW - 9 },     // การ์ดเดิม
      'lang-en::s::13': { reps: 1, lapses: 0, lastReview: ds + 10, dueAt: NOW + DAY },           // ประโยคใหม่วันนี้ (ไม่นับเป็นคำใหม่)
      'lang-de::w::foo': { reps: 1, lapses: 0, lastReview: ds + 1, dueAt: NOW - 1 },             // ภาษาอื่น
      'lang-en::w::bad': null, 'lang-en::w::bad2': 'x'
    };
    expect(L.today('lang-en', srs, { n: 10 }, NOW)).toEqual({ goal: 10, done: 2, left: 8, due: 4, met: false });
    expect(L.today('lang-en', srs, { n: 2 }, NOW)).toMatchObject({ goal: 2, done: 2, left: 0, met: true });
    expect(L.today('lang-en', {}, { n: 10 }, NOW)).toEqual({ goal: 10, done: 0, left: 10, due: 0, met: false });
    expect(L.today('lang-en', null, null, NOW)).toEqual({ goal: 10, done: 0, left: 10, due: 0, met: false });
  });
  test('newTarget: การ์ดใหม่ที่ยังต้องเรียน = เป้าที่เหลือ (ไม่เกินคำใหม่ที่มี)', () => {
    expect(L.newTarget(prep, {}, { n: 10 }, { level: 1, now: NOW })).toHaveLength(10);
    const srs = { [prep.words[0].key]: { reps: 1, lapses: 0, lastReview: L.dayStart(NOW) + 5, dueAt: NOW + DAY } };
    expect(L.newTarget(prep, srs, { n: 10 }, { level: 1, now: NOW })).toHaveLength(9);
    expect(L.newTarget(prep, srs, { n: 10 }, { level: 1, now: NOW }).every(w => w.key !== prep.words[0].key)).toBe(true);
    expect(L.newTarget(prep, srs, { n: 1 }, { level: 1, now: NOW })).toHaveLength(0);
  });
});

/* ───────────────────────── หน้าจริง ───────────────────────── */
const zlib = require('zlib');
const { prepare } = require('./helpers');
const SRV = 'http://localhost:8149';

// pack ปลอม: 6 คำต่อแถบ ระดับ 1–3 (r 1–6 / 501–506 / 1201–1206) มีคำแปลไทยทุกคำ
const PW = [];
[[1, 1], [2, 501], [3, 1201]].forEach(([lv, r0]) => { for (let i = 0; i < 6; i++) PW.push({ id: ['alpha', 'beta', 'gamma'][lv - 1] + 'xyzuvw'[i], r: r0 + i, th: 'แปลระดับ' + lv + '-' + i, lv }); });
const PG = { v: 2, lang: 'lang-en', src: {}, w: PW.map(({ id, r, th }) => ({ id, r, th, ipa: '' })), s: [] };
const GZ = zlib.gzipSync(Buffer.from(JSON.stringify(PG)));
const INDEX = { v: 1, packs: { 'lang-en': { file: 'lang-en-0a1b2c3d.json.gz', words: PW.length, sentences: 0, sources: [] } } };
const LV_OF = Object.fromEntries(PW.map((w) => [w.id, w.lv]));
const TH_OF = Object.fromEntries(PW.map((w) => [w.id, w.th]));

async function open(page, o = {}) {
  const errors = await prepare(page);
  const hits = { ocr: 0, api: [] };
  await page.route('**/lang-packs/index.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INDEX) }));
  await page.route('**/lang-packs/lang-*', (r) => r.fulfill({ status: 200, contentType: 'application/gzip', body: GZ }));
  await page.route('**/api/ocr**', (r) => { hits.ocr++; return r.fulfill({ status: 500, body: '{}' }); });
  page.on('request', (r) => { if (/\/api\//.test(r.url())) hits.api.push(r.url()); });
  await page.addInitScript(({ seed, lang, sync }) => {
    if (lang) localStorage.setItem('ome:lang', lang);
    if (seed && !localStorage.getItem('__seeded')) { Object.keys(seed).forEach((k) => localStorage.setItem(k, typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k]))); localStorage.setItem('__seeded', '1'); }
    if (sync) window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
  }, { seed: o.seed, lang: o.lang, sync: o.sync });
  await page.goto('/languages.html#lang-en');
  await page.waitForSelector('nav.ome-nav');
  await page.click('[data-k="src-pack"]');
  await expect(page.locator('[data-k="planCard"]')).toBeVisible();
  return { errors, hits };
}
const lsGet = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), k);

// ตอบข้อสอบ: รู้ทุกคำของระดับใน knowLv · ข้อตรวจ: เลือกถูกตาม okChecks
async function runTest(page, knowLv, okChecks) {
  await page.click('[data-k="levelStart"]');
  await expect(page.locator('[data-k="levelWords"]')).toBeVisible();
  for (let i = 0; i < 18; i++) {
    const w = (await page.locator('[data-k="levelWord"]').innerText()).trim();
    await page.click(knowLv.includes(LV_OF[w]) ? '[data-k="levelKnow"]' : '[data-k="levelUnknown"]');
  }
  await expect(page.locator('[data-k="levelChecks"]')).toBeVisible();
  for (let i = 0; i < 4; i++) {
    const w = (await page.locator('[data-k="levelCheckWord"]').innerText()).trim();
    const opts = await page.locator('[data-k="levelOpt"]').allInnerTexts();
    const right = opts.findIndex((o) => o.trim() === TH_OF[w]);
    expect(right).toBeGreaterThanOrEqual(0);
    await page.locator('[data-k="levelOpt"]').nth(okChecks ? right : (right + 1) % 4).click();
  }
}

test('หน้า: การ์ดแผนวันนี้ — ค่าเริ่มต้น ใหม่ 0/10 · ทวน 0 · ไม่มีข้อความอธิบาย · ไม่เรียก /api/ocr', async ({ page }) => {
  const { errors, hits } = await open(page);
  await expect(page.locator('[data-k="planToday"]')).toHaveText('วันนี้: ใหม่ 0/10 · ทวน 0');
  await expect(page.locator('[data-k="planN"]')).toHaveValue('10');
  await expect(page.locator('[data-k="levelBadge"]')).toHaveCount(0);
  expect(hits.ocr).toBe(0);
  expect(errors).toEqual([]);
});

test('หน้า: เปลี่ยนคำใหม่ต่อวัน → เขียน lang-practice:plan · โหลดใหม่แล้วยังอยู่', async ({ page }) => {
  const { errors } = await open(page);
  await page.selectOption('[data-k="planN"]', '20');
  await expect(page.locator('[data-k="planToday"]')).toHaveText('วันนี้: ใหม่ 0/20 · ทวน 0');
  expect(await lsGet(page, 'lang-practice:plan')).toEqual({ 'lang-en': { n: 20 } });
  await page.reload();
  await page.click('[data-k="src-pack"]');
  await expect(page.locator('[data-k="planN"]')).toHaveValue('20');
  expect(errors).toEqual([]);
});

test('หน้า: นับจากการ์ดจริง — ใหม่วันนี้ 1 · ถึงกำหนด 2 (w/s/u/เดิม) · ครบเป้า = ป้าย + แถบเต็ม · ภาษาอื่นไม่นับ', async ({ page }) => {
  const now = Date.now();
  const srs = {
    'lang-en::w::alphax': { reps: 1, lapses: 0, lastReview: now - 1000, dueAt: now + 86400000 },
    'lang-en::s::5': { reps: 3, lapses: 0, lastReview: now - 9 * 86400000, dueAt: now - 5000 },
    'lang-en::u::go': { reps: 2, lapses: 0, lastReview: now - 9 * 86400000, dueAt: now - 1000 },
    'lang-de::w::foo': { reps: 1, lapses: 0, lastReview: now - 500, dueAt: now - 1000 },
  };
  const { errors } = await open(page, { seed: { 'lang-practice:srs': srs, 'lang-practice:plan': { 'lang-en': { n: 1 } } } });
  await expect(page.locator('[data-k="planToday"]')).toHaveText('วันนี้: ใหม่ 1/1 · ทวน 2');
  await expect(page.locator('[data-k="planMet"]')).toBeVisible();
  await expect(page.locator('[data-k="planCard"] .meter')).toHaveClass(/ok/);
  await expect(page.locator('[data-k="planXp"]')).toHaveText(/^XP วันนี้ \d+\/\d+$/);   // ผูก LearnCore daily goal เดิม
  // LearnCore.dueCounts นับการ์ด ::w::/::s::/::u:: ของ lang-practice:srs ทุกภาษา (ไม่ต้องแก้)
  const dc = await page.evaluate((n) => window.LearnCore.dueCounts([], n).lang, now);
  expect(dc).toBe(3);
  expect(errors).toEqual([]);
});

test('หน้า: วัดระดับ — ตอบครบ → ระดับโดยประมาณ + เขียน lang-practice:level + ตัวเลือกระดับเปลี่ยนตาม', async ({ page }) => {
  const { errors, hits } = await open(page);
  await runTest(page, [1], true);
  await expect(page.locator('[data-k="levelResultText"]')).toHaveText('ระดับโดยประมาณ A2 · ~500 คำ');
  const lv = await lsGet(page, 'lang-practice:level');
  expect(lv['lang-en']).toMatchObject({ lv: 2, words: 500 });
  expect(lv['lang-en'].at).toBeGreaterThan(0);
  await expect(page.locator('[data-k="packLevel"]')).toHaveValue('2');
  await page.click('[data-k="levelClose"]');
  await expect(page.locator('[data-k="levelBadge"]')).toHaveText('ระดับโดยประมาณ A2 · ~500 คำ');
  expect(hits.ocr).toBe(0);
  expect(errors).toEqual([]);
});

test('หน้า: ข้อตรวจผิด ≥ 2 = ไม่บันทึก + ข้อความให้วัดใหม่', async ({ page }) => {
  const { errors } = await open(page);
  await runTest(page, [1, 2, 3], false);
  await expect(page.locator('[data-k="levelUnreliable"]')).toBeVisible();
  expect(await lsGet(page, 'lang-practice:level')).toEqual({});
  await page.click('[data-k="levelClose"]');
  await expect(page.locator('[data-k="levelBadge"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('หน้า: ระดับที่วัดไว้เป็นค่าเริ่มต้นของ packLevel (L1/L2) และฉากสวมบทบาท (L5) · เลือกเองแล้วไม่ถูกทับ', async ({ page }) => {
  const seed = { 'lang-practice:level': { 'lang-en': { lv: 3, words: 1200, at: 1790000000000 } } };
  const { errors } = await open(page, { seed });
  await expect(page.locator('[data-k="packLevel"]')).toHaveValue('3');
  await page.selectOption('[data-k="packLevel"]', '1');
  // อีกเครื่องวัดใหม่ → ไม่ทับสิ่งที่เลือกเองแล้ว
  await page.evaluate(() => window.TanotData.update('lang-practice:level', (m) => ({ ...(m || {}), 'lang-en': { lv: 4, words: 2500, at: 1790000001000 } })));
  await page.waitForTimeout(200);
  await expect(page.locator('[data-k="packLevel"]')).toHaveValue('1');
  await page.click('[data-k="tab-listen"]');
  await page.click('[data-k="lsub-roleplay"]');
  await expect(page.locator('[data-k="rp-level-B2"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-k="rp-level-A2"]');
  await expect(page.locator('[data-k="rp-level-A2"]')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('หน้า: EN — ข้อความทั้งหมดของการ์ด/ข้อสอบเป็นอังกฤษ ไม่มีไทยหลุด (นอกคำของชุด)', async ({ page }) => {
  const { errors } = await open(page, { lang: 'en' });
  await expect(page.locator('[data-k="planToday"]')).toHaveText('Today: new 0/10 · review 0');
  const thai = /[฀-๿]/;
  expect(await page.locator('[data-k="planCard"]').innerText()).not.toMatch(thai);
  await page.click('[data-k="levelStart"]');
  expect(await page.locator('[data-k="planCard"]').innerText()).not.toMatch(thai);
  for (let i = 0; i < 18; i++) await page.click('[data-k="levelKnow"]');
  await expect(page.locator('[data-k="levelChecks"]')).toBeVisible();
  const head = await page.locator('[data-k="levelChecks"] > div').first().innerText();
  expect(head).not.toMatch(thai);
  expect(errors).toEqual([]);
});

test('มือถือ 390: การ์ดแผน + ข้อสอบไม่ล้นแนวนอน · ปุ่ม ≥ 40px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const { errors } = await open(page);
  await page.click('[data-k="levelStart"]');
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(390);
  for (const k of ['levelKnow', 'levelUnknown']) {
    const b = await page.locator('[data-k="' + k + '"]').boundingBox();
    expect(b.height).toBeGreaterThanOrEqual(40);
  }
  expect(errors).toEqual([]);
});

test.describe('ซิงก์ 2 เครื่อง (พอร์ต 8149)', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('A วัดระดับ + ตั้งแผน → B ได้ค่าเดียวกัน (ไม่เด้งแถบโหลดใหม่) · 2 ภาษาไม่ทับกัน', async ({ browser }) => {
    const mk = async () => {
      const ctx = await browser.newContext({ baseURL: SRV });
      const page = await ctx.newPage();
      const o = await open(page, { sync: true });
      return { ctx, page, errors: o.errors };
    };
    const A = await mk(), B = await mk();
    const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));
    const both = async () => { for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); } };

    await runTest(A.page, [1, 2], true);
    await A.page.click('[data-k="levelClose"]');
    await A.page.selectOption('[data-k="planN"]', '30');
    // B ตั้งแผนของภาษาอื่นลง localStorage ตรงๆ (คนละ doc)
    await B.page.evaluate(() => {
      const m = JSON.parse(localStorage.getItem('lang-practice:plan') || '{}');
      m['lang-de'] = { n: 5 };
      localStorage.setItem('lang-practice:plan', JSON.stringify(m));
    });
    await both();
    for (const d of [A, B]) {
      expect(await lsGet(d.page, 'lang-practice:plan')).toEqual({ 'lang-en': { n: 30 }, 'lang-de': { n: 5 } });
      expect((await lsGet(d.page, 'lang-practice:level'))['lang-en']).toMatchObject({ lv: 3, words: 1200 });
    }
    await expect(B.page.locator('[data-k="planN"]')).toHaveValue('30');
    await expect(B.page.locator('[data-k="levelBadge"]')).toBeVisible();
    await expect(B.page.locator('.ome-reload-bar, [data-reload-bar]')).toHaveCount(0);
    for (const d of [A, B]) expect(d.errors).toEqual([]);
    await A.ctx.close(); await B.ctx.close();
  });
});
