/* i18n.js — ระบบภาษากลาง ไทย/อังกฤษ (โหลดใน <head> แบบไม่ defer ต่อจาก tanot-data.js ทุกหน้า)
   ภาษาที่เลือกเก็บที่ localStorage['ome:lang'] ('th' ค่าเริ่มต้น | 'en') — theme-boot.js ตั้ง <html lang> ก่อนวาดจอแล้ว

   window.OME_LANG  { get(), set(lang), onChange(fn) → ยกเลิกได้, list }
     · set() เขียนคีย์ → ตั้ง <html lang> → เรียก listener ทุกตัว → ยิง event 'ome:langchange' (detail.lang)
       → เรียก window.omeApplyLang() ของหน้าเดิม (ธรรมเนียมก่อนมีระบบนี้ — 15 หน้าที่รองรับอยู่แล้วยังทำงานเหมือนเดิม)
     · หน้าที่มีปุ่มสลับภาษาของตัวเองแล้วเขียน 'ome:lang' ตรงๆ ก็ทำให้ listener (เมนู/แผงตั้งค่า) เปลี่ยนตามทันที
       (ดักที่ Storage.prototype.setItem เฉพาะคีย์นี้) และแท็บอื่นเปลี่ยนตามผ่าน event 'storage'
   window.OME_I18N  แปลแบบประกาศ + จัดรูปแบบตามภาษา
     · add(ns, { th:{key:'…'}, en:{key:'…'} }) — คีย์เต็ม = '<ns>.<key>'
     · t('ns.key', {ชื่อ: ค่า}) — แทน {ชื่อ} ในข้อความ; ไม่มีคำแปลอังกฤษ = ใช้ไทย; ไม่มีเลย = '' (ไม่แสดงชื่อคีย์)
     · HTML: data-i18n="ns.key" (textContent) · data-i18n-attr="placeholder:ns.key,title:ns.key,aria-label:ns.key"
       แตะเฉพาะคีย์ที่ add() ไว้แล้ว — คีย์อื่นปล่อยข้อความเดิม (15 หน้าเดิมใช้ data-i18n กับพจนานุกรมของตัวเองอยู่
       ระบบกลางจึงต้องไม่ทับ) · apply(root) แปลใหม่ทั้งกิ่ง (เรียกเองหลังวาด DOM ใหม่)
     · data-ome-t="ns.key" = แบบเดียวกับ data-i18n แต่สงวนให้ส่วนกลาง (shell/palette) — หน้าเดิมที่วนแปล
       [data-i18n] ทั้งหน้าด้วยพจนานุกรมของตัวเองจะไม่มาทับข้อความของเมนู/แผงตั้งค่า
     · data-i18n-skip = พื้นที่ที่ไม่ต้องแปล (เนื้อหาบทเรียน/ข้อมูลผู้ใช้/ข่าว/ชื่อเฉพาะ) — ตัวตรวจภาษาใน
       tests/theme-audit.spec.js ข้ามพื้นที่นี้
     · label(node) — ป้ายเมนูตามภาษา (node.labelEn เมื่อเป็น en)
     · scope(ns, {th,en}) — add() แล้วคืนฟังก์ชัน T(key, vars) ที่ผูกกับ ns (ใช้ใน JS ของหน้า: var T = OME_I18N.scope('mypage', {...}))
     · months(style) / weekdays(style) — ชื่อเดือน (index 0 = ม.ค.) / ชื่อวัน (index 0 = อาทิตย์) ตามภาษา style = 'long' | 'short'
     · catName(cat) — ชื่อหมวด budget: หมวดตั้งต้นที่ผู้ใช้ไม่ได้แก้ชื่อแปลตามภาษา · หมวดที่ผู้ใช้ตั้ง/แก้เองคืนชื่อเดิม (ข้อมูลไม่เปลี่ยน แปลเฉพาะตอนแสดง)
     · date(d, opts) / number(n, opts) / money(n, opts) — th = พ.ศ. (th-TH) / en = ค.ศ. (en-GB) */
(function () {
  'use strict';
  var KEY = 'ome:lang';
  var LANGS = ['th', 'en'];
  var doc = document.documentElement;
  var listeners = [];
  var dict = { th: {}, en: {} };
  var inSet = false;

  function norm(v) { return v === 'en' ? 'en' : 'th'; }
  function get() {
    try { return norm(localStorage.getItem(KEY)); } catch (e) { return 'th'; }
  }

  function notify(lang, fromSet) {
    doc.setAttribute('lang', lang);
    applyAll();
    renderLive();
    listeners.slice().forEach(function (fn) {
      try { fn(lang); } catch (e) { if (window.console) console.error(e); }
    });
    try { window.dispatchEvent(new CustomEvent('ome:langchange', { detail: { lang: lang } })); } catch (e) {}
    if (fromSet && typeof window.omeApplyLang === 'function') {
      try { window.omeApplyLang(); } catch (e) { if (window.console) console.error(e); }
    }
  }

  function set(lang) {
    lang = norm(lang);
    inSet = true;
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    inSet = false;
    notify(lang, true);
  }

  function onChange(fn) {
    listeners.push(fn);
    return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
  }

  /* ปุ่มสลับภาษาเดิมของแต่ละหน้าเขียนคีย์เองแล้ววาดหน้าตัวเองใหม่ — แจ้ง listener กลาง (เมนู ฯลฯ) ตามด้วย
     แต่ไม่เรียก omeApplyLang ซ้ำ (หน้านั้นวาดของตัวเองแล้ว) */
  try {
    var proto = window.Storage && Storage.prototype;
    var origSet = proto && proto.setItem;
    if (origSet && !origSet.__omeLang) {
      var patched = function (k, v) {
        if (k !== KEY || inSet || this !== window.localStorage) return origSet.apply(this, arguments);
        var prev = null;
        try { prev = norm(this.getItem(KEY)); } catch (e) {}
        var r = origSet.apply(this, arguments);
        if (norm(String(v)) !== prev) notify(norm(String(v)), false);
        return r;
      };
      patched.__omeLang = true;
      proto.setItem = patched;
    }
  } catch (e) {}
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) notify(norm(e.newValue), true);
  });

  window.OME_LANG = { get: get, set: set, onChange: onChange, list: LANGS };

  /* ── พจนานุกรม ── */
  function add(ns, d) {
    LANGS.forEach(function (l) {
      var src = d && d[l];
      if (!src) return;
      for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) dict[l][ns + '.' + k] = src[k];
    });
    if (document.readyState !== 'loading') apply(document);
  }
  function has(key) { return Object.prototype.hasOwnProperty.call(dict.th, key) || Object.prototype.hasOwnProperty.call(dict.en, key); }
  function fill(s, vars) {
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, function (m, n) { return Object.prototype.hasOwnProperty.call(vars, n) ? vars[n] : m; });
  }
  function lookup(key, lang) {
    var d = dict[lang];
    if (Object.prototype.hasOwnProperty.call(d, key)) return d[key];
    if (lang !== 'th' && Object.prototype.hasOwnProperty.call(dict.th, key)) return dict.th[key];
    return null;
  }
  var warned = {};
  function t(key, vars) {
    var s = lookup(key, get());
    if (s == null) {
      if (!warned[key] && window.console) { warned[key] = 1; console.warn('i18n: ไม่มีคีย์ ' + key); }
      return '';
    }
    return fill(s, vars);
  }

  /* ── แปลแบบประกาศใน HTML — ข้อความเดิมเก็บไว้ใน data-i18n-th เป็นค่าสำรอง (คีย์ไม่มีในพจนานุกรม) ── */
  function applyEl(el, lang) {
    var key = el.getAttribute('data-ome-t') || el.getAttribute('data-i18n');
    if (key && has(key)) el.textContent = lookup(key, lang);
    var attrs = el.getAttribute('data-i18n-attr');
    if (attrs) {
      attrs.split(',').forEach(function (pair) {
        var i = pair.indexOf(':');
        if (i < 0) return;
        var name = pair.slice(0, i).trim(), k = pair.slice(i + 1).trim();
        if (has(k)) el.setAttribute(name, lookup(k, lang));
      });
    }
  }
  function apply(root) {
    root = root || document;
    var lang = get();
    var SEL = '[data-i18n],[data-ome-t],[data-i18n-attr]';
    if (root.nodeType === 1 && root.matches && root.matches(SEL)) applyEl(root, lang);
    var els = root.querySelectorAll ? root.querySelectorAll(SEL) : [];
    for (var i = 0; i < els.length; i++) applyEl(els[i], lang);
  }
  function applyAll() { if (document.body) apply(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyAll);

  /* ข้อความที่สร้างจากสถานะ (บรรทัดสถานะ/จำนวนตัวอักษร/ข้อความแจ้งที่ค้างบนจอ) แปลสดตอนสลับภาษา:
     live(el, fn) — fn() คืนข้อความตามภาษาปัจจุบัน แล้ววาดซ้ำเองทุกครั้งที่สลับ · live(el, null) = หยุดตาม (ข้อความที่ตั้งเองต่อจากนี้ไม่ถูกทับ)
     หน้าที่ฟังการสลับด้วย OME_LANG.onChange เองแล้วตั้ง window.OME_PAGE_LIVE_LANG = true (ตัวตรวจ "สลับภาษาสด" ใช้ธงนี้) */
  var liveEls = [];
  function live(el, fn) {
    if (!el) return;
    var i = liveEls.indexOf(el);
    if (!fn) { el.__omeLive = null; if (i >= 0) liveEls.splice(i, 1); return; }
    el.__omeLive = fn;
    if (i < 0) liveEls.push(el);
    el.textContent = fn();
  }
  function renderLive() {
    liveEls = liveEls.filter(function (el) { return el.__omeLive && el.isConnected; });
    liveEls.forEach(function (el) { try { el.textContent = el.__omeLive(); } catch (e) {} });
  }

  /* ── จัดรูปแบบตามภาษา — th = พ.ศ. (ปฏิทินพุทธของ th-TH) / en = ค.ศ. ── */
  function locale() { return get() === 'en' ? 'en-GB' : 'th-TH'; }
  function date(d, opts) {
    var x = d instanceof Date ? d : new Date(d);
    if (isNaN(x)) return '';
    try { return new Intl.DateTimeFormat(locale(), opts || { day: 'numeric', month: 'short', year: 'numeric' }).format(x); }
    catch (e) { return x.toLocaleDateString(); }
  }
  function number(n, opts) {
    if (n == null || isNaN(n)) return '';
    try { return new Intl.NumberFormat(get() === 'en' ? 'en-US' : 'th-TH', opts).format(n); } catch (e) { return String(n); }
  }
  function money(n, opts) {
    opts = opts || {};
    var dec = opts.decimals == null ? 0 : opts.decimals;
    return number(n, { style: 'currency', currency: opts.currency || 'THB', currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function label(node) {
    if (!node) return '';
    return get() === 'en' && node.labelEn ? node.labelEn : node.label;
  }

  function scope(ns, d) {
    add(ns, d);
    return function (key, vars) { return t(ns + '.' + key, vars); };
  }
  /* ชื่อเดือน/วันจาก Intl ตามภาษา — th = ม.ค./มกราคม, อา./อาทิตย์ · en = Jan/January, Sun/Sunday */
  function months(style) {
    var f = new Intl.DateTimeFormat(locale(), { month: style || 'long' }), out = [];
    for (var i = 0; i < 12; i++) out.push(f.format(new Date(2026, i, 15)));
    return out;
  }
  function weekdays(style) {
    var f = new Intl.DateTimeFormat(locale(), { weekday: style || 'short' }), out = [];
    for (var i = 0; i < 7; i++) out.push(f.format(new Date(2026, 9, 4 + i))); // 2026-10-04 เป็นวันอาทิตย์
    return out;
  }
  /* หมวด budget ตั้งต้น (id + ชื่อไทยเดิมที่ budget.html เขียนลง storage) → ชื่ออังกฤษ */
  var DEFAULT_CATS = {
    'cat-salary': ['เงินเดือน', 'Salary'], 'cat-other-income': ['รายได้อื่นๆ', 'Other income'], 'cat-water': ['ค่าน้ำ', 'Water bill'],
    'cat-cigarette': ['ค่าบุหรี่', 'Cigarettes'], 'cat-alcohol': ['ค่าเหล้า', 'Alcohol'], 'cat-rice': ['ค่าข้าว', 'Meals'],
    'cat-m150': ['ค่าเครื่องดื่ม M-150', 'Energy drinks (M-150)'], 'cat-personal': ['ซื้อของใช้ส่วนตัว', 'Personal items'],
    'cat-fuel': ['เติมน้ำมัน', 'Fuel'], 'cat-ice': ['ค่าน้ำแข็ง', 'Ice'], 'cat-parts': ['ค่าอะไหล่', 'Parts'], 'cat-shopping': ['Shopping', 'Shopping']
  };
  function catName(cat) {
    if (!cat) return '';
    var d = DEFAULT_CATS[cat.id];
    return d && get() === 'en' && cat.name === d[0] ? d[1] : cat.name;
  }

  add('lang', { th: { toggle: 'สลับภาษา' }, en: { toggle: 'Switch language' } }); /* aria-label ของปุ่ม .lang-toggle ทุกหน้า */
  window.OME_I18N = { add: add, t: t, has: has, apply: apply, lang: get, date: date, number: number, money: money, label: label,
    scope: scope, months: months, weekdays: weekdays, catName: catName, live: live };
})();
