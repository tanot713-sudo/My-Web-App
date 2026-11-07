/* craft-frame.js — ข้างใน iframe ของ craft-app.js (craft-frame.html?id=<prefix>&host=parent)
   รอ {type:'craft:boot', glue, wasm} จากหน้าแม่ (origin เดียวกันเท่านั้น) → import glue จาก Blob URL → init(wasm)
   แอปอ่าน ?host=parent เองแล้วคุยกับหน้าแม่ด้วย postMessage · ไฟล์ทั้งสองถูกตรวจ sha256 ที่หน้าแม่แล้ว */
(function () {
  'use strict';
  var id = new URLSearchParams(location.search).get('id') || '';
  var parentWin = window.parent;
  if (!/^[a-z][a-z0-9-]{0,40}$/.test(id) || parentWin === window) return;
  var canvas = document.querySelector('canvas');
  canvas.id = id; // แอปหา canvas ด้วย id นี้
  // แอป (eframe) focus canvas เองตอนเริ่ม/ระหว่างทำงาน — ถ้าผู้ใช้กำลังใช้ส่วนอื่นของหน้าแม่ (ลิ้นชักเมนู, แผงตั้งค่า, ปุ่ม)
  // อย่าดึง focus เข้า iframe ไม่งั้นแป้น Escape ฯลฯ ไปไม่ถึงหน้าแม่ · คลิกใน canvas ยังได้ focus ตามปกติ
  canvas.focus = function (opts) {
    try {
      var pd = parentWin.document, ae = pd.activeElement;
      if (ae && ae !== pd.body && ae !== window.frameElement) return;
      if (pd.querySelector('.ome-drawer.open, .ome-settings-panel.open')) return;
    } catch (e) {}
    HTMLElement.prototype.focus.call(this, opts);
  };
  var booted = false;
  function fail() { parentWin.postMessage({ type: 'craft:boot-failed' }, location.origin); }
  window.addEventListener('message', function (ev) {
    if (ev.origin !== location.origin || ev.source !== parentWin) return;
    var d = ev.data || {};
    if (d.type !== 'craft:boot' || booted || !(d.glue instanceof ArrayBuffer) || !(d.wasm instanceof ArrayBuffer)) return;
    booted = true;
    // ธีม (สว่าง/มืด) และภาษาเมนู (ไทย/อังกฤษ) ตามเว็บ: แก้ค่า "theme"/"language" ในค่าที่แอปบันทึกเอง
    // (localStorage[id] — eframe storage) ก่อนแอปเริ่ม · ค่าอื่นที่ผู้ใช้ตั้งในแอปคงเดิม
    var theme = d.theme === 'Light' || d.theme === 'Dark' ? d.theme : null;
    var lang = d.lang === 'th' || d.lang === 'en' ? d.lang : null;
    if (theme || lang) {
      try {
        var saved = {};
        try { saved = JSON.parse(localStorage.getItem(id) || '{}') || {}; } catch (e) {}
        if (typeof saved !== 'object' || Array.isArray(saved)) saved = {};
        if (theme) saved.theme = theme;
        if (lang) saved.language = lang;
        localStorage.setItem(id, JSON.stringify(saved));
      } catch (e) {}
    }
    var u = URL.createObjectURL(new Blob([d.glue], { type: 'text/javascript' }));
    new Function('u', 'return import(u)')(u).then(function (mod) {
      URL.revokeObjectURL(u);
      return mod.default({ module_or_path: d.wasm });
    }).catch(function () { URL.revokeObjectURL(u); fail(); });
  });
  parentWin.postMessage({ type: 'craft:frame-ready' }, location.origin);
})();
