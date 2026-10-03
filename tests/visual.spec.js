// @ts-check
// ภาพ baseline 390/1100px × สว่าง/มืด ไว้เทียบตอนย้ายธีม (Phase 0c)
// อัปเดต baseline ตั้งใจ: npm run test:update (ใน tests/) แล้ว commit ภาพใน __screenshots__/
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');

// หน้าตัวแทนของแต่ละประเภท layout (tool / app / reader / dashboard / hub) — หน้าที่พึ่งเน็ต/เวลาจริงไม่เลือก
const PAGES = [
  'index.html',
  'invest.html',
  'invest-gold.html',
  'invest-bitcoin.html',
  'invest-commodities.html',
  'invest-thai-fund.html',
  'invest-global-fund.html',
  'invest-gov-bond.html',
  'invest-gsb-lottery.html',
  'invest-baac-lottery.html',
  'invest-lottery.html',
  'invest-news.html',
  'invest-portfolio.html',
  'invest-business.html',
  'invest-set50-scanner.html',
  'invest-trade-journal.html',
  'electrical.html',
  'tax.html',
  'insurance.html',
  'health.html',
  'receipts.html',
  'car.html',
  'maintenance.html',
  'compare.html',
  'slides.html',
  'budget.html',
  'word.html',
  'excel.html',
  'cad.html',
  'sim-objects.html',
  'classroom-law.html',
  'classroom-business.html',
  'classroom-engineering.html',
  'languages.html',
  'legal.html',
  'review.html',
  'music.html',
  'sports.html',
  'cooking.html',
  'coding.html',
  'typing.html',
  'books.html',
  'doc-check.html',
  'doc-check-file.html',
  'extract-text.html',
  'text-to-speech.html',
  'report-dashboard.html',
  'soon.html?label=demo',
  'credits.html',
  'notifications.html',
  'area.html?a=work',
  'area.html?a=edu',
];
const WIDTHS = [390, 1100];
const THEMES = ['light', 'dark'];

for (const p of PAGES) {
  for (const w of WIDTHS) {
    for (const theme of THEMES) {
      const area = /^area\.html\?a=(?!work$)(\w+)/.exec(p); // area.html?a=work ใช้ชื่อเดิม (baseline เดิม) — หมวดอื่นต่อท้ายชื่อหมวด
      const name = `${p.split('?')[0].replace('.html', '')}${area ? '-' + area[1] : ''}-${w}-${theme}.png`;
      test(`visual: ${name}`, async ({ page }) => {
        await prepare(page, { theme });
        // หน้าแรกแสดงวันที่/นาฬิกา — ตรึงเวลาไว้ ไม่งั้น baseline เปลี่ยนทุกวัน
        await page.clock.setFixedTime(new Date('2026-09-30T10:30:00+07:00'));
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
