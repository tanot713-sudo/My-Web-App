/* ══════════════════════════════════════════════════════════════════
   หน้า "วันนี้" (ROADMAP Phase 3) — แดชบอร์ดรวมข้อมูลจากทุกด้าน อ่านอย่างเดียว ไม่ยิงเครือข่ายเอง
   อ่านผ่าน TanotData.read / readIdb (tanot-data.js) แล้ววาดใหม่เมื่อข้อมูลเปลี่ยน (ซิงก์จากเครื่องอื่น / แท็บอื่น / เพิ่มด่วน)
   คีย์ที่อ่าน (รูปแบบต้องตรงกับหน้าเจ้าของข้อมูล): budget:records|budgets|categories,
   การ์ดทบทวน/XP/วันติดต่อกันผ่าน learn-core.js (lang-practice:srs, lbe:<business|engineering>:srs, tanot-barprep/notes, tanot:learn:*
   + ยอดเดิมของหน้าเรียนต่างๆ — รายชื่อคีย์อยู่ใน LEGACY ของ learn-core.js), tanot:invest:thstock|globalstock + tanot:invest:cache:[us:]<sym>,
   tanot:word:autosave, tanot:sheet:autosave, tanot:cad:autosave, tanot-report-dashboard/reports (IndexedDB),
   tanot:insurance:policies (รูปแบบกรมธรรม์ + การนับวันต่ออายุอยู่ใน insurance-calc.js — หน้านี้โหลดไฟล์นั้นด้วย),
   บันทึกงานบำรุงรักษา: tanot:mnt:assets|plans|settings + IndexedDB tanot-mnt-<ปีนี้>/insp, tanot-mnt-<ปีก่อน>/insp, tanot-mnt/wo|woev
   (รูปแบบ + การคำนวณรอบ/ใบงานอยู่ใน mnt-calc.js — หน้านี้โหลดไฟล์นั้นด้วย),
   คลังใบเสร็จ: tanot:receipts:items (รูปแบบใบเสร็จ + วันหมดประกันสินค้าอยู่ใน receipts-calc.js — หน้านี้โหลดไฟล์นั้นด้วย; การ์ดซ่อนไว้จนกว่าจะมีใบเสร็จที่ระบุประกัน),
   สุขภาพ: tanot:health:vitals|meds|intake|ranges|workouts|settings (รูปแบบ + ช่วงปกติ + ตารางกินยาอยู่ใน health-calc.js — หน้านี้โหลดไฟล์นั้นด้วย)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var TD = window.TanotData;
  function rd(k, d) {
    if (TD && TD.read) return TD.read(k, d);
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; }
  }
  function rdIdb(db, store, opts) { return TD && TD.readIdb ? TD.readIdb(db, store, opts) : Promise.resolve([]); }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function icon(name, cls) { return '<svg class="ome-icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function num(n, d) { return (Math.round(n * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toLocaleString('th-TH', { maximumFractionDigits: d || 0 }); }
  function baht(n) { return '฿' + num(n, n % 1 ? 2 : 0); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isArr(v) { return Array.isArray(v); }
  function emptyHtml(ic, text, href, label) {
    return '<div class="empty">' + icon(ic) + '<p>' + esc(text) + '</p>' +
      (href ? '<a class="btn sm" href="' + href + '">' + esc(label) + '</a>' : '') + '</div>';
  }

  /* ── หัวหน้า ── */
  function renderHead() {
    var now = new Date(), h = now.getHours();
    $('greet').textContent = h < 12 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
    $('dateLine').textContent = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* ── ใช้จ่ายเดือนนี้เทียบงบ ── */
  function sumExpense(records, monthKey, maxDay) {
    var t = 0;
    records.forEach(function (r) {
      if (!r || r.type !== 'expense' || typeof r.date !== 'string' || r.date.slice(0, 7) !== monthKey) return;
      if (maxDay && parseInt(r.date.slice(8, 10), 10) > maxDay) return;
      t += Number(r.amount) || 0;
    });
    return t;
  }
  function renderSpend() {
    var el = $('spendBody');
    var records = rd('budget:records', []);
    if (!isArr(records)) records = [];
    var now = new Date();
    var mk = now.getFullYear() + '-' + pad2(now.getMonth() + 1);
    var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var pk = prev.getFullYear() + '-' + pad2(prev.getMonth() + 1);
    var spent = sumExpense(records, mk);
    var prevSame = sumExpense(records, pk, now.getDate());
    var budgets = rd('budget:budgets', {});
    var bMap = (budgets && budgets[mk]) || {};
    var cats = rd('budget:categories', []);
    if (!isArr(cats)) cats = [];
    var catName = {};
    cats.forEach(function (c) { if (c) catName[c.id] = c.name; });

    var byCat = {};
    records.forEach(function (r) {
      if (r && r.type === 'expense' && typeof r.date === 'string' && r.date.slice(0, 7) === mk) byCat[r.categoryId] = (byCat[r.categoryId] || 0) + (Number(r.amount) || 0);
    });
    var budgetIds = Object.keys(bMap).filter(function (k) { return Number(bMap[k]) > 0; });
    var budgetTotal = budgetIds.reduce(function (s, k) { return s + Number(bMap[k]); }, 0);

    if (!records.length && !budgetIds.length) {
      el.innerHTML = emptyHtml('wallet', 'ยังไม่มีรายการเดือนนี้', 'budget.html', 'เปิดรายรับรายจ่าย');
      return;
    }

    var html = '<div class="big">' + baht(spent) + (budgetTotal ? ' <small>จากงบ ' + baht(budgetTotal) + '</small>' : '') + '</div>';
    if (budgetTotal) {
      var pct = spent / budgetTotal * 100;
      var cls = pct >= 100 ? 'err' : pct >= 80 ? 'warn' : '';
      html += '<div class="bar ' + cls + '" role="progressbar" aria-label="ใช้จ่ายเทียบงบ" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(100, Math.round(pct)) + '"><i style="width:' + Math.min(100, pct) + '%"></i></div>';
      html += '<div class="sub">' + (spent > budgetTotal ? 'เกินงบ ' + baht(spent - budgetTotal) : 'เหลือ ' + baht(budgetTotal - spent)) + ' · ใช้ไป ' + Math.round(pct) + '%</div>';
    }
    if (prevSame > 0) {
      var d = (spent - prevSame) / prevSame * 100;
      html += '<div class="sub"><span class="badge ' + (d > 0 ? 'warn' : 'ok') + '">' + (d > 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(d)) + '%</span> เทียบช่วงเดียวกันเดือนก่อน</div>';
    }

    // หมวด: ที่ตั้งงบไว้ (เรียงตามสัดส่วนที่ใช้) ถ้าไม่มีงบเลยแสดงหมวดที่ใช้มากสุด
    var rows = budgetIds.length
      ? budgetIds.map(function (k) { return { id: k, spent: byCat[k] || 0, budget: Number(bMap[k]) }; })
          .sort(function (a, b) { return b.spent / b.budget - a.spent / a.budget; })
      : Object.keys(byCat).map(function (k) { return { id: k, spent: byCat[k], budget: 0 }; })
          .sort(function (a, b) { return b.spent - a.spent; });
    rows.slice(0, 4).forEach(function (r) {
      var p = r.budget ? r.spent / r.budget * 100 : (spent ? r.spent / spent * 100 : 0);
      html += '<div class="cat-row"><span class="name">' + esc(catName[r.id] || 'ไม่ทราบหมวดหมู่') + '</span>' +
        '<span class="val">' + baht(r.spent) + (r.budget ? ' / ' + baht(r.budget) : '') + '</span>' +
        '<div class="bar ' + (r.budget && p >= 100 ? 'err' : '') + '"><i style="width:' + Math.min(100, p) + '%"></i></div></div>';
    });
    el.innerHTML = html;
  }

  /* ── การ์ดทบทวน + วันติดต่อกัน (learn-core.js — XP/วันติดต่อกัน/เป้ารายวันชุดเดียวทั้งเว็บ) ── */
  var LC = window.LearnCore;
  var REVIEW_SOURCES = ['lang', 'law', 'biz', 'eng'];
  function dueCounts(lawNotes) {
    return LC ? LC.dueCounts(lawNotes) : { lang: 0, law: 0, biz: 0, eng: 0 };
  }
  function renderReview(counts) {
    var total = 0;
    REVIEW_SOURCES.forEach(function (k) { total += counts[k]; });
    var html = '<div class="big">' + num(total) + ' <small>ใบ</small></div>';
    if (!total) {
      $('reviewBody').innerHTML = html + '<div class="sub">ไม่มีการ์ดค้างทบทวน</div>';
      return;
    }
    html += '<div class="links">' + REVIEW_SOURCES.filter(function (k) { return counts[k] > 0; }).map(function (k) {
      return '<a class="badge accent" href="' + LC.SOURCES[k].href + '">' + esc(LC.SOURCES[k].label) + ' ' + num(counts[k]) + '</a>';
    }).join('') + '</div>';
    html += '<a class="btn primary" href="review.html">ทบทวน</a>';
    $('reviewBody').innerHTML = html;
  }

  function renderStreak() {
    if (!LC) return;
    var s = LC.summary(), st = s.streak;
    var pct = Math.min(100, s.goal ? Math.round(s.todayXp / s.goal * 100) : 0);
    var goal = '<div class="sub">XP วันนี้ ' + num(s.todayXp) + ' / ' + num(s.goal) + '</div>' +
      '<div class="bar' + (s.goalMet ? ' ok' : '') + '"><i style="width:' + pct + '%"></i></div>';
    if (!st.count && !st.doneToday) {
      $('streakBody').innerHTML = '<div class="stat">' + icon('flame') + '<div class="big">0 <small>วัน</small></div></div>' +
        '<span class="badge warn">ยังไม่ได้ฝึกวันนี้</span>' + goal;
      return;
    }
    var extra = [];
    if (st.longest > st.count) extra.push('สูงสุด ' + num(st.longest) + ' วัน');
    if (st.restUsed) extra.push('พัก ' + num(st.restUsed) + ' วัน');
    $('streakBody').innerHTML = '<div class="stat">' + icon('flame', 'flame') + '<div class="big">' + num(st.count) + ' <small>วัน</small></div></div>' +
      '<div><span class="badge ' + (st.doneToday ? 'ok' : 'warn') + '">' + (st.doneToday ? 'ฝึกวันนี้แล้ว' : 'ยังไม่ได้ฝึกวันนี้') + '</span></div>' +
      (extra.length ? '<div class="sub">' + esc(extra.join(' · ')) + '</div>' : '') + goal;
  }

  /* ── หุ้นที่ติดตาม (พอร์ตของหน้าหุ้นไทย/ต่างประเทศ + ราคาล่าสุดจากแคชของหน้าเหล่านั้น) ── */
  var STOCK_MARKETS = [
    { key: 'tanot:invest:thstock', cache: 'tanot:invest:cache:', cur: '฿', tag: 'TH', href: 'invest-thai-stock.html', unit: 'หุ้น' },
    { key: 'tanot:invest:globalstock', cache: 'tanot:invest:cache:us:', cur: '$', tag: 'US', href: 'invest-global-stock.html', unit: 'หุ้น' }
  ];
  function lastPrice(cacheKey) {
    var c = rd(cacheKey, null);
    if (!c || !isArr(c.c) || !c.c.length) return null;
    var closes = c.c, last = Number(closes[closes.length - 1]), prev = closes.length > 1 ? Number(closes[closes.length - 2]) : NaN;
    if (!isFinite(last)) return null;
    return { price: last, day: isFinite(prev) && prev > 0 ? (last / prev - 1) * 100 : null, ts: Number(c.ts) || 0 };
  }
  function pctHtml(p, label) {
    if (p == null) return '';
    return '<span class="' + (p >= 0 ? 'up' : 'down') + '">' + (p >= 0 ? '+' : '−') + num(Math.abs(p), 1) + '%' + (label || '') + '</span>';
  }
  function renderStocks() {
    var holdings = [];
    STOCK_MARKETS.forEach(function (m) {
      var pf = rd(m.key, []), agg = {};
      if (!isArr(pf)) return;
      pf.forEach(function (h) {
        if (!h || !h.sym) return;
        var a = agg[h.sym] || (agg[h.sym] = { shares: 0, cost: 0 });
        a.shares += Number(h.shares) || 0;
        a.cost += (Number(h.shares) || 0) * (Number(h.cost) || 0);
      });
      Object.keys(agg).forEach(function (sym) {
        var a = agg[sym];
        holdings.push({ m: m, sym: sym, shares: a.shares, cost: a.cost, q: lastPrice(m.cache + sym) });
      });
    });
    var el = $('stockBody');
    if (!holdings.length) { el.innerHTML = emptyHtml('trending-up', 'ยังไม่มีหุ้นในพอร์ต', 'invest-thai-stock.html', 'เปิดหน้าหุ้น'); return; }
    holdings.sort(function (a, b) { return b.cost - a.cost; });
    el.innerHTML = '<div class="list">' + holdings.slice(0, 6).map(function (h) {
      var avg = h.shares ? h.cost / h.shares : 0;
      var pl = h.q && avg > 0 ? (h.q.price / avg - 1) * 100 : null;
      var old = h.q && h.q.ts && Date.now() - h.q.ts > 86400000 * 1.5;
      return '<a class="list-row" href="' + h.m.href + '"><span class="lead">' + h.m.tag + '</span>' +
        '<div class="grow"><div class="title">' + esc(h.sym) + '</div><div class="meta">' + num(h.shares) + ' ' + h.m.unit + ' · ทุน ' + h.m.cur + num(avg, 2) + '</div></div>' +
        '<div class="right">' + (h.q
          ? '<div class="price">' + h.m.cur + num(h.q.price, 2) + '</div><div class="meta">' + pctHtml(h.q.day, ' วัน') + (pl != null ? ' · P/L ' + pctHtml(pl) : '') +
            (old ? ' · ณ ' + new Date(h.q.ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '') + '</div>'
          : '<div class="meta">ยังไม่มีราคา</div>') + '</div></a>';
    }).join('') + '</div>';
  }

  /* ── ไฟล์ล่าสุด ── */
  function snippet(html) {
    try {
      var t = new DOMParser().parseFromString(String(html).slice(0, 4000), 'text/html').body.textContent || '';
      return t.replace(/\s+/g, ' ').trim().slice(0, 48);
    } catch (e) { return ''; }
  }
  function ago(ts) {
    var s = Math.max(0, (Date.now() - ts) / 1000);
    var units = [['day', 86400], ['hour', 3600], ['minute', 60]];
    try {
      var f = new Intl.RelativeTimeFormat('th', { numeric: 'auto' });
      for (var i = 0; i < units.length; i++) if (s >= units[i][1]) return f.format(-Math.floor(s / units[i][1]), units[i][0]);
      return 'เมื่อสักครู่';
    } catch (e) { return new Date(ts).toLocaleDateString('th-TH'); }
  }
  function renderFiles(reports) {
    var files = [];
    var w = rd('tanot:word:autosave', null);
    if (w && w.html) files.push({ ts: Number(w.savedAt) || 0, name: snippet(w.html) || 'เอกสาร Word', kind: 'Word ฉบับร่าง', ic: 'file-text', href: 'word.html' });
    // Excel/CAD เก็บฉบับร่างโดยไม่มีเวลาบันทึก — แสดงท้ายรายการโดยไม่ระบุเวลา
    if (TD && TD.raw && TD.raw('tanot:sheet:autosave')) files.push({ ts: 0, name: 'ตาราง Excel', kind: 'Excel ฉบับร่าง', ic: 'file-spreadsheet', href: 'excel.html' });
    if (TD && TD.raw && TD.raw('tanot:cad:autosave')) files.push({ ts: 0, name: 'แบบ CAD', kind: 'CAD ฉบับร่าง', ic: 'box', href: 'cad.html' });
    (reports || []).forEach(function (r) {
      if (r) files.push({ ts: Number(r.savedAt) || 0, name: r.name || r.fileName || 'รายงาน', kind: 'รายงาน', ic: 'chart-pie', href: 'report-dashboard.html' });
    });
    var el = $('filesBody');
    if (!files.length) { el.innerHTML = emptyHtml('folder-open', 'ยังไม่มีไฟล์ล่าสุด', 'word.html', 'เปิด Word'); return; }
    files.sort(function (a, b) { return b.ts - a.ts; });
    el.innerHTML = '<div class="list">' + files.slice(0, 6).map(function (f) {
      return '<a class="list-row" href="' + f.href + '"><span class="lead">' + icon(f.ic) + '</span>' +
        '<div class="grow"><div class="title">' + esc(f.name) + '</div><div class="meta">' + esc(f.kind) + (f.ts ? ' · ' + esc(ago(f.ts)) : '') + '</div></div></a>';
    }).join('') + '</div>';
  }

  /* ── ต่ออายุประกัน (กรมธรรม์ที่ครบกำหนดภายใน 60 วัน รวมที่เลยกำหนด) ── */
  function renderInsurance() {
    var el = $('insBody'), IC = window.InsuranceCalc;
    var list = rd('tanot:insurance:policies', []);
    if (!IC || !isArr(list) || !list.length) { el.innerHTML = emptyHtml('shield', 'ยังไม่มีกรมธรรม์', 'insurance.html', 'เปิดหน้าประกัน'); return; }
    var due = IC.renewals(list, new Date(), 60);
    if (!due.length) { el.innerHTML = emptyHtml('shield', 'ไม่มีกรมธรรม์ที่ใกล้ต่ออายุ'); return; }
    el.innerHTML = '<div class="list">' + due.slice(0, 6).map(function (r) {
      var p = r.policy, d = r.days;
      var title = [p.insurer, p.name].filter(Boolean).join(' · ') || IC.TYPES[p.type] || 'กรมธรรม์';
      var badge = d < 0 ? '<span class="badge err">เลยกำหนด ' + num(-d) + ' วัน</span>'
        : d === 0 ? '<span class="badge warn">วันนี้</span>'
        : '<span class="badge ' + (d <= 30 ? 'warn' : 'info') + '">อีก ' + num(d) + ' วัน</span>';
      return '<a class="list-row" href="insurance.html"><span class="lead">' + icon('shield') + '</span>' +
        '<div class="grow"><div class="title">' + esc(title) + '</div><div class="meta">' + esc(IC.TYPES[p.type] || '') +
        (p.premium ? ' · ' + baht(p.premium) : '') + '</div></div><div class="right">' + badge + '</div></a>';
    }).join('') + '</div>';
  }

  /* ── ประกันสินค้าใกล้หมด (ภายใน 60 วัน) — การ์ดโผล่เมื่อมีใบเสร็จที่ระบุประกันอย่างน้อยหนึ่งใบ ── */
  function renderWarranty() {
    var card = $('warCard'), el = $('warBody'), RC = window.ReceiptsCalc;
    var list = rd('tanot:receipts:items', []);
    var withWar = RC && isArr(list) ? list.filter(function (r) { return r && RC.warrantyEnd(r); }) : [];
    card.hidden = !withWar.length;
    if (!withWar.length) return;
    var due = RC.expiring(withWar, new Date(), 60);
    if (!due.length) { el.innerHTML = emptyHtml('shield', 'ไม่มีประกันสินค้าที่ใกล้หมด'); return; }
    el.innerHTML = '<div class="list">' + due.slice(0, 6).map(function (x) {
      var r = x.receipt, d = x.days;
      var badge = d === 0 ? '<span class="badge warn">วันนี้</span>' : '<span class="badge ' + (d <= 30 ? 'warn' : 'info') + '">อีก ' + num(d) + ' วัน</span>';
      return '<a class="list-row" href="receipts.html"><span class="lead">' + icon('receipt') + '</span>' +
        '<div class="grow"><div class="title">' + esc(RC.warrantyLabel(r)) + '</div><div class="meta">' + esc([r.store, 'หมด ' + RC.thDate(x.end)].filter(Boolean).join(' · ')) + '</div></div>' +
        '<div class="right">' + badge + '</div></a>';
    }).join('') + '</div>';
  }

  /* ── งานบำรุงรักษา (เลยกำหนด/ถึงกำหนด + ใบสั่งงานที่เปิดอยู่) ── */
  var mntToken = 0;
  function renderMaintenance() {
    var el = $('mntBody'), M = window.MntCalc, token = ++mntToken;
    var assets = rd('tanot:mnt:assets', []), plans = rd('tanot:mnt:plans', []), settings = rd('tanot:mnt:settings', {});
    if (!M || !isArr(assets) || !assets.length) { el.innerHTML = emptyHtml('wrench', 'ยังไม่มีทะเบียนอุปกรณ์', 'maintenance.html', 'บันทึกงานบำรุงรักษา'); return Promise.resolve(); }
    var Y = new Date().getFullYear();
    return Promise.all([rdIdb('tanot-mnt-' + Y, 'insp'), rdIdb('tanot-mnt-' + (Y - 1), 'insp'), rdIdb('tanot-mnt', 'wo'), rdIdb('tanot-mnt', 'woev')]).then(function (r) {
      if (token !== mntToken) return;
      var today = M.ymd(new Date()), done = M.doneIndex([].concat(r[0] || [], r[1] || []));
      var list = M.dueList({ assets: assets, plans: isArr(plans) ? plans : [], settings: settings || {}, done: done, today: today, ahead: 0 });
      var overdue = list.filter(function (x) { return x.state === 'overdue'; }), due = list.filter(function (x) { return x.state === 'due'; });
      var evBy = {};
      (r[3] || []).forEach(function (e) { (evBy[e.wo] = evBy[e.wo] || []).push(e); });
      var openWo = (r[2] || []).filter(function (w) { var s = M.foldWo(w, evBy[w.id] || []).status; return s === 'open' || s === 'progress' || s === 'parts'; }).length;
      if (!list.length && !openWo) { el.innerHTML = emptyHtml('circle-check', 'ไม่มีงานค้าง'); return; }
      // รายการ: เลยกำหนดก่อน → ถึงกำหนด (M1 ขึ้นไปก่อนรายวัน/สัปดาห์ เพื่อไม่ให้งานรายวันกลบงานรอบยาว)
      var rank = function (x) { return x.plan.freq === 'Daily' || x.plan.freq === 'Weekly' ? 1 : 0; };
      var shown = overdue.concat(due.slice().sort(function (a, b) { return rank(a) - rank(b); })).slice(0, 5);
      var b = function (cls, label, n) { return '<span class="badge ' + cls + '">' + label + ' ' + num(n) + '</span>'; };
      el.innerHTML = '<div class="links">' + b(overdue.length ? 'err' : '', 'เลยกำหนด', overdue.length) + b(due.length ? 'warn' : '', 'ถึงกำหนด', due.length) + b(openWo ? 'info' : '', 'ใบงานเปิด', openWo) + '</div>' +
        (shown.length ? '<div class="list">' + shown.map(function (x) {
          var d = M.parseYmd(x.window.end), when = x.state === 'overdue' ? 'เลย ' + num(x.daysLate) + ' วัน' : 'ภายใน ' + d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
          return '<a class="list-row" href="maintenance.html#asset=' + encodeURIComponent(x.asset.id) + '"><span class="lead">' + icon('wrench') + '</span>' +
            '<div class="grow"><div class="title">' + esc(x.asset.code + ' · ' + x.asset.name) + '</div><div class="meta">' + esc(M.FREQ_LABEL[x.plan.freq] + ' · ' + when) + '</div></div>' +
            '<div class="right"><span class="badge ' + (x.state === 'overdue' ? 'err' : 'warn') + '">' + (x.state === 'overdue' ? 'เลยกำหนด' : 'ถึงกำหนด') + '</span></div></a>';
        }).join('') + '</div>' : '');
    }).catch(function () { if (token === mntToken) el.innerHTML = emptyHtml('wrench', 'อ่านข้อมูลบำรุงรักษาไม่ได้', 'maintenance.html', 'เปิดหน้าบำรุงรักษา'); });
  }

  /* ── สุขภาพ (ค่าล่าสุด + ยาที่ยังไม่ได้กินวันนี้) ── */
  function renderHealth() {
    var el = $('healthBody'), HC = window.HealthCalc;
    var vitals = rd('tanot:health:vitals', []), meds = rd('tanot:health:meds', []), workouts = rd('tanot:health:workouts', []);
    if (!HC || (!isArr(vitals) || !vitals.length) && (!isArr(meds) || !meds.length) && (!isArr(workouts) || !workouts.length)) { el.innerHTML = emptyHtml('heart-pulse', 'ยังไม่มีข้อมูลสุขภาพ', 'health.html', 'เปิดหน้าสุขภาพ'); return; }
    var s = HC.summary(isArr(vitals) ? vitals : [], isArr(meds) ? meds : [], rd('tanot:health:intake', []), Date.now());
    var ranges = rd('tanot:health:ranges', {});
    var chips = HC.GROUPS.map(function (g) {
      var l = s.latest[g.fields[0]];
      if (!l || (g.fields.length > 1 && !s.latest[g.fields[1]])) return '';
      var bad = g.fields.some(function (f) { var st = HC.status(s.latest[f].v, HC.rangeOf(f, ranges)); return st === 'warn' || st === 'err'; });
      var err = g.fields.some(function (f) { return HC.status(s.latest[f].v, HC.rangeOf(f, ranges)) === 'err'; });
      return '<span class="badge ' + (err ? 'err' : bad ? 'warn' : '') + '" data-h="' + g.key + '">' + esc(g.label) + ' ' +
        g.fields.map(function (f) { return num(s.latest[f].v, HC.METRICS[f].dec); }).join('/') + '</span>';
    }).join('');
    var html = chips ? '<div class="links">' + chips + '</div>' : '';
    if (!s.total) html += '<div class="sub">วันนี้ไม่มียาที่ต้องกิน</div>';
    else if (!s.pending.length) html += '<span class="badge ok">กินยาครบแล้ววันนี้</span>';
    else {
      html += '<div class="sub">ยาที่ยังไม่ได้กินวันนี้ ' + num(s.pending.length) + ' มื้อ</div><div class="list">' + s.pending.slice(0, 5).map(function (d) {
        return '<a class="list-row" href="health.html"><span class="lead">' + icon('clock') + '</span><div class="grow"><div class="title">' + esc(d.med.name) + '</div>' +
          '<div class="meta">' + d.time + ' น.' + (d.med.dose ? ' · ' + esc(d.med.dose) : '') + '</div></div>' +
          (d.late ? '<div class="right"><span class="badge warn">เลยเวลา</span></div>' : '') + '</a>';
      }).join('') + '</div>';
    }
    if (isArr(workouts) && workouts.length) {
      var ws = HC.workoutSummary(workouts, rd('tanot:health:settings', {}), Date.now());
      html += '<div class="sub" data-h="workout">ออกกำลังกายสัปดาห์นี้ ' + num(ws.weekMinutes, 1) + ' / ' + num(ws.goal) + ' นาที</div>';
    }
    el.innerHTML = html;
  }

  /* ── วาดทั้งหน้า ── */
  var rendering = false, again = false;
  function renderAll() {
    if (rendering) { again = true; return; }
    rendering = true;
    renderHead();
    renderSpend();
    renderStocks();
    renderStreak();
    renderInsurance();
    renderMaintenance();
    renderHealth();
    renderWarranty();
    Promise.all([rdIdb('tanot-barprep', 'notes'), rdIdb('tanot-report-dashboard', 'reports', { last: 5 })]).then(function (r) {
      renderReview(dueCounts(r[0]));
      renderFiles(r[1]);
    }).catch(function () {
      renderReview(dueCounts([]));
      renderFiles([]);
    }).then(function () {
      rendering = false;
      if (again) { again = false; renderAll(); }
    });
  }
  var timer = 0;
  function renderSoon() { clearTimeout(timer); timer = setTimeout(renderAll, 200); }

  $('qaExpense').addEventListener('click', function () { openQuick('expense'); });
  $('qaIncome').addEventListener('click', function () { openQuick('income'); });
  $('qaSearch').addEventListener('click', function () { if (window.openOmePalette) window.openOmePalette(); });
  $('qaMenu').addEventListener('click', function () { var b = document.querySelector('.ome-hamburger'); if (b) b.click(); });

  var qaLoading = null;
  function openQuick(type) {
    if (window.OmeQuickAdd) { window.OmeQuickAdd.open({ type: type }); return; }
    if (!qaLoading) {
      qaLoading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'quick-add.js';
        s.onload = resolve;
        s.onerror = function () { qaLoading = null; reject(new Error('quick-add.js')); };
        document.head.appendChild(s);
      });
    }
    qaLoading.then(function () { window.OmeQuickAdd.open({ type: type }); }, function () {});
  }

  renderAll();
  window.addEventListener('tanot:quickadd', renderSoon);
  window.addEventListener('tanot:learn', renderSoon);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') renderSoon(); });
  if (TD && TD.onChange) TD.onChange(renderSoon);
})();
