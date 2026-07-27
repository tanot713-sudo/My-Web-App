/* ══════════════════════════════════════════════════════════════════
   ตารางคำนวณ (Spreadsheet) — สเปรดชีตในเบราว์เซอร์
   - กริด/สูตร/จัดรูปแบบ/หลายชีต: Luckysheet (MIT)
   - นำเข้า .xlsx: LuckyExcel · นำเข้า .csv + ส่งออก .xlsx/.csv: SheetJS
   - ครอบด้วย shell ของ Tanot: ธีม, i18n ไทย/อังกฤษ, autosave, ทำงานออฟไลน์ (PWA)
   ทุกอย่างทำงานฝั่งเบราว์เซอร์ ไฟล์ไม่ถูกส่งขึ้นเซิร์ฟเวอร์
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LANG_KEY = 'tanot:doclang';
  var AUTOSAVE_KEY = 'tanot:sheet:autosave';

  var I18N = {
    th: {
      docTitle: 'ตารางคำนวณ | Tanot',
      crumbResp: 'งานที่รับผิดชอบ', crumbSheet: 'ตารางคำนวณ',
      pageTitle: 'ตารางคำนวณ: สร้างและแก้ไขสเปรดชีต (รองรับไฟล์ Excel .xlsx)',
      newBtn: 'ไฟล์ใหม่', importBtn: 'นำเข้า Excel/CSV', exportXlsxBtn: 'ดาวน์โหลด .xlsx',
      exportCsvBtn: 'ดาวน์โหลด .csv', printBtn: 'พิมพ์ / PDF',
      loadingSheet: 'กำลังโหลดตารางคำนวณ…',
      toolHint: 'เครื่องมือครบชุด (แถบด้านบน): ฟอนต์ · สี/พื้น · เส้นขอบ · จัดชิด · ผสานเซลล์ · รูปแบบตัวเลข (฿, %, วันที่) · สูตร/ฟังก์ชัน · เรียง/กรอง · ตรึงแถว-คอลัมน์ · กราฟ · ตารางสรุป (Pivot) · จัดรูปแบบตามเงื่อนไข · ตรวจสอบข้อมูล (dropdown) · ค้นหา/แทนที่ · หลายชีต (แท็บล่าง) — ทำงานในเบราว์เซอร์ทั้งหมด ไฟล์ไม่ถูกส่งขึ้นเซิร์ฟเวอร์',
      footerText: 'Tanot — งานที่รับผิดชอบ', creditsLink: 'เครดิต & ลิขสิทธิ์',
      rHome: 'หน้าแรก', rInsert: 'แทรก', rFormulas: 'สูตร', rData: 'ข้อมูล', rView: 'มุมมอง',
      autosaveReady: 'พร้อมใช้งาน', autosaveSaving: 'กำลังบันทึก…', autosaveSaved: 'บันทึกอัตโนมัติแล้ว',
      restored: 'เปิดงานล่าสุดที่บันทึกไว้',
      importing: 'กำลังนำเข้าไฟล์…', imported: 'นำเข้าไฟล์ “{name}” เรียบร้อยแล้ว',
      importError: 'นำเข้าไฟล์ไม่สำเร็จ: {msg}', importEmpty: 'ไม่พบข้อมูลในไฟล์',
      exporting: 'กำลังสร้างไฟล์…', exported: 'ดาวน์โหลดไฟล์เรียบร้อยแล้ว',
      exportError: 'ดาวน์โหลดไม่สำเร็จ: {msg}',
      pdfGenerating: 'กำลังสร้างไฟล์ PDF…', pdfDone: 'สร้างไฟล์ PDF เรียบร้อยแล้ว', pdfError: 'สร้าง PDF ไม่สำเร็จ: {msg}',
      newConfirm: 'เริ่มไฟล์ใหม่? ข้อมูลปัจจุบันที่ยังไม่ดาวน์โหลดจะหายไป',
      newDone: 'เริ่มไฟล์ใหม่แล้ว',
      libError: 'โหลดตารางคำนวณไม่สำเร็จ — ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วรีเฟรชหน้าอีกครั้ง',
      sheetName: 'ชีต1'
    },
    en: {
      docTitle: 'Spreadsheet | Tanot',
      crumbResp: 'Responsibilities', crumbSheet: 'Spreadsheet',
      pageTitle: 'Spreadsheet: Create & Edit (Excel .xlsx compatible)',
      newBtn: 'New File', importBtn: 'Import Excel/CSV', exportXlsxBtn: 'Download .xlsx',
      exportCsvBtn: 'Download .csv', printBtn: 'Print / PDF',
      loadingSheet: 'Loading spreadsheet…',
      toolHint: 'Full toolbar (top bar): font · color/fill · borders · align · merge cells · number formats (฿, %, date) · formulas/functions · sort/filter · freeze rows-columns · charts · pivot tables · conditional formatting · data validation (dropdown) · find/replace · multiple sheets (bottom tabs) — all in your browser; files are never uploaded.',
      footerText: 'Tanot — Responsibilities', creditsLink: 'Credits & licenses',
      rHome: 'Home', rInsert: 'Insert', rFormulas: 'Formulas', rData: 'Data', rView: 'View',
      autosaveReady: 'Ready', autosaveSaving: 'Saving…', autosaveSaved: 'Autosaved',
      restored: 'Restored your last saved work',
      importing: 'Importing file…', imported: 'Imported “{name}”',
      importError: 'Import failed: {msg}', importEmpty: 'No data found in the file',
      exporting: 'Generating file…', exported: 'File downloaded',
      exportError: 'Download failed: {msg}',
      pdfGenerating: 'Generating PDF…', pdfDone: 'PDF created successfully', pdfError: 'Couldn\'t create PDF: {msg}',
      newConfirm: 'Start a new file? Current unsaved data will be lost.',
      newDone: 'Started a new file',
      libError: 'Couldn\'t load the spreadsheet — check your connection and refresh the page.',
      sheetName: 'Sheet1'
    }
  };
  function getUILang() { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  function setUILang(l) { try { localStorage.setItem(LANG_KEY, l); } catch (e) {} }
  function t(key, vars) {
    var s = (I18N[getUILang()] && I18N[getUILang()][key]) || (I18N.th[key]) || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }
  var $ = function (id) { return document.getElementById(id); };

  var els = {
    langToggle: $('langToggle'), statusMsg: $('statusMsg'), loading: $('loading'), grid: $('luckysheet'),
    ribbon: $('xlRibbon'), ribTabs: $('xlrTabs'), ribPanels: $('xlrPanels'),
    newBtn: $('newBtn'), importBtn: $('importBtn'), fileInput: $('fileInput'),
    exportXlsxBtn: $('exportXlsxBtn'), exportCsvBtn: $('exportCsvBtn'), printBtn: $('printBtn')
  };

  /* ── ความสูงกริดคงที่ (พิกเซล) กันอาการกระตุกบนมือถือ ──
     iOS Safari ซ่อน/โชว์แถบ URL ตอนเลื่อน → ถ้าใช้ vh ความสูงจะเปลี่ยนตลอด
     Luckysheet จะวาดใหม่ทั้งกริดซ้ำๆ = กระตุก จึงตรึงเป็นพิกเซล และไม่วาดใหม่
     เมื่อความสูงขยับเล็กน้อย (แถบ URL) จะรีเลย์เอาต์เฉพาะตอนหมุนจอ/เปลี่ยนจริง */
  var lastVW = 0, lastVH = 0, sheetLive = false;
  function applyGridHeight(force) {
    if (!els.grid) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    if (!force && vw === lastVW && Math.abs(vh - lastVH) < 120) return;  /* เพิกเฉยการขยับเล็กจากแถบ URL */
    lastVW = vw; lastVH = vh;
    /* ตารางสูง ~70% ของจอ (ไม่กินทั้งหน้า) เพื่อให้เลื่อน "หน้า" ดูภาพรวมได้เวลาไม่ได้แตะบนตาราง;
       ตรึงเป็นพิกเซล + เมินการขยับเล็กของแถบ URL กันกระตุกบน iOS */
    var h = Math.min(760, Math.max(340, Math.round(vh * 0.70)));
    els.grid.style.height = h + 'px';
    /* เรียก resize ได้ "เฉพาะเมื่อสร้างเวิร์กบุ๊กแล้ว" — ถ้าเรียกก่อน create ครั้งแรก
       Luckysheet จะอ่านตำแหน่งของชีตที่ยังไม่มี → error "reading 'left'" → ค้าง Loading… บน iOS */
    if (sheetLive && window.luckysheet && luckysheet.resize) { try { luckysheet.resize(); } catch (e) {} }
  }

  function applyStaticI18n() {
    var lang = getUILang();
    document.documentElement.lang = lang;
    var titleKey = document.body.getAttribute('data-doctitle-key');
    if (titleKey) document.title = t(titleKey);
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.title = t(el.getAttribute('data-i18n-title')); });
    if (els.langToggle) els.langToggle.querySelectorAll('span').forEach(function (s) { s.classList.toggle('active', s.getAttribute('data-lt') === lang); });
  }
  function setStatus(msg, isErr, spin) {
    els.statusMsg.innerHTML = '';
    els.statusMsg.classList.toggle('err', !!isErr);
    if (spin) { var s = document.createElement('span'); s.className = 'spin'; els.statusMsg.appendChild(s); }
    if (msg) els.statusMsg.appendChild(document.createTextNode(msg));
  }

  /* ── ค่าเริ่มต้น + ตัวช่วยแปลงข้อมูล ── */
  function defaultData() {
    return [{ name: t('sheetName'), color: '', status: 1, order: 0, index: 0, row: 60, column: 20, celldata: [], config: {} }];
  }
  function cellVal(cell) {
    if (cell == null) return null;
    if (typeof cell !== 'object') return cell;
    if (cell.v != null && cell.v !== '') return cell.v;
    if (cell.m != null) return cell.m;
    return null;
  }
  function sheetToAoa(sheet) {
    if (Array.isArray(sheet.data) && sheet.data.length) {
      return sheet.data.map(function (row) { return (row || []).map(cellVal); });
    }
    var cd = sheet.celldata || [], maxR = 0, maxC = 0;
    cd.forEach(function (c) { if (c.r > maxR) maxR = c.r; if (c.c > maxC) maxC = c.c; });
    var aoa = [];
    for (var i = 0; i <= maxR; i++) { aoa.push(new Array(maxC + 1).fill(null)); }
    cd.forEach(function (c) { aoa[c.r][c.c] = cellVal(c.v); });
    return aoa;
  }
  function aoaToCelldata(aoa) {
    var cd = [];
    aoa.forEach(function (row, r) {
      (row || []).forEach(function (val, c) {
        if (val !== null && val !== undefined && val !== '') cd.push({ r: r, c: c, v: { v: val, m: String(val) } });
      });
    });
    return cd;
  }

  /* ── autosave ── */
  var saveTimer = null;
  function scheduleSave() {
    if (!window.luckysheet || !luckysheet.getAllSheets) return;
    /* ไม่ทับข้อความสถานะทันที (เช่น “นำเข้าไฟล์แล้ว”) — บันทึกเงียบๆ แล้วค่อยขึ้น “บันทึกอัตโนมัติแล้ว” */
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      /* serialize ทั้งเวิร์กบุ๊กหนัก → ทำตอนเบราว์เซอร์ว่าง จะได้ไม่กระตุกระหว่างพิมพ์ */
      var run = function () {
        try {
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(luckysheet.getAllSheets()));
          setStatus(t('autosaveSaved'));
        } catch (e) {}
      };
      if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 2000 }); else run();
    }, 1200);
  }

  /* ── สร้าง/สร้างใหม่ Luckysheet ── */
  function baseOptions(data) {
    /* ค่าเริ่มต้นของ Luckysheet เปิดเครื่องมือ "ครบทุกปุ่ม" อยู่แล้ว (แถบเครื่องมือเต็ม +
       แถบสูตร + แถบสถิติ + แท็บชีต) — จึงไม่ต้องส่ง showtoolbarConfig เอง
       สำคัญ: การส่ง showtoolbarConfig เป็นอ็อบเจกต์เองจะทำให้ Luckysheet init พัง
       (error "reading 'left'") แล้วค้างที่ Loading… บน iOS — ปล่อยให้ใช้ค่าเริ่มต้นดีกว่า */
    return {
      container: 'luckysheet',
      lang: 'en',
      data: data,
      title: 'Tanot',
      showinfobar: false,
      hook: {
        updated: scheduleSave,
        workbookCreateAfter: function () { hideLoading(); }
      }
    };
  }
  function hideLoading() { if (els.loading) els.loading.classList.add('hide'); }
  function createSheet(data) {
    if (!window.luckysheet) return;
    sheetLive = false;              /* กันไม่ให้ applyGridHeight เรียก resize ก่อน create เสร็จ */
    applyGridHeight(true);          /* ตั้งความสูงพิกเซลก่อน เพื่อให้ Luckysheet วัดถูกตั้งแต่แรก (ไม่ resize) */
    try { luckysheet.destroy(); } catch (e) {}
    luckysheet.create(baseOptions(data || defaultData()));
    sheetLive = true;               /* จากนี้ resize เวลาหมุนจอได้ */
    setTimeout(hideLoading, 600);   /* สำรอง ถ้า hook ไม่ยิง */
    scheduleBuildRibbon();          /* ย้ายปุ่มของ Luckysheet เข้าริบบอนแบบ Excel */
  }

  /* ══════════════════════════════════════════════════════════════════
     ริบบอนแบบ Excel — ย้าย "ปุ่มจริง" ของ Luckysheet มาจัดเป็นแท็บ/กลุ่ม
     (ย้ายทั้งโหนด → event handler + เมนู dropdown ยังทำงาน และเด้งถูกตำแหน่ง)
     ══════════════════════════════════════════════════════════════════ */
  var RIBBON = {
    home:     [['undo', 'redo', 'paintformat'], ['fontFamily', 'fontSize'], ['bold', 'italic', 'underline', 'strikethrough'],
               ['textColor', 'cellColor'], ['border'], ['merge'], ['align', 'valign', 'textwrap', 'rotation'],
               ['currency', 'percent', 'decDec', 'decInc', 'fmtOther']],
    insert:   [['image', 'link'], ['chart', 'comment', 'pivot']],
    formulas: [['func']],
    data:     [['sortfilter'], ['splitText', 'dataVerify'], ['condFormat'], ['findReplace']],
    view:     [['freeze'], ['print', 'protect', 'screenshot']]
  };
  var IDMAP = {
    undo: 'luckysheet-icon-undo', redo: 'luckysheet-icon-redo', paintformat: 'luckysheet-icon-paintformat',
    fontFamily: 'luckysheet-icon-font-family', fontSize: 'luckysheet-icon-font-size',
    bold: 'luckysheet-icon-bold', italic: 'luckysheet-icon-italic', underline: 'luckysheet-icon-underline', strikethrough: 'luckysheet-icon-strikethrough',
    textColor: 'luckysheet-icon-text-color', cellColor: 'luckysheet-icon-cell-color',
    border: 'luckysheet-icon-border-all', merge: 'luckysheet-icon-merge-button',
    align: 'luckysheet-icon-align', valign: 'luckysheet-icon-valign', textwrap: 'luckysheet-icon-textwrap', rotation: 'luckysheet-icon-rotation',
    currency: 'luckysheet-icon-currency', percent: 'luckysheet-icon-percent',
    decDec: 'luckysheet-icon-fmt-decimal-decrease', decInc: 'luckysheet-icon-fmt-decimal-increase', fmtOther: 'luckysheet-icon-fmt-other',
    image: 'luckysheet-insertImg-btn-title', link: 'luckysheet-insertLink-btn-title',
    chart: 'luckysheet-chart-btn-title', comment: 'luckysheet-icon-postil', pivot: 'luckysheet-pivot-btn-title',
    func: 'luckysheet-icon-function',
    sortfilter: 'luckysheet-icon-autofilter', splitText: 'luckysheet-splitColumn-btn-title', dataVerify: 'luckysheet-dataVerification-btn-title',
    condFormat: 'luckysheet-icon-conditionformat', findReplace: 'luckysheet-icon-seachmore',
    freeze: 'luckysheet-freezen-btn-horizontal', print: 'luckysheet-icon-print', protect: 'luckysheet-icon-protection', screenshot: 'luckysheet-chart-btn-screenshot'
  };
  function toolbarItemOf(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    var it = el;
    while (it.parentElement && !(it.parentElement.classList && it.parentElement.classList.contains('luckysheet-wa-editor'))) it = it.parentElement;
    return (it.parentElement && it.parentElement.classList.contains('luckysheet-wa-editor')) ? it : null;
  }
  function buildRibbon() {
    var tb = document.querySelector('.luckysheet-wa-editor');
    if (!tb || !document.getElementById('luckysheet-icon-bold')) return false;  /* toolbar ยังไม่พร้อม */
    var seen = {};
    Object.keys(RIBBON).forEach(function (tab) {
      var panel = els.ribPanels.querySelector('[data-rpanel="' + tab + '"]');
      if (!panel) return;
      panel.textContent = '';
      RIBBON[tab].forEach(function (group, gi) {
        var added = 0, frag = document.createDocumentFragment();
        group.forEach(function (key) {
          var id = IDMAP[key]; if (!id || seen[id]) return;
          var item = toolbarItemOf(id); if (!item) return;
          seen[id] = 1; frag.appendChild(item); added++;
        });
        if (added) {
          if (panel.children.length) { var sep = document.createElement('span'); sep.className = 'xlr-sep'; panel.appendChild(sep); }
          panel.appendChild(frag);
        }
      });
    });
    tb.classList.add('xlr-moved');       /* ซ่อนแถบเดิม */
    els.ribbon.hidden = false;
    applyGridHeight(true);               /* ปรับความสูง/ตำแหน่งกริดหลังริบบอนโผล่ */
    return true;
  }
  var ribTries = 0;
  function scheduleBuildRibbon() {
    ribTries = 0;
    (function wait() {
      if (buildRibbon()) return;
      if (ribTries++ > 60) return;
      setTimeout(wait, 120);
    })();
  }
  function switchRibbonTab(tab) {
    els.ribTabs.querySelectorAll('.xlr-tab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-rtab') === tab); });
    els.ribPanels.querySelectorAll('.xlr-panel').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-rpanel') === tab); });
  }
  if (els.ribTabs) {
    els.ribTabs.querySelectorAll('.xlr-tab').forEach(function (b) {
      b.addEventListener('click', function () { switchRibbonTab(b.getAttribute('data-rtab')); });
    });
  }

  /* ── นำเข้าไฟล์ ── */
  function importFile(file) {
    var name = file.name || '';
    var lower = name.toLowerCase();
    setStatus(t('importing'), false, true);
    if (/\.csv$/.test(lower)) {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(e.target.result, { type: 'binary' });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
          if (!aoa.length) { setStatus(t('importEmpty'), true); return; }
          createSheet([{ name: name.replace(/\.[^.]+$/, ''), status: 1, order: 0, index: 0, row: Math.max(60, aoa.length + 5), column: 20, celldata: aoaToCelldata(aoa), config: {} }]);
          setStatus(t('imported', { name: name }));
          scheduleSave();
        } catch (err) { setStatus(t('importError', { msg: err.message }), true); }
      };
      reader.readAsBinaryString(file);
      return;
    }
    /* .xlsx / .xls → LuckyExcel */
    if (!window.LuckyExcel) { setStatus(t('importError', { msg: 'LuckyExcel' }), true); return; }
    LuckyExcel.transformExcelToLucky(file, function (exportJson) {
      try {
        if (!exportJson || !exportJson.sheets || !exportJson.sheets.length) { setStatus(t('importEmpty'), true); return; }
        createSheet(exportJson.sheets);
        setStatus(t('imported', { name: name }));
        scheduleSave();
      } catch (err) { setStatus(t('importError', { msg: err.message }), true); }
    }, function (err) { setStatus(t('importError', { msg: (err && err.message) || 'error' }), true); });
  }

  /* ── ส่งออกไฟล์ ── */
  function currentSheets() {
    if (window.luckysheet && luckysheet.getAllSheets) return luckysheet.getAllSheets();
    return [];
  }
  function exportXlsx() {
    try {
      var sheets = currentSheets();
      if (!sheets.length) { setStatus(t('importEmpty'), true); return; }
      setStatus(t('exporting'), false, true);
      var wb = XLSX.utils.book_new();
      var used = {};
      sheets.forEach(function (sh, i) {
        var aoa = sheetToAoa(sh);
        var ws = XLSX.utils.aoa_to_sheet(aoa.length ? aoa : [[null]]);
        var nm = (sh.name || ('Sheet' + (i + 1))).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31) || ('Sheet' + (i + 1));
        while (used[nm]) { nm = (nm + '_').slice(0, 31); }
        used[nm] = 1;
        XLSX.utils.book_append_sheet(wb, ws, nm);
      });
      XLSX.writeFile(wb, 'spreadsheet.xlsx');
      setStatus(t('exported'));
    } catch (e) { setStatus(t('exportError', { msg: e.message }), true); }
  }
  function exportCsv() {
    try {
      var sheets = currentSheets();
      if (!sheets.length) { setStatus(t('importEmpty'), true); return; }
      setStatus(t('exporting'), false, true);
      var idx = (window.luckysheet && luckysheet.getSheetIndex) ? 0 : 0;
      var active = sheets.filter(function (s) { return s.status === 1; })[0] || sheets[0];
      var ws = XLSX.utils.aoa_to_sheet(sheetToAoa(active));
      var csv = XLSX.utils.sheet_to_csv(ws);
      var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (active.name || 'sheet') + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      setStatus(t('exported'));
    } catch (e) { setStatus(t('exportError', { msg: e.message }), true); }
  }

  /* ── สร้าง PDF สะอาดเอง (แนวเดียวกับหน้าเอกสาร/Word) — วาดตารางเป็นภาพแล้วตัดหน้า A4 ── */
  function activeCellGrid(sheet) {
    if (Array.isArray(sheet.data) && sheet.data.length) return sheet.data;
    var cd = sheet.celldata || [], maxR = 0, maxC = 0;
    cd.forEach(function (c) { if (c.r > maxR) maxR = c.r; if (c.c > maxC) maxC = c.c; });
    var g = []; for (var i = 0; i <= maxR; i++) g.push(new Array(maxC + 1).fill(null));
    cd.forEach(function (c) { g[c.r][c.c] = c.v; });
    return g;
  }
  function usedBounds(grid) {
    var lastR = -1, lastC = -1;
    for (var r = 0; r < grid.length; r++) {
      var row = grid[r] || [];
      for (var c = 0; c < row.length; c++) {
        var v = row[c]; if (v && (v.v != null && v.v !== '' || v.m != null && v.m !== '')) { if (r > lastR) lastR = r; if (c > lastC) lastC = c; }
      }
    }
    return { lastR: lastR, lastC: lastC };
  }
  function buildPdfTable(sheet) {
    var grid = activeCellGrid(sheet), b = usedBounds(grid);
    if (b.lastR < 0) return null;
    var table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;font-family:\'TH Sarabun New\',\'Sarabun\',\'Prompt\',sans-serif;font-size:15px;color:#111';
    for (var r = 0; r <= b.lastR; r++) {
      var tr = document.createElement('tr'), row = grid[r] || [];
      for (var c = 0; c <= b.lastC; c++) {
        var cell = row[c], td = document.createElement('td');
        td.style.cssText = 'border:1px solid #C7CEDB;padding:3px 8px;white-space:nowrap;max-width:340px;overflow:hidden;text-overflow:ellipsis';
        if (cell) {
          var txt = (cell.m != null && cell.m !== '') ? cell.m : (cell.v != null ? cell.v : '');
          td.textContent = txt;
          if (cell.bl) td.style.fontWeight = 'bold';
          if (cell.it) td.style.fontStyle = 'italic';
          if (cell.cl) td.style.textDecoration = 'line-through';
          if (cell.un) td.style.textDecoration = (td.style.textDecoration ? td.style.textDecoration + ' ' : '') + 'underline';
          if (cell.fc) td.style.color = cell.fc;
          if (cell.bg) td.style.background = cell.bg;
          var ht = cell.ht; td.style.textAlign = (ht === 0 || ht === '0') ? 'center' : (ht === 2 || ht === '2') ? 'right' : (typeof (cell.v) === 'number' ? 'right' : 'left');
        }
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    return table;
  }
  async function generatePdf() {
    var jsPDFctor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFctor || !window.html2canvas) { window.print(); return; }
    var sheets = currentSheets(); if (!sheets.length) { setStatus(t('importEmpty'), true); return; }
    var active = sheets.filter(function (s) { return s.status === 1; })[0] || sheets[0];
    var table = buildPdfTable(active);
    if (!table) { setStatus(t('importEmpty'), true); return; }
    setStatus(t('pdfGenerating'), false, true);
    var holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-99999px;top:0;background:#fff;padding:24px';
    holder.appendChild(table); document.body.appendChild(holder);
    try {
      await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
      var canvas = await window.html2canvas(holder, { scale: 2, backgroundColor: '#ffffff' });
      var pw = 210, ph = 297;                       /* A4 แนวตั้ง (mm) */
      var pdf = new jsPDFctor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var pxPerMm = canvas.width / pw, pageHpx = Math.floor(ph * pxPerMm), sy = 0, first = true;
      while (sy < canvas.height - 1) {
        var sh = Math.min(pageHpx, canvas.height - sy);
        var c2 = document.createElement('canvas'); c2.width = canvas.width; c2.height = sh;
        var ctx = c2.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c2.width, sh);
        ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
        if (!first) pdf.addPage('a4', 'portrait');
        pdf.addImage(c2.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pw, sh / pxPerMm);
        sy += sh; first = false;
      }
      pdf.save((active.name || 'spreadsheet') + '.pdf');
      setStatus(t('pdfDone'));
    } catch (e) { setStatus(t('pdfError', { msg: e.message }), true); }
    finally { document.body.removeChild(holder); }
  }

  /* ── wiring ── */
  els.newBtn.addEventListener('click', function () {
    if (!confirm(t('newConfirm'))) return;
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) {}
    createSheet(defaultData());
    setStatus(t('newDone'));
  });
  els.importBtn.addEventListener('click', function () { els.fileInput.click(); });
  els.fileInput.addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (f) importFile(f);
    els.fileInput.value = '';
  });
  els.exportXlsxBtn.addEventListener('click', exportXlsx);
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.printBtn.addEventListener('click', generatePdf);
  if (els.langToggle) {
    els.langToggle.addEventListener('click', function () {
      setUILang(getUILang() === 'en' ? 'th' : 'en');
      applyStaticI18n();
    });
  }

  /* ── init ── */
  var rsz = null;
  window.addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(function () { applyGridHeight(false); }, 200); });
  window.addEventListener('orientationchange', function () { setTimeout(function () { applyGridHeight(true); }, 320); });

  /* เรียก fn หลัง layout นิ่งจริง (โหลดหน้าเสร็จ + shell.js แทรกเมนูบนแล้ว + 2 เฟรม)
     สำคัญมากบน iOS Safari: ถ้าเรียก luckysheet.create เร็วเกินไปตอน layout ยังไม่นิ่ง
     Luckysheet จะอ่านตำแหน่ง element ที่ยังไม่มี → error "reading 'left'" → ค้างที่ Loading… */
  function whenLayoutReady(fn) {
    var fire = function () { requestAnimationFrame(function () { requestAnimationFrame(function () { setTimeout(fn, 60); }); }); };
    if (document.readyState === 'complete') fire();
    else window.addEventListener('load', fire, { once: true });
  }
  /* Luckysheet ผูก document.touchmove → preventDefault ทั่วหน้า ทำให้เลื่อน "หน้าเว็บ" ด้วยนิ้วไม่ได้
     ดักในเฟส capture: ถ้านิ้วอยู่ "นอกกริด" ให้หยุด handler ของ Luckysheet (หน้าเลื่อนตามปกติ)
     ถ้าอยู่ "บนกริด" ปล่อยผ่านให้ Luckysheet จัดการเลื่อนกริดเอง */
  document.addEventListener('touchmove', function (e) {
    if (!(els.grid && els.grid.contains(e.target))) e.stopImmediatePropagation();
  }, { capture: true, passive: true });

  function boot() {
    applyStaticI18n();
    var waited = 0;
    (function waitLib() {
      if (window.luckysheet && typeof luckysheet.create === 'function') {
        var data = defaultData(), restored = false;
        try {
          var raw = localStorage.getItem(AUTOSAVE_KEY);
          if (raw) { var saved = JSON.parse(raw); if (saved && saved.length) { data = saved; restored = true; } }
        } catch (e) {}
        whenLayoutReady(function () {
          createSheet(data);
          setStatus(restored ? t('restored') : t('autosaveReady'));
        });
        return;
      }
      waited += 200;
      if (waited > 12000) {
        if (els.loading) els.loading.innerHTML = '<div style="max-width:340px;text-align:center;padding:20px">' + t('libError') + '</div>';
        setStatus(t('libError'), true);
        return;
      }
      setTimeout(waitLib, 200);
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
