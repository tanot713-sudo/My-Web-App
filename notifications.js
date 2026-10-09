/* notifications.html — สมัคร/ยกเลิก Web Push ของเครื่องนี้ + รายการการแจ้งเตือนที่หน้าต่างๆ ลงทะเบียนไว้ (ตาราง reminders)
   ทั้งหมดผ่าน tanot-push.js (window.TanotPush) — หน้านี้แค่วาดสถานะ */
(function () {
  'use strict';

  var P = window.TanotPush;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var T = OME_I18N.scope('nt', {
    th: {
      title: 'การแจ้งเตือน', device: 'เครื่องนี้', state: 'สถานะ', subs: 'เครื่องที่รับแจ้งเตือน', last: 'ส่งถึงเครื่องนี้ล่าสุด',
      on: 'เปิดการแจ้งเตือน', test: 'ส่งทดสอบ', off: 'ปิดการแจ้งเตือน', upcoming: 'กำหนดการ', reload: 'รีเฟรช',
      notReady: 'ไม่พร้อม', stOn: 'เปิดอยู่', stOff: 'ปิด', none: 'ไม่มีกำหนดการ', digest: 'สรุป 07:00', sent: 'ส่งแล้ว',
      sDomain: 'ใช้ได้บน my-web-app-5w2.pages.dev', sIos: 'บน iPhone/iPad ต้องเปิดจากแอปที่เพิ่มลงหน้าจอโฮม',
      sBrowser: 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน', sDenied: 'การแจ้งเตือนถูกปิดในการตั้งค่าเบราว์เซอร์',
      eDenied: 'ไม่ได้รับอนุญาตให้แจ้งเตือน', eVapid: 'ยังไม่ได้ตั้งคีย์ VAPID', eOffline: 'ออฟไลน์อยู่', eAuth: 'ต้องเข้าสู่ระบบใหม่',
      eNotSub: 'เครื่องนี้ยังไม่ได้เปิดการแจ้งเตือน', eFail: 'ผิดพลาด', sendFail: 'ส่งไม่สำเร็จ',
      okOn: 'เปิดการแจ้งเตือนแล้ว', okOff: 'ปิดการแจ้งเตือนแล้ว', okSent: 'ส่งแล้ว'
    },
    en: {
      title: 'Notifications', device: 'This device', state: 'Status', subs: 'Devices receiving notifications', last: 'Last sent to this device',
      on: 'Turn on notifications', test: 'Send a test', off: 'Turn off notifications', upcoming: 'Schedule', reload: 'Refresh',
      notReady: 'Not ready', stOn: 'On', stOff: 'Off', none: 'Nothing scheduled', digest: 'Summary 07:00', sent: 'Sent',
      sDomain: 'Available on my-web-app-5w2.pages.dev', sIos: 'On iPhone/iPad, open this from the app added to the home screen',
      sBrowser: 'This browser does not support notifications', sDenied: 'Notifications are blocked in the browser settings',
      eDenied: 'Notification permission was not granted', eVapid: 'The VAPID key has not been set', eOffline: 'Offline', eAuth: 'Please sign in again',
      eNotSub: 'Notifications are not turned on for this device', eFail: 'Something went wrong', sendFail: 'Could not send',
      okOn: 'Notifications turned on', okOff: 'Notifications turned off', okSent: 'Sent'
    }
  });
  function icon(name) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function when(ts) {
    return ts ? OME_I18N.date(ts, { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  }
  /* ข้อความสถานะ: ส่งเป็นฟังก์ชันที่คืนข้อความตามภาษาปัจจุบัน → แปลสดตอนสลับภาษา */
  function say(fn, kind) { var el = $('ntMsg'); OME_I18N.live(el, typeof fn === 'function' ? fn : function () { return fn || ''; }); el.className = 'nt-msg' + (kind ? ' ' + kind : ''); }

  var SUPPORT_MSG = { domain: 'sDomain', 'ios-install': 'sIos', browser: 'sBrowser', denied: 'sDenied' };
  var ERR_MSG = { denied: 'eDenied', vapid: 'eVapid', offline: 'eOffline', auth: 'eAuth', 'not-subscribed': 'eNotSub', browser: 'sBrowser', send: 'sendFail' };
  function errText(e) { return ERR_MSG[e && e.code] ? T(ERR_MSG[e.code]) : (e && e.message) || T('eFail'); }

  var busy = false;
  function setBusy(b) { busy = b; ['ntOn', 'ntOff', 'ntTest'].forEach(function (id) { $(id).disabled = b; }); }

  var lastState = null, lastItems = null, listError = null;
  function paintState(s) {
    var ok = s.support === 'ok';
    $('ntState').textContent = !ok ? T('notReady') : s.subscribed ? T('stOn') : T('stOff');
    $('ntSubs').textContent = s.support === 'domain' || s.error ? '—' : String(s.subs);
    $('ntLast').textContent = s.subscribed ? when(s.lastOkAt) : '—';
    $('ntOn').hidden = !ok || s.subscribed || s.vapid !== 'ok';
    $('ntOff').hidden = !s.subscribed;
    $('ntTest').hidden = !s.subscribed;
    $('ntReload').hidden = s.support === 'domain';
  }
  function renderState(keepMsg) {
    if (!P) return Promise.resolve();
    return P.state().then(function (s) {
      lastState = s;
      paintState(s);
      var ok = s.support === 'ok';
      if (!busy && !keepMsg) say(function () { return !ok ? T(SUPPORT_MSG[s.support] || 'eFail') : s.error ? (ERR_MSG[s.error] ? T(ERR_MSG[s.error]) : '') : s.vapid && s.vapid !== 'ok' ? T('eVapid') : ''; }, !ok || s.error ? '' : null);
      return s;
    });
  }

  var SRC_ICON = { insurance: 'shield', tax: 'receipt', maintenance: 'wrench' };
  function paintList() {
    var el = $('ntList');
    if (listError) { el.innerHTML = '<div class="empty">' + icon('circle-alert') + '<p class="empty-title">' + esc(errText(listError)) + '</p></div>'; return; }
    var items = lastItems;
    if (!items || !items.length) { el.innerHTML = '<div class="empty">' + icon('bell') + '<p class="empty-title">' + esc(T('none')) + '</p></div>'; return; }
    /* ชื่อ/ข้อความของกำหนดการเป็นข้อมูลที่หน้าต่างๆ ลงทะเบียนไว้ (data-i18n-skip) — แปลเฉพาะวันที่และป้าย */
    el.innerHTML = items.map(function (r) {
      var badge = r.kind === 'digest' ? '<span class="badge info">' + esc(T('digest')) + '</span>' : r.sent_at ? '<span class="badge ok">' + esc(T('sent')) + '</span>' : '';
      var href = r.url ? ' href="' + esc(r.url) + '"' : '';
      return '<a class="list-row"' + href + '><span class="lead">' + icon(SRC_ICON[r.source] || 'bell') + '</span>' +
        '<div class="grow"><div class="title" data-i18n-skip>' + esc(r.title) + '</div><div class="meta"><span>' + esc(when(r.due_at)) + '</span>' + (r.body ? '<span data-i18n-skip> · ' + esc(r.body) + '</span>' : '') + '</div></div>' +
        (badge ? '<div class="right">' + badge + '</div>' : '') + '</a>';
    }).join('');
  }
  function renderList() {
    if (!P || !P.enabled()) { lastItems = []; listError = null; paintList(); return Promise.resolve(); }
    return P.listReminders().then(function (items) { lastItems = items; listError = null; paintList(); },
      function (e) { listError = e; paintList(); });
  }

  function act(fn, okText) {
    if (busy) return;
    setBusy(true);
    say('');
    fn().then(function () { say(function () { return T(okText); }, 'ok'); }, function (e) { say(function () { return errText(e); }, 'err'); })
      .then(function () { setBusy(false); return renderState(true); }); // ข้อความผลลัพธ์ค้างไว้ ไม่ให้สถานะทับ
  }
  $('ntOn').addEventListener('click', function () { act(function () { return P.subscribe(); }, 'okOn'); });
  $('ntOff').addEventListener('click', function () { act(function () { return P.unsubscribe(); }, 'okOff'); });
  $('ntTest').addEventListener('click', function () {
    act(function () { return P.test().then(function (r) { if (!r.sent) { var er = new Error('send'); er.code = 'send'; throw er; } }); }, 'okSent');
  });
  $('ntReload').addEventListener('click', function () { renderState(); renderList(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { renderState(); renderList(); } });

  window.OME_PAGE_LIVE_LANG = true;
  OME_LANG.onChange(function () { if (lastState) paintState(lastState); paintList(); });
  renderState();
  renderList();
})();
