/* ══════════════════════════════════════════════════════════════════
   Tanot — ข่าวหุ้น (รวมหัวข้อข่าวตลาดหุ้นไทย)
   • ดึงจาก Google News RSS (สาธารณะ, ไม่ต้องขอ API key) ผ่าน CORS-proxy chain
     เหมือน pattern fetchNewsScan()/parseNewsRss() ที่มีอยู่แล้วใน invest-thai-stock.js
     (ที่นั่นใช้แสดงข่าวรายหุ้นตัวเดียวในหน้าเดียว — หน้านี้ทำหน้าที่เป็น "ฮับข่าว" กว้างกว่า
     มีชิปคำค้นสำเร็จรูป + ช่องค้นหาอิสระ ไม่ผูกกับหุ้นตัวใดตัวหนึ่ง)
   • แสดงเฉพาะหัวข้อ + ที่มา + เวลา + ลิงก์ไปต้นฉบับ — ไม่ดึง/แสดงเนื้อหาข่าวเต็ม (ลิขสิทธิ์)
   หมายเหตุ: ตัวช่วยติดตามข่าว ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ══════ ระบบสองภาษา (ไทย/อังกฤษ) — ตามธรรมเนียมเดียวกับ invest-gold.js ══════
     หมายเหตุ: คำค้น (q) ที่ยิงไปยัง Google News คงเป็นภาษาไทยเสมอไม่ว่าภาษา UI
     จะเป็นอะไร (hl=th&gl=TH คงที่) เพราะหน้านี้เป็นฮับข่าวตลาดหุ้นไทยโดยเฉพาะ
     — แปลเฉพาะป้ายชิป/ข้อความแสดงผลเท่านั้น */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      navInvest: 'การลงทุน', pageTitle: 'ข่าวหุ้น',
      stCountLbl: 'พบข่าว', stTopicLbl: 'หมวดที่เลือก', stUpdatedLbl: 'อัปเดตล่าสุด',
      searchPh: 'ค้นข่าวหุ้น/บริษัทที่สนใจ เช่น PTT, ปันผล, กนง.', searchBtn: 'ค้นหา',
      oppdayLinkText: 'Opportunity Day ↗',
      loadingNewsDefault: 'กำลังโหลดข่าว…', loadingDefault: 'กำลังโหลด…',
      chipMarket: 'ตลาดหุ้นไทย', chipEcon: 'เศรษฐกิจไทย', chipRate: 'ดอกเบี้ย/กนง.', chipIpo: 'ข่าว IPO', chipDiv: 'ปันผลหุ้น', chipOppday: 'Opportunity Day',
      newsCountItems: '{n} รายการ', ageJustNow: 'เมื่อสักครู่', ageMinAgo: '{n} นาทีก่อน', ageHrAgo: '{n} ชม.ก่อน', ageDaysAgo: '{n} วันก่อน',
      newsEmpty: 'ไม่พบข่าวสำหรับคำค้นนี้ ลองคำค้นอื่นดูครับ',
      loadingTopic: 'กำลังโหลดข่าว "{label}"…',
      staleUseSaved: 'ดึงสดไม่ได้ — ใช้ข่าวที่บันทึกไว้ {age}', latestFor: 'ข่าวล่าสุด "{label}"',
      fetchFail: 'ดึงข่าวไม่สำเร็จตอนนี้ — ลองรีเฟรช หรือเปิด Google News ค้นเองที่ ↗',
      fetchFailBody: 'ดึงข่าวอัตโนมัติไม่ได้ตอนนี้ — <a href="{url}" target="_blank" rel="noopener" style="color:var(--brand-dk);font-weight:700">ค้นหาเองที่ Google News ↗</a>'
    },
    en: {
      navInvest: 'Investing', pageTitle: 'Stock News',
      stCountLbl: 'Found', stTopicLbl: 'Selected topic', stUpdatedLbl: 'Last updated',
      searchPh: 'Search for stocks/companies, e.g. PTT, dividends, BOT rate', searchBtn: 'Search',
      oppdayLinkText: 'Opportunity Day ↗',
      loadingNewsDefault: 'Loading news…', loadingDefault: 'Loading…',
      chipMarket: 'Thai Stock Market', chipEcon: 'Thai Economy', chipRate: 'Interest Rate/BOT', chipIpo: 'IPO News', chipDiv: 'Stock Dividends', chipOppday: 'Opportunity Day',
      newsCountItems: '{n} items', ageJustNow: 'just now', ageMinAgo: '{n} min ago', ageHrAgo: '{n} hr ago', ageDaysAgo: '{n} days ago',
      newsEmpty: 'No news found for this search — try a different search term',
      loadingTopic: 'Loading news for "{label}"…',
      staleUseSaved: 'Live fetch failed — using saved news from {age}', latestFor: 'Latest news for "{label}"',
      fetchFail: "Couldn't fetch news right now — try refreshing, or open Google News to search yourself ↗",
      fetchFailBody: 'Couldn\'t auto-fetch news right now — <a href="{url}" target="_blank" rel="noopener" style="color:var(--brand-dk);font-weight:700">search it yourself on Google News ↗</a>'
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

  var CHIPS = [
    { key: 'market', labelKey: 'chipMarket', q: 'ตลาดหุ้นไทย OR SET Index' },
    { key: 'econ', labelKey: 'chipEcon', q: 'เศรษฐกิจไทย' },
    { key: 'rate', labelKey: 'chipRate', q: 'กนง. OR ดอกเบี้ยนโยบาย ธนาคารแห่งประเทศไทย' },
    { key: 'ipo', labelKey: 'chipIpo', q: 'หุ้น IPO เข้าตลาด' },
    { key: 'div', labelKey: 'chipDiv', q: 'ปันผลหุ้น XD' },
    { key: 'oppday', labelKey: 'chipOppday', q: 'Opportunity Day บริษัทจดทะเบียนพบผู้ลงทุน' }
  ];
  function chipLabel(c) { return t(c.labelKey); }
  /* Opportunity Day (บริษัทจดทะเบียนพบผู้ลงทุน) จัดโดยตลาดหลักทรัพย์ฯ — เว็บ set.or.th/oppday
     เป็นเว็บแอปที่ต้องเรนเดอร์ด้วย JS ไม่มี API/RSS สาธารณะให้ดึงข้อมูลปฏิทินได้ตรงๆ (ตรวจแล้วไม่พบ)
     จึงให้ "ข่าวเกี่ยวกับ Opportunity Day" ผ่านชิปค้นข่าวด้านบนแทน + ลิงก์ไปหน้าปฏิทินจริงของ SET ตรงนี้ */
  var OPPDAY_URL = 'https://www.set.or.th/oppday';
  var LAST_QKEY = 'tanot:invest:news:lastChip';
  var curQuery = null, curLabel = '', seq = 0;

  function fetchOne(url, timeoutMs, parser) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
      .then(function (t) { if (to) clearTimeout(to); return parser(t); });
  }
  /* หมายเหตุ (แก้บั๊ก "ดึงข่าวไม่ขึ้น"): corsproxy.io เปลี่ยนนโยบายไปเรียกเก็บ API key แล้ว (ฟรีใช้ไม่ได้
     อีกต่อไป — คำขอทุกอันจะ 401 ทันที) ตัดออกจากรายการ พร้อมเพิ่มพร็อกซีสำรองอีก 2 ตัวเข้ามาแทนเพื่อให้
     สายสำรองยังยาวพอ (พร็อกซี CORS สาธารณะฟรีล้มหายตายจากกันเรื่อยๆ ตามธรรมชาติของบริการฟรี) */
  function proxyTries(base, offset) {
    var enc = encodeURIComponent(base);
    var tries = [
      { url: 'https://api.allorigins.win/raw?url=' + enc },
      { url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { url: 'https://cors.eu.org/' + base },
      { url: 'https://test.cors.workers.dev/?' + base },
      { url: 'https://api.cors.lol/?url=' + enc },
      { url: 'https://proxy.corsfix.com/?' + base },
      { url: base }
    ];
    offset = ((offset || 0) % tries.length + tries.length) % tries.length;
    return tries.slice(offset).concat(tries.slice(0, offset));
  }
  /* Google News RSS <item> — title/link/pubDate เหมือน pattern เดิมใน invest-thai-stock.js
     เพิ่ม <source> (ชื่อสำนักข่าว) เพราะหน้านี้เป็นฮับข่าวเต็มรูปแบบ อยากโชว์ที่มาให้ชัดกว่าการ์ดเล็กในหน้าหุ้น */
  function parseNewsRss(t) {
    var xml = new DOMParser().parseFromString(t, 'text/xml');
    if (xml.querySelector('parsererror')) throw new Error('parse error');
    var items = [].slice.call(xml.querySelectorAll('item')).slice(0, 20).map(function (it) {
      var title = it.querySelector('title'), link = it.querySelector('link'), pub = it.querySelector('pubDate');
      var src = it.querySelector('source');
      return { title: title ? title.textContent : '', link: link ? link.textContent : '#', pubDate: pub ? pub.textContent : '', source: src ? src.textContent : '' };
    }).filter(function (n) { return n.title; });
    if (!items.length) throw new Error('no items');
    return items;
  }
  /* rss2json.com — บริการแปลง RSS→JSON โดยเฉพาะ (ไม่ใช่ CORS proxy ทั่วไปที่ยืมมาใช้) ลองก่อนเป็นอันดับแรก
     เพราะออกแบบมาสำหรับงานนี้ตรงๆ (Google News RSS เป็นตัวอย่างที่ใช้กันทั่วไปในเอกสารของเขาเอง) มักเสถียร
     กว่าพร็อกซี CORS ทั่วไปที่แค่ยืมมาใช้ผ่านๆ — ข้อจำกัด: ไม่ส่ง tag <source> กลับมาด้วย (schema คงที่ของ
     เขาไม่มีช่องนี้) ต้องแยกเอาชื่อสำนักข่าวจากท้ายหัวข้อข่าวเอง (Google News ต่อท้ายชื่อสำนักข่าวด้วย " - ชื่อ" เสมอ) */
  function parseRss2Json(t) {
    var o = JSON.parse(t);
    if (!o || o.status !== 'ok' || !Array.isArray(o.items) || !o.items.length) throw new Error('rss2json empty');
    var items = o.items.slice(0, 20).map(function (it) {
      var title = it.title || '', source = '';
      var m = /\s-\s([^-]+)$/.exec(title);
      if (m) { source = m[1].trim(); title = title.slice(0, title.length - m[0].length).trim(); }
      return { title: title, link: it.link || '#', pubDate: it.pubDate || '', source: source };
    }).filter(function (n) { return n.title; });
    if (!items.length) throw new Error('no items');
    return items;
  }
  function newsDateText(pubDate) {
    var d = pubDate ? new Date(pubDate) : null;
    if (!d || isNaN(d)) return '';
    var mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 60) return mins <= 1 ? t('ageJustNow') : t('ageMinAgo', { n: mins });
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return t('ageHrAgo', { n: hrs });
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: hrs > 24 * 300 ? '2-digit' : undefined });
  }
  function fetchNewsScan(query) {
    var base = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=th&gl=TH&ceid=TH:th';
    var tries = [{ url: 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(base), parser: parseRss2Json }]
      .concat(proxyTries(base, seq++).map(function (x) { return { url: x.url, parser: parseNewsRss }; }));
    var i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('all failed'));
      var cur = tries[i++];
      return fetchOne(cur.url, 8000, cur.parser).catch(next);
    }
    return next();
  }
  function newsCacheKey(query) { return 'tanot:invest:newscache:hub:' + query; }
  function saveNewsCache(query, items) { try { localStorage.setItem(newsCacheKey(query), JSON.stringify({ ts: Date.now(), items: items })); } catch (e) {} }
  function loadNewsCache(query) { try { var o = JSON.parse(localStorage.getItem(newsCacheKey(query))); return (o && o.items) ? o : null; } catch (e) { return null; } }
  function fetchNews(query) {
    var cached = loadNewsCache(query), fresh = cached && (Date.now() - cached.ts < 2 * 3600 * 1000);
    if (fresh) return Promise.resolve({ items: cached.items, stale: false, cachedAt: cached.ts });
    return fetchNewsScan(query).then(function (items) {
      saveNewsCache(query, items); return { items: items, stale: false };
    }, function (e) {
      if (cached) return { items: cached.items, stale: true, cachedAt: cached.ts };
      throw e;
    });
  }
  function cacheAgeText(ts) {
    if (!ts) return '';
    var mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return t('ageJustNow');
    if (mins < 60) return t('ageMinAgo', { n: mins });
    var hrs = Math.round(mins / 60);
    return hrs < 24 ? t('ageHrAgo', { n: hrs }) : t('ageDaysAgo', { n: Math.round(hrs / 24) });
  }

  function setBadge(msg, cls) { var el = $('srcBadge'); el.textContent = msg; el.className = 'src-badge' + (cls ? ' ' + cls : ''); }

  function renderNews(r) {
    var body = $('newsBody');
    var stCount = $('stCount'); if (stCount) stCount.textContent = t('newsCountItems', { n: r.items.length });
    var stUpdated = $('stUpdated'); if (stUpdated) stUpdated.textContent = r.stale ? cacheAgeText(r.cachedAt) : t('ageJustNow');
    if (!r.items.length) { body.innerHTML = '<div class="news-empty">' + t('newsEmpty') + '</div>'; return; }
    var html = '<ul class="news-list">' + r.items.map(function (n) {
      var meta = [];
      if (n.source) meta.push('<span class="src">' + n.source + '</span>');
      var dt = newsDateText(n.pubDate); if (dt) meta.push('<span>' + dt + '</span>');
      return '<li class="news-item">' +
        '<a class="title" href="' + n.link + '" target="_blank" rel="noopener">' + n.title + '</a>' +
        '<div class="news-meta">' + meta.join('<span>·</span>') + '</div></li>';
    }).join('') + '</ul>';
    body.innerHTML = html;
  }

  var lastChipKey = null;
  function runQuery(query, label) {
    var mySeq = ++seq;
    curQuery = query; curLabel = label;
    setBadge(t('loadingTopic', { label: label }));
    $('newsBody').innerHTML = '<div class="news-loading">' + t('loadingDefault') + '</div>';
    var stTopic = $('stTopic'); if (stTopic) stTopic.textContent = label;
    /* stCount/stUpdated ปล่อยให้เป็น skeleton (.ome-skeleton ใน HTML ตอนโหลดครั้งแรก
       หรือค่าจริงจากคำค้นก่อนหน้าตอนสลับหมวด) จนกว่า fetch จะเสร็จ — ไม่เขียนทับด้วย
       "…" เพราะ skeleton สื่อว่ากำลังโหลดชัดเจนกว่าอยู่แล้ว */
    fetchNews(query).then(function (r) {
      if (curQuery !== query) return;
      setBadge(r.stale ? t('staleUseSaved', { age: cacheAgeText(r.cachedAt) }) : t('latestFor', { label: label }), 'real');
      renderNews(r);
    }, function () {
      if (curQuery !== query) return;
      setBadge(t('fetchFail'), 'paste');
      var direct = 'https://news.google.com/search?q=' + encodeURIComponent(query) + '&hl=th&gl=TH&ceid=TH:th';
      $('newsBody').innerHTML = '<div class="news-empty">' + t('fetchFailBody', { url: direct }) + '</div>';
      var stCountErr = $('stCount'); if (stCountErr) stCountErr.textContent = '—';
      var stUpdatedErr = $('stUpdated'); if (stUpdatedErr) stUpdatedErr.textContent = '—';
    });
  }

  function selectChip(key) {
    var c = CHIPS.filter(function (x) { return x.key === key; })[0]; if (!c) return;
    lastChipKey = key;
    [].forEach.call(document.querySelectorAll('.chip'), function (b) { b.classList.toggle('on', b.getAttribute('data-key') === key); });
    $('qInput').value = '';
    try { localStorage.setItem(LAST_QKEY, key); } catch (e) {}
    runQuery(c.q, chipLabel(c));
  }
  function runCustomSearch() {
    var v = $('qInput').value.trim();
    if (!v) return;
    lastChipKey = null;
    [].forEach.call(document.querySelectorAll('.chip'), function (b) { b.classList.remove('on'); });
    runQuery(v + ' หุ้น OR ตลาดหุ้น', v);
  }

  function renderChips() {
    var html = '';
    CHIPS.forEach(function (c) { html += '<button type="button" class="chip' + (c.key === lastChipKey ? ' on' : '') + '" data-key="' + c.key + '">' + chipLabel(c) + '</button>'; });
    $('chipRow').innerHTML = html;
    [].forEach.call(document.querySelectorAll('.chip'), function (b) {
      b.addEventListener('click', function () { selectChip(b.getAttribute('data-key')); });
    });
  }

  function init() {
    applyStaticI18n();
    renderChips();
    $('qBtn').addEventListener('click', runCustomSearch);
    $('qInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') runCustomSearch(); });

    var last = null;
    try { last = localStorage.getItem(LAST_QKEY); } catch (e) {}
    selectChip(CHIPS.some(function (c) { return c.key === last; }) ? last : 'market');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.omeApplyLang = function () {
    applyStaticI18n();
    renderChips();
    if (lastChipKey) selectChip(lastChipKey);
  };

  window.__news = { parseNewsRss: parseNewsRss, CHIPS: CHIPS };
})();
