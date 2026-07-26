/* ══════════════════════════════════════════════════════════════════
   Tanot — word.js
   งาน Word: โปรแกรมประมวลผลคำแบบ Word เต็มรูปแบบ พร้อม ribbon แยกแท็บ
   (หน้าแรก / แทรก / เค้าโครงหน้ากระดาษ / การอ้างอิง / ตรวจทาน)
   จัดรูปแบบตัวอักษร/ย่อหน้า, ฟอนต์+ขนาด pt จริง, ตัวยก/ตัวห้อย, สี, ไฮไลต์,
   ตาราง, รูปภาพ, ลิงก์, สัญลักษณ์, วันที่, เส้นคั่น, ขึ้นหน้าใหม่,
   สารบัญอัตโนมัติ, เชิงอรรถ, หัว-ท้ายกระดาษ, ขนาด/แนว/ขอบกระดาษ,
   พูดแล้วขึ้นข้อความ (Dictate), อ่านออกเสียง, ตรวจคำผิด, สรุปเนื้อหา,
   นำเข้า/ส่งออก .docx จริง (คงรูปแบบ) — ทำงานในเบราว์เซอร์ทั้งหมด
   ══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var LANGUAGES = [
  { code: 'th', label: 'ไทย', labelEn: 'Thai', ltCode: null, speechLang: 'th-TH' },
  { code: 'en', label: 'อังกฤษ', labelEn: 'English', ltCode: 'en-US', speechLang: 'en-US' },
  { code: 'ja', label: 'ญี่ปุ่น', labelEn: 'Japanese', ltCode: null, speechLang: 'ja-JP' },
  { code: 'zh', label: 'จีน', labelEn: 'Chinese', ltCode: null, speechLang: 'zh-CN' },
  { code: 'ko', label: 'เกาหลี', labelEn: 'Korean', ltCode: null, speechLang: 'ko-KR' },
  { code: 'de', label: 'เยอรมัน', labelEn: 'German', ltCode: 'de-DE', speechLang: 'de-DE' },
  { code: 'hi', label: 'อินเดีย (ฮินดี)', labelEn: 'Indian (Hindi)', ltCode: null, speechLang: 'hi-IN' },
  { code: 'fr', label: 'ฝรั่งเศส', labelEn: 'French', ltCode: 'fr', speechLang: 'fr-FR' },
  { code: 'it', label: 'อิตาลี', labelEn: 'Italian', ltCode: 'it', speechLang: 'it-IT' },
  { code: 'my', label: 'พม่า', labelEn: 'Burmese', ltCode: null, speechLang: 'my-MM' },
  { code: 'km', label: 'กัมพูชา', labelEn: 'Khmer', ltCode: null, speechLang: 'km-KH' },
  { code: 'lo', label: 'ลาว', labelEn: 'Lao', ltCode: null, speechLang: 'lo-LA' },
  { code: 'vi', label: 'เวียดนาม', labelEn: 'Vietnamese', ltCode: null, speechLang: 'vi-VN' },
  { code: 'ms', label: 'มาเลเซีย', labelEn: 'Malay', ltCode: null, speechLang: 'ms-MY' },
  { code: 'ar', label: 'อาหรับ', labelEn: 'Arabic', ltCode: 'ar', speechLang: 'ar-SA' }
];
var LT_ENDPOINT = 'https://api.languagetool.org/v2/check';
/* ฟอนต์เริ่มต้นของเอกสาร Word (ฟอนต์ราชการไทยมาตรฐาน — หนา/คมกว่า Prompt) */
var DEFAULT_DOC_FONT = 'TH Sarabun New';
var DEFAULT_DOC_SIZE = 32; /* half-points = 16pt (ขนาดมาตรฐานเอกสารราชการไทย) */
var AUTOSAVE_KEY = 'tanot:word:autosave';
var UI_LANG_KEY = 'tanot:doclang';

/* ── ขนาดกระดาษ: มิลลิเมตร (จอ) + twips (docx) ── */
var PAGE_SIZES = {
  A4:     { mmW: 210, mmH: 297, twW: 11906, twH: 16838 },
  Letter: { mmW: 216, mmH: 279, twW: 12240, twH: 15840 },
  Legal:  { mmW: 216, mmH: 356, twW: 12240, twH: 20160 },
  A5:     { mmW: 148, mmH: 210, twW: 8391,  twH: 11906 }
};
var MARGINS = {
  normal: { css: '2.54cm', tw: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
  narrow: { css: '1.27cm', tw: { top: 720, right: 720, bottom: 720, left: 720 } },
  wide:   { css: '2.54cm 5.08cm', tw: { top: 1440, right: 2160, bottom: 1440, left: 2160 } }
};
var SIZE_SCALE = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

function getUILang() {
  try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; }
  catch (e) { return 'th'; }
}
function setUILang(lang) { try { localStorage.setItem(UI_LANG_KEY, lang); } catch (e) {} }

var I18N = {
  th: {
    docTitle: 'งาน Word | Tanot',
    crumbResp: 'งานที่รับผิดชอบ', crumbWord: 'งาน Word',
    pageTitle: 'งาน Word: พิมพ์และแก้ไขเอกสาร',
    pageDesc: 'พิมพ์เอกสารตั้งแต่หน้าว่าง หรือนำเข้าไฟล์ (.txt .docx .pdf .png .jpg) แล้วจัดรูปแบบด้วยเครื่องมือแบบ Word เต็มรูปแบบ — จัดหน้า, ตาราง, สัญลักษณ์, สารบัญ, เชิงอรรถ, หัว-ท้ายกระดาษ, พูดแล้วขึ้นข้อความ, ตรวจคำผิด แล้วดาวน์โหลดเป็น .docx — ทำงานในเบราว์เซอร์ของคุณทั้งหมด',
    newDocBtn: 'หน้าใหม่', importBtn: 'นำเข้าไฟล์', downloadBtn: 'ดาวน์โหลด Word', printBtn: 'พิมพ์ / PDF',
    tabHome: 'หน้าแรก', tabInsert: 'แทรก', tabLayout: 'เค้าโครงหน้ากระดาษ', tabRefs: 'การอ้างอิง', tabReview: 'ตรวจทาน',
    grpUndo: 'เลิกทำ', grpClipboard: 'คลิปบอร์ด', grpFont: 'แบบอักษร', grpParagraph: 'ย่อหน้า', grpStyles: 'สไตล์',
    grpTable: 'ตาราง', grpIllustration: 'ภาพประกอบ', grpLink: 'ลิงก์', grpHeaderFooter: 'หัว-ท้ายกระดาษ', grpSymbols: 'สัญลักษณ์',
    grpPageSetup: 'ตั้งค่าหน้ากระดาษ', grpTOC: 'สารบัญ', grpFootnotes: 'เชิงอรรถ',
    grpProofing: 'การพิสูจน์อักษร', grpSpeech: 'เสียง', grpTools: 'เครื่องมือ',
    styleNormal: 'ปกติ', styleNoSpacing: 'ไม่เว้นระยะ', styleTitle: 'ชื่อเรื่อง', styleSubtitle: 'ชื่อเรื่องรอง',
    styleH1: 'หัวข้อ 1', styleH2: 'หัวข้อ 2', styleH3: 'หัวข้อ 3', styleH4: 'หัวข้อ 4', styleQuote: 'คำพูดอ้างอิง', styleIntenseQuote: 'อ้างอิงเข้ม',
    findReplaceTitle: 'ค้นหาและแทนที่ (Ctrl+H)', findReplaceWord: 'ค้นหา/แทนที่', findReplaceModalTitle: 'ค้นหาและแทนที่',
    findLabel: 'ค้นหา', replaceLabel: 'แทนที่ด้วย', matchCaseLabel: 'ตรงตามตัวพิมพ์ใหญ่-เล็ก',
    replaceOneBtn: 'แทนที่', replaceAllBtn: 'แทนที่ทั้งหมด', findNextBtn: 'ค้นหาถัดไป',
    findCountFound: 'พบ {n} จุด', findCountNone: 'ไม่พบคำที่ค้นหา', findCountPos: 'จุดที่ {i} จาก {n}', replacedN: 'แทนที่แล้ว {n} จุด',
    tableWord: 'ตาราง', imageWord: 'รูปภาพ', linkWord: 'ลิงก์', headerFooterWord: 'หัว-ท้ายกระดาษ', symbolWord: 'สัญลักษณ์', dateWord: 'วันที่',
    pageSizeLabel: 'ขนาดกระดาษ', orientationLabel: 'แนวกระดาษ', portrait: 'แนวตั้ง', landscape: 'แนวนอน',
    marginLabel: 'ขอบกระดาษ', marginNormal: 'ปกติ', marginNarrow: 'แคบ', marginWide: 'กว้าง',
    tocWord: 'สารบัญ', tocUpdateWord: 'อัปเดต', footnoteWord: 'เชิงอรรถ',
    runBtn: 'ตรวจคำผิด', speakWord: 'อ่านออกเสียง', dictateWord: 'พูดเป็นข้อความ', summarizeBtn: 'สรุปเนื้อหา', wordCountWord: 'จำนวนคำ',
    issuesFoundHeading: 'จุดที่พบ', applyFixBtn: 'แก้ไขทั้งหมดในเอกสาร', issueEmptyText: 'ไม่พบจุดที่ควรแก้',
    issueHint: 'กด "ตรวจคำผิด" เพื่อดูจุดที่ควรแก้ที่นี่',
    headerTag: 'หัวกระดาษ', footerTag: 'ท้ายกระดาษ', footnotesHeading: 'เชิงอรรถ',
    wordsLabel: 'คำ', charsLabel: 'ตัวอักษร', autosaveIdle: 'พร้อมบันทึกอัตโนมัติ', autosaveSaved: 'บันทึกอัตโนมัติแล้ว',
    footerText: 'Tanot — งานที่รับผิดชอบ',
    linkModalTitle: 'แทรกลิงก์', linkUrlLabel: 'URL', modalCancel: 'ยกเลิก', modalInsert: 'แทรก', modalSave: 'บันทึก', modalClose: 'ปิด',
    tableModalTitle: 'แทรกตาราง', tableRowsLabel: 'แถว', tableColsLabel: 'คอลัมน์', tableHeaderRow: 'มีแถวหัวตาราง',
    footnoteModalTitle: 'แทรกเชิงอรรถ', footnoteTextLabel: 'ข้อความเชิงอรรถ',
    headerWord: 'หัวกระดาษ', footerWord: 'ท้ายกระดาษ', pageNumWord: 'เลขหน้า',
    editHeaderTitle: 'แก้ไขหัวกระดาษ', editFooterTitle: 'แก้ไขท้ายกระดาษ', pageNumTitle: 'ใส่/เอาเลขหน้าออก (เฉพาะไฟล์ Word)', removeHFTitle: 'ลบหัว-ท้ายกระดาษ',
    headerPh: 'หัวกระดาษ — แตะเพื่อพิมพ์ (เว้นว่างไว้ถ้าไม่ต้องการ)', footerPh: 'ท้ายกระดาษ — แตะเพื่อพิมพ์ (เว้นว่างไว้ถ้าไม่ต้องการ)',
    pageNumNote: '↑ จะใส่เลขหน้าอัตโนมัติที่ท้ายกระดาษเมื่อดาวน์โหลดเป็นไฟล์ Word',
    pageNumOn: 'เปิดใส่เลขหน้าที่ท้ายกระดาษ (จะปรากฏในไฟล์ Word)', pageNumOff: 'ปิดการใส่เลขหน้า',
    headerFooterRemoved: 'ลบหัว-ท้ายกระดาษแล้ว',
    symbolModalTitle: 'แทรกสัญลักษณ์', wordCountModalTitle: 'จำนวนคำ',
    undoBtnTitle: 'เลิกทำ', redoBtnTitle: 'ทำซ้ำ', cutTitle: 'ตัด', copyTitle: 'คัดลอก', pasteTitle: 'วางแบบข้อความ',
    growFontTitle: 'ขยายตัวอักษร', shrinkFontTitle: 'ย่อตัวอักษร',
    boldBtnTitle: 'ตัวหนา', italicBtnTitle: 'ตัวเอียง', underlineBtnTitle: 'ขีดเส้นใต้', strikeBtnTitle: 'ขีดฆ่า',
    subTitle: 'ตัวห้อย', supTitle: 'ตัวยก',
    textColorTitle: 'สีตัวอักษร', highlightTitle: 'สีไฮไลต์', clearFormatTitle: 'ล้างรูปแบบ',
    alignLeftTitle: 'ชิดซ้าย', alignCenterTitle: 'กึ่งกลาง', alignRightTitle: 'ชิดขวา', alignJustifyTitle: 'กระจายบรรทัด', lineSpacingTitle: 'ระยะห่างบรรทัด',
    ulBtnTitle: 'สัญลักษณ์หัวข้อย่อย', olBtnTitle: 'ลำดับเลข', outdentBtnTitle: 'ลดระยะเยื้อง', indentBtnTitle: 'เพิ่มระยะเยื้อง',
    tableBtnTitle: 'แทรกตาราง', imageBtnTitle: 'แทรกรูปภาพ', linkBtnTitle: 'แทรกลิงก์', headerFooterTitle: 'หัวกระดาษ / ท้ายกระดาษ',
    symbolTitle: 'แทรกสัญลักษณ์', dateTitle: 'แทรกวันที่', hrBtnTitle: 'เส้นคั่น', pageBreakTitle: 'ขึ้นหน้าใหม่',
    tocTitle: 'แทรกสารบัญ', tocUpdateTitle: 'ปรับปรุงสารบัญ', footnoteTitle: 'แทรกเชิงอรรถ',
    speakBtnTitle: 'อ่านออกเสียงเอกสาร', stopSpeakTitle: 'หยุดอ่าน',
    dictateBtnTitle: 'พูดแล้วขึ้นข้อความ (Dictate)', stopDictateTitle: 'หยุดฟัง', wordCountTitle: 'จำนวนคำ',
    editorPlaceholder: 'เริ่มพิมพ์เอกสารตรงนี้...',
    langAiPending: ' (รอ AI ขั้นสูง)',
    readingFile: 'กำลังนำเข้าไฟล์...', fileImported: 'นำเข้าไฟล์ "{name}" เรียบร้อย — เพิ่มเนื้อหาเข้าเอกสารแล้ว',
    fileReadError: 'เกิดข้อผิดพลาด: {msg}', unsupportedFileType: 'ไม่รองรับไฟล์ประเภทนี้ (รองรับ .txt .docx .pdf .png .jpg)',
    ocrNoText: '(ไม่พบข้อความในภาพ)', pdfNoTextPage: '(ไม่พบข้อความในหน้านี้ — อาจเป็นภาพสแกน)',
    checking: 'กำลังตรวจคำผิด...', checkedResult: 'ตรวจพบ {n} จุดที่ควรแก้ไข',
    checkError: 'เกิดข้อผิดพลาดระหว่างตรวจคำผิด: {msg}', ltServiceError: 'บริการตรวจคำผิดตอบกลับผิดพลาด ({status})',
    langNotSupported: 'ภาษา "{lang}" ยังไม่มีบริการตรวจคำผิดสาธารณะที่แม่นยำพอ — ระบบจะเปิดให้ใช้การตรวจขั้นสูงในเฟสถัดไป',
    noTextToCheck: 'ยังไม่มีข้อความในเอกสารให้ตรวจ',
    fixAllDone: 'แก้ไขคำผิดแล้ว {n} จุด',
    fixAllDoneSkipped: 'แก้ไขคำผิดแล้ว {n} จุด (ข้าม {skipped} จุดเพราะเอกสารถูกแก้ไขระหว่างทาง — ลองตรวจคำผิดใหม่อีกครั้ง)',
    singleFixDone: 'แก้ "{old}" เป็น "{new}" แล้ว',
    fixSkipped: 'ไม่สามารถระบุตำแหน่งจุดนี้ได้แน่นอน (เอกสารอาจถูกแก้ไขหลังตรวจ) — ลองตรวจคำผิดใหม่',
    badgeStyle: 'สไตล์/ความเป็นทางการ', badgeSpelling: 'คำผิด/ไวยากรณ์',
    newDocConfirm: 'ล้างเอกสารปัจจุบันและเริ่มหน้าใหม่? (ฉบับร่างที่บันทึกอัตโนมัติไว้จะถูกลบด้วย)', clearedDoc: 'ล้างเอกสารแล้ว',
    summarizeEmpty: 'ยังไม่มีเนื้อหาให้สรุป',
    summarized: 'เพิ่มสรุปเนื้อหาเบื้องต้นต่อท้ายเอกสารแล้ว (เลือกประโยคสำคัญด้วยกฎทางสถิติ)', summaryHeading: '— สรุปเนื้อหาเบื้องต้น —',
    downloadError: 'ดาวน์โหลดไม่สำเร็จ: {msg}', downloadEmpty: 'ยังไม่มีเนื้อหาให้ดาวน์โหลด',
    pdfGenerating: 'กำลังสร้างไฟล์ PDF…', pdfDone: 'สร้างไฟล์ PDF เรียบร้อยแล้ว', pdfError: 'สร้าง PDF ไม่สำเร็จ: {msg}',
    dictateUnsupported: 'เบราว์เซอร์นี้ไม่รองรับการพูดแล้วขึ้นข้อความ (ลองใช้ Chrome)',
    dictateListening: 'กำลังฟัง... พูดได้เลย', dictateListeningInterim: 'กำลังฟัง... "{text}"',
    dictateError: 'เกิดข้อผิดพลาดขณะฟัง: {msg}', dictateNoMic: 'ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน — กรุณาอนุญาตการใช้งานไมค์ในเบราว์เซอร์',
    dictateStopped: 'หยุดฟังแล้ว',
    linkNeedUrl: 'กรุณาใส่ URL ก่อนแทรกลิงก์', restoredDraft: 'กู้คืนฉบับร่างล่าสุดที่บันทึกอัตโนมัติไว้',
    tocInserted: 'แทรกสารบัญจากหัวข้อในเอกสารแล้ว', tocUpdated: 'ปรับปรุงสารบัญแล้ว',
    tocNoHeadings: 'ยังไม่มีหัวข้อ (หัวข้อ 1-3) ในเอกสาร — จัดข้อความเป็นหัวข้อก่อนแล้วค่อยแทรกสารบัญ',
    tocNoExisting: 'ยังไม่มีสารบัญในเอกสาร — กด "สารบัญ" เพื่อแทรกก่อน',
    tocDocTitle: 'สารบัญ',
    footnoteInserted: 'แทรกเชิงอรรถที่ {n} แล้ว', footnoteEmpty: 'กรุณาพิมพ์ข้อความเชิงอรรถก่อน',
    headerFooterSaved: 'บันทึกหัว-ท้ายกระดาษแล้ว', symbolInserted: 'แทรกสัญลักษณ์แล้ว',
    pageSetupChanged: 'ปรับตั้งค่าหน้ากระดาษแล้ว',
    pasteError: 'วางไม่สำเร็จ — เบราว์เซอร์ไม่อนุญาตให้อ่านคลิปบอร์ด (ลองกด Ctrl+V แทน)',
    wcWords: 'จำนวนคำ', wcCharsWith: 'ตัวอักษร (รวมเว้นวรรค)', wcCharsNo: 'ตัวอักษร (ไม่รวมเว้นวรรค)', wcParagraphs: 'ย่อหน้า', wcFootnotes: 'เชิงอรรถ'
  },
  en: {
    docTitle: 'Word | Tanot',
    crumbResp: 'Responsibilities', crumbWord: 'Word',
    pageTitle: 'Word: Write and Edit Documents',
    pageDesc: 'Start typing from a blank page, or import a file (.txt .docx .pdf .png .jpg), then format it with full Word-like tools — page setup, tables, symbols, table of contents, footnotes, headers/footers, dictation, spell check, and download it as a .docx file — everything runs in your browser.',
    newDocBtn: 'New Page', importBtn: 'Import File', downloadBtn: 'Download Word', printBtn: 'Print / PDF',
    tabHome: 'Home', tabInsert: 'Insert', tabLayout: 'Layout', tabRefs: 'References', tabReview: 'Review',
    grpUndo: 'Undo', grpClipboard: 'Clipboard', grpFont: 'Font', grpParagraph: 'Paragraph', grpStyles: 'Styles',
    grpTable: 'Table', grpIllustration: 'Illustrations', grpLink: 'Links', grpHeaderFooter: 'Header & Footer', grpSymbols: 'Symbols',
    grpPageSetup: 'Page Setup', grpTOC: 'Table of Contents', grpFootnotes: 'Footnotes',
    grpProofing: 'Proofing', grpSpeech: 'Speech', grpTools: 'Tools',
    styleNormal: 'Normal', styleNoSpacing: 'No Spacing', styleTitle: 'Title', styleSubtitle: 'Subtitle',
    styleH1: 'Heading 1', styleH2: 'Heading 2', styleH3: 'Heading 3', styleH4: 'Heading 4', styleQuote: 'Quote', styleIntenseQuote: 'Intense Quote',
    findReplaceTitle: 'Find & Replace (Ctrl+H)', findReplaceWord: 'Find/Replace', findReplaceModalTitle: 'Find & Replace',
    findLabel: 'Find', replaceLabel: 'Replace with', matchCaseLabel: 'Match case',
    replaceOneBtn: 'Replace', replaceAllBtn: 'Replace All', findNextBtn: 'Find Next',
    findCountFound: 'Found {n}', findCountNone: 'No matches found', findCountPos: 'Match {i} of {n}', replacedN: 'Replaced {n}',
    tableWord: 'Table', imageWord: 'Picture', linkWord: 'Link', headerFooterWord: 'Header/Footer', symbolWord: 'Symbol', dateWord: 'Date',
    pageSizeLabel: 'Page size', orientationLabel: 'Orientation', portrait: 'Portrait', landscape: 'Landscape',
    marginLabel: 'Margins', marginNormal: 'Normal', marginNarrow: 'Narrow', marginWide: 'Wide',
    tocWord: 'Contents', tocUpdateWord: 'Update', footnoteWord: 'Footnote',
    runBtn: 'Check Spelling', speakWord: 'Read Aloud', dictateWord: 'Dictate', summarizeBtn: 'Summarize', wordCountWord: 'Word Count',
    issuesFoundHeading: 'Issues Found', applyFixBtn: 'Fix All in Document', issueEmptyText: 'No issues found',
    issueHint: 'Click "Check Spelling" to see issues here',
    headerTag: 'Header', footerTag: 'Footer', footnotesHeading: 'Footnotes',
    wordsLabel: 'words', charsLabel: 'characters', autosaveIdle: 'Ready to autosave', autosaveSaved: 'Autosaved',
    footerText: 'Tanot — Responsibilities',
    linkModalTitle: 'Insert Link', linkUrlLabel: 'URL', modalCancel: 'Cancel', modalInsert: 'Insert', modalSave: 'Save', modalClose: 'Close',
    tableModalTitle: 'Insert Table', tableRowsLabel: 'Rows', tableColsLabel: 'Columns', tableHeaderRow: 'Include header row',
    footnoteModalTitle: 'Insert Footnote', footnoteTextLabel: 'Footnote text',
    headerWord: 'Header', footerWord: 'Footer', pageNumWord: 'Page No.',
    editHeaderTitle: 'Edit header', editFooterTitle: 'Edit footer', pageNumTitle: 'Toggle page numbers (Word file only)', removeHFTitle: 'Remove header & footer',
    headerPh: 'Header — tap to type (leave blank if not needed)', footerPh: 'Footer — tap to type (leave blank if not needed)',
    pageNumNote: '↑ Page numbers will be added to the footer automatically when you download as a Word file',
    pageNumOn: 'Page numbers enabled in the footer (will appear in the Word file)', pageNumOff: 'Page numbers turned off',
    headerFooterRemoved: 'Header and footer removed',
    symbolModalTitle: 'Insert Symbol', wordCountModalTitle: 'Word Count',
    undoBtnTitle: 'Undo', redoBtnTitle: 'Redo', cutTitle: 'Cut', copyTitle: 'Copy', pasteTitle: 'Paste as text',
    growFontTitle: 'Grow font', shrinkFontTitle: 'Shrink font',
    boldBtnTitle: 'Bold', italicBtnTitle: 'Italic', underlineBtnTitle: 'Underline', strikeBtnTitle: 'Strikethrough',
    subTitle: 'Subscript', supTitle: 'Superscript',
    textColorTitle: 'Text Color', highlightTitle: 'Highlight Color', clearFormatTitle: 'Clear Formatting',
    alignLeftTitle: 'Align Left', alignCenterTitle: 'Align Center', alignRightTitle: 'Align Right', alignJustifyTitle: 'Justify', lineSpacingTitle: 'Line Spacing',
    ulBtnTitle: 'Bulleted List', olBtnTitle: 'Numbered List', outdentBtnTitle: 'Decrease Indent', indentBtnTitle: 'Increase Indent',
    tableBtnTitle: 'Insert Table', imageBtnTitle: 'Insert Picture', linkBtnTitle: 'Insert Link', headerFooterTitle: 'Header / Footer',
    symbolTitle: 'Insert Symbol', dateTitle: 'Insert Date', hrBtnTitle: 'Horizontal Rule', pageBreakTitle: 'Page Break',
    tocTitle: 'Insert Table of Contents', tocUpdateTitle: 'Update Table of Contents', footnoteTitle: 'Insert Footnote',
    speakBtnTitle: 'Read Document Aloud', stopSpeakTitle: 'Stop Reading',
    dictateBtnTitle: 'Dictate (Speech to Text)', stopDictateTitle: 'Stop Listening', wordCountTitle: 'Word Count',
    editorPlaceholder: 'Start typing your document here...',
    langAiPending: ' (advanced AI coming soon)',
    readingFile: 'Importing file...', fileImported: 'Imported "{name}" successfully — added to the document',
    fileReadError: 'An error occurred: {msg}', unsupportedFileType: 'This file type is not supported (supports .txt .docx .pdf .png .jpg)',
    ocrNoText: '(No text found in the image)', pdfNoTextPage: '(No text found on this page — it may be a scanned image)',
    checking: 'Checking spelling...', checkedResult: 'Found {n} issue(s) to fix',
    checkError: 'An error occurred while checking spelling: {msg}', ltServiceError: 'The spell-check service returned an error ({status})',
    langNotSupported: 'The "{lang}" language doesn\'t have an accurate enough public spell-check service yet — advanced checking for it is coming in a future phase.',
    noTextToCheck: 'There\'s no text in the document to check yet',
    fixAllDone: 'Fixed {n} issue(s)',
    fixAllDoneSkipped: 'Fixed {n} issue(s) (skipped {skipped} because the document changed in the meantime — try checking again)',
    singleFixDone: 'Changed "{old}" to "{new}"',
    fixSkipped: 'Couldn\'t pinpoint this issue\'s exact position (the document may have changed since checking) — try checking again',
    badgeStyle: 'Style/Formality', badgeSpelling: 'Spelling/Grammar',
    newDocConfirm: 'Clear the current document and start a new page? (The autosaved draft will be deleted too.)', clearedDoc: 'Document cleared',
    summarizeEmpty: 'There\'s no content to summarize yet',
    summarized: 'Added a basic summary to the end of the document (key sentences picked using statistical rules)', summaryHeading: '— Basic Summary —',
    downloadError: 'Download failed: {msg}', downloadEmpty: 'There\'s no content to download yet',
    pdfGenerating: 'Generating PDF…', pdfDone: 'PDF created successfully', pdfError: 'Couldn\'t create PDF: {msg}',
    dictateUnsupported: 'This browser doesn\'t support Dictate (try Chrome)',
    dictateListening: 'Listening... go ahead and speak', dictateListeningInterim: 'Listening... "{text}"',
    dictateError: 'An error occurred while listening: {msg}', dictateNoMic: 'Microphone access was not granted — please allow microphone access in your browser',
    dictateStopped: 'Stopped listening',
    linkNeedUrl: 'Please enter a URL before inserting the link', restoredDraft: 'Restored your last autosaved draft',
    tocInserted: 'Inserted a table of contents from the document headings', tocUpdated: 'Table of contents updated',
    tocNoHeadings: 'There are no headings (Heading 1-3) in the document yet — format some text as a heading first, then insert a table of contents',
    tocNoExisting: 'There\'s no table of contents in the document yet — click "Contents" to insert one first',
    tocDocTitle: 'Table of Contents',
    footnoteInserted: 'Inserted footnote {n}', footnoteEmpty: 'Please type the footnote text first',
    headerFooterSaved: 'Header and footer saved', symbolInserted: 'Symbol inserted',
    pageSetupChanged: 'Page setup updated',
    pasteError: 'Paste failed — the browser wouldn\'t allow reading the clipboard (try pressing Ctrl+V instead)',
    wcWords: 'Words', wcCharsWith: 'Characters (with spaces)', wcCharsNo: 'Characters (no spaces)', wcParagraphs: 'Paragraphs', wcFootnotes: 'Footnotes'
  }
};

function t(key, vars) {
  var lang = getUILang();
  var str = (I18N[lang] && I18N[lang][key]) || I18N.th[key] || key;
  if (vars) Object.keys(vars).forEach(function (k) { str = str.replace('{' + k + '}', vars[k]); });
  return str;
}
function langLabel(l) { return getUILang() === 'en' ? l.labelEn : l.label; }
function langByCode(code) {
  for (var i = 0; i < LANGUAGES.length; i++) if (LANGUAGES[i].code === code) return LANGUAGES[i];
  return LANGUAGES[0];
}
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ══ สรุปเนื้อหาแบบ extractive ══ */
var SUMMARY_MAX_CHARS = 280;
function splitSentences(text) {
  return text.replace(/\s+/g, ' ').split(/(?<=[.!?。！？])\s+|\n+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
}
function wordFreq(sentences) {
  var freq = {};
  sentences.forEach(function (s) {
    s.toLowerCase().split(/[^\p{L}\p{N}]+/u).forEach(function (w) { if (w.length >= 2) freq[w] = (freq[w] || 0) + 1; });
  });
  return freq;
}
function truncateSummary(s) { return s.length <= SUMMARY_MAX_CHARS ? s : s.slice(0, SUMMARY_MAX_CHARS).trim() + '…'; }
function summarizeText(text, n) {
  n = n || 5;
  var sentences = splitSentences(text);
  if (sentences.length <= n) return truncateSummary(sentences.join(' '));
  var freq = wordFreq(sentences);
  var scored = sentences.map(function (s, i) {
    var words = s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (w) { return w.length >= 2; });
    var score = words.reduce(function (acc, w) { return acc + (freq[w] || 0); }, 0) / (words.length || 1);
    return { s: s, i: i, score: score };
  }).sort(function (a, b) { return b.score - a.score; }).slice(0, n);
  scored.sort(function (a, b) { return a.i - b.i; });
  return truncateSummary(scored.map(function (x) { return x.s; }).join(' '));
}

/* ══ ตรวจคำผิด ══ */
async function checkSpelling(text, ltCode) {
  if (!text.trim()) return [];
  var params = new URLSearchParams({ text: text, language: ltCode, level: 'picky' });
  var res = await fetch(LT_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  if (!res.ok) throw new Error(t('ltServiceError', { status: res.status }));
  var data = await res.json();
  return (data.matches || []).map(function (m) {
    return { offset: m.offset, length: m.length, message: m.message,
      replacements: (m.replacements || []).slice(0, 5).map(function (r) { return r.value; }),
      ruleId: m.rule && m.rule.id, category: m.rule && m.rule.category && m.rule.category.id };
  });
}
function issueKind(category) {
  var styleCats = ['STYLE', 'REDUNDANCY', 'WORDINESS', 'REGISTER', 'COLLOQUIALISMS', 'BRITISH_ENGLISH', 'AMERICAN_ENGLISH_STYLE', 'CONFUSED_WORDS'];
  return styleCats.indexOf(category) !== -1 ? 'style' : 'spelling';
}

/* ══ อ่านไฟล์นำเข้า ══ */
async function readTxtFile(file) { return { kind: 'text', content: await file.text() }; }
async function readDocxFile(file) {
  var buf = await file.arrayBuffer();
  var result = await window.mammoth.convertToHtml({ arrayBuffer: buf });
  return { kind: 'html', content: result.value };
}
async function readPdfFile(file) {
  var buf = await file.arrayBuffer();
  var doc = await window.pdfjsLib.getDocument({ data: buf }).promise;
  var lines = [];
  for (var i = 1; i <= doc.numPages; i++) {
    var page = await doc.getPage(i);
    var content = await page.getTextContent();
    var text = content.items.map(function (it) { return it.str; }).join(' ').trim();
    lines.push(text || t('pdfNoTextPage'));
  }
  return { kind: 'text', content: lines.join('\n\n') };
}
async function readImageFile(file) {
  var result = await window.Tesseract.recognize(file, 'eng+tha');
  return { kind: 'text', content: result.data.text || t('ocrNoText') };
}
async function readAnyFile(file) {
  var name = file.name.toLowerCase();
  if (name.endsWith('.txt')) return readTxtFile(file);
  if (name.endsWith('.docx')) return readDocxFile(file);
  if (name.endsWith('.pdf')) return readPdfFile(file);
  if (/\.(png|jpe?g|webp|bmp)$/.test(name)) return readImageFile(file);
  throw new Error(t('unsupportedFileType'));
}

/* กันแท็ก/แอตทริบิวต์อันตรายจาก .docx ที่แปลงมา */
var SAFE_TAGS = { P: 1, DIV: 1, SPAN: 1, BR: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, S: 1, STRIKE: 1, SUP: 1, SUB: 1, FONT: 1,
  H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, UL: 1, OL: 1, LI: 1, A: 1, IMG: 1,
  TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TD: 1, TH: 1, BLOCKQUOTE: 1, HR: 1, MARK: 1 };
var SAFE_ATTRS = { A: ['href', 'target', 'rel'], IMG: ['src', 'alt', 'width', 'height'],
  FONT: ['face', 'color', 'size'], SPAN: ['style'], P: ['style'], DIV: ['style'],
  H1: ['style'], H2: ['style'], H3: ['style'], LI: ['style'], TD: ['style'], TH: ['style'] };
function sanitizeHtml(html) {
  var doc = new DOMParser().parseFromString(html, 'text/html');
  (function walk(node) {
    Array.from(node.childNodes).forEach(function (child) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!SAFE_TAGS[child.tagName]) {
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child); return;
        }
        Array.from(child.attributes).forEach(function (attr) {
          var allowed = SAFE_ATTRS[child.tagName] || [];
          if (allowed.indexOf(attr.name) === -1) child.removeAttribute(attr.name);
          else if (/^(href|src)$/.test(attr.name) && /^\s*javascript:/i.test(attr.value)) child.removeAttribute(attr.name);
        });
        walk(child);
      } else if (child.nodeType !== Node.TEXT_NODE) { node.removeChild(child); }
    });
  })(doc.body);
  return doc.body.innerHTML;
}
function textToParagraphsHtml(text) {
  return text.split(/\n+/).map(function (line) { return line.trim() ? '<p>' + escapeHtml(line) + '</p>' : ''; }).join('');
}

/* ══ ดึงข้อความล้วน + map offset กลับเป็นตำแหน่ง DOM (ข้ามเชิงอรรถ/สารบัญ/ตัวคั่นหน้า) ══ */
var BLOCK_TAGS = { P: 1, DIV: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, LI: 1, BLOCKQUOTE: 1, TR: 1 };
function shouldSkipForText(el) {
  if (el.nodeType !== Node.ELEMENT_NODE) return false;
  var c = el.className || '';
  return /(^|\s)(wd-fnref|wd-toc|wd-pagebreak)(\s|$)/.test(c);
}
function extractText(root) {
  var text = '';
  (function walk(node) {
    var child = node.firstChild;
    while (child) {
      if (child.nodeType === Node.TEXT_NODE) { text += child.nodeValue; }
      else if (child.nodeType === Node.ELEMENT_NODE) {
        if (shouldSkipForText(child)) { child = child.nextSibling; continue; }
        if (child.tagName === 'BR') { text += '\n'; }
        else { walk(child); if (BLOCK_TAGS[child.tagName]) text += '\n'; }
      }
      child = child.nextSibling;
    }
  })(root);
  return text;
}
function rangeFromOffset(root, start, length) {
  var range = document.createRange();
  var pos = 0, startSet = false, endSet = false;
  function visit(node) {
    var child = node.firstChild;
    while (child) {
      if (child.nodeType === Node.TEXT_NODE) {
        var len = child.nodeValue.length;
        if (!startSet && start <= pos + len) { range.setStart(child, Math.max(0, start - pos)); startSet = true; }
        if (startSet && !endSet && start + length <= pos + len) { range.setEnd(child, Math.max(0, start + length - pos)); endSet = true; return true; }
        pos += len;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (!shouldSkipForText(child)) {
          if (child.tagName === 'BR') { pos += 1; }
          else { if (visit(child)) return true; if (BLOCK_TAGS[child.tagName]) pos += 1; }
        }
      }
      if (endSet) return true;
      child = child.nextSibling;
    }
    return false;
  }
  visit(root);
  return (startSet && endSet) ? range : null;
}
function applyRangeFix(root, m, replacement) {
  var range = rangeFromOffset(root, m.offset, m.length);
  if (!range || range.toString() !== m.matchedText) return false;
  range.deleteContents();
  range.insertNode(document.createTextNode(replacement));
  return true;
}

/* ══ แปลงสี CSS เป็น hex (docx ต้องการ RRGGBB) ══ */
function cssColorToHex(c) {
  if (!c) return null;
  c = c.trim();
  if (c[0] === '#') return c.slice(1).length === 3 ? c.slice(1).split('').map(function (x) { return x + x; }).join('') : c.slice(1);
  var m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) return [m[1], m[2], m[3]].map(function (n) { return (+n).toString(16).padStart(2, '0'); }).join('');
  return null;
}

/* ══ HTML → เอกสาร .docx จริง (คงรูปแบบ + หัว/ท้าย + เชิงอรรถ + ขนาดหน้า) ══ */
async function imageRunFromSrc(src) {
  var docx = window.docx;
  var res = await fetch(src);
  var data = new Uint8Array(await res.arrayBuffer());
  var dims = await new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () { resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = function () { resolve({ w: 300, h: 200 }); };
    img.src = src;
  });
  var scale = dims.w > 400 ? 400 / dims.w : 1;
  return new docx.ImageRun({ data: data, transformation: { width: Math.round(dims.w * scale), height: Math.round(dims.h * scale) } });
}
function styleFromElement(el) {
  var add = {};
  var face = el.getAttribute && el.getAttribute('face');
  var colorAttr = el.getAttribute && el.getAttribute('color');
  var st = el.style || {};
  /* face/fontFamily อาจเป็น stack เช่น "'TH Sarabun New','Sarabun',sans-serif"
     — เอาเฉพาะชื่อฟอนต์ตัวแรกไปใส่ในไฟล์ Word เพื่อให้ Word เปิดด้วยฟอนต์จริง */
  if (face) add.font = face.replace(/['"]/g, '').split(',')[0].trim();
  if (st.fontFamily) add.font = st.fontFamily.replace(/['"]/g, '').split(',')[0].trim();
  if (colorAttr) add.color = colorAttr.replace('#', '');
  if (st.color) { var hx = cssColorToHex(st.color); if (hx) add.color = hx; }
  if (st.fontSize && /pt$/.test(st.fontSize)) add.size = Math.round(parseFloat(st.fontSize) * 2);
  return add;
}
async function nodeToRuns(el, inherited) {
  var docx = window.docx;
  inherited = inherited || {};
  var runs = [];
  var child = el.firstChild;
  while (child) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) runs.push(new docx.TextRun(Object.assign({ text: child.textContent, font: DEFAULT_DOC_FONT }, inherited)));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      var tag = child.tagName;
      if (tag === 'IMG') {
        try { runs.push(await imageRunFromSrc(child.getAttribute('src'))); } catch (e) {}
      } else if (tag === 'SUP' && /wd-fnref/.test(child.className || '') && typeof docx.FootnoteReferenceRun === 'function') {
        var idx = Number(child.getAttribute('data-num')) || 1;
        runs.push(new docx.FootnoteReferenceRun(idx));
      } else {
        var next = Object.assign({}, inherited, styleFromElement(child));
        if (tag === 'B' || tag === 'STRONG') next.bold = true;
        if (tag === 'I' || tag === 'EM') next.italics = true;
        if (tag === 'U') next.underline = {};
        if (tag === 'S' || tag === 'STRIKE') next.strike = true;
        if (tag === 'MARK') next.highlight = 'yellow';
        if (tag === 'SUP') next.superScript = true;
        if (tag === 'SUB') next.subScript = true;
        runs = runs.concat(await nodeToRuns(child, next));
      }
    }
    child = child.nextSibling;
  }
  return runs;
}
var HEADING_TAGS = { H1: 'HEADING_1', H2: 'HEADING_2', H3: 'HEADING_3', H4: 'HEADING_4' };
function paragraphExtras(el) {
  var docx = window.docx;
  var opts = {};
  var align = (el.style && el.style.textAlign) || el.getAttribute('align');
  if (align && docx.AlignmentType) {
    var map = { left: 'LEFT', center: 'CENTER', right: 'RIGHT', justify: 'JUSTIFIED' };
    if (map[align]) opts.alignment = docx.AlignmentType[map[align]];
  }
  var lh = el.style && el.style.lineHeight;
  if (lh && !isNaN(parseFloat(lh))) opts.spacing = { line: Math.round(parseFloat(lh) * 240), lineRule: 'auto' };
  return opts;
}
async function elementToParagraph(el) {
  var docx = window.docx;
  var tag = el.tagName;
  var cls = el.className || '';
  var base = paragraphExtras(el);
  /* สไตล์แบบ Word: ชื่อเรื่อง/ชื่อเรื่องรอง/อ้างอิงเข้ม — คงลุคใกล้เคียงในไฟล์ Word */
  if (/wd-title/.test(cls)) return new docx.Paragraph(Object.assign({ children: await nodeToRuns(el, { bold: true, size: 56 }), spacing: { after: 120 } }, base));
  if (/wd-subtitle/.test(cls)) return new docx.Paragraph(Object.assign({ children: await nodeToRuns(el, { color: '727C93', size: 30 }), spacing: { after: 160 } }, base));
  if (tag === 'BLOCKQUOTE') {
    var qOpts = { children: await nodeToRuns(el, { italics: true }), indent: { left: 480 } };
    if (/wd-intense/.test(cls)) { qOpts.children = await nodeToRuns(el, { italics: true, bold: true, color: '1E7DC4' }); qOpts.alignment = docx.AlignmentType ? docx.AlignmentType.CENTER : undefined; }
    return new docx.Paragraph(Object.assign(qOpts, base));
  }
  if (tag === 'LI') return new docx.Paragraph(Object.assign({ children: await nodeToRuns(el), bullet: { level: 0 } }, base));
  if (HEADING_TAGS[tag]) return new docx.Paragraph(Object.assign({ children: await nodeToRuns(el), heading: docx.HeadingLevel[HEADING_TAGS[tag]] }, base));
  return new docx.Paragraph(Object.assign({ children: await nodeToRuns(el) }, base));
}
async function tableToDocxTable(tableEl) {
  var docx = window.docx;
  var rows = Array.from(tableEl.querySelectorAll('tr'));
  var docxRows = [];
  for (var r = 0; r < rows.length; r++) {
    var cells = Array.from(rows[r].children).filter(function (c) { return c.tagName === 'TD' || c.tagName === 'TH'; });
    var docxCells = [];
    for (var c = 0; c < cells.length; c++) docxCells.push(new docx.TableCell({ children: [new docx.Paragraph({ children: await nodeToRuns(cells[c]) })] }));
    docxRows.push(new docx.TableRow({ children: docxCells }));
  }
  return new docx.Table({ rows: docxRows, width: { size: 100, type: docx.WidthType.PERCENTAGE } });
}
async function htmlToDocxBlob(html, opts) {
  var docx = window.docx;
  opts = opts || {};
  var doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
  /* ให้เลข data-num กับ footnote refs ตามลำดับใน DOM + เก็บข้อความไปทำ footnotes map */
  var footnoteMap = {};
  var refs = Array.from(doc.querySelectorAll('sup.wd-fnref'));
  refs.forEach(function (ref, i) {
    var num = i + 1;
    ref.setAttribute('data-num', String(num));
    footnoteMap[num] = { children: [new docx.Paragraph(ref.getAttribute('data-text') || '')] };
  });
  var blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'UL', 'OL', 'BLOCKQUOTE', 'HR', 'TABLE'];
  var topLevel = Array.from(doc.body.children).filter(function (el) {
    return blockTags.indexOf(el.tagName) !== -1 || /wd-pagebreak|wd-toc/.test(el.className || '');
  });
  var blocks = [];
  if (!topLevel.length) {
    blocks.push(new docx.Paragraph({ children: await nodeToRuns(doc.body) }));
  } else {
    for (var i = 0; i < topLevel.length; i++) {
      var el = topLevel[i];
      if (/wd-pagebreak/.test(el.className || '')) {
        blocks.push(new docx.Paragraph({ children: typeof docx.PageBreak === 'function' ? [new docx.PageBreak()] : [] }));
      } else if (/wd-toc/.test(el.className || '')) {
        var links = Array.from(el.querySelectorAll('a'));
        blocks.push(new docx.Paragraph({ children: [new docx.TextRun({ text: el.querySelector('.wd-toc-title') ? el.querySelector('.wd-toc-title').textContent : t('tocDocTitle'), bold: true, size: 30 })] }));
        links.forEach(function (a) { blocks.push(new docx.Paragraph({ text: a.textContent })); });
      } else if (el.tagName === 'UL' || el.tagName === 'OL') {
        var items = Array.from(el.children);
        for (var j = 0; j < items.length; j++) blocks.push(await elementToParagraph(items[j]));
      } else if (el.tagName === 'TABLE') {
        blocks.push(await tableToDocxTable(el));
      } else if (el.tagName === 'HR') {
        blocks.push(new docx.Paragraph({ text: '', border: { bottom: { color: 'CCCCCC', space: 1, style: 'single', size: 6 } } }));
      } else {
        blocks.push(await elementToParagraph(el));
      }
    }
  }

  /* ── section properties: ขนาด/แนว/ขอบกระดาษ ── */
  var ps = PAGE_SIZES[opts.pageSize] || PAGE_SIZES.A4;
  var land = opts.orientation === 'landscape';
  var mg = (MARGINS[opts.margins] || MARGINS.normal).tw;
  var section = {
    properties: {
      page: {
        size: { width: land ? ps.twH : ps.twW, height: land ? ps.twW : ps.twH,
          orientation: docx.PageOrientation ? (land ? docx.PageOrientation.LANDSCAPE : docx.PageOrientation.PORTRAIT) : undefined },
        margin: { top: mg.top, right: mg.right, bottom: mg.bottom, left: mg.left }
      }
    },
    children: blocks
  };

  /* หัว-ท้ายกระดาษ: คงรูปแบบ (ตัวหนา/สี/ฟอนต์) + การจัดตำแหน่ง (ซ้าย/กลาง/ขวา) ตามที่ผู้ใช้ตั้ง */
  function hfAlign(a) {
    if (!docx.AlignmentType) return undefined;
    var m = { left: 'LEFT', start: 'LEFT', center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFIED' };
    return docx.AlignmentType[m[a] || 'LEFT'];
  }
  async function hfParagraph(htmlStr, align, withPageNum) {
    var tmp = document.createElement('div');
    tmp.innerHTML = htmlStr || '';
    var runs = await nodeToRuns(tmp);
    if (withPageNum && docx.PageNumber) { if (runs.length) runs.push(new docx.TextRun('    ')); runs.push(new docx.TextRun({ children: [docx.PageNumber.CURRENT] })); }
    if (!runs.length) runs = [new docx.TextRun('')];
    return new docx.Paragraph({ alignment: hfAlign(align), children: runs });
  }
  if (opts.headerText && typeof docx.Header === 'function') {
    section.headers = { default: new docx.Header({ children: [await hfParagraph(opts.headerHtml, opts.headerAlign, false)] }) };
  }
  if ((opts.footerText || opts.pageNum) && typeof docx.Footer === 'function') {
    section.footers = { default: new docx.Footer({ children: [await hfParagraph(opts.footerHtml, opts.footerAlign, opts.pageNum)] }) };
  }

  var docOptions = {
    sections: [section],
    /* ตั้งฟอนต์+ขนาดเริ่มต้นของทั้งเอกสาร (ข้อความปกติ) — หัวข้อยังใช้ขนาดของหัวข้อเอง */
    styles: { default: { document: { run: { font: DEFAULT_DOC_FONT, size: DEFAULT_DOC_SIZE } } } }
  };
  if (Object.keys(footnoteMap).length) docOptions.footnotes = footnoteMap;
  var docxDoc = new docx.Document(docOptions);
  return docx.Packer.toBlob(docxDoc);
}
async function downloadEditorAsDocx(html, baseName, opts) {
  var blob = await htmlToDocxBlob(html, opts);
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = baseName.endsWith('.docx') ? baseName : baseName + '.docx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════════════════════
   UI wiring
   ══════════════════════════════════════════════════════════════════ */
if (typeof document !== 'undefined' && document.getElementById('editor')) {
  var $ = function (id) { return document.getElementById(id); };
  var editor = $('editor');
  var state = {
    lang: 'th', matches: [], busy: false, speaking: false, dictating: false,
    header: '', footer: '', pageNum: false,
    pageSize: 'A4', orientation: 'portrait', margins: 'normal'
  };
  var recognition = null, savedRange = null, autosaveTimer = null;

  var els = {
    langSelect: $('langSelect'), fileInput: $('fileInput'), imageInput: $('imageInput'),
    newDocBtn: $('newDocBtn'), importBtn: $('importBtn'), downloadBtn: $('downloadBtn'), printBtn: $('printBtn'),
    runBtn: $('runBtn'), speakBtn: $('speakBtn'), dictateBtn: $('dictateBtn'), summarizeBtn: $('summarizeBtn'), wordCountBtn: $('wordCountBtn'),
    statusMsg: $('statusMsg'), issueCount: $('issueCount'), issueList: $('issueList'), issueEmpty: $('issueEmpty'),
    issueHint: $('issueHint'), applyFixBtn: $('applyFixBtn'), langToggle: $('langToggle'),
    wordCountEl: $('wordCount'), charCountEl: $('charCount'), autosaveStatusEl: $('autosaveStatus'),
    modalBackdrop: $('modalBackdrop'),
    linkModal: $('linkModal'), linkUrlInput: $('linkUrlInput'), linkOkBtn: $('linkOkBtn'), linkCancelBtn: $('linkCancelBtn'),
    tableModal: $('tableModal'), tableRowsInput: $('tableRowsInput'), tableColsInput: $('tableColsInput'),
    tableHeaderCheck: $('tableHeaderCheck'), tableOkBtn: $('tableOkBtn'), tableCancelBtn: $('tableCancelBtn'),
    footnoteModal: $('footnoteModal'), footnoteTextInput: $('footnoteTextInput'), footnoteOkBtn: $('footnoteOkBtn'), footnoteCancelBtn: $('footnoteCancelBtn'),
    symbolModal: $('symbolModal'), symbolGrid: $('symbolGrid'), symbolCloseBtn: $('symbolCloseBtn'),
    wordCountModal: $('wordCountModal'), wordCountDetails: $('wordCountDetails'), wordCountCloseBtn: $('wordCountCloseBtn'),
    findReplaceBtn: $('findReplaceBtn'), findReplaceModal: $('findReplaceModal'), findInput: $('findInput'), replaceInput: $('replaceInput'),
    findMatchCase: $('findMatchCase'), findCount: $('findCount'), findCloseBtn: $('findCloseBtn'),
    replaceOneBtn: $('replaceOneBtn'), replaceAllBtn: $('replaceAllBtn'), findNextBtn: $('findNextBtn'),
    imageBtn: $('imageBtn'), linkBtn: $('linkBtn'), tableBtn: $('tableBtn'), hrBtn: $('hrBtn'),
    symbolBtn: $('symbolBtn'), dateBtn: $('dateBtn'), pageBreakBtn: $('pageBreakBtn'),
    editHeaderBtn: $('editHeaderBtn'), editFooterBtn: $('editFooterBtn'), pageNumBtn: $('pageNumBtn'), removeHFBtn: $('removeHFBtn'),
    docHeader: $('docHeader'), docFooter: $('docFooter'), pageNumNote: $('pageNumNote'),
    tocBtn: $('tocBtn'), tocUpdateBtn: $('tocUpdateBtn'), footnoteBtn: $('footnoteBtn'),
    textColorInput: $('textColorInput'), textColorSwatch: $('textColorSwatch'),
    hiliteColorInput: $('hiliteColorInput'), hiliteColorSwatch: $('hiliteColorSwatch'),
    clearFormatBtn: $('clearFormatBtn'), undoBtn: $('undoBtn'), redoBtn: $('redoBtn'),
    cutBtn: $('cutBtn'), copyBtn: $('copyBtn'), pasteBtn: $('pasteBtn'),
    growFontBtn: $('growFontBtn'), shrinkFontBtn: $('shrinkFontBtn'),
    styleSelect: $('styleSelect'), fontSelect: $('fontSelect'), sizeSelect: $('sizeSelect'), lineSpacingSelect: $('lineSpacingSelect'),
    pageSizeSelect: $('pageSizeSelect'), orientationSelect: $('orientationSelect'), marginSelect: $('marginSelect'),
    pageSizeStyle: $('pageSizeStyle'), page: $('page'),
    footnotesArea: $('footnotesArea'), footnotesList: $('footnotesList'),
    ribbonTabs: $('ribbonTabs')
  };

  var SPEAK_ICON = els.speakBtn.querySelector('svg').outerHTML;
  var STOP_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
  var MIC_ICON = els.dictateBtn.querySelector('svg').outerHTML;
  var MIC_OFF_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
  function setSpeakLabel(stop) { els.speakBtn.querySelector('svg').outerHTML = stop ? STOP_SVG : SPEAK_ICON; }
  function setDictateLabel(stop) { els.dictateBtn.querySelector('svg').outerHTML = stop ? MIC_OFF_SVG : MIC_ICON; }

  /* ── i18n ── */
  function applyStaticI18n() {
    var lang = getUILang();
    document.documentElement.lang = lang;
    var titleKey = document.body.getAttribute('data-doctitle-key');
    if (titleKey) document.title = t(titleKey);
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.title = t(el.getAttribute('data-i18n-title')); });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label'))); });
    document.querySelectorAll('[data-i18n-dataplaceholder]').forEach(function (el) { el.setAttribute('data-placeholder', t(el.getAttribute('data-i18n-dataplaceholder'))); });
    document.querySelectorAll('[data-i18n-dataph]').forEach(function (el) { el.setAttribute('data-ph', t(el.getAttribute('data-i18n-dataph'))); });
    if (els.langToggle) els.langToggle.querySelectorAll('span').forEach(function (s) { s.classList.toggle('active', s.getAttribute('data-lt') === lang); });
    if (!state.speaking) els.speakBtn.title = t('speakBtnTitle');
    if (!state.dictating) els.dictateBtn.title = t('dictateBtnTitle');
    updateCounts();
  }
  function buildLangOptions() {
    var prev = els.langSelect.value || state.lang;
    els.langSelect.innerHTML = '';
    LANGUAGES.forEach(function (l) {
      var opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = langLabel(l) + (l.ltCode ? '' : t('langAiPending'));
      els.langSelect.appendChild(opt);
    });
    els.langSelect.value = prev;
  }

  /* ── สลับแท็บ ribbon ── */
  els.ribbonTabs.querySelectorAll('.wd-ribbon-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      els.ribbonTabs.querySelectorAll('.wd-ribbon-tab').forEach(function (t2) { t2.classList.toggle('active', t2 === tab); });
      document.querySelectorAll('.wd-ribbon-panel').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-panel') === tab.getAttribute('data-tab')); });
    });
  });

  function setStatus(msg, isErr, showSpinner) {
    els.statusMsg.innerHTML = '';
    els.statusMsg.classList.toggle('err', !!isErr);
    if (showSpinner) { var s = document.createElement('span'); s.className = 'spinner'; els.statusMsg.appendChild(s); }
    if (msg) els.statusMsg.appendChild(document.createTextNode(msg));
  }
  function focusEditor() { editor.focus(); }
  /* ── ติดตาม "พื้นที่แก้ไขที่กำลังโฟกัส" (เนื้อหา/หัวกระดาษ/ท้ายกระดาษ) เพื่อให้
     ปุ่มจัดรูปแบบ (ตัวหนา, จัดชิดซ้าย/กลาง/ขวา, ฟอนต์, สี ฯลฯ) ทำงานกับกล่องที่
     ผู้ใช้กำลังพิมพ์อยู่จริง ไม่ใช่ยิงไปที่เนื้อหาเสมอ ── */
  var activeEditable = editor;
  [editor, els.docHeader, els.docFooter].forEach(function (el) {
    el.addEventListener('focus', function () { activeEditable = el; });
  });
  function focusActive() { activeEditable.focus(); }
  function isHF() { return activeEditable === els.docHeader || activeEditable === els.docFooter; }

  /* ── นับคำ + autosave ── */
  function docStats() {
    var text = extractText(editor);
    var words = text.trim() ? text.trim().split(/\s+/).length : 0;
    var charsWith = text.replace(/\n/g, '').length;
    var charsNo = text.replace(/\s/g, '').length;
    var paragraphs = editor.querySelectorAll('p,h1,h2,h3,li,blockquote').length;
    var footnotes = editor.querySelectorAll('sup.wd-fnref').length;
    return { words: words, charsWith: charsWith, charsNo: charsNo, paragraphs: paragraphs, footnotes: footnotes };
  }
  function updateCounts() {
    var s = docStats();
    els.wordCountEl.firstChild.nodeValue = s.words + ' ';
    els.charCountEl.firstChild.nodeValue = s.charsWith + ' ';
  }
  /* คืน HTML ของเนื้อหาโดยไม่มีไฮไลต์ผลค้นหา (mark.wd-find-hit เป็นแค่ UI ชั่วคราว) */
  function cleanEditorHtml() {
    if (!editor.querySelector('mark.wd-find-hit')) return editor.innerHTML;
    var clone = editor.cloneNode(true);
    clone.querySelectorAll('mark.wd-find-hit').forEach(function (m) { var p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); });
    return clone.innerHTML;
  }
  function scheduleAutosave() {
    updateCounts();
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function () {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
          html: cleanEditorHtml(), header: state.header, footer: state.footer, pageNum: state.pageNum,
          headerHtml: els.docHeader.innerHTML, footerHtml: els.docFooter.innerHTML,
          pageSize: state.pageSize, orientation: state.orientation, margins: state.margins, savedAt: Date.now()
        }));
      } catch (e) {}
      var label = els.autosaveStatusEl.querySelector('[data-i18n]');
      if (label) label.textContent = t('autosaveSaved');
    }, 800);
  }

  /* ── issue sidebar ── */
  function renderIssues() {
    els.issueCount.textContent = state.matches.length;
    els.issueCount.classList.toggle('zero', state.matches.length === 0);
    els.applyFixBtn.style.display = state.matches.length ? 'flex' : 'none';
    els.issueEmpty.style.display = state.matches.length === 0 && els.issueHint.dataset.shown === '1' ? 'block' : 'none';
    els.issueHint.style.display = els.issueHint.dataset.shown === '1' ? 'none' : 'block';
    els.issueList.innerHTML = '';
    state.matches.forEach(function (m, i) {
      var item = document.createElement('div');
      item.className = 'wd-issue';
      var chipsHtml = (m.replacements || []).map(function (r, ri) { return '<button class="chip" data-mi="' + i + '" data-ri="' + ri + '" type="button">' + escapeHtml(r) + '</button>'; }).join('');
      var kind = issueKind(m.category);
      var badgeHtml = kind === 'style' ? '<span class="kind-badge style">' + t('badgeStyle') + '</span>' : '<span class="kind-badge spelling">' + t('badgeSpelling') + '</span>';
      item.innerHTML = badgeHtml + '<div class="quote">"' + escapeHtml(m.matchedText) + '"</div><div class="msg">' + escapeHtml(m.message) + '</div>' + (chipsHtml ? '<div class="chips">' + chipsHtml + '</div>' : '');
      els.issueList.appendChild(item);
    });
    els.issueList.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () { acceptIssue(Number(chip.dataset.mi), Number(chip.dataset.ri)); });
    });
  }
  function acceptIssue(matchIndex, replacementIndex) {
    var m = state.matches[matchIndex];
    if (!m || !m.replacements || !m.replacements[replacementIndex]) return;
    var replacement = m.replacements[replacementIndex];
    if (!applyRangeFix(editor, m, replacement)) { setStatus(t('fixSkipped'), true); return; }
    var delta = replacement.length - m.length;
    var old = m.matchedText;
    state.matches = state.matches.filter(function (_, i) { return i !== matchIndex; })
      .map(function (mm) { return mm.offset > m.offset ? Object.assign({}, mm, { offset: mm.offset + delta }) : mm; });
    setStatus(t('singleFixDone', { old: old, new: replacement }));
    renderIssues();
    scheduleAutosave();
  }
  els.applyFixBtn.addEventListener('click', function () {
    var sorted = state.matches.slice().sort(function (a, b) { return b.offset - a.offset; });
    var fixed = 0, skipped = 0;
    sorted.forEach(function (m) {
      if (!m.replacements || !m.replacements.length) return;
      if (applyRangeFix(editor, m, m.replacements[0])) fixed++; else skipped++;
    });
    state.matches = [];
    renderIssues();
    setStatus(skipped ? t('fixAllDoneSkipped', { n: fixed, skipped: skipped }) : t('fixAllDone', { n: fixed }));
    scheduleAutosave();
  });

  els.runBtn.addEventListener('click', async function () {
    var lang = langByCode(state.lang);
    if (!lang.ltCode) { setStatus(t('langNotSupported', { lang: langLabel(lang) }), true); return; }
    var text = extractText(editor);
    if (!text.trim()) { setStatus(t('noTextToCheck'), true); return; }
    state.busy = true; els.runBtn.disabled = true;
    setStatus(t('checking'), false, true);
    try {
      var matches = await checkSpelling(text, lang.ltCode);
      matches.forEach(function (m) { m.matchedText = text.slice(m.offset, m.offset + m.length); });
      state.matches = matches;
      els.issueHint.dataset.shown = '1';
      renderIssues();
      setStatus(t('checkedResult', { n: matches.length }));
    } catch (err) { setStatus(t('checkError', { msg: err.message }), true); }
    finally { state.busy = false; els.runBtn.disabled = false; }
  });
  els.langSelect.addEventListener('change', function () { state.lang = els.langSelect.value; });

  /* ── ไฟล์ ── */
  els.newDocBtn.addEventListener('click', function () {
    if (!confirm(t('newDocConfirm'))) return;
    editor.innerHTML = '';
    els.docHeader.textContent = ''; els.docFooter.textContent = '';
    state.matches = []; els.issueHint.dataset.shown = '0';
    state.header = ''; state.footer = ''; state.pageNum = false;
    renderIssues(); renderFootnotes(); updateHeaderFooterUI();
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) {}
    updateCounts();
    setStatus(t('clearedDoc'));
  });
  els.importBtn.addEventListener('click', function () { els.fileInput.click(); });
  els.fileInput.addEventListener('change', async function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    setStatus(t('readingFile'), false, true);
    try {
      var result = await readAnyFile(file);
      var html = result.kind === 'html' ? sanitizeHtml(result.content) : textToParagraphsHtml(result.content);
      editor.innerHTML += html;
      renderFootnotes();
      setStatus(t('fileImported', { name: file.name }));
      scheduleAutosave();
    } catch (err) { setStatus(t('fileReadError', { msg: err.message }), true); }
    finally { els.fileInput.value = ''; }
  });
  els.downloadBtn.addEventListener('click', async function () {
    if (!extractText(editor).trim()) { setStatus(t('downloadEmpty'), true); return; }
    /* อ่านหัว-ท้ายสดจากกล่องในหน้าเอกสารตอนดาวน์โหลด (กันกรณี state ไม่ทัน) */
    state.header = els.docHeader.textContent.trim();
    state.footer = els.docFooter.textContent.trim();
    try {
      await downloadEditorAsDocx(cleanEditorHtml(), 'document', {
        pageSize: state.pageSize, orientation: state.orientation, margins: state.margins,
        headerText: state.header, footerText: state.footer, pageNum: state.pageNum,
        headerHtml: els.docHeader.innerHTML, footerHtml: els.docFooter.innerHTML,
        headerAlign: regionAlign(els.docHeader), footerAlign: regionAlign(els.docFooter)
      });
    } catch (err) { setStatus(t('downloadError', { msg: err.message }), true); }
  });
  /* ── สร้างไฟล์ PDF เอง (ไม่พึ่ง window.print ของเบราว์เซอร์ ที่ iOS Safari จะแทรก
     URL/วันที่/เลขหน้าเองโดยลบไม่ได้) → ได้ PDF สะอาด มีแค่เนื้อหา + หัว-ท้ายที่พิมพ์เอง ── */
  async function generatePdf() {
    var jsPDFctor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFctor || !window.html2canvas) { window.print(); return; } /* สำรอง: ถ้าโหลดไลบรารีไม่ได้ */
    if (!extractText(editor).trim() && !els.docHeader.textContent.trim() && !els.docFooter.textContent.trim()) { setStatus(t('downloadEmpty'), true); return; }
    setStatus(t('pdfGenerating'), false, true);
    els.page.classList.add('wd-capturing');
    try {
      var canvas = await window.html2canvas(els.page, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: els.page.scrollWidth });
      var ps = PAGE_SIZES[state.pageSize] || PAGE_SIZES.A4;
      var land = state.orientation === 'landscape';
      var pwMm = land ? ps.mmH : ps.mmW, phMm = land ? ps.mmW : ps.mmH;
      var pdf = new jsPDFctor({ orientation: land ? 'landscape' : 'portrait', unit: 'mm', format: [pwMm, phMm] });
      var pxPerMm = canvas.width / pwMm;
      var pageHpx = Math.floor(phMm * pxPerMm);
      var sy = 0, first = true;
      while (sy < canvas.height - 1) {
        var sliceHpx = Math.min(pageHpx, canvas.height - sy);
        var c2 = document.createElement('canvas');
        c2.width = canvas.width; c2.height = sliceHpx;
        var ctx = c2.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c2.width, c2.height);
        ctx.drawImage(canvas, 0, sy, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);
        if (!first) pdf.addPage([pwMm, phMm], land ? 'landscape' : 'portrait');
        pdf.addImage(c2.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, pwMm, sliceHpx / pxPerMm);
        sy += sliceHpx; first = false;
      }
      pdf.save('document.pdf');
      setStatus(t('pdfDone'));
    } catch (e) {
      setStatus(t('pdfError', { msg: e.message }), true);
    } finally {
      els.page.classList.remove('wd-capturing');
    }
  }
  els.printBtn.addEventListener('click', generatePdf);

  /* ── สรุปเนื้อหา ── */
  els.summarizeBtn.addEventListener('click', function () {
    var text = extractText(editor).trim();
    if (!text) { setStatus(t('summarizeEmpty'), true); return; }
    var summary = summarizeText(text, 5);
    editor.innerHTML += '<p><strong>' + escapeHtml(t('summaryHeading')) + '</strong></p><p>' + escapeHtml(summary) + '</p>';
    setStatus(t('summarized'));
    scheduleAutosave();
  });

  /* ── จำนวนคำ (รายละเอียด) ── */
  els.wordCountBtn.addEventListener('click', function () {
    var s = docStats();
    els.wordCountDetails.innerHTML =
      '<div><strong>' + s.words + '</strong> — ' + t('wcWords') + '</div>' +
      '<div><strong>' + s.charsWith + '</strong> — ' + t('wcCharsWith') + '</div>' +
      '<div><strong>' + s.charsNo + '</strong> — ' + t('wcCharsNo') + '</div>' +
      '<div><strong>' + s.paragraphs + '</strong> — ' + t('wcParagraphs') + '</div>' +
      '<div><strong>' + s.footnotes + '</strong> — ' + t('wcFootnotes') + '</div>';
    openModal(els.wordCountModal);
  });
  els.wordCountCloseBtn.addEventListener('click', closeModals);

  /* ── ค้นหาและแทนที่ (แบบ Word) ── */
  var findState = { current: -1 };
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function clearFindHighlights() {
    editor.querySelectorAll('mark.wd-find-hit').forEach(function (m) {
      var parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });
  }
  function findTerm() { return els.findInput.value; }
  function highlightAll() {
    clearFindHighlights();
    var term = findTerm();
    if (!term) { els.findCount.textContent = ''; findState.current = -1; return 0; }
    var re = new RegExp(escapeRe(term), els.findMatchCase.checked ? 'g' : 'gi');
    var textNodes = [];
    var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.parentElement && !node.parentElement.closest('.wd-find-hit,.wd-toc,.wd-fnref,.wd-pagebreak')) textNodes.push(node);
    }
    var count = 0;
    textNodes.forEach(function (tn) {
      var text = tn.nodeValue; re.lastIndex = 0;
      if (!re.test(text)) return;
      re.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var last = 0, m;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var mark = document.createElement('mark');
        mark.className = 'wd-find-hit';
        mark.textContent = m[0];
        frag.appendChild(mark);
        last = m.index + m[0].length;
        count++;
        if (m[0].length === 0) re.lastIndex++;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      tn.parentNode.replaceChild(frag, tn);
    });
    els.findCount.textContent = count ? t('findCountFound', { n: count }) : t('findCountNone');
    findState.current = -1;
    return count;
  }
  function gotoNext() {
    var hits = editor.querySelectorAll('mark.wd-find-hit');
    if (!hits.length) { if (highlightAll() === 0) return; hits = editor.querySelectorAll('mark.wd-find-hit'); }
    if (!hits.length) return;
    hits.forEach(function (h) { h.classList.remove('current'); });
    findState.current = (findState.current + 1) % hits.length;
    var cur = hits[findState.current];
    cur.classList.add('current');
    cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
    els.findCount.textContent = t('findCountPos', { i: findState.current + 1, n: hits.length });
  }
  function replaceCurrent() {
    var hits = editor.querySelectorAll('mark.wd-find-hit');
    if (!hits.length) { gotoNext(); return; }
    if (findState.current < 0) findState.current = 0;
    var cur = hits[findState.current];
    if (!cur) { findState.current = 0; cur = hits[0]; }
    if (!cur) return;
    var repl = document.createTextNode(els.replaceInput.value);
    cur.parentNode.replaceChild(repl, cur);
    editor.normalize();
    scheduleAutosave();
    findState.current = findState.current - 1;
    highlightAll();
    gotoNext();
  }
  function replaceAll() {
    var term = findTerm();
    if (!term) return;
    clearFindHighlights();
    var re = new RegExp(escapeRe(term), els.findMatchCase.checked ? 'g' : 'gi');
    var repl = els.replaceInput.value;
    var count = 0;
    var textNodes = [];
    var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && !node.parentElement.closest('.wd-toc,.wd-fnref,.wd-pagebreak')) textNodes.push(node);
    }
    textNodes.forEach(function (tn) {
      var v = tn.nodeValue;
      var nv = v.replace(re, function () { count++; return repl; });
      if (nv !== v) tn.nodeValue = nv;
    });
    editor.normalize();
    els.findCount.textContent = t('replacedN', { n: count });
    if (count) { scheduleAutosave(); if (state.matches.length) { state.matches = []; renderIssues(); } }
  }
  function openFindReplace() {
    openModal(els.findReplaceModal);
    els.findInput.focus(); els.findInput.select();
    if (els.findInput.value) highlightAll();
  }
  els.findReplaceBtn.addEventListener('click', openFindReplace);
  els.findNextBtn.addEventListener('click', gotoNext);
  els.replaceOneBtn.addEventListener('click', replaceCurrent);
  els.replaceAllBtn.addEventListener('click', replaceAll);
  els.findCloseBtn.addEventListener('click', function () { clearFindHighlights(); closeModals(); });
  els.findInput.addEventListener('input', highlightAll);
  els.findMatchCase.addEventListener('change', highlightAll);
  els.findInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); gotoNext(); } });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'h')) { e.preventDefault(); openFindReplace(); }
  });

  /* ── อ่านออกเสียง ── */
  els.speakBtn.addEventListener('click', function () {
    if (state.speaking) { window.speechSynthesis.cancel(); state.speaking = false; setSpeakLabel(false); els.speakBtn.title = t('speakBtnTitle'); return; }
    var text = extractText(editor).trim();
    if (!text) return;
    window.speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(text);
    utter.lang = langByCode(state.lang).speechLang;
    utter.onend = function () { state.speaking = false; setSpeakLabel(false); els.speakBtn.title = t('speakBtnTitle'); };
    utter.onerror = utter.onend;
    state.speaking = true; setSpeakLabel(true); els.speakBtn.title = t('stopSpeakTitle');
    window.speechSynthesis.speak(utter);
  });

  /* ── Dictate ── */
  function stopDictate(statusText) {
    state.dictating = false;
    els.dictateBtn.classList.remove('active');
    setDictateLabel(false);
    els.dictateBtn.title = t('dictateBtnTitle');
    if (recognition) { try { recognition.stop(); } catch (e) {} }
    if (statusText !== undefined) setStatus(statusText);
  }
  els.dictateBtn.addEventListener('click', function () {
    if (state.dictating) { stopDictate(t('dictateStopped')); return; }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setStatus(t('dictateUnsupported'), true); return; }
    focusEditor();
    recognition = new SR();
    recognition.lang = langByCode(state.lang).speechLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = function (e) {
      var finalChunk = '', interimChunk = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var res = e.results[i];
        if (res.isFinal) finalChunk += res[0].transcript; else interimChunk += res[0].transcript;
      }
      if (finalChunk) {
        focusEditor();
        document.execCommand('insertText', false, finalChunk);
        if (state.matches.length) { state.matches = []; renderIssues(); }
        scheduleAutosave();
      }
      setStatus(interimChunk ? t('dictateListeningInterim', { text: interimChunk }) : t('dictateListening'));
    };
    recognition.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { setStatus(t('dictateNoMic'), true); stopDictate(); }
      else if (e.error === 'no-speech' || e.error === 'aborted') {}
      else { setStatus(t('dictateError', { msg: e.error }), true); }
    };
    recognition.onend = function () { if (state.dictating) { try { recognition.start(); } catch (e) {} } };
    state.dictating = true;
    els.dictateBtn.classList.add('active');
    setDictateLabel(true);
    els.dictateBtn.title = t('stopDictateTitle');
    setStatus(t('dictateListening'));
    recognition.start();
  });

  /* ── ริบบิ้น: คำสั่ง execCommand ทั่วไป ── */
  document.querySelectorAll('.rb-btn[data-cmd]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      focusActive();
      document.execCommand(btn.dataset.cmd, false, null);
      updateToolbarState();
      if (isHF()) syncHFFromRegions();
      scheduleAutosave();
    });
  });
  /* ── สไตล์แบบ Word (ปกติ/ชื่อเรื่อง/หัวข้อ 1-4/คำพูดอ้างอิง ฯลฯ) ── */
  var STYLE_MAP = {
    normal:       { tag: 'p', cls: '' },
    nospacing:    { tag: 'p', cls: 'wd-nospace' },
    title:        { tag: 'p', cls: 'wd-title' },
    subtitle:     { tag: 'p', cls: 'wd-subtitle' },
    h1:           { tag: 'h1', cls: '' },
    h2:           { tag: 'h2', cls: '' },
    h3:           { tag: 'h3', cls: '' },
    h4:           { tag: 'h4', cls: '' },
    quote:        { tag: 'blockquote', cls: '' },
    intensequote: { tag: 'blockquote', cls: 'wd-intense' }
  };
  function currentBlocks() {
    /* บล็อกที่ selection คลุมอยู่ (ในพื้นที่ที่กำลังโฟกัส) */
    var blocks = selectedBlocks();
    return blocks;
  }
  els.styleSelect.addEventListener('change', function () {
    var spec = STYLE_MAP[els.styleSelect.value] || STYLE_MAP.normal;
    focusActive();
    document.execCommand('formatBlock', false, '<' + spec.tag + '>');
    /* ใส่/ล้าง class ให้บล็อกที่เพิ่งจัด (title/subtitle/nospacing/intense) */
    currentBlocks().forEach(function (b) {
      b.classList.remove('wd-title', 'wd-subtitle', 'wd-nospace', 'wd-intense');
      if (spec.cls) b.classList.add(spec.cls);
    });
    if (isHF()) syncHFFromRegions();
    scheduleAutosave();
  });
  els.fontSelect.addEventListener('change', function () {
    focusActive();
    document.execCommand('fontName', false, els.fontSelect.value);
    if (isHF()) syncHFFromRegions();
    scheduleAutosave();
  });

  /* ── ขนาดฟอนต์ (pt จริง) ── */
  function applyFontSizePt(pt) {
    focusActive();
    document.execCommand('fontSize', false, '7');
    activeEditable.querySelectorAll('font[size="7"]').forEach(function (f) { f.removeAttribute('size'); f.style.fontSize = pt + 'pt'; });
    if (isHF()) syncHFFromRegions();
    scheduleAutosave();
  }
  els.sizeSelect.addEventListener('change', function () { applyFontSizePt(Number(els.sizeSelect.value)); });
  function currentFontSizePt() {
    var sel = window.getSelection();
    var node = sel && sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    if (!node || !activeEditable.contains(node)) return Number(els.sizeSelect.value) || 14;
    var px = parseFloat(getComputedStyle(node).fontSize);
    return Math.round(px * 72 / 96);
  }
  function stepFont(dir) {
    var cur = currentFontSizePt();
    var idx = 0;
    for (var i = 0; i < SIZE_SCALE.length; i++) { if (SIZE_SCALE[i] >= cur) { idx = i; break; } if (i === SIZE_SCALE.length - 1) idx = i; }
    if (dir > 0 && SIZE_SCALE[idx] <= cur) idx++;
    idx = Math.max(0, Math.min(SIZE_SCALE.length - 1, idx + (dir < 0 ? -1 : 0)));
    applyFontSizePt(SIZE_SCALE[idx]);
    els.sizeSelect.value = String(SIZE_SCALE[idx]);
  }
  els.growFontBtn.addEventListener('click', function () { stepFont(1); });
  els.shrinkFontBtn.addEventListener('click', function () { stepFont(-1); });

  /* ── สี ── */
  els.textColorInput.addEventListener('input', function () {
    focusActive();
    document.execCommand('foreColor', false, els.textColorInput.value);
    els.textColorSwatch.style.background = els.textColorInput.value;
    if (isHF()) syncHFFromRegions();
    scheduleAutosave();
  });
  els.hiliteColorInput.addEventListener('input', function () {
    focusActive();
    if (!document.execCommand('hiliteColor', false, els.hiliteColorInput.value)) document.execCommand('backColor', false, els.hiliteColorInput.value);
    els.hiliteColorSwatch.style.background = els.hiliteColorInput.value;
    if (isHF()) syncHFFromRegions();
    scheduleAutosave();
  });
  els.clearFormatBtn.addEventListener('click', function () {
    focusActive();
    document.execCommand('removeFormat', false, null);
    if (!isHF()) { document.execCommand('formatBlock', false, '<p>'); els.styleSelect.value = 'P'; }
    if (isHF()) syncHFFromRegions();
    scheduleAutosave();
  });
  els.undoBtn.addEventListener('click', function () { focusActive(); document.execCommand('undo'); if (isHF()) syncHFFromRegions(); scheduleAutosave(); });
  els.redoBtn.addEventListener('click', function () { focusActive(); document.execCommand('redo'); if (isHF()) syncHFFromRegions(); scheduleAutosave(); });

  /* ── คลิปบอร์ด ── */
  els.cutBtn.addEventListener('click', function () { focusActive(); document.execCommand('cut'); if (isHF()) syncHFFromRegions(); scheduleAutosave(); });
  els.copyBtn.addEventListener('click', function () { focusActive(); document.execCommand('copy'); });
  els.pasteBtn.addEventListener('click', function () {
    focusActive();
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function (txt) { document.execCommand('insertText', false, txt); if (isHF()) syncHFFromRegions(); scheduleAutosave(); })
        .catch(function () { setStatus(t('pasteError'), true); });
    } else { setStatus(t('pasteError'), true); }
  });

  /* ── ระยะห่างบรรทัด ── */
  function selectedBlocks() {
    var sel = window.getSelection();
    if (!sel.rangeCount) return [];
    var range = sel.getRangeAt(0);
    var blocks = [];
    activeEditable.querySelectorAll('p,h1,h2,h3,li,blockquote,div').forEach(function (b) {
      if (range.intersectsNode(b)) blocks.push(b);
    });
    if (!blocks.length) {
      var node = sel.anchorNode;
      if (node && node.nodeType === 3) node = node.parentElement;
      while (node && node !== activeEditable && !/^(P|H1|H2|H3|LI|BLOCKQUOTE|DIV)$/.test(node.tagName)) node = node.parentElement;
      if (node && node !== activeEditable) blocks.push(node);
    }
    return blocks;
  }
  els.lineSpacingSelect.addEventListener('change', function () {
    focusActive();
    var blocks = selectedBlocks();
    if (!blocks.length) { document.execCommand('formatBlock', false, '<p>'); blocks = selectedBlocks(); }
    var val = els.lineSpacingSelect.value;
    blocks.forEach(function (b) { b.style.lineHeight = val || ''; });
    if (isHF()) syncHFFromRegions();
    scheduleAutosave();
  });

  /* ── active state ปุ่ม ── */
  var STATE_CMDS = { boldBtn: 'bold', italicBtn: 'italic', underlineBtn: 'underline', strikeBtn: 'strikeThrough',
    subBtn: 'subscript', supBtn: 'superscript', ulBtn: 'insertUnorderedList', olBtn: 'insertOrderedList',
    alignLeftBtn: 'justifyLeft', alignCenterBtn: 'justifyCenter', alignRightBtn: 'justifyRight', alignJustifyBtn: 'justifyFull' };
  function updateToolbarState() {
    var sel = window.getSelection();
    if (!sel.anchorNode || !activeEditable.contains(sel.anchorNode)) return;
    Object.keys(STATE_CMDS).forEach(function (id) {
      var btn = $(id);
      if (btn) { try { btn.classList.toggle('active', document.queryCommandState(STATE_CMDS[id])); } catch (e) {} }
    });
  }
  document.addEventListener('selectionchange', updateToolbarState);
  editor.addEventListener('keyup', updateToolbarState);
  editor.addEventListener('mouseup', updateToolbarState);

  /* ── modal ── */
  function openModal(m) { els.modalBackdrop.classList.add('open'); m.classList.add('open'); }
  function closeModals() {
    els.modalBackdrop.classList.remove('open');
    if (els.findReplaceModal.classList.contains('open')) clearFindHighlights();
    [els.linkModal, els.tableModal, els.footnoteModal, els.symbolModal, els.wordCountModal, els.findReplaceModal].forEach(function (m) { m.classList.remove('open'); });
  }
  els.modalBackdrop.addEventListener('click', function (e) { if (e.target === els.modalBackdrop) closeModals(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModals(); });
  function saveSelectionRange() {
    var sel = window.getSelection();
    savedRange = (sel.rangeCount && editor.contains(sel.anchorNode)) ? sel.getRangeAt(0).cloneRange() : null;
  }
  function restoreSelectionRange() {
    focusEditor();
    if (savedRange) { var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
  }

  /* ── ลิงก์ ── */
  els.linkBtn.addEventListener('click', function () { saveSelectionRange(); els.linkUrlInput.value = ''; openModal(els.linkModal); els.linkUrlInput.focus(); });
  els.linkCancelBtn.addEventListener('click', closeModals);
  els.linkOkBtn.addEventListener('click', function () {
    var url = els.linkUrlInput.value.trim();
    if (!url) { els.linkUrlInput.focus(); return; }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
    restoreSelectionRange();
    var sel = window.getSelection();
    if (sel.rangeCount && !sel.getRangeAt(0).collapsed) document.execCommand('createLink', false, url);
    else document.execCommand('insertHTML', false, '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(url) + '</a>');
    editor.querySelectorAll('a').forEach(function (a) { if (!a.target) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } });
    closeModals(); scheduleAutosave();
  });

  /* ── รูปภาพ ── */
  els.imageBtn.addEventListener('click', function () { saveSelectionRange(); els.imageInput.click(); });
  els.imageInput.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { restoreSelectionRange(); document.execCommand('insertImage', false, reader.result); scheduleAutosave(); };
    reader.readAsDataURL(file);
    els.imageInput.value = '';
  });

  /* ── ตาราง ── */
  els.tableBtn.addEventListener('click', function () { saveSelectionRange(); openModal(els.tableModal); });
  els.tableCancelBtn.addEventListener('click', closeModals);
  els.tableOkBtn.addEventListener('click', function () {
    var rows = Math.max(1, Math.min(20, Number(els.tableRowsInput.value) || 1));
    var cols = Math.max(1, Math.min(10, Number(els.tableColsInput.value) || 1));
    var withHead = els.tableHeaderCheck.checked;
    var html = '<table><tbody>';
    for (var r = 0; r < rows; r++) {
      html += '<tr>';
      var cellTag = (withHead && r === 0) ? 'th' : 'td';
      for (var c = 0; c < cols; c++) html += '<' + cellTag + '><br></' + cellTag + '>';
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    restoreSelectionRange();
    document.execCommand('insertHTML', false, html);
    closeModals(); scheduleAutosave();
  });

  /* ── เส้นคั่น + ขึ้นหน้าใหม่ + วันที่ ── */
  els.hrBtn.addEventListener('click', function () { focusEditor(); document.execCommand('insertHorizontalRule'); scheduleAutosave(); });
  els.pageBreakBtn.addEventListener('click', function () {
    focusEditor();
    document.execCommand('insertHTML', false, '<div class="wd-pagebreak" contenteditable="false"></div><p><br></p>');
    scheduleAutosave();
  });
  els.dateBtn.addEventListener('click', function () {
    focusEditor();
    var lang = getUILang();
    var str = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    document.execCommand('insertText', false, str);
    scheduleAutosave();
  });

  /* ── สัญลักษณ์ ── */
  var SYMBOL_SET = [
    '© ® ™ § ¶ † ‡ • ‰ … ° ′ ″',
    '± × ÷ ≈ ≠ ≤ ≥ ∞ √ ∑ ∏ ∫ ∆ π µ Ω',
    '← → ↑ ↓ ↔ ⇒ ⇐ ⇔ ▲ ▼ ◀ ▶',
    '€ £ ¥ ฿ ¢ ₩ ₫ ₽ $',
    '½ ¼ ¾ ⅓ ⅔ ⅛',
    '✓ ✗ ★ ☆ ♦ ♥ ♣ ♠ ☎ ✉ ✎ ⚠',
    '“ ” ‘ ’ « » — – ๆ ฯ ๚ ๛'
  ];
  function buildSymbolGrid() {
    els.symbolGrid.innerHTML = '';
    SYMBOL_SET.forEach(function (row) {
      var wrap = document.createElement('div');
      wrap.className = 'wd-sym-grid';
      row.split(' ').filter(function (s) { return s && s !== '☎' ? true : !!s; }).forEach(function (sym) {
        if (!sym) return;
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = sym;
        b.addEventListener('click', function () { restoreSelectionRange(); document.execCommand('insertText', false, sym); scheduleAutosave(); setStatus(t('symbolInserted')); });
        wrap.appendChild(b);
      });
      els.symbolGrid.appendChild(wrap);
    });
  }
  els.symbolBtn.addEventListener('click', function () { saveSelectionRange(); buildSymbolGrid(); openModal(els.symbolModal); });
  els.symbolCloseBtn.addEventListener('click', closeModals);

  /* ── หัว-ท้ายกระดาษ (แก้ไขในหน้าเอกสารได้เลยแบบ Word) ── */
  /* ทำเครื่องหมายว่า "ว่างจริง" โดยดูจากข้อความ (ไม่ใช่แค่ :empty เพราะ contenteditable
     มักแอบใส่ <br> เวลาแตะแล้วลบ ทำให้ :empty ไม่ตรง → เส้น/กล่องเปล่าโผล่ในไฟล์) */
  function markHFEmpty() {
    els.docHeader.classList.toggle('wd-hf-empty', !els.docHeader.textContent.trim());
    els.docFooter.classList.toggle('wd-hf-empty', !els.docFooter.textContent.trim());
  }
  function updateHeaderFooterUI() {
    els.pageNumBtn.classList.toggle('active', state.pageNum);
    els.pageNumNote.classList.toggle('show', state.pageNum);
    markHFEmpty();
  }
  /* อ่านข้อความหัว/ท้ายจากกล่องจริง (ใช้ทั้งเช็คว่าว่างไหม และตอนส่งออก) */
  function syncHFFromRegions() {
    state.header = els.docHeader.textContent.trim();
    state.footer = els.docFooter.textContent.trim();
    updateHeaderFooterUI();
  }
  /* หาการจัดตำแหน่งจริงของหัว/ท้าย — execCommand จัดชิดจะห่อ text-align ไว้ที่ div ข้างใน
     ไม่ใช่ที่ตัว region เอง จึงต้องดูทั้ง style ของ region และของลูกที่มี text-align */
  function regionAlign(el) {
    if (el.style && el.style.textAlign) return el.style.textAlign;
    var c = el.querySelector('[style*="text-align"]');
    if (c && c.style.textAlign) return c.style.textAlign;
    return getComputedStyle(el).textAlign;
  }
  /* พิมพ์ในกล่องหัว/ท้ายโดยตรง → เก็บลง state ทันที */
  els.docHeader.addEventListener('input', function () { syncHFFromRegions(); scheduleAutosave(); });
  els.docFooter.addEventListener('input', function () { syncHFFromRegions(); scheduleAutosave(); });
  /* พอเลิกแก้ไข ถ้าว่าง (เหลือแต่ <br>/ช่องว่าง) ให้ล้างเป็นว่างจริง — กันเส้น/กล่องเปล่าโผล่ในไฟล์ */
  function cleanupEmptyHF(el) { if (!el.textContent.trim()) el.innerHTML = ''; markHFEmpty(); }
  els.docHeader.addEventListener('blur', function () { cleanupEmptyHF(els.docHeader); });
  els.docFooter.addEventListener('blur', function () { cleanupEmptyHF(els.docFooter); });
  /* กด Enter ในหัว/ท้ายไม่ต้องขึ้นบรรทัดใหม่ (Word หัว-ท้ายเป็นบรรทัดเดียวพอ) */
  function singleLineGuard(e) { if (e.key === 'Enter') e.preventDefault(); }
  els.docHeader.addEventListener('keydown', singleLineGuard);
  els.docFooter.addEventListener('keydown', singleLineGuard);

  els.editHeaderBtn.addEventListener('click', function () { els.docHeader.scrollIntoView({ block: 'center', behavior: 'smooth' }); els.docHeader.focus(); });
  els.editFooterBtn.addEventListener('click', function () { els.docFooter.scrollIntoView({ block: 'center', behavior: 'smooth' }); els.docFooter.focus(); });
  els.pageNumBtn.addEventListener('click', function () {
    state.pageNum = !state.pageNum;
    updateHeaderFooterUI();
    setStatus(state.pageNum ? t('pageNumOn') : t('pageNumOff'));
    scheduleAutosave();
  });
  els.removeHFBtn.addEventListener('click', function () {
    els.docHeader.textContent = ''; els.docFooter.textContent = '';
    state.header = ''; state.footer = ''; state.pageNum = false;
    updateHeaderFooterUI();
    setStatus(t('headerFooterRemoved'));
    scheduleAutosave();
  });

  /* ── ตั้งค่าหน้ากระดาษ ── */
  function applyPageSetup() {
    var ps = PAGE_SIZES[state.pageSize] || PAGE_SIZES.A4;
    var land = state.orientation === 'landscape';
    var wMm = land ? ps.mmH : ps.mmW;
    var mg = MARGINS[state.margins] || MARGINS.normal;
    els.page.style.maxWidth = Math.round(wMm * 96 / 25.4) + 'px';
    editor.style.padding = mg.css;
    /* margin:0 บน @page ทำให้เบราว์เซอร์ไม่แทรก header/footer อัตโนมัติ (ชื่อหน้า/URL/
       วันที่/เลขหน้า) เวลาสั่งพิมพ์ → PDF ออกมาสะอาดเหมือนแปลงจาก Word จริง
       ระยะขอบกระดาษจริงมาจาก padding ของ editor แทน */
    els.pageSizeStyle.textContent = '@page { size: ' + state.pageSize + ' ' + state.orientation + '; margin: 0; }';
    els.pageSizeSelect.value = state.pageSize;
    els.orientationSelect.value = state.orientation;
    els.marginSelect.value = state.margins;
  }
  els.pageSizeSelect.addEventListener('change', function () { state.pageSize = els.pageSizeSelect.value; applyPageSetup(); setStatus(t('pageSetupChanged')); scheduleAutosave(); });
  els.orientationSelect.addEventListener('change', function () { state.orientation = els.orientationSelect.value; applyPageSetup(); setStatus(t('pageSetupChanged')); scheduleAutosave(); });
  els.marginSelect.addEventListener('change', function () { state.margins = els.marginSelect.value; applyPageSetup(); setStatus(t('pageSetupChanged')); scheduleAutosave(); });

  /* ── สารบัญ ── */
  function slugify(s, i) { return 'h-' + i + '-' + (s || '').toLowerCase().replace(/[^a-z0-9ก-๛]+/g, '-').replace(/^-|-$/g, '').slice(0, 30); }
  function buildTocHtml() {
    var heads = Array.from(editor.querySelectorAll('h1,h2,h3')).filter(function (h) { return !h.closest('.wd-toc'); });
    if (!heads.length) return null;
    var items = heads.map(function (h, i) {
      if (!h.id) h.id = slugify(h.textContent, i);
      var lvl = h.tagName === 'H1' ? '' : h.tagName === 'H2' ? ' lvl2' : ' lvl3';
      return '<a class="' + ('wd-toc-link' + lvl).trim() + '" href="#' + h.id + '">' + escapeHtml(h.textContent) + '</a>';
    }).join('');
    return '<div class="wd-toc" contenteditable="false"><div class="wd-toc-title">' + escapeHtml(t('tocDocTitle')) + '</div>' + items + '</div>';
  }
  els.tocBtn.addEventListener('click', function () {
    var html = buildTocHtml();
    if (!html) { setStatus(t('tocNoHeadings'), true); return; }
    var existing = editor.querySelector('.wd-toc');
    if (existing) { existing.outerHTML = html; }
    else { focusEditor(); document.execCommand('insertHTML', false, html + '<p><br></p>'); }
    setStatus(t('tocInserted'));
    scheduleAutosave();
  });
  els.tocUpdateBtn.addEventListener('click', function () {
    var existing = editor.querySelector('.wd-toc');
    if (!existing) { setStatus(t('tocNoExisting'), true); return; }
    var html = buildTocHtml();
    if (!html) { setStatus(t('tocNoHeadings'), true); return; }
    existing.outerHTML = html;
    setStatus(t('tocUpdated'));
    scheduleAutosave();
  });
  editor.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.wd-toc a');
    if (a) { e.preventDefault(); var tgt = editor.querySelector(a.getAttribute('href')); if (tgt) tgt.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });

  /* ── เชิงอรรถ ── */
  function renderFootnotes() {
    var refs = Array.from(editor.querySelectorAll('sup.wd-fnref'));
    refs.forEach(function (ref, i) { ref.textContent = String(i + 1); });
    els.footnotesList.innerHTML = '';
    refs.forEach(function (ref, i) {
      var item = document.createElement('div');
      item.className = 'wd-fn-item';
      item.innerHTML = '<span class="num">' + (i + 1) + '.</span><span class="txt"></span>' +
        '<button class="del" type="button" title="ลบ" aria-label="ลบ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
      item.querySelector('.txt').textContent = ref.getAttribute('data-text') || '';
      item.querySelector('.txt').addEventListener('click', function () { editFootnote(ref); });
      item.querySelector('.del').addEventListener('click', function () { ref.remove(); renderFootnotes(); scheduleAutosave(); });
      els.footnotesList.appendChild(item);
    });
    els.footnotesArea.classList.toggle('show', refs.length > 0);
  }
  function editFootnote(ref) {
    els.footnoteTextInput.value = ref.getAttribute('data-text') || '';
    savedRange = null;
    els.footnoteModal.dataset.editing = '1';
    els.footnoteModal._editRef = ref;
    openModal(els.footnoteModal);
    els.footnoteTextInput.focus();
  }
  els.footnoteBtn.addEventListener('click', function () {
    saveSelectionRange();
    els.footnoteTextInput.value = '';
    els.footnoteModal.dataset.editing = '';
    els.footnoteModal._editRef = null;
    openModal(els.footnoteModal);
    els.footnoteTextInput.focus();
  });
  els.footnoteCancelBtn.addEventListener('click', closeModals);
  els.footnoteOkBtn.addEventListener('click', function () {
    var txt = els.footnoteTextInput.value.trim();
    if (!txt) { setStatus(t('footnoteEmpty'), true); els.footnoteTextInput.focus(); return; }
    if (els.footnoteModal.dataset.editing === '1' && els.footnoteModal._editRef) {
      els.footnoteModal._editRef.setAttribute('data-text', txt);
    } else {
      restoreSelectionRange();
      var sup = '<sup class="wd-fnref" contenteditable="false" data-text="' + escapeHtml(txt).replace(/"/g, '&quot;') + '">0</sup>';
      document.execCommand('insertHTML', false, sup);
    }
    closeModals();
    renderFootnotes();
    var n = editor.querySelectorAll('sup.wd-fnref').length;
    setStatus(t('footnoteInserted', { n: n }));
    scheduleAutosave();
  });

  /* ── editor input ── */
  editor.addEventListener('input', function () {
    if (state.matches.length) { state.matches = []; renderIssues(); }
    if (editor.querySelectorAll('sup.wd-fnref').length !== els.footnotesList.children.length) renderFootnotes();
    scheduleAutosave();
  });

  /* ── restore autosave ── */
  (function restoreAutosave() {
    try {
      var raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && typeof saved.html === 'string') {
        editor.innerHTML = saved.html;
        state.header = saved.header || ''; state.footer = saved.footer || ''; state.pageNum = !!saved.pageNum;
        els.docHeader.innerHTML = saved.headerHtml || (saved.header ? escapeHtml(saved.header) : '');
        els.docFooter.innerHTML = saved.footerHtml || (saved.footer ? escapeHtml(saved.footer) : '');
        state.pageSize = saved.pageSize || 'A4'; state.orientation = saved.orientation || 'portrait'; state.margins = saved.margins || 'normal';
        setStatus(t('restoredDraft'));
      }
    } catch (e) {}
  })();

  /* ── init ── */
  applyStaticI18n();
  buildLangOptions();
  els.langSelect.value = state.lang;
  if (els.langToggle) {
    els.langToggle.addEventListener('click', function () {
      setUILang(getUILang() === 'en' ? 'th' : 'en');
      applyStaticI18n(); buildLangOptions(); renderIssues(); renderFootnotes(); updateHeaderFooterUI();
    });
  }
  applyPageSetup();
  updateHeaderFooterUI();
  renderFootnotes();
  renderIssues();
  updateCounts();
}

/* export ให้ทดสอบ logic ล้วนๆ จาก Node */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { summarizeText: summarizeText, splitSentences: splitSentences, LANGUAGES: LANGUAGES, textToParagraphsHtml: textToParagraphsHtml, PAGE_SIZES: PAGE_SIZES, MARGINS: MARGINS, cssColorToHex: cssColorToHex };
}
})();
