/* craft-frame.js — ข้างใน iframe ของ craft-app.js (craft-frame.html?id=<prefix>&host=parent)
   รอ {type:'craft:boot', glue, wasm} จากหน้าแม่ (origin เดียวกันเท่านั้น) → import glue จาก Blob URL → init(wasm)
   แอปอ่าน ?host=parent เองแล้วคุยกับหน้าแม่ด้วย postMessage · ไฟล์ทั้งสองถูกตรวจ sha256 ที่หน้าแม่แล้ว */
(function () {
  'use strict';
  var id = new URLSearchParams(location.search).get('id') || '';
  var parentWin = window.parent;
  if (!/^[a-z][a-z0-9-]{0,40}$/.test(id) || parentWin === window) return;
  document.querySelector('canvas').id = id; // แอปหา canvas ด้วย id นี้
  var booted = false;
  function fail() { parentWin.postMessage({ type: 'craft:boot-failed' }, location.origin); }
  window.addEventListener('message', function (ev) {
    if (ev.origin !== location.origin || ev.source !== parentWin) return;
    var d = ev.data || {};
    if (d.type !== 'craft:boot' || booted || !(d.glue instanceof ArrayBuffer) || !(d.wasm instanceof ArrayBuffer)) return;
    booted = true;
    var u = URL.createObjectURL(new Blob([d.glue], { type: 'text/javascript' }));
    new Function('u', 'return import(u)')(u).then(function (mod) {
      URL.revokeObjectURL(u);
      return mod.default({ module_or_path: d.wasm });
    }).catch(function () { URL.revokeObjectURL(u); fail(); });
  });
  parentWin.postMessage({ type: 'craft:frame-ready' }, location.origin);
})();
