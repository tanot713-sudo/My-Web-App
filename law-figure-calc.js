/* ช่องรูปประกอบในบทเรียนกฎหมาย (classroom-law) — ตรรกะล้วน ไม่มี DOM/storage (UMD, window.LawFigureCalc)
   ในเนื้อหาบทเรียน (markdown-lite) บรรทัด `@image <key>` หรือ `@image <key> | คำบรรยายสั้น` = จุดวางรูป
   key = a-z 0-9 - _ ≤ 40 ตัว (สื่อความหมาย เช่น void-voidable) — ผิดรูปแบบ = ข้อความธรรมดา
   การผูกรูป: คีย์ sync map `tanot:law:figures` { '<id วิชา>|<key>': {id, name, mime} } (id = ไฟล์ R2 ns images — ไม่เก็บ Blob) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.LawFigureCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var RE = /^@image\s+([a-z0-9_-]{1,40})(?:\s*\|\s*(.*))?$/;
  function match(line) {
    var m = RE.exec(String(line).replace(/\s+$/, ''));
    return m ? { key: m[1], caption: (m[2] || '').trim().slice(0, 120) } : null;
  }
  function split(md) {
    var out = [], buf = [];
    function flush() { if (buf.length) { out.push({ type: 'md', text: buf.join('\n') }); buf = []; } }
    String(md || '').split('\n').forEach(function (l) {
      var m = match(l);
      if (m) { flush(); out.push({ type: 'img', key: m.key, caption: m.caption }); } else buf.push(l);
    });
    flush();
    return out.filter(function (p) { return p.type === 'img' || p.text !== ''; });
  }
  function strip(md) {
    return String(md || '').split('\n').filter(function (l) { return !match(l); }).join('\n');
  }
  function keys(md) {
    var seen = {}, out = [];
    split(md).forEach(function (p) { if (p.type === 'img' && !seen[p.key]) { seen[p.key] = 1; out.push(p.key); } });
    return out;
  }
  function mapKey(subjectId, key) { return subjectId + '|' + key; }
  function clean(v) {
    if (!v || typeof v !== 'object') return null;
    var id = String(v.id || ''), mime = String(v.mime || '');
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || !/^image\/(png|jpeg|webp|gif)$/.test(mime)) return null;
    return { id: id, name: String(v.name || '').slice(0, 120), mime: mime };
  }
  function fileUrl(id) { return '/api/files?id=' + encodeURIComponent(id); }
  return { match: match, split: split, strip: strip, keys: keys, mapKey: mapKey, clean: clean, fileUrl: fileUrl };
});
