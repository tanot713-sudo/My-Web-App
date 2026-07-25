/* ══════════════════════════════════════════════════════════════════
   Tanot Auth Gate — หน้าจอใส่รหัสผ่านก่อนเข้าเว็บ (ทุกหน้า)

   ⚠️ ข้อจำกัดสำคัญ: นี่คือการป้องกันฝั่งไคลเอนต์เท่านั้น เว็บนี้เป็น static
   site บน GitHub Pages ไม่มีเซิร์ฟเวอร์ตรวจสอบรหัสผ่านจริง ผู้ที่มีความรู้
   ด้านเทคนิค (เปิด DevTools) สามารถข้ามหน้านี้ได้โดยการรัน
   localStorage.setItem('tanot:auth','1') ตรงๆ โดยไม่ต้องรู้รหัสผ่านเลย
   ใช้เพื่อกันคนทั่วไปที่ไม่เกี่ยวข้องเข้ามาใช้งานเว็บโดยบังเอิญเท่านั้น
   ไม่ใช่การป้องกันข้อมูลจริงจากผู้โจมตีที่ตั้งใจ — หากต้องการความปลอดภัย
   จริง ให้ใช้ Cloudflare Access หรือระบบยืนยันตัวตนฝั่งเซิร์ฟเวอร์
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'tanot:auth';
  var LEGACY_KEY = 'site-auth-ok';           // key เดิมที่แอปหลัก (app.html) ใช้ — ตั้งให้ด้วยเพื่อไม่ต้องใส่รหัสซ้ำ
  var HASH = 'de1a17ae081719032bea1292b37cacb0a91b1b09ce5cf17a2ea36c93dda76b26'; // SHA-256 ของรหัสผ่าน (ไม่เก็บ plaintext ไว้ในไฟล์)

  function authed() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }

  if (authed()) return; // ปลดล็อกแล้ว — ไม่ต้องบล็อกอะไร ปล่อยหน้าโหลดปกติ

  // บล็อกการมองเห็นเนื้อหาทันที ก่อนส่วนอื่นของ body จะ parse/แสดงผล
  document.write(
    '<div id="tanot-gate" style="position:fixed;inset:0;z-index:99999;' +
    'background:#12151C;display:flex;align-items:center;justify-content:center;' +
    'font-family:Prompt,system-ui,-apple-system,sans-serif;padding:20px;box-sizing:border-box"></div>'
  );

  async function sha256Hex(str) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function buildUI() {
    var gate = document.getElementById('tanot-gate');
    if (!gate) return;
    gate.innerHTML =
      '<form id="tanot-gate-form" style="background:#1B2030;border-radius:16px;padding:32px;width:100%;max-width:340px;' +
      'box-shadow:0 20px 60px rgba(0,0,0,.4);box-sizing:border-box">' +
        '<div style="width:44px;height:44px;border-radius:12px;background:#12A594;display:flex;' +
        'align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;margin-bottom:16px">T</div>' +
        '<h1 style="color:#E6EAF2;font-size:18px;font-weight:700;margin:0 0 6px">ใส่รหัสผ่านเพื่อเข้าใช้งาน</h1>' +
        '<p style="color:#8B94A8;font-size:13px;margin:0 0 20px;line-height:1.6">เว็บนี้จำกัดการเข้าถึงด้วยรหัสผ่านเดียว เพื่อกันคนทั่วไปที่ไม่เกี่ยวข้องเข้ามาใช้งาน</p>' +
        '<input id="tanot-gate-pw" type="password" placeholder="รหัสผ่าน" autofocus autocomplete="current-password" ' +
        'style="width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1.5px solid #2A3040;' +
        'background:#12151C;color:#E6EAF2;font-size:15px;margin-bottom:12px;font-family:inherit">' +
        '<div id="tanot-gate-err" style="color:#F87171;font-size:13px;margin-bottom:12px;display:none">รหัสผ่านไม่ถูกต้อง</div>' +
        '<button type="submit" style="width:100%;padding:12px;border-radius:10px;border:none;background:#12A594;' +
        'color:#fff;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit">เข้าสู่ระบบ</button>' +
      '</form>';

    var form = document.getElementById('tanot-gate-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = document.getElementById('tanot-gate-pw').value;
      sha256Hex(pw).then(function (hex) {
        if (hex === HASH) {
          try {
            localStorage.setItem(KEY, '1');
            localStorage.setItem(LEGACY_KEY, 'true'); // เข้าแอปเดิม (app.html) โดยไม่ต้องใส่รหัสซ้ำ
          } catch (e) {}
          gate.remove();
        } else {
          document.getElementById('tanot-gate-err').style.display = 'block';
          document.getElementById('tanot-gate-pw').value = '';
          document.getElementById('tanot-gate-pw').focus();
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }
})();
