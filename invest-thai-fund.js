/* ══════════════════════════════════════════════════════════════════
   Tanot — กองทุนไทย · วางแผน DCA + คำนวณลดหย่อนภาษี (RMF/SSF/Thai ESG)
   • โปรเจกต์มูลค่าอนาคตจาก DCA (จำลองเดือนต่อเดือน) — สะสมมูลค่า vs ปันผล
   • เติมไม้ตอนย่อ (ดัชนี SET)
   • สมุดซื้อจริง แยกตามชื่อกองทุน + ประเภทเพื่อภาษี
   • คำนวณภาษีที่ประหยัดได้จาก RMF/SSF/Thai ESG ตามขั้นบันไดภาษีจริง
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุนหรือคำแนะนำภาษี
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LOG_KEY = 'tanot:invest:thaifund';

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function baht(n) { return '฿' + fmt0(n); }

  /* ── จำลอง DCA เดือนต่อเดือน (แพทเทิร์นเดียวกับ invest-global-fund.js) ── */
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
    svg += '<path d="' + area + '" fill="#3B9BEA" opacity="0.10"/>';
    svg += '<path d="' + path(con) + '" fill="none" stroke="#8B94A8" stroke-width="1.6" stroke-dasharray="5 3"/>';
    svg += '<path d="' + path(val) + '" fill="none" stroke="#3B9BEA" stroke-width="2.4" stroke-linejoin="round"/>';
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

  var lastPlan = { accM: 3000, divM: 3000 };

  function doCalc() {
    var o = {
      accM: num($('accM').value) || 0, divM: num($('divM').value) || 0,
      years: num($('years').value) || 10, cagr: num($('cagr').value),
      fee: num($('fee').value) || 0, dy: num($('dy').value) || 0
    };
    if (!isFinite(o.cagr)) { o.cagr = 6; $('cagr').value = 6; }
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

  /* ── เติมไม้ตอนย่อ (ดัชนี SET) ──────────────────────────────── */
  var TR = [{ dd: 10, x: 1.25 }, { dd: 20, x: 1.5 }, { dd: 30, x: 2 }];
  function doDrawdown() {
    var now = num($('idxNow').value), ath = num($('idxAth').value);
    var out = $('ddOut');
    [].forEach.call(document.querySelectorAll('.tr-box'), function (b) { b.classList.remove('on'); });
    if (!isFinite(now) || !isFinite(ath) || ath <= 0) { out.style.display = 'none'; return; }
    var dd = (1 - now / ath) * 100;
    var base = (lastPlan.accM + lastPlan.divM) || 6000;
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

  /* ══════════════════════════════════════════════════════════════════
     ภาษี — RMF / SSF / Thai ESG
     ══════════════════════════════════════════════════════════════════ */

  /* อัตราภาษีเงินได้บุคคลธรรมดาแบบขั้นบันได (ตามเกณฑ์ปัจจุบัน)
     คำนวณภาษีจริงตามช่วงขั้น ไม่ใช่คูณอัตราสูงสุดตรงๆ */
  var TAX_BRACKETS = [
    { upTo: 150000, rate: 0 },
    { upTo: 300000, rate: 0.05 },
    { upTo: 500000, rate: 0.10 },
    { upTo: 750000, rate: 0.15 },
    { upTo: 1000000, rate: 0.20 },
    { upTo: 2000000, rate: 0.25 },
    { upTo: 5000000, rate: 0.30 },
    { upTo: Infinity, rate: 0.35 }
  ];

  function thaiTax(income) {
    if (!isFinite(income) || income <= 0) return 0;
    var tax = 0, prev = 0, i;
    for (i = 0; i < TAX_BRACKETS.length; i++) {
      var b = TAX_BRACKETS[i];
      if (income <= prev) break;
      var taxableHere = Math.min(income, b.upTo) - prev;
      tax += taxableHere * b.rate;
      prev = b.upTo;
    }
    return tax;
  }

  /* เพดานลดหย่อน (ตามเกณฑ์ปัจจุบัน):
     RMF   : 30% ของเงินได้ สูงสุด 500,000 (เดี่ยว) — รวมอยู่ในกลุ่มเกษียณรวม ≤500,000
     SSF   : 30% ของเงินได้ สูงสุด 200,000 (เดี่ยว) — รวมอยู่ในกลุ่มเกษียณรวม ≤500,000 เดียวกับ RMF
     กลุ่มเกษียณรวม (RMF+SSF+กบข./PVD/ประกันบำนาญ/กอช. ฯลฯ) ≤ 500,000 รวมกัน
     Thai ESG : 30% ของเงินได้ สูงสุด 300,000 — เพดานแยกต่างหาก ไม่รวมกับกลุ่มเกษียณ */
  var RMF_INDIVIDUAL_CAP = 500000;
  var SSF_INDIVIDUAL_CAP = 200000;
  var RETIRE_COMBINED_CAP = 500000;
  var ESG_CAP = 300000;

  function computeTaxSaving(o) {
    var income = Math.max(0, o.income || 0);
    var incomeCap = income * 0.3;

    var rmfCap = Math.min(incomeCap, RMF_INDIVIDUAL_CAP);
    var ssfCap = Math.min(incomeCap, SSF_INDIVIDUAL_CAP);
    var esgCap = Math.min(incomeCap, ESG_CAP);

    var rmfWant = Math.max(0, Math.min(o.rmf || 0, rmfCap));
    var ssfWant = Math.max(0, Math.min(o.ssf || 0, ssfCap));
    var otherUsed = Math.max(0, o.otherRetire || 0);

    /* กลุ่มเกษียณรวม: otherUsed กันสิทธิ์ไว้ก่อน (สมมติใช้ไปแล้วจริง) ที่เหลือแบ่งให้ RMF ก่อนแล้วค่อย SSF
       (เป็น convention ของเครื่องมือนี้ — จริงๆ ผู้เสียภาษีเลือกสัดส่วนเองได้ นี่เป็นการประมาณ) */
    var remainingForFund = Math.max(0, RETIRE_COMBINED_CAP - otherUsed);
    var rmfUsed, ssfUsed;
    if (rmfWant + ssfWant <= remainingForFund) {
      rmfUsed = rmfWant; ssfUsed = ssfWant;
    } else {
      rmfUsed = Math.min(rmfWant, remainingForFund);
      ssfUsed = Math.max(0, Math.min(ssfWant, remainingForFund - rmfUsed));
    }

    var esgUsed = Math.max(0, Math.min(o.esg || 0, esgCap));

    var totalDeduction = rmfUsed + ssfUsed + esgUsed;
    var taxBefore = thaiTax(income);
    var taxAfter = thaiTax(Math.max(0, income - totalDeduction));
    var saved = taxBefore - taxAfter;

    return {
      rmfCap: rmfCap, ssfCap: ssfCap, esgCap: esgCap,
      rmfWant: o.rmf || 0, ssfWant: o.ssf || 0, esgWant: o.esg || 0,
      rmfUsed: rmfUsed, ssfUsed: ssfUsed, esgUsed: esgUsed,
      rmfCapped: rmfUsed < (o.rmf || 0), ssfCapped: ssfUsed < (o.ssf || 0), esgCapped: esgUsed < (o.esg || 0),
      combinedCapHit: (rmfWant + ssfWant + otherUsed) > RETIRE_COMBINED_CAP,
      totalDeduction: totalDeduction,
      taxBefore: taxBefore, taxAfter: taxAfter, saved: saved
    };
  }

  function doTaxCalc() {
    var o = {
      income: num($('txIncome').value),
      rmf: num($('txRmf').value) || 0,
      ssf: num($('txSsf').value) || 0,
      esg: num($('txEsg').value) || 0,
      otherRetire: num($('txOther').value) || 0
    };
    if (!isFinite(o.income) || o.income <= 0) { alert('กรอกเงินได้สุทธิที่ต้องเสียภาษีต่อปีให้ถูกต้อง'); return; }
    var r = computeTaxSaving(o);

    $('txOut').style.display = 'block';
    $('txBefore').textContent = baht(r.taxBefore);
    $('txAfter').textContent = baht(r.taxAfter);
    $('txSaved').textContent = baht(r.saved);
    $('txSavedSub').textContent = r.totalDeduction > 0
      ? ('ใช้สิทธิลดหย่อนรวม ' + baht(r.totalDeduction) + ' · ประหยัดเฉลี่ย ' + fmt(r.totalDeduction > 0 ? r.saved / r.totalDeduction * 100 : 0, 1) + '% ของเงินที่ใส่')
      : 'ยังไม่ได้ใส่จำนวนซื้อ RMF/SSF/ESG';

    var html = '';
    html += '<div class="tax-line"><span>RMF — ใช้สิทธิได้</span><span class="v">' + baht(r.rmfUsed) + ' / ที่ใส่ ' + baht(r.rmfWant) + '</span></div>';
    if (r.rmfCapped) html += '<div class="tax-cap-note">⚠️ RMF เกินสิทธิ (เพดานเดี่ยว ' + baht(r.rmfCap) + ' หรือโดนเพดานกลุ่มเกษียณรวมกันไป) ส่วนเกินลดหย่อนไม่ได้</div>';
    html += '<div class="tax-line"><span>SSF — ใช้สิทธิได้</span><span class="v">' + baht(r.ssfUsed) + ' / ที่ใส่ ' + baht(r.ssfWant) + '</span></div>';
    if (r.ssfCapped) html += '<div class="tax-cap-note">⚠️ SSF เกินสิทธิ (เพดานเดี่ยว ' + baht(r.ssfCap) + ' หรือโดนเพดานกลุ่มเกษียณรวมกันไป) ส่วนเกินลดหย่อนไม่ได้</div>';
    html += '<div class="tax-line"><span>Thai ESG — ใช้สิทธิได้</span><span class="v">' + baht(r.esgUsed) + ' / ที่ใส่ ' + baht(r.esgWant) + '</span></div>';
    if (r.esgCapped) html += '<div class="tax-cap-note">⚠️ Thai ESG เกินเพดาน ' + baht(r.esgCap) + ' (30% ของเงินได้ สูงสุด 300,000 บาท แยกจาก RMF/SSF) ส่วนเกินลดหย่อนไม่ได้</div>';
    if (r.combinedCapHit) html += '<div class="tax-cap-note">⚠️ RMF+SSF+กลุ่มเกษียณอื่นที่กรอกไว้ รวมกันเกิน 500,000 บาท ระบบตัดสิทธิ์ส่วนเกินให้ RMF ก่อน แล้วเหลือเท่าไรถึงให้ SSF</div>';
    $('txDetail').innerHTML = html;
  }

  function taxYearFromLog() {
    var log = loadLog(), yr = new Date().getFullYear();
    var sums = { rmf: 0, ssf: 0, esg: 0 };
    log.forEach(function (r) {
      var d = new Date(r.ts);
      if (d.getFullYear() !== yr) return;
      if (sums[r.cat] != null) sums[r.cat] += r.amt;
    });
    return sums;
  }

  function doTaxFromLog() {
    var sums = taxYearFromLog();
    $('txRmf').value = sums.rmf; $('txSsf').value = sums.ssf; $('txEsg').value = sums.esg;
    doTaxCalc();
  }

  /* ── สเกลความเสี่ยง 1-8 ──────────────────────────────────────── */
  var RISK_LEVELS = [
    { n: 1, label: 'ตลาดเงิน', color: '#17B26A' },
    { n: 2, label: 'ตราสารหนี้ระยะสั้น', color: '#4CC38A' },
    { n: 3, label: 'ตราสารหนี้ทั่วไป', color: '#8FD19E' },
    { n: 4, label: 'ผสม (หุ้น+หนี้)', color: '#F5D76E' },
    { n: 5, label: 'หุ้นไทย/ต่างประเทศ', color: '#F5A524' },
    { n: 6, label: 'หุ้นเฉพาะกลุ่ม/ประเทศเดียว', color: '#F08A3C' },
    { n: 7, label: 'ทองคำ/สินค้าโภคภัณฑ์', color: '#EC5E8A' },
    { n: 8, label: 'อนุพันธ์/ทางเลือกซับซ้อน', color: '#E5484D' }
  ];
  function renderRiskScale() {
    var el = $('riskScale'); if (!el) return;
    var html = '';
    RISK_LEVELS.forEach(function (r) {
      html += '<div class="risk-seg" style="background:' + r.color + '"><div class="n">' + r.n + '</div><div>' + r.label + '</div></div>';
    });
    el.innerHTML = html;
  }

  /* ── สมุดซื้อจริง (localStorage) — จัดกลุ่มตาม "ชื่อกองทุน" ──── */
  function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
  function saveLog(a) { try { localStorage.setItem(LOG_KEY, JSON.stringify(a)); } catch (e) {} }

  var CAT_LABEL = { general: 'ทั่วไป', rmf: 'RMF', ssf: 'SSF', esg: 'Thai ESG' };

  function renderLog() {
    var log = loadLog(), box = $('lgBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">ยังไม่มีรายการ — บันทึกทุกครั้งที่ซื้อ จะได้รู้ต้นทุนเฉลี่ยและกำไร-ขาดทุน แยกตามกองทุน</div>'; return; }
    var cur = num($('lgCur').value);
    var groups = {};
    log.forEach(function (r) {
      var g = groups[r.fund] || (groups[r.fund] = { amt: 0, units: 0, cat: r.cat });
      g.amt += r.amt; g.units += r.units;
    });

    var html = '';
    Object.keys(groups).forEach(function (fund) {
      var g = groups[fund], avg = g.units > 0 ? g.amt / g.units : NaN;
      html += '<div class="log-group-hd">' + fund + ' <span style="font-weight:600;color:var(--brand-dk);font-size:11.5px">(' + (CAT_LABEL[g.cat] || 'ทั่วไป') + ')</span></div>';
      html += '<div class="log-group-sub">รวมซื้อ ' + baht(g.amt) + ' · ' + fmt(g.units, 4) + ' หน่วย · ต้นทุนเฉลี่ย ' + fmt(avg, 4) + '/หน่วย';
      if (isFinite(cur)) {
        var val = g.units * cur, pl = val - g.amt, pct = g.amt > 0 ? pl / g.amt * 100 : 0;
        html += ' · มูลค่าตอนนี้ ' + baht(val) + ' <b style="color:' + (pl >= 0 ? 'var(--ok)' : 'var(--err)') + '">(' + (pl >= 0 ? '+' : '−') + baht(Math.abs(pl)) + ', ' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)</b>';
      }
      html += '</div>';
    });

    html += '<table class="log-table"><thead><tr><th>วันที่</th><th>กองทุน</th><th>เงิน</th><th>NAV</th><th>หน่วย</th><th></th></tr></thead><tbody>';
    log.forEach(function (r, i) {
      html += '<tr><td>' + new Date(r.ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
        '<td>' + r.fund + '</td><td>' + baht(r.amt) + '</td><td>' + fmt(r.nav, 4) + '</td><td>' + fmt(r.units, 4) + '</td>' +
        '<td><button class="log-del" data-i="' + i + '">✕</button></td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.log-del'), function (b) {
      b.addEventListener('click', function () { var log = loadLog(); log.splice(+b.getAttribute('data-i'), 1); saveLog(log); renderLog(); });
    });
  }

  function addLog() {
    var fund = ($('lgFund').value || '').trim(), cat = $('lgCat').value;
    var amt = num($('lgAmt').value), nav = num($('lgNav').value);
    if (!fund) { alert('กรอกชื่อกองทุน'); return; }
    if (!isFinite(amt) || amt <= 0 || !isFinite(nav) || nav <= 0) { alert('กรอกเงินที่ซื้อ และราคา/หน่วย (NAV) ให้ครบ'); return; }
    var log = loadLog();
    log.push({ fund: fund, cat: cat, amt: amt, nav: nav, units: amt / nav, ts: Date.now() });
    saveLog(log);
    $('lgFund').value = ''; $('lgAmt').value = ''; $('lgNav').value = '';
    renderLog();
  }

  function init() {
    $('calcBtn').addEventListener('click', doCalc);
    $('ddBtn').addEventListener('click', doDrawdown);
    $('lgAdd').addEventListener('click', addLog);
    $('lgCur').addEventListener('input', renderLog);
    $('txBtn').addEventListener('click', doTaxCalc);
    $('txFromLogBtn').addEventListener('click', doTaxFromLog);
    renderRiskScale();
    renderLog();
    doCalc(); /* แสดงผลตั้งต้นทันที */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__thaifund = { simulate: simulate, plan: plan, thaiTax: thaiTax, computeTaxSaving: computeTaxSaving };
})();
