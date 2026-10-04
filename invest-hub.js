/* ══════════════════════════════════════════════════════════════════
   Tanot — การลงทุน · ภาพรวม (invest.html) — ยุบรวมหน้าลงทุน ขั้น 4 (docs/invest-consolidation-design.md หัวข้อ 6.7)
   • มูลค่า "สินทรัพย์ลงทุน" = InvestCalc.netWorth จากคีย์ผู้ใช้เดิมทุกตัว (อ่านผ่าน TanotData.read เท่านั้น) — ไม่นับพอร์ตจำลอง, ไม่เดาอัตราแลกเปลี่ยน
   • กราฟ = snapshot วันละแถวใน tanot:invest:networth (เขียนด้วย TanotData.update แบบเดียวกับหน้าวันนี้) สีจาก OmeChartTheme วาดใหม่ตอนเปลี่ยนธีม
   • ตลาด 3 กลุ่ม + ฟันเฟืองเลือกสัญลักษณ์ (คงคีย์ tanot:invest:hub:watch:*) · ข่าว 3 ข่าว · กลัว-โลภ ผ่าน InvestCore (/api/proxy อย่างเดียว)
   • ตัดแล้ว: AI ลอย, ป๊อปอัพ iframe, ช่องค้นหา, Portfolio Health, รายการที่ต้องทำ, การรวมพอร์ตจำลอง, เครื่องมือด่วน
   • คีย์ tanot:invest:hub:history (มีเงินสมมติปน) ปล่อยไว้เฉยๆ ไม่อ่าน ไม่ลบ
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IC = window.InvestCore, Calc = window.InvestCalc, TD = window.TanotData;
  var $ = function (id) { return document.getElementById(id); };
  var esc = IC.esc;
  var NW_KEY = 'tanot:invest:networth';
  var KEYS = ['thstock', 'globalstock', 'btc', 'gold', 'thaifund', 'spfund', 'govbond', 'gsblottery', 'baaclottery'];

  var L = IC.i18n({
    th: {
      heroTitle: 'การลงทุน', refreshBtn: 'รีเฟรชราคา',
      kpiValueLbl: 'สินทรัพย์ลงทุน', kpiPlLbl: 'กำไร/ขาดทุนเทียบต้นทุน', kpiChangeLbl: 'เปลี่ยนแปลง 30 วัน', kpiCountLbl: 'จำนวนรายการ',
      kValueEmpty: 'ยังไม่มีสินทรัพย์ลงทุน', kPlSub: '{pct} จากต้นทุน ฿{cost}', kChangeNone: 'ยังไม่มีข้อมูลย้อนหลังครบ 30 วัน', kChangeSub: 'เทียบ {d}', kCountSub: 'ครบกำหนดแล้ว {n} รายการ (ไม่นับ)',
      warnNoFx: 'ไม่รวมสินทรัพย์ USD (ยังไม่มีอัตราแลกเปลี่ยน)', warnStale: 'ราคา ณ {d}',
      chartTitle: 'มูลค่าสินทรัพย์ลงทุน', range30d: '30 วัน', range90d: '90 วัน', range1y: '1 ปี', rangeAll: 'ทั้งหมด', chartEmpty: 'บันทึกมูลค่าของวันนี้แล้ว — กลับมาเปิดอีกครั้งวันหลังเพื่อดูกราฟแนวโน้ม',
      assetsTitle: 'สินทรัพย์ทั้งหมด', assetsEmpty: 'ยังไม่มีสินทรัพย์ลงทุน — เริ่มบันทึกได้ที่หน้าหุ้น กองทุน ทอง Bitcoin พันธบัตร หรือสลาก',
      thAsset: 'สินทรัพย์', thQty: 'จำนวน', thValue: 'มูลค่า ฿', thShare: 'สัดส่วน', thPl: 'P/L', thSrc: 'แหล่งราคา',
      srcMarket: 'ตลาด', srcManual: 'กรอกเอง', srcCost: 'ต้นทุน', srcAsOf: 'ณ {d}', noFxCell: 'ไม่มีอัตรา',
      marketTitle: 'ตลาด', marketLive: '{live}/{n} ราคาล่าสุด', marketNoLive: 'ยังดึงราคาไม่ได้ — แสดงจากแคชหรือรอใหม่ภายหลัง',
      groupThai: 'หุ้นไทย', groupGlobal: 'หุ้นต่างประเทศ & Bitcoin', groupCommod: 'โภคภัณฑ์',
      gearLabel: 'เลือกสัญลักษณ์ที่แสดง', tickerEmpty: 'ยังไม่ได้เลือกสัญลักษณ์ — กด ⚙ เพื่อเพิ่ม',
      gpExtraPh: 'เพิ่มเอง เช่น KTB, OR (คั่นด้วยจุลภาค)', gpSave: 'บันทึก', gpReset: 'ใช้ค่าเริ่มต้น',
      allocTitle: 'สัดส่วนตามประเภท', allocEmpty: 'ยังไม่มีข้อมูลสัดส่วน',
      newsTitle: 'ข่าวหุ้นล่าสุด', newsSeeAll: 'ดูทั้งหมด →', newsLoading: 'กำลังโหลดข่าว…', newsError: 'ดึงข่าวไม่ได้ตอนนี้ — ลองใหม่ภายหลัง',
      fngTitle: 'ดัชนีความกลัว-โลภ (คริปโต)', fngLoading: 'กำลังโหลด…', fngError: 'ดึงข้อมูลไม่ได้ตอนนี้', fngCached: 'ค่าที่บันทึกไว้',
      fngExtremeFear: 'กลัวสุดขีด', fngFear: 'กลัว', fngNeutral: 'เป็นกลาง', fngGreed: 'โลภ', fngExtremeGreed: 'โลภสุดขีด',
      unitBaht: 'บาททองคำ', unitUnit: 'หน่วย', unitShare: 'หุ้น',
      candSET: 'ดัชนี SET', candADVANC: 'ADVANC (AIS)', candPTT: 'PTT', candCPALL: 'CPALL (7-Eleven)', candDELTA: 'DELTA', candBDMS: 'BDMS (รพ.กรุงเทพ)',
      candKBANK: 'KBANK', candSCB: 'SCB', candAOT: 'AOT (สนามบิน)', candBBL: 'BBL', candSCC: 'SCC (ปูนซิเมนต์ไทย)', candTRUE: 'TRUE',
      candGULF: 'GULF', candBANPU: 'BANPU', candIVL: 'IVL', candTOP: 'TOP', candPTTEP: 'PTTEP', candCPF: 'CPF', candBH: 'BH (รพ.บำรุงราษฎร์)', candHMPRO: 'HMPRO',
      candAAPL: 'Apple', candMSFT: 'Microsoft', candGOOGL: 'Google (Alphabet)', candAMZN: 'Amazon', candNVDA: 'NVIDIA', candMETA: 'Meta', candTSLA: 'Tesla',
      'candBTC-USD': 'Bitcoin', 'candETH-USD': 'Ethereum',
      'candGC=F': 'ทองคำ', 'candSI=F': 'เงิน (Silver)', 'candCL=F': 'น้ำมัน WTI', 'candBZ=F': 'น้ำมันดิบ Brent', 'candNG=F': 'ก๊าซธรรมชาติ',
      'candHG=F': 'ทองแดง', 'candHRC=F': 'เหล็ก (HRC)', 'candSB=F': 'น้ำตาลทราย', 'candKC=F': 'กาแฟ', 'candZR=F': 'ข้าว (Rough Rice)', 'candDX-Y.NYB': 'ดัชนีดอลลาร์'
    },
    en: {
      heroTitle: 'Investing', refreshBtn: 'Refresh prices',
      kpiValueLbl: 'Investment assets', kpiPlLbl: 'P/L vs cost', kpiChangeLbl: '30-day change', kpiCountLbl: 'Holdings',
      kValueEmpty: 'No investment assets yet', kPlSub: '{pct} on cost ฿{cost}', kChangeNone: 'Less than 30 days of history', kChangeSub: 'vs {d}', kCountSub: '{n} matured (not counted)',
      warnNoFx: 'USD assets excluded (no exchange rate yet)', warnStale: 'Prices as of {d}',
      chartTitle: 'Investment assets value', range30d: '30 days', range90d: '90 days', range1y: '1 year', rangeAll: 'All', chartEmpty: 'Today’s value is saved — come back another day to see the trend',
      assetsTitle: 'All assets', assetsEmpty: 'No investment assets yet — start from the stocks, funds, gold, Bitcoin, bonds or lottery pages',
      thAsset: 'Asset', thQty: 'Qty', thValue: 'Value ฿', thShare: 'Share', thPl: 'P/L', thSrc: 'Price source',
      srcMarket: 'Market', srcManual: 'Manual', srcCost: 'Cost', srcAsOf: 'as of {d}', noFxCell: 'No rate',
      marketTitle: 'Market', marketLive: '{live}/{n} latest prices', marketNoLive: 'Couldn’t fetch prices yet — showing cache, try again later',
      groupThai: 'Thai Stocks', groupGlobal: 'Global Stocks & Bitcoin', groupCommod: 'Commodities',
      gearLabel: 'Choose symbols to show', tickerEmpty: 'No symbols selected — tap ⚙ to add',
      gpExtraPh: 'Add your own, e.g. KTB, OR (comma-separated)', gpSave: 'Save', gpReset: 'Reset to default',
      allocTitle: 'Allocation by type', allocEmpty: 'No allocation data yet',
      newsTitle: 'Latest Stock News', newsSeeAll: 'See all →', newsLoading: 'Loading news…', newsError: 'Couldn’t fetch news right now — try again later',
      fngTitle: 'Fear & Greed Index (Crypto)', fngLoading: 'Loading…', fngError: 'Couldn’t fetch data right now', fngCached: 'Cached value',
      fngExtremeFear: 'Extreme Fear', fngFear: 'Fear', fngNeutral: 'Neutral', fngGreed: 'Greed', fngExtremeGreed: 'Extreme Greed',
      unitBaht: 'baht-gold', unitUnit: 'units', unitShare: 'shares',
      candSET: 'SET Index', candADVANC: 'ADVANC (AIS)', candPTT: 'PTT', candCPALL: 'CPALL (7-Eleven)', candDELTA: 'DELTA', candBDMS: 'BDMS (Bangkok Hospital)',
      candKBANK: 'KBANK', candSCB: 'SCB', candAOT: 'AOT (Airports of Thailand)', candBBL: 'BBL', candSCC: 'SCC (Siam Cement)', candTRUE: 'TRUE',
      candGULF: 'GULF', candBANPU: 'BANPU', candIVL: 'IVL', candTOP: 'TOP', candPTTEP: 'PTTEP', candCPF: 'CPF', candBH: 'BH (Bumrungrad Hospital)', candHMPRO: 'HMPRO',
      candAAPL: 'Apple', candMSFT: 'Microsoft', candGOOGL: 'Google (Alphabet)', candAMZN: 'Amazon', candNVDA: 'NVIDIA', candMETA: 'Meta', candTSLA: 'Tesla',
      'candBTC-USD': 'Bitcoin', 'candETH-USD': 'Ethereum',
      'candGC=F': 'Gold', 'candSI=F': 'Silver', 'candCL=F': 'WTI Crude Oil', 'candBZ=F': 'Brent Crude Oil', 'candNG=F': 'Natural Gas',
      'candHG=F': 'Copper', 'candHRC=F': 'Steel (HRC)', 'candSB=F': 'Sugar', 'candKC=F': 'Coffee', 'candZR=F': 'Rough Rice', 'candDX-Y.NYB': 'Dollar Index'
    }
  });
  var t = L.t;

  function rd(k, d) { return TD && TD.read ? TD.read(k, d) : (IC.lsJson(k) == null ? d : IC.lsJson(k)); }
  function lang() { return IC.getLang(); }
  function baht(n) { return (n < 0 ? '−฿' : '฿') + Math.abs(n).toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
  function pctText(p, d) { return (p >= 0 ? '+' : '−') + Math.abs(p).toFixed(d == null ? 1 : d) + '%'; }
  function dateShort(ts) { return IC.date(new Date(ts), { day: 'numeric', month: 'short' }); }
  function readData() {
    var data = {};
    KEYS.forEach(function (k) { var v = rd('tanot:invest:' + k, []); data[k] = Array.isArray(v) ? v : []; });
    return data;
  }

  /* ── คำนวณ + snapshot ── */
  var cur = null; /* ผล netWorth ล่าสุด */
  function compute() {
    var data = readData(), now = Date.now();
    var prices = Calc.collectPrices(function (k) { return rd(k, null); }, data);
    var nw = Calc.netWorth(data, prices, prices.fx, now);
    return { data: data, prices: prices, nw: nw, now: now };
  }
  function writeSnapshot(nw, now) {
    var row = Calc.snapshotRow(nw, now), list = rd(NW_KEY, []);
    if (!Array.isArray(list)) list = [];
    var prev = null; list.forEach(function (r) { if (r && r.d === row.d) prev = r; });
    if (!Calc.shouldWriteSnapshot(prev, row, now)) return list;
    return TD.update(NW_KEY, function (c) {
      c = Array.isArray(c) ? c : [];
      var hit = -1; c.forEach(function (r, i) { if (r && r.d === row.d) hit = i; });
      if (hit >= 0) c[hit] = row; else c.push(row);
      return c;
    });
  }

  /* ── KPI + ป้ายเตือน ── */
  function renderKpis(c) {
    var nw = c.nw, has = nw.rows.length > 0;
    $('kValue').textContent = has ? baht(nw.total) : '฿0';
    $('kValueSub').textContent = has ? '' : t('kValueEmpty');
    var pl = $('kPl'), plS = $('kPlSub');
    if (has && nw.cost > 0) {
      pl.textContent = (nw.pl >= 0 ? '+' : '') + baht(nw.pl); pl.className = 'kpi-value ' + (nw.pl >= 0 ? 'up' : 'dn');
      plS.textContent = t('kPlSub', { pct: pctText(nw.plPct, 2), cost: Math.round(nw.cost).toLocaleString('th-TH') }); plS.className = 'kpi-delta ' + (nw.pl >= 0 ? 'up' : 'dn');
    } else { pl.textContent = '—'; pl.className = 'kpi-value'; plS.textContent = ''; }
    var cutoff = Calc.thaiDate(c.now - 30 * 86400000), base = null;
    (Array.isArray(c.hist) ? c.hist : []).forEach(function (r) { if (r && typeof r.d === 'string' && r.d <= cutoff && r.v > 0 && (!base || r.d > base.d)) base = r; });
    var ch = $('kChange'), chS = $('kChangeSub');
    if (base && nw.n > 0) {
      var p = (nw.total / base.v - 1) * 100;
      ch.textContent = pctText(p, 1); ch.className = 'kpi-value ' + (p >= 0 ? 'up' : 'dn'); chS.textContent = t('kChangeSub', { d: dateShort(new Date(base.d + 'T00:00:00+07:00').getTime()) });
    } else { ch.textContent = '—'; ch.className = 'kpi-value'; chS.textContent = has ? t('kChangeNone') : ''; }
    $('kCount').textContent = String(nw.rows.length);
    $('kCountSub').textContent = nw.maturedCount ? t('kCountSub', { n: nw.maturedCount }) : '';
    var warn = [];
    if (nw.missingFx) warn.push('<span class="badge warn" data-i="nofx">' + esc(t('warnNoFx')) + '</span>');
    if (nw.stale) {
      var old = nw.rows.filter(function (r) { return r.stale && r.priceTs; }).sort(function (a, b) { return a.priceTs - b.priceTs; })[0];
      if (old) warn.push('<span class="badge warn" data-i="stale">' + esc(t('warnStale', { d: dateShort(old.priceTs) })) + '</span>');
    }
    $('warnRow').innerHTML = warn.join('');
  }

  /* ── ตารางสินทรัพย์ ── */
  function srcText(r) {
    if (r.src === 'market') return t('srcMarket') + (r.stale && r.priceTs ? ' · ' + t('srcAsOf', { d: dateShort(r.priceTs) }) : '');
    return r.src === 'manual' ? t('srcManual') : t('srcCost');
  }
  function qtyText(r) {
    var n = r.qty.toLocaleString('th-TH', { maximumFractionDigits: r.cls === 'crypto' || r.cls === 'gold' ? 4 : 2 });
    var u = r.cls === 'gold' ? ' ' + t('unitBaht') : (r.cls === 'stockTh' || r.cls === 'stockUs') ? ' ' + t('unitShare') : (r.cls === 'fundTh' || r.cls === 'fundGlobal' || r.cls === 'savingsLottery') ? ' ' + t('unitUnit') : '';
    return r.cls === 'bond' ? '—' : n + u;
  }
  function renderAssets(c) {
    var body = $('assetsBody'), nw = c.nw;
    if (!nw.rows.length) { body.innerHTML = '<p class="empty-hint">' + esc(t('assetsEmpty')) + '</p>'; return; }
    var rows = nw.rows.slice().sort(function (a, b) { return (b.valueThb == null ? -1 : b.valueThb) - (a.valueThb == null ? -1 : a.valueThb); });
    var html = '<div class="table-wrap"><table class="table right"><thead><tr><th>' + esc(t('thAsset')) + '</th><th>' + esc(t('thQty')) + '</th><th>' + esc(t('thValue')) + '</th><th>' + esc(t('thShare')) + '</th><th>' + esc(t('thPl')) + '</th><th>' + esc(t('thSrc')) + '</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var pl = r.valueThb != null && r.costThb > 0 ? (r.valueThb / r.costThb - 1) * 100 : null;
      html += '<tr data-href="' + esc(r.href) + '"><td><div class="sym">' + esc(Calc.rowLabel(r, lang())) + '<small>' + esc(Calc.classLabel(r.cls, lang())) + '</small></div></td>' +
        '<td>' + esc(qtyText(r)) + '</td>' +
        '<td>' + (r.valueThb == null ? '<span class="src">' + esc(t('noFxCell')) + '</span>' : baht(r.valueThb)) + '</td>' +
        '<td>' + (r.valueThb != null && nw.total > 0 ? (r.valueThb / nw.total * 100).toFixed(1) + '%' : '—') + '</td>' +
        '<td class="pl ' + (pl == null ? '' : pl >= 0 ? 'up' : 'dn') + '">' + (pl == null ? '—' : pctText(pl, 1)) + '</td>' +
        '<td class="src">' + esc(srcText(r)) + '</td></tr>';
    });
    body.innerHTML = html + '</tbody></table></div>';
    [].forEach.call(body.querySelectorAll('tr[data-href]'), function (tr) { tr.addEventListener('click', function () { location.href = tr.getAttribute('data-href'); }); });
  }

  /* ── สัดส่วนตามประเภท (donut SVG สีจาก OmeChartTheme ตามลำดับ chart-1..8) ── */
  function renderAlloc(c) {
    var body = $('allocBody'), nw = c.nw;
    var parts = Calc.CLASSES.filter(function (k) { return nw.byClass[k].value > 0; });
    if (!parts.length || !(nw.total > 0)) { body.innerHTML = '<p class="empty-hint">' + esc(t('allocEmpty')) + '</p>'; return; }
    var C = window.OmeChartTheme.get(), R = 15.9155, off = 0;
    var arcs = parts.map(function (k) {
      var p = nw.byClass[k].value / nw.total * 100, s = '<circle cx="18" cy="18" r="' + R + '" fill="none" stroke="' + C.series[Calc.CLASSES.indexOf(k)] + '" stroke-width="6" stroke-dasharray="' + p.toFixed(3) + ' ' + (100 - p).toFixed(3) + '" stroke-dashoffset="' + (-off).toFixed(3) + '" transform="rotate(-90 18 18)"/>';
      off += p; return s;
    }).join('');
    var rows = parts.map(function (k) {
      return '<div class="allocrow"><span class="k"><i style="background:' + C.series[Calc.CLASSES.indexOf(k)] + '"></i>' + esc(Calc.classLabel(k, lang())) + '</span><span class="v">' + (nw.byClass[k].value / nw.total * 100).toFixed(1) + '%</span></div>';
    }).join('');
    body.innerHTML = '<div class="alloc"><svg viewBox="0 0 36 36" role="img" aria-label="' + esc(t('allocTitle')) + '">' + arcs + '</svg><div>' + rows + '</div></div>';
  }

  /* ── กราฟ snapshot ── */
  var RANGE_DAYS = { '30d': 30, '90d': 90, '1y': 365 };
  function renderChart(c) {
    var body = $('chartBody'), range = IC.ui.get().chartRange || '90d';
    [].forEach.call($('rangeSeg').querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-r') === range ? 'true' : 'false'); });
    var hist = (Array.isArray(c.hist) ? c.hist : []).filter(function (r) { return r && typeof r.d === 'string' && isFinite(r.v); }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    if (RANGE_DAYS[range]) { var cutoff = Calc.thaiDate(c.now - RANGE_DAYS[range] * 86400000); hist = hist.filter(function (r) { return r.d >= cutoff; }); }
    if (hist.length < 2) { body.innerHTML = '<p class="empty-hint">' + esc(t('chartEmpty')) + '</p>'; return; }
    var vals = hist.map(function (h) { return h.v; }), min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var rg = Math.max(1e-6, max - min), w = 620, h = 170, pad = 28, C = window.OmeChartTheme.get();
    var pts = hist.map(function (x, i) { return (pad + i / (hist.length - 1) * (w - pad * 2)).toFixed(1) + ',' + (pad + (1 - (x.v - min) / rg) * (h - pad * 1.6)).toFixed(1); });
    var first = hist[0], last = hist[hist.length - 1], up = last.v >= first.v;
    body.innerHTML = '<div class="chartwrap"><svg viewBox="0 0 ' + w + ' ' + (h + 22) + '" preserveAspectRatio="xMidYMid meet" role="img">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + (up ? C.up : C.down) + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<text x="' + pad + '" y="' + (h + 18) + '" font-size="9" fill="' + C.axis + '">' + esc(first.d.slice(5)) + '</text>' +
      '<text x="' + (w - pad - 40) + '" y="' + (h + 18) + '" font-size="9" fill="' + C.axis + '">' + esc(last.d.slice(5)) + '</text>' +
      '<text x="' + pad + '" y="12" font-size="9" fill="' + C.axis + '">' + esc(Math.round(max).toLocaleString('th-TH')) + '</text></svg></div>';
  }

  function renderAll() {
    var c = compute();
    c.hist = c.nw.rows.length ? writeSnapshot(c.nw, c.now) : rd(NW_KEY, []);
    cur = c;
    renderKpis(c); renderAssets(c); renderAlloc(c); renderChart(c);
  }

  /* ── ตลาด 3 กลุ่ม (คงคีย์ hub:watch:*) ── */
  var GROUPS = {
    thai: { defaultSyms: ['SET', 'ADVANC', 'PTT', 'CPALL', 'DELTA', 'BDMS'], allowCustom: true,
      candidates: ['SET', 'ADVANC', 'PTT', 'CPALL', 'DELTA', 'BDMS', 'KBANK', 'SCB', 'AOT', 'BBL', 'SCC', 'TRUE', 'GULF', 'BANPU', 'IVL', 'TOP', 'PTTEP', 'CPF', 'BH', 'HMPRO'] },
    global: { defaultSyms: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'BTC-USD'], candidates: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BTC-USD', 'ETH-USD'] },
    commod: { defaultSyms: ['GC=F', 'SI=F', 'CL=F', 'NG=F', 'HRC=F', 'HG=F'], candidates: ['GC=F', 'SI=F', 'CL=F', 'BZ=F', 'NG=F', 'HG=F', 'HRC=F', 'SB=F', 'KC=F', 'ZR=F', 'DX-Y.NYB'] }
  };
  function watchKey(g) { return 'tanot:invest:hub:watch:' + g; }
  function loadWatch(g) { var v = IC.lsJson(watchKey(g)); return (Array.isArray(v) && v.length) ? v : null; }
  function heldThai() { return readData().thstock.map(function (r) { return String(r.sym || '').toUpperCase(); }).filter(Boolean).filter(function (s, i, a) { return a.indexOf(s) === i; }); }
  function groupSyms(g) {
    var custom = loadWatch(g);
    if (custom) return custom;
    if (g === 'thai') { var out = heldThai().slice(0, 6); GROUPS.thai.defaultSyms.forEach(function (s) { if (out.length < 6 && out.indexOf(s) < 0) out.push(s); }); return out; }
    return GROUPS[g].defaultSyms;
  }
  function yahooOf(g, s) { return g === 'thai' ? (s === 'SET' ? '^SET.BK' : s + '.BK') : s; }
  function hrefOf(g, s) {
    if (g === 'thai') return s === 'SET' ? null : 'invest-stock.html?sym=' + encodeURIComponent(s) + '#th';
    if (g === 'global') return /^(BTC|ETH)-USD$/.test(s) ? (s === 'BTC-USD' ? 'invest-bitcoin.html' : null) : 'invest-stock.html?sym=' + encodeURIComponent(s) + '#us';
    return s === 'GC=F' ? 'invest-gold.html#gold' : 'invest-gold.html#markets';
  }
  var quotes = { thai: {}, global: {}, commod: {} };
  function renderMarketGroup(g) {
    var syms = groupSyms(g), grid = $('mkGrid-' + g);
    grid.innerHTML = syms.length ? syms.map(function (s) {
      var q = quotes[g][s], href = hrefOf(g, s), chg = q && isFinite(q.prev) && q.prev ? (q.price / q.prev - 1) * 100 : NaN;
      var inner = '<b>' + esc(s) + '</b><span class="px">' + (q ? q.price.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—') + '</span><span class="chg ' + (isFinite(chg) ? (chg >= 0 ? 'up' : 'dn') : '') + '">' + (isFinite(chg) ? pctText(chg, 2) : '—') + '</span>';
      return href ? '<a class="ticker" href="' + esc(href) + '">' + inner + '</a>' : '<div class="ticker">' + inner + '</div>';
    }).join('') : '<p class="empty-hint">' + esc(t('tickerEmpty')) + '</p>';
    if (g === 'thai') {
      var live = syms.filter(function (s) { return quotes.thai[s]; }).length;
      $('tkStatus').textContent = live ? t('marketLive', { live: live, n: syms.length }) : t('marketNoLive');
    }
  }
  function loadMarketGroup(g, force) {
    var syms = groupSyms(g);
    return IC.sequence(syms, function (s) {
      return IC.quote(yahooOf(g, s), { force: force }).then(function (q) { quotes[g][s] = q; renderMarketGroup(g); });
    }, 260).then(function () { renderMarketGroup(g); });
  }
  function loadAllMarkets(force) { return Promise.all(['thai', 'global', 'commod'].map(function (g) { return loadMarketGroup(g, force); })); }

  [].forEach.call(document.querySelectorAll('.gear-btn'), function (btn) {
    var g = btn.getAttribute('data-group'), panel = $('gearPanel-' + g), meta = GROUPS[g];
    btn.addEventListener('click', function () {
      var open = panel.hidden;
      [].forEach.call(document.querySelectorAll('.gear-panel'), function (p) { p.hidden = true; });
      if (!open) return;
      panel.hidden = false;
      var current = groupSyms(g), extra = current.filter(function (s) { return meta.candidates.indexOf(s) < 0; });
      panel.innerHTML = '<div class="gp-check-grid">' + meta.candidates.map(function (s) {
        var on = current.indexOf(s) >= 0;
        return '<label class="gp-check' + (on ? ' on' : '') + '"><input type="checkbox" value="' + esc(s) + '"' + (on ? ' checked' : '') + '> ' + esc(t('cand' + s)) + '</label>';
      }).join('') + '</div>' +
        (meta.allowCustom ? '<input type="text" class="input gp-extra" value="' + esc(extra.join(', ')) + '" placeholder="' + esc(t('gpExtraPh')) + '" spellcheck="false">' : '') +
        '<div class="gp-actions"><button type="button" class="btn primary sm gp-save">' + esc(t('gpSave')) + '</button><button type="button" class="btn ghost sm gp-reset">' + esc(t('gpReset')) + '</button></div>';
      [].forEach.call(panel.querySelectorAll('.gp-check input'), function (c) { c.addEventListener('change', function () { c.closest('.gp-check').classList.toggle('on', c.checked); }); });
      panel.querySelector('.gp-save').addEventListener('click', function () {
        var checked = [].map.call(panel.querySelectorAll('.gp-check input:checked'), function (c) { return c.value; });
        var ex = panel.querySelector('.gp-extra'), extraSyms = ex ? ex.value.split(',').map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean) : [];
        var syms = checked.concat(extraSyms.filter(function (s) { return checked.indexOf(s) < 0; }));
        if (syms.length) IC.lsSet(watchKey(g), syms); else { try { localStorage.removeItem(watchKey(g)); } catch (e) {} }
        panel.hidden = true; renderMarketGroup(g); loadMarketGroup(g);
      });
      panel.querySelector('.gp-reset').addEventListener('click', function () { try { localStorage.removeItem(watchKey(g)); } catch (e) {} panel.hidden = true; renderMarketGroup(g); loadMarketGroup(g); });
    });
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('.gear-btn, .gear-panel')) return;
    [].forEach.call(document.querySelectorAll('.gear-panel'), function (p) { p.hidden = true; });
  });

  /* ── ข่าว 3 ข่าว + กลัว-โลภ ── */
  var NEWS_QUERY = 'ตลาดหุ้นไทย OR SET Index', newsFailed = false, lastFng = null;
  function renderNews(items) { $('newsBody').innerHTML = items.map(function (n) { return '<div class="newsitem"><a href="' + esc(n.link) + '" target="_blank" rel="noopener">' + esc(n.title) + '</a></div>'; }).join(''); }
  function renderNewsError() { $('newsBody').innerHTML = '<div class="newsitem"><span>' + esc(t('newsError')) + '</span></div>'; }
  function loadNews() { IC.news(NEWS_QUERY, { limit: 3 }).then(function (r) { newsFailed = false; renderNews(r.items); }, function () { newsFailed = true; renderNewsError(); }); }
  var FNG_KEY = { 'Extreme Fear': 'fngExtremeFear', 'Fear': 'fngFear', 'Neutral': 'fngNeutral', 'Greed': 'fngGreed', 'Extreme Greed': 'fngExtremeGreed' };
  function renderFng(f) {
    lastFng = f;
    $('fngNum').textContent = f.value;
    $('fngLabel').textContent = t(FNG_KEY[f.classification] || 'fngNeutral') + ' (' + f.value + '/100)';
    $('fngMarker').style.left = Math.max(0, Math.min(100, f.value)) + '%';
    var b = $('fngBadge'); if (f.stale) { b.style.display = 'inline'; b.textContent = t('fngCached'); } else b.style.display = 'none';
  }
  function loadFng() { IC.fng().then(renderFng, function () { $('fngLabel').textContent = t('fngError'); }); }

  /* ── รีเฟรชราคาของทุกสินทรัพย์ที่ถือ + FX + ทองไทย แล้ววาดใหม่ (+ snapshot) ── */
  function heldSymbols() {
    var d = readData(), out = [];
    d.thstock.forEach(function (r) { if (r && r.sym) out.push(String(r.sym).toUpperCase() + '.BK'); });
    d.globalstock.forEach(function (r) { if (r && r.sym) out.push(String(r.sym).toUpperCase()); });
    if (d.btc.length) out.push('BTC-USD');
    return out.filter(function (s, i, a) { return a.indexOf(s) === i; });
  }
  function refreshPrices(force) {
    var d = readData(), syms = heldSymbols();
    var jobs = [IC.sequence(syms, function (s) { return IC.quote(s, { force: force }); }, 260)];
    jobs.push(IC.fx('USD', { force: force }).catch(function () {}));
    if (d.gold.length) jobs.push(IC.thaiGold({ force: force }).catch(function () {}));
    return Promise.all(jobs).then(renderAll, renderAll);
  }

  [].forEach.call($('rangeSeg').querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () { IC.ui.set({ chartRange: b.getAttribute('data-r') }); if (cur) renderChart(cur); });
  });
  $('refreshBtn').addEventListener('click', function () {
    var btn = this; btn.disabled = true;
    Promise.all([refreshPrices(true), loadAllMarkets(true)]).then(function () { btn.disabled = false; }, function () { btn.disabled = false; });
  });

  function applyLang() {
    L.apply();
    IC.subnav($('ivSubRow'), 'overview');
    if (cur) { renderKpis(cur); renderAssets(cur); renderAlloc(cur); renderChart(cur); }
    ['thai', 'global', 'commod'].forEach(renderMarketGroup);
    if (lastFng) renderFng(lastFng);
    if (newsFailed) renderNewsError();
  }
  IC.onLang(applyLang);
  window.OmeChartTheme.onChange(function () { if (cur) { renderAlloc(cur); renderChart(cur); } });
  if (TD && TD.onChange) TD.onChange(function () { renderAll(); ['thai'].forEach(renderMarketGroup); });

  L.apply();
  IC.subnav($('ivSubRow'), 'overview');
  renderAll();
  ['thai', 'global', 'commod'].forEach(renderMarketGroup);
  refreshPrices(false);
  loadAllMarkets(false);
  loadNews();
  loadFng();
})();
