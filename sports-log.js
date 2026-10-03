/* ══════════════════════════════════════════════════════════════════
   Tanot — บันทึกออกกำลังกาย (ส่วนในหน้า sports.html)
   เขียนแถวตรงเข้า tanot:health:workouts (sync list — รูปแบบ + ตรรกะ cleanWorkout/ประมาณ kcal อยู่ใน health-calc.js)
   ไม่สร้างคีย์ซ้ำฝั่งกีฬา · ไม่แตะ tanot:sports:xp/streak/progress/badges · XP เข้า LearnCore.award('sports') เฉพาะตอนบันทึกใหม่
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var HC = window.HealthCalc, TD = window.TanotData;
  if (!HC || !document.getElementById('logCard')) return;

  var KEY = 'tanot:health:workouts', VITALS = 'tanot:health:vitals';
  var XP_PER_WORKOUT = 10;
  var VIEW_LIMIT = 30;

  var S = {
    th: {
      logTitle: 'บันทึกออกกำลังกาย', logKind: 'กิจกรรม', logName: 'ชื่อกิจกรรม', logAt: 'วันเวลา', logMin: 'นาที', logDist: 'ระยะทาง (กม.)', logKcal: 'kcal',
      logSave: 'บันทึก', logSaveEdit: 'บันทึกการแก้ไข', logCancel: 'ยกเลิก', logDel: 'ลบ', min: 'นาที', km: 'กม.', edit: 'แก้ไข', empty: 'ยังไม่มีบันทึก',
      confirmDel: 'ลบบันทึกนี้?', toastXp: 'บันทึกแล้ว +{xp} XP',
      eKind: 'เลือกกิจกรรม', eName: 'ใส่ชื่อกิจกรรม', eAt: 'ใส่วันเวลา', eMinutes: 'ใส่จำนวนนาที (มากกว่า 0)', eDistance: 'ระยะทางไม่ถูกต้อง', eKcal: 'kcal ไม่ถูกต้อง'
    },
    en: {
      logTitle: 'Workout log', logKind: 'Activity', logName: 'Activity name', logAt: 'Date & time', logMin: 'Minutes', logDist: 'Distance (km)', logKcal: 'kcal',
      logSave: 'Save', logSaveEdit: 'Save changes', logCancel: 'Cancel', logDel: 'Delete', min: 'min', km: 'km', edit: 'Edit', empty: 'No entries yet',
      confirmDel: 'Delete this entry?', toastXp: 'Saved +{xp} XP',
      eKind: 'Choose an activity', eName: 'Enter an activity name', eAt: 'Enter date & time', eMinutes: 'Enter minutes (greater than 0)', eDistance: 'Invalid distance', eKcal: 'Invalid kcal'
    }
  };
  function lang() { return typeof getUILang === 'function' ? getUILang() : 'th'; }
  function L(k, vars) {
    var s = (S[lang()] && S[lang()][k]) || S.th[k] || k;
    if (vars) Object.keys(vars).forEach(function (n) { s = s.replace('{' + n + '}', vars[n]); });
    return s;
  }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function num(n, d) { return (Number(n) || 0).toLocaleString(lang() === 'en' ? 'en-US' : 'th-TH', { maximumFractionDigits: d == null ? 0 : d }); }
  function localInput(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function newUid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* ── storage: อ่านสดทุกครั้ง · เขียนผ่าน TanotData.update (อ่านสด→แก้→เขียน) ── */
  function readKey(key, dflt) {
    var v = TD && TD.read ? TD.read(key, null) : null;
    if (v == null) { try { v = JSON.parse(localStorage.getItem(key)); } catch (e) { v = null; } }
    return v == null ? dflt : v;
  }
  function loadRows() {
    var v = readKey(KEY, []);
    return Array.isArray(v) ? v.filter(function (r) { return r && typeof r === 'object' && r.id && r.source === 'sports'; }) : [];
  }
  function writeRows(fn) {
    function wrap(cur) { var list = Array.isArray(cur) ? cur : []; return fn(list); }
    if (TD && TD.update) return TD.update(KEY, wrap);
    var next = wrap(readKey(KEY, []));
    if (next !== undefined) localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }
  function latestWeight() { var v = readKey(VITALS, []); return HC.latestWeight(Array.isArray(v) ? v : []); }

  /* ── ฟอร์ม ── */
  var editing = null; // แถวที่กำลังแก้ (null = บันทึกใหม่)
  var uid = newUid();

  function kindOptions(selected) {
    $('logKind').innerHTML = '<option value="">—</option>' + HC.WORKOUT_KINDS.map(function (k) {
      return '<option value="' + k.key + '">' + esc(lang() === 'en' ? k.en : k.th) + '</option>';
    }).join('');
    $('logKind').value = selected || '';
  }
  function syncKindFields() {
    var k = HC.workoutKind($('logKind').value);
    $('logNameRow').hidden = !(k && k.key === 'other');
    $('logDistRow').hidden = !(k && k.dist);
  }
  function resetForm() {
    editing = null;
    uid = newUid();
    kindOptions('');
    $('logName').value = ''; $('logMin').value = ''; $('logDist').value = ''; $('logKcal').value = '';
    $('logAt').value = localInput(Date.now());
    $('logMsg').textContent = '';
    $('logCancel').hidden = true; $('logDel').hidden = true;
    $('logSave').querySelector('span').textContent = L('logSave');
    syncKindFields();
  }
  function kindKeyOf(row) {
    var k = HC.workoutKindByName(row.kind);
    return k ? k.key : 'other';
  }
  function editRow(r) {
    editing = r;
    var key = kindKeyOf(r);
    kindOptions(key);
    $('logName').value = key === 'other' ? r.kind : '';
    $('logAt').value = localInput(r.at);
    $('logMin').value = r.minutes;
    $('logDist').value = r.distanceKm != null ? r.distanceKm : '';
    $('logKcal').value = r.kcal != null ? r.kcal : '';
    $('logMsg').textContent = '';
    $('logCancel').hidden = false; $('logDel').hidden = false;
    $('logSave').querySelector('span').textContent = L('logSaveEdit');
    syncKindFields();
    $('logForm').scrollIntoView({ block: 'nearest' });
  }

  function showXpToast(xp) {
    var wrap = $('toastWrap');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'sp-toast';
    el.textContent = L('toastXp', { xp: xp });
    wrap.appendChild(el);
    setTimeout(function () { el.classList.add('leaving'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320); }, 2200);
  }

  $('logKind').addEventListener('change', syncKindFields);
  $('logForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = {
      kindKey: $('logKind').value, name: $('logName').value, at: new Date($('logAt').value).getTime(),
      minutes: $('logMin').value, distanceKm: $('logDist').value, kcal: $('logKcal').value
    };
    // แก้ = เขียนทับแถวเดิม (uid เดิม) · ใหม่ = uid ที่สร้างไว้ตอนเปิดฟอร์ม
    var id = editing ? editing.ref || String(editing.id).replace(/^sports:/, '') : uid;
    var out = HC.cleanWorkout(raw, id, { weightKg: latestWeight() });
    if (out.error) {
      $('logMsg').textContent = L({ kind: 'eKind', name: 'eName', at: 'eAt', minutes: 'eMinutes', distance: 'eDistance', kcal: 'eKcal' }[out.error]);
      return;
    }
    var rec = out.rec, isNew = false;
    writeRows(function (rows) {
      var i = -1;
      for (var j = 0; j < rows.length; j++) if (rows[j] && rows[j].id === rec.id) { i = j; break; }
      if (i === -1) { rows.push(rec); isNew = true; } else rows[i] = rec;
      return rows;
    });
    if (isNew && window.LearnCore) { var xp = window.LearnCore.award('sports', XP_PER_WORKOUT); if (xp) showXpToast(xp); }
    resetForm();
    render();
  });
  $('logCancel').addEventListener('click', resetForm);
  $('logDel').addEventListener('click', function () {
    if (!editing || !window.confirm(L('confirmDel'))) return;
    var id = editing.id;
    writeRows(function (rows) { return rows.filter(function (r) { return !(r && r.id === id); }); });
    resetForm();
    render();
  });
  $('logList').addEventListener('click', function (e) {
    var row = e.target.closest('.list-row');
    if (!row) return;
    var id = row.getAttribute('data-id');
    var r = loadRows().filter(function (x) { return x.id === id; })[0];
    if (r) editRow(r);
  });

  /* ── รายการย้อนหลัง ── */
  function render() {
    var rows = loadRows().sort(function (a, b) { return b.at - a.at; }).slice(0, VIEW_LIMIT);
    if (!rows.length) { $('logList').innerHTML = '<div class="empty"><p>' + esc(L('empty')) + '</p></div>'; return; }
    var loc = lang() === 'en' ? 'en-GB' : 'th-TH';
    $('logList').innerHTML = '<div class="list">' + rows.map(function (r) {
      var d = new Date(r.at);
      var parts = [num(r.minutes, 1) + ' ' + L('min')];
      if (r.distanceKm != null) parts.push(num(r.distanceKm, 2) + ' ' + L('km'));
      if (r.kcal != null) parts.push(num(r.kcal) + ' kcal');
      var k = HC.workoutKindByName(r.kind), title = k ? (lang() === 'en' ? k.en : k.th) : r.kind;
      return '<div class="list-row" data-id="' + esc(r.id) + '"><div class="grow"><div class="title">' + esc(title) + '</div>' +
        '<div class="meta">' + esc(d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: '2-digit' }) + ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' · ' + parts.join(' · ')) + '</div></div>' +
        '<div class="end"><button class="btn sm icon" type="button" aria-label="' + esc(L('edit')) + '"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-pencil"/></svg></button></div></div>';
    }).join('') + '</div>';
  }

  function relabel() {
    document.querySelectorAll('#logCard [data-log]').forEach(function (el) { el.textContent = L(el.getAttribute('data-log')); });
    var cur = $('logKind').value;
    kindOptions(cur);
    syncKindFields();
    $('logSave').querySelector('span').textContent = editing ? L('logSaveEdit') : L('logSave');
    render();
  }

  window.SportsLog = { render: relabel };
  resetForm();
  render();
  if (TD && TD.onChange) TD.onChange(render);
})();
