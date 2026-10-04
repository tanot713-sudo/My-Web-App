/* หน้า area.html?a=<area> — ไทล์ของแต่ละด้าน อ่านจาก window.OME_MENU (shell.js) ที่เดียว
   ป้ายตามภาษา (label/labelEn ผ่าน OME_I18N.label) — สลับภาษาแล้ววาดใหม่ทันที */
(function () {
  'use strict';
  var BASE = location.pathname.replace(/[^/]*$/, '');
  var a = new URLSearchParams(location.search).get('a') || 'work';
  var I18N = window.OME_I18N || null;
  var TH = { notFound: 'ไม่พบหมวดนี้', home: 'กลับหน้าแรก', soon: 'เร็วๆ นี้' };
  if (I18N) I18N.add('area', { th: TH, en: { notFound: 'Area not found', home: 'Back to home', soon: 'Coming soon' } });
  function t(k) { return I18N ? I18N.t('area.' + k) : TH[k]; }
  function L(n) { return I18N ? I18N.label(n) : n.label; }

  var area = null;
  (window.OME_MENU || []).forEach(function (n) { if (n.area === a && n.children) area = n; });
  var body = document.getElementById('areaBody');

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
      '<span class="tile-title">' + esc(L(n)) + '</span>' +
      (soon ? '<span class="badge">' + esc(t('soon')) + '</span>' : '') + '</a>';
  }
  function render() {
    if (!area) {
      document.getElementById('areaTitle').textContent = t('notFound');
      body.innerHTML = '<div class="empty"><a class="btn" href="' + BASE + 'index.html">' + esc(t('home')) + '</a></div>';
      return;
    }
    document.title = L(area) + ' | Tanot';
    document.getElementById('areaTitle').textContent = L(area);
    var loose = [], html = '';
    area.children.forEach(function (c) {
      if (c.href) { loose.push(c); return; }
      var items = leaves(c, []);
      if (items.length) html += '<section class="area-sec"><h2>' + esc(L(c)) + '</h2><div class="tiles">' + items.map(tile).join('') + '</div></section>';
    });
    if (loose.length) html = '<section class="area-sec"><div class="tiles">' + loose.map(tile).join('') + '</div></section>' + html;
    body.innerHTML = html;
  }
  render();
  if (window.OME_LANG && window.OME_LANG.onChange) window.OME_LANG.onChange(render);
})();
