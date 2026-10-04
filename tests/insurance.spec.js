// @ts-check
// ทะเบียนกรมธรรม์ (insurance.html / insurance-calc.js / functions/api/files.js) + การ์ดต่ออายุบนหน้าวันนี้ — ROADMAP Phase 6 ชีวิต P1
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');

const C = require(path.join(__dirname, '..', 'insurance-calc.js'));
const SRV = 'http://localhost:8127';
const NOW = new Date('2026-09-30T10:30:00+07:00');
// ทั้งไฟล์ใช้เซิร์ฟเวอร์เดียวที่มี /__reset ล้าง D1+R2 — ห้ามให้ describe ต่างกลุ่มรันขนานกัน
test.describe.configure({ mode: 'serial' });
const at = (s) => new Date(s + 'T12:00:00'); // เวลาท้องถิ่น ไม่ผูกกับ timezone ของเครื่อง

test.describe('insurance-calc.js (known-answer)', () => {
  test('addMonths: วันสิ้นเดือนถอยเป็นวันสุดท้ายของเดือนปลายทาง', () => {
    expect(C.addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(C.addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(C.addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(C.addMonths('2026-12-15', 12)).toBe('2027-12-15');
    expect(C.addMonths('ไม่ใช่วันที่', 1)).toBe('');
    expect(C.addMonths('2026-02-31', 1)).toBe('');
  });

  test('daysUntil: นับจากวันนี้ ลบ = เลยกำหนด', () => {
    const now = at('2026-09-30');
    expect(C.daysUntil('2026-10-30', now)).toBe(30);
    expect(C.daysUntil('2026-09-30', now)).toBe(0);
    expect(C.daysUntil('2026-09-29', now)).toBe(-1);
    expect(C.daysUntil('', now)).toBeNull();
  });

  test('annualPremium: คูณตามความถี่การจ่าย', () => {
    expect(C.annualPremium({ premium: 1500, freq: 'month' })).toBe(18000);
    expect(C.annualPremium({ premium: 5000, freq: 'quarter' })).toBe(20000);
    expect(C.annualPremium({ premium: 9000, freq: 'half' })).toBe(18000);
    expect(C.annualPremium({ premium: 12000, freq: 'year' })).toBe(12000);
    expect(C.annualPremium({ premium: -5, freq: 'year' })).toBe(0);
  });

  test('premiumInYear: นับงวดที่ตกในปีตามตารางจ่าย (ไม่หารสัดส่วน)', () => {
    expect(C.premiumInYear({ premium: 1000, freq: 'month', startDate: '2026-10-15' }, 2026)).toBe(3000); // ต.ค. พ.ย. ธ.ค.
    expect(C.premiumInYear({ premium: 12000, freq: 'year', startDate: '2026-10-15' }, 2026)).toBe(12000); // งวดแรกคือวันเริ่ม
    expect(C.premiumInYear({ premium: 12000, freq: 'year', startDate: '2026-10-15' }, 2027)).toBe(12000);
    expect(C.premiumInYear({ premium: 12000, freq: 'year', startDate: '2026-10-15' }, 2025)).toBe(0);
    expect(C.premiumInYear({ premium: 12000, freq: 'year', startDate: '2020-01-01', endDate: '2025-12-31' }, 2026)).toBe(0);
    expect(C.premiumInYear({ premium: 1000, freq: 'month', startDate: '2026-01-01', endDate: '2026-03-31' }, 2026)).toBe(3000);
    expect(C.premiumInYear({ premium: 50000, freq: 'single', startDate: '2025-06-01' }, 2026)).toBe(0);
    expect(C.premiumInYear({ premium: 50000, freq: 'single', startDate: '2026-06-01' }, 2026)).toBe(50000);
    expect(C.premiumInYear({ premium: 8000, freq: 'year' }, 2026)).toBe(8000); // ไม่มีวันเริ่ม = ครบปี
  });

  test('taxSummary: เพดานชีวิต 100,000 / สุขภาพ 25,000 / รวมกัน 100,000 / พ่อแม่ 15,000 / คู่สมรส 10,000 / บำนาญ 200,000 หรือ 15% ของเงินได้', () => {
    const P = (type, premium, extra) => Object.assign({ id: type + premium, type, premium, freq: 'year' }, extra);
    // ชีวิต 120,000 + สุขภาพ 30,000 → สุขภาพ 25,000 + ชีวิต 75,000 (รวมไม่เกิน 100,000)
    let s = C.taxSummary([P('life', 120000), P('health', 30000)], 2026);
    expect(s.raw).toMatchObject({ life: 120000, health: 30000 });
    expect(s.ded).toMatchObject({ health: 25000, life: 75000, total: 100000 });
    // ไม่ชนเพดานรวม
    s = C.taxSummary([P('life', 60000), P('health', 20000)], 2026);
    expect(s.ded.total).toBe(80000);
    // หมวดอื่น
    s = C.taxSummary([P('health', 20000, { taxCat: 'parentsHealth' }), P('life', 12000, { taxCat: 'spouseLife' })], 2026);
    expect(s.ded).toMatchObject({ parentsHealth: 15000, spouseLife: 10000, total: 25000 });
    // บำนาญ: ไม่ระบุเงินได้ = เพดาน 200,000; ระบุเงินได้ 1,000,000 → 15% = 150,000
    const ann = [P('life', 300000, { taxCat: 'annuity' })];
    expect(C.taxSummary(ann, 2026).ded.annuity).toBe(200000);
    expect(C.taxSummary(ann, 2026, { income: 1000000 })).toMatchObject({ annuityCap: 150000, ded: { annuity: 150000 } });
    // ประกันรถ/บ้านไม่ลดหย่อน; สัญญาต่ำกว่า 10 ปีไม่ลดหย่อนเบี้ยชีวิต แต่สุขภาพไม่ติดเงื่อนไขนี้
    s = C.taxSummary([P('car', 20000), P('home', 5000), P('life', 40000, { longTerm: false }), P('health', 9000, { longTerm: false })], 2026);
    expect(s.ded).toMatchObject({ life: 0, health: 9000, total: 9000 });
  });

  test('renewals: ภายใน N วัน รวมที่เลยกำหนด เรียงใกล้สุดก่อน ข้ามที่สิ้นสุดแล้ว/ไม่มีวัน', () => {
    const now = at('2026-09-30');
    const list = [
      { id: 'a', renewDate: '2026-11-20' }, // 51 วัน
      { id: 'b', renewDate: '2026-09-25' }, // เลย 5 วัน
      { id: 'c', renewDate: '2027-03-01' }, // ไกล
      { id: 'd', renewDate: '2026-10-10', endDate: '2026-09-01' }, // สิ้นสุดแล้ว
      { id: 'e' },
      { id: 'f', renewDate: '2026-10-01' },
    ];
    expect(C.renewals(list, now, 60).map((r) => [r.policy.id, r.days])).toEqual([['b', -5], ['f', 1], ['a', 51]]);
  });

  test('advanceRenewal: เลื่อนตามความถี่ จ่ายครั้งเดียว/ไม่มีวันคืนค่าว่าง', () => {
    expect(C.advanceRenewal({ freq: 'year', renewDate: '2026-12-01' })).toBe('2027-12-01');
    expect(C.advanceRenewal({ freq: 'month', renewDate: '2026-01-31' })).toBe('2026-02-28');
    expect(C.advanceRenewal({ freq: 'single', renewDate: '2026-12-01' })).toBe('');
    expect(C.advanceRenewal({ freq: 'year' })).toBe('');
  });
});

test.describe('API /api/files', () => {
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });
  const up = (request, qs, type, data, headers) =>
    request.post(SRV + '/api/files?' + qs, { data, headers: Object.assign({ 'Content-Type': type }, headers || {}) });

  test('อัปโหลด → ดาวน์โหลดได้ไบต์เดิม + header ปลอดภัย → ลบแล้ว 404 และหายจาก R2', async ({ request }) => {
    const body = Buffer.from('%PDF-1.4 ทดสอบ');
    const res = await up(request, 'ns=insurance&ref=p1&name=' + encodeURIComponent('กรมธรรม์ ชีวิต.pdf'), 'application/pdf', body);
    expect(res.status()).toBe(200);
    const meta = await res.json();
    expect(meta).toMatchObject({ name: 'กรมธรรม์ ชีวิต.pdf', size: body.length, mime: 'application/pdf' });
    expect(await (await request.get(SRV + '/__files')).json()).toEqual(['insurance/' + meta.id]);

    const got = await request.get(SRV + '/api/files?id=' + meta.id);
    expect(got.status()).toBe(200);
    expect(Buffer.from(await got.body()).equals(body)).toBe(true);
    expect(got.headers()['content-type']).toBe('application/pdf');
    expect(got.headers()['x-content-type-options']).toBe('nosniff');
    expect(got.headers()['content-security-policy']).toBe('sandbox');
    expect(got.headers()['content-disposition']).toContain('inline');
    expect(decodeURIComponent(got.headers()['content-disposition'])).toContain('กรมธรรม์ ชีวิต.pdf');
    expect((await request.get(SRV + '/api/files?id=' + meta.id + '&download=1')).headers()['content-disposition']).toContain('attachment');

    expect((await request.delete(SRV + '/api/files?id=' + meta.id)).status()).toBe(200);
    expect((await request.get(SRV + '/api/files?id=' + meta.id)).status()).toBe(404);
    expect(await (await request.get(SRV + '/__files')).json()).toEqual([]);
    expect((await request.delete(SRV + '/api/files?id=' + meta.id)).status()).toBe(404);
  });

  test('ปฏิเสธ: ชนิดไฟล์นอก allowlist, ns ผิด, ไม่มี ref, ไฟล์ว่าง, เกิน 15 MB, Origin ต่างเว็บ', async ({ request }) => {
    const ok = Buffer.from('x');
    expect((await up(request, 'ns=insurance&ref=p1&name=a.html', 'text/html', ok)).status()).toBe(415);
    expect((await up(request, 'ns=insurance&ref=p1&name=a.svg', 'image/svg+xml', ok)).status()).toBe(415);
    expect((await up(request, 'ns=other&ref=p1&name=a.pdf', 'application/pdf', ok)).status()).toBe(400);
    expect((await up(request, 'ns=insurance&name=a.pdf', 'application/pdf', ok)).status()).toBe(400);
    expect((await up(request, 'ns=insurance&ref=p1&name=a.pdf', 'application/pdf', Buffer.alloc(0))).status()).toBe(400);
    expect((await up(request, 'ns=insurance&ref=p1&name=big.pdf', 'application/pdf', Buffer.alloc(15 * 1024 * 1024 + 1))).status()).toBe(413);
    expect((await up(request, 'ns=insurance&ref=p1&name=a.pdf', 'application/pdf', ok, { Origin: 'https://evil.example' })).status()).toBe(403);
    expect((await request.delete(SRV + '/api/files?id=x', { headers: { Origin: 'https://evil.example' } })).status()).toBe(403);
    expect(await (await request.get(SRV + '/__files')).json()).toEqual([]); // ที่ถูกปฏิเสธไม่ทิ้งไฟล์ใน R2
  });

  test('ชื่อไฟล์ที่มีตัวคั่นพาธไม่กระทบ key ใน R2', async ({ request }) => {
    const meta = await (await up(request, 'ns=insurance&ref=p1&name=' + encodeURIComponent('../../etc/passwd'), 'image/png', Buffer.from('png'))).json();
    expect(meta.name).not.toContain('/');
    const keys = await (await request.get(SRV + '/__files')).json();
    expect(keys).toEqual(['insurance/' + meta.id]);
  });
});

/** กรมธรรม์จำลอง (วันนี้ = 2026-09-30) */
function seed() {
  const policies = [
    { id: 'p-life', type: 'life', insurer: 'ไทยประกันชีวิต', name: 'ชีวิต 20/10', policyNo: 'L-001', sumInsured: 1000000, premium: 60000, freq: 'year', startDate: '2020-11-20', renewDate: '2026-11-20', taxCat: 'life', longTerm: true, files: [] },
    { id: 'p-health', type: 'health', insurer: 'เมืองไทย', name: 'สุขภาพ ผู้ป่วยใน', premium: 30000, freq: 'year', startDate: '2022-01-01', renewDate: '2026-10-10', taxCat: 'health', files: [] },
    { id: 'p-car', type: 'car', insurer: 'วิริยะ', name: 'ชั้น 1', insured: '1กข 1234', premium: 15000, freq: 'year', startDate: '2025-09-20', renewDate: '2026-09-25', taxCat: 'none', files: [] },
    { id: 'p-home', type: 'home', insurer: 'ทิพยประกันภัย', name: 'อัคคีภัย', premium: 3000, freq: 'year', startDate: '2024-05-01', renewDate: '2027-05-01', taxCat: 'none', files: [] },
  ];
  localStorage.setItem('tanot:insurance:policies', JSON.stringify(policies));
}

async function openPage(page, p, { withData = true, theme = 'light', width = 1100, files = false } = {}) {
  const errors = await prepare(page, { theme });
  if (withData) await page.addInitScript(seed);
  if (files) await page.addInitScript(() => { window.TANOT_FILES = { enabled: true }; });
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(p, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return errors;
}

test.describe('หน้า insurance.html', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('ทะเบียน: เรียงตามวันต่ออายุ, ป้ายเลยกำหนด/ใกล้ถึง, KPI, ตารางลดหย่อน', async ({ page }) => {
    const errors = await openPage(page, '/insurance.html');
    const rows = page.locator('#listBody .list-row');
    await expect(rows).toHaveCount(4);
    // เลยกำหนด (รถ −5 วัน) → สุขภาพ 10 วัน → ชีวิต 51 วัน → บ้านไกลสุด
    await expect(rows.nth(0)).toContainText('วิริยะ');
    await expect(rows.nth(0)).toContainText('เลยกำหนด 5 วัน');
    await expect(rows.nth(1)).toContainText('เมืองไทย');
    await expect(rows.nth(1)).toContainText('อีก 10 วัน');
    await expect(rows.nth(2)).toContainText('อีก 51 วัน');
    await expect(rows.nth(3)).toContainText('ทิพยประกันภัย');

    const kpis = page.locator('#kpis');
    await expect(kpis).toContainText('คุ้มครองอยู่');
    await expect(kpis).toContainText('4');
    await expect(kpis).toContainText('฿108,000'); // 60,000 + 30,000 + 15,000 + 3,000
    await expect(kpis).toContainText('3'); // ต่ออายุใน 60 วัน: รถ, สุขภาพ, ชีวิต

    // ชีวิต 60,000 + สุขภาพ 30,000 → สุขภาพ 25,000 + ชีวิต 60,000 = 85,000
    await expect(page.locator('#taxBody tr[data-cat="health"]')).toContainText('฿25,000');
    await expect(page.locator('#taxBody tr[data-cat="life"]')).toContainText('฿60,000');
    await expect(page.locator('#taxTotal')).toHaveText('฿85,000');

    // กรองตามประเภท
    await page.locator('#typeFilter [data-type="car"]').click();
    await expect(rows).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('จ่ายแล้ว: เลื่อนวันต่ออายุไปงวดถัดไป + เขียนสรุปเบี้ยลดหย่อนให้หน้าภาษี', async ({ page }) => {
    await openPage(page, '/insurance.html');
    const carRow = page.locator('#listBody .list-row[data-id="p-car"]');
    await carRow.locator('[data-act="advance"]').click();
    await expect(carRow).toContainText('25 ก.ย. 2570'); // 2027-09-25 (เกิน 60 วัน แสดงเป็นวันที่)
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:insurance:policies')).find((p) => p.id === 'p-car').renewDate);
    expect(stored).toBe('2027-09-25');

    const sum = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:insurance:taxsummary')));
    expect(sum.v).toBe(1);
    expect(sum.years['2026'].ded).toMatchObject({ health: 25000, life: 60000, total: 85000 });
    expect(sum.years['2026'].raw).toMatchObject({ life: 60000, health: 30000 });
    expect(Object.keys(sum.years)).toEqual(['2025', '2026', '2027']);
  });

  test('เพิ่ม → แก้ → ลบ กรมธรรม์ผ่านกล่องโต้ตอบ', async ({ page }) => {
    const errors = await openPage(page, '/insurance.html', { withData: false });
    await expect(page.locator('#listBody .empty')).toContainText('ยังไม่มีกรมธรรม์');
    expect(await page.evaluate(() => localStorage.getItem('tanot:insurance:taxsummary'))).toBeNull(); // เปิดหน้าเปล่าไม่เขียนอะไร

    await page.locator('#addBtn').click();
    await page.locator('#saveBtn').click();
    await expect(page.locator('#msg')).toContainText('ใส่ชื่อบริษัท');
    await page.selectOption('#fType', 'health');
    await expect(page.locator('#fTaxCat')).toHaveValue('health'); // ค่าเริ่มต้นตามประเภท
    await page.fill('#fInsurer', 'AIA');
    await page.fill('#fName', 'Health Happy');
    await page.fill('#fPremium', '20000');
    await page.selectOption('#fFreq', 'year');
    await page.fill('#fStart', '2026-03-01');
    await page.fill('#fRenew', '2027-03-01');
    await page.locator('#saveBtn').click();
    await expect(page.locator('#dlg')).not.toHaveAttribute('open', '');
    const row = page.locator('#listBody .list-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('AIA · Health Happy');
    await expect(page.locator('#taxTotal')).toHaveText('฿20,000');

    // รถ/บ้านไม่มีช่องลดหย่อน
    await row.locator('[data-act="edit"]').click();
    await page.selectOption('#fType', 'car');
    await expect(page.locator('#taxRow')).toBeHidden();
    await page.locator('#saveBtn').click();
    await expect(page.locator('#taxBody .empty')).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await row.locator('[data-act="edit"]').click();
    await page.locator('#delBtn').click();
    await expect(page.locator('#listBody .empty')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:insurance:policies')))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('ไฟล์กรมธรรม์: แนบ → บันทึก → เปิดดูได้ → เอาออกแล้วหายจาก R2; ยกเลิกกล่องลบไฟล์ที่เพิ่งแนบ', async ({ page, request }) => {
    const errors = await openPage(page, '/insurance.html', { files: true });
    const keys = async () => (await request.get(SRV + '/__files')).json();
    const pdf = { name: 'policy.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') };

    await page.locator('#listBody .list-row[data-id="p-life"] [data-act="edit"]').click();
    await expect(page.locator('#filesRow')).toBeVisible();
    await page.setInputFiles('#fileInput', pdf);
    await expect(page.locator('#fileList .file-row')).toHaveCount(1);
    expect(await keys()).toHaveLength(1);
    await page.locator('#cancelBtn').click(); // ยกเลิก → ไฟล์กำพร้าถูกลบ
    await expect.poll(keys).toEqual([]);

    await page.locator('#listBody .list-row[data-id="p-life"] [data-act="edit"]').click();
    await page.setInputFiles('#fileInput', pdf);
    await expect(page.locator('#fileList .file-row')).toHaveCount(1);
    await page.locator('#saveBtn').click();
    await expect(page.locator('#listBody .list-row[data-id="p-life"]')).toContainText('1'); // ป้ายจำนวนไฟล์
    const keptKeys = await keys();
    expect(keptKeys).toHaveLength(1);
    const fid = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:insurance:policies')).find((p) => p.id === 'p-life').files[0].id);
    expect(keptKeys[0]).toBe('insurance/' + fid);
    const got = await request.get(SRV + '/api/files?id=' + fid);
    expect((await got.body()).toString()).toBe('%PDF-1.4 test');

    // เอาออก: ยังไม่ลบจริงจนกว่าจะกดบันทึก
    await page.locator('#listBody .list-row[data-id="p-life"] [data-act="edit"]').click();
    await page.locator('#fileList [data-rm]').click();
    await expect(page.locator('#fileList .file-row')).toHaveCount(0);
    expect(await keys()).toHaveLength(1);
    await page.locator('#saveBtn').click();
    await expect.poll(keys).toEqual([]);

    // ไฟล์ผิดชนิดแสดงข้อความ ไม่พัง
    await page.locator('#listBody .list-row[data-id="p-life"] [data-act="edit"]').click();
    await page.setInputFiles('#fileInput', { name: 'a.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('x') });
    await expect(page.locator('#msg')).toContainText('PDF');
    expect(errors.filter((e) => !/415/.test(e))).toEqual([]);
  });

  test('ลบกรมธรรม์ → ไฟล์แนบถูกลบจาก R2 ด้วย', async ({ page, request }) => {
    await openPage(page, '/insurance.html', { files: true });
    await page.locator('#listBody .list-row[data-id="p-home"] [data-act="edit"]').click();
    await page.setInputFiles('#fileInput', { name: 'h.png', mimeType: 'image/png', buffer: Buffer.from('png') });
    await expect(page.locator('#fileList .file-row')).toHaveCount(1);
    await page.locator('#saveBtn').click();
    expect(await (await request.get(SRV + '/__files')).json()).toHaveLength(1);
    page.once('dialog', (d) => d.accept());
    await page.locator('#listBody .list-row[data-id="p-home"] [data-act="edit"]').click();
    await page.locator('#delBtn').click();
    await expect.poll(async () => (await request.get(SRV + '/__files')).json()).toEqual([]);
  });

  test('GitHub Pages / โดเมนอื่น: ไม่แสดงส่วนไฟล์แนบ', async ({ page }) => {
    await openPage(page, '/insurance.html');
    await page.locator('#addBtn').click();
    await expect(page.locator('#filesRow')).toBeHidden();
  });

  test('มือถือ 390px: ไม่ล้นแนวนอน ทั้งสองธีม', async ({ page }) => {
    for (const theme of ['light', 'dark']) {
      await openPage(page, '/insurance.html', { theme, width: 390 });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('หน้าวันนี้: ต่ออายุประกันใน "ต้องทำวันนี้"', () => {
  test.use({ baseURL: SRV });

  test('ขึ้นเฉพาะที่ครบกำหนดใน 30 วัน (รวมเลยกำหนด) เรียงตามความเร่ง', async ({ page }) => {
    const errors = await openPage(page, '/index.html');
    await page.waitForSelector('#todoBody > *');
    const rows = page.locator('#todoBody .todo-row[data-kind="ins"]');
    await expect(rows).toHaveCount(2); // 51 วันไม่ขึ้น
    await expect(rows.nth(0).locator('.pill')).toHaveText('เลย 5 วัน');
    await expect(rows.nth(0)).toHaveAttribute('data-urg', 'err');
    await expect(rows.nth(1).locator('.pill')).toHaveText('อีก 10 วัน');
    await expect(rows.nth(1)).toContainText('฿30,000');
    await expect(page.locator('#todoBody')).not.toContainText('ทิพยประกันภัย');
    await expect(rows.nth(0).locator('a')).toHaveAttribute('href', 'insurance.html');
    expect(errors).toEqual([]);
  });

  test('ไม่มีกรมธรรม์/มีแต่ไม่ใกล้ถึง: ไม่ขึ้นรายการ ("ไม่มีเรื่องค้าง")', async ({ page }) => {
    await openPage(page, '/index.html', { withData: false });
    await page.waitForSelector('#todoBody > *');
    await expect(page.locator('#todoBody .todo-none')).toBeVisible();
    await page.evaluate(() => localStorage.setItem('tanot:insurance:policies', JSON.stringify([{ id: 'x', type: 'home', insurer: 'ไกล', premium: 1, freq: 'year', renewDate: '2027-06-01' }])));
    await page.reload();
    await page.waitForSelector('#todoBody > *');
    await expect(page.locator('#todoBody .todo-none')).toBeVisible();
  });
});
