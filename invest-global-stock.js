/* ══════════════════════════════════════════════════════════════════
   Tanot — หุ้นต่างประเทศ (สหรัฐฯ · มือใหม่ · สวิง)
   • กราฟแท่งเทียนจริงด้วย lightweight-charts (TradingView, Apache-2.0)
   • ดึงราคาหุ้น US แบบ best-effort หลายเส้นทาง (มัก CORS บน static → มีตัวอย่าง/กรอกเองสำรอง)
   • คำนวณอินดิเคเตอร์เอง (SMA/EMA/RSI/MACD/Bollinger/ATR) → แปลเป็นไฟจราจร
   • แกนหลัก: คุมเงิน/ความเสี่ยง เป็น USD (ซื้อหุ้นเดี่ยวได้ ไม่ต้องเป็นล็อต), stop, TP, จุดคุ้มทุน — พอร์ตเก็บใน localStorage
   • ตัวแปลงเป็นเงินบาทเสริม (ไม่บังคับ) — ดึงอัตราแบบ best-effort หรือกรอกเอง
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var PF_KEY = 'tanot:invest:globalstock';
  var lastSeries = null;
  var lastAnalysis = null;

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—'; }
  function usd(n, d) { if (!isFinite(n)) return '—'; var neg = n < 0; d = d == null ? 2 : d; return (neg ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function usd0(n) { if (!isFinite(n)) return '—'; var neg = n < 0; return (neg ? '−' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US'); }
  function baht(n) { if (!isFinite(n)) return '—'; var neg = n < 0; return (neg ? '−' : '') + '฿' + Math.round(Math.abs(n)).toLocaleString('th-TH'); }

  /* ── อินดิเคเตอร์ (สูตรมาตรฐาน) ─────────────────────────────── */
  function sma(arr, n) {
    if (arr.length < n) return NaN;
    var s = 0; for (var i = arr.length - n; i < arr.length; i++) s += arr[i];
    return s / n;
  }
  function smaSeries(arr, n) {
    var out = new Array(arr.length), i, s = 0;
    for (i = 0; i < arr.length; i++) { s += arr[i]; if (i >= n) s -= arr[i - n]; if (i >= n - 1) out[i] = s / n; }
    return out;
  }
  function emaSeries(arr, n) {
    if (arr.length < n) return [];
    var k = 2 / (n + 1), out = [], seed = 0, i;
    for (i = 0; i < n; i++) seed += arr[i];
    var prev = seed / n; out[n - 1] = prev;
    for (i = n; i < arr.length; i++) { prev = arr[i] * k + prev * (1 - k); out[i] = prev; }
    return out;
  }
  function emaLast(arr, n) { var e = emaSeries(arr, n); return e.length ? e[e.length - 1] : NaN; }

  function rsi(arr, n) {
    n = n || 14;
    if (arr.length < n + 1) return NaN;
    var gain = 0, loss = 0, i, ch;
    for (i = 1; i <= n; i++) { ch = arr[i] - arr[i - 1]; if (ch >= 0) gain += ch; else loss -= ch; }
    var ag = gain / n, al = loss / n;
    for (i = n + 1; i < arr.length; i++) {
      ch = arr[i] - arr[i - 1];
      ag = (ag * (n - 1) + (ch > 0 ? ch : 0)) / n;
      al = (al * (n - 1) + (ch < 0 ? -ch : 0)) / n;
    }
    if (al === 0) return 100;
    return 100 - 100 / (1 + ag / al);
  }
  function rsiSeries(arr, n) {
    n = n || 14; var out = new Array(arr.length);
    if (arr.length < n + 1) return out;
    var gain = 0, loss = 0, i, ch;
    for (i = 1; i <= n; i++) { ch = arr[i] - arr[i - 1]; if (ch >= 0) gain += ch; else loss -= ch; }
    var ag = gain / n, al = loss / n;
    out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    for (i = n + 1; i < arr.length; i++) {
      ch = arr[i] - arr[i - 1];
      ag = (ag * (n - 1) + (ch > 0 ? ch : 0)) / n;
      al = (al * (n - 1) + (ch < 0 ? -ch : 0)) / n;
      out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    }
    return out;
  }

  function macd(arr) {
    if (arr.length < 26) return null;
    var e12 = emaSeries(arr, 12), e26 = emaSeries(arr, 26), line = [], i;
    for (i = 25; i < arr.length; i++) line.push(e12[i] - e26[i]);
    if (line.length < 9) return { line: line[line.length - 1], signal: NaN, hist: NaN, histPrev: NaN };
    var sig = emaSeries(line, 9), last = line.length - 1;
    var hist = line[last] - sig[last];
    var histPrev = (line.length >= 2 && sig[last - 1] != null) ? line[last - 1] - sig[last - 1] : NaN;
    return { line: line[last], signal: sig[last], hist: hist, histPrev: histPrev };
  }
  function bollinger(arr, n, k) {
    n = n || 20; k = k || 2;
    if (arr.length < n) return null;
    var mid = sma(arr, n), i, sum = 0;
    for (i = arr.length - n; i < arr.length; i++) sum += (arr[i] - mid) * (arr[i] - mid);
    var sd = Math.sqrt(sum / n);
    return { mid: mid, upper: mid + k * sd, lower: mid - k * sd, sd: sd };
  }
  function atr(highs, lows, closes, n) {
    n = n || 14;
    if (closes.length < n + 1) return NaN;
    var trs = [], i;
    for (i = 1; i < closes.length; i++) trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    var a = 0; for (i = 0; i < n; i++) a += trs[i]; a /= n;
    for (i = n; i < trs.length; i++) a = (a * (n - 1) + trs[i]) / n;
    return a;
  }
  function supRes(highs, lows, look) {
    look = look || 20;
    var hi = -Infinity, lo = Infinity, i, start = Math.max(0, highs.length - 1 - look);
    for (i = start; i < highs.length - 1; i++) { if (highs[i] > hi) hi = highs[i]; if (lows[i] < lo) lo = lows[i]; }
    return { support: isFinite(lo) ? lo : NaN, resistance: isFinite(hi) ? hi : NaN };
  }

  /* ADX(14) — ความแรงของแนวโน้ม (>20-25 = เทรนด์ชัด) */
  function adx(highs, lows, closes, n) {
    n = n || 14;
    if (closes.length < 2 * n + 1) return NaN;
    var tr = [], pdm = [], ndm = [], i;
    for (i = 1; i < closes.length; i++) {
      var up = highs[i] - highs[i - 1], dn = lows[i - 1] - lows[i];
      pdm.push(up > dn && up > 0 ? up : 0); ndm.push(dn > up && dn > 0 ? dn : 0);
      tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    }
    function wilder(arr) { var out = [], s = 0, j; for (j = 0; j < n; j++) s += arr[j]; out[n - 1] = s; for (j = n; j < arr.length; j++) { s = s - s / n + arr[j]; out[j] = s; } return out; }
    var trS = wilder(tr), pdmS = wilder(pdm), ndmS = wilder(ndm), dx = [];
    for (i = n - 1; i < tr.length; i++) {
      if (!trS[i]) { dx.push(0); continue; }
      var pdi = 100 * pdmS[i] / trS[i], ndi = 100 * ndmS[i] / trS[i], sum = pdi + ndi;
      dx.push(sum === 0 ? 0 : 100 * Math.abs(pdi - ndi) / sum);
    }
    if (dx.length < n) return NaN;
    var a = 0; for (i = 0; i < n; i++) a += dx[i]; a /= n;
    for (i = n; i < dx.length; i++) a = (a * (n - 1) + dx[i]) / n;
    return a;
  }

  /* Parabolic SAR — จุดตัดขาดทุนตามเทรนด์ (ใช้เป็น trailing stop / สัญญาณพลิก) */
  function psar(highs, lows, step, maxAf) {
    step = step || 0.02; maxAf = maxAf || 0.2;
    var n = highs.length; if (n < 3) return null;
    var sar = lows[0], ep = highs[0], af = step, up = true, i;
    for (i = 1; i < n; i++) {
      sar = sar + af * (ep - sar);
      if (up) {
        if (lows[i] < sar) { up = false; sar = ep; ep = lows[i]; af = step; }
        else if (highs[i] > ep) { ep = highs[i]; af = Math.min(maxAf, af + step); }
      } else {
        if (highs[i] > sar) { up = true; sar = ep; ep = highs[i]; af = step; }
        else if (lows[i] < ep) { ep = lows[i]; af = Math.min(maxAf, af + step); }
      }
    }
    return { sar: sar, up: up };
  }

  /* ── วิเคราะห์ (มีซีรีส์เต็ม) → ไฟจราจร ─────────────────────── */
  function analyzeSeries(s) {
    var c = s.closes, price = c[c.length - 1];
    var ema20 = emaLast(c, 20), ema50 = emaLast(c, 50), r = rsi(c, 14);
    var mac = macd(c), bb = bollinger(c, 20, 2), at = atr(s.highs, s.lows, c, 14);
    var sr = supRes(s.highs, s.lows, 20);
    var adxV = adx(s.highs, s.lows, c, 14), ps = psar(s.highs, s.lows);
    var range = { hi: Math.max.apply(null, c), lo: Math.min.apply(null, c) };
    var posRange = (price - range.lo) / Math.max(1e-9, range.hi - range.lo);
    var posBB = bb ? (price - bb.lower) / Math.max(1e-9, bb.upper - bb.lower) : 0.5;
    var uptrend = isFinite(ema50) ? price >= ema50 : (isFinite(ema20) ? price >= ema20 : true);
    var momUp = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist > mac.histPrev : false;
    var momDn = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist < mac.histPrev : false;

    var score = 0, pros = [], cons = [];
    if (posRange < 0.35) { score += 1; pros.push('ราคาอยู่ช่วงถูกเทียบ 3 เดือน'); }
    else if (posRange > 0.75) { score -= 1; cons.push('ราคาอยู่ช่วงแพงเทียบ 3 เดือน'); }
    if (isFinite(r)) {
      if (r < 38) { score += 1; pros.push('แรงขายเริ่มคลาย (RSI ต่ำ กำลังฟื้น)'); }
      else if (r > 70) { score -= 1; cons.push('ราคาร้อนแรงเกินไป (RSI สูง เสี่ยงย่อ)'); }
    }
    if (momUp) { score += 1; pros.push('โมเมนตัมเริ่มกลับเป็นบวก'); }
    else if (momDn) { score -= 1; cons.push('โมเมนตัมเริ่มอ่อนลง'); }
    if (uptrend) { score += 1; pros.push('ยังอยู่ในแนวโน้มขึ้น'); }
    else { score -= 1; cons.push('อยู่ใต้เส้นแนวโน้ม (ขาลง/พักตัว)'); }
    if (posBB < 0.2) { score += 0.5; pros.push('ราคาแตะกรอบล่าง (มักเป็นจังหวะเด้ง)'); }
    else if (posBB > 0.9) { score -= 0.5; cons.push('ราคาชนกรอบบน'); }

    var light, verdict;
    if (score >= 2) { light = 'green'; verdict = 'น่าสนใจ — ลองพิจารณา'; }
    else if (score <= -1) { light = 'red'; verdict = 'ระวัง — ยังไม่ใช่จังหวะ'; }
    else { light = 'yellow'; verdict = 'รอก่อน — ยังไม่มีจังหวะเด่น'; }
    var why = (light === 'green' ? pros : light === 'red' ? cons : (pros.concat(cons)))[0] || 'ราคาอยู่กลางกรอบ ยังไม่มีสัญญาณชัด';

    var stopByAtr = isFinite(at) ? price - 1.5 * at : NaN;
    var stopBySup = isFinite(sr.support) ? sr.support * 0.99 : NaN;
    var stop = NaN;
    if (isFinite(stopBySup) && stopBySup < price) stop = stopBySup;
    if (isFinite(stopByAtr) && stopByAtr < price && (!isFinite(stop) || stopByAtr > stop)) stop = stopByAtr;
    if (!isFinite(stop) || stop <= 0) stop = price * 0.95;

    return {
      light: light, verdict: verdict, why: why, pros: pros, cons: cons, score: score,
      price: price, suggestStop: stop, resistance: sr.resistance,
      uptrend: uptrend, rsi: r, adx: adxV, psar: ps,
      det: { ema20: ema20, ema50: ema50, rsi: r, macdHist: mac ? mac.hist : NaN,
             bbUpper: bb ? bb.upper : NaN, bbLower: bb ? bb.lower : NaN, atr: at,
             support: sr.support, resistance: sr.resistance, posRange: posRange,
             adx: adxV, psar: ps }
    };
  }

  function analyzeSimple(price, hi, lo) {
    var pos = (price - lo) / Math.max(1e-9, hi - lo), pct = Math.round(pos * 100);
    var light, verdict, why;
    if (pos < 0.35) { light = 'green'; verdict = 'น่าสนใจ — ลองพิจารณา'; why = 'ราคาอยู่ค่อนไปทางถูกของรอบ (~' + pct + '% ของช่วง ต่ำ→สูง)'; }
    else if (pos > 0.75) { light = 'red'; verdict = 'ระวัง — ราคาค่อนข้างแพง'; why = 'ราคาอยู่ค่อนไปทางแพงของรอบ (~' + pct + '% ของช่วง ต่ำ→สูง)'; }
    else { light = 'yellow'; verdict = 'รอก่อน — ราคากลางกรอบ'; why = 'ราคาอยู่กลางกรอบ (~' + pct + '% ของช่วง ต่ำ→สูง)'; }
    return { light: light, verdict: verdict, why: why, pros: [], cons: [], price: price, suggestStop: Math.min(lo, price * 0.95), resistance: hi, det: { posRange: pos, support: lo, resistance: hi }, simple: true };
  }

  /* ── คุมเงิน/ความเสี่ยง (USD, ซื้อเป็นหุ้นเดี่ยวได้ ไม่ต้องเป็นล็อต) ──────── */
  function riskCalc(o) {
    var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop, comm = o.comm / 100;
    var perShare = entry - stop;
    if (!(perShare > 0)) return { error: 'ราคาตัดขาดทุนต้องต่ำกว่าราคาเข้าซื้อ' };
    var riskBudget = capital * riskPct / 100;
    var shares = Math.floor(riskBudget / perShare), note = '';
    if (shares < 1) { shares = 1; note = 'ขั้นต่ำ 1 หุ้น ทำให้ความเสี่ยงเกิน ' + riskPct + '% ที่ตั้งไว้เล็กน้อย — พิจารณาขยับ stop ให้แคบลง หรือเพิ่มทุน'; }
    var cost = shares * entry;
    if (cost > capital) {
      var maxShares = Math.floor(capital / entry);
      if (maxShares >= 1) { shares = maxShares; cost = shares * entry; note = 'จำกัดจำนวนตามเงินที่มี (ทุนไม่พอซื้อเท่าที่ความเสี่ยงอนุญาต)'; }
    }
    var R = perShare, breakeven = entry * (1 + comm) / (1 - comm);
    var rr = isFinite(o.resistance) && o.resistance > entry ? (o.resistance - entry) / R : NaN;
    return { shares: shares, cost: cost, riskUsd: shares * perShare, tp1: entry + R, tp2: entry + 2 * R, tp3: entry + 3 * R, breakeven: breakeven, rr: rr, riskBudget: riskBudget, note: note };
  }

  /* ── สร้างชุดข้อมูล (ใช้ร่วมทั้งกราฟ + วิเคราะห์) ─────────────── */
  function daysAgoDates(n) {
    var out = [], d = new Date(); d.setHours(0, 0, 0, 0);
    for (var i = n - 1; i >= 0; i--) { var x = new Date(d); x.setDate(d.getDate() - i); out.push(x.toISOString().slice(0, 10)); }
    return out;
  }
  function toSeries(times, opens, highs, lows, closes, volumes) {
    function align(a) { var r = [], i; for (i = 0; i < times.length; i++) if (a[i] != null && isFinite(a[i])) r.push({ time: times[i], value: a[i] }); return r; }
    var ohlc = [], vol = [], i;
    for (i = 0; i < times.length; i++) {
      ohlc.push({ time: times[i], open: opens[i], high: highs[i], low: lows[i], close: closes[i] });
      vol.push({ time: times[i], value: (volumes && volumes[i]) ? volumes[i] : 0, color: closes[i] >= opens[i] ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)' });
    }
    return { times: times, closes: closes, highs: highs, lows: lows, ohlc: ohlc, vol: vol,
      ma20: align(smaSeries(closes, 20)), ma50: align(smaSeries(closes, 50)), rsi: align(rsiSeries(closes, 14)) };
  }
  function demoData() {
    var n = 252, opens = [], highs = [], lows = [], closes = [], vols = [];
    var seed = 20240117, rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    var price = 180, i;
    for (i = 0; i < n; i++) {
      var ret = 0.0004 + (rnd() - 0.5) * 0.032, open = price, close = Math.max(1, open * (1 + ret));
      opens.push(+open.toFixed(2)); closes.push(+close.toFixed(2));
      highs.push(+(Math.max(open, close) * (1 + rnd() * 0.012)).toFixed(2));
      lows.push(+(Math.min(open, close) * (1 - rnd() * 0.012)).toFixed(2));
      vols.push(Math.round(2e6 + rnd() * 8e6)); price = close;
    }
    return toSeries(daysAgoDates(n), opens, highs, lows, closes, vols);
  }
  function parsePaste(text) {
    var nums = (text.match(/-?\d+(\.\d+)?/g) || []).map(Number).filter(function (x) { return isFinite(x) && x > 0; });
    if (nums.length < 5) return null;
    var opens = [], highs = [], lows = [], vols = [], i;
    for (i = 0; i < nums.length; i++) {
      var open = i === 0 ? nums[0] : nums[i - 1];
      opens.push(open); highs.push(Math.max(open, nums[i]) * 1.004); lows.push(Math.min(open, nums[i]) * 0.996); vols.push(0);
    }
    return toSeries(daysAgoDates(nums.length), opens, highs, lows, nums, vols);
  }

  /* ── ดึงราคา Yahoo (หุ้น US ไม่มี suffix ตลาด) หลายเส้นทาง best-effort ── */
  function parseYahoo(j) {
    var res = j && j.chart && j.chart.result && j.chart.result[0];
    var ts = res && res.timestamp, q = res && res.indicators && res.indicators.quote && res.indicators.quote[0];
    if (!ts || !q || !q.close) throw new Error('no data');
    var times = [], opens = [], highs = [], lows = [], closes = [], vols = [], i;
    for (i = 0; i < ts.length; i++) {
      if (q.close[i] == null) continue;
      times.push(new Date(ts[i] * 1000).toISOString().slice(0, 10));
      opens.push(q.open[i] != null ? q.open[i] : q.close[i]);
      highs.push(q.high[i] != null ? q.high[i] : q.close[i]);
      lows.push(q.low[i] != null ? q.low[i] : q.close[i]);
      closes.push(q.close[i]); vols.push(q.volume && q.volume[i] ? q.volume[i] : 0);
    }
    if (closes.length < 5) throw new Error('short');
    return toSeries(times, opens, highs, lows, closes, vols);
  }
  function fetchOne(url, timeoutMs, parser) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
      .then(function (t) { if (to) clearTimeout(to); return (parser || defaultYahooParser)(t); });
  }
  function defaultYahooParser(t) { return parseYahoo(JSON.parse(t)); }
  function fetchPrice(sym) {
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=1y&interval=1d';
    var enc = encodeURIComponent(base);
    var tries = [
      { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' + enc },
      { name: 'corsproxy', url: 'https://corsproxy.io/?url=' + enc },
      { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { name: 'thingproxy', url: 'https://thingproxy.freeboard.io/fetch/' + base },
      { name: 'ตรง', url: base }
    ];
    var i = 0, best = null;
    /* ไล่ทุกเส้นทาง เลือกอันที่ได้ "จำนวนวันมากสุด" — กัน proxy ที่คืนข้อมูลสั้น (เช่น 10 วัน);
       พอได้ ≥60 วันก็หยุด (ถือว่าพอดูแนวโน้ม) */
    function next() {
      if (i >= tries.length) return best ? Promise.resolve(best) : Promise.reject(new Error('all failed'));
      var t = tries[i++];
      return fetchOne(t.url).then(function (s) {
        s.source = t.name;
        if (!best || s.closes.length > best.closes.length) best = s;
        if (best.closes.length >= 60) return best;
        return next();
      }, function () { return next(); });
    }
    return next();
  }

  /* ── cache ราคาต่อหุ้น (localStorage) — กันดึงพลาดแล้วหน้าว่าง/ error ── */
  /* namespace 'us:' กันชนกับ cache ของหน้าหุ้นไทย แม้ชื่อย่อจะบังเอิญตรงกัน */
  function cacheKey(sym) { return 'tanot:invest:cache:us:' + sym; }
  function saveCache(sym, s) {
    try {
      var o = { ts: Date.now(), t: s.times, o: s.ohlc.map(function (b) { return b.open; }), h: s.highs, l: s.lows, c: s.closes, v: s.vol.map(function (b) { return b.value; }) };
      localStorage.setItem(cacheKey(sym), JSON.stringify(o));
    } catch (e) {}
  }
  function loadCache(sym) {
    try {
      var o = JSON.parse(localStorage.getItem(cacheKey(sym)));
      if (!o || !o.c || o.c.length < 5) return null;
      var s = toSeries(o.t, o.o, o.h, o.l, o.c, o.v); s.cachedAt = o.ts; return s;
    } catch (e) { return null; }
  }
  /* ดึงสด → cache; ถ้าพลาดแต่มี cache → คืน cache (stale) เพื่อไม่ให้ error */
  function getSeries(sym) {
    return fetchPrice(sym).then(function (s) {
      saveCache(sym, s); return { series: s, stale: false };
    }, function (e) {
      var c = loadCache(sym);
      if (c) return { series: c, stale: true, cachedAt: c.cachedAt };
      throw e;
    });
  }
  function cacheAgeText(ts) {
    if (!ts) return '';
    var mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return 'เมื่อสักครู่';
    if (mins < 60) return mins + ' นาทีก่อน';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + ' ชม.ก่อน';
    return Math.round(hrs / 24) + ' วันก่อน';
  }

  /* ══════ อัตราแลกเปลี่ยน USD→บาท (ทางเลือก, best-effort) ══════ */
  var fxRate = NaN;
  function fxCacheKey() { return 'tanot:invest:fxcache'; }
  function saveFxCache(rate) { try { localStorage.setItem(fxCacheKey(), JSON.stringify({ ts: Date.now(), rate: rate })); } catch (e) {} }
  function loadFxCache() { try { var o = JSON.parse(localStorage.getItem(fxCacheKey())); return (o && isFinite(o.rate)) ? o : null; } catch (e) { return null; } }
  function parseFxRate(t) {
    var j = JSON.parse(t), res = j && j.chart && j.chart.result && j.chart.result[0];
    var meta = res && res.meta, q = res && res.indicators && res.indicators.quote && res.indicators.quote[0];
    var rate = meta && isFinite(meta.regularMarketPrice) ? meta.regularMarketPrice : null;
    if (!rate && q && q.close) { for (var i = q.close.length - 1; i >= 0; i--) { if (q.close[i] != null) { rate = q.close[i]; break; } } }
    if (!isFinite(rate) || rate <= 0) throw new Error('no rate');
    return rate;
  }
  function fetchFxRate() {
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/THB=X?range=5d&interval=1d';
    var enc = encodeURIComponent(base);
    var tries = [
      { url: 'https://api.allorigins.win/raw?url=' + enc },
      { url: 'https://corsproxy.io/?url=' + enc },
      { url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { url: 'https://thingproxy.freeboard.io/fetch/' + base },
      { url: base }
    ];
    var i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('all failed'));
      var t = tries[i++];
      return fetchOne(t.url, 7000, parseFxRate).catch(function () { return next(); });
    }
    return next();
  }
  function setFxStatus(msg, cls) { var el = $('fxStatus'); if (el) { el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); } }
  function fxOn() { return !!($('fxShowChk') && $('fxShowChk').checked) && isFinite(fxRate) && fxRate > 0; }
  function fxSpan(n) { return (fxOn() && isFinite(n)) ? (' <span class="fx-sub">(≈ ' + baht(n * fxRate) + ')</span>') : ''; }
  function updatePriceFx() {
    var el = $('priceFx'); if (!el) return;
    var p = num($('price').value);
    el.textContent = (fxOn() && isFinite(p)) ? ('≈ ' + baht(p * fxRate) + ' ต่อหุ้น (ตามอัตราที่ตั้งไว้)') : '';
  }
  function doFxFetch() {
    setFxStatus('กำลังดึงอัตราแลกเปลี่ยน…');
    fetchFxRate().then(function (rate) {
      fxRate = rate; saveFxCache(rate);
      $('fxRate').value = rate.toFixed(2);
      setFxStatus('อัตราจาก Yahoo Finance (THB=X) · เมื่อสักครู่', 'ok');
      updatePriceFx();
    }, function () {
      var c = loadFxCache();
      if (c) { fxRate = c.rate; $('fxRate').value = c.rate.toFixed(2); setFxStatus('ดึงสดไม่ได้ — ใช้อัตราที่บันทึกไว้ (' + cacheAgeText(c.ts) + ')', 'ok'); updatePriceFx(); }
      else setFxStatus('ดึงอัตโนมัติไม่ได้ตอนนี้ — กรอกอัตราแลกเปลี่ยนเองด้านบน', 'err');
    });
  }

  /* ══════ กราฟ lightweight-charts ══════ */
  var LWC = null, chart = null, candle = null, volS = null, ma20S = null, ma50S = null, rsiChart = null, rsiS = null;
  var fullData = null, curTF = 63, tg = { ma20: true, ma50: true, vol: true, rsi: false }, syncing = false, themeObs = null;

  function themeColors() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark ? { bg: '#1B2030', text: '#C2CBDD', grid: '#2A3040', border: '#2A3040' }
                : { bg: '#FFFFFF', text: '#4A5568', grid: '#EEF1F7', border: '#E4E9F2' };
  }
  function chartWidth(el) { return Math.max(240, (el && (el.clientWidth || el.offsetWidth)) || (el && el.parentElement && el.parentElement.clientWidth) || 320); }
  function baseOpts(w, h) {
    var c = themeColors();
    return {
      width: w, height: h,
      localization: { locale: 'en-US' },
      layout: { background: { color: c.bg }, textColor: c.text, fontFamily: "'Prompt',system-ui,sans-serif" },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, rightOffset: 3, fixLeftEdge: true },
      crosshair: { mode: (LWC && LWC.CrosshairMode) ? LWC.CrosshairMode.Normal : 1 },
      handleScroll: true, handleScale: true
    };
  }
  function fmtDate(t) {
    if (typeof t === 'string') { var p = t.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
    if (t && t.year) return t.day + '/' + t.month + '/' + t.year; return String(t);
  }
  function showLegend(time, o) {
    var up = o.close >= o.open;
    $('lwLegend').innerHTML = '<span>' + fmtDate(time) + '</span>' +
      '<span>เปิด ' + fmt(o.open) + '</span><span>สูง ' + fmt(o.high) + '</span><span>ต่ำ ' + fmt(o.low) + '</span>' +
      '<span class="' + (up ? 'up' : 'dn') + '">ปิด ' + fmt(o.close) + '</span>';
  }
  function updateLegendLast() { if (!fullData) return; var o = fullData.ohlc[fullData.ohlc.length - 1]; showLegend(o.time, o); }
  function onCross(param) {
    if (!param || !param.time || !param.seriesData) { updateLegendLast(); return; }
    var o = param.seriesData.get(candle);
    if (o) showLegend(param.time, o); else updateLegendLast();
  }
  function linkTime(a, b) {
    a.timeScale().subscribeVisibleLogicalRangeChange(function (r) {
      if (syncing || !r) return; syncing = true; try { b.timeScale().setVisibleLogicalRange(r); } catch (e) {} syncing = false;
    });
  }
  function cutoffTime() { return fullData.times[Math.max(0, fullData.times.length - curTF)]; }

  function buildRsi() {
    if (rsiChart || !fullData || !LWC) return;
    var el = $('lwRsi'); el.innerHTML = '';
    rsiChart = LWC.createChart(el, baseOpts(chartWidth(el), 110));
    rsiS = rsiChart.addLineSeries({ color: '#6C63D9', lineWidth: 2, priceLineVisible: false });
    try {
      rsiS.createPriceLine({ price: 70, color: '#ef5350', lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: '70' });
      rsiS.createPriceLine({ price: 30, color: '#26a69a', lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: '30' });
    } catch (e) {}
    var cut = cutoffTime();
    rsiS.setData(fullData.rsi.filter(function (p) { return p.time >= cut; }));
    rsiChart.timeScale().fitContent();
    linkTime(chart, rsiChart); linkTime(rsiChart, chart);
  }
  function applyToggles() {
    if (ma20S) ma20S.applyOptions({ visible: tg.ma20 });
    if (ma50S) ma50S.applyOptions({ visible: tg.ma50 });
    if (volS) volS.applyOptions({ visible: tg.vol });
    if (tg.rsi) { buildRsi(); $('lwRsi').style.display = 'block'; }
    else { $('lwRsi').style.display = 'none'; if (rsiChart) { try { rsiChart.remove(); } catch (e) {} rsiChart = null; rsiS = null; } }
    [].forEach.call(document.querySelectorAll('#tgGroup .tg'), function (b) { b.classList.toggle('on', !!tg[b.getAttribute('data-tg')]); });
  }
  function applyTF(n) {
    curTF = n; if (!fullData || !candle) return;
    var s = Math.max(0, fullData.ohlc.length - n), cut = fullData.times[s];
    candle.setData(fullData.ohlc.slice(s));
    volS.setData(fullData.vol.slice(s));
    ma20S.setData(fullData.ma20.filter(function (p) { return p.time >= cut; }));
    ma50S.setData(fullData.ma50.filter(function (p) { return p.time >= cut; }));
    if (rsiChart && rsiS) rsiS.setData(fullData.rsi.filter(function (p) { return p.time >= cut; }));
    chart.timeScale().fitContent();
    if (rsiChart) rsiChart.timeScale().fitContent();
    updateLegendLast();
    [].forEach.call(document.querySelectorAll('#tfGroup .tf'), function (b) { b.classList.toggle('on', +b.getAttribute('data-tf') === n); });
  }
  function setupThemeObserver() {
    if (themeObs) return;
    themeObs = new MutationObserver(function () {
      var c = themeColors();
      [chart, rsiChart].forEach(function (ch) {
        if (!ch) return;
        ch.applyOptions({ layout: { background: { color: c.bg }, textColor: c.text }, grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } }, rightPriceScale: { borderColor: c.border }, timeScale: { borderColor: c.border } });
      });
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  function buildChart(data) {
    if (!window.LightweightCharts) { return false; }
    LWC = window.LightweightCharts; fullData = data;
    if (chart) { try { chart.remove(); } catch (e) {} chart = null; }
    if (rsiChart) { try { rsiChart.remove(); } catch (e) {} rsiChart = null; rsiS = null; }
    /* โชว์การ์ดก่อนสร้างกราฟ — ถ้าสร้างตอนกล่องยังซ่อน (กว้าง 0) iOS Safari มักไม่วาด */
    $('chartCard').style.display = 'block';
    var el = $('lwChart'); el.innerHTML = '';
    chart = LWC.createChart(el, baseOpts(chartWidth(el), 300));
    candle = chart.addCandlestickSeries({ upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
    volS = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    ma20S = chart.addLineSeries({ color: '#F5A524', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    ma50S = chart.addLineSeries({ color: '#3B9BEA', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    chart.subscribeCrosshairMove(onCross);
    applyTF(curTF); applyToggles(); setupThemeObserver(); setupResize();
    /* บังคับปรับขนาด/วาดใหม่หลัง layout นิ่ง (กัน canvas กว้าง 0 บน iOS) */
    if (window.requestAnimationFrame) requestAnimationFrame(reflow);
    setTimeout(reflow, 120);
    return true;
  }
  function reflow() {
    var el = $('lwChart');
    if (chart && el) { try { chart.applyOptions({ width: chartWidth(el) }); chart.timeScale().fitContent(); } catch (e) {} }
    var er = $('lwRsi');
    if (rsiChart && er) { try { rsiChart.applyOptions({ width: chartWidth(er) }); rsiChart.timeScale().fitContent(); } catch (e) {} }
  }
  var resizeWired = false, resizeObs = null;
  function setupResize() {
    if (resizeWired) return; resizeWired = true;
    window.addEventListener('resize', reflow);
    if ('ResizeObserver' in window) { resizeObs = new ResizeObserver(reflow); try { resizeObs.observe($('lwChart')); } catch (e) {} }
  }

  /* ── ป้อนชุดข้อมูล → วิเคราะห์ + วาดกราฟ ─────────────────────── */
  var lastSource = { kind: 'real' };
  function setSourceBadge(src, days) {
    var el = $('chartSource'); if (!el) return;
    if (src) lastSource = src; else src = lastSource;
    if (src.kind === 'demo') { el.className = 'src-badge demo'; el.textContent = 'ข้อมูลตัวอย่าง — ไม่ใช่ราคาจริง (ไว้ฝึกอ่านกราฟ)'; }
    else if (src.kind === 'paste') { el.className = 'src-badge paste'; el.textContent = 'ราคาที่วางเอง · ' + days + ' วัน'; }
    else { el.className = 'src-badge real'; el.textContent = '' + (src.label || 'ราคาจริง') + ' · ' + (src.stale ? ('ราคาล่าสุด ' + cacheAgeText(src.cachedAt)) : 'ราคาจริง') + ' · ' + days + ' วัน'; }
  }
  function useSeries(s, msg, cls, src) {
    lastSeries = s;
    var c = s.closes;
    $('price').value = c[c.length - 1].toFixed(2);
    $('hi').value = Math.max.apply(null, c).toFixed(2);
    $('lo').value = Math.min.apply(null, c).toFixed(2);
    if (msg) setStatus(msg, cls);
    setSourceBadge(src, c.length);
    updatePriceFx();
    showAnalysis(analyzeSeries(s));
    if (!buildChart(s)) setStatus('โหลดไลบรารีกราฟไม่ได้ (ลองออนไลน์แล้วรีเฟรช) — ส่วนไฟจราจร/คำนวณเงินยังใช้ได้', 'err');
  }

  function showAnalysis(a) {
    lastAnalysis = a;
    $('lightCard').style.display = 'block';
    /* วาดวงกลมสีด้วย CSS แทน emoji 🟢🟡🔴 — บางอุปกรณ์/เบราว์เซอร์ไม่มีฟอนต์รองรับ
       emoji วงกลมสี (โดยเฉพาะ 🟢/🟡 ที่เพิ่งเข้า Unicode ทีหลัง) แสดงเป็นกล่องว่างแทน
       ซึ่งทำให้ไฟจราจร (จุดขายหลักของหน้านี้) สื่อความหมายไม่ได้เลย */
    var bulbColors = { green: 'var(--ok)', yellow: 'var(--amber)', red: 'var(--err)' };
    $('light').className = 'light ' + a.light;
    $('bulb').textContent = '';
    $('bulb').style.background = bulbColors[a.light] || '#B8C0D4';
    $('verdict').textContent = a.verdict;
    $('why').textContent = a.why;

    if (a.det && !a.simple && isFinite(a.det.rsi)) {
      var d = a.det, rows = [
        ['เส้นเฉลี่ย 20 วัน (EMA20)', fmt(d.ema20)], ['เส้นเฉลี่ย 50 วัน (EMA50)', fmt(d.ema50)],
        ['RSI (14)', fmt(d.rsi, 1)], ['MACD histogram', fmt(d.macdHist, 3)],
        ['กรอบบน (Bollinger)', fmt(d.bbUpper)], ['กรอบล่าง (Bollinger)', fmt(d.bbLower)],
        ['ATR (ความผันผวน)', fmt(d.atr)], ['แนวรับล่าสุด', fmt(d.support)], ['แนวต้านล่าสุด', fmt(d.resistance)],
        ['ความแรงแนวโน้ม (ADX 14)', isFinite(d.adx) ? fmt(d.adx, 0) + (d.adx >= 20 ? ' · แข็งแรง' : ' · อ่อน') : '—'],
        ['จุดตัดขาดทุนตาม (Parabolic SAR)', d.psar ? fmt(d.psar.sar) + (d.psar.up ? ' · เทรนด์ขึ้น' : ' · เทรนด์ลง') : '—']
      ], html = '';
      rows.forEach(function (r) { html += '<div class="k">' + r[0] + '</div><div class="v">' + r[1] + '</div>'; });
      $('detKv').innerHTML = html;
      $('detailsBox').style.display = 'block';
    } else { $('detailsBox').style.display = 'none'; }

    if (!$('entry').value) $('entry').value = a.price.toFixed(2);
    if (!$('stop').value && isFinite(a.suggestStop)) $('stop').value = a.suggestStop.toFixed(2);
  }

  function setStatus(msg, cls) { var el = $('fetchStatus'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }

  function doAnalyze() {
    if (lastSeries) { useSeries(lastSeries); return; }
    var price = num($('price').value), hi = num($('hi').value), lo = num($('lo').value);
    if (!isFinite(price)) { setStatus('กรอกอย่างน้อย "ราคาตอนนี้" ก่อนนะครับ', 'err'); return; }
    updatePriceFx();
    $('chartCard').style.display = 'none';
    if (isFinite(hi) && isFinite(lo) && hi > lo) showAnalysis(analyzeSimple(price, hi, lo));
    else {
      showAnalysis({ light: 'gray', verdict: 'กรอกราคาสูง/ต่ำของรอบ เพื่อประเมินถูก-แพง', why: 'หรือกด "ดูกราฟตัวอย่าง (ฝึกอ่าน)" เพื่อลองเล่นกราฟ — ตอนนี้ทำได้เฉพาะคำนวณเงินด้านล่าง', pros: [], cons: [], price: price, suggestStop: price * 0.95, resistance: NaN, det: {}, simple: true });
      $('detailsBox').style.display = 'none';
    }
  }
  function doFetch() {
    var sym = ($('sym').value || '').trim().toUpperCase();
    if (!sym) { setStatus('พิมพ์ชื่อย่อหุ้นก่อน เช่น AAPL', 'err'); return; }
    setStatus('กำลังดึงราคา ' + sym + '…'); $('fetchBtn').disabled = true;
    getSeries(sym).then(function (r) {
      $('fetchBtn').disabled = false;
      var s = r.series;
      if (r.stale) {
        useSeries(s, 'ดึงสดไม่ได้ตอนนี้ — ใช้ราคาที่บันทึกไว้ (' + cacheAgeText(r.cachedAt) + ') · ' + s.closes.length + ' วัน', 'ok', { kind: 'real', label: sym, stale: true, cachedAt: r.cachedAt });
      } else {
        var msg = 'ดึงราคา ' + sym + ' สำเร็จ (' + s.closes.length + ' วัน · ผ่าน ' + s.source + ')';
        if (s.closes.length < 30) msg += ' — ได้ประวัติน้อย กราฟอาจดูแนวโน้มไม่ชัด';
        useSeries(s, msg, 'ok', { kind: 'real', label: sym });
      }
    }).catch(function () {
      $('fetchBtn').disabled = false;
      setStatus('ดึงราคาสดไม่ได้ตอนนี้ (บริการฟรีจำกัดเป็นบางเวลา ไม่ใช่ที่เครื่องคุณ) — ลองกดอีกครั้ง หรือกด "ดูกราฟตัวอย่าง (ฝึกอ่าน)" / กรอกราคาเองจากแอปเทรด');
      $('price').focus();
    });
  }
  function doDemo() { useSeries(demoData(), 'กำลังแสดง "ข้อมูลตัวอย่าง" (ไม่ใช่ราคาจริง) — ไว้ลองเล่นกราฟและฝึกอ่าน', 'ok', { kind: 'demo' }); }
  function doPaste() {
    var s = parsePaste($('pasteBox').value || '');
    if (!s) { setStatus('วางราคาปิดอย่างน้อย 5 วันก่อนนะครับ', 'err'); return; }
    useSeries(s, 'ใช้ราคาที่วางแล้ว (' + s.closes.length + ' วัน)', 'ok', { kind: 'paste' });
  }

  /* ── คำนวณเงิน (USD) ────────────────────────────────────────── */
  function doCalc() {
    var capital = num($('capital').value), riskPct = num($('riskPct').value);
    var entry = num($('entry').value), stop = num($('stop').value), comm = num($('comm').value);
    if (!isFinite(entry)) entry = num($('price').value);
    if (!isFinite(entry)) { setStatus('กรอกราคาเข้าซื้อ (หรือราคาตอนนี้) ก่อน', 'err'); return; }
    if (!isFinite(stop)) { stop = (lastAnalysis && isFinite(lastAnalysis.suggestStop)) ? lastAnalysis.suggestStop : entry * 0.95; $('stop').value = stop.toFixed(2); }
    if (!isFinite(capital) || capital <= 0) { capital = 10000; $('capital').value = capital; }
    if (!isFinite(riskPct) || riskPct <= 0) { riskPct = 2; $('riskPct').value = riskPct; }
    if (!isFinite(comm) || comm < 0) { comm = 0.20; $('comm').value = comm; }

    var res = riskCalc({ capital: capital, riskPct: riskPct, entry: entry, stop: stop, comm: comm, resistance: lastAnalysis ? lastAnalysis.resistance : NaN });
    var box = $('riskResult');
    if (res.error) {
      $('riskHeadline').innerHTML = '<span style="color:var(--err)">' + res.error + '</span>';
      $('riskKv').innerHTML = ''; $('tpRow').innerHTML = ''; box.classList.add('show'); $('saveBtn').style.display = 'none'; return;
    }
    $('riskHeadline').innerHTML = 'ควรซื้อได้ประมาณ <b>' + fmt0(res.shares) + ' หุ้น</b> ใช้เงิน ≈ <b>' + usd0(res.cost) + '</b>' + fxSpan(res.cost);
    var kv = '';
    kv += '<div class="k">ถ้าผิดทาง (แตะ Stop) เสียไม่เกิน</div><div class="v risk">' + usd0(res.riskUsd) + fxSpan(res.riskUsd) + '</div>';
    kv += '<div class="k">ราคาตัดขาดทุน (Stop)</div><div class="v">' + fmt(stop) + '</div>';
    kv += '<div class="k">ราคาคุ้มทุน (รวมค่าคอมฯ ไป-กลับ)</div><div class="v">' + fmt(res.breakeven) + '</div>';
    if (isFinite(res.rr)) kv += '<div class="k">ความคุ้ม (กำไรคาดหวัง : ความเสี่ยง) ถึงแนวต้าน</div><div class="v">' + fmt(res.rr, 1) + ' : 1</div>';
    $('riskKv').innerHTML = kv;
    $('tpRow').innerHTML = '<span class="tp-chip">ทยอยขายไม้ 1: ' + fmt(res.tp1) + '</span><span class="tp-chip">ไม้ 2: ' + fmt(res.tp2) + '</span><span class="tp-chip">ไม้ 3: ' + fmt(res.tp3) + '</span>';
    if (res.note) $('tpRow').innerHTML += '<div style="flex:1 1 100%;font-size:12px;color:var(--warn);margin-top:6px">ℹ️ ' + res.note + '</div>';
    box.classList.add('show');
    $('saveBtn').style.display = 'inline-flex';
    $('saveBtn')._data = { sym: ($('sym').value || '').trim().toUpperCase() || 'หุ้น', shares: res.shares, cost: entry };
  }

  /* ── พอร์ต ──────────────────────────────────────────────────── */
  function loadPf() { try { return JSON.parse(localStorage.getItem(PF_KEY)) || []; } catch (e) { return []; } }
  function savePf(a) { try { localStorage.setItem(PF_KEY, JSON.stringify(a)); } catch (e) {} DriveSync.scheduleSync(); }
  function renderPf() {
    var pf = loadPf(), box = $('pfBox');
    if (!pf.length) { box.innerHTML = '<div class="pf-empty">ยังไม่มีหุ้นในพอร์ต — คำนวณด้านบนแล้วกด "บันทึกเข้าพอร์ต"</div>'; return; }
    var html = '<table class="pf-table"><thead><tr><th>หุ้น</th><th>จำนวน</th><th>ต้นทุน/หุ้น</th><th>ราคาปัจจุบัน</th><th>กำไร/ขาดทุน</th><th></th></tr></thead><tbody>';
    pf.forEach(function (h, i) {
      html += '<tr data-i="' + i + '"><td>' + h.sym + '</td><td>' + fmt0(h.shares) + '</td><td>' + fmt(h.cost) + '</td>' +
        '<td><input type="number" class="pf-price" inputmode="decimal" step="0.01" placeholder="ราคา" value="' + (h.cur != null ? h.cur : '') + '"></td>' +
        '<td class="pf-pl">—</td><td class="pf-actions"><button class="pf-sell" title="เช็กควรขาย?">ควรขาย?</button> <button class="pf-del" title="ลบ">✕</button></td></tr>' +
        '<tr class="pf-sellrow" data-sr="' + i + '"><td colspan="6"></td></tr>';
    });
    html += '</tbody></table>'; box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('tr[data-i]'), function (tr) {
      var i = +tr.getAttribute('data-i'), h = pf[i], inp = tr.querySelector('.pf-price'), cell = tr.querySelector('.pf-pl');
      var sellCell = box.querySelector('tr[data-sr="' + i + '"] td');
      function upd() {
        var cur = num(inp.value);
        if (!isFinite(cur)) { cell.textContent = '—'; cell.className = 'pf-pl'; return; }
        var pl = (cur - h.cost) * h.shares, pct = (cur / h.cost - 1) * 100;
        cell.innerHTML = (pl >= 0 ? '+' : '−') + usd0(Math.abs(pl)) + ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)' + fxSpan(pl);
        cell.className = 'pf-pl ' + (pl >= 0 ? 'up' : 'down');
      }
      inp.addEventListener('input', function () { upd(); h.cur = num(inp.value); savePf(pf); });
      tr.querySelector('.pf-del').addEventListener('click', function () { pf.splice(i, 1); savePf(pf); renderPf(); });
      tr.querySelector('.pf-sell').addEventListener('click', function () {
        sellCell.innerHTML = '<div class="sell-verdict warn">กำลังดึงราคา ' + h.sym + '…</div>';
        getSeries(h.sym).then(function (r) {
          var s = r.series, a = analyzeSeries(s), v = sellVerdict(a), price = s.closes[s.closes.length - 1];
          inp.value = price.toFixed(2); h.cur = price; savePf(pf); upd();
          var pl = (price - h.cost) * h.shares, pct = (price / h.cost - 1) * 100;
          sellCell.innerHTML = '<div class="sell-detail"><div class="sell-verdict ' + v.cls + '">' + v.headline +
            '<br><span style="font-weight:500">ราคาล่าสุด ' + fmt(price) + (r.stale ? ' (บันทึกไว้ ' + cacheAgeText(r.cachedAt) + ')' : '') +
            ' · ต้นทุน ' + fmt(h.cost) + ' · ' + (pl >= 0 ? 'กำไร ' : 'ขาดทุน ') + usd0(Math.abs(pl)) + fxSpan(pl) + ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)</span>' +
            sellLevelsHtml(v.levels) + '</div>' +
            companyInfoHtml(h.sym) +
            '<div class="news-block"></div></div>';
          renderNewsBlock(sellCell.querySelector('.news-block'), h.sym);
        }, function () {
          sellCell.innerHTML = '<div class="sell-detail"><div class="sell-verdict warn">ดึงราคา ' + h.sym + ' ไม่ได้ตอนนี้ — ลองใหม่อีกครั้ง หรือกรอกราคาปัจจุบันเองในช่อง</div>' +
            companyInfoHtml(h.sym) + '</div>';
        });
      });
      upd();
    });
  }

  /* ── เช็กลิสต์ก่อนเข้าไม้ (GO/NO-GO) ─────────────────────────── */
  function checklistChecks() {
    var a = lastAnalysis, det = (a && a.det) ? a.det : {};
    var entry = num($('entry').value), stop = num($('stop').value), riskPct = num($('riskPct').value);
    var checks = [];
    if (a && isFinite(det.ema20)) {
      var up = isFinite(det.ema50) ? a.price >= det.ema50 : a.price >= det.ema20;
      var adxTxt = isFinite(det.adx) ? (' · ADX ' + det.adx.toFixed(0) + (det.adx >= 20 ? ' เทรนด์แข็งแรง' : ' เทรนด์อ่อน ควรระวัง')) : '';
      checks.push({ ok: up, txt: (up ? 'อยู่ในแนวโน้มขึ้น (ราคาเหนือเส้นเฉลี่ย)' : 'ยังไม่อยู่ในแนวโน้มขึ้น (ราคาใต้เส้นเฉลี่ย)') + adxTxt });
      var over = (a.price - det.ema20) / det.ema20, notChase = over <= 0.05;
      checks.push({ ok: notChase, txt: notChase ? 'ไม่ไล่ราคา (ห่างเส้นเฉลี่ย 20 ไม่เกิน 5%)' : 'กำลังไล่ราคา (สูงกว่าเส้นเฉลี่ย 20 เกิน 5%)' });
    } else {
      checks.push({ ok: null, txt: 'แนวโน้ม/การไล่ราคา: ต้องมีข้อมูลกราฟก่อน (กด "ดึงราคา" หรือ "ดูกราฟตัวอย่าง")' });
    }
    if (a && isFinite(det.rsi)) checks.push({ ok: det.rsi < 70, txt: det.rsi < 70 ? 'ไม่ร้อนแรงเกิน (RSI ' + det.rsi.toFixed(0) + ')' : 'ร้อนแรงเกินไป (RSI ' + det.rsi.toFixed(0) + ' ≥ 70) เสี่ยงย่อ' });
    else checks.push({ ok: null, txt: 'RSI: ต้องมีข้อมูลกราฟก่อน' });
    var stopOk = isFinite(entry) && isFinite(stop) && stop < entry;
    checks.push({ ok: stopOk, txt: stopOk ? 'ตั้งจุดตัดขาดทุน (Stop) แล้ว' : 'ยังไม่ตั้งจุดตัดขาดทุน — กด "คำนวณ" ในขั้นที่ 2 ก่อน' });
    checks.push({ ok: isFinite(riskPct) && riskPct <= 2, txt: (isFinite(riskPct) && riskPct <= 2) ? 'เสี่ยงต่อไม้ ≤ 2% (' + riskPct + '%)' : 'เสี่ยงต่อไม้สูงไป (' + (isFinite(riskPct) ? riskPct + '%' : '-') + ') — ควร ≤ 2%' });
    if (a && isFinite(a.resistance) && stopOk && a.resistance > entry) {
      var rr = (a.resistance - entry) / (entry - stop), rrOk = rr >= 2;
      checks.push({ ok: rrOk, txt: rrOk ? 'กำไรคาดหวัง:เสี่ยง ≥ 2:1 (' + rr.toFixed(1) + ':1)' : 'กำไร:เสี่ยงน้อยไป (' + rr.toFixed(1) + ':1) — ควร ≥ 2:1' });
    } else {
      checks.push({ ok: null, txt: 'กำไร:เสี่ยง: ต้องมีแนวต้านจากกราฟ + ตั้ง Stop ก่อน' });
    }
    return checks;
  }
  function doChecklist() {
    var checks = checklistChecks();
    var fails = checks.filter(function (c) { return c.ok === false; }).length;
    var unknowns = checks.filter(function (c) { return c.ok === null; }).length;
    var box = $('checkResult'), v = $('checkVerdict');
    if (fails > 0) { v.className = 'verdict-box no'; v.textContent = 'ยังไม่ควรเข้า — ติด ' + fails + ' ข้อ ควรแก้ให้ครบก่อนซื้อ'; }
    else if (unknowns > 0) { v.className = 'verdict-box warn'; v.textContent = 'ข้อมูลไม่พอประเมินครบ — กด "ประเมิน"/"ดึงราคา" แล้ว "คำนวณ" ก่อน'; }
    else { v.className = 'verdict-box go'; v.textContent = 'เข้าได้ตามแผน — ผ่านครบทุกข้อ (แต่ยังไม่การันตีกำไร ทำตามแผนและตัดขาดทุนเสมอ)'; }
    var html = '';
    checks.forEach(function (c) {
      var ic = c.ok === true ? '' : c.ok === false ? '' : '◻️';
      html += '<li class="' + (c.ok === false ? 'fail' : 'pass') + '"><span class="ic">' + ic + '</span><span>' + c.txt + '</span></li>';
    });
    $('chkList').innerHTML = html;
    box.style.display = 'block';
  }

  /* ── Expectancy ─────────────────────────────────────────────── */
  function doExpectancy() {
    var w = num($('eWin').value) / 100, wr = num($('eWinR').value), lr = num($('eLossR').value);
    var box = $('eResult');
    if (!(w >= 0 && w <= 1) || !isFinite(wr) || !isFinite(lr) || wr < 0 || lr <= 0) {
      box.className = 'verdict-box warn'; box.textContent = 'กรอกตัวเลขให้ครบ (อัตราชนะ 0–100%, กำไร/ขาดทุนเป็นเท่าของ R)'; box.style.display = 'block'; return;
    }
    var exp = w * wr - (1 - w) * lr;
    var beWin = lr / (wr + lr) * 100; /* อัตราชนะที่ต้องมีเพื่อเสมอตัว */
    var msg = 'ค่าคาดหวังต่อไม้ ≈ <b>' + (exp >= 0 ? '+' : '') + exp.toFixed(2) + ' R</b> ' +
      '(ถ้าเสี่ยงไม้ละ $1,000 ≈ ' + (exp >= 0 ? '+' : '−') + usd0(Math.abs(exp) * 1000) + ' ต่อไม้โดยเฉลี่ย)<br>' +
      '<span style="font-weight:500">ต้องชนะอย่างน้อย ~' + beWin.toFixed(0) + '% ถึงจะเสมอตัวที่ R นี้</span>';
    if (exp > 0.1) { box.className = 'verdict-box go'; box.innerHTML = 'ได้เปรียบระยะยาว<br>' + msg + '<br><span style="font-weight:500">ถ้าทำตามวินัยสม่ำเสมอ (คุมความเสี่ยงเท่ากันทุกไม้) มีโอกาสกำไรระยะยาว</span>'; }
    else if (exp > 0) { box.className = 'verdict-box warn'; box.innerHTML = 'แทบเสมอตัว<br>' + msg + '<br><span style="font-weight:500">หักค่าคอมฯแล้วอาจขาดทุน — ต้องเพิ่มกำไรตอนชนะ หรือลดขาดทุนตอนแพ้</span>'; }
    else { box.className = 'verdict-box no'; box.innerHTML = 'ขาดทุนระยะยาว<br>' + msg + '<br><span style="font-weight:500">ถึงชนะบ่อยก็ไม่พอ — ต้อง "ปล่อยกำไรให้ยาว ตัดขาดทุนให้ไว" (เพิ่ม R ตอนชนะ)</span>'; }
    box.style.display = 'block';
  }

  /* ── สมุดเทรด + สถิติ ────────────────────────────────────────── */
  var JN_KEY = 'tanot:invest:globaljournal';
  function loadJn() { try { return JSON.parse(localStorage.getItem(JN_KEY)) || []; } catch (e) { return []; } }
  function saveJn(a) { try { localStorage.setItem(JN_KEY, JSON.stringify(a)); } catch (e) {} DriveSync.scheduleSync(); }
  function addJournal() {
    var sym = ($('jSym').value || '').trim().toUpperCase() || 'หุ้น';
    var en = num($('jEntry').value), ex = num($('jExit').value), sh = num($('jShares').value);
    if (!isFinite(en) || !isFinite(ex) || !isFinite(sh) || sh <= 0) { alert('กรอกราคาเข้า ราคาออก และจำนวนหุ้นให้ครบ'); return; }
    var jn = loadJn(); jn.push({ sym: sym, en: en, ex: ex, sh: sh, pl: (ex - en) * sh, ts: Date.now() });
    saveJn(jn); $('jEntry').value = ''; $('jExit').value = ''; $('jShares').value = ''; renderJournal();
  }
  function renderJournal() {
    var jn = loadJn(), box = $('jBox'), stats = $('jStats');
    if (!jn.length) { box.innerHTML = '<div class="pf-empty" style="font-size:13px;color:var(--muted);padding:8px 0">ยังไม่มีไม้ที่บันทึก — ปิดไม้แล้วบันทึกทุกครั้ง จะเห็นสถิติจริงของตัวเอง</div>'; stats.style.display = 'none'; return; }
    var wins = jn.filter(function (r) { return r.pl > 0; }), losses = jn.filter(function (r) { return r.pl <= 0; });
    var total = jn.reduce(function (s, r) { return s + r.pl; }, 0);
    var winRate = wins.length / jn.length * 100;
    var avgWin = wins.length ? wins.reduce(function (s, r) { return s + r.pl; }, 0) / wins.length : 0;
    var avgLoss = losses.length ? Math.abs(losses.reduce(function (s, r) { return s + r.pl; }, 0) / losses.length) : 0;
    var expUsd = (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss;
    stats.style.display = 'grid';
    stats.innerHTML =
      '<div class="j-stat"><div class="lbl">จำนวนไม้</div><div class="val">' + jn.length + '</div></div>' +
      '<div class="j-stat"><div class="lbl">อัตราชนะ</div><div class="val">' + winRate.toFixed(0) + '%</div></div>' +
      '<div class="j-stat"><div class="lbl">กำไร/ขาดทุนรวม</div><div class="val" style="color:' + (total >= 0 ? 'var(--ok)' : 'var(--err)') + '">' + (total >= 0 ? '+' : '−') + usd0(Math.abs(total)) + '</div></div>' +
      '<div class="j-stat"><div class="lbl">คาดหวัง/ไม้</div><div class="val" style="color:' + (expUsd >= 0 ? 'var(--ok)' : 'var(--err)') + '">' + (expUsd >= 0 ? '+' : '−') + usd0(Math.abs(expUsd)) + '</div></div>';
    var html = '<table class="j-table"><thead><tr><th>หุ้น</th><th>เข้า</th><th>ออก</th><th>จำนวน</th><th>ผล</th><th></th></tr></thead><tbody>';
    jn.slice().reverse().forEach(function (r, ri) {
      var idx = jn.length - 1 - ri;
      html += '<tr><td>' + r.sym + '</td><td>' + fmt(r.en) + '</td><td>' + fmt(r.ex) + '</td><td>' + fmt0(r.sh) + '</td>' +
        '<td class="' + (r.pl >= 0 ? 'j-win' : 'j-loss') + '">' + (r.pl >= 0 ? '+' : '−') + usd0(Math.abs(r.pl)) + '</td>' +
        '<td><button class="j-del" data-i="' + idx + '">✕</button></td></tr>';
    });
    html += '</tbody></table>'; box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.j-del'), function (b) { b.addEventListener('click', function () { var jn = loadJn(); jn.splice(+b.getAttribute('data-i'), 1); saveJn(jn); renderJournal(); }); });
  }

  /* ══════ หุ้นดัง (US) browser + สแกนเนอร์ ══════ */
  var USLIST = [
    /* เทคโนโลยี */
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'AMD', 'CRM',
    /* การเงิน/ธนาคาร */
    'JPM', 'BAC', 'V', 'MA', 'GS', 'MS',
    /* สุขภาพ */
    'JNJ', 'UNH', 'PFE', 'ABBV', 'LLY',
    /* สินค้าอุปโภคบริโภคจำเป็น */
    'PG', 'KO', 'PEP', 'WMT', 'COST',
    /* สินค้าฟุ่มเฟือย/ค้าปลีก */
    'MCD', 'NKE', 'SBUX', 'HD', 'DIS', 'NFLX',
    /* พลังงาน */
    'XOM', 'CVX', 'COP',
    /* อุตสาหกรรม */
    'BA', 'CAT', 'GE', 'UPS', 'HON'
  ];

  /* ══════ ข้อมูลบริษัท/กลุ่มธุรกิจ (ข้อมูลอ้างอิงสาธารณะ) ══════ */
  var COMPANY_INFO = {
    AAPL: { name: 'Apple', sector: 'เทคโนโลยี', business: 'ผู้ผลิต iPhone/Mac/iPad และระบบนิเวศบริการดิจิทัล (App Store, iCloud) บริษัทที่มีมูลค่าตลาดสูงที่สุดแห่งหนึ่งของโลก' },
    MSFT: { name: 'Microsoft', sector: 'เทคโนโลยี', business: 'ซอฟต์แวร์องค์กร (Windows, Office 365) และธุรกิจคลาวด์ Azure รายใหญ่อันดับต้นของโลก' },
    GOOGL: { name: 'Alphabet (Google)', sector: 'เทคโนโลยี', business: 'เจ้าของ Google Search, YouTube, Android และธุรกิจโฆษณาออนไลน์/คลาวด์คอมพิวติ้ง' },
    AMZN: { name: 'Amazon', sector: 'เทคโนโลยี', business: 'อีคอมเมิร์ซรายใหญ่ที่สุดของโลก บวกธุรกิจคลาวด์คอมพิวติ้ง AWS ที่ทำกำไรสูง' },
    META: { name: 'Meta Platforms', sector: 'เทคโนโลยี', business: 'เจ้าของ Facebook, Instagram, WhatsApp รายได้หลักจากโฆษณาดิจิทัล' },
    NVDA: { name: 'Nvidia', sector: 'เทคโนโลยี', business: 'ผู้ผลิตชิปกราฟิก/ชิปประมวลผล AI รายใหญ่ที่สุด ครองตลาดฮาร์ดแวร์ฝึกโมเดล AI' },
    TSLA: { name: 'Tesla', sector: 'เทคโนโลยี', business: 'ผู้ผลิตรถยนต์ไฟฟ้าและระบบกักเก็บพลังงาน/โซลาร์เซลล์' },
    AVGO: { name: 'Broadcom', sector: 'เทคโนโลยี', business: 'ผู้ผลิตชิปเซมิคอนดักเตอร์/อุปกรณ์เครือข่าย และซอฟต์แวร์องค์กร' },
    AMD: { name: 'Advanced Micro Devices', sector: 'เทคโนโลยี', business: 'ผู้ผลิตชิปประมวลผล CPU/GPU คู่แข่งหลักของ Intel และ Nvidia' },
    CRM: { name: 'Salesforce', sector: 'เทคโนโลยี', business: 'ซอฟต์แวร์บริหารความสัมพันธ์ลูกค้า (CRM) บนคลาวด์รายใหญ่' },
    JPM: { name: 'JPMorgan Chase', sector: 'การเงิน/ธนาคาร', business: 'ธนาคารพาณิชย์และวาณิชธนกิจรายใหญ่ที่สุดของสหรัฐฯ ตามสินทรัพย์' },
    BAC: { name: 'Bank of America', sector: 'การเงิน/ธนาคาร', business: 'ธนาคารพาณิชย์รายใหญ่ของสหรัฐฯ ให้บริการทั้งลูกค้ารายย่อยและองค์กร' },
    V: { name: 'Visa', sector: 'การเงิน/ธนาคาร', business: 'เครือข่ายประมวลผลการชำระเงินด้วยบัตรรายใหญ่ที่สุดของโลก' },
    MA: { name: 'Mastercard', sector: 'การเงิน/ธนาคาร', business: 'เครือข่ายประมวลผลการชำระเงินด้วยบัตร คู่แข่งหลักของ Visa' },
    GS: { name: 'Goldman Sachs', sector: 'การเงิน/ธนาคาร', business: 'วาณิชธนกิจชั้นนำ เน้นธุรกิจซื้อขายหลักทรัพย์และบริหารสินทรัพย์' },
    MS: { name: 'Morgan Stanley', sector: 'การเงิน/ธนาคาร', business: 'วาณิชธนกิจ เน้นธุรกิจบริหารความมั่งคั่งและตลาดทุน' },
    JNJ: { name: 'Johnson & Johnson', sector: 'สุขภาพ', business: 'ยา เวชภัณฑ์ และอุปกรณ์การแพทย์ครบวงจร' },
    UNH: { name: 'UnitedHealth Group', sector: 'สุขภาพ', business: 'บริษัทประกันสุขภาพรายใหญ่ที่สุดของสหรัฐฯ และธุรกิจบริการสุขภาพ Optum' },
    PFE: { name: 'Pfizer', sector: 'สุขภาพ', business: 'บริษัทยาและวัคซีนรายใหญ่ระดับโลก' },
    ABBV: { name: 'AbbVie', sector: 'สุขภาพ', business: 'บริษัทยา เน้นกลุ่มยาภูมิคุ้มกันบำบัดและมะเร็ง' },
    LLY: { name: 'Eli Lilly', sector: 'สุขภาพ', business: 'บริษัทยา เด่นด้านยาเบาหวาน/ลดน้ำหนัก (กลุ่ม GLP-1) เติบโตเร็วในช่วงหลัง' },
    PG: { name: 'Procter & Gamble', sector: 'สินค้าอุปโภคบริโภคจำเป็น', business: 'สินค้าอุปโภคในครัวเรือน (Pampers, Gillette, Tide ฯลฯ) แบรนด์ทั่วโลก' },
    KO: { name: 'Coca-Cola', sector: 'สินค้าอุปโภคบริโภคจำเป็น', business: 'ผู้ผลิตเครื่องดื่มรายใหญ่ระดับโลก เจ้าของแบรนด์ Coca-Cola' },
    PEP: { name: 'PepsiCo', sector: 'สินค้าอุปโภคบริโภคจำเป็น', business: 'ธุรกิจเครื่องดื่ม (Pepsi) และขนมขบเคี้ยว (Lay\'s, Quaker)' },
    WMT: { name: 'Walmart', sector: 'สินค้าอุปโภคบริโภคจำเป็น', business: 'เชนค้าปลีก/ซูเปอร์เซ็นเตอร์รายใหญ่ที่สุดของโลกตามรายได้' },
    COST: { name: 'Costco', sector: 'สินค้าอุปโภคบริโภคจำเป็น', business: 'ธุรกิจค้าปลีกแบบสมาชิก (membership warehouse) ขายส่งราคาถูก' },
    MCD: { name: "McDonald's", sector: 'สินค้าฟุ่มเฟือย/ค้าปลีก', business: 'เชนอาหารจานด่วนแฟรนไชส์รายใหญ่ที่สุดของโลก' },
    NKE: { name: 'Nike', sector: 'สินค้าฟุ่มเฟือย/ค้าปลีก', business: 'แบรนด์รองเท้า/เครื่องแต่งกายกีฬารายใหญ่ที่สุดของโลก' },
    SBUX: { name: 'Starbucks', sector: 'สินค้าฟุ่มเฟือย/ค้าปลีก', business: 'เชนร้านกาแฟรายใหญ่ที่สุดของโลก' },
    HD: { name: 'Home Depot', sector: 'สินค้าฟุ่มเฟือย/ค้าปลีก', business: 'เชนค้าปลีกวัสดุก่อสร้าง/ตกแต่งบ้านรายใหญ่ที่สุดของสหรัฐฯ' },
    DIS: { name: 'Disney', sector: 'สินค้าฟุ่มเฟือย/ค้าปลีก', business: 'ธุรกิจสื่อ/บันเทิง สวนสนุก และสตรีมมิง (Disney+)' },
    NFLX: { name: 'Netflix', sector: 'สินค้าฟุ่มเฟือย/ค้าปลีก', business: 'บริการสตรีมมิงวิดีโอรายใหญ่ที่สุดของโลก' },
    XOM: { name: 'ExxonMobil', sector: 'พลังงาน', business: 'บริษัทน้ำมัน/ก๊าซครบวงจรรายใหญ่ของสหรัฐฯ' },
    CVX: { name: 'Chevron', sector: 'พลังงาน', business: 'บริษัทน้ำมัน/ก๊าซครบวงจรรายใหญ่ของสหรัฐฯ' },
    COP: { name: 'ConocoPhillips', sector: 'พลังงาน', business: 'ธุรกิจสำรวจและผลิตปิโตรเลียม (น้ำมัน/ก๊าซ)' },
    BA: { name: 'Boeing', sector: 'อุตสาหกรรม', business: 'ผู้ผลิตเครื่องบินพาณิชย์และอากาศยานทางทหารรายใหญ่ของโลก' },
    CAT: { name: 'Caterpillar', sector: 'อุตสาหกรรม', business: 'ผู้ผลิตเครื่องจักรก่อสร้าง/เหมืองแร่รายใหญ่ของโลก' },
    GE: { name: 'General Electric', sector: 'อุตสาหกรรม', business: 'กลุ่มอุตสาหกรรม เน้นเครื่องยนต์อากาศยานและพลังงาน' },
    UPS: { name: 'United Parcel Service', sector: 'อุตสาหกรรม', business: 'ธุรกิจขนส่งพัสดุ/โลจิสติกส์รายใหญ่ของโลก' },
    HON: { name: 'Honeywell', sector: 'อุตสาหกรรม', business: 'กลุ่มอุตสาหกรรม ครอบคลุมการบิน อาคารอัตโนมัติ และวัสดุ' }
  };
  var SECTOR_FACTORS = {
    'เทคโนโลยี': ['มูลค่าหุ้นมักตั้งราคาด้วยความคาดหวังการเติบโตสูง อ่อนไหวกับทิศทางดอกเบี้ยสหรัฐฯ (Fed)', 'การแข่งขันด้าน AI/นวัตกรรมเปลี่ยนเร็ว งบวิจัยพัฒนาสูงต่อเนื่อง'],
    'การเงิน/ธนาคาร': ['ผลประกอบการอ่อนไหวกับดอกเบี้ยนโยบาย Fed และคุณภาพสินเชื่อ', 'กฎเกณฑ์กำกับดูแลธนาคารสหรัฐฯ (Fed/FDIC) มีผลโดยตรง'],
    'สุขภาพ': ['ขึ้นกับผลทดลองยา/การอนุมัติจาก FDA และการหมดสิทธิบัตร (patent cliff)', 'นโยบายราคายา/ประกันสุขภาพของรัฐบาลสหรัฐฯ มีผลต่อรายได้'],
    'สินค้าอุปโภคบริโภคจำเป็น': ['อ่อนไหวกับต้นทุนวัตถุดิบและค่าเงินดอลลาร์ (รายได้ส่วนหนึ่งมาจากต่างประเทศ)', 'มักเป็นหุ้นตั้งรับ (defensive) ผันผวนน้อยกว่ากลุ่มเทคโนโลยี'],
    'สินค้าฟุ่มเฟือย/ค้าปลีก': ['ยอดขายอ่อนไหวกับกำลังซื้อผู้บริโภคสหรัฐฯ และฤดูกาลจับจ่าย', 'ต้นทุนแรงงาน/ค่าเช่าและการแข่งขันอีคอมเมิร์ซกดดันมาร์จิ้น'],
    'พลังงาน': ['กำไรผันผวนตามราคาน้ำมัน/ก๊าซในตลาดโลก', 'นโยบายพลังงาน/สิ่งแวดล้อมของสหรัฐฯ มีผลต่อการลงทุนระยะยาว'],
    'อุตสาหกรรม': ['รายได้ผูกกับวัฏจักรเศรษฐกิจโลกและการลงทุนโครงสร้างพื้นฐาน', 'อ่อนไหวกับภาษีนำเข้า/ห่วงโซ่อุปทานระหว่างประเทศ']
  };
  function companyInfoUrl(sym) { return 'https://www.google.com/search?q=' + encodeURIComponent(sym + ' บริษัท ทำธุรกิจอะไร'); }
  function companyInfoHtml(sym) {
    var c = COMPANY_INFO[sym];
    if (!c) {
      return '<div class="company-card"><div class="cname">ไม่มีข้อมูลบริษัทในฐานข้อมูล</div>' +
        '<div class="cbiz">รองรับเฉพาะหุ้นในรายการที่มีข้อมูล — <a href="' + companyInfoUrl(sym) + '" target="_blank" rel="noopener">ค้นหาข้อมูลบริษัท ' + sym + ' เอง ↗</a></div></div>';
    }
    var factors = SECTOR_FACTORS[c.sector] || [];
    var html = '<div class="company-card"><span class="cname">' + c.name + '</span><span class="csector">' + c.sector + '</span>' +
      '<div class="cbiz">' + c.business + '</div>';
    if (factors.length) {
      html += '<ul class="creminders">' + factors.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>';
    }
    html += '</div>';
    return html;
  }

  function fetchPriceScan(sym, startAt) {
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=1y&interval=1d';
    var enc = encodeURIComponent(base);
    var tries = [
      { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' + enc },
      { name: 'corsproxy', url: 'https://corsproxy.io/?url=' + enc },
      { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { name: 'thingproxy', url: 'https://thingproxy.freeboard.io/fetch/' + base },
      { name: 'ตรง', url: base }
    ];
    /* หมุนจุดเริ่มต่างกันต่อหุ้น กันสแกนหลายสิบตัวรัวถล่ม proxy เดียวจนโดน rate-limit พร้อมกันหมด */
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

  function selectUl(sym) {
    $('sym').value = sym; doFetch();
    var lc = $('lightCard'); if (lc && lc.scrollIntoView) setTimeout(function () { lc.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250);
  }
  /* ── ตารางหุ้นดัง (US) ── */
  var ulRows = {};
  function rankOf(l) { return l === 'green' ? 0 : l === 'yellow' ? 1 : l === 'red' ? 2 : 9; }
  function sigIcon(l) {
    var color = l === 'green' ? 'var(--ok)' : l === 'yellow' ? 'var(--amber)' : l === 'red' ? 'var(--err)' : '';
    return color ? '<span class="sig-dot" style="background:' + color + '"></span>' : '·';
  }
  function dataFromSeries(s) {
    if (!s || s.closes.length < 2) return null;
    var last = s.closes[s.closes.length - 1], prev = s.closes[s.closes.length - 2];
    var light = ''; if (s.closes.length >= 20) { try { light = analyzeSeries(s).light; } catch (e) {} }
    return { last: last, chg: last - prev, pct: prev ? (last - prev) / prev * 100 : 0, light: light };
  }
  function fillRow(tr, sym, d) {
    if (!d) {
      tr.innerHTML = '<td class="c-sym">' + sym + '</td><td class="muted">–</td><td class="muted c-chg">–</td><td class="muted">–</td><td class="c-sig muted">กดดู</td>';
      tr.setAttribute('data-rank', 9); tr.setAttribute('data-light', ''); return;
    }
    var cls = d.chg >= 0 ? 'up' : 'dn', sign = d.chg >= 0 ? '+' : '−';
    tr.innerHTML = '<td class="c-sym">' + sym + '</td>' +
      '<td>' + fmt(d.last) + '</td>' +
      '<td class="c-chg ' + cls + '">' + sign + fmt(Math.abs(d.chg)) + '</td>' +
      '<td class="' + cls + '">' + sign + fmt(Math.abs(d.pct), 2) + '%</td>' +
      '<td class="c-sig">' + sigIcon(d.light) + '</td>';
    tr.setAttribute('data-rank', rankOf(d.light)); tr.setAttribute('data-light', d.light || '');
  }
  function renderUlTable() {
    var body = $('ulBody'); if (!body) return;
    body.innerHTML = ''; ulRows = {};
    USLIST.forEach(function (sym) {
      var tr = document.createElement('tr'); tr.setAttribute('data-sym', sym);
      fillRow(tr, sym, dataFromSeries(loadCache(sym)));
      tr.addEventListener('click', function () { selectUl(sym); });
      body.appendChild(tr); ulRows[sym] = tr;
    });
    applyGreenFilter();
  }
  function sortTable() {
    var body = $('ulBody'); if (!body) return;
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
    Object.keys(ulRows).forEach(function (sym) {
      var tr = ulRows[sym]; tr.style.display = (go && tr.getAttribute('data-light') !== 'green') ? 'none' : '';
    });
  }

  var scanning = false;
  function doScan() {
    if (scanning) { scanning = false; return; }
    var idx = 0, ok = 0, green = 0;
    scanning = true; $('scanBtn').textContent = '⏹ หยุด';
    function fin() {
      scanning = false; $('scanBtn').textContent = 'หาหุ้นน่าสนใจ';
      $('scanStatus').textContent = 'สแกนสำเร็จ ' + ok + '/' + USLIST.length + ' ตัว · เจอน่าสนใจ ' + green + ' ตัว (ไม่ใช่คำแนะนำซื้อ)';
      sortTable(); applyGreenFilter();
    }
    function step() {
      if (!scanning || idx >= USLIST.length) { fin(); return; }
      var sym = USLIST[idx++];
      $('scanStatus').textContent = 'กำลังสแกน ' + idx + '/' + USLIST.length + ' (' + sym + ')…';
      var cached = loadCache(sym), fresh = cached && (Date.now() - cached.cachedAt < 6 * 3600 * 1000);
      var pr = fresh ? Promise.resolve(cached) : fetchPriceScan(sym, idx).then(function (s) { saveCache(sym, s); return s; }, function () { return cached || null; });
      pr.then(function (s) {
        var d = dataFromSeries(s);
        if (d) { ok++; if (d.light === 'green') green++; if (ulRows[sym]) fillRow(ulRows[sym], sym, d); }
        if (idx % 5 === 0) { sortTable(); applyGreenFilter(); }
        setTimeout(step, 150);
      });
    }
    step();
  }

  function addHolding() {
    var sym = ($('pfSym').value || '').trim().toUpperCase();
    var shares = num($('pfShares').value), cost = num($('pfCost').value);
    if (!sym) { alert('ใส่ชื่อหุ้นก่อน'); return; }
    if (!isFinite(shares) || shares <= 0 || !isFinite(cost) || cost <= 0) { alert('กรอกจำนวนหุ้นและราคาต้นทุนให้ถูกต้อง'); return; }
    var pf = loadPf(); pf.push({ sym: sym, shares: shares, cost: cost, ts: Date.now() });
    savePf(pf); $('pfSym').value = ''; $('pfShares').value = ''; $('pfCost').value = ''; renderPf();
  }

  /* ── "ควรขายไหม" สำหรับหุ้นที่ถือ ─────────────────────────────── */
  function sellVerdict(a) {
    var det = a.det || {}, ps = det.psar;
    var cls, headline;
    if (ps && !ps.up) { cls = 'no'; headline = 'พิจารณาขาย — สัญญาณเทรนด์กลับตัว (SAR พลิกลง)'; }
    else if (!a.uptrend || (isFinite(det.ema20) && a.price < det.ema20)) { cls = 'no'; headline = 'พิจารณาขาย/ตัดขาดทุน — ราคาหลุดแนวโน้ม (ต่ำกว่าเส้นค่าเฉลี่ย)'; }
    else if (isFinite(a.rsi) && a.rsi > 70) { cls = 'warn'; headline = 'พิจารณาล็อกกำไรบางส่วน — RSI สูง ราคาร้อนแรง อาจย่อ'; }
    else if (isFinite(a.resistance) && a.price >= a.resistance * 0.98) { cls = 'warn'; headline = 'ใกล้แนวต้าน — พิจารณาล็อกกำไรบางส่วน'; }
    else { cls = 'go'; headline = 'ยังอยู่ในแนวโน้มขึ้น — ถือต่อได้ เลื่อนจุดตัดขาดทุนตามแนวด้านล่าง'; }

    /* ราคาหลายระดับตามสถานการณ์ — คำนวณทุกครั้งจากตัวเลขที่ analyzeSeries มีอยู่แล้ว ไม่ขึ้นกับ branch ไหน trigger */
    var levels = [
      {
        key: 'sar', type: 'stop', label: 'แนวตัดขาดทุนตามเทรนด์ (SAR)',
        price: ps ? ps.sar : NaN,
        reason: !ps ? 'ข้อมูลไม่พอคำนวณ (ต้องมีประวัติราคาอย่างน้อย ~3 วัน)'
          : (ps.up ? 'ถ้าราคาปิดหลุดต่ำกว่า ' + fmt(ps.sar) + ' ถือว่าเทรนด์ขาขึ้นเริ่มกลับตัว' : 'ราคาหลุดแนวนี้ไปแล้ว (SAR พลิกลง) — เป็นสัญญาณเตือนที่ชัดที่สุด')
      },
      {
        key: 'stop', type: 'stop', label: 'จุดตัดขาดทุนตามความเสี่ยง (ATR/แนวรับ)',
        price: a.suggestStop,
        reason: !isFinite(a.suggestStop) ? 'ข้อมูลไม่พอคำนวณ'
          : 'กันขาดทุนหนักถ้าราคาหลุดแนวรับหรือผันผวนเกินค่าเฉลี่ย' + (isFinite(det.atr) ? ' (ATR ≈ ' + fmt(det.atr) + ')' : '')
      },
      {
        key: 'ema20', type: 'warn', label: 'เส้นค่าเฉลี่ย 20 วัน (สัญญาณเตือนแรก)',
        price: det.ema20,
        reason: !isFinite(det.ema20) ? 'ข้อมูลไม่พอคำนวณ' : 'หลุดเส้นนี้มักเป็นสัญญาณเริ่มอ่อนตัว — ยังไม่ใช่จุดตัดขาดทุนหลัก แต่ควรเริ่มระวัง'
      },
      {
        key: 'resistance', type: 'tp', label: 'แนวต้าน (จุดพิจารณาล็อกกำไรบางส่วน)',
        price: isFinite(det.resistance) ? det.resistance : a.resistance,
        reason: !isFinite(isFinite(det.resistance) ? det.resistance : a.resistance) ? 'ข้อมูลไม่พอคำนวณ' : 'ราคามักเจอแรงขายทำกำไรบริเวณนี้ พิจารณาขายบางส่วนหรือเลื่อนจุดตัดขาดทุนตามเพื่อป้องกันกำไร'
      }
    ];
    return { cls: cls, headline: headline, levels: levels };
  }
  function sellLevelsHtml(levels) {
    var html = '<ul class="sell-levels">';
    levels.forEach(function (lv) {
      html += '<li><div class="row ' + lv.type + '"><span>' + lv.label + '</span><span class="price">' +
        (isFinite(lv.price) ? fmt(lv.price) : '—') + '</span></div><div class="reason">' + lv.reason + '</div></li>';
    });
    html += '</ul>';
    return html;
  }

  /* ══════ ข่าวล่าสุด (best-effort) — ไม่บล็อกอะไร ถ้าดึงไม่ได้มีลิงก์ค้นเองเสมอ ══════ */
  function newsSearchUrl(sym) {
    return 'https://news.google.com/search?q=' + encodeURIComponent(sym + ' stock') + '&hl=en-US&gl=US&ceid=US:en';
  }
  function parseNewsRss(t) {
    var xml = new DOMParser().parseFromString(t, 'text/xml');
    if (xml.querySelector('parsererror')) throw new Error('parse error');
    var items = [].slice.call(xml.querySelectorAll('item')).slice(0, 5).map(function (it) {
      var title = it.querySelector('title'), link = it.querySelector('link'), pub = it.querySelector('pubDate');
      return { title: title ? title.textContent : '', link: link ? link.textContent : '#', pubDate: pub ? pub.textContent : '' };
    }).filter(function (n) { return n.title; });
    if (!items.length) throw new Error('no items');
    return items;
  }
  function newsDateShort(pubDate) {
    var d = pubDate ? new Date(pubDate) : null;
    return (d && !isNaN(d)) ? d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '';
  }
  function fetchNewsScan(sym) {
    var base = 'https://news.google.com/rss/search?q=' + encodeURIComponent(sym + ' stock OR company') + '&hl=en-US&gl=US&ceid=US:en';
    var enc = encodeURIComponent(base);
    var tries = [
      { url: 'https://api.allorigins.win/raw?url=' + enc },
      { url: 'https://corsproxy.io/?url=' + enc },
      { url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { url: 'https://thingproxy.freeboard.io/fetch/' + base },
      { url: base }
    ];
    var i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('all failed'));
      var t = tries[i++];
      return fetchOne(t.url, 7000, parseNewsRss).catch(function () { return next(); });
    }
    return next();
  }
  function newsCacheKey(sym) { return 'tanot:invest:newscache:us:' + sym; }
  function saveNewsCache(sym, items) { try { localStorage.setItem(newsCacheKey(sym), JSON.stringify({ ts: Date.now(), items: items })); } catch (e) {} }
  function loadNewsCache(sym) { try { var o = JSON.parse(localStorage.getItem(newsCacheKey(sym))); return (o && o.items) ? o : null; } catch (e) { return null; } }
  function fetchNews(sym) {
    var cached = loadNewsCache(sym), fresh = cached && (Date.now() - cached.ts < 8 * 3600 * 1000);
    if (fresh) return Promise.resolve({ items: cached.items, stale: false });
    return fetchNewsScan(sym).then(function (items) {
      saveNewsCache(sym, items); return { items: items, stale: false };
    }, function (e) {
      if (cached) return { items: cached.items, stale: true };
      throw e;
    });
  }
  function renderNewsBlock(el, sym) {
    if (!el) return;
    var link = '<a class="news-search-link" target="_blank" rel="noopener" href="' + newsSearchUrl(sym) + '">ค้นหาข่าวเอง ↗</a>';
    el.innerHTML = 'กำลังค้นข่าว ' + sym + '… ' + link;
    fetchNews(sym).then(function (r) {
      var html = '<ul class="news-list">' + r.items.map(function (n) {
        return '<li><a href="' + n.link + '" target="_blank" rel="noopener">' + n.title + '</a><span class="news-date">' + newsDateShort(n.pubDate) + '</span></li>';
      }).join('') + '</ul>ดูข่าวเพิ่มเติม ' + link;
      el.innerHTML = html;
    }, function () {
      el.innerHTML = 'ดึงข่าวอัตโนมัติไม่ได้ตอนนี้ ' + link;
    });
  }

  /* ══════ สำรองพอร์ต + สมุดเทรดขึ้น Google Drive (ไม่บังคับ) ══════
     ใช้ OAuth client เดียวกับหน้าอื่นในเว็บนี้ (scope drive.file — แตะได้เฉพาะไฟล์ที่แอปนี้สร้างเอง)
     ไฟล์คนละชื่อกับหน้าหุ้นไทย (แต่โฟลเดอร์เดียวกัน) ไม่ปนกัน
     เชื่อมต่อครั้งแรกต้องกดปุ่ม (ข้อจำกัดเบราว์เซอร์ต้องมี user gesture) จากนั้นซิงก์อัตโนมัติเบื้องหลังทุกครั้งที่ข้อมูลเปลี่ยน */
  var DRIVE_CLIENT_ID = '497048581273-akpavakt6m34lhqbjf1irg3m8vl6u27u.apps.googleusercontent.com';
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var DRIVE_FOLDER_NAME = 'OME_Progress';
  var DRIVE_FILE_NAME = 'invest-global-stock-data.json';
  var DRIVE_CONNECTED_KEY = 'tanot:invest:globalstock:driveConnected';
  function nowTime() { return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }

  var DriveSync = {
    tokenClient: null, accessToken: null, folderId: null, fileId: null,
    connected: false, syncing: false, pending: false, timer: null,

    setStatus: function (text, cls) {
      var el = $('driveStatusTxt'); if (!el) return;
      el.textContent = text; el.className = 'status' + (cls ? ' ' + cls : '');
    },
    setBtn: function () {
      var b = $('driveConnectBtn'); if (!b) return;
      b.textContent = this.connected ? 'เชื่อมต่อ Google Drive แล้ว' : 'เชื่อมต่อ Google Drive';
    },
    init: function () {
      try { this.connected = localStorage.getItem(DRIVE_CONNECTED_KEY) === '1'; } catch (e) {}
      this.setBtn();
      var self = this;
      (function wait() {
        if (!window.google || !google.accounts || !google.accounts.oauth2) { setTimeout(wait, 300); return; }
        self.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: DRIVE_CLIENT_ID,
          scope: DRIVE_SCOPE,
          use_fedcm_for_prompt: true, // ลดโอกาสต้องกดยืนยันใหม่ทุกครั้งบนเบราว์เซอร์ที่บล็อก third-party cookie (เช่น Chrome รุ่นใหม่)
          callback: function (resp) {
            if (resp.error) {
              self.setStatus(self.connected ? 'เชื่อมต่ออัตโนมัติไม่สำเร็จ (อาจเพราะเบราว์เซอร์บล็อก cookie ข้ามโดเมน) — กดปุ่มเชื่อมต่ออีกครั้ง' : 'เชื่อมต่อไม่สำเร็จ: ' + resp.error, 'err');
              return;
            }
            self.accessToken = resp.access_token;
            self.connected = true;
            try { localStorage.setItem(DRIVE_CONNECTED_KEY, '1'); } catch (e) {}
            self.setBtn();
            self.firstSync();
          }
        });
        if (self.connected) self.tokenClient.requestAccessToken({ prompt: '' }); /* ลองต่อเงียบๆ ถ้าเคยเชื่อมต่อแล้ว */
      })();
    },
    connect: function () {
      if (!this.tokenClient) { this.setStatus('กำลังโหลด Google Identity Services… รออีก 2-3 วิแล้วลองใหม่', 'err'); return; }
      this.setStatus('กำลังขอสิทธิ์เชื่อมต่อ…', '');
      this.tokenClient.requestAccessToken({ prompt: this.accessToken ? '' : 'consent' });
    },
    authFetch: function (url, opts) {
      opts = opts || {}; opts.headers = opts.headers || {};
      opts.headers.Authorization = 'Bearer ' + this.accessToken;
      return fetch(url, opts);
    },
    ensureFolder: function () {
      var self = this;
      if (self.folderId) return Promise.resolve(self.folderId);
      var q = encodeURIComponent("name='" + DRIVE_FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
      return self.authFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)')
        .then(function (r) { if (!r.ok) throw new Error('ค้นหาโฟลเดอร์ไม่สำเร็จ (' + r.status + ')'); return r.json(); })
        .then(function (data) {
          if (data.files && data.files.length) { self.folderId = data.files[0].id; return self.folderId; }
          return self.authFetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
          }).then(function (r) { if (!r.ok) throw new Error('สร้างโฟลเดอร์ไม่สำเร็จ (' + r.status + ')'); return r.json(); })
            .then(function (d) { self.folderId = d.id; return self.folderId; });
        });
    },
    findFile: function () {
      var self = this;
      if (self.fileId) return Promise.resolve(self.fileId);
      var q = encodeURIComponent("name='" + DRIVE_FILE_NAME + "' and '" + self.folderId + "' in parents and trashed=false");
      return self.authFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)')
        .then(function (r) { if (!r.ok) throw new Error('ค้นหาไฟล์ไม่สำเร็จ (' + r.status + ')'); return r.json(); })
        .then(function (data) { self.fileId = (data.files && data.files[0] && data.files[0].id) || null; return self.fileId; });
    },
    download: function () {
      var self = this;
      return self.authFetch('https://www.googleapis.com/drive/v3/files/' + self.fileId + '?alt=media')
        .then(function (r) { if (!r.ok) throw new Error('ดาวน์โหลดไม่สำเร็จ (' + r.status + ')'); return r.json(); });
    },
    upload: function (obj) {
      var self = this;
      var metadata = self.fileId ? {} : { name: DRIVE_FILE_NAME, parents: [self.folderId] };
      var form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([JSON.stringify(obj)], { type: 'application/json' }));
      var url = self.fileId
        ? 'https://www.googleapis.com/upload/drive/v3/files/' + self.fileId + '?uploadType=multipart'
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
      return self.authFetch(url, { method: self.fileId ? 'PATCH' : 'POST', body: form })
        .then(function (r) { if (!r.ok) throw new Error('บันทึกขึ้น Drive ไม่สำเร็จ (' + r.status + ')'); return r.json(); })
        .then(function (d) { if (d.id) self.fileId = d.id; return d; });
    },
    /* ผสาน portfolio/journal จาก Drive กับเครื่องนี้ โดย ts (เวลาสร้างรายการ) เป็นตัวกันซ้ำ */
    mergeByTs: function (a, b) {
      var map = {};
      (a || []).forEach(function (x) { if (x && x.ts != null) map[x.ts] = x; });
      (b || []).forEach(function (x) { if (x && x.ts != null) map[x.ts] = x; });
      var out = Object.keys(map).map(function (k) { return map[k]; });
      out.sort(function (x, y) { return (x.ts || 0) - (y.ts || 0); });
      return out;
    },
    firstSync: function () {
      var self = this;
      self.setStatus('กำลังซิงก์…', '');
      self.ensureFolder().then(function () { return self.findFile(); })
        .then(function (fid) { return fid ? self.download() : null; })
        .then(function (remote) {
          var mergedPf = self.mergeByTs(remote && remote.portfolio, loadPf());
          var mergedJn = self.mergeByTs(remote && remote.journal, loadJn());
          /* เขียนตรงลง localStorage (ไม่ผ่าน savePf/saveJn) กันเกิดคิวซิงก์ซ้ำซ้อน — ฟังก์ชันนี้อัปโหลดเองด้านล่างอยู่แล้ว */
          try { localStorage.setItem(PF_KEY, JSON.stringify(mergedPf)); } catch (e) {}
          try { localStorage.setItem(JN_KEY, JSON.stringify(mergedJn)); } catch (e) {}
          renderPf(); renderJournal();
          return self.upload({ portfolio: mergedPf, journal: mergedJn, savedAt: new Date().toISOString() });
        })
        .then(function () { self.setStatus('ซิงก์กับ Google Drive แล้ว · ' + nowTime(), 'ok'); })
        .catch(function (e) { self.setStatus('' + (e.message || e), 'err'); });
    },
    scheduleSync: function () {
      var self = this;
      if (!self.connected || !self.accessToken) return;
      self.pending = true;
      if (self.timer) clearTimeout(self.timer);
      self.timer = setTimeout(function () { self.pushNow(); }, 1800);
    },
    pushNow: function () {
      var self = this;
      if (self.syncing) { self.pending = true; return; }
      self.pending = false; self.syncing = true;
      self.setStatus('กำลังซิงก์…', '');
      self.ensureFolder().then(function () { return self.findFile(); })
        .then(function () { return self.upload({ portfolio: loadPf(), journal: loadJn(), savedAt: new Date().toISOString() }); })
        .then(function () { self.setStatus('ซิงก์ล่าสุด ' + nowTime(), 'ok'); })
        .catch(function (e) {
          var msg = String(e && e.message || e);
          if (msg.indexOf('401') !== -1 || msg.indexOf('403') !== -1) {
            self.accessToken = null;
            self.setStatus('เซสชันหมดอายุ — กดปุ่มเชื่อมต่อ Drive อีกครั้ง', 'err');
          } else {
            self.setStatus('ซิงก์ไม่สำเร็จ: ' + msg, 'err');
          }
        })
        .finally(function () {
          self.syncing = false;
          if (self.pending) self.scheduleSync();
        });
    }
  };

  /* ── init ───────────────────────────────────────────────────── */
  function init() {
    $('fetchBtn').addEventListener('click', doFetch);
    $('analyzeBtn').addEventListener('click', doAnalyze);
    $('demoBtn').addEventListener('click', doDemo);
    $('pasteBtn').addEventListener('click', doPaste);
    $('calcBtn').addEventListener('click', doCalc);
    $('sym').addEventListener('keydown', function (e) { if (e.key === 'Enter') doFetch(); });
    ['price', 'hi', 'lo'].forEach(function (id) { $(id).addEventListener('input', function () { lastSeries = null; if (id === 'price') updatePriceFx(); }); });

    $('tfGroup').addEventListener('click', function (e) { var b = e.target.closest('.tf'); if (b) applyTF(+b.getAttribute('data-tf')); });
    $('tgGroup').addEventListener('click', function (e) { var b = e.target.closest('.tg'); if (!b) return; var k = b.getAttribute('data-tg'); tg[k] = !tg[k]; applyToggles(); });

    $('saveBtn').addEventListener('click', function () {
      var d = $('saveBtn')._data; if (!d) return;
      var pf = loadPf(); pf.push({ sym: d.sym, shares: d.shares, cost: d.cost, ts: Date.now() });
      savePf(pf); renderPf();
      $('saveBtn').textContent = 'บันทึกแล้ว';
      setTimeout(function () { $('saveBtn').innerHTML = 'บันทึกเข้าพอร์ต'; }, 1500);
    });
    $('checkBtn').addEventListener('click', doChecklist);
    $('eBtn').addEventListener('click', doExpectancy);
    $('jAdd').addEventListener('click', addJournal);
    $('scanBtn').addEventListener('click', doScan);
    $('greenOnly').addEventListener('change', applyGreenFilter);
    $('pfAdd').addEventListener('click', addHolding);
    $('driveConnectBtn') && $('driveConnectBtn').addEventListener('click', function () { DriveSync.connect(); });

    /* ตัวแปลงสกุลเงิน */
    var fxCached = loadFxCache();
    if (fxCached) { fxRate = fxCached.rate; if ($('fxRate')) $('fxRate').value = fxCached.rate.toFixed(2); }
    $('fxFetchBtn').addEventListener('click', doFxFetch);
    $('fxRate').addEventListener('input', function () { fxRate = num($('fxRate').value); updatePriceFx(); if ($('riskResult').classList.contains('show')) doCalc(); renderPf(); });
    $('fxShowChk').addEventListener('change', function () { updatePriceFx(); if ($('riskResult').classList.contains('show')) doCalc(); renderPf(); });

    renderUlTable();
    renderPf();
    renderJournal();
    DriveSync.init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__globalstock = { sma: sma, emaLast: emaLast, rsi: rsi, rsiSeries: rsiSeries, smaSeries: smaSeries, macd: macd, bollinger: bollinger, atr: atr, analyzeSeries: analyzeSeries, analyzeSimple: analyzeSimple, riskCalc: riskCalc, demoData: demoData, parsePaste: parsePaste, parseYahoo: parseYahoo, checklistChecks: checklistChecks, adx: adx, psar: psar, sellVerdict: sellVerdict, companyInfoHtml: companyInfoHtml, newsSearchUrl: newsSearchUrl, parseNewsRss: parseNewsRss };
})();
