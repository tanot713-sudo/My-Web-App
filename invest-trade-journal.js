/* ══════════════════════════════════════════════════════════════════
   Tanot — สมุดเทรด + สถิติ (แยกออกมาจากหน้าหุ้นไทยเดิม)
   ใช้ InvestDrive (invest-drivesync.js) สำหรับอ่าน/เขียน + สำรองขึ้น Google Drive ร่วมกับพอร์ตหุ้นไทย
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }

  var loadJn = window.InvestDrive.loadJn, saveJn = window.InvestDrive.saveJn, DriveSync = window.InvestDrive.DriveSync;

  /* ══════ ระบบแปลภาษา (i18n) — รูปแบบเดียวกับหน้าอื่นในโซนลงทุน ══════ */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      navOverview: 'ภาพรวม', navMyPortfolio: 'พอร์ตของฉัน', navMarket: 'ตลาด & สินทรัพย์', navLottery: 'สลาก & พันธบัตร', navNews: 'ข่าว & ธุรกิจ',
      crumbHome: 'การลงทุน', crumbThaiStock: 'หุ้นไทย', crumbHere: 'สมุดเทรด',
      pageTitle: 'สมุดเทรด + สถิติ', pageDesc: 'บันทึกไม้ที่ปิดแล้วทุกไม้ เพื่อดูอัตราชนะและกำไรเฉลี่ยจริง — ไม่หลอกตัวเอง',
      jSymLabel: 'หุ้น', jEntryLabel: 'ราคาเข้า', jExitLabel: 'ราคาออก', jSharesLabel: 'จำนวนหุ้น', jAddBtn: '+ บันทึกไม้',
      driveTitle: 'สำรองพอร์ต + สมุดเทรดขึ้น Google Drive',
      driveDesc: 'เชื่อมต่อครั้งเดียว จากนั้นพอร์ตหุ้นไทย (ในหน้าหุ้นไทย) และสมุดเทรดนี้จะซิงก์ขึ้น Drive ให้อัตโนมัติทุกครั้งที่มีการเปลี่ยนแปลง (ไฟล์ในโฟลเดอร์ "OME_Progress" ของคุณเอง) — กันข้อมูลหายถ้าล้างเบราว์เซอร์ และดึงคืนได้เมื่อเปิดจากเครื่อง/เบราว์เซอร์อื่น',
      disc: 'เครื่องมือนี้เป็นตัวช่วยฝึกวินัยและดูสถิติจริงของตัวเอง ไม่ใช่คำแนะนำการลงทุน · ข้อมูลเก็บในเครื่องคุณเป็นหลัก (สำรองขึ้น Google Drive ส่วนตัวได้ถ้าเลือกเชื่อมต่อ)',
      alertJournalFields: 'กรอกราคาเข้า ราคาออก และจำนวนหุ้นให้ครบ', jSymFallback: 'หุ้น',
      jEmptyDefault: 'ยังไม่มีไม้ที่บันทึก — ปิดไม้แล้วบันทึกทุกครั้ง จะเห็นสถิติจริงของตัวเอง',
      jStatCount: 'จำนวนไม้', jStatWinRate: 'อัตราชนะ', jStatTotalPl: 'กำไร/ขาดทุนรวม', jStatExpectancy: 'คาดหวัง/ไม้',
      jThSym: 'หุ้น', jThEntry: 'เข้า', jThExit: 'ออก', jThShares: 'จำนวน', jThResult: 'ผล'
    },
    en: {
      navOverview: 'Overview', navMyPortfolio: 'My Portfolio', navMarket: 'Markets & Assets', navLottery: 'Lottery & Bonds', navNews: 'News & Business',
      crumbHome: 'Investing', crumbThaiStock: 'Thai Stocks', crumbHere: 'Trade Journal',
      pageTitle: 'Trade Journal + Stats', pageDesc: "Log every closed trade to see your real win rate and average profit — no self-deception",
      jSymLabel: 'Stock', jEntryLabel: 'Entry price', jExitLabel: 'Exit price', jSharesLabel: 'Shares', jAddBtn: '+ Log Trade',
      driveTitle: 'Back up Portfolio + Trade Journal to Google Drive',
      driveDesc: 'Connect once, and your Thai stock portfolio (on the Thai Stocks page) and this trade journal will sync to Drive automatically on every change (a file in your own "OME_Progress" folder) — protects your data if you clear your browser, and lets you restore it on another device/browser',
      disc: 'This tool helps you practice discipline and see your real stats — it is not investment advice · data is stored primarily on your device (optional personal Google Drive backup available)',
      alertJournalFields: 'Please fill in entry price, exit price, and share count', jSymFallback: 'Stock',
      jEmptyDefault: 'No trades logged yet — log every closed trade to see your real stats',
      jStatCount: 'Trades', jStatWinRate: 'Win rate', jStatTotalPl: 'Total P/L', jStatExpectancy: 'Expectancy/trade',
      jThSym: 'Stock', jThEntry: 'Entry', jThExit: 'Exit', jThShares: 'Shares', jThResult: 'Result'
    }
  };
  function t(key, vars) {
    var s = (I18N[getUILang()] || I18N.th)[key];
    if (s == null) s = I18N.th[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
  }

  function addJournal() {
    var sym = ($('jSym').value || '').trim().toUpperCase() || t('jSymFallback');
    var en = num($('jEntry').value), ex = num($('jExit').value), sh = num($('jShares').value);
    if (!isFinite(en) || !isFinite(ex) || !isFinite(sh) || sh <= 0) { alert(t('alertJournalFields')); return; }
    var jn = loadJn(); jn.push({ sym: sym, en: en, ex: ex, sh: sh, pl: (ex - en) * sh, ts: Date.now() });
    saveJn(jn); $('jEntry').value = ''; $('jExit').value = ''; $('jShares').value = ''; renderJournal();
  }
  function renderJournal() {
    var jn = loadJn(), box = $('jBox'), stats = $('jStats');
    if (!jn.length) { box.innerHTML = '<div class="empty">' + t('jEmptyDefault') + '</div>'; stats.style.display = 'none'; return; }
    var wins = jn.filter(function (r) { return r.pl > 0; }), losses = jn.filter(function (r) { return r.pl <= 0; });
    var total = jn.reduce(function (s, r) { return s + r.pl; }, 0);
    var winRate = wins.length / jn.length * 100;
    var avgWin = wins.length ? wins.reduce(function (s, r) { return s + r.pl; }, 0) / wins.length : 0;
    var avgLoss = losses.length ? Math.abs(losses.reduce(function (s, r) { return s + r.pl; }, 0) / losses.length) : 0;
    var expBaht = (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss;
    stats.style.display = 'grid';
    stats.innerHTML =
      '<div class="jstat"><span>' + t('jStatCount') + '</span><b>' + jn.length + '</b></div>' +
      '<div class="jstat"><span>' + t('jStatWinRate') + '</span><b>' + winRate.toFixed(0) + '%</b></div>' +
      '<div class="jstat"><span>' + t('jStatTotalPl') + '</span><b style="color:' + (total >= 0 ? 'var(--ok)' : 'var(--err)') + '">' + (total >= 0 ? '+' : '−') + '฿' + fmt0(Math.abs(total)) + '</b></div>' +
      '<div class="jstat"><span>' + t('jStatExpectancy') + '</span><b style="color:' + (expBaht >= 0 ? 'var(--ok)' : 'var(--err)') + '">' + (expBaht >= 0 ? '+' : '−') + '฿' + fmt0(Math.abs(expBaht)) + '</b></div>';
    var html = '<table><thead><tr><th>' + t('jThSym') + '</th><th>' + t('jThEntry') + '</th><th>' + t('jThExit') + '</th><th>' + t('jThShares') + '</th><th>' + t('jThResult') + '</th><th></th></tr></thead><tbody>';
    jn.slice().reverse().forEach(function (r, ri) {
      var idx = jn.length - 1 - ri;
      html += '<tr><td>' + r.sym + '</td><td class="num">' + fmt(r.en) + '</td><td class="num">' + fmt(r.ex) + '</td><td class="num">' + fmt0(r.sh) + '</td>' +
        '<td class="num ' + (r.pl >= 0 ? 'win' : 'loss') + '">' + (r.pl >= 0 ? '+' : '−') + '฿' + fmt0(Math.abs(r.pl)) + '</td>' +
        '<td><button class="jdel" data-i="' + idx + '">✕</button></td></tr>';
    });
    html += '</tbody></table>'; box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.jdel'), function (b) { b.addEventListener('click', function () { var jn2 = loadJn(); jn2.splice(+b.getAttribute('data-i'), 1); saveJn(jn2); renderJournal(); }); });
  }

  applyStaticI18n();
  $('jAdd').addEventListener('click', addJournal);
  $('driveConnectBtn').addEventListener('click', function () { DriveSync.connect(); });
  DriveSync.onJnChange(renderJournal);
  renderJournal();
  DriveSync.init();

  var groupBtns = document.querySelectorAll('#ivGroups button');
  groupBtns.forEach(function (b) {
    b.addEventListener('click', function () { if (b.dataset.href) location.href = b.dataset.href; });
  });

  window.omeApplyLang = function () {
    applyStaticI18n();
    DriveSync.setBtn();
    renderJournal();
  };
})();
