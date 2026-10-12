/* f5-worker.js — Web Worker (type: module) ของหน้าทดลอง f5-lab.html: โหลด/แคชโมเดล F5-TTS-THAI ONNX และสร้างเสียงด้วย onnxruntime-web (WebGPU)
   ตรรกะทั้งหมดอยู่ใน f5-engine.js (ไฟล์เดียวกันใช้บนเธรดหลักได้ด้วย) · ไฟล์นี้แค่โหลดสคริปต์แล้วส่งข้อความต่อ
   cancel ส่งตรงเข้า engine ทันที (ไม่ต่อคิว) เพื่อหยุดระหว่าง step ได้ */
'use strict';
var ready = Promise.all([import('./f5-calc.js'), import('./media-models.js')]).then(function () { return import('./f5-engine.js'); }).then(function () {
  return self.TanotF5Engine.create(function (m, transfer) { self.postMessage(m, transfer || []); });
});
var queue = Promise.resolve();
self.onmessage = function (e) {
  var msg = e.data || {};
  if (msg.cmd === 'cancel') { ready.then(function (eng) { eng.cancel(); }); return; }
  queue = queue.then(function () { return ready; }).then(function (eng) { return eng.handle(msg); }).catch(function (err) {
    self.postMessage({ type: 'error', stage: 'worker', name: (err && err.name) || 'Error', code: (err && err.code) || '', message: String((err && err.message) || err).slice(0, 300) });
  });
};
