/* ══════════════════════════════════════════════════════════════════
   Tanot — ภาษีเงินได้บุคคลธรรมดา (tax.html) · ส่วนแสดงผล
   ลำดับคำนวณอยู่ใน tax-calc.js (window.TaxCalc) · ตัวเลขกฎแยกปีอยู่ใน tax-rules/<ปี พ.ศ.>.json (+ index.json = รายการปี)

   ข้อมูลที่อ่าน (ผ่าน TanotData.read — ไม่นับว่าหน้านี้ "อ่านแล้ว" จึงไม่เด้งแถบรีโหลดเมื่อข้อมูลมาจากเครื่องอื่น):
     budget:records / budget:categories  → เงินได้ตามหมวด (type 'income', date 'YYYY-MM-DD') จับคู่หมวด → 40(1)/40(2)/40(8) ด้วย tanot:tax:catmap
     tanot:insurance:policies + InsuranceCalc.taxSummary (ถ้ามีหน้าประกัน) หรือ tanot:insurance:taxsummary { v:1, years:{ ค.ศ.: { raw } } }
     tanot:invest:thaifund               → ยอดซื้อ RMF/SSF/ThaiESG ในปี (cat 'rmf'|'ssf'|'esg', amt, ts)
     tanot:receipts:taxsummary           → { v:1, years:{ ค.ศ.: { eReceipt, eReceiptOtop, politic, donationEdu, donation } } } ป้ายลดหย่อนจากคลังใบเสร็จ (เติมเฉพาะช่องที่กฎของปีนั้นไม่ใช่ null)
   ข้อมูลที่เขียน:
     tanot:tax:years  (sync map)  { '<ปี พ.ศ.>': { v: { ช่อง: 'ค่าที่พิมพ์' }, sim: { ช่อง: 'ซื้อเพิ่ม' } } } — ช่องว่าง = ใช้ค่าที่ดึงมา
     tanot:tax:catmap (sync blob) { categoryId: 'salary'|'service'|'other'|'none' }
     tanot:tax:ui     (local)     { year, tab, proj }
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var C = window.TaxCalc, TD = window.TanotData;
  var $ = function (id) { return document.getElementById(id); };
  var YEARS_KEY = 'tanot:tax:years', CATMAP_KEY = 'tanot:tax:catmap', UI_KEY = 'tanot:tax:ui';
  var REC_KEY = 'budget:records', CAT_KEY = 'budget:categories';
  var INS_SUM_KEY = 'tanot:insurance:taxsummary', INS_POL_KEY = 'tanot:insurance:policies', FUND_KEY = 'tanot:invest:thaifund', RCPT_SUM_KEY = 'tanot:receipts:taxsummary';

  function rd(k, d) {
    if (TD && TD.read) return TD.read(k, d);
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; }
  }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  /* ══════ สองภาษา — คีย์กลาง 'ome:lang' + OME_LANG.onChange (i18n.js) · ข้อความของหน้าอยู่ในพจนานุกรมนี้ ══════ */
  function getUILang() { try { return localStorage.getItem('ome:lang') === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      title: 'ภาษีเงินได้บุคคลธรรมดา', tabCalc: 'รายได้และลดหย่อน', tabSim: 'ถ้าซื้อเพิ่ม',
      cardIncome: 'เงินได้', projRecorded: 'ที่บันทึก', projYear: 'ทั้งปี (ประมาณ)', catTitle: 'หมวดรายได้ใน budget',
      cardFamily: 'ส่วนตัวและครอบครัว', cardInsurance: 'ประกัน', cardFunds: 'กองทุนและการออม', cardOther: 'อื่นๆ และเงินบริจาค',
      cardSummary: 'สรุปการคำนวณ', cardRetire: 'กลุ่มเกษียณ', cardBrackets: 'ขั้นภาษี', cardSim: 'ซื้อเพิ่มก่อนสิ้นปี', btnClear: 'ล้าง',
      yearLabel: 'ปีภาษี {y}', yearAria: 'ปีภาษี',
      f_salary: 'เงินเดือน/ค่าจ้าง 40(1)', f_service: 'รับจ้าง/ฟรีแลนซ์ 40(2)', f_other: 'เงินได้อื่น 40(8)', f_withheld: 'ภาษีหัก ณ ที่จ่าย',
      f_spouse: 'คู่สมรสไม่มีเงินได้', f_children: 'บุตร (คน)', f_children2561: 'บุตรคนที่ 2+ เกิดตั้งแต่ 2561 (คน)',
      f_parents: 'บิดามารดาอายุ 60+ (คน)', f_disabled: 'อุปการะผู้พิการ (คน)', f_prenatal: 'ฝากครรภ์/คลอดบุตร', f_socialSecurity: 'ประกันสังคม',
      f_lifeIns: 'เบี้ยประกันชีวิต', f_healthIns: 'เบี้ยประกันสุขภาพ', f_parentsHealth: 'ประกันสุขภาพบิดามารดา', f_spouseLife: 'ประกันชีวิตคู่สมรส',
      f_annuity: 'ประกันชีวิตแบบบำนาญ', f_pvd: 'กองทุนสำรองเลี้ยงชีพ/กองทุนครูเอกชน', f_gpf: 'กบข.', f_nsf: 'กอช.', f_rmf: 'RMF', f_ssf: 'SSF',
      f_thaiEsg: 'ThaiESG', f_thaiEsgxNew: 'ThaiESGX (เงินใหม่)', f_thaiEsgxLtf: 'ThaiESGX (สับเปลี่ยนจาก LTF)',
      f_homeLoan: 'ดอกเบี้ยเงินกู้ซื้อบ้าน', f_homeBuild: 'ค่าสร้างบ้านใหม่', f_eReceipt: 'Easy e-Receipt', f_eReceiptOtop: 'Easy e-Receipt (OTOP/วิสาหกิจชุมชน)',
      f_politic: 'บริจาคพรรคการเมือง', f_donationEdu: 'บริจาคการศึกษา/กีฬา/รพ.รัฐ', f_donation: 'บริจาคทั่วไป',
      optNo: 'ไม่มี', optYes: 'มี', srcBudget: 'budget', srcIns: 'ประกัน', srcFund: 'กองทุน', srcReceipts: 'ใบเสร็จ',
      usedCap: 'หักได้ {v}', usedAnnuity: 'เติมโควตาประกันชีวิต {a} · กลุ่มเกษียณ {b}',
      catSalary: '40(1) เงินเดือน', catService: '40(2) รับจ้าง', catOther: '40(8) อื่นๆ', catNone: 'ไม่นับ', catEmpty: 'ยังไม่มีหมวดรายรับใน budget',
      kTax: 'ภาษีที่ต้องเสีย', kTaxSub: 'เฉลี่ย {e}% · ขั้นสูงสุด {m}%', kPay: 'ชำระเพิ่ม', kRefund: 'ได้คืน', kEven: 'หัก ณ ที่จ่ายพอดี',
      kWithheldSub: 'หัก ณ ที่จ่าย {v}', kNet: 'เงินได้สุทธิ', kNetSub: 'เงินได้พึงประเมิน {v}', kDeadline: 'ยื่นออนไลน์ภายใน',
      kDeadlineLeft: 'อีก {n} วัน · กระดาษ {p}', kDeadlinePast: 'เลยกำหนดแล้ว', kDeadlineToday: 'วันนี้',
      sAssess: 'เงินได้พึงประเมิน', sExp: 'หักค่าใช้จ่าย', g_family: 'ส่วนตัว/ครอบครัว/ประกันสังคม', g_insurance: 'ประกัน',
      g_retire: 'กลุ่มเกษียณ', g_invest: 'ThaiESG/ThaiESGX', g_other: 'อื่นๆ', g_donation: 'เงินบริจาค',
      sNet: 'เงินได้สุทธิ', sProg: 'ภาษีตามขั้น', sMin: 'ภาษีขั้นต่ำ 0.5% ของ 40(2)–40(8)', sTax: 'ภาษีที่ต้องเสีย', sWithheld: 'หัก ณ ที่จ่าย',
      sPay: 'ชำระเพิ่ม', sRefund: 'ได้คืน',
      rUsed: 'ใช้ไป {u} จาก {c}', rLeft: 'เหลือ {v}', rFull: 'เต็มเพดาน', rToRetire: 'บำนาญ',
      thRange: 'เงินได้สุทธิ', thRate: 'อัตรา', thTax: 'ภาษี', over: 'เกิน {v}',
      simUsed: 'หักแล้ว {v}', simRoom: 'ซื้อได้อีก {v}', simRoomNone: 'เต็มสิทธิแล้ว', simUseful: 'ภาษีลดได้ถึงยอด {v}', simGain: 'ภาษีลด {v}', simFill: 'ใช้ยอดนี้',
      simDays: 'เหลือ {n} วันถึงสิ้นปี', simSpend: 'จ่ายเพิ่ม', simSaved: 'ภาษีลดลง', simAfter: 'ภาษีหลังซื้อเพิ่ม', simRatio: 'ได้คืนเป็นภาษี',
      simNet: 'เงินได้สุทธิ', simMarginal: 'อัตราขั้นสูงสุด', simBalance: 'ชำระเพิ่ม/ได้คืน',
      alertMin: 'ใช้ภาษีขั้นต่ำ {v} เพราะสูงกว่าภาษีตามขั้น', alertRules: 'โหลดกฎภาษีไม่ได้'
    },
    en: {
      title: 'Personal Income Tax', tabCalc: 'Income & deductions', tabSim: 'What if I buy more',
      cardIncome: 'Income', projRecorded: 'Recorded', projYear: 'Full year (est.)', catTitle: 'Budget income categories',
      cardFamily: 'Personal & family', cardInsurance: 'Insurance', cardFunds: 'Funds & savings', cardOther: 'Other & donations',
      cardSummary: 'Calculation', cardRetire: 'Retirement group', cardBrackets: 'Tax brackets', cardSim: 'Buy more before year end', btnClear: 'Clear',
      yearLabel: 'Tax year {y}', yearAria: 'Tax year',
      f_salary: 'Salary 40(1)', f_service: 'Service/freelance 40(2)', f_other: 'Other income 40(8)', f_withheld: 'Tax withheld',
      f_spouse: 'Spouse without income', f_children: 'Children', f_children2561: '2nd+ children born 2018+',
      f_parents: 'Parents aged 60+', f_disabled: 'Disabled dependants', f_prenatal: 'Pregnancy/birth', f_socialSecurity: 'Social security',
      f_lifeIns: 'Life insurance', f_healthIns: 'Health insurance', f_parentsHealth: "Parents' health insurance", f_spouseLife: "Spouse's life insurance",
      f_annuity: 'Annuity insurance', f_pvd: 'Provident fund / private teacher fund', f_gpf: 'GPF', f_nsf: 'NSF', f_rmf: 'RMF', f_ssf: 'SSF',
      f_thaiEsg: 'ThaiESG', f_thaiEsgxNew: 'ThaiESGX (new money)', f_thaiEsgxLtf: 'ThaiESGX (switched from LTF)',
      f_homeLoan: 'Mortgage interest', f_homeBuild: 'New house construction', f_eReceipt: 'Easy e-Receipt', f_eReceiptOtop: 'Easy e-Receipt (OTOP/community)',
      f_politic: 'Political party donation', f_donationEdu: 'Education/sports/public hospital donation', f_donation: 'General donation',
      optNo: 'No', optYes: 'Yes', srcBudget: 'budget', srcIns: 'insurance', srcFund: 'funds', srcReceipts: 'receipts',
      usedCap: 'Deductible {v}', usedAnnuity: 'Fills life quota {a} · retirement group {b}',
      catSalary: '40(1) salary', catService: '40(2) service', catOther: '40(8) other', catNone: 'Exclude', catEmpty: 'No income categories in budget yet',
      kTax: 'Tax due', kTaxSub: 'Average {e}% · top bracket {m}%', kPay: 'To pay', kRefund: 'Refund', kEven: 'Withholding matches',
      kWithheldSub: 'Withheld {v}', kNet: 'Net income', kNetSub: 'Assessable income {v}', kDeadline: 'File online by',
      kDeadlineLeft: '{n} days left · paper {p}', kDeadlinePast: 'Deadline passed', kDeadlineToday: 'Today',
      sAssess: 'Assessable income', sExp: 'Expenses', g_family: 'Personal/family/social security', g_insurance: 'Insurance',
      g_retire: 'Retirement group', g_invest: 'ThaiESG/ThaiESGX', g_other: 'Other', g_donation: 'Donations',
      sNet: 'Net income', sProg: 'Progressive tax', sMin: 'Minimum tax 0.5% of 40(2)–40(8)', sTax: 'Tax due', sWithheld: 'Withheld',
      sPay: 'To pay', sRefund: 'Refund',
      rUsed: '{u} used of {c}', rLeft: '{v} left', rFull: 'Cap reached', rToRetire: 'Annuity',
      thRange: 'Net income', thRate: 'Rate', thTax: 'Tax', over: 'Over {v}',
      simUsed: 'Deducted {v}', simRoom: '{v} more allowed', simRoomNone: 'Fully used', simUseful: 'Saves tax up to {v}', simGain: 'Tax −{v}', simFill: 'Use this',
      simDays: '{n} days to year end', simSpend: 'Extra spend', simSaved: 'Tax saved', simAfter: 'Tax after', simRatio: 'Returned as tax',
      simNet: 'Net income', simMarginal: 'Top bracket', simBalance: 'To pay / refund',
      alertMin: 'Minimum tax {v} applies (higher than progressive tax)', alertRules: 'Could not load tax rules'
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
    [].forEach.call(document.querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    [].forEach.call(document.querySelectorAll('[data-i18n-attr]'), function (el) {
      // เฉพาะคีย์ที่อยู่ในพจนานุกรมของหน้านี้ — shell/ส่วนกลางก็ใช้ data-i18n-attr (คีย์ 'shell.…') และจัดการเอง
      el.getAttribute('data-i18n-attr').split(',').forEach(function (pair) { var a = pair.split(':'); if (I18N.th[a[1]] != null) el.setAttribute(a[0], t(a[1])); });
    });
  }

  /* ══════ ตัวช่วยจัดรูป ══════ */
  function locale() { return getUILang() === 'en' ? 'en-US' : 'th-TH'; }
  function fmt(n, d) { return isFinite(n) ? Number(n).toLocaleString(locale(), { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) : '—'; }
  function baht(n) { n = Math.round(n * 100) / 100; return '฿' + fmt(n, n % 1 ? 2 : 0); }
  function pct(r, d) { return fmt(r * 100, d == null ? 0 : d); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function parseYmd(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function fmtDate(d) { return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }); }
  function daysUntil(d) {
    var n = new Date(), today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((d - today) / 86400000);
  }
  function kpi(label, value, cls, sub) {
    return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value' + (cls ? ' ' + cls : '') + '">' + value + '</div>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>';
  }
  function callout(cls, html) { return '<div class="callout ' + cls + '">' + html + '</div>'; }

  /* ══════ ช่องกรอก ══════ */
  var FIELDS = {
    salary: 'money', service: 'money', other: 'money', withheld: 'money',
    spouse: 'bool', children: 'count', children2561: 'count', parents: 'count', disabled: 'count', prenatal: 'money', socialSecurity: 'money',
    lifeIns: 'money', healthIns: 'money', parentsHealth: 'money', spouseLife: 'money', annuity: 'money',
    pvd: 'money', gpf: 'money', nsf: 'money', rmf: 'money', ssf: 'money', thaiEsg: 'money', thaiEsgxNew: 'money', thaiEsgxLtf: 'money',
    homeLoan: 'money', homeBuild: 'money', eReceipt: 'money', eReceiptOtop: 'money', politic: 'money', donationEdu: 'money', donation: 'money'
  };
  var SIM_KEYS = ['rmf', 'thaiEsg', 'annuity', 'lifeIns', 'healthIns', 'parentsHealth', 'nsf', 'donationEdu', 'donation'];
  var CAT_TYPES = ['salary', 'service', 'other', 'none'];
  var CAT_LABEL = { salary: 'catSalary', service: 'catService', other: 'catOther', none: 'catNone' };
  var SRC_LABEL = { budget: 'srcBudget', ins: 'srcIns', fund: 'srcFund', receipts: 'srcReceipts' };

  /* ══════ สถานะ ══════ */
  var years = [], rules = {}, ui = loadUi();
  function loadUi() {
    var u = null;
    try { u = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); } catch (e) {}
    return isObj(u) ? u : {};
  }
  function saveUi() { write(UI_KEY, ui); }
  function R() { return rules[ui.year]; }
  function adYear() { return ui.year - 543; }
  function isCurrentYear() { return adYear() === new Date().getFullYear(); }

  function yearData() {
    var all = rd(YEARS_KEY, {}), d = isObj(all) ? all[ui.year] : null;
    if (!isObj(d)) d = {};
    if (!isObj(d.v)) d.v = {};
    if (!isObj(d.sim)) d.sim = {};
    return d;
  }
  function saveYearData(d) {
    var all = rd(YEARS_KEY, {});
    if (!isObj(all)) all = {};
    all[ui.year] = d;
    write(YEARS_KEY, all);
  }

  /* ══════ ข้อมูลจากหน้าอื่น ══════ */
  function catMap() {
    var m = rd(CATMAP_KEY, {});
    return isObj(m) ? m : {};
  }
  function catType(map, id) { return CAT_TYPES.indexOf(map[id]) >= 0 ? map[id] : id === 'cat-salary' ? 'salary' : 'none'; }

  function budgetIncome() {
    var recs = rd(REC_KEY, []), cats = rd(CAT_KEY, []), map = catMap(), y = String(adYear());
    if (!Array.isArray(recs)) recs = [];
    if (!Array.isArray(cats)) cats = [];
    var out = { salary: 0, service: 0, other: 0, cats: [] }, byCat = {}, lastMonth = 0;
    recs.forEach(function (r) {
      if (!r || r.type !== 'income' || typeof r.date !== 'string' || r.date.slice(0, 4) !== y) return;
      var amt = Number(r.amount) || 0;
      byCat[r.categoryId] = (byCat[r.categoryId] || 0) + amt;
      var tt = catType(map, r.categoryId);
      if (tt === 'none') return;
      out[tt] += amt;
      if (tt === 'salary') lastMonth = Math.max(lastMonth, parseInt(r.date.slice(5, 7), 10) || 0);
    });
    // ทั้งปี (ประมาณ): เงินเดือนเฉลี่ยต่อเดือนถึงเดือนล่าสุดที่บันทึก × 12 — เฉพาะ 40(1) ที่เข้าเป็นประจำ
    if (ui.proj && isCurrentYear() && lastMonth > 0 && lastMonth < 12) out.salary = out.salary / lastMonth * 12;
    var seen = {};
    cats.forEach(function (c) {
      if (!c || c.type !== 'income') return;
      seen[c.id] = 1;
      out.cats.push({ id: c.id, name: c.name, amount: byCat[c.id] || 0, type: catType(map, c.id) });
    });
    Object.keys(byCat).forEach(function (id) {
      if (!seen[id]) out.cats.push({ id: id, name: id, amount: byCat[id], type: catType(map, id) });
    });
    return out;
  }

  var insLoading = false;
  function insuranceRaw() {
    var pol = rd(INS_POL_KEY, null), y = adYear();
    if (Array.isArray(pol) && pol.length) {
      if (window.InsuranceCalc) return window.InsuranceCalc.taxSummary(pol, y).raw;
      // มีกรมธรรม์แต่หน้านี้ยังไม่โหลดตัวคำนวณ — โหลด insurance-calc.js ครั้งเดียวแล้ววาดใหม่ (ระหว่างนี้ใช้สรุปที่หน้าประกันเขียนไว้)
      if (!insLoading) {
        insLoading = true;
        var s = document.createElement('script');
        s.src = 'insurance-calc.js';
        s.onload = function () { refresh(); };
        document.head.appendChild(s);
      }
    }
    var sum = rd(INS_SUM_KEY, null);
    var yr = isObj(sum) && isObj(sum.years) ? sum.years[y] : null;
    return isObj(yr) && isObj(yr.raw) ? yr.raw : null;
  }

  function fundSums() {
    var log = rd(FUND_KEY, []), y = adYear(), out = { rmf: 0, ssf: 0, thaiEsg: 0 };
    if (!Array.isArray(log)) return out;
    log.forEach(function (r) {
      if (!r || !isFinite(r.ts) || new Date(r.ts).getFullYear() !== y) return;
      var amt = Number(r.amt) || 0;
      if (r.cat === 'rmf') out.rmf += amt;
      else if (r.cat === 'ssf') out.ssf += amt;
      else if (r.cat === 'esg') out.thaiEsg += amt;
    });
    return out;
  }

  /* ป้ายลดหย่อนจากคลังใบเสร็จ { ช่อง: ยอด } ของปีนี้ — เฉพาะช่องที่กฎของปีนั้นยังมี (null = มาตรการหมดแล้ว ไม่เติม) */
  var RCPT_FIELDS = ['eReceipt', 'eReceiptOtop', 'politic', 'donationEdu', 'donation'];
  function receiptTags() {
    var sum = rd(RCPT_SUM_KEY, null), yr = isObj(sum) && isObj(sum.years) ? sum.years[adYear()] : null, out = {};
    if (!isObj(yr)) return out;
    RCPT_FIELDS.forEach(function (k) { if (Number(yr[k]) > 0 && C.available(R(), k)) out[k] = Number(yr[k]); });
    return out;
  }

  /** ค่าที่ดึงมา { key: { v, src } } */
  function pulled() {
    var p = {}, b = budgetIncome();
    function set(k, v, src) { if (v > 0) p[k] = { v: Math.round(v * 100) / 100, src: src }; }
    set('salary', b.salary, 'budget'); set('service', b.service, 'budget'); set('other', b.other, 'budget');
    var ins = insuranceRaw();
    if (ins) {
      set('lifeIns', ins.life, 'ins'); set('healthIns', ins.health, 'ins'); set('parentsHealth', ins.parentsHealth, 'ins');
      set('spouseLife', ins.spouseLife, 'ins'); set('annuity', ins.annuity, 'ins');
    }
    var f = fundSums();
    set('rmf', f.rmf, 'fund'); set('ssf', f.ssf, 'fund'); set('thaiEsg', f.thaiEsg, 'fund');
    var rt = receiptTags();
    Object.keys(rt).forEach(function (k) { set(k, rt[k], 'receipts'); });
    p._cats = b.cats;
    return p;
  }

  function typedNum(s) { if (s == null || s === '') return null; var n = Number(s); return isFinite(n) ? n : null; }
  /** ค่าที่ใช้คำนวณ: พิมพ์เอง > ดึงมา > 0 */
  function inputs(d, pl) {
    var o = {};
    Object.keys(FIELDS).forEach(function (k) {
      var v = typedNum(d.v[k]);
      o[k] = v != null ? v : pl[k] ? pl[k].v : 0;
    });
    return o;
  }

  /* ══════ สร้างฟอร์มตามกฎของปี ══════ */
  function buildForm() {
    var rr = R();
    [].forEach.call(document.querySelectorAll('[data-fields]'), function (box) {
      box.innerHTML = box.getAttribute('data-fields').split(',').filter(function (k) { return C.available(rr, k); }).map(function (k) {
        var id = 'tx_' + k, kind = FIELDS[k], ctl;
        if (kind === 'bool') {
          ctl = '<select id="' + id + '" data-key="' + k + '"><option value="0">' + t('optNo') + '</option><option value="1">' + t('optYes') + '</option></select>';
        } else {
          ctl = '<input id="' + id + '" data-key="' + k + '" type="number" min="0" inputmode="' + (kind === 'count' ? 'numeric' : 'decimal') + '" step="' + (kind === 'count' ? '1' : 'any') + '">';
        }
        return '<div class="field"><label for="' + id + '">' + esc(t('f_' + k)) + '<span class="badge accent" data-src="' + k + '" hidden></span></label>' +
          ctl + '<div class="tx-used" data-used="' + k + '"></div></div>';
      }).join('');
    });
  }

  function fillForm(d, pl) {
    var active = document.activeElement;
    [].forEach.call(document.querySelectorAll('#txForm [data-key]'), function (el) {
      var k = el.getAttribute('data-key');
      if (el !== active) el.value = d.v[k] != null ? d.v[k] : FIELDS[k] === 'bool' ? '0' : '';
      if (el.tagName === 'INPUT') el.placeholder = pl[k] ? fmt(pl[k].v, pl[k].v % 1 ? 2 : 0) : '0';
    });
  }

  function renderCats(pl) {
    var cats = pl._cats || [];
    $('txCats').innerHTML = cats.length ? cats.map(function (c) {
      return '<div class="tx-cat"><span>' + esc(c.name) + '</span><span class="amt">' + baht(c.amount) + '</span>' +
        '<select class="select" data-cat="' + esc(c.id) + '" aria-label="' + esc(c.name) + '">' + CAT_TYPES.map(function (tt) {
          return '<option value="' + tt + '"' + (tt === c.type ? ' selected' : '') + '>' + t(CAT_LABEL[tt]) + '</option>';
        }).join('') + '</select></div>';
    }).join('') : '<div class="empty"><p>' + t('catEmpty') + '</p></div>';
  }

  /* ══════ วาดผล ══════ */
  function renderYearSeg() {
    $('txYear').innerHTML = years.map(function (y) {
      return '<button type="button" data-year="' + y + '" aria-pressed="' + (y === ui.year) + '">' + esc(t('yearLabel', { y: y })) + '</button>';
    }).join('');
    var proj = $('txProj');
    proj.hidden = !isCurrentYear();
    [].forEach.call(proj.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-proj') === (ui.proj ? 1 : 0))); });
  }

  function renderFieldNotes(d, pl, res) {
    [].forEach.call(document.querySelectorAll('[data-src]'), function (el) {
      var k = el.getAttribute('data-src'), use = pl[k] && typedNum(d.v[k]) == null;
      el.hidden = !use;
      el.textContent = use ? t(SRC_LABEL[pl[k].src]) : '';
    });
    [].forEach.call(document.querySelectorAll('[data-used]'), function (el) {
      var k = el.getAttribute('data-used'), it = res.items[k], msg = '';
      if (it && FIELDS[k] === 'money' && it.raw > 0) {
        if (k === 'annuity' && it.toLife > 0) msg = t('usedAnnuity', { a: baht(it.toLife), b: baht(it.toRetire) });
        else if (it.ded < it.raw - 0.005) msg = t('usedCap', { v: baht(it.ded) });
      }
      el.textContent = msg;
      el.classList.toggle('info', k === 'annuity' && msg !== '' && !(it.ded < it.raw - 0.005));
    });
  }

  function renderKpi(res) {
    var rr = R(), html = kpi(t('kTax'), baht(res.tax), '', t('kTaxSub', { e: pct(res.effectiveRate, 1), m: pct(res.marginalRate) }));
    if (res.withheld > 0) {
      var b = res.balance;
      html += kpi(b > 0 ? t('kPay') : b < 0 ? t('kRefund') : t('kEven'), baht(Math.abs(b)), b > 0 ? 'dn' : b < 0 ? 'grow' : '', t('kWithheldSub', { v: baht(res.withheld) }));
    }
    html += kpi(t('kNet'), baht(res.net), '', t('kNetSub', { v: baht(res.assessable) }));
    var dl = rr.deadlines && parseYmd(rr.deadlines.online), dp = rr.deadlines && parseYmd(rr.deadlines.paper);
    if (dl) {
      var n = daysUntil(dl);
      html += kpi(t('kDeadline'), fmtDate(dl), n < 0 ? 'dn' : '',
        n < 0 ? t('kDeadlinePast') : n === 0 ? t('kDeadlineToday') : t('kDeadlineLeft', { n: fmt(n), p: dp ? fmtDate(dp) : '—' }));
    }
    $('txKpi').innerHTML = html;
    var alerts = [];
    if (res.minTaxApplied) alerts.push(callout('info', t('alertMin', { v: baht(res.minTax) })));
    $('txAlerts').innerHTML = alerts.join('');
    $('txAlerts').hidden = !alerts.length;
  }

  function kvRow(k, v, cls, kcls) { return '<div class="k' + (kcls ? ' ' + kcls : '') + '">' + k + '</div><div class="v' + (cls ? ' ' + cls : '') + '">' + v + '</div>'; }
  function renderSummary(res) {
    var h = kvRow(t('sAssess'), baht(res.assessable));
    if (res.expenses > 0) h += kvRow(t('sExp'), '−' + baht(res.expenses), '', 'sub');
    C.GROUPS.forEach(function (g) {
      if (res.groups[g.key] > 0) h += kvRow(t('g_' + g.key), '−' + baht(res.groups[g.key]), '', 'sub');
    });
    h += '<div class="sep"></div>' + kvRow(t('sNet'), baht(res.net)) + kvRow(t('sProg'), baht(res.progressiveTax));
    if (res.minTax > 0) h += kvRow(t('sMin'), baht(res.minTax));
    h += kvRow(t('sTax'), baht(res.tax), 'total');
    if (res.withheld > 0) {
      h += kvRow(t('sWithheld'), '−' + baht(res.withheld), '', 'sub');
      h += kvRow(res.balance > 0 ? t('sPay') : t('sRefund'), baht(Math.abs(res.balance)), res.balance > 0 ? 'risk' : '');
    }
    $('txSummary').innerHTML = h;

    var used = res.retire.used, cap = res.retire.cap, full = used >= cap;
    var rows = C.RETIRE_ORDER.map(function (k) {
      var v = k === 'annuity' ? res.items.annuity.toRetire : res.items[k].ded;
      return v > 0 ? kvRow(esc(t('f_' + k)), baht(v)) : '';
    }).join('');
    $('txRetire').innerHTML =
      '<div class="row"><span>' + t('rUsed', { u: baht(used), c: baht(cap) }) + '</span><span class="badge ' + (full ? 'warn' : 'accent') + '">' +
      (full ? t('rFull') : t('rLeft', { v: baht(cap - used) })) + '</span></div>' +
      '<div class="tx-bar' + (full ? ' full' : '') + '"><span style="width:' + Math.min(100, cap ? used / cap * 100 : 0).toFixed(1) + '%"></span></div>' +
      (rows ? '<div class="kv">' + rows + '</div>' : '');

    var pick = -1;
    res.brackets.forEach(function (b, i) { if (res.net > b.from || (i === 0)) pick = i; });
    $('txBrackets').innerHTML = '<thead><tr><th>' + t('thRange') + '</th><th>' + t('thRate') + '</th><th>' + t('thTax') + '</th></tr></thead><tbody>' +
      res.brackets.map(function (b, i) {
        var range = b.upTo == null ? t('over', { v: fmt(b.from) }) : fmt(b.from === 0 ? 0 : b.from + 1) + '–' + fmt(b.upTo);
        return '<tr' + (i === pick ? ' class="pick"' : '') + '><td>' + range + '</td><td>' + pct(b.rate) + '%</td><td>' + (b.tax > 0 ? baht(b.tax) : '—') + '</td></tr>';
      }).join('') + '</tbody>';
  }

  /* ══════ ถ้าซื้อเพิ่ม ══════ */
  function simExtras(d, except) {
    var e = {};
    SIM_KEYS.forEach(function (k) { if (k !== except) { var v = typedNum(d.sim[k]); if (v > 0) e[k] = v; } });
    return e;
  }
  function addTo(inp, extra) {
    var o = {};
    Object.keys(inp).forEach(function (k) { o[k] = inp[k]; });
    Object.keys(extra).forEach(function (k) { o[k] = (Number(o[k]) || 0) + extra[k]; });
    return o;
  }

  function buildSim() {
    var rr = R();
    $('txSim').innerHTML = SIM_KEYS.filter(function (k) { return C.available(rr, k); }).map(function (k) {
      return '<div class="tx-sim-row" data-sim-row="' + k + '"><label class="nm" for="txs_' + k + '">' + esc(t('f_' + k)) + '</label>' +
        '<input class="input" id="txs_' + k + '" data-sim="' + k + '" type="number" min="0" step="any" inputmode="decimal" placeholder="0">' +
        '<button class="btn sm" type="button" data-fill="' + k + '">' + t('simFill') + '</button>' +
        '<div class="meta"></div></div>';
    }).join('');
  }

  function renderSim(d, inp, res) {
    var rr = R(), active = document.activeElement;
    var all = simExtras(d);
    [].forEach.call(document.querySelectorAll('[data-sim-row]'), function (row) {
      var k = row.getAttribute('data-sim-row'), input = row.querySelector('input'), btn = row.querySelector('[data-fill]');
      if (input !== active) input.value = d.sim[k] != null ? d.sim[k] : '';
      var others = addTo(inp, simExtras(d, k));
      var rm = C.room(rr, others, k), use = C.useful(rr, others, k);
      var mine = all[k] || 0;
      var gain = mine > 0 ? C.simulate(rr, others, (function () { var e = {}; e[k] = mine; return e; })()).saved : 0;
      var meta = '<span class="badge">' + t('simUsed', { v: baht(res.items[k].ded) }) + '</span>' +
        '<span class="badge ' + (rm > 0 ? 'accent' : '') + '">' + (rm > 0 ? t('simRoom', { v: rm === Infinity ? '∞' : baht(rm) }) : t('simRoomNone')) + '</span>' +
        (rm > 0 && rm !== Infinity && use > 0 && use < rm - 0.5 ? '<span class="badge">' + t('simUseful', { v: baht(use) }) + '</span>' : '') +
        (gain > 0 ? '<span class="gain">' + t('simGain', { v: baht(gain) }) + '</span>' : '');
      row.querySelector('.meta').innerHTML = meta;
      var fill = rm === Infinity ? 0 : Math.ceil(use);
      btn.disabled = !(fill > 0) || Math.abs(mine - fill) < 0.01;
      btn.setAttribute('data-room', fill > 0 ? String(fill) : '');
    });

    var s = C.simulate(rr, inp, all);
    $('txSimKpi').innerHTML =
      kpi(t('simSpend'), baht(s.spend)) +
      kpi(t('simSaved'), baht(s.saved), s.saved > 0 ? 'grow' : '') +
      kpi(t('simAfter'), baht(s.after.tax)) +
      kpi(t('simRatio'), s.spend > 0 ? pct(s.ratio, 1) + '%' : '—');
    var h = kvRow(t('simNet'), baht(s.before.net) + ' → ' + baht(s.after.net)) +
      kvRow(t('simMarginal'), pct(s.before.marginalRate) + '% → ' + pct(s.after.marginalRate) + '%') +
      kvRow(t('sTax'), baht(s.before.tax) + ' → ' + baht(s.after.tax));
    if (s.after.withheld > 0) {
      var b0 = s.before.balance, b1 = s.after.balance;
      h += kvRow(t('simBalance'), (b0 > 0 ? '' : '+') + baht(-b0) + ' → ' + (b1 > 0 ? '' : '+') + baht(-b1), b1 > 0 ? 'risk' : '');
    }
    $('txSimKv').innerHTML = h;

    var badge = $('txDaysLeft');
    if (isCurrentYear()) {
      var n = new Date(), end = new Date(n.getFullYear(), 11, 31);
      badge.textContent = t('simDays', { n: fmt(daysUntil(end)) });
      badge.hidden = false;
    } else badge.hidden = true;
  }

  /* ══════ รวม ══════ */
  function render() {
    if (!R()) return;
    var d = yearData(), pl = pulled(), inp = inputs(d, pl), res = C.compute(R(), inp);
    renderYearSeg();
    fillForm(d, pl);
    renderCats(pl);
    renderFieldNotes(d, pl, res);
    renderKpi(res);
    renderSummary(res);
    renderSim(d, inp, res);
  }
  function rebuild() { buildForm(); buildSim(); render(); }
  function refresh() { render(); }

  function showTab(tab) {
    if (tab !== 'sim') tab = 'calc';
    ui.tab = tab;
    [].forEach.call(document.querySelectorAll('#txTabs .tab'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab)); });
    [].forEach.call(document.querySelectorAll('.tx-page [data-panel]'), function (p) { p.hidden = p.getAttribute('data-panel') !== tab; });
  }

  function onFormInput(e) {
    var el = e.target, k = el.getAttribute && el.getAttribute('data-key');
    if (!k) return;
    var d = yearData();
    if (el.value === '' || (FIELDS[k] === 'bool' && el.value === '0')) delete d.v[k];
    else d.v[k] = el.value;
    saveYearData(d);
    render();
  }
  function onSimInput(e) {
    var el = e.target, k = el.getAttribute && el.getAttribute('data-sim');
    if (!k) return;
    var d = yearData();
    if (el.value === '') delete d.sim[k]; else d.sim[k] = el.value;
    saveYearData(d);
    render();
  }

  function bind() {
    $('txYear').addEventListener('click', function (e) {
      var b = e.target.closest('[data-year]'); if (!b) return;
      ui.year = +b.getAttribute('data-year'); saveUi(); rebuild();
    });
    $('txProj').addEventListener('click', function (e) {
      var b = e.target.closest('[data-proj]'); if (!b) return;
      ui.proj = b.getAttribute('data-proj') === '1'; saveUi(); render();
    });
    $('txTabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return;
      showTab(b.getAttribute('data-tab')); saveUi();
    });
    $('txForm').addEventListener('input', onFormInput);
    $('txForm').addEventListener('change', function (e) {
      var sel = e.target.closest && e.target.closest('[data-cat]');
      if (sel) {
        var m = catMap(); m[sel.getAttribute('data-cat')] = sel.value; write(CATMAP_KEY, m); render(); return;
      }
      if (e.target.tagName === 'SELECT') onFormInput(e);
    });
    $('txSim').addEventListener('input', onSimInput);
    $('txSim').addEventListener('click', function (e) {
      var b = e.target.closest('[data-fill]'); if (!b || b.disabled) return;
      var k = b.getAttribute('data-fill'), rm = b.getAttribute('data-room');
      if (!rm) return;
      var d = yearData(); d.sim[k] = rm; saveYearData(d); render();
    });
    $('txSimClear').addEventListener('click', function () { var d = yearData(); d.sim = {}; saveYearData(d); render(); });

    var RELEVANT = /^(budget:|tanot:insurance:|tanot:invest:thaifund$|tanot:receipts:|tanot:tax:)/;
    if (TD && TD.onChange) TD.onChange(function (keys) {
      if (!keys.length || keys.some(function (k) { return RELEVANT.test(k); })) render();
    });
    window.addEventListener('tanot:quickadd', render);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') render(); });
    window.OME_PAGE_LIVE_LANG = true;
    window.OME_LANG.onChange(function () { applyStaticI18n(); rebuild(); });
  }

  function getJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  }

  function init() {
    applyStaticI18n();
    showTab(/^#sim$/.test(location.hash) ? 'sim' : ui.tab); // tax.html#sim = แท็บ "ถ้าซื้อเพิ่ม" (ลิงก์จาก invest-fund.html)
    bind();
    window.addEventListener('hashchange', function () { if (/^#sim$/.test(location.hash)) showTab('sim'); else if (/^#calc$/.test(location.hash)) showTab('calc'); });
    getJSON('tax-rules/index.json').then(function (idx) {
      var ys = (idx && idx.years || []).filter(function (y) { return isFinite(y); });
      return Promise.all(ys.map(function (y) {
        return getJSON('tax-rules/' + y + '.json').then(function (r) { rules[y] = r; return y; }, function () { return null; });
      }));
    }).then(function (ys) {
      years = ys.filter(function (y) { return y != null; }).sort(function (a, b) { return a - b; });
      if (!years.length) throw new Error('no rules');
      if (years.indexOf(ui.year) < 0) ui.year = C.defaultTaxYear(new Date(), years);
      rebuild();
      // กำหนดยื่นทุกปีในไฟล์กฎ → การแจ้งเตือน (tanot-push.js ส่งเฉพาะเมื่อชุดเปลี่ยน · ทำงานเฉพาะ pages.dev)
      if (window.TanotPush) window.TanotPush.setReminders('tax', C.reminders(rules, new Date()));
    }).catch(function () {
      $('txAlerts').innerHTML = callout('err', t('alertRules'));
      $('txAlerts').hidden = false;
    });
  }

  init();
})();
