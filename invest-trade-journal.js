/* ══════════════════════════════════════════════════════════════════
   Tanot — สมุดเทรดรวม (ยุบรวมหน้าลงทุน ขั้น 5, docs/invest-consolidation-design.md หัวข้อ 3.3)
   อ่านคีย์เดิม 3 คีย์ (thjournal / globaljournal / btcjournal) แล้ว normalize ด้วย InvestCalc.journalRows — ไม่มีคีย์ใหม่ ไม่ย้ายข้อมูล
   • แท็บ #all #th #us #btc (InvestCore.tabs) — #all นับไม้/อัตราชนะรวม, P/L แยกสกุล (฿ และ $) + ≈ ฿ ถ้ามีอัตรา USD/THB
   • เพิ่มไม้เขียน "รูปแบบเดิมของคีย์นั้นตรงตัว": th/us {sym,en,ex,sh,pl,ts} · btc {en,ex,qty,pl,ts} (ไม่มี sym เหมือนเดิม)
   • เขียนคีย์แบบ อ่านสด → แก้ → เขียน ทุกครั้ง ไม่ถืออาร์เรย์ค้าง · ลบ = กรองด้วย ts ในคีย์ต้นทางของแถวนั้นเท่านั้น (ไม่ใช้ดัชนี)
   • ไม่มีสำรอง Google Drive แล้ว (ใช้ drive-backup.js + ซิงก์ D1)
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IC = window.InvestCore, Calc = window.InvestCalc;
  var $ = function (id) { return document.getElementById(id); };
  var esc = IC.esc, P = 'tanot:invest:';
  var TABS = ['all', 'th', 'us', 'btc'];

  var L = IC.i18n({
    th: {
      crumbHome: 'การลงทุน', crumbHere: 'สมุดเทรด', pageTitle: 'สมุดเทรด + สถิติ',
      tabAll: 'ทั้งหมด', tabTh: 'หุ้นไทย', tabUs: 'หุ้นต่างประเทศ', tabBtc: 'Bitcoin',
      jMarketLabel: 'ตลาด', mTh: 'หุ้นไทย', mUs: 'หุ้นต่างประเทศ', mBtc: 'Bitcoin',
      jSymLabel: 'หุ้น', jEntryLabel: 'ราคาเข้า', jExitLabel: 'ราคาออก', jSharesLabel: 'จำนวนหุ้น', jQtyBtcLabel: 'จำนวน BTC', jAddBtn: 'บันทึกไม้', jDelTitle: 'ลบ',
      alertJournalFields: 'กรอกราคาเข้า ราคาออก และจำนวนให้ครบ', jSymFallback: 'หุ้น',
      jEmptyDefault: 'ยังไม่มีไม้ที่บันทึก',
      jStatCount: 'จำนวนไม้', jStatWinRate: 'อัตราชนะ', jStatTotalPl: 'กำไร/ขาดทุนรวม', jStatExpectancy: 'คาดหวัง/ไม้', jStatPlThb: 'กำไร/ขาดทุนรวม (฿)', jStatPlUsd: 'กำไร/ขาดทุนรวม ($)', jStatApprox: '≈ รวมเป็นบาท {v}',
      jThMarket: 'ตลาด', jThSym: 'สินทรัพย์', jThEntry: 'เข้า', jThExit: 'ออก', jThQty: 'จำนวน', jThResult: 'ผล'
    },
    en: {
      crumbHome: 'Investing', crumbHere: 'Trade Journal', pageTitle: 'Trade Journal + Stats',
      tabAll: 'All', tabTh: 'Thai stocks', tabUs: 'Global stocks', tabBtc: 'Bitcoin',
      jMarketLabel: 'Market', mTh: 'Thai stocks', mUs: 'Global stocks', mBtc: 'Bitcoin',
      jSymLabel: 'Stock', jEntryLabel: 'Entry price', jExitLabel: 'Exit price', jSharesLabel: 'Shares', jQtyBtcLabel: 'BTC amount', jAddBtn: 'Log Trade', jDelTitle: 'Delete',
      alertJournalFields: 'Please fill in entry price, exit price and quantity', jSymFallback: 'Stock',
      jEmptyDefault: 'No trades logged yet',
      jStatCount: 'Trades', jStatWinRate: 'Win rate', jStatTotalPl: 'Total P/L', jStatExpectancy: 'Expectancy/trade', jStatPlThb: 'Total P/L (฿)', jStatPlUsd: 'Total P/L ($)', jStatApprox: '≈ {v} in baht',
      jThMarket: 'Market', jThSym: 'Asset', jThEntry: 'Entry', jThExit: 'Exit', jThQty: 'Qty', jThResult: 'Result'
    }
  });
  var t = L.t;
  var tab = 'all', tabsCtl = null;

  /* ── อ่านสด (ไม่ถือค้าง) ── */
  function load(key) { try { var a = JSON.parse(localStorage.getItem(P + key)); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function rowsAll() { return Calc.journalRows(load('thjournal'), load('globaljournal'), load('btcjournal')); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function money(n, ccy, d) { return IC.money(n, ccy, d == null ? 0 : d); }
  function signed(n, ccy) { return (n >= 0 ? '+' : '−') + money(Math.abs(n), ccy); }
  function usdThb() { var o = IC.lsJson(P + 'fxcache'); return (o && isFinite(o.rate) && o.rate > 0) ? +o.rate : null; }

  function renderStats(rows) {
    var el = $('jStats');
    if (!rows.length) { el.style.display = 'none'; return; }
    var s = Calc.journalStats(rows), cls = function (v) { return v >= 0 ? 'pl-up' : 'pl-dn'; };
    var html = '<div class="kpi"><span class="kpi-label">' + esc(t('jStatCount')) + '</span><span class="kpi-value" data-k="n">' + s.n + '</span></div>' +
      '<div class="kpi"><span class="kpi-label">' + esc(t('jStatWinRate')) + '</span><span class="kpi-value" data-k="win">' + s.winRate.toFixed(0) + '%</span></div>';
    if (tab === 'all') {
      var thb = 0, usd = 0, hasThb = false, hasUsd = false;
      rows.forEach(function (r) { if (r.ccy === 'THB') { thb += r.pl; hasThb = true; } else { usd += r.pl; hasUsd = true; } });
      if (hasThb) html += '<div class="kpi"><span class="kpi-label">' + esc(t('jStatPlThb')) + '</span><span class="kpi-value ' + cls(thb) + '" data-k="plthb">' + signed(thb, 'THB') + '</span></div>';
      if (hasUsd) {
        var fx = usdThb(), approx = fx && hasThb ? thb + usd * fx : (fx ? usd * fx : null);
        html += '<div class="kpi"><span class="kpi-label">' + esc(t('jStatPlUsd')) + '</span><span class="kpi-value ' + cls(usd) + '" data-k="plusd">' + signed(usd, 'USD') + '</span>' +
          (fx && hasThb ? '<div class="kpi-sub" data-k="approx">' + esc(t('jStatApprox', { v: signed(approx, 'THB') })) + '</div>' : '') + '</div>';
      }
    } else {
      var ccy = rows[0].ccy;
      html += '<div class="kpi"><span class="kpi-label">' + esc(t('jStatTotalPl')) + '</span><span class="kpi-value ' + cls(s.total) + '" data-k="pl">' + signed(s.total, ccy) + '</span></div>' +
        '<div class="kpi"><span class="kpi-label">' + esc(t('jStatExpectancy')) + '</span><span class="kpi-value ' + cls(s.expectancy) + '" data-k="exp">' + signed(s.expectancy, ccy) + '</span></div>';
    }
    el.innerHTML = html; el.style.display = 'grid';
  }
  var MK = { th: 'mTh', us: 'mUs', btc: 'mBtc' };
  function render() {
    var all = rowsAll();
    var rows = tab === 'all' ? all : all.filter(function (r) { return r.market === tab; });
    var box = $('jBox');
    renderStats(rows);
    if (!rows.length) { box.innerHTML = '<div class="empty">' + esc(t('jEmptyDefault')) + '</div>'; return; }
    var list = rows.slice().sort(function (a, b) { return b.ts - a.ts; });
    var html = '<div class="table-wrap"><table class="table right"><thead><tr><th>' + esc(t('jThMarket')) + '</th><th>' + esc(t('jThSym')) + '</th><th class="num">' + esc(t('jThEntry')) + '</th><th class="num">' + esc(t('jThExit')) + '</th><th class="num">' + esc(t('jThQty')) + '</th><th class="num">' + esc(t('jThResult')) + '</th><th></th></tr></thead><tbody>';
    list.forEach(function (r) {
      html += '<tr data-key="' + r.key + '" data-ts="' + r.ts + '"><td><span class="mk">' + esc(t(MK[r.market])) + '</span></td><td>' + esc(r.sym) + '</td><td class="num">' + IC.fmt(r.entry) + '</td><td class="num">' + IC.fmt(r.exit) + '</td><td class="num">' + IC.fmt(r.qty, r.market === 'btc' ? 6 : 0) + '</td>' +
        '<td class="num ' + (r.pl >= 0 ? 'pl-up' : 'pl-dn') + '">' + signed(r.pl, r.ccy) + '</td>' +
        '<td class="num"><button class="btn sm ghost icon jdel" type="button" aria-label="' + esc(t('jDelTitle')) + '"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-x"/></svg></button></td></tr>';
    });
    box.innerHTML = html + '</tbody></table></div>';
  }

  /* ── เพิ่ม/ลบ: อ่านสด → แก้ → เขียน ── */
  function uniqueTs(list) { var ts = Date.now(); while (list.some(function (r) { return r && r.ts === ts; })) ts++; return ts; }
  function addTrade() {
    var market = $('jMarket').value, en = num($('jEntry').value), ex = num($('jExit').value), q = num($('jQty').value);
    if (!isFinite(en) || !isFinite(ex) || !isFinite(q) || q <= 0) { (window.tanotAlert || window.alert)(t('alertJournalFields')); return; }
    var key = P + Calc.JOURNAL_KEYS[market], list = load(Calc.JOURNAL_KEYS[market]), ts = uniqueTs(list), row;
    if (market === 'btc') row = { en: en, ex: ex, qty: q, pl: (ex - en) * q, ts: ts };
    else row = { sym: ($('jSym').value || '').trim().toUpperCase() || t('jSymFallback'), en: en, ex: ex, sh: q, pl: (ex - en) * q, ts: ts };
    list.push(row);
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
    $('jEntry').value = ''; $('jExit').value = ''; $('jQty').value = '';
    render();
  }
  $('jBox').addEventListener('click', function (e) {
    var b = e.target.closest('.jdel'); if (!b) return;
    var tr = b.closest('tr'), name = tr.getAttribute('data-key'), ts = Number(tr.getAttribute('data-ts'));
    var key = P + name, list = load(name).filter(function (r) { return !(r && r.ts === ts); });
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (err) {}
    render();
  });
  $('jAdd').addEventListener('click', addTrade);

  /* ── ฟอร์ม: ตลาดเริ่มต้น = แท็บที่เปิด (#all → หุ้นไทย) · BTC ไม่มีช่องชื่อและใช้หน่วย BTC ── */
  function syncForm() {
    var m = $('jMarket').value;
    $('jSymField').style.display = m === 'btc' ? 'none' : '';
    $('jQtyLabel').setAttribute('data-i18n', m === 'btc' ? 'jQtyBtcLabel' : 'jSharesLabel');
    $('jQtyLabel').textContent = t(m === 'btc' ? 'jQtyBtcLabel' : 'jSharesLabel');
    $('jSym').placeholder = m === 'us' ? 'AAPL' : 'PTT';
    $('jEntry').placeholder = m === 'btc' ? '60000' : m === 'us' ? '150.25' : '34.75';
    $('jQty').placeholder = m === 'btc' ? '0.01' : '300';
  }
  $('jMarket').addEventListener('change', syncForm);

  function onTab(key) {
    tab = key;
    $('jMarket').value = key === 'all' ? 'th' : key;
    syncForm(); render();
  }
  tabsCtl = IC.tabs({ el: $('jTabs'), page: 'journal', def: 'all', t: t,
    tabs: [{ key: 'all', labelKey: 'tabAll' }, { key: 'th', labelKey: 'tabTh' }, { key: 'us', labelKey: 'tabUs' }, { key: 'btc', labelKey: 'tabBtc' }],
    onShow: onTab });

  IC.subnav($('ivSubRow'), 'journal');
  L.apply(); syncForm();
  IC.onLang(function () { L.apply(); IC.subnav($('ivSubRow'), 'journal'); tabsCtl.rerender(); syncForm(); render(); });
  if (window.TanotData && window.TanotData.onChange) window.TanotData.onChange(function () { render(); });
})();
