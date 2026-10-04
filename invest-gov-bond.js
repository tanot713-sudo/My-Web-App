/* ══════════════════════════════════════════════════════════════════
   Tanot — พันธบัตรรัฐบาล · คำนวณผลตอบแทน (YTM) + ตารางจ่ายดอกเบี้ย + เทียบเงินฝากประจำ
   หมายเหตุ: ไม่มีราคา/ผลตอบแทนตลาดสด (ไม่มี API ฟรีไม่ต้องขอ key) — กรอกข้อมูลเองทั้งหมด
   ยุบรวมหน้าลงทุน ขั้น 12: ใช้ InvestCore/InvestCalc (สูตร YTM/ตารางดอกเบี้ย/เทียบเงินฝากย้ายไป InvestCalc ตรงตัว) · สมุด tanot:invest:govbond
   รูปแบบเดิม อ่านสด→แก้→เขียน ลบด้วย ts (เดิมใช้ดัชนี) · วาดใหม่เองตอน TanotData.onChange
   ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุนหรือคำแนะนำภาษี
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IC = window.InvestCore, Calc = window.InvestCalc;
  var $ = function (id) { return document.getElementById(id); };
  var LOG_KEY = 'tanot:invest:govbond';

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function baht(n) { return '฿' + fmt0(n); }

  var L = IC.i18n({
    th: {
      delTitle: 'ลบ',
      navInvest: 'การลงทุน', pageTitleShort: 'พันธบัตรรัฐบาล',
      pageTitle: 'พันธบัตรรัฐบาล — คำนวณผลตอบแทน + ติดตามตารางจ่ายดอกเบี้ย',
      calcTitle: 'คำนวณผลตอบแทนพันธบัตร',
      lblFace: 'มูลค่าหน้าตั๋ว (บาท)', lblCoupon: 'อัตราดอกเบี้ยหน้าตั๋ว/ปี (%)', lblCouponShort: 'อัตราดอกเบี้ย/ปี (%)',
      lblFreq: 'ความถี่จ่ายดอกเบี้ย', freq4: 'ทุก 3 เดือน (รายไตรมาส)', freq4Short: 'ทุก 3 เดือน', freq2: 'ทุก 6 เดือน', freq1: 'ทุกปี',
      lblPrice: 'ราคาที่ซื้อ (บาท)', lblYears: 'จำนวนปีจนครบกำหนด',
      calcBtn: 'คำนวณผลตอบแทน',
      lblCouponAnnual: 'ดอกเบี้ยรับ/ปี (ก่อนภาษี)', lblCouponAfterTax: 'ดอกเบี้ยรับ/ปี (หลังหักภาษี 15%)', lblWithholding: 'หัก ณ ที่จ่าย 15%',
      lblYtm: 'อัตราผลตอบแทนแท้จริงจนครบกำหนด (YTM)',
      subAtPar: 'ซื้อที่ราคาพาร์ — ผลตอบแทนแท้จริง ≈ อัตราดอกเบี้ยหน้าตั๋ว',
      subBelowPar: 'ซื้อต่ำกว่าพาร์ — ผลตอบแทนแท้จริงจึง<b>สูงกว่า</b>อัตราดอกเบี้ยหน้าตั๋ว',
      subAbovePar: 'ซื้อสูงกว่าพาร์ — ผลตอบแทนแท้จริงจึง<b>ต่ำกว่า</b>อัตราดอกเบี้ยหน้าตั๋ว',
      cmpTitle: 'เทียบกับเงินฝากประจำธนาคาร', lblDepRate: 'อัตราดอกเบี้ยเงินฝากประจำที่จะเทียบ (%)', cmpBtn: 'เทียบผลตอบแทน',
      cmpColBond: 'พันธบัตร', cmpColDeposit: 'เงินฝากประจำ',
      cmpPrincipal: 'เงินต้น', cmpGross: 'ดอกเบี้ยรวมก่อนภาษี', cmpNet: 'ดอกเบี้ยรวมหลังหักภาษี 15%', cmpSummary: 'สรุป',
      cmpDiffBondWins: 'พันธบัตรได้มากกว่า {v} หลังหักภาษี ตลอด {n} ปี',
      cmpDiffDepWins: 'เงินฝากประจำได้มากกว่า {v} หลังหักภาษี ตลอด {n} ปี',
      lgTitle: 'ตารางจ่ายดอกเบี้ย + สมุดพันธบัตรของฉัน',
      lblBondName: 'ชื่อ/รุ่นพันธบัตร', phBondName: 'เช่น ออมพลัส 2569',
      lblPurchDate: 'วันที่ซื้อ', lblMaturity: 'วันครบกำหนด', addBtn: 'บันทึก',
      lgEmptyDefault: 'ยังไม่มีรายการ',
      logThDate: 'วันที่ซื้อ', logThName: 'ชื่อ/รุ่น', logThFace: 'หน้าตั๋ว', logThCoupon: 'ดอกเบี้ย', logThMaturity: 'ครบกำหนด',
      groupSummary: 'ซื้อ {face} · ดอกเบี้ย {coupon}%/ปี · จ่าย{freq}',
      schedThDate: 'วันจ่าย', schedThAmt: 'จำนวนเงิน', schedThStatus: 'สถานะ',
      principalIncluded: '(รวมเงินต้นคืน)', statusGot: 'ได้รับแล้ว', statusWait: 'รอรับ',
      alertFace: 'กรอกมูลค่าหน้าตั๋วให้ถูกต้อง', alertPrice: 'กรอกราคาที่ซื้อให้ถูกต้อง', alertYears: 'กรอกจำนวนปีจนครบกำหนดให้ถูกต้อง',
      alertCalcFirst: 'กดคำนวณผลตอบแทนพันธบัตรก่อน', alertDepRate: 'กรอกอัตราดอกเบี้ยเงินฝากประจำให้ถูกต้อง',
      alertBondName: 'กรอกชื่อ/รุ่นพันธบัตร', alertDates: 'กรอกวันที่ซื้อและวันครบกำหนดให้ถูกต้อง',
      alertMaturityOrder: 'วันครบกำหนดต้องอยู่หลังวันที่ซื้อ', alertFaceCoupon: 'กรอกมูลค่าหน้าตั๋วและอัตราดอกเบี้ยให้ถูกต้อง'
    },
    en: {
      delTitle: 'Delete',
      navInvest: 'Investing', pageTitleShort: 'Government Bonds',
      pageTitle: 'Government Bonds — Return Calculator + Coupon Schedule Tracker',
      calcTitle: 'Bond Return Calculator',
      lblFace: 'Face value (THB)', lblCoupon: 'Coupon rate/year (%)', lblCouponShort: 'Interest rate/year (%)',
      lblFreq: 'Coupon frequency', freq4: 'Every 3 months (quarterly)', freq4Short: 'Every 3 months', freq2: 'Every 6 months', freq1: 'Every year',
      lblPrice: 'Purchase price (THB)', lblYears: 'Years to maturity',
      calcBtn: 'Calculate return',
      lblCouponAnnual: 'Coupon received/year (before tax)', lblCouponAfterTax: 'Coupon received/year (after 15% tax)', lblWithholding: '15% withholding tax',
      lblYtm: 'Yield to maturity (YTM)',
      subAtPar: 'Bought at par — the true yield ≈ the coupon rate',
      subBelowPar: 'Bought below par — the true yield is therefore <b>higher</b> than the coupon rate',
      subAbovePar: 'Bought above par — the true yield is therefore <b>lower</b> than the coupon rate',
      cmpTitle: 'Compare with a Bank Fixed Deposit', lblDepRate: 'Fixed-deposit rate to compare against (%)', cmpBtn: 'Compare returns',
      cmpColBond: 'Bond', cmpColDeposit: 'Fixed Deposit',
      cmpPrincipal: 'Principal', cmpGross: 'Total interest before tax', cmpNet: 'Total interest after 15% tax', cmpSummary: 'Summary',
      cmpDiffBondWins: 'The bond earns {v} more after tax over {n} years',
      cmpDiffDepWins: 'The fixed deposit earns {v} more after tax over {n} years',
      lgTitle: 'Coupon Schedule + My Bond Log',
      lblBondName: 'Bond name/series', phBondName: 'e.g. Om Plus 2026',
      lblPurchDate: 'Purchase date', lblMaturity: 'Maturity date', addBtn: 'Log',
      lgEmptyDefault: 'No entries yet',
      logThDate: 'Purchase date', logThName: 'Name/series', logThFace: 'Face value', logThCoupon: 'Interest', logThMaturity: 'Maturity',
      groupSummary: 'Bought {face} · interest {coupon}%/year · paid {freq}',
      schedThDate: 'Payment date', schedThAmt: 'Amount', schedThStatus: 'Status',
      principalIncluded: '(includes principal repayment)', statusGot: 'Received', statusWait: 'Pending',
      alertFace: 'Enter a valid face value', alertPrice: 'Enter a valid purchase price', alertYears: 'Enter a valid number of years to maturity',
      alertCalcFirst: 'Calculate the bond return first', alertDepRate: 'Enter a valid fixed-deposit interest rate',
      alertBondName: 'Enter the bond name/series', alertDates: 'Enter valid purchase and maturity dates',
      alertMaturityOrder: 'The maturity date must be after the purchase date', alertFaceCoupon: 'Enter a valid face value and interest rate'
    }
  });
  var t = L.t;
  function applyStaticI18n() { L.apply(); }

  /* สูตรล้วนอยู่ใน InvestCalc (ย้ายตรงตัวจากไฟล์เดิม) */
  var solveYTM = Calc.solveYTM, parseYMD = Calc.parseYMD, couponSchedule = Calc.couponSchedule, compareDeposit = Calc.compareDeposit;

  /* ── คำนวณผลตอบแทนพันธบัตร ── */
  var lastCalc = null;

  function doCalc() {
    var face = num($('bfFace').value), couponPct = num($('bfCoupon').value),
        freq = num($('bfFreq').value), price = num($('bfPrice').value), years = num($('bfYears').value);
    if (!isFinite(face) || face <= 0) { alert(t('alertFace')); return; }
    if (!isFinite(price) || price <= 0) { alert(t('alertPrice')); return; }
    if (!isFinite(years) || years <= 0) { alert(t('alertYears')); return; }
    if (!isFinite(couponPct) || couponPct < 0) couponPct = 0;

    var annualCoupon = face * couponPct / 100;
    var afterTax = annualCoupon * (1 - 0.15);
    var ytm = solveYTM(price, face, couponPct, freq, years);

    $('bfOut').style.display = 'block';
    $('bfCouponAnnual').textContent = baht(annualCoupon);
    $('bfCouponAfterTax').textContent = baht(afterTax);
    $('bfYtm').textContent = isFinite(ytm) ? fmt(ytm, 2) + '%' : '—';

    var sub;
    if (Math.abs(price - face) < 0.01) sub = t('subAtPar');
    else if (price < face) sub = t('subBelowPar');
    else sub = t('subAbovePar');
    $('bfYtmSub').innerHTML = sub;

    lastCalc = { face: face, couponPct: couponPct, freq: freq, price: price, years: years, annualCoupon: annualCoupon };
  }

  /* ── เทียบกับเงินฝากประจำ ── */
  function doCompare() {
    if (!lastCalc) { alert(t('alertCalcFirst')); return; }
    var depRate = num($('cmpDepRate').value);
    if (!isFinite(depRate) || depRate < 0) { alert(t('alertDepRate')); return; }
    var r = compareDeposit(lastCalc.price, lastCalc.years, lastCalc.annualCoupon, depRate);
    $('cmpOut').style.display = 'block';
    $('cmpBondPrincipal').textContent = baht(r.principal);
    $('cmpBondGross').textContent = baht(r.bondGross);
    $('cmpBondNet').textContent = baht(r.bondAfterTax);
    $('cmpDepPrincipal').textContent = baht(r.principal);
    $('cmpDepGross').textContent = baht(r.depGross);
    $('cmpDepNet').textContent = baht(r.depAfterTax);
    var diff = r.bondAfterTax - r.depAfterTax;
    $('cmpDiff').textContent = t(diff >= 0 ? 'cmpDiffBondWins' : 'cmpDiffDepWins', { v: baht(Math.abs(diff)), n: fmt0(r.years) });
  }

  /* ── สมุดพันธบัตรของฉัน (localStorage) ─────────────────────────── */
  function loadLog() { var a = IC.lsJson(LOG_KEY); return Array.isArray(a) ? a : []; }
  function editLog(fn) { var a = loadLog(); fn(a); IC.lsSet(LOG_KEY, a); }

  var FREQ_KEY = { 1: 'freq1', 2: 'freq2', 4: 'freq4Short' };
  function freqLabel(freq) { var k = FREQ_KEY[freq]; return k ? t(k) : ''; }

  function addLog() {
    var name = ($('lgName').value || '').trim();
    var purchDate = parseYMD($('lgPurchDate').value), maturity = parseYMD($('lgMaturity').value);
    var face = num($('lgFace').value), coupon = num($('lgCoupon').value), freq = num($('lgFreq').value);
    if (!name) { alert(t('alertBondName')); return; }
    if (!purchDate || !maturity) { alert(t('alertDates')); return; }
    if (!(maturity > purchDate)) { alert(t('alertMaturityOrder')); return; }
    if (!isFinite(face) || face <= 0 || !isFinite(coupon) || coupon < 0) { alert(t('alertFaceCoupon')); return; }
    editLog(function (log) {
      var ts = Date.now(); while (log.some(function (r) { return r && r.ts === ts; })) ts++;
      log.push({ name: name, purchDate: $('lgPurchDate').value, maturity: $('lgMaturity').value, face: face, coupon: coupon, freq: freq, ts: ts });
    });
    $('lgName').value = ''; $('lgFace').value = 100000; $('lgCoupon').value = 3;
    $('lgPurchDate').value = ''; $('lgMaturity').value = '';
    renderLog();
    renderBondNameList();
  }

  function renderLog() {
    var log = loadLog(), box = $('lgBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">' + t('lgEmptyDefault') + '</div>'; return; }
    var today = new Date();
    var html = '<div class="table-wrap"><table class="table right"><thead><tr><th>' + t('logThDate') + '</th><th>' + t('logThName') + '</th><th>' + t('logThFace') + '</th><th>' + t('logThCoupon') + '</th><th>' + t('logThMaturity') + '</th><th></th></tr></thead><tbody>';
    log.forEach(function (r) {
      html += '<tr><td>' + IC.date(parseYMD(r.purchDate), { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
        '<td>' + r.name + '</td><td>' + baht(r.face) + '</td><td>' + fmt(r.coupon, 2) + '%</td>' +
        '<td>' + IC.date(parseYMD(r.maturity), { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
        '<td><button class="btn sm ghost icon log-del" type="button" aria-label="' + t('delTitle') + '" data-ts="' + r.ts + '"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-x"/></svg></button></td></tr>';
    });
    html += '</tbody></table></div>';

    log.forEach(function (r) {
      var sched = couponSchedule(parseYMD(r.purchDate), parseYMD(r.maturity), r.freq, r.face, r.coupon);
      html += '<div class="log-group-hd">' + r.name + '</div>';
      html += '<div class="log-group-sub">' + t('groupSummary', { face: baht(r.face), coupon: fmt(r.coupon, 2), freq: freqLabel(r.freq) }) + '</div>';
      html += '<div class="table-wrap"><table class="table right"><thead><tr><th>' + t('schedThDate') + '</th><th>' + t('schedThAmt') + '</th><th>' + t('schedThStatus') + '</th></tr></thead><tbody>';
      sched.forEach(function (row) {
        var got = row.date <= today;
        html += '<tr><td>' + IC.date(row.date, { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
          '<td>' + baht(row.total) + (row.principal ? ' <span style="color:var(--ome-text-2);font-size:var(--ome-fs-xs)">' + t('principalIncluded') + '</span>' : '') + '</td>' +
          '<td><span class="badge ' + (got ? 'ok">' + t('statusGot') : '">' + t('statusWait')) + '</span></td></tr>';
      });
      html += '</tbody></table></div>';
    });

    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.log-del'), function (b) {
      b.addEventListener('click', function () {
        var ts = +b.getAttribute('data-ts');
        editLog(function (a) { for (var i = a.length - 1; i >= 0; i--) if (a[i] && a[i].ts === ts) a.splice(i, 1); });
        renderLog(); renderBondNameList();
      });
    });
  }

  /* ── autocomplete ชื่อพันธบัตรจากประวัติของผู้ใช้เอง (ไม่ hardcode รุ่นจริง — รุ่น/อัตราดอกเบี้ยเปลี่ยนทุกไม่กี่เดือน กรอกผิดกระทบเงินจริง) ── */
  function bondNamesFromLog() {
    var seen = {}, names = [];
    loadLog().forEach(function (r) { if (!seen[r.name]) { seen[r.name] = 1; names.push(r.name); } });
    return names;
  }
  function renderBondNameList() {
    var el = $('bondNameList'); if (!el) return;
    el.innerHTML = bondNamesFromLog().map(function (n) { return '<option value="' + n.replace(/"/g, '&quot;') + '">'; }).join('');
  }

  function init() {
    applyStaticI18n();
    IC.subnav($('ivSubRow'), 'gov-bond');
    $('bfCalcBtn').addEventListener('click', doCalc);
    $('cmpBtn').addEventListener('click', doCompare);
    $('lgAdd').addEventListener('click', addLog);
    renderLog();
    renderBondNameList();
    doCalc(); /* แสดงผลตั้งต้นทันที */
    IC.onLang(function () {
      applyStaticI18n(); IC.subnav($('ivSubRow'), 'gov-bond');
      doCalc();
      if ($('cmpOut').style.display !== 'none') doCompare();
      renderLog();
    });
    if (window.TanotData && window.TanotData.onChange) window.TanotData.onChange(function () { renderLog(); renderBondNameList(); });
  }
  init();
})();
