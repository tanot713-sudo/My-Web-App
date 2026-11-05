/* ══════════════════════════════════════════════════════════════════
   image-cutout-worker.js — "พื้นโปร่ง" ของหน้าสร้างภาพ: ถอดภาพ + flood fill นอกเธรดหลัก (image-gen.js สร้างเมื่อมี Worker + OffscreenCanvas + createImageBitmap
   — ไม่มี = หน้าทำบนเธรดหลักด้วยฟังก์ชันเดียวกันใน image-cutout-calc.js หลัง yield ให้หน้าวาดก่อน)
   ข้อความเข้า: { type:'load', id, blob } → ถอดภาพเก็บพิกเซลต้นฉบับไว้ใน Worker (เลื่อนแถบค่าความต่างแล้วไม่ต้องส่งภาพซ้ำ)
               { type:'flood', id, seq, tolerance, soft }
   ข้อความออก: { type:'loaded', id, w, h } · { type:'result', id, seq, w, h, data (transfer), removed, kept, partial }
               { type:'error', id, seq?, name, message } — ไม่มีเนื้อหาภาพ
   ══════════════════════════════════════════════════════════════════ */
'use strict';
importScripts('image-cutout-calc.js');

var src = null; // { id, w, h, data }

function fail(id, seq, err) {
  self.postMessage({ type: 'error', id: id, seq: seq, name: (err && err.name) || 'Error', message: String((err && err.message) || err).slice(0, 200) });
}

self.onmessage = function (e) {
  var m = e.data || {};
  if (m.type === 'load') {
    src = null;
    createImageBitmap(m.blob).then(function (bmp) {
      var w = bmp.width, h = bmp.height;
      var c = new OffscreenCanvas(w, h), g = c.getContext('2d');
      g.drawImage(bmp, 0, 0);
      if (bmp.close) bmp.close();
      src = { id: m.id, w: w, h: h, data: g.getImageData(0, 0, w, h).data };
      self.postMessage({ type: 'loaded', id: m.id, w: w, h: h });
    }).catch(function (err) { fail(m.id, null, err); });
    return;
  }
  if (m.type === 'flood') {
    if (!src || src.id !== m.id) { fail(m.id, m.seq, new Error('no image')); return; }
    try {
      var r = self.TanotCutout.floodTransparent(src.data, src.w, src.h, { tolerance: m.tolerance, soft: m.soft });
      self.postMessage({ type: 'result', id: m.id, seq: m.seq, w: src.w, h: src.h, data: r.data, removed: r.removed, kept: r.kept, partial: r.partial }, [r.data.buffer]);
    } catch (err) { fail(m.id, m.seq, err); }
  }
};
