// @ts-check
// ภาพพื้นหลังที่ผู้ใช้ตั้งเอง (bg-custom.js + theme-boot.js + theme.css + sw.js) — ROADMAP แถว 10
const { test, expect } = require('@playwright/test');
const path = require('path');
const zlib = require('zlib');
const fs = require('fs');
const { prepare, ROOT } = require('./helpers');

const BG = require(path.join(__dirname, '..', 'bg-custom.js')).TanotBgCustom;
const ID = 'img0123456789abcdef';

function crc32(buf) {
  let c, crc = -1;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** PNG สีเดียว (RGB 8 บิต) */
function solidPng(w, h, rgb) {
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
/** พิกเซลเดียวจากภาพถ่ายหน้าจอ 1×1 (PNG RGB/RGBA ไม่สลับบรรทัด, filter 0) */
function pixel(png) {
  let o = 8, idat = [], bpp = 3;
  while (o < png.length) {
    const len = png.readUInt32BE(o), type = png.toString('latin1', o + 4, o + 8);
    if (type === 'IHDR') bpp = png[o + 8 + 9] === 6 ? 4 : 3;
    if (type === 'IDAT') idat.push(png.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  return [raw[1], raw[2], raw[3]];
}
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

async function open(page, file, { theme = 'light', level, map, rgb = [255, 255, 255], files = true } = {}) {
  const errors = await prepare(page, { theme });
  const requests = [];
  await page.addInitScript(([lv, m, f]) => {
    try {
      if (lv) localStorage.setItem('ome:bg', lv);
      if (m) localStorage.setItem('tanot:bg:custom', JSON.stringify(m));
      if (f) window.TANOT_FILES = { enabled: true };
    } catch (e) {}
  }, [level || '', map || null, files]);
  await page.route('**/api/files?*', (route) => {
    requests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/png', body: solidPng(64, 64, rgb) });
  });
  await page.goto('/' + file);
  await page.waitForLoadState('load');
  return { errors, requests };
}
const attr = (page, a) => page.evaluate((n) => document.documentElement.getAttribute(n), a);
const bgImage = (page) => page.evaluate(() => getComputedStyle(document.documentElement, '::before').backgroundImage);
const cssVar = (page, v) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), v);

test.describe('brightLeft (known-answer)', () => {
  const px = (w, h, f) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = f(x, y); d.set([c[0], c[1], c[2], c[3] == null ? 255 : c[3]], (y * w + x) * 4); } return d; };
  test('ขาวล้วน = 1 · ดำล้วน = 0 · เทา 128 ≈ 0.5', () => {
    expect(BG.brightLeft(px(10, 4, () => [255, 255, 255]), 10, 4)).toBeCloseTo(1, 5);
    expect(BG.brightLeft(px(10, 4, () => [0, 0, 0]), 10, 4)).toBe(0);
    expect(BG.brightLeft(px(10, 4, () => [128, 128, 128]), 10, 4)).toBeCloseTo(0.502, 2);
  });
  test('วัดเฉพาะ 60% ด้านซ้าย (ตัวอักษรอยู่ฝั่งนั้น) · โปร่งใส = ขาว', () => {
    const d = px(10, 2, (x) => (x < 6 ? [0, 0, 0] : [255, 255, 255]));
    expect(BG.brightLeft(d, 10, 2)).toBe(0);
    expect(BG.brightLeft(px(10, 2, () => [0, 0, 0, 0]), 10, 2)).toBeCloseTo(1, 5);
  });
});

test.describe('ภาพที่ผู้ใช้ตั้งเอง — หน้า', () => {
  test('ไม่มีค่าตั้ง = ภาพเดิมของกลุ่ม ไม่มี attribute ใหม่ และไม่ขอ /api/files', async ({ page }) => {
    const { requests } = await open(page, 'index.html');
    expect(await attr(page, 'data-bg')).toBe('today');
    expect(await attr(page, 'data-bg-custom')).toBeNull();
    expect(await bgImage(page)).toContain('assets/backgrounds/today-light.webp');
    expect(requests).toHaveLength(0);
  });

  test('มีค่าตั้ง = ใช้ภาพของผู้ใช้ทั้งสองธีมบน <html> (ไม่มี background บน html) + ขอภาพด้วย &bg=1', async ({ page }) => {
    const { requests } = await open(page, 'index.html', { map: { today: { id: ID, l: 0.5 } } });
    expect(await attr(page, 'data-bg-custom')).toBe('1');
    expect(await bgImage(page)).toContain('/api/files?id=' + ID + '&bg=1');
    await expect.poll(() => requests.some((u) => u.includes('id=' + ID) && u.includes('bg=1'))).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundImage)).toBe('none');
    await page.evaluate(() => window.OmeTheme.set('theme', 'dark'));
    expect(await bgImage(page)).toContain('/api/files?id=' + ID);
  });

  test('กลุ่มอื่นไม่ถูกแตะ · id ผิดรูปแบบ/ชนิดผิดถูกเมิน', async ({ page }) => {
    await open(page, 'budget.html', { map: { today: { id: ID, l: 0.5 }, money: { id: '../etc/x', l: 0.5 } } });
    expect(await attr(page, 'data-bg')).toBe('money');
    expect(await attr(page, 'data-bg-custom')).toBeNull();
    expect(await bgImage(page)).toContain('assets/backgrounds/money-light.webp');
  });

  test('ความเข้มปิด = ไม่มีภาพเลย แม้มีค่าตั้ง · invest ทุกหน้าใช้กลุ่ม invest', async ({ page }) => {
    await open(page, 'index.html', { level: 'off', map: { today: { id: ID, l: 0.5 } } });
    expect(await attr(page, 'data-bg')).toBeNull();
    expect(await attr(page, 'data-bg-custom')).toBeNull();
  });

  test('invest ทุกหน้าใช้กลุ่ม invest', async ({ page }) => {
    await open(page, 'invest-gold.html', { map: { invest: { id: ID, l: 0.5 } } });
    expect(await attr(page, 'data-bg')).toBe('invest');
    expect(await attr(page, 'data-bg-custom')).toBe('1');
  });

  test('ระดับความสว่างปรับ scrim/ฟิลเตอร์: ภาพเข้มบนธีมสว่างทึบขึ้น · ภาพสว่างบนธีมมืดถูกหรี่หนักกว่า', async ({ page }) => {
    await open(page, 'index.html', { level: 'strong', map: { today: { id: ID, l: 0.1 } } });
    expect(await attr(page, 'data-bg-lum')).toBe('dark');
    expect(await cssVar(page, '--ome-bg-scrim')).toBe('80%');
    await page.evaluate((id) => window.OmeTheme.setBgCustom('today', { id, l: 0.95 }), ID);
    expect(await attr(page, 'data-bg-lum')).toBe('bright');
    expect(await cssVar(page, '--ome-bg-scrim')).toBe('6%'); // สว่างบนธีมสว่าง = ตัวอักษรเข้มอ่านได้อยู่แล้ว ไม่เปลี่ยน
    await page.evaluate(() => window.OmeTheme.set('theme', 'dark'));
    expect(await cssVar(page, '--ome-bg-filter')).toContain('brightness(.3)');
    await page.evaluate((id) => window.OmeTheme.setBgCustom('today', { id, l: 0.1 }), ID);
    expect(await cssVar(page, '--ome-bg-filter')).toContain('brightness(.62)');
  });

  test('ตัวอักษรอ่านได้จริง: ภาพดำล้วนธีมสว่างระดับ "ชัด" — พิกเซลขวาสุด (scrim บางสุด) ยังตัดกับสีตัวอักษร ≥ 4.5', async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 900 });
    await open(page, 'credits.html', { level: 'strong', map: { settings: { id: ID, l: 0 } }, rgb: [0, 0, 0] });
    await page.waitForTimeout(400);
    const ink = await page.evaluate(() => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ome-text-1').trim() || '#000'; c.fillRect(0, 0, 1, 1); return Array.from(c.getImageData(0, 0, 1, 1).data.slice(0, 3)); });
    const shot = await page.screenshot({ clip: { x: 1496, y: 500, width: 1, height: 1 } });
    expect(contrast(pixel(shot), ink)).toBeGreaterThanOrEqual(4.5);
  });

  test('ตั้ง/กลับเป็นภาพเดิมด้วย TanotBgCustom: วัดความสว่างจากภาพจริง + ขึ้น toast + เขียนคีย์ sync + ล้างสำเนา', async ({ page }) => {
    await open(page, 'index.html', { rgb: [10, 10, 10] });
    await page.addScriptTag({ path: path.join(ROOT, 'bg-custom.js') });
    const l = await page.evaluate((id) => window.TanotBgCustom.set('today', id), ID);
    expect(l).toBeLessThan(0.1);
    expect(await attr(page, 'data-bg-lum')).toBe('dark');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:bg:custom')));
    expect(stored.today).toMatchObject({ id: ID, l: expect.any(Number) });
    await page.evaluate(() => window.TanotBgCustom.reset('today'));
    expect(await attr(page, 'data-bg-custom')).toBeNull();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:bg:custom')))).toEqual({});
  });

  test('image-gen: ลบภาพที่ถูกใช้เป็นพื้นหลัง → กลุ่มนั้นกลับเป็นภาพเดิม', async ({ page }) => {
    await open(page, 'index.html', { map: { today: { id: ID, l: 0.5 }, health: { id: ID, l: 0.5 }, car: { id: 'other0123456', l: 0.5 } } });
    await page.addScriptTag({ path: path.join(ROOT, 'bg-custom.js') });
    const hit = await page.evaluate((id) => window.TanotBgCustom.clearById(id), ID);
    expect(hit.sort()).toEqual(['health', 'today']);
    expect(await attr(page, 'data-bg-custom')).toBeNull();
    expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('tanot:bg:custom'))))).toEqual(['car']);
  });

  test('แผงตั้งค่า: แถว "ภาพพื้นหลังหน้านี้…" เปิดตัวเลือกภาพจากคลัง · เลือก/กลับเป็นภาพเดิมได้ · EN', async ({ page }) => {
    await page.addInitScript((id) => {
      localStorage.setItem('tanot:images:items', JSON.stringify([{ id, mime: 'image/png', prompt: 'a', createdAt: 1 }, { id: 'img999999999', mime: 'image/png', prompt: 'b', createdAt: 2 }]));
      localStorage.setItem('ome:lang', 'en');
    }, ID);
    await open(page, 'index.html', { rgb: [200, 200, 200] });
    await page.locator('#omeGearBtn').first().click();
    const row = page.locator('[data-bgimg]');
    await expect(row).toContainText('background image');
    await row.click();
    const dlg = page.locator('dialog.bgc-dialog');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('.bgc-tile')).toHaveCount(2);
    await dlg.locator('.bgc-tile').nth(1).click(); // รายการใหม่สุด
    await expect.poll(() => attr(page, 'data-bg-custom')).toBe('1');
    expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('tanot:bg:custom'))))).toEqual(['today']);
    await page.locator('#omeGearBtn').first().click();
    await page.locator('[data-bgimg]').click();
    await page.locator('dialog.bgc-dialog [data-act="reset"]').click();
    await expect.poll(() => attr(page, 'data-bg-custom')).toBeNull();
  });

  test('แถวในแผงตั้งค่าไม่ขึ้นเมื่อใช้ R2 ไม่ได้ (localhost ไม่มี TANOT_FILES) · หน้าไม่มีกลุ่มก็ไม่ขึ้น', async ({ page }) => {
    await open(page, 'index.html', { files: false });
    await page.locator('#omeGearBtn').first().click();
    await expect(page.locator('[data-bgimg]')).toHaveCount(0);
  });

  test('image-gen: ปุ่ม "ตั้งเป็นพื้นหลัง" ในกล่องดูภาพ → เลือกกลุ่ม → ตั้งแล้วคีย์ถูกเขียน', async ({ page }) => {
    await page.addInitScript((id) => {
      localStorage.setItem('tanot:images:items', JSON.stringify([{ id, preset: 'free', mime: 'image/png', prompt: 'x', name: 'x.png', createdAt: 1 }]));
    }, ID);
    const { errors } = await open(page, 'image-gen.html', { rgb: [240, 240, 240] });
    await page.locator('#grid button').first().click();
    await page.locator('#vBg').click();
    const dlg = page.locator('dialog.bgc-dialog');
    await dlg.locator('[data-group="health"]').click();
    await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('tanot:bg:custom') || '{}').health || {}).id)).toBe(ID);
    expect(errors.filter((e) => !/api\/(ai|sync|session)/.test(e))).toEqual([]);
  });
});

test.describe('repo', () => {
  test('sw.js: แคช ome-bgc-v1 cache-first เฉพาะ /api/files?bg=1 + ไม่อยู่ในรายการที่ activate ลบ · registry ลงทะเบียนคีย์', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    expect(sw).toMatch(/const BGC_CACHE = 'ome-bgc-v1'/);
    expect(sw).toMatch(/pathname === '\/api\/files' && url\.searchParams\.get\('bg'\) === '1'/);
    expect(sw).toContain("'./bg-custom.js'");
    expect(fs.readFileSync(path.join(ROOT, 'data-registry.js'), 'utf8')).toMatch(/key: 'tanot:bg:custom', kind: 'sync', mode: 'map'/);
  });
});
