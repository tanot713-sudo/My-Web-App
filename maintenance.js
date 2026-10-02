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
    return { tab: v.tab || 'assets', site: v.site || '', system: v.system || '', type: v.type || '', status: v.status || 'active', q: '' };
  })();
  function saveUi() {
    try { localStorage.setItem(K.ui, JSON.stringify({ tab: ui.tab, site: ui.site, system: ui.system, type: ui.type, status: ui.status })); } catch (e) {}
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
    getSettings: getSettings, saveSettings: saveSettings, K: K
  };
})();
