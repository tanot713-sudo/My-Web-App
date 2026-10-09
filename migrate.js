/* migrate.html (บน pages.dev) — ดึง snapshot จาก github.io ผ่าน popup + postMessage (ระบุ origin ทั้งสองทาง)
   ต้องเป็น popup ไม่ใช่ iframe: iframe ข้ามโดเมนถูกแยก storage (storage partitioning) จะอ่านข้อมูลจริงของ github.io ไม่ได้
   ไม่มีการลบ/แก้ข้อมูลฝั่ง github.io — ฝั่งนั้นแค่อ่าน แล้วจดว่า "ส่งออกแล้ว" หลังฝั่งนี้ยืนยันว่านำเข้าครบ */
(function () {
  'use strict';

  var CFG = window.TANOT_MIGRATE || {};
  // path ตัวพิมพ์ใหญ่ตามชื่อ repo (My-Web-App) — ตัวเล็กได้หน้า 404 ของ GitHub Pages
  var EXPORT_URL = CFG.exportUrl || 'https://tanot713-sudo.github.io/My-Web-App/migrate-export.html';
  var EXPORT_ORIGIN = new URL(EXPORT_URL).origin;
  var DONE_KEY = 'tanot:migrate:done';

  var T = OME_I18N.scope('mg', {
    th: {
      title: 'ย้ายข้อมูลจาก github.io', fetch: 'ดึงข้อมูลจาก github.io', file: 'นำเข้าจากไฟล์',
      doneAt: 'ย้ายแล้วเมื่อ {at} ({n} รายการ)', syncing: 'กำลังซิงก์กับคลาวด์…', needLogin: 'ต้องเข้าสู่ระบบใหม่', syncFail: 'ซิงก์ไม่สำเร็จ: {err}',
      got: 'ได้ข้อมูลจาก {from} · {at}', synced: ' · ซิงก์ขึ้นคลาวด์แล้ว', notSynced: ' · ยังซิงก์ไม่ครบ ({err})',
      reading: 'กำลังอ่านข้อมูลจาก github.io…', remoteErr: 'ฝั่ง github.io อ่านข้อมูลไม่สำเร็จ: {err}',
      popupBlocked: 'เบราว์เซอร์บล็อกหน้าต่าง popup — อนุญาต popup ของเว็บนี้แล้วกดใหม่', waiting: 'รอหน้าต่าง github.io…', fileErr: 'อ่านไฟล์ไม่ได้: {err}'
    },
    en: {
      title: 'Move data from github.io', fetch: 'Fetch data from github.io', file: 'Import from file',
      doneAt: 'Moved on {at} ({n} items)', syncing: 'Syncing with the cloud…', needLogin: 'Please sign in again', syncFail: 'Sync failed: {err}',
      got: 'Got data from {from} · {at}', synced: ' · synced to the cloud', notSynced: ' · not fully synced yet ({err})',
      reading: 'Reading data from github.io…', remoteErr: 'github.io could not read the data: {err}',
      popupBlocked: 'The browser blocked the popup — allow popups for this site and try again', waiting: 'Waiting for the github.io window…', fileErr: 'Could not read the file: {err}'
    }
  });
  window.OME_PAGE_LIVE_LANG = true;
  function when(ms) { return OME_I18N.date(ms, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $('mgStatus'), planEl = $('mgPlan');
  var popup = null, nonce = '';

  /* t = ข้อความ หรือฟังก์ชันที่คืนข้อความตามภาษาปัจจุบัน (แปลซ้ำเองตอนสลับภาษา) */
  function setStatus(t, cls) {
    if (typeof t === 'function') OME_I18N.live(statusEl, t); else { OME_I18N.live(statusEl, null); statusEl.textContent = t; }
    statusEl.className = cls || '';
  }

  (function showDone() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(DONE_KEY)); } catch (e) {}
    if (d && d.at) setStatus(function () { return T('doneAt', { at: when(d.at), n: d.verified }); }, 'ok');
  })();

  function syncFirst() {
    // ดึงข้อมูลจากคลาวด์ (ที่เครื่องอื่นซิงก์ไว้) ก่อน — ตารางเทียบจะได้เทียบกับข้อมูลล่าสุดจริง
    if (!window.TanotData || !window.TanotData.enabled) return Promise.resolve();
    setStatus(function () { return T('syncing'); });
    return window.TanotData.syncNow().then(function (s) {
      if (s.state !== 'ok') throw new Error(s.state === 'auth' ? T('needLogin') : T('syncFail', { err: s.lastError }));
    });
  }

  function showPlan(snap, source) {
    return syncFirst().then(function () { return window.TanotData.planImport(snap); }).then(function (plan) {
      setStatus(function () { return T('got', { from: snap.origin || source, at: when(snap.at) }); });
      planEl.hidden = false;
      window.TanotImportUI.render(planEl, plan, {
        source: source,
        onDone: function (res, ok) {
          if (!ok) return;
          try { localStorage.setItem(DONE_KEY, JSON.stringify({ at: Date.now(), from: snap.origin, verified: res.verified })); } catch (e) {}
          var finish = window.TanotData.enabled ? window.TanotData.syncNow() : Promise.resolve({ state: 'ok' });
          finish.then(function (s) {
            var out = planEl.querySelector('.imp-result');
            var tail = s.state === 'ok' && !s.pending ? function () { return T('synced'); }
              : window.TanotData.enabled ? function () { return T('notSynced', { err: s.lastError || s.state }); } : null;
            if (tail) { var prev = out.__omeLive || function () { return out.textContent; }; OME_I18N.live(out, function () { return prev() + tail(); }); }
            if (popup && !popup.closed) popup.postMessage({ type: 'tanot-migrate-done', nonce: nonce, verified: res.verified }, EXPORT_ORIGIN);
          });
        }
      });
    }).catch(function (e) { setStatus(String(e && e.message || e), 'err'); });
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== EXPORT_ORIGIN || !popup || e.source !== popup) return;
    var m = e.data || {};
    if (m.type === 'tanot-migrate-ready') {
      nonce = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
      popup.postMessage({ type: 'tanot-migrate-request', nonce: nonce }, EXPORT_ORIGIN);
      setStatus(function () { return T('reading'); });
    } else if (m.type === 'tanot-migrate-export' && m.nonce === nonce) {
      if (m.error) { setStatus(function () { return T('remoteErr', { err: m.error }); }, 'err'); return; }
      showPlan(m.snapshot, EXPORT_ORIGIN);
    }
  });

  $('mgOpen').addEventListener('click', function () {
    planEl.hidden = true;
    popup = window.open(EXPORT_URL, 'tanot-migrate', 'width=480,height=600');
    if (!popup) { setStatus(function () { return T('popupBlocked'); }, 'err'); return; }
    setStatus(function () { return T('waiting'); });
  });

  $('mgFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    f.text().then(function (t) { showPlan(JSON.parse(t), 'file:' + f.name); })
      .catch(function (e) { setStatus(function () { return T('fileErr', { err: e && e.message || e }); }, 'err'); });
    this.value = '';
  });
})();
