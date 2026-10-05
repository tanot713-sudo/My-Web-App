/* ══════════════════════════════════════════════════════════════════
   Tanot — เครื่องคำนวณไฟฟ้า (electrical.html) · ส่วนแสดงผล
   สูตร/ตาราง/มาตรฐานอ้างอิงทั้งหมดอยู่ใน electrical-calc.js (window.ElecCalc) — ไฟล์นี้แค่อ่านช่องกรอก
   คำนวณใหม่ทุกครั้งที่แก้ค่า แล้ววาดผล · ค่าที่กรอกเก็บในเครื่อง localStorage['tanot:elec:inputs'] (kind 'local')
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var E = window.ElecCalc;
  var $ = function (id) { return document.getElementById(id); };
  var STORE_KEY = 'tanot:elec:inputs';

  /* ══════ ระบบสองภาษา (ไทย/อังกฤษ) — คีย์กลาง 'ome:lang' + OME_LANG.onChange (i18n.js) ══════ */
  function getUILang() { try { return localStorage.getItem('ome:lang') === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      title: 'เครื่องคำนวณไฟฟ้า',
      tabVd: 'แรงดันตก/ขนาดสาย', tabSc: 'กระแสลัดวงจร', tabPf: 'คาปาซิเตอร์แก้ PF', tabIr: 'ฉนวน PI/DAR', tabGnd: 'ระบบกราวด์', tabSa: 'กับดักฟ้าผ่า',
      inputs: 'ข้อมูลวงจร', lblSystem: 'ระบบ', opt3ph: '3 เฟส', opt1ph: '1 เฟส', lblVoltage: 'แรงดัน (V)',
      lblCurrent: 'กระแสโหลด (A)', lblLength: 'ความยาวสาย (m)', lblPf: 'ตัวประกอบกำลัง (cos φ)',
      lblMaterial: 'ตัวนำ', optCu: 'ทองแดง', optAl: 'อะลูมิเนียม', lblInsulation: 'ฉนวน', lblX: 'รีแอกแตนซ์สาย (Ω/km)',
      lblParallel: 'จำนวนสายขนานต่อเฟส', lblLimit: 'เกณฑ์แรงดันตก (%)', lblSizeUsed: 'ขนาดสายที่ใช้ (mm²)', lblSize: 'ขนาดสาย (mm²)',
      lblLoaded: 'สายที่มีกระแสในท่อ', lblAmbient: 'อุณหภูมิโดยรอบ (°C)', lblDerate: 'ตัวคูณลดพิกัดอื่น',
      kVd: 'แรงดันตก', kIz: 'พิกัดกระแสสาย', kRec: 'ขนาดแนะนำ', kRecNone: 'ไม่มีขนาดที่ผ่าน',
      thSize: 'ขนาด (mm²)', thVd: 'แรงดันตก', thIz: 'I<sub>z</sub> (A)', thStatus: 'ผล',
      okBoth: 'ผ่าน', failVd: 'แรงดันตกเกิน', failAmp: 'กระแสเกินพิกัด',
      vdOk: 'สาย {s} mm² ผ่าน: แรงดันตก {p}% ≤ {l}%{amp}', vdOkAmp: ', I<sub>z</sub> {iz} A ≥ {i} A',
      vdBadVd: 'สาย {s} mm² แรงดันตก {p}% เกินเกณฑ์ {l}%', vdBadAmp: 'สาย {s} mm² รับกระแสได้ {iz} A น้อยกว่าโหลด {i} A',
      vdNoAmp: 'ไม่ได้ตรวจพิกัดกระแส (มีตารางเฉพาะทองแดง PVC)', vdTemp: 'R ที่ {t}°C',
      scSource: 'หม้อแปลงและแหล่งจ่าย', lblSr: 'พิกัดหม้อแปลง (kVA)', lblUk: 'อิมพีแดนซ์ u<sub>k</sub> (%)', lblPk: 'กำลังสูญเสียในขดลวด P<sub>k</sub> (kW)',
      lblUn: 'แรงดันด้านแรงต่ำ (V)', lblSkq: 'กำลังลัดวงจรระบบ S″<sub>kQ</sub> (MVA)', lblMethod: 'วิธีคำนวณ', optSimple: 'S / (√3·U·uk)',
      scCable: 'สายจากหม้อแปลงถึงตู้ย่อย', lblIcuTr: 'I<sub>cu</sub> เบรกเกอร์ตู้ MDB (kA)', lblIcuEnd: 'I<sub>cu</sub> เบรกเกอร์ตู้ย่อย (kA)',
      kIn: 'กระแสพิกัดหม้อแปลง', kIkTr: 'I″<sub>k3</sub> ที่ตู้ MDB', kIkEnd: 'I″<sub>k3</sub> ที่ตู้ย่อย',
      thPoint: 'ตำแหน่ง', thIk: 'I″<sub>k3</sub> (kA)', thIp: 'i<sub>p</sub> (kA)', thKappa: 'κ', thRX: 'R/X', thZ: 'Z (mΩ)',
      ptTr: 'ตู้ MDB', ptEnd: 'ตู้ย่อย', icuOk: '{pt}: I<sub>cu</sub> {icu} kA ≥ {ik} kA', icuBad: '{pt}: I<sub>cu</sub> {icu} kA ต่ำกว่า I″<sub>k3</sub> {ik} kA',
      lblP: 'กำลังจริง P (kW)', lblPf1: 'PF ปัจจุบัน', lblPf2: 'PF เป้าหมาย', lblStep: 'ขนาดสเต็ปคาปาซิเตอร์ (kvar)', lblRate: 'ค่าเพาเวอร์แฟคเตอร์ (บาท/kvar)',
      kQc: 'คาปาซิเตอร์ที่ต้องใช้', kBank: 'ขนาดตู้ที่เลือก', kPfAfter: 'PF หลังติดตั้ง', kIdrop: 'กระแสลดลง',
      kvK: 'ตัวคูณ tan φ₁ − tan φ₂', kvS: 'kVA ก่อน → หลัง', kvI: 'กระแสก่อน → หลัง (A)', kvIc: 'กระแสพิกัดคาปาซิเตอร์ (A)',
      kvIcable: 'สายวงจรคาปาซิเตอร์ ≥ 1.35 I<sub>c</sub> (A)', kvExcess: 'kvar ที่เกิน 61.97% ของ kW', kvPenalty: 'ค่าเพาเวอร์แฟคเตอร์/เดือน (บาท)',
      kvSsc: 'กำลังลัดวงจรที่บัส (kVA)', kvHr: 'ลำดับเรโซแนนซ์ h<sub>r</sub>',
      pfLead: 'ตู้ {q} kvar ทำให้ PF เป็นแบบนำหน้า (leading) — ลดขนาดสเต็ป', pfRes: 'h<sub>r</sub> = {h} ใกล้ฮาร์มอนิกลำดับที่ {n} — เสี่ยงเรโซแนนซ์ ควรใช้ detuned reactor',
      pfNoNeed: 'PF ปัจจุบันถึงเป้าหมายแล้ว',
      irWinding: 'ขดลวด', lblKind: 'ประเภทขดลวด', optRandom: 'Random-wound / ต่ำกว่า 1 kV', optForm: 'Form-wound (หลังปี 1970)', optOld: 'ก่อนปี 1970 / ไม่ทราบ',
      lblCls: 'คลาสฉนวน', lblKv: 'แรงดันพิกัด (kV)', lblTemp: 'อุณหภูมิขดลวดขณะวัด (°C)', irReadings: 'ค่าที่อ่านได้ (MΩ)',
      lblR30: '30 วินาที', lblR60: '1 นาที', lblR600: '10 นาที',
      kPI: 'PI = R<sub>10min</sub> / R<sub>1min</sub>', kDAR: 'DAR = R<sub>60s</sub> / R<sub>30s</sub>', kR40: 'R<sub>1min</sub> ที่ 40°C',
      band0: 'อันตราย', band1: 'น่าสงสัย', band2: 'ดี', band3: 'ดีมาก',
      kvKT: 'ตัวคูณแก้อุณหภูมิ K<sub>T</sub>', kvMinIR: 'IR<sub>1min</sub> ต่ำสุด (MΩ, 40°C)', kvMinPI: 'PI ต่ำสุด', kvTestV: 'แรงดันทดสอบ DC (V)',
      irOkIR: 'R<sub>1min</sub> ที่ 40°C = {r} MΩ ≥ {m} MΩ', irBadIR: 'R<sub>1min</sub> ที่ 40°C = {r} MΩ ต่ำกว่า {m} MΩ',
      irOkPI: 'PI {pi} ≥ {m}', irBadPI: 'PI {pi} ต่ำกว่า {m}', irWaived: 'R<sub>1min</sub> ที่ 40°C เกิน 5,000 MΩ — ไม่ต้องใช้ PI ตัดสิน',
      gWenner: 'สภาพต้านทานดิน (Wenner)', lblWa: 'ระยะห่างหลักวัด a (m)', lblWr: 'ค่าที่อ่านได้ R (Ω)', kRho: 'ρ = 2πaR (Ω·m)',
      gRods: 'หลักดิน', lblRho: 'สภาพต้านทานดิน ρ (Ω·m)', btnUseRho: 'ใช้ค่าจาก Wenner', lblRodL: 'ความยาวหลักดิน (m)', lblRodD: 'เส้นผ่านศูนย์กลาง (mm)',
      lblRodN: 'จำนวนแท่ง (เรียงแนวเดียว)', lblRodS: 'ระยะห่างระหว่างแท่ง (m)', lblTarget: 'ค่าเป้าหมาย (Ω)',
      gPe: 'ขนาดสายดิน (adiabatic)', lblIkFault: 'กระแสลัดลงดิน (kA)', lblTrip: 'เวลาตัดวงจร (s)', lblK: 'ค่า k',
      optK115: '115 · Cu PVC ในสายเคเบิล', optK143: '143 · Cu PVC แยกเดี่ยว', optK176: '176 · Cu XLPE แยกเดี่ยว',
      kR1: 'หลักดิน 1 แท่ง', kRn: 'หลักดิน {n} แท่ง', kPe: 'สายดินต่ำสุด', kPeStd: 'ใช้ขนาด {s} mm²',
      thN: 'จำนวนแท่ง', thR: 'R (Ω)',
      gOk: 'หลักดิน {n} แท่ง = {r} Ω ≤ {t} Ω', gBad: 'หลักดิน {n} แท่ง = {r} Ω เกิน {t} Ω — ต้องใช้อย่างน้อย {need} แท่ง',
      gBadNone: 'หลักดิน {n} แท่ง = {r} Ω เกิน {t} Ω — 10 แท่งก็ยังไม่ถึง ต้องปรับปรุงดินหรือใช้หลักดินที่ยาวขึ้น',
      saInsul: 'ฉนวนอุปกรณ์', lblUm: 'แรงดันสูงสุดของอุปกรณ์ U<sub>m</sub> (kV)', lblBil: 'BIL (kV)', saArr: 'กับดักฟ้าผ่า',
      lblVres: 'แรงดันตกค้าง U<sub>res</sub> ที่ I<sub>n</sub> (kV)', lblLead: 'ความยาวสายต่อ + สายลงดิน (m)', lblLp: 'ความเหนี่ยวนำสาย (µH/m)',
      lblDidt: 'di/dt (kA/µs)', lblSep: 'ระยะกับดักถึงอุปกรณ์ (m)', lblSteep: 'ความชันหน้าคลื่น (kV/µs)', lblBsl: 'BSL (kV)', lblSipl: 'SIPL ของกับดัก (kV)',
      kU: 'แรงดันที่อุปกรณ์', kPM: 'Protective margin', kMaxVres: 'U<sub>res</sub> สูงสุดที่ยอมได้',
      kvVres: 'U<sub>res</sub> (kV)', kvLead: '+ แรงดันสายต่อ L′·ℓ·di/dt (kV)', kvSep: '+ คลื่นสะท้อน 2·S·d/v (kV)', kvPmSI: 'Margin สวิตชิ่ง BSL/SIPL',
      saIeee: 'IEEE C62.22 ≥ 20%', saIec: 'IEC 60071-2 (K<sub>s</sub> 1.15) ≥ 15%', saSI: 'สวิตชิ่ง ≥ 15%',
      saOk: 'Margin {pm}% — ผ่านทั้ง IEEE C62.22 และ IEC 60071-2', saMid: 'Margin {pm}% — ผ่าน IEC 60071-2 แต่ต่ำกว่า 20% ของ IEEE C62.22',
      saBad: 'Margin {pm}% — ไม่ผ่าน: ลดความยาวสายต่อ เลือกกับดัก U<sub>res</sub> ต่ำลง หรือย้ายกับดักให้ใกล้อุปกรณ์',
      invalid: 'กรอกค่าให้ครบ'
    },
    en: {
      title: 'Electrical Calculator',
      tabVd: 'Voltage drop / cable size', tabSc: 'Short circuit', tabPf: 'PF correction', tabIr: 'Insulation PI/DAR', tabGnd: 'Earthing', tabSa: 'Surge arrester',
      inputs: 'Circuit', lblSystem: 'System', opt3ph: '3-phase', opt1ph: '1-phase', lblVoltage: 'Voltage (V)',
      lblCurrent: 'Load current (A)', lblLength: 'Cable length (m)', lblPf: 'Power factor (cos φ)',
      lblMaterial: 'Conductor', optCu: 'Copper', optAl: 'Aluminium', lblInsulation: 'Insulation', lblX: 'Cable reactance (Ω/km)',
      lblParallel: 'Parallel cables per phase', lblLimit: 'Voltage drop limit (%)', lblSizeUsed: 'Cable size used (mm²)', lblSize: 'Cable size (mm²)',
      lblLoaded: 'Loaded conductors in conduit', lblAmbient: 'Ambient temperature (°C)', lblDerate: 'Other derating factor',
      kVd: 'Voltage drop', kIz: 'Cable ampacity', kRec: 'Recommended size', kRecNone: 'No size passes',
      thSize: 'Size (mm²)', thVd: 'Voltage drop', thIz: 'I<sub>z</sub> (A)', thStatus: 'Result',
      okBoth: 'Pass', failVd: 'Drop too high', failAmp: 'Over ampacity',
      vdOk: '{s} mm² passes: drop {p}% ≤ {l}%{amp}', vdOkAmp: ', I<sub>z</sub> {iz} A ≥ {i} A',
      vdBadVd: '{s} mm² drop {p}% exceeds {l}%', vdBadAmp: '{s} mm² ampacity {iz} A is below the {i} A load',
      vdNoAmp: 'Ampacity not checked (table covers copper PVC only)', vdTemp: 'R at {t}°C',
      scSource: 'Transformer and supply', lblSr: 'Transformer rating (kVA)', lblUk: 'Impedance u<sub>k</sub> (%)', lblPk: 'Load loss P<sub>k</sub> (kW)',
      lblUn: 'LV voltage (V)', lblSkq: 'Network fault level S″<sub>kQ</sub> (MVA)', lblMethod: 'Method', optSimple: 'S / (√3·U·uk)',
      scCable: 'Cable from transformer to sub-board', lblIcuTr: 'MDB breaker I<sub>cu</sub> (kA)', lblIcuEnd: 'Sub-board breaker I<sub>cu</sub> (kA)',
      kIn: 'Transformer rated current', kIkTr: 'I″<sub>k3</sub> at MDB', kIkEnd: 'I″<sub>k3</sub> at sub-board',
      thPoint: 'Location', thIk: 'I″<sub>k3</sub> (kA)', thIp: 'i<sub>p</sub> (kA)', thKappa: 'κ', thRX: 'R/X', thZ: 'Z (mΩ)',
      ptTr: 'MDB', ptEnd: 'Sub-board', icuOk: '{pt}: I<sub>cu</sub> {icu} kA ≥ {ik} kA', icuBad: '{pt}: I<sub>cu</sub> {icu} kA is below I″<sub>k3</sub> {ik} kA',
      lblP: 'Active power P (kW)', lblPf1: 'Present PF', lblPf2: 'Target PF', lblStep: 'Capacitor step (kvar)', lblRate: 'PF charge (THB/kvar)',
      kQc: 'Required capacitance', kBank: 'Selected bank', kPfAfter: 'PF after', kIdrop: 'Current reduction',
      kvK: 'Multiplier tan φ₁ − tan φ₂', kvS: 'kVA before → after', kvI: 'Current before → after (A)', kvIc: 'Capacitor rated current (A)',
      kvIcable: 'Capacitor circuit cable ≥ 1.35 I<sub>c</sub> (A)', kvExcess: 'kvar above 61.97% of kW', kvPenalty: 'PF charge per month (THB)',
      kvSsc: 'Bus fault level (kVA)', kvHr: 'Resonance order h<sub>r</sub>',
      pfLead: 'A {q} kvar bank makes the PF leading — use a smaller step', pfRes: 'h<sub>r</sub> = {h} is close to harmonic {n} — resonance risk, use a detuned reactor',
      pfNoNeed: 'Present PF already meets the target',
      irWinding: 'Winding', lblKind: 'Winding type', optRandom: 'Random-wound / below 1 kV', optForm: 'Form-wound (after 1970)', optOld: 'Before 1970 / unknown',
      lblCls: 'Insulation class', lblKv: 'Rated voltage (kV)', lblTemp: 'Winding temperature (°C)', irReadings: 'Readings (MΩ)',
      lblR30: '30 seconds', lblR60: '1 minute', lblR600: '10 minutes',
      kPI: 'PI = R<sub>10min</sub> / R<sub>1min</sub>', kDAR: 'DAR = R<sub>60s</sub> / R<sub>30s</sub>', kR40: 'R<sub>1min</sub> at 40°C',
      band0: 'Dangerous', band1: 'Questionable', band2: 'Good', band3: 'Excellent',
      kvKT: 'Temperature factor K<sub>T</sub>', kvMinIR: 'Minimum IR<sub>1min</sub> (MΩ, 40°C)', kvMinPI: 'Minimum PI', kvTestV: 'DC test voltage (V)',
      irOkIR: 'R<sub>1min</sub> at 40°C = {r} MΩ ≥ {m} MΩ', irBadIR: 'R<sub>1min</sub> at 40°C = {r} MΩ is below {m} MΩ',
      irOkPI: 'PI {pi} ≥ {m}', irBadPI: 'PI {pi} is below {m}', irWaived: 'R<sub>1min</sub> at 40°C exceeds 5,000 MΩ — PI not required',
      gWenner: 'Soil resistivity (Wenner)', lblWa: 'Probe spacing a (m)', lblWr: 'Reading R (Ω)', kRho: 'ρ = 2πaR (Ω·m)',
      gRods: 'Earth rods', lblRho: 'Soil resistivity ρ (Ω·m)', btnUseRho: 'Use Wenner value', lblRodL: 'Rod length (m)', lblRodD: 'Diameter (mm)',
      lblRodN: 'Number of rods (in line)', lblRodS: 'Rod spacing (m)', lblTarget: 'Target (Ω)',
      gPe: 'Protective conductor (adiabatic)', lblIkFault: 'Earth fault current (kA)', lblTrip: 'Disconnection time (s)', lblK: 'k factor',
      optK115: '115 · Cu PVC in cable', optK143: '143 · Cu PVC separate', optK176: '176 · Cu XLPE separate',
      kR1: 'Single rod', kRn: '{n} rods', kPe: 'Minimum PE size', kPeStd: 'Use {s} mm²',
      thN: 'Rods', thR: 'R (Ω)',
      gOk: '{n} rod(s) = {r} Ω ≤ {t} Ω', gBad: '{n} rod(s) = {r} Ω exceeds {t} Ω — at least {need} rods needed',
      gBadNone: '{n} rod(s) = {r} Ω exceeds {t} Ω — even 10 rods are not enough; treat the soil or use longer rods',
      saInsul: 'Equipment insulation', lblUm: 'Highest voltage for equipment U<sub>m</sub> (kV)', lblBil: 'BIL (kV)', saArr: 'Surge arrester',
      lblVres: 'Residual voltage U<sub>res</sub> at I<sub>n</sub> (kV)', lblLead: 'Connection + earth lead length (m)', lblLp: 'Lead inductance (µH/m)',
      lblDidt: 'di/dt (kA/µs)', lblSep: 'Arrester-to-equipment distance (m)', lblSteep: 'Wave front steepness (kV/µs)', lblBsl: 'BSL (kV)', lblSipl: 'Arrester SIPL (kV)',
      kU: 'Voltage at equipment', kPM: 'Protective margin', kMaxVres: 'Maximum allowable U<sub>res</sub>',
      kvVres: 'U<sub>res</sub> (kV)', kvLead: '+ lead voltage L′·ℓ·di/dt (kV)', kvSep: '+ reflection 2·S·d/v (kV)', kvPmSI: 'Switching margin BSL/SIPL',
      saIeee: 'IEEE C62.22 ≥ 20%', saIec: 'IEC 60071-2 (K<sub>s</sub> 1.15) ≥ 15%', saSI: 'Switching ≥ 15%',
      saOk: 'Margin {pm}% — passes IEEE C62.22 and IEC 60071-2', saMid: 'Margin {pm}% — passes IEC 60071-2 but is below the 20% of IEEE C62.22',
      saBad: 'Margin {pm}% — fails: shorten the leads, choose a lower-U<sub>res</sub> arrester or move it closer to the equipment',
      invalid: 'Fill in all values'
    }
  };
  function t(key, vars) {
    var s = (I18N[getUILang()] || I18N.th)[key];
    if (s == null) s = I18N.th[key] != null ? I18N.th[key] : key;
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  function applyStaticI18n() {
    document.documentElement.lang = getUILang();
    // ข้อความใน I18N เป็นของเราเองทั้งหมด (มี <sub>) จึงใช้ innerHTML ได้ — <option> รับแต่ข้อความ
    [].forEach.call(document.querySelectorAll('[data-i18n]'), function (el) {
      if (el.tagName === 'OPTION') el.textContent = t(el.getAttribute('data-i18n')).replace(/<[^>]+>/g, '');
      else el.innerHTML = t(el.getAttribute('data-i18n'));
    });
  }

  /* ══════ ตัวช่วยจัดรูปตัวเลข ══════ */
  function locale() { return getUILang() === 'en' ? 'en-US' : 'th-TH'; }
  function fmt(n, d) {
    if (!isFinite(n)) return '—';
    d = d == null ? 2 : d;
    return n.toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtSig(n) { // ทศนิยมตามขนาดตัวเลข — ค่าความต้านทานฉนวน/ดินกว้างหลายหลัก
    if (!isFinite(n)) return '—';
    var a = Math.abs(n);
    return fmt(n, a >= 100 ? 0 : a >= 10 ? 1 : 2);
  }
  function val(id) { var n = parseFloat($(id).value); return isFinite(n) ? n : NaN; }

  function kpi(label, value, unit, cls, sub) {
    return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value' + (cls ? ' ' + cls : '') + '">' +
      value + (unit ? '<small>' + unit + '</small>' : '') + '</div>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>';
  }
  function callout(cls, html) { return '<div class="callout ' + cls + '">' + html + '</div>'; }
  function kvRows(rows) {
    return rows.map(function (r) { return '<div class="k">' + r[0] + '</div><div class="v' + (r[2] ? ' ' + r[2] : '') + '">' + r[1] + '</div>'; }).join('');
  }
  function badge(cls, html) { return '<span class="badge ' + cls + '">' + html + '</span>'; }
  var BAND_CLS = ['err', 'warn', 'ok', 'ok'];

  /* ══════ ตัวเลือกขนาดสาย ══════ */
  function fillSizes(sel, material, keep) {
    var cur = keep != null ? keep : sel.value;
    sel.innerHTML = E.SIZES.filter(function (s) { return E.R20[material][s]; })
      .map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
    if (cur && E.R20[material][cur]) sel.value = cur;
  }
  function fillUm(keep) {
    var sel = $('saUm');
    sel.innerHTML = Object.keys(E.BIL_TABLE).map(Number).sort(function (a, b) { return a - b; })
      .map(function (u) { return '<option value="' + u + '">' + u + '</option>'; }).join('');
    sel.value = keep || '24';
    fillBil();
  }
  function fillBil() {
    var list = E.BIL_TABLE[$('saUm').value] || [];
    $('saBilList').innerHTML = list.map(function (b) { return '<option value="' + b + '">'; }).join('');
  }

  /* ══════ แรงดันตก / ขนาดสาย ══════ */
  function renderVd() {
    var p = {
      phase: $('vdPhase').value === '1' ? 1 : 3, V: val('vdV'), I: val('vdI'), L: val('vdL'), pf: val('vdPf'),
      material: $('vdMat').value, insulation: $('vdIns').value, x: val('vdX'), parallel: val('vdPar') || 1,
      limit: val('vdLimit'), loaded: $('vdLoaded').value === '2' ? 2 : 3, ambient: +$('vdAmb').value, derate: val('vdDerate')
    };
    var ampRow = p.material === 'cu' && p.insulation === 'pvc';
    $('vdAmpRow').hidden = !ampRow;
    if (!(p.V > 0 && p.I > 0 && p.L > 0 && p.pf > 0 && p.pf <= 1 && p.limit > 0)) return invalid('vd');

    var res = E.sizeCable(p);
    var used = +$('vdSize').value;
    var usedVd = E.voltageDrop({ phase: p.phase, V: p.V, I: p.I, L: p.L, material: p.material, size: used, pf: p.pf, x: p.x, temp: res.temp, parallel: p.parallel });
    var usedIz = ampRow ? E.ampacity(used, p.loaded, p.ambient, p.derate) * Math.max(1, Math.round(p.parallel)) : NaN;
    var okVd = usedVd.pct <= p.limit, okAmp = !ampRow || usedIz >= p.I;

    $('vdKpi').innerHTML =
      kpi(t('kVd') + ' · ' + used + ' mm²', fmt(usedVd.pct, 2), '% · ' + fmt(usedVd.dV, 1) + ' V', okVd ? 'grow' : 'dn', t('vdTemp', { t: res.temp }) + ' = ' + fmt(usedVd.r, 4) + ' Ω/km') +
      (ampRow ? kpi(t('kIz'), fmt(usedIz, 0), 'A', okAmp ? 'grow' : 'dn') : '') +
      kpi(t('kRec'), res.chosen != null ? res.chosen : '—', res.chosen != null ? 'mm²' : '', '', res.chosen == null ? t('kRecNone') : '');

    var msg;
    if (!okVd) msg = callout('err', t('vdBadVd', { s: used, p: fmt(usedVd.pct, 2), l: fmt(p.limit, 1) }));
    else if (!okAmp) msg = callout('err', t('vdBadAmp', { s: used, iz: fmt(usedIz, 0), i: fmt(p.I, 0) }));
    else msg = callout('ok', t('vdOk', { s: used, p: fmt(usedVd.pct, 2), l: fmt(p.limit, 1),
      amp: ampRow ? t('vdOkAmp', { iz: fmt(usedIz, 0), i: fmt(p.I, 0) }) : '' }));
    if (!ampRow) msg += callout('info', t('vdNoAmp'));
    $('vdVerdict').innerHTML = msg;

    var head = '<thead><tr><th>' + t('thSize') + '</th><th class="num">' + t('thVd') + '</th>' +
      (ampRow ? '<th class="num">' + t('thIz') + '</th>' : '') + '<th>' + t('thStatus') + '</th></tr></thead>';
    var body = res.rows.map(function (r) {
      var st = r.okVd && r.okAmp ? badge('ok', t('okBoth')) : !r.okVd ? badge('err', t('failVd')) : badge('err', t('failAmp'));
      return '<tr' + (r.size === res.chosen ? ' class="pick"' : '') + '><td>' + r.size + '</td>' +
        '<td class="num' + (r.okVd ? '' : ' bad') + '">' + fmt(r.pct, 2) + '% · ' + fmt(r.dV, 1) + ' V</td>' +
        (ampRow ? '<td class="num' + (r.okAmp ? '' : ' bad') + '">' + fmt(r.iz, 0) + '</td>' : '') +
        '<td>' + st + '</td></tr>';
    }).join('');
    $('vdTable').innerHTML = head + '<tbody>' + body + '</tbody>';
  }

  /* ══════ กระแสลัดวงจร ══════ */
  function renderSc() {
    var c = parseFloat($('scMethod').value);
    var p = {
      Un: val('scUn'), c: c, kt: c !== 1, SkQ: val('scSkq'), Sr: val('scSr'), uk: val('scUk'), Pk: c === 1 ? 0 : val('scPk'),
      cable: { material: $('scMat').value, size: +$('scSize').value, L: val('scL'), x: val('scX'), parallel: val('scPar') || 1 }
    };
    if (!(p.Un > 0 && p.Sr > 0 && p.uk > 0)) return invalid('sc');
    var r = E.shortCircuit(p);

    $('scKpi').innerHTML =
      kpi(t('kIn'), fmt(r.In, 0), 'A') +
      kpi(t('kIkTr'), fmt(r.tr.Ik, 2), 'kA', '', 'i<sub>p</sub> ' + fmt(r.tr.ip, 1) + ' kA') +
      (r.end ? kpi(t('kIkEnd'), fmt(r.end.Ik, 2), 'kA', '', 'i<sub>p</sub> ' + fmt(r.end.ip, 1) + ' kA') : '');

    var pts = [[t('ptTr'), r.tr, val('scIcuTr')]];
    if (r.end) pts.push([t('ptEnd'), r.end, val('scIcuEnd')]);
    $('scVerdict').innerHTML = pts.filter(function (x) { return x[2] > 0; }).map(function (x) {
      var ok = x[2] >= x[1].Ik;
      return callout(ok ? 'ok' : 'err', t(ok ? 'icuOk' : 'icuBad', { pt: x[0], icu: fmt(x[2], 1), ik: fmt(x[1].Ik, 2) }));
    }).join('');

    $('scTable').innerHTML = '<thead><tr><th>' + t('thPoint') + '</th><th class="num">' + t('thIk') + '</th><th class="num">' + t('thIp') +
      '</th><th class="num">' + t('thKappa') + '</th><th class="num">' + t('thRX') + '</th><th class="num">' + t('thZ') + '</th></tr></thead><tbody>' +
      pts.map(function (x) {
        var q = x[1];
        return '<tr><td>' + x[0] + '</td><td class="num">' + fmt(q.Ik, 2) + '</td><td class="num">' + fmt(q.ip, 1) + '</td><td class="num">' +
          fmt(q.kappa, 3) + '</td><td class="num">' + (q.X > 0 ? fmt(q.R / q.X, 3) : '—') + '</td><td class="num">' + fmt(q.Z, 2) + '</td></tr>';
      }).join('') + '</tbody>';
  }

  /* ══════ คาปาซิเตอร์แก้ PF ══════ */
  function renderPf() {
    var p = { P: val('pfP'), pf1: val('pfPf1'), pf2: val('pfPf2'), V: val('pfV'), phase: $('pfPhase').value === '1' ? 1 : 3,
      step: val('pfStep'), rate: val('pfRate'), Sr: val('pfSr'), uk: val('pfUk') };
    if (!(p.P > 0 && p.pf1 > 0 && p.pf1 <= 1 && p.pf2 > 0 && p.pf2 <= 1 && p.V > 0)) return invalid('pf');
    var r = E.pfCorrection(p);

    $('pfKpi').innerHTML =
      kpi(t('kQc'), fmt(r.Qc, 1), 'kvar') +
      kpi(t('kBank'), fmt(r.Qbank, 0), 'kvar') +
      kpi(t('kPfAfter'), fmt(r.pfAfter, 3), r.leading ? 'lead' : '', r.pfAfter >= p.pf2 && !r.leading ? 'grow' : 'dn') +
      kpi(t('kIdrop'), fmt(r.I1 - r.I2, 0), 'A');

    var msgs = [];
    if (r.Qc <= 0) msgs.push(callout('ok', t('pfNoNeed')));
    if (r.leading) msgs.push(callout('warn', t('pfLead', { q: fmt(r.Qbank, 0) })));
    if (isFinite(r.hr)) {
      [5, 7, 11, 13].forEach(function (n) {
        if (Math.abs(r.hr - n) < 0.5) msgs.push(callout('warn', t('pfRes', { h: fmt(r.hr, 2), n: n })));
      });
    }
    $('pfVerdict').innerHTML = msgs.join('');

    $('pfKv').innerHTML = kvRows([
      [t('kvK'), fmt(r.kFactor, 3)],
      [t('kvS'), fmt(r.S1, 0) + ' → ' + fmt(r.S2, 0)],
      [t('kvI'), fmt(r.I1, 0) + ' → ' + fmt(r.I2, 0)],
      [t('kvIc'), fmt(r.Ic, 1)],
      [t('kvIcable'), fmt(r.Icable, 1)],
      [t('kvExcess'), fmt(r.excessKvar, 1), r.excessKvar > 0 ? 'risk' : ''],
      [t('kvPenalty'), fmt(r.penalty, 2), r.penalty > 0 ? 'risk' : ''],
      [t('kvSsc'), fmt(r.Ssc, 0)],
      [t('kvHr'), fmt(r.hr, 2)]
    ]);
  }

  /* ══════ ความเป็นฉนวน PI / DAR ══════ */
  function renderIr() {
    var p = { r30: val('irR30'), r60: val('irR60'), r600: val('irR600'), temp: val('irTemp'), kv: val('irKv'),
      cls: $('irCls').value, kind: $('irKind').value };
    if (!(p.r60 > 0)) return invalid('ir');
    var r = E.insulation(p);
    var hasPI = p.r600 > 0, hasDAR = p.r30 > 0;

    $('irKpi').innerHTML =
      kpi(t('kPI'), hasPI ? fmt(r.pi, 2) : '—', '', '', hasPI ? badge(BAND_CLS[r.piBand], t('band' + r.piBand)) : '') +
      kpi(t('kDAR'), hasDAR ? fmt(r.dar, 2) : '—', '', '', hasDAR ? badge(BAND_CLS[r.darBand], t('band' + r.darBand)) : '') +
      kpi(t('kR40'), fmtSig(r.r40), 'MΩ', r.okIR ? 'grow' : 'dn');

    var msgs = [callout(r.okIR ? 'ok' : 'err', t(r.okIR ? 'irOkIR' : 'irBadIR', { r: fmtSig(r.r40), m: fmtSig(r.minIR) }))];
    if (hasPI) {
      if (r.piWaived) msgs.push(callout('info', t('irWaived')));
      else msgs.push(callout(r.okPI ? 'ok' : 'err', t(r.okPI ? 'irOkPI' : 'irBadPI', { pi: fmt(r.pi, 2), m: fmt(r.minPI, 1) })));
    }
    $('irVerdict').innerHTML = msgs.join('');

    $('irKv2').innerHTML = kvRows([
      [t('kvKT'), fmt(r.KT, 3)],
      [t('kvMinIR'), fmtSig(r.minIR)],
      [t('kvMinPI'), fmt(r.minPI, 1)],
      [t('kvTestV'), r.testV ? (r.testV[0] === r.testV[1] ? fmt(r.testV[0], 0) : fmt(r.testV[0], 0) + '–' + fmt(r.testV[1], 0)) : '—']
    ]);
  }

  /* ══════ ระบบกราวด์ ══════ */
  function renderGnd() {
    var rhoW = E.wenner(val('gWa'), val('gWr'));
    $('gWOut').innerHTML = kvRows([[t('kRho'), fmtSig(rhoW)]]);
    $('gUseRho').disabled = !(rhoW > 0);

    var rho = val('gRho'), L = val('gL'), d = val('gD'), n = Math.min(10, Math.max(1, Math.round(val('gN') || 1))), s = val('gS'), target = val('gTarget');
    var Ik = val('gIk'), tt = val('gT'), k = +$('gK').value;
    var okRod = rho > 0 && L > 0 && d > 0 && (n === 1 || s > 0);
    var kp = '', msgs = [], rows = '';
    if (okRod) {
      var R1 = E.rodResistance(rho, L, d);
      var Rn = E.rodsInLine(R1, n, s, rho);
      kp += kpi(t('kR1'), fmtSig(R1), 'Ω', n === 1 && target > 0 ? (R1 <= target ? 'grow' : 'dn') : '');
      if (n > 1) kp += kpi(t('kRn', { n: n }), fmtSig(Rn), 'Ω', target > 0 ? (Rn <= target ? 'grow' : 'dn') : '');
      var need = null, list = [];
      for (var i = 1; i <= 10; i++) {
        var Ri = E.rodsInLine(R1, i, i === 1 ? 1 : s > 0 ? s : NaN, rho);
        list.push([i, Ri]);
        if (need == null && Ri <= target) need = i;
      }
      if (target > 0) {
        if (Rn <= target) msgs.push(callout('ok', t('gOk', { n: n, r: fmtSig(Rn), t: fmtSig(target) })));
        else msgs.push(callout('err', t(need != null ? 'gBad' : 'gBadNone', { n: n, r: fmtSig(Rn), t: fmtSig(target), need: need })));
      }
      rows = '<thead><tr><th>' + t('thN') + '</th><th class="num">' + t('thR') + '</th></tr></thead><tbody>' +
        list.filter(function (x) { return isFinite(x[1]); }).map(function (x) {
          return '<tr' + (x[0] === n ? ' class="pick"' : '') + '><td>' + x[0] + '</td><td class="num' + (target > 0 && x[1] > target ? ' bad' : '') + '">' + fmtSig(x[1]) + '</td></tr>';
        }).join('') + '</tbody>';
    }
    if (Ik > 0 && tt > 0) {
      var Spe = E.adiabaticSize(Ik, tt, k);
      var std = E.nextSize(Math.max(Spe, 1.5));
      kp += kpi(t('kPe'), fmt(Spe, 1), 'mm²', '', std ? t('kPeStd', { s: std }) : '');
    }
    $('gKpi').innerHTML = kp;
    $('gVerdict').innerHTML = okRod || (Ik > 0 && tt > 0) ? msgs.join('') : callout('warn', t('invalid'));
    $('gTable').innerHTML = rows;
    $('gTable').parentNode.hidden = !rows;
  }

  /* ══════ กับดักฟ้าผ่า ══════ */
  function renderSa() {
    var p = { bil: val('saBil'), vres: val('saVres'), lead: val('saLead'), lprime: val('saLp'), didt: val('saDidt'),
      d: val('saD'), S: val('saS'), bsl: val('saBsl'), sipl: val('saSipl') };
    if (!(p.bil > 0 && p.vres > 0)) return invalid('sa');
    var r = E.arrester(p);

    $('saKpi').innerHTML =
      kpi(t('kU'), fmt(r.U, 1), 'kV') +
      kpi(t('kPM'), fmt(r.pm, 1), '%', r.okIeee ? 'grow' : 'dn',
        '<span class="ec-badges">' + badge((r.okIeee ? 'ok' : 'err') + ' wrap', t('saIeee')) + badge((r.okIec ? 'ok' : 'err') + ' wrap', t('saIec')) + '</span>') +
      kpi(t('kMaxVres'), fmt(r.maxVres, 1), 'kV', '', 'PM 20%');

    var msgs = [];
    if (r.okIeee) msgs.push(callout('ok', t('saOk', { pm: fmt(r.pm, 1) })));
    else if (r.okIec) msgs.push(callout('warn', t('saMid', { pm: fmt(r.pm, 1) })));
    else msgs.push(callout('err', t('saBad', { pm: fmt(r.pm, 1) })));
    $('saVerdict').innerHTML = msgs.join('');

    var rows = [[t('kvVres'), fmt(p.vres, 1)], [t('kvLead'), fmt(r.lead, 1)]];
    if (r.sep > 0) rows.push([t('kvSep'), fmt(r.sep, 1)]);
    if (isFinite(r.pmSI)) rows.push([t('kvPmSI'), fmt(r.pmSI, 1) + '% ' + badge(r.okSI ? 'ok' : 'err', t('saSI')), r.okSI ? '' : 'risk']);
    $('saKv').innerHTML = kvRows(rows);
  }

  function invalid(tab) {
    var k = $(tab + 'Kpi'); if (k) k.innerHTML = '';
    var v = $(tab + 'Verdict'); if (v) v.innerHTML = callout('warn', t('invalid'));
    ['Table', 'Kv', 'Kv2'].forEach(function (s) { var el = $(tab + s); if (el) el.innerHTML = ''; });
  }

  var RENDER = { vd: renderVd, sc: renderSc, pf: renderPf, ir: renderIr, gnd: renderGnd, sa: renderSa };
  function renderAll() { Object.keys(RENDER).forEach(function (k) { RENDER[k](); }); }

  /* ══════ แท็บ + จำค่าที่กรอก ══════ */
  var currentTab = 'vd';
  function showTab(tab) {
    if (!RENDER[tab]) tab = 'vd';
    currentTab = tab;
    [].forEach.call(document.querySelectorAll('#ecTabs .tab'), function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === tab ? 'true' : 'false'); });
    [].forEach.call(document.querySelectorAll('[data-panel]'), function (p) { p.hidden = p.getAttribute('data-panel') !== tab; });
  }
  function fields() { return [].slice.call(document.querySelectorAll('.ec-page input, .ec-page select')); }
  function save() {
    var v = {};
    fields().forEach(function (el) { if (el.id) v[el.id] = el.value; });
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ tab: currentTab, v: v })); } catch (e) {}
  }
  function load() {
    var st = null;
    try { st = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {}
    return st && typeof st === 'object' ? st : null;
  }

  function init() {
    fillSizes($('vdSize'), 'cu', '50');
    fillSizes($('scSize'), 'cu', '240');
    var st = load();
    var v = (st && st.v) || {};
    // ตัวเลือกที่ขึ้นกับค่าอื่นต้องเติมก่อนใส่ค่าที่จำไว้
    if (v.vdMat) { $('vdMat').value = v.vdMat; fillSizes($('vdSize'), $('vdMat').value, v.vdSize); }
    if (v.scMat) { $('scMat').value = v.scMat; fillSizes($('scSize'), $('scMat').value, v.scSize); }
    fillUm(v.saUm);
    fields().forEach(function (el) {
      if (el.id && v[el.id] != null && el.id !== 'saUm') el.value = v[el.id];
    });

    applyStaticI18n();
    showTab(st && st.tab);
    renderAll();

    $('ecTabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return;
      showTab(b.getAttribute('data-tab')); save();
    });
    document.querySelector('.ec-page').addEventListener('input', onEdit);
    document.querySelector('.ec-page').addEventListener('change', onEdit);
    $('gUseRho').addEventListener('click', function () {
      var rho = E.wenner(val('gWa'), val('gWr'));
      if (rho > 0) { $('gRho').value = Math.round(rho * 10) / 10; renderGnd(); save(); }
    });
    window.OME_PAGE_LIVE_LANG = true;
    window.OME_LANG.onChange(function () { applyStaticI18n(); renderAll(); });
  }

  function onEdit(e) {
    var id = e.target && e.target.id;
    if (e.type === 'change') {
      if (id === 'vdPhase') $('vdV').value = $('vdPhase').value === '1' ? 230 : 400;
      if (id === 'pfPhase') $('pfV').value = $('pfPhase').value === '1' ? 230 : 400;
      if (id === 'vdMat') fillSizes($('vdSize'), $('vdMat').value);
      if (id === 'scMat') fillSizes($('scSize'), $('scMat').value);
      if (id === 'saUm') {
        fillBil();
        var list = E.BIL_TABLE[$('saUm').value] || [];
        if (list.length && list.indexOf(val('saBil')) < 0) $('saBil').value = list[list.length - 1];
      }
    }
    var panel = e.target.closest('[data-panel]');
    if (panel) RENDER[panel.getAttribute('data-panel')]();
    save();
  }

  init();
})();
