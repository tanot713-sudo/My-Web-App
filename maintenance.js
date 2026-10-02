/* ══════════════════════════════════════════════════════════════════
   Tanot — บันทึกงานบำรุงรักษา (maintenance.html) · ส่วนแสดงผล + อ่าน/เขียน storage
   ตรรกะ (วันครบรอบ/สถานะ/นำเข้า/ส่งออก) อยู่ใน mnt-calc.js (window.MntCalc) — ห้ามมีสูตรวันครบรอบในไฟล์นี้
   ข้อมูล (docs/maintenance-design.md หัวข้อ 3):
     localStorage  tanot:mnt:sites|assets|plans (sync list) · tanot:mnt:settings (sync blob) · tanot:mnt:device (cache) · tanot:mnt:ui|draft (local)
     IndexedDB     tanot-mnt (wo, woev) · tanot-mnt-<ปี> (insp) · tanot-mnt-outbox (q — คิวรูป ไม่ซิงก์)
   สคีมา IndexedDB สร้างจาก TanotRegistry.idbSpec() ตรงๆ เพื่อให้หน้ากับ registry ตรงกันทุกตัวอักษร
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  window.TANOT_NO_RELOAD_BAR = true; // วาดรายการ/ปฏิทินใหม่เองเมื่อ TanotData.onChange — ห้ามรีเซ็ตช่องในฟอร์มที่เปิดอยู่

  var C = window.MntCalc;
  var Q = window.MntQR;
  var TD = window.TanotData;
  var REG = window.TanotRegistry;
  var K = { sites: 'tanot:mnt:sites', assets: 'tanot:mnt:assets', plans: 'tanot:mnt:plans', settings: 'tanot:mnt:settings',
    device: 'tanot:mnt:device', ui: 'tanot:mnt:ui', draft: 'tanot:mnt:draft' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function num(n, d) { return (Number(n) || 0).toLocaleString('th-TH', { maximumFractionDigits: d == null ? 0 : d }); }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function today() { return C.ymd(new Date()); }
  function dateTh(s) {
    var d = C.parseYmd(String(s || '').slice(0, 10));
    return d ? d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }
  function filesAvailable() { return /\.pages\.dev$/.test(location.hostname) || !!(window.TANOT_FILES && window.TANOT_FILES.enabled); }

  function toast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.innerHTML = (kind === 'err' ? icon('circle-alert') : icon('circle-check')) + '<span>' + esc(msg) + '</span>';
    $('toasts').appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3200);
  }

  /* ── storage (localStorage): อ่านสดทุกครั้งก่อนเขียน — ห้ามถืออาร์เรย์ค้างแล้วเขียนทับทีหลัง ── */
  function readList(key) {
    var v = TD && TD.read ? TD.read(key, []) : null;
    if (v == null) { try { v = JSON.parse(localStorage.getItem(key)); } catch (e) { v = null; } }
    return Array.isArray(v) ? v.filter(function (x) { return x && typeof x === 'object' && x.id; }) : [];
  }
  function writeList(key, list) { localStorage.setItem(key, JSON.stringify(list)); }
  function upsert(key, item) {
    var list = readList(key), i = list.findIndex(function (x) { return x.id === item.id; });
    item.updatedAt = Date.now();
    if (i === -1) list.push(item); else list[i] = item;
    writeList(key, list);
  }
  function removeById(key, id) { writeList(key, readList(key).filter(function (x) { return x.id !== id; })); }
  function getSites() { return readList(K.sites); }
  function getAssets() { return readList(K.assets); }
  function getPlans() { return readList(K.plans); }
  function getSettings() {
    var v = TD && TD.read ? TD.read(K.settings, null) : null;
    return Object.assign({ v: 1, startMonth: '', project: '', line: '', inspector: '', labelSize: '3x8' }, v && typeof v === 'object' ? v : {});
  }
  function saveSettings(s) { localStorage.setItem(K.settings, JSON.stringify(s)); }

  function deviceId() { // cache key — ไม่ย้าย ไม่สำรอง (กู้ backup ลงอีกเครื่องแล้วต้องได้รหัสใหม่)
    var d = null;
    try { d = localStorage.getItem(K.device); } catch (e) {}
    if (!d) {
      d = 'd' + Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-3);
      try { localStorage.setItem(K.device, d); } catch (e) {}
    }
    return d;
  }

  var ui = (function () {
    var v = {};
    try { v = JSON.parse(localStorage.getItem(K.ui)) || {}; } catch (e) {}
    return { tab: v.tab || 'assets', site: v.site || '', system: v.system || '', type: v.type || '', status: v.status === '' ? '' : (v.status || 'active'), by: v.by || '', q: '' };
  })();
  function saveUi() {
    try { localStorage.setItem(K.ui, JSON.stringify({ tab: ui.tab, site: ui.site, system: ui.system, type: ui.type, status: ui.status, by: ui.by })); } catch (e) {}
  }

  /* ── IndexedDB (สคีมามาจาก registry) ── */
  var OUTBOX = { db: 'tanot-mnt-outbox', version: 1, stores: { q: { keyPath: 'id' } } }; // ไม่อยู่ใน registry โดยตั้งใจ (Blob ชั่วคราว)
  var dbCache = {};
  function openDb(name) {
    if (dbCache[name]) return dbCache[name];
    var spec = name === OUTBOX.db ? OUTBOX : REG.idbSpec(name);
    if (!spec) return Promise.reject(new Error('ไม่มีสคีมา ' + name));
    dbCache[name] = new Promise(function (resolve, reject) {
      var req = indexedDB.open(name, spec.version);
      req.onupgradeneeded = function () {
        var db = req.result;
        Object.keys(spec.stores).forEach(function (s) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: spec.stores[s].keyPath });
        });
      };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () { db.close(); delete dbCache[name]; };
        resolve(db);
      };
      req.onerror = function () { delete dbCache[name]; reject(req.error); };
    });
    return dbCache[name];
  }
  function idbAll(name, store) {
    return openDb(name).then(function (db) {
      return new Promise(function (resolve, reject) {
        var r = db.transaction(store, 'readonly').objectStore(store).getAll();
        r.onsuccess = function () { resolve(r.result || []); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }
  function idbGet(name, store, id) {
    return openDb(name).then(function (db) {
      return new Promise(function (resolve, reject) {
        var r = db.transaction(store, 'readonly').objectStore(store).get(id);
        r.onsuccess = function () { resolve(r.result || null); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }
  function idbPut(name, store, rec) {
    return openDb(name).then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(rec);
        tx.oncomplete = function () { resolve(rec); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }
  function idbDelete(name, store, id) {
    return openDb(name).then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function inspDbName(year) { return 'tanot-mnt-' + year; }
  function inspYears() { // ปีที่มีสคีมาใน registry (2026 → ปีปัจจุบัน+1)
    var out = [];
    REG.idb.forEach(function (s) { var m = /^tanot-mnt-(\d{4})$/.exec(s.db); if (m) out.push(+m[1]); });
    return out.sort();
  }
  function lockedYear(year) { return year < new Date().getFullYear() - 1; } // ปีที่เก่ากว่าปีปัจจุบัน−1 = อ่านอย่างเดียว
  function loadAllInsp() {
    return Promise.all(inspYears().map(function (y) { return idbAll(inspDbName(y), 'insp').catch(function () { return []; }); }))
      .then(function (arr) { return [].concat.apply([], arr); });
  }
  function loadWos() {
    return Promise.all([idbAll('tanot-mnt', 'wo').catch(function () { return []; }), idbAll('tanot-mnt', 'woev').catch(function () { return []; })])
      .then(function (r) { return { wos: r[0], events: r[1] }; });
  }
  function assetHasRecords(id) {
    return Promise.all([loadAllInsp(), loadWos()]).then(function (r) {
      return r[0].some(function (d) { return d.rows && d.rows[id]; }) || r[1].wos.some(function (w) { return w.asset === id; });
    });
  }

  /* ── ข้อมูลอ้างอิง ── */
  function siteName(id, sites) {
    var s = (sites || getSites()).filter(function (x) { return x.id === id; })[0];
    return s ? s.name : '';
  }
  function typeNames(plans) {
    var m = {};
    (plans || getPlans()).forEach(function (p) { if (!m[p.type]) m[p.type] = p.typeName || p.type; });
    return m;
  }
  function planOf(type, freq, plans) { return (plans || getPlans()).filter(function (p) { return p.type === type && p.freq === freq; })[0] || null; }
  function assetById(id) { return getAssets().filter(function (a) { return a.id === id; })[0] || null; }
  function mapUrl(lat, lng) { return 'https://www.google.com/maps?q=' + encodeURIComponent(lat + ',' + lng); }
  function coordsOf(a, sites) {
    if (a.lat != null && a.lng != null) return { lat: a.lat, lng: a.lng };
    var s = (sites || getSites()).filter(function (x) { return x.id === a.site; })[0];
    return s && s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null;
  }

  /* ══════════ แท็บ ══════════ */
  var TABS = [{ id: 'assets', label: 'อุปกรณ์', icon: 'wrench' }];
  var renderers = {}; // tab id → ฟังก์ชันวาด
  function renderTabs() {
    $('tabs').innerHTML = TABS.map(function (t) {
      return '<button class="tab" type="button" role="tab" data-tab="' + t.id + '" aria-selected="' + (ui.tab === t.id) + '">' + icon(t.icon) + ' ' + esc(t.label) + '</button>';
    }).join('');
  }
  function showTab(id) {
    if (!TABS.some(function (t) { return t.id === id; })) id = TABS[0].id;
    ui.tab = id; saveUi();
    TABS.forEach(function (t) { var el = $('tab-' + t.id); if (el) el.hidden = t.id !== id; });
    renderTabs();
    renderCurrent();
  }
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (b) showTab(b.getAttribute('data-tab'));
  });

  function anyDialogOpen() {
    return Array.prototype.some.call(document.querySelectorAll('dialog'), function (d) { return d.open; });
  }
  function renderCurrent() {
    if (/^#asset=/.test(location.hash)) { renderAssetView(); return; }
    if (renderers[ui.tab]) renderers[ui.tab]();
  }

  /* ══════════ แท็บอุปกรณ์ ══════════ */
  var picked = {}; // อุปกรณ์ที่ติ๊กเลือกไว้พิมพ์ป้าย (id → true)

  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function fillFilters(assets, sites, plans) {
    var systems = {}, types = {}, tn = typeNames(plans);
    assets.forEach(function (a) { if (a.system) systems[a.system] = true; if (a.type) types[a.type] = true; });
    $('fSite').innerHTML = opt('', 'ทุกสถานที่', !ui.site) + sites.map(function (s) { return opt(s.id, s.name, ui.site === s.id); }).join('');
    $('fSystem').innerHTML = opt('', 'ทุกระบบ', !ui.system) + Object.keys(systems).sort().map(function (s) { return opt(s, s, ui.system === s); }).join('');
    $('fType').innerHTML = opt('', 'ทุกประเภท', !ui.type) + Object.keys(types).sort().map(function (t) { return opt(t, tn[t] ? t + ' · ' + tn[t] : t, ui.type === t); }).join('');
    $('fStatus').innerHTML = [['', 'ทุกสถานะ'], ['active', 'ใช้งาน'], ['retired', 'ปลดใช้งาน'], ['missing', 'ไม่อยู่ในไฟล์']]
      .map(function (o) { return opt(o[0], o[1], ui.status === o[0]); }).join('');
    $('typeList').innerHTML = Object.keys(types).sort().map(function (t) { return '<option value="' + esc(t) + '">'; }).join('');
  }
  function filteredAssets(assets) {
    var q = norm(ui.q);
    return assets.filter(function (a) {
      if (ui.site && a.site !== ui.site) return false;
      if (ui.system && a.system !== ui.system) return false;
      if (ui.type && a.type !== ui.type) return false;
      if (ui.status === 'active' && a.status === 'retired') return false;
      if (ui.status === 'retired' && a.status !== 'retired') return false;
      if (ui.status === 'missing' && !a.missing) return false;
      if (q && [a.code, a.name, a.serial, a.type].join(' ').toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) { return a.code < b.code ? -1 : a.code > b.code ? 1 : 0; });
  }

  function renderAssets() {
    var assets = getAssets(), sites = getSites(), plans = getPlans();
    if (document.activeElement !== $('aSearch')) $('aSearch').value = ui.q;
    var focus = document.activeElement && document.activeElement.id;
    if (!/^f(Site|System|Type|Status)$/.test(focus || '')) fillFilters(assets, sites, plans);
    var rows = filteredAssets(assets);
    if (!assets.length) {
      $('aList').innerHTML = '<div class="empty">' + icon('wrench') + '<p class="empty-title">ยังไม่มีอุปกรณ์</p></div>';
    } else if (!rows.length) {
      $('aList').innerHTML = '<div class="empty">' + icon('search') + '<p>ไม่พบอุปกรณ์</p></div>';
    } else {
      var sn = {}; sites.forEach(function (s) { sn[s.id] = s.name; });
      $('aList').innerHTML = '<div class="list">' + rows.map(function (a) {
        var meta = [sn[a.site], a.system, a.serial].filter(Boolean).join(' · ');
        return '<div class="list-row" data-id="' + esc(a.id) + '">' +
          '<input class="pick" type="checkbox" aria-label="เลือก ' + esc(a.code) + '"' + (picked[a.id] ? ' checked' : '') + '>' +
          '<div class="grow"><div class="title">' + esc(a.code) + ' · ' + esc(a.name) + '</div><div class="meta">' + esc(meta) + '</div></div>' +
          '<div class="end">' +
            (a.status === 'retired' ? '<span class="badge">ปลดใช้งาน</span>' : '') +
            (a.missing ? '<span class="badge warn">ไม่อยู่ในไฟล์</span>' : '') +
            '<span class="badge" data-badge="' + esc(a.id) + '"></span>' +
            '<button class="btn sm icon" type="button" data-act="edit" aria-label="แก้ไข">' + icon('pencil') + '</button>' +
          '</div></div>';
      }).join('') + '</div>';
    }
    $('sCount').textContent = String(sites.length);
    $('pCount').textContent = String(plans.length);
    renderSites(sites, assets);
    renderPlans(plans);
    $('aPrint').disabled = !rows.length && !Object.keys(picked).length;
    if (renderers.afterAssets) renderers.afterAssets(rows);
  }
  renderers.assets = renderAssets;

  $('aSearch').addEventListener('input', function () { ui.q = this.value; renderAssets(); });
  [['fSite', 'site'], ['fSystem', 'system'], ['fType', 'type'], ['fStatus', 'status']].forEach(function (p) {
    $(p[0]).addEventListener('change', function () { ui[p[1]] = this.value; saveUi(); renderAssets(); });
  });
  $('aList').addEventListener('click', function (e) {
    var row = e.target.closest('.list-row');
    if (!row) return;
    var id = row.getAttribute('data-id');
    if (e.target.classList.contains('pick')) { if (e.target.checked) picked[id] = true; else delete picked[id]; renderAssetsPrintState(); return; }
    var b = e.target.closest('[data-act="edit"]');
    if (b) openAssetDialog(assetById(id)); else location.hash = '#asset=' + encodeURIComponent(id);
  });
  function renderAssetsPrintState() { $('aPrint').disabled = !Object.keys(picked).length && !filteredAssets(getAssets()).length; }

  /* ── สถานที่ ── */
  function renderSites(sites, assets) {
    if (!sites.length) { $('sList').innerHTML = '<div class="empty">' + icon('map-pin') + '<p>ยังไม่มีสถานที่</p></div>'; return; }
    var cnt = {}; assets.forEach(function (a) { cnt[a.site] = (cnt[a.site] || 0) + 1; });
    $('sList').innerHTML = '<div class="list">' + sites.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; }).map(function (s) {
      var meta = [s.abbr, s.lat != null && s.lng != null ? s.lat + ', ' + s.lng : ''].filter(Boolean).join(' · ');
      return '<div class="list-row" data-sid="' + esc(s.id) + '"><span class="lead">' + icon('map-pin') + '</span>' +
        '<div class="grow"><div class="title">' + esc(s.name) + '</div><div class="meta">' + esc(meta) + '</div></div>' +
        '<span class="badge">' + num(cnt[s.id] || 0) + ' ตัว</span></div>';
    }).join('') + '</div>';
  }
  var siteEditing = null;
  function openSiteDialog(s) {
    siteEditing = s ? Object.assign({}, s) : { id: '', name: '', abbr: '', lat: null, lng: null, circuit: '', order: null };
    $('dlgSiteTitle').textContent = s ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่';
    $('sName').value = siteEditing.name; $('sAbbr').value = siteEditing.abbr;
    $('sLat').value = siteEditing.lat != null ? siteEditing.lat : ''; $('sLng').value = siteEditing.lng != null ? siteEditing.lng : '';
    $('sDel').hidden = !s; $('sMsg').textContent = '';
    $('dlgSite').showModal();
  }
  function numOrNull(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  $('sAdd').addEventListener('click', function () { openSiteDialog(null); });
  $('sList').addEventListener('click', function (e) {
    var row = e.target.closest('[data-sid]');
    if (row) openSiteDialog(getSites().filter(function (s) { return s.id === row.getAttribute('data-sid'); })[0]);
  });
  $('sCancel').addEventListener('click', function () { $('dlgSite').close(); });
  $('formSite').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('sName').value.trim(), abbr = $('sAbbr').value.trim().toUpperCase();
    if (!name) { $('sMsg').textContent = 'ใส่ชื่อสถานที่'; return; }
    var sites = getSites();
    if (sites.some(function (s) { return s.id !== siteEditing.id && norm(s.name) === norm(name); })) { $('sMsg').textContent = 'ชื่อนี้มีอยู่แล้ว'; return; }
    if (!abbr) { $('sMsg').textContent = 'ใส่ตัวย่อ'; return; }
    if (sites.some(function (s) { return s.id !== siteEditing.id && norm(s.abbr) === norm(abbr); })) { $('sMsg').textContent = 'ตัวย่อนี้มีอยู่แล้ว'; return; }
    var s = siteEditing;
    if (!s.id) { s.id = 's-' + C.fnv1a36(norm(name)); if (sites.some(function (x) { return x.id === s.id; })) s.id = C.uid('s'); }
    s.name = name; s.abbr = abbr; s.lat = numOrNull($('sLat').value); s.lng = numOrNull($('sLng').value);
    upsert(K.sites, s);
    $('dlgSite').close();
    renderCurrent();
  });
  $('sDel').addEventListener('click', function () {
    if (getAssets().some(function (a) { return a.site === siteEditing.id; })) { $('sMsg').textContent = 'ยังมีอุปกรณ์ในสถานที่นี้'; return; }
    if (!window.confirm('ลบสถานที่นี้?')) return;
    removeById(K.sites, siteEditing.id);
    $('dlgSite').close();
    renderCurrent();
  });

  /* ── แผน PM ── */
  function renderPlans(plans) {
    if (!plans.length) { $('pList').innerHTML = '<div class="empty">' + icon('clipboard-list') + '<p>ยังไม่มีแผน PM</p></div>'; return; }
    var order = C.FREQS;
    $('pList').innerHTML = '<div class="list">' + plans.slice().sort(function (a, b) {
      return a.type < b.type ? -1 : a.type > b.type ? 1 : order.indexOf(a.freq) - order.indexOf(b.freq);
    }).map(function (p) {
      var meta = [C.FREQ_LABEL[p.freq], num(p.hours, 2) + ' ชม.', p.shift === 'N' ? 'กลางคืน' : p.shift === 'D' ? 'กลางวัน' : '', num((p.items || []).length) + ' ข้อ'].filter(Boolean).join(' · ');
      return '<div class="list-row" data-pid="' + esc(p.id) + '"><span class="lead">' + icon('clipboard-list') + '</span>' +
        '<div class="grow"><div class="title">' + esc(p.type) + ' · ' + esc(p.typeName || '') + '</div><div class="meta">' + esc(meta) + '</div></div>' +
        (p.edited ? '<span class="badge">แก้เอง</span>' : '') + '</div>';
    }).join('') + '</div>';
  }
  var planEditing = null, planIsNew = false, planMaxNo = 0;
  function itemNo(it) { return parseInt(String(it.id).slice(1), 10) || 0; }
  function renderPlanItems() {
    $('pItems').innerHTML = planEditing.items.map(function (it, i) {
      return '<div class="mnt-item" data-i="' + i + '">' +
        '<input type="text" class="input" data-f="text" value="' + esc(it.text) + '" maxlength="200" aria-label="ข้อ ' + (i + 1) + '">' +
        '<div class="acts">' +
          '<button class="btn sm icon ghost" type="button" data-a="up" aria-label="ขึ้น"' + (i === 0 ? ' disabled' : '') + '>' + icon('chevron-up') + '</button>' +
          '<button class="btn sm icon ghost" type="button" data-a="down" aria-label="ลง"' + (i === planEditing.items.length - 1 ? ' disabled' : '') + '>' + icon('chevron-down') + '</button>' +
          '<button class="btn sm icon ghost" type="button" data-a="rm" aria-label="ลบข้อ">' + icon('trash-2') + '</button></div>' +
        '<div class="row2"><div class="segmented" role="group" aria-label="ชนิด">' +
          '<button type="button" data-a="check" aria-pressed="' + (it.kind !== 'num') + '">ผ่าน/ไม่ผ่าน</button>' +
          '<button type="button" data-a="num" aria-pressed="' + (it.kind === 'num') + '">ค่าที่วัด</button></div>' +
          (it.kind === 'num' ? '<input type="text" class="input unit" data-f="unit" placeholder="หน่วย" value="' + esc(it.unit || '') + '" maxlength="12" aria-label="หน่วย">' +
            '<input type="number" class="input" data-f="min" placeholder="ต่ำสุด" step="any" value="' + (it.min != null ? it.min : '') + '" aria-label="ต่ำสุด">' +
            '<input type="number" class="input" data-f="max" placeholder="สูงสุด" step="any" value="' + (it.max != null ? it.max : '') + '" aria-label="สูงสุด">' : '') +
        '</div></div>';
    }).join('');
  }
  function openPlanDialog(p) {
    planIsNew = !p;
    planEditing = p ? JSON.parse(JSON.stringify(p)) : { id: '', type: '', typeName: '', freq: 'M1', hours: 0, shift: '', items: [], edited: true };
    planEditing.items = planEditing.items || [];
    planMaxNo = planEditing.items.reduce(function (m, it) { return Math.max(m, itemNo(it)); }, 0);
    $('dlgPlanTitle').textContent = planIsNew ? 'เพิ่มแผน PM' : 'แก้ไขแผน PM';
    $('pNewRow').hidden = !planIsNew;
    $('pFreq').innerHTML = C.FREQS.map(function (f) { return opt(f, C.FREQ_LABEL[f], planEditing.freq === f); }).join('');
    $('pType').value = planEditing.type; $('pTypeName').value = planEditing.typeName;
    $('pHours').value = planEditing.hours || ''; $('pShift').value = planEditing.shift || '';
    $('pDel').hidden = planIsNew; $('pMsg').textContent = '';
    renderPlanItems();
    $('dlgPlan').showModal();
  }
  $('pAdd').addEventListener('click', function () { openPlanDialog(null); });
  $('pList').addEventListener('click', function (e) {
    var row = e.target.closest('[data-pid]');
    if (row) openPlanDialog(getPlans().filter(function (p) { return p.id === row.getAttribute('data-pid'); })[0]);
  });
  $('pItemAdd').addEventListener('click', function () {
    // id ไม่นำกลับมาใช้หลังลบ: ต่อจากเลขสูงสุดที่เคยมีตอนเปิดกล่องนี้ (ผลตรวจเก่าอ้าง id)
    var mx = Math.max(planMaxNo, planEditing.items.reduce(function (m, it) { return Math.max(m, itemNo(it)); }, 0));
    planMaxNo = mx + 1;
    planEditing.items.push({ id: 'i' + planMaxNo, text: '', kind: 'check' });
    renderPlanItems();
    var inputs = $('pItems').querySelectorAll('[data-f="text"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });
  $('pItems').addEventListener('input', function (e) {
    var row = e.target.closest('.mnt-item'), f = e.target.getAttribute('data-f');
    if (!row || !f) return;
    var it = planEditing.items[+row.getAttribute('data-i')];
    if (f === 'text' || f === 'unit') it[f] = e.target.value;
    else it[f] = numOrNull(e.target.value);
  });
  $('pItems').addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'), row = e.target.closest('.mnt-item');
    if (!b || !row) return;
    var i = +row.getAttribute('data-i'), a = b.getAttribute('data-a'), items = planEditing.items;
    if (a === 'rm') items.splice(i, 1);
    else if (a === 'up' && i > 0) items.splice(i - 1, 0, items.splice(i, 1)[0]);
    else if (a === 'down' && i < items.length - 1) items.splice(i + 1, 0, items.splice(i, 1)[0]);
    else if (a === 'check') items[i].kind = 'check';
    else if (a === 'num') { items[i].kind = 'num'; if (items[i].min === undefined) items[i].min = null; if (items[i].max === undefined) items[i].max = null; }
    else return;
    renderPlanItems();
  });
  $('pCancel').addEventListener('click', function () { $('dlgPlan').close(); });
  $('formPlan').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = planEditing;
    if (planIsNew) {
      p.type = $('pType').value.trim(); p.typeName = $('pTypeName').value.trim() || typeNames()[p.type] || p.type; p.freq = $('pFreq').value;
      if (!p.type) { $('pMsg').textContent = 'ใส่ประเภท (code)'; return; }
      p.id = p.type + '|' + p.freq;
      if (getPlans().some(function (x) { return x.id === p.id; })) { $('pMsg').textContent = 'มีแผนนี้อยู่แล้ว'; return; }
    }
    p.hours = Math.max(0, parseFloat($('pHours').value) || 0); p.shift = $('pShift').value;
    p.items = p.items.filter(function (it) { return String(it.text).trim(); }).map(function (it) {
      it.text = String(it.text).trim();
      if (it.kind !== 'num') { it.kind = 'check'; delete it.unit; delete it.min; delete it.max; }
      return it;
    });
    if (!p.items.length) p.items = [{ id: 'i1', text: (p.typeName || p.type) + ' ' + C.FREQ_LABEL[p.freq], kind: 'check' }];
    p.edited = true; // นำเข้าซ้ำจะไม่ทับแผนที่แก้เอง
    upsert(K.plans, p);
    $('dlgPlan').close();
    renderCurrent();
  });
  $('pDel').addEventListener('click', function () {
    if (!window.confirm('ลบแผนนี้? (ผลตรวจที่บันทึกไว้แล้วไม่ถูกลบ)')) return;
    removeById(K.plans, planEditing.id);
    $('dlgPlan').close();
    renderCurrent();
  });

  /* ── กล่องเพิ่ม/แก้ไขอุปกรณ์ ── */
  var assetEditing = null, assetIsNew = false;
  function phaseSelectsHtml(a, plans) {
    return ['M3', 'M6', 'Annually'].filter(function (f) { return planOf(a.type, f, plans); }).map(function (f) {
      var n = C.STEP[f], cur = (a.phase && a.phase[f]) || 1, o = '';
      for (var i = 1; i <= n; i++) o += opt(i, 'เดือนที่ ' + i, i === cur);
      return '<div class="field"><label for="ph' + f + '">รอบ ' + esc(C.FREQ_LABEL[f]) + '</label><select id="ph' + f + '" data-ph="' + f + '">' + o + '</select></div>';
    }).join('');
  }
  function refreshPhaseRow() {
    var tmp = Object.assign({}, assetEditing, { type: $('eType').value.trim() });
    $('phaseRow').innerHTML = phaseSelectsHtml(tmp, getPlans());
  }
  function openAssetDialog(a) {
    assetIsNew = !a;
    var sites = getSites();
    assetEditing = a ? JSON.parse(JSON.stringify(a)) : { id: C.uid('e'), code: '', name: '', type: '', system: '', site: ui.site || (sites[0] && sites[0].id) || '',
      serial: '', brand: '', model: '', installed: '', lat: null, lng: null, phase: {}, status: 'active', srcKey: '', missing: false, note: '' };
    $('dlgAssetTitle').textContent = assetIsNew ? 'เพิ่มอุปกรณ์' : 'แก้ไขอุปกรณ์';
    $('eSite').innerHTML = sites.map(function (s) { return opt(s.id, s.name, s.id === assetEditing.site); }).join('');
    ['Code', 'Name', 'Type', 'System', 'Serial', 'Brand', 'Model', 'Installed', 'Note'].forEach(function (f) { $('e' + f).value = assetEditing[f.toLowerCase()] || ''; });
    $('eStatus').value = assetEditing.status === 'retired' ? 'retired' : 'active';
    $('eLat').value = assetEditing.lat != null ? assetEditing.lat : ''; $('eLng').value = assetEditing.lng != null ? assetEditing.lng : '';
    $('eMsg').textContent = '';
    $('eDel').hidden = assetIsNew;
    refreshPhaseRow();
    $('dlgAsset').showModal();
  }
  $('eType').addEventListener('input', refreshPhaseRow);
  $('aAdd').addEventListener('click', function () {
    if (!getSites().length) { toast('เพิ่มสถานที่ก่อน', 'err'); $('dSites').open = true; return; }
    openAssetDialog(null);
  });
  $('eCancel').addEventListener('click', function () { $('dlgAsset').close(); });
  $('eGeo').addEventListener('click', function () {
    if (!navigator.geolocation) { $('eMsg').textContent = 'อุปกรณ์นี้ไม่รองรับระบุตำแหน่ง'; return; }
    navigator.geolocation.getCurrentPosition(function (p) {
      $('eLat').value = +p.coords.latitude.toFixed(6); $('eLng').value = +p.coords.longitude.toFixed(6); $('eMsg').textContent = '';
    }, function () { $('eMsg').textContent = 'อ่านตำแหน่งไม่ได้'; }, { enableHighAccuracy: true, timeout: 15000 });
  });
  $('formAsset').addEventListener('submit', function (e) {
    e.preventDefault();
    var a = assetEditing, code = $('eCode').value.trim();
    if (!code) { $('eMsg').textContent = 'ใส่รหัสอุปกรณ์'; return; }
    if (getAssets().some(function (x) { return x.id !== a.id && norm(x.code) === norm(code); })) { $('eMsg').textContent = 'รหัสนี้มีอยู่แล้ว'; return; }
    if (!$('eSite').value) { $('eMsg').textContent = 'เลือกสถานที่'; return; }
    a.code = code; a.name = $('eName').value.trim() || code; a.type = $('eType').value.trim(); a.system = $('eSystem').value.trim();
    a.site = $('eSite').value; a.status = $('eStatus').value; a.serial = $('eSerial').value.trim(); a.brand = $('eBrand').value.trim();
    a.model = $('eModel').value.trim(); a.installed = $('eInstalled').value; a.note = $('eNote').value.trim();
    a.lat = numOrNull($('eLat').value); a.lng = numOrNull($('eLng').value);
    var phase = {};
    ['M3', 'M6', 'Annually'].forEach(function (f) {
      var sel = $('ph' + f);
      if (sel) phase[f] = +sel.value;
      else if (a.phase && a.phase[f] && planOf(a.type, f)) phase[f] = a.phase[f];
    });
    a.phase = phase;
    upsert(K.assets, a);
    $('dlgAsset').close();
    renderCurrent();
  });
  $('eDel').addEventListener('click', function () {
    var a = assetEditing;
    assetHasRecords(a.id).then(function (has) {
      if (has) { $('eMsg').textContent = 'มีผลตรวจ/ใบสั่งงานแล้ว — ลบไม่ได้ ใช้ "ปลดใช้งาน" แทน'; return; }
      if (!window.confirm('ลบอุปกรณ์นี้?')) return;
      removeById(K.assets, a.id);
      $('dlgAsset').close();
      if (location.hash) location.hash = ''; else renderCurrent();
    });
  });

  /* ══════════ QR: พิมพ์ป้าย + สแกน ══════════ */
  function labelHtml(a, sites, big) {
    return '<div class="lbl"><div class="qr">' + Q.svg(Q.url(a.id), { cell: 4, margin: 1 }) + '</div><div class="tx"><div class="cd">' + esc(a.code) + '</div>' +
      '<div class="nm">' + esc(a.name) + '</div><div class="st">' + esc(siteName(a.site, sites)) + '</div></div></div>';
  }
  function printLabels(list) {
    if (!list.length) return;
    var sites = getSites(), size = getSettings().labelSize === '2x5' ? '2x5' : '3x8', per = size === '2x5' ? 10 : 24, html = '';
    for (var i = 0; i < list.length; i += per) {
      html += '<div class="pg g' + size + '">' + list.slice(i, i + per).map(function (a) { return labelHtml(a, sites); }).join('') + '</div>';
    }
    $('printArea').innerHTML = html;
    document.body.classList.add('printing');
    var off = function () { document.body.classList.remove('printing'); $('printArea').innerHTML = ''; window.removeEventListener('afterprint', off); };
    window.addEventListener('afterprint', off);
    window.print();
  }
  $('aPrint').addEventListener('click', function () {
    var assets = getAssets(), ids = Object.keys(picked);
    var list = ids.length ? assets.filter(function (a) { return picked[a.id]; }) : filteredAssets(assets);
    printLabels(list);
  });

  var scanning = null;
  function scanDone(text) {
    var id = Q.parse(text, getAssets());
    if (id && assetById(id)) { closeScan(); location.hash = '#asset=' + encodeURIComponent(id); return true; }
    $('scanMsg').textContent = id ? 'ไม่พบอุปกรณ์นี้ในทะเบียน' : 'ไม่พบอุปกรณ์ที่ตรงกับ QR/รหัสนี้';
    return false;
  }
  function startScan() {
    var p = Q.scan($('scanVideo'));
    scanning = p;
    p.then(function (text) {
      if (scanning !== p) return;
      scanning = null;
      if (text != null && !scanDone(text)) startScan();
    }, function (err) {
      if (scanning === p) scanning = null;
      $('scanMsg').textContent = (err && err.message) || 'เปิดกล้องไม่ได้';
    });
  }
  function openScan() {
    $('scanMsg').textContent = ''; $('scanCode').value = '';
    $('dlgScan').showModal();
    startScan();
  }
  function closeScan() {
    if (scanning) { var p = scanning; scanning = null; p.cancel(); }
    if ($('dlgScan').open) $('dlgScan').close();
  }
  $('aScan').addEventListener('click', openScan);
  $('scanClose').addEventListener('click', closeScan);
  $('dlgScan').addEventListener('close', function () { if (scanning) { var p = scanning; scanning = null; p.cancel(); } });
  $('scanGo').addEventListener('click', function () { var v = $('scanCode').value.trim(); if (v) scanDone(v); });
  $('scanCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('scanGo').click(); } });
  $('scanPhoto').addEventListener('click', function () { $('scanFile').click(); });
  $('scanFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    $('scanMsg').textContent = '';
    Q.decodeImage(f).then(function (t) {
      if (t == null) $('scanMsg').textContent = 'ไม่พบ QR ในรูป';
      else scanDone(t);
    }, function (err) { $('scanMsg').textContent = (err && err.message) || 'อ่านรูปไม่ได้'; });
  });

  /* ══════════ มุมมองอุปกรณ์ (#asset=<id>) ══════════ */
  var viewSections = []; // ขั้นถัดไปเพิ่มส่วน (รอบที่ครบ, ผลตรวจ, ใบงาน) ที่นี่: function(a) → html | Promise<html>
  function assetViewId() {
    var m = /^#asset=(.+)$/.exec(location.hash);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }
  var viewToken = 0;
  function renderAssetView() {
    var id = assetViewId(), a = id && assetById(id), el = $('assetView'), token = ++viewToken;
    $('listView').hidden = true; el.hidden = false;
    if (!a) {
      el.innerHTML = '<div class="empty">' + icon('circle-alert') + '<p class="empty-title">ไม่พบอุปกรณ์</p>' +
        '<button class="btn primary" type="button" data-act="scan">' + icon('scan-line') + 'สแกนใหม่</button> <button class="btn" type="button" data-act="back">กลับ</button></div>';
      return;
    }
    var sites = getSites(), plans = getPlans(), c = coordsOf(a, sites), tn = typeNames(plans);
    var meta = [siteName(a.site, sites), a.system, tn[a.type] || a.type].filter(Boolean).join(' · ');
    var head = '<div class="head"><button class="btn sm icon ghost" type="button" data-act="back" aria-label="กลับ">' + icon('arrow-left') + '</button>' +
      '<h2>' + esc(a.code) + ' · ' + esc(a.name) + '</h2>' +
      (a.status === 'retired' ? '<span class="badge">ปลดใช้งาน</span>' : '') + '<button class="btn sm icon" type="button" data-act="edit" aria-label="แก้ไข">' + icon('pencil') + '</button></div>' +
      '<div class="muted">' + esc(meta) + '</div>' +
      (c ? '<div><a class="btn sm" href="' + mapUrl(c.lat, c.lng) + '" target="_blank" rel="noopener">' + icon('map-pin') + 'แผนที่</a></div>' : '');
    var qr = '<section class="card"><div class="mnt-qrbox"><div class="qr">' + Q.svg(Q.url(a.id), { cell: 4, margin: 1 }) + '</div>' +
      '<div><div class="title">' + esc(a.code) + '</div><div class="meta">' + esc(a.name) + '</div>' +
      '<div class="row" style="margin-top:8px"><button class="btn sm" type="button" data-act="print">' + icon('printer') + 'พิมพ์ป้าย</button></div></div></div></section>';
    el.innerHTML = head + '<div id="viewSections"></div>' + qr;
    Promise.all(viewSections.map(function (f) { return Promise.resolve(f(a)); })).then(function (parts) {
      if (token !== viewToken || assetViewId() !== a.id) return;
      var box = $('viewSections');
      if (box) box.innerHTML = parts.join('');
    });
  }
  $('assetView').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act'), a = assetById(assetViewId());
    if (act === 'back') location.hash = '';
    else if (act === 'scan') openScan();
    else if (act === 'edit' && a) openAssetDialog(a);
    else if (act === 'print' && a) printLabels([a]);
    else if (renderers.viewAction) renderers.viewAction(act, b, a);
  });

  function route() {
    var inView = /^#asset=/.test(location.hash);
    $('assetView').hidden = !inView; $('listView').hidden = inView;
    if (!inView) { $('assetView').innerHTML = ''; }
    renderCurrent();
    $('main').scrollTop = 0;
  }
  window.addEventListener('hashchange', route);

  /* ══════════ รูป: ย่อ + คิวส่ง R2 (outbox) ══════════ */
  function idbUpdate(name, store, id, fn) { // อ่าน→แก้→เขียนใน transaction เดียว (fn(rec|null) → rec ใหม่ | undefined = ไม่เขียน)
    return openDb(name).then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, 'readwrite'), os = tx.objectStore(store), out;
        var g = os.get(id);
        g.onsuccess = function () {
          out = fn(g.result || null);
          if (out) os.put(out);
        };
        tx.oncomplete = function () { resolve(out); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }
  function shrinkImage(file) { // ด้านยาว ≤ 1600px, JPEG 0.8 (แปลง HEIC/PNG ไปด้วย)
    function draw(src, w, h) {
      var k = Math.min(1, 1600 / Math.max(w, h)), cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(src, 0, 0, cv.width, cv.height);
      return new Promise(function (resolve, reject) {
        cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('แปลงรูปไม่ได้')); }, 'image/jpeg', 0.8);
      });
    }
    function viaImg() {
      return new Promise(function (resolve, reject) {
        var u = URL.createObjectURL(file), img = new Image();
        img.onload = function () { URL.revokeObjectURL(u); draw(img, img.naturalWidth, img.naturalHeight).then(resolve, reject); };
        img.onerror = function () { URL.revokeObjectURL(u); reject(new Error('เปิดรูปไม่ได้')); };
        img.src = u;
      });
    }
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bmp) {
        return draw(bmp, bmp.width, bmp.height).then(function (b) { if (bmp.close) bmp.close(); return b; });
      }).catch(function () { return viaImg(); });
    }
    return viaImg();
  }
  var thumbUrls = {}; // outbox id → blob URL
  function addToOutbox(blob, name, owner, isDraft) {
    var rec = { id: C.uid('p'), op: 'upload', blob: blob, name: name, mime: 'image/jpeg', owner: owner, tries: 0, createdAt: Date.now(), draft: !!isDraft };
    thumbUrls[rec.id] = URL.createObjectURL(blob);
    return idbPut(OUTBOX.db, 'q', rec).then(function () { return rec; });
  }
  function queueDelete(fileId) {
    return idbPut(OUTBOX.db, 'q', { id: C.uid('p'), op: 'delete', fileId: fileId, tries: 0, createdAt: Date.now(), draft: false });
  }
  function outboxCount() { return idbAll(OUTBOX.db, 'q').then(function (l) { return l.filter(function (r) { return !r.draft; }).length; }).catch(function () { return 0; }); }

  function photoListOf(doc, owner) {
    return owner.store === 'insp' ? (doc.rows && doc.rows[owner.asset] && doc.rows[owner.asset].photos) : doc.photos;
  }
  function hasPending(doc, owner, pendingId) {
    return (photoListOf(doc, owner) || []).some(function (p) { return p && p.pending === pendingId; });
  }
  function patchPhotoRef(doc, owner, pendingId, ref) { // true = พบและแก้แล้ว
    var list = photoListOf(doc, owner), found = false;
    (list || []).forEach(function (p, i) {
      if (p && p.pending === pendingId) { list[i] = Object.assign({ item: p.item }, ref); found = true; }
    });
    return found;
  }
  var flushing = false;
  function flushOutbox() {
    if (flushing || !filesAvailable() || navigator.onLine === false) return Promise.resolve();
    flushing = true;
    return idbAll(OUTBOX.db, 'q').then(function (items) {
      items.sort(function (a, b) { return a.createdAt - b.createdAt; });
      var chain = Promise.resolve(), stop = false;
      items.forEach(function (it) {
        chain = chain.then(function () {
          if (stop) return;
          if (it.draft) { // ร่างที่ไม่มีใครกลับมาเปิดเกิน 7 วัน = ทิ้ง
            if (Date.now() - it.createdAt > 7 * 86400000) return idbDelete(OUTBOX.db, 'q', it.id);
            return;
          }
          if (it.op === 'delete') {
            return fetch('/api/files?id=' + encodeURIComponent(it.fileId), { method: 'DELETE', credentials: 'same-origin' }).then(function (r) {
              if (r.ok || r.status === 404) return idbDelete(OUTBOX.db, 'q', it.id);
              return idbPut(OUTBOX.db, 'q', Object.assign(it, { tries: it.tries + 1 }));
            }).catch(function () { stop = true; });
          }
          return idbGet(it.owner.db, it.owner.store, it.owner.id).then(function (doc) {
            if (!doc || !hasPending(doc, it.owner, it.id)) return idbDelete(OUTBOX.db, 'q', it.id); // เจ้าของไม่อยู่แล้ว — ไม่ต้องส่ง
            return fetch('/api/files?ns=maintenance&ref=' + encodeURIComponent(it.owner.id) + '&name=' + encodeURIComponent(it.name), {
              method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': it.mime || 'image/jpeg' }, body: it.blob
            }).then(function (r) {
              return r.json().catch(function () { return {}; }).then(function (j) {
                if (!r.ok || !j.id) {
                  var perm = r.status >= 400 && r.status < 500 && [401, 403, 408, 429].indexOf(r.status) === -1;
                  if (perm && it.tries >= 7) return idbDelete(OUTBOX.db, 'q', it.id);
                  return idbPut(OUTBOX.db, 'q', Object.assign(it, { tries: it.tries + 1 }));
                }
                var ref = { id: j.id, name: j.name, size: j.size, mime: j.mime };
                return idbUpdate(it.owner.db, it.owner.store, it.owner.id, function (d) { return d && patchPhotoRef(d, it.owner, it.id, ref) ? d : undefined; })
                  .then(function () { return idbDelete(OUTBOX.db, 'q', it.id); }).then(function () {
                    if (thumbUrls[it.id]) { URL.revokeObjectURL(thumbUrls[it.id]); delete thumbUrls[it.id]; }
                  });
              });
            });
          }).catch(function () { stop = true; }); // ออฟไลน์/เครือข่ายล้ม — ไม่นับ tries รอรอบหน้า
        });
      });
      return chain;
    }).catch(function () {}).then(function () { flushing = false; updatePending(); });
  }
  function updatePending() {
    outboxCount().then(function (n) {
      var b = $('pendBadge');
      if (!b) return;
      b.hidden = !n; b.textContent = 'รอส่งรูป ' + n;
    });
  }
  window.addEventListener('online', function () { flushOutbox(); });
  setInterval(function () { if (document.visibilityState === 'visible') flushOutbox(); }, 60000);

  /* ══════════ ร่างฟอร์มตรวจ (localStorage local: tanot:mnt:draft) ══════════ */
  function readDrafts() {
    try { var v = JSON.parse(localStorage.getItem(K.draft)); return v && v.items ? v : { v: 1, items: {} }; } catch (e) { return { v: 1, items: {} }; }
  }
  function writeDrafts(d) {
    var keys = Object.keys(d.items);
    if (keys.length > 40) keys.sort(function (a, b) { return d.items[a].savedAt - d.items[b].savedAt; }).slice(0, keys.length - 40).forEach(function (k) { delete d.items[k]; });
    try { localStorage.setItem(K.draft, JSON.stringify(d)); } catch (e) {}
  }
  function draftKey(aid, freq, period) { return aid + '|' + freq + '|' + period; }

  /* ══════════ ฟอร์มตรวจเช็ก ══════════ */
  var F = null;      // สถานะฟอร์มที่เปิดอยู่
  var batch = null;  // { assets: [id…], i, freq, period }
  var draftTimer = null;
  var photoTarget = null; // item id | '' (รูปรวม)
  var STATE_LABEL = { done: 'ตรวจแล้ว', 'late-done': 'ตรวจช้า', overdue: 'เลยกำหนด', due: 'ถึงกำหนด', upcoming: 'ยังไม่ถึง' };
  var STATE_BADGE = { done: 'ok', 'late-done': 'warn', overdue: 'err', due: 'accent', upcoming: '' };
  function cssId(id) { return window.CSS && CSS.escape ? CSS.escape(id) : id; }

  function periodLabel(freq, period) {
    if (freq === 'Daily') return dateTh(period);
    if (freq === 'Weekly') { var w = C.window('Weekly', period); return 'สัปดาห์ ' + dateTh(w.start) + ' – ' + dateTh(w.end); }
    var d = C.parseYmd(period + '-01');
    return d ? d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }) : period;
  }
  /* รอบที่เลือกได้ของอุปกรณ์×แผน: รอบที่ครบกำหนดย้อนหลังจนถึงวันนี้ (ไม่มีรอบเลย = รอบปัจจุบันเพื่อให้ฟอร์มใช้ได้เสมอ) */
  function periodOptions(asset, plan, settings, done) {
    var t = today(), look = plan.freq === 'Daily' ? C.addDays(t, -30) : plan.freq === 'Weekly' ? C.addDays(t, -84) : C.addMonths(t.slice(0, 7), -24) + '-01';
    var list = C.periods(asset, plan, settings, look, t);
    if (!list.length) list = [C.periodOf(plan.freq, t)];
    return list.map(function (p) { return { period: p, state: C.status(asset, plan, p, done, t) }; });
  }
  function defaultPeriod(opts, freq) {
    var cur = C.periodOf(freq, today());
    if (freq !== 'Daily' && freq !== 'Weekly') {
      var od = opts.filter(function (o) { return o.state === 'overdue'; })[0];
      if (od) return od.period;
    }
    if (opts.some(function (o) { return o.period === cur; })) return cur;
    return opts.length ? opts[opts.length - 1].period : cur;
  }
  function planFreqsOf(asset, plans) { return C.FREQS.filter(function (f) { return planOf(asset.type, f, plans); }); }

  function openInsp(assetId, freq, period, batchCtx) {
    var asset = assetById(assetId);
    if (!asset) return Promise.resolve();
    batch = batchCtx || null;
    return loadAllInsp().then(function (docs) {
      var plans = getPlans(), freqs = planFreqsOf(asset, plans);
      if (!freqs.length) { toast('อุปกรณ์นี้ยังไม่มีแผน PM', 'err'); return; }
      var f = freqs.indexOf(freq) !== -1 ? freq : freqs[0];
      F = { asset: asset, freq: f, period: '', docs: docs, plans: plans, photos: [], res: {}, note: '', by: '', start: 0, removed: [], draft: null };
      $('inspFreq').innerHTML = freqs.map(function (x) { return opt(x, C.FREQ_LABEL[x], x === f); }).join('');
      return loadForm(period || null).then(function () { if (F && !$('dlgInsp').open) $('dlgInsp').showModal(); }); // เปิดกล่องหลังโหลดเสร็จ — กันพิมพ์ทับค่าที่กำลังโหลด
    });
  }
  function currentDoneIdx() { return C.doneIndex(F.docs); }

  /* โหลดข้อมูลของ (อุปกรณ์, ความถี่, รอบ) ลงฟอร์ม: ใบตรวจเดิมของเครื่องนี้ → ค่าตั้งต้น · ร่างที่ค้าง → แสดงแถบถามกู้ */
  function loadForm(periodWanted) {
    var asset = F.asset, plan = planOf(asset.type, F.freq, F.plans), settings = getSettings(), done = currentDoneIdx();
    F.plan = plan;
    var opts = periodOptions(asset, plan, settings, done);
    var per = periodWanted || defaultPeriod(opts, F.freq);
    if (!opts.some(function (o) { return o.period === per; })) opts.push({ period: per, state: C.status(asset, plan, per, done, today()) });
    opts.sort(function (a, b) { return a.period < b.period ? -1 : 1; });
    F.period = per;
    $('inspPeriod').innerHTML = opts.map(function (o) {
      return opt(o.period, periodLabel(F.freq, o.period) + (o.state === 'done' || o.state === 'late-done' ? ' ✓' : o.state === 'overdue' ? ' ⚠' : ''), o.period === per);
    }).join('');
    $('inspFreq').value = F.freq;
    F.site = asset.site; F.year = C.periodYear(per); F.locked = lockedYear(F.year);
    F.docId = C.inspId(F.site, F.freq, per, deviceId());
    $('inspMsg').textContent = '';
    var token = F.token = (F.token || 0) + 1;
    return idbGet(inspDbName(F.year), 'insp', F.docId).then(function (doc) {
      if (!F || F.token !== token) return;
      F.doc = doc;
      var row = doc && doc.rows && doc.rows[asset.id];
      F.res = row && row.res ? JSON.parse(JSON.stringify(row.res)) : {};
      F.note = row ? row.note || '' : '';
      F.photos = row && row.photos ? JSON.parse(JSON.stringify(row.photos)) : [];
      F.start = row && row.start ? row.start : Date.now();
      F.wo = row && row.wo ? row.wo : null;
      F.by = (doc && doc.by) || getSettings().inspector || ui.by || '';
      F.removed = [];
      var other = F.docs.filter(function (d) { return d.id !== F.docId && d.site === F.site && d.freq === F.freq && d.period === per && d.rows && d.rows[asset.id]; })[0];
      F.otherDone = other ? { by: other.by, at: other.rows[asset.id].at } : null;
      var dr = readDrafts().items[draftKey(asset.id, F.freq, per)];
      F.draft = dr || null;
      $('inspDraftBar').hidden = !dr || F.locked;
      renderInsp();
    });
  }

  function numWarn(it, v) {
    if (v == null || v === '' || isNaN(+v)) return '';
    if (it.min != null && +v < it.min) return 'ต่ำกว่าเกณฑ์ (' + it.min + ')';
    if (it.max != null && +v > it.max) return 'สูงกว่าเกณฑ์ (' + it.max + ')';
    return '';
  }
  function camBtn(item, label) {
    return filesAvailable() && !F.locked
      ? '<button class="btn sm' + (label ? '' : ' icon') + '" type="button" data-cam="' + esc(item) + '"' + (label ? '' : ' aria-label="ถ่ายรูป"') + '>' + icon('camera') + (label || '') + '</button>' : '';
  }
  function photosHtml(item) { // item '' = รูปรวม
    return F.photos.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return (x.p.item || '') === item; }).map(function (x) {
      var p = x.p, src = '', cls = 'insp-ph';
      if (p.pending) { cls += ' pend'; src = thumbUrls[p.pending] || ''; }
      else if (filesAvailable() && navigator.onLine !== false) src = '/api/files?id=' + encodeURIComponent(p.id);
      return '<span class="' + cls + '" data-pi="' + x.i + '">' + (src ? '<img alt="" src="' + esc(src) + '">' : icon('image')) +
        (F.locked ? '' : '<button class="x" type="button" data-rmph="' + x.i + '" aria-label="ลบรูป">×</button>') + '</span>';
    }).join('');
  }
  function itemHtml(it) {
    var r = F.res[it.id], dis = F.locked ? ' disabled' : '', body;
    if (it.kind === 'num') {
      body = '<div class="ctl"><input type="number" class="input" inputmode="decimal" step="any" data-num="' + esc(it.id) + '" value="' + (r != null && r !== '' ? esc(r) : '') + '"' + dis + ' aria-label="' + esc(it.text) + '">' +
        (it.unit ? '<span class="unit">' + esc(it.unit) + '</span>' : '') + '</div>';
    } else {
      body = '<div class="ctl"><div class="segmented" role="group" aria-label="' + esc(it.text) + '">' +
        [['ok', 'ผ่าน', 'yes'], ['ng', 'ไม่ผ่าน', 'no'], ['na', 'ไม่มี', '']].map(function (o) {
          return '<button type="button" data-res="' + o[0] + '" data-item="' + esc(it.id) + '" class="' + (r === o[0] ? 'on ' + o[2] : '') + '" aria-pressed="' + (r === o[0]) + '"' + dis + '>' + o[1] + '</button>';
        }).join('') + '</div></div>';
    }
    return '<div class="insp-item' + (r === 'ng' ? ' ng' : '') + '" data-iid="' + esc(it.id) + '"><div class="q">' + esc(it.text) + '</div>' + body +
      '<div class="insp-warn" data-warn="' + esc(it.id) + '">' + esc(it.kind === 'num' ? numWarn(it, r) : '') + '</div>' +
      '<div class="insp-photos" data-ph="' + esc(it.id) + '">' + photosHtml(it.id) + camBtn(it.id) + '</div></div>';
  }
  function renderInsp() {
    var a = F.asset, plan = F.plan;
    $('inspTitle').textContent = a.code + ' · ' + a.name;
    $('inspLock').hidden = !F.locked;
    $('inspBy').value = F.by; $('inspBy').disabled = F.locked;
    $('inspNote').value = F.note; $('inspNote').disabled = F.locked;
    $('inspFreq').disabled = !!batch; $('inspPeriod').disabled = !!batch;
    $('inspSave').disabled = F.locked;
    var st = C.status(a, plan, F.period, currentDoneIdx(), today());
    $('inspState').innerHTML = '<span class="badge ' + (STATE_BADGE[st] || '') + '">' + STATE_LABEL[st] + '</span>' +
      (F.otherDone ? '<span class="badge info">ตรวจแล้วจากเครื่องอื่น' + (F.otherDone.by ? ' (' + esc(F.otherDone.by) + ')' : '') + '</span>' : '') +
      (F.doc && F.doc.rows && F.doc.rows[a.id] ? '<span class="meta">บันทึกล่าสุด ' + esc(new Date(F.doc.rows[a.id].at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })) + '</span>' : '');
    $('inspItems').innerHTML = plan.items.map(itemHtml).join('');
    $('inspGenPhotos').innerHTML = photosHtml('') + camBtn('', 'รูปรวม');
    $('inspNav').hidden = !batch;
    if (batch) {
      $('inspPos').textContent = (batch.i + 1) + ' / ' + batch.assets.length;
      $('inspPrev').disabled = batch.i === 0;
      $('inspNext').textContent = batch.i === batch.assets.length - 1 ? 'เสร็จสิ้น' : 'ถัดไป';
    }
    $('inspSave').textContent = batch && batch.i < batch.assets.length - 1 ? 'บันทึกแล้วถัดไป' : 'บันทึก';
    fillPendingThumbs();
  }
  function rerenderPhotos() {
    if (!F) return;
    F.plan.items.forEach(function (it) {
      var box = document.querySelector('[data-ph="' + cssId(it.id) + '"]');
      if (box) box.innerHTML = photosHtml(it.id) + camBtn(it.id);
    });
    $('inspGenPhotos').innerHTML = photosHtml('') + camBtn('', 'รูปรวม');
  }
  function fillPendingThumbs() { // ร่างที่กู้จากรอบก่อน: blob อยู่ใน outbox
    F.photos.forEach(function (p) {
      if (p.pending && !thumbUrls[p.pending]) {
        idbGet(OUTBOX.db, 'q', p.pending).then(function (rec) {
          if (rec && rec.blob && !thumbUrls[p.pending]) { thumbUrls[p.pending] = URL.createObjectURL(rec.blob); rerenderPhotos(); }
        }).catch(function () {});
      }
    });
  }

  /* ร่าง: เก็บทุกการเปลี่ยน (debounce 400 ms) — iOS ปิด PWA ที่อยู่เบื้องหลังบ่อย */
  function scheduleDraft() {
    if (F && F.locked) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 400);
  }
  function saveDraft() {
    clearTimeout(draftTimer); draftTimer = null;
    if (!F || F.locked || !F.plan || !$('dlgInsp').open) return;
    var d = readDrafts();
    d.items[draftKey(F.asset.id, F.freq, F.period)] = { by: F.by, res: F.res, note: F.note, photos: F.photos, start: F.start, savedAt: Date.now() };
    writeDrafts(d);
  }
  function dropDraft(aid, freq, period) {
    var d = readDrafts(), key = draftKey(aid, freq, period);
    if (d.items[key]) { delete d.items[key]; writeDrafts(d); }
  }

  $('inspFreq').addEventListener('change', function () { saveDraft(); F.freq = this.value; loadForm(null); });
  $('inspPeriod').addEventListener('change', function () { saveDraft(); loadForm(this.value); });
  $('inspBy').addEventListener('input', function () { F.by = this.value; scheduleDraft(); });
  $('inspNote').addEventListener('input', function () { F.note = this.value; scheduleDraft(); });
  $('inspItems').addEventListener('click', function (e) {
    var b = e.target.closest('[data-res]');
    if (b && !F.locked) {
      var id = b.getAttribute('data-item'), v = b.getAttribute('data-res');
      if (F.res[id] === v) delete F.res[id]; else F.res[id] = v;
      var it = document.querySelector('.insp-item[data-iid="' + cssId(id) + '"]');
      if (it) {
        it.classList.toggle('ng', F.res[id] === 'ng');
        Array.prototype.forEach.call(it.querySelectorAll('[data-res]'), function (x) {
          var k = x.getAttribute('data-res'), on = k === F.res[id];
          x.className = on ? 'on ' + (k === 'ok' ? 'yes' : k === 'ng' ? 'no' : '') : ''; x.setAttribute('aria-pressed', String(on));
        });
      }
      scheduleDraft();
      return;
    }
    handlePhotoClick(e);
  });
  $('inspItems').addEventListener('input', function (e) {
    var id = e.target.getAttribute('data-num');
    if (id == null || F.locked) return;
    var v = e.target.value === '' ? null : parseFloat(e.target.value);
    if (v == null || isNaN(v)) delete F.res[id]; else F.res[id] = v;
    var it = F.plan.items.filter(function (x) { return x.id === id; })[0], w = document.querySelector('[data-warn="' + cssId(id) + '"]');
    if (w && it) w.textContent = numWarn(it, v);
    scheduleDraft();
  });
  $('inspGenPhotos').addEventListener('click', handlePhotoClick);
  function handlePhotoClick(e) {
    var cam = e.target.closest('[data-cam]');
    if (cam) { photoTarget = cam.getAttribute('data-cam'); $('inspFile').click(); return; }
    var rm = e.target.closest('[data-rmph]');
    if (rm && !F.locked) removePhoto(+rm.getAttribute('data-rmph'));
  }
  $('inspFile').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files || []), target = photoTarget || '';
    this.value = '';
    if (!files.length || !F || F.locked) return;
    $('inspMsg').textContent = '';
    files.reduce(function (chain, f) {
      return chain.then(function () {
        return shrinkImage(f).then(function (blob) {
          var owner = { db: inspDbName(F.year), store: 'insp', id: F.docId, asset: F.asset.id };
          return addToOutbox(blob, F.asset.code + '_' + (target || 'all') + '_' + Date.now() + '.jpg', owner, true).then(function (rec) {
            F.photos.push({ item: target || null, pending: rec.id });
          });
        }).catch(function (err) { $('inspMsg').textContent = (err && err.message) || 'เพิ่มรูปไม่ได้'; });
      });
    }, Promise.resolve()).then(function () { rerenderPhotos(); saveDraft(); });
  });
  function removePhoto(i) {
    var p = F.photos[i];
    if (!p) return;
    F.photos.splice(i, 1);
    if (p.pending) idbDelete(OUTBOX.db, 'q', p.pending).catch(function () {});
    else if (p.id) F.removed.push(p.id); // ลบจาก R2 จริงตอนกดบันทึก
    rerenderPhotos();
    scheduleDraft();
  }

  $('inspDraftRestore').addEventListener('click', function () {
    var d = F.draft;
    if (!d) return;
    F.res = d.res || {}; F.note = d.note || ''; F.photos = d.photos || []; F.by = d.by || F.by; F.start = d.start || F.start;
    $('inspDraftBar').hidden = true;
    renderInsp();
  });
  $('inspDraftDrop').addEventListener('click', function () {
    var keep = {};
    F.photos.forEach(function (p) { if (p.pending) keep[p.pending] = true; });
    ((F.draft && F.draft.photos) || []).forEach(function (p) { if (p.pending && !keep[p.pending]) idbDelete(OUTBOX.db, 'q', p.pending).catch(function () {}); });
    dropDraft(F.asset.id, F.freq, F.period);
    F.draft = null;
    $('inspDraftBar').hidden = true;
  });

  $('inspCancel').addEventListener('click', function () { saveDraft(); $('dlgInsp').close(); });
  $('dlgInsp').addEventListener('cancel', function () { saveDraft(); });
  $('dlgInsp').addEventListener('close', function () { clearTimeout(draftTimer); F = null; batch = null; renderCurrent(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveDraft(); });
  window.addEventListener('pagehide', saveDraft);

  /* บันทึก: อ่าน→แก้→เขียนใบตรวจรอบ (สถานที่×ความถี่×รอบ×เครื่อง) ของฐานข้อมูลปีของรอบ */
  function saveInsp() {
    if (!F || F.locked) return Promise.resolve(null);
    var a = F.asset, miss = F.plan.items.filter(function (it) { return it.kind !== 'num' && !F.res[it.id]; });
    if (miss.length) { $('inspMsg').textContent = 'ยังไม่ได้ตรวจ ' + miss.length + ' ข้อ'; return Promise.resolve(null); }
    if (!String(F.by).trim()) { $('inspMsg').textContent = 'ใส่ชื่อผู้ตรวจ'; return Promise.resolve(null); }
    var now = Date.now(), res = {}, keepPending = {};
    F.plan.items.forEach(function (it) {
      var v = F.res[it.id];
      res[it.id] = it.kind === 'num' ? (v == null || v === '' || isNaN(+v) ? null : +v) : v;
    });
    F.photos.forEach(function (p) { if (p.pending) keepPending[p.pending] = true; });
    var snap = { site: F.site, freq: F.freq, period: F.period, docId: F.docId, year: F.year, by: String(F.by).trim(), note: F.note,
      photos: F.photos.slice(), start: F.start, wo: F.wo, removed: F.removed.slice(), asset: a, items: F.plan.items };
    return idbUpdate(inspDbName(snap.year), 'insp', snap.docId, function (doc) {
      doc = doc || { id: snap.docId, site: snap.site, freq: snap.freq, period: snap.period, dev: deviceId(), by: '', at: 0, rows: {} };
      doc.by = snap.by; doc.at = now;
      doc.rows[a.id] = { start: snap.start, at: now, res: res, note: snap.note, photos: snap.photos, wo: snap.wo };
      return doc;
    }).then(function () {
      ui.by = snap.by; saveUi();
      // รูปที่บันทึกแล้ว: ปลดจากสถานะร่าง ให้ตัวส่งเอาไปส่งได้
      return Promise.all(Object.keys(keepPending).map(function (pid) {
        return idbUpdate(OUTBOX.db, 'q', pid, function (rec) { return rec ? Object.assign(rec, { draft: false }) : undefined; });
      })).then(function () { return Promise.all(snap.removed.map(queueDelete)); });
    }).then(function () {
      dropDraft(a.id, snap.freq, snap.period);
      return loadAllInsp();
    }).then(function (docs) {
      if (F) F.docs = docs;
      flushOutbox(); updatePending();
      return { ng: snap.items.filter(function (it) { return res[it.id] === 'ng'; }), snap: snap, res: res };
    });
  }
  function afterSave(r) {
    toast('บันทึกแล้ว');
    var go = function () {
      if (batch && batch.i < batch.assets.length - 1) { batch.i++; loadBatchAsset(); }
      else $('dlgInsp').close();
    };
    if (r.ng.length && renderers.offerWo) renderers.offerWo(r, go); else go();
  }
  $('formInsp').addEventListener('submit', function (e) {
    e.preventDefault();
    saveInsp().then(function (r) { if (r) afterSave(r); }).catch(function (err) { $('inspMsg').textContent = (err && err.message) || 'บันทึกไม่สำเร็จ'; });
  });

  /* ตรวจทั้งสถานที่: ไล่ฟอร์มทีละตัวที่ครบรอบ (รอบเดียวกัน) บันทึกลงใบตรวจรอบเดียวกัน */
  function loadBatchAsset() {
    var asset = assetById(batch.assets[batch.i]);
    if (!asset || !F) return;
    F.asset = asset; F.freq = batch.freq; F.plans = getPlans();
    loadForm(batch.period);
  }
  $('inspPrev').addEventListener('click', function () { if (batch && batch.i > 0) { saveDraft(); batch.i--; loadBatchAsset(); } });
  $('inspNext').addEventListener('click', function () {
    if (!batch) return;
    saveDraft();
    if (batch.i < batch.assets.length - 1) { batch.i++; loadBatchAsset(); } else $('dlgInsp').close();
  });
  function openBatch(siteId, freq) {
    return loadAllInsp().then(function (docs) {
      var items = C.dueList({ assets: getAssets().filter(function (a) { return a.site === siteId; }), plans: getPlans(), settings: getSettings(),
        done: C.doneIndex(docs), today: today(), ahead: 0 }).filter(function (x) { return x.plan.freq === freq && x.state !== 'upcoming'; });
      if (!items.length) { toast('ไม่มีอุปกรณ์ที่ครบรอบ', 'err'); return; }
      var per = items.map(function (x) { return x.period; }).sort()[0];
      var ids = items.filter(function (x) { return x.period === per; }).map(function (x) { return x.asset.id; });
      return openInsp(ids[0], freq, per, { assets: ids, i: 0, freq: freq, period: per });
    });
  }

  /* ── ส่วนในมุมมองอุปกรณ์: รอบที่ครบ/ค้าง + ผลตรวจล่าสุด ── */
  viewSections.push(function (a) {
    var plans = getPlans(), freqs = planFreqsOf(a, plans), settings = getSettings();
    if (!freqs.length) return '';
    return loadAllInsp().then(function (docs) {
      var done = C.doneIndex(docs), t = today();
      var rows = freqs.map(function (f) {
        var plan = planOf(a.type, f, plans), opts = periodOptions(a, plan, settings, done), per = defaultPeriod(opts, f);
        var st = C.status(a, plan, per, done, t);
        return '<div class="list-row"><div class="grow"><div class="title">' + esc(C.FREQ_LABEL[f]) + '</div><div class="meta">' + esc(periodLabel(f, per)) + '</div></div>' +
          '<div class="end"><span class="badge ' + (STATE_BADGE[st] || '') + '">' + STATE_LABEL[st] + '</span>' +
          '<button class="btn sm primary" type="button" data-act="insp" data-freq="' + f + '" data-period="' + esc(per) + '">' + icon('clipboard-check') + 'ตรวจเช็ก</button></div></div>';
      }).join('');
      var hist = [];
      docs.forEach(function (d) { if (d.rows && d.rows[a.id]) hist.push({ d: d, r: d.rows[a.id] }); });
      hist.sort(function (x, y) { return y.r.at - x.r.at; });
      var hh = hist.slice(0, 10).map(function (h) {
        var ng = Object.keys(h.r.res || {}).filter(function (k) { return h.r.res[k] === 'ng'; }).length;
        return '<div class="list-row"><div class="grow"><div class="title">' + esc(C.FREQ_LABEL[h.d.freq]) + ' · ' + esc(periodLabel(h.d.freq, h.d.period)) + '</div>' +
          '<div class="meta">' + esc(new Date(h.r.at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })) + (h.d.by ? ' · ' + esc(h.d.by) : '') + '</div></div>' +
          '<div class="end">' + (ng ? '<span class="badge err">ไม่ผ่าน ' + ng + '</span>' : '<span class="badge ok">ผ่าน</span>') + '</div></div>';
      }).join('');
      return '<section class="card" data-sec="insp"><div class="card-head"><h2>ตรวจเช็ก</h2></div><div class="list">' + rows + '</div></section>' +
        (hh ? '<section class="card" data-sec="hist"><div class="card-head"><h2>ผลตรวจล่าสุด</h2></div><div class="list">' + hh + '</div></section>' : '');
    });
  });
  renderers.viewAction = function (act, b, a) {
    if (act === 'insp' && a) openInsp(a.id, b.getAttribute('data-freq'), b.getAttribute('data-period'));
  };
  window.addEventListener('load', function () { flushOutbox(); updatePending(); });

  /* ══════════ แท็บปฏิทิน PM + compliance ══════════ */
  TABS.push({ id: 'calendar', label: 'ปฏิทิน PM', icon: 'calendar-clock' });
  var calMonth = today().slice(0, 7);
  var calToken = 0;

  function stateBadge(st, daysLate) {
    return '<span class="badge ' + (STATE_BADGE[st] || '') + '">' + STATE_LABEL[st] + (st === 'overdue' && daysLate ? ' ' + num(daysLate) + ' วัน' : '') + '</span>';
  }
  function calRow(x, sn) {
    var meta = [C.FREQ_LABEL[x.plan.freq], periodLabel(x.plan.freq, x.period)].filter(Boolean).join(' · ');
    return '<div class="list-row" data-aid="' + esc(x.asset.id) + '" data-freq="' + x.plan.freq + '" data-period="' + esc(x.period) + '">' +
      '<div class="grow"><div class="title">' + esc(x.asset.code) + ' · ' + esc(x.asset.name) + '</div><div class="meta">' + esc(meta) + '</div></div>' +
      '<div class="end">' + stateBadge(x.state, x.daysLate) + '</div></div>';
  }
  function calGroup(title, items, sites, open, badgeCls) {
    if (!items.length) return '';
    var bySite = {}, order = [];
    items.forEach(function (x) { if (!bySite[x.asset.site]) { bySite[x.asset.site] = []; order.push(x.asset.site); } bySite[x.asset.site].push(x); });
    order.sort(function (a, b) { return siteName(a, sites) < siteName(b, sites) ? -1 : 1; });
    return '<section class="card" data-group="' + esc(title) + '"><div class="card-head"><h2>' + esc(title) + '</h2><span class="badge ' + (badgeCls || '') + '">' + num(items.length) + '</span></div>' +
      order.map(function (sid) {
        var list = bySite[sid];
        return '<details class="disclosure"' + (open && list.length <= 20 ? ' open' : '') + ' style="margin-top:8px"><summary>' + esc(siteName(sid, sites) || '—') + ' <span class="badge">' + num(list.length) + '</span></summary>' +
          '<div class="disclosure-body"><div class="list">' + list.map(calRow).join('') + '</div></div></details>';
      }).join('') + '</section>';
  }
  function monthItems(assets, plans, settings, done, month) {
    var from = month + '-01', to = C.ymd(new Date(+month.slice(0, 4), +month.slice(5, 7), 0)), t = today(), out = [], byType = {};
    plans.forEach(function (p) { (byType[p.type] = byType[p.type] || []).push(p); });
    assets.forEach(function (a) {
      if (a.status === 'retired') return;
      (byType[a.type] || []).forEach(function (plan) {
        if (plan.freq === 'Daily' || plan.freq === 'Weekly') return; // รายวัน/สัปดาห์: ดูที่กลุ่ม "ถึงกำหนด"
        C.periods(a, plan, settings, from, to).forEach(function (p) {
          var st = C.status(a, plan, p, done, t);
          out.push({ asset: a, plan: plan, period: p, window: C.window(plan.freq, p), state: st, daysLate: st === 'overdue' ? C.daysBetween(C.window(plan.freq, p).end, t) : 0 });
        });
      });
    });
    out.sort(function (x, y) { return x.asset.code < y.asset.code ? -1 : x.asset.code > y.asset.code ? 1 : C.FREQS.indexOf(x.plan.freq) - C.FREQS.indexOf(y.plan.freq); });
    return out;
  }
  function pct(n, d) { return d ? Math.round(n * 1000 / d) / 10 + '%' : '—'; }

  function renderCalendar() {
    var token = ++calToken;
    var assets = getAssets(), plans = getPlans(), settings = getSettings(), sites = getSites();
    $('cMonth').value = calMonth;
    var freqs = C.FREQS.filter(function (f) { return plans.some(function (p) { return p.freq === f; }); });
    var bs = $('cSite').value, bf = $('cFreq').value;
    $('cSite').innerHTML = sites.map(function (s) { return opt(s.id, s.name, s.id === bs); }).join('');
    $('cFreq').innerHTML = freqs.map(function (f) { return opt(f, C.FREQ_LABEL[f], f === bf); }).join('');
    $('cBatch').disabled = !sites.length || !freqs.length;
    if (!assets.length || !plans.length) {
      $('cKpi').innerHTML = '';
      $('cBody').innerHTML = '<div class="empty">' + icon('calendar-clock') + '<p class="empty-title">' + (assets.length ? 'ยังไม่มีแผน PM' : 'ยังไม่มีอุปกรณ์') + '</p></div>';
      $('cCompBody').innerHTML = '';
      return;
    }
    loadAllInsp().then(function (docs) {
      if (token !== calToken) return;
      var done = C.doneIndex(docs), t = today();
      var due = C.dueList({ assets: assets, plans: plans, settings: settings, done: done, today: t, ahead: 7 });
      var g = { overdue: [], due: [], upcoming: [] };
      due.forEach(function (x) { g[x.state].push(x); });
      var mi = monthItems(assets, plans, settings, done, calMonth);
      var yr = C.addMonths(t.slice(0, 7), -11) + '-01';
      var comp = C.compliance({ assets: assets, plans: plans, settings: settings, done: done, from: yr, to: C.ymd(new Date(+t.slice(0, 4), +t.slice(5, 7), 0)), today: t }); // นับตามเดือนที่ช่วงรอบจบ → ถึงสิ้นเดือนนี้
      var tot = comp.reduce(function (a, c) { a.due += c.due; a.onTime += c.onTime; a.late += c.late; a.missed += c.missed; return a; }, { due: 0, onTime: 0, late: 0, missed: 0 });
      $('cKpi').innerHTML =
        '<div class="kpi"><div class="kpi-label">ตรงเวลา 12 เดือน</div><div class="kpi-value" data-k="ontime">' + pct(tot.onTime, tot.due) + '</div></div>' +
        '<div class="kpi"><div class="kpi-label">ทำช้า</div><div class="kpi-value" data-k="late">' + pct(tot.late, tot.due) + '</div></div>' +
        '<div class="kpi"><div class="kpi-label">พลาด</div><div class="kpi-value dn" data-k="missed">' + pct(tot.missed, tot.due) + '</div></div>' +
        '<div class="kpi"><div class="kpi-label">รอบที่ครบกำหนด</div><div class="kpi-value" data-k="due">' + num(tot.due) + '</div></div>';
      $('cBody').innerHTML = calGroup('เลยกำหนด', g.overdue, sites, true, 'err') + calGroup('ถึงกำหนด', g.due, sites, true, 'accent') +
        calGroup('ภายใน 7 วัน', g.upcoming, sites, false, '') + calGroup('ทั้งเดือน', mi, sites, false, '') ||
        '<div class="empty">' + icon('circle-check') + '<p class="empty-title">ไม่มีงานค้าง</p></div>';
      // compliance รายเดือน (รวมทุกสถานที่/ความถี่)
      var byM = {};
      comp.forEach(function (c) { var m = byM[c.month] || (byM[c.month] = { due: 0, onTime: 0, late: 0, missed: 0 }); m.due += c.due; m.onTime += c.onTime; m.late += c.late; m.missed += c.missed; });
      $('cCompBody').innerHTML = Object.keys(byM).length
        ? '<div class="table-wrap"><table class="table right"><thead><tr><th>เดือน</th><th>ครบกำหนด</th><th>ตรงเวลา</th><th>ช้า</th><th>พลาด</th></tr></thead><tbody>' +
          Object.keys(byM).sort().map(function (m) {
            var x = byM[m];
            return '<tr><td>' + esc(periodLabel('M1', m)) + '</td><td>' + num(x.due) + '</td><td>' + num(x.onTime) + ' (' + pct(x.onTime, x.due) + ')</td><td>' + num(x.late) + '</td><td>' + num(x.missed) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="empty"><p>ยังไม่มีรอบที่ครบกำหนด</p></div>';
    });
  }
  renderers.calendar = renderCalendar;
  $('cMonth').addEventListener('change', function () { if (this.value) { calMonth = this.value; renderCalendar(); } });
  $('cBody').addEventListener('click', function (e) {
    var row = e.target.closest('.list-row[data-aid]');
    if (row) openInsp(row.getAttribute('data-aid'), row.getAttribute('data-freq'), row.getAttribute('data-period'));
  });
  $('cBatch').addEventListener('click', function () { if ($('cSite').value && $('cFreq').value) openBatch($('cSite').value, $('cFreq').value); });

  /* ── ป้ายงานค้างในรายการอุปกรณ์ (เลยกำหนด/ถึงกำหนด + ใบสั่งงานที่เปิดอยู่) ── */
  renderers.afterAssets = function (rows) {
    if (!rows.length) return;
    var token = ++badgeToken;
    Promise.all([loadAllInsp(), renderers.openWoCounts ? renderers.openWoCounts() : Promise.resolve({})]).then(function (r) {
      if (token !== badgeToken) return;
      var due = C.dueList({ assets: rows, plans: getPlans(), settings: getSettings(), done: C.doneIndex(r[0]), today: today(), ahead: 0 }), by = {};
      due.forEach(function (x) { var b = by[x.asset.id] || (by[x.asset.id] = { overdue: 0, due: 0 }); if (x.state === 'overdue') b.overdue++; else if (x.state === 'due') b.due++; });
      rows.forEach(function (a) {
        var el = document.querySelector('[data-badge="' + cssId(a.id) + '"]');
        if (!el) return;
        var b = by[a.id] || { overdue: 0, due: 0 }, wo = r[1][a.id] || 0, parts = [];
        if (b.overdue) parts.push('<span class="badge err">เลยกำหนด ' + b.overdue + '</span>');
        if (b.due) parts.push('<span class="badge accent">ถึงกำหนด ' + b.due + '</span>');
        if (wo) parts.push('<span class="badge warn">ใบงาน ' + wo + '</span>');
        if (parts.length) el.outerHTML = '<span data-badge="' + esc(a.id) + '" style="display:contents">' + parts.join('') + '</span>';
      });
    });
  };
  var badgeToken = 0;

  /* ── เริ่มต้น ── */
  function setOffline() { $('offBadge').hidden = navigator.onLine !== false; }
  window.addEventListener('online', setOffline);
  window.addEventListener('offline', setOffline);
  setOffline();
  deviceId();

  function refresh() { if (!anyDialogOpen()) renderCurrent(); }
  if (TD && TD.onChange) TD.onChange(refresh);
  window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf('tanot:mnt:') === 0) refresh(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refresh(); });

  renderTabs();
  showTab(ui.tab);
  route();

  window.__mnt = { // ให้เทสต์ใช้ (ไม่ใช่ API ของหน้า)
    deviceId: deviceId, idbAll: idbAll, idbGet: idbGet, idbPut: idbPut, idbDelete: idbDelete, openDb: openDb, readList: readList, upsert: upsert,
    getSettings: getSettings, saveSettings: saveSettings, K: K, openInsp: openInsp, openBatch: openBatch, flushOutbox: flushOutbox, updatePending: updatePending
  };
})();
