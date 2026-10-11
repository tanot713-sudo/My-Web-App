/* ══════════════════════════════════════════════════════════════════
   session-guard.js — ตัดสินว่าเซสชัน Cloudflare Access หมดอายุ "จริง" หรือไม่ จากหน้าเว็บเอง (window.TanotSession)
   ใช้ 2 ทาง:
   1) sw.js เดาว่าหมดอายุ (fetch('/api/session') ของ SW ได้ opaqueredirect/401/403) → เสิร์ฟหน้าจากแคชพร้อมแถบแบบซ่อน
      แล้วฝังไฟล์นี้ (อ่านจากแคช) + เรียก TanotSession.guard(cfg) ท้าย <body>:
      · หน้าเว็บ fetch /api/session เองได้ {email} = ไม่ได้หมดอายุ → บอก SW (postMessage 'tanot:session' ok) ให้เชื่อ
        ไป 10 นาที แล้วโหลดหน้าจริงจากเครือข่าย 1 ครั้ง (ถ้า SW ไม่ตอบ/โหลดซ้ำภายใน 30 วิ = ไปทาง ?swnet=1 ซึ่ง SW
        ปล่อยผ่านเครือข่ายตรงๆ — วนซ้ำไม่ได้)
      · หน้าเว็บก็เข้าไม่ได้ = หมดอายุจริง → แสดงแถบ (+ จำนวนรายการรอซิงก์จากคิว tanot-sync:dirty เฉพาะจำนวน)
   2) ปุ่ม "เข้าสู่ระบบใหม่" = ไปหน้าเดิม ?relogin=1 (SW ปล่อยผ่านเครือข่าย → Access พาไปล็อกอินถ้าคุกกี้หมดอายุ)
      shell.js โหลดไฟล์นี้เมื่อ URL มี relogin/swnet → landing(): ลบพารามิเตอร์ออกจาก URL แล้วตรวจซ้ำ
      · ผ่าน = บอก SW + ส่งคิวซิงก์ทันที (TanotData.syncNow)
      · relogin=1 ยังไม่ผ่าน (navigate ธรรมดาไม่ได้พาไปล็อกอิน — คุกกี้ค้างครึ่งๆ) → fetch /cdn-cgi/access/logout
        (redirect:'manual' — ล้างคุกกี้ของแอปโดยไม่พาหน้าไปค้างที่หน้า logout) แล้วไปหน้าเดิม ?relogin=2 → Access ต้องพาไปล็อกอิน
      · relogin=2 ยังไม่ผ่าน = แจ้ง (toast) ไม่วนต่อ
   บันทึกปัญหา: ทุกครั้งที่ SW ตัดสินว่าหมดอายุ + ผลตรวจของหน้าเว็บ ลง 'tanot:media:log' (kind 'session', รูปแบบเดียวกับ
   media-core.js logNote — มีแค่ type/status/จำนวน ไม่มีอีเมล/ข้อมูลผู้ใช้) ดู/คัดลอกได้ที่ data.html
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.TanotSession) return;

  var CHECK_URL = '/api/session?via=page';
  var LOGOUT_URL = '/cdn-cgi/access/logout';
  var LOG_KEY = 'tanot:media:log', LOG_MAX = 50;
  var RELOAD_GUARD = 'tanot:session:reload'; // sessionStorage — กันโหลดหน้าจริงซ้ำวน
  var DICT = {
    th: {
      expired: 'เซสชันหมดอายุ — กำลังแสดงหน้าจากแคช',
      pending: 'มี {n} รายการยังไม่ซิงก์ — เข้าสู่ระบบใหม่เพื่อส่ง',
      relogin: 'เข้าสู่ระบบใหม่',
      failed: 'ยังเข้าสู่ระบบไม่ได้ — ลองออกจากระบบแล้วเข้าใหม่'
    },
    en: {
      expired: 'Session expired — showing the cached page',
      pending: '{n} items not synced yet — sign in again to send them',
      relogin: 'Sign in again',
      failed: 'Still not signed in — try signing out and in again'
    }
  };
  var T = window.OME_I18N && window.OME_I18N.scope ? window.OME_I18N.scope('session', DICT) : function (k, v) {
    var en = String(document.documentElement.lang || '').slice(0, 2) === 'en';
    return String((en ? DICT.en : DICT.th)[k] || '').replace(/\{(\w+)\}/g, function (m, n) { return v && v[n] != null ? v[n] : m; });
  };

  /* หน้าเว็บถาม /api/session เอง — ok = ได้ JSON ที่มี email (ไม่เก็บ/ไม่บันทึกอีเมล) */
  function check() {
    return fetch(CHECK_URL, { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' }).then(function (r) {
      var res = { ok: false, type: r.type, status: r.status };
      if (!r.ok) return res;
      return r.json().then(function (j) { res.ok = !!(j && j.email); return res; }, function () { return res; });
    }, function () { return { ok: false, type: 'error', status: 0 }; });
  }

  /* บอก SW ผลตรวจ — คืน true เมื่อ SW ตอบรับ (เขียนสถานะลงแคชแล้ว) */
  function tellSw(ok) {
    return new Promise(function (resolve) {
      var c = navigator.serviceWorker && navigator.serviceWorker.controller;
      if (!c || !window.MessageChannel) { resolve(false); return; }
      var ch = new MessageChannel(), done = false;
      function fin(v) { if (!done) { done = true; resolve(v); } }
      ch.port1.onmessage = function () { fin(true); };
      setTimeout(function () { fin(false); }, 1500);
      try { c.postMessage({ type: 'tanot:session', ok: !!ok }, [ch.port2]); } catch (e) { fin(false); }
    });
  }

  function dirtyCount() {
    try {
      if (window.TanotData && window.TanotData.status) return window.TanotData.status().pending || 0;
      var m = JSON.parse(localStorage.getItem('tanot-sync:dirty') || '{}');
      return m && typeof m === 'object' ? Object.keys(m).length : 0;
    } catch (e) { return 0; }
  }

  /* แถวเดียวกับ TanotMedia.logNote/logError (media-core.js) — ไฟล์นี้อาจรันก่อน media-core.js จึงเขียนเอง */
  function log(stage, code, msg) {
    try {
      var rows = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      if (!Array.isArray(rows)) rows = [];
      rows.push({
        at: Date.now(), kind: 'session', stage: stage, engine: '', model: '', lang: '', device: '', code: code, name: '',
        msg: String(msg).slice(0, 240), page: (location.pathname.split('/').pop() || 'index.html'),
        ua: String(navigator.userAgent || '').slice(0, 200), mem: navigator.deviceMemory || null,
        cores: navigator.hardwareConcurrency || null, online: navigator.onLine !== false, file: null
      });
      localStorage.setItem(LOG_KEY, JSON.stringify(rows.slice(-LOG_MAX)));
      window.dispatchEvent(new CustomEvent('tanot:medialog'));
    } catch (e) {}
  }
  function rs(r) { return (r && r.type) + '/' + (r && r.status); }

  function setText(el, fn) {
    if (window.OME_I18N && window.OME_I18N.live) window.OME_I18N.live(el, fn);
    else el.textContent = fn();
  }

  /* ── 1) หน้าจากแคชที่ sw.js ฉีดแถบแบบซ่อนไว้ ── cfg: { url, bypass, relogin, sw:{type,status} } */
  function guard(cfg) {
    var bar = document.getElementById('tanot-relogin');
    return check().then(function (page) {
      if (page.ok) {
        log('sw-expired', 'info', 'sw=' + rs(cfg.sw) + ' page=' + rs(page) + ' -> ok reload');
        var last = 0;
        try { last = +sessionStorage.getItem(RELOAD_GUARD) || 0; } catch (e) {}
        return tellSw(true).then(function (acked) {
          var again = Date.now() - last < 30000;
          try { sessionStorage.setItem(RELOAD_GUARD, String(Date.now())); } catch (e) {}
          location.replace(acked && !again ? cfg.url : cfg.bypass);
          return 'reload';
        });
      }
      var n = dirtyCount();
      log('sw-expired', 'auth', 'sw=' + rs(cfg.sw) + ' page=' + rs(page) + ' -> expired dirty=' + n);
      tellSw(false);
      if (bar) {
        var msg = document.getElementById('tanot-relogin-msg'), go = document.getElementById('tanot-relogin-go');
        if (msg) setText(msg, function () { return T('expired') + (n ? ' · ' + T('pending', { n: n }) : ''); });
        if (go) setText(go, function () { return T('relogin'); });
        bar.style.display = 'flex';
      }
      return 'expired';
    });
  }

  /* ── 2) กลับมาจากปุ่ม "เข้าสู่ระบบใหม่" (?relogin=1|2) หรือทางเลี่ยง (?swnet=1) ── */
  function landing() {
    var u;
    try { u = new URL(location.href); } catch (e) { return Promise.resolve('none'); }
    var stage = u.searchParams.get('relogin');
    if (!stage && !u.searchParams.has('swnet')) return Promise.resolve('none');
    u.searchParams.delete('relogin'); u.searchParams.delete('swnet');
    try { history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) {}
    if (!stage) return Promise.resolve('clean');
    return check().then(function (r) {
      if (r.ok) {
        if (stage !== '1') log('relogin', 'info', 'stage=' + stage + ' page=' + rs(r) + ' -> ok');
        tellSw(true);
        if (window.TanotData && window.TanotData.syncNow) window.TanotData.syncNow();
        return 'ok';
      }
      log('relogin', 'auth', 'stage=' + stage + ' page=' + rs(r) + ' -> ' + (stage === '1' ? 'logout' : 'failed'));
      if (stage === '1') {
        var next = function () { u.searchParams.set('relogin', '2'); location.replace(u.href); return 'logout'; };
        return fetch(LOGOUT_URL, { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' }).then(next, next);
      }
      if (window.tanotToast) window.tanotToast(T('failed'), 'err');
      return 'failed';
    });
  }

  window.TanotSession = { check: check, tellSw: tellSw, dirtyCount: dirtyCount, guard: guard, landing: landing, log: log };
  // shell.js โหลดไฟล์นี้เฉพาะตอน URL มี relogin/swnet — หน้าที่ SW ฉีดเรียก guard() เอง (ไม่มีพารามิเตอร์)
  window.TanotSession.landed = landing();
})();
