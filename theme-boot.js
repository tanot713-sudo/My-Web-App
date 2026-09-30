/* theme-boot.js — ตั้งธีมก่อนวาดจอ (โหลดใน <head> แบบไม่ defer ก่อน theme.css) กันจอกะพริบ
   และเป็นที่เดียวที่เก็บค่าตั้งธีม: shell.js (แผงตั้งค่า) อ่าน/เขียนผ่าน window.OmeTheme
   ชุดคัดสรร: สีเน้น 5 · สไตล์พื้นผิว 3 · ฟอนต์ 2 — ค่าเดิมที่เคยเลือกไว้ถูกแปลงให้อัตโนมัติครั้งเดียว */
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
    teal: ['#FFFFFF', '#1B2030'], blue: ['#FFFFFF', '#1C2536'], violet: ['#FFFFFF', '#201D33'],
    orange: ['#FFFFFF', '#281F15'], graphite: ['#FFFFFF', '#1C1C1F']
  };
  var DEFAULTS = { accent: 'teal', style: 'flat', font: 'prompt' };

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
    return kind === 'accent' ? ACCENTS.indexOf(v) >= 0 : kind === 'style' ? STYLES.indexOf(v) >= 0 : !!FONTS[v];
  }
  function get(kind) {
    if (kind === 'theme') {
      var t = read('ome:theme');
      if (t === 'light' || t === 'dark') return t;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    var v = read('ome:' + kind);
    if (OLD[kind][v]) { v = OLD[kind][v]; write('ome:' + kind, v); }
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
    var s = { theme: get('theme'), accent: get('accent'), style: get('style'), font: get('font') };
    doc.setAttribute('data-theme', s.theme);
    doc.setAttribute('data-accent', s.accent);
    doc.setAttribute('data-style', s.style);
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
    accents: ACCENTS, styles: STYLES, fonts: FONTS,
    get: get, set: set, apply: apply, loadFont: loadFont,
    onChange: function (fn) { listeners.push(fn); }
  };
  apply();
})();
