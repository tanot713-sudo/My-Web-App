/* ══════════════════════════════════════════════════════════════════
   Tanot — file-reader.js
   ตัวอ่าน "ไฟล์เอกสารทั่วไป → ข้อความล้วน" ใช้ร่วมกันได้หลายหน้า (ตอนนี้ใช้ใน
   text-to-speech.html; แพทเทิร์นเดียวกับที่ doc-check.js เคยเขียนไว้ใช้เองอยู่
   ก่อนแล้วสำหรับ .txt/.docx/.pdf/รูปภาพ — ไฟล์นี้เขียนแยกใหม่ให้ไม่ผูกกับ UI
   ของหน้าไหนหน้าหนึ่ง (คืนข้อความล้วนอย่างเดียว ไม่มีแนวคิด "หน้า" แบบ doc-check)
   เผื่อเอาไปใช้กับหน้าอื่นเพิ่มในอนาคตได้ตรงๆ โดยไม่ต้องเขียนซ้ำ

   ประมวลผลทุกอย่างในเบราว์เซอร์ล้วนๆ ไม่มีไฟล์ถูกส่งขึ้นเซิร์ฟเวอร์ไหนเลย —
   ไลบรารีที่พึ่งพา (โหลดจาก CDN โดยหน้าที่เรียกใช้ไฟล์นี้ ก่อนไฟล์นี้ทำงานจริง):
   pdfjsLib (window.pdfjsLib), mammoth (window.mammoth), Tesseract (window.Tesseract),
   XLSX/SheetJS (window.XLSX), JSZip (window.JSZip) — ถ้าไลบรารีที่ต้องใช้ยังไม่โหลด
   (เช่น เน็ตช้า/ถูกบล็อก) จะโยน error ข้อความชัดเจนแทนที่จะพังเงียบๆ */
(function () {
'use strict';

/* ตรวจว่าข้อความที่ดึงมาดูเหมือนตัวอักษรเพี้ยน (font พิเศษที่ไม่ใช่ Unicode มาตรฐาน) หรือไม่
   คัดลอกมาจาก doc-check.js (เกณฑ์เดียวกัน) — ใช้ตัดสินว่าหน้า PDF นี้มีเลเยอร์ข้อความจริงใช้ได้
   หรือเป็นแค่ font สัญลักษณ์/embed แปลกๆ ที่ควรถือว่า "ไม่มีข้อความใช้ได้" แล้วไป OCR แทน */
function isGarbledText(text) {
  var stripped = text.replace(/\s+/g, '');
  if (stripped.length < 10) return false;
  var garbled = (stripped.match(/[\-ÿ‘-‟]/g) || []).length;
  var normal = (stripped.match(/[฀-๿a-zA-Z0-9.,!?]/g) || []).length;
  return garbled / stripped.length > 0.2 && garbled > normal;
}

/* บั๊กที่พบบ่อยกับ PDF ภาษาไทยบางไฟล์ (โดยเฉพาะเอกสารราชการ/สัญญาที่แปลงมาจากโปรแกรมบางตัว):
   font วาง glyph แยกตำแหน่งทีละตัวอักษรแทนที่จะเป็นคำ ทำให้ pdf.js คืน TextItem แยกทีละตัว แล้ว
   readPdfFile ต่อข้อความด้วยช่องว่างระหว่างทุก item (บรรทัดล่างนี้) จึงได้ข้อความไทยที่ถูกแยกด้วย
   ช่องว่างทุกตัวอักษร เช่น "ค ู ่ ฉบับ" แทนที่จะเป็น "คู่ฉบับ" — อ่านไม่รู้เรื่องเลย
   วิธีแก้: ตรวจจับรูปแบบนี้แล้วลบช่องว่างที่ "คั่นกลางระหว่างอักษรไทยสองตัว" ออก (ภาษาไทยไม่มีช่องว่าง
   คั่นกลางตัวอักษรในคำอยู่แล้วโดยธรรมชาติ) เช็คด้วย looksLikeSpacedThaiText() ก่อนเสมอ เพื่อไม่ให้ไป
   ลบช่องว่างจริงของข้อความไทยที่ดึงมาถูกต้องอยู่แล้ว (ซึ่งบางทีก็มีช่องว่างคั่นประโยค/วรรคตอนจริงๆ) */
var THAI_CHAR_RE = /[ก-ฺเ-๎๐-๙]/;

function isThaiCharAt(str, i) {
  return i >= 0 && i < str.length && THAI_CHAR_RE.test(str[i]);
}

function looksLikeSpacedThaiText(text) {
  var tokens = text.split(/ /).filter(Boolean);
  if (tokens.length < 15) return false;
  var thaiShortTokens = 0;
  tokens.forEach(function (tok) {
    if (tok.length <= 2 && THAI_CHAR_RE.test(tok) && !/[^฀-๿]/.test(tok)) thaiShortTokens++;
  });
  return (thaiShortTokens / tokens.length) > 0.35;
}

function collapseSpacedThaiText(text) {
  var out = '';
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === ' ' && isThaiCharAt(text, i - 1) && isThaiCharAt(text, i + 1)) continue;
    out += ch;
  }
  return out;
}

function fixSpacedThaiIfNeeded(text) {
  if (text && looksLikeSpacedThaiText(text)) return collapseSpacedThaiText(text);
  return text;
}

function requireLib(globalName, humanName) {
  if (!window[globalName]) {
    throw new Error('โหลดไลบรารีสำหรับอ่านไฟล์ชนิดนี้ไม่สำเร็จ (' + humanName + ') — เช็คอินเทอร์เน็ตแล้วลองรีเฟรชหน้าใหม่');
  }
  return window[globalName];
}

async function readTxtFile(file) {
  return (await file.text()).trim();
}

async function readDocxFile(file) {
  var mammoth = requireLib('mammoth', 'mammoth.js');
  var buf = await file.arrayBuffer();
  var result = await mammoth.extractRawText({ arrayBuffer: buf });
  return (result.value || '').trim();
}

/* .xlsx / .xls / .csv ผ่าน SheetJS — แปลงทุกชีตเป็นข้อความ เรียงเซลล์แต่ละแถวด้วยช่องว่าง
   (แทน comma แบบ CSV ตรงๆ) เพราะจะเอาไปอ่านออกเสียงต่อ ฟังลื่นกว่าอ่านเครื่องหมายจุลภาคทุกเซลล์ */
async function readXlsxFile(file) {
  var XLSX = requireLib('XLSX', 'SheetJS');
  var buf = await file.arrayBuffer();
  var wb = XLSX.read(buf, { type: 'array' });
  var sections = [];
  wb.SheetNames.forEach(function (name) {
    var ws = wb.Sheets[name];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
    var lines = rows.map(function (row) {
      return row.map(function (cell) { return String(cell).trim(); }).filter(Boolean).join(' ');
    }).filter(Boolean);
    if (lines.length) sections.push('ชีต: ' + name + '\n' + lines.join('\n'));
  });
  return sections.join('\n\n').trim();
}

/* .pptx (ไฟล์ zip ที่ข้างในเป็น XML รายสไลด์) — แกะด้วย JSZip แล้วดึงข้อความจากแท็ก <a:t>
   ของแต่ละสไลด์ (ธรรมเนียม namespace prefix "a:" ของ DrawingML เสถียรมากในไฟล์ .pptx ทุกไฟล์
   ที่สร้างจาก PowerPoint/Google Slides/LibreOffice — ไม่ต้องแก้ปม namespace ให้ซับซ้อน) */
async function readPptxFile(file) {
  var JSZip = requireLib('JSZip', 'JSZip');
  var buf = await file.arrayBuffer();
  var zip = await JSZip.loadAsync(buf);
  var slideNames = Object.keys(zip.files)
    .filter(function (name) { return /^ppt\/slides\/slide\d+\.xml$/.test(name); })
    .sort(function (a, b) {
      var na = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
      var nb = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
      return na - nb;
    });
  if (!slideNames.length) throw new Error('ไม่พบสไลด์ในไฟล์นี้ (อาจไม่ใช่ไฟล์ .pptx ที่ถูกต้อง)');
  var parts = [];
  for (var i = 0; i < slideNames.length; i++) {
    var xml = await zip.file(slideNames[i]).async('text');
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var nodes = doc.getElementsByTagName('a:t');
    var texts = [];
    for (var j = 0; j < nodes.length; j++) {
      var t = nodes[j].textContent;
      if (t) texts.push(t);
    }
    var slideText = texts.join(' ').replace(/\s+/g, ' ').trim();
    parts.push('สไลด์ ' + (i + 1) + (slideText ? ': ' + slideText : ' (ไม่มีข้อความ)'));
  }
  return parts.join('\n\n').trim();
}

/* .pdf — ดึงข้อความจากเลเยอร์ข้อความก่อนเสมอ (เร็ว แม่นยำ) ถ้าหน้าไหนไม่มีเลเยอร์ข้อความใช้ได้จริง
   (สแกน/ภาพถ่ายเอกสาร) และเปิด opts.ocr ไว้ → วาดหน้านั้นลง canvas แล้วให้ Tesseract อ่านแทน
   opts.onProgress({stage:'pdf'|'ocr', page, total}) แจ้งความคืบหน้าเพราะ OCR ช้ามาก (หลักวินาที/หน้า) */
async function readPdfFile(file, opts) {
  opts = opts || {};
  var pdfjsLib = requireLib('pdfjsLib', 'pdf.js');
  var buf = await file.arrayBuffer();
  var doc = await pdfjsLib.getDocument({ data: buf }).promise;
  var parts = [];
  for (var i = 1; i <= doc.numPages; i++) {
    if (opts.onProgress) opts.onProgress({ stage: 'pdf', page: i, total: doc.numPages });
    var page = await doc.getPage(i);
    var content = await page.getTextContent();
    var text = content.items.map(function (it) { return it.str; }).join(' ').replace(/\s+/g, ' ').trim();
    if (text && !isGarbledText(text)) { parts.push(text); continue; }

    if (!opts.ocr) { parts.push('(หน้า ' + i + ': ดูเหมือนเป็นภาพสแกน ไม่มีเลเยอร์ข้อความ — เปิด "ใช้ OCR" แล้วลองใหม่ถ้าต้องการอ่านหน้านี้ด้วย)'); continue; }

    if (opts.onProgress) opts.onProgress({ stage: 'ocr', page: i, total: doc.numPages });
    var Tesseract = requireLib('Tesseract', 'Tesseract.js');
    var viewport = page.getViewport({ scale: 2 });
    var canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    var ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    var result = await Tesseract.recognize(canvas, 'eng+tha');
    var ocrText = (result.data.text || '').trim();
    parts.push(ocrText || ('(หน้า ' + i + ': OCR อ่านแล้วแต่ไม่พบข้อความ)'));
  }
  return parts.join('\n\n').trim();
}

async function readImageFile(file, opts) {
  var Tesseract = requireLib('Tesseract', 'Tesseract.js');
  if (opts && opts.onProgress) opts.onProgress({ stage: 'ocr', page: 1, total: 1 });
  var result = await Tesseract.recognize(file, 'eng+tha');
  return (result.data.text || '').trim();
}

/* ชนิดไฟล์ที่รองรับ — ใช้ทั้งตัดสินใจ dispatch ที่นี่ และใส่ใน <input accept="..."> ของหน้าที่เรียกใช้ */
var ACCEPT_ATTR = '.txt,.docx,.xlsx,.xls,.csv,.pptx,.pdf,.png,.jpg,.jpeg,.webp,.bmp';

/* opts: { ocr: boolean, onProgress: function({stage, page, total}) } — ocr มีผลกับ .pdf เท่านั้น
   (รูปภาพเดี่ยว .png/.jpg ฯลฯ ใช้ OCR เสมอเพราะไม่มีเลเยอร์ข้อความให้เลือกอยู่แล้ว) */
function readAnyFile(file, opts) {
  var name = file.name.toLowerCase();
  var promise;
  if (name.endsWith('.txt')) promise = readTxtFile(file);
  else if (name.endsWith('.docx')) promise = readDocxFile(file);
  else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) promise = readXlsxFile(file);
  else if (name.endsWith('.pptx')) promise = readPptxFile(file);
  else if (name.endsWith('.ppt')) return Promise.reject(new Error('ไฟล์ .ppt (PowerPoint รุ่นเก่า) ไม่รองรับ — เปิดไฟล์ใน PowerPoint แล้ว "บันทึกเป็น" ชนิด .pptx ก่อน'));
  else if (name.endsWith('.pdf')) promise = readPdfFile(file, opts);
  else if (/\.(png|jpe?g|webp|bmp)$/.test(name)) promise = readImageFile(file, opts);
  else return Promise.reject(new Error('ไม่รองรับไฟล์ชนิดนี้ — รองรับ .txt/.docx/.xlsx/.xls/.csv/.pptx/.pdf/รูปภาพ'));
  return promise.then(fixSpacedThaiIfNeeded);
}

window.TanotFileReader = {
  ACCEPT_ATTR: ACCEPT_ATTR,
  readAnyFile: readAnyFile,
  readTxtFile: readTxtFile,
  readDocxFile: readDocxFile,
  readXlsxFile: readXlsxFile,
  readPptxFile: readPptxFile,
  readPdfFile: readPdfFile,
  readImageFile: readImageFile,
  isGarbledText: isGarbledText,
  looksLikeSpacedThaiText: looksLikeSpacedThaiText,
  collapseSpacedThaiText: collapseSpacedThaiText
};
})();
