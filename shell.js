/* ══════════════════════════════════════════════════════════════════
   Tanot Shell — ปุ่มแฮมเบอร์เกอร์ + เมนูลิ้นชักกลาง + สลับธีมมืด/สว่าง + ลงทะเบียน PWA
   ใช้คู่กับ theme.css — ใส่ <script src="shell.js" defer></script> ในทุกหน้า

   โครงสร้างเมนูทั้งเว็บ (รวมหมวดย่อยการลงทุนที่เดิมอยู่ใน invest-nav.js) นิยามครั้งเดียวที่นี่
   ทุกหน้า (รวมโซนการลงทุน) อ่านจากที่นี่ผ่าน window.INVEST_CATS สำหรับ invest.html's hub tiles
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var BASE = location.pathname.replace(/[^/]*$/, '');
  var HERE = location.pathname.split('/').pop() || 'index.html';
  var HERE_FULL = HERE + location.search; // เทียบกับ href ที่มี query string (เช่น run.html?tool=est-cost) ได้ด้วย
  function hrefMatches(href) { return href === HERE_FULL || href === HERE; }

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

  /* ── โครงสร้างเมนูทั้งเว็บ ──────────────────────────────────────────
     key ไม่ซ้ำกัน, href = ลิงก์ไปหน้านั้น (ไม่ใส่ = เป็นแค่หมวดหมู่ให้กดขยาย),
     icon = ใช้กับ invest.html hub tiles (window.INVEST_CATS), children = รายการย่อย */
  var MENU = [
    { key: 'home', label: 'หน้าหลัก', href: 'index.html' },
    { key: 'documents', label: 'งานที่รับผิดชอบ', children: [
        { key: 'doc-check',  label: 'ตรวจสอบเอกสาร', href: 'doc-check.html' },
        { key: 'word',       label: 'งาน Word', href: 'word.html' },
        { key: 'excel',      label: 'งาน Excel', href: 'excel.html' },
        { key: 'powerpoint', label: 'งาน PowerPoint', href: 'documents.html?soon=powerpoint' },
        { key: 'cad',        label: 'งานเขียนแบบ (CAD)', href: 'documents.html?soon=cad' },
        { key: 'est-cost',   label: 'ประเมินราคา PM/CM', href: 'run.html?tool=est-cost' },
        { key: 'pdf-split',  label: 'แยกหน้า PDF', href: 'run.html?tool=pdf-split' }
      ]
    },
    { key: 'legal', label: 'งานกฎหมาย', href: 'legal.html' },
    { key: 'daily', label: 'ชีวิตประจำวัน', children: [
        { key: 'invest', label: 'การลงทุน', href: 'invest.html', children: [
            { key: 'global-stock', label: 'หุ้นต่างประเทศ',  icon: '🌐', href: 'invest-global-stock.html' },
            { key: 'thai-stock',   label: 'หุ้นไทย',          icon: '📈', href: 'invest-thai-stock.html' },
            { key: 'gold',         label: 'ทองคำ',            icon: '🪙', href: 'invest-gold.html' },
            { key: 'business',     label: 'ลงทุนทำธุรกิจ',    icon: '🏪', href: 'invest-business.html' },
            { key: 'gov-bond',     label: 'พันธบัตรรัฐบาล',   icon: '🏛️', href: 'invest-gov-bond.html' },
            { key: 'gsb-lottery',  label: 'สลากออมสิน',       icon: '🎟️', href: 'invest-gsb-lottery.html' },
            { key: 'baac-lottery', label: 'สลาก ธ.ก.ส.',      icon: '🌾', href: 'invest-baac-lottery.html' },
            { key: 'thai-fund',    label: 'กองทุนไทย',        icon: '📊', href: 'invest-thai-fund.html' },
            { key: 'global-fund',  label: 'กองทุนต่างประเทศ', icon: '🧺', href: 'invest-global-fund.html' },
            { key: 'bitcoin',      label: 'Bitcoin',          icon: '₿', href: 'invest-bitcoin.html' },
            { key: 'lottery',      label: 'สลากกินแบ่งรัฐบาล', icon: '🎰', href: 'invest-lottery.html' }
          ]
        }
      ]
    },
    { key: 'language', label: 'ภาษา', href: 'languages.html' },
    { key: 'classroom', label: 'ห้องเรียน', children: [
        { key: 'classroom-law',         label: 'ความรู้กฎหมาย', href: 'classroom-law.html' },
        { key: 'classroom-business',    label: 'ธุรกิจ',         href: 'classroom-business.html' },
        { key: 'classroom-engineering', label: 'วิศวกรรม',       href: 'classroom-engineering.html' }
      ]
    },
    { key: 'legacy', label: 'เมนูทั้งหมด', href: 'app.html' }
  ];

  /* หมวดย่อยการลงทุน (เดิมมาจาก invest-nav.js) — คงชื่อ window.INVEST_CATS +
     รูปแบบ {key,label,icon,page} เดิม เพื่อไม่ต้องแก้ invest.html's tile-rendering script */
  (function exposeInvestCats() {
    var investNode = null;
    MENU.forEach(function (top) {
      (top.children || []).forEach(function (c) { if (c.key === 'invest') investNode = c; });
    });
    if (!investNode) return;
    window.INVEST_CATS = (investNode.children || []).map(function (c) {
      return { key: c.key, label: c.label, icon: c.icon, page: c.href };
    });
  })();

  /* ── หาว่ากำลังอยู่หน้าไหน + เปิดกลุ่มที่ครอบหน้านั้นไว้ล่วงหน้า ──────── */
  function findActivePath(nodes, path) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.href && hrefMatches(n.href)) { path.push(n); return true; }
      if (n.children && findActivePath(n.children, path)) { path.push(n); return true; }
    }
    return false;
  }
  var activePath = [];
  findActivePath(MENU, activePath); // เรียงจากลึกสุด -> บนสุด

  function renderMenuNodes(nodes, container, depth) {
    nodes.forEach(function (n) {
      var isActive = !!n.href && hrefMatches(n.href);
      var isAncestorOfActive = activePath.indexOf(n) !== -1 && !isActive;
      var row = document.createElement('div');
      row.className = 'ome-menu-row';

      if (n.href) {
        var a = document.createElement('a');
        a.className = 'ome-menu-link' + (isActive ? ' active' : '');
        a.href = BASE + n.href;
        a.innerHTML = (n.icon ? '<span class="ome-menu-ic">' + n.icon + '</span>' : '') + '<span>' + n.label + '</span>';
        row.appendChild(a);
      } else {
        var cat = document.createElement('div');
        cat.className = 'ome-menu-cat';
        cat.textContent = n.label;
        row.appendChild(cat);
      }

      var childrenWrap = null;
      if (n.children && n.children.length) {
        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'ome-menu-toggle';
        toggle.setAttribute('aria-label', 'ขยาย ' + n.label);
        toggle.innerHTML = '▸';
        row.appendChild(toggle);

        childrenWrap = document.createElement('div');
        childrenWrap.className = 'ome-menu-children';
        renderMenuNodes(n.children, childrenWrap, depth + 1);

        var startOpen = isAncestorOfActive;
        if (startOpen) { toggle.classList.add('open'); childrenWrap.classList.add('open'); }

        toggle.addEventListener('click', function () {
          var open = childrenWrap.classList.toggle('open');
          toggle.classList.toggle('open', open);
        });

        /* กดชื่อหมวดที่ไม่มีลิงก์ (เช่น "ชีวิตประจำวัน"/"ห้องเรียน") ก็ขยาย/ยุบได้เหมือนกดลูกศร */
        if (!n.href) {
          row.style.cursor = 'pointer';
          row.addEventListener('click', function (e) {
            if (e.target === toggle) return;
            toggle.click();
          });
        }
      }

      container.appendChild(row);
      if (childrenWrap) container.appendChild(childrenWrap);
    });
  }

  function buildNav() {
    var nav = document.createElement('nav');
    nav.className = 'ome-nav';
    nav.setAttribute('aria-label', 'เมนูหลัก Tanot');

    var hamburger = document.createElement('button');
    hamburger.type = 'button';
    hamburger.className = 'ome-hamburger';
    hamburger.setAttribute('aria-label', 'เปิดเมนู');
    hamburger.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
    nav.appendChild(hamburger);

    var logo = document.createElement('a');
    logo.className = 'ome-nav-logo';
    logo.href = BASE + 'index.html';
    logo.innerHTML = '<span class="dot">T</span><span class="txt">Tanot</span>';
    nav.appendChild(logo);

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

    /* ── ลิ้นชักเมนู ── */
    var backdrop = document.createElement('div');
    backdrop.className = 'ome-drawer-backdrop';

    var drawer = document.createElement('div');
    drawer.className = 'ome-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'เมนู Tanot');

    var head = document.createElement('div');
    head.className = 'ome-drawer-head';
    head.innerHTML = '<a class="brand" href="' + BASE + 'index.html"><span class="dot">T</span><span>Tanot</span></a>';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ome-drawer-close';
    closeBtn.setAttribute('aria-label', 'ปิดเมนู');
    closeBtn.textContent = '✕';
    head.appendChild(closeBtn);
    drawer.appendChild(head);

    var menu = document.createElement('div');
    menu.className = 'ome-menu';
    renderMenuNodes(MENU, menu, 0);
    drawer.appendChild(menu);

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    function openDrawer() { backdrop.classList.add('open'); drawer.classList.add('open'); }
    function closeDrawer() { backdrop.classList.remove('open'); drawer.classList.remove('open'); }

    hamburger.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
    drawer.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a.ome-menu-link')) closeDrawer();
    });
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
