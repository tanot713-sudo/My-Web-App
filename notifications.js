/* notifications.html — สมัคร/ยกเลิก Web Push ของเครื่องนี้ + รายการการแจ้งเตือนที่หน้าต่างๆ ลงทะเบียนไว้ (ตาราง reminders)
   ทั้งหมดผ่าน tanot-push.js (window.TanotPush) — หน้านี้แค่วาดสถานะ */
(function () {
  'use strict';

  var P = window.TanotPush;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function when(ts) {
    return ts ? new Date(ts).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  }
  function say(text, kind) { var el = $('ntMsg'); el.textContent = text || ''; el.className = 'nt-msg' + (kind ? ' ' + kind : ''); }

  var SUPPORT_MSG = {
    domain: 'ใช้ได้บน my-web-app-5w2.pages.dev',
    'ios-install': 'บน iPhone/iPad ต้องเปิดจากแอปที่เพิ่มลงหน้าจอโฮม',
    browser: 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน',
    denied: 'การแจ้งเตือนถูกปิดในการตั้งค่าเบราว์เซอร์'
  };
  var ERR_MSG = {
    denied: 'ไม่ได้รับอนุญาตให้แจ้งเตือน', vapid: 'ยังไม่ได้ตั้งคีย์ VAPID', offline: 'ออฟไลน์อยู่', auth: 'ต้องเข้าสู่ระบบใหม่',
    'not-subscribed': 'เครื่องนี้ยังไม่ได้เปิดการแจ้งเตือน', browser: 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน'
  };
  function errText(e) { return ERR_MSG[e && e.code] || (e && e.message) || 'ผิดพลาด'; }

  var busy = false;
  function setBusy(b) { busy = b; ['ntOn', 'ntOff', 'ntTest'].forEach(function (id) { $(id).disabled = b; }); }

  function renderState(keepMsg) {
    if (!P) return Promise.resolve();
    return P.state().then(function (s) {
      var ok = s.support === 'ok';
      $('ntState').textContent = !ok ? 'ไม่พร้อม' : s.subscribed ? 'เปิดอยู่' : 'ปิด';
      $('ntSubs').textContent = s.support === 'domain' || s.error ? '—' : String(s.subs);
      $('ntLast').textContent = s.subscribed ? when(s.lastOkAt) : '—';
      $('ntOn').hidden = !ok || s.subscribed || s.vapid !== 'ok';
      $('ntOff').hidden = !s.subscribed;
      $('ntTest').hidden = !s.subscribed;
      $('ntReload').hidden = s.support === 'domain';
      if (!busy && !keepMsg) say(!ok ? SUPPORT_MSG[s.support] : s.error ? ERR_MSG[s.error] || '' : s.vapid && s.vapid !== 'ok' ? ERR_MSG.vapid : '', !ok || s.error ? '' : null);
      return s;
    });
  }

  var SRC_ICON = { insurance: 'shield', tax: 'receipt', maintenance: 'wrench' };
  function renderList() {
    var el = $('ntList');
    if (!P || !P.enabled()) { el.innerHTML = '<div class="empty">' + icon('bell') + '<p class="empty-title">ไม่มีกำหนดการ</p></div>'; return Promise.resolve(); }
    return P.listReminders().then(function (items) {
      if (!items.length) { el.innerHTML = '<div class="empty">' + icon('bell') + '<p class="empty-title">ไม่มีกำหนดการ</p></div>'; return; }
      el.innerHTML = items.map(function (r) {
        var badge = r.kind === 'digest' ? '<span class="badge info">สรุป 07:00</span>' : r.sent_at ? '<span class="badge ok">ส่งแล้ว</span>' : '';
        var href = r.url ? ' href="' + esc(r.url) + '"' : '';
        return '<a class="list-row"' + href + '><span class="lead">' + icon(SRC_ICON[r.source] || 'bell') + '</span>' +
          '<div class="grow"><div class="title">' + esc(r.title) + '</div><div class="meta">' + esc(when(r.due_at)) + (r.body ? ' · ' + esc(r.body) : '') + '</div></div>' +
          (badge ? '<div class="right">' + badge + '</div>' : '') + '</a>';
      }).join('');
    }, function (e) { el.innerHTML = '<div class="empty">' + icon('circle-alert') + '<p class="empty-title">' + esc(errText(e)) + '</p></div>'; });
  }

  function act(fn, okText) {
    if (busy) return;
    setBusy(true);
    say('');
    fn().then(function () { say(okText, 'ok'); }, function (e) { say(errText(e), 'err'); })
      .then(function () { setBusy(false); return renderState(true); }); // ข้อความผลลัพธ์ค้างไว้ ไม่ให้สถานะทับ
  }
  $('ntOn').addEventListener('click', function () { act(function () { return P.subscribe(); }, 'เปิดการแจ้งเตือนแล้ว'); });
  $('ntOff').addEventListener('click', function () { act(function () { return P.unsubscribe(); }, 'ปิดการแจ้งเตือนแล้ว'); });
  $('ntTest').addEventListener('click', function () {
    act(function () { return P.test().then(function (r) { if (!r.sent) throw new Error('ส่งไม่สำเร็จ'); }); }, 'ส่งแล้ว');
  });
  $('ntReload').addEventListener('click', function () { renderState(); renderList(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { renderState(); renderList(); } });

  renderState();
  renderList();
})();
