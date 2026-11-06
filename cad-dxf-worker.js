/* Worker ของปุ่ม "นำเข้า DXF" (cad.js) — อ่านด้วย CADCraft (vendor/craft/cadcraft-*, WebAssembly) ไม่ให้หน้าค้าง
   โหลดผ่านตัวโหลดกลาง craft-loader.js (ตรวจ sha256 ตาม vendor/craft/manifest.json)
   รับ {bytes: ArrayBuffer} → ตอบ {ok:true, data:{layers:[{n,c}], entities:[…], skipped:{ชนิด:จำนวน}, truncated}, ms}
     | {ok:false, dxf:'damaged'|'empty'|'other'} (ไฟล์ของผู้ใช้มีปัญหา) | {ok:false, craft:{…}} (โหลดไลบรารีไม่ได้)
   ผู้เรียกปิด Worker หลังได้คำตอบทุกครั้ง (wasm ที่ trap แล้วใช้ต่อไม่ได้ + คืนหน่วยความจำ)
   ห้ามส่งเนื้อหา/ชื่อไฟล์ของผู้ใช้กลับไปในข้อความ error */
importScripts('craft-loader.js');

self.onmessage = function (e) {
  var d = e.data || {};
  TanotCraft.bindgen('cadcraft', 'cadcraft_dxf.js', 'cadcraft_dxf_bg.wasm').then(function (cc) {
    var t0 = performance.now(), json;
    try {
      json = cc.read_dxf(new Uint8Array(d.bytes));
    } catch (err) {
      var m = /^dxf:(damaged|empty)\b/.exec(String((err && err.message) || ''));
      self.postMessage({ ok: false, dxf: m ? m[1] : 'other' });
      return;
    }
    self.postMessage({ ok: true, data: JSON.parse(json), ms: Math.round(performance.now() - t0) });
  }).catch(function (err) {
    self.postMessage({ ok: false, craft: TanotCraft.toMessage(err) });
  });
};
