/* Worker ของ xlsx-recalc.js — คำนวณสูตรด้วย GridCraft (vendor/craft/gridcraft-*, WebAssembly) ไม่ให้หน้าค้าง
   โหลดผ่านตัวโหลดกลาง craft-loader.js (ตรวจ sha256 ตาม vendor/craft/manifest.json)
   รับ {bytes: ArrayBuffer, cells: [{sheet, r, c}]} → ตอบ {ok:true, cells:[{sheet, r, c, t, v, z?}], ms} | {ok:false, error, craft?}
   ผู้เรียกปิด Worker หลังได้คำตอบทุกครั้ง (wasm ที่ trap แล้วใช้ต่อไม่ได้ + คืนหน่วยความจำ) */
importScripts('craft-loader.js');

self.onmessage = function (e) {
  var d = e.data || {};
  TanotCraft.bindgen('gridcraft', 'gridcraft_recalc.js', 'gridcraft_recalc_bg.wasm').then(function (gc) {
    var names = [], flat = new Uint32Array(d.cells.length * 3);
    d.cells.forEach(function (q, i) {
      var k = names.indexOf(q.sheet);
      if (k < 0) { k = names.length; names.push(q.sheet); }
      flat[i * 3] = k; flat[i * 3 + 1] = q.r; flat[i * 3 + 2] = q.c;
    });
    var t0 = performance.now();
    var out = JSON.parse(gc.recalc(new Uint8Array(d.bytes), names, flat));
    self.postMessage({ ok: true, cells: out, ms: Math.round(performance.now() - t0) });
  }).catch(function (err) {
    var m = TanotCraft.toMessage(err);
    self.postMessage({ ok: false, error: m.message, craft: m.craft ? m : null });
  });
};
