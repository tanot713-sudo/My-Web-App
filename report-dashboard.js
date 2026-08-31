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
      tabTable: '📋 ตาราง (แก้ไข)', tabDashboard: '📊 แดชบอร์ด', tabCustom: '🧩 กำหนดเอง',
      addWidgetBtn: '➕ เพิ่มกล่อง',
      customEmptyHint: 'ลากมุมกล่องเพื่อย่อ-ขยาย ลากหัวกล่องเพื่อย้ายตำแหน่ง — เริ่มจากกด "เพิ่มกล่อง" ด้านบน',
      addWidgetPickTitle: 'เลือกชนิดกล่อง', wtKpi: '🔢 ตัวเลข (KPI)', wtChart: '📊 กราฟ', wtText: '📝 ข้อความ', wtTable: '📋 ตาราง',
      wtKpiLabel: 'กล่องตัวเลข', wtChartLabel: 'กล่องกราฟ', wtTextLabel: 'กล่องข้อความ', wtTableLabel: 'กล่องตาราง',
      wtEditTitle: 'แก้ไขกล่องนี้', wtRemoveTitle: 'ลบกล่องนี้',
      cwColumnLbl: 'คอลัมน์', cwAggLbl: 'วิธีคำนวณ', cwLabelLbl: 'ป้ายชื่อ (ไม่บังคับ)',
      cwAggSum: 'ผลรวม', cwAggAvg: 'ค่าเฉลี่ย', cwAggCount: 'จำนวนแถวทั้งหมด', cwAggMin: 'ค่าต่ำสุด', cwAggMax: 'ค่าสูงสุด',
      cwChartTypeLbl: 'ชนิดกราฟ', cwGroupByLbl: 'จัดกลุ่มตาม', cwValueLbl: 'ค่า',
      cwTextPh: 'พิมพ์ข้อความที่นี่…', totalRowsKpiLabel: 'จำนวนแถวทั้งหมด',
      cwTableModeLbl: 'รูปแบบตาราง', cwTableModePlain: 'ตารางข้อมูล', cwTableModePivot: 'Pivot Table',
      cwTableColsLbl: 'คอลัมน์ที่แสดง', cwTableSearchPh: 'ค้นหาในตาราง…', cwTableNoColsHint: 'เลือกอย่างน้อย 1 คอลัมน์',
      cwTableSortHint: 'คลิกหัวคอลัมน์เพื่อเรียงลำดับ',
      cardColorBtnTitle: 'ปรับสีการ์ดนี้', cardColorTitle: 'ปรับสีการ์ด', cardBgColorLbl: 'สีพื้นหลัง',
      cardAccentColorLbl: 'สีหลัก (กราฟ/ตัวเลข)', cardGradientLbl: 'ไล่เฉดสี', cardColorResetBtn: 'ล้างสี',
      moreColorsLbl: 'สีอื่นๆ', autoFillOptionsHint: 'ตัวเลือกเติมอัตโนมัติ', autoFillOptionsTitle: 'เลือกรูปแบบการเติม',
      autoFillSeriesOpt: 'ไล่ต่อเป็นลำดับ', autoFillCopyOpt: 'ทำซ้ำค่าเดิม',
      customBgBtn: '🎨 พื้นหลัง', loadTemplateBtn: '📥 โหลดจากแดชบอร์ด',
      loadTemplateNoneHint: 'ยังไม่มีการ์ดในแท็บ "แดชบอร์ด" ให้โหลด — อัปโหลดข้อมูลก่อน',
      loadTemplateSnapshotNote: ' (สแนปช็อต ณ ตอนโหลด ไม่อัปเดตตามข้อมูลสด)',
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
      addColBtn: '+ เพิ่มคอลัมน์', delColTitle: 'ลบคอลัมน์นี้', newColumnDefaultLabel: 'คอลัมน์ใหม่',
      renameColPrompt: 'ตั้งชื่อคอลัมน์', dblclickRenameHint: 'ดับเบิลคลิกชื่อคอลัมน์เพื่อเปลี่ยนชื่อ',
      fillHandleHint: 'ลากเพื่อเติมอัตโนมัติ — กด Ctrl ค้างไว้ระหว่างลาก หรือกดปุ่ม ⚙️ ที่ขึ้นมาหลังลากเสร็จ เพื่อสลับโหมด (ไล่เลข/ทำซ้ำ)',
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
      domainFinanceOption: '💰 รายรับ-รายจ่าย', domainReadingOption: '📚 การอ่านหนังสือ',
      domainTitleFinance: '💰 แดชบอร์ดรายรับ-รายจ่าย', domainTitleReading: '📚 แดชบอร์ดการอ่านหนังสือ',
      domainNameFinance: 'รายรับ-รายจ่าย', domainNameReading: 'การอ่านหนังสือ',
      fKpiIncome: 'รายรับรวม', fKpiExpense: 'รายจ่ายรวม', fKpiNet: 'คงเหลือสุทธิ', fKpiTxnCount: 'จำนวนรายการ',
      fChartExpenseByCategory: '📊 รายจ่ายตามหมวดหมู่', fChartNetByMonth: '📈 คงเหลือสุทธิรายเดือน',
      rdKpiTotalBooks: 'จำนวนหนังสือทั้งหมด', rdKpiTotalPages: 'จำนวนหน้ารวม',
      rdKpiAvgRating: 'คะแนนเฉลี่ย', rdKpiGenres: 'จำนวนแนว',
      rdChartByGenre: '📊 จำนวนเล่มต่อแนว', rdChartByMonth: '📈 จำนวนเล่มที่อ่านจบต่อเดือน',
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
      tabTable: '📋 Table (Edit)', tabDashboard: '📊 Dashboard', tabCustom: '🧩 Custom',
      addWidgetBtn: '➕ Add Box',
      customEmptyHint: 'Drag a corner to resize, drag the header to move — start by clicking "Add Box" above',
      addWidgetPickTitle: 'Choose a box type', wtKpi: '🔢 Number (KPI)', wtChart: '📊 Chart', wtText: '📝 Text', wtTable: '📋 Table',
      wtKpiLabel: 'Number box', wtChartLabel: 'Chart box', wtTextLabel: 'Text box', wtTableLabel: 'Table box',
      wtEditTitle: 'Edit this box', wtRemoveTitle: 'Remove this box',
      cwColumnLbl: 'Column', cwAggLbl: 'Aggregation', cwLabelLbl: 'Label (optional)',
      cwAggSum: 'Sum', cwAggAvg: 'Average', cwAggCount: 'Total row count', cwAggMin: 'Minimum', cwAggMax: 'Maximum',
      cwChartTypeLbl: 'Chart type', cwGroupByLbl: 'Group by', cwValueLbl: 'Value',
      cwTextPh: 'Type your text here…', totalRowsKpiLabel: 'Total Rows',
      cwTableModeLbl: 'Table mode', cwTableModePlain: 'Data table', cwTableModePivot: 'Pivot Table',
      cwTableColsLbl: 'Columns to show', cwTableSearchPh: 'Search table…', cwTableNoColsHint: 'Select at least 1 column',
      cwTableSortHint: 'Click a column header to sort',
      cardColorBtnTitle: 'Customize this card\'s color', cardColorTitle: 'Customize card color', cardBgColorLbl: 'Background color',
      cardAccentColorLbl: 'Accent color (chart/number)', cardGradientLbl: 'Gradient', cardColorResetBtn: 'Reset',
      moreColorsLbl: 'More colors', autoFillOptionsHint: 'Auto Fill Options', autoFillOptionsTitle: 'Choose fill type',
      autoFillSeriesOpt: 'Continue series', autoFillCopyOpt: 'Repeat value',
      customBgBtn: '🎨 Background', loadTemplateBtn: '📥 Load from Dashboard',
      loadTemplateNoneHint: 'No cards in the "Dashboard" tab to load yet — upload data first',
      loadTemplateSnapshotNote: ' (snapshot at load time, not live-updating)',
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
      addColBtn: '+ Add Column', delColTitle: 'Delete this column', newColumnDefaultLabel: 'New column',
      renameColPrompt: 'Rename column', dblclickRenameHint: 'Double-click a column name to rename it',
      fillHandleHint: 'Drag to auto-fill — hold Ctrl while dragging, or tap the ⚙️ button that appears after, to toggle mode (series/repeat)',
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
      domainFinanceOption: '💰 Income/Expense', domainReadingOption: '📚 Reading Tracker',
      domainTitleFinance: '💰 Income/Expense Dashboard', domainTitleReading: '📚 Reading Dashboard',
      domainNameFinance: 'Income/Expense', domainNameReading: 'Reading',
      fKpiIncome: 'Total Income', fKpiExpense: 'Total Expense', fKpiNet: 'Net Balance', fKpiTxnCount: 'Transactions',
      fChartExpenseByCategory: '📊 Expense by Category', fChartNetByMonth: '📈 Net Balance by Month',
      rdKpiTotalBooks: 'Total Books', rdKpiTotalPages: 'Total Pages',
      rdKpiAvgRating: 'Avg Rating', rdKpiGenres: 'Total Genres',
      rdChartByGenre: '📊 Books by Genre', rdChartByMonth: '📈 Books Finished by Month',
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
    cellSel: null,         // { id0, col0, id1, col1 } ช่วงเซลล์ที่เลือกไว้ (อ้างด้วย row id + col key) สำหรับลาก fill handle
    page: 1,
    history: [],           // snapshots for undo: { columns, rows, nextRowId }
    drill: null,           // { key, label, value } — จากคลิกแท่ง/ชิ้นวงกลมในแดชบอร์ด กรองทั้งตาราง+แดชบอร์ด
    chartChoice: { barCat: null, barNum: null, pieCat: null, lineDate: null, lineNum: null }, // null = auto
    chartType: { slot1: null, slot2: null, slot3: null }, // null = ดีฟอลต์ของสล็อตนั้น (bar/line/doughnut)
    dashTable: { mode: 'flat', pivotRow: null, pivotCol: '', pivotVal: '', pivotAgg: 'sum', filters: {}, hiddenCols: {} }, // ตารางในแดชบอร์ด: โหมดรายการ/pivot + ตัวกรองของตัวเอง (ไม่ผูกกับ state.filters ของแท็บแก้ไข)
    domainOverride: null,  // '' หรือ null = อัตโนมัติ (เดาจากชื่อคอลัมน์), 'none'|'maintenance'|'project'|'legal' = ผู้ใช้เลือกเอง
    customWidgets: [],    // [{id,type:'kpi'|'chart'|'table'|'text',x,y,w,h,config}] มุมมอง "กำหนดเอง" — ต่างจาก dashTable/domainOverride
                           // ตรงที่ต้อง "จำ" ข้ามเซสชัน (ผู้ใช้จัดวางเองด้วยมือ) จึงบันทึกไปกับรายงานด้วย
    cardColors: {},        // role ('numStat'|'bar'|'line'|'pie'|'domainKpi'|'domainMatrix'|'domainChart1'|'domainChart2') ->
                           // {bg, accent, gradient} ปรับสีการ์ดในแท็บ "แดชบอร์ด" — persist เหมือน customWidgets (ผู้ใช้ตั้งเอง)
    customBg: null,        // {bg, gradient} สีพื้นหลังของผืนผ้าใบแท็บ "กำหนดเอง"
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
        customWidgets: state.customWidgets, cardColors: state.cardColors, customBg: state.customBg,
        savedAt: Date.now()
      };
      dbSaveCurrent(payload);
      /* ถ้างานนี้ผูกกับรายงานที่ตั้งชื่อบันทึกไว้แล้ว (Stage 4) ให้ autosave เข้ารายงานนั้นตรงๆ ด้วย
         ไม่ต้องกดบันทึกซ้ำทุกครั้งที่แก้ไข */
      if (state.reportId) {
        dbPutReport({
          id: state.reportId, name: state.reportName, fileName: state.fileName, sheetName: state.activeSheet,
          combineMode: state.combineMode, sheetNames: state.sheetNames,
          columns: state.columns, rows: state.rows, nextRowId: state.nextRowId, customWidgets: state.customWidgets,
          cardColors: state.cardColors, customBg: state.customBg, savedAt: Date.now()
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
    state.customWidgets = [];
    state.cardColors = {};
    state.customBg = null;
    state.cellSel = null;
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
    $('customView').style.display = view === 'custom' ? 'block' : 'none';
    $('dashExportToolbar').style.display = (view === 'dashboard' || view === 'custom') ? 'flex' : 'none';
    /* render ใหม่ทุกครั้งที่สลับเข้ามุมมองนั้น (ไม่ใช่แค่ตอน confirmHeader()/resume ครั้งแรก) — กันเห็น
       ข้อมูลเก่าค้าง เช่น กด drill-down จากแดชบอร์ดแล้วสลับมาตาราง ต้องเห็นตารางกรองตามด้วย */
    if (view === 'dashboard') renderDashboard();
    else if (view === 'custom') renderCustomView();
    else renderTable();
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
          '<span class="th-label" data-col="' + col.key + '" title="' + escapeAttr(t('dblclickRenameHint')) + '">' + escapeHtml(col.label) + '</span>' +
          '<span class="sort-ic">' + ic + '</span>' +
          '<button type="button" class="col-del" data-col="' + col.key + '" title="' + escapeAttr(t('delColTitle')) + '">✕</button></th>';
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
            return '<td class="' + (col.type === 'number' ? 'num' : '') + '" data-id="' + row.__id + '" data-col="' + col.key + '"><input class="cell-in" type="' + inputType +
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
    wireCellSelection();
    wireCellKeyboardNav();
    renderCellSelOverlay();
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
  /* opts เป็นตัวเลือกไม่บังคับ ใช้ตอนเรียกจากกล่อง Pivot ในแท็บ "กำหนดเอง" (แต่ละกล่องมีค่า
     แถว/คอลัมน์/ค่า/วิธีคำนวณเป็นของตัวเอง แยกจากตาราง Pivot หลัก) — ไม่ใส่ opts จะอ่านจาก
     state.dashTable เหมือนเดิมทุกประการ (ตาราง Pivot หลักในแท็บ "ตาราง" ไม่กระทบ) */
  function buildPivot(rows, noCap, opts) {
    var dt = state.dashTable;
    var rowKey = opts ? opts.rowKey : dt.pivotRow;
    var colKey = opts ? opts.colKey : dt.pivotCol;
    var valKey = opts ? opts.valKey : dt.pivotVal;
    var agg = opts ? opts.agg : dt.pivotAgg;
    var rowCol = state.columns.filter(function (c) { return c.key === rowKey; })[0];
    if (!rowCol) return null;
    var colCol = colKey ? state.columns.filter(function (c) { return c.key === colKey; })[0] : null;
    var valCol = valKey ? state.columns.filter(function (c) { return c.key === valKey; })[0] : null;
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

  /* สร้าง <thead>+<tbody> ของตาราง Pivot จากผลลัพธ์ buildPivot() — แยกออกมาจาก renderDashTableBody()
     เพื่อให้กล่อง Pivot ในแท็บ "กำหนดเอง" เรียกใช้ซ้ำได้โดยไม่ต้องก็อปโค้ดสร้าง HTML ซ้ำ */
  function pivotTableHtml(piv) {
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
    return thead + '<tbody>' + bodyRows + totalsRow + '</tbody>';
  }

  /* วาดเฉพาะเนื้อ <table> + meta — แยกจากการวาดแถบควบคุม/แถวกรอง กันช่องกรองเสียโฟกัสตอนพิมพ์
     (ต่างจาก renderTable() หลักที่ต้อง refocus เอง เพราะที่นี่ input ตัวเดิมไม่ถูกลบทิ้งเลย) */
  function renderDashTableBody() {
    var rows = lastDashRows.filter(matchesDashFilters);
    var dt = state.dashTable;
    if (dt.mode === 'pivot') {
      var piv = dt.pivotRow ? buildPivot(rows) : null;
      if (!piv) { $('dashTable').innerHTML = ''; $('dashTableMeta').textContent = t('pivotEmptyHint'); return; }
      $('dashTable').innerHTML = pivotTableHtml(piv);
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
    /* วัดขนาดจริงหลัง layout (offsetWidth/Height บังคับ reflow แล้ว) แทนค่าคงที่เดิม (230/260) — ป๊อปอัพ
       ที่เนื้อหายาวกว่าปกติ (เช่นส่วนปรับสีที่มีทั้งสวอตช์สี+ปุ่มล้างสี) จะได้กันขอบขวา/ล่างจอถูกต้องเสมอ
       ไม่ล้นออกไปหรือถูกตัดที่ขอบจอเหมือนที่เคยเกิดตอนกว้าง/สูงเกินสมมุติฐานเดิม */
    var w = el.offsetWidth || 230, h = el.offsetHeight || 260;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var top = r.bottom + 6;
    if (top + h > window.innerHeight) top = Math.max(8, r.top - h - 6); // ไม่มีที่ด้านล่างพอ เปิดขึ้นด้านบนแทน
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }
  function openPopover(innerHtml, anchorEl, wireFn, wide) {
    if (closeActivePopover) closeActivePopover();
    var el = $('filterPopover');
    el.className = 'filter-popover' + (wide ? ' wide' : '');
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
    /* ลบคอลัมน์ (ปุ่ม ✕ ในหัวตาราง) — stopPropagation กันไม่ให้ไปโดน listener เรียงคอลัมน์ของ th ด้วย */
    [].forEach.call($('dataTable').querySelectorAll('.col-del'), function (btn) {
      btn.addEventListener('click', function (e) { e.stopPropagation(); deleteColumn(btn.getAttribute('data-col')); });
    });
    /* เปลี่ยนชื่อคอลัมน์ (ดับเบิลคลิกที่ชื่อ) */
    [].forEach.call($('dataTable').querySelectorAll('.th-label'), function (span) {
      span.addEventListener('dblclick', function (e) { e.stopPropagation(); renameColumn(span.getAttribute('data-col')); });
    });
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

  /* แปลงข้อความดิบ (จากพิมพ์ในเซลล์ หรือจากแปะ/paste) ให้เป็นค่าจริงตามชนิดคอลัมน์ — ใช้ร่วมกันทั้ง
     commitCellEdit() (พิมพ์ทีละเซลล์) และ pasteGridAt() (แปะทีเดียวหลายเซลล์) กันตรรกะแปลงค่าเพี้ยนกันคนละที่ */
  function coerceCellValue(col, rawVal) {
    if (rawVal === '' || rawVal == null) return null;
    if (col && col.type === 'number') { var n = num(rawVal); return isFinite(n) ? n : rawVal; }
    if (col && col.type === 'date') { var d = new Date(rawVal); return isNaN(d) ? rawVal : d; }
    return rawVal;
  }
  function commitCellEdit(rowId, colKey, rawVal) {
    var row = state.rows.filter(function (r) { return r.__id === rowId; })[0];
    if (!row) return;
    var col = state.columns.filter(function (c) { return c.key === colKey; })[0];
    row[colKey] = coerceCellValue(col, rawVal);
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

  /* ══════════════════ เพิ่ม/ลบ/เปลี่ยนชื่อ คอลัมน์ ══════════════════ */
  function genColKey() { return 'col_new_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function addColumn() {
    pushHistory();
    var key = genColKey();
    state.columns.push({ key: key, label: t('newColumnDefaultLabel'), type: 'text' });
    state.rows.forEach(function (r) { r[key] = null; });
    renderTable();
    persistDebounced();
  }
  function renameColumn(key) {
    var col = state.columns.filter(function (c) { return c.key === key; })[0];
    if (!col) return;
    var next = window.prompt(t('renameColPrompt'), col.label);
    if (next === null) return;
    next = next.trim();
    if (!next) return;
    pushHistory();
    col.label = next;
    renderTable();
    persistDebounced();
  }
  function deleteColumn(key) {
    pushHistory();
    state.columns = state.columns.filter(function (c) { return c.key !== key; });
    state.rows.forEach(function (r) { delete r[key]; });
    delete state.filters[key];
    if (state.sortCol === key) { state.sortCol = null; state.sortDir = null; }
    if (state.dashTable.hiddenCols) delete state.dashTable.hiddenCols[key];
    if (state.cellSel && (state.cellSel.col0 === key || state.cellSel.col1 === key)) state.cellSel = null;
    renderTable();
    persistDebounced();
  }

  /* ══════════════════ เลือกเซลล์ + ลาก Fill Handle (คล้าย Excel) ══════════════════
     state.cellSel เก็บช่วงที่เลือกด้วย row id + column key (ไม่ใช่ index ของหน้า/ลำดับที่แสดงผล) เพื่อให้
     รอดจากการ re-render ระหว่างพิมพ์ — ถ้าอ้างถึงแถว/คอลัมน์ที่ไม่ได้แสดงอยู่ในหน้าปัจจุบันแล้ว (เปลี่ยนหน้า/
     ถูกกรองออก/ถูกลบ) renderCellSelOverlay() จะไม่วาดอะไรเลย (แต่ไม่ล้างค่า state.cellSel ทิ้ง เผื่อกลับมาหน้าเดิม)
     รองรับการเลือกหลายเซลล์ด้วย Shift+คลิก เท่านั้น (ไม่รองรับลากเมาส์เลือกตรงๆ เพราะจะชนกับการลากเลือก
     ข้อความในช่อง input ของแต่ละเซลล์) ส่วนการลาก "fill handle" ใช้จุดเล็กๆ ที่มุมขวาล่างของกรอบที่เลือกแทน */
  var fillDrag = null; // ตัวแปรชั่วคราวระหว่างลาก ไม่ต้อง persist
  function clearCellSel() { state.cellSel = null; renderCellSelOverlay(); }
  function cellTd(id, colKey) { return $('dataTable').querySelector('td[data-id="' + id + '"][data-col="' + colKey + '"]'); }
  /* แปลง state.cellSel (id/key) เป็นตำแหน่งแถว/คอลัมน์ที่แสดงผลอยู่ตอนนี้ (index ใน pageRows ปัจจุบัน + ลำดับ
     คอลัมน์ใน state.columns) คืน null ถ้าเซลล์ปลายด้านใดด้านหนึ่งไม่ได้อยู่ในหน้าที่แสดงอยู่ตอนนี้ */
  function cellSelToIndices(sel) {
    var trs = [].slice.call($('dataTable').querySelectorAll('tbody tr[data-id]'));
    var rowIds = trs.map(function (tr) { return +tr.getAttribute('data-id'); });
    var r0 = rowIds.indexOf(sel.id0), r1 = rowIds.indexOf(sel.id1);
    var colKeys = state.columns.map(function (c) { return c.key; });
    var c0 = colKeys.indexOf(sel.col0), c1 = colKeys.indexOf(sel.col1);
    if (r0 === -1 || r1 === -1 || c0 === -1 || c1 === -1) return null;
    return { rMin: Math.min(r0, r1), rMax: Math.max(r0, r1), cMin: Math.min(c0, c1), cMax: Math.max(c0, c1), rowIds: rowIds, colKeys: colKeys };
  }
  function renderCellSelOverlay(previewIdx) {
    var wrap = $('dataTableWrap');
    [].forEach.call(wrap.querySelectorAll('.cellsel-box,.cellsel-handle,.cellsel-fillpreview,.cellsel-autofill-btn'), function (el) { el.remove(); });
    [].forEach.call(wrap.querySelectorAll('td.cellsel-in'), function (td) { td.classList.remove('cellsel-in'); });
    if (!state.cellSel) return;
    var idx = cellSelToIndices(state.cellSel);
    if (!idx) return;
    var wrapRect = wrap.getBoundingClientRect();
    function rectFor(rMin, rMax, cMin, cMax) {
      var tdA = cellTd(idx.rowIds[rMin], idx.colKeys[cMin]);
      var tdB = cellTd(idx.rowIds[rMax], idx.colKeys[cMax]);
      if (!tdA || !tdB) return null;
      var a = tdA.getBoundingClientRect(), b = tdB.getBoundingClientRect();
      return {
        left: (a.left - wrapRect.left) + wrap.scrollLeft,
        top: (a.top - wrapRect.top) + wrap.scrollTop,
        width: (b.right - a.left),
        height: (b.bottom - a.top)
      };
    }
    [].forEach.call(wrap.querySelectorAll('tbody tr[data-id]'), function (tr, ri) {
      if (ri < idx.rMin || ri > idx.rMax) return;
      state.columns.forEach(function (c, ci) {
        if (ci < idx.cMin || ci > idx.cMax) return;
        var td = tr.querySelector('td[data-col="' + c.key + '"]');
        if (td) td.classList.add('cellsel-in');
      });
    });
    var r = rectFor(idx.rMin, idx.rMax, idx.cMin, idx.cMax);
    if (!r) return;
    var box = document.createElement('div');
    box.className = 'cellsel-box';
    box.style.left = r.left + 'px'; box.style.top = r.top + 'px'; box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
    wrap.appendChild(box);
    if (previewIdx) {
      var pr = rectFor(previewIdx.rMin, previewIdx.rMax, previewIdx.cMin, previewIdx.cMax);
      if (pr) {
        var pv = document.createElement('div');
        pv.className = 'cellsel-fillpreview';
        pv.style.left = pr.left + 'px'; pv.style.top = pr.top + 'px'; pv.style.width = pr.width + 'px'; pv.style.height = pr.height + 'px';
        wrap.appendChild(pv);
      }
    } else {
      var handle = document.createElement('div');
      handle.className = 'cellsel-handle';
      handle.title = t('fillHandleHint');
      handle.style.left = (r.left + r.width) + 'px'; handle.style.top = (r.top + r.height) + 'px';
      /* pointerdown (ไม่ใช่ mousedown) เพื่อให้ลากด้วยนิ้วบนมือถือ/แท็บเล็ตได้ด้วย ไม่ใช่แค่เมาส์ —
         setPointerCapture กันไม่ให้ event หลุดถ้านิ้วเลื่อนออกจากจุดเล็กๆ นี้ระหว่างลากเร็วๆ */
      handle.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        try { handle.setPointerCapture(e.pointerId); } catch (err) {}
        startFillDrag(idx);
      });
      wrap.appendChild(handle);
    }
  }
  function wireCellSelection() {
    [].forEach.call($('dataTable').querySelectorAll('td[data-id][data-col]'), function (td) {
      td.addEventListener('pointerdown', function (e) {
        var id = +td.getAttribute('data-id'), col = td.getAttribute('data-col');
        if (e.shiftKey && state.cellSel) {
          state.cellSel = { id0: state.cellSel.id0, col0: state.cellSel.col0, id1: id, col1: col };
          e.preventDefault();
        } else {
          state.cellSel = { id0: id, col0: col, id1: id, col1: col };
        }
        renderCellSelOverlay();
      });
    });
  }

  /* ══════════════════ นำทางด้วยคีย์บอร์ด (ลูกศร/Tab/Enter) แบบ Excel ══════════════════
     ทำงานบนแถวที่แสดงอยู่ในหน้าปัจจุบันเท่านั้น (ไม่ข้ามหน้า/เพจจิ้ง) — กดที่ขอบตารางแล้วไม่ไปต่อถือว่า
     "ชนขอบ" เฉยๆ ตามพฤติกรรม spreadsheet ทั่วไปที่หยุดที่ขอบชีต/หน้าที่มองเห็น ไม่ใช่ error */
  function tableGridCoords(td) {
    var trs = [].slice.call($('dataTable').querySelectorAll('tbody tr[data-id]'));
    var ri = -1;
    for (var i = 0; i < trs.length; i++) { if (+trs[i].getAttribute('data-id') === +td.getAttribute('data-id')) { ri = i; break; } }
    var colKeys = state.columns.map(function (c) { return c.key; });
    var ci = colKeys.indexOf(td.getAttribute('data-col'));
    return { trs: trs, colKeys: colKeys, ri: ri, ci: ci };
  }
  function focusCellInput(rowEl, colKey) {
    var td = rowEl.querySelector('td[data-col="' + colKey + '"]');
    var inp = td && td.querySelector('.cell-in');
    if (!inp) return false;
    inp.focus();
    try { inp.select(); } catch (e) {} // เข้าเซลล์ใหม่แล้วเลือกข้อความทั้งหมดไว้ พิมพ์ต่อได้ทันทีแบบ Excel
    return true;
  }
  function caretAtStart(inp) { try { return inp.selectionStart === 0 && inp.selectionEnd === 0; } catch (e) { return true; } }
  function caretAtEnd(inp) { try { return inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length; } catch (e) { return true; } }
  function moveActiveCell(fromTd, dRow, dCol, extend) {
    var g = tableGridCoords(fromTd);
    if (g.ri === -1 || g.ci === -1) return;
    var nri = Math.max(0, Math.min(g.trs.length - 1, g.ri + dRow));
    var nci = Math.max(0, Math.min(g.colKeys.length - 1, g.ci + dCol));
    if (nri === g.ri && nci === g.ci) return;
    var targetTr = g.trs[nri], targetKey = g.colKeys[nci], targetId = +targetTr.getAttribute('data-id');
    if (extend && state.cellSel) state.cellSel = { id0: state.cellSel.id0, col0: state.cellSel.col0, id1: targetId, col1: targetKey };
    else state.cellSel = { id0: targetId, col0: targetKey, id1: targetId, col1: targetKey };
    focusCellInput(targetTr, targetKey);
    renderCellSelOverlay();
  }
  /* Tab/Shift+Tab ไล่ตามคอลัมน์แล้ววนขึ้น/ลงแถวถัดไปเมื่อชนขอบซ้าย/ขวา (เหมือน Excel/Sheets) — ไม่ขยาย
     การเลือกหลายเซลล์ (ยุบเหลือเซลล์เดียวเสมอ ต่างจากลูกศร+Shift ที่ขยายช่วงได้) */
  function tabMove(fromTd, forward) {
    var g = tableGridCoords(fromTd);
    if (g.ri === -1 || g.ci === -1) return;
    var nci = g.ci + (forward ? 1 : -1), nri = g.ri;
    if (nci >= g.colKeys.length) { nci = 0; nri++; }
    else if (nci < 0) { nci = g.colKeys.length - 1; nri--; }
    if (nri < 0 || nri >= g.trs.length) return;
    var targetTr = g.trs[nri], targetKey = g.colKeys[nci], targetId = +targetTr.getAttribute('data-id');
    state.cellSel = { id0: targetId, col0: targetKey, id1: targetId, col1: targetKey };
    focusCellInput(targetTr, targetKey);
    renderCellSelOverlay();
  }
  function wireCellKeyboardNav() {
    [].forEach.call($('dataTable').querySelectorAll('td[data-id][data-col] .cell-in'), function (inp) {
      inp.addEventListener('keydown', function (e) {
        var td = inp.closest('td[data-id][data-col]');
        if (!td) return;
        var isText = inp.type === 'text';
        if (e.key === 'ArrowUp') { e.preventDefault(); moveActiveCell(td, -1, 0, e.shiftKey); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); moveActiveCell(td, 1, 0, e.shiftKey); }
        /* ลูกศรซ้าย/ขวา: ทำเฉพาะคอลัมน์ข้อความ และเฉพาะตอน caret ชนขอบค่าในเซลล์แล้วเท่านั้น กันชนกับการ
           เลื่อน caret ปกติกลางข้อความ / ไม่ยุ่งกับ input type=number,date ที่มีความหมายของลูกศรซ้ายขวาเอง */
        else if (e.key === 'ArrowLeft' && isText && caretAtStart(inp)) { e.preventDefault(); moveActiveCell(td, 0, -1, e.shiftKey); }
        else if (e.key === 'ArrowRight' && isText && caretAtEnd(inp)) { e.preventDefault(); moveActiveCell(td, 0, 1, e.shiftKey); }
        else if (e.key === 'Tab') { e.preventDefault(); tabMove(td, !e.shiftKey); }
        else if (e.key === 'Enter') { e.preventDefault(); moveActiveCell(td, e.shiftKey ? -1 : 1, 0, false); }
      });
    });
  }

  /* ══════════════════ Copy/Paste แบบ Excel (Ctrl+C / Ctrl+V) ══════════════════
     ทำงานเฉพาะตอนโฟกัสอยู่ที่ input ของเซลล์ตาราง (.cell-in) เท่านั้น ถ้าผู้ใช้ลากเลือกข้อความบางส่วน
     ภายในเซลล์เดียวอยู่ (ไม่ใช่การเลือกหลายเซลล์แบบตารางของเรา) ปล่อยให้ browser คัดลอก/แปะทับส่วนที่เลือกนั้น
     ตามปกติ — กรณีอื่นทั้งหมด (คลิกเลือกเซลล์เฉยๆ ไม่มีข้อความถูกไฮไลต์) ให้ระบบแปะแบบตารางจัดการเสมอ แม้จะ
     แปะแค่ค่าเดียวไม่มี tab/newline ก็ตาม (นับเป็น grid 1x1) เพื่อให้ "แทนที่ทั้งเซลล์" แบบ Excel จริงๆ — ถ้า
     ปล่อยให้ input จัดการเองจะกลายเป็น "แทรกที่ตำแหน่ง caret" แทน "แทนที่ทั้งเซลล์" ซึ่งไม่ตรงพฤติกรรมที่ต้องการ */
  function cellHasPartialTextSelection(inp) {
    try { return inp.selectionStart !== inp.selectionEnd; } catch (e) { return false; }
  }
  function buildTsvFromSelection(idx) {
    var lines = [];
    for (var ri = idx.rMin; ri <= idx.rMax; ri++) {
      var row = state.rows.filter(function (rr) { return rr.__id === idx.rowIds[ri]; })[0];
      var cells = [];
      for (var ci = idx.cMin; ci <= idx.cMax; ci++) {
        var colKey = idx.colKeys[ci];
        var col = state.columns.filter(function (c) { return c.key === colKey; })[0];
        cells.push(cellEditValue(row ? row[colKey] : null, col ? col.type : 'text'));
      }
      lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  }
  function parseTsv(text) {
    var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop(); // ตัดบรรทัดว่างท้ายที่เกิดจากการ copy
    return lines.map(function (line) { return line.split('\t'); });
  }
  /* แปะข้อมูล grid (แถว x คอลัมน์) โดยยึด td ที่โฟกัสอยู่เป็นมุมบนซ้าย ไล่ขวา/ลงจากจุดนั้น
     คอลัมน์: หยุดที่คอลัมน์สุดท้ายที่มีอยู่ (ไม่สร้างคอลัมน์ใหม่ให้อัตโนมัติ ค่าที่เกินขอบขวาจะถูกทิ้งไปเงียบๆ)
     แถว: ถ้า grid ที่แปะยาวเกินจำนวนแถวที่เหลือในหน้านี้ จะเพิ่มแถวใหม่ต่อท้ายชุดข้อมูลทั้งหมดให้พอ (เหมือนกด
     "+เพิ่มแถว" ซ้ำๆ) แล้วล้างตัวกรอง/คำค้นเดิมทิ้งแบบเดียวกับ addRow() กันแถวใหม่โดนกรองซ่อนจนดูเหมือนแปะไม่ติด */
  function pasteGridAt(anchorTd, grid) {
    var trs = [].slice.call($('dataTable').querySelectorAll('tbody tr[data-id]'));
    var anchorRi = -1;
    for (var i = 0; i < trs.length; i++) { if (+trs[i].getAttribute('data-id') === +anchorTd.getAttribute('data-id')) { anchorRi = i; break; } }
    var colKeys = state.columns.map(function (c) { return c.key; });
    var anchorCi = colKeys.indexOf(anchorTd.getAttribute('data-col'));
    if (anchorRi === -1 || anchorCi === -1 || !grid.length) return;
    pushHistory();
    var targetRows = [], addedNew = false;
    for (var g = 0; g < grid.length; g++) {
      if (anchorRi + g < trs.length) {
        var id = +trs[anchorRi + g].getAttribute('data-id');
        targetRows.push(state.rows.filter(function (r) { return r.__id === id; })[0]);
      } else {
        var newRow = { __id: state.nextRowId++ };
        state.columns.forEach(function (col) { newRow[col.key] = null; });
        state.rows.push(newRow);
        targetRows.push(newRow);
        addedNew = true;
      }
    }
    var touchedCols = {};
    grid.forEach(function (line, gi) {
      var row = targetRows[gi];
      if (!row) return;
      for (var c = 0; c < line.length; c++) {
        var ci = anchorCi + c;
        if (ci >= colKeys.length) break;
        var colKey = colKeys[ci];
        var col = state.columns.filter(function (cc) { return cc.key === colKey; })[0];
        row[colKey] = coerceCellValue(col, line[c]);
        touchedCols[colKey] = true;
      }
    });
    Object.keys(touchedCols).forEach(function (colKey) {
      var col = state.columns.filter(function (c) { return c.key === colKey; })[0];
      if (col) col.type = inferColumnType(state.rows.map(function (r) { return r[colKey]; }));
    });
    if (addedNew) { state.filters = {}; state.globalQuery = ''; $('globalSearch').value = ''; }
    var lastRow = targetRows[targetRows.length - 1];
    var lastColKey = colKeys[Math.min(anchorCi + (grid[0] ? grid[0].length : 1) - 1, colKeys.length - 1)];
    if (lastRow) state.cellSel = { id0: +anchorTd.getAttribute('data-id'), col0: anchorTd.getAttribute('data-col'), id1: lastRow.__id, col1: lastColKey };
    renderTable();
    persistDebounced();
  }
  function wireTableCopyPaste() {
    document.addEventListener('copy', function (e) {
      var active = document.activeElement;
      if (!active || !active.classList || !active.classList.contains('cell-in')) return;
      if (cellHasPartialTextSelection(active)) return;
      if (!state.cellSel) return;
      var idx = cellSelToIndices(state.cellSel);
      if (!idx) return;
      e.clipboardData.setData('text/plain', buildTsvFromSelection(idx));
      e.preventDefault();
    });
    document.addEventListener('paste', function (e) {
      var active = document.activeElement;
      if (!active || !active.classList || !active.classList.contains('cell-in')) return;
      if (cellHasPartialTextSelection(active)) return; // มีข้อความถูกเลือกบางส่วนอยู่ -> ปล่อยให้แปะทับส่วนนั้นแบบ input ปกติ
      var text = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (text == null) return;
      var anchorTd = active.closest('td[data-id][data-col]');
      if (!anchorTd) return;
      e.preventDefault();
      pasteGridAt(anchorTd, parseTsv(text)); // ค่าเดียวไม่มี tab/newline ก็กลายเป็น grid 1x1 พอดี
    });
  }
  /* รายการ "built-in list" ที่ Excel รู้จักเอง (วัน/เดือน ทั้งไทย+อังกฤษ ทั้งเต็ม+ย่อ) — ลากเซลล์ที่มีค่า
     ตรงกับรายการใดรายการหนึ่งจะไล่ต่อในรายการนั้นแทนการวนซ้ำเฉยๆ (เช่น "จันทร์" ลากลง -> "อังคาร","พุธ",...) */
  var FILL_LISTS = [
    ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'],
    ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'],
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
    ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
    ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  ];
  function normFillStr(v) { return String(v == null ? '' : v).trim(); }
  function findListIndices(list, srcVals) {
    var idxs = srcVals.map(function (v) {
      var nv = normFillStr(v), lower = nv.toLowerCase();
      for (var li = 0; li < list.length; li++) { if (list[li] === nv || list[li].toLowerCase() === lower) return li; }
      return -1;
    });
    return idxs.every(function (x) { return x !== -1; }) ? idxs : null;
  }
  /* ไล่ต่อ/วนซ้ำใน built-in list (วัน/เดือน) — คืน undefined ถ้าค่าที่เลือกไม่ตรงลิสต์ไหนเลย ให้ตกไปเช็ค
     เงื่อนไขอื่นต่อ (ไม่ใช่ error แค่ "ไม่ใช่กรณีนี้") */
  function builtInListStep(srcVals, i, invert) {
    var n = srcVals.length;
    for (var li = 0; li < FILL_LISTS.length; li++) {
      var list = FILL_LISTS[li], idxs = findListIndices(list, srcVals);
      if (!idxs) continue;
      var L = list.length;
      if (n === 1) return invert ? srcVals[0] : list[((idxs[0] + i) % L + L) % L];
      if (invert) return srcVals[((i % n) + n) % n];
      var diffs = []; for (var k = 1; k < n; k++) diffs.push(idxs[k] - idxs[k - 1]);
      var step = Math.round(diffs.reduce(function (a, b) { return a + b; }, 0) / diffs.length);
      return list[((idxs[0] + step * i) % L + L) % L];
    }
    return undefined;
  }
  /* จับ "ข้อความ + เลขต่อท้าย" (เช่น "Item 1", "WO001") แยกส่วนคงที่ (prefix) กับตัวเลขท้ายสุด */
  function parseTrailingNumber(v) {
    var m = /^(.*?)(\d+)$/.exec(normFillStr(v));
    return m ? { prefix: m[1], width: m[2].length, num: parseInt(m[2], 10) } : null;
  }
  /* ไล่เลขต่อท้ายข้อความ (เช่น "Item 1" -> "Item 2","Item 3") คงจำนวนหลัก/เลข 0 นำหน้าของค่าต้นฉบับไว้
     คืน undefined ถ้าค่าที่เลือกไม่ใช่ pattern นี้ (ไม่มีเลขต่อท้าย หรือส่วนคงที่ไม่ตรงกันทุกเซลล์) */
  function trailingNumberStep(srcVals, i, invert) {
    var n = srcVals.length, parsed = srcVals.map(parseTrailingNumber);
    if (parsed.some(function (p) { return !p; })) return undefined;
    var prefix = parsed[0].prefix;
    if (!parsed.every(function (p) { return p.prefix === prefix; })) return undefined;
    var width = parsed[0].width;
    function fmt(num) {
      var s = String(Math.abs(num));
      if (s.length < width) s = '0'.repeat(width - s.length) + s;
      return prefix + (num < 0 ? '-' + s : s);
    }
    if (n === 1) return invert ? srcVals[0] : fmt(parsed[0].num + i);
    if (invert) return srcVals[((i % n) + n) % n];
    var diffs = []; for (var k = 1; k < n; k++) diffs.push(parsed[k].num - parsed[k - 1].num);
    var step = Math.round(diffs.reduce(function (a, b) { return a + b; }, 0) / diffs.length);
    return fmt(parsed[0].num + step * i);
  }
  /* คำนวณค่าที่จะเติมของ "เส้น" หนึ่งเส้น (คอลัมน์เดียวตอนลากขึ้น/ลง หรือแถวเดียวตอนลากซ้าย/ขวา) —
     srcVals คือค่าต้นฉบับที่เลือกไว้ก่อนลาก (เรียงจากตำแหน่งน้อยไปมาก), i คือตำแหน่งของเซลล์ที่จะเติม
     เทียบกับเซลล์แรกของ srcVals (0 = ตำแหน่งเซลล์แรก, ค่าลบ = ก่อนหน้า/ด้านบน, ทวนจากจุดนั้น)
     invert = กด Ctrl/Cmd ค้างระหว่างลากอยู่หรือไม่ — สลับพฤติกรรมปกติเป็นตรงข้าม แบบเดียวกับ Excel จริง:
     ค่าเดียว ปกติ=ซ้ำเดิม กด Ctrl=ไล่เลข/ลิสต์ต่อ | หลายค่าที่เป็นลำดับ ปกติ=ไล่ต่อ กด Ctrl=คัดลอกวนซ้ำชุดเดิม */
  function fillLineValue(srcVals, i, colType, invert) {
    var n = srcVals.length;
    var allNum = colType === 'number' && srcVals.every(function (v) { return typeof v === 'number' && isFinite(v); });
    if (allNum) {
      if (n === 1) return invert ? srcVals[0] + i : srcVals[0];
      if (invert) return srcVals[((i % n) + n) % n];
      /* ตัวเลข 2 เซลล์ขึ้นไป -> ไล่ตามสูตรเส้นตรง step = ค่าเฉลี่ยผลต่างระหว่างเซลล์ที่ติดกัน (2 เซลล์ =
         ไล่ตามผลต่างนั้นตรงๆ รวมถึงกรณีค่าเท่ากันทั้งคู่ -> step เป็น 0 -> ซ้ำค่าเดิมไปเรื่อยๆ ตามที่ต้องการ) */
      var diffs = []; for (var k = 1; k < n; k++) diffs.push(srcVals[k] - srcVals[k - 1]);
      var step = diffs.reduce(function (a, b) { return a + b; }, 0) / diffs.length;
      return srcVals[0] + step * i;
    }
    if (colType === 'date' && srcVals.every(function (v) { return v instanceof Date && !isNaN(v); })) {
      if (n === 1) return invert ? new Date(srcVals[0].getTime() + i * 86400000) : srcVals[0];
      if (invert) return new Date(srcVals[((i % n) + n) % n].getTime());
      var dayDiffs = []; for (var k2 = 1; k2 < n; k2++) dayDiffs.push((srcVals[k2] - srcVals[k2 - 1]) / 86400000);
      var dayStep = dayDiffs.reduce(function (a, b) { return a + b; }, 0) / dayDiffs.length;
      return new Date(srcVals[0].getTime() + dayStep * i * 86400000);
    }
    var listResult = builtInListStep(srcVals, i, invert);
    if (listResult !== undefined) return listResult;
    var suffixResult = trailingNumberStep(srcVals, i, invert);
    if (suffixResult !== undefined) return suffixResult;
    if (n === 1) return srcVals[0]; // ข้อความล้วนไม่มี pattern ให้ไล่ -> คัดลอกซ้ำเสมอ (invert ไม่มีผล)
    /* ข้อความ/ค่าผสมที่ไม่เข้าเงื่อนไขพิเศษใดๆ -> วนซ้ำชุดเดิมเป็นรอบๆ ตามตำแหน่ง (mod รองรับเลขลบด้วย) */
    return srcVals[((i % n) + n) % n];
  }
  function startFillDrag(originIdx) {
    var origin = { rMin: originIdx.rMin, rMax: originIdx.rMax, cMin: originIdx.cMin, cMax: originIdx.cMax, rowIds: originIdx.rowIds, colKeys: originIdx.colKeys };
    fillDrag = { origin: origin };
    function onMove(e) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var td = el && el.closest ? el.closest('td[data-id][data-col]') : null;
      if (!td) return;
      var ri = origin.rowIds.indexOf(+td.getAttribute('data-id'));
      var ci = origin.colKeys.indexOf(td.getAttribute('data-col'));
      if (ri === -1 || ci === -1) return;
      var rBelow = ri - origin.rMax, rAbove = origin.rMin - ri, cRight = ci - origin.cMax, cLeft = origin.cMin - ci;
      var maxExt = Math.max(rBelow, rAbove, cRight, cLeft, 0);
      var preview = { rMin: origin.rMin, rMax: origin.rMax, cMin: origin.cMin, cMax: origin.cMax };
      if (maxExt <= 0) { fillDrag.dir = null; fillDrag.target = null; renderCellSelOverlay(); return; }
      if (maxExt === rBelow) { fillDrag.dir = 'down'; preview.rMax = ri; }
      else if (maxExt === rAbove) { fillDrag.dir = 'up'; preview.rMin = ri; }
      else if (maxExt === cRight) { fillDrag.dir = 'right'; preview.cMax = ci; }
      else { fillDrag.dir = 'left'; preview.cMin = ci; }
      fillDrag.target = preview;
      renderCellSelOverlay(preview);
    }
    function onUp(e) {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      /* กด Ctrl (หรือ Cmd บน Mac) ค้างไว้ตอนปล่อยนิ้ว/เมาส์ = สลับพฤติกรรมไล่ต่อ/คัดลอกซ้ำ แบบเดียวกับ
         Excel จริง — เช็คที่ตอนปล่อย (ไม่ใช่ตอนเริ่มลาก) เพราะกดปล่อย Ctrl ระหว่างลากได้เหมือน Excel */
      var invert = !!(e && (e.ctrlKey || e.metaKey));
      if (fillDrag && fillDrag.dir && fillDrag.target) applyFillDrag(fillDrag.origin, fillDrag.dir, fillDrag.target, invert);
      fillDrag = null;
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }
  function applyFillDrag(origin, dir, target, invert) {
    pushHistory();
    var vertical = dir === 'down' || dir === 'up';
    if (vertical) {
      for (var ci = origin.cMin; ci <= origin.cMax; ci++) {
        var colKey = origin.colKeys[ci];
        var col = state.columns.filter(function (c) { return c.key === colKey; })[0];
        var srcVals = [];
        for (var ri = origin.rMin; ri <= origin.rMax; ri++) {
          var r = state.rows.filter(function (rr) { return rr.__id === origin.rowIds[ri]; })[0];
          srcVals.push(r ? r[colKey] : null);
        }
        if (dir === 'down') {
          for (var rd = origin.rMax + 1; rd <= target.rMax; rd++) {
            var rowD = state.rows.filter(function (rr) { return rr.__id === origin.rowIds[rd]; })[0];
            if (rowD) rowD[colKey] = fillLineValue(srcVals, rd - origin.rMin, col ? col.type : 'text', invert);
          }
        } else {
          for (var ru = target.rMin; ru < origin.rMin; ru++) {
            var rowU = state.rows.filter(function (rr) { return rr.__id === origin.rowIds[ru]; })[0];
            if (rowU) rowU[colKey] = fillLineValue(srcVals, ru - origin.rMin, col ? col.type : 'text', invert);
          }
        }
        if (col) col.type = inferColumnType(state.rows.map(function (rr) { return rr[colKey]; }));
      }
    } else {
      for (var ri2 = origin.rMin; ri2 <= origin.rMax; ri2++) {
        var rowId = origin.rowIds[ri2];
        var row = state.rows.filter(function (rr) { return rr.__id === rowId; })[0];
        if (!row) continue;
        var srcVals2 = [];
        for (var ci2 = origin.cMin; ci2 <= origin.cMax; ci2++) srcVals2.push(row[origin.colKeys[ci2]]);
        if (dir === 'right') {
          for (var cr = origin.cMax + 1; cr <= target.cMax; cr++) {
            var colR = state.columns.filter(function (c) { return c.key === origin.colKeys[cr]; })[0];
            row[origin.colKeys[cr]] = fillLineValue(srcVals2, cr - origin.cMin, colR ? colR.type : 'text', invert);
          }
        } else {
          for (var cl = target.cMin; cl < origin.cMin; cl++) {
            var colL = state.columns.filter(function (c) { return c.key === origin.colKeys[cl]; })[0];
            row[origin.colKeys[cl]] = fillLineValue(srcVals2, cl - origin.cMin, colL ? colL.type : 'text', invert);
          }
        }
      }
      for (var cc = target.cMin; cc <= target.cMax; cc++) {
        var colKeyC = origin.colKeys[cc];
        var colC = state.columns.filter(function (c) { return c.key === colKeyC; })[0];
        if (colC) colC.type = inferColumnType(state.rows.map(function (rr) { return rr[colKeyC]; }));
      }
    }
    state.cellSel = { id0: origin.rowIds[target.rMin], col0: origin.colKeys[target.cMin], id1: origin.rowIds[target.rMax], col1: origin.colKeys[target.cMax] };
    renderTable();
    persistDebounced();
    /* renderTable() ข้างบนเรียก renderCellSelOverlay() ซึ่งล้างปุ่ม autofill เก่าทิ้งไปแล้วเป็นส่วนหนึ่ง
       ของการ cleanup ปกติ — วาดปุ่มใหม่ทีหลังสุดตรงนี้เสมอ กันโดนล้างตามไปด้วย */
    renderAutoFillOptionsBtn(origin, dir, target, invert);
  }
  /* ปุ่ม "ตัวเลือกเติมอัตโนมัติ" ลอยที่มุมล่างขวาของพื้นที่ที่เพิ่งเติม — ทางเลือกที่ใช้ได้ทั้งเมาส์/สัมผัส
     (ต่างจากปุ่ม Ctrl ที่ใช้ได้เฉพาะตอนมีคีย์บอร์ดจริง) แตะแล้วเลือกสลับ "ไล่ต่อ" หรือ "ทำซ้ำ" ย้อนหลังได้
     ทันที โดยไม่ต้องลากใหม่ — เลียนแบบปุ่ม AutoFill Options ตัวจริงของ Excel ที่โผล่หลังลาก/แปะทุกครั้ง */
  var lastFillOp = null;
  function renderAutoFillOptionsBtn(origin, dir, target, invert) {
    lastFillOp = { origin: origin, dir: dir, target: target, invert: invert };
    var wrap = $('dataTableWrap');
    var vertical = dir === 'down' || dir === 'up';
    var rMin = vertical ? target.rMin : origin.rMin, rMax = vertical ? target.rMax : origin.rMax;
    var cMin = vertical ? origin.cMin : target.cMin, cMax = vertical ? origin.cMax : target.cMax;
    var tdB = cellTd(origin.rowIds[rMax], origin.colKeys[cMax]);
    if (!tdB) return;
    var wrapRect = wrap.getBoundingClientRect(), b = tdB.getBoundingClientRect();
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cellsel-autofill-btn';
    btn.title = t('autoFillOptionsHint');
    btn.textContent = '⚙️';
    btn.style.left = ((b.right - wrapRect.left) + wrap.scrollLeft - 4) + 'px';
    btn.style.top = ((b.bottom - wrapRect.top) + wrap.scrollTop - 4) + 'px';
    btn.addEventListener('click', function (e) { e.stopPropagation(); openAutoFillOptionsPopover(btn); });
    wrap.appendChild(btn);
  }
  function openAutoFillOptionsPopover(anchorEl) {
    if (!lastFillOp) return;
    var op = lastFillOp;
    var html = '<div class="fp-title">' + escapeHtml(t('autoFillOptionsTitle')) + '</div>' +
      '<div class="fp-list">' +
      '<div class="fp-item" data-mode="series"><span>📈 ' + escapeHtml(t('autoFillSeriesOpt')) + '</span></div>' +
      '<div class="fp-item" data-mode="copy"><span>🔁 ' + escapeHtml(t('autoFillCopyOpt')) + '</span></div>' +
      '</div>';
    openPopover(html, anchorEl, function (el, close) {
      [].forEach.call(el.querySelectorAll('.fp-item'), function (item) {
        item.addEventListener('click', function () {
          var wantSeries = item.getAttribute('data-mode') === 'series';
          var vertical = op.dir === 'down' || op.dir === 'up';
          /* n=1 (แหล่งต้นฉบับมีเซลล์เดียว): ปกติ=ทำซ้ำ, invert=ไล่ต่อ (สลับกับกรณี n>=2 พอดี) —
             แปลงความหมาย "ไล่ต่อ/ทำซ้ำ" ที่ผู้ใช้เลือกจากเมนู ให้เป็นค่า invert ที่ถูกต้องเสมอ ไม่ว่า n
             จะเป็นเท่าไหร่ ผู้ใช้เลือกจากผลลัพธ์ที่ต้องการตรงๆ ไม่ต้องรู้ความหมายของปุ่ม Ctrl เลย */
          var n = vertical ? (op.origin.rMax - op.origin.rMin + 1) : (op.origin.cMax - op.origin.cMin + 1);
          var invertToApply = (n === 1) ? wantSeries : !wantSeries;
          applyFillDrag(op.origin, op.dir, op.target, invertToApply);
          close();
        });
      });
    });
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
    },
    finance: {
      income: { w: 3, kw: ['รายรับ', 'รายได้', 'income', 'revenue'] },
      expense: { w: 3, kw: ['รายจ่าย', 'ค่าใช้จ่าย', 'expense', 'cost', 'spending'] },
      amount: { w: 2, kw: ['จำนวนเงิน', 'ยอดเงิน', 'มูลค่า', 'amount'] },
      txntype: { w: 2, kw: ['ประเภทรายการ', 'ประเภทธุรกรรม', 'transactiontype'] },
      category: { w: 2, kw: ['หมวดหมู่', 'category'] },
      date: { w: 1, kw: ['date', 'วันที่'] },
      account: { w: 1, kw: ['บัญชี', 'ช่องทาง', 'account', 'วิธีชำระ', 'paymentmethod'] },
      description: { w: 1, kw: ['รายละเอียด', 'คำอธิบาย', 'description', 'note'] }
    },
    reading: {
      pages: { w: 3, kw: ['จำนวนหน้า', 'pages', 'pagecount'] },
      finishdate: { w: 3, kw: ['วันที่อ่านจบ', 'อ่านจบ', 'finishdate', 'datefinished', 'completeddate'] },
      booktitle: { w: 2, kw: ['ชื่อหนังสือ', 'ชื่อเรื่อง', 'booktitle', 'title'] },
      genre: { w: 2, kw: ['แนวหนังสือ', 'ประเภทหนังสือ', 'หมวดหมู่', 'genre'] },
      rating: { w: 2, kw: ['คะแนน', 'ให้ดาว', 'rating'] },
      author: { w: 1, kw: ['ผู้แต่ง', 'นักเขียน', 'author'] },
      startdate: { w: 1, kw: ['วันที่เริ่มอ่าน', 'เริ่มอ่าน', 'startdate', 'datestarted'] },
      status: { w: 1, kw: ['สถานะ', 'status'] }
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
    ['maintenance', 'project', 'legal', 'risk', 'finance', 'reading'].forEach(function (id) {
      var m = matchDomainRoles(state.columns, DOMAIN_ROLES[id]);
      if (m.score >= DOMAIN_MIN_SCORE && (!best || m.score > best.score)) best = { id: id, roles: m.roles, score: m.score };
    });
    return best;
  }
  /* ══════════════════ ปรับสีการ์ด/กล่อง (แท็บ "แดชบอร์ด" + "กำหนดเอง") ══════════════════
     state.cardColors[role] = {bg, accent, gradient} — role คือชื่อบทบาทการ์ด ไม่ผูกกับแม่แบบที่กำลังเปิดอยู่
     (เช่น role "domainChart1" ใช้สีเดียวกันไม่ว่าจะสลับไปแม่แบบซ่อมบำรุง/โครงการ/อื่นๆ) เพื่อไม่ต้องเก็บสี
     แยกทีละแม่แบบ — ผู้ใช้ตั้งสีการ์ด "กราฟที่ 1" ไว้ครั้งเดียว ใช้ได้กับทุกแม่แบบที่มีกราฟที่ 1 */
  function shadeColor(hex, percent) {
    /* ผสมสีเข้าหาขาว (percent บวก = สว่างขึ้น) ใช้คำนวณสีคู่ไล่เฉด (gradient) จากสีเดียวที่ผู้ใช้เลือก */
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    var f = parseInt(m[1], 16), t = 255, p = Math.max(0, Math.min(1, percent));
    var R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
    return '#' + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
  }
  /* แถวสวอตช์สีสำเร็จรูป (แบบเดียวกับปุ่ม "สีเติม" ใน Excel ที่กดครั้งเดียวแล้วใช้เลย) — เพิ่มมาคู่กับ
     <input type="color"> เดิม (ยังใช้เลือกสีเองแบบละเอียดได้ตามปกติ) เพราะแตะ/คลิกสวอตช์ครั้งเดียวจบ
     เชื่อถือได้แน่นอนกว่าบนอุปกรณ์สัมผัส ต่างจาก native color picker ที่บางเบราว์เซอร์/อุปกรณ์ต้องกด 2
     จังหวะ (เปิดตัวเลือกสี -> ปิด -> กด "ใช้สีนี้" อีกที) ทำให้ดูเหมือน "กดแล้วไม่มีอะไรเกิดขึ้น" */
  var COLOR_SWATCHES = ['#E53935', '#FB8C00', '#FDD835', '#7CB342', '#00897B', '#1E88E5', '#3949AB', '#8E24AA', '#D81B60', '#6D4C41', '#9E9E9E', '#263238'];
  function colorSwatchRowHtml(rowClass) {
    return '<div class="color-swatch-row ' + rowClass + '">' + COLOR_SWATCHES.map(function (hex) {
      return '<button type="button" class="color-swatch" data-hex="' + hex + '" style="background:' + hex + '" title="' + hex + '"></button>';
    }).join('') + '</div>';
  }
  /* onPick(hex) รับค่า hex ที่แตะไป — ปล่อยให้ผู้เรียกตัดสินใจเองว่าจะ apply+ปิด popover ทันที (จุดที่
     popover ทั้งกล่องมีหน้าที่ปรับสีอย่างเดียว) หรือแค่เซ็ตค่าไว้เฉยๆ (จุดที่ต้องกดปุ่ม Apply รวมของ
     popover ใหญ่กว่าอีกที เพราะมีฟิลด์อื่นให้ปรับร่วมด้วย) */
  function wireColorSwatchRow(el, rowSel, inputSel, onPick) {
    [].forEach.call(el.querySelectorAll(rowSel + ' .color-swatch'), function (btn) {
      btn.addEventListener('click', function () {
        var hex = btn.getAttribute('data-hex');
        var inp = el.querySelector(inputSel);
        if (inp) inp.value = hex;
        if (onPick) onPick(hex);
      });
    });
  }
  function cardColorAccent(role) { return (state.cardColors[role] && state.cardColors[role].accent) || '#1E9E5A'; }
  function applyCardColor(elId, role) {
    var el = $(elId);
    if (!el) return;
    var cfg = state.cardColors[role];
    if (!cfg || !cfg.bg) { el.style.background = ''; return; }
    el.style.background = cfg.gradient ? ('linear-gradient(135deg,' + cfg.bg + ',' + shadeColor(cfg.bg, 0.4) + ')') : cfg.bg;
  }
  function openCardColorPopover(role, anchorEl, onApply) {
    var cur = state.cardColors[role] || {};
    var html = '<div class="fp-title">' + escapeHtml(t('cardColorTitle')) + '</div>' +
      '<div class="fp-range">' +
      '<label>' + escapeHtml(t('cardBgColorLbl')) + '</label>' + colorSwatchRowHtml('cc-bg-row') +
      '<label><input type="color" class="cc-bg" value="' + (cur.bg || '#ffffff') + '"> ' + escapeHtml(t('moreColorsLbl')) + '</label>' +
      '<label class="cc-checkrow"><input type="checkbox" class="cc-grad"' + (cur.gradient ? ' checked' : '') + '> ' + escapeHtml(t('cardGradientLbl')) + '</label>' +
      '<label>' + escapeHtml(t('cardAccentColorLbl')) + '</label>' + colorSwatchRowHtml('cc-accent-row') +
      '<label><input type="color" class="cc-accent" value="' + (cur.accent || '#1E9E5A') + '"> ' + escapeHtml(t('moreColorsLbl')) + '</label>' +
      '</div>' +
      '<div class="fp-actions"><button type="button" class="btn sm ghost cc-reset">' + escapeHtml(t('cardColorResetBtn')) + '</button>' +
      '<div class="fp-btns"><button type="button" class="btn sm fp-apply">' + escapeHtml(t('filterApplyBtn')) + '</button></div></div>';
    openPopover(html, anchorEl, function (el, close) {
      function doApply() {
        state.cardColors[role] = { bg: el.querySelector('.cc-bg').value, gradient: el.querySelector('.cc-grad').checked, accent: el.querySelector('.cc-accent').value };
        onApply();
        persistDebounced();
      }
      el.querySelector('.cc-reset').addEventListener('click', function () { delete state.cardColors[role]; onApply(); persistDebounced(); close(); });
      el.querySelector('.fp-apply').addEventListener('click', function () { doApply(); close(); });
      /* แตะสวอตช์ = ใช้สีทันทีแล้วปิด popover เลย (เหมือนกดปุ่มสีเติมใน Excel) ไม่ต้องกด "ใช้สีนี้" ซ้ำอีก */
      wireColorSwatchRow(el, '.cc-bg-row', '.cc-bg', function () { doApply(); close(); });
      wireColorSwatchRow(el, '.cc-accent-row', '.cc-accent', function () { doApply(); close(); });
    }, true);
  }
  function renderStatTiles(containerId, tiles, role) {
    var cfg = role ? state.cardColors[role] : null;
    var accent = cfg && cfg.accent;
    var tileBg = cfg && cfg.bg ? (cfg.gradient ? 'background:linear-gradient(135deg,' + cfg.bg + ',' + shadeColor(cfg.bg, 0.4) + ');' : 'background:' + cfg.bg + ';') : '';
    var html = tiles.map(function (t) {
      return '<div class="stat-tile"' + (tileBg ? ' style="' + tileBg + '"' : '') + '><div class="lbl">' + escapeHtml(t.label) + '</div><div class="val"' + (accent ? ' style="color:' + accent + '"' : '') + '>' + t.value +
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

  /* จัดกลุ่ม (หรือถ้าไม่มีคอลัมน์ตัวเลข — นับจำนวนแถว) แยกตามเดือน (yyyy-mm) เรียงตามเวลา — ใช้ร่วมกันกับ
     แดชบอร์ดรายรับ-รายจ่าย/การอ่านหนังสือ ที่ต้องดูแนวโน้มระดับเดือน (ต่างจาก aggregateByDate ที่ตัดถึง
     ระดับวัน ซึ่งถี่เกินไปสำหรับข้อมูลที่มักกินเวลาหลายเดือน-หลายปี) */
  function aggregateByMonth(rows, dateKey, numKey) {
    var map = {};
    rows.forEach(function (r) {
      var d = r[dateKey];
      if (!(d instanceof Date) || isNaN(d)) return;
      var k = d.toISOString().slice(0, 7);
      map[k] = (map[k] || 0) + (numKey ? (typeof r[numKey] === 'number' ? r[numKey] : 0) : 1);
    });
    return Object.keys(map).sort().map(function (k) { return [k, map[k]]; });
  }

  /* ── รายรับ-รายจ่าย: รองรับ 2 รูปแบบตารางที่พบจริง — (ก) มีคอลัมน์ "รายรับ"/"รายจ่าย" แยกกันเป็นตัวเลข
     2 คอลัมน์ (พบบ่อยในเทมเพลตบัญชีของไทย) หรือ (ข) มีคอลัมน์ "จำนวนเงิน" + "ประเภทรายการ" ตัวเดียว ต้อง
     เดาว่าค่าไหนคือรายรับ/รายจ่ายจากคำมาตรฐาน (รายรับ/รายได้/income vs รายจ่าย/ค่าใช้จ่าย/expense) —
     ต่างจากคอลัมน์ "สถานะ" ทั่วไปตรงที่คำเหล่านี้เป็นศัพท์บัญชีมาตรฐานที่ใช้ซ้ำกันจริง ไม่ใช่ค่าที่แต่ละ
     องค์กรตั้งเองตามใจชอบ */
  var FINANCE_INCOME_KW = ['รายรับ', 'รายได้', 'income', 'revenue', 'เงินเข้า', 'ฝาก', 'deposit'];
  var FINANCE_EXPENSE_KW = ['รายจ่าย', 'ค่าใช้จ่าย', 'expense', 'cost', 'เงินออก', 'ถอน', 'withdraw', 'ซื้อ'];
  function classifyTxnType(v) {
    var n = normLabel(v);
    if (FINANCE_INCOME_KW.some(function (k) { return n.indexOf(normLabel(k)) !== -1; })) return 'income';
    if (FINANCE_EXPENSE_KW.some(function (k) { return n.indexOf(normLabel(k)) !== -1; })) return 'expense';
    return null;
  }
  function financeRowFlow(row, roles) {
    if (roles.income && roles.expense) {
      var inc = typeof row[roles.income.key] === 'number' ? row[roles.income.key] : 0;
      var exp = typeof row[roles.expense.key] === 'number' ? row[roles.expense.key] : 0;
      return { inc: inc, exp: exp };
    }
    if (roles.amount && roles.txntype) {
      var cls = classifyTxnType(row[roles.txntype.key]);
      var amt = typeof row[roles.amount.key] === 'number' ? Math.abs(row[roles.amount.key]) : 0;
      if (cls === 'income') return { inc: amt, exp: 0 };
      if (cls === 'expense') return { inc: 0, exp: amt };
      return null;
    }
    return null;
  }
  function buildFinanceDomain(rows, roles) {
    var tiles = [];
    var flows = rows.map(function (r) { return financeRowFlow(r, roles); });
    var totalIncome = 0, totalExpense = 0, resolvedCount = 0;
    flows.forEach(function (f) { if (f) { totalIncome += f.inc; totalExpense += f.exp; resolvedCount++; } });
    if (resolvedCount) {
      tiles.push({ label: t('fKpiIncome'), value: totalIncome.toLocaleString(locale(), { maximumFractionDigits: 2 }) });
      tiles.push({ label: t('fKpiExpense'), value: totalExpense.toLocaleString(locale(), { maximumFractionDigits: 2 }) });
      tiles.push({ label: t('fKpiNet'), value: (totalIncome - totalExpense).toLocaleString(locale(), { maximumFractionDigits: 2 }) });
    }
    tiles.push({ label: t('fKpiTxnCount'), value: rows.length.toLocaleString(locale()) });
    var chart1 = null, chart2 = null;
    if (roles.category && resolvedCount) {
      var map = {}, order = [];
      rows.forEach(function (r, i) {
        var f = flows[i]; if (!f || !f.exp) return;
        var k = r[roles.category.key]; k = (k === null || k === undefined || k === '') ? t('emptyValueLabel') : String(k);
        if (!(k in map)) { map[k] = 0; order.push(k); }
        map[k] += f.exp;
      });
      var entries = order.map(function (k) { return [k, map[k]]; });
      entries.sort(function (a, b) { return b[1] - a[1]; });
      if (entries.length > MAX_CHART_CATS) {
        var top = entries.slice(0, MAX_CHART_CATS);
        var rest = entries.slice(MAX_CHART_CATS).reduce(function (s, e) { return s + e[1]; }, 0);
        top.push([t('otherBucket'), rest]);
        entries = top;
      }
      if (entries.length) chart1 = { title: t('fChartExpenseByCategory'), labels: entries.map(function (e) { return e[0]; }), data: entries.map(function (e) { return e[1]; }) };
    }
    if (roles.date && resolvedCount) {
      var monthMap = {};
      rows.forEach(function (r, i) {
        var f = flows[i]; if (!f) return;
        var d = r[roles.date.key]; if (!(d instanceof Date) || isNaN(d)) return;
        var mk = d.toISOString().slice(0, 7);
        monthMap[mk] = (monthMap[mk] || 0) + (f.inc - f.exp);
      });
      var monthKeys = Object.keys(monthMap).sort();
      if (monthKeys.length >= 2) chart2 = { title: t('fChartNetByMonth'), labels: monthKeys, data: monthKeys.map(function (k) { return Math.round(monthMap[k] * 100) / 100; }) };
    }
    return { title: t('domainTitleFinance'), tiles: tiles, chart1: chart1, chart2: chart2 };
  }

  /* ── การอ่านหนังสือ: อ้างอิงจาก Bookwise/StoryGraph/Bookly ตอนออกแบบ — เล่ม/เดือน, สัดส่วนแนวหนังสือ,
     คะแนนเฉลี่ย, จำนวนหน้ารวม เป็นชุด KPI/กราฟที่แอปติดตามการอ่านยอดนิยมใช้ตรงกันเกือบทั้งหมด */
  function buildReadingDomain(rows, roles) {
    var tiles = [];
    if (roles.booktitle) {
      var uniqBooks = {}; rows.forEach(function (r) { var v = r[roles.booktitle.key]; if (v !== null && v !== undefined && v !== '') uniqBooks[String(v)] = true; });
      tiles.push({ label: t('rdKpiTotalBooks'), value: Object.keys(uniqBooks).length.toLocaleString(locale()) });
    } else {
      tiles.push({ label: t('rdKpiTotalBooks'), value: rows.length.toLocaleString(locale()) });
    }
    if (roles.pages) {
      var pageSum = rows.reduce(function (s, r) { var v = r[roles.pages.key]; return s + (typeof v === 'number' ? v : 0); }, 0);
      tiles.push({ label: t('rdKpiTotalPages'), value: pageSum.toLocaleString(locale()) });
    }
    if (roles.rating) {
      var ratings = rows.map(function (r) { return r[roles.rating.key]; }).filter(function (v) { return typeof v === 'number'; });
      if (ratings.length) tiles.push({ label: t('rdKpiAvgRating'), value: (ratings.reduce(function (s, v) { return s + v; }, 0) / ratings.length).toLocaleString(locale(), { maximumFractionDigits: 2 }) });
    }
    if (roles.genre) {
      var uniqGenre = {}; rows.forEach(function (r) { var v = r[roles.genre.key]; if (v !== null && v !== undefined && v !== '') uniqGenre[String(v)] = true; });
      tiles.push({ label: t('rdKpiGenres'), value: Object.keys(uniqGenre).length.toLocaleString(locale()) });
    }
    var chart1 = null, chart2 = null;
    if (roles.genre) {
      var e1 = aggregateByCategory(rows, roles.genre.key, null);
      chart1 = { title: t('rdChartByGenre'), labels: e1.map(function (e) { return e[0]; }), data: e1.map(function (e) { return e[1]; }) };
    }
    if (roles.finishdate) {
      var e2 = aggregateByMonth(rows, roles.finishdate.key, null);
      if (e2.length >= 2) chart2 = { title: t('rdChartByMonth'), labels: e2.map(function (e) { return e[0]; }), data: e2.map(function (e) { return e[1]; }) };
    }
    return { title: t('domainTitleReading'), tiles: tiles, chart1: chart1, chart2: chart2 };
  }

  var DOMAIN_BUILDERS = { maintenance: buildMaintenanceDomain, project: buildProjectDomain, legal: buildLegalDomain, risk: buildRiskDomain, finance: buildFinanceDomain, reading: buildReadingDomain };
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
    renderStatTiles('domainKpiRow', built.tiles, 'domainKpi');
    [['domainChart1', built.chart1], ['domainChart2', built.chart2]].forEach(function (pair) {
      var canvasId = pair[0], chart = pair[1];
      var cardId = canvasId + 'Card', titleId = canvasId + 'Title';
      if (chart && typeof Chart !== 'undefined' && chart.labels.length) {
        $(cardId).style.display = 'block';
        $(titleId).textContent = chart.title;
        applyCardColor(cardId, canvasId);
        var cfg = buildChartConfig('bar', chart.labels, chart.data, cardColorAccent(canvasId));
        charts[canvasId === 'domainChart1' ? 'domain1' : 'domain2'] = new Chart($(canvasId).getContext('2d'), cfg);
      } else {
        $(cardId).style.display = 'none';
      }
    });
    if (built.matrix) {
      $('domainMatrixCard').style.display = 'block';
      applyCardColor('domainMatrixCard', 'domainMatrix');
      $('domainMatrixTitle').textContent = built.matrix.title;
      $('domainMatrixWrap').innerHTML = built.matrix.html;
      $('domainMatrixAxisNote').textContent = built.matrix.axisNote;
    } else {
      $('domainMatrixCard').style.display = 'none';
    }
    return true;
  }

  /* ══════════════════ มุมมอง "กำหนดเอง" — ลากวางกล่อง KPI/กราฟ/ข้อความเอง (Gridstack.js, MIT) ══════════════════
     ต่างจากแดชบอร์ดอัตโนมัติ/แดชบอร์ดเฉพาะทางด้านบนตรงที่ผู้ใช้เลือกเองทุกอย่าง (คอลัมน์/ชนิดกราฟ/ตำแหน่ง/
     ขนาด) แล้ว "จำ" ไว้ข้ามเซสชัน (บันทึกไปกับรายงานจริง ต่างจาก dashTable/domainOverride ที่เป็นแค่ค่า
     ชั่วคราวรีเซ็ตทุกครั้งที่โหลดใหม่) ไม่ผูกกับ state.drill (การคลิกกราฟแดชบอร์ดอัตโนมัติเพื่อกรอง) —
     ตั้งใจให้มุมมองนี้เป็นรายงานสรุปของตัวเองที่ตัวเลขนิ่ง ไม่ขยับตามการคลิกที่แท็บอื่น */
  var customGridInst = null;
  var customCharts = {}; // widgetId -> Chart instance (ต้อง destroy ก่อนวาดใหม่เหมือนกราฟแดชบอร์ดหลัก)

  function genWidgetId() { return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function computeKpiWidgetValue(cfg) {
    /* กล่องที่ "โหลดจากแดชบอร์ด" มาจากตัวเลขที่คำนวณเฉพาะทาง (เช่น MTTR ของแม่แบบซ่อมบำรุง) ไม่มีสูตร
       colKey+agg ทั่วไปให้คำนวณสดได้ — เก็บเป็นสแนปช็อตค่า ณ ตอนโหลดแทน (ล้างทิ้งอัตโนมัติถ้าผู้ใช้แก้ไข
       ผ่าน popup ⚙️ ในภายหลัง กลายเป็นกล่องสดตามปกติ) */
    if (cfg.snapshot) return { value: cfg.snapshot.value, label: cfg.label || cfg.snapshot.label };
    if (cfg.agg === 'count' || !cfg.colKey) {
      return { value: state.rows.length.toLocaleString(locale()), label: cfg.label || t('totalRowsKpiLabel') };
    }
    var col = state.columns.filter(function (c) { return c.key === cfg.colKey; })[0];
    if (!col) return { value: '—', label: cfg.label || '' };
    var vals = state.rows.map(function (r) { return r[col.key]; }).filter(function (v) { return typeof v === 'number' && isFinite(v); });
    var num = null;
    if (vals.length) {
      if (cfg.agg === 'sum') num = vals.reduce(function (a, b) { return a + b; }, 0);
      else if (cfg.agg === 'avg') num = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      else if (cfg.agg === 'min') num = Math.min.apply(null, vals);
      else if (cfg.agg === 'max') num = Math.max.apply(null, vals);
    }
    var aggLbl = t('cwAgg' + cfg.agg.charAt(0).toUpperCase() + cfg.agg.slice(1));
    return {
      value: num === null ? '—' : num.toLocaleString(locale(), { maximumFractionDigits: 2 }),
      label: cfg.label || (col.label + ' · ' + aggLbl)
    };
  }
  function widgetAccent(cfg) { return (cfg.style && cfg.style.accent) || '#1E9E5A'; }
  function renderKpiWidget(bodyEl, cfg) {
    var r = computeKpiWidgetValue(cfg);
    var accent = widgetAccent(cfg);
    bodyEl.innerHTML = '<div class="wt-sub">' + escapeHtml(r.label) +
      (cfg.snapshot ? '<span class="wt-snapshot-note">' + escapeHtml(t('loadTemplateSnapshotNote')) + '</span>' : '') +
      '</div><div class="wt-val" style="color:' + accent + '">' + r.value + '</div>';
  }
  function renderChartWidget(bodyEl, cfg, widgetId) {
    if (customCharts[widgetId]) { try { customCharts[widgetId].destroy(); } catch (e) {} delete customCharts[widgetId]; }
    if (typeof Chart === 'undefined') { bodyEl.innerHTML = '<p class="mini">' + escapeHtml(t('chartLibFail')) + '</p>'; return; }
    var labels, data;
    if (cfg.snapshot) {
      /* กราฟที่ "โหลดจากแดชบอร์ด" มาจากแม่แบบเฉพาะทาง (เช่นกราฟค่าซ่อมตามประเภทอุปกรณ์) เป็นข้อมูล
         ที่รวมกลุ่ม/คำนวณไว้แล้วตายตัว ไม่มีคอลัมน์ catColKey/numColKey ทั่วไปให้คำนวณสดซ้ำได้ */
      labels = cfg.snapshot.labels; data = cfg.snapshot.data;
    } else {
      var catCol = state.columns.filter(function (c) { return c.key === cfg.catColKey; })[0];
      if (!catCol) { bodyEl.innerHTML = '<p class="mini">—</p>'; return; }
      var numCol = cfg.numColKey ? state.columns.filter(function (c) { return c.key === cfg.numColKey; })[0] : null;
      var entries = catCol.type === 'date'
        ? aggregateByDate(state.rows, catCol.key, numCol ? numCol.key : null)
        : aggregateByCategory(state.rows, catCol.key, numCol ? numCol.key : null);
      labels = entries.map(function (e) { return e[0]; }); data = entries.map(function (e) { return e[1]; });
    }
    bodyEl.innerHTML = (cfg.snapshot ? '<div class="wt-snapshot-note" style="margin-bottom:2px">' + escapeHtml(t('loadTemplateSnapshotNote')) + '</div>' : '') + '<canvas></canvas>';
    var canvas = bodyEl.querySelector('canvas');
    var chartCfg = buildChartConfig(cfg.chartType || 'bar', labels, data, widgetAccent(cfg));
    customCharts[widgetId] = new Chart(canvas.getContext('2d'), chartCfg);
  }
  function renderTextWidget(bodyEl, cfg, widget) {
    bodyEl.setAttribute('contenteditable', 'true');
    bodyEl.setAttribute('data-placeholder', t('cwTextPh'));
    if (bodyEl.textContent !== (cfg.text || '')) bodyEl.textContent = cfg.text || '';
    bodyEl.style.color = (cfg.style && cfg.style.accent) || '';
    var saveTimer = null;
    bodyEl.oninput = function () {
      widget.config.text = bodyEl.textContent;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(persistDebounced, 400);
    };
  }
  function tableWidgetCellDisplay(v, type) {
    if (v === null || v === undefined || v === '') return '';
    if (type === 'date' && v instanceof Date && !isNaN(v)) return v.toLocaleDateString(locale());
    if (type === 'number' && typeof v === 'number' && isFinite(v)) return v.toLocaleString(locale(), { maximumFractionDigits: 2 });
    return String(v);
  }
  /* ตารางข้อมูลธรรมดา (ไม่ใช่ pivot) ของกล่องตาราง — กรอง/เรียงจาก state.rows ทั้งหมดเสมอ (เหมือนกล่อง
     KPI/กราฟ ไม่ผูกกับ state.drill หรือตัวกรองแท็บตาราง ตามหลักการเดิม "รายงานสรุปนิ่ง ไม่ขยับตามแท็บอื่น") */
  function tableWidgetPlainRows(cfg) {
    var cols = state.columns.filter(function (c) { return cfg.cols.indexOf(c.key) !== -1; });
    var rows = state.rows;
    if (cfg.q) {
      var q = cfg.q.toLowerCase();
      rows = rows.filter(function (r) {
        return cols.some(function (c) { return tableWidgetCellDisplay(r[c.key], c.type).toLowerCase().indexOf(q) !== -1; });
      });
    }
    if (cfg.sortCol) {
      var sc = state.columns.filter(function (c) { return c.key === cfg.sortCol; })[0];
      if (sc) {
        var dir = cfg.sortDir === 'desc' ? -1 : 1;
        rows = rows.slice().sort(function (a, b) {
          var av = a[sc.key], bv = b[sc.key];
          if (av == null && bv == null) return 0;
          if (av == null) return 1; if (bv == null) return -1;
          if (sc.type === 'number') return (av - bv) * dir;
          if (sc.type === 'date') return (new Date(av) - new Date(bv)) * dir;
          return String(av).localeCompare(String(bv), getUILang()) * dir;
        });
      }
    }
    return { cols: cols, rows: rows };
  }
  /* วาดเฉพาะ <table> + บรรทัด meta ของกล่องตาราง — แยกจาก renderTableWidget() (ที่สร้าง skeleton ทั้งกล่อง
     รวมช่องค้นหา) ครั้งเดียว กันช่องค้นหาเสียโฟกัสเวลาพิมพ์ทุกครั้งที่ผลลัพธ์เปลี่ยน เหมือน renderDashTableBody() */
  function renderTableWidgetTable(bodyEl, cfg) {
    var wrap = bodyEl.querySelector('.wtbl-tablewrap');
    if (!wrap) return;
    if (cfg.mode === 'pivot') {
      var piv = cfg.pivotRow ? buildPivot(state.rows, true, { rowKey: cfg.pivotRow, colKey: cfg.pivotCol, valKey: cfg.pivotVal, agg: cfg.pivotAgg }) : null;
      if (!piv) { wrap.innerHTML = '<p class="mini">' + escapeHtml(t('pivotEmptyHint')) + '</p>'; return; }
      wrap.innerHTML = '<table>' + pivotTableHtml(piv) + '</table>';
      return;
    }
    if (!cfg.cols.length) { wrap.innerHTML = '<p class="mini">' + escapeHtml(t('cwTableNoColsHint')) + '</p>'; return; }
    var r = tableWidgetPlainRows(cfg);
    var thead = '<thead><tr>' + r.cols.map(function (c) {
      var sorted = cfg.sortCol === c.key;
      var ic = sorted ? (cfg.sortDir === 'asc' ? '▲' : '▼') : '↕';
      return '<th class="' + (c.type === 'number' ? 'num' : '') + (sorted ? ' sorted' : '') + '" data-col="' + c.key + '" title="' + escapeAttr(t('cwTableSortHint')) + '">' +
        escapeHtml(c.label) + '<span class="sort-ic">' + ic + '</span></th>';
    }).join('') + '</tr></thead>';
    var tbody = '<tbody>' + r.rows.map(function (row) {
      return '<tr>' + r.cols.map(function (c) {
        return '<td class="' + (c.type === 'number' ? 'num' : '') + '">' + escapeHtml(tableWidgetCellDisplay(row[c.key], c.type)) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
    wrap.innerHTML = '<table>' + thead + tbody + '</table>';
    [].forEach.call(wrap.querySelectorAll('th[data-col]'), function (th) {
      th.addEventListener('click', function () {
        var col = th.getAttribute('data-col');
        if (cfg.sortCol === col) cfg.sortDir = cfg.sortDir === 'asc' ? 'desc' : 'asc';
        else { cfg.sortCol = col; cfg.sortDir = 'asc'; }
        renderTableWidgetTable(bodyEl, cfg);
        persistDebounced();
      });
    });
    var meta = bodyEl.querySelector('.wtbl-meta');
    if (meta) meta.textContent = r.rows.length.toLocaleString(locale()) + ' / ' + state.rows.length.toLocaleString(locale()) + ' ' + t('unitRows');
  }
  function renderTableWidget(bodyEl, cfg, widget) {
    var searchHtml = cfg.mode === 'pivot' ? '' :
      '<input type="text" class="wtbl-search" placeholder="' + escapeAttr(t('cwTableSearchPh')) + '" value="' + escapeAttr(cfg.q || '') + '">';
    bodyEl.innerHTML = searchHtml + '<div class="wtbl-tablewrap"></div>' + (cfg.mode === 'pivot' ? '' : '<div class="wtbl-meta"></div>');
    var searchEl = bodyEl.querySelector('.wtbl-search');
    if (searchEl) {
      var saveTimer = null;
      searchEl.addEventListener('input', function () {
        cfg.q = searchEl.value;
        renderTableWidgetTable(bodyEl, cfg);
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(persistDebounced, 400);
      });
    }
    renderTableWidgetTable(bodyEl, cfg);
  }
  function widgetTypeLabel(type) { return type === 'kpi' ? t('wtKpiLabel') : type === 'chart' ? t('wtChartLabel') : type === 'table' ? t('wtTableLabel') : t('wtTextLabel'); }
  function renderWidgetBody(widget, itemEl) {
    var bodyEl = itemEl.querySelector('.widget-body');
    if (!bodyEl) return;
    bodyEl.className = 'widget-body wb-' + widget.type;
    var content = itemEl.querySelector('.grid-stack-item-content');
    var style = widget.config.style;
    if (content) content.style.background = (style && style.bg) ? (style.gradient ? 'linear-gradient(135deg,' + style.bg + ',' + shadeColor(style.bg, 0.4) + ')' : style.bg) : '';
    if (widget.type === 'kpi') renderKpiWidget(bodyEl, widget.config);
    else if (widget.type === 'chart') renderChartWidget(bodyEl, widget.config, widget.id);
    else if (widget.type === 'table') renderTableWidget(bodyEl, widget.config, widget);
    else renderTextWidget(bodyEl, widget.config, widget);
  }
  function widgetHtml(widget) {
    return '<div class="widget-head">' +
      '<span class="wt-label">' + escapeHtml(widgetTypeLabel(widget.type)) + '</span>' +
      '<button type="button" class="w-edit" title="' + escapeAttr(t('wtEditTitle')) + '">⚙️</button>' +
      '<button type="button" class="w-del" title="' + escapeAttr(t('wtRemoveTitle')) + '">✕</button>' +
      '</div><div class="widget-body"></div>';
  }
  function wireWidgetControls(widget, itemEl) {
    var editBtn = itemEl.querySelector('.w-edit');
    if (editBtn) editBtn.addEventListener('click', function () { openWidgetEditPopover(widget, itemEl, editBtn); });
    itemEl.querySelector('.w-del').addEventListener('click', function () {
      if (customCharts[widget.id]) { try { customCharts[widget.id].destroy(); } catch (e) {} delete customCharts[widget.id]; }
      try { customGridInst.removeWidget(itemEl); } catch (e) { itemEl.remove(); }
      state.customWidgets = state.customWidgets.filter(function (w) { return w.id !== widget.id; });
      persistDebounced();
    });
  }

  function applyCustomBg() {
    var cfg = state.customBg;
    $('customGrid').style.background = (cfg && cfg.bg) ? (cfg.gradient ? 'linear-gradient(135deg,' + cfg.bg + ',' + shadeColor(cfg.bg, 0.4) + ')' : cfg.bg) : '';
  }
  function renderCustomView() {
    applyCustomBg();
    if (typeof GridStack === 'undefined') {
      $('customGrid').innerHTML = '<p class="mini">' + escapeHtml(t('chartLibFail')) + '</p>';
      return;
    }
    Object.keys(customCharts).forEach(function (id) { try { customCharts[id].destroy(); } catch (e) {} });
    customCharts = {};
    if (customGridInst) { try { customGridInst.destroy(true); } catch (e) {} customGridInst = null; }
    $('customGrid').innerHTML = '';
    // Gridstack v10+ เปลี่ยน default ของฟิลด์ content ให้ใส่เป็น textContent (กัน XSS จาก user data)
    // แทนที่จะเป็น innerHTML เหมือนเวอร์ชันก่อนหน้า — เนื้อหา content ที่เราส่งเป็น markup ที่เราสร้างเอง
    // (ไม่ใช่ข้อความจากผู้ใช้ดิบๆ) จึงต้อง override ให้ใส่เป็น innerHTML ตรงๆ ไม่งั้นกล่องจะโชว์โค้ด HTML เป็นตัวหนังสือ
    GridStack.renderCB = function (el, w) { el.innerHTML = w.content || ''; };
    customGridInst = GridStack.init({ cellHeight: 90, margin: 8, float: true, handle: '.widget-head' });
    state.customWidgets.forEach(function (widget) {
      var el = customGridInst.addWidget({ x: widget.x, y: widget.y, w: widget.w, h: widget.h, id: widget.id, content: widgetHtml(widget) });
      renderWidgetBody(widget, el);
      wireWidgetControls(widget, el);
    });
    customGridInst.on('change', function (ev, items) {
      (items || []).forEach(function (it) {
        var widget = state.customWidgets.filter(function (w) { return w.id === it.id; })[0];
        if (widget) { widget.x = it.x; widget.y = it.y; widget.w = it.w; widget.h = it.h; }
      });
      persistDebounced();
    });
    $('customEmptyHint').style.display = state.customWidgets.length ? 'none' : 'inline';
  }

  function addCustomWidget(type) {
    var numCols = state.columns.filter(function (c) { return c.type === 'number'; });
    var catCols = state.columns.filter(function (c) { return c.type === 'category' || c.type === 'date'; });
    var sizes = { chart: [4, 4], text: [3, 2], table: [5, 4] };
    var wh = sizes[type] || [2, 2];
    var widget = { id: genWidgetId(), type: type, x: null, y: null, w: wh[0], h: wh[1], config: {} };
    if (type === 'kpi') {
      widget.config = numCols.length ? { colKey: numCols[0].key, agg: 'sum', label: null } : { colKey: null, agg: 'count', label: null };
    } else if (type === 'chart') {
      widget.config = { chartType: 'bar', catColKey: catCols.length ? catCols[0].key : null, numColKey: numCols.length ? numCols[0].key : '' };
    } else if (type === 'table') {
      widget.config = {
        mode: 'plain', cols: state.columns.slice(0, 6).map(function (c) { return c.key; }), q: '', sortCol: null, sortDir: 'asc',
        pivotRow: catCols.length ? catCols[0].key : '', pivotCol: '', pivotVal: '', pivotAgg: 'sum'
      };
    } else {
      widget.config = { text: '' };
    }
    state.customWidgets.push(widget);
    if (customGridInst) {
      var el = customGridInst.addWidget({ w: widget.w, h: widget.h, id: widget.id, content: widgetHtml(widget) });
      if (el.gridstackNode) { widget.x = el.gridstackNode.x; widget.y = el.gridstackNode.y; }
      renderWidgetBody(widget, el);
      wireWidgetControls(widget, el);
      if (type === 'text') { var bodyEl = el.querySelector('.widget-body'); if (bodyEl) bodyEl.focus(); }
    }
    $('customEmptyHint').style.display = 'none';
    persistDebounced();
  }

  function openAddWidgetPicker(anchorEl) {
    var html = '<div class="fp-title">' + escapeHtml(t('addWidgetPickTitle')) + '</div>' +
      '<div class="fp-list add-widget-pick">' +
      '<div class="fp-item" data-type="kpi"><span>' + escapeHtml(t('wtKpi')) + '</span></div>' +
      '<div class="fp-item" data-type="chart"><span>' + escapeHtml(t('wtChart')) + '</span></div>' +
      '<div class="fp-item" data-type="table"><span>' + escapeHtml(t('wtTable')) + '</span></div>' +
      '<div class="fp-item" data-type="text"><span>' + escapeHtml(t('wtText')) + '</span></div>' +
      '</div>';
    openPopover(html, anchorEl, function (el, close) {
      [].forEach.call(el.querySelectorAll('.fp-item'), function (item) {
        item.addEventListener('click', function () { addCustomWidget(item.getAttribute('data-type')); close(); });
      });
    });
  }

  function openCustomBgPopover(anchorEl) {
    var cur = state.customBg || {};
    var html = '<div class="fp-title">' + escapeHtml(t('cardColorTitle')) + '</div>' +
      '<div class="fp-range">' +
      '<label>' + escapeHtml(t('cardBgColorLbl')) + '</label>' + colorSwatchRowHtml('cbg-bg-row') +
      '<label><input type="color" class="cbg-bg" value="' + (cur.bg || '#ffffff') + '"> ' + escapeHtml(t('moreColorsLbl')) + '</label>' +
      '<label class="cc-checkrow"><input type="checkbox" class="cbg-grad"' + (cur.gradient ? ' checked' : '') + '> ' + escapeHtml(t('cardGradientLbl')) + '</label>' +
      '</div>' +
      '<div class="fp-actions"><button type="button" class="btn sm ghost cbg-reset">' + escapeHtml(t('cardColorResetBtn')) + '</button>' +
      '<div class="fp-btns"><button type="button" class="btn sm fp-apply">' + escapeHtml(t('filterApplyBtn')) + '</button></div></div>';
    openPopover(html, anchorEl, function (el, close) {
      function doApply() {
        state.customBg = { bg: el.querySelector('.cbg-bg').value, gradient: el.querySelector('.cbg-grad').checked };
        applyCustomBg();
        persistDebounced();
      }
      el.querySelector('.cbg-reset').addEventListener('click', function () { state.customBg = null; applyCustomBg(); persistDebounced(); close(); });
      el.querySelector('.fp-apply').addEventListener('click', function () { doApply(); close(); });
      wireColorSwatchRow(el, '.cbg-bg-row', '.cbg-bg', function () { doApply(); close(); });
    }, true);
  }

  /* "โหลดจากแดชบอร์ด" — คัดลอกการ์ดที่กำลังแสดงอยู่ในแท็บ "แดชบอร์ด" มาเป็นกล่องในแท็บ "กำหนดเอง"
     ให้ลาก/ย่อ-ขยาย/ปรับสีต่อได้เอง แบ่ง 2 แบบตามที่มาของข้อมูล:
     - การ์ดทั่วไป (สรุปตัวเลข/กราฟแท่ง/เส้น/วงกลม) คำนวณจากคอลัมน์+วิธีคำนวณธรรมดา (colKey+agg หรือ
       catColKey+numColKey) เหมือนกล่อง KPI/กราฟที่สร้างเองทุกประการ จึงสร้างเป็นกล่อง "สด" ที่คำนวณใหม่
       ทุกครั้งได้ตรงๆ ไม่ต้องแช่แข็งค่า
     - การ์ดของแม่แบบเฉพาะทาง (เช่น MTTR/กราฟต้นทุนตามประเภทอุปกรณ์ ของแม่แบบซ่อมบำรุง) คำนวณด้วยสูตร
       เฉพาะของแต่ละแม่แบบ ไม่มีคอลัมน์+วิธีคำนวณทั่วไปให้แปลงกลับเป็นกล่องสดได้ตรงๆ จึงคัดลอกเป็น
       "สแนปช็อต" ค่า ณ ตอนโหลดแทน (แจ้งผู้ใช้ชัดเจนว่าไม่อัปเดตตามข้อมูลสด — แก้ไขผ่าน ⚙️ เพื่อเปลี่ยน
       เป็นกล่องสดตามคอลัมน์ที่เลือกเองได้ภายหลัง) */
  function loadCustomFromDashboard() {
    /* เรียก renderDashboard() ก่อนเสมอ เผื่อผู้ใช้มาที่แท็บ "กำหนดเอง" ตรงๆ โดยไม่เคยเปิดแท็บ "แดชบอร์ด"
       เลยในเซสชันนี้ (การ์ด/select ต่างๆ ที่จะอ่านค่ายังไม่เคยถูกคำนวณ/เติมข้อมูลเลย) */
    renderDashboard();
    var added = 0;
    function push(type, w, h, config) {
      var widget = { id: genWidgetId(), type: type, x: null, y: null, w: w, h: h, config: config };
      state.customWidgets.push(widget);
      added++;
    }
    var numCols = state.columns.filter(function (c) { return c.type === 'number'; });
    if ($('numStatCard').style.display !== 'none') {
      numCols.slice(0, 4).forEach(function (c) { push('kpi', 2, 2, { colKey: c.key, agg: 'sum', label: null }); });
    }
    [['bar', 'barCatSel', 'barNumSel', 'barTypeSel'], ['line', 'lineDateSel', 'lineNumSel', 'lineTypeSel'], ['pie', 'pieCatSel', null, 'pieTypeSel']].forEach(function (t3) {
      var cardId = t3[0] + 'ChartCard';
      if ($(cardId).style.display === 'none') return;
      var catSel = $(t3[1]), numSel = t3[2] ? $(t3[2]) : null, typeSel = $(t3[3]);
      push('chart', 4, 4, { chartType: typeSel ? typeSel.value : 'bar', catColKey: catSel.value, numColKey: numSel ? numSel.value : '' });
    });
    if ($('domainDashboardCard').style.display !== 'none') {
      var kpiTiles = [].slice.call($('domainKpiRow').querySelectorAll('.stat-tile'));
      kpiTiles.forEach(function (tile) {
        var lbl = tile.querySelector('.lbl'), val = tile.querySelector('.val');
        if (!lbl || !val) return;
        push('kpi', 2, 2, { colKey: null, agg: 'count', label: null, snapshot: { value: val.textContent, label: lbl.textContent } });
      });
      ['domainChart1', 'domainChart2'].forEach(function (id) {
        if ($(id + 'Card').style.display === 'none') return;
        var chartInst = charts[id === 'domainChart1' ? 'domain1' : 'domain2'];
        if (!chartInst) return;
        push('chart', 4, 4, { chartType: 'bar', snapshot: { labels: chartInst.data.labels, data: chartInst.data.datasets[0].data } });
      });
    }
    if (!added) { alert(t('loadTemplateNoneHint')); return; }
    persistDebounced();
    renderCustomView();
  }

  /* ส่วนปรับสี (พื้นหลัง+ไล่เฉด+สีหลัก) ใช้ร่วมกันทุกชนิดกล่อง — table ไม่มีสีหลักเพราะไม่มีจุดที่ใช้สีเดี่ยว
     ชัดเจนแบบ KPI/กราฟ/ข้อความ (ตารางมีหลายคอลัมน์ ไม่มี "สีหลัก" เดียวที่สมเหตุสมผล) */
  function widgetStyleSectionHtml(widget) {
    var st = widget.config.style || {};
    return '<div class="fp-title" style="margin-top:10px">' + escapeHtml(t('cardColorTitle')) + '</div>' +
      '<div class="fp-range">' +
      '<label>' + escapeHtml(t('cardBgColorLbl')) + '</label>' + colorSwatchRowHtml('ew-style-bg-row') +
      '<label><input type="color" class="ew-style-bg" value="' + (st.bg || '#ffffff') + '"> ' + escapeHtml(t('moreColorsLbl')) + '</label>' +
      '<label class="cc-checkrow"><input type="checkbox" class="ew-style-grad"' + (st.gradient ? ' checked' : '') + '> ' + escapeHtml(t('cardGradientLbl')) + '</label>' +
      (widget.type === 'table' ? '' : '<label>' + escapeHtml(t('cardAccentColorLbl')) + '</label>' + colorSwatchRowHtml('ew-style-accent-row') +
        '<label><input type="color" class="ew-style-accent" value="' + (st.accent || '#1E9E5A') + '"> ' + escapeHtml(t('moreColorsLbl')) + '</label>') +
      '</div>' +
      '<button type="button" class="btn sm ghost ew-style-reset" style="margin-bottom:10px">' + escapeHtml(t('cardColorResetBtn')) + '</button>';
  }
  function wireWidgetStyleSection(el, widget, itemEl, close) {
    el.querySelector('.ew-style-reset').addEventListener('click', function () {
      delete widget.config.style;
      renderWidgetBody(widget, itemEl);
      persistDebounced();
      close();
    });
    /* จุดนี้ popover รวมมีปุ่ม "ใช้" กลางอันเดียวคุมทุกฟิลด์ (ไม่ใช่แค่สี) แตะสวอตช์แค่เซ็ตค่าไว้ในช่อง
       สีเดิม ไม่ apply/ปิดทันทีเหมือน 2 จุดข้างบน เพราะยังมีฟิลด์อื่นให้ปรับต่อในกล่องเดียวกัน */
    wireColorSwatchRow(el, '.ew-style-bg-row', '.ew-style-bg', null);
    wireColorSwatchRow(el, '.ew-style-accent-row', '.ew-style-accent', null);
  }
  function applyWidgetStyleSection(el, widget) {
    var accentEl = el.querySelector('.ew-style-accent');
    widget.config.style = { bg: el.querySelector('.ew-style-bg').value, gradient: el.querySelector('.ew-style-grad').checked, accent: accentEl ? accentEl.value : undefined };
  }
  function openWidgetEditPopover(widget, itemEl, anchorEl) {
    var html = '';
    if (widget.type === 'kpi') {
      var numCols = state.columns.filter(function (c) { return c.type === 'number'; });
      html = '<div class="fp-title">' + escapeHtml(t('wtEditTitle')) + '</div>' +
        '<div class="fp-range">' +
        '<label>' + escapeHtml(t('cwAggLbl')) + '<select class="ew-agg">' +
        ['sum', 'avg', 'count', 'min', 'max'].map(function (a) { return '<option value="' + a + '"' + (widget.config.agg === a ? ' selected' : '') + '>' + escapeHtml(t('cwAgg' + a.charAt(0).toUpperCase() + a.slice(1))) + '</option>'; }).join('') +
        '</select></label>' +
        '<label class="ew-colwrap"' + (widget.config.agg === 'count' ? ' style="display:none"' : '') + '>' + escapeHtml(t('cwColumnLbl')) + '<select class="ew-col">' +
        numCols.map(function (c) { return '<option value="' + c.key + '"' + (widget.config.colKey === c.key ? ' selected' : '') + '>' + escapeHtml(c.label) + '</option>'; }).join('') +
        '</select></label>' +
        '<label>' + escapeHtml(t('cwLabelLbl')) + '<input type="text" class="ew-label" value="' + escapeAttr(widget.config.label || '') + '"></label>' +
        '</div>' +
        widgetStyleSectionHtml(widget) +
        '<div class="fp-actions"><span></span><div class="fp-btns"><button type="button" class="btn sm fp-apply">' + escapeHtml(t('filterApplyBtn')) + '</button></div></div>';
    } else if (widget.type === 'chart') {
      var catCols = state.columns.filter(function (c) { return c.type === 'category' || c.type === 'date'; });
      var numCols2 = state.columns.filter(function (c) { return c.type === 'number'; });
      html = '<div class="fp-title">' + escapeHtml(t('wtEditTitle')) + '</div>' +
        '<div class="fp-range">' +
        '<label>' + escapeHtml(t('cwChartTypeLbl')) + '<select class="ew-charttype">' +
        ['bar', 'barH', 'line', 'pie', 'doughnut'].map(function (ct) { return '<option value="' + ct + '"' + (widget.config.chartType === ct ? ' selected' : '') + '>' + escapeHtml(t('type' + ct.charAt(0).toUpperCase() + ct.slice(1))) + '</option>'; }).join('') +
        '</select></label>' +
        '<label>' + escapeHtml(t('cwGroupByLbl')) + '<select class="ew-cat">' +
        catCols.map(function (c) { return '<option value="' + c.key + '"' + (widget.config.catColKey === c.key ? ' selected' : '') + '>' + escapeHtml(c.label) + '</option>'; }).join('') +
        '</select></label>' +
        '<label>' + escapeHtml(t('cwValueLbl')) + '<select class="ew-val">' +
        '<option value=""' + (!widget.config.numColKey ? ' selected' : '') + '>' + escapeHtml(t('countOption')) + '</option>' +
        numCols2.map(function (c) { return '<option value="' + c.key + '"' + (widget.config.numColKey === c.key ? ' selected' : '') + '>' + escapeHtml(c.label) + '</option>'; }).join('') +
        '</select></label>' +
        '</div>' +
        widgetStyleSectionHtml(widget) +
        '<div class="fp-actions"><span></span><div class="fp-btns"><button type="button" class="btn sm fp-apply">' + escapeHtml(t('filterApplyBtn')) + '</button></div></div>';
    } else if (widget.type === 'table') {
      var catColsT = state.columns.filter(function (c) { return c.type === 'category' || c.type === 'date'; });
      var numColsT = state.columns.filter(function (c) { return c.type === 'number'; });
      var isPivot = widget.config.mode === 'pivot';
      html = '<div class="fp-title">' + escapeHtml(t('wtEditTitle')) + '</div>' +
        '<div class="fp-range">' +
        '<label>' + escapeHtml(t('cwTableModeLbl')) + '<select class="ew-mode">' +
        '<option value="plain"' + (!isPivot ? ' selected' : '') + '>' + escapeHtml(t('cwTableModePlain')) + '</option>' +
        '<option value="pivot"' + (isPivot ? ' selected' : '') + '>' + escapeHtml(t('cwTableModePivot')) + '</option>' +
        '</select></label>' +
        '</div>' +
        '<div class="ew-plain-wrap"' + (isPivot ? ' style="display:none"' : '') + '>' +
        '<div class="fp-title" style="margin-top:8px">' + escapeHtml(t('cwTableColsLbl')) + '</div>' +
        '<div class="fp-quick"><button type="button" class="fp-all">' + escapeHtml(t('filterSelectAllBtn')) + '</button>' +
        '<button type="button" class="fp-none">' + escapeHtml(t('filterSelectNoneBtn')) + '</button></div>' +
        '<div class="fp-list">' + state.columns.map(function (c) {
          return '<label class="fp-item"><input type="checkbox" class="ew-col-chk" data-col="' + c.key + '"' + (widget.config.cols.indexOf(c.key) !== -1 ? ' checked' : '') + '><span>' + escapeHtml(c.label) + '</span></label>';
        }).join('') + '</div>' +
        '</div>' +
        '<div class="ew-pivot-wrap fp-range"' + (isPivot ? '' : ' style="display:none"') + '>' +
        '<label>' + escapeHtml(t('pivotRowsLbl')) + '<select class="ew-pivot-row">' +
        catColsT.map(function (c) { return '<option value="' + c.key + '"' + (widget.config.pivotRow === c.key ? ' selected' : '') + '>' + escapeHtml(c.label) + '</option>'; }).join('') +
        '</select></label>' +
        '<label>' + escapeHtml(t('pivotColsLbl')) + '<select class="ew-pivot-col">' +
        '<option value=""' + (!widget.config.pivotCol ? ' selected' : '') + '>' + escapeHtml(t('pivotNoneOption')) + '</option>' +
        catColsT.map(function (c) { return '<option value="' + c.key + '"' + (widget.config.pivotCol === c.key ? ' selected' : '') + '>' + escapeHtml(c.label) + '</option>'; }).join('') +
        '</select></label>' +
        '<label>' + escapeHtml(t('pivotValueLbl')) + '<select class="ew-pivot-val">' +
        '<option value=""' + (!widget.config.pivotVal ? ' selected' : '') + '>' + escapeHtml(t('countOption')) + '</option>' +
        numColsT.map(function (c) { return '<option value="' + c.key + '"' + (widget.config.pivotVal === c.key ? ' selected' : '') + '>' + escapeHtml(c.label) + '</option>'; }).join('') +
        '</select></label>' +
        '<label>' + escapeHtml(t('pivotAggLbl')) + '<select class="ew-pivot-agg">' +
        '<option value="sum"' + (widget.config.pivotAgg === 'sum' ? ' selected' : '') + '>' + escapeHtml(t('aggSum')) + '</option>' +
        '<option value="avg"' + (widget.config.pivotAgg === 'avg' ? ' selected' : '') + '>' + escapeHtml(t('aggAvg')) + '</option>' +
        '</select></label>' +
        '</div>' +
        widgetStyleSectionHtml(widget) +
        '<div class="fp-actions"><span></span><div class="fp-btns"><button type="button" class="btn sm fp-apply">' + escapeHtml(t('filterApplyBtn')) + '</button></div></div>';
    } else {
      /* กล่องข้อความ — แก้เนื้อหาตรงในกล่องอยู่แล้ว popup นี้มีแค่ส่วนปรับสี */
      html = '<div class="fp-title">' + escapeHtml(t('wtEditTitle')) + '</div>' +
        widgetStyleSectionHtml(widget) +
        '<div class="fp-actions"><span></span><div class="fp-btns"><button type="button" class="btn sm fp-apply">' + escapeHtml(t('filterApplyBtn')) + '</button></div></div>';
    }
    openPopover(html, anchorEl, function (el, close) {
      wireWidgetStyleSection(el, widget, itemEl, close);
      if (widget.type === 'kpi') {
        var aggSel = el.querySelector('.ew-agg'), colWrap = el.querySelector('.ew-colwrap');
        aggSel.addEventListener('change', function () { colWrap.style.display = aggSel.value === 'count' ? 'none' : ''; });
      } else if (widget.type === 'table') {
        var modeSel = el.querySelector('.ew-mode'), plainWrap = el.querySelector('.ew-plain-wrap'), pivotWrap = el.querySelector('.ew-pivot-wrap');
        modeSel.addEventListener('change', function () {
          var pv = modeSel.value === 'pivot';
          plainWrap.style.display = pv ? 'none' : '';
          pivotWrap.style.display = pv ? '' : 'none';
        });
        el.querySelector('.fp-all').addEventListener('click', function () { [].forEach.call(el.querySelectorAll('.ew-col-chk'), function (c) { c.checked = true; }); });
        el.querySelector('.fp-none').addEventListener('click', function () { [].forEach.call(el.querySelectorAll('.ew-col-chk'), function (c) { c.checked = false; }); });
      }
      el.querySelector('.fp-apply').addEventListener('click', function () {
        applyWidgetStyleSection(el, widget);
        if (widget.type === 'kpi') {
          var agg = el.querySelector('.ew-agg').value;
          widget.config.agg = agg;
          widget.config.colKey = agg === 'count' ? null : el.querySelector('.ew-col').value;
          widget.config.label = el.querySelector('.ew-label').value.trim() || null;
          delete widget.config.snapshot; // แก้ค่าคำนวณเองแล้ว เลิกเป็นสแนปช็อตแช่แข็ง กลับมาคำนวณสดตามปกติ
        } else if (widget.type === 'chart') {
          widget.config.chartType = el.querySelector('.ew-charttype').value;
          widget.config.catColKey = el.querySelector('.ew-cat').value;
          widget.config.numColKey = el.querySelector('.ew-val').value;
          delete widget.config.snapshot;
        } else if (widget.type === 'table') {
          widget.config.mode = el.querySelector('.ew-mode').value;
          widget.config.cols = [].map.call(el.querySelectorAll('.ew-col-chk:checked'), function (c) { return c.getAttribute('data-col'); });
          widget.config.pivotRow = el.querySelector('.ew-pivot-row').value;
          widget.config.pivotCol = el.querySelector('.ew-pivot-col').value;
          widget.config.pivotVal = el.querySelector('.ew-pivot-val').value;
          widget.config.pivotAgg = el.querySelector('.ew-pivot-agg').value;
        }
        renderWidgetBody(widget, itemEl);
        persistDebounced();
        close();
      });
    }, true);
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
      var numStatAccent = state.cardColors.numStat && state.cardColors.numStat.accent;
      numCols.slice(0, 4).forEach(function (col) {
        var s = statOf(rows, col.key);
        if (!s) return;
        html += '<div class="stat-tile"><div class="lbl">' + escapeHtml(col.label) + '</div>' +
          '<div class="val"' + (numStatAccent ? ' style="color:' + numStatAccent + '"' : '') + '>' + s.sum.toLocaleString(locale(), { maximumFractionDigits: 2 }) + '</div>' +
          '<div class="sub">' + t('statTileSub', {
            avg: s.avg.toLocaleString(locale(), { maximumFractionDigits: 2 }),
            min: s.min.toLocaleString(locale(), { maximumFractionDigits: 2 }),
            max: s.max.toLocaleString(locale(), { maximumFractionDigits: 2 })
          }) + '</div></div>';
      });
      if (html) { $('numStatRow').innerHTML = html; $('numStatCard').style.display = 'block'; applyCardColor('numStatCard', 'numStat'); anyRendered = true; }
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
      var barCfg = buildChartConfig(barType, barEntries.map(function (e) { return e[0]; }), barEntries.map(function (e) { return e[1]; }), cardColorAccent('bar'));
      barCfg.options.onClick = function (evt, els) {
        if (!els || !els.length) return;
        var label = barEntries[els[0].index][0];
        if (label === t('otherBucket')) return; // รวมหลายค่า กรองเป็นค่าเดียวไม่ได้จริง
        setDrill(barCat.key, barCat.label, label);
      };
      charts.bar = new Chart($('barChart').getContext('2d'), barCfg);
      $('barChartCard').style.display = 'block'; applyCardColor('barChartCard', 'bar'); anyRendered = true;
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
        var lineCfg = buildChartConfig(lineType, lineEntries.map(function (e) { return e[0]; }), lineEntries.map(function (e) { return e[1]; }), cardColorAccent('line'));
        lineCfg.options.onClick = function (evt, els) {
          if (!els || !els.length) return;
          var label = lineEntries[els[0].index][0];
          setDrill(lineDate.key, lineDate.label, label);
        };
        charts.line = new Chart($('lineChart').getContext('2d'), lineCfg);
        $('lineChartCard').style.display = 'block'; applyCardColor('lineChartCard', 'line'); anyRendered = true;
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
      var pieCfg = buildChartConfig(pieType, pieEntries.map(function (e) { return e[0]; }), pieEntries.map(function (e) { return e[1]; }), cardColorAccent('pie'));
      pieCfg.options.onClick = function (evt, els) {
        if (!els || !els.length) return;
        var label = pieEntries[els[0].index][0];
        if (label === t('otherBucket')) return;
        setDrill(pieCat.key, pieCat.label, label);
      };
      charts.pie = new Chart($('pieChart').getContext('2d'), pieCfg);
      $('pieChartCard').style.display = 'block'; applyCardColor('pieChartCard', 'pie'); anyRendered = true;
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
      columns: state.columns, rows: state.rows, nextRowId: state.nextRowId, customWidgets: state.customWidgets,
      cardColors: state.cardColors, customBg: state.customBg, savedAt: Date.now() };
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
    state.customWidgets = rec.customWidgets || [];
    state.cardColors = rec.cardColors || {};
    state.customBg = rec.customBg || null;
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
  /* หา element ของ view ที่กำลังเปิดอยู่จริงตอนนี้ (แดชบอร์ดอัตโนมัติ หรือ กำหนดเอง) ให้ปุ่ม export/พิมพ์
     ที่ย้ายมาอยู่นอก 2 แท็บนี้แล้วใช้จับภาพจากอันที่ถูกต้องเสมอ — ก่อนหน้านี้ hardcode #dashboardView
     ตัวเดียว กดจากแท็บ "กำหนดเอง" แล้วได้ภาพว่างเปล่า (หรือกดไม่ได้เลยเพราะปุ่มซ่อนไปกับแท็บ) */
  function activeExportViewEl() { return currentView === 'custom' ? $('customView') : $('dashboardView'); }
  /* ── ซ่อนแถบเครื่องมือ/ตัวเลือก/ตัวกรองที่กดไม่ได้อยู่แล้วชั่วคราวตอนแคปภาพ (html2canvas) — คืนค่ากลับ
     เสมอไม่ว่าจะสำเร็จหรือพลาด กันเผลอค้างซ่อนถาวรถ้า promise reject ═══ */
  function withControlsHidden(fn) {
    var el = activeExportViewEl();
    el.classList.add('hide-controls');
    var restore = function () { el.classList.remove('hide-controls'); };
    return fn().then(function (v) { restore(); return v; }, function (e) { restore(); throw e; });
  }
  function exportDashboardImage() {
    if (typeof window.html2canvas === 'undefined') { alert(t('exportLibFail')); return; }
    withControlsHidden(function () {
      return window.html2canvas(activeExportViewEl(), { backgroundColor: '#F3F5F8', scale: 2 });
    }).then(function (canvas) {
      canvas.toBlob(function (blob) { if (blob) downloadBlob(blob, exportFileBase() + '.png'); });
    });
  }
  /* ตัด canvas เป็นหลายหน้า A4 ถ้าสูงเกิน 1 หน้า — เคลิบเดียวกับ generatePdf() ใน excel.js */
  function exportDashboardPdf() {
    var jsPDFctor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFctor || !window.html2canvas) { window.print(); return; }
    withControlsHidden(function () {
      return window.html2canvas(activeExportViewEl(), { backgroundColor: '#F3F5F8', scale: 2 });
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
  /* ตารางของกล่อง "ตาราง" ในแท็บกำหนดเอง แบบ HTML ดิบ (ไม่ผูก event) สำหรับฝังในไฟล์ export แบบสแตนด์อโลน
     ใช้ตรรกะเดียวกับ renderTableWidgetTable() ทุกประการ (โหมดข้อมูล/pivot) แค่ไม่ต้อง wire ตัวกรอง/เรียง */
  function tableWidgetHtmlForExport(cfg) {
    if (cfg.mode === 'pivot') {
      var piv = cfg.pivotRow ? buildPivot(state.rows, true, { rowKey: cfg.pivotRow, colKey: cfg.pivotCol, valKey: cfg.pivotVal, agg: cfg.pivotAgg }) : null;
      return piv ? ('<table>' + pivotTableHtml(piv) + '</table>') : '';
    }
    if (!cfg.cols.length) return '';
    var r = tableWidgetPlainRows(cfg);
    var thead = '<thead><tr>' + r.cols.map(function (c) { return '<th class="' + (c.type === 'number' ? 'num' : '') + '">' + escapeHtml(c.label) + '</th>'; }).join('') + '</tr></thead>';
    var tbody = '<tbody>' + r.rows.map(function (row) {
      return '<tr>' + r.cols.map(function (c) { return '<td class="' + (c.type === 'number' ? 'num' : '') + '">' + escapeHtml(tableWidgetCellDisplay(row[c.key], c.type)) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody>';
    return '<table>' + thead + tbody + '</table>';
  }
  /* export กล่อง "กำหนดเอง" เป็น HTML สแตนด์อโลน — คนละโครงสร้างจากแดชบอร์ดอัตโนมัติ (คอลัมน์/การคำนวณ
     เลือกเองอิสระต่อกล่อง ไม่ใช่ 4 การ์ดตายตัว) เรียงลำดับกล่องตามตำแหน่ง y แล้ว x ให้ใกล้เคียงลำดับที่เห็น
     บนจอจริงมากที่สุด (GridStack วางอิสระ ไม่มีลำดับ DOM ที่แน่นอนอยู่แล้ว) */
  function buildCustomHtmlDoc() {
    var title = escapeHtml(exportFileBase());
    var widgets = state.customWidgets.slice().sort(function (a, b) { return (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0); });
    var chartIdx = 0, chartScripts = [];
    var body = widgets.map(function (w) {
      if (w.type === 'kpi') {
        var r = computeKpiWidgetValue(w.config);
        return '<div class="card"><div class="stat-row"><div class="stat-tile"><div class="lbl">' + escapeHtml(r.label) + '</div>' +
          '<div class="val" style="color:' + widgetAccent(w.config) + '">' + r.value + '</div></div></div></div>';
      }
      if (w.type === 'chart') {
        var chartInst = customCharts[w.id];
        var cfg = cleanChartConfigForExport(chartInst);
        if (!cfg) return '';
        var canvasId = 'cwc' + (chartIdx++);
        chartScripts.push('new Chart(document.getElementById("' + canvasId + '").getContext("2d"),' + JSON.stringify(cfg) + ');');
        return '<div class="card"><div class="chart-wrap"><canvas id="' + canvasId + '"></canvas></div></div>';
      }
      if (w.type === 'table') {
        var tbl = tableWidgetHtmlForExport(w.config);
        return tbl ? '<div class="card">' + tbl + '</div>' : '';
      }
      // text
      return '<div class="card" style="color:' + ((w.config.style && w.config.style.accent) || 'inherit') + '">' + escapeHtml(w.config.text || '') + '</div>';
    }).join('');
    var html = '<!DOCTYPE html><html lang="' + getUILang() + '"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1"><title>' + title + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700;800&display=swap" rel="stylesheet">' +
      '<style>:root{--bg:#F3F5F8;--card:#fff;--ink:#151A23;--muted:#6B7280;--line:#E7E9F0;' +
      '--sh:0 1px 2px rgba(16,24,40,.04),0 10px 26px rgba(16,24,40,.07)}' +
      '*{box-sizing:border-box;margin:0;padding:0}' +
      'body{font-family:Prompt,system-ui,sans-serif;background:var(--bg);color:var(--ink);padding:22px 16px 60px;-webkit-font-smoothing:antialiased}' +
      '.wrap{max-width:820px;margin:0 auto}' +
      'h1{font-size:20px;font-weight:800}.sub{font-size:12.5px;color:var(--muted);margin-top:4px;margin-bottom:4px}' +
      '.card{background:var(--card);border-radius:16px;box-shadow:var(--sh);padding:18px;margin-top:14px;white-space:pre-wrap;line-height:1.6}' +
      '.stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}' +
      '.stat-tile .lbl{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.02em}' +
      '.stat-tile .val{font-size:21px;font-weight:800;margin-top:4px;font-variant-numeric:tabular-nums}' +
      '.chart-wrap{position:relative;height:280px}' +
      'table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line)}' +
      'th.num,td.num{text-align:right}.foot{font-size:11.5px;color:var(--muted);text-align:center;margin-top:22px}' +
      '</style></head><body><div class="wrap">' +
      '<h1>🧩 ' + title + '</h1>' +
      '<div class="sub">' + escapeHtml(t('exportedAt', { date: new Date().toLocaleString(locale()), n: state.rows.length.toLocaleString(locale()) })) + '</div>' +
      body +
      '<div class="foot">' + escapeHtml(t('exportedFooter')) + '</div></div>' +
      '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"><\/script><script>' + chartScripts.join('') + '<\/script></body></html>';
    return html;
  }
  function exportDashboardHtml() {
    if (!state.rows.length) { alert(t('exportNoData')); return; }
    var doc = currentView === 'custom' ? buildCustomHtmlDoc() : buildDashboardHtmlDoc();
    var blob = new Blob([doc], { type: 'text/html;charset=utf-8;' });
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
    state.customWidgets = [];
    state.cardColors = {};
    state.customBg = null;
    state.cellSel = null;
    state.reportId = null; state.reportName = null;
    updateDrillBanner(); updateSaveUI();
    $('dataCard').style.display = 'none';
    $('dashboardView').style.display = 'none';
    $('customView').style.display = 'none';
    $('dashExportToolbar').style.display = 'none';
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
    $('addColBtn').addEventListener('click', addColumn);
    wireTableCopyPaste();
    [].forEach.call(document.querySelectorAll('.card-color-btn'), function (btn) {
      btn.addEventListener('click', function () { openCardColorPopover(btn.getAttribute('data-role'), btn, renderDashboard); });
    });
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
    $('addWidgetBtn').addEventListener('click', function () { openAddWidgetPicker($('addWidgetBtn')); });
    $('loadTemplateBtn').addEventListener('click', loadCustomFromDashboard);
    $('customBgBtn').addEventListener('click', function () { openCustomBgPopover($('customBgBtn')); });
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
    state.customWidgets = saved.customWidgets || [];
    state.cardColors = saved.cardColors || {};
    state.customBg = saved.customBg || null;
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
