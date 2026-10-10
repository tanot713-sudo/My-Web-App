/* Worker เตรียมภาพก่อน OCR (ขยาย/แก้ภาพเอียง/ขาวดำรายพื้นที่) — ย้ายงานพิกเซลหนักออกจากเธรดหลักไม่ให้หน้าค้างกับรูปใหญ่
   รับ { id, bitmap: ImageBitmap (transfer), opts } → ตอบ { id, blob: PNG, angle, mode } หรือ { id, error } · ตัวคำนวณจริงอยู่ใน ocr-prep.js (ใช้ร่วมกับเธรดหลัก/เทสต์)
   ไม่มี OffscreenCanvas 2d ในเบราว์เซอร์นี้ = ตอบ error แล้ว file-reader.js จะทำบนเธรดหลักแทน */
importScripts('ocr-prep.js');
self.onmessage = function (e) {
  var m = e.data || {};
  Promise.resolve().then(function () {
    if (typeof OffscreenCanvas === 'undefined') throw new Error('no OffscreenCanvas');
    var bmp = m.bitmap;
    var r = self.TanotOcrPrep.prepare(bmp, bmp.width, bmp.height, m.opts || {}, function (w, h) { return new OffscreenCanvas(w, h); });
    if (bmp.close) bmp.close();
    return r.canvas.convertToBlob({ type: 'image/png' }).then(function (blob) {
      self.postMessage({ id: m.id, blob: blob, angle: r.angle, mode: r.mode });
    });
  }).catch(function (err) {
    self.postMessage({ id: m.id, error: String((err && err.message) || err) });
  });
};
