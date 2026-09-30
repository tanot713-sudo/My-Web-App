/* ══════════════════════════════════════════════════════════════════
   Tanot palette — ค้นหาด่วน (Ctrl/⌘+K หรือปุ่มค้นหาบน nav) ROADMAP Phase 3
   shell.js โหลดไฟล์นี้ตอนใช้ครั้งแรก (window.openOmePalette) — ค้นหาเมนูจาก window.OME_MENU (นิยามที่ shell.js ที่เดียว)
   + คำสั่ง (เพิ่มรายจ่าย/รายรับ, สลับโหมดสว่าง/มืด) — คำค้นไทย/อังกฤษ ใช้ label + keywords + ชื่อกลุ่ม
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.OmePalette) return;

  var BASE = location.pathname.replace(/[^/]*$/, '');
  var RECENT_KEY = 'ome:palette:recent';
  var MAX_RESULTS = 30;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }
  function icon(name) {
    return '<svg class="ome-icon" aria-hidden="true"><use href="' + BASE + 'icons.svg#i-' + esc(name || 'star') + '"/></svg>';
  }

  /* ── โหลดสคริปต์ของคำสั่งตอนสั่งจริง (quick-add.js) ── */
  var loaded = {};
  function loadScript(file) {
    if (!loaded[file]) {
      loaded[file] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = BASE + file;
        s.onload = resolve;
        s.onerror = function () { delete loaded[file]; reject(new Error(file)); };
        document.head.appendChild(s);
      });
    }
    return loaded[file];
  }
  function quickAdd(type) {
    return function () {
      if (window.OmeQuickAdd) { window.OmeQuickAdd.open({ type: type }); return; }
      loadScript('quick-add.js').then(function () { window.OmeQuickAdd.open({ type: type }); }, function () {});
    };
  }

  /* ── รายการทั้งหมด: หน้าจากเมนู + คำสั่ง ── */
  function pageItems() {
    var out = [];
    (function walk(nodes, trail, inheritedIcon) {
      (nodes || []).forEach(function (n) {
        var ic = n.icon || inheritedIcon;
        if (n.href) {
          out.push({
            id: 'page:' + n.key, kind: 'page', label: n.label, icon: ic, href: n.href, soon: n.status === 'soon',
            group: trail.join(' › '),
            hay: norm(n.label + ' ' + (n.keywords || '') + ' ' + trail.join(' '))
          });
        }
        if (n.children) walk(n.children, trail.concat(n.label), ic);
      });
    })(window.OME_MENU || [], [], null);
    return out;
  }
  function commandItems() {
    var OT = window.OmeTheme;
    return [
      { id: 'cmd:add-expense', kind: 'cmd', label: 'เพิ่มรายจ่าย', icon: 'plus', group: '',
        hay: norm('เพิ่มรายจ่าย บันทึกรายจ่าย ใช้จ่าย จ่ายเงิน expense add spend'), run: quickAdd('expense') },
      { id: 'cmd:add-income', kind: 'cmd', label: 'เพิ่มรายรับ', icon: 'plus', group: '',
        hay: norm('เพิ่มรายรับ บันทึกรายรับ รายได้ เงินเข้า income add'), run: quickAdd('income') },
      { id: 'cmd:theme', kind: 'cmd', label: 'สลับโหมดสว่าง/มืด', icon: 'moon', group: '',
        hay: norm('สลับโหมด สว่าง มืด ธีม dark light theme'),
        run: function () { if (OT) OT.set('theme', document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); } }
    ];
  }

  function loadRecent() {
    try { var r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(r) ? r : []; } catch (e) { return []; }
  }
  function pushRecent(id) {
    try {
      var r = loadRecent().filter(function (x) { return x !== id; });
      r.unshift(id);
      localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 6)));
    } catch (e) {}
  }

  /* ── ค้นหา ── */
  function search(items, q) {
    var tokens = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return null;
    var scored = [];
    items.forEach(function (it, idx) {
      var label = norm(it.label), s = 0;
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (label.indexOf(t) === 0) s += 0;
        else if (label.indexOf(t) > 0) s += 1;
        else if (it.hay.indexOf(t) !== -1) s += 2;
        else return;
      }
      if (it.soon) s += 10;
      if (it.kind === 'cmd') s -= 0.5;
      scored.push({ it: it, s: s, idx: idx });
    });
    scored.sort(function (a, b) { return a.s - b.s || a.idx - b.idx; });
    return scored.slice(0, MAX_RESULTS).map(function (x) { return x.it; });
  }

  /* ── UI ── */
  var root = null, input = null, list = null;
  var items = [], shown = [], active = 0, prevFocus = null, isOpen = false;

  function build() {
    root = document.createElement('div');
    root.className = 'ome-pal';
    root.hidden = true;
    root.innerHTML =
      '<div class="ome-pal-box" role="dialog" aria-modal="true" aria-label="ค้นหา">' +
      '<div class="ome-pal-search">' + icon('search') +
      '<input class="ome-pal-input" type="text" role="combobox" aria-expanded="true" aria-controls="omePalList" aria-autocomplete="list" ' +
      'autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ค้นหาเมนู หน้า หรือคำสั่ง" aria-label="ค้นหา"></div>' +
      '<ul class="ome-pal-list" id="omePalList" role="listbox" aria-label="ผลการค้นหา"></ul></div>';
    document.body.appendChild(root);
    input = root.querySelector('.ome-pal-input');
    list = root.querySelector('.ome-pal-list');

    root.addEventListener('mousedown', function (e) { if (e.target === root) { e.preventDefault(); close(); } });
    input.addEventListener('input', function () { active = 0; render(); });
    input.addEventListener('keydown', onKey);
    list.addEventListener('mousemove', function (e) {
      var li = e.target.closest && e.target.closest('[data-i]');
      if (li) setActive(+li.getAttribute('data-i'), false);
    });
    list.addEventListener('click', function (e) {
      var li = e.target.closest && e.target.closest('[data-i]');
      if (li) choose(+li.getAttribute('data-i'));
    });
  }

  function rowHtml(it, i) {
    return '<li class="ome-pal-row' + (it.soon ? ' soon' : '') + '" role="option" id="omePalOpt' + i + '" data-i="' + i + '" aria-selected="false">' +
      '<span class="ome-pal-ic">' + icon(it.icon) + '</span>' +
      '<span class="ome-pal-main"><span class="ome-pal-label">' + esc(it.label) + '</span>' +
      (it.group ? '<span class="ome-pal-group">' + esc(it.group) + '</span>' : '') + '</span>' +
      (it.soon ? '<span class="ome-pal-tag">เร็วๆ นี้</span>' : '') +
      (it.kind === 'cmd' ? '<span class="ome-pal-tag">คำสั่ง</span>' : '') + '</li>';
  }

  function render() {
    var q = input.value, html = '';
    var found = search(items, q);
    if (found) {
      shown = found;
      html = found.map(rowHtml).join('');
      if (!found.length) html = '<li class="ome-pal-empty" role="presentation">ไม่พบผลลัพธ์</li>';
    } else {
      // ยังไม่พิมพ์: คำสั่ง → ที่เปิดล่าสุด → หมวดหลัก
      var byId = {}; items.forEach(function (it) { byId[it.id] = it; });
      var cmds = items.filter(function (it) { return it.kind === 'cmd'; });
      var recents = loadRecent().map(function (id) { return byId[id]; }).filter(function (it) { return it && it.kind === 'page'; });
      var areas = items.filter(function (it) { return it.kind === 'page' && /^(home|work|life|edu|hobby|settings)$/.test(it.id.slice(5)) && recents.indexOf(it) === -1; });
      shown = []; html = '';
      [['คำสั่ง', cmds], ['เปิดล่าสุด', recents], ['หมวดหลัก', areas]].forEach(function (sec) {
        if (!sec[1].length) return;
        html += '<li class="ome-pal-sec" role="presentation">' + sec[0] + '</li>';
        sec[1].forEach(function (it) { html += rowHtml(it, shown.length); shown.push(it); });
      });
    }
    list.innerHTML = html;
    if (active >= shown.length) active = 0;
    setActive(active, true);
  }

  function setActive(i, scroll) {
    var rows = list.querySelectorAll('[data-i]');
    active = i;
    for (var k = 0; k < rows.length; k++) {
      var on = +rows[k].getAttribute('data-i') === i;
      rows[k].classList.toggle('on', on);
      rows[k].setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && scroll && rows[k].scrollIntoView) rows[k].scrollIntoView({ block: 'nearest' });
    }
    if (shown.length) input.setAttribute('aria-activedescendant', 'omePalOpt' + i); else input.removeAttribute('aria-activedescendant');
  }

  function onKey(e) {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (shown.length) setActive((active + 1) % shown.length, true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (shown.length) setActive((active - 1 + shown.length) % shown.length, true); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); } // โฟกัสอยู่ที่ช่องค้นหาตลอด (ตัวเลือกเลือกด้วยลูกศร)
  }

  function choose(i) {
    var it = shown[i];
    if (!it) return;
    close();
    if (it.kind === 'cmd') { it.run(); return; }
    pushRecent(it.id);
    location.href = BASE + it.href;
  }

  function open() {
    if (isOpen) { input.focus(); return; }
    if (!root) build();
    items = commandItems().concat(pageItems());
    isOpen = true;
    prevFocus = document.activeElement;
    input.value = '';
    active = 0;
    root.hidden = false;
    render();
    input.focus();
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.hidden = true;
    if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) {} }
  }
  function toggle() { if (isOpen) close(); else open(); }

  window.OmePalette = { open: open, close: close, toggle: toggle, _search: function (q) { return search(commandItems().concat(pageItems()), q); } };
})();
