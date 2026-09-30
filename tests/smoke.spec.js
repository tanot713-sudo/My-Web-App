// @ts-check
// ทุกหน้าในเมนู: โหลดได้ด้วย storage จำลอง + ปิดเน็ต, ไม่มี console error, nav แสดงผล, จอ 390px ไม่ล้นแนวนอน
const { test, expect } = require('@playwright/test');
const { menuPages, prepare } = require('./helpers');

const pages = menuPages();

test('เมนูมีหน้าให้ทดสอบ', () => {
  expect(pages.length).toBeGreaterThan(30);
});

for (const p of pages) {
  test(`smoke: ${p}`, async ({ page }) => {
    const errors = await prepare(page);
    await page.setViewportSize({ width: 390, height: 800 });
    const res = await page.goto('/' + p, { waitUntil: 'load' });
    expect(res && res.status(), 'HTTP status').toBeLessThan(400);
    await page.waitForSelector('nav.ome-nav', { timeout: 10000 });
    await page.waitForTimeout(500);

    await expect(page.locator('nav.ome-nav')).toBeVisible();
    await expect(page.locator('.ome-hamburger')).toBeVisible();

    // ไม่ล้นแนวนอน (ยอม 1px ปัดเศษ)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow at 390px').toBeLessThanOrEqual(1);

    expect(errors, 'console/page errors').toEqual([]);
  });
}
