/* ══════════════════════════════════════════════════════════════════
   Tanot — doc-check.js
   ตรวจสอบเอกสาร: แนบไฟล์ (.txt/.docx/.pdf/รูปภาพ) → ตรวจคำผิดด้วย
   LanguageTool API สาธารณะ → แก้ตามคำแนะนำ → อ่านออกเสียง → ดาวน์โหลด .docx
   ไฟล์ .txt/.docx/.pdf และข้อความที่พิมพ์เอง ประมวลผลในเบราว์เซอร์ทั้งหมด
   ไม่มีอะไรถูกอัปโหลดขึ้นเซิร์ฟเวอร์ของเรา — ยกเว้นรูปภาพเมื่อเลือกโหมดอ่านด้วย
   "Claude Vision" (ทางเลือกเสริม ปิดเป็นค่าเริ่มต้น) ซึ่งจะส่งรูปนั้นไปยัง Cloudflare
   Worker ของเราเอง (ไม่ใช่เซิร์ฟเวอร์บุคคลที่สาม) แล้วต่อไป Anthropic API เพื่ออ่านข้อความ
   ในภาพ — โหมดเริ่มต้น (Tesseract) ยังคงอ่านในเบราว์เซอร์ล้วนๆ เหมือนเดิมทุกประการ
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
var PAGE_CHAR_LIMIT = 2500;
var LT_ENDPOINT = 'https://api.languagetool.org/v2/check';

/* ══════════════════════════════════════════════════════════════════
   OCR รูปภาพ: เลือกได้ระหว่าง Tesseract (ฟรี, ในเบราว์เซอร์, อ่านได้แค่ไทย/อังกฤษ)
   กับ Claude Vision (ผ่าน Worker ของเราเอง — ไม่มี key ฝังในโค้ดนี้ — แม่นยำกว่ามาก
   อ่านลายมือได้ รองรับทุกภาษาที่เว็บนี้มี) — URL นี้ไม่ใช่ความลับ (Worker เช็ค origin
   + ถือ API key ไว้ฝั่งเซิร์ฟเวอร์เอง) จึงฝังในโค้ดฝั่งเบราว์เซอร์ได้ตรงๆ
   ══════════════════════════════════════════════════════════════════ */
var OCR_WORKER_URL = 'https://tanot-ocr-proxy.tanot713.workers.dev/';
var OCR_ENGINE_KEY = 'tanot:ocrengine';

function getOcrEngine() {
  try { return localStorage.getItem(OCR_ENGINE_KEY) === 'vision' ? 'vision' : 'tesseract'; }
  catch (e) { return 'tesseract'; }
}
function setOcrEngine(engine) {
  try { localStorage.setItem(OCR_ENGINE_KEY, engine); } catch (e) {}
}

/* โหมด Claude Vision มีค่าใช้จ่ายต่อการใช้งานจริง (ผ่าน API key ของเรา) จึงล็อกด้วยรหัสผ่าน
   แยกต่างหาก — เหมือน auth-gate.js: ป้องกันฝั่งไคลเอนต์เท่านั้น (เก็บแค่ SHA-256 ของรหัสผ่าน
   ไม่ใช่ plaintext) กันคนทั่วไปกดใช้โดยไม่ตั้งใจ ไม่ใช่การป้องกันจริงจังจากผู้ที่ตั้งใจเปิด DevTools */
var OCR_PW_HASH = 'a23be51eba57166064b8ffc23c735a3f6638e8c1b9302f232b87119e432bd356';
var OCR_PW_UNLOCK_KEY = 'tanot:ocrvision:unlocked';

async function sha256Hex(str) {
  var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}
function isVisionUnlocked() {
  try { return localStorage.getItem(OCR_PW_UNLOCK_KEY) === '1'; } catch (e) { return false; }
}

/* แปลงไฟล์เป็น base64 แบบแบ่งชิ้น (กัน stack overflow จาก String.fromCharCode.apply กับไฟล์ใหญ่) */
async function fileToBase64(file) {
  var buf = await file.arrayBuffer();
  var bytes = new Uint8Array(buf);
  var binary = '', chunkSize = 0x8000;
  for (var i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/* ══════════════════════════════════════════════════════════════════
   ภาษาที่ใช้แสดงผล UI (ไทย/อังกฤษ) — แยกจาก "ภาษาของเอกสาร" (state.lang) ด้านบน
   เก็บด้วย localStorage คนละ key กับ ui-locale ของแอปหลัก เพราะหน้านี้แยกออกมา
   ══════════════════════════════════════════════════════════════════ */
var UI_LANG_KEY = 'tanot:doclang';

function getUILang() {
  try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; }
  catch (e) { return 'th'; }
}
function setUILang(lang) {
  try { localStorage.setItem(UI_LANG_KEY, lang); } catch (e) {}
}

var I18N = {
  th: {
    docTitleType: 'ตรวจสอบเอกสาร | Tanot',
    docTitleFile: 'ตรวจสอบเอกสารจากไฟล์ | Tanot',
    crumbResp: 'งานที่รับผิดชอบ',
    crumbDocCheck: 'ตรวจสอบเอกสาร',
    pageTitleType: 'ตรวจสอบเอกสาร: พิมพ์ข้อความเอง',
    pageDescType: 'พิมพ์หรือวางข้อความที่ต้องการตรวจตรงนี้ เลือกภาษา แล้วให้ระบบตรวจคำผิด ไฮไลต์จุดที่ควรแก้ อ่านออกเสียง และดาวน์โหลดเป็นไฟล์ — ทำงานในเบราว์เซอร์ของคุณทั้งหมด',
    pageTitleFile: 'ตรวจสอบเอกสาร: แนบไฟล์',
    modeTabType: 'พิมพ์ข้อความเอง',
    modeTabFile: 'แนบไฟล์',
    typeTextareaPlaceholder: 'พิมพ์หรือวางข้อความที่ต้องการตรวจตรงนี้ — เช่น ประโยคที่ไม่แน่ใจว่าเขียนถูกไหม หรืออยากให้แนะนำสำนวนที่เป็นทางการกว่านี้',
    useTypedTextBtn: 'ใช้ข้อความนี้',
    dropMain: 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์',
    dropHint: 'รองรับ .txt · .docx · .pdf · .png · .jpg (สแกน/ภาพถ่ายใช้ OCR อ่านให้อัตโนมัติ)',
    dropZoneAriaLabel: 'แนบไฟล์เอกสาร',
    replaceFileBtnTitleType: 'เริ่มใหม่',
    replaceFileBtnTitleFile: 'เปลี่ยนไฟล์',
    runBtn: 'ตรวจคำผิด',
    speakBtnTitle: 'อ่านออกเสียงหน้านี้',
    stopSpeakTitle: 'หยุดอ่าน',
    downloadBtnTitle: 'ดาวน์โหลดไฟล์ที่แก้ไข',
    prevBtn: 'หน้าก่อน',
    nextBtn: 'หน้าถัดไป',
    issuesFoundHeading: 'จุดที่พบ',
    applyFixBtn: 'แก้ไขทั้งหมดในหน้านี้',
    issueEmptyText: 'ไม่พบจุดที่ควรแก้ในหน้านี้',
    emptyStateType: 'ยังไม่ได้พิมพ์ข้อความ — เริ่มจากกล่องด้านบน',
    emptyStateFile: 'ยังไม่ได้แนบไฟล์ — เริ่มจากกล่องด้านบน',
    footerText: 'Tanot — งานที่รับผิดชอบ',
    badgeStyle: 'สไตล์/ความเป็นทางการ',
    badgeSpelling: 'คำผิด/ไวยากรณ์',
    langAiPending: ' (รอ AI ขั้นสูง)',
    pageIndicator: 'หน้า {cur} / {total}',
    langNotSupported: 'ภาษา "{lang}" ยังไม่มีบริการตรวจคำผิดสาธารณะที่แม่นยำพอ — ระบบจะเปิดให้ใช้การตรวจขั้นสูงในเฟสถัดไป',
    noTextToCheck: 'ยังไม่มีข้อความในหน้านี้ให้ตรวจ — กรุณาแนบไฟล์ก่อน',
    checking: 'กำลังตรวจคำผิด...',
    checkedResult: 'ตรวจพบ {n} จุดที่ควรแก้ไขในหน้านี้',
    checkError: 'เกิดข้อผิดพลาดระหว่างตรวจคำผิด: {msg}',
    readingFile: 'กำลังอ่านไฟล์...',
    fileReadSuccess: 'อ่านไฟล์สำเร็จ — พบ {n} หน้า',
    fileReadError: 'เกิดข้อผิดพลาด: {msg}',
    typedTextUsed: 'ใช้ข้อความที่พิมพ์แล้ว — พบ {n} หน้า',
    typedTextLabel: 'ข้อความที่พิมพ์',
    fixAllDone: 'แก้ไขคำผิดในหน้านี้ตามคำแนะนำแรกของแต่ละจุดแล้ว',
    singleFixDone: 'แก้ "{old}" เป็น "{new}" แล้ว',
    downloadError: 'ดาวน์โหลดไม่สำเร็จ: {msg}',
    pdfNoTextPage: '(ไม่พบข้อความในหน้านี้ — อาจเป็นภาพสแกน)',
    pdfGarbledPage: '(ข้อความในหน้านี้อ่านไม่ออก — ไฟล์นี้อาจใช้ font แบบพิเศษที่ไม่ใช่ Unicode มาตรฐาน)',
    ocrNoText: '(ไม่พบข้อความในภาพ)',
    unsupportedFileType: 'ไม่รองรับไฟล์ประเภทนี้ (รองรับ .txt .docx .pdf .png .jpg)',
    ltServiceError: 'บริการตรวจคำผิดตอบกลับผิดพลาด ({status})',
    ocrEngineLabel: 'อ่านรูปภาพด้วย',
    ocrEngineTesseract: 'ฟรี (ไทย/อังกฤษ)',
    ocrEngineVision: 'Claude Vision (แม่นยำกว่า ทุกภาษา)',
    ocrEngineNote: 'โหมดนี้จะส่งรูปที่แนบไปยัง Cloudflare Worker ของเราแล้วต่อไปยัง Anthropic API เพื่ออ่านข้อความ (ไม่ใช่ประมวลผลในเบราว์เซอร์ล้วนๆ เหมือนโหมดฟรี)',
    ocrVisionNetErr: 'เชื่อมต่อบริการ Claude Vision ไม่ได้ — ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือลองสลับไปใช้โหมดฟรี (Tesseract) แทน',
    ocrVisionApiErr: 'บริการ Claude Vision ตอบกลับผิดพลาด ({status}) — ลองสลับไปใช้โหมดฟรี (Tesseract) แทน',
    ocrPwTitle: 'ใส่รหัสผ่านเพื่อใช้ Claude Vision',
    ocrPwDesc: 'โหมดนี้มีค่าใช้จ่ายต่อการใช้งาน จึงล็อกด้วยรหัสผ่านแยกต่างหาก',
    ocrPwPlaceholder: 'รหัสผ่าน',
    ocrPwErrText: 'รหัสผ่านไม่ถูกต้อง',
    ocrPwCancel: 'ยกเลิก',
    ocrPwSubmit: 'ยืนยัน'
  },
  en: {
    docTitleType: 'Document Check | Tanot',
    docTitleFile: 'Document Check from File | Tanot',
    crumbResp: 'Responsibilities',
    crumbDocCheck: 'Document Check',
    pageTitleType: 'Document Check: Type Text',
    pageDescType: 'Type or paste the text you want checked here, choose a language, then have the system check for spelling errors, highlight what should be fixed, read it aloud, and download it as a file — everything runs in your browser.',
    pageTitleFile: 'Document Check: Attach File',
    modeTabType: 'Type Text',
    modeTabFile: 'Attach File',
    typeTextareaPlaceholder: 'Type or paste the text you want checked here — e.g. a sentence you\'re not sure is correct, or one you\'d like a more formal alternative for.',
    useTypedTextBtn: 'Use This Text',
    dropMain: 'Drag a file here, or click to choose one',
    dropHint: 'Supports .txt · .docx · .pdf · .png · .jpg (scans/photos are read automatically with OCR)',
    dropZoneAriaLabel: 'Attach a document file',
    replaceFileBtnTitleType: 'Start Over',
    replaceFileBtnTitleFile: 'Change File',
    runBtn: 'Check Spelling',
    speakBtnTitle: 'Read This Page Aloud',
    stopSpeakTitle: 'Stop Reading',
    downloadBtnTitle: 'Download Corrected File',
    prevBtn: 'Previous Page',
    nextBtn: 'Next Page',
    issuesFoundHeading: 'Issues Found',
    applyFixBtn: 'Apply All Fixes on This Page',
    issueEmptyText: 'No issues found on this page',
    emptyStateType: 'No text yet — start with the box above',
    emptyStateFile: 'No file attached yet — start with the box above',
    footerText: 'Tanot — Responsibilities',
    badgeStyle: 'Style/Formality',
    badgeSpelling: 'Spelling/Grammar',
    langAiPending: ' (advanced AI coming soon)',
    pageIndicator: 'Page {cur} / {total}',
    langNotSupported: 'The "{lang}" language doesn\'t have an accurate enough public spell-check service yet — advanced checking for it is coming in a future phase.',
    noTextToCheck: 'There\'s no text on this page to check yet — please attach a file first.',
    checking: 'Checking spelling...',
    checkedResult: 'Found {n} issue(s) to fix on this page',
    checkError: 'An error occurred while checking spelling: {msg}',
    readingFile: 'Reading file...',
    fileReadSuccess: 'File read successfully — found {n} page(s)',
    fileReadError: 'An error occurred: {msg}',
    typedTextUsed: 'Using the typed text — found {n} page(s)',
    typedTextLabel: 'Typed text',
    fixAllDone: 'Fixed all issues on this page using the first suggestion for each one',
    singleFixDone: 'Changed "{old}" to "{new}"',
    downloadError: 'Download failed: {msg}',
    pdfNoTextPage: '(No text found on this page — it may be a scanned image)',
    pdfGarbledPage: '(The text on this page is unreadable — this file may use a special non-Unicode font)',
    ocrNoText: '(No text found in the image)',
    unsupportedFileType: 'This file type is not supported (supports .txt .docx .pdf .png .jpg)',
    ltServiceError: 'The spell-check service returned an error ({status})',
    ocrEngineLabel: 'Read images with',
    ocrEngineTesseract: 'Free (Thai/English)',
    ocrEngineVision: 'Claude Vision (more accurate, all languages)',
    ocrEngineNote: 'This mode sends the attached image to our Cloudflare Worker, which forwards it to the Anthropic API to read the text (not purely in-browser processing like the free mode).',
    ocrVisionNetErr: 'Could not reach the Claude Vision service — check your internet connection, or switch back to the free (Tesseract) mode.',
    ocrVisionApiErr: 'The Claude Vision service returned an error ({status}) — try switching back to the free (Tesseract) mode.',
    ocrPwTitle: 'Enter password to use Claude Vision',
    ocrPwDesc: 'This mode costs money per use, so it\'s locked behind a separate password.',
    ocrPwPlaceholder: 'Password',
    ocrPwErrText: 'Incorrect password',
    ocrPwCancel: 'Cancel',
    ocrPwSubmit: 'Confirm'
  }
};

function t(key, vars) {
  var lang = getUILang();
  var str = (I18N[lang] && I18N[lang][key]) || I18N.th[key] || key;
  if (vars) {
    Object.keys(vars).forEach(function (k) {
      str = str.replace('{' + k + '}', vars[k]);
    });
  }
  return str;
}

function langLabel(l) { return getUILang() === 'en' ? l.labelEn : l.label; }

function langByCode(code) {
  for (var i = 0; i < LANGUAGES.length; i++) if (LANGUAGES[i].code === code) return LANGUAGES[i];
  return LANGUAGES[0];
}

/* แบ่งข้อความยาวเป็น "หน้า" — รวมบรรทัดที่ไม่ว่างเข้าด้วยกันจนใกล้ครบ PAGE_CHAR_LIMIT ตัวอักษร */
function splitIntoPages(text) {
  var lines = text.split(/\n+/).filter(function (l) { return l.trim().length > 0; });
  var pages = [], buf = '';
  lines.forEach(function (line) {
    if ((buf + '\n' + line).length > PAGE_CHAR_LIMIT && buf) {
      pages.push(buf.trim());
      buf = line;
    } else {
      buf = buf ? buf + '\n' + line : line;
    }
  });
  if (buf.trim()) pages.push(buf.trim());
  return pages.length ? pages : [''];
}

/* ตรวจว่าข้อความที่ดึงมาดูเหมือนตัวอักษรเพี้ยน (font พิเศษที่ไม่ใช่ Unicode มาตรฐาน) หรือไม่ */
function isGarbledText(text) {
  var stripped = text.replace(/\s+/g, '');
  if (stripped.length < 10) return false;
  var garbled = (stripped.match(/[\-ÿ‘-‟]/g) || []).length;
  var normal = (stripped.match(/[฀-๿a-zA-Z0-9.,!?]/g) || []).length;
  return garbled / stripped.length > 0.2 && garbled > normal;
}

/* เอาคำแนะนำแรกของแต่ละจุดมาแทนที่ในข้อความ (จากหลังมาหน้าเพื่อไม่ให้ offset เพี้ยน) */
function applyFixes(text, matches) {
  var sorted = matches.slice().sort(function (a, b) { return b.offset - a.offset; });
  var result = text;
  sorted.forEach(function (m) {
    if (m.replacements && m.replacements.length) {
      result = result.slice(0, m.offset) + m.replacements[0] + result.slice(m.offset + m.length);
    }
  });
  return result;
}

async function checkSpelling(text, ltCode) {
  if (!text.trim()) return [];
  /* level:'picky' เปิดกฎเชิงสไตล์เพิ่ม (คำไม่เป็นทางการ ประโยคยืดยาด ฯลฯ)
     นอกเหนือจากตรวจตัวสะกด/ไวยากรณ์พื้นฐาน — รองรับเฉพาะภาษาที่มี ltCode */
  var params = new URLSearchParams({ text: text, language: ltCode, level: 'picky' });
  var res = await fetch(LT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  if (!res.ok) throw new Error(t('ltServiceError', { status: res.status }));
  var data = await res.json();
  return (data.matches || []).map(function (m) {
    return {
      offset: m.offset, length: m.length, message: m.message,
      replacements: (m.replacements || []).slice(0, 5).map(function (r) { return r.value; }),
      ruleId: m.rule && m.rule.id,
      category: m.rule && m.rule.category && m.rule.category.id
    };
  });
}

/* จัดกลุ่มหมวดของ LanguageTool ให้เหลือ 2 ป้ายที่เข้าใจง่าย */
function issueKind(category) {
  var styleCats = ['STYLE', 'REDUNDANCY', 'WORDINESS', 'REGISTER', 'COLLOQUIALISMS', 'BRITISH_ENGLISH', 'AMERICAN_ENGLISH_STYLE', 'CONFUSED_WORDS'];
  return styleCats.indexOf(category) !== -1 ? 'style' : 'spelling';
}

async function readTxtFile(file) { return splitIntoPages(await file.text()); }

async function readDocxFile(file) {
  var buf = await file.arrayBuffer();
  var result = await window.mammoth.extractRawText({ arrayBuffer: buf });
  return splitIntoPages(result.value);
}

async function readPdfFile(file) {
  var buf = await file.arrayBuffer();
  var doc = await window.pdfjsLib.getDocument({ data: buf }).promise;
  var pages = [];
  for (var i = 1; i <= doc.numPages; i++) {
    var page = await doc.getPage(i);
    var content = await page.getTextContent();
    var text = content.items.map(function (it) { return it.str; }).join(' ').trim();
    if (!text) pages.push(t('pdfNoTextPage'));
    else if (isGarbledText(text)) pages.push(t('pdfGarbledPage'));
    else pages.push(text);
  }
  return pages.length ? pages : [''];
}

async function readImageFileTesseract(file) {
  var result = await window.Tesseract.recognize(file, 'eng+tha');
  return splitIntoPages(result.data.text || t('ocrNoText'));
}

async function readImageFileVision(file) {
  var base64 = await fileToBase64(file);
  var mediaType = file.type || 'image/png';
  var res;
  try {
    res = await fetch(OCR_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mediaType: mediaType })
    });
  } catch (e) {
    throw new Error(t('ocrVisionNetErr'));
  }
  var data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || t('ocrVisionApiErr', { status: res.status }));
  return splitIntoPages(data.text || t('ocrNoText'));
}

async function readImageFile(file) {
  return getOcrEngine() === 'vision' ? readImageFileVision(file) : readImageFileTesseract(file);
}

async function readAnyFile(file) {
  var name = file.name.toLowerCase();
  if (name.endsWith('.txt')) return { pages: await readTxtFile(file) };
  if (name.endsWith('.docx')) return { pages: await readDocxFile(file) };
  if (name.endsWith('.pdf')) return { pages: await readPdfFile(file) };
  if (/\.(png|jpe?g|webp|bmp)$/.test(name)) return { pages: await readImageFile(file) };
  throw new Error(t('unsupportedFileType'));
}

async function downloadAsDocx(pages, baseName) {
  var docx = window.docx;
  var paragraphs = [];
  pages.forEach(function (pageText) {
    pageText.split('\n').forEach(function (line) { paragraphs.push(new docx.Paragraph(line)); });
    paragraphs.push(new docx.Paragraph(''));
  });
  var doc = new docx.Document({ sections: [{ children: paragraphs }] });
  var blob = await docx.Packer.toBlob(doc);
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = baseName.endsWith('.docx') ? baseName : baseName + '.docx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* วาดข้อความพร้อมไฮไลต์จุดที่ตรวจพบ */
function renderHighlightedText(container, text, matches, activeIndex, onClickMatch) {
  container.innerHTML = '';
  if (!matches || !matches.length) { container.textContent = text; return; }
  var sorted = matches.map(function (m, i) { return Object.assign({}, m, { _i: i }); })
    .sort(function (a, b) { return a.offset - b.offset; });
  var cursor = 0;
  sorted.forEach(function (m) {
    if (m.offset > cursor) container.appendChild(document.createTextNode(text.slice(cursor, m.offset)));
    var mark = document.createElement('mark');
    mark.className = 'err-mark' + (m._i === activeIndex ? ' active' : '');
    mark.textContent = text.slice(m.offset, m.offset + m.length);
    mark.title = m.message + (m.replacements && m.replacements.length ? ' → ' + m.replacements.join(', ') : '');
    mark.addEventListener('click', function () { onClickMatch(m._i); });
    container.appendChild(mark);
    cursor = m.offset + m.length;
  });
  if (cursor < text.length) container.appendChild(document.createTextNode(text.slice(cursor)));
}

/* ══════════════════════════════════════════════════════════════════
   UI wiring (ข้ามส่วนนี้เมื่อรันทดสอบ logic ล้วนๆ แบบ Node — ตรวจว่ามี document ก่อน)
   ══════════════════════════════════════════════════════════════════ */
if (typeof document !== 'undefined' && document.getElementById('toolbar')) {
  var state = {
    filename: '', pages: [], correctedPages: [], pageIndex: 0,
    lang: 'th', matchesByPage: {}, activeMatch: null, busy: false, speaking: false
  };

  var $ = function (id) { return document.getElementById(id); };
  /* หน้าพิมพ์ข้อความเอง (doc-check.html) กับหน้าแนบไฟล์ (doc-check-file.html)
     แยกกันแล้ว — แต่ละหน้ามีแค่ dropZone หรือ typeBox อย่างใดอย่างหนึ่ง
     ตัวแปรที่ไม่มีในหน้านั้นจะเป็น null และถูก guard ไว้ทุกจุดที่ใช้ */
  var langSelect = $('langSelect'), dropZone = $('dropZone'), fileInput = $('fileInput'),
      toolbar = $('toolbar'), fileChipName = $('fileChipName'), replaceFileBtn = $('replaceFileBtn'),
      runBtn = $('runBtn'), applyFixBtn = $('applyFixBtn'), speakBtn = $('speakBtn'),
      downloadBtn = $('downloadBtn'), statusMsg = $('statusMsg'),
      workspace = $('workspace'), prevBtn = $('prevBtn'), nextBtn = $('nextBtn'), pageIndicator = $('pageIndicator'),
      docText = $('docText'), issueCount = $('issueCount'), issueList = $('issueList'), issueEmpty = $('issueEmpty'),
      emptyState = $('emptyState'), typeBox = $('typeBox'), modeTabs = $('modeTabs'),
      typeTextarea = $('typeTextarea'), useTypedTextBtn = $('useTypedTextBtn'), langToggle = $('langToggle'),
      ocrEngineToggle = $('ocrEngineToggle'), ocrEngineNote = $('ocrEngineNote'),
      ocrPwOverlay = $('ocrPwOverlay'), ocrPwInput = $('ocrPwInput'), ocrPwErr = $('ocrPwErr'),
      ocrPwCancel = $('ocrPwCancel'), ocrPwSubmit = $('ocrPwSubmit');

  var SPEAK_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
  var STOP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
  speakBtn.innerHTML = SPEAK_ICON;

  /* ══ ภาษา UI (ไทย/อังกฤษ) — แปล element ที่มี data-i18n-* และสร้างตัวเลือกภาษาเอกสารใหม่ ══ */
  function applyStaticI18n() {
    var lang = getUILang();
    document.documentElement.lang = lang;
    var titleKey = document.body.getAttribute('data-doctitle-key');
    if (titleKey) document.title = t(titleKey);
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.title = t(el.getAttribute('data-i18n-title')); });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label'))); });
    if (langToggle) {
      langToggle.querySelectorAll('span').forEach(function (span) {
        span.classList.toggle('active', span.getAttribute('data-lt') === lang);
      });
    }
    if (!state.speaking) speakBtn.title = t('speakBtnTitle');
  }

  function buildLangOptions() {
    var prevValue = langSelect.value || state.lang;
    langSelect.innerHTML = '';
    LANGUAGES.forEach(function (l) {
      var opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = langLabel(l) + (l.ltCode ? '' : t('langAiPending'));
      langSelect.appendChild(opt);
    });
    langSelect.value = prevValue;
  }

  /* ══ เลือกวิธีอ่าน OCR รูปภาพ (Tesseract ฟรี / Claude Vision) — มีเฉพาะหน้าแนบไฟล์ ══ */
  function applyOcrEngineUI() {
    if (!ocrEngineToggle) return;
    var engine = getOcrEngine();
    ocrEngineToggle.querySelectorAll('[data-oe]').forEach(function (span) {
      span.classList.toggle('active', span.getAttribute('data-oe') === engine);
    });
    if (ocrEngineNote) ocrEngineNote.style.display = engine === 'vision' ? 'block' : 'none';
  }
  function showOcrPwModal() {
    if (!ocrPwOverlay) return;
    ocrPwErr.style.display = 'none';
    ocrPwInput.value = '';
    ocrPwOverlay.style.display = 'flex';
    ocrPwInput.focus();
  }
  function hideOcrPwModal() {
    if (ocrPwOverlay) ocrPwOverlay.style.display = 'none';
  }
  function submitOcrPw() {
    var pw = ocrPwInput.value;
    sha256Hex(pw).then(function (hex) {
      if (hex === OCR_PW_HASH) {
        try { localStorage.setItem(OCR_PW_UNLOCK_KEY, '1'); } catch (e) {}
        hideOcrPwModal();
        setOcrEngine('vision');
        applyOcrEngineUI();
      } else {
        ocrPwErr.style.display = 'block';
        ocrPwInput.value = '';
        ocrPwInput.focus();
      }
    });
  }

  if (ocrEngineToggle) {
    ocrEngineToggle.addEventListener('click', function (e) {
      var span = e.target.closest('[data-oe]');
      if (!span) return;
      var engine = span.getAttribute('data-oe');
      if (engine === 'vision' && !isVisionUnlocked()) { showOcrPwModal(); return; }
      setOcrEngine(engine);
      applyOcrEngineUI();
    });
  }
  if (ocrPwCancel) ocrPwCancel.addEventListener('click', hideOcrPwModal);
  if (ocrPwSubmit) ocrPwSubmit.addEventListener('click', submitOcrPw);
  if (ocrPwOverlay) {
    ocrPwOverlay.addEventListener('click', function (e) { if (e.target === ocrPwOverlay) hideOcrPwModal(); });
    ocrPwOverlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideOcrPwModal();
      else if (e.key === 'Enter') { e.preventDefault(); submitOcrPw(); }
    });
  }

  applyStaticI18n();
  buildLangOptions();
  applyOcrEngineUI();
  langSelect.value = state.lang;

  if (langToggle) {
    langToggle.addEventListener('click', function () {
      setUILang(getUILang() === 'en' ? 'th' : 'en');
      applyStaticI18n();
      buildLangOptions();
      render();
    });
  }

  function setStatus(msg, isErr, showSpinner) {
    statusMsg.innerHTML = '';
    statusMsg.classList.toggle('err', !!isErr);
    if (showSpinner) { var s = document.createElement('span'); s.className = 'spinner'; statusMsg.appendChild(s); }
    if (msg) statusMsg.appendChild(document.createTextNode(msg));
  }

  function currentText() { return state.pages[state.pageIndex] || ''; }
  function currentMatches() { return state.matchesByPage[state.pageIndex] || []; }

  function render() {
    var hasFile = state.pages.length > 0;
    emptyState.style.display = hasFile ? 'none' : 'block';
    if (modeTabs) modeTabs.style.display = hasFile ? 'none' : 'flex';
    if (dropZone) dropZone.style.display = hasFile ? 'none' : 'block';
    if (typeBox) typeBox.style.display = hasFile ? 'none' : 'block';
    toolbar.style.display = hasFile ? 'flex' : 'none';
    workspace.style.display = hasFile ? 'grid' : 'none';
    runBtn.disabled = state.busy || !state.pages.length;
    speakBtn.disabled = state.busy || !state.pages.length;
    downloadBtn.disabled = state.busy || !state.pages.length;
    prevBtn.disabled = state.pageIndex === 0;
    nextBtn.disabled = state.pageIndex >= state.pages.length - 1;

    if (!hasFile) return;
    fileChipName.textContent = state.filename;
    pageIndicator.textContent = t('pageIndicator', { cur: state.pageIndex + 1, total: state.pages.length });
    renderHighlightedText(docText, currentText(), currentMatches(), state.activeMatch, function (i) {
      state.activeMatch = i; render();
    });

    var matches = currentMatches();
    issueCount.textContent = matches.length;
    issueCount.classList.toggle('zero', matches.length === 0);
    applyFixBtn.style.display = matches.length ? 'flex' : 'none';
    issueEmpty.style.display = matches.length ? 'none' : 'block';
    issueList.innerHTML = '';
    matches.forEach(function (m, i) {
      var item = document.createElement('div');
      item.className = 'dc-issue' + (i === state.activeMatch ? ' active' : '');
      var quoted = currentText().slice(m.offset, m.offset + m.length);
      var chipsHtml = (m.replacements || []).map(function (r, ri) {
        return '<button class="chip" data-ri="' + ri + '" type="button">' + r.replace(/</g, '&lt;') + '</button>';
      }).join('');
      var kind = issueKind(m.category);
      var badgeHtml = kind === 'style'
        ? '<span class="kind-badge style">' + t('badgeStyle') + '</span>'
        : '<span class="kind-badge spelling">' + t('badgeSpelling') + '</span>';
      item.innerHTML = badgeHtml +
        '<div class="quote">"' + quoted.replace(/</g, '&lt;') + '"</div>' +
        '<div class="msg">' + m.message.replace(/</g, '&lt;') + '</div>' +
        (chipsHtml ? '<div class="chips">' + chipsHtml + '</div>' : '');
      item.addEventListener('click', function () { state.activeMatch = i; render(); });
      item.querySelectorAll('.chip').forEach(function (chip) {
        chip.addEventListener('click', function (ev) {
          ev.stopPropagation();
          acceptSingleFix(i, Number(chip.dataset.ri));
        });
      });
      issueList.appendChild(item);
    });
  }

  /* ยอมรับคำแนะนำแค่จุดเดียว (เพิ่มจากของเดิมที่มีแค่ "แก้ทั้งหมด") */
  function acceptSingleFix(matchIndex, replacementIndex) {
    var matches = currentMatches();
    var m = matches[matchIndex];
    if (!m || !m.replacements || !m.replacements[replacementIndex]) return;
    var text = currentText();
    var replacement = m.replacements[replacementIndex];
    var fixed = text.slice(0, m.offset) + replacement + text.slice(m.offset + m.length);
    state.pages[state.pageIndex] = fixed;
    state.correctedPages[state.pageIndex] = fixed;
    var delta = replacement.length - m.length;
    state.matchesByPage[state.pageIndex] = matches.filter(function (_, i) { return i !== matchIndex; })
      .map(function (mm) { return mm.offset > m.offset ? Object.assign({}, mm, { offset: mm.offset + delta }) : mm; });
    state.activeMatch = null;
    setStatus(t('singleFixDone', { old: text.slice(m.offset, m.offset + m.length), new: replacement }));
    render();
  }

  function loadPages(pages, label) {
    state.filename = label;
    state.pages = pages;
    state.correctedPages = pages.slice();
    state.pageIndex = 0;
    state.matchesByPage = {};
    state.activeMatch = null;
  }

  replaceFileBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    state.pages = []; state.matchesByPage = {}; state.activeMatch = null;
    setStatus('');
    render();
  });

  async function handleFile(file) {
    state.busy = true; render();
    setStatus(t('readingFile'), false, true);
    try {
      var result = await readAnyFile(file);
      loadPages(result.pages, file.name);
      setStatus(t('fileReadSuccess', { n: result.pages.length }));
    } catch (err) {
      setStatus(t('fileReadError', { msg: err.message }), true);
    } finally {
      state.busy = false; render();
    }
  }

  /* หน้าแนบไฟล์ (doc-check-file.html) เท่านั้นที่มี dropZone/fileInput */
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', function () { fileInput.click(); });
    dropZone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
    ['dragenter', 'dragover'].forEach(function (evt) {
      dropZone.addEventListener(evt, function (e) { e.preventDefault(); dropZone.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      dropZone.addEventListener(evt, function (e) { e.preventDefault(); dropZone.classList.remove('over'); });
    });
    dropZone.addEventListener('drop', function (e) {
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
    fileInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) handleFile(file);
    });
  }

  /* หน้าพิมพ์ข้อความเอง (doc-check.html) เท่านั้นที่มี typeBox */
  if (typeBox && useTypedTextBtn) {
    useTypedTextBtn.addEventListener('click', function () {
      var text = typeTextarea.value;
      if (!text.trim()) { typeTextarea.focus(); return; }
      var pages = splitIntoPages(text);
      loadPages(pages, t('typedTextLabel'));
      setStatus(t('typedTextUsed', { n: pages.length }));
      render();
    });
  }

  runBtn.addEventListener('click', async function () {
    var lang = langByCode(state.lang);
    if (!lang.ltCode) {
      setStatus(t('langNotSupported', { lang: langLabel(lang) }), true);
      return;
    }
    if (!currentText().trim()) { setStatus(t('noTextToCheck'), true); return; }
    state.busy = true; render();
    setStatus(t('checking'), false, true);
    try {
      var matches = await checkSpelling(currentText(), lang.ltCode);
      state.matchesByPage[state.pageIndex] = matches;
      state.activeMatch = null;
      setStatus(t('checkedResult', { n: matches.length }));
    } catch (err) {
      setStatus(t('checkError', { msg: err.message }), true);
    } finally {
      state.busy = false; render();
    }
  });

  applyFixBtn.addEventListener('click', function () {
    var matches = currentMatches();
    if (!matches.length) return;
    var fixed = applyFixes(currentText(), matches);
    state.correctedPages[state.pageIndex] = fixed;
    state.pages[state.pageIndex] = fixed;
    state.matchesByPage[state.pageIndex] = [];
    state.activeMatch = null;
    setStatus(t('fixAllDone'));
    render();
  });

  speakBtn.addEventListener('click', function () {
    if (state.speaking) {
      window.speechSynthesis.cancel();
      state.speaking = false;
      speakBtn.innerHTML = SPEAK_ICON;
      speakBtn.title = t('speakBtnTitle');
      return;
    }
    if (!currentText().trim()) return;
    window.speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(currentText());
    utter.lang = langByCode(state.lang).speechLang;
    utter.onend = function () { state.speaking = false; speakBtn.innerHTML = SPEAK_ICON; speakBtn.title = t('speakBtnTitle'); };
    utter.onerror = function () { state.speaking = false; speakBtn.innerHTML = SPEAK_ICON; speakBtn.title = t('speakBtnTitle'); };
    state.speaking = true;
    speakBtn.innerHTML = STOP_ICON;
    speakBtn.title = t('stopSpeakTitle');
    window.speechSynthesis.speak(utter);
  });

  downloadBtn.addEventListener('click', async function () {
    try {
      await downloadAsDocx(state.correctedPages, (state.filename || 'corrected').replace(/\.[^.]+$/, '') || 'corrected');
    } catch (err) {
      setStatus(t('downloadError', { msg: err.message }), true);
    }
  });

  prevBtn.addEventListener('click', function () { state.pageIndex = Math.max(0, state.pageIndex - 1); state.activeMatch = null; render(); });
  nextBtn.addEventListener('click', function () { state.pageIndex = Math.min(state.pages.length - 1, state.pageIndex + 1); state.activeMatch = null; render(); });
  langSelect.addEventListener('change', function () { state.lang = langSelect.value; });

  render();
}

/* export ให้ทดสอบ logic ล้วนๆ ได้จาก Node โดยไม่ต้องมี browser */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { splitIntoPages: splitIntoPages, isGarbledText: isGarbledText, applyFixes: applyFixes, LANGUAGES: LANGUAGES, PAGE_CHAR_LIMIT: PAGE_CHAR_LIMIT };
}
})();
