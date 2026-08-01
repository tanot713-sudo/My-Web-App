/* ══════════════════════════════════════════════════════════════════
   Tanot — พันธบัตรรัฐบาล · คำนวณผลตอบแทน (YTM) + ตารางจ่ายดอกเบี้ย + เทียบเงินฝากประจำ
   หมายเหตุ: ไม่มีราคา/ผลตอบแทนตลาดสด (ไม่มี API ฟรีไม่ต้องขอ key) — กรอกข้อมูลเองทั้งหมด
   ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุนหรือคำแนะนำภาษี
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LOG_KEY = 'tanot:invest:govbond';

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function baht(n) { return '฿' + fmt0(n); }

  /* ── ราคาปัจจุบัน (present value) ของพันธบัตร ณ อัตราคิดลดต่องวด ──── */
  function bondPV(couponPerPeriod, face, nPeriods, ratePerPeriod) {
    var pv = 0, i;
    for (i = 1; i <= nPeriods; i++) {
      pv += couponPerPeriod / Math.pow(1 + ratePerPeriod, i);
    }
    pv += face / Math.pow(1 + ratePerPeriod, nPeriods);
    return pv;
  }

  /* ── หาผลตอบแทนแท้จริงจนครบกำหนด (Yield To Maturity) ด้วย bisection ──
     แก้สมการ: ราคาที่ซื้อ = PV(ดอกเบี้ยที่เหลือทั้งหมด + เงินต้นคืนวันครบกำหนด)
     คืนค่าเป็น % ต่อปีแบบ nominal (ทบเท่าจำนวนงวด/ปีที่จ่ายจริง — ธรรมเนียมตลาดตราสารหนี้) */
  function solveYTM(price, face, couponRatePct, freq, years) {
    var nPeriods = Math.round(freq * years);
    if (!(nPeriods > 0) || !isFinite(price) || price <= 0 || !isFinite(face) || face <= 0) return NaN;
    var couponPerPeriod = face * (couponRatePct / 100) / freq;

    function f(rPerPeriod) { return bondPV(couponPerPeriod, face, nPeriods, rPerPeriod) - price; }

    var lo = -0.5, hi = 2;
    var fLo = f(lo), fHi = f(hi), tries = 0;
    while (fLo * fHi > 0 && tries < 10) { hi *= 2; fHi = f(hi); tries++; }
    if (fLo * fHi > 0 || !isFinite(fLo) || !isFinite(fHi)) return NaN;

    var mid = lo, iter;
    for (iter = 0; iter < 100; iter++) {
      mid = (lo + hi) / 2;
      var fMid = f(mid);
      if (Math.abs(fMid) < 1e-7 || (hi - lo) < 1e-12) break;
      if ((fLo < 0) === (fMid < 0)) { lo = mid; fLo = fMid; } else { hi = mid; fHi = fMid; }
    }
    return mid * freq * 100;
  }

  /* ── บวกเดือนแบบกันวันที่ overflow (เช่น 31 ม.ค. + 1 เดือน ต้อง clamp เป็นสิ้นเดือน ก.พ.) ── */
  function addMonths(date, months) {
    var d = new Date(date.getTime());
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
  }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function parseYMD(s) {
    if (!s) return null;
    var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isFinite(d.getTime()) ? d : null;
  }

  /* ── สร้างตารางจ่ายดอกเบี้ยตั้งแต่วันซื้อจนครบกำหนด ──
     คืนอาเรย์ {date, coupon, principal, total} เรียงตามเวลา งวดสุดท้ายรวมเงินต้นคืนด้วยเสมอ */
  function couponSchedule(purchaseDate, maturityDate, freq, face, couponRatePct) {
    var rows = [];
    if (!purchaseDate || !maturityDate || !(maturityDate > purchaseDate) || !(freq > 0)) return rows;
    var stepMonths = 12 / freq;
    var couponAmt = face * (couponRatePct / 100) / freq;
    var d = addMonths(purchaseDate, stepMonths), guard = 0;
    while (d <= maturityDate && guard < 2000) {
      var isLast = sameDay(d, maturityDate);
      rows.push({ date: d, coupon: couponAmt, principal: isLast ? face : 0, total: couponAmt + (isLast ? face : 0) });
      if (isLast) break;
      d = addMonths(d, stepMonths);
      guard++;
    }
    if (!rows.length || !sameDay(rows[rows.length - 1].date, maturityDate)) {
      rows.push({ date: new Date(maturityDate.getTime()), coupon: 0, principal: face, total: face });
    }
    return rows;
  }

  /* ── คำนวณผลตอบแทนพันธบัตร ── */
  var lastCalc = null;

  function doCalc() {
    var face = num($('bfFace').value), couponPct = num($('bfCoupon').value),
        freq = num($('bfFreq').value), price = num($('bfPrice').value), years = num($('bfYears').value);
    if (!isFinite(face) || face <= 0) { alert('กรอกมูลค่าหน้าตั๋วให้ถูกต้อง'); return; }
    if (!isFinite(price) || price <= 0) { alert('กรอกราคาที่ซื้อให้ถูกต้อง'); return; }
    if (!isFinite(years) || years <= 0) { alert('กรอกจำนวนปีจนครบกำหนดให้ถูกต้อง'); return; }
    if (!isFinite(couponPct) || couponPct < 0) couponPct = 0;

    var annualCoupon = face * couponPct / 100;
    var afterTax = annualCoupon * (1 - 0.15);
    var ytm = solveYTM(price, face, couponPct, freq, years);

    $('bfOut').style.display = 'block';
    $('bfCouponAnnual').textContent = baht(annualCoupon);
    $('bfCouponAfterTax').textContent = baht(afterTax);
    $('bfYtm').textContent = isFinite(ytm) ? fmt(ytm, 2) + '%' : '—';

    var sub;
    if (Math.abs(price - face) < 0.01) sub = 'ซื้อที่ราคาพาร์ — ผลตอบแทนแท้จริง ≈ อัตราดอกเบี้ยหน้าตั๋ว';
    else if (price < face) sub = 'ซื้อต่ำกว่าพาร์ — ผลตอบแทนแท้จริงจึง<b>สูงกว่า</b>อัตราดอกเบี้ยหน้าตั๋ว';
    else sub = 'ซื้อสูงกว่าพาร์ — ผลตอบแทนแท้จริงจึง<b>ต่ำกว่า</b>อัตราดอกเบี้ยหน้าตั๋ว';
    $('bfYtmSub').innerHTML = sub;

    lastCalc = { face: face, couponPct: couponPct, freq: freq, price: price, years: years, annualCoupon: annualCoupon };
  }

  /* ── เทียบกับเงินฝากประจำ ── */
  function compareDeposit(principal, years, bondAnnualCoupon, depositRatePct) {
    var bondGross = bondAnnualCoupon * years;
    var bondAfterTax = bondGross * (1 - 0.15);
    var depGross = principal * (depositRatePct / 100) * years;
    var depAfterTax = depGross * (1 - 0.15);
    return { principal: principal, years: years, bondGross: bondGross, bondAfterTax: bondAfterTax, depGross: depGross, depAfterTax: depAfterTax };
  }

  function doCompare() {
    if (!lastCalc) { alert('กดคำนวณผลตอบแทนพันธบัตรก่อน'); return; }
    var depRate = num($('cmpDepRate').value);
    if (!isFinite(depRate) || depRate < 0) { alert('กรอกอัตราดอกเบี้ยเงินฝากประจำให้ถูกต้อง'); return; }
    var r = compareDeposit(lastCalc.price, lastCalc.years, lastCalc.annualCoupon, depRate);
    $('cmpOut').style.display = 'block';
    $('cmpBondPrincipal').textContent = baht(r.principal);
    $('cmpBondGross').textContent = baht(r.bondGross);
    $('cmpBondNet').textContent = baht(r.bondAfterTax);
    $('cmpDepPrincipal').textContent = baht(r.principal);
    $('cmpDepGross').textContent = baht(r.depGross);
    $('cmpDepNet').textContent = baht(r.depAfterTax);
    var diff = r.bondAfterTax - r.depAfterTax;
    $('cmpDiff').textContent = (diff >= 0 ? 'พันธบัตรได้มากกว่า ' : 'เงินฝากประจำได้มากกว่า ') + baht(Math.abs(diff)) + ' หลังหักภาษี ตลอด ' + fmt0(r.years) + ' ปี';
  }

  /* ── สมุดพันธบัตรของฉัน (localStorage) ─────────────────────────── */
  function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
  function saveLog(a) { try { localStorage.setItem(LOG_KEY, JSON.stringify(a)); } catch (e) {} }

  var FREQ_LABEL = { 1: 'ทุกปี', 2: 'ทุก 6 เดือน', 4: 'ทุก 3 เดือน' };

  function addLog() {
    var name = ($('lgName').value || '').trim();
    var purchDate = parseYMD($('lgPurchDate').value), maturity = parseYMD($('lgMaturity').value);
    var face = num($('lgFace').value), coupon = num($('lgCoupon').value), freq = num($('lgFreq').value);
    if (!name) { alert('กรอกชื่อ/รุ่นพันธบัตร'); return; }
    if (!purchDate || !maturity) { alert('กรอกวันที่ซื้อและวันครบกำหนดให้ถูกต้อง'); return; }
    if (!(maturity > purchDate)) { alert('วันครบกำหนดต้องอยู่หลังวันที่ซื้อ'); return; }
    if (!isFinite(face) || face <= 0 || !isFinite(coupon) || coupon < 0) { alert('กรอกมูลค่าหน้าตั๋วและอัตราดอกเบี้ยให้ถูกต้อง'); return; }
    var log = loadLog();
    log.push({ name: name, purchDate: $('lgPurchDate').value, maturity: $('lgMaturity').value, face: face, coupon: coupon, freq: freq, ts: Date.now() });
    saveLog(log);
    $('lgName').value = ''; $('lgFace').value = 100000; $('lgCoupon').value = 3;
    $('lgPurchDate').value = ''; $('lgMaturity').value = '';
    renderLog();
    renderBondNameList();
  }

  function renderLog() {
    var log = loadLog(), box = $('lgBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">ยังไม่มีรายการ — บันทึกทุกครั้งที่ซื้อพันธบัตร จะได้ตารางจ่ายดอกเบี้ยและติดตามว่างวดไหนได้รับแล้ว</div>'; return; }
    var today = new Date();
    var html = '<table class="log-table"><thead><tr><th>วันที่ซื้อ</th><th>ชื่อ/รุ่น</th><th>หน้าตั๋ว</th><th>ดอกเบี้ย</th><th>ครบกำหนด</th><th></th></tr></thead><tbody>';
    log.forEach(function (r, i) {
      html += '<tr><td>' + parseYMD(r.purchDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
        '<td>' + r.name + '</td><td>' + baht(r.face) + '</td><td>' + fmt(r.coupon, 2) + '%</td>' +
        '<td>' + parseYMD(r.maturity).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
        '<td><button class="log-del" data-i="' + i + '">✕</button></td></tr>';
    });
    html += '</tbody></table>';

    log.forEach(function (r) {
      var sched = couponSchedule(parseYMD(r.purchDate), parseYMD(r.maturity), r.freq, r.face, r.coupon);
      html += '<div class="log-group-hd">' + r.name + '</div>';
      html += '<div class="log-group-sub">ซื้อ ' + baht(r.face) + ' · ดอกเบี้ย ' + fmt(r.coupon, 2) + '%/ปี · จ่าย' + (FREQ_LABEL[r.freq] || '') + '</div>';
      html += '<table class="log-table"><thead><tr><th>วันจ่าย</th><th>จำนวนเงิน</th><th>สถานะ</th></tr></thead><tbody>';
      sched.forEach(function (row) {
        var got = row.date <= today;
        html += '<tr><td>' + row.date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
          '<td>' + baht(row.total) + (row.principal ? ' <span style="color:var(--muted);font-size:11px">(รวมเงินต้นคืน)</span>' : '') + '</td>' +
          '<td><span class="cp-badge ' + (got ? 'got">ได้รับแล้ว' : 'wait">รอรับ') + '</span></td></tr>';
      });
      html += '</tbody></table>';
    });

    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.log-del'), function (b) {
      b.addEventListener('click', function () { var log = loadLog(); log.splice(+b.getAttribute('data-i'), 1); saveLog(log); renderLog(); });
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
    $('bfCalcBtn').addEventListener('click', doCalc);
    $('cmpBtn').addEventListener('click', doCompare);
    $('lgAdd').addEventListener('click', addLog);
    renderLog();
    renderBondNameList();
    doCalc(); /* แสดงผลตั้งต้นทันที */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__govbond = { solveYTM: solveYTM, bondPV: bondPV, couponSchedule: couponSchedule, compareDeposit: compareDeposit, addMonths: addMonths };
})();
