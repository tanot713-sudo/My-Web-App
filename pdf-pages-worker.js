/* Worker ของปุ่ม "แยกหน้า PDF" (extract-text.js) — แยกด้วย PdfCraft (vendor/craft/pdfcraft-*, WebAssembly) ไม่ให้หน้าค้าง
   โหลดผ่านตัวโหลดกลาง craft-loader.js (ตรวจ sha256 ตาม vendor/craft/manifest.json)
   รับ {bytes: ArrayBuffer, every: จำนวนหน้าต่อไฟล์} → ตอบ {ok:true, parts:[ArrayBuffer…], ms}
     | {ok:false, pdf:'encrypted'|'damaged'|'empty'|'other'} (ไฟล์ของผู้ใช้มีปัญหา) | {ok:false, craft:{…}} (โหลดไลบรารีไม่ได้)
   ผู้เรียกปิด Worker หลังได้คำตอบทุกครั้ง (wasm ที่ trap แล้วใช้ต่อไม่ได้ + คืนหน่วยความจำ)
   ห้ามส่งเนื้อหา/ชื่อไฟล์ของผู้ใช้กลับไปในข้อความ error */
importScripts('craft-loader.js');

self.onmessage = function (e) {
  var d = e.data || {};
  TanotCraft.bindgen('pdfcraft', 'pdfcraft_pages.js', 'pdfcraft_pages_bg.wasm').then(function (pp) {
    var t0 = performance.now(), arr;
    try {
      arr = pp.split(new Uint8Array(d.bytes), d.every || 1);
    } catch (err) {
      var m = /^pdf:(encrypted|damaged|empty)\b/.exec(String((err && err.message) || ''));
      self.postMessage({ ok: false, pdf: m ? m[1] : 'other' });
      return;
    }
    var parts = [];
    for (var i = 0; i < arr.length; i++) parts.push(arr[i].buffer);
    self.postMessage({ ok: true, parts: parts, ms: Math.round(performance.now() - t0) }, parts);
  }).catch(function (err) {
    self.postMessage({ ok: false, craft: TanotCraft.toMessage(err) });
  });
};
