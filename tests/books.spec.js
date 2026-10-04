// @ts-check
// หนังสือ (books.html / books-calc.js) — ROADMAP Phase 6 การศึกษา P3
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');

const K = require(path.join(__dirname, '..', 'books-calc.js'));
const LCORE = require(path.join(__dirname, '..', 'learn-core.js'));
const SRV = 'http://localhost:8137';
const NOW = new Date('2026-09-30T10:30:00+07:00'); // พุธ — สัปดาห์เริ่มจันทร์ 2026-09-28
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
// ทั้งไฟล์ใช้เซิร์ฟเวอร์เดียวที่มี /__reset — ห้ามให้ describe ต่างกลุ่มรันขนานกัน
test.describe.configure({ mode: 'serial' });

const OL = { numFound: 2, docs: [
  { key: '/works/OL45883W', title: 'Atomic Habits', author_name: ['James Clear', 'ผู้ร่วมเขียน', 'สาม'], cover_i: 12345, number_of_pages_median: 320, first_publish_year: 2018 },
  { key: '/works/OL1W', title: 'ไม่มีปก', number_of_pages_median: 0 },
  { title: '' },
] };

describe_calc();
function describe_calc() {
  test.describe('books-calc.js (known-answer)', () => {
    test('parseSearch / searchUrl / coverUrl: ตัดผู้แต่ง 2 คนแรก, ข้ามผลที่ไม่มีชื่อ, ปกว่าง = ไม่มีลิงก์', () => {
      const r = K.parseSearch(OL);
      expect(r.map((b) => b.title)).toEqual(['Atomic Habits', 'ไม่มีปก']);
      expect(r[0]).toMatchObject({ author: 'James Clear, ผู้ร่วมเขียน', coverId: 12345, pages: 320, olKey: '/works/OL45883W', status: 'want' });
      expect(r[1]).toMatchObject({ coverId: 0, pages: 0, author: '' });
      expect(K.parseSearch(null)).toEqual([]);
      expect(K.coverUrl(12345, 'M')).toBe('https://covers.openlibrary.org/b/id/12345-M.jpg');
      expect(K.coverUrl(0)).toBe('');
      const u = new URL(K.searchUrl('atomic habits'));
      expect([u.origin, u.pathname, u.searchParams.get('q'), u.searchParams.get('limit')]).toEqual(['https://openlibrary.org', '/search.json', 'atomic habits', '8']);
    });

    test('weekStart จันทร์ · weekly รวมหน้า/นาทีต่อสัปดาห์ 8 สัปดาห์ (เก่า → ใหม่) ไม่นับนอกช่วง', () => {
      expect(K.weekStart('2026-09-30')).toBe('2026-09-28');
      expect(K.weekStart('2026-09-28')).toBe('2026-09-28');
      expect(K.weekStart('2026-10-04')).toBe('2026-09-28'); // อาทิตย์
      const logs = [
        { date: '2026-09-28', pages: 10, minutes: 15 }, { date: '2026-09-30', pages: 5, minutes: 20 },
        { date: '2026-09-27', pages: 7, minutes: 0 }, { date: '2026-08-01', pages: 99, minutes: 99 }, { date: 'x', pages: 50 },
      ];
      const w = K.weekly(logs, new Date('2026-09-30T12:00:00'), 8);
      expect(w).toHaveLength(8);
      expect(w[0].start).toBe('2026-08-10');
      expect(w[7]).toEqual({ start: '2026-09-28', pages: 15, minutes: 35 });
      expect(w[6]).toEqual({ start: '2026-09-21', pages: 7, minutes: 0 });
      expect(w.reduce((s, x) => s + x.pages, 0)).toBe(22);
    });

    test('applyLog: ไม่ใส่ "ถึงหน้า" = บวก · ใส่ = ตามนั้น · ไม่เกินจำนวนหน้า · อยากอ่าน → กำลังอ่าน + วันเริ่ม · finish', () => {
      const b = { id: 'b', title: 't', pages: 300, status: 'want' };
      const a = K.applyLog(b, { date: '2026-09-30', pages: 20 });
      expect(a).toMatchObject({ current: 20, status: 'reading', startedAt: '2026-09-30' });
      expect(K.applyLog(a, { date: '2026-10-01', pages: 30 }).current).toBe(50);
      expect(K.applyLog(a, { date: '2026-10-01', pages: 5, to: 120 }).current).toBe(120);
      expect(K.applyLog(a, { date: '2026-10-01', pages: 999 }).current).toBe(300);
      expect(K.applyLog(a, { date: '2026-10-01', pages: 1 }).startedAt).toBe('2026-09-30'); // ไม่ทับวันเริ่มเดิม
      expect(K.finish(a, '2026-10-05')).toMatchObject({ status: 'done', finishedAt: '2026-10-05', current: 300 });
      expect(K.progress(a)).toEqual({ pct: 7, left: 280 });
    });

    test('yearSummary: นับเฉพาะอ่านจบปีนี้ · เป้าเริ่มต้น 12 · ตั้งเป้าเอง', () => {
      const bs = [{ status: 'done', finishedAt: '2026-01-05' }, { status: 'done', finishedAt: '2026-09-01' }, { status: 'done', finishedAt: '2025-12-31' }, { status: 'reading' }];
      expect(K.yearSummary(bs, {}, new Date('2026-09-30T12:00:00'))).toEqual({ year: 2026, done: 2, goal: 12, pct: 17 });
      expect(K.yearSummary(bs, { yearGoal: 4 }, new Date('2026-09-30T12:00:00'))).toMatchObject({ goal: 4, pct: 50 });
      expect(K.yearSummary(bs, { yearGoal: 1 }, new Date('2026-09-30T12:00:00')).pct).toBe(100);
    });

    test('makeCard: id ตายตัวจากไฮไลต์ · หน้าการ์ดใช้คำถามถ้ามี · สร้างซ้ำไม่ล้างตารางทบทวน', () => {
      const book = { id: 'b', title: 'Atomic Habits' };
      const note = { id: 'n1', bookId: 'b', page: 42, text: 'ระบบชนะเป้าหมาย' };
      const c = K.makeCard(note, book, 1000);
      expect(c).toMatchObject({ id: 'card-n1', noteId: 'n1', bookId: 'b', front: 'Atomic Habits · หน้า 42', back: 'ระบบชนะเป้าหมาย', dueAt: 1000, createdAt: 1000 });
      expect(c.stability).toBeUndefined();
      const reviewed = Object.assign({}, c, { stability: 3, dueAt: 9e12, reps: 1 });
      const again = K.makeCard(Object.assign({}, note, { q: 'อะไรชนะเป้าหมาย?' }), book, 2000, reviewed);
      expect(again).toMatchObject({ front: 'อะไรชนะเป้าหมาย?', stability: 3, dueAt: 9e12, reps: 1, createdAt: 1000 });
    });

    test('learn-core: เพิ่มแหล่ง books ต่อท้าย (area edu) · แถว legacy เก่าที่ไม่มีคีย์ books = 0 และยอดเดิมไม่เปลี่ยน', () => {
      expect(LCORE.SRC_ORDER[LCORE.SRC_ORDER.length - 1]).toBe('books');
      expect(LCORE.SRC_ORDER.slice(0, 9)).toEqual(['law', 'lang', 'biz', 'eng', 'music', 'sports', 'cooking', 'coding', 'typing']);
      expect(LCORE.SOURCES.books).toMatchObject({ area: 'edu', href: 'books.html' });
      const old = { id: 'legacy|d1', xp: { law: 0, lang: 500, biz: 300, eng: 0, music: 120, sports: 40, cooking: 0, coding: 60, typing: 0 }, streak: {} };
      const t = LCORE.legacyTotals([old]);
      expect(t.xp.books).toBe(0);
      const s = LCORE.compute([], [old], {}, new Date('2026-09-30T12:00:00'));
      expect(s.legacy).toBe(1020);
      expect(s.total).toBe(1020);
      expect(s.bySrc.books).toBe(0);
      const later = LCORE.compute([{ id: 'x', d: '2026-09-30', src: 'books', area: 'edu', xp: 25 }], [old], {}, new Date('2026-09-30T12:00:00'));
      expect(later).toMatchObject({ legacy: 1020, total: 1045 });
      expect(later.byArea.edu).toBe(500 + 300 + 25);
    });
  });
}

async function openPage(page, p, o = {}) {
  const { sync = false, data, ol = 'ok', theme = 'light', width = 1100 } = o;
  const errors = await prepare(page, { theme });
  const log = { search: [], cover: [] };
  await page.route('https://openlibrary.org/**', async (route) => {
    log.search.push({ url: route.request().url(), headers: route.request().headers() });
    if (ol === 'down') return route.abort('failed');
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ol === 'empty' ? { numFound: 0, docs: [] } : OL) });
  });
  await page.route('https://covers.openlibrary.org/**', (route) => { log.cover.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
  await page.addInitScript(({ sync, data }) => {
    if (sync) window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
    if (data && !localStorage.getItem('__seeded')) { for (const k of Object.keys(data)) localStorage.setItem(k, JSON.stringify(data[k])); localStorage.setItem('__seeded', '1'); }
  }, { sync, data });
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(p, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return { errors, log };
}
const store = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);
const xp = (page) => page.evaluate(() => { const s = window.LearnCore.summary(); return { books: s.bySrc.books, total: s.total, legacy: s.legacy }; });
async function confirmDelete(page, text) {
  const box = page.locator('dialog:has(.dialog-msg)');
  await expect(box.locator('.dialog-msg')).toContainText(text);
  await box.locator('.btn.danger').click();
  await expect(box).toHaveCount(0);
}
const shelfBtn = (page, label) => page.locator('#shelfSeg button', { hasText: label });

test.describe('หน้า books.html', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('ค้น Open Library → เลือก → เติมฟอร์ม + ปก · ส่งเฉพาะคำค้น (ไม่มีคุกกี้/referrer) · เริ่มอ่าน → บันทึกการอ่าน → อ่านจบ + XP + ยอดเดิมไม่เปลี่ยน', async ({ page }) => {
    const legacySeed = { 'tanot:music:xp': '120', 'lang-practice:xp': '500' };
    const { errors, log } = await openPage(page, '/books.html', { data: {} });
    await page.evaluate((s) => { for (const k of Object.keys(s)) localStorage.setItem(k, s[k]); }, legacySeed);
    await page.reload(); await page.waitForSelector('nav.ome-nav');
    const before = await xp(page);
    expect(before.legacy).toBe(620);

    await page.click('#addBtn');
    await page.fill('#sQ', 'atomic habits');
    await page.click('#sGo');
    await expect(page.locator('.bk-hit')).toHaveCount(2);
    expect(log.search).toHaveLength(1);
    const u = new URL(log.search[0].url);
    expect([...u.searchParams.keys()].sort()).toEqual(['fields', 'limit', 'q']);
    expect(u.searchParams.get('q')).toBe('atomic habits');
    expect(log.search[0].headers.cookie).toBeUndefined();
    expect(log.search[0].headers.referer).toBeUndefined();
    await expect.poll(() => log.cover.length).toBeGreaterThan(0);
    await page.locator('.bk-hit').first().click();
    await expect(page.locator('#bTitle')).toHaveValue('Atomic Habits');
    await expect(page.locator('#bAuthor')).toHaveValue('James Clear, ผู้ร่วมเขียน');
    await expect(page.locator('#bPages')).toHaveValue('320');
    await page.selectOption('#bStatus', 'want');
    await page.click('#bSave');

    let items = await store(page, 'tanot:books:items');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: 'Atomic Habits', coverId: 12345, olKey: '/works/OL45883W', pages: 320, status: 'want', current: 0 });
    await shelfBtn(page, 'อยากอ่าน').click();
    const row = page.locator('[data-bid]');
    await expect(row).toContainText('Atomic Habits');
    await expect(row.locator('img')).toHaveAttribute('src', 'https://covers.openlibrary.org/b/id/12345-M.jpg');

    await row.locator('[data-act="start"]').click();
    await expect(shelfBtn(page, 'กำลังอ่าน')).toHaveAttribute('aria-pressed', 'true');
    items = await store(page, 'tanot:books:items');
    expect(items[0]).toMatchObject({ status: 'reading', startedAt: '2026-09-30' });

    await row.locator('[data-act="log"]').click();
    await page.fill('#lPages', '40'); await page.fill('#lMin', '55');
    await page.click('#ldlg button[type=submit]');
    await expect(row).toContainText('40 / 320 หน้า');
    expect((await store(page, 'tanot:books:logs'))[0]).toMatchObject({ date: '2026-09-30', pages: 40, minutes: 55 });
    expect((await xp(page)).books).toBe(5);

    // ใส่ "ถึงหน้า" อย่างเดียว → จำนวนหน้า = ผลต่าง
    await row.locator('[data-act="log"]').click();
    await page.fill('#lTo', '100');
    await page.click('#ldlg button[type=submit]');
    await expect(row).toContainText('100 / 320 หน้า');
    expect((await store(page, 'tanot:books:logs')).map((l) => l.pages)).toEqual([40, 60]);

    // อ่านจบ → ชั้นอ่านจบ, XP +20 ครั้งเดียว (บันทึกซ้ำจากฟอร์มไม่ให้ซ้ำ)
    await row.locator('[data-act="finish"]').click();
    await page.selectOption('#bRating', '4'); await page.fill('#bReview', 'อ่านง่าย ได้ใช้จริง');
    await page.click('#bSave');
    await expect(shelfBtn(page, 'อ่านจบ')).toHaveAttribute('aria-pressed', 'true');
    await expect(row).toContainText('อ่านจบ'.length ? 'อ่านง่าย ได้ใช้จริง' : '');
    items = await store(page, 'tanot:books:items');
    expect(items[0]).toMatchObject({ status: 'done', finishedAt: '2026-09-30', current: 320, rating: 4, xpDone: true });
    expect((await xp(page)).books).toBe(5 + 5 + 20);
    await row.locator('[data-act="edit"]').click();
    await page.fill('#bReview', 'แก้รีวิว'); await page.click('#bSave');
    expect((await xp(page)).books).toBe(30);

    const after = await xp(page);
    expect(after.legacy).toBe(620); // ยอดเดิมไม่ขยับ
    expect(after.total).toBe(650);
    // ไม่แตะคีย์เดิมของหน้าอื่น
    expect(await page.evaluate(() => [localStorage.getItem('tanot:music:xp'), localStorage.getItem('lang-practice:xp')])).toEqual(['120', '500']);

    // สถิติ: หน้าสัปดาห์นี้ 100, 55 นาที, อ่านจบปีนี้ 1/12
    await page.click('[data-tab="stats"]');
    await expect(page.locator('#kWeekPages')).toContainText('100');
    await expect(page.locator('#kWeekMin')).toContainText('55');
    await expect(page.locator('#kYear')).toContainText('1 / 12');
    await page.selectOption('#goalSel', '6');
    await expect(page.locator('#kYear')).toContainText('1 / 6');
    expect(await store(page, 'tanot:books:settings')).toEqual({ yearGoal: 6 });
    expect(errors).toEqual([]);
  });

  test('ออฟไลน์/ค้นไม่เจอ → กรอกเอง (ไม่ต้องมีปก) · บันทึกการอ่านไม่ต้องรู้จำนวนหน้า', async ({ page }) => {
    const { errors } = await openPage(page, '/books.html', { ol: 'down' });
    await page.click('#addBtn');
    await page.fill('#sQ', 'หนังสือเล่มหนึ่ง'); await page.click('#sGo');
    await expect(page.locator('#sMsg')).toContainText('กรอกเอง');
    await page.fill('#bTitle', 'หนังสือเล่มหนึ่ง'); await page.fill('#bAuthor', 'ผู้แต่ง ก');
    await page.selectOption('#bStatus', 'reading');
    await page.click('#bSave');
    const row = page.locator('[data-bid]');
    await expect(row).toContainText('หนังสือเล่มหนึ่ง');
    await expect(row.locator('img')).toHaveCount(0);
    await row.locator('[data-act="log"]').click();
    await page.fill('#lPages', '12'); await page.click('#ldlg button[type=submit]');
    await expect(row).toContainText('อ่านถึงหน้า 12');

    await page.click('#addBtn'); await page.fill('#sQ', 'x');
    await page.unroute('https://openlibrary.org/**');
    await page.route('https://openlibrary.org/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"numFound":0,"docs":[]}' }));
    await page.click('#sGo');
    await expect(page.locator('#sMsg')).toContainText('ไม่พบ');
    await page.click('#bCancel');
    expect(await store(page, 'tanot:books:items')).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('ไฮไลต์ → "ทำเป็นการ์ดทบทวน" → การ์ดในกองรวมของ review.html → ให้คะแนน เขียนกลับ + XP · การ์ดซ้ำไม่เกิด · แก้ไฮไลต์ไม่ล้างตารางทบทวน', async ({ page }) => {
    const book = { id: 'b1', title: 'Atomic Habits', author: 'James Clear', pages: 320, current: 10, status: 'reading', createdAt: 1 };
    const { errors } = await openPage(page, '/books.html', { data: { 'tanot:books:items': [book] } });
    await page.click('[data-tab="notes"]');
    await page.click('#addNote');
    await page.selectOption('#nBookSel', 'b1');
    await page.fill('#nPage', '42'); await page.fill('#nText', 'ระบบชนะเป้าหมายเสมอ');
    await page.click('#ndlg button[type=submit]');
    const note = page.locator('[data-nid]');
    await expect(note).toContainText('ระบบชนะเป้าหมายเสมอ');
    await expect(note).toContainText('Atomic Habits · หน้า 42');
    expect(await store(page, 'tanot:books:cards')).toBeNull();

    await note.locator('[data-act="mkcard"]').click();
    await expect(note).toContainText('เป็นการ์ดแล้ว');
    await expect(note.locator('[data-act="mkcard"]')).toHaveCount(0);
    let cards = await store(page, 'tanot:books:cards');
    expect(cards).toHaveLength(1);
    const nid = (await store(page, 'tanot:books:notes'))[0].id;
    expect(cards[0]).toMatchObject({ id: 'card-' + nid, bookId: 'b1', front: 'Atomic Habits · หน้า 42', back: 'ระบบชนะเป้าหมายเสมอ' });

    // หน้าทบทวนวันนี้
    await page.goto('/review.html'); await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('#rvFilter')).toContainText('หนังสือ 1');
    await expect(page.locator('#rvCard')).toContainText('Atomic Habits · หน้า 42');
    await expect(page.locator('#rvCard .src')).toContainText('หนังสือ');
    await expect(page.locator('#rvDue')).toContainText('1');
    await page.click('#rvCard');
    await expect(page.locator('#rvCard .a')).toContainText('ระบบชนะเป้าหมายเสมอ');
    await page.click('[data-r="3"]');
    await expect(page.locator('#rvArea')).toContainText('ทบทวนครบแล้ว 1 ใบ');
    cards = await store(page, 'tanot:books:cards');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ reps: 1, lapses: 0, stability: 3, srsIdx: 1, lastReview: NOW.getTime() });
    expect(cards[0].dueAt).toBe(NOW.getTime() + 3 * 86400000);
    expect(cards[0].back).toBe('ระบบชนะเป้าหมายเสมอ');
    expect(await page.evaluate(() => window.LearnCore.summary().bySrc.books)).toBe(5);
    expect(await page.evaluate(() => window.LearnCore.summary().todayBySrc.books)).toBe(5);

    // แก้ไฮไลต์ (ใส่คำถาม) → หน้าการ์ดเปลี่ยน ตารางทบทวนเดิมอยู่ครบ
    await page.goto('/books.html'); await page.waitForSelector('nav.ome-nav');
    await page.click('[data-tab="notes"]');
    await page.locator('[data-nid] [data-act="edit-note"]').click();
    await page.fill('#nQ', 'อะไรชนะเป้าหมาย?'); await page.click('#ndlg button[type=submit]');
    cards = await store(page, 'tanot:books:cards');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ front: 'อะไรชนะเป้าหมาย?', reps: 1, stability: 3 });

    // ลบไฮไลต์ → การ์ดหายด้วย
    await page.locator('[data-nid] [data-act="del-note"]').click();
    await confirmDelete(page, 'ลบไฮไลต์นี้');
    expect(await store(page, 'tanot:books:cards')).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('การ์ดหนังสือที่ยังไม่ถึงรอบไม่ขึ้นใน review.html · หน้าวันนี้นับรวมการ์ดหนังสือ', async ({ page }) => {
    const book = { id: 'b1', title: 'เล่มหนึ่ง', status: 'reading' };
    const due = { id: 'card-n1', noteId: 'n1', bookId: 'b1', front: 'ถึงรอบ', back: 'ตอบ', dueAt: NOW.getTime() - 1000 };
    const later = { id: 'card-n2', noteId: 'n2', bookId: 'b1', front: 'ยังไม่ถึง', back: 'ตอบ', stability: 3, dueAt: NOW.getTime() + 86400000 };
    const { errors } = await openPage(page, '/review.html', { data: { 'tanot:books:items': [book], 'tanot:books:cards': [due, later] } });
    await expect(page.locator('#rvCard')).toContainText('ถึงรอบ');
    await expect(page.locator('#rvProgress, .rv-progress')).toContainText('เหลือ 1');
    await page.goto('/index.html'); await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('#todoBody .todo-row[data-kind="review"]')).toContainText('ทบทวนหนังสือ 1 ใบ');
    expect(errors).toEqual([]);
  });

  test('ลบหนังสือ → บันทึกการอ่าน/ไฮไลต์/การ์ดของเล่มนั้นหายด้วย เล่มอื่นไม่ถูกแตะ · เมนู "หนังสือ" ลิงก์มาหน้านี้', async ({ page }) => {
    const bs = [{ id: 'b1', title: 'เล่ม A', status: 'reading', createdAt: 2 }, { id: 'b2', title: 'เล่ม B', status: 'reading', createdAt: 1 }];
    const logs = [{ id: 'l1', bookId: 'b1', date: '2026-09-30', pages: 5 }, { id: 'l2', bookId: 'b2', date: '2026-09-30', pages: 7 }];
    const notes = [{ id: 'n1', bookId: 'b1', page: 1, text: 'a' }, { id: 'n2', bookId: 'b2', page: 1, text: 'b' }];
    const cards = [{ id: 'card-n1', noteId: 'n1', bookId: 'b1', front: 'f', back: 'a', dueAt: 1 }, { id: 'card-n2', noteId: 'n2', bookId: 'b2', front: 'f', back: 'b', dueAt: 1 }];
    const { errors } = await openPage(page, '/books.html', { data: { 'tanot:books:items': bs, 'tanot:books:logs': logs, 'tanot:books:notes': notes, 'tanot:books:cards': cards } });
    await page.locator('[data-bid="b1"] [data-act="edit"]').click();
    await page.click('#bDel');
    await confirmDelete(page, 'ลบหนังสือเล่มนี้');
    expect((await store(page, 'tanot:books:items')).map((b) => b.id)).toEqual(['b2']);
    expect((await store(page, 'tanot:books:logs')).map((b) => b.id)).toEqual(['l2']);
    expect((await store(page, 'tanot:books:notes')).map((b) => b.id)).toEqual(['n2']);
    expect((await store(page, 'tanot:books:cards')).map((b) => b.id)).toEqual(['card-n2']);
    const o = await openPage(page, '/area.html?a=edu');
    await expect(page.locator('a.tile', { hasText: 'หนังสือ' })).toHaveAttribute('href', /books\.html$/);
    expect(errors.concat(o.errors)).toEqual([]);
  });
});

test.describe('ซิงก์ 2 เครื่อง', () => {
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });
  test('เล่ม/บันทึกการอ่าน/ไฮไลต์รวมกันได้ · กด "ทำเป็นการ์ด" ทั้ง 2 เครื่อง = การ์ดแถวเดียว · ลบหนังสือข้ามเครื่อง', async ({ browser }) => {
    const mk = async () => {
      const ctx = await browser.newContext({ baseURL: SRV });
      const page = await ctx.newPage();
      const o = await openPage(page, '/books.html', { sync: true });
      return { ctx, page, errors: o.errors };
    };
    const A = await mk(), B = await mk();
    const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));
    const both = async () => { for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); } };

    await A.page.click('#addBtn'); await A.page.fill('#bTitle', 'เล่มจากเครื่อง A'); await A.page.selectOption('#bStatus', 'reading'); await A.page.fill('#bPages', '200');
    await A.page.click('#bSave');
    await B.page.click('#addBtn'); await B.page.fill('#bTitle', 'เล่มจากเครื่อง B'); await B.page.selectOption('#bStatus', 'reading');
    await B.page.click('#bSave');
    await both();
    for (const d of [A, B]) {
      expect((await store(d.page, 'tanot:books:items')).map((b) => b.title).sort()).toEqual(['เล่มจากเครื่อง A', 'เล่มจากเครื่อง B']);
      await expect(d.page.locator('[data-bid]')).toHaveCount(2); // วาดใหม่เองโดยไม่ต้องโหลดซ้ำ
    }

    // เครื่อง B บันทึกการอ่านเล่มของเครื่อง A และเขียนไฮไลต์ — เดินนาฬิกา B ก่อน ไม่งั้น updated_at เท่ากับตอน A สร้างเล่ม แล้วผลขึ้นกับชื่อ device ที่สุ่ม
    await B.page.clock.setFixedTime(new Date(NOW.getTime() + 60000));
    await B.page.locator('[data-bid]', { hasText: 'เล่มจากเครื่อง A' }).locator('[data-act="log"]').click();
    await B.page.fill('#lPages', '15'); await B.page.click('#ldlg button[type=submit]');
    await B.page.click('[data-tab="notes"]'); await B.page.click('#addNote');
    await B.page.selectOption('#nBookSel', { label: 'เล่มจากเครื่อง A' }); await B.page.fill('#nText', 'ข้อความไฮไลต์'); await B.page.fill('#nPage', '9');
    await B.page.click('#ndlg button[type=submit]');
    await both();
    expect((await store(A.page, 'tanot:books:logs'))).toHaveLength(1);
    const a = (await store(A.page, 'tanot:books:items')).find((b) => b.title === 'เล่มจากเครื่อง A');
    expect(a.current).toBe(15);
    await A.page.click('[data-tab="notes"]');
    await expect(A.page.locator('[data-nid]')).toContainText('ข้อความไฮไลต์');

    // ทั้งสองเครื่องกดทำเป็นการ์ดพร้อมกัน (ก่อนซิงก์) → แถวเดียว
    await B.page.locator('[data-nid] [data-act="mkcard"]').click();
    await A.page.locator('[data-nid] [data-act="mkcard"]').click();
    await both();
    for (const d of [A, B]) {
      const cards = await store(d.page, 'tanot:books:cards');
      expect(cards).toHaveLength(1);
      expect(cards[0].front).toBe('เล่มจากเครื่อง A · หน้า 9');
    }

    // ลบหนังสือที่เครื่อง A (นาฬิกาขยับไปหลังสุด) → เครื่อง B เห็นเล่ม/ไฮไลต์/การ์ดหาย
    await A.page.clock.setFixedTime(new Date(NOW.getTime() + 120000));
    await A.page.click('[data-tab="shelf"]');
    await A.page.locator('[data-bid]', { hasText: 'เล่มจากเครื่อง A' }).locator('[data-act="edit"]').click();
    await A.page.click('#bDel');
    await confirmDelete(A.page, 'ลบหนังสือเล่มนี้');
    await both();
    expect((await store(B.page, 'tanot:books:items')).map((b) => b.title)).toEqual(['เล่มจากเครื่อง B']);
    for (const k of ['logs', 'notes', 'cards']) expect(await store(B.page, 'tanot:books:' + k)).toEqual([]);
    for (const d of [A, B]) expect(d.errors).toEqual([]);
    await A.ctx.close(); await B.ctx.close();
  });
});
