/* ══════════════════════════════════════════════════════════════════
   Tanot — word.js
   งาน Word: แก้ไขเอกสารแบบ Word เต็มรูปแบบ (ตัวหนา/เอียง/ขีดเส้นใต้, หัวข้อ, สี,
   จัดย่อหน้า, ลิสต์, ตาราง, ลิงก์, รูปภาพ) + นำเข้า/ส่งออก .docx จริง (คงรูปแบบ)
   + พูดแล้วขึ้นข้อความ (Dictate) + ตรวจคำผิดด้วย LanguageTool + สรุปเนื้อหา
   ประมวลผลทั้งหมดในเบราว์เซอร์ ไม่มีอะไรถูกอัปโหลดขึ้นเซิร์ฟเวอร์ของเรา
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
var AUTOSAVE_KEY = 'tanot:word:autosave';
var UI_LANG_KEY = 'tanot:doclang';

function getUILang() {
  try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; }
  catch (e) { return 'th'; }
}
function setUILang(lang) { try { localStorage.setItem(UI_LANG_KEY, lang); } catch (e) {} }

var I18N = {
  th: {
    docTitle: 'งาน Word | Tanot',
    crumbResp: 'งานที่รับผิดชอบ',
    crumbWord: 'งาน Word',
    pageTitle: 'งาน Word: พิมพ์และแก้ไขเอกสาร',
    pageDesc: 'พิมพ์เอกสารตั้งแต่หน้าว่าง หรือนำเข้าไฟล์ (.txt .docx .pdf .png .jpg) แล้วจัดรูปแบบด้วยเครื่องมือแบบ Word — ตัวหนา/ตัวเอียง, หัวข้อ, ตาราง, ลิงก์, พูดแล้วขึ้นข้อความ (Dictate), ตรวจคำผิด แล้วดาวน์โหลดเป็นไฟล์ .docx — ทำงานในเบราว์เซอร์ของคุณทั้งหมด',
    newDocBtn: 'หน้าใหม่', importBtn: 'นำเข้าไฟล์', downloadBtn: 'ดาวน์โหลด Word', printBtn: 'พิมพ์ / PDF',
    runBtn: 'ตรวจคำผิด', summarizeBtn: 'สรุปเนื้อหา',
    styleNormal: 'ปกติ', styleH1: 'หัวข้อ 1', styleH2: 'หัวข้อ 2', styleH3: 'หัวข้อ 3', styleQuote: 'คำพูดอ้างอิง',
    issuesFoundHeading: 'จุดที่พบ', applyFixBtn: 'แก้ไขทั้งหมดในเอกสาร', issueEmptyText: 'ไม่พบจุดที่ควรแก้',
    issueHint: 'กด "ตรวจคำผิด" เพื่อดูจุดที่ควรแก้ที่นี่',
    wordsLabel: 'คำ', charsLabel: 'ตัวอักษร', autosaveIdle: 'พร้อมบันทึกอัตโนมัติ', autosaveSaved: 'บันทึกอัตโนมัติแล้ว',
    footerText: 'Tanot — งานที่รับผิดชอบ',
    linkModalTitle: 'แทรกลิงก์', linkUrlLabel: 'URL', modalCancel: 'ยกเลิก', modalInsert: 'แทรก',
    tableModalTitle: 'แทรกตาราง', tableRowsLabel: 'แถว', tableColsLabel: 'คอลัมน์',
    speakBtnTitle: 'อ่านออกเสียงเอกสาร', stopSpeakTitle: 'หยุดอ่าน',
    dictateBtnTitle: 'พูดแล้วขึ้นข้อความ (Dictate)', stopDictateTitle: 'หยุดฟัง',
    undoBtnTitle: 'เลิกทำ', redoBtnTitle: 'ทำซ้ำ',
    boldBtnTitle: 'ตัวหนา', italicBtnTitle: 'ตัวเอียง', underlineBtnTitle: 'ขีดเส้นใต้', strikeBtnTitle: 'ขีดฆ่า',
    textColorTitle: 'สีตัวอักษร', highlightTitle: 'สีไฮไลต์', clearFormatTitle: 'ล้างรูปแบบ',
    alignLeftTitle: 'ชิดซ้าย', alignCenterTitle: 'กึ่งกลาง', alignRightTitle: 'ชิดขวา', alignJustifyTitle: 'กระจายบรรทัด',
    ulBtnTitle: 'สัญลักษณ์หัวข้อย่อย', olBtnTitle: 'ลำดับเลข', outdentBtnTitle: 'ลดระยะเยื้อง', indentBtnTitle: 'เพิ่มระยะเยื้อง',
    linkBtnTitle: 'แทรกลิงก์', imageBtnTitle: 'แทรกรูปภาพ', tableBtnTitle: 'แทรกตาราง', hrBtnTitle: 'เส้นคั่น',
    editorPlaceholder: 'เริ่มพิมพ์เอกสารตรงนี้...',
    langAiPending: ' (รอ AI ขั้นสูง)',
    readingFile: 'กำลังนำเข้าไฟล์...',
    fileImported: 'นำเข้าไฟล์ "{name}" เรียบร้อย — เพิ่มเนื้อหาเข้าเอกสารแล้ว',
    fileReadError: 'เกิดข้อผิดพลาด: {msg}',
    unsupportedFileType: 'ไม่รองรับไฟล์ประเภทนี้ (รองรับ .txt .docx .pdf .png .jpg)',
    ocrNoText: '(ไม่พบข้อความในภาพ)',
    pdfNoTextPage: '(ไม่พบข้อความในหน้านี้ — อาจเป็นภาพสแกน)',
    checking: 'กำลังตรวจคำผิด...',
    checkedResult: 'ตรวจพบ {n} จุดที่ควรแก้ไข',
    checkError: 'เกิดข้อผิดพลาดระหว่างตรวจคำผิด: {msg}',
    ltServiceError: 'บริการตรวจคำผิดตอบกลับผิดพลาด ({status})',
    langNotSupported: 'ภาษา "{lang}" ยังไม่มีบริการตรวจคำผิดสาธารณะที่แม่นยำพอ — ระบบจะเปิดให้ใช้การตรวจขั้นสูงในเฟสถัดไป',
    noTextToCheck: 'ยังไม่มีข้อความในเอกสารให้ตรวจ',
    fixAllDone: 'แก้ไขคำผิดแล้ว {n} จุด',
    fixAllDoneSkipped: 'แก้ไขคำผิดแล้ว {n} จุด (ข้าม {skipped} จุดเพราะเอกสารถูกแก้ไขระหว่างทาง — ลองตรวจคำผิดใหม่อีกครั้ง)',
    singleFixDone: 'แก้ "{old}" เป็น "{new}" แล้ว',
    fixSkipped: 'ไม่สามารถระบุตำแหน่งจุดนี้ได้แน่นอน (เอกสารอาจถูกแก้ไขหลังตรวจ) — ลองตรวจคำผิดใหม่',
    badgeStyle: 'สไตล์/ความเป็นทางการ', badgeSpelling: 'คำผิด/ไวยากรณ์',
    newDocConfirm: 'ล้างเอกสารปัจจุบันและเริ่มหน้าใหม่? (ฉบับร่างที่บันทึกอัตโนมัติไว้จะถูกลบด้วย)',
    clearedDoc: 'ล้างเอกสารแล้ว',
    summarizeEmpty: 'ยังไม่มีเนื้อหาให้สรุป',
    summarized: 'เพิ่มสรุปเนื้อหาเบื้องต้นต่อท้ายเอกสารแล้ว (เลือกประโยคสำคัญด้วยกฎทางสถิติ)',
    summaryHeading: '— สรุปเนื้อหาเบื้องต้น —',
    downloadError: 'ดาวน์โหลดไม่สำเร็จ: {msg}',
    downloadEmpty: 'ยังไม่มีเนื้อหาให้ดาวน์โหลด',
    dictateUnsupported: 'เบราว์เซอร์นี้ไม่รองรับการพูดแล้วขึ้นข้อความ (ลองใช้ Chrome)',
    dictateListening: 'กำลังฟัง... พูดได้เลย',
    dictateListeningInterim: 'กำลังฟัง... "{text}"',
    dictateError: 'เกิดข้อผิดพลาดขณะฟัง: {msg}',
    dictateNoMic: 'ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน — กรุณาอนุญาตการใช้งานไมค์ในเบราว์เซอร์',
    dictateStopped: 'หยุดฟังแล้ว',
    linkNeedUrl: 'กรุณาใส่ URL ก่อนแทรกลิงก์',
    restoredDraft: 'กู้คืนฉบับร่างล่าสุดที่บันทึกอัตโนมัติไว้'
  },
  en: {
    docTitle: 'Word | Tanot',
    crumbResp: 'Responsibilities',
    crumbWord: 'Word',
    pageTitle: 'Word: Write and Edit Documents',
    pageDesc: 'Start typing from a blank page, or import a file (.txt .docx .pdf .png .jpg), then format it with Word-like tools — bold/italic, headings, tables, links, Dictate (speech-to-text), spell check, and download it as a .docx file — everything runs in your browser.',
    newDocBtn: 'New Page', importBtn: 'Import File', downloadBtn: 'Download Word', printBtn: 'Print / PDF',
    runBtn: 'Check Spelling', summarizeBtn: 'Summarize',
    styleNormal: 'Normal', styleH1: 'Heading 1', styleH2: 'Heading 2', styleH3: 'Heading 3', styleQuote: 'Quote',
    issuesFoundHeading: 'Issues Found', applyFixBtn: 'Fix All in Document', issueEmptyText: 'No issues found',
    issueHint: 'Click "Check Spelling" to see issues here',
    wordsLabel: 'words', charsLabel: 'characters', autosaveIdle: 'Ready to autosave', autosaveSaved: 'Autosaved',
    footerText: 'Tanot — Responsibilities',
    linkModalTitle: 'Insert Link', linkUrlLabel: 'URL', modalCancel: 'Cancel', modalInsert: 'Insert',
    tableModalTitle: 'Insert Table', tableRowsLabel: 'Rows', tableColsLabel: 'Columns',
    speakBtnTitle: 'Read Document Aloud', stopSpeakTitle: 'Stop Reading',
    dictateBtnTitle: 'Dictate (Speech to Text)', stopDictateTitle: 'Stop Listening',
    undoBtnTitle: 'Undo', redoBtnTitle: 'Redo',
    boldBtnTitle: 'Bold', italicBtnTitle: 'Italic', underlineBtnTitle: 'Underline', strikeBtnTitle: 'Strikethrough',
    textColorTitle: 'Text Color', highlightTitle: 'Highlight Color', clearFormatTitle: 'Clear Formatting',
    alignLeftTitle: 'Align Left', alignCenterTitle: 'Align Center', alignRightTitle: 'Align Right', alignJustifyTitle: 'Justify',
    ulBtnTitle: 'Bulleted List', olBtnTitle: 'Numbered List', outdentBtnTitle: 'Decrease Indent', indentBtnTitle: 'Increase Indent',
    linkBtnTitle: 'Insert Link', imageBtnTitle: 'Insert Image', tableBtnTitle: 'Insert Table', hrBtnTitle: 'Horizontal Rule',
    editorPlaceholder: 'Start typing your document here...',
    langAiPending: ' (advanced AI coming soon)',
    readingFile: 'Importing file...',
    fileImported: 'Imported "{name}" successfully — added to the document',
    fileReadError: 'An error occurred: {msg}',
    unsupportedFileType: 'This file type is not supported (supports .txt .docx .pdf .png .jpg)',
    ocrNoText: '(No text found in the image)',
    pdfNoTextPage: '(No text found on this page — it may be a scanned image)',
    checking: 'Checking spelling...',
    checkedResult: 'Found {n} issue(s) to fix',
    checkError: 'An error occurred while checking spelling: {msg}',
    ltServiceError: 'The spell-check service returned an error ({status})',
    langNotSupported: 'The "{lang}" language doesn\'t have an accurate enough public spell-check service yet — advanced checking for it is coming in a future phase.',
    noTextToCheck: 'There\'s no text in the document to check yet',
    fixAllDone: 'Fixed {n} issue(s)',
    fixAllDoneSkipped: 'Fixed {n} issue(s) (skipped {skipped} because the document changed in the meantime — try checking again)',
    singleFixDone: 'Changed "{old}" to "{new}"',
    fixSkipped: 'Couldn\'t pinpoint this issue\'s exact position (the document may have changed since checking) — try checking again',
    badgeStyle: 'Style/Formality', badgeSpelling: 'Spelling/Grammar',
    newDocConfirm: 'Clear the current document and start a new page? (The autosaved draft will be deleted too.)',
    clearedDoc: 'Document cleared',
    summarizeEmpty: 'There\'s no content to summarize yet',
    summarized: 'Added a basic summary to the end of the document (key sentences picked using statistical rules)',
    summaryHeading: '— Basic Summary —',
    downloadError: 'Download failed: {msg}',
    downloadEmpty: 'There\'s no content to download yet',
    dictateUnsupported: 'This browser doesn\'t support Dictate (try Chrome)',
    dictateListening: 'Listening... go ahead and speak',
    dictateListeningInterim: 'Listening... "{text}"',
    dictateError: 'An error occurred while listening: {msg}',
    dictateNoMic: 'Microphone access was not granted — please allow microphone access in your browser',
    dictateStopped: 'Stopped listening',
    linkNeedUrl: 'Please enter a URL before inserting the link',
    restoredDraft: 'Restored your last autosaved draft'
  }
};

function t(key, vars) {
  var lang = getUILang();
  var str = (I18N[lang] && I18N[lang][key]) || I18N.th[key] || key;
  if (vars) {
    Object.keys(vars).forEach(function (k) { str = str.replace('{' + k + '}', vars[k]); });
  }
  return str;
}
function langLabel(l) { return getUILang() === 'en' ? l.labelEn : l.label; }
function langByCode(code) {
  for (var i = 0; i < LANGUAGES.length; i++) if (LANGUAGES[i].code === code) return LANGUAGES[i];
  return LANGUAGES[0];
}

function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ══════════════════════════════════════════════════════════════════
   สรุปเนื้อหาแบบ extractive (เลือกประโยคสำคัญด้วยคะแนนความถี่คำ) — พอร์ตมาจาก
   ฟังก์ชันเดิมในบันเดิล ทำงานล้วนๆ ด้วยข้อความ ไม่ต้องพึ่ง AI ภายนอก
   ══════════════════════════════════════════════════════════════════ */
var SUMMARY_MAX_CHARS = 280;
function splitSentences(text) {
  return text.replace(/\s+/g, ' ').split(/(?<=[.!?。！？])\s+|\n+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
}
function wordFreq(sentences) {
  var freq = {};
  sentences.forEach(function (s) {
    s.toLowerCase().split(/[^\p{L}\p{N}]+/u).forEach(function (w) {
      if (w.length >= 2) freq[w] = (freq[w] || 0) + 1;
    });
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

/* ══════════════════════════════════════════════════════════════════
   ตรวจคำผิด (LanguageTool, level:picky) — เหมือน doc-check.js
   ══════════════════════════════════════════════════════════════════ */
async function checkSpelling(text, ltCode) {
  if (!text.trim()) return [];
  var params = new URLSearchParams({ text: text, language: ltCode, level: 'picky' });
  var res = await fetch(LT_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params
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
function issueKind(category) {
  var styleCats = ['STYLE', 'REDUNDANCY', 'WORDINESS', 'REGISTER', 'COLLOQUIALISMS', 'BRITISH_ENGLISH', 'AMERICAN_ENGLISH_STYLE', 'CONFUSED_WORDS'];
  return styleCats.indexOf(category) !== -1 ? 'style' : 'spelling';
}

/* ══════════════════════════════════════════════════════════════════
   อ่านไฟล์นำเข้า — .docx ใช้ mammoth แปลงเป็น HTML (คงตัวหนา/หัวข้อ/ลิสต์)
   .txt/.pdf/รูปภาพ ได้ข้อความล้วน (ไม่มีรูปแบบให้คง)
   ══════════════════════════════════════════════════════════════════ */
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

/* กันไฟล์ .docx ที่แปลงมาไม่ให้มีแท็ก/แอตทริบิวต์อันตรายก่อนใส่ลง innerHTML */
var SAFE_TAGS = { P: 1, DIV: 1, SPAN: 1, BR: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, S: 1, STRIKE: 1,
  H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, UL: 1, OL: 1, LI: 1, A: 1, IMG: 1,
  TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TD: 1, TH: 1, BLOCKQUOTE: 1, HR: 1, MARK: 1 };
var SAFE_ATTRS = { A: ['href', 'target', 'rel'], IMG: ['src', 'alt', 'width', 'height'] };
function sanitizeHtml(html) {
  var doc = new DOMParser().parseFromString(html, 'text/html');
  (function walk(node) {
    Array.from(node.childNodes).forEach(function (child) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!SAFE_TAGS[child.tagName]) {
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
          return;
        }
        Array.from(child.attributes).forEach(function (attr) {
          var allowed = SAFE_ATTRS[child.tagName] || [];
          if (allowed.indexOf(attr.name) === -1) child.removeAttribute(attr.name);
          else if (/^(href|src)$/.test(attr.name) && /^\s*javascript:/i.test(attr.value)) child.removeAttribute(attr.name);
        });
        walk(child);
      } else if (child.nodeType !== Node.TEXT_NODE) {
        node.removeChild(child);
      }
    });
  })(doc.body);
  return doc.body.innerHTML;
}

/* ══════════════════════════════════════════════════════════════════
   แปลงข้อความล้วนเป็น <p> ต่อบรรทัด (สำหรับไฟล์ .txt/.pdf/OCR ที่ไม่มีรูปแบบ)
   ══════════════════════════════════════════════════════════════════ */
function textToParagraphsHtml(text) {
  return text.split(/\n+/).map(function (line) {
    return line.trim() ? '<p>' + escapeHtml(line) + '</p>' : '';
  }).join('');
}

/* ══════════════════════════════════════════════════════════════════
   ดึงข้อความล้วนจาก editor แบบมี \n คั่นระหว่างบล็อก (ใช้ทั้งตรวจคำผิดและ
   map offset กลับเป็นตำแหน่งใน DOM) — ต้องใช้ตรรกะเดียวกันทั้งสองทาง
   ══════════════════════════════════════════════════════════════════ */
var BLOCK_TAGS = { P: 1, DIV: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, LI: 1, BLOCKQUOTE: 1, TR: 1 };

function extractText(root) {
  var text = '';
  (function walk(node) {
    var child = node.firstChild;
    while (child) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.nodeValue;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName === 'BR') { text += '\n'; }
        else {
          walk(child);
          if (BLOCK_TAGS[child.tagName]) text += '\n';
        }
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
        if (child.tagName === 'BR') { pos += 1; }
        else {
          if (visit(child)) return true;
          if (BLOCK_TAGS[child.tagName]) pos += 1;
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

/* แทนที่ข้อความช่วง [offset,offset+length) ด้วย replacement — ยืนยันว่าตำแหน่งยังตรงกับ
   ตอนตรวจก่อนแก้จริง (matchedText) เพื่อกันแก้ผิดตำแหน่งถ้าเอกสารถูกแก้ไประหว่างทาง */
function applyRangeFix(root, m, replacement) {
  var range = rangeFromOffset(root, m.offset, m.length);
  if (!range || range.toString() !== m.matchedText) return false;
  range.deleteContents();
  range.insertNode(document.createTextNode(replacement));
  return true;
}

/* ══════════════════════════════════════════════════════════════════
   HTML (เนื้อหา editor) → เอกสาร .docx จริง (คงตัวหนา/เอียง/ขีดเส้นใต้/ไฮไลต์/
   หัวข้อ/ลิสต์/รูปภาพ/ตาราง) — พอร์ตมาจากฟังก์ชันเดิมในบันเดิลแล้วเพิ่มตาราง
   ══════════════════════════════════════════════════════════════════ */
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

async function nodeToRuns(el, inherited) {
  var docx = window.docx;
  inherited = inherited || {};
  var runs = [];
  var child = el.firstChild;
  while (child) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) runs.push(new docx.TextRun(Object.assign({ text: child.textContent }, inherited)));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      var tag = child.tagName;
      if (tag === 'IMG') {
        runs.push(await imageRunFromSrc(child.getAttribute('src')));
      } else {
        var next = Object.assign({}, inherited);
        if (tag === 'B' || tag === 'STRONG') next.bold = true;
        if (tag === 'I' || tag === 'EM') next.italics = true;
        if (tag === 'U') next.underline = {};
        if (tag === 'S' || tag === 'STRIKE') next.strike = true;
        if (tag === 'MARK') next.highlight = 'yellow';
        runs = runs.concat(await nodeToRuns(child, next));
      }
    }
    child = child.nextSibling;
  }
  return runs;
}

var HEADING_TAGS = { H1: 'HEADING_1', H2: 'HEADING_2', H3: 'HEADING_3' };

async function elementToParagraph(el) {
  var docx = window.docx;
  var tag = el.tagName;
  if (tag === 'LI') return new docx.Paragraph({ children: await nodeToRuns(el), bullet: { level: 0 } });
  if (HEADING_TAGS[tag]) return new docx.Paragraph({ children: await nodeToRuns(el), heading: docx.HeadingLevel[HEADING_TAGS[tag]] });
  return new docx.Paragraph({ children: await nodeToRuns(el) });
}

async function tableToDocxTable(tableEl) {
  var docx = window.docx;
  var rows = Array.from(tableEl.querySelectorAll('tr'));
  var docxRows = [];
  for (var r = 0; r < rows.length; r++) {
    var cells = Array.from(rows[r].children).filter(function (c) { return c.tagName === 'TD' || c.tagName === 'TH'; });
    var docxCells = [];
    for (var c = 0; c < cells.length; c++) {
      docxCells.push(new docx.TableCell({ children: [new docx.Paragraph({ children: await nodeToRuns(cells[c]) })] }));
    }
    docxRows.push(new docx.TableRow({ children: docxCells }));
  }
  return new docx.Table({ rows: docxRows, width: { size: 100, type: docx.WidthType.PERCENTAGE } });
}

async function htmlToDocxBlob(html) {
  var docx = window.docx;
  var doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
  var blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'UL', 'OL', 'BLOCKQUOTE', 'HR', 'TABLE'];
  var topLevel = Array.from(doc.body.children).filter(function (el) { return blockTags.indexOf(el.tagName) !== -1; });
  var blocks = [];
  if (!topLevel.length) {
    blocks.push(new docx.Paragraph({ children: await nodeToRuns(doc.body) }));
  } else {
    for (var i = 0; i < topLevel.length; i++) {
      var el = topLevel[i];
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        var items = Array.from(el.children);
        for (var j = 0; j < items.length; j++) blocks.push(await elementToParagraph(items[j]));
      } else if (el.tagName === 'TABLE') {
        blocks.push(await tableToDocxTable(el));
      } else if (el.tagName === 'HR') {
        blocks.push(new docx.Paragraph({ text: '' }));
      } else {
        blocks.push(await elementToParagraph(el));
      }
    }
  }
  var docxDoc = new docx.Document({ sections: [{ children: blocks }] });
  return docx.Packer.toBlob(docxDoc);
}

async function downloadEditorAsDocx(html, baseName) {
  var blob = await htmlToDocxBlob(html);
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
   UI wiring (ข้ามส่วนนี้เมื่อรันทดสอบ logic ล้วนๆ แบบ Node)
   ══════════════════════════════════════════════════════════════════ */
if (typeof document !== 'undefined' && document.getElementById('editor')) {
  var $ = function (id) { return document.getElementById(id); };
  var editor = $('editor');
  var state = { lang: 'th', matches: [], busy: false, speaking: false, dictating: false };
  var recognition = null;
  var savedRange = null;
  var autosaveTimer = null;

  var langSelect = $('langSelect'), fileInput = $('fileInput'), imageInput = $('imageInput'),
      newDocBtn = $('newDocBtn'), importBtn = $('importBtn'), downloadBtn = $('downloadBtn'), printBtn = $('printBtn'),
      runBtn = $('runBtn'), speakBtn = $('speakBtn'), dictateBtn = $('dictateBtn'), summarizeBtn = $('summarizeBtn'),
      statusMsg = $('statusMsg'), issueCount = $('issueCount'), issueList = $('issueList'), issueEmpty = $('issueEmpty'),
      issueHint = $('issueHint'), applyFixBtn = $('applyFixBtn'), langToggle = $('langToggle'),
      wordCountEl = $('wordCount'), charCountEl = $('charCount'), autosaveStatusEl = $('autosaveStatus'),
      modalBackdrop = $('modalBackdrop'), linkModal = $('linkModal'), linkUrlInput = $('linkUrlInput'),
      linkOkBtn = $('linkOkBtn'), linkCancelBtn = $('linkCancelBtn'),
      tableModal = $('tableModal'), tableRowsInput = $('tableRowsInput'), tableColsInput = $('tableColsInput'),
      tableOkBtn = $('tableOkBtn'), tableCancelBtn = $('tableCancelBtn'), imageBtn = $('imageBtn'), linkBtn = $('linkBtn'),
      tableBtn = $('tableBtn'), hrBtn = $('hrBtn'),
      textColorInput = $('textColorInput'), textColorSwatch = $('textColorSwatch'),
      hiliteColorInput = $('hiliteColorInput'), hiliteColorSwatch = $('hiliteColorSwatch'),
      clearFormatBtn = $('clearFormatBtn'), undoBtn = $('undoBtn'), redoBtn = $('redoBtn'),
      styleSelect = $('styleSelect'), fontSelect = $('fontSelect'), sizeSelect = $('sizeSelect');

  var SPEAK_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
  var STOP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
  var MIC_ICON = dictateBtn.innerHTML;
  var MIC_OFF_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';

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
    if (langToggle) langToggle.querySelectorAll('span').forEach(function (s) { s.classList.toggle('active', s.getAttribute('data-lt') === lang); });
    if (!state.speaking) speakBtn.title = t('speakBtnTitle');
    if (!state.dictating) dictateBtn.title = t('dictateBtnTitle');
    updateCounts();
  }
  function buildLangOptions() {
    var prev = langSelect.value || state.lang;
    langSelect.innerHTML = '';
    LANGUAGES.forEach(function (l) {
      var opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = langLabel(l) + (l.ltCode ? '' : t('langAiPending'));
      langSelect.appendChild(opt);
    });
    langSelect.value = prev;
  }
  applyStaticI18n();
  buildLangOptions();
  langSelect.value = state.lang;
  if (langToggle) {
    langToggle.addEventListener('click', function () {
      setUILang(getUILang() === 'en' ? 'th' : 'en');
      applyStaticI18n();
      buildLangOptions();
      renderIssues();
    });
  }

  function setStatus(msg, isErr, showSpinner) {
    statusMsg.innerHTML = '';
    statusMsg.classList.toggle('err', !!isErr);
    if (showSpinner) { var s = document.createElement('span'); s.className = 'spinner'; statusMsg.appendChild(s); }
    if (msg) statusMsg.appendChild(document.createTextNode(msg));
  }

  /* ── ตัวนับคำ/ตัวอักษร + autosave ── */
  function updateCounts() {
    var text = editor.textContent || '';
    var words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wordCountEl.firstChild.nodeValue = words + ' ';
    charCountEl.firstChild.nodeValue = text.length + ' ';
  }
  function scheduleAutosave() {
    updateCounts();
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function () {
      try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ html: editor.innerHTML, savedAt: Date.now() })); } catch (e) {}
      var label = autosaveStatusEl.querySelector('[data-i18n]');
      if (label) label.textContent = t('autosaveSaved');
    }, 800);
  }
  (function restoreAutosave() {
    try {
      var raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && saved.html) { editor.innerHTML = saved.html; setStatus(t('restoredDraft')); updateCounts(); }
    } catch (e) {}
  })();

  editor.addEventListener('input', function () {
    if (state.matches.length) { state.matches = []; renderIssues(); }
    scheduleAutosave();
  });

  /* ── issue sidebar ── */
  function renderIssues() {
    issueCount.textContent = state.matches.length;
    issueCount.classList.toggle('zero', state.matches.length === 0);
    applyFixBtn.style.display = state.matches.length ? 'flex' : 'none';
    issueEmpty.style.display = state.matches.length === 0 && issueHint.dataset.shown === '1' ? 'block' : 'none';
    issueHint.style.display = issueHint.dataset.shown === '1' ? 'none' : 'block';
    issueList.innerHTML = '';
    state.matches.forEach(function (m, i) {
      var item = document.createElement('div');
      item.className = 'wd-issue';
      var chipsHtml = (m.replacements || []).map(function (r, ri) {
        return '<button class="chip" data-mi="' + i + '" data-ri="' + ri + '" type="button">' + escapeHtml(r) + '</button>';
      }).join('');
      var kind = issueKind(m.category);
      var badgeHtml = kind === 'style'
        ? '<span class="kind-badge style">' + t('badgeStyle') + '</span>'
        : '<span class="kind-badge spelling">' + t('badgeSpelling') + '</span>';
      item.innerHTML = badgeHtml +
        '<div class="quote">"' + escapeHtml(m.matchedText) + '"</div>' +
        '<div class="msg">' + escapeHtml(m.message) + '</div>' +
        (chipsHtml ? '<div class="chips">' + chipsHtml + '</div>' : '');
      issueList.appendChild(item);
    });
    issueList.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        acceptIssue(Number(chip.dataset.mi), Number(chip.dataset.ri));
      });
    });
  }

  function acceptIssue(matchIndex, replacementIndex) {
    var m = state.matches[matchIndex];
    if (!m || !m.replacements || !m.replacements[replacementIndex]) return;
    var replacement = m.replacements[replacementIndex];
    var ok = applyRangeFix(editor, m, replacement);
    if (!ok) { setStatus(t('fixSkipped'), true); return; }
    var delta = replacement.length - m.length;
    var old = m.matchedText;
    state.matches = state.matches.filter(function (_, i) { return i !== matchIndex; })
      .map(function (mm) { return mm.offset > m.offset ? Object.assign({}, mm, { offset: mm.offset + delta }) : mm; });
    setStatus(t('singleFixDone', { old: old, new: replacement }));
    renderIssues();
    scheduleAutosave();
  }

  applyFixBtn.addEventListener('click', function () {
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

  /* ── ตรวจคำผิด ── */
  runBtn.addEventListener('click', async function () {
    var lang = langByCode(state.lang);
    if (!lang.ltCode) { setStatus(t('langNotSupported', { lang: langLabel(lang) }), true); return; }
    var text = extractText(editor);
    if (!text.trim()) { setStatus(t('noTextToCheck'), true); return; }
    state.busy = true; runBtn.disabled = true;
    setStatus(t('checking'), false, true);
    try {
      var matches = await checkSpelling(text, lang.ltCode);
      matches.forEach(function (m) { m.matchedText = text.slice(m.offset, m.offset + m.length); });
      state.matches = matches;
      issueHint.dataset.shown = '1';
      renderIssues();
      setStatus(t('checkedResult', { n: matches.length }));
    } catch (err) {
      setStatus(t('checkError', { msg: err.message }), true);
    } finally {
      state.busy = false; runBtn.disabled = false;
    }
  });
  langSelect.addEventListener('change', function () { state.lang = langSelect.value; });

  /* ── ไฟล์: ใหม่ / นำเข้า / ดาวน์โหลด / พิมพ์ ── */
  newDocBtn.addEventListener('click', function () {
    if (!confirm(t('newDocConfirm'))) return;
    editor.innerHTML = '';
    state.matches = [];
    issueHint.dataset.shown = '0';
    renderIssues();
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) {}
    updateCounts();
    setStatus(t('clearedDoc'));
  });

  importBtn.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', async function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    setStatus(t('readingFile'), false, true);
    try {
      var result = await readAnyFile(file);
      var html = result.kind === 'html' ? sanitizeHtml(result.content) : textToParagraphsHtml(result.content);
      editor.innerHTML += html;
      setStatus(t('fileImported', { name: file.name }));
      scheduleAutosave();
    } catch (err) {
      setStatus(t('fileReadError', { msg: err.message }), true);
    } finally {
      fileInput.value = '';
    }
  });

  downloadBtn.addEventListener('click', async function () {
    if (!editor.textContent.trim()) { setStatus(t('downloadEmpty'), true); return; }
    try { await downloadEditorAsDocx(editor.innerHTML, 'document'); }
    catch (err) { setStatus(t('downloadError', { msg: err.message }), true); }
  });

  printBtn.addEventListener('click', function () { window.print(); });

  /* ── สรุปเนื้อหา ── */
  summarizeBtn.addEventListener('click', function () {
    var text = extractText(editor).trim();
    if (!text) { setStatus(t('summarizeEmpty'), true); return; }
    var summary = summarizeText(text, 5);
    editor.innerHTML += '<p><strong>' + escapeHtml(t('summaryHeading')) + '</strong></p><p>' + escapeHtml(summary) + '</p>';
    setStatus(t('summarized'));
    scheduleAutosave();
  });

  /* ── อ่านออกเสียง ── */
  speakBtn.addEventListener('click', function () {
    if (state.speaking) {
      window.speechSynthesis.cancel();
      state.speaking = false; speakBtn.innerHTML = SPEAK_ICON; speakBtn.title = t('speakBtnTitle');
      return;
    }
    var text = editor.textContent.trim();
    if (!text) return;
    window.speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(text);
    utter.lang = langByCode(state.lang).speechLang;
    utter.onend = function () { state.speaking = false; speakBtn.innerHTML = SPEAK_ICON; speakBtn.title = t('speakBtnTitle'); };
    utter.onerror = function () { state.speaking = false; speakBtn.innerHTML = SPEAK_ICON; speakBtn.title = t('speakBtnTitle'); };
    state.speaking = true; speakBtn.innerHTML = STOP_ICON; speakBtn.title = t('stopSpeakTitle');
    window.speechSynthesis.speak(utter);
  });

  /* ── พูดแล้วขึ้นข้อความ (Dictate) — รองรับทุกภาษาในรายการ (ไม่ได้จำกัดเฉพาะภาษาที่ LanguageTool รองรับ) ── */
  function stopDictate(statusText) {
    state.dictating = false;
    dictateBtn.classList.remove('active');
    dictateBtn.innerHTML = MIC_ICON;
    dictateBtn.title = t('dictateBtnTitle');
    if (recognition) { try { recognition.stop(); } catch (e) {} }
    setStatus(statusText || '');
  }
  dictateBtn.addEventListener('click', function () {
    if (state.dictating) { stopDictate(t('dictateStopped')); return; }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setStatus(t('dictateUnsupported'), true); return; }
    editor.focus();
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
        editor.focus();
        document.execCommand('insertText', false, finalChunk);
        if (state.matches.length) { state.matches = []; renderIssues(); }
        scheduleAutosave();
      }
      setStatus(interimChunk ? t('dictateListeningInterim', { text: interimChunk }) : t('dictateListening'));
    };
    recognition.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { setStatus(t('dictateNoMic'), true); stopDictate(); }
      else if (e.error === 'no-speech' || e.error === 'aborted') { /* เงียบไปชั่วคราว ไม่ถือเป็น error */ }
      else { setStatus(t('dictateError', { msg: e.error }), true); }
    };
    recognition.onend = function () {
      if (state.dictating) { try { recognition.start(); } catch (e) {} }
    };
    state.dictating = true;
    dictateBtn.classList.add('active');
    dictateBtn.innerHTML = MIC_OFF_ICON;
    dictateBtn.title = t('stopDictateTitle');
    setStatus(t('dictateListening'));
    recognition.start();
  });

  /* ── ริบบิ้นจัดรูปแบบ ── */
  function focusEditor() { editor.focus(); }

  document.querySelectorAll('.rb-btn[data-cmd]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      focusEditor();
      document.execCommand(btn.dataset.cmd, false, null);
      updateToolbarState();
      scheduleAutosave();
    });
  });
  document.querySelectorAll('.wd-select[data-cmd]').forEach(function (sel) {
    sel.addEventListener('change', function () {
      focusEditor();
      var cmd = sel.dataset.cmd, val = sel.value;
      if (cmd === 'formatBlock') val = '<' + val.toLowerCase() + '>';
      document.execCommand(cmd, false, val);
      scheduleAutosave();
    });
  });
  clearFormatBtn.addEventListener('click', function () {
    focusEditor();
    document.execCommand('removeFormat', false, null);
    document.execCommand('formatBlock', false, '<p>');
    styleSelect.value = 'P';
    scheduleAutosave();
  });
  undoBtn.addEventListener('click', function () { focusEditor(); document.execCommand('undo', false, null); scheduleAutosave(); });
  redoBtn.addEventListener('click', function () { focusEditor(); document.execCommand('redo', false, null); scheduleAutosave(); });

  textColorInput.addEventListener('input', function () {
    focusEditor();
    document.execCommand('foreColor', false, textColorInput.value);
    textColorSwatch.style.background = textColorInput.value;
    scheduleAutosave();
  });
  hiliteColorInput.addEventListener('input', function () {
    focusEditor();
    if (!document.execCommand('hiliteColor', false, hiliteColorInput.value)) {
      document.execCommand('backColor', false, hiliteColorInput.value);
    }
    hiliteColorSwatch.style.background = hiliteColorInput.value;
    scheduleAutosave();
  });

  /* ── active state ของปุ่มจัดรูปแบบตามตำแหน่งเคอร์เซอร์ ── */
  var STATE_CMDS = { boldBtn: 'bold', italicBtn: 'italic', underlineBtn: 'underline', strikeBtn: 'strikeThrough',
    ulBtn: 'insertUnorderedList', olBtn: 'insertOrderedList',
    alignLeftBtn: 'justifyLeft', alignCenterBtn: 'justifyCenter', alignRightBtn: 'justifyRight', alignJustifyBtn: 'justifyFull' };
  function updateToolbarState() {
    var sel = window.getSelection();
    if (!sel.anchorNode || !editor.contains(sel.anchorNode)) return;
    Object.keys(STATE_CMDS).forEach(function (id) {
      var btn = $(id);
      if (btn) { try { btn.classList.toggle('active', document.queryCommandState(STATE_CMDS[id])); } catch (e) {} }
    });
  }
  document.addEventListener('selectionchange', updateToolbarState);
  editor.addEventListener('keyup', updateToolbarState);
  editor.addEventListener('mouseup', updateToolbarState);

  /* ── modal ทั่วไป ── */
  function openModal(modalEl) { modalBackdrop.classList.add('open'); modalEl.classList.add('open'); }
  function closeModals() {
    modalBackdrop.classList.remove('open');
    linkModal.classList.remove('open');
    tableModal.classList.remove('open');
  }
  modalBackdrop.addEventListener('click', function (e) { if (e.target === modalBackdrop) closeModals(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModals(); });

  function saveSelectionRange() {
    var sel = window.getSelection();
    if (sel.rangeCount && editor.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
    else savedRange = null;
  }
  function restoreSelectionRange() {
    focusEditor();
    if (savedRange) { var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
  }

  /* ── แทรกลิงก์ ── */
  linkBtn.addEventListener('click', function () {
    saveSelectionRange();
    linkUrlInput.value = '';
    openModal(linkModal);
    linkUrlInput.focus();
  });
  linkCancelBtn.addEventListener('click', closeModals);
  linkOkBtn.addEventListener('click', function () {
    var url = linkUrlInput.value.trim();
    if (!url) { linkUrlInput.focus(); return; }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
    restoreSelectionRange();
    var sel = window.getSelection();
    if (sel.rangeCount && !sel.getRangeAt(0).collapsed) {
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand('insertHTML', false, '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(url) + '</a>');
    }
    editor.querySelectorAll('a').forEach(function (a) { if (!a.target) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } });
    closeModals();
    scheduleAutosave();
  });

  /* ── แทรกรูปภาพ ── */
  imageBtn.addEventListener('click', function () { saveSelectionRange(); imageInput.click(); });
  imageInput.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      restoreSelectionRange();
      document.execCommand('insertImage', false, reader.result);
      scheduleAutosave();
    };
    reader.readAsDataURL(file);
    imageInput.value = '';
  });

  /* ── แทรกตาราง ── */
  tableBtn.addEventListener('click', function () { saveSelectionRange(); openModal(tableModal); });
  tableCancelBtn.addEventListener('click', closeModals);
  tableOkBtn.addEventListener('click', function () {
    var rows = Math.max(1, Math.min(20, Number(tableRowsInput.value) || 1));
    var cols = Math.max(1, Math.min(10, Number(tableColsInput.value) || 1));
    var html = '<table><tbody>';
    for (var r = 0; r < rows; r++) {
      html += '<tr>';
      for (var c = 0; c < cols; c++) html += '<td><br></td>';
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    restoreSelectionRange();
    document.execCommand('insertHTML', false, html);
    closeModals();
    scheduleAutosave();
  });

  hrBtn.addEventListener('click', function () { focusEditor(); document.execCommand('insertHorizontalRule', false, null); scheduleAutosave(); });

  renderIssues();
  updateCounts();
}

/* export ให้ทดสอบ logic ล้วนๆ ได้จาก Node โดยไม่ต้องมี browser */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { summarizeText: summarizeText, splitSentences: splitSentences, LANGUAGES: LANGUAGES, textToParagraphsHtml: textToParagraphsHtml };
}
})();
