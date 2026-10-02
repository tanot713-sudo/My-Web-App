/* ══════════════════════════════════════════════════════════════════
   Tanot — ทะเบียนกรมธรรม์ (insurance.html) · ส่วนแสดงผล
   ตรรกะ (เบี้ยต่อปี/ลดหย่อน/วันต่ออายุ) อยู่ใน insurance-calc.js (window.InsuranceCalc) — ไฟล์นี้อ่าน/เขียน storage + วาดหน้า
   ข้อมูล: localStorage['tanot:insurance:policies'] (sync list) · สรุปเบี้ยลดหย่อนให้หน้าภาษี: 'tanot:insurance:taxsummary'
   ไฟล์กรมธรรม์: R2 ผ่าน /api/files (เฉพาะ *.pages.dev) — ในกรมธรรม์เก็บแค่ { id, name, size, mime }
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var C = window.InsuranceCalc;
  var TD = window.TanotData;
  var KEY = 'tanot:insurance:policies';
  var SUMMARY_KEY = 'tanot:insurance:taxsummary';
  var MAX_FILE = 15 * 1024 * 1024;
  var ICONS = { life: 'heart-pulse', health: 'shield', car: 'box', home: 'house' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function num(n, d) { return (Number(n) || 0).toLocaleString('th-TH', { maximumFractionDigits: d == null ? 0 : d }); }
  function baht(n) { return '฿' + num(n, n % 1 ? 2 : 0); }
  function dateTh(s) {
    var d = C.parseDate(s);
    return d ? d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }
  function filesAvailable() { return /\.pages\.dev$/.test(location.hostname) || !!(window.TANOT_FILES && window.TANOT_FILES.enabled); }
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* ── storage: อ่านสดจาก localStorage ทุกครั้ง (หลายแท็บ/เครื่องเขียนพร้อมกันได้ — tanot-data.js รวมรายการให้ตอน setItem) ── */
  function load() {
    var v = TD && TD.read ? TD.read(KEY, []) : null;
    if (v == null) { try { v = JSON.parse(localStorage.getItem(KEY)); } catch (e) { v = null; } }
    return Array.isArray(v) ? v.filter(function (p) { return p && typeof p === 'object' && p.id; }) : [];
  }
  function save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
    writeSummary(list);
  }
  function writeSummary(list) {
    var y = new Date().getFullYear(), years = {};
    [y - 1, y, y + 1].forEach(function (yr) { years[yr] = C.taxSummary(list, yr); });
    var prev = null;
    try { prev = JSON.parse(localStorage.getItem(SUMMARY_KEY)); } catch (e) {}
    if (!list.length && !prev) return;
    if (prev && JSON.stringify(prev.years) === JSON.stringify(years)) return; // ไม่เปลี่ยน = ไม่เขียน (ไม่ปั่นคิวซิงก์)
    localStorage.setItem(SUMMARY_KEY, JSON.stringify({ v: 1, updatedAt: Date.now(), years: years }));
  }

  /* ── สถานะหน้า ── */
  var typeFilter = 'all';
  var taxYear = new Date().getFullYear();
  var editing = null;       // กรมธรรม์ที่กำลังแก้ในกล่องโต้ตอบ (สำเนา)
  var isNew = false;
  var addedFiles = [];      // ไฟล์ที่อัปโหลดในกล่องนี้แล้วแต่ยังไม่กดบันทึก — ยกเลิก = ลบทิ้งจาก R2
  var removedFiles = [];    // ไฟล์ที่กดเอาออกในกล่องนี้ — ลบจริงจาก R2 ตอนกดบันทึก

  /* ── KPI ── */
  function renderKpis(list) {
    var now = new Date(), y = now.getFullYear();
    var live = list.filter(function (p) { return !C.isEnded(p, now); });
    var premium = live.reduce(function (s, p) { return s + C.premiumInYear(p, y); }, 0);
    var soon = C.renewals(list, now, 60).length;
    var ded = C.taxSummary(list, y).ded.total;
    function k(label, value, unit) { return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value">' + value + (unit ? '<small>' + unit + '</small>' : '') + '</div></div>'; }
    $('kpis').innerHTML = k('คุ้มครองอยู่', num(live.length), 'ฉบับ') + k('เบี้ยปีนี้', baht(premium)) +
      k('ต่ออายุใน 60 วัน', num(soon), 'ฉบับ') + k('ลดหย่อนภาษีปีนี้', baht(ded));
  }

  /* ── รายการ ── */
  function renewBadge(p, now) {
    if (C.isEnded(p, now)) return '<span class="badge">สิ้นสุดแล้ว</span>';
    var d = C.daysUntil(p.renewDate, now);
    if (d === null) return '';
    if (d < 0) return '<span class="badge err">เลยกำหนด ' + num(-d) + ' วัน</span>';
    if (d === 0) return '<span class="badge warn">ครบกำหนดวันนี้</span>';
    if (d <= 30) return '<span class="badge warn">อีก ' + num(d) + ' วัน</span>';
    if (d <= 60) return '<span class="badge info">อีก ' + num(d) + ' วัน</span>';
    return '<span class="badge">' + esc(dateTh(p.renewDate)) + '</span>';
  }
  function renderTypeFilter(list) {
    var opts = [['all', 'ทั้งหมด']].concat(Object.keys(C.TYPES).map(function (k) { return [k, C.TYPES[k]]; }));
    $('typeFilter').innerHTML = opts.map(function (o) {
      var n = o[0] === 'all' ? list.length : list.filter(function (p) { return p.type === o[0]; }).length;
      return '<button type="button" data-type="' + o[0] + '" aria-pressed="' + (typeFilter === o[0]) + '">' + esc(o[1]) + ' ' + n + '</button>';
    }).join('');
  }
  function renderList(list) {
    var now = new Date();
    var rows = list.filter(function (p) { return typeFilter === 'all' || p.type === typeFilter; });
    rows.sort(function (a, b) {
      var ea = C.isEnded(a, now) ? 1 : 0, eb = C.isEnded(b, now) ? 1 : 0;
      if (ea !== eb) return ea - eb;
      var da = C.daysUntil(a.renewDate, now), db = C.daysUntil(b.renewDate, now);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
    if (!rows.length) {
      $('listBody').innerHTML = '<div class="empty">' + icon('shield') + '<p>' + (list.length ? 'ไม่มีกรมธรรม์ประเภทนี้' : 'ยังไม่มีกรมธรรม์') + '</p></div>';
      return;
    }
    $('listBody').innerHTML = '<div class="list">' + rows.map(function (p) {
      var title = [p.insurer, p.name].filter(Boolean).join(' · ') || C.TYPES[p.type] || 'กรมธรรม์';
      var meta = [C.TYPES[p.type], p.policyNo, p.insured, p.sumInsured ? 'ทุน ' + baht(p.sumInsured) : ''].filter(Boolean).join(' · ');
      var nFiles = Array.isArray(p.files) ? p.files.length : 0;
      var canAdvance = !C.isEnded(p, now) && C.advanceRenewal(p);
      return '<div class="list-row" data-id="' + esc(p.id) + '">' +
        '<span class="lead">' + icon(ICONS[p.type] || 'shield') + '</span>' +
        '<div class="grow"><div class="title">' + esc(title) + '</div><div class="meta">' + esc(meta) + '</div></div>' +
        '<div class="end">' +
          (p.premium ? '<div class="prem">' + baht(p.premium) + '<div class="meta">' + esc(C.FREQS[p.freq] || '') + '</div></div>' : '') +
          renewBadge(p, now) +
          (nFiles ? '<span class="badge" title="ไฟล์แนบ">' + icon('file-text') + nFiles + '</span>' : '') +
          (canAdvance ? '<button class="btn sm" type="button" data-act="advance">' + icon('check') + 'จ่ายแล้ว</button>' : '') +
          '<button class="btn sm icon" type="button" data-act="edit" aria-label="แก้ไข">' + icon('pencil') + '</button>' +
        '</div></div>';
    }).join('') + '</div>';
  }

  /* ── เบี้ยลดหย่อนภาษี ── */
  function renderTax(list) {
    var sel = $('taxYear'), y = new Date().getFullYear();
    if (!sel.options.length) {
      [y + 1, y, y - 1].forEach(function (yr) {
        var o = document.createElement('option');
        o.value = yr; o.textContent = 'ปี ' + (yr + 543);
        sel.appendChild(o);
      });
    }
    sel.value = String(taxYear);
    var s = C.taxSummary(list, taxYear);
    var order = ['life', 'health', 'spouseLife', 'parentsHealth', 'annuity'];
    var capText = { life: C.CAPS.life, health: C.CAPS.health, spouseLife: C.CAPS.spouseLife, parentsHealth: C.CAPS.parentsHealth, annuity: C.CAPS.annuity };
    var rows = order.filter(function (k) { return s.raw[k] > 0; });
    if (!rows.length) {
      $('taxBody').innerHTML = '<div class="empty">' + icon('landmark') + '<p>ไม่มีเบี้ยที่ใช้ลดหย่อนในปีนี้</p></div>';
      return;
    }
    $('taxBody').innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>หมวด</th><th class="num">เบี้ย</th><th class="num cap">เพดาน</th><th class="num">ลดหย่อนได้</th></tr></thead><tbody>' +
      rows.map(function (k) {
        return '<tr data-cat="' + k + '"><td>' + esc(C.TAX_CATS[k]) + '</td><td class="num">' + baht(s.raw[k]) + '</td><td class="num cap">' + baht(capText[k]) + '</td><td class="num">' + baht(s.ded[k]) + '</td></tr>';
      }).join('') +
      '<tr class="tot"><td>รวม</td><td></td><td class="cap"></td><td class="num" id="taxTotal">' + baht(s.ded.total) + '</td></tr></tbody></table></div>';
  }

  function renderAll() {
    var list = load();
    // วันต่ออายุ → การแจ้งเตือน (tanot-push.js ส่งเฉพาะเมื่อชุดเปลี่ยน · ทำงานเฉพาะ pages.dev)
    if (window.TanotPush) window.TanotPush.setReminders('insurance', C.reminders(list, new Date()));
    renderKpis(list);
    renderTypeFilter(list);
    renderList(list);
    renderTax(list);
  }

  /* ── กล่องเพิ่ม/แก้ไข ── */
  var dlg = $('dlg');
  function fillSelect(id, map) {
    $(id).innerHTML = Object.keys(map).map(function (k) { return '<option value="' + k + '">' + esc(map[k]) + '</option>'; }).join('');
  }
  fillSelect('fType', C.TYPES);
  fillSelect('fFreq', C.FREQS);
  fillSelect('fTaxCat', C.TAX_CATS);

  function syncTaxRows() {
    var type = $('fType').value;
    var taxable = type === 'life' || type === 'health';
    $('taxRow').hidden = !taxable;
    if (!taxable) $('fTaxCat').value = 'none';
    var c = $('fTaxCat').value;
    $('longRow').hidden = !(taxable && (c === 'life' || c === 'spouseLife' || c === 'annuity'));
  }
  $('fType').addEventListener('change', function () {
    $('fTaxCat').value = C.defaultTaxCat($('fType').value);
    syncTaxRows();
  });
  $('fTaxCat').addEventListener('change', syncTaxRows);

  function renderFiles() {
    var files = (editing && editing.files) || [];
    $('filesRow').hidden = !filesAvailable();
    $('fileList').innerHTML = files.map(function (f) {
      return '<div class="ins-file" data-fid="' + esc(f.id) + '">' + icon('file-text') +
        '<a href="/api/files?id=' + encodeURIComponent(f.id) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' +
        '<span class="sz">' + num(f.size / 1024) + ' KB</span>' +
        '<button class="btn sm icon ghost" type="button" data-rm="' + esc(f.id) + '" aria-label="เอาไฟล์ออก">' + icon('x') + '</button></div>';
    }).join('');
  }

  function openDialog(p) {
    isNew = !p;
    editing = p ? JSON.parse(JSON.stringify(p)) : { id: newId(), type: 'life', freq: 'year', taxCat: 'life', longTerm: true, files: [] };
    if (!Array.isArray(editing.files)) editing.files = [];
    addedFiles = []; removedFiles = [];
    $('dlgTitle').textContent = isNew ? 'เพิ่มกรมธรรม์' : 'แก้ไขกรมธรรม์';
    $('fType').value = editing.type || 'life';
    $('fInsurer').value = editing.insurer || '';
    $('fName').value = editing.name || '';
    $('fPolicyNo').value = editing.policyNo || '';
    $('fInsured').value = editing.insured || '';
    $('fSum').value = editing.sumInsured || '';
    $('fPremium').value = editing.premium || '';
    $('fFreq').value = editing.freq || 'year';
    $('fStart').value = editing.startDate || '';
    $('fRenew').value = editing.renewDate || '';
    $('fEnd').value = editing.endDate || '';
    $('fTaxCat').value = editing.taxCat || C.defaultTaxCat(editing.type);
    $('fLong').checked = editing.longTerm !== false;
    $('fNote').value = editing.note || '';
    $('delBtn').hidden = isNew;
    $('msg').textContent = '';
    syncTaxRows();
    renderFiles();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function closeDialog() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }

  function api(method, qs, opts) {
    return fetch('/api/files?' + qs, Object.assign({ method: method, credentials: 'same-origin' }, opts || {}));
  }
  function deleteRemote(ids) {
    return Promise.all(ids.map(function (id) { return api('DELETE', 'id=' + encodeURIComponent(id)).catch(function () {}); }));
  }

  var MIME_BY_EXT = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif' };
  function mimeOf(f) {
    if (f.type) return f.type;
    var m = /\.([a-z0-9]+)$/i.exec(f.name || '');
    return (m && MIME_BY_EXT[m[1].toLowerCase()]) || '';
  }
  function uploadOne(f) {
    var mime = mimeOf(f);
    if (!mime) return Promise.reject(new Error('รองรับเฉพาะ PDF และรูปภาพ'));
    if (f.size > MAX_FILE) return Promise.reject(new Error(f.name + ' ใหญ่เกิน 15 MB'));
    return api('POST', 'ns=insurance&ref=' + encodeURIComponent(editing.id) + '&name=' + encodeURIComponent(f.name), { headers: { 'Content-Type': mime }, body: f })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.error || 'อัปโหลดไม่สำเร็จ (' + r.status + ')');
          return j;
        });
      });
  }
  $('attachBtn').addEventListener('click', function () { $('fileInput').click(); });
  $('fileInput').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files || []);
    this.value = '';
    if (!files.length) return;
    $('msg').textContent = '';
    $('attachBtn').disabled = true;
    files.reduce(function (chain, f) {
      return chain.then(function () {
        return uploadOne(f).then(function (j) {
          editing.files.push({ id: j.id, name: j.name, size: j.size, mime: j.mime });
          addedFiles.push(j.id);
          renderFiles();
        }).catch(function (e) { $('msg').textContent = e.message || 'อัปโหลดไม่สำเร็จ'; });
      });
    }, Promise.resolve()).then(function () { $('attachBtn').disabled = false; });
  });
  $('fileList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]');
    if (!b) return;
    var id = b.getAttribute('data-rm');
    editing.files = editing.files.filter(function (f) { return f.id !== id; });
    if (addedFiles.indexOf(id) !== -1) { addedFiles = addedFiles.filter(function (x) { return x !== id; }); deleteRemote([id]); }
    else removedFiles.push(id);
    renderFiles();
  });

  function readForm() {
    var p = editing;
    p.type = $('fType').value;
    p.insurer = $('fInsurer').value.trim();
    p.name = $('fName').value.trim();
    p.policyNo = $('fPolicyNo').value.trim();
    p.insured = $('fInsured').value.trim();
    p.sumInsured = Number($('fSum').value) > 0 ? Number($('fSum').value) : 0;
    p.premium = Number($('fPremium').value) > 0 ? Number($('fPremium').value) : 0;
    p.freq = $('fFreq').value;
    p.startDate = $('fStart').value;
    p.renewDate = $('fRenew').value;
    p.endDate = $('fEnd').value;
    p.taxCat = $('fTaxCat').value;
    p.longTerm = $('fLong').checked;
    p.note = $('fNote').value.trim();
    return p;
  }

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = readForm();
    if (!p.insurer && !p.name) { $('msg').textContent = 'ใส่ชื่อบริษัทหรือชื่อแผนอย่างน้อยหนึ่งช่อง'; return; }
    if (p.startDate && p.endDate && p.endDate < p.startDate) { $('msg').textContent = 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มคุ้มครอง'; return; }
    var list = load();
    var i = list.findIndex(function (x) { return x.id === p.id; });
    if (i === -1) list.push(p); else list[i] = p;
    save(list);
    var gone = removedFiles; removedFiles = []; addedFiles = [];
    closeDialog();
    deleteRemote(gone);
    renderAll();
  });
  $('cancelBtn').addEventListener('click', function () { closeDialog(); });
  dlg.addEventListener('close', function () {
    // ปิดโดยไม่บันทึก (ยกเลิก/Esc) — ไฟล์ที่เพิ่งอัปโหลดในกล่องนี้ไม่มีใครอ้างถึง ลบทิ้งจาก R2
    if (addedFiles.length) { deleteRemote(addedFiles); addedFiles = []; }
    removedFiles = [];
  });
  $('delBtn').addEventListener('click', function () {
    if (!editing || !window.confirm('ลบกรมธรรม์นี้และไฟล์แนบทั้งหมด?')) return;
    var id = editing.id;
    var list = load();
    var orig = list.filter(function (x) { return x.id === id; })[0];
    var ids = ((orig && orig.files) || []).map(function (f) { return f.id; }).concat(addedFiles);
    addedFiles = []; removedFiles = [];
    save(list.filter(function (x) { return x.id !== id; }));
    closeDialog();
    deleteRemote(ids);
    renderAll();
  });

  /* ── ปุ่มในหน้า ── */
  $('addBtn').addEventListener('click', function () { openDialog(null); });
  $('typeFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-type]');
    if (!b) return;
    typeFilter = b.getAttribute('data-type');
    renderAll();
  });
  $('taxYear').addEventListener('change', function () { taxYear = parseInt(this.value, 10) || taxYear; renderTax(load()); });
  $('listBody').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    var row = e.target.closest('.list-row');
    if (!row) return;
    var id = row.getAttribute('data-id');
    var list = load();
    var p = list.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (b && b.getAttribute('data-act') === 'advance') {
      var next = C.advanceRenewal(p);
      if (next) { p.renewDate = next; save(list); renderAll(); }
    } else openDialog(p);
  });

  writeSummary(load());
  renderAll();
  if (TD && TD.onChange) TD.onChange(function () { if (!dlg.open) renderAll(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !dlg.open) renderAll(); });
})();
