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

  var CHIPS = [
    { key: 'market', label: 'ตลาดหุ้นไทย', q: 'ตลาดหุ้นไทย OR SET Index' },
    { key: 'econ', label: 'เศรษฐกิจไทย', q: 'เศรษฐกิจไทย' },
    { key: 'rate', label: 'ดอกเบี้ย/กนง.', q: 'กนง. OR ดอกเบี้ยนโยบาย ธนาคารแห่งประเทศไทย' },
    { key: 'ipo', label: 'ข่าว IPO', q: 'หุ้น IPO เข้าตลาด' },
    { key: 'div', label: 'ปันผลหุ้น', q: 'ปันผลหุ้น XD' },
    { key: 'oppday', label: 'Opportunity Day', q: 'Opportunity Day บริษัทจดทะเบียนพบผู้ลงทุน' }
  ];
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
  function proxyTries(base, offset) {
    var enc = encodeURIComponent(base);
    var tries = [
      { url: 'https://api.allorigins.win/raw?url=' + enc },
      { url: 'https://corsproxy.io/?url=' + enc },
      { url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { url: 'https://thingproxy.freeboard.io/fetch/' + base },
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
  function newsDateText(pubDate) {
    var d = pubDate ? new Date(pubDate) : null;
    if (!d || isNaN(d)) return '';
    var mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 60) return mins <= 1 ? 'เมื่อสักครู่' : mins + ' นาทีก่อน';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + ' ชม.ก่อน';
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: hrs > 24 * 300 ? '2-digit' : undefined });
  }
  function fetchNewsScan(query) {
    var base = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=th&gl=TH&ceid=TH:th';
    var tries = proxyTries(base, seq++), i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('all failed'));
      return fetchOne(tries[i++].url, 8000, parseNewsRss).catch(next);
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
    if (mins < 1) return 'เมื่อสักครู่';
    if (mins < 60) return mins + ' นาทีก่อน';
    var hrs = Math.round(mins / 60);
    return hrs < 24 ? (hrs + ' ชม.ก่อน') : (Math.round(hrs / 24) + ' วันก่อน');
  }

  function setBadge(msg, cls) { var el = $('srcBadge'); el.textContent = msg; el.className = 'src-badge' + (cls ? ' ' + cls : ''); }

  function renderNews(r) {
    var body = $('newsBody');
    var stCount = $('stCount'); if (stCount) stCount.textContent = r.items.length + ' รายการ';
    var stUpdated = $('stUpdated'); if (stUpdated) stUpdated.textContent = r.stale ? cacheAgeText(r.cachedAt) : 'เมื่อสักครู่';
    if (!r.items.length) { body.innerHTML = '<div class="news-empty">ไม่พบข่าวสำหรับคำค้นนี้ ลองคำค้นอื่นดูครับ</div>'; return; }
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

  function runQuery(query, label) {
    var mySeq = ++seq;
    curQuery = query; curLabel = label;
    setBadge('กำลังโหลดข่าว "' + label + '"…');
    $('newsBody').innerHTML = '<div class="news-loading">กำลังโหลด…</div>';
    var stTopic = $('stTopic'); if (stTopic) stTopic.textContent = label;
    /* stCount/stUpdated ปล่อยให้เป็น skeleton (.ome-skeleton ใน HTML ตอนโหลดครั้งแรก
       หรือค่าจริงจากคำค้นก่อนหน้าตอนสลับหมวด) จนกว่า fetch จะเสร็จ — ไม่เขียนทับด้วย
       "…" เพราะ skeleton สื่อว่ากำลังโหลดชัดเจนกว่าอยู่แล้ว */
    fetchNews(query).then(function (r) {
      if (curQuery !== query) return;
      setBadge(r.stale ? ('ดึงสดไม่ได้ — ใช้ข่าวที่บันทึกไว้ ' + cacheAgeText(r.cachedAt)) : ('ข่าวล่าสุด "' + label + '"'), 'real');
      renderNews(r);
    }, function () {
      if (curQuery !== query) return;
      setBadge('ดึงข่าวไม่สำเร็จตอนนี้ — ลองรีเฟรช หรือเปิด Google News ค้นเองที่ ↗', 'paste');
      var direct = 'https://news.google.com/search?q=' + encodeURIComponent(query) + '&hl=th&gl=TH&ceid=TH:th';
      $('newsBody').innerHTML = '<div class="news-empty">ดึงข่าวอัตโนมัติไม่ได้ตอนนี้ — <a href="' + direct + '" target="_blank" rel="noopener" style="color:var(--brand-dk);font-weight:700">ค้นหาเองที่ Google News ↗</a></div>';
      var stCountErr = $('stCount'); if (stCountErr) stCountErr.textContent = '—';
      var stUpdatedErr = $('stUpdated'); if (stUpdatedErr) stUpdatedErr.textContent = '—';
    });
  }

  function selectChip(key) {
    var c = CHIPS.filter(function (x) { return x.key === key; })[0]; if (!c) return;
    [].forEach.call(document.querySelectorAll('.chip'), function (b) { b.classList.toggle('on', b.getAttribute('data-key') === key); });
    $('qInput').value = '';
    try { localStorage.setItem(LAST_QKEY, key); } catch (e) {}
    runQuery(c.q, c.label);
  }
  function runCustomSearch() {
    var v = $('qInput').value.trim();
    if (!v) return;
    [].forEach.call(document.querySelectorAll('.chip'), function (b) { b.classList.remove('on'); });
    runQuery(v + ' หุ้น OR ตลาดหุ้น', v);
  }

  function init() {
    var html = '';
    CHIPS.forEach(function (c) { html += '<button type="button" class="chip" data-key="' + c.key + '">' + c.label + '</button>'; });
    $('chipRow').innerHTML = html;
    [].forEach.call(document.querySelectorAll('.chip'), function (b) {
      b.addEventListener('click', function () { selectChip(b.getAttribute('data-key')); });
    });
    $('qBtn').addEventListener('click', runCustomSearch);
    $('qInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') runCustomSearch(); });

    var last = null;
    try { last = localStorage.getItem(LAST_QKEY); } catch (e) {}
    selectChip(CHIPS.some(function (c) { return c.key === last; }) ? last : 'market');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__news = { parseNewsRss: parseNewsRss, CHIPS: CHIPS };
})();
