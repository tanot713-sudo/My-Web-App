// @ts-check
// งานแก้ธีม + ภาษา รอบ 2 — (1) ความเข้มภาพพื้นหลัง 4 ระดับ (theme-boot.js + แผงตั้งค่า) (2) 6 หน้าที่ใช้บ่อย
// (index, budget, health, car, receipts, insurance) แปลอังกฤษครบทั้งตอนมีข้อมูลและตอนเปิดกล่อง + สลับภาษาสดไม่โหลดหน้าใหม่
// ข้อมูลตัวอย่างใช้ตัวอักษรละตินล้วน (ข้อมูลผู้ใช้ไม่ต้องแปล) ยกเว้นหมวด budget ตั้งต้นที่เก็บชื่อไทยไว้ใน storage — ต้องแสดงเป็นอังกฤษ
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');

const NOW = '2026-09-30T10:30:00+07:00';
const DEFAULT_CATS = [
  { id: 'cat-salary', name: 'เงินเดือน', type: 'income', color: '#17B26A' },
  { id: 'cat-water', name: 'ค่าน้ำ', type: 'expense', color: '#3B6BFF' },
  { id: 'cat-shopping', name: 'Shopping', type: 'expense', color: '#22C55E' },
];
const SEED = {
  'budget:categories': DEFAULT_CATS,
  'budget:records': [
    { id: 'a', date: '2026-09-10', type: 'expense', categoryId: 'cat-water', amount: 120, note: 'bill' },
    { id: 'b', date: '2026-09-12', type: 'income', categoryId: 'cat-salary', amount: 5000, note: '' },
    { id: 'c', date: '2026-08-10', type: 'expense', categoryId: 'cat-water', amount: 50, note: '' },
  ],
  'budget:budgets': { '2026-09': { 'cat-water': 300 } },
  'tanot:insurance:policies': [
    { id: 'p1', type: 'health', insurer: 'AIA', name: 'Plan A', premium: 12000, freq: 'year', renewDate: '2026-10-20', taxCat: 'health', files: [] },
    { id: 'p2', type: 'car', insurer: 'Viriya', insured: 'ABC 123', premium: 15000, freq: 'half', renewDate: '2026-12-01', taxCat: 'none', files: [] },
  ],
  'tanot:car:vehicles': [{ id: 'c1', type: 'car', plate: 'ABC 123', province: 'BKK', make: 'Toyota', model: 'Vios', year: 2018, odometer: 80000, odometerAt: '2026-09-01', actDue: '2026-10-05', taxDue: '2026-11-15', inspectDue: '', insuranceDue: '2026-12-01', files: [] }],
  'tanot:car:services': [{ id: 's1', vehicleId: 'c1', date: '2026-08-01', odometer: 78000, items: 'Oil change', cost: 1500, nextKm: 88000, nextDate: '2026-10-20' }],
  'tanot:receipts:items': [{ id: 'r1', store: 'Power Buy', date: '2026-09-01', total: 9900, items: [{ name: 'TV', amount: 9900 }], warrantyProduct: 'TV', warrantyMonths: 12, taxTag: 'eReceipt', files: [], createdAt: 1 }],
  'tanot:health:vitals': [{ id: 'v1', at: Date.parse('2026-09-29T09:00:00+07:00'), weight: 70, sys: 150, dia: 95, hr: 72 }],
  'tanot:health:meds': [{ id: 'm1', name: 'Vitamin C', dose: '1 tab', times: ['08:00', '20:00'], start: '2026-09-01' }],
  'tanot:health:checkups': [{ id: 'k1', date: '2026-08-01', place: 'Clinic', results: [{ name: 'LDL', value: 150, unit: 'mg/dL', lo: null, hi: 130 }], files: [] }],
  'tanot:health:workouts': [{ id: 'sports:1', at: Date.parse('2026-09-29T07:00:00+07:00'), date: '2026-09-29', kind: 'วิ่ง', minutes: 30, source: 'sports' }],
};

async function open(page, p, { lang, theme = 'light', width = 1100, seed = SEED, bg } = {}) {
  const errors = await prepare(page, { theme });
  await page.addInitScript(([s, l, b]) => {
    try {
      for (const k in s) localStorage.setItem(k, JSON.stringify(s[k]));
      if (l) localStorage.setItem('ome:lang', l);
      if (b) localStorage.setItem('ome:bg', b);
    } catch (e) {}
  }, [seed, lang || '', bg || '']);
  await page.setViewportSize({ width, height: 900 });
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto('/' + p, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  await page.waitForTimeout(500);
  return errors;
}

/** ข้อความไทยที่มองเห็นทั้งหน้า (ทุก text node + placeholder/title/aria-label + option) ยกเว้นส่วนกลาง — ฿ ไม่นับ */
async function thaiVisible(page) {
  return page.evaluate(() => {
    const TH = /[ก-฾เ-๛]/, out = [];
    const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.visibility !== 'hidden' && cs.display !== 'none' && (r.width > 0 || r.height > 0); };
    const skip = (el) => el.closest('[data-i18n-skip],.ome-nav,.ome-drawer,.ome-settings-panel,.ome-footer,.ome-ai-fab,.ome-ai-panel,script,style,noscript');
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (!TH.test(t.nodeValue)) continue;
      const el = t.parentElement;
      if (!el || skip(el)) continue;
      if (el.tagName === 'OPTION') { const s = el.closest('select'); if (!s || !vis(s)) continue; } else if (!vis(el)) continue;
      out.push('text: ' + t.nodeValue.trim().slice(0, 50));
    }
    document.querySelectorAll('[placeholder],[title],[aria-label]').forEach((el) => {
      if (skip(el) || !vis(el)) return;
      ['placeholder', 'title', 'aria-label'].forEach((a) => { const v = el.getAttribute(a); if (v && TH.test(v)) out.push(a + ': ' + v.slice(0, 50)); });
    });
    return [...new Set(out)];
  });
}

test.describe('ความเข้มภาพพื้นหลัง', () => {
  test('ค่าเริ่มต้น = กลาง · ค่าเดิม on → กลาง (แปลงในที่เก็บ) · off = ไม่มีภาพ', async ({ page }) => {
    await open(page, 'health.html', { seed: {} });
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-bg'))).toBe('health');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-bg-level'))).toBe('mid');
    expect(await page.evaluate(() => window.OmeTheme.get('bg'))).toBe('mid');

    const p2 = await page.context().newPage();
    await prepare(p2, {});
    await p2.addInitScript(() => { localStorage.setItem('ome:bg', 'on'); });
    await p2.goto('/health.html');
    expect(await p2.evaluate(() => document.documentElement.getAttribute('data-bg-level'))).toBe('mid');
    expect(await p2.evaluate(() => localStorage.getItem('ome:bg'))).toBe('mid');

    const p3 = await page.context().newPage();
    await prepare(p3, {});
    await p3.addInitScript(() => { localStorage.setItem('ome:bg', 'off'); });
    await p3.goto('/health.html');
    expect(await p3.evaluate(() => document.documentElement.hasAttribute('data-bg'))).toBe(false);
    expect(await p3.evaluate(() => document.documentElement.hasAttribute('data-bg-level'))).toBe(false);
  });

  test('แผงตั้งค่า: เลือกระดับแล้วเปลี่ยนทันที + จำค่า + ป้ายเป็นอังกฤษเมื่อสลับภาษา · scrim ลดลงตามระดับ', async ({ page }) => {
    await open(page, 'health.html', { seed: {} });
    await page.click('#omeGearBtn');
    await page.locator('.ome-settings-panel .ome-settings-row').filter({ hasText: 'ความเข้มภาพพื้นหลัง' }).click();
    const alpha = async () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ome-bg-scrim-m')) || 0);
    const labels = await page.locator('.ome-settings-panel [data-bg-id]').allInnerTexts();
    expect(labels).toEqual(['ปิด', 'อ่อน', 'กลาง (ปกติ)', 'ชัด']);
    await page.click('.ome-settings-panel [data-bg-id="soft"]');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-bg-level'))).toBe('soft');
    const soft = await alpha();
    await page.click('.ome-settings-panel [data-bg-id="strong"]');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-bg-level'))).toBe('strong');
    const strong = await alpha();
    expect(strong).toBeLessThan(soft); // ชัดขึ้น = scrim บางลง
    expect(await page.evaluate(() => localStorage.getItem('ome:bg'))).toBe('strong');
    await page.click('.ome-settings-panel [data-bg-id="off"]');
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-bg'))).toBe(false);
    await page.click('.ome-settings-panel [data-bg-id="mid"]');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-bg'))).toBe('health');
    await page.evaluate(() => window.OME_LANG.set('en'));
    expect(await page.locator('.ome-settings-panel [data-bg-id]').allInnerTexts()).toEqual(['Off', 'Light', 'Medium (default)', 'Vivid']);
    await expect(page.locator('.ome-settings-panel .ome-settings-row').filter({ hasText: 'Background image intensity' })).toHaveCount(1);
  });

  test('จอแคบ ≤ 700px: แถบภาพหัวหน้าสูง 300px · จอกว้างหน้า dashboard 280px', async ({ page }) => {
    await open(page, 'health.html', { seed: {}, width: 390 });
    const h = await page.evaluate(() => getComputedStyle(document.documentElement, '::before').height);
    expect(h).toBe('300px');
    const p2 = await page.context().newPage();
    await open(p2, 'health.html', { seed: {}, width: 1100 });
    expect(await p2.evaluate(() => getComputedStyle(document.documentElement, '::before').height)).toBe('280px');
  });
});

const PAGES = [
  { p: 'index.html', title: 'วันนี้', h1: '#greet' },
  { p: 'budget.html', title: 'รายรับรายจ่าย', h1: 'h1' },
  { p: 'health.html', title: 'สุขภาพ', h1: 'h1' },
  { p: 'car.html', title: 'บันทึกรถ', h1: 'h1' },
  { p: 'receipts.html', title: 'คลังใบเสร็จ', h1: 'h1' },
  { p: 'insurance.html', title: 'ประกัน', h1: 'h1' },
];

test.describe('6 หน้าที่ใช้บ่อย: แปลอังกฤษครบ', () => {
  for (const { p } of PAGES) {
    test(`${p}: โหมด EN ไม่มีข้อความไทย (ข้อมูล + กล่องที่เปิดอยู่) และไม่มี error`, async ({ page }) => {
      const errors = await open(page, p, { lang: 'en' });
      expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
      expect(await thaiVisible(page), 'เริ่มต้น').toEqual([]);
      const step = async (label, fn) => { await fn(); await page.waitForTimeout(200); expect(await thaiVisible(page), label).toEqual([]); };
      if (p === 'budget.html') {
        for (const v of ['calendar', 'record', 'categories', 'budget', 'settings']) {
          await step(v, async () => {
            await page.evaluate((h) => { location.hash = h; }, v);
            if (v === 'calendar') await page.locator('.mp-cal-cell:not(.empty)').nth(9).click();
            if (v === 'record') { await page.click('#toggleAddForm'); await page.click('#toggleFilter'); }
          });
        }
        // ลบรายการ → กล่องยืนยันกลางเป็นอังกฤษ
        await page.evaluate(() => { location.hash = 'record'; });
        await page.locator('#historyBody .del').first().click();
        await expect(page.locator('dialog[open] .dialog-msg')).toHaveText('Delete this entry?');
        await page.locator('dialog[open] .btn').first().click();
      }
      if (p === 'health.html') {
        await step('vitals error', async () => { await page.fill('#vSys', '400'); await page.click('#vSave'); });
        await expect(page.locator('#vMsg')).toContainText('Systolic pressure');
        await step('med dialog', async () => { await page.click('#medAdd'); });
        await page.click('#mCancel');
        await step('check-up dialog', async () => { await page.click('#chkAdd'); await page.selectOption('#labPreset', '0'); });
        await page.click('#cCancel');
        await step('settings dialog', async () => { await page.click('#setBtn'); });
        await page.click('#sCancel');
        await step('trend select', async () => { await page.selectOption('#trendSel', { index: 1 }); });
      }
      if (p === 'car.html') {
        await step('vehicle dialog', async () => { await page.click('#addBtn'); });
        await page.click('#vCancel');
        await step('service dialog', async () => { await page.click('[data-act="add-svc"]'); });
        await page.click('#sSave');
        await expect(page.locator('#sMsg')).toHaveText('Enter work done or a cost');
        await page.click('#sCancel');
      }
      if (p === 'receipts.html') {
        await step('receipt dialog', async () => { await page.click('#addBtn'); });
        await page.click('#saveBtn');
        await expect(page.locator('#msg')).toHaveText('Enter a store name or a total');
        await page.click('#cancelBtn');
        await step('edit dialog', async () => { await page.click('[data-act="edit"]'); });
        await page.click('#cancelBtn');
        await step('warranty filter', async () => { await page.click('#fWar'); });
      }
      if (p === 'insurance.html') {
        await step('policy dialog', async () => { await page.click('#addBtn'); });
        await page.click('#saveBtn');
        await expect(page.locator('#msg')).toHaveText('Enter an insurer or a plan name');
        await page.click('#cancelBtn');
        await step('type filter', async () => { await page.click('#typeFilter [data-type="car"]'); });
      }
      expect(errors).toEqual([]);
    });
  }

  for (const { p, title, h1 } of PAGES) {
    test(`${p}: สลับ th → en → th จากแผงตั้งค่า หน้าเปลี่ยนทันทีโดยไม่โหลดใหม่`, async ({ page }) => {
      const errors = await open(page, p, { lang: 'th' });
      await page.evaluate(() => { window.__noReload = 1; });
      const thTitle = (await page.locator(h1).first().innerText()).trim();
      expect(thTitle).toContain(p === 'index.html' ? 'สวัสดี' : title);
      await page.click('#omeGearBtn');
      await page.locator('.ome-settings-panel .ome-settings-row').filter({ hasText: 'ภาษา' }).click();
      await page.click('.ome-settings-panel [data-lang-id="en"]');
      await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('en');
      expect(await page.evaluate(() => window.__noReload), 'ไม่โหลดหน้าใหม่').toBe(1);
      await page.waitForTimeout(400);
      expect(await thaiVisible(page), 'หลังสลับเป็น EN').toEqual([]);
      const enTitle = (await page.locator(h1).first().innerText()).trim();
      expect(enTitle).not.toBe(thTitle);
      await page.click('.ome-settings-panel [data-lang-id="th"]');
      await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('th');
      await page.waitForTimeout(300);
      expect((await page.locator(h1).first().innerText()).trim()).toBe(thTitle);
      expect(errors).toEqual([]);
    });
  }

  test('หมวด budget ตั้งต้นแสดงเป็นอังกฤษตามภาษา แต่ข้อมูลใน storage ยังเป็นชื่อไทยเดิม · หมวดที่ผู้ใช้ตั้ง/แก้เองไม่ถูกแปล', async ({ page }) => {
    const cats = DEFAULT_CATS.concat([{ id: 'cat-custom', name: 'Coffee', type: 'expense', color: '#999999' }, { id: 'cat-rice', name: 'ข้าวมันไก่', type: 'expense', color: '#F5A524' }]);
    await open(page, 'budget.html', { lang: 'en', seed: Object.assign({}, SEED, { 'budget:categories': cats }) });
    await page.evaluate(() => { location.hash = 'categories'; });
    await page.click('#catTabs [data-type="expense"]');
    const list = await page.locator('#catList').innerText();
    expect(list).toContain('Water bill');
    expect(list).toContain('Coffee');
    expect(list).toContain('ข้าวมันไก่'); // id ตั้งต้นแต่ผู้ใช้แก้ชื่อเอง → คงชื่อเดิม
    expect(list).not.toContain('ค่าน้ำ');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('budget:categories')).map((c) => c.name));
    expect(stored).toContain('ค่าน้ำ');
  });

  test('budget.html: บันทึก/ลบรายการ + หมวด ยังทำงาน (กล่องยืนยัน/toast กลาง) ทั้งสองภาษา', async ({ page }) => {
    const errors = await open(page, 'budget.html', { lang: 'th' });
    await page.evaluate(() => { location.hash = 'record'; });
    await page.click('#toggleAddForm');
    await page.fill('.f-amt', '250');
    await page.fill('.f-note', 'ข้าวมันไก่');
    await page.click('#saveAllEntries');
    await expect(page.locator('#historyBody tr')).toHaveCount(4);
    await page.locator('#historyBody .del').first().click();
    await expect(page.locator('dialog[open] .dialog-msg')).toHaveText('ลบรายการนี้ใช่หรือไม่?');
    await page.locator('dialog[open] .btn.danger').click();
    await expect(page.locator('#historyBody tr')).toHaveCount(3);
    await page.evaluate(() => { location.hash = 'budget'; });
    await page.click('#copyPrevMonth');
    await expect(page.locator('.toast.err')).toContainText('ไม่มีงบประมาณของเดือนก่อนหน้าให้คัดลอก');
    await page.evaluate(() => window.OME_LANG.set('en'));
    await page.click('#copyPrevMonth');
    await expect(page.locator('.toast.err')).toContainText('There is no budget from last month to copy');
    expect(errors).toEqual([]);
  });
});
