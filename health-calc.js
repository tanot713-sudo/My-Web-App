/* ══════════════════════════════════════════════════════════════════
   Tanot — สุขภาพ: ตรรกะล้วน (ไม่มี DOM/storage) · UMD — window.HealthCalc ในหน้า, require() ตรงๆ ใน tests/health.spec.js
   หน้า health.html / index.js (การ์ดสุขภาพ) ใช้ไฟล์นี้ร่วมกัน — ห้ามมีสูตรช่วงปกติ/ตารางกินยาของตัวเองที่อื่น

   คีย์ (localStorage, ลงทะเบียนใน data-registry.js ทั้งหมดเป็น sync):
     tanot:health:vitals   list idField 'id'  { id, at (ms), weight kg, sys, dia (mmHg), hr (ครั้ง/นาที), glu (mg/dL), waist (cm), note }
                           1 การบันทึก = 1 แถว (ช่องที่ไม่ได้วัดเว้นว่าง) — 2 เครื่องบันทึกพร้อมกันได้คนละแถว ไม่ทับกัน
     tanot:health:checkups list idField 'id'  { id, date 'YYYY-MM-DD', place, note, results: [{ name, value, unit, lo, hi }],
                           files: [{ id, name, size, mime }] (ตัวไฟล์อยู่ R2 ผ่าน /api/files?ns=health) }
     tanot:health:meds     list idField 'id'  { id, name, dose, times: ['08:00', …] (เวลาไทย), start, end ('YYYY-MM-DD', ว่าง = ไม่มีกำหนด), note }
     tanot:health:intake   list idField 'id'  { id: '<medId>|<YYYY-MM-DD>|<HH:MM>', med, date, time, at } — 1 แถวต่อ (ยา × วัน × เวลา)
                           id กำหนดตายตัวจากสามอย่างนั้น: 2 เครื่องกดกินพร้อมกัน = แถวเดียวกัน (ไม่ซ้ำ) · เอาออก = ลบแถว
     tanot:health:ranges   map                { sys|dia|hr|glu|waist|weight: { lo, hi } } เฉพาะค่าที่ผู้ใช้แก้ (ว่าง = ใช้ค่าเริ่มต้นด้านล่าง)
     tanot:health:settings blob               { hideMedNames: true (ค่าเริ่มต้น) }
     tanot:health:workouts list idField 'id'  จุดเชื่อมสำหรับหน้ากีฬา (ยังไม่มีใครเขียน — ดู CLAUDE.md หัวข้อ Health)

   "วัน" ของยา/การแจ้งเตือนนับตามเวลาไทย (UTC+7) เหมือน functions/_lib/reminders.js
   ช่วงอ้างอิงเริ่มต้นเป็นค่าทั่วไปของผู้ใหญ่ (ไม่ใช่คำวินิจฉัย) — ผู้ใช้แก้เองได้ในหน้า
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HealthCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ICT_MS = 7 * 3600 * 1000, DAY_MS = 86400000;

  /* ── ค่าที่วัด ──
     lo/hi = ช่วงปกติเริ่มต้น · errPct = ออกนอกช่วงเกินกี่ส่วนของเกณฑ์ถึงเป็น 'err' (ไม่เกินนั้นเป็น 'warn')
     min/max = กันพิมพ์ผิด (ค่านอกนี้ไม่รับ) · weight ไม่มีช่วงเริ่มต้น (ขึ้นกับส่วนสูง) */
  var METRICS = {
    weight: { label: 'น้ำหนัก', unit: 'กก.', lo: null, hi: null, errPct: 0.2, min: 1, max: 500, dec: 1 },
    sys:    { label: 'ความดันตัวบน', unit: 'mmHg', lo: 90, hi: 120, errPct: 0.15, min: 40, max: 300, dec: 0 },
    dia:    { label: 'ความดันตัวล่าง', unit: 'mmHg', lo: 60, hi: 80, errPct: 0.15, min: 20, max: 200, dec: 0 },
    hr:     { label: 'ชีพจร', unit: 'ครั้ง/นาที', lo: 60, hi: 100, errPct: 0.2, min: 20, max: 250, dec: 0 },
    glu:    { label: 'น้ำตาลในเลือด', unit: 'mg/dL', lo: 70, hi: 100, errPct: 0.25, min: 10, max: 1500, dec: 0 },
    waist:  { label: 'รอบเอว', unit: 'ซม.', lo: null, hi: 90, errPct: 0.1, min: 20, max: 300, dec: 1 }
  };
  var METRIC_KEYS = ['weight', 'sys', 'dia', 'hr', 'glu', 'waist'];
  // กลุ่มที่แสดงเป็น 1 การ์ด/1 กราฟ
  var GROUPS = [
    { key: 'weight', label: 'น้ำหนัก', fields: ['weight'] },
    { key: 'bp', label: 'ความดัน', fields: ['sys', 'dia'] },
    { key: 'hr', label: 'ชีพจร', fields: ['hr'] },
    { key: 'glu', label: 'น้ำตาล', fields: ['glu'] },
    { key: 'waist', label: 'รอบเอว', fields: ['waist'] }
  ];

  /* รายการผลแล็บที่พบบ่อย — ใช้เติมแถวในใบผลตรวจ (ช่วงอ้างอิงทั่วไปของผู้ใหญ่ ห้องแล็บแต่ละแห่งต่างกันเล็กน้อย → แก้ได้) */
  var LAB_PRESETS = [
    { name: 'น้ำตาลหลังอดอาหาร (FBS)', unit: 'mg/dL', lo: 70, hi: 100 },
    { name: 'HbA1c', unit: '%', lo: 4, hi: 5.6 },
    { name: 'คอเลสเตอรอลรวม', unit: 'mg/dL', lo: null, hi: 200 },
    { name: 'LDL', unit: 'mg/dL', lo: null, hi: 130 },
    { name: 'HDL', unit: 'mg/dL', lo: 40, hi: null },
    { name: 'ไตรกลีเซอไรด์', unit: 'mg/dL', lo: null, hi: 150 },
    { name: 'ครีเอตินิน', unit: 'mg/dL', lo: 0.6, hi: 1.3 },
    { name: 'eGFR', unit: 'mL/min/1.73m²', lo: 90, hi: null },
    { name: 'ALT (SGPT)', unit: 'U/L', lo: null, hi: 40 },
    { name: 'AST (SGOT)', unit: 'U/L', lo: null, hi: 40 },
    { name: 'กรดยูริก', unit: 'mg/dL', lo: 3.5, hi: 7.2 },
    { name: 'ฮีโมโกลบิน (Hb)', unit: 'g/dL', lo: 12, hi: 16 }
  ];

  function numOrNull(v) {
    if (v === '' || v == null) return null;
    var n = Number(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : null;
  }

  /* ── ช่วงปกติ ── */
  /** { lo, hi, errPct } ของค่าที่วัด: ผู้ใช้แก้ (overrides[key]) ชนะค่าเริ่มต้น · ช่องที่ผู้ใช้เว้นว่าง = ไม่มีเกณฑ์ด้านนั้น */
  function rangeOf(key, overrides) {
    var m = METRICS[key];
    if (!m) return null;
    var o = overrides && overrides[key];
    if (o && typeof o === 'object' && ('lo' in o || 'hi' in o)) return { lo: numOrNull(o.lo), hi: numOrNull(o.hi), errPct: m.errPct };
    return { lo: m.lo, hi: m.hi, errPct: m.errPct };
  }

  /** 'ok' | 'warn' | 'err' | null (ไม่มีเกณฑ์/ไม่ใช่ตัวเลข) — ออกนอกช่วงเกิน errPct ของเกณฑ์ที่ผ่าน = err, ไม่เกิน = warn */
  function status(value, range) {
    var v = numOrNull(value);
    if (v == null || !range) return null;
    var lo = numOrNull(range.lo), hi = numOrNull(range.hi);
    if (lo == null && hi == null) return null;
    var pct = range.errPct == null ? 0.2 : range.errPct, dev = 0, bound = 0;
    if (lo != null && v < lo) { dev = lo - v; bound = lo; }
    else if (hi != null && v > hi) { dev = v - hi; bound = hi; }
    else return 'ok';
    return bound > 0 && dev > bound * pct ? 'err' : 'warn';
  }

  function rangeText(range) {
    if (!range) return '';
    var lo = numOrNull(range.lo), hi = numOrNull(range.hi);
    if (lo != null && hi != null) return lo + '–' + hi;
    if (hi != null) return '≤ ' + hi;
    if (lo != null) return '≥ ' + lo;
    return '';
  }

  /* ── สัญญาณชีพ ── */
  /** แปลงค่าจากฟอร์ม → แถวที่เก็บ · คืน { rec } หรือ { error } (ไม่มีค่าเลย / ค่าเพี้ยนเกินจริง) */
  function cleanVital(raw, id) {
    var rec = { id: id || raw.id, at: Number(raw.at) || 0 };
    var any = false;
    for (var i = 0; i < METRIC_KEYS.length; i++) {
      var k = METRIC_KEYS[i], v = numOrNull(raw[k]);
      if (v == null) continue;
      var m = METRICS[k];
      if (v < m.min || v > m.max) return { error: k };
      rec[k] = Math.round(v * 100) / 100;
      any = true;
    }
    if (!any) return { error: 'empty' };
    if (!rec.at) return { error: 'at' };
    var note = String(raw.note || '').trim().slice(0, 200);
    if (note) rec.note = note;
    return { rec: rec };
  }

  /** ค่าของ key เรียงเวลาเก่า→ใหม่ [{ at, v, id }] (ข้ามแถวที่ไม่ได้วัดค่านั้น) */
  function series(vitals, key) {
    var out = [];
    (vitals || []).forEach(function (r) {
      var v = r && numOrNull(r[key]);
      if (v != null && r.at) out.push({ at: Number(r.at), v: v, id: r.id });
    });
    out.sort(function (a, b) { return a.at - b.at || String(a.id).localeCompare(String(b.id)); });
    return out;
  }

  /** ค่าล่าสุดเทียบครั้งก่อน (นับเฉพาะแถวที่วัดค่านั้น) → { last, prev, delta } หรือ null ถ้าไม่เคยวัด */
  function compare(vitals, key) {
    var s = series(vitals, key);
    if (!s.length) return null;
    var last = s[s.length - 1], prev = s.length > 1 ? s[s.length - 2] : null;
    return { last: last, prev: prev, delta: prev ? Math.round((last.v - prev.v) * 100) / 100 : null };
  }

  /* ── ผลตรวจประจำปี ── */
  function cleanCheckup(raw, id) {
    var date = String(raw.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'date' };
    var results = [];
    (raw.results || []).forEach(function (r) {
      var name = String((r && r.name) || '').trim().slice(0, 80), v = numOrNull(r && r.value);
      if (!name || v == null) return;
      results.push({ name: name, value: v, unit: String(r.unit || '').trim().slice(0, 24), lo: numOrNull(r.lo), hi: numOrNull(r.hi) });
    });
    var files = Array.isArray(raw.files) ? raw.files : [];
    if (!results.length && !files.length) return { error: 'empty' };
    return { rec: { id: id || raw.id, date: date, place: String(raw.place || '').trim().slice(0, 80), note: String(raw.note || '').trim().slice(0, 300), results: results, files: files } };
  }

  function labStatus(r) { return status(r && r.value, r && { lo: r.lo, hi: r.hi, errPct: 0.2 }); }

  function labKey(name) { return String(name || '').trim().toLowerCase(); }

  /** ชื่อผลแล็บทั้งหมดที่เคยบันทึก (ไม่ซ้ำ ไม่สนตัวพิมพ์) เรียงตามชื่อ */
  function labNames(checkups) {
    var seen = {}, out = [];
    (checkups || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).forEach(function (c) { // ชื่อที่สะกดตามครั้งล่าสุด
      ((c && c.results) || []).forEach(function (r) {
        var k = labKey(r.name);
        if (k && !seen[k]) { seen[k] = 1; out.push(String(r.name).trim()); }
      });
    });
    return out.sort(function (a, b) { return a.localeCompare(b, 'th'); });
  }

  /** ค่าของผลแล็บชื่อนั้นต่อครั้งที่ตรวจ เรียงวันที่เก่า→ใหม่ [{ date, v, unit, lo, hi, checkup }] */
  function labSeries(checkups, name) {
    var k = labKey(name), out = [];
    (checkups || []).forEach(function (c) {
      ((c && c.results) || []).forEach(function (r) {
        if (labKey(r.name) === k && numOrNull(r.value) != null) out.push({ date: c.date, v: Number(r.value), unit: r.unit || '', lo: numOrNull(r.lo), hi: numOrNull(r.hi), checkup: c.id });
      });
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out;
  }

  /* ── ยา ── */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /** 'YYYY-MM-DD' ตามเวลาไทยของ ms */
  function ictDate(ms) {
    var d = new Date(ms + ICT_MS);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  /** epoch ms ของวัน 'YYYY-MM-DD' เวลา hh:mm เวลาไทย (NaN ถ้ารูปแบบผิด) */
  function ictAt(ymd, hh, mm) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    if (!m) return NaN;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], hh || 0, mm || 0) - ICT_MS;
  }
  function parseTime(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
    if (!m || +m[1] > 23 || +m[2] > 59) return null;
    return { h: +m[1], m: +m[2], key: pad(+m[1]) + ':' + m[2] };
  }
  /** เวลากินที่ใช้ได้ ไม่ซ้ำ เรียงจากเช้า→ดึก ('HH:MM') */
  function cleanTimes(times) {
    var seen = {}, out = [];
    (times || []).forEach(function (t) {
      var p = parseTime(t);
      if (p && !seen[p.key]) { seen[p.key] = 1; out.push(p.key); }
    });
    return out.sort();
  }

  function cleanMed(raw, id) {
    var name = String(raw.name || '').trim().slice(0, 80);
    if (!name) return { error: 'name' };
    var times = cleanTimes(raw.times);
    if (!times.length) return { error: 'times' };
    var start = String(raw.start || ''), end = String(raw.end || '');
    if (start && isNaN(ictAt(start))) return { error: 'start' };
    if (end && isNaN(ictAt(end))) return { error: 'end' };
    if (start && end && end < start) return { error: 'range' };
    return { rec: { id: id || raw.id, name: name, dose: String(raw.dose || '').trim().slice(0, 60), times: times, start: start, end: end, note: String(raw.note || '').trim().slice(0, 200) } };
  }

  /** ยานี้ต้องกินในวัน ymd ไหม (อยู่ในช่วง start..end) */
  function activeOn(med, ymd) {
    return !!med && (!med.start || ymd >= med.start) && (!med.end || ymd <= med.end);
  }
  function intakeId(medId, ymd, time) { return medId + '|' + ymd + '|' + time; }

  /** มื้อยาของวัน ymd ทั้งหมด [{ med, time, id }] เรียงตามเวลา แล้วชื่อยา */
  function dosesOn(meds, ymd) {
    var out = [];
    (meds || []).forEach(function (med) {
      if (!med || !med.id || !activeOn(med, ymd)) return;
      cleanTimes(med.times).forEach(function (t) { out.push({ med: med, time: t, id: intakeId(med.id, ymd, t) }); });
    });
    out.sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : String(a.med.name).localeCompare(String(b.med.name), 'th'); });
    return out;
  }

  /** มื้อยาของ "วันนี้" (ไทย) พร้อมสถานะ: taken (มีแถว intake), late (เลยเวลาแล้วยังไม่กิน) */
  function todayDoses(meds, intake, nowMs) {
    var ymd = ictDate(nowMs), taken = {};
    (intake || []).forEach(function (r) { if (r && r.id) taken[r.id] = true; });
    return dosesOn(meds, ymd).map(function (d) {
      var isTaken = !!taken[d.id], p = parseTime(d.time);
      return { med: d.med, time: d.time, id: d.id, date: ymd, taken: isTaken, late: !isTaken && ictAt(ymd, p.h, p.m) < nowMs };
    });
  }

  /** แถว intake ของมื้อที่กดว่ากินแล้ว (id ตายตัว) */
  function makeIntake(med, ymd, time, nowMs) {
    return { id: intakeId(med.id, ymd, time), med: med.id, date: ymd, time: time, at: nowMs };
  }

  /* ── การแจ้งเตือนกินยา (tanot-push.js → ตาราง reminders scope 'health') ──
     ยาไม่มีวันสิ้นสุด = 1 แถวต่อ (ยา × เวลา) แบบ repeat 'daily'
     ยามีวันสิ้นสุด = แตกเป็นแถวรายวัน (ไม่ repeat) จนถึงวันสุดท้ายของยา → หมดแล้วเลิกเตือนเองแม้ไม่ได้เปิดหน้านี้อีก
       (งบ MAX_ITEMS ของเซิร์ฟเวอร์ 200 แถวต่อ scope — คอร์สที่เหลือสั้นสุดได้แตกก่อน ที่เหลือเกินงบใช้ repeat 'daily'
        แล้วหน้านี้ลงทะเบียนใหม่ทุกครั้งที่เปิด/ข้อมูลเปลี่ยน ซึ่งจะตัดออกเมื่อเลยวันสิ้นสุด)
     รอบแรก = เวลานั้นของวันนี้ถ้ายังไม่ถึง ไม่งั้นพรุ่งนี้ (ต้องตรงกับที่ scheduler เลื่อนให้ — advance() ของ reminders.js)
     ซ่อนชื่อยา (ค่าเริ่มต้น): ข้อความบนหน้าจอล็อกมีแค่ "ถึงเวลากินยา" · id ใช้รหัสยา ไม่มีชื่อ */
  var ITEM_BUDGET = 150; // เหลือที่ว่างให้ scope อื่นไม่เกี่ยวกัน (จำกัดต่อ scope) แต่กันไม่ให้ชนเพดาน 200
  function hideNames(settings) { return !(settings && settings.hideMedNames === false); }

  function reminders(meds, settings, nowMs) {
    var hide = hideNames(settings), out = [], today = ictDate(nowMs);
    var courses = [];
    (meds || []).forEach(function (med) {
      if (!med || !med.id) return;
      cleanTimes(med.times).forEach(function (t) {
        var p = parseTime(t), first = ictAt(today, p.h, p.m);
        if (first <= nowMs) first += DAY_MS;
        if (med.start) first = Math.max(first, ictAt(med.start, p.h, p.m));
        var last = med.end ? ictAt(med.end, p.h, p.m) : null;
        if (last != null && first > last) return; // คอร์สจบแล้ว
        courses.push({ med: med, time: t, first: first, last: last, n: last == null ? 0 : Math.floor((last - first) / DAY_MS) + 1 });
      });
    });
    function base(c, id, due, repeat) {
      var it = { id: id, title: 'ถึงเวลากินยา', url: 'health.html', due_at: due, kind: 'push' };
      if (!hide) it.body = c.med.name + (c.med.dose ? ' · ' + c.med.dose : '') + ' · ' + c.time;
      if (repeat) it.repeat = repeat;
      return it;
    }
    var budget = ITEM_BUDGET;
    courses.slice().sort(function (a, b) { return (a.n || 1e9) - (b.n || 1e9); }).forEach(function (c) {
      var key = 'med:' + c.med.id + ':' + c.time.replace(':', '');
      if (c.last != null && c.n <= budget) {
        budget -= c.n;
        for (var i = 0; i < c.n; i++) out.push(base(c, key + ':' + ictDate(c.first + i * DAY_MS), c.first + i * DAY_MS, null));
      } else {
        out.push(base(c, key, c.first, 'daily'));
      }
    });
    out.sort(function (a, b) { return a.due_at - b.due_at || (a.id < b.id ? -1 : 1); });
    return out;
  }

  /* ── สรุปสำหรับหน้าวันนี้ ── */
  /** { latest: { key: { v, at } }, pending: [มื้อที่ยังไม่ได้กินวันนี้], total, taken } */
  function summary(vitals, meds, intake, nowMs) {
    var latest = {};
    METRIC_KEYS.forEach(function (k) {
      var c = compare(vitals, k);
      if (c) latest[k] = { v: c.last.v, at: c.last.at, delta: c.delta };
    });
    var doses = todayDoses(meds, intake, nowMs);
    return { latest: latest, doses: doses, pending: doses.filter(function (d) { return !d.taken; }), total: doses.length, taken: doses.filter(function (d) { return d.taken; }).length };
  }

  return {
    METRICS: METRICS, METRIC_KEYS: METRIC_KEYS, GROUPS: GROUPS, LAB_PRESETS: LAB_PRESETS, ITEM_BUDGET: ITEM_BUDGET,
    rangeOf: rangeOf, status: status, rangeText: rangeText,
    cleanVital: cleanVital, series: series, compare: compare,
    cleanCheckup: cleanCheckup, labStatus: labStatus, labNames: labNames, labSeries: labSeries,
    ictDate: ictDate, ictAt: ictAt, parseTime: parseTime, cleanTimes: cleanTimes,
    cleanMed: cleanMed, activeOn: activeOn, intakeId: intakeId, dosesOn: dosesOn, todayDoses: todayDoses, makeIntake: makeIntake,
    hideNames: hideNames, reminders: reminders, summary: summary
  };
});
