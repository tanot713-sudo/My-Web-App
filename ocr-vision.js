/* ══════════════════════════════════════════════════════════════════
   ocr-vision.js — ทางเข้าเดียวของหน้าเว็บสู่ Claude Vision (/api/ocr) · window.TanotOcr
   ทุกหน้าที่ให้ผู้ใช้เลือก Claude Vision (doc-check, extract-text, receipts) ต้องเรียกผ่านไฟล์นี้ — ไม่เรียก AiClient.ocr ตรง

   กฎ (เจ้าของกำหนด):
   - ใช้เฉพาะเมื่อผู้ใช้เลือกเอง (ค่าเริ่มต้นของทุกหน้าเป็นวิธีฟรี) และ "ทุกครั้ง" ที่ส่งต้องเปิด dialog กรอกรหัส (OCR_PIN) ก่อน
     — ไม่จำรหัส: ไม่เก็บใน storage/ตัวแปรระดับไฟล์ ช่องกรอกถูกล้าง+ถอดออกจาก DOM ทันทีที่ปิด · ยกเลิก dialog = ไม่ส่งคำขอ
   - รูปย่อก่อนส่งเสมอ (ด้านยาว ≤ 2000px, JPEG ~0.85, base64 ≤ 5 MB) · HEIC/HEIF ผ่าน createImageBitmap (ถ้าเบราว์เซอร์ถอดรหัสได้) · เคารพ EXIF orientation
   - PDF ส่งทั้งไฟล์ (≤ 100 หน้า, ไฟล์ท่อนละ ≤ ~20 MB) เกินลิมิต = แบ่งเป็นช่วงหน้าด้วย pdf-lib (โหลดตอนจำเป็น) แล้วส่งทีละท่อน
   - error ลงบันทึกปัญหา (TanotMedia.logError — ไม่เก็บรูป/ข้อความ) ยกเว้นรหัสผิด/ยกเลิก
   - ไม่มีโมเดลให้เลือกจากหน้าเว็บ (เซิร์ฟเวอร์ใช้ค่าเริ่มต้น) — allowlist อยู่ใน functions/api/ocr.js */
(function () {
  'use strict';

  var MAX_SIDE = 2000, QUALITY = 0.85, MAX_B64 = 5000000;     // รูป (ลิมิต 5 MB ของ Claude นับเป็นตัวอักษร base64 อย่างระวัง)
  var PDF_MAX_PAGES = 100, PDF_MAX_RAW = 20 * 1024 * 1024;     // ท่อน PDF: base64 บวม 4/3 → 20 MB ดิบ ≈ 27 MB ใต้เพดานคำขอ 32 MB
  var PDF_LIB_URL = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';

  var T = window.OME_I18N ? window.OME_I18N.scope('ocrv', {
    th: {
      title: 'กรอกรหัสก่อนใช้ Claude Vision', label: 'รหัส', send: 'ใช้ Claude Vision', cancel: 'ยกเลิก', empty: 'กรอกรหัสก่อน',
      wrong: 'รหัสไม่ถูกต้อง', wrongLeft: 'รหัสไม่ถูกต้อง — เหลือ {n} ครั้งก่อนล็อก',
      convert: 'แปลงรูปเป็น JPEG ไม่ได้ — เบราว์เซอร์นี้อ่านไฟล์ชนิดนี้ไม่ได้ (เช่น HEIC) ลองบันทึกเป็น JPEG แล้วเลือกใหม่',
      big: 'รูปใหญ่เกินที่ Claude Vision รับได้แม้ย่อแล้ว', pdfLib: 'โหลดตัวแบ่งหน้า PDF ไม่สำเร็จ — เช็คอินเทอร์เน็ตแล้วลองใหม่',
      pdfBig: 'PDF มีหน้าเดียวที่ใหญ่เกินที่ Claude Vision รับได้', pdfBad: 'เปิดไฟล์ PDF นี้ไม่ได้',
      page: 'หน้า {n}', truncated: 'ข้อความยาวเกินที่ Claude ตอบได้ในครั้งเดียว ส่วนท้ายอาจขาดหาย'
    },
    en: {
      title: 'Enter the code to use Claude Vision', label: 'Code', send: 'Use Claude Vision', cancel: 'Cancel', empty: 'Enter the code first',
      wrong: 'Incorrect code', wrongLeft: 'Incorrect code — {n} attempt(s) left before it locks',
      convert: 'Could not convert the image to JPEG — this browser cannot read this file type (e.g. HEIC). Save it as JPEG and pick it again',
      big: 'The image is too large for Claude Vision even after shrinking', pdfLib: 'Could not load the PDF page splitter — check your connection and try again',
      pdfBig: 'A single PDF page is too large for Claude Vision', pdfBad: 'Could not open this PDF',
      page: 'Page {n}', truncated: 'The text is longer than Claude can return in one reply; the end may be missing'
    }
  }) : function (k, v) {
    var d = { title: 'กรอกรหัสก่อนใช้ Claude Vision', label: 'รหัส', send: 'ใช้ Claude Vision', cancel: 'ยกเลิก', empty: 'กรอกรหัสก่อน', wrong: 'รหัสไม่ถูกต้อง', page: 'หน้า {n}' };
    return String(d[k] || '').replace(/\{(\w+)\}/g, function (m, n) { return v && v[n] != null ? v[n] : m; });
  };

  /* error ของไฟล์นี้พก key (e.ocrvKey) ไว้แปลซ้ำตอนสลับภาษาสด — ใช้ TanotOcr.errorText(e) ในฟังก์ชันที่ส่งให้ OME_I18N.live */
  function err(key, code, vars) {
    var e = new Error(T(key, vars));
    e.name = 'OcrvError'; e.code = code || key; e.ocrvKey = key; e.ocrvVars = vars;
    return e;
  }
  function cancelled() { var e = new Error('cancelled'); e.name = 'AbortError'; e.code = 'cancel'; return e; }
  function errorText(e) {
    if (e && e.ocrvKey) return T(e.ocrvKey, e.ocrvVars);
    if (e && window.AiClient && e.code) return window.AiClient.friendlyMessage(e);
    return e && e.message ? e.message : String(e);
  }

  function available() { return !!(window.AiClient && window.AiClient.available()); }

  /* ── รูป: ย่อ + แปลงเป็น JPEG ── */
  function b64len(bytes) { return Math.ceil(bytes / 3) * 4; }

  function decode(file) {
    function viaImg() {
      return new Promise(function (resolve, reject) {
        var u = URL.createObjectURL(file), img = new Image();
        img.onload = function () { URL.revokeObjectURL(u); resolve({ src: img, w: img.naturalWidth, h: img.naturalHeight, close: function () {} }); };
        img.onerror = function () { URL.revokeObjectURL(u); reject(err('convert')); };
        img.src = u;
      });
    }
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bmp) {
        return { src: bmp, w: bmp.width, h: bmp.height, close: function () { if (bmp.close) bmp.close(); } };
      }).catch(viaImg);
    }
    return viaImg();
  }

  function encode(d, k, q) {
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(d.w * k)); cv.height = Math.max(1, Math.round(d.h * k));
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); // PNG โปร่งใส → พื้นขาว (JPEG ไม่มีอัลฟา)
    ctx.drawImage(d.src, 0, 0, cv.width, cv.height);
    return new Promise(function (resolve, reject) {
      cv.toBlob(function (b) { b ? resolve(b) : reject(err('convert')); }, 'image/jpeg', q);
    });
  }

  /* shrinkImage(fileOrBlob, { maxSide=2000, quality=0.85, maxB64=5,000,000 }) → Promise<Blob JPEG> — ใช้ร่วมทุกหน้า (receipts ส่ง 1600/0.8 ไปเก็บ R2) */
  function shrinkImage(file, o) {
    o = o || {};
    var maxSide = o.maxSide || MAX_SIDE, q0 = o.quality || QUALITY, maxB64 = o.maxB64 || MAX_B64;
    return decode(file).then(function (d) {
      var k = Math.min(1, maxSide / Math.max(d.w, d.h));
      function attempt(scale, q) {
        return encode(d, scale, q).then(function (blob) {
          if (b64len(blob.size) <= maxB64) return blob;
          // ยังใหญ่เกิน: ลดคุณภาพก่อน แล้วค่อยลดขนาด
          if (q > 0.6) return attempt(scale, Math.max(0.55, q - 0.15));
          if (Math.max(d.w, d.h) * scale * 0.8 < 600) throw err('big', 'too_large');
          return attempt(scale * 0.8, 0.7);
        });
      }
      return attempt(k, q0).then(function (b) { d.close(); return b; }, function (e) { d.close(); throw e; });
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function () { reject(err('pdfBad', 'read')); };
      fr.readAsDataURL(blob);
    });
  }

  /* ── dialog รหัส (ไม่จำ) ── */
  var dlgSeq = 0;
  /* askPin({ error }) → Promise<string|null> (null = ยกเลิก) — เปิดใหม่ทุกครั้ง ปิดแล้วล้างช่อง + ถอด DOM */
  function askPin(o) {
    o = o || {};
    return new Promise(function (resolve) {
      var n = ++dlgSeq, d = document.createElement('dialog');
      d.className = 'dialog dialog-form ocrv-dialog';
      d.setAttribute('aria-labelledby', 'ocrvT' + n);
      d.setAttribute('data-ocrv', '');
      d.innerHTML =
        '<form method="dialog" novalidate>' +
          '<div class="dialog-head"><h2 id="ocrvT' + n + '"></h2></div>' +
          '<div class="dialog-body">' +
            '<div class="field"><label for="ocrvP' + n + '"></label>' +
              '<input class="input" id="ocrvP' + n + '" type="password" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64" data-lpignore="true" data-1p-ignore="true"></div>' +
            '<p class="form-msg" role="alert"></p>' +
          '</div>' +
          '<div class="dialog-foot"><button class="btn" type="button" data-k="cancel"></button><button class="btn primary" type="submit" data-k="send"></button></div>' +
        '</form>';
      var q = function (s) { return d.querySelector(s); };
      q('h2').textContent = T('title');
      q('label').textContent = T('label');
      q('[data-k="cancel"]').textContent = T('cancel');
      q('[data-k="send"]').textContent = T('send');
      var input = q('input'), msg = q('.form-msg');
      msg.textContent = o.error || '';
      var done = false;
      function finish(v) {
        if (done) return;
        done = true;
        input.value = ''; // ไม่ให้รหัสค้างใน DOM
        try { if (d.open) d.close(); } catch (e) {}
        if (d.parentNode) d.parentNode.removeChild(d);
        resolve(v);
      }
      d.addEventListener('close', function () { finish(null); });
      q('[data-k="cancel"]').addEventListener('click', function () { finish(null); });
      q('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var v = input.value;
        if (!v) { msg.textContent = T('empty'); input.focus(); return; }
        finish(v);
      });
      input.addEventListener('input', function () { msg.textContent = ''; });
      document.body.appendChild(d);
      if (d.showModal) d.showModal(); else d.setAttribute('open', '');
      input.focus();
    });
  }

  /* withPin(run) — ถามรหัสแล้วเรียก run(pin) · รหัสผิด → เปิด dialog ใหม่พร้อมข้อความ (ลองใหม่ได้จนกว่าจะล็อก) · ยกเลิก → reject (code 'cancel') · error อื่นส่งต่อ */
  function withPin(run) {
    function attempt(msg) {
      return askPin({ error: msg }).then(function (pin) {
        if (pin === null) throw cancelled();
        return run(pin).then(null, function (e) {
          if (e && e.code === 'pin_wrong') {
            return attempt(e.remaining != null && e.remaining < 5 ? T('wrongLeft', { n: e.remaining }) : T('wrong'));
          }
          throw e;
        });
      });
    }
    return attempt('');
  }

  function logFail(e, ctx) {
    if (!e || e.code === 'cancel' || e.code === 'abort' || /^pin_/.test(e.code || '')) return;
    if (window.TanotMedia) window.TanotMedia.logError('ocr', e, { stage: 'claude', engine: 'cloud', model: 'claude', file: ctx });
    e.mediaLogged = true;
  }

  function call(body) {
    return window.AiClient.ocr(body);
  }

  /* ocrImage(fileOrBlob, { prompt?, signal?, skipShrink? }) → Promise<{ text, truncated }> */
  function ocrImage(file, o) {
    o = o || {};
    if (!available()) return Promise.reject(window.AiClient ? window.AiClient.Error('unavailable', 'unavailable') : new Error('unavailable'));
    var meta = { type: 'image/jpeg', size: file && file.size };
    return (o.skipShrink && file.type === 'image/jpeg' && b64len(file.size) <= MAX_B64 ? Promise.resolve(file) : shrinkImage(file))
      .then(blobToBase64)
      .then(function (b64) {
        return withPin(function (pin) { return call({ imageBase64: b64, mediaType: 'image/jpeg', prompt: o.prompt, pin: pin, signal: o.signal }); });
      })
      .then(function (r) { return { text: String((r && r.text) || ''), truncated: !!(r && r.truncated) }; })
      .catch(function (e) { logFail(e, meta); throw e; });
  }

  /* ── PDF ── */
  var pdfLibP = null;
  function loadPdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    if (!pdfLibP) {
      pdfLibP = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = PDF_LIB_URL; s.onload = function () { resolve(window.PDFLib); };
        s.onerror = function () { pdfLibP = null; reject(err('pdfLib')); };
        document.head.appendChild(s);
      });
    }
    return pdfLibP;
  }

  /* แบ่งไฟล์เป็นท่อน [{ blob, start }] — ครบเงื่อนไขอยู่แล้ว (≤ 100 หน้า และ ≤ 20 MB) = ท่อนเดียวคือไฟล์เดิม ไม่ต้องโหลด pdf-lib */
  function planParts(file, numPages) {
    if (numPages && numPages <= PDF_MAX_PAGES && file.size <= PDF_MAX_RAW) return Promise.resolve([{ blob: file, start: 1 }]);
    return loadPdfLib().then(function (L) {
      return file.arrayBuffer().then(function (buf) { return L.PDFDocument.load(buf, { ignoreEncryption: true }); }).then(function (src) {
        var total = src.getPageCount(), parts = [];
        function build(from, to) { // หน้า from..to (index จาก 0, to รวม) → ถ้าไฟล์ใหญ่เกินก็ซอยครึ่ง
          return L.PDFDocument.create().then(function (doc) {
            var idx = []; for (var i = from; i <= to; i++) idx.push(i);
            return doc.copyPages(src, idx).then(function (pgs) {
              pgs.forEach(function (p) { doc.addPage(p); });
              return doc.save();
            });
          }).then(function (bytes) {
            if (bytes.length > PDF_MAX_RAW) {
              if (from === to) throw err('pdfBig', 'too_large');
              var mid = Math.floor((from + to) / 2);
              return build(from, mid).then(function () { return build(mid + 1, to); });
            }
            parts.push({ blob: new Blob([bytes], { type: 'application/pdf' }), start: from + 1 });
          });
        }
        var chain = Promise.resolve();
        for (var s = 0; s < total; s += PDF_MAX_PAGES) (function (from, to) { chain = chain.then(function () { return build(from, to); }); })(s, Math.min(total - 1, s + PDF_MAX_PAGES - 1));
        return chain.then(function () { return parts; });
      });
    }).catch(function (e) { throw e && e.ocrvKey ? e : err('pdfBad', 'pdf'); });
  }

  /* แยกข้อความตามบรรทัดคั่น [[หน้า N]] ที่เซิร์ฟเวอร์สั่งโมเดลให้ใส่ → [{ n, text }] · ไม่พบตัวคั่น = ทั้งก้อนเป็นหน้าแรกของท่อน */
  function parsePages(text, start) {
    var re = /^[ \t]*\[\[หน้า\s*(\d+)\]\][ \t]*$/gm, marks = [], m;
    while ((m = re.exec(text))) marks.push({ n: parseInt(m[1], 10), from: m.index, to: re.lastIndex });
    if (!marks.length) return [{ n: start, text: String(text).trim() }];
    var pages = [], head = text.slice(0, marks[0].from).trim();
    if (head) pages.push({ n: start, text: head });
    marks.forEach(function (k, i) {
      pages.push({ n: k.n, text: text.slice(k.to, i + 1 < marks.length ? marks[i + 1].from : text.length).trim() });
    });
    return pages;
  }

  /* formatPages(pages) → ข้อความเดียว: หลายหน้า = หัว "--- หน้า N ---" คั่นแต่ละหน้า */
  function formatPages(pages) {
    if (!pages.length) return '';
    if (pages.length === 1) return pages[0].text;
    return pages.map(function (p) { return '--- ' + T('page', { n: p.n }) + ' ---\n' + p.text; }).join('\n\n');
  }

  /* ocrPdf(file, { numPages?, signal?, prompt?, onProgress({ stage:'split'|'claude', part, parts }) })
     → Promise<{ pages:[{n,text}], text, truncated }> · prompt ส่งมา (เช่นใบเสร็จ) = ไม่คั่นหน้า ผลคือ pages 1 รายการต่อท่อน */
  function ocrPdf(file, o) {
    o = o || {};
    if (!available()) return Promise.reject(window.AiClient ? window.AiClient.Error('unavailable', 'unavailable') : new Error('unavailable'));
    var prog = o.onProgress || function () {};
    var meta = { type: 'application/pdf', size: file && file.size };
    prog({ stage: 'split', part: 0, parts: 0 });
    return planParts(file, o.numPages).then(function (parts) {
      return withPin(function (pin) {
        var pages = [], truncated = false, chain = Promise.resolve();
        parts.forEach(function (part, i) {
          chain = chain.then(function () {
            prog({ stage: 'claude', part: i + 1, parts: parts.length });
            return blobToBase64(part.blob).then(function (b64) {
              return call({ pdfBase64: b64, pageStart: part.start, prompt: o.prompt, pin: pin, signal: o.signal });
            }).then(function (r) {
              var text = String((r && r.text) || '');
              if (r && r.truncated) truncated = true;
              (o.prompt ? [{ n: part.start, text: text.trim() }] : parsePages(text, part.start)).forEach(function (p) { pages.push(p); });
            });
          });
        });
        return chain.then(function () { return { pages: pages, text: formatPages(pages), truncated: truncated }; });
      });
    }).catch(function (e) { logFail(e, meta); throw e; });
  }

  window.TanotOcr = {
    available: available, shrinkImage: shrinkImage, askPin: askPin, withPin: withPin,
    ocrImage: ocrImage, ocrPdf: ocrPdf, parsePages: parsePages, formatPages: formatPages, errorText: errorText,
    isCancel: function (e) { return !!e && e.code === 'cancel'; },
    T: T, LIMITS: { MAX_SIDE: MAX_SIDE, MAX_B64: MAX_B64, PDF_MAX_PAGES: PDF_MAX_PAGES, PDF_MAX_RAW: PDF_MAX_RAW }
  };
})();
