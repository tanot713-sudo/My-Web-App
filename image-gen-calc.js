/* ══════════════════════════════════════════════════════════════════
   Tanot — สร้างภาพ (image-gen.html): ตรรกะล้วน (ไม่มี DOM/storage) · UMD — window.ImageGenCalc, require() ได้ใน tests/image-gen.spec.js
   RATIOS = อัตราส่วนที่หน้าให้เลือก (เฉพาะ preset อิสระ + โมเดลคุณภาพ) — ต้องตรงกับ ASPECTS ใน functions/api/ai/image.js (เทสต์ตรวจ)
   recentPrompts = prompt ล่าสุดจากแถวคลัง tanot:images:items (ไม่มีคีย์เก็บของตัวเอง)
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ImageGenCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RATIOS = [
    { id: '1:1', width: 1024, height: 1024 },
    { id: '3:4', width: 768, height: 1024 },
    { id: '4:3', width: 1024, height: 768 },
    { id: '9:16', width: 576, height: 1024 },
    { id: '16:9', width: 1024, height: 576 }
  ];
  var RECENT_MAX = 6;

  function ratioOf(w, h) {
    for (var i = 0; i < RATIOS.length; i++) if (RATIOS[i].width === w && RATIOS[i].height === h) return RATIOS[i].id;
    return null;
  }

  function key(s) { return s.replace(/\s+/g, ' ').toLowerCase(); }

  /* ใหม่สุดก่อน · ตัดซ้ำ (ตัดช่องว่างหัวท้าย/ซ้อน ไม่สนตัวพิมพ์) เก็บฉบับที่ใหม่สุด · ข้าม prompt ว่าง */
  function recentPrompts(rows, max) {
    var list = (Array.isArray(rows) ? rows : []).filter(function (x) { return x && typeof x.prompt === 'string' && x.prompt.trim(); });
    list.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    var seen = {}, out = [], n = max > 0 ? max : RECENT_MAX;
    for (var i = 0; i < list.length && out.length < n; i++) {
      var p = list[i].prompt.trim(), k = key(p);
      if (Object.prototype.hasOwnProperty.call(seen, k)) continue;
      seen[k] = 1; out.push(p);
    }
    return out;
  }

  return { RATIOS: RATIOS, RECENT_MAX: RECENT_MAX, ratioOf: ratioOf, recentPrompts: recentPrompts };
});
