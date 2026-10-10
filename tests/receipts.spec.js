// @ts-check
// คลังใบเสร็จ (receipts.html / receipts-calc.js / functions/api/files.js ns receipts) — ROADMAP Phase 6 ชีวิต P2
// กฎเหล็ก: อ่านใบเสร็จฟรีเสมอ (Tesseract + AI ปลอม) — /api/ocr (Claude) เรียกได้เฉพาะเมื่อกดปุ่ม "อ่านด้วย Claude" เท่านั้น
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');

const R = require(path.join(__dirname, '..', 'receipts-calc.js'));
const SRV = 'http://localhost:8132';
const NOW = new Date('2026-09-30T10:30:00+07:00');
const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const IMG = { name: 'bill.png', mimeType: 'image/png', buffer: PNG };
// ทั้งไฟล์ใช้เซิร์ฟเวอร์เดียวที่มี /__reset ล้าง D1+R2 — ห้ามให้ describe ต่างกลุ่มรันขนานกัน
test.describe.configure({ mode: 'serial' });
const at = (s) => new Date(s + 'T12:00:00');

test.describe('receipts-calc.js (known-answer)', () => {
  test('findDate: ISO, dd/mm/yyyy (พ.ศ./ค.ศ.), ชื่อเดือนไทย/อังกฤษ · วันที่ที่ไม่มีจริง = ว่าง', () => {
    expect(R.findDate('วันที่ 15/09/2569 12:30')).toBe('2026-09-15');
    expect(R.findDate('3 ต.ค. 2569')).toBe('2026-10-03');
    expect(R.findDate('25 ธันวาคม 2568')).toBe('2025-12-25');
    expect(R.findDate('2026-10-03')).toBe('2026-10-03');
    expect(R.findDate('03-10-2026')).toBe('2026-10-03');
    expect(R.findDate('01 Oct 2026')).toBe('2026-10-01');
    expect(R.findDate('31/02/2569')).toBe('');
    expect(R.findDate('ไม่มีวันที่ 1234')).toBe('');
  });

  test('findTotal: เลือกบรรทัดยอดสุทธิ/รวมทั้งสิ้นก่อน · ตัวเลขอยู่บรรทัดถัดไปได้ · ไม่เจอคำยอดรวม = null (ไม่เดา)', () => {
    expect(R.findTotal('ร้าน X\nรวม 3 รายการ\nVAT 7% 81.78\nรวมทั้งสิ้น 1,250.00')).toBe(1250);
    expect(R.findTotal('ยอดรวม\n 890.00')).toBe(890);
    expect(R.findTotal('Subtotal 100.00\nTotal 107.00')).toBe(107);
    expect(R.findTotal('รวม 3 รายการ')).toBeNull();
    expect(R.findTotal('สินค้า 12\nVAT 7% 0.84')).toBeNull();
    expect(R.findTotal('')).toBeNull();
  });

  test('regexFields / parseFields: เฉพาะช่องที่ใช้ได้ · JSON เสีย = null · ตัวเลขมีคอมมา', () => {
    expect(R.regexFields('Tax ID 0-1055-12345-67-8\nTotal 99.50\n3 ต.ค. 2569')).toEqual({ total: 99.5, date: '2026-10-03', taxId: '0105512345678' });
    expect(R.regexFields('ไม่มีอะไร')).toEqual({});
    expect(R.parseFields('ได้เลย ```json {"store":" ร้าน A ","date":"2026-10-01","total":"1,000","vat":null,"taxId":"0105512345678","fullInvoice":true,"items":[{"name":"x","amount":5},{"name":""}]} ```'))
      .toEqual({ store: 'ร้าน A', date: '2026-10-01', total: 1000, taxId: '0105512345678', fullInvoice: true, items: [{ name: 'x', amount: 5 }] });
    expect(R.parseFields('ขออภัย ตอบไม่ได้')).toBeNull();
    expect(R.parseFields('{"total":-5,"date":"ไม่ใช่วัน"}')).toEqual({});
  });

  test('warrantyEnd: บวกเดือนจากวันซื้อ (สิ้นเดือนถอยเป็นวันสุดท้าย) · ไม่ระบุเดือน = ไม่มีประกัน', () => {
    expect(R.warrantyEnd({ date: '2026-01-31', warrantyMonths: 1 })).toBe('2026-02-28');
    expect(R.warrantyEnd({ date: '2024-02-29', warrantyMonths: 12 })).toBe('2025-02-28');
    expect(R.warrantyEnd({ date: '2025-11-20', warrantyMonths: 12 })).toBe('2026-11-20');
    expect(R.warrantyEnd({ date: '2025-11-20' })).toBe('');
    expect(R.warrantyEnd({ date: '', warrantyMonths: 12 })).toBe('');
  });

  test('expiring: ภายใน N วัน ยังไม่หมด เรียงใกล้สุดก่อน', () => {
    const now = at('2026-09-30');
    const list = [
      { id: 'a', date: '2025-11-20', warrantyMonths: 12 }, // 51 วัน
      { id: 'b', date: '2025-10-05', warrantyMonths: 12 }, // 5 วัน
      { id: 'c', date: '2026-01-01', warrantyMonths: 36 }, // ไกล
      { id: 'd', date: '2025-01-01', warrantyMonths: 6 },  // หมดแล้ว
      { id: 'e', date: '2025-10-30' },                     // ไม่มีประกัน
    ];
    expect(R.expiring(list, now, 60).map((x) => [x.receipt.id, x.days])).toEqual([['b', 5], ['a', 51]]);
    expect(R.expiring(list, now, 10).map((x) => x.receipt.id)).toEqual(['b']);
  });

  test('reminders: 30 วันก่อนหมด + วันหมด เวลา 08:00 ไทย · เฉพาะที่ยังไม่ถึง', () => {
    const now = new Date('2026-09-30T10:30:00+07:00');
    const r = R.reminders([
      { id: 'r1', store: 'ร้าน A', warrantyProduct: 'ทีวี', date: '2026-08-15', warrantyMonths: 12 },
      { id: 'r2', store: 'ร้าน B', date: '2025-10-01', warrantyMonths: 12 },  // หมด 2026-10-01 → เหลือแค่วันหมด
      { id: 'r3', store: 'ร้าน C', date: '2024-01-01', warrantyMonths: 12 },  // หมดแล้ว
      { id: 'r4', store: 'ร้าน D', date: '2026-08-15' },                     // ไม่มีประกัน
    ], now);
    expect(r.map((i) => [i.id, i.due_at])).toEqual([
      ['r1:2027-08-15:30', Date.UTC(2027, 6, 16, 1, 0)],
      ['r1:2027-08-15:0', Date.UTC(2027, 7, 15, 1, 0)],
      ['r2:2026-10-01:0', Date.UTC(2026, 9, 1, 1, 0)],
    ]);
    expect(r[0]).toMatchObject({ title: 'ประกันสินค้าหมดใน 30 วัน', body: 'ทีวี · ร้าน A · หมด 15 ส.ค. 2570', url: 'receipts.html', kind: 'push' });
    expect(r[2].title).toBe('ประกันสินค้าหมดวันนี้');
  });

  test('taxSummary: รวมยอดต่อปี ค.ศ. ต่อป้าย · ไม่นับ none/ยอด 0/ไม่มีวันที่', () => {
    expect(R.taxSummary([
      { date: '2025-12-20', total: 3000, taxTag: 'eReceipt' },
      { date: '2025-03-01', total: 500.5, taxTag: 'eReceipt' },
      { date: '2026-03-01', total: 5000, taxTag: 'donation' },
      { date: '2026-03-02', total: 100, taxTag: 'none' },
      { date: '2026-03-02', total: 0, taxTag: 'donation' },
      { date: '', total: 900, taxTag: 'politic' },
    ])).toEqual({ v: 1, years: { 2025: { eReceipt: 3500.5 }, 2026: { donation: 5000 } } });
  });

  test('matches: ร้าน/รายการสินค้า/ปี/ป้าย/มีประกัน', () => {
    const r = { store: 'Power Buy', date: '2026-03-01', items: [{ name: 'ทีวี Sony' }], taxTag: 'eReceipt', warrantyMonths: 12 };
    expect(R.matches(r, { q: 'power' })).toBe(true);
    expect(R.matches(r, { q: 'sony' })).toBe(true);
    expect(R.matches(r, { q: 'xyz' })).toBe(false);
    expect(R.matches(r, { year: 2026 })).toBe(true);
    expect(R.matches(r, { year: 2025 })).toBe(false);
    expect(R.matches(r, { tag: 'donation' })).toBe(false);
    expect(R.matches(r, { tag: 'eReceipt', warranty: true })).toBe(true);
    expect(R.matches({ store: 'x', date: '2026-03-01' }, { warranty: true })).toBe(false);
  });
});

test.describe('API /api/files ns receipts', () => {
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });
  test('รับ ns receipts: อัปโหลด → ลบ → หายจาก R2', async ({ request }) => {
    const res = await request.post(SRV + '/api/files?ns=receipts&ref=r1&name=a.png', { data: PNG, headers: { 'Content-Type': 'image/png' } });
    expect(res.status()).toBe(200);
    const meta = await res.json();
    expect(await (await request.get(SRV + '/__files')).json()).toEqual(['receipts/' + meta.id]);
    expect((await request.delete(SRV + '/api/files?id=' + meta.id)).status()).toBe(200);
    expect(await (await request.get(SRV + '/__files')).json()).toEqual([]);
  });
});

/* ── หน้า ── */
function seedFn() {
  return ({ items, budget, cats }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (items) localStorage.setItem('tanot:receipts:items', JSON.stringify(items));
    if (budget) localStorage.setItem('budget:records', JSON.stringify(budget));
    if (cats) localStorage.setItem('budget:categories', JSON.stringify(cats));
  };
}
/**
 * ai: เปิด AiClient (TANOT_AI) · chat: คำตอบของโมเดลเร็ว (สตริง JSON) หรือ 500 · tess: ใส่ตัวอ่านปลอมแทน Tesseract จาก CDN
 * ocrText: ข้อความที่ Tesseract ปลอมคืน · claude: ข้อความที่ /api/ocr ปลอมคืน
 */
async function openPage(page, p, o = {}) {
  const { ai = true, chat = null, chatStatus = 200, tess = true, ocrText = '', claude = '', files = true, push = false, sync = false, data, theme = 'light', width = 1100 } = o;
  const errors = await prepare(page, { theme });
  const log = { ocr: [], chat: [], tessLoaded: 0, del: [], posts: [] };
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/api/ocr')) log.ocr.push(r.postDataJSON());
    if (u.includes('/api/ai/chat')) log.chat.push(r.postDataJSON());
    if (u === TESS_URL) log.tessLoaded++;
    if (r.method() === 'DELETE' && u.includes('/api/files')) log.del.push(u);
    if (r.method() === 'POST' && u.includes('/api/push/reminders')) log.posts.push(r.postDataJSON());
  });
  await page.addInitScript(({ ai, files, push, sync, ocrText }) => {
    window.TANOT_AI = { enabled: ai };
    if (files) window.TANOT_FILES = { enabled: true };
    if (push) window.TANOT_PUSH = { enabled: true };
    if (sync) window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
    window.__OCR_TEXT = ocrText;
  }, { ai, files, push, sync, ocrText });
  if (tess) {
    await page.route(TESS_URL, (route) => route.fulfill({
      contentType: 'application/javascript',
      body: 'window.Tesseract={recognize:function(b,l){window.__tess=(window.__tess||0)+1;window.__tessLang=l;return Promise.resolve({data:{text:window.__OCR_TEXT||""}});}};',
    }));
  }
  if (ai) {
    await page.route('**/api/ai/chat', (route) => chatStatus !== 200
      ? route.fulfill({ status: chatStatus, contentType: 'application/json', body: '{"error":"x"}' })
      : route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ t: chat || '{}' }) + '\n\ndata: {"done":true,"model":"fake"}\n\n' }));
  }
  await page.route('**/api/ocr', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: claude }) }));
  if (data) await page.addInitScript(seedFn(), data);
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(p, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return { errors, log };
}
const store = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);
// ปุ่มลบในกล่องแก้ไข → กล่องยืนยันของเว็บ (tanotConfirm, <dialog>) ไม่ใช่ window.confirm
async function confirmDelete(page, ok = true) {
  await page.click('#delBtn');
  const box = page.locator('dialog:has(.dialog-msg)');
  await expect(box.locator('.dialog-msg')).toContainText('ลบใบเสร็จนี้');
  await box.locator(ok ? '.btn.danger' : '.btn:not(.danger)').click();
  await expect(box).toHaveCount(0);
}
// Claude Vision ต้องกรอกรหัสทุกครั้ง (ocr-vision.js) — ในเทสต์ /api/ocr ถูกดัก (route) จึงรหัสอะไรก็ได้ แต่ต้องมี dialog ขึ้นก่อนส่งทุกครั้ง
async function fillPin(page, pin = '123456') {
  const dlg = page.locator('dialog[data-ocrv][open]');
  await expect(dlg).toBeVisible();
  await dlg.locator('input[type=password]').fill(pin);
  await dlg.locator('[data-k=send]').click();
}
const AI_FULL = JSON.stringify({ store: 'ร้านเอ', date: '2026-09-15', total: 1070, vat: 70, taxId: '0105512345678', fullInvoice: true, items: [{ name: 'หูฟัง', amount: 1000 }] });

test.describe('หน้า receipts.html', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('ถ่าย/เลือกรูป → ย่อ+ส่ง R2 → Tesseract (tha+eng, โหลดตอนอ่านครั้งแรก) + AI แยกช่อง → เติมฟอร์ม ป้าย "ฟรี" · ไม่มีคำขอ /api/ocr เลย · บันทึกเข้ารายการ', async ({ page, request }) => {
    const { errors, log } = await openPage(page, '/receipts.html', { chat: AI_FULL, ocrText: 'ร้านเอ\nรวมทั้งสิ้น 1,070.00' });
    await expect(page.locator('#listBody')).toContainText('ยังไม่มีใบเสร็จ');
    await page.click('#addBtn');
    await expect(page.locator('#claudeBtn')).toBeVisible();
    expect(log.tessLoaded).toBe(0); // ยังไม่โหลด Tesseract จนกว่าจะอ่านครั้งแรก

    await page.setInputFiles('#fileInput', IMG);
    await expect(page.locator('#fStore')).toHaveValue('ร้านเอ');
    await expect(page.locator('#fDate')).toHaveValue('2026-09-15');
    await expect(page.locator('#fTotal')).toHaveValue('1070');
    await expect(page.locator('#fVat')).toHaveValue('70');
    await expect(page.locator('#fTaxId')).toHaveValue('0105512345678');
    await expect(page.locator('#fFull')).toBeChecked();
    await expect(page.locator('#fItems')).toHaveValue('หูฟัง  1000');
    await expect(page.locator('#srcBadge')).toHaveText('ฟรี');
    await expect(page.locator('#dlg .field.warn')).toHaveCount(0);
    expect(log.tessLoaded).toBe(1);
    expect(await page.evaluate(() => window.__tessLang)).toBe('tha+eng');
    expect(log.chat).toHaveLength(1);
    expect(log.chat[0]).toMatchObject({ model: 'fast' });
    expect(JSON.stringify(log.chat[0].messages)).toContain('ร้านเอ'); // ข้อความ OCR ถูกส่งให้ AI แยกช่อง
    expect(log.ocr).toHaveLength(0);

    // ไฟล์ที่ส่งเป็นรูปย่อ JPEG ใน R2 ns receipts
    await expect(page.locator('#fileList .file-row')).toHaveCount(1);
    await expect(page.locator('#fileList')).toContainText('bill.jpg');
    const keys = await (await request.get(SRV + '/__files')).json();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^receipts\//);

    await page.selectOption('#fTag2', 'eReceipt');
    await page.click('#saveBtn');
    const row = page.locator('#listBody .list-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('ร้านเอ');
    await expect(row).toContainText('฿1,070');
    await expect(row.locator('[data-b="tax"]')).toContainText('Easy e-Receipt');
    const items = await store(page, 'tanot:receipts:items');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ store: 'ร้านเอ', date: '2026-09-15', total: 1070, vat: 70, taxId: '0105512345678', fullInvoice: true, taxTag: 'eReceipt', source: 'free' });
    expect(items[0].files).toHaveLength(1);
    expect(items[0].budgetId).toBeUndefined();
    expect(log.ocr).toHaveLength(0);
    expect(errors).toEqual([]);
  });

  test('อ่านไม่ได้ยอดรวม → ไฮไลต์ช่อง (warn) แต่ไม่เรียก /api/ocr · กรอกเองแล้วไฮไลต์หาย', async ({ page }) => {
    const { log } = await openPage(page, '/receipts.html', { chat: JSON.stringify({ store: 'ร้านบี', date: '2026-09-20', total: null }), ocrText: 'ร้านบี\nสินค้า 12' });
    await page.click('#addBtn');
    await page.setInputFiles('#fileInput', IMG);
    await expect(page.locator('#fStore')).toHaveValue('ร้านบี');
    await expect(page.locator('#dlg .field[data-f="total"]')).toHaveClass(/warn/);
    await expect(page.locator('#dlg .field[data-f="store"]')).not.toHaveClass(/warn/);
    await expect(page.locator('#dlg .field[data-f="date"]')).not.toHaveClass(/warn/);
    await expect(page.locator('#srcBadge')).toHaveText('ฟรี');
    await expect(page.locator('#claudeBtn')).toBeEnabled(); // มีปุ่มให้ผู้ใช้กดเอง แต่ยังไม่ถูกกด
    await page.waitForTimeout(300);
    expect(log.ocr).toHaveLength(0);
    await page.fill('#fTotal', '250');
    await expect(page.locator('#dlg .field.warn')).toHaveCount(0);
    expect(log.ocr).toHaveLength(0);
  });

  test('กด "อ่านด้วย Claude" → เรียก /api/ocr 1 ครั้งด้วย prompt ใหม่ (ไม่ใช่ถอดข้อความเดิม) · ใบถัดไปเริ่มที่แบบฟรีอีกครั้ง', async ({ page }) => {
    const { log } = await openPage(page, '/receipts.html', {
      chat: JSON.stringify({ store: 'ร้านบี', date: '2026-09-20', total: null }), ocrText: 'ร้านบี',
      claude: 'นี่คือผล: ```json\n{"store":"ร้านบี สาขา 2","date":"2026-09-20","total":"2,500.50","vat":163.6,"taxId":null,"fullInvoice":false,"items":[{"name":"โต๊ะ","amount":2500.5}]}\n```',
    });
    await page.click('#addBtn');
    await expect(page.locator('#claudeBtn')).toBeDisabled(); // ยังไม่มีรูปให้อ่าน
    await page.setInputFiles('#fileInput', IMG);
    await expect(page.locator('#dlg .field[data-f="total"]')).toHaveClass(/warn/);
    expect(log.ocr).toHaveLength(0);

    await page.click('#claudeBtn');
    // 1) ยกเลิก dialog = ไม่ส่งคำขอ ฟอร์มไม่เปลี่ยน
    const dlg = page.locator('dialog[data-ocrv][open]');
    await expect(dlg).toBeVisible();
    await dlg.locator('[data-k=cancel]').click();
    await expect(page.locator('dialog[data-ocrv]')).toHaveCount(0);
    expect(log.ocr).toHaveLength(0);
    await expect(page.locator('#srcBadge')).toHaveText('ฟรี');
    // 2) กดอีกครั้ง = ถามรหัสใหม่ (ไม่จำ) → ส่ง
    await page.click('#claudeBtn');
    await fillPin(page);
    await expect(page.locator('#fTotal')).toHaveValue('2500.5');
    await expect(page.locator('#fStore')).toHaveValue('ร้านบี สาขา 2');
    await expect(page.locator('#srcBadge')).toHaveText('Claude');
    await expect(page.locator('#dlg .field.warn')).toHaveCount(0);
    expect(log.ocr).toHaveLength(1);
    expect(log.ocr[0].mediaType).toBe('image/jpeg');
    expect(log.ocr[0].imageBase64.length).toBeGreaterThan(10);
    expect(log.ocr[0].prompt).toContain('JSON');
    expect(log.ocr[0].prompt).not.toContain('คุณเป็นระบบถอดข้อความ');

    // ไม่จำตัวเลือก: ใบถัดไป (กล่องใหม่) เริ่มที่ฟรี — Tesseract อ่านอีกรอบ, /api/ocr ยังคง 1 ครั้ง
    await page.click('#cancelBtn');
    await page.click('#addBtn');
    await expect(page.locator('#srcBadge')).toBeHidden();
    await expect(page.locator('#fStore')).toHaveValue('');
    await page.setInputFiles('#fileInput', IMG);
    await expect(page.locator('#srcBadge')).toHaveText('ฟรี');
    await expect(page.locator('#fStore')).toHaveValue('ร้านบี');
    expect(await page.evaluate(() => window.__tess)).toBe(2);
    expect(log.ocr).toHaveLength(1);
  });

  test('Claude ตอบรูปแบบอ่านไม่ได้/ผิดพลาด → แจ้งข้อความ ไม่แก้ฟอร์ม', async ({ page }) => {
    const { log } = await openPage(page, '/receipts.html', { chat: JSON.stringify({ store: 'ร้านบี' }), ocrText: 'x', claude: 'อ่านไม่ออกครับ' });
    await page.click('#addBtn');
    await page.setInputFiles('#fileInput', IMG);
    await expect(page.locator('#fStore')).toHaveValue('ร้านบี');
    await page.click('#claudeBtn');
    await fillPin(page);
    await expect(page.locator('#readMsg')).toContainText('อ่านไม่ได้');
    await expect(page.locator('#fStore')).toHaveValue('ร้านบี');
    await expect(page.locator('#srcBadge')).toHaveText('ฟรี');
    expect(log.ocr).toHaveLength(1);
  });

  test('AI ใช้ไม่ได้ (ไม่มีคลาวด์/ตอบ 500) → regex หายอดรวม+วันที่ · ปุ่ม Claude ซ่อนเมื่อไม่มีคลาวด์', async ({ page }) => {
    const text = 'ร้านซี\nTotal 99.50\n3 ต.ค. 2569';
    const a = await openPage(page, '/receipts.html', { ai: false, ocrText: text });
    await page.click('#addBtn');
    await expect(page.locator('#claudeBtn')).toBeHidden();
    await page.setInputFiles('#fileInput', IMG);
    await expect(page.locator('#fTotal')).toHaveValue('99.5');
    await expect(page.locator('#fDate')).toHaveValue('2026-10-03');
    await expect(page.locator('#fStore')).toHaveValue(''); // regex ไม่เดาชื่อร้าน
    await expect(page.locator('#dlg .field[data-f="store"]')).toHaveClass(/warn/);
    await expect(page.locator('#srcBadge')).toHaveText('ฟรี');
    expect(a.log.chat).toHaveLength(0);

    const p2 = await page.context().newPage();
    const b = await openPage(p2, '/receipts.html', { ai: true, chatStatus: 500, ocrText: text });
    await p2.click('#addBtn');
    await p2.setInputFiles('#fileInput', IMG);
    await expect(p2.locator('#fTotal')).toHaveValue('99.5');
    await expect(p2.locator('#srcBadge')).toHaveText('ฟรี');
    expect(b.log.ocr).toHaveLength(0);
  });

  test('ออฟไลน์ (โหลดตัวอ่านไม่ได้) → แจ้งให้กรอกเอง · กรอกได้ทุกช่องและบันทึกได้ · ไม่มี /api/ocr', async ({ page }) => {
    const { log, errors } = await openPage(page, '/receipts.html', { ai: false, tess: false });
    await page.click('#addBtn');
    await page.setInputFiles('#fileInput', IMG);
    await expect(page.locator('#readMsg')).toContainText('กรอกเอง');
    await expect(page.locator('#dlg .field.warn')).toHaveCount(0);
    await page.fill('#fStore', 'ร้านมือ');
    await page.fill('#fDate', '2026-09-01');
    await page.fill('#fTotal', '120.5');
    await page.fill('#fVat', '7.88');
    await page.fill('#fTaxId', '0-1055-12345-67-8');
    await page.fill('#fItems', 'ปากกา  60\nสมุด  60.5');
    await page.fill('#fNote', 'ของใช้');
    await page.click('#saveBtn');
    await expect(page.locator('#listBody .list-row')).toContainText('ร้านมือ');
    const items = await store(page, 'tanot:receipts:items');
    expect(items[0]).toMatchObject({ store: 'ร้านมือ', date: '2026-09-01', total: 120.5, vat: 7.88, taxId: '0105512345678', note: 'ของใช้', items: [{ name: 'ปากกา', amount: 60 }, { name: 'สมุด', amount: 60.5 }] });
    expect(items[0].source).toBeUndefined();
    expect(log.ocr).toHaveLength(0);
    expect(errors.filter((e) => !/Failed to load|net::ERR/.test(e))).toEqual([]);
  });

  test('ส่งเข้า budget: เพิ่มแถวรูปแบบเดิม 1 รายการ แม้กดซ้ำ/เปิดแก้ใหม่ · เก็บ id ในใบเสร็จ · ไม่แก้โครง budget', async ({ page }) => {
    const rec = { id: 'r1', store: 'ร้านเอ', date: '2026-09-15', total: 1070, categoryId: 'cat-shopping', taxTag: 'none', items: [], files: [], createdAt: 1 };
    const cats = [{ id: 'cat-fuel', name: 'เติมน้ำมัน', type: 'expense' }, { id: 'cat-shopping', name: 'Shopping', type: 'expense' }, { id: 'cat-salary', name: 'เงินเดือน', type: 'income' }];
    const old = { id: 'old1', date: '2026-09-01', type: 'expense', categoryId: 'cat-fuel', amount: 50, note: 'เดิม' };
    const { errors } = await openPage(page, '/receipts.html', { data: { items: [rec], budget: [old], cats } });
    await page.locator('#listBody [data-act="edit"]').click();
    await expect(page.locator('#fCat option')).toHaveText(['เติมน้ำมัน', 'Shopping']); // เฉพาะหมวดรายจ่ายของ budget
    await page.selectOption('#fCat', 'cat-fuel');
    // กดซ้ำติดกันในรอบเดียว
    await page.evaluate(() => { const b = document.getElementById('budgetBtn'); b.click(); b.click(); });
    await expect(page.locator('#dlg')).not.toHaveAttribute('open', '');
    let budget = await store(page, 'budget:records');
    expect(budget).toHaveLength(2);
    expect(budget[0]).toEqual(old);
    expect(Object.keys(budget[1]).sort()).toEqual(['amount', 'categoryId', 'date', 'id', 'note', 'type']);
    expect(budget[1]).toMatchObject({ date: '2026-09-15', type: 'expense', categoryId: 'cat-fuel', amount: 1070, note: 'ร้านเอ' });
    const items = await store(page, 'tanot:receipts:items');
    expect(items[0].budgetId).toBe(budget[1].id);
    await expect(page.locator('#listBody [data-b="budget"]')).toBeVisible();

    // เปิดแก้ใหม่: ปุ่มกดไม่ได้อีก · บันทึกฟอร์มซ้ำก็ไม่เพิ่ม
    await page.locator('#listBody [data-act="edit"]').click();
    await expect(page.locator('#budgetBtn')).toBeDisabled();
    await page.fill('#fTotal', '2000'); // แก้ยอดทีหลัง → รายการ budget เดิมไม่ถูกแตะ
    await page.click('#saveBtn');
    budget = await store(page, 'budget:records');
    expect(budget).toHaveLength(2);
    expect(budget[1].amount).toBe(1070);
    expect((await store(page, 'tanot:receipts:items'))[0]).toMatchObject({ total: 2000, budgetId: budget[1].id });
    expect(errors).toEqual([]);
  });

  test('ไม่มีหมวดใน budget (ยังไม่เคยเปิดหน้า) → ใช้หมวดเริ่มต้นเหมือน quick-add · ไม่มียอด = ส่งเข้า budget ไม่ได้', async ({ page }) => {
    await openPage(page, '/receipts.html');
    await page.click('#addBtn');
    await expect(page.locator('#fCat')).toHaveValue('cat-shopping');
    await page.fill('#fStore', 'ร้านไม่มียอด');
    await page.click('#budgetBtn');
    await expect(page.locator('#msg')).toContainText('ยอดรวม');
    expect(await store(page, 'budget:records')).toBeNull();
  });

  test('ประกันสินค้า: ชื่อ+เดือน → วันหมด → ป้ายในรายการ + reminders (30 วันก่อน+วันหมด 08:00 ไทย) ไป /api/push/reminders + กรอง "มีประกัน" · การ์ดหน้าวันนี้', async ({ page, request }) => {
    const { log, errors } = await openPage(page, '/receipts.html', { push: true, files: false });
    await page.click('#addBtn');
    await page.fill('#fStore', 'iStudio');
    await page.fill('#fDate', '2025-11-20');
    await page.fill('#fTotal', '30000');
    await page.fill('#fProduct', 'โน้ตบุ๊ก');
    await page.fill('#fMonths', '12');
    await expect(page.locator('#fEnd')).toHaveValue('20 พ.ย. 2569');
    await page.click('#saveBtn');
    await page.click('#addBtn');
    await page.fill('#fStore', 'ร้านไม่มีประกัน');
    await page.fill('#fTotal', '10');
    await page.click('#saveBtn');
    await expect(page.locator('#listBody .list-row')).toHaveCount(2);
    await expect(page.locator('#listBody [data-b="war"]')).toHaveText('ประกันอีก 51 วัน');
    await expect(page.locator('#kpis')).toContainText('ประกันใกล้หมด');

    await expect.poll(() => log.posts.filter((p) => p.scope === 'receipts').length).toBeGreaterThan(0);
    const last = log.posts.filter((p) => p.scope === 'receipts').pop();
    expect(last.items).toHaveLength(2);
    const id = (await store(page, 'tanot:receipts:items')).find((r) => r.store === 'iStudio').id;
    expect(last.items.map((i) => [i.id, i.due_at, i.kind, i.url]).sort()).toEqual([
      [id + ':2026-11-20:0', Date.UTC(2026, 10, 20, 1, 0), 'push', 'receipts.html'],
      [id + ':2026-11-20:30', Date.UTC(2026, 9, 21, 1, 0), 'push', 'receipts.html'],
    ].sort());
    const stored = (await (await request.get(SRV + '/__push')).json()).reminders.filter((i) => i.id.startsWith('receipts:'));
    expect(stored).toHaveLength(2);

    // กรอง: มีประกัน / ค้นหาร้าน / ปี / ป้าย
    await page.click('#fWar');
    await expect(page.locator('#listBody .list-row')).toHaveCount(1);
    await page.click('#fWar');
    await page.fill('#fQ', 'ไม่มีประกัน');
    await expect(page.locator('#listBody .list-row')).toHaveCount(1);
    await expect(page.locator('#listBody .list-row')).toContainText('ร้านไม่มีประกัน');
    await page.fill('#fQ', '');
    await page.selectOption('#fYear', '2025');
    await expect(page.locator('#listBody .list-row')).toHaveCount(1);
    await expect(page.locator('#listBody .list-row')).toContainText('iStudio');
    await page.selectOption('#fTag', 'donation');
    await expect(page.locator('#listBody')).toContainText('ไม่พบใบเสร็จ');

    // ลบใบเสร็จ → reminders ชุดใหม่ไม่มี
    await page.selectOption('#fTag', 'all'); await page.selectOption('#fYear', '');
    await page.locator('#listBody .list-row', { hasText: 'iStudio' }).locator('[data-act="edit"]').click();
    await confirmDelete(page);
    await expect.poll(() => log.posts.filter((p) => p.scope === 'receipts').pop().items.length).toBe(0);
    expect(errors).toEqual([]);
  });

  test('หน้าวันนี้ "ต้องทำวันนี้": ไม่มีใบเสร็จที่ระบุประกัน = ไม่ขึ้น · ขึ้นเฉพาะที่หมดภายใน 30 วัน เรียงใกล้สุดก่อน', async ({ page }) => {
    const war = (p) => p.locator('#todoBody .todo-row[data-kind="war"]');
    await openPage(page, '/index.html');
    await page.waitForSelector('#todoBody > *');
    await expect(war(page)).toHaveCount(0);
    const p2 = await page.context().newPage();
    const items = [
      { id: 'a', store: 'iStudio', date: '2025-11-20', warrantyMonths: 12, warrantyProduct: 'โน้ตบุ๊ก' }, // 51 วัน — ยังไม่ขึ้น
      { id: 'b', store: 'Big C', date: '2025-10-05', warrantyMonths: 12, warrantyProduct: 'พัดลม' },     // 5 วัน
      { id: 'f', store: 'Power Buy', date: '2025-10-25', warrantyMonths: 12, warrantyProduct: 'ทีวี' },   // 25 วัน
      { id: 'c', store: 'Home Pro', date: '2026-01-01', warrantyMonths: 36, warrantyProduct: 'ตู้เย็น' }, // ไกล
      { id: 'd', store: 'Old', date: '2024-01-01', warrantyMonths: 12, warrantyProduct: 'หมดแล้ว' },
    ];
    await openPage(p2, '/index.html', { data: { items } });
    await p2.waitForSelector('#todoBody > *');
    const rows = war(p2);
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('พัดลม');
    await expect(rows.nth(0).locator('.pill')).toHaveText('อีก 5 วัน');
    await expect(rows.nth(1)).toContainText('ทีวี');
    await expect(rows.nth(1).locator('.pill')).toHaveText('อีก 25 วัน');
    await expect(p2.locator('#todoBody')).not.toContainText('โน้ตบุ๊ก');
    const p3 = await page.context().newPage();
    await openPage(p3, '/index.html', { data: { items: [items[3]] } });
    await p3.waitForSelector('#todoBody > *');
    await expect(war(p3)).toHaveCount(0);
  });

  test('ป้ายลดหย่อนภาษี → สรุปต่อปี → หน้าภาษีเติมช่องที่ตรงกัน (พิมพ์ทับได้) · ปีที่กฎเป็น null ไม่เติม', async ({ page }) => {
    const items = [
      { id: 'a', store: 'ร้าน A', date: '2025-12-20', total: 3000, taxTag: 'eReceipt' },
      { id: 'b', store: 'ร้าน B', date: '2025-03-01', total: 500, taxTag: 'eReceipt' },
      { id: 'c', store: 'มูลนิธิ', date: '2026-03-01', total: 5000, taxTag: 'donation' },
      { id: 'd', store: 'ร้าน D', date: '2026-02-01', total: 999, taxTag: 'eReceipt' }, // ปี 2569: กฎ eReceipt เป็น null
      { id: 'e', store: 'ร้าน E', date: '2026-02-02', total: 700, taxTag: 'none' },
    ];
    const { errors } = await openPage(page, '/receipts.html', { data: { items } });
    expect(await store(page, 'tanot:receipts:taxsummary')).toMatchObject({ v: 1, years: { 2025: { eReceipt: 3500 }, 2026: { eReceipt: 999, donation: 5000 } } });
    await expect(page.locator('#kpis')).toContainText('฿5,999'); // ป้ายลดหย่อนปีนี้ (2026)
    await page.goto('/tax.html', { waitUntil: 'load' });
    await page.waitForSelector('#txKpi .kpi');
    await expect(page.locator('#txYear [aria-pressed="true"]')).toContainText('2569');
    await expect(page.locator('#tx_donation')).toHaveAttribute('placeholder', '5,000');
    await expect(page.locator('[data-src="donation"]')).toHaveText('ใบเสร็จ');
    await expect(page.locator('#tx_eReceipt')).toHaveCount(0);
    await page.click('#txYear [data-year="2568"]');
    await expect(page.locator('#tx_eReceipt')).toHaveAttribute('placeholder', '3,500');
    await expect(page.locator('[data-src="eReceipt"]')).toBeVisible();
    await expect(page.locator('#tx_donation')).toHaveAttribute('placeholder', '0');
    await page.fill('#tx_eReceipt', '1000');
    await expect(page.locator('[data-src="eReceipt"]')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('ดูรูปเต็ม + ลบใบเสร็จเรียก DELETE ไฟล์ R2 (รายการ budget ที่สร้างแล้วไม่ถูกลบ) · ยกเลิกกล่องลบไฟล์ที่เพิ่งอัปโหลด', async ({ page, request }) => {
    const { log } = await openPage(page, '/receipts.html', { chat: AI_FULL, ocrText: 'x' });
    await page.click('#addBtn');
    await page.setInputFiles('#fileInput', IMG);
    await expect(page.locator('#fileList .file-row')).toHaveCount(1);
    await expect.poll(async () => (await (await request.get(SRV + '/__files')).json()).length).toBe(1);
    // ยกเลิก → ไฟล์กำพร้าถูกลบ
    await page.click('#cancelBtn');
    await expect.poll(async () => (await (await request.get(SRV + '/__files')).json()).length).toBe(0);
    expect(log.del).toHaveLength(1);

    await page.click('#addBtn');
    await page.setInputFiles('#fileInput', IMG);
    await expect(page.locator('#fileList .file-row')).toHaveCount(1);
    await page.click('#budgetBtn'); // บันทึก + ส่งเข้า budget
    const row = page.locator('#listBody .list-row');
    await expect(row).toHaveCount(1);
    expect(await (await request.get(SRV + '/__files')).json()).toHaveLength(1);

    await row.locator('[data-act="view"]').click();
    await expect(page.locator('#viewDlg img')).toHaveCount(1);
    await expect(page.locator('#viewDlg img')).toHaveAttribute('src', /\/api\/files\?id=/);
    await expect.poll(() => page.evaluate(() => document.querySelector('#viewDlg img').complete && document.querySelector('#viewDlg img').naturalWidth)).toBeGreaterThan(0);
    await page.click('#viewClose');

    log.del.length = 0;
    await row.locator('[data-act="edit"]').click();
    await confirmDelete(page, false); // ยกเลิก = ไม่ลบอะไร กล่องแก้ไขยังเปิดอยู่
    await expect(page.locator('#dlg')).toHaveAttribute('open', '');
    expect(log.del).toHaveLength(0);
    expect(await store(page, 'tanot:receipts:items')).toHaveLength(1);
    await confirmDelete(page);
    await expect(page.locator('#listBody')).toContainText('ยังไม่มีใบเสร็จ');
    await expect.poll(() => log.del.length).toBe(1);
    await expect.poll(async () => (await (await request.get(SRV + '/__files')).json()).length).toBe(0);
    expect(await store(page, 'budget:records')).toHaveLength(1); // ไม่ลบรายการ budget อัตโนมัติ
    expect(await store(page, 'tanot:receipts:items')).toEqual([]);
  });

  test('ลบรูปที่แนบแล้วในกล่อง → ลบจาก R2 ตอนกดบันทึกเท่านั้น', async ({ page, request }) => {
    const { log } = await openPage(page, '/receipts.html', { chat: AI_FULL, ocrText: 'x' });
    await page.click('#addBtn');
    await page.setInputFiles('#fileInput', IMG);
    await expect(page.locator('#fileList .file-row')).toHaveCount(1);
    await page.click('#saveBtn');
    await page.locator('#listBody [data-act="edit"]').click();
    await page.locator('#fileList [data-rm]').click();
    expect(log.del).toHaveLength(0);
    expect(await (await request.get(SRV + '/__files')).json()).toHaveLength(1);
    await page.click('#saveBtn');
    await expect.poll(() => log.del.length).toBe(1);
    await expect.poll(async () => (await (await request.get(SRV + '/__files')).json()).length).toBe(0);
    expect((await store(page, 'tanot:receipts:items'))[0].files).toEqual([]);
  });

  test('มือถือ 390px: ไม่ล้นแนวนอน ทั้งสองธีม พร้อมข้อมูล', async ({ page }) => {
    const items = [{ id: 'a', store: 'ร้านที่มีชื่อยาวมากๆ มากๆ มากๆ มากๆ มากๆ', date: '2026-09-15', total: 12345.5, taxTag: 'eReceiptOtop', warrantyMonths: 12, warrantyProduct: 'ทีวี', budgetId: 'x', items: [{ name: 'ทีวีจอใหญ่ มากๆ รุ่นใหม่ล่าสุด' }], files: [{ id: 'f', name: 'a.jpg', size: 1000, mime: 'image/jpeg' }] }];
    for (const theme of ['light', 'dark']) {
      const p = await page.context().newPage();
      await openPage(p, '/receipts.html', { data: { items }, theme, width: 390 });
      await expect(p.locator('#listBody .list-row')).toHaveCount(1);
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await p.click('#addBtn');
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await p.close();
    }
  });
});

test.describe('ซิงก์ 2 เครื่อง', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('คนละใบเสร็จไม่ทับกัน · แก้/ลบแล้วอีกเครื่องเห็น · ส่งเข้า budget จาก 2 เครื่องได้แถวเดียว', async ({ browser }) => {
    const mk = async () => {
      const ctx = await browser.newContext({ baseURL: SRV });
      const page = await ctx.newPage();
      const o = await openPage(page, '/receipts.html', { sync: true });
      return { ctx, page, errors: o.errors };
    };
    const A = await mk(), B = await mk();
    const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));
    const add = async (p, name, total) => {
      await p.click('#addBtn'); await p.fill('#fStore', name); await p.fill('#fDate', '2026-09-10'); await p.fill('#fTotal', String(total)); await p.click('#saveBtn');
    };
    await add(A.page, 'ร้านเครื่อง A', 100); await add(B.page, 'ร้านเครื่อง B', 200);
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    for (const d of [A, B]) {
      const items = await store(d.page, 'tanot:receipts:items');
      expect(items.map((r) => r.store).sort()).toEqual(['ร้านเครื่อง A', 'ร้านเครื่อง B']);
      expect(new Set(items.map((r) => r.id)).size).toBe(2);
      expect(d.errors).toEqual([]);
    }
    await expect(A.page.locator('#listBody .list-row')).toHaveCount(2); // วาดใหม่เองโดยไม่ต้องโหลดซ้ำ

    // ทั้งสองเครื่องส่งใบเสร็จ A เข้า budget → แถวเดียว (id ตายตัวต่อใบเสร็จ)
    for (const d of [A, B]) {
      await d.page.locator('#listBody .list-row', { hasText: 'ร้านเครื่อง A' }).locator('[data-act="edit"]').click();
      await d.page.click('#budgetBtn');
    }
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    for (const d of [A, B]) {
      const budget = await store(d.page, 'budget:records');
      expect(budget).toHaveLength(1);
      expect(budget[0]).toMatchObject({ type: 'expense', amount: 100, note: 'ร้านเครื่อง A' });
    }

    // ลบที่เครื่อง A → เครื่อง B เห็นหาย
    // นาฬิกาในเทสต์ถูกตรึงที่ NOW — ซิงก์เป็น last-write-wins ตาม updated_at (= Date.now() ของเครื่อง) ถ้าไม่ขยับเวลา tombstone ของ A
    // จะได้เวลาเท่ากับแถวที่ B สร้าง แล้วเซิร์ฟเวอร์ตัดสินด้วยชื่อ device ที่สุ่ม (A แพ้ครึ่งหนึ่ง → แถวถูกส่งกลับมาทั้ง 2 เครื่อง)
    await A.page.clock.setFixedTime(new Date(NOW.getTime() + 60000));
    await A.page.locator('#listBody .list-row', { hasText: 'ร้านเครื่อง B' }).locator('[data-act="edit"]').click();
    await confirmDelete(A.page);
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    expect((await store(B.page, 'tanot:receipts:items')).map((r) => r.store)).toEqual(['ร้านเครื่อง A']);
    await A.ctx.close(); await B.ctx.close();
  });
});
