/* ══════════════════════════════════════════════════════════════════
   Tanot — สแกนเนอร์ (แท็บ #scan ของ invest-stock.html) — ยุบรวมหน้าลงทุน ขั้น 7
   สแกน SET50 (50 ตัว) หรือหุ้นดังสหรัฐฯ (~45 ตัว) → ไฟจราจรจาก InvestCalc.analyzeSeries (สูตรเดียวกับหน้าหุ้น)
   ดึง series เต็มผ่าน InvestCore.series() (เขียนแคชชื่อเดิมครบทุกฟิลด์ — ไม่ทับข้อมูลหน้าหุ้นด้วยข้อมูลย่ออีกแล้ว) คลิกแถว → invest-stock.html?sym=X#th|#us
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำซื้อ
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IC = window.InvestCore, Calc = window.InvestCalc;
  var $ = function (id) { return document.getElementById(id); };
  var SETS = {
    th: ['ADVANC', 'AOT', 'AWC', 'BANPU', 'BBL', 'BDMS', 'BEM', 'BGRIM', 'BH', 'BTS',
      'CBG', 'CENTEL', 'COM7', 'CPALL', 'CPF', 'CPN', 'CRC', 'DELTA', 'EA', 'EGCO',
      'GLOBAL', 'GPSC', 'GULF', 'HMPRO', 'INTUCH', 'IVL', 'KBANK', 'KCE', 'KKP', 'KTB',
      'KTC', 'LH', 'MINT', 'MTC', 'OR', 'OSP', 'PTT', 'PTTEP', 'PTTGC', 'RATCH',
      'SAWAD', 'SCB', 'SCC', 'SCGP', 'TISCO', 'TLI', 'TOP', 'TRUE', 'TTB', 'TU'],
    us: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'AMD', 'CRM',
      'JPM', 'BAC', 'V', 'MA', 'GS', 'MS', 'JNJ', 'UNH', 'PFE', 'ABBV', 'LLY',
      'PG', 'KO', 'PEP', 'WMT', 'COST', 'MCD', 'NKE', 'SBUX', 'HD', 'DIS', 'NFLX',
      'XOM', 'CVX', 'COP', 'BA', 'CAT', 'GE', 'UPS', 'HON']
  };
  var L = IC.i18n({
    th: { scanBtn: 'หาหุ้นน่าสนใจ', scanBtnStop: '⏹ หยุด', greenOnlyLabel: 'เฉพาะไฟเขียว', thSym: 'หลักทรัพย์', thLast: 'ล่าสุด', thChg: '+/−', thPct: '%', thSig: 'สัญญาณ',
      rowLoading: 'กดดู', mkTh: 'SET50', mkUs: 'หุ้นดังสหรัฐฯ',
      scanDone: 'สแกนสำเร็จ {ok}/{total} ตัว · เจอน่าสนใจ {green} ตัว (ไม่ใช่คำแนะนำซื้อ)', scanProgress: 'กำลังสแกน {idx}/{total} ({sym})…' },
    en: { scanBtn: 'Find interesting stocks', scanBtnStop: '⏹ Stop', greenOnlyLabel: 'Green only', thSym: 'Ticker', thLast: 'Last', thChg: '+/−', thPct: '%', thSig: 'Signal',
      rowLoading: 'Click to view', mkTh: 'SET50', mkUs: 'US large caps',
      scanDone: 'Scanned {ok}/{total} · found {green} interesting (not a buy recommendation)', scanProgress: 'Scanning {idx}/{total} ({sym})…' }
  });
  var t = L.t;
  var inited = false, set = 'th', rows = {}, scanning = false;

  function suffix(s) { return s === 'th' ? '.BK' : ''; }
  function rankOf(l) { return l === 'green' ? 0 : l === 'yellow' ? 1 : l === 'red' ? 2 : 9; }
  function sigIcon(l) { return (l === 'green' || l === 'yellow' || l === 'red') ? '<span class="sigdot ' + l + '"></span>' : '·'; }
  function dataFromSeries(s) {
    if (!s || s.closes.length < 2) return null;
    var last = s.closes[s.closes.length - 1], prev = s.closes[s.closes.length - 2], light = '';
    if (s.closes.length >= 20) { try { light = Calc.analyzeSeries(s).light; } catch (e) {} }
    return { last: last, chg: last - prev, pct: prev ? (last - prev) / prev * 100 : 0, light: light };
  }
  function fillRow(tr, sym, d) {
    if (!d) {
      tr.innerHTML = '<td class="c-sym">' + sym + '</td><td class="num">–</td><td class="num c-chg">–</td><td class="num">–</td><td class="c-sig">' + t('rowLoading') + '</td>';
      tr.setAttribute('data-rank', 9); tr.setAttribute('data-light', ''); return;
    }
    var cls = d.chg >= 0 ? 'up' : 'dn', sign = d.chg >= 0 ? '+' : '−';
    tr.innerHTML = '<td class="c-sym">' + sym + '</td><td class="num">' + IC.fmt(d.last) + '</td><td class="num c-chg ' + cls + '">' + sign + IC.fmt(Math.abs(d.chg)) + '</td>' +
      '<td class="num ' + cls + '">' + sign + IC.fmt(Math.abs(d.pct), 2) + '%</td><td class="c-sig">' + sigIcon(d.light) + '</td>';
    tr.setAttribute('data-rank', rankOf(d.light)); tr.setAttribute('data-light', d.light || '');
  }
  function renderTable() {
    var body = $('scanBody'); body.innerHTML = ''; rows = {};
    SETS[set].forEach(function (sym) {
      var tr = document.createElement('tr'); tr.setAttribute('data-sym', sym);
      var ser = IC.loadSeries(sym + suffix(set));
      fillRow(tr, sym, dataFromSeries(ser));
      tr.addEventListener('click', function () { location.href = 'invest-stock.html?sym=' + encodeURIComponent(sym) + '#' + set; });
      body.appendChild(tr); rows[sym] = tr;
    });
    applyGreenFilter();
  }
  function sortTable() {
    var body = $('scanBody'), list = [].slice.call(body.querySelectorAll('tr'));
    list.sort(function (a, b) { var ra = +a.getAttribute('data-rank'), rb = +b.getAttribute('data-rank'); if (ra !== rb) return ra - rb; return a.getAttribute('data-sym') < b.getAttribute('data-sym') ? -1 : 1; });
    list.forEach(function (r) { body.appendChild(r); });
  }
  function applyGreenFilter() {
    var go = $('greenOnly').checked;
    Object.keys(rows).forEach(function (sym) { var tr = rows[sym]; tr.style.display = (go && tr.getAttribute('data-light') !== 'green') ? 'none' : ''; });
  }
  function doScan() {
    if (scanning) { scanning = false; return; }
    var list = SETS[set], mine = set, idx = 0, ok = 0, green = 0;
    scanning = true; $('scanBtn').textContent = t('scanBtnStop');
    function fin() {
      scanning = false; $('scanBtn').textContent = t('scanBtn');
      $('scanStatus').textContent = t('scanDone', { ok: ok, total: list.length, green: green });
      if (mine === set) { sortTable(); applyGreenFilter(); }
    }
    (function step() {
      if (!scanning || idx >= list.length || mine !== set) { fin(); return; }
      var sym = list[idx++];
      $('scanStatus').textContent = t('scanProgress', { idx: idx, total: list.length, sym: sym });
      IC.series(sym + suffix(set), { maxAge: 6 * 3600000 }).then(function (r) { return r.series; }, function () { return IC.loadSeries(sym + suffix(set)); }).then(function (s) {
        var d = dataFromSeries(s);
        if (d) { ok++; if (d.light === 'green') green++; if (rows[sym]) fillRow(rows[sym], sym, d); }
        if (idx % 5 === 0) { sortTable(); applyGreenFilter(); }
        setTimeout(step, 150);
      });
    })();
  }
  function setMarket(m) {
    if (m === set && inited && $('scanBody').children.length) return;
    scanning = false; set = m;
    [].forEach.call($('scanSeg').querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-set') === m ? 'true' : 'false'); });
    $('scanBtn').textContent = t('scanBtn'); $('scanStatus').textContent = '';
    renderTable();
  }
  /* key = 'th' | 'us' — ตลาดที่เลือกตอนเปิดแท็บ (จำค่าเดิมถ้าไม่ส่ง) */
  function init(key) {
    if (!inited) {
      inited = true;
      L.apply($('panelScan'));
      $('scanBtn').addEventListener('click', doScan);
      $('greenOnly').addEventListener('change', applyGreenFilter);
      $('scanSeg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setMarket(b.getAttribute('data-set')); });
      IC.onLang(function () { L.apply($('panelScan')); if (!scanning) $('scanBtn').textContent = t('scanBtn'); renderTable(); });
      if (window.TanotData && window.TanotData.onChange) window.TanotData.onChange(function () { if (!scanning && !$('panelScan').hidden) renderTable(); });
    }
    setMarket(key || set);
  }
  window.InvestScan = { init: init, SETS: SETS };
})();
