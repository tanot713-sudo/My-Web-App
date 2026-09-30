/* migrate-export.html (เปิดเป็น popup บน github.io จาก migrate.html บน pages.dev)
   อ่านอย่างเดียว: ไม่ลบ/แก้ข้อมูลเดิมใดๆ — ส่ง snapshot ให้หน้าต่างแม่เฉพาะ origin ที่กำหนดไว้เท่านั้น
   (postMessage ระบุ targetOrigin → ถ้าหน้าต่างแม่ไม่ใช่ pages.dev ของเรา เบราว์เซอร์ทิ้งข้อความเอง)
   หลังฝั่ง pages.dev ยืนยันว่านำเข้าครบ จดคีย์ใหม่ 'tanot:migrate:exported' ไว้ (ไม่ทับคีย์เดิม) */
(function () {
  'use strict';

  var host = location.hostname;
  var TEST = host === 'localhost' || host === '127.0.0.1';
  var PROD_TARGET = 'https://my-web-app-5w2.pages.dev';
  function allowed(origin) {
    if (origin === PROD_TARGET) return true;
    return TEST && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) && origin !== location.origin;
  }

  var el = document.getElementById('mxStatus');
  function setStatus(t, cls) { el.textContent = t; el.className = cls || ''; }
  var sentNonce = '';

  document.getElementById('mxFile').addEventListener('click', function () {
    window.TanotData.snapshot().then(function (snap) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(snap)], { type: 'application/json' }));
      a.download = 'tanot-github-io-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    });
  });

  if (!window.opener) { setStatus('เปิดจากหน้า "ย้ายข้อมูล" บน pages.dev', 'err'); return; }

  window.addEventListener('message', function (e) {
    if (!allowed(e.origin) || e.source !== window.opener) return;
    var m = e.data || {};
    if (m.type === 'tanot-migrate-request' && typeof m.nonce === 'string') {
      setStatus('กำลังอ่านข้อมูลในเครื่อง…');
      window.TanotData.snapshot().then(function (snap) {
        sentNonce = m.nonce;
        e.source.postMessage({ type: 'tanot-migrate-export', nonce: m.nonce, snapshot: snap }, e.origin);
        setStatus('ส่งข้อมูล ' + Object.keys(snap.ls).length + ' คีย์แล้ว — รอยืนยันจากหน้าย้ายข้อมูล…');
      }).catch(function (err) {
        e.source.postMessage({ type: 'tanot-migrate-export', nonce: m.nonce, error: String(err && err.message || err) }, e.origin);
        setStatus('อ่านข้อมูลไม่สำเร็จ: ' + (err && err.message || err), 'err');
      });
    } else if (m.type === 'tanot-migrate-done' && m.nonce && m.nonce === sentNonce) {
      try { localStorage.setItem('tanot:migrate:exported', JSON.stringify({ at: Date.now(), to: e.origin, verified: m.verified })); } catch (x) {}
      setStatus('ย้ายเสร็จแล้ว (' + m.verified + ' รายการ) — ปิดหน้าต่างนี้ได้', 'ok');
    }
  });

  // แจ้งหน้าต่างแม่ว่าพร้อม (ไม่มีข้อมูลในข้อความนี้)
  (TEST ? ['*'] : [PROD_TARGET]).forEach(function (o) {
    try { window.opener.postMessage({ type: 'tanot-migrate-ready' }, o); } catch (x) {}
  });
})();
