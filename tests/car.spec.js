// @ts-check
// บันทึกรถ (car.html / car-calc.js / functions/api/files.js ns car) — ROADMAP Phase 6 ชีวิต P3
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');

const K = require(path.join(__dirname, '..', 'car-calc.js'));
const SRV = 'http://localhost:8136';
const NOW = new Date('2026-09-30T10:30:00+07:00');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const IMG = { name: 'book.png', mimeType: 'image/png', buffer: PNG };
// ทั้งไฟล์ใช้เซิร์ฟเวอร์เดียวที่มี /__reset ล้าง D1+R2 — ห้ามให้ describe ต่างกลุ่มรันขนานกัน
test.describe.configure({ mode: 'serial' });
const at = (s) => new Date(s + 'T12:00:00');
const th = (y, m, d, lead = 0) => Date.UTC(y, m - 1, d - lead, 1, 0); // 08:00 น. เวลาไทย

// รถอายุเกิน 7 ปี (จดทะเบียน 2017) · ยังไม่มีใบตรวจ
const V1 = { id: 'v1', plate: 'กข 1234', province: 'กรุงเทพมหานคร', make: 'Toyota', model: 'Vios', year: 2017, odometer: 120000, actDue: '2026-10-05', taxDue: '2026-11-15', insuranceDue: '2026-12-20', inspectDue: '', files: [] };
const S1 = { id: 's1', vehicleId: 'v1', date: '2026-08-01', odometer: 118000, items: 'เปลี่ยนน้ำมันเครื่อง\nกรองน้ำมันเครื่อง', cost: 1800, nextKm: 128000, nextDate: '2026-10-20' };
const POL = { id: 'p1', type: 'car', insurer: 'วิริยะ', name: 'ชั้น 1', insured: 'กข-1234 กรุงเทพ', renewDate: '2026-12-01', premium: 15000, freq: 'year' };

test.describe('car-calc.js (known-answer)', () => {
  test('inspectRequired: เกิน 7 ปีนับจากปีจดทะเบียน (ปีรุ่น 2019 ปี 2026 = 7 ปี ยังไม่ต้อง; ปี 2027 ต้อง) · ไม่รู้ปี = ไม่บังคับ', () => {
    expect(K.inspectRequired({ year: 2018 }, '2026-01-01')).toBe(true);
    expect(K.inspectRequired({ year: 2019 }, '2026-12-31')).toBe(false);
    expect(K.inspectRequired({ year: 2019 }, '2027-03-01')).toBe(true);
    expect(K.inspectRequired({}, '2027-03-01')).toBe(false);
    expect(K.inspectRequired({ year: 2010 }, 'ไม่ใช่วัน')).toBe(false);
    // รถจักรยานยนต์: เกิน 5 ปี (ปีรุ่น 2021 ปี 2026 = 5 ปี ยังไม่ต้อง; ปี 2027 ต้อง) · ไม่ระบุประเภท = รถยนต์
    expect(K.inspectRequired({ type: 'motorcycle', year: 2021 }, '2026-12-31')).toBe(false);
    expect(K.inspectRequired({ type: 'motorcycle', year: 2021 }, '2027-01-01')).toBe(true);
    expect(K.inspectRequired({ type: 'car', year: 2021 }, '2027-01-01')).toBe(false);
    expect(K.inspectAfter({})).toBe(7);
    expect(K.inspectAfter({ type: 'motorcycle' })).toBe(5);
  });

  test('inspectOk: รถต้องตรวจ ใบตรวจต้องไม่หมดก่อนวันครบกำหนดภาษี · รถใหม่ไม่ต้อง', () => {
    expect(K.inspectOk({ year: 2017, taxDue: '2026-11-15', inspectDue: '' })).toBe(false);
    expect(K.inspectOk({ year: 2017, taxDue: '2026-11-15', inspectDue: '2026-11-14' })).toBe(false);
    expect(K.inspectOk({ year: 2017, taxDue: '2026-11-15', inspectDue: '2026-11-15' })).toBe(true);
    expect(K.inspectOk({ year: 2022, taxDue: '2026-11-15', inspectDue: '' })).toBe(true);
    expect(K.inspectOk({ year: 2017, taxDue: '', inspectDue: '' })).toBe(true);
  });

  test('linkedPolicy: จับจากทะเบียน (ไม่สนช่องว่าง/ขีด) · ที่เลือกไว้ชนะ · ไม่ใช่ประเภทรถไม่จับ', () => {
    const life = { id: 'p0', type: 'life', insured: 'กข 1234' };
    const other = { id: 'p2', type: 'car', insured: 'ฮฮ 9999', renewDate: '2026-12-31' };
    expect(K.linkedPolicy(V1, [life, POL, other]).id).toBe('p1');
    expect(K.linkedPolicy(V1, [life, other])).toBeNull();
    expect(K.linkedPolicy(Object.assign({}, V1, { insurancePolicyId: 'p2' }), [POL, other]).id).toBe('p2');
    expect(K.linkedPolicy({ plate: 'ก' }, [{ id: 'p3', type: 'car', insured: 'ก' }])).toBeNull(); // ทะเบียนสั้นเกินไปไม่เดา
  });

  test('deadlines: พ.ร.บ./ภาษี/ประกัน/ตรอ. · เชื่อมกรมธรรม์ = ใช้วันของกรมธรรม์ (linked)', () => {
    expect(K.deadlines(V1, [], NOW).map((d) => [d.kind, d.date])).toEqual([['act', '2026-10-05'], ['tax', '2026-11-15'], ['insurance', '2026-12-20']]);
    const d = K.deadlines(Object.assign({}, V1, { inspectDue: '2026-11-20' }), [POL], NOW);
    expect(d.map((x) => x.kind)).toEqual(['act', 'tax', 'insurance', 'inspect']);
    expect(d.find((x) => x.kind === 'insurance')).toMatchObject({ date: '2026-12-01', linked: true });
    expect(K.deadlines({ id: 'x', plate: 'a', actDue: '2026-02-31' }, [], NOW)).toEqual([]); // วันที่ไม่มีจริง
  });

  test('nextService: อย่างใดถึงก่อน (วันที่/เลขไมล์) · เลยกำหนด/ใกล้ถึง/ปกติ · ใช้รายการล่าสุดที่ระบุนัด', () => {
    const now = at('2026-09-30');
    const v = { id: 'v', odometer: 120000 };
    const mk = (o) => K.nextService(v, [Object.assign({ id: 's', vehicleId: 'v', date: '2026-08-01', odometer: 118000 }, o)], now);
    expect(mk({ nextKm: 128000, nextDate: '2026-10-20' })).toMatchObject({ state: 'soon', due: 'date', days: 20, kmLeft: 8000 });
    expect(mk({ nextKm: 120500, nextDate: '2027-01-10' })).toMatchObject({ state: 'soon', due: 'km', kmLeft: 500 });
    expect(mk({ nextKm: 119000, nextDate: '2027-01-10' })).toMatchObject({ state: 'overdue', due: 'km' });
    expect(mk({ nextKm: 150000, nextDate: '2026-09-01' })).toMatchObject({ state: 'overdue', due: 'date', days: -29 });
    expect(mk({ nextKm: 150000, nextDate: '2027-06-01' })).toMatchObject({ state: 'ok', due: null });
    expect(mk({ items: 'ไม่มีนัด' })).toBeNull();
    // เลขไมล์จากประวัติใหม่กว่าที่กรอกในรถ → ใช้ค่าที่มากกว่า
    expect(K.currentOdometer(v, [{ vehicleId: 'v', odometer: 125000 }, { vehicleId: 'w', odometer: 999999 }])).toBe(125000);
    // นัดล่าสุดชนะนัดเก่า
    const two = [
      { id: 'a', vehicleId: 'v', date: '2026-01-01', nextKm: 119000 },
      { id: 'b', vehicleId: 'v', date: '2026-08-01', nextKm: 150000, nextDate: '2027-06-01' },
    ];
    expect(K.nextService(v, two, now)).toMatchObject({ state: 'ok', nextKm: 150000 });
  });

  test('reminders: 30/7/วันหมด 08:00 ไทย เฉพาะที่ยังไม่ถึง · นัดเข้าศูนย์ 7 วัน+วันนัด · ประกันที่เชื่อมกรมธรรม์ไม่ลงซ้ำ · ภาษีรถเกิน 7 ปีบอก ตรอ.', () => {
    const r = K.reminders([V1], [S1], [], NOW);
    const key = (x) => [x.id, x.due_at];
    expect(r.map(key).sort()).toEqual([
      ['v1:act:2026-10-05:0', th(2026, 10, 5)], // 30 และ 7 วันก่อนผ่านไปแล้ว
      ['v1:tax:2026-11-15:30', th(2026, 11, 15, 30)], ['v1:tax:2026-11-15:7', th(2026, 11, 15, 7)], ['v1:tax:2026-11-15:0', th(2026, 11, 15)],
      ['v1:insurance:2026-12-20:30', th(2026, 12, 20, 30)], ['v1:insurance:2026-12-20:7', th(2026, 12, 20, 7)], ['v1:insurance:2026-12-20:0', th(2026, 12, 20)],
      ['v1:svc:s1:2026-10-20:7', th(2026, 10, 20, 7)], ['v1:svc:s1:2026-10-20:0', th(2026, 10, 20)],
    ].sort());
    expect(new Set(r.map((x) => x.id)).size).toBe(r.length);
    r.forEach((x) => { expect(x.kind).toBe('push'); expect(x.url).toBe('car.html'); });
    const tax0 = r.find((x) => x.id === 'v1:tax:2026-11-15:0');
    expect(tax0.title).toBe('ภาษีรถประจำปี กข 1234 กรุงเทพมหานคร หมดอายุวันนี้');
    expect(tax0.body).toContain('ต้องตรวจสภาพ (ตรอ.) ก่อนต่อภาษี');
    expect(r.find((x) => x.id === 'v1:act:2026-10-05:0').body).not.toContain('ตรอ.');
    expect(r.find((x) => x.id === 'v1:svc:s1:2026-10-20:7').title).toContain('อีก 7 วัน');
    // เชื่อมกรมธรรม์ → ไม่มีแถว insurance ของรถ (หน้าประกันเตือนอยู่แล้ว)
    expect(K.reminders([V1], [], [POL], NOW).some((x) => x.id.includes(':insurance:'))).toBe(false);
    // นัดตามไมล์อย่างเดียว = ไม่มีแถวเตือน
    expect(K.reminders([{ id: 'v9', plate: 'x', odometer: 1 }], [{ id: 's', vehicleId: 'v9', date: '2026-08-01', nextKm: 5000 }], [], NOW)).toEqual([]);
    // รถใหม่ไม่มีข้อความ ตรอ.
    const young = K.reminders([Object.assign({}, V1, { year: 2024 })], [], [], NOW).find((x) => x.id === 'v1:tax:2026-11-15:0');
    expect(young.body).not.toContain('ตรอ.');
  });

  test('dueList: ภายใน N วัน (รวมเลยกำหนด) เรียงใกล้สุดก่อน + นัดเข้าศูนย์', () => {
    const now = at('2026-09-30');
    const list = K.dueList([V1], [S1], [], now, 60);
    expect(list.map((x) => [x.kind, x.days])).toEqual([['act', 5], ['service', 20], ['tax', 46]]);
    expect(K.dueList([V1], [], [], now, 3)).toEqual([]);
    expect(K.dueList([Object.assign({}, V1, { actDue: '2026-09-20' })], [], [], now, 60)[0]).toMatchObject({ kind: 'act', days: -10 });
  });

  test('budgetRecord/defaultCategory: id ตายตัว car-<id> · หมวดที่ชื่อเกี่ยวกับรถ ไม่มี = หมวดรายจ่ายแรก', () => {
    expect(K.budgetRecord(S1, V1, 'cat-x')).toEqual({ id: 'car-s1', date: '2026-08-01', type: 'expense', categoryId: 'cat-x', amount: 1800, note: 'รถ กข 1234 กรุงเทพมหานคร · เปลี่ยนน้ำมันเครื่อง' });
    expect(K.defaultCategory([{ id: 'a', name: 'ค่าข้าว', type: 'expense' }, { id: 'b', name: 'ค่าซ่อมรถ', type: 'expense' }, { id: 'c', name: 'เงินเดือน', type: 'income' }])).toBe('b');
    expect(K.defaultCategory([{ id: 'a', name: 'ค่าข้าว', type: 'expense' }])).toBe('a');
    expect(K.defaultCategory([])).toBe('');
  });
});

test.describe('API /api/files ns car', () => {
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });
  test('รับ ns car: อัปโหลด → ลบ → หายจาก R2', async ({ request }) => {
    const res = await request.post(SRV + '/api/files?ns=car&ref=v1&name=a.png', { data: PNG, headers: { 'Content-Type': 'image/png' } });
    expect(res.status()).toBe(200);
    const meta = await res.json();
    expect(await (await request.get(SRV + '/__files')).json()).toEqual(['car/' + meta.id]);
    expect((await request.delete(SRV + '/api/files?id=' + meta.id)).status()).toBe(200);
    expect(await (await request.get(SRV + '/__files')).json()).toEqual([]);
  });
});

/* ── หน้า ── */
function seedFn() {
  return ({ vehicles, services, policies, budget, cats }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (vehicles) localStorage.setItem('tanot:car:vehicles', JSON.stringify(vehicles));
    if (services) localStorage.setItem('tanot:car:services', JSON.stringify(services));
    if (policies) localStorage.setItem('tanot:insurance:policies', JSON.stringify(policies));
    if (budget) localStorage.setItem('budget:records', JSON.stringify(budget));
    if (cats) localStorage.setItem('budget:categories', JSON.stringify(cats));
  };
}
async function openPage(page, p, o = {}) {
  const { files = true, push = false, sync = false, data, theme = 'light', width = 1100 } = o;
  const errors = await prepare(page, { theme });
  const log = { del: [], posts: [], post: [] };
  page.on('request', (r) => {
    const u = r.url();
    if (r.method() === 'DELETE' && u.includes('/api/files')) log.del.push(u);
    if (r.method() === 'POST' && u.includes('/api/files')) log.post.push(u);
    if (r.method() === 'POST' && u.includes('/api/push/reminders')) log.posts.push(r.postDataJSON());
  });
  await page.addInitScript(({ files, push, sync }) => {
    if (files) window.TANOT_FILES = { enabled: true };
    if (push) window.TANOT_PUSH = { enabled: true };
    if (sync) window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
  }, { files, push, sync });
  if (data) await page.addInitScript(seedFn(), data);
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(p, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return { errors, log };
}
const store = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);
const raw = (page, k) => page.evaluate((key) => localStorage.getItem(key), k);
async function confirmDelete(page, text, ok = true) {
  const box = page.locator('dialog:has(.dialog-msg)');
  await expect(box.locator('.dialog-msg')).toContainText(text);
  await box.locator(ok ? '.btn.danger' : '.btn:not(.danger)').click();
  await expect(box).toHaveCount(0);
}
const CATS = [{ id: 'cat-rice', name: 'ค่าข้าว', type: 'expense' }, { id: 'cat-car', name: 'ค่าซ่อมรถ', type: 'expense' }];

test.describe('หน้า car.html', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('แสดงรถ + กำหนดต่ออายุ + เตือน ตรอ. (รถเกิน 7 ปี ยังไม่มีใบตรวจ) + นัดเข้าศูนย์ + ประวัติ · reminders scope car ไป /api/push/reminders ถูกวัน', async ({ page, request }) => {
    const { log, errors } = await openPage(page, '/car.html', { push: true, data: { vehicles: [V1], services: [S1] } });
    const card = page.locator('[data-vid="v1"]');
    await expect(card).toContainText('กข 1234 กรุงเทพมหานคร');
    await expect(card).toContainText('Toyota Vios · ปี 2017 · 120,000 กม.');
    await expect(card.locator('[data-kind="act"]')).toContainText('อีก 5 วัน');
    await expect(card.locator('[data-kind="tax"]')).toContainText('อีก 46 วัน');
    await expect(card.locator('[data-kind="insurance"]')).toContainText('20 ธ.ค. 2569');
    await expect(card.locator('[data-kind="inspect-need"]')).toContainText('ต้องตรวจสภาพ (ตรอ.) ก่อนต่อภาษี');
    await expect(card.locator('[data-b="next-service"]')).toContainText('ที่ 128,000 กม. (อีก 8,000 กม.)');
    await expect(card.locator('[data-b="next-service"]')).toContainText('20 ต.ค. 2569');
    await expect(card.locator('[data-b="next-service"] .badge.warn')).toHaveText('ใกล้ถึง');
    await expect(card.locator('.car-svc .list-row')).toHaveCount(1);
    await expect(card.locator('.car-svc')).toContainText('เปลี่ยนน้ำมันเครื่อง');
    await expect(page.locator('#kpis')).toContainText('฿1,800');

    await expect.poll(() => log.posts.filter((p) => p.scope === 'car').length).toBeGreaterThan(0);
    const last = log.posts.filter((p) => p.scope === 'car').pop();
    expect(last.items.map((i) => [i.id, i.due_at, i.kind, i.url]).sort()).toEqual(K.reminders([V1], [S1], [], NOW).map((i) => [i.id, i.due_at, i.kind, i.url]).sort());
    expect(last.items).toHaveLength(9);
    const stored = (await (await request.get(SRV + '/__push')).json()).reminders.filter((i) => i.id.startsWith('car:'));
    expect(stored).toHaveLength(9);

    // ใส่ใบตรวจที่หมดหลังวันภาษี → เตือนหาย + มีแถว ตรอ.
    await card.locator('[data-act="edit-car"]').click();
    await page.fill('#vInspect', '2027-02-01');
    await page.click('#vSave');
    await expect(card.locator('[data-kind="inspect-need"]')).toHaveCount(0);
    await expect(card.locator('[data-kind="inspect"]')).toContainText('1 ก.พ. 2570');
    await expect.poll(() => log.posts.filter((p) => p.scope === 'car').pop().items.length).toBe(12);

    // ลบรถ → reminders ชุดใหม่ว่าง + ประวัติหาย
    await card.locator('[data-act="edit-car"]').click();
    await page.click('#vDel');
    await confirmDelete(page, 'ลบรถคันนี้');
    await expect(page.locator('#vehicles')).toContainText('ยังไม่มีรถ');
    expect(await store(page, 'tanot:car:services')).toEqual([]);
    await expect.poll(() => log.posts.filter((p) => p.scope === 'car').pop().items.length).toBe(0);
    expect(errors).toEqual([]);
  });

  test('รถอายุไม่เกิน 7 ปี ไม่ขึ้นเตือน ตรอ. · เพิ่มรถผ่านฟอร์ม (หลายคัน)', async ({ page }) => {
    const { errors } = await openPage(page, '/car.html');
    await expect(page.locator('#vehicles')).toContainText('ยังไม่มีรถ');
    await page.click('#addBtn');
    await page.fill('#vPlate', '2กก 5678');
    await page.fill('#vProv', 'เชียงใหม่');
    await page.fill('#vMake', 'Honda');
    await page.fill('#vModel', 'City');
    await page.fill('#vYear', '2022');
    await page.fill('#vOdo', '45000');
    await page.fill('#vTax', '2026-11-15');
    await page.click('#vSave');
    await page.click('#addBtn');
    await page.fill('#vPlate', 'ขค 9');
    await page.fill('#vYear', '2015');
    await page.fill('#vTax', '2026-11-15');
    await page.click('#vSave');
    await expect(page.locator('[data-vid]')).toHaveCount(2);
    const list = await store(page, 'tanot:car:vehicles');
    expect(new Set(list.map((v) => v.id)).size).toBe(2);
    expect(list[0]).toMatchObject({ plate: '2กก 5678', province: 'เชียงใหม่', make: 'Honda', model: 'City', year: 2022, odometer: 45000 });
    await expect(page.locator('[data-vid]').nth(0).locator('[data-kind="inspect-need"]')).toHaveCount(0);
    await expect(page.locator('[data-vid]').nth(1).locator('[data-kind="inspect-need"]')).toHaveCount(1);
    await expect(page.locator('#kpis')).toContainText('2'); // รถ 2 คัน
    // ฟอร์มว่างทั้งหมด = ไม่บันทึก
    await page.click('#addBtn');
    await page.click('#vSave');
    await expect(page.locator('#vMsg')).toContainText('ทะเบียนหรือยี่ห้อ');
    await page.click('#vCancel');
    expect(errors).toEqual([]);
  });

  test('กรมธรรม์รถจากหน้าประกัน: อ่านอย่างเดียว — ใช้วันของกรมธรรม์ + ปุ่มไปหน้าประกัน · ไม่เขียนทับ tanot:insurance:policies · ไม่ลงเตือนซ้ำ', async ({ page }) => {
    const policies = [POL, { id: 'p0', type: 'life', insurer: 'AIA', name: 'ชีวิต', renewDate: '2026-10-01', insured: 'กข 1234' }];
    const before = JSON.stringify(policies);
    const { log, errors } = await openPage(page, '/car.html', { push: true, data: { vehicles: [V1], policies } });
    const ins = page.locator('[data-vid="v1"] [data-kind="insurance"]');
    await expect(ins).toContainText('1 ธ.ค. 2569'); // ของกรมธรรม์ ไม่ใช่ 20 ธ.ค. ที่กรอกในรถ
    await expect(ins.locator('[data-b="ins-link"]')).toHaveAttribute('href', 'insurance.html');
    await expect.poll(() => log.posts.filter((p) => p.scope === 'car').length).toBeGreaterThan(0);
    expect(log.posts.filter((p) => p.scope === 'car').pop().items.some((i) => i.id.includes(':insurance:'))).toBe(false);

    // แก้รถ + เลือกกรมธรรม์ในกล่อง + บันทึก → ข้อมูลประกันไม่ถูกแตะ
    await page.locator('[data-act="edit-car"]').click();
    await expect(page.locator('#vPolRow')).toBeVisible();
    await page.selectOption('#vPol', 'p1');
    await page.fill('#vNote', 'บันทึกทดสอบ');
    await page.click('#vSave');
    expect((await store(page, 'tanot:car:vehicles'))[0]).toMatchObject({ insurancePolicyId: 'p1', note: 'บันทึกทดสอบ' });
    expect(await raw(page, 'tanot:insurance:policies')).toBe(before);

    // ไม่มีกรมธรรม์รถ = ไม่มีช่องเลือก และใช้วันที่กรอกเอง
    const p2 = await page.context().newPage();
    await openPage(p2, '/car.html', { data: { vehicles: [V1], policies: [policies[1]] } });
    await expect(p2.locator('[data-vid="v1"] [data-kind="insurance"]')).toContainText('20 ธ.ค. 2569');
    await expect(p2.locator('[data-b="ins-link"]')).toHaveCount(0);
    await p2.locator('[data-act="edit-car"]').click();
    await expect(p2.locator('#vPolRow')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('เล่มทะเบียน/ใบเสร็จ: แนบ → R2 ns car · เอาออก/ยกเลิกกล่อง/ลบรถ ต้อง DELETE · ปุ่มแนบไม่ขึ้นนอก pages.dev', async ({ page, request }) => {
    const { log, errors } = await openPage(page, '/car.html', { data: { vehicles: [{ id: 'v2', plate: 'ก 1', files: [] }] } });
    const r2 = async () => (await (await request.get(SRV + '/__files')).json());
    await page.locator('[data-act="edit-car"]').click();
    await page.setInputFiles('#vFileInput', [IMG, Object.assign({}, IMG, { name: 'receipt.png' })]);
    await expect(page.locator('#vFileList .car-file')).toHaveCount(2);
    expect(log.post.every((u) => u.includes('ns=car') && u.includes('ref=v2'))).toBe(true);
    expect((await r2()).length).toBe(2);
    // ยกเลิกกล่อง → ไฟล์ที่เพิ่งแนบถูกลบ
    await page.click('#vCancel');
    await expect.poll(async () => (await r2()).length).toBe(0);
    expect(log.del).toHaveLength(2);

    // แนบ + บันทึก → อยู่ในรถ · เอาออกทีหลัง = ลบจริงตอนบันทึก
    await page.locator('[data-act="edit-car"]').click();
    await page.setInputFiles('#vFileInput', IMG);
    await expect(page.locator('#vFileList .car-file')).toHaveCount(1);
    await page.click('#vSave');
    const files = (await store(page, 'tanot:car:vehicles'))[0].files;
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ name: 'book.png', mime: 'image/png' });
    expect(await r2()).toEqual(['car/' + files[0].id]);
    await expect(page.locator('[data-vid="v2"] .badge[title="ไฟล์แนบ"]')).toContainText('1');
    await page.locator('[data-act="edit-car"]').click();
    await page.click('#vFileList [data-rm]');
    expect(await r2()).toHaveLength(1); // ยังไม่ลบจนกว่าจะกดบันทึก
    await page.click('#vSave');
    await expect.poll(async () => (await r2()).length).toBe(0);

    // ลบรถ → ไฟล์ทั้งหมดถูกลบ
    await page.locator('[data-act="edit-car"]').click();
    await page.setInputFiles('#vFileInput', IMG);
    await expect(page.locator('#vFileList .car-file')).toHaveCount(1);
    await page.click('#vSave');
    expect(await r2()).toHaveLength(1);
    await page.locator('[data-act="edit-car"]').click();
    await page.click('#vDel');
    await confirmDelete(page, 'ลบรถคันนี้');
    await expect.poll(async () => (await r2()).length).toBe(0);

    // นอก pages.dev (ไม่มี TANOT_FILES) → ไม่มีช่องแนบไฟล์
    const p2 = await page.context().newPage();
    await openPage(p2, '/car.html', { files: false, data: { vehicles: [{ id: 'v3', plate: 'ข 2' }] } });
    await p2.locator('[data-act="edit-car"]').click();
    await expect(p2.locator('#vFilesRow')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('เข้าศูนย์: เพิ่มรายการ → เลขไมล์ในรถขยับ · นัดตามไมล์/วันที่ · แก้/ลบ · ตรวจค่าที่ไม่สมเหตุผล', async ({ page }) => {
    const { errors } = await openPage(page, '/car.html', { data: { vehicles: [{ id: 'v1', plate: 'กข 1234', year: 2024, odometer: 50000 }] } });
    const card = page.locator('[data-vid="v1"]');
    await card.locator('[data-act="add-svc"]').click();
    await expect(page.locator('#sDate')).toHaveValue('2026-09-30');
    await expect(page.locator('#sOdo')).toHaveValue('50000');
    await page.fill('#sItems', 'เปลี่ยนน้ำมันเครื่อง');
    await page.fill('#sOdo', '51000');
    await page.fill('#sNextKm', '50500'); // น้อยกว่าไมล์ปัจจุบัน
    await page.click('#sSave');
    await expect(page.locator('#sMsg')).toContainText('มากกว่าเลขไมล์');
    await page.fill('#sNextKm', '61000');
    await page.fill('#sNextDate', '2026-09-01'); // ก่อนวันที่เข้าศูนย์
    await page.click('#sSave');
    await expect(page.locator('#sMsg')).toContainText('ไม่ก่อนวันที่');
    await page.fill('#sNextDate', '2027-03-30');
    await page.fill('#sCost', '1500');
    await page.click('#sSave');
    const svc = await store(page, 'tanot:car:services');
    expect(svc).toHaveLength(1);
    expect(svc[0]).toMatchObject({ vehicleId: 'v1', date: '2026-09-30', odometer: 51000, items: 'เปลี่ยนน้ำมันเครื่อง', cost: 1500, nextKm: 61000, nextDate: '2027-03-30' });
    expect((await store(page, 'tanot:car:vehicles'))[0]).toMatchObject({ odometer: 51000, odometerAt: '2026-09-30' });
    await expect(card).toContainText('51,000 กม.');
    await expect(card.locator('[data-b="next-service"]')).toContainText('ที่ 61,000 กม. (อีก 10,000 กม.)');
    await expect(card.locator('[data-b="next-service"] .badge')).toHaveCount(0); // ยังไกล = ไม่มีป้าย

    // เลขไมล์เกินนัด → ถึงกำหนดตามไมล์ (แม้วันที่ยังไม่ถึง)
    await card.locator('[data-act="add-svc"]').click();
    await page.fill('#sItems', 'ตรวจเช็คระยะ');
    await page.fill('#sOdo', '62000');
    await page.click('#sSave'); // รายการนี้ไม่ระบุนัด → นัดจากรายการก่อนหน้ายังใช้
    await expect(card.locator('[data-b="next-service"] .badge.err')).toHaveText('ถึงกำหนดตามไมล์');
    await expect(card.locator('.car-svc .list-row')).toHaveCount(2);

    // แก้รายการ → ค่าเดิมอยู่ในฟอร์ม · ลบ
    await card.locator('.car-svc .list-row', { hasText: 'ตรวจเช็คระยะ' }).locator('[data-act="edit-svc"]').click();
    await expect(page.locator('#sItems')).toHaveValue('ตรวจเช็คระยะ');
    await page.click('#sDel');
    await confirmDelete(page, 'ลบรายการนี้');
    await expect(card.locator('.car-svc .list-row')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('บันทึกเป็นรายจ่าย: แถว budget:records รูปแบบเดิม id car-<id> · กดซ้ำ/แก้ซ้ำไม่เพิ่มแถว · หมวดตามชื่อ (ค่าซ่อมรถ) · ลบรายการไม่แตะ budget', async ({ page, browser }) => {
    const existing = [{ id: 'x1', date: '2026-09-01', type: 'income', categoryId: 'cat-salary', amount: 100, note: 'เดิม' }];
    const { errors } = await openPage(page, '/car.html', { data: { vehicles: [V1], services: [S1], budget: existing, cats: CATS } });
    const card = page.locator('[data-vid="v1"]');
    await card.locator('[data-act="edit-svc"]').click();
    await expect(page.locator('#sCat')).toHaveValue('cat-car');
    await expect(page.locator('#sBudget')).toHaveText('บันทึกเป็นรายจ่าย');
    await page.click('#sBudget');
    let b = await store(page, 'budget:records');
    expect(b).toEqual([...existing, { id: 'car-s1', date: '2026-08-01', type: 'expense', categoryId: 'cat-car', amount: 1800, note: 'รถ กข 1234 กรุงเทพมหานคร · เปลี่ยนน้ำมันเครื่อง' }]);
    expect((await store(page, 'tanot:car:services'))[0].budgetId).toBe('car-s1');
    await expect(card.locator('[data-b="budget"]')).toBeVisible();

    // เปิดซ้ำ: ปุ่มถูกปิดและบอกว่าส่งแล้ว · บันทึกแก้ค่าใช้จ่ายไม่แก้แถวที่ส่งไปแล้ว
    await card.locator('[data-act="edit-svc"]').click();
    await expect(page.locator('#sBudget')).toBeDisabled();
    await expect(page.locator('#sBudget')).toContainText('ส่งเข้า budget แล้ว');
    await page.fill('#sCost', '2000');
    await page.click('#sSave');
    b = await store(page, 'budget:records');
    expect(b.filter((r) => r.id === 'car-s1')).toHaveLength(1);
    expect(b.find((r) => r.id === 'car-s1').amount).toBe(1800);
    expect((await store(page, 'tanot:car:services'))[0].budgetId).toBe('car-s1');

    // ต้องมีค่าใช้จ่ายก่อนจึงส่งได้
    await card.locator('[data-act="add-svc"]').click();
    await page.fill('#sItems', 'ล้างรถ');
    await page.click('#sBudget');
    await expect(page.locator('#sMsg')).toContainText('ใส่ค่าใช้จ่ายก่อน');
    await page.click('#sCancel');

    // ลบรายการเข้าศูนย์ → แถว budget ยังอยู่
    await card.locator('[data-act="edit-svc"]').click();
    await page.click('#sDel');
    await confirmDelete(page, 'ลบรายการนี้');
    expect((await store(page, 'budget:records')).filter((r) => r.id === 'car-s1')).toHaveLength(1);

    // ยังไม่เคยเปิด budget (ไม่มีหมวด) → ใช้ชุดสำรอง
    const ctx2 = await browser.newContext({ baseURL: SRV }); // context ใหม่ = localStorage ว่าง (ไม่มีหมวดจาก budget)
    const p2 = await ctx2.newPage();
    await openPage(p2, '/car.html', { data: { vehicles: [V1], services: [S1] } });
    await p2.locator('[data-act="edit-svc"]').click();
    await expect(p2.locator('#sCat')).toHaveValue('cat-fuel');
    await p2.click('#sBudget');
    expect((await store(p2, 'budget:records'))[0]).toMatchObject({ id: 'car-s1', categoryId: 'cat-fuel', amount: 1800 });
    await ctx2.close();
    expect(errors).toEqual([]);
  });

  test('การ์ด "รถ" หน้าวันนี้: ซ่อนเมื่อไม่มีกำหนดภายใน 60 วัน · แสดงรายการใกล้สุดก่อน (พ.ร.บ./เข้าศูนย์/ภาษี)', async ({ page }) => {
    await openPage(page, '/index.html');
    await expect(page.locator('#carCard')).toBeHidden();
    const p1 = await page.context().newPage();
    await openPage(p1, '/index.html', { data: { vehicles: [Object.assign({}, V1, { taxDue: '2027-03-01', actDue: '2027-03-01', insuranceDue: '2027-03-01' })] } });
    await expect(p1.locator('#carCard')).toBeHidden(); // ไกลเกิน 60 วัน
    const p2 = await page.context().newPage();
    const { errors } = await openPage(p2, '/index.html', { data: { vehicles: [V1], services: [S1] } });
    await expect(p2.locator('#carCard')).toBeVisible();
    const rows = p2.locator('#carBody .list-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('พ.ร.บ.');
    await expect(rows.nth(0)).toContainText('อีก 5 วัน');
    await expect(rows.nth(1)).toContainText('เข้าศูนย์');
    await expect(rows.nth(1)).toContainText('อีก 20 วัน');
    await expect(rows.nth(2)).toContainText('ภาษีรถประจำปี');
    await expect(rows.nth(2)).toContainText('อีก 46 วัน');
    await expect(rows.nth(0)).toHaveAttribute('href', 'car.html');
    expect(errors).toEqual([]);
  });

  test('เมนูมี "บันทึกรถ" ในหมวดชีวิตประจำวัน + ไทล์ในหน้า area', async ({ page }) => {
    const { errors } = await openPage(page, '/area.html?a=life');
    await expect(page.locator('a.tile', { hasText: 'บันทึกรถ' })).toHaveAttribute('href', /car\.html$/);
    expect(errors).toEqual([]);
  });
});

test.describe('ซิงก์ 2 เครื่อง', () => {
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });
  test('รถ/ประวัติเข้าศูนย์รวมกันได้ · ส่งเข้า budget จาก 2 เครื่อง = แถวเดียว · ลบข้ามเครื่อง', async ({ browser }) => {
    const mk = async () => {
      const ctx = await browser.newContext({ baseURL: SRV });
      const page = await ctx.newPage();
      const o = await openPage(page, '/car.html', { sync: true });
      return { ctx, page, errors: o.errors };
    };
    const A = await mk(), B = await mk();
    const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));
    const addCar = async (p, plate) => { await p.click('#addBtn'); await p.fill('#vPlate', plate); await p.fill('#vYear', '2022'); await p.click('#vSave'); };
    await addCar(A.page, 'กก 1'); await addCar(B.page, 'ขข 2');
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    for (const d of [A, B]) {
      const list = await store(d.page, 'tanot:car:vehicles');
      expect(list.map((v) => v.plate).sort()).toEqual(['กก 1', 'ขข 2']);
      expect(new Set(list.map((v) => v.id)).size).toBe(2);
      expect(d.errors).toEqual([]);
    }
    await expect(A.page.locator('[data-vid]')).toHaveCount(2); // วาดใหม่เองโดยไม่ต้องโหลดซ้ำ

    // เพิ่มประวัติเข้าศูนย์ของรถ "กก 1" ที่เครื่อง B (รถที่มาจากเครื่อง A)
    await B.page.locator('[data-vid]', { hasText: 'กก 1' }).locator('[data-act="add-svc"]').click();
    await B.page.fill('#sItems', 'เปลี่ยนยาง'); await B.page.fill('#sCost', '12000'); await B.page.fill('#sOdo', '30000');
    await B.page.click('#sSave');
    for (let i = 0; i < 2; i++) { await sync(B.page); await sync(A.page); }
    await expect(A.page.locator('[data-vid]', { hasText: 'กก 1' }).locator('.car-svc')).toContainText('เปลี่ยนยาง');

    // ทั้งสองเครื่องส่งรายการนี้เข้า budget → แถวเดียว
    for (const d of [A, B]) {
      await d.page.locator('.car-svc .list-row', { hasText: 'เปลี่ยนยาง' }).locator('[data-act="edit-svc"]').click();
      await d.page.click('#sBudget');
    }
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    for (const d of [A, B]) {
      const budget = await store(d.page, 'budget:records');
      expect(budget).toHaveLength(1);
      expect(budget[0]).toMatchObject({ type: 'expense', amount: 12000 });
    }

    // แก้เลขไมล์ของรถเดียวกันจาก 2 เครื่อง — นาฬิกาเครื่อง B ขยับไปข้างหน้า (ซิงก์เป็น last-write-wins ตามเวลาเครื่อง; นาฬิกาในเทสต์ตรึงที่ NOW
    // ถ้าไม่ขยับ เวลาจะเท่ากันแล้วเซิร์ฟเวอร์ตัดสินด้วยชื่อ device ที่สุ่ม ทำให้เทสต์ไม่คงที่)
    const edit = async (p, odo) => { await p.locator('[data-vid]', { hasText: 'ขข 2' }).locator('[data-act="edit-car"]').click(); await p.fill('#vOdo', String(odo)); await p.click('#vSave'); };
    await edit(A.page, 111);
    await B.page.clock.setFixedTime(new Date(NOW.getTime() + 60000));
    await edit(B.page, 222);
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    for (const d of [A, B]) expect((await store(d.page, 'tanot:car:vehicles')).find((v) => v.plate === 'ขข 2').odometer).toBe(222);

    // ลบที่เครื่อง A (นาฬิกา A ขยับไปหลังสุด) → เครื่อง B เห็นหาย
    await A.page.clock.setFixedTime(new Date(NOW.getTime() + 120000));
    await A.page.locator('[data-vid]', { hasText: 'ขข 2' }).locator('[data-act="edit-car"]').click();
    await A.page.click('#vDel');
    await confirmDelete(A.page, 'ลบรถคันนี้');
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    expect((await store(B.page, 'tanot:car:vehicles')).map((v) => v.plate)).toEqual(['กก 1']);
    await A.ctx.close(); await B.ctx.close();
  });
});
