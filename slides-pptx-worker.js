/* Worker ของปุ่ม "นำเข้าไฟล์" (.pptx) ของ slides.js — อ่านด้วย DeckCraft (vendor/craft/deckcraft-*, WebAssembly) ไม่ให้หน้าค้าง
   โหลดผ่านตัวโหลดกลาง craft-loader.js (ตรวจ sha256 ตาม vendor/craft/manifest.json)
   รับ {bytes: ArrayBuffer} → ตอบ {ok:true, data:{slides:[…], skipped}, ms} (แปลงเป็นโครงเรื่องด้วย SlidesCalc.pptxToOutline)
     | {ok:false, pptx:'encrypted'|'damaged'|'empty'|'other'} (ไฟล์ของผู้ใช้มีปัญหา) | {ok:false, craft:{…}} (โหลดไลบรารีไม่ได้)
   ผู้เรียกปิด Worker หลังได้คำตอบทุกครั้ง (wasm ที่ trap แล้วใช้ต่อไม่ได้ + คืนหน่วยความจำ)
   ห้ามส่งเนื้อหา/ชื่อไฟล์ของผู้ใช้กลับไปในข้อความ error */
importScripts('craft-loader.js');

self.onmessage = function (e) {
  var d = e.data || {};
  TanotCraft.bindgen('deckcraft', 'deckcraft_pptx.js', 'deckcraft_pptx_bg.wasm').then(function (dc) {
    var t0 = performance.now(), json;
    try {
      json = dc.read_pptx(new Uint8Array(d.bytes));
    } catch (err) {
      var m = /^pptx:(encrypted|damaged|empty)\b/.exec(String((err && err.message) || ''));
      self.postMessage({ ok: false, pptx: m ? m[1] : 'other' });
      return;
    }
    self.postMessage({ ok: true, data: JSON.parse(json), ms: Math.round(performance.now() - t0) });
  }).catch(function (err) {
    self.postMessage({ ok: false, craft: TanotCraft.toMessage(err) });
  });
};
