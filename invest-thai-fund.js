/* ══════════════════════════════════════════════════════════════════
   Tanot — กองทุนไทย · วางแผน DCA + คำนวณลดหย่อนภาษี (RMF/SSF/Thai ESG)
   • โปรเจกต์มูลค่าอนาคตจาก DCA (จำลองเดือนต่อเดือน) — สะสมมูลค่า vs ปันผล
   • เติมไม้ตอนย่อ (ดัชนี SET)
   • สมุดซื้อจริง แยกตามชื่อกองทุน + ประเภทเพื่อภาษี
   • คำนวณภาษีที่ประหยัดได้จาก RMF/SSF/Thai ESG ตามขั้นบันไดภาษีจริง
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุนหรือคำแนะนำภาษี
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LOG_KEY = 'tanot:invest:thaifund';

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function baht(n) { return '฿' + fmt0(n); }

  /* ══════ ระบบแปลภาษา (i18n) — รูปแบบเดียวกับหน้าอื่นในโซนลงทุน ══════ */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      crumbHome: 'การลงทุน', crumbHere: 'กองทุนไทย',
      pageTitle: 'กองทุนรวมไทย — วางแผน DCA + ประหยัดภาษี',
      dcaTitle: 'แผนทยอยซื้อ (DCA)', accMLabel: 'ซื้อ "สะสมมูลค่า" /เดือน', divMLabel: 'ซื้อ "ปันผล" /เดือน',
      yearsLabel: 'วางแผนล่วงหน้า', unitYears: '(ปี)', cagrLabel: 'ผลตอบแทนเฉลี่ย/ปี', unitPct: '(%)',
      feeLabel: 'ค่าธรรมเนียมกองทุน/ปี', dyLabel: 'ปันผลของชนิดปันผล/ปี', calcPlanBtn: 'คำนวณแผน',
      oContribLabel: 'เงินที่ลงทั้งหมด', oValueLabel: 'มูลค่ารวมโดยประมาณ', oGainLabel: 'กำไรจากการเติบโต', oGainSub: 'ยังไม่รวมภาษี/ค่าธรรมเนียมซื้อ',
      accColTitle: 'แบบสะสมมูลค่า', divColTitle: 'แบบปันผล',
      lineInvested: 'ลงทั้งหมด', lineFinalValue: 'มูลค่าปลายทาง', lineDivReceived: 'ปันผลรับ', lineDivReceivedNote: '— (ทบในกอง)', lineDivCumulative: 'ปันผลรับสะสม',
      chartValue: 'มูลค่ารวม', chartCost: 'เงินที่ใส่ (ต้นทุน)', viewYearTableSummary: 'ดูตารางรายปี',
      taxTitle: 'คำนวณเงินลดหย่อนภาษี (RMF / SSF / Thai ESG)', txYearLabel: 'ปีภาษีที่จะซื้อ', txYearUnit: '(กระทบเพดาน Thai ESG)',
      txIncomeLabel: 'เงินได้สุทธิที่ต้องเสียภาษีต่อปี', txIncomeUnit: '(หลังหักลดหย่อนอื่นแล้ว)',
      txRmfLabel: 'ซื้อ RMF ปีนี้', txSsfLabel: 'ซื้อ SSF ปีนี้', txEsgLabel: 'ซื้อ Thai ESG ปีนี้', unitBaht: '(บาท)',
      txOtherLabel: 'ลดหย่อนกลุ่มเกษียณอื่นที่ใช้ไปแล้ว', txOtherUnit: '(กบข./PVD/ประกันบำนาญ ฯลฯ, บาท)',
      taxCalcBtn: 'คำนวณภาษีที่ประหยัดได้', taxFromLogBtn: 'ใช้ยอดจากสมุดซื้อปีนี้',
      txBeforeLabel: 'ภาษีก่อนหักกองทุนนี้', txAfterLabel: 'ภาษีหลังหักกองทุนนี้', txSavedLabel: 'ประหยัดภาษีได้',
      viewMultiYearSummary: 'ดูแผนหลายปี (ลงทุนต่อเนื่อง)', txIncomeGrowthLabel: 'เงินได้เติบโตเฉลี่ย/ปี', txProjBtn: 'คำนวณแผนหลายปี',
      txProjNote: 'สมมติว่าซื้อ RMF/SSF/ESG เท่าเดิมทุกปี (เพดาน Thai ESG จะขยับให้อัตโนมัติถ้าข้ามปี 2570)',
      riskTitle: 'ระดับความเสี่ยงกองทุน (1–8)', riskHint: 'ระดับความเสี่ยงพิมพ์อยู่บนหน้าแรกของ Fund Factsheet ทุกกองเสมอ — ยิ่งเลขสูง ยิ่งผันผวนสูง ไม่ใช่ "แย่กว่า" แต่ต้องรับความผันผวนได้มากกว่า',
      riskLabel1: 'ตลาดเงิน', riskLabel2: 'ตราสารหนี้ระยะสั้น', riskLabel3: 'ตราสารหนี้ทั่วไป', riskLabel4: 'ผสม (หุ้น+หนี้)',
      riskLabel5: 'หุ้นไทย/ต่างประเทศ', riskLabel6: 'หุ้นเฉพาะกลุ่ม/ประเทศเดียว', riskLabel7: 'ทองคำ/สินค้าโภคภัณฑ์', riskLabel8: 'อนุพันธ์/ทางเลือกซับซ้อน',
      ddTitle: 'ตลาดย่อ = โอกาสเติมไม้ (ทางเลือก)', idxNowLabel: 'ดัชนี SET ตอนนี้', idxAthLabel: 'จุดสูงสุดที่เคยทำ (ATH)', ddBtn: 'ดูคำแนะนำ',
      tr10m: 'ย่อเล็ก', tr20m: 'ตลาดหมี', tr30m: 'ย่อแรง',
      logTitle: 'สมุดซื้อจริงของฉัน', lgFundLabel: 'ชื่อกองทุน', lgCatLabel: 'ประเภท (เพื่อภาษี)',
      catGeneral: 'ทั่วไป', catRmf: 'RMF', catSsf: 'SSF', catEsg: 'Thai ESG',
      lgAmtLabel: 'เงินที่ซื้อ (บาท)', lgNavLabel: 'ราคา/หน่วย (NAV)', lgAddBtn: '+ เพิ่ม',
      lgCurLabel: 'NAV ปัจจุบัน (คำนวณกำไร/ขาดทุน)', lgCurPh: 'ราคาต่อหน่วยตอนนี้',
      lgEmptyDefault: 'ยังไม่มีรายการ — บันทึกทุกครั้งที่ซื้อ จะได้รู้ต้นทุนเฉลี่ยและกำไร-ขาดทุน แยกตามกองทุน',
      elTitle: 'วันที่พร้อมขายแบบไม่เสียสิทธิ์ภาษี', elBirthYearLabel: 'ปีเกิด', elBirthYearUnit: '(สำหรับเช็คเงื่อนไขอายุ 55 ปีของ RMF เท่านั้น)',
      elNote: 'เป็นตัวประมาณจากวันที่บันทึกในสมุดซื้อเท่านั้น ไม่ใช่ข้อมูลจริงจาก บลจ. — ก่อนขายจริงควรตรวจสอบวันครบกำหนดกับ บลจ./สถิติซื้อขายจริงของคุณอีกครั้ง',
      alertMonthlyAmount: 'ใส่จำนวนเงินซื้อต่อเดือนอย่างน้อยหนึ่งชนิด',
      oContribSub: '{amt} บาท/เดือน × {months} เดือน', oValueSub: 'ในอีก {years} ปี (สมมติ {cagr}%/ปี)',
      yrTableColYear: 'สิ้นปีที่', yrTableColContrib: 'เงินที่ใส่', yrTableColValue: 'มูลค่ารวม', yrTableColGain: 'กำไร', yrRowLabel: 'ปีที่ {n}',
      ddNearAth: 'ตอนนี้ราคาใกล้จุดสูงสุด (ย่อ {dd}%) — DCA ปกติเดือนละ {base} พอ ไม่ต้องเร่งเติม',
      ddNormal: 'ย่อลง <b>{dd}%</b> จากจุดสูงสุด — ยังถือว่าปกติ DCA ตามแผนเดือนละ {base}',
      ddTierMsg: 'ย่อลง <b>{dd}%</b> จากจุดสูงสุด — ตามกฎที่ตั้งไว้ อาจเพิ่มเงินซื้อเดือนนี้เป็น <b>×{mult}</b> ≈ <b>{amt}</b> (ถ้ามีเงินสำรอง)',
      ddWarn: 'เตือน: การย่อไม่ได้แปลว่าจะไม่ลงต่อ — เติมเท่าที่มีเงินสำรองและไม่กระทบชีวิตประจำวัน',
      alertIncomeRequiredProj: 'กรอกเงินได้สุทธิที่ต้องเสียภาษีต่อปีให้ถูกต้องก่อน', alertIncomeRequired: 'กรอกเงินได้สุทธิที่ต้องเสียภาษีต่อปีให้ถูกต้อง',
      txProjThYear: 'ปี', txProjThIncome: 'เงินได้สมมติ', txProjThSaved: 'ประหยัดภาษีปีนั้น', txProjThCum: 'สะสม',
      txSavedSubWithDeduction: 'ใช้สิทธิลดหย่อนรวม {ded} · ประหยัดเฉลี่ย {pct}% ของเงินที่ใส่', txSavedSubNone: 'ยังไม่ได้ใส่จำนวนซื้อ RMF/SSF/ESG',
      txDetailEsgRule: 'เกณฑ์ Thai ESG ปี {year}', txDetailEsgRuleVal: 'ลดหย่อนได้สูงสุด {cap} · ถือ {years} ปี',
      txDetailRmfLabel: 'RMF — ใช้สิทธิได้', txDetailSsfLabel: 'SSF — ใช้สิทธิได้', txDetailEsgLabel: 'Thai ESG — ใช้สิทธิได้', txDetailValOfWant: '{used} / ที่ใส่ {want}',
      txCapNoteRmf: 'RMF เกินสิทธิ (เพดานเดี่ยว {cap} หรือโดนเพดานกลุ่มเกษียณรวมกันไป) ส่วนเกินลดหย่อนไม่ได้',
      txCapNoteSsf: 'SSF เกินสิทธิ (เพดานเดี่ยว {cap} หรือโดนเพดานกลุ่มเกษียณรวมกันไป) ส่วนเกินลดหย่อนไม่ได้',
      txCapNoteEsg: 'Thai ESG เกินเพดาน {cap} (30% ของเงินได้ สูงสุด 300,000 บาท แยกจาก RMF/SSF) ส่วนเกินลดหย่อนไม่ได้',
      txCapNoteCombined: 'RMF+SSF+กลุ่มเกษียณอื่นที่กรอกไว้ รวมกันเกิน 500,000 บาท ระบบตัดสิทธิ์ส่วนเกินให้ RMF ก่อน แล้วเหลือเท่าไรถึงให้ SSF',
      lgGroupSummary: 'รวมซื้อ {amt} · {units} หน่วย · ต้นทุนเฉลี่ย {avg}/หน่วย', lgGroupValueNow: ' · มูลค่าตอนนี้ {val} <b style="color:{color}">({sign}{pl}, {sign2}{pct}%)</b>',
      logThDate: 'วันที่', logThFund: 'กองทุน', logThAmt: 'เงิน', logThNav: 'NAV', logThUnits: 'หน่วย',
      alertFundName: 'กรอกชื่อกองทุน', alertLgFields: 'กรอกเงินที่ซื้อ และราคา/หน่วย (NAV) ให้ครบ',
      elReadyLabel: 'พร้อมขายแล้ว', elReadyDate: '1 ม.ค. {year}', elNeedsBirthYear: 'กรอกปีเกิดด้านล่างเพื่อเช็คเงื่อนไขอายุ 55 ปี',
      elEmptyDefault: 'ยังไม่มีรายการซื้อ RMF/SSF/Thai ESG ในสมุดซื้อ — บันทึกก่อนเพื่อดูวันครบกำหนดถือ',
      elSsfNote: 'นับจากไม้แรกสุดที่บันทึกไว้ ({year}) — แต่ละไม้จริงมีเวลานับของตัวเอง นี่คือค่าประมาณแบบระมัดระวัง (ถือ 10 ปีปฏิทิน)',
      elEsgNote: 'ใช้เกณฑ์ถือ {years} ปี ตามปีที่ซื้อไม้แรก ({year})',
      elRmfNote: 'ต้องถือ ≥5 ปี (นับจากไม้แรก {year}) และอายุครบ 55 ปี · ระบบยังไม่เช็คว่าเว้นซื้อเกิน 1 ปีติดต่อกันหรือไม่ (เงื่อนไขต่อเนื่อง) ต้องดูเองด้วย',
      catFullRmf: 'RMF', catFullSsf: 'SSF', catFullEsg: 'Thai ESG'
    },
    en: {
      crumbHome: 'Investing', crumbHere: 'Thai Fund',
      pageTitle: 'Thai Mutual Funds — DCA + Tax Savings Planner',
      dcaTitle: 'Dollar-Cost Averaging Plan (DCA)', accMLabel: 'Buy "Accumulation" /month', divMLabel: 'Buy "Dividend" /month',
      yearsLabel: 'Plan ahead', unitYears: '(years)', cagrLabel: 'Average return/year', unitPct: '(%)',
      feeLabel: 'Fund fee/year', dyLabel: 'Dividend class yield/year', calcPlanBtn: 'Calculate Plan',
      oContribLabel: 'Total contributed', oValueLabel: 'Estimated total value', oGainLabel: 'Growth gain', oGainSub: 'Not yet including tax/purchase fees',
      accColTitle: 'Accumulation class', divColTitle: 'Dividend class',
      lineInvested: 'Total invested', lineFinalValue: 'Final value', lineDivReceived: 'Dividends received', lineDivReceivedNote: '— (reinvested in fund)', lineDivCumulative: 'Cumulative dividends received',
      chartValue: 'Total value', chartCost: 'Money contributed (cost)', viewYearTableSummary: 'View year-by-year table',
      taxTitle: 'Calculate Tax Deduction (RMF / SSF / Thai ESG)', txYearLabel: 'Tax year of purchase', txYearUnit: '(affects the Thai ESG cap)',
      txIncomeLabel: 'Net taxable income per year', txIncomeUnit: '(after other deductions)',
      txRmfLabel: 'RMF bought this year', txSsfLabel: 'SSF bought this year', txEsgLabel: 'Thai ESG bought this year', unitBaht: '(baht)',
      txOtherLabel: 'Other retirement deductions already used', txOtherUnit: '(GPF/PVD/annuity insurance, etc., baht)',
      taxCalcBtn: 'Calculate Tax Savings', taxFromLogBtn: "Use this year's purchase log total",
      txBeforeLabel: 'Tax before this fund deduction', txAfterLabel: 'Tax after this fund deduction', txSavedLabel: 'Tax saved',
      viewMultiYearSummary: 'View multi-year plan (continued investing)', txIncomeGrowthLabel: 'Average income growth/year', txProjBtn: 'Calculate Multi-Year Plan',
      txProjNote: 'Assumes buying the same RMF/SSF/ESG amount every year (the Thai ESG cap auto-adjusts if it crosses 2027)',
      riskTitle: 'Fund Risk Level (1–8)', riskHint: 'The risk level is always printed on the first page of every Fund Factsheet — the higher the number, the higher the volatility. It\'s not "worse," it just requires being able to tolerate more volatility',
      riskLabel1: 'Money market', riskLabel2: 'Short-term fixed income', riskLabel3: 'General fixed income', riskLabel4: 'Mixed (equity+debt)',
      riskLabel5: 'Thai/foreign equity', riskLabel6: 'Sector/single-country equity', riskLabel7: 'Gold/commodities', riskLabel8: 'Derivatives/complex alternatives',
      ddTitle: 'Market dip = a chance to add (optional)', idxNowLabel: 'SET index now', idxAthLabel: 'All-time high (ATH)', ddBtn: 'Get recommendation',
      tr10m: 'Small dip', tr20m: 'Bear market', tr30m: 'Sharp dip',
      logTitle: 'My Actual Purchase Log', lgFundLabel: 'Fund name', lgCatLabel: 'Category (for tax)',
      catGeneral: 'General', catRmf: 'RMF', catSsf: 'SSF', catEsg: 'Thai ESG',
      lgAmtLabel: 'Amount purchased (baht)', lgNavLabel: 'Price/unit (NAV)', lgAddBtn: '+ Add',
      lgCurLabel: 'Current NAV (to calculate P/L)', lgCurPh: 'Current price per unit',
      lgEmptyDefault: 'No entries yet — log every purchase to know your average cost and profit/loss, broken down by fund',
      elTitle: 'Sell-Without-Losing-Tax-Benefit Date', elBirthYearLabel: 'Birth year', elBirthYearUnit: "(only used to check RMF's age-55 condition)",
      elNote: "This is only an estimate based on the dates recorded in your purchase log, not real data from the fund company — before selling for real, verify the exact due date with the fund company/your real transaction records",
      alertMonthlyAmount: 'Enter a monthly purchase amount for at least one class',
      oContribSub: '{amt} baht/month × {months} months', oValueSub: 'in {years} more years (assuming {cagr}%/year)',
      yrTableColYear: 'End of year', yrTableColContrib: 'Contributed', yrTableColValue: 'Total value', yrTableColGain: 'Gain', yrRowLabel: 'Year {n}',
      ddNearAth: 'The price is currently near its all-time high (dip {dd}%) — a normal DCA of {base}/month is enough, no need to add extra',
      ddNormal: 'Down <b>{dd}%</b> from the all-time high — still considered normal, DCA as planned at {base}/month',
      ddTierMsg: 'Down <b>{dd}%</b> from the all-time high — per the rule you set, consider increasing this month\'s purchase to <b>×{mult}</b> ≈ <b>{amt}</b> (if you have reserve funds)',
      ddWarn: "Warning: a dip doesn't mean it won't fall further — only add what you have in reserve funds, without affecting your daily life",
      alertIncomeRequiredProj: 'Enter a valid net taxable income per year first', alertIncomeRequired: 'Enter a valid net taxable income per year',
      txProjThYear: 'Year', txProjThIncome: 'Assumed income', txProjThSaved: 'Tax saved that year', txProjThCum: 'Cumulative',
      txSavedSubWithDeduction: 'Using {ded} total deduction · saving an average of {pct}% of the amount contributed', txSavedSubNone: "You haven't entered an RMF/SSF/ESG purchase amount yet",
      txDetailEsgRule: 'Thai ESG rule for {year}', txDetailEsgRuleVal: 'Deductible up to {cap} · hold {years} years',
      txDetailRmfLabel: 'RMF — eligible amount', txDetailSsfLabel: 'SSF — eligible amount', txDetailEsgLabel: 'Thai ESG — eligible amount', txDetailValOfWant: '{used} / of {want} entered',
      txCapNoteRmf: 'RMF exceeds the allowance (either the individual {cap} cap, or hit the combined retirement-group cap) — the excess is not deductible',
      txCapNoteSsf: 'SSF exceeds the allowance (either the individual {cap} cap, or hit the combined retirement-group cap) — the excess is not deductible',
      txCapNoteEsg: 'Thai ESG exceeds the {cap} cap (30% of income, capped at 300,000 baht, separate from RMF/SSF) — the excess is not deductible',
      txCapNoteCombined: 'RMF+SSF+other retirement deductions entered together exceed 500,000 baht — the system allocates the excess cut to RMF first, then whatever remains goes to SSF',
      lgGroupSummary: 'Total bought {amt} · {units} units · average cost {avg}/unit', lgGroupValueNow: ' · current value {val} <b style="color:{color}">({sign}{pl}, {sign2}{pct}%)</b>',
      logThDate: 'Date', logThFund: 'Fund', logThAmt: 'Amount', logThNav: 'NAV', logThUnits: 'Units',
      alertFundName: 'Enter the fund name', alertLgFields: 'Please fill in the amount purchased and price/unit (NAV)',
      elReadyLabel: 'Ready to sell', elReadyDate: 'Jan 1, {year}', elNeedsBirthYear: "Enter your birth year below to check the age-55 condition",
      elEmptyDefault: 'No RMF/SSF/Thai ESG purchases in your log yet — log one first to see the holding due date',
      elSsfNote: "Counted from the earliest logged purchase ({year}) — each individual purchase actually has its own count; this is a conservative estimate (10 calendar-year hold)",
      elEsgNote: 'Using the {years}-year hold rule based on the year of the first purchase ({year})',
      elRmfNote: "Must hold ≥5 years (counted from the first purchase in {year}) and reach age 55 · the system does not yet check whether you skipped buying for more than 1 consecutive year (a continuity condition) — you must verify this yourself",
      catFullRmf: 'RMF', catFullSsf: 'SSF', catFullEsg: 'Thai ESG'
    }
  };
  function t(key, vars) {
    var s = (I18N[getUILang()] || I18N.th)[key];
    if (s == null) s = I18N.th[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
  }

  /* ── จำลอง DCA เดือนต่อเดือน (แพทเทิร์นเดียวกับ invest-global-fund.js) ── */
  function simulate(pmt, annualNetPct, months, divYieldPct) {
    var rm = annualNetPct / 100 / 12;
    var dm = (divYieldPct || 0) / 100 / 12;
    var bal = 0, cash = 0, series = [];
    for (var i = 0; i < months; i++) {
      bal = (bal + pmt) * (1 + rm);
      if (dm > 0) { var d = bal * dm; cash += d; }
      series.push({ bal: bal, cash: cash, contrib: pmt * (i + 1) });
    }
    return { balance: bal, cash: cash, series: series };
  }

  function plan(o) {
    var months = Math.round(o.years * 12);
    var netAcc = o.cagr - o.fee;
    var netDivPrice = o.cagr - o.fee - o.dy;
    var acc = simulate(o.accM, netAcc, months, 0);
    var div = simulate(o.divM, netDivPrice, months, o.dy);
    var contribAcc = o.accM * months, contribDiv = o.divM * months;
    return {
      months: months,
      acc: acc, div: div,
      contribAcc: contribAcc, contribDiv: contribDiv,
      contribTotal: contribAcc + contribDiv,
      valueTotal: acc.balance + div.balance,
      divCash: div.cash
    };
  }

  /* ── กราฟ: มูลค่ารวม vs เงินใส่ ─────────────────────────────── */
  function drawChart(p) {
    var s = p.acc.series, W = 640, H = 220, pad = 8, n = s.length;
    var val = [], con = [], i;
    for (i = 0; i < n; i++) { val.push(p.acc.series[i].bal + p.div.series[i].bal); con.push(p.acc.series[i].contrib + p.div.series[i].contrib); }
    var max = Math.max(val[n - 1], con[n - 1]) || 1;
    var x = function (i) { return pad + i / Math.max(1, n - 1) * (W - 2 * pad); };
    var y = function (v) { return pad + (1 - v / max) * (H - 2 * pad); };
    function path(a) { var d = '', i; for (i = 0; i < a.length; i++) d += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(a[i]).toFixed(1) + ' '; return d; }
    var area = path(val) + 'L' + x(n - 1).toFixed(1) + ' ' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';
    var svg = '';
    svg += '<path d="' + area + '" fill="#3B9BEA" opacity="0.10"/>';
    svg += '<path d="' + path(con) + '" fill="none" stroke="#8B94A8" stroke-width="1.6" stroke-dasharray="5 3"/>';
    svg += '<path d="' + path(val) + '" fill="none" stroke="#3B9BEA" stroke-width="2.4" stroke-linejoin="round"/>';
    $('chart').innerHTML = svg;
  }

  function yearTable(p) {
    var html = '<table class="yr-table"><thead><tr><th>' + t('yrTableColYear') + '</th><th>' + t('yrTableColContrib') + '</th><th>' + t('yrTableColValue') + '</th><th>' + t('yrTableColGain') + '</th></tr></thead><tbody>';
    var yrs = Math.round(p.months / 12), i;
    for (i = 1; i <= yrs; i++) {
      var idx = i * 12 - 1;
      if (idx >= p.acc.series.length) break;
      var val = p.acc.series[idx].bal + p.div.series[idx].bal;
      var con = p.acc.series[idx].contrib + p.div.series[idx].contrib;
      html += '<tr><td>' + t('yrRowLabel', { n: i }) + '</td><td>' + baht(con) + '</td><td>' + baht(val) + '</td><td style="color:var(--ok)">' + baht(val - con) + '</td></tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  var lastPlan = { accM: 3000, divM: 3000 };

  function doCalc() {
    var o = {
      accM: num($('accM').value) || 0, divM: num($('divM').value) || 0,
      years: num($('years').value) || 10, cagr: num($('cagr').value),
      fee: num($('fee').value) || 0, dy: num($('dy').value) || 0
    };
    if (!isFinite(o.cagr)) { o.cagr = 6; $('cagr').value = 6; }
    if (o.accM + o.divM <= 0) { alert(t('alertMonthlyAmount')); return; }
    var p = plan(o);
    $('planOut').style.display = 'block';

    $('oContrib').textContent = baht(p.contribTotal);
    $('oContribSub').textContent = t('oContribSub', { amt: fmt0(o.accM + o.divM), months: p.months });
    $('oValue').textContent = baht(p.valueTotal);
    $('oValueSub').textContent = t('oValueSub', { years: fmt0(o.years), cagr: fmt(o.cagr, 1) });
    $('oGain').textContent = baht(p.valueTotal - p.contribTotal);

    $('aC').textContent = baht(p.contribAcc);
    $('aV').textContent = baht(p.acc.balance);
    $('dC').textContent = baht(p.contribDiv);
    $('dV').textContent = baht(p.div.balance);
    $('dCash').textContent = baht(p.divCash);

    drawChart(p);
    $('yrTable').innerHTML = yearTable(p);
    lastPlan = { accM: o.accM, divM: o.divM };
  }

  /* ── เติมไม้ตอนย่อ (ดัชนี SET) ──────────────────────────────── */
  var TR = [{ dd: 10, x: 1.25 }, { dd: 20, x: 1.5 }, { dd: 30, x: 2 }];
  function doDrawdown() {
    var now = num($('idxNow').value), ath = num($('idxAth').value);
    var out = $('ddOut');
    [].forEach.call(document.querySelectorAll('.tr-box'), function (b) { b.classList.remove('on'); });
    if (!isFinite(now) || !isFinite(ath) || ath <= 0) { out.style.display = 'none'; return; }
    var dd = (1 - now / ath) * 100;
    var base = (lastPlan.accM + lastPlan.divM) || 6000;
    var mult = 1, tier = null;
    TR.forEach(function (t) { if (dd >= t.dd) { mult = t.x; tier = t; } });
    if (tier) document.querySelector('.tr-box[data-dd="' + tier.dd + '"]').classList.add('on');
    var msg;
    if (dd < 1) msg = t('ddNearAth', { dd: fmt(Math.max(0, dd), 1), base: baht(base) });
    else if (dd < 10) msg = t('ddNormal', { dd: fmt(dd, 1), base: baht(base) });
    else msg = t('ddTierMsg', { dd: fmt(dd, 1), mult: mult, amt: baht(base * mult) });
    out.innerHTML = msg + '<div style="font-size:12px;color:var(--muted);margin-top:6px">' + t('ddWarn') + '</div>';
    out.style.display = 'block';
  }

  /* ══════════════════════════════════════════════════════════════════
     ภาษี — RMF / SSF / Thai ESG
     ══════════════════════════════════════════════════════════════════ */

  /* อัตราภาษีเงินได้บุคคลธรรมดาแบบขั้นบันได (ตามเกณฑ์ปัจจุบัน)
     คำนวณภาษีจริงตามช่วงขั้น ไม่ใช่คูณอัตราสูงสุดตรงๆ */
  var TAX_BRACKETS = [
    { upTo: 150000, rate: 0 },
    { upTo: 300000, rate: 0.05 },
    { upTo: 500000, rate: 0.10 },
    { upTo: 750000, rate: 0.15 },
    { upTo: 1000000, rate: 0.20 },
    { upTo: 2000000, rate: 0.25 },
    { upTo: 5000000, rate: 0.30 },
    { upTo: Infinity, rate: 0.35 }
  ];

  function thaiTax(income) {
    if (!isFinite(income) || income <= 0) return 0;
    var tax = 0, prev = 0, i;
    for (i = 0; i < TAX_BRACKETS.length; i++) {
      var b = TAX_BRACKETS[i];
      if (income <= prev) break;
      var taxableHere = Math.min(income, b.upTo) - prev;
      tax += taxableHere * b.rate;
      prev = b.upTo;
    }
    return tax;
  }

  /* เพดานลดหย่อน (ตามเกณฑ์ปัจจุบัน):
     RMF   : 30% ของเงินได้ สูงสุด 500,000 (เดี่ยว) — รวมอยู่ในกลุ่มเกษียณรวม ≤500,000
     SSF   : 30% ของเงินได้ สูงสุด 200,000 (เดี่ยว) — รวมอยู่ในกลุ่มเกษียณรวม ≤500,000 เดียวกับ RMF
     กลุ่มเกษียณรวม (RMF+SSF+กบข./PVD/ประกันบำนาญ/กอช. ฯลฯ) ≤ 500,000 รวมกัน
     Thai ESG : เพดาน/ระยะถือ "เปลี่ยนตามปีที่ซื้อ" ตามเกณฑ์ที่ประกาศไว้แล้ว — ไม่ใช่ตัวเลขคงที่
       ซื้อปี 2567-2569: ลดหย่อนได้ 30% สูงสุด 300,000 บาท ถือ 5 ปีปฏิทิน
       ซื้อปี 2570-2575: ลดหย่อนได้ 30% สูงสุด 100,000 บาท ถือ 8 ปีปฏิทิน
       เพดาน Thai ESG แยกต่างหาก ไม่รวมกับกลุ่มเกษียณ */
  var RMF_INDIVIDUAL_CAP = 500000;
  var SSF_INDIVIDUAL_CAP = 200000;
  var RETIRE_COMBINED_CAP = 500000;
  var ESG_RULES = [
    { from: 2024, to: 2026, cap: 300000, holdYears: 5 },
    { from: 2027, to: 2032, cap: 100000, holdYears: 8 }
  ];
  function esgRuleForYear(year) {
    for (var i = 0; i < ESG_RULES.length; i++) { var r = ESG_RULES[i]; if (year >= r.from && year <= r.to) return r; }
    return ESG_RULES[ESG_RULES.length - 1]; /* นอกช่วงที่ทราบ (ก่อน 2567 หรือหลัง 2575) ใช้เกณฑ์ล่าสุดที่ทราบไปก่อน — อาจเปลี่ยนได้จริง */
  }

  function computeTaxSaving(o) {
    var income = Math.max(0, o.income || 0);
    var incomeCap = income * 0.3;
    var year = o.year || new Date().getFullYear();
    var esgRule = esgRuleForYear(year);

    var rmfCap = Math.min(incomeCap, RMF_INDIVIDUAL_CAP);
    var ssfCap = Math.min(incomeCap, SSF_INDIVIDUAL_CAP);
    var esgCap = Math.min(incomeCap, esgRule.cap);

    var rmfWant = Math.max(0, Math.min(o.rmf || 0, rmfCap));
    var ssfWant = Math.max(0, Math.min(o.ssf || 0, ssfCap));
    var otherUsed = Math.max(0, o.otherRetire || 0);

    /* กลุ่มเกษียณรวม: otherUsed กันสิทธิ์ไว้ก่อน (สมมติใช้ไปแล้วจริง) ที่เหลือแบ่งให้ RMF ก่อนแล้วค่อย SSF
       (เป็น convention ของเครื่องมือนี้ — จริงๆ ผู้เสียภาษีเลือกสัดส่วนเองได้ นี่เป็นการประมาณ) */
    var remainingForFund = Math.max(0, RETIRE_COMBINED_CAP - otherUsed);
    var rmfUsed, ssfUsed;
    if (rmfWant + ssfWant <= remainingForFund) {
      rmfUsed = rmfWant; ssfUsed = ssfWant;
    } else {
      rmfUsed = Math.min(rmfWant, remainingForFund);
      ssfUsed = Math.max(0, Math.min(ssfWant, remainingForFund - rmfUsed));
    }

    var esgUsed = Math.max(0, Math.min(o.esg || 0, esgCap));

    var totalDeduction = rmfUsed + ssfUsed + esgUsed;
    var taxBefore = thaiTax(income);
    var taxAfter = thaiTax(Math.max(0, income - totalDeduction));
    var saved = taxBefore - taxAfter;

    return {
      year: year, esgRule: esgRule,
      rmfCap: rmfCap, ssfCap: ssfCap, esgCap: esgCap,
      rmfWant: o.rmf || 0, ssfWant: o.ssf || 0, esgWant: o.esg || 0,
      rmfUsed: rmfUsed, ssfUsed: ssfUsed, esgUsed: esgUsed,
      rmfCapped: rmfUsed < (o.rmf || 0), ssfCapped: ssfUsed < (o.ssf || 0), esgCapped: esgUsed < (o.esg || 0),
      combinedCapHit: (rmfWant + ssfWant + otherUsed) > RETIRE_COMBINED_CAP,
      totalDeduction: totalDeduction,
      taxBefore: taxBefore, taxAfter: taxAfter, saved: saved
    };
  }

  /* ── แผนภาษีหลายปี (ใหม่) ─────────────────────────────────────
     สมมติฐาน: จำนวนเงินซื้อ RMF/SSF/ESG คงที่ทุกปี, เพดาน ESG ขยับตาม esgRuleForYear เมื่อข้ามปี */
  function projectTaxSaving(o, years, growthPct) {
    var rows = [], income = o.income, year = o.year || new Date().getFullYear(), cum = 0, i;
    for (i = 0; i < years; i++) {
      var r = computeTaxSaving({ income: income, rmf: o.rmf, ssf: o.ssf, esg: o.esg, otherRetire: o.otherRetire, year: year });
      cum += r.saved;
      rows.push({ year: year, income: income, saved: r.saved, cum: cum, esgRule: r.esgRule });
      income = income * (1 + (growthPct || 0) / 100);
      year++;
    }
    return rows;
  }

  function doTaxProject() {
    var o = {
      income: num($('txIncome').value),
      rmf: num($('txRmf').value) || 0, ssf: num($('txSsf').value) || 0, esg: num($('txEsg').value) || 0,
      otherRetire: num($('txOther').value) || 0, year: num($('txYear').value) || new Date().getFullYear()
    };
    if (!isFinite(o.income) || o.income <= 0) { alert(t('alertIncomeRequiredProj')); return; }
    var years = Math.max(1, Math.round(num($('txProjYears').value) || 5));
    var growth = num($('txIncomeGrowth').value) || 0;
    var rows = projectTaxSaving(o, years, growth);
    var html = '<table class="yr-table"><thead><tr><th>' + t('txProjThYear') + '</th><th>' + t('txProjThIncome') + '</th><th>' + t('txProjThSaved') + '</th><th>' + t('txProjThCum') + '</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + r.year + '</td><td>' + baht(r.income) + '</td><td>' + baht(r.saved) + '</td><td style="color:var(--ok)">' + baht(r.cum) + '</td></tr>';
    });
    html += '</tbody></table>';
    $('txProjTable').innerHTML = html;
  }

  function doTaxCalc() {
    var o = {
      income: num($('txIncome').value),
      rmf: num($('txRmf').value) || 0,
      ssf: num($('txSsf').value) || 0,
      esg: num($('txEsg').value) || 0,
      otherRetire: num($('txOther').value) || 0,
      year: num($('txYear').value) || new Date().getFullYear()
    };
    if (!isFinite(o.income) || o.income <= 0) { alert(t('alertIncomeRequired')); return; }
    var r = computeTaxSaving(o);

    $('txOut').style.display = 'block';
    $('txBefore').textContent = baht(r.taxBefore);
    $('txAfter').textContent = baht(r.taxAfter);
    $('txSaved').textContent = baht(r.saved);
    $('txSavedSub').textContent = r.totalDeduction > 0
      ? t('txSavedSubWithDeduction', { ded: baht(r.totalDeduction), pct: fmt(r.totalDeduction > 0 ? r.saved / r.totalDeduction * 100 : 0, 1) })
      : t('txSavedSubNone');

    var html = '';
    html += '<div class="tax-line"><span>' + t('txDetailEsgRule', { year: r.year }) + '</span><span class="v">' + t('txDetailEsgRuleVal', { cap: baht(r.esgRule.cap), years: r.esgRule.holdYears }) + '</span></div>';
    html += '<div class="tax-line"><span>' + t('txDetailRmfLabel') + '</span><span class="v">' + t('txDetailValOfWant', { used: baht(r.rmfUsed), want: baht(r.rmfWant) }) + '</span></div>';
    if (r.rmfCapped) html += '<div class="tax-cap-note">' + t('txCapNoteRmf', { cap: baht(r.rmfCap) }) + '</div>';
    html += '<div class="tax-line"><span>' + t('txDetailSsfLabel') + '</span><span class="v">' + t('txDetailValOfWant', { used: baht(r.ssfUsed), want: baht(r.ssfWant) }) + '</span></div>';
    if (r.ssfCapped) html += '<div class="tax-cap-note">' + t('txCapNoteSsf', { cap: baht(r.ssfCap) }) + '</div>';
    html += '<div class="tax-line"><span>' + t('txDetailEsgLabel') + '</span><span class="v">' + t('txDetailValOfWant', { used: baht(r.esgUsed), want: baht(r.esgWant) }) + '</span></div>';
    if (r.esgCapped) html += '<div class="tax-cap-note">' + t('txCapNoteEsg', { cap: baht(r.esgCap) }) + '</div>';
    if (r.combinedCapHit) html += '<div class="tax-cap-note">' + t('txCapNoteCombined') + '</div>';
    $('txDetail').innerHTML = html;
  }

  function taxYearFromLog() {
    var log = loadLog(), yr = new Date().getFullYear();
    var sums = { rmf: 0, ssf: 0, esg: 0 };
    log.forEach(function (r) {
      var d = new Date(r.ts);
      if (d.getFullYear() !== yr) return;
      if (sums[r.cat] != null) sums[r.cat] += r.amt;
    });
    return sums;
  }

  function doTaxFromLog() {
    var sums = taxYearFromLog();
    $('txRmf').value = sums.rmf; $('txSsf').value = sums.ssf; $('txEsg').value = sums.esg;
    doTaxCalc();
  }

  /* ── สเกลความเสี่ยง 1-8 ──────────────────────────────────────── */
  var RISK_LEVELS = [
    { n: 1, key: 'riskLabel1', color: '#17B26A' },
    { n: 2, key: 'riskLabel2', color: '#4CC38A' },
    { n: 3, key: 'riskLabel3', color: '#8FD19E' },
    { n: 4, key: 'riskLabel4', color: '#F5D76E' },
    { n: 5, key: 'riskLabel5', color: '#F5A524' },
    { n: 6, key: 'riskLabel6', color: '#F08A3C' },
    { n: 7, key: 'riskLabel7', color: '#EC5E8A' },
    { n: 8, key: 'riskLabel8', color: '#E5484D' }
  ];
  function renderRiskScale() {
    var el = $('riskScale'); if (!el) return;
    var html = '';
    RISK_LEVELS.forEach(function (r) {
      html += '<div class="risk-seg" style="background:' + r.color + '"><div class="n">' + r.n + '</div><div>' + t(r.key) + '</div></div>';
    });
    el.innerHTML = html;
  }

  /* ── สมุดซื้อจริง (localStorage) — จัดกลุ่มตาม "ชื่อกองทุน" ──── */
  function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
  function saveLog(a) { try { localStorage.setItem(LOG_KEY, JSON.stringify(a)); } catch (e) {} }

  function catLabel(cat) { return cat === 'rmf' ? t('catRmf') : cat === 'ssf' ? t('catSsf') : cat === 'esg' ? t('catEsg') : t('catGeneral'); }

  function renderLog() {
    var log = loadLog(), box = $('lgBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">' + t('lgEmptyDefault') + '</div>'; return; }
    var cur = num($('lgCur').value);
    var groups = {};
    log.forEach(function (r) {
      var g = groups[r.fund] || (groups[r.fund] = { amt: 0, units: 0, cat: r.cat });
      g.amt += r.amt; g.units += r.units;
    });

    var html = '';
    Object.keys(groups).forEach(function (fund) {
      var g = groups[fund], avg = g.units > 0 ? g.amt / g.units : NaN;
      html += '<div class="log-group-hd">' + fund + ' <span style="font-weight:600;color:var(--brand-dk);font-size:11.5px">(' + catLabel(g.cat) + ')</span></div>';
      html += '<div class="log-group-sub">' + t('lgGroupSummary', { amt: baht(g.amt), units: fmt(g.units, 4), avg: fmt(avg, 4) });
      if (isFinite(cur)) {
        var val = g.units * cur, pl = val - g.amt, pct = g.amt > 0 ? pl / g.amt * 100 : 0;
        html += t('lgGroupValueNow', { val: baht(val), color: pl >= 0 ? 'var(--ok)' : 'var(--err)', sign: pl >= 0 ? '+' : '−', pl: baht(Math.abs(pl)), sign2: pct >= 0 ? '+' : '', pct: fmt(pct, 1) });
      }
      html += '</div>';
    });

    html += '<table class="log-table"><thead><tr><th>' + t('logThDate') + '</th><th>' + t('logThFund') + '</th><th>' + t('logThAmt') + '</th><th>' + t('logThNav') + '</th><th>' + t('logThUnits') + '</th><th></th></tr></thead><tbody>';
    log.forEach(function (r, i) {
      html += '<tr><td>' + new Date(r.ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
        '<td>' + r.fund + '</td><td>' + baht(r.amt) + '</td><td>' + fmt(r.nav, 4) + '</td><td>' + fmt(r.units, 4) + '</td>' +
        '<td><button class="log-del" data-i="' + i + '">✕</button></td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.log-del'), function (b) {
      b.addEventListener('click', function () { var log = loadLog(); log.splice(+b.getAttribute('data-i'), 1); saveLog(log); renderLog(); });
    });
  }

  function addLog() {
    var fund = ($('lgFund').value || '').trim(), cat = $('lgCat').value;
    var amt = num($('lgAmt').value), nav = num($('lgNav').value);
    if (!fund) { alert(t('alertFundName')); return; }
    if (!isFinite(amt) || amt <= 0 || !isFinite(nav) || nav <= 0) { alert(t('alertLgFields')); return; }
    var log = loadLog();
    log.push({ fund: fund, cat: cat, amt: amt, nav: nav, units: amt / nav, ts: Date.now() });
    saveLog(log);
    $('lgFund').value = ''; $('lgAmt').value = ''; $('lgNav').value = '';
    renderLog();
    renderFundList();
    renderEligibility();
  }

  /* ── autocomplete ชื่อกองทุนจากประวัติซื้อของผู้ใช้เอง (ไม่ hardcode ชื่อกองทุนจริง กันข้อมูลผิด) ── */
  function fundNamesFromLog() {
    var seen = {}, names = [];
    loadLog().forEach(function (r) { if (!seen[r.fund]) { seen[r.fund] = 1; names.push(r.fund); } });
    return names;
  }
  function renderFundList() {
    var el = $('fundList'); if (!el) return;
    el.innerHTML = fundNamesFromLog().map(function (f) { return '<option value="' + f.replace(/"/g, '&quot;') + '">'; }).join('');
  }

  /* ── วันที่พร้อมขายแบบไม่เสียสิทธิ์ภาษี (ตัวประมาณ) ──────────── */
  var BIRTHYEAR_KEY = 'tanot:invest:thaifund:birthyear';
  function loadBirthYear() { var v = num(localStorage.getItem(BIRTHYEAR_KEY)); return isFinite(v) ? v : null; }
  function saveBirthYear(y) { try { localStorage.setItem(BIRTHYEAR_KEY, String(y)); } catch (e) {} }

  var CAT_FULL_KEY = { rmf: 'catFullRmf', ssf: 'catFullSsf', esg: 'catFullEsg' };

  function eligibilityFor(cat, purchases, birthYear) {
    if (!purchases.length) return null;
    purchases.sort(function (a, b) { return a.ts - b.ts; });
    var firstYear = new Date(purchases[0].ts).getFullYear();
    if (cat === 'ssf') {
      return { readyYear: firstYear + 10, note: t('elSsfNote', { year: firstYear }) };
    }
    if (cat === 'esg') {
      var rule = esgRuleForYear(firstYear);
      return { readyYear: firstYear + rule.holdYears, note: t('elEsgNote', { years: rule.holdYears, year: firstYear }) };
    }
    if (cat === 'rmf') {
      var yearCond = firstYear + 5;
      var ageCond = birthYear ? (birthYear + 55) : null;
      return {
        readyYear: ageCond ? Math.max(yearCond, ageCond) : yearCond,
        needsBirthYear: !ageCond,
        note: t('elRmfNote', { year: firstYear })
      };
    }
    return null;
  }

  function renderEligibility() {
    var box = $('elBox'); if (!box) return;
    var birthYear = loadBirthYear();
    var byBirth = $('elBirthYear'); if (byBirth && !byBirth.value && birthYear) byBirth.value = birthYear;
    var log = loadLog();
    var groups = { rmf: [], ssf: [], esg: [] };
    log.forEach(function (r) { if (groups[r.cat]) groups[r.cat].push(r); });

    var curYear = new Date().getFullYear();
    var boxes = [];
    ['rmf', 'ssf', 'esg'].forEach(function (cat) {
      var el = eligibilityFor(cat, groups[cat], birthYear);
      if (!el) return;
      var ready = curYear >= el.readyYear;
      var html = '<div class="sumbox"><div class="lbl">' + t(CAT_FULL_KEY[cat]) + '</div>';
      html += '<div class="val' + (ready ? ' grow' : '') + '">' + (ready ? t('elReadyLabel') : t('elReadyDate', { year: el.readyYear })) + '</div>';
      if (el.needsBirthYear) html += '<div class="sub" style="color:var(--warn)">' + t('elNeedsBirthYear') + '</div>';
      html += '<div class="sub">' + el.note + '</div></div>';
      boxes.push(html);
    });
    box.innerHTML = boxes.length ? ('<div class="sumrow">' + boxes.join('') + '</div>') : '<div class="log-empty">' + t('elEmptyDefault') + '</div>';
  }

  function init() {
    applyStaticI18n();
    $('calcBtn').addEventListener('click', doCalc);
    $('ddBtn').addEventListener('click', doDrawdown);
    $('lgAdd').addEventListener('click', addLog);
    $('lgCur').addEventListener('input', renderLog);
    $('txBtn').addEventListener('click', doTaxCalc);
    $('txFromLogBtn').addEventListener('click', doTaxFromLog);
    $('txProjBtn').addEventListener('click', doTaxProject);
    $('elBirthYear').addEventListener('input', function () {
      var y = num($('elBirthYear').value);
      if (isFinite(y) && y > 1900) saveBirthYear(y);
      renderEligibility();
    });
    if ($('txYear')) $('txYear').value = new Date().getFullYear();
    renderRiskScale();
    renderLog();
    renderFundList();
    renderEligibility();
    doCalc(); /* แสดงผลตั้งต้นทันที */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.omeApplyLang = function () {
    applyStaticI18n();
    renderRiskScale();
    doCalc();
    renderLog();
    renderEligibility();
    if ($('txOut').style.display !== 'none') doTaxCalc();
    var ddOut = $('ddOut');
    if (ddOut.style.display !== 'none') doDrawdown();
  };

  window.__thaifund = {
    simulate: simulate, plan: plan, thaiTax: thaiTax, computeTaxSaving: computeTaxSaving,
    esgRuleForYear: esgRuleForYear, projectTaxSaving: projectTaxSaving, eligibilityFor: eligibilityFor
  };
})();
