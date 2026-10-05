/* ══════════════════════════════════════════════════════════════════
   Tanot — เปรียบเทียบข้อมูล (compare.html) · ส่วนแสดงผล
   ตรรกะ (diff ตาราง/ข้อความ, คะแนนใบเสนอราคา) อยู่ใน compare-calc.js (window.CompareCalc) — ไฟล์นี้อ่านไฟล์ + วาดหน้า + เก็บงานใบเสนอราคา
   แท็บ 1–2: ไฟล์ประมวลผลในเบราว์เซอร์เท่านั้น ไม่อัปโหลด ไม่เก็บ ไม่ซิงก์ (อยู่ในหน่วยความจำของหน้า)
   แท็บ 3: tanot:compare:quotes (sync list, idField id — 1 งาน = 1 แถว) · ไฟล์แนบ R2 ผ่าน /api/files?ns=compare (เฉพาะ *.pages.dev)
   SheetJS: โหลดแบบ lazy จาก CDN ตอนเลือกไฟล์ตาราง/ส่งออกครั้งแรก — ใช้ xlsx-js-style (ฟอร์กของ SheetJS 0.18.5 ที่เขียนสีเซลล์ได้) แทนตัวมาตรฐาน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  window.TANOT_NO_RELOAD_BAR = true; // วาดใหม่เองเมื่อ TanotData.onChange — ห้ามรีเซ็ตช่องที่กำลังกรอก

  var CC = window.CompareCalc;
  var TD = window.TanotData;
  var K = { quotes: 'tanot:compare:quotes', ui: 'tanot:compare:ui' };
  var XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'; // MIT
  var MAMMOTH_URL = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
  var PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs';
  var PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';
  var PAGE = 50;          // แถวผลลัพธ์ตารางต่อหน้า
  var HUNKS_PER_PAGE = 40; // จุดที่ต่างของ diff ข้อความต่อหน้า
  var CTX = 3;            // บรรทัดที่เหมือนกันที่แสดงรอบจุดที่ต่าง
  var MAX_FILE = 15 * 1024 * 1024;

  function $(id) { return document.getElementById(id); }

  var T = OME_I18N.scope('cp', {
    th: {
      title: 'เปรียบเทียบข้อมูล | Tanot', crumb: 'งานที่รับผิดชอบ', h1: 'เปรียบเทียบข้อมูล', tabTable: 'เทียบตาราง', tabText: 'เทียบเอกสาร', tabQuotes: 'ให้คะแนนใบเสนอราคา',
      fileA: 'ไฟล์ A', fileB: 'ไฟล์ B', pickA: 'เลือกไฟล์ A (.xlsx .xls .csv)', pickB: 'เลือกไฟล์ B (.xlsx .xls .csv)', sheet: 'ชีต', hdrRow: 'แถวหัวตาราง', columns: 'คอลัมน์',
      thKey: 'คีย์หลัก', thColA: 'คอลัมน์ใน A', thMatchB: 'จับคู่กับคอลัมน์ใน B', thSkip: 'ไม่เทียบ', optCase: 'ไม่สนตัวพิมพ์ใหญ่เล็ก', optTrim: 'ตัดช่องว่างหัวท้าย',
      optTol: 'ตัวเลขคลาดเคลื่อนได้ ±', run: 'เทียบ', groupLabel: 'กลุ่มผลลัพธ์', exportXlsx: 'ส่งออก .xlsx', textA: 'ข้อความ A', textB: 'ข้อความ B', chooseFile: 'เลือกไฟล์', clear: 'ล้าง',
      optSpace: 'ไม่สนช่องว่าง', viewLabel: 'มุมมอง', viewSplit: 'ซ้าย-ขวา', viewUnified: 'รวม', prev: 'ก่อนหน้า', next: 'ถัดไป',
      jobSel: 'งานเปรียบเทียบราคา', jobName: 'ชื่องาน', jobNew: 'งานใหม่', jobDel: 'ลบงาน', criteria: 'เกณฑ์ให้คะแนน', critAdd: 'เพิ่มเกณฑ์', bidders: 'ผู้เสนอราคา', bidAdd: 'เพิ่มผู้เสนอราคา', ranking: 'ผลจัดอันดับ',
      needNet: 'ต้องต่อเน็ตเพื่ออ่าน/เขียนไฟล์ (โหลดไลบรารีไม่สำเร็จ)', colN: 'คอลัมน์ {n}', rows: 'แถว', cols: 'คอลัมน์',
      sideInfo: '{name} · {r} แถว · {c} คอลัมน์', tooBig100: '{name} ใหญ่เกิน 100 MB', readFail: 'อ่านไฟล์ {name} ไม่สำเร็จ', noMatch: '— ไม่จับคู่ —',
      keyAria: 'คีย์หลัก {name}', colBAria: 'คอลัมน์ใน B ของ {name}', skipAria: 'ไม่เทียบ {name}', onlyA: 'มีเฉพาะ A', onlyB: 'มีเฉพาะ B', rowsBoth: '{a} ↔ {b} แถว',
      noKey: 'เลือกคอลัมน์หลักอย่างน้อย 1 คอลัมน์', diffFail: 'เทียบไม่สำเร็จ: {msg}',
      added: 'เพิ่ม', removed: 'หาย', changed: 'เปลี่ยน', same: 'เหมือน', dups: 'คีย์ซ้ำ', dupWarn: 'คีย์ซ้ำในไฟล์เดียวกัน — A {a} · B {b}', blankWarn: 'ข้ามแถวที่คีย์ว่าง — A {a} · B {b}',
      rowInB: 'แถวใน B', rowInA: 'แถวใน A', fileCol: 'ไฟล์', keyCol: 'คีย์', rowCol: 'แถว', empty: '(ว่าง)', noItems: 'ไม่มีรายการ', pageOf: '{from}–{to} จาก {total}', itemsN: '{n} รายการ',
      tooBigText: '{name} ใหญ่เกินไป', reading: 'กำลังอ่าน {name}…', noReader: 'โหลดตัวอ่านไฟล์ไม่สำเร็จ', readFailGeneric: 'อ่านไฟล์ไม่สำเร็จ', charsInfo: '{name} · {n} ตัวอักษร',
      stSame: 'เหมือน {n}', stChg: 'แก้ไข {n}', stDel: 'ลบ {n}', stAdd: 'เพิ่ม {n}', approx: 'ต่างกันมาก — แสดงแบบหยาบ', foldMore: '⋯ แสดง {n} บรรทัดที่เหมือนกัน', noText: 'ไม่มีข้อความ',
      noHunk: 'ไม่มีจุดที่ต่าง', hunksN: 'ต่างกัน {n} จุด', hunkAt: 'จุดที่ {i} / {n}', pageN: 'หน้า {i} / {n}',
      jobDefault: 'งานเปรียบเทียบราคา', jobN: 'งานเปรียบเทียบราคา {n}', noJobs: '— ยังไม่มีงาน —', wTotal: 'น้ำหนักรวม {n}%', wMust: ' (ต้องเท่ากับ 100)',
      critName: 'ชื่อเกณฑ์', critWeight: 'น้ำหนัก %', critAuto: 'คะแนนจากราคา', critRm: 'ลบเกณฑ์', rmFile: 'เอาไฟล์ออก', noBidders: 'ยังไม่มีผู้เสนอราคา', critFallback: 'เกณฑ์',
      bidName: 'ชื่อผู้เสนอราคา', bidRm: 'ลบผู้เสนอราคา', price: 'ราคา (บาท)', delivery: 'ระยะส่งมอบ', warranty: 'รับประกัน', payment: 'เงื่อนไขชำระ', note: 'หมายเหตุ', attach: 'แนบไฟล์',
      priceCrit: 'ราคา', wFix: 'น้ำหนักรวม {n}% — ปรับให้เท่ากับ 100%', thRank: 'อันดับ', thBidder: 'ผู้เสนอราคา', thPrice: 'ราคา', thTotal: 'คะแนนรวม', noName: '(ไม่มีชื่อ)', noNameShort: 'ไม่มีชื่อ',
      onlyPdfImg: 'รองรับเฉพาะ PDF และรูปภาพ', tooBig15: '{name} ใหญ่เกิน 15 MB', uploadFailN: 'อัปโหลดไม่สำเร็จ ({n})', uploadFail: 'อัปโหลดไม่สำเร็จ',
      delJob: 'ลบงาน "{name}" และไฟล์แนบทั้งหมด?', delBid: 'ลบผู้เสนอราคา "{name}"?', del: 'ลบ',
      c_price: 'ราคา', c_delivery: 'ส่งมอบ', c_warranty: 'รับประกัน', c_tech: 'คุณสมบัติทางเทคนิค'
    },
    en: {
      title: 'Compare data | Tanot', crumb: 'Work', h1: 'Compare data', tabTable: 'Compare tables', tabText: 'Compare documents', tabQuotes: 'Score quotations',
      fileA: 'File A', fileB: 'File B', pickA: 'Choose file A (.xlsx .xls .csv)', pickB: 'Choose file B (.xlsx .xls .csv)', sheet: 'Sheet', hdrRow: 'Header row', columns: 'Columns',
      thKey: 'Key', thColA: 'Column in A', thMatchB: 'Match to column in B', thSkip: 'Skip', optCase: 'Ignore case', optTrim: 'Trim spaces',
      optTol: 'Numeric tolerance ±', run: 'Compare', groupLabel: 'Result group', exportXlsx: 'Export .xlsx', textA: 'Text A', textB: 'Text B', chooseFile: 'Choose file', clear: 'Clear',
      optSpace: 'Ignore whitespace', viewLabel: 'View', viewSplit: 'Side by side', viewUnified: 'Unified', prev: 'Previous', next: 'Next',
      jobSel: 'Price comparison job', jobName: 'Job name', jobNew: 'New job', jobDel: 'Delete job', criteria: 'Scoring criteria', critAdd: 'Add criterion', bidders: 'Bidders', bidAdd: 'Add bidder', ranking: 'Ranking',
      needNet: 'An internet connection is needed to read/write files (library failed to load)', colN: 'Column {n}', rows: 'rows', cols: 'columns',
      sideInfo: '{name} · {r} rows · {c} columns', tooBig100: '{name} is larger than 100 MB', readFail: 'Could not read {name}', noMatch: '— No match —',
      keyAria: 'Key {name}', colBAria: 'Column in B for {name}', skipAria: 'Skip {name}', onlyA: 'Only in A', onlyB: 'Only in B', rowsBoth: '{a} ↔ {b} rows',
      noKey: 'Choose at least 1 key column', diffFail: 'Comparison failed: {msg}',
      added: 'Added', removed: 'Removed', changed: 'Changed', same: 'Same', dups: 'Duplicate keys', dupWarn: 'Duplicate keys within one file — A {a} · B {b}', blankWarn: 'Skipped rows with blank key — A {a} · B {b}',
      rowInB: 'Row in B', rowInA: 'Row in A', fileCol: 'File', keyCol: 'Key', rowCol: 'Rows', empty: '(blank)', noItems: 'No items', pageOf: '{from}–{to} of {total}', itemsN: '{n} items',
      tooBigText: '{name} is too large', reading: 'Reading {name}…', noReader: 'Could not load the file reader', readFailGeneric: 'Could not read the file', charsInfo: '{name} · {n} characters',
      stSame: 'Same {n}', stChg: 'Changed {n}', stDel: 'Removed {n}', stAdd: 'Added {n}', approx: 'Very different — shown roughly', foldMore: '⋯ Show {n} identical lines', noText: 'No text',
      noHunk: 'No differences', hunksN: '{n} differences', hunkAt: 'Difference {i} / {n}', pageN: 'Page {i} / {n}',
      jobDefault: 'Price comparison', jobN: 'Price comparison {n}', noJobs: '— No jobs yet —', wTotal: 'Total weight {n}%', wMust: ' (must equal 100)',
      critName: 'Criterion name', critWeight: 'Weight %', critAuto: 'Score from price', critRm: 'Remove criterion', rmFile: 'Remove file', noBidders: 'No bidders yet', critFallback: 'Criterion',
      bidName: 'Bidder name', bidRm: 'Remove bidder', price: 'Price (THB)', delivery: 'Delivery time', warranty: 'Warranty', payment: 'Payment terms', note: 'Notes', attach: 'Attach file',
      priceCrit: 'Price', wFix: 'Total weight {n}% — adjust to equal 100%', thRank: 'Rank', thBidder: 'Bidder', thPrice: 'Price', thTotal: 'Total score', noName: '(no name)', noNameShort: 'Unnamed',
      onlyPdfImg: 'Only PDF and images are supported', tooBig15: '{name} is larger than 15 MB', uploadFailN: 'Upload failed ({n})', uploadFail: 'Upload failed',
      delJob: 'Delete job "{name}" and all attachments?', delBid: 'Delete bidder "{name}"?', del: 'Delete',
      c_price: 'Price', c_delivery: 'Delivery', c_warranty: 'Warranty', c_tech: 'Technical specs'
    }
  });
  /* ข้อความสถานะใต้ฟอร์ม: ส่งฟังก์ชัน (วาดซ้ำเมื่อสลับภาษา) หรือข้อความดิบ — id = tMsg|xMsg|qMsg */
  function msg(id, v) { var el = $(id); OME_I18N.live(el, typeof v === 'function' ? v : null); if (typeof v !== 'function') el.textContent = v || ''; }
  function needNet() { return T('needNet'); }
  function colLabel(c) { return T('colN', { n: colLetter(c) }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function nf(n, d) { return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d }); }
  function fx(n) { return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function filesAvailable() { return /\.pages\.dev$/.test(location.hostname) || !!(window.TANOT_FILES && window.TANOT_FILES.enabled); }
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function colLetter(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function cellText(v) { var x = CC.toCell(v); return x == null ? '' : String(x); }
  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function safeName(s) { return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim().slice(0, 60) || 'file'; }

  /* ── โหลดสคริปต์/ไลบรารีเมื่อใช้งานจริง ── */
  var loading = {};
  function loadScript(url, ready) {
    if (ready()) return Promise.resolve();
    if (!loading[url]) {
      loading[url] = new Promise(function (resolve, reject) {
        var el = document.createElement('script');
        el.src = url;
        el.onload = function () { ready() ? resolve() : reject(new Error('lib')); };
        el.onerror = function () { delete loading[url]; reject(new Error('offline')); };
        document.head.appendChild(el);
      });
    }
    return loading[url];
  }
  function loadXlsx() { return loadScript(XLSX_URL, function () { return window.XLSX && window.XLSX.style_version; }).then(function () { return window.XLSX; }); }

  /* ── ค่าที่จำไว้ต่อเครื่อง (แท็บ/งานที่เปิดอยู่) ── */
  var ui = { tab: 'table', jobId: '' };
  try { var u = JSON.parse(localStorage.getItem(K.ui)); if (u && typeof u === 'object') ui = { tab: u.tab || 'table', jobId: u.jobId || '' }; } catch (e) {}
  function saveUi() { try { localStorage.setItem(K.ui, JSON.stringify(ui)); } catch (e) {} }

  /* ══════════ แท็บ ══════════ */
  var TABS = ['table', 'text', 'quotes'];
  function setTab(t, keep) {
    if (TABS.indexOf(t) === -1) t = 'table';
    ui.tab = t; if (!keep) saveUi();
    Array.prototype.forEach.call(document.querySelectorAll('#tabs .tab'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === t)); });
    TABS.forEach(function (x) { $('tab-' + x).hidden = x !== t; });
    if (t === 'quotes') renderQuotes();
  }
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('.tab');
    if (b) setTab(b.getAttribute('data-tab'));
  });

  /* ══════════ 1. เทียบตาราง ══════════ */
  var sides = { A: newSide(), B: newSide() };
  function newSide() { return { name: '', wb: null, sheet: '', hdr: 1, table: null, off: 2 }; }
  var tst = { cfg: null, res: null, group: 'changed', page: 0, cols: [] };

  function buildTable(X, side) {
    var ws = side.wb.Sheets[side.sheet];
    var aoa = X.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true, raw: true });
    var hdr = Math.max(1, Math.floor(+side.hdr) || 1), headRow = aoa[hdr - 1] || [], width = headRow.length, r, c;
    for (r = hdr; r < aoa.length; r++) if (aoa[r] && aoa[r].length > width) width = aoa[r].length;
    var seen = {}, headers = [];
    for (c = 0; c < width; c++) {
      var h = CC.toCell(headRow[c]), name = h == null ? colLabel(c) : String(h).trim() || colLabel(c);
      if (seen[name]) { seen[name]++; name += ' (' + seen[name] + ')'; } else seen[name] = 1;
      headers.push(name);
    }
    var rows = new Array(Math.max(0, aoa.length - hdr)), last = -1;
    for (r = hdr; r < aoa.length; r++) {
      var src = aoa[r] || [], row = new Array(width), any = false;
      for (c = 0; c < width; c++) { var v = CC.toCell(src[c]); row[c] = v; if (v != null) any = true; }
      rows[r - hdr] = row;
      if (any) last = r - hdr;
    }
    rows.length = last + 1; // ตัดแถวว่างท้ายตารางที่ Excel มักเก็บไว้
    side.table = { headers: headers, rows: rows };
    side.off = hdr + 1;
  }

  function sideInfo(k) {
    var s = sides[k], el = $('info' + k);
    OME_I18N.live(el, s.table ? function () { return T('sideInfo', { name: s.name, r: nf(s.table.rows.length), c: nf(s.table.headers.length) }); } : null);
    if (!s.table) el.textContent = '';
  }

  function resetResult() { tst.res = null; $('resBox').hidden = true; }

  function readSide(k, file) {
    msg('tMsg', '');
    if (file.size > 100 * 1024 * 1024) { msg('tMsg', function () { return T('tooBig100', { name: file.name }); }); return; }
    var csv = /\.csv$/i.test(file.name);
    return loadXlsx().then(function (X) {
      var p = csv
        ? file.text().then(function (t) { return X.read(t, { type: 'string', raw: true, dense: true }); })
        : file.arrayBuffer().then(function (b) { return X.read(b, { type: 'array', cellDates: true, dense: true }); });
      return p.then(function (wb) {
        var s = sides[k];
        s.name = file.name; s.wb = wb; s.sheet = wb.SheetNames[0]; s.hdr = 1;
        $('hdr' + k).value = 1;
        var sel = $('sheet' + k);
        sel.innerHTML = wb.SheetNames.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
        sel.disabled = wb.SheetNames.length < 2; $('hdr' + k).disabled = false;
        $('drop' + k + 'Main').removeAttribute('data-i18n'); $('drop' + k + 'Main').textContent = file.name;
        buildTable(X, s); sideInfo(k); refreshMapping();
      });
    }).catch(function (e) {
      msg('tMsg', e && (e.message === 'offline' || e.message === 'lib') ? needNet : function () { return T('readFail', { name: file.name }); });
    });
  }

  function rebuildSide(k) {
    var s = sides[k];
    if (!s.wb) return;
    loadXlsx().then(function (X) { buildTable(X, s); sideInfo(k); refreshMapping(); }).catch(function () { msg('tMsg', needNet); });
  }

  ['A', 'B'].forEach(function (k) {
    var drop = $('drop' + k), input = $('file' + k);
    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.classList.remove('over');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readSide(k, f);
    });
    input.addEventListener('change', function () { var f = input.files && input.files[0]; input.value = ''; if (f) readSide(k, f); });
    $('sheet' + k).addEventListener('change', function () { sides[k].sheet = this.value; rebuildSide(k); });
    $('hdr' + k).addEventListener('change', function () { sides[k].hdr = Math.max(1, Math.floor(+this.value) || 1); this.value = sides[k].hdr; rebuildSide(k); });
  });

  /* ── จับคู่คอลัมน์ ── */
  function uniqueInA(ai) { // คอลัมน์นี้ใน A ไม่ว่างและไม่ซ้ำเลยหรือไม่ (ใช้เดาคีย์เริ่มต้น)
    var seen = Object.create(null), rows = sides.A.table.rows;
    for (var r = 0; r < rows.length; r++) {
      var v = rows[r][ai];
      if (v == null || String(v).trim() === '') return false;
      var key = String(v).trim().toLowerCase();
      if (seen[key]) return false;
      seen[key] = 1;
    }
    return rows.length > 0;
  }

  function refreshMapping() {
    resetResult();
    var A = sides.A.table, B = sides.B.table;
    if (!A || !B) { $('mapCard').hidden = true; return; }
    var map = CC.suggestMapping(A.headers, B.headers), keys = [];
    for (var i = 0; i < map.length && !keys.length; i++) if (map[i].b != null && uniqueInA(map[i].a)) keys.push(i);
    tst.cfg = { map: map, keys: keys, skip: [] };
    $('mapCard').hidden = false;
    renderMapping();
  }

  function renderMapping() {
    var cfg = tst.cfg, B = sides.B.table, A = sides.A.table;
    $('mapBody').innerHTML = cfg.map.map(function (m, i) {
      var opts = '<option value="">' + T('noMatch') + '</option>' + B.headers.map(function (h, j) { return '<option value="' + j + '"' + (m.b === j ? ' selected' : '') + '>' + esc(h) + '</option>'; }).join('');
      var dis = m.b == null ? ' disabled' : '';
      return '<tr><td><input type="checkbox" data-key="' + i + '" aria-label="' + esc(T('keyAria', { name: m.name })) + '"' + (cfg.keys.indexOf(i) !== -1 ? ' checked' : '') + dis + '></td>' +
        '<td' + (m.b == null ? ' class="dim"' : '') + '>' + esc(m.name) + '</td>' +
        '<td><select class="select" data-b="' + i + '" aria-label="' + esc(T('colBAria', { name: m.name })) + '">' + opts + '</select></td>' +
        '<td><input type="checkbox" data-skip="' + i + '" aria-label="' + esc(T('skipAria', { name: m.name })) + '"' + (cfg.skip.indexOf(i) !== -1 ? ' checked' : '') + dis + '></td></tr>';
    }).join('');
    var usedB = {}; cfg.map.forEach(function (m) { if (m.b != null) usedB[m.b] = true; });
    var onlyA = cfg.map.filter(function (m) { return m.b == null; }).map(function (m) { return m.name; });
    var onlyB = B.headers.filter(function (h, j) { return !usedB[j]; });
    var badge = function (label, list) { return list.length ? '<span class="badge warn wrap" title="' + esc(list.join(', ')) + '">' + esc(label) + ' ' + nf(list.length) + '</span>' : ''; };
    $('mapBadges').innerHTML = badge(T('onlyA'), onlyA) + badge(T('onlyB'), onlyB) + '<span class="badge">' + T('rowsBoth', { a: nf(A.rows.length), b: nf(B.rows.length) }) + '</span>';
    $('runTable').disabled = !cfg.keys.length;
  }

  $('mapBody').addEventListener('change', function (e) {
    var t = e.target, cfg = tst.cfg, i;
    if (t.hasAttribute('data-key')) {
      i = +t.getAttribute('data-key');
      cfg.keys = cfg.keys.filter(function (x) { return x !== i; });
      if (t.checked) { cfg.keys.push(i); cfg.skip = cfg.skip.filter(function (x) { return x !== i; }); }
      resetResult(); renderMapping();
    } else if (t.hasAttribute('data-skip')) {
      i = +t.getAttribute('data-skip');
      cfg.skip = cfg.skip.filter(function (x) { return x !== i; });
      if (t.checked) { cfg.skip.push(i); cfg.keys = cfg.keys.filter(function (x) { return x !== i; }); }
      resetResult(); renderMapping();
    } else if (t.hasAttribute('data-b')) {
      i = +t.getAttribute('data-b');
      var b = t.value === '' ? null : +t.value;
      if (b != null) cfg.map.forEach(function (m, j) { if (j !== i && m.b === b) { m.b = null; cfg.keys = cfg.keys.filter(function (x) { return x !== j; }); cfg.skip = cfg.skip.filter(function (x) { return x !== j; }); } });
      cfg.map[i].b = b;
      if (b == null) { cfg.keys = cfg.keys.filter(function (x) { return x !== i; }); cfg.skip = cfg.skip.filter(function (x) { return x !== i; }); }
      resetResult(); renderMapping();
    }
  });
  ['optCase', 'optTrim', 'optTol'].forEach(function (id) { $(id).addEventListener('change', resetResult); });

  function tableCfg() {
    var tol = parseFloat($('optTol').value);
    return { map: tst.cfg.map, keys: tst.cfg.keys, skip: tst.cfg.skip, ignoreCase: $('optCase').checked, trim: $('optTrim').checked, tol: isFinite(tol) && tol > 0 ? tol : 0, offA: sides.A.off, offB: sides.B.off };
  }

  $('runTable').addEventListener('click', function () {
    var btn = this;
    msg('tMsg', '');
    btn.disabled = true;
    setTimeout(function () { // ให้ปุ่ม/หน้าวาดสถานะก่อน (ไฟล์หลายหมื่นแถว)
      try {
        tst.runCfg = tableCfg();
        tst.res = CC.diffTables(sides.A.table, sides.B.table, tst.runCfg);
        tst.cols = tst.runCfg.map.map(function (m, i) { return i; }).filter(function (i) { var m = tst.runCfg.map[i]; return m.a != null && m.b != null; });
        var r = tst.res;
        tst.group = r.changed.length ? 'changed' : r.added.length ? 'added' : r.removed.length ? 'removed' : (r.dupA.length + r.dupB.length) ? 'dups' : 'changed';
        tst.page = 0;
        renderResult();
      } catch (e) { msg('tMsg', e.message === 'no-key' ? function () { return T('noKey'); } : function () { return T('diffFail', { msg: e.message }); }); }
      btn.disabled = !tst.cfg.keys.length;
    }, 20);
  });

  function groupItems(g) {
    var r = tst.res;
    if (g === 'dups') {
      var out = [];
      r.dupA.forEach(function (d) { out.push({ file: 'A', key: d.key, rows: d.rows, off: tst.runCfg.offA }); });
      r.dupB.forEach(function (d) { out.push({ file: 'B', key: d.key, rows: d.rows, off: tst.runCfg.offB }); });
      return out;
    }
    return r[g];
  }

  function renderResult() {
    var r = tst.res;
    $('resBox').hidden = false;
    var kpi = function (label, val, cls) { return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value ' + (cls || '') + '">' + nf(val) + '</div></div>'; };
    $('kpis').innerHTML = kpi(T('added'), r.added.length, 'up') + kpi(T('removed'), r.removed.length, 'dn') + kpi(T('changed'), r.changed.length) + kpi(T('same'), r.same);
    var warn = [];
    if (r.dupA.length || r.dupB.length) warn.push(T('dupWarn', { a: nf(r.dupA.length), b: nf(r.dupB.length) }));
    if (r.blankA || r.blankB) warn.push(T('blankWarn', { a: nf(r.blankA), b: nf(r.blankB) }));
    $('dupWarn').innerHTML = warn.length ? '<div class="callout warn" role="status">' + icon('triangle-alert') + ' ' + warn.map(esc).join(' · ') + '</div>' : '';
    var segs = [['added', T('added'), r.added.length], ['removed', T('removed'), r.removed.length], ['changed', T('changed'), r.changed.length], ['dups', T('dups'), r.dupA.length + r.dupB.length]];
    $('groupSeg').innerHTML = segs.map(function (s) { return '<button type="button" data-g="' + s[0] + '" aria-pressed="' + (tst.group === s[0]) + '">' + s[1] + ' ' + nf(s[2]) + '</button>'; }).join('');
    renderGroup();
  }

  $('groupSeg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-g]');
    if (!b) return;
    tst.group = b.getAttribute('data-g'); tst.page = 0;
    Array.prototype.forEach.call($('groupSeg').children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    renderGroup();
  });

  function td(v, cls) {
    var t = cellText(v);
    return '<td' + (cls ? ' class="' + cls + '"' : '') + (t.length > 30 ? ' title="' + esc(t) + '"' : '') + '>' + esc(t) + '</td>';
  }
  function renderGroup() {
    var g = tst.group, items = groupItems(g), cfg = tst.runCfg, A = sides.A.table, B = sides.B.table, cols = tst.cols;
    var names = cols.map(function (i) { return '<th>' + esc(cfg.map[i].name) + '</th>'; }).join('');
    var head = g === 'added' ? '<th>' + T('rowInB') + '</th>' + names : g === 'removed' ? '<th>' + T('rowInA') + '</th>' + names : g === 'changed' ? '<th>' + T('rowInA') + '</th><th>' + T('rowInB') + '</th>' + names : '<th>' + T('fileCol') + '</th><th>' + T('keyCol') + '</th><th>' + T('rowCol') + '</th>';
    $('resHead').innerHTML = '<tr>' + head + '</tr>';
    var pages = Math.max(1, Math.ceil(items.length / PAGE));
    tst.page = Math.min(tst.page, pages - 1);
    var from = tst.page * PAGE, slice = items.slice(from, from + PAGE), width = g === 'changed' ? cols.length + 2 : g === 'dups' ? 3 : cols.length + 1;
    $('resBody').innerHTML = slice.length ? slice.map(function (it) {
      if (g === 'added') return '<tr>' + td(it.b + cfg.offB, 'rn') + cols.map(function (i) { return td(B.rows[it.b][cfg.map[i].b]); }).join('') + '</tr>';
      if (g === 'removed') return '<tr>' + td(it.a + cfg.offA, 'rn') + cols.map(function (i) { return td(A.rows[it.a][cfg.map[i].a]); }).join('') + '</tr>';
      if (g === 'changed') {
        var by = {}; it.cells.forEach(function (c) { by[c.m] = c; });
        return '<tr>' + td(it.a + cfg.offA, 'rn') + td(it.b + cfg.offB, 'rn') + cols.map(function (i) {
          var c = by[i];
          if (!c) return td(B.rows[it.b][cfg.map[i].b]);
          return '<td class="chg" title="' + esc(cellText(c.old) + ' → ' + cellText(c.new)) + '"><del>' + esc(cellText(c.old) || T('empty')) + '</del> → <ins>' + esc(cellText(c.new) || T('empty')) + '</ins></td>';
        }).join('') + '</tr>';
      }
      return '<tr>' + td(it.file) + td(it.key.join(' | ')) + td(it.rows.map(function (x) { return x + it.off; }).join(', ')) + '</tr>';
    }).join('') : '<tr><td colspan="' + width + '" style="text-align:center;color:var(--ome-text-2)">' + T('noItems') + '</td></tr>';
    $('pager').innerHTML = items.length > PAGE
      ? '<span>' + T('pageOf', { from: nf(from + 1), to: nf(Math.min(items.length, from + PAGE)), total: nf(items.length) }) + '</span><span class="sp"></span>' +
        '<button class="btn sm" type="button" data-pg="-1"' + (tst.page === 0 ? ' disabled' : '') + '>' + icon('chevron-left') + T('prev') + '</button>' +
        '<button class="btn sm" type="button" data-pg="1"' + (tst.page >= pages - 1 ? ' disabled' : '') + '>' + T('next') + icon('chevron-right') + '</button>'
      : '<span>' + T('itemsN', { n: nf(items.length) }) + '</span>';
  }
  $('pager').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pg]');
    if (!b) return;
    tst.page += +b.getAttribute('data-pg'); renderGroup();
  });

  /* ── ส่งออก .xlsx (สีเซลล์) ── */
  var FILL = { head: 'E7ECF3', added: 'C6EFCE', removed: 'FFC7CE', chg: 'FFEB9C', dups: 'FFEB9C' };
  function fillStyle(rgb, bold) { return { fill: { patternType: 'solid', fgColor: { rgb: rgb } }, font: { bold: !!bold } }; }
  function styledSheet(X, sh) {
    var aoa = [sh.header].concat(sh.rows), ws = X.utils.aoa_to_sheet(aoa), widths = sh.header.map(function (h) { return String(h).length; }), r, c;
    for (r = 0; r < aoa.length; r++) {
      for (c = 0; c < sh.header.length; c++) {
        var addr = X.utils.encode_cell({ r: r, c: c }), cell = ws[addr], v = aoa[r][c];
        if (!cell) cell = ws[addr] = { t: 's', v: '' };
        var len = v == null ? 0 : String(v).length;
        if (len > widths[c]) widths[c] = len;
        if (r === 0) cell.s = fillStyle(FILL.head, true);
        else if (sh.id === 'added' || sh.id === 'removed' || sh.id === 'dups') cell.s = fillStyle(FILL[sh.id]);
        else if (sh.id === 'changed' && sh.marks[r - 1] && sh.marks[r - 1][c] === 'chg') cell.s = fillStyle(FILL.chg, true);
      }
    }
    ws['!cols'] = widths.map(function (w) { return { wch: Math.min(50, Math.max(8, w + 2)) }; });
    if (aoa.length > 1) ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    return ws;
  }
  function writeBook(X, sheets, filename) {
    var wb = X.utils.book_new();
    sheets.forEach(function (sh) { X.utils.book_append_sheet(wb, styledSheet(X, sh), sh.name); });
    var out = X.write(wb, { type: 'array', bookType: 'xlsx' });
    download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
  }
  $('exportTable').addEventListener('click', function () {
    if (!tst.res) return;
    loadXlsx().then(function (X) {
      writeBook(X, CC.exportModel(sides.A.table, sides.B.table, tst.runCfg, tst.res), 'compare_' + today() + '.xlsx');
    }).catch(function () { msg('tMsg', needNet); });
  });

  /* ══════════ 2. เทียบเอกสาร ══════════ */
  var xst = { res: null, view: 'split', blocks: [], pages: [], page: 0, hunk: -1, open: {}, pick: 'A' };

  function ensureReaderLibs(name) {
    var n = name.toLowerCase();
    if (n.endsWith('.docx')) return loadScript(MAMMOTH_URL, function () { return !!window.mammoth; });
    if (n.endsWith('.pdf')) {
      if (window.pdfjsLib) return Promise.resolve();
      return import(PDFJS_URL).then(function (m) { m.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; window.pdfjsLib = m; });
    }
    return Promise.resolve();
  }

  document.querySelector('#tab-text').addEventListener('click', function (e) {
    var p = e.target.closest('[data-pick]'), c = e.target.closest('[data-clear]');
    if (p) { xst.pick = p.getAttribute('data-pick'); $('txtFile').click(); }
    if (c) { var k = c.getAttribute('data-clear'); $('txt' + k).value = ''; OME_I18N.live($('txtInfo' + k), null); $('txtInfo' + k).textContent = ''; xst.res = null; $('diffBox').hidden = true; }
  });
  $('txtFile').addEventListener('change', function () {
    var f = this.files && this.files[0], k = xst.pick;
    this.value = '';
    if (!f) return;
    msg('xMsg', '');
    if (f.size > MAX_FILE * 4) { msg('xMsg', function () { return T('tooBigText', { name: f.name }); }); return; }
    OME_I18N.live($('txtInfo' + k), function () { return T('reading', { name: f.name }); });
    if (!window.TanotFileReader) { msg('xMsg', function () { return T('noReader'); }); return; }
    ensureReaderLibs(f.name).then(function () { return window.TanotFileReader.readAnyFile(f, { ocr: false }); }).then(function (text) {
      $('txt' + k).value = text;
      OME_I18N.live($('txtInfo' + k), function () { return T('charsInfo', { name: f.name, n: nf(text.length) }); });
    }).catch(function (e) {
      OME_I18N.live($('txtInfo' + k), null); $('txtInfo' + k).textContent = '';
      msg('xMsg', e && (e.message === 'offline' || e.message === 'lib') ? needNet : function () { return (e && window.TanotFileReader && TanotFileReader.errorText(e)) || T('readFailGeneric'); });
    });
  });
  ['txtA', 'txtB'].forEach(function (id) { $(id).addEventListener('input', function () { var inf = $('txtInfo' + id.slice(3)); OME_I18N.live(inf, null); inf.textContent = ''; }); });

  $('viewSeg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-view]');
    if (!b) return;
    xst.view = b.getAttribute('data-view');
    Array.prototype.forEach.call($('viewSeg').children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    if (xst.res) renderDiff();
  });

  $('runText').addEventListener('click', function () {
    var btn = this;
    msg('xMsg', '');
    btn.disabled = true;
    setTimeout(function () {
      try {
        var res = xst.res = CC.diffLines($('txtA').value, $('txtB').value, { ignoreSpace: $('optSpace').checked });
        xst.hunk = -1; xst.open = {}; xst.page = 0;
        buildBlocks(res.rows);
        $('diffBox').hidden = false;
        renderDiff();
      } catch (e) { msg('xMsg', function () { return T('diffFail', { msg: e.message }); }); }
      btn.disabled = false;
    }, 20);
  });

  function buildBlocks(rows) {
    var blocks = [], i = 0, j;
    while (i < rows.length) {
      j = i;
      if (rows[i].type === 'eq') { while (j < rows.length && rows[j].type === 'eq') j++; blocks.push({ kind: 'eq', from: i, to: j }); }
      else { var h = rows[i].h; while (j < rows.length && rows[j].type !== 'eq' && rows[j].h === h) j++; blocks.push({ kind: 'hunk', from: i, to: j, h: h }); }
      i = j;
    }
    var pages = [], cur = [], n = 0;
    blocks.forEach(function (b, bi) {
      if (b.kind === 'hunk') { if (n === HUNKS_PER_PAGE) { pages.push(cur); cur = []; n = 0; } n++; }
      cur.push(bi);
    });
    pages.push(cur);
    xst.blocks = blocks; xst.pages = pages;
  }

  function segs(list) { return list.map(function (s) { return s.c ? '<mark>' + esc(s.t) + '</mark>' : esc(s.t); }).join(''); }
  function plain(t) { return esc(t) || '&nbsp;'; }
  function rowHtml(r) {
    var h = r.h >= 0 ? ' data-h="' + r.h + '"' : '', split = xst.view === 'split';
    if (split) {
      if (r.type === 'eq') return '<tr><td class="ln">' + r.a + '</td><td>' + plain(r.ta) + '</td><td class="mid"></td><td class="ln">' + r.b + '</td><td>' + plain(r.tb) + '</td></tr>';
      var l = r.type === 'chg' ? segs(r.wa) : plain(r.ta), rr = r.type === 'chg' ? segs(r.wb) : plain(r.tb);
      return '<tr' + h + '><td class="ln">' + (r.a || '') + '</td>' + (r.type === 'add' ? '<td></td>' : '<td class="del">' + l + '</td>') + '<td class="mid"></td>' +
        '<td class="ln">' + (r.b || '') + '</td>' + (r.type === 'del' ? '<td></td>' : '<td class="add">' + rr + '</td>') + '</tr>';
    }
    if (r.type === 'eq') return '<tr><td class="ln">' + r.a + '</td><td class="ln">' + r.b + '</td><td class="sg"></td><td>' + plain(r.ta) + '</td></tr>';
    var out = '';
    if (r.type !== 'add') out += '<tr' + h + '><td class="ln">' + r.a + '</td><td class="ln"></td><td class="sg">−</td><td class="del">' + (r.type === 'chg' ? segs(r.wa) : plain(r.ta)) + '</td></tr>';
    if (r.type !== 'del') out += '<tr' + h + '><td class="ln"></td><td class="ln">' + r.b + '</td><td class="sg">+</td><td class="add">' + (r.type === 'chg' ? segs(r.wb) : plain(r.tb)) + '</td></tr>';
    return out;
  }
  function foldHtml(bi, n) {
    return '<tr class="fold" data-fold="' + bi + '"><td colspan="' + (xst.view === 'split' ? 5 : 4) + '">' + T('foldMore', { n: nf(n) }) + '</td></tr>';
  }

  function renderDiffStats() {
    var res = xst.res, s = res.stats;
    $('diffStats').innerHTML = '<span class="badge">' + T('stSame', { n: nf(s.same) }) + '</span><span class="badge warn">' + T('stChg', { n: nf(s.chg) }) + '</span><span class="badge err">' + T('stDel', { n: nf(s.del) }) + '</span><span class="badge ok">' + T('stAdd', { n: nf(s.add) }) + '</span>' +
      (res.approx ? '<span class="badge warn">' + T('approx') + '</span>' : '');
  }
  function renderDiff() {
    renderDiffStats();
    var rows = xst.res.rows, blocks = xst.blocks, pageIdx = Math.min(xst.page, xst.pages.length - 1), html = '';
    xst.page = pageIdx;
    xst.pages[pageIdx].forEach(function (bi) {
      var b = blocks[bi], i;
      if (b.kind === 'hunk') { for (i = b.from; i < b.to; i++) html += rowHtml(rows[i]); return; }
      var n = b.to - b.from, head = bi === 0 ? 0 : CTX, tail = bi === blocks.length - 1 ? 0 : CTX;
      if (xst.open[bi] || n <= head + tail + 1) { for (i = b.from; i < b.to; i++) html += rowHtml(rows[i]); return; }
      for (i = b.from; i < b.from + head; i++) html += rowHtml(rows[i]);
      html += foldHtml(bi, n - head - tail);
      for (i = b.to - tail; i < b.to; i++) html += rowHtml(rows[i]);
    });
    $('diffView').className = 'cp-diff ' + xst.view;
    $('diffView').innerHTML = rows.length ? '<table><tbody>' + html + '</tbody></table>' : '<div class="empty"><div class="empty-title">' + T('noText') + '</div></div>';
    var hunks = xst.res.hunks;
    $('prevHunk').disabled = $('nextHunk').disabled = !hunks;
    $('hunkPos').textContent = !hunks ? T('noHunk') : xst.hunk < 0 ? T('hunksN', { n: nf(hunks) }) : T('hunkAt', { i: nf(xst.hunk + 1), n: nf(hunks) });
    var np = xst.pages.length;
    $('diffPager').innerHTML = np > 1
      ? '<span>' + T('pageN', { i: pageIdx + 1, n: np }) + '</span><span class="sp"></span>' +
        '<button class="btn sm" type="button" data-dpg="-1"' + (pageIdx === 0 ? ' disabled' : '') + '>' + icon('chevron-left') + T('prev') + '</button>' +
        '<button class="btn sm" type="button" data-dpg="1"' + (pageIdx >= np - 1 ? ' disabled' : '') + '>' + T('next') + icon('chevron-right') + '</button>'
      : '';
    markCurrent();
  }
  function markCurrent() {
    if (xst.hunk < 0) return;
    Array.prototype.forEach.call($('diffView').querySelectorAll('[data-h="' + xst.hunk + '"]'), function (tr) { tr.classList.add('cur'); });
  }
  $('diffPager').addEventListener('click', function (e) {
    var b = e.target.closest('[data-dpg]');
    if (!b) return;
    xst.page += +b.getAttribute('data-dpg'); renderDiff();
    $('diffView').scrollIntoView({ block: 'start' });
  });
  $('diffView').addEventListener('click', function (e) {
    var f = e.target.closest('[data-fold]');
    if (!f) return;
    xst.open[f.getAttribute('data-fold')] = true; renderDiff();
  });
  function gotoHunk(step) {
    var n = xst.res && xst.res.hunks;
    if (!n) return;
    xst.hunk = xst.hunk < 0 ? (step > 0 ? 0 : n - 1) : (xst.hunk + step + n) % n;
    var page = Math.floor(xst.hunk / HUNKS_PER_PAGE);
    xst.page = page;
    renderDiff();
    var el = $('diffView').querySelector('[data-h="' + xst.hunk + '"]');
    if (el) el.scrollIntoView({ block: 'center' });
  }
  $('nextHunk').addEventListener('click', function () { gotoHunk(1); });
  $('prevHunk').addEventListener('click', function () { gotoHunk(-1); });

  /* ══════════ 3. ใบเสนอราคา ══════════ */
  function read(key, dflt) {
    var v = TD && TD.read ? TD.read(key, null) : null;
    if (v == null) { try { v = JSON.parse(localStorage.getItem(key)); } catch (e) { v = null; } }
    return v == null ? dflt : v;
  }
  function loadList(key) {
    var v = read(key, []);
    return Array.isArray(v) ? v.filter(function (r) { return r && typeof r === 'object' && r.id; }) : [];
  }
  function saveJson(key, v) { localStorage.setItem(key, JSON.stringify(v)); }
  function upsert(key, rec) {
    var list = loadList(key), i = list.findIndex(function (x) { return x.id === rec.id; });
    if (i === -1) list.push(rec); else list[i] = rec;
    saveJson(key, list);
  }
  function removeRec(key, id) { saveJson(key, loadList(key).filter(function (x) { return x.id !== id; })); }

  var jobs = [], cur = null, saveTimer = null, attachBi = -1;

  function readJobs() {
    jobs = loadList(K.quotes).map(function (j) { return CC.cleanJob(j, j.id, j.updatedAt); }).sort(function (a, b) { return b.createdAt - a.createdAt; });
  }
  function pickJob(id) {
    var j = jobs.filter(function (x) { return x.id === id; })[0] || jobs[0] || null;
    cur = j ? JSON.parse(JSON.stringify(j)) : null;
    ui.jobId = cur ? cur.id : ''; saveUi();
  }
  function saveNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!cur) return;
    upsert(K.quotes, CC.cleanJob(cur, cur.id, Date.now()));
  }
  function scheduleSave() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 350); }

  function blankBidder() { return { id: newId(), name: '', price: '', delivery: '', warranty: '', payment: '', note: '', scores: {}, files: [] }; }
  /* เกณฑ์ตั้งต้นของงานใหม่ = ข้อมูลของผู้ใช้ตั้งแต่สร้าง → ตั้งชื่อตามภาษาตอนสร้าง (ภาษาไทยคือค่าเดิมของ CC.defaultCriteria) */
  function defaultCriteria() {
    var cr = CC.defaultCriteria();
    if (OME_LANG.get() === 'en') cr.forEach(function (c) { var n = T('c_' + c.id); if (n) c.name = n; });
    return cr;
  }
  function newJobRec() {
    return { id: newId(), name: T('jobN', { n: jobs.length + 1 }), criteria: defaultCriteria(), bidders: [blankBidder(), blankBidder()], createdAt: Date.now() };
  }

  function renderQuotes() {
    msg('qMsg', '');
    $('jobSel').innerHTML = jobs.map(function (j) { return '<option value="' + esc(j.id) + '"' + (cur && cur.id === j.id ? ' selected' : '') + '>' + esc(j.name) + '</option>'; }).join('') || '<option value="">' + T('noJobs') + '</option>';
    $('jobSel').disabled = !jobs.length;
    $('jobName').disabled = $('jobDel').disabled = !cur;
    $('jobBody').hidden = !cur;
    if (!cur) { $('jobName').value = ''; return; }
    if (document.activeElement !== $('jobName')) $('jobName').value = cur.name;
    renderCrit(); renderBids(); renderRank();
  }

  function renderWeightTotal() {
    var t = CC.weightTotal(cur.criteria), ok = Math.abs(t - 100) < 1e-6;
    $('wTotal').innerHTML = '<span class="badge ' + (ok ? 'ok' : 'err') + '">' + T('wTotal', { n: nf(t, 2) }) + (ok ? '' : T('wMust')) + '</span>';
  }
  function renderCrit() {
    $('critList').innerHTML = cur.criteria.map(function (c, i) {
      return '<div class="cp-crit" data-ci="' + i + '">' +
        '<input class="input" type="text" data-f="name" value="' + esc(c.name) + '" placeholder="' + T('critName') + '" aria-label="' + T('critName') + '" maxlength="80" autocomplete="off">' +
        '<input class="input" type="number" data-f="weight" value="' + esc(c.weight) + '" placeholder="' + T('critWeight') + '" aria-label="' + T('critWeight') + '" min="0" step="any" inputmode="decimal">' +
        '<label class="cp-check"><input type="checkbox" data-f="auto"' + (c.auto === 'price' ? ' checked' : '') + '> ' + T('critAuto') + '</label>' +
        '<button class="btn icon sm ghost rm" type="button" data-rmcrit aria-label="' + T('critRm') + '">' + icon('trash-2') + '</button></div>';
    }).join('');
    renderWeightTotal();
  }

  function fileLinks(b) {
    if (!b.files.length) return '';
    var live = filesAvailable();
    return '<div class="cp-files">' + b.files.map(function (f) {
      return '<div class="cp-file">' + icon('paperclip') + (live ? '<a href="/api/files?id=' + encodeURIComponent(f.id) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' : '<span style="flex:1">' + esc(f.name) + '</span>') +
        '<button class="btn icon sm ghost" type="button" data-rmfile="' + esc(f.id) + '" aria-label="' + T('rmFile') + '">' + icon('x') + '</button></div>';
    }).join('') + '</div>';
  }
  function renderBids() {
    if (!cur.bidders.length) { $('bidList').innerHTML = '<div class="empty"><div class="empty-title">' + T('noBidders') + '</div></div>'; return; }
    $('bidList').innerHTML = cur.bidders.map(function (b, i) {
      var p = 'b' + i + '-';
      var scores = cur.criteria.map(function (c) {
        if (c.auto === 'price') return '<span class="badge info" data-auto="' + esc(c.id) + '"></span>';
        var v = b.scores && b.scores[c.id];
        return '<div class="field"><label for="' + p + esc(c.id) + '">' + esc(c.name || T('critFallback')) + ' (0–10)</label><input id="' + p + esc(c.id) + '" type="number" data-score="' + esc(c.id) + '" min="0" max="10" step="any" inputmode="decimal" value="' + (v == null ? '' : esc(v)) + '"></div>';
      }).join('');
      return '<div class="card cp-bid" data-bi="' + i + '">' +
        '<div class="head"><input class="input" type="text" data-f="name" value="' + esc(b.name) + '" placeholder="' + T('bidName') + '" aria-label="' + T('bidName') + '" maxlength="120" autocomplete="off">' +
        '<button class="btn icon sm ghost" type="button" data-rmbid aria-label="' + T('bidRm') + '">' + icon('trash-2') + '</button></div>' +
        '<div class="frow">' +
        '<div class="field"><label for="' + p + 'price">' + T('price') + '</label><input id="' + p + 'price" type="number" data-f="price" min="0" step="any" inputmode="decimal" value="' + (b.price == null ? '' : esc(b.price)) + '"></div>' +
        '<div class="field"><label for="' + p + 'delivery">' + T('delivery') + '</label><input id="' + p + 'delivery" type="text" data-f="delivery" value="' + esc(b.delivery) + '" maxlength="120"></div>' +
        '<div class="field"><label for="' + p + 'warranty">' + T('warranty') + '</label><input id="' + p + 'warranty" type="text" data-f="warranty" value="' + esc(b.warranty) + '" maxlength="120"></div>' +
        '<div class="field"><label for="' + p + 'payment">' + T('payment') + '</label><input id="' + p + 'payment" type="text" data-f="payment" value="' + esc(b.payment) + '" maxlength="200"></div></div>' +
        '<div class="field" style="margin-top:var(--ome-sp-3)"><label for="' + p + 'note">' + T('note') + '</label><textarea id="' + p + 'note" class="textarea" rows="2" data-f="note" maxlength="1000">' + esc(b.note) + '</textarea></div>' +
        '<div class="cp-scores" style="margin-top:var(--ome-sp-3)">' + scores + '</div>' +
        fileLinks(b) +
        (filesAvailable() ? '<div style="margin-top:var(--ome-sp-3)"><button class="btn sm" type="button" data-attach>' + icon('paperclip') + T('attach') + '</button></div>' : '') +
        '</div>';
    }).join('');
  }

  var rankView = null;
  function renderRank() {
    var r = rankView = CC.rankJob(cur), box = $('rankBox'), byId = {};
    cur.bidders.forEach(function (b) { byId[b.id] = b; });
    $('exportQuote').disabled = !r.ok || !r.rows.length;
    // คะแนนราคาอัตโนมัติบนการ์ดผู้เสนอราคา
    Array.prototype.forEach.call(document.querySelectorAll('#bidList .card[data-bi]'), function (card) {
      var row = r.rows.filter(function (x) { return x.id === cur.bidders[+card.getAttribute('data-bi')].id; })[0];
      Array.prototype.forEach.call(card.querySelectorAll('[data-auto]'), function (el) {
        var c = cur.criteria.filter(function (x) { return x.id === el.getAttribute('data-auto'); })[0];
        var s = row && row.scores[el.getAttribute('data-auto')];
        el.textContent = (c && c.name || T('priceCrit')) + ' ' + (s == null ? '—' : fx(s)) + ' / 10';
      });
    });
    renderWeightTotal();
    if (!r.rows.length) { box.innerHTML = '<div class="empty"><div class="empty-title">' + T('noBidders') + '</div></div>'; return; }
    if (!r.ok) { box.innerHTML = '<div class="callout err" role="status">' + icon('circle-alert') + ' ' + T('wFix', { n: nf(r.total, 2) }) + '</div>'; return; }
    var head = '<th>' + T('thRank') + '</th><th>' + T('thBidder') + '</th><th class="num">' + T('thPrice') + '</th>' + cur.criteria.map(function (c) { return '<th class="num">' + esc(c.name) + ' (' + nf(c.weight, 2) + '%)</th>'; }).join('') + '<th class="num">' + T('thTotal') + '</th>';
    box.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' + head + '</tr></thead><tbody>' + r.rows.map(function (x) {
      var b = byId[x.id], pn = parseFloat(b.price), price = b.price !== '' && isFinite(pn) ? nf(pn, 2) : '—';
      return '<tr' + (x.rank === 1 ? ' class="win"' : '') + ' data-rank="' + x.rank + '"><td>' + (x.rank === 1 ? '<span class="badge ok">1</span>' : x.rank) + '</td><td>' + esc(x.name || T('noName')) + '</td><td class="num">' + price + '</td>' +
        cur.criteria.map(function (c) { return '<td class="num">' + (x.scores[c.id] == null ? '—' : fx(x.scores[c.id])) + '</td>'; }).join('') +
        '<td class="num"><b>' + fx(x.total) + '</b></td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  /* ── ไฟล์แนบ (R2) ── */
  function api(method, qs, opts) { return fetch('/api/files?' + qs, Object.assign({ method: method, credentials: 'same-origin' }, opts || {})); }
  function deleteRemote(ids) { return Promise.all(ids.map(function (id) { return api('DELETE', 'id=' + encodeURIComponent(id)).catch(function () {}); })); }
  var MIME_BY_EXT = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif' };
  function mimeOf(f) {
    if (f.type) return f.type;
    var m = /\.([a-z0-9]+)$/i.exec(f.name || '');
    return (m && MIME_BY_EXT[m[1].toLowerCase()]) || '';
  }
  function uploadOne(f, bid) {
    var mime = mimeOf(f);
    if (!/^(application\/pdf|image\/(jpeg|png|webp|heic|heif|gif))$/.test(mime)) return Promise.reject(new Error(T('onlyPdfImg')));
    if (f.size > MAX_FILE) return Promise.reject(new Error(T('tooBig15', { name: f.name })));
    return api('POST', 'ns=compare&ref=' + encodeURIComponent(cur.id + '|' + bid) + '&name=' + encodeURIComponent(f.name), { headers: { 'Content-Type': mime }, body: f })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.error || T('uploadFailN', { n: r.status }));
          return j;
        });
      });
  }
  $('bidFile').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files || []), bi = attachBi, job = cur, b = job && job.bidders[bi];
    this.value = '';
    if (!files.length || !b) return;
    msg('qMsg', '');
    files.reduce(function (chain, f) {
      return chain.then(function () {
        return uploadOne(f, b.id).then(function (j) {
          b.files.push({ id: j.id, name: j.name, size: j.size, mime: j.mime });
          if (cur === job) { renderBids(); renderRank(); }
          saveNow();
        }).catch(function (e) { msg('qMsg', e.message || function () { return T('uploadFail'); }); });
      });
    }, Promise.resolve());
  });

  /* ── เหตุการณ์ในแท็บใบเสนอราคา ── */
  $('jobSel').addEventListener('change', function () { saveNow(); pickJob(this.value); renderQuotes(); });
  $('jobName').addEventListener('input', function () {
    if (!cur) return;
    cur.name = this.value; scheduleSave();
    var o = $('jobSel').querySelector('option[value="' + cur.id.replace(/"/g, '') + '"]');
    if (o) o.textContent = cur.name || T('jobDefault');
  });
  $('jobNew').addEventListener('click', function () {
    saveNow();
    var rec = newJobRec();
    upsert(K.quotes, CC.cleanJob(rec, rec.id, Date.now()));
    readJobs(); pickJob(rec.id); renderQuotes();
    $('jobName').focus(); $('jobName').select();
  });
  $('jobDel').addEventListener('click', function () {
    if (!cur) return;
    var job = cur;
    window.tanotConfirm(T('delJob', { name: job.name || T('jobDefault') }), { danger: true, okLabel: T('del') }).then(function (ok) {
      if (!ok) return;
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      var ids = []; job.bidders.forEach(function (b) { b.files.forEach(function (f) { ids.push(f.id); }); });
      removeRec(K.quotes, job.id);
      if (ids.length && filesAvailable()) deleteRemote(ids);
      readJobs(); pickJob(''); renderQuotes();
    });
  });

  $('critAdd').addEventListener('click', function () {
    cur.criteria.push({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: '', weight: 0, auto: null });
    renderCrit(); renderBids(); renderRank(); scheduleSave();
    var inputs = $('critList').querySelectorAll('[data-f="name"]');
    inputs[inputs.length - 1].focus();
  });
  $('critList').addEventListener('input', function (e) {
    var row = e.target.closest('[data-ci]');
    if (!row || e.target.type === 'checkbox') return;
    var c = cur.criteria[+row.getAttribute('data-ci')], f = e.target.getAttribute('data-f');
    c[f] = e.target.value;
    renderRank(); scheduleSave();
  });
  $('critList').addEventListener('change', function (e) {
    var row = e.target.closest('[data-ci]');
    if (!row) return;
    var c = cur.criteria[+row.getAttribute('data-ci')], f = e.target.getAttribute('data-f');
    if (f === 'auto') c.auto = e.target.checked ? 'price' : null;
    if (f === 'weight') { var w = parseFloat(e.target.value); c.weight = isFinite(w) && w >= 0 ? w : 0; e.target.value = c.weight; }
    if (f === 'auto' || f === 'name') renderBids();
    renderRank(); scheduleSave();
  });
  $('critList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rmcrit]');
    if (!b) return;
    var i = +b.closest('[data-ci]').getAttribute('data-ci'), c = cur.criteria[i];
    cur.criteria.splice(i, 1);
    cur.bidders.forEach(function (x) { if (x.scores) delete x.scores[c.id]; });
    renderCrit(); renderBids(); renderRank(); scheduleSave();
  });

  $('bidAdd').addEventListener('click', function () {
    cur.bidders.push(blankBidder());
    renderBids(); renderRank(); scheduleSave();
    var inputs = $('bidList').querySelectorAll('.head input');
    inputs[inputs.length - 1].focus();
  });
  $('bidList').addEventListener('input', function (e) {
    var card = e.target.closest('[data-bi]');
    if (!card) return;
    var b = cur.bidders[+card.getAttribute('data-bi')], f = e.target.getAttribute('data-f'), sc = e.target.getAttribute('data-score');
    if (f) b[f] = e.target.value;
    else if (sc) { if (!b.scores) b.scores = {}; b.scores[sc] = e.target.value; }
    else return;
    renderRank(); scheduleSave();
  });
  $('bidList').addEventListener('click', function (e) {
    var card = e.target.closest('[data-bi]');
    if (!card) return;
    var bi = +card.getAttribute('data-bi'), b = cur.bidders[bi];
    if (e.target.closest('[data-attach]')) { attachBi = bi; $('bidFile').click(); return; }
    var rf = e.target.closest('[data-rmfile]');
    if (rf) {
      var id = rf.getAttribute('data-rmfile');
      b.files = b.files.filter(function (f) { return f.id !== id; });
      if (filesAvailable()) deleteRemote([id]);
      renderBids(); renderRank(); saveNow();
      return;
    }
    if (e.target.closest('[data-rmbid]')) {
      var job = cur;
      window.tanotConfirm(T('delBid', { name: b.name || T('noNameShort') }), { danger: true, okLabel: T('del') }).then(function (ok) {
        if (!ok || cur !== job) return;
        var at = job.bidders.indexOf(b);
        if (at === -1) return;
        job.bidders.splice(at, 1);
        if (b.files.length && filesAvailable()) deleteRemote(b.files.map(function (f) { return f.id; }));
        renderBids(); renderRank(); saveNow();
      });
    }
  });

  $('exportQuote').addEventListener('click', function () {
    if (!cur) return;
    var job = CC.cleanJob(cur, cur.id, Date.now()), q = CC.quoteSheets(job);
    q.sheets.forEach(function (s) { s.id = s.name === 'จัดอันดับ' ? 'rank' : 'info'; s.marks = []; });
    loadXlsx().then(function (X) {
      var wb = X.utils.book_new();
      q.sheets.forEach(function (sh) {
        var ws = styledSheet(X, sh);
        if (sh.id === 'rank') for (var r = 1; r <= sh.rows.length; r++) if (sh.rows[r - 1][0] === 1) for (var c = 0; c < sh.header.length; c++) ws[X.utils.encode_cell({ r: r, c: c })].s = fillStyle(FILL.added, true);
        X.utils.book_append_sheet(wb, ws, sh.name);
      });
      var out = X.write(wb, { type: 'array', bookType: 'xlsx' });
      download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), safeName(job.name) + '_' + today() + '.xlsx');
    }).catch(function () { msg('qMsg', needNet); });
  });

  /* ── ข้อมูลเปลี่ยนจากเครื่องอื่น/แท็บอื่น → วาดใหม่ (ไม่ทับสิ่งที่กำลังพิมพ์) ── */
  function typingInJob() {
    var a = document.activeElement;
    return !!(a && a.closest && a.closest('#tab-quotes') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  if (TD && TD.onChange) {
    TD.onChange(function (keys) {
      if (keys.length && keys.indexOf(K.quotes) === -1) return;
      if (saveTimer) return;
      readJobs();
      if (typingInJob() && cur) { // แค่อัปเดตรายการงานใน select — ฟอร์มที่กำลังพิมพ์คงไว้
        var sel = $('jobSel'), id = cur.id;
        sel.innerHTML = jobs.map(function (j) { return '<option value="' + esc(j.id) + '"' + (j.id === id ? ' selected' : '') + '>' + esc(j.name) + '</option>'; }).join('');
        return;
      }
      pickJob(cur ? cur.id : ui.jobId);
      if (ui.tab === 'quotes') renderQuotes();
    });
  }
  window.addEventListener('pagehide', saveNow);

  /* ══════════ เริ่มต้น ══════════ */
  window.OME_PAGE_LIVE_LANG = true;
  /* สลับภาษาสด: ชื่อคอลัมน์ที่ระบบตั้งให้ (คอลัมน์ A/Column A) เปลี่ยนตาม · วาดส่วนที่สร้างด้วย JS ใหม่ (ผลเทียบ/diff/ใบเสนอราคา) โดยไม่ล้างไฟล์หรือผลที่มี */
  OME_LANG.onChange(function (lang) {
    var other = lang === 'en' ? 'th' : 'en', LBL = { th: function (n) { return 'คอลัมน์ ' + n; }, en: function (n) { return 'Column ' + n; } };
    function relabel(name) { var m = new RegExp('^' + (other === 'th' ? 'คอลัมน์' : 'Column') + ' ([A-Z]+)( \\(\\d+\\))?$').exec(name); return m ? LBL[lang](m[1]) + (m[2] || '') : name; }
    ['A', 'B'].forEach(function (k) { var t = sides[k].table; if (t) t.headers = t.headers.map(relabel); });
    if (tst.cfg) tst.cfg.map.forEach(function (m) { m.name = relabel(m.name); });
    if (tst.runCfg) tst.runCfg.map.forEach(function (m) { m.name = relabel(m.name); });
    if (tst.cfg && sides.A.table && sides.B.table) renderMapping();
    if (tst.res) renderResult();
    if (xst.res) renderDiff();
    if (cur && ui.tab === 'quotes') renderQuotes(); else if (cur) { renderCrit(); renderBids(); renderRank(); }
  });
  readJobs();
  pickJob(ui.jobId);
  var hm = /[#&]tab=(table|text|quotes)/.exec(location.hash);
  setTab(hm ? hm[1] : ui.tab, true);
})();
