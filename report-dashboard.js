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

  /* ══════════════════ i18n ไทย/อังกฤษ — แพทเทิร์นเดียวกับ excel.js/word.js (clone-and-adapt) ══════════════════ */
  var UI_LANG_KEY = 'tanot:reportlang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  function setUILang(l) { try { localStorage.setItem(UI_LANG_KEY, l); } catch (e) {} }
  function locale() { return getUILang() === 'en' ? 'en-US' : 'th-TH'; }
  var I18N = {
    th: {
      docTitle: 'นำเสนอรายงาน — อัปโหลด Excel เป็นแดชบอร์ด | Tanot',
      crumbHome: 'หน้าหลัก', crumbResp: 'งานที่รับผิดชอบ', crumbPage: 'นำเสนอรายงาน',
      pageTitle: 'นำเสนอรายงาน', pageSub: 'อัปโหลดไฟล์ Excel/CSV แล้วดู แก้ไข เรียง กรองข้อมูลได้ในเว็บ',
      statTotalLbl: 'รายการทั้งหมด', statColsLbl: 'คอลัมน์', statShownLbl: 'กำลังแสดง', statSelectedLbl: 'เลือกไว้',
      unitRows: 'แถว', unitCols: 'คอลัมน์',
      tabTable: '📋 ตาราง (แก้ไข)', tabDashboard: '📊 แดชบอร์ด',
      drillText: '🔍 กำลังกรอง: {label} = {value}', drillClearBtn: '✕ ล้างตัวกรองนี้',
      uploadTitle: '📤 อัปโหลดไฟล์', dropText: 'ลากไฟล์มาวางตรงนี้ หรือ', pickBtn: 'เลือกไฟล์',
      dropHint: 'รองรับ .xlsx .xls .csv — ไฟล์ประมวลผลในเครื่องคุณทั้งหมด',
      statusReading: 'กำลังอ่านไฟล์…',
      statusLibFail: 'โหลดไลบรารีอ่านไฟล์ไม่สำเร็จ (ลองออนไลน์แล้วรีเฟรช)',
      statusReadFail: 'อ่านไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง',
      statusOpenFail: 'ไฟล์นี้เปิดไม่ได้ — ตรวจว่าเป็น .xlsx/.xls/.csv ที่ไม่เสียหาย',
      statusSheetEmpty: 'ชีตนี้ไม่มีข้อมูล — ลองเลือกชีตอื่น',
      resumeTitle: '💾 พบข้อมูลที่ทำค้างไว้', resumeBtn: 'ดำเนินการต่อ', discardBtn: 'เริ่มใหม่',
      resumeInfo: '{name} · {n} แถว · บันทึกไว้เมื่อ {date}', resumeFallbackName: 'ไฟล์ที่แล้ว',
      reportsTitle: '📁 รายงานของฉัน', reportsMeta: '{n} รายงาน',
      reportRowMeta: '{n} แถว · บันทึกล่าสุด {time}', openBtn: 'เปิด',
      deleteReportConfirm: 'ลบรายงาน "{name}" ถาวร (กู้คืนไม่ได้)?', renameReportPrompt: 'เปลี่ยนชื่อรายงาน:',
      saveAsReportPrompt: 'ตั้งชื่อรายงานนี้:', reportDefaultBase: 'รายงาน',
      sheetTitle: '📑 เลือกชีต',
      sheetModeHint: 'พบ {n} ชีตในไฟล์นี้ เลือกวิธีนำเข้า:',
      sheetModeCombine: '📚 รวมทุกชีตเป็นตารางเดียว', sheetModeSingle: '📄 เลือกชีตเดียว',
      sourceSheetLabel: 'ชีตต้นทาง', combinedSheetsSuffix: 'รวม {n} ชีต',
      headerTitle: '🔤 เลือกแถวหัวตาราง',
      headerHint: 'คลิกแถวที่เป็นชื่อคอลัมน์ (ปกติเป็นแถวแรกสุด) — ดูตัวอย่าง 8 แถวแรกของไฟล์',
      confirmHeaderBtn: 'ใช้แถวนี้เป็นหัวตาราง →',
      dataTitle: '📋 ข้อมูล', searchPh: 'ค้นหาทุกคอลัมน์…', addRowBtn: '+ เพิ่มแถว',
      delSelBtn: '🗑️ ลบที่เลือก', undoBtn: '↩️ เลิกทำ', clearFilterBtn: 'ล้างตัวกรอง',
      saveReportBtn: '💾 บันทึกเป็นรายงาน', savedReportBtn: '💾 บันทึกแล้ว: {name}',
      myReportsBtn: '📁 รายงานของฉัน', exportXlsxBtn: '⬇️ Excel', exportCsvBtn: '⬇️ CSV', newFileBtn: '📤 ไฟล์ใหม่',
      dataEmptyTxt: 'ไม่พบแถวที่ตรงกับตัวกรอง', colFallback: 'คอลัมน์ {n}',
      filterMin: 'ต่ำสุด', filterMax: 'สูงสุด', filterQ: 'กรอง…', delRowTitle: 'ลบแถวนี้',
      filterIconTitle: 'กรองคอลัมน์นี้', filterSearchPh: 'ค้นหาค่า…', filterSelectAllBtn: 'เลือกทั้งหมด',
      filterSelectNoneBtn: 'ไม่เลือกเลย', filterEmptyList: 'ไม่พบค่าที่ตรงกับคำค้นหา',
      filterApplyBtn: 'ใช้ตัวกรอง', filterCancelBtn: 'ยกเลิก', filterClearThisBtn: 'ล้างตัวกรองนี้',
      addFilterBtn: '+ ตัวกรอง', clearAllFiltersBtn: '✕ ล้างตัวกรองทั้งหมด',
      filterChipValues: '{col}: {n} ค่า', filterChipValue1: '{col}: {v}',
      filterChipMin: '{col}: ≥ {v}', filterChipMax: '{col}: ≤ {v}', filterChipRange: '{col}: {min}–{max}',
      addFilterPickTitle: 'เลือกคอลัมน์ที่จะกรอง',
      columnsBtn: '👁️ คอลัมน์', columnsPopoverTitle: 'เลือกคอลัมน์ที่จะแสดง', columnsSearchPh: 'ค้นหาคอลัมน์…',
      columnsCloseBtn: 'ปิด', columnsHiddenNote: 'ซ่อนอยู่ {n} คอลัมน์',
      pagerPrev: '← ก่อนหน้า', pagerNext: 'ถัดไป →', pagerInfo: 'หน้า {page} / {total} ({n} แถว)',
      metaFilteredSuffix: ' (กรองเหลือ {m})',
      saveStatusSaving: 'กำลังบันทึก…', saveStatusSavedNamed: 'บันทึกเป็นรายงาน "{name}" แล้ว',
      saveStatusFail: 'บันทึกไม่สำเร็จ ลองอีกครั้ง', saveStatusAuto: 'บันทึกอัตโนมัติแล้ว · {time}',
      newFileConfirm: 'ยังไม่ได้บันทึกเป็นรายงาน — เริ่มไฟล์ใหม่จะแทนที่ข้อมูลนี้ ดำเนินการต่อไหม?',
      myReportsConfirm: 'ยังไม่ได้บันทึกเป็นรายงาน — ออกไปดูรายการรายงานจะแทนที่ข้อมูลนี้ ดำเนินการต่อไหม?',
      exportImgBtn: '📷 บันทึกเป็นรูปภาพ', exportPdfBtn: '📄 บันทึกเป็น PDF',
      exportHtmlBtn: '📃 บันทึกเป็น HTML', printBtn: '🖨️ พิมพ์',
      numStatTitle: '🔢 สรุปตัวเลข', statTileSub: 'เฉลี่ย {avg} · ต่ำสุด {min} · สูงสุด {max}',
      domainTemplateLbl: 'แม่แบบ', domainAutoOption: 'อัตโนมัติ', domainNoneOption: 'ทั่วไป (ไม่ใช้แม่แบบ)',
      domainMaintenanceOption: '🛠️ ซ่อมบำรุง', domainProjectOption: '📁 โครงการ', domainLegalOption: '⚖️ กฎหมาย',
      domainRiskOption: '⚠️ ความเสี่ยง',
      domainTitleMaintenance: '🛠️ แดชบอร์ดซ่อมบำรุง', domainTitleProject: '📁 แดชบอร์ดโครงการ', domainTitleLegal: '⚖️ แดชบอร์ดกฎหมาย',
      domainTitleRisk: '⚠️ แดชบอร์ดความเสี่ยง',
      domainDetectedHint: 'ตรวจพบว่าตารางนี้น่าจะเป็นตาราง{name} — เลือกแม่แบบอื่นได้จากด้านบนถ้าไม่ตรง',
      domainTitleNone: '🧩 แดชบอร์ดเฉพาะทาง',
      domainNoMatchHint: 'ยังไม่พบรูปแบบตารางที่ตรงกับแม่แบบใดในตอนนี้ — เลือกแม่แบบเองได้จากด้านบนถ้าต้องการ',
      domainNameMaintenance: 'ซ่อมบำรุง', domainNameProject: 'โครงการ', domainNameLegal: 'กฎหมาย', domainNameRisk: 'ความเสี่ยง',
      rKpiTotal: 'ความเสี่ยงทั้งหมด', rKpiCategories: 'จำนวนหมวดหมู่', rKpiAvgScore: 'คะแนนความเสี่ยงเฉลี่ย',
      rKpiHighCount: 'ความเสี่ยงระดับสูง',
      rChartByCategory: '📊 จำนวนความเสี่ยงต่อประเภท', rChartByStatus: '📊 จำนวนความเสี่ยงต่อสถานะ',
      rChartByOwner: '📊 จำนวนความเสี่ยงต่อผู้รับผิดชอบ',
      rMatrixTitle: '🔥 ตารางความเสี่ยง (โอกาสเกิด × ผลกระทบ)',
      rMatrixAxisNote: 'แกนนอน = โอกาสเกิด (น้อย→มาก) · แกนตั้ง = ผลกระทบ (มาก→น้อย จากบนลงล่าง) · ตัวเลขในช่อง = จำนวนความเสี่ยง',
      mKpiTotalWO: 'Work Order ทั้งหมด', mKpiDowntime: 'Downtime รวม (ชม.)', mKpiCost: 'ต้นทุนซ่อมรวม',
      mKpiMttr: 'เวลาซ่อมเฉลี่ย (ชม.)', mKpiOnTimePct: '% เสร็จตรงแผน',
      mChartStatus: '📊 จำนวนงานต่อสถานะ', mChartCostByType: '📊 ต้นทุนซ่อมต่อประเภทเครื่องจักร',
      mChartCountByPriority: '📊 จำนวนงานต่อระดับความสำคัญ',
      pKpiBudget: 'งบประมาณรวม', pKpiActual: 'ใช้จริงรวม', pKpiRemaining: 'งบคงเหลือ',
      pKpiAvgProgress: 'ความคืบหน้าเฉลี่ย', pKpiOverdue: 'โครงการล่าช้า',
      pChartProgress: '📊 ความคืบหน้า (%) ต่อโครงการ', pChartActualCost: '📊 ใช้จริงต่อโครงการ',
      lKpiSections: 'จำนวนมาตรา', lKpiCategories: 'จำนวนหมวดหมู่',
      lChartByCategory: '📊 จำนวนมาตราต่อหมวดหมู่', lChartByReadStatus: '📊 จำนวนมาตราต่อสถานะการอ่าน',
      lChartByLawName: '📊 จำนวนมาตราต่อกฎหมาย',
      chartTypeLbl: 'ชนิดกราฟ', groupByLbl: 'จัดกลุ่มตาม', sumValueLbl: 'รวมค่า',
      timeAxisLbl: 'แกนเวลา', showByLbl: 'แสดงสัดส่วนตาม', countOption: 'จำนวนรายการ (นับ)',
      typeBar: 'แท่งแนวตั้ง', typeBarH: 'แท่งแนวนอน', typeLine: 'เส้น', typePie: 'วงกลม', typeDoughnut: 'โดนัท',
      barChartTitleDefault: '📊 กราฟแท่ง', lineChartTitleDefault: '📈 แนวโน้มตามเวลา', pieChartTitleDefault: '🥧 สัดส่วน',
      barChartTitleWithNum: '{cat} ตามผลรวม {num}', barChartTitleCount: 'จำนวนรายการตาม {cat}',
      lineChartTitleWithNum: 'แนวโน้ม {num} ตามเวลา ({date})', lineChartTitleCount: 'จำนวนรายการตามเวลา ({date})',
      pieChartTitleTpl: 'สัดส่วนจำนวนรายการตาม {cat}',
      hintBarClick: '👆 แตะกราฟเพื่อกรองตารางเฉพาะกลุ่มนั้น', hintLineClick: '👆 แตะกราฟเพื่อกรองตารางเฉพาะช่วงนั้น',
      dashTableTitle: '📋 ตารางข้อมูล',
      dashTableMetaFull: '{n} แถว · แก้ไขข้อมูลได้ที่แท็บ "{tab}"',
      dashTableMetaCapped: 'แสดง {shown} จาก {total} แถว · ดูทั้งหมด/แก้ไขได้ที่แท็บ "{tab}"',
      dashModeLbl: 'มุมมองตาราง', dashModeFlat: 'รายการ', dashModePivot: 'Pivot',
      pivotRowsLbl: 'แถว', pivotColsLbl: 'คอลัมน์', pivotValueLbl: 'ค่า', pivotAggLbl: 'รวมด้วย',
      pivotNoneOption: '(ไม่มี)', aggSum: 'ผลรวม', aggAvg: 'ค่าเฉลี่ย',
      pivotTotalLbl: 'รวม', pivotGrandTotalLbl: 'รวมทั้งหมด',
      pivotEmptyHint: 'เลือกคอลัมน์ที่จะใช้เป็น "แถว" ของ Pivot ก่อน',
      pivotCapNote: ' (แสดง {n} จาก {total} รายการแรก)',
      dashboardEmptyTitle: '📊 แดชบอร์ด',
      chartLibFail: 'โหลดไลบรารีทำกราฟไม่สำเร็จ (ลองออนไลน์แล้วรีเฟรช)',
      noChartPossible: 'ยังสรุปเป็นกราฟไม่ได้ — ต้องมีอย่างน้อย 1 คอลัมน์ตัวเลข หรือ 1 คอลัมน์หมวดหมู่ที่ไม่ใช่ข้อความอิสระเกินไป',
      noRowsMatch: 'ไม่มีแถวข้อมูลที่ตรงกับตัวกรองที่ตั้งไว้ตอนนี้',
      otherBucket: 'อื่นๆ', emptyValueLabel: '(ว่าง)', emptyCellDash: '—',
      exportLibFail: 'โหลดไลบรารีส่งออกไม่สำเร็จ (ลองออนไลน์แล้วรีเฟรช)', exportNoData: 'ยังไม่มีข้อมูลให้ส่งออก',
      exportedAt: 'ออกรายงานเมื่อ {date} · {n} แถว', exportedFooter: 'สร้างจาก "นำเสนอรายงาน" — Tanot',
      justNow: 'เมื่อสักครู่', minsAgo: '{n} นาทีก่อน', hrsAgo: '{n} ชม.ก่อน'
    },
    en: {
      docTitle: 'Report Dashboard — Upload Excel as a Dashboard | Tanot',
      crumbHome: 'Home', crumbResp: 'Responsibilities', crumbPage: 'Report Dashboard',
      pageTitle: 'Report Dashboard', pageSub: 'Upload an Excel/CSV file to view, edit, sort, and filter your data right in the browser',
      statTotalLbl: 'Total Rows', statColsLbl: 'Columns', statShownLbl: 'Showing', statSelectedLbl: 'Selected',
      unitRows: 'rows', unitCols: 'columns',
      tabTable: '📋 Table (Edit)', tabDashboard: '📊 Dashboard',
      drillText: '🔍 Filtering: {label} = {value}', drillClearBtn: '✕ Clear this filter',
      uploadTitle: '📤 Upload File', dropText: 'Drag a file here, or', pickBtn: 'Choose File',
      dropHint: 'Supports .xlsx .xls .csv — everything is processed on your device',
      statusReading: 'Reading file…',
      statusLibFail: "Couldn't load the file-reading library (go online and refresh)",
      statusReadFail: "Couldn't read the file — please try again",
      statusOpenFail: "Couldn't open this file — make sure it's a valid, uncorrupted .xlsx/.xls/.csv",
      statusSheetEmpty: 'This sheet has no data — try another sheet',
      resumeTitle: '💾 Found Unsaved Work', resumeBtn: 'Continue', discardBtn: 'Start Over',
      resumeInfo: '{name} · {n} rows · saved {date}', resumeFallbackName: 'Previous file',
      reportsTitle: '📁 My Reports', reportsMeta: '{n} reports',
      reportRowMeta: '{n} rows · last saved {time}', openBtn: 'Open',
      deleteReportConfirm: 'Permanently delete report "{name}"? This cannot be undone.', renameReportPrompt: 'Rename report:',
      saveAsReportPrompt: 'Name this report:', reportDefaultBase: 'Report',
      sheetTitle: '📑 Choose Sheet',
      sheetModeHint: 'Found {n} sheets in this file — choose how to import:',
      sheetModeCombine: '📚 Combine all sheets into one table', sheetModeSingle: '📄 Choose one sheet',
      sourceSheetLabel: 'Source Sheet', combinedSheetsSuffix: 'combined {n} sheets',
      headerTitle: '🔤 Choose the Header Row',
      headerHint: 'Click the row that contains your column names (usually the first row) — showing the first 8 rows',
      confirmHeaderBtn: 'Use this row as the header →',
      dataTitle: '📋 Data', searchPh: 'Search all columns…', addRowBtn: '+ Add Row',
      delSelBtn: '🗑️ Delete Selected', undoBtn: '↩️ Undo', clearFilterBtn: 'Clear Filters',
      saveReportBtn: '💾 Save as Report', savedReportBtn: '💾 Saved: {name}',
      myReportsBtn: '📁 My Reports', exportXlsxBtn: '⬇️ Excel', exportCsvBtn: '⬇️ CSV', newFileBtn: '📤 New File',
      dataEmptyTxt: 'No rows match the current filters', colFallback: 'Column {n}',
      filterMin: 'Min', filterMax: 'Max', filterQ: 'Filter…', delRowTitle: 'Delete this row',
      filterIconTitle: 'Filter this column', filterSearchPh: 'Search values…', filterSelectAllBtn: 'Select all',
      filterSelectNoneBtn: 'Select none', filterEmptyList: 'No values match your search',
      filterApplyBtn: 'Apply filter', filterCancelBtn: 'Cancel', filterClearThisBtn: 'Clear this filter',
      addFilterBtn: '+ Filter', clearAllFiltersBtn: '✕ Clear all filters',
      filterChipValues: '{col}: {n} values', filterChipValue1: '{col}: {v}',
      filterChipMin: '{col}: ≥ {v}', filterChipMax: '{col}: ≤ {v}', filterChipRange: '{col}: {min}–{max}',
      addFilterPickTitle: 'Choose a column to filter',
      columnsBtn: '👁️ Columns', columnsPopoverTitle: 'Choose columns to show', columnsSearchPh: 'Search columns…',
      columnsCloseBtn: 'Close', columnsHiddenNote: '{n} columns hidden',
      pagerPrev: '← Prev', pagerNext: 'Next →', pagerInfo: 'Page {page} / {total} ({n} rows)',
      metaFilteredSuffix: ' (filtered to {m})',
      saveStatusSaving: 'Saving…', saveStatusSavedNamed: 'Saved as report "{name}"',
      saveStatusFail: "Couldn't save — please try again", saveStatusAuto: 'Autosaved · {time}',
      newFileConfirm: "This hasn't been saved as a report yet — starting a new file will replace this data. Continue?",
      myReportsConfirm: "This hasn't been saved as a report yet — leaving to view your reports will replace this data. Continue?",
      exportImgBtn: '📷 Save as Image', exportPdfBtn: '📄 Save as PDF',
      exportHtmlBtn: '📃 Save as HTML', printBtn: '🖨️ Print',
      numStatTitle: '🔢 Number Summary', statTileSub: 'avg {avg} · min {min} · max {max}',
      domainTemplateLbl: 'Template', domainAutoOption: 'Auto', domainNoneOption: 'Generic (no template)',
      domainMaintenanceOption: '🛠️ Maintenance', domainProjectOption: '📁 Project', domainLegalOption: '⚖️ Legal',
      domainRiskOption: '⚠️ Risk',
      domainTitleMaintenance: '🛠️ Maintenance Dashboard', domainTitleProject: '📁 Project Dashboard', domainTitleLegal: '⚖️ Legal Dashboard',
      domainTitleRisk: '⚠️ Risk Dashboard',
      domainDetectedHint: 'Detected this as a {name} table — pick a different template above if it’s wrong',
      domainTitleNone: '🧩 Specialized Dashboard',
      domainNoMatchHint: 'No template matched this table automatically — pick one above if you’d like.',
      domainNameMaintenance: 'Maintenance', domainNameProject: 'Project', domainNameLegal: 'Legal', domainNameRisk: 'Risk',
      rKpiTotal: 'Total Risks', rKpiCategories: 'Total Categories', rKpiAvgScore: 'Avg Risk Score',
      rKpiHighCount: 'High Risks',
      rChartByCategory: '📊 Risks by Category', rChartByStatus: '📊 Risks by Status',
      rChartByOwner: '📊 Risks by Owner',
      rMatrixTitle: '🔥 Risk Matrix (Likelihood × Impact)',
      rMatrixAxisNote: 'X-axis = Likelihood (low→high) · Y-axis = Impact (high→low, top to bottom) · numbers = risk count per cell',
      mKpiTotalWO: 'Total Work Orders', mKpiDowntime: 'Total Downtime (hrs)', mKpiCost: 'Total Repair Cost',
      mKpiMttr: 'Avg Repair Time (hrs)', mKpiOnTimePct: '% Completed On Plan',
      mChartStatus: '📊 Work Orders by Status', mChartCostByType: '📊 Repair Cost by Equipment Type',
      mChartCountByPriority: '📊 Work Orders by Priority',
      pKpiBudget: 'Total Budget', pKpiActual: 'Total Actual Cost', pKpiRemaining: 'Budget Remaining',
      pKpiAvgProgress: 'Avg Progress', pKpiOverdue: 'Overdue Projects',
      pChartProgress: '📊 Progress (%) by Project', pChartActualCost: '📊 Actual Cost by Project',
      lKpiSections: 'Total Sections', lKpiCategories: 'Total Categories',
      lChartByCategory: '📊 Sections by Category', lChartByReadStatus: '📊 Sections by Read Status',
      lChartByLawName: '📊 Sections by Law',
      chartTypeLbl: 'Chart type', groupByLbl: 'Group by', sumValueLbl: 'Value',
      timeAxisLbl: 'Time axis', showByLbl: 'Break down by', countOption: 'Row count',
      typeBar: 'Column', typeBarH: 'Bar', typeLine: 'Line', typePie: 'Pie', typeDoughnut: 'Doughnut',
      barChartTitleDefault: '📊 Bar Chart', lineChartTitleDefault: '📈 Trend Over Time', pieChartTitleDefault: '🥧 Breakdown',
      barChartTitleWithNum: '{cat} by total {num}', barChartTitleCount: 'Row count by {cat}',
      lineChartTitleWithNum: '{num} trend over time ({date})', lineChartTitleCount: 'Row count over time ({date})',
      pieChartTitleTpl: 'Row count breakdown by {cat}',
      hintBarClick: '👆 Tap the chart to filter the table to that group', hintLineClick: '👆 Tap the chart to filter the table to that period',
      dashTableTitle: '📋 Data Table',
      dashTableMetaFull: '{n} rows · edit data in the "{tab}" tab',
      dashTableMetaCapped: 'Showing {shown} of {total} rows · see all/edit in the "{tab}" tab',
      dashModeLbl: 'Table view', dashModeFlat: 'List', dashModePivot: 'Pivot',
      pivotRowsLbl: 'Rows', pivotColsLbl: 'Columns', pivotValueLbl: 'Value', pivotAggLbl: 'Summarize by',
      pivotNoneOption: '(None)', aggSum: 'Sum', aggAvg: 'Average',
      pivotTotalLbl: 'Total', pivotGrandTotalLbl: 'Grand Total',
      pivotEmptyHint: 'Choose a column to use as the Pivot "Rows" first',
      pivotCapNote: ' (showing the first {n} of {total})',
      dashboardEmptyTitle: '📊 Dashboard',
      chartLibFail: "Couldn't load the charting library (go online and refresh)",
      noChartPossible: 'Not enough structure to chart yet — you need at least 1 numeric column or 1 category-like column',
      noRowsMatch: 'No rows match the current filter',
      otherBucket: 'Other', emptyValueLabel: '(empty)', emptyCellDash: '—',
      exportLibFail: "Couldn't load the export library (go online and refresh)", exportNoData: 'No data to export yet',
      exportedAt: 'Generated {date} · {n} rows', exportedFooter: 'Generated from "Report Dashboard" — Tanot',
      justNow: 'Just now', minsAgo: '{n} min ago', hrsAgo: '{n} hr ago'
    }
  };
  function t(key, vars) {
    var s = (I18N[getUILang()] && I18N[getUILang()][key]) || I18N.th[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }
  function applyStaticI18n() {
    var lang = getUILang();
    document.documentElement.lang = lang;
    document.title = t('docTitle');
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.title = t(el.getAttribute('data-i18n-title')); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
    var lt = $('langToggle');
    if (lt) lt.querySelectorAll('span').forEach(function (s) { s.classList.toggle('active', s.getAttribute('data-lt') === lang); });
  }

  var state = {
    fileName: null,
    sheetNames: [],
    activeSheet: null,
    combineMode: false,    // true = รวมทุกชีตเป็นตารางเดียว (Append แบบ Power BI, จับคู่คอลัมน์ตามชื่อ) แทนการเลือกชีตเดียว
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
    dashTable: { mode: 'flat', pivotRow: null, pivotCol: '', pivotVal: '', pivotAgg: 'sum', filters: {}, hiddenCols: {} }, // ตารางในแดชบอร์ด: โหมดรายการ/pivot + ตัวกรองของตัวเอง (ไม่ผูกกับ state.filters ของแท็บแก้ไข)
    domainOverride: null,  // '' หรือ null = อัตโนมัติ (เดาจากชื่อคอลัมน์), 'none'|'maintenance'|'project'|'legal' = ผู้ใช้เลือกเอง
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
        combineMode: state.combineMode, sheetNames: state.sheetNames,
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
          combineMode: state.combineMode, sheetNames: state.sheetNames,
          columns: state.columns, rows: state.rows, nextRowId: state.nextRowId, savedAt: Date.now()
        });
        setSaveStatus(t('saveStatusAuto', { time: new Date().toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) }), 'ok');
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
    setUploadStatus(t('statusReading'), '');
    if (typeof XLSX === 'undefined') { setUploadStatus(t('statusLibFail'), 'err'); return; }
    var reader = new FileReader();
    reader.onerror = function () { setUploadStatus(t('statusReadFail'), 'err'); };
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        if (!wb.SheetNames || !wb.SheetNames.length) throw new Error('empty workbook');
        onWorkbookParsed(wb, file.name);
      } catch (err) {
        setUploadStatus(t('statusOpenFail'), 'err');
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
      state.combineMode = false;
      selectSheet(wb.SheetNames[0]);
    }
  }

  /* หลายชีต: ให้เลือกว่าจะ "รวมทุกชีตเป็นตารางเดียว" (Append แบบ Power BI — จับคู่คอลัมน์ตามชื่อ ไม่ใช่ตำแหน่ง,
     คอลัมน์ที่ไม่มีในบางชีตจะเป็นค่าว่าง, เพิ่มคอลัมน์ "ชีตต้นทาง" อัตโนมัติ) หรือ "เลือกชีตเดียว" แบบเดิม
     ดีฟอลต์เป็นโหมดรวม เพราะผู้ใช้ทั่วไปที่มีหลายชีตโครงสร้างเดียวกัน (เช่น รายเดือน) มักอยากดูรวมกันมากกว่า */
  function showSheetPicker() {
    $('sheetModeHint').textContent = t('sheetModeHint', { n: state.sheetNames.length });
    var html = '';
    state.sheetNames.forEach(function (name) {
      html += '<button type="button" class="chip" data-sheet="' + escapeAttr(name) + '">' + escapeHtml(name) + '</button>';
    });
    $('sheetChips').innerHTML = html;
    $('sheetChips').style.display = 'none';
    $('sheetModeCombine').classList.remove('on'); $('sheetModeSingle').classList.remove('on');
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
    state.combineMode = false;
    state.activeSheet = name;
    var sheet = state.workbook.Sheets[name];
    var aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    /* ตัดแถวว่างล้วนท้ายไฟล์ทิ้ง (พบบ่อยจากไฟล์ Excel ที่มีช่วงเซลล์เผื่อไว้เกินข้อมูลจริง) */
    while (aoa.length && aoa[aoa.length - 1].every(function (c) { return c === null || c === ''; })) aoa.pop();
    if (!aoa.length) { setUploadStatus(t('statusSheetEmpty'), 'err'); return; }
    state.rawAoA = aoa;
    state.headerRowIdx = 0;
    renderHeaderPreview();
    $('headerCard').style.display = 'block';
    $('headerCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* โหมดรวมทุกชีต: ใช้ตำแหน่งแถวหัวตารางของ "ชีตแรก" เป็นตัวแทนทุกชีต (สมมติว่าไฟล์จริงมีแถวหัวตำแหน่ง
     เดียวกันทุกชีต ซึ่งเป็นกรณีทั่วไปที่สุด) — พรีวิวแถวหัวจากชีตแรกเท่านั้น ตอนกด "ใช้แถวนี้เป็นหัวตาราง"
     ค่อยไปประมวลผลทุกชีตจริงใน buildColumnsAndRowsCombined() */
  function selectCombinedSheets() {
    state.combineMode = true;
    $('sheetModeCombine').classList.add('on'); $('sheetModeSingle').classList.remove('on');
    $('sheetChips').style.display = 'none';
    state.activeSheet = state.sheetNames[0];
    var sheet = state.workbook.Sheets[state.activeSheet];
    var aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    while (aoa.length && aoa[aoa.length - 1].every(function (c) { return c === null || c === ''; })) aoa.pop();
    if (!aoa.length) { setUploadStatus(t('statusSheetEmpty'), 'err'); return; }
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
    var built = state.combineMode
      ? buildColumnsAndRowsCombined(state.workbook, state.sheetNames, state.headerRowIdx)
      : buildColumnsAndRows(state.rawAoA, state.headerRowIdx);
    state.columns = built.columns; state.rows = built.rows; state.nextRowId = built.nextRowId;
    state.filters = {}; state.globalQuery = ''; $('globalSearch').value = '';
    state.sortCol = null; state.sortDir = null;
    state.selected = {}; state.page = 1; state.history = [];
    state.drill = null; state.chartChoice = { barCat: null, barNum: null, pieCat: null, lineDate: null, lineNum: null };
    state.chartType = { slot1: null, slot2: null, slot3: null };
    state.dashTable = { mode: 'flat', pivotRow: null, pivotCol: '', pivotVal: '', pivotAgg: 'sum', filters: {}, hiddenCols: {} };
    state.domainOverride = null;
    state.reportId = null; state.reportName = null;
    updateDrillBanner(); updateSaveUI();
    $('undoBtn').disabled = true;
    $('sheetCard').style.display = 'none';
    $('headerCard').style.display = 'none';
    $('uploadCard').style.display = 'none';
    $('resumeCard').style.display = 'none';
    $('reportsCard').style.display = 'none';
    $('dataMeta').textContent = (state.fileName || '') + dataMetaSheetSuffix() + ' · ' + state.rows.length.toLocaleString(locale()) + ' ' + t('unitRows');
    $('viewTabs').style.display = 'flex';
    setView('table'); // เรียก renderTable() ให้เองในตัว
    persistDebounced();
  }

  /* ต่อท้าย dataMeta บอกที่มาของชีต: โหมดรวม → "รวม N ชีต", โหมดชีตเดียวที่ไฟล์มีหลายชีต → ชื่อชีตที่เลือก,
     ไฟล์ชีตเดียวหรือรายงานเก่าที่ไม่มีข้อมูลนี้ → ไม่ต่อท้ายอะไร */
  function dataMetaSheetSuffix() {
    if (state.combineMode) return ' · ' + t('combinedSheetsSuffix', { n: state.sheetNames.length });
    return (state.sheetNames.length > 1 && state.activeSheet) ? ' · ' + state.activeSheet : '';
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
      label = (label == null || String(label).trim() === '') ? t('colFallback', { n: c + 1 }) : String(label);
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

  /* รวมทุกชีตเป็นตารางเดียว — สไตล์ "Append" ของ Power Query/Power BI: จับคู่คอลัมน์ตาม "ชื่อ" (ไม่ใช่ตำแหน่ง),
     ชีตไหนไม่มีคอลัมน์นั้นก็เป็นค่าว่างในแถวจากชีตนั้น ไม่ error/ไม่บังคับให้ทุกชีตหน้าตาเหมือนกันเป๊ะ
     และเติมคอลัมน์ "ชีตต้นทาง" ให้อัตโนมัติเพื่อยังบอกได้ว่าแต่ละแถวมาจากชีตไหน (headerIdx ใช้ตำแหน่งเดียวกัน
     ทุกชีต ตามที่พรีวิวไว้จากชีตแรก — ชีตที่สั้นกว่าตำแหน่งนี้จะถูกข้ามไปทั้งชีต) */
  function buildColumnsAndRowsCombined(workbook, sheetNames, headerIdx) {
    var labelOrder = [], labelSeen = {}, perSheet = [];
    sheetNames.forEach(function (name) {
      var sheet = workbook.Sheets[name];
      var aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
      while (aoa.length && aoa[aoa.length - 1].every(function (c) { return c === null || c === ''; })) aoa.pop();
      if (!aoa.length || headerIdx >= aoa.length) return;
      var headerRow = aoa[headerIdx] || [];
      var dataRows = aoa.slice(headerIdx + 1).filter(function (r) { return r.some(function (v) { return v !== null && v !== undefined && v !== ''; }); });
      var labels = [];
      for (var c = 0; c < headerRow.length; c++) {
        var label = headerRow[c];
        label = (label == null || String(label).trim() === '') ? t('colFallback', { n: c + 1 }) : String(label);
        labels.push(label);
        if (!labelSeen[label]) { labelSeen[label] = true; labelOrder.push(label); }
      }
      perSheet.push({ name: name, labels: labels, dataRows: dataRows });
    });

    var columns = labelOrder.map(function (label, i) { return { key: 'col_' + i, label: label }; });
    var labelToKey = {}; columns.forEach(function (col) { labelToKey[col.label] = col.key; });
    var srcKey = 'col_source_sheet';
    columns.push({ key: srcKey, label: t('sourceSheetLabel') });

    var rows = [], nextId = 1;
    perSheet.forEach(function (sh) {
      sh.dataRows.forEach(function (r) {
        var row = { __id: nextId++ };
        columns.forEach(function (col) { row[col.key] = null; });
        sh.labels.forEach(function (label, ci) { row[labelToKey[label]] = r[ci] === undefined ? null : r[ci]; });
        row[srcKey] = sh.name;
        rows.push(row);
      });
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
    else s = (v === null || v === undefined || v === '') ? t('emptyValueLabel') : String(v);
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
        return String(va).localeCompare(String(vb), getUILang()) * dir;
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
            '<input class="filter-in" type="' + inType + '" data-col="' + col.key + '" data-k="min" value="' + escapeAttr(minV) + '" placeholder="' + escapeAttr(t('filterMin')) + '">' +
            '<input class="filter-in" type="' + inType + '" data-col="' + col.key + '" data-k="max" value="' + escapeAttr(maxV) + '" placeholder="' + escapeAttr(t('filterMax')) + '">' +
            '</div></td>';
        }
        var q = f && f.q ? f.q : '';
        return '<td><input class="filter-in" type="text" data-col="' + col.key + '" data-k="q" value="' + escapeAttr(q) + '" placeholder="' + escapeAttr(t('filterQ')) + '"></td>';
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
          '<td class="rowdel"><button type="button" class="del1" data-id="' + row.__id + '" title="' + escapeAttr(t('delRowTitle')) + '">✕</button></td>' +
          '</tr>';
      });
    }
    tbody += '</tbody>';
    $('dataTable').innerHTML = thead + tbody;
    $('dataEmpty').textContent = t('dataEmptyTxt');
    $('dataEmpty').style.display = pageRows.length ? 'none' : 'block';

    renderPager(all.length, totalPages);
    wireTableEvents();
    $('dataMeta').textContent = (state.fileName || '') + dataMetaSheetSuffix() +
      ' · ' + state.rows.length.toLocaleString(locale()) + ' ' + t('unitRows') +
      (all.length !== state.rows.length ? t('metaFilteredSuffix', { m: all.length.toLocaleString(locale()) }) : '');
    updateStatRow(all.length);
    updateSelectionUI();
  }

  /* แถบสถิติด่วนบนสุด (รายการทั้งหมด/คอลัมน์/กำลังแสดง) — แยกออกมาจาก renderTable() เพราะต้องอัปเดตด้วยตอน
     สลับภาษา แม้กำลังอยู่ในมุมมองแดชบอร์ด (ซึ่งไม่เรียก renderTable()) ไม่งั้นแถบนี้ค้างเป็นภาษาเดิม */
  function updateStatRow(shownCount) {
    if (shownCount === undefined) shownCount = getFilteredSorted().length;
    $('statRow').style.display = 'grid';
    $('statTotal').innerHTML = state.rows.length.toLocaleString(locale()) + ' <span class="unit">' + t('unitRows') + '</span>';
    $('statCols').innerHTML = state.columns.length.toLocaleString(locale()) + ' <span class="unit">' + t('unitCols') + '</span>';
    $('statShown').innerHTML = shownCount.toLocaleString(locale()) + ' <span class="unit">' + t('unitRows') + '</span>';
  }

  /* ── ตารางข้อมูลอ่านอย่างเดียวในมุมมองแดชบอร์ด — ไม่มีช่องแก้ไข/checkbox/ลบแถว ต่างจาก renderTable()
     ที่เป็นตารางแก้ไขเต็มรูปแบบของแท็บ "ตาราง (แก้ไข)" จำกัดจำนวนแถวที่แสดงกันหน้าอืดถ้าไฟล์ใหญ่มาก
     รองรับ 2 โหมด: รายการ (flat, เดิม) และ Pivot (จัดกลุ่มแถว×คอลัมน์×รวมค่า) + มีแถวกรองต่อคอลัมน์ของตัวเอง
     (state.dashTable.filters — แยกจาก state.filters ของแท็บแก้ไข ไม่กระทบกราฟด้านบนซึ่งยังคงสรุปจากข้อมูล
     ที่ผ่าน drill เท่านั้น) คืนค่า true/false ว่าแสดงการ์ดหรือไม่ (ให้ renderDashboard() รวมกับ anyRendered) */
  var DASH_TABLE_CAP = 300, PIVOT_ROW_CAP = 60, PIVOT_COL_CAP = 20;
  var lastDashRows = [];

  function matchesDashFilters(row) {
    for (var i = 0; i < state.columns.length; i++) {
      var col = state.columns[i], f = state.dashTable.filters[col.key];
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
      } else if (f.values) {
        /* กรองแบบ Excel: values = รายการค่าที่ "อนุญาตให้แสดง" (มาจาก popup checkbox) ไม่ใช่ substring search
           แบบเดิม — แถวว่างเทียบกับ emptyValueLabel เดียวกับที่ใช้ตอนสร้างรายการ checkbox ใน popup */
        if (f.values.indexOf(dashValueKey(v)) === -1) return false;
      }
    }
    return true;
  }
  function dashValueKey(v) { return (v === null || v === undefined || v === '') ? t('emptyValueLabel') : String(v); }

  /* จัดกลุ่มแถว×คอลัมน์×รวมค่า แบบ Excel PivotTable ง่ายๆ — ไม่มี colCol = รวมเป็นคอลัมน์ค่าเดียว,
     ไม่มี valCol = นับจำนวนแถวแทนการรวมตัวเลข จำกัดจำนวนแถว/คอลัมน์ที่ไม่ซ้ำกันกันตารางใหญ่เกินไป */
  function buildPivot(rows, noCap) {
    var dt = state.dashTable;
    var rowCol = state.columns.filter(function (c) { return c.key === dt.pivotRow; })[0];
    if (!rowCol) return null;
    var colCol = dt.pivotCol ? state.columns.filter(function (c) { return c.key === dt.pivotCol; })[0] : null;
    var valCol = dt.pivotVal ? state.columns.filter(function (c) { return c.key === dt.pivotVal; })[0] : null;
    var agg = dt.pivotAgg;
    var rowKeys = [], rowSeen = {}, colKeys = [], colSeen = {}, cells = {};
    rows.forEach(function (r) {
      var rv = r[rowCol.key]; rv = (rv === null || rv === undefined || rv === '') ? t('emptyValueLabel') : String(rv);
      if (!rowSeen[rv]) { rowSeen[rv] = true; rowKeys.push(rv); }
      var cv = '__single__';
      if (colCol) {
        var cvv = r[colCol.key]; cv = (cvv === null || cvv === undefined || cvv === '') ? t('emptyValueLabel') : String(cvv);
        if (!colSeen[cv]) { colSeen[cv] = true; colKeys.push(cv); }
      }
      if (!cells[rv]) cells[rv] = {};
      if (!cells[rv][cv]) cells[rv][cv] = { sum: 0, count: 0 };
      var v = valCol ? r[valCol.key] : 1;
      if (typeof v === 'number' && isFinite(v)) cells[rv][cv].sum += v;
      cells[rv][cv].count += 1;
    });
    rowKeys.sort(function (a, b) { return a.localeCompare(b, getUILang()); });
    if (colCol) colKeys.sort(function (a, b) { return a.localeCompare(b, getUILang()); });
    var rowTotalCount = rowKeys.length, colTotalCount = colCol ? colKeys.length : 1;
    var rowTruncated = !noCap && rowKeys.length > PIVOT_ROW_CAP, colTruncated = !!(!noCap && colCol && colKeys.length > PIVOT_COL_CAP);
    if (rowTruncated) rowKeys = rowKeys.slice(0, PIVOT_ROW_CAP);
    if (colTruncated) colKeys = colKeys.slice(0, PIVOT_COL_CAP);
    function cellVal(rv, cv) {
      var c = cells[rv] && cells[rv][cv];
      if (!c) return null;
      if (!valCol) return c.count;
      if (agg === 'avg') return c.count ? c.sum / c.count : 0;
      return c.sum;
    }
    return {
      rowLabel: rowCol.label, colLabel: colCol ? colCol.label : null, valLabel: valCol ? valCol.label : t('countOption'),
      rowKeys: rowKeys, colKeys: colCol ? colKeys : ['__single__'], cellVal: cellVal,
      rowTruncated: rowTruncated, colTruncated: colTruncated, rowTotalCount: rowTotalCount, colTotalCount: colTotalCount
    };
  }
  function fmtPivotNum(n) { return n == null ? t('emptyCellDash') : n.toLocaleString(locale(), { maximumFractionDigits: 2 }); }

  /* วาดเฉพาะเนื้อ <table> + meta — แยกจากการวาดแถบควบคุม/แถวกรอง กันช่องกรองเสียโฟกัสตอนพิมพ์
     (ต่างจาก renderTable() หลักที่ต้อง refocus เอง เพราะที่นี่ input ตัวเดิมไม่ถูกลบทิ้งเลย) */
  function renderDashTableBody() {
    var rows = lastDashRows.filter(matchesDashFilters);
    var dt = state.dashTable;
    if (dt.mode === 'pivot') {
      var piv = dt.pivotRow ? buildPivot(rows) : null;
      if (!piv) { $('dashTable').innerHTML = ''; $('dashTableMeta').textContent = t('pivotEmptyHint'); return; }
      var cornerLabel = piv.colLabel ? (piv.rowLabel + ' \\ ' + piv.colLabel) : piv.rowLabel;
      var thead = '<thead><tr><th>' + escapeHtml(cornerLabel) + '</th>' +
        piv.colKeys.map(function (ck) { return '<th class="num">' + escapeHtml(ck === '__single__' ? piv.valLabel : ck) + '</th>'; }).join('') +
        (piv.colLabel ? '<th class="num piv-total">' + escapeHtml(t('pivotTotalLbl')) + '</th>' : '') +
        '</tr></thead>';
      var colTotals = {}, grandTotal = 0;
      var bodyRows = piv.rowKeys.map(function (rk) {
        var rowTotal = 0;
        var tds = piv.colKeys.map(function (ck) {
          var v = piv.cellVal(rk, ck);
          if (v != null) { colTotals[ck] = (colTotals[ck] || 0) + v; rowTotal += v; }
          return '<td class="num">' + fmtPivotNum(v) + '</td>';
        }).join('');
        grandTotal += rowTotal;
        return '<tr><td>' + escapeHtml(rk) + '</td>' + tds + (piv.colLabel ? '<td class="num piv-total">' + fmtPivotNum(rowTotal) + '</td>' : '') + '</tr>';
      }).join('');
      var totalsRow = piv.colLabel ? ('<tr class="piv-total-row"><td class="piv-total">' + escapeHtml(t('pivotGrandTotalLbl')) + '</td>' +
        piv.colKeys.map(function (ck) { return '<td class="num piv-total">' + fmtPivotNum(colTotals[ck] || 0) + '</td>'; }).join('') +
        '<td class="num piv-total">' + fmtPivotNum(grandTotal) + '</td></tr>') : '';
      $('dashTable').innerHTML = thead + '<tbody>' + bodyRows + totalsRow + '</tbody>';
      var meta = rows.length.toLocaleString(locale()) + ' ' + t('unitRows');
      if (piv.rowTruncated) meta += t('pivotCapNote', { n: piv.rowKeys.length, total: piv.rowTotalCount });
      $('dashTableMeta').textContent = meta;
    } else {
      var shown = rows.slice(0, DASH_TABLE_CAP);
      var visCols = state.columns.filter(function (c) { return !dt.hiddenCols[c.key]; });
      var thead2 = '<thead><tr>' + visCols.map(function (col) {
        var active = !!dt.filters[col.key];
        return '<th class="' + (col.type === 'number' ? 'num' : '') + '">' + escapeHtml(col.label) +
          '<button type="button" class="th-filter-btn' + (active ? ' active' : '') + '" data-col="' + col.key + '" title="' + escapeAttr(t('filterIconTitle')) + '">🔽</button></th>';
      }).join('') + '</tr></thead>';
      var tbody2 = '<tbody>' + shown.map(function (row) {
        return '<tr>' + visCols.map(function (col) {
          var v = row[col.key];
          var txt = (col.type === 'number' && typeof v === 'number')
            ? v.toLocaleString(locale(), { maximumFractionDigits: 2 })
            : (cellEditValue(v, col.type) || t('emptyCellDash'));
          return '<td class="' + (col.type === 'number' ? 'num' : '') + '">' + escapeHtml(txt) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody>';
      $('dashTable').innerHTML = thead2 + tbody2;
      [].forEach.call($('dashTable').querySelectorAll('.th-filter-btn'), function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var col = state.columns.filter(function (c) { return c.key === btn.getAttribute('data-col'); })[0];
          openColumnFilterPopover(col, btn);
        });
      });
      $('dashTableMeta').textContent = rows.length > DASH_TABLE_CAP
        ? t('dashTableMetaCapped', { shown: DASH_TABLE_CAP.toLocaleString(locale()), total: rows.length.toLocaleString(locale()), tab: t('tabTable') })
        : t('dashTableMetaFull', { n: rows.length.toLocaleString(locale()), tab: t('tabTable') });
    }
  }

  /* วาดแถบโหมด/ตัวเลือก Pivot + แถวกรองต่อคอลัมน์ (เรียกเมื่อชุดข้อมูล/คอลัมน์อาจเปลี่ยน ไม่ใช่ทุกคีย์
     ที่พิมพ์ในช่องกรอง — อินพุตกรองเรียก renderDashTableBody() ตรงๆ แทน กันเสียโฟกัส) */
  function renderDashTableControls() {
    var dt = state.dashTable;
    $('dashModeSel').value = dt.mode;
    var isPivot = dt.mode === 'pivot';
    $('pivotRowWrap').style.display = isPivot ? '' : 'none';
    $('pivotColWrap').style.display = isPivot ? '' : 'none';
    $('pivotValWrap').style.display = isPivot ? '' : 'none';
    $('pivotAggWrap').style.display = (isPivot && dt.pivotVal) ? '' : 'none';
    if (isPivot) {
      /* เรียงคอลัมน์หมวดหมู่จากค่าไม่ซ้ำน้อยไปมากก่อน (เหมือนที่กราฟใช้) แล้วค่อยต่อท้ายด้วยคอลัมน์วันที่ —
         กันค่าเริ่มต้นของ "แถว" ดันไปเจอคอลัมน์ที่ไม่ซ้ำเกือบทุกแถว (เช่น ชื่อสินค้า) ซึ่งไม่มีประโยชน์ในการทำ pivot */
      var catCols0 = sortByUniqCountAsc(state.columns.filter(function (c) { return c.type === 'category'; }), lastDashRows);
      var dateCols0 = state.columns.filter(function (c) { return c.type === 'date'; });
      var catDateCols = catCols0.concat(dateCols0);
      var numCols = state.columns.filter(function (c) { return c.type === 'number'; });
      if (!dt.pivotRow && catDateCols.length) dt.pivotRow = catDateCols[0].key;
      fillSelect($('pivotRowSel'), catDateCols, dt.pivotRow);
      fillSelect($('pivotColSel'), catCols0, dt.pivotCol, t('pivotNoneOption'));
      fillSelect($('pivotValSel'), numCols, dt.pivotVal, t('countOption'));
      $('pivotAggSel').value = dt.pivotAgg;
    }
    renderDashActiveFilters();
  }

  /* ══════════════════ ตัวกรองต่อคอลัมน์ของตารางในแดชบอร์ด — แบบ popup (Excel-style) ══════════════════
     เดิมเคยเป็นแถวกรองตรึงอยู่ตลอดทีละคอลัมน์ ซึ่งรกมากเมื่อคอลัมน์เยอะ (ผู้ใช้รายงาน) — เปลี่ยนมาเป็น:
     ไอคอน 🔽 ที่หัวคอลัมน์ (เฉพาะโหมดรายการ, วาดใน renderDashTableBody) + แถบ chip ตัวกรองที่ active
     อยู่เหนือตาราง (แสดงได้ทั้ง 2 โหมด เพราะตัวกรองมีผลก่อน pivot เสมอ) กด "+ ตัวกรอง" เพื่อเลือกคอลัมน์ที่
     ยังไม่ได้กรองแล้วเปิด popup แบบเดียวกับกดไอคอนที่หัวคอลัมน์ */
  function filterChipLabel(col, f) {
    if (f.values) return f.values.length === 1 ? t('filterChipValue1', { col: col.label, v: f.values[0] }) : t('filterChipValues', { col: col.label, n: f.values.length });
    var hasMin = f.min !== undefined && f.min !== '' && f.min !== null;
    var hasMax = f.max !== undefined && f.max !== '' && f.max !== null;
    if (hasMin && hasMax) return t('filterChipRange', { col: col.label, min: f.min, max: f.max });
    if (hasMin) return t('filterChipMin', { col: col.label, v: f.min });
    if (hasMax) return t('filterChipMax', { col: col.label, v: f.max });
    return col.label;
  }
  function renderDashActiveFilters() {
    var dt = state.dashTable;
    var activeCols = state.columns.filter(function (c) { return !!dt.filters[c.key]; });
    var html = activeCols.map(function (col) {
      return '<span class="filter-chip" data-col="' + col.key + '"><span>' + escapeHtml(filterChipLabel(col, dt.filters[col.key])) + '</span>' +
        '<button type="button" class="chip-edit" data-col="' + col.key + '" title="' + escapeAttr(t('filterIconTitle')) + '">✎</button>' +
        '<button type="button" class="chip-x" data-col="' + col.key + '" aria-label="✕">✕</button></span>';
    }).join('');
    html += '<button type="button" class="add-filter-btn" id="addFilterBtn">' + escapeHtml(t('addFilterBtn')) + '</button>';
    if (activeCols.length) html += '<button type="button" class="clear-filters-btn" id="clearAllFiltersBtn">' + escapeHtml(t('clearAllFiltersBtn')) + '</button>';
    $('dashActiveFilters').innerHTML = html;
    [].forEach.call($('dashActiveFilters').querySelectorAll('.chip-x'), function (btn) {
      btn.addEventListener('click', function () {
        delete dt.filters[btn.getAttribute('data-col')];
        renderDashActiveFilters(); renderDashTableBody();
      });
    });
    [].forEach.call($('dashActiveFilters').querySelectorAll('.chip-edit'), function (btn) {
      btn.addEventListener('click', function () {
        var col = state.columns.filter(function (c) { return c.key === btn.getAttribute('data-col'); })[0];
        openColumnFilterPopover(col, btn);
      });
    });
    $('addFilterBtn').addEventListener('click', function () { openAddFilterPicker($('addFilterBtn')); });
    if ($('clearAllFiltersBtn')) {
      $('clearAllFiltersBtn').addEventListener('click', function () {
        dt.filters = {};
        renderDashActiveFilters(); renderDashTableBody();
      });
    }
  }

  /* ── กลไก popup กลาง ใช้ #filterPopover จุดเดียวสร้างเนื้อหาใหม่ทุกครั้งที่เปิด (ใช้ทั้งตัวกรองคอลัมน์
     และเลือกคอลัมน์ที่จะแสดง) ปิดเองเมื่อคลิกข้างนอก/กด Esc ── */
  var closeActivePopover = null;
  function positionPopover(el, anchorEl) {
    var r = anchorEl.getBoundingClientRect();
    var w = el.offsetWidth || 230;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var top = r.bottom + 6;
    if (top + 260 > window.innerHeight) top = Math.max(8, r.top - 266); // ไม่มีที่ด้านล่างพอ เปิดขึ้นด้านบนแทน
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }
  function openPopover(innerHtml, anchorEl, wireFn) {
    if (closeActivePopover) closeActivePopover();
    var el = $('filterPopover');
    el.innerHTML = innerHtml;
    el.style.display = 'block';
    positionPopover(el, anchorEl);
    var onDocClick = function (e) { if (!el.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) close(); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    function close() {
      el.style.display = 'none'; el.innerHTML = '';
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      closeActivePopover = null;
    }
    setTimeout(function () { document.addEventListener('mousedown', onDocClick); document.addEventListener('keydown', onKey); }, 0);
    closeActivePopover = close;
    if (wireFn) wireFn(el, close);
  }

  /* รายการค่าไม่ซ้ำของคอลัมน์หนึ่ง คำนวณจากแถวที่ผ่านตัวกรอง "คอลัมน์อื่นๆ" แล้ว (ไม่รวมตัวกรองของคอลัมน์
     นี้เอง) — แบบเดียวกับ Excel AutoFilter ที่รายการ checkbox แคบลงตามตัวกรองที่ตั้งไว้แล้วในคอลัมน์อื่น */
  var COL_VALUE_LIST_CAP = 500;
  function distinctValuesExcluding(colKey) {
    var savedFilter = state.dashTable.filters[colKey];
    delete state.dashTable.filters[colKey];
    var seen = {}, out = [];
    lastDashRows.forEach(function (row) {
      if (!matchesDashFilters(row)) return;
      var k = dashValueKey(row[colKey]);
      if (!seen[k]) { seen[k] = true; out.push(k); }
    });
    if (savedFilter) state.dashTable.filters[colKey] = savedFilter;
    out.sort(function (a, b) { return a.localeCompare(b, locale()); });
    return out;
  }

  function openColumnFilterPopover(col, anchorEl) {
    var dt = state.dashTable;
    var f = dt.filters[col.key];
    if (col.type === 'number' || col.type === 'date') {
      var minV = f && f.min != null ? f.min : '', maxV = f && f.max != null ? f.max : '';
      var inType = col.type === 'date' ? 'date' : 'number';
      var html = '<div class="fp-title">' + escapeHtml(col.label) + '</div>' +
        '<div class="fp-range">' +
        '<label>' + escapeHtml(t('filterMin')) + '<input type="' + inType + '" class="fp-min" value="' + escapeAttr(minV) + '"></label>' +
        '<label>' + escapeHtml(t('filterMax')) + '<input type="' + inType + '" class="fp-max" value="' + escapeAttr(maxV) + '"></label>' +
        '</div>' +
        '<div class="fp-actions"><button type="button" class="fp-link fp-clear">' + escapeHtml(t('filterClearThisBtn')) + '</button>' +
        '<div class="fp-btns"><button type="button" class="btn sm fp-apply">' + escapeHtml(t('filterApplyBtn')) + '</button></div></div>';
      openPopover(html, anchorEl, function (el, close) {
        var applyRange = function () {
          var minEl = el.querySelector('.fp-min'), maxEl = el.querySelector('.fp-max');
          var nf = {};
          if (minEl.value !== '') nf.min = minEl.value;
          if (maxEl.value !== '') nf.max = maxEl.value;
          if (nf.min !== undefined || nf.max !== undefined) dt.filters[col.key] = nf; else delete dt.filters[col.key];
          renderDashActiveFilters(); renderDashTableBody();
        };
        el.querySelector('.fp-apply').addEventListener('click', function () { applyRange(); close(); });
        el.querySelector('.fp-clear').addEventListener('click', function () { delete dt.filters[col.key]; renderDashActiveFilters(); renderDashTableBody(); close(); });
      });
      return;
    }
    /* category/text: รายการ checkbox แบบ Excel + ช่องค้นหาแคบรายการ (คอลัมน์ข้อความอิสระอาจมีค่าไม่ซ้ำเยอะ) */
    var allValues = distinctValuesExcluding(col.key);
    var selected = f && f.values ? f.values : null; // null = ยังไม่กรอง (ถือว่าติ๊กครบทุกค่า)
    var pending = {}; allValues.forEach(function (v) { pending[v] = !selected || selected.indexOf(v) !== -1; });
    var htmlCat = '<div class="fp-title">' + escapeHtml(col.label) + '</div>' +
      '<input type="text" class="fp-search" placeholder="' + escapeAttr(t('filterSearchPh')) + '">' +
      '<div class="fp-quick"><button type="button" class="fp-all">' + escapeHtml(t('filterSelectAllBtn')) + '</button>' +
      '<button type="button" class="fp-none">' + escapeHtml(t('filterSelectNoneBtn')) + '</button></div>' +
      '<div class="fp-list"></div>' +
      '<div class="fp-actions"><button type="button" class="fp-link fp-clear">' + escapeHtml(t('filterClearThisBtn')) + '</button>' +
      '<div class="fp-btns"><button type="button" class="btn sm secondary fp-cancel">' + escapeHtml(t('filterCancelBtn')) + '</button>' +
      '<button type="button" class="btn sm fp-apply">' + escapeHtml(t('filterApplyBtn')) + '</button></div></div>';
    openPopover(htmlCat, anchorEl, function (el, close) {
      var listEl = el.querySelector('.fp-list');
      function renderList(query) {
        var q = (query || '').toLowerCase();
        var vals = q ? allValues.filter(function (v) { return v.toLowerCase().indexOf(q) !== -1; }) : allValues;
        if (!vals.length) { listEl.innerHTML = '<div class="fp-empty">' + escapeHtml(t('filterEmptyList')) + '</div>'; return; }
        listEl.innerHTML = vals.slice(0, COL_VALUE_LIST_CAP).map(function (v) {
          return '<label class="fp-item"><input type="checkbox" class="fp-chk" data-v="' + escapeAttr(v) + '"' + (pending[v] ? ' checked' : '') + '><span>' + escapeHtml(v) + '</span></label>';
        }).join('');
        [].forEach.call(listEl.querySelectorAll('.fp-chk'), function (chk) {
          chk.addEventListener('change', function () { pending[chk.getAttribute('data-v')] = chk.checked; });
        });
      }
      renderList('');
      el.querySelector('.fp-search').addEventListener('input', function (e) { renderList(e.target.value); });
      el.querySelector('.fp-all').addEventListener('click', function () { allValues.forEach(function (v) { pending[v] = true; }); renderList(el.querySelector('.fp-search').value); });
      el.querySelector('.fp-none').addEventListener('click', function () { allValues.forEach(function (v) { pending[v] = false; }); renderList(el.querySelector('.fp-search').value); });
      el.querySelector('.fp-cancel').addEventListener('click', close);
      el.querySelector('.fp-clear').addEventListener('click', function () { delete dt.filters[col.key]; renderDashActiveFilters(); renderDashTableBody(); close(); });
      el.querySelector('.fp-apply').addEventListener('click', function () {
        var chosen = allValues.filter(function (v) { return pending[v]; });
        if (chosen.length === allValues.length) delete dt.filters[col.key]; // เลือกครบทุกค่า = ไม่ต้องกรอง
        else dt.filters[col.key] = { values: chosen };
        renderDashActiveFilters(); renderDashTableBody();
        close();
      });
    });
  }

  function openAddFilterPicker(anchorEl) {
    var unfiltered = state.columns.filter(function (c) { return !state.dashTable.filters[c.key]; });
    var html = '<div class="fp-title">' + escapeHtml(t('addFilterPickTitle')) + '</div>' +
      '<input type="text" class="fp-search" placeholder="' + escapeAttr(t('filterSearchPh')) + '">' +
      '<div class="fp-list"></div>';
    openPopover(html, anchorEl, function (el, close) {
      var listEl = el.querySelector('.fp-list');
      function renderPick(query) {
        var q = (query || '').toLowerCase();
        var cols = q ? unfiltered.filter(function (c) { return c.label.toLowerCase().indexOf(q) !== -1; }) : unfiltered;
        if (!cols.length) { listEl.innerHTML = '<div class="fp-empty">' + escapeHtml(t('filterEmptyList')) + '</div>'; return; }
        listEl.innerHTML = cols.map(function (c) { return '<div class="fp-item" data-col="' + c.key + '"><span>' + escapeHtml(c.label) + '</span></div>'; }).join('');
        [].forEach.call(listEl.querySelectorAll('.fp-item'), function (item) {
          item.addEventListener('click', function () {
            var col = state.columns.filter(function (c) { return c.key === item.getAttribute('data-col'); })[0];
            close();
            openColumnFilterPopover(col, anchorEl);
          });
        });
      }
      renderPick('');
      el.querySelector('.fp-search').addEventListener('input', function (e) { renderPick(e.target.value); });
    });
  }

  /* ══════════════════ เลือกคอลัมน์ที่จะแสดงในตารางของแดชบอร์ด (ซ่อน/แสดง) ══════════════════
     ใช้เมื่อไฟล์มีคอลัมน์เยอะมาก (เช่นออกจากระบบ CMMS/work order) — ใช้ popup เดียวกัน สลับทันทีไม่ต้องกด
     Apply (แค่ซ่อน/แสดงคอลัมน์ ไม่กระทบข้อมูล ทำ/undo ได้ง่ายกว่าตัวกรอง) ไม่กระทบตัวเลือกคอลัมน์ของ Pivot */
  function openColumnVisibilityPopover(anchorEl) {
    var dt = state.dashTable;
    var html = '<div class="fp-title">' + escapeHtml(t('columnsPopoverTitle')) + '</div>' +
      '<input type="text" class="fp-search" placeholder="' + escapeAttr(t('columnsSearchPh')) + '">' +
      '<div class="fp-quick"><button type="button" class="fp-all">' + escapeHtml(t('filterSelectAllBtn')) + '</button>' +
      '<button type="button" class="fp-none">' + escapeHtml(t('filterSelectNoneBtn')) + '</button></div>' +
      '<div class="fp-list"></div>' +
      '<div class="fp-actions"><span></span><div class="fp-btns"><button type="button" class="btn sm fp-close">' + escapeHtml(t('columnsCloseBtn')) + '</button></div></div>';
    openPopover(html, anchorEl, function (el, close) {
      var listEl = el.querySelector('.fp-list');
      function renderCols(query) {
        var q = (query || '').toLowerCase();
        var cols = q ? state.columns.filter(function (c) { return c.label.toLowerCase().indexOf(q) !== -1; }) : state.columns;
        listEl.innerHTML = cols.map(function (c) {
          return '<label class="fp-item"><input type="checkbox" class="fp-chk" data-col="' + c.key + '"' + (dt.hiddenCols[c.key] ? '' : ' checked') + '><span>' + escapeHtml(c.label) + '</span></label>';
        }).join('');
        [].forEach.call(listEl.querySelectorAll('.fp-chk'), function (chk) {
          chk.addEventListener('change', function () {
            if (chk.checked) delete dt.hiddenCols[chk.getAttribute('data-col')]; else dt.hiddenCols[chk.getAttribute('data-col')] = true;
            renderDashTableBody();
          });
        });
      }
      renderCols('');
      el.querySelector('.fp-search').addEventListener('input', function (e) { renderCols(e.target.value); });
      el.querySelector('.fp-all').addEventListener('click', function () { state.columns.forEach(function (c) { delete dt.hiddenCols[c.key]; }); renderCols(el.querySelector('.fp-search').value); renderDashTableBody(); });
      el.querySelector('.fp-none').addEventListener('click', function () { state.columns.forEach(function (c) { dt.hiddenCols[c.key] = true; }); renderCols(el.querySelector('.fp-search').value); renderDashTableBody(); });
      el.querySelector('.fp-close').addEventListener('click', close);
    });
  }

  function renderDashboardTable(rows) {
    if (!rows.length || !state.columns.length) { $('dashTableCard').style.display = 'none'; return false; }
    lastDashRows = rows;
    renderDashTableControls();
    renderDashTableBody();
    $('dashTableCard').style.display = 'block';
    return true;
  }

  /* อัปเดตปุ่มลบที่เลือก + การ์ดสถิติ "เลือกไว้" จาก state.selected ตรงๆ — เรียกทั้งจาก renderTable()
     (หลัง render ใหม่ทั้งตาราง) และจาก event ของ checkbox เดี่ยวๆ (ไม่ต้อง render ใหม่ทั้งตาราง) */
  function updateSelectionUI() {
    var selCount = Object.keys(state.selected).filter(function (k) { return state.selected[k]; }).length;
    $('delSelBtn').disabled = selCount === 0;
    $('statSelected').innerHTML = selCount.toLocaleString(locale()) + ' <span class="unit">' + t('unitRows') + '</span>';
  }

  function renderPager(total, totalPages) {
    if (total <= PAGE_SIZE) { $('pager').innerHTML = ''; return; }
    var html = '<button type="button" class="btn sm" id="pgPrev"' + (state.page <= 1 ? ' disabled' : '') + '>' + t('pagerPrev') + '</button>' +
      '<span>' + t('pagerInfo', { page: state.page, total: totalPages, n: total.toLocaleString(locale()) }) + '</span>' +
      '<button type="button" class="btn sm" id="pgNext"' + (state.page >= totalPages ? ' disabled' : '') + '>' + t('pagerNext') + '</button>';
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
  var charts = { bar: null, line: null, pie: null, domain1: null, domain2: null };
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
      var k = r[catKey]; k = (k === null || k === undefined || k === '') ? t('emptyValueLabel') : String(k);
      if (!(k in map)) { map[k] = 0; order.push(k); }
      map[k] += numKey ? (typeof r[numKey] === 'number' ? r[numKey] : 0) : 1;
    });
    var entries = order.map(function (k) { return [k, map[k]]; });
    entries.sort(function (a, b) { return b[1] - a[1]; });
    if (entries.length > MAX_CHART_CATS) {
      var top = entries.slice(0, MAX_CHART_CATS);
      var rest = entries.slice(MAX_CHART_CATS).reduce(function (s, e) { return s + e[1]; }, 0);
      top.push([t('otherBucket'), rest]);
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

  /* เรียงคอลัมน์จากค่าไม่ซ้ำน้อยไปมาก — คอลัมน์ที่ค่าซ้ำกันบ่อย (เช่น "หมวดหมู่") เหมาะเป็นค่าเริ่มต้นของ
     แกนกราฟ/แถว pivot มากกว่าคอลัมน์ที่ค่าไม่ซ้ำเกือบทุกแถว (เช่น "ชื่อสินค้า" ที่บังเอิญถูกเดาเป็น category
     เพราะมีข้อมูลน้อยแถว) — ใช้ร่วมกันทั้งกราฟและตัวเลือก "แถว" ของ Pivot */
  function sortByUniqCountAsc(cols, rows) {
    return cols.map(function (c) {
      var uniq = {}; rows.forEach(function (r) { var v = r[c.key]; if (v !== null && v !== undefined && v !== '') uniq[String(v)] = true; });
      return { col: c, uniqCount: Object.keys(uniq).length };
    }).sort(function (a, b) { return a.uniqCount - b.uniqCount; }).map(function (e) { return e.col; });
  }

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
      $('drillText').textContent = t('drillText', { label: state.drill.label, value: state.drill.value });
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

  /* ══════════════════ แดชบอร์ดเฉพาะทาง (ซ่อมบำรุง/โครงการ/กฎหมาย) ══════════════════
     เดาประเภทตารางจาก "ชื่อคอลัมน์" (ไทย+อังกฤษ) แล้วแนะนำ KPI/กราฟที่ตรงกับงานจริงแทนการเดาทั่วไป —
     อ้างอิงจากงานวิจัยจริงตอนออกแบบ (Maintenance KPI: IBM/Upkeep, Project KPI: ClearPoint) ไม่ใช่เดาส่งๆ
     หลักการจับคู่: ให้แต่ละ "บทบาท" (role) มีคำค้นหลายคำ (ไทย/อังกฤษ) ค้นหาแบบ substring กับชื่อคอลัมน์ที่
     ตัดช่องว่าง/underscore ออกแล้ว (กัน "Plan Start" vs "PlanStart" ไม่ตรงกัน) แต่ละ role มี "น้ำหนัก" —
     role ที่เป็นเอกลักษณ์ของโดเมนนั้นจริงๆ (เช่น "workorder" ของซ่อมบำรุง, "มาตรา" ของกฎหมาย) ได้น้ำหนักสูง
     กว่า role ทั่วไปที่หลายโดเมนมีร่วมกัน (เช่น "status") กันตารางอื่นถูกเดาผิดโดเมน — โดเมนที่คะแนนรวมสูง
     สุดและถึงเกณฑ์ขั้นต่ำ (5) ถึงจะถือว่า "ตรวจพบ" ผู้ใช้เลือกแม่แบบเองทับได้เสมอผ่าน dropdown */
  var DOMAIN_MIN_SCORE = 5;
  var DOMAIN_ROLES = {
    maintenance: {
      workorder: { w: 3, kw: ['workorder', 'ใบสั่งงาน', 'เลขที่งาน'] },
      equipmentno: { w: 2, kw: ['equipmentno', 'รหัสเครื่องจักร', 'รหัสอุปกรณ์'] },
      equipmenttype: { w: 2, kw: ['equipmenttype', 'ประเภทเครื่องจักร', 'ประเภทอุปกรณ์'] },
      downtime: { w: 3, kw: ['downtime', 'เวลาหยุด', 'หยุดทำงาน'] },
      planstart: { w: 1, kw: ['planstart', 'planworkstart', 'กำหนดเริ่ม'] },
      planfinish: { w: 1, kw: ['planfinish', 'planworkfinish', 'กำหนดเสร็จ'] },
      actstart: { w: 1, kw: ['actworkstart', 'actualstart', 'เริ่มปฏิบัติงาน', 'เริ่มจริง'] },
      actend: { w: 1, kw: ['actworkend', 'actualend', 'เสร็จปฏิบัติงาน', 'เสร็จจริง'] },
      matcost: { w: 1, kw: ['matcost', 'materialcost', 'ค่าวัสดุ', 'ค่าอะไหล่'] },
      laborcost: { w: 1, kw: ['laborcost', 'labourcost', 'ค่าแรง'] },
      othercost: { w: 1, kw: ['othercost', 'ค่าใช้จ่ายอื่น'] },
      status: { w: 1, kw: ['status', 'สถานะ'] },
      priority: { w: 1, kw: ['priority', 'ความสำคัญ', 'ลำดับความสำคัญ'] }
    },
    project: {
      projectname: { w: 2, kw: ['projectname', 'ชื่อโครงการ', 'โครงการ'] },
      budget: { w: 3, kw: ['budget', 'งบประมาณ', 'plannedcost', 'planbudget'] },
      actualcost: { w: 2, kw: ['actualcost', 'ใช้จริง', 'ค่าใช้จ่ายจริง'] },
      percentcomplete: { w: 3, kw: ['percentcomplete', 'percentcompleted', 'ความคืบหน้า', 'เปอร์เซ็นต์ความคืบหน้า'] },
      startdate: { w: 1, kw: ['startdate', 'วันที่เริ่ม'] },
      enddate: { w: 1, kw: ['enddate', 'วันที่สิ้นสุด', 'กำหนดเสร็จ'] },
      milestone: { w: 1, kw: ['milestone', 'เป้าหมาย'] },
      phase: { w: 1, kw: ['phase', 'เฟส'] },
      status: { w: 1, kw: ['status', 'สถานะ'] },
      owner: { w: 1, kw: ['owner', 'ผู้รับผิดชอบ', 'ผู้จัดการโครงการ'] }
    },
    legal: {
      section: { w: 3, kw: ['มาตรา', 'section', 'article'] },
      lawcategory: { w: 2, kw: ['หมวด', 'ลักษณะ', 'category'] },
      lawname: { w: 2, kw: ['พระราชบัญญัติ', 'ประมวลกฎหมาย', 'พรบ', 'กฎหมาย', 'act', 'statute'] },
      readstatus: { w: 1, kw: ['อ่านแล้ว', 'สถานะการอ่าน', 'status'] },
      penalty: { w: 1, kw: ['โทษ', 'บทลงโทษ', 'penalty'] }
    },
    risk: {
      likelihood: { w: 3, kw: ['likelihood', 'probability', 'โอกาสเกิด', 'ความน่าจะเป็น', 'โอกาส'] },
      impact: { w: 3, kw: ['impact', 'severity', 'ผลกระทบ', 'ความรุนแรง'] },
      risklevel: { w: 2, kw: ['risklevel', 'riskscore', 'riskrating', 'ระดับความเสี่ยง', 'คะแนนความเสี่ยง'] },
      riskcategory: { w: 2, kw: ['riskcategory', 'ประเภทความเสี่ยง', 'หมวดความเสี่ยง', 'ลักษณะความเสี่ยง'] },
      riskname: { w: 1, kw: ['ความเสี่ยง', 'risk'] },
      status: { w: 1, kw: ['status', 'สถานะ'] },
      owner: { w: 1, kw: ['riskowner', 'ผู้รับผิดชอบ', 'owner'] },
      mitigation: { w: 1, kw: ['mitigation', 'มาตรการ', 'แผนจัดการ', 'แผนรองรับ', 'แผนลดความเสี่ยง'] }
    }
  };
  function normLabel(s) { return String(s == null ? '' : s).toLowerCase().replace(/[\s_\-]+/g, ''); }
  function matchDomainRoles(columns, roleDefs) {
    var used = {}, roles = {}, score = 0;
    Object.keys(roleDefs).forEach(function (roleKey) {
      var def = roleDefs[roleKey];
      var found = columns.filter(function (c) { return !used[c.key]; }).filter(function (c) {
        var nl = normLabel(c.label);
        return def.kw.some(function (kw) { return nl.indexOf(normLabel(kw)) !== -1; });
      })[0];
      if (found) { roles[roleKey] = found; used[found.key] = true; score += def.w; }
    });
    return { roles: roles, score: score };
  }
  function detectDomain() {
    var best = null;
    ['maintenance', 'project', 'legal', 'risk'].forEach(function (id) {
      var m = matchDomainRoles(state.columns, DOMAIN_ROLES[id]);
      if (m.score >= DOMAIN_MIN_SCORE && (!best || m.score > best.score)) best = { id: id, roles: m.roles, score: m.score };
    });
    return best;
  }
  function renderStatTiles(containerId, tiles) {
    var html = tiles.map(function (t) {
      return '<div class="stat-tile"><div class="lbl">' + escapeHtml(t.label) + '</div><div class="val">' + t.value +
        (t.unit ? ' <span class="unit">' + escapeHtml(t.unit) + '</span>' : '') + '</div>' +
        (t.sub ? '<div class="sub">' + escapeHtml(t.sub) + '</div>' : '') + '</div>';
    }).join('');
    $(containerId).innerHTML = html;
  }
  function hoursBetween(a, b) { return (b.getTime() - a.getTime()) / 3600000; }

  function buildMaintenanceDomain(rows, roles) {
    var tiles = [];
    tiles.push({ label: t('mKpiTotalWO'), value: rows.length.toLocaleString(locale()) });
    if (roles.downtime) {
      var dtSum = rows.reduce(function (s, r) { var v = r[roles.downtime.key]; return s + (typeof v === 'number' ? v : 0); }, 0);
      tiles.push({ label: t('mKpiDowntime'), value: dtSum.toLocaleString(locale(), { maximumFractionDigits: 1 }) });
    }
    var costCols = [roles.matcost, roles.laborcost, roles.othercost].filter(Boolean);
    if (costCols.length) {
      var costSum = rows.reduce(function (s, r) { return s + costCols.reduce(function (s2, c) { var v = r[c.key]; return s2 + (typeof v === 'number' ? v : 0); }, 0); }, 0);
      tiles.push({ label: t('mKpiCost'), value: costSum.toLocaleString(locale(), { maximumFractionDigits: 0 }) });
    }
    if (roles.actstart && roles.actend) {
      var durs = rows.map(function (r) {
        var a = r[roles.actstart.key], b = r[roles.actend.key];
        return (a instanceof Date && !isNaN(a) && b instanceof Date && !isNaN(b) && b >= a) ? hoursBetween(a, b) : null;
      }).filter(function (v) { return v !== null; });
      if (durs.length) tiles.push({ label: t('mKpiMttr'), value: (durs.reduce(function (s, v) { return s + v; }, 0) / durs.length).toLocaleString(locale(), { maximumFractionDigits: 1 }) });
    }
    if (roles.actend && roles.planfinish) {
      var both = rows.filter(function (r) { var a = r[roles.actend.key], b = r[roles.planfinish.key]; return a instanceof Date && !isNaN(a) && b instanceof Date && !isNaN(b); });
      if (both.length) {
        var onTime = both.filter(function (r) { return r[roles.actend.key] <= r[roles.planfinish.key]; }).length;
        tiles.push({ label: t('mKpiOnTimePct'), value: (onTime / both.length * 100).toLocaleString(locale(), { maximumFractionDigits: 0 }), unit: '%' });
      }
    }
    var chart1 = null, chart2 = null;
    if (roles.status) {
      var e1 = aggregateByCategory(rows, roles.status.key, null);
      chart1 = { title: t('mChartStatus'), labels: e1.map(function (e) { return e[0]; }), data: e1.map(function (e) { return e[1]; }) };
    }
    if (roles.equipmenttype && costCols.length) {
      var e2 = aggregateByCategory(rows, roles.equipmenttype.key, costCols[0].key);
      chart2 = { title: t('mChartCostByType'), labels: e2.map(function (e) { return e[0]; }), data: e2.map(function (e) { return e[1]; }) };
    } else if (roles.priority) {
      var e2b = aggregateByCategory(rows, roles.priority.key, null);
      chart2 = { title: t('mChartCountByPriority'), labels: e2b.map(function (e) { return e[0]; }), data: e2b.map(function (e) { return e[1]; }) };
    }
    return { title: t('domainTitleMaintenance'), tiles: tiles, chart1: chart1, chart2: chart2 };
  }

  function avgByCategory(rows, catKey, numKey) {
    var sums = {}, counts = {}, order = [];
    rows.forEach(function (r) {
      var k = r[catKey]; k = (k === null || k === undefined || k === '') ? t('emptyValueLabel') : String(k);
      var v = r[numKey];
      if (typeof v !== 'number') return;
      if (!(k in sums)) { sums[k] = 0; counts[k] = 0; order.push(k); }
      sums[k] += v; counts[k] += 1;
    });
    var entries = order.map(function (k) { return [k, sums[k] / counts[k]]; });
    if (entries.length > MAX_CHART_CATS) entries = entries.slice(0, MAX_CHART_CATS);
    return entries;
  }

  function buildProjectDomain(rows, roles) {
    var tiles = [];
    if (roles.budget) {
      var budgetSum = rows.reduce(function (s, r) { var v = r[roles.budget.key]; return s + (typeof v === 'number' ? v : 0); }, 0);
      tiles.push({ label: t('pKpiBudget'), value: budgetSum.toLocaleString(locale(), { maximumFractionDigits: 0 }) });
    }
    var actualSum = null;
    if (roles.actualcost) {
      actualSum = rows.reduce(function (s, r) { var v = r[roles.actualcost.key]; return s + (typeof v === 'number' ? v : 0); }, 0);
      tiles.push({ label: t('pKpiActual'), value: actualSum.toLocaleString(locale(), { maximumFractionDigits: 0 }) });
    }
    if (roles.budget && roles.actualcost) {
      var budgetSum2 = rows.reduce(function (s, r) { var v = r[roles.budget.key]; return s + (typeof v === 'number' ? v : 0); }, 0);
      tiles.push({ label: t('pKpiRemaining'), value: (budgetSum2 - actualSum).toLocaleString(locale(), { maximumFractionDigits: 0 }) });
    }
    if (roles.percentcomplete) {
      var vals = rows.map(function (r) { return r[roles.percentcomplete.key]; }).filter(function (v) { return typeof v === 'number'; });
      if (vals.length) tiles.push({ label: t('pKpiAvgProgress'), value: (vals.reduce(function (s, v) { return s + v; }, 0) / vals.length).toLocaleString(locale(), { maximumFractionDigits: 1 }), unit: '%' });
    }
    if (roles.enddate && roles.percentcomplete) {
      var now = new Date();
      var overdue = rows.filter(function (r) {
        var d = r[roles.enddate.key], p = r[roles.percentcomplete.key];
        return d instanceof Date && !isNaN(d) && d < now && typeof p === 'number' && p < 100;
      }).length;
      tiles.push({ label: t('pKpiOverdue'), value: overdue.toLocaleString(locale()) });
    }
    var chart1 = null, chart2 = null;
    if (roles.projectname && roles.percentcomplete) {
      var e1 = avgByCategory(rows, roles.projectname.key, roles.percentcomplete.key);
      chart1 = { title: t('pChartProgress'), labels: e1.map(function (e) { return e[0]; }), data: e1.map(function (e) { return Math.round(e[1] * 10) / 10; }) };
    }
    if (roles.projectname && roles.actualcost) {
      var e2 = aggregateByCategory(rows, roles.projectname.key, roles.actualcost.key);
      chart2 = { title: t('pChartActualCost'), labels: e2.map(function (e) { return e[0]; }), data: e2.map(function (e) { return e[1]; }) };
    }
    return { title: t('domainTitleProject'), tiles: tiles, chart1: chart1, chart2: chart2 };
  }

  function buildLegalDomain(rows, roles) {
    var tiles = [];
    var sectionCol = roles.section;
    if (sectionCol) {
      var uniq = {}; rows.forEach(function (r) { var v = r[sectionCol.key]; if (v !== null && v !== undefined && v !== '') uniq[String(v)] = true; });
      tiles.push({ label: t('lKpiSections'), value: Object.keys(uniq).length.toLocaleString(locale()) });
    } else {
      tiles.push({ label: t('lKpiSections'), value: rows.length.toLocaleString(locale()) });
    }
    if (roles.lawcategory) {
      var uniqCat = {}; rows.forEach(function (r) { var v = r[roles.lawcategory.key]; if (v !== null && v !== undefined && v !== '') uniqCat[String(v)] = true; });
      tiles.push({ label: t('lKpiCategories'), value: Object.keys(uniqCat).length.toLocaleString(locale()) });
    }
    var chart1 = null, chart2 = null;
    if (roles.lawcategory) {
      var e1 = aggregateByCategory(rows, roles.lawcategory.key, null);
      chart1 = { title: t('lChartByCategory'), labels: e1.map(function (e) { return e[0]; }), data: e1.map(function (e) { return e[1]; }) };
    }
    if (roles.readstatus) {
      var e2 = aggregateByCategory(rows, roles.readstatus.key, null);
      chart2 = { title: t('lChartByReadStatus'), labels: e2.map(function (e) { return e[0]; }), data: e2.map(function (e) { return e[1]; }) };
    } else if (roles.lawname) {
      var e2b = aggregateByCategory(rows, roles.lawname.key, null);
      chart2 = { title: t('lChartByLawName'), labels: e2b.map(function (e) { return e[0]; }), data: e2b.map(function (e) { return e[1]; }) };
    }
    return { title: t('domainTitleLegal'), tiles: tiles, chart1: chart1, chart2: chart2 };
  }

  /* ── ความเสี่ยง: มาตรฐาน risk register ทั่วไป (อ้างอิงจาก Smartsheet/RiskPublishing ตอนออกแบบ) —
     Likelihood × Impact heat map เป็นภาพหลักที่คนวงการนี้คุ้นเคยที่สุด นอกเหนือจาก KPI/กราฟทั่วไป
     ค่าคอลัมน์ likelihood/impact รับได้ทั้งตัวเลข (1-5 เป็นต้น) และข้อความระดับ (ต่ำ/กลาง/สูง, Low/Medium/
     High) ผ่านตารางเทียบค่ามาตรฐาน — ต่างจากคอลัมน์ "สถานะ" ทั่วไปที่หลากหลายเกินจะเดา เพราะคำศัพท์
     ระดับความเสี่ยงเป็นมาตรฐานสากล (ISO 31000) ที่ใช้คำซ้ำกันในแทบทุกองค์กรจริงๆ */
  var RISK_LEVEL_RANK = {
    verylow: 1, rare: 1, unlikely: 1, insignificant: 1, minor: 1, low: 1,
    'ต่ำมาก': 1, 'น้อยมาก': 1, 'ต่ำ': 1, 'น้อย': 1,
    possible: 2, moderate: 2, medium: 2,
    'ปานกลาง': 2, 'กลาง': 2, 'ค่อนข้างต่ำ': 2,
    likely: 3, high: 3, major: 3,
    'สูง': 3, 'มาก': 3, 'ค่อนข้างสูง': 3,
    almostcertain: 4, veryhigh: 4, critical: 4, severe: 4,
    'สูงมาก': 4, 'วิกฤต': 4, 'รุนแรงมาก': 4
  };
  function riskRankOf(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    var n = normLabel(v);
    return RISK_LEVEL_RANK[n] !== undefined ? RISK_LEVEL_RANK[n] : null;
  }
  function riskScoreOf(row, likCol, impCol) {
    var lr = likCol.type === 'number' ? (typeof row[likCol.key] === 'number' ? row[likCol.key] : null) : riskRankOf(row[likCol.key]);
    var ir = impCol.type === 'number' ? (typeof row[impCol.key] === 'number' ? row[impCol.key] : null) : riskRankOf(row[impCol.key]);
    return (lr == null || ir == null) ? null : lr * ir;
  }
  /* ลำดับค่าบนแกน: เรียงตามระดับที่รู้จัก (RISK_LEVEL_RANK) ก่อน ค่าที่เดาระดับไม่ได้ต่อท้ายตามลำดับที่เจอ */
  function riskAxisLevels(rows, col) {
    var seen = {}, order = [];
    rows.forEach(function (r) {
      var raw = r[col.key];
      if (raw === null || raw === undefined || raw === '') return;
      var key = String(raw);
      if (!(key in seen)) { seen[key] = { raw: raw, rank: riskRankOf(raw) }; order.push(key); }
    });
    order.sort(function (a, b) {
      var ra = seen[a].rank, rb = seen[b].rank;
      if (ra != null && rb != null) return ra - rb;
      if (ra != null) return -1;
      if (rb != null) return 1;
      return 0;
    });
    return order.map(function (k) { return seen[k].raw; });
  }
  var RISK_MATRIX_MAX_LEVELS = 6; // เกินนี้ไม่ใช่มาตราส่วนแบบ risk matrix จริงแล้ว (คงเป็นค่าตัวเลขอิสระ) ข้ามการวาดตาราง
  function buildRiskMatrixHtml(rows, likCol, impCol) {
    var likLevels = riskAxisLevels(rows, likCol);
    var impLevels = riskAxisLevels(rows, impCol);
    if (!likLevels.length || !impLevels.length || likLevels.length > RISK_MATRIX_MAX_LEVELS || impLevels.length > RISK_MATRIX_MAX_LEVELS) return null;
    var nLik = likLevels.length, nImp = impLevels.length;
    var counts = {};
    rows.forEach(function (r) {
      var lv = r[likCol.key], iv = r[impCol.key];
      if (lv === null || lv === undefined || lv === '' || iv === null || iv === undefined || iv === '') return;
      var k = String(lv) + '|' + String(iv);
      counts[k] = (counts[k] || 0) + 1;
    });
    var impDesc = impLevels.slice().reverse(); // แสดงผลกระทบสูงสุดไว้บนสุด (ตามธรรมเนียม risk matrix)
    var html = '<table class="risk-matrix"><thead><tr><th></th>' +
      likLevels.map(function (l) { return '<th>' + escapeHtml(String(l)) + '</th>'; }).join('') + '</tr></thead><tbody>';
    impDesc.forEach(function (impVal, impDescIdx) {
      var impRankIdx = nImp - 1 - impDescIdx; // ตำแหน่งจริงใน impLevels (0=ต่ำสุด)
      html += '<tr><th>' + escapeHtml(String(impVal)) + '</th>';
      likLevels.forEach(function (likVal, likIdx) {
        var cnt = counts[String(likVal) + '|' + String(impVal)] || 0;
        var frac = ((likIdx + 1) * (impRankIdx + 1)) / (nLik * nImp);
        var bg = frac >= 0.66 ? 'rgba(229,72,77,.55)' : frac >= 0.33 ? 'rgba(245,158,11,.5)' : 'rgba(30,158,90,.35)';
        html += '<td style="background:' + bg + '">' + (cnt || '') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  function buildRiskDomain(rows, roles) {
    var tiles = [];
    tiles.push({ label: t('rKpiTotal'), value: rows.length.toLocaleString(locale()) });
    if (roles.riskcategory) {
      var uniqCat = {}; rows.forEach(function (r) { var v = r[roles.riskcategory.key]; if (v !== null && v !== undefined && v !== '') uniqCat[String(v)] = true; });
      tiles.push({ label: t('rKpiCategories'), value: Object.keys(uniqCat).length.toLocaleString(locale()) });
    }
    var matrixHtml = null;
    if (roles.likelihood && roles.impact) {
      var scores = rows.map(function (r) { return riskScoreOf(r, roles.likelihood, roles.impact); }).filter(function (v) { return v !== null; });
      if (scores.length) {
        var avgScore = scores.reduce(function (s, v) { return s + v; }, 0) / scores.length;
        tiles.push({ label: t('rKpiAvgScore'), value: avgScore.toLocaleString(locale(), { maximumFractionDigits: 2 }) });
        var maxScore = Math.max.apply(null, scores);
        var highCount = scores.filter(function (v) { return v >= maxScore * 0.66; }).length;
        tiles.push({ label: t('rKpiHighCount'), value: highCount.toLocaleString(locale()) });
      }
      matrixHtml = buildRiskMatrixHtml(rows, roles.likelihood, roles.impact);
    }
    var chart1 = null, chart2 = null;
    if (roles.riskcategory) {
      var e1 = aggregateByCategory(rows, roles.riskcategory.key, null);
      chart1 = { title: t('rChartByCategory'), labels: e1.map(function (e) { return e[0]; }), data: e1.map(function (e) { return e[1]; }) };
    }
    if (roles.status) {
      var e2 = aggregateByCategory(rows, roles.status.key, null);
      chart2 = { title: t('rChartByStatus'), labels: e2.map(function (e) { return e[0]; }), data: e2.map(function (e) { return e[1]; }) };
    } else if (roles.owner) {
      var e2b = aggregateByCategory(rows, roles.owner.key, null);
      chart2 = { title: t('rChartByOwner'), labels: e2b.map(function (e) { return e[0]; }), data: e2b.map(function (e) { return e[1]; }) };
    }
    return { title: t('domainTitleRisk'), tiles: tiles, chart1: chart1, chart2: chart2, matrix: matrixHtml ? { title: t('rMatrixTitle'), html: matrixHtml, axisNote: t('rMatrixAxisNote') } : null };
  }

  var DOMAIN_BUILDERS = { maintenance: buildMaintenanceDomain, project: buildProjectDomain, legal: buildLegalDomain, risk: buildRiskDomain };
  function renderDomainDashboard(rows) {
    var override = state.domainOverride;
    var picked = override ? (override === 'none' ? null : { id: override, roles: matchDomainRoles(state.columns, DOMAIN_ROLES[override]).roles }) : detectDomain();
    destroyChart('domain1'); destroyChart('domain2');
    if (!rows.length) { $('domainDashboardCard').style.display = 'none'; return false; }
    /* การ์ดนี้เปิดค้างไว้เสมอเมื่อมีข้อมูล (ไม่ซ่อนทั้งการ์ดตอนไม่พบแม่แบบ/ผู้ใช้ปิดไว้) เพราะตัวเลือก
       "แม่แบบ" อยู่ในการ์ดนี้เอง — ถ้าซ่อนทั้งการ์ดผู้ใช้จะไม่มีทางกดเปิดกลับมาได้อีก */
    $('domainDashboardCard').style.display = 'block';
    $('domainOverrideSel').value = override || '';
    if (!picked) {
      $('domainDashboardTitle').textContent = t('domainTitleNone');
      $('domainDetectedHint').style.display = 'block';
      $('domainDetectedHint').textContent = t('domainNoMatchHint');
      $('domainKpiRow').innerHTML = '';
      $('domainChart1Card').style.display = 'none';
      $('domainChart2Card').style.display = 'none';
      $('domainMatrixCard').style.display = 'none';
      return false;
    }
    var built = DOMAIN_BUILDERS[picked.id](rows, picked.roles);
    $('domainDashboardTitle').textContent = built.title;
    $('domainDetectedHint').style.display = override ? 'none' : 'block';
    if (!override) $('domainDetectedHint').textContent = t('domainDetectedHint', { name: t('domainName' + picked.id.charAt(0).toUpperCase() + picked.id.slice(1)) });
    renderStatTiles('domainKpiRow', built.tiles);
    [['domainChart1', built.chart1], ['domainChart2', built.chart2]].forEach(function (pair) {
      var canvasId = pair[0], chart = pair[1];
      var cardId = canvasId + 'Card', titleId = canvasId + 'Title';
      if (chart && typeof Chart !== 'undefined' && chart.labels.length) {
        $(cardId).style.display = 'block';
        $(titleId).textContent = chart.title;
        var cfg = buildChartConfig('bar', chart.labels, chart.data, '#1E9E5A');
        charts[canvasId === 'domainChart1' ? 'domain1' : 'domain2'] = new Chart($(canvasId).getContext('2d'), cfg);
      } else {
        $(cardId).style.display = 'none';
      }
    });
    if (built.matrix) {
      $('domainMatrixCard').style.display = 'block';
      $('domainMatrixTitle').textContent = built.matrix.title;
      $('domainMatrixWrap').innerHTML = built.matrix.html;
      $('domainMatrixAxisNote').textContent = built.matrix.axisNote;
    } else {
      $('domainMatrixCard').style.display = 'none';
    }
    return true;
  }

  function renderDashboard() {
    var rows = state.drill ? state.rows.filter(matchesDrill) : state.rows;
    renderDomainDashboard(rows);
    var numCols = state.columns.filter(function (c) { return c.type === 'number'; });
    var dateCols = state.columns.filter(function (c) { return c.type === 'date'; });
    /* เรียงคอลัมน์หมวดหมู่จากค่าไม่ซ้ำน้อยไปมาก — คอลัมน์ที่ค่าซ้ำกันบ่อย (เช่น "ประเภท") เหมาะเป็นแกน
       กราฟแท่ง/วงกลมมากกว่าคอลัมน์ที่ค่าไม่ซ้ำเกือบทุกแถว (เช่น "ชื่อสินค้า" ที่บังเอิญถูกเดาเป็น category
       เพราะมีข้อมูลน้อยแถว) กันกราฟแท่งมี 1 แท่งต่อ 1 แถวซึ่งไม่มีประโยชน์อะไร — เป็นแค่ค่าเริ่มต้นแนะนำ
       ผู้ใช้เปลี่ยนได้เองเสมอผ่าน dropdown ของแต่ละการ์ด */
    var catCols = sortByUniqCountAsc(state.columns.filter(function (c) { return c.type === 'category'; }), rows);
    var anyRendered = false;

    /* ── สรุปตัวเลข (การ์ดสถิติ sum/avg/min/max ต่อคอลัมน์ตัวเลข สูงสุด 4 คอลัมน์) ── */
    if (numCols.length && rows.length) {
      var html = '';
      numCols.slice(0, 4).forEach(function (col) {
        var s = statOf(rows, col.key);
        if (!s) return;
        html += '<div class="stat-tile"><div class="lbl">' + escapeHtml(col.label) + '</div>' +
          '<div class="val">' + s.sum.toLocaleString(locale(), { maximumFractionDigits: 2 }) + '</div>' +
          '<div class="sub">' + t('statTileSub', {
            avg: s.avg.toLocaleString(locale(), { maximumFractionDigits: 2 }),
            min: s.min.toLocaleString(locale(), { maximumFractionDigits: 2 }),
            max: s.max.toLocaleString(locale(), { maximumFractionDigits: 2 })
          }) + '</div></div>';
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
      fillSelect($('barNumSel'), numCols, barNum ? barNum.key : '', t('countOption'));
      $('barTypeSel').value = barType;
      var barEntries = aggregateByCategory(rows, barCat.key, barNum ? barNum.key : null);
      $('barChartTitle').textContent = CHART_TYPE_ICON[barType] + ' ' + (barNum ? t('barChartTitleWithNum', { cat: barCat.label, num: barNum.label }) : t('barChartTitleCount', { cat: barCat.label }));
      var barCfg = buildChartConfig(barType, barEntries.map(function (e) { return e[0]; }), barEntries.map(function (e) { return e[1]; }), '#1E9E5A');
      barCfg.options.onClick = function (evt, els) {
        if (!els || !els.length) return;
        var label = barEntries[els[0].index][0];
        if (label === t('otherBucket')) return; // รวมหลายค่า กรองเป็นค่าเดียวไม่ได้จริง
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
      fillSelect($('lineNumSel'), numCols, lineNum ? lineNum.key : '', t('countOption'));
      $('lineTypeSel').value = lineType;
      var lineEntries = aggregateByDate(rows, lineDate.key, lineNum ? lineNum.key : null);
      if (lineEntries.length >= 2) {
        $('lineChartTitle').textContent = CHART_TYPE_ICON[lineType] + ' ' + (lineNum ? t('lineChartTitleWithNum', { num: lineNum.label, date: lineDate.label }) : t('lineChartTitleCount', { date: lineDate.label }));
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
      $('pieChartTitle').textContent = CHART_TYPE_ICON[pieType] + ' ' + t('pieChartTitleTpl', { cat: pieCat.label });
      var pieCfg = buildChartConfig(pieType, pieEntries.map(function (e) { return e[0]; }), pieEntries.map(function (e) { return e[1]; }), '#1E9E5A');
      pieCfg.options.onClick = function (evt, els) {
        if (!els || !els.length) return;
        var label = pieEntries[els[0].index][0];
        if (label === t('otherBucket')) return;
        setDrill(pieCat.key, pieCat.label, label);
      };
      charts.pie = new Chart($('pieChart').getContext('2d'), pieCfg);
      $('pieChartCard').style.display = 'block'; anyRendered = true;
    } else $('pieChartCard').style.display = 'none';

    /* ── ตารางข้อมูล (อ่านอย่างเดียว) แสดงในแดชบอร์ดเลย ไม่ต้องสลับแท็บไปมา — ใช้ rows ชุดเดียวกับกราฟ
       (ผ่าน drill แล้ว) ส่วนตารางแก้ไขได้เต็มรูปแบบยังอยู่ที่แท็บ "ตาราง (แก้ไข)" เหมือนเดิม ── */
    if (renderDashboardTable(rows)) anyRendered = true;

    if (!hasChartJs) {
      $('dashboardEmptyCard').style.display = 'block';
      $('dashboardEmptyCard').querySelector('.mini').textContent = t('chartLibFail');
    } else if (!anyRendered) {
      $('dashboardEmptyCard').style.display = 'block';
      $('dashboardEmptyCard').querySelector('.mini').textContent = rows.length
        ? t('noChartPossible')
        : t('noRowsMatch');
    } else {
      $('dashboardEmptyCard').style.display = 'none';
    }
  }

  /* ══════════════════ Stage 4: บันทึกหลายรายงาน ══════════════════
     'บันทึกเป็นรายงาน' ผูกงานปัจจุบันเข้ากับรายการถาวรใน store 'reports' — หลังจากนั้น persistDebounced()
     (ด้านบน) จะ autosave เข้ารายงานนี้ต่อทุกครั้งที่แก้ไข ไม่ต้องกดบันทึกซ้ำเอง */
  function updateSaveUI() {
    if (state.reportId) {
      $('saveReportBtn').textContent = t('savedReportBtn', { name: state.reportName });
    } else {
      $('saveReportBtn').textContent = t('saveReportBtn');
      setSaveStatus('', '');
    }
  }
  function saveAsReport() {
    if (state.reportId) {
      // ผูกอยู่แล้ว — ปุ่มนี้ทำหน้าที่ "บันทึกตอนนี้เลย" เผื่อไม่อยากรอ autosave debounce
      persistDebounced();
      setSaveStatus(t('saveStatusSaving'), '');
      return;
    }
    var name = prompt(t('saveAsReportPrompt'), (state.fileName || t('reportDefaultBase')).replace(/\.[^.]+$/, ''));
    if (!name) return;
    name = name.trim(); if (!name) return;
    var rec = { name: name, fileName: state.fileName, sheetName: state.activeSheet,
      combineMode: state.combineMode, sheetNames: state.sheetNames,
      columns: state.columns, rows: state.rows, nextRowId: state.nextRowId, savedAt: Date.now() };
    dbAddReport(rec).then(function (id) {
      state.reportId = id; state.reportName = name;
      updateSaveUI();
      setSaveStatus(t('saveStatusSavedNamed', { name: name }), 'ok');
      persistDebounced(); // อัปเดต draft ปัจจุบันให้มี reportId ผูกไว้ด้วย กัน resume แล้วหลุดการเชื่อมโยง
    }, function () {
      setSaveStatus(t('saveStatusFail'), 'err');
    });
  }
  function relativeTime(ts) {
    var mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return t('justNow');
    if (mins < 60) return t('minsAgo', { n: mins });
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return t('hrsAgo', { n: hrs });
    return new Date(ts).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function renderReportsList() {
    dbListReports().then(function (reports) {
      reports.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
      if (!reports.length) { $('reportsCard').style.display = 'none'; $('reportsList').innerHTML = ''; return; }
      $('reportsCard').style.display = 'block';
      $('reportsMeta').textContent = t('reportsMeta', { n: reports.length.toLocaleString(locale()) });
      var html = '';
      reports.forEach(function (r) {
        html += '<div class="report-row" data-id="' + r.id + '">' +
          '<div><div class="rname">' + escapeHtml(r.name) + '</div>' +
          '<div class="rmeta">' + t('reportRowMeta', { n: (r.rows ? r.rows.length.toLocaleString(locale()) : 0), time: relativeTime(r.savedAt) }) + '</div></div>' +
          '<div class="ractions">' +
          '<button type="button" class="btn sm open-report" data-id="' + r.id + '">' + escapeHtml(t('openBtn')) + '</button>' +
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
      state.fileName = rec.fileName; state.activeSheet = rec.sheetName;
      /* rec.sheetNames เพิ่มมาทีหลัง (โหมดรวมชีต) — รายงานเก่าก่อนหน้านี้ไม่มีฟิลด์นี้ ให้ fallback เป็นชีตเดียว */
      state.sheetNames = rec.sheetNames || (rec.sheetName ? [rec.sheetName] : []);
      state.combineMode = !!rec.combineMode;
      state.columns = rec.columns; state.rows = rec.rows; state.nextRowId = rec.nextRowId;
      state.reportId = rec.id; state.reportName = rec.name;
      state.filters = {}; state.globalQuery = ''; state.sortCol = null; state.sortDir = null;
      state.selected = {}; state.page = 1; state.history = [];
      state.drill = null; state.chartChoice = { barCat: null, barNum: null, pieCat: null, lineDate: null, lineNum: null };
    state.chartType = { slot1: null, slot2: null, slot3: null };
    state.dashTable = { mode: 'flat', pivotRow: null, pivotCol: '', pivotVal: '', pivotAgg: 'sum', filters: {}, hiddenCols: {} };
    state.domainOverride = null;
      updateDrillBanner(); updateSaveUI();
      $('uploadCard').style.display = 'none'; $('reportsCard').style.display = 'none'; $('resumeCard').style.display = 'none';
      $('dataMeta').textContent = (state.fileName || rec.name) + dataMetaSheetSuffix() + ' · ' + state.rows.length.toLocaleString(locale()) + ' ' + t('unitRows');
      $('viewTabs').style.display = 'flex';
      setView('table');
      persistDebounced();
    });
  }
  function renameReport(id) {
    dbGetReport(id).then(function (rec) {
      if (!rec) return;
      var name = prompt(t('renameReportPrompt'), rec.name);
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
      if (!confirm(t('deleteReportConfirm', { name: rec.name }))) return;
      dbDeleteReport(id).then(function () {
        if (state.reportId === id) { state.reportId = null; state.reportName = null; updateSaveUI(); persistDebounced(); }
        renderReportsList();
      });
    });
  }

  /* ══════════════════ Stage 5: ส่งออก ══════════════════ */
  function exportFileBase() { return (state.reportName || (state.fileName || t('reportDefaultBase')).replace(/\.[^.]+$/, '')); }
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
    if (typeof XLSX === 'undefined') { setUploadStatus('', ''); alert(t('exportLibFail')); return; }
    if (!state.rows.length) { alert(t('exportNoData')); return; }
    var ws = XLSX.utils.json_to_sheet(buildExportRows());
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (state.activeSheet || 'Sheet1').slice(0, 31));
    XLSX.writeFile(wb, exportFileBase() + '.xlsx');
  }
  function exportCsv() {
    if (typeof XLSX === 'undefined') { alert(t('exportLibFail')); return; }
    if (!state.rows.length) { alert(t('exportNoData')); return; }
    var ws = XLSX.utils.json_to_sheet(buildExportRows());
    var csv = XLSX.utils.sheet_to_csv(ws);
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM กัน Excel เปิดภาษาไทยเพี้ยน
    downloadBlob(blob, exportFileBase() + '.csv');
  }
  /* ── ส่งออกตารางในแดชบอร์ด (ตามที่กำลังเห็นจริง — ผ่านตัวกรองของตารางนี้แล้ว และถ้าอยู่โหมด Pivot
     ก็ส่งออกเป็นตารางไขว้ที่คำนวณแล้ว ไม่ใช่ข้อมูลดิบ) — ต่างจากปุ่ม Excel/CSV ที่แท็บ "ตาราง (แก้ไข)"
     ซึ่งส่งออกข้อมูลดิบทั้งหมดเสมอ ไม่คำนึงถึงตัวกรอง/Pivot ที่ตั้งไว้ในแดชบอร์ด ไม่จำกัดจำนวนแถว/คอลัมน์
     ไม่ซ้ำกันแบบที่ตารางบนจอจำกัดไว้ (จำกัดไว้กันตารางแสดงผลอืด ไม่ใช่ข้อจำกัดของไฟล์ที่ส่งออกได้) */
  function buildDashTableExportRows() {
    var rows = lastDashRows.filter(matchesDashFilters);
    var dt = state.dashTable;
    if (dt.mode === 'pivot' && dt.pivotRow) {
      var piv = buildPivot(rows, true);
      if (!piv) return [];
      var out = [];
      piv.rowKeys.forEach(function (rk) {
        var o = {}; o[piv.rowLabel] = rk;
        var rowTotal = 0, anyVal = false;
        piv.colKeys.forEach(function (ck) {
          var v = piv.cellVal(rk, ck);
          var colHeader = ck === '__single__' ? piv.valLabel : ck;
          o[colHeader] = v == null ? '' : v;
          if (v != null) { rowTotal += v; anyVal = true; }
        });
        if (piv.colLabel) o[t('pivotTotalLbl')] = anyVal ? rowTotal : '';
        out.push(o);
      });
      if (piv.colLabel) {
        var totalRow = {}; totalRow[piv.rowLabel] = t('pivotGrandTotalLbl');
        var grand = 0;
        piv.colKeys.forEach(function (ck) {
          var sum = 0;
          piv.rowKeys.forEach(function (rk) { var v = piv.cellVal(rk, ck); if (v != null) sum += v; });
          totalRow[ck] = sum; grand += sum;
        });
        totalRow[t('pivotTotalLbl')] = grand;
        out.push(totalRow);
      }
      return out;
    }
    return rows.map(function (r) {
      var o = {};
      state.columns.forEach(function (col) {
        var v = r[col.key];
        if (v instanceof Date && !isNaN(v)) o[col.label] = v.toISOString().slice(0, 10);
        else o[col.label] = (v === null || v === undefined) ? '' : v;
      });
      return o;
    });
  }
  function dashTableExportSuffix() { return state.dashTable.mode === 'pivot' ? '-pivot' : '-table'; }
  function exportDashTableXlsx() {
    if (typeof XLSX === 'undefined') { alert(t('exportLibFail')); return; }
    var rows = buildDashTableExportRows();
    if (!rows.length) { alert(t('exportNoData')); return; }
    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (state.dashTable.mode === 'pivot' ? 'Pivot' : 'Sheet1'));
    XLSX.writeFile(wb, exportFileBase() + dashTableExportSuffix() + '.xlsx');
  }
  function exportDashTableCsv() {
    if (typeof XLSX === 'undefined') { alert(t('exportLibFail')); return; }
    var rows = buildDashTableExportRows();
    if (!rows.length) { alert(t('exportNoData')); return; }
    var ws = XLSX.utils.json_to_sheet(rows);
    var csv = XLSX.utils.sheet_to_csv(ws);
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, exportFileBase() + dashTableExportSuffix() + '.csv');
  }
  /* ── ซ่อนแถบเครื่องมือ/ตัวเลือก/ตัวกรองที่กดไม่ได้อยู่แล้วชั่วคราวตอนแคปภาพ (html2canvas) — คืนค่ากลับ
     เสมอไม่ว่าจะสำเร็จหรือพลาด กันเผลอค้างซ่อนถาวรถ้า promise reject ═══ */
  function withControlsHidden(fn) {
    var el = $('dashboardView');
    el.classList.add('hide-controls');
    var restore = function () { el.classList.remove('hide-controls'); };
    return fn().then(function (v) { restore(); return v; }, function (e) { restore(); throw e; });
  }
  function exportDashboardImage() {
    if (typeof window.html2canvas === 'undefined') { alert(t('exportLibFail')); return; }
    withControlsHidden(function () {
      return window.html2canvas($('dashboardView'), { backgroundColor: '#F3F5F8', scale: 2 });
    }).then(function (canvas) {
      canvas.toBlob(function (blob) { if (blob) downloadBlob(blob, exportFileBase() + '.png'); });
    });
  }
  /* ตัด canvas เป็นหลายหน้า A4 ถ้าสูงเกิน 1 หน้า — เคลิบเดียวกับ generatePdf() ใน excel.js */
  function exportDashboardPdf() {
    var jsPDFctor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFctor || !window.html2canvas) { window.print(); return; }
    withControlsHidden(function () {
      return window.html2canvas($('dashboardView'), { backgroundColor: '#F3F5F8', scale: 2 });
    }).then(function (canvas) {
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

    var html = '<!DOCTYPE html><html lang="' + getUILang() + '"><head><meta charset="utf-8">' +
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
      '<div class="sub">' + escapeHtml(t('exportedAt', { date: new Date().toLocaleString(locale()), n: state.rows.length.toLocaleString(locale()) })) + '</div>';

    if (showNum) html += '<div class="card"><h2>' + escapeHtml(t('numStatTitle')) + '</h2><div class="stat-row">' + $('numStatRow').innerHTML + '</div></div>';
    if (showBar) html += '<div class="card"><h2>' + escapeHtml($('barChartTitle').textContent) + '</h2><div class="chart-wrap"><canvas id="rdc1"></canvas></div></div>';
    if (showLine) html += '<div class="card"><h2>' + escapeHtml($('lineChartTitle').textContent) + '</h2><div class="chart-wrap"><canvas id="rdc2"></canvas></div></div>';
    if (showPie) html += '<div class="card"><h2>' + escapeHtml($('pieChartTitle').textContent) + '</h2><div class="chart-wrap"><canvas id="rdc3"></canvas></div></div>';

    html += '<div class="foot">' + escapeHtml(t('exportedFooter')) + '</div></div>' +
      '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"><\/script><script>';
    if (showBar) html += 'new Chart(document.getElementById("rdc1").getContext("2d"),' + JSON.stringify(barCfg) + ');';
    if (showLine) html += 'new Chart(document.getElementById("rdc2").getContext("2d"),' + JSON.stringify(lineCfg) + ');';
    if (showPie) html += 'new Chart(document.getElementById("rdc3").getContext("2d"),' + JSON.stringify(pieCfg) + ');';
    html += '<\/script></body></html>';
    return html;
  }
  function exportDashboardHtml() {
    if (!state.rows.length) { alert(t('exportNoData')); return; }
    var blob = new Blob([buildDashboardHtmlDoc()], { type: 'text/html;charset=utf-8;' });
    downloadBlob(blob, exportFileBase() + '.html');
  }

  function resetToUpload() {
    state.fileName = null; state.sheetNames = []; state.activeSheet = null; state.combineMode = false; state.workbook = null; state.rawAoA = null;
    state.columns = []; state.rows = []; state.nextRowId = 1; state.filters = {}; state.globalQuery = '';
    state.sortCol = null; state.sortDir = null; state.selected = {}; state.page = 1; state.history = [];
    state.drill = null; state.chartChoice = { barCat: null, barNum: null, pieCat: null, lineDate: null, lineNum: null };
    state.chartType = { slot1: null, slot2: null, slot3: null };
    state.dashTable = { mode: 'flat', pivotRow: null, pivotCol: '', pivotVal: '', pivotAgg: 'sum', filters: {}, hiddenCols: {} };
    state.domainOverride = null;
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
  var lastSavedResume = null;
  function renderResumeInfo() {
    if (!lastSavedResume) return;
    var saved = lastSavedResume;
    $('resumeInfo').textContent = t('resumeInfo', {
      name: saved.reportName || saved.fileName || t('resumeFallbackName'),
      n: saved.rows.length.toLocaleString(locale()),
      date: new Date(saved.savedAt).toLocaleString(locale())
    });
  }
  function init() {
    applyStaticI18n();
    if ($('langToggle')) {
      $('langToggle').addEventListener('click', function () {
        setUILang(getUILang() === 'en' ? 'th' : 'en');
        /* ล้างตัวกรองจากคลิกกราฟ (drill) ทิ้งตอนสลับภาษา — ค่า "อื่นๆ"/"(ว่าง)" ที่เก็บไว้เป็นข้อความ
           ภาษาเดิม จะไม่ตรงกับข้อความภาษาใหม่ที่ matchesDrill() สร้างใหม่อีกต่อไป กรองแล้วจะเงียบๆ ไม่เจอ
           สักแถว — เคลียร์ทิ้งไปเลยชัดเจนกว่า */
        if (state.drill) clearDrill();
        applyStaticI18n();
        updateSaveUI();
        renderResumeInfo();
        renderReportsList();
        if (state.rows.length) {
          updateStatRow();
          updateSelectionUI();
          if (currentView === 'dashboard') renderDashboard(); else renderTable();
        }
      });
    }
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
    $('sheetModeCombine').addEventListener('click', selectCombinedSheets);
    $('sheetModeSingle').addEventListener('click', function () {
      state.combineMode = false;
      $('sheetModeSingle').classList.add('on'); $('sheetModeCombine').classList.remove('on');
      $('sheetChips').style.display = 'flex';
    });
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
    /* ตัวเลือกโหมด/Pivot ของตารางในแดชบอร์ด — สลับแล้ววาดใหม่แค่ตัวตาราง (renderDashboardTable) ไม่ต้อง
       สร้างกราฟใหม่ทั้งหมด ใช้ lastDashRows ที่เก็บไว้จากรอบ renderDashboard() ล่าสุด */
    $('dashModeSel').addEventListener('change', function () { state.dashTable.mode = this.value; renderDashboardTable(lastDashRows); });
    $('pivotRowSel').addEventListener('change', function () { state.dashTable.pivotRow = this.value; renderDashboardTable(lastDashRows); });
    $('pivotColSel').addEventListener('change', function () { state.dashTable.pivotCol = this.value; renderDashboardTable(lastDashRows); });
    $('pivotValSel').addEventListener('change', function () { state.dashTable.pivotVal = this.value; renderDashboardTable(lastDashRows); });
    $('pivotAggSel').addEventListener('change', function () { state.dashTable.pivotAgg = this.value; renderDashboardTable(lastDashRows); });
    /* ปุ่ม "ไฟล์ใหม่" — ถามยืนยันเฉพาะตอนข้อมูลยังไม่ได้บันทึกเป็นรายงาน (reportId ว่าง) เพราะนั่นคือ
       กรณีเดียวที่ข้อมูลจะหายจริง — ถ้าบันทึกเป็นรายงานแล้วสลับได้เลยโดยไม่ต้องถาม (autosave ไว้แล้ว) */
    $('newFileBtn').addEventListener('click', function () {
      if (!state.reportId && state.rows.length && !confirm(t('newFileConfirm'))) return;
      resetToUpload();
    });
    $('myReportsBtn').addEventListener('click', function () {
      if (!state.reportId && state.rows.length && !confirm(t('myReportsConfirm'))) return;
      resetToUpload();
      setTimeout(function () { var el = $('reportsCard'); if (el.style.display !== 'none') el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    });
    $('saveReportBtn').addEventListener('click', saveAsReport);
    $('exportXlsxBtn').addEventListener('click', exportXlsx);
    $('exportCsvBtn').addEventListener('click', exportCsv);
    $('exportImgBtn').addEventListener('click', exportDashboardImage);
    $('exportPdfBtn').addEventListener('click', exportDashboardPdf);
    $('exportHtmlBtn').addEventListener('click', exportDashboardHtml);
    $('dashExportXlsxBtn').addEventListener('click', exportDashTableXlsx);
    $('dashExportCsvBtn').addEventListener('click', exportDashTableCsv);
    $('dashColsBtn').addEventListener('click', function () { openColumnVisibilityPopover($('dashColsBtn')); });
    $('domainOverrideSel').addEventListener('change', function () {
      state.domainOverride = this.value || null;
      renderDashboard();
    });
    $('printBtn').addEventListener('click', function () { window.print(); });
    $('globalSearch').addEventListener('input', function () {
      state.globalQuery = $('globalSearch').value; state.page = 1; renderTable();
    });

    renderReportsList();
    dbLoadCurrent().then(function (saved) {
      if (saved && saved.rows && saved.rows.length) {
        lastSavedResume = saved;
        $('resumeCard').style.display = 'block';
        renderResumeInfo();
        $('resumeBtn').addEventListener('click', function () {
          state.fileName = saved.fileName; state.activeSheet = saved.sheetName;
          state.sheetNames = saved.sheetNames || (saved.sheetName ? [saved.sheetName] : []);
          state.combineMode = !!saved.combineMode;
          state.columns = saved.columns; state.rows = saved.rows; state.nextRowId = saved.nextRowId;
          state.reportId = saved.reportId || null; state.reportName = saved.reportName || null;
          state.filters = {}; state.globalQuery = ''; state.sortCol = null; state.sortDir = null;
          state.selected = {}; state.page = 1; state.history = [];
          state.drill = null; state.chartChoice = { barCat: null, barNum: null, pieCat: null, lineDate: null, lineNum: null };
    state.chartType = { slot1: null, slot2: null, slot3: null };
    state.dashTable = { mode: 'flat', pivotRow: null, pivotCol: '', pivotVal: '', pivotAgg: 'sum', filters: {}, hiddenCols: {} };
    state.domainOverride = null;
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
