/* ══════════════════════════════════════════════════════════════════
   ดึงข้อความออกจากเอกสาร — เดิมชื่อ "แยกหน้า PDF + ดึงข้อความ" ทำงานผ่าน Pyodide (Python ในเบราว์เซอร์)
   รองรับแค่ .pdf เท่านั้น — เขียนใหม่เป็นหน้าโค้ดเดี่ยว (JS ล้วน ไม่ต้องพึ่ง Pyodide ที่โหลดช้า/หนักกว่า
   มาก) ใช้ file-reader.js (ตัวเดียวกับหน้า "แปลงเสียง ↔ ข้อความ") เป็นแกนดึงข้อความ จึงรองรับทุกชนิดไฟล์
   ที่ file-reader.js รองรับไปด้วยในตัว: .txt/.docx/.xlsx/.xls/.csv/.pptx/.pdf/รูปภาพ (พร้อม OCR
   สำหรับ PDF สแกนภาพและไฟล์รูปภาพ) — ส่วน "แยกหน้า PDF" (ฟีเจอร์เดิม) ใช้ pdf-lib สร้างไฟล์ PDF
   รายหน้าใหม่แทน pypdf เดิม ผลลัพธ์หน้าตาเดียวกัน (page_001.pdf, page_002.pdf, ... zip เดียวกัน) */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var T = OME_I18N.scope('ex', {
    th: {
      title: 'ดึงข้อความออกจากเอกสาร | Tanot', crumb: 'งานที่รับผิดชอบ', h1: 'ดึงข้อความออกจากเอกสาร', attach: 'แนบไฟล์',
      dropMain: 'แตะเพื่อเลือกไฟล์ หรือลากไฟล์มาวางตรงนี้', ocr: 'ใช้ OCR อ่านหน้า/รูปที่เป็นภาพสแกน', accurate: 'โหมดแม่นยำ (ช้ากว่า)',
      engLabel: 'อ่านภาพสแกนด้วย', engFree: 'ฟรี (OCR)', engVision: 'Claude Vision',
      readingClaude: 'Claude Vision กำลังอ่าน…', readingClaudePart: 'Claude Vision กำลังอ่านส่วนที่ {i}/{n}…', cancelled: 'ยกเลิกการอ่านด้วย Claude Vision',
      doneTruncated: 'ดึงข้อความจาก {name} แล้ว ({n} ตัวอักษร) — ข้อความยาวเกินที่ Claude ตอบได้ในครั้งเดียว ส่วนท้ายอาจขาด',
      result: 'ข้อความที่ดึงได้', resultPh: 'ข้อความที่ดึงได้จะขึ้นตรงนี้', copy: 'คัดลอกข้อความ', dlTxt: 'ดาวน์โหลด .txt', split: 'แยกหน้า PDF (.zip)',
      chars: '{n} ตัวอักษร', dropSub: '{kb} KB — แตะเพื่อเลือกไฟล์อื่น',
      reading: 'กำลังอ่านไฟล์…', readingOcr: 'กำลังอ่านด้วย OCR หน้า/รูป {page}/{total} (อาจใช้เวลาสักครู่ต่อหน้า)…', readingPdf: 'กำลังอ่าน PDF หน้า {page}/{total}…',
      noReader: 'โหลดตัวอ่านไฟล์ไม่สำเร็จ (อาจเป็นเพราะเน็ตช้า/ถูกบล็อก) ลองรีเฟรชหน้าใหม่', readingFile: 'กำลังอ่านไฟล์ {name}…',
      empty: 'ไม่พบข้อความในไฟล์นี้', done: 'ดึงข้อความจาก {name} แล้ว ({n} ตัวอักษร)', readFail: 'อ่านไฟล์ไม่สำเร็จ: {msg}',
      splitNoLib: 'โหลดไลบรารีแยกหน้า PDF ไม่สำเร็จ — เช็คอินเทอร์เน็ตแล้วลองรีเฟรชหน้าใหม่', splitting: 'กำลังแยกหน้า PDF…', splitNoPages: 'ไฟล์ PDF ไม่มีหน้าเลย',
      splitDone: 'แยกเป็น {n} ไฟล์ ดาวน์โหลด pages_{base}.zip แล้ว', splitFail: 'แยกหน้า PDF ไม่สำเร็จ: {msg}',
      copied: 'คัดลอกข้อความแล้ว', downloaded: 'ดาวน์โหลด text_{base}.txt แล้ว'
    },
    en: {
      title: 'Extract text from documents | Tanot', crumb: 'Work', h1: 'Extract text from documents', attach: 'Attach a file',
      dropMain: 'Tap to choose a file, or drag one here', ocr: 'Use OCR on scanned pages/images', accurate: 'Accurate mode (slower)',
      engLabel: 'Read scans with', engFree: 'Free (OCR)', engVision: 'Claude Vision',
      readingClaude: 'Claude Vision is reading…', readingClaudePart: 'Claude Vision is reading part {i}/{n}…', cancelled: 'Reading with Claude Vision was cancelled',
      doneTruncated: 'Extracted text from {name} ({n} characters) — the text is longer than Claude can return in one reply; the end may be missing',
      result: 'Extracted text', resultPh: 'The extracted text will appear here', copy: 'Copy text', dlTxt: 'Download .txt', split: 'Split PDF pages (.zip)',
      chars: '{n} characters', dropSub: '{kb} KB — tap to choose another file',
      reading: 'Reading file…', readingOcr: 'Reading with OCR, page/image {page}/{total} (may take a moment per page)…', readingPdf: 'Reading PDF page {page}/{total}…',
      noReader: 'Could not load the file reader (slow or blocked network?). Try reloading the page', readingFile: 'Reading {name}…',
      empty: 'No text found in this file', done: 'Extracted text from {name} ({n} characters)', readFail: 'Could not read the file: {msg}',
      splitNoLib: 'Could not load the PDF split library — check your connection and reload the page', splitting: 'Splitting PDF pages…', splitNoPages: 'This PDF has no pages',
      splitDone: 'Split into {n} files — downloaded pages_{base}.zip', splitFail: 'Could not split the PDF: {msg}',
      copied: 'Text copied', downloaded: 'Downloaded text_{base}.txt'
    }
  });

  var currentFile = null;
  var engine = 'free'; /* 'free' | 'vision' — ไม่จำค่า ทุกครั้งที่เปิดหน้าเริ่มที่ฟรี (Claude ต้องเลือกเอง + กรอกรหัสทุกครั้ง) */
  function visionOn() { return engine === 'vision' && !!window.TanotOcr && TanotOcr.available(); }

  function formatProgress(p) {
    if (!p) return T('reading');
    if (p.stage === 'ocr') return T('readingOcr', { page: p.page, total: p.total });
    if (p.stage === 'pdf') return T('readingPdf', { page: p.page, total: p.total });
    return T('reading');
  }

  function updateCharCount() {
    OME_I18N.live($('charCount'), function () { return T('chars', { n: OME_I18N.number($('resultText').value.length) }); });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* บรรทัดสถานะ: ส่งฟังก์ชันที่คืนข้อความ (วาดซ้ำเองเมื่อสลับภาษา) — ข้อความผิดพลาดจากไลบรารีคงไว้ตามต้นฉบับ */
  function setStatus(el, fn, cls) {
    el.className = 'status' + (cls ? ' ' + cls : '');
    OME_I18N.live(el, fn || null);
    if (!fn) el.textContent = '';
  }
  function readStatus(fn, cls) { setStatus($('readStatus'), fn, cls); }
  function actionStatus(fn, cls) { setStatus($('actionStatus'), fn, cls); }
  function errMsg(err) {
    if (err && err.code && window.TanotOcr) return TanotOcr.errorText(err);
    return window.TanotFileReader && TanotFileReader.errorText ? TanotFileReader.errorText(err) : (err && err.message ? err.message : String(err));
  }
  function claudeProgress(p) {
    if (p && p.stage === 'claude') readStatus(function () { return p.parts > 1 ? T('readingClaudePart', { i: p.part, n: p.parts }) : T('readingClaude'); }, '');
  }

  /* อ่านไฟล์ → Promise<{ text, truncated }> — Claude Vision เฉพาะเมื่อผู้ใช้เลือกเอง: รูป = ส่งรูป · PDF = ส่งทั้งไฟล์เมื่อมีหน้าที่ไม่มีเลเยอร์ข้อความ (ถ้ามีข้อความครบทุกหน้าใช้ข้อความจริงฟรีตามเดิม) */
  function readOne(file) {
    var name = file.name.toLowerCase(), opts = {
      ocr: $('ocrChk').checked, accurate: $('accChk').checked && !visionOn(),
      onProgress: function (p) { readStatus(function () { return formatProgress(p); }, ''); }
    };
    function plain() { return window.TanotFileReader.readAnyFile(file, opts).then(function (text) { return { text: text }; }); }
    if (visionOn() && /\.(png|jpe?g|webp|bmp)$/.test(name)) {
      readStatus(function () { return T('readingClaude'); }, '');
      return TanotOcr.ocrImage(file);
    }
    if (visionOn() && /\.pdf$/.test(name)) {
      return window.TanotFileReader.inspectPdf(file).then(function (info) {
        if (!info.scanned.length) return plain();
        readStatus(function () { return T('readingClaude'); }, '');
        return TanotOcr.ocrPdf(file, { numPages: info.numPages, onProgress: claudeProgress });
      });
    }
    return plain();
  }

  function handleFile(file) {
    if (!file) return;
    currentFile = file;
    $('dropMain').removeAttribute('data-i18n');
    $('dropMain').textContent = file.name;
    OME_I18N.live($('dropSub'), function () { return T('dropSub', { kb: (file.size / 1024).toFixed(0) }); });
    $('resultCard').style.display = 'none';
    actionStatus(null);

    if (!window.TanotFileReader) {
      readStatus(function () { return T('noReader'); }, 'err');
      return;
    }
    readStatus(function () { return T('readingFile', { name: file.name }); }, '');
    readOne(file).then(function (res) {
      var text = String((res && res.text) || '').trim();
      if (!text) {
        readStatus(function () { return T('empty'); }, 'err');
        return;
      }
      $('resultText').value = text;
      updateCharCount();
      $('resultCard').style.display = '';
      $('splitPdfBtn').style.display = file.name.toLowerCase().endsWith('.pdf') ? '' : 'none';
      readStatus(function () { return T(res.truncated ? 'doneTruncated' : 'done', { name: file.name, n: text.length }); }, res.truncated ? '' : 'ok');
    }).catch(function (err) {
      if (window.TanotOcr && TanotOcr.isCancel(err)) readStatus(function () { return T('cancelled'); }, '');
      else readStatus(function () { return T('readFail', { msg: errMsg(err) }); }, 'err');
    });
  }

  /* ── แยกหน้า PDF เป็นไฟล์รายหน้า (.zip) — ใช้ pdf-lib สร้างไฟล์ PDF ใหม่ทีละหน้า (ฟีเจอร์เดิมจากตอน
     ยังเป็นเครื่องมือ Pyodide+pypdf ย้ายมาทำฝั่ง JS ล้วนแทน ผลลัพธ์หน้าตาเดียวกัน: page_001.pdf, ... ) */
  function splitPdfPages() {
    if (!currentFile) return;
    if (!window.PDFLib || !window.JSZip) {
      actionStatus(function () { return T('splitNoLib'); }, 'err');
      return;
    }
    $('splitPdfBtn').disabled = true;
    actionStatus(function () { return T('splitting'); }, '');
    currentFile.arrayBuffer().then(function (bytes) {
      return window.PDFLib.PDFDocument.load(bytes);
    }).then(function (srcDoc) {
      var n = srcDoc.getPageCount();
      if (!n) throw new Error(T('splitNoPages'));
      var zip = new window.JSZip();
      var chain = Promise.resolve();
      var base = currentFile.name.replace(/\.pdf$/i, '');
      for (var i = 0; i < n; i++) {
        (function (idx) {
          chain = chain.then(function () {
            return window.PDFLib.PDFDocument.create().then(function (newDoc) {
              return newDoc.copyPages(srcDoc, [idx]).then(function (copied) {
                newDoc.addPage(copied[0]);
                return newDoc.save();
              });
            });
          }).then(function (pdfBytes) {
            var pageNum = String(idx + 1).padStart(3, '0');
            zip.file('page_' + pageNum + '.pdf', pdfBytes);
          });
        })(i);
      }
      return chain.then(function () { return zip.generateAsync({ type: 'blob' }); }).then(function (blob) {
        downloadBlob(blob, 'pages_' + base + '.zip');
        actionStatus(function () { return T('splitDone', { n: n, base: base }); }, 'ok');
      });
    }).catch(function (err) {
      actionStatus(function () { return T('splitFail', { msg: errMsg(err) }); }, 'err');
    }).finally(function () {
      $('splitPdfBtn').disabled = false;
    });
  }

  function init() {
    var drop = $('drop'), fileInput = $('fileInput');
    /* ตั้งใจใช้ <div> ไม่ใช่ <label for="fileInput"> — เจอบั๊กเรนเดอร์จริงที่ทำให้มีแท่งสีจางๆ
       โผล่ทับขอบซ้ายของกล่องเวลาใช้ <label> ที่มีพื้นหลัง/เส้นขอบ/border-radius แบบนี้ (บั๊กเฉพาะ
       ของเบราว์เซอร์บางตัวกับ label ที่ผูกกับ input ไฟล์) จึงต้องดักจับ click/keydown เปิด file
       picker เอง แทนการพึ่งพฤติกรรม label→input อัตโนมัติ */
    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) { fileInput.value = ''; handleFile(e.dataTransfer.files[0]); }
    });
    fileInput.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = ''; // เคลียร์ไว้ กันเลือกไฟล์เดิมซ้ำแล้ว change ไม่ยิง
      if (f) handleFile(f);
    });

    $('copyBtn').addEventListener('click', function () {
      var text = $('resultText').value;
      if (!text) return;
      navigator.clipboard.writeText(text).then(function () {
        actionStatus(function () { return T('copied'); }, 'ok');
      }).catch(function () {
        $('resultText').select();
        document.execCommand('copy');
        actionStatus(function () { return T('copied'); }, 'ok');
      });
    });
    $('downloadTxtBtn').addEventListener('click', function () {
      var text = $('resultText').value;
      if (!text || !currentFile) return;
      var base = currentFile.name.replace(/\.[^.]+$/, '');
      downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'text_' + base + '.txt');
      actionStatus(function () { return T('downloaded', { base: base }); }, 'ok');
    });
    $('splitPdfBtn').addEventListener('click', splitPdfPages);

    /* ตัวเลือก Claude Vision — แสดงเฉพาะ *.pages.dev (ที่มี /api/ocr) */
    if (window.TanotOcr && TanotOcr.available()) {
      $('engRow').style.display = '';
      $('engToggle').addEventListener('click', function (e) {
        var span = e.target.closest('[data-oe]');
        if (!span) return;
        engine = span.getAttribute('data-oe') === 'vision' ? 'vision' : 'free';
        $('engToggle').querySelectorAll('[data-oe]').forEach(function (x) { x.classList.toggle('active', x === span); });
        $('ocrChk').disabled = engine === 'vision';
        $('accChk').disabled = engine === 'vision';
      });
    }
    updateCharCount();
    window.OME_PAGE_LIVE_LANG = true; /* ข้อความในหน้าแปลสดผ่าน data-i18n + OME_I18N.live (ตัวตรวจ "สลับภาษาสด" ดูธงนี้) */
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
