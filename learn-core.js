/* ══════════════════════════════════════════════════════════════════
   ระบบการเรียนรวมศูนย์ (ROADMAP Phase 5) — XP ชุดเดียว, วันติดต่อกันแบบมีวันพัก, เป้ารายวัน
   ใช้ได้ทั้งในหน้าเว็บ (window.LearnCore) และ Node (require — เฉพาะฟังก์ชันคำนวณ ไม่มี storage)

   คีย์ (ลงทะเบียนใน data-registry.js):
     tanot:learn:xp       sync list (idField id) — 1 แถวต่อ (วัน, เครื่อง, ที่มา): {id:'YYYY-MM-DD|<dev>|<src>', d, dev, area, src, xp, n, ts}
                          สองเครื่องไม่เคยเขียนแถวเดียวกัน → ซิงก์แล้วไม่ทับกัน; แถวเดียวต่อวันกันคีย์โตไม่จำกัด
     tanot:learn:legacy   sync list (idField id) — ยอดเดิมของแต่ละหน้า ถ่ายครั้งเดียวต่อเครื่อง: {id:'legacy|<dev>', dev, ts, v, xp:{src:n}, streak:{src:{count,longest,lastDate}}}
     tanot:learn:settings sync blob — {goal, rest}
   คีย์ความคืบหน้าเดิมของทุกหน้าอ่านอย่างเดียว ไม่ลบ/ไม่เปลี่ยน — หน้าเดิมยังเขียนคีย์ของตัวเองต่อ (ถอดระบบนี้ออกได้ทุกเมื่อ)

   ยอด legacy ต่อที่มา = ค่าต่ำสุดในบรรดาแถวของทุกเครื่อง (คีย์เดิมซิงก์ร่วมกันและมีแต่เพิ่มขึ้น — ค่าต่ำสุดคือภาพก่อนระบบใหม่เริ่มนับ
   เครื่องที่ย้ายทีหลังจะเห็นค่าที่รวม XP ใหม่ไปแล้ว ห้ามนับซ้ำ) · วันติดต่อกันเดิม: เลือกของหน้าที่ทำให้วันติดต่อกันตอนนี้ยาวที่สุด
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.LearnCore = factory(root);
})(typeof self !== 'undefined' ? self : this, function (win) {
  'use strict';

  var XP_KEY = 'tanot:learn:xp';
  var LEGACY_KEY = 'tanot:learn:legacy';
  var SETTINGS_KEY = 'tanot:learn:settings';
  var DEVICE_KEY = 'tanot-sync:device'; // ใช้ id เครื่องเดียวกับ tanot-data.js
  var XP_PER_REVIEW = 5;
  var LBE_SEED = 1250; // ห้องเรียนธุรกิจ/วิศวะตั้ง XP เริ่มต้น 1250 ให้ทุกคน (ไม่ได้ฝึกจริง) — ไม่นับเป็นยอดเดิม
  var DEFAULTS = { goal: 50, rest: 1 };
  var GOALS = [20, 50, 100, 200];
  var RESTS = [0, 1, 2];

  var AREAS = { edu: 'การศึกษา', hobby: 'งานอดิเรก/ทักษะ' };
  var SOURCES = {
    law:     { area: 'edu',   label: 'กฎหมาย',   href: 'classroom-law.html',         icon: 'scale' },
    lang:    { area: 'edu',   label: 'ภาษา',     href: 'languages.html',             icon: 'languages' },
    biz:     { area: 'edu',   label: 'ธุรกิจ',    href: 'classroom-business.html',    icon: 'briefcase' },
    eng:     { area: 'edu',   label: 'วิศวกรรม',  href: 'classroom-engineering.html', icon: 'wrench' },
    music:   { area: 'hobby', label: 'ดนตรี',     href: 'music.html',                 icon: 'music' },
    sports:  { area: 'hobby', label: 'กีฬา',      href: 'sports.html',                icon: 'dumbbell' },
    cooking: { area: 'hobby', label: 'ทำอาหาร',   href: 'cooking.html',               icon: 'chef-hat' },
    coding:  { area: 'hobby', label: 'เขียนโค้ด',  href: 'coding.html',                icon: 'code' },
    typing:  { area: 'hobby', label: 'พิมพ์ดีด',   href: 'typing.html',                icon: 'keyboard' },
    books:   { area: 'edu',   label: 'หนังสือ',   href: 'books.html',                 icon: 'book-open' }
  };
  var SRC_ORDER = Object.keys(SOURCES);

  /* ── วันที่ (เวลาเครื่อง ไม่ใช่ UTC) ── */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(t) { var d = t instanceof Date ? t : new Date(t == null ? Date.now() : t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseDay(k) { var p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(k, n) { var d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); }
  // หน้างานอดิเรกเก็บ 'Y-M-D' (ไม่เติม 0) หน้าภาษาเก็บ 'YYYY-MM-DD' — ทำให้เป็นแบบเดียว
  function normDay(s) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || ''));
    return m ? m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]) : null;
  }

  function parseJ(s) { if (s == null) return null; try { return JSON.parse(s); } catch (e) { return null; } }
  function posInt(v) { var n = Math.floor(Number(v)); return isFinite(n) && n > 0 ? n : 0; }

  /* ── วันติดต่อกันแบบมีวันพัก ──
     days = {YYYY-MM-DD: true} วันที่มี XP · rest = วันที่ขาดได้ไม่เกินกี่วันในทุกช่วง 7 วันติดกัน
     วันนี้ยังไม่จบ — ยังไม่ฝึกวันนี้ไม่ถือว่าขาด */
  function streakFrom(days, today, rest) {
    rest = rest == null ? DEFAULTS.rest : rest;
    var keys = Object.keys(days), min = null;
    keys.forEach(function (k) { if (days[k] && (min === null || k < min)) min = k; });
    var doneToday = !!days[today];
    var count = doneToday ? 1 : 0, used = 0, pending = 0, missed = [], k = today;
    while (min !== null && k > min) {
      k = addDays(k, -1);
      if (days[k]) { count++; used += pending; pending = 0; missed.push(0); continue; }
      var m = 1;
      for (var j = missed.length - 1, c = 0; j >= 0 && c < 6; j--, c++) m += missed[j];
      if (m > rest) break;
      missed.push(1); pending++;
    }
    return { count: count, restUsed: count ? used : 0, doneToday: doneToday };
  }
  function longestFrom(days, rest) {
    var best = 0;
    Object.keys(days).forEach(function (k) {
      if (!days[k] || days[addDays(k, 1)]) return; // เริ่มนับถอยหลังจากวันสุดท้ายของแต่ละช่วงเท่านั้น
      var c = streakFrom(days, k, rest).count;
      if (c > best) best = c;
    });
    return best;
  }
  function seedDays(days, seed) {
    var out = {}, k;
    for (k in days) if (days[k]) out[k] = true;
    var last = normDay(seed && seed.lastDate), n = Math.min(posInt(seed && seed.count), 3650);
    for (var i = 0; last && i < n; i++) out[addDays(last, -i)] = true;
    return out;
  }

  /* ── ยอดเดิมของแต่ละหน้า (อ่านอย่างเดียว) — get(key) คืนค่า string ดิบจาก localStorage ── */
  function hobbyStreak(g, key) {
    var s = parseJ(g(key));
    return s && posInt(s.count) ? { count: posInt(s.count), longest: posInt(s.count), lastDate: normDay(s.lastDate) } : null;
  }
  function lawStreak(g) {
    var act = parseJ(g('tanot:barprep:activity'));
    if (!Array.isArray(act) || !act.length) return null;
    var days = {}, last = null;
    act.forEach(function (a) { if (a && a.ts) { var k = dayKey(a.ts); days[k] = true; if (!last || k > last) last = k; } });
    if (!last) return null;
    var count = 0, k = last;
    while (days[k]) { count++; k = addDays(k, -1); }
    var longest = 0;
    Object.keys(days).forEach(function (d) {
      if (days[addDays(d, 1)]) return;
      var c = 0, x = d; while (days[x]) { c++; x = addDays(x, -1); }
      if (c > longest) longest = c;
    });
    return { count: count, longest: longest, lastDate: last };
  }
  var LEGACY = {
    lang: {
      xp: function (g) { return posInt(parseJ(g('lang-practice:xp'))); },
      streak: function (g) {
        var s = parseJ(g('lang-practice:streak'));
        return s && posInt(s.count) ? { count: posInt(s.count), longest: Math.max(posInt(s.longest), posInt(s.count)), lastDate: normDay(s.lastDate) } : null;
      }
    },
    biz: { xp: function (g) { var v = parseJ(g('lbe:business:xp')); return v == null ? 0 : Math.max(posInt(v) - LBE_SEED, 0); } },
    eng: { xp: function (g) { var v = parseJ(g('lbe:engineering:xp')); return v == null ? 0 : Math.max(posInt(v) - LBE_SEED, 0); } },
    music:   { xp: function (g) { return posInt(parseInt(g('tanot:music:xp'), 10)); },   streak: function (g) { return hobbyStreak(g, 'tanot:music:streak'); } },
    sports:  { xp: function (g) { return posInt(parseInt(g('tanot:sports:xp'), 10)); },  streak: function (g) { return hobbyStreak(g, 'tanot:sports:streak'); } },
    cooking: { xp: function (g) { return posInt(parseInt(g('tanot:cooking:xp'), 10)); }, streak: function (g) { return hobbyStreak(g, 'tanot:cooking:streak'); } },
    coding:  { xp: function (g) { return posInt(parseInt(g('tanot:coding:xp'), 10)); },  streak: function (g) { return hobbyStreak(g, 'tanot:coding:streak'); } },
    law: { streak: lawStreak }
  };
  // ภาพยอดเดิม ณ ตอนนี้ — ทุกที่มามีค่าใน xp (0 = ไม่มี) เพื่อให้ค่าต่ำสุดข้ามเครื่องถูกต้อง; null = เครื่องนี้ไม่มีข้อมูลเดิมเลย
  function legacySnapshot(get) {
    var xp = {}, streak = {}, any = false;
    SRC_ORDER.forEach(function (src) {
      var L = LEGACY[src];
      xp[src] = L && L.xp ? L.xp(get) : 0;
      if (xp[src]) any = true;
      var s = L && L.streak ? L.streak(get) : null;
      if (s && s.lastDate) { streak[src] = s; any = true; }
    });
    return any ? { xp: xp, streak: streak } : null;
  }
  function legacyTotals(rows) {
    var xp = {}, streak = {};
    (rows || []).forEach(function (r) {
      if (!r || !r.xp) return;
      SRC_ORDER.forEach(function (src) {
        var v = posInt(r.xp[src]);
        xp[src] = src in xp ? Math.min(xp[src], v) : v;
      });
      Object.keys(r.streak || {}).forEach(function (src) {
        var s = r.streak[src], cur = streak[src];
        if (!s || !normDay(s.lastDate)) return;
        if (!cur || normDay(s.lastDate) > normDay(cur.lastDate) || (normDay(s.lastDate) === normDay(cur.lastDate) && posInt(s.count) > posInt(cur.count))) streak[src] = s;
      });
    });
    return { xp: xp, streak: streak };
  }

  function cleanSettings(s) {
    s = s || {};
    var goal = posInt(s.goal), rest = Math.floor(Number(s.rest));
    return { goal: goal >= 5 && goal <= 2000 ? goal : DEFAULTS.goal, rest: RESTS.indexOf(rest) !== -1 ? rest : DEFAULTS.rest };
  }

  /* ── รวมทุกอย่างเป็นสรุปเดียว (pure) ── */
  function compute(rows, legacyRows, settings, now) {
    var today = dayKey(now == null ? Date.now() : now);
    settings = cleanSettings(settings);
    var bySrc = {}, byArea = {}, days = {}, todayXp = 0, todayBySrc = {}, total = 0, last14 = {};
    SRC_ORDER.forEach(function (s) { bySrc[s] = 0; });
    (rows || []).forEach(function (r) {
      var xp = posInt(r && r.xp);
      if (!xp || !SOURCES[r.src] || !normDay(r.d)) return;
      bySrc[r.src] += xp;
      days[normDay(r.d)] = true;
      if (normDay(r.d) === today) { todayXp += xp; todayBySrc[r.src] = (todayBySrc[r.src] || 0) + xp; }
      last14[normDay(r.d)] = (last14[normDay(r.d)] || 0) + xp;
    });
    var leg = legacyTotals(legacyRows), legacy = 0;
    SRC_ORDER.forEach(function (s) {
      var v = leg.xp[s] || 0;
      legacy += v;
      bySrc[s] += v;
      total += bySrc[s];
      var a = SOURCES[s].area;
      byArea[a] = (byArea[a] || 0) + bySrc[s];
    });
    // วันติดต่อกัน: วันที่มี XP ในระบบใหม่ + ช่วงวันติดต่อกันเดิมของหน้าเดียวที่ให้ค่าตอนนี้สูงสุด
    var best = streakFrom(days, today, settings.rest), bestDays = days, longest = 0;
    Object.keys(leg.streak).forEach(function (src) {
      var s = leg.streak[src];
      longest = Math.max(longest, posInt(s.longest), posInt(s.count));
      var set = seedDays(days, s), c = streakFrom(set, today, settings.rest);
      if (c.count > best.count) { best = c; bestDays = set; }
    });
    longest = Math.max(longest, longestFrom(bestDays, settings.rest), best.count);
    var recent = [];
    for (var i = 13; i >= 0; i--) {
      var k = addDays(today, -i);
      recent.push({ d: k, xp: last14[k] || 0, active: !!bestDays[k] });
    }
    return {
      today: today, total: total, legacy: legacy, bySrc: bySrc, byArea: byArea,
      todayXp: todayXp, todayBySrc: todayBySrc, goal: settings.goal, rest: settings.rest,
      goalMet: todayXp >= settings.goal,
      streak: { count: best.count, longest: longest, doneToday: best.doneToday, restUsed: best.restUsed },
      recent: recent
    };
  }

  /* ── การ์ดค้างทบทวน (นับอย่างเดียว ไม่ต้องรู้เนื้อหาการ์ด) ── */
  function countDue(map, field, now) {
    var n = 0;
    if (!map || typeof map !== 'object') return 0;
    Object.keys(map).forEach(function (k) { var r = map[k]; if (r && typeof r === 'object' && Number(r[field]) <= now) n++; });
    return n;
  }
  function countDueList(rows, field, now) {
    var n = 0;
    (rows || []).forEach(function (r) { if (r && typeof r === 'object' && Number(r[field]) <= now) n++; });
    return n;
  }
  // ระบบขั้นบันไดของห้องเรียนธุรกิจ/วิศวะ (ตรงกับ nextSrs ในหน้านั้น): ถูก → 1→3→7→14→30 วัน, ผิด → 1 วัน
  var LBE_STEPS = [1, 3, 7, 14, 30];
  function lbeNext(prev, correct, now) {
    if (now == null) now = Date.now();
    var interval;
    if (!correct) interval = 1;
    else {
      var i = LBE_STEPS.indexOf(prev ? prev.interval : -1);
      interval = LBE_STEPS[Math.min(i + 1, LBE_STEPS.length - 1)];
    }
    return { interval: interval, due: now + interval * 86400000 };
  }

  var api = {
    XP_KEY: XP_KEY, LEGACY_KEY: LEGACY_KEY, SETTINGS_KEY: SETTINGS_KEY, XP_PER_REVIEW: XP_PER_REVIEW,
    AREAS: AREAS, SOURCES: SOURCES, SRC_ORDER: SRC_ORDER, GOALS: GOALS, RESTS: RESTS, LBE_SEED: LBE_SEED,
    dayKey: dayKey, addDays: addDays, normDay: normDay,
    streakFrom: streakFrom, longestFrom: longestFrom, legacySnapshot: legacySnapshot, legacyTotals: legacyTotals,
    compute: compute, cleanSettings: cleanSettings, countDue: countDue, lbeNext: lbeNext
  };
  if (!win) return api;

  /* ══════════════ ส่วนที่ใช้ storage (เฉพาะในหน้าเว็บ) ══════════════ */
  var TD = function () { return win.TanotData; };
  function raw(k) {
    var td = TD();
    if (td && td.raw) return td.raw(k); // ไม่นับว่าหน้านี้ "อ่าน" คีย์ (ไม่เด้งแถบรีโหลดตอนข้อมูลจากเครื่องอื่นมา)
    try { return win.localStorage.getItem(k); } catch (e) { return null; }
  }
  function read(k, d) { var v = parseJ(raw(k)); return v == null ? d : v; }
  function update(k, fn) {
    var td = TD();
    if (td && td.update) return td.update(k, fn);
    var next = fn(read(k, null));
    if (next !== undefined) try { win.localStorage.setItem(k, JSON.stringify(next)); } catch (e) {}
    return next;
  }
  function deviceId() {
    var d = raw(DEVICE_KEY);
    if (!d) {
      d = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { win.localStorage.setItem(DEVICE_KEY, d); } catch (e) {}
    }
    return d;
  }
  function emit(detail) { try { win.dispatchEvent(new CustomEvent('tanot:learn', { detail: detail || {} })); } catch (e) {} }
  function list(k) { var v = read(k, []); return Array.isArray(v) ? v : []; }

  // ถ่ายยอดเดิมเครื่องละครั้ง — เรียกซ้ำได้ (มีแถวของเครื่องนี้แล้ว = ไม่ทำอะไร คืนแถวเดิม)
  function migrateLegacy() {
    var dev = deviceId(), id = 'legacy|' + dev;
    var mine = list(LEGACY_KEY).filter(function (r) { return r && r.id === id; })[0];
    if (mine) return mine;
    var snap = legacySnapshot(raw);
    if (!snap) return null;
    var row = { id: id, dev: dev, ts: Date.now(), v: 1, xp: snap.xp, streak: snap.streak };
    update(LEGACY_KEY, function (rows) {
      rows = Array.isArray(rows) ? rows : [];
      if (rows.some(function (r) { return r && r.id === id; })) return undefined;
      rows.push(row);
      return rows;
    });
    emit({ legacy: true });
    return row;
  }

  function award(src, xp, at) {
    xp = Math.round(Number(xp));
    if (!(xp > 0) || !SOURCES[src]) return 0;
    migrateLegacy(); // ถ่ายยอดเดิมก่อนบันทึก XP ใหม่เสมอ — ไม่งั้นภาพยอดเดิมจะรวม XP นี้ไปด้วย
    var now = at == null ? Date.now() : at, d = dayKey(now), dev = deviceId(), id = d + '|' + dev + '|' + src;
    update(XP_KEY, function (rows) {
      rows = Array.isArray(rows) ? rows : [];
      var r = null;
      for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].id === id) { r = rows[i]; break; }
      if (!r) { r = { id: id, d: d, dev: dev, area: SOURCES[src].area, src: src, xp: 0, n: 0 }; rows.push(r); }
      r.xp = posInt(r.xp) + xp; r.n = posInt(r.n) + 1; r.ts = now;
      return rows;
    });
    emit({ src: src, xp: xp });
    return xp;
  }

  function settings() { return cleanSettings(read(SETTINGS_KEY, null)); }
  function saveSettings(s) {
    var next = cleanSettings(Object.assign({}, settings(), s || {}));
    update(SETTINGS_KEY, function () { return next; });
    emit({ settings: true });
    return next;
  }

  function summary(now) {
    var legacy = list(LEGACY_KEY);
    if (!legacy.length) { var snap = legacySnapshot(raw); if (snap) legacy = [snap]; } // ยังไม่ได้ย้าย (เช่นเครื่องนี้ไม่มีข้อมูล) — แสดงจากของเดิมตรงๆ
    return compute(list(XP_KEY), legacy, settings(), now);
  }

  function dueCounts(lawNotes, now) {
    if (now == null) now = Date.now();
    var law = 0;
    (lawNotes || []).forEach(function (n) { if (n && Number(n.dueAt) <= now) law++; });
    return {
      law: law,
      lang: countDue(read('lang-practice:srs', {}), 'dueAt', now),
      biz: countDue(read('lbe:business:srs', {}), 'due', now),
      eng: countDue(read('lbe:engineering:srs', {}), 'due', now),
      books: countDueList(list('tanot:books:cards'), 'dueAt', now)
    };
  }
  function lawNotes() {
    var td = TD();
    return td && td.readIdb ? td.readIdb('tanot-barprep', 'notes') : Promise.resolve([]);
  }

  // หน้าไหนโหลดไฟล์นี้ก็ถ่ายยอดเดิมทันที ก่อนสคริปต์ของหน้าจะให้ XP ใหม่
  try { migrateLegacy(); } catch (e) {}

  api.read = read;
  api.update = update;
  api.deviceId = deviceId;
  api.migrateLegacy = migrateLegacy;
  api.award = award;
  api.settings = settings;
  api.saveSettings = saveSettings;
  api.summary = summary;
  api.dueCounts = dueCounts;
  api.lawNotes = lawNotes;
  api.onChange = function (fn) {
    var keys = [XP_KEY, LEGACY_KEY, SETTINGS_KEY];
    function h() { fn(); }
    win.addEventListener('tanot:learn', h);
    var off = TD() && TD().onChange ? TD().onChange(function (ks) { if (!ks.length || ks.some(function (k) { return keys.indexOf(k) !== -1 || /srs|barprep/.test(k); })) fn(); }) : null;
    return function () { win.removeEventListener('tanot:learn', h); if (off) off(); };
  };
  return api;
});
