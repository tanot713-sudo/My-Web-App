/* ══════════════════════════════════════════════════════════════════
   Tanot — ค่าเงิน & วัตถุดิบ (การ์ดหลายสินทรัพย์ + กราฟแท่งเทียนสลับ)
   • ราคาสินค้าโภคภัณฑ์/ค่าเงินโลก ดึงจาก Yahoo Finance ผ่าน CORS-proxy chain
     (pattern เดียวกับ invest-gold.js/invest-thai-stock.js — clone-and-adapt)
   • คู่ค่าเงินที่ Yahoo ไม่มี ticker ตรง (เยน/ยูโร/หยวน เทียบบาท) คำนวณ cross
     จากคู่ USD 2 ตัวที่มี ticker จริง (ไม่ใช่ตัวเลขที่เดาขึ้นเอง)
   • ทองคำแท่ง/รูปพรรณไทย ใช้ thai-gold-api เดิม (community, MIT) เหมือนหน้าทองคำ
   • สินค้าบางตัวที่เว็บอ้างอิงมี (ถ่านหิน/ค่าระวางเรือ/ยางพารา/ปาล์ม/มันสำปะหลัง)
     ไม่มีในรายการนี้ เพราะยังไม่พบ ticker สาธารณะฟรีที่มั่นใจได้ — ไม่ใส่เลขปลอม
   หมายเหตุ: ตัวช่วยดูภาพรวมราคา ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ══════ ระบบสองภาษา (ไทย/อังกฤษ) — ตามธรรมเนียมเดียวกับ invest-gold.js ══════ */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      navInvest: 'การลงทุน', pageTitle: 'ค่าเงิน & วัตถุดิบ',
      srcBadgeEod: 'ข้อมูล EOD (วันก่อนหน้า)', loadingDefault: 'กำลังโหลด…',
      ohlcOpen: 'เปิด', ohlcHigh: 'สูง', ohlcLow: 'ต่ำ', ohlcClose: 'ปิด', ohlcChg: 'เปลี่ยนแปลง',
      tf1m: '1เดือน', tf3m: '3เดือน', tf6m: '6เดือน', tf1y: '1ปี',
      chartCapUp: 'แท่งขึ้น', chartCapDown: 'แท่งลง', chartCapTap: 'แตะบนกราฟเพื่อดูราคาแต่ละวัน',
      histTitleDefault: 'ข้อมูลราคาย้อนหลัง',
      histTitleWithAsset: 'ข้อมูลราคา {label} — ล่าสุด {n} วัน',
      histThDate: 'วันที่', histThOpen: 'เปิด', histThHigh: 'สูง', histThLow: 'ต่ำ', histThClose: 'ปิด', histThChg: 'เปลี่ยนแปลง',
      fetchFailShort: 'ดึงไม่ได้',
      goldNoHistEmpty: 'ราคาทองไทยไม่มีข้อมูลย้อนหลังจากแหล่งฟรี',
      goldNoHistTitle: 'ราคาทองไทยไม่มีข้อมูลย้อนหลังจากแหล่งฟรี',
      goldLiveToday: 'ราคาสดวันนี้', goldStale: 'ดึงสดไม่ได้ — ใช้ราคาที่บันทึกไว้ล่าสุด', goldFail: 'ดึงราคาทองไทยไม่ได้ตอนนี้',
      loadingChart: 'กำลังโหลดกราฟ…',
      seriesReal: 'ราคาจาก Yahoo Finance', seriesStale: 'ดึงสดไม่ได้ — ใช้ข้อมูลที่บันทึกไว้ล่าสุด',
      chartLibFail: 'โหลดไลบรารีกราฟไม่ได้ (ลองออนไลน์แล้วรีเฟรช)',
      seriesFail: 'ดึงข้อมูลไม่สำเร็จตอนนี้ — ลองรีเฟรชอีกครั้ง หรือเลือกสินทรัพย์อื่นก่อน',
      chartEmptyFail: 'ดึงกราฟไม่ได้ตอนนี้', histTitleFail: 'ดึงข้อมูลราคาย้อนหลังไม่ได้ตอนนี้',
      groupFx: 'ค่าเงิน', groupMetal: 'ทองคำ & โลหะ', groupEnergy: 'พลังงาน', groupAgri: 'เกษตร',
      labelUsdthb: 'บาทดอลลาร์', labelGc: 'ทองคำ COMEX', labelGoldbar: 'ทองคำแท่ง', labelGoldjew: 'ทองรูปพรรณ',
      labelWti: 'น้ำมัน WTI', labelBrent: 'น้ำมันดิบ Brent', labelNg: 'ก๊าซธรรมชาติ', labelCopper: 'ทองแดง',
      labelSteel: 'เหล็ก (HRC)', labelSugar: 'น้ำตาลทราย', labelCoffee: 'กาแฟ', labelRice: 'ข้าว (Rough Rice)',
      labelDxy: 'ดัชนีดอลลาร์', labelJpythb: 'เยนเทียบบาท', labelEurthb: 'ยูโรเทียบบาท', labelCnythb: 'หยวนเทียบบาท',
      unitUsdthb: 'บาท/USD', unitGc: 'USD/ออนซ์', unitGoldw: 'บาท/บาททองคำ', unitOilBbl: 'USD/บาร์เรล',
      unitNg: 'USD/MMBtu', unitCopper: 'USD/ปอนด์', unitSteel: 'USD/ตันสั้น', unitCentLb: 'เซนต์/ปอนด์',
      unitRice: 'USD/100cwt', unitDxy: 'จุด', unitJpythb: 'บาท/100เยน', unitEurthb: 'บาท/ยูโร', unitCnythb: 'บาท/หยวน'
    },
    en: {
      navInvest: 'Investing', pageTitle: 'FX & Commodities',
      srcBadgeEod: 'EOD data (previous day)', loadingDefault: 'Loading…',
      ohlcOpen: 'Open', ohlcHigh: 'High', ohlcLow: 'Low', ohlcClose: 'Close', ohlcChg: 'Change',
      tf1m: '1M', tf3m: '3M', tf6m: '6M', tf1y: '1Y',
      chartCapUp: 'Up candle', chartCapDown: 'Down candle', chartCapTap: 'Tap the chart to see each day’s price',
      histTitleDefault: 'Price history',
      histTitleWithAsset: 'Price history for {label} — last {n} days',
      histThDate: 'Date', histThOpen: 'Open', histThHigh: 'High', histThLow: 'Low', histThClose: 'Close', histThChg: 'Change',
      fetchFailShort: 'Unavailable',
      goldNoHistEmpty: 'No free historical data for Thai gold price',
      goldNoHistTitle: 'No free historical data for Thai gold price',
      goldLiveToday: "Today's live price", goldStale: 'Live fetch failed — using last saved price', goldFail: "Couldn't fetch Thai gold price right now",
      loadingChart: 'Loading chart…',
      seriesReal: 'Price from Yahoo Finance', seriesStale: 'Live fetch failed — using last saved data',
      chartLibFail: "Couldn't load the chart library (try again online and refresh)",
      seriesFail: "Couldn't fetch data right now — try refreshing, or pick another asset first",
      chartEmptyFail: "Couldn't fetch the chart right now", histTitleFail: "Couldn't fetch price history right now",
      groupFx: 'FX', groupMetal: 'Gold & Metals', groupEnergy: 'Energy', groupAgri: 'Agriculture',
      labelUsdthb: 'USD/THB', labelGc: 'Gold (COMEX)', labelGoldbar: 'Gold Bar (Thai)', labelGoldjew: 'Gold Jewelry (Thai)',
      labelWti: 'WTI Crude Oil', labelBrent: 'Brent Crude Oil', labelNg: 'Natural Gas', labelCopper: 'Copper',
      labelSteel: 'Steel (HRC)', labelSugar: 'Sugar', labelCoffee: 'Coffee', labelRice: 'Rice (Rough Rice)',
      labelDxy: 'US Dollar Index', labelJpythb: 'JPY/THB', labelEurthb: 'EUR/THB', labelCnythb: 'CNY/THB',
      unitUsdthb: 'THB/USD', unitGc: 'USD/oz', unitGoldw: 'THB/baht-weight', unitOilBbl: 'USD/barrel',
      unitNg: 'USD/MMBtu', unitCopper: 'USD/lb', unitSteel: 'USD/short ton', unitCentLb: 'cents/lb',
      unitRice: 'USD/100cwt', unitDxy: 'points', unitJpythb: 'THB/100 JPY', unitEurthb: 'THB/EUR', unitCnythb: 'THB/CNY'
    }
  };
  function t(key, vars) {
    var s = (I18N[getUILang()] || I18N.th)[key];
    if (s == null) s = (I18N.th[key] != null ? I18N.th[key] : key);
    if (vars) { for (var k in vars) { s = s.split('{' + k + '}').join(vars[k]); } }
    return s;
  }
  function applyStaticI18n() {
    [].forEach.call(document.querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    [].forEach.call(document.querySelectorAll('[data-i18n-html]'), function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    [].forEach.call(document.querySelectorAll('[data-i18n-placeholder]'), function (el) { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
  }

  /* หน้านี้เปิดเป็นป๊อปอัพ (iframe) จาก invest.html ได้ด้วย ?embed=1 — ซ่อน breadcrumb ให้ดูเป็นกล่องเดียวกัน */
  if (new URLSearchParams(location.search).get('embed')) document.body.classList.add('embedded');

  /* ── รายการสินทรัพย์ ──────────────────────────────────────────
     kind: 'yahoo' = ticker เดี่ยวดึงตรง, 'cross' = คำนวณจาก 2 ticker,
           'thaigold' = ราคาทองไทย (thai-gold-api, ไม่มีกราฟย้อนหลัง)
     group: ใช้จัดกลุ่มแถวปุ่มเลือกสินทรัพย์ (pillRow) กันเป็นแถวยาวปนกันไม่มีหมวด
     labelKey/unitKey: คีย์ i18n สำหรับชื่อ/หน่วย — ใช้ assetLabel()/assetUnit() แปลตามภาษาปัจจุบัน */
  var GROUPS = [
    { key: 'fx', labelKey: 'groupFx' },
    { key: 'metal', labelKey: 'groupMetal' },
    { key: 'energy', labelKey: 'groupEnergy' },
    { key: 'agri', labelKey: 'groupAgri' }
  ];
  var ASSETS = [
    { key: 'usdthb', labelKey: 'labelUsdthb', icon: '', kind: 'yahoo', sym: 'THB=X', unitKey: 'unitUsdthb', dp: 3, group: 'fx' },
    { key: 'gc', labelKey: 'labelGc', icon: '', kind: 'yahoo', sym: 'GC=F', unitKey: 'unitGc', dp: 1, group: 'metal' },
    { key: 'goldbar', labelKey: 'labelGoldbar', icon: '▬', kind: 'thaigold', field: 'bar', unitKey: 'unitGoldw', dp: 0, group: 'metal' },
    { key: 'goldjew', labelKey: 'labelGoldjew', icon: '', kind: 'thaigold', field: 'jewelry', unitKey: 'unitGoldw', dp: 0, group: 'metal' },
    { key: 'wti', labelKey: 'labelWti', icon: '', kind: 'yahoo', sym: 'CL=F', unitKey: 'unitOilBbl', dp: 2, group: 'energy' },
    { key: 'brent', labelKey: 'labelBrent', icon: '', kind: 'yahoo', sym: 'BZ=F', unitKey: 'unitOilBbl', dp: 2, group: 'energy' },
    { key: 'ng', labelKey: 'labelNg', icon: '', kind: 'yahoo', sym: 'NG=F', unitKey: 'unitNg', dp: 3, group: 'energy' },
    { key: 'copper', labelKey: 'labelCopper', icon: '', kind: 'yahoo', sym: 'HG=F', unitKey: 'unitCopper', dp: 3, group: 'metal' },
    { key: 'steel', labelKey: 'labelSteel', icon: '', kind: 'yahoo', sym: 'HRC=F', unitKey: 'unitSteel', dp: 1, group: 'metal' },
    { key: 'sugar', labelKey: 'labelSugar', icon: '', kind: 'yahoo', sym: 'SB=F', unitKey: 'unitCentLb', dp: 2, group: 'agri' },
    { key: 'coffee', labelKey: 'labelCoffee', icon: '', kind: 'yahoo', sym: 'KC=F', unitKey: 'unitCentLb', dp: 2, group: 'agri' },
    { key: 'rice', labelKey: 'labelRice', icon: '', kind: 'yahoo', sym: 'ZR=F', unitKey: 'unitRice', dp: 2, group: 'agri' },
    { key: 'dxy', labelKey: 'labelDxy', icon: '', kind: 'yahoo', sym: 'DX-Y.NYB', unitKey: 'unitDxy', dp: 2, group: 'fx' },
    { key: 'jpythb', labelKey: 'labelJpythb', icon: '🇯🇵', kind: 'cross', a: 'THB=X', b: 'JPY=X', op: 'div', mul: 100, unitKey: 'unitJpythb', dp: 3, group: 'fx' },
    { key: 'eurthb', labelKey: 'labelEurthb', icon: '🇪🇺', kind: 'cross', a: 'EURUSD=X', b: 'THB=X', op: 'mul', mul: 1, unitKey: 'unitEurthb', dp: 3, group: 'fx' },
    { key: 'cnythb', labelKey: 'labelCnythb', icon: '🇨🇳', kind: 'cross', a: 'THB=X', b: 'CNY=X', op: 'div', mul: 1, unitKey: 'unitCnythb', dp: 3, group: 'fx' }
  ];
  var byKey = {}; ASSETS.forEach(function (a) { byKey[a.key] = a; });
  function assetLabel(a) { return t(a.labelKey); }
  function assetUnit(a) { return t(a.unitKey); }
  function groupLabel(g) { return t(g.labelKey); }
  /* สินทรัพย์หลักที่โชว์ราคา+% ในแถวสถิติด้านบน (แยกจากแถวปุ่มเลือกที่มีครบทุกตัว — เหมือนแถวบนสุดของเว็บอ้างอิง) */
  var STAT_KEYS = ['usdthb', 'gc', 'goldbar', 'goldjew', 'wti'];

  var LAST_KEY = 'tanot:invest:comm:lastKey';
  var curKey = null, curTF = 63, curType = 'candle';
  var chart = null, seriesObj = null, LWC = null, fullData = null;

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }

  /* ── fetch พื้นฐาน (proxy chain — เหมือน invest-gold.js) ───────── */
  function fetchOne(url, timeoutMs, parser) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
      .then(function (t) { if (to) clearTimeout(to); return parser(t); });
  }
  function proxyTries(base, offset) {
    var enc = encodeURIComponent(base);
    var tries = [
      { url: 'https://api.allorigins.win/raw?url=' + enc },
      { url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { url: 'https://cors.eu.org/' + base },
      { url: 'https://test.cors.workers.dev/?' + base },
      { url: 'https://corsproxy.io/?url=' + enc },
      { url: base }
    ];
    offset = ((offset || 0) % tries.length + tries.length) % tries.length;
    return tries.slice(offset).concat(tries.slice(0, offset));
  }
  function parseQuoteLite(t) {
    var j = JSON.parse(t), res = j && j.chart && j.chart.result && j.chart.result[0];
    var meta = res && res.meta;
    if (!meta || !isFinite(meta.regularMarketPrice)) throw new Error('no meta');
    /* เก็บราคาปิดของ 5 วันล่าสุดไว้ด้วย (มีอยู่แล้วในการตอบกลับนี้ ไม่ต้องยิง fetch เพิ่ม)
       ใช้วาดกราฟเส้นจิ๋ว (sparkline) ในการ์ดสถิติ — เห็นแนวโน้มเร็วๆ แบบแอปการเงินทั่วไป */
    var q = res.indicators && res.indicators.quote && res.indicators.quote[0], spark = [];
    if (q && q.close) spark = q.close.filter(function (v) { return v != null; });
    return { price: meta.regularMarketPrice, prevClose: meta.previousClose, spark: spark };
  }
  function sparkSvg(vals, up) {
    if (!vals || vals.length < 2) return '';
    var w = 100, h = 28, min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var range = Math.max(1e-9, max - min), i, pts = [];
    for (i = 0; i < vals.length; i++) {
      var x = i / (vals.length - 1) * w, y = h - (vals[i] - min) / range * (h - 4) - 2;
      pts.push(x.toFixed(1) + ',' + y.toFixed(1));
    }
    var color = up ? '#17B26A' : '#E5484D';
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function parseYahooSeries(t) {
    var j = JSON.parse(t), res = j && j.chart && j.chart.result && j.chart.result[0];
    var ts = res && res.timestamp, q = res && res.indicators && res.indicators.quote && res.indicators.quote[0];
    if (!ts || !q || !q.close) throw new Error('no data');
    var times = [], opens = [], highs = [], lows = [], closes = [], i;
    for (i = 0; i < ts.length; i++) {
      if (q.close[i] == null) continue;
      times.push(new Date(ts[i] * 1000).toISOString().slice(0, 10));
      opens.push(q.open[i] != null ? q.open[i] : q.close[i]);
      highs.push(q.high[i] != null ? q.high[i] : q.close[i]);
      lows.push(q.low[i] != null ? q.low[i] : q.close[i]);
      closes.push(q.close[i]);
    }
    if (closes.length < 5) throw new Error('short');
    return { times: times, opens: opens, highs: highs, lows: lows, closes: closes };
  }

  /* quote-lite (สำหรับการ์ดสรุป — เบา, range สั้น) — dedupe ต่อ symbol กันยิง proxy ซ้ำ */
  var quoteCacheMem = {}, quotePromises = {}, seqCounter = 0;
  function quoteCacheKey(sym) { return 'tanot:invest:cache:comm:q:' + sym; }
  function saveQuoteCache(sym, q) { try { localStorage.setItem(quoteCacheKey(sym), JSON.stringify({ ts: Date.now(), price: q.price, prevClose: q.prevClose, spark: q.spark })); } catch (e) {} }
  function loadQuoteCache(sym) { try { var o = JSON.parse(localStorage.getItem(quoteCacheKey(sym))); return (o && isFinite(o.price)) ? o : null; } catch (e) { return null; } }
  function getQuote(sym) {
    if (quoteCacheMem[sym]) return Promise.resolve(quoteCacheMem[sym]);
    if (quotePromises[sym]) return quotePromises[sym];
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=5d&interval=1d';
    var tries = proxyTries(base, seqCounter++), i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('fail'));
      return fetchOne(tries[i++].url, 7000, parseQuoteLite).catch(next);
    }
    var p = next().then(function (q) {
      quoteCacheMem[sym] = q; saveQuoteCache(sym, q); return q;
    }, function (e) {
      var c = loadQuoteCache(sym);
      if (c) { quoteCacheMem[sym] = c; return c; }
      throw e;
    });
    quotePromises[sym] = p;
    return p;
  }

  /* series เต็ม 1 ปี (สำหรับกราฟแท่งเทียน) */
  var seriesCacheMem = {}, seriesPromises = {};
  function seriesCacheKey(sym) { return 'tanot:invest:cache:comm:s:' + sym; }
  function saveSeriesCache(sym, s) { try { localStorage.setItem(seriesCacheKey(sym), JSON.stringify({ ts: Date.now(), t: s.times, o: s.opens, h: s.highs, l: s.lows, c: s.closes })); } catch (e) {} }
  function loadSeriesCache(sym) {
    try {
      var o = JSON.parse(localStorage.getItem(seriesCacheKey(sym)));
      if (!o || !o.c || o.c.length < 5) return null;
      return { times: o.t, opens: o.o, highs: o.h, lows: o.l, closes: o.c, cachedAt: o.ts };
    } catch (e) { return null; }
  }
  function getSeries(sym) {
    if (seriesCacheMem[sym]) return Promise.resolve(seriesCacheMem[sym]);
    if (seriesPromises[sym]) return seriesPromises[sym];
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=1y&interval=1d';
    var tries = proxyTries(base, seqCounter++), i = 0, best = null;
    function next() {
      if (i >= tries.length) return best ? Promise.resolve(best) : Promise.reject(new Error('all failed'));
      return fetchOne(tries[i++].url, 8000, parseYahooSeries).then(function (s) {
        if (!best || s.closes.length > best.closes.length) best = s;
        if (best.closes.length >= 60) return best;
        return next();
      }, next);
    }
    var p = next().then(function (s) {
      seriesCacheMem[sym] = { series: s, stale: false }; saveSeriesCache(sym, s);
      return seriesCacheMem[sym];
    }, function (e) {
      var c = loadSeriesCache(sym);
      if (c) { var r = { series: c, stale: true, cachedAt: c.cachedAt }; seriesCacheMem[sym] = r; return r; }
      throw e;
    });
    seriesPromises[sym] = p;
    return p;
  }

  /* ── ราคาทองไทย (thai-gold-api — ใช้ตัวเดียวกันทั้งบาร์/รูปพรรณ) ── */
  var thaiGoldPromise = null;
  function parseGoldTH(t) {
    var j = JSON.parse(t), r = j && j.response;
    if (!r || !r.price || !r.price.gold_bar || !r.price.gold) throw new Error('no data');
    function n(s) { return parseFloat(String(s).replace(/,/g, '')); }
    var bar = r.price.gold_bar, jew = r.price.gold;
    var out = { bar: n(bar.sell), barBuy: n(bar.buy), jewelry: n(jew.sell), jewelryBuy: n(jew.buy), updateDate: r.update_date };
    if (![out.bar, out.barBuy, out.jewelry, out.jewelryBuy].every(isFinite)) throw new Error('bad numbers');
    return out;
  }
  function thaiGoldCacheKey() { return 'tanot:invest:cache:comm:thaigold'; }
  function saveThaiGoldCache(o) { try { var c = {}; for (var k in o) c[k] = o[k]; c.ts = Date.now(); localStorage.setItem(thaiGoldCacheKey(), JSON.stringify(c)); } catch (e) {} }
  function loadThaiGoldCache() { try { var o = JSON.parse(localStorage.getItem(thaiGoldCacheKey())); return (o && isFinite(o.bar)) ? o : null; } catch (e) { return null; } }
  function getThaiGold() {
    if (thaiGoldPromise) return thaiGoldPromise;
    var base = 'https://api.chnwt.dev/thai-gold-api/latest', tries = proxyTries(base, 0).slice();
    /* ลองตรงก่อนเหมือนหน้าทองคำ (API นี้เปิด CORS เอง) แล้วค่อยไล่ proxy */
    tries.unshift({ url: base });
    var i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('all failed'));
      return fetchOne(tries[i++].url, 7000, parseGoldTH).catch(next);
    }
    thaiGoldPromise = next().then(function (o) {
      saveThaiGoldCache(o); return { data: o, stale: false };
    }, function (e) {
      var c = loadThaiGoldCache();
      if (c) return { data: c, stale: true, cachedAt: c.ts };
      throw e;
    });
    return thaiGoldPromise;
  }

  /* ── การ์ดสรุป (เฉพาะสินทรัพย์ใน STAT_KEYS เท่านั้นที่มีการ์ดโชว์ราคา) ── */
  function cardEl(a) {
    return document.querySelector('.stat-card[data-key="' + a.key + '"]');
  }
  function writeCard(a, price, chgPct, spark) {
    var el = cardEl(a); if (!el) return;
    var prEl = el.querySelector('.pr'), chgEl = el.querySelector('.chg'), sparkEl = el.querySelector('.spark');
    if (!isFinite(price)) { prEl.textContent = t('fetchFailShort'); prEl.className = 'pr na'; chgEl.textContent = ''; if (sparkEl) sparkEl.innerHTML = ''; return; }
    prEl.textContent = fmt(price, a.dp); prEl.className = 'pr';
    if (isFinite(chgPct)) {
      chgEl.textContent = (chgPct >= 0 ? '▲' : '▼') + fmt(Math.abs(chgPct), 2) + '%';
      chgEl.className = 'chg ' + (chgPct > 0 ? 'up' : chgPct < 0 ? 'dn' : 'flat');
    } else { chgEl.textContent = ''; }
    if (sparkEl) sparkEl.innerHTML = sparkSvg(spark, !(isFinite(chgPct) && chgPct < 0));
  }
  function loadCardQuote(a) {
    if (a.kind === 'yahoo') {
      getQuote(a.sym).then(function (q) {
        var pct = isFinite(q.prevClose) && q.prevClose ? (q.price / q.prevClose - 1) * 100 : NaN;
        writeCard(a, q.price, pct, q.spark);
      }, function () { writeCard(a, NaN, NaN); });
    } else if (a.kind === 'cross') {
      Promise.all([getQuote(a.a), getQuote(a.b)]).then(function (r) {
        var qa = r[0], qb = r[1];
        var now = crossVal(a, qa.price, qb.price);
        var prevA = isFinite(qa.prevClose) ? qa.prevClose : qa.price, prevB = isFinite(qb.prevClose) ? qb.prevClose : qb.price;
        var prev = crossVal(a, prevA, prevB);
        var pct = isFinite(prev) && prev ? (now / prev - 1) * 100 : NaN;
        writeCard(a, now, pct);
      }, function () { writeCard(a, NaN, NaN); });
    } else if (a.kind === 'thaigold') {
      getThaiGold().then(function (r) { writeCard(a, r.data[a.field], NaN); }, function () { writeCard(a, NaN, NaN); });
    }
  }
  function crossVal(a, va, vb) {
    var r = a.op === 'mul' ? va * vb : va / vb;
    return r * (a.mul || 1);
  }

  function buildGrid() {
    /* แถวสถิติ: การ์ดใหญ่ ราคา+% เฉพาะสินทรัพย์หลัก 5 ตัว (เหมือนแถวบนสุดของเว็บอ้างอิง) */
    var statHtml = '';
    STAT_KEYS.forEach(function (k) {
      var a = byKey[k];
      statHtml += '<button type="button" class="stat-card" data-key="' + a.key + '">' +
        '<span class="ic">' + a.icon + '</span>' +
        '<span class="nm">' + assetLabel(a) + '</span>' +
        '<span class="pr na">' + t('loadingDefault') + '</span>' +
        '<span class="chg"></span>' +
        '<span class="spark"></span></button>';
    });
    $('statRow').innerHTML = statHtml;

    /* แถวปุ่มเลือก: pill ครบทุกสินทรัพย์ (ไม่โชว์ราคา) — ตัวเลือกจริงสำหรับสลับกราฟด้านล่าง
       จัดเป็นกลุ่มตาม GROUPS กันเป็นแถวยาวปนกันไม่มีหมวดหมู่ */
    var pillHtml = '';
    GROUPS.forEach(function (g) {
      var items = ASSETS.filter(function (a) { return a.group === g.key; });
      if (!items.length) return;
      pillHtml += '<div class="pill-group"><span class="pill-group-lbl">' + groupLabel(g) + '</span><div class="pill-group-row">' +
        items.map(function (a) { return '<button type="button" class="pill" data-key="' + a.key + '"><span class="ic">' + a.icon + '</span>' + assetLabel(a) + '</button>'; }).join('') +
        '</div></div>';
    });
    $('pillRow').innerHTML = pillHtml;

    [].forEach.call(document.querySelectorAll('.stat-card, .pill'), function (btn) {
      btn.addEventListener('click', function () { selectAsset(btn.getAttribute('data-key')); });
    });
    /* ทยอยยิงเฉพาะ 5 ตัวในแถวสถิติ (ตัวอื่นดึงตอนกดเลือกจริงในแถวปุ่ม) กัน proxy โดน rate-limit */
    STAT_KEYS.forEach(function (k, i) { setTimeout(function () { loadCardQuote(byKey[k]); }, i * 180); });
  }

  /* ── กราฟแท่งเทียน (lightweight-charts — เหมือน invest-thai-stock.js) ── */
  function themeColors() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark ? { bg: '#1B2030', text: '#C2CBDD', grid: '#2A3040', border: '#2A3040' }
                : { bg: '#FFFFFF', text: '#4A5568', grid: '#EEF1F7', border: '#E4E9F2' };
  }
  function chartWidth(el) { return Math.max(240, (el && (el.clientWidth || el.offsetWidth)) || 320); }
  function baseOpts(w, h) {
    var c = themeColors();
    return {
      width: w, height: h,
      localization: { locale: 'en-US' },
      layout: { background: { color: c.bg }, textColor: c.text, fontFamily: "'Prompt',system-ui,sans-serif" },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, rightOffset: 3, fixLeftEdge: true }
    };
  }
  var themeObs = null, resizeWired = false;
  function setupThemeObserver() {
    if (themeObs) return;
    themeObs = new MutationObserver(function () {
      if (!chart) return;
      var c = themeColors();
      chart.applyOptions({ layout: { background: { color: c.bg }, textColor: c.text }, grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } }, rightPriceScale: { borderColor: c.border }, timeScale: { borderColor: c.border } });
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  function setupResize() {
    if (resizeWired) return; resizeWired = true;
    window.addEventListener('resize', reflow);
    if ('ResizeObserver' in window) { try { new ResizeObserver(reflow).observe($('lwChart')); } catch (e) {} }
  }
  function reflow() {
    var el = $('lwChart');
    if (chart && el) { try { chart.applyOptions({ width: chartWidth(el) }); chart.timeScale().fitContent(); } catch (e) {} }
  }
  function ohlcAt(s, i) { return { time: s.times[i], open: s.opens[i], high: s.highs[i], low: s.lows[i], close: s.closes[i] }; }
  function toCandleData(s) { var out = [], i; for (i = 0; i < s.times.length; i++) out.push(ohlcAt(s, i)); return out; }
  function toLineData(s) { var out = [], i; for (i = 0; i < s.times.length; i++) out.push({ time: s.times[i], value: s.closes[i] }); return out; }

  function buildChart(s) {
    if (!window.LightweightCharts) return false;
    LWC = window.LightweightCharts;
    if (chart) { try { chart.remove(); } catch (e) {} chart = null; seriesObj = null; }
    var el = $('lwChart'); el.innerHTML = '';
    $('chartEmpty').style.display = 'none'; $('chartCap').style.display = 'flex'; el.style.display = 'block';
    chart = LWC.createChart(el, baseOpts(chartWidth(el), 260));
    if (curType === 'candle') {
      seriesObj = chart.addCandlestickSeries({ upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
    } else {
      seriesObj = chart.addLineSeries({ color: '#3B9BEA', lineWidth: 2 });
    }
    applyTF(curTF);
    setupThemeObserver(); setupResize();
    if (window.requestAnimationFrame) requestAnimationFrame(reflow);
    setTimeout(reflow, 120);
    return true;
  }
  function applyTF(n) {
    curTF = n;
    if (!fullData || !seriesObj) return;
    var start = Math.max(0, fullData.times.length - n);
    var sub = { times: fullData.times.slice(start), opens: fullData.opens.slice(start), highs: fullData.highs.slice(start), lows: fullData.lows.slice(start), closes: fullData.closes.slice(start) };
    seriesObj.setData(curType === 'candle' ? toCandleData(sub) : toLineData(sub));
    chart.timeScale().fitContent();
    updateOhlcRow(sub);
    [].forEach.call(document.querySelectorAll('#tfGroup .tf'), function (b) { b.classList.toggle('on', +b.getAttribute('data-tf') === n); });
  }
  function updateOhlcRow(sub) {
    var n = sub.closes.length; if (!n) return;
    var last = ohlcAt(sub, n - 1);
    var prevClose = n >= 2 ? sub.closes[n - 2] : last.open;
    var chg = last.close - prevClose, pct = prevClose ? chg / prevClose * 100 : NaN;
    var dp = byKey[curKey] ? byKey[curKey].dp : 2;
    $('oOpen').textContent = fmt(last.open, dp);
    $('oHigh').textContent = fmt(last.high, dp);
    $('oLow').textContent = fmt(last.low, dp);
    $('oClose').textContent = fmt(last.close, dp);
    var chgEl = $('oChg');
    chgEl.textContent = (chg >= 0 ? '+' : '') + fmt(chg, dp) + (isFinite(pct) ? ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 2) + '%)' : '');
    chgEl.className = 'v ' + (chg > 0 ? 'up' : chg < 0 ? 'dn' : '');
    $('ohlcRow').style.display = 'grid';
  }

  /* ── ตารางราคาย้อนหลัง (ล่าสุด 30 วัน — เหมือนตารางท้ายหน้าของเว็บอ้างอิง) ── */
  var HIST_DAYS = 30;
  function renderHistTable(s, a) {
    var titleEl = $('histTitle'); if (titleEl) titleEl.textContent = t('histTitleWithAsset', { label: assetLabel(a), n: Math.min(HIST_DAYS, s.times.length) });
    var tbl = $('histTable'); if (!tbl) return;
    var n = s.times.length;
    if (!n) { tbl.innerHTML = ''; return; }
    var start = Math.max(0, n - HIST_DAYS);
    var rows = '';
    for (var i = n - 1; i >= start; i--) {
      var bar = ohlcAt(s, i);
      var prevClose = i > 0 ? s.closes[i - 1] : bar.open;
      var chg = bar.close - prevClose, pct = prevClose ? chg / prevClose * 100 : NaN;
      var dateTxt = new Date(bar.time).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
      rows += '<tr><td>' + dateTxt + '</td><td>' + fmt(bar.open, a.dp) + '</td>' +
        '<td class="hi">' + fmt(bar.high, a.dp) + '</td><td class="lo">' + fmt(bar.low, a.dp) + '</td>' +
        '<td>' + fmt(bar.close, a.dp) + '</td>' +
        '<td class="chg ' + (chg > 0 ? 'up' : chg < 0 ? 'dn' : '') + '">' + (chg >= 0 ? '+' : '') + fmt(chg, a.dp) + (isFinite(pct) ? ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 2) + '%)' : '') + '</td></tr>';
    }
    tbl.innerHTML = '<thead><tr><th>' + t('histThDate') + '</th><th>' + t('histThOpen') + '</th><th>' + t('histThHigh') + '</th><th>' + t('histThLow') + '</th><th>' + t('histThClose') + '</th><th>' + t('histThChg') + '</th></tr></thead><tbody>' + rows + '</tbody>';
  }

  /* คำนวณ series cross จาก 2 series จริง (จับคู่ตามวันที่ตรงกัน) — ประมาณค่าต่อองค์ประกอบ OHLC
     (ไม่ใช่ tick-by-tick จริง แต่เป็นวิธีที่ใช้ทั่วไปสำหรับกราฟ cross-rate โดยประมาณ) */
  function crossSeries(a, sa, sb) {
    var mapB = {}, i;
    for (i = 0; i < sb.times.length; i++) mapB[sb.times[i]] = ohlcAt(sb, i);
    var times = [], opens = [], highs = [], lows = [], closes = [];
    for (i = 0; i < sa.times.length; i++) {
      var bBar = mapB[sa.times[i]]; if (!bBar) continue;
      var aBar = ohlcAt(sa, i);
      times.push(sa.times[i]);
      opens.push(crossVal(a, aBar.open, bBar.open));
      highs.push(crossVal(a, aBar.high, bBar.high));
      lows.push(crossVal(a, aBar.low, bBar.low));
      closes.push(crossVal(a, aBar.close, bBar.close));
    }
    return { times: times, opens: opens, highs: highs, lows: lows, closes: closes };
  }

  function setDetailStatus(msg, cls) {
    var el = $('dSrcBadge'); el.textContent = msg; el.className = 'src-badge' + (cls ? ' ' + cls : '');
  }

  function selectAsset(key) {
    var a = byKey[key]; if (!a) return;
    curKey = key;
    try { localStorage.setItem(LAST_KEY, key); } catch (e) {}
    [].forEach.call(document.querySelectorAll('.stat-card, .pill'), function (el) { el.classList.toggle('on', el.getAttribute('data-key') === key); });
    $('dIcon').textContent = a.icon; $('dName').textContent = assetLabel(a); $('dUnit').textContent = assetUnit(a);
    $('ohlcRow').style.display = 'none';
    fullData = null;

    if (a.kind === 'thaigold') {
      setDetailStatus(t('loadingDefault'));
      if (chart) { try { chart.remove(); } catch (e) {} chart = null; seriesObj = null; }
      $('lwChart').style.display = 'none';
      $('chartCap').style.display = 'none';
      $('chartEmpty').style.display = 'block';
      $('chartEmpty').textContent = t('goldNoHistEmpty');
      $('histTitle').textContent = t('goldNoHistTitle');
      $('histTable').innerHTML = '';
      getThaiGold().then(function (r) {
        setDetailStatus(r.stale ? t('goldStale') : t('goldLiveToday') + (r.data.updateDate ? (' · ' + r.data.updateDate) : ''), 'real');
        writeCard(a, r.data[a.field], NaN);
      }, function () { setDetailStatus(t('goldFail'), 'paste'); });
      return;
    }

    setDetailStatus(t('loadingChart'));
    $('lwChart').style.display = 'none'; $('chartEmpty').style.display = 'block'; $('chartEmpty').textContent = t('loadingDefault');

    var seriesPromise;
    if (a.kind === 'yahoo') {
      seriesPromise = getSeries(a.sym).then(function (r) { return { s: r.series, stale: r.stale, cachedAt: r.cachedAt }; });
    } else {
      seriesPromise = Promise.all([getSeries(a.a), getSeries(a.b)]).then(function (r) {
        return { s: crossSeries(a, r[0].series, r[1].series), stale: r[0].stale || r[1].stale, cachedAt: r[0].cachedAt };
      });
    }
    seriesPromise.then(function (r) {
      if (curKey !== key) return; /* ผู้ใช้กดการ์ดอื่นไปแล้วระหว่างรอโหลด */
      if (!r.s.times.length) throw new Error('empty');
      fullData = r.s;
      setDetailStatus(r.stale ? t('seriesStale') : t('seriesReal'), 'real');
      if (!buildChart(r.s)) setDetailStatus(t('chartLibFail'), 'paste');
      renderHistTable(r.s, a);
    }, function () {
      if (curKey !== key) return;
      setDetailStatus(t('seriesFail'), 'paste');
      $('chartEmpty').textContent = t('chartEmptyFail');
      $('histTitle').textContent = t('histTitleFail');
      $('histTable').innerHTML = '';
    });
  }

  /* ── init ───────────────────────────────────────────────────── */
  function init() {
    applyStaticI18n();
    buildGrid();
    [].forEach.call(document.querySelectorAll('#tfGroup .tf'), function (b) {
      b.addEventListener('click', function () { applyTF(+b.getAttribute('data-tf')); });
    });
    [].forEach.call(document.querySelectorAll('#ctypeGroup button'), function (b) {
      b.addEventListener('click', function () {
        curType = b.getAttribute('data-ct');
        [].forEach.call(document.querySelectorAll('#ctypeGroup button'), function (x) { x.classList.toggle('on', x === b); });
        if (fullData) buildChart(fullData);
      });
    });
    var last = null;
    try { last = localStorage.getItem(LAST_KEY); } catch (e) {}
    selectAsset(byKey[last] ? last : 'gc');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.omeApplyLang = function () {
    applyStaticI18n();
    buildGrid();
    if (curKey) selectAsset(curKey);
  };

  window.__commodities = { crossVal: crossVal, ASSETS: ASSETS };
})();
