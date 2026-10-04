// @ts-check
// หน้าแรก (index.html) แบบ Symmetrical Balance + home-calc.js + shell.js "เปิดล่าสุด" — ROADMAP รอบ 3
//   known-answer ของ home-calc.js / HealthCalc.change / CookPlan.toggleDone+todayMeals
//   หน้า: ข้อมูลครบทุกแหล่ง · ว่าง · ของใกล้กำหนดโผล่/ไม่โผล่ตามวัน · กล่องคู่สูงเท่ากันที่ 1100 · จัดหน้าแรก (ซ่อน/ย้าย/จำค่า)
//         ปุ่มทำทันที (กินแล้ว/ทำแล้ว) · สลับภาษาสด + ไม่มีไทยหลุดใน EN · มือถือ 390/360 ทั้ง 5 ตัวชี้วัด = 0 · ยอดรวมบทจากหน้าวิชา (แคช)
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');
const { NOW, NOW_MS, seedFull, applyOverrides, ymd } = require('./home-fixtures');

const H = require(path.join(__dirname, '..', 'home-calc.js'));
const HC = require(path.join(__dirname, '..', 'health-calc.js'));
const CP = require(path.join(__dirname, '..', 'cooking-plan-calc.js'));
const AUDIT_JS = path.join(__dirname, 'theme-audit-page.js');
const DAY = 86400000;

async function openHome(page, { data = true, overrides, width = 1100, theme = 'light', lang, at = NOW, path: p = '/index.html' } = {}) {
  const errors = await prepare(page, { theme });
  if (lang) await page.addInitScript((l) => localStorage.setItem('ome:lang', l), lang);
  if (data) await page.addInitScript(seedFull);
  if (overrides) await page.addInitScript(applyOverrides, overrides);
  await page.clock.setFixedTime(at);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(p, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  if (p.startsWith('/index')) await page.waitForSelector('#todoBody > *');
  return errors;
}
const todo = (page, kind) => page.locator('#todoBody .todo-row' + (kind ? `[data-kind="${kind}"]` : ''));
const box = async (page, id) => (await page.locator(id).boundingBox());

test.describe('home-calc.js (known-answer)', () => {
  test('urgencyOfDays / sortTodos: err → warn → info แล้วตาม sort แล้วลำดับเดิม', () => {
    expect([-1, 0, 7, 8].map(H.urgencyOfDays)).toEqual(['err', 'warn', 'warn', 'info']);
    const out = H.sortTodos([
      { id: 'a', urgency: 'info', sort: 3 }, { id: 'b', urgency: 'warn', sort: 2 }, { id: 'c', urgency: 'err', sort: 9 },
      { id: 'd', urgency: 'warn', sort: -1 }, { id: 'e', urgency: 'info', sort: 3 }, { id: 'f', urgency: 'err', sort: -5 },
    ]);
    expect(out.map((x) => x.id)).toEqual(['f', 'c', 'd', 'b', 'a', 'e']);
  });

  test('estMinutes 30 วินาทีต่อใบ ปัดขึ้น ≥ 1 · reviewTodos เรียงมาก→น้อย ข้ามวิชาที่ไม่มีใบ', () => {
    expect([1, 2, 3, 4, 5, 61].map(H.estMinutes)).toEqual([1, 1, 2, 2, 3, 31]);
    const r = H.reviewTodos({ lang: 2, law: 0, biz: 7, books: 1 }, ['lang', 'law', 'biz', 'eng', 'books']);
    expect(r.map((x) => [x.src, x.n, x.minutes, x.urgency])).toEqual([['biz', 7, 4, 'info'], ['lang', 2, 1, 'info'], ['books', 1, 1, 'info']]);
  });

  test('budgetAlerts: ≥ 90% เตือน (< 90% ไม่) · ≥ 100% = err · เรียงสัดส่วนมากสุดก่อน · เฉพาะหมวดที่ตั้งงบ', () => {
    const rec = [
      { date: '2026-09-01', type: 'expense', categoryId: 'a', amount: 899 }, // 89.9% → ไม่เตือน
      { date: '2026-09-01', type: 'expense', categoryId: 'b', amount: 900 }, // 90% → warn
      { date: '2026-09-01', type: 'expense', categoryId: 'c', amount: 1500 }, // 150% → err
      { date: '2026-09-01', type: 'expense', categoryId: 'nobudget', amount: 99999 },
      { date: '2026-08-31', type: 'expense', categoryId: 'a', amount: 5000 }, // คนละเดือน
    ];
    const out = H.budgetAlerts(rec, { '2026-09': { a: 1000, b: 1000, c: 1000 } }, '2026-09');
    expect(out.map((x) => [x.catId, x.pct, x.urgency])).toEqual([['c', 150, 'err'], ['b', 90, 'warn']]);
    expect(H.budgetAlerts(rec, { '2026-09': { a: 1000 } }, '2026-09')).toEqual([]);
  });

  test('monthSummary: รายรับ/รายจ่าย/คงเหลือ + หมวดที่ใช้มากสุด 3 อันดับ (pct เทียบงบ ไม่มีงบ = สัดส่วนรายจ่าย)', () => {
    const rec = [
      { date: '2026-09-01', type: 'income', amount: 30000 }, { date: '2026-09-02', type: 'expense', categoryId: 'x', amount: 600 },
      { date: '2026-09-03', type: 'expense', categoryId: 'y', amount: 300 }, { date: '2026-09-03', type: 'expense', categoryId: 'z', amount: 50 },
      { date: '2026-09-04', type: 'expense', categoryId: 'w', amount: 50 }, { date: '2026-08-04', type: 'expense', categoryId: 'x', amount: 7777 },
    ];
    const s = H.monthSummary(rec, { '2026-09': { y: 600 } }, '2026-09', 3);
    expect([s.income, s.expense, s.balance]).toEqual([30000, 1000, 29000]);
    expect(s.cats.map((c) => [c.id, c.spent, c.budget, c.pct])).toEqual([['x', 600, 0, 60], ['y', 300, 600, 50], ['z', 50, 0, 5]]);
    expect(H.monthSummary([], {}, '2026-09').any).toBe(false);
    expect(H.monthSummary([], { '2026-09': { a: 100 } }, '2026-09').any).toBe(true);
  });

  test('dayChange เทียบ snapshot ล่าสุดของวันก่อนหน้า · series30 = 30 วันล่าสุด (วันนี้ใช้มูลค่าสด) · spark ต้องมี ≥ 2 จุด', () => {
    const hist = [{ d: '2026-09-27', v: 100 }, { d: '2026-09-29', v: 200 }, { d: '2026-09-30', v: 999 }, { d: '2026-08-01', v: 50 }];
    const dc = H.dayChange(hist, '2026-09-30', 210);
    expect(dc.delta).toBe(10); expect(dc.pct).toBeCloseTo(5, 6); expect(dc.base.d).toBe('2026-09-29');
    expect(H.dayChange([{ d: '2026-09-30', v: 5 }], '2026-09-30', 5)).toBeNull();
    const s = H.series30(hist, '2026-09-30', 210);
    expect(s.map((p) => p.d)).toEqual(['2026-09-27', '2026-09-29', '2026-09-30']); // 2026-08-01 เก่ากว่า 30 วัน
    expect(s[2].v).toBe(210);
    expect(H.spark([{ d: '2026-09-30', v: 1 }], 300, 64)).toBeNull();
    const sp = H.spark(s, 300, 64, 4);
    expect(sp.line.startsWith('M4 ')).toBe(true);
    expect(sp.last.x).toBeCloseTo(98.67, 1); // (300 − 4)/300
    expect(sp.last.y).toBeCloseTo(6.25, 1);  // ค่าสูงสุด = บนสุด (pad 4/64)
  });

  test('weekDots: ฝึกแล้ว / วันพัก (ขาดแต่ยังอยู่ในช่วงต่อเนื่อง) / ขาด / วันนี้ยังไม่ฝึก', () => {
    const rc = (...a) => a.map((active, i) => ({ d: 'd' + i, active, xp: active ? 10 : 0 }));
    // เก่า→วันนี้: 14 วัน ปลายทาง ... T F T T F T (วันนี้ F) ; streak = 4 วัน (ไม่นับวันนี้) ฝึก 4 + พัก 2
    const days = rc(false, false, false, false, false, false, false, false, true, false, true, true, false, true, false);
    const dots = H.weekDots(days, { count: 4, doneToday: false });
    expect(dots.length).toBe(7);
    expect(dots.map((d) => d.state)).toEqual(['done', 'rest', 'done', 'done', 'rest', 'done', 'today']);
    // วันนี้ฝึกแล้ว
    expect(H.weekDots(rc(true, true, true, true, true, true, true), { count: 7, doneToday: true }).every((d) => d.state === 'done')).toBe(true);
    // ไม่มีวันต่อเนื่อง: ที่ขาดเป็น miss
    expect(H.weekDots(rc(false, false, false, false, false, false, false), { count: 0, doneToday: false }).map((d) => d.state)).toEqual(['miss', 'miss', 'miss', 'miss', 'miss', 'miss', 'today']);
  });

  test('langRows / lbeRow / lawRow / hobbyRow: % จากยอดรวม, บทถัดไป, ไม่มียอดรวม = นับอย่างเดียว', () => {
    const meta = H.langMeta({ 'lang-en': { title: 'อังกฤษ', phrases: { A: [1, 2, 3, 4], B: [1, 2, 3, 4] } } });
    const rows = H.langRows({ 'lang-en:A': [true, true, true, true], 'lang-en:B': [true, false, false, false], 'lang-jp:A': [false, false], 'bad': [true] }, meta);
    expect(rows).toHaveLength(1); // lang-jp ไม่มีวลีที่ทำเครื่องหมาย
    expect(rows[0]).toMatchObject({ langId: 'lang-en', marked: 5, total: 8, done: 5, pct: 63, next: 'B' });
    expect(H.langRows({ 'lang-en:A': [true] }, null)[0]).toMatchObject({ marked: 1, pct: null, next: null });
    const topics = H.lbeTopics('eng', { engineering: [{ id: 'c', title: 'โยธา' }, { id: 'm', title: 'เครื่องกล' }], 'elec-maint': [{ id: 'e', title: 'ไฟฟ้า' }] });
    expect(topics.map((t) => t.k)).toEqual(['engineering:c', 'engineering:m', 'elec-maint:e']);
    expect(H.lbeTopics('biz', { business: { management: { title: 'จัดการ' }, hrm: { title: 'บุคคล' } } }).map((t) => t.k)).toEqual(['business:management', 'business:hrm']);
    expect(H.lbeRow('eng', { 'engineering:c': true }, topics)).toMatchObject({ done: 1, total: 3, pct: 33, next: 'เครื่องกล' });
    expect(H.lbeRow('eng', { 'engineering:c': true, 'engineering:m': true, 'elec-maint:e': true }, topics)).toMatchObject({ pct: 100, next: null });
    expect(H.lbeRow('biz', {}, null)).toBeNull();
    expect(H.lawRow({ civil: { a: 1, b: 1 }, crim: { c: 1 } })).toMatchObject({ done: 3, pct: null });
    expect(H.lawRow({})).toBeNull();
    expect(H.hobbyRow('music', { 'x::0': true, 'x::1': false })).toMatchObject({ done: 1 });
  });

  test('sortStudy: เปิดล่าสุดก่อน แล้วความคืบหน้ามาก→น้อย', () => {
    const rows = [{ src: 'music', done: 5 }, { src: 'law', done: 2 }, { src: 'eng', done: 1, pct: 40 }, { src: 'biz', done: 1, pct: 10 }];
    const hrefs = { music: 'm.html', law: 'l.html', eng: 'e.html', biz: 'b.html' };
    const out = H.sortStudy(rows, { 'l.html': 300, 'm.html': 200 }, (s) => hrefs[s]);
    expect(out.map((r) => r.src)).toEqual(['law', 'music', 'eng', 'biz']);
  });

  test('watchList: ไทยที่ติดตาม → นอก → ที่ถือ (ไม่ซ้ำ ไม่นับ SET/ดัชนี/คริปโต) ไม่เกิน 3', () => {
    const w = H.watchList(['SET', 'PTT', 'AOT'], ['AAPL', 'BTC-USD'], ['PTT', 'KBANK'], ['NVDA'], 3);
    expect(w.map((x) => x.sym)).toEqual(['PTT', 'AOT', 'AAPL']);
    expect(w[0]).toMatchObject({ yahoo: 'PTT.BK', href: 'invest-stock.html?sym=PTT#th' });
    expect(w[2]).toMatchObject({ yahoo: 'AAPL', href: 'invest-stock.html?sym=AAPL#us' });
    expect(H.watchList([], [], ['ptt'], [], 3).map((x) => x.sym)).toEqual(['PTT']);
    expect(H.watchList([], [], [], [], 3)).toEqual([]);
  });

  test('cleanLayout / layoutPlan / moveRow / toggleBox / lastUsed', () => {
    expect(H.cleanLayout(null)).toEqual({ v: 1, order: ['todo', 'money-invest', 'learn', 'health-meals'], hidden: [] });
    expect(H.cleanLayout({ order: ['learn', 'bogus', 'learn'], hidden: ['meals', 'x', 'meals'] })).toEqual({ v: 1, order: ['learn', 'todo', 'money-invest', 'health-meals'], hidden: ['meals'] });
    const plan = H.layoutPlan({ order: ['health-meals', 'todo', 'money-invest', 'learn'], hidden: ['meals', 'money'] });
    expect(plan.health).toMatchObject({ order: 0, hidden: false, wide: true });   // คู่ที่อีกใบถูกซ่อน = เต็มความกว้าง
    expect(plan.meals).toMatchObject({ order: 1, hidden: true });
    expect(plan.todo).toMatchObject({ order: 10, wide: true });
    expect(plan.invest).toMatchObject({ hidden: false, wide: true });
    expect(plan.learn.order).toBe(30);
    expect(H.moveRow(null, 'learn', -1).order).toEqual(['todo', 'learn', 'money-invest', 'health-meals']);
    expect(H.moveRow(null, 'todo', -1).order[0]).toBe('todo'); // ขอบบน ไม่ขยับ
    expect(H.toggleBox(null, 'invest', false).hidden).toEqual(['invest']);
    expect(H.toggleBox({ hidden: ['invest'] }, 'invest', true).hidden).toEqual([]);
    const nav = { 'a.html': 5, 'b.html': 9, 'c.html': 1 };
    expect(H.lastUsed(nav, ['a.html', 'b.html#x', 'c.html?q=1', 'd.html'], 2).map((x) => x.href)).toEqual(['b.html#x', 'a.html']);
    expect(H.lastUsed({}, ['a.html'], 4)).toEqual([]);
  });

  test('HealthCalc.change: ภายใน 30 วันก่อนการวัดล่าสุด · base = ค่าเก่าสุดในช่วง · มีค่าเดียว = null', () => {
    const v = [{ id: 'a', at: NOW_MS - 40 * DAY, weight: 80 }, { id: 'b', at: NOW_MS - 25 * DAY, weight: 70 }, { id: 'c', at: NOW_MS - 2 * DAY, weight: 69.2 }];
    expect(HC.change(v, 'weight', 30)).toEqual({ last: 69.2, base: 70, delta: -0.8, days: 23 });
    expect(HC.change([v[2]], 'weight', 30)).toBeNull();
    expect(HC.change([v[0], v[2]], 'weight', 30)).toBeNull(); // 40 วันก่อนอยู่นอกช่วง
    expect(HC.change(v, 'sys', 30)).toBeNull();
  });

  test('CookPlan.toggleDone: XP ครั้งเดียวต่อมื้อ (ยกเลิกแล้วกดใหม่ไม่ให้ซ้ำ) · ช่องว่าง = null · todayMeals ตามวันของสัปดาห์ (เวลาไทย)', () => {
    const plan = CP.cleanPlan({ slots: { '2:b': { recipeId: 'seed-omelet', servings: 2 } } }, '2026-09-28');
    expect(CP.toggleDone(plan, '0:b', 1)).toBeNull();
    expect(CP.toggleDone(plan, '2:b', 100)).toEqual({ gave: true });
    expect(plan.done['2:b']).toBe(100); expect(plan.awarded['2:b']).toBe(100); expect(plan.updatedAt).toBe(100);
    expect(CP.toggleDone(plan, '2:b', 200)).toEqual({ gave: false }); // ยกเลิก
    expect(plan.done['2:b']).toBeUndefined();
    expect(CP.toggleDone(plan, '2:b', 300)).toEqual({ gave: false }); // กดใหม่ — awarded เดิมอยู่ ไม่ให้ซ้ำ
    expect(plan.done['2:b']).toBe(300); expect(plan.awarded['2:b']).toBe(100);
    const rows = [{ id: 'week-2026-09-28', slots: { '2:l': { recipeId: 'seed-kaprao', servings: 3 } }, done: { '2:l': 1 } }];
    const tm = CP.todayMeals(rows, CP.seedRecipes(0), NOW_MS); // พุธ 30 ก.ย. = วัน 2
    expect(tm.week).toBe('2026-09-28');
    expect(tm.slots.map((s) => [s.slot, s.planned, s.done])).toEqual([['2:b', false, false], ['2:l', true, true], ['2:d', false, false]]);
    expect(tm.slots[1].recipe.name).toBe('ผัดกะเพราหมูสับ'); expect(tm.slots[1].servings).toBe(3);
    // 00:30 เวลาไทยของวันจันทร์ = ยังเป็นสัปดาห์ใหม่ (วัน 0) แม้ UTC ยังเป็นวันอาทิตย์
    expect(CP.todayMeals([], [], new Date('2026-10-05T00:30:00+07:00').getTime()).slots[0].slot).toBe('0:b');
  });
});

test.describe('หน้าแรก: ข้อมูลครบ', () => {
  test('ต้องทำวันนี้: รวมทุกแหล่ง เรียง err → warn → info · ป้ายสถานะตามความเร่ง · ปุ่มทำทันที', async ({ page }) => {
    const errors = await openHome(page);
    const kinds = await todo(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-kind') + ':' + e.getAttribute('data-urg')));
    // err: PM เลยกำหนด + งบน้ำมันเกิน · warn: ข้าว 92% + ยา + PM ถึงกำหนด · info: ทบทวน (ภาษา 2/ธุรกิจ 1) + พ.ร.บ. อีก 5 วัน(warn) + ประกัน/ประกันสินค้า 10/15 วัน
    expect(kinds.filter((k) => k.endsWith(':err')).length).toBe(2);
    const order = kinds.map((k) => k.split(':')[1]);
    expect(order).toEqual([...order].sort((a, b) => ({ err: 0, warn: 1, info: 2 }[a] - { err: 0, warn: 1, info: 2 }[b])));
    for (const k of ['mnt', 'budget', 'med', 'review', 'car', 'ins', 'war']) expect(kinds.some((x) => x.startsWith(k + ':')), k).toBe(true);
    await expect(todo(page, 'mnt').first()).toContainText('RN05-ESC-01');
    await expect(todo(page, 'mnt').first()).toContainText('เลย 61 วัน');
    await expect(todo(page, 'mnt').first().locator('.pill')).toHaveClass(/err/);
    await expect(todo(page, 'budget').first()).toContainText('เติมน้ำมัน ใช้ไป 116% ของงบ'); // 1400/1200 → 116%
    await expect(todo(page, 'budget').first().locator('.pill')).toHaveText('เกินงบ');
    await expect(todo(page, 'budget').nth(1)).toContainText('ค่าข้าว ใช้ไป 92% ของงบ');
    await expect(todo(page, 'budget').nth(1).locator('.pill')).toHaveText('ใกล้เต็ม');
    // ค่าไฟ 45% ไม่เตือน
    await expect(page.locator('#todoBody')).not.toContainText('ค่าไฟ ใช้ไป');
    // ยา: ถึงเวลา 08:00 ยังไม่ติ๊ก (20:00 ยังไม่ถึง)
    await expect(todo(page, 'med')).toHaveCount(1);
    await expect(todo(page, 'med')).toContainText('กินยา · วิตามินดี');
    await expect(todo(page, 'med')).toContainText('08:00 น.');
    // ทบทวนแยกตามวิชา + เวลาประมาณ (ภาษา 2 ใบ, ธุรกิจ 1 ใบ → 1 นาที)
    await expect(todo(page, 'review')).toHaveCount(2);
    await expect(todo(page, 'review').first()).toContainText('ทบทวนภาษา 2 ใบ');
    await expect(todo(page, 'review').first()).toContainText('ประมาณ 1 นาที');
    await expect(todo(page, 'review').first().locator('a')).toHaveAttribute('href', 'review.html#lang');
    // พ.ร.บ. อีก 5 วัน = warn; ประกัน อีก 10 วัน = warn(≤7? ไม่ใช่ → info); ประกันสินค้า อีก 15 วัน = info
    await expect(todo(page, 'car')).toHaveCount(1);
    await expect(todo(page, 'car')).toContainText('พ.ร.บ.');
    await expect(todo(page, 'car').locator('.pill')).toHaveText('อีก 5 วัน');
    await expect(todo(page, 'car')).toHaveAttribute('data-urg', 'warn');
    await expect(todo(page, 'ins')).toContainText('ต่ออายุประกัน · เมืองไทย · สุขภาพ ผู้ป่วยใน');
    await expect(todo(page, 'ins')).toHaveAttribute('data-urg', 'info');
    await expect(todo(page, 'war')).toContainText('ประกันสินค้าหมด · พัดลม');
    await expect(page.locator('#todoBody')).not.toContainText('ตู้เย็น');
    await expect(page.locator('#todoBody')).not.toContainText('ทิพยประกันภัย');
    await expect(page.locator('#todoCount')).toHaveText(`${kinds.length} เรื่อง`);
    expect(errors).toEqual([]);
  });

  test('เงินเดือนนี้ / พอร์ตลงทุน / สุขภาพ / เมนูวันนี้ แสดงค่าที่ถูกต้อง', async ({ page }) => {
    const errors = await openHome(page);
    const sp = page.locator('#spendBody');
    await expect(sp.locator('[data-s=income]')).toHaveText('฿30,000');
    await expect(sp.locator('[data-s=expense]')).toHaveText('฿5,060'); // 2760 + 1400 + 900
    await expect(sp.locator('[data-s=balance]')).toHaveText('฿24,940');
    const rows = sp.locator('.meter-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('ค่าข้าว'); // ใช้มากสุด 2,760
    await expect(rows.nth(0)).toContainText('฿2,760 / ฿3,000');
    await expect(rows.nth(1)).toContainText('เติมน้ำมัน');
    await expect(rows.nth(1).locator('.meter')).toHaveClass(/err/);
    await expect(rows.nth(1).locator('.meter')).toHaveAttribute('aria-valuenow', '100'); // 116% ตัดที่ 100 ใน aria
    await expect(rows.nth(2)).toContainText('ค่าไฟ');
    await expect(rows.nth(0).locator('.meter')).toHaveClass(/warn/);

    const inv = page.locator('#investBody');
    await expect(inv.locator('[data-i=total]')).toHaveText('฿40,350');
    await expect(inv.locator('[data-i=pl]')).toContainText('+฿350');
    // วันนี้ = เทียบ snapshot ล่าสุดของเมื่อวาน (12 วันก่อน → i=1: 38000 + 12*190 + 1*120 = 40400) → −฿50
    await expect(inv.locator('[data-i=today]')).toContainText('−฿50');
    await expect(inv.locator('.spark path.spark-line')).toHaveCount(1);
    await expect(inv.locator('.spark .spark-dot')).toHaveCount(1);
  });

  test('ลงทุน: ไม่มีป้ายอัตราแลกเปลี่ยนเมื่อไม่มีสินทรัพย์ USD · รายการติดตาม 3 ตัวพร้อมราคาจากแคช', async ({ page }) => {
    await openHome(page);
    await expect(page.locator('#investBody [data-i=nofx]')).toHaveCount(0);
    const w = page.locator('#investBody .list-row');
    await expect(w).toHaveCount(3);
    await expect(w.nth(0)).toContainText('PTT');
    await expect(w.nth(0)).toContainText('34.5');
    await expect(w.nth(0)).toContainText('+1.47%');
    await expect(w.nth(1)).toContainText('AOT');
    await expect(w.nth(1)).toContainText('—');
    await expect(w.nth(0)).toHaveAttribute('href', 'invest-stock.html?sym=PTT#th');
  });

  test('สุขภาพ: น้ำหนักล่าสุด + เปลี่ยน 30 วัน, ความดัน, ออกกำลังกายสัปดาห์นี้/เป้า · เมนู: 3 มื้อ + ของที่ยังไม่ซื้อ', async ({ page }) => {
    await openHome(page);
    const h = page.locator('#healthBody');
    await expect(h.locator('[data-h=weight]')).toContainText('69.2');
    await expect(h.locator('[data-h=weightChange]')).toContainText('−0.8 กก. ใน 30 วัน');
    await expect(h.locator('[data-h=bp]')).toContainText('118/76');
    await expect(h.locator('[data-h=workout]')).toContainText('ออกกำลังกายสัปดาห์นี้ 105 / 150 นาที');
    await expect(h.locator('[data-h=workout] .meter')).toHaveAttribute('aria-valuenow', '70');
    const m = page.locator('#mealList .list-row');
    await expect(m).toHaveCount(3);
    await expect(m.nth(0)).toContainText('ไข่เจียวหมูสับ'); await expect(m.nth(0)).toContainText('เช้า');
    await expect(m.nth(0)).toContainText('ทำแล้ว');
    await expect(m.nth(1)).toContainText('ผัดกะเพราหมูสับ'); await expect(m.nth(1)).toContainText('กลางวัน');
    await expect(m.nth(2)).toContainText('ต้มยำกุ้ง'); await expect(m.nth(2)).toContainText('4 ที่');
    await expect(page.locator('[data-m=toBuy]')).toContainText(/ของที่ยังไม่ซื้อ \d+ รายการ/);
  });

  test('เรียนต่อ: แถบ 4 ช่อง (วันติดต่อกัน/จุด 7 วัน/XP/ทบทวน) + วิชาเรียงตามเปิดล่าสุด พร้อม % + ปุ่ม "ต่อ" ลิงก์ไปบทที่ค้าง', async ({ page }) => {
    const errors = await openHome(page);
    const l = page.locator('#learnBody');
    await expect(l.locator('[data-l=streak]')).toContainText('6'); // 5 วันเดิม (ถึงเมื่อวาน) + วันนี้ที่ฝึกแล้ว (XP 42)
    await expect(l.locator('[data-l=xp]')).toContainText('42');
    await expect(l.locator('[data-l=xp]')).toContainText('50');
    await expect(l.locator('[data-l=due]')).toHaveText('3');
    await expect(l.locator('.dots .dot')).toHaveCount(7);
    await expect(l.locator('.dots .dot').last()).toHaveClass(/done/);
    // เรียงตามเปิดล่าสุด: ภาษา(1 ชม.) → ทำอาหาร(2 ชม.) → กฎหมาย(26 ชม.) → ธุรกิจ(3 วัน) → ดนตรี(5 วัน) → วิศวกรรม(ไม่เคยเปิด)
    const order = await l.locator('#studyList .list-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-src') + (e.getAttribute('data-lang') ? ':' + e.getAttribute('data-lang') : '')));
    expect(order.slice(0, 2).sort()).toEqual(['lang:lang-en', 'lang:lang-jp']);
    expect(order.slice(2)).toEqual(['cooking', 'law', 'biz', 'music', 'eng']);
    // % + บทถัดไป มาจากยอดรวมในหน้าวิชา (ดึงครั้งเดียวแล้วเก็บแคช)
    const en = l.locator('[data-lang="lang-en"]');
    await expect(en.locator('[data-p]')).toHaveText('19%'); // 6 / 32 วลี
    await expect(en).toContainText('ภาษาอังกฤษ');
    await expect(en).toContainText('บทถัดไป: การเดินทางและร้านอาหาร');
    await expect(en.locator('a.btn')).toHaveAttribute('href', 'languages.html#lang-en');
    await expect(en.locator('.meter')).toHaveAttribute('aria-valuenow', '19');
    const biz = l.locator('[data-src=biz]');
    await expect(biz.locator('[data-p]')).toHaveText('17%'); // 2 / 12 หัวข้อ
    await expect(biz).toContainText('บทถัดไป: การตลาด');
    await expect(biz.locator('a.btn')).toHaveAttribute('href', 'classroom-business.html');
    await expect(l.locator('[data-src=eng] [data-p]')).toHaveText(/\d+%/);
    // วิชาที่ไม่มียอดรวม: แสดงเท่าที่มี + ลิงก์ไปหน้านั้น
    await expect(l.locator('[data-src=law]')).toContainText('อ่านแล้ว 3 หัวข้อ');
    await expect(l.locator('[data-src=music]')).toContainText('เรียนแล้ว 2 บท');
    await expect(l.locator('[data-src=music] a.btn')).toHaveAttribute('href', 'music.html');
    await expect(l.locator('[data-src=law] [data-p]')).toHaveCount(0);
    const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:home:cache')));
    expect(Object.keys(cache).sort()).toEqual(['biz', 'eng', 'lang', 'ts']);
    expect(errors).toEqual([]);
  });

  test('ยอดรวมจากหน้าวิชา: ดึงครั้งเดียว (มีแคชที่ยังใหม่ = ไม่ดึงซ้ำ) · ดึงไม่ได้ = ยังแสดงเท่าที่มี ไม่ error', async ({ page, context }) => {
    const reqs = [];
    page.on('request', (r) => { if (/\/(languages|classroom-business|classroom-engineering)\.html$/.test(r.url())) reqs.push(new URL(r.url()).pathname); });
    await openHome(page);
    await expect(page.locator('[data-lang="lang-en"] [data-p]')).toHaveText('19%');
    expect(reqs.sort()).toEqual(['/classroom-business.html', '/classroom-engineering.html', '/languages.html']);
    reqs.length = 0;
    await page.reload(); await page.waitForSelector('[data-lang="lang-en"] [data-p]');
    expect(reqs).toEqual([]); // แคชใหม่ (< 14 วัน)
    // ดึงไม่ได้ (ออฟไลน์/404): ไม่มีแคช → แถวแสดงจำนวนวลี ไม่มี % (ปิดหน้าแรกก่อน — ไม่งั้นมันเห็นแคชหายแล้วดึงใหม่กลับมาเขียนทับ)
    await page.close();
    const p2 = await context.newPage();
    await p2.addInitScript(() => { const f = window.fetch; window.fetch = (u, o) => (/languages\.html/.test(String(u)) ? Promise.reject(new TypeError('offline')) : f(u, o)); });
    const errors = await openHome(p2, { overrides: { 'tanot:home:cache': null } });
    await expect(p2.locator('[data-lang="lang-en"]')).toContainText('ฝึกแล้ว 6 วลี');
    await expect(p2.locator('[data-lang="lang-en"] [data-p]')).toHaveCount(0);
    expect(errors.filter((e) => !/languages\.html|ERR_FAILED/.test(e))).toEqual([]);
  });
});

test.describe('หน้าแรก: ว่าง', () => {
  for (const theme of ['light', 'dark']) {
    test(`ไม่มีข้อมูล (${theme}): "ไม่มีเรื่องค้าง" บรรทัดเดียว + ทุกกล่องชวนเริ่ม 1 บรรทัด + ปุ่มเดียว · กล่องคู่สูงเท่ากัน`, async ({ page }) => {
      const errors = await openHome(page, { data: false, theme });
      await expect(page.locator('#todoBody .todo-none')).toHaveText('ไม่มีเรื่องค้าง');
      await expect(page.locator('#todoCount')).toBeHidden();
      for (const id of ['spendBody', 'investBody', 'learnBody', 'healthBody', 'mealsBody']) {
        const e = page.locator('#' + id + ' .empty.compact');
        await expect(e, id).toHaveCount(1);
        await expect(e.locator('p')).toHaveCount(1);
        await expect(e.locator('a.btn')).toHaveCount(1);
      }
      await expect(page.locator('#qaReviewN')).toHaveText('0');
      const [a, b, c, d] = await Promise.all([box(page, '#boxMoney'), box(page, '#boxInvest'), box(page, '#boxHealth'), box(page, '#boxMeals')]);
      expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1); expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(c.height - d.height)).toBeLessThanOrEqual(1);
      // ข้อความชวนเริ่มจัดกลางแนวตั้งของกล่อง
      const em = await box(page, '#spendBody .empty.compact p');
      expect(Math.abs((em.y + em.height / 2) - (a.y + a.height / 2))).toBeLessThan(a.height * 0.3);
      expect(errors).toEqual([]);
    });
  }

  test('ไม่มีข้อมูล: ไม่มีกล่องของ ประกัน/รถ/ประกันสินค้า/PM/ไฟล์ถาวร — มีเฉพาะลิงก์ในแถว "ไม่อยู่บนหน้าแรก"', async ({ page }) => {
    await openHome(page, { data: false });
    for (const id of ['insBody', 'carBody', 'warBody', 'mntBody', 'filesBody']) await expect(page.locator('#' + id)).toHaveCount(0);
    const links = await page.locator('#moreLinks a').evaluateAll((a) => a.map((x) => x.getAttribute('href')));
    expect(links).toEqual(['insurance.html', 'car.html', 'receipts.html', 'maintenance.html', 'area.html?a=work']);
  });
});

test.describe('หน้าแรก: ของใกล้กำหนดโผล่/ไม่โผล่ตามวัน', () => {
  const only = (kv) => Object.assign({
    'tanot:insurance:policies': null, 'tanot:car:vehicles': null, 'tanot:receipts:items': null, 'tanot:mnt:assets': null,
    'budget:budgets': null, 'lang-practice:srs': null, 'lbe:business:srs': null, 'tanot:health:meds': null,
  }, kv);
  const pol = (off) => [{ id: 'p', type: 'health', insurer: 'X', name: 'Y', premium: 1, freq: 'year', startDate: '2022-01-01', renewDate: ymd(off), files: [] }];

  test('ประกัน ≤ 30 วันโผล่ (30 โผล่ · 31 ไม่โผล่) · เลยกำหนด = err', async ({ page }) => {
    await openHome(page, { overrides: only({ 'tanot:insurance:policies': pol(30) }) });
    await expect(todo(page, 'ins')).toHaveCount(1);
    await expect(todo(page, 'ins').locator('.pill')).toHaveText('อีก 30 วัน');
    const p2 = await page.context().newPage();
    await openHome(p2, { overrides: only({ 'tanot:insurance:policies': pol(31) }) });
    await expect(p2.locator('#todoBody .todo-none')).toBeVisible();
    const p3 = await page.context().newPage();
    await openHome(p3, { overrides: only({ 'tanot:insurance:policies': pol(-3) }) });
    await expect(todo(p3, 'ins')).toHaveAttribute('data-urg', 'err');
    await expect(todo(p3, 'ins').locator('.pill')).toHaveText('เลย 3 วัน');
  });

  test('วันเปลี่ยน → ของที่ไกลเดิมเข้าเขต 30 วันแล้วโผล่ (นาฬิกาเลื่อน 6 วัน)', async ({ page }) => {
    const ov = only({ 'tanot:insurance:policies': pol(36) });
    await openHome(page, { overrides: ov });
    await expect(page.locator('#todoBody .todo-none')).toBeVisible();
    const p2 = await page.context().newPage();
    await openHome(p2, { overrides: ov, at: new Date(NOW_MS + 6 * DAY) });
    await expect(todo(p2, 'ins').locator('.pill')).toHaveText('อีก 30 วัน');
  });

  test('รถ (พ.ร.บ./ภาษี/ตรอ./นัดศูนย์) และประกันสินค้า ≤ 30 วัน', async ({ page }) => {
    const car = (o) => [Object.assign({ id: 'v1', plate: 'กข 1234', province: 'กรุงเทพมหานคร', year: 2022, odometer: 1, actDue: '', taxDue: '', insuranceDue: '', inspectDue: '', files: [] }, o)];
    await openHome(page, { overrides: only({ 'tanot:car:vehicles': car({ actDue: ymd(31), taxDue: ymd(30) }), 'tanot:receipts:items': [{ id: 'a', store: 'S', date: ymd(-335), warrantyMonths: 12, warrantyProduct: 'ตู้เย็น' }] }) });
    await expect(todo(page, 'car')).toHaveCount(1); // ภาษี 30 วันโผล่ · พ.ร.บ. 31 วันไม่โผล่
    await expect(todo(page, 'car')).toContainText('ภาษีรถประจำปี');
    await expect(todo(page, 'war')).toHaveCount(1);  // หมดประกัน ณ ymd(−335) + 12 เดือน = อีก 30 วันพอดี
    const p2 = await page.context().newPage();
    await openHome(p2, { overrides: only({ 'tanot:receipts:items': [{ id: 'a', store: 'S', date: ymd(-334), warrantyMonths: 12, warrantyProduct: 'ตู้เย็น' }] }) });
    await expect(p2.locator('#todoBody .todo-none')).toBeVisible(); // 31 วัน — ยังไม่โผล่
  });

  test('งบ: 89% ไม่เตือน · 90% เตือน · 100% = เกินงบ', async ({ page }) => {
    const mk = (spent) => ({
      'budget:categories': [{ id: 'c', name: 'ของใช้', type: 'expense' }], 'budget:records': [{ id: 'r', date: '2026-09-02', type: 'expense', categoryId: 'c', amount: spent }],
      'budget:budgets': { '2026-09': { c: 1000 } },
    });
    await openHome(page, { overrides: only(mk(890)) });
    await expect(page.locator('#todoBody .todo-none')).toBeVisible();
    const p2 = await page.context().newPage();
    await openHome(p2, { overrides: only(mk(900)) });
    await expect(todo(p2, 'budget').locator('.pill')).toHaveText('ใกล้เต็ม');
    const p3 = await page.context().newPage();
    await openHome(p3, { overrides: only(mk(1000)) });
    await expect(todo(p3, 'budget').locator('.pill')).toHaveText('เกินงบ');
  });

  test('ยา: ถึงเวลาแล้วยังไม่ติ๊กโผล่ · ติ๊กแล้ว/ยังไม่ถึงเวลา ไม่โผล่ (08:00 / 20:00 ที่ 10:30)', async ({ page }) => {
    const med = [{ id: 'm1', name: 'ยา', times: ['08:00', '20:00'], start: ymd(-30), end: '' }];
    await openHome(page, { overrides: only({ 'tanot:health:meds': med }) });
    await expect(todo(page, 'med')).toHaveCount(1);
    await expect(todo(page, 'med')).toContainText('08:00 น.');
    const p2 = await page.context().newPage();
    await openHome(p2, { overrides: only({ 'tanot:health:meds': med, 'tanot:health:intake': [{ id: `m1|${ymd(0)}|08:00`, med: 'm1', date: ymd(0), time: '08:00', at: 1 }] }) });
    await expect(p2.locator('#todoBody .todo-none')).toBeVisible();
  });

  test('PM: มีรายการเดียว = แสดงรายการนั้น · หลายรายการ = สรุปจำนวนต่อสถานะ', async ({ page }) => {
    await openHome(page);
    await expect(todo(page, 'mnt')).toHaveCount(2); // เลยกำหนด RN05-ESC-01 · ถึงกำหนด RN05-ESC-02
    await expect(todo(page, 'mnt').nth(1)).toContainText('ภายใน 30 ก.ย.');
    const p2 = await page.context().newPage();
    const assets = ['a', 'b', 'c'].map((x) => ({ id: x, code: 'RN-' + x, name: 'บันได', type: 'ESC', system: 'E&M', site: 's1', phase: { M3: 1 }, status: 'active' }));
    await openHome(p2, { overrides: { 'tanot:mnt:assets': assets } });
    await expect(todo(p2, 'mnt').first()).toContainText('งานบำรุงรักษาเลยกำหนด 3 รายการ');
    await expect(todo(p2, 'mnt').first()).toContainText('RN-a, RN-b, RN-c');
  });
});

test.describe('หน้าแรก: กล่องคู่สูงเท่ากัน (1100) และจอแคบเรียงคอลัมน์เดียว', () => {
  for (const [name, data] of [['มีข้อมูล', true], ['ว่าง', false]]) {
    test(`${name}: เงินเดือนนี้ = พอร์ตลงทุน · สุขภาพ = เมนูวันนี้ (boundingBox) และส่วนท้ายจบระดับเดียวกัน`, async ({ page }) => {
      await openHome(page, { data });
      const [a, b, c, d] = await Promise.all([box(page, '#boxMoney'), box(page, '#boxInvest'), box(page, '#boxHealth'), box(page, '#boxMeals')]);
      expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1); expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(c.y - d.y)).toBeLessThanOrEqual(1); expect(Math.abs(c.height - d.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
      if (data) { // ส่วนท้ายชิดล่างเท่ากัน: แถบหมวดสุดท้ายของเงิน ↔ รายการติดตามตัวสุดท้ายของลงทุน · แถบเป้าออกกำลังกาย ↔ ปุ่มของที่ต้องซื้อ
        const bottom = async (sel) => { const x = await box(page, sel); return x.y + x.height; };
        expect(Math.abs((await bottom('#spendBody .meter-row:last-child')) - (await bottom('#investBody .list-row:last-child')))).toBeLessThanOrEqual(14);
        expect(Math.abs((await bottom('#healthBody [data-h=workout]')) - (await bottom('#mealsBody [data-m=toBuy]')))).toBeLessThanOrEqual(14);
      }
    });
  }

  test('≤ 900px: เรียงคอลัมน์เดียว (กล่องคู่กว้างเต็ม ซ้อนกัน) · แถบเรียนต่อเป็น 2×2', async ({ page }) => {
    await openHome(page, { width: 860 });
    const [a, b] = await Promise.all([box(page, '#boxMoney'), box(page, '#boxInvest')]);
    expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(1); expect(b.y).toBeGreaterThan(a.y + a.height - 1);
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
    const cells = await page.locator('#learnBody .strip-cell').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)]; }));
    expect(cells[0][1]).toBe(cells[1][1]); expect(cells[2][1]).toBe(cells[3][1]); expect(cells[2][1]).toBeGreaterThan(cells[0][1]);
    // 1100: 4 ช่องเท่ากันแถวเดียว
    const p2 = await page.context().newPage();
    await openHome(p2);
    const w = await p2.locator('#learnBody .strip-cell').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.y)]; }));
    expect(new Set(w.map((x) => x[1])).size).toBe(1);
    expect(Math.max(...w.map((x) => x[0])) - Math.min(...w.map((x) => x[0]))).toBeLessThanOrEqual(1);
    // วิชา 2 คอลัมน์เท่ากัน
    const cols = await p2.locator('#studyList .list-row').evaluateAll((els) => els.slice(0, 2).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.width)]; }));
    expect(cols[0][1]).toBe(cols[1][1]); expect(cols[1][0]).toBeGreaterThan(cols[0][0]);
  });
});

test.describe('หน้าแรก: จัดหน้าแรก (ซ่อน/แสดงกล่อง · สลับลำดับแถว · จำค่าต่อเครื่อง)', () => {
  test('ซ่อนกล่อง → อีกใบในคู่ขยายเต็มความกว้าง + ขึ้นลิงก์ใน "ไม่อยู่บนหน้าแรก" · ย้ายแถว · จำค่าหลังโหลดใหม่ · คืนค่าเริ่มต้น', async ({ page }) => {
    const errors = await openHome(page);
    await page.click('#qaLayout');
    await expect(page.locator('#layoutDialog')).toBeVisible();
    await expect(page.locator('#layoutRows .list-row')).toHaveCount(4);
    await page.locator('#layoutRows input[data-box=invest]').uncheck();
    await expect(page.locator('#boxInvest')).toBeHidden();
    const money = await box(page, '#boxMoney');
    expect(money.width).toBeGreaterThan(900); // เต็มความกว้าง (span 12)
    await expect(page.locator('#moreLinks a[href="invest.html"]')).toHaveText('พอร์ตลงทุน');
    // ย้ายแถว "เรียนต่อ" ขึ้นเหนือ "เงินเดือน/พอร์ต"
    await page.locator('#layoutRows [data-row=learn] [data-move=up]').click();
    await page.locator('#layoutRows [data-row=learn] [data-move=up]').click();
    await page.click('#layoutDone');
    expect((await box(page, '#boxLearn')).y).toBeLessThan((await box(page, '#boxMoney')).y);
    expect((await box(page, '#boxLearn')).y).toBeLessThan((await box(page, '#boxTodo')).y);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:home:layout')));
    expect(saved).toEqual({ v: 1, order: ['learn', 'todo', 'money-invest', 'health-meals'], hidden: ['invest'] });
    await page.reload(); await page.waitForSelector('#todoBody > *');
    await expect(page.locator('#boxInvest')).toBeHidden();
    expect((await box(page, '#boxLearn')).y).toBeLessThan((await box(page, '#boxTodo')).y);
    // ซ่อนทั้งคู่ = แถวหายไป
    await page.click('#qaLayout');
    await page.locator('#layoutRows input[data-box=money]').uncheck();
    await expect(page.locator('#boxMoney')).toBeHidden();
    await page.locator('#layoutReset').click();
    await expect(page.locator('#boxInvest')).toBeVisible(); await expect(page.locator('#boxMoney')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:home:layout')))).toEqual({ v: 1, order: ['todo', 'money-invest', 'learn', 'health-meals'], hidden: [] });
    expect(errors).toEqual([]);
  });

  test('ค่าที่เก็บเสียหาย/แปลก → ใช้ค่าเริ่มต้น ไม่พัง · nav:last = cache · layout = local (ไม่ซิงก์)', async ({ page }) => {
    const errors = await openHome(page, { overrides: { 'tanot:home:layout': { order: 'x', hidden: ['nope'] } } });
    await expect(page.locator('#boxTodo')).toBeVisible();
    const reg = await page.evaluate(() => ({ nav: TanotRegistry.classify('tanot:nav:last'), layout: TanotRegistry.classify('tanot:home:layout'), cache: TanotRegistry.classify('tanot:home:cache') }));
    expect(reg.nav.kind).toBe('cache'); expect(reg.layout.kind).toBe('local'); expect(reg.cache.kind).toBe('cache');
    expect(errors).toEqual([]);
  });
});

test.describe('หน้าแรก: ปุ่มทำทันที', () => {
  test('"กินแล้ว": เขียนแถว intake id ตายตัว (รูปแบบเดียวกับหน้าสุขภาพ) แล้วรายการหายไป · กดซ้ำไม่เกิดแถวซ้ำ', async ({ page }) => {
    const errors = await openHome(page);
    await expect(todo(page, 'med')).toHaveCount(1);
    await todo(page, 'med').locator('[data-act=take]').click();
    await expect(todo(page, 'med')).toHaveCount(0);
    const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:health:intake')));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: `m1|${ymd(0)}|08:00`, med: 'm1', date: ymd(0), time: '08:00' });
    expect(HC.makeIntake({ id: 'm1' }, ymd(0), '08:00', 1).id).toBe(rows[0].id);
    expect(errors).toEqual([]);
  });

  test('"ทำแล้ว": ตั้ง done ในแผนสัปดาห์ + XP 10 ครั้งเดียวต่อมื้อ (ยกเลิกแล้วกดใหม่ไม่ให้ซ้ำ) · ไม่แตะคีย์ xp/streak เดิมของหน้าทำอาหาร', async ({ page }) => {
    const errors = await openHome(page, { overrides: { 'tanot:cooking:xp': 70 } });
    const xp = () => page.evaluate(() => (JSON.parse(localStorage.getItem('tanot:learn:xp')) || []).filter((r) => r.src === 'cooking').reduce((s, r) => s + r.xp, 0));
    const lunch = page.locator('#mealList [data-slot="2:l"]');
    await lunch.locator('[data-act=cook]').click();
    await expect(page.locator('#mealList [data-slot="2:l"] .badge.ok')).toBeVisible();
    expect(await xp()).toBe(10);
    let plan = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:cooking:plans'))[0]);
    expect(plan.done['2:l']).toBeTruthy(); expect(plan.awarded['2:l']).toBeTruthy();
    await page.locator('#mealList [data-slot="2:l"] [data-act=cook]').click(); // ยกเลิก
    await expect(page.locator('#mealList [data-slot="2:l"] .badge.ok')).toHaveCount(0);
    await page.locator('#mealList [data-slot="2:l"] [data-act=cook]').click(); // ทำแล้วอีกครั้ง
    expect(await xp()).toBe(10); // ไม่ซ้ำ
    expect(await page.evaluate(() => localStorage.getItem('tanot:cooking:xp'))).toBe('70');
    expect(errors).toEqual([]);
  });

  test('ปุ่ม "ทบทวน" บนหัว = จำนวนการ์ดถึงรอบทั้งหมด · แถวทบทวนต่อวิชาลิงก์ไป review.html#<วิชา>', async ({ page }) => {
    await openHome(page);
    await expect(page.locator('#qaReviewN')).toHaveText('3');
    await expect(page.locator('#qaReview')).toHaveAttribute('href', 'review.html');
    await expect(todo(page, 'review').nth(1).locator('a')).toHaveAttribute('href', 'review.html#biz');
  });
});

test.describe('review.html#<วิชา> (ปุ่มทบทวนต่อวิชาบนหน้าแรก)', () => {
  test('เริ่มที่กองของวิชานั้น · hash ที่ไม่รู้จัก = ทั้งหมด', async ({ page }) => {
    const t0 = NOW_MS;
    const ov = { 'lang-practice:srs': { 'lang-en::vocab-basic::0': { dueAt: t0 - 1000 } }, 'tanot:learn:faces:lang': { v: 1, langs: { 'lang-en': 'อังกฤษ' }, cards: { 'lang-en::vocab-basic::0': ['apple', 'แอปเปิล'] } },
      'lbe:business:srs': { 'business:management:0': { interval: 3, due: t0 - 5000 } } };
    await openHome(page, { data: false, overrides: ov, path: '/review.html#biz' });
    await page.waitForSelector('#rvFilter [data-f]');
    await expect(page.locator('#rvFilter [data-f="biz"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#rvFilter [data-f="all"]')).toHaveAttribute('aria-pressed', 'false');
    const p2 = await page.context().newPage();
    await openHome(p2, { data: false, overrides: ov, path: '/review.html#nope' });
    await p2.waitForSelector('#rvFilter [data-f]');
    await expect(p2.locator('#rvFilter [data-f="all"]')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('shell.js: จำว่าเปิดหน้าไหนล่าสุด (local)', () => {
  test('เปิดหน้าในเมนู → บันทึกชื่อไฟล์ + เวลา · หน้านอกเมนู/ index / area ไม่บันทึก · เปิดแล้ว "เรียนต่อ" ขึ้นเป็นแถวแรก', async ({ page }) => {
    await prepare(page, {});
    await page.clock.setFixedTime(NOW);
    await page.goto('/music.html'); await page.waitForSelector('nav.ome-nav');
    let nav = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:nav:last')));
    expect(nav).toEqual({ 'music.html': NOW_MS });
    await page.goto('/index.html'); await page.waitForSelector('nav.ome-nav');
    await page.goto('/area.html?a=edu'); await page.waitForSelector('nav.ome-nav');
    await page.goto('/run.html?tool=est-cost'); await page.waitForSelector('nav.ome-nav');
    nav = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:nav:last')));
    expect(Object.keys(nav).sort()).toEqual(['music.html', 'run.html']);
    // หน้าที่มี XP แต่ไม่มีความคืบหน้า: แถวเท่าที่มี (XP + เปิดล่าสุด)
    await page.goto('/index.html'); await page.waitForSelector('#todoBody > *');
    const row = page.locator('#studyList .list-row[data-src=music]');
    await expect(row).toBeVisible();
    await expect(row).toContainText('เปิดล่าสุด');
  });

  test('โหมดฝังป๊อปอัพ (?embed=1) ไม่บันทึก', async ({ page }) => {
    await prepare(page, {});
    await page.goto('/music.html?embed=1'); await page.waitForTimeout(300);
    expect(await page.evaluate(() => localStorage.getItem('tanot:nav:last'))).toBeNull();
  });
});

test.describe('หน้าแรก: ภาษา', () => {
  test('EN: ไม่มีข้อความไทยที่มองเห็น (ยกเว้นข้อมูลผู้ใช้ — ชื่อยา/เมนู/หมวด/ชื่อกรมธรรม์) · สลับ th→en→th สดไม่โหลดหน้าใหม่', async ({ page }) => {
    const ov = { 'tanot:health:meds': [{ id: 'm1', name: 'Vitamin D', dose: '1 tab', times: ['08:00'], start: ymd(-30), end: '' }],
      'budget:categories': [{ id: 'cat-rice', name: 'Rice', type: 'expense' }, { id: 'cat-fuel', name: 'Fuel', type: 'expense' }, { id: 'cat-elec', name: 'Power', type: 'expense' }, { id: 'cat-salary', name: 'Salary', type: 'income' }],
      'tanot:insurance:policies': [{ id: 'p', type: 'health', insurer: 'Muang', name: 'IPD', premium: 1, freq: 'year', startDate: '2022-01-01', renewDate: ymd(10), files: [] }],
      'tanot:car:vehicles': [{ id: 'v1', plate: 'AB 1234', province: 'BKK', make: 'Toyota', model: 'Vios', year: 2022, odometer: 1, actDue: ymd(5), files: [] }],
      'tanot:receipts:items': [{ id: 'w1', store: 'BigC', date: ymd(-355), warrantyMonths: 12, warrantyProduct: 'Fan' }],
      'tanot:mnt:assets': [{ id: 'e1', code: 'RN05-ESC-01', name: 'Escalator', type: 'ESC', system: 'E&M', site: 's1', phase: { M3: 1 }, status: 'active' }],
      'tanot:cooking:recipes': [{ id: 'seed-omelet', name: 'Omelette', servings: 2, ingredients: [], steps: [], seed: true }, { id: 'seed-kaprao', name: 'Basil pork', servings: 2, ingredients: [], steps: [], seed: true }, { id: 'seed-tomyum', name: 'Tom yum', servings: 2, ingredients: [], steps: [], seed: true }] };
    await openHome(page, { overrides: ov, lang: 'en' });
    await page.addScriptTag({ path: AUDIT_JS });
    await page.waitForSelector('[data-lang="lang-en"] [data-p]');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    const hits = await page.evaluate(() => window.__tanotAudit.thaiInEn());
    expect(hits, JSON.stringify(hits.slice(0, 5))).toEqual([]);
    await expect(page.locator('#hTodo')).toHaveText('To do today');
    await expect(page.locator('#greet')).toHaveText('Good morning');
    await expect(todo(page, 'review').first()).toContainText('Review Languages: 2 cards');
    await expect(page.locator('[data-lang="lang-en"]')).toContainText('English');
    await expect(page.locator('[data-lang="lang-en"]')).toContainText('Next:');
    // สลับสดผ่านแผงตั้งค่า
    await page.evaluate(() => { window.__noReload = 1; });
    await page.click('#omeGearBtn');
    await page.locator('.ome-settings-panel .ome-settings-row').filter({ hasText: 'Language' }).click();
    await page.click('.ome-settings-panel [data-lang-id="th"]');
    await expect(page.locator('#hTodo')).toHaveText('ต้องทำวันนี้');
    await expect(todo(page, 'review').first()).toContainText('ทบทวนภาษา 2 ใบ');
    await page.click('.ome-settings-panel [data-lang-id="en"]');
    await expect(page.locator('#hTodo')).toHaveText('To do today');
    await expect(page.locator('#hSpend')).toHaveText("This month's money");
    expect(await page.evaluate(() => window.__noReload)).toBe(1);
  });
});

test.describe('หน้าแรก: มือถือ (ตัวชี้วัด mobile* ต้องเป็น 0 ที่ 390/360 ทั้งสว่าง/มืด ตอนมีข้อมูลและตอนว่าง · รวม shell)', () => {
  for (const width of [390, 360]) {
    for (const theme of ['light', 'dark']) {
      for (const [name, data] of [['มีข้อมูล', true], ['ว่าง', false]]) {
        test(`${width}px ${theme} ${name}`, async ({ page }) => {
          const errors = await openHome(page, { data, width, theme });
          await page.waitForTimeout(600);
          await page.addScriptTag({ path: AUDIT_JS });
          const res = await page.evaluate(() => ({ m: window.__tanotAudit.mobile({ shell: true }), a: window.__tanotAudit.audit({ mobile: true }) }));
          const bad = Object.assign({}, res.m, { targetSize: res.a.targetSize, nonCentral: res.a.nonCentral, contrast: res.a.contrast, controlBorder: res.a.controlBorder });
          for (const k of Object.keys(bad)) expect(bad[k], k + ' ' + JSON.stringify(bad[k].slice(0, 3))).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
          expect(errors).toEqual([]);
        });
      }
    }
  }
});

/* ═══ หน้าหมวด (area.html) ═══ */
const NAV_WORK = { 'word.html': NOW_MS - 3600e3, 'legal.html': NOW_MS - 7200e3, 'text-to-speech.html': NOW_MS - 100, 'cad.html': NOW_MS - DAY, 'excel.html': NOW_MS - 2 * DAY, 'budget.html': NOW_MS - 10 };
async function openArea(page, a, { nav, width = 1100, theme = 'light', lang } = {}) {
  const errors = await prepare(page, { theme });
  if (lang) await page.addInitScript((l) => localStorage.setItem('ome:lang', l), lang);
  if (nav) await page.addInitScript((n) => localStorage.setItem('tanot:nav:last', JSON.stringify(n)), nav);
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/area.html?a=' + a, { waitUntil: 'load' });
  await page.waitForSelector('#areaGroups .tile');
  return errors;
}
const titles = (page, sel) => page.locator(sel).evaluateAll((els) => els.map((e) => e.textContent.trim()));

test.describe('หน้าหมวด: ใช้ล่าสุด + กลุ่มเป็นกล่องคอลัมน์ + ไทล์แบบแถว', () => {
  test('ย้าย "แปลงเสียง ↔ ข้อความ" เข้ากลุ่มเอกสาร (ท้ายกลุ่ม) · หมวดงานไม่มีรายการลอย · ลำดับกลุ่ม/ไทล์ตาม MENU', async ({ page }) => {
    const errors = await openArea(page, 'work');
    expect(await titles(page, '#areaGroups > .tile-group > h2')).toEqual(['เอกสาร', 'วิศวกรรม', 'ข้อมูล/รายงาน', 'กฎหมาย']);
    await expect(page.locator('#areaGroups > .tile-group')).toHaveCount(4); // ทุกกล่องมีชื่อกลุ่ม ไม่มีกล่องลอย
    const docs = page.locator('#areaGroups > .tile-group').first();
    expect(await docs.locator('.tile-title').evaluateAll((e) => e.map((x) => x.textContent))).toEqual(['งาน Word', 'งาน Excel', 'งาน PowerPoint', 'ดึงข้อความออกจากเอกสาร', 'ตรวจสอบเอกสาร', 'เปรียบเทียบข้อมูล', 'แปลงเสียง ↔ ข้อความ']);
    await expect(docs.locator('a[href$="text-to-speech.html"]')).toHaveCount(1);
    // PM (บันทึกงานบำรุงรักษา) อยู่กลุ่มวิศวกรรมเหมือนเดิม
    await expect(page.locator('#areaGroups > .tile-group').nth(1).locator('a[href$="maintenance.html"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('ไทล์แถวสูง ≥ 48px + ไอคอน 32px ซ้าย · ไม่มีคำอธิบาย (MENU ไม่มี desc) · รองรับ desc เมื่อมี', async ({ page }) => {
    await openArea(page, 'life');
    const hs = await page.locator('.tile.row').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(hs.length).toBeGreaterThan(5);
    for (const h of hs) expect(h).toBeGreaterThanOrEqual(47.5);
    const ic = await page.locator('.tile-ic').first().boundingBox();
    expect([Math.round(ic.width), Math.round(ic.height)]).toEqual([32, 32]);
    await expect(page.locator('.tile-desc')).toHaveCount(0);
    // เติม desc ให้โหนดหนึ่งใน MENU แล้ววาดใหม่ → ขึ้นบรรทัดเดียวใต้ชื่อ
    await page.evaluate(() => { window.OME_MENU.forEach((n) => (n.children || []).forEach((c) => { if (c.key === 'health') c.desc = 'น้ำหนัก ความดัน ยา'; })); window.OME_LANG.set('th'); window.dispatchEvent(new Event('ome:langchange')); });
    await expect(page.locator('.tile-desc')).toHaveCount(1);
  });

  test('คอลัมน์: จอกว้าง 3 · กลาง 2 · มือถือ 1 (ไม่ทิ้งที่ว่าง — กล่องเรียงต่อกันในแต่ละคอลัมน์)', async ({ page }) => {
    const xs = async (w) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(100);
      const x = await page.locator('#areaGroups > .tile-group').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
      return new Set(x).size;
    };
    await openArea(page, 'work');
    expect(await xs(1100)).toBe(3);
    expect(await xs(800)).toBe(2);
    expect(await xs(390)).toBe(1);
  });

  test('รายการ soon จางพร้อมป้าย "เร็วๆ นี้" ไว้ท้ายกลุ่ม · กลุ่ม "จำลอง 3D": จำลองคน (soon) ท้ายสุด', async ({ page }) => {
    await openArea(page, 'hobby');
    const soon = page.locator('.tile.soon');
    expect(await soon.count()).toBeGreaterThanOrEqual(2);
    for (const el of await soon.all()) {
      await expect(el.locator('.badge')).toHaveText('เร็วๆ นี้');
      expect(await el.locator('.tile-ic').evaluate((e) => parseFloat(getComputedStyle(e).opacity))).toBeLessThan(1); // จางที่ไอคอน + สีชื่อรอง (ตัวอักษรยังผ่าน 4.5:1)
    }
    for (const g of await page.locator('#areaGroups > .tile-group').all()) {
      const flags = await g.locator('.tile').evaluateAll((els) => els.map((e) => e.classList.contains('soon')));
      expect(flags).toEqual([...flags].sort((a, b) => a - b)); // false ทั้งหมดก่อน true
    }
    const last = await page.locator('#areaGroups > .tile-group').last().locator('.tile-title').evaluateAll((e) => e.map((x) => x.textContent));
    expect(last).toEqual(['จำลองสิ่งของ', 'จำลองคน']);
  });

  test('ใช้ล่าสุด: 4 ไทล์ เฉพาะหน้าในหมวดนั้น เรียงเปิดล่าสุดก่อน · หลายรายการในเมนูหน้าเดียว = ชื่อกลุ่มแม่ · ไม่มีข้อมูล = ไม่มีแถว', async ({ page }) => {
    const errors = await openArea(page, 'work', { nav: NAV_WORK });
    await expect(page.locator('#hLatest')).toHaveText('ใช้ล่าสุด');
    const tiles = page.locator('#latestRow .tile');
    await expect(tiles).toHaveCount(4);
    expect(await titles(page, '#latestRow .tile-title')).toEqual(['แปลงเสียง ↔ ข้อความ', 'งาน Word', 'กฎหมาย', 'งานเขียนแบบ CAD (2D/3D)']); // excel (5) ตัด · budget ไม่อยู่ในหมวดนี้
    await expect(tiles.nth(2)).toHaveAttribute('href', /legal\.html$/); // ไม่มี hash ของร่างเอกสารใดเอกสารหนึ่ง
    await expect(tiles.first().locator('.tile-desc')).toContainText('เปิดล่าสุด');
    await expect(tiles.nth(1).locator('.tile-desc')).toContainText('ชั่วโมง');
    expect(errors).toEqual([]);
    // ลำดับในกลุ่มคงที่ ไม่สลับตามการใช้งาน
    const withNav = await titles(page, '#areaGroups .tile-title');
    const p2 = await page.context().newPage();
    await prepare(p2, {}); await p2.goto('/area.html?a=work'); await p2.waitForSelector('#areaGroups .tile');
    await p2.evaluate(() => localStorage.removeItem('tanot:nav:last'));
    await p2.reload(); await p2.waitForSelector('#areaGroups .tile');
    await expect(p2.locator('#latestRow')).toHaveCount(0);
    await expect(p2.locator('#hLatest')).toHaveCount(0);
    expect(await titles(p2, '#areaGroups .tile-title')).toEqual(withNav);
  });

  test('ใช้ล่าสุด: หน้าย่อยของการลงทุน (invest-stock.html) ขึ้นเป็นไทล์ในหมวดชีวิตประจำวัน · น้อยกว่า 4 = แสดงเท่าที่มี', async ({ page }) => {
    await openArea(page, 'life', { nav: { 'invest-stock.html': NOW_MS - 5000, 'health.html': NOW_MS - 90000, 'word.html': NOW_MS - 1 } });
    expect(await titles(page, '#latestRow .tile-title')).toEqual(['หุ้น', 'สุขภาพ']);
    await expect(page.locator('#latestRow .tile').first()).toHaveAttribute('href', /invest-stock\.html#th$/);
  });

  test('EN: ป้ายเมนูเป็นอังกฤษ ไม่มีไทยหลุด · สลับ th→en→th สดไม่โหลดหน้าใหม่ (รวม "ใช้ล่าสุด")', async ({ page }) => {
    await openArea(page, 'work', { nav: NAV_WORK, lang: 'en' });
    await page.addScriptTag({ path: AUDIT_JS });
    expect(await page.evaluate(() => window.__tanotAudit.thaiInEn())).toEqual([]);
    await expect(page.locator('#hLatest')).toHaveText('Recently used');
    await expect(page.locator('#areaTitle')).toHaveText('Work');
    expect(await titles(page, '#areaGroups > .tile-group > h2')).toEqual(['Documents', 'Engineering', 'Data & reports', 'Law']);
    await expect(page.locator('#latestRow .tile').nth(2).locator('.tile-title')).toHaveText('Law');
    await page.evaluate(() => { window.__noReload = 1; });
    await page.click('#omeGearBtn');
    await page.locator('.ome-settings-panel .ome-settings-row').filter({ hasText: 'Language' }).click();
    await page.click('.ome-settings-panel [data-lang-id="th"]');
    await expect(page.locator('#hLatest')).toHaveText('ใช้ล่าสุด');
    await expect(page.locator('#areaTitle')).toHaveText('งาน');
    await page.click('.ome-settings-panel [data-lang-id="en"]');
    await expect(page.locator('#hLatest')).toHaveText('Recently used');
    expect(await page.evaluate(() => window.__noReload)).toBe(1);
  });

  for (const a of ['work', 'life', 'edu', 'hobby', 'settings']) {
    for (const width of [390, 360]) {
      for (const theme of ['light', 'dark']) {
        test(`มือถือ ${a} ${width}px ${theme}: ตัวชี้วัด mobile* = 0 (มีและไม่มี "ใช้ล่าสุด")`, async ({ page }) => {
          const nav = { 'word.html': NOW_MS - 1, 'legal.html': NOW_MS - 2, 'budget.html': NOW_MS - 3, 'health.html': NOW_MS - 4, 'books.html': NOW_MS - 5, 'languages.html': NOW_MS - 6, 'music.html': NOW_MS - 7, 'sports.html': NOW_MS - 8, 'data.html': NOW_MS - 9, 'notifications.html': NOW_MS - 10 };
          for (const withNav of [true, false]) {
            const errors = await openArea(page, a, { width, theme, nav: withNav ? nav : undefined });
            await page.addScriptTag({ path: AUDIT_JS });
            const res = await page.evaluate(() => ({ m: window.__tanotAudit.mobile({}), a: window.__tanotAudit.audit({ mobile: true }) }));
            const bad = Object.assign({}, res.m, { targetSize: res.a.targetSize, nonCentral: res.a.nonCentral, contrast: res.a.contrast, controlBorder: res.a.controlBorder });
            for (const k of Object.keys(bad)) expect(bad[k], `${withNav ? 'มี' : 'ไม่มี'}ใช้ล่าสุด ${k} ${JSON.stringify(bad[k].slice(0, 3))}`).toEqual([]);
            expect(errors).toEqual([]);
          }
        });
      }
    }
  }
});
