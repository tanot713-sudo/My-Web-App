/* ══════════════════════════════════════════════════════════════════
   Tanot — สุขภาพ (health.html) · ส่วนแสดงผล
   ตรรกะ (ช่วงปกติ/เทียบครั้งก่อน/ตารางกินยา/ข้อความแจ้งเตือน) อยู่ใน health-calc.js (window.HealthCalc) — ไฟล์นี้อ่าน/เขียน storage + วาดหน้า
   คีย์ + รูปแบบข้อมูลทั้งหมดอธิบายไว้ที่หัว health-calc.js · ไฟล์ผลตรวจ: R2 ผ่าน /api/files?ns=health (เฉพาะ *.pages.dev)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  window.TANOT_NO_RELOAD_BAR = true; // วาดใหม่เองเมื่อ TanotData.onChange — ห้ามรีเซ็ตช่องในฟอร์มที่กำลังกรอก

  var HC = window.HealthCalc;

  /* ── ข้อความ UI สองภาษา (i18n.js) — คีย์ 'health.*' · ป้ายตัวชี้วัด/กลุ่ม/รายการแล็บของ health-calc.js แปลที่นี่ตามรหัส ── */
  var I18N = window.OME_I18N;
  var TR = I18N ? I18N.scope('health', {
    th: {
      title: 'สุขภาพ | Tanot', h1: 'สุขภาพ', settings: 'ตั้งค่า', hVital: 'บันทึกสัญญาณชีพ', editEntry: 'แก้ไขบันทึก', vAt: 'วันเวลา', vWeight: 'น้ำหนัก (กก.)',
      vWaist: 'รอบเอว (ซม.)', vSys: 'ความดันตัวบน', vDia: 'ความดันตัวล่าง', vHr: 'ชีพจร (ครั้ง/นาที)', vGlu: 'น้ำตาล (mg/dL)', note: 'บันทึก', save: 'บันทึก',
      saveEdit: 'บันทึกการแก้ไข', cancel: 'ยกเลิก', del: 'ลบ', hTrend: 'แนวโน้ม', metricShown: 'ค่าที่แสดง', hMeds: 'ยา/อาหารเสริม', add: 'เพิ่ม', hHist: 'ประวัติบันทึก',
      hWork: 'ออกกำลังกาย', hChk: 'ผลตรวจสุขภาพประจำปี', chkAdd: 'เพิ่มผลตรวจ', cDate: 'วันที่ตรวจ', cPlace: 'สถานที่', labs: 'รายการผลแล็บ', labPreset: 'เพิ่มรายการที่พบบ่อย',
      blankRow: 'แถวว่าง', resultFiles: 'ไฟล์ผลตรวจ', attach: 'แนบไฟล์', mName: 'ชื่อ', mDose: 'ขนาด', mTimes: 'เวลาที่ต้องกิน', mStart: 'วันเริ่ม', mEnd: 'วันสิ้นสุด',
      sHide: 'ซ่อนชื่อยาในแจ้งเตือน', sGoal: 'เป้าออกกำลังกายต่อสัปดาห์ (นาที)', ranges: 'ช่วงปกติ (ต่ำสุด – สูงสุด)', resetDefaults: 'คืนค่าเริ่มต้น', chkTitle: 'ผลตรวจสุขภาพ',
      dirHigh: 'สูง', dirLow: 'ต่ำ', first: 'ครั้งแรก', same: 'เท่าครั้งก่อน', fromPrev: 'จากครั้งก่อน', chartAria: 'กราฟแนวโน้ม {label}', optVitals: 'สัญญาณชีพ',
      optLabs: 'ผลตรวจ', noData: 'ยังไม่มีข้อมูล', noEntries: 'ยังไม่มีบันทึก', pWeight: 'น้ำหนัก {v}', pBp: 'ความดัน {a}/{b}', pHr: 'ชีพจร {v}', pGlu: 'น้ำตาล {v}',
      pWaist: 'เอว {v}', edit: 'แก้ไข', weekTitle: 'สัปดาห์ {d} · {m} นาที', goalLbl: 'เป้า {n}', wkAria: 'นาทีออกกำลังกายต่อสัปดาห์ เป้า {n} นาที', minThisWeek: 'นาที สัปดาห์นี้',
      reached: 'ถึงเป้าแล้ว', minutes: '{n} นาที', km: '{n} กม.', late: 'เลยเวลา', taken: 'กินแล้ว', allMeds: 'รายการทั้งหมด', noMeds: 'ยังไม่มียา', from: 'เริ่ม {d}',
      until: 'ถึง {d}', ended: 'สิ้นสุดแล้ว', notStarted: 'ยังไม่เริ่ม', clock: '{t} น.', noChk: 'ยังไม่มีผลตรวจ', items: '{n} รายการ', attachments: 'ไฟล์แนบ',
      errEmpty: 'กรอกอย่างน้อยหนึ่งค่า', errAt: 'ใส่วันเวลา', errRange: '{label} อยู่นอกช่วงที่รับได้', confirmDelEntry: 'ลบบันทึกนี้?', confirmDelMed: 'ลบยานี้และประวัติการกินของยานี้?',
      confirmDelChk: 'ลบผลตรวจนี้และไฟล์แนบทั้งหมด?', timeAria: 'เวลา', rmTime: 'เอาเวลาออก', addTime: 'เพิ่มเวลา', medNew: 'เพิ่มยา/อาหารเสริม', medEdit: 'แก้ไขยา/อาหารเสริม',
      medErrName: 'ใส่ชื่อยา', medErrTimes: 'ใส่เวลาอย่างน้อยหนึ่งเวลา', medErrRange: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม', medErrStart: 'วันเริ่มไม่ถูกต้อง', medErrEnd: 'วันสิ้นสุดไม่ถูกต้อง',
      phName: 'ชื่อรายการ', phValue: 'ค่า', phUnit: 'หน่วย', phLo: 'ต่ำสุด', phHi: 'สูงสุด', rmRow: 'เอาแถวออก', chkNew: 'เพิ่มผลตรวจสุขภาพ', chkEdit: 'แก้ไขผลตรวจสุขภาพ',
      errDate: 'ใส่วันที่ตรวจ', errChk: 'ใส่ผลอย่างน้อยหนึ่งรายการ (ชื่อ + ค่า) หรือแนบไฟล์', onlyPdf: 'รองรับเฉพาะ PDF และรูปภาพ', tooBig: '{name} ใหญ่เกิน 15 MB',
      uploadFail: 'อัปโหลดไม่สำเร็จ', uploadFailCode: 'อัปโหลดไม่สำเร็จ ({s})', rmFile: 'เอาไฟล์ออก', rangeLo: '{label} ต่ำสุด', rangeHi: '{label} สูงสุด', 'm.weight': 'น้ำหนัก',
      'm.sys': 'ความดันตัวบน', 'm.dia': 'ความดันตัวล่าง', 'm.hr': 'ชีพจร', 'm.glu': 'น้ำตาลในเลือด', 'm.waist': 'รอบเอว', 'u.weight': 'กก.', 'u.sys': 'mmHg', 'u.dia': 'mmHg',
      'u.hr': 'ครั้ง/นาที', 'u.glu': 'mg/dL', 'u.waist': 'ซม.', 'g.weight': 'น้ำหนัก', 'g.bp': 'ความดัน', 'g.hr': 'ชีพจร', 'g.glu': 'น้ำตาล', 'g.waist': 'รอบเอว',
      lab0: 'น้ำตาลหลังอดอาหาร (FBS)', lab1: 'HbA1c', lab2: 'คอเลสเตอรอลรวม', lab3: 'LDL', lab4: 'HDL', lab5: 'ไตรกลีเซอไรด์', lab6: 'ครีเอตินิน', lab7: 'eGFR',
      lab8: 'ALT (SGPT)', lab9: 'AST (SGOT)', lab10: 'กรดยูริก', lab11: 'ฮีโมโกลบิน (Hb)'
    },
    en: {
      title: 'Health | Tanot', h1: 'Health', settings: 'Settings', hVital: 'Log vitals', editEntry: 'Edit entry', vAt: 'Date & time', vWeight: 'Weight (kg)', vWaist: 'Waist (cm)',
      vSys: 'Systolic pressure', vDia: 'Diastolic pressure', vHr: 'Pulse (bpm)', vGlu: 'Glucose (mg/dL)', note: 'Note', save: 'Save', saveEdit: 'Save changes',
      cancel: 'Cancel', del: 'Delete', hTrend: 'Trend', metricShown: 'Metric shown', hMeds: 'Medication & supplements', add: 'Add', hHist: 'History', hWork: 'Exercise',
      hChk: 'Annual check-up results', chkAdd: 'Add result', cDate: 'Check-up date', cPlace: 'Place', labs: 'Lab results', labPreset: 'Add a common test', blankRow: 'Blank row',
      resultFiles: 'Result files', attach: 'Attach file', mName: 'Name', mDose: 'Dose', mTimes: 'Times to take', mStart: 'Start date', mEnd: 'End date', sHide: 'Hide medication names in notifications',
      sGoal: 'Weekly exercise goal (minutes)', ranges: 'Normal range (min – max)', resetDefaults: 'Reset to defaults', chkTitle: 'Check-up result', dirHigh: 'High',
      dirLow: 'Low', first: 'First reading', same: 'Same as last time', fromPrev: 'vs last time', chartAria: 'Trend chart: {label}', optVitals: 'Vitals', optLabs: 'Lab results',
      noData: 'No data yet', noEntries: 'No entries yet', pWeight: 'Weight {v}', pBp: 'BP {a}/{b}', pHr: 'Pulse {v}', pGlu: 'Glucose {v}', pWaist: 'Waist {v}',
      edit: 'Edit', weekTitle: 'Week of {d} · {m} min', goalLbl: 'Goal {n}', wkAria: 'Exercise minutes per week, goal {n} min', minThisWeek: 'min this week', reached: 'Goal reached',
      minutes: '{n} min', km: '{n} km', late: 'Overdue', taken: 'Taken', allMeds: 'All medication', noMeds: 'No medication yet', from: 'From {d}', until: 'Until {d}',
      ended: 'Ended', notStarted: 'Not started', clock: '{t}', noChk: 'No results yet', items: '{n} items', attachments: 'Attachments', errEmpty: 'Enter at least one value',
      errAt: 'Enter the date and time', errRange: '{label} is outside the accepted range', confirmDelEntry: 'Delete this entry?', confirmDelMed: 'Delete this medication and its intake history?',
      confirmDelChk: 'Delete this result and all attached files?', timeAria: 'Time', rmTime: 'Remove time', addTime: 'Add time', medNew: 'Add medication', medEdit: 'Edit medication',
      medErrName: 'Enter a name', medErrTimes: 'Add at least one time', medErrRange: 'End date must not be before the start date', medErrStart: 'Invalid start date',
      medErrEnd: 'Invalid end date', phName: 'Test name', phValue: 'Value', phUnit: 'Unit', phLo: 'Min', phHi: 'Max', rmRow: 'Remove row', chkNew: 'Add check-up result',
      chkEdit: 'Edit check-up result', errDate: 'Enter the check-up date', errChk: 'Enter at least one result (name + value) or attach a file', onlyPdf: 'Only PDF and images are supported',
      tooBig: '{name} is larger than 15 MB', uploadFail: 'Upload failed', uploadFailCode: 'Upload failed ({s})', rmFile: 'Remove file', rangeLo: '{label} min',
      rangeHi: '{label} max', 'm.weight': 'Weight', 'm.sys': 'Systolic pressure', 'm.dia': 'Diastolic pressure', 'm.hr': 'Pulse', 'm.glu': 'Blood glucose', 'm.waist': 'Waist',
      'u.weight': 'kg', 'u.sys': 'mmHg', 'u.dia': 'mmHg', 'u.hr': 'bpm', 'u.glu': 'mg/dL', 'u.waist': 'cm', 'g.weight': 'Weight', 'g.bp': 'Blood pressure', 'g.hr': 'Pulse',
      'g.glu': 'Glucose', 'g.waist': 'Waist', lab0: 'Fasting glucose (FBS)', lab1: 'HbA1c', lab2: 'Total cholesterol', lab3: 'LDL', lab4: 'HDL', lab5: 'Triglycerides',
      lab6: 'Creatinine', lab7: 'eGFR', lab8: 'ALT (SGPT)', lab9: 'AST (SGOT)', lab10: 'Uric acid', lab11: 'Haemoglobin (Hb)'
    }
  }) : function () { return ''; };
  function mLabel(k) { return TR('m.' + k) || HC.METRICS[k].label; }
  function mUnit(k) { return TR('u.' + k) || HC.METRICS[k].unit; }
  /* ชื่อกิจกรรมมาตรฐานแสดงตามภาษา (health-calc มีทั้ง th/en) · กิจกรรมที่ผู้ใช้พิมพ์เองคงเดิม */
  function workoutName(name) { var k = HC.workoutKindByName(name); return k ? (I18N && I18N.lang() === 'en' ? k.en : k.th) : name; }
  function gLabel(g) { return TR('g.' + g.key) || g.label; }
  var TD = window.TanotData;
  var K = {
    vitals: 'tanot:health:vitals', checkups: 'tanot:health:checkups', meds: 'tanot:health:meds',
    intake: 'tanot:health:intake', workouts: 'tanot:health:workouts', ranges: 'tanot:health:ranges', settings: 'tanot:health:settings'
  };
  var MAX_FILE = 15 * 1024 * 1024;
  var VIEW_LIMIT = 30;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function num(n, d) { var v = Number(n) || 0, o = { maximumFractionDigits: d == null ? 0 : d }; return I18N ? I18N.number(v, o) : v.toLocaleString('th-TH', o); }
  function filesAvailable() { return /\.pages\.dev$/.test(location.hostname) || !!(window.TANOT_FILES && window.TANOT_FILES.enabled); }
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function localInput(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function dayTh(ms) { return I18N ? I18N.date(new Date(ms), { day: 'numeric', month: 'short', year: '2-digit' }) : new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); }
  function timeOf(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ymdTh(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
    return m ? dayTh(new Date(+m[1], +m[2] - 1, +m[3], 12).getTime()) : '';
  }

  /* ── storage: อ่านสดทุกครั้ง (อีกเครื่อง/แท็บเขียนพร้อมกันได้ — tanot-data.js รวมรายการให้ตอน setItem) ── */
  function read(key, dflt) {
    var v = TD && TD.read ? TD.read(key, null) : null;
    if (v == null) { try { v = JSON.parse(localStorage.getItem(key)); } catch (e) { v = null; } }
    return v == null ? dflt : v;
  }
  function loadList(key) {
    var v = read(key, []);
    return Array.isArray(v) ? v.filter(function (r) { return r && typeof r === 'object' && r.id; }) : [];
  }
  function loadObj(key) { var v = read(key, {}); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function saveJson(key, v) { localStorage.setItem(key, JSON.stringify(v)); }
  function upsert(key, rec) {
    var list = loadList(key), i = list.findIndex(function (x) { return x.id === rec.id; });
    if (i === -1) list.push(rec); else list[i] = rec;
    saveJson(key, list);
  }
  function remove(key, id) { saveJson(key, loadList(key).filter(function (x) { return x.id !== id; })); }

  /* ── สถานะหน้า ── */
  var trend = '';
  var editingVital = null;
  var chk = null, chkNew = false, addedFiles = [], removedFiles = [];
  var med = null, medNew = false;

  function anyDialogOpen() { return $('chkDlg').open || $('medDlg').open || $('setDlg').open; }
  function dirLabel(v, r) { return r && r.hi != null && v > r.hi ? TR('dirHigh') : TR('dirLow'); }
  function statusBadge(st, text) { return st === 'warn' || st === 'err' ? '<span class="badge ' + st + '">' + esc(text) + '</span>' : ''; }

  /* ── KPI: ค่าล่าสุด เทียบครั้งก่อน ── */
  function renderKpis(vitals, ranges) {
    $('kpis').innerHTML = HC.GROUPS.map(function (g) {
      var cmp = g.fields.map(function (f) { return HC.compare(vitals, f); });
      var first = cmp[0];
      if (!first || (g.fields.length > 1 && !cmp[1])) {
        return '<div class="kpi" data-kpi="' + g.key + '"><div class="kpi-label">' + esc(gLabel(g)) + '</div><div class="kpi-value">—</div><div class="kpi-delta"></div></div>';
      }
      var m = HC.METRICS[g.fields[0]];
      var value = g.fields.map(function (f, i) { return num(cmp[i].last.v, HC.METRICS[f].dec); }).join('/');
      var worst = null, badge = '';
      g.fields.forEach(function (f, i) {
        var r = HC.rangeOf(f, ranges), st = HC.status(cmp[i].last.v, r);
        if (st === 'err' || (st === 'warn' && worst !== 'err')) { worst = st; badge = statusBadge(st, dirLabel(cmp[i].last.v, r)); }
      });
      var d = first.delta, dec = m.dec;
      var delta = d == null ? TR('first') : (d === 0 ? TR('same') : (d > 0 ? '▲ +' : '▼ −') + num(Math.abs(d), dec) + ' ' + TR('fromPrev'));
      return '<div class="kpi" data-kpi="' + g.key + '"><div class="kpi-label">' + esc(gLabel(g)) + '</div>' +
        '<div class="row"><div class="kpi-value">' + value + '<small>' + esc(mUnit(g.fields[0])) + '</small></div>' + badge + '</div>' +
        '<div class="kpi-delta">' + delta + '</div></div>';
    }).join('');
  }

  /* ── กราฟแนวโน้ม (SVG สร้างเอง สีจาก chart-theme.js — วาดใหม่เมื่อธีมเปลี่ยน) ── */
  function rgba(rgb, a) { var m = String(rgb).match(/[\d.]+/g); return m ? 'rgba(' + m[0] + ',' + m[1] + ',' + m[2] + ',' + a + ')' : rgb; }
  function niceTicks(lo, hi, n) {
    var span = hi - lo || 1, raw = span / n, pow = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var step = [1, 2, 2.5, 5, 10].map(function (k) { return k * pow; }).filter(function (s) { return s >= raw; })[0] || raw;
    var out = [], t = Math.ceil(lo / step) * step;
    for (var i = 0; i < 20 && t <= hi + 1e-9; i++, t += step) out.push(Math.round(t * 1e6) / 1e6);
    return out;
  }
  function chartHtml(def) {
    var th = window.OmeChartTheme ? window.OmeChartTheme.get() : null;
    if (!th) return '';
    var all = [];
    def.series.forEach(function (s) { s.pts.forEach(function (p) { all.push(p); }); });
    var vals = all.map(function (p) { return p.v; });
    def.series.forEach(function (s) { if (s.band) { if (s.band.lo != null) vals.push(s.band.lo); if (s.band.hi != null) vals.push(s.band.hi); } });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pd = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.12;
    lo -= pd; hi += pd;
    var tmin = Math.min.apply(null, all.map(function (p) { return p.t; })), tmax = Math.max.apply(null, all.map(function (p) { return p.t; }));
    var W = 640, H = 260, L = 46, R = 14, T = 12, B = 30, iw = W - L - R, ih = H - T - B;
    function X(t) { return tmax === tmin ? L + iw / 2 : L + (t - tmin) / (tmax - tmin) * iw; }
    function Y(v) { return T + (hi - v) / (hi - lo) * ih; }
    var g = '';
    niceTicks(lo, hi, 4).forEach(function (t) {
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(t) + '" y2="' + Y(t) + '" stroke="' + th.grid + '" stroke-width="1"/>' +
        '<text x="' + (L - 6) + '" y="' + (Y(t) + 4) + '" text-anchor="end" font-size="11" fill="' + th.textMuted + '">' + num(t, 1) + '</text>';
    });
    var nx = tmax === tmin ? 1 : 4;
    for (var i = 0; i < nx; i++) {
      var tt = nx === 1 ? tmin : tmin + (tmax - tmin) * i / (nx - 1);
      g += '<text x="' + X(tt) + '" y="' + (H - 8) + '" text-anchor="' + (nx === 1 ? 'middle' : i === 0 ? 'start' : i === nx - 1 ? 'end' : 'middle') + '" font-size="11" fill="' + th.textMuted + '">' + esc(dayTh(tt)) + '</text>';
    }
    def.series.forEach(function (s, si) {
      var c = th.series[si];
      if (s.band) {
        var b0 = Math.min(hi, s.band.hi != null ? s.band.hi : hi), b1 = Math.max(lo, s.band.lo != null ? s.band.lo : lo);
        if (b0 > b1) g += '<rect x="' + L + '" y="' + Y(b0) + '" width="' + iw + '" height="' + (Y(b1) - Y(b0)) + '" fill="' + rgba(c, 0.1) + '"/>';
      }
    });
    def.series.forEach(function (s, si) {
      var c = th.series[si];
      if (s.pts.length > 1) g += '<polyline fill="none" stroke="' + c + '" stroke-width="2" stroke-linejoin="round" points="' + s.pts.map(function (p) { return X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1); }).join(' ') + '"/>';
      s.pts.forEach(function (p) {
        g += '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="4" fill="' + c + '" stroke="' + th.surface + '" stroke-width="1.5"><title>' + esc(s.name + ' ' + num(p.v, 2) + ' · ' + dayTh(p.t)) + '</title></circle>';
      });
    });
    var legend = def.series.length > 1 ? '<div class="legend">' + def.series.map(function (s, si) { return '<span><i style="background:' + th.series[si] + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>' : '';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(TR('chartAria', { label: def.label + (def.unit ? ' (' + def.unit + ')' : '') })) + '" data-points="' + all.length + '">' + g + '</svg>' + legend;
  }
  function trendOptions(vitals, checkups) {
    var html = '<optgroup label="' + esc(TR('optVitals')) + '">' + HC.GROUPS.map(function (g) { return '<option value="g:' + g.key + '">' + esc(gLabel(g)) + '</option>'; }).join('') + '</optgroup>';
    var names = HC.labNames(checkups);
    if (names.length) html += '<optgroup label="' + esc(TR('optLabs')) + '">' + names.map(function (n) { return '<option value="l:' + esc(n) + '">' + esc(n) + '</option>'; }).join('') + '</optgroup>';
    return html;
  }
  function renderTrend(vitals, checkups, ranges) {
    var sel = $('trendSel');
    sel.innerHTML = trendOptions(vitals, checkups);
    if (!trend) {
      var first = HC.GROUPS.filter(function (g) { return HC.series(vitals, g.fields[0]).length; })[0];
      trend = 'g:' + (first ? first.key : 'weight');
    }
    if (!sel.querySelector('option[value="' + trend.replace(/"/g, '\\"') + '"]')) trend = 'g:weight';
    sel.value = trend;
    var def = null;
    if (trend.indexOf('g:') === 0) {
      var g = HC.GROUPS.filter(function (x) { return 'g:' + x.key === trend; })[0];
      def = {
        label: gLabel(g), unit: mUnit(g.fields[0]),
        series: g.fields.map(function (f) {
          var r = HC.rangeOf(f, ranges);
          return { name: mLabel(f), pts: HC.series(vitals, f).map(function (p) { return { t: p.at, v: p.v }; }), band: r && (r.lo != null || r.hi != null) ? r : null };
        })
      };
    } else {
      var name = trend.slice(2), pts = HC.labSeries(checkups, name), last = pts[pts.length - 1];
      def = { label: name, unit: last ? last.unit : '', series: [{ name: name, pts: pts.map(function (p) { return { t: HC.ictAt(p.date, 12, 0), v: p.v }; }), band: last && (last.lo != null || last.hi != null) ? { lo: last.lo, hi: last.hi } : null }] };
    }
    if (!def.series.some(function (s) { return s.pts.length; })) {
      $('chart').innerHTML = '<div class="empty">' + icon('chart-line') + '<p>' + esc(TR('noData')) + '</p></div>';
      return;
    }
    $('chart').innerHTML = chartHtml(def);
  }

  /* ── ประวัติสัญญาณชีพ ── */
  function renderVitals(vitals, ranges) {
    var rows = vitals.slice().sort(function (a, b) { return b.at - a.at; }).slice(0, VIEW_LIMIT);
    if (!rows.length) { $('vList').innerHTML = '<div class="empty">' + icon('heart-pulse') + '<p>' + esc(TR('noEntries')) + '</p></div>'; return; }
    $('vList').innerHTML = '<div class="list">' + rows.map(function (r) {
      var parts = [], badges = '';
      if (r.weight != null) parts.push(TR('pWeight', { v: num(r.weight, 1) }));
      if (r.sys != null || r.dia != null) parts.push(TR('pBp', { a: r.sys != null ? num(r.sys) : '–', b: r.dia != null ? num(r.dia) : '–' }));
      if (r.hr != null) parts.push(TR('pHr', { v: num(r.hr) }));
      if (r.glu != null) parts.push(TR('pGlu', { v: num(r.glu) }));
      if (r.waist != null) parts.push(TR('pWaist', { v: num(r.waist, 1) }));
      HC.METRIC_KEYS.forEach(function (k) {
        if (r[k] == null) return;
        var rg = HC.rangeOf(k, ranges), st = HC.status(r[k], rg);
        if (st === 'warn' || st === 'err') badges += statusBadge(st, mLabel(k) + (I18N && I18N.lang() === 'en' ? ' ' : '') + dirLabel(r[k], rg));
      });
      return '<div class="list-row" data-id="' + esc(r.id) + '"><span class="lead">' + icon('heart-pulse') + '</span>' +
        '<div class="grow"><div class="title">' + esc(dayTh(r.at) + ' · ' + timeOf(r.at)) + '</div><div class="meta">' + esc(parts.join(' · ') + (r.note ? ' · ' + r.note : '')) + '</div>' + (badges ? '<div class="links vbadges">' + badges + '</div>' : '') + '</div>' +
        '<div class="end"><button class="btn sm icon" type="button" data-act="edit" aria-label="' + esc(TR('edit')) + '">' + icon('pencil') + '</button></div></div>';
    }).join('') + '</div>';
  }

  /* ── ออกกำลังกาย (สรุปจาก HealthCalc.workoutSummary · แถวเขียนโดยหน้ากีฬา) ── */
  function weekBarsHtml(weeks, goal) {
    var th = window.OmeChartTheme ? window.OmeChartTheme.get() : null;
    if (!th) return '';
    var W = 640, H = 220, L = 46, R = 14, T = 12, B = 30, iw = W - L - R, ih = H - T - B;
    var top = Math.max(goal, Math.max.apply(null, weeks.map(function (w) { return w.minutes; }))) * 1.12;
    function Y(v) { return T + (top - v) / top * ih; }
    var bw = iw / weeks.length, g = '';
    niceTicks(0, top, 4).forEach(function (t) {
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(t) + '" y2="' + Y(t) + '" stroke="' + th.grid + '" stroke-width="1"/>' +
        '<text x="' + (L - 6) + '" y="' + (Y(t) + 4) + '" text-anchor="end" font-size="11" fill="' + th.textMuted + '">' + num(t) + '</text>';
    });
    weeks.forEach(function (w, i) {
      var x = L + i * bw + bw * 0.2, h = w.minutes / top * ih;
      g += '<rect x="' + x.toFixed(1) + '" y="' + (T + ih - h).toFixed(1) + '" width="' + (bw * 0.6).toFixed(1) + '" height="' + Math.max(h, 0).toFixed(1) + '" rx="3" fill="' + th.series[0] + '"><title>' + esc(TR('weekTitle', { d: ymdTh(w.start), m: num(w.minutes, 1) })) + '</title></rect>' +
        '<text x="' + (x + bw * 0.3).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="' + th.textMuted + '">' + esc(I18N ? I18N.date(new Date(HC.ictAt(w.start, 12, 0)), { day: 'numeric', month: 'short' }) : '') + '</text>';
    });
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(goal) + '" y2="' + Y(goal) + '" stroke="' + th.axis + '" stroke-width="1.5" stroke-dasharray="5 4"/>' +
      '<text x="' + (W - R) + '" y="' + (Y(goal) - 5) + '" text-anchor="end" font-size="11" fill="' + th.textMuted + '">' + esc(TR('goalLbl', { n: num(goal) })) + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(TR('wkAria', { n: goal })) + '" data-weeks="' + weeks.length + '">' + g + '</svg>';
  }
  function renderWorkouts(workouts, settings) {
    var s = HC.workoutSummary(workouts, settings, Date.now(), 8, 8);
    $('wkValue').innerHTML = num(s.weekMinutes, 1) + ' / ' + num(s.goal) + '<small>' + esc(TR('minThisWeek')) + '</small>';
    $('wkBadge').innerHTML = s.weekMinutes >= s.goal ? '<span class="badge ok">' + esc(TR('reached')) + '</span>' : '';
    $('wkBar').setAttribute('aria-valuenow', Math.min(100, s.pct));
    $('wkFill').style.width = Math.min(100, s.pct) + '%';
    $('wkChart').innerHTML = weekBarsHtml(s.weeks, s.goal);
    $('wkList').innerHTML = s.recent.length ? '<div class="list">' + s.recent.map(function (w) {
      var parts = [TR('minutes', { n: num(w.minutes, 1) })];
      if (w.distanceKm != null) parts.push(TR('km', { n: num(w.distanceKm, 2) }));
      if (w.kcal != null) parts.push(num(w.kcal) + ' kcal');
      return '<div class="list-row"><span class="lead">' + icon('dumbbell') + '</span><div class="grow"><div class="title">' + esc(workoutName(w.kind)) + '</div><div class="meta">' + esc(ymdTh(w.date) + ' · ' + parts.join(' · ')) + '</div></div></div>';
    }).join('') + '</div>' : '<div class="empty">' + icon('dumbbell') + '<p>' + esc(TR('noEntries')) + '</p></div>';
  }

  /* ── ยา ── */
  function renderMeds(meds, intake) {
    var now = Date.now(), today = HC.ictDate(now), doses = HC.todayDoses(meds, intake, now);
    $('medToday').innerHTML = doses.length ? '<div class="list" id="doseList">' + doses.map(function (d) {
      return '<div class="list-row' + (d.taken ? ' done' : '') + '" data-dose="' + esc(d.id) + '" data-med="' + esc(d.med.id) + '" data-time="' + d.time + '">' +
        '<span class="lead">' + icon(d.taken ? 'circle-check' : 'clock') + '</span>' +
        '<div class="grow"><div class="title">' + esc(d.med.name) + '</div><div class="meta">' + esc(TR('clock', { t: d.time })) + (d.med.dose ? ' · ' + esc(d.med.dose) : '') + '</div></div>' +
        '<div class="end">' + (d.late ? '<span class="badge warn">' + esc(TR('late')) + '</span>' : '') +
        '<button class="btn sm' + (d.taken ? '' : ' primary') + '" type="button" data-act="take" aria-pressed="' + d.taken + '">' + icon('check') + esc(TR('taken')) + '</button></div></div>';
    }).join('') + '</div>' : '';
    if (!meds.length) { $('medList').innerHTML = '<div class="empty">' + icon('clock') + '<p>' + esc(TR('noMeds')) + '</p></div>'; return; }
    var rows = meds.slice().sort(function (a, b) {
      var ea = a.end && a.end < today ? 1 : 0, eb = b.end && b.end < today ? 1 : 0;
      return ea - eb || String(a.name).localeCompare(String(b.name), 'th');
    });
    $('medList').innerHTML = (doses.length ? '<div class="sub-head">' + esc(TR('allMeds')) + '</div>' : '') + '<div class="list">' + rows.map(function (m) {
      var ended = m.end && m.end < today, upcoming = m.start && m.start > today;
      var span = [m.start ? TR('from', { d: ymdTh(m.start) }) : '', m.end ? TR('until', { d: ymdTh(m.end) }) : ''].filter(Boolean).join(' · ');
      return '<div class="list-row" data-med="' + esc(m.id) + '"><span class="lead">' + icon('bell') + '</span>' +
        '<div class="grow"><div class="title">' + esc(m.name) + (m.dose ? ' · ' + esc(m.dose) : '') + '</div><div class="meta">' + esc((m.times || []).join(', ') + (span ? ' · ' + span : '')) + '</div></div>' +
        '<div class="end">' + (ended ? '<span class="badge">' + esc(TR('ended')) + '</span>' : upcoming ? '<span class="badge info">' + esc(TR('notStarted')) + '</span>' : '') +
        '<button class="btn sm icon" type="button" data-act="edit" aria-label="' + esc(TR('edit')) + '">' + icon('pencil') + '</button></div></div>';
    }).join('') + '</div>';
  }

  /* ── ผลตรวจประจำปี ── */
  function renderCheckups(checkups) {
    var rows = checkups.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    if (!rows.length) { $('chkList').innerHTML = '<div class="empty">' + icon('clipboard-list') + '<p>' + esc(TR('noChk')) + '</p></div>'; return; }
    $('chkList').innerHTML = '<div class="list">' + rows.map(function (c) {
      var results = c.results || [], flagged = [];
      results.forEach(function (r) {
        var st = HC.labStatus(r);
        if (st === 'warn' || st === 'err') flagged.push('<span class="badge ' + st + '">' + esc(r.name + ' ' + num(r.value, 2)) + '</span>');
      });
      var nFiles = Array.isArray(c.files) ? c.files.length : 0;
      return '<div class="list-row" data-id="' + esc(c.id) + '"><span class="lead">' + icon('clipboard-list') + '</span>' +
        '<div class="grow"><div class="title">' + esc(ymdTh(c.date) + (c.place ? ' · ' + c.place : '')) + '</div><div class="meta">' + esc(TR('items', { n: num(results.length) })) + (c.note ? ' · ' + esc(c.note) : '') + '</div></div>' +
        '<div class="end">' + flagged.slice(0, 4).join('') + (flagged.length > 4 ? '<span class="badge">+' + (flagged.length - 4) + '</span>' : '') +
        (nFiles ? '<span class="badge" title="' + esc(TR('attachments')) + '">' + icon('file-text') + nFiles + '</span>' : '') +
        '<button class="btn sm icon" type="button" data-act="edit" aria-label="' + esc(TR('edit')) + '">' + icon('pencil') + '</button></div></div>';
    }).join('') + '</div>';
  }

  function renderAll() {
    var vitals = loadList(K.vitals), checkups = loadList(K.checkups), meds = loadList(K.meds), intake = loadList(K.intake);
    var ranges = loadObj(K.ranges), settings = loadObj(K.settings);
    renderKpis(vitals, ranges);
    renderTrend(vitals, checkups, ranges);
    renderVitals(vitals, ranges);
    renderMeds(meds, intake);
    renderCheckups(checkups);
    renderWorkouts(loadList(K.workouts), settings);
    // กินยา → การแจ้งเตือน (tanot-push.js ส่งเฉพาะเมื่อชุดเปลี่ยน · ทำงานเฉพาะ pages.dev)
    if (window.TanotPush) window.TanotPush.setReminders('health', HC.reminders(meds, settings, Date.now()));
  }

  /* ── ฟอร์มสัญญาณชีพ ── */
  var VFIELDS = { weight: 'vWeight', sys: 'vSys', dia: 'vDia', hr: 'vHr', glu: 'vGlu', waist: 'vWaist' };
  function resetVitalForm() {
    editingVital = null;
    $('vAt').value = localInput(Date.now());
    Object.keys(VFIELDS).forEach(function (k) { $(VFIELDS[k]).value = ''; });
    $('vNote').value = '';
    $('vMsg').textContent = '';
    $('vCancel').hidden = true; $('vDel').hidden = true;
    $('vSave').querySelector('span').textContent = TR('save');
    $('hVital').textContent = TR('hVital');
  }
  function editVital(r) {
    editingVital = r.id;
    $('vAt').value = localInput(r.at);
    Object.keys(VFIELDS).forEach(function (k) { $(VFIELDS[k]).value = r[k] != null ? r[k] : ''; });
    $('vNote').value = r.note || '';
    $('vMsg').textContent = '';
    $('vCancel').hidden = false; $('vDel').hidden = false;
    $('vSave').querySelector('span').textContent = TR('saveEdit');
    $('hVital').textContent = TR('editEntry');
    $('vForm').scrollIntoView({ block: 'nearest' });
  }
  $('vForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = { at: new Date($('vAt').value).getTime(), note: $('vNote').value };
    Object.keys(VFIELDS).forEach(function (k) { raw[k] = $(VFIELDS[k]).value; });
    var out = HC.cleanVital(raw, editingVital || newId());
    if (out.error) {
      $('vMsg').textContent = out.error === 'empty' ? TR('errEmpty') : out.error === 'at' ? TR('errAt') : TR('errRange', { label: mLabel(out.error) });
      return;
    }
    upsert(K.vitals, out.rec);
    resetVitalForm();
    renderAll();
  });
  $('vCancel').addEventListener('click', resetVitalForm);
  $('vDel').addEventListener('click', function () {
    if (!editingVital || !window.confirm(TR('confirmDelEntry'))) return;
    remove(K.vitals, editingVital);
    resetVitalForm();
    renderAll();
  });
  $('vList').addEventListener('click', function (e) {
    var row = e.target.closest('.list-row');
    if (!row) return;
    var r = loadList(K.vitals).filter(function (x) { return x.id === row.getAttribute('data-id'); })[0];
    if (r) editVital(r);
  });
  $('trendSel').addEventListener('change', function () { trend = this.value; renderAll(); });

  /* ── กินยาแล้ว ── */
  $('medToday').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act="take"]'), row = e.target.closest('[data-dose]');
    if (!b || !row) return;
    var id = row.getAttribute('data-dose'), list = loadList(K.intake);
    if (list.some(function (x) { return x.id === id; })) saveJson(K.intake, list.filter(function (x) { return x.id !== id; }));
    else {
      var m = loadList(K.meds).filter(function (x) { return x.id === row.getAttribute('data-med'); })[0];
      if (!m) return;
      list.push(HC.makeIntake(m, HC.ictDate(Date.now()), row.getAttribute('data-time'), Date.now()));
      saveJson(K.intake, list);
    }
    renderAll();
  });

  /* ── กล่องยา ── */
  function openDlg(d) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }
  function closeDlg(d) { if (d.close) d.close(); else d.removeAttribute('open'); }

  function renderTimes() {
    $('mTimes').innerHTML = med.times.map(function (t, i) {
      return '<span class="hl-time"><input class="input" type="time" value="' + esc(t) + '" data-ti="' + i + '" aria-label="' + esc(TR('timeAria')) + '"><button class="btn sm icon ghost" type="button" data-trm="' + i + '" aria-label="' + esc(TR('rmTime')) + '">' + icon('x') + '</button></span>';
    }).join('') + '<button class="btn sm" type="button" id="mTimeAdd">' + icon('plus') + esc(TR('addTime')) + '</button>';
  }
  function openMed(m) {
    medNew = !m;
    med = m ? JSON.parse(JSON.stringify(m)) : { id: newId(), times: ['08:00'] };
    $('medTitle').textContent = medNew ? TR('medNew') : TR('medEdit');
    $('mName').value = med.name || '';
    $('mDose').value = med.dose || '';
    $('mStart').value = med.start || HC.ictDate(Date.now());
    $('mEnd').value = med.end || '';
    $('mNote').value = med.note || '';
    $('mMsg').textContent = '';
    $('mDel').hidden = medNew;
    renderTimes();
    openDlg($('medDlg'));
  }
  $('mTimes').addEventListener('click', function (e) {
    if (e.target.closest('#mTimeAdd')) { med.times.push('12:00'); renderTimes(); return; }
    var b = e.target.closest('[data-trm]');
    if (b) { med.times.splice(+b.getAttribute('data-trm'), 1); renderTimes(); }
  });
  $('mTimes').addEventListener('change', function (e) {
    var i = e.target.getAttribute('data-ti');
    if (i != null) med.times[+i] = e.target.value;
  });
  $('medAdd').addEventListener('click', function () { openMed(null); });
  $('medList').addEventListener('click', function (e) {
    var row = e.target.closest('[data-med]');
    if (!row) return;
    var m = loadList(K.meds).filter(function (x) { return x.id === row.getAttribute('data-med'); })[0];
    if (m) openMed(m);
  });
  $('medForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var out = HC.cleanMed({ name: $('mName').value, dose: $('mDose').value, times: med.times, start: $('mStart').value, end: $('mEnd').value, note: $('mNote').value }, med.id);
    if (out.error) {
      $('mMsg').textContent = { name: TR('medErrName'), times: TR('medErrTimes'), range: TR('medErrRange'), start: TR('medErrStart'), end: TR('medErrEnd') }[out.error];
      return;
    }
    upsert(K.meds, out.rec);
    closeDlg($('medDlg'));
    renderAll();
  });
  $('mCancel').addEventListener('click', function () { closeDlg($('medDlg')); });
  $('mDel').addEventListener('click', function () {
    if (!window.confirm(TR('confirmDelMed'))) return;
    var id = med.id;
    remove(K.meds, id);
    saveJson(K.intake, loadList(K.intake).filter(function (x) { return x.med !== id; }));
    closeDlg($('medDlg'));
    renderAll();
  });

  /* ── กล่องผลตรวจ ── */
  var presetSel = $('labPreset');
  function fillPresets() {
    presetSel.innerHTML = '<option value="">' + esc(TR('labPreset')) + '</option>' + HC.LAB_PRESETS.map(function (p, i) { return '<option value="' + i + '">' + esc(TR('lab' + i) || p.name) + '</option>'; }).join('');
  }
  fillPresets();

  function labRow(r) {
    function inp(cls, v, ph, dec) { return '<input class="input" data-f="' + cls + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + ph + '" aria-label="' + ph + '" type="text"' + (dec ? ' inputmode="decimal"' : '') + ' autocomplete="off">'; }
    return '<div class="hl-lab">' + inp('name', r.name, TR('phName')) + inp('value', r.value, TR('phValue'), true) + inp('unit', r.unit, TR('phUnit')) + inp('lo', r.lo, TR('phLo'), true) + inp('hi', r.hi, TR('phHi'), true) +
      '<button class="btn sm icon ghost rm" type="button" data-lrm aria-label="' + esc(TR('rmRow')) + '">' + icon('x') + '</button></div>';
  }
  function addLabRow(r) { $('labRows').insertAdjacentHTML('beforeend', labRow(r || {})); }
  function readLabRows() {
    return Array.prototype.map.call($('labRows').querySelectorAll('.hl-lab'), function (row) {
      var o = {};
      Array.prototype.forEach.call(row.querySelectorAll('input'), function (i) { o[i.getAttribute('data-f')] = i.value; });
      return o;
    });
  }
  $('labAdd').addEventListener('click', function () { addLabRow(); });
  presetSel.addEventListener('change', function () {
    var p = HC.LAB_PRESETS[+this.value];
    this.dataset.pick = this.value;
    this.value = '';
    if (p) addLabRow({ name: TR('lab' + (+this.dataset.pick)) || p.name, unit: p.unit, lo: p.lo, hi: p.hi });
  });
  $('labRows').addEventListener('click', function (e) { var b = e.target.closest('[data-lrm]'); if (b) b.closest('.hl-lab').remove(); });

  function renderChkFiles() {
    var files = (chk && chk.files) || [];
    $('cFilesRow').hidden = !filesAvailable();
    $('cFiles').innerHTML = files.map(function (f) {
      return '<div class="file-row" data-fid="' + esc(f.id) + '">' + icon('file-text') +
        '<a href="/api/files?id=' + encodeURIComponent(f.id) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' +
        '<span class="sz">' + num(f.size / 1024) + ' KB</span>' +
        '<button class="btn sm icon ghost" type="button" data-rm="' + esc(f.id) + '" aria-label="' + esc(TR('rmFile')) + '">' + icon('x') + '</button></div>';
    }).join('');
  }
  function openChk(c) {
    chkNew = !c;
    chk = c ? JSON.parse(JSON.stringify(c)) : { id: newId(), files: [] };
    if (!Array.isArray(chk.files)) chk.files = [];
    addedFiles = []; removedFiles = [];
    $('chkTitle').textContent = chkNew ? TR('chkNew') : TR('chkEdit');
    $('cDate').value = chk.date || HC.ictDate(Date.now());
    $('cPlace').value = chk.place || '';
    $('cNote').value = chk.note || '';
    $('labRows').innerHTML = '';
    (chk.results && chk.results.length ? chk.results : [{}]).forEach(addLabRow);
    $('cMsg').textContent = '';
    $('cDel').hidden = chkNew;
    renderChkFiles();
    openDlg($('chkDlg'));
  }
  $('chkAdd').addEventListener('click', function () { openChk(null); });
  $('chkList').addEventListener('click', function (e) {
    var row = e.target.closest('.list-row');
    if (!row) return;
    var c = loadList(K.checkups).filter(function (x) { return x.id === row.getAttribute('data-id'); })[0];
    if (c) openChk(c);
  });

  function api(method, qs, opts) { return fetch('/api/files?' + qs, Object.assign({ method: method, credentials: 'same-origin' }, opts || {})); }
  function deleteRemote(ids) { return Promise.all(ids.map(function (id) { return api('DELETE', 'id=' + encodeURIComponent(id)).catch(function () {}); })); }
  var MIME_BY_EXT = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif' };
  function mimeOf(f) {
    if (f.type) return f.type;
    var m = /\.([a-z0-9]+)$/i.exec(f.name || '');
    return (m && MIME_BY_EXT[m[1].toLowerCase()]) || '';
  }
  function uploadOne(f) {
    var mime = mimeOf(f);
    if (!mime) return Promise.reject(new Error(TR('onlyPdf')));
    if (f.size > MAX_FILE) return Promise.reject(new Error(TR('tooBig', { name: f.name })));
    return api('POST', 'ns=health&ref=' + encodeURIComponent(chk.id) + '&name=' + encodeURIComponent(f.name), { headers: { 'Content-Type': mime }, body: f })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.error || TR('uploadFailCode', { s: r.status }));
          return j;
        });
      });
  }
  $('cAttach').addEventListener('click', function () { $('cFileInput').click(); });
  $('cFileInput').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files || []);
    this.value = '';
    if (!files.length) return;
    $('cMsg').textContent = '';
    $('cAttach').disabled = true;
    files.reduce(function (chain, f) {
      return chain.then(function () {
        return uploadOne(f).then(function (j) {
          chk.files.push({ id: j.id, name: j.name, size: j.size, mime: j.mime });
          addedFiles.push(j.id);
          renderChkFiles();
        }).catch(function (e) { $('cMsg').textContent = e.message || TR('uploadFail'); });
      });
    }, Promise.resolve()).then(function () { $('cAttach').disabled = false; });
  });
  $('cFiles').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]');
    if (!b) return;
    var id = b.getAttribute('data-rm');
    chk.files = chk.files.filter(function (f) { return f.id !== id; });
    if (addedFiles.indexOf(id) !== -1) { addedFiles = addedFiles.filter(function (x) { return x !== id; }); deleteRemote([id]); }
    else removedFiles.push(id);
    renderChkFiles();
  });
  $('chkForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var out = HC.cleanCheckup({ date: $('cDate').value, place: $('cPlace').value, note: $('cNote').value, results: readLabRows(), files: chk.files }, chk.id);
    if (out.error) { $('cMsg').textContent = out.error === 'date' ? TR('errDate') : TR('errChk'); return; }
    upsert(K.checkups, out.rec);
    var gone = removedFiles; removedFiles = []; addedFiles = [];
    closeDlg($('chkDlg'));
    deleteRemote(gone);
    renderAll();
  });
  $('cCancel').addEventListener('click', function () { closeDlg($('chkDlg')); });
  $('chkDlg').addEventListener('close', function () {
    // ปิดโดยไม่บันทึก — ไฟล์ที่เพิ่งอัปโหลดในกล่องนี้ไม่มีใครอ้างถึง ลบทิ้งจาก R2
    if (addedFiles.length) { deleteRemote(addedFiles); addedFiles = []; }
    removedFiles = [];
  });
  $('cDel').addEventListener('click', function () {
    if (!chk || !window.confirm(TR('confirmDelChk'))) return;
    var id = chk.id, orig = loadList(K.checkups).filter(function (x) { return x.id === id; })[0];
    var ids = ((orig && orig.files) || []).map(function (f) { return f.id; }).concat(addedFiles);
    addedFiles = []; removedFiles = [];
    remove(K.checkups, id);
    closeDlg($('chkDlg'));
    deleteRemote(ids);
    renderAll();
  });

  /* ── ตั้งค่า: ซ่อนชื่อยาในแจ้งเตือน + ช่วงปกติ ── */
  var RANGE_KEYS = ['weight', 'sys', 'dia', 'hr', 'glu', 'waist'];
  function openSettings() {
    var ranges = loadObj(K.ranges);
    $('sHide').checked = HC.hideNames(loadObj(K.settings));
    $('sGoal').value = HC.workoutGoal(loadObj(K.settings));
    $('rangeRows').innerHTML = RANGE_KEYS.map(function (k) {
      var r = HC.rangeOf(k, ranges), m = HC.METRICS[k];
      return '<span>' + esc(mLabel(k)) + ' <small>' + esc(mUnit(k)) + '</small></span>' +
        '<input data-rk="' + k + '" data-b="lo" type="text" inputmode="decimal" value="' + (r.lo == null ? '' : r.lo) + '" aria-label="' + esc(TR('rangeLo', { label: mLabel(k) })) + '" class="input">' +
        '<input data-rk="' + k + '" data-b="hi" type="text" inputmode="decimal" value="' + (r.hi == null ? '' : r.hi) + '" aria-label="' + esc(TR('rangeHi', { label: mLabel(k) })) + '" class="input">';
    }).join('');
    openDlg($('setDlg'));
  }
  $('setBtn').addEventListener('click', openSettings);
  $('sCancel').addEventListener('click', function () { closeDlg($('setDlg')); });
  $('sReset').addEventListener('click', function () { saveJson(K.ranges, {}); closeDlg($('setDlg')); renderAll(); });
  $('setForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var st = loadObj(K.settings);
    st.hideMedNames = $('sHide').checked;
    var goal = Number($('sGoal').value);
    if (goal >= 10 && goal <= 3000) { if (Math.round(goal) === HC.DEFAULT_WORKOUT_GOAL) delete st.workoutGoal; else st.workoutGoal = Math.round(goal); }
    saveJson(K.settings, st);
    var ranges = loadObj(K.ranges);
    RANGE_KEYS.forEach(function (k) {
      var lo = $('rangeRows').querySelector('[data-rk="' + k + '"][data-b="lo"]').value.trim();
      var hi = $('rangeRows').querySelector('[data-rk="' + k + '"][data-b="hi"]').value.trim();
      var def = HC.METRICS[k];
      var loN = lo === '' ? null : Number(lo), hiN = hi === '' ? null : Number(hi);
      if ((loN != null && !isFinite(loN)) || (hiN != null && !isFinite(hiN))) return;
      if (loN === def.lo && hiN === def.hi) delete ranges[k]; else ranges[k] = { lo: loN, hi: hiN };
    });
    saveJson(K.ranges, ranges);
    closeDlg($('setDlg'));
    renderAll();
  });

  resetVitalForm();
  renderAll();
  /* สลับภาษาสด: ข้อความใน HTML แปลโดย i18n.js เอง — ที่นี่วาดส่วนที่ JS สร้างใหม่ + ป้ายที่ขึ้นกับสถานะ (หัวฟอร์ม/ปุ่มบันทึก) */
  if (window.OME_LANG) window.OME_LANG.onChange(function () {
    fillPresets();
    $('vSave').querySelector('span').textContent = editingVital ? TR('saveEdit') : TR('save');
    $('hVital').textContent = editingVital ? TR('editEntry') : TR('hVital');
    if (!$('medDlg').open) $('medTitle').textContent = TR('hMeds');
    $('chkTitle').textContent = chk && $('chkDlg').open ? (chkNew ? TR('chkNew') : TR('chkEdit')) : TR('chkTitle');
    renderAll();
  });
  if (TD && TD.onChange) TD.onChange(function () { if (!anyDialogOpen()) renderAll(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !anyDialogOpen()) renderAll(); });
  if (window.OmeChartTheme) window.OmeChartTheme.onChange(function () { renderAll(); });
})();
