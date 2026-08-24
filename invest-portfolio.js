/* ══════════════════════════════════════════════════════════════════
   Tanot — พอร์ตจำลอง (ฝึกซื้อ-ขายหุ้นด้วยเงินสมมติ)
   • เริ่มด้วยเงินสด 1,000,000 บาท (ปรับ/รีเซ็ตได้) — ซื้อ/ขายที่ราคาจริงจาก Yahoo Finance
     (pattern fetch เดียวกับ invest-thai-stock.js — clone-and-adapt, ใช้ .BK เหมือนกัน)
   • คำนวณกำไร/ขาดทุนจากส่วนต่างราคาเท่านั้น — ไม่มีข้อมูลปฏิทินปันผลรายหุ้นสาธารณะให้ดึงฟรี
     จึงไม่จำลองเงินปันผล (ต่างจาก AiO ที่มี XD Claim เพราะเขามีฐานข้อมูลปันผลของตัวเอง)
   • เก็บใน localStorage + สำรอง Google Drive (ไฟล์แยกจากพอร์ตในหน้าหุ้นไทย ไม่ปนกัน)
   หมายเหตุ: ตัวช่วยฝึกฝน ไม่ใช่การลงทุนจริง
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STATE_KEY = 'tanot:invest:portfolio';
  var START_CASH = 1000000;
  var priceCache = {}; /* sym -> {price, ts} ในเซสชันนี้ */

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function baht(n, d) { if (!isFinite(n)) return '—'; var neg = n < 0; return (neg ? '−' : '') + '฿' + fmt(Math.abs(n), d == null ? 0 : d); }

  /* ── สถานะพอร์ต ─────────────────────────────────────────────── */
  function defaultState() { return { cash: START_CASH, startCash: START_CASH, holdings: [], tx: [] }; }
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STATE_KEY));
      if (s && isFinite(s.cash) && Array.isArray(s.holdings) && Array.isArray(s.tx)) return s;
    } catch (e) {}
    return defaultState();
  }
  function saveState(s) { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (e) {} DriveSync.scheduleSync(); }
  var state = loadState();

  /* ── ดึงราคาหุ้นสด (.BK ผ่าน CORS-proxy chain — เหมือน invest-thai-stock.js) ── */
  function fetchOne(url, timeoutMs, parser) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
      .then(function (t) { if (to) clearTimeout(to); return parser(t); });
  }
  function proxyTries(base, offset) {
    var enc = encodeURIComponent(base);
    var tries = [
      { url: 'https://api.allorigins.win/raw?url=' + enc },
      { url: 'https://corsproxy.io/?url=' + enc },
      { url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { url: 'https://thingproxy.freeboard.io/fetch/' + base },
      { url: base }
    ];
    offset = ((offset || 0) % tries.length + tries.length) % tries.length;
    return tries.slice(offset).concat(tries.slice(0, offset));
  }
  function parseQuoteLite(t) {
    var j = JSON.parse(t), res = j && j.chart && j.chart.result && j.chart.result[0], meta = res && res.meta;
    if (!meta || !isFinite(meta.regularMarketPrice)) throw new Error('no meta');
    return meta.regularMarketPrice;
  }
  function fetchPrice(sym, offset) {
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '.BK?range=5d&interval=1d';
    var tries = proxyTries(base, offset), i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('fail'));
      return fetchOne(tries[i++].url, 7000, parseQuoteLite).catch(next);
    }
    return next().then(function (price) { priceCache[sym] = { price: price, ts: Date.now() }; return price; });
  }
  function getPrice(sym, offset, forceFresh) {
    var c = priceCache[sym];
    if (!forceFresh && c && Date.now() - c.ts < 5 * 60 * 1000) return Promise.resolve(c.price);
    return fetchPrice(sym, offset);
  }

  /* ── ซื้อ/ขาย ───────────────────────────────────────────────── */
  function findHolding(sym) {
    for (var i = 0; i < state.holdings.length; i++) if (state.holdings[i].sym === sym) return state.holdings[i];
    return null;
  }
  function setTradeStatus(msg, cls) { var el = $('tradeStatus'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }

  function doBuy() {
    var sym = ($('buySym').value || '').trim().toUpperCase().replace(/\.BK$/, '');
    var shares = num($('buyShares').value);
    if (!sym) { setTradeStatus('พิมพ์ชื่อย่อหุ้นก่อน เช่น PTT', 'err'); return; }
    if (!isFinite(shares) || shares <= 0) { setTradeStatus('กรอกจำนวนหุ้นให้ถูกต้อง', 'err'); return; }
    setTradeStatus('กำลังดึงราคา ' + sym + '…');
    $('buyBtn').disabled = true;
    getPrice(sym, 0, true).then(function (price) {
      $('buyBtn').disabled = false;
      var cost = shares * price;
      if (cost > state.cash + 1e-6) {
        setTradeStatus('เงินสดไม่พอ — ต้องใช้ ' + baht(cost) + ' แต่มีเงินสด ' + baht(state.cash), 'err');
        return;
      }
      var h = findHolding(sym);
      if (h) { h.avgCost = (h.shares * h.avgCost + shares * price) / (h.shares + shares); h.shares += shares; }
      else state.holdings.push({ sym: sym, shares: shares, avgCost: price });
      state.cash -= cost;
      state.tx.unshift({ ts: Date.now(), type: 'buy', sym: sym, shares: shares, price: price, amount: cost });
      saveState(state);
      $('buySym').value = ''; $('buyShares').value = '';
      setTradeStatus('ซื้อ ' + sym + ' ' + fmt0(shares) + ' หุ้น ที่ ' + fmt(price) + ' บาท สำเร็จ — ใช้เงิน ' + baht(cost), 'ok');
      renderAll();
    }, function () {
      $('buyBtn').disabled = false;
      setTradeStatus('ดึงราคา ' + sym + ' ไม่ได้ตอนนี้ (สัญลักษณ์อาจไม่ถูกต้อง หรือบริการฟรีจำกัดชั่วคราว) — ลองใหม่อีกครั้ง', 'err');
    });
  }
  function doSell() {
    var sym = $('sellSym').value;
    var shares = num($('sellShares').value);
    if (!sym) { setTradeStatus('ยังไม่มีหุ้นในพอร์ตให้ขาย', 'err'); return; }
    var h = findHolding(sym);
    if (!h) { setTradeStatus('ไม่พบหุ้นนี้ในพอร์ต', 'err'); return; }
    if (!isFinite(shares) || shares <= 0 || shares > h.shares) { setTradeStatus('กรอกจำนวนหุ้นให้ถูกต้อง (มีอยู่ ' + fmt0(h.shares) + ' หุ้น)', 'err'); return; }
    setTradeStatus('กำลังดึงราคา ' + sym + '…');
    $('sellBtn').disabled = true;
    getPrice(sym, 1, true).then(function (price) {
      $('sellBtn').disabled = false;
      var proceeds = shares * price, realizedPl = (price - h.avgCost) * shares;
      h.shares -= shares;
      if (h.shares <= 1e-9) state.holdings = state.holdings.filter(function (x) { return x.sym !== sym; });
      state.cash += proceeds;
      state.tx.unshift({ ts: Date.now(), type: 'sell', sym: sym, shares: shares, price: price, amount: proceeds, realizedPl: realizedPl });
      saveState(state);
      $('sellShares').value = '';
      setTradeStatus('ขาย ' + sym + ' ' + fmt0(shares) + ' หุ้น ที่ ' + fmt(price) + ' บาท สำเร็จ — ' + (realizedPl >= 0 ? 'กำไร ' : 'ขาดทุน ') + baht(Math.abs(realizedPl)), realizedPl >= 0 ? 'ok' : 'err');
      renderAll();
    }, function () {
      $('sellBtn').disabled = false;
      setTradeStatus('ดึงราคา ' + sym + ' ไม่ได้ตอนนี้ — ลองใหม่อีกครั้ง', 'err');
    });
  }
  function doReset() {
    if (!confirm('เริ่มพอร์ตจำลองใหม่ทั้งหมด? เงินสด/หุ้นที่ถือ/ประวัติการซื้อขายทั้งหมดจะถูกล้าง (กู้คืนไม่ได้)')) return;
    state = defaultState();
    saveState(state);
    renderAll();
  }

  /* ── เรนเดอร์ ───────────────────────────────────────────────── */
  function holdingsValue() {
    var v = 0, i;
    for (i = 0; i < state.holdings.length; i++) {
      var h = state.holdings[i], c = priceCache[h.sym];
      v += h.shares * (c ? c.price : h.avgCost);
    }
    return v;
  }
  function renderSummary() {
    var holdVal = holdingsValue(), total = state.cash + holdVal, pl = total - state.startCash, pct = state.startCash ? pl / state.startCash * 100 : 0;
    $('sCash').textContent = baht(state.cash);
    $('sHoldVal').textContent = baht(holdVal);
    $('sTotal').textContent = baht(total);
    $('sTotalSub').textContent = state.holdings.length ? 'ราคาบางตัวอาจยังไม่รีเฟรช — กด "รีเฟรชราคา"' : '';
    var plEl = $('sPl');
    plEl.textContent = (pl >= 0 ? '+' : '') + baht(pl);
    plEl.className = 'val ' + (pl > 0 ? 'up' : pl < 0 ? 'dn' : '');
    $('sPlPct').textContent = (pct >= 0 ? '+' : '') + fmt(pct, 2) + '%';
    $('sStart').textContent = baht(state.startCash);
  }
  function renderHoldings() {
    var tbl = $('holdTable'), empty = $('holdEmpty'), sel = $('sellSym');
    if (!state.holdings.length) { tbl.innerHTML = ''; empty.style.display = 'block'; sel.innerHTML = ''; return; }
    empty.style.display = 'none';
    var rows = '<thead><tr><th>หุ้น</th><th>จำนวน</th><th>ทุนเฉลี่ย</th><th>ราคาล่าสุด</th><th>มูลค่า</th><th>กำไร/ขาดทุน</th></tr></thead><tbody>';
    var selHtml = '';
    state.holdings.forEach(function (h) {
      var c = priceCache[h.sym], price = c ? c.price : NaN, val = h.shares * (isFinite(price) ? price : h.avgCost);
      var pl = isFinite(price) ? (price - h.avgCost) * h.shares : NaN, pct = isFinite(pl) ? pl / (h.avgCost * h.shares) * 100 : NaN;
      rows += '<tr><td>' + h.sym + '</td><td>' + fmt0(h.shares) + '</td><td>' + fmt(h.avgCost) + '</td>' +
        '<td>' + (isFinite(price) ? fmt(price) : 'ยังไม่ดึง') + '</td><td>' + baht(val) + '</td>' +
        '<td class="' + (pl > 0 ? 'up' : pl < 0 ? 'dn' : '') + '">' + (isFinite(pl) ? (pl >= 0 ? '+' : '') + baht(pl) + (isFinite(pct) ? ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)' : '') : '—') + '</td></tr>';
      selHtml += '<option value="' + h.sym + '">' + h.sym + ' (มี ' + fmt0(h.shares) + ' หุ้น)</option>';
    });
    rows += '</tbody>';
    tbl.innerHTML = rows;
    var prevSel = sel.value;
    sel.innerHTML = selHtml;
    if (state.holdings.some(function (h) { return h.sym === prevSel; })) sel.value = prevSel;
  }
  function renderTx() {
    var tbl = $('txTable'), empty = $('txEmpty');
    if (!state.tx.length) { tbl.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    var rows = '<thead><tr><th>วันที่</th><th>ประเภท</th><th>หุ้น</th><th>จำนวน</th><th>ราคา</th><th>มูลค่า</th><th>กำไรที่รับรู้</th></tr></thead><tbody>';
    state.tx.slice(0, 100).forEach(function (t) {
      var dateTxt = new Date(t.ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + ' ' + new Date(t.ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      rows += '<tr><td>' + dateTxt + '</td><td><span class="tx-type ' + t.type + '">' + (t.type === 'buy' ? 'ซื้อ' : 'ขาย') + '</span></td>' +
        '<td>' + t.sym + '</td><td>' + fmt0(t.shares) + '</td><td>' + fmt(t.price) + '</td><td>' + baht(t.amount) + '</td>' +
        '<td class="' + (t.realizedPl > 0 ? 'up' : t.realizedPl < 0 ? 'dn' : '') + '">' + (t.type === 'sell' && isFinite(t.realizedPl) ? (t.realizedPl >= 0 ? '+' : '') + baht(t.realizedPl) : '—') + '</td></tr>';
    });
    rows += '</tbody>';
    tbl.innerHTML = rows;
  }
  function renderAll() { renderSummary(); renderHoldings(); renderTx(); }

  function refreshAllPrices() {
    if (!state.holdings.length) return;
    $('refreshBtn').disabled = true;
    Promise.all(state.holdings.map(function (h, i) { return getPrice(h.sym, i, true).catch(function () { return null; }); }))
      .then(function () { $('refreshBtn').disabled = false; renderAll(); });
  }

  /* ══════ สำรองพอร์ตจำลองขึ้น Google Drive (ไม่บังคับ) — pattern เดียวกับหน้าอื่น ══════ */
  var DRIVE_CLIENT_ID = '497048581273-akpavakt6m34lhqbjf1irg3m8vl6u27u.apps.googleusercontent.com';
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var DRIVE_FOLDER_NAME = 'OME_Progress';
  var DRIVE_FILE_NAME = 'invest-portfolio-data.json';
  var DRIVE_CONNECTED_KEY = 'tanot:invest:portfolio:driveConnected';
  function nowTime() { return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }

  var DriveSync = {
    tokenClient: null, accessToken: null, folderId: null, fileId: null,
    connected: false, syncing: false, pending: false, timer: null,

    setStatus: function (text, cls) {
      var el = $('driveStatusTxt'); if (!el) return;
      el.textContent = text; el.className = 'status' + (cls ? ' ' + cls : '');
    },
    setBtn: function () {
      var b = $('driveConnectBtn'); if (!b) return;
      b.textContent = this.connected ? '🔗 เชื่อมต่อ Google Drive แล้ว' : '🔗 เชื่อมต่อ Google Drive';
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
          use_fedcm_for_prompt: true,
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
        if (self.connected) self.tokenClient.requestAccessToken({ prompt: '' });
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
    /* พอร์ตนี้เป็นสถานะเดียว (ไม่ใช่ log แบบเพิ่มได้เรื่อยๆ) — merge แบบง่าย: ใช้ฝั่งที่มี tx ล่าสุดใหม่กว่า
       (เทียบจาก timestamp ของรายการซื้อขายล่าสุด) กันกรณีเปิดใช้จาก 2 เครื่องแล้ว remote เก่ากว่า local ทับของใหม่ */
    mergeState: function (remote, local) {
      if (!remote) return local;
      var remoteLatest = (remote.tx && remote.tx[0] && remote.tx[0].ts) || 0;
      var localLatest = (local.tx && local.tx[0] && local.tx[0].ts) || 0;
      return remoteLatest > localLatest ? remote : local;
    },
    firstSync: function () {
      var self = this;
      self.setStatus('กำลังซิงก์…', '');
      self.ensureFolder().then(function () { return self.findFile(); })
        .then(function (fid) { return fid ? self.download() : null; })
        .then(function (remote) {
          var merged = self.mergeState(remote, state);
          state = merged;
          try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {}
          renderAll();
          return self.upload(state);
        })
        .then(function () { self.setStatus('✅ ซิงก์กับ Google Drive แล้ว · ' + nowTime(), 'ok'); })
        .catch(function (e) { self.setStatus('❌ ' + (e.message || e), 'err'); });
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
        .then(function () { return self.upload(state); })
        .then(function () { self.setStatus('✅ ซิงก์ล่าสุด ' + nowTime(), 'ok'); })
        .catch(function (e) {
          var msg = String(e && e.message || e);
          if (msg.indexOf('401') !== -1 || msg.indexOf('403') !== -1) {
            self.accessToken = null;
            self.setStatus('เซสชันหมดอายุ — กดปุ่มเชื่อมต่อ Drive อีกครั้ง', 'err');
          } else {
            self.setStatus('❌ ซิงก์ไม่สำเร็จ: ' + msg, 'err');
          }
        })
        .finally(function () {
          self.syncing = false;
          if (self.pending) self.scheduleSync();
        });
    }
  };

  /* ── init ───────────────────────────────────────────────────── */
  function init() {
    renderAll();
    $('buyBtn').addEventListener('click', doBuy);
    $('sellBtn').addEventListener('click', doSell);
    $('resetBtn').addEventListener('click', doReset);
    $('refreshBtn').addEventListener('click', refreshAllPrices);
    [].forEach.call(document.querySelectorAll('#tradeTabs button'), function (b) {
      b.addEventListener('click', function () {
        [].forEach.call(document.querySelectorAll('#tradeTabs button'), function (x) { x.classList.toggle('on', x === b); });
        var t = b.getAttribute('data-tab');
        $('buyPane').style.display = t === 'buy' ? 'block' : 'none';
        $('sellPane').style.display = t === 'sell' ? 'block' : 'none';
        setTradeStatus('');
      });
    });
    $('driveConnectBtn') && $('driveConnectBtn').addEventListener('click', function () { DriveSync.connect(); });
    DriveSync.init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__portfolio = { defaultState: defaultState, findHolding: findHolding };
})();
