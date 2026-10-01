/* ══════════════════════════════════════════════════════════════════
   Tanot — สูตรเครื่องคำนวณไฟฟ้า (ไม่มี DOM) · window.ElecCalc / module.exports
   หน้า electrical.html ใช้ไฟล์นี้ และ tests/electrical.spec.js เรียกตรงจาก Node เพื่อเทียบกับตัวอย่างที่รู้คำตอบ

   หน่วยที่ใช้ทั้งไฟล์ (ระบุซ้ำในแต่ละฟังก์ชัน):
     แรงดัน V (โวลต์) · กระแส A · ความยาว m · ความต้านทาน/รีแอกแตนซ์สาย Ω/km · ขนาดสาย mm²
     กำลัง kW / kvar / kVA · อุณหภูมิ °C · ความต้านทานฉนวน MΩ · ความต้านทานดิน Ω · สภาพต้านทานดิน Ω·m
     แรงดันอิมพัลส์ kV (ยอด) · ความเหนี่ยวนำ µH/m · di/dt kA/µs

   มาตรฐานอ้างอิง:
     - มาตรฐานการติดตั้งทางไฟฟ้าสำหรับประเทศไทย พ.ศ. 2564 (วสท. 022001-22) — เกณฑ์แรงดันตก, สายคาปาซิเตอร์ 135%,
       ตารางขนาดกระแส (ตาราง 5-20 สร้างจาก IEC 60364-5-52 ที่อุณหภูมิโดยรอบ 40°C)
     - IEC 60228 (ความต้านทานตัวนำ), IEC 60364-5-52 (ขนาดกระแส/แรงดันตก), IEC 60364-5-54 (สายดิน, สมการ adiabatic)
     - IEC 60909-0:2016 (กระแสลัดวงจร), IEC 60831 / IEEE 1531 (คาปาซิเตอร์), IEEE 43-2013 (PI/DAR)
     - IEEE 142 / BS 7430 (หลักดิน), IEC 60071-1/-2 + IEEE C62.22 (การประสานฉนวน / กับดักฟ้าผ่า)
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ElecCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SQRT3 = Math.sqrt(3);

  /* ── ข้อมูลสาย ─────────────────────────────────────────────────────
     R20: ความต้านทานกระแสตรงสูงสุดที่ 20°C ของตัวนำตีเกลียว class 2 ตาม IEC 60228 Table 2 [Ω/km]
     ALPHA: สัมประสิทธิ์อุณหภูมิของความต้านทานที่ 20°C [1/°C] (IEC 60287-1-1 Table 1) */
  var SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
  var R20 = {
    cu: { 1.5: 12.1, 2.5: 7.41, 4: 4.61, 6: 3.08, 10: 1.83, 16: 1.15, 25: 0.727, 35: 0.524, 50: 0.387, 70: 0.268,
          95: 0.193, 120: 0.153, 150: 0.124, 185: 0.0991, 240: 0.0754, 300: 0.0601, 400: 0.0470, 500: 0.0366, 630: 0.0283 },
    al: { 16: 1.91, 25: 1.20, 35: 0.868, 50: 0.641, 70: 0.443, 95: 0.320, 120: 0.253, 150: 0.206, 185: 0.164,
          240: 0.125, 300: 0.100, 400: 0.0778, 500: 0.0605, 630: 0.0469 }
  };
  var ALPHA = { cu: 0.00393, al: 0.00403 };
  /* อุณหภูมิตัวนำสูงสุดใช้งานต่อเนื่อง [°C]: PVC (เช่น IEC 01/THW, NYY) 70, XLPE (CV, XLPE/PVC) 90 */
  var T_MAX = { pvc: 70, xlpe: 90 };

  /* ขนาดกระแสสายทองแดงหุ้ม PVC 70°C ร้อยท่อเดินเกาะผนัง (IEC 60364-5-52 วิธี B1 = วสท. กลุ่มที่ 2) [A]
     ที่อุณหภูมิโดยรอบ 30°C — ค่าตาม BS 7671 Table 4D1A ref. method B (col 4 = 2 สายมีกระแส, col 5 = 3 สายมีกระแส)
     คูณ AMB_PVC[40] = 0.87 แล้วได้ค่าตาราง 5-20 ของ วสท. ที่ 40°C (เช่น 2.5 mm²: 2 สาย 21 A, 3 สาย 18 A) */
  var AMP_B1_PVC_CU = {
    2: { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 101, 35: 125, 50: 151, 70: 192, 95: 232, 120: 269,
         150: 300, 185: 341, 240: 400, 300: 458 },
    3: { 1.5: 15.5, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 68, 25: 89, 35: 110, 50: 134, 70: 171, 95: 207, 120: 239,
         150: 262, 185: 296, 240: 346, 300: 394 }
  };
  /* ตัวคูณแก้อุณหภูมิโดยรอบ ฉนวน PVC (IEC 60364-5-52 Table B.52.14) */
  var AMB_PVC = { 25: 1.06, 30: 1.00, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71, 55: 0.61 };

  /* เกณฑ์แรงดันตก วสท.: สายป้อน ≤ 3%, วงจรย่อย ≤ 3%, รวมจากจุดต่อไฟถึงโหลด ≤ 5% [%] */
  var VD_LIMIT = { feeder: 3, branch: 3, total: 5 };

  function num(v) { var n = typeof v === 'number' ? v : parseFloat(v); return isFinite(n) ? n : NaN; }

  /** ความต้านทานตัวนำที่อุณหภูมิ T: R_T = R20 · [1 + α (T − 20)]  [Ω/km]
      ไม่รวม skin/proximity effect (ต่ำกว่า ~2% ถึง 150 mm² ที่ 50 Hz, ~5% ที่ 240 mm²) */
  function rAt(material, size, tempC) {
    var r = R20[material] && R20[material][size];
    if (!r) return NaN;
    return r * (1 + ALPHA[material] * (tempC - 20));
  }

  /** แรงดันตก (IEC 60364-5-52 Annex G):
        ΔV = b · I · L · (R cosφ + X sinφ)      b = 2 (1 เฟส 2 สาย), √3 (3 เฟส, เทียบแรงดันระหว่างสาย)
        ΔV% = 100 · ΔV / V
      p = { phase: 1|3, V [V], I [A], L [m], material 'cu'|'al', size [mm²], pf, x [Ω/km], temp [°C], parallel }
      คืน { dV [V], pct [%], r [Ω/km], mvam [mV/A/m] } */
  function voltageDrop(p) {
    var phase = p.phase === 1 ? 1 : 3;
    var b = phase === 1 ? 2 : SQRT3;
    var pf = Math.min(1, Math.max(0, num(p.pf)));
    var sin = Math.sqrt(1 - pf * pf);
    var n = Math.max(1, Math.round(num(p.parallel) || 1));
    var r = rAt(p.material, p.size, num(p.temp)) / n;
    var x = (num(p.x) || 0) / n;
    var zEff = r * pf + x * sin; // Ω/km
    var dV = b * num(p.I) * (num(p.L) / 1000) * zEff;
    return { dV: dV, pct: 100 * dV / num(p.V), r: r, x: x, mvam: b * zEff };
  }

  /** พิกัดกระแสสายทองแดง PVC วิธี B1 หลังแก้อุณหภูมิ/ตัวคูณลดพิกัดอื่น: Iz = It · k_amb · k  [A] */
  function ampacity(size, loaded, ambient, derate) {
    var t = AMP_B1_PVC_CU[loaded === 2 ? 2 : 3][size];
    var k = AMB_PVC[ambient];
    if (!t || !k) return NaN;
    return t * k * (isFinite(num(derate)) && num(derate) > 0 ? num(derate) : 1);
  }

  /** เลือกขนาดสายเล็กที่สุดที่ผ่านทั้ง (1) แรงดันตก ≤ limit และ (2) Iz ≥ I (ตรวจข้อ 2 เฉพาะทองแดง PVC ที่มีตาราง)
      p = voltageDrop params + { insulation 'pvc'|'xlpe', limit [%], loaded 2|3, ambient [°C], derate }
      คืน { rows: [{ size, pct, dV, iz, okVd, okAmp }], chosen: size|null, byVd, byAmp, ampChecked } */
  function sizeCable(p) {
    var temp = T_MAX[p.insulation] || 70;
    var ampChecked = p.material === 'cu' && p.insulation === 'pvc';
    var n = Math.max(1, Math.round(num(p.parallel) || 1));
    var rows = [], byVd = null, byAmp = null, chosen = null;
    SIZES.forEach(function (s) {
      if (!R20[p.material][s]) return;
      if (ampChecked && !AMP_B1_PVC_CU[3][s]) return;
      var vd = voltageDrop({ phase: p.phase, V: p.V, I: p.I, L: p.L, material: p.material, size: s, pf: p.pf, x: p.x, temp: temp, parallel: n });
      var iz = ampChecked ? ampacity(s, p.loaded, p.ambient, p.derate) * n : NaN;
      var okVd = vd.pct <= num(p.limit);
      var okAmp = ampChecked ? iz >= num(p.I) : true;
      if (okVd && byVd == null) byVd = s;
      if (ampChecked && okAmp && byAmp == null) byAmp = s;
      if (okVd && okAmp && chosen == null) chosen = s;
      rows.push({ size: s, pct: vd.pct, dV: vd.dV, iz: iz, okVd: okVd, okAmp: okAmp });
    });
    return { rows: rows, chosen: chosen, byVd: byVd, byAmp: byAmp, ampChecked: ampChecked, temp: temp };
  }

  /* ── กระแสลัดวงจร 3 เฟสสมมาตร (IEC 60909-0:2016) ──────────────────
     แหล่งจ่าย (อ้างอิงฝั่งแรงต่ำ):  Z_Q = c · Un² / S"kQ,  X_Q = 0.995 Z_Q,  R_Q = 0.1 X_Q          (eq. 1, 2)
     หม้อแปลง:  Z_T = (u_kr/100) · Un² / S_rT,  R_T = P_krT · Un² / S_rT²,  X_T = √(Z_T² − R_T²)   (eq. 7–9)
                K_T = 0.95 · c_max / (1 + 0.6 x_T),  x_T = X_T / (Un²/S_rT)                     (eq. 12a)
     สาย: R ที่ 20°C (กรณีกระแสสูงสุด), X ตามผู้ผลิต [Ω/km]
     I"k3 = c · Un / (√3 · |Z_k|)                                                              (eq. 29)
     κ = 1.02 + 0.98 · e^(−3R/X),  i_p = κ · √2 · I"k3                                         (eq. 55, 54)
     p = { Un [V], c, kt (bool ใช้ K_T), SkQ [MVA] (0/ว่าง = แหล่งจ่ายไม่จำกัด), Sr [kVA], uk [%], Pk [kW],
           cable: { material, size, L [m], x [Ω/km], parallel } (ไม่บังคับ) }
     คืน { In [A], tr: point, end: point|null }  โดย point = { R, X, Z [mΩ], Ik [kA], kappa, ip [kA] } */
  function kappa(rx) { return 1.02 + 0.98 * Math.exp(-3 * rx); }

  function shortCircuit(p) {
    var Un = num(p.Un), c = num(p.c) || 1, Sr = num(p.Sr) * 1e3, uk = num(p.uk) / 100, Pk = (num(p.Pk) || 0) * 1e3;
    var SkQ = num(p.SkQ) * 1e6;
    var zBase = Un * Un / Sr; // Ω
    var RQ = 0, XQ = 0;
    if (SkQ > 0) {
      var ZQ = c * Un * Un / SkQ;
      XQ = 0.995 * ZQ; RQ = 0.1 * XQ;
    }
    var ZT = uk * zBase;
    var RT = Pk * Un * Un / (Sr * Sr);
    var XT = Math.sqrt(Math.max(0, ZT * ZT - RT * RT));
    var KT = p.kt ? 0.95 * c / (1 + 0.6 * (XT / zBase)) : 1;
    RT *= KT; XT *= KT;

    function point(R, X) {
      var Z = Math.sqrt(R * R + X * X);
      var Ik = c * Un / (SQRT3 * Z);
      var k = X > 0 ? kappa(R / X) : 1.02;
      return { R: R * 1e3, X: X * 1e3, Z: Z * 1e3, Ik: Ik / 1e3, kappa: k, ip: k * Math.SQRT2 * Ik / 1e3 };
    }
    var R = RQ + RT, X = XQ + XT;
    var out = { In: Sr / (SQRT3 * Un), KT: KT, tr: point(R, X), end: null };
    var cb = p.cable;
    if (cb && num(cb.L) > 0 && R20[cb.material] && R20[cb.material][cb.size]) {
      var n = Math.max(1, Math.round(num(cb.parallel) || 1));
      var Lkm = num(cb.L) / 1000;
      out.end = point(R + R20[cb.material][cb.size] * Lkm / n, X + (num(cb.x) || 0) * Lkm / n);
    }
    return out;
  }

  /* ── คาปาซิเตอร์แก้ค่าตัวประกอบกำลัง ─────────────────────────────
     Qc = P · (tanφ1 − tanφ2)  [kvar]
     I = P / (√3 · V · PF) (3 เฟส) หรือ P / (V · PF) (1 เฟส)  [A]
     กระแสพิกัดคาปาซิเตอร์ Ic = Qc / (√3 V);  สายวงจรคาปาซิเตอร์ ≥ 1.35 Ic (วสท. ตาม NEC 460.8)
     ค่าปรับ PF ของ กฟภ./กฟน.: คิดเฉพาะ kvar ส่วนที่เกิน 61.97% ของ kW (= tan(acos 0.85)) ต่อเดือน
     ความถี่เรโซแนนซ์ขนาน (IEEE 1531): h_r = √(S_sc / Qc),  S_sc ≈ S_rT / u_k  [kVA]
     p = { P [kW], pf1, pf2, V [V], phase 1|3, step [kvar], rate [บาท/kvar], Sr [kVA], uk [%] } */
  function tanAcos(pf) { return Math.sqrt(1 - pf * pf) / pf; }

  function pfCorrection(p) {
    var P = num(p.P), pf1 = num(p.pf1), pf2 = num(p.pf2), V = num(p.V);
    var phase = p.phase === 1 ? 1 : 3;
    var k = phase === 1 ? V : SQRT3 * V;
    var Q1 = P * tanAcos(pf1), Q2 = P * tanAcos(pf2);
    var Qc = Math.max(0, Q1 - Q2);
    var step = num(p.step);
    var Qbank = step > 0 ? Math.ceil(Qc / step - 1e-9) * step : Qc;
    var Qafter = Q1 - Qbank;
    var pfAfter = P / Math.sqrt(P * P + Qafter * Qafter);
    var Ssc = num(p.Sr) > 0 && num(p.uk) > 0 ? num(p.Sr) / (num(p.uk) / 100) : NaN;
    var excess = Math.max(0, Q1 - 0.6197 * P);
    return {
      kFactor: tanAcos(pf1) - tanAcos(pf2),
      Q1: Q1, Q2: Q2, Qc: Qc, Qbank: Qbank, pfAfter: pfAfter, leading: Qafter < 0,
      S1: P / pf1, S2: Math.sqrt(P * P + Qafter * Qafter),
      I1: P * 1e3 / (k * pf1), I2: Math.sqrt(P * P + Qafter * Qafter) * 1e3 / k,
      Ic: Qbank * 1e3 / k, Icable: 1.35 * Qbank * 1e3 / k,
      excessKvar: excess, penalty: excess * (num(p.rate) || 0),
      Ssc: Ssc, hr: Qbank > 0 && Ssc > 0 ? Math.sqrt(Ssc / Qbank) : NaN
    };
  }

  /* ── ความต้านทานฉนวน (IEEE 43-2013) ───────────────────────────────
     DAR = R60s / R30s          PI = R10min / R1min
     แก้อุณหภูมิไปที่ 40°C แบบประมาณ (ลดครึ่งทุก 10°C): R40 = K_T · R_T,  K_T = 0.5^((40 − T)/10)
     ค่าต่ำสุด IR1min ที่ 40°C (Table 3): kV + 1 (ทั่วไป/ก่อน ~1970), 100 MΩ (form-wound หลัง ~1970), 5 MΩ (random-wound, < 1 kV)
     PI ต่ำสุด (Table 4): class A ≥ 1.5, class B/F/H ≥ 2.0 — ถ้า IR1min(40°C) > 5000 MΩ ไม่ต้องใช้ PI ตัดสิน
     p = { r30, r60, r600 [MΩ], temp [°C], kv [kV พิกัดขดลวด], cls 'A'|'B', kind 'old'|'form'|'random' } */
  function insulation(p) {
    var r30 = num(p.r30), r60 = num(p.r60), r600 = num(p.r600), T = num(p.temp), kv = num(p.kv);
    var KT = isFinite(T) ? Math.pow(0.5, (40 - T) / 10) : 1;
    var r40 = r60 * KT;
    var minIR = p.kind === 'form' ? 100 : p.kind === 'random' ? 5 : (isFinite(kv) ? kv + 1 : NaN);
    var minPI = p.cls === 'A' ? 1.5 : 2.0;
    var pi = r600 / r60, dar = r60 / r30;
    return {
      pi: pi, dar: dar, KT: KT, r40: r40, minIR: minIR, minPI: minPI,
      okIR: r40 >= minIR, okPI: pi >= minPI, piWaived: r40 > 5000,
      piBand: band(pi, [1, 2, 4]), darBand: band(dar, [1, 1.25, 1.6]),
      testV: testVoltage(kv * 1000)
    };
  }
  /* ระดับคุณภาพ 0 = อันตราย/แย่, 1 = น่าสงสัย, 2 = ดี, 3 = ดีมาก
     PI: < 1 / 1–2 / 2–4 / > 4  ·  DAR: < 1 / 1–1.25 / 1.25–1.6 / > 1.6  (เกณฑ์ใช้งานทั่วไปของผู้ผลิตเครื่องวัดฉนวน) */
  function band(v, cut) {
    if (!isFinite(v)) return -1;
    return v < cut[0] ? 0 : v < cut[1] ? 1 : v <= cut[2] ? 2 : 3;
  }
  /** แรงดันทดสอบ DC ตามแรงดันพิกัดขดลวด (IEEE 43-2013 Table 1) — คืน [ต่ำ, สูง] V */
  function testVoltage(ratedV) {
    if (!(ratedV > 0)) return null;
    if (ratedV < 1000) return [500, 500];
    if (ratedV <= 2500) return [500, 1000];
    if (ratedV <= 5000) return [1000, 2500];
    if (ratedV <= 12000) return [2500, 5000];
    return [5000, 10000];
  }

  /* ── ระบบกราวด์ ───────────────────────────────────────────────────
     สภาพต้านทานดินแบบเวนเนอร์ (IEEE 81, ระยะฝังหลักวัด ≪ a): ρ = 2π · a · R           [Ω·m]
     หลักดินแท่งเดียว (Dwight, IEEE 142 Table 4-5): R1 = ρ/(2πL) · [ln(4L/r) − 1]           [Ω]
     หลักดิน n แท่งเรียงเส้นตรงระยะห่าง s (BS 7430:2011): Rn = R1 · (1 + λα) / n,  α = ρ/(2π R1 s)
     ขนาดสายดิน (IEC 60364-5-54 §543.1.2, adiabatic): S = √(I² t) / k                      [mm²]
       k: ทองแดงหุ้ม PVC ในสายเคเบิลเดียวกัน 115, หุ้ม PVC แยกเดี่ยว 143, XLPE แยกเดี่ยว 176 (Table A.54.2/A.54.3)
     เกณฑ์ วสท.: ความต้านทานหลักดินกับดินไม่เกิน 5 Ω (ค่าตั้งต้นของช่อง "ค่าเป้าหมาย") */
  var LAMBDA_LINE = { 1: 0, 2: 1.00, 3: 1.66, 4: 2.15, 5: 2.54, 6: 2.87, 7: 3.15, 8: 3.39, 9: 3.61, 10: 3.81 };

  function wenner(a, R) { return 2 * Math.PI * num(a) * num(R); }

  function rodResistance(rho, L, dMm) {
    var r = num(dMm) / 2000; // m
    return num(rho) / (2 * Math.PI * num(L)) * (Math.log(4 * num(L) / r) - 1);
  }

  function rodsInLine(R1, n, s, rho) {
    n = Math.round(num(n));
    if (n <= 1) return R1;
    var lambda = LAMBDA_LINE[n];
    if (lambda == null) return NaN;
    var alpha = num(rho) / (2 * Math.PI * R1 * num(s));
    return R1 * (1 + lambda * alpha) / n;
  }

  function adiabaticSize(IkA, t, k) {
    return Math.sqrt(Math.pow(num(IkA) * 1e3, 2) * num(t)) / num(k);
  }
  function nextSize(s) {
    for (var i = 0; i < SIZES.length; i++) if (SIZES[i] >= s - 1e-9) return SIZES[i];
    return null;
  }

  /* ── กับดักฟ้าผ่า: protective margin (IEC 60071-2, IEEE C62.22) ───
     แรงดันที่อุปกรณ์:  U = U_res + U_lead + 2·S·T
        U_lead = L' · ℓ · di/dt     [µH/m · m · kA/µs = kV]   (สายต่อเข้า + สายลงดินของกับดัก)
        2·S·T  = 2 · S · d / v      [kV/µs · m / (m/µs)]       (คลื่นสะท้อนจากระยะห่างกับดัก–อุปกรณ์, v = 300 m/µs สายอากาศ)
     PM_LI = (BIL / U − 1) · 100      เกณฑ์ IEEE C62.22 ≥ 20%, IEC 60071-2 K_s = 1.15 (ฉนวนภายใน) ≥ 15%
     PM_SI = (BSL / SIPL − 1) · 100   เกณฑ์ IEEE C62.22 ≥ 15%
     p = { bil, vres, lead [m], lprime [µH/m], didt [kA/µs], d [m], S [kV/µs], bsl, sipl [kV] } */
  var BIL_TABLE = { // IEC 60071-1 Table 2 (range I): Um [kV rms] → BIL [kV ยอด]  · 22 kV → 24, 33 kV → 36, 115 kV → 123
    3.6: [20, 40], 7.2: [40, 60], 12: [60, 75, 95], 17.5: [75, 95], 24: [95, 125, 145], 36: [145, 170],
    52: [250], 72.5: [325], 100: [380, 450], 123: [450, 550], 145: [550, 650], 170: [650, 750], 245: [850, 950, 1050]
  };

  function arrester(p) {
    var lead = (num(p.lprime) || 0) * (num(p.lead) || 0) * (num(p.didt) || 0);
    var sep = num(p.d) > 0 && num(p.S) > 0 ? 2 * num(p.S) * num(p.d) / 300 : 0;
    var U = num(p.vres) + lead + sep;
    var pm = (num(p.bil) / U - 1) * 100;
    var pmSI = num(p.bsl) > 0 && num(p.sipl) > 0 ? (num(p.bsl) / num(p.sipl) - 1) * 100 : NaN;
    return {
      lead: lead, sep: sep, U: U, pm: pm, okIeee: pm >= 20, okIec: pm >= 15,
      maxVres: num(p.bil) / 1.2 - lead - sep,
      pmSI: pmSI, okSI: pmSI >= 15
    };
  }

  return {
    SIZES: SIZES, R20: R20, ALPHA: ALPHA, T_MAX: T_MAX, AMP_B1_PVC_CU: AMP_B1_PVC_CU, AMB_PVC: AMB_PVC,
    VD_LIMIT: VD_LIMIT, BIL_TABLE: BIL_TABLE, LAMBDA_LINE: LAMBDA_LINE,
    rAt: rAt, voltageDrop: voltageDrop, ampacity: ampacity, sizeCable: sizeCable,
    kappa: kappa, shortCircuit: shortCircuit,
    tanAcos: tanAcos, pfCorrection: pfCorrection,
    insulation: insulation, testVoltage: testVoltage, band: band,
    wenner: wenner, rodResistance: rodResistance, rodsInLine: rodsInLine, adiabaticSize: adiabaticSize, nextSize: nextSize,
    arrester: arrester
  };
});
