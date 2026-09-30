/* ══════════════════════════════════════════════════════════════════
   drive-backup.js — สำรอง snapshot ข้อมูลทั้งเว็บขึ้น Google Drive ของเจ้าของ (แทน DriveSync ที่ก๊อปแยก 12 หน้า)
   1 ไฟล์ต่อวันต่อเครื่อง: OME_Progress/tanot-backup-YYYY-MM-DD-<device>.json (วันเดียวกันเครื่องเดียวกันเขียนทับ) — รูปแบบเดียวกับไฟล์ย้ายข้อมูล
   กู้คืน = ดาวน์โหลดไฟล์แล้วผ่านตารางตรวจของ TanotData.planImport (ไม่เขียนทับจนกว่าจะกดนำเข้า)
   ใช้ OAuth client เดิม (scope drive.file = เห็นเฉพาะไฟล์ที่เว็บนี้สร้าง)
   ══════════════════════════════════════════════════════════════════ */
window.DriveBackup = (function () {
  'use strict';

  var CLIENT_ID = '497048581273-akpavakt6m34lhqbjf1irg3m8vl6u27u.apps.googleusercontent.com';
  var SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var FOLDER = 'OME_Progress';
  var PREFIX = 'tanot-backup-';
  var API = 'https://www.googleapis.com';
  var LAST_KEY = 'tanot-sync:driveBackupAt';
  var DEVICE_KEY = 'tanot-sync:device'; // ตัวเดียวกับ tanot-data.js

  var token = null, tokenClient = null, folderId = null, gisP = null;

  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (!gisP) gisP = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = function () { res(); };
      s.onerror = function () { gisP = null; rej(new Error('โหลด Google Identity Services ไม่ได้')); };
      document.head.appendChild(s);
    });
    return gisP;
  }
  function connect() {
    if (token) return Promise.resolve(token);
    return loadGis().then(function () {
      return new Promise(function (res, rej) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID, scope: SCOPE, use_fedcm_for_prompt: true,
          callback: function (r) { if (r.error) rej(new Error(r.error)); else { token = r.access_token; res(token); } },
          error_callback: function (e) { rej(new Error(e && (e.message || e.type) || 'OAuth error')); }
        });
        tokenClient.requestAccessToken({ prompt: '' });
      });
    });
  }
  function authFetch(url, opts) {
    opts = opts || {}; opts.headers = opts.headers || {};
    opts.headers.Authorization = 'Bearer ' + token;
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) token = null;
      if (!r.ok) throw new Error('Drive ' + r.status);
      return r;
    });
  }
  function ensureFolder() {
    if (folderId) return Promise.resolve(folderId);
    var q = encodeURIComponent("name='" + FOLDER + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    return authFetch(API + '/drive/v3/files?q=' + q + '&fields=files(id)').then(function (r) { return r.json(); }).then(function (d) {
      if (d.files && d.files.length) return (folderId = d.files[0].id);
      return authFetch(API + '/drive/v3/files', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' })
      }).then(function (r) { return r.json(); }).then(function (f) { return (folderId = f.id); });
    });
  }
  function list() {
    return connect().then(ensureFolder).then(function (fid) {
      var q = encodeURIComponent("'" + fid + "' in parents and name contains '" + PREFIX + "' and trashed=false");
      return authFetch(API + '/drive/v3/files?q=' + q + '&orderBy=name desc&pageSize=60&fields=files(id,name,size,modifiedTime)');
    }).then(function (r) { return r.json(); }).then(function (d) { return d.files || []; });
  }
  // แยกไฟล์ต่อเครื่อง — 2 เครื่องสำรองวันเดียวกันต้องไม่ทับไฟล์ของกันและกัน (ค่าเฉพาะเครื่อง/ไฟล์ 3D ไม่ได้ซิงก์ มีแค่ในไฟล์ของเครื่องนั้น)
  function deviceTag() {
    var d = null;
    try { d = localStorage.getItem(DEVICE_KEY); } catch (e) {}
    if (!d) { d = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); try { localStorage.setItem(DEVICE_KEY, d); } catch (e) {} }
    return d;
  }
  function backupNow() {
    var name = PREFIX + new Date().toISOString().slice(0, 10) + '-' + deviceTag() + '.json';
    return Promise.all([window.TanotData.snapshot(), connect().then(ensureFolder)]).then(function (r) {
      var snap = r[0], fid = r[1];
      var q = encodeURIComponent("name='" + name + "' and '" + fid + "' in parents and trashed=false");
      return authFetch(API + '/drive/v3/files?q=' + q + '&fields=files(id)').then(function (x) { return x.json(); }).then(function (d) {
        var existing = d.files && d.files[0] && d.files[0].id;
        var form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(existing ? {} : { name: name, parents: [fid] })], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(snap)], { type: 'application/json' }));
        return authFetch(existing ? API + '/upload/drive/v3/files/' + existing + '?uploadType=multipart'
          : API + '/upload/drive/v3/files?uploadType=multipart&fields=id', { method: existing ? 'PATCH' : 'POST', body: form });
      }).then(function () {
        try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch (e) {}
        return { name: name, keys: Object.keys(snap.ls).length };
      });
    });
  }
  function download(fileId) {
    return connect().then(function () { return authFetch(API + '/drive/v3/files/' + fileId + '?alt=media'); })
      .then(function (r) { return r.json(); });
  }
  function lastBackupAt() { var v = +(localStorage.getItem(LAST_KEY) || 0); return v || null; }

  return { connect: connect, list: list, backupNow: backupNow, download: download, lastBackupAt: lastBackupAt };
})();
