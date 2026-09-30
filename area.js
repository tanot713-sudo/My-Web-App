/* หน้า area.html?a=<area> — ไทล์ของแต่ละด้าน อ่านจาก window.OME_MENU (shell.js) ที่เดียว */
(function () {
  'use strict';
  var BASE = location.pathname.replace(/[^/]*$/, '');
  var a = new URLSearchParams(location.search).get('a') || 'work';
  var area = null;
  (window.OME_MENU || []).forEach(function (n) { if (n.area === a && n.children) area = n; });
  var body = document.getElementById('areaBody');
  if (!area) {
    document.getElementById('areaTitle').textContent = 'ไม่พบหมวดนี้';
    body.innerHTML = '<div class="empty"><a class="btn" href="' + BASE + 'index.html">กลับหน้าแรก</a></div>';
    return;
  }
  document.title = area.label + ' | Tanot';
  document.getElementById('areaTitle').textContent = area.label;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* ใบไม้ของกลุ่ม (ข้ามกลุ่มย่อยที่ไม่มีลิงก์ เช่น จำลอง 3D) — กลุ่มที่มี href (การลงทุน) เป็นไทล์เดียว */
  function leaves(n, out) {
    (n.children || []).forEach(function (c) {
      if (c.href) out.push(c); else leaves(c, out);
    });
    return out;
  }
  function tile(n) {
    var soon = n.status === 'soon';
    return '<a class="tile' + (soon ? ' soon' : '') + '" href="' + BASE + n.href + '">' +
      '<svg class="ome-icon" aria-hidden="true"><use href="' + BASE + 'icons.svg#i-' + (n.icon || 'star') + '"/></svg>' +
      '<span class="tile-title">' + esc(n.label) + '</span>' +
      (soon ? '<span class="badge">เร็วๆ นี้</span>' : '') + '</a>';
  }
  var loose = [], html = '';
  area.children.forEach(function (c) {
    if (c.href) { loose.push(c); return; }
    var items = leaves(c, []);
    if (items.length) html += '<section class="area-sec"><h2>' + esc(c.label) + '</h2><div class="tiles">' + items.map(tile).join('') + '</div></section>';
  });
  if (loose.length) html = '<section class="area-sec"><div class="tiles">' + loose.map(tile).join('') + '</div></section>' + html;
  body.innerHTML = html;
})();
