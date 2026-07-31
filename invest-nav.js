/* ══════════════════════════════════════════════════════════════════
   Tanot — แถบเมนูย่อย "การลงทุน" (ปุ่มด้านบนสลับหมวด)
   ใช้ร่วมทุกหน้าในโซนลงทุน: ใส่ <div id="investNav"></div> ตรงที่อยากให้แถบขึ้น
   + <script src="invest-nav.js" defer></script>
   ระบุหน้าปัจจุบันด้วย  <body data-invest-key="thai-stock">
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var BASE = location.pathname.replace(/[^/]*$/, '');

  /* หมวดการลงทุน — ลำดับตามที่ผู้ใช้กำหนด; page = หน้าที่ทำแล้ว, ที่เหลือ "เร็วๆ นี้" */
  var CATS = [
    { key: 'global-stock', label: 'หุ้นต่างประเทศ',  icon: '🌐' },
    { key: 'thai-stock',   label: 'หุ้นไทย',          icon: '📈', page: 'invest-thai-stock.html' },
    { key: 'gold',         label: 'ทองคำ',            icon: '🪙' },
    { key: 'business',     label: 'ลงทุนทำธุรกิจ',    icon: '🏪', page: 'invest-business.html' },
    { key: 'gov-bond',     label: 'พันธบัตรรัฐบาล',   icon: '🏛️' },
    { key: 'gsb-lottery',  label: 'สลากออมสิน',       icon: '🎟️' },
    { key: 'baac-lottery', label: 'สลาก ธ.ก.ส.',      icon: '🌾' },
    { key: 'thai-fund',    label: 'กองทุนไทย',        icon: '📊' },
    { key: 'global-fund',  label: 'กองทุนต่างประเทศ', icon: '🧺', page: 'invest-global-fund.html' },
    { key: 'bitcoin',      label: 'Bitcoin',          icon: '₿' }
  ];

  function injectCSS() {
    if (document.getElementById('investNavCSS')) return;
    var css = ''
      + '.inv-subnav{display:flex;gap:8px;overflow-x:auto;padding:2px 0 12px;scrollbar-width:none;-webkit-overflow-scrolling:touch}'
      + '.inv-subnav::-webkit-scrollbar{display:none}'
      + '.inv-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:12px;'
      + 'background:var(--card,#fff);border:1.5px solid var(--line,#E4E9F2);color:var(--ink,#1F2733);'
      + 'text-decoration:none;font-weight:600;font-size:13.5px;white-space:nowrap;transition:.15s;'
      + 'font-family:var(--ome-f,\'Prompt\',system-ui,sans-serif);box-shadow:var(--sh,0 1px 2px rgba(24,31,54,.05))}'
      + '.inv-chip .ic{font-size:15px;line-height:1}'
      + '.inv-chip:hover{border-color:var(--brand,#12A594);color:var(--brand-dk,#0B7F72);transform:translateY(-1px)}'
      + '.inv-chip.on{background:var(--brand-sf,#E7F6F4);border-color:var(--brand,#12A594);color:var(--brand-dk,#0B7F72)}'
      + '.inv-chip.soon{opacity:.55}'
      + '.inv-subnav-wrap{position:sticky;top:var(--ome-nav-h,48px);z-index:20;background:var(--bg,#F6F7FB);padding-top:10px}';
    var s = document.createElement('style');
    s.id = 'investNavCSS';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function render() {
    var host = document.getElementById('investNav');
    if (!host) return;
    injectCSS();
    var cur = (document.body && document.body.dataset && document.body.dataset.investKey) || '';
    host.classList.add('inv-subnav-wrap');

    var bar = document.createElement('div');
    bar.className = 'inv-subnav';
    bar.setAttribute('aria-label', 'หมวดการลงทุน');

    CATS.forEach(function (c) {
      var a = document.createElement('a');
      a.className = 'inv-chip' + (c.key === cur ? ' on' : '') + (c.page ? '' : ' soon');
      a.href = BASE + (c.page ? c.page : 'invest.html?soon=' + c.key);
      a.innerHTML = '<span class="ic">' + c.icon + '</span><span class="tx">' + c.label + '</span>';
      bar.appendChild(a);
    });

    host.appendChild(bar);

    /* เลื่อนชิปที่กำลังเปิดให้เห็นกลางจอ */
    var on = bar.querySelector('.inv-chip.on');
    if (on && on.scrollIntoView) {
      try { on.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  window.INVEST_CATS = CATS;
})();
