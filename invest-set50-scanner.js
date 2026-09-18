/* ══════════════════════════════════════════════════════════════════
   Tanot — สแกนเนอร์ SET50 (แยกออกมาจากหน้าหุ้นไทยเดิม)
   ใช้ชุดคำนวณอินดิเคเตอร์/ดึงราคาเดียวกับ invest-thai-stock.js (คัดลอกมาเฉพาะส่วนที่ต้องใช้ —
   เว็บนี้ไม่มีระบบ build/bundle ร่วม แต่ละหน้าจึงมีสำเนาของตัวเองตามธรรมเนียมเดิมของโค้ดเบสนี้)
   คลิกแถว → เปิดหุ้นตัวนั้นในหน้าหุ้นไทย (invest-thai-stock.html?sym=XXX)
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }

  /* ══════ ระบบแปลภาษา (i18n) — รูปแบบเดียวกับหน้าอื่นในโซนลงทุน ══════ */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      navOverview: 'ภาพรวม', navMyPortfolio: 'พอร์ตของฉัน', navMarket: 'ตลาด & สินทรัพย์', navLottery: 'สลาก & พันธบัตร', navNews: 'ข่าว & ธุรกิจ',
      crumbHome: 'การลงทุน', crumbThaiStock: 'หุ้นไทย', crumbHere: 'สแกนเนอร์ SET50',
      pageTitle: 'สแกนเนอร์ SET50',
      scanBtn: 'หาหุ้นน่าสนใจ', scanBtnStop: '⏹ หยุด', greenOnlyLabel: 'เฉพาะไฟเขียว',
      thSym: 'หลักทรัพย์', thLast: 'ล่าสุด', thChg: '+/−', thPct: '%', thSig: 'สัญญาณ', rowLoading: 'กดดู',
      scanDone: 'สแกนสำเร็จ {ok}/{total} ตัว · เจอน่าสนใจ {green} ตัว (ไม่ใช่คำแนะนำซื้อ)', scanProgress: 'กำลังสแกน {idx}/{total} ({sym})…',
      scannerLink: 'สแกนเนอร์ SET50'
    },
    en: {
      navOverview: 'Overview', navMyPortfolio: 'My Portfolio', navMarket: 'Markets & Assets', navLottery: 'Lottery & Bonds', navNews: 'News & Business',
      crumbHome: 'Investing', crumbThaiStock: 'Thai Stocks', crumbHere: 'SET50 Scanner',
      pageTitle: 'SET50 Scanner',
      scanBtn: 'Find interesting stocks', scanBtnStop: '⏹ Stop', greenOnlyLabel: 'Green only',
      thSym: 'Ticker', thLast: 'Last', thChg: '+/−', thPct: '%', thSig: 'Signal', rowLoading: 'Click to view',
      scanDone: 'Scanned {ok}/{total} · found {green} interesting (not a buy recommendation)', scanProgress: 'Scanning {idx}/{total} ({sym})…',
      scannerLink: 'SET50 Scanner'
    }
  };
  function t(key, vars) {
    var s = (I18N[getUILang()] || I18N.th)[key];
    if (s == null) s = I18N.th[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
  }

  /* ── อินดิเคเตอร์ (สำเนาจาก invest-thai-stock.js) ── */
  function sma(arr, n) { if (arr.length < n) return NaN; var s = 0; for (var i = arr.length - n; i < arr.length; i++) s += arr[i]; return s / n; }
  function smaSeries(arr, n) { var out = new Array(arr.length), i, s = 0; for (i = 0; i < arr.length; i++) { s += arr[i]; if (i >= n) s -= arr[i - n]; if (i >= n - 1) out[i] = s / n; } return out; }
  function emaSeries(arr, n) { if (arr.length < n) return []; var k = 2 / (n + 1), out = [], seed = 0, i; for (i = 0; i < n; i++) seed += arr[i]; var prev = seed / n; out[n - 1] = prev; for (i = n; i < arr.length; i++) { prev = arr[i] * k + prev * (1 - k); out[i] = prev; } return out; }
  function emaLast(arr, n) { var e = emaSeries(arr, n); return e.length ? e[e.length - 1] : NaN; }
  function rsi(arr, n) { n = n || 14; if (arr.length < n + 1) return NaN; var gain = 0, loss = 0, i, ch; for (i = 1; i <= n; i++) { ch = arr[i] - arr[i - 1]; if (ch >= 0) gain += ch; else loss -= ch; } var ag = gain / n, al = loss / n; for (i = n + 1; i < arr.length; i++) { ch = arr[i] - arr[i - 1]; ag = (ag * (n - 1) + (ch > 0 ? ch : 0)) / n; al = (al * (n - 1) + (ch < 0 ? -ch : 0)) / n; } if (al === 0) return 100; return 100 - 100 / (1 + ag / al); }
  function rsiSeries(arr, n) { n = n || 14; var out = new Array(arr.length); if (arr.length < n + 1) return out; var gain = 0, loss = 0, i, ch; for (i = 1; i <= n; i++) { ch = arr[i] - arr[i - 1]; if (ch >= 0) gain += ch; else loss -= ch; } var ag = gain / n, al = loss / n; out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); for (i = n + 1; i < arr.length; i++) { ch = arr[i] - arr[i - 1]; ag = (ag * (n - 1) + (ch > 0 ? ch : 0)) / n; al = (al * (n - 1) + (ch < 0 ? -ch : 0)) / n; out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } return out; }
  function macd(arr) { if (arr.length < 26) return null; var e12 = emaSeries(arr, 12), e26 = emaSeries(arr, 26), line = [], i; for (i = 25; i < arr.length; i++) line.push(e12[i] - e26[i]); if (line.length < 9) return { line: line[line.length - 1], signal: NaN, hist: NaN, histPrev: NaN }; var sig = emaSeries(line, 9), last = line.length - 1; var hist = line[last] - sig[last]; var histPrev = (line.length >= 2 && sig[last - 1] != null) ? line[last - 1] - sig[last - 1] : NaN; return { line: line[last], signal: sig[last], hist: hist, histPrev: histPrev }; }
  function bollinger(arr, n, k) { n = n || 20; k = k || 2; if (arr.length < n) return null; var mid = sma(arr, n), i, sum = 0; for (i = arr.length - n; i < arr.length; i++) sum += (arr[i] - mid) * (arr[i] - mid); var sd = Math.sqrt(sum / n); return { mid: mid, upper: mid + k * sd, lower: mid - k * sd, sd: sd }; }
  function atr(highs, lows, closes, n) { n = n || 14; if (closes.length < n + 1) return NaN; var trs = [], i; for (i = 1; i < closes.length; i++) trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]))); var a = 0; for (i = 0; i < n; i++) a += trs[i]; a /= n; for (i = n; i < trs.length; i++) a = (a * (n - 1) + trs[i]) / n; return a; }
  function supRes(highs, lows, look) { look = look || 20; var hi = -Infinity, lo = Infinity, i, start = Math.max(0, highs.length - 1 - look); for (i = start; i < highs.length - 1; i++) { if (highs[i] > hi) hi = highs[i]; if (lows[i] < lo) lo = lows[i]; } return { support: isFinite(lo) ? lo : NaN, resistance: isFinite(hi) ? hi : NaN }; }
  function adx(highs, lows, closes, n) { n = n || 14; if (closes.length < 2 * n + 1) return NaN; var tr = [], pdm = [], ndm = [], i; for (i = 1; i < closes.length; i++) { var up = highs[i] - highs[i - 1], dn = lows[i - 1] - lows[i]; pdm.push(up > dn && up > 0 ? up : 0); ndm.push(dn > up && dn > 0 ? dn : 0); tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]))); } function wilder(a) { var out = [], s = 0, j; for (j = 0; j < n; j++) s += a[j]; out[n - 1] = s; for (j = n; j < a.length; j++) { s = s - s / n + a[j]; out[j] = s; } return out; } var trS = wilder(tr), pdmS = wilder(pdm), ndmS = wilder(ndm), dx = []; for (i = n - 1; i < tr.length; i++) { if (!trS[i]) { dx.push(0); continue; } var pdi = 100 * pdmS[i] / trS[i], ndi = 100 * ndmS[i] / trS[i], sum = pdi + ndi; dx.push(sum === 0 ? 0 : 100 * Math.abs(pdi - ndi) / sum); } if (dx.length < n) return NaN; var a2 = 0; for (i = 0; i < n; i++) a2 += dx[i]; a2 /= n; for (i = n; i < dx.length; i++) a2 = (a2 * (n - 1) + dx[i]) / n; return a2; }

  function analyzeSeries(s) {
    var c = s.closes, price = c[c.length - 1];
    var ema20 = emaLast(c, 20), ema50 = emaLast(c, 50), r = rsi(c, 14);
    var mac = macd(c), bb = bollinger(c, 20, 2), at = atr(s.highs, s.lows, c, 14);
    var sr = supRes(s.highs, s.lows, 20), adxV = adx(s.highs, s.lows, c, 14);
    var range = { hi: Math.max.apply(null, c), lo: Math.min.apply(null, c) };
    var posRange = (price - range.lo) / Math.max(1e-9, range.hi - range.lo);
    var posBB = bb ? (price - bb.lower) / Math.max(1e-9, bb.upper - bb.lower) : 0.5;
    var uptrend = isFinite(ema50) ? price >= ema50 : (isFinite(ema20) ? price >= ema20 : true);
    var momUp = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist > mac.histPrev : false;
    var momDn = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist < mac.histPrev : false;
    var score = 0;
    if (posRange < 0.35) score += 1; else if (posRange > 0.75) score -= 1;
    if (isFinite(r)) { if (r < 38) score += 1; else if (r > 70) score -= 1; }
    if (momUp) score += 1; else if (momDn) score -= 1;
    if (uptrend) score += 1; else score -= 1;
    if (posBB < 0.2) score += 0.5; else if (posBB > 0.9) score -= 0.5;
    var light = score >= 2 ? 'green' : score <= -1 ? 'red' : 'yellow';
    return { light: light, price: price };
  }

  /* ── ดึงราคา/แคช (สำเนา) ── */
  function toSeries(times, opens, highs, lows, closes, volumes) {
    return { times: times, closes: closes, highs: highs, lows: lows };
  }
  function parseYahoo(j) {
    var res = j && j.chart && j.chart.result && j.chart.result[0];
    var ts = res && res.timestamp, q = res && res.indicators && res.indicators.quote && res.indicators.quote[0];
    if (!ts || !q || !q.close) throw new Error('no data');
    var times = [], highs = [], lows = [], closes = [], i;
    for (i = 0; i < ts.length; i++) {
      if (q.close[i] == null) continue;
      times.push(new Date(ts[i] * 1000).toISOString().slice(0, 10));
      highs.push(q.high[i] != null ? q.high[i] : q.close[i]);
      lows.push(q.low[i] != null ? q.low[i] : q.close[i]);
      closes.push(q.close[i]);
    }
    if (closes.length < 5) throw new Error('short');
    return toSeries(times, null, highs, lows, closes, null);
  }
  function fetchOne(url, timeoutMs) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
      .then(function (t) { if (to) clearTimeout(to); return parseYahoo(JSON.parse(t)); });
  }
  function fetchPriceScan(sym, startAt) {
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '.BK?range=1y&interval=1d';
    var enc = encodeURIComponent(base);
    var tries = [
      { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' + enc },
      { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { name: 'corseu', url: 'https://cors.eu.org/' + base },
      { name: 'corsworkers', url: 'https://test.cors.workers.dev/?' + base },
      { name: 'corslol', url: 'https://api.cors.lol/?url=' + enc },
      { name: 'ตรง', url: base }
    ];
    var offset = ((startAt || 0) % tries.length + tries.length) % tries.length;
    tries = tries.slice(offset).concat(tries.slice(0, offset));
    var i = 0, best = null;
    function next() {
      if (i >= tries.length) return best ? Promise.resolve(best) : Promise.reject(new Error('fail'));
      var t = tries[i++];
      return fetchOne(t.url, 7000).then(function (s) {
        s.source = t.name; if (!best || s.closes.length > best.closes.length) best = s;
        if (best.closes.length >= 40) return best; return next();
      }, function () { return next(); });
    }
    return next();
  }
  function cacheKey(sym) { return 'tanot:invest:cache:' + sym; }
  function saveCache(sym, s) {
    try { localStorage.setItem(cacheKey(sym), JSON.stringify({ ts: Date.now(), t: s.times, h: s.highs, l: s.lows, c: s.closes })); } catch (e) {}
  }
  function loadCache(sym) {
    try {
      var o = JSON.parse(localStorage.getItem(cacheKey(sym)));
      if (!o || !o.c || o.c.length < 5) return null;
      var s = toSeries(o.t, null, o.h, o.l, o.c, null); s.cachedAt = o.ts; return s;
    } catch (e) { return null; }
  }

  /* ── SET50 ── */
  var SET50 = ['ADVANC', 'AOT', 'AWC', 'BANPU', 'BBL', 'BDMS', 'BEM', 'BGRIM', 'BH', 'BTS',
    'CBG', 'CENTEL', 'COM7', 'CPALL', 'CPF', 'CPN', 'CRC', 'DELTA', 'EA', 'EGCO',
    'GLOBAL', 'GPSC', 'GULF', 'HMPRO', 'INTUCH', 'IVL', 'KBANK', 'KCE', 'KKP', 'KTB',
    'KTC', 'LH', 'MINT', 'MTC', 'OR', 'OSP', 'PTT', 'PTTEP', 'PTTGC', 'RATCH',
    'SAWAD', 'SCB', 'SCC', 'SCGP', 'TISCO', 'TLI', 'TOP', 'TRUE', 'TTB', 'TU'];

  var s50Rows = {};
  function rankOf(l) { return l === 'green' ? 0 : l === 'yellow' ? 1 : l === 'red' ? 2 : 9; }
  function sigIcon(l) {
    var cls = l === 'green' ? 'green' : l === 'yellow' ? 'yellow' : l === 'red' ? 'red' : '';
    return cls ? '<span class="sigdot ' + cls + '"></span>' : '·';
  }
  function dataFromSeries(s) {
    if (!s || s.closes.length < 2) return null;
    var last = s.closes[s.closes.length - 1], prev = s.closes[s.closes.length - 2];
    var light = ''; if (s.closes.length >= 20) { try { light = analyzeSeries(s).light; } catch (e) {} }
    return { last: last, chg: last - prev, pct: prev ? (last - prev) / prev * 100 : 0, light: light };
  }
  function fillRow(tr, sym, d) {
    if (!d) {
      tr.innerHTML = '<td class="c-sym">' + sym + '</td><td>–</td><td class="c-chg">–</td><td>–</td><td class="c-sig">' + t('rowLoading') + '</td>';
      tr.setAttribute('data-rank', 9); tr.setAttribute('data-light', ''); return;
    }
    var cls = d.chg >= 0 ? 'up' : 'dn', sign = d.chg >= 0 ? '+' : '−';
    tr.innerHTML = '<td class="c-sym">' + sym + '</td>' +
      '<td class="num">' + fmt(d.last) + '</td>' +
      '<td class="num c-chg ' + cls + '">' + sign + fmt(Math.abs(d.chg)) + '</td>' +
      '<td class="num ' + cls + '">' + sign + fmt(Math.abs(d.pct), 2) + '%</td>' +
      '<td class="c-sig">' + sigIcon(d.light) + '</td>';
    tr.setAttribute('data-rank', rankOf(d.light)); tr.setAttribute('data-light', d.light || '');
  }
  function renderSet50Table() {
    var body = $('s50Body'); if (!body) return;
    body.innerHTML = ''; s50Rows = {};
    SET50.forEach(function (sym) {
      var tr = document.createElement('tr'); tr.setAttribute('data-sym', sym);
      fillRow(tr, sym, dataFromSeries(loadCache(sym)));
      tr.addEventListener('click', function () { location.href = 'invest-thai-stock.html?sym=' + encodeURIComponent(sym); });
      body.appendChild(tr); s50Rows[sym] = tr;
    });
    applyGreenFilter();
  }
  function sortTable() {
    var body = $('s50Body'); if (!body) return;
    var rows = [].slice.call(body.querySelectorAll('tr'));
    rows.sort(function (a, b) {
      var ra = +a.getAttribute('data-rank'), rb = +b.getAttribute('data-rank');
      if (ra !== rb) return ra - rb;
      return a.getAttribute('data-sym') < b.getAttribute('data-sym') ? -1 : 1;
    });
    rows.forEach(function (r) { body.appendChild(r); });
  }
  function applyGreenFilter() {
    var go = $('greenOnly') && $('greenOnly').checked;
    Object.keys(s50Rows).forEach(function (sym) {
      var tr = s50Rows[sym]; tr.style.display = (go && tr.getAttribute('data-light') !== 'green') ? 'none' : '';
    });
  }
  var scanning = false;
  function doScan() {
    if (scanning) { scanning = false; return; }
    var idx = 0, ok = 0, green = 0;
    scanning = true; $('scanBtn').textContent = t('scanBtnStop');
    function fin() {
      scanning = false; $('scanBtn').textContent = t('scanBtn');
      $('scanStatus').textContent = t('scanDone', { ok: ok, total: SET50.length, green: green });
      sortTable(); applyGreenFilter();
    }
    function step() {
      if (!scanning || idx >= SET50.length) { fin(); return; }
      var sym = SET50[idx++];
      $('scanStatus').textContent = t('scanProgress', { idx: idx, total: SET50.length, sym: sym });
      var cached = loadCache(sym), fresh = cached && (Date.now() - cached.cachedAt < 6 * 3600 * 1000);
      var pr = fresh ? Promise.resolve(cached) : fetchPriceScan(sym, idx).then(function (s) { saveCache(sym, s); return s; }, function () { return cached || null; });
      pr.then(function (s) {
        var d = dataFromSeries(s);
        if (d) { ok++; if (d.light === 'green') green++; if (s50Rows[sym]) fillRow(s50Rows[sym], sym, d); }
        if (idx % 5 === 0) { sortTable(); applyGreenFilter(); }
        setTimeout(step, 150);
      });
    }
    step();
  }

  /* ── init ── */
  applyStaticI18n();
  $('scanBtn').addEventListener('click', doScan);
  $('greenOnly').addEventListener('change', applyGreenFilter);
  renderSet50Table();

  /* ── แถบนำทาง: กลุ่ม/แท็บย่อยจาก window.INVEST_CATS (เดียวกับหน้ารวม) ── */
  function waitCats(cb) { if (window.INVEST_CATS) cb(window.INVEST_CATS); else setTimeout(function () { waitCats(cb); }, 30); }
  waitCats(function (CATS) {
    var row = $('ivSubRow-market'); if (!row) return;
    CATS.forEach(function (c) {
      if (['thai-stock', 'global-stock', 'thai-fund', 'global-fund', 'gold', 'bitcoin', 'commodities'].indexOf(c.key) < 0) return;
      var a = document.createElement('a'); a.href = c.page; a.textContent = c.label;
      row.appendChild(a);
    });
    var scan = document.createElement('a'); scan.href = 'invest-set50-scanner.html'; scan.className = 'on'; scan.id = 'ivScannerLink';
    scan.innerHTML = '<b>' + t('scannerLink') + '</b>';
    row.appendChild(scan);
  });
  var groupBtns = document.querySelectorAll('#ivGroups button');
  groupBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.href) { location.href = b.dataset.href; return; }
      groupBtns.forEach(function (x) { x.classList.toggle('on', x === b); });
    });
  });

  window.omeApplyLang = function () {
    applyStaticI18n();
    var scanLink = document.getElementById('ivScannerLink');
    if (scanLink) scanLink.innerHTML = '<b>' + t('scannerLink') + '</b>';
    if (!scanning) $('scanBtn').textContent = t('scanBtn');
    renderSet50Table();
  };
})();
