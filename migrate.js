/* migrate.html (บน pages.dev) — ดึง snapshot จาก github.io ผ่าน popup + postMessage (ระบุ origin ทั้งสองทาง)
   ต้องเป็น popup ไม่ใช่ iframe: iframe ข้ามโดเมนถูกแยก storage (storage partitioning) จะอ่านข้อมูลจริงของ github.io ไม่ได้
   ไม่มีการลบ/แก้ข้อมูลฝั่ง github.io — ฝั่งนั้นแค่อ่าน แล้วจดว่า "ส่งออกแล้ว" หลังฝั่งนี้ยืนยันว่านำเข้าครบ */
(function () {
  'use strict';

  var CFG = window.TANOT_MIGRATE || {};
  var EXPORT_URL = CFG.exportUrl || 'https://tanot713-sudo.github.io/my-web-app/migrate-export.html';
  var EXPORT_ORIGIN = new URL(EXPORT_URL).origin;
  var DONE_KEY = 'tanot:migrate:done';

  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $('mgStatus'), planEl = $('mgPlan');
  var popup = null, nonce = '';

  function setStatus(t, cls) { statusEl.textContent = t; statusEl.className = cls || ''; }

  (function showDone() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(DONE_KEY)); } catch (e) {}
    if (d && d.at) setStatus('ย้ายแล้วเมื่อ ' + new Date(d.at).toLocaleString('th-TH') + ' (' + d.verified + ' รายการ)', 'ok');
  })();

  function syncFirst() {
    // ดึงข้อมูลจากคลาวด์ (ที่เครื่องอื่นซิงก์ไว้) ก่อน — ตารางเทียบจะได้เทียบกับข้อมูลล่าสุดจริง
    if (!window.TanotData || !window.TanotData.enabled) return Promise.resolve();
    setStatus('กำลังซิงก์กับคลาวด์…');
    return window.TanotData.syncNow().then(function (s) {
      if (s.state !== 'ok') throw new Error(s.state === 'auth' ? 'ต้องเข้าสู่ระบบใหม่' : 'ซิงก์ไม่สำเร็จ: ' + s.lastError);
    });
  }

  function showPlan(snap, source) {
    return syncFirst().then(function () { return window.TanotData.planImport(snap); }).then(function (plan) {
      setStatus('ได้ข้อมูลจาก ' + (snap.origin || source) + ' · ' + new Date(snap.at).toLocaleString('th-TH'));
      planEl.hidden = false;
      window.TanotImportUI.render(planEl, plan, {
        source: source,
        onDone: function (res, ok) {
          if (!ok) return;
          try { localStorage.setItem(DONE_KEY, JSON.stringify({ at: Date.now(), from: snap.origin, verified: res.verified })); } catch (e) {}
          var finish = window.TanotData.enabled ? window.TanotData.syncNow() : Promise.resolve({ state: 'ok' });
          finish.then(function (s) {
            var out = planEl.querySelector('.imp-result');
            if (s.state === 'ok' && !s.pending) out.textContent += ' · ซิงก์ขึ้นคลาวด์แล้ว';
            else if (window.TanotData.enabled) out.textContent += ' · ยังซิงก์ไม่ครบ (' + (s.lastError || s.state) + ')';
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
      setStatus('กำลังอ่านข้อมูลจาก github.io…');
    } else if (m.type === 'tanot-migrate-export' && m.nonce === nonce) {
      if (m.error) { setStatus('ฝั่ง github.io อ่านข้อมูลไม่สำเร็จ: ' + m.error, 'err'); return; }
      showPlan(m.snapshot, EXPORT_ORIGIN);
    }
  });

  $('mgOpen').addEventListener('click', function () {
    planEl.hidden = true;
    popup = window.open(EXPORT_URL, 'tanot-migrate', 'width=480,height=600');
    if (!popup) { setStatus('เบราว์เซอร์บล็อกหน้าต่าง popup — อนุญาต popup ของเว็บนี้แล้วกดใหม่', 'err'); return; }
    setStatus('รอหน้าต่าง github.io…');
  });

  $('mgFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    f.text().then(function (t) { showPlan(JSON.parse(t), 'file:' + f.name); })
      .catch(function (e) { setStatus('อ่านไฟล์ไม่ได้: ' + (e && e.message || e), 'err'); });
    this.value = '';
  });
})();
