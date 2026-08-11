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

  var currentFile = null;

  function formatProgress(p) {
    if (!p) return '⏳ กำลังอ่านไฟล์…';
    if (p.stage === 'ocr') return '⏳ กำลังอ่านด้วย OCR หน้า/รูป ' + p.page + '/' + p.total + ' (อาจใช้เวลาสักครู่ต่อหน้า)…';
    if (p.stage === 'pdf') return '⏳ กำลังอ่าน PDF หน้า ' + p.page + '/' + p.total + '…';
    return '⏳ กำลังอ่านไฟล์…';
  }

  function updateCharCount() {
    $('charCount').textContent = $('resultText').value.length + ' ตัวอักษร';
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function readStatus(text, cls) {
    var el = $('readStatus');
    el.className = 'status' + (cls ? ' ' + cls : '');
    el.textContent = text || '';
  }
  function actionStatus(text, cls) {
    var el = $('actionStatus');
    el.className = 'status' + (cls ? ' ' + cls : '');
    el.textContent = text || '';
  }

  function handleFile(file) {
    if (!file) return;
    currentFile = file;
    $('dropMain').textContent = '📄 ' + file.name;
    $('dropSub').textContent = (file.size / 1024).toFixed(0) + ' KB — แตะเพื่อเลือกไฟล์อื่น';
    $('resultCard').style.display = 'none';
    actionStatus('', '');

    if (!window.TanotFileReader) {
      readStatus('❌ โหลดตัวอ่านไฟล์ไม่สำเร็จ (อาจเป็นเพราะเน็ตช้า/ถูกบล็อก) ลองรีเฟรชหน้าใหม่', 'err');
      return;
    }
    readStatus('⏳ กำลังอ่านไฟล์ ' + file.name + '…', '');
    window.TanotFileReader.readAnyFile(file, {
      ocr: $('ocrChk').checked,
      onProgress: function (p) { readStatus(formatProgress(p), ''); }
    }).then(function (text) {
      text = (text || '').trim();
      if (!text) {
        readStatus('❌ ไม่พบข้อความในไฟล์นี้', 'err');
        return;
      }
      $('resultText').value = text;
      updateCharCount();
      $('resultCard').style.display = '';
      $('splitPdfBtn').style.display = file.name.toLowerCase().endsWith('.pdf') ? '' : 'none';
      readStatus('✅ ดึงข้อความจาก ' + file.name + ' แล้ว (' + text.length + ' ตัวอักษร) — ตรวจทานก่อนนำไปใช้เสมอ', 'ok');
    }).catch(function (err) {
      readStatus('❌ อ่านไฟล์ไม่สำเร็จ: ' + (err && err.message ? err.message : err), 'err');
    });
  }

  /* ── แยกหน้า PDF เป็นไฟล์รายหน้า (.zip) — ใช้ pdf-lib สร้างไฟล์ PDF ใหม่ทีละหน้า (ฟีเจอร์เดิมจากตอน
     ยังเป็นเครื่องมือ Pyodide+pypdf ย้ายมาทำฝั่ง JS ล้วนแทน ผลลัพธ์หน้าตาเดียวกัน: page_001.pdf, ... ) */
  function splitPdfPages() {
    if (!currentFile) return;
    if (!window.PDFLib || !window.JSZip) {
      actionStatus('❌ โหลดไลบรารีแยกหน้า PDF ไม่สำเร็จ — เช็คอินเทอร์เน็ตแล้วลองรีเฟรชหน้าใหม่', 'err');
      return;
    }
    $('splitPdfBtn').disabled = true;
    actionStatus('⏳ กำลังแยกหน้า PDF…', '');
    currentFile.arrayBuffer().then(function (bytes) {
      return window.PDFLib.PDFDocument.load(bytes);
    }).then(function (srcDoc) {
      var n = srcDoc.getPageCount();
      if (!n) throw new Error('ไฟล์ PDF ไม่มีหน้าเลย');
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
        actionStatus('✅ แยกเป็น ' + n + ' ไฟล์ ดาวน์โหลด pages_' + base + '.zip แล้ว', 'ok');
      });
    }).catch(function (err) {
      actionStatus('❌ แยกหน้า PDF ไม่สำเร็จ: ' + (err && err.message ? err.message : err), 'err');
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
        actionStatus('✅ คัดลอกข้อความแล้ว', 'ok');
      }).catch(function () {
        $('resultText').select();
        document.execCommand('copy');
        actionStatus('✅ คัดลอกข้อความแล้ว', 'ok');
      });
    });
    $('downloadTxtBtn').addEventListener('click', function () {
      var text = $('resultText').value;
      if (!text || !currentFile) return;
      var base = currentFile.name.replace(/\.[^.]+$/, '');
      downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'text_' + base + '.txt');
      actionStatus('✅ ดาวน์โหลด text_' + base + '.txt แล้ว', 'ok');
    });
    $('splitPdfBtn').addEventListener('click', splitPdfPages);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
