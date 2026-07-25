/* ══════════════════════════════════════════════════════════════════
   Tanot — doc-check.js
   ตรวจสอบเอกสาร: แนบไฟล์ (.txt/.docx/.pdf/รูปภาพ) → ตรวจคำผิดด้วย
   LanguageTool API สาธารณะ → แก้ตามคำแนะนำ → อ่านออกเสียง → ดาวน์โหลด .docx
   ประมวลผลไฟล์ทั้งหมดในเบราว์เซอร์ ไม่มีอะไรถูกอัปโหลดขึ้นเซิร์ฟเวอร์ของเรา
   ══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var LANGUAGES = [
  { code: 'th', label: 'ไทย', ltCode: null, speechLang: 'th-TH' },
  { code: 'en', label: 'อังกฤษ', ltCode: 'en-US', speechLang: 'en-US' },
  { code: 'ja', label: 'ญี่ปุ่น', ltCode: null, speechLang: 'ja-JP' },
  { code: 'zh', label: 'จีน', ltCode: null, speechLang: 'zh-CN' },
  { code: 'ko', label: 'เกาหลี', ltCode: null, speechLang: 'ko-KR' },
  { code: 'de', label: 'เยอรมัน', ltCode: 'de-DE', speechLang: 'de-DE' },
  { code: 'hi', label: 'อินเดีย (ฮินดี)', ltCode: null, speechLang: 'hi-IN' },
  { code: 'fr', label: 'ฝรั่งเศส', ltCode: 'fr', speechLang: 'fr-FR' },
  { code: 'it', label: 'อิตาลี', ltCode: 'it', speechLang: 'it-IT' },
  { code: 'my', label: 'พม่า', ltCode: null, speechLang: 'my-MM' },
  { code: 'km', label: 'กัมพูชา', ltCode: null, speechLang: 'km-KH' },
  { code: 'lo', label: 'ลาว', ltCode: null, speechLang: 'lo-LA' },
  { code: 'vi', label: 'เวียดนาม', ltCode: null, speechLang: 'vi-VN' },
  { code: 'ms', label: 'มาเลเซีย', ltCode: null, speechLang: 'ms-MY' },
  { code: 'ar', label: 'อาหรับ', ltCode: 'ar', speechLang: 'ar-SA' }
];
var PAGE_CHAR_LIMIT = 2500;
var LT_ENDPOINT = 'https://api.languagetool.org/v2/check';

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
  if (!res.ok) throw new Error('บริการตรวจคำผิดตอบกลับผิดพลาด (' + res.status + ')');
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
    if (!text) pages.push('(ไม่พบข้อความในหน้านี้ — อาจเป็นภาพสแกน)');
    else if (isGarbledText(text)) pages.push('(ข้อความในหน้านี้อ่านไม่ออก — ไฟล์นี้อาจใช้ font แบบพิเศษที่ไม่ใช่ Unicode มาตรฐาน)');
    else pages.push(text);
  }
  return pages.length ? pages : [''];
}

async function readImageFile(file) {
  var result = await window.Tesseract.recognize(file, 'eng+tha');
  return splitIntoPages(result.data.text || '(ไม่พบข้อความในภาพ)');
}

async function readAnyFile(file) {
  var name = file.name.toLowerCase();
  if (name.endsWith('.txt')) return { pages: await readTxtFile(file) };
  if (name.endsWith('.docx')) return { pages: await readDocxFile(file) };
  if (name.endsWith('.pdf')) return { pages: await readPdfFile(file) };
  if (/\.(png|jpe?g|webp|bmp)$/.test(name)) return { pages: await readImageFile(file) };
  throw new Error('ไม่รองรับไฟล์ประเภทนี้ (รองรับ .txt .docx .pdf .png .jpg)');
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
if (typeof document !== 'undefined' && document.getElementById('fileInput')) {
  var state = {
    filename: '', pages: [], correctedPages: [], pageIndex: 0, mode: 'type',
    lang: 'th', matchesByPage: {}, activeMatch: null, busy: false, speaking: false
  };

  var $ = function (id) { return document.getElementById(id); };
  var langSelect = $('langSelect'), dropZone = $('dropZone'), fileInput = $('fileInput'),
      toolbar = $('toolbar'), fileChipName = $('fileChipName'), replaceFileBtn = $('replaceFileBtn'),
      runBtn = $('runBtn'), applyFixBtn = $('applyFixBtn'), speakBtn = $('speakBtn'),
      downloadBtn = $('downloadBtn'), statusMsg = $('statusMsg'),
      workspace = $('workspace'), prevBtn = $('prevBtn'), nextBtn = $('nextBtn'), pageIndicator = $('pageIndicator'),
      docText = $('docText'), issueCount = $('issueCount'), issueList = $('issueList'), issueEmpty = $('issueEmpty'),
      emptyState = $('emptyState'), modeTabs = $('modeTabs'), typeBox = $('typeBox'),
      typeTextarea = $('typeTextarea'), useTypedTextBtn = $('useTypedTextBtn');

  var SPEAK_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
  var STOP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
  speakBtn.innerHTML = SPEAK_ICON;

  LANGUAGES.forEach(function (l) {
    var opt = document.createElement('option');
    opt.value = l.code;
    opt.textContent = l.label + (l.ltCode ? '' : ' (รอ AI ขั้นสูง)');
    langSelect.appendChild(opt);
  });
  langSelect.value = state.lang;

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
    modeTabs.style.display = hasFile ? 'none' : 'flex';
    dropZone.style.display = (!hasFile && state.mode === 'file') ? 'block' : 'none';
    typeBox.style.display = (!hasFile && state.mode === 'type') ? 'block' : 'none';
    toolbar.style.display = hasFile ? 'flex' : 'none';
    workspace.style.display = hasFile ? 'grid' : 'none';
    runBtn.disabled = state.busy || !state.pages.length;
    speakBtn.disabled = state.busy || !state.pages.length;
    downloadBtn.disabled = state.busy || !state.pages.length;
    prevBtn.disabled = state.pageIndex === 0;
    nextBtn.disabled = state.pageIndex >= state.pages.length - 1;

    if (!hasFile) return;
    fileChipName.textContent = state.filename;
    pageIndicator.textContent = 'หน้า ' + (state.pageIndex + 1) + ' / ' + state.pages.length;
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
        ? '<span class="kind-badge style">สไตล์/ความเป็นทางการ</span>'
        : '<span class="kind-badge spelling">คำผิด/ไวยากรณ์</span>';
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
    setStatus('แก้ "' + text.slice(m.offset, m.offset + m.length) + '" เป็น "' + replacement + '" แล้ว');
    render();
  }

  /* สลับแท็บ "พิมพ์ข้อความเอง" / "แนบไฟล์" (แสดงเฉพาะตอนยังไม่มีเอกสารโหลดอยู่) */
  modeTabs.querySelectorAll('.dc-mode-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      state.mode = tab.dataset.mode;
      modeTabs.querySelectorAll('.dc-mode-tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
      render();
    });
  });

  function loadPages(pages, label) {
    state.filename = label;
    state.pages = pages;
    state.correctedPages = pages.slice();
    state.pageIndex = 0;
    state.matchesByPage = {};
    state.activeMatch = null;
  }

  dropZone.addEventListener('click', function () { fileInput.click(); });
  dropZone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  replaceFileBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    state.pages = []; state.matchesByPage = {}; state.activeMatch = null;
    setStatus('');
    render();
  });
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

  async function handleFile(file) {
    state.busy = true; render();
    setStatus('กำลังอ่านไฟล์...', false, true);
    try {
      var result = await readAnyFile(file);
      loadPages(result.pages, file.name);
      setStatus('อ่านไฟล์สำเร็จ — พบ ' + result.pages.length + ' หน้า');
    } catch (err) {
      setStatus('เกิดข้อผิดพลาด: ' + err.message, true);
    } finally {
      state.busy = false; render();
    }
  }

  useTypedTextBtn.addEventListener('click', function () {
    var text = typeTextarea.value;
    if (!text.trim()) { typeTextarea.focus(); return; }
    var pages = splitIntoPages(text);
    loadPages(pages, 'ข้อความที่พิมพ์');
    setStatus('ใช้ข้อความที่พิมพ์แล้ว — พบ ' + pages.length + ' หน้า');
    render();
  });

  runBtn.addEventListener('click', async function () {
    var lang = langByCode(state.lang);
    if (!lang.ltCode) {
      setStatus('ภาษา "' + lang.label + '" ยังไม่มีบริการตรวจคำผิดสาธารณะที่แม่นยำพอ — ระบบจะเปิดให้ใช้การตรวจขั้นสูงในเฟสถัดไป', true);
      return;
    }
    if (!currentText().trim()) { setStatus('ยังไม่มีข้อความในหน้านี้ให้ตรวจ — กรุณาแนบไฟล์ก่อน', true); return; }
    state.busy = true; render();
    setStatus('กำลังตรวจคำผิด...', false, true);
    try {
      var matches = await checkSpelling(currentText(), lang.ltCode);
      state.matchesByPage[state.pageIndex] = matches;
      state.activeMatch = null;
      setStatus('ตรวจพบ ' + matches.length + ' จุดที่ควรแก้ไขในหน้านี้');
    } catch (err) {
      setStatus('เกิดข้อผิดพลาดระหว่างตรวจคำผิด: ' + err.message, true);
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
    setStatus('แก้ไขคำผิดในหน้านี้ตามคำแนะนำแรกของแต่ละจุดแล้ว');
    render();
  });

  speakBtn.addEventListener('click', function () {
    if (state.speaking) {
      window.speechSynthesis.cancel();
      state.speaking = false;
      speakBtn.innerHTML = SPEAK_ICON;
      speakBtn.title = 'อ่านออกเสียงหน้านี้';
      return;
    }
    if (!currentText().trim()) return;
    window.speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(currentText());
    utter.lang = langByCode(state.lang).speechLang;
    utter.onend = function () { state.speaking = false; speakBtn.innerHTML = SPEAK_ICON; speakBtn.title = 'อ่านออกเสียงหน้านี้'; };
    utter.onerror = function () { state.speaking = false; speakBtn.innerHTML = SPEAK_ICON; speakBtn.title = 'อ่านออกเสียงหน้านี้'; };
    state.speaking = true;
    speakBtn.innerHTML = STOP_ICON;
    speakBtn.title = 'หยุดอ่าน';
    window.speechSynthesis.speak(utter);
  });

  downloadBtn.addEventListener('click', async function () {
    try {
      await downloadAsDocx(state.correctedPages, (state.filename || 'corrected').replace(/\.[^.]+$/, '') || 'corrected');
    } catch (err) {
      setStatus('ดาวน์โหลดไม่สำเร็จ: ' + err.message, true);
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
