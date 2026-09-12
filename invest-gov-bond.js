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

  /* ══════ ระบบสองภาษา (ไทย/อังกฤษ) — ตามธรรมเนียมเดียวกับ invest-gold.js ══════ */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      navInvest: 'การลงทุน', pageTitleShort: 'พันธบัตรรัฐบาล',
      pageTitle: 'พันธบัตรรัฐบาล — คำนวณผลตอบแทน + ติดตามตารางจ่ายดอกเบี้ย',
      headSub: 'ออมทรัพย์ & ทั่วไป · อัตราผลตอบแทนแท้จริง (YTM) · หลังหักภาษี 15% · เทียบเงินฝากประจำ',
      calcTitle: 'คำนวณผลตอบแทนพันธบัตร',
      lblFace: 'มูลค่าหน้าตั๋ว (บาท)', lblCoupon: 'อัตราดอกเบี้ยหน้าตั๋ว/ปี (%)', lblCouponShort: 'อัตราดอกเบี้ย/ปี (%)',
      lblFreq: 'ความถี่จ่ายดอกเบี้ย', freq4: 'ทุก 3 เดือน (รายไตรมาส)', freq4Short: 'ทุก 3 เดือน', freq2: 'ทุก 6 เดือน', freq1: 'ทุกปี',
      lblPrice: 'ราคาที่ซื้อ (บาท)', lblPriceUnit: '(ปกติ = ราคาพาร์ ปรับได้ถ้าซื้อตลาดรอง)', lblYears: 'จำนวนปีจนครบกำหนด',
      calcBtn: 'คำนวณผลตอบแทน',
      lblCouponAnnual: 'ดอกเบี้ยรับ/ปี (ก่อนภาษี)', lblCouponAfterTax: 'ดอกเบี้ยรับ/ปี (หลังหักภาษี 15%)', lblWithholding: 'หัก ณ ที่จ่าย 15%',
      lblYtm: 'อัตราผลตอบแทนแท้จริงจนครบกำหนด (YTM)',
      subAtPar: 'ซื้อที่ราคาพาร์ — ผลตอบแทนแท้จริง ≈ อัตราดอกเบี้ยหน้าตั๋ว',
      subBelowPar: 'ซื้อต่ำกว่าพาร์ — ผลตอบแทนแท้จริงจึง<b>สูงกว่า</b>อัตราดอกเบี้ยหน้าตั๋ว',
      subAbovePar: 'ซื้อสูงกว่าพาร์ — ผลตอบแทนแท้จริงจึง<b>ต่ำกว่า</b>อัตราดอกเบี้ยหน้าตั๋ว',
      cmpTitle: 'เทียบกับเงินฝากประจำธนาคาร', lblDepRate: 'อัตราดอกเบี้ยเงินฝากประจำที่จะเทียบ (%)', cmpBtn: 'เทียบผลตอบแทน',
      cmpHint: 'ใช้เงินต้นและจำนวนปีจากการ์ดคำนวณผลตอบแทนด้านบน (กดคำนวณการ์ดนั้นก่อน)',
      cmpColBond: 'พันธบัตร', cmpColDeposit: 'เงินฝากประจำ',
      cmpPrincipal: 'เงินต้น', cmpGross: 'ดอกเบี้ยรวมก่อนภาษี', cmpNet: 'ดอกเบี้ยรวมหลังหักภาษี 15%', cmpSummary: 'สรุป',
      cmpFootnote: 'ดอกเบี้ยเงินฝาก<b>ออมทรัพย์</b>ทั่วไปมีเพดานยกเว้นภาษีรวมกันไม่เกิน 20,000 บาท/ปี (คนละกรณีกับเงินฝาก<b>ประจำ</b>ซึ่งมักถูกหักภาษีตามปกติ) และเงินฝากธนาคารได้รับความคุ้มครองจากสถาบันคุ้มครองเงินฝาก (DPA) สูงสุด 1,000,000 บาท/คน/สถาบันเท่านั้น ต่างจากพันธบัตรรัฐบาลที่มีรัฐบาลค้ำประกันความเสี่ยงต่ำมากไม่ว่าจำนวนเท่าไร',
      cmpDiffBondWins: 'พันธบัตรได้มากกว่า {v} หลังหักภาษี ตลอด {n} ปี',
      cmpDiffDepWins: 'เงินฝากประจำได้มากกว่า {v} หลังหักภาษี ตลอด {n} ปี',
      lgTitle: 'ตารางจ่ายดอกเบี้ย + สมุดพันธบัตรของฉัน',
      lblBondName: 'ชื่อ/รุ่นพันธบัตร', phBondName: 'เช่น ออมพลัส 2569',
      lblPurchDate: 'วันที่ซื้อ', lblMaturity: 'วันครบกำหนด', addBtn: '+ บันทึก',
      lgEmptyDefault: 'ยังไม่มีรายการ — บันทึกทุกครั้งที่ซื้อพันธบัตร จะได้ตารางจ่ายดอกเบี้ยและติดตามว่างวดไหนได้รับแล้ว',
      logThDate: 'วันที่ซื้อ', logThName: 'ชื่อ/รุ่น', logThFace: 'หน้าตั๋ว', logThCoupon: 'ดอกเบี้ย', logThMaturity: 'ครบกำหนด',
      groupSummary: 'ซื้อ {face} · ดอกเบี้ย {coupon}%/ปี · จ่าย{freq}',
      schedThDate: 'วันจ่าย', schedThAmt: 'จำนวนเงิน', schedThStatus: 'สถานะ',
      principalIncluded: '(รวมเงินต้นคืน)', statusGot: 'ได้รับแล้ว', statusWait: 'รอรับ',
      lessonSummary: 'เรียนรู้ — พันธบัตรรัฐบาลแบบเข้าใจง่าย',
      lsn1h: 'พันธบัตรรัฐบาลคืออะไร',
      lsn1p: 'เป็นตราสารหนี้ที่รัฐบาลออกเพื่อกู้เงินจากประชาชน แลกกับดอกเบี้ยตามที่กำหนด และคืนเงินต้นเมื่อครบกำหนด — มีรัฐบาลค้ำประกัน ความเสี่ยงผิดนัดชำระต่ำมากเมื่อเทียบกับตราสารหนี้เอกชน',
      lsn2h: 'พันธบัตรออมทรัพย์ vs พันธบัตรรัฐบาลทั่วไป',
      lsn2p: '<b>พันธบัตรออมทรัพย์</b> ขายให้บุคคลทั่วไปช่วงเวลาจำกัดผ่านแอปธนาคาร (Krungthai/Bangkok Bank/GSB/Streaming ฯลฯ) ซื้อที่ราคาพาร์เท่ากับมูลค่าหน้าตั๋ว เหมาะกับคนตั้งใจถือจนครบกำหนด · <b>พันธบัตรรัฐบาลทั่วไป</b> ซื้อขายในตลาดรองผ่านโบรกเกอร์ ราคาขึ้นลงได้ตามอัตราดอกเบี้ยตลาด อาจซื้อได้ต่ำหรือสูงกว่าพาร์',
      lsn3h: 'ทำไมราคาพันธบัตรขึ้นลงสวนทางดอกเบี้ยตลาด',
      lsn3p: 'ถ้าดอกเบี้ยตลาดขึ้นหลังจากคุณถือพันธบัตรอยู่ พันธบัตรเดิมที่ให้ดอกเบี้ยต่ำกว่าจะขายในตลาดรองได้ราคาต่ำลง (และตรงข้ามถ้าดอกเบี้ยตลาดลง ราคาจะสูงขึ้น) — แต่ถ้าตั้งใจถือจนครบกำหนดอยู่แล้ว ไม่ต้องกังวลเรื่องนี้เลย เพราะจะได้เงินต้นคืนเต็มจำนวนตามที่ตกลงไว้แน่นอน',
      lsn4h: 'ภาษีหัก ณ ที่จ่าย 15% คืออะไร',
      lsn4p: 'ดอกเบี้ยที่ได้รับจากพันธบัตร (และเงินฝากประจำส่วนใหญ่) ถูกหักภาษี ณ ที่จ่าย 15% โดยอัตโนมัติก่อนโอนเข้าบัญชี — เครื่องคำนวณด้านบนคำนวณให้ทั้งก่อนและหลังหักภาษีให้เห็นตัวเลขจริงที่จะได้รับ',
      lsn5h: 'ทำไมหน้านี้ไม่มีราคา/ผลตอบแทนตลาดสด (ต้องกรอกเอง)',
      lsn5p: 'สำรวจแล้ว ThaiBMA เผยแพร่ yield curve พันธบัตรบนเว็บให้ดูได้ แต่ API service ต้องขอสิทธิ์/สมัครใช้งาน ไม่ใช่ฟรีไม่ต้องขอคีย์ (เหตุผลเดียวกับที่หน้ากองทุนไทยไม่มี NAV สด) — ฝังคีย์ในโค้ดฝั่งเบราว์เซอร์ของเว็บ static แบบนี้ไม่ปลอดภัย จึงให้กรอกข้อมูลพันธบัตรที่ซื้อจริงเองแทน',
      footerDisc: 'ตัวเลขเป็นการประมาณจากสมมติฐานที่กรอก ไม่ใช่คำแนะนำการลงทุนหรือคำแนะนำภาษี · ข้อมูลเก็บในเครื่องคุณเท่านั้น',
      alertFace: 'กรอกมูลค่าหน้าตั๋วให้ถูกต้อง', alertPrice: 'กรอกราคาที่ซื้อให้ถูกต้อง', alertYears: 'กรอกจำนวนปีจนครบกำหนดให้ถูกต้อง',
      alertCalcFirst: 'กดคำนวณผลตอบแทนพันธบัตรก่อน', alertDepRate: 'กรอกอัตราดอกเบี้ยเงินฝากประจำให้ถูกต้อง',
      alertBondName: 'กรอกชื่อ/รุ่นพันธบัตร', alertDates: 'กรอกวันที่ซื้อและวันครบกำหนดให้ถูกต้อง',
      alertMaturityOrder: 'วันครบกำหนดต้องอยู่หลังวันที่ซื้อ', alertFaceCoupon: 'กรอกมูลค่าหน้าตั๋วและอัตราดอกเบี้ยให้ถูกต้อง'
    },
    en: {
      navInvest: 'Investing', pageTitleShort: 'Government Bonds',
      pageTitle: 'Government Bonds — Return Calculator + Coupon Schedule Tracker',
      headSub: 'Savings & regular bonds · true yield to maturity (YTM) · after 15% tax · vs. fixed deposits',
      calcTitle: 'Bond Return Calculator',
      lblFace: 'Face value (THB)', lblCoupon: 'Coupon rate/year (%)', lblCouponShort: 'Interest rate/year (%)',
      lblFreq: 'Coupon frequency', freq4: 'Every 3 months (quarterly)', freq4Short: 'Every 3 months', freq2: 'Every 6 months', freq1: 'Every year',
      lblPrice: 'Purchase price (THB)', lblPriceUnit: '(normally = par value, adjust if bought on the secondary market)', lblYears: 'Years to maturity',
      calcBtn: 'Calculate return',
      lblCouponAnnual: 'Coupon received/year (before tax)', lblCouponAfterTax: 'Coupon received/year (after 15% tax)', lblWithholding: '15% withholding tax',
      lblYtm: 'Yield to maturity (YTM)',
      subAtPar: 'Bought at par — the true yield ≈ the coupon rate',
      subBelowPar: 'Bought below par — the true yield is therefore <b>higher</b> than the coupon rate',
      subAbovePar: 'Bought above par — the true yield is therefore <b>lower</b> than the coupon rate',
      cmpTitle: 'Compare with a Bank Fixed Deposit', lblDepRate: 'Fixed-deposit rate to compare against (%)', cmpBtn: 'Compare returns',
      cmpHint: 'Uses the principal and years from the return calculator card above (calculate that card first)',
      cmpColBond: 'Bond', cmpColDeposit: 'Fixed Deposit',
      cmpPrincipal: 'Principal', cmpGross: 'Total interest before tax', cmpNet: 'Total interest after 15% tax', cmpSummary: 'Summary',
      cmpFootnote: '<b>Savings</b> account interest generally has a combined tax-exempt ceiling of 20,000 THB/year (different from <b>fixed</b> deposits, which are usually taxed normally), and bank deposits are protected by the Deposit Protection Agency (DPA) up to only 1,000,000 THB per person per institution — unlike government bonds, which carry a government guarantee and very low risk regardless of amount',
      cmpDiffBondWins: 'The bond earns {v} more after tax over {n} years',
      cmpDiffDepWins: 'The fixed deposit earns {v} more after tax over {n} years',
      lgTitle: 'Coupon Schedule + My Bond Log',
      lblBondName: 'Bond name/series', phBondName: 'e.g. Om Plus 2026',
      lblPurchDate: 'Purchase date', lblMaturity: 'Maturity date', addBtn: '+ Log',
      lgEmptyDefault: "No entries yet — log every bond you buy to get a coupon schedule and track which payments you've received",
      logThDate: 'Purchase date', logThName: 'Name/series', logThFace: 'Face value', logThCoupon: 'Interest', logThMaturity: 'Maturity',
      groupSummary: 'Bought {face} · interest {coupon}%/year · paid {freq}',
      schedThDate: 'Payment date', schedThAmt: 'Amount', schedThStatus: 'Status',
      principalIncluded: '(includes principal repayment)', statusGot: 'Received', statusWait: 'Pending',
      lessonSummary: 'Learn — Government Bonds Made Simple',
      lsn1h: 'What is a government bond',
      lsn1p: 'A debt instrument the government issues to borrow money from the public, in exchange for interest at a set rate, repaying the principal at maturity — government-guaranteed, with a very low default risk compared to corporate debt instruments',
      lsn2h: 'Savings bonds vs. regular government bonds',
      lsn2p: '<b>Savings bonds</b> are sold to the general public for a limited period through banking apps (Krungthai/Bangkok Bank/GSB/Streaming, etc.), bought at par equal to face value, suited to those planning to hold to maturity · <b>Regular government bonds</b> trade on the secondary market through brokers, with prices moving with market interest rates, so they may be bought below or above par',
      lsn3h: 'Why bond prices move opposite to market interest rates',
      lsn3p: "If market rates rise after you hold a bond, your existing bond (which pays a lower rate) will sell for less on the secondary market (and the opposite if rates fall — the price rises) — but if you plan to hold to maturity anyway, none of this matters, since you'll get your full principal back exactly as agreed",
      lsn4h: 'What is the 15% withholding tax',
      lsn4p: 'Interest received from bonds (and most fixed deposits) has 15% withholding tax deducted automatically before it reaches your account — the calculator above shows both the before- and after-tax figures so you see the real amount you\'ll receive',
      lsn5h: "Why this page has no live market price/yield (you enter it yourself)",
      lsn5p: "We looked into it — ThaiBMA publishes a bond yield curve on its website, but the API service requires registration/approval, it's not a free no-key service (the same reason the Thai fund page has no live NAV) — embedding a key in this static site's browser-side code would be unsafe, so you enter your actual bond purchase details yourself instead",
      footerDisc: 'These figures are estimates based on what you enter, not investment or tax advice · data is stored on your device only',
      alertFace: 'Enter a valid face value', alertPrice: 'Enter a valid purchase price', alertYears: 'Enter a valid number of years to maturity',
      alertCalcFirst: 'Calculate the bond return first', alertDepRate: 'Enter a valid fixed-deposit interest rate',
      alertBondName: 'Enter the bond name/series', alertDates: 'Enter valid purchase and maturity dates',
      alertMaturityOrder: 'The maturity date must be after the purchase date', alertFaceCoupon: 'Enter a valid face value and interest rate'
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
  function compareDeposit(principal, years, bondAnnualCoupon, depositRatePct) {
    var bondGross = bondAnnualCoupon * years;
    var bondAfterTax = bondGross * (1 - 0.15);
    var depGross = principal * (depositRatePct / 100) * years;
    var depAfterTax = depGross * (1 - 0.15);
    return { principal: principal, years: years, bondGross: bondGross, bondAfterTax: bondAfterTax, depGross: depGross, depAfterTax: depAfterTax };
  }

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
  function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
  function saveLog(a) { try { localStorage.setItem(LOG_KEY, JSON.stringify(a)); } catch (e) {} }

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
    if (!log.length) { box.innerHTML = '<div class="log-empty">' + t('lgEmptyDefault') + '</div>'; return; }
    var today = new Date();
    var html = '<table class="log-table"><thead><tr><th>' + t('logThDate') + '</th><th>' + t('logThName') + '</th><th>' + t('logThFace') + '</th><th>' + t('logThCoupon') + '</th><th>' + t('logThMaturity') + '</th><th></th></tr></thead><tbody>';
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
      html += '<div class="log-group-sub">' + t('groupSummary', { face: baht(r.face), coupon: fmt(r.coupon, 2), freq: freqLabel(r.freq) }) + '</div>';
      html += '<table class="log-table"><thead><tr><th>' + t('schedThDate') + '</th><th>' + t('schedThAmt') + '</th><th>' + t('schedThStatus') + '</th></tr></thead><tbody>';
      sched.forEach(function (row) {
        var got = row.date <= today;
        html += '<tr><td>' + row.date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
          '<td>' + baht(row.total) + (row.principal ? ' <span style="color:var(--muted);font-size:11px">' + t('principalIncluded') + '</span>' : '') + '</td>' +
          '<td><span class="cp-badge ' + (got ? 'got">' + t('statusGot') : 'wait">' + t('statusWait')) + '</span></td></tr>';
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
    applyStaticI18n();
    $('bfCalcBtn').addEventListener('click', doCalc);
    $('cmpBtn').addEventListener('click', doCompare);
    $('lgAdd').addEventListener('click', addLog);
    renderLog();
    renderBondNameList();
    doCalc(); /* แสดงผลตั้งต้นทันที */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.omeApplyLang = function () {
    applyStaticI18n();
    doCalc();
    if ($('cmpOut').style.display !== 'none') doCompare();
    renderLog();
  };

  window.__govbond = { solveYTM: solveYTM, bondPV: bondPV, couponSchedule: couponSchedule, compareDeposit: compareDeposit, addMonths: addMonths };
})();
