/* ══════════════════════════════════════════════════════════════════
   Tanot — ทองคำ (ราคาวันนี้ + วางแผนออมทอง)
   • ราคาทองไทย (บาท/บาททองคำ) จาก thai-gold-api (community, MIT) best-effort หลายเส้นทาง
   • ไฟจราจร "ถูก/แพงตอนนี้ไหม" ประเมินจากแนวโน้มราคาทองโลก (GC=F) เป็นตัวแทนทิศทาง
   • วางแผนออมทอง (DCA) + เติมไม้ตอนราคาย่อ + สัดส่วนทองในพอร์ต
   • สมุดทองของฉัน (แท่ง/รูปพรรณ, บาททองคำ/กรัม) เก็บใน localStorage + สำรอง Google Drive
   • ปัจจัยที่มีผลต่อราคาทองคำ (ทางตรง/ทางอ้อม) — ตัวเลขสด 2 ตัว (DXY, ดอกเบี้ย 10 ปีสหรัฐฯ) ที่เหลือเป็นความรู้ทั่วไป
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LOG_KEY = 'tanot:invest:gold';
  var GRAM_PER_BAHT = 15.244;
  var lastGoldPlan = { pmt: 3000 };

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function baht(n) { if (!isFinite(n)) return '—'; var neg = n < 0; return (neg ? '−' : '') + '฿' + Math.round(Math.abs(n)).toLocaleString('th-TH'); }
  function toBahtWeight(w, unit) { return unit === 'gram' ? w / GRAM_PER_BAHT : w; }

  /* ── อินดิเคเตอร์ (สูตรมาตรฐาน, ใช้ประเมินแนวโน้มราคาทองโลก GC=F — asset-agnostic) ── */
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

  /* ── วิเคราะห์ (มีซีรีส์เต็ม) → ไฟจราจร ─────────────────────── */
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
    if (score >= 2) { light = 'green'; verdict = 'น่าสนใจ — ราคาทองอยู่ในโซนถูกเทียบแนวโน้ม'; }
    else if (score <= -1) { light = 'red'; verdict = 'ระวัง — ราคาทองแพงเทียบแนวโน้ม'; }
    else { light = 'yellow'; verdict = 'กลางๆ — ยังไม่มีจังหวะเด่น'; }
    var why = (light === 'green' ? pros : light === 'red' ? cons : (pros.concat(cons)))[0] || 'ราคาอยู่กลางกรอบ ยังไม่มีสัญญาณชัด';

    return {
      light: light, verdict: verdict, why: why, pros: pros, cons: cons, score: score,
      price: price, resistance: sr.resistance, uptrend: uptrend, rsi: r, adx: adxV,
      det: { ema20: ema20, ema50: ema50, rsi: r, macdHist: mac ? mac.hist : NaN,
             support: sr.support, resistance: sr.resistance, posRange: posRange, adx: adxV }
    };
  }
  function analyzeSimple(price, hi, lo) {
    var pos = (price - lo) / Math.max(1e-9, hi - lo), pct = Math.round(pos * 100);
    var light, verdict, why;
    if (pos < 0.35) { light = 'green'; verdict = 'น่าสนใจ — ราคาทองอยู่ในโซนถูกเทียบแนวโน้ม'; why = 'ราคาอยู่ค่อนไปทางถูกของรอบ (~' + pct + '% ของช่วง ต่ำ→สูง)'; }
    else if (pos > 0.75) { light = 'red'; verdict = 'ระวัง — ราคาทองแพงเทียบแนวโน้ม'; why = 'ราคาอยู่ค่อนไปทางแพงของรอบ (~' + pct + '% ของช่วง ต่ำ→สูง)'; }
    else { light = 'yellow'; verdict = 'กลางๆ — ยังไม่มีจังหวะเด่น'; why = 'ราคาอยู่กลางกรอบ (~' + pct + '% ของช่วง ต่ำ→สูง)'; }
    return { light: light, verdict: verdict, why: why, pros: [], cons: [], price: price, resistance: hi, det: { posRange: pos, support: lo, resistance: hi }, simple: true };
  }

  /* ── สร้างชุดข้อมูลจาก Yahoo (ใช้ GC=F เป็นตัวแทนราคาทองโลก) ── */
  function daysAgoDates(n) {
    var out = [], d = new Date(); d.setHours(0, 0, 0, 0);
    for (var i = n - 1; i >= 0; i--) { var x = new Date(d); x.setDate(d.getDate() - i); out.push(x.toISOString().slice(0, 10)); }
    return out;
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
  function cacheKey(sym) { return 'tanot:invest:cache:gold:' + sym; }
  function saveCache(sym, s) {
    try {
      var o = { ts: Date.now(), t: s.times, o: s.ohlc.map(function (b) { return b.open; }), h: s.highs, l: s.lows, c: s.closes };
      localStorage.setItem(cacheKey(sym), JSON.stringify(o));
    } catch (e) {}
  }
  function loadCache(sym) {
    try {
      var o = JSON.parse(localStorage.getItem(cacheKey(sym)));
      if (!o || !o.c || o.c.length < 5) return null;
      var s = toSeries(o.t, o.o, o.h, o.l, o.c); s.cachedAt = o.ts; return s;
    } catch (e) { return null; }
  }
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

  /* ── ราคาทองไทย (thai-gold-api community project, MIT) ────────── */
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
  function fetchGoldTH() {
    var base = 'https://api.chnwt.dev/thai-gold-api/latest', enc = encodeURIComponent(base);
    var tries = [
      { url: base },
      { url: 'https://api.allorigins.win/raw?url=' + enc },
      { url: 'https://corsproxy.io/?url=' + enc },
      { url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { url: 'https://thingproxy.freeboard.io/fetch/' + base }
    ];
    var i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('all failed'));
      return fetchOne(tries[i++].url, 7000, parseGoldTH).catch(next);
    }
    return next();
  }
  function goldThCacheKey() { return 'tanot:invest:cache:gold:th'; }
  function saveGoldThCache(o) { try { var c = {}; for (var k in o) c[k] = o[k]; c.ts = Date.now(); localStorage.setItem(goldThCacheKey(), JSON.stringify(c)); } catch (e) {} }
  function loadGoldThCache() { try { var o = JSON.parse(localStorage.getItem(goldThCacheKey())); return (o && isFinite(o.barBuyPrice)) ? o : null; } catch (e) { return null; } }

  function setGoldThStatus(msg, cls) { var el = $('goldThStatus'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }
  function fillGoldThFields(o) {
    $('barBuy').value = o.barBuyPrice.toFixed(2);
    $('barSell').value = o.barSellPrice.toFixed(2);
    $('jewelryBuy').value = o.jewelryBuyPrice.toFixed(2);
    $('jewelrySell').value = o.jewelrySellPrice.toFixed(2);
    if (!$('dcaStart').value) $('dcaStart').value = o.barBuyPrice.toFixed(2);
    if (!$('gdNow').value) $('gdNow').value = o.barBuyPrice.toFixed(2);
    if ($('dcaOut').style.display === 'none') doDCA();
  }
  function runThaiFetch() {
    setGoldThStatus('กำลังดึงราคาทองวันนี้…');
    $('goldThBadge').style.display = 'none';
    fetchGoldTH().then(function (o) {
      saveGoldThCache(o);
      fillGoldThFields(o);
      var badge = $('goldThBadge'); badge.style.display = 'inline-block'; badge.className = 'src-badge real';
      badge.textContent = '🟢 ราคาสด' + (o.updateDate ? (' · ปรับปรุง ' + o.updateDate + ' ' + (o.updateTime || '')) : '');
      setGoldThStatus('ดึงราคาสำเร็จ', 'ok');
    }, function () {
      var c = loadGoldThCache();
      if (c) {
        fillGoldThFields(c);
        var badge = $('goldThBadge'); badge.style.display = 'inline-block'; badge.className = 'src-badge real';
        badge.textContent = '🟡 ดึงสดไม่ได้ — ใช้ราคาที่บันทึกไว้ (' + cacheAgeText(c.ts) + ')';
        setGoldThStatus('ดึงสดไม่ได้ตอนนี้ — ใช้ราคาที่บันทึกไว้', 'ok');
      } else {
        var badge = $('goldThBadge'); badge.style.display = 'inline-block'; badge.className = 'src-badge paste';
        badge.textContent = '✍️ กรอกเอง';
        setGoldThStatus('ดึงราคาทองอัตโนมัติไม่ได้ตอนนี้ — กรอกเองในช่องด้านบน หรือลองรีเฟรชอีกครั้ง', 'err');
      }
    });
  }

  /* ── ไฟจราจร "ถูก/แพงตอนนี้ไหม" จากแนวโน้มราคาทองโลก (GC=F) ──── */
  function showGoldVerdict(a, meta) {
    var el = $('gSrcBadge');
    if (meta.kind === 'real') {
      el.className = 'src-badge real';
      el.textContent = '🟢 แนวโน้มจากราคาทองคำโลก (GC=F)' + (meta.stale ? (' · ล่าสุด ' + cacheAgeText(meta.cachedAt)) : '') + (meta.days ? (' · ' + meta.days + ' วัน') : '');
    } else if (meta.kind === 'manual') {
      el.className = 'src-badge paste';
      el.textContent = '✍️ ประเมินจากราคาที่กรอกเอง';
    } else {
      el.className = 'src-badge paste';
      el.textContent = 'ดึงแนวโน้มราคาทองโลกไม่ได้ตอนนี้ — กรอกด้านล่างเพื่อประเมินเอง';
    }
    if (!a) {
      $('gLight').className = 'light gray';
      $('gBulb').textContent = '⚪';
      $('gVerdict').textContent = 'ยังไม่มีข้อมูล';
      $('gWhy').textContent = '';
      $('gDetailsBox').style.display = 'none';
      return;
    }
    var bulbs = { green: '🟢', yellow: '🟡', red: '🔴' };
    $('gLight').className = 'light ' + a.light;
    $('gBulb').textContent = bulbs[a.light] || '⚪';
    $('gVerdict').textContent = a.verdict;
    $('gWhy').textContent = a.why;
    if (a.det && !a.simple && isFinite(a.det.rsi)) {
      var d = a.det, rows = [
        ['เส้นเฉลี่ย 20 วัน (EMA20)', fmt(d.ema20) + ' USD'], ['เส้นเฉลี่ย 50 วัน (EMA50)', fmt(d.ema50) + ' USD'],
        ['RSI (14)', fmt(d.rsi, 1)], ['MACD histogram', fmt(d.macdHist, 3)],
        ['แนวรับล่าสุด', fmt(d.support) + ' USD'], ['แนวต้านล่าสุด', fmt(d.resistance) + ' USD'],
        ['ความแรงแนวโน้ม (ADX 14)', isFinite(d.adx) ? fmt(d.adx, 0) + (d.adx >= 20 ? ' · แข็งแรง' : ' · อ่อน') : '—']
      ], html = '';
      rows.forEach(function (r) { html += '<div class="k">' + r[0] + '</div><div class="v">' + r[1] + '</div>'; });
      $('gDetKv').innerHTML = html;
      $('gDetailsBox').style.display = 'block';
    } else { $('gDetailsBox').style.display = 'none'; }
  }
  function runIntlAnalysis() {
    getSeries('GC=F').then(function (r) {
      var a = analyzeSeries(r.series);
      showGoldVerdict(a, { kind: 'real', stale: r.stale, cachedAt: r.cachedAt, days: r.series.closes.length });
      $('gManualWrap').style.display = 'none';
    }, function () {
      showGoldVerdict(null, { kind: 'fail' });
      $('gManualWrap').style.display = 'block';
    });
  }

  /* ── วางแผนออมทอง (DCA) — ปรับจากตัวจำลอง DCA ของหน้ากองทุน ให้ติดตาม "น้ำหนักทอง" แทนมูลค่ากองทุน ── */
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
  function drawGoldChart(r) {
    var s = r.series, W = 640, H = 220, pad = 8, n = s.length;
    var val = [], con = [], i;
    for (i = 0; i < n; i++) { val.push(s[i].value); con.push(s[i].contrib); }
    var max = Math.max(val[n - 1], con[n - 1]) || 1;
    var x = function (i) { return pad + i / Math.max(1, n - 1) * (W - 2 * pad); };
    var y = function (v) { return pad + (1 - v / max) * (H - 2 * pad); };
    function path(a) { var d = '', i; for (i = 0; i < a.length; i++) d += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(a[i]).toFixed(1) + ' '; return d; }
    var area = path(val) + 'L' + x(n - 1).toFixed(1) + ' ' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';
    var svg = '';
    svg += '<path d="' + area + '" fill="#F5A524" opacity="0.12"/>';
    svg += '<path d="' + path(con) + '" fill="none" stroke="#8B94A8" stroke-width="1.6" stroke-dasharray="5 3"/>';
    svg += '<path d="' + path(val) + '" fill="none" stroke="#F5A524" stroke-width="2.4" stroke-linejoin="round"/>';
    $('dcaChart').innerHTML = svg;
  }
  function dcaYearTable(r, unit) {
    var html = '<table class="yr-table"><thead><tr><th>สิ้นปีที่</th><th>เงินที่ใส่</th><th>น้ำหนักสะสม</th><th>มูลค่า</th></tr></thead><tbody>';
    var yrs = Math.round(r.series.length / 12), i;
    for (i = 1; i <= yrs; i++) {
      var idx = i * 12 - 1;
      if (idx >= r.series.length) break;
      var row = r.series[idx], w = unit === 'gram' ? row.weight * GRAM_PER_BAHT : row.weight;
      html += '<tr><td>ปีที่ ' + i + '</td><td>' + baht(row.contrib) + '</td><td>' + fmt(w, 4) + (unit === 'gram' ? ' ก.' : ' บ.') + '</td><td>' + baht(row.value) + '</td></tr>';
    }
    html += '</tbody></table>';
    return html;
  }
  function doDCA() {
    var pmt = num($('dcaPmt').value) || 0;
    var startPrice = num($('dcaStart').value);
    var years = num($('dcaYears').value) || 10;
    var cagr = num($('dcaCagr').value);
    var unit = $('dcaUnit').value;
    if (!isFinite(cagr)) { cagr = 5; $('dcaCagr').value = 5; }
    if (!isFinite(startPrice) || startPrice <= 0) { alert('กรอกราคาทองเริ่มต้นให้ถูกต้อง (หรือรอราคาวันนี้โหลดก่อน แล้วลองอีกครั้ง)'); return; }
    if (pmt <= 0) { alert('กรอกเงินออมต่อเดือนให้ถูกต้อง'); return; }
    var months = Math.round(years * 12);
    var r = simulateGoldDCA(pmt, startPrice, cagr, months);
    $('dcaOut').style.display = 'block';

    var weightDisplay = unit === 'gram' ? r.weight * GRAM_PER_BAHT : r.weight;
    var altText = unit === 'gram' ? ('≈ ' + fmt(r.weight, 4) + ' บาททองคำ') : ('≈ ' + fmt(r.weight * GRAM_PER_BAHT, 2) + ' กรัม');

    $('dcaContrib').textContent = baht(r.contrib);
    $('dcaContribSub').textContent = fmt0(pmt) + ' บาท/เดือน × ' + months + ' เดือน';
    $('dcaWeight').textContent = fmt(weightDisplay, 4) + (unit === 'gram' ? ' กรัม' : ' บาททองคำ');
    $('dcaWeightSub').textContent = altText;
    $('dcaValue').textContent = baht(r.value);
    $('dcaGain').textContent = (r.value - r.contrib >= 0 ? '+' : '') + baht(r.value - r.contrib);

    drawGoldChart(r);
    $('dcaYrTable').innerHTML = dcaYearTable(r, unit);
    lastGoldPlan = { pmt: pmt };
  }

  /* ── ตลาดย่อ = โอกาสเติมทอง ── */
  var TR = [{ dd: 10, x: 1.25 }, { dd: 20, x: 1.5 }, { dd: 30, x: 2 }];
  function doGoldDrawdown() {
    var now = num($('gdNow').value), ath = num($('gdAth').value);
    var out = $('gdOut');
    [].forEach.call(document.querySelectorAll('#gdTranche .tr-box'), function (b) { b.classList.remove('on'); });
    if (!isFinite(now) || !isFinite(ath) || ath <= 0) { out.style.display = 'none'; return; }
    var dd = (1 - now / ath) * 100;
    var base = lastGoldPlan.pmt || 3000;
    var mult = 1, tier = null;
    TR.forEach(function (t) { if (dd >= t.dd) { mult = t.x; tier = t; } });
    if (tier) document.querySelector('#gdTranche .tr-box[data-dd="' + tier.dd + '"]').classList.add('on');
    var msg;
    if (dd < 1) msg = 'ตอนนี้ราคาใกล้จุดสูงสุด (ย่อ ' + fmt(Math.max(0, dd), 1) + '%) — ออมปกติเดือนละ ' + baht(base) + ' พอ ไม่ต้องเร่งเติม';
    else if (dd < 10) msg = 'ย่อลง <b>' + fmt(dd, 1) + '%</b> จากจุดสูงสุด — ยังถือว่าปกติ ออมตามแผนเดือนละ ' + baht(base);
    else msg = 'ย่อลง <b>' + fmt(dd, 1) + '%</b> จากจุดสูงสุด — ตามกฎที่ตั้งไว้ อาจเพิ่มเงินซื้อเดือนนี้เป็น <b>×' + mult + '</b> ≈ <b>' + baht(base * mult) + '</b> (ถ้ามีเงินสำรอง)';
    out.innerHTML = msg + '<div style="font-size:12px;color:var(--muted);margin-top:6px">เตือน: การย่อไม่ได้แปลว่าจะไม่ลงต่อ — เติมเท่าที่มีเงินสำรองและไม่กระทบชีวิตประจำวัน</div>';
    out.style.display = 'block';
  }

  /* ── สัดส่วนทองในพอร์ต ── */
  function doAllocation() {
    var portfolio = num($('alPortfolio').value), goldNow = num($('alGoldNow').value);
    var el = $('alOut');
    if (!isFinite(portfolio) || portfolio <= 0) { el.className = 'verdict-box warn'; el.textContent = 'กรอกมูลค่าพอร์ตรวมโดยประมาณก่อน'; el.style.display = 'block'; return; }
    if (!isFinite(goldNow) || goldNow < 0) goldNow = 0;
    var pct = goldNow / portfolio * 100;
    var cls, txt;
    if (pct < 5) { cls = 'warn'; txt = 'สัดส่วนทอง ≈ ' + fmt(pct, 1) + '% ของพอร์ต — ต่ำกว่ากรอบทั่วไปที่มักพูดถึง (5–10%) หากอยากมีทองไว้กระจายความเสี่ยงมากขึ้น ค่อยๆ เพิ่มได้'; }
    else if (pct <= 10) { cls = 'go'; txt = 'สัดส่วนทอง ≈ ' + fmt(pct, 1) + '% ของพอร์ต — อยู่ในกรอบที่นักลงทุนมือใหม่มักใช้เป็นแนวทาง (5–10%)'; }
    else { cls = 'warn'; txt = 'สัดส่วนทอง ≈ ' + fmt(pct, 1) + '% ของพอร์ต — สูงกว่ากรอบทั่วไป ทองไม่ให้ปันผล/ดอกเบี้ย ถือมากไปอาจฉุดผลตอบแทนระยะยาวของพอร์ตโดยรวม'; }
    el.className = 'verdict-box ' + cls;
    el.innerHTML = txt + '<div style="font-size:12px;font-weight:500;margin-top:6px;opacity:.85">ตัวเลข 5–10% เป็นแนวทางที่มักถูกพูดถึงทั่วไป ไม่ใช่กฎตายตัวหรือคำแนะนำการลงทุน</div>';
    el.style.display = 'block';
  }

  /* ── สมุดทองของฉัน ── */
  function loadGoldLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
  function saveGoldLog(a) { try { localStorage.setItem(LOG_KEY, JSON.stringify(a)); } catch (e) {} DriveSync.scheduleSync(); }

  function updateAllocAuto(totalValue) {
    var el = $('alGoldNow');
    if (el && !el.value && totalValue > 0) el.value = Math.round(totalValue);
  }

  function renderGoldLog() {
    var log = loadGoldLog(), box = $('lgBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">ยังไม่มีรายการ — บันทึกทุกครั้งที่ซื้อ จะได้รู้ต้นทุนเฉลี่ยและมูลค่าปัจจุบัน</div>'; updateAllocAuto(0); return; }

    var barSellPrice = num($('barSell').value);
    var groups = { bar: { label: 'ทองคำแท่ง', amt: 0, weight: 0 }, jewelry: { label: 'ทองรูปพรรณ', amt: 0, weight: 0 } };
    log.forEach(function (r) {
      var g = groups[r.type] || groups.bar;
      g.amt += r.amt; g.weight += toBahtWeight(r.weight, r.unit);
    });

    var html = '', totalValue = 0;
    ['bar', 'jewelry'].forEach(function (key) {
      var g = groups[key];
      if (g.weight <= 0) return;
      var avg = g.weight > 0 ? g.amt / g.weight : NaN;
      html += '<div class="log-group-hd">' + g.label + '</div>';
      html += '<div class="log-group-sub">รวมซื้อ ' + baht(g.amt) + ' · ' + fmt(g.weight, 4) + ' บาททองคำ (≈ ' + fmt(g.weight * GRAM_PER_BAHT, 2) + ' กรัม) · ต้นทุนเฉลี่ย ' + baht(avg) + '/บาททองคำ';
      if (isFinite(barSellPrice)) {
        var val = g.weight * barSellPrice, pl = val - g.amt, pct = g.amt > 0 ? pl / g.amt * 100 : 0;
        totalValue += val;
        html += ' · มูลค่าตอนนี้ ' + baht(val) + ' <b style="color:' + (pl >= 0 ? 'var(--ok)' : 'var(--err)') + '">(' + (pl >= 0 ? '+' : '−') + baht(Math.abs(pl)) + ', ' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)</b>';
      }
      html += '</div>';
      if (key === 'jewelry') html += '<div class="log-group-note">ร้านทองส่วนใหญ่รับซื้อคืนทองรูปพรรณที่ราคาเนื้อทอง (เท่าทองแท่ง) — ค่ากำเหน็จที่จ่ายไปตอนซื้อจะไม่ได้คืน จึงคำนวณมูลค่าปัจจุบันด้วยราคาขายคืนทองแท่งเช่นกัน</div>';
    });

    html += '<table class="log-table"><thead><tr><th>วันที่</th><th>ชนิด</th><th>เงินที่จ่าย</th><th>ราคา/หน่วยที่ซื้อ</th><th>น้ำหนักที่ได้</th><th></th></tr></thead><tbody>';
    log.forEach(function (r, i) {
      var unitLabel = r.unit === 'gram' ? 'ก.' : 'บ.';
      html += '<tr><td>' + new Date(r.ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
        '<td>' + (r.type === 'jewelry' ? 'รูปพรรณ' : 'แท่ง') + '</td><td>' + baht(r.amt) + '</td><td>' + fmt(r.price, 2) + '</td>' +
        '<td>' + fmt(r.weight, 4) + ' ' + unitLabel + '</td>' +
        '<td><button class="log-del" data-i="' + i + '">✕</button></td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.log-del'), function (b) {
      b.addEventListener('click', function () { var log = loadGoldLog(); log.splice(+b.getAttribute('data-i'), 1); saveGoldLog(log); renderGoldLog(); });
    });
    updateAllocAuto(totalValue);
  }

  function addGoldLog() {
    var type = $('lgType').value, unit = $('lgUnit').value;
    var amt = num($('lgAmt').value), price = num($('lgPrice').value);
    if (!isFinite(amt) || amt <= 0 || !isFinite(price) || price <= 0) { alert('กรอกเงินที่จ่ายและราคา/หน่วยที่ซื้อให้ถูกต้อง'); return; }
    var log = loadGoldLog();
    log.push({ type: type, unit: unit, amt: amt, price: price, weight: amt / price, ts: Date.now() });
    saveGoldLog(log);
    $('lgAmt').value = ''; $('lgPrice').value = '';
    renderGoldLog();
  }

  /* ── ปัจจัยราคาทอง: ตัวเลขสด DXY / ดอกเบี้ย 10 ปีสหรัฐฯ (best-effort) ── */
  function parseQuoteLite(t) {
    var j = JSON.parse(t), res = j && j.chart && j.chart.result && j.chart.result[0];
    var meta = res && res.meta;
    if (!meta || !isFinite(meta.regularMarketPrice)) throw new Error('no meta');
    return { price: meta.regularMarketPrice, prevClose: meta.previousClose };
  }
  function fetchQuoteLite(sym) {
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=5d&interval=1d';
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
      if (i >= tries.length) return Promise.reject(new Error('fail'));
      return fetchOne(tries[i++].url, 7000, parseQuoteLite).catch(next);
    }
    return next();
  }
  function quoteCacheKey(tag) { return 'tanot:invest:cache:gold:' + tag; }
  function saveQuoteCache(tag, q) { try { localStorage.setItem(quoteCacheKey(tag), JSON.stringify({ ts: Date.now(), price: q.price, prevClose: q.prevClose })); } catch (e) {} }
  function loadQuoteCache(tag) { try { var o = JSON.parse(localStorage.getItem(quoteCacheKey(tag))); return (o && isFinite(o.price)) ? o : null; } catch (e) { return null; } }
  function renderFactorChip(id, sym, tag) {
    var el = $(id);
    fetchQuoteLite(sym).then(function (q) {
      saveQuoteCache(tag, q);
      writeChip(q);
    }, function () {
      var c = loadQuoteCache(tag);
      if (c) writeChip(c); else { el.textContent = '— ดึงไม่ได้ตอนนี้'; }
    });
    function writeChip(q) {
      var pct = isFinite(q.prevClose) && q.prevClose ? (q.price / q.prevClose - 1) * 100 : NaN;
      el.textContent = fmt(q.price, 2) + (isFinite(pct) ? (' (' + (pct >= 0 ? '+' : '') + fmt(pct, 2) + '%)') : '');
    }
  }

  /* ══════ สำรองสมุดทองขึ้น Google Drive (ไม่บังคับ) ══════ */
  var DRIVE_CLIENT_ID = '497048581273-akpavakt6m34lhqbjf1irg3m8vl6u27u.apps.googleusercontent.com';
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var DRIVE_FOLDER_NAME = 'OME_Progress';
  var DRIVE_FILE_NAME = 'invest-gold-data.json';
  var DRIVE_CONNECTED_KEY = 'tanot:invest:gold:driveConnected';
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
      b.textContent = this.connected ? '🔗 เชื่อมต่อ Google Drive แล้ว' : '🔗 เชื่อมต่อ Google Drive';
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
          callback: function (resp) {
            if (resp.error) {
              self.setStatus(self.connected ? 'เชื่อมต่ออัตโนมัติไม่สำเร็จ — กดปุ่มเชื่อมต่ออีกครั้ง' : 'เชื่อมต่อไม่สำเร็จ: ' + resp.error, 'err');
              return;
            }
            self.accessToken = resp.access_token;
            self.connected = true;
            try { localStorage.setItem(DRIVE_CONNECTED_KEY, '1'); } catch (e) {}
            self.setBtn();
            self.firstSync();
          }
        });
        if (self.connected) self.tokenClient.requestAccessToken({ prompt: '' });
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
          var merged = self.mergeByTs(remote && remote.log, loadGoldLog());
          try { localStorage.setItem(LOG_KEY, JSON.stringify(merged)); } catch (e) {}
          renderGoldLog();
          return self.upload({ log: merged, savedAt: new Date().toISOString() });
        })
        .then(function () { self.setStatus('✅ ซิงก์กับ Google Drive แล้ว · ' + nowTime(), 'ok'); })
        .catch(function (e) { self.setStatus('❌ ' + (e.message || e), 'err'); });
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
        .then(function () { return self.upload({ log: loadGoldLog(), savedAt: new Date().toISOString() }); })
        .then(function () { self.setStatus('✅ ซิงก์ล่าสุด ' + nowTime(), 'ok'); })
        .catch(function (e) {
          var msg = String(e && e.message || e);
          if (msg.indexOf('401') !== -1 || msg.indexOf('403') !== -1) {
            self.accessToken = null;
            self.setStatus('เซสชันหมดอายุ — กดปุ่มเชื่อมต่อ Drive อีกครั้ง', 'err');
          } else {
            self.setStatus('❌ ซิงก์ไม่สำเร็จ: ' + msg, 'err');
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
    $('goldThRefresh').addEventListener('click', runThaiFetch);
    $('gManualBtn').addEventListener('click', function () {
      var price = num($('gPriceUsd').value), hi = num($('gHiUsd').value), lo = num($('gLoUsd').value);
      if (!isFinite(price)) { alert('กรอกราคาทองโลกตอนนี้ก่อน'); return; }
      if (!isFinite(hi) || !isFinite(lo) || hi <= lo) { alert('กรอกราคาสูงสุด/ต่ำสุดของรอบด้วยเพื่อประเมิน'); return; }
      showGoldVerdict(analyzeSimple(price, hi, lo), { kind: 'manual' });
    });
    $('dcaBtn').addEventListener('click', doDCA);
    $('gdBtn').addEventListener('click', doGoldDrawdown);
    $('alBtn').addEventListener('click', doAllocation);
    $('lgAdd').addEventListener('click', addGoldLog);
    $('driveConnectBtn') && $('driveConnectBtn').addEventListener('click', function () { DriveSync.connect(); });

    renderGoldLog();
    runThaiFetch();
    runIntlAnalysis();
    renderFactorChip('dxyChip', 'DX-Y.NYB', 'dxy');
    renderFactorChip('tnxChip', '^TNX', 'tnx');
    DriveSync.init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__gold = { simulateGoldDCA: simulateGoldDCA, analyzeSeries: analyzeSeries, analyzeSimple: analyzeSimple, parseGoldTH: parseGoldTH, parseYahoo: parseYahoo, toBahtWeight: toBahtWeight };
})();
