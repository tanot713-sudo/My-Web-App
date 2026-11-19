// known-answer ของ law-figure-calc.js (ช่องรูปประกอบบทเรียนกฎหมาย)
const { test, expect } = require('@playwright/test');
const F = require('../law-figure-calc.js');

test('split: แยกบรรทัด @image ออกจากข้อความ markdown', () => {
  const md = '## หัวข้อ\nข้อความ\n@image void-chart | ผังโมฆะ/โมฆียะ\n- ข้อ 1\n@image flow';
  expect(F.split(md)).toEqual([
    { type: 'md', text: '## หัวข้อ\nข้อความ' },
    { type: 'img', key: 'void-chart', caption: 'ผังโมฆะ/โมฆียะ' },
    { type: 'md', text: '- ข้อ 1' },
    { type: 'img', key: 'flow', caption: '' }
  ]);
});
test('split: key ผิดรูปแบบ/ไม่มี key = เป็นข้อความธรรมดา, ไม่มี @image = ก้อนเดียว', () => {
  expect(F.split('a\n@image\nb')).toEqual([{ type: 'md', text: 'a\n@image\nb' }]);
  expect(F.split('@image Bad Key!')).toEqual([{ type: 'md', text: '@image Bad Key!' }]);
  expect(F.split('')).toEqual([]);
});
test('strip: ตัดบรรทัด @image ออก (TTS/ค้นหา/ไฮไลต์)', () => {
  expect(F.strip('a\n@image k | x\nb')).toBe('a\nb');
});
test('keys: รายการ key ตามลำดับ ไม่ซ้ำ', () => {
  expect(F.keys('@image a\n@image b | x\n@image a')).toEqual(['a', 'b']);
});
test('mapKey/clean: คีย์ต่อวิชา + ล้างข้อมูลที่ซิงก์มา', () => {
  expect(F.mapKey('nitikam', 'void-chart')).toBe('nitikam|void-chart');
  expect(F.clean({ id: 'abc123', name: 'x.png', mime: 'image/png', evil: 1 })).toEqual({ id: 'abc123', name: 'x.png', mime: 'image/png' });
  expect(F.clean({ id: '../x', mime: 'image/png' })).toBe(null);
  expect(F.clean({ id: 'abc', mime: 'text/html' })).toBe(null);
  expect(F.clean(null)).toBe(null);
});
test('fileUrl', () => { expect(F.fileUrl('a b')).toBe('/api/files?id=a%20b'); });

// ── หน้า classroom-law: ช่องรูปประกอบ (ไม่มีรูป = ไม่แสดง, เลือกรูป → ผูก → แสดง, เอาออก)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
async function open(page, withFiles) {
  await page.route('**/api/files**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.addInitScript((w) => {
    if (w) window.TANOT_FILES = { enabled: true };
    localStorage.setItem('ome:lang', 'th');
    localStorage.setItem('tanot:images:items', JSON.stringify([
      { id: 'img1', name: 'a.png', mime: 'image/png', createdAt: 2, prompt: 'x' },
      { id: 'img2', name: 'b.png', mime: 'image/png', createdAt: 1, prompt: 'y' }]));
  }, withFiles);
  await page.goto('/classroom-law.html#course-nitikam');
  await page.waitForSelector('details.lesson');
}
test('หน้า: ไม่มีสิทธิ์อัปโหลด + ยังไม่ผูก = ไม่มีช่อง/ปุ่ม/ข้อความรูปเลย', async ({ page }) => {
  await open(page, false);
  await page.locator('details.lesson').nth(4).evaluate((d) => { d.open = true; });
  expect(await page.locator('.lfig, .lfig-slot, [data-figpick]').count()).toBe(0);
  expect(await page.locator('#clLessonBody').innerText()).not.toContain('@image');
});
test('หน้า: เลือกรูป → แสดงในบทเรียน + เก็บเฉพาะ ref + เอารูปออกได้', async ({ page }) => {
  await open(page, true);
  await page.locator('details.lesson').nth(4).evaluate((d) => { d.open = true; });
  const btn = page.locator('[data-figpick="void-vs-voidable"]');
  await expect(btn).toBeVisible();
  await btn.click();
  await page.locator('.lfig-th').first().click();
  await expect(page.locator('figure.lfig img')).toHaveCount(1);
  await expect(page.locator('figure.lfig img')).toHaveAttribute('src', '/api/files?id=img1');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:law:figures')));
  expect(stored).toEqual({ 'nitikam|void-vs-voidable': { id: 'img1', name: 'a.png', mime: 'image/png' } });
  await page.locator('[data-figdel]').click();
  await expect(page.locator('figure.lfig')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:law:figures')))).toEqual({});
});
test('หน้า: ผูกรูปแล้วแต่ไม่มีสิทธิ์อัปโหลด = เห็นรูป ไม่มีปุ่มแก้', async ({ page }) => {
  await open(page, false);
  await page.evaluate(() => localStorage.setItem('tanot:law:figures', JSON.stringify({ 'nitikam|void-vs-voidable': { id: 'img2', mime: 'image/png' } })));
  await page.reload(); await page.waitForSelector('details.lesson');
  await page.locator('details.lesson').nth(4).evaluate((d) => { d.open = true; });
  await expect(page.locator('figure.lfig img')).toHaveAttribute('src', '/api/files?id=img2');
  expect(await page.locator('[data-figpick],[data-figdel]').count()).toBe(0);
});
test('หน้า: วิชาที่ลบเนื้อหาแล้ว (ป.พ.พ.) ยังเปิดได้ มีข้อความไม่มีเนื้อหา + เครื่องมือโน้ตยังอยู่', async ({ page }) => {
  await open(page, false);
  await page.goto('/classroom-law.html#subject-civil');
  await expect(page.locator('#clLessonBody')).toContainText('ยังไม่มีเนื้อหาสรุป');
  await expect(page.locator('#bpNoteSubj')).toHaveValue('ป.พ.พ.');
});
