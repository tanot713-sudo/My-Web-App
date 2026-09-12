/* ══════════════════════════════════════════════════════════════════
   Tanot — โมดูลกลางสำรอง "พอร์ตหุ้นไทย + สมุดเทรด" ขึ้น Google Drive
   ใช้ร่วมกันโดย invest-thai-stock.js (พอร์ต) และ invest-trade-journal.js
   (สมุดเทรด) — แยกออกมาเป็นไฟล์เดียวเพราะไฟล์ Drive เดิม (invest-data.json)
   เก็บ {portfolio, journal} รวมกันเป็นก้อนเดียวมาตั้งแต่แรก ถ้าแยกฟังก์ชัน
   sync ไปคนละไฟล์โดยไม่มีจุดกลาง จะเขียนทับข้อมูลอีกฝั่งหายได้เวลาซิงก์
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน — พอร์ต/สมุดเทรดเก็บในเครื่องผู้ใช้เป็นหลัก
   ══════════════════════════════════════════════════════════════════ */
window.InvestDrive = (function () {
  'use strict';

  var PF_KEY = 'tanot:invest:thstock';
  var JN_KEY = 'tanot:invest:thjournal';
  var DRIVE_CLIENT_ID = '497048581273-akpavakt6m34lhqbjf1irg3m8vl6u27u.apps.googleusercontent.com';
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var DRIVE_FOLDER_NAME = 'OME_Progress';
  var DRIVE_FILE_NAME = 'invest-data.json';
  var DRIVE_CONNECTED_KEY = 'tanot:invest:driveConnected';

  function $(id) { return document.getElementById(id); }
  function nowTime() { return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }

  function loadPf() { try { return JSON.parse(localStorage.getItem(PF_KEY)) || []; } catch (e) { return []; } }
  function savePf(a) { try { localStorage.setItem(PF_KEY, JSON.stringify(a)); } catch (e) {} DriveSync.scheduleSync(); }
  function loadJn() { try { return JSON.parse(localStorage.getItem(JN_KEY)) || []; } catch (e) { return []; } }
  function saveJn(a) { try { localStorage.setItem(JN_KEY, JSON.stringify(a)); } catch (e) {} DriveSync.scheduleSync(); }

  /* callback ที่หน้าเว็บลงทะเบียนไว้ — ให้รู้ว่าต้อง re-render UI ของตัวเองหลัง merge ข้อมูลจาก Drive ตอน firstSync
     (แต่ละหน้ามีแค่ pf หรือ jn อย่างเดียว จึงลงทะเบียนเฉพาะที่เกี่ยวกับตัวเอง) */
  var onPfChange = null, onJnChange = null;

  var DriveSync = {
    tokenClient: null, accessToken: null, folderId: null, fileId: null,
    connected: false, syncing: false, pending: false, timer: null,

    onPfChange: function (fn) { onPfChange = fn; },
    onJnChange: function (fn) { onJnChange = fn; },

    setStatus: function (text, cls) {
      var el = $('driveStatusTxt'); if (!el) return;
      el.textContent = text; el.className = 'status' + (cls ? ' ' + cls : '');
    },
    setBtn: function () {
      var b = $('driveConnectBtn'); if (!b) return;
      b.textContent = this.connected ? 'เชื่อมต่อ Google Drive แล้ว' : 'เชื่อมต่อ Google Drive';
    },
    init: function () {
      try { this.connected = localStorage.getItem(DRIVE_CONNECTED_KEY) === '1'; } catch (e) {}
      this.setBtn();
      var self = this;
      (function wait() {
        if (!window.google || !google.accounts || !google.accounts.oauth2) { setTimeout(wait, 300); return; }
        self.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: DRIVE_CLIENT_ID,
          scope: DRIVE_SCOPE,
          use_fedcm_for_prompt: true, // ลดโอกาสต้องกดยืนยันใหม่ทุกครั้งบนเบราว์เซอร์ที่บล็อก third-party cookie (เช่น Chrome รุ่นใหม่)
          callback: function (resp) {
            if (resp.error) {
              self.setStatus(self.connected ? 'เชื่อมต่ออัตโนมัติไม่สำเร็จ (อาจเพราะเบราว์เซอร์บล็อก cookie ข้ามโดเมน) — กดปุ่มเชื่อมต่ออีกครั้ง' : 'เชื่อมต่อไม่สำเร็จ: ' + resp.error, 'err');
              return;
            }
            self.accessToken = resp.access_token;
            self.connected = true;
            try { localStorage.setItem(DRIVE_CONNECTED_KEY, '1'); } catch (e) {}
            self.setBtn();
            self.firstSync();
          }
        });
        if (self.connected) self.tokenClient.requestAccessToken({ prompt: '' }); /* ลองต่อเงียบๆ ถ้าเคยเชื่อมต่อแล้ว */
      })();
    },
    connect: function () {
      if (!this.tokenClient) { this.setStatus('กำลังโหลด Google Identity Services… รออีก 2-3 วิแล้วลองใหม่', 'err'); return; }
      this.setStatus('กำลังขอสิทธิ์เชื่อมต่อ…', '');
      this.tokenClient.requestAccessToken({ prompt: this.accessToken ? '' : 'consent' });
    },
    authFetch: function (url, opts) {
      opts = opts || {}; opts.headers = opts.headers || {};
      opts.headers.Authorization = 'Bearer ' + this.accessToken;
      return fetch(url, opts);
    },
    ensureFolder: function () {
      var self = this;
      if (self.folderId) return Promise.resolve(self.folderId);
      var q = encodeURIComponent("name='" + DRIVE_FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
      return self.authFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)')
        .then(function (r) { if (!r.ok) throw new Error('ค้นหาโฟลเดอร์ไม่สำเร็จ (' + r.status + ')'); return r.json(); })
        .then(function (data) {
          if (data.files && data.files.length) { self.folderId = data.files[0].id; return self.folderId; }
          return self.authFetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
          }).then(function (r) { if (!r.ok) throw new Error('สร้างโฟลเดอร์ไม่สำเร็จ (' + r.status + ')'); return r.json(); })
            .then(function (d) { self.folderId = d.id; return self.folderId; });
        });
    },
    findFile: function () {
      var self = this;
      if (self.fileId) return Promise.resolve(self.fileId);
      var q = encodeURIComponent("name='" + DRIVE_FILE_NAME + "' and '" + self.folderId + "' in parents and trashed=false");
      return self.authFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)')
        .then(function (r) { if (!r.ok) throw new Error('ค้นหาไฟล์ไม่สำเร็จ (' + r.status + ')'); return r.json(); })
        .then(function (data) { self.fileId = (data.files && data.files[0] && data.files[0].id) || null; return self.fileId; });
    },
    download: function () {
      var self = this;
      return self.authFetch('https://www.googleapis.com/drive/v3/files/' + self.fileId + '?alt=media')
        .then(function (r) { if (!r.ok) throw new Error('ดาวน์โหลดไม่สำเร็จ (' + r.status + ')'); return r.json(); });
    },
    upload: function (obj) {
      var self = this;
      var metadata = self.fileId ? {} : { name: DRIVE_FILE_NAME, parents: [self.folderId] };
      var form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([JSON.stringify(obj)], { type: 'application/json' }));
      var url = self.fileId
        ? 'https://www.googleapis.com/upload/drive/v3/files/' + self.fileId + '?uploadType=multipart'
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
      return self.authFetch(url, { method: self.fileId ? 'PATCH' : 'POST', body: form })
        .then(function (r) { if (!r.ok) throw new Error('บันทึกขึ้น Drive ไม่สำเร็จ (' + r.status + ')'); return r.json(); })
        .then(function (d) { if (d.id) self.fileId = d.id; return d; });
    },
    /* ผสาน portfolio/journal จาก Drive กับเครื่องนี้ โดย ts (เวลาสร้างรายการ) เป็นตัวกันซ้ำ */
    mergeByTs: function (a, b) {
      var map = {};
      (a || []).forEach(function (x) { if (x && x.ts != null) map[x.ts] = x; });
      (b || []).forEach(function (x) { if (x && x.ts != null) map[x.ts] = x; });
      var out = Object.keys(map).map(function (k) { return map[k]; });
      out.sort(function (x, y) { return (x.ts || 0) - (y.ts || 0); });
      return out;
    },
    firstSync: function () {
      var self = this;
      self.setStatus('กำลังซิงก์…', '');
      self.ensureFolder().then(function () { return self.findFile(); })
        .then(function (fid) { return fid ? self.download() : null; })
        .then(function (remote) {
          var mergedPf = self.mergeByTs(remote && remote.portfolio, loadPf());
          var mergedJn = self.mergeByTs(remote && remote.journal, loadJn());
          /* เขียนตรงลง localStorage (ไม่ผ่าน savePf/saveJn) กันเกิดคิวซิงก์ซ้ำซ้อน — ฟังก์ชันนี้อัปโหลดเองด้านล่างอยู่แล้ว */
          try { localStorage.setItem(PF_KEY, JSON.stringify(mergedPf)); } catch (e) {}
          try { localStorage.setItem(JN_KEY, JSON.stringify(mergedJn)); } catch (e) {}
          if (onPfChange) onPfChange();
          if (onJnChange) onJnChange();
          return self.upload({ portfolio: mergedPf, journal: mergedJn, savedAt: new Date().toISOString() });
        })
        .then(function () { self.setStatus('ซิงก์กับ Google Drive แล้ว · ' + nowTime(), 'ok'); })
        .catch(function (e) { self.setStatus('' + (e.message || e), 'err'); });
    },
    scheduleSync: function () {
      var self = this;
      if (!self.connected || !self.accessToken) return;
      self.pending = true;
      if (self.timer) clearTimeout(self.timer);
      self.timer = setTimeout(function () { self.pushNow(); }, 1800);
    },
    pushNow: function () {
      var self = this;
      if (self.syncing) { self.pending = true; return; }
      self.pending = false; self.syncing = true;
      self.setStatus('กำลังซิงก์…', '');
      self.ensureFolder().then(function () { return self.findFile(); })
        .then(function () { return self.upload({ portfolio: loadPf(), journal: loadJn(), savedAt: new Date().toISOString() }); })
        .then(function () { self.setStatus('ซิงก์ล่าสุด ' + nowTime(), 'ok'); })
        .catch(function (e) {
          var msg = String(e && e.message || e);
          if (msg.indexOf('401') !== -1 || msg.indexOf('403') !== -1) {
            self.accessToken = null;
            self.setStatus('เซสชันหมดอายุ — กดปุ่มเชื่อมต่อ Drive อีกครั้ง', 'err');
          } else {
            self.setStatus('ซิงก์ไม่สำเร็จ: ' + msg, 'err');
          }
        })
        .finally(function () {
          self.syncing = false;
          if (self.pending) self.scheduleSync();
        });
    }
  };

  return { loadPf: loadPf, savePf: savePf, loadJn: loadJn, saveJn: saveJn, DriveSync: DriveSync };
})();
