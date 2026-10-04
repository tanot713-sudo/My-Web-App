/* หน้า area.html?a=<area> — ไทล์ของแต่ละด้าน อ่านจาก window.OME_MENU (shell.js) ที่เดียว
   ป้ายตามภาษา (label/labelEn ผ่าน OME_I18N.label) — สลับภาษาแล้ววาดใหม่ทันที
   โครง (รอบ 3): แถว "ใช้ล่าสุด" 4 ไทล์ (จาก tanot:nav:last ที่ shell.js เขียน กรองเฉพาะหน้าที่อยู่ในหมวดนี้ · ไม่มีข้อมูล = ไม่แสดงแถว)
   แล้วกลุ่มเป็นกล่องวางเป็นคอลัมน์ (CSS columns) · ไทล์แบบแถว ลำดับในกลุ่มคงที่ตาม MENU (ไม่สลับตามการใช้งาน) · รายการ status 'soon' จางไว้ท้ายกลุ่ม
   คำอธิบายสั้นใต้ชื่อ: แสดงเมื่อโหนดใน MENU มี desc/descEn (ตอนนี้ยังไม่มีโหนดไหนมี — ไม่เพิ่มข้อความอธิบาย) */
(function () {
  'use strict';
  var BASE = location.pathname.replace(/[^/]*$/, '');
  var a = new URLSearchParams(location.search).get('a') || 'work';
  var I18N = window.OME_I18N || null;
  var TH = { notFound: 'ไม่พบหมวดนี้', home: 'กลับหน้าแรก', soon: 'เร็วๆ นี้', latest: 'ใช้ล่าสุด', openedAt: 'เปิดล่าสุด {when}' };
  if (I18N) I18N.add('area', { th: TH, en: { notFound: 'Area not found', home: 'Back to home', soon: 'Coming soon', latest: 'Recently used', openedAt: 'Opened {when}' } });
  function t(k, v) { return I18N ? I18N.t('area.' + k, v) : TH[k]; }
  function L(n) { return I18N ? I18N.label(n) : n.label; }
  function D(n) { return ((I18N && I18N.lang() === 'en' ? n.descEn : n.desc) || n.desc || '') || ''; }

  var area = null;
  (window.OME_MENU || []).forEach(function (n) { if (n.area === a && n.children) area = n; });
  var body = document.getElementById('areaBody');
  var HM = window.HomeCalc;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function navMap() { try { var m = JSON.parse(localStorage.getItem('tanot:nav:last') || 'null'); return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; } }
  function ago(ts) {
    var s = Math.max(0, (Date.now() - ts) / 1000), units = [['day', 86400], ['hour', 3600], ['minute', 60]];
    try {
      var f = new Intl.RelativeTimeFormat(I18N ? I18N.lang() : 'th', { numeric: 'auto' });
      for (var i = 0; i < units.length; i++) if (s >= units[i][1]) return f.format(-Math.floor(s / units[i][1]), units[i][0]);
      return f.format(0, 'minute');
    } catch (e) { return ''; }
  }
  /* ใบไม้ของกลุ่ม (ข้ามกลุ่มย่อยที่ไม่มีลิงก์ เช่น จำลอง 3D) — กลุ่มที่มี href (การลงทุน) เป็นไทล์เดียว */
  function leaves(n, out) {
    (n.children || []).forEach(function (c) { if (c.href) out.push(c); else leaves(c, out); });
    return out;
  }
  /* ทุกโหนดที่มี href ในหมวด (รวมลูกของโหนดที่มี href เอง เช่นหน้าย่อยของการลงทุน) พร้อมไอคอนที่สืบจากบรรพบุรุษ — ใช้หาหน้าที่เปิดล่าสุด */
  function allPages(n, icon, parent, out) {
    (n.children || []).forEach(function (c) {
      var ic = c.icon || icon;
      if (c.href && c.status !== 'soon') out.push({ node: c, icon: ic, parent: n });
      allPages(c, ic, n, out);
    });
    return out;
  }
  function icon(name) { return '<svg class="ome-icon" aria-hidden="true"><use href="' + BASE + 'icons.svg#i-' + (name || 'star') + '"/></svg>'; }
  function tile(n, extra, ic) {
    var soon = n.status === 'soon', d = D(n);
    return '<a class="tile row' + (soon ? ' soon' : '') + '" href="' + BASE + (extra && extra.href ? extra.href : n.href) + '"><span class="tile-ic">' + icon(ic || n.icon) + '</span>' +
      '<span class="tile-text"><span class="tile-title">' + esc(extra && extra.label ? extra.label : L(n)) + '</span>' +
      (d ? '<span class="tile-desc">' + esc(d) + '</span>' : '') + (extra && extra.meta ? '<span class="tile-desc">' + esc(extra.meta) + '</span>' : '') + '</span>' +
      (soon ? '<span class="badge">' + esc(t('soon')) + '</span>' : '') + '</a>';
  }
  /* ใช้ล่าสุด: หน้าเดียวกันที่มีหลายรายการในเมนู (เช่น ร่างเอกสารกฎหมาย ×7) แสดงเป็นชื่อกลุ่มแม่ + ลิงก์หน้าเดียว */
  function latestHtml() {
    if (!HM) return '';
    var pages = allPages(area, area.icon, area, []), by = {}, hrefs = [];
    pages.forEach(function (p) {
      var base = p.node.href.split('#')[0].split('?')[0];
      (by[base] = by[base] || []).push(p);
      if (by[base].length === 1) hrefs.push(base);
    });
    var nav = navMap();
    var items = HM.lastUsed(nav, hrefs, 4);
    if (!items.length) return '';
    return '<section class="area-sec" aria-labelledby="hLatest"><h2 id="hLatest">' + esc(t('latest')) + '</h2><div class="tile-latest" id="latestRow">' + items.map(function (it) {
      var list = by[it.href], first = list[0], multi = list.length > 1;
      var node = multi ? first.parent : first.node;
      return tile(node, { href: multi ? it.href : first.node.href, meta: t('openedAt', { when: ago(it.ts) }) }, multi ? (first.parent.icon || first.icon) : first.icon);
    }).join('') + '</div></section>';
  }
  function groupHtml(title, items) {
    // soon ไว้ท้ายกลุ่ม (ลำดับอื่นคงตาม MENU)
    var ordered = items.filter(function (n) { return n.status !== 'soon'; }).concat(items.filter(function (n) { return n.status === 'soon'; }));
    return '<section class="card tile-group"' + (title ? ' aria-label="' + esc(title) + '"' : '') + '>' + (title ? '<h2>' + esc(title) + '</h2>' : '') + ordered.map(function (n) { return tile(n); }).join('') + '</section>';
  }
  function render() {
    if (!area) {
      document.getElementById('areaTitle').textContent = t('notFound');
      body.innerHTML = '<div class="empty"><a class="btn" href="' + BASE + 'index.html">' + esc(t('home')) + '</a></div>';
      return;
    }
    document.title = L(area) + ' | Tanot';
    document.getElementById('areaTitle').textContent = L(area);
    var loose = [], groups = [];
    area.children.forEach(function (c) {
      if (c.href) { loose.push(c); return; }
      var items = leaves(c, []);
      if (items.length) groups.push(groupHtml(L(c), items));
    });
    var cols = (loose.length ? groupHtml('', loose) : '') + groups.join('');
    body.innerHTML = latestHtml() + '<div class="tile-cols" id="areaGroups">' + cols + '</div>';
  }
  render();
  if (window.OME_LANG && window.OME_LANG.onChange) window.OME_LANG.onChange(render);
})();
