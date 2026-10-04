/* ══════════════════════════════════════════════════════════════════
   Tanot — หน้าแรก (index.html): ตรรกะล้วน (ไม่มี DOM/storage) · UMD — window.HomeCalc, require() ได้ใน tests/home.spec.js
   index.js ใช้ไฟล์นี้ — ห้ามมีสูตรจัดเรียง/สรุป/เปอร์เซ็นต์ของตัวเองในหน้า · สูตรของโมดูลอื่น (ประกัน/รถ/PM/สุขภาพ/ลงทุน/ทำอาหาร/learn-core)
   ยังอยู่ในไฟล์ calc ของโมดูลนั้น — ที่นี่มีเฉพาะการ "ประกอบ" ผลของมันเป็นรายการเรื่องที่ต้องทำ / แถวความคืบหน้า

   ข้อมูลที่อ่าน (อ่านอย่างเดียว ไม่เปลี่ยนรูปแบบของหน้าเจ้าของ):
     tanot:nav:last        local map { 'หน้า.html': ms } — shell.js เขียนทุกครั้งที่เปิดหน้า (ใช้กับ "เรียนต่อ" และ "ใช้ล่าสุด" ของหน้าหมวด)
     tanot:home:layout     local { v:1, order:[แถว…], hidden:[กล่อง…] } — "จัดหน้าแรก"
     tanot:home:cache      cache { ts, lang:{id:{title, cats:[{name,n}]}}, biz:[{k,title}], eng:[{k,title}] } — ยอดรวมบท/วลีที่ดึงจาก
                           languages.html / classroom-business.html / classroom-engineering.html (อ่านครั้งเดียวต่อ 14 วัน เฉพาะเมื่อผู้ใช้มีความคืบหน้าของวิชานั้น)
     ความคืบหน้า: lang-practice:progress { 'lang-xx:<หมวด>': [bool ต่อวลี] } · lbe:<business|engineering>:completed { 'วิชา:หัวข้อ': true } ·
                  tanot:barprep:lessonread { วิชา: { หัวข้อ: 1 } } · tanot:<music|sports|cooking>:progress { 'แทร็ก::ลำดับ': true }
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HomeCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var URG = { err: 0, warn: 1, info: 2 };
  var CACHE_TTL = 14 * 86400000;
  var SEC_PER_CARD = 30;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function ymdMs(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  function msYmd(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  function addDays(ymd, n) { return msYmd(ymdMs(ymd) + n * 86400000); }

  /* ── ต้องทำวันนี้ ── */
  /** ความเร่งตามจำนวนวัน: เลยกำหนด = err · ≤ 7 วัน = warn · ที่เหลือ = info */
  function urgencyOfDays(d) { return d < 0 ? 'err' : d <= 7 ? 'warn' : 'info'; }
  /** เรียง err → warn → info แล้วตาม sort (น้อยก่อน; เลยกำหนดมากสุดขึ้นก่อน) แล้วลำดับเดิม (เสถียร) */
  function sortTodos(list) {
    return (list || []).map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      var u = (URG[a.x.urgency] == null ? 9 : URG[a.x.urgency]) - (URG[b.x.urgency] == null ? 9 : URG[b.x.urgency]);
      if (u) return u;
      var s = num(a.x.sort) - num(b.x.sort);
      return s || a.i - b.i;
    }).map(function (p) { return p.x; });
  }
  /** เวลาทบทวนโดยประมาณ (นาที) — 30 วินาทีต่อใบ ปัดขึ้น อย่างน้อย 1 */
  function estMinutes(n) { return Math.max(1, Math.ceil(num(n) * SEC_PER_CARD / 60)); }
  /** การ์ดถึงรอบแยกตามวิชา → รายการ (info) เรียงตามจำนวนมากไปน้อย · counts = { src: n } · order = รหัสวิชาที่รู้จัก */
  function reviewTodos(counts, order) {
    var out = [];
    (order || Object.keys(counts || {})).forEach(function (src) {
      var n = Math.floor(num(counts && counts[src]));
      if (n > 0) out.push({ kind: 'review', src: src, n: n, minutes: estMinutes(n), urgency: 'info', sort: 5 });
    });
    return out.sort(function (a, b) { return b.n - a.n; });
  }

  /* ── เงินเดือนนี้ ── */
  function monthSums(records, mk) {
    var inc = 0, exp = 0, byCat = {}, any = false;
    (records || []).forEach(function (r) {
      if (!r || typeof r.date !== 'string' || r.date.slice(0, 7) !== mk) return;
      var a = num(r.amount);
      if (r.type === 'expense') { exp += a; byCat[r.categoryId] = (byCat[r.categoryId] || 0) + a; any = true; }
      else if (r.type === 'income') { inc += a; any = true; }
    });
    return { income: inc, expense: exp, byCat: byCat, any: any };
  }
  /** รายรับ/รายจ่าย/คงเหลือ + หมวดที่ใช้มากสุด topN (พร้อมงบถ้าตั้งไว้ · pct = ใช้ไปกี่ % ของงบ ไม่มีงบ = สัดส่วนของรายจ่ายรวม) */
  function monthSummary(records, budgets, mk, topN) {
    var s = monthSums(records, mk), bMap = (budgets && budgets[mk]) || {};
    var cats = Object.keys(s.byCat).map(function (id) {
      var b = num(bMap[id]);
      return { id: id, spent: s.byCat[id], budget: b > 0 ? b : 0, pct: b > 0 ? s.byCat[id] / b * 100 : (s.expense ? s.byCat[id] / s.expense * 100 : 0) };
    }).sort(function (a, b) { return b.spent - a.spent; }).slice(0, topN == null ? 3 : topN);
    var hasBudget = Object.keys(bMap).some(function (k) { return num(bMap[k]) > 0; });
    return { income: s.income, expense: s.expense, balance: s.income - s.expense, cats: cats, any: s.any || hasBudget };
  }
  /** หมวดที่ตั้งงบไว้แล้วใช้ ≥ threshold (ค่าเริ่มต้น 0.9) — ≥ 100% = err, อื่นๆ = warn · เรียงสัดส่วนมากสุดก่อน */
  function budgetAlerts(records, budgets, mk, threshold) {
    var s = monthSums(records, mk), bMap = (budgets && budgets[mk]) || {}, th = threshold == null ? 0.9 : threshold, out = [];
    Object.keys(bMap).forEach(function (id) {
      var b = num(bMap[id]);
      if (!(b > 0)) return;
      var spent = s.byCat[id] || 0, ratio = spent / b;
      if (ratio + 1e-9 < th) return;
      out.push({ kind: 'budget', catId: id, spent: spent, budget: b, pct: Math.floor(ratio * 100 + 1e-9), urgency: ratio >= 1 ? 'err' : 'warn', sort: -ratio });
    });
    return out.sort(function (a, b) { return a.sort - b.sort; });
  }

  /* ── สุขภาพ: ยาที่ถึงเวลาแล้วและยังไม่ติ๊ก (HealthCalc.todayDoses → late = เวลานั้นผ่านไปแล้วและยังไม่กิน) ── */
  function medTodos(doses) {
    return (doses || []).filter(function (d) { return d && !d.taken && d.late; })
      .map(function (d) { return { kind: 'med', dose: d, urgency: 'warn', sort: -0.5 }; });
  }

  /* ── ลงทุน ── */
  /** เปลี่ยนแปลงวันนี้ = มูลค่าตอนนี้เทียบ snapshot ล่าสุดของวันก่อนหน้า (d < today) — ไม่มี = null */
  function dayChange(hist, today, total) {
    var base = null;
    (hist || []).forEach(function (r) { if (r && typeof r.d === 'string' && r.d < today && num(r.v) > 0 && (!base || r.d > base.d)) base = r; });
    if (!base || !isFinite(total)) return null;
    return { delta: total - base.v, pct: (total / base.v - 1) * 100, base: base };
  }
  /** จุดกราฟ 30 วันล่าสุด (วันที่ today-29 … today) จาก snapshot รายวัน · วันนี้ใช้มูลค่าสดแทนถ้ามี · เรียงเก่า→ใหม่ */
  function series30(hist, today, total) {
    var from = addDays(today, -29), by = {};
    (hist || []).forEach(function (r) { if (r && typeof r.d === 'string' && r.d >= from && r.d <= today && isFinite(r.v)) by[r.d] = +r.v; });
    if (isFinite(total) && total > 0) by[today] = total;
    return Object.keys(by).sort().map(function (d) { return { d: d, v: by[d] }; });
  }
  /** กราฟเส้นเล็ก: คืน path ของเส้น/พื้นที่ (viewBox w×h) + ตำแหน่งจุดปลายเป็น % · < 2 จุด = null */
  function spark(points, w, h, pad) {
    if (!points || points.length < 2) return null;
    pad = pad == null ? 4 : pad;
    var vs = points.map(function (p) { return p.v; }), min = Math.min.apply(null, vs), max = Math.max.apply(null, vs), span = max - min || 1;
    var t0 = ymdMs(points[0].d), t1 = ymdMs(points[points.length - 1].d), tspan = t1 - t0 || 1;
    var xy = points.map(function (p) {
      return [pad + (ymdMs(p.d) - t0) / tspan * (w - 2 * pad), h - pad - (p.v - min) / span * (h - 2 * pad)];
    });
    function f(n) { return Math.round(n * 100) / 100; }
    var line = xy.map(function (q, i) { return (i ? 'L' : 'M') + f(q[0]) + ' ' + f(q[1]); }).join(' ');
    var last = xy[xy.length - 1];
    return { line: line, area: line + ' L' + f(last[0]) + ' ' + f(h) + ' L' + f(xy[0][0]) + ' ' + f(h) + ' Z',
      last: { x: f(last[0] / w * 100), y: f(last[1] / h * 100) }, min: min, max: max };
  }
  /** รายการติดตามไม่เกิน n ตัว: หุ้นไทยที่ผู้ใช้เลือกติดตาม → หุ้นนอก → หุ้นที่ถือ (ไม่ซ้ำ, ไม่นับ SET ดัชนี) · คืน [{sym, yahoo, href}] */
  function watchList(thaiWatch, globalWatch, heldTh, heldUs, n) {
    var out = [], seen = {};
    function add(sym, th) {
      sym = String(sym || '').trim().toUpperCase();
      if (!sym || sym === 'SET' || /=F$|^\^|-USD$/.test(sym) || seen[th + sym]) return;
      seen[th + sym] = 1;
      out.push({ sym: sym, th: th, yahoo: th ? sym + '.BK' : sym, href: 'invest-stock.html?sym=' + encodeURIComponent(sym) + (th ? '#th' : '#us') });
    }
    (thaiWatch || []).forEach(function (s) { add(s, true); });
    (globalWatch || []).forEach(function (s) { add(s, false); });
    (heldTh || []).forEach(function (s) { add(s, true); });
    (heldUs || []).forEach(function (s) { add(s, false); });
    return out.slice(0, n == null ? 3 : n);
  }

  /* ── เรียนต่อ ── */
  /** 7 วันล่าสุด (เก่า→วันนี้): done = ฝึกแล้ว · rest = ขาดแต่ยังนับเป็นวันพักในช่วงต่อเนื่อง · miss = ขาด · today = วันนี้ยังไม่ฝึก
      recent = LearnCore.summary().recent (14 วัน) · streak = { count, doneToday } */
  function weekDots(recent, streak) {
    var days = (recent || []).slice(-14), n = days.length;
    var remaining = Math.max(0, num(streak && streak.count) - (streak && streak.doneToday ? 1 : 0));
    var states = new Array(n);
    for (var i = n - 1; i >= 0; i--) {
      var d = days[i];
      if (i === n - 1) { states[i] = d.active ? 'done' : 'today'; continue; }
      if (d.active) { states[i] = 'done'; if (remaining > 0) remaining--; }
      else if (remaining > 0) states[i] = 'rest';
      else states[i] = 'miss';
    }
    return days.map(function (d, i) { return { d: d.d, state: states[i], xp: d.xp }; }).slice(-7);
  }
  function countTrue(obj) {
    var n = 0;
    if (isObj(obj)) Object.keys(obj).forEach(function (k) { if (obj[k]) n++; });
    return n;
  }
  /** วิชาภาษา: 1 แถวต่อภาษาที่มีวลีที่ทำเครื่องหมายแล้ว · meta = ยอดรวมจากหน้าภาษา (ถ้ามี) { 'lang-en': { title, cats:[{name,n}] } } */
  function langRows(progress, meta) {
    var by = {}, order = [];
    if (!isObj(progress)) return [];
    Object.keys(progress).forEach(function (k) {
      var i = k.indexOf(':');
      if (i < 1) return;
      var id = k.slice(0, i), cat = k.slice(i + 1), arr = progress[k];
      var marked = Array.isArray(arr) ? arr.filter(Boolean).length : 0;
      var g = by[id];
      if (!g) { g = by[id] = { id: id, marked: 0, cats: {} }; order.push(id); }
      g.marked += marked; g.cats[cat] = marked;
    });
    return order.filter(function (id) { return by[id].marked > 0; }).map(function (id) {
      var g = by[id], m = meta && meta[id], row = { src: 'lang', id: id, langId: id, marked: g.marked, title: m ? m.title : '', pct: null, next: null, done: null, total: null };
      if (m && m.cats && m.cats.length) {
        var tot = 0, doneN = 0, next = null;
        m.cats.forEach(function (c) {
          tot += c.n;
          var mk = Math.min(g.cats[c.name] || 0, c.n);
          doneN += mk;
          if (!next && mk < c.n) next = c.name;
        });
        row.total = tot; row.done = doneN; row.pct = tot ? Math.min(100, Math.round(doneN / tot * 100)) : null; row.next = next;
      }
      return row;
    }).sort(function (a, b) { return b.marked - a.marked; });
  }
  /** ห้องเรียนธุรกิจ/วิศวกรรม: completed = { 'วิชา:หัวข้อ': true } · topics = [{k:'วิชา:หัวข้อ', title}] ตามลำดับในหน้า (ไม่มี = นับอย่างเดียว) */
  function lbeRow(src, completed, topics) {
    var done = countTrue(completed);
    if (!done) return null;
    var row = { src: src, done: done, total: null, pct: null, next: null };
    if (topics && topics.length) {
      var doneN = 0, next = null;
      topics.forEach(function (t) { if (completed && completed[t.k]) doneN++; else if (!next) next = t.title; });
      row.done = doneN; row.total = topics.length; row.pct = Math.round(doneN / topics.length * 100); row.next = next;
    }
    return row;
  }
  /** กฎหมาย: lessonread = { วิชา: { หัวข้อ: 1 } } → จำนวนหัวข้อที่อ่านแล้วทุกวิชา (ไม่มียอดรวมให้เทียบ) */
  function lawRow(lessonRead) {
    var n = 0;
    if (isObj(lessonRead)) Object.keys(lessonRead).forEach(function (s) { n += countTrue(lessonRead[s]); });
    return n ? { src: 'law', done: n, total: null, pct: null } : null;
  }
  /** ดนตรี/กีฬา/ทำอาหาร: progress = { 'แทร็ก::ลำดับ': true } */
  function hobbyRow(src, progress) {
    var n = countTrue(progress);
    return n ? { src: src, done: n, total: null, pct: null } : null;
  }
  /** รวมแถววิชาทั้งหมด เรียงตามเปิดล่าสุด (nav = { 'หน้า.html': ms }, hrefOf(src) → หน้า) แล้วตามความคืบหน้ามาก→น้อย
      ที่เปิดไว้แต่ยังไม่มีความคืบหน้า (xp > 0 หรือเคยเปิด) ได้แถวแบบมีเท่าที่มี (done = null) */
  function sortStudy(rows, nav, hrefOf) {
    return rows.map(function (r, i) {
      var h = hrefOf(r.src);
      r.lastOpen = num(nav && nav[h]) || 0;
      r._i = i;
      return r;
    }).sort(function (a, b) {
      return (b.lastOpen - a.lastOpen) || (num(b.pct) - num(a.pct)) || (num(b.done || b.marked) - num(a.done || a.marked)) || (a._i - b._i);
    }).map(function (r) { delete r._i; return r; });
  }

  /** ยอดรวมจากหน้าที่ดึงมา: ภาษา lang-data { 'lang-en': { title, phrases: { หมวด: [วลี…] } } } */
  function langMeta(langData) {
    var out = {};
    if (!isObj(langData)) return out;
    Object.keys(langData).forEach(function (id) {
      var l = langData[id];
      if (!l || !isObj(l.phrases)) return;
      out[id] = { title: String(l.title || id), cats: Object.keys(l.phrases).map(function (name) { return { name: name, n: Array.isArray(l.phrases[name]) ? l.phrases[name].length : 0 }; }) };
    });
    return out;
  }
  /** หัวข้อของห้องเรียน (ลำดับเดียวกับ SUBJECTS ในหน้า): ธุรกิจ = business{id:{title}} · วิศวกรรม = engineering[] + elec-maint[] */
  function lbeTopics(src, course) {
    var out = [];
    if (!isObj(course)) return out;
    if (src === 'biz' && isObj(course.business)) Object.keys(course.business).forEach(function (id) { out.push({ k: 'business:' + id, title: String((course.business[id] || {}).title || id) }); });
    if (src === 'eng') ['engineering', 'elec-maint'].forEach(function (sj) {
      (Array.isArray(course[sj]) ? course[sj] : []).forEach(function (t) { if (t && t.id) out.push({ k: sj + ':' + t.id, title: String(t.title || t.id) }); });
    });
    return out;
  }
  function cacheFresh(c, now) { return !!c && isObj(c) && now - num(c.ts) < CACHE_TTL; }

  /* ── จัดหน้าแรก ── */
  var ROWS = ['todo', 'money-invest', 'learn', 'health-meals'];
  var BOXES = { todo: ['todo'], 'money-invest': ['money', 'invest'], learn: ['learn'], 'health-meals': ['health', 'meals'] };
  var BOX_IDS = ['todo', 'money', 'invest', 'learn', 'health', 'meals'];
  function cleanLayout(raw) {
    var order = [], hidden = [];
    if (isObj(raw)) {
      (Array.isArray(raw.order) ? raw.order : []).forEach(function (r) { if (ROWS.indexOf(r) >= 0 && order.indexOf(r) < 0) order.push(r); });
      (Array.isArray(raw.hidden) ? raw.hidden : []).forEach(function (b) { if (BOX_IDS.indexOf(b) >= 0 && hidden.indexOf(b) < 0) hidden.push(b); });
    }
    ROWS.forEach(function (r) { if (order.indexOf(r) < 0) order.push(r); });
    return { v: 1, order: order, hidden: hidden };
  }
  /** กล่อง → { order (ลำดับในหน้า), hidden, wide (กล่องคู่ที่อีกใบถูกซ่อน = เต็มความกว้าง) } */
  function layoutPlan(layout) {
    var l = cleanLayout(layout), plan = {};
    l.order.forEach(function (row, ri) {
      var boxes = BOXES[row], visible = boxes.filter(function (b) { return l.hidden.indexOf(b) < 0; });
      boxes.forEach(function (b, bi) {
        plan[b] = { order: ri * 10 + bi, hidden: l.hidden.indexOf(b) >= 0, wide: boxes.length === 1 || visible.length === 1 };
      });
    });
    return plan;
  }
  function moveRow(layout, row, dir) {
    var l = cleanLayout(layout), i = l.order.indexOf(row), j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= l.order.length) return l;
    var t = l.order[i]; l.order[i] = l.order[j]; l.order[j] = t;
    return l;
  }
  function toggleBox(layout, box, show) {
    var l = cleanLayout(layout), i = l.hidden.indexOf(box);
    if (BOX_IDS.indexOf(box) < 0) return l;
    if (show && i >= 0) l.hidden.splice(i, 1);
    if (!show && i < 0) l.hidden.push(box);
    return l;
  }

  /* ── ใช้ล่าสุด (หน้าหมวด) ── */
  /** nav = { 'หน้า.html': ms } · hrefs = หน้าที่อยู่ในหมวด (href เต็มรวม hash/query) → [{href, ts}] ใหม่สุดก่อน ไม่เกิน n; ไม่เคยเปิดเลย = [] */
  function lastUsed(nav, hrefs, n) {
    var out = [], seen = {};
    (hrefs || []).forEach(function (h) {
      var page = String(h).split('#')[0].split('?')[0];
      var ts = num(nav && nav[page]);
      if (ts > 0 && !seen[page]) { seen[page] = 1; out.push({ href: h, ts: ts }); }
    });
    return out.sort(function (a, b) { return b.ts - a.ts; }).slice(0, n == null ? 4 : n);
  }

  return {
    URG: URG, CACHE_TTL: CACHE_TTL, ROWS: ROWS, BOXES: BOXES, BOX_IDS: BOX_IDS,
    urgencyOfDays: urgencyOfDays, sortTodos: sortTodos, estMinutes: estMinutes, reviewTodos: reviewTodos,
    monthSummary: monthSummary, budgetAlerts: budgetAlerts, medTodos: medTodos,
    dayChange: dayChange, series30: series30, spark: spark, watchList: watchList,
    weekDots: weekDots, langRows: langRows, lbeRow: lbeRow, lawRow: lawRow, hobbyRow: hobbyRow, sortStudy: sortStudy,
    langMeta: langMeta, lbeTopics: lbeTopics, cacheFresh: cacheFresh,
    cleanLayout: cleanLayout, layoutPlan: layoutPlan, moveRow: moveRow, toggleBox: toggleBox, lastUsed: lastUsed,
    addDays: addDays
  };
});
