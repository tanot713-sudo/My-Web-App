/* ══════════════════════════════════════════════════════════════════
   mnt-qr.js — สร้าง QR (SVG) + สแกน (กล้อง / ภาพนิ่ง) ของบันทึกงานบำรุงรักษา — window.MntQR (ดู docs/maintenance-design.md หัวข้อ 5)
   - svg() ต้องมี global `qrcode` (vendor/qrcode-generator/qrcode.js โหลดเป็น <script> ธรรมดา)
   - สแกน: ใช้ BarcodeDetector ถ้ามี qr_code ไม่งั้นโหลด vendor/jsqr/jsQR.js ครั้งแรกที่สแกน (ต้องใช้ออฟไลน์ได้ — อยู่ใน sw.js PRECACHE)
   - เนื้อ QR = URL เต็ม origin + /maintenance.html#asset=<id> (id ถาวร ไม่ใช่รหัสป้าย — แก้รหัสแล้ว QR เดิมยังใช้ได้)
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.MntQR = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  function url(id, origin) {
    var o = origin != null ? origin : (root.location ? root.location.origin : '');
    return o + '/maintenance.html#asset=' + encodeURIComponent(id);
  }

  /* qrcode(0,'M') → addData → make → createSvgTag({cellSize, margin, scalable:true}) */
  function svg(text, opt) {
    opt = opt || {};
    if (typeof root.qrcode !== 'function') throw new Error('qrcode-generator ยังไม่ถูกโหลด');
    var q = root.qrcode(0, 'M');
    q.addData(String(text));
    q.make();
    return q.createSvgTag({ cellSize: opt.cell || 4, margin: opt.margin == null ? 2 : opt.margin, scalable: true });
  }

  /* ข้อความที่สแกนได้ → id อุปกรณ์ · มี #asset= ใช้ค่านั้น · ไม่งั้นเทียบ code/id ตรงตัว (ไม่สนตัวพิมพ์) · ไม่พบ = null */
  function parse(text, assets) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return null;
    var m = /#asset=([^&\s]+)/.exec(t);
    if (m) { try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } }
    var l = t.toLowerCase(), list = assets || [];
    for (var i = 0; i < list.length; i++) if (String(list[i].code).toLowerCase() === l || String(list[i].id).toLowerCase() === l) return list[i].id;
    return null;
  }

  var jsqrPromise = null;
  function loadJsQR() {
    if (typeof root.jsQR === 'function') return Promise.resolve(root.jsQR);
    if (!jsqrPromise) {
      jsqrPromise = new Promise(function (resolve, reject) {
        var el = document.createElement('script');
        el.src = 'vendor/jsqr/jsQR.js'; // jsQR 1.4.0 (Apache-2.0)
        el.onload = function () { typeof root.jsQR === 'function' ? resolve(root.jsQR) : reject(new Error('jsQR')); };
        el.onerror = function () { jsqrPromise = null; reject(new Error('โหลด jsQR ไม่ได้')); };
        document.head.appendChild(el);
      });
    }
    return jsqrPromise;
  }

  var detectorPromise = null;
  function nativeDetector() {
    if (!detectorPromise) {
      detectorPromise = (typeof root.BarcodeDetector === 'function' && root.BarcodeDetector.getSupportedFormats
        ? root.BarcodeDetector.getSupportedFormats().then(function (f) { return f.indexOf('qr_code') !== -1 ? new root.BarcodeDetector({ formats: ['qr_code'] }) : null; })
        : Promise.resolve(null)).catch(function () { return null; });
    }
    return detectorPromise;
  }

  /* ถอดจากภาพนิ่ง (File/Blob) → ข้อความ หรือ null */
  function decodeImage(blob) {
    return new Promise(function (resolve, reject) {
      var u = URL.createObjectURL(blob), img = new Image();
      img.onerror = function () { URL.revokeObjectURL(u); reject(new Error('เปิดภาพไม่ได้')); };
      img.onload = function () {
        URL.revokeObjectURL(u);
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, 1600 / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        var ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); // PNG โปร่งใส → พื้นขาว
        ctx.drawImage(img, 0, 0, c.width, c.height);
        loadJsQR().then(function (jsQR) {
          var d = ctx.getImageData(0, 0, c.width, c.height);
          var r = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
          resolve(r ? r.data : null);
        }, reject);
      };
      img.src = u;
    });
  }

  /* สแกนด้วยกล้อง: เปิดกล้องหลังลงใน videoEl (playsinline muted) → Promise<ข้อความที่ถอดได้>
     คืน promise ที่มี .cancel() — ปิดกล้องทุกทางออก (สำเร็จ / ยกเลิก / error) · ยกเลิก = resolve(null) */
  function scan(videoEl) {
    var stream = null, timer = null, finished = false, resolveFn, rejectFn;
    function stop() {
      finished = true;
      if (timer) { clearInterval(timer); timer = null; }
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      try { videoEl.pause(); videoEl.srcObject = null; } catch (e) {}
    }
    var p = new Promise(function (resolve, reject) { resolveFn = resolve; rejectFn = reject; });
    function done(v) { if (finished) return; stop(); resolveFn(v); }
    function fail(e) { if (finished) return; stop(); rejectFn(e); }
    p.cancel = function () { done(null); };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { fail(new Error('อุปกรณ์นี้เปิดกล้องไม่ได้')); return p; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (s) {
      if (finished) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s;
      videoEl.setAttribute('playsinline', ''); videoEl.muted = true; videoEl.srcObject = s;
      return videoEl.play().catch(function () {}).then(function () {
        return Promise.all([nativeDetector(), loadJsQR().catch(function () { return null; })]);
      }).then(function (r) {
        if (finished) return;
        var det = r[0], jsQR = r[1];
        if (!det && !jsQR) return fail(new Error('โหลดตัวอ่าน QR ไม่ได้'));
        var cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true }), busy = false;
        timer = setInterval(function () { // ~8 ครั้ง/วิ
          if (finished || busy || !videoEl.videoWidth) return;
          busy = true;
          var k = Math.min(1, 640 / videoEl.videoWidth);
          cv.width = Math.round(videoEl.videoWidth * k); cv.height = Math.round(videoEl.videoHeight * k);
          var job;
          if (det) job = det.detect(videoEl).then(function (a) { return a && a[0] ? a[0].rawValue : null; });
          else {
            ctx.drawImage(videoEl, 0, 0, cv.width, cv.height);
            var d = ctx.getImageData(0, 0, cv.width, cv.height), q = jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' });
            job = Promise.resolve(q ? q.data : null);
          }
          job.then(function (t) { busy = false; if (t) done(t); }, function () { busy = false; });
        }, 125);
      });
    }).catch(fail);
    return p;
  }

  return { url: url, svg: svg, parse: parse, scan: scan, decodeImage: decodeImage, loadJsQR: loadJsQR };
});
