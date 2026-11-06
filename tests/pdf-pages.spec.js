// @ts-check
// แยกหน้า PDF ด้วย PdfCraft (vendor/craft/pdfcraft-*, wasm ตัวจริงที่ build จาก tools/wasm/pdfcraft-pages) — ปุ่ม "แยกหน้า PDF" ของ extract-text.html
// PDF ทุกไฟล์สร้างในเทสต์ (pdf-lib ใน tests/node_modules / เขียน object เอง) — ห้ามใช้ไฟล์ของเจ้าของ
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, degrees } = require('pdf-lib');
const JSZip = require('jszip');

const NM = (...p) => path.join(__dirname, 'node_modules', ...p);

/* PDF 3 หน้า กว้างไม่เท่ากัน (ใช้แยกว่าหน้าไหนอยู่ไฟล์ไหน) + ข้อความ + bookmark ไม่มี */
async function threePages() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  [300, 320, 340].forEach((w, i) => {
    const p = doc.addPage([w, 400]);
    p.drawText('Page ' + (i + 1), { x: 20, y: 350, size: 18, font });
  });
  doc.getPage(1).setRotation(degrees(90));
  return Buffer.from(await doc.save());
}

/* PDF ที่เขียน object เอง (xref คำนวณ offset จริง) */
function rawPdf(bodies, rootNum) {
  let out = '%PDF-1.7\n';
  const offs = [];
  bodies.forEach((b, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += (i + 1) + ' 0 obj\n' + b + '\nendobj\n'; });
  const x = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 ' + (bodies.length + 1) + '\n0000000000 65535 f \n' + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += 'trailer\n<< /Size ' + (bodies.length + 1) + ' /Root ' + rootNum + ' 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}
/* page tree ซ้อนชั้น: Rotate 90 + MediaBox สืบทอดจากโหนดกลาง (หน้า 1–2) · หน้า 3 อยู่ใต้ราก */
const NESTED = rawPdf([
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 3 /MediaBox [0 0 500 700] >>',
  '<< /Type /Pages /Parent 2 0 R /Kids [4 0 R 5 0 R] /Count 2 /Rotate 90 /MediaBox [0 0 210 297] >>',
  '<< /Type /Page /Parent 3 0 R >>',
  '<< /Type /Page /Parent 3 0 R >>',
  '<< /Type /Page /Parent 2 0 R >>',
], 1);
const EMPTY = rawPdf(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [] /Count 0 >>'], 1);

async function setup(context, page, { wasm404 = false } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push(m.text()); }); // ภายนอกที่บล็อกเอง (ฟอนต์ ฯลฯ) ไม่นับ
  const hosts = new Set();
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    hosts.add(u.hostname + (u.hostname === 'cdn.jsdelivr.net' ? u.pathname : ''));
    if (wasm404 && /\/vendor\/craft\/pdfcraft-[^/]+\/pdfcraft_pages_bg\.wasm$/.test(u.pathname)) return route.fulfill({ status: 404, body: '' });
    if (/pdfjs-dist@4\.7\.76\/build\/(pdf\.min\.mjs|pdf\.worker\.min\.mjs)/.test(u.href)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(NM('pdfjs-dist', 'build', u.pathname.split('/').pop())) });
    if (/jszip@3\.10\.1\/dist\/jszip\.min\.js/.test(u.href)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(NM('jszip', 'dist', 'jszip.min.js')) });
    if (u.hostname === 'cdn.jsdelivr.net' && /\.m?js$/.test(u.pathname)) return route.fulfill({ contentType: 'application/javascript', body: '' });
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort('internetdisconnected');
  });
  return { errors, hosts };
}

/* เรียก pdf-pages-worker.js ตรงๆ ในหน้า → {ok, parts:[base64]} | {ok:false, pdf|craft} */
async function viaWorker(page, buf, every) {
  return page.evaluate(({ b64, every }) => new Promise((resolve) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const w = new Worker('pdf-pages-worker.js');
    w.onmessage = (e) => {
      const d = e.data;
      w.terminate();
      if (!d.ok) return resolve(d);
      resolve({ ok: true, parts: d.parts.map((ab) => { let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }) });
    };
    w.postMessage({ bytes: bytes.buffer, every }, [bytes.buffer]);
  }), { b64: buf.toString('base64'), every });
}
const fromB64 = (s) => Buffer.from(s, 'base64');

test.describe('PdfCraft (wasm ตัวจริง) — แยกหน้า PDF', () => {
  test('3 หน้า → 3 ไฟล์ ไฟล์ละ 1 หน้า ตรงลำดับ/ขนาด/การหมุน · แยกซ้ำได้ไบต์เดิมทุกไฟล์ · ทีละ 2 หน้า = 2 ไฟล์', async ({ context, page }) => {
    const { errors } = await setup(context, page);
    await page.goto('/extract-text.html');
    const src = await threePages();
    const a = await viaWorker(page, src, 1);
    expect(a.ok).toBe(true);
    expect(a.parts).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      const d = await PDFDocument.load(fromB64(a.parts[i]));
      expect(d.getPageCount()).toBe(1);
      expect(d.getPage(0).getSize()).toEqual({ width: 300 + i * 20, height: 400 });
      expect(d.getPage(0).getRotation().angle).toBe(i === 1 ? 90 : 0);
    }
    const b = await viaWorker(page, src, 1);
    expect(b.parts).toEqual(a.parts);
    const two = await viaWorker(page, src, 2);
    expect(two.parts).toHaveLength(2);
    expect((await PDFDocument.load(fromB64(two.parts[0]))).getPageCount()).toBe(2);
    expect((await PDFDocument.load(fromB64(two.parts[1]))).getPageCount()).toBe(1);
    expect(errors).toEqual([]);
  });

  test('page tree ซ้อนชั้น: Rotate/MediaBox ที่สืบทอดจากโหนดกลางติดไปกับหน้าที่แยก', async ({ context, page }) => {
    await setup(context, page);
    await page.goto('/extract-text.html');
    const r = await viaWorker(page, NESTED, 1);
    expect(r.ok).toBe(true);
    const got = [];
    for (const p of r.parts) {
      const pg = (await PDFDocument.load(fromB64(p))).getPage(0);
      got.push([pg.getSize().width, pg.getSize().height, pg.getRotation().angle]);
    }
    expect(got).toEqual([[210, 297, 90], [210, 297, 90], [500, 700, 0]]);
  });

  test('ไฟล์ไม่ใช่ PDF = damaged · ไม่มีหน้า = empty (รหัสเท่านั้น ไม่มีเนื้อหาไฟล์)', async ({ context, page }) => {
    await setup(context, page);
    await page.goto('/extract-text.html');
    expect(await viaWorker(page, Buffer.from('hello, not a pdf'), 1)).toEqual({ ok: false, pdf: 'damaged' });
    expect(await viaWorker(page, EMPTY, 1)).toEqual({ ok: false, pdf: 'empty' });
  });
});

test.describe('extract-text.html — ปุ่มแยกหน้า PDF', () => {
  test('ได้ pages_<ชื่อ>.zip มี page_001..003.pdf · ไม่โหลด pdf-lib จาก CDN · ไม่มี error', async ({ context, page }) => {
    const { errors, hosts } = await setup(context, page);
    await page.goto('/extract-text.html');
    await page.setInputFiles('#fileInput', { name: 'contract.pdf', mimeType: 'application/pdf', buffer: await threePages() });
    await expect(page.locator('#splitPdfBtn')).toBeVisible({ timeout: 30000 });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#splitPdfBtn')]);
    expect(dl.suggestedFilename()).toBe('pages_contract.zip');
    const zip = await JSZip.loadAsync(fs.readFileSync(await dl.path()));
    expect(Object.keys(zip.files).sort()).toEqual(['page_001.pdf', 'page_002.pdf', 'page_003.pdf']);
    const p2 = await PDFDocument.load(await zip.file('page_002.pdf').async('uint8array'));
    expect(p2.getPage(0).getSize().width).toBe(320);
    await expect(page.locator('#actionStatus')).toHaveClass(/ok/);
    await expect(page.locator('#splitPdfBtn')).toBeEnabled();
    expect([...hosts].some((h) => /pdf-lib/.test(h))).toBe(false);
    expect(errors).toEqual([]);
  });

  test('โหลด wasm ไม่ได้ (404) → ข้อความของตัวโหลดกลาง + problem log ไม่มีชื่อไฟล์ผู้ใช้ · ไม่สลับไปทางอื่น', async ({ context, page }) => {
    await setup(context, page, { wasm404: true });
    await page.goto('/extract-text.html');
    await page.setInputFiles('#fileInput', { name: 'ลับมาก.pdf', mimeType: 'application/pdf', buffer: await threePages() });
    await expect(page.locator('#splitPdfBtn')).toBeVisible({ timeout: 30000 });
    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.click('#splitPdfBtn');
    await expect(page.locator('#actionStatus')).toHaveClass(/err/);
    await expect(page.locator('#actionStatus')).toHaveText('ไม่พบไฟล์ของเครื่องมือนี้บนเซิร์ฟเวอร์ — โหลดหน้าใหม่แล้วลองอีกครั้ง');
    const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));
    expect(rows.some((r) => r.kind === 'craft' && /pdfcraft\/pdfcraft_pages_bg\.wasm/.test(r.model || ''))).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/ลับมาก/);
    expect(downloaded).toBe(false);
  });
});
