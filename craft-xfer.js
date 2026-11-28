/* craft-xfer.js — ส่งไฟล์แบบ 1 ชิ้นข้ามหน้า cad.html ↔ cad-pro.html ภายในเครื่องเท่านั้น (ไม่อัปโหลด ไม่ซิงก์)
   ที่เก็บ = IndexedDB tanot-craft-recent store files (ฐานเดียวกับ "ไฟล์ล่าสุด" ของ craft-app.js — ลงทะเบียนใน data-registry.js แล้ว
   ย้าย/สำรองเท่านั้น) เป็นแถวเดียว id 'xfer|handoff' ที่ app:'xfer' จึงไม่ขึ้นในรายการไฟล์ล่าสุดของแอปใด
   ส่งซ้ำ = เขียนทับ · take() อ่านแล้วลบทันที · แถวที่เก่ากว่า MAX_AGE_MS ถูกลบทิ้งโดยไม่ส่งต่อ (ส่งแล้วไม่ได้เปิดหน้าปลายทาง ไม่ทิ้งของค้าง)
   UMD: window.TanotCraftXfer { put(name, bytes), take(), MAX_BYTES } · error มี .code = 'size' | 'idb' */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TanotCraftXfer = api;
})(typeof self !== 'undefined' ? self : this, function (G) {
  'use strict';

  var DB = 'tanot-craft-recent', ID = 'xfer|handoff';
  var MAX_BYTES = 15 * 1048576; // shortcut: เพดานเท่าไฟล์ล่าสุด, แบบที่ใหญ่กว่านี้ให้บันทึกเป็นไฟล์แล้วเปิดเอง
  var MAX_AGE_MS = 10 * 60 * 1000;

  function err(code) { var e = new Error('xfer:' + code); e.code = code; return e; }

  function open() {
    return new Promise(function (resolve, reject) {
      if (!G.indexedDB) { reject(err('idb')); return; }
      var rq = G.indexedDB.open(DB, 1);
      // schema ต้องเหมือน recentDb() ใน craft-app.js (หน้านี้อาจเป็นคนสร้างฐานก่อน)
      rq.onupgradeneeded = function () { if (!rq.result.objectStoreNames.contains('files')) rq.result.createObjectStore('files', { keyPath: 'id' }); };
      rq.onsuccess = function () { resolve(rq.result); };
      rq.onerror = function () { reject(err('idb')); };
    });
  }
  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction('files', mode), out = fn(t.objectStore('files'));
        t.oncomplete = function () { db.close(); resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = t.onabort = function () { db.close(); reject(err('idb')); };
      });
    });
  }

  function put(name, bytes) {
    var buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    if (buf.byteLength > MAX_BYTES) return Promise.reject(err('size'));
    return tx('readwrite', function (st) {
      st.put({ id: ID, app: 'xfer', name: String(name || 'drawing').slice(0, 255), at: Date.now(), size: buf.byteLength, bytes: buf, thumb: '' });
    });
  }

  /* → {name, bytes: ArrayBuffer} หรือ null (ไม่มี/หมดอายุ) — ลบแถวทุกกรณี */
  function take() {
    return tx('readwrite', function (st) {
      var g = st.get(ID);
      g.onsuccess = function () { if (g.result) st.delete(ID); };
      return g;
    }).then(function (r) {
      if (!r || !r.bytes || Date.now() - r.at > MAX_AGE_MS) return null;
      return { name: r.name, bytes: r.bytes };
    });
  }

  return { put: put, take: take, MAX_BYTES: MAX_BYTES };
});
