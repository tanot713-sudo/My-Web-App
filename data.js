/* data.html — สถานะซิงก์, สำรอง/กู้คืน (Drive + ไฟล์), ค่าที่ถูกแทนจากการซิงก์ (กู้คืนได้) */
(function () {
  'use strict';

  var TD = window.TanotData;
  var $ = function (id) { return document.getElementById(id); };
  var STATE = { idle: 'รอ', syncing: 'กำลังซิงก์', ok: 'ปกติ', offline: 'ออฟไลน์', auth: 'ต้องเข้าสู่ระบบใหม่', error: 'ผิดพลาด' };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function when(ts) { return ts ? new Date(ts).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—'; }
  function msg(el, t, ok) { el.textContent = t; el.className = 'dt-status ' + (ok === true ? 'dt-ok' : ok === false ? 'dt-err' : ''); }

  /* ── ซิงก์ ── */
  function renderStatus(s) {
    if (!TD.enabled) {
      $('dtState').textContent = 'ปิด';
      $('dtSyncNow').disabled = true;
      msg($('dtSyncMsg'), 'ซิงก์ใช้ได้บน my-web-app-5w2.pages.dev', null);
      return;
    }
    $('dtState').textContent = STATE[s.state] || s.state;
    $('dtLast').textContent = when(s.lastSyncAt);
    $('dtPending').textContent = String(s.pending);
    var extra = [];
    if (s.lastError) extra.push(s.lastError);
    if (s.skipped && s.skipped.length) extra.push('ไม่ได้ซิงก์: ' + s.skipped.join(', '));
    msg($('dtSyncMsg'), extra.join(' · '), s.lastError ? false : null);
  }
  window.addEventListener('tanot:sync-status', function (e) { renderStatus(e.detail); });
  window.addEventListener('tanot:data', loadHistory);
  renderStatus(TD.status());
  $('dtSyncNow').addEventListener('click', function () { TD.syncNow().then(function () { loadHistory(); }); });

  /* ── นำเข้า (ไฟล์/Drive) ── */
  function showPlan(snap, source) {
    return TD.planImport(snap).then(function (plan) {
      var el = $('dtPlan');
      el.hidden = false;
      TanotImportUI.render(el, plan, { source: source, onDone: function () { if (TD.enabled) TD.syncNow(); } });
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  $('dtFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    f.text().then(function (t) { return showPlan(JSON.parse(t), 'file:' + f.name); })
      .catch(function (e) { msg($('dtBackupMsg'), 'อ่านไฟล์ไม่ได้: ' + (e && e.message || e), false); });
    this.value = '';
  });
  $('dtDownload').addEventListener('click', function () {
    TD.snapshot().then(function (snap) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(snap)], { type: 'application/json' }));
      a.download = 'tanot-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    });
  });

  /* ── Google Drive ── */
  var last = window.DriveBackup && DriveBackup.lastBackupAt();
  if (last) msg($('dtBackupMsg'), 'สำรองขึ้น Drive ล่าสุด ' + when(last), null);
  $('dtDriveBackup').addEventListener('click', function () {
    msg($('dtBackupMsg'), 'กำลังสำรอง…', null);
    DriveBackup.backupNow().then(function (r) { msg($('dtBackupMsg'), 'สำรองแล้ว: ' + r.name + ' (' + r.keys + ' คีย์)', true); })
      .catch(function (e) { msg($('dtBackupMsg'), 'สำรองไม่สำเร็จ: ' + (e && e.message || e), false); });
  });
  $('dtDriveList').addEventListener('click', function () {
    var box = $('dtDriveFiles');
    msg($('dtBackupMsg'), 'กำลังโหลดรายการ…', null);
    DriveBackup.list().then(function (files) {
      msg($('dtBackupMsg'), files.length ? '' : 'ยังไม่มีไฟล์สำรองบน Drive', null);
      box.innerHTML = files.map(function (f) {
        return '<div class="list-row"><span class="dt-key">' + esc(f.name) + '</span>' +
          '<button type="button" class="btn sm" data-id="' + esc(f.id) + '" data-name="' + esc(f.name) + '">ตรวจก่อนกู้คืน</button></div>';
      }).join('');
      [].forEach.call(box.querySelectorAll('button[data-id]'), function (b) {
        b.addEventListener('click', function () {
          DriveBackup.download(b.getAttribute('data-id')).then(function (snap) { return showPlan(snap, 'drive:' + b.getAttribute('data-name')); })
            .catch(function (e) { msg($('dtBackupMsg'), 'ดาวน์โหลดไม่สำเร็จ: ' + (e && e.message || e), false); });
        });
      });
    }).catch(function (e) { msg($('dtBackupMsg'), 'เชื่อมต่อ Drive ไม่สำเร็จ: ' + (e && e.message || e), false); });
  });

  /* ── history ── */
  function loadHistory() {
    TD.history().then(function (rows) {
      $('dtHistoryCard').hidden = !rows.length;
      $('dtHistory').innerHTML = rows.slice().reverse().map(function (h) {
        var v = h.data == null ? '' : h.data.length > 60 ? h.data.slice(0, 60) + '…' : h.data;
        return '<tr><td>' + when(h.at) + '</td><td class="dt-key">' + esc(h.key + (h.id !== h.key ? ' · ' + h.id : '')) + '</td>' +
          '<td class="dt-key">' + esc(v) + '</td><td><button type="button" class="btn sm" data-n="' + h.n + '">กู้คืน</button></td></tr>';
      }).join('');
      [].forEach.call($('dtHistory').querySelectorAll('button[data-n]'), function (b) {
        b.addEventListener('click', function () {
          TD.restoreHistory(+b.getAttribute('data-n')).then(function () { b.disabled = true; b.textContent = 'กู้คืนแล้ว'; if (TD.enabled) TD.syncNow(); });
        });
      });
    }).catch(function () {});
  }
  loadHistory();
})();
