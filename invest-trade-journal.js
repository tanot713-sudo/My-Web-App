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

  function addJournal() {
    var sym = ($('jSym').value || '').trim().toUpperCase() || 'หุ้น';
    var en = num($('jEntry').value), ex = num($('jExit').value), sh = num($('jShares').value);
    if (!isFinite(en) || !isFinite(ex) || !isFinite(sh) || sh <= 0) { alert('กรอกราคาเข้า ราคาออก และจำนวนหุ้นให้ครบ'); return; }
    var jn = loadJn(); jn.push({ sym: sym, en: en, ex: ex, sh: sh, pl: (ex - en) * sh, ts: Date.now() });
    saveJn(jn); $('jEntry').value = ''; $('jExit').value = ''; $('jShares').value = ''; renderJournal();
  }
  function renderJournal() {
    var jn = loadJn(), box = $('jBox'), stats = $('jStats');
    if (!jn.length) { box.innerHTML = '<div class="empty">ยังไม่มีไม้ที่บันทึก — ปิดไม้แล้วบันทึกทุกครั้ง จะเห็นสถิติจริงของตัวเอง</div>'; stats.style.display = 'none'; return; }
    var wins = jn.filter(function (r) { return r.pl > 0; }), losses = jn.filter(function (r) { return r.pl <= 0; });
    var total = jn.reduce(function (s, r) { return s + r.pl; }, 0);
    var winRate = wins.length / jn.length * 100;
    var avgWin = wins.length ? wins.reduce(function (s, r) { return s + r.pl; }, 0) / wins.length : 0;
    var avgLoss = losses.length ? Math.abs(losses.reduce(function (s, r) { return s + r.pl; }, 0) / losses.length) : 0;
    var expBaht = (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss;
    stats.style.display = 'grid';
    stats.innerHTML =
      '<div class="jstat"><span>จำนวนไม้</span><b>' + jn.length + '</b></div>' +
      '<div class="jstat"><span>อัตราชนะ</span><b>' + winRate.toFixed(0) + '%</b></div>' +
      '<div class="jstat"><span>กำไร/ขาดทุนรวม</span><b style="color:' + (total >= 0 ? 'var(--ok)' : 'var(--err)') + '">' + (total >= 0 ? '+' : '−') + '฿' + fmt0(Math.abs(total)) + '</b></div>' +
      '<div class="jstat"><span>คาดหวัง/ไม้</span><b style="color:' + (expBaht >= 0 ? 'var(--ok)' : 'var(--err)') + '">' + (expBaht >= 0 ? '+' : '−') + '฿' + fmt0(Math.abs(expBaht)) + '</b></div>';
    var html = '<table><thead><tr><th>หุ้น</th><th>เข้า</th><th>ออก</th><th>จำนวน</th><th>ผล</th><th></th></tr></thead><tbody>';
    jn.slice().reverse().forEach(function (r, ri) {
      var idx = jn.length - 1 - ri;
      html += '<tr><td>' + r.sym + '</td><td class="num">' + fmt(r.en) + '</td><td class="num">' + fmt(r.ex) + '</td><td class="num">' + fmt0(r.sh) + '</td>' +
        '<td class="num ' + (r.pl >= 0 ? 'win' : 'loss') + '">' + (r.pl >= 0 ? '+' : '−') + '฿' + fmt0(Math.abs(r.pl)) + '</td>' +
        '<td><button class="jdel" data-i="' + idx + '">✕</button></td></tr>';
    });
    html += '</tbody></table>'; box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.jdel'), function (b) { b.addEventListener('click', function () { var jn2 = loadJn(); jn2.splice(+b.getAttribute('data-i'), 1); saveJn(jn2); renderJournal(); }); });
  }

  $('jAdd').addEventListener('click', addJournal);
  $('driveConnectBtn').addEventListener('click', function () { DriveSync.connect(); });
  DriveSync.onJnChange(renderJournal);
  renderJournal();
  DriveSync.init();

  var groupBtns = document.querySelectorAll('#ivGroups button');
  groupBtns.forEach(function (b) {
    b.addEventListener('click', function () { if (b.dataset.href) location.href = b.dataset.href; });
  });
})();
