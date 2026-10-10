/* ══════════════════════════════════════════════════════════════════
   Tanot — คลังใบเสร็จ/ประกันสินค้า (receipts.html) · ส่วนแสดงผล
   ตรรกะ (แยกช่องจากข้อความ, วันหมดประกัน, แจ้งเตือน, ยอดป้ายภาษี) อยู่ใน receipts-calc.js (window.ReceiptsCalc) — ไฟล์นี้อ่าน/เขียน storage + วาดหน้า
   ข้อมูล: localStorage['tanot:receipts:items'] (sync list) · สรุปป้ายลดหย่อนให้หน้าภาษี: 'tanot:receipts:taxsummary'
   ไฟล์: R2 ผ่าน /api/files?ns=receipts (เฉพาะ *.pages.dev) — ในใบเสร็จเก็บแค่ { id, name, size, mime } · รูปย่อ (≤1600px JPEG) ก่อนส่ง
   ส่งเข้า budget: เพิ่มแถว { id, date, type:'expense', categoryId, amount, note } ใน budget:records ผ่าน TanotData.update (ไม่แก้โครงของ budget)

   การอ่านใบเสร็จ (หลักการ: ฟรีเสมอ — Claude เฉพาะเมื่อผู้ใช้กดปุ่มเอง):
     อัตโนมัติ (ฟรี) = Tesseract.js ในเบราว์เซอร์ (tha+eng, โหลดตอนอ่านครั้งแรก) → /api/ai/chat โมเดล fast แยกช่องเป็น JSON → ไม่ได้ใช้ regex
     "อ่านด้วย Claude" = /api/ocr เรียกจาก click handler ของปุ่ม claudeBtn ที่เดียวเท่านั้น (ผ่าน TanotOcr ใน ocr-vision.js: ย่อรูป + dialog รหัสทุกครั้ง) — ห้ามเรียก AiClient.ocr / /api/ocr จากที่อื่น
       PDF ที่หน้าแรกไม่มีเลเยอร์ข้อความ (สแกน) ส่งทั้งไฟล์ให้ Claude · มีข้อความอยู่แล้ว = ส่งภาพหน้าแรกเหมือนเดิม
     ไม่จำตัวเลือก: ทุกใบเริ่มที่แบบฟรี
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  window.TANOT_NO_RELOAD_BAR = true; // วาดใหม่เองเมื่อ TanotData.onChange — ห้ามรีเซ็ตช่องในฟอร์มที่กำลังกรอก

  var C = window.ReceiptsCalc;

  /* ── ข้อความ UI สองภาษา (i18n.js) — คีย์ 'receipts.*' · ป้ายลดหย่อนของ receipts-calc.js แปลที่นี่ตามรหัส ── */
  var I18N = window.OME_I18N;
  var TR = I18N ? I18N.scope('receipts', {
    th: {
      title: 'คลังใบเสร็จ | Tanot', h1: 'คลังใบเสร็จ', addRec: 'เพิ่มใบเสร็จ', hList: 'ใบเสร็จ', phSearch: 'ค้นหาร้าน/สินค้า', search: 'ค้นหา', year: 'ปี', taxTag: 'ป้ายภาษี',
      withWar: 'มีประกัน', cam: 'ถ่ายรูป', file: 'เลือกไฟล์', readClaude: 'อ่านด้วย Claude', store: 'ร้าน', date: 'วันที่', total: 'ยอดรวม (บาท)', vat: 'VAT (บาท)',
      taxId: 'เลขผู้เสียภาษีผู้ขาย', full: 'ใบกำกับภาษีเต็มรูป / e-Tax', items: 'รายการสินค้า', product: 'สินค้าที่มีประกัน', months: 'ประกัน (เดือน)', warEnd: 'วันหมดประกัน',
      tag2: 'ป้ายลดหย่อนภาษี', cat: 'หมวดรายจ่าย', note: 'บันทึก', del: 'ลบ', toBudget: 'บันทึกเป็นรายจ่าย', cancel: 'ยกเลิก', save: 'บันทึก', close: 'ปิด', receipt: 'ใบเสร็จ',
      kRec: 'ใบเสร็จ', unitRec: 'ใบ', kYear: 'ยอดปีนี้', kWar: 'ประกันใกล้หมด', unitItems: 'รายการ', kTax: 'ป้ายลดหย่อนปีนี้', allYears: 'ทุกปี', yearOpt: 'ปี {y}',
      allTags: 'ทุกป้าย', 'tag.none': 'ไม่ลดหย่อน', 'tag.eReceipt': 'Easy e-Receipt', 'tag.eReceiptOtop': 'e-Receipt OTOP/วิสาหกิจชุมชน', 'tag.donation': 'เงินบริจาคทั่วไป',
      'tag.donationEdu': 'บริจาคการศึกษา/กีฬา/รพ.รัฐ', 'tag.politic': 'บริจาคพรรคการเมือง', warExpired: 'หมดประกันแล้ว', warToday: 'ประกันหมดวันนี้', warIn: 'ประกันอีก {n} วัน',
      warUntil: 'ประกันถึง {d}', noMatch: 'ไม่พบใบเสร็จที่ตรงกับตัวกรอง', none: 'ยังไม่มีใบเสร็จ', sentBudget: 'ส่งเข้า budget', viewFull: 'ดูรูปเต็ม', edit: 'แก้ไข',
      check: 'ตรวจสอบ', free: 'ฟรี', addTitle: 'เพิ่มใบเสร็จ', editTitle: 'แก้ไขใบเสร็จ', rmFile: 'เอาไฟล์ออก', sentDone: 'ส่งเข้า budget แล้ว', reading: 'กำลังอ่านใบเสร็จ…',
      autoFail: 'อ่านอัตโนมัติไม่ได้ — กรอกเอง', claudeReading: 'Claude กำลังอ่าน…', claudeBad: 'Claude ตอบกลับในรูปแบบที่อ่านไม่ได้', convertImg: 'แปลงรูปไม่ได้',
      openImg: 'เปิดรูปไม่ได้', readImg: 'อ่านรูปไม่ได้', openFile: 'เปิดไฟล์ไม่ได้', onlyPdf: 'รองรับเฉพาะ PDF และรูปภาพ', tooBig: '{name} ใหญ่เกิน 15 MB', uploadFail: 'อัปโหลดไม่สำเร็จ',
      uploadFailCode: 'อัปโหลดไม่สำเร็จ ({s})', errStore: 'ใส่ชื่อร้านหรือยอดรวมอย่างน้อยหนึ่งช่อง', errTotal: 'ใส่ยอดรวมก่อนบันทึกเป็นรายจ่าย', confirmDel: 'ลบใบเสร็จนี้และไฟล์แนบทั้งหมด? (รายการใน budget ที่สร้างแล้วจะไม่ถูกลบ)'
    },
    en: {
      title: 'Receipts | Tanot', h1: 'Receipts', addRec: 'Add receipt', hList: 'Receipts', phSearch: 'Search store / product', search: 'Search', year: 'Year',
      taxTag: 'Tax tag', withWar: 'With warranty', cam: 'Take photo', file: 'Choose file', readClaude: 'Read with Claude', store: 'Store', date: 'Date', total: 'Total (THB)',
      vat: 'VAT (THB)', taxId: 'Seller\'s tax ID', full: 'Full tax invoice / e-Tax', items: 'Items', product: 'Product under warranty', months: 'Warranty (months)',
      warEnd: 'Warranty ends', tag2: 'Tax-deduction tag', cat: 'Expense category', note: 'Note', del: 'Delete', toBudget: 'Save as expense', cancel: 'Cancel',
      save: 'Save', close: 'Close', receipt: 'Receipt', kRec: 'Receipts', unitRec: '', kYear: 'Total this year', kWar: 'Warranties expiring soon', unitItems: '',
      kTax: 'Tax-tagged this year', allYears: 'All years', yearOpt: 'Year {y}', allTags: 'All tags', 'tag.none': 'No deduction', 'tag.eReceipt': 'Easy e-Receipt',
      'tag.eReceiptOtop': 'e-Receipt OTOP / community enterprise', 'tag.donation': 'General donation', 'tag.donationEdu': 'Donation: education / sports / public hospital',
      'tag.politic': 'Political party donation', warExpired: 'Warranty expired', warToday: 'Warranty ends today', warIn: 'Warranty: {n} days left', warUntil: 'Warranty until {d}',
      noMatch: 'No receipts match the filters', none: 'No receipts yet', sentBudget: 'Sent to budget', viewFull: 'View full image', edit: 'Edit', check: 'Check',
      free: 'Free', addTitle: 'Add receipt', editTitle: 'Edit receipt', rmFile: 'Remove file', sentDone: 'Sent to budget', reading: 'Reading the receipt…', autoFail: 'Could not read it automatically — please fill it in',
      claudeReading: 'Claude is reading…', claudeBad: 'Claude\'s reply could not be understood', convertImg: 'Could not convert the image', openImg: 'Could not open the image',
      readImg: 'Could not read the image', openFile: 'Could not open the file', onlyPdf: 'Only PDF and images are supported', tooBig: '{name} is larger than 15 MB',
      uploadFail: 'Upload failed', uploadFailCode: 'Upload failed ({s})', errStore: 'Enter a store name or a total', errTotal: 'Enter a total before saving as an expense',
      confirmDel: 'Delete this receipt and all attached files? (Budget entries already created are kept.)'
    }
  }) : function () { return ''; };
  function catName(c) { return I18N ? I18N.catName(c) : c.name; }
  function tagLabel(k) { return TR('tag.' + k) || C.TAX_TAGS[k]; }
  var TD = window.TanotData;
  var KEY = 'tanot:receipts:items';
  var SUMMARY_KEY = 'tanot:receipts:taxsummary';
  var REC_KEY = 'budget:records', CAT_KEY = 'budget:categories';
  var MAX_FILE = 15 * 1024 * 1024;
  var TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; // เวอร์ชันเดียวกับ doc-check.html
  var PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs';       // เวอร์ชันเดียวกับ doc-check.html
  var PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';
  // ใช้เมื่อยังไม่เคยเปิด budget.html — id ต้องตรงกับ DEFAULT_CATEGORIES ใน budget.html (เหมือน quick-add.js)
  var FALLBACK_CATS = [
    { id: 'cat-rice', name: 'ค่าข้าว', type: 'expense' },
    { id: 'cat-fuel', name: 'เติมน้ำมัน', type: 'expense' },
    { id: 'cat-personal', name: 'ซื้อของใช้ส่วนตัว', type: 'expense' },
    { id: 'cat-shopping', name: 'Shopping', type: 'expense' }
  ];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function num(n, d) { var v = Number(n) || 0, o = { maximumFractionDigits: d == null ? 0 : d }; return I18N ? I18N.number(v, o) : v.toLocaleString('th-TH', o); }
  function baht(n) { return '฿' + num(n, n % 1 ? 2 : 0); }
  function filesAvailable() { return /\.pages\.dev$/.test(location.hostname) || !!(window.TANOT_FILES && window.TANOT_FILES.enabled); }
  function aiAvailable() { return !!(window.AiClient && window.AiClient.available()); }
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function todayYmd() { return C.ymd(new Date()); }

  /* ── storage: อ่านสดทุกครั้ง, เขียนผ่าน TanotData.update (ไม่นับว่าหน้านี้ถือคีย์ → ไม่เด้งแถบรีโหลด) ── */
  function upd(k, fn) {
    if (TD && TD.update) return TD.update(k, fn);
    var cur = null;
    try { cur = JSON.parse(localStorage.getItem(k)); } catch (e) {}
    var next = fn(cur);
    if (next !== undefined) localStorage.setItem(k, JSON.stringify(next));
    return next;
  }
  /* ใบเสร็จของหน้านี้: อ่านด้วย localStorage.getItem จริงก่อนเขียนทุกครั้ง — tanot-data.js จะรู้ว่าหน้านี้เห็นแถวที่อีกเครื่องส่งมาแล้ว
     (ลบแถวนั้นจึงลบจริง ไม่ถูก 3-way merge ใส่กลับ); ที่เหลือที่ไม่ได้ผ่านทางนี้ (budget:records) ใช้ TanotData.update เพื่อไม่ถือคีย์ */
  function mutate(k, fn) {
    var cur = null;
    try { cur = JSON.parse(localStorage.getItem(k)); } catch (e) {}
    var next = fn(cur);
    if (next !== undefined) localStorage.setItem(k, JSON.stringify(next));
    return next;
  }
  function load() {
    var v = TD && TD.read ? TD.read(KEY, []) : null;
    if (v == null) { try { v = JSON.parse(localStorage.getItem(KEY)); } catch (e) { v = null; } }
    return Array.isArray(v) ? v.filter(function (r) { return r && typeof r === 'object' && r.id; }) : [];
  }
  function writeSummary(list) {
    var years = C.taxSummary(list).years, prev = null;
    try { prev = JSON.parse(localStorage.getItem(SUMMARY_KEY)); } catch (e) {}
    if (!Object.keys(years).length && !prev) return;
    if (prev && JSON.stringify(prev.years) === JSON.stringify(years)) return; // ไม่เปลี่ยน = ไม่เขียน (ไม่ปั่นคิวซิงก์)
    localStorage.setItem(SUMMARY_KEY, JSON.stringify({ v: 1, updatedAt: Date.now(), years: years }));
  }
  function upsert(rec) {
    var list = mutate(KEY, function (cur) {
      cur = Array.isArray(cur) ? cur : [];
      var i = cur.findIndex(function (x) { return x && x.id === rec.id; });
      if (i === -1) cur.push(rec); else cur[i] = rec;
      return cur;
    });
    writeSummary(list || load());
  }
  function remove(id) {
    var list = mutate(KEY, function (cur) { return (Array.isArray(cur) ? cur : []).filter(function (x) { return x && x.id !== id; }); });
    writeSummary(list || load());
  }
  function budgetCats() {
    var c = TD && TD.read ? TD.read(CAT_KEY, null) : null;
    var list = Array.isArray(c) ? c.filter(function (x) { return x && x.type === 'expense'; }) : [];
    return list.length ? list : FALLBACK_CATS;
  }

  /* ── สถานะหน้า ── */
  var flt = { q: '', year: '', tag: 'all', warranty: false };
  var S = null; // สถานะของกล่องที่เปิดอยู่

  /* ── หน้าหลัก ── */
  function dateTh(s) { var d = C.parseDate(s); return d ? (I18N ? I18N.date(d, { day: 'numeric', month: 'short', year: 'numeric' }) : C.thDate(s)) : ''; }
  function renderKpis(list) {
    var now = new Date(), y = now.getFullYear();
    var yearTotal = list.reduce(function (s, r) { return C.receiptYear(r) === y ? s + (Number(r.total) || 0) : s; }, 0);
    var tax = C.taxSummary(list).years[y] || {};
    var taxTotal = C.TAX_FIELDS.reduce(function (s, k) { return s + (tax[k] || 0); }, 0);
    function k(label, value, unit) { return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value">' + value + (unit ? '<small>' + unit + '</small>' : '') + '</div></div>'; }
    $('kpis').innerHTML = k(esc(TR('kRec')), num(list.length), esc(TR('unitRec'))) + k(esc(TR('kYear')), baht(yearTotal)) +
      k(esc(TR('kWar')), num(C.expiring(list, now, 60).length), esc(TR('unitItems'))) + k(esc(TR('kTax')), baht(taxTotal));
  }
  function renderFilters(list) {
    var ys = C.years(list), ysel = $('fYear'), cur = flt.year;
    var want = '<option value="">' + esc(TR('allYears')) + '</option>' + ys.map(function (y) { return '<option value="' + y + '">' + esc(TR('yearOpt', { y: I18N && I18N.lang() === 'en' ? y : y + 543 })) + '</option>'; }).join('');
    if (ysel.getAttribute('data-sig') !== want) { ysel.innerHTML = want; ysel.setAttribute('data-sig', want); }
    if (cur && ys.indexOf(+cur) === -1) { flt.year = ''; }
    ysel.value = flt.year;
    var tsel = $('fTag');
    var tsig = I18N ? I18N.lang() : 'th';
    if (tsel.getAttribute('data-sig') !== tsig) {
      tsel.innerHTML = '<option value="all">' + esc(TR('allTags')) + '</option>' + Object.keys(C.TAX_TAGS).map(function (k) { return '<option value="' + k + '">' + esc(tagLabel(k)) + '</option>'; }).join('');
      tsel.setAttribute('data-sig', tsig);
    }
    tsel.value = flt.tag;
    $('fWar').setAttribute('aria-pressed', String(flt.warranty));
  }
  function warrantyBadge(r, now) {
    var end = C.warrantyEnd(r);
    if (!end) return '';
    var d = C.daysUntil(end, now);
    if (d === null) return '';
    if (d < 0) return '<span class="badge" data-b="war">' + esc(TR('warExpired')) + '</span>';
    if (d === 0) return '<span class="badge warn" data-b="war">' + esc(TR('warToday')) + '</span>';
    if (d <= 30) return '<span class="badge warn" data-b="war">' + esc(TR('warIn', { n: num(d) })) + '</span>';
    if (d <= 60) return '<span class="badge info" data-b="war">' + esc(TR('warIn', { n: num(d) })) + '</span>';
    return '<span class="badge" data-b="war">' + esc(TR('warUntil', { d: dateTh(end) })) + '</span>';
  }
  function renderList(list) {
    var now = new Date();
    var rows = list.filter(function (r) { return C.matches(r, flt); });
    rows.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')) || (b.createdAt || 0) - (a.createdAt || 0); });
    if (!rows.length) {
      $('listBody').innerHTML = '<div class="empty">' + icon('receipt') + '<p>' + esc(list.length ? TR('noMatch') : TR('none')) + '</p></div>';
      return;
    }
    $('listBody').innerHTML = '<div class="list">' + rows.map(function (r) {
      var meta = [dateTh(r.date), (r.items || []).slice(0, 2).map(function (i) { return i.name; }).join(', '), r.note].filter(Boolean).join(' · ');
      var nFiles = Array.isArray(r.files) ? r.files.length : 0;
      return '<div class="list-row" data-id="' + esc(r.id) + '">' +
        '<span class="lead">' + icon('receipt') + '</span>' +
        '<div class="grow"><div class="title">' + esc(r.store || TR('receipt')) + '</div><div class="meta">' + esc(meta) + '</div></div>' +
        '<div class="end">' +
          (r.total ? '<div class="amt">' + baht(r.total) + '</div>' : '') +
          (r.taxTag && r.taxTag !== 'none' && C.TAX_TAGS[r.taxTag] ? '<span class="badge accent" data-b="tax">' + esc(tagLabel(r.taxTag)) + '</span>' : '') +
          warrantyBadge(r, now) +
          (r.budgetId ? '<span class="badge ok" data-b="budget">' + icon('check') + esc(TR('sentBudget')) + '</span>' : '') +
          (nFiles ? '<button class="btn sm icon" type="button" data-act="view" aria-label="' + esc(TR('viewFull')) + '">' + icon('eye') + '</button>' : '') +
          '<button class="btn sm icon" type="button" data-act="edit" aria-label="' + esc(TR('edit')) + '">' + icon('pencil') + '</button>' +
        '</div></div>';
    }).join('') + '</div>';
  }
  function renderAll() {
    var list = load();
    // วันหมดประกัน → การแจ้งเตือน (tanot-push.js ส่งเฉพาะเมื่อชุดเปลี่ยน · ทำงานเฉพาะ pages.dev)
    if (window.TanotPush) window.TanotPush.setReminders('receipts', C.reminders(list, new Date()));
    renderKpis(list);
    renderFilters(list);
    renderList(list);
  }

  /* ── กล่องเพิ่ม/แก้ไข ── */
  var dlg = $('dlg');
  function fillTag2() {
    var cur = $('fTag2').value;
    $('fTag2').innerHTML = Object.keys(C.TAX_TAGS).map(function (k) { return '<option value="' + k + '">' + esc(tagLabel(k)) + '</option>'; }).join('');
    if (cur) $('fTag2').value = cur;
  }
  fillTag2();

  function itemsToText(items) {
    return (items || []).map(function (i) { return i.name + (i.amount != null ? '  ' + i.amount : ''); }).join('\n');
  }
  function parseItemsText(s) {
    return String(s || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 40).map(function (l) {
      var m = /^(.*\S)(?:\t|\s{2,})(\d[\d,]*(?:\.\d{1,2})?)$/.exec(l);
      return m ? { name: m[1].slice(0, 120), amount: parseFloat(m[2].replace(/,/g, '')) } : { name: l.slice(0, 120) };
    });
  }
  function setWarn(name, on) {
    var f = dlg.querySelector('.field[data-f="' + name + '"]');
    if (!f) return;
    f.classList.toggle('warn', !!on);
    var lab = f.querySelector('label'), b = lab.querySelector('.badge');
    if (on && !b) { b = document.createElement('span'); b.className = 'badge warn'; b.textContent = TR('check'); lab.appendChild(b); }
    if (!on && b) b.remove();
  }
  function clearWarns() { ['store', 'date', 'total'].forEach(function (n) { setWarn(n, false); }); }
  ['store', 'date', 'total'].forEach(function (n) {
    var el = dlg.querySelector('.field[data-f="' + n + '"] :is(input,select)');
    el.addEventListener('input', function () { setWarn(n, false); });
  });

  function showSource(src) {
    var b = $('srcBadge');
    b.hidden = !src;
    b.textContent = src === 'claude' ? 'Claude' : src === 'free' ? TR('free') : '';
    b.className = 'badge' + (src === 'claude' ? ' accent' : '');
    b.setAttribute('data-src', src || '');
    $('readRow').hidden = !src && !$('readMsg').textContent;
  }
  function setReadMsg(t) {
    $('readMsg').textContent = t || '';
    $('readRow').hidden = !t && $('srcBadge').hidden;
  }
  function updateClaudeBtn() {
    var b = $('claudeBtn');
    b.hidden = !aiAvailable();
    b.disabled = !(S && (S.imgBlob || S.pdfClaude)) || (S && S.reading);
  }
  function updateEnd() {
    var end = C.warrantyEnd({ date: $('fDate').value, warrantyMonths: Number($('fMonths').value) });
    $('fEnd').value = end ? dateTh(end) : '';
  }
  $('fDate').addEventListener('input', updateEnd);
  $('fMonths').addEventListener('input', updateEnd);

  function fillCats(sel) {
    var cats = budgetCats();
    $('fCat').innerHTML = cats.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(catName(c)) + '</option>'; }).join('');
    var pick = sel && cats.some(function (c) { return c.id === sel; }) ? sel : (cats.filter(function (c) { return c.id === 'cat-shopping'; })[0] || cats[0]).id;
    $('fCat').value = pick;
  }

  function renderFiles() {
    var files = (S && S.rec.files) || [];
    $('fileList').innerHTML = files.map(function (f) {
      return '<div class="file-row" data-fid="' + esc(f.id) + '">' + icon(/^image\//.test(f.mime) ? 'image' : 'file-text') +
        '<a href="/api/files?id=' + encodeURIComponent(f.id) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' +
        '<span class="sz">' + num(f.size / 1024) + ' KB</span>' +
        '<button class="btn sm icon ghost" type="button" data-rm="' + esc(f.id) + '" aria-label="' + esc(TR('rmFile')) + '">' + icon('x') + '</button></div>';
    }).join('');
  }
  function updateBudgetBtn() {
    var b = $('budgetBtn'), done = !!(S && S.rec.budgetId);
    b.disabled = done;
    b.innerHTML = done ? icon('check') + esc(TR('sentDone')) : esc(TR('toBudget'));
  }

  function openDialog(r) {
    var isNew = !r;
    S = {
      isNew: isNew, added: [], removed: [], token: 0, imgBlob: null, reading: false, autoRead: isNew, busy: false,
      rec: r ? JSON.parse(JSON.stringify(r)) : { id: newId(), taxTag: 'none', files: [], items: [], createdAt: Date.now() }
    };
    var rec = S.rec;
    if (!Array.isArray(rec.files)) rec.files = [];
    $('dlgTitle').textContent = isNew ? TR('addTitle') : TR('editTitle');
    $('fStore').value = rec.store || '';
    $('fDate').value = rec.date || '';
    $('fTotal').value = rec.total || '';
    $('fVat').value = rec.vat || '';
    $('fTaxId').value = rec.taxId || '';
    $('fFull').checked = !!rec.fullInvoice;
    $('fItems').value = itemsToText(rec.items);
    $('fProduct').value = rec.warrantyProduct || '';
    $('fMonths').value = rec.warrantyMonths || '';
    $('fTag2').value = rec.taxTag || 'none';
    $('fNote').value = rec.note || '';
    fillCats(rec.categoryId);
    $('delBtn').hidden = isNew;
    $('msg').textContent = '';
    clearWarns();
    setReadMsg('');
    showSource(isNew ? '' : rec.source || '');
    updateEnd();
    renderFiles();
    updateBudgetBtn();
    updateClaudeBtn();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function closeDialog() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }

  /* ── ไฟล์: ย่อรูป → ส่ง R2 ── */
  function api(method, qs, opts) {
    return fetch('/api/files?' + qs, Object.assign({ method: method, credentials: 'same-origin' }, opts || {}));
  }
  function deleteRemote(ids) {
    return Promise.all(ids.map(function (id) { return api('DELETE', 'id=' + encodeURIComponent(id)).catch(function () {}); }));
  }
  var MIME_BY_EXT = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif' };
  function mimeOf(f) {
    if (f.type) return f.type;
    var m = /\.([a-z0-9]+)$/i.exec(f.name || '');
    return (m && MIME_BY_EXT[m[1].toLowerCase()]) || '';
  }
  function shrinkImage(file) { // ด้านยาว ≤ 1600px, JPEG 0.8 (แปลง HEIC/PNG ไปด้วย) สำหรับเก็บใน R2 — ตัวย่อกลางอยู่ใน ocr-vision.js (TanotOcr.shrinkImage)
    return window.TanotOcr.shrinkImage(file, { maxSide: 1600, quality: 0.8 });
  }
  function upload(blob, name, mime, st) {
    return api('POST', 'ns=receipts&ref=' + encodeURIComponent(st.rec.id) + '&name=' + encodeURIComponent(name), { headers: { 'Content-Type': mime }, body: blob })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.error || TR('uploadFailCode', { s: r.status }));
          return j;
        });
      });
  }
  function jpgName(name) { return String(name || 'receipt').replace(/\.[a-z0-9]+$/i, '') + '.jpg'; }

  /* ── อ่านใบเสร็จ ── */
  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url; s.onload = resolve; s.onerror = function () { reject(new Error('โหลดตัวอ่านไม่ได้')); };
      document.head.appendChild(s);
    });
  }
  var tessP = null;
  function loadTesseract() { // โหลดตอนอ่านครั้งแรกเท่านั้น
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!tessP) tessP = loadScript(TESSERACT_URL).then(function () { return window.Tesseract; }, function (e) { tessP = null; throw e; });
    return tessP;
  }
  function ocrFree(blob) {
    return loadTesseract().then(function (T) {
      if (!T) throw new Error('ไม่มี Tesseract');
      return T.recognize(blob, 'tha+eng');
    }).then(function (r) { return String((r && r.data && r.data.text) || ''); }, function (e) {
      /* บันทึกปัญหา (data.html) — เฉพาะข้อมูลเครื่อง/ขนาดภาพ ไม่เก็บภาพหรือข้อความในใบเสร็จ */
      if (window.TanotMedia) TanotMedia.logError('ocr', e, { stage: 'tesseract', engine: 'local', model: 'tesseract tha+eng', file: { type: blob && blob.type, size: blob && blob.size } });
      throw e;
    });
  }
  function pdfRead(file) { // ข้อความจากเลเยอร์ข้อความของหน้าแรก (ถ้ามี) + ภาพหน้าแรก (ให้ OCR/Claude ใช้)
    return import(PDFJS_URL).then(function (m) {
      m.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return file.arrayBuffer().then(function (buf) { return m.getDocument({ data: buf }).promise; });
    }).then(function (doc) {
      return doc.getPage(1).then(function (page) {
        var v1 = page.getViewport({ scale: 1 }), k = Math.min(2, 1600 / Math.max(v1.width, v1.height));
        var vp = page.getViewport({ scale: k }), cv = document.createElement('canvas');
        cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        return Promise.all([
          page.getTextContent().then(function (tc) { return tc.items.map(function (i) { return i.str + (i.hasEOL ? '\n' : ' '); }).join(''); }),
          page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
            return new Promise(function (resolve) { cv.toBlob(resolve, 'image/jpeg', 0.8); });
          })
        ]).then(function (r) { return { text: r[0], image: r[1], numPages: doc.numPages }; });
      });
    });
  }
  /* แยกช่อง: โมเดลเร็วบน Workers AI (ฟรีในโควตา) → ไม่ได้ก็ regex หายอดรวม/วันที่ — ช่องที่ AI ไม่ตอบเติมด้วย regex */
  function extract(text) {
    var rx = C.regexFields(text);
    if (!aiAvailable() || !String(text).trim()) return Promise.resolve(rx);
    return window.AiClient.chat({ messages: C.aiMessages(text), model: 'fast', maxTokens: 700, temperature: 0.1 }).then(function (r) {
      var f = C.parseFields(r.text);
      if (!f) throw new Error('bad json');
      Object.keys(rx).forEach(function (k) { if (f[k] == null) f[k] = rx[k]; });
      return f;
    }).catch(function () { return rx; });
  }

  var FIELD_INPUT = { store: 'fStore', date: 'fDate', total: 'fTotal', vat: 'fVat', taxId: 'fTaxId' };
  function applyFields(f, overwrite) {
    Object.keys(FIELD_INPUT).forEach(function (k) {
      var el = $(FIELD_INPUT[k]);
      if (f[k] != null && f[k] !== '' && (overwrite || !el.value)) el.value = f[k];
    });
    if (typeof f.fullInvoice === 'boolean' && (overwrite || !$('fFull').checked)) $('fFull').checked = f.fullInvoice;
    if (f.items && f.items.length && (overwrite || !$('fItems').value.trim())) $('fItems').value = itemsToText(f.items);
    updateEnd();
    // ช่องหลักที่ยังว่าง = อ่านไม่ได้ → ไฮไลต์ให้ตรวจ/กรอกเอง (ไม่เรียก Claude เอง)
    ['store', 'date', 'total'].forEach(function (n) { setWarn(n, !$(FIELD_INPUT[n]).value); });
  }

  function startAutoRead(st, text, image) {
    st.imgBlob = image || st.imgBlob;
    updateClaudeBtn();
    if (!st.autoRead) return Promise.resolve();
    st.autoRead = false; st.reading = true; updateClaudeBtn();
    var token = ++st.token;
    setReadMsg(TR('reading'));
    var p = String(text || '').trim().length >= 20 ? Promise.resolve(text) : ocrFree(st.imgBlob);
    return p.then(extract).then(function (f) {
      if (S !== st || token !== st.token) return;
      applyFields(f, false);
      st.rec.source = 'free';
      showSource('free');
      setReadMsg('');
    }).catch(function () {
      if (S !== st || token !== st.token) return;
      setReadMsg(TR('autoFail'));
    }).then(function () { if (S === st) { st.reading = false; updateClaudeBtn(); } });
  }

  /* ปุ่มเดียวที่เรียก Claude (/api/ocr) — ผู้ใช้กดเองเท่านั้น · TanotOcr เปิด dialog รหัสทุกครั้งก่อนส่ง (ยกเลิก = ไม่ส่ง) */
  $('claudeBtn').addEventListener('click', function () {
    var st = S;
    if (!st || !(st.imgBlob || st.pdfClaude) || st.reading) return;
    st.reading = true; updateClaudeBtn();
    var token = ++st.token;
    var job = st.pdfClaude
      ? window.TanotOcr.ocrPdf(st.pdfClaude.file, { numPages: st.pdfClaude.numPages, prompt: C.CLAUDE_PROMPT })
      : window.TanotOcr.ocrImage(st.imgBlob, { prompt: C.CLAUDE_PROMPT, skipShrink: true });
    setReadMsg(TR('claudeReading'));
    job.then(function (r) {
      if (S !== st || token !== st.token) return;
      var f = C.parseFields(r && r.text);
      if (!f) { setReadMsg(TR('claudeBad')); return; }
      applyFields(f, true);
      st.rec.source = 'claude';
      showSource('claude');
      setReadMsg('');
    }).catch(function (e) {
      // ocr-vision.js บันทึกปัญหาให้แล้ว (ไม่เก็บรูป/ข้อความ) · ยกเลิก dialog = เงียบ ไม่ส่งคำขอ
      if (S !== st || token !== st.token) return;
      setReadMsg(window.TanotOcr.isCancel(e) ? '' : window.TanotOcr.errorText(e));
    }).then(function () { if (S === st) { st.reading = false; updateClaudeBtn(); } });
  });

  function handleFile(file, st) {
    var mime = mimeOf(file), isPdf = mime === 'application/pdf';
    if (!isPdf && !/^image\//.test(mime)) { $('msg').textContent = TR('onlyPdf'); return Promise.resolve(); }
    if (isPdf && file.size > MAX_FILE) { $('msg').textContent = TR('tooBig', { name: file.name }); return Promise.resolve(); }
    var prep = isPdf ? Promise.resolve({ blob: file, mime: mime, name: file.name }) :
      shrinkImage(file).then(function (b) { return { blob: b, mime: 'image/jpeg', name: jpgName(file.name) }; }, function () {
        return file.size <= MAX_FILE ? { blob: file, mime: mime, name: file.name } : Promise.reject(new Error(TR('openImg')));
      });
    return prep.then(function (p) {
      var reading = isPdf ? pdfRead(file).then(function (r) {
        // สแกน (หน้าแรกไม่มีข้อความ) และไม่เกินลิมิต 1 คำขอ → Claude ได้ทั้งไฟล์ · ไม่งั้นใช้ภาพหน้าแรกเหมือนเดิม
        st.pdfClaude = String(r.text || '').trim().length < 20 && r.numPages <= window.TanotOcr.LIMITS.PDF_MAX_PAGES ? { file: file, numPages: r.numPages } : null;
        return startAutoRead(st, r.text, r.image);
      }, function () { return startAutoRead(st, '', null); }) :
        startAutoRead(st, '', p.blob);
      if (!isPdf) { st.imgBlob = p.blob; updateClaudeBtn(); }
      var up = !filesAvailable() ? Promise.resolve() : upload(p.blob, p.name, p.mime, st).then(function (j) {
        if (S !== st) { deleteRemote([j.id]); return; } // กล่องปิดไปแล้วระหว่างอัปโหลด
        st.rec.files.push({ id: j.id, name: j.name, size: j.size, mime: j.mime });
        st.added.push(j.id);
        renderFiles();
      }).catch(function (e) { $('msg').textContent = e.message || TR('uploadFail'); });
      return Promise.all([reading, up]);
    }).catch(function (e) { $('msg').textContent = e.message || TR('openFile'); });
  }
  function onPick(input) {
    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if (!files.length || !S) return;
    var st = S;
    $('msg').textContent = '';
    files.reduce(function (chain, f) { return chain.then(function () { return handleFile(f, st); }); }, Promise.resolve());
  }
  $('camBtn').addEventListener('click', function () { $('camInput').click(); });
  $('fileBtn').addEventListener('click', function () { $('fileInput').click(); });
  $('camInput').addEventListener('change', function () { onPick(this); });
  $('fileInput').addEventListener('change', function () { onPick(this); });
  $('fileList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]');
    if (!b || !S) return;
    var id = b.getAttribute('data-rm');
    S.rec.files = S.rec.files.filter(function (f) { return f.id !== id; });
    if (S.added.indexOf(id) !== -1) { S.added = S.added.filter(function (x) { return x !== id; }); deleteRemote([id]); }
    else S.removed.push(id);
    renderFiles();
  });

  /* ── บันทึก / ลบ / ส่งเข้า budget ── */
  function readForm() {
    var r = S.rec, n;
    r.store = $('fStore').value.trim();
    r.date = $('fDate').value || r.date || todayYmd();
    n = Number($('fTotal').value); r.total = n > 0 ? n : 0;
    n = Number($('fVat').value); r.vat = n > 0 ? n : 0;
    r.taxId = $('fTaxId').value.replace(/\D/g, '').slice(0, 13);
    r.fullInvoice = $('fFull').checked;
    r.items = parseItemsText($('fItems').value);
    r.warrantyProduct = $('fProduct').value.trim();
    n = Math.round(Number($('fMonths').value)); r.warrantyMonths = n > 0 ? n : 0;
    r.taxTag = $('fTag2').value;
    r.categoryId = $('fCat').value;
    r.note = $('fNote').value.trim();
    return r;
  }
  function validate(r) {
    if (!r.store && !r.total) return TR('errStore');
    return '';
  }
  function finishSave() {
    var gone = S.removed; S.removed = []; S.added = [];
    closeDialog();
    deleteRemote(gone);
    renderAll();
  }
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var r = readForm(), bad = validate(r);
    if (bad) { $('msg').textContent = bad; return; }
    // budgetId มาจากที่เก็บล่าสุด (อีกเครื่อง/แท็บอาจส่งเข้า budget ไปแล้ว) — ไม่ถือค่าเก่าจากตอนเปิดกล่อง
    var cur = load().filter(function (x) { return x.id === r.id; })[0];
    if (cur && cur.budgetId && !r.budgetId) r.budgetId = cur.budgetId;
    upsert(r);
    finishSave();
  });
  $('budgetBtn').addEventListener('click', function () {
    if (!S || S.busy) return;
    var r = readForm(), bad = validate(r);
    if (!(r.total > 0)) bad = bad || TR('errTotal');
    if (bad) { $('msg').textContent = bad; return; }
    S.busy = true;
    var cur = load().filter(function (x) { return x.id === r.id; })[0];
    var bid = (cur && cur.budgetId) || r.budgetId || 'rcpt-' + r.id; // id ตายตัวต่อใบเสร็จ — กดซ้ำ/2 เครื่องได้แถวเดียว
    r.budgetId = bid;
    upd(REC_KEY, function (list) {
      list = Array.isArray(list) ? list : [];
      if (list.some(function (x) { return x && x.id === bid; })) return undefined;
      list.push({ id: bid, date: r.date, type: 'expense', categoryId: r.categoryId, amount: r.total, note: r.store || TR('receipt') });
      return list;
    });
    upsert(r);
    S.busy = false;
    finishSave();
  });
  $('cancelBtn').addEventListener('click', function () { closeDialog(); });
  dlg.addEventListener('close', function () {
    // ปิดโดยไม่บันทึก (ยกเลิก/Esc) — ไฟล์ที่เพิ่งอัปโหลดในกล่องนี้ไม่มีใครอ้างถึง ลบทิ้งจาก R2
    if (S && S.added.length) deleteRemote(S.added);
    S = null;
  });
  $('delBtn').addEventListener('click', function () {
    var st = S;
    if (!st || st.busy) return;
    st.busy = true;
    window.tanotConfirm(TR('confirmDel'), { danger: true, okLabel: TR('del') }).then(function (ok) {
      st.busy = false;
      if (!ok || S !== st) return; // กล่องถูกปิด/เปิดใบอื่นระหว่างรอยืนยัน
      var id = st.rec.id;
      var orig = load().filter(function (x) { return x.id === id; })[0];
      var ids = ((orig && orig.files) || []).map(function (f) { return f.id; }).concat(st.added);
      st.added = [];
      remove(id);
      closeDialog();
      deleteRemote(ids);
      renderAll();
    });
  });

  /* ── ดูรูปเต็ม ── */
  var viewDlg = $('viewDlg');
  function openView(r) {
    $('viewTitle').textContent = r.store || TR('receipt');
    $('viewBody').innerHTML = (r.files || []).map(function (f) {
      var src = '/api/files?id=' + encodeURIComponent(f.id);
      return /^image\//.test(f.mime) ? '<img src="' + src + '" alt="' + esc(f.name) + '">' :
        '<a class="btn" href="' + src + '" target="_blank" rel="noopener">' + icon('file-text') + esc(f.name) + '</a>';
    }).join('');
    if (typeof viewDlg.showModal === 'function') viewDlg.showModal(); else viewDlg.setAttribute('open', '');
  }
  $('viewClose').addEventListener('click', function () { if (viewDlg.close) viewDlg.close(); else viewDlg.removeAttribute('open'); });

  /* ── ปุ่มในหน้า ── */
  $('addBtn').addEventListener('click', function () { openDialog(null); });
  $('fQ').addEventListener('input', function () { flt.q = this.value; renderList(load()); });
  $('fYear').addEventListener('change', function () { flt.year = this.value; renderList(load()); });
  $('fTag').addEventListener('change', function () { flt.tag = this.value; renderList(load()); });
  $('fWar').addEventListener('click', function () { flt.warranty = !flt.warranty; this.setAttribute('aria-pressed', String(flt.warranty)); renderList(load()); });
  $('listBody').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'), row = e.target.closest('.list-row');
    if (!row) return;
    var r = load().filter(function (x) { return x.id === row.getAttribute('data-id'); })[0];
    if (!r) return;
    if (b && b.getAttribute('data-act') === 'view') openView(r); else openDialog(r);
  });

  writeSummary(load());
  renderAll();
  /* สลับภาษาสด: ข้อความใน HTML แปลโดย i18n.js เอง — วาดส่วนที่ JS สร้างใหม่ (ลิสต์/ตัวกรอง/ตัวเลือกป้ายภาษี/ปุ่มส่งเข้า budget) */
  if (window.OME_LANG) window.OME_LANG.onChange(function () {
    fillTag2(); updateBudgetBtn();
    var cat = $('fCat').value; if (S) { fillCats(cat); }
    if (!dlg.open) $('dlgTitle').textContent = TR('receipt');
    $('fYear').setAttribute('data-sig', '');
    renderAll();
  });
  if (TD && TD.onChange) TD.onChange(function () { if (!dlg.open) renderAll(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !dlg.open) renderAll(); });
})();
