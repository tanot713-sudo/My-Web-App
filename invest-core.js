/* ══════════════════════════════════════════════════════════════════
   Tanot — ส่วนกลางฝั่งเบราว์เซอร์ของโซนลงทุน (ยุบรวมหน้าลงทุน, docs/invest-consolidation-design.md หัวข้อ 5.2)
   window.InvestCore — ดึงราคา/ข่าว/อัตราแลกเปลี่ยน (ผ่าน /api/proxy ของเว็บเองอย่างเดียว) + แคช + Live Gateway + AI คลาวด์ + UI กลาง
   โหลดหลัง invest-calc.js และ data-registry.js · ทุกฟังก์ชันที่ดึงเน็ต: สำเร็จ → เขียนแคช · ล้มเหลว → คืนแคชพร้อม stale:true ·
   ไม่มีแคช → reject (หน้าแสดงช่องกรอกเอง ห้ามแสดง error แข็ง)
   ห้ามเพิ่ม public CORS proxy กลับมา (ตัดแล้ว 2026-10) · ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var Calc = window.InvestCalc;
  var P = 'tanot:invest:';
  var YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/';

  /* ═══ ตัวช่วยทั่วไป ═══ */
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function money(n, ccy, d) {
    if (!isFinite(n)) return '—';
    var neg = n < 0, v = Math.abs(n), sym = ccy === 'USD' ? '$' : '฿';
    if (d == null) d = ccy === 'USD' ? 2 : 0;
    return (neg ? '−' : '') + sym + v.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function pct(n, d) { return isFinite(n) ? fmt(n, d == null ? 2 : d) + '%' : '—'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsJson(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch (e) { return false; } }
  function getLang() { return lsGet('ome:lang') === 'en' ? 'en' : 'th'; }

  /* ═══ ภาษา (ไทย/English) — อ่าน ome:lang จุดกลางเดียว + window.omeApplyLang ร่วม (shell.js เรียกตอนสลับภาษา) ═══ */
  var langListeners = [];
  function onLang(fn) { langListeners.push(fn); }
  window.omeApplyLang = function () { langListeners.forEach(function (fn) { try { fn(); } catch (e) { if (window.console) console.error(e); } }); };
  /* i18n(dict) → { t(key, vars), apply(root?) } — dict = { th: {...}, en: {...} } · data-i18n (ข้อความ) / data-i18n-html / data-i18n-placeholder */
  function i18n(dict) {
    function t(key, vars) {
      var s = (dict[getLang()] || dict.th || {})[key];
      if (s == null) s = (dict.th && dict.th[key] != null) ? dict.th[key] : key;
      if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
      return s;
    }
    function apply(root) {
      root = root || document;
      [].forEach.call(root.querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
      [].forEach.call(root.querySelectorAll('[data-i18n-html]'), function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
      [].forEach.call(root.querySelectorAll('[data-i18n-placeholder]'), function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
    }
    return { t: t, apply: apply };
  }
  var CORE = i18n({
    th: { agoNow: 'เมื่อสักครู่', agoMin: '{n} นาทีก่อน', agoHr: '{n} ชม.ก่อน', agoDay: '{n} วันก่อน',
      overview: 'ภาพรวม',
      liveTitle: 'ข้อมูลตลาดแบบสด', liveProvider: 'แหล่งข้อมูล', liveGateway: 'Tanot Data Gateway (แนะนำ)', liveTwelve: 'Twelve Data', liveYahoo: 'Yahoo / ย้อนหลัง',
      liveGatewayUrl: 'ที่อยู่ Gateway', liveKey: 'Twelve Data API Key (เก็บในเครื่องเท่านั้น)', liveKeyPh: 'ใส่เมื่อมี API key', liveEvery: 'รีเฟรชทุก', liveSec: '{n} วินาที',
      liveSave: 'บันทึก', liveClearKey: 'ล้าง API Key', liveClose: 'ปิด', liveSaved: 'บันทึกการตั้งค่าแล้ว', liveKeyCleared: 'ล้าง API Key แล้ว',
      aiUnavailable: 'สรุปด้วย AI ใช้ได้เฉพาะบน pages.dev',
      checkDone: 'ผ่าน', checkFail: 'ไม่ผ่าน', checkUnknown: 'ยังไม่ทราบ' },
    en: { agoNow: 'just now', agoMin: '{n} min ago', agoHr: '{n} hr ago', agoDay: '{n} days ago',
      overview: 'Overview',
      liveTitle: 'Live market data', liveProvider: 'Data source', liveGateway: 'Tanot Data Gateway (recommended)', liveTwelve: 'Twelve Data', liveYahoo: 'Yahoo / historical',
      liveGatewayUrl: 'Gateway address', liveKey: 'Twelve Data API key (stored on this device only)', liveKeyPh: 'Enter if you have an API key', liveEvery: 'Refresh every', liveSec: '{n} sec',
      liveSave: 'Save', liveClearKey: 'Clear API key', liveClose: 'Close', liveSaved: 'Settings saved', liveKeyCleared: 'API key cleared',
      aiUnavailable: 'AI summary is available only on pages.dev',
      checkDone: 'Pass', checkFail: 'Fail', checkUnknown: 'Unknown' }
  });
  function ago(ts) {
    if (!ts) return '';
    var mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return CORE.t('agoNow');
    if (mins < 60) return CORE.t('agoMin', { n: mins });
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return CORE.t('agoHr', { n: hrs });
    return CORE.t('agoDay', { n: Math.round(hrs / 24) });
  }

  /* ═══ ui (tanot:invest:ui — local): แท็บล่าสุด/ช่วงกราฟ/ธงล้างแคช · อ่านสด → แก้ → เขียนเสมอ ═══ */
  var UI_KEY = P + 'ui';
  var ui = {
    get: function () { var o = lsJson(UI_KEY); return (o && typeof o === 'object') ? o : {}; },
    set: function (patch) {
      var o = ui.get();
      Object.keys(patch).forEach(function (k) {
        if (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k]) && o[k] && typeof o[k] === 'object') {
          Object.keys(patch[k]).forEach(function (kk) { o[k][kk] = patch[k][kk]; });
        } else o[k] = patch[k];
      });
      lsSet(UI_KEY, o);
      return o;
    }
  };

  /* ═══ เครือข่าย — /api/proxy ของเว็บเองอย่างเดียว (+ fetch ตรงเฉพาะ API ที่เปิด CORS เอง) ═══ */
  function proxied(url) { return '/api/proxy?url=' + encodeURIComponent(url); }
  /* /api/proxy มีเฉพาะ *.pages.dev (python3 -m http.server / GitHub Pages ไม่มี) — นอกนั้นไม่ยิงเน็ตเลย ได้แคช/กรอกเอง
     เทสต์เปิดด้วย window.TANOT_PROXY = { enabled: true } (แบบเดียวกับ TANOT_AI / TANOT_SYNC) */
  function netEnabled() {
    if (window.TANOT_PROXY && typeof window.TANOT_PROXY.enabled === 'boolean') return window.TANOT_PROXY.enabled;
    return /\.pages\.dev$/.test(location.hostname);
  }
  function fetchOnce(url, timeout) {
    if (!netEnabled()) return Promise.reject(new Error('network disabled'));
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout || 8000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal, credentials: 'same-origin' } : undefined)
      .then(function (r) { if (to) clearTimeout(to); if (!r.ok) throw new Error('http ' + r.status); return r.text(); },
        function (e) { if (to) clearTimeout(to); throw e; });
  }
  /* direct:true = ลองตรงก่อนแล้วค่อย proxy (API ที่เปิด CORS เอง เช่น alternative.me, api.chnwt.dev) */
  function fetchText(url, opts) {
    opts = opts || {};
    var t = opts.timeout || 8000;
    var viaProxy = function () { return fetchOnce(proxied(url), t); };
    return opts.direct ? fetchOnce(url, t).catch(viaProxy) : viaProxy();
  }
  function fetchParsed(url, parser, opts) {
    return fetchText(url, opts).then(function (txt) { return parser(JSON.parse(txt)); });
  }
  /* คำขอสัญลักษณ์เดียวกันที่ยิงพร้อมกันใช้ promise เดียว */
  var inflight = {};
  function dedupe(key, fn) {
    if (inflight[key]) return inflight[key];
    var p = fn().then(function (v) { delete inflight[key]; return v; }, function (e) { delete inflight[key]; throw e; });
    inflight[key] = p;
    return p;
  }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  /* ยิงเป็นชุดทีละตัว หน่วง gap ms ระหว่างตัว (ไม่รัวใส่ proxy) → Promise<[ผลหรือ null]> */
  function sequence(items, fn, gap) {
    var out = [], i = 0;
    function next() {
      if (i >= items.length) return Promise.resolve(out);
      var idx = i++;
      return Promise.resolve().then(function () { return fn(items[idx], idx); }).then(function (v) { out[idx] = v; }, function () { out[idx] = null; })
        .then(function () { return idx < items.length - 1 ? delay(gap == null ? 260 : gap) : null; }).then(next);
    }
    return next();
  }

  function seriesKey(sym) { return Calc.seriesKey(sym); }
  function quoteKey(sym) { return Calc.quoteKey(sym); }

  /* series เต็ม (กราฟ + วิเคราะห์) — แคช {ts, t, o, h, l, c, v} ที่ seriesKey() */
  function saveSeries(sym, s) {
    lsSet(seriesKey(sym), { ts: Date.now(), t: s.times, o: s.ohlc.map(function (b) { return b.open; }), h: s.highs, l: s.lows, c: s.closes, v: s.vol.map(function (b) { return b.value; }) });
  }
  function loadSeries(sym) {
    var o = lsJson(seriesKey(sym));
    if (!o || !o.c || o.c.length < 5) return null;
    var s = Calc.toSeries(o.t, o.o || o.c, o.h, o.l, o.c, o.v); s.cachedAt = o.ts;
    return s;
  }
  /* opts.range ('1y' ค่าเริ่ม) · opts.maxAge ms = ถ้าแคชใหม่กว่านี้ใช้เลยไม่ยิงเน็ต */
  function series(sym, opts) {
    opts = opts || {};
    var cached = loadSeries(sym);
    if (cached && opts.maxAge && Date.now() - cached.cachedAt < opts.maxAge) return Promise.resolve({ series: cached, stale: false, cachedAt: cached.cachedAt });
    return dedupe('s:' + sym + ':' + (opts.range || '1y'), function () {
      return fetchParsed(YAHOO + encodeURIComponent(sym) + '?range=' + (opts.range || '1y') + '&interval=1d', Calc.parseYahoo, { timeout: 9000 }).then(function (s) {
        saveSeries(sym, s); s.cachedAt = Date.now();
        return { series: s, stale: false, cachedAt: s.cachedAt };
      }, function (e) {
        if (cached) return { series: cached, stale: true, cachedAt: cached.cachedAt };
        throw e;
      });
    });
  }

  /* quote ย่อ 5 วัน — แคช {ts, price, prev, spark} ที่ quoteKey() · ตลาดปิดแน่ๆ + มีแคช = ไม่ยิงซ้ำ (force ข้าม) */
  function marketLikelyOpen(sym) {
    if (/-USD$/.test(sym) || /=F$/.test(sym) || /=X$/.test(sym) || sym === 'DX-Y.NYB') return true;
    var now = new Date(), day = now.getDay();
    if (day === 0 || day === 6) return false;
    if (/\.BK$/.test(sym) || /^\^SET/.test(sym)) { var h = (now.getUTCHours() + 7) % 24; return h >= 9 && h < 17; }
    return true;
  }
  function quote(sym, opts) {
    opts = opts || {};
    var o = lsJson(quoteKey(sym)), cached = (o && isFinite(o.price)) ? o : null;
    var maxAge = opts.maxAge != null ? opts.maxAge : 3600000;
    if (cached && !opts.force && (Date.now() - cached.ts < maxAge || !marketLikelyOpen(sym))) return Promise.resolve({ price: cached.price, prev: cached.prev, spark: cached.spark || [], ts: cached.ts, stale: false });
    return dedupe('q:' + sym, function () {
      return fetchParsed(YAHOO + encodeURIComponent(sym) + '?range=5d&interval=1d', Calc.parseQuoteLite, { timeout: 7000 }).then(function (q) {
        var rec = { ts: Date.now(), price: q.price, prev: q.prev, spark: q.spark };
        lsSet(quoteKey(sym), rec);
        return { price: q.price, prev: q.prev, spark: q.spark, ts: rec.ts, stale: false };
      }, function (e) {
        if (cached) return { price: cached.price, prev: cached.prev, spark: cached.spark || [], ts: cached.ts, stale: true };
        throw e;
      });
    });
  }

  /* อัตราแลกเปลี่ยน USD→THB — ไม่มีอัตรา = reject (ห้ามใช้ค่าเดา) */
  function fx(ccy, opts) {
    opts = opts || {};
    var o = lsJson(Calc.FX_KEY), cached = (o && isFinite(o.rate) && o.rate > 0) ? o : null;
    if (cached && !opts.force && Date.now() - cached.ts < 3600000) return Promise.resolve({ rate: cached.rate, ts: cached.ts, stale: false });
    return dedupe('fx', function () {
      return fetchParsed(YAHOO + 'THB%3DX?range=5d&interval=1d', Calc.parseFxRate, { timeout: 7000 }).then(function (rate) {
        var rec = { ts: Date.now(), rate: rate }; lsSet(Calc.FX_KEY, rec);
        return { rate: rate, ts: rec.ts, stale: false };
      }, function (e) {
        if (cached) return { rate: cached.rate, ts: cached.ts, stale: true };
        throw e;
      });
    });
  }

  /* ราคาทองไทย (thai-gold-api) — API เปิด CORS เอง: ลองตรงก่อนแล้วค่อย proxy */
  function thaiGold(opts) {
    opts = opts || {};
    var o = lsJson(Calc.GOLD_TH_KEY), cached = (o && isFinite(o.barBuyPrice)) ? o : null;
    if (cached && !opts.force && Date.now() - cached.ts < 600000) { var c0 = Object.assign({}, cached); c0.stale = false; return Promise.resolve(c0); }
    return dedupe('goldth', function () {
      return fetchParsed('https://api.chnwt.dev/thai-gold-api/latest', Calc.parseGoldTH, { timeout: 7000, direct: true }).then(function (g) {
        g.ts = Date.now(); lsSet(Calc.GOLD_TH_KEY, g); g.stale = false;
        return g;
      }, function (e) {
        if (cached) { var c1 = Object.assign({}, cached); c1.stale = true; return c1; }
        throw e;
      });
    });
  }

  /* ดัชนีความกลัว-ความโลภ (alternative.me) */
  var FNG_KEY = P + 'cache:fng';
  function fng(opts) {
    opts = opts || {};
    var o = lsJson(FNG_KEY), cached = (o && isFinite(o.value)) ? o : null;
    if (cached && !opts.force && Date.now() - cached.ts < 3600000) return Promise.resolve({ value: cached.value, classification: cached.classification, ts: cached.ts, stale: false });
    return dedupe('fng', function () {
      return fetchParsed('https://api.alternative.me/fng/?limit=1&format=json', Calc.parseFng, { timeout: 7000, direct: true }).then(function (r) {
        var rec = { ts: Date.now(), value: r.value, classification: r.classification }; lsSet(FNG_KEY, rec);
        return { value: r.value, classification: r.classification, ts: rec.ts, stale: false };
      }, function (e) {
        if (cached) return { value: cached.value, classification: cached.classification, ts: cached.ts, stale: true };
        throw e;
      });
    });
  }

  /* ข่าว Google News RSS — แสดงเฉพาะหัวข้อ+ที่มา+เวลา+ลิงก์ (ไม่ดึงเนื้อหาเต็ม) · แคช newscache:q:<query> {ts, items≤20} */
  function parseNewsRss(txt) {
    var xml = new DOMParser().parseFromString(txt, 'text/xml');
    if (xml.querySelector('parsererror')) throw new Error('parse error');
    var items = [].slice.call(xml.querySelectorAll('item')).slice(0, 20).map(function (it) {
      var title = it.querySelector('title'), link = it.querySelector('link'), pub = it.querySelector('pubDate'), src = it.querySelector('source');
      return { title: title ? title.textContent : '', link: link ? link.textContent : '#', pubDate: pub ? pub.textContent : '', source: src ? src.textContent : '' };
    }).filter(function (n) { return n.title; });
    if (!items.length) throw new Error('no items');
    return items;
  }
  function newsUrl(query) { return 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=th&gl=TH&ceid=TH:th'; }
  function newsSearchUrl(query) { return 'https://news.google.com/search?q=' + encodeURIComponent(query) + '&hl=th&gl=TH&ceid=TH:th'; }
  function news(query, opts) {
    opts = opts || {};
    var key = P + 'newscache:q:' + query;
    var o = lsJson(key), cached = (o && o.items) ? o : null;
    var limit = opts.limit || 20, maxAge = opts.maxAge != null ? opts.maxAge : 2 * 3600000;
    function out(items, stale, ts) { return { items: items.slice(0, limit), stale: stale, cachedAt: ts }; }
    if (cached && !opts.force && Date.now() - cached.ts < maxAge) return Promise.resolve(out(cached.items, false, cached.ts));
    return dedupe('n:' + query, function () {
      return fetchText(newsUrl(query), { timeout: 8000 }).then(parseNewsRss).then(function (items) {
        var ts = Date.now(); lsSet(key, { ts: ts, items: items });
        return out(items, false, ts);
      }, function (e) {
        if (cached) return out(cached.items, true, cached.ts);
        throw e;
      });
    });
  }
  function newsDate(pubDate, t) {
    var d = pubDate ? new Date(pubDate) : null;
    if (!d || isNaN(d)) return '';
    var mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 60) return mins <= 1 ? CORE.t('agoNow') : CORE.t('agoMin', { n: mins });
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return CORE.t('agoHr', { n: hrs });
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: hrs > 24 * 300 ? '2-digit' : undefined });
  }

  /* ═══ Live Gateway / Twelve Data (เก็บไว้ตามที่เจ้าของเลือก — คีย์เดิม tanot:market:live-config:v1 เก็บในเครื่องเท่านั้น) ═══ */
  var LIVE_KEY = 'tanot:market:live-config:v1';
  var liveTimer = null, liveBusy = false, liveDlg = null;
  function liveCfg() {
    var d = { provider: 'gateway', gateway: '', apiKey: '', interval: 5 };
    var x = lsJson(LIVE_KEY) || {};
    Object.keys(d).forEach(function (k) { if (x[k] != null) d[k] = x[k]; });
    return d;
  }
  function liveSave(c) { lsSet(LIVE_KEY, c); }
  function fetchJson(url, timeout) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout || 6000) : null;
    return fetch(url, Object.assign({ headers: { 'Accept': 'application/json' } }, ctrl ? { signal: ctrl.signal } : {})).then(function (r) {
      if (to) clearTimeout(to);
      return r.text().then(function (txt) {
        var j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
        if (!r.ok) throw new Error((j && (j.message || j.error)) || ('HTTP ' + r.status));
        return j || {};
      });
    }, function (e) { if (to) clearTimeout(to); throw e; });
  }
  function normalizeLiveQuote(j, sym) {
    var q = j && (j.quote || j.data || j.result || j); q = q && (q.data || q.quote || q);
    var price = Number(q && (q.price != null ? q.price : (q.close != null ? q.close : q.last)));
    if (!isFinite(price)) throw new Error('quote price missing');
    var prev = Number(q.previous_close != null ? q.previous_close : (q.prev_close != null ? q.prev_close : q.previousClose));
    var ch = Number(q.change), pc = Number(q.percent_change != null ? q.percent_change : q.percentChange);
    if (!isFinite(ch) && isFinite(prev)) ch = price - prev;
    if (!isFinite(pc) && isFinite(prev) && prev) pc = ch / prev * 100;
    return { sym: sym, price: price, previous: prev, change: ch, pct: pc, volume: Number(q.volume), timestamp: Number(q.timestamp || q.last_quote_at || Date.now() / 1000) * 1000, marketOpen: q.is_market_open !== false, source: q.source || 'gateway' };
  }
  /* market: 'th' (ชื่อย่อไม่มี .BK, exchange=SET) | 'us' | 'btc' (BTC-USD; Twelve Data ใช้ BTC/USD) → quote สด หรือ reject (provider = yahoo/ไม่ได้ตั้งค่า) */
  function liveQuote(sym, market) {
    var c = liveCfg();
    if (c.provider === 'twelvedata') {
      if (!c.apiKey) return Promise.reject(new Error('Twelve Data API key missing'));
      var tdSym = market === 'btc' ? sym.replace('-', '/') : sym;
      var u = 'https://api.twelvedata.com/quote?symbol=' + encodeURIComponent(tdSym) + (market === 'th' ? '&exchange=SET' : '') + '&apikey=' + encodeURIComponent(c.apiKey);
      return fetchJson(u).then(function (j) { if (j && j.status === 'error') throw new Error(j.message || 'Twelve Data error'); var q = normalizeLiveQuote(j, sym); q.source = 'Twelve Data'; return q; });
    }
    if (c.provider === 'gateway') {
      var base = (c.gateway || '').replace(/\/$/, '');
      if (!base) return Promise.reject(new Error('gateway not configured'));
      return fetchJson(base + '/quote?symbol=' + encodeURIComponent(sym)).then(function (j) { var q = normalizeLiveQuote(j, sym); q.source = 'Tanot Gateway'; return q; });
    }
    return Promise.reject(new Error('historical'));
  }
  function liveStop() { if (liveTimer) { clearInterval(liveTimer); liveTimer = null; } }
  /* getSym() คืนสัญลักษณ์ปัจจุบัน (หน้าหุ้นเปลี่ยนตัวได้) · onQuote(q) / onError(err) · provider = yahoo → ไม่ทำอะไร (คืน false) */
  function liveStart(getSym, market, onQuote, onError) {
    liveStop();
    var c = liveCfg();
    if (c.provider === 'yahoo') return false;
    function tick() {
      if (liveBusy) return;
      var sym = typeof getSym === 'function' ? getSym() : getSym;
      if (!sym) return;
      liveBusy = true;
      liveQuote(sym, market).then(onQuote, function (e) { if (onError) onError(e); }).then(function () { liveBusy = false; }, function () { liveBusy = false; });
    }
    liveTimer = setInterval(tick, Math.max(5, Number(c.interval) || 5) * 1000);
    window.addEventListener('beforeunload', liveStop);
    tick();
    return true;
  }
  /* กล่องตั้งค่าเดียวใช้ทุกหน้าที่มีราคาสด — <dialog class="dialog"> สร้างครั้งแรกที่เปิด · onSaved() หลังบันทึก */
  function liveOpenSettings(onSaved) {
    if (typeof HTMLDialogElement === 'undefined') return;
    if (!liveDlg) {
      var dlg = document.createElement('dialog');
      dlg.className = 'dialog'; dlg.id = 'investLiveDialog'; dlg.setAttribute('aria-modal', 'true');
      dlg.innerHTML =
        '<div class="dialog-head"><h2 data-core="liveTitle"></h2></div>' +
        '<div class="dialog-body stack">' +
          '<div class="field"><label for="ilProvider" data-core="liveProvider"></label><select id="ilProvider"><option value="gateway" data-core="liveGateway"></option><option value="twelvedata" data-core="liveTwelve"></option><option value="yahoo" data-core="liveYahoo"></option></select></div>' +
          '<div class="field"><label for="ilGateway" data-core="liveGatewayUrl"></label><input class="input" id="ilGateway" type="url" inputmode="url" autocomplete="off" placeholder="https://"></div>' +
          '<div class="field"><label for="ilKey" data-core="liveKey"></label><input class="input" id="ilKey" type="password" autocomplete="off" data-core-ph="liveKeyPh"></div>' +
          '<div class="field"><label for="ilEvery" data-core="liveEvery"></label><select id="ilEvery"><option value="5"></option><option value="10"></option><option value="30"></option></select></div>' +
          '<div class="status" id="ilStatus" role="status"></div>' +
        '</div>' +
        '<div class="dialog-foot"><button type="button" class="btn ghost" id="ilClear" data-core="liveClearKey"></button><button type="button" class="btn" id="ilClose" data-core="liveClose"></button><button type="button" class="btn primary" id="ilSave" data-core="liveSave"></button></div>';
      document.body.appendChild(dlg);
      liveDlg = dlg;
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      dlg.querySelector('#ilClose').addEventListener('click', function () { dlg.close(); });
      dlg.querySelector('#ilSave').addEventListener('click', function () {
        var c = liveCfg();
        liveSave({ provider: dlg.querySelector('#ilProvider').value, gateway: dlg.querySelector('#ilGateway').value.trim(), apiKey: dlg.querySelector('#ilKey').value.trim() || c.apiKey, interval: Number(dlg.querySelector('#ilEvery').value) || 5 });
        dlg.querySelector('#ilKey').value = '';
        dlg.querySelector('#ilStatus').textContent = CORE.t('liveSaved');
        if (dlg._onSaved) dlg._onSaved();
      });
      dlg.querySelector('#ilClear').addEventListener('click', function () {
        var c = liveCfg(); c.apiKey = ''; liveSave(c);
        dlg.querySelector('#ilKey').value = ''; dlg.querySelector('#ilStatus').textContent = CORE.t('liveKeyCleared');
        if (dlg._onSaved) dlg._onSaved();
      });
    }
    var d = liveDlg;
    [].forEach.call(d.querySelectorAll('[data-core]'), function (el) { el.textContent = CORE.t(el.getAttribute('data-core')); });
    [].forEach.call(d.querySelectorAll('[data-core-ph]'), function (el) { el.setAttribute('placeholder', CORE.t(el.getAttribute('data-core-ph'))); });
    [].forEach.call(d.querySelectorAll('#ilEvery option'), function (o) { o.textContent = CORE.t('liveSec', { n: o.value }); });
    var c = liveCfg();
    d.querySelector('#ilProvider').value = c.provider; d.querySelector('#ilGateway').value = c.gateway || '';
    d.querySelector('#ilKey').value = ''; d.querySelector('#ilEvery').value = String(c.interval || 5);
    d.querySelector('#ilStatus').textContent = '';
    d._onSaved = onSaved || null;
    if (!d.open) d.showModal();
  }

  /* ═══ AI คลาวด์อย่างเดียว (ตัดโมเดลในเบราว์เซอร์ออกจากหน้าลงทุนแล้ว — ห้ามสร้าง ai-chat-worker จากหน้าลงทุน) ═══ */
  function aiAvailable() { return !!(window.AiClient && window.AiClient.available && window.AiClient.available()); }
  /* โมเดลเล็ก/ใหญ่บางครั้ง "พูดตาม" ข้อความ system/reminder ที่สั่งห้ามทำนี่นั่นออกมาเป็นเนื้อหาจริง — กรองบรรทัดที่ขึ้นต้น "ห้าม"/"Never" ทิ้ง */
  function stripLeaked(text) {
    return (text || '').split('\n').filter(function (line) { return !/^\s*(ห้าม|Never\b)/i.test(line); }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  /* task = ป้ายแคช D1 เดิม (stock:thaistock, stock:globalstock, stock:bitcoin, stock:gold, stock:commodities) → Promise<text> (ผ่าน stripLeaked แล้ว)
     ไม่ใช่ pages.dev → reject code 'unavailable' · ล้มเหลว → reject (หน้าแสดง AiClient.friendlyMessage(err)) — ไม่ถอยไปโมเดลในเบราว์เซอร์ */
  function summarize(o) {
    if (!aiAvailable()) { var e = new Error(CORE.t('aiUnavailable')); e.code = 'unavailable'; return Promise.reject(e); }
    return window.AiClient.summarize({ task: o.task, messages: o.messages }).then(function (r) { return stripLeaked(r.text); });
  }
  function aiMessage(err) { return (window.AiClient && window.AiClient.friendlyMessage) ? window.AiClient.friendlyMessage(err) : ((err && err.message) || ''); }

  /* ═══ UI กลาง ═══ */
  /* tabs — กติกาหัวข้อ 2: hash → แท็บที่จำไว้ใน ui.tabs[page] → ค่าเริ่ม · สลับด้วย history.replaceState (ไม่เพิ่มประวัติ back) + ฟัง hashchange
     โหลดแท็บครั้งแรกที่เปิดเท่านั้น (onShow(key, first)) — แท็บที่ไม่ได้เปิดไม่ยิงเน็ต · tabs: [{key, label}] หรือ labelKey+t */
  function tabs(o) {
    var el = o.el, keys = o.tabs.map(function (x) { return x.key; }), shown = {}, cur = null;
    el.className = (el.className ? el.className + ' ' : '') + 'tabs';
    el.setAttribute('role', 'tablist');
    function labelOf(x) { return x.labelKey && o.t ? o.t(x.labelKey) : x.label; }
    function render() {
      el.innerHTML = o.tabs.map(function (x) {
        return '<button type="button" class="tab" role="tab" id="tab-' + esc(x.key) + '" data-tab="' + esc(x.key) + '" aria-selected="' + (x.key === cur) + '">' + esc(labelOf(x)) + '</button>';
      }).join('');
    }
    function pick() {
      var h = (location.hash || '').replace(/^#/, '');
      if (keys.indexOf(h) >= 0) return h;
      var saved = (ui.get().tabs || {})[o.page];
      if (keys.indexOf(saved) >= 0) return saved;
      return o.def || keys[0];
    }
    function show(key, fromHash) {
      if (keys.indexOf(key) < 0) return;
      var first = !shown[key]; shown[key] = true; cur = key;
      var patch = { tabs: {} }; patch.tabs[o.page] = key; ui.set(patch);
      if (!fromHash) {
        var h = '#' + key;
        if (location.hash !== h) { try { history.replaceState(null, '', location.pathname + location.search + h); } catch (e) { location.hash = h; } }
      }
      [].forEach.call(el.querySelectorAll('.tab'), function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === key ? 'true' : 'false'); });
      if (o.onShow) o.onShow(key, first);
    }
    render();
    el.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.tab'); if (!b) return;
      show(b.getAttribute('data-tab'), false);
    });
    window.addEventListener('hashchange', function () {
      var h = (location.hash || '').replace(/^#/, '');
      if (keys.indexOf(h) >= 0 && h !== cur) show(h, true);
    });
    cur = pick(); render(); show(cur, true);
    return { show: function (k) { show(k, false); }, current: function () { return cur; }, rerender: function () { render(); } };
  }

  /* แถบหมวดย่อยของหน้าลงทุน: แถวเดียว ภาพรวม + ทุกหน้าใน window.INVEST_CATS · active = key ของหน้านี้ */
  function subnav(el, activeKey) {
    function build() {
      var cats = window.INVEST_CATS || [];
      var html = '<a href="invest.html"' + (activeKey === 'overview' ? ' class="on" aria-current="page"' : '') + '>' + esc(CORE.t('overview')) + '</a>';
      cats.forEach(function (c) {
        html += '<a href="' + esc(c.page) + '"' + (c.key === activeKey ? ' class="on" aria-current="page"' : '') + '>' + esc(c.label) + '</a>';
      });
      el.innerHTML = html;
      var on = el.querySelector('a.on'); if (on && on.scrollIntoView && el.scrollWidth > el.clientWidth) { try { el.scrollLeft = Math.max(0, on.offsetLeft - 40); } catch (e) {} }
    }
    if (window.INVEST_CATS) build();
    else { var tries = 0; (function wait() { if (window.INVEST_CATS) build(); else if (tries++ < 100) setTimeout(wait, 30); })(); }
    onLang(function () { if (window.INVEST_CATS) build(); });
  }

  /* เช็กลิสต์ — checks = ผลของ InvestCalc.checklist.* · textFn(item) → ข้อความของรายการ (หน้าแปลงรหัส → ข้อความเอง) */
  function renderChecklist(el, checks, textFn) {
    el.innerHTML = checks.map(function (c) {
      var ic = c.ok === true ? 'check' : c.ok === false ? 'x' : 'minus';
      return '<li class="' + (c.ok === false ? 'fail' : 'pass') + '"><span class="ic"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + ic + '"/></svg></span><span>' + esc(textFn(c)) + '</span></li>';
    }).join('');
  }

  /* ═══ ล้างแคชเก่าที่ไม่มีใครใช้แล้ว (หัวข้อ 3.5) — ครั้งเดียวต่อเครื่อง · ก่อนลบทุกคีย์ต้องเป็น kind 'cache' ตาม registry ไม่ใช่ห้ามลบ ═══ */
  function cleanupLegacyCache() {
    var R = window.TanotRegistry;
    if (!R || !R.classify) return 0;
    if (ui.get().cleaned) return 0;
    var prefixes = [P + 'cache:hub:', P + 'cache:comm:q:', P + 'newscache:'];
    var keepPrefix = P + 'newscache:q:';
    var exact = [P + 'cache:comm:thaigold', P + 'cache:btc:fng', P + 'cache:gold:dxy', P + 'cache:gold:tnx'];
    var del = [], i, k;
    try {
      for (i = 0; i < localStorage.length; i++) {
        k = localStorage.key(i);
        if (!k) continue;
        if (exact.indexOf(k) >= 0) del.push(k);
        else if (k.indexOf(keepPrefix) !== 0 && prefixes.some(function (p) { return k.indexOf(p) === 0; })) del.push(k);
      }
      var n = 0;
      del.forEach(function (key) {
        var kind = R.classify(key).kind;
        if (kind === 'cache') { localStorage.removeItem(key); n++; }
      });
      ui.set({ cleaned: 1 });
      return n;
    } catch (e) { return 0; }
  }

  /* อ่านข้อมูลผู้ใช้ — อ่านสด (ไม่ถืออาร์เรย์ค้าง) · rows(key) = list ของคีย์ tanot:invest:<key> */
  function rows(key) { var a = lsJson(P + key); return Array.isArray(a) ? a : []; }

  window.InvestCore = {
    num: num, fmt: fmt, money: money, pct: pct, esc: esc, ago: ago, newsDate: newsDate, delay: delay, rows: rows,
    lsJson: lsJson, lsSet: lsSet, getLang: getLang,
    i18n: i18n, onLang: onLang, ui: ui,
    proxied: proxied, netEnabled: netEnabled, fetchText: fetchText, dedupe: dedupe, sequence: sequence, marketLikelyOpen: marketLikelyOpen,
    series: series, loadSeries: loadSeries, quote: quote, fx: fx, thaiGold: thaiGold, fng: fng, news: news, parseNewsRss: parseNewsRss, newsSearchUrl: newsSearchUrl,
    seriesKey: seriesKey, quoteKey: quoteKey,
    live: { cfg: liveCfg, save: liveSave, quote: liveQuote, start: liveStart, stop: liveStop, openSettings: liveOpenSettings },
    aiAvailable: aiAvailable, summarize: summarize, stripLeaked: stripLeaked, aiMessage: aiMessage,
    tabs: tabs, subnav: subnav, renderChecklist: renderChecklist, cleanupLegacyCache: cleanupLegacyCache
  };

  /* ล้างแคชเก่าตอนโหลด (ครั้งเดียวต่อเครื่อง) */
  cleanupLegacyCache();
})();
