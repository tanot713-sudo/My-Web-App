/* ══════════════════════════════════════════════════════════════════
   Tanot — นำเสนอรายงาน (Stage 1: นำเข้าไฟล์ + ตารางข้อมูล)
   • อ่าน .xlsx/.xls/.csv ด้วย SheetJS (ตัวเดียวกับที่หน้า "งาน Excel" ใช้อยู่แล้ว — clone-and-adapt)
   • ตารางเบาๆ ของตัวเอง (ไม่ใช้ Luckysheet เต็มรูปแบบ) รองรับเรียง/กรอง/แก้ไขเซลล์/เพิ่ม-ลบแถว/เลิกทำ/แบ่งหน้า
   • เดาชนิดข้อมูลแต่ละคอลัมน์ (number/date/category/text) ไว้ล่วงหน้า — ยังไม่ใช้ตอนนี้ แต่ stage ถัดไป
     (แดชบอร์ด+กราฟ) จะใช้ตัดสินใจแนะนำชนิดกราฟจากตรงนี้
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
    history: []            // snapshots for undo: { columns, rows, nextRowId }
  };

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }

  /* ══════════════════ IndexedDB — เก็บงานปัจจุบัน 1 ชุด ══════════════════ */
  var DB_NAME = 'tanot-report-dashboard', DB_STORE = 'current', DB_VERSION = 1;
  function dbOpen() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('เบราว์เซอร์นี้ไม่รองรับ IndexedDB')); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' });
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
  var persistTimer = null;
  function persistDebounced() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      dbSaveCurrent({
        fileName: state.fileName, sheetName: state.activeSheet,
        columns: state.columns, rows: state.rows, nextRowId: state.nextRowId,
        savedAt: Date.now()
      });
    }, 400);
  }

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
    $('undoBtn').disabled = true;
    $('sheetCard').style.display = 'none';
    $('headerCard').style.display = 'none';
    $('uploadCard').style.display = 'none';
    $('resumeCard').style.display = 'none';
    $('dataCard').style.display = 'block';
    $('dataMeta').textContent = (state.fileName || '') + (state.sheetNames.length > 1 ? ' · ' + state.activeSheet : '') + ' · ' + state.rows.length.toLocaleString('th-TH') + ' แถว';
    renderTable();
    persistDebounced();
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
  function matchesFilters(row) {
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

  function resetToUpload() {
    state.fileName = null; state.sheetNames = []; state.activeSheet = null; state.workbook = null; state.rawAoA = null;
    state.columns = []; state.rows = []; state.nextRowId = 1; state.filters = {}; state.globalQuery = '';
    state.sortCol = null; state.sortDir = null; state.selected = {}; state.page = 1; state.history = [];
    $('dataCard').style.display = 'none';
    $('statRow').style.display = 'none';
    $('sheetCard').style.display = 'none';
    $('headerCard').style.display = 'none';
    $('resumeCard').style.display = 'none';
    $('uploadCard').style.display = 'block';
    $('fileInput').value = '';
    setUploadStatus('', '');
    dbClearCurrent();
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
    $('newFileBtn').addEventListener('click', function () {
      if (state.rows.length && !confirm('ยังไม่ได้ส่งออกข้อมูลปัจจุบัน — อัปโหลดไฟล์ใหม่จะแทนที่ข้อมูลนี้ ดำเนินการต่อไหม?')) return;
      resetToUpload();
    });
    $('globalSearch').addEventListener('input', function () {
      state.globalQuery = $('globalSearch').value; state.page = 1; renderTable();
    });

    dbLoadCurrent().then(function (saved) {
      if (saved && saved.rows && saved.rows.length) {
        $('resumeCard').style.display = 'block';
        $('resumeInfo').textContent = (saved.fileName || 'ไฟล์ที่แล้ว') + ' · ' + saved.rows.length.toLocaleString('th-TH') + ' แถว · บันทึกไว้เมื่อ ' + new Date(saved.savedAt).toLocaleString('th-TH');
        $('resumeBtn').addEventListener('click', function () {
          state.fileName = saved.fileName; state.activeSheet = saved.sheetName; state.sheetNames = saved.sheetName ? [saved.sheetName] : [];
          state.columns = saved.columns; state.rows = saved.rows; state.nextRowId = saved.nextRowId;
          state.filters = {}; state.globalQuery = ''; state.sortCol = null; state.sortDir = null;
          state.selected = {}; state.page = 1; state.history = [];
          $('resumeCard').style.display = 'none'; $('uploadCard').style.display = 'none';
          $('dataCard').style.display = 'block';
          renderTable();
        });
        $('discardBtn').addEventListener('click', function () { $('resumeCard').style.display = 'none'; dbClearCurrent(); });
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
