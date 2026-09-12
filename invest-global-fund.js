/* ══════════════════════════════════════════════════════════════════
   Tanot — กองทุนต่างประเทศ (S&P500 ผ่าน SCB) · วางแผน DCA
   • โปรเจกต์มูลค่าอนาคตจาก DCA (จำลองเดือนต่อเดือน)
   • เทียบ สะสมมูลค่า vs ปันผล + ปันผลรับสะสม
   • ไกด์เติมไม้ตอนย่อ (value-averaging แบบมีกฎ)
   • สมุดซื้อจริง (ต้นทุนเฉลี่ย/หน่วย/กำไร-ขาดทุน) เก็บใน localStorage
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LOG_KEY = 'tanot:invest:spfund';

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function baht(n) { return '฿' + fmt0(n); }

  /* ══════ ระบบแปลภาษา (i18n) — รูปแบบเดียวกับหน้าอื่นในโซนลงทุน ══════ */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      crumbHome: 'การลงทุน', crumbHere: 'กองทุนต่างประเทศ (S&P500)',
      pageTitle: 'กองทุน S&P500 — วางแผน DCA', headSub: 'SCB · แบบสะสมมูลค่า + แบบปันผล · ทยอยซื้อทุกเดือน',
      dcaTitle: 'แผนทยอยซื้อ (DCA)', accMLabel: 'ซื้อ "สะสมมูลค่า" /เดือน', divMLabel: 'ซื้อ "ปันผล" /เดือน',
      yearsLabel: 'วางแผนล่วงหน้า', unitYears: '(ปี)', cagrLabel: 'ผลตอบแทนเฉลี่ย/ปี', unitPct: '(%)',
      feeLabel: 'ค่าธรรมเนียมกองทุน/ปี', dyLabel: 'ปันผลของชนิดปันผล/ปี', calcPlanBtn: 'คำนวณแผน',
      oContribLabel: 'เงินที่ลงทั้งหมด', oValueLabel: 'มูลค่ารวมโดยประมาณ', oGainLabel: 'กำไรจากการเติบโต', oGainSub: 'ยังไม่รวมภาษี/ค่าธรรมเนียมซื้อ',
      accColTitle: 'แบบสะสมมูลค่า', divColTitle: 'แบบปันผล',
      lineInvested: 'ลงทั้งหมด', lineFinalValue: 'มูลค่าปลายทาง', lineDivReceived: 'ปันผลรับ', lineDivReceivedNote: '— (ทบในกอง)', lineDivCumulative: 'ปันผลรับสะสม',
      chartValue: 'มูลค่ารวม', chartCost: 'เงินที่ใส่ (ต้นทุน)', viewYearTableSummary: 'ดูตารางรายปี',
      ddTitle: 'ตลาดย่อ = โอกาสเติมไม้ (ทางเลือก)', idxNowLabel: 'ดัชนี S&P500 ตอนนี้', idxAthLabel: 'จุดสูงสุดที่เคยทำ (ATH)', ddBtn: 'ดูคำแนะนำ',
      tr10m: 'ย่อเล็ก', tr20m: 'ตลาดหมี', tr30m: 'ย่อแรง',
      ddHint: 'แนวคิด: เวลาตลาดลง คือได้ของถูกลง ถ้ามีเงินสำรองค่อยเพิ่มเงินซื้อตามระดับที่ตั้งไว้ล่วงหน้า (ไม่ใช่การทำนายว่าจะลงอีกไหม)',
      logTitle: 'สมุดซื้อจริงของฉัน', classField: 'ชนิด', classAcc: 'สะสมมูลค่า', classDiv: 'ปันผล',
      lgAmtLabel: 'เงินที่ซื้อ (บาท)', lgNavLabel: 'ราคา/หน่วย (NAV)', lgAddBtn: '+ เพิ่ม',
      lgCurLabel: 'NAV ปัจจุบัน (คำนวณกำไร/ขาดทุน)', lgCurPh: 'ราคาต่อหน่วยตอนนี้',
      lgEmptyDefault: 'ยังไม่มีรายการ — บันทึกทุกครั้งที่ซื้อ จะได้รู้ต้นทุนเฉลี่ยและกำไร-ขาดทุน',
      lessonSummary: 'เรียนรู้ — กองทุน S&P500 แบบเข้าใจง่าย',
      lsn1h: 'S&P500 คืออะไร', lsn1p: 'กองทุนนี้ลงทุนตามดัชนีหุ้นบริษัทใหญ่ ~500 ตัวของสหรัฐฯ (เช่น Apple, Microsoft) เท่ากับกระจายความเสี่ยงในบริษัทชั้นนำทั้งตลาดในกองเดียว',
      lsn2h: 'สะสมมูลค่า vs ปันผล ต่างกันยังไง',
      lsn2p1: '<b>สะสมมูลค่า</b>: เอาปันผลไปลงทุนต่อในกองอัตโนมัติ (ทบต้น) มูลค่าปลายทางมักสูงกว่า เหมาะกับคนไม่ต้องใช้เงินระหว่างทาง',
      lsn2p2: '<b>ปันผล</b>: จ่ายเงินสดกลับมาให้เป็นงวดๆ ได้กระแสเงินสด แต่มูลค่ากองโตช้ากว่าเพราะเงินถูกจ่ายออก',
      lsn3h: 'DCA (ทยอยซื้อทุกเดือน) ดียังไง',
      lsn3p: 'ซื้อจำนวนเงินเท่าเดิมทุกเดือนไม่ว่าราคาขึ้นหรือลง ทำให้ได้ต้นทุนเฉลี่ย ไม่ต้องเดาจังหวะตลาด เหมาะกับมือใหม่ที่สุด — ที่คุณทำอยู่ (5,000×2/เดือน) คือ DCA แล้ว',
      lsn4h: 'แล้ว "ควรขายเมื่อไร"',
      lsn4p: 'กองแบบนี้ไม่เน้นจับจังหวะขาย ให้ขายเมื่อ (1) ถึงเป้าหมายที่ตั้งไว้ เช่น ครบเงินก้อนที่อยากได้ (2) ต้องใช้เงินจริง (3) ปรับสมดุลพอร์ต — ไม่ใช่ขายเพราะตกใจตอนตลาดลง',
      disc: 'ตัวเลขเป็นการประมาณจากสมมติฐานที่กรอก ผลจริงขึ้นกับตลาดและอาจติดลบได้ · ไม่ใช่คำแนะนำการลงทุน · ข้อมูลเก็บในเครื่องคุณเท่านั้น',
      alertMonthlyAmount: 'ใส่จำนวนเงินซื้อต่อเดือนอย่างน้อยหนึ่งชนิด',
      oContribSub: '{amt} บาท/เดือน × {months} เดือน', oValueSub: 'ในอีก {years} ปี (สมมติ {cagr}%/ปี)',
      yrTableColYear: 'สิ้นปีที่', yrTableColContrib: 'เงินที่ใส่', yrTableColValue: 'มูลค่ารวม', yrTableColGain: 'กำไร', yrRowLabel: 'ปีที่ {n}',
      ddNearAth: 'ตอนนี้ราคาใกล้จุดสูงสุด (ย่อ {dd}%) — DCA ปกติเดือนละ {base} พอ ไม่ต้องเร่งเติม',
      ddNormal: 'ย่อลง <b>{dd}%</b> จากจุดสูงสุด — ยังถือว่าปกติ DCA ตามแผนเดือนละ {base}',
      ddTierMsg: 'ย่อลง <b>{dd}%</b> จากจุดสูงสุด — ตามกฎที่ตั้งไว้ อาจเพิ่มเงินซื้อเดือนนี้เป็น <b>×{mult}</b> ≈ <b>{amt}</b> (ถ้ามีเงินสำรอง)',
      ddWarn: 'เตือน: การย่อไม่ได้แปลว่าจะไม่ลงต่อ — เติมเท่าที่มีเงินสำรองและไม่กระทบชีวิตประจำวัน',
      lgGroupSummary: 'รวมซื้อ {amt} · {units} หน่วย · ต้นทุนเฉลี่ย {avg}/หน่วย', lgGroupValueNow: ' · มูลค่าตอนนี้ {val} <b style="color:{color}">({sign}{pl}, {sign2}{pct}%)</b>',
      logThDate: 'วันที่', logThClass: 'ชนิด', logThAmt: 'เงิน', logThNav: 'NAV', logThUnits: 'หน่วย',
      alertLgFields: 'กรอกเงินที่ซื้อ และราคา/หน่วย (NAV) ให้ครบ'
    },
    en: {
      crumbHome: 'Investing', crumbHere: 'Global Fund (S&P500)',
      pageTitle: 'S&P500 Fund — DCA Planner', headSub: 'SCB · Accumulation + Dividend classes · buying monthly',
      dcaTitle: 'Dollar-Cost Averaging Plan (DCA)', accMLabel: 'Buy "Accumulation" /month', divMLabel: 'Buy "Dividend" /month',
      yearsLabel: 'Plan ahead', unitYears: '(years)', cagrLabel: 'Average return/year', unitPct: '(%)',
      feeLabel: 'Fund fee/year', dyLabel: 'Dividend class yield/year', calcPlanBtn: 'Calculate Plan',
      oContribLabel: 'Total contributed', oValueLabel: 'Estimated total value', oGainLabel: 'Growth gain', oGainSub: 'Not yet including tax/purchase fees',
      accColTitle: 'Accumulation class', divColTitle: 'Dividend class',
      lineInvested: 'Total invested', lineFinalValue: 'Final value', lineDivReceived: 'Dividends received', lineDivReceivedNote: '— (reinvested in fund)', lineDivCumulative: 'Cumulative dividends received',
      chartValue: 'Total value', chartCost: 'Money contributed (cost)', viewYearTableSummary: 'View year-by-year table',
      ddTitle: 'Market dip = a chance to add (optional)', idxNowLabel: 'S&P500 index now', idxAthLabel: 'All-time high (ATH)', ddBtn: 'Get recommendation',
      tr10m: 'Small dip', tr20m: 'Bear market', tr30m: 'Sharp dip',
      ddHint: "Concept: when the market falls, things get cheaper. If you have reserve funds, add to your purchase at levels you set in advance (this is not a prediction of further declines)",
      logTitle: 'My Actual Purchase Log', classField: 'Class', classAcc: 'Accumulation', classDiv: 'Dividend',
      lgAmtLabel: 'Amount purchased (baht)', lgNavLabel: 'Price/unit (NAV)', lgAddBtn: '+ Add',
      lgCurLabel: 'Current NAV (to calculate P/L)', lgCurPh: 'Current price per unit',
      lgEmptyDefault: 'No entries yet — log every purchase to know your average cost and profit/loss',
      lessonSummary: 'Learn — S&P500 funds made simple',
      lsn1h: 'What is the S&P500', lsn1p: 'This fund invests based on the index of ~500 large US companies (e.g. Apple, Microsoft) — spreading risk across the market\'s leading companies in a single fund',
      lsn2h: "What's the difference between Accumulation and Dividend classes",
      lsn2p1: '<b>Accumulation</b>: dividends are automatically reinvested in the fund (compounding); the final value is usually higher, suited to those who don\'t need the money along the way',
      lsn2p2: '<b>Dividend</b>: pays cash back periodically, giving you cash flow, but the fund value grows more slowly since money is paid out',
      lsn3h: 'Why DCA (buying every month) is good',
      lsn3p: "Buy the same amount every month regardless of whether the price is up or down, giving you an average cost without needing to time the market — best suited for beginners. What you're already doing (5,000×2/month) is already DCA",
      lsn4h: 'So "when should I sell"',
      lsn4p: "This type of fund isn't about timing an exit — sell when (1) you reach a target you set, such as a lump sum you wanted (2) you genuinely need the money (3) rebalancing your portfolio — not selling out of panic when the market falls",
      disc: 'These figures are estimates based on the assumptions entered; real results depend on the market and can be negative · not investment advice · data is stored only on your device',
      alertMonthlyAmount: 'Enter a monthly purchase amount for at least one class',
      oContribSub: '{amt} baht/month × {months} months', oValueSub: 'in {years} more years (assuming {cagr}%/year)',
      yrTableColYear: 'End of year', yrTableColContrib: 'Contributed', yrTableColValue: 'Total value', yrTableColGain: 'Gain', yrRowLabel: 'Year {n}',
      ddNearAth: 'The price is currently near its all-time high (dip {dd}%) — a normal DCA of {base}/month is enough, no need to add extra',
      ddNormal: 'Down <b>{dd}%</b> from the all-time high — still considered normal, DCA as planned at {base}/month',
      ddTierMsg: 'Down <b>{dd}%</b> from the all-time high — per the rule you set, consider increasing this month\'s purchase to <b>×{mult}</b> ≈ <b>{amt}</b> (if you have reserve funds)',
      ddWarn: "Warning: a dip doesn't mean it won't fall further — only add what you have in reserve funds, without affecting your daily life",
      lgGroupSummary: 'Total bought {amt} · {units} units · average cost {avg}/unit', lgGroupValueNow: ' · current value {val} <b style="color:{color}">({sign}{pl}, {sign2}{pct}%)</b>',
      logThDate: 'Date', logThClass: 'Class', logThAmt: 'Amount', logThNav: 'NAV', logThUnits: 'Units',
      alertLgFields: 'Please fill in the amount purchased and price/unit (NAV)'
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
  /* คลาสกองทุนเก็บใน localStorage เป็นค่าไทยตายตัว (สะสมมูลค่า/ปันผล) เพื่อไม่ให้ข้อมูลเก่าพัง
     ตอนสลับภาษา — ฟังก์ชันนี้แปลงเป็นข้อความที่แสดงผลตามภาษาปัจจุบันเท่านั้น ไม่แตะค่าที่เก็บจริง */
  function classLabel(cls) { return cls === 'สะสมมูลค่า' ? t('classAcc') : cls === 'ปันผล' ? t('classDiv') : cls; }

  /* ── จำลอง DCA เดือนต่อเดือน ─────────────────────────────────
     annualNetPct = ผลตอบแทนสุทธิต่อปี (%) ; คืนอาเรย์ยอดคงเหลือรายเดือน
     ถ้า divYieldPct > 0 → จ่ายปันผลออก (สะสมใน cash), การเติบโตราคาลดตามปันผล */
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
    var netAcc = o.cagr - o.fee;                 /* สะสมมูลค่า: ทบต้นเต็ม */
    var netDivPrice = o.cagr - o.fee - o.dy;     /* ปันผล: ราคาโตช้าลงเพราะจ่ายปันผลออก */
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
    svg += '<path d="' + area + '" fill="#12A594" opacity="0.10"/>';
    svg += '<path d="' + path(con) + '" fill="none" stroke="#8B94A8" stroke-width="1.6" stroke-dasharray="5 3"/>';
    svg += '<path d="' + path(val) + '" fill="none" stroke="#12A594" stroke-width="2.4" stroke-linejoin="round"/>';
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

  function doCalc() {
    var o = {
      accM: num($('accM').value) || 0, divM: num($('divM').value) || 0,
      years: num($('years').value) || 10, cagr: num($('cagr').value),
      fee: num($('fee').value) || 0, dy: num($('dy').value) || 0
    };
    if (!isFinite(o.cagr)) { o.cagr = 7; $('cagr').value = 7; }
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

  var lastPlan = { accM: 5000, divM: 5000 };

  /* ── เติมไม้ตอนย่อ ──────────────────────────────────────────── */
  var TR = [{ dd: 10, x: 1.25 }, { dd: 20, x: 1.5 }, { dd: 30, x: 2 }];
  function doDrawdown() {
    var now = num($('idxNow').value), ath = num($('idxAth').value);
    var out = $('ddOut');
    [].forEach.call(document.querySelectorAll('.tr-box'), function (b) { b.classList.remove('on'); });
    if (!isFinite(now) || !isFinite(ath) || ath <= 0) { out.style.display = 'none'; return; }
    var dd = (1 - now / ath) * 100;
    var base = (lastPlan.accM + lastPlan.divM) || 10000;
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

  /* ── สมุดซื้อจริง (localStorage) ─────────────────────────────── */
  function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
  function saveLog(a) { try { localStorage.setItem(LOG_KEY, JSON.stringify(a)); } catch (e) {} }

  function renderLog() {
    var log = loadLog(), box = $('lgBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">' + t('lgEmptyDefault') + '</div>'; return; }
    var cur = num($('lgCur').value);
    /* สรุปแยกชนิด */
    var groups = {};
    log.forEach(function (r) { var g = groups[r.cls] || (groups[r.cls] = { amt: 0, units: 0 }); g.amt += r.amt; g.units += r.units; });

    var html = '';
    Object.keys(groups).forEach(function (cls) {
      var g = groups[cls], avg = g.units > 0 ? g.amt / g.units : NaN;
      html += '<div style="font-weight:700;font-size:13px;margin:10px 0 2px">' + classLabel(cls) + '</div>';
      html += '<div style="font-size:12.5px;color:var(--muted)">' + t('lgGroupSummary', { amt: baht(g.amt), units: fmt(g.units, 4), avg: fmt(avg, 4) });
      if (isFinite(cur)) {
        var val = g.units * cur, pl = val - g.amt, pct = g.amt > 0 ? pl / g.amt * 100 : 0;
        html += t('lgGroupValueNow', { val: baht(val), color: pl >= 0 ? 'var(--ok)' : 'var(--err)', sign: pl >= 0 ? '+' : '−', pl: baht(Math.abs(pl)), sign2: pct >= 0 ? '+' : '', pct: fmt(pct, 1) });
      }
      html += '</div>';
    });

    html += '<table class="log-table"><thead><tr><th>' + t('logThDate') + '</th><th>' + t('logThClass') + '</th><th>' + t('logThAmt') + '</th><th>' + t('logThNav') + '</th><th>' + t('logThUnits') + '</th><th></th></tr></thead><tbody>';
    log.forEach(function (r, i) {
      html += '<tr><td>' + new Date(r.ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
        '<td>' + classLabel(r.cls) + '</td><td>' + baht(r.amt) + '</td><td>' + fmt(r.nav, 4) + '</td><td>' + fmt(r.units, 4) + '</td>' +
        '<td><button class="log-del" data-i="' + i + '">✕</button></td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.log-del'), function (b) {
      b.addEventListener('click', function () { var log = loadLog(); log.splice(+b.getAttribute('data-i'), 1); saveLog(log); renderLog(); });
    });
  }

  function addLog() {
    var amt = num($('lgAmt').value), nav = num($('lgNav').value), cls = $('lgClass').value;
    if (!isFinite(amt) || amt <= 0 || !isFinite(nav) || nav <= 0) { alert(t('alertLgFields')); return; }
    var log = loadLog();
    log.push({ cls: cls, amt: amt, nav: nav, units: amt / nav, ts: Date.now() });
    saveLog(log);
    $('lgAmt').value = ''; $('lgNav').value = '';
    renderLog();
  }

  function init() {
    applyStaticI18n();
    $('calcBtn').addEventListener('click', doCalc);
    $('ddBtn').addEventListener('click', doDrawdown);
    $('lgAdd').addEventListener('click', addLog);
    $('lgCur').addEventListener('input', renderLog);
    renderLog();
    doCalc(); /* แสดงผลตั้งต้นทันที */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.omeApplyLang = function () {
    applyStaticI18n();
    doCalc();
    renderLog();
    var out = $('ddOut');
    if (out.style.display !== 'none') doDrawdown();
  };

  window.__spfund = { simulate: simulate, plan: plan };
})();
