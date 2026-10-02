/* ══════════════════════════════════════════════════════════════════
   Tanot — Web Push + ลงทะเบียนการแจ้งเตือน (window.TanotPush) · ROADMAP Phase 3
   ฝั่งเซิร์ฟเวอร์: functions/api/push/* (D1 push_subs, reminders) · ตัวส่ง: Scheduler Worker (workers/scheduler/)
   ทำงานเฉพาะ *.pages.dev (มี /api) หรือ window.TANOT_PUSH = { enabled: true } ในเทสต์

   support()  → 'ok' | 'domain' (ไม่มี /api) | 'ios-install' (iPhone/iPad ต้องเปิดจากแอปบนหน้าจอโฮม) | 'browser' | 'denied'
   state()    → Promise<{ support, permission, subscribed, vapid, subs, lastOkAt }>
   subscribe() / unsubscribe() / test()  — subscribe ต้องเรียกตรงจากการกดปุ่ม (iOS ขอสิทธิ์ได้เฉพาะตอนผู้ใช้กด)
   setReminders(scope, items) — หน้าเว็บส่ง "ชุดทั้งหมด" ของ scope ทุกครั้งที่ข้อมูลเปลี่ยน (เซิร์ฟเวอร์แทนที่ทั้งชุด)
     items = [{ id, title, body, url, due_at (ms), kind: 'push'|'digest', repeat }] — ตัวสร้างอยู่ในไฟล์ calc ของแต่ละหน้า
     ส่งเฉพาะเมื่อชุดเปลี่ยน หรือส่งครั้งล่าสุดเกิน 6 ชม. (เผื่ออีกเครื่องส่งชุดเก่าทับ) — ส่งไม่ผ่านจะลองใหม่ตอนกลับมาออนไลน์
     ไม่ต้องสมัคร push บนเครื่องนี้ก็ลงทะเบียนได้ (อีกเครื่องที่สมัครไว้จะได้รับ)
   listReminders() → Promise<items ที่ยังไม่ถึง/วันนี้>
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.TanotPush) return;

  var SENT_KEY = 'tanot:push:sent'; // cache (data-registry) — { scope: { h, at } }
  var RESEND_MS = 6 * 3600 * 1000;

  function enabled() { return /\.pages\.dev$/.test(location.hostname) || !!(window.TANOT_PUSH && window.TANOT_PUSH.enabled); }
  function isIOS() { return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function standalone() {
    return navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }

  function support() {
    if (!enabled()) return 'domain';
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return 'browser';
    if (isIOS() && !standalone()) return 'ios-install';
    if (!('PushManager' in window) || !('Notification' in window)) return 'browser';
    if (Notification.permission === 'denied') return 'denied';
    return 'ok';
  }

  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }

  function api(path, body) {
    var opts = { credentials: 'same-origin', cache: 'no-store', headers: {} };
    if (body !== undefined) { opts.method = 'POST'; opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch('/api/push/' + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw err(j.code || (r.status === 401 || r.status === 403 ? 'auth' : 'http'), j.error || ('HTTP ' + r.status));
        return j;
      });
    }, function () { throw err('offline'); });
  }

  function reg() {
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise(function (_, reject) { setTimeout(function () { reject(err('browser', 'service worker')); }, 15000); })
    ]);
  }
  function currentSub() {
    if (support() !== 'ok') return Promise.resolve(null);
    return reg().then(function (r) { return r.pushManager.getSubscription(); });
  }

  function unb64u(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function sameKey(sub, key) {
    var k = sub && sub.options && sub.options.applicationServerKey;
    if (!k) return true; // อ่านไม่ได้ (เบราว์เซอร์เก่า) — ถือว่าตรง
    var a = new Uint8Array(k);
    if (a.length !== key.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== key[i]) return false;
    return true;
  }
  function deviceLabel() {
    var ua = navigator.userAgent, os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || isIOS() ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'อุปกรณ์';
    var br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    return os + (br ? ' · ' + br : '') + (standalone() ? ' · แอป' : '');
  }

  function state() {
    var s = support();
    var base = { support: s, permission: window.Notification ? Notification.permission : 'default', subscribed: false, vapid: '', subs: 0, lastOkAt: null };
    if (s === 'domain') return Promise.resolve(base);
    return currentSub().catch(function () { return null; }).then(function (sub) {
      return api('config' + (sub ? '?endpoint=' + encodeURIComponent(sub.endpoint) : '')).then(function (c) {
        base.vapid = c.vapid; base.subs = c.subs; base.lastOkAt = c.lastOkAt;
        base.subscribed = !!(sub && c.subscribed);
        return base;
      }, function (e) { base.error = e.code; return base; });
    });
  }

  function subscribe() {
    if (support() !== 'ok') return Promise.reject(err(support()));
    // ขอสิทธิ์ก่อนอย่างอื่น (ยังอยู่ใน user gesture) — Safari บน iOS ไม่ให้ขอหลัง await เครือข่าย
    return Promise.resolve(Notification.requestPermission()).then(function (p) {
      if (p !== 'granted') throw err('denied');
      return api('config');
    }).then(function (c) {
      if (c.vapid !== 'ok') throw err('vapid');
      var key = unb64u(c.publicKey);
      return reg().then(function (r) {
        return r.pushManager.getSubscription().then(function (old) {
          if (old && !sameKey(old, key)) return old.unsubscribe().then(function () { return null; }); // เปลี่ยนคีย์ VAPID แล้ว ต้องสมัครใหม่
          return old;
        }).then(function (sub) {
          return sub || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        });
      });
    }).then(function (sub) {
      return api('subscribe', { subscription: sub.toJSON(), device: deviceLabel() });
    });
  }

  function unsubscribe() {
    return currentSub().then(function (sub) {
      if (!sub) return { ok: true };
      return api('unsubscribe', { endpoint: sub.endpoint }).catch(function (e) {
        if (e.code !== 'offline') throw e;
      }).then(function () { return sub.unsubscribe(); }).then(function () { return { ok: true }; });
    });
  }

  function test() {
    return currentSub().then(function (sub) {
      if (!sub) throw err('not-subscribed');
      return api('test', { endpoint: sub.endpoint });
    });
  }

  /* ── ลงทะเบียนการแจ้งเตือน ── */
  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(36) + ':' + s.length;
  }
  function readSent() { try { return JSON.parse(localStorage.getItem(SENT_KEY)) || {}; } catch (e) { return {}; } }
  function markSent(scope, h) {
    try { var m = readSent(); m[scope] = { h: h, at: Date.now() }; localStorage.setItem(SENT_KEY, JSON.stringify(m)); } catch (e) {}
  }

  var pending = {}, timers = {}, inflight = {};
  function setReminders(scope, items) {
    if (!enabled()) return Promise.resolve({ skipped: 'domain' });
    pending[scope] = (items || []).slice().sort(function (a, b) { return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0; });
    clearTimeout(timers[scope]);
    return new Promise(function (resolve) {
      timers[scope] = setTimeout(function () { resolve(flush(scope)); }, 800); // หน้าวาดซ้ำหลายรอบติดกัน → ส่งครั้งเดียว
    });
  }
  function flush(scope, force) {
    var items = pending[scope];
    if (!items) return Promise.resolve({ skipped: 'none' });
    var h = hash(JSON.stringify(items)), last = readSent()[scope];
    if (!force && last && last.h === h && Date.now() - last.at < RESEND_MS) { delete pending[scope]; return Promise.resolve({ skipped: 'same' }); }
    if (inflight[scope]) return inflight[scope].then(function () { return flush(scope, force); });
    inflight[scope] = api('reminders', { scope: scope, items: items }).then(function (r) {
      if (pending[scope] === items) delete pending[scope];
      markSent(scope, h);
      return r;
    }, function (e) { return { error: e.code || 'http' }; }).then(function (r) { inflight[scope] = null; return r; });
    return inflight[scope];
  }
  window.addEventListener('online', function () { Object.keys(pending).forEach(function (s) { flush(s); }); });

  function listReminders() { return api('reminders').then(function (j) { return j.items || []; }); }

  window.TanotPush = {
    enabled: enabled, support: support, state: state, subscribe: subscribe, unsubscribe: unsubscribe, test: test,
    setReminders: setReminders, listReminders: listReminders, flush: function (scope) { return flush(scope, true); }
  };
})();
