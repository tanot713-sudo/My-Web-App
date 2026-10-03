// @ts-check
// สุขภาพ (health.html / health-calc.js / การ์ดบนหน้าวันนี้ / ns 'health' ของ /api/files / การแจ้งเตือนกินยา) — ROADMAP Phase 6 ชีวิต
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');

const H = require(path.join(__dirname, '..', 'health-calc.js'));
const SRV = 'http://localhost:8131';
const NOW = new Date('2026-09-30T10:30:00+07:00');
const NOW_MS = NOW.getTime();
const at = (s) => new Date(s).getTime();
// ทั้งไฟล์ใช้เซิร์ฟเวอร์เดียวที่มี /__reset — ห้ามรันขนานกัน
test.describe.configure({ mode: 'serial' });

test.describe('health-calc.js (known-answer)', () => {
  test('status: ในช่วง ok · นอกช่วงเล็กน้อย warn · เกินเกณฑ์ errPct err · ไม่มีเกณฑ์ null', () => {
    const sys = H.rangeOf('sys');
    expect(H.status(120, sys)).toBe('ok');
    expect(H.status(90, sys)).toBe('ok');
    expect(H.status(138, sys)).toBe('warn'); // เกิน 18 = 15% ของ 120 พอดี ยังไม่ err
    expect(H.status(139, sys)).toBe('err');
    expect(H.status(80, sys)).toBe('warn'); // ต่ำกว่า 90 อยู่ 10 (≤ 13.5)
    expect(H.status(70, sys)).toBe('err');
    expect(H.status(70, H.rangeOf('weight'))).toBeNull();
    expect(H.status('', sys)).toBeNull();
    expect(H.status(110, H.rangeOf('glu'))).toBe('warn');
    expect(H.status(126, H.rangeOf('glu'))).toBe('err');
    // ผู้ใช้แก้ช่วงเอง
    expect(H.status(70, H.rangeOf('weight', { weight: { lo: 55, hi: 75 } }))).toBe('ok');
    expect(H.rangeOf('sys', { sys: { lo: null, hi: 130 } })).toMatchObject({ lo: null, hi: 130 });
    expect(H.rangeText(H.rangeOf('waist'))).toBe('≤ 90');
    expect(H.labStatus({ value: 165, lo: null, hi: 130 })).toBe('err');
    expect(H.labStatus({ value: 135, lo: null, hi: 130 })).toBe('warn');
    expect(H.labStatus({ value: 35, lo: 40, hi: null })).toBe('warn');
  });

  test('cleanVital / compare / series', () => {
    expect(H.cleanVital({ at: 1, sys: '120', dia: '80', note: ' x ' }, 'a').rec).toEqual({ id: 'a', at: 1, sys: 120, dia: 80, note: 'x' });
    expect(H.cleanVital({ at: 1 }, 'a').error).toBe('empty');
    expect(H.cleanVital({ at: 1, hr: '500' }, 'a').error).toBe('hr');
    expect(H.cleanVital({ weight: '70' }, 'a').error).toBe('at');
    const v = [{ id: 'b', at: 20, weight: 70.5 }, { id: 'a', at: 10, weight: 71.2, hr: 70 }, { id: 'c', at: 30, hr: 80 }];
    expect(H.series(v, 'weight').map((p) => p.v)).toEqual([71.2, 70.5]);
    expect(H.compare(v, 'weight')).toMatchObject({ last: { v: 70.5 }, prev: { v: 71.2 }, delta: -0.7 });
    expect(H.compare(v, 'hr').delta).toBe(10);
    expect(H.compare(v, 'glu')).toBeNull();
    expect(H.compare([{ id: 'x', at: 1, weight: 60 }], 'weight')).toMatchObject({ prev: null, delta: null });
  });

  test('labSeries / labNames: ชื่อเดียวกันไม่สนตัวพิมพ์ เรียงตามวันที่', () => {
    const cs = [
      { id: 'b', date: '2026-09-01', results: [{ name: 'LDL', value: 165, hi: 130 }] },
      { id: 'a', date: '2025-09-01', results: [{ name: 'ldl', value: 120, hi: 130 }, { name: 'HDL', value: 50 }] },
    ];
    expect(H.labSeries(cs, 'LDL').map((p) => [p.date, p.v])).toEqual([['2025-09-01', 120], ['2026-09-01', 165]]);
    expect(H.labNames(cs)).toEqual(['HDL', 'LDL']);
    expect(H.cleanCheckup({ date: '2026-09-01', results: [{ name: 'x', value: '' }] }, 'z').error).toBe('empty');
    expect(H.cleanCheckup({ date: '2026-09-01', results: [{ name: 'FBS', value: '95', unit: 'mg/dL', hi: '100' }] }, 'z').rec.results[0]).toEqual({ name: 'FBS', value: 95, unit: 'mg/dL', lo: null, hi: 100 });
  });

  test('ตารางกินยา: ช่วง start..end, มื้อของวัน, id ตายตัว, ค้างวันนี้', () => {
    const m1 = { id: 'm1', name: 'A', times: ['20:00', '08:00', '8:00'], start: '2026-09-01', end: '' };
    const m2 = { id: 'm2', name: 'B', times: ['07:00'], start: '2026-10-05', end: '2026-10-09' };
    expect(H.cleanTimes(['20:00', '8:00', '08:00', 'x', '25:00'])).toEqual(['08:00', '20:00']);
    expect(H.activeOn(m2, '2026-10-04')).toBe(false);
    expect(H.activeOn(m2, '2026-10-09')).toBe(true);
    expect(H.activeOn(m2, '2026-10-10')).toBe(false);
    expect(H.dosesOn([m1, m2], '2026-09-30').map((d) => d.id)).toEqual(['m1|2026-09-30|08:00', 'm1|2026-09-30|20:00']);
    const t = H.todayDoses([m1, m2], [{ id: 'm1|2026-09-30|08:00' }], NOW_MS);
    expect(t.map((d) => [d.time, d.taken, d.late])).toEqual([['08:00', true, false], ['20:00', false, false]]);
    expect(H.todayDoses([m1], [], NOW_MS)[0].late).toBe(true); // 08:00 เลยเวลาแล้วตอน 10:30
    expect(H.cleanMed({ name: 'A', times: [], start: '', end: '' }, 'x').error).toBe('times');
    expect(H.cleanMed({ name: 'A', times: ['08:00'], start: '2026-02-01', end: '2026-01-01' }, 'x').error).toBe('range');
  });

  test('reminders: ไม่มีวันสิ้นสุด = repeat daily รอบแรกที่ยังไม่ถึง (เวลาไทย) · มีวันสิ้นสุด = รายวันจนวันสุดท้าย · หมดแล้วไม่มี · ซ่อนชื่อ', () => {
    const meds = [
      { id: 'm1', name: 'ยาความดัน', dose: '5 mg', times: ['08:00', '20:00'], start: '2026-01-01', end: '' },
      { id: 'm2', name: 'วิตามิน', times: ['07:00'], start: '2026-09-01', end: '2026-10-02' },
      { id: 'm3', name: 'หมดแล้ว', times: ['08:00'], start: '2026-09-01', end: '2026-09-29' },
      { id: 'm4', name: 'ยังไม่เริ่ม', times: ['09:00'], start: '2026-10-10', end: '' },
    ];
    const r = H.reminders(meds, {}, NOW_MS);
    expect(r.map((x) => x.due_at)).toEqual(r.map((x) => x.due_at).sort((x, y) => x - y)); // เรียงตามเวลา
    const by = Object.fromEntries(r.map((x) => [x.id, x]));
    expect(Object.keys(by).sort()).toEqual(['med:m1:0800', 'med:m1:2000', 'med:m2:0700:2026-10-01', 'med:m2:0700:2026-10-02', 'med:m4:0900'].sort());
    expect(by['med:m1:2000']).toMatchObject({ due_at: at('2026-09-30T20:00:00+07:00'), repeat: 'daily', kind: 'push', url: 'health.html', title: 'ถึงเวลากินยา' });
    expect(by['med:m1:0800'].due_at).toBe(at('2026-10-01T08:00:00+07:00')); // 08:00 วันนี้ผ่านไปแล้ว → พรุ่งนี้
    expect(by['med:m2:0700:2026-10-01']).toMatchObject({ due_at: at('2026-10-01T07:00:00+07:00') });
    expect(by['med:m2:0700:2026-10-01'].repeat).toBeUndefined();
    expect(by['med:m4:0900'].due_at).toBe(at('2026-10-10T09:00:00+07:00'));
    expect(r.every((x) => x.body === undefined)).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/ยาความดัน|วิตามิน|5 mg/);
    // ไม่ซ่อนชื่อ → ชื่อ + ขนาด + เวลาอยู่ในข้อความ
    const shown = H.reminders(meds, { hideMedNames: false }, NOW_MS);
    expect(shown.find((x) => x.id === 'med:m1:2000').body).toBe('ยาความดัน · 5 mg · 20:00');
    expect(H.hideNames({})).toBe(true);
    expect(H.hideNames({ hideMedNames: false })).toBe(false);
  });

  test('reminders: คอร์สยาวเกินงบ 200 แถวใช้ repeat daily แทน · ไม่เกิน MAX_ITEMS', () => {
    const meds = [];
    for (let i = 0; i < 6; i++) meds.push({ id: 'k' + i, name: 'n', times: ['08:00', '12:00', '18:00'], start: '2026-09-01', end: '2026-12-31' });
    const r = H.reminders(meds, {}, NOW_MS);
    expect(r.length).toBeLessThanOrEqual(200);
    expect(r.some((x) => x.repeat === 'daily')).toBe(true);
  });
});

/* ══════════ หน้าเว็บ ══════════ */
const D = 86400000;
function seedData({ vitals, meds, checkups, intake, settings } = {}) {
  return ({ vitals, meds, checkups, intake, settings }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const S = (k, v) => v && localStorage.setItem(k, JSON.stringify(v));
    S('tanot:health:vitals', vitals); S('tanot:health:meds', meds); S('tanot:health:checkups', checkups);
    S('tanot:health:intake', intake); S('tanot:health:settings', settings);
  };
}
async function openPage(page, p, { data, theme = 'light', width = 1100, files = false, push = false, sync = false, noClock = false } = {}) {
  const errors = await prepare(page, { theme });
  const posts = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/push/reminders')) posts.push(r.postDataJSON()); });
  await page.addInitScript(({ files, push, sync }) => {
    if (files) window.TANOT_FILES = { enabled: true };
    if (push) window.TANOT_PUSH = { enabled: true };
    if (sync) window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
  }, { files, push, sync });
  if (data) await page.addInitScript(seedData(), data);
  if (!noClock) await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(p, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return { errors, posts };
}
const VITALS = [
  { id: 'v1', at: NOW_MS - 3 * D, weight: 72, sys: 118, dia: 76, hr: 70, glu: 92 },
  { id: 'v2', at: NOW_MS - 1 * D, weight: 71.2, sys: 150, dia: 95, hr: 72, glu: 110 },
];
const MEDS = [
  { id: 'm1', name: 'ยาลดความดัน', dose: '5 mg', times: ['08:00', '20:00'], start: '2026-01-01', end: '' },
  { id: 'm2', name: 'วิตามินซี', dose: '', times: ['07:00'], start: '2026-09-01', end: '2026-10-02' },
  { id: 'm3', name: 'หมดแล้ว', dose: '', times: ['08:00'], start: '2026-09-01', end: '2026-09-29' },
];

test.describe('หน้า health.html', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('บันทึกสัญญาณชีพ: ค่าเริ่มต้นวันเวลาปัจจุบัน, เพิ่ม → KPI/ประวัติ/badge, แก้, ลบ', async ({ page }) => {
    const { errors } = await openPage(page, '/health.html', { width: 390 });
    await expect(page.locator('#vAt')).toHaveValue('2026-09-30T10:30');
    await expect(page.locator('#vSys')).toHaveAttribute('inputmode', 'decimal');
    await expect(page.locator('#vList .list-row')).toHaveCount(0);
    await page.fill('#vSys', '400'); // เพี้ยนเกินจริง
    await page.fill('#vWeight', '70.5');
    await page.click('#vSave');
    await expect(page.locator('#vMsg')).toContainText('ความดันตัวบน');
    await page.fill('#vSys', '150'); await page.fill('#vDia', '95'); await page.fill('#vHr', '72'); await page.fill('#vGlu', '90'); await page.fill('#vWaist', '85');
    await page.click('#vSave');
    const rows = page.locator('#vList .list-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('น้ำหนัก 70.5');
    await expect(rows.first()).toContainText('ความดัน 150/95');
    await expect(rows.first().locator('.badge.err').first()).toContainText('ความดันตัวบนสูง');
    await expect(rows.first()).not.toContainText('น้ำตาลในเลือดสูง');
    await expect(page.locator('#vWeight')).toHaveValue(''); // ฟอร์มล้าง พร้อมกรอกครั้งต่อไป
    const kpi = page.locator('[data-kpi="bp"]');
    await expect(kpi).toContainText('150/95');
    await expect(kpi.locator('.badge.err')).toBeVisible();
    await expect(page.locator('[data-kpi="weight"]')).toContainText('70.5');
    await expect(page.locator('[data-kpi="weight"]')).toContainText('ครั้งแรก');

    // แก้
    await rows.first().click();
    await expect(page.locator('#vWeight')).toHaveValue('70.5');
    await expect(page.locator('#vDel')).toBeVisible();
    await page.fill('#vWeight', '69'); await page.fill('#vSys', '118'); await page.fill('#vDia', '78');
    await page.click('#vSave');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('น้ำหนัก 69');
    await expect(rows.first().locator('.badge')).toHaveCount(0);
    await expect(page.locator('[data-kpi="bp"] .badge')).toHaveCount(0);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:health:vitals')));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ weight: 69, sys: 118, dia: 78, hr: 72, glu: 90, waist: 85 });

    // ลบ
    page.once('dialog', (d) => d.accept());
    await rows.first().click();
    await page.click('#vDel');
    await expect(rows).toHaveCount(0);
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('tanot:health:vitals')))).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('KPI เทียบครั้งก่อน + กราฟแนวโน้ม (สีจาก chart-theme.js, สลับค่า, ช่วงปกติแก้ได้)', async ({ page }) => {
    const { errors } = await openPage(page, '/health.html', { data: { vitals: VITALS } });
    await expect(page.locator('[data-kpi="weight"]')).toContainText('71.2');
    await expect(page.locator('[data-kpi="weight"]')).toContainText('−0.8 จากครั้งก่อน');
    await expect(page.locator('[data-kpi="glu"]')).toContainText('110');
    await expect(page.locator('[data-kpi="glu"] .badge.warn')).toBeVisible();
    await expect(page.locator('[data-kpi="hr"] .badge')).toHaveCount(0);
    await expect(page.locator('[data-kpi="waist"]')).toContainText('—');
    // กราฟ: เริ่มที่น้ำหนัก 2 จุด สี series[0] ของธีม
    const svg = page.locator('#chart svg');
    await expect(svg).toHaveAttribute('data-points', '2');
    await expect(svg.locator('circle')).toHaveCount(2);
    const c0 = await page.evaluate(() => window.OmeChartTheme.get().series[0]);
    await expect(svg.locator('polyline')).toHaveAttribute('stroke', c0);
    // ความดัน = 2 เส้น มีคำอธิบาย
    await page.selectOption('#trendSel', 'g:bp');
    await expect(page.locator('#chart svg circle')).toHaveCount(4);
    await expect(page.locator('#chart .legend')).toContainText('ความดันตัวล่าง');
    const c1 = await page.evaluate(() => window.OmeChartTheme.get().series[1]);
    await expect(page.locator('#chart svg polyline').nth(1)).toHaveAttribute('stroke', c1);
    // ค่าที่ยังไม่เคยวัด
    await page.selectOption('#trendSel', 'g:waist');
    await expect(page.locator('#chart .empty')).toBeVisible();
    // ตั้งช่วงปกติเอง: น้ำหนัก 55–75 → ไม่มี badge · ความดันตัวบนสูงสุด 160 → 150 ไม่ใช่นอกช่วงอีก
    await page.click('#setBtn');
    await page.fill('[data-rk="sys"][data-b="hi"]', '160');
    await page.fill('[data-rk="glu"][data-b="hi"]', '120');
    await page.click('#setForm button[type="submit"]');
    await expect(page.locator('[data-kpi="glu"] .badge')).toHaveCount(0);
    await expect(page.locator('#vList .list-row').first()).not.toContainText('ความดันตัวบนสูง');
    await expect(page.locator('#vList .list-row').first()).toContainText('ความดันตัวล่างสูง');
    const ranges = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:health:ranges')));
    expect(ranges).toEqual({ sys: { lo: 90, hi: 160 }, glu: { lo: 70, hi: 120 } });
    expect(errors).toEqual([]);
  });

  test('ผลตรวจประจำปี: เพิ่มผลแล็บ + แนบไฟล์ (R2 ns health) → badge นอกช่วง → กราฟรายการ → ลบแล้วไฟล์หายจาก R2', async ({ page, request }) => {
    const { errors } = await openPage(page, '/health.html', { files: true });
    await page.click('#chkAdd');
    await page.fill('#cDate', '2026-09-01');
    await page.fill('#cPlace', 'รพ.ทดสอบ');
    const row0 = page.locator('#labRows .hl-lab').nth(0);
    await row0.locator('[data-f="name"]').fill('LDL');
    await row0.locator('[data-f="value"]').fill('165');
    await row0.locator('[data-f="unit"]').fill('mg/dL');
    await row0.locator('[data-f="hi"]').fill('130');
    await page.selectOption('#labPreset', { label: 'HbA1c' });
    const row1 = page.locator('#labRows .hl-lab').nth(1);
    await expect(row1.locator('[data-f="name"]')).toHaveValue('HbA1c');
    await expect(row1.locator('[data-f="hi"]')).toHaveValue('5.6'); // ช่วงอ้างอิงเริ่มต้น แก้ได้
    await row1.locator('[data-f="value"]').fill('5.2');
    await page.setInputFiles('#cFileInput', { name: 'lab.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ผลตรวจ') });
    await expect(page.locator('#cFiles .hl-file')).toHaveCount(1);
    expect(await (await request.get(SRV + '/__files')).json()).toHaveLength(1);
    await page.click('#chkForm button[type="submit"]');
    const r = page.locator('#chkList .list-row');
    await expect(r).toHaveCount(1);
    await expect(r.first()).toContainText('รพ.ทดสอบ');
    await expect(r.first().locator('.badge.err')).toContainText('LDL 165');
    await expect(r.first()).not.toContainText('HbA1c 5.2'); // ในช่วงปกติ ไม่มี badge
    const keys = await (await request.get(SRV + '/__files')).json();
    expect(keys[0]).toMatch(/^health\//);
    const fileId = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:health:checkups'))[0].files[0].id);
    const dl = await request.get(SRV + '/api/files?id=' + fileId);
    expect(dl.status()).toBe(200);
    expect(await dl.text()).toContain('%PDF-1.4');
    // กราฟของผลตรวจ
    await page.selectOption('#trendSel', 'l:LDL');
    await expect(page.locator('#chart svg')).toHaveAttribute('data-points', '1');
    // ลบ
    page.once('dialog', (d) => d.accept());
    await r.first().click();
    await page.click('#cDel');
    await expect(r).toHaveCount(0);
    await expect.poll(async () => (await (await request.get(SRV + '/__files')).json()).length).toBe(0);
    expect(errors.filter((e) => !/404/.test(e))).toEqual([]);
  });

  test('ยา → reminders ที่ส่งไป /api/push/reminders: ซ่อนชื่อเป็นค่าเริ่มต้น · ยาหมดอายุไม่มี · ปิดซ่อนชื่อแล้วข้อความมีชื่อยา', async ({ page, request }) => {
    const { errors, posts } = await openPage(page, '/health.html', { data: { meds: MEDS }, push: true });
    await expect.poll(() => posts.length).toBeGreaterThan(0);
    const p1 = posts[posts.length - 1];
    expect(p1.scope).toBe('health');
    expect(p1.items.map((i) => i.id).sort()).toEqual(['med:m1:0800', 'med:m1:2000', 'med:m2:0700:2026-10-01', 'med:m2:0700:2026-10-02']);
    expect(p1.items.every((i) => i.title === 'ถึงเวลากินยา' && !i.body && i.url === 'health.html' && i.kind === 'push')).toBe(true);
    expect(JSON.stringify(p1)).not.toMatch(/ยาลดความดัน|วิตามินซี|5 mg|หมดแล้ว/);
    const m1 = p1.items.find((i) => i.id === 'med:m1:2000');
    expect(m1).toMatchObject({ repeat: 'daily', due_at: at('2026-09-30T20:00:00+07:00') });
    // เซิร์ฟเวอร์รับครบ ไม่ทิ้งรายการ
    const stored = (await (await request.get(SRV + '/__push')).json()).reminders;
    expect(stored.filter((i) => i.id.startsWith('health:'))).toHaveLength(4);
    expect(JSON.stringify(stored)).not.toMatch(/ยาลดความดัน/);

    // ปิด "ซ่อนชื่อยา" → ลงทะเบียนใหม่พร้อมชื่อ
    await page.click('#setBtn');
    await expect(page.locator('#sHide')).toBeChecked();
    await page.uncheck('#sHide');
    await page.click('#setForm button[type="submit"]');
    await expect.poll(() => posts.length).toBeGreaterThan(1);
    const p2 = posts[posts.length - 1];
    expect(p2.items.find((i) => i.id === 'med:m1:2000').body).toBe('ยาลดความดัน · 5 mg · 20:00');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:health:settings')))).toEqual({ hideMedNames: false });

    // ลบยา m2 → ชุดใหม่ไม่มี m2
    await page.locator('#medList [data-med="m2"]').click();
    page.once('dialog', (d) => d.accept());
    await page.click('#mDel');
    await expect.poll(() => posts[posts.length - 1].items.some((i) => i.id.startsWith('med:m2'))).toBe(false);
    expect(errors).toEqual([]);
  });

  test('เพิ่มยาผ่านกล่อง (หลายเวลา/วันเริ่ม-สิ้นสุด) + กดกินแล้ว/ยกเลิก บันทึกเป็นแถว ยา×วัน×เวลา', async ({ page }) => {
    const { errors } = await openPage(page, '/health.html');
    await page.click('#medAdd');
    await page.click('#medForm button[type="submit"]');
    await expect(page.locator('#mMsg')).toHaveText('ใส่ชื่อยา');
    await page.fill('#mName', 'แคลเซียม');
    await page.fill('#mDose', '1 เม็ด');
    await page.click('#mTimeAdd');
    await page.locator('#mTimes input[type="time"]').nth(0).fill('09:00');
    await page.locator('#mTimes input[type="time"]').nth(1).fill('21:00');
    await page.fill('#mEnd', '2026-09-20');
    await page.click('#medForm button[type="submit"]');
    await expect(page.locator('#mMsg')).toHaveText('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
    await page.fill('#mEnd', '');
    await page.click('#medForm button[type="submit"]');
    const doses = page.locator('#medToday .list-row');
    await expect(doses).toHaveCount(2);
    await expect(doses.nth(0)).toContainText('09:00 น.');
    await expect(doses.nth(0)).toContainText('เลยเวลา'); // 10:30 แล้ว
    await expect(doses.nth(1)).not.toContainText('เลยเวลา');
    await doses.nth(1).locator('[data-act="take"]').click();
    await expect(doses.nth(1).locator('[data-act="take"]')).toHaveAttribute('aria-pressed', 'true');
    const medId = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:health:meds'))[0].id);
    let intake = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:health:intake')));
    expect(intake).toHaveLength(1);
    expect(intake[0]).toMatchObject({ id: medId + '|2026-09-30|21:00', med: medId, date: '2026-09-30', time: '21:00' });
    await page.reload();
    await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('#medToday .list-row').nth(1).locator('[data-act="take"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#medToday .list-row').nth(1).locator('[data-act="take"]').click(); // ยกเลิก
    intake = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:health:intake')));
    expect(intake).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('มือถือ 390px: ไม่ล้นแนวนอน ทั้งสองธีม พร้อมข้อมูล', async ({ page }) => {
    for (const theme of ['light', 'dark']) {
      const { errors } = await openPage(page, '/health.html', { data: { vitals: VITALS, meds: MEDS, checkups: [{ id: 'c1', date: '2026-09-01', place: 'รพ.', results: [{ name: 'LDL', value: 165, unit: 'mg/dL', lo: null, hi: 130 }], files: [] }] }, width: 390, theme });
      await expect(page.locator('#vList .list-row')).toHaveCount(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
      await page.evaluate(() => sessionStorage.clear());
    }
  });
});

test.describe('หน้าวันนี้: การ์ดสุขภาพ', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('ค่าล่าสุด + ยาที่ยังไม่ได้กินวันนี้ (ที่กินแล้วไม่นับ, ยาหมดอายุไม่นับ)', async ({ page }) => {
    const { errors } = await openPage(page, '/index.html', { data: { vitals: VITALS, meds: MEDS, intake: [{ id: 'm1|2026-09-30|08:00', med: 'm1', date: '2026-09-30', time: '08:00', at: 1 }] } });
    const el = page.locator('#healthBody');
    await expect(el).toContainText('น้ำหนัก 71.2');
    await expect(el).toContainText('ความดัน 150/95');
    await expect(el.locator('[data-h="bp"]')).toHaveClass(/err/);
    await expect(el).toContainText('ยาที่ยังไม่ได้กินวันนี้ 2 มื้อ'); // m2 07:00 + m1 20:00 (m1 08:00 กินแล้ว, m3 หมดอายุ)
    await expect(el.locator('.list-row')).toHaveCount(2);
    await expect(el.locator('.list-row').first()).toContainText('วิตามินซี');
    await expect(el.locator('.list-row').first()).toContainText('เลยเวลา');
    expect(errors).toEqual([]);
  });

  test('กินครบแล้ว / ไม่มีข้อมูล', async ({ page, browser }) => {
    await openPage(page, '/index.html', { data: { meds: [MEDS[0]], intake: [{ id: 'm1|2026-09-30|08:00' }, { id: 'm1|2026-09-30|20:00' }] } });
    await expect(page.locator('#healthBody .badge.ok')).toContainText('กินยาครบแล้ว');
    const p2 = await (await browser.newContext({ baseURL: SRV })).newPage();
    await openPage(p2, '/index.html', {});
    await expect(p2.locator('#healthBody .empty a')).toHaveAttribute('href', 'health.html');
  });
});

test.describe('ซิงก์ 2 เครื่อง', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('สองเครื่องบันทึกพร้อมกันไม่ทับกัน · กดกินมื้อเดียวกันได้แถวเดียว', async ({ browser }) => {
    const mk = async () => {
      const ctx = await browser.newContext({ baseURL: SRV });
      const page = await ctx.newPage();
      const o = await openPage(page, '/health.html', { sync: true, data: { meds: [MEDS[0]] } });
      return { ctx, page, errors: o.errors };
    };
    const A = await mk(), B = await mk();
    const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));
    const add = async (p, w) => { await p.fill('#vWeight', String(w)); await p.fill('#vSys', '118'); await p.click('#vSave'); };
    await add(A.page, 70); await add(B.page, 71);
    const take = async (p) => { await p.locator('#medToday [data-time="20:00"] [data-act="take"]').click(); };
    await take(A.page); await take(B.page);
    await sync(A.page); await sync(B.page); await sync(A.page); await sync(B.page);
    for (const d of [A, B]) {
      const vitals = await d.page.evaluate(() => JSON.parse(localStorage.getItem('tanot:health:vitals')));
      expect(vitals.map((v) => v.weight).sort()).toEqual([70, 71]);
      expect(new Set(vitals.map((v) => v.id)).size).toBe(2);
      const intake = await d.page.evaluate(() => JSON.parse(localStorage.getItem('tanot:health:intake')));
      expect(intake).toHaveLength(1);
      expect(intake[0].id).toBe('m1|2026-09-30|20:00');
      expect(d.errors).toEqual([]);
    }
    // หน้าอีกเครื่องวาดใหม่เองโดยไม่ต้องโหลดซ้ำ
    await expect(A.page.locator('#vList .list-row')).toHaveCount(2);
    await A.ctx.close(); await B.ctx.close();
  });
});
