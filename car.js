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

  /* ── ข้อความ UI สองภาษา (i18n.js) — คีย์ 'car.*' · ป้ายชนิดกำหนด/ประเภทรถของ car-calc.js แปลที่นี่ตามรหัส ── */
  var I18N = window.OME_I18N;
  var TR = I18N ? I18N.scope('car', {
    th: {
      title: 'บันทึกรถ | Tanot', h1: 'บันทึกรถ', addCar: 'เพิ่มรถ', car: 'รถ', type: 'ประเภท', typeCar: 'รถยนต์', typeMoto: 'รถจักรยานยนต์', plate: 'ทะเบียน',
      prov: 'จังหวัด', make: 'ยี่ห้อ', model: 'รุ่น', year: 'ปีจดทะเบียน (ค.ศ.)', odo: 'เลขไมล์ล่าสุด (กม.)', odoAt: 'วันที่อ่านเลขไมล์', act: 'พ.ร.บ. หมดอายุ',
      tax: 'ภาษีรถครบกำหนด', ins: 'ประกันภาคสมัครใจ หมดอายุ', pol: 'กรมธรรม์ในหน้าประกัน', inspect: 'ใบตรวจสภาพ (ตรอ.) หมดอายุ', note: 'บันทึก', regBook: 'เล่มทะเบียน / ใบเสร็จ',
      attach: 'แนบไฟล์', del: 'ลบ', cancel: 'ยกเลิก', save: 'บันทึก', svcTitle: 'เข้าศูนย์ / ซ่อมบำรุง', date: 'วันที่', sOdo: 'เลขไมล์ (กม.)', items: 'รายการ',
      cost: 'ค่าใช้จ่าย (บาท)', cat: 'หมวดรายจ่าย', nextKm: 'นัดครั้งถัดไป ที่เลขไมล์', nextDate: 'หรือวันที่', toBudget: 'บันทึกเป็นรายจ่าย', overdue: 'เลยกำหนด {n} วัน',
      today: 'วันนี้', inDays: 'อีก {n} วัน', kCars: 'รถ', unitCars: 'คัน', kDue: 'ถึงกำหนดใน 60 วัน', unitItems: 'รายการ', kSpent: 'ค่าบำรุงรักษาปีนี้', policyLink: 'กรมธรรม์',
      'k.act': 'พ.ร.บ.', 'k.tax': 'ภาษีรถประจำปี', 'k.insurance': 'ประกันภาคสมัครใจ', 'k.inspect': 'ตรวจสภาพ (ตรอ.)', inspectNeed: 'ต้องตรวจสภาพ (ตรอ.) ก่อนต่อภาษี',
      inspectAge: '{type}อายุเกิน {n} ปี', inspectExpired: ' · ใบตรวจหมดก่อนวันครบกำหนดภาษี', inspectNone: ' · ยังไม่มีใบตรวจ', mustInspect: 'ต้องตรวจ', 'vt.car': 'รถยนต์',
      'vt.motorcycle': 'รถจักรยานยนต์', nextSvc: 'นัดเข้าศูนย์ครั้งถัดไป', atKm: 'ที่ {n} กม.', kmLeft: ' (อีก {n} กม.)', reached: ' (ถึงแล้ว)', dueKm: 'ถึงกำหนดตามไมล์',
      dueDate: 'ถึงกำหนดตามวันที่', soon: 'ใกล้ถึง', history: 'ประวัติเข้าศูนย์/ซ่อมบำรุง', noHistory: 'ยังไม่มีประวัติ', svcDefault: 'เข้าศูนย์/ซ่อมบำรุง', km: '{n} กม.',
      sentBudget: 'ส่งเข้า budget', edit: 'แก้ไข', yearOf: 'ปี {y}', svcBtn: 'เข้าศูนย์', attachments: 'ไฟล์แนบ', noCar: 'ยังไม่มีรถ', addCarTitle: 'เพิ่มรถ',
      editCarTitle: 'แก้ไขรถ', polNone: 'ไม่เชื่อม', polDefault: 'กรมธรรม์รถ', needId: 'ใส่ทะเบียนหรือยี่ห้อ/รุ่นอย่างน้อยหนึ่งช่อง', confirmDelCar: 'ลบรถคันนี้ ประวัติเข้าศูนย์ และไฟล์แนบทั้งหมด? (รายการใน budget ที่สร้างแล้วจะไม่ถูกลบ)',
      confirmDelSvc: 'ลบรายการนี้? (รายการใน budget ที่สร้างแล้วจะไม่ถูกลบ)', sentDone: 'ส่งเข้า budget แล้ว', svcAddTitle: 'เพิ่มเข้าศูนย์ · ', svcEditTitle: 'แก้ไขเข้าศูนย์ · ',
      errItems: 'ใส่รายการหรือค่าใช้จ่ายอย่างน้อยหนึ่งช่อง', errNextDate: 'วันนัดถัดไปต้องไม่ก่อนวันที่เข้าศูนย์', errNextKm: 'เลขไมล์นัดถัดไปต้องมากกว่าเลขไมล์ตอนนี้',
      errCost: 'ใส่ค่าใช้จ่ายก่อนบันทึกเป็นรายจ่าย', onlyPdf: 'รองรับเฉพาะ PDF และรูปภาพ', tooBig: '{name} ใหญ่เกิน 15 MB', uploadFail: 'อัปโหลดไม่สำเร็จ', uploadFailCode: 'อัปโหลดไม่สำเร็จ ({s})',
      rmFile: 'เอาไฟล์ออก'
    },
    en: {
      title: 'Car log | Tanot', h1: 'Car log', addCar: 'Add car', car: 'Car', type: 'Type', typeCar: 'Car', typeMoto: 'Motorcycle', plate: 'Licence plate', prov: 'Province',
      make: 'Make', model: 'Model', year: 'Year registered (CE)', odo: 'Latest odometer (km)', odoAt: 'Odometer reading date', act: 'Compulsory insurance (CTPL) expires',
      tax: 'Road tax due', ins: 'Voluntary insurance expires', pol: 'Policy on the Insurance page', inspect: 'Inspection certificate expires', note: 'Note', regBook: 'Registration book / receipts',
      attach: 'Attach file', del: 'Delete', cancel: 'Cancel', save: 'Save', svcTitle: 'Service / maintenance', date: 'Date', sOdo: 'Odometer (km)', items: 'Work done',
      cost: 'Cost (THB)', cat: 'Expense category', nextKm: 'Next service at odometer', nextDate: 'or on date', toBudget: 'Save as expense', overdue: '{n} days overdue',
      today: 'Today', inDays: 'In {n} days', kCars: 'Cars', unitCars: '', kDue: 'Due within 60 days', unitItems: '', kSpent: 'Maintenance cost this year',
      policyLink: 'Policy', 'k.act': 'Compulsory insurance', 'k.tax': 'Annual road tax', 'k.insurance': 'Voluntary insurance', 'k.inspect': 'Vehicle inspection',
      inspectNeed: 'Vehicle inspection needed before renewing road tax', inspectAge: '{type} older than {n} years', inspectExpired: ' · certificate expires before the tax due date',
      inspectNone: ' · no inspection certificate yet', mustInspect: 'Inspection needed', 'vt.car': 'Car', 'vt.motorcycle': 'Motorcycle', nextSvc: 'Next service',
      atKm: 'At {n} km', kmLeft: ' ({n} km to go)', reached: ' (reached)', dueKm: 'Due by odometer', dueDate: 'Due by date', soon: 'Almost due', history: 'Service history',
      noHistory: 'No history yet', svcDefault: 'Service / maintenance', km: '{n} km', sentBudget: 'Sent to budget', edit: 'Edit', yearOf: 'Year {y}', svcBtn: 'Service',
      attachments: 'Attachments', noCar: 'No cars yet', addCarTitle: 'Add car', editCarTitle: 'Edit car', polNone: 'Not linked', polDefault: 'Car policy', needId: 'Enter a plate or a make/model',
      confirmDelCar: 'Delete this car, its service history and all attachments? (Budget entries already created are kept.)', confirmDelSvc: 'Delete this entry? (Budget entries already created are kept.)',
      sentDone: 'Sent to budget', svcAddTitle: 'Add service · ', svcEditTitle: 'Edit service · ', errItems: 'Enter work done or a cost', errNextDate: 'The next service date must not be before this service',
      errNextKm: 'The next service odometer must be higher than the current one', errCost: 'Enter a cost before saving as an expense', onlyPdf: 'Only PDF and images are supported',
      tooBig: '{name} is larger than 15 MB', uploadFail: 'Upload failed', uploadFailCode: 'Upload failed ({s})', rmFile: 'Remove file'
    }
  }) : function () { return ''; };
  function catName(c) { return I18N ? I18N.catName(c) : c.name; }
  function kindLabel(d) { return TR('k.' + d.kind) || d.label; }
  function carTitle(v) { var t = C.title(v); return t === 'รถ' ? TR('car') : t; }
  var TD = window.TanotData;
  var VKEY = 'tanot:car:vehicles', SKEY = 'tanot:car:services', PKEY = 'tanot:insurance:policies';
  var REC_KEY = 'budget:records', CAT_KEY = 'budget:categories';
  var MAX_FILE = 15 * 1024 * 1024;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function num(n, d) { var v = Number(n) || 0, o = { maximumFractionDigits: d == null ? 0 : d }; return I18N ? I18N.number(v, o) : v.toLocaleString('th-TH', o); }
  function baht(n) { return '฿' + num(n, n % 1 ? 2 : 0); }
  function dateTh(s) { var d = C.parseDate(s); return d ? (I18N ? I18N.date(d, { day: 'numeric', month: 'short', year: 'numeric' }) : C.thDate(d)) : ''; }
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
    if (!mime) return Promise.reject(new Error(TR('onlyPdf')));
    if (f.size > MAX_FILE) return Promise.reject(new Error(TR('tooBig', { name: f.name })));
    return api('POST', 'ns=car&ref=' + encodeURIComponent(ref) + '&name=' + encodeURIComponent(f.name), { headers: { 'Content-Type': mime }, body: f })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.error || TR('uploadFailCode', { s: r.status }));
          return j;
        });
      });
  }

  /* ── วาดหน้า ── */
  function dueBadge(days, now) {
    if (days === null) return '';
    if (days < 0) return '<span class="badge err">' + esc(TR('overdue', { n: num(-days) })) + '</span>';
    if (days === 0) return '<span class="badge warn">' + esc(TR('today')) + '</span>';
    if (days <= 30) return '<span class="badge warn">' + esc(TR('inDays', { n: num(days) })) + '</span>';
    if (days <= 60) return '<span class="badge info">' + esc(TR('inDays', { n: num(days) })) + '</span>';
    return '';
  }
  function renderKpis(vehicles, services, now) {
    var y = now.getFullYear();
    var due = C.dueList(vehicles, services, policies(), now, 60).length;
    var spent = services.reduce(function (s, x) { return s + ((x.date || '').slice(0, 4) === String(y) ? (Number(x.cost) || 0) : 0); }, 0);
    function k(label, value, unit) { return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value">' + value + (unit ? '<small>' + unit + '</small>' : '') + '</div></div>'; }
    $('kpis').innerHTML = k(esc(TR('kCars')), num(vehicles.length), esc(TR('unitCars'))) + k(esc(TR('kDue')), num(due), esc(TR('unitItems'))) + k(esc(TR('kSpent')), baht(spent));
  }

  function deadlineRows(v, pols, now) {
    var rows = C.deadlines(v, pols, now).map(function (d) {
      var days = C.daysUntil(d.date, now);
      var link = d.linked ? '<a class="btn sm ghost" href="insurance.html" data-b="ins-link">' + icon('shield') + esc(TR('policyLink')) + '</a>' : '';
      return '<div class="list-row" data-kind="' + d.kind + '"><span class="lead">' + icon(d.kind === 'insurance' ? 'shield' : d.kind === 'inspect' ? 'wrench' : 'file-text') + '</span>' +
        '<div class="grow"><div class="title">' + esc(kindLabel(d)) + '</div><div class="meta">' + esc(dateTh(d.date)) + '</div></div>' +
        '<div class="end">' + dueBadge(days, now) + link + '</div></div>';
    });
    if (C.inspectRequired(v, v.taxDue || C.ymd(now)) && !C.inspectOk(v)) {
      rows.push('<div class="list-row" data-kind="inspect-need"><span class="lead">' + icon('wrench') + '</span>' +
        '<div class="grow"><div class="title">' + esc(TR('inspectNeed')) + '</div><div class="meta">' + esc(TR('inspectAge', { type: TR('vt.' + C.vType(v)), n: C.inspectAfter(v) }) + (v.inspectDue ? TR('inspectExpired') : TR('inspectNone'))) + '</div></div>' +
        '<div class="end"><span class="badge warn">' + esc(TR('mustInspect')) + '</span></div></div>');
    }
    return rows.join('');
  }
  function serviceBlock(v, services, now) {
    var mine = C.vehicleServices(services, v.id).sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    var n = C.nextService(v, services, now), html = '';
    if (n) {
      var parts = [];
      if (n.nextKm) parts.push(TR('atKm', { n: num(n.nextKm) }) + (n.kmLeft !== null ? (n.kmLeft > 0 ? TR('kmLeft', { n: num(n.kmLeft) }) : TR('reached')) : ''));
      if (n.nextDate) parts.push(dateTh(n.nextDate));
      var badge = n.state === 'overdue' ? '<span class="badge err">' + esc(n.due === 'km' ? TR('dueKm') : TR('dueDate')) + '</span>'
        : n.state === 'soon' ? '<span class="badge warn">' + esc(TR('soon')) + '</span>' : '';
      html += '<div class="list" data-b="next-service"><div class="list-row"><span class="lead">' + icon('wrench') + '</span>' +
        '<div class="grow"><div class="title">' + esc(TR('nextSvc')) + '</div><div class="meta">' + esc(parts.join(' · ')) + '</div></div><div class="end">' + badge + '</div></div></div>';
    }
    html += '<div class="sub-head">' + esc(TR('history')) + '</div>';
    if (!mine.length) return html + '<div class="empty"><p>' + esc(TR('noHistory')) + '</p></div>';
    return html + '<div class="list car-svc">' + mine.slice(0, 8).map(function (s) {
      var first = String(s.items || '').split(/\r?\n/)[0] || TR('svcDefault');
      var meta = [dateTh(s.date), s.odometer ? TR('km', { n: num(s.odometer) }) : ''].filter(Boolean).join(' · ');
      return '<div class="list-row" data-sid="' + esc(s.id) + '"><span class="lead">' + icon('wrench') + '</span>' +
        '<div class="grow"><div class="title">' + esc(first) + '</div><div class="meta">' + esc(meta) + '</div></div>' +
        '<div class="end">' + (s.cost ? '<span class="prem">' + baht(s.cost) + '</span>' : '') +
        (s.budgetId ? '<span class="badge ok" data-b="budget">' + icon('check') + esc(TR('sentBudget')) + '</span>' : '') +
        '<button class="btn sm icon" type="button" data-act="edit-svc" aria-label="' + esc(TR('edit')) + '">' + icon('pencil') + '</button></div></div>';
    }).join('') + '</div>';
  }
  function renderVehicles(vehicles, services, now) {
    if (!vehicles.length) { $('vehicles').innerHTML = '<section class="card"><div class="empty">' + icon('car') + '<p>' + esc(TR('noCar')) + '</p></div></section>'; return; }
    var pols = policies();
    $('vehicles').innerHTML = vehicles.map(function (v) {
      var meta = [C.vType(v) === 'motorcycle' ? TR('vt.motorcycle') : '', [v.make, v.model].filter(Boolean).join(' '), v.year ? TR('yearOf', { y: v.year }) : '', C.currentOdometer(v, services) ? TR('km', { n: num(C.currentOdometer(v, services)) }) : ''].filter(Boolean).join(' · ');
      var nFiles = Array.isArray(v.files) ? v.files.length : 0;
      var dl = deadlineRows(v, pols, now);
      return '<section class="card car-vehicle" data-vid="' + esc(v.id) + '">' +
        '<div class="car-vhead"><span class="lead">' + icon('car') + '</span>' +
        '<div class="grow"><div class="title">' + esc(carTitle(v)) + '</div><div class="meta">' + esc(meta) + '</div></div>' +
        '<div class="end">' + (nFiles ? '<span class="badge" title="' + esc(TR('attachments')) + '">' + icon('file-text') + nFiles + '</span>' : '') +
        '<button class="btn sm" type="button" data-act="add-svc">' + icon('plus') + esc(TR('svcBtn')) + '</button>' +
        '<button class="btn sm icon" type="button" data-act="edit-car" aria-label="' + esc(TR('edit')) + '">' + icon('pencil') + '</button></div></div>' +
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
      return '<div class="file-row" data-fid="' + esc(f.id) + '">' + icon(/^image\//.test(f.mime) ? 'image' : 'file-text') +
        '<a href="/api/files?id=' + encodeURIComponent(f.id) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' +
        '<span class="sz">' + num(f.size / 1024) + ' KB</span>' +
        '<button class="btn sm icon ghost" type="button" data-rm="' + esc(f.id) + '" aria-label="' + esc(TR('rmFile')) + '">' + icon('x') + '</button></div>';
    }).join('');
  }
  function openVehicle(v) {
    var isNew = !v;
    var rec = v ? JSON.parse(JSON.stringify(v)) : { id: newId('c'), files: [] };
    if (!Array.isArray(rec.files)) rec.files = [];
    V = { rec: rec, isNew: isNew, added: [], removed: [] };
    $('vTitle').textContent = isNew ? TR('addCarTitle') : TR('editCarTitle');
    $('vType').value = C.vType(rec);
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
    $('vPol').innerHTML = '<option value="">' + esc(TR('polNone')) + '</option>' + cars.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc([p.insurer, p.name, p.insured].filter(Boolean).join(' · ') || TR('polDefault')) + '</option>';
    }).join('');
    $('vPol').value = rec.insurancePolicyId && cars.some(function (p) { return p.id === rec.insurancePolicyId; }) ? rec.insurancePolicyId : '';
    $('vDel').hidden = isNew;
    $('vMsg').textContent = '';
    renderVFiles();
    openDlg(vdlg);
  }
  function readVehicle() {
    var r = V.rec, n;
    r.type = $('vType').value === 'motorcycle' ? 'motorcycle' : 'car';
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
        }).catch(function (e) { if (V === st) $('vMsg').textContent = e.message || TR('uploadFail'); });
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
    if (!r.plate && !r.make && !r.model) { $('vMsg').textContent = TR('needId'); return; }
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
    window.tanotConfirm(TR('confirmDelCar'), { danger: true, okLabel: TR('del') }).then(function (ok) {
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
    b.innerHTML = done ? icon('check') + esc(TR('sentDone')) : esc(TR('toBudget'));
  }
  function openService(vehicleId, s) {
    var v = load(VKEY).filter(function (x) { return x.id === vehicleId; })[0];
    if (!v) return;
    var isNew = !s;
    var rec = s ? JSON.parse(JSON.stringify(s)) : { id: newId('s'), vehicleId: vehicleId, date: C.ymd(new Date()) };
    S = { rec: rec, isNew: isNew, vehicle: v, busy: false };
    $('sTitle').textContent = (isNew ? TR('svcAddTitle') : TR('svcEditTitle')) + carTitle(v);
    $('sDate').value = rec.date || '';
    $('sOdo').value = rec.odometer || (isNew ? C.currentOdometer(v, load(SKEY)) || '' : '');
    $('sItems').value = rec.items || '';
    $('sCost').value = rec.cost || '';
    $('sNextKm').value = rec.nextKm || '';
    $('sNextDate').value = rec.nextDate || '';
    var cats = budgetCats();
    $('sCat').innerHTML = cats.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(catName(c)) + '</option>'; }).join('');
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
    if (!r.items && !r.cost) return TR('errItems');
    if (r.nextDate && r.nextDate < r.date) return TR('errNextDate');
    if (r.nextKm && r.odometer && r.nextKm <= r.odometer) return TR('errNextKm');
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
    if (!(r.cost > 0)) bad = bad || TR('errCost');
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
    window.tanotConfirm(TR('confirmDelSvc'), { danger: true, okLabel: TR('del') }).then(function (ok) {
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
  /* สลับภาษาสด: ข้อความใน HTML แปลโดย i18n.js เอง — วาดส่วนที่ JS สร้างใหม่ (ถ้าไม่มีกล่องเปิดค้างอยู่) */
  if (window.OME_LANG) window.OME_LANG.onChange(function () { updateBudgetBtn(); if (!vdlg.open && !sdlg.open) renderAll(); });
  if (TD && TD.onChange) TD.onChange(function () { if (!vdlg.open && !sdlg.open) renderAll(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !vdlg.open && !sdlg.open) renderAll(); });
})();
