// @ts-check
// ภาพ baseline 390/1100px × สว่าง/มืด ไว้เทียบตอนย้ายธีม (Phase 0c)
// อัปเดต baseline ตั้งใจ: npm run test:update (ใน tests/) แล้ว commit ภาพใน __screenshots__/
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');

// หน้าตัวแทนของแต่ละประเภท layout (tool / app / reader / dashboard / hub) — หน้าที่พึ่งเน็ต/เวลาจริงไม่เลือก
const PAGES = [
  'index.html',
  'invest.html',
  'budget.html',
  'word.html',
  'excel.html',
  'classroom-law.html',
  'cooking.html',
  'typing.html',
  'doc-check.html',
  'report-dashboard.html',
  'soon.html?label=demo',
];
const WIDTHS = [390, 1100];
const THEMES = ['light', 'dark'];

for (const p of PAGES) {
  for (const w of WIDTHS) {
    for (const theme of THEMES) {
      const name = `${p.split('?')[0].replace('.html', '')}-${w}-${theme}.png`;
      test(`visual: ${name}`, async ({ page }) => {
        await prepare(page, { theme });
        await page.setViewportSize({ width: w, height: 800 });
        await page.goto('/' + p, { waitUntil: 'load' });
        await page.waitForSelector('nav.ome-nav');
        await page.evaluate(() => document.fonts && document.fonts.ready);
        await page.waitForTimeout(800);
        await expect(page).toHaveScreenshot(name, {
          fullPage: false, // เฉพาะ viewport แรก — หน้าสั้น/ยาวไม่เท่ากัน ไม่ให้ baseline ผันผวนตามเนื้อหาท้ายหน้า
          caret: 'hide',
        });
      });
    }
  }
}
