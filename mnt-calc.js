/* ══════════════════════════════════════════════════════════════════
   mnt-calc.js — ตรรกะล้วนของบันทึกงานบำรุงรักษา (ไม่มี DOM / storage) — ดู docs/maintenance-design.md หัวข้อ 3–4, 7
   ใช้ร่วมกันใน maintenance.js, index.js (การ์ดหน้าวันนี้), report-dashboard (เปิดตรง) และ tests/maintenance.spec.js (require)
   วันที่ = 'YYYY-MM-DD' เวลาท้องถิ่น · เวลา = ms epoch · รหัสความถี่ใช้ชุดเดียวกับ est-cost: Daily, Weekly, M1, M3, M6, Annually
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MntCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FREQS = ['Daily', 'Weekly', 'M1', 'M3', 'M6', 'Annually'];
  var FREQ_LABEL = { Daily: 'รายวัน', Weekly: 'รายสัปดาห์', M1: 'รายเดือน', M3: 'ราย 3 เดือน', M6: 'ราย 6 เดือน', Annually: 'รายปี' };
  var STEP = { M3: 3, M6: 6, Annually: 12 };
  var PM_FREQS_DEFAULT = ['M1', 'M3', 'M6', 'Annually'];

  /* ── ตัวช่วยทั่วไป ───────────────────────────────────────────── */
  function pad(n, w) { var s = String(n); while (s.length < (w || 2)) s = '0' + s; return s; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }
  function toYmd(v) {
    if (v instanceof Date) return ymd(v);
    if (typeof v === 'number') return ymd(new Date(v));
    return String(v || '').slice(0, 10);
  }
  function ymOf(s) { return String(s).slice(0, 7); }
  function addMonths(ym, n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }
  function monthDiff(a, b) { return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); }
  function addDays(s, n) { var d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
  function daysBetween(a, b) { // b − a เป็นวัน (ตัดผลของเวลาออมแสงด้วย round)
    return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);
  }
  function endOfDayMs(s) { var d = parseYmd(s); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - 1; }

  var uidCount = 0;
  function uid(prefix) {
    var r = '';
    for (var i = 0; i < 4; i++) r += Math.floor(Math.random() * 36).toString(36);
    return (prefix || '') + Date.now().toString(36) + r + (uidCount++ % 36).toString(36);
  }
  function fnv1a36(str) {
    var h = 0x811c9dc5;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }
  function uniqueCode(base, taken) { // taken = Set หรือ object ของ key ตัวพิมพ์เล็ก
    var has = function (k) { return taken && (typeof taken.has === 'function' ? taken.has(k) : !!taken[k]); };
    if (!has(String(base).toLowerCase())) return base;
    for (var n = 2; n < 10000; n++) if (!has((base + '-' + n).toLowerCase())) return base + '-' + n;
    return base + '-' + Date.now().toString(36);
  }
  var B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function woNo(kind, at, rnd) { // 'CM-261002-K7Q' — ไม่มีตัวนับต่อเครื่อง จึงไม่ชนข้ามเครื่อง
    var d = at instanceof Date ? at : new Date(at || Date.now());
    var r = '';
    for (var i = 0; i < 3; i++) r += B32.charAt(rnd ? rnd[i] % 32 : Math.floor(Math.random() * 32));
    return String(kind || 'cm').toUpperCase() + '-' + pad(d.getFullYear() % 100) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + r;
  }
  function inspId(site, freq, period, dev) { return site + '|' + freq + '|' + period + '|' + dev; }

  /* ── รอบ / ช่วงเวลา ───────────────────────────────────────────── */
  function mondayOf(s) {
    var d = parseYmd(s);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return ymd(d);
  }
  function periodOf(freq, date) {
    var s = toYmd(date);
    if (freq === 'Daily') return s;
    if (freq === 'Weekly') return mondayOf(s);
    return ymOf(s);
  }
  function monthEnd(ym) { return ymd(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0)); }
  function window_(freq, period) {
    if (freq === 'Daily') return { start: period, end: period };
    if (freq === 'Weekly') return { start: period, end: addDays(period, 6) };
    return { start: period + '-01', end: monthEnd(period) };
  }
  function periodYear(period) { return Number(String(period).slice(0, 4)); }

  /* เดือนที่ครบรอบของ M1/M3/M6/Annually: M1 ทุกเดือน ≥ startMonth · ที่เหลือ = startMonth + (phase−1) + k·step, k ≥ 0 */
  function dueMonths(freq, phase, startMonth, fromMonth, toMonth) {
    var out = [], m;
    if (!startMonth) return out;
    if (freq === 'M1') {
      for (m = fromMonth < startMonth ? startMonth : fromMonth; m <= toMonth; m = addMonths(m, 1)) out.push(m);
      return out;
    }
    var step = STEP[freq];
    if (!step) return out;
    var first = addMonths(startMonth, (phase || 1) - 1);
    if (toMonth < first) return out;
    var skip = fromMonth > first ? Math.floor(monthDiff(first, fromMonth) / step) : 0;
    for (m = addMonths(first, skip * step); m <= toMonth; m = addMonths(m, step)) if (m >= fromMonth) out.push(m);
    return out;
  }

  function phaseOf(asset, freq) { return (asset && asset.phase && asset.phase[freq]) || 1; }

  /* period ที่ครบรอบ และช่วงเวลาของรอบนั้นทับกับ [fromDate, toDate] (Daily/Weekly ทุกช่วงตั้งแต่ startMonth) */
  function periods(asset, plan, settings, fromDate, toDate) {
    var from = toYmd(fromDate), to = toYmd(toDate), start = (settings && settings.startMonth) || '';
    var out = [], d, p;
    if (!start || from > to) return out;
    var startDate = start + '-01';
    if (plan.freq === 'Daily') {
      for (d = from < startDate ? startDate : from; d <= to; d = addDays(d, 1)) out.push(d);
    } else if (plan.freq === 'Weekly') {
      for (d = mondayOf(from < startDate ? startDate : from); d <= to; d = addDays(d, 7)) {
        if (addDays(d, 6) >= startDate) out.push(d);
      }
    } else {
      out = dueMonths(plan.freq, phaseOf(asset, plan.freq), start, ymOf(from), ymOf(to));
    }
    return out;
  }

  /* กระจายเดือนของ M3/M6/รายปี ให้ชั่วโมงสะสมแต่ละเดือนใกล้กัน (โลภ) — ผลคงที่ทุกครั้ง; ใช้เฉพาะ (อุปกรณ์, ความถี่) ที่ยังไม่มี phase
     phase ที่มีอยู่แล้วนับเป็นภาระตั้งต้น */
  function assignPhases(assets, plans) {
    var hours = {}; // type|freq → ชั่วโมง
    (plans || []).forEach(function (p) { if (STEP[p.freq]) hours[p.type + '|' + p.freq] = +p.hours || 0; });
    var load = []; for (var i = 0; i < 12; i++) load.push(0);
    function add(freq, phase, h) { for (var m = phase - 1; m < 12; m += STEP[freq]) load[m] += h; }
    var pending = [];
    (assets || []).forEach(function (a) {
      if (a.status === 'retired') return;
      ['M3', 'M6', 'Annually'].forEach(function (f) {
        var h = hours[a.type + '|' + f];
        if (h === undefined) return;
        if (a.phase && a.phase[f]) add(f, a.phase[f], h);
        else pending.push({ id: a.id, freq: f, h: h });
      });
    });
    pending.sort(function (x, y) {
      return y.h - x.h || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0) || (STEP[x.freq] - STEP[y.freq]);
    });
    var out = {};
    pending.forEach(function (t) {
      var best = 1, bestCost = Infinity;
      for (var p = 1; p <= STEP[t.freq]; p++) {
        var c = 0;
        for (var m = p - 1; m < 12; m += STEP[t.freq]) c += load[m];
        if (c < bestCost - 1e-9) { bestCost = c; best = p; }
      }
      add(t.freq, best, t.h);
      (out[t.id] = out[t.id] || {})[t.freq] = best;
    });
    return out;
  }

  /* ── สถานะรอบ ─────────────────────────────────────────────────── */
  function doneIndex(inspDocs) {
    var idx = new Map();
    (inspDocs || []).forEach(function (doc) {
      if (!doc || !doc.rows) return;
      var w = window_(doc.freq, doc.period), endMs = endOfDayMs(w.end);
      Object.keys(doc.rows).forEach(function (aid) {
        var r = doc.rows[aid], key = aid + '|' + doc.freq + '|' + doc.period;
        var cur = idx.get(key);
        if (cur && cur.at >= r.at) return;
        idx.set(key, { at: r.at, start: r.start, dev: doc.dev, by: doc.by || '', res: r.res || {}, note: r.note || '', late: r.at > endMs });
      });
    });
    return idx;
  }

  function status(asset, plan, period, done, today) {
    var d = done && done.get(asset.id + '|' + plan.freq + '|' + period);
    if (d) return d.late ? 'late-done' : 'done';
    var w = window_(plan.freq, period), t = toYmd(today);
    if (t > w.end) return 'overdue';
    if (t >= w.start) return 'due';
    return 'upcoming';
  }

  function plansByType(plans) {
    var m = {};
    (plans || []).forEach(function (p) { (m[p.type] = m[p.type] || []).push(p); });
    return m;
  }

  function dueList(o) {
    var today = toYmd(o.today || new Date()), ahead = o.ahead == null ? 7 : o.ahead, start = (o.settings && o.settings.startMonth) || '';
    var out = [];
    if (!start) return out;
    var byType = plansByType(o.plans), thisMonth = ymOf(today), prevMonth = addMonths(thisMonth, -1);
    var horizon = addDays(today, ahead);
    (o.assets || []).forEach(function (asset) {
      if (asset.status === 'retired') return;
      (byType[asset.type] || []).forEach(function (plan) {
        var f = plan.freq, cur, w, key;
        function push(period, state, daysLate) {
          out.push({ asset: asset, plan: plan, period: period, window: window_(f, period), state: state, daysLate: daysLate || 0 });
        }
        function isDone(period) { return !!(o.done && o.done.get(asset.id + '|' + f + '|' + period)); }
        // ถึงกำหนด: รอบที่ today ตกอยู่ และยังไม่ทำ
        var curPeriods = periods(asset, plan, o.settings, today, today);
        curPeriods.forEach(function (p) {
          w = window_(f, p);
          if (today >= w.start && today <= w.end && !isDone(p)) push(p, 'due');
        });
        if (f === 'Daily' || f === 'Weekly') return; // รายวัน/สัปดาห์ที่พลาดไม่ขึ้นเป็นงานค้าง (นับใน compliance)
        // เลยกำหนด: รอบล่าสุดที่จบไปแล้วและยังไม่ทำ
        var past = dueMonths(f, phaseOf(asset, f), start, start, prevMonth);
        if (past.length) {
          var lp = past[past.length - 1];
          if (!isDone(lp)) push(lp, 'overdue', daysBetween(window_(f, lp).end, today));
        }
        // ภายใน N วัน: รอบที่ช่วงเริ่มหลัง today แต่ไม่เกิน horizon (เฉพาะ M1 ขึ้นไป — รายวัน/สัปดาห์จะท่วมรายการ)
        dueMonths(f, phaseOf(asset, f), start, addMonths(thisMonth, 1), ymOf(horizon)).forEach(function (p) {
          w = window_(f, p);
          if (w.start > today && w.start <= horizon && !isDone(p)) push(p, 'upcoming');
        });
      });
    });
    var rank = { overdue: 0, due: 1, upcoming: 2 };
    out.sort(function (a, b) {
      return rank[a.state] - rank[b.state] ||
        (a.state === 'overdue' ? b.daysLate - a.daysLate : a.window.end < b.window.end ? -1 : a.window.end > b.window.end ? 1 : 0) ||
        (a.asset.code < b.asset.code ? -1 : a.asset.code > b.asset.code ? 1 : 0) ||
        (FREQS.indexOf(a.plan.freq) - FREQS.indexOf(b.plan.freq));
    });
    return out;
  }

  /* นับตามเดือนที่ช่วงรอบจบ · onTime = บันทึกภายในช่วง · late = หลังช่วงจบ · missed = ช่วงจบแล้วไม่มีบันทึก
     รอบที่ยังไม่จบและยังไม่ทำไม่นับ (ไม่ใช่ "พลาด") */
  function compliance(o) {
    var from = toYmd(o.from), to = toYmd(o.to), today = toYmd(o.today || new Date()), freqs = o.freqs || FREQS;
    var byType = plansByType(o.plans), acc = {}, rows = [];
    (o.assets || []).forEach(function (asset) {
      if (asset.status === 'retired') return;
      (byType[asset.type] || []).forEach(function (plan) {
        if (freqs.indexOf(plan.freq) === -1) return;
        periods(asset, plan, o.settings, from, to).forEach(function (p) {
          var w = window_(plan.freq, p);
          if (w.end < from || w.end > to) return;
          var d = o.done && o.done.get(asset.id + '|' + plan.freq + '|' + p);
          if (!d && w.end >= today) return;
          var k = ymOf(w.end) + '|' + asset.site + '|' + plan.freq;
          var c = acc[k] || (acc[k] = { month: ymOf(w.end), site: asset.site, freq: plan.freq, due: 0, onTime: 0, late: 0, missed: 0 });
          c.due++;
          if (!d) c.missed++; else if (d.late) c.late++; else c.onTime++;
        });
      });
    });
    Object.keys(acc).sort().forEach(function (k) { rows.push(acc[k]); });
    return rows;
  }

  /* ── ใบสั่งงาน ────────────────────────────────────────────────── */
  var SET_FIELDS = ['status', 'assignee', 'priority', 'symptom', 'planFinish', 'startAt', 'endAt', 'downtimeH',
    'failureMode', 'cause', 'action', 'parts', 'laborCost', 'otherCost'];
  function foldWo(wo, events) {
    var evs = (events || []).filter(function (e) { return e && e.wo === wo.id; }).slice().sort(function (a, b) {
      return a.at - b.at || (a.dev < b.dev ? -1 : a.dev > b.dev ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    var out = {
      id: wo.id, no: wo.no, kind: wo.kind, asset: wo.asset, site: wo.site, reportedAt: wo.reportedAt, reportedBy: wo.reportedBy || '',
      fromInsp: wo.fromInsp || null, status: 'open', priority: wo.priority || 'normal', symptom: wo.symptom || '',
      assignee: '', planFinish: '', startAt: null, endAt: null, downtimeH: null, failureMode: '', cause: '', action: '',
      parts: [], laborCost: 0, otherCost: 0, matCost: 0, timeline: [], notes: [], photos: [], updatedAt: wo.createdAt || wo.reportedAt || 0
    };
    evs.forEach(function (e) {
      var s = e.set || {};
      SET_FIELDS.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(s, k)) out[k] = s[k]; });
      out.timeline.push(e);
      if (e.note) out.notes.push({ at: e.at, dev: e.dev, note: e.note });
      (e.photos || []).forEach(function (p) { out.photos.push(p); });
      out.updatedAt = e.at;
    });
    out.matCost = (out.parts || []).reduce(function (a, p) { return a + (+p.qty || 0) * (+p.unitCost || 0); }, 0);
    out.cancelled = out.status === 'cancel';
    return out;
  }

  /* ── รายการตรวจ ───────────────────────────────────────────────── */
  function splitChecklist(text) {
    return String(text == null ? '' : text).split(/\r?\n|;/).map(function (l) {
      return l.replace(/^\s*(?:\d+\s*[.)]\s*|[-•*]\s+|•\s*)/, '').trim();
    }).filter(Boolean);
  }

  /* ── นำเข้าจากไฟล์ input ของ est-cost ──────────────────────────── */
  function s(v) { return v == null ? '' : String(v).trim(); }
  function dataRows(sheet) { return (sheet || []).slice(2).filter(function (r) { return r && s(r[0]) && s(r[0]).slice(0, 2) !== '——'; }); }
  function samePlan(a, b) {
    return a.hours === b.hours && a.shift === b.shift && a.typeName === b.typeName && JSON.stringify(a.items) === JSON.stringify(b.items);
  }
  function maxItemNo(items) {
    var m = 0;
    (items || []).forEach(function (it) { var n = parseInt(String(it.id).slice(1), 10); if (n > m) m = n; });
    return m;
  }

  function fromEstCost(sheets, existing) {
    sheets = sheets || {}; existing = existing || {};
    var warnings = [];
    var report = { added: { sites: 0, assets: 0, plans: 0 }, updated: { sites: 0, assets: 0, plans: 0 }, missing: 0, skipped: [] };
    var sites = (existing.sites || []).map(function (x) { return Object.assign({}, x); });
    var assets = (existing.assets || []).map(function (x) { return Object.assign({}, x); });
    var plans = (existing.plans || []).map(function (x) { return Object.assign({}, x); });

    /* PROJECT */
    var proj = {};
    (sheets.PROJECT || []).slice(2).forEach(function (r) { if (r && s(r[0]) && s(r[0]).slice(0, 2) !== '——' && r[2] != null) proj[s(r[0])] = r[2]; });
    var settingsPatch = {};
    if (s(proj.project_name)) settingsPatch.project = s(proj.project_name);
    if (s(proj.project_short_name)) settingsPatch.line = s(proj.project_short_name);

    /* ROUTE → พิกัดตามชื่อสถานที่ */
    var route = {};
    dataRows(sheets.ROUTE).forEach(function (r) {
      var lat = parseFloat(r[1]), lng = parseFloat(r[2]), ord = parseInt(r[4], 10);
      route[s(r[0]).toLowerCase()] = { lat: isFinite(lat) ? lat : null, lng: isFinite(lng) ? lng : null, circuit: s(r[3]), order: isFinite(ord) ? ord : null };
    });
    if (!sheets.ROUTE) warnings.push('ไม่มีชีต ROUTE — พิกัดสถานที่ว่าง');

    /* EQUIPMENT */
    var equip = [];
    dataRows(sheets.EQUIPMENT).forEach(function (r) {
      var code = s(r[4]), qty = parseInt(r[5], 10) || 0;
      if (!code) { warnings.push('แถวอุปกรณ์ "' + s(r[2] || r[0]) + '" ไม่มี code — ข้าม'); return; }
      equip.push({ location: s(r[0]), system: s(r[1]), nameTh: s(r[2]), nameEn: s(r[3]), code: code, qty: qty < 0 ? 0 : qty });
    });

    /* สถานที่ */
    var siteByName = {}, abbrTaken = new Set(), newSiteSeq = sites.length;
    sites.forEach(function (x) { siteByName[x.name.toLowerCase()] = x; abbrTaken.add(String(x.abbr).toLowerCase()); });
    equip.forEach(function (e) {
      var key = e.location.toLowerCase(), site = siteByName[key], rt = route[key];
      if (!site) {
        newSiteSeq++;
        var tok = /^([A-Za-z0-9]{2,6})(?=\s|$)/.exec(e.location);
        var abbr = uniqueCode(tok ? tok[1].toUpperCase() : 'S' + pad(newSiteSeq), abbrTaken);
        abbrTaken.add(abbr.toLowerCase());
        site = { id: 's-' + fnv1a36(key), name: e.location, abbr: abbr, lat: rt ? rt.lat : null, lng: rt ? rt.lng : null,
          circuit: rt ? rt.circuit : '', order: rt ? rt.order : null, updatedAt: Date.now() };
        siteByName[key] = site; sites.push(site); report.added.sites++;
      } else if (rt && !site._seen) {
        // เติมเฉพาะช่องที่ยังว่าง ไม่ทับที่ผู้ใช้แก้
        var ch = false;
        if (site.lat == null && rt.lat != null) { site.lat = rt.lat; ch = true; }
        if (site.lng == null && rt.lng != null) { site.lng = rt.lng; ch = true; }
        if (!site.circuit && rt.circuit) { site.circuit = rt.circuit; ch = true; }
        if (site.order == null && rt.order != null) { site.order = rt.order; ch = true; }
        if (ch) { site.updatedAt = Date.now(); report.updated.sites++; }
      }
      site._seen = true;
    });
    sites.forEach(function (x) { delete x._seen; });

    /* อุปกรณ์รายตัว */
    var bySrc = {}, idTaken = new Set(), codeTaken = new Set();
    assets.forEach(function (a) { if (a.srcKey) bySrc[a.srcKey] = a; idTaken.add(a.id); codeTaken.add(String(a.code).toLowerCase()); });
    var seen = {}, counter = {}, typeName = {};
    equip.forEach(function (e) {
      if (!typeName[e.code]) typeName[e.code] = e.nameTh || e.nameEn || e.code;
      var site = siteByName[e.location.toLowerCase()], ck = e.location + '|' + e.system + '|' + e.code;
      for (var q = 0; q < e.qty; q++) {
        var n = (counter[ck] = (counter[ck] || 0) + 1), src = ck + '|' + n, ex = bySrc[src];
        seen[src] = true;
        if (ex) {
          var changed = false;
          if (ex.missing) { ex.missing = false; changed = true; }
          if (!ex.name && (e.nameTh || e.nameEn)) { ex.name = e.nameTh || e.nameEn; changed = true; }
          if (changed) { ex.updatedAt = Date.now(); report.updated.assets++; }
          continue;
        }
        var id = uniqueCode('e-' + fnv1a36(src), { has: function (k) { return idTaken.has(k); } });
        var code = uniqueCode(site.abbr + '-' + e.code + '-' + pad(n), codeTaken);
        idTaken.add(id); codeTaken.add(code.toLowerCase());
        var a = { id: id, code: code, name: e.nameTh || e.nameEn || e.code, type: e.code, system: e.system, site: site.id,
          serial: '', brand: '', model: '', installed: '', lat: null, lng: null, phase: {}, status: 'active',
          srcKey: src, missing: false, note: '', updatedAt: Date.now() };
        assets.push(a); bySrc[src] = a; report.added.assets++;
      }
    });
    assets.forEach(function (a) {
      if (a.srcKey && !seen[a.srcKey] && !a.missing) { a.missing = true; a.updatedAt = Date.now(); report.missing++; }
    });

    /* แผน PM */
    var hasActivity = !!sheets.PM_ACTIVITY;
    if (!sheets.PM_ACTIVITY) warnings.push('ไม่มีชีต PM_ACTIVITY — รายการตรวจข้อเดียวต่อแผน');
    var act = {}; // code|freq → { text, shift }
    (sheets.PM_ACTIVITY ? dataRows(sheets.PM_ACTIVITY) : []).forEach(function (r) {
      var code = s(r[0]), f = s(r[3]);
      if (!code || !f) return;
      if (FREQS.indexOf(f) === -1) { warnings.push('PM_ACTIVITY: ความถี่ "' + f + '" ของ ' + code + ' ไม่รู้จัก — ข้าม'); return; }
      var sh = s(r[5]).toUpperCase().slice(0, 1);
      act[code + '|' + f] = { text: r[4] == null ? '' : String(r[4]), shift: sh === 'N' || sh === 'D' ? sh : '' };
    });
    var planById = {};
    plans.forEach(function (p) { planById[p.id] = p; });
    var freqCol = { 2: 'Daily', 3: 'Weekly', 4: 'M1', 5: 'M3', 6: 'M6', 7: 'Annually' };
    var planCodes = {};
    dataRows(sheets.PM_PLAN).forEach(function (r) {
      var code = s(r[0]);
      planCodes[code] = true;
      if (!typeName[code]) warnings.push('PM_PLAN: code "' + code + '" ไม่มีใน EQUIPMENT');
      Object.keys(freqCol).forEach(function (col) {
        var f = freqCol[col], h = parseFloat(r[col]);
        if (!(h > 0)) return;
        var id = code + '|' + f, ex = planById[id], a = act[id];
        var tn = typeName[code] || (ex && ex.typeName) || code;
        var texts = a && a.text ? splitChecklist(a.text) : [];
        if (!texts.length) texts = [tn + ' ' + FREQ_LABEL[f]];
        var np = { id: id, type: code, typeName: tn, freq: f, hours: h, shift: a ? a.shift : '', items: [], edited: false, updatedAt: Date.now() };
        if (ex) {
          if (ex.edited) { report.skipped.push(id); return; }
          // คง id ของข้อที่ข้อความเดิม (ผลตรวจเก่าอ้าง id) ข้อใหม่ต่อจากเลขสูงสุดเดิม — ไม่ใช้ id ซ้ำ
          var nextNo = maxItemNo(ex.items), used = {};
          texts.forEach(function (t) {
            var old = (ex.items || []).filter(function (it) { return it.text === t && !used[it.id]; })[0];
            if (old) { used[old.id] = true; np.items.push(Object.assign({}, old)); }
            else np.items.push({ id: 'i' + (++nextNo), text: t, kind: 'check' });
          });
          if (!samePlan(ex, np)) { np.updatedAt = Date.now(); Object.assign(ex, np); report.updated.plans++; }
        } else {
          np.items = texts.map(function (t, i) { return { id: 'i' + (i + 1), text: t, kind: 'check' }; });
          plans.push(np); planById[id] = np; report.added.plans++;
        }
      });
    });
    if (!sheets.PM_PLAN) warnings.push('ไม่มีชีต PM_PLAN');
    Object.keys(typeName).forEach(function (c) { if (!planCodes[c]) warnings.push('EQUIPMENT: code "' + c + '" ไม่มีแผนใน PM_PLAN'); });

    return { sites: sites, assets: assets, plans: plans, settingsPatch: settingsPatch, report: report, warnings: warnings };
  }

  /* ── ส่งออก (หัวข้อ 7.2) ──────────────────────────────────────── */
  var WO_HEADERS = ['Work Order', 'Work Order Type', 'Equipment No', 'Equipment Type', 'Subsystem', 'Location', 'Line', 'Priority', 'Status',
    'Failure Mode', 'Plan Start', 'Plan Finish', 'Actual Start', 'Actual End', 'Downtime (h)', 'Material Cost', 'Labor Cost', 'Other Cost',
    'Assignee', 'Cause', 'Action'];
  var INSP_HEADERS = ['วันที่บันทึก', 'สถานที่', 'รหัสอุปกรณ์', 'ชื่ออุปกรณ์', 'ความถี่', 'รอบ', 'ข้อ', 'ผล', 'ค่า', 'หน่วย', 'ผู้ตรวจ', 'หมายเหตุ', 'จำนวนรูป'];
  var ASSET_HEADERS = ['รหัสอุปกรณ์', 'ชื่ออุปกรณ์', 'ประเภท', 'ระบบ', 'สถานที่', 'เลขเครื่อง', 'ยี่ห้อ', 'รุ่น', 'วันที่ติดตั้ง', 'ละติจูด', 'ลองจิจูด', 'สถานะ', 'หมายเหตุ'];
  var COMP_HEADERS = ['เดือน', 'สถานที่', 'ความถี่', 'ครบกำหนด', 'ตรงเวลา', 'ช้า', 'พลาด'];
  var PRIORITY_LABEL = { high: 'สูง', normal: 'ปกติ', low: 'ต่ำ' };
  var WO_STATUS_LABEL = { open: 'เปิด', progress: 'กำลังดำเนินการ', parts: 'รออะไหล่', done: 'เสร็จ', cancel: 'ยกเลิก' };
  var RES_LABEL = { ok: 'ผ่าน', ng: 'ไม่ผ่าน', na: 'ไม่มี' };

  function dateCell(v) { // 'YYYY-MM-DD' | ms → Date จริง หรือ null
    if (v == null || v === '') return null;
    var d = typeof v === 'number' ? new Date(v) : parseYmd(String(v).slice(0, 10));
    return d && !isNaN(d) ? d : null;
  }

  function reportRows(o) {
    var assets = o.assets || [], sites = o.sites || [], plans = o.plans || [], settings = o.settings || {};
    var from = toYmd(o.from), to = toYmd(o.to), today = toYmd(o.today || new Date());
    var pmFreqs = o.pmFreqs || PM_FREQS_DEFAULT, line = settings.line || settings.project || '';
    var siteBy = {}, assetBy = {}, typeNameBy = {}, planBy = {};
    sites.forEach(function (x) { siteBy[x.id] = x; });
    assets.forEach(function (x) { assetBy[x.id] = x; });
    plans.forEach(function (p) { typeNameBy[p.type] = p.typeName; planBy[p.id] = p; });
    var inspDocs = o.inspDocs || [], done = doneIndex(inspDocs);
    var fromMs = parseYmd(from) ? parseYmd(from).getTime() : 0, toMs = parseYmd(to) ? endOfDayMs(to) : Infinity;
    var rows = [];
    function row(no, type, a, status, prio, fm, ps, pf, as, ae, dt, mat, lab, oth, who, cause, action) {
      var st = siteBy[a.site];
      rows.push([no, type, a.code, typeNameBy[a.type] || a.type, a.system || null, st ? st.name : null, line || null, prio, status,
        fm || null, dateCell(ps), dateCell(pf), dateCell(as), dateCell(ae), dt == null ? 0 : dt, mat || 0, lab || 0, oth || 0,
        who || null, cause || null, action || null]);
    }
    /* CM (และใบงานที่ kind = pm ที่เปิดเอง) */
    (o.wos || []).forEach(function (wo) {
      var f = foldWo(wo, o.woEvents), a = assetBy[wo.asset];
      if (!a || f.cancelled || wo.reportedAt < fromMs || wo.reportedAt > toMs) return;
      var late = f.status !== 'done' && f.planFinish && f.planFinish < today;
      var st = late ? 'ล่าช้า' : WO_STATUS_LABEL[f.status] || 'เปิด';
      row(f.no, String(f.kind || 'cm').toUpperCase(), a, st, PRIORITY_LABEL[f.priority] || 'ปกติ', f.failureMode,
        wo.reportedAt, f.planFinish, f.startAt, f.endAt, f.downtimeH, f.matCost, f.laborCost, f.otherCost, f.assignee, f.cause, f.action);
    });
    /* PM: อุปกรณ์ × ความถี่ × รอบ ที่ครบกำหนดในช่วง */
    var byType = plansByType(plans);
    assets.forEach(function (a) {
      if (a.status === 'retired') return;
      (byType[a.type] || []).forEach(function (plan) {
        if (pmFreqs.indexOf(plan.freq) === -1) return;
        periods(a, plan, settings, from, to).forEach(function (p) {
          var w = window_(plan.freq, p), d = done.get(a.id + '|' + plan.freq + '|' + p), st, fm = null;
          if (d) {
            st = d.late ? 'เสร็จ ล่าช้า' : 'เสร็จ';
            var ng = (plan.items || []).filter(function (it) { return d.res[it.id] === 'ng'; }).map(function (it) { return it.text; });
            fm = ng.length ? ng.join('; ') : null;
          } else st = today > w.end ? 'ล่าช้า' : 'เปิด';
          row('PM-' + a.code + '-' + plan.freq + '-' + p, 'PM', a, st, 'ปกติ', fm, w.start, w.end, d ? d.start : null, d ? d.at : null, 0, 0, 0, 0, d ? d.by : null, null, null);
        });
      });
    });

    var inspRows = [];
    (o.inspExport || inspDocs).slice().sort(function (x, y) { return x.at - y.at; }).forEach(function (doc) { // inspExport = ใบตรวจเฉพาะช่วงที่ส่งออก (ชีต Inspections) · สถานะรอบ PM ใช้ inspDocs ทั้งหมด
      var st = siteBy[doc.site];
      Object.keys(doc.rows || {}).forEach(function (aid) {
        var r = doc.rows[aid], a = assetBy[aid];
        if (!a) return;
        var plan = planBy[a.type + '|' + doc.freq], items = plan ? plan.items : [], first = true;
        Object.keys(r.res || {}).forEach(function (iid) {
          var it = items.filter(function (x) { return x.id === iid; })[0] || { text: iid }, v = r.res[iid];
          var photos = (r.photos || []).filter(function (p) { return p.item === iid; }).length + (first ? (r.photos || []).filter(function (p) { return !p.item; }).length : 0);
          inspRows.push([dateCell(r.at), st ? st.name : null, a.code, a.name, FREQ_LABEL[doc.freq] || doc.freq, doc.period, it.text,
            typeof v === 'number' ? null : RES_LABEL[v] || null, typeof v === 'number' ? v : null, it.unit || null, doc.by || null,
            first && r.note ? r.note : null, photos]);
          first = false;
        });
      });
    });

    var assetRows = assets.map(function (a) {
      var st = siteBy[a.site], lat = a.lat != null ? a.lat : st ? st.lat : null, lng = a.lng != null ? a.lng : st ? st.lng : null;
      return [a.code, a.name, typeNameBy[a.type] || a.type, a.system || null, st ? st.name : null, a.serial || null, a.brand || null, a.model || null,
        dateCell(a.installed), lat, lng, a.status === 'retired' ? 'ปลดใช้งาน' : a.missing ? 'ไม่อยู่ในไฟล์ล่าสุด' : 'ใช้งาน', a.note || null];
    });
    var compRows = compliance({ assets: assets, plans: plans, settings: settings, done: done, from: from, to: to, today: today, freqs: pmFreqs })
      .map(function (c) { return [c.month, siteBy[c.site] ? siteBy[c.site].name : c.site, FREQ_LABEL[c.freq], c.due, c.onTime, c.late, c.missed]; });

    return {
      headers: WO_HEADERS, rows: rows,
      inspections: { headers: INSP_HEADERS, rows: inspRows },
      assets: { headers: ASSET_HEADERS, rows: assetRows },
      compliance: { headers: COMP_HEADERS, rows: compRows }
    };
  }

  /* ── สรุปประจำวันของงาน PM (tanot-push.js → ตาราง reminders scope 'maintenance', kind 'digest') ──
     1 รายการต่อวัน (ไม่ใช่ทีละเครื่อง) สำหรับ today … today+days−1 — นับด้วย dueList ของวันนั้น โดยถือว่างานที่ยังไม่ทำวันนี้ยังไม่ทำต่อไป
     (บันทึกใบตรวจแล้วหน้าเว็บลงทะเบียนชุดใหม่ทับ) · due_at = 07:00 เวลาไทยของวันนั้น · วันที่ไม่มีงานไม่ใส่ */
  function digest(o) {
    var today = toYmd(o.today || new Date()), days = o.days == null ? 14 : o.days, out = [];
    for (var i = 0; i < days; i++) {
      var day = addDays(today, i);
      var list = dueList({ assets: o.assets, plans: o.plans, settings: o.settings, done: o.done, today: day, ahead: 0 });
      var overdue = 0, due = 0;
      list.forEach(function (x) { if (x.state === 'overdue') overdue++; else if (x.state === 'due') due++; });
      if (!overdue && !due) continue;
      out.push({
        id: day, title: 'งานบำรุงรักษา',
        body: [overdue ? 'เลยกำหนด ' + overdue : '', due ? 'ถึงกำหนด ' + due : ''].filter(Boolean).join(' · '),
        url: 'maintenance.html#tab=calendar', due_at: Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), 0, 0), kind: 'digest',
        overdue: overdue, due: due
      });
    }
    return out;
  }

  return {
    digest: digest,
    FREQS: FREQS, FREQ_LABEL: FREQ_LABEL, STEP: STEP, PM_FREQS_DEFAULT: PM_FREQS_DEFAULT,
    WO_HEADERS: WO_HEADERS,
    uid: uid, fnv1a36: fnv1a36, uniqueCode: uniqueCode, woNo: woNo, inspId: inspId,
    ymd: ymd, parseYmd: parseYmd, addMonths: addMonths, addDays: addDays, daysBetween: daysBetween,
    periodOf: periodOf, window: window_, periodYear: periodYear, dueMonths: dueMonths, periods: periods,
    assignPhases: assignPhases, doneIndex: doneIndex, status: status, dueList: dueList, compliance: compliance,
    foldWo: foldWo, splitChecklist: splitChecklist, fromEstCost: fromEstCost, reportRows: reportRows
  };
});
