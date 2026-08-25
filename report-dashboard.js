/* ══════════════════════════════════════════════════════════════════
   Tanot — นำเสนอรายงาน
   Stage 1: อ่าน .xlsx/.xls/.csv ด้วย SheetJS (ตัวเดียวกับที่หน้า "งาน Excel" ใช้อยู่แล้ว — clone-and-adapt)
            ตารางเบาๆ ของตัวเอง (ไม่ใช้ Luckysheet เต็มรูปแบบ) เรียง/กรอง/แก้ไขเซลล์/เพิ่ม-ลบแถว/เลิกทำ/แบ่งหน้า
   Stage 2: มุมมอง "แดชบอร์ด" — สรุปตัวเลข + กราฟแท่ง/เส้น/วงกลม สร้างอัตโนมัติจากชนิดข้อมูลที่เดาไว้ตั้งแต่
            Stage 1 (number/date/category/text) ด้วย Chart.js (CDN — เพิ่มใหม่ ยังไม่มีไลบรารีทำกราฟแท่ง/
            วงกลมแบบมีปฏิสัมพันธ์ในเว็บนี้มาก่อน) แดชบอร์ดสรุปจากข้อมูล "ทั้งหมด" เสมอ ไม่ผูกกับตัวกรองที่ตั้งไว้
            ในมุมมองตาราง (ยังไม่มีการเชื่อมตัวกรอง/คลิกกราฟเพื่อกรอง — เป็นแผนของ stage ถัดไป)
   • เก็บงานปัจจุบันไว้ใน IndexedDB (ไม่ใช้ localStorage เพราะข้อมูลจาก Excel อาจใหญ่เกินเพดาน) —
     ตอนนี้เก็บได้ทีละ 1 ชุด (resume ได้ถ้าปิดแท็บ/รีเฟรชไปแล้ว) ส่วนบันทึกหลายรายงานเป็น stage ถัดไป
   ทุกอย่างทำงานฝั่งเบราว์เซอร์ ไฟล์ไม่ถูกส่งขึ้นเซิร์ฟเวอร์
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var PAGE_SIZE = 50;
  var HISTORY_MAX = 20;
  var HEADER_PREVIEW_ROWS = 8;

  var state = {
    fileName: null,
    sheetNames: [],
    activeSheet: null,
    workbook: null,       // XLSX workbook object (kept while picking sheet/header)
    rawAoA: null,         // array-of-arrays of the active sheet, for header-row picking
    headerRowIdx: 0,
    columns: [],          // [{ key, label, type }]  type: 'number'|'date'|'category'|'text'
    rows: [],             // [{ __id, <colKey>: value, ... }]
    nextRowId: 1,
    filters: {},          // colKey -> string (substring match) | { min, max } for number/date
    globalQuery: '',
    sortCol: null, sortDir: null, // 'asc' | 'desc'
    selected: {},          // rowId -> true
    page: 1,
    history: [],           // snapshots for undo: { columns, rows, nextRowId }
    drill: null,           // { key, label, value } — จากคลิกแท่ง/ชิ้นวงกลมในแดชบอร์ด กรองทั้งตาราง+แดชบอร์ด
    chartChoice: { barCat: null, barNum: null, pieCat: null, lineDate: null, lineNum: null }, // null = auto
    chartType: { slot1: null, slot2: null, slot3: null }, // null = ดีฟอลต์ของสล็อตนั้น (bar/line/doughnut)
    reportId: null,        // ถ้าไม่ null = ผูกกับรายงานที่ตั้งชื่อบันทึกไว้ใน store 'reports' (Stage 4) — autosave เข้าที่นี่ด้วย
    reportName: null
  };

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }

  /* ══════════════════ IndexedDB ══════════════════
     store 'current' — งานที่ทำค้างไว้ล่าสุด 1 ชุดเสมอ (กันข้อมูลหายถ้าปิดแท็บ/รีเฟรชโดยไม่ได้บันทึก)
     store 'reports' (Stage 4) — คลังรายงานที่ตั้งชื่อบันทึกไว้ถาวร หลายรายงานพร้อมกันได้ */
  var DB_NAME = 'tanot-report-dashboard', DB_STORE = 'current', DB_REPORTS = 'reports', DB_VERSION = 2;
  function dbOpen() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('เบราว์เซอร์นี้ไม่รองรับ IndexedDB')); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(DB_REPORTS)) db.createObjectStore(DB_REPORTS, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function dbSaveCurrent(payload) {
    return dbOpen().then(function (db) { return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, 'readwrite');
      payload.id = 'current';
      var req = tx.objectStore(DB_STORE).put(payload);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    }); }).catch(function () { /* บันทึกไม่สำเร็จ (เช่น โควต้าเต็ม) — ปล่อยผ่าน ไม่บล็อกการใช้งาน */ });
  }
  function dbLoadCurrent() {
    return dbOpen().then(function (db) { return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, 'readonly');
      var req = tx.objectStore(DB_STORE).get('current');
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error); };
    }); }).catch(function () { return null; });
  }
  function dbClearCurrent() {
    return dbOpen().then(function (db) { return new Promise(function (resolve) {
      var tx = db.transaction(DB_STORE, 'readwrite');
      var req = tx.objectStore(DB_STORE).delete('current');
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { resolve(); };
    }); }).catch(function () {});
  }
  /* ── Stage 4: คลังรายงาน (หลายชุด, ตั้งชื่อเอง) ── */
  function dbAddReport(rec) {
    return dbOpen().then(function (db) { return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_REPORTS, 'readwrite');
      var req = tx.objectStore(DB_REPORTS).add(rec);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    }); });
  }
  function dbPutReport(rec) {
    return dbOpen().then(function (db) { return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_REPORTS, 'readwrite');
      var req = tx.objectStore(DB_REPORTS).put(rec);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    }); }).catch(function () {});
  }
  function dbListReports() {
    return dbOpen().then(function (db) { return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_REPORTS, 'readonly');
      var req = tx.objectStore(DB_REPORTS).getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    }); }).catch(function () { return []; });
  }
  function dbGetReport(id) {
    return dbOpen().then(function (db) { return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_REPORTS, 'readonly');
      var req = tx.objectStore(DB_REPORTS).get(id);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error); };
    }); }).catch(function () { return null; });
  }
  function dbDeleteReport(id) {
    return dbOpen().then(function (db) { return new Promise(function (resolve) {
      var tx = db.transaction(DB_REPORTS, 'readwrite');
      var req = tx.objectStore(DB_REPORTS).delete(id);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { resolve(); };
    }); }).catch(function () {});
  }

  var persistTimer = null;
  function persistDebounced() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      var payload = {
        fileName: state.fileName, sheetName: state.activeSheet,
        columns: state.columns, rows: state.rows, nextRowId: state.nextRowId,
        reportId: state.reportId, reportName: state.reportName,
        savedAt: Date.now()
      };
      dbSaveCurrent(payload);
      /* ถ้างานนี้ผูกกับรายงานที่ตั้งชื่อบันทึกไว้แล้ว (Stage 4) ให้ autosave เข้ารายงานนั้นตรงๆ ด้วย
         ไม่ต้องกดบันทึกซ้ำทุกครั้งที่แก้ไข */
      if (state.reportId) {
        dbPutReport({
          id: state.reportId, name: state.reportName, fileName: state.fileName, sheetName: state.activeSheet,
          columns: state.columns, rows: state.rows, nextRowId: state.nextRowId, savedAt: Date.now()
        });
        setSaveStatus('บันทึกอัตโนมัติแล้ว · ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }), 'ok');
      }
    }, 400);
  }
  function setSaveStatus(msg, cls) { var el = $('saveStatus'); if (!el) return; el.textContent = msg || ''; el.className = 'status' + (cls ? ' ' + cls : ''); }

  function deepClone(v) {
    if (typeof structuredClone === 'function') { try { return structuredClone(v); } catch (e) {} }
    return JSON.parse(JSON.stringify(v), function (k, val) {
      /* JSON round-trip ทำให้ Date object กลายเป็น string ISO — พลิกกลับเป็น Date ถ้ารูปแบบตรง */
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) { var d = new Date(val); if (!isNaN(d)) return d; }
      return val;
    });
  }

  /* ══════════════════ แถบเครื่องมือ: history/undo ══════════════════ */
  function pushHistory() {
    state.history.push(deepClone({ columns: state.columns, rows: state.rows, nextRowId: state.nextRowId }));
    if (state.history.length > HISTORY_MAX) state.history.shift();
    $('undoBtn').disabled = false;
  }
  function undo() {
    if (!state.history.length) return;
    var snap = state.history.pop();
    state.columns = snap.columns; state.rows = snap.rows; state.nextRowId = snap.nextRowId;
    state.selected = {};
    $('undoBtn').disabled = state.history.length === 0;
    state.page = 1;
    renderTable();
    persistDebounced();
  }

  /* ══════════════════ ชนิดข้อมูล ══════════════════ */
  function inferColumnType(values) {
    var nonNull = values.filter(function (v) { return v !== null && v !== undefined && v !== ''; });
    if (!nonNull.length) return 'text';
    var numCount = 0, dateCount = 0;
    nonNull.forEach(function (v) {
      if (v instanceof Date) dateCount++;
      else if (typeof v === 'number' && isFinite(v)) numCount++;
    });
    if (dateCount / nonNull.length > 0.7) return 'date';
    if (numCount / nonNull.length > 0.7) return 'number';
    /* ข้อความ — แยก category (ค่าไม่กี่แบบ ซ้ำกันบ่อย เหมาะทำกราฟแท่ง/วงกลม) ออกจาก text อิสระ */
    var uniq = {}; nonNull.forEach(function (v) { uniq[String(v)] = true; });
    var uniqCount = Object.keys(uniq).length;
    if (uniqCount <= 25 || uniqCount / nonNull.length <= 0.3) return 'category';
    return 'text';
  }

  /* ══════════════════ อัปโหลด/parse ══════════════════ */
  function setUploadStatus(msg, cls) { var el = $('uploadStatus'); el.textContent = msg || ''; el.className = 'status' + (cls ? ' ' + cls : ''); }

  function handleFile(file) {
    if (!file) return;
    setUploadStatus('กำลังอ่านไฟล์…', '');
    if (typeof XLSX === 'undefined') { setUploadStatus('โหลดไลบรารีอ่านไฟล์ไม่สำเร็จ (ลองออนไลน์แล้วรีเฟรช)', 'err'); return; }
    var reader = new FileReader();
    reader.onerror = function () { setUploadStatus('อ่านไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง', 'err'); };
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        if (!wb.SheetNames || !wb.SheetNames.length) throw new Error('empty workbook');
        onWorkbookParsed(wb, file.name);
      } catch (err) {
        setUploadStatus('ไฟล์นี้เปิดไม่ได้ — ตรวจว่าเป็น .xlsx/.xls/.csv ที่ไม่เสียหาย', 'err');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function onWorkbookParsed(wb, fileName) {
    state.workbook = wb; state.fileName = fileName; state.sheetNames = wb.SheetNames;
    setUploadStatus('', '');
    if (wb.SheetNames.length > 1) {
      showSheetPicker();
    } else {
      selectSheet(wb.SheetNames[0]);
    }
  }

  function showSheetPicker() {
    var html = '';
    state.sheetNames.forEach(function (name) {
      html += '<button type="button" class="chip" data-sheet="' + escapeAttr(name) + '">' + escapeHtml(name) + '</button>';
    });
    $('sheetChips').innerHTML = html;
    $('sheetCard').style.display = 'block';
    [].forEach.call($('sheetChips').querySelectorAll('.chip'), function (btn) {
      btn.addEventListener('click', function () {
        [].forEach.call($('sheetChips').querySelectorAll('.chip'), function (b) { b.classList.remove('on'); });
        btn.classList.add('on');
        selectSheet(btn.getAttribute('data-sheet'));
      });
    });
  }

  function selectSheet(name) {
    state.activeSheet = name;
    var sheet = state.workbook.Sheets[name];
    var aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    /* ตัดแถวว่างล้วนท้ายไฟล์ทิ้ง (พบบ่อยจากไฟล์ Excel ที่มีช่วงเซลล์เผื่อไว้เกินข้อมูลจริง) */
    while (aoa.length && aoa[aoa.length - 1].every(function (c) { return c === null || c === ''; })) aoa.pop();
    if (!aoa.length) { setUploadStatus('ชีตนี้ไม่มีข้อมูล — ลองเลือกชีตอื่น', 'err'); return; }
    state.rawAoA = aoa;
    state.headerRowIdx = 0;
    renderHeaderPreview();
    $('headerCard').style.display = 'block';
    $('headerCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderHeaderPreview() {
    var aoa = state.rawAoA, n = Math.min(HEADER_PREVIEW_ROWS, aoa.length);
    var maxCols = 0; for (var i = 0; i < n; i++) maxCols = Math.max(maxCols, aoa[i].length);
    var html = '<tbody>';
    for (i = 0; i < n; i++) {
      html += '<tr class="hdr-pick' + (i === state.headerRowIdx ? ' on' : '') + '" data-row="' + i + '">';
      for (var c = 0; c < maxCols; c++) {
        var v = aoa[i][c];
        html += '<td>' + escapeHtml(v == null ? '' : String(v)) + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody>';
    $('headerPreviewTable').innerHTML = html;
    [].forEach.call($('headerPreviewTable').querySelectorAll('tr.hdr-pick'), function (tr) {
      tr.addEventListener('click', function () {
        state.headerRowIdx = +tr.getAttribute('data-row');
        renderHeaderPreview();
      });
    });
  }

  function confirmHeader() {
    var built = buildColumnsAndRows(state.rawAoA, state.headerRowIdx);
    state.columns = built.columns; state.rows = built.rows; state.nextRowId = built.nextRowId;
    state.filters = {}; state.globalQuery = ''; $('globalSearch').value = '';
    state.sortCol = null; state.sortDir = null;
    state.selected = {}; state.page = 1; state.history = [];
    state.drill = null; state.chartChoice = { barCat: null, barNum: null, pieCat: null, lineDate: null, lineNum: null };
    state.chartType = { slot1: null, slot2: null, slot3: null };
    state.reportId = null; state.reportName = null;
    updateDrillBanner(); updateSaveUI();
    $('undoBtn').disabled = true;
    $('sheetCard').style.display = 'none';
    $('headerCard').style.display = 'none';
    $('uploadCard').style.display = 'none';
    $('resumeCard').style.display = 'none';
    $('reportsCard').style.display = 'none';
    $('dataMeta').textContent = (state.fileName || '') + (state.sheetNames.length > 1 ? ' · ' + state.activeSheet : '') + ' · ' + state.rows.length.toLocaleString('th-TH') + ' แถว';
    $('viewTabs').style.display = 'flex';
    setView('table'); // เรียก renderTable() ให้เองในตัว
    persistDebounced();
  }

  /* ══════════════════ สลับมุมมองตาราง/แดชบอร์ด ══════════════════ */
  var currentView = 'table';
  function setView(view) {
    currentView = view;
    [].forEach.call($('viewTabs').querySelectorAll('.chip'), function (b) { b.classList.toggle('on', b.getAttribute('data-view') === view); });
    $('dataCard').style.display = view === 'table' ? 'block' : 'none';
    $('dashboardView').style.display = view === 'dashboard' ? 'block' : 'none';
    /* render ใหม่ทุกครั้งที่สลับเข้ามุมมองนั้น (ไม่ใช่แค่ตอน confirmHeader()/resume ครั้งแรก) — กันเห็น
       ข้อมูลเก่าค้าง เช่น กด drill-down จากแดชบอร์ดแล้วสลับมาตาราง ต้องเห็นตารางกรองตามด้วย */
    if (view === 'dashboard') renderDashboard(); else renderTable();
  }

  function buildColumnsAndRows(aoa, headerIdx) {
    var headerRow = aoa[headerIdx] || [];
    var dataRows = aoa.slice(headerIdx + 1);
    var maxCols = headerRow.length;
    dataRows.forEach(function (r) { maxCols = Math.max(maxCols, r.length); });

    var columns = [];
    for (var c = 0; c < maxCols; c++) {
      var label = headerRow[c];
      label = (label == null || String(label).trim() === '') ? ('คอลัมน์ ' + (c + 1)) : String(label);
      columns.push({ key: 'col_' + c, label: label });
    }
    /* ตัดแถวว่างล้วนออกก่อนคำนวณชนิดข้อมูล/ก่อนแสดงผล */
    dataRows = dataRows.filter(function (r) { return r.some(function (v) { return v !== null && v !== undefined && v !== ''; }); });

    var rows = [], nextId = 1;
    dataRows.forEach(function (r) {
      var row = { __id: nextId++ };
      columns.forEach(function (col, ci) { row[col.key] = r[ci] === undefined ? null : r[ci]; });
      rows.push(row);
    });
    columns.forEach(function (col) {
      col.type = inferColumnType(rows.map(function (r) { return r[col.key]; }));
    });
    return { columns: columns, rows: rows, nextRowId: nextId };
  }

  /* ══════════════════ format/escape ══════════════════ */
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function escapeAttr(s) { return escapeHtml(s); }
  function cellEditValue(v, type) {
    if (v === null || v === undefined) return '';
    if (type === 'date' && v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    return String(v);
  }

  /* ══════════════════ กรอง/เรียง/แบ่งหน้า ══════════════════ */
  function matchesDrill(row) {
    if (!state.drill) return true;
    var v = row[state.drill.key];
    /* คอลัมน์วันที่: ต้องแปลงเป็น yyyy-mm-dd แบบเดียวกับ label บนแกนกราฟเส้น (aggregateByDate) ก่อนเทียบ —
       ไม่งั้น String(Date object) จะได้รูปแบบยาวที่ไม่มีทางตรงกับ label ที่คลิกเลย กรองไม่เจอสักแถว */
    var s;
    if (v instanceof Date && !isNaN(v)) s = v.toISOString().slice(0, 10);
    else s = (v === null || v === undefined || v === '') ? '(ว่าง)' : String(v);
    return s === state.drill.value;
  }
  function matchesFilters(row) {
    if (!matchesDrill(row)) return false;
    for (var i = 0; i < state.columns.length; i++) {
      var col = state.columns[i], f = state.filters[col.key];
      if (!f) continue;
      var v = row[col.key];
      if (col.type === 'number' || col.type === 'date') {
        if (f.min !== undefined && f.min !== '' && f.min !== null) {
          var minV = col.type === 'date' ? new Date(f.min) : num(f.min);
          if (v == null || (col.type === 'date' ? (v < minV) : (num(v) < minV))) return false;
        }
        if (f.max !== undefined && f.max !== '' && f.max !== null) {
          var maxV = col.type === 'date' ? new Date(f.max) : num(f.max);
          if (v == null || (col.type === 'date' ? (v > maxV) : (num(v) > maxV))) return false;
        }
      } else {
        if (f.q) {
          var hay = (v == null ? '' : String(v)).toLowerCase();
          if (hay.indexOf(String(f.q).toLowerCase()) === -1) return false;
        }
      }
    }
    if (state.globalQuery) {
      var q = state.globalQuery.toLowerCase(), hit = false;
      for (var j = 0; j < state.columns.length; j++) {
        var vv = row[state.columns[j].key];
        if (vv != null && String(vv).toLowerCase().indexOf(q) !== -1) { hit = true; break; }
      }
      if (!hit) return false;
    }
    return true;
  }
  function getFilteredSorted() {
    var out = state.rows.filter(matchesFilters);
    if (state.sortCol && state.sortDir) {
      var col = state.columns.filter(function (c) { return c.key === state.sortCol; })[0];
      var dir = state.sortDir === 'asc' ? 1 : -1;
      out = out.slice().sort(function (a, b) {
        var va = a[state.sortCol], vb = b[state.sortCol];
        if (va == null && vb == null) return 0;
        if (va == null) return 1; if (vb == null) return -1;
        if (col && col.type === 'number') return (va - vb) * dir;
        if (col && col.type === 'date') return (new Date(va) - new Date(vb)) * dir;
        return String(va).localeCompare(String(vb), 'th') * dir;
      });
    }
    return out;
  }

  /* ══════════════════ วาดตาราง ══════════════════ */
  function renderTable() {
    var all = getFilteredSorted();
    var totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    var start = (state.page - 1) * PAGE_SIZE;
    var pageRows = all.slice(start, start + PAGE_SIZE);

    var thead = '<thead><tr>' +
      '<th style="width:30px"><input type="checkbox" class="hdrchk" id="hdrChk"></th>' +
      state.columns.map(function (col) {
        var sorted = state.sortCol === col.key;
        var ic = sorted ? (state.sortDir === 'asc' ? '▲' : '▼') : '↕';
        return '<th class="' + (col.type === 'number' ? 'num' : '') + (sorted ? ' sorted' : '') + '" data-col="' + col.key + '">' +
          escapeHtml(col.label) + '<span class="sort-ic">' + ic + '</span></th>';
      }).join('') +
      '<th style="width:34px"></th>' +
      '</tr><tr class="filter-row">' +
      '<td></td>' +
      state.columns.map(function (col) {
        var f = state.filters[col.key];
        if (col.type === 'number' || col.type === 'date') {
          var minV = f && f.min != null ? f.min : '', maxV = f && f.max != null ? f.max : '';
          var inType = col.type === 'date' ? 'date' : 'number';
          return '<td><div class="filter-range">' +
            '<input class="filter-in" type="' + inType + '" data-col="' + col.key + '" data-k="min" value="' + escapeAttr(minV) + '" placeholder="ต่ำสุด">' +
            '<input class="filter-in" type="' + inType + '" data-col="' + col.key + '" data-k="max" value="' + escapeAttr(maxV) + '" placeholder="สูงสุด">' +
            '</div></td>';
        }
        var q = f && f.q ? f.q : '';
        return '<td><input class="filter-in" type="text" data-col="' + col.key + '" data-k="q" value="' + escapeAttr(q) + '" placeholder="กรอง…"></td>';
      }).join('') +
      '<td></td></tr></thead>';

    var tbody = '<tbody>';
    if (!pageRows.length) {
      tbody += '';
    } else {
      pageRows.forEach(function (row) {
        tbody += '<tr data-id="' + row.__id + '">' +
          '<td><input type="checkbox" class="rowchk" data-id="' + row.__id + '"' + (state.selected[row.__id] ? ' checked' : '') + '></td>' +
          state.columns.map(function (col) {
            var v = cellEditValue(row[col.key], col.type);
            var inputType = col.type === 'number' ? 'number' : (col.type === 'date' ? 'date' : 'text');
            return '<td class="' + (col.type === 'number' ? 'num' : '') + '"><input class="cell-in" type="' + inputType +
              '" data-id="' + row.__id + '" data-col="' + col.key + '" value="' + escapeAttr(v) + '"' + (col.type === 'number' ? ' step="any"' : '') + '></td>';
          }).join('') +
          '<td class="rowdel"><button type="button" class="del1" data-id="' + row.__id + '" title="ลบแถวนี้">✕</button></td>' +
          '</tr>';
      });
    }
    tbody += '</tbody>';
    $('dataTable').innerHTML = thead + tbody;
    $('dataEmpty').style.display = pageRows.length ? 'none' : 'block';

    renderPager(all.length, totalPages);
    wireTableEvents();
    $('dataMeta').textContent = (state.fileName || '') + (state.sheetNames.length > 1 ? ' · ' + state.activeSheet : '') +
      ' · ' + state.rows.length.toLocaleString('th-TH') + ' แถว' + (all.length !== state.rows.length ? ' (กรองเหลือ ' + all.length.toLocaleString('th-TH') + ')' : '');
    $('statRow').style.display = 'grid';
    $('statTotal').innerHTML = state.rows.length.toLocaleString('th-TH') + ' <span class="unit">แถว</span>';
    $('statCols').innerHTML = state.columns.length.toLocaleString('th-TH') + ' <span class="unit">คอลัมน์</span>';
    $('statShown').innerHTML = all.length.toLocaleString('th-TH') + ' <span class="unit">แถว</span>';
    updateSelectionUI();
  }

  /* อัปเดตปุ่มลบที่เลือก + การ์ดสถิติ "เลือกไว้" จาก state.selected ตรงๆ — เรียกทั้งจาก renderTable()
     (หลัง render ใหม่ทั้งตาราง) และจาก event ของ checkbox เดี่ยวๆ (ไม่ต้อง render ใหม่ทั้งตาราง) */
  function updateSelectionUI() {
    var selCount = Object.keys(state.selected).filter(function (k) { return state.selected[k]; }).length;
    $('delSelBtn').disabled = selCount === 0;
    $('statSelected').innerHTML = selCount.toLocaleString('th-TH') + ' <span class="unit">แถว</span>';
  }

  function renderPager(total, totalPages) {
    if (total <= PAGE_SIZE) { $('pager').innerHTML = ''; return; }
    var html = '<button type="button" class="btn sm" id="pgPrev"' + (state.page <= 1 ? ' disabled' : '') + '>← ก่อนหน้า</button>' +
      '<span>หน้า ' + state.page + ' / ' + totalPages + ' (' + total.toLocaleString('th-TH') + ' แถว)</span>' +
      '<button type="button" class="btn sm" id="pgNext"' + (state.page >= totalPages ? ' disabled' : '') + '>ถัดไป →</button>';
    $('pager').innerHTML = html;
    var prev = $('pgPrev'), next = $('pgNext');
    if (prev) prev.addEventListener('click', function () { state.page--; renderTable(); });
    if (next) next.addEventListener('click', function () { state.page++; renderTable(); });
  }

  function wireTableEvents() {
    /* เรียงคอลัมน์ */
    [].forEach.call($('dataTable').querySelectorAll('thead tr:first-child th[data-col]'), function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-col');
        if (state.sortCol !== key) { state.sortCol = key; state.sortDir = 'asc'; }
        else if (state.sortDir === 'asc') { state.sortDir = 'desc'; }
        else { state.sortCol = null; state.sortDir = null; }
        state.page = 1;
        renderTable();
      });
    });
    /* กรองต่อคอลัมน์ */
    [].forEach.call($('dataTable').querySelectorAll('.filter-in'), function (inp) {
      inp.addEventListener('input', function () {
        var col = inp.getAttribute('data-col'), k = inp.getAttribute('data-k');
        if (!state.filters[col]) state.filters[col] = {};
        state.filters[col][k] = inp.value;
        state.page = 1;
        renderTable();
        /* คืนโฟกัสให้ input เดิมหลัง re-render (render ทั้งตารางใหม่ทุกครั้ง) */
        var again = $('dataTable').querySelector('.filter-in[data-col="' + col + '"][data-k="' + k + '"]');
        if (again) { again.focus(); var val = again.value; again.value = ''; again.value = val; }
      });
    });
    /* แก้ไขเซลล์ */
    [].forEach.call($('dataTable').querySelectorAll('td .cell-in'), function (inp) {
      var origVal = inp.value;
      inp.addEventListener('focus', function () { origVal = inp.value; });
      inp.addEventListener('change', function () {
        if (inp.value === origVal) return;
        pushHistory();
        var id = +inp.getAttribute('data-id'), colKey = inp.getAttribute('data-col');
        commitCellEdit(id, colKey, inp.value);
      });
    });
    /* เลือกแถว (checkbox) — อัปเดตปุ่มลบ + การ์ดสถิติ "เลือกไว้" ตรงๆ โดยไม่ render ตารางใหม่ทั้งหมด
       (กันเช็คบ็อกซ์อื่นๆ ที่ผู้ใช้อาจกำลังจะกดต่อหลุด/รีเซ็ตตำแหน่งสกรอลล์) */
    [].forEach.call($('dataTable').querySelectorAll('.rowchk'), function (chk) {
      chk.addEventListener('change', function () {
        var id = +chk.getAttribute('data-id');
        if (chk.checked) state.selected[id] = true; else delete state.selected[id];
        updateSelectionUI();
      });
    });
    var hdrChk = $('hdrChk');
    if (hdrChk) hdrChk.addEventListener('change', function () {
      [].forEach.call($('dataTable').querySelectorAll('.rowchk'), function (chk) {
        chk.checked = hdrChk.checked;
        var id = +chk.getAttribute('data-id');
        if (hdrChk.checked) state.selected[id] = true; else delete state.selected[id];
      });
      updateSelectionUI();
    });
    /* ลบทีละแถว */
    [].forEach.call($('dataTable').querySelectorAll('.del1'), function (btn) {
      btn.addEventListener('click', function () {
        pushHistory();
        deleteRows([+btn.getAttribute('data-id')]);
      });
    });
  }

  function commitCellEdit(rowId, colKey, rawVal) {
    var row = state.rows.filter(function (r) { return r.__id === rowId; })[0];
    if (!row) return;
    var col = state.columns.filter(function (c) { return c.key === colKey; })[0];
    var newVal;
    if (rawVal === '') newVal = null;
    else if (col && col.type === 'number') { var n = num(rawVal); newVal = isFinite(n) ? n : rawVal; }
    else if (col && col.type === 'date') { var d = new Date(rawVal); newVal = isNaN(d) ? rawVal : d; }
    else newVal = rawVal;
    row[colKey] = newVal;
    /* ค่าที่เพิ่งพิมพ์อาจทำให้ชนิดข้อมูลของคอลัมน์นี้เปลี่ยนไปจากเดิม (เช่น พิมพ์ตัวอักษรลงคอลัมน์ตัวเลข) —
       คำนวณชนิดใหม่จากข้อมูลทั้งคอลัมน์เสมอหลังแก้ไข กันตารางแสดงผลผิดเพี้ยน */
    if (col) col.type = inferColumnType(state.rows.map(function (r) { return r[col.key]; }));
    renderTable();
    persistDebounced();
  }

  function addRow() {
    pushHistory();
    var row = { __id: state.nextRowId++ };
    state.columns.forEach(function (col) { row[col.key] = null; });
    state.rows.push(row);
    /* แถวใหม่เป็นค่าว่างล้วน — ล้างตัวกรอง/คำค้นที่อาจซ่อนแถวนี้ไว้ ไม่งั้นเพิ่มแล้วจะดูเหมือนไม่มีอะไรเกิดขึ้น */
    state.filters = {}; state.globalQuery = ''; $('globalSearch').value = '';
    state.page = Math.ceil(state.rows.length / PAGE_SIZE) || 1;
    renderTable();
    persistDebounced();
    var firstInput = $('dataTable').querySelector('tr[data-id="' + row.__id + '"] .cell-in');
    if (firstInput) firstInput.focus();
  }

  function deleteRows(ids) {
    var idSet = {}; ids.forEach(function (id) { idSet[id] = true; });
    state.rows = state.rows.filter(function (r) { return !idSet[r.__id]; });
    ids.forEach(function (id) { delete state.selected[id]; });
    renderTable();
    persistDebounced();
  }

  function deleteSelected() {
    var ids = Object.keys(state.selected).filter(function (k) { return state.selected[k]; }).map(Number);
    if (!ids.length) return;
    pushHistory();
    deleteRows(ids);
  }

  function clearAllFilters() {
    state.filters = {}; state.globalQuery = ''; $('globalSearch').value = '';
    state.page = 1;
    renderTable();
  }

  /* ══════════════════ มุมมองแดชบอร์ด (Stage 2) — สรุปตัวเลข + กราฟอัตโนมัติ ══════════════════
     ใช้ state.rows ทั้งหมดเสมอ (ไม่ผูกกับตัวกรอง/คำค้นของมุมมองตาราง) เพื่อไม่ต้องอธิบายเพิ่มว่าทำไม
     ตัวเลขสรุปดู "ไม่ครบ" — เชื่อมกับตัวกรองเป็นของ stage ถัดไป */
  var CHART_COLORS = ['#1E9E5A', '#1B2030', '#F59E0B', '#3B82F6', '#EC5E8A', '#8B5CF6', '#0EA5A5', '#EF4444', '#84CC16', '#64748B'];
  var charts = { bar: null, line: null, pie: null };
  var MAX_CHART_CATS = 8;

  function statOf(rows, key) {
    var vals = rows.map(function (r) { return r[key]; }).filter(function (v) { return typeof v === 'number' && isFinite(v); });
    if (!vals.length) return null;
    var sum = vals.reduce(function (a, b) { return a + b; }, 0);
    return { sum: sum, avg: sum / vals.length, min: Math.min.apply(null, vals), max: Math.max.apply(null, vals), count: vals.length };
  }
  /* รวมยอด (หรือถ้าไม่มีคอลัมน์ตัวเลข — นับจำนวนแถว) แยกตามค่าของคอลัมน์หมวดหมู่ — เอาเฉพาะ top N
     ค่าที่มากที่สุด รวมที่เหลือเป็น "อื่นๆ" กันกราฟรกเกินอ่านได้ถ้ามีหลายสิบหมวดหมู่ */
  function aggregateByCategory(rows, catKey, numKey) {
    var map = {}, order = [];
    rows.forEach(function (r) {
      var k = r[catKey]; k = (k === null || k === undefined || k === '') ? '(ว่าง)' : String(k);
      if (!(k in map)) { map[k] = 0; order.push(k); }
      map[k] += numKey ? (typeof r[numKey] === 'number' ? r[numKey] : 0) : 1;
    });
    var entries = order.map(function (k) { return [k, map[k]]; });
    entries.sort(function (a, b) { return b[1] - a[1]; });
    if (entries.length > MAX_CHART_CATS) {
      var top = entries.slice(0, MAX_CHART_CATS);
      var rest = entries.slice(MAX_CHART_CATS).reduce(function (s, e) { return s + e[1]; }, 0);
      top.push(['อื่นๆ', rest]);
      entries = top;
    }
    return entries;
  }
  /* รวมยอด (หรือนับจำนวน) แยกตามวันที่ (ตัดเหลือแค่ yyyy-mm-dd) เรียงตามเวลา */
  function aggregateByDate(rows, dateKey, numKey) {
    var map = {};
    rows.forEach(function (r) {
      var d = r[dateKey];
      if (!(d instanceof Date) || isNaN(d)) return;
      var k = d.toISOString().slice(0, 10);
      map[k] = (map[k] || 0) + (numKey ? (typeof r[numKey] === 'number' ? r[numKey] : 0) : 1);
    });
    return Object.keys(map).sort().map(function (k) { return [k, map[k]]; });
  }
  function destroyChart(key) { if (charts[key]) { try { charts[key].destroy(); } catch (e) {} charts[key] = null; } }

  /* ── เลือกชนิดกราฟเองได้ต่อการ์ด (แท่งแนวตั้ง/แนวนอน/เส้น/วงกลม/โดนัท) — ข้อมูลชุดเดียวกัน (labels+data)
     วาดเป็นชนิดไหนก็ได้ทั้งนั้น จึงใช้ตัวสร้าง config กลางตัวเดียวให้ทั้ง 3 การ์ด แทนที่จะผูกตายตัวว่า
     การ์ดไหนต้องเป็นกราฟแท่ง/เส้น/วงกลมเท่านั้นเหมือนเดิม */
  var CHART_TYPE_ICON = { bar: '📊', barH: '📊', line: '📈', pie: '🥧', doughnut: '🥧' };
  function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }
  function buildChartConfig(chartType, labels, data, singleColor) {
    if (chartType === 'pie' || chartType === 'doughnut') {
      return {
        type: chartType,
        data: { labels: labels, datasets: [{ data: data, backgroundColor: CHART_COLORS, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { boxWidth: 11, font: { size: 11 } } } } }
      };
    }
    if (chartType === 'line') {
      return {
        type: 'line',
        data: { labels: labels, datasets: [{ data: data, borderColor: singleColor, backgroundColor: hexToRgba(singleColor, .12), fill: true, tension: .3, pointRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, grid: { color: '#EEF0F4' } }, x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } } } }
      };
    }
    var horiz = chartType === 'barH'; // Chart.js ตัวเดียว 'bar' สลับแนวตั้ง/แนวนอนด้วย indexAxis
    return {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: singleColor, borderRadius: 6, maxBarThickness: 46 }] },
      options: { indexAxis: horiz ? 'y' : 'x', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: horiz
          ? { x: { beginAtZero: true, grid: { color: '#EEF0F4' } }, y: { grid: { display: false } } }
          : { y: { beginAtZero: true, grid: { color: '#EEF0F4' } }, x: { grid: { display: false } } } }
    };
  }

  /* ── Stage 3: กรองจากการคลิกกราฟ (drill-down) — ใช้ร่วมกันทั้งมุมมองตาราง (matchesFilters ด้านบน)
     และแดชบอร์ด (renderDashboard คำนวณจาก state.rows ที่ผ่าน drill แล้วเสมอ) ── */
  function setDrill(key, colLabel, value) {
    state.drill = { key: key, label: colLabel, value: value };
    updateDrillBanner();
    renderDashboard();
    if (currentView === 'table') renderTable();
  }
  function clearDrill() {
    if (!state.drill) return;
    state.drill = null;
    updateDrillBanner();
    renderDashboard();
    if (currentView === 'table') renderTable();
  }
  function updateDrillBanner() {
    if (state.drill) {
      $('drillBanner').style.display = 'flex';
      $('drillText').textContent = '🔍 กำลังกรอง: ' + escapeHtml(state.drill.label) + ' = ' + escapeHtml(state.drill.value);
    } else {
      $('drillBanner').style.display = 'none';
    }
  }

  /* ── Stage 3: เลือกคอลัมน์ที่ใช้ทำกราฟเอง (dropdown ต่อการ์ด) — null/ไม่เคยแตะ = ให้ระบบเดาที่ดีที่สุด
     ให้เองทุกครั้งที่ข้อมูลเปลี่ยน, พอผู้ใช้เลือกเองครั้งหนึ่งแล้วจะ "ติด" ค่านั้นไว้จนกว่าจะเปลี่ยนอีก ── */
  function resolveColChoice(chosenKey, cols, fallback) {
    if (chosenKey) { var found = cols.filter(function (c) { return c.key === chosenKey; })[0]; if (found) return found; }
    return fallback || null;
  }
  function fillSelect(el, items, currentKey, extraOption) {
    var html = '';
    if (extraOption) html += '<option value="">' + escapeHtml(extraOption) + '</option>';
    items.forEach(function (c) { html += '<option value="' + c.key + '"' + (c.key === currentKey ? ' selected' : '') + '>' + escapeHtml(c.label) + '</option>'; });
    el.innerHTML = html;
    el.disabled = !items.length;
  }

  function renderDashboard() {
    var rows = state.drill ? state.rows.filter(matchesDrill) : state.rows;
    var numCols = state.columns.filter(function (c) { return c.type === 'number'; });
    var dateCols = state.columns.filter(function (c) { return c.type === 'date'; });
    /* เรียงคอลัมน์หมวดหมู่จากค่าไม่ซ้ำน้อยไปมาก — คอลัมน์ที่ค่าซ้ำกันบ่อย (เช่น "ประเภท") เหมาะเป็นแกน
       กราฟแท่ง/วงกลมมากกว่าคอลัมน์ที่ค่าไม่ซ้ำเกือบทุกแถว (เช่น "ชื่อสินค้า" ที่บังเอิญถูกเดาเป็น category
       เพราะมีข้อมูลน้อยแถว) กันกราฟแท่งมี 1 แท่งต่อ 1 แถวซึ่งไม่มีประโยชน์อะไร — เป็นแค่ค่าเริ่มต้นแนะนำ
       ผู้ใช้เปลี่ยนได้เองเสมอผ่าน dropdown ของแต่ละการ์ด */
    var catCols = state.columns.filter(function (c) { return c.type === 'category'; }).map(function (c) {
      var uniq = {}; rows.forEach(function (r) { var v = r[c.key]; if (v !== null && v !== undefined && v !== '') uniq[String(v)] = true; });
      return { col: c, uniqCount: Object.keys(uniq).length };
    }).sort(function (a, b) { return a.uniqCount - b.uniqCount; }).map(function (e) { return e.col; });
    var anyRendered = false;

    /* ── สรุปตัวเลข (การ์ดสถิติ sum/avg/min/max ต่อคอลัมน์ตัวเลข สูงสุด 4 คอลัมน์) ── */
    if (numCols.length && rows.length) {
      var html = '';
      numCols.slice(0, 4).forEach(function (col) {
        var s = statOf(rows, col.key);
        if (!s) return;
        html += '<div class="stat-tile"><div class="lbl">' + escapeHtml(col.label) + '</div>' +
          '<div class="val">' + s.sum.toLocaleString('th-TH', { maximumFractionDigits: 2 }) + '</div>' +
          '<div class="sub">เฉลี่ย ' + s.avg.toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' · ต่ำสุด ' +
          s.min.toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' · สูงสุด ' + s.max.toLocaleString('th-TH', { maximumFractionDigits: 2 }) + '</div></div>';
      });
      if (html) { $('numStatRow').innerHTML = html; $('numStatCard').style.display = 'block'; anyRendered = true; }
      else $('numStatCard').style.display = 'none';
    } else $('numStatCard').style.display = 'none';

    var hasChartJs = typeof Chart !== 'undefined';

    /* ── การ์ด 1: คอลัมน์หมวดหมู่ × คอลัมน์ตัวเลข (เลือกคอลัมน์+ชนิดกราฟเองได้ทั้งหมด ค่าเริ่มต้นให้ระบบเดา) ── */
    destroyChart('bar');
    if (hasChartJs && catCols.length && rows.length) {
      var barCat = resolveColChoice(state.chartChoice.barCat, catCols, catCols[0]);
      var barNum = state.chartChoice.barNum === '' ? null : resolveColChoice(state.chartChoice.barNum, numCols, numCols[0]);
      var barType = state.chartType.slot1 || 'bar';
      fillSelect($('barCatSel'), catCols, barCat.key);
      fillSelect($('barNumSel'), numCols, barNum ? barNum.key : '', 'จำนวนรายการ (นับ)');
      $('barTypeSel').value = barType;
      var barEntries = aggregateByCategory(rows, barCat.key, barNum ? barNum.key : null);
      $('barChartTitle').textContent = CHART_TYPE_ICON[barType] + ' ' + (barNum ? (barCat.label + ' ตามผลรวม ' + barNum.label) : ('จำนวนรายการตาม ' + barCat.label));
      var barCfg = buildChartConfig(barType, barEntries.map(function (e) { return e[0]; }), barEntries.map(function (e) { return e[1]; }), '#1E9E5A');
      barCfg.options.onClick = function (evt, els) {
        if (!els || !els.length) return;
        var label = barEntries[els[0].index][0];
        if (label === 'อื่นๆ') return; // รวมหลายค่า กรองเป็นค่าเดียวไม่ได้จริง
        setDrill(barCat.key, barCat.label, label);
      };
      charts.bar = new Chart($('barChart').getContext('2d'), barCfg);
      $('barChartCard').style.display = 'block'; anyRendered = true;
    } else $('barChartCard').style.display = 'none';

    /* ── การ์ด 2: คอลัมน์วันที่ × คอลัมน์ตัวเลข (เลือกคอลัมน์+ชนิดกราฟเองได้ทั้งหมด) ── */
    destroyChart('line');
    if (hasChartJs && dateCols.length && rows.length) {
      var lineDate = resolveColChoice(state.chartChoice.lineDate, dateCols, dateCols[0]);
      var lineNum = state.chartChoice.lineNum === '' ? null : resolveColChoice(state.chartChoice.lineNum, numCols, numCols[0]);
      var lineType = state.chartType.slot2 || 'line';
      fillSelect($('lineDateSel'), dateCols, lineDate.key);
      fillSelect($('lineNumSel'), numCols, lineNum ? lineNum.key : '', 'จำนวนรายการ (นับ)');
      $('lineTypeSel').value = lineType;
      var lineEntries = aggregateByDate(rows, lineDate.key, lineNum ? lineNum.key : null);
      if (lineEntries.length >= 2) {
        $('lineChartTitle').textContent = CHART_TYPE_ICON[lineType] + ' ' + (lineNum ? ('แนวโน้ม ' + lineNum.label + ' ตามเวลา (' + lineDate.label + ')') : ('จำนวนรายการตามเวลา (' + lineDate.label + ')'));
        var lineCfg = buildChartConfig(lineType, lineEntries.map(function (e) { return e[0]; }), lineEntries.map(function (e) { return e[1]; }), '#1E9E5A');
        lineCfg.options.onClick = function (evt, els) {
          if (!els || !els.length) return;
          var label = lineEntries[els[0].index][0];
          setDrill(lineDate.key, lineDate.label, label);
        };
        charts.line = new Chart($('lineChart').getContext('2d'), lineCfg);
        $('lineChartCard').style.display = 'block'; anyRendered = true;
      } else $('lineChartCard').style.display = 'none';
    } else $('lineChartCard').style.display = 'none';

    /* ── การ์ด 3: สัดส่วนจำนวนแถวตามคอลัมน์หมวดหมู่ (เลือกคอลัมน์+ชนิดกราฟเองได้ ดีฟอลต์คอลัมน์ที่ 2
       ถ้ามี กันซ้ำมุมมองกับการ์ด 1) ── */
    destroyChart('pie');
    if (hasChartJs && catCols.length && rows.length) {
      var pieDefault = catCols.length > 1 ? catCols[1] : catCols[0];
      var pieCat = resolveColChoice(state.chartChoice.pieCat, catCols, pieDefault);
      var pieType = state.chartType.slot3 || 'doughnut';
      fillSelect($('pieCatSel'), catCols, pieCat.key);
      $('pieTypeSel').value = pieType;
      var pieEntries = aggregateByCategory(rows, pieCat.key, null);
      $('pieChartTitle').textContent = CHART_TYPE_ICON[pieType] + ' สัดส่วนจำนวนรายการตาม ' + pieCat.label;
      var pieCfg = buildChartConfig(pieType, pieEntries.map(function (e) { return e[0]; }), pieEntries.map(function (e) { return e[1]; }), '#1E9E5A');
      pieCfg.options.onClick = function (evt, els) {
        if (!els || !els.length) return;
        var label = pieEntries[els[0].index][0];
        if (label === 'อื่นๆ') return;
        setDrill(pieCat.key, pieCat.label, label);
      };
      charts.pie = new Chart($('pieChart').getContext('2d'), pieCfg);
      $('pieChartCard').style.display = 'block'; anyRendered = true;
    } else $('pieChartCard').style.display = 'none';

    if (!hasChartJs) {
      $('dashboardEmptyCard').style.display = 'block';
      $('dashboardEmptyCard').querySelector('.mini').textContent = 'โหลดไลบรารีทำกราฟไม่สำเร็จ (ลองออนไลน์แล้วรีเฟรช)';
    } else if (!anyRendered) {
      $('dashboardEmptyCard').style.display = 'block';
      $('dashboardEmptyCard').querySelector('.mini').textContent = rows.length
        ? 'ยังสรุปเป็นกราฟไม่ได้ — ต้องมีอย่างน้อย 1 คอลัมน์ตัวเลข หรือ 1 คอลัมน์หมวดหมู่ที่ไม่ใช่ข้อความอิสระเกินไป'
        : 'ไม่มีแถวข้อมูลที่ตรงกับตัวกรองที่ตั้งไว้ตอนนี้';
    } else {
      $('dashboardEmptyCard').style.display = 'none';
    }
  }

  /* ══════════════════ Stage 4: บันทึกหลายรายงาน ══════════════════
     'บันทึกเป็นรายงาน' ผูกงานปัจจุบันเข้ากับรายการถาวรใน store 'reports' — หลังจากนั้น persistDebounced()
     (ด้านบน) จะ autosave เข้ารายงานนี้ต่อทุกครั้งที่แก้ไข ไม่ต้องกดบันทึกซ้ำเอง */
  function updateSaveUI() {
    if (state.reportId) {
      $('saveReportBtn').textContent = '💾 บันทึกแล้ว: ' + state.reportName;
    } else {
      $('saveReportBtn').textContent = '💾 บันทึกเป็นรายงาน';
      setSaveStatus('', '');
    }
  }
  function saveAsReport() {
    if (state.reportId) {
      // ผูกอยู่แล้ว — ปุ่มนี้ทำหน้าที่ "บันทึกตอนนี้เลย" เผื่อไม่อยากรอ autosave debounce
      persistDebounced();
      setSaveStatus('กำลังบันทึก…', '');
      return;
    }
    var name = prompt('ตั้งชื่อรายงานนี้:', (state.fileName || 'รายงาน').replace(/\.[^.]+$/, ''));
    if (!name) return;
    name = name.trim(); if (!name) return;
    var rec = { name: name, fileName: state.fileName, sheetName: state.activeSheet,
      columns: state.columns, rows: state.rows, nextRowId: state.nextRowId, savedAt: Date.now() };
    dbAddReport(rec).then(function (id) {
      state.reportId = id; state.reportName = name;
      updateSaveUI();
      setSaveStatus('บันทึกเป็นรายงาน "' + name + '" แล้ว', 'ok');
      persistDebounced(); // อัปเดต draft ปัจจุบันให้มี reportId ผูกไว้ด้วย กัน resume แล้วหลุดการเชื่อมโยง
    }, function () {
      setSaveStatus('บันทึกไม่สำเร็จ ลองอีกครั้ง', 'err');
    });
  }
  function relativeTimeTh(ts) {
    var mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return 'เมื่อสักครู่';
    if (mins < 60) return mins + ' นาทีก่อน';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + ' ชม.ก่อน';
    return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function renderReportsList() {
    dbListReports().then(function (reports) {
      reports.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
      if (!reports.length) { $('reportsCard').style.display = 'none'; $('reportsList').innerHTML = ''; return; }
      $('reportsCard').style.display = 'block';
      $('reportsMeta').textContent = reports.length.toLocaleString('th-TH') + ' รายงาน';
      var html = '';
      reports.forEach(function (r) {
        html += '<div class="report-row" data-id="' + r.id + '">' +
          '<div><div class="rname">' + escapeHtml(r.name) + '</div>' +
          '<div class="rmeta">' + (r.rows ? r.rows.length.toLocaleString('th-TH') : 0) + ' แถว · บันทึกล่าสุด ' + relativeTimeTh(r.savedAt) + '</div></div>' +
          '<div class="ractions">' +
          '<button type="button" class="btn sm open-report" data-id="' + r.id + '">เปิด</button>' +
          '<button type="button" class="btn sm rename-report" data-id="' + r.id + '">✏️</button>' +
          '<button type="button" class="btn sm danger del-report" data-id="' + r.id + '">🗑️</button>' +
          '</div></div>';
      });
      $('reportsList').innerHTML = html;
      [].forEach.call($('reportsList').querySelectorAll('.open-report'), function (b) {
        b.addEventListener('click', function () { openReport(+b.getAttribute('data-id')); });
      });
      [].forEach.call($('reportsList').querySelectorAll('.rename-report'), function (b) {
        b.addEventListener('click', function () { renameReport(+b.getAttribute('data-id')); });
      });
      [].forEach.call($('reportsList').querySelectorAll('.del-report'), function (b) {
        b.addEventListener('click', function () { deleteReport(+b.getAttribute('data-id')); });
      });
    });
  }
  function openReport(id) {
    dbGetReport(id).then(function (rec) {
      if (!rec) { renderReportsList(); return; }
      state.fileName = rec.fileName; state.activeSheet = rec.sheetName; state.sheetNames = rec.sheetName ? [rec.sheetName] : [];
      state.columns = rec.columns; state.rows = rec.rows; state.nextRowId = rec.nextRowId;
      state.reportId = rec.id; state.reportName = rec.name;
      state.filters = {}; state.globalQuery = ''; state.sortCol = null; state.sortDir = null;
      state.selected = {}; state.page = 1; state.history = [];
      state.drill = null; state.chartChoice = { barCat: null, barNum: null, pieCat: null, lineDate: null, lineNum: null };
    state.chartType = { slot1: null, slot2: null, slot3: null };
      updateDrillBanner(); updateSaveUI();
      $('uploadCard').style.display = 'none'; $('reportsCard').style.display = 'none'; $('resumeCard').style.display = 'none';
      $('dataMeta').textContent = (state.fileName || rec.name) + ' · ' + state.rows.length.toLocaleString('th-TH') + ' แถว';
      $('viewTabs').style.display = 'flex';
      setView('table');
      persistDebounced();
    });
  }
  function renameReport(id) {
    dbGetReport(id).then(function (rec) {
      if (!rec) return;
      var name = prompt('เปลี่ยนชื่อรายงาน:', rec.name);
      if (!name) return;
      name = name.trim(); if (!name) return;
      rec.name = name;
      dbPutReport(rec).then(function () {
        if (state.reportId === id) { state.reportName = name; updateSaveUI(); }
        renderReportsList();
      });
    });
  }
  function deleteReport(id) {
    dbGetReport(id).then(function (rec) {
      if (!rec) return;
      if (!confirm('ลบรายงาน "' + rec.name + '" ถาวร (กู้คืนไม่ได้)?')) return;
      dbDeleteReport(id).then(function () {
        if (state.reportId === id) { state.reportId = null; state.reportName = null; updateSaveUI(); persistDebounced(); }
        renderReportsList();
      });
    });
  }

  /* ══════════════════ Stage 5: ส่งออก ══════════════════ */
  function exportFileBase() { return (state.reportName || (state.fileName || 'รายงาน').replace(/\.[^.]+$/, '')); }
  function buildExportRows() {
    /* จัดรูปแบบวันที่เป็นสตริง yyyy-mm-dd เองตรงๆ แทนที่จะส่ง Date object ดิบเข้า SheetJS —
       กันพฤติกรรมแปลง Date เป็นเลขลำดับวันของ Excel/รูปแบบอื่นที่ควบคุมไม่ได้ ให้ไฟล์ที่ส่งออกอ่านง่าย
       และหน้าตาเหมือนกันแน่นอนทั้ง .xlsx และ .csv */
    return state.rows.map(function (r) {
      var o = {};
      state.columns.forEach(function (col) {
        var v = r[col.key];
        if (v instanceof Date && !isNaN(v)) o[col.label] = v.toISOString().slice(0, 10);
        else o[col.label] = (v === null || v === undefined) ? '' : v;
      });
      return o;
    });
  }
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportXlsx() {
    if (typeof XLSX === 'undefined') { setUploadStatus('', ''); alert('โหลดไลบรารีส่งออกไม่สำเร็จ (ลองออนไลน์แล้วรีเฟรช)'); return; }
    if (!state.rows.length) { alert('ยังไม่มีข้อมูลให้ส่งออก'); return; }
    var ws = XLSX.utils.json_to_sheet(buildExportRows());
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (state.activeSheet || 'Sheet1').slice(0, 31));
    XLSX.writeFile(wb, exportFileBase() + '.xlsx');
  }
  function exportCsv() {
    if (typeof XLSX === 'undefined') { alert('โหลดไลบรารีส่งออกไม่สำเร็จ (ลองออนไลน์แล้วรีเฟรช)'); return; }
    if (!state.rows.length) { alert('ยังไม่มีข้อมูลให้ส่งออก'); return; }
    var ws = XLSX.utils.json_to_sheet(buildExportRows());
    var csv = XLSX.utils.sheet_to_csv(ws);
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM กัน Excel เปิดภาษาไทยเพี้ยน
    downloadBlob(blob, exportFileBase() + '.csv');
  }
  function exportDashboardImage() {
    if (typeof window.html2canvas === 'undefined') { alert('โหลดไลบรารีส่งออกไม่สำเร็จ (ลองออนไลน์แล้วรีเฟรช)'); return; }
    window.html2canvas($('dashboardView'), { backgroundColor: '#F3F5F8', scale: 2 }).then(function (canvas) {
      canvas.toBlob(function (blob) { if (blob) downloadBlob(blob, exportFileBase() + '.png'); });
    });
  }
  /* ตัด canvas เป็นหลายหน้า A4 ถ้าสูงเกิน 1 หน้า — เคลิบเดียวกับ generatePdf() ใน excel.js */
  function exportDashboardPdf() {
    var jsPDFctor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFctor || !window.html2canvas) { window.print(); return; }
    window.html2canvas($('dashboardView'), { backgroundColor: '#F3F5F8', scale: 2 }).then(function (canvas) {
      var pw = 210, ph = 297; // A4 แนวตั้ง (mm)
      var pdf = new jsPDFctor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var pxPerMm = canvas.width / pw, pageHpx = Math.floor(ph * pxPerMm), sy = 0, first = true;
      while (sy < canvas.height - 1) {
        var sh = Math.min(pageHpx, canvas.height - sy);
        var c2 = document.createElement('canvas'); c2.width = canvas.width; c2.height = sh;
        var ctx = c2.getContext('2d'); ctx.fillStyle = '#F3F5F8'; ctx.fillRect(0, 0, c2.width, sh);
        ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
        if (!first) pdf.addPage('a4', 'portrait');
        pdf.addImage(c2.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pw, sh / pxPerMm);
        sy += sh; first = false;
      }
      pdf.save(exportFileBase() + '.pdf');
    });
  }
  /* ── ส่งออกเป็น HTML แบบสแตนด์อโลน — ไม่ใช่ภาพนิ่งแบบ PNG/PDF: ฝัง config ของกราฟที่กำลังโชว์อยู่จริง
     (ดึงจาก instance ของ Chart.js ที่ยังอยู่ใน memory ตอนนี้ ไม่ต้องคำนวณ aggregate ซ้ำ) ลงในไฟล์แล้ว
     เรียก Chart.js จาก CDN ตัวเดียวกันตอนเปิดไฟล์ ทำให้เปิดที่ไหนก็ได้แล้วเห็นกราฟจริง คมชัด ซูมได้ ไม่ใช่
     รูปแบน — ตัด onClick (drill-down) ทิ้งเพราะพึ่งพา state ของหน้าเว็บที่ไม่มีในไฟล์แยกแล้ว */
  function cleanChartConfigForExport(c) {
    if (!c) return null;
    var opts = (c.config && c.config.options) || {};
    return {
      type: c.config.type,
      data: JSON.parse(JSON.stringify(c.config.data)),
      options: {
        indexAxis: opts.indexAxis, // จำเป็นสำหรับกราฟแท่งแนวนอน (type:'bar' + indexAxis:'y') ไม่งั้น export แล้วกลายเป็นแนวตั้ง
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: (opts.plugins && opts.plugins.legend) ? JSON.parse(JSON.stringify(opts.plugins.legend)) : { display: false } },
        scales: opts.scales ? JSON.parse(JSON.stringify(opts.scales)) : undefined
      }
    };
  }
  function buildDashboardHtmlDoc() {
    var title = escapeHtml(exportFileBase());
    var showNum = $('numStatCard').style.display !== 'none';
    var showBar = $('barChartCard').style.display !== 'none';
    var showLine = $('lineChartCard').style.display !== 'none';
    var showPie = $('pieChartCard').style.display !== 'none';
    var barCfg = cleanChartConfigForExport(charts.bar), lineCfg = cleanChartConfigForExport(charts.line), pieCfg = cleanChartConfigForExport(charts.pie);

    var html = '<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1"><title>' + title + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700;800&display=swap" rel="stylesheet">' +
      '<style>:root{--bg:#F3F5F8;--card:#fff;--ink:#151A23;--muted:#6B7280;--brand:#1E9E5A;' +
      '--sh:0 1px 2px rgba(16,24,40,.04),0 10px 26px rgba(16,24,40,.07)}' +
      '*{box-sizing:border-box;margin:0;padding:0}' +
      'body{font-family:Prompt,system-ui,sans-serif;background:var(--bg);color:var(--ink);padding:22px 16px 60px;-webkit-font-smoothing:antialiased}' +
      '.wrap{max-width:820px;margin:0 auto}' +
      'h1{font-size:20px;font-weight:800}.sub{font-size:12.5px;color:var(--muted);margin-top:4px;margin-bottom:4px}' +
      '.card{background:var(--card);border-radius:16px;box-shadow:var(--sh);padding:18px;margin-top:14px}' +
      '.card h2{font-size:14px;font-weight:700;margin-bottom:12px}' +
      '.stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}' +
      '.stat-tile{background:var(--bg);border-radius:12px;padding:14px 15px}' +
      '.stat-tile .lbl{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.02em}' +
      '.stat-tile .val{font-size:21px;font-weight:800;margin-top:4px;font-variant-numeric:tabular-nums}' +
      '.stat-tile .val .unit{font-size:12px;font-weight:600;color:var(--muted);margin-left:2px}' +
      '.stat-tile .sub{font-size:11px;color:var(--muted);margin-top:4px}' +
      '.chart-wrap{position:relative;height:280px;margin-top:4px}' +
      '.foot{font-size:11.5px;color:var(--muted);text-align:center;margin-top:22px}' +
      '</style></head><body><div class="wrap">' +
      '<h1>📊 ' + title + '</h1>' +
      '<div class="sub">ออกรายงานเมื่อ ' + new Date().toLocaleString('th-TH') + ' · ' + state.rows.length.toLocaleString('th-TH') + ' แถว</div>';

    if (showNum) html += '<div class="card"><h2>🔢 สรุปตัวเลข</h2><div class="stat-row">' + $('numStatRow').innerHTML + '</div></div>';
    if (showBar) html += '<div class="card"><h2>' + escapeHtml($('barChartTitle').textContent) + '</h2><div class="chart-wrap"><canvas id="rdc1"></canvas></div></div>';
    if (showLine) html += '<div class="card"><h2>' + escapeHtml($('lineChartTitle').textContent) + '</h2><div class="chart-wrap"><canvas id="rdc2"></canvas></div></div>';
    if (showPie) html += '<div class="card"><h2>' + escapeHtml($('pieChartTitle').textContent) + '</h2><div class="chart-wrap"><canvas id="rdc3"></canvas></div></div>';

    html += '<div class="foot">สร้างจาก "นำเสนอรายงาน" — Tanot</div></div>' +
      '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"><\/script><script>';
    if (showBar) html += 'new Chart(document.getElementById("rdc1").getContext("2d"),' + JSON.stringify(barCfg) + ');';
    if (showLine) html += 'new Chart(document.getElementById("rdc2").getContext("2d"),' + JSON.stringify(lineCfg) + ');';
    if (showPie) html += 'new Chart(document.getElementById("rdc3").getContext("2d"),' + JSON.stringify(pieCfg) + ');';
    html += '<\/script></body></html>';
    return html;
  }
  function exportDashboardHtml() {
    if (!state.rows.length) { alert('ยังไม่มีข้อมูลให้ส่งออก'); return; }
    var blob = new Blob([buildDashboardHtmlDoc()], { type: 'text/html;charset=utf-8;' });
    downloadBlob(blob, exportFileBase() + '.html');
  }

  function resetToUpload() {
    state.fileName = null; state.sheetNames = []; state.activeSheet = null; state.workbook = null; state.rawAoA = null;
    state.columns = []; state.rows = []; state.nextRowId = 1; state.filters = {}; state.globalQuery = '';
    state.sortCol = null; state.sortDir = null; state.selected = {}; state.page = 1; state.history = [];
    state.drill = null; state.chartChoice = { barCat: null, barNum: null, pieCat: null, lineDate: null, lineNum: null };
    state.chartType = { slot1: null, slot2: null, slot3: null };
    state.reportId = null; state.reportName = null;
    updateDrillBanner(); updateSaveUI();
    $('dataCard').style.display = 'none';
    $('dashboardView').style.display = 'none';
    $('viewTabs').style.display = 'none';
    $('statRow').style.display = 'none';
    $('sheetCard').style.display = 'none';
    $('headerCard').style.display = 'none';
    $('resumeCard').style.display = 'none';
    $('uploadCard').style.display = 'block';
    $('fileInput').value = '';
    setUploadStatus('', '');
    dbClearCurrent();
    renderReportsList();
  }

  /* ══════════════════ เริ่มต้น + resume ══════════════════ */
  function init() {
    $('pickBtn').addEventListener('click', function () { $('fileInput').click(); });
    $('fileInput').addEventListener('change', function () { handleFile($('fileInput').files[0]); });

    var dz = $('dropZone');
    ['dragenter', 'dragover'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('drag'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('drag'); }); });
    dz.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });

    $('confirmHeaderBtn').addEventListener('click', confirmHeader);
    $('addRowBtn').addEventListener('click', addRow);
    $('delSelBtn').addEventListener('click', deleteSelected);
    $('undoBtn').addEventListener('click', undo);
    $('clearFilterBtn').addEventListener('click', clearAllFilters);
    [].forEach.call($('viewTabs').querySelectorAll('.chip'), function (b) {
      b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
    });
    $('drillClearBtn').addEventListener('click', clearDrill);
    $('barTypeSel').addEventListener('change', function () { state.chartType.slot1 = this.value; renderDashboard(); });
    $('barCatSel').addEventListener('change', function () { state.chartChoice.barCat = this.value; renderDashboard(); });
    $('barNumSel').addEventListener('change', function () { state.chartChoice.barNum = this.value; renderDashboard(); });
    $('lineTypeSel').addEventListener('change', function () { state.chartType.slot2 = this.value; renderDashboard(); });
    $('lineDateSel').addEventListener('change', function () { state.chartChoice.lineDate = this.value; renderDashboard(); });
    $('lineNumSel').addEventListener('change', function () { state.chartChoice.lineNum = this.value; renderDashboard(); });
    $('pieTypeSel').addEventListener('change', function () { state.chartType.slot3 = this.value; renderDashboard(); });
    $('pieCatSel').addEventListener('change', function () { state.chartChoice.pieCat = this.value; renderDashboard(); });
    /* ปุ่ม "ไฟล์ใหม่" — ถามยืนยันเฉพาะตอนข้อมูลยังไม่ได้บันทึกเป็นรายงาน (reportId ว่าง) เพราะนั่นคือ
       กรณีเดียวที่ข้อมูลจะหายจริง — ถ้าบันทึกเป็นรายงานแล้วสลับได้เลยโดยไม่ต้องถาม (autosave ไว้แล้ว) */
    $('newFileBtn').addEventListener('click', function () {
      if (!state.reportId && state.rows.length && !confirm('ยังไม่ได้บันทึกเป็นรายงาน — เริ่มไฟล์ใหม่จะแทนที่ข้อมูลนี้ ดำเนินการต่อไหม?')) return;
      resetToUpload();
    });
    $('myReportsBtn').addEventListener('click', function () {
      if (!state.reportId && state.rows.length && !confirm('ยังไม่ได้บันทึกเป็นรายงาน — ออกไปดูรายการรายงานจะแทนที่ข้อมูลนี้ ดำเนินการต่อไหม?')) return;
      resetToUpload();
      setTimeout(function () { var el = $('reportsCard'); if (el.style.display !== 'none') el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    });
    $('saveReportBtn').addEventListener('click', saveAsReport);
    $('exportXlsxBtn').addEventListener('click', exportXlsx);
    $('exportCsvBtn').addEventListener('click', exportCsv);
    $('exportImgBtn').addEventListener('click', exportDashboardImage);
    $('exportPdfBtn').addEventListener('click', exportDashboardPdf);
    $('exportHtmlBtn').addEventListener('click', exportDashboardHtml);
    $('printBtn').addEventListener('click', function () { window.print(); });
    $('globalSearch').addEventListener('input', function () {
      state.globalQuery = $('globalSearch').value; state.page = 1; renderTable();
    });

    renderReportsList();
    dbLoadCurrent().then(function (saved) {
      if (saved && saved.rows && saved.rows.length) {
        $('resumeCard').style.display = 'block';
        $('resumeInfo').textContent = (saved.reportName || saved.fileName || 'ไฟล์ที่แล้ว') + ' · ' + saved.rows.length.toLocaleString('th-TH') + ' แถว · บันทึกไว้เมื่อ ' + new Date(saved.savedAt).toLocaleString('th-TH');
        $('resumeBtn').addEventListener('click', function () {
          state.fileName = saved.fileName; state.activeSheet = saved.sheetName; state.sheetNames = saved.sheetName ? [saved.sheetName] : [];
          state.columns = saved.columns; state.rows = saved.rows; state.nextRowId = saved.nextRowId;
          state.reportId = saved.reportId || null; state.reportName = saved.reportName || null;
          state.filters = {}; state.globalQuery = ''; state.sortCol = null; state.sortDir = null;
          state.selected = {}; state.page = 1; state.history = [];
          state.drill = null; state.chartChoice = { barCat: null, barNum: null, pieCat: null, lineDate: null, lineNum: null };
    state.chartType = { slot1: null, slot2: null, slot3: null };
          updateDrillBanner(); updateSaveUI();
          $('resumeCard').style.display = 'none'; $('uploadCard').style.display = 'none'; $('reportsCard').style.display = 'none';
          $('viewTabs').style.display = 'flex';
          setView('table'); // เรียก renderTable() ให้เองในตัว
        });
        $('discardBtn').addEventListener('click', function () { $('resumeCard').style.display = 'none'; dbClearCurrent(); });
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
