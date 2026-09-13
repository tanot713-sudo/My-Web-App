/* ══════════════════════════════════════════════════════════════════
   Tanot — สลากออมสิน · คำนวณค่าคาดหวัง (Expected Value) เงินรางวัล + ติดตามผลจับรางวัล
   หมายเหตุ: ไม่มีตารางรางวัล/อัตราดอกเบี้ยจริง (เปลี่ยนทุกรุ่น) — กรอกข้อมูลเองทั้งหมด
   ผลตอบแทนเป็นค่าคาดหวังทางสถิติ ไม่ใช่การรับประกัน — ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุนหรือภาษี
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LOG_KEY = 'tanot:invest:gsblottery';
  var STATE_KEY = 'tanot:invest:gsblottery:tiers';

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function baht(n) { return '฿' + fmt0(n); }
  function pct(n, d) { return isFinite(n) ? fmt(n, d == null ? 3 : d) + '%' : '—'; }

  /* ══════ ระบบสองภาษา (ไทย/อังกฤษ) — ตามธรรมเนียมเดียวกับ invest-gold.js / invest-gov-bond.js ══════ */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      navInvest: 'การลงทุน', pageTitleShort: 'สลากออมสิน',
      pageTitle: 'สลากออมสิน — คำนวณค่าคาดหวัง (EV) เงินรางวัล + ติดตามผลจับรางวัล',
      tiersCardTitle: 'ข้อมูลสลากและตารางรางวัล (Prize Tiers)',
      lblUnitPrice: 'ราคาต่อหน่วย (บาท)', lblUnitsHeld: 'จำนวนหน่วยที่ถือ', lblUnits: 'จำนวนหน่วย',
      lblPurchDate: 'วันที่ซื้อ', lblMaturity: 'วันครบกำหนด', lblDrawFreq: 'ความถี่จับรางวัล',
      freqOnceLong: 'ทุกเดือน (1 ครั้ง) — วันที่ 16', freqTwiceLong: 'ทุกเดือน (2 ครั้ง) — วันที่ 1 และ 16',
      freqOnce: 'ทุกเดือน (1 ครั้ง)', freqTwice: 'ทุกเดือน (2 ครั้ง)',
      lblGuarRate: 'อัตราดอกเบี้ยรับประกัน/ปี (%) ',
      taxExemptLabel: 'ดอกเบี้ย/เงินรางวัลได้รับยกเว้นภาษี (ยกเลิกติ๊กถ้ารุ่นที่ถือหักภาษี ณ ที่จ่าย 15%)',
      tierAddBtn: '+ เพิ่มระดับรางวัล',
      calcBtn: 'คำนวณค่าคาดหวัง',
      lblDrawCount: 'จำนวนงวดจับรางวัลทั้งหมด', lblEvUnit: 'ค่าคาดหวังต่อหน่วยต่องวด',
      lblProbOne: 'โอกาสถูกอย่างน้อย 1 รางวัล/งวด', lblPrizeTotal: 'เงินรางวัลที่คาดว่าจะได้รวม',
      lblInterestTotal: 'ดอกเบี้ยรับประกันรวม', lblTotalReturn: 'ผลตอบแทนรวมที่คาดหวัง',
      lblTotalReturnSub: 'เงินต้น + ดอกเบี้ย + เงินรางวัล', lblAnnPct: 'อัตราผลตอบแทนคาดหวัง/ปี',
      cmpTitle: 'เทียบกับเงินฝากประจำ', lblDepRate: 'อัตราดอกเบี้ยเงินฝากประจำที่จะเทียบ (%)', cmpBtn: 'เทียบผลตอบแทน',
      cmpColLottery: 'สลากออมสิน (ค่าคาดหวัง)', cmpColDeposit: 'เงินฝากประจำ',
      cmpPrincipal: 'เงินต้น', cmpGainExpected: 'กำไรคาดหวัง (หลังภาษีตาม toggle)',
      cmpGross: 'ดอกเบี้ยรวมก่อนภาษี', cmpNet: 'ดอกเบี้ยรวมหลังหักภาษี 15%', cmpSummary: 'สรุป',
      cmpDiffLotWins: 'สลากออมสิน (ค่าคาดหวัง) ได้มากกว่า {v} ตลอด {n} ปี — ผลจริงรายบุคคลจะสุ่มต่างจากค่าคาดหวังนี้ได้มาก',
      cmpDiffDepWins: 'เงินฝากประจำได้มากกว่า {v} ตลอด {n} ปี — ผลจริงรายบุคคลจะสุ่มต่างจากค่าคาดหวังนี้ได้มาก',
      lgTitle: 'สมุดสลากของฉัน + ติดตามผลจับรางวัล',
      lblLotteryName: 'ชื่อ/รุ่นสลาก', phLotteryName: 'เช่น สลากออมสินพิเศษ 1 ปี',
      lblEvPerDraw: 'ค่าคาดหวังต่อหน่วยต่องวด (บาท) ',
      addBtn: '+ บันทึก',
      lgEmptyDefault: 'ยังไม่มีรายการ',
      lgEmptyAfterAdd: 'ยังไม่มีรายการ',
      logThDate: 'วันที่ซื้อ', logThName: 'ชื่อ/รุ่น', logThUnits: 'หน่วย', logThMaturity: 'ครบกำหนด',
      groupSummary: 'ถือ {units} หน่วย × {price} · จับรางวัล{freq}',
      schedThDate: 'งวดวันที่', schedThStatus: 'สถานะ', schedThAmt: 'ผลรางวัล (บาท)',
      statusRecorded: 'บันทึกแล้ว', statusPending: 'รอบันทึกผล', statusNotYet: 'ยังไม่ถึงวันจับ',
      actualVsExpected: 'ผลจริงสะสม {actual} เทียบค่าคาดหวังตามจำนวนงวดที่ผ่านมา ({n} งวด) {expected} — {compare}',
      compareAbove: 'ได้มากกว่าค่าคาดหวัง', compareBelow: 'ได้น้อยกว่าค่าคาดหวัง (ปกติมาก ผลรายบุคคลสุ่มต่างจาก EV ได้เสมอ)',
      alertUnitPrice: 'กรอกราคาต่อหน่วยให้ถูกต้อง', alertUnitsHeld: 'กรอกจำนวนหน่วยที่ถือให้ถูกต้อง',
      alertDatesOrder: 'กรอกวันที่ซื้อและวันครบกำหนดให้ถูกต้อง (ครบกำหนดต้องอยู่หลังวันที่ซื้อ)',
      alertCalcFirst: 'กดคำนวณค่าคาดหวังก่อน', alertDepRate: 'กรอกอัตราดอกเบี้ยเงินฝากประจำให้ถูกต้อง',
      alertLotteryName: 'กรอกชื่อ/รุ่นสลาก', alertDates: 'กรอกวันที่ซื้อและวันครบกำหนดให้ถูกต้อง',
      alertUnitPriceAndUnits: 'กรอกราคาต่อหน่วยและจำนวนหน่วยให้ถูกต้อง',
      tierColLabel: 'ระดับรางวัล', tierColAmount: 'เงินรางวัล/หน่วย (บาท)', tierColWinners: 'จำนวนรางวัล/งวด',
      tierColTotal: 'หน่วยทั้งหมดในงวด', tierPhLabel: 'เช่น รางวัลที่ 5'
    },
    en: {
      navInvest: 'Investing', pageTitleShort: 'GSB Savings Lottery',
      pageTitle: 'GSB Savings Lottery — Expected Value (EV) Calculator + Draw Result Tracker',
      tiersCardTitle: 'Lottery Info and Prize Tiers',
      lblUnitPrice: 'Price per unit (THB)', lblUnitsHeld: 'Units held', lblUnits: 'Units',
      lblPurchDate: 'Purchase date', lblMaturity: 'Maturity date', lblDrawFreq: 'Draw frequency',
      freqOnceLong: 'Monthly (once) — the 16th', freqTwiceLong: 'Monthly (twice) — the 1st and 16th',
      freqOnce: 'Monthly (once)', freqTwice: 'Monthly (twice)',
      lblGuarRate: 'Guaranteed interest rate/year (%) ',
      taxExemptLabel: 'Interest/prizes are tax-exempt (uncheck if your series has 15% withholding tax)',
      tierAddBtn: '+ Add prize tier',
      calcBtn: 'Calculate expected value',
      lblDrawCount: 'Total number of draws', lblEvUnit: 'Expected value per unit per draw',
      lblProbOne: 'Chance of winning at least 1 prize/draw', lblPrizeTotal: 'Total expected prize money',
      lblInterestTotal: 'Total guaranteed interest', lblTotalReturn: 'Total expected return',
      lblTotalReturnSub: 'Principal + interest + prize money', lblAnnPct: 'Expected annual return rate',
      cmpTitle: 'Compare with a Fixed Deposit', lblDepRate: 'Fixed-deposit rate to compare against (%)', cmpBtn: 'Compare returns',
      cmpColLottery: 'Savings Lottery (Expected Value)', cmpColDeposit: 'Fixed Deposit',
      cmpPrincipal: 'Principal', cmpGainExpected: 'Expected gain (after tax per toggle)',
      cmpGross: 'Total interest before tax', cmpNet: 'Total interest after 15% tax', cmpSummary: 'Summary',
      cmpDiffLotWins: 'The savings lottery (expected value) earns {v} more over {n} years — an individual\'s actual result can vary a lot from this expected value',
      cmpDiffDepWins: "The fixed deposit earns {v} more over {n} years — an individual's actual result can vary a lot from this expected value",
      lgTitle: 'My Lottery Log + Draw Result Tracker',
      lblLotteryName: 'Lottery name/series', phLotteryName: 'e.g. Special 1-Year Savings Lottery',
      lblEvPerDraw: 'Expected value per unit per draw (THB) ',
      addBtn: '+ Log',
      lgEmptyDefault: 'No entries yet',
      lgEmptyAfterAdd: 'No entries yet',
      logThDate: 'Purchase date', logThName: 'Name/series', logThUnits: 'Units', logThMaturity: 'Maturity',
      groupSummary: 'Holding {units} units × {price} · draws {freq}',
      schedThDate: 'Draw date', schedThStatus: 'Status', schedThAmt: 'Prize (THB)',
      statusRecorded: 'Recorded', statusPending: 'Awaiting entry', statusNotYet: 'Not drawn yet',
      actualVsExpected: 'Actual winnings so far {actual} vs. expected value for the draws elapsed ({n} draws) {expected} — {compare}',
      compareAbove: 'above the expected value', compareBelow: 'below the expected value (very normal — an individual\'s results always vary from EV)',
      alertUnitPrice: 'Enter a valid price per unit', alertUnitsHeld: 'Enter a valid number of units held',
      alertDatesOrder: 'Enter valid purchase and maturity dates (maturity must be after the purchase date)',
      alertCalcFirst: 'Calculate the expected value first', alertDepRate: 'Enter a valid fixed-deposit interest rate',
      alertLotteryName: 'Enter the lottery name/series', alertDates: 'Enter valid purchase and maturity dates',
      alertUnitPriceAndUnits: 'Enter a valid price per unit and number of units',
      tierColLabel: 'Prize tier', tierColAmount: 'Prize per unit (THB)', tierColWinners: 'Number of winners/draw',
      tierColTotal: 'Total units in the draw', tierPhLabel: 'e.g. 5th prize'
    }
  };
  function t(key, vars) {
    var s = (I18N[getUILang()] || I18N.th)[key];
    if (s == null) s = (I18N.th[key] != null ? I18N.th[key] : key);
    if (vars) { for (var k in vars) { s = s.split('{' + k + '}').join(vars[k]); } }
    return s;
  }
  function applyStaticI18n() {
    [].forEach.call(document.querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    [].forEach.call(document.querySelectorAll('[data-i18n-html]'), function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    [].forEach.call(document.querySelectorAll('[data-i18n-placeholder]'), function (el) { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
  }
  var FREQ_KEY = { '16': 'freqOnce', '1,16': 'freqTwice' };
  function freqLabel(freq) { return t(FREQ_KEY[freq] || 'freqOnce'); }

  /* ── บวกเดือนแบบกันวันที่ overflow (คัดลอกจาก invest-gov-bond.js) ── */
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
  /* คีย์วันที่แบบ local (ไม่ใช้ toISOString เพราะเลื่อนวันได้ถ้า timezone ไม่ใช่ UTC) */
  function ymd(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function thaiDate(d) { return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); }

  function parseDrawDays(s) { return (s || '16').split(',').map(function (x) { return +x; }).filter(function (n) { return n >= 1 && n <= 31; }); }

  /* ── สร้างตารางวันจับรางวัลตามวัน-ที่-ในเดือน (ไม่ใช่ relative-to-purchase แบบพันธบัตร) ──
     เดินทีละเดือนด้วย addMonths บน "วันที่ 1" เสมอ (กันปัญหา clamp สะสมเมื่อ dayOfMonth=31 ผ่านเดือนสั้น) */
  function drawSchedule(purchaseDate, maturityDate, daysOfMonth) {
    var rows = [];
    if (!purchaseDate || !maturityDate || !(maturityDate > purchaseDate) || !daysOfMonth || !daysOfMonth.length) return rows;
    var anchor = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);
    var guard = 0;
    while (guard < 2000) {
      var y = anchor.getFullYear(), m = anchor.getMonth();
      var lastDay = new Date(y, m + 1, 0).getDate();
      for (var i = 0; i < daysOfMonth.length; i++) {
        var day = Math.min(daysOfMonth[i], lastDay);
        var d = new Date(y, m, day);
        if (d > purchaseDate && d <= maturityDate) rows.push({ date: d });
      }
      if (anchor > maturityDate) break;
      anchor = addMonths(anchor, 1); /* anchor.getDate() === 1 เสมอ จึงไม่มีปัญหา clamp */
      guard++;
    }
    rows.sort(function (a, b) { return a.date - b.date; });
    return rows;
  }

  /* ── ค่าคาดหวัง (Expected Value) จากตารางระดับรางวัลหลายชั้น ──
     สมมติฐาน: แต่ละระดับรางวัลและแต่ละหน่วยที่ถือเป็นอิสระต่อกัน (simplifying assumption สำหรับมือใหม่) */
  function tierProbability(tier) {
    if (!(tier.totalUnits > 0) || !(tier.winners >= 0)) return NaN;
    return tier.winners / tier.totalUnits;
  }
  function evPerUnitPerDraw(tiers) {
    var sum = 0;
    tiers.forEach(function (tier) { var p = tierProbability(tier); if (isFinite(p)) sum += p * (tier.amount || 0); });
    return sum;
  }
  function probAtLeastOnePerDraw(tiers, unitsHeld) {
    var probNone = 1;
    tiers.forEach(function (tier) {
      var p = tierProbability(tier);
      if (isFinite(p)) probNone *= Math.pow(1 - p, unitsHeld);
    });
    return isFinite(probNone) ? 1 - probNone : NaN;
  }
  function expectedTotalPrize(tiers, unitsHeld, numberOfDraws) {
    return evPerUnitPerDraw(tiers) * unitsHeld * numberOfDraws;
  }
  function guaranteedRedemption(principal, annualRatePct, years) {
    return principal * (1 + (annualRatePct / 100) * years);
  }
  /* ── ผลตอบแทนรวมที่คาดหวัง: เงินต้นคืนเต็ม + ดอกเบี้ยรับประกัน + เงินรางวัลคาดหวัง (ปรับภาษีตาม toggle) ── */
  function totalExpectedReturn(principal, annualRatePct, years, tiers, unitsHeld, numberOfDraws, taxExempt) {
    var guaranteed = guaranteedRedemption(principal, annualRatePct, years);
    var guaranteedInterest = guaranteed - principal;
    var prizeEV = expectedTotalPrize(tiers, unitsHeld, numberOfDraws);
    var taxRate = taxExempt ? 0 : 0.15;
    var interestAfterTax = guaranteedInterest * (1 - taxRate);
    var prizeAfterTax = prizeEV * (1 - taxRate);
    return {
      principal: principal, guaranteedInterest: guaranteedInterest, prizeEV: prizeEV,
      interestAfterTax: interestAfterTax, prizeAfterTax: prizeAfterTax,
      totalGross: principal + guaranteedInterest + prizeEV,
      totalNet: principal + interestAfterTax + prizeAfterTax
    };
  }
  /* อัตราผลตอบแทนคาดหวัง/ปี — เฉลี่ยแบบเส้นตรง (การันตีเงินต้นคงที่ ไม่มีการทบต้นจริง จึงไม่ใช้ CAGR) */
  function annualizedExpectedReturnPct(totalNetGain, principal, years) {
    if (!(principal > 0) || !(years > 0)) return NaN;
    return (totalNetGain / principal / years) * 100;
  }

  /* ── เทียบกับเงินฝากประจำ (เงินฝากใช้ภาษี 15% มาตรฐานเสมอ ต่างจากฝั่งสลากที่ผูกกับ toggle) ── */
  function compareLotteryVsDeposit(principal, years, expectedResult, depositRatePct) {
    var lotteryGainNet = expectedResult.totalNet - principal;
    var depGross = principal * (depositRatePct / 100) * years;
    var depAfterTax = depGross * (1 - 0.15);
    return { principal: principal, years: years, lotteryGainNet: lotteryGainNet, depGross: depGross, depAfterTax: depAfterTax };
  }

  /* ══ ตารางระดับรางวัล (ในหน่วยความจำของหน้า + persist ลง localStorage) ══ */
  var tiers = [];
  function defaultTiers() {
    return [
      { label: '', amount: 0, winners: 0, totalUnits: 0 },
      { label: '', amount: 0, winners: 0, totalUnits: 0 }
    ];
  }
  function loadState() { try { return JSON.parse(localStorage.getItem(STATE_KEY)) || null; } catch (e) { return null; } }
  function saveState() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        unitPrice: $('gbUnitPrice').value, units: $('gbUnits').value,
        purchDate: $('gbPurchDate').value, maturity: $('gbMaturity').value,
        drawFreq: $('gbDrawFreq').value, guarRate: $('gbGuarRate').value,
        taxExempt: $('gbTaxExempt').checked, tiers: tiers
      }));
    } catch (e) {}
  }
  function readTiersFromUI() {
    var box = $('tierBox');
    tiers = [].map.call(box.querySelectorAll('tr[data-ti]'), function (tr) {
      return {
        label: tr.querySelector('.t-label').value,
        amount: num(tr.querySelector('.t-amount').value) || 0,
        winners: num(tr.querySelector('.t-winners').value) || 0,
        totalUnits: num(tr.querySelector('.t-total').value) || 0
      };
    });
    return tiers;
  }
  function renderTierRows() {
    var box = $('tierBox');
    var html = '<table class="log-table tier-table"><thead><tr>' +
      '<th>' + t('tierColLabel') + '</th><th>' + t('tierColAmount') + '</th><th>' + t('tierColWinners') + '</th><th>' + t('tierColTotal') + '</th><th></th></tr></thead><tbody>';
    tiers.forEach(function (tier, i) {
      html += '<tr data-ti="' + i + '">' +
        '<td><input type="text" class="t-label" value="' + (tier.label || '').replace(/"/g, '&quot;') + '" placeholder="' + t('tierPhLabel') + '"></td>' +
        '<td><input type="number" class="t-amount" value="' + (tier.amount || '') + '" inputmode="decimal"></td>' +
        '<td><input type="number" class="t-winners" value="' + (tier.winners || '') + '" inputmode="numeric"></td>' +
        '<td><input type="number" class="t-total" value="' + (tier.totalUnits || '') + '" inputmode="numeric"></td>' +
        '<td><button class="tier-del" data-i="' + i + '" type="button">✕</button></td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.tier-del'), function (b) {
      b.addEventListener('click', function () { readTiersFromUI(); tiers.splice(+b.getAttribute('data-i'), 1); renderTierRows(); saveState(); });
    });
  }

  /* ── คำนวณค่าคาดหวัง ── */
  var lastCalc = null;

  function doCalc() {
    readTiersFromUI();
    var unitPrice = num($('gbUnitPrice').value), units = num($('gbUnits').value),
        purchDate = parseYMD($('gbPurchDate').value), maturity = parseYMD($('gbMaturity').value),
        guarRate = num($('gbGuarRate').value), taxExempt = $('gbTaxExempt').checked,
        drawDays = parseDrawDays($('gbDrawFreq').value);
    if (!isFinite(unitPrice) || unitPrice <= 0) { alert(t('alertUnitPrice')); return; }
    if (!isFinite(units) || units <= 0) { alert(t('alertUnitsHeld')); return; }
    if (!purchDate || !maturity || !(maturity > purchDate)) { alert(t('alertDatesOrder')); return; }
    if (!isFinite(guarRate) || guarRate < 0) guarRate = 0;

    var principal = unitPrice * units;
    var years = (maturity - purchDate) / (365.25 * 86400000);
    var sched = drawSchedule(purchDate, maturity, drawDays);
    var numberOfDraws = sched.length;
    var evUnit = evPerUnitPerDraw(tiers);
    var probOne = probAtLeastOnePerDraw(tiers, units);
    var res = totalExpectedReturn(principal, guarRate, years, tiers, units, numberOfDraws, taxExempt);
    var annPct = annualizedExpectedReturnPct(res.totalNet - principal, principal, years);

    $('gbOut').style.display = 'block';
    $('gbDrawCount').textContent = fmt0(numberOfDraws);
    $('gbEvUnit').textContent = baht(evUnit);
    $('gbProbOne').textContent = isFinite(probOne) ? pct(probOne * 100, 2) : '—';
    $('gbPrizeTotal').textContent = baht(res.prizeAfterTax);
    $('gbInterestTotal').textContent = baht(res.interestAfterTax);
    $('gbTotalReturn').textContent = baht(res.totalNet);
    $('gbAnnPct').textContent = pct(annPct, 3);

    lastCalc = {
      principal: principal, years: years, units: units, unitPrice: unitPrice,
      numberOfDraws: numberOfDraws, evUnit: evUnit, expectedResult: res
    };
    $('lgEvPerDraw').value = fmt(evUnit, 4);
    saveState();
  }

  function doCompare() {
    if (!lastCalc) { alert(t('alertCalcFirst')); return; }
    var depRate = num($('cmpDepRate').value);
    if (!isFinite(depRate) || depRate < 0) { alert(t('alertDepRate')); return; }
    var r = compareLotteryVsDeposit(lastCalc.principal, lastCalc.years, lastCalc.expectedResult, depRate);
    $('cmpOut').style.display = 'block';
    $('cmpLotPrincipal').textContent = baht(r.principal);
    $('cmpLotGain').textContent = baht(r.lotteryGainNet);
    $('cmpDepPrincipal').textContent = baht(r.principal);
    $('cmpDepGross').textContent = baht(r.depGross);
    $('cmpDepNet').textContent = baht(r.depAfterTax);
    var diff = r.lotteryGainNet - r.depAfterTax;
    $('cmpDiff').textContent = t(diff >= 0 ? 'cmpDiffLotWins' : 'cmpDiffDepWins', { v: baht(Math.abs(diff)), n: fmt(r.years, 1) });
  }

  /* ── สมุดสลาก + ติดตามผลจับรางวัลรายงวด ── */
  function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
  function saveLog(a) { try { localStorage.setItem(LOG_KEY, JSON.stringify(a)); } catch (e) {} }

  function addLog() {
    var name = ($('lgName').value || '').trim();
    var purchDate = parseYMD($('lgPurchDate').value), maturity = parseYMD($('lgMaturity').value);
    var unitPrice = num($('lgUnitPrice').value), units = num($('lgUnits').value),
        drawFreq = $('lgDrawFreq').value, evPerDraw = num($('lgEvPerDraw').value) || 0;
    if (!name) { alert(t('alertLotteryName')); return; }
    if (!purchDate || !maturity || !(maturity > purchDate)) { alert(t('alertDates')); return; }
    if (!isFinite(unitPrice) || unitPrice <= 0 || !isFinite(units) || units <= 0) { alert(t('alertUnitPriceAndUnits')); return; }
    var log = loadLog();
    log.push({
      name: name, purchDate: $('lgPurchDate').value, maturity: $('lgMaturity').value,
      unitPrice: unitPrice, units: units, drawFreq: drawFreq, evPerDraw: evPerDraw, results: {}, ts: Date.now()
    });
    saveLog(log);
    $('lgName').value = ''; $('lgPurchDate').value = ''; $('lgMaturity').value = '';
    renderLog();
    renderNameList();
  }

  function renderLog() {
    var log = loadLog(), box = $('lgBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">' + t('lgEmptyAfterAdd') + '</div>'; return; }
    var today = new Date();
    var html = '<table class="log-table"><thead><tr><th>' + t('logThDate') + '</th><th>' + t('logThName') + '</th><th>' + t('logThUnits') + '</th><th>' + t('logThMaturity') + '</th><th></th></tr></thead><tbody>';
    log.forEach(function (r, i) {
      html += '<tr><td>' + thaiDate(parseYMD(r.purchDate)) + '</td><td>' + r.name + '</td>' +
        '<td>' + fmt0(r.units) + '</td><td>' + thaiDate(parseYMD(r.maturity)) + '</td>' +
        '<td><button class="log-del" data-i="' + i + '">✕</button></td></tr>';
    });
    html += '</tbody></table>';

    log.forEach(function (r, li) {
      var days = parseDrawDays(r.drawFreq);
      var sched = drawSchedule(parseYMD(r.purchDate), parseYMD(r.maturity), days);
      var pastCount = sched.filter(function (row) { return row.date <= today; }).length;
      var actualTotal = 0;
      Object.keys(r.results || {}).forEach(function (k) { actualTotal += (+r.results[k]) || 0; });
      var expectedSoFar = (r.evPerDraw || 0) * r.units * pastCount;

      html += '<div class="log-group-hd">' + r.name + '</div>';
      html += '<div class="log-group-sub">' + t('groupSummary', { units: fmt0(r.units), price: baht(r.unitPrice), freq: freqLabel(r.drawFreq) }) + '</div>';
      html += '<table class="log-table"><thead><tr><th>' + t('schedThDate') + '</th><th>' + t('schedThStatus') + '</th><th>' + t('schedThAmt') + '</th></tr></thead><tbody>';
      sched.forEach(function (row) {
        var key = ymd(row.date), isPast = row.date <= today, recorded = r.results && r.results.hasOwnProperty(key);
        var val = recorded ? r.results[key] : '';
        html += '<tr><td>' + thaiDate(row.date) + '</td>' +
          '<td>' + (isPast ? (recorded ? '<span class="cp-badge got">' + t('statusRecorded') + '</span>' : '<span class="cp-badge wait">' + t('statusPending') + '</span>') : '<span class="cp-badge wait">' + t('statusNotYet') + '</span>') + '</td>' +
          '<td>' + (isPast ? '<input type="number" inputmode="decimal" class="draw-input" data-li="' + li + '" data-key="' + key + '" value="' + val + '" placeholder="0">' : '<span style="color:var(--muted)">—</span>') + '</td></tr>';
      });
      html += '</tbody></table>';
      html += '<div class="log-group-sub" style="margin-top:6px">' + t('actualVsExpected', {
        actual: '<b>' + baht(actualTotal) + '</b>', n: pastCount, expected: '<b>' + baht(expectedSoFar) + '</b>',
        compare: actualTotal >= expectedSoFar ? t('compareAbove') : t('compareBelow')
      }) + '</div>';
    });

    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.log-del'), function (b) {
      b.addEventListener('click', function () { var log = loadLog(); log.splice(+b.getAttribute('data-i'), 1); saveLog(log); renderLog(); });
    });
    [].forEach.call(box.querySelectorAll('.draw-input'), function (inp) {
      inp.addEventListener('change', function () {
        var log = loadLog(), li = +inp.getAttribute('data-li'), key = inp.getAttribute('data-key');
        var v = inp.value === '' ? null : num(inp.value);
        if (!log[li]) return;
        log[li].results = log[li].results || {};
        if (v === null || !isFinite(v)) delete log[li].results[key]; else log[li].results[key] = v;
        saveLog(log);
        renderLog();
      });
    });
  }

  /* ── autocomplete ชื่อสลากจากประวัติของผู้ใช้เอง (ไม่ hardcode รุ่นจริง — รุ่น/อัตรา/ตารางรางวัลเปลี่ยนทุกไม่กี่เดือน) ── */
  function namesFromLog() {
    var seen = {}, names = [];
    loadLog().forEach(function (r) { if (!seen[r.name]) { seen[r.name] = 1; names.push(r.name); } });
    return names;
  }
  function renderNameList() {
    var el = $('gsbNameList'); if (!el) return;
    el.innerHTML = namesFromLog().map(function (n) { return '<option value="' + n.replace(/"/g, '&quot;') + '">'; }).join('');
  }

  function init() {
    applyStaticI18n();
    var saved = loadState();
    tiers = (saved && saved.tiers && saved.tiers.length) ? saved.tiers : defaultTiers();
    if (saved) {
      $('gbUnitPrice').value = saved.unitPrice; $('gbUnits').value = saved.units;
      $('gbPurchDate').value = saved.purchDate; $('gbMaturity').value = saved.maturity;
      $('gbDrawFreq').value = saved.drawFreq; $('gbGuarRate').value = saved.guarRate;
      $('gbTaxExempt').checked = !!saved.taxExempt;
    }
    renderTierRows();
    $('tierAddBtn').addEventListener('click', function () { readTiersFromUI(); tiers.push({ label: '', amount: 0, winners: 0, totalUnits: 0 }); renderTierRows(); saveState(); });
    $('gbCalcBtn').addEventListener('click', doCalc);
    $('cmpBtn').addEventListener('click', doCompare);
    $('lgAdd').addEventListener('click', addLog);
    renderLog();
    renderNameList();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.omeApplyLang = function () {
    applyStaticI18n();
    readTiersFromUI(); /* กันไม่ให้ค่าที่พิมพ์ในตารางระดับรางวัลหายตอนสลับภาษา (ยังไม่ commit ผ่าน doCalc/เพิ่ม/ลบแถว) */
    renderTierRows();
    if ($('gbOut').style.display !== 'none') doCalc();
    if ($('cmpOut').style.display !== 'none') doCompare();
    renderLog();
  };

  window.__gsblottery = {
    drawSchedule: drawSchedule, parseDrawDays: parseDrawDays, addMonths: addMonths, ymd: ymd,
    tierProbability: tierProbability, evPerUnitPerDraw: evPerUnitPerDraw,
    probAtLeastOnePerDraw: probAtLeastOnePerDraw, expectedTotalPrize: expectedTotalPrize,
    guaranteedRedemption: guaranteedRedemption, totalExpectedReturn: totalExpectedReturn,
    annualizedExpectedReturnPct: annualizedExpectedReturnPct, compareLotteryVsDeposit: compareLotteryVsDeposit
  };
})();
