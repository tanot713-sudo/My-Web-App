/* ══════════════════════════════════════════════════════════════════
   ห้ามแก้ไฟล์นี้ — สำเนา "ฟังก์ชันล้วน" ของหน้าลงทุนเดิม ณ commit 330c178 (ก่อนยุบรวมหน้า) ตรงตัวทุกบรรทัด
   ใช้เทียบผลกับ invest-calc.js ใน tests/invest.spec.js (แบบเดียวกับ fsrs-original.js)
   สร้างโดยตัดฟังก์ชันจากไฟล์เดิมตามชื่อ ไม่มีการแก้เนื้อหา · มีแค่ตัวแปรแวดล้อมจำลอง (t คืนชื่อคีย์ข้อความ, $ อ่านจากตาราง inputs)
   ══════════════════════════════════════════════════════════════════ */
'use strict';
function T(k) { return k; }
function numF(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
function fmtF(n, d) { return String(n); }

  /* ── th ── */
  function make_th() {
    
    var t = T, num = numF, fmt = fmtF;
    var INPUTS = {}, lastAnalysis = null, gAnswers = {}, btcAnswers = {}, cAnswers = {};
    var $ = function (id) { return { value: INPUTS[id] === undefined ? '' : String(INPUTS[id]) }; };
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
    if (posRange < 0.35) { score += 1; pros.push(t('whyCheap')); }
    else if (posRange > 0.75) { score -= 1; cons.push(t('whyExpensive')); }
    if (isFinite(r)) {
      if (r < 38) { score += 1; pros.push(t('whySellEase')); }
      else if (r > 70) { score -= 1; cons.push(t('whyHot')); }
    }
    if (momUp) { score += 1; pros.push(t('whyMomUp')); }
    else if (momDn) { score -= 1; cons.push(t('whyMomDn')); }
    if (uptrend) { score += 1; pros.push(t('whyUptrend')); }
    else { score -= 1; cons.push(t('whyDowntrend')); }
    if (posBB < 0.2) { score += 0.5; pros.push(t('whyLowerBand')); }
    else if (posBB > 0.9) { score -= 0.5; cons.push(t('whyUpperBand')); }

    var light, verdict;
    if (score >= 2) { light = 'green'; verdict = t('vGood'); }
    else if (score <= -1) { light = 'red'; verdict = t('vBad'); }
    else { light = 'yellow'; verdict = t('vWait'); }
    var why = (light === 'green' ? pros : light === 'red' ? cons : (pros.concat(cons)))[0] || t('whyMidRange');

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
    if (pos < 0.35) { light = 'green'; verdict = t('vGood'); why = t('whyCheapPct', { pct: pct }); }
    else if (pos > 0.75) { light = 'red'; verdict = t('vExpensive'); why = t('whyExpensivePct', { pct: pct }); }
    else { light = 'yellow'; verdict = t('vMid'); why = t('whyMidPct', { pct: pct }); }
    return { light: light, verdict: verdict, why: why, pros: [], cons: [], price: price, suggestStop: Math.min(lo, price * 0.95), resistance: hi, det: { posRange: pos, support: lo, resistance: hi }, simple: true };
  }
  function riskCalc(o) {
    var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop, comm = o.comm / 100;
    var commMin = isFinite(o.commMin) && o.commMin >= 0 ? o.commMin : 50;
    var perShare = entry - stop;
    if (!(perShare > 0)) return { error: t('stopMustBeLower') };
    var riskBudget = capital * riskPct / 100;
    var shares = Math.floor(riskBudget / perShare / 100) * 100, note = '';
    if (shares < 100) { shares = 100; note = t('minLotNote', { pct: riskPct }); }
    var cost = shares * entry;
    if (cost > capital) {
      var maxLots = Math.floor(capital / entry / 100) * 100;
      if (maxLots >= 100) { shares = maxLots; cost = shares * entry; note = t('capitalLimitNote'); }
    }
    var R = perShare;
    /* ค่าคอมฯ ต่อขา = max(มูลค่า × %, ขั้นต่ำ/วัน) — โบรกไทยส่วนใหญ่คิดขั้นต่ำ ~50 บาท/วัน
       ไม้เล็กที่ค่าคอมฯ ตามเปอร์เซ็นต์ยังไม่ถึงขั้นต่ำ จะโดนเก็บที่ขั้นต่ำแทน ทำให้ค่าคอมฯ จริงแพงกว่าอัตราปกติมาก
       ประมาณขาขายจากมูลค่าซื้อ (ราคาปิดไม้จริงต่างออกไปได้เล็กน้อย) */
    var buyComm = Math.max(cost * comm, commMin), sellComm = Math.max(cost * comm, commMin), totalComm = buyComm + sellComm;
    var breakeven = shares > 0 ? entry + totalComm / shares : entry;
    var commPct = cost > 0 ? totalComm / cost * 100 : 0, minKicksIn = cost * comm < commMin;
    var rr = isFinite(o.resistance) && o.resistance > entry ? (o.resistance - entry) / R : NaN;
    return { shares: shares, lots: shares / 100, cost: cost, riskBaht: shares * perShare, tp1: entry + R, tp2: entry + 2 * R, tp3: entry + 3 * R, breakeven: breakeven, commBaht: totalComm, commPct: commPct, minKicksIn: minKicksIn, rr: rr, riskBudget: riskBudget, note: note };
  }
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
      vol.push({ time: times[i], value: (volumes && volumes[i]) ? volumes[i] : 0, up: closes[i] >= opens[i] });
    }
    return { times: times, closes: closes, highs: highs, lows: lows, ohlc: ohlc, vol: vol,
      ma20: align(smaSeries(closes, 20)), ma50: align(smaSeries(closes, 50)), rsi: align(rsiSeries(closes, 14)) };
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
  function sellVerdict(a) {
    var det = a.det || {}, ps = det.psar;
    var cls, headline;
    if (ps && !ps.up) { cls = 'err'; headline = t('sellSarDn'); }
    else if (!a.uptrend || (isFinite(det.ema20) && a.price < det.ema20)) { cls = 'err'; headline = t('sellBelowTrend'); }
    else if (isFinite(a.rsi) && a.rsi > 70) { cls = 'warn'; headline = t('sellHotRsi'); }
    else if (isFinite(a.resistance) && a.price >= a.resistance * 0.98) { cls = 'warn'; headline = t('sellNearResist'); }
    else { cls = 'ok'; headline = t('sellHold'); }

    var levels = [
      { key: 'sar', type: 'stop', label: t('sarLabel'), price: ps ? ps.sar : NaN,
        reason: !ps ? t('sarNoData') : (ps.up ? t('sarUpReason', { price: fmt(ps.sar) }) : t('sarDnReason')) },
      { key: 'stop', type: 'stop', label: t('stopRiskLabel'), price: a.suggestStop,
        reason: !isFinite(a.suggestStop) ? t('noData') : t('stopRiskReason', { atr: isFinite(det.atr) ? t('atrSuffix', { atr: fmt(det.atr) }) : '' }) },
      { key: 'ema20', type: 'warn', label: t('ema20Label'), price: det.ema20,
        reason: !isFinite(det.ema20) ? t('noData') : t('ema20Reason') },
      { key: 'resistance', type: 'tp', label: t('resistLabel'), price: isFinite(det.resistance) ? det.resistance : a.resistance,
        reason: !isFinite(isFinite(det.resistance) ? det.resistance : a.resistance) ? t('noData') : t('resistReason') }
    ];
    return { cls: cls, headline: headline, levels: levels };
  }
  function checklistChecks() {
    var a = lastAnalysis, det = (a && a.det) ? a.det : {};
    var entry = num($('entry').value), stop = num($('stop').value), riskPct = num($('riskPct').value);
    var checks = [];
    if (a && isFinite(det.ema20)) {
      var up = isFinite(det.ema50) ? a.price >= det.ema50 : a.price >= det.ema20;
      var adxTxt = isFinite(det.adx) ? (det.adx >= 20 ? t('adxStrongTxt', { adx: det.adx.toFixed(0) }) : t('adxWeakTxt', { adx: det.adx.toFixed(0) })) : '';
      checks.push({ ok: up, txt: (up ? t('trendUpAdx') : t('trendNotUpAdx')) + adxTxt });
      var over = (a.price - det.ema20) / det.ema20, notChase = over <= 0.05;
      checks.push({ ok: notChase, txt: notChase ? t('notChasing') : t('chasing') });
    } else {
      checks.push({ ok: null, txt: t('needChartFirst') });
    }
    if (a && isFinite(det.rsi)) checks.push({ ok: det.rsi < 70, txt: det.rsi < 70 ? t('rsiOk', { rsi: det.rsi.toFixed(0) }) : t('rsiHot', { rsi: det.rsi.toFixed(0) }) });
    else checks.push({ ok: null, txt: t('rsiNeedChart') });
    var stopOk = isFinite(entry) && isFinite(stop) && stop < entry;
    checks.push({ ok: stopOk, txt: stopOk ? t('stopSetOk') : t('stopNotSet') });
    checks.push({ ok: isFinite(riskPct) && riskPct <= 2, txt: (isFinite(riskPct) && riskPct <= 2) ? t('riskOk', { pct: riskPct }) : t('riskHigh', { pct: isFinite(riskPct) ? riskPct + '%' : '-' }) });
    if (a && isFinite(a.resistance) && stopOk && a.resistance > entry) {
      var rr = (a.resistance - entry) / (entry - stop), rrOk = rr >= 2;
      checks.push({ ok: rrOk, txt: rrOk ? t('rrOk', { rr: rr.toFixed(1) }) : t('rrLow', { rr: rr.toFixed(1) }) });
    } else {
      checks.push({ ok: null, txt: t('rrNeedInfo') });
    }
    return checks;
  }
    function __set(a, inputs, answer) { lastAnalysis = a; INPUTS = inputs || {}; gAnswers.spotOnly = answer; btcAnswers.noLeverage = answer; cAnswers.noLeverage = answer; }
    return { sma, smaSeries, emaSeries, emaLast, rsi, rsiSeries, macd, bollinger, atr, supRes, adx, psar, analyzeSeries, analyzeSimple, riskCalc, daysAgoDates, toSeries, parsePaste, parseYahoo, sellVerdict, checklistChecks, __set };
  }

  /* ── us ── */
  function make_us() {
    
    var t = T, num = numF, fmt = fmtF;
    var INPUTS = {}, lastAnalysis = null, gAnswers = {}, btcAnswers = {}, cAnswers = {};
    var $ = function (id) { return { value: INPUTS[id] === undefined ? '' : String(INPUTS[id]) }; };
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
    if (posRange < 0.35) { score += 1; pros.push(t('whyCheapRange')); }
    else if (posRange > 0.75) { score -= 1; cons.push(t('whyExpensiveRange')); }
    if (isFinite(r)) {
      if (r < 38) { score += 1; pros.push(t('whyRsiLow')); }
      else if (r > 70) { score -= 1; cons.push(t('whyRsiHigh')); }
    }
    if (momUp) { score += 1; pros.push(t('whyMomUp')); }
    else if (momDn) { score -= 1; cons.push(t('whyMomDn')); }
    if (uptrend) { score += 1; pros.push(t('whyUptrend')); }
    else { score -= 1; cons.push(t('whyDowntrend')); }
    if (posBB < 0.2) { score += 0.5; pros.push(t('whyBbLow')); }
    else if (posBB > 0.9) { score -= 0.5; cons.push(t('whyBbHigh')); }

    var light, verdict;
    if (score >= 2) { light = 'green'; verdict = t('vInteresting'); }
    else if (score <= -1) { light = 'red'; verdict = t('vCareful'); }
    else { light = 'yellow'; verdict = t('vWait'); }
    var why = (light === 'green' ? pros : light === 'red' ? cons : (pros.concat(cons)))[0] || t('whyNeutral');

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
    if (pos < 0.35) { light = 'green'; verdict = t('vInteresting'); why = t('whyCheapPct', { pct: pct }); }
    else if (pos > 0.75) { light = 'red'; verdict = t('vExpensive'); why = t('whyExpensivePct', { pct: pct }); }
    else { light = 'yellow'; verdict = t('vMid'); why = t('whyMidPct', { pct: pct }); }
    return { light: light, verdict: verdict, why: why, pros: [], cons: [], price: price, suggestStop: Math.min(lo, price * 0.95), resistance: hi, det: { posRange: pos, support: lo, resistance: hi }, simple: true };
  }
  function riskCalc(o) {
    var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop, comm = o.comm / 100;
    var perShare = entry - stop;
    if (!(perShare > 0)) return { error: t('stopMustBeLower') };
    var riskBudget = capital * riskPct / 100;
    var shares = Math.floor(riskBudget / perShare), note = '';
    if (shares < 1) { shares = 1; note = t('minShareNote', { riskPct: riskPct }); }
    var cost = shares * entry;
    if (cost > capital) {
      var maxShares = Math.floor(capital / entry);
      if (maxShares >= 1) { shares = maxShares; cost = shares * entry; note = t('capitalLimitNote'); }
    }
    var R = perShare, breakeven = entry * (1 + comm) / (1 - comm);
    var rr = isFinite(o.resistance) && o.resistance > entry ? (o.resistance - entry) / R : NaN;
    return { shares: shares, cost: cost, riskUsd: shares * perShare, tp1: entry + R, tp2: entry + 2 * R, tp3: entry + 3 * R, breakeven: breakeven, rr: rr, riskBudget: riskBudget, note: note };
  }
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
      vol.push({ time: times[i], value: (volumes && volumes[i]) ? volumes[i] : 0, up: closes[i] >= opens[i] });
    }
    return { times: times, closes: closes, highs: highs, lows: lows, ohlc: ohlc, vol: vol,
      ma20: align(smaSeries(closes, 20)), ma50: align(smaSeries(closes, 50)), rsi: align(rsiSeries(closes, 14)) };
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
  function sellVerdict(a) {
    var det = a.det || {}, ps = det.psar;
    var cls, headline;
    if (ps && !ps.up) { cls = 'err'; headline = t('sellSarDn'); }
    else if (!a.uptrend || (isFinite(det.ema20) && a.price < det.ema20)) { cls = 'err'; headline = t('sellBelowTrend'); }
    else if (isFinite(a.rsi) && a.rsi > 70) { cls = 'warn'; headline = t('sellHotRsi'); }
    else if (isFinite(a.resistance) && a.price >= a.resistance * 0.98) { cls = 'warn'; headline = t('sellNearResist'); }
    else { cls = 'ok'; headline = t('sellHold'); }

    /* ราคาหลายระดับตามสถานการณ์ — คำนวณทุกครั้งจากตัวเลขที่ analyzeSeries มีอยู่แล้ว ไม่ขึ้นกับ branch ไหน trigger */
    var levels = [
      {
        key: 'sar', type: 'stop', label: t('sarLabel'),
        price: ps ? ps.sar : NaN,
        reason: !ps ? t('sarNoData')
          : (ps.up ? t('sarUpReason', { sar: fmt(ps.sar) }) : t('sarDnReason'))
      },
      {
        key: 'stop', type: 'stop', label: t('stopRiskLabel'),
        price: a.suggestStop,
        reason: !isFinite(a.suggestStop) ? t('noData')
          : t('stopRiskReason', { atr: isFinite(det.atr) ? t('atrSuffix', { atr: fmt(det.atr) }) : '' })
      },
      {
        key: 'ema20', type: 'warn', label: t('ema20Label'),
        price: det.ema20,
        reason: !isFinite(det.ema20) ? t('noData') : t('ema20Reason')
      },
      {
        key: 'resistance', type: 'tp', label: t('resistLabel'),
        price: isFinite(det.resistance) ? det.resistance : a.resistance,
        reason: !isFinite(isFinite(det.resistance) ? det.resistance : a.resistance) ? t('noData') : t('resistReason')
      }
    ];
    return { cls: cls, headline: headline, levels: levels };
  }
  function checklistChecks() {
    var a = lastAnalysis, det = (a && a.det) ? a.det : {};
    var entry = num($('entry').value), stop = num($('stop').value), riskPct = num($('riskPct').value);
    var checks = [];
    if (a && isFinite(det.ema20)) {
      var up = isFinite(det.ema50) ? a.price >= det.ema50 : a.price >= det.ema20;
      var adxTxt = isFinite(det.adx) ? (det.adx >= 20 ? t('chkAdxStrong', { adx: det.adx.toFixed(0) }) : t('chkAdxWeak', { adx: det.adx.toFixed(0) })) : '';
      checks.push({ ok: up, txt: (up ? t('chkTrendUp') : t('chkTrendDn')) + adxTxt });
      var over = (a.price - det.ema20) / det.ema20, notChase = over <= 0.05;
      checks.push({ ok: notChase, txt: notChase ? t('chkNoChase') : t('chkChasing') });
    } else {
      checks.push({ ok: null, txt: t('chkTrendUnknown') });
    }
    if (a && isFinite(det.rsi)) checks.push({ ok: det.rsi < 70, txt: det.rsi < 70 ? t('chkRsiOk', { rsi: det.rsi.toFixed(0) }) : t('chkRsiHot', { rsi: det.rsi.toFixed(0) }) });
    else checks.push({ ok: null, txt: t('chkRsiUnknown') });
    var stopOk = isFinite(entry) && isFinite(stop) && stop < entry;
    checks.push({ ok: stopOk, txt: stopOk ? t('chkStopSet') : t('chkStopUnset') });
    checks.push({ ok: isFinite(riskPct) && riskPct <= 2, txt: (isFinite(riskPct) && riskPct <= 2) ? t('chkRiskOk', { riskPct: riskPct }) : t('chkRiskHigh', { riskPct: isFinite(riskPct) ? riskPct + '%' : '-' }) });
    if (a && isFinite(a.resistance) && stopOk && a.resistance > entry) {
      var rr = (a.resistance - entry) / (entry - stop), rrOk = rr >= 2;
      checks.push({ ok: rrOk, txt: rrOk ? t('chkRrOk', { rr: rr.toFixed(1) }) : t('chkRrLow', { rr: rr.toFixed(1) }) });
    } else {
      checks.push({ ok: null, txt: t('chkRrUnknown') });
    }
    return checks;
  }
    function __set(a, inputs, answer) { lastAnalysis = a; INPUTS = inputs || {}; gAnswers.spotOnly = answer; btcAnswers.noLeverage = answer; cAnswers.noLeverage = answer; }
    return { sma, smaSeries, emaSeries, emaLast, rsi, rsiSeries, macd, bollinger, atr, supRes, adx, psar, analyzeSeries, analyzeSimple, riskCalc, daysAgoDates, toSeries, parsePaste, parseYahoo, sellVerdict, checklistChecks, __set };
  }

  /* ── btc ── */
  function make_btc() {
    
    var t = T, num = numF, fmt = fmtF;
    var INPUTS = {}, lastAnalysis = null, gAnswers = {}, btcAnswers = {}, cAnswers = {};
    var $ = function (id) { return { value: INPUTS[id] === undefined ? '' : String(INPUTS[id]) }; };
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
    if (posRange < 0.35) { score += 1; pros.push(t('proCheapRange')); }
    else if (posRange > 0.75) { score -= 1; cons.push(t('conExpRange')); }
    if (isFinite(r)) {
      if (r < 38) { score += 1; pros.push(t('proRsiLow')); }
      else if (r > 70) { score -= 1; cons.push(t('conRsiHigh')); }
    }
    if (momUp) { score += 1; pros.push(t('proMomUp')); }
    else if (momDn) { score -= 1; cons.push(t('conMomDn')); }
    if (uptrend) { score += 1; pros.push(t('proUptrend')); }
    else { score -= 1; cons.push(t('conDowntrend')); }
    if (posBB < 0.2) { score += 0.5; pros.push(t('proBbLow')); }
    else if (posBB > 0.9) { score -= 0.5; cons.push(t('conBbHigh')); }

    var light, verdict;
    if (score >= 2) { light = 'green'; verdict = t('verdictGreen'); }
    else if (score <= -1) { light = 'red'; verdict = t('verdictRed'); }
    else { light = 'yellow'; verdict = t('verdictYellow'); }
    var why = (light === 'green' ? pros : light === 'red' ? cons : (pros.concat(cons)))[0] || t('whyNeutral');

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
    if (pos < 0.35) { light = 'green'; verdict = t('simpleGreen'); why = t('simpleWhyCheap', { pct: pct }); }
    else if (pos > 0.75) { light = 'red'; verdict = t('simpleRed'); why = t('simpleWhyExp', { pct: pct }); }
    else { light = 'yellow'; verdict = t('simpleYellow'); why = t('simpleWhyMid', { pct: pct }); }
    return { light: light, verdict: verdict, why: why, pros: [], cons: [], price: price, suggestStop: Math.min(lo, price * 0.95), resistance: hi, det: { posRange: pos, support: lo, resistance: hi }, simple: true };
  }
  function riskCalc(o) {
    var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop, comm = o.comm / 100;
    var perUnit = entry - stop;
    if (!(perUnit > 0)) return { error: t('riskErrStop') };
    var riskBudget = capital * riskPct / 100;
    var qty = riskBudget / perUnit, note = ''; /* ไม่ floor — ซื้อ BTC เป็นเศษส่วนได้ */
    var cost = qty * entry;
    if (cost > capital) {
      var maxQty = capital / entry;
      if (maxQty > 0) { qty = maxQty; cost = qty * entry; note = t('riskCapLimitedNote'); }
    }
    var R = perUnit, breakeven = entry * (1 + comm) / (1 - comm);
    var rr = isFinite(o.resistance) && o.resistance > entry ? (o.resistance - entry) / R : NaN;
    return { qty: qty, cost: cost, riskUsd: qty * perUnit, tp1: entry + R, tp2: entry + 2 * R, tp3: entry + 3 * R, breakeven: breakeven, rr: rr, riskBudget: riskBudget, note: note };
  }
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
      vol.push({ time: times[i], value: (volumes && volumes[i]) ? volumes[i] : 0, up: closes[i] >= opens[i] });
    }
    return { times: times, closes: closes, highs: highs, lows: lows, ohlc: ohlc, vol: vol,
      ma20: align(smaSeries(closes, 20)), ma50: align(smaSeries(closes, 50)), rsi: align(rsiSeries(closes, 14)) };
  }
  function parsePaste(text) {
    var nums = (text.match(/-?\d+(\.\d+)?/g) || []).map(Number).filter(function (x) { return isFinite(x) && x > 0; });
    if (nums.length < 5) return null;
    var opens = [], highs = [], lows = [], vols = [], i;
    for (i = 0; i < nums.length; i++) {
      var open = i === 0 ? nums[0] : nums[i - 1];
      opens.push(open); highs.push(Math.max(open, nums[i]) * 1.008); lows.push(Math.min(open, nums[i]) * 0.992); vols.push(0);
    }
    return toSeries(daysAgoDates(nums.length), opens, highs, lows, nums, vols);
  }
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
  function sellVerdict(a) {
    var det = a.det || {}, ps = det.psar;
    var cls, headline;
    if (ps && !ps.up) { cls = 'err'; headline = t('sellVerdictSar'); }
    else if (!a.uptrend || (isFinite(det.ema20) && a.price < det.ema20)) { cls = 'err'; headline = t('sellVerdictTrend'); }
    else if (isFinite(a.rsi) && a.rsi > 70) { cls = 'warn'; headline = t('sellVerdictRsi'); }
    else if (isFinite(a.resistance) && a.price >= a.resistance * 0.98) { cls = 'warn'; headline = t('sellVerdictResist'); }
    else { cls = 'ok'; headline = t('sellVerdictGo'); }

    var levels = [
      {
        key: 'sar', type: 'stop', label: t('lvSarLabel'),
        price: ps ? ps.sar : NaN,
        reason: !ps ? t('lvSarReasonNoData')
          : (ps.up ? t('lvSarReasonUp', { v: fmt(ps.sar) }) : t('lvSarReasonDown'))
      },
      {
        key: 'stop', type: 'stop', label: t('lvStopLabel'),
        price: a.suggestStop,
        reason: !isFinite(a.suggestStop) ? t('lvStopReasonNoData')
          : t('lvStopReason') + (isFinite(det.atr) ? t('lvStopAtrSuffix', { v: fmt(det.atr) }) : '')
      },
      {
        key: 'ema20', type: 'warn', label: t('lvEma20Label'),
        price: det.ema20,
        reason: !isFinite(det.ema20) ? t('lvEma20ReasonNoData') : t('lvEma20Reason')
      },
      {
        key: 'resistance', type: 'tp', label: t('lvResistLabel'),
        price: isFinite(det.resistance) ? det.resistance : a.resistance,
        reason: !isFinite(isFinite(det.resistance) ? det.resistance : a.resistance) ? t('lvResistReasonNoData') : t('lvResistReason')
      }
    ];
    return { cls: cls, headline: headline, levels: levels };
  }
  function checklistChecks() {
    var a = lastAnalysis, det = (a && a.det) ? a.det : {};
    var entry = num($('entry').value), stop = num($('stop').value), riskPct = num($('riskPct').value);
    var checks = [];
    if (a && isFinite(det.ema20)) {
      var up = isFinite(det.ema50) ? a.price >= det.ema50 : a.price >= det.ema20;
      var adxTxt = isFinite(det.adx) ? t('chkAdxSuffix', { v: det.adx.toFixed(0), label: det.adx >= 20 ? t('chkAdxStrong') : t('chkAdxWeak') }) : '';
      checks.push({ ok: up, txt: (up ? t('chkTrendUp') : t('chkTrendDn')) + adxTxt });
      var over = (a.price - det.ema20) / det.ema20, notChase = over <= 0.05;
      checks.push({ ok: notChase, txt: notChase ? t('chkNoChase') : t('chkChasing') });
    } else {
      checks.push({ ok: null, txt: t('chkTrendNeedData') });
    }
    if (a && isFinite(det.rsi)) checks.push({ ok: det.rsi < 70, txt: det.rsi < 70 ? t('chkRsiOk', { v: det.rsi.toFixed(0) }) : t('chkRsiHot', { v: det.rsi.toFixed(0) }) });
    else checks.push({ ok: null, txt: t('chkRsiNeedData') });
    var stopOk = isFinite(entry) && isFinite(stop) && stop < entry;
    checks.push({ ok: stopOk, txt: stopOk ? t('chkStopSet') : t('chkStopUnset') });
    checks.push({
      ok: isFinite(riskPct) && riskPct <= 1,
      txt: (isFinite(riskPct) && riskPct <= 1)
        ? t('chkRiskOk', { v: riskPct })
        : t('chkRiskHigh', { v: isFinite(riskPct) ? riskPct + '%' : '-' })
    });
    if (a && isFinite(a.resistance) && stopOk && a.resistance > entry) {
      var rr = (a.resistance - entry) / (entry - stop), rrOk = rr >= 2;
      checks.push({ ok: rrOk, txt: rrOk ? t('chkRrOk', { v: rr.toFixed(1) }) : t('chkRrLow', { v: rr.toFixed(1) }) });
    } else {
      checks.push({ ok: null, txt: t('chkRrNeedData') });
    }
    var lv = btcAnswers.noLeverage;
    checks.push({
      ok: lv === 'yes' ? true : lv === 'no' ? false : null,
      txt: lv === 'yes' ? t('chkLeverageYes')
        : lv === 'no' ? t('chkLeverageNo')
        : t('chkLeverageUnknown')
    });
    return checks;
  }
  function simulateBtcDCA(pmt, startPrice, annualPct, months) {
    var rm = annualPct / 100 / 12, price = startPrice, qty = 0, contrib = 0, series = [];
    for (var i = 0; i < months; i++) {
      price = price * (1 + rm);
      var q = pmt / price;
      qty += q; contrib += pmt;
      series.push({ month: i + 1, price: price, qty: qty, value: qty * price, contrib: contrib });
    }
    return { qty: qty, price: price, value: qty * price, contrib: contrib, series: series };
  }
  function parseFxRate(t) {
    var j = JSON.parse(t), res = j && j.chart && j.chart.result && j.chart.result[0];
    var meta = res && res.meta, q = res && res.indicators && res.indicators.quote && res.indicators.quote[0];
    var rate = meta && isFinite(meta.regularMarketPrice) ? meta.regularMarketPrice : null;
    if (!rate && q && q.close) { for (var i = q.close.length - 1; i >= 0; i--) { if (q.close[i] != null) { rate = q.close[i]; break; } } }
    if (!isFinite(rate) || rate <= 0) throw new Error('no rate');
    return rate;
  }
  function parseFng(txt) {
    var j = JSON.parse(txt), d = j && j.data && j.data[0];
    if (!d || !isFinite(parseInt(d.value, 10))) throw new Error('no data');
    return { value: parseInt(d.value, 10), classification: d.value_classification, ts: d.timestamp };
  }
    function __set(a, inputs, answer) { lastAnalysis = a; INPUTS = inputs || {}; gAnswers.spotOnly = answer; btcAnswers.noLeverage = answer; cAnswers.noLeverage = answer; }
    return { sma, smaSeries, emaSeries, emaLast, rsi, rsiSeries, macd, bollinger, atr, supRes, adx, psar, analyzeSeries, analyzeSimple, riskCalc, daysAgoDates, toSeries, parsePaste, parseYahoo, sellVerdict, checklistChecks, simulateBtcDCA, parseFxRate, parseFng, __set };
  }

  /* ── gold ── */
  function make_gold() {
    
    var t = T, num = numF, fmt = fmtF;
    var INPUTS = {}, lastAnalysis = null, gAnswers = {}, btcAnswers = {}, cAnswers = {};
    var $ = function (id) { return { value: INPUTS[id] === undefined ? '' : String(INPUTS[id]) }; };
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
  function analyzeSeries(s) {
    var c = s.closes, price = c[c.length - 1];
    var ema20 = emaLast(c, 20), ema50 = emaLast(c, 50), r = rsi(c, 14);
    var mac = macd(c), bb = bollinger(c, 20, 2), at = atr(s.highs, s.lows, c, 14);
    var sr = supRes(s.highs, s.lows, 20);
    var adxV = adx(s.highs, s.lows, c, 14);
    var range = { hi: Math.max.apply(null, c), lo: Math.min.apply(null, c) };
    var posRange = (price - range.lo) / Math.max(1e-9, range.hi - range.lo);
    var posBB = bb ? (price - bb.lower) / Math.max(1e-9, bb.upper - bb.lower) : 0.5;
    var uptrend = isFinite(ema50) ? price >= ema50 : (isFinite(ema20) ? price >= ema20 : true);
    var momUp = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist > mac.histPrev : false;
    var momDn = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist < mac.histPrev : false;

    var score = 0, pros = [], cons = [];
    if (posRange < 0.35) { score += 1; pros.push(t('whyCheapRange')); }
    else if (posRange > 0.75) { score -= 1; cons.push(t('whyExpensiveRange')); }
    if (isFinite(r)) {
      if (r < 38) { score += 1; pros.push(t('whyRsiLow')); }
      else if (r > 70) { score -= 1; cons.push(t('whyRsiHigh')); }
    }
    if (momUp) { score += 1; pros.push(t('whyMomUp')); }
    else if (momDn) { score -= 1; cons.push(t('whyMomDn')); }
    if (uptrend) { score += 1; pros.push(t('whyUptrend')); }
    else { score -= 1; cons.push(t('whyDowntrend')); }
    if (posBB < 0.2) { score += 0.5; pros.push(t('whyBbLow')); }
    else if (posBB > 0.9) { score -= 0.5; cons.push(t('whyBbHigh')); }

    var light, verdict;
    if (score >= 2) { light = 'green'; verdict = t('vInterestingGold'); }
    else if (score <= -1) { light = 'red'; verdict = t('vCarefulGold'); }
    else { light = 'yellow'; verdict = t('vMidGold'); }
    var why = (light === 'green' ? pros : light === 'red' ? cons : (pros.concat(cons)))[0] || t('whyNeutral');

    /* จุดตัดขาดทุนที่แนะนำ (USD/ออนซ์ — อ้างอิงแนวโน้มราคาทองโลก) เอาไว้คำนวณ % ระยะห่างจากราคา
       แล้วนำ % นั้นไปใช้กับราคาบาท/บาททองคำจริงที่ผู้ใช้จ่ายจริง (ไม่แปลงหน่วยตรงๆ เพราะไม่มีอัตราแปลงในหน้านี้) */
    var stopByAtr = isFinite(at) ? price - 1.5 * at : NaN;
    var stopBySup = isFinite(sr.support) ? sr.support * 0.99 : NaN;
    var stop = NaN;
    if (isFinite(stopBySup) && stopBySup < price) stop = stopBySup;
    if (isFinite(stopByAtr) && stopByAtr < price && (!isFinite(stop) || stopByAtr > stop)) stop = stopByAtr;
    if (!isFinite(stop) || stop <= 0) stop = price * 0.95;

    return {
      light: light, verdict: verdict, why: why, pros: pros, cons: cons, score: score,
      price: price, resistance: sr.resistance, uptrend: uptrend, rsi: r, adx: adxV, suggestStop: stop,
      det: { ema20: ema20, ema50: ema50, rsi: r, macdHist: mac ? mac.hist : NaN,
             support: sr.support, resistance: sr.resistance, posRange: posRange, adx: adxV }
    };
  }
  function analyzeSimple(price, hi, lo) {
    var pos = (price - lo) / Math.max(1e-9, hi - lo), pct = Math.round(pos * 100);
    var light, verdict, why;
    if (pos < 0.35) { light = 'green'; verdict = t('vInterestingGold'); why = t('whyCheapPct', { pct: pct }); }
    else if (pos > 0.75) { light = 'red'; verdict = t('vCarefulGold'); why = t('whyExpensivePct', { pct: pct }); }
    else { light = 'yellow'; verdict = t('vMidGold'); why = t('whyMidPct', { pct: pct }); }
    return { light: light, verdict: verdict, why: why, pros: [], cons: [], price: price, resistance: hi, suggestStop: Math.min(lo, price * 0.95), det: { posRange: pos, support: lo, resistance: hi }, simple: true };
  }
  function riskCalc(o) {
    var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop;
    var perUnit = entry - stop;
    if (!(perUnit > 0)) return { error: t('rcErrStop') };
    var riskBudget = capital * riskPct / 100;
    var qty = riskBudget / perUnit, note = ''; /* ไม่ floor — ซื้อทองเป็นเศษบาททองคำได้ */
    var cost = qty * entry;
    if (cost > capital) {
      var maxQty = capital / entry;
      if (maxQty > 0) { qty = maxQty; cost = qty * entry; note = t('rcCapLimitedNote'); }
    }
    var rr = NaN;
    if (isFinite(o.usdPrice) && o.usdPrice > 0 && isFinite(o.usdResistance) && o.usdResistance > o.usdPrice) {
      var stopPct = perUnit / entry;
      var approxUsdStop = o.usdPrice * (1 - stopPct);
      if (approxUsdStop < o.usdPrice) rr = (o.usdResistance - o.usdPrice) / (o.usdPrice - approxUsdStop);
    }
    return { qty: qty, cost: cost, riskBaht: qty * perUnit, rr: rr, riskBudget: riskBudget, note: note };
  }
  function checklistChecks() {
    var a = lastAnalysis, det = (a && a.det) ? a.det : {};
    var entry = num($('rcEntry').value), stop = num($('rcStop').value), riskPct = num($('rcRiskPct').value);
    var checks = [];
    if (a && isFinite(det.ema20)) {
      var up = isFinite(det.ema50) ? a.price >= det.ema50 : a.price >= det.ema20;
      var adxTxt = isFinite(det.adx) ? t('chkAdxSuffix', { v: det.adx.toFixed(0), label: det.adx >= 20 ? t('chkAdxStrong') : t('chkAdxWeak') }) : '';
      checks.push({ ok: up, txt: (up ? t('chkTrendUp') : t('chkTrendDn')) + adxTxt });
      var over = (a.price - det.ema20) / det.ema20, notChase = over <= 0.05;
      checks.push({ ok: notChase, txt: notChase ? t('chkNoChase') : t('chkChasing') });
    } else {
      checks.push({ ok: null, txt: t('chkTrendNeedData') });
    }
    if (a && isFinite(det.rsi)) checks.push({ ok: det.rsi < 70, txt: det.rsi < 70 ? t('chkRsiOk', { v: det.rsi.toFixed(0) }) : t('chkRsiHot', { v: det.rsi.toFixed(0) }) });
    else checks.push({ ok: null, txt: t('chkRsiNeedData') });
    var stopOk = isFinite(entry) && isFinite(stop) && stop < entry;
    checks.push({ ok: stopOk, txt: stopOk ? t('chkStopSet') : t('chkStopUnset') });
    checks.push({
      ok: isFinite(riskPct) && riskPct <= 2,
      txt: (isFinite(riskPct) && riskPct <= 2) ? t('chkRiskOk', { v: riskPct }) : t('chkRiskHigh', { v: isFinite(riskPct) ? riskPct + '%' : '-' })
    });
    if (a && stopOk && isFinite(a.resistance) && a.resistance > a.price && isFinite(a.price) && a.price > 0) {
      var stopPct = (entry - stop) / entry;
      var approxUsdStop = a.price * (1 - stopPct);
      var rr = approxUsdStop < a.price ? (a.resistance - a.price) / (a.price - approxUsdStop) : NaN;
      if (isFinite(rr)) {
        var rrOk = rr >= 2;
        checks.push({ ok: rrOk, txt: rrOk ? t('chkRrOk', { v: rr.toFixed(1) }) : t('chkRrLow', { v: rr.toFixed(1) }) });
      } else {
        checks.push({ ok: null, txt: t('chkRrNeedData') });
      }
    } else {
      checks.push({ ok: null, txt: t('chkRrNeedData') });
    }
    var so = gAnswers.spotOnly;
    checks.push({
      ok: so === 'yes' ? true : so === 'no' ? false : null,
      txt: so === 'yes' ? t('chkSpotYes') : so === 'no' ? t('chkSpotNo') : t('chkSpotUnknown')
    });
    return checks;
  }
  function toSeries(times, opens, highs, lows, closes, volumes) {
    var ohlc = [], i;
    for (i = 0; i < times.length; i++) ohlc.push({ time: times[i], open: opens[i], high: highs[i], low: lows[i], close: closes[i] });
    return { times: times, closes: closes, highs: highs, lows: lows, ohlc: ohlc };
  }
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
  function simulateGoldDCA(pmt, startPrice, annualPct, months) {
    var rm = annualPct / 100 / 12;
    var price = startPrice, weight = 0, contrib = 0, series = [];
    for (var i = 0; i < months; i++) {
      price = price * (1 + rm);
      var w = pmt / price;
      weight += w; contrib += pmt;
      series.push({ month: i + 1, price: price, weight: weight, value: weight * price, contrib: contrib });
    }
    return { weight: weight, price: price, value: weight * price, contrib: contrib, series: series };
  }
  function parseGoldTH(t) {
    var j = JSON.parse(t), r = j && j.response;
    if (!r || !r.price || !r.price.gold_bar || !r.price.gold) throw new Error('no data');
    function n(s) { return parseFloat(String(s).replace(/,/g, '')); }
    var bar = r.price.gold_bar, jew = r.price.gold;
    /* ฟิลด์ API ตั้งชื่อมุมมองร้านทอง (sell=ร้านขาย/คุณซื้อ, buy=ร้านซื้อคืน/คุณขาย) — map เป็นมุมมองผู้ใช้ตรงๆ กันสับสน */
    var out = {
      barBuyPrice: n(bar.sell), barSellPrice: n(bar.buy),
      jewelryBuyPrice: n(jew.sell), jewelrySellPrice: n(jew.buy),
      updateDate: r.update_date, updateTime: r.update_time
    };
    var vals = [out.barBuyPrice, out.barSellPrice, out.jewelryBuyPrice, out.jewelrySellPrice], i;
    for (i = 0; i < vals.length; i++) if (!isFinite(vals[i])) throw new Error('bad numbers');
    return out;
  }
  function parseQuoteLite(t) {
    var j = JSON.parse(t), res = j && j.chart && j.chart.result && j.chart.result[0];
    var meta = res && res.meta;
    if (!meta || !isFinite(meta.regularMarketPrice)) throw new Error('no meta');
    return { price: meta.regularMarketPrice, prevClose: meta.previousClose };
  }
    function __set(a, inputs, answer) { lastAnalysis = a; INPUTS = inputs || {}; gAnswers.spotOnly = answer; btcAnswers.noLeverage = answer; cAnswers.noLeverage = answer; }
    return { sma, smaSeries, emaSeries, emaLast, rsi, macd, bollinger, atr, supRes, adx, analyzeSeries, analyzeSimple, riskCalc, checklistChecks, toSeries, parseYahoo, simulateGoldDCA, parseGoldTH, parseQuoteLite, __set };
  }

  /* ── comm ── */
  function make_comm() {
    
    var t = T, num = numF, fmt = fmtF;
    var INPUTS = {}, lastAnalysis = null, gAnswers = {}, btcAnswers = {}, cAnswers = {};
    var $ = function (id) { return { value: INPUTS[id] === undefined ? '' : String(INPUTS[id]) }; };
  function sma(arr, n) {
    if (arr.length < n) return NaN;
    var s = 0; for (var i = arr.length - n; i < arr.length; i++) s += arr[i];
    return s / n;
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
  function analyzeSeries(s) {
    var c = s.closes, price = c[c.length - 1];
    var ema20 = emaLast(c, 20), ema50 = emaLast(c, 50), r = rsi(c, 14);
    var mac = macd(c), bb = bollinger(c, 20, 2), at = atr(s.highs, s.lows, c, 14);
    var sr = supRes(s.highs, s.lows, 20);
    var adxV = adx(s.highs, s.lows, c, 14);
    var range = { hi: Math.max.apply(null, c), lo: Math.min.apply(null, c) };
    var posRange = (price - range.lo) / Math.max(1e-9, range.hi - range.lo);
    var posBB = bb ? (price - bb.lower) / Math.max(1e-9, bb.upper - bb.lower) : 0.5;
    var uptrend = isFinite(ema50) ? price >= ema50 : (isFinite(ema20) ? price >= ema20 : true);
    var momUp = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist > mac.histPrev : false;
    var momDn = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist < mac.histPrev : false;

    var score = 0, pros = [], cons = [];
    if (posRange < 0.35) { score += 1; pros.push(t('whyCheapRange')); }
    else if (posRange > 0.75) { score -= 1; cons.push(t('whyExpensiveRange')); }
    if (isFinite(r)) {
      if (r < 38) { score += 1; pros.push(t('whyRsiLow')); }
      else if (r > 70) { score -= 1; cons.push(t('whyRsiHigh')); }
    }
    if (momUp) { score += 1; pros.push(t('whyMomUp')); }
    else if (momDn) { score -= 1; cons.push(t('whyMomDn')); }
    if (uptrend) { score += 1; pros.push(t('whyUptrend')); }
    else { score -= 1; cons.push(t('whyDowntrend')); }
    if (posBB < 0.2) { score += 0.5; pros.push(t('whyBbLow')); }
    else if (posBB > 0.9) { score -= 0.5; cons.push(t('whyBbHigh')); }

    var light, verdict;
    if (score >= 2) { light = 'green'; verdict = t('vInteresting'); }
    else if (score <= -1) { light = 'red'; verdict = t('vCareful'); }
    else { light = 'yellow'; verdict = t('vMid'); }
    var why = (light === 'green' ? pros : light === 'red' ? cons : (pros.concat(cons)))[0] || t('whyNeutral');

    var stopByAtr = isFinite(at) ? price - 1.5 * at : NaN;
    var stopBySup = isFinite(sr.support) ? sr.support * 0.99 : NaN;
    var stop = NaN;
    if (isFinite(stopBySup) && stopBySup < price) stop = stopBySup;
    if (isFinite(stopByAtr) && stopByAtr < price && (!isFinite(stop) || stopByAtr > stop)) stop = stopByAtr;
    if (!isFinite(stop) || stop <= 0) stop = price * 0.95;

    return {
      light: light, verdict: verdict, why: why, pros: pros, cons: cons, score: score,
      price: price, resistance: sr.resistance, uptrend: uptrend, rsi: r, adx: adxV, suggestStop: stop,
      det: { ema20: ema20, ema50: ema50, rsi: r, macdHist: mac ? mac.hist : NaN,
             support: sr.support, resistance: sr.resistance, posRange: posRange, adx: adxV }
    };
  }
  function riskCalc(o) {
    var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop;
    var perUnit = entry - stop;
    if (!(perUnit > 0)) return { error: t('rcErrStop') };
    var riskBudget = capital * riskPct / 100;
    var qty = riskBudget / perUnit, note = '';
    var cost = qty * entry;
    if (cost > capital) {
      var maxQty = capital / entry;
      if (maxQty > 0) { qty = maxQty; cost = qty * entry; note = t('rcCapLimitedNote'); }
    }
    var rr = (isFinite(o.resistance) && o.resistance > entry) ? (o.resistance - entry) / perUnit : NaN;
    return { qty: qty, cost: cost, riskAmt: qty * perUnit, rr: rr, riskBudget: riskBudget, note: note };
  }
  function checklistChecks() {
    var a = lastAnalysis, det = (a && a.det) ? a.det : {};
    var entry = num($('rcEntry').value), stop = num($('rcStop').value), riskPct = num($('rcRiskPct').value);
    var checks = [];
    if (a && isFinite(det.ema20)) {
      var up = isFinite(det.ema50) ? a.price >= det.ema50 : a.price >= det.ema20;
      var adxTxt = isFinite(det.adx) ? t('chkAdxSuffix', { v: det.adx.toFixed(0), label: det.adx >= 20 ? t('chkAdxStrong') : t('chkAdxWeak') }) : '';
      checks.push({ ok: up, txt: (up ? t('chkTrendUp') : t('chkTrendDn')) + adxTxt });
      var over = (a.price - det.ema20) / det.ema20, notChase = over <= 0.05;
      checks.push({ ok: notChase, txt: notChase ? t('chkNoChase') : t('chkChasing') });
    } else {
      checks.push({ ok: null, txt: t('chkTrendNeedData') });
    }
    if (a && isFinite(det.rsi)) checks.push({ ok: det.rsi < 70, txt: det.rsi < 70 ? t('chkRsiOk', { v: det.rsi.toFixed(0) }) : t('chkRsiHot', { v: det.rsi.toFixed(0) }) });
    else checks.push({ ok: null, txt: t('chkRsiNeedData') });
    var stopOk = isFinite(entry) && isFinite(stop) && stop < entry;
    checks.push({ ok: stopOk, txt: stopOk ? t('chkStopSet') : t('chkStopUnset') });
    checks.push({
      ok: isFinite(riskPct) && riskPct <= 2,
      txt: (isFinite(riskPct) && riskPct <= 2) ? t('chkRiskOk', { v: riskPct }) : t('chkRiskHigh', { v: isFinite(riskPct) ? riskPct + '%' : '-' })
    });
    if (a && stopOk && isFinite(a.resistance) && a.resistance > entry) {
      var rr = (a.resistance - entry) / (entry - stop), rrOk = rr >= 2;
      checks.push({ ok: rrOk, txt: rrOk ? t('chkRrOk', { v: rr.toFixed(1) }) : t('chkRrLow', { v: rr.toFixed(1) }) });
    } else {
      checks.push({ ok: null, txt: t('chkRrNeedData') });
    }
    var lv = cAnswers.noLeverage;
    checks.push({
      ok: lv === 'yes' ? true : lv === 'no' ? false : null,
      txt: lv === 'yes' ? t('chkLeverageYes') : lv === 'no' ? t('chkLeverageNo') : t('chkLeverageUnknown')
    });
    return checks;
  }
    function __set(a, inputs, answer) { lastAnalysis = a; INPUTS = inputs || {}; gAnswers.spotOnly = answer; btcAnswers.noLeverage = answer; cAnswers.noLeverage = answer; }
    return { sma, emaSeries, emaLast, rsi, macd, bollinger, atr, supRes, adx, analyzeSeries, riskCalc, checklistChecks, __set };
  }

  /* ── thfund ── */
  function make_thfund() {
    
    var t = T, num = numF;
  var ESG_RULES = [
    { from: 2024, to: 2026, cap: 300000, holdYears: 5 },
    { from: 2027, to: 2032, cap: 100000, holdYears: 8 }
  ];
  function simulate(pmt, annualNetPct, months, divYieldPct) {
    var rm = annualNetPct / 100 / 12;
    var dm = (divYieldPct || 0) / 100 / 12;
    var bal = 0, cash = 0, series = [];
    for (var i = 0; i < months; i++) {
      bal = (bal + pmt) * (1 + rm);
      if (dm > 0) { var d = bal * dm; cash += d; }
      series.push({ bal: bal, cash: cash, contrib: pmt * (i + 1) });
    }
    return { balance: bal, cash: cash, series: series };
  }
  function plan(o) {
    var months = Math.round(o.years * 12);
    var netAcc = o.cagr - o.fee;
    var netDivPrice = o.cagr - o.fee - o.dy;
    var acc = simulate(o.accM, netAcc, months, 0);
    var div = simulate(o.divM, netDivPrice, months, o.dy);
    var contribAcc = o.accM * months, contribDiv = o.divM * months;
    return {
      months: months,
      acc: acc, div: div,
      contribAcc: contribAcc, contribDiv: contribDiv,
      contribTotal: contribAcc + contribDiv,
      valueTotal: acc.balance + div.balance,
      divCash: div.cash
    };
  }
  function eligibilityFor(cat, purchases, birthYear) {
    if (!purchases.length) return null;
    purchases.sort(function (a, b) { return a.ts - b.ts; });
    var firstYear = new Date(purchases[0].ts).getFullYear();
    if (cat === 'ssf') {
      return { readyYear: firstYear + 10, note: t('elSsfNote', { year: firstYear }) };
    }
    if (cat === 'esg') {
      var rule = esgRuleForYear(firstYear);
      return { readyYear: firstYear + rule.holdYears, note: t('elEsgNote', { years: rule.holdYears, year: firstYear }) };
    }
    if (cat === 'rmf') {
      var yearCond = firstYear + 5;
      var ageCond = birthYear ? (birthYear + 55) : null;
      return {
        readyYear: ageCond ? Math.max(yearCond, ageCond) : yearCond,
        needsBirthYear: !ageCond,
        note: t('elRmfNote', { year: firstYear })
      };
    }
    return null;
  }
  function esgRuleForYear(year) {
    for (var i = 0; i < ESG_RULES.length; i++) { var r = ESG_RULES[i]; if (year >= r.from && year <= r.to) return r; }
    return ESG_RULES[ESG_RULES.length - 1]; /* นอกช่วงที่ทราบ (ก่อน 2567 หรือหลัง 2575) ใช้เกณฑ์ล่าสุดที่ทราบไปก่อน — อาจเปลี่ยนได้จริง */
  }
    return { simulate, plan, eligibilityFor, esgRuleForYear };
  }

  /* ── gfund ── */
  function make_gfund() {
    
    var t = T, num = numF;
  function simulate(pmt, annualNetPct, months, divYieldPct) {
    var rm = annualNetPct / 100 / 12;
    var dm = (divYieldPct || 0) / 100 / 12;
    var bal = 0, cash = 0, series = [];
    for (var i = 0; i < months; i++) {
      bal = (bal + pmt) * (1 + rm);
      if (dm > 0) { var d = bal * dm; cash += d; }
      series.push({ bal: bal, cash: cash, contrib: pmt * (i + 1) });
    }
    return { balance: bal, cash: cash, series: series };
  }
  function plan(o) {
    var months = Math.round(o.years * 12);
    var netAcc = o.cagr - o.fee;                 /* สะสมมูลค่า: ทบต้นเต็ม */
    var netDivPrice = o.cagr - o.fee - o.dy;     /* ปันผล: ราคาโตช้าลงเพราะจ่ายปันผลออก */
    var acc = simulate(o.accM, netAcc, months, 0);
    var div = simulate(o.divM, netDivPrice, months, o.dy);
    var contribAcc = o.accM * months, contribDiv = o.divM * months;
    return {
      months: months,
      acc: acc, div: div,
      contribAcc: contribAcc, contribDiv: contribDiv,
      contribTotal: contribAcc + contribDiv,
      valueTotal: acc.balance + div.balance,
      divCash: div.cash
    };
  }
    return { simulate, plan };
  }

  /* ── bond ── */
  function make_bond() {
    
    var t = T, num = numF;
  function bondPV(couponPerPeriod, face, nPeriods, ratePerPeriod) {
    var pv = 0, i;
    for (i = 1; i <= nPeriods; i++) {
      pv += couponPerPeriod / Math.pow(1 + ratePerPeriod, i);
    }
    pv += face / Math.pow(1 + ratePerPeriod, nPeriods);
    return pv;
  }
  function solveYTM(price, face, couponRatePct, freq, years) {
    var nPeriods = Math.round(freq * years);
    if (!(nPeriods > 0) || !isFinite(price) || price <= 0 || !isFinite(face) || face <= 0) return NaN;
    var couponPerPeriod = face * (couponRatePct / 100) / freq;

    function f(rPerPeriod) { return bondPV(couponPerPeriod, face, nPeriods, rPerPeriod) - price; }

    var lo = -0.5, hi = 2;
    var fLo = f(lo), fHi = f(hi), tries = 0;
    while (fLo * fHi > 0 && tries < 10) { hi *= 2; fHi = f(hi); tries++; }
    if (fLo * fHi > 0 || !isFinite(fLo) || !isFinite(fHi)) return NaN;

    var mid = lo, iter;
    for (iter = 0; iter < 100; iter++) {
      mid = (lo + hi) / 2;
      var fMid = f(mid);
      if (Math.abs(fMid) < 1e-7 || (hi - lo) < 1e-12) break;
      if ((fLo < 0) === (fMid < 0)) { lo = mid; fLo = fMid; } else { hi = mid; fHi = fMid; }
    }
    return mid * freq * 100;
  }
  function addMonths(date, months) {
    var d = new Date(date.getTime());
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
  }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function parseYMD(s) {
    if (!s) return null;
    var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isFinite(d.getTime()) ? d : null;
  }
  function couponSchedule(purchaseDate, maturityDate, freq, face, couponRatePct) {
    var rows = [];
    if (!purchaseDate || !maturityDate || !(maturityDate > purchaseDate) || !(freq > 0)) return rows;
    var stepMonths = 12 / freq;
    var couponAmt = face * (couponRatePct / 100) / freq;
    var d = addMonths(purchaseDate, stepMonths), guard = 0;
    while (d <= maturityDate && guard < 2000) {
      var isLast = sameDay(d, maturityDate);
      rows.push({ date: d, coupon: couponAmt, principal: isLast ? face : 0, total: couponAmt + (isLast ? face : 0) });
      if (isLast) break;
      d = addMonths(d, stepMonths);
      guard++;
    }
    if (!rows.length || !sameDay(rows[rows.length - 1].date, maturityDate)) {
      rows.push({ date: new Date(maturityDate.getTime()), coupon: 0, principal: face, total: face });
    }
    return rows;
  }
  function compareDeposit(principal, years, bondAnnualCoupon, depositRatePct) {
    var bondGross = bondAnnualCoupon * years;
    var bondAfterTax = bondGross * (1 - 0.15);
    var depGross = principal * (depositRatePct / 100) * years;
    var depAfterTax = depGross * (1 - 0.15);
    return { principal: principal, years: years, bondGross: bondGross, bondAfterTax: bondAfterTax, depGross: depGross, depAfterTax: depAfterTax };
  }
    return { bondPV, solveYTM, addMonths, sameDay, parseYMD, couponSchedule, compareDeposit };
  }

  /* ── gsb ── */
  function make_gsb() {
    
    var t = T, num = numF;
  function addMonths(date, months) {
    var d = new Date(date.getTime());
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
  }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function parseYMD(s) {
    if (!s) return null;
    var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isFinite(d.getTime()) ? d : null;
  }
  function ymd(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function parseDrawDays(s) { return (s || '16').split(',').map(function (x) { return +x; }).filter(function (n) { return n >= 1 && n <= 31; }); }
  function drawSchedule(purchaseDate, maturityDate, daysOfMonth) {
    var rows = [];
    if (!purchaseDate || !maturityDate || !(maturityDate > purchaseDate) || !daysOfMonth || !daysOfMonth.length) return rows;
    var anchor = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);
    var guard = 0;
    while (guard < 2000) {
      var y = anchor.getFullYear(), m = anchor.getMonth();
      var lastDay = new Date(y, m + 1, 0).getDate();
      for (var i = 0; i < daysOfMonth.length; i++) {
        var day = Math.min(daysOfMonth[i], lastDay);
        var d = new Date(y, m, day);
        if (d > purchaseDate && d <= maturityDate) rows.push({ date: d });
      }
      if (anchor > maturityDate) break;
      anchor = addMonths(anchor, 1); /* anchor.getDate() === 1 เสมอ จึงไม่มีปัญหา clamp */
      guard++;
    }
    rows.sort(function (a, b) { return a.date - b.date; });
    return rows;
  }
  function tierProbability(tier) {
    if (!(tier.totalUnits > 0) || !(tier.winners >= 0)) return NaN;
    return tier.winners / tier.totalUnits;
  }
  function evPerUnitPerDraw(tiers) {
    var sum = 0;
    tiers.forEach(function (tier) { var p = tierProbability(tier); if (isFinite(p)) sum += p * (tier.amount || 0); });
    return sum;
  }
  function probAtLeastOnePerDraw(tiers, unitsHeld) {
    var probNone = 1;
    tiers.forEach(function (tier) {
      var p = tierProbability(tier);
      if (isFinite(p)) probNone *= Math.pow(1 - p, unitsHeld);
    });
    return isFinite(probNone) ? 1 - probNone : NaN;
  }
  function expectedTotalPrize(tiers, unitsHeld, numberOfDraws) {
    return evPerUnitPerDraw(tiers) * unitsHeld * numberOfDraws;
  }
  function guaranteedRedemption(principal, annualRatePct, years) {
    return principal * (1 + (annualRatePct / 100) * years);
  }
  function totalExpectedReturn(principal, annualRatePct, years, tiers, unitsHeld, numberOfDraws, taxExempt) {
    var guaranteed = guaranteedRedemption(principal, annualRatePct, years);
    var guaranteedInterest = guaranteed - principal;
    var prizeEV = expectedTotalPrize(tiers, unitsHeld, numberOfDraws);
    var taxRate = taxExempt ? 0 : 0.15;
    var interestAfterTax = guaranteedInterest * (1 - taxRate);
    var prizeAfterTax = prizeEV * (1 - taxRate);
    return {
      principal: principal, guaranteedInterest: guaranteedInterest, prizeEV: prizeEV,
      interestAfterTax: interestAfterTax, prizeAfterTax: prizeAfterTax,
      totalGross: principal + guaranteedInterest + prizeEV,
      totalNet: principal + interestAfterTax + prizeAfterTax
    };
  }
  function annualizedExpectedReturnPct(totalNetGain, principal, years) {
    if (!(principal > 0) || !(years > 0)) return NaN;
    return (totalNetGain / principal / years) * 100;
  }
  function compareLotteryVsDeposit(principal, years, expectedResult, depositRatePct) {
    var lotteryGainNet = expectedResult.totalNet - principal;
    var depGross = principal * (depositRatePct / 100) * years;
    var depAfterTax = depGross * (1 - 0.15);
    return { principal: principal, years: years, lotteryGainNet: lotteryGainNet, depGross: depGross, depAfterTax: depAfterTax };
  }
    return { addMonths, sameDay, parseYMD, ymd, parseDrawDays, drawSchedule, tierProbability, evPerUnitPerDraw, probAtLeastOnePerDraw, expectedTotalPrize, guaranteedRedemption, totalExpectedReturn, annualizedExpectedReturnPct, compareLotteryVsDeposit };
  }

  /* ── baac ── */
  function make_baac() {
    
    var t = T, num = numF;
  function addMonths(date, months) {
    var d = new Date(date.getTime());
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
  }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function parseYMD(s) {
    if (!s) return null;
    var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isFinite(d.getTime()) ? d : null;
  }
  function ymd(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function parseDrawDays(s) { return (s || '16').split(',').map(function (x) { return +x; }).filter(function (n) { return n >= 1 && n <= 31; }); }
  function drawSchedule(purchaseDate, maturityDate, daysOfMonth) {
    var rows = [];
    if (!purchaseDate || !maturityDate || !(maturityDate > purchaseDate) || !daysOfMonth || !daysOfMonth.length) return rows;
    var anchor = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);
    var guard = 0;
    while (guard < 2000) {
      var y = anchor.getFullYear(), m = anchor.getMonth();
      var lastDay = new Date(y, m + 1, 0).getDate();
      for (var i = 0; i < daysOfMonth.length; i++) {
        var day = Math.min(daysOfMonth[i], lastDay);
        var d = new Date(y, m, day);
        if (d > purchaseDate && d <= maturityDate) rows.push({ date: d });
      }
      if (anchor > maturityDate) break;
      anchor = addMonths(anchor, 1); /* anchor.getDate() === 1 เสมอ จึงไม่มีปัญหา clamp */
      guard++;
    }
    rows.sort(function (a, b) { return a.date - b.date; });
    return rows;
  }
  function tierProbability(tier) {
    if (!(tier.totalUnits > 0) || !(tier.winners >= 0)) return NaN;
    return tier.winners / tier.totalUnits;
  }
  function evPerUnitPerDraw(tiers) {
    var sum = 0;
    tiers.forEach(function (tier) { var p = tierProbability(tier); if (isFinite(p)) sum += p * (tier.amount || 0); });
    return sum;
  }
  function probAtLeastOnePerDraw(tiers, unitsHeld) {
    var probNone = 1;
    tiers.forEach(function (tier) {
      var p = tierProbability(tier);
      if (isFinite(p)) probNone *= Math.pow(1 - p, unitsHeld);
    });
    return isFinite(probNone) ? 1 - probNone : NaN;
  }
  function expectedTotalPrize(tiers, unitsHeld, numberOfDraws) {
    return evPerUnitPerDraw(tiers) * unitsHeld * numberOfDraws;
  }
  function guaranteedRedemption(principal, annualRatePct, years) {
    return principal * (1 + (annualRatePct / 100) * years);
  }
  function totalExpectedReturn(principal, annualRatePct, years, tiers, unitsHeld, numberOfDraws, taxExempt) {
    var guaranteed = guaranteedRedemption(principal, annualRatePct, years);
    var guaranteedInterest = guaranteed - principal;
    var prizeEV = expectedTotalPrize(tiers, unitsHeld, numberOfDraws);
    var taxRate = taxExempt ? 0 : 0.15;
    var interestAfterTax = guaranteedInterest * (1 - taxRate);
    var prizeAfterTax = prizeEV * (1 - taxRate);
    return {
      principal: principal, guaranteedInterest: guaranteedInterest, prizeEV: prizeEV,
      interestAfterTax: interestAfterTax, prizeAfterTax: prizeAfterTax,
      totalGross: principal + guaranteedInterest + prizeEV,
      totalNet: principal + interestAfterTax + prizeAfterTax
    };
  }
  function annualizedExpectedReturnPct(totalNetGain, principal, years) {
    if (!(principal > 0) || !(years > 0)) return NaN;
    return (totalNetGain / principal / years) * 100;
  }
  function compareLotteryVsDeposit(principal, years, expectedResult, depositRatePct) {
    var lotteryGainNet = expectedResult.totalNet - principal;
    var depGross = principal * (depositRatePct / 100) * years;
    var depAfterTax = depGross * (1 - 0.15);
    return { principal: principal, years: years, lotteryGainNet: lotteryGainNet, depGross: depGross, depAfterTax: depAfterTax };
  }
    return { addMonths, sameDay, parseYMD, ymd, parseDrawDays, drawSchedule, tierProbability, evPerUnitPerDraw, probAtLeastOnePerDraw, expectedTotalPrize, guaranteedRedemption, totalExpectedReturn, annualizedExpectedReturnPct, compareLotteryVsDeposit };
  }

  /* ── lottery ── */
  function make_lottery() {
    
    var t = T, num = numF;
  var DATE_OVERRIDES = {
    '2015-06-01': '2015-06-02', '2015-12-16': '2015-12-17',
    '2018-03-01': '2018-03-02', '2019-07-16': '2019-07-15',
    '2020-04-01': null, /* งดจับรางวัล เม.ย. 2563 (โควิด) ไม่มีวันทดแทน */
    '2022-02-16': '2022-02-17', '2024-12-30': '2025-01-02'
  };
  function addMonths(date, months) {
    var d = new Date(date.getTime());
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
  }
  function parseYMD(s) {
    if (!s) return null;
    var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isFinite(d.getTime()) ? d : null;
  }
  function ymd(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function parseDrawText(text, dateStr) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
    if (!lines.length) return null;
    lines.shift(); /* บรรทัดแรกเป็น URL อ้างอิงแหล่งข่าว ไม่ใช่ข้อมูล */
    var d = {
      date: dateStr, first: null, second: [], third: [], fourth: [], fifth: [],
      threeFirst: null, threeLast: null, legacyThree: null, twoDigit: null, nearFirst: null
    };
    lines.forEach(function (line) {
      var parts = line.split(/\s+/);
      var label = parts.shift();
      if (label === 'FIRST') d.first = parts[0] || null;
      else if (label === 'THREE') d.legacyThree = parts.slice(); /* รูปแบบเก่า ก่อน 1 ก.ย. 2558 — ไม่แยกหน้า/หลัง */
      else if (label === 'THREE_FIRST') d.threeFirst = parts.slice(0, 2);
      else if (label === 'THREE_LAST') d.threeLast = parts.slice(0, 2);
      else if (label === 'TWO') d.twoDigit = parts[0] || null;
      else if (label === 'NEAR_FIRST') d.nearFirst = parts.slice(0, 2);
      else if (label === 'SECOND') d.second = parts.slice();
      else if (label === 'THIRD') d.third = parts.slice();
      else if (label === 'FOURTH') d.fourth = parts.slice();
      else if (label === 'FIFTH') d.fifth = parts.slice();
      /* label ไม่รู้จัก: ข้าม ไม่ throw — กันไฟล์รูปแบบเปลี่ยนในอนาคตพังทั้งหน้า */
    });
    return d;
  }
  function candidateDrawDates(fromDate, toDate) {
    /* ตรวจสอบด้วย curl จริงพบว่ากฎ "1/16 ของเดือน ยกเว้นตายตัว 3 ข้อ" ที่ระบุใน README ต้นทาง
       ไม่ตรงทุกปีจริง (เช่น 2007/2010/2026: งวด 16 ม.ค. ออกวันที่ 16 จริง ไม่เลื่อนเป็น 17;
       รอยต่อปี 2025→2026 ออกวันที่ 2 ม.ค. ไม่ใช่ 30 ธ.ค. หรือ 1 ม.ค.) — จึงไม่ยึดวันเดียวแบบมั่นใจ
       เกินไป แต่สร้าง "ผู้สมัคร" หลายวันรอบจุดเสี่ยง (ม.ค./พ.ค./ปลาย ธ.ค.) แล้วปล่อยให้ fetch จริง
       (404=ไม่มีงวด) เป็นตัวตัดสินว่าวันไหนคือของจริง — คำขอส่วนเกินไม่กี่รายการต่อปีคุ้มกับความถูกต้อง */
    var out = [], anchor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1), guard = 0;
    while (anchor <= toDate && guard < 3000) {
      var y = anchor.getFullYear(), m = anchor.getMonth();
      out.push(new Date(y, m, 1));
      out.push(new Date(y, m, 16));
      if (m === 0) { out.push(new Date(y, 0, 2)); out.push(new Date(y, 0, 17)); }   /* ปีใหม่/วันครู อาจเลื่อน */
      if (m === 4) out.push(new Date(y, 4, 2));                                     /* วันแรงงาน อาจเลื่อนเป็น 2 พ.ค. */
      if (m === 11) { out.push(new Date(y, 11, 30)); out.push(new Date(y, 11, 31)); } /* รอยต่อปีใหม่ อาจออกช่วงปลาย ธ.ค. */
      anchor = addMonths(anchor, 1);
      guard++;
    }
    out = out.filter(function (d) { return d >= fromDate && d <= toDate; });
    var seen = {}, mapped = [];
    out.forEach(function (d) {
      var key = ymd(d);
      if (DATE_OVERRIDES.hasOwnProperty(key)) {
        var r = DATE_OVERRIDES[key];
        if (r && !seen[r]) { seen[r] = 1; mapped.push(r); }
      } else if (!seen[key]) { seen[key] = 1; mapped.push(key); }
    });
    mapped.sort();
    return mapped;
  }
  function drawsInWindow(cache, fromDate, toDate) {
    var out = [];
    Object.keys(cache).forEach(function (k) {
      var dt = parseYMD(k);
      if (dt && dt >= fromDate && dt <= toDate) out.push(cache[k]);
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return out;
  }
  function frequencyTable(draws, field) {
    var counts = {};
    draws.forEach(function (d) {
      var vals = field === 'twoDigit' ? (d.twoDigit ? [d.twoDigit] : []) : (d[field] || []);
      vals.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    });
    return counts;
  }
  function digitPositionFrequency(draws, tier) {
    var pos = [{}, {}, {}, {}, {}, {}];
    draws.forEach(function (d) {
      var nums = tier === 'first' ? (d.first ? [d.first] : []) : (d[tier] || []);
      nums.forEach(function (n) {
        if (!n || n.length !== 6) return;
        for (var i = 0; i < 6; i++) { var g = n[i]; pos[i][g] = (pos[i][g] || 0) + 1; }
      });
    });
    return pos;
  }
  function checkTicket(ticketRaw, draw) {
    var ticket = (ticketRaw || '').replace(/\D/g, '');
    if (ticket.length !== 6 || !draw) return null;
    var two = ticket.slice(-2), threeFront = ticket.slice(0, 3), threeBack = ticket.slice(-3);
    var hits = [];
    if (draw.first === ticket) hits.push(t('hitFirst'));
    if ((draw.second || []).indexOf(ticket) !== -1) hits.push(t('hitSecond'));
    if ((draw.third || []).indexOf(ticket) !== -1) hits.push(t('hitThird'));
    if (draw.nearFirst && draw.nearFirst.indexOf(ticket) !== -1) hits.push(t('hitNearFirst'));
    if (draw.fourth && draw.fourth.indexOf(ticket) !== -1) hits.push(t('hitFourth'));
    if (draw.fifth && draw.fifth.indexOf(ticket) !== -1) hits.push(t('hitFifth'));
    if (draw.threeFirst && draw.threeFirst.indexOf(threeFront) !== -1) hits.push(t('hitThreeFront'));
    if (draw.threeLast && draw.threeLast.indexOf(threeBack) !== -1) hits.push(t('hitThreeBack'));
    if (draw.twoDigit === two) hits.push(t('hitTwoDigit'));
    return { ticket: ticket, drawDate: draw.date, hits: hits };
  }
    return { addMonths, parseYMD, ymd, parseDrawText, candidateDrawDates, drawsInWindow, frequencyTable, digitPositionFrequency, checkTicket };
  }

module.exports = {
  th: make_th(), us: make_us(), btc: make_btc(), gold: make_gold(), comm: make_comm(),
  thfund: make_thfund(), gfund: make_gfund(), bond: make_bond(), gsb: make_gsb(), baac: make_baac(), lottery: make_lottery(),
  fresh: { th: make_th, us: make_us, btc: make_btc, gold: make_gold, comm: make_comm }
};
