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
      gis: 'โหลด Google Identity Services ไม่ได้',
      models: 'โมเดล AI ในเครื่อง', modelClear: 'ล้างแคชโมเดล', modelSize: 'แคชโมเดล', storageUse: 'พื้นที่ที่เว็บนี้ใช้', persist: 'เก็บถาวร',
      yes: 'ใช่', no: 'ไม่', files: '{n} ไฟล์', modelCleared: 'ล้างแคชโมเดลแล้ว — ครั้งหน้าที่ใช้จะดาวน์โหลดใหม่', modelClearWhat: 'แคชโมเดล AI ในเครื่องนี้',
      log: 'บันทึกปัญหา', logCopy: 'คัดลอก', logClear: 'ล้าง', logEmpty: 'ยังไม่มีปัญหาที่บันทึกไว้', logCopied: 'คัดลอกแล้ว', logClearWhat: 'บันทึกปัญหาทั้งหมด',
      k_asr: 'ถอดเสียง', k_tts: 'เสียงพูด', k_ocr: 'OCR', k_chat: 'แชท AI', k_media: 'เสียง/สื่อ',
      c_oom: 'หน่วยความจำไม่พอ', c_crash: 'ตัวประมวลผลหยุดทำงาน', c_decode: 'ถอดรหัสไฟล์ไม่ได้', c_network: 'เครือข่าย', c_evicted: 'ถูกปิดเพื่อคืนหน่วยความจำ', c_other: 'อื่นๆ', c_info: 'สถิติ',
      e_local: 'ในเบราว์เซอร์', e_cloud: 'คลาวด์', offline: 'ออฟไลน์'
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
      gis: 'Could not load Google Identity Services',
      models: 'AI models on this device', modelClear: 'Clear model cache', modelSize: 'Model cache', storageUse: 'Storage used by this site', persist: 'Persistent',
      yes: 'Yes', no: 'No', files: '{n} files', modelCleared: 'Model cache cleared — models will download again next time', modelClearWhat: 'the AI model cache on this device',
      log: 'Problem log', logCopy: 'Copy', logClear: 'Clear', logEmpty: 'No problems recorded yet', logCopied: 'Copied', logClearWhat: 'the whole problem log',
      k_asr: 'Transcription', k_tts: 'Speech', k_ocr: 'OCR', k_chat: 'AI chat', k_media: 'Audio/media',
      c_oom: 'Out of memory', c_crash: 'Processor stopped', c_decode: 'Could not decode file', c_network: 'Network', c_evicted: 'Closed to free memory', c_other: 'Other', c_info: 'Stats',
      e_local: 'in browser', e_cloud: 'cloud', offline: 'offline'
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

  /* ── โมเดล AI ในเครื่อง + บันทึกปัญหา (media-core.js) ── */
  var TM = window.TanotMedia;
  function bytes(n) {
    if (n == null) return '—';
    var u = ['B', 'KB', 'MB', 'GB'], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return OME_I18N.number(Math.round(n * (i > 1 ? 10 : 1)) / (i > 1 ? 10 : 1)) + ' ' + u[i];
  }
  var modelInfo = null;
  function renderModels() {
    var m = modelInfo || {};
    $('dtModelSize').textContent = bytes(m.modelBytes) + (m.modelFiles ? ' · ' + T('files', { n: m.modelFiles }) : '');
    $('dtStorageUse').textContent = bytes(m.usage);
    $('dtPersist').textContent = m.persisted == null ? '—' : m.persisted ? T('yes') : T('no');
    $('dtModelClear').disabled = !m.modelBytes;
  }
  function loadModels() {
    if (!TM) return;
    TM.modelCacheInfo().then(function (info) { modelInfo = info; renderModels(); });
  }
  $('dtModelClear').addEventListener('click', function () {
    window.tanotConfirmDelete(T('modelClearWhat')).then(function (ok) {
      if (!ok) return;
      TM.clearModelCache().then(function () { msg($('dtModelMsg'), function () { return T('modelCleared'); }, true); loadModels(); });
    });
  });
  function renderLog() {
    var rows = TM ? TM.readLog().slice().reverse() : [];
    $('dtLogCopy').disabled = $('dtLogClear').disabled = !rows.length;
    if (!rows.length) { $('dtLog').innerHTML = '<div class="empty compact">' + esc(T('logEmpty')) + '</div>'; return; }
    $('dtLog').innerHTML = rows.map(function (r) {
      var kind = T('k_' + r.kind) || r.kind, code = T('c_' + r.code) || r.code;
      var head = kind + ' · ' + code + (r.engine ? ' · ' + (T('e_' + r.engine) || r.engine) : '');
      var f = r.file ? [r.file.ext || r.file.type, r.file.size ? bytes(r.file.size) : '', r.file.dur != null ? r.file.dur + ' s' : ''].filter(Boolean).join(' · ') : '';
      var dev = [r.mem ? r.mem + ' GB' : '', r.cores ? r.cores + ' cores' : '', r.online === false ? T('offline') : ''].filter(Boolean).join(' · ');
      return '<div class="list-row"><div class="grow">' +
        '<div class="title" title="' + esc(head) + '">' + esc(head) + '</div>' +
        '<div class="meta">' + esc(when(r.at)) + ' · <span data-i18n-skip>' + esc([r.page, r.stage, r.model, f, dev].filter(Boolean).join(' · ')) + '</span></div>' +
        (r.msg ? '<div class="dt-err-msg" data-i18n-skip>' + esc((r.name ? r.name + ': ' : '') + r.msg) + '</div>' : '') +
        '<div class="meta" data-i18n-skip>' + esc(r.ua || '') + '</div>' +
        '</div></div>';
    }).join('');
  }
  $('dtLogCopy').addEventListener('click', function () {
    var text = JSON.stringify(TM ? TM.readLog() : [], null, 2);
    var done = function () { msg($('dtLogMsg'), function () { return T('logCopied'); }, true); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallbackCopy);
    else fallbackCopy();
    function fallbackCopy() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      ta.remove();
    }
  });
  $('dtLogClear').addEventListener('click', function () {
    window.tanotConfirmDelete(T('logClearWhat')).then(function (ok) {
      if (!ok) return;
      TM.clearLog(); msg($('dtLogMsg'), '', null); renderLog();
    });
  });
  window.addEventListener('tanot:medialog', renderLog);
  window.addEventListener('storage', function (e) { if (TM && e.key === TM.LOG_KEY) renderLog(); });
  if (TM) { loadModels(); renderLog(); } else { $('dtModels').hidden = true; $('dtLogCard').hidden = true; }

  window.OME_PAGE_LIVE_LANG = true;
  OME_LANG.onChange(function () { loadHistory(); if (TM) { renderModels(); renderLog(); } });
})();
