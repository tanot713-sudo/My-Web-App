/* ══════════════════════════════════════════════════════════════════
   Tanot — app-nav.js
   ปุ่ม ☰ เปิด/ปิดแถบเมนูซ้ายบนมือถือของ app.html (เฉพาะ CSS class toggle
   ไม่แตะ React state ของ bundle เลย — ปลอดภัย ไม่ผูกกับโครงสร้างภายใน)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function open() { document.documentElement.classList.add('app-nav-open'); }
  function close() { document.documentElement.classList.remove('app-nav-open'); }
  function toggle() { document.documentElement.classList.toggle('app-nav-open'); }

  function init() {
    if (document.getElementById('appNavHamburger')) return; // กันแทรกซ้ำ

    var btn = document.createElement('button');
    btn.id = 'appNavHamburger';
    btn.className = 'app-nav-hamburger';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'เปิดเมนู');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
    btn.addEventListener('click', toggle);

    var backdrop = document.createElement('div');
    backdrop.className = 'app-nav-backdrop';
    backdrop.addEventListener('click', close);

    document.body.appendChild(backdrop);
    document.body.appendChild(btn);

    // ปิดเมนูอัตโนมัติเมื่อเลือกรายการ (รอ React onClick เดิมทำงานก่อนเล็กน้อย)
    document.addEventListener('click', function (e) {
      var link = e.target.closest('.rail-flyout-link, .rail-home');
      if (link) setTimeout(close, 80);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
