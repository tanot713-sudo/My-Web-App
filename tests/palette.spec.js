// @ts-check
// ค้นหาด่วน (palette.js + palette-calc.js): known-answer ของ calc + ค้นหนังสือ/โน้ตเรียน + คำสั่ง "ตั้งการแจ้งเตือน"
//   (ส่ง "ชุดเต็ม" ของ scope custom ไป /api/push/reminders ทุกครั้ง) + ลบที่ notifications.html
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');
const C = require(path.join(__dirname, '..', 'palette-calc.js'));

const NOW = Date.UTC(2026, 10, 19, 5, 0);
const HOUR = 3600000;

test.describe('palette-calc', () => {
  test('dataItems: หนังสือ + โน้ต, ข้ามแถวไม่มี id/ชื่อ, ลิงก์ถูกหน้า', () => {
    const r = C.dataItems({
      books: [{ id: 'b1', title: ' สงคราม  และสันติภาพ ', author: 'Tolstoy' }, { id: 'b2', title: '' }, { title: 'x' }],
      notes: [{ id: 'lec-1', title: 'เศรษฐศาสตร์ 1', subject: 'ECO' }]
    }, { book: 'หนังสือ', note: 'โน้ตเรียน' });
    expect(r.map((x) => x.id)).toEqual(['data:book:b1', 'data:lec:lec-1']);
    expect(r[0].label).toBe('สงคราม และสันติภาพ');
    expect(r[0].group).toBe('หนังสือ · Tolstoy');
    expect(r[0].href).toBe('books.html');
    expect(r[1].href).toBe('lecture.html#lec-1');
    expect(r[0].hay).toContain('tolstoy');
    expect(C.dataItems({}, {})).toEqual([]);
  });
  test('makeCustom: ต้องมีเรื่อง และเวลาอยู่ในอนาคต', () => {
    expect(C.makeCustom('  ', NOW + HOUR, NOW, 'a')).toEqual({ error: 'title' });
    expect(C.makeCustom('จ่ายค่าน้ำ', NOW - 1, NOW, 'a')).toEqual({ error: 'when' });
    expect(C.makeCustom('จ่ายค่าน้ำ', NaN, NOW, 'a')).toEqual({ error: 'when' });
    expect(C.makeCustom('จ่ายค่าน้ำ', NOW + HOUR, NOW, 'a').row).toEqual({ id: 'a', title: 'จ่ายค่าน้ำ', at: NOW + HOUR, createdAt: NOW });
  });
  test('reminders: ชุดเต็มเฉพาะที่ยังไม่ถึงเวลา, ไม่ซ้ำ id', () => {
    const rows = [{ id: 'a', title: 'A', at: NOW + HOUR }, { id: 'b', title: 'B', at: NOW - HOUR }, { id: 'a', title: 'dup', at: NOW + 2 * HOUR }];
    expect(C.reminders(rows, NOW)).toEqual([{ id: 'a', title: 'A', due_at: NOW + HOUR, kind: 'push', url: 'notifications.html' }]);
  });
});

async function open(page, seed) {
  const errors = await prepare(page);
  await page.addInitScript((s) => {
    window.TANOT_PUSH = { enabled: true };
    for (const k in s) localStorage.setItem(k, JSON.stringify(s[k]));
  }, seed || {});
  await page.route('**/api/push/reminders', (route) => {
    const req = route.request();
    if (req.method() === 'POST') { (global_posts(page)).push(JSON.parse(req.postData() || '{}')); return route.fulfill({ json: { ok: true } }); }
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return errors;
}
const posts = new WeakMap();
function global_posts(page) { if (!posts.has(page)) posts.set(page, []); return posts.get(page); }

test('ค้นชื่อหนังสือ/โน้ตเรียนใน palette แล้วเปิดหน้านั้น', async ({ page }) => {
  const errors = await open(page, {
    'tanot:books:items': [{ id: 'b1', title: 'Atomic Habits', author: 'James Clear' }],
    'tanot:lecture:notes': [{ id: 'lec-x', title: 'กฎหมายแพ่ง', subject: 'LAW' }]
  });
  await page.keyboard.press('Control+k');
  await page.fill('.ome-pal-input', 'atomic');
  await expect(page.locator('.ome-pal-row').first()).toContainText('Atomic Habits');
  await page.fill('.ome-pal-input', 'กฎหมายแพ่ง');
  await expect(page.locator('.ome-pal-row').first()).toContainText('กฎหมายแพ่ง');
  await page.keyboard.press('Enter');
  await page.waitForURL(/lecture\.html#lec-x/);
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
});

test('ตั้งการแจ้งเตือน: เก็บคีย์ + ส่งชุดเต็ม + ตั้งซ้ำไม่ลบอันเดิม + ลบที่ notifications', async ({ page }) => {
  await open(page);
  const set = async (title) => {
    await page.keyboard.press('Control+k');
    await page.fill('.ome-pal-input', 'ตั้งการแจ้งเตือน');
    await page.keyboard.press('Enter');
    await page.locator('.ome-qa:not([hidden]) input[name=title]').fill(title);
    await page.locator('.ome-qa:not([hidden]) button[type=submit]').click();
  };
  // เวลาในอดีต = error ไม่บันทึก
  await page.keyboard.press('Control+k');
  await page.fill('.ome-pal-input', 'reminder');
  await page.keyboard.press('Enter');
  const dlg = page.locator('.ome-qa:not([hidden])');
  await dlg.locator('input[name=title]').fill('x');
  await dlg.locator('input[name=at]').fill('2000-01-01T08:00');
  await dlg.locator('button[type=submit]').click();
  await expect(dlg.locator('.ome-qa-err')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.ome-qa:not([hidden])')).toHaveCount(0);

  await set('จ่ายค่าน้ำ');
  await expect.poll(() => global_posts(page).length).toBe(1);
  await set('ต่อภาษีรถ');
  await expect.poll(() => global_posts(page).length).toBe(2);
  const last = global_posts(page)[1];
  expect(last.scope).toBe('custom');
  expect(last.items.map((i) => i.title).sort()).toEqual(['จ่ายค่าน้ำ', 'ต่อภาษีรถ']);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:reminders:custom')));
  expect(stored).toHaveLength(2);

  await page.route('**/api/push/reminders', (route) => route.request().method() === 'GET'
    ? route.fulfill({ json: { items: stored.map((r) => ({ id: 'custom:' + r.id, source: 'custom', title: r.title, due_at: r.at, kind: 'push' })) } }) : route.fallback());
  await page.goto('/notifications.html', { waitUntil: 'load' });
  await page.locator('[data-del]').first().click();
  await expect.poll(() => global_posts(page).length).toBe(3);
  expect(global_posts(page)[2].items).toHaveLength(1);
});
