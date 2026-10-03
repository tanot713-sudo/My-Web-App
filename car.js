/* ══════════════════════════════════════════════════════════════════
   Tanot — บันทึกรถ (car.html) · ส่วนแสดงผล
   ตรรกะ (กำหนดต่ออายุ/กฎ ตรอ./นัดเข้าศูนย์/การแจ้งเตือน/แถว budget) อยู่ใน car-calc.js (window.CarCalc) — ไฟล์นี้อ่าน/เขียน storage + วาดหน้า
   ข้อมูล: localStorage['tanot:car:vehicles'] · ['tanot:car:services'] (sync list idField id — รูปแบบอธิบายที่หัว car-calc.js)
   กรมธรรม์รถ: อ่านอย่างเดียวจาก 'tanot:insurance:policies' (ห้ามเขียน)
   ไฟล์ (เล่มทะเบียน/ใบเสร็จ): R2 ผ่าน /api/files?ns=car (เฉพาะ *.pages.dev) — ในรถเก็บแค่ { id, name, size, mime }
   ส่งเข้า budget: เพิ่มแถว { id:'car-<รหัสรายการ>', date, type:'expense', categoryId, amount, note } ใน budget:records ผ่าน TanotData.update
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  window.TANOT_NO_RELOAD_BAR = true; // วาดใหม่เองเมื่อ TanotData.onChange — ห้ามรีเซ็ตช่องในฟอร์มที่กำลังกรอก

  var C = window.CarCalc;
  var TD = window.TanotData;
  var VKEY = 'tanot:car:vehicles', SKEY = 'tanot:car:services', PKEY = 'tanot:insurance:policies';
  var REC_KEY = 'budget:records', CAT_KEY = 'budget:categories';
  var MAX_FILE = 15 * 1024 * 1024;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function num(n, d) { return (Number(n) || 0).toLocaleString('th-TH', { maximumFractionDigits: d == null ? 0 : d }); }
  function baht(n) { return '฿' + num(n, n % 1 ? 2 : 0); }
  function dateTh(s) { var d = C.parseDate(s); return d ? C.thDate(d) : ''; }
  function filesAvailable() { return /\.pages\.dev$/.test(location.hostname) || !!(window.TANOT_FILES && window.TANOT_FILES.enabled); }
  function newId(p) {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function closeDlg(d) { if (d.close) d.close(); else d.removeAttribute('open'); }
  function openDlg(d) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }

  /* ── storage: อ่านสดจาก localStorage ทุกครั้ง (หลายแท็บ/เครื่อง) · เขียนด้วย getItem → แก้ → setItem เพื่อให้ tanot-data รู้ว่าหน้านี้เห็นแถวจากอีกเครื่องแล้ว ── */
  function load(key) {
    var v = TD && TD.read ? TD.read(key, []) : null;
    if (v == null) { try { v = JSON.parse(localStorage.getItem(key)); } catch (e) { v = null; } }
    return Array.isArray(v) ? v.filter(function (x) { return x && typeof x === 'object' && x.id; }) : [];
  }
  function mutate(key, fn) {
    var cur = null;
    try { cur = JSON.parse(localStorage.getItem(key)); } catch (e) {}
    var next = fn(Array.isArray(cur) ? cur : []);
    if (next !== undefined) localStorage.setItem(key, JSON.stringify(next));
    return next;
  }
  function upsert(key, rec) {
    mutate(key, function (list) {
      var i = list.findIndex(function (x) { return x && x.id === rec.id; });
      if (i === -1) list.push(rec); else list[i] = rec;
      return list;
    });
  }
  function removeWhere(key, pred) {
    mutate(key, function (list) { return list.filter(function (x) { return x && !pred(x); }); });
  }
  function upd(k, fn) { // ไม่ถือคีย์ (budget:records)
    if (TD && TD.update) return TD.update(k, fn);
    var cur = null;
    try { cur = JSON.parse(localStorage.getItem(k)); } catch (e) {}
    var next = fn(cur);
    if (next !== undefined) localStorage.setItem(k, JSON.stringify(next));
    return next;
  }
  function policies() { return TD && TD.read ? TD.read(PKEY, []) || [] : []; }
  function budgetCats() {
    var c = TD && TD.read ? TD.read(CAT_KEY, null) : null;
    var list = Array.isArray(c) ? c.filter(function (x) { return x && x.type === 'expense'; }) : [];
    return list.length ? list : C.FALLBACK_CATS;
  }

  /* ── ไฟล์ R2 ── */
  function api(method, qs, opts) { return fetch('/api/files?' + qs, Object.assign({ method: method, credentials: 'same-origin' }, opts || {})); }
  function deleteRemote(ids) { return Promise.all(ids.map(function (id) { return api('DELETE', 'id=' + encodeURIComponent(id)).catch(function () {}); })); }
  var MIME_BY_EXT = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif' };
  function mimeOf(f) {
    if (f.type) return f.type;
    var m = /\.([a-z0-9]+)$/i.exec(f.name || '');
    return (m && MIME_BY_EXT[m[1].toLowerCase()]) || '';
  }
  function uploadOne(f, ref) {
    var mime = mimeOf(f);
    if (!mime) return Promise.reject(new Error('รองรับเฉพาะ PDF และรูปภาพ'));
    if (f.size > MAX_FILE) return Promise.reject(new Error(f.name + ' ใหญ่เกิน 15 MB'));
    return api('POST', 'ns=car&ref=' + encodeURIComponent(ref) + '&name=' + encodeURIComponent(f.name), { headers: { 'Content-Type': mime }, body: f })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.error || 'อัปโหลดไม่สำเร็จ (' + r.status + ')');
          return j;
        });
      });
  }

  /* ── วาดหน้า ── */
  function dueBadge(days, now) {
    if (days === null) return '';
    if (days < 0) return '<span class="badge err">เลยกำหนด ' + num(-days) + ' วัน</span>';
    if (days === 0) return '<span class="badge warn">วันนี้</span>';
    if (days <= 30) return '<span class="badge warn">อีก ' + num(days) + ' วัน</span>';
    if (days <= 60) return '<span class="badge info">อีก ' + num(days) + ' วัน</span>';
    return '';
  }
  function renderKpis(vehicles, services, now) {
    var y = now.getFullYear();
    var due = C.dueList(vehicles, services, policies(), now, 60).length;
    var spent = services.reduce(function (s, x) { return s + ((x.date || '').slice(0, 4) === String(y) ? (Number(x.cost) || 0) : 0); }, 0);
    function k(label, value, unit) { return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value">' + value + (unit ? '<small>' + unit + '</small>' : '') + '</div></div>'; }
    $('kpis').innerHTML = k('รถ', num(vehicles.length), 'คัน') + k('ถึงกำหนดใน 60 วัน', num(due), 'รายการ') + k('ค่าบำรุงรักษาปีนี้', baht(spent));
  }

  function deadlineRows(v, pols, now) {
    var rows = C.deadlines(v, pols, now).map(function (d) {
      var days = C.daysUntil(d.date, now);
      var link = d.linked ? '<a class="btn sm ghost" href="insurance.html" data-b="ins-link">' + icon('shield') + 'กรมธรรม์</a>' : '';
      return '<div class="list-row" data-kind="' + d.kind + '"><span class="lead">' + icon(d.kind === 'insurance' ? 'shield' : d.kind === 'inspect' ? 'wrench' : 'file-text') + '</span>' +
        '<div class="grow"><div class="title">' + esc(d.label) + '</div><div class="meta">' + esc(dateTh(d.date)) + '</div></div>' +
        '<div class="end">' + dueBadge(days, now) + link + '</div></div>';
    });
    if (C.inspectRequired(v, v.taxDue || C.ymd(now)) && !C.inspectOk(v)) {
      rows.push('<div class="list-row" data-kind="inspect-need"><span class="lead">' + icon('wrench') + '</span>' +
        '<div class="grow"><div class="title">ต้องตรวจสภาพ (ตรอ.) ก่อนต่อภาษี</div><div class="meta">รถอายุเกิน ' + C.INSPECT_AFTER_YEARS + ' ปี' + (v.inspectDue ? ' · ใบตรวจหมดก่อนวันครบกำหนดภาษี' : ' · ยังไม่มีใบตรวจ') + '</div></div>' +
        '<div class="end"><span class="badge warn">ต้องตรวจ</span></div></div>');
    }
    return rows.join('');
  }
  function serviceBlock(v, services, now) {
    var mine = C.vehicleServices(services, v.id).sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    var n = C.nextService(v, services, now), html = '';
    if (n) {
      var parts = [];
      if (n.nextKm) parts.push('ที่ ' + num(n.nextKm) + ' กม.' + (n.kmLeft !== null ? (n.kmLeft > 0 ? ' (อีก ' + num(n.kmLeft) + ' กม.)' : ' (ถึงแล้ว)') : ''));
      if (n.nextDate) parts.push(dateTh(n.nextDate));
      var badge = n.state === 'overdue' ? '<span class="badge err">ถึงกำหนด' + (n.due === 'km' ? 'ตามไมล์' : 'ตามวันที่') + '</span>'
        : n.state === 'soon' ? '<span class="badge warn">ใกล้ถึง</span>' : '';
      html += '<div class="list" data-b="next-service"><div class="list-row"><span class="lead">' + icon('wrench') + '</span>' +
        '<div class="grow"><div class="title">นัดเข้าศูนย์ครั้งถัดไป</div><div class="meta">' + esc(parts.join(' · ')) + '</div></div><div class="end">' + badge + '</div></div></div>';
    }
    html += '<div class="car-sub">ประวัติเข้าศูนย์/ซ่อมบำรุง</div>';
    if (!mine.length) return html + '<div class="empty"><p>ยังไม่มีประวัติ</p></div>';
    return html + '<div class="list car-svc">' + mine.slice(0, 8).map(function (s) {
      var first = String(s.items || '').split(/\r?\n/)[0] || 'เข้าศูนย์/ซ่อมบำรุง';
      var meta = [dateTh(s.date), s.odometer ? num(s.odometer) + ' กม.' : ''].filter(Boolean).join(' · ');
      return '<div class="list-row" data-sid="' + esc(s.id) + '"><span class="lead">' + icon('wrench') + '</span>' +
        '<div class="grow"><div class="title">' + esc(first) + '</div><div class="meta">' + esc(meta) + '</div></div>' +
        '<div class="end">' + (s.cost ? '<span class="prem">' + baht(s.cost) + '</span>' : '') +
        (s.budgetId ? '<span class="badge ok" data-b="budget">' + icon('check') + 'ส่งเข้า budget</span>' : '') +
        '<button class="btn sm icon" type="button" data-act="edit-svc" aria-label="แก้ไข">' + icon('pencil') + '</button></div></div>';
    }).join('') + '</div>';
  }
  function renderVehicles(vehicles, services, now) {
    if (!vehicles.length) { $('vehicles').innerHTML = '<section class="card"><div class="empty">' + icon('car') + '<p>ยังไม่มีรถ</p></div></section>'; return; }
    var pols = policies();
    $('vehicles').innerHTML = vehicles.map(function (v) {
      var meta = [[v.make, v.model].filter(Boolean).join(' '), v.year ? 'ปี ' + v.year : '', C.currentOdometer(v, services) ? num(C.currentOdometer(v, services)) + ' กม.' : ''].filter(Boolean).join(' · ');
      var nFiles = Array.isArray(v.files) ? v.files.length : 0;
      var dl = deadlineRows(v, pols, now);
      return '<section class="card car-vehicle" data-vid="' + esc(v.id) + '">' +
        '<div class="car-vhead"><span class="lead">' + icon('car') + '</span>' +
        '<div class="grow"><div class="title">' + esc(C.title(v)) + '</div><div class="meta">' + esc(meta) + '</div></div>' +
        '<div class="end">' + (nFiles ? '<span class="badge" title="ไฟล์แนบ">' + icon('file-text') + nFiles + '</span>' : '') +
        '<button class="btn sm" type="button" data-act="add-svc">' + icon('plus') + 'เข้าศูนย์</button>' +
        '<button class="btn sm icon" type="button" data-act="edit-car" aria-label="แก้ไข">' + icon('pencil') + '</button></div></div>' +
        (dl ? '<div class="car-dl list">' + dl + '</div>' : '') +
        serviceBlock(v, services, now) + '</section>';
    }).join('');
  }
  function renderAll() {
    var vehicles = load(VKEY), services = load(SKEY), now = new Date();
    // กำหนดต่ออายุ/นัดเข้าศูนย์ → การแจ้งเตือน (tanot-push.js ส่งเฉพาะเมื่อชุดเปลี่ยน · ทำงานเฉพาะ pages.dev)
    if (window.TanotPush) window.TanotPush.setReminders('car', C.reminders(vehicles, services, policies(), now));
    renderKpis(vehicles, services, now);
    renderVehicles(vehicles, services, now);
  }

  /* ── กล่องรถ ── */
  var vdlg = $('vdlg'), V = null; // V = { rec, isNew, added: [], removed: [] }
  function renderVFiles() {
    var files = (V && V.rec.files) || [];
    $('vFilesRow').hidden = !filesAvailable();
    $('vFileList').innerHTML = files.map(function (f) {
      return '<div class="car-file" data-fid="' + esc(f.id) + '">' + icon(/^image\//.test(f.mime) ? 'image' : 'file-text') +
        '<a href="/api/files?id=' + encodeURIComponent(f.id) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' +
        '<span class="sz">' + num(f.size / 1024) + ' KB</span>' +
        '<button class="btn sm icon ghost" type="button" data-rm="' + esc(f.id) + '" aria-label="เอาไฟล์ออก">' + icon('x') + '</button></div>';
    }).join('');
  }
  function openVehicle(v) {
    var isNew = !v;
    var rec = v ? JSON.parse(JSON.stringify(v)) : { id: newId('c'), files: [] };
    if (!Array.isArray(rec.files)) rec.files = [];
    V = { rec: rec, isNew: isNew, added: [], removed: [] };
    $('vTitle').textContent = isNew ? 'เพิ่มรถ' : 'แก้ไขรถ';
    $('vPlate').value = rec.plate || '';
    $('vProv').value = rec.province || '';
    $('vMake').value = rec.make || '';
    $('vModel').value = rec.model || '';
    $('vYear').value = rec.year || '';
    $('vOdo').value = rec.odometer || '';
    $('vOdoAt').value = rec.odometerAt || '';
    $('vAct').value = rec.actDue || '';
    $('vTax').value = rec.taxDue || '';
    $('vIns').value = rec.insuranceDue || '';
    $('vInspect').value = rec.inspectDue || '';
    $('vNote').value = rec.note || '';
    var cars = C.carPolicies(policies());
    $('vPolRow').hidden = !cars.length;
    $('vPol').innerHTML = '<option value="">ไม่เชื่อม</option>' + cars.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc([p.insurer, p.name, p.insured].filter(Boolean).join(' · ') || 'กรมธรรม์รถ') + '</option>';
    }).join('');
    $('vPol').value = rec.insurancePolicyId && cars.some(function (p) { return p.id === rec.insurancePolicyId; }) ? rec.insurancePolicyId : '';
    $('vDel').hidden = isNew;
    $('vMsg').textContent = '';
    renderVFiles();
    openDlg(vdlg);
  }
  function readVehicle() {
    var r = V.rec, n;
    r.plate = $('vPlate').value.trim();
    r.province = $('vProv').value.trim();
    r.make = $('vMake').value.trim();
    r.model = $('vModel').value.trim();
    n = Math.round(Number($('vYear').value)); r.year = n >= 1950 && n <= 2100 ? n : 0;
    n = Number($('vOdo').value); r.odometer = n > 0 ? n : 0;
    r.odometerAt = $('vOdoAt').value || (r.odometer ? C.ymd(new Date()) : '');
    r.actDue = $('vAct').value;
    r.taxDue = $('vTax').value;
    r.insuranceDue = $('vIns').value;
    r.insurancePolicyId = $('vPol').value;
    r.inspectDue = $('vInspect').value;
    r.note = $('vNote').value.trim();
    return r;
  }
  $('vAttach').addEventListener('click', function () { $('vFileInput').click(); });
  $('vFileInput').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files || []), st = V;
    this.value = '';
    if (!files.length || !st) return;
    $('vMsg').textContent = '';
    $('vAttach').disabled = true;
    files.reduce(function (chain, f) {
      return chain.then(function () {
        return uploadOne(f, st.rec.id).then(function (j) {
          if (V !== st) { deleteRemote([j.id]); return; }
          st.rec.files.push({ id: j.id, name: j.name, size: j.size, mime: j.mime });
          st.added.push(j.id);
          renderVFiles();
        }).catch(function (e) { if (V === st) $('vMsg').textContent = e.message || 'อัปโหลดไม่สำเร็จ'; });
      });
    }, Promise.resolve()).then(function () { $('vAttach').disabled = false; });
  });
  $('vFileList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]');
    if (!b || !V) return;
    var id = b.getAttribute('data-rm');
    V.rec.files = V.rec.files.filter(function (f) { return f.id !== id; });
    if (V.added.indexOf(id) !== -1) { V.added = V.added.filter(function (x) { return x !== id; }); deleteRemote([id]); }
    else V.removed.push(id);
    renderVFiles();
  });
  $('vform').addEventListener('submit', function (e) {
    e.preventDefault();
    var r = readVehicle();
    if (!r.plate && !r.make && !r.model) { $('vMsg').textContent = 'ใส่ทะเบียนหรือยี่ห้อ/รุ่นอย่างน้อยหนึ่งช่อง'; return; }
    upsert(VKEY, r);
    var gone = V.removed; V.removed = []; V.added = [];
    closeDlg(vdlg);
    deleteRemote(gone);
    renderAll();
  });
  $('vCancel').addEventListener('click', function () { closeDlg(vdlg); });
  vdlg.addEventListener('close', function () {
    // ปิดโดยไม่บันทึก — ไฟล์ที่เพิ่งอัปโหลดในกล่องนี้ไม่มีใครอ้างถึง ลบทิ้งจาก R2
    if (V && V.added.length) deleteRemote(V.added);
    V = null;
  });
  $('vDel').addEventListener('click', function () {
    var st = V;
    if (!st) return;
    window.tanotConfirm('ลบรถคันนี้ ประวัติเข้าศูนย์ และไฟล์แนบทั้งหมด? (รายการใน budget ที่สร้างแล้วจะไม่ถูกลบ)', { danger: true, okLabel: 'ลบ' }).then(function (ok) {
      if (!ok || V !== st) return;
      var id = st.rec.id;
      var orig = load(VKEY).filter(function (x) { return x.id === id; })[0];
      var ids = ((orig && orig.files) || []).map(function (f) { return f.id; }).concat(st.added);
      st.added = [];
      removeWhere(SKEY, function (s) { return s.vehicleId === id; });
      removeWhere(VKEY, function (x) { return x.id === id; });
      closeDlg(vdlg);
      deleteRemote(ids);
      renderAll();
    });
  });

  /* ── กล่องเข้าศูนย์/ซ่อมบำรุง ── */
  var sdlg = $('sdlg'), S = null; // S = { rec, isNew, vehicle, busy }
  function updateBudgetBtn() {
    var b = $('sBudget'), done = !!(S && S.rec.budgetId);
    b.disabled = done;
    b.innerHTML = done ? icon('check') + 'ส่งเข้า budget แล้ว' : 'บันทึกเป็นรายจ่าย';
  }
  function openService(vehicleId, s) {
    var v = load(VKEY).filter(function (x) { return x.id === vehicleId; })[0];
    if (!v) return;
    var isNew = !s;
    var rec = s ? JSON.parse(JSON.stringify(s)) : { id: newId('s'), vehicleId: vehicleId, date: C.ymd(new Date()) };
    S = { rec: rec, isNew: isNew, vehicle: v, busy: false };
    $('sTitle').textContent = (isNew ? 'เพิ่มเข้าศูนย์ · ' : 'แก้ไขเข้าศูนย์ · ') + C.title(v);
    $('sDate').value = rec.date || '';
    $('sOdo').value = rec.odometer || (isNew ? C.currentOdometer(v, load(SKEY)) || '' : '');
    $('sItems').value = rec.items || '';
    $('sCost').value = rec.cost || '';
    $('sNextKm').value = rec.nextKm || '';
    $('sNextDate').value = rec.nextDate || '';
    var cats = budgetCats();
    $('sCat').innerHTML = cats.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('');
    $('sCat').value = rec.categoryId && cats.some(function (c) { return c.id === rec.categoryId; }) ? rec.categoryId : C.defaultCategory(cats);
    $('sDel').hidden = isNew;
    $('sMsg').textContent = '';
    updateBudgetBtn();
    openDlg(sdlg);
  }
  function readService() {
    var r = S.rec, n;
    r.date = $('sDate').value || r.date || C.ymd(new Date());
    n = Number($('sOdo').value); r.odometer = n > 0 ? n : 0;
    r.items = $('sItems').value.trim();
    n = Number($('sCost').value); r.cost = n > 0 ? n : 0;
    n = Number($('sNextKm').value); r.nextKm = n > 0 ? n : 0;
    r.nextDate = $('sNextDate').value;
    r.categoryId = $('sCat').value;
    return r;
  }
  function validateService(r) {
    if (!r.items && !r.cost) return 'ใส่รายการหรือค่าใช้จ่ายอย่างน้อยหนึ่งช่อง';
    if (r.nextDate && r.nextDate < r.date) return 'วันนัดถัดไปต้องไม่ก่อนวันที่เข้าศูนย์';
    if (r.nextKm && r.odometer && r.nextKm <= r.odometer) return 'เลขไมล์นัดถัดไปต้องมากกว่าเลขไมล์ตอนนี้';
    return '';
  }
  function saveService(r) {
    upsert(SKEY, r);
    // เลขไมล์ใหม่กว่าที่บันทึกในรถ → อัปเดตรถ (อ่านสด → แก้ → เขียน)
    if (r.odometer) {
      var cur = load(VKEY).filter(function (x) { return x.id === r.vehicleId; })[0];
      if (cur && r.odometer > (Number(cur.odometer) || 0)) { cur.odometer = r.odometer; cur.odometerAt = r.date; upsert(VKEY, cur); }
    }
  }
  $('sform').addEventListener('submit', function (e) {
    e.preventDefault();
    var r = readService(), bad = validateService(r);
    if (bad) { $('sMsg').textContent = bad; return; }
    var cur = load(SKEY).filter(function (x) { return x.id === r.id; })[0];
    if (cur && cur.budgetId && !r.budgetId) r.budgetId = cur.budgetId; // อีกเครื่องอาจส่งเข้า budget ไปแล้ว
    saveService(r);
    closeDlg(sdlg);
    renderAll();
  });
  $('sBudget').addEventListener('click', function () {
    if (!S || S.busy) return;
    var r = readService(), bad = validateService(r);
    if (!(r.cost > 0)) bad = bad || 'ใส่ค่าใช้จ่ายก่อนบันทึกเป็นรายจ่าย';
    if (bad) { $('sMsg').textContent = bad; return; }
    S.busy = true;
    var cur = load(SKEY).filter(function (x) { return x.id === r.id; })[0];
    var bid = (cur && cur.budgetId) || r.budgetId || C.budgetId(r.id); // id ตายตัวต่อรายการ — กดซ้ำ/2 เครื่องได้แถวเดียว
    r.budgetId = bid;
    var rec = C.budgetRecord(r, S.vehicle, r.categoryId);
    rec.id = bid;
    upd(REC_KEY, function (list) {
      list = Array.isArray(list) ? list : [];
      if (list.some(function (x) { return x && x.id === bid; })) return undefined;
      list.push(rec);
      return list;
    });
    saveService(r);
    S.busy = false;
    closeDlg(sdlg);
    renderAll();
  });
  $('sCancel').addEventListener('click', function () { closeDlg(sdlg); });
  sdlg.addEventListener('close', function () { S = null; });
  $('sDel').addEventListener('click', function () {
    var st = S;
    if (!st || st.busy) return;
    window.tanotConfirm('ลบรายการนี้? (รายการใน budget ที่สร้างแล้วจะไม่ถูกลบ)', { danger: true, okLabel: 'ลบ' }).then(function (ok) {
      if (!ok || S !== st) return;
      removeWhere(SKEY, function (x) { return x.id === st.rec.id; });
      closeDlg(sdlg);
      renderAll();
    });
  });

  /* ── ปุ่มในหน้า ── */
  $('addBtn').addEventListener('click', function () { openVehicle(null); });
  $('vehicles').addEventListener('click', function (e) {
    var card = e.target.closest('[data-vid]');
    if (!card) return;
    var vid = card.getAttribute('data-vid');
    var b = e.target.closest('[data-act]');
    if (b) {
      var act = b.getAttribute('data-act');
      if (act === 'edit-car') openVehicle(load(VKEY).filter(function (x) { return x.id === vid; })[0]);
      else if (act === 'add-svc') openService(vid, null);
      else if (act === 'edit-svc') {
        var sid = e.target.closest('[data-sid]').getAttribute('data-sid');
        openService(vid, load(SKEY).filter(function (x) { return x.id === sid; })[0]);
      }
    }
  });

  renderAll();
  if (TD && TD.onChange) TD.onChange(function () { if (!vdlg.open && !sdlg.open) renderAll(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !vdlg.open && !sdlg.open) renderAll(); });
})();
