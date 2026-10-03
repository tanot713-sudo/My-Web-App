/* ══════════════════════════════════════════════════════════════════
   Tanot — คลังใบเสร็จ/ประกันสินค้า: ตรรกะล้วน (ไม่มี DOM/storage) · UMD — window.ReceiptsCalc ในหน้า, require() ตรงๆ ใน tests/receipts.spec.js
   receipts.html / index.js (การ์ดประกันสินค้าใกล้หมด) ใช้ไฟล์นี้ร่วมกัน — ห้ามมีสูตรวันหมดประกัน/ยอดลดหย่อนของตัวเองที่อื่น

   รูปแบบใบเสร็จ (localStorage['tanot:receipts:items'] = array, sync mode 'list' idField 'id'):
     { id, store, date 'YYYY-MM-DD', total (บาท), vat?, taxId? (13 หลัก), fullInvoice? (ใบกำกับภาษีเต็มรูป/e-Tax),
       items: [{ name, amount? }], note, taxTag: 'none'|'eReceipt'|'eReceiptOtop'|'donation'|'donationEdu'|'politic',
       warrantyProduct?, warrantyMonths? (วันหมด = date + เดือน), categoryId? (หมวดรายจ่ายที่เลือกส่งเข้า budget),
       budgetId? (id แถวใน budget:records ที่สร้างแล้ว — กันกดซ้ำ), files: [{ id, name, size, mime }] (R2 ผ่าน /api/files?ns=receipts),
       source?: 'free'|'claude' (ผลอ่านล่าสุดมาจากไหน — แสดงเป็นป้ายเท่านั้น), createdAt }
   สรุปให้หน้าภาษี: localStorage['tanot:receipts:taxsummary'] = { v:1, updatedAt, years: { '<ปี ค.ศ.>': { eReceipt, eReceiptOtop, donation, donationEdu, politic } } }
   (ชื่อช่องตรงกับช่องกรอกในหน้าภาษี — tax.js อ่านแล้วเติมช่องที่กฎของปีนั้นไม่ใช่ null)
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ReceiptsCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TAX_TAGS = {
    none: 'ไม่ลดหย่อน',
    eReceipt: 'Easy e-Receipt',
    eReceiptOtop: 'e-Receipt OTOP/วิสาหกิจชุมชน',
    donation: 'เงินบริจาคทั่วไป',
    donationEdu: 'บริจาคการศึกษา/กีฬา/รพ.รัฐ',
    politic: 'บริจาคพรรคการเมือง'
  };
  var TAX_FIELDS = ['eReceipt', 'eReceiptOtop', 'donation', 'donationEdu', 'politic'];
  var REMIND_LEADS = [30, 0];
  var TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  function num(n) { n = Number(n); return isFinite(n) ? n : 0; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function round2(n) { return Math.round(num(n) * 100) / 100; }

  /* ── วันที่ (ท้องถิ่นเที่ยงวัน ไม่ผูกกับ timezone ของเครื่อง) ── */
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3], 12);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function addMonths(s, n) {
    var d = parseDate(s);
    if (!d) return '';
    var y = d.getFullYear(), m = d.getMonth() + Math.round(n), day = d.getDate();
    var last = new Date(y, m + 1, 0, 12).getDate(); // วันสิ้นเดือนปลายทาง (31 ม.ค. + 1 เดือน = 28/29 ก.พ.)
    return ymd(new Date(y, m, Math.min(day, last), 12));
  }
  function daysUntil(s, now) {
    var d = parseDate(s);
    if (!d) return null;
    var n = now || new Date();
    return Math.round((d - new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12)) / 86400000);
  }
  function thDate(s) {
    var d = parseDate(s);
    return d ? d.getDate() + ' ' + TH_MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543) : '';
  }

  /** ปีที่อ่านมาเป็น พ.ศ. (≥ 2400) หรือ ค.ศ. หรือ 2 หลัก → ปี ค.ศ.; ไม่สมเหตุสมผล = 0 */
  function adYear(y) {
    y = +y;
    if (y < 100) y += y >= 40 ? 2500 : 2000;
    if (y >= 2400) y -= 543;
    return y >= 1990 && y <= 2100 ? y : 0;
  }
  function mkDate(y, m, d) {
    y = adYear(y);
    if (!y) return '';
    var dt = new Date(y, m - 1, d, 12);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? ymd(dt) : '';
  }
  function monthIndex(word) {
    var w = String(word).replace(/\./g, '').toLowerCase(), i;
    for (i = 0; i < 12; i++) {
      if (TH_MONTHS_FULL[i] === w || TH_MONTHS[i].replace(/\./g, '') === w || EN_MONTHS[i] === w.slice(0, 3)) return i;
    }
    return -1;
  }
  /** วันที่ในข้อความ (ISO, dd/mm/yyyy, dd เดือน yyyy — พ.ศ./ค.ศ.) → 'YYYY-MM-DD' หรือ '' */
  function findDate(text) {
    var s = String(text || ''), m, r;
    var re = /(\d{4})-(\d{1,2})-(\d{1,2})/g;
    while ((m = re.exec(s))) { r = mkDate(m[1], +m[2], +m[3]); if (r) return r; }
    re = /(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4}|\d{2})(?!\d)/g;
    while ((m = re.exec(s))) { r = mkDate(m[3], +m[2], +m[1]); if (r) return r; }
    re = /(\d{1,2})\s*([ก-๙A-Za-z]+\.?(?:[ก-๙]+\.?)?)\s*(\d{4}|\d{2})(?!\d)/g;
    while ((m = re.exec(s))) {
      var mi = monthIndex(m[2]);
      if (mi >= 0) { r = mkDate(m[3], mi + 1, +m[1]); if (r) return r; }
    }
    return '';
  }

  /* ── ตัวเลขเงิน ── */
  var NUM_RE = /\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g;
  function numbersIn(line) {
    var out = [], m;
    NUM_RE.lastIndex = 0;
    while ((m = NUM_RE.exec(line))) out.push(parseFloat(m[0].replace(/,/g, '')));
    return out;
  }
  /* คำนำหน้ายอดรวมเรียงตามความน่าเชื่อถือ — บรรทัดแรกที่ตรงคำลำดับต้นๆ ชนะ */
  var TOTAL_KEYS = [
    /รวมทั้งสิ้น|ยอดสุทธิ|สุทธิ|grand\s*total|net\s*total|net\s*amount|amount\s*due|total\s*due/i,
    /ยอดรวม|รวมเงิน|ยอดชำระ|ชำระเงิน|total|รวม/i
  ];
  /** ยอดรวมจากข้อความ OCR ด้วย regex — ไม่เจอคำที่บอกว่าเป็นยอดรวม = null (ไม่เดาจากเลขมากสุด) */
  function findTotal(text) {
    var lines = String(text || '').split(/\r?\n/), k, i, nums;
    for (k = 0; k < TOTAL_KEYS.length; k++) {
      for (i = lines.length - 1; i >= 0; i--) {
        if (!TOTAL_KEYS[k].test(lines[i])) continue;
        if (/vat|ภาษี|ส่วนลด|discount|ก่อน|รายการ|ชิ้น|items?\b/i.test(lines[i]) && !/สุทธิ|net/i.test(lines[i])) continue;
        nums = numbersIn(lines[i]);
        if (!nums.length && lines[i + 1]) nums = numbersIn(lines[i + 1]);
        if (nums.length) { var v = nums[nums.length - 1]; if (v > 0) return round2(v); }
      }
    }
    return null;
  }
  function findTaxId(text) {
    var m = /(?:^|\D)(\d[\s-]?\d{4}[\s-]?\d{5}[\s-]?\d{2}[\s-]?\d)(?!\d)/.exec(String(text || ''));
    return m ? m[1].replace(/\D/g, '') : '';
  }
  /** ทางสำรองเมื่อ AI ใช้ไม่ได้ — คืนเฉพาะช่องที่หาเจอ { total?, date?, taxId? } */
  function regexFields(text) {
    var out = {}, t = findTotal(text), d = findDate(text), id = findTaxId(text);
    if (t != null) out.total = t;
    if (d) out.date = d;
    if (id) out.taxId = id;
    return out;
  }

  /* ── AI: คำสั่ง + แปลงคำตอบ JSON ── */
  var SCHEMA_TEXT =
    '{"store":"ชื่อร้าน/ผู้ขาย","date":"YYYY-MM-DD (ค.ศ.)","total":ยอดรวมสุทธิเป็นตัวเลข,"vat":ภาษีมูลค่าเพิ่มเป็นตัวเลข,' +
    '"taxId":"เลขประจำตัวผู้เสียภาษีของผู้ขาย 13 หลัก","fullInvoice":true หรือ false (เป็นใบกำกับภาษีเต็มรูป/e-Tax Invoice หรือไม่),' +
    '"items":[{"name":"ชื่อสินค้า","amount":ราคารวมของรายการ}]}';
  /** ข้อความที่ส่งให้โมเดลเร็วบน Workers AI (/api/ai/chat model 'fast') พร้อมข้อความที่ Tesseract อ่านได้ */
  function aiMessages(ocrText) {
    return [
      { role: 'system', content: 'คุณแยกข้อมูลจากข้อความ OCR ของใบเสร็จ/ใบกำกับภาษีไทย ตอบเป็น JSON ออบเจ็กต์เดียวเท่านั้น ห้ามมีข้อความอื่นหรือ markdown ใช้รูปแบบ ' + SCHEMA_TEXT + ' ช่องที่ไม่แน่ใจหรือไม่มีให้ใส่ null ห้ามเดาตัวเลข' },
      { role: 'user', content: String(ocrText || '').slice(0, 6000) }
    ];
  }
  /** prompt ใหม่สำหรับ Claude Vision (ไม่ใช่ DEFAULT_PROMPT ของ /api/ocr) — ตอบ JSON ช่องเดียวกับแบบฟรี */
  var CLAUDE_PROMPT =
    'อ่านใบเสร็จ/ใบกำกับภาษีในภาพนี้ แล้วตอบเป็น JSON ออบเจ็กต์เดียวเท่านั้น ห้ามมีข้อความอื่นหรือ markdown ใช้รูปแบบ ' + SCHEMA_TEXT +
    ' ช่องที่ไม่มีในภาพหรืออ่านไม่ออกให้ใส่ null ห้ามเดาตัวเลข';

  function cleanItems(v) {
    if (!Array.isArray(v)) return [];
    return v.slice(0, 40).map(function (x) {
      if (typeof x === 'string') return { name: x.trim().slice(0, 120) };
      if (!x || typeof x !== 'object') return null;
      var name = String(x.name == null ? '' : x.name).trim().slice(0, 120);
      if (!name) return null;
      var it = { name: name }, a = Number(x.amount);
      if (isFinite(a) && a >= 0 && x.amount !== null && x.amount !== '') it.amount = round2(a);
      return it;
    }).filter(Boolean);
  }
  function posNum(v) {
    if (v == null || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[,฿\s]/g, ''));
    return isFinite(n) && n > 0 ? round2(n) : null;
  }
  /** คำตอบ (ข้อความหรือออบเจ็กต์) → { store?, date?, total?, vat?, taxId?, fullInvoice?, items? } เฉพาะช่องที่ใช้ได้; อ่าน JSON ไม่ได้ = null */
  function parseFields(raw) {
    var o = raw;
    if (typeof raw === 'string') {
      var a = raw.indexOf('{'), b = raw.lastIndexOf('}');
      if (a < 0 || b <= a) return null;
      try { o = JSON.parse(raw.slice(a, b + 1)); } catch (e) { return null; }
    }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    var out = {}, t;
    if (typeof o.store === 'string' && o.store.trim()) out.store = o.store.trim().slice(0, 120);
    t = typeof o.date === 'string' ? (parseDate(o.date) ? o.date : findDate(o.date)) : '';
    if (t) out.date = t;
    if ((t = posNum(o.total)) != null) out.total = t;
    if ((t = posNum(o.vat)) != null) out.vat = t;
    t = findTaxId(typeof o.taxId === 'string' || typeof o.taxId === 'number' ? String(o.taxId) : '');
    if (t) out.taxId = t;
    if (typeof o.fullInvoice === 'boolean') out.fullInvoice = o.fullInvoice;
    t = cleanItems(o.items);
    if (t.length) out.items = t;
    return out;
  }

  /* ── ประกันสินค้า ── */
  function warrantyEnd(r) {
    if (!r || !(num(r.warrantyMonths) > 0)) return '';
    return addMonths(r.date, r.warrantyMonths);
  }
  function warrantyLabel(r) { return String((r && (r.warrantyProduct || (r.items && r.items[0] && r.items[0].name) || r.store)) || 'สินค้า').trim(); }
  /** ใบเสร็จที่ประกันหมดภายใน N วัน (ยังไม่หมด) เรียงใกล้สุดก่อน → [{ receipt, end, days }] */
  function expiring(list, now, within) {
    var out = [];
    (list || []).forEach(function (r) {
      var end = warrantyEnd(r), d = end ? daysUntil(end, now) : null;
      if (d !== null && d >= 0 && d <= (within == null ? 60 : within)) out.push({ receipt: r, end: end, days: d });
    });
    out.sort(function (a, b) { return a.days - b.days; });
    return out;
  }
  /** แจ้งเตือนก่อนหมดประกัน 30 วัน และวันหมด 08:00 เวลาไทย (Date.UTC ตรงๆ) เฉพาะที่ยังไม่ถึง — scope 'receipts' */
  function reminders(list, now) {
    var t = (now || new Date()).getTime(), out = [];
    (list || []).forEach(function (r) {
      var end = r && r.id ? warrantyEnd(r) : '', d = end && parseDate(end);
      if (!d) return;
      var body = [warrantyLabel(r), String(r.store || '').trim(), 'หมด ' + thDate(end)].filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(' · ');
      REMIND_LEADS.forEach(function (lead) {
        var at = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - lead, 1, 0); // 08:00 น. เวลาไทย = 01:00 UTC
        if (at <= t) return;
        out.push({
          id: r.id + ':' + end + ':' + lead,
          title: lead ? 'ประกันสินค้าหมดใน ' + lead + ' วัน' : 'ประกันสินค้าหมดวันนี้',
          body: body, url: 'receipts.html', due_at: at, kind: 'push'
        });
      });
    });
    return out;
  }

  /* ── ป้ายลดหย่อนภาษี → ยอดต่อปี (ค.ศ. ของวันที่บนใบเสร็จ) ── */
  function taxSummary(list) {
    var years = {};
    (list || []).forEach(function (r) {
      var d = r && parseDate(r.date), tag = r && r.taxTag, amt = r ? num(r.total) : 0;
      if (!d || TAX_FIELDS.indexOf(tag) < 0 || !(amt > 0)) return;
      var y = years[d.getFullYear()] || (years[d.getFullYear()] = {});
      y[tag] = round2((y[tag] || 0) + amt);
    });
    return { v: 1, years: years };
  }

  /* ── ค้นหา/กรอง ── */
  function receiptYear(r) { var d = parseDate(r && r.date); return d ? d.getFullYear() : 0; }
  function matches(r, f) {
    f = f || {};
    if (f.year && receiptYear(r) !== +f.year) return false;
    if (f.tag && f.tag !== 'all' && (r.taxTag || 'none') !== f.tag) return false;
    if (f.warranty && !(num(r.warrantyMonths) > 0)) return false;
    var q = String(f.q || '').trim().toLowerCase();
    if (q) {
      var hay = [r.store, r.note, r.taxId, r.warrantyProduct].concat((r.items || []).map(function (i) { return i.name; })).join('\n').toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }
  function years(list) {
    var seen = {};
    (list || []).forEach(function (r) { var y = receiptYear(r); if (y) seen[y] = 1; });
    return Object.keys(seen).map(Number).sort(function (a, b) { return b - a; });
  }

  return {
    TAX_TAGS: TAX_TAGS, TAX_FIELDS: TAX_FIELDS, REMIND_LEADS: REMIND_LEADS, CLAUDE_PROMPT: CLAUDE_PROMPT,
    parseDate: parseDate, addMonths: addMonths, daysUntil: daysUntil, thDate: thDate, ymd: ymd,
    findDate: findDate, findTotal: findTotal, findTaxId: findTaxId, regexFields: regexFields,
    aiMessages: aiMessages, parseFields: parseFields,
    warrantyEnd: warrantyEnd, warrantyLabel: warrantyLabel, expiring: expiring, reminders: reminders,
    taxSummary: taxSummary, matches: matches, years: years, receiptYear: receiptYear
  };
});
