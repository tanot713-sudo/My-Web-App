// @ts-check
// ภาษีเงินได้บุคคลธรรมดา (tax.html / tax-calc.js / tax-rules/*.json) — ROADMAP Phase 6 ชีวิต P1
// ส่วนแรกเรียก tax-calc.js ตรงจาก Node กับไฟล์กฎจริง เทียบตัวเลขที่คิดมือ · ส่วนหลังเปิดหน้าจริงพร้อมข้อมูลจำลองจาก budget/ประกัน/กองทุน
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { prepare } = require('./helpers');

const ROOT = path.join(__dirname, '..');
const T = require(path.join(ROOT, 'tax-calc.js'));
const R68 = JSON.parse(fs.readFileSync(path.join(ROOT, 'tax-rules', '2568.json'), 'utf8'));
const R69 = JSON.parse(fs.readFileSync(path.join(ROOT, 'tax-rules', '2569.json'), 'utf8'));

test.describe('ไฟล์กฎ', () => {
  test('index.json ชี้ทุกไฟล์ปีที่มี และปีในไฟล์ตรงชื่อไฟล์', () => {
    const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'tax-rules', 'index.json'), 'utf8'));
    const files = fs.readdirSync(path.join(ROOT, 'tax-rules')).filter((f) => /^\d{4}\.json$/.test(f)).map((f) => +f.slice(0, 4)).sort();
    expect(idx.years.slice().sort()).toEqual(files);
    for (const y of idx.years) {
      const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'tax-rules', y + '.json'), 'utf8'));
      expect(r.taxYear).toBe(y);
      expect(r.adYear).toBe(y - 543);
    }
  });
  test('ขั้นภาษี 0/5/10/15/20/25/30/35%', () => {
    for (const r of [R68, R69]) {
      expect(r.brackets.map((b) => [b.upTo, b.rate])).toEqual([
        [150000, 0], [300000, 0.05], [500000, 0.10], [750000, 0.15], [1000000, 0.20], [2000000, 0.25], [5000000, 0.30], [null, 0.35],
      ]);
    }
  });
});

test.describe('สูตร: ภาษีอัตราก้าวหน้า', () => {
  test('ขอบขั้น', () => {
    expect(T.progressive(R69, 150000).tax).toBe(0);
    expect(T.progressive(R69, 300000).tax).toBe(7500);
    expect(T.progressive(R69, 431000).tax).toBe(20600); // 7,500 + 131,000 × 10%
    expect(T.progressive(R69, 1000000).tax).toBe(115000); // 7,500 + 20,000 + 37,500 + 50,000
    expect(T.progressive(R69, 5000000).tax).toBe(1265000); // 115,000 + 250,000 + 900,000
    expect(T.progressive(R69, 6000000).tax).toBe(1615000);
  });
  test('อัตราขั้นสูงสุด', () => {
    expect(T.marginalRate(R69, 0)).toBe(0);
    expect(T.marginalRate(R69, 150000)).toBe(0.05);
    expect(T.marginalRate(R69, 273000)).toBe(0.05);
    expect(T.marginalRate(R69, 9e6)).toBe(0.35);
  });
});

test.describe('สูตร: เงินได้และค่าใช้จ่าย', () => {
  test('เงินเดือน 600,000 + ประกันสังคม 9,000 → สุทธิ 431,000 ภาษี 20,600', () => {
    const r = T.compute(R69, { salary: 600000, socialSecurity: 9000 });
    expect(r.expenses).toBe(100000);
    expect(r.deductions).toBe(69000);
    expect(r.net).toBe(431000);
    expect(r.tax).toBe(20600);
  });
  test('40(1)+40(2) หักรวม 50% ไม่เกิน 100,000 · 40(8) เหมา 60%', () => {
    expect(T.compute(R69, { salary: 100000, service: 60000 }).expenses).toBe(80000);
    expect(T.compute(R69, { salary: 150000, service: 100000 }).expenses).toBe(100000);
    expect(T.compute(R69, { other: 500000 }).expenses).toBe(300000);
  });
  test('ภาษีหัก ณ ที่จ่าย → ได้คืน', () => {
    const r = T.compute(R69, { salary: 600000, socialSecurity: 9000, withheld: 30000 });
    expect(r.balance).toBe(-9400);
  });
  test('ภาษีขั้นต่ำ 0.5% ของ 40(2)–40(8) เมื่อสูงกว่าภาษีตามขั้น · ไม่เกิน 5,000 ยกเว้น', () => {
    const a = T.compute(R69, { other: 2000000, rmf: 500000, thaiEsg: 300000 });
    expect(a.net).toBe(0);
    expect(a.minTax).toBe(10000);
    expect(a.tax).toBe(10000);
    expect(a.minTaxApplied).toBe(true);
    const b = T.compute(R69, { other: 1000000 }); // 0.5% = 5,000 → ยกเว้น
    expect(b.minTax).toBe(0);
    expect(b.tax).toBe(11500); // 1,000,000 − 600,000 − 60,000 = 340,000
    const c = T.compute(R69, { salary: 3000000 }); // 40(1) ไม่นับภาษีขั้นต่ำ
    expect(c.minTax).toBe(0);
  });
});

test.describe('สูตร: ค่าลดหย่อน', () => {
  test('ครอบครัว: คู่สมรส บุตร (คนที่ 2+ เกิดตั้งแต่ 2561) บิดามารดาไม่เกิน 4 คน', () => {
    const r = T.compute(R69, { salary: 1000000, spouse: 1, children: 3, children2561: 2, parents: 5, disabled: 1, prenatal: 80000 });
    expect(r.items.spouse.ded).toBe(60000);
    expect(r.items.children.ded).toBe(30000 + 2 * 60000);
    expect(r.items.parents.ded).toBe(120000);
    expect(r.items.disabled.ded).toBe(60000);
    expect(r.items.prenatal.ded).toBe(60000);
    // บุตรคนเดียว ใส่ว่าเกิดหลัง 2561 ก็ได้ 30,000 (60,000 เริ่มที่คนที่ 2)
    expect(T.compute(R69, { children: 1, children2561: 1 }).items.children.ded).toBe(30000);
  });
  test('ประกันสุขภาพ ≤ 25,000 และชีวิต + สุขภาพ ≤ 100,000', () => {
    const r = T.compute(R69, { salary: 1000000, healthIns: 30000, lifeIns: 90000 });
    expect(r.items.healthIns.ded).toBe(25000);
    expect(r.items.lifeIns.ded).toBe(75000);
    expect(T.compute(R69, { lifeIns: 150000 }).items.lifeIns.ded).toBe(100000);
    expect(T.compute(R69, { parentsHealth: 20000, spouseLife: 20000 }).groups.insurance).toBe(25000);
  });
  test('บำนาญใช้โควตาประกันชีวิตที่เหลือจาก 100,000 ก่อน แล้วส่วนที่เหลือ ≤ 15% / 200,000', () => {
    const a = T.compute(R69, { salary: 1200000, lifeIns: 40000, healthIns: 20000, annuity: 150000 });
    expect(a.items.annuity.toLife).toBe(40000); // 100,000 − 40,000 − 20,000
    expect(a.items.annuity.toRetire).toBe(110000);
    expect(a.groups.insurance).toBe(100000);
    const b = T.compute(R69, { salary: 500000, annuity: 300000 });
    expect(b.items.annuity.toLife).toBe(100000);
    expect(b.items.annuity.toRetire).toBe(75000); // 15% × 500,000
    const c = T.compute(R69, { salary: 3000000, lifeIns: 100000, annuity: 300000 });
    expect(c.items.annuity.toLife).toBe(0);
    expect(c.items.annuity.toRetire).toBe(200000);
  });
  test('กลุ่มเกษียณรวม ≤ 500,000 (PVD + บำนาญส่วนที่เหลือ + RMF)', () => {
    const r = T.compute(R69, { salary: 1200000, lifeIns: 40000, healthIns: 20000, annuity: 150000, rmf: 400000, pvd: 100000 });
    expect(r.items.pvd.ded).toBe(100000);
    expect(r.items.rmf.ded).toBe(290000);
    expect(r.retire).toEqual({ used: 500000, cap: 500000 });
    // PVD ≤ 15% ของค่าจ้าง, กบข. ≤ 30%, กอช. ≤ 30,000, RMF ≤ 30% ของเงินได้พึงประเมิน
    const s = T.compute(R69, { salary: 400000, service: 600000, pvd: 100000, gpf: 200000, nsf: 50000, rmf: 400000 });
    expect(s.items.pvd.ded).toBe(60000);
    expect(s.items.gpf.ded).toBe(120000);
    expect(s.items.nsf.ded).toBe(30000);
    expect(s.items.rmf.ded).toBe(290000); // เหลือในกลุ่ม 500,000 − 210,000 (ไม่ถึง 30% × 1,000,000)
  });
  test('ThaiESG แยกจากกลุ่มเกษียณ ≤ 30% / 300,000 · SSF หมดสิทธิ', () => {
    const r = T.compute(R69, { salary: 2000000, rmf: 500000, thaiEsg: 400000, ssf: 100000 });
    expect(r.items.rmf.ded).toBe(500000);
    expect(r.items.thaiEsg.ded).toBe(300000);
    expect(r.items.ssf.ded).toBe(0);
    expect(r.items.ssf.avail).toBe(false);
    expect(T.compute(R69, { salary: 500000, thaiEsg: 300000 }).items.thaiEsg.ded).toBe(150000);
  });
  test('ThaiESGX และมาตรการรายปี: 2568 มี / 2569 ตัดออก', () => {
    const inp = { salary: 2000000, thaiEsgxNew: 400000, thaiEsgxLtf: 400000, homeBuild: 2500000, eReceipt: 40000, eReceiptOtop: 25000 };
    const a = T.compute(R68, inp);
    expect(a.items.thaiEsgxNew.ded).toBe(300000);
    expect(a.items.thaiEsgxLtf.ded).toBe(300000);
    expect(a.items.homeBuild.ded).toBe(20000); // 10,000 ต่อทุก 1,000,000
    expect(a.items.eReceipt.ded).toBe(30000);
    expect(a.items.eReceiptOtop.ded).toBe(20000);
    const b = T.compute(R69, inp);
    expect(b.items.thaiEsgxNew.ded).toBe(0);
    expect(b.items.thaiEsgxLtf.ded).toBe(50000);
    expect(b.items.homeBuild.ded).toBe(0);
    expect(b.items.eReceipt.ded + b.items.eReceiptOtop.ded).toBe(0);
    expect(T.available(R69, 'eReceipt')).toBe(false);
    expect(T.available(R68, 'eReceipt')).toBe(true);
    expect(T.available(R69, 'children')).toBe(true);
  });
  test('เงินบริจาค: การศึกษา × 2 ≤ 10% แล้วบริจาคทั่วไป ≤ 10% ของยอดที่เหลือ', () => {
    const r = T.compute(R69, { salary: 1000000, donationEdu: 50000, donation: 100000 });
    // หลังหักค่าใช้จ่าย/ลดหย่อน = 840,000
    expect(r.items.donationEdu.ded).toBe(84000);
    expect(r.items.donation.ded).toBe(75600);
    expect(r.net).toBe(840000 - 84000 - 75600);
    expect(T.compute(R69, { salary: 1000000, donationEdu: 10000 }).items.donationEdu.ded).toBe(20000);
  });
  test('ดอกเบี้ยบ้าน ≤ 100,000 · พรรคการเมือง ≤ 10,000', () => {
    const r = T.compute(R69, { salary: 1000000, homeLoan: 150000, politic: 20000 });
    expect(r.items.homeLoan.ded).toBe(100000);
    expect(r.items.politic.ded).toBe(10000);
  });
});

test.describe('สูตร: ถ้าซื้อเพิ่ม', () => {
  const inp = { salary: 720000, socialSecurity: 9000, lifeIns: 30000, healthIns: 18000, annuity: 120000, rmf: 50000, thaiEsg: 60000 };
  test('สิทธิที่เหลือ + ยอดที่ภาษียังลด', () => {
    const r = T.compute(R69, inp);
    expect(r.net).toBe(273000);
    expect(r.tax).toBe(6150);
    expect(T.room(R69, inp, 'rmf')).toBe(166000); // 30% × 720,000 − 50,000
    expect(T.useful(R69, inp, 'rmf')).toBe(123000); // จนเงินได้สุทธิเหลือ 150,000
    expect(T.room(R69, inp, 'thaiEsg')).toBe(156000);
    expect(T.room(R69, inp, 'annuity')).toBe(40000); // 15% × 720,000 − 68,000
    expect(T.room(R69, inp, 'healthIns')).toBe(7000);
    expect(T.room(R69, inp, 'socialSecurity')).toBe(Infinity);
  });
  test('บำนาญเติมโควตาประกันชีวิตก่อนเข้ากลุ่มเกษียณ', () => {
    expect(T.room(R69, { salary: 1200000, lifeIns: 40000 }, 'annuity')).toBe(240000); // 60,000 + 180,000
  });
  test('ซื้อ RMF เพิ่ม 100,000 ที่เงินเดือน 1.2 ล้าน → ภาษีลด 22,000', () => {
    const s = T.simulate(R69, { salary: 1200000 }, { rmf: 100000 });
    expect(s.saved).toBe(22000); // 40,000 × 25% + 60,000 × 20%
    expect(s.spend).toBe(100000);
  });
  test('ปีที่เปิดเป็นค่าเริ่มต้น: ม.ค.–เม.ย. = ปีก่อน', () => {
    expect(T.defaultTaxYear(new Date(2026, 8, 30), [2568, 2569])).toBe(2569);
    expect(T.defaultTaxYear(new Date(2026, 1, 1), [2568, 2569])).toBe(2568);
    expect(T.defaultTaxYear(new Date(2028, 6, 1), [2568, 2569])).toBe(2569);
  });
});

/* ══════ หน้าจริง ══════ */
const seed = (ex) => {
    const recs = [];
    for (let m = 1; m <= 9; m++) recs.push({ id: 's' + m, date: `2026-${String(m).padStart(2, '0')}-25`, type: 'income', categoryId: 'cat-salary', amount: 80000, note: '' });
    recs.push({ id: 'o1', date: '2026-03-10', type: 'income', categoryId: 'cat-other-income', amount: 20000, note: '' });
    recs.push({ id: 'old', date: '2025-12-25', type: 'income', categoryId: 'cat-salary', amount: 70000, note: '' });
    localStorage.setItem('budget:records', JSON.stringify(recs));
    localStorage.setItem('budget:categories', JSON.stringify([
      { id: 'cat-salary', name: 'เงินเดือน', type: 'income', color: '#17B26A' },
      { id: 'cat-other-income', name: 'รายได้อื่นๆ', type: 'income', color: '#3BB8C4' },
    ]));
    localStorage.setItem('tanot:insurance:taxsummary', JSON.stringify({ v: 1, years: { 2026: { raw: { life: 30000, spouseLife: 0, health: 18000, parentsHealth: 0, annuity: 120000 } } } }));
    localStorage.setItem('tanot:invest:thaifund', JSON.stringify([
      { fund: 'X-RMF', cat: 'rmf', amt: 50000, nav: 10, units: 5000, ts: Date.parse('2026-05-01T10:00:00+07:00') },
      { fund: 'Y-ESG', cat: 'esg', amt: 60000, nav: 10, units: 6000, ts: Date.parse('2026-06-01T10:00:00+07:00') },
      { fund: 'Z-RMF', cat: 'rmf', amt: 99999, nav: 10, units: 9999, ts: Date.parse('2025-06-01T10:00:00+07:00') },
    ]));
    if (ex) for (const k of Object.keys(ex)) localStorage.setItem(k, ex[k]);
};

test.describe('หน้า tax.html', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-01T10:00:00+07:00'));
  });

  test('ดึงรายได้/ประกัน/กองทุน คำนวณ แก้ทับ จำค่า และจำลองซื้อเพิ่ม', async ({ page }) => {
    const errors = await prepare(page);
    await page.addInitScript(seed, null);
    await page.goto('/tax.html', { waitUntil: 'load' });
    await page.waitForSelector('#txKpi .kpi');

    await expect(page.locator('#txYear [aria-pressed="true"]')).toContainText('2569');
    await expect(page.locator('#tx_salary')).toHaveAttribute('placeholder', '720,000');
    await expect(page.locator('[data-src="salary"]')).toBeVisible();
    await expect(page.locator('#tx_lifeIns')).toHaveAttribute('placeholder', '30,000');
    await expect(page.locator('#tx_rmf')).toHaveAttribute('placeholder', '50,000');
    await expect(page.locator('#tx_thaiEsg')).toHaveAttribute('placeholder', '60,000');
    await expect(page.locator('#tx_ssf')).toHaveCount(0);
    await expect(page.locator('#tx_eReceipt')).toHaveCount(0);
    await expect(page.locator('[data-used="annuity"]')).toContainText('52,000');

    await page.fill('#tx_socialSecurity', '9000');
    await expect(page.locator('#txKpi .kpi').first()).toContainText('6,150');

    // หมวด "รายได้อื่นๆ" → 40(8): +20,000 − 60% = +8,000 สุทธิ → +400
    await page.locator('#txCatBox summary').click();
    await page.selectOption('[data-cat="cat-other-income"]', 'other');
    await expect(page.locator('#txKpi .kpi').first()).toContainText('6,550');
    await page.selectOption('[data-cat="cat-other-income"]', 'none');

    // ทั้งปี (ประมาณ): 80,000 × 12
    await page.click('#txProj [data-proj="1"]');
    await expect(page.locator('#tx_salary')).toHaveAttribute('placeholder', '960,000');
    await page.click('#txProj [data-proj="0"]');

    // พิมพ์ทับค่าที่ดึงมา
    await page.fill('#tx_salary', '600000');
    await expect(page.locator('[data-src="salary"]')).toBeHidden();
    await page.fill('#tx_salary', '');
    await expect(page.locator('[data-src="salary"]')).toBeVisible();

    await page.fill('#tx_withheld', '30000');
    await expect(page.locator('#txKpi')).toContainText('23,850');

    // ถ้าซื้อเพิ่ม
    await page.click('[data-tab="sim"]');
    const rmfRow = page.locator('[data-sim-row="rmf"]');
    await expect(rmfRow).toContainText('166,000');
    await expect(rmfRow).toContainText('123,000');
    await rmfRow.locator('[data-fill]').click();
    await expect(page.locator('#txs_rmf')).toHaveValue('123000');
    await expect(page.locator('#txSimKpi')).toContainText('6,150');
    await expect(page.locator('#txDaysLeft')).toContainText('91');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:tax:years') || '{}'));
    expect(stored['2569'].v).toEqual({ socialSecurity: '9000', withheld: '30000' });
    expect(stored['2569'].sim).toEqual({ rmf: '123000' });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:tax:catmap') || '{}'))).toEqual({ 'cat-other-income': 'none' });

    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('[data-panel="sim"]')).toBeVisible();
    await expect(page.locator('#txs_rmf')).toHaveValue('123000');

    // ปี 2568: ข้อมูลของปีนั้น (เงินเดือน ธ.ค. 2025, RMF 2025) + ช่อง e-Receipt กลับมา
    await page.click('#txYear [data-year="2568"]');
    await page.click('[data-tab="calc"]');
    await expect(page.locator('#tx_salary')).toHaveAttribute('placeholder', '70,000');
    await expect(page.locator('#tx_rmf')).toHaveAttribute('placeholder', '99,999');
    await expect(page.locator('#tx_eReceipt')).toBeVisible();
    await expect(page.locator('#tx_socialSecurity')).toHaveValue('');
    await expect(page.locator('#txProj')).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('มีกรมธรรม์ → ใช้ InsuranceCalc.taxSummary แทนสรุปที่เก็บไว้', async ({ page }) => {
    const errors = await prepare(page);
    await page.route('**/insurance-calc.js', (route) => route.fulfill({
      contentType: 'application/javascript',
      body: 'window.InsuranceCalc={taxSummary:function(p,y){return{year:y,raw:{life:p.length*11000,spouseLife:0,health:0,parentsHealth:0,annuity:0}}}};',
    }));
    await page.addInitScript(seed, { 'tanot:insurance:policies': JSON.stringify([{ id: 'a' }, { id: 'b' }]) });
    await page.goto('/tax.html', { waitUntil: 'load' });
    await expect(page.locator('#tx_lifeIns')).toHaveAttribute('placeholder', '22,000');
    await expect(page.locator('#tx_annuity')).toHaveAttribute('placeholder', '0');
    expect(errors).toEqual([]);
  });

  test('ภาษาอังกฤษ + จอ 390px ไม่ล้น ทั้ง 2 แท็บ', async ({ page }) => {
    const errors = await prepare(page);
    await page.addInitScript(seed, { 'ome:lang': 'en' });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/tax.html', { waitUntil: 'load' });
    await page.waitForSelector('#txKpi .kpi');
    await expect(page.locator('h1')).toHaveText('Personal Income Tax');
    for (const tab of ['calc', 'sim']) {
      await page.click(`[data-tab="${tab}"]`);
      await expect(page.locator(`[data-panel="${tab}"]`)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow on ${tab}`).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });
});
