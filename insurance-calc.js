/* ══════════════════════════════════════════════════════════════════
   Tanot — ทะเบียนกรมธรรม์: ตรรกะล้วน (ไม่มี DOM) · UMD — window.InsuranceCalc ในหน้า, require() ตรงๆ ใน tests/insurance.spec.js
   หน้า insurance.html / index.js (การ์ดต่ออายุ) / หน้าภาษีในอนาคต ใช้ไฟล์นี้ร่วมกัน

   รูปแบบกรมธรรม์ (localStorage['tanot:insurance:policies'] = array, sync mode 'list' idField 'id'):
     { id, type: 'life'|'health'|'car'|'home', insurer, name, policyNo, insured, sumInsured, premium (ต่อครั้งที่จ่าย),
       freq: 'year'|'half'|'quarter'|'month'|'single', startDate, renewDate (วันครบกำหนดครั้งถัดไป), endDate (ว่าง = ยังคุ้มครอง),
       taxCat: 'none'|'life'|'spouseLife'|'health'|'parentsHealth'|'annuity', longTerm (สัญญา ≥ 10 ปี — เงื่อนไขของเบี้ยชีวิต),
       note, files: [{ id, name, size, mime }] (ตัวไฟล์อยู่ R2 ผ่าน /api/files) }
   วันที่เป็น 'YYYY-MM-DD' เวลาท้องถิ่น

   สรุปเบี้ยลดหย่อนภาษีสำหรับหน้าภาษี: localStorage['tanot:insurance:taxsummary'] (sync blob, หน้าประกันเขียนใหม่ทุกครั้งที่ข้อมูลเปลี่ยน)
     { v: 1, updatedAt, years: { '2026': taxSummary(...) } }  — หน้าภาษีอ่านผ่าน TanotData.read หรือเรียก taxSummary() เองจาก policies ก็ได้

   เพดานลดหย่อน (ปีภาษี 2568–2569, ประมวลรัษฎากร มาตรา 47 + กฎกระทรวง/พ.ร.ฎ. ที่เกี่ยวข้อง — เจ้าของต้องตรวจทานกับประกาศกรมสรรพากรปีนั้นก่อนใช้ยื่นจริง):
     - เบี้ยประกันชีวิต (สัญญา ≥ 10 ปี)  ≤ 100,000
     - เบี้ยประกันสุขภาพ                 ≤ 25,000   (ชีวิต + สุขภาพของตัวเองรวมกัน ≤ 100,000)
     - เบี้ยประกันสุขภาพบิดามารดา         ≤ 15,000
     - เบี้ยประกันชีวิตคู่สมรส (ไม่มีเงินได้) ≤ 10,000
     - เบี้ยประกันชีวิตแบบบำนาญ          ≤ 15% ของเงินได้พึงประเมิน และ ≤ 200,000 (รวมกลุ่มเกษียณทั้งหมด ≤ 500,000 — หน้าภาษีเป็นคนรวม)
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InsuranceCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TYPES = { life: 'ชีวิต', health: 'สุขภาพ', car: 'รถ', home: 'บ้าน' };
  var FREQS = { year: 'รายปี', half: 'ราย 6 เดือน', quarter: 'รายไตรมาส', month: 'รายเดือน', single: 'จ่ายครั้งเดียว' };
  var FREQ_MONTHS = { year: 12, half: 6, quarter: 3, month: 1, single: 0 };
  var TAX_CATS = {
    none: 'ไม่ใช้ลดหย่อน', life: 'ประกันชีวิต', spouseLife: 'ประกันชีวิตคู่สมรส', health: 'ประกันสุขภาพ',
    parentsHealth: 'ประกันสุขภาพบิดามารดา', annuity: 'ประกันชีวิตแบบบำนาญ'
  };
  var CAPS = { life: 100000, health: 25000, lifeHealth: 100000, parentsHealth: 15000, spouseLife: 10000, annuity: 200000, annuityPct: 0.15 };

  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 ? d : null; // 2026-02-31 → ไม่ใช่วันที่จริง
  }
  function fmtDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  /** บวกเดือน โดยวันที่ 31/30/29 ที่ไม่มีในเดือนปลายทางถอยมาวันสุดท้ายของเดือน (31 ม.ค. + 1 เดือน = 28/29 ก.พ.) */
  function addMonths(dateStr, n) {
    var d = parseDate(dateStr);
    if (!d) return '';
    var day = d.getDate();
    var t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    var last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(day, last));
    return fmtDate(t);
  }

  /** จำนวนวันจาก "วันนี้" ถึง dateStr (ลบ = เลยกำหนดแล้ว) — null ถ้าวันที่ไม่ถูกต้อง */
  function daysUntil(dateStr, now) {
    var d = parseDate(dateStr);
    if (!d) return null;
    var n = now || new Date();
    var today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((d - today) / 86400000);
  }

  function paymentsPerYear(freq) { var m = FREQ_MONTHS[freq]; return m ? 12 / m : 1; }
  /** เบี้ยรวมต่อปี (จ่ายครั้งเดียว = เบี้ยก้อนนั้นเป็นรายการปีเดียว ใช้ที่ premiumInYear) */
  function annualPremium(p) { return num(p && p.premium) * paymentsPerYear(p && p.freq); }

  function isEnded(p, now) {
    if (!p || !p.endDate) return false;
    var d = daysUntil(p.endDate, now);
    return d !== null && d < 0;
  }

  /** เบี้ยที่จ่ายจริงในปี year (ค.ศ.) — นับงวดตามตารางจ่ายที่เริ่มจาก startDate ทุก N เดือนจนถึง endDate (งวดที่ตกในปีนั้น);
   *  ไม่มี startDate = สมมติจ่ายครบทั้งปี (ยกเว้นสิ้นสุดก่อนปีนั้น) · จ่ายครั้งเดียวนับเฉพาะปีที่เริ่ม */
  function premiumInYear(p, year) {
    if (!p) return 0;
    var start = parseDate(p.startDate), end = parseDate(p.endDate), per = num(p.premium);
    if (end && end.getFullYear() < year) return 0;
    if (p.freq === 'single') return start && start.getFullYear() === year ? per : 0;
    if (!start) return annualPremium(p);
    if (start.getFullYear() > year) return 0;
    var step = FREQ_MONTHS[p.freq] || 12, count = 0;
    for (var k = 0; k < 1200; k++) {
      var d = parseDate(addMonths(p.startDate, k * step));
      if (!d || d.getFullYear() > year) break;
      if (end && d > end) break;
      if (d.getFullYear() === year) count++;
    }
    return per * count;
  }

  function defaultTaxCat(type) { return type === 'life' ? 'life' : type === 'health' ? 'health' : 'none'; }
  function taxCatOf(p) {
    var c = p && p.taxCat;
    if (!c || !TAX_CATS[c]) c = defaultTaxCat(p && p.type);
    if ((c === 'life' || c === 'spouseLife' || c === 'annuity') && p.longTerm === false) return 'none';
    return c;
  }

  /** สรุปเบี้ยที่ลดหย่อนได้ของปี year: raw = เบี้ยจริงแยกหมวด, ded = หลังใช้เพดาน (annuity ใช้ min(เบี้ย, 200,000, 15% × income ถ้ามี income)) */
  function taxSummary(policies, year, opts) {
    var raw = { life: 0, spouseLife: 0, health: 0, parentsHealth: 0, annuity: 0 };
    (policies || []).forEach(function (p) {
      var c = taxCatOf(p);
      if (c !== 'none') raw[c] += premiumInYear(p, year);
    });
    Object.keys(raw).forEach(function (k) { raw[k] = Math.round(raw[k] * 100) / 100; });
    var health = Math.min(raw.health, CAPS.health);
    var life = Math.min(raw.life, CAPS.life, CAPS.lifeHealth - health);
    var spouseLife = Math.min(raw.spouseLife, CAPS.spouseLife);
    var parentsHealth = Math.min(raw.parentsHealth, CAPS.parentsHealth);
    var annuityCap = CAPS.annuity;
    if (opts && num(opts.income)) annuityCap = Math.min(annuityCap, Math.floor(num(opts.income) * CAPS.annuityPct));
    var annuity = Math.min(raw.annuity, annuityCap);
    var ded = { life: life, health: health, spouseLife: spouseLife, parentsHealth: parentsHealth, annuity: annuity };
    ded.total = life + health + spouseLife + parentsHealth + annuity;
    Object.keys(ded).forEach(function (k) { ded[k] = Math.round(ded[k] * 100) / 100; });
    return { year: year, raw: raw, ded: ded, annuityCap: annuityCap };
  }

  /** รายการที่ต้องต่ออายุ/จ่ายเบี้ยภายใน withinDays วัน (รวมที่เลยกำหนดแล้ว) เรียงใกล้สุดก่อน — ข้ามกรมธรรม์ที่สิ้นสุดแล้ว/ไม่มีวันต่ออายุ */
  function renewals(policies, now, withinDays) {
    var out = [];
    (policies || []).forEach(function (p) {
      if (!p || !p.renewDate || isEnded(p, now)) return;
      var d = daysUntil(p.renewDate, now);
      if (d === null || d > withinDays) return;
      out.push({ policy: p, days: d });
    });
    out.sort(function (a, b) { return a.days - b.days; });
    return out;
  }

  /** วันครบกำหนดครั้งถัดไปหลังจ่ายงวดนี้แล้ว — '' ถ้าจ่ายครั้งเดียว/ไม่มีวันต่ออายุ */
  function advanceRenewal(p) {
    var m = FREQ_MONTHS[p && p.freq];
    if (!m || !p.renewDate) return '';
    return addMonths(p.renewDate, m);
  }

  /* ── การแจ้งเตือนต่ออายุ (tanot-push.js → ตาราง reminders scope 'insurance') ──
     แจ้งก่อนวันต่ออายุ 30 / 7 วัน และวันครบกำหนด เวลา 08:00 เวลาไทย (Date.UTC ตรงๆ — ไม่ขึ้นกับ timezone ของเครื่อง)
     เฉพาะเวลาที่ยังไม่ถึง (ที่ผ่านไปแล้วไม่ลงทะเบียน) · ข้ามกรมธรรม์ที่สิ้นสุดแล้ว/สิ้นสุดก่อนวันต่ออายุ */
  var REMIND_LEADS = [30, 7, 0];
  var TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function thDate(d) { return d.getDate() + ' ' + TH_MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543); }
  function reminders(policies, now) {
    var t = (now || new Date()).getTime(), out = [];
    (policies || []).forEach(function (p) {
      if (!p || !p.id || !p.renewDate || isEnded(p, now)) return;
      var d = parseDate(p.renewDate);
      if (!d || (p.endDate && p.endDate < p.renewDate)) return;
      var label = String(p.name || TYPES[p.type] || 'กรมธรรม์').trim();
      var body = [label, String(p.insurer || '').trim(), 'ครบกำหนด ' + thDate(d)].filter(Boolean).join(' · ');
      if (num(p.premium)) body += ' · ฿' + Math.round(num(p.premium)).toLocaleString('en-US');
      REMIND_LEADS.forEach(function (lead) {
        var at = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - lead, 1, 0); // 08:00 น. เวลาไทย = 01:00 UTC
        if (at <= t) return;
        out.push({
          id: p.id + ':' + p.renewDate + ':' + lead,
          title: lead ? 'ต่ออายุประกันใน ' + lead + ' วัน' : 'ครบกำหนดต่ออายุประกันวันนี้',
          body: body, url: 'insurance.html', due_at: at, kind: 'push'
        });
      });
    });
    return out;
  }

  return {
    TYPES: TYPES, FREQS: FREQS, TAX_CATS: TAX_CATS, CAPS: CAPS, REMIND_LEADS: REMIND_LEADS,
    parseDate: parseDate, addMonths: addMonths, daysUntil: daysUntil,
    annualPremium: annualPremium, premiumInYear: premiumInYear, isEnded: isEnded,
    defaultTaxCat: defaultTaxCat, taxCatOf: taxCatOf, taxSummary: taxSummary,
    renewals: renewals, advanceRenewal: advanceRenewal, reminders: reminders
  };
});
