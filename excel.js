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
      toolHint: 'เครื่องมือครบชุด (แถบด้านบน): ฟอนต์ · สี/พื้น · เส้นขอบ · จัดชิด · ผสานเซลล์ · รูปแบบตัวเลข (฿, %, วันที่) · สูตร · เรียง/กรอง · ตรึงแถว-คอลัมน์ · หลายชีต (แท็บล่าง) — ทำงานในเบราว์เซอร์ทั้งหมด ไฟล์ไม่ถูกส่งขึ้นเซิร์ฟเวอร์',
      footerText: 'Tanot — งานที่รับผิดชอบ', creditsLink: 'เครดิต & ลิขสิทธิ์',
      autosaveReady: 'พร้อมใช้งาน', autosaveSaving: 'กำลังบันทึก…', autosaveSaved: 'บันทึกอัตโนมัติแล้ว',
      restored: 'เปิดงานล่าสุดที่บันทึกไว้',
      importing: 'กำลังนำเข้าไฟล์…', imported: 'นำเข้าไฟล์ “{name}” เรียบร้อยแล้ว',
      importError: 'นำเข้าไฟล์ไม่สำเร็จ: {msg}', importEmpty: 'ไม่พบข้อมูลในไฟล์',
      exporting: 'กำลังสร้างไฟล์…', exported: 'ดาวน์โหลดไฟล์เรียบร้อยแล้ว',
      exportError: 'ดาวน์โหลดไม่สำเร็จ: {msg}',
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
      toolHint: 'Full toolbar (top bar): font · color/fill · borders · align · merge cells · number formats (฿, %, date) · formulas · sort/filter · freeze rows-columns · multiple sheets (bottom tabs) — all in your browser; files are never uploaded.',
      footerText: 'Tanot — Responsibilities', creditsLink: 'Credits & licenses',
      autosaveReady: 'Ready', autosaveSaving: 'Saving…', autosaveSaved: 'Autosaved',
      restored: 'Restored your last saved work',
      importing: 'Importing file…', imported: 'Imported “{name}”',
      importError: 'Import failed: {msg}', importEmpty: 'No data found in the file',
      exporting: 'Generating file…', exported: 'File downloaded',
      exportError: 'Download failed: {msg}',
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
    langToggle: $('langToggle'), statusMsg: $('statusMsg'), loading: $('loading'),
    newBtn: $('newBtn'), importBtn: $('importBtn'), fileInput: $('fileInput'),
    exportXlsxBtn: $('exportXlsxBtn'), exportCsvBtn: $('exportCsvBtn'), printBtn: $('printBtn')
  };

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
      try {
        var sheets = luckysheet.getAllSheets();
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(sheets));
        setStatus(t('autosaveSaved'));
      } catch (e) {}
    }, 1200);
  }

  /* ── สร้าง/สร้างใหม่ Luckysheet ── */
  function baseOptions(data) {
    return {
      container: 'luckysheet',
      lang: 'en',
      data: data,
      title: 'Tanot',
      showinfobar: false,
      showsheetbarConfig: { add: true, menu: true, sheet: true },
      hook: {
        updated: scheduleSave,
        sheetActivate: function () {},
        workbookCreateAfter: function () { hideLoading(); }
      }
    };
  }
  function hideLoading() { if (els.loading) els.loading.classList.add('hide'); }
  function createSheet(data) {
    if (!window.luckysheet) return;
    try { luckysheet.destroy(); } catch (e) {}
    luckysheet.create(baseOptions(data || defaultData()));
    setTimeout(hideLoading, 600);   /* สำรอง ถ้า hook ไม่ยิง */
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
  els.printBtn.addEventListener('click', function () { window.print(); });
  if (els.langToggle) {
    els.langToggle.addEventListener('click', function () {
      setUILang(getUILang() === 'en' ? 'th' : 'en');
      applyStaticI18n();
    });
  }

  /* ── init ── */
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
        createSheet(data);
        setStatus(restored ? t('restored') : t('autosaveReady'));
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
