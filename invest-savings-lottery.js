/* ══════════════════════════════════════════════════════════════════
   Tanot — สลากออมสิน / สลาก ธ.ก.ส. (แท็บ #gsb · #baac ของ invest-lottery.html) — ยุบรวมหน้าลงทุน ขั้น 11
   ไฟล์เดียว parameter ตามชนิด (เดิมเป็นโคลนกันแทบทั้งไฟล์ ต่างแค่ข้อความ/ชื่อคีย์) — แผงเดียว สลับชนิดแล้วโหลดฟอร์ม/สมุดของชนิดนั้น
   • คีย์เดิมไม่เปลี่ยนรูปแบบ: tanot:invest:gsblottery|baaclottery (สมุด [{name,purchDate,maturity,unitPrice,units,drawFreq,evPerDraw,results:{วันที่:฿},ts}]) · :tiers (ค่าฟอร์ม)
   • สูตร EV/ตารางงวด/เทียบเงินฝากอยู่ใน InvestCalc (ย้ายตรงตัว) · สมุดอ่านสด→แก้→เขียน ลบ/บันทึกผลรายงวดอ้างด้วย ts (เดิมใช้ดัชนี)
   ผลตอบแทนเป็นค่าคาดหวังทางสถิติ ไม่ใช่การรับประกัน — ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุนหรือภาษี
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IC = window.InvestCore, Calc = window.InvestCalc;
  var $ = function (id) { return document.getElementById(id); };
  var KINDS = {
    gsb: { log: 'tanot:invest:gsblottery', state: 'tanot:invest:gsblottery:tiers', nameList: 'gsbNameList' },
    baac: { log: 'tanot:invest:baaclottery', state: 'tanot:invest:baaclottery:tiers', nameList: 'baacNameList' }
  };
  var DICT = {
 "base": {
  "th": {
   "delTitle": "ลบ",
   "tiersCardTitle": "ข้อมูลสลากและตารางรางวัล (Prize Tiers)",
   "lblUnitPrice": "ราคาต่อหน่วย (บาท)",
   "lblUnitsHeld": "จำนวนหน่วยที่ถือ",
   "lblUnits": "จำนวนหน่วย",
   "lblPurchDate": "วันที่ซื้อ",
   "lblMaturity": "วันครบกำหนด",
   "lblDrawFreq": "ความถี่จับรางวัล",
   "freqOnceLong": "ทุกเดือน (1 ครั้ง) — วันที่ 16",
   "freqTwiceLong": "ทุกเดือน (2 ครั้ง) — วันที่ 1 และ 16",
   "freqOnce": "ทุกเดือน (1 ครั้ง)",
   "freqTwice": "ทุกเดือน (2 ครั้ง)",
   "lblGuarRate": "อัตราดอกเบี้ยรับประกัน/ปี (%) ",
   "taxExemptLabel": "ดอกเบี้ย/เงินรางวัลได้รับยกเว้นภาษี (ยกเลิกติ๊กถ้ารุ่นที่ถือหักภาษี ณ ที่จ่าย 15%)",
   "tierAddBtn": "เพิ่มระดับรางวัล",
   "calcBtn": "คำนวณค่าคาดหวัง",
   "lblDrawCount": "จำนวนงวดจับรางวัลทั้งหมด",
   "lblEvUnit": "ค่าคาดหวังต่อหน่วยต่องวด",
   "lblProbOne": "โอกาสถูกอย่างน้อย 1 รางวัล/งวด",
   "lblPrizeTotal": "เงินรางวัลที่คาดว่าจะได้รวม",
   "lblInterestTotal": "ดอกเบี้ยรับประกันรวม",
   "lblTotalReturn": "ผลตอบแทนรวมที่คาดหวัง",
   "lblTotalReturnSub": "เงินต้น + ดอกเบี้ย + เงินรางวัล",
   "lblAnnPct": "อัตราผลตอบแทนคาดหวัง/ปี",
   "cmpTitle": "เทียบกับเงินฝากประจำ",
   "lblDepRate": "อัตราดอกเบี้ยเงินฝากประจำที่จะเทียบ (%)",
   "cmpBtn": "เทียบผลตอบแทน",
   "cmpColLottery": "สลากออมสิน (ค่าคาดหวัง)",
   "cmpColDeposit": "เงินฝากประจำ",
   "cmpPrincipal": "เงินต้น",
   "cmpGainExpected": "กำไรคาดหวัง (หลังภาษีตาม toggle)",
   "cmpGross": "ดอกเบี้ยรวมก่อนภาษี",
   "cmpNet": "ดอกเบี้ยรวมหลังหักภาษี 15%",
   "cmpSummary": "สรุป",
   "cmpDiffLotWins": "สลากออมสิน (ค่าคาดหวัง) ได้มากกว่า {v} ตลอด {n} ปี — ผลจริงรายบุคคลจะสุ่มต่างจากค่าคาดหวังนี้ได้มาก",
   "cmpDiffDepWins": "เงินฝากประจำได้มากกว่า {v} ตลอด {n} ปี — ผลจริงรายบุคคลจะสุ่มต่างจากค่าคาดหวังนี้ได้มาก",
   "lgTitle": "สมุดสลากของฉัน + ติดตามผลจับรางวัล",
   "lblLotteryName": "ชื่อ/รุ่นสลาก",
   "phLotteryName": "เช่น สลากออมสินพิเศษ 1 ปี",
   "lblEvPerDraw": "ค่าคาดหวังต่อหน่วยต่องวด (บาท) ",
   "addBtn": "บันทึก",
   "lgEmptyDefault": "ยังไม่มีรายการ",
   "lgEmptyAfterAdd": "ยังไม่มีรายการ",
   "logThDate": "วันที่ซื้อ",
   "logThName": "ชื่อ/รุ่น",
   "logThUnits": "หน่วย",
   "logThMaturity": "ครบกำหนด",
   "groupSummary": "ถือ {units} หน่วย × {price} · จับรางวัล{freq}",
   "schedThDate": "งวดวันที่",
   "schedThStatus": "สถานะ",
   "schedThAmt": "ผลรางวัล (บาท)",
   "statusRecorded": "บันทึกแล้ว",
   "statusPending": "รอบันทึกผล",
   "statusNotYet": "ยังไม่ถึงวันจับ",
   "actualVsExpected": "ผลจริงสะสม {actual} เทียบค่าคาดหวังตามจำนวนงวดที่ผ่านมา ({n} งวด) {expected} — {compare}",
   "compareAbove": "ได้มากกว่าค่าคาดหวัง",
   "compareBelow": "ได้น้อยกว่าค่าคาดหวัง (ปกติมาก ผลรายบุคคลสุ่มต่างจาก EV ได้เสมอ)",
   "alertUnitPrice": "กรอกราคาต่อหน่วยให้ถูกต้อง",
   "alertUnitsHeld": "กรอกจำนวนหน่วยที่ถือให้ถูกต้อง",
   "alertDatesOrder": "กรอกวันที่ซื้อและวันครบกำหนดให้ถูกต้อง (ครบกำหนดต้องอยู่หลังวันที่ซื้อ)",
   "alertCalcFirst": "กดคำนวณค่าคาดหวังก่อน",
   "alertDepRate": "กรอกอัตราดอกเบี้ยเงินฝากประจำให้ถูกต้อง",
   "alertLotteryName": "กรอกชื่อ/รุ่นสลาก",
   "alertDates": "กรอกวันที่ซื้อและวันครบกำหนดให้ถูกต้อง",
   "alertUnitPriceAndUnits": "กรอกราคาต่อหน่วยและจำนวนหน่วยให้ถูกต้อง",
   "tierColLabel": "ระดับรางวัล",
   "tierColAmount": "เงินรางวัล/หน่วย (บาท)",
   "tierColWinners": "จำนวนรางวัล/งวด",
   "tierColTotal": "หน่วยทั้งหมดในงวด",
   "tierPhLabel": "เช่น รางวัลที่ 5"
  },
  "en": {
   "delTitle": "Delete",
   "tiersCardTitle": "Lottery Info and Prize Tiers",
   "lblUnitPrice": "Price per unit (THB)",
   "lblUnitsHeld": "Units held",
   "lblUnits": "Units",
   "lblPurchDate": "Purchase date",
   "lblMaturity": "Maturity date",
   "lblDrawFreq": "Draw frequency",
   "freqOnceLong": "Monthly (once) — the 16th",
   "freqTwiceLong": "Monthly (twice) — the 1st and 16th",
   "freqOnce": "Monthly (once)",
   "freqTwice": "Monthly (twice)",
   "lblGuarRate": "Guaranteed interest rate/year (%) ",
   "taxExemptLabel": "Interest/prizes are tax-exempt (uncheck if your series has 15% withholding tax)",
   "tierAddBtn": "Add prize tier",
   "calcBtn": "Calculate expected value",
   "lblDrawCount": "Total number of draws",
   "lblEvUnit": "Expected value per unit per draw",
   "lblProbOne": "Chance of winning at least 1 prize/draw",
   "lblPrizeTotal": "Total expected prize money",
   "lblInterestTotal": "Total guaranteed interest",
   "lblTotalReturn": "Total expected return",
   "lblTotalReturnSub": "Principal + interest + prize money",
   "lblAnnPct": "Expected annual return rate",
   "cmpTitle": "Compare with a Fixed Deposit",
   "lblDepRate": "Fixed-deposit rate to compare against (%)",
   "cmpBtn": "Compare returns",
   "cmpColLottery": "Savings Lottery (Expected Value)",
   "cmpColDeposit": "Fixed Deposit",
   "cmpPrincipal": "Principal",
   "cmpGainExpected": "Expected gain (after tax per toggle)",
   "cmpGross": "Total interest before tax",
   "cmpNet": "Total interest after 15% tax",
   "cmpSummary": "Summary",
   "cmpDiffLotWins": "The savings lottery (expected value) earns {v} more over {n} years — an individual's actual result can vary a lot from this expected value",
   "cmpDiffDepWins": "The fixed deposit earns {v} more over {n} years — an individual's actual result can vary a lot from this expected value",
   "lgTitle": "My Lottery Log + Draw Result Tracker",
   "lblLotteryName": "Lottery name/series",
   "phLotteryName": "e.g. Special 1-Year Savings Lottery",
   "lblEvPerDraw": "Expected value per unit per draw (THB) ",
   "addBtn": "Log",
   "lgEmptyDefault": "No entries yet",
   "lgEmptyAfterAdd": "No entries yet",
   "logThDate": "Purchase date",
   "logThName": "Name/series",
   "logThUnits": "Units",
   "logThMaturity": "Maturity",
   "groupSummary": "Holding {units} units × {price} · draws {freq}",
   "schedThDate": "Draw date",
   "schedThStatus": "Status",
   "schedThAmt": "Prize (THB)",
   "statusRecorded": "Recorded",
   "statusPending": "Awaiting entry",
   "statusNotYet": "Not drawn yet",
   "actualVsExpected": "Actual winnings so far {actual} vs. expected value for the draws elapsed ({n} draws) {expected} — {compare}",
   "compareAbove": "above the expected value",
   "compareBelow": "below the expected value (very normal — an individual's results always vary from EV)",
   "alertUnitPrice": "Enter a valid price per unit",
   "alertUnitsHeld": "Enter a valid number of units held",
   "alertDatesOrder": "Enter valid purchase and maturity dates (maturity must be after the purchase date)",
   "alertCalcFirst": "Calculate the expected value first",
   "alertDepRate": "Enter a valid fixed-deposit interest rate",
   "alertLotteryName": "Enter the lottery name/series",
   "alertDates": "Enter valid purchase and maturity dates",
   "alertUnitPriceAndUnits": "Enter a valid price per unit and number of units",
   "tierColLabel": "Prize tier",
   "tierColAmount": "Prize per unit (THB)",
   "tierColWinners": "Number of winners/draw",
   "tierColTotal": "Total units in the draw",
   "tierPhLabel": "e.g. 5th prize"
  }
 },
 "over": {
  "gsb": {
   "th": {
    "cmpColLottery": "สลากออมสิน (ค่าคาดหวัง)",
    "cmpDiffLotWins": "สลากออมสิน (ค่าคาดหวัง) ได้มากกว่า {v} ตลอด {n} ปี — ผลจริงรายบุคคลจะสุ่มต่างจากค่าคาดหวังนี้ได้มาก",
    "phLotteryName": "เช่น สลากออมสินพิเศษ 1 ปี"
   },
   "en": {
    "cmpColLottery": "Savings Lottery (Expected Value)",
    "cmpDiffLotWins": "The savings lottery (expected value) earns {v} more over {n} years — an individual's actual result can vary a lot from this expected value",
    "phLotteryName": "e.g. Special 1-Year Savings Lottery"
   }
  },
  "baac": {
   "th": {
    "cmpColLottery": "สลาก ธ.ก.ส. (ค่าคาดหวัง)",
    "cmpDiffLotWins": "สลาก ธ.ก.ส. (ค่าคาดหวัง) ได้มากกว่า {v} ตลอด {n} ปี — ผลจริงรายบุคคลจะสุ่มต่างจากค่าคาดหวังนี้ได้มาก",
    "phLotteryName": "เช่น สลากออมทรัพย์ ธ.ก.ส."
   },
   "en": {
    "cmpColLottery": "BAAC Lottery (Expected Value)",
    "cmpDiffLotWins": "The BAAC lottery (expected value) earns {v} more over {n} years — an individual's actual result can vary a lot from this expected value",
    "phLotteryName": "e.g. BAAC Savings Lottery Bond"
   }
  }
 }
};
  var Ls = {};
  ['gsb', 'baac'].forEach(function (k) {
    var d = { th: Object.assign({}, DICT.base.th, DICT.over[k].th), en: Object.assign({}, DICT.base.en, DICT.over[k].en) };
    Ls[k] = IC.i18n(d);
  });
  var kind = null, inited = false, tiers = [], lastCalc = null;
  function t(key, vars) { return Ls[kind || 'gsb'].t(key, vars); }
  function esc(s) { return IC.esc(s); }

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function baht(n) { return '฿' + fmt0(n); }
  function pct(n, d) { return isFinite(n) ? fmt(n, d == null ? 3 : d) + '%' : '—'; }
  var parseYMD = Calc.parseYMD, ymd = Calc.ymd, thaiDate = Calc.fmtThaiDate, parseDrawDays = Calc.parseDrawDays, drawSchedule = Calc.drawSchedule;
  var FREQ_KEY = { '16': 'freqOnce', '1,16': 'freqTwice' };
  function freqLabel(freq) { return t(FREQ_KEY[freq] || 'freqOnce'); }

  /* ── โครงแผง (สร้างครั้งแรกที่เปิด) ── */
  function panelHtml() {
    return '<div class="card"><h2 data-i18n="tiersCardTitle"></h2>' +
      '<div class="frow">' +
        '<div class="field"><label for="gbUnitPrice" data-i18n="lblUnitPrice"></label><input class="input" type="number" id="gbUnitPrice" inputmode="numeric" value="100"></div>' +
        '<div class="field"><label for="gbUnits" data-i18n="lblUnitsHeld"></label><input class="input" type="number" id="gbUnits" inputmode="numeric" value="100"></div>' +
        '<div class="field"><label for="gbPurchDate" data-i18n="lblPurchDate"></label><input class="input" type="date" id="gbPurchDate"></div>' +
        '<div class="field"><label for="gbMaturity" data-i18n="lblMaturity"></label><input class="input" type="date" id="gbMaturity"></div></div>' +
      '<div class="frow"><div class="field"><label for="gbDrawFreq" data-i18n="lblDrawFreq"></label><select id="gbDrawFreq"><option value="16" selected data-i18n="freqOnceLong"></option><option value="1,16" data-i18n="freqTwiceLong"></option></select></div>' +
        '<div class="field"><label for="gbGuarRate" data-i18n="lblGuarRate"></label><input class="input" type="number" id="gbGuarRate" inputmode="decimal" step="0.01" value="0.1"></div></div>' +
      '<label style="display:flex;align-items:center;gap:6px;margin-top:10px;cursor:pointer"><input type="checkbox" id="gbTaxExempt" checked><span data-i18n="taxExemptLabel"></span></label>' +
      '<div><div id="tierBox"></div><button class="btn sm" id="tierAddBtn" type="button"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-plus"/></svg><span data-i18n="tierAddBtn"></span></button></div>' +
      '<div><button class="btn primary" id="gbCalcBtn" type="button" data-i18n="calcBtn"></button></div>' +
      '<div id="gbOut" style="display:none"><div class="kpi-grid">' +
        '<div class="kpi"><div class="kpi-label" data-i18n="lblDrawCount"></div><div class="kpi-value" id="gbDrawCount">—</div></div>' +
        '<div class="kpi"><div class="kpi-label" data-i18n="lblEvUnit"></div><div class="kpi-value" id="gbEvUnit">—</div></div>' +
        '<div class="kpi"><div class="kpi-label" data-i18n="lblProbOne"></div><div class="kpi-value" id="gbProbOne">—</div></div>' +
        '<div class="kpi"><div class="kpi-label" data-i18n="lblPrizeTotal"></div><div class="kpi-value" id="gbPrizeTotal">—</div></div>' +
        '<div class="kpi"><div class="kpi-label" data-i18n="lblInterestTotal"></div><div class="kpi-value" id="gbInterestTotal">—</div></div>' +
        '<div class="kpi"><div class="kpi-label" data-i18n="lblTotalReturn"></div><div class="kpi-value grow" id="gbTotalReturn">—</div><div class="sub" data-i18n="lblTotalReturnSub"></div></div>' +
        '<div class="kpi"><div class="kpi-label" data-i18n="lblAnnPct"></div><div class="kpi-value grow" id="gbAnnPct">—</div></div></div></div></div>' +
    '<div class="card"><h2 data-i18n="cmpTitle"></h2>' +
      '<div class="frow"><div class="field"><label for="cmpDepRate" data-i18n="lblDepRate"></label><input class="input" type="number" id="cmpDepRate" inputmode="decimal" step="0.01" value="1.5"></div><button class="btn sm" id="cmpBtn" type="button" data-i18n="cmpBtn"></button></div>' +
      '<div id="cmpOut" style="display:none"><div class="cmp">' +
        '<div class="col acc"><h3 data-i18n="cmpColLottery"></h3><div class="line"><span data-i18n="cmpPrincipal"></span><span class="v" id="cmpLotPrincipal">—</span></div><div class="line"><span data-i18n="cmpGainExpected"></span><span class="v" id="cmpLotGain">—</span></div></div>' +
        '<div class="col div"><h3 data-i18n="cmpColDeposit"></h3><div class="line"><span data-i18n="cmpPrincipal"></span><span class="v" id="cmpDepPrincipal">—</span></div><div class="line"><span data-i18n="cmpGross"></span><span class="v" id="cmpDepGross">—</span></div><div class="line"><span data-i18n="cmpNet"></span><span class="v" id="cmpDepNet">—</span></div></div></div>' +
        '<div class="kpi-grid"><div class="kpi"><div class="kpi-label" data-i18n="cmpSummary"></div><div class="kpi-value" id="cmpDiff" style="font-size:var(--ome-fs-base)">—</div></div></div></div></div>' +
    '<div class="card"><h2 data-i18n="lgTitle"></h2>' +
      '<div class="frow"><div class="field" style="flex:1 1 160px"><label for="lgName" data-i18n="lblLotteryName"></label><input class="input" type="text" id="lgName" list="savNameList" data-i18n-placeholder="phLotteryName"><datalist id="savNameList"></datalist></div>' +
        '<div class="field"><label for="lgPurchDate" data-i18n="lblPurchDate"></label><input class="input" type="date" id="lgPurchDate"></div>' +
        '<div class="field"><label for="lgMaturity" data-i18n="lblMaturity"></label><input class="input" type="date" id="lgMaturity"></div></div>' +
      '<div class="frow"><div class="field"><label for="lgUnitPrice" data-i18n="lblUnitPrice"></label><input class="input" type="number" id="lgUnitPrice" inputmode="numeric" value="100"></div>' +
        '<div class="field"><label for="lgUnits" data-i18n="lblUnits"></label><input class="input" type="number" id="lgUnits" inputmode="numeric" value="100"></div>' +
        '<div class="field"><label for="lgDrawFreq" data-i18n="lblDrawFreq"></label><select id="lgDrawFreq"><option value="16" selected data-i18n="freqOnce"></option><option value="1,16" data-i18n="freqTwice"></option></select></div>' +
        '<div class="field"><label for="lgEvPerDraw" data-i18n="lblEvPerDraw"></label><input class="input" type="number" id="lgEvPerDraw" inputmode="decimal" step="0.0001" value="0"></div>' +
        '<button class="btn sm" id="lgAdd" type="button"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-plus"/></svg><span data-i18n="addBtn"></span></button></div>' +
      '<div id="lgBox"></div></div>';
  }

  /* ══ ตารางระดับรางวัล + ค่าฟอร์ม (คีย์ :tiers ของชนิดที่เปิดอยู่) ══ */
  function defaultTiers() { return [{ label: '', amount: 0, winners: 0, totalUnits: 0 }, { label: '', amount: 0, winners: 0, totalUnits: 0 }]; }
  function loadState() { var o = IC.lsJson(KINDS[kind].state); return o && typeof o === 'object' ? o : null; }
  function saveState() {
    IC.lsSet(KINDS[kind].state, {
      unitPrice: $('gbUnitPrice').value, units: $('gbUnits').value,
      purchDate: $('gbPurchDate').value, maturity: $('gbMaturity').value,
      drawFreq: $('gbDrawFreq').value, guarRate: $('gbGuarRate').value,
      taxExempt: $('gbTaxExempt').checked, tiers: tiers
    });
  }
  function readTiersFromUI() {
    tiers = [].map.call($('tierBox').querySelectorAll('tr[data-ti]'), function (tr) {
      return { label: tr.querySelector('.t-label').value, amount: num(tr.querySelector('.t-amount').value) || 0, winners: num(tr.querySelector('.t-winners').value) || 0, totalUnits: num(tr.querySelector('.t-total').value) || 0 };
    });
    return tiers;
  }
  function renderTierRows() {
    var box = $('tierBox');
    var html = '<div class="table-wrap"><table class="table tier-table"><thead><tr><th>' + esc(t('tierColLabel')) + '</th><th>' + esc(t('tierColAmount')) + '</th><th>' + esc(t('tierColWinners')) + '</th><th>' + esc(t('tierColTotal')) + '</th><th></th></tr></thead><tbody>';
    tiers.forEach(function (tier, i) {
      html += '<tr data-ti="' + i + '">' +
        '<td><input type="text" class="input t-label" value="' + esc(tier.label || '') + '" placeholder="' + esc(t('tierPhLabel')) + '"></td>' +
        '<td><input type="number" class="input t-amount" value="' + (tier.amount || '') + '" inputmode="decimal"></td>' +
        '<td><input type="number" class="input t-winners" value="' + (tier.winners || '') + '" inputmode="numeric"></td>' +
        '<td><input type="number" class="input t-total" value="' + (tier.totalUnits || '') + '" inputmode="numeric"></td>' +
        '<td><button class="btn sm ghost icon tier-del" data-i="' + i + '" type="button" aria-label="' + esc(t('delTitle')) + '"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-x"/></svg></button></td></tr>';
    });
    box.innerHTML = html + '</tbody></table></div>';
    [].forEach.call(box.querySelectorAll('.tier-del'), function (b) {
      b.addEventListener('click', function () { readTiersFromUI(); tiers.splice(+b.getAttribute('data-i'), 1); renderTierRows(); saveState(); });
    });
  }

  /* ── คำนวณค่าคาดหวัง / เทียบเงินฝาก ── */
  function doCalc() {
    readTiersFromUI();
    var unitPrice = num($('gbUnitPrice').value), units = num($('gbUnits').value),
      purchDate = parseYMD($('gbPurchDate').value), maturity = parseYMD($('gbMaturity').value),
      guarRate = num($('gbGuarRate').value), taxExempt = $('gbTaxExempt').checked, drawDays = parseDrawDays($('gbDrawFreq').value);
    if (!isFinite(unitPrice) || unitPrice <= 0) { alert(t('alertUnitPrice')); return; }
    if (!isFinite(units) || units <= 0) { alert(t('alertUnitsHeld')); return; }
    if (!purchDate || !maturity || !(maturity > purchDate)) { alert(t('alertDatesOrder')); return; }
    if (!isFinite(guarRate) || guarRate < 0) guarRate = 0;
    var principal = unitPrice * units, years = (maturity - purchDate) / (365.25 * 86400000);
    var numberOfDraws = drawSchedule(purchDate, maturity, drawDays).length;
    var evUnit = Calc.evPerUnitPerDraw(tiers), probOne = Calc.probAtLeastOnePerDraw(tiers, units);
    var res = Calc.totalExpectedReturn(principal, guarRate, years, tiers, units, numberOfDraws, taxExempt);
    var annPct = Calc.annualizedExpectedReturnPct(res.totalNet - principal, principal, years);
    $('gbOut').style.display = 'block';
    $('gbDrawCount').textContent = fmt0(numberOfDraws);
    $('gbEvUnit').textContent = baht(evUnit);
    $('gbProbOne').textContent = isFinite(probOne) ? pct(probOne * 100, 2) : '—';
    $('gbPrizeTotal').textContent = baht(res.prizeAfterTax);
    $('gbInterestTotal').textContent = baht(res.interestAfterTax);
    $('gbTotalReturn').textContent = baht(res.totalNet);
    $('gbAnnPct').textContent = pct(annPct, 3);
    lastCalc = { principal: principal, years: years, units: units, unitPrice: unitPrice, numberOfDraws: numberOfDraws, evUnit: evUnit, expectedResult: res };
    $('lgEvPerDraw').value = fmt(evUnit, 4);
    saveState();
  }
  function doCompare() {
    if (!lastCalc) { alert(t('alertCalcFirst')); return; }
    var depRate = num($('cmpDepRate').value);
    if (!isFinite(depRate) || depRate < 0) { alert(t('alertDepRate')); return; }
    var r = Calc.compareLotteryVsDeposit(lastCalc.principal, lastCalc.years, lastCalc.expectedResult, depRate);
    $('cmpOut').style.display = 'block';
    $('cmpLotPrincipal').textContent = baht(r.principal); $('cmpLotGain').textContent = baht(r.lotteryGainNet);
    $('cmpDepPrincipal').textContent = baht(r.principal); $('cmpDepGross').textContent = baht(r.depGross); $('cmpDepNet').textContent = baht(r.depAfterTax);
    var diff = r.lotteryGainNet - r.depAfterTax;
    $('cmpDiff').textContent = t(diff >= 0 ? 'cmpDiffLotWins' : 'cmpDiffDepWins', { v: baht(Math.abs(diff)), n: fmt(r.years, 1) });
  }

  /* ── สมุดสลาก + ติดตามผลจับรางวัลรายงวด (อ่านสด→แก้→เขียน · อ้างด้วย ts) ── */
  function loadLog() { var a = IC.lsJson(KINDS[kind].log); return Array.isArray(a) ? a : []; }
  function editLog(fn) { var a = loadLog(); fn(a); IC.lsSet(KINDS[kind].log, a); }
  function addLog() {
    var name = ($('lgName').value || '').trim(), purchDate = parseYMD($('lgPurchDate').value), maturity = parseYMD($('lgMaturity').value);
    var unitPrice = num($('lgUnitPrice').value), units = num($('lgUnits').value), drawFreq = $('lgDrawFreq').value, evPerDraw = num($('lgEvPerDraw').value) || 0;
    if (!name) { alert(t('alertLotteryName')); return; }
    if (!purchDate || !maturity || !(maturity > purchDate)) { alert(t('alertDates')); return; }
    if (!isFinite(unitPrice) || unitPrice <= 0 || !isFinite(units) || units <= 0) { alert(t('alertUnitPriceAndUnits')); return; }
    editLog(function (log) {
      var ts = Date.now(); while (log.some(function (r) { return r && r.ts === ts; })) ts++;
      log.push({ name: name, purchDate: $('lgPurchDate').value, maturity: $('lgMaturity').value, unitPrice: unitPrice, units: units, drawFreq: drawFreq, evPerDraw: evPerDraw, results: {}, ts: ts });
    });
    $('lgName').value = ''; $('lgPurchDate').value = ''; $('lgMaturity').value = '';
    renderLog(); renderNameList();
  }
  function renderLog() {
    var log = loadLog(), box = $('lgBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">' + esc(t('lgEmptyAfterAdd')) + '</div>'; return; }
    var today = new Date();
    var html = '<div class="table-wrap"><table class="table right"><thead><tr><th>' + esc(t('logThDate')) + '</th><th>' + esc(t('logThName')) + '</th><th>' + esc(t('logThUnits')) + '</th><th>' + esc(t('logThMaturity')) + '</th><th></th></tr></thead><tbody>';
    log.forEach(function (r) {
      html += '<tr><td>' + thaiDate(parseYMD(r.purchDate)) + '</td><td>' + esc(r.name) + '</td><td>' + fmt0(r.units) + '</td><td>' + thaiDate(parseYMD(r.maturity)) + '</td>' +
        '<td><button class="btn sm ghost icon log-del" type="button" aria-label="' + esc(t('delTitle')) + '" data-ts="' + esc(r.ts) + '"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-x"/></svg></button></td></tr>';
    });
    html += '</tbody></table></div>';
    log.forEach(function (r) {
      var sched = drawSchedule(parseYMD(r.purchDate), parseYMD(r.maturity), parseDrawDays(r.drawFreq));
      var pastCount = sched.filter(function (row) { return row.date <= today; }).length, actualTotal = 0;
      Object.keys(r.results || {}).forEach(function (k) { actualTotal += (+r.results[k]) || 0; });
      var expectedSoFar = (r.evPerDraw || 0) * r.units * pastCount;
      html += '<div class="log-group-hd">' + esc(r.name) + '</div>';
      html += '<div class="log-group-sub">' + esc(t('groupSummary', { units: fmt0(r.units), price: baht(r.unitPrice), freq: freqLabel(r.drawFreq) })) + '</div>';
      html += '<div class="table-wrap"><table class="table right"><thead><tr><th>' + esc(t('schedThDate')) + '</th><th>' + esc(t('schedThStatus')) + '</th><th>' + esc(t('schedThAmt')) + '</th></tr></thead><tbody>';
      sched.forEach(function (row) {
        var key = ymd(row.date), isPast = row.date <= today, recorded = r.results && r.results.hasOwnProperty(key), val = recorded ? r.results[key] : '';
        html += '<tr><td>' + thaiDate(row.date) + '</td>' +
          '<td>' + (isPast ? (recorded ? '<span class="badge ok">' + esc(t('statusRecorded')) + '</span>' : '<span class="badge">' + esc(t('statusPending')) + '</span>') : '<span class="badge">' + esc(t('statusNotYet')) + '</span>') + '</td>' +
          '<td>' + (isPast ? '<input type="number" inputmode="decimal" class="input draw-input" data-ts="' + esc(r.ts) + '" data-key="' + key + '" value="' + val + '" placeholder="0">' : '<span style="color:var(--ome-text-2)">—</span>') + '</td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="log-group-sub" style="margin-top:6px">' + t('actualVsExpected', { actual: '<b>' + baht(actualTotal) + '</b>', n: pastCount, expected: '<b>' + baht(expectedSoFar) + '</b>', compare: esc(actualTotal >= expectedSoFar ? t('compareAbove') : t('compareBelow')) }) + '</div>';
    });
    box.innerHTML = html;
  }
  function bindLog() {
    var box = $('lgBox');
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.log-del'); if (!b) return;
      var ts = +b.getAttribute('data-ts');
      editLog(function (a) { for (var i = a.length - 1; i >= 0; i--) if (a[i] && a[i].ts === ts) a.splice(i, 1); });
      renderLog(); renderNameList();
    });
    box.addEventListener('change', function (e) {
      var inp = e.target; if (!inp.classList || !inp.classList.contains('draw-input')) return;
      var ts = +inp.getAttribute('data-ts'), key = inp.getAttribute('data-key'), v = inp.value === '' ? null : num(inp.value);
      editLog(function (log) {
        log.forEach(function (r) {
          if (!r || r.ts !== ts) return;
          r.results = r.results || {};
          if (v === null || !isFinite(v)) delete r.results[key]; else r.results[key] = v;
        });
      });
      renderLog();
    });
  }
  function renderNameList() {
    var el = $('savNameList'); if (!el) return;
    var seen = {}, names = [];
    loadLog().forEach(function (r) { if (!seen[r.name]) { seen[r.name] = 1; names.push(r.name); } });
    el.innerHTML = names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
  }

  /* ── สลับชนิด: โหลดค่าฟอร์ม/สมุดของชนิดนั้น ── */
  function loadForm() {
    var saved = loadState();
    tiers = (saved && saved.tiers && saved.tiers.length) ? saved.tiers : defaultTiers();
    $('gbUnitPrice').value = saved ? saved.unitPrice : 100; $('gbUnits').value = saved ? saved.units : 100;
    $('gbPurchDate').value = saved ? saved.purchDate : ''; $('gbMaturity').value = saved ? saved.maturity : '';
    $('gbDrawFreq').value = saved ? saved.drawFreq : '16'; $('gbGuarRate').value = saved ? saved.guarRate : 0.1;
    $('gbTaxExempt').checked = saved ? !!saved.taxExempt : true;
    $('gbOut').style.display = 'none'; $('cmpOut').style.display = 'none'; lastCalc = null;
    $('lgEvPerDraw').value = 0;
    renderTierRows(); renderLog(); renderNameList();
  }
  function relang() {
    var panel = $('panelSavings');
    Ls[kind].apply(panel);
    readTiersFromUI(); renderTierRows();
    if ($('gbOut').style.display !== 'none') doCalc();
    if ($('cmpOut').style.display !== 'none') doCompare();
    renderLog();
  }
  function open(k) {
    if (!KINDS[k]) return;
    var panel = $('panelSavings');
    if (!inited) {
      inited = true; kind = k;
      panel.innerHTML = panelHtml();
      Ls[kind].apply(panel);
      $('tierAddBtn').addEventListener('click', function () { readTiersFromUI(); tiers.push({ label: '', amount: 0, winners: 0, totalUnits: 0 }); renderTierRows(); saveState(); });
      $('gbCalcBtn').addEventListener('click', doCalc);
      $('cmpBtn').addEventListener('click', doCompare);
      $('lgAdd').addEventListener('click', addLog);
      bindLog();
      loadForm();
      IC.onLang(function () { if (inited) relang(); });
      if (window.TanotData && window.TanotData.onChange) window.TanotData.onChange(function () { if (!panel.hidden) { renderLog(); renderNameList(); } });
      return;
    }
    if (k === kind) return;
    kind = k;
    Ls[kind].apply(panel);
    loadForm();
  }

  window.InvestSavings = { open: open, kinds: KINDS };
})();
