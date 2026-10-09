/* data.html — สถานะซิงก์, สำรอง/กู้คืน (Drive + ไฟล์), ค่าที่ถูกแทนจากการซิงก์ (กู้คืนได้) */
(function () {
  'use strict';

  var TD = window.TanotData;
  var $ = function (id) { return document.getElementById(id); };
  var T = OME_I18N.scope('dt', {
    th: {
      title: 'ข้อมูลและการซิงก์', sync: 'ซิงก์', syncNow: 'ซิงก์ตอนนี้', state: 'สถานะ', lastSync: 'ซิงก์ล่าสุด', pending: 'รอส่ง', backup: 'สำรองข้อมูล',
      driveBackup: 'สำรองขึ้น Google Drive', driveList: 'กู้คืนจาก Google Drive', download: 'ดาวน์โหลดไฟล์', importFile: 'นำเข้าจากไฟล์',
      migrate: 'ย้ายข้อมูลจาก github.io', replaced: 'ค่าที่ถูกแทนด้วยข้อมูลจากเครื่องอื่น',
      stIdle: 'รอ', stSyncing: 'กำลังซิงก์', stOk: 'ปกติ', stOffline: 'ออฟไลน์', stAuth: 'ต้องเข้าสู่ระบบใหม่', stError: 'ผิดพลาด', stOff: 'ปิด',
      onlyPages: 'ซิงก์ใช้ได้บน my-web-app-5w2.pages.dev', skipped: 'ไม่ได้ซิงก์: ',
      readFail: 'อ่านไฟล์ไม่ได้: {err}', lastDrive: 'สำรองขึ้น Drive ล่าสุด {when}', backing: 'กำลังสำรอง…', backed: 'สำรองแล้ว: {name} ({keys} คีย์)',
      backFail: 'สำรองไม่สำเร็จ: {err}', loadingList: 'กำลังโหลดรายการ…', noFiles: 'ยังไม่มีไฟล์สำรองบน Drive', inspect: 'ตรวจก่อนกู้คืน',
      dlFail: 'ดาวน์โหลดไม่สำเร็จ: {err}', connFail: 'เชื่อมต่อ Drive ไม่สำเร็จ: {err}', restore: 'กู้คืน', restored: 'กู้คืนแล้ว',
      gis: 'โหลด Google Identity Services ไม่ได้'
    },
    en: {
      title: 'Data & sync', sync: 'Sync', syncNow: 'Sync now', state: 'Status', lastSync: 'Last synced', pending: 'Waiting to send', backup: 'Backup',
      driveBackup: 'Back up to Google Drive', driveList: 'Restore from Google Drive', download: 'Download file', importFile: 'Import from file',
      migrate: 'Move data from github.io', replaced: 'Values replaced by data from another device',
      stIdle: 'Idle', stSyncing: 'Syncing', stOk: 'OK', stOffline: 'Offline', stAuth: 'Sign in again', stError: 'Error', stOff: 'Off',
      onlyPages: 'Sync is available on my-web-app-5w2.pages.dev', skipped: 'Not synced: ',
      readFail: 'Could not read the file: {err}', lastDrive: 'Last Drive backup {when}', backing: 'Backing up…', backed: 'Backed up: {name} ({keys} keys)',
      backFail: 'Backup failed: {err}', loadingList: 'Loading the list…', noFiles: 'No backup files on Drive yet', inspect: 'Review before restoring',
      dlFail: 'Download failed: {err}', connFail: 'Could not connect to Drive: {err}', restore: 'Restore', restored: 'Restored',
      gis: 'Could not load Google Identity Services'
    }
  });
  var STATE = { idle: 'stIdle', syncing: 'stSyncing', ok: 'stOk', offline: 'stOffline', auth: 'stAuth', error: 'stError' };
  var GIS_TH = 'โหลด Google Identity Services ไม่ได้';
  function errText(e) { var m = e && e.message || e; return m === GIS_TH ? T('gis') : String(m); } /* ข้อความจาก drive-backup.js เป็นไทยข้อเดียว — แปลที่หน้า */
  var lastStatus = null;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function when(ts) { return ts ? OME_I18N.date(ts, { dateStyle: 'short', timeStyle: 'short' }) : '—'; }
  /* t = ข้อความ หรือฟังก์ชันที่คืนข้อความตามภาษาปัจจุบัน (แปลสดตอนสลับภาษา) */
  function msg(el, t, ok) { OME_I18N.live(el, typeof t === 'function' ? t : function () { return t; }); el.className = 'dt-status ' + (ok === true ? 'dt-ok' : ok === false ? 'dt-err' : ''); }

  /* ── ซิงก์ ── */
  function renderStatus(s) {
    lastStatus = s;
    if (!TD.enabled) {
      OME_I18N.live($('dtState'), function () { return T('stOff'); });
      $('dtSyncNow').disabled = true;
      msg($('dtSyncMsg'), function () { return T('onlyPages'); }, null);
      return;
    }
    OME_I18N.live($('dtState'), function () { return STATE[s.state] ? T(STATE[s.state]) : s.state; });
    OME_I18N.live($('dtLast'), function () { return when(s.lastSyncAt); });
    $('dtPending').textContent = String(s.pending);
    var extra = [];
    if (s.lastError) extra.push(s.lastError);
    msg($('dtSyncMsg'), function () { return extra.concat(s.skipped && s.skipped.length ? [T('skipped') + s.skipped.join(', ')] : []).join(' · '); }, s.lastError ? false : null);
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
      .catch(function (e) { msg($('dtBackupMsg'), function () { return T('readFail', { err: errText(e) }); }, false); });
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
  if (last) msg($('dtBackupMsg'), function () { return T('lastDrive', { when: when(last) }); }, null);
  $('dtDriveBackup').addEventListener('click', function () {
    msg($('dtBackupMsg'), function () { return T('backing'); }, null);
    DriveBackup.backupNow().then(function (r) { msg($('dtBackupMsg'), function () { return T('backed', { name: r.name, keys: r.keys }); }, true); })
      .catch(function (e) { msg($('dtBackupMsg'), function () { return T('backFail', { err: errText(e) }); }, false); });
  });
  $('dtDriveList').addEventListener('click', function () {
    var box = $('dtDriveFiles');
    msg($('dtBackupMsg'), function () { return T('loadingList'); }, null);
    DriveBackup.list().then(function (files) {
      msg($('dtBackupMsg'), function () { return files.length ? '' : T('noFiles'); }, null);
      box.innerHTML = files.map(function (f) {
        return '<div class="list-row"><span class="dt-key">' + esc(f.name) + '</span>' +
          '<button type="button" class="btn sm" data-id="' + esc(f.id) + '" data-name="' + esc(f.name) + '" data-i18n="dt.inspect">' + T('inspect') + '</button></div>';
      }).join('');
      [].forEach.call(box.querySelectorAll('button[data-id]'), function (b) {
        b.addEventListener('click', function () {
          DriveBackup.download(b.getAttribute('data-id')).then(function (snap) { return showPlan(snap, 'drive:' + b.getAttribute('data-name')); })
            .catch(function (e) { msg($('dtBackupMsg'), function () { return T('dlFail', { err: errText(e) }); }, false); });
        });
      });
    }).catch(function (e) { msg($('dtBackupMsg'), function () { return T('connFail', { err: errText(e) }); }, false); });
  });

  /* ── history ── */
  function loadHistory() {
    TD.history().then(function (rows) {
      $('dtHistoryCard').hidden = !rows.length;
      $('dtHistory').innerHTML = rows.slice().reverse().map(function (h) {
        var v = h.data == null ? '' : h.data.length > 60 ? h.data.slice(0, 60) + '…' : h.data;
        return '<tr><td>' + when(h.at) + '</td><td class="dt-key" data-i18n-skip>' + esc(h.key + (h.id !== h.key ? ' · ' + h.id : '')) + '</td>' +
          '<td class="dt-key" data-i18n-skip>' + esc(v) + '</td><td><button type="button" class="btn sm" data-n="' + h.n + '" data-i18n="dt.restore">' + T('restore') + '</button></td></tr>';
      }).join('');
      [].forEach.call($('dtHistory').querySelectorAll('button[data-n]'), function (b) {
        b.addEventListener('click', function () {
          TD.restoreHistory(+b.getAttribute('data-n')).then(function () { b.disabled = true; b.setAttribute('data-i18n', 'dt.restored'); b.textContent = T('restored'); if (TD.enabled) TD.syncNow(); });
        });
      });
    }).catch(function () {});
  }
  loadHistory();
  window.OME_PAGE_LIVE_LANG = true;
  OME_LANG.onChange(function () { loadHistory(); });
})();
