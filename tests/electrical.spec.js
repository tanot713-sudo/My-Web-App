// @ts-check
// เครื่องคำนวณไฟฟ้า (electrical.html / electrical-calc.js) — ROADMAP Phase 6 งาน P1
// ส่วนแรกเรียกสูตรตรงจาก Node เทียบกับตัวอย่างที่รู้คำตอบ (ตารางมาตรฐานที่ตีพิมพ์/คำนวณมือ) · ส่วนหลังเปิดหน้าจริง
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');

const E = require(path.join(__dirname, '..', 'electrical-calc.js'));

/** |a − b| ≤ tol·|b| */
function near(a, b, tol) {
  expect(Math.abs(a - b), `${a} ≈ ${b} (±${tol * 100}%)`).toBeLessThanOrEqual(Math.abs(b) * tol);
}

test.describe('สูตร: แรงดันตก/ขนาดสาย', () => {
  test('mV/A/m ทองแดง PVC 70°C ตรงกับ BS 7671 Table 4D1B', () => {
    // คอลัมน์ 2 สาย 1 เฟส และ 3/4 สาย 3 เฟส (ส่วน r ของสาย ≥ 25 mm²) — ค่าตีพิมพ์ปัดเลข 2 หลัก
    const single = { 1.5: 29, 2.5: 18, 4: 11, 6: 7.3, 10: 4.4, 16: 2.8 };
    const three = { 1.5: 25, 2.5: 15, 4: 9.5, 6: 6.4, 10: 3.8, 16: 2.4, 25: 1.5, 35: 1.1, 50: 0.80, 70: 0.55, 95: 0.40, 120: 0.32 };
    for (const [s, v] of Object.entries(single)) {
      near(E.voltageDrop({ phase: 1, V: 230, I: 1, L: 1000, material: 'cu', size: +s, pf: 1, x: 0, temp: 70 }).mvam, v, 0.03);
    }
    for (const [s, v] of Object.entries(three)) {
      near(E.voltageDrop({ phase: 3, V: 400, I: 1, L: 1000, material: 'cu', size: +s, pf: 1, x: 0, temp: 70 }).mvam, v, 0.035);
    }
  });

  test('ตัวอย่าง: 1 เฟส 230 V 20 A 30 m สาย 2.5 mm² → ΔV ≈ 10.6 V (4.6%)', () => {
    // 2 · 20 A · 0.030 km · 7.41·(1 + 0.00393·50) Ω/km = 10.64 V
    const r = E.voltageDrop({ phase: 1, V: 230, I: 20, L: 30, material: 'cu', size: 2.5, pf: 1, x: 0, temp: 70 });
    near(r.dV, 10.64, 0.005);
    near(r.pct, 4.626, 0.005);
  });

  test('ตัวอย่าง 3 เฟสมี X: 400 V 100 A 50 m 35 mm² PF 0.85 X 0.08 → ΔV 4.98 V', () => {
    // √3 · 100 · 0.05 · (0.62697·0.85 + 0.08·0.52678) = 4.980 V = 1.245%
    const r = E.voltageDrop({ phase: 3, V: 400, I: 100, L: 50, material: 'cu', size: 35, pf: 0.85, x: 0.08, temp: 70 });
    near(r.dV, 4.980, 0.002);
    near(r.pct, 1.245, 0.002);
  });

  test('สายขนาน 2 ชุด แรงดันตกลดครึ่ง', () => {
    const p = { phase: 3, V: 400, I: 300, L: 100, material: 'cu', size: 120, pf: 0.9, x: 0.08, temp: 70 };
    near(E.voltageDrop({ ...p, parallel: 2 }).dV, E.voltageDrop(p).dV / 2, 1e-9);
  });

  test('พิกัดกระแสที่ 40°C ตรงกับตาราง 5-20 ของ วสท. (กลุ่ม 2)', () => {
    // 2 สายมีกระแส: 2.5 → 21 A, 4 → 28 A · 3 สายมีกระแส: 2.5 → 18 A, 4 → 24 A
    expect(Math.round(E.ampacity(2.5, 2, 40))).toBe(21);
    expect(Math.round(E.ampacity(4, 2, 40))).toBe(28);
    expect(Math.round(E.ampacity(2.5, 3, 40))).toBe(18);
    expect(Math.round(E.ampacity(4, 3, 40))).toBe(24);
  });

  test('เลือกขนาดสาย: ผ่านทั้งพิกัดกระแสและแรงดันตก', () => {
    const r = E.sizeCable({ phase: 3, V: 400, I: 100, L: 80, material: 'cu', insulation: 'pvc', pf: 0.85, x: 0.08, limit: 3, loaded: 3, ambient: 40, derate: 1 });
    // พิกัดกระแส: 35 mm² = 110·0.87 = 95.7 A < 100 → ต้อง 50 mm² (116.6 A); แรงดันตก 50 mm² = 1.51% ≤ 3%
    expect(r.byAmp).toBe(50);
    expect(r.chosen).toBe(50);
    // สายยาวขึ้นมากจนแรงดันตกเป็นตัวกำหนด
    const long = E.sizeCable({ phase: 3, V: 400, I: 100, L: 300, material: 'cu', insulation: 'pvc', pf: 0.85, x: 0.08, limit: 3, loaded: 3, ambient: 40, derate: 1 });
    expect(long.byVd).toBeGreaterThan(long.byAmp);
    expect(long.chosen).toBe(long.byVd);
    const row = long.rows.find((x) => x.size === long.chosen);
    expect(row.pct).toBeLessThanOrEqual(3);
  });
});

test.describe('สูตร: กระแสลัดวงจร IEC 60909', () => {
  test('1000 kVA 400 V u_k 6% แหล่งจ่ายไม่จำกัด → I_n 1443 A, I_k 24.06 kA', () => {
    // I_sc = S / (√3 · U · u_k) = 1,000,000 / (√3 · 400 · 0.06)
    const r = E.shortCircuit({ Un: 400, c: 1, kt: false, Sr: 1000, uk: 6, Pk: 0 });
    near(r.In, 1443.4, 0.001);
    near(r.tr.Ik, 24.056, 0.001);
  });

  test('อิมพีแดนซ์หม้อแปลง 1000 kVA u_k 6% P_k 10.5 kW', () => {
    // Z_T = 0.06·400²/1e6 = 9.6 mΩ, R_T = 10500·400²/1e12 = 1.68 mΩ, X_T = √(9.6² − 1.68²) = 9.452 mΩ
    const r = E.shortCircuit({ Un: 400, c: 1, kt: false, Sr: 1000, uk: 6, Pk: 10.5 });
    near(r.tr.R, 1.68, 0.001);
    near(r.tr.X, 9.452, 0.001);
    near(r.tr.Z, 9.6, 0.001);
  });

  test('K_T และ c ตาม IEC 60909-0:2016', () => {
    // x_T = 0.09452 → K_T = 0.95·1.05/(1 + 0.6·0.09452) = 0.9634
    const r = E.shortCircuit({ Un: 400, c: 1.05, kt: true, Sr: 1000, uk: 6, Pk: 10.5 });
    near(r.KT, 0.9634, 0.001);
    // I_k = 1.05·400/(√3·0.9634·9.6 mΩ) = 26.22 kA
    near(r.tr.Ik, 1.05 * 400 / (Math.sqrt(3) * 0.9634 * 9.6e-3) / 1e3, 0.002);
  });

  test('ตัวคูณยอด κ ตาม IEC 60909 (R/X → 0 ⇒ 2.0, R/X 0.1 ⇒ 1.75, R/X 1 ⇒ 1.07)', () => {
    near(E.kappa(0), 2.0, 0.001);
    near(E.kappa(0.1), 1.746, 0.001);
    near(E.kappa(1), 1.069, 0.002);
  });

  test('แหล่งจ่าย 500 MVA + สายลดกระแสลัดวงจรที่ปลายสาย', () => {
    const base = { Un: 400, c: 1.05, kt: true, Sr: 1000, uk: 6, Pk: 10.5 };
    const inf = E.shortCircuit(base);
    const net = E.shortCircuit({ ...base, SkQ: 500 });
    // Z_Q = 1.05·0.16/500 = 0.336 mΩ → I_k ลดลงเล็กน้อย
    expect(net.tr.Ik).toBeLessThan(inf.tr.Ik);
    const withCable = E.shortCircuit({ ...base, SkQ: 500, cable: { material: 'cu', size: 240, L: 50, x: 0.08, parallel: 2 } });
    // ปลายสาย: R เพิ่ม 0.0754·0.05/2 Ω = 1.885 mΩ, X เพิ่ม 2.0 mΩ
    near(withCable.end.R - withCable.tr.R, 1.885, 0.001);
    near(withCable.end.X - withCable.tr.X, 2.0, 0.001);
    expect(withCable.end.Ik).toBeLessThan(withCable.tr.Ik);
  });
});

test.describe('สูตร: คาปาซิเตอร์แก้ PF', () => {
  test('ตัวคูณ kvar/kW ตรงกับตารางมาตรฐาน', () => {
    // 0.70 → 0.95 = 0.691, 0.80 → 0.95 = 0.421, 0.75 → 0.90 = 0.398
    near(E.pfCorrection({ P: 1, pf1: 0.7, pf2: 0.95, V: 400 }).kFactor, 0.691, 0.002);
    near(E.pfCorrection({ P: 1, pf1: 0.8, pf2: 0.95, V: 400 }).kFactor, 0.421, 0.002);
    near(E.pfCorrection({ P: 1, pf1: 0.75, pf2: 0.9, V: 400 }).kFactor, 0.398, 0.002);
  });

  test('100 kW PF 0.70 → 0.95 ต้องใช้ 69.2 kvar, สเต็ป 25 → ตู้ 75 kvar', () => {
    const r = E.pfCorrection({ P: 100, pf1: 0.7, pf2: 0.95, V: 400, phase: 3, step: 25, rate: 56.07, Sr: 1000, uk: 6 });
    near(r.Qc, 69.15, 0.001);
    expect(r.Qbank).toBe(75);
    expect(r.pfAfter).toBeGreaterThan(0.95);
    // I ก่อน = 100k/(√3·400·0.7) = 206.2 A, กระแสคาปาซิเตอร์ 75k/(√3·400) = 108.3 A, สาย ≥ 1.35 เท่า = 146.1 A
    near(r.I1, 206.2, 0.001);
    near(r.Ic, 108.25, 0.001);
    near(r.Icable, 146.14, 0.001);
    // kvar ส่วนที่เกิน 61.97% ของ kW = 102.02 − 61.97 = 40.05 kvar × 56.07 บาท
    near(r.excessKvar, 40.05, 0.001);
    near(r.penalty, 40.05 * 56.07, 0.001);
    // เรโซแนนซ์: S_sc = 1000/0.06 = 16,667 kVA → h_r = √(16667/75) = 14.9
    near(r.hr, 14.907, 0.001);
  });

  test('1000 kVA u_k 6% + ตู้ 300 kvar → h_r ≈ 7.45 (ใกล้ฮาร์มอนิกที่ 7)', () => {
    // 400 kW 0.70 → 0.95 ต้องใช้ 276.6 kvar → สเต็ป 300 → h_r = √(16,667/300) = 7.454
    const r = E.pfCorrection({ P: 400, pf1: 0.7, pf2: 0.95, V: 400, phase: 3, step: 300, Sr: 1000, uk: 6 });
    expect(r.Qbank).toBe(300);
    near(r.hr, 7.454, 0.001);
  });
});

test.describe('สูตร: ความเป็นฉนวน IEEE 43', () => {
  test('PI, DAR และแก้อุณหภูมิไป 40°C', () => {
    const r = E.insulation({ r30: 800, r60: 1000, r600: 2500, temp: 20, kv: 0.4, cls: 'B', kind: 'random' });
    near(r.pi, 2.5, 1e-9);
    near(r.dar, 1.25, 1e-9);
    near(r.KT, 0.25, 1e-9); // ลดครึ่งทุก 10°C: 20°C → 40°C = ×0.25
    near(r.r40, 250, 1e-9);
    expect(r.minIR).toBe(5);
    expect(r.okIR).toBe(true);
    expect(r.okPI).toBe(true);
    expect(r.piBand).toBe(2);
  });

  test('ค่าต่ำสุดตาม Table 3/4 และแรงดันทดสอบตาม Table 1', () => {
    expect(E.insulation({ r60: 50, r600: 70, temp: 40, kv: 6.6, kind: 'form', cls: 'B' }).minIR).toBe(100);
    expect(E.insulation({ r60: 50, r600: 70, temp: 40, kv: 6.6, kind: 'old', cls: 'B' }).minIR).toBeCloseTo(7.6, 9);
    const a = E.insulation({ r60: 50, r600: 80, temp: 40, kv: 0.4, kind: 'random', cls: 'A' });
    expect(a.minPI).toBe(1.5);
    expect(a.okPI).toBe(true); // 1.6 ≥ 1.5 สำหรับ class A แต่ไม่ผ่าน class B
    expect(E.insulation({ r60: 50, r600: 80, temp: 40, kv: 0.4, kind: 'random', cls: 'B' }).okPI).toBe(false);
    expect(E.testVoltage(400)).toEqual([500, 500]);
    expect(E.testVoltage(2400)).toEqual([500, 1000]);
    expect(E.testVoltage(4160)).toEqual([1000, 2500]);
    expect(E.testVoltage(6600)).toEqual([2500, 5000]);
    expect(E.testVoltage(13800)).toEqual([5000, 10000]);
  });

  test('IR สูงกว่า 5,000 MΩ ที่ 40°C ไม่ต้องใช้ PI', () => {
    expect(E.insulation({ r60: 8000, r600: 9000, temp: 40, kv: 0.4, kind: 'random', cls: 'B' }).piWaived).toBe(true);
  });
});

test.describe('สูตร: ระบบกราวด์', () => {
  test('Wenner ρ = 2πaR', () => {
    near(E.wenner(3, 5.3), 99.90, 0.001);
  });

  test('หลักดินแท่งเดียว (Dwight): 3 m Ø 5/8″ ใน 100 Ω·m ≈ 33.5 Ω (≈ ρ/L)', () => {
    near(E.rodResistance(100, 3, 15.875), 33.53, 0.002);
    near(E.rodResistance(100, 3, 15.875), 100 / 3, 0.02);
    // หลักดินมาตรฐานไทย 2.4 m Ø 5/8″
    near(E.rodResistance(100, 2.4, 15.875), 40.44, 0.002);
  });

  test('หลายแท่งเรียงแนว BS 7430: 2 แท่งห่าง 3 m', () => {
    const R1 = E.rodResistance(100, 2.4, 15.875);
    // α = 100/(2π·40.44·3) = 0.1312 → R2 = 40.44·(1 + 1.0·0.1312)/2 = 22.87 Ω
    near(E.rodsInLine(R1, 2, 3, 100), 22.87, 0.002);
    // ห่างมากขึ้น → ใกล้ R1/n
    expect(E.rodsInLine(R1, 4, 100, 100)).toBeLessThan(E.rodsInLine(R1, 4, 3, 100));
    near(E.rodsInLine(R1, 4, 1e6, 100), R1 / 4, 0.001);
  });

  test('สายดิน adiabatic: 6 kA 0.4 s k 115 → 33 mm² → ใช้ 35 mm²', () => {
    const s = E.adiabaticSize(6, 0.4, 115);
    near(s, 33.0, 0.002);
    expect(E.nextSize(s)).toBe(35);
  });
});

test.describe('สูตร: protective margin กับดักฟ้าผ่า', () => {
  test('BIL 125 kV, U_res 70 kV, สายต่อ 1.5 m → U 85 kV, PM 47.1%', () => {
    // U_lead = 1 µH/m · 1.5 m · 10 kA/µs = 15 kV
    const r = E.arrester({ bil: 125, vres: 70, lead: 1.5, lprime: 1, didt: 10 });
    near(r.lead, 15, 1e-9);
    near(r.U, 85, 1e-9);
    near(r.pm, 47.06, 0.001);
    expect(r.okIeee).toBe(true);
    near(r.maxVres, 125 / 1.2 - 15, 1e-9);
  });

  test('คลื่นสะท้อนจากระยะห่าง + เกณฑ์ IEEE 20% / IEC 15%', () => {
    // 2·S·d/v = 2·500·9/300 = 30 kV → U = 70 + 15 + 30 = 115 kV → PM 8.7% ไม่ผ่านทั้งสอง
    const r = E.arrester({ bil: 125, vres: 70, lead: 1.5, lprime: 1, didt: 10, d: 9, S: 500 });
    near(r.sep, 30, 1e-9);
    expect(r.okIeee).toBe(false);
    expect(r.okIec).toBe(false);
    // PM 17.6% ผ่าน IEC (≥ 15) แต่ไม่ผ่าน IEEE (≥ 20)
    const mid = E.arrester({ bil: 100, vres: 85, lead: 0, lprime: 1, didt: 10 });
    expect(mid.okIec).toBe(true);
    expect(mid.okIeee).toBe(false);
    // สวิตชิ่ง BSL/SIPL
    near(E.arrester({ bil: 550, vres: 300, bsl: 460, sipl: 380 }).pmSI, 21.05, 0.001);
  });

  test('ตาราง BIL ตาม IEC 60071-1 สำหรับระบบในไทย', () => {
    expect(E.BIL_TABLE[24]).toContain(125); // 22 kV
    expect(E.BIL_TABLE[36]).toContain(170); // 33 kV
    expect(E.BIL_TABLE[123]).toContain(550); // 115 kV
  });
});

test.describe('หน้า electrical.html', () => {
  test('คำนวณสดตามค่าที่กรอก + จำค่า + สลับแท็บ', async ({ page }) => {
    const errors = await prepare(page);
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('/electrical.html', { waitUntil: 'load' });
    await page.waitForSelector('nav.ome-nav');

    // ค่าเริ่มต้น: 3 เฟส 400 V 100 A 80 m → ขนาดแนะนำ 50 mm²
    await expect(page.locator('#vdKpi')).toContainText('50');
    await expect(page.locator('#vdTable tr.pick td').first()).toHaveText('50');
    await page.selectOption('#vdSize', '16');
    await expect(page.locator('#vdVerdict .callout.err')).toBeVisible();

    await page.click('[data-tab="pf"]');
    await expect(page.locator('[data-panel="pf"]')).toBeVisible();
    await expect(page.locator('[data-panel="vd"]')).toBeHidden();
    await page.fill('#pfP', '100');
    await page.fill('#pfPf1', '0.7');
    await expect(page.locator('#pfKpi')).toContainText('69.2');

    await page.click('[data-tab="sa"]');
    await page.fill('#saVres', '70');
    await page.fill('#saLead', '1.5');
    await expect(page.locator('#saKpi')).toContainText('47.1');

    await page.click('[data-tab="gnd"]');
    await page.click('#gUseRho');
    await expect(page.locator('#gRho')).toHaveValue('99.9');

    // โหลดใหม่ → อยู่แท็บเดิม ค่าเดิม
    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('[data-panel="gnd"]')).toBeVisible();
    await expect(page.locator('#gRho')).toHaveValue('99.9');
    await page.click('[data-tab="vd"]');
    await expect(page.locator('#vdSize')).toHaveValue('16');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:elec:inputs') || '{}'));
    expect(stored.v.pfP).toBe('100');

    expect(errors).toEqual([]);
  });

  test('ภาษาอังกฤษ + จอ 390px ไม่ล้น ทุกแท็บ', async ({ page }) => {
    const errors = await prepare(page);
    await page.addInitScript(() => localStorage.setItem('ome:lang', 'en'));
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/electrical.html', { waitUntil: 'load' });
    await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('h1')).toHaveText('Electrical Calculator');
    for (const tab of ['vd', 'sc', 'pf', 'ir', 'gnd', 'sa']) {
      await page.click(`[data-tab="${tab}"]`);
      await expect(page.locator(`[data-panel="${tab}"]`)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow on ${tab}`).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });
});
