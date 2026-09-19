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

/* ── เตรียมภาพให้ Tesseract อ่านแม่นกว่าเดิม ─────────────────────────────────────────
   Tesseract (เหมือน OCR engine ทั่วไป) แม่นยำขึ้นมากถ้าได้ภาพที่: (1) ตัวอักษรสูงพอ
   (ภาพถ่ายมือถือความละเอียดต่ำ/ครอปมาเล็กๆ มักมีตัวอักษรเตี้ยเกินไป) (2) ขาวดำ ตัดกันชัดระหว่าง
   ตัวอักษรกับพื้นหลัง (ภาพสีมีเงา/แสงไม่สม่ำเสมอทำให้ engine สับสน) — ฟังก์ชันนี้ทำ 3 ขั้นตอน
   มาตรฐานที่ใช้กันทั่วไปก่อนป้อนเข้า OCR:
     1) ขยายภาพขึ้นถ้าด้านที่ยาวกว่ายังเล็กกว่า MIN_DIM (ไม่ย่อภาพที่ใหญ่อยู่แล้วลง — เสี่ยงเสียราย
        ละเอียด) กันเคสถ่ายรูปเอกสารมาไกล/ครอปมาเล็ก ตัวอักษรเตี้ยเกินจน engine อ่านไม่ออก
     2) แปลงเป็นสีเทาแล้วยืดคอนทราสต์ (min-max normalize) ให้เต็มช่วง 0-255 — ภาพถ่ายจริงมักไม่ได้
        ใช้ช่วงความสว่างเต็มสเปกตรัม (เช่น เงาทำให้มืดสุดไม่ถึง 0, แสงสะท้อนทำให้สว่างสุดไม่ถึง 255)
     3) แปลงเป็นขาวดำล้วน (binarize) ด้วยเกณฑ์ Otsu (คำนวณ threshold ที่แยกสองกลุ่มพิกเซลได้ดีที่สุด
        จากฮิสโตแกรมของภาพเอง แทนค่าคงที่ตายตัว) — Tesseract ได้รับการยืนยันจากผู้พัฒนาเองว่าทำงานดี
        ที่สุดกับภาพขาวดำสองสี ไม่ใช่ grayscale/สีเต็ม
   ใช้ได้กับทั้งภาพที่ผู้ใช้อัปโหลดตรงๆ และหน้า PDF ที่ render เป็น canvas แล้วก่อนส่งเข้า OCR */
function preprocessForOcr(srcCanvas) {
  var MIN_DIM = 1800;
  var longSide = Math.max(srcCanvas.width, srcCanvas.height);
  var scale = longSide < MIN_DIM ? MIN_DIM / longSide : 1;
  var outW = Math.max(1, Math.round(srcCanvas.width * scale));
  var outH = Math.max(1, Math.round(srcCanvas.height * scale));

  var canvas = document.createElement('canvas');
  canvas.width = outW; canvas.height = outH;
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(srcCanvas, 0, 0, outW, outH);

  var imgData = ctx.getImageData(0, 0, outW, outH);
  var d = imgData.data;
  var n = outW * outH;
  var gray = new Uint8ClampedArray(n);
  var min = 255, max = 0;
  for (var i = 0, p = 0; p < n; i += 4, p++) {
    var g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    gray[p] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  var range = (max - min) || 1;
  var hist = new Array(256).fill(0);
  for (p = 0; p < n; p++) {
    var v = Math.round((gray[p] - min) * 255 / range);
    gray[p] = v;
    hist[v]++;
  }
  /* Otsu's method — หา threshold ที่ทำให้ variance ระหว่างสองกลุ่ม (พิกเซลมืด/สว่าง) มากที่สุด */
  var sum = 0;
  for (var t = 0; t < 256; t++) sum += t * hist[t];
  var sumB = 0, wB = 0, wF, varMax = 0, threshold = 127;
  for (t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = n - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    var mB = sumB / wB, mF = (sum - sumB) / wF;
    var varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > varMax) { varMax = varBetween; threshold = t; }
  }
  for (p = 0, i = 0; p < n; p++, i += 4) {
    var bw = gray[p] >= threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = bw;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function requireLib(globalName, humanName) {
  if (!window[globalName]) {
    throw new Error('โหลดไลบรารีสำหรับอ่านไฟล์ชนิดนี้ไม่สำเร็จ (' + humanName + ') — เช็คอินเทอร์เน็ตแล้วลองรีเฟรชหน้าใหม่');
  }
  return window[globalName];
}

/* ── ตัวเรียก Tesseract ที่ตั้งค่าจริงจัง (ไม่ใช้ Tesseract.recognize() แบบสะดวกที่ตั้งค่าได้จำกัด) ──
   วิจัยแล้วพบข้อเท็จจริงสำคัญ: Tesseract.js เองตั้งค่าเริ่มต้น PSM (Page Segmentation Mode — วิธีมอง
   โครงสร้างภาพก่อนอ่าน) เป็น "SINGLE_BLOCK" (6, มองทั้งภาพเป็นก้อนข้อความเดียวก้อนเดียว ไม่วิเคราะห์
   เค้าโครงหน้าเลย) ต่างจาก Tesseract CLI ที่ใช้ "AUTO" (3, วิเคราะห์เค้าโครงหน้าเองก่อนว่ามีย่อหน้า/
   คอลัมน์/ขอบภาพยังไง) เป็นค่าเริ่มต้น — AUTO มักแม่นกว่าเห็นชัดสำหรับรูปถ่ายเอกสารเต็มหน้าที่มีขอบ/
   หลายย่อหน้า เพราะ SINGLE_BLOCK อาจพยายามอ่านขอบภาพ/พื้นหลังปนเป็นข้อความไปด้วย ส่วนข้อความสั้นๆ
   บรรทัดเดียว (เช่น เขียนด้วยมือในแบบฝึกหัด) ใช้ SINGLE_LINE (7) เหมาะกว่าทั้งสองแบบ เพราะรู้อยู่แล้วว่า
   เป็นบรรทัดเดียวไม่ต้องเดาโครงสร้าง — ต้องใช้ worker.setParameters() ตั้งค่านี้ได้ ซึ่ง Tesseract.recognize()
   แบบสะดวก (สร้าง worker ใหม่ทุกครั้งแล้ว terminate ทิ้งเอง) ไม่เปิดช่องให้ตั้งก่อนอ่านได้เลย

   ยังตั้ง user_defined_dpi ไว้ด้วย (300) เพราะรูปที่ผ่าน preprocessForOcr() มาแล้วมักมีความละเอียดสูงกว่า
   ที่ Tesseract เดาเองจากภาพเปล่าๆ (ไม่มี DPI metadata ติดมากับ canvas/รูปทั่วไป) เดาผิดพลาดได้ ทำให้
   ตัดสินใจสเกลตัวอักษรภายในผิด — ระบุตรงๆ ให้ engine ไม่ต้องเดา

   ใช้ worker เดียวใช้ซ้ำได้ตลอดอายุหน้าเว็บ (ไม่ terminate ทิ้งหลังอ่านแต่ละครั้งเหมือน Tesseract.recognize()
   แบบสะดวก) เพื่อไม่ต้องโหลด/init โมเดลภาษาใหม่ทุกครั้งที่มีคนกด OCR ซ้ำในหน้าเดียวกัน */
var ocrWorkerPromise = null;
function getOcrWorker() {
  if (!ocrWorkerPromise) {
    var Tesseract = requireLib('Tesseract', 'Tesseract.js');
    ocrWorkerPromise = Tesseract.createWorker('eng+tha', 1 /* OEM_LSTM_ONLY — ตรงกับชุดข้อมูลภาษาที่ Tesseract.js โหลดมาให้เป็นค่าเริ่มต้นอยู่แล้ว */);
  }
  return ocrWorkerPromise;
}
var PSM_AUTO = '3', PSM_SINGLE_LINE = '7';
/* opts: { psm: PSM_AUTO|PSM_SINGLE_LINE, onProgress: function(number 0-100) } — คืนข้อความล้วน (trim แล้ว) */
async function recognizeText(image, opts) {
  opts = opts || {};
  var worker = await getOcrWorker();
  await worker.setParameters({
    tessedit_pageseg_mode: opts.psm || PSM_AUTO,
    user_defined_dpi: '300'
  });
  var result = await worker.recognize(image);
  return (result.data.text || '').trim();
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
    requireLib('Tesseract', 'Tesseract.js'); // แค่เช็คว่าโหลดแล้ว — ตัวจริงเรียกผ่าน recognizeText()
    /* scale 3 (~216 DPI) แทน 2 เดิม (~144 DPI) — ยิ่งความละเอียดสูง ตัวอักษรยิ่งคมชัดตอน OCR อ่าน
       (preprocessForOcr ด้านล่างจะขยายเพิ่มอีกให้เองถ้าหน้านั้นยังเล็กกว่าเกณฑ์ขั้นต่ำ) */
    var viewport = page.getViewport({ scale: 3 });
    var canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    var ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    var ocrText = await recognizeText(preprocessForOcr(canvas), { psm: PSM_AUTO });
    parts.push(ocrText || ('(หน้า ' + i + ': OCR อ่านแล้วแต่ไม่พบข้อความ)'));
  }
  return parts.join('\n\n').trim();
}

async function readImageFile(file, opts) {
  requireLib('Tesseract', 'Tesseract.js'); // แค่เช็คว่าโหลดแล้ว — ตัวจริงเรียกผ่าน recognizeText()
  if (opts && opts.onProgress) opts.onProgress({ stage: 'ocr', page: 1, total: 1 });
  /* ผ่าน preprocessForOcr() เสมอ (เดิมส่ง file ดิบเข้า Tesseract ตรงๆ ไม่มีการเตรียมภาพเลย) —
     imageOrientation:'from-image' ให้เคารพค่า EXIF orientation ของรูปที่ถ่ายจากมือถือ (ไม่งั้นรูป
     ที่ถือแนวตั้งแต่กล้องบันทึก orientation ไว้ใน metadata แทนที่จะหมุน pixel จริง จะกลายเป็นเอียง/
     คว่ำตอนวาดลง canvas ทำให้ OCR อ่านไม่ออกเลยทั้งที่ตาเรามองเห็นว่าตั้งตรงปกติ) */
  var bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  var rawCanvas = document.createElement('canvas');
  rawCanvas.width = bitmap.width; rawCanvas.height = bitmap.height;
  rawCanvas.getContext('2d').drawImage(bitmap, 0, 0);
  return recognizeText(preprocessForOcr(rawCanvas), { psm: PSM_AUTO });
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
  preprocessForOcr: preprocessForOcr,
  recognizeText: recognizeText,
  PSM_AUTO: PSM_AUTO,
  PSM_SINGLE_LINE: PSM_SINGLE_LINE,
  isGarbledText: isGarbledText,
  looksLikeSpacedThaiText: looksLikeSpacedThaiText,
  collapseSpacedThaiText: collapseSpacedThaiText
};
})();
