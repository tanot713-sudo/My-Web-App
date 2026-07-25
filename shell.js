/* ══════════════════════════════════════════════════════════════════
   OME Shell — แถบนำทางกลาง + สลับธีมมืด/สว่าง + ลงทะเบียน PWA
   ใช้คู่กับ theme.css — ใส่ <script src="shell.js" defer></script> ในทุกหน้า
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var BASE = location.pathname.replace(/[^/]*$/, '');

  /* ── ธีม: อ่านค่าที่เคยเลือก > ตามระบบ ─────────────────────────── */
  function getTheme() {
    try {
      var saved = localStorage.getItem('ome:theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var btn = document.getElementById('omeThemeBtn');
    if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
  }
  applyTheme(getTheme());

  /* ── เมนูกลาง ───────────────────────────────────────────────────── */
  var LINKS = [
    { href: 'index.html',                    label: 'หน้าหลัก' },
    { href: 'documents.html',                label: 'งานเอกสาร' },
    { href: 'law-business-engineering.html', label: 'ห้องเรียน' },
    { href: 'languages.html',                label: 'ภาษา' },
    { href: 'app.html',                      label: 'เมนูทั้งหมด' }
  ];

  function buildNav() {
    var here = location.pathname.split('/').pop() || 'index.html';
    var nav = document.createElement('nav');
    nav.className = 'ome-nav';
    nav.setAttribute('aria-label', 'เมนูหลัก OME');

    var logo = document.createElement('a');
    logo.className = 'ome-nav-logo';
    logo.href = BASE + 'index.html';
    logo.innerHTML = '<span class="dot">O</span><span class="txt">OME</span>';
    nav.appendChild(logo);

    var links = document.createElement('div');
    links.className = 'ome-nav-links';
    LINKS.forEach(function (l) {
      var a = document.createElement('a');
      a.href = BASE + l.href;
      a.textContent = l.label;
      if (here === l.href) a.className = 'active';
      links.appendChild(a);
    });
    nav.appendChild(links);

    var right = document.createElement('div');
    right.className = 'ome-nav-right';
    var themeBtn = document.createElement('button');
    themeBtn.id = 'omeThemeBtn';
    themeBtn.className = 'ome-theme-btn';
    themeBtn.setAttribute('aria-label', 'สลับโหมดสว่าง/มืด');
    themeBtn.textContent = getTheme() === 'dark' ? '☀️' : '🌙';
    themeBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('ome:theme', next); } catch (e) {}
      applyTheme(next);
    });
    right.appendChild(themeBtn);
    nav.appendChild(right);

    document.body.insertBefore(nav, document.body.firstChild);
  }

  /* ── PWA ────────────────────────────────────────────────────────── */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(BASE + 'sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { buildNav(); registerSW(); });
  } else {
    buildNav(); registerSW();
  }
})();
