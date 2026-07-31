/* ══════════════════════════════════════════════════════════════════
   Tanot — หุ้นไทย (มือใหม่ · สวิง)
   • ดึงราคา .BK แบบ best-effort (มัก CORS บน static host → กรอกเองสำรอง)
   • คำนวณอินดิเคเตอร์เอง (SMA/EMA/RSI/MACD/Bollinger/ATR) → แปลเป็นไฟจราจร
   • แกนหลัก: คุมเงิน/ความเสี่ยง (ขนาดไม้เป็นล็อต 100, stop, TP, จุดคุ้มทุน)
   • พอร์ตเก็บใน localStorage — ไม่ส่งออกไปไหน
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var PF_KEY = 'tanot:invest:thstock';
  var lastSeries = null;   /* { closes, highs, lows } ถ้ามี */
  var lastAnalysis = null; /* ผลวิเคราะห์ล่าสุด */

  /* ── ตัวช่วยเลข ─────────────────────────────────────────────── */
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }

  /* ── อินดิเคเตอร์ (สูตรมาตรฐาน) ─────────────────────────────── */
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
    var rs = ag / al;
    return 100 - 100 / (1 + rs);
  }

  function macd(arr) {
    if (arr.length < 26) return null;
    var e12 = emaSeries(arr, 12), e26 = emaSeries(arr, 26), line = [], i;
    for (i = 25; i < arr.length; i++) line.push(e12[i] - e26[i]);
    if (line.length < 9) return { line: line[line.length - 1], signal: NaN, hist: NaN, histPrev: NaN };
    var sig = emaSeries(line, 9);
    var last = line.length - 1;
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
    for (i = 1; i < closes.length; i++) {
      var tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
      trs.push(tr);
    }
    var a = 0; for (i = 0; i < n; i++) a += trs[i]; a /= n;
    for (i = n; i < trs.length; i++) a = (a * (n - 1) + trs[i]) / n;
    return a;
  }

  /* แนวรับ-แนวต้านจาก swing ล่าสุด (ไม่รวมแท่งปัจจุบัน) */
  function supRes(highs, lows, look) {
    look = look || 20;
    var hi = -Infinity, lo = Infinity, i;
    var start = Math.max(0, highs.length - 1 - look);
    for (i = start; i < highs.length - 1; i++) { if (highs[i] > hi) hi = highs[i]; if (lows[i] < lo) lo = lows[i]; }
    return { support: isFinite(lo) ? lo : NaN, resistance: isFinite(hi) ? hi : NaN };
  }

  /* ── วิเคราะห์แบบมีซีรีส์เต็ม → ไฟจราจร ─────────────────────── */
  function analyzeSeries(s) {
    var c = s.closes, price = c[c.length - 1];
    var ema20 = emaLast(c, 20), ema50 = emaLast(c, 50), r = rsi(c, 14);
    var mac = macd(c), bb = bollinger(c, 20, 2), at = atr(s.highs, s.lows, c, 14);
    var sr = supRes(s.highs, s.lows, 20);
    var range = { hi: Math.max.apply(null, c), lo: Math.min.apply(null, c) };
    var posRange = (price - range.lo) / Math.max(1e-9, range.hi - range.lo); /* 0=ถูกสุด 1=แพงสุด */
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

    var why = (light === 'green' ? pros : light === 'red' ? cons : (pros.concat(cons)))[0]
      || 'ราคาอยู่กลางกรอบ ยังไม่มีสัญญาณชัด';

    /* stop แนะนำ: ต่ำกว่าแนวรับเล็กน้อย หรือ price - 1.5*ATR (เลือกที่ใกล้ตัวกว่า/สมเหตุผล) */
    var stopByAtr = isFinite(at) ? price - 1.5 * at : NaN;
    var stopBySup = isFinite(sr.support) ? sr.support * 0.99 : NaN;
    var stop = NaN;
    if (isFinite(stopBySup) && stopBySup < price) stop = stopBySup;
    if (isFinite(stopByAtr) && stopByAtr < price && (!isFinite(stop) || stopByAtr > stop)) stop = stopByAtr;
    if (!isFinite(stop) || stop <= 0) stop = price * 0.95;

    return {
      light: light, verdict: verdict, why: why, pros: pros, cons: cons,
      price: price, suggestStop: stop, resistance: sr.resistance,
      det: { ema20: ema20, ema50: ema50, rsi: r, macdHist: mac ? mac.hist : NaN,
             bbUpper: bb ? bb.upper : NaN, bbLower: bb ? bb.lower : NaN, atr: at,
             support: sr.support, resistance: sr.resistance, posRange: posRange }
    };
  }

  /* ── วิเคราะห์แบบง่าย (ไม่มีซีรีส์): ใช้ ราคา/สูง/ต่ำ ────────── */
  function analyzeSimple(price, hi, lo) {
    var pos = (price - lo) / Math.max(1e-9, hi - lo);
    var pct = Math.round(pos * 100);
    var light, verdict, why;
    if (pos < 0.35) { light = 'green'; verdict = 'น่าสนใจ — ลองพิจารณา'; why = 'ราคาอยู่ค่อนไปทางถูกของรอบ (~' + pct + '% ของช่วง ต่ำ→สูง)'; }
    else if (pos > 0.75) { light = 'red'; verdict = 'ระวัง — ราคาค่อนข้างแพง'; why = 'ราคาอยู่ค่อนไปทางแพงของรอบ (~' + pct + '% ของช่วง ต่ำ→สูง)'; }
    else { light = 'yellow'; verdict = 'รอก่อน — ราคากลางกรอบ'; why = 'ราคาอยู่กลางกรอบ (~' + pct + '% ของช่วง ต่ำ→สูง)'; }
    return {
      light: light, verdict: verdict, why: why, pros: [], cons: [],
      price: price, suggestStop: Math.min(lo, price * 0.95), resistance: hi,
      det: { posRange: pos, support: lo, resistance: hi }, simple: true
    };
  }

  /* ── คุมเงิน/ความเสี่ยง ─────────────────────────────────────── */
  function riskCalc(o) {
    var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop, comm = o.comm / 100;
    var perShare = entry - stop;
    if (!(perShare > 0)) return { error: 'ราคาตัดขาดทุนต้องต่ำกว่าราคาเข้าซื้อ' };
    var riskBudget = capital * riskPct / 100;
    var raw = riskBudget / perShare;
    var shares = Math.floor(raw / 100) * 100;
    var note = '';
    if (shares < 100) {
      shares = 100;
      note = 'ขั้นต่ำ 100 หุ้น ทำให้ความเสี่ยงเกิน ' + riskPct + '% ที่ตั้งไว้เล็กน้อย — พิจารณาขยับ stop ให้แคบลง หรือเพิ่มทุน';
    }
    var cost = shares * entry;
    if (cost > capital) {
      var maxLots = Math.floor(capital / entry / 100) * 100;
      if (maxLots >= 100) { shares = maxLots; cost = shares * entry; note = 'จำกัดจำนวนตามเงินที่มี (ทุนไม่พอซื้อเท่าที่ความเสี่ยงอนุญาต)'; }
    }
    var riskBaht = shares * perShare;
    var R = perShare;
    var breakeven = entry * (1 + comm) / (1 - comm);
    var rr = isFinite(o.resistance) && o.resistance > entry ? (o.resistance - entry) / R : NaN;
    return {
      shares: shares, lots: shares / 100, cost: cost, riskBaht: riskBaht,
      tp1: entry + R, tp2: entry + 2 * R, tp3: entry + 3 * R,
      breakeven: breakeven, rr: rr, riskBudget: riskBudget, note: note
    };
  }

  /* ── ดึงราคา Yahoo (.BK) best-effort ────────────────────────── */
  function fetchPrice(sym) {
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) +
      '.BK?range=3mo&interval=1d';
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, 7000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) {
        if (to) clearTimeout(to);
        var res = j && j.chart && j.chart.result && j.chart.result[0];
        var q = res && res.indicators && res.indicators.quote && res.indicators.quote[0];
        if (!q || !q.close) throw new Error('no data');
        var closes = [], highs = [], lows = [];
        for (var i = 0; i < q.close.length; i++) {
          if (q.close[i] == null) continue;
          closes.push(q.close[i]);
          highs.push(q.high[i] != null ? q.high[i] : q.close[i]);
          lows.push(q.low[i] != null ? q.low[i] : q.close[i]);
        }
        if (closes.length < 5) throw new Error('too short');
        return { closes: closes, highs: highs, lows: lows };
      })
      .catch(function (e) { if (to) clearTimeout(to); throw e; });
  }

  /* ── วาดกราฟ SVG ────────────────────────────────────────────── */
  function drawChart(s) {
    var c = s.closes, W = 640, H = 200, pad = 6;
    var e20 = emaSeries(c, 20);
    var min = Math.min.apply(null, c), max = Math.max.apply(null, c);
    var rng = Math.max(1e-9, max - min);
    var x = function (i) { return pad + i / (c.length - 1) * (W - 2 * pad); };
    var y = function (v) { return pad + (1 - (v - min) / rng) * (H - 2 * pad); };
    var path = '', i;
    for (i = 0; i < c.length; i++) path += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(c[i]).toFixed(1) + ' ';
    var ep = '';
    for (i = 0; i < c.length; i++) if (e20[i] != null) ep += (ep ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(e20[i]).toFixed(1) + ' ';
    var lastX = x(c.length - 1), lastY = y(c[c.length - 1]);
    var svg = '';
    svg += '<path d="' + path + '" fill="none" stroke="#12A594" stroke-width="2" stroke-linejoin="round"/>';
    if (ep) svg += '<path d="' + ep + '" fill="none" stroke="#F5A524" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.9"/>';
    svg += '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="5" fill="#3B9BEA" stroke="#fff" stroke-width="2"/>';
    $('chart').innerHTML = svg;
    $('chartWrap').style.display = 'block';
  }

  /* ── แสดงไฟจราจร + รายละเอียด ───────────────────────────────── */
  function showAnalysis(a) {
    lastAnalysis = a;
    $('lightCard').style.display = 'block';
    var bulbs = { green: '🟢', yellow: '🟡', red: '🔴' };
    $('light').className = 'light ' + a.light;
    $('bulb').textContent = bulbs[a.light] || '⚪';
    $('verdict').textContent = a.verdict;
    $('why').textContent = a.why;

    if (a.det && !a.simple && isFinite(a.det.rsi)) {
      var d = a.det, rows = [
        ['เส้นเฉลี่ย 20 วัน (EMA20)', fmt(d.ema20)],
        ['เส้นเฉลี่ย 50 วัน (EMA50)', fmt(d.ema50)],
        ['RSI (14)', fmt(d.rsi, 1)],
        ['MACD histogram', fmt(d.macdHist, 3)],
        ['กรอบบน (Bollinger)', fmt(d.bbUpper)],
        ['กรอบล่าง (Bollinger)', fmt(d.bbLower)],
        ['ATR (ความผันผวน)', fmt(d.atr)],
        ['แนวรับล่าสุด', fmt(d.support)],
        ['แนวต้านล่าสุด', fmt(d.resistance)]
      ];
      var html = '';
      rows.forEach(function (r) { html += '<div class="k">' + r[0] + '</div><div class="v">' + r[1] + '</div>'; });
      if (a.pros.length) html += '<div class="k" style="color:#17B26A;margin-top:6px">ข้อดีที่เจอ</div><div class="v" style="text-align:right;font-weight:600">' + a.pros.length + ' ข้อ</div>';
      $('detKv').innerHTML = html;
      $('detailsBox').style.display = 'block';
    } else {
      $('detailsBox').style.display = 'none';
    }

    /* เติมค่าให้ขั้นที่ 2 */
    if (!$('entry').value) $('entry').value = a.price.toFixed(2);
    if (!$('stop').value && isFinite(a.suggestStop)) $('stop').value = a.suggestStop.toFixed(2);
  }

  /* ── event: ประเมิน ─────────────────────────────────────────── */
  function doAnalyze() {
    var price = num($('price').value), hi = num($('hi').value), lo = num($('lo').value);
    if (lastSeries) {
      var a = analyzeSeries(lastSeries);
      showAnalysis(a);
      drawChart(lastSeries);
      return;
    }
    if (!isFinite(price)) { setStatus('กรอกอย่างน้อย "ราคาตอนนี้" ก่อนนะครับ', 'err'); return; }
    if (isFinite(hi) && isFinite(lo) && hi > lo) {
      showAnalysis(analyzeSimple(price, hi, lo));
      $('chartWrap').style.display = 'none';
    } else {
      /* มีแค่ราคาปัจจุบัน — ประเมินไม่ได้ ให้ทำเฉพาะคุมเงิน */
      showAnalysis({ light: 'gray', verdict: 'กรอกราคาสูง/ต่ำของรอบ เพื่อให้ประเมินถูก-แพงได้', why: 'ตอนนี้ทำได้เฉพาะคำนวณเงิน/ความเสี่ยงด้านล่าง', pros: [], cons: [], price: price, suggestStop: price * 0.95, resistance: NaN, det: {}, simple: true });
      $('chartWrap').style.display = 'none';
      $('detailsBox').style.display = 'none';
    }
  }

  function setStatus(msg, cls) { var el = $('fetchStatus'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }

  function doFetch() {
    var sym = ($('sym').value || '').trim().toUpperCase().replace(/\.BK$/, '');
    if (!sym) { setStatus('พิมพ์ชื่อย่อหุ้นก่อน เช่น PTT', 'err'); return; }
    setStatus('กำลังดึงราคา ' + sym + '…');
    $('fetchBtn').disabled = true;
    fetchPrice(sym).then(function (s) {
      lastSeries = s;
      var c = s.closes;
      $('price').value = c[c.length - 1].toFixed(2);
      $('hi').value = Math.max.apply(null, c).toFixed(2);
      $('lo').value = Math.min.apply(null, c).toFixed(2);
      setStatus('ดึงราคา ' + sym + ' สำเร็จ (' + c.length + ' วัน) — กด "ประเมินให้หน่อย"', 'ok');
      $('fetchBtn').disabled = false;
      doAnalyze();
    }).catch(function () {
      lastSeries = null;
      setStatus('ดึงอัตโนมัติไม่ได้ (เว็บนี้เปิดจากมือถือมักติดข้อจำกัด) — กรอกราคาตอนนี้ + สูง/ต่ำของรอบจาก Streaming เองได้เลย', 'err');
      $('fetchBtn').disabled = false;
      $('price').focus();
    });
  }

  /* ── event: คำนวณเงิน ───────────────────────────────────────── */
  function doCalc() {
    var capital = num($('capital').value), riskPct = num($('riskPct').value);
    var entry = num($('entry').value), stop = num($('stop').value), comm = num($('comm').value);
    if (!isFinite(entry)) entry = num($('price').value);
    if (!isFinite(entry)) { setStatus('กรอกราคาเข้าซื้อ (หรือราคาตอนนี้) ก่อน', 'err'); return; }
    if (!isFinite(stop)) { stop = (lastAnalysis && isFinite(lastAnalysis.suggestStop)) ? lastAnalysis.suggestStop : entry * 0.95; $('stop').value = stop.toFixed(2); }
    if (!isFinite(capital) || capital <= 0) { capital = 100000; $('capital').value = capital; }
    if (!isFinite(riskPct) || riskPct <= 0) { riskPct = 2; $('riskPct').value = riskPct; }
    if (!isFinite(comm) || comm < 0) { comm = 0.157; $('comm').value = comm; }

    var res = riskCalc({ capital: capital, riskPct: riskPct, entry: entry, stop: stop, comm: comm,
      resistance: lastAnalysis ? lastAnalysis.resistance : NaN });
    var box = $('riskResult');
    if (res.error) {
      $('riskHeadline').innerHTML = '<span style="color:var(--err)">⚠️ ' + res.error + '</span>';
      $('riskKv').innerHTML = ''; $('tpRow').innerHTML = '';
      box.classList.add('show'); $('saveBtn').style.display = 'none';
      return;
    }
    $('riskHeadline').innerHTML = 'ควรซื้อได้ประมาณ <b>' + fmt0(res.shares) + ' หุ้น</b> (' + fmt0(res.lots) + ' ล็อต) ใช้เงิน ≈ <b>฿' + fmt0(res.cost) + '</b>';
    var kv = '';
    kv += '<div class="k">ถ้าผิดทาง (แตะ Stop) เสียไม่เกิน</div><div class="v risk">฿' + fmt0(res.riskBaht) + '</div>';
    kv += '<div class="k">ราคาตัดขาดทุน (Stop)</div><div class="v">' + fmt(stop) + '</div>';
    kv += '<div class="k">ราคาคุ้มทุน (รวมค่าคอมฯ ไป-กลับ)</div><div class="v">' + fmt(res.breakeven) + '</div>';
    if (isFinite(res.rr)) kv += '<div class="k">ความคุ้ม (กำไรคาดหวัง : ความเสี่ยง) ถึงแนวต้าน</div><div class="v">' + fmt(res.rr, 1) + ' : 1</div>';
    $('riskKv').innerHTML = kv;
    $('tpRow').innerHTML =
      '<span class="tp-chip">🎯 ทยอยขายไม้ 1: ' + fmt(res.tp1) + '</span>' +
      '<span class="tp-chip">🎯 ไม้ 2: ' + fmt(res.tp2) + '</span>' +
      '<span class="tp-chip">🎯 ไม้ 3: ' + fmt(res.tp3) + '</span>';
    if (res.note) $('tpRow').innerHTML += '<div style="flex:1 1 100%;font-size:12px;color:var(--warn);margin-top:6px">ℹ️ ' + res.note + '</div>';
    box.classList.add('show');
    $('saveBtn').style.display = 'inline-flex';
    $('saveBtn')._data = { sym: ($('sym').value || '').trim().toUpperCase() || 'หุ้น', shares: res.shares, cost: entry };
  }

  /* ── พอร์ต (localStorage) ───────────────────────────────────── */
  function loadPf() { try { return JSON.parse(localStorage.getItem(PF_KEY)) || []; } catch (e) { return []; } }
  function savePf(a) { try { localStorage.setItem(PF_KEY, JSON.stringify(a)); } catch (e) {} }

  function renderPf() {
    var pf = loadPf(), box = $('pfBox');
    if (!pf.length) { box.innerHTML = '<div class="pf-empty">ยังไม่มีหุ้นในพอร์ต — คำนวณด้านบนแล้วกด "บันทึกเข้าพอร์ต"</div>'; return; }
    var html = '<table class="pf-table"><thead><tr><th>หุ้น</th><th>จำนวน</th><th>ต้นทุน/หุ้น</th><th>ราคาปัจจุบัน</th><th>กำไร/ขาดทุน</th><th></th></tr></thead><tbody>';
    pf.forEach(function (h, i) {
      html += '<tr data-i="' + i + '">' +
        '<td>' + h.sym + '</td>' +
        '<td>' + fmt0(h.shares) + '</td>' +
        '<td>' + fmt(h.cost) + '</td>' +
        '<td><input type="number" class="pf-price" inputmode="decimal" step="0.01" placeholder="ราคา" value="' + (h.cur != null ? h.cur : '') + '"></td>' +
        '<td class="pf-pl">—</td>' +
        '<td><button class="pf-del" title="ลบ">✕</button></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
    /* คำนวณ P/L แถวที่มีราคาปัจจุบัน */
    [].forEach.call(box.querySelectorAll('tr[data-i]'), function (tr) {
      var i = +tr.getAttribute('data-i'), h = pf[i];
      var inp = tr.querySelector('.pf-price'), cell = tr.querySelector('.pf-pl');
      function upd() {
        var cur = num(inp.value);
        if (!isFinite(cur)) { cell.textContent = '—'; cell.className = 'pf-pl'; return; }
        var pl = (cur - h.cost) * h.shares, pct = (cur / h.cost - 1) * 100;
        cell.textContent = (pl >= 0 ? '+' : '−') + '฿' + fmt0(Math.abs(pl)) + ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)';
        cell.className = 'pf-pl ' + (pl >= 0 ? 'up' : 'down');
      }
      inp.addEventListener('input', function () { upd(); h.cur = num(inp.value); savePf(pf); });
      tr.querySelector('.pf-del').addEventListener('click', function () { pf.splice(i, 1); savePf(pf); renderPf(); });
      upd();
    });
  }

  /* ── init ───────────────────────────────────────────────────── */
  function init() {
    $('fetchBtn').addEventListener('click', doFetch);
    $('analyzeBtn').addEventListener('click', doAnalyze);
    $('calcBtn').addEventListener('click', doCalc);
    $('sym').addEventListener('keydown', function (e) { if (e.key === 'Enter') doFetch(); });
    /* ถ้าแก้ราคามือ ให้ยกเลิกซีรีส์เก่า (จะได้ใช้โหมดง่าย) */
    ['price', 'hi', 'lo'].forEach(function (id) { $(id).addEventListener('input', function () { lastSeries = null; }); });
    $('saveBtn').addEventListener('click', function () {
      var d = $('saveBtn')._data; if (!d) return;
      var pf = loadPf();
      pf.push({ sym: d.sym, shares: d.shares, cost: d.cost, ts: Date.now() });
      savePf(pf); renderPf();
      $('saveBtn').textContent = '✓ บันทึกแล้ว';
      setTimeout(function () { $('saveBtn').innerHTML = '💾 บันทึกเข้าพอร์ต'; }, 1500);
    });
    renderPf();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* export สำหรับเทสต์ */
  window.__thstock = { sma: sma, emaLast: emaLast, rsi: rsi, macd: macd, bollinger: bollinger, atr: atr,
    analyzeSeries: analyzeSeries, analyzeSimple: analyzeSimple, riskCalc: riskCalc };
})();
