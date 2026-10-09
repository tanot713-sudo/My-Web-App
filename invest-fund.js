/* ══════════════════════════════════════════════════════════════════
   Tanot — กองทุน (ยุบรวมหน้าลงทุน ขั้น 8, docs/invest-consolidation-design.md หัวข้อ 2/3)
   แท็บ #th กองทุนไทย (RMF/SSF/ThaiESG) · #global กองทุนต่างประเทศ (S&P500) — ใช้ InvestCore.tabs
   • คีย์ข้อมูลเดิมไม่เปลี่ยนรูปแบบ: tanot:invest:thaifund {fund,cat,amt,nav,units,ts} · spfund {cls,amt,nav,units,ts} · thaifund:birthyear
     เขียนแบบ อ่านสด → แก้ → เขียน ทุกครั้ง · ลบด้วย ts (ไม่ใช้ดัชนี) — tax.js fundSums() อ่าน thaifund ต่อได้เหมือนเดิม
   • NAV ล่าสุด (ช่อง "NAV ปัจจุบัน" เดิมไม่เคยบันทึก) บันทึกลงคีย์ใหม่ tanot:invest:nav (sync map) 'th:<ชื่อกองทุน>' / 'global:<ชนิด>' → มูลค่าสินทรัพย์ใช้
   • การ์ดภาษี: TaxCalc.simulate + tax-rules/<ปี>.json เท่านั้น (ไม่มีเพดาน/ขั้นภาษีฝังในไฟล์นี้) + ปุ่มไป tax.html#sim
   • วันพร้อมขาย: InvestCalc.eligibilityFor/HOLD_RULES
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุนหรือคำแนะนำภาษี
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IC = window.InvestCore, Calc = window.InvestCalc, Tax = window.TaxCalc;
  var $ = function (id) { return document.getElementById(id); };
  var esc = IC.esc, P = 'tanot:invest:';
  var NAV_KEY = P + 'nav', BIRTH_KEY = P + 'thaifund:birthyear';

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function baht(n) { return '฿' + fmt0(n); }

  var L = IC.i18n({
    th: {
      crumbHome: 'การลงทุน', tabTh: 'กองทุนไทย', tabGlobal: 'กองทุนต่างประเทศ',
      pageTitleTh: 'กองทุนรวมไทย — วางแผน DCA + ประหยัดภาษี', pageTitleGl: 'กองทุน S&P500 — วางแผน DCA',
      delTitle: 'ลบ',
      dcaTitle: 'แผนทยอยซื้อ (DCA)', accMLabel: 'ซื้อ "สะสมมูลค่า" /เดือน', divMLabel: 'ซื้อ "ปันผล" /เดือน',
      yearsLabel: 'วางแผนล่วงหน้า', unitYears: '(ปี)', cagrLabel: 'ผลตอบแทนเฉลี่ย/ปี', unitPct: '(%)',
      feeLabel: 'ค่าธรรมเนียมกองทุน/ปี', dyLabel: 'ปันผลของชนิดปันผล/ปี', calcPlanBtn: 'คำนวณแผน',
      oContribLabel: 'เงินที่ลงทั้งหมด', oValueLabel: 'มูลค่ารวมโดยประมาณ', oGainLabel: 'กำไรจากการเติบโต', oGainSub: 'ยังไม่รวมภาษี/ค่าธรรมเนียมซื้อ',
      accColTitle: 'แบบสะสมมูลค่า', divColTitle: 'แบบปันผล',
      lineInvested: 'ลงทั้งหมด', lineFinalValue: 'มูลค่าปลายทาง', lineDivReceived: 'ปันผลรับ', lineDivReceivedNote: '— (ทบในกอง)', lineDivCumulative: 'ปันผลรับสะสม',
      chartValue: 'มูลค่ารวม', chartCost: 'เงินที่ใส่ (ต้นทุน)', viewYearTableSummary: 'ดูตารางรายปี',
      taxTitle: 'คำนวณเงินลดหย่อนภาษี (RMF / SSF / Thai ESG)', txYearLabel: 'ปีภาษี (พ.ศ.)',
      txIncomeLabel: 'เงินได้ต่อปี (เงินเดือน/ค่าจ้างรวมทั้งปี)', txIncomePh: 'เช่น 1000000',
      txRmfLabel: 'ซื้อ RMF ปีนี้', txSsfLabel: 'ซื้อ SSF ปีนี้', txEsgLabel: 'ซื้อ Thai ESG ปีนี้', unitBaht: '(บาท)',
      txOtherLabel: 'ลดหย่อนกลุ่มเกษียณอื่นที่ใช้ไปแล้ว', txOtherUnit: '(กบข./PVD ฯลฯ, บาท)',
      taxCalcBtn: 'คำนวณภาษีที่ประหยัดได้', taxFromLogBtn: 'ใช้ยอดจากสมุดซื้อปีนี้', taxSimBtn: 'ไปหน้าภาษี (ถ้าซื้อเพิ่ม)',
      txBeforeLabel: 'ภาษีก่อนซื้อกองทุนนี้', txAfterLabel: 'ภาษีหลังซื้อกองทุนนี้', txSavedLabel: 'ประหยัดภาษีได้',
      viewMultiYearSummary: 'ดูแผนหลายปี (ลงทุนต่อเนื่อง)', txIncomeGrowthLabel: 'เงินได้เติบโตเฉลี่ย/ปี', txProjBtn: 'คำนวณแผนหลายปี',
      riskTitle: 'ระดับความเสี่ยงกองทุน (1–8)',
      riskLabel1: 'ตลาดเงิน', riskLabel2: 'ตราสารหนี้ระยะสั้น', riskLabel3: 'ตราสารหนี้ทั่วไป', riskLabel4: 'ผสม (หุ้น+หนี้)',
      riskLabel5: 'หุ้นไทย/ต่างประเทศ', riskLabel6: 'หุ้นเฉพาะกลุ่ม/ประเทศเดียว', riskLabel7: 'ทองคำ/สินค้าโภคภัณฑ์', riskLabel8: 'อนุพันธ์/ทางเลือกซับซ้อน',
      ddTitle: 'ตลาดย่อ = โอกาสเติมไม้ (ทางเลือก)', idxNowLabelTh: 'ดัชนี SET ตอนนี้', idxNowLabelGl: 'ดัชนี S&P500 ตอนนี้', idxAthLabel: 'จุดสูงสุดที่เคยทำ (ATH)', ddBtn: 'ดูคำแนะนำ',
      tr10m: 'ย่อเล็ก', tr20m: 'ตลาดหมี', tr30m: 'ย่อแรง',
      logTitle: 'สมุดซื้อจริงของฉัน', lgFundLabel: 'ชื่อกองทุน', lgCatLabel: 'ประเภท (เพื่อภาษี)', classField: 'ชนิด', classAcc: 'สะสมมูลค่า', classDiv: 'ปันผล',
      catGeneral: 'ทั่วไป', catRmf: 'RMF', catSsf: 'SSF', catEsg: 'Thai ESG',
      lgAmtLabel: 'เงินที่ซื้อ (บาท)', lgNavLabel: 'ราคา/หน่วย (NAV)', lgAddBtn: 'เพิ่ม',
      navNowLabel: 'NAV ปัจจุบัน', navNowPh: 'ราคา/หน่วย',
      lgEmptyDefault: 'ยังไม่มีรายการ',
      elTitle: 'วันที่พร้อมขายแบบไม่เสียสิทธิ์ภาษี', elBirthYearLabel: 'ปีเกิด', elBirthYearUnit: '(ค.ศ. — เช็คเงื่อนไขอายุ 55 ปีของ RMF เท่านั้น)',
      alertMonthlyAmount: 'ใส่จำนวนเงินซื้อต่อเดือนอย่างน้อยหนึ่งชนิด',
      oContribSub: '{amt} บาท/เดือน × {months} เดือน', oValueSub: 'ในอีก {years} ปี (สมมติ {cagr}%/ปี)',
      yrTableColYear: 'สิ้นปีที่', yrTableColContrib: 'เงินที่ใส่', yrTableColValue: 'มูลค่ารวม', yrTableColGain: 'กำไร', yrRowLabel: 'ปีที่ {n}',
      ddNearAth: 'ตอนนี้ราคาใกล้จุดสูงสุด (ย่อ {dd}%) — DCA ปกติเดือนละ {base} พอ ไม่ต้องเร่งเติม',
      ddNormal: 'ย่อลง <b>{dd}%</b> จากจุดสูงสุด — ยังถือว่าปกติ DCA ตามแผนเดือนละ {base}',
      ddTierMsg: 'ย่อลง <b>{dd}%</b> จากจุดสูงสุด — ตามกฎที่ตั้งไว้ อาจเพิ่มเงินซื้อเดือนนี้เป็น <b>×{mult}</b> ≈ <b>{amt}</b> (ถ้ามีเงินสำรอง)',
      alertIncomeRequired: 'กรอกเงินได้ต่อปีให้ถูกต้องก่อน', txRulesMissing: 'โหลดกฎภาษีไม่ได้ — ลองเปิดหน้านี้ใหม่',
      txProjThYear: 'ปี', txProjThIncome: 'เงินได้สมมติ', txProjThSaved: 'ประหยัดภาษีปีนั้น', txProjThCum: 'สะสม',
      txSavedSubWithDeduction: 'ใช้สิทธิลดหย่อนเพิ่ม {ded} · ประหยัดเฉลี่ย {pct}% ของเงินที่ใส่', txSavedSubNone: 'ยังไม่ได้ใส่จำนวนซื้อ RMF/SSF/ESG',
      txDetailEsgRule: 'เกณฑ์ Thai ESG ปี {year}', txDetailEsgRuleVal: 'ลดหย่อนได้สูงสุด {cap} · ถือ {years} ปี',
      txDetailRmfLabel: 'RMF — ใช้สิทธิได้', txDetailSsfLabel: 'SSF — ใช้สิทธิได้', txDetailEsgLabel: 'Thai ESG — ใช้สิทธิได้', txDetailValOfWant: '{used} / ที่ใส่ {want}',
      txCapNote: '{name} เกินสิทธิ (เพดาน {cap} หรือโดนเพดานกลุ่มเกษียณรวมกันไป) ส่วนเกินลดหย่อนไม่ได้',
      txCapNoteCombined: 'RMF+SSF+กลุ่มเกษียณอื่นที่กรอกไว้ รวมกันเกินเพดานกลุ่มเกษียณของปีนั้น',
      txNotAvail: 'ปีภาษีนี้ไม่มีสิทธิลดหย่อนรายการนี้',
      lgGroupSummary: 'รวมซื้อ {amt} · {units} หน่วย · ต้นทุนเฉลี่ย {avg}/หน่วย', lgGroupValueNow: ' · มูลค่าตอนนี้ {val} <b style="color:{color}">({sign}{pl}, {sign2}{pct}%)</b>',
      logThDate: 'วันที่', logThFund: 'กองทุน', logThClass: 'ชนิด', logThAmt: 'เงิน', logThNav: 'NAV', logThUnits: 'หน่วย',
      alertFundName: 'กรอกชื่อกองทุน', alertLgFields: 'กรอกเงินที่ซื้อ และราคา/หน่วย (NAV) ให้ครบ',
      elReadyLabel: 'พร้อมขายแล้ว', elReadyDate: '1 ม.ค. {year}', elNeedsBirthYear: 'กรอกปีเกิดด้านล่างเพื่อเช็คเงื่อนไขอายุ 55 ปี',
      elEmptyDefault: 'ยังไม่มีรายการซื้อ RMF/SSF/Thai ESG ในสมุดซื้อ — บันทึกก่อนเพื่อดูวันครบกำหนดถือ',
      elSsfNote: 'นับจากไม้แรกสุดที่บันทึกไว้ ({year}) — แต่ละไม้จริงมีเวลานับของตัวเอง นี่คือค่าประมาณแบบระมัดระวัง (ถือ 10 ปีปฏิทิน)',
      elEsgNote: 'ใช้เกณฑ์ถือ {years} ปี ตามปีที่ซื้อไม้แรก ({year})',
      elRmfNote: 'ต้องถือ ≥5 ปี (นับจากไม้แรก {year}) และอายุครบ 55 ปี · ระบบยังไม่เช็คว่าเว้นซื้อเกิน 1 ปีติดต่อกันหรือไม่ (เงื่อนไขต่อเนื่อง) ต้องดูเองด้วย',
      catFullRmf: 'RMF', catFullSsf: 'SSF', catFullEsg: 'Thai ESG'
    },
    en: {
      crumbHome: 'Investing', tabTh: 'Thai funds', tabGlobal: 'Global funds',
      pageTitleTh: 'Thai Mutual Funds — DCA + Tax Savings Planner', pageTitleGl: 'S&P500 Fund — DCA Planner',
      delTitle: 'Delete',
      dcaTitle: 'Dollar-Cost Averaging Plan (DCA)', accMLabel: 'Buy "Accumulation" /month', divMLabel: 'Buy "Dividend" /month',
      yearsLabel: 'Plan ahead', unitYears: '(years)', cagrLabel: 'Average return/year', unitPct: '(%)',
      feeLabel: 'Fund fee/year', dyLabel: 'Dividend class yield/year', calcPlanBtn: 'Calculate Plan',
      oContribLabel: 'Total contributed', oValueLabel: 'Estimated total value', oGainLabel: 'Growth gain', oGainSub: 'Not yet including tax/purchase fees',
      accColTitle: 'Accumulation class', divColTitle: 'Dividend class',
      lineInvested: 'Total invested', lineFinalValue: 'Final value', lineDivReceived: 'Dividends received', lineDivReceivedNote: '— (reinvested in fund)', lineDivCumulative: 'Cumulative dividends received',
      chartValue: 'Total value', chartCost: 'Money contributed (cost)', viewYearTableSummary: 'View year-by-year table',
      taxTitle: 'Calculate Tax Deduction (RMF / SSF / Thai ESG)', txYearLabel: 'Tax year (B.E.)',
      txIncomeLabel: 'Income per year (salary/wages, full year)', txIncomePh: 'e.g. 1000000',
      txRmfLabel: 'RMF bought this year', txSsfLabel: 'SSF bought this year', txEsgLabel: 'Thai ESG bought this year', unitBaht: '(baht)',
      txOtherLabel: 'Other retirement deductions already used', txOtherUnit: '(GPF/PVD etc., baht)',
      taxCalcBtn: 'Calculate Tax Savings', taxFromLogBtn: "Use this year's purchase log total", taxSimBtn: 'Open tax page (what if I buy more)',
      txBeforeLabel: 'Tax before buying this fund', txAfterLabel: 'Tax after buying this fund', txSavedLabel: 'Tax saved',
      viewMultiYearSummary: 'View multi-year plan (continued investing)', txIncomeGrowthLabel: 'Average income growth/year', txProjBtn: 'Calculate Multi-Year Plan',
      riskTitle: 'Fund Risk Level (1–8)',
      riskLabel1: 'Money market', riskLabel2: 'Short-term fixed income', riskLabel3: 'General fixed income', riskLabel4: 'Mixed (equity+debt)',
      riskLabel5: 'Thai/foreign equity', riskLabel6: 'Sector/single-country equity', riskLabel7: 'Gold/commodities', riskLabel8: 'Derivatives/complex alternatives',
      ddTitle: 'Market dip = a chance to add (optional)', idxNowLabelTh: 'SET index now', idxNowLabelGl: 'S&P500 index now', idxAthLabel: 'All-time high (ATH)', ddBtn: 'Get recommendation',
      tr10m: 'Small dip', tr20m: 'Bear market', tr30m: 'Sharp dip',
      logTitle: 'My Actual Purchase Log', lgFundLabel: 'Fund name', lgCatLabel: 'Category (for tax)', classField: 'Class', classAcc: 'Accumulation', classDiv: 'Dividend',
      catGeneral: 'General', catRmf: 'RMF', catSsf: 'SSF', catEsg: 'Thai ESG',
      lgAmtLabel: 'Amount purchased (baht)', lgNavLabel: 'Price/unit (NAV)', lgAddBtn: 'Add',
      navNowLabel: 'Current NAV', navNowPh: 'Price/unit',
      lgEmptyDefault: 'No entries yet',
      elTitle: 'Sell-Without-Losing-Tax-Benefit Date', elBirthYearLabel: 'Birth year', elBirthYearUnit: "(C.E. — only used to check RMF's age-55 condition)",
      alertMonthlyAmount: 'Enter a monthly purchase amount for at least one class',
      oContribSub: '{amt} baht/month × {months} months', oValueSub: 'in {years} more years (assuming {cagr}%/year)',
      yrTableColYear: 'End of year', yrTableColContrib: 'Contributed', yrTableColValue: 'Total value', yrTableColGain: 'Gain', yrRowLabel: 'Year {n}',
      ddNearAth: 'The price is currently near its all-time high (dip {dd}%) — a normal DCA of {base}/month is enough, no need to add extra',
      ddNormal: 'Down <b>{dd}%</b> from the all-time high — still considered normal, DCA as planned at {base}/month',
      ddTierMsg: 'Down <b>{dd}%</b> from the all-time high — per the rule you set, consider increasing this month\'s purchase to <b>×{mult}</b> ≈ <b>{amt}</b> (if you have reserve funds)',
      alertIncomeRequired: 'Enter a valid income per year first', txRulesMissing: 'Could not load the tax rules — try reopening this page',
      txProjThYear: 'Year', txProjThIncome: 'Assumed income', txProjThSaved: 'Tax saved that year', txProjThCum: 'Cumulative',
      txSavedSubWithDeduction: 'Using {ded} extra deduction · saving an average of {pct}% of the amount contributed', txSavedSubNone: "You haven't entered an RMF/SSF/ESG purchase amount yet",
      txDetailEsgRule: 'Thai ESG rule for {year}', txDetailEsgRuleVal: 'Deductible up to {cap} · hold {years} years',
      txDetailRmfLabel: 'RMF — eligible amount', txDetailSsfLabel: 'SSF — eligible amount', txDetailEsgLabel: 'Thai ESG — eligible amount', txDetailValOfWant: '{used} / of {want} entered',
      txCapNote: '{name} exceeds the allowance (the {cap} cap, or the combined retirement-group cap was hit) — the excess is not deductible',
      txCapNoteCombined: 'RMF+SSF+other retirement deductions entered together exceed the retirement-group cap for that year',
      txNotAvail: 'This deduction is not available in this tax year',
      lgGroupSummary: 'Total bought {amt} · {units} units · average cost {avg}/unit', lgGroupValueNow: ' · current value {val} <b style="color:{color}">({sign}{pl}, {sign2}{pct}%)</b>',
      logThDate: 'Date', logThFund: 'Fund', logThClass: 'Class', logThAmt: 'Amount', logThNav: 'NAV', logThUnits: 'Units',
      alertFundName: 'Enter the fund name', alertLgFields: 'Please fill in the amount purchased and price/unit (NAV)',
      elReadyLabel: 'Ready to sell', elReadyDate: 'Jan 1, {year}', elNeedsBirthYear: 'Enter your birth year below to check the age-55 condition',
      elEmptyDefault: 'No RMF/SSF/Thai ESG purchases in your log yet — log one first to see the holding due date',
      elSsfNote: 'Counted from the earliest logged purchase ({year}) — each individual purchase actually has its own count; this is a conservative estimate (10 calendar-year hold)',
      elEsgNote: 'Using the {years}-year hold rule based on the year of the first purchase ({year})',
      elRmfNote: 'Must hold ≥5 years (counted from the first purchase in {year}) and reach age 55 · the system does not yet check whether you skipped buying for more than 1 consecutive year (a continuity condition) — you must verify this yourself',
      catFullRmf: 'RMF', catFullSsf: 'SSF', catFullEsg: 'Thai ESG'
    }
  });
  var t = L.t;

  /* ── ตลาด: th = กองทุนไทย (คีย์ thaifund, จัดกลุ่มตามชื่อกองทุน) · global = S&P500 (คีย์ spfund, จัดกลุ่มตามชนิด) ── */
  var MK = {
    th: { key: 'th', p: 'th_', logKey: P + 'thaifund', navPrefix: 'th:', group: 'fund', idxLabel: 'idxNowLabelTh', title: 'pageTitleTh', tab: 'tabTh',
      def: { accM: 3000, divM: 3000, years: 10, cagr: 6, fee: 1.5, dy: 2.5 }, idxPh: '1350', athPh: '1850', base: 6000 },
    global: { key: 'global', p: 'gl_', logKey: P + 'spfund', navPrefix: 'global:', group: 'cls', idxLabel: 'idxNowLabelGl', title: 'pageTitleGl', tab: 'tabGlobal',
      def: { accM: 5000, divM: 5000, years: 10, cagr: 7, fee: 0.6, dy: 1.5 }, idxPh: '5000', athPh: '6000', base: 10000 }
  };
  var pendingLog = {};
  var state = { th: { plan: null, inited: false }, global: { plan: null, inited: false } };
  var curTab = 'th', tabsCtl = null, taxCtx = { years: [], rules: {}, loading: null };

  /* ── อ่าน/เขียน localStorage แบบสด ไม่ถืออาร์เรย์ค้าง ── */
  function loadLog(m) { var a = IC.lsJson(m.logKey); return Array.isArray(a) ? a : []; }
  function editLog(m, fn) { var a = loadLog(m); fn(a); IC.lsSet(m.logKey, a); }
  function uniqueTs(a) { var ts = Date.now(); while (a.some(function (r) { return r && r.ts === ts; })) ts++; return ts; }
  function navMap() { var o = IC.lsJson(NAV_KEY); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
  function getNav(m, name) { var e = navMap()[m.navPrefix + name]; return e && isFinite(e.nav) && e.nav > 0 ? +e.nav : NaN; }
  function setNav(m, name, v) {
    var o = navMap(), k = m.navPrefix + name;
    if (isFinite(v) && v > 0) { var now = Date.now(); o[k] = { nav: v, d: Calc.thaiDate(now), ts: now }; } else delete o[k];
    IC.lsSet(NAV_KEY, o);
  }
  function classLabel(cls) { return cls === 'สะสมมูลค่า' ? t('classAcc') : cls === 'ปันผล' ? t('classDiv') : cls; }
  function catLabel(cat) { return cat === 'rmf' ? t('catRmf') : cat === 'ssf' ? t('catSsf') : cat === 'esg' ? t('catEsg') : t('catGeneral'); }

  /* ══════ การ์ด: สร้างด้วย template เดียว ใช้ทั้ง 2 แท็บ ══════ */
  function dcaCard(m) {
    var p = m.p, d = m.def;
    function inp(id, v, step) { return '<input class="input" type="number" id="' + p + id + '" inputmode="' + (step ? 'decimal' : 'numeric') + '"' + (step ? ' step="' + step + '"' : '') + ' value="' + v + '">'; }
    function f(id, k, unit, v, step) { return '<div class="field"><label for="' + p + id + '"><span data-i18n="' + k + '"></span>' + (unit ? ' <span class="unit" data-i18n="' + unit + '"></span>' : '') + '</label>' + inp(id, v, step) + '</div>'; }
    return '<div class="card"><h2 data-i18n="dcaTitle"></h2>' +
      '<div class="frow">' + f('accM', 'accMLabel', '', d.accM) + f('divM', 'divMLabel', '', d.divM) + f('years', 'yearsLabel', 'unitYears', d.years) + '</div>' +
      '<div class="frow">' + f('cagr', 'cagrLabel', 'unitPct', d.cagr, '0.1') + f('fee', 'feeLabel', 'unitPct', d.fee, '0.01') + f('dy', 'dyLabel', 'unitPct', d.dy, '0.1') + '</div>' +
      '<div><button class="btn primary" id="' + p + 'calcBtn" type="button" data-i18n="calcPlanBtn"></button></div>' +
      '<div id="' + p + 'planOut" style="display:none">' +
        '<div class="kpi-grid">' +
          '<div class="kpi"><div class="kpi-label" data-i18n="oContribLabel"></div><div class="kpi-value" id="' + p + 'oContrib">—</div><div class="sub" id="' + p + 'oContribSub"></div></div>' +
          '<div class="kpi"><div class="kpi-label" data-i18n="oValueLabel"></div><div class="kpi-value grow" id="' + p + 'oValue">—</div><div class="sub" id="' + p + 'oValueSub"></div></div>' +
          '<div class="kpi"><div class="kpi-label" data-i18n="oGainLabel"></div><div class="kpi-value" id="' + p + 'oGain">—</div>' + (m.key === 'th' ? '<div class="sub" data-i18n="oGainSub"></div>' : '') + '</div>' +
        '</div>' +
        '<div class="cmp">' +
          '<div class="col acc"><h3 data-i18n="accColTitle"></h3>' +
            '<div class="line"><span data-i18n="lineInvested"></span><span class="v" id="' + p + 'aC">—</span></div>' +
            '<div class="line"><span data-i18n="lineFinalValue"></span><span class="v" id="' + p + 'aV">—</span></div>' +
            '<div class="line"><span data-i18n="lineDivReceived"></span><span class="v" data-i18n="lineDivReceivedNote"></span></div></div>' +
          '<div class="col div"><h3 data-i18n="divColTitle"></h3>' +
            '<div class="line"><span data-i18n="lineInvested"></span><span class="v" id="' + p + 'dC">—</span></div>' +
            '<div class="line"><span data-i18n="lineFinalValue"></span><span class="v" id="' + p + 'dV">—</span></div>' +
            '<div class="line"><span data-i18n="lineDivCumulative"></span><span class="v" id="' + p + 'dCash">—</span></div></div>' +
        '</div>' +
        '<div class="chart-wrap"><svg class="chart" id="' + p + 'chart" viewBox="0 0 640 220" preserveAspectRatio="none"></svg>' +
          '<div class="chart-cap"><span><i class="c1"></i><span data-i18n="chartValue"></span></span><span><i class="mute"></i><span data-i18n="chartCost"></span></span></div></div>' +
        '<details class="disclosure"><summary data-i18n="viewYearTableSummary"></summary><div class="disclosure-body" style="overflow-x:auto"><div id="' + p + 'yrTable"></div></div></details>' +
      '</div></div>';
  }
  function ddCard(m) {
    var p = m.p;
    return '<div class="card"><h2 data-i18n="ddTitle"></h2>' +
      '<div class="frow">' +
        '<div class="field"><label for="' + p + 'idxNow" data-i18n="' + m.idxLabel + '"></label><input class="input" type="number" id="' + p + 'idxNow" inputmode="decimal" step="0.01" placeholder="' + m.idxPh + '"></div>' +
        '<div class="field"><label for="' + p + 'idxAth" data-i18n="idxAthLabel"></label><input class="input" type="number" id="' + p + 'idxAth" inputmode="decimal" step="0.01" placeholder="' + m.athPh + '"></div>' +
        '<button class="btn sm" id="' + p + 'ddBtn" type="button" data-i18n="ddBtn"></button></div>' +
      '<div id="' + p + 'ddOut" style="font-size:13.5px;margin-top:10px;display:none"></div>' +
      '<div class="tranche" id="' + p + 'tranche">' + Calc.DRAWDOWN_TIERS.map(function (x, i) {
        return '<div class="tr-box" data-dd="' + x.dd + '"><div class="d">−' + x.dd + '%</div><div class="m" data-i18n="tr' + x.dd + 'm"></div><div class="x">×' + x.x + '</div></div>';
      }).join('') + '</div></div>';
  }
  function logCard(m) {
    var p = m.p, add;
    if (m.key === 'th') {
      add = '<div class="field" style="flex:1 1 160px"><label for="th_lgFund" data-i18n="lgFundLabel"></label><input class="input" type="text" id="th_lgFund" list="th_fundList" placeholder="SCBRMS50, KFSEQ-A"><datalist id="th_fundList"></datalist></div>' +
        '<div class="field"><label for="th_lgCat" data-i18n="lgCatLabel"></label><select id="th_lgCat"><option value="general" data-i18n="catGeneral"></option><option value="rmf" data-i18n="catRmf"></option><option value="ssf" data-i18n="catSsf"></option><option value="esg" data-i18n="catEsg"></option></select></div>';
    } else {
      add = '<div class="field"><label for="gl_lgClass" data-i18n="classField"></label><select id="gl_lgClass"><option value="สะสมมูลค่า" data-i18n="classAcc"></option><option value="ปันผล" data-i18n="classDiv"></option></select></div>';
    }
    return '<div class="card"><h2 data-i18n="logTitle"></h2><div class="frow">' + add +
      '<div class="field"><label for="' + p + 'lgAmt" data-i18n="lgAmtLabel"></label><input class="input" type="number" id="' + p + 'lgAmt" inputmode="numeric" placeholder="3000"></div>' +
      '<div class="field"><label for="' + p + 'lgNav" data-i18n="lgNavLabel"></label><input class="input" type="number" id="' + p + 'lgNav" inputmode="decimal" step="0.0001" placeholder="12.3456"></div>' +
      '<button class="btn sm" id="' + p + 'lgAdd" type="button"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-plus"/></svg><span data-i18n="lgAddBtn"></span></button></div>' +
      '<div id="' + p + 'lgBox"></div></div>';
  }
  function taxCard() {
    function f(id, k, unit, v, extra) { return '<div class="field"' + (extra || '') + '><label for="' + id + '"><span data-i18n="' + k + '"></span>' + (unit ? ' <span class="unit" data-i18n="' + unit + '"></span>' : '') + '</label><input class="input" type="number" id="' + id + '" inputmode="numeric" value="' + v + '" min="0"></div>'; }
    return '<div class="card"><h2 data-i18n="taxTitle"></h2>' +
      '<div class="frow"><div class="field"><label for="txYear" data-i18n="txYearLabel"></label><select id="txYear"></select></div>' +
        '<div class="field" style="flex:1 1 260px"><label for="txIncome" data-i18n="txIncomeLabel"></label><input class="input" type="number" id="txIncome" inputmode="numeric" min="0" data-i18n-placeholder="txIncomePh"></div></div>' +
      '<div class="frow">' + f('txRmf', 'txRmfLabel', 'unitBaht', 0, ' data-row="rmf"') + f('txSsf', 'txSsfLabel', 'unitBaht', 0, ' data-row="ssf"') + f('txEsg', 'txEsgLabel', 'unitBaht', 0, ' data-row="thaiEsg"') + '</div>' +
      '<div class="frow">' + f('txOther', 'txOtherLabel', 'txOtherUnit', 0, ' style="flex:1 1 260px"') + '</div>' +
      '<div class="actions"><button class="btn primary" id="txBtn" type="button" data-i18n="taxCalcBtn"></button>' +
        '<button class="btn sm" id="txFromLogBtn" type="button" data-i18n="taxFromLogBtn"></button>' +
        '<a class="btn sm ghost" id="txSimLink" href="tax.html#sim" data-i18n="taxSimBtn"></a></div>' +
      '<div id="txOut" style="display:none">' +
        '<div class="kpi-grid">' +
          '<div class="kpi"><div class="kpi-label" data-i18n="txBeforeLabel"></div><div class="kpi-value" id="txBefore">—</div></div>' +
          '<div class="kpi"><div class="kpi-label" data-i18n="txAfterLabel"></div><div class="kpi-value" id="txAfter">—</div></div>' +
          '<div class="kpi"><div class="kpi-label" data-i18n="txSavedLabel"></div><div class="kpi-value grow" id="txSaved">—</div><div class="sub" id="txSavedSub"></div></div></div>' +
        '<div id="txDetail" style="font-size:13px;margin-top:12px;line-height:1.8"></div>' +
        '<details class="disclosure"><summary data-i18n="viewMultiYearSummary"></summary><div class="disclosure-body">' +
          '<div class="frow"><div class="field"><label for="txProjYears"><span data-i18n="yearsLabel"></span> <span class="unit" data-i18n="unitYears"></span></label><input class="input" type="number" id="txProjYears" inputmode="numeric" value="5"></div>' +
          '<div class="field"><label for="txIncomeGrowth"><span data-i18n="txIncomeGrowthLabel"></span> <span class="unit" data-i18n="unitPct"></span></label><input class="input" type="number" id="txIncomeGrowth" inputmode="decimal" step="0.1" value="0"></div>' +
          '<button class="btn sm" id="txProjBtn" type="button" data-i18n="txProjBtn"></button></div>' +
          '<div id="txProjTable" style="overflow-x:auto;margin-top:6px"></div></div></details>' +
      '</div></div>';
  }
  function riskCard() { return '<div class="card"><h2 data-i18n="riskTitle"></h2><div class="risk-scale" id="riskScale"></div></div>'; }
  function eligCard() {
    return '<div class="card"><h2 data-i18n="elTitle"></h2><div class="frow"><div class="field"><label for="elBirthYear"><span data-i18n="elBirthYearLabel"></span> <span class="unit" data-i18n="elBirthYearUnit"></span></label>' +
      '<input class="input" type="number" id="elBirthYear" inputmode="numeric" placeholder="1995"></div></div><div id="elBox"></div></div>';
  }

  /* ══════ แผน DCA / กราฟ / ตารางรายปี ══════ */
  var chartPlans = {};
  function drawChart(m, pl) {
    chartPlans[m.key] = pl;
    var s = pl.acc.series, W = 640, H = 220, pad = 8, n = s.length, val = [], con = [], i;
    if (!n) return;
    for (i = 0; i < n; i++) { val.push(pl.acc.series[i].bal + pl.div.series[i].bal); con.push(pl.acc.series[i].contrib + pl.div.series[i].contrib); }
    var max = Math.max(val[n - 1], con[n - 1]) || 1;
    var x = function (k) { return pad + k / Math.max(1, n - 1) * (W - 2 * pad); };
    var y = function (v) { return pad + (1 - v / max) * (H - 2 * pad); };
    function path(a) { var d = '', k; for (k = 0; k < a.length; k++) d += (k ? 'L' : 'M') + x(k).toFixed(1) + ' ' + y(a[k]).toFixed(1) + ' '; return d; }
    var area = path(val) + 'L' + x(n - 1).toFixed(1) + ' ' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';
    var C = window.OmeChartTheme.get(), svg = '';
    svg += '<path d="' + area + '" fill="' + C.series[0] + '" opacity="0.10"/>';
    svg += '<path d="' + path(con) + '" fill="none" stroke="' + C.axis + '" stroke-width="1.6" stroke-dasharray="5 3"/>';
    svg += '<path d="' + path(val) + '" fill="none" stroke="' + C.series[0] + '" stroke-width="2.4" stroke-linejoin="round"/>';
    $(m.p + 'chart').innerHTML = svg;
  }
  function yearTable(pl) {
    var html = '<div class="table-wrap"><table class="table right"><thead><tr><th>' + esc(t('yrTableColYear')) + '</th><th>' + esc(t('yrTableColContrib')) + '</th><th>' + esc(t('yrTableColValue')) + '</th><th>' + esc(t('yrTableColGain')) + '</th></tr></thead><tbody>';
    var yrs = Math.round(pl.months / 12), i;
    for (i = 1; i <= yrs; i++) {
      var idx = i * 12 - 1;
      if (idx >= pl.acc.series.length) break;
      var val = pl.acc.series[idx].bal + pl.div.series[idx].bal, con = pl.acc.series[idx].contrib + pl.div.series[idx].contrib;
      html += '<tr><td>' + esc(t('yrRowLabel', { n: i })) + '</td><td>' + baht(con) + '</td><td>' + baht(val) + '</td><td style="color:var(--ome-ok-ink)">' + baht(val - con) + '</td></tr>';
    }
    return html + '</tbody></table></div>';
  }
  function doCalc(m, silent) {
    var p = m.p, g = function (id) { return $(p + id); };
    var o = { accM: num(g('accM').value) || 0, divM: num(g('divM').value) || 0, years: num(g('years').value) || 10, cagr: num(g('cagr').value), fee: num(g('fee').value) || 0, dy: num(g('dy').value) || 0 };
    if (!isFinite(o.cagr)) { o.cagr = m.def.cagr; g('cagr').value = o.cagr; }
    if (o.accM + o.divM <= 0) { if (!silent) alert(t('alertMonthlyAmount')); return; }
    var pl = Calc.fundPlan(o);
    g('planOut').style.display = 'block';
    g('oContrib').textContent = baht(pl.contribTotal);
    g('oContribSub').textContent = t('oContribSub', { amt: fmt0(o.accM + o.divM), months: pl.months });
    g('oValue').textContent = baht(pl.valueTotal);
    g('oValueSub').textContent = t('oValueSub', { years: fmt0(o.years), cagr: fmt(o.cagr, 1) });
    g('oGain').textContent = baht(pl.valueTotal - pl.contribTotal);
    g('aC').textContent = baht(pl.contribAcc); g('aV').textContent = baht(pl.acc.balance);
    g('dC').textContent = baht(pl.contribDiv); g('dV').textContent = baht(pl.div.balance); g('dCash').textContent = baht(pl.divCash);
    drawChart(m, pl);
    g('yrTable').innerHTML = yearTable(pl);
    state[m.key].plan = { accM: o.accM, divM: o.divM };
  }
  function doDrawdown(m) {
    var p = m.p, out = $(p + 'ddOut');
    [].forEach.call($(p + 'tranche').querySelectorAll('.tr-box'), function (b) { b.classList.remove('on'); });
    var r = Calc.drawdown(num($(p + 'idxNow').value), num($(p + 'idxAth').value));
    if (!r) { out.style.display = 'none'; return; }
    var pl = state[m.key].plan, base = pl ? (pl.accM + pl.divM) || m.base : m.base, msg;
    if (r.tier) $(p + 'tranche').querySelector('.tr-box[data-dd="' + r.tier.dd + '"]').classList.add('on');
    if (r.zone === 'nearAth') msg = t('ddNearAth', { dd: fmt(Math.max(0, r.dd), 1), base: baht(base) });
    else if (r.zone === 'normal') msg = t('ddNormal', { dd: fmt(r.dd, 1), base: baht(base) });
    else msg = t('ddTierMsg', { dd: fmt(r.dd, 1), mult: r.mult, amt: baht(base * r.mult) });
    out.innerHTML = msg; out.style.display = 'block';
  }

  /* ══════ สมุดซื้อจริง + NAV ล่าสุด ══════ */
  function plText(g, cur) {
    if (!isFinite(cur)) return '';
    var val = g.units * cur, pl = val - g.amt, pct = g.amt > 0 ? pl / g.amt * 100 : 0;
    return t('lgGroupValueNow', { val: baht(val), color: pl >= 0 ? 'var(--ome-ok-ink)' : 'var(--ome-err-ink)', sign: pl >= 0 ? '+' : '−', pl: baht(Math.abs(pl)), sign2: pct >= 0 ? '+' : '', pct: fmt(pct, 1) });
  }
  function groupsOf(m, log) {
    var groups = {}, order = [];
    log.forEach(function (r) {
      var name = m.group === 'fund' ? r.fund : r.cls;
      if (!groups[name]) { groups[name] = { name: name, amt: 0, units: 0, cat: r.cat }; order.push(name); }
      groups[name].amt += +r.amt || 0; groups[name].units += +r.units || 0;
    });
    return order.map(function (n) { return groups[n]; });
  }
  function renderLog(m) {
    var box = $(m.p + 'lgBox'), log = loadLog(m);
    if (!log.length) { box.innerHTML = '<div class="log-empty">' + esc(t('lgEmptyDefault')) + '</div>'; return; }
    var html = '';
    groupsOf(m, log).forEach(function (g) {
      var label = m.group === 'fund' ? g.name : classLabel(g.name), avg = g.units > 0 ? g.amt / g.units : NaN, cur = getNav(m, g.name);
      html += '<div class="log-group-hd">' + esc(label) + (m.group === 'fund' ? ' <span class="badge accent">(' + esc(catLabel(g.cat)) + ')</span>' : '') + '</div>';
      html += '<div class="log-group-sub">' + esc(t('lgGroupSummary', { amt: baht(g.amt), units: fmt(g.units, 4), avg: fmt(avg, 4) })) + '<span data-pl="' + esc(g.name) + '">' + plText(g, cur) + '</span></div>';
      html += '<div class="nav-row"><label for="' + m.p + 'nav_' + esc(g.name) + '" class="unit">' + esc(t('navNowLabel')) + '</label>' +
        '<input class="input" type="number" inputmode="decimal" step="0.0001" id="' + m.p + 'nav_' + esc(g.name) + '" data-nav="' + esc(g.name) + '" placeholder="' + esc(t('navNowPh')) + '" value="' + (isFinite(cur) ? cur : '') + '"></div>';
    });
    html += '<div class="table-wrap"><table class="table right"><thead><tr><th>' + esc(t('logThDate')) + '</th><th>' + esc(t(m.group === 'fund' ? 'logThFund' : 'logThClass')) + '</th><th>' + esc(t('logThAmt')) + '</th><th>' + esc(t('logThNav')) + '</th><th>' + esc(t('logThUnits')) + '</th><th></th></tr></thead><tbody>';
    log.forEach(function (r) {
      html += '<tr><td>' + IC.date(new Date(r.ts), { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
        '<td>' + esc(m.group === 'fund' ? r.fund : classLabel(r.cls)) + '</td><td>' + baht(r.amt) + '</td><td>' + fmt(r.nav, 4) + '</td><td>' + fmt(r.units, 4) + '</td>' +
        '<td><button class="btn sm ghost icon log-del" type="button" aria-label="' + esc(t('delTitle')) + '" data-ts="' + esc(r.ts) + '"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-x"/></svg></button></td></tr>';
    });
    box.innerHTML = html + '</tbody></table></div>';
  }
  function bindLog(m) {
    var box = $(m.p + 'lgBox');
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.log-del'); if (!b) return;
      var ts = +b.getAttribute('data-ts');
      editLog(m, function (a) { for (var i = a.length - 1; i >= 0; i--) if (a[i] && a[i].ts === ts) a.splice(i, 1); });
      afterLogChange(m);
    });
    /* NAV ล่าสุด: บันทึกทุกครั้งที่พิมพ์ (fill ของเทสต์ยิงแค่ input) แล้วอัปเดตกำไร/ขาดทุนในที่ ไม่วาดทั้งกล่องใหม่ (ไม่เสียโฟกัส) */
    box.addEventListener('input', function (e) {
      var el = e.target, name = el.getAttribute && el.getAttribute('data-nav'); if (name == null) return;
      setNav(m, name, num(el.value));
      var g = groupsOf(m, loadLog(m)).filter(function (x) { return x.name === name; })[0];
      var sp = box.querySelector('[data-pl="' + (window.CSS && CSS.escape ? CSS.escape(name) : name) + '"]');
      if (g && sp) sp.innerHTML = plText(g, num(el.value));
    });
  }
  function addLog(m) {
    var amt = num($(m.p + 'lgAmt').value), nav = num($(m.p + 'lgNav').value), rec;
    if (m.key === 'th') {
      var fund = ($('th_lgFund').value || '').trim();
      if (!fund) { alert(t('alertFundName')); return; }
      if (!(amt > 0) || !(nav > 0)) { alert(t('alertLgFields')); return; }
      rec = { fund: fund, cat: $('th_lgCat').value, amt: amt, nav: nav, units: amt / nav };
    } else {
      if (!(amt > 0) || !(nav > 0)) { alert(t('alertLgFields')); return; }
      rec = { cls: $('gl_lgClass').value, amt: amt, nav: nav, units: amt / nav };
    }
    editLog(m, function (a) { rec.ts = uniqueTs(a); a.push(rec); });
    if (m.key === 'th') $('th_lgFund').value = '';
    $(m.p + 'lgAmt').value = ''; $(m.p + 'lgNav').value = '';
    afterLogChange(m);
  }
  function afterLogChange(m) {
    renderLog(m);
    if (m.key === 'th') { renderFundList(); renderEligibility(); }
  }
  function renderFundList() {
    var el = $('th_fundList'); if (!el) return;
    var seen = {}, names = [];
    loadLog(MK.th).forEach(function (r) { if (r.fund && !seen[r.fund]) { seen[r.fund] = 1; names.push(r.fund); } });
    el.innerHTML = names.map(function (f) { return '<option value="' + esc(f) + '">'; }).join('');
  }

  /* ══════ วันพร้อมขาย ══════ */
  function loadBirthYear() { var v = num(localStorage.getItem(BIRTH_KEY)); if (!isFinite(v)) return null; return v > 2400 ? v - 543 : v; }
  function renderEligibility() {
    var box = $('elBox'); if (!box) return;
    var birth = loadBirthYear(), by = $('elBirthYear');
    if (by && !by.value) { var raw = num(localStorage.getItem(BIRTH_KEY)); if (isFinite(raw)) by.value = raw; }
    var groups = { rmf: [], ssf: [], esg: [] };
    loadLog(MK.th).forEach(function (r) { if (groups[r.cat]) groups[r.cat].push(r); });
    var cur = new Date().getFullYear(), boxes = [];
    ['rmf', 'ssf', 'esg'].forEach(function (cat) {
      var el = Calc.eligibilityFor(cat, groups[cat], birth); if (!el) return;
      var ready = cur >= el.readyYear;
      var note = el.noteCode === 'ssf' ? t('elSsfNote', { year: el.firstYear }) : el.noteCode === 'esg' ? t('elEsgNote', { years: el.holdYears, year: el.firstYear }) : t('elRmfNote', { year: el.firstYear });
      boxes.push('<div class="kpi"><div class="kpi-label">' + esc(t('catFull' + cat.charAt(0).toUpperCase() + cat.slice(1))) + '</div>' +
        '<div class="kpi-value' + (ready ? ' grow' : '') + '" data-cat="' + cat + '">' + esc(ready ? t('elReadyLabel') : t('elReadyDate', { year: el.readyYear })) + '</div>' +
        (el.needsBirthYear ? '<div class="sub" style="color:var(--ome-warn-ink)">' + esc(t('elNeedsBirthYear')) + '</div>' : '') +
        '<div class="sub">' + esc(note) + '</div></div>');
    });
    box.innerHTML = boxes.length ? '<div class="kpi-grid">' + boxes.join('') + '</div>' : '<div class="log-empty">' + esc(t('elEmptyDefault')) + '</div>';
  }

  /* ══════ ระดับความเสี่ยง ══════ */
  function riskTint(c) { return 'color-mix(in srgb, ' + c + ' 55%, var(--ome-surface-1))'; }
  var RISK_COLORS = [
    'var(--ome-ok)', 'color-mix(in srgb, var(--ome-ok) 65%, var(--ome-warn))', 'color-mix(in srgb, var(--ome-ok) 30%, var(--ome-warn))', 'color-mix(in srgb, var(--ome-warn) 70%, var(--ome-ok))',
    'var(--ome-warn)', 'color-mix(in srgb, var(--ome-warn) 60%, var(--ome-err))', 'color-mix(in srgb, var(--ome-warn) 25%, var(--ome-err))', 'var(--ome-err)'
  ];
  function renderRiskScale() {
    var el = $('riskScale'); if (!el) return;
    el.innerHTML = RISK_COLORS.map(function (c, i) { return '<div class="risk-seg" style="background:' + riskTint(c) + '"><div class="n">' + (i + 1) + '</div><div>' + esc(t('riskLabel' + (i + 1))) + '</div></div>'; }).join('');
  }

  /* ══════ ภาษี — TaxCalc + tax-rules/*.json เท่านั้น ══════ */
  function getJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  function loadRules() {
    if (taxCtx.loading) return taxCtx.loading;
    taxCtx.loading = getJSON('tax-rules/index.json').then(function (idx) {
      var ys = (idx.years || []).slice();
      return Promise.all(ys.map(function (y) { return getJSON('tax-rules/' + y + '.json').then(function (r) { taxCtx.rules[y] = r; return y; }, function () { return null; }); }));
    }).then(function (ys) {
      taxCtx.years = ys.filter(function (y) { return y != null; }).sort(function (a, b) { return a - b; });
      return taxCtx;
    }, function () { taxCtx.years = []; return taxCtx; });
    return taxCtx.loading;
  }
  function selRules() { var y = +$('txYear').value; return { year: y, rules: taxCtx.rules[y] }; }
  function fillYearSelect() {
    var sel = $('txYear'); if (!sel || sel.options.length || !taxCtx.years.length) return;
    sel.innerHTML = taxCtx.years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
    sel.value = String(Tax.defaultTaxYear(new Date(), taxCtx.years));
    syncAvail();
  }
  function syncAvail() {
    var s = selRules(); if (!s.rules) return;
    [].forEach.call(document.querySelectorAll('#panel-th [data-row]'), function (f) { f.style.display = Tax.available(s.rules, f.getAttribute('data-row')) ? '' : 'none'; });
  }
  function taxInputs() {
    var g = function (id) { return num($(id).value) || 0; };
    return { base: { salary: g('txIncome'), gpf: g('txOther') }, extra: { rmf: g('txRmf'), ssf: g('txSsf'), thaiEsg: g('txEsg') } };
  }
  function doTaxCalc() {
    var s = selRules(); if (!s.rules) { alert(t('txRulesMissing')); return; }
    var ti = taxInputs();
    if (!(ti.base.salary > 0)) { alert(t('alertIncomeRequired')); return; }
    var extra = {};
    Object.keys(ti.extra).forEach(function (k) { if (Tax.available(s.rules, k)) extra[k] = ti.extra[k]; });
    var r = Tax.simulate(s.rules, ti.base, extra);
    $('txOut').style.display = 'block';
    $('txBefore').textContent = baht(r.before.tax); $('txAfter').textContent = baht(r.after.tax); $('txSaved').textContent = baht(r.saved);
    var ded = r.after.deductions - r.before.deductions;
    $('txSavedSub').textContent = ded > 0 ? t('txSavedSubWithDeduction', { ded: baht(ded), pct: fmt(r.spend > 0 ? r.saved / r.spend * 100 : 0, 1) }) : t('txSavedSubNone');
    var D = s.rules.deductions, html = '';
    if (D.thaiEsg) html += '<div class="tax-line"><span>' + esc(t('txDetailEsgRule', { year: s.year })) + '</span><span class="v">' + esc(t('txDetailEsgRuleVal', { cap: baht(D.thaiEsg.cap), years: Calc.esgHoldRule(s.year - 543).holdYears })) + '</span></div>';
    [['rmf', 'txDetailRmfLabel', 'RMF'], ['ssf', 'txDetailSsfLabel', 'SSF'], ['thaiEsg', 'txDetailEsgLabel', 'Thai ESG']].forEach(function (x) {
      var k = x[0]; if (!Tax.available(s.rules, k)) return;
      var used = r.after.items[k].ded - r.before.items[k].ded, want = ti.extra[k];
      html += '<div class="tax-line"><span>' + esc(t(x[1])) + '</span><span class="v">' + esc(t('txDetailValOfWant', { used: baht(used), want: baht(want) })) + '</span></div>';
      if (used + 0.5 < want) html += '<div class="tax-cap-note">' + esc(t('txCapNote', { name: x[2], cap: baht(r.after.items[k].cap) })) + '</div>';
    });
    if (r.after.retire.used >= r.after.retire.cap - 0.5 && ti.extra.rmf + ti.extra.ssf + ti.base.gpf > r.after.retire.cap) html += '<div class="tax-cap-note">' + esc(t('txCapNoteCombined')) + '</div>';
    $('txDetail').innerHTML = html;
  }
  function doTaxProject() {
    var s = selRules(); if (!s.rules) return;
    var ti = taxInputs();
    if (!(ti.base.salary > 0)) { alert(t('alertIncomeRequired')); return; }
    /* คิดด้วยกฎปีล่าสุดที่มีทุกปี — ไม่เดาเพดานของปีอนาคต */
    var latest = taxCtx.rules[taxCtx.years[taxCtx.years.length - 1]] || s.rules;
    var years = Math.max(1, Math.round(num($('txProjYears').value) || 5)), growth = num($('txIncomeGrowth').value) || 0;
    var income = ti.base.salary, cum = 0, html = '<div class="table-wrap"><table class="table right"><thead><tr><th>' + esc(t('txProjThYear')) + '</th><th>' + esc(t('txProjThIncome')) + '</th><th>' + esc(t('txProjThSaved')) + '</th><th>' + esc(t('txProjThCum')) + '</th></tr></thead><tbody>';
    for (var i = 0; i < years; i++) {
      var extra = {};
      Object.keys(ti.extra).forEach(function (k) { if (Tax.available(latest, k)) extra[k] = ti.extra[k]; });
      var sv = Tax.simulate(latest, { salary: income, gpf: ti.base.gpf }, extra).saved;
      cum += sv;
      html += '<tr><td>' + (s.year + i) + '</td><td>' + baht(income) + '</td><td>' + baht(sv) + '</td><td style="color:var(--ome-ok-ink)">' + baht(cum) + '</td></tr>';
      income = income * (1 + growth / 100);
    }
    $('txProjTable').innerHTML = html + '</tbody></table></div>';
  }
  function doTaxFromLog() {
    var s = selRules(), ce = (s.year || 0) - 543, sums = { rmf: 0, ssf: 0, esg: 0 };
    loadLog(MK.th).forEach(function (r) { if (new Date(r.ts).getFullYear() === ce && sums[r.cat] != null) sums[r.cat] += +r.amt || 0; });
    $('txRmf').value = sums.rmf; $('txSsf').value = sums.ssf; $('txEsg').value = sums.esg;
    if (num($('txIncome').value) > 0) doTaxCalc();
  }

  /* ══════ แท็บ: สร้างเนื้อหาครั้งแรกที่เปิด (lazy) ══════ */
  function initTab(key) {
    var m = MK[key], st = state[key];
    if (st.inited) return; st.inited = true;
    var panel = $('panel-' + key), p = m.p;
    panel.innerHTML = dcaCard(m) + (key === 'th' ? taxCard() + riskCard() : '') + ddCard(m) + logCard(m) + (key === 'th' ? eligCard() : '');
    L.apply(panel);
    $(p + 'calcBtn').addEventListener('click', function () { doCalc(m); });
    $(p + 'ddBtn').addEventListener('click', function () { doDrawdown(m); });
    $(p + 'lgAdd').addEventListener('click', function () { addLog(m); });
    bindLog(m);
    $(m.p + 'lgBox').addEventListener('focusout', function (e) {
      if (pendingLog[m.key] && e.target.getAttribute && e.target.getAttribute('data-nav') != null) { pendingLog[m.key] = false; setTimeout(function () { renderLog(m); }, 0); }
    });
    renderLog(m);
    doCalc(m, true);
    if (key === 'th') {
      renderRiskScale(); renderFundList(); renderEligibility();
      $('txBtn').addEventListener('click', doTaxCalc);
      $('txFromLogBtn').addEventListener('click', doTaxFromLog);
      $('txProjBtn').addEventListener('click', doTaxProject);
      $('txYear').addEventListener('change', function () { syncAvail(); if ($('txOut').style.display !== 'none') doTaxCalc(); });
      $('elBirthYear').addEventListener('input', function () {
        var y = num($('elBirthYear').value);
        if (isFinite(y) && y > 1900) { try { localStorage.setItem(BIRTH_KEY, String(y)); } catch (e) {} }
        renderEligibility();
      });
      loadRules().then(fillYearSelect);
    }
  }
  function onTab(key) {
    curTab = key;
    ['th', 'global'].forEach(function (k) { $('panel-' + k).hidden = k !== key; });
    initTab(key);
    syncHead();
  }
  function syncHead() {
    var m = MK[curTab];
    $('crumbHere').textContent = t(m.tab);
    $('pageTitle').textContent = t(m.title);
    document.title = t(m.tab) + ' | Tanot';
  }
  function relang() {
    L.apply(); IC.subnav($('ivSubRow'), 'fund'); tabsCtl.rerender(); syncHead();
    ['th', 'global'].forEach(function (k) {
      if (!state[k].inited) return;
      var m = MK[k]; L.apply($('panel-' + k)); renderLog(m); doCalc(m, true);
      if ($(m.p + 'ddOut').style.display !== 'none') doDrawdown(m);
    });
    if (state.th.inited) { renderRiskScale(); renderEligibility(); if ($('txOut').style.display !== 'none') doTaxCalc(); }
  }

  tabsCtl = IC.tabs({ el: $('fundTabs'), page: 'fund', def: 'th', t: t,
    tabs: [{ key: 'th', labelKey: 'tabTh' }, { key: 'global', labelKey: 'tabGlobal' }], onShow: onTab });
  IC.subnav($('ivSubRow'), 'fund');
  L.apply();
  IC.onLang(relang);
  window.OmeChartTheme.onChange(function () {
    ['th', 'global'].forEach(function (k) { var pl = chartPlans[k]; if (pl && state[k].inited && $(MK[k].p + 'planOut').style.display !== 'none') drawChart(MK[k], pl); });
  });
  /* อีกเครื่อง/อีกแท็บแก้สมุดซื้อหรือ NAV → วาดสมุดใหม่ (ไม่ทับช่องกรอกอื่น) · ไม่วาดทับขณะพิมพ์ NAV อยู่ */
  if (window.TanotData && window.TanotData.onChange) window.TanotData.onChange(function () {
    ['th', 'global'].forEach(function (k) {
      if (!state[k].inited) return;
      var a = document.activeElement;
      if (a && a.getAttribute && a.getAttribute('data-nav') != null && $('panel-' + k).contains(a)) { pendingLog[k] = true; return; }
      renderLog(MK[k]);
    });
    if (state.th.inited) { renderFundList(); renderEligibility(); }
  });
})();
