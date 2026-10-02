// @ts-check
// ROADMAP Phase 5 — ระบบการเรียนรวมศูนย์: fsrs.js (เทียบโค้ดก่อนแยก), learn-core.js (ย้าย XP เดิม/วันติดต่อกัน/วันพัก),
// review.html (กองการ์ดรวม เขียนผลกลับที่เดิม) และซิงก์ XP 2 เครื่องไม่ทับกัน
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');
const FS = require('../fsrs.js');
const LC = require('../learn-core.js');
const ORIG = require('./fixtures/fsrs-original.js');

const NOW = new Date('2026-09-30T10:30:00+07:00');
const DAY = 86400000;

/* ── FSRS: ผลเท่าของเดิมทุกการ์ด ── */
function rng(seed) { // mulberry32 — สุ่มแบบกำหนดซ้ำได้
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function withNow(t, fn) { const real = Date.now; Date.now = () => t; try { return fn(); } finally { Date.now = real; } }

test('fsrs.js ให้ผลตรงกับตัวจัดตารางเดิมของ classroom-law.js และหน้าภาษา ทุกการ์ดทุกรอบ', () => {
  const rand = rng(20261002);
  let checked = 0;
  const bad = [];
  // เทียบทุกฟิลด์แบบ Object.is (ตัวเลขต้องตรงทุกบิต) — expect() ทีละรอบช้าเกินกับหลายพันรอบ
  const same = (x, y) => Object.keys(x).length === Object.keys(y).length && Object.keys(x).every((k) => Object.is(x[k], y[k]));
  for (let c = 0; c < 400; c++) {
    let t = NOW.getTime() + Math.floor(rand() * 30 * DAY);
    // จุดเริ่ม: การ์ดใหม่ / การ์ดขั้นบันไดเดิม (ไม่มี stability) / การ์ดที่มีค่าแปลกๆ จากข้อมูลจริง
    const starts = [{}, { srsIdx: 2, dueAt: t - DAY }, { stability: 0.5, difficulty: 10, lastReview: t - 3 * DAY, reps: 4, lapses: 3, srsIdx: -1 },
      { stability: 40, difficulty: 1, reps: 9 }];
    let law = { ...starts[c % starts.length] }, mine = { ...law }, lang = { ...law };
    for (let i = 0; i < 18; i++) {
      const rating = 1 + Math.floor(rand() * 4);
      const a = withNow(t, () => ORIG.lawCopy(law, rating));
      const b = withNow(t, () => ORIG.langCopy(lang, rating));
      const n = FS.schedule(mine, rating, t);
      const nDefault = withNow(t, () => FS.schedule(mine, rating)); // ไม่ส่ง now = Date.now() เหมือนของเดิม
      if (!same(n, a) || !same(nDefault, a) || !same(b, a) || FS.preview(mine, rating, t) !== a.dueAt - t) bad.push({ c, i, rating, law, a, n, b });
      law = { ...law, ...a }; lang = { ...lang, ...b }; mine = { ...mine, ...n };
      checked++;
      // บางรอบตอบก่อนถึงกำหนด บางรอบเลยกำหนดไปนาน บางรอบตอบซ้ำทันที
      const r = rand();
      t = r < 0.15 ? t : r < 0.6 ? a.dueAt : a.dueAt + Math.floor(rand() * 60 * DAY);
    }
  }
  expect(bad.slice(0, 3)).toEqual([]);
  expect(checked).toBe(400 * 18);
});

/* ── วันติดต่อกันแบบมีวันพัก ── */
function days(list) { const o = {}; list.forEach((d) => { o[d] = true; }); return o; }

test('วันติดต่อกัน: วันพักต่อสัปดาห์ ไม่ตัดวันติดต่อกัน แต่ไม่นับเป็นวันฝึก', () => {
  const T = '2026-09-30';
  // ฝึกทุกวันถึงเมื่อวาน (ยังไม่ฝึกวันนี้ = ยังไม่ขาด)
  expect(LC.streakFrom(days(['2026-09-27', '2026-09-28', '2026-09-29']), T, 0)).toEqual({ count: 3, restUsed: 0, doneToday: false });
  // ขาดเมื่อวาน 1 วัน: rest=0 ตัด, rest=1 ต่อได้ (ใช้วันพัก 1)
  const gap1 = days(['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-30']);
  expect(LC.streakFrom(gap1, T, 0)).toEqual({ count: 1, restUsed: 0, doneToday: true });
  expect(LC.streakFrom(gap1, T, 1)).toEqual({ count: 4, restUsed: 1, doneToday: true });
  // ขาด 2 วันในช่วง 7 วันเดียวกัน: rest=1 ไม่พอ, rest=2 พอ
  const gap2 = days(['2026-09-24', '2026-09-25', '2026-09-27', '2026-09-29', '2026-09-30']);
  expect(LC.streakFrom(gap2, T, 1).count).toBe(3);
  expect(LC.streakFrom(gap2, T, 2)).toEqual({ count: 5, restUsed: 2, doneToday: true });
  // ขาดห่างกันเกิน 7 วัน: rest=1 ต่อได้ทั้งสองครั้ง
  const spaced = days(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20',
    '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-30']);
  expect(LC.streakFrom(spaced, T, 1)).toEqual({ count: 15, restUsed: 2, doneToday: true });
  // วันพักไม่ลากต่อจากวันแรกที่ฝึก
  expect(LC.streakFrom(days([]), T, 2)).toEqual({ count: 0, restUsed: 0, doneToday: false });
  expect(LC.longestFrom(gap2, 1)).toBe(3);
  expect(LC.longestFrom(days(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-02-01']), 1)).toBe(4);
});

/* ── ยอดเดิมจากหลายหน้า ── */
const NOW_DAY = (off) => { const t = new Date(NOW); t.setDate(t.getDate() - off); return t; };
const ymd = (t) => t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
const ymdLoose = (t) => t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate(); // รูปแบบที่หน้างานอดิเรกเก็บ
const LEGACY_SEED = {
  'lang-practice:xp': '500',
  'lang-practice:streak': JSON.stringify({ count: 5, longest: 12, lastDate: ymd(NOW_DAY(1)) }),
  'lbe:business:xp': '1550',      // ค่าเริ่มต้นของหน้า 1250 ไม่นับ → 300
  'lbe:engineering:xp': '1250',   // เปิดหน้าแต่ไม่เคยฝึก → 0
  'tanot:music:xp': '120',
  'tanot:music:streak': JSON.stringify({ count: 7, lastDate: ymdLoose(NOW_DAY(2)) }),
  'tanot:sports:xp': '40',
  'tanot:coding:xp': '60',
  'tanot:coding:streak': JSON.stringify({ count: 2, lastDate: ymdLoose(NOW_DAY(20)) }),
  'tanot:barprep:activity': JSON.stringify([{ t: 'note', ts: NOW_DAY(3).getTime() }, { t: 'review', ts: NOW_DAY(2).getTime() }]),
};
const LEGACY_TOTAL = 500 + 300 + 120 + 40 + 60;

test('legacySnapshot/compute: รวมยอดเดิม + ค่าต่ำสุดข้ามเครื่อง + วันติดต่อกันค่าสูงสุด', () => {
  const get = (k) => (k in LEGACY_SEED ? LEGACY_SEED[k] : null);
  const snap = LC.legacySnapshot(get);
  expect(snap.xp).toEqual({ law: 0, lang: 500, biz: 300, eng: 0, music: 120, sports: 40, cooking: 0, coding: 60, typing: 0 });
  expect(snap.streak.music).toEqual({ count: 7, longest: 7, lastDate: ymd(NOW_DAY(2)) });
  expect(snap.streak.law).toEqual({ count: 2, longest: 2, lastDate: ymd(NOW_DAY(2)) });
  const sum = LC.compute([], [snap], {}, NOW.getTime());
  expect(sum.legacy).toBe(LEGACY_TOTAL);
  expect(sum.total).toBe(LEGACY_TOTAL);
  // ดนตรี 7 วันถึงเมื่อวานซืน + วันพัก 1 (เมื่อวาน) = 7 · ไม่มีวันพัก → ใช้ภาษา 5 วันถึงเมื่อวาน
  expect(sum.streak).toEqual({ count: 7, longest: 12, doneToday: false, restUsed: 1 });
  expect(LC.compute([], [snap], { rest: 0 }, NOW.getTime()).streak.count).toBe(5);
  // เครื่องที่ถ่ายยอดทีหลังเห็นค่าที่รวม XP ใหม่แล้ว (เพลง 140, ได้ภาษาเพิ่ม) → ใช้ค่าต่ำสุด ไม่นับซ้ำ
  const later = { xp: { ...snap.xp, lang: 530, music: 140, cooking: 20 }, streak: {} };
  expect(LC.compute([], [snap, later], {}, NOW.getTime()).legacy).toBe(LEGACY_TOTAL);
  // ไม่มีข้อมูลเดิมเลย = ไม่มีแถว
  expect(LC.legacySnapshot(() => null)).toBeNull();
});

/* ── ในหน้าเว็บจริง: ย้ายครั้งเดียว รันซ้ำไม่นับซ้ำ ── */
async function openWith(page, path, seed) {
  const errors = await prepare(page);
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, seed);
  await page.clock.setFixedTime(NOW);
  await page.goto(path, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return errors;
}
const summary = (p) => p.evaluate(() => window.LearnCore.summary());

test('ย้าย XP เดิมจากหลายหน้า: ยอดถูก, รันซ้ำ/รีโหลด/คีย์เดิมเพิ่มขึ้นแล้วไม่นับซ้ำ, คีย์เดิมไม่ถูกแตะ', async ({ page }) => {
  const errors = await openWith(page, '/review.html', LEGACY_SEED);
  await expect(page.locator('#rvTotal')).toHaveText(LEGACY_TOTAL.toLocaleString('th-TH'));
  await expect(page.locator('#rvStreak')).toContainText('7');
  let s = await summary(page);
  expect(s.legacy).toBe(LEGACY_TOTAL);
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:learn:legacy')));
  expect(rows).toHaveLength(1);

  // รันซ้ำตรงๆ + หน้าเดิมเพิ่ม XP ในคีย์ของตัวเองหลังย้าย (ต้องไม่ถูกนับเป็นยอดเดิมอีก)
  await page.evaluate(() => { window.LearnCore.migrateLegacy(); localStorage.setItem('tanot:music:xp', '999'); window.LearnCore.migrateLegacy(); });
  await page.reload({ waitUntil: 'load' });
  await page.goto('/index.html', { waitUntil: 'load' });
  s = await summary(page);
  expect(s.legacy).toBe(LEGACY_TOTAL);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:learn:legacy')).length)).toBe(1);

  // XP ใหม่บวกเพิ่มตรงจำนวน
  await page.evaluate(() => { window.LearnCore.award('music', 20); window.LearnCore.award('lang', 2); window.LearnCore.award('music', 20); });
  s = await summary(page);
  expect(s.total).toBe(LEGACY_TOTAL + 42);
  expect(s.todayXp).toBe(42);
  expect(s.streak.doneToday).toBe(true);
  const xpRows = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:learn:xp')));
  expect(xpRows).toHaveLength(2); // 1 แถวต่อ (วัน, เครื่อง, ที่มา)
  expect(xpRows.find((r) => r.src === 'music')).toMatchObject({ d: '2026-09-30', area: 'hobby', xp: 40, n: 2 });

  // คีย์เดิมของทุกหน้ายังอยู่ครบตามเดิม
  const after = await page.evaluate((keys) => keys.map((k) => localStorage.getItem(k)), Object.keys(LEGACY_SEED));
  expect(after).toEqual(Object.keys(LEGACY_SEED).map((k) => (k === 'tanot:music:xp' ? '999' : LEGACY_SEED[k])));
  // การ์ดวันนี้บนหน้าแรก
  await expect(page.locator('#streakBody')).toContainText('XP วันนี้ 42 / 50');
  await expect(page.locator('#streakBody')).toContainText('ฝึกวันนี้แล้ว');
  expect(errors).toEqual([]);
});

test('หน้าเรียนให้ XP เข้าระบบกลางตอนผ่านแบบฝึก (โค้ดหน้าเดิมเรียก LearnCore.award ก่อนบันทึกคีย์ตัวเอง)', async ({ page }) => {
  const errors = await openWith(page, '/typing.html', { 'tanot:music:xp': '100' });
  // หน้าพิมพ์ดีด: ไม่มี XP เดิม — จบรอบจับเวลา = 10
  const before = await summary(page);
  expect(before.legacy).toBe(100);
  await page.evaluate(() => window.LearnCore.award('typing', 10));
  expect((await summary(page)).bySrc.typing).toBe(10);
  // ค่าตั้ง: เป้ารายวันซิงก์เป็นก้อนเดียว ค่าแปลกถูกปัดเป็นค่าเริ่มต้น
  const st = await page.evaluate(() => [window.LearnCore.saveSettings({ goal: 100, rest: 2 }), window.LearnCore.saveSettings({ rest: 9 })]);
  expect(st).toEqual([{ goal: 100, rest: 2 }, { goal: 100, rest: 1 }]);
  expect(errors).toEqual([]);
});

/* ── review.html: กองเดียวจากกฎหมาย/ภาษา/ธุรกิจ เขียนผลกลับที่เดิม ── */
function seedLawIdb(notes) {
  return new Promise((res, rej) => {
    const r = indexedDB.open('tanot-barprep', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('notes', { keyPath: 'id' });
    r.onsuccess = () => {
      const tx = r.result.transaction('notes', 'readwrite');
      notes.forEach((n) => tx.objectStore('notes').put(n));
      tx.oncomplete = () => { r.result.close(); res(); };
      tx.onerror = () => rej(tx.error);
    };
  });
}
function readLawIdb() {
  return new Promise((res) => {
    const r = indexedDB.open('tanot-barprep');
    r.onsuccess = () => {
      const q = r.result.transaction('notes').objectStore('notes').getAll();
      q.onsuccess = () => { r.result.close(); res(q.result); };
    };
  });
}

test('ทบทวนวันนี้: การ์ดกฎหมาย/ภาษา/ธุรกิจรวมกอง ให้คะแนนแล้วบันทึกกลับที่เดิมด้วยสูตรเดิม + ได้ XP', async ({ page }) => {
  const t0 = NOW.getTime();
  const lawCard = { id: 'n1', subj: 'แพ่ง', q: 'มาตรา 149', a: 'นิติกรรม', createdAt: t0 - 10 * DAY, srsIdx: 1, dueAt: t0 - DAY, stability: 3, difficulty: 5, lastReview: t0 - 4 * DAY, reps: 1, lapses: 0 };
  const errors = await openWith(page, '/credits.html', {
    'lang-practice:srs': JSON.stringify({ 'lang-en::vocab-basic::0': { stability: 1, difficulty: 6, lastReview: t0 - 2 * DAY, dueAt: t0 - 1000, reps: 1, lapses: 1, srsIdx: 0 }, 'lang-en::vocab-basic::9': { dueAt: t0 + 9 * DAY } }),
    'tanot:learn:faces:lang': JSON.stringify({ v: 1, langs: { 'lang-en': 'อังกฤษ' }, cards: { 'lang-en::vocab-basic::0': ['apple', 'แอปเปิล'] } }),
    'lbe:business:srs': JSON.stringify({ 'business:management:0': { interval: 3, due: t0 - 5000 }, 'business:nope:0': { interval: 1, due: t0 - 1 } }),
  });
  await page.evaluate(seedLawIdb, [lawCard, { id: 'n2', q: 'ยังไม่ถึง', dueAt: t0 + DAY }]);
  await page.goto('/review.html', { waitUntil: 'load' });

  await expect(page.locator('#rvDue')).toContainText('4'); // กฎหมาย 1 + ภาษา 1 + ธุรกิจ 1 + ธุรกิจที่ไม่มีในคลังข้อสอบ 1
  await expect(page.locator('#rvFilter')).toContainText('กฎหมาย 1');
  await expect(page.locator('#rvFilter')).toContainText('ธุรกิจ 2');
  await expect(page.locator('.rv-more a[href="classroom-business.html"]')).toContainText('1');

  const seen = [];
  for (let i = 0; i < 3; i++) {
    const card = page.locator('#rvCard');
    await expect(card).toBeVisible();
    seen.push(await card.locator('.q').innerText());
    await card.click();
    await expect(card.locator('.a')).toBeVisible();
    await page.locator('.rv-rate [data-r="3"]').click(); // Good
  }
  expect(seen.sort()).toEqual(['apple', 'มาตรา 149', 'หน้าที่การจัดการ 4 ด้านตามแนวคิดคลาสสิกคืออะไร?'].sort());
  await expect(page.locator('#rvArea .empty')).toContainText('ทบทวนครบแล้ว 3 ใบ');
  await expect(page.locator('#rvToday')).toContainText('15');

  // กฎหมาย: ฟิลด์ FSRS เดียวกับที่ classroom-law.js เขียน ค่าตรงกับสูตรเดิม ฟิลด์อื่นของโน้ตไม่หาย
  const law = (await page.evaluate(readLawIdb)).find((n) => n.id === 'n1');
  const expLaw = withNow(t0, () => ORIG.lawCopy(lawCard, 3));
  expect(law).toEqual({ ...lawCard, ...expLaw });
  const act = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:barprep:activity')));
  expect(act).toEqual([{ t: 'review', ts: t0 }]);
  // ภาษา: ทั้ง record แทนด้วยผล FSRS (เหมือน recordSrs ในหน้าภาษา) ใบอื่นไม่ถูกแตะ
  const srs = await page.evaluate(() => JSON.parse(localStorage.getItem('lang-practice:srs')));
  expect(srs['lang-en::vocab-basic::0']).toEqual(withNow(t0, () => ORIG.langCopy({ stability: 1, difficulty: 6, lastReview: t0 - 2 * DAY, dueAt: t0 - 1000, reps: 1, lapses: 1, srsIdx: 0 }, 3)));
  expect(srs['lang-en::vocab-basic::9']).toEqual({ dueAt: t0 + 9 * DAY });
  // ธุรกิจ: ขั้นบันได 3 → 7 วัน
  const biz = await page.evaluate(() => JSON.parse(localStorage.getItem('lbe:business:srs')));
  expect(biz['business:management:0']).toEqual({ interval: 7, due: t0 + 7 * DAY });
  expect(biz['business:nope:0']).toEqual({ interval: 1, due: t0 - 1 });
  // XP กลาง: 5 ต่อใบ แยกตามที่มาของการ์ด
  const s = await summary(page);
  expect(s.todayBySrc).toEqual({ law: 5, lang: 5, biz: 5 });
  expect(errors).toEqual([]);
});

test('ทบทวนวันนี้: ไม่มีข้อมูล → empty state ไม่มี error, คีย์บอร์ด 1–4 ใช้ได้', async ({ page }) => {
  const errors = await openWith(page, '/review.html', {});
  await expect(page.locator('#rvArea .empty')).toContainText('ไม่มีการ์ดค้างทบทวน');
  await expect(page.locator('#rvSources .empty')).toBeVisible();
  await expect(page.locator('#rvDue')).toContainText('0');
  expect(errors).toEqual([]);

  const t0 = NOW.getTime();
  await page.evaluate((t0) => localStorage.setItem('lang-practice:srs', JSON.stringify({ k: { dueAt: t0 - 1 } })), t0);
  await page.evaluate(() => localStorage.setItem('tanot:learn:faces:lang', JSON.stringify({ v: 1, langs: {}, cards: { k: ['hola', 'สวัสดี'] } })));
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#rvCard .q')).toHaveText('hola');
  await page.keyboard.press('Space');
  await expect(page.locator('#rvCard .a')).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.locator('#rvArea .empty')).toContainText('ทบทวนครบแล้ว 1 ใบ');
  const k = await page.evaluate(() => JSON.parse(localStorage.getItem('lang-practice:srs')).k);
  expect(k).toMatchObject({ stability: 0.5, difficulty: 7, lapses: 1, srsIdx: -1 }); // การ์ดใหม่ตอบ Again: 5 − (1 − 3)
  expect(errors).toEqual([]);
});

/* ── ห้องเรียนวิศวกรรม: course-data → การ์ดทบทวน lbe:engineering:srs ── */
const ENG_HTML = fs.readFileSync(path.join(__dirname, '..', 'classroom-engineering.html'), 'utf8');
const ENG = JSON.parse(/<script id="course-data" type="application\/json">([\s\S]*?)<\/script>/.exec(ENG_HTML)[1]);
// 13 สาขาเดิม — id และลำดับเป็นส่วนหนึ่งของคีย์การ์ด/ความคืบหน้าที่ผู้ใช้มีอยู่แล้ว ห้ามเปลี่ยน
const ENG_OLD_IDS = ['civil-eng', 'electrical-eng', 'mechanical-eng', 'industrial-eng', 'chemical-eng', 'computer-eng', 'telecom-eng',
  'environmental-eng', 'automotive-eng', 'aerospace-eng', 'mining-eng', 'petroleum-eng', 'biomedical-eng'];
const engQ = (subj, topic, i) => ENG[subj].find((t) => t.id === topic).quiz[i];

test('ห้องเรียนวิศวกรรม: course-data คง id เดิม + หมวดบำรุงรักษาระบบไฟฟ้า ข้อสอบรูปแบบถูกต้อง', () => {
  expect(Object.keys(ENG)).toEqual(['engineering', 'elec-maint']);
  expect(ENG.engineering.map((t) => t.id)).toEqual(ENG_OLD_IDS);
  expect(ENG['elec-maint'].length).toBeGreaterThanOrEqual(10);
  expect(ENG['elec-maint'].length).toBeLessThanOrEqual(12);
  const ids = new Set();
  for (const [subj, topics] of Object.entries(ENG)) {
    for (const t of topics) {
      expect(ids.has(t.id), t.id).toBe(false); // id ซ้ำข้ามหมวดไม่ได้ (คีย์ written ของหน้าไม่มีชื่อหมวด)
      ids.add(t.id);
      expect(t.id).toMatch(/^[a-z0-9-]+$/);
      expect(t.title && t.overview).toBeTruthy();
      expect(t.keyConcepts.length).toBeGreaterThanOrEqual(4);
      expect(t.keyConcepts.length).toBeLessThanOrEqual(6);
      if (subj === 'engineering') expect(t.quiz).toHaveLength(4);
      else {
        expect(t.lesson, t.id).toBeTruthy();
        expect(t.quiz.length).toBeGreaterThanOrEqual(6);
        expect(t.quiz.length).toBeLessThanOrEqual(8);
      }
      for (const q of t.quiz) {
        expect(q.options, q.q).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4);
        expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4).toBe(true);
      }
    }
  }
});

test('ทบทวนวันนี้: การ์ดวิศวะ (13 สาขา + บำรุงรักษาระบบไฟฟ้า) หน้าการ์ดจาก course-data ให้คะแนนแล้วเขียนกลับ lbe:engineering:srs', async ({ page }) => {
  const t0 = NOW.getTime();
  const srs0 = {
    'elec-maint:grounding:4': { interval: 1, due: t0 - 2000 },
    'engineering:electrical-eng:1': { interval: 7, due: t0 - 1000 },
    'elec-maint:grounding:99': { interval: 3, due: t0 - 1 },      // ไม่มีข้อนี้ในคลัง → นับเป็น "ไปทำที่หน้าห้องเรียน"
    'engineering:civil-eng:0': { interval: 3, due: t0 + DAY },     // ยังไม่ถึงกำหนด
  };
  const errors = await openWith(page, '/review.html', { 'lbe:engineering:srs': JSON.stringify(srs0) });
  await expect(page.locator('#rvDue')).toContainText('3');
  await expect(page.locator('#rvFilter')).toContainText('วิศวกรรม 3');
  await expect(page.locator('.rv-more a[href="classroom-engineering.html"]')).toContainText('1');

  // เรียงตามวันครบกำหนด: grounding:4 ก่อน
  const g = engQ('elec-maint', 'grounding', 4), e = engQ('engineering', 'electrical-eng', 1);
  const card = page.locator('#rvCard');
  await expect(card.locator('.q')).toHaveText(g.q);
  await expect(card.locator('.src')).toContainText('ระบบต่อลงดิน');
  await card.click();
  await expect(card.locator('.a')).toHaveText(g.options[g.answer]);
  await page.locator('.rv-rate [data-r="1"]').click(); // Again → ถอยกลับ 1 วัน
  await expect(card.locator('.q')).toHaveText(e.q);
  await card.click();
  await expect(card.locator('.a')).toHaveText(e.options[e.answer]);
  await page.locator('.rv-rate [data-r="3"]').click(); // Good → 7 → 14 วัน
  await expect(page.locator('#rvArea .empty')).toContainText('ทบทวนครบแล้ว 2 ใบ');

  const srs = await page.evaluate(() => JSON.parse(localStorage.getItem('lbe:engineering:srs')));
  expect(srs).toEqual({
    ...srs0,
    'elec-maint:grounding:4': LC.lbeNext(srs0['elec-maint:grounding:4'], false, t0),
    'engineering:electrical-eng:1': LC.lbeNext(srs0['engineering:electrical-eng:1'], true, t0),
  });
  expect(srs['elec-maint:grounding:4']).toEqual({ interval: 1, due: t0 + DAY });
  expect(srs['engineering:electrical-eng:1']).toEqual({ interval: 14, due: t0 + 14 * DAY });
  expect((await summary(page)).todayBySrc).toEqual({ eng: 10 });
  expect(errors).toEqual([]);
});

test('ห้องเรียนวิศวกรรม: แสดง 13 สาขา + หมวดบำรุงรักษาระบบไฟฟ้า เนื้อหาบทเรียน ทำแบบฝึกแล้วเข้าคิวทบทวน ข้อมูลเดิมยังใช้ได้', async ({ page }) => {
  // React/ReactDOM/Babel ของหน้ามาจาก unpkg — ในเทสต์เสิร์ฟจาก tests/node_modules (รุ่นเดียวกับที่ unpkg ให้ตอนเขียนเทสต์)
  const LOCAL = {
    '/react@18/umd/react.production.min.js': 'react/umd/react.production.min.js',
    '/react-dom@18/umd/react-dom.production.min.js': 'react-dom/umd/react-dom.production.min.js',
    '/@babel/standalone/babel.min.js': '@babel/standalone/babel.min.js',
  };
  const t0 = NOW.getTime();
  const oldSrs = { 'engineering:civil-eng:0': { interval: 3, due: t0 - 1 } };
  const errors = await openWith(page, '/review.html', {});
  await page.route('https://unpkg.com/**', (route) => {
    const f = LOCAL[new URL(route.request().url()).pathname];
    return f ? route.fulfill({ path: path.join(__dirname, 'node_modules', f), contentType: 'text/javascript' }) : route.abort('internetdisconnected');
  });
  // ข้อมูลเดิมของหน้า (ก่อนมีเนื้อหา): ความคืบหน้า/XP/คิวทบทวน
  await page.evaluate((s) => {
    localStorage.setItem('lbe:engineering:xp', '1300');
    localStorage.setItem('lbe:engineering:completed', JSON.stringify({ 'engineering:civil-eng': true }));
    localStorage.setItem('lbe:engineering:srs', JSON.stringify(s));
  }, oldSrs);
  await page.goto('/classroom-engineering.html', { waitUntil: 'load' });
  await expect(page.locator('h1')).toContainText('ห้องเรียนวิศวกรรม');
  await expect(page.getByText('(1300 XP)')).toBeVisible();

  // สตรีม: 2 หมวด ความคืบหน้าเดิมยังนับ
  const subjBtn = (label) => page.getByRole('button', { name: new RegExp('^' + label + ' \\d+/\\d+ หัวข้อ$') });
  await expect(subjBtn('วิศวกรรม')).toContainText('1/13 หัวข้อ');
  await expect(subjBtn('บำรุงรักษาระบบไฟฟ้า')).toContainText('0/' + ENG['elec-maint'].length + ' หัวข้อ');
  // แท็บทบทวนนับคิวเดิม
  await expect(page.locator('#root button', { hasText: 'ทบทวน' }).first()).toContainText('1');

  // เปิดหมวดใหม่ → หัวข้อแรก แท็บสรุปเนื้อหา + บทเรียน
  await subjBtn('บำรุงรักษาระบบไฟฟ้า').click();
  const first = ENG['elec-maint'][0];
  await expect(page.locator('main h3').first()).toContainText(first.title);
  await expect(page.locator('main')).toContainText(first.overview);
  await expect(page.locator('main .lesson h3').first()).toBeVisible();
  // แถบหัวข้อมีครบทั้ง 2 หมวด
  const aside = page.locator('aside');
  for (const t of [...ENG.engineering, ...ENG['elec-maint']]) await expect(aside.getByRole('button', { name: t.title, exact: true })).toBeVisible();

  // ทำแบบฝึกหัวข้อระบบต่อลงดิน 2 ข้อ: ถูก 1 ผิด 1
  await aside.getByRole('button', { name: 'ระบบต่อลงดิน', exact: true }).click();
  await page.getByRole('button', { name: 'แบบฝึกเขียนตอบ' }).click();
  for (const [i, ok] of [[0, true], [1, false]]) {
    const q = engQ('elec-maint', 'grounding', i);
    await expect(page.locator('main h3')).toHaveText(q.q);
    await page.locator('main textarea').fill('คำตอบทดสอบ');
    await page.getByRole('button', { name: 'ส่งคำตอบ' }).click();
    await expect(page.locator('main')).toContainText(q.options[q.answer]);
    await page.getByRole('button', { name: ok ? 'ตอบถูก (+100 XP)' : 'ยังไม่ถูก' }).click();
    await page.getByRole('button', { name: 'ข้อต่อไป' }).click();
  }
  await expect(page.getByText('(1400 XP)')).toBeVisible();
  const srs = await page.evaluate(() => JSON.parse(localStorage.getItem('lbe:engineering:srs')));
  expect(srs).toEqual({
    ...oldSrs,
    'elec-maint:grounding:0': { interval: 1, due: t0 + DAY },
    'elec-maint:grounding:1': { interval: 1, due: t0 + DAY },
  });
  expect(await page.evaluate(() => localStorage.getItem('lbe:engineering:xp'))).toBe('1400');
  expect((await summary(page)).todayBySrc).toEqual({ eng: 100 });

  // ทบทวนในหน้า: การ์ดเดิมของสาขาเดิมได้หน้าการ์ดใหม่จาก course-data
  await page.locator('#root button', { hasText: 'ทบทวน' }).first().click();
  await expect(page.locator('#root h3')).toHaveText(engQ('engineering', 'civil-eng', 0).q);
  expect(errors).toEqual([]);
});

/* ── ซิงก์ 2 เครื่อง: แถว XP ไม่ทับกัน, ยอดเดิมไม่นับซ้ำ ── */
const SYNC = 'http://localhost:8128';
test.describe('ซิงก์ 2 เครื่อง', () => {
  test.describe.configure({ mode: 'serial' });
  async function device(browser, seed) {
    const ctx = await browser.newContext({ baseURL: SYNC });
    await ctx.addInitScript((seed) => {
      window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
      window.TANOT_NO_RELOAD_BAR = true;
      if (seed && !sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      }
    }, seed);
    const page = await ctx.newPage();
    const errors = await prepare(page);
    await page.goto('/review.html');
    return { ctx, page, errors };
  }
  const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));

  test('XP จาก 2 เครื่องวันเดียวกันรวมกันครบ และยอดเดิมไม่นับซ้ำเมื่ออีกเครื่องย้ายทีหลัง', async ({ browser, request }) => {
    await request.get(SYNC + '/__reset');
    const A = await device(browser, { 'lang-practice:xp': '500' });
    expect((await summary(A.page)).legacy).toBe(500);
    // หน้าภาษาให้ XP 10: เรียก LearnCore ก่อน แล้วบันทึกคีย์เดิมของหน้า (ลำดับเดียวกับ languages.jsx)
    await A.page.evaluate(() => { window.LearnCore.award('lang', 10); localStorage.setItem('lang-practice:xp', '510'); });
    expect(await sync(A.page)).toBe('ok');

    const B = await device(browser, null); // เครื่องใหม่ ไม่มีข้อมูลเดิม
    expect(await sync(B.page)).toBe('ok');
    await B.page.evaluate(() => { window.LearnCore.award('music', 20); window.LearnCore.award('law', 5); });
    // B เปิดหน้าใหม่หลังได้คีย์เดิม (510 รวม XP ใหม่ของ A แล้ว) → ถ่ายยอดเดิมของ B แต่ต้องไม่นับ 10 ซ้ำ
    await B.page.reload({ waitUntil: 'load' });
    expect(await B.page.evaluate(() => JSON.parse(localStorage.getItem('tanot:learn:legacy')).length)).toBe(2);
    await A.page.evaluate(() => window.LearnCore.award('lang', 2));
    expect(await sync(B.page)).toBe('ok');
    expect(await sync(A.page)).toBe('ok');
    expect(await sync(B.page)).toBe('ok');

    for (const D of [A, B]) {
      const s = await summary(D.page);
      expect(s.legacy).toBe(500);
      expect(s.bySrc).toMatchObject({ lang: 512, music: 20, law: 5 });
      expect(s.total).toBe(537);
      expect(s.todayXp).toBe(37);
      const rows = await D.page.evaluate(() => JSON.parse(localStorage.getItem('tanot:learn:xp')));
      expect(rows).toHaveLength(3);
      expect(new Set(rows.map((r) => r.dev)).size).toBe(2);
    }
    const dump = await (await request.get(SYNC + '/__dump')).json();
    expect(dump.filter((d) => d.ns === 'll:tanot:learn:xp' && !d.deleted)).toHaveLength(3);
    expect([...A.errors, ...B.errors]).toEqual([]);
    await A.ctx.close(); await B.ctx.close();
  });
});
