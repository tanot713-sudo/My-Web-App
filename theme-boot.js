/* theme-boot.js — ตั้งธีมก่อนวาดจอ (โหลดใน <head> แบบไม่ defer ก่อน theme.css) กันจอกะพริบ
   และเป็นที่เดียวที่เก็บค่าตั้งธีม: shell.js (แผงตั้งค่า) อ่าน/เขียนผ่าน window.OmeTheme
   ชุดคัดสรร: สีเน้น 5 · สไตล์พื้นผิว 3 · ฟอนต์ 2 — ค่าเดิมที่เคยเลือกไว้ถูกแปลงให้อัตโนมัติครั้งเดียว
   + ภาพพื้นหลังรายหน้า (data-bg บน <html>, ปิดได้ด้วย 'ome:bg' = 'off') + <html lang> จาก 'ome:lang' */
(function () {
  var doc = document.documentElement;
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var ACCENTS = ['teal', 'blue', 'violet', 'orange', 'graphite'];
  var STYLES = ['flat', 'soft', 'outline'];
  var FONTS = {
    prompt: { family: "'Prompt',system-ui,-apple-system,sans-serif", google: 'Prompt:wght@300;400;500;600;700' },
    ibmplex: { family: "'IBM Plex Sans Thai',system-ui,-apple-system,sans-serif", google: 'IBM+Plex+Sans+Thai:wght@300;400;500;600;700' }
  };
  /* สีแถบเบราว์เซอร์ (theme-color) = สีพื้น nav (--ome-card) ของแต่ละสีเน้น [สว่าง, มืด] */
  var BAR = {
    teal: ['#FFFFFF', '#1F2536'], blue: ['#FFFFFF', '#202A3E'], violet: ['#FFFFFF', '#24203A'],
    orange: ['#FFFFFF', '#2C2219'], graphite: ['#FFFFFF', '#212125']
  };
  var DEFAULTS = { accent: 'teal', style: 'flat', font: 'prompt', bg: 'on' };

  /* ── ภาพพื้นหลังรายหน้า: แผนที่ชื่อหน้า → กลุ่มภาพ (ที่เดียวของทั้งเว็บ) ──
     ภาพ = assets/backgrounds/<กลุ่ม>-light.webp / <กลุ่ม>-dark.webp — เปลี่ยนภาพได้ด้วยการแทนไฟล์อย่างเดียว
     หน้าที่ไม่อยู่ในแผนที่ = ไม่มีภาพ · invest*.html ทุกหน้าใช้กลุ่ม invest (ดู bgGroup) */
  var BG_GROUPS = {
    today: ['index'],
    documents: ['word', 'excel', 'slides', 'extract-text', 'doc-check', 'doc-check-file', 'compare'],
    engineering: ['cad', 'electrical', 'maintenance', 'run'],
    report: ['report-dashboard'],
    law: ['legal', 'classroom-law'],
    money: ['budget', 'tax', 'insurance', 'receipts'],
    health: ['health'],
    car: ['car'],
    education: ['review', 'classroom-business', 'classroom-engineering', 'books', 'languages'],
    music: ['music'],
    sports: ['sports'],
    cooking: ['cooking'],
    coding: ['coding', 'typing'],
    settings: ['notifications', 'data', 'credits', 'area', 'soon', 'image-gen']
  };
  var BG_OF = {};
  for (var g in BG_GROUPS) for (var gi = 0; gi < BG_GROUPS[g].length; gi++) BG_OF[BG_GROUPS[g][gi]] = g;
  /* ชื่อหน้า (ไม่มี .html) จาก path — Pages ตัด .html ออกจาก URL ได้ และ "/" = index */
  function pageName(pathname) {
    var f = String(pathname || '').split('/').pop() || 'index';
    return f.replace(/\.html?$/, '') || 'index';
  }
  function bgGroup(pathname) {
    var n = pageName(pathname == null ? location.pathname : pathname);
    if (/^invest(-|$)/.test(n)) return 'invest';
    return BG_OF.hasOwnProperty(n) ? BG_OF[n] : null;
  }

  /* ── แปลงค่าเดิม ── */
  var OLD = {
    accent: { mint: 'teal', coach: 'teal', skypastel: 'blue', crypto: 'blue', glass: 'blue',
      finset: 'violet', bubblegum: 'violet', construct: 'orange', flooks: 'orange', gymes: 'orange' },
    style: { glass: 'soft', neumorph: 'soft', clay: 'soft', mica: 'soft', aurora: 'soft', neubrutal: 'outline' },
    font: { sarabun: 'ibmplex', notosans: 'ibmplex', kanit: 'prompt', mitr: 'prompt' }
  };
  /* เฟส 4 เคยเก็บสีไว้ใน 'ome:theme' (เช่น 'flooks') — ย้ายไป 'ome:accent' แล้วรีเซ็ตเป็นสว่าง */
  var legacy = read('ome:theme');
  if (legacy && legacy !== 'light' && legacy !== 'dark') {
    if (!read('ome:accent')) write('ome:accent', legacy);
    write('ome:theme', 'light');
  }
  function valid(kind, v) {
    if (kind === 'bg') return v === 'on' || v === 'off';
    return kind === 'accent' ? ACCENTS.indexOf(v) >= 0 : kind === 'style' ? STYLES.indexOf(v) >= 0 : !!FONTS[v];
  }
  function get(kind) {
    if (kind === 'theme') {
      var t = read('ome:theme');
      if (t === 'light' || t === 'dark') return t;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    var v = read('ome:' + kind);
    if (OLD[kind] && OLD[kind][v]) { v = OLD[kind][v]; write('ome:' + kind, v); }
    return valid(kind, v) ? v : DEFAULTS[kind];
  }

  var loaded = {};
  /* โหลดฟอนต์จาก Google Fonts ครั้งเดียว — ถ้าหน้ามี <link> ของฟอนต์นั้นอยู่แล้วก็ไม่โหลดซ้ำ */
  function loadFont(google) {
    if (loaded[google]) return;
    loaded[google] = true;
    var name = google.split(':')[0];
    var links = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
    for (var i = 0; i < links.length; i++) { if (links[i].href.indexOf('family=' + name) >= 0) return; }
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + google + '&display=swap';
    document.head.appendChild(l);
  }

  function setBarColor(accent, theme) {
    var color = BAR[accent][theme === 'dark' ? 1 : 0];
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    if (!metas.length) {
      var m = document.createElement('meta');
      m.name = 'theme-color';
      document.head.appendChild(m);
      metas = [m];
    }
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', color);
  }

  var listeners = [];
  function apply() {
    var s = { theme: get('theme'), accent: get('accent'), style: get('style'), font: get('font'), bg: get('bg') };
    doc.setAttribute('data-theme', s.theme);
    doc.setAttribute('data-accent', s.accent);
    doc.setAttribute('data-style', s.style);
    /* ภาพพื้นหลัง: CSS ใน theme.css เลือกไฟล์ -light/-dark ตาม data-theme เอง โหลดเฉพาะภาพของหน้านี้
       (?embed=1 = หน้าที่ฝังในป๊อปอัพ ไม่ใส่ภาพซ้อนกับหน้าแม่) */
    var grp = s.bg === 'on' && !/[?&]embed=1(&|$)/.test(location.search) ? bgGroup() : null;
    if (grp) doc.setAttribute('data-bg', grp); else doc.removeAttribute('data-bg');
    doc.style.setProperty('--ome-f', FONTS[s.font].family);
    if (s.font !== 'prompt') loadFont(FONTS[s.font].google);
    setBarColor(s.accent, s.theme);
    return s;
  }
  function set(kind, v) {
    if (kind === 'theme' ? (v !== 'light' && v !== 'dark') : !valid(kind, v)) return;
    write('ome:' + kind, v);
    var s = apply();
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](s, kind); } catch (e) {} }
  }

  window.OmeTheme = {
    accents: ACCENTS, styles: STYLES, fonts: FONTS, bgGroups: BG_GROUPS,
    get: get, set: set, apply: apply, loadFont: loadFont, bgGroup: bgGroup,
    onChange: function (fn) { listeners.push(fn); }
  };
  apply();

  /* ภาษา: ตั้ง <html lang> ก่อนวาดจอ (i18n.js ดูแลการสลับ/คำแปลต่อ) — อ่าน 'ome:lang' ตรงนี้ได้เพราะเป็นค่าเดียวกับ OME_LANG */
  var lang = read('ome:lang');
  doc.setAttribute('lang', lang === 'en' ? 'en' : 'th');
})();
