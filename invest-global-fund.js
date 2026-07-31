/* ══════════════════════════════════════════════════════════════════
   Tanot — กองทุนต่างประเทศ (S&P500 ผ่าน SCB) · วางแผน DCA
   • โปรเจกต์มูลค่าอนาคตจาก DCA (จำลองเดือนต่อเดือน)
   • เทียบ สะสมมูลค่า vs ปันผล + ปันผลรับสะสม
   • ไกด์เติมไม้ตอนย่อ (value-averaging แบบมีกฎ)
   • สมุดซื้อจริง (ต้นทุนเฉลี่ย/หน่วย/กำไร-ขาดทุน) เก็บใน localStorage
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LOG_KEY = 'tanot:invest:spfund';

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function baht(n) { return '฿' + fmt0(n); }

  /* ── จำลอง DCA เดือนต่อเดือน ─────────────────────────────────
     annualNetPct = ผลตอบแทนสุทธิต่อปี (%) ; คืนอาเรย์ยอดคงเหลือรายเดือน
     ถ้า divYieldPct > 0 → จ่ายปันผลออก (สะสมใน cash), การเติบโตราคาลดตามปันผล */
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

  /* ── กราฟ: มูลค่ารวม vs เงินใส่ ─────────────────────────────── */
  function drawChart(p) {
    var s = p.acc.series, W = 640, H = 220, pad = 8, n = s.length;
    var val = [], con = [], i;
    for (i = 0; i < n; i++) { val.push(p.acc.series[i].bal + p.div.series[i].bal); con.push(p.acc.series[i].contrib + p.div.series[i].contrib); }
    var max = Math.max(val[n - 1], con[n - 1]) || 1;
    var x = function (i) { return pad + i / Math.max(1, n - 1) * (W - 2 * pad); };
    var y = function (v) { return pad + (1 - v / max) * (H - 2 * pad); };
    function path(a) { var d = '', i; for (i = 0; i < a.length; i++) d += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(a[i]).toFixed(1) + ' '; return d; }
    var area = path(val) + 'L' + x(n - 1).toFixed(1) + ' ' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';
    var svg = '';
    svg += '<path d="' + area + '" fill="#12A594" opacity="0.10"/>';
    svg += '<path d="' + path(con) + '" fill="none" stroke="#8B94A8" stroke-width="1.6" stroke-dasharray="5 3"/>';
    svg += '<path d="' + path(val) + '" fill="none" stroke="#12A594" stroke-width="2.4" stroke-linejoin="round"/>';
    $('chart').innerHTML = svg;
  }

  function yearTable(p) {
    var html = '<table class="yr-table"><thead><tr><th>สิ้นปีที่</th><th>เงินที่ใส่</th><th>มูลค่ารวม</th><th>กำไร</th></tr></thead><tbody>';
    var yrs = Math.round(p.months / 12), i;
    for (i = 1; i <= yrs; i++) {
      var idx = i * 12 - 1;
      if (idx >= p.acc.series.length) break;
      var val = p.acc.series[idx].bal + p.div.series[idx].bal;
      var con = p.acc.series[idx].contrib + p.div.series[idx].contrib;
      html += '<tr><td>ปีที่ ' + i + '</td><td>' + baht(con) + '</td><td>' + baht(val) + '</td><td style="color:var(--ok)">' + baht(val - con) + '</td></tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  function doCalc() {
    var o = {
      accM: num($('accM').value) || 0, divM: num($('divM').value) || 0,
      years: num($('years').value) || 10, cagr: num($('cagr').value),
      fee: num($('fee').value) || 0, dy: num($('dy').value) || 0
    };
    if (!isFinite(o.cagr)) { o.cagr = 7; $('cagr').value = 7; }
    if (o.accM + o.divM <= 0) { alert('ใส่จำนวนเงินซื้อต่อเดือนอย่างน้อยหนึ่งชนิด'); return; }
    var p = plan(o);
    $('planOut').style.display = 'block';

    $('oContrib').textContent = baht(p.contribTotal);
    $('oContribSub').textContent = fmt0(o.accM + o.divM) + ' บาท/เดือน × ' + p.months + ' เดือน';
    $('oValue').textContent = baht(p.valueTotal);
    $('oValueSub').textContent = 'ในอีก ' + fmt0(o.years) + ' ปี (สมมติ ' + fmt(o.cagr, 1) + '%/ปี)';
    $('oGain').textContent = baht(p.valueTotal - p.contribTotal);

    $('aC').textContent = baht(p.contribAcc);
    $('aV').textContent = baht(p.acc.balance);
    $('dC').textContent = baht(p.contribDiv);
    $('dV').textContent = baht(p.div.balance);
    $('dCash').textContent = baht(p.divCash);

    drawChart(p);
    $('yrTable').innerHTML = yearTable(p);
    lastPlan = { accM: o.accM, divM: o.divM };
  }

  var lastPlan = { accM: 5000, divM: 5000 };

  /* ── เติมไม้ตอนย่อ ──────────────────────────────────────────── */
  var TR = [{ dd: 10, x: 1.25 }, { dd: 20, x: 1.5 }, { dd: 30, x: 2 }];
  function doDrawdown() {
    var now = num($('idxNow').value), ath = num($('idxAth').value);
    var out = $('ddOut');
    [].forEach.call(document.querySelectorAll('.tr-box'), function (b) { b.classList.remove('on'); });
    if (!isFinite(now) || !isFinite(ath) || ath <= 0) { out.style.display = 'none'; return; }
    var dd = (1 - now / ath) * 100;
    var base = (lastPlan.accM + lastPlan.divM) || 10000;
    var mult = 1, tier = null;
    TR.forEach(function (t) { if (dd >= t.dd) { mult = t.x; tier = t; } });
    if (tier) document.querySelector('.tr-box[data-dd="' + tier.dd + '"]').classList.add('on');
    var msg;
    if (dd < 1) msg = 'ตอนนี้ราคาใกล้จุดสูงสุด (ย่อ ' + fmt(Math.max(0, dd), 1) + '%) — DCA ปกติเดือนละ ' + baht(base) + ' พอ ไม่ต้องเร่งเติม';
    else if (dd < 10) msg = 'ย่อลง <b>' + fmt(dd, 1) + '%</b> จากจุดสูงสุด — ยังถือว่าปกติ DCA ตามแผนเดือนละ ' + baht(base);
    else msg = 'ย่อลง <b>' + fmt(dd, 1) + '%</b> จากจุดสูงสุด — ตามกฎที่ตั้งไว้ อาจเพิ่มเงินซื้อเดือนนี้เป็น <b>×' + mult + '</b> ≈ <b>' + baht(base * mult) + '</b> (ถ้ามีเงินสำรอง)';
    out.innerHTML = msg + '<div style="font-size:12px;color:var(--muted);margin-top:6px">เตือน: การย่อไม่ได้แปลว่าจะไม่ลงต่อ — เติมเท่าที่มีเงินสำรองและไม่กระทบชีวิตประจำวัน</div>';
    out.style.display = 'block';
  }

  /* ── สมุดซื้อจริง (localStorage) ─────────────────────────────── */
  function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
  function saveLog(a) { try { localStorage.setItem(LOG_KEY, JSON.stringify(a)); } catch (e) {} }

  function renderLog() {
    var log = loadLog(), box = $('lgBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">ยังไม่มีรายการ — บันทึกทุกครั้งที่ซื้อ จะได้รู้ต้นทุนเฉลี่ยและกำไร-ขาดทุน</div>'; return; }
    var cur = num($('lgCur').value);
    /* สรุปแยกชนิด */
    var groups = {};
    log.forEach(function (r) { var g = groups[r.cls] || (groups[r.cls] = { amt: 0, units: 0 }); g.amt += r.amt; g.units += r.units; });

    var html = '';
    Object.keys(groups).forEach(function (cls) {
      var g = groups[cls], avg = g.units > 0 ? g.amt / g.units : NaN;
      html += '<div style="font-weight:700;font-size:13px;margin:10px 0 2px">' + cls + '</div>';
      html += '<div style="font-size:12.5px;color:var(--muted)">รวมซื้อ ' + baht(g.amt) + ' · ' + fmt(g.units, 4) + ' หน่วย · ต้นทุนเฉลี่ย ' + fmt(avg, 4) + '/หน่วย';
      if (isFinite(cur)) {
        var val = g.units * cur, pl = val - g.amt, pct = g.amt > 0 ? pl / g.amt * 100 : 0;
        html += ' · มูลค่าตอนนี้ ' + baht(val) + ' <b style="color:' + (pl >= 0 ? 'var(--ok)' : 'var(--err)') + '">(' + (pl >= 0 ? '+' : '−') + baht(Math.abs(pl)) + ', ' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)</b>';
      }
      html += '</div>';
    });

    html += '<table class="log-table"><thead><tr><th>วันที่</th><th>ชนิด</th><th>เงิน</th><th>NAV</th><th>หน่วย</th><th></th></tr></thead><tbody>';
    log.forEach(function (r, i) {
      html += '<tr><td>' + new Date(r.ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
        '<td>' + r.cls + '</td><td>' + baht(r.amt) + '</td><td>' + fmt(r.nav, 4) + '</td><td>' + fmt(r.units, 4) + '</td>' +
        '<td><button class="log-del" data-i="' + i + '">✕</button></td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.log-del'), function (b) {
      b.addEventListener('click', function () { var log = loadLog(); log.splice(+b.getAttribute('data-i'), 1); saveLog(log); renderLog(); });
    });
  }

  function addLog() {
    var amt = num($('lgAmt').value), nav = num($('lgNav').value), cls = $('lgClass').value;
    if (!isFinite(amt) || amt <= 0 || !isFinite(nav) || nav <= 0) { alert('กรอกเงินที่ซื้อ และราคา/หน่วย (NAV) ให้ครบ'); return; }
    var log = loadLog();
    log.push({ cls: cls, amt: amt, nav: nav, units: amt / nav, ts: Date.now() });
    saveLog(log);
    $('lgAmt').value = ''; $('lgNav').value = '';
    renderLog();
  }

  function init() {
    $('calcBtn').addEventListener('click', doCalc);
    $('ddBtn').addEventListener('click', doDrawdown);
    $('lgAdd').addEventListener('click', addLog);
    $('lgCur').addEventListener('input', renderLog);
    renderLog();
    doCalc(); /* แสดงผลตั้งต้นทันที */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__spfund = { simulate: simulate, plan: plan };
})();
