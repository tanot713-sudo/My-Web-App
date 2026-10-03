/* ══════════════════════════════════════════════════════════════════
   Tanot — ตรรกะล้วนของโซนลงทุน (ROADMAP Phase 6 · ยุบรวมหน้าลงทุน, docs/invest-consolidation-design.md หัวข้อ 5.1)
   UMD: window.InvestCalc ในหน้า / require('./invest-calc.js') ในเทสต์ — ไม่มี DOM, ไม่มี storage, ไม่มีเครือข่าย
   สูตรอินดิเคเตอร์/ไฟจราจร/คุมเงิน/DCA/พันธบัตร/สลากย้ายมาจากหน้าเดิมตรงตัว (ห้ามแก้สูตร — tests/invest.spec.js
   เทียบกับ tests/fixtures/invest-original.js ทุกหลัก) · ข้อความไม่อยู่ที่นี่: ฟังก์ชันวิเคราะห์คืน "รหัสเหตุผล"
   แล้วหน้าแปลงเป็นข้อความเอง
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InvestCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ═══ อินดิเคเตอร์ (ย้ายจาก invest-thai-stock.js ตรงตัว) ═══ */
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

  /* ═══ ชุดข้อมูลราคา ═══ */
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
  /* วันที่ย้อนหลัง n วัน (เวลาเครื่อง) — now ส่งเข้ามาได้เพื่อเทสต์ */
  function daysAgoDates(n, now) {
    var out = [], d = now ? new Date(now) : new Date(); d.setHours(0, 0, 0, 0);
    for (var i = n - 1; i >= 0; i--) { var x = new Date(d); x.setDate(d.getDate() - i); out.push(x.toISOString().slice(0, 10)); }
    return out;
  }
  function parsePaste(text, now) {
    var nums = (text.match(/-?\d+(\.\d+)?/g) || []).map(Number).filter(function (x) { return isFinite(x) && x > 0; });
    if (nums.length < 5) return null;
    var opens = [], highs = [], lows = [], vols = [], i;
    for (i = 0; i < nums.length; i++) {
      var open = i === 0 ? nums[0] : nums[i - 1];
      opens.push(open); highs.push(Math.max(open, nums[i]) * 1.004); lows.push(Math.min(open, nums[i]) * 0.996); vols.push(0);
    }
    return toSeries(daysAgoDates(nums.length, now), opens, highs, lows, nums, vols);
  }
  /* ตัวอย่างฝึกอ่านกราฟ (สุ่มแบบกำหนด seed — ผลคงที่) */
  function demoData(startPrice, now) {
    var n = 252, opens = [], highs = [], lows = [], closes = [], vols = [];
    var seed = 20240117, rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    var price = startPrice || 32, i;
    for (i = 0; i < n; i++) {
      var ret = 0.0004 + (rnd() - 0.5) * 0.032, open = price, close = Math.max(1, open * (1 + ret));
      opens.push(+open.toFixed(2)); closes.push(+close.toFixed(2));
      highs.push(+(Math.max(open, close) * (1 + rnd() * 0.012)).toFixed(2));
      lows.push(+(Math.min(open, close) * (1 - rnd() * 0.012)).toFixed(2));
      vols.push(Math.round(2e6 + rnd() * 8e6)); price = close;
    }
    return toSeries(daysAgoDates(n, now), opens, highs, lows, closes, vols);
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
  /* ราคาปิดล่าสุดที่ใช้ได้ของแท่งรายวัน (ซื้อย้อนหลังในพอร์ตจำลอง) → {price, ts ms} */
  function parseHistoricalClose(j) {
    var res = j && j.chart && j.chart.result && j.chart.result[0];
    var closes = res && res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close;
    var ts = res && res.timestamp;
    if (!closes || !ts || !closes.length) throw new Error('no historical data');
    for (var i = closes.length - 1; i >= 0; i--) {
      if (closes[i] != null && isFinite(closes[i])) return { price: closes[i], ts: ts[i] * 1000 };
    }
    throw new Error('no valid close');
  }
  /* quote ย่อ: ราคา + ปิดก่อนหน้า + sparkline (ปิดรายวัน) จาก chart?range=5d */
  function parseQuoteLite(j) {
    var res = j && j.chart && j.chart.result && j.chart.result[0];
    var meta = res && res.meta;
    if (!meta || !isFinite(meta.regularMarketPrice)) throw new Error('no meta');
    var q = res.indicators && res.indicators.quote && res.indicators.quote[0], spark = [];
    if (q && q.close) { for (var i = 0; i < q.close.length; i++) if (q.close[i] != null && isFinite(q.close[i])) spark.push(q.close[i]); }
    var prev = isFinite(meta.previousClose) ? meta.previousClose : (isFinite(meta.chartPreviousClose) ? meta.chartPreviousClose : NaN);
    return { price: meta.regularMarketPrice, prev: prev, prevClose: prev, spark: spark };
  }
  /* อัตราแลกเปลี่ยน (THB=X) — meta ก่อน ไม่มีใช้ close ล่าสุด */
  function parseFxRate(j) {
    var res = j && j.chart && j.chart.result && j.chart.result[0];
    var meta = res && res.meta, q = res && res.indicators && res.indicators.quote && res.indicators.quote[0];
    var rate = meta && isFinite(meta.regularMarketPrice) ? meta.regularMarketPrice : null;
    if (!rate && q && q.close) { for (var i = q.close.length - 1; i >= 0; i--) { if (q.close[i] != null) { rate = q.close[i]; break; } } }
    if (!isFinite(rate) || rate <= 0) throw new Error('no rate');
    return rate;
  }
  /* ราคาทองไทย (thai-gold-api community project, MIT) */
  function parseGoldTH(j) {
    var r = j && j.response;
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
  function parseFng(j) {
    var d = j && j.data && j.data[0];
    if (!d || !isFinite(parseInt(d.value, 10))) throw new Error('no data');
    return { value: parseInt(d.value, 10), classification: d.value_classification, ts: d.timestamp };
  }

  /* ═══ วิเคราะห์ → ไฟจราจร (คืนรหัสเหตุผล ไม่ใช่ข้อความ) ═══
     reasons: [{code, sign}] ตามลำดับที่คิด · pros/cons = รหัสของแต่ละฝั่ง
     code: cheapRange|expensiveRange|rsiLow|rsiHigh|momUp|momDn|uptrend|downtrend|bbLow|bbHigh · why = รหัสแรกของฝั่งที่ตรงกับไฟ (ไม่มี = 'neutral')
     opts.psar = false → ไม่คำนวณ PSAR (ทอง/สินค้าโภคภัณฑ์เดิมไม่มี) */
  function analyzeSeries(s, opts) {
    var withPsar = !(opts && opts.psar === false);
    var c = s.closes, price = c[c.length - 1];
    var ema20 = emaLast(c, 20), ema50 = emaLast(c, 50), r = rsi(c, 14);
    var mac = macd(c), bb = bollinger(c, 20, 2), at = atr(s.highs, s.lows, c, 14);
    var sr = supRes(s.highs, s.lows, 20);
    var adxV = adx(s.highs, s.lows, c, 14), ps = withPsar ? psar(s.highs, s.lows) : undefined;
    var range = { hi: Math.max.apply(null, c), lo: Math.min.apply(null, c) };
    var posRange = (price - range.lo) / Math.max(1e-9, range.hi - range.lo);
    var posBB = bb ? (price - bb.lower) / Math.max(1e-9, bb.upper - bb.lower) : 0.5;
    var uptrend = isFinite(ema50) ? price >= ema50 : (isFinite(ema20) ? price >= ema20 : true);
    var momUp = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist > mac.histPrev : false;
    var momDn = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist < mac.histPrev : false;

    var score = 0, pros = [], cons = [], reasons = [];
    function pro(code) { pros.push(code); reasons.push({ code: code, sign: 1 }); }
    function con(code) { cons.push(code); reasons.push({ code: code, sign: -1 }); }
    if (posRange < 0.35) { score += 1; pro('cheapRange'); }
    else if (posRange > 0.75) { score -= 1; con('expensiveRange'); }
    if (isFinite(r)) {
      if (r < 38) { score += 1; pro('rsiLow'); }
      else if (r > 70) { score -= 1; con('rsiHigh'); }
    }
    if (momUp) { score += 1; pro('momUp'); }
    else if (momDn) { score -= 1; con('momDn'); }
    if (uptrend) { score += 1; pro('uptrend'); }
    else { score -= 1; con('downtrend'); }
    if (posBB < 0.2) { score += 0.5; pro('bbLow'); }
    else if (posBB > 0.9) { score -= 0.5; con('bbHigh'); }

    var light;
    if (score >= 2) light = 'green';
    else if (score <= -1) light = 'red';
    else light = 'yellow';
    var why = (light === 'green' ? pros : light === 'red' ? cons : (pros.concat(cons)))[0] || 'neutral';

    var stopByAtr = isFinite(at) ? price - 1.5 * at : NaN;
    var stopBySup = isFinite(sr.support) ? sr.support * 0.99 : NaN;
    var stop = NaN;
    if (isFinite(stopBySup) && stopBySup < price) stop = stopBySup;
    if (isFinite(stopByAtr) && stopByAtr < price && (!isFinite(stop) || stopByAtr > stop)) stop = stopByAtr;
    if (!isFinite(stop) || stop <= 0) stop = price * 0.95;

    var out = {
      light: light, why: why, reasons: reasons, pros: pros, cons: cons, score: score,
      price: price, suggestStop: stop, resistance: sr.resistance,
      uptrend: uptrend, rsi: r, adx: adxV,
      det: { ema20: ema20, ema50: ema50, rsi: r, macdHist: mac ? mac.hist : NaN,
             bbUpper: bb ? bb.upper : NaN, bbLower: bb ? bb.lower : NaN, atr: at,
             support: sr.support, resistance: sr.resistance, posRange: posRange,
             adx: adxV }
    };
    if (withPsar) { out.psar = ps; out.det.psar = ps; }
    return out;
  }
  /* วิเคราะห์แบบย่อ (มีแค่ราคา + สูง/ต่ำของรอบ) — pct ส่งกลับให้หน้าใส่ในข้อความ */
  function analyzeSimple(price, hi, lo) {
    var pos = (price - lo) / Math.max(1e-9, hi - lo), pct = Math.round(pos * 100);
    var light, why;
    if (pos < 0.35) { light = 'green'; why = 'cheapPct'; }
    else if (pos > 0.75) { light = 'red'; why = 'expensivePct'; }
    else { light = 'yellow'; why = 'midPct'; }
    return { light: light, why: why, pct: pct, pros: [], cons: [], reasons: [], price: price, suggestStop: Math.min(lo, price * 0.95), resistance: hi, det: { posRange: pos, support: lo, resistance: hi }, simple: true };
  }

  /* ═══ ควรขาย? (ตรรกะเดียวกันทุกตลาด) ═══
     code: sarDown|belowTrend|hotRsi|nearResist|hold · levels[].reasonCode: sarNoData|sarUp|sarDown|stopNoData|stopReason|ema20NoData|ema20|resistNoData|resist */
  function sellVerdict(a) {
    var det = a.det || {}, ps = det.psar;
    var cls, code;
    if (ps && !ps.up) { cls = 'err'; code = 'sarDown'; }
    else if (!a.uptrend || (isFinite(det.ema20) && a.price < det.ema20)) { cls = 'err'; code = 'belowTrend'; }
    else if (isFinite(a.rsi) && a.rsi > 70) { cls = 'warn'; code = 'hotRsi'; }
    else if (isFinite(a.resistance) && a.price >= a.resistance * 0.98) { cls = 'warn'; code = 'nearResist'; }
    else { cls = 'ok'; code = 'hold'; }
    var resist = isFinite(det.resistance) ? det.resistance : a.resistance;
    var levels = [
      { key: 'sar', type: 'stop', price: ps ? ps.sar : NaN,
        reasonCode: !ps ? 'sarNoData' : (ps.up ? 'sarUp' : 'sarDown') },
      { key: 'stop', type: 'stop', price: a.suggestStop,
        reasonCode: !isFinite(a.suggestStop) ? 'stopNoData' : 'stopReason', atr: det.atr },
      { key: 'ema20', type: 'warn', price: det.ema20,
        reasonCode: !isFinite(det.ema20) ? 'ema20NoData' : 'ema20' },
      { key: 'resistance', type: 'tp', price: resist,
        reasonCode: !isFinite(resist) ? 'resistNoData' : 'resist' }
    ];
    return { cls: cls, code: code, levels: levels };
  }

  /* ═══ คุมเงิน/ความเสี่ยง — 4 แบบเดิม แยกตามตลาด (ห้ามรวมสูตร) ═══
     error: 'stopMustBeLower' · note: 'minLot'|'minShare'|'capitalLimit' */
  var riskCalc = {
    /* หุ้นไทย: ล็อต 100 + ค่าคอมขั้นต่ำ/วัน */
    th: function (o) {
      var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop, comm = o.comm / 100;
      var commMin = isFinite(o.commMin) && o.commMin >= 0 ? o.commMin : 50;
      var perShare = entry - stop;
      if (!(perShare > 0)) return { error: 'stopMustBeLower' };
      var riskBudget = capital * riskPct / 100;
      var shares = Math.floor(riskBudget / perShare / 100) * 100, note = '';
      if (shares < 100) { shares = 100; note = 'minLot'; }
      var cost = shares * entry;
      if (cost > capital) {
        var maxLots = Math.floor(capital / entry / 100) * 100;
        if (maxLots >= 100) { shares = maxLots; cost = shares * entry; note = 'capitalLimit'; }
      }
      var R = perShare;
      /* ค่าคอมฯ ต่อขา = max(มูลค่า × %, ขั้นต่ำ/วัน) — โบรกไทยส่วนใหญ่คิดขั้นต่ำ ~50 บาท/วัน
         ประมาณขาขายจากมูลค่าซื้อ (ราคาปิดไม้จริงต่างออกไปได้เล็กน้อย) */
      var buyComm = Math.max(cost * comm, commMin), sellComm = Math.max(cost * comm, commMin), totalComm = buyComm + sellComm;
      var breakeven = shares > 0 ? entry + totalComm / shares : entry;
      var commPct = cost > 0 ? totalComm / cost * 100 : 0, minKicksIn = cost * comm < commMin;
      var rr = isFinite(o.resistance) && o.resistance > entry ? (o.resistance - entry) / R : NaN;
      return { shares: shares, lots: shares / 100, cost: cost, riskBaht: shares * perShare, tp1: entry + R, tp2: entry + 2 * R, tp3: entry + 3 * R, breakeven: breakeven, commBaht: totalComm, commPct: commPct, minKicksIn: minKicksIn, rr: rr, riskBudget: riskBudget, note: note };
    },
    /* หุ้นนอก: หุ้นเดี่ยว USD */
    us: function (o) {
      var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop, comm = o.comm / 100;
      var perShare = entry - stop;
      if (!(perShare > 0)) return { error: 'stopMustBeLower' };
      var riskBudget = capital * riskPct / 100;
      var shares = Math.floor(riskBudget / perShare), note = '';
      if (shares < 1) { shares = 1; note = 'minShare'; }
      var cost = shares * entry;
      if (cost > capital) {
        var maxShares = Math.floor(capital / entry);
        if (maxShares >= 1) { shares = maxShares; cost = shares * entry; note = 'capitalLimit'; }
      }
      var R = perShare, breakeven = entry * (1 + comm) / (1 - comm);
      var rr = isFinite(o.resistance) && o.resistance > entry ? (o.resistance - entry) / R : NaN;
      return { shares: shares, cost: cost, riskUsd: shares * perShare, tp1: entry + R, tp2: entry + 2 * R, tp3: entry + 3 * R, breakeven: breakeven, rr: rr, riskBudget: riskBudget, note: note };
    },
    /* Bitcoin: เศษส่วน ไม่ floor */
    btc: function (o) {
      var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop, comm = o.comm / 100;
      var perUnit = entry - stop;
      if (!(perUnit > 0)) return { error: 'stopMustBeLower' };
      var riskBudget = capital * riskPct / 100;
      var qty = riskBudget / perUnit, note = '';
      var cost = qty * entry;
      if (cost > capital) {
        var maxQty = capital / entry;
        if (maxQty > 0) { qty = maxQty; cost = qty * entry; note = 'capitalLimit'; }
      }
      var R = perUnit, breakeven = entry * (1 + comm) / (1 - comm);
      var rr = isFinite(o.resistance) && o.resistance > entry ? (o.resistance - entry) / R : NaN;
      return { qty: qty, cost: cost, riskUsd: qty * perUnit, tp1: entry + R, tp2: entry + 2 * R, tp3: entry + 3 * R, breakeven: breakeven, rr: rr, riskBudget: riskBudget, note: note };
    },
    /* ทอง: คำนวณเงินเป็นบาท/บาททองคำ แต่ RR ยืม "ระยะห่าง %" จากฝั่ง USD/ออนซ์ */
    gold: function (o) {
      var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop;
      var perUnit = entry - stop;
      if (!(perUnit > 0)) return { error: 'stopMustBeLower' };
      var riskBudget = capital * riskPct / 100;
      var qty = riskBudget / perUnit, note = '';
      var cost = qty * entry;
      if (cost > capital) {
        var maxQty = capital / entry;
        if (maxQty > 0) { qty = maxQty; cost = qty * entry; note = 'capitalLimit'; }
      }
      var rr = NaN;
      if (isFinite(o.usdPrice) && o.usdPrice > 0 && isFinite(o.usdResistance) && o.usdResistance > o.usdPrice) {
        var stopPct = perUnit / entry;
        var approxUsdStop = o.usdPrice * (1 - stopPct);
        if (approxUsdStop < o.usdPrice) rr = (o.usdResistance - o.usdPrice) / (o.usdPrice - approxUsdStop);
      }
      return { qty: qty, cost: cost, riskBaht: qty * perUnit, rr: rr, riskBudget: riskBudget, note: note };
    },
    /* ค่าเงิน/วัตถุดิบ: หน่วยของสินทรัพย์ที่เลือก */
    markets: function (o) {
      var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop;
      var perUnit = entry - stop;
      if (!(perUnit > 0)) return { error: 'stopMustBeLower' };
      var riskBudget = capital * riskPct / 100;
      var qty = riskBudget / perUnit, note = '';
      var cost = qty * entry;
      if (cost > capital) {
        var maxQty = capital / entry;
        if (maxQty > 0) { qty = maxQty; cost = qty * entry; note = 'capitalLimit'; }
      }
      var rr = (isFinite(o.resistance) && o.resistance > entry) ? (o.resistance - entry) / perUnit : NaN;
      return { qty: qty, cost: cost, riskAmt: qty * perUnit, rr: rr, riskBudget: riskBudget, note: note };
    }
  };

  /* ═══ เช็กลิสต์ก่อนซื้อ — คืน [{ok: true|false|null, code, vars}]
     ctx = { a: ผลของ analyzeSeries | null, entry, stop, riskPct, answer: 'yes'|'no'|null (คำถามเลเวอเรจ/ซื้อด้วยเงินสด) }
     code: trendUp|trendDn (vars.adx = ค่า ADX หรือ NaN, vars.adxStrong) · noChase|chasing · trendNeedData ·
           rsiOk|rsiHot (vars.v) · rsiNeedData · stopSet|stopUnset · riskOk|riskHigh (vars.v) · rrOk|rrLow (vars.v)|rrNeedData ·
           leverageYes|leverageNo|leverageUnknown (btc/markets) · spotYes|spotNo|spotUnknown (gold) ═══ */
  function chkCommon(ctx, maxRisk, rrMode) {
    var a = ctx.a, det = (a && a.det) ? a.det : {};
    var entry = ctx.entry, stop = ctx.stop, riskPct = ctx.riskPct;
    var checks = [];
    if (a && isFinite(det.ema20)) {
      var up = isFinite(det.ema50) ? a.price >= det.ema50 : a.price >= det.ema20;
      checks.push({ ok: up, code: up ? 'trendUp' : 'trendDn', vars: { adx: isFinite(det.adx) ? det.adx : NaN, adxStrong: isFinite(det.adx) ? det.adx >= 20 : null } });
      var over = (a.price - det.ema20) / det.ema20, notChase = over <= 0.05;
      checks.push({ ok: notChase, code: notChase ? 'noChase' : 'chasing', vars: {} });
    } else {
      checks.push({ ok: null, code: 'trendNeedData', vars: {} });
    }
    if (a && isFinite(det.rsi)) checks.push({ ok: det.rsi < 70, code: det.rsi < 70 ? 'rsiOk' : 'rsiHot', vars: { v: det.rsi.toFixed(0) } });
    else checks.push({ ok: null, code: 'rsiNeedData', vars: {} });
    var stopOk = isFinite(entry) && isFinite(stop) && stop < entry;
    checks.push({ ok: stopOk, code: stopOk ? 'stopSet' : 'stopUnset', vars: {} });
    var riskOk = isFinite(riskPct) && riskPct <= maxRisk;
    checks.push({ ok: riskOk, code: riskOk ? 'riskOk' : 'riskHigh', vars: { v: riskOk ? riskPct : (isFinite(riskPct) ? riskPct + '%' : '-') } });
    if (rrMode === 'usd') {
      /* ทอง: RR ยืมระยะห่าง % ของราคาบาทมาใช้กับราคาทองโลก USD */
      if (a && stopOk && isFinite(a.resistance) && a.resistance > a.price && isFinite(a.price) && a.price > 0) {
        var stopPct = (entry - stop) / entry;
        var approxUsdStop = a.price * (1 - stopPct);
        var rrU = approxUsdStop < a.price ? (a.resistance - a.price) / (a.price - approxUsdStop) : NaN;
        if (isFinite(rrU)) {
          var rrOkU = rrU >= 2;
          checks.push({ ok: rrOkU, code: rrOkU ? 'rrOk' : 'rrLow', vars: { v: rrU.toFixed(1) } });
        } else checks.push({ ok: null, code: 'rrNeedData', vars: {} });
      } else checks.push({ ok: null, code: 'rrNeedData', vars: {} });
    } else if (a && isFinite(a.resistance) && stopOk && a.resistance > entry) {
      var rr = (a.resistance - entry) / (entry - stop), rrOk = rr >= 2;
      checks.push({ ok: rrOk, code: rrOk ? 'rrOk' : 'rrLow', vars: { v: rr.toFixed(1) } });
    } else {
      checks.push({ ok: null, code: 'rrNeedData', vars: {} });
    }
    return checks;
  }
  function yesNo(ans, base) {
    return { ok: ans === 'yes' ? true : ans === 'no' ? false : null, code: base + (ans === 'yes' ? 'Yes' : ans === 'no' ? 'No' : 'Unknown'), vars: {} };
  }
  var checklist = {
    th: function (ctx) { return chkCommon(ctx, 2, 'plain'); },
    us: function (ctx) { return chkCommon(ctx, 2, 'plain'); },
    btc: function (ctx) { var c = chkCommon(ctx, 1, 'plain'); c.push(yesNo(ctx.answer, 'leverage')); return c; },
    gold: function (ctx) { var c = chkCommon(ctx, 2, 'usd'); c.push(yesNo(ctx.answer, 'spot')); return c; },
    markets: function (ctx) { var c = chkCommon(ctx, 2, 'plain'); c.push(yesNo(ctx.answer, 'leverage')); return c; }
  };
  /* สรุปเช็กลิสต์: fail > 0 → 'fail' · unknown > 0 → 'unknown' · ไม่งั้น 'go' */
  function checklistVerdict(checks) {
    var fails = checks.filter(function (c) { return c.ok === false; }).length;
    var unknowns = checks.filter(function (c) { return c.ok === null; }).length;
    return { fails: fails, unknowns: unknowns, verdict: fails > 0 ? 'fail' : unknowns > 0 ? 'unknown' : 'go' };
  }

  /* ═══ DCA ═══ */
  /* ทอง/Bitcoin: ซื้อทุกเดือนด้วยเงินเท่ากัน ราคาโตตามอัตราต่อปีที่สมมติ (qty = weight เหมือนกัน แค่ชื่อต่างตามหน้าเดิม) */
  function simulateDCA(pmt, startPrice, annualPct, months) {
    var rm = annualPct / 100 / 12, price = startPrice, qty = 0, contrib = 0, series = [];
    for (var i = 0; i < months; i++) {
      price = price * (1 + rm);
      var q = pmt / price;
      qty += q; contrib += pmt;
      series.push({ month: i + 1, price: price, qty: qty, weight: qty, value: qty * price, contrib: contrib });
    }
    return { qty: qty, weight: qty, price: price, value: qty * price, contrib: contrib, series: series };
  }
  /* กองทุน: จำลอง DCA เดือนต่อเดือน (annualNetPct = ผลตอบแทนสุทธิต่อปี) — ปันผลจ่ายออกสะสมใน cash */
  function simulateFund(pmt, annualNetPct, months, divYieldPct) {
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
  function fundPlan(o) {
    var months = Math.round(o.years * 12);
    var netAcc = o.cagr - o.fee;                 /* สะสมมูลค่า: ทบต้นเต็ม */
    var netDivPrice = o.cagr - o.fee - o.dy;     /* ปันผล: ราคาโตช้าลงเพราะจ่ายปันผลออก */
    var acc = simulateFund(o.accM, netAcc, months, 0);
    var div = simulateFund(o.divM, netDivPrice, months, o.dy);
    var contribAcc = o.accM * months, contribDiv = o.divM * months;
    return {
      months: months, acc: acc, div: div,
      contribAcc: contribAcc, contribDiv: contribDiv,
      contribTotal: contribAcc + contribDiv,
      valueTotal: acc.balance + div.balance,
      divCash: div.cash
    };
  }
  /* เติมไม้ตอนย่อ (ดัชนี) — ย่อ ≥10/20/30% เติม 1.25/1.5/2 เท่า */
  var DRAWDOWN_TIERS = [{ dd: 10, x: 1.25 }, { dd: 20, x: 1.5 }, { dd: 30, x: 2 }];
  function drawdown(now, ath) {
    if (!isFinite(now) || !isFinite(ath) || ath <= 0) return null;
    var dd = (1 - now / ath) * 100, mult = 1, tier = null;
    DRAWDOWN_TIERS.forEach(function (t) { if (dd >= t.dd) { mult = t.x; tier = t; } });
    return { dd: dd, mult: mult, tier: tier, zone: dd < 1 ? 'nearAth' : dd < 10 ? 'normal' : 'tier' };
  }

  /* ═══ กองทุนไทย: วันพร้อมขาย ═══
     ปีถือครองขั้นต่ำเพื่อขายได้โดยไม่เสียสิทธิลดหย่อน — ย้ายมาจาก invest-thai-fund.js เดิม (ตารางเดียวกัน ไม่เปลี่ยนค่า):
       SSF: ถือครบ 10 ปีนับจากวันซื้อ · RMF: ครบ 5 ปี และอายุ ≥ 55 ปี · ThaiESG: ซื้อปี 2567–2569 ถือ 5 ปี, ซื้อปี 2570–2575 ถือ 8 ปี
     (ตัวเลขนับจากปี ค.ศ.ของวันซื้อครั้งแรก; นอกช่วงที่ทราบใช้เกณฑ์ล่าสุด — เกณฑ์จริงอาจเปลี่ยน ให้ตรวจกับประกาศ ก.ล.ต./กรมสรรพากรก่อนขาย)
     ตัวเลขเพดานลดหย่อน/ขั้นภาษีไม่อยู่ที่นี่ — อ่านจาก tax-rules/*.json ผ่าน TaxCalc เท่านั้น */
  var HOLD_RULES = {
    ssf: { holdYears: 10 },
    rmf: { holdYears: 5, minAge: 55 },
    esg: [{ from: 2024, to: 2026, holdYears: 5 }, { from: 2027, to: 2032, holdYears: 8 }]
  };
  function esgHoldRule(year) {
    var R = HOLD_RULES.esg;
    for (var i = 0; i < R.length; i++) { if (year >= R[i].from && year <= R[i].to) return R[i]; }
    return R[R.length - 1];
  }
  /* purchases = [{ts}] ของหมวดนั้น → {readyYear, needsBirthYear?, noteCode, firstYear, holdYears} หรือ null */
  function eligibilityFor(cat, purchases, birthYear) {
    if (!purchases.length) return null;
    var ps = purchases.slice().sort(function (a, b) { return a.ts - b.ts; });
    var firstYear = new Date(ps[0].ts).getFullYear();
    if (cat === 'ssf') return { readyYear: firstYear + HOLD_RULES.ssf.holdYears, noteCode: 'ssf', firstYear: firstYear, holdYears: HOLD_RULES.ssf.holdYears };
    if (cat === 'esg') {
      var rule = esgHoldRule(firstYear);
      return { readyYear: firstYear + rule.holdYears, noteCode: 'esg', firstYear: firstYear, holdYears: rule.holdYears };
    }
    if (cat === 'rmf') {
      var yearCond = firstYear + HOLD_RULES.rmf.holdYears;
      var ageCond = birthYear ? (birthYear + HOLD_RULES.rmf.minAge) : null;
      return { readyYear: ageCond ? Math.max(yearCond, ageCond) : yearCond, needsBirthYear: !ageCond, noteCode: 'rmf', firstYear: firstYear, holdYears: HOLD_RULES.rmf.holdYears };
    }
    return null;
  }

  /* ═══ พันธบัตร ═══ */
  function bondPV(couponPerPeriod, face, nPeriods, ratePerPeriod) {
    var pv = 0, i;
    for (i = 1; i <= nPeriods; i++) {
      pv += couponPerPeriod / Math.pow(1 + ratePerPeriod, i);
    }
    pv += face / Math.pow(1 + ratePerPeriod, nPeriods);
    return pv;
  }
  /* ผลตอบแทนแท้จริงจนครบกำหนด (YTM) ด้วย bisection — % ต่อปีแบบ nominal */
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
  /* บวกเดือนแบบกันวันที่ overflow (31 ม.ค. + 1 เดือน = สิ้นเดือน ก.พ.) */
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
  /* คีย์วันที่แบบ local (ไม่ใช้ toISOString เพราะเลื่อนวันได้ถ้า timezone ไม่ใช่ UTC) */
  function ymd(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  /* วันที่แบบไทยย่อ สำหรับแสดงผล (ตามที่หน้าเดิมใช้) */
  function fmtThaiDate(d) { return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); }

  /* ตารางจ่ายดอกเบี้ยตั้งแต่วันซื้อจนครบกำหนด — งวดสุดท้ายรวมเงินต้นคืนเสมอ */
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
  /* เทียบกับเงินฝากประจำ (ภาษีหัก ณ ที่จ่าย 15%) */
  function compareDeposit(principal, years, bondAnnualCoupon, depositRatePct) {
    var bondGross = bondAnnualCoupon * years;
    var bondAfterTax = bondGross * (1 - 0.15);
    var depGross = principal * (depositRatePct / 100) * years;
    var depAfterTax = depGross * (1 - 0.15);
    return { principal: principal, years: years, bondGross: bondGross, bondAfterTax: bondAfterTax, depGross: depGross, depAfterTax: depAfterTax };
  }

  /* ═══ สลากออมสิน/ธ.ก.ส. ═══ */
  function parseDrawDays(s) { return (s || '16').split(',').map(function (x) { return +x; }).filter(function (n) { return n >= 1 && n <= 31; }); }
  /* ตารางวันจับรางวัลตามวัน-ที่-ในเดือน — เดินทีละเดือนบน "วันที่ 1" เสมอ (กัน clamp สะสมเมื่อวันที่ 31 ผ่านเดือนสั้น) */
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
      anchor = addMonths(anchor, 1);
      guard++;
    }
    rows.sort(function (a, b) { return a.date - b.date; });
    return rows;
  }
  /* ค่าคาดหวัง (EV) จากตารางระดับรางวัลหลายชั้น — สมมติแต่ละระดับ/หน่วยเป็นอิสระต่อกัน */
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
  /* ผลตอบแทนรวมที่คาดหวัง: เงินต้นคืนเต็ม + ดอกเบี้ยรับประกัน + เงินรางวัลคาดหวัง (ภาษีตาม toggle) */
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
  /* อัตราผลตอบแทนคาดหวัง/ปี — เฉลี่ยแบบเส้นตรง (เงินต้นคงที่ ไม่มีการทบต้น) */
  function annualizedExpectedReturnPct(totalNetGain, principal, years) {
    if (!(principal > 0) || !(years > 0)) return NaN;
    return (totalNetGain / principal / years) * 100;
  }
  /* เทียบกับเงินฝากประจำ (เงินฝากหักภาษี 15% เสมอ ต่างจากฝั่งสลากที่ผูกกับ toggle) */
  function compareLotteryVsDeposit(principal, years, expectedResult, depositRatePct) {
    var lotteryGainNet = expectedResult.totalNet - principal;
    var depGross = principal * (depositRatePct / 100) * years;
    var depAfterTax = depGross * (1 - 0.15);
    return { principal: principal, years: years, lotteryGainNet: lotteryGainNet, depGross: depGross, depAfterTax: depAfterTax };
  }

  /* ═══ สลากกินแบ่งรัฐบาล (ผลย้อนหลังจาก thai-lotto-archive) ═══ */
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
  /* ข้อยกเว้นเฉพาะกิจในอดีต (ข้อเท็จจริงที่ไม่เปลี่ยนแล้ว; ไม่รับประกันครบ — ระบบทนได้เองผ่าน 404 = ข้าม) */
  var DATE_OVERRIDES = {
    '2015-06-01': '2015-06-02', '2015-12-16': '2015-12-17',
    '2018-03-01': '2018-03-02', '2019-07-16': '2019-07-15',
    '2020-04-01': null, /* งดจับรางวัล เม.ย. 2563 (โควิด) ไม่มีวันทดแทน */
    '2022-02-16': '2022-02-17', '2024-12-30': '2025-01-02'
  };
  /* สร้าง "ผู้สมัคร" วันออกรางวัลหลายวันรอบจุดเสี่ยง (ม.ค./พ.ค./ปลาย ธ.ค.) แล้วให้ fetch จริง (404 = ไม่มีงวด) ตัดสิน */
  function candidateDrawDates(fromDate, toDate) {
    var out = [], anchor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1), guard = 0;
    while (anchor <= toDate && guard < 3000) {
      var y = anchor.getFullYear(), m = anchor.getMonth();
      out.push(new Date(y, m, 1));
      out.push(new Date(y, m, 16));
      if (m === 0) { out.push(new Date(y, 0, 2)); out.push(new Date(y, 0, 17)); }
      if (m === 4) out.push(new Date(y, 4, 2));
      if (m === 11) { out.push(new Date(y, 11, 30)); out.push(new Date(y, 11, 31)); }
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
  /* เลข 2 ตัว / 3 ตัวหน้า-หลัง: ความถี่ในอดีตเท่านั้น (ไม่ใช่ความน่าจะเป็นในอนาคต) */
  function frequencyTable(draws, field) {
    var counts = {};
    draws.forEach(function (d) {
      var vals = field === 'twoDigit' ? (d.twoDigit ? [d.twoDigit] : []) : (d[field] || []);
      vals.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    });
    return counts;
  }
  /* รางวัลที่ 1/2/3: นับความถี่ "แต่ละหลัก แยกตามตำแหน่ง" แทนเลข 6 หลักเต็ม */
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
  /* ตรวจเลข 6 หลักกับงวด → {ticket, drawDate, hits: [รหัสรางวัล]} หรือ null
     รหัส: first|second|third|nearFirst|fourth|fifth|threeFront|threeBack|twoDigit */
  function checkTicket(ticketRaw, draw) {
    var ticket = (ticketRaw || '').replace(/\D/g, '');
    if (ticket.length !== 6 || !draw) return null;
    var two = ticket.slice(-2), threeFront = ticket.slice(0, 3), threeBack = ticket.slice(-3);
    var hits = [];
    if (draw.first === ticket) hits.push('first');
    if ((draw.second || []).indexOf(ticket) !== -1) hits.push('second');
    if ((draw.third || []).indexOf(ticket) !== -1) hits.push('third');
    if (draw.nearFirst && draw.nearFirst.indexOf(ticket) !== -1) hits.push('nearFirst');
    if (draw.fourth && draw.fourth.indexOf(ticket) !== -1) hits.push('fourth');
    if (draw.fifth && draw.fifth.indexOf(ticket) !== -1) hits.push('fifth');
    if (draw.threeFirst && draw.threeFirst.indexOf(threeFront) !== -1) hits.push('threeFront');
    if (draw.threeLast && draw.threeLast.indexOf(threeBack) !== -1) hits.push('threeBack');
    if (draw.twoDigit === two) hits.push('twoDigit');
    return { ticket: ticket, drawDate: draw.date, hits: hits };
  }

  /* ═══ สมุดเทรดรวม (หัวข้อ 3.3) ═══
     อ่านคีย์เดิม 3 คีย์แล้ว normalize — ไม่เขียนอะไรกลับ
     market: 'th'|'us'|'btc' · key = คีย์ต้นทาง (ตัด tanot:invest: ออก) ให้หน้าลบแถวด้วย ts ในคีย์นั้น */
  var JOURNAL_KEYS = { th: 'thjournal', us: 'globaljournal', btc: 'btcjournal' };
  function journalRows(th, us, btc) {
    var out = [];
    (th || []).forEach(function (r) { out.push({ market: 'th', key: JOURNAL_KEYS.th, ts: r.ts, sym: r.sym || '', entry: r.en, exit: r.ex, qty: r.sh, pl: r.pl, ccy: 'THB' }); });
    (us || []).forEach(function (r) { out.push({ market: 'us', key: JOURNAL_KEYS.us, ts: r.ts, sym: r.sym || '', entry: r.en, exit: r.ex, qty: r.sh, pl: r.pl, ccy: 'USD' }); });
    (btc || []).forEach(function (r) { out.push({ market: 'btc', key: JOURNAL_KEYS.btc, ts: r.ts, sym: r.sym || 'BTC', entry: r.en, exit: r.ex, qty: r.qty, pl: r.pl, ccy: 'USD' }); });
    return out;
  }
  /* สถิติ (สูตรเดิมของ renderJournal): ชนะ = pl > 0, expectancy = ชนะ% × กำไรเฉลี่ย − แพ้% × ขาดทุนเฉลี่ย */
  function journalStats(rows) {
    var n = rows.length;
    if (!n) return { n: 0, wins: 0, losses: 0, winRate: 0, total: 0, avgWin: 0, avgLoss: 0, expectancy: 0 };
    var wins = rows.filter(function (r) { return r.pl > 0; }), losses = rows.filter(function (r) { return r.pl <= 0; });
    var total = rows.reduce(function (s, r) { return s + r.pl; }, 0);
    var winRate = wins.length / n * 100;
    var avgWin = wins.length ? wins.reduce(function (s, r) { return s + r.pl; }, 0) / wins.length : 0;
    var avgLoss = losses.length ? Math.abs(losses.reduce(function (s, r) { return s + r.pl; }, 0) / losses.length) : 0;
    var expectancy = (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss;
    return { n: n, wins: wins.length, losses: losses.length, winRate: winRate, total: total, avgWin: avgWin, avgLoss: avgLoss, expectancy: expectancy };
  }

  /* ═══ มูลค่าสินทรัพย์ลงทุน (หัวข้อ 6) ═══ */
  /* เวลาไทย (UTC+7) เสมอ ไม่ใช่เวลาเครื่อง/UTC → 'YYYY-MM-DD' */
  function thaiDate(ms) { return new Date(ms + 7 * 3600000).toISOString().slice(0, 10); }

  /* ลำดับคงที่ = ลำดับสีกราฟ --ome-chart-1..8 */
  var CLASSES = ['stockTh', 'stockUs', 'crypto', 'gold', 'fundTh', 'fundGlobal', 'bond', 'savingsLottery'];
  /* กรัม → บาททองคำ: ทองแท่ง 15.244 · ทองรูปพรรณ 15.16 */
  var GRAM_PER_BAHT = { bar: 15.244, jewelry: 15.16 };
  var STALE_MS = 3 * 86400000;
  /* ป้ายชื่อประเภท/แถวสำหรับหน้าที่แสดงมูลค่าสินทรัพย์ (หน้าวันนี้ + หน้าภาพรวม) — ใช้ร่วมกันที่เดียว */
  var CLASS_LABELS = {
    th: { stockTh: 'หุ้นไทย', stockUs: 'หุ้นต่างประเทศ', crypto: 'คริปโต', gold: 'ทอง', fundTh: 'กองทุนไทย', fundGlobal: 'กองทุนต่างประเทศ', bond: 'พันธบัตร', savingsLottery: 'สลากออมสิน/ธ.ก.ส.', bar: 'ทองแท่ง', jewelry: 'ทองรูปพรรณ' },
    en: { stockTh: 'Thai stocks', stockUs: 'Global stocks', crypto: 'Crypto', gold: 'Gold', fundTh: 'Thai funds', fundGlobal: 'Global funds', bond: 'Gov. bonds', savingsLottery: 'Savings lottery', bar: 'Gold bar', jewelry: 'Gold jewelry' }
  };
  function classLabel(cls, lang) { return (CLASS_LABELS[lang] || CLASS_LABELS.th)[cls] || cls; }
  /* ชื่อแถวที่แสดง: หุ้น = ชื่อย่อ · ทอง = ทองแท่ง/รูปพรรณ · BTC · กองทุนต่างประเทศ = S&P 500 + ชนิด · อื่นๆ = ชื่อที่ผู้ใช้ตั้ง */
  function rowLabel(r, lang) {
    if (r.cls === 'gold') return classLabel(r.key, lang);
    if (r.cls === 'crypto') return 'Bitcoin';
    if (r.cls === 'fundGlobal') return 'S&P 500 · ' + r.key;
    return r.label || r.key || classLabel(r.cls, lang);
  }
  var P = 'tanot:invest:';

  /* คีย์ series cache ตามสัญลักษณ์ Yahoo (หัวข้อ 3.5 — คงชื่อเดิมทุกตัว) */
  function seriesKey(sym) {
    if (/\.BK$/i.test(sym)) return P + 'cache:' + sym.replace(/\.BK$/i, '');
    if (sym === 'BTC-USD') return P + 'cache:btc:BTC-USD';
    if (sym === 'GC=F') return P + 'cache:gold:GC=F';
    if (/=F$|=X$|^\^|^DX-Y\.NYB$/.test(sym)) return P + 'cache:comm:s:' + sym;
    return P + 'cache:us:' + sym;
  }
  function quoteKey(sym) { return P + 'cache:q:' + sym; }
  var FX_KEY = P + 'fxcache';
  var GOLD_TH_KEY = P + 'cache:gold:th';
  var NAV_KEY = P + 'nav';

  function numOr(v, d) { return isFinite(v) ? +v : d; }
  function groupBy(arr, keyFn) {
    var m = {}, order = [];
    (arr || []).forEach(function (r) { var k = keyFn(r); if (!m[k]) { m[k] = []; order.push(k); } m[k].push(r); });
    return order.map(function (k) { return { key: k, rows: m[k] }; });
  }
  function yahooSyms(data) {
    var out = [];
    (data.thstock || []).forEach(function (r) { if (r && r.sym) out.push(r.sym + '.BK'); });
    (data.globalstock || []).forEach(function (r) { if (r && r.sym) out.push(r.sym); });
    if ((data.btc || []).length) out.push('BTC-USD');
    var seen = {};
    return out.filter(function (s) { if (seen[s]) return false; seen[s] = 1; return true; });
  }
  /* อ่านราคาจากแคช — ไม่ยิงเน็ต · read(key) คืนค่าที่ parse แล้วหรือ null
     คืน { quotes: {yahooSym: {price, ts, src:'market'}}, thaiGold, nav, fx (อัตรา|null), fxTs } */
  function collectPrices(read, data) {
    var quotes = {};
    yahooSyms(data).concat(['THB=X']).forEach(function (sym) {
      var best = null, q = read(quoteKey(sym)), s = read(seriesKey(sym));
      if (q && isFinite(q.price) && isFinite(q.ts)) best = { price: +q.price, ts: +q.ts };
      if (s && s.c && s.c.length && isFinite(s.c[s.c.length - 1]) && isFinite(s.ts) && (!best || +s.ts > best.ts)) best = { price: +s.c[s.c.length - 1], ts: +s.ts };
      if (best) quotes[sym] = { price: best.price, ts: best.ts, src: 'market' };
    });
    var fxc = read(FX_KEY), fx = null, fxTs = null;
    if (fxc && isFinite(fxc.rate) && fxc.rate > 0) { fx = +fxc.rate; fxTs = numOr(fxc.ts, 0); }
    if (quotes['THB=X'] && quotes['THB=X'].price > 0 && (fx == null || quotes['THB=X'].ts > fxTs)) { fx = quotes['THB=X'].price; fxTs = quotes['THB=X'].ts; }
    var th = read(GOLD_TH_KEY);
    return { quotes: quotes, thaiGold: (th && typeof th === 'object') ? th : null, nav: read(NAV_KEY) || {}, fx: fx, fxTs: fxTs };
  }

  /* คำนวณมูลค่า — data = { thstock, globalstock, btc, gold, thaifund, spfund, govbond, gsblottery, baaclottery } (อาร์เรย์ดิบของผู้ใช้)
     prices = collectPrices(...) · fx = อัตรา USD→THB หรือ null (ไม่มี = แถว USD ไม่นับรวมยอดบาท ห้ามเดา) */
  function netWorth(data, prices, fx, now) {
    var today = thaiDate(now), rows = [];
    prices = prices || {}; var quotes = prices.quotes || {}, nav = prices.nav || {};
    var fxOk = isFinite(fx) && fx > 0;
    function px(sym, group) {
      /* ราคาตลาดจากแคช → cur ของแถวล่าสุดที่มี → ต้นทุนเฉลี่ย */
      var q = quotes[sym];
      if (q) return { price: q.price, src: 'market', priceTs: q.ts, stale: now - q.ts > STALE_MS };
      var withCur = group.filter(function (r) { return isFinite(r.cur) && r.cur !== '' && r.cur !== null; }).sort(function (a, b) { return numOr(b.ts, 0) - numOr(a.ts, 0); })[0];
      if (withCur) return { price: +withCur.cur, src: 'manual', priceTs: null, stale: false };
      return null;
    }
    function stockRows(cls, list, suffix, ccy, link) {
      groupBy(list, function (r) { return r.sym; }).forEach(function (g) {
        var qty = 0, cost = 0;
        g.rows.forEach(function (r) { qty += numOr(r.shares, 0); cost += numOr(r.shares, 0) * numOr(r.cost, 0); });
        if (!(qty > 0)) return;
        var p = px(g.key + suffix, g.rows);
        var price = p ? p.price : cost / qty;
        rows.push({ cls: cls, key: g.key, label: g.key, qty: qty, costCcy: cost, valueCcy: qty * price, ccy: ccy,
          src: p ? p.src : 'cost', priceTs: p ? p.priceTs : null, stale: p ? p.stale : false, price: price, href: link });
      });
    }
    stockRows('stockTh', data.thstock, '.BK', 'THB', 'invest-stock.html#th');
    stockRows('stockUs', data.globalstock, '', 'USD', 'invest-stock.html#us');

    var btc = data.btc || [];
    if (btc.length) {
      var bq = 0, bc = 0;
      btc.forEach(function (r) { bq += numOr(r.qty, 0); bc += numOr(r.qty, 0) * numOr(r.cost, 0); });
      if (bq > 0) {
        var bp = px('BTC-USD', btc), bprice = bp ? bp.price : bc / bq;
        rows.push({ cls: 'crypto', key: 'BTC', label: 'BTC', qty: bq, costCcy: bc, valueCcy: bq * bprice, ccy: 'USD',
          src: bp ? bp.src : 'cost', priceTs: bp ? bp.priceTs : null, stale: bp ? bp.stale : false, price: bprice, href: 'invest-bitcoin.html' });
      }
    }

    /* ทอง: แยก type · น้ำหนักเป็นบาททองคำ (unit gram → หารด้วยกรัม/บาทตามชนิด) */
    var th = prices.thaiGold || null;
    groupBy(data.gold, function (r) { return r.type === 'jewelry' ? 'jewelry' : 'bar'; }).forEach(function (g) {
      var baht = 0, cost = 0;
      g.rows.forEach(function (r) {
        var w = numOr(r.weight, 0);
        baht += r.unit === 'gram' ? w / GRAM_PER_BAHT[g.key] : w;
        cost += numOr(r.amt, 0);
      });
      if (!(baht > 0)) return;
      var field = g.key === 'jewelry' ? 'jewelrySellPrice' : 'barSellPrice';
      var ok = th && isFinite(th[field]) && th[field] > 0, ts = ok && isFinite(th.ts) ? +th.ts : null;
      rows.push({ cls: 'gold', key: g.key, label: g.key, qty: baht, costCcy: cost, valueCcy: ok ? baht * th[field] : cost, ccy: 'THB',
        src: ok ? 'market' : 'cost', priceTs: ts, stale: ok && ts != null ? now - ts > STALE_MS : false, price: ok ? th[field] : (cost / baht), href: 'invest-gold.html#gold' });
    });

    function fundRows(cls, list, field, navPrefix, link) {
      groupBy(list, function (r) { return r[field]; }).forEach(function (g) {
        var units = 0, cost = 0;
        g.rows.forEach(function (r) { units += numOr(r.units, 0); cost += numOr(r.amt, 0); });
        var n = nav[navPrefix + g.key], hasNav = n && isFinite(n.nav) && n.nav > 0 && units > 0;
        rows.push({ cls: cls, key: g.key, label: g.key, qty: units, costCcy: cost, valueCcy: hasNav ? units * n.nav : cost, ccy: 'THB',
          src: hasNav ? 'manual' : 'cost', priceTs: hasNav ? numOr(n.ts, null) : null, stale: false, price: hasNav ? n.nav : null, href: link });
      });
    }
    fundRows('fundTh', data.thaifund, 'fund', 'th:', 'invest-fund.html#th');
    fundRows('fundGlobal', data.spfund, 'cls', 'global:', 'invest-fund.html#global');

    var matured = 0;
    (data.govbond || []).forEach(function (r) {
      if (!r || !r.maturity) return;
      if (r.maturity <= today) { matured++; return; }
      var face = numOr(r.face, 0);
      if (face > 0) rows.push({ cls: 'bond', key: r.name || '', label: r.name || '', qty: 1, costCcy: face, valueCcy: face, ccy: 'THB', src: 'cost', priceTs: null, stale: false, price: face, href: 'invest-gov-bond.html', ts: r.ts });
    });
    [['gsb', data.gsblottery], ['baac', data.baaclottery]].forEach(function (pair) {
      (pair[1] || []).forEach(function (r) {
        if (!r || !r.maturity) return;
        if (r.maturity <= today) { matured++; return; }
        var units = numOr(r.units, 0), cost = numOr(r.unitPrice, 0) * units;
        if (cost > 0) rows.push({ cls: 'savingsLottery', key: r.name || '', label: r.name || '', qty: units, costCcy: cost, valueCcy: cost, ccy: 'THB', src: 'cost', priceTs: null, stale: false, price: numOr(r.unitPrice, null), href: 'invest-lottery.html#' + pair[0], ts: r.ts });
      });
    });

    var byClass = {}, total = 0, cost = 0, n = 0, missingFx = false, stale = false;
    CLASSES.forEach(function (c) { byClass[c] = { value: 0, cost: 0, n: 0 }; });
    rows.forEach(function (r) {
      var f = r.ccy === 'USD' ? (fxOk ? fx : null) : 1;
      r.valueThb = f == null ? null : r.valueCcy * f;
      r.costThb = f == null ? null : r.costCcy * f;
      if (r.stale) stale = true;
      if (f == null) { missingFx = true; return; }
      total += r.valueThb; cost += r.costThb; n++;
      var b = byClass[r.cls]; b.value += r.valueThb; b.cost += r.costThb; b.n++;
    });
    var pl = total - cost;
    return { total: total, cost: cost, pl: pl, plPct: cost > 0 ? pl / cost * 100 : NaN, byClass: byClass, rows: rows, n: n,
      missingFx: missingFx, stale: stale, maturedCount: matured, fx: fxOk ? fx : null, date: today };
  }

  function round2(x) { return Math.round(x * 100) / 100; }
  /* แถว snapshot รายวัน (หัวข้อ 6.5) */
  function snapshotRow(nw, now) {
    var parts = {};
    CLASSES.forEach(function (c) { parts[c] = round2(nw.byClass[c].value); });
    return { d: thaiDate(now), v: round2(nw.total), c: round2(nw.cost), parts: parts, fx: nw.fx, n: nw.n, ts: now };
  }
  /* prev = แถวของวันเดียวกัน (ถ้ามี) — เขียนเมื่อยังไม่มี หรือ มูลค่าเปลี่ยน ≥ 0.1% และห่างจากครั้งก่อน ≥ 1 ชม. · ไม่มีสินทรัพย์ (n = 0) = ไม่เขียน */
  function shouldWriteSnapshot(prev, row, now) {
    if (!row || !(row.n > 0)) return false;
    if (!prev || prev.d !== row.d) return true;
    var base = Math.abs(prev.v);
    var moved = base > 0 ? Math.abs(row.v - prev.v) / base >= 0.001 : row.v !== prev.v;
    return moved && now - numOr(prev.ts, 0) >= 3600000;
  }

  return {
    sma: sma, smaSeries: smaSeries, emaSeries: emaSeries, emaLast: emaLast, rsi: rsi, rsiSeries: rsiSeries, macd: macd,
    bollinger: bollinger, atr: atr, supRes: supRes, adx: adx, psar: psar,
    toSeries: toSeries, daysAgoDates: daysAgoDates, parsePaste: parsePaste, demoData: demoData,
    parseYahoo: parseYahoo, parseQuoteLite: parseQuoteLite, parseHistoricalClose: parseHistoricalClose, parseFxRate: parseFxRate, parseGoldTH: parseGoldTH, parseFng: parseFng,
    analyzeSeries: analyzeSeries, analyzeSimple: analyzeSimple, sellVerdict: sellVerdict,
    riskCalc: riskCalc, checklist: checklist, checklistVerdict: checklistVerdict,
    simulateDCA: simulateDCA, simulateFund: simulateFund, fundPlan: fundPlan, DRAWDOWN_TIERS: DRAWDOWN_TIERS, drawdown: drawdown,
    HOLD_RULES: HOLD_RULES, esgHoldRule: esgHoldRule, eligibilityFor: eligibilityFor,
    bondPV: bondPV, solveYTM: solveYTM, addMonths: addMonths, sameDay: sameDay, parseYMD: parseYMD, ymd: ymd, fmtThaiDate: fmtThaiDate,
    couponSchedule: couponSchedule, compareDeposit: compareDeposit,
    parseDrawDays: parseDrawDays, drawSchedule: drawSchedule, tierProbability: tierProbability, evPerUnitPerDraw: evPerUnitPerDraw,
    probAtLeastOnePerDraw: probAtLeastOnePerDraw, expectedTotalPrize: expectedTotalPrize, guaranteedRedemption: guaranteedRedemption,
    totalExpectedReturn: totalExpectedReturn, annualizedExpectedReturnPct: annualizedExpectedReturnPct, compareLotteryVsDeposit: compareLotteryVsDeposit,
    parseDrawText: parseDrawText, DATE_OVERRIDES: DATE_OVERRIDES, candidateDrawDates: candidateDrawDates, drawsInWindow: drawsInWindow,
    frequencyTable: frequencyTable, digitPositionFrequency: digitPositionFrequency, checkTicket: checkTicket,
    JOURNAL_KEYS: JOURNAL_KEYS, journalRows: journalRows, journalStats: journalStats,
    thaiDate: thaiDate, CLASS_LABELS: CLASS_LABELS, classLabel: classLabel, rowLabel: rowLabel, CLASSES: CLASSES, GRAM_PER_BAHT: GRAM_PER_BAHT, STALE_MS: STALE_MS,
    seriesKey: seriesKey, quoteKey: quoteKey, FX_KEY: FX_KEY, GOLD_TH_KEY: GOLD_TH_KEY, NAV_KEY: NAV_KEY,
    collectPrices: collectPrices, netWorth: netWorth, snapshotRow: snapshotRow, shouldWriteSnapshot: shouldWriteSnapshot
  };
});
