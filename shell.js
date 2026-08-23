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
  var HERE_FULL = HERE + location.search; // เทียบกับ href ที่มี query string (เช่น run.html?tool=est-cost)
  var HERE_HASH = HERE + location.hash;    // เทียบกับ href ที่มี hash (เช่น legal.html#plaint)
  var HERE_FULL_HASH = HERE + location.search + location.hash;
  function hrefMatches(href) {
    return href === HERE_FULL || href === HERE || href === HERE_HASH || href === HERE_FULL_HASH;
  }
  function soonHref(label) { return 'soon.html?label=' + encodeURIComponent(label); }

  /* ── วิดเจ็ตแชท AI ลอย (ปุ่ม 💬 มุมขวาล่างทุกหน้า) — เดิมเป็นหน้าแยก ai-chat.html ย้ายมาเป็นวิดเจ็ต
     ลอยแทนตามที่ผู้ใช้ขอ ฉีด <script> เข้าไปจากที่นี่แทนที่จะต้องแก้ <head>/<body> ของทุกหน้า (30+ไฟล์)
     เอง — ตัว ai-chat-widget.js สร้าง DOM/CSS/logic ของวิดเจ็ตเองทั้งหมด ไม่โหลดโมเดล AI ใดๆ ตอนนี้
     (โหลดเฉพาะตอนผู้ใช้กดส่งข้อความ/ใช้ไมค์ครั้งแรกจริงๆ) */
  (function injectAiChatWidget() {
    var s = document.createElement('script');
    s.src = BASE + 'ai-chat-widget.js';
    document.head.appendChild(s);
  })();

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
        { key: 'powerpoint', label: 'งาน PowerPoint', href: soonHref('งาน PowerPoint') },
        { key: 'cad',        label: 'งานเขียนแบบ (CAD)', href: soonHref('งานเขียนแบบ (CAD)') },
        { key: 'est-cost',   label: 'ประเมินราคา PM/CM', href: 'run.html?tool=est-cost' },
        { key: 'extract-text', label: 'ดึงข้อความออกจากเอกสาร', href: 'extract-text.html' }
      ]
    },
    { key: 'data-collect', label: 'รวบรวมข้อมูล', href: soonHref('รวบรวมข้อมูล') },
    { key: 'data-compare', label: 'เปรียบเทียบข้อมูล', href: soonHref('เปรียบเทียบข้อมูล') },
    { key: 'legal', label: 'งานกฎหมาย', children: [
        { key: 'legal-plaint',        label: 'ร่างคำฟ้อง', href: 'legal.html#plaint' },
        { key: 'legal-answer',        label: 'ร่างคำให้การ', href: 'legal.html#answer' },
        { key: 'legal-petition',      label: 'ร่างคำขอ', href: 'legal.html#petition' },
        { key: 'legal-statement',     label: 'ร่างคำแถลง', href: 'legal.html#statement' },
        { key: 'legal-counterclaim',  label: 'ร่างฟ้องแย้ง', href: 'legal.html#counterclaim' },
        { key: 'legal-prayer',        label: 'ร่างคำขอท้ายฟ้อง', href: 'legal.html#prayer' },
        { key: 'legal-police-report', label: 'ร่างเพื่อนำไปแจ้งความ', href: 'legal.html#police-report' }
      ]
    },
    { key: 'language', label: 'ภาษา', href: 'languages.html' },
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
        },
        { key: 'finance',   label: 'รายรับรายจ่าย', href: 'budget.html' },
        { key: 'tts',       label: 'แปลงเสียง ↔ ข้อความ', href: 'text-to-speech.html' },
        { key: 'tax',       label: 'การจ่ายภาษี', href: soonHref('การจ่ายภาษี') },
        { key: 'insurance', label: 'ประกัน', href: soonHref('ประกัน') },
        { key: 'health',    label: 'สุขภาพ', href: soonHref('สุขภาพ') },
        { key: '3d-sim', label: 'จำลอง 3D', children: [
            { key: '3d-objects', label: 'จำลองสิ่งของ', href: 'sim-objects.html' },
            { key: '3d-people',  label: 'จำลองคน', href: soonHref('จำลองคน 3D') }
          ]
        },
        { key: 'games',     label: 'เกมที่เล่น', href: soonHref('เกมที่เล่น') },
        { key: 'cooking',   label: 'เรียนทำอาหาร', href: 'cooking.html' },
        { key: 'books',     label: 'หนังสือ', href: soonHref('หนังสือ') }
      ]
    },
    { key: 'special', label: 'ความสามารถพิเศษ', children: [
        { key: 'music',  label: 'เรียนดนตรี', href: 'music.html' },
        { key: 'sports', label: 'เรียนกีฬา', href: 'sports.html' },
        { key: 'coding', label: 'การเขียนโค้ด', href: 'coding.html' },
        { key: 'typing', label: 'สอนพิมพ์', href: 'typing.html' }
      ]
    },
    { key: 'classroom', label: 'ห้องเรียน', children: [
        { key: 'classroom-law',         label: 'เรียนกฎหมาย', href: 'classroom-law.html' },
        { key: 'classroom-business',    label: 'ธุรกิจ',         href: 'classroom-business.html' },
        { key: 'classroom-engineering', label: 'วิศวกรรม',       href: 'classroom-engineering.html' }
      ]
    }
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

    var gearBtn = document.createElement('button');
    gearBtn.id = 'omeGearBtn';
    gearBtn.className = 'ome-theme-btn';
    gearBtn.setAttribute('aria-label', 'ตั้งค่า');
    gearBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    right.appendChild(gearBtn);

    nav.appendChild(right);

    document.body.insertBefore(nav, document.body.firstChild);

    /* ── แผงตั้งค่า (dropdown เล็กใต้ปุ่มฟันเฟือง) ── */
    var settingsPanel = document.createElement('div');
    settingsPanel.className = 'ome-settings-panel';
    var SETTINGS_ROWS = [
      { ic: '🎨', label: 'เลือกธีมเว็บ' },
      { ic: '🔤', label: 'ปรับขนาดตัวอักษร' },
      { ic: '🗑️', label: 'ล้างข้อมูล' },
      { ic: '❓', label: 'Help', divider: true }
    ];
    SETTINGS_ROWS.forEach(function (r) {
      if (r.divider) {
        var hr = document.createElement('div');
        hr.className = 'ome-settings-divider';
        settingsPanel.appendChild(hr);
      }
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'ome-settings-row';
      row.innerHTML = '<span class="ic">' + r.ic + '</span><span>' + r.label + '</span>';
      settingsPanel.appendChild(row);
    });
    document.body.appendChild(settingsPanel);

    function openSettings() { settingsPanel.classList.add('open'); }
    function closeSettings() { settingsPanel.classList.remove('open'); }
    gearBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      settingsPanel.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!settingsPanel.contains(e.target) && e.target !== gearBtn) closeSettings();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSettings(); });

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

  /* ── ฟุตเตอร์กลางล่างสุดของทุกหน้า — ลิงก์เดียว ไม่มีข้อความอื่นปน ── */
  function buildFooter() {
    var footer = document.createElement('footer');
    footer.className = 'ome-footer';
    var a = document.createElement('a');
    a.href = BASE + 'credits.html';
    a.textContent = 'เครดิต & ลิขสิทธิ์';
    footer.appendChild(a);
    document.body.appendChild(footer);
    stickFooter(footer);
  }

  /* ดัน footer ลงไปติดขอบล่างจริงของจอเมื่อเนื้อหาสั้นกว่า viewport
     ใช้ JS วัด/เติม margin-top แทนการเปลี่ยน display ของ body เป็น flex
     เพราะบางหน้า (เช่น word.html, legal.html) มีเลย์เอาต์ภายในซับซ้อนที่
     ชนกับกลไก sizing ของ flex item — วิธีนี้ไม่แตะ box model ของหน้าเดิมเลย */
  function stickFooter(footer) {
    var pendingRaf = null;
    function apply() {
      if (pendingRaf) cancelAnimationFrame(pendingRaf);
      pendingRaf = requestAnimationFrame(function () {
        pendingRaf = null;
        /* หัก margin-top ที่ใส่ไว้รอบก่อนออกก่อนวัด เพื่อให้เรียก apply() ซ้อนกันกี่ครั้ง/
           กี่จุด (attach ครั้งแรก, resize, load) ก็ได้ผลลัพธ์เดิมเสมอ (idempotent) —
           ถ้าไม่หักออก การเรียกซ้อนกันในเฟรมเดียวกันจะอ่านผลลัพธ์ของตัวเองแล้วคิดว่าไม่มีช่องว่างเหลือ
           ใช้ตำแหน่งจริงของ footer เทียบ viewport แทน document.documentElement.scrollHeight เพราะ
           scrollHeight รวมความสูงของ .ome-drawer/.ome-drawer-backdrop ที่ inset:0 เต็มจอเสมอ
           (แม้ซ่อนอยู่นอกจอด้วย transform/opacity) ทำให้วัดผิดเป็น viewport เต็มตลอด */
        var curMargin = parseFloat(getComputedStyle(footer).marginTop) || 0;
        var naturalBottom = footer.getBoundingClientRect().bottom - curMargin;
        var gap = window.innerHeight - naturalBottom;
        footer.style.marginTop = gap > 0 ? gap + 'px' : '0px';
      });
    }
    apply();
    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(apply, 150);
    });
    window.addEventListener('load', apply);
  }

  /* ── PWA ────────────────────────────────────────────────────────── */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(BASE + 'sw.js').then(function (reg) {
        /* เช็คอัปเดต sw.js ทันทีทุกครั้งที่โหลดหน้า — ปกติเบราว์เซอร์จะเช็คให้เองอัตโนมัติแค่ทุก ~24
           ชั่วโมง (ตาม spec ของ Service Worker) เจอจริงว่าตอน deploy โค้ดใหม่หลายรอบในวันเดียวกัน (ระหว่าง
           debug) ผู้ใช้ปิดเปิดแท็บใหม่แล้วก็ยังเจอโค้ด/แคชเก่าอยู่ดี เพราะ "ปิดเปิดแท็บ" ไม่เท่ากับ "สั่ง
           เช็คอัปเดต SW" — เบราว์เซอร์ยังไม่ครบ 24 ชม. จากครั้งก่อนก็เลยไม่เช็คให้เอง ต้องเรียก
           reg.update() ตรงๆ ถึงจะบังคับเช็คทันทีไม่ติด throttle นี้ (ตาม spec การเรียก update() ตรงๆ
           ข้าม throttle 24 ชม. ที่ใช้กับการเช็คอัตโนมัติของเบราว์เซอร์เองเท่านั้น) */
        reg.update().catch(function () {});
      }).catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { buildNav(); buildFooter(); registerSW(); });
  } else {
    buildNav(); buildFooter(); registerSW();
  }
})();
