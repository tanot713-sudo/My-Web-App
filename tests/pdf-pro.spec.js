// @ts-check
// โปรแกรมแก้ไข PDF (pdf-pro.html + craft-app.js) — PdfCraft แบบโปรแกรมเต็ม wasm ตัวจริงใน vendor/craft/pdfcraft-app-*
// (build จาก tools/wasm/pdfcraft-app) · PDF สร้างในเทสต์ด้วย pdf-lib ใน tests/node_modules — ห้ามใช้ไฟล์ของเจ้าของ
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');

const ROOT = path.resolve(__dirname, '..');
const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor/craft/manifest.json'), 'utf8'));
const LIB = MAN.libs['pdfcraft-app'];
const WASM_RE = /\/vendor\/craft\/pdfcraft-app-[^/]+\/pdfcraft_app_bg\.wasm$/;

async function samplePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p = doc.addPage([400, 500]);
  p.drawText('Tanot test page', { x: 40, y: 440, size: 20, font });
  return Buffer.from(await doc.save());
}

async function setup(context, page, { wasm = 'ok' } = {}) {
  const errors = [];
  const wasmHits = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push(m.text()); });
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (WASM_RE.test(u.pathname)) {
      wasmHits.push(u.pathname);
      if (wasm === '404') return route.fulfill({ status: 404, body: '' });
      if (wasm === 'bad') return route.fulfill({ status: 200, contentType: 'application/wasm', body: Buffer.from('not the wasm') });
    }
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort('internetdisconnected'); // ไม่มีการออกเน็ตจากหน้านี้ (ฟอนต์ Google ถูกบล็อก = ไม่นับ)
  });
  return { errors, wasmHits };
}

test.describe('โปรแกรมแก้ไข PDF (PdfCraft ตัวจริง)', () => {
  test.setTimeout(180000);

  test('manifest: ไฟล์ของแอปตรง sha256 · ไม่มีไฟล์ใดเกิน 25 MiB · มี license ฟอนต์ไทย', async () => {
    expect(LIB, 'libs["pdfcraft-app"]').toBeTruthy();
    for (const [f, m] of Object.entries(LIB.files)) {
      const b = fs.readFileSync(path.join(ROOT, LIB.dir, f));
      expect(crypto.createHash('sha256').update(b).digest('hex'), f).toBe(m.sha256);
      expect(b.length, f).toBeLessThanOrEqual(25 * 1024 * 1024);
    }
    expect(Object.keys(LIB.files)).toEqual(expect.arrayContaining(['pdfcraft_app.js', 'pdfcraft_app_bg.wasm', 'LICENSE-MIT', 'THIRD-PARTY.txt', 'OFL-noto-sans-thai.txt']));
    // glue ต้องไม่ import ไฟล์อื่น (craft-loader.esm import จาก Blob URL)
    const glue = fs.readFileSync(path.join(ROOT, LIB.dir, 'pdfcraft_app.js'), 'utf8');
    expect(glue).not.toMatch(/^\s*import\s.+from\s/m);
  });

  test('คอม: แอปขึ้นบน canvas (ready) · เปิดไฟล์จากเครื่องได้ · ไม่มี error · ไม่ออกเน็ต', async ({ context, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const { errors, wasmHits } = await setup(context, page);
    await page.goto('/pdf-pro.html');
    await page.waitForFunction(() => window.__craftApp && window.__craftApp.isReady(), null, { timeout: 150000 });
    expect(wasmHits.length).toBe(1);
    await expect(page.locator('#craOver')).toBeHidden();
    await expect(page.locator('#craOpen')).toBeEnabled();
    const box = await page.locator('#pdfcraft').boundingBox();
    expect(box && box.width).toBeGreaterThan(1000);
    expect(box && box.height).toBeGreaterThan(500);
    // แอปวาดจริง: ภาพของ canvas ไม่ใช่สีเดียวทั้งผืน
    await page.waitForTimeout(1500);
    const shot = await page.locator('#pdfcraft').screenshot();
    const uniq = new Set();
    for (let i = 0; i < shot.length; i += 997) uniq.add(shot[i]);
    expect(uniq.size).toBeGreaterThan(8);

    await page.locator('#craFile').setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: await samplePdf() });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__craftApp.state())).toBe('ready');
    expect(errors).toEqual([]);
  });

  test('มือถือ 390: ไม่โหลดแอปเอง · แสดงสถานะ + ขนาด MB + ปุ่มเปิดต่อ → เริ่มโหลด', async ({ context, page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { wasmHits } = await setup(context, page, { wasm: '404' });
    await page.goto('/pdf-pro.html');
    await expect(page.locator('#craGate')).toBeVisible();
    const mb = ((LIB.files['pdfcraft_app.js'].bytes + LIB.files['pdfcraft_app_bg.wasm'].bytes) / 1048576).toFixed(1);
    await expect(page.locator('#craGateText')).toContainText(mb + ' MB');
    await page.waitForTimeout(500);
    expect(wasmHits).toEqual([]);
    await page.locator('#craGo').click();
    await expect(page.locator('#craErr')).toBeVisible();
    expect(wasmHits.length).toBeGreaterThan(0);
  });

  test('wasm 404 = ข้อความ th/en + ปุ่มลองใหม่ + problem log (ชื่อไฟล์ของเราเท่านั้น)', async ({ context, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setup(context, page, { wasm: '404' });
    await page.goto('/pdf-pro.html');
    await expect(page.locator('#craErrText')).toContainText('ไม่พบไฟล์ของเครื่องมือนี้');
    await expect(page.locator('#craRetry')).toBeVisible();
    const log = await page.evaluate(() => localStorage.getItem('tanot:media:log') || '');
    expect(log).toContain('pdfcraft-app/pdfcraft_app_bg.wasm');
    await page.evaluate(() => window.OME_LANG.set('en'));
    await expect(page.locator('#craErrText')).toContainText('were not found');
    await expect(page.locator('h1')).toHaveText('PDF editor');
    await expect(page.locator('#craRetry')).toContainText('Try again');
  });

  test('wasm ไม่ตรง sha256 = integrity (ไม่รันไฟล์ที่ผิด)', async ({ context, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const { wasmHits } = await setup(context, page, { wasm: 'bad' });
    await page.goto('/pdf-pro.html');
    await expect(page.locator('#craErrText')).toContainText('เสียหายหรือไม่ครบ');
    expect(wasmHits.length).toBe(2); // ลองใหม่แบบ cache:'reload' 1 ครั้ง
  });
});
