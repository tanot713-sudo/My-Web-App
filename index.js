/* ══════════════════════════════════════════════════════════════════
   หน้า "วันนี้" (ROADMAP Phase 3) — แดชบอร์ดรวมข้อมูลจากทุกด้าน อ่านอย่างเดียว ไม่ยิงเครือข่ายเอง
   อ่านผ่าน TanotData.read / readIdb (tanot-data.js) แล้ววาดใหม่เมื่อข้อมูลเปลี่ยน (ซิงก์จากเครื่องอื่น / แท็บอื่น / เพิ่มด่วน)
   คีย์ที่อ่าน (รูปแบบต้องตรงกับหน้าเจ้าของข้อมูล): budget:records|budgets|categories, lang-practice:srs|streak, lbe:<business|engineering>:srs,
   tanot-barprep/notes (IndexedDB) + tanot:barprep:activity, tanot:invest:thstock|globalstock + tanot:invest:cache:[us:]<sym>,
   tanot:word:autosave, tanot:sheet:autosave, tanot:cad:autosave, tanot-report-dashboard/reports (IndexedDB),
   tanot:insurance:policies (รูปแบบกรมธรรม์ + การนับวันต่ออายุอยู่ใน insurance-calc.js — หน้านี้โหลดไฟล์นั้นด้วย)
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
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
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

  /* ── การ์ดทบทวน + วันติดต่อกัน ── */
  var REVIEW_SOURCES = [
    { key: 'lang', label: 'ภาษา', href: 'languages.html' },
    { key: 'law', label: 'กฎหมาย', href: 'classroom-law.html' },
    { key: 'biz', label: 'ธุรกิจ', href: 'classroom-business.html' },
    { key: 'eng', label: 'วิศวกรรม', href: 'classroom-engineering.html' }
  ];
  function countDue(map, field, now) {
    var n = 0;
    if (!map || typeof map !== 'object') return 0;
    Object.keys(map).forEach(function (k) { var r = map[k]; if (r && typeof r === 'object' && Number(r[field]) <= now) n++; });
    return n;
  }
  function dueCounts(lawNotes) {
    var now = Date.now();
    var law = 0;
    (lawNotes || []).forEach(function (n) { if (n && Number(n.dueAt) <= now) law++; });
    return {
      lang: countDue(rd('lang-practice:srs', {}), 'dueAt', now),
      law: law,
      biz: countDue(rd('lbe:business:srs', {}), 'due', now),
      eng: countDue(rd('lbe:engineering:srs', {}), 'due', now)
    };
  }
  function renderReview(counts) {
    var total = 0, top = null;
    REVIEW_SOURCES.forEach(function (s) {
      total += counts[s.key];
      if (counts[s.key] > 0 && (!top || counts[s.key] > counts[top.key])) top = s;
    });
    var html = '<div class="big">' + num(total) + ' <small>ใบ</small></div>';
    if (!total) {
      $('reviewBody').innerHTML = html + '<div class="sub">ไม่มีการ์ดค้างทบทวน</div>';
      return;
    }
    html += '<div class="links">' + REVIEW_SOURCES.filter(function (s) { return counts[s.key] > 0; }).map(function (s) {
      return '<a class="badge accent" href="' + s.href + '">' + esc(s.label) + ' ' + num(counts[s.key]) + '</a>';
    }).join('') + '</div>';
    html += '<a class="btn primary" href="' + top.href + '">ทบทวน</a>';
    $('reviewBody').innerHTML = html;
  }

  function runLength(days, from) {
    var n = 0, d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    while (days[ymd(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function longestRun(days) {
    var keys = Object.keys(days).sort(), best = 0, cur = 0, prev = null;
    keys.forEach(function (k) {
      var p = k.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
      if (prev && Math.round((d - prev) / 86400000) === 1) cur++; else cur = 1;
      if (cur > best) best = cur;
      prev = d;
    });
    return best;
  }
  function renderStreak() {
    var today = new Date(), y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    var tKey = ymd(today), yKey = ymd(y);
    // ภาษา: บันทึกวันติดต่อกันไว้เอง (นับต่อได้ถ้าฝึกล่าสุดคือวันนี้หรือเมื่อวาน)
    var ls = rd('lang-practice:streak', null) || {};
    var langCount = (ls.lastDate === tKey || ls.lastDate === yKey) ? (Number(ls.count) || 0) : 0;
    // ห้องเรียนกฎหมาย: มีแต่บันทึกกิจกรรม — นับวันที่มีกิจกรรมต่อเนื่องเอง
    var act = rd('tanot:barprep:activity', []);
    var days = {};
    if (isArr(act)) act.forEach(function (a) { if (a && a.ts) days[ymd(new Date(a.ts))] = 1; });
    var actCount = days[tKey] ? runLength(days, today) : (days[yKey] ? runLength(days, y) : 0);
    var count = Math.max(langCount, actCount);
    var doneToday = ls.lastDate === tKey || !!days[tKey];
    var longest = Math.max(Number(ls.longest) || 0, longestRun(days), count);

    if (!count && !doneToday) {
      $('streakBody').innerHTML = '<div class="stat">' + icon('flame') + '<div class="big">0 <small>วัน</small></div></div>' +
        '<span class="badge warn">ยังไม่ได้ฝึกวันนี้</span>';
      return;
    }
    $('streakBody').innerHTML = '<div class="stat">' + icon('flame', 'flame') + '<div class="big">' + num(count) + ' <small>วัน</small></div></div>' +
      '<div><span class="badge ' + (doneToday ? 'ok' : 'warn') + '">' + (doneToday ? 'ฝึกวันนี้แล้ว' : 'ยังไม่ได้ฝึกวันนี้') + '</span></div>' +
      (longest > count ? '<div class="sub">สูงสุด ' + num(longest) + ' วัน</div>' : '');
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
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') renderSoon(); });
  if (TD && TD.onChange) TD.onChange(renderSoon);
})();
