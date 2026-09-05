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
      sheetName: 'ชีต1',
      diFuzzyBtn: 'ตรวจตัวสะกด', diFuzzyTitle: 'ตรวจหาค่าที่สะกดต่างกันแต่อาจหมายถึงสิ่งเดียวกัน (เช่น "กรุงเทพ"/"กรุงเทพฯ")',
      diFuzzyPickCol: 'เลือกคอลัมน์:', diFuzzyNone: 'ไม่พบตัวสะกดที่คล้ายกันในคอลัมน์นี้',
      diFuzzyMergeInto: 'รวมเป็น:', diFuzzyMergeBtn: 'รวม', diCloseBtn: 'ปิด',
      diSummaryBtn: 'สรุปอัตโนมัติ', diSummaryTitle: 'สรุปอัตโนมัติ (คำนวณจากข้อมูลจริงในชีตนี้)',
      diCopyBtn: 'คัดลอก', diCopied: 'คัดลอกแล้ว!', diCopyFail: 'คัดลอกไม่สำเร็จ ลองเลือกข้อความเองแล้วกด Ctrl+C',
      diTotalRows: 'ข้อมูลทั้งหมด {n} แถว ({m} คอลัมน์ นับจากแถวหัวตาราง)',
      diColSum: '{col} รวมทั้งหมด {sum}',
      diTopCategory: '{col} ที่พบมากที่สุดคือ "{value}" ({count} รายการ คิดเป็น {pct}% ของทั้งหมด)',
      diEmptyValue: '(ว่าง)',
      diTrendBtn: 'เส้นแนวโน้ม', diTrendTitle: 'เส้นแนวโน้ม + พยากรณ์',
      diTrendXLbl: 'แกน X (ป้ายกำกับ)', diTrendYLbl: 'แกน Y (ตัวเลข)',
      diTrendDatasetLabel: 'แนวโน้ม (พยากรณ์)', diForecastLabel: 'พยากรณ์ {n}',
      diNoData: 'ต้องมีแถวหัวตาราง + ข้อมูลอย่างน้อย 1 แถว ก่อนถึงจะวิเคราะห์ได้',
      diNoNumCol: 'ไม่พบคอลัมน์ตัวเลขในชีตนี้', diNoTextCol: 'ไม่พบคอลัมน์ข้อความ/หมวดหมู่ที่เหมาะสมในชีตนี้'
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
      sheetName: 'Sheet1',
      diFuzzyBtn: 'Check spelling', diFuzzyTitle: 'Find values spelled differently that likely mean the same thing (e.g. "Bangkok"/"BKK")',
      diFuzzyPickCol: 'Column:', diFuzzyNone: 'No similar spellings found in this column',
      diFuzzyMergeInto: 'Merge into:', diFuzzyMergeBtn: 'Merge', diCloseBtn: 'Close',
      diSummaryBtn: 'Auto Summary', diSummaryTitle: 'Auto Summary (computed from this sheet’s real data)',
      diCopyBtn: 'Copy', diCopied: 'Copied!', diCopyFail: 'Copy failed — try selecting the text and pressing Ctrl+C',
      diTotalRows: 'Total of {n} rows ({m} columns, counting the header row).',
      diColSum: '{col} totals {sum}.',
      diTopCategory: 'The most common {col} is "{value}" ({count} rows, {pct}% of the total).',
      diEmptyValue: '(empty)',
      diTrendBtn: 'Trendline', diTrendTitle: 'Trendline + Forecast',
      diTrendXLbl: 'X axis (labels)', diTrendYLbl: 'Y axis (numbers)',
      diTrendDatasetLabel: 'Trend (forecast)', diForecastLabel: 'Forecast {n}',
      diNoData: 'Needs a header row plus at least 1 data row before it can be analyzed.',
      diNoNumCol: 'No numeric column found in this sheet', diNoTextCol: 'No suitable text/category column found in this sheet'
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
  function locale() { return getUILang() === 'en' ? 'en-US' : 'th-TH'; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function escapeAttr(s) { return escapeHtml(s); }

  var els = {
    langToggle: $('langToggle'), statusMsg: $('statusMsg'), loading: $('loading'), grid: $('luckysheet'),
    ribbon: $('xlRibbon'), ribTabs: $('xlrTabs'), ribPanels: $('xlrPanels'), cellEditor: $('xlCellEditor'),
    newBtn: $('newBtn'), importBtn: $('importBtn'), fileInput: $('fileInput'),
    exportXlsxBtn: $('exportXlsxBtn'), exportCsvBtn: $('exportCsvBtn'), printBtn: $('printBtn'),
    diFuzzyBtn: $('diFuzzyBtn'), diSummaryBtn: $('diSummaryBtn'), diTrendBtn: $('diTrendBtn'), diPopover: $('diPopover')
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
        workbookCreateAfter: function () { hideLoading(); },
        cellEditBefore: function (range) { startCellEditor(range); }
      }
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     ช่องพิมพ์ของเราเอง (native <textarea>) วางซ้อนบนเซลล์ตอนแก้ไข
     Luckysheet 2.1.13 พิมพ์ไทย (IME) ในเซลล์แล้วตัวหาย/ไม่ครบ (บั๊กของไลบรารีเอง)
     → ใช้ช่อง native ที่เบราว์เซอร์รองรับ IME 100% รับข้อความ แล้วเขียนกลับด้วย setCellValue
     ══════════════════════════════════════════════════════════════════ */
  var ceState = { active: false, r: 0, c: 0 };
  function hideLuckyEditor(restore) {
    var ib = document.getElementById('luckysheet-input-box');
    if (ib) { ib.style.opacity = restore ? '' : '0'; ib.style.pointerEvents = restore ? '' : 'none'; }
  }
  function exitLuckyEdit() {
    var ed = document.getElementById('luckysheet-rich-text-editor');
    if (ed) { try { ['keydown', 'keyup'].forEach(function (tp) { ed.dispatchEvent(new KeyboardEvent(tp, { bubbles: true, key: 'Escape', keyCode: 27, which: 27 })); }); } catch (e) {} }
  }
  function startCellEditor(range) {
    var f = range && range[0]; if (!f || !els.cellEditor) return;
    ceState.r = (f.row_focus != null) ? f.row_focus : f.row[0];
    ceState.c = (f.column_focus != null) ? f.column_focus : f.column[0];
    /* หน่วงเล็กน้อยให้ Luckysheet โฟกัสตัวแก้ไขของมันเสร็จก่อน แล้วเราค่อย "แย่งโฟกัส" มาที่ช่องเรา */
    setTimeout(function () {
      var ib = document.getElementById('luckysheet-input-box');
      var ed = document.getElementById('luckysheet-rich-text-editor');
      if (!ib) return;
      var rect = ib.getBoundingClientRect();
      var ta = els.cellEditor;
      ta.style.left = rect.left + 'px';
      ta.style.top = rect.top + 'px';
      ta.style.minWidth = Math.max(82, rect.width) + 'px';
      ta.style.height = Math.max(24, rect.height) + 'px';
      ta.value = ed ? ed.textContent : '';           /* ค่าเดิม (ถ้าดับเบิลแตะแก้) */
      hideLuckyEditor(false);
      if (ed) { try { ed.blur(); } catch (e) {} }     /* ปลดโฟกัสของ Luckysheet */
      ta.style.display = 'block';
      ceState.active = true; ceState.openedAt = Date.now();
      ta.focus();
      var L = ta.value.length; try { ta.setSelectionRange(L, L); } catch (e) {}
      ta.style.height = 'auto'; ta.style.height = Math.max(24, ta.scrollHeight) + 'px';
    }, 90);
  }
  function closeCellEditor() {
    ceState.active = false;
    if (els.cellEditor) els.cellEditor.style.display = 'none';
    hideLuckyEditor(true);
  }
  function commitCellEditor(move) {
    if (!ceState.active) return;
    var val = els.cellEditor.value, r = ceState.r, c = ceState.c;
    closeCellEditor();
    exitLuckyEdit();                                  /* ออกจากโหมดแก้ไขของ Luckysheet โดยไม่ให้มันเขียนค่า (ที่อาจไม่ครบ) */
    setTimeout(function () {
      try { luckysheet.setCellValue(r, c, val); } catch (e) {}           /* คงการแปลงชนิด: ตัวเลข/สูตรทำงานปกติ */
      if (val !== '') { try { luckysheet.setCellFormat(r, c, 'ff', 'Sarabun'); } catch (e) {} }  /* ใส่ฟอนต์ไทยแยก ไม่ทำตัวเลข/สูตรพัง */
      if (move === 'down') { try { luckysheet.setRangeShow({ row: [r + 1, r + 1], column: [c, c] }); } catch (e) {} }
      else if (move === 'right') { try { luckysheet.setRangeShow({ row: [r, r], column: [c + 1, c + 1] }); } catch (e) {} }
      scheduleSave();
    }, 0);
  }
  function cancelCellEditor() {
    if (!ceState.active) return;
    closeCellEditor();
    exitLuckyEdit();
  }
  if (els.cellEditor) {
    els.cellEditor.addEventListener('input', function () {
      var ta = els.cellEditor; ta.style.height = 'auto'; ta.style.height = Math.max(24, ta.scrollHeight) + 'px';
    });
    els.cellEditor.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); commitCellEditor('down'); }
      else if (e.key === 'Tab' && !e.isComposing) { e.preventDefault(); commitCellEditor('right'); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelCellEditor(); }
    });
    els.cellEditor.addEventListener('blur', function () {
      if (!ceState.active) return;
      /* บาง handler ของ Luckysheet อาจแย่งโฟกัสคืนช่วงเปิดใหม่ → ถ้า blur เร็วเกินไป ให้ดึงโฟกัสกลับ ไม่เพิ่งบันทึก */
      if (Date.now() - (ceState.openedAt || 0) < 300) { setTimeout(function () { if (ceState.active) els.cellEditor.focus(); }, 0); return; }
      commitCellEditor(null);
    });
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

  /* ══════════════════════════════════════════════════════════════════
     วิเคราะห์ข้อมูล (Data Insights) — สรุปอัตโนมัติ / รวมตัวสะกดใกล้เคียง / เส้นแนวโน้ม+พยากรณ์
     ย้ายมาจากเครื่องมือ "แดชบอร์ดรายงาน" (report-dashboard.js) ปรับให้อ่าน/เขียนข้อมูลจากกริด Luckysheet
     โดยตรงแทนที่จะมีโมเดลคอลัมน์ของตัวเอง — สมมติว่าแถวแรกของ "ชีตที่กำลังเปิดอยู่" คือหัวตาราง แล้วเดา
     ชนิดคอลัมน์ (ตัวเลข/หมวดหมู่/ข้อความ) จากค่าจริงด้านล่าง ไม่รองรับการตรวจจับคอลัมน์วันที่แบบ Date object
     จริงจังเหมือนแดชบอร์ดเดิม (Luckysheet เก็บวันที่เป็นเลขลำดับ ไม่ใช่ Date) จึงตัดส่วนเทียบเดือนต่อเดือนออก
     จากสรุปอัตโนมัติเวอร์ชันนี้ และเส้นแนวโน้มจะพยากรณ์ป้ายวันที่ต่อได้เฉพาะเมื่อป้ายแกน X เป็นข้อความรูปแบบ
     yyyy-mm-dd ตรงตัวเท่านั้น ไม่งั้นจะใช้ป้าย "พยากรณ์ 1/2/3" แทน
     ══════════════════════════════════════════════════════════════════ */
  function colLetter(i) {
    var s = ''; i++;
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }
  function activeSheetObj() {
    var sheets = currentSheets();
    if (!sheets.length) return null;
    return sheets.filter(function (s) { return s.status === 1; })[0] || sheets[0];
  }
  function inferGridColType(values) {
    var nonNull = values.filter(function (v) { return v !== null && v !== undefined && v !== ''; });
    if (!nonNull.length) return 'text';
    var numCount = 0;
    nonNull.forEach(function (v) { if (typeof v === 'number' && isFinite(v)) numCount++; });
    if (numCount / nonNull.length > 0.7) return 'number';
    var uniq = {}; nonNull.forEach(function (v) { uniq[String(v)] = true; });
    var uniqCount = Object.keys(uniq).length;
    if (uniqCount <= 25 || uniqCount / nonNull.length <= 0.3) return 'category';
    return 'text';
  }
  function usedColCount(aoa) {
    var maxC = -1;
    aoa.forEach(function (row) {
      (row || []).forEach(function (v, c) { if (v !== null && v !== undefined && v !== '' && c > maxC) maxC = c; });
    });
    return maxC + 1;
  }
  /* โมเดลตาราง { cols: [{index,label,type}], rows: [[...]] } จากชีตที่กำลังเปิดอยู่ — ตัดแถว/คอลัมน์ว่าง
     ท้ายตารางทิ้งก่อนเสมอ เพราะ Luckysheet เก็บกริดเป็นขนาดคงที่ (ค่าเริ่มต้น 60 แถว × 20 คอลัมน์) เต็มไปด้วย
     เซลล์ว่างเปล่าเกือบทั้งหมด ถ้าไม่ตัดทิ้งจะเห็น "คอลัมน์ B" "คอลัมน์ C" ว่างๆ โผล่มาให้เลือกเต็มไปหมด */
  function gridModel() {
    var sheet = activeSheetObj();
    if (!sheet) return null;
    var aoa = sheetToAoa(sheet);
    while (aoa.length && aoa[aoa.length - 1].every(function (v) { return v === null || v === undefined || v === ''; })) aoa.pop();
    if (aoa.length < 2) return null; // ต้องมีอย่างน้อยแถวหัวตาราง + ข้อมูล 1 แถว
    var ncols = usedColCount(aoa);
    if (ncols < 1) return null;
    var header = (aoa[0] || []).slice(0, ncols); while (header.length < ncols) header.push(null);
    var dataRows = aoa.slice(1).map(function (row) {
      var r = (row || []).slice(0, ncols); while (r.length < ncols) r.push(null);
      return r;
    });
    var cols = [];
    for (var c = 0; c < ncols; c++) {
      var label = (header[c] !== null && header[c] !== undefined && header[c] !== '') ? String(header[c]) : colLetter(c);
      var vals = dataRows.map(function (r) { return r[c]; });
      cols.push({ index: c, label: label, type: inferGridColType(vals) });
    }
    return { cols: cols, rows: dataRows, headerRowOffset: 1 }; // +1 เพราะแถว 0 ของชีตจริงคือหัวตาราง
  }

  /* ── ป็อปอัพกลาง ── ใช้ element เดียว (#diPopover) ร่วมกันทั้ง 3 ฟีเจอร์ เหมือนแพทเทิร์น filterPopover
     ของแดชบอร์ดเดิม — แต่ละ wireFn ต้องเรียก positionDiPopover(el, anchorEl) เองหลังสร้างเนื้อหาเสร็จ
     (ไม่ position ให้อัตโนมัติก่อน เพราะขนาดเนื้อหาจะยังไม่นิ่งจนกว่า wireFn จะ build เสร็จ) */
  function positionDiPopover(el, anchorEl) {
    var r = anchorEl.getBoundingClientRect();
    var w = el.offsetWidth || 320, h = el.offsetHeight || 200;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var top = r.bottom + 6;
    if (top + h > window.innerHeight) top = Math.max(8, r.top - h - 6);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }
  var closeActiveDiPopover = null;
  function openInsightsPopover(anchorEl, wireFn) {
    if (closeActiveDiPopover) closeActiveDiPopover();
    var el = els.diPopover;
    if (!el) return;
    el.className = 'di-popover';
    el.style.display = 'block';
    var onDocClick = function (e) { if (!el.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) close(); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    function close() {
      el.style.display = 'none'; el.innerHTML = '';
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      closeActiveDiPopover = null;
    }
    setTimeout(function () { document.addEventListener('mousedown', onDocClick); document.addEventListener('keydown', onKey); }, 0);
    closeActiveDiPopover = close;
    wireFn(el, close);
  }
  function renderDiEmpty(el, anchorEl, close, titleKey, msgKey) {
    el.innerHTML = '<div class="di-title">' + escapeHtml(t(titleKey)) + '</div><div class="di-empty">' + escapeHtml(t(msgKey)) + '</div>' +
      '<div class="di-actions"><span></span><button type="button" class="xl-btn" id="diCloseBtn">' + escapeHtml(t('diCloseBtn')) + '</button></div>';
    el.querySelector('#diCloseBtn').addEventListener('click', close);
    positionDiPopover(el, anchorEl);
  }

  /* ── สรุปอัตโนมัติ ── */
  function buildGridSummaryText(model) {
    var numCols = model.cols.filter(function (c) { return c.type === 'number'; });
    var catCols = model.cols.filter(function (c) { return c.type === 'category'; });
    var parts = [];
    parts.push(t('diTotalRows', { n: model.rows.length.toLocaleString(locale()), m: model.cols.length.toLocaleString(locale()) }));
    if (numCols.length) {
      var col = numCols[0];
      var vals = model.rows.map(function (r) { return r[col.index]; }).filter(function (v) { return typeof v === 'number' && isFinite(v); });
      if (vals.length) {
        var sum = vals.reduce(function (a, b) { return a + b; }, 0);
        parts.push(t('diColSum', { col: col.label, sum: sum.toLocaleString(locale(), { maximumFractionDigits: 2 }) }));
      }
    }
    if (catCols.length) {
      var cc = catCols[0], freq = {};
      model.rows.forEach(function (r) {
        var v = r[cc.index];
        var k = (v === null || v === undefined || v === '') ? t('diEmptyValue') : String(v);
        freq[k] = (freq[k] || 0) + 1;
      });
      var keys = Object.keys(freq);
      if (keys.length) {
        var topKey = keys.reduce(function (a, b) { return freq[b] > freq[a] ? b : a; });
        var topPct = model.rows.length ? (freq[topKey] / model.rows.length) * 100 : 0;
        parts.push(t('diTopCategory', {
          col: cc.label, value: topKey, count: freq[topKey].toLocaleString(locale()),
          pct: topPct.toLocaleString(locale(), { maximumFractionDigits: 1 })
        }));
      }
    }
    return parts.join(' ');
  }
  function openSummaryPopover(anchorEl) {
    var model = gridModel();
    openInsightsPopover(anchorEl, function (el, close) {
      if (!model) { renderDiEmpty(el, anchorEl, close, 'diSummaryTitle', 'diNoData'); return; }
      el.classList.add('wide');
      var text = buildGridSummaryText(model);
      el.innerHTML = '<div class="di-title">' + escapeHtml(t('diSummaryTitle')) + '</div>' +
        '<textarea class="di-textarea" id="diText" readonly></textarea>' +
        '<div class="di-actions"><span class="di-status" id="diStatus"></span><button type="button" class="xl-btn" id="diCopyBtn">' + escapeHtml(t('diCopyBtn')) + '</button></div>';
      el.querySelector('#diText').value = text;
      positionDiPopover(el, anchorEl);
      el.querySelector('#diCopyBtn').addEventListener('click', function () {
        var statusEl = el.querySelector('#diStatus');
        function showStatus(ok, msg) { statusEl.textContent = msg; statusEl.classList.toggle('err', !ok); }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { showStatus(true, t('diCopied')); }, function () { showStatus(false, t('diCopyFail')); });
        } else {
          try { var ta = el.querySelector('#diText'); ta.select(); document.execCommand('copy'); showStatus(true, t('diCopied')); }
          catch (e) { showStatus(false, t('diCopyFail')); }
        }
      });
    });
  }

  /* ── รวมตัวสะกดใกล้เคียง (Fuzzy Spelling Merge) ── อัลกอริทึมเดียวกับที่ใช้ในแดชบอร์ดรายงานทุกประการ
     (Levenshtein edit distance + Union-Find + เกณฑ์ความเหมือนแปรผันตามความยาวคำ กันคำสั้นจับผิดคำ) */
  function levenshtein(a, b) {
    var m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    var prev = []; for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      var cur = [i];
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function fuzzySimilarity(a, b) {
    var maxLen = Math.max(a.length, b.length);
    return maxLen ? 1 - levenshtein(a, b) / maxLen : 1;
  }
  function fuzzyThresholdFor(len) {
    if (len < 4) return 1.01;
    if (len <= 5) return 0.88;
    if (len <= 8) return 0.82;
    return 0.78;
  }
  var FUZZY_MAX_UNIQUE = 300;
  function findGridFuzzyGroups(model, colIndex) {
    var freq = {};
    model.rows.forEach(function (r) {
      var v = r[colIndex];
      if (v === null || v === undefined || v === '') return;
      freq[String(v)] = (freq[String(v)] || 0) + 1;
    });
    var values = Object.keys(freq);
    if (values.length < 2 || values.length > FUZZY_MAX_UNIQUE) return [];
    var parent = values.map(function (_, i) { return i; });
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function union(a, b) { var ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
    for (var i = 0; i < values.length; i++) {
      for (var k = i + 1; k < values.length; k++) {
        var maxLen = Math.max(values[i].length, values[k].length);
        if (fuzzySimilarity(values[i], values[k]) >= fuzzyThresholdFor(maxLen)) union(i, k);
      }
    }
    var clusters = {};
    values.forEach(function (v, i) { var root = find(i); (clusters[root] = clusters[root] || []).push(v); });
    return Object.keys(clusters).map(function (key) { return clusters[key]; })
      .filter(function (g) { return g.length > 1; })
      .map(function (g) { g.sort(function (a, b) { return freq[b] - freq[a]; }); return { values: g, freq: freq }; })
      .sort(function (a, b) { return b.values.length - a.values.length; });
  }
  function mergeGridFuzzyGroup(model, colIndex, values, canon) {
    var others = {}; values.forEach(function (v) { if (v !== canon) others[v] = true; });
    model.rows.forEach(function (r, ri) {
      if (Object.prototype.hasOwnProperty.call(others, String(r[colIndex]))) {
        try { luckysheet.setCellValue(ri + model.headerRowOffset, colIndex, canon); } catch (e) {}
        r[colIndex] = canon; // อัปเดตโมเดลในหน่วยความจำให้ตรงกับที่เพิ่งเขียนกลับ ไม่ต้องอ่านชีตใหม่ทั้งก้อน
      }
    });
    scheduleSave();
  }
  function openFuzzyPopover(anchorEl) {
    var model = gridModel();
    openInsightsPopover(anchorEl, function (el, close) {
      if (!model) { renderDiEmpty(el, anchorEl, close, 'diFuzzyTitle', 'diNoData'); return; }
      var eligibleCols = model.cols.filter(function (c) { return c.type !== 'number'; });
      if (!eligibleCols.length) { renderDiEmpty(el, anchorEl, close, 'diFuzzyTitle', 'diNoTextCol'); return; }
      el.classList.add('wide');
      function renderGroups(colIndex) {
        var groups = findGridFuzzyGroups(model, colIndex);
        var listHtml = !groups.length
          ? '<div class="di-empty">' + escapeHtml(t('diFuzzyNone')) + '</div>'
          : groups.map(function (g, gi) {
              var optsHtml = g.values.map(function (v) { return '<option value="' + escapeAttr(v) + '">' + escapeHtml(v) + ' (' + g.freq[v].toLocaleString(locale()) + ')</option>'; }).join('');
              var valuesHtml = g.values.map(function (v) { return escapeHtml(v) + ' (' + g.freq[v].toLocaleString(locale()) + ')'; }).join(', ');
              return '<div class="di-group"><div class="di-group-values">' + valuesHtml + '</div>' +
                '<div class="di-group-row"><label style="flex-direction:row;align-items:center">' + escapeHtml(t('diFuzzyMergeInto')) +
                ' <select class="di-fuzzy-canon" data-gidx="' + gi + '">' + optsHtml + '</select></label>' +
                '<button type="button" class="xl-btn di-fuzzy-merge-btn" data-gidx="' + gi + '">' + escapeHtml(t('diFuzzyMergeBtn')) + '</button></div></div>';
            }).join('');
        el.querySelector('.di-list').innerHTML = listHtml;
        [].forEach.call(el.querySelectorAll('.di-fuzzy-merge-btn'), function (btn) {
          btn.addEventListener('click', function () {
            var gi = +btn.getAttribute('data-gidx');
            var canon = el.querySelector('.di-fuzzy-canon[data-gidx="' + gi + '"]').value;
            mergeGridFuzzyGroup(model, colIndex, groups[gi].values, canon);
            renderGroups(colIndex);
          });
        });
        positionDiPopover(el, anchorEl);
      }
      el.innerHTML = '<div class="di-title">' + escapeHtml(t('diFuzzyTitle')) + '</div>' +
        '<div class="di-row"><label>' + escapeHtml(t('diFuzzyPickCol')) +
        '<select class="di-fuzzy-col">' + eligibleCols.map(function (c) { return '<option value="' + c.index + '">' + escapeHtml(c.label) + '</option>'; }).join('') + '</select></label></div>' +
        '<div class="di-list"></div>' +
        '<div class="di-actions"><span></span><button type="button" class="xl-btn" id="diCloseBtn">' + escapeHtml(t('diCloseBtn')) + '</button></div>';
      el.querySelector('.di-fuzzy-col').addEventListener('change', function () { renderGroups(+this.value); });
      el.querySelector('#diCloseBtn').addEventListener('click', close);
      renderGroups(eligibleCols[0].index);
    });
  }

  /* ── เส้นแนวโน้ม + พยากรณ์ ── สมการเส้นตรงแบบ least-squares เดียวกับแดชบอร์ดรายงาน วาดด้วย Chart.js
     (โหลดเพิ่มเฉพาะหน้านี้) ลงในผืนผ้าใบภายในป็อปอัพเอง ไม่ยุ่งกับกราฟของ Luckysheet เอง */
  function linearRegression(data) {
    var n = data.length, sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (var i = 0; i < n; i++) { sumX += i; sumY += data[i]; sumXY += i * data[i]; sumXX += i * i; }
    var denom = n * sumXX - sumX * sumX;
    var slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    return { slope: slope, intercept: (sumY - slope * sumX) / n };
  }
  function nextDateLabels(labels, count) {
    var n = labels.length;
    var lastDate = new Date(labels[n - 1] + 'T00:00:00Z'), prevDate = new Date(labels[n - 2] + 'T00:00:00Z');
    var stepMs = lastDate.getTime() - prevDate.getTime();
    if (!isFinite(stepMs) || stepMs <= 0) stepMs = 86400000;
    var out = [];
    for (var i = 1; i <= count; i++) out.push(new Date(lastDate.getTime() + stepMs * i).toISOString().slice(0, 10));
    return out;
  }
  function openTrendPopover(anchorEl) {
    var model = gridModel();
    openInsightsPopover(anchorEl, function (el, close) {
      if (!model) { renderDiEmpty(el, anchorEl, close, 'diTrendTitle', 'diNoData'); return; }
      var numCols = model.cols.filter(function (c) { return c.type === 'number'; });
      if (!numCols.length) { renderDiEmpty(el, anchorEl, close, 'diTrendTitle', 'diNoNumCol'); return; }
      el.classList.add('wide');
      var chartInst = null;
      el.innerHTML = '<div class="di-title">' + escapeHtml(t('diTrendTitle')) + '</div>' +
        '<div class="di-row">' +
        '<label>' + escapeHtml(t('diTrendXLbl')) + '<select class="di-trend-x">' + model.cols.map(function (c) { return '<option value="' + c.index + '">' + escapeHtml(c.label) + '</option>'; }).join('') + '</select></label>' +
        '<label>' + escapeHtml(t('diTrendYLbl')) + '<select class="di-trend-y">' + numCols.map(function (c) { return '<option value="' + c.index + '">' + escapeHtml(c.label) + '</option>'; }).join('') + '</select></label>' +
        '</div>' +
        '<div class="di-chart-wrap"><canvas id="diTrendCanvas"></canvas></div>' +
        '<div class="di-actions"><span></span><button type="button" class="xl-btn" id="diCloseBtn">' + escapeHtml(t('diCloseBtn')) + '</button></div>';
      function draw() {
        var xIdx = +el.querySelector('.di-trend-x').value, yIdx = +el.querySelector('.di-trend-y').value;
        var pairs = model.rows.map(function (r) { return [r[xIdx] == null ? '' : String(r[xIdx]), r[yIdx]]; })
          .filter(function (p) { return typeof p[1] === 'number' && isFinite(p[1]); });
        if (chartInst) { try { chartInst.destroy(); } catch (e) {} chartInst = null; }
        if (pairs.length < 2 || typeof window.Chart === 'undefined') return;
        var labels = pairs.map(function (p) { return p[0]; }), data = pairs.map(function (p) { return p[1]; });
        var reg = linearRegression(data);
        var isoDateLike = /^\d{4}-\d{2}-\d{2}$/.test(labels[labels.length - 1]) && /^\d{4}-\d{2}-\d{2}$/.test(labels[labels.length - 2]);
        var forecastLabels = isoDateLike ? nextDateLabels(labels, 3) : [1, 2, 3].map(function (n) { return t('diForecastLabel', { n: n }); });
        var allLabels = labels.concat(forecastLabels);
        var yCol = model.cols.filter(function (c) { return c.index === yIdx; })[0];
        chartInst = new Chart(document.getElementById('diTrendCanvas').getContext('2d'), {
          type: 'line',
          data: {
            labels: allLabels,
            datasets: [
              { label: yCol ? yCol.label : '', data: data.concat(forecastLabels.map(function () { return null; })), borderColor: '#217346', backgroundColor: 'rgba(33,115,70,.12)', tension: .25, fill: true },
              { label: t('diTrendDatasetLabel'), data: allLabels.map(function (_, i) { return reg.slope * i + reg.intercept; }), borderColor: '#9CA3AF', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false, tension: 0 }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }
        });
      }
      el.querySelector('.di-trend-x').addEventListener('change', draw);
      el.querySelector('.di-trend-y').addEventListener('change', draw);
      el.querySelector('#diCloseBtn').addEventListener('click', close);
      positionDiPopover(el, anchorEl);
      draw();
    });
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
  if (els.diFuzzyBtn) els.diFuzzyBtn.addEventListener('click', function () { openFuzzyPopover(els.diFuzzyBtn); });
  if (els.diSummaryBtn) els.diSummaryBtn.addEventListener('click', function () { openSummaryPopover(els.diSummaryBtn); });
  if (els.diTrendBtn) els.diTrendBtn.addEventListener('click', function () { openTrendPopover(els.diTrendBtn); });
  if (els.langToggle) {
    els.langToggle.addEventListener('click', function () {
      setUILang(getUILang() === 'en' ? 'th' : 'en');
      applyStaticI18n();
    });
  }

  /* ── init ── */
  var rsz = null;
  /* กำลังพิมพ์ในเซลล์อยู่ไหม (คีย์บอร์ดเด้ง) — ถ้าใช่ อย่าปรับ/วาดกริดใหม่
     เพราะ iOS ย่อจอเวลาคีย์บอร์ดขึ้น → resize → Luckysheet วาดใหม่กลางคัน → ตัวไทยหาย/หน่วง */
  function isEditingCell() {
    var ae = document.activeElement;
    if (ae && (ae.isContentEditable || /^(INPUT|TEXTAREA)$/.test(ae.tagName)) && els.grid && els.grid.contains(ae)) return true;
    var box = document.getElementById('luckysheet-input-box');
    if (box && box.offsetParent !== null && getComputedStyle(box).display !== 'none') return true;
    return false;
  }
  window.addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(function () { if (isEditingCell()) return; applyGridHeight(false); }, 250); });
  window.addEventListener('orientationchange', function () { setTimeout(function () { if (!isEditingCell()) applyGridHeight(true); }, 320); });

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

  /* ── ตัวกันชน IME สำหรับพิมพ์ไทยในเซลล์ ──
     Luckysheet ไม่รองรับ composition (การประกอบสระ/วรรณยุกต์ไทย) ในเซลล์ →
     ระหว่างยัง "ประกอบตัวอักษร" (e.isComposing) กันไม่ให้ handler ของ Luckysheet
     เข้ามาอ่าน/รีเซ็ตตัวแก้ไขกลางคัน (ตัวไทยหาย) แล้วค่อยสั่งซิงก์ตอนประกอบเสร็จ
     ภาษาอังกฤษ/พิมพ์ปกติ (ไม่ composing) จะไม่โดนแตะเลย จึงเสี่ยงต่ำ */
  function inCellEditor(target) {
    var ed = document.getElementById('luckysheet-rich-text-editor');
    return !!(ed && (target === ed || ed.contains(target)));
  }
  ['keydown', 'keyup', 'input'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (e.isComposing && inCellEditor(e.target)) e.stopImmediatePropagation();
    }, true);
  });
  document.addEventListener('compositionend', function (e) {
    if (!inCellEditor(e.target)) return;
    var ed = document.getElementById('luckysheet-rich-text-editor');
    setTimeout(function () {
      try {
        ed.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        ed.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (_) {}
    }, 0);
  }, true);

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
