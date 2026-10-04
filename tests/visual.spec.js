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
  'invest-fund.html',
  'invest-gov-bond.html',
  'invest-lottery.html',
  'invest-news.html',
  'invest-business.html',
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
  'image-gen.html',
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

/* หน้าแรก (มีข้อมูลครบทุกแหล่ง) และหน้าหมวดที่มี "ใช้ล่าสุด" — ทั้งหน้า (fullPage) เพราะโครงสร้างอยู่ทั้งความยาวหน้า
   ข้อมูลจาก tests/home-fixtures.js (นาฬิกาตรึง พุธ 30 ก.ย. 2569 10:30) */
const { seedFull, NOW, NOW_MS } = require('./home-fixtures');
for (const w of WIDTHS) {
  for (const theme of THEMES) {
    test(`visual: index-data-${w}-${theme}.png`, async ({ page }) => {
      await prepare(page, { theme });
      await page.addInitScript(seedFull);
      await page.clock.setFixedTime(NOW);
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto('/index.html', { waitUntil: 'load' });
      await page.waitForSelector('nav.ome-nav');
      await page.waitForSelector('#studyList [data-p]'); // ยอดรวมบทจากหน้าวิชา (ดึงครั้งแรก)
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.waitForTimeout(800);
      await expect(page).toHaveScreenshot(`index-data-${w}-${theme}.png`, { fullPage: true, caret: 'hide' });
    });
    test(`visual: area-work-latest-${w}-${theme}.png`, async ({ page }) => {
      await prepare(page, { theme });
      await page.addInitScript((n) => localStorage.setItem('tanot:nav:last', JSON.stringify(n)), { 'word.html': NOW_MS - 3600e3, 'legal.html': NOW_MS - 7200e3, 'text-to-speech.html': NOW_MS - 60e3, 'cad.html': NOW_MS - 86400e3 });
      await page.clock.setFixedTime(NOW);
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto('/area.html?a=work', { waitUntil: 'load' });
      await page.waitForSelector('#latestRow .tile');
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`area-work-latest-${w}-${theme}.png`, { fullPage: true, caret: 'hide' });
    });
  }
}
