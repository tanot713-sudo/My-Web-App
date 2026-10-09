/* ══════════════════════════════════════════════════════════════════
   Tanot — ข่าวหุ้น (รวมหัวข้อข่าวตลาดหุ้นไทย)
   • ดึงจาก Google News RSS (สาธารณะ, ไม่ต้องขอ API key) ผ่าน InvestCore.news() — /api/proxy ของเว็บเองอย่างเดียว
     (ตัด public CORS proxy + rss2json แล้วตามเอกสารยุบรวมหน้าลงทุน) ล้มเหลว = ข่าวที่บันทึกไว้ / ลิงก์ค้นเองที่ Google News
   • แสดงเฉพาะหัวข้อ + ที่มา + เวลา + ลิงก์ไปต้นฉบับ — ไม่ดึง/แสดงเนื้อหาข่าวเต็ม (ลิขสิทธิ์)
   หมายเหตุ: ตัวช่วยติดตามข่าว ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IC = window.InvestCore;
  var $ = function (id) { return document.getElementById(id); };

  /* ══════ ระบบสองภาษา (ไทย/อังกฤษ) — ตามธรรมเนียมเดียวกับ invest-gold.js ══════
     หมายเหตุ: คำค้น (q) ที่ยิงไปยัง Google News คงเป็นภาษาไทยเสมอไม่ว่าภาษา UI
     จะเป็นอะไร (hl=th&gl=TH คงที่) เพราะหน้านี้เป็นฮับข่าวตลาดหุ้นไทยโดยเฉพาะ
     — แปลเฉพาะป้ายชิป/ข้อความแสดงผลเท่านั้น */
  var L = IC.i18n({
    th: {
      navInvest: 'การลงทุน', pageTitle: 'ข่าวหุ้น',
      stCountLbl: 'พบข่าว', stTopicLbl: 'หมวดที่เลือก', stUpdatedLbl: 'อัปเดตล่าสุด',
      searchPh: 'ค้นข่าว เช่น PTT, ปันผล', searchBtn: 'ค้นหา',
      oppdayLinkText: 'Opportunity Day',
      loadingNewsDefault: 'กำลังโหลดข่าว…', loadingDefault: 'กำลังโหลด…',
      chipMarket: 'ตลาดหุ้นไทย', chipEcon: 'เศรษฐกิจไทย', chipRate: 'ดอกเบี้ย/กนง.', chipIpo: 'ข่าว IPO', chipDiv: 'ปันผลหุ้น', chipOppday: 'Opportunity Day',
      newsCountItems: '{n} รายการ', ageJustNow: 'เมื่อสักครู่', ageMinAgo: '{n} นาทีก่อน', ageHrAgo: '{n} ชม.ก่อน', ageDaysAgo: '{n} วันก่อน',
      newsEmpty: 'ไม่พบข่าวสำหรับคำค้นนี้ ลองคำค้นอื่นดูครับ',
      loadingTopic: 'กำลังโหลดข่าว "{label}"…',
      staleUseSaved: 'ดึงสดไม่ได้ — ใช้ข่าวที่บันทึกไว้ {age}', latestFor: 'ข่าวล่าสุด "{label}"',
      fetchFail: 'ดึงข่าวไม่สำเร็จตอนนี้ — ลองรีเฟรช หรือเปิด Google News ค้นเองที่ ↗',
      fetchFailBody: 'ดึงข่าวอัตโนมัติไม่ได้ตอนนี้ — <a href="{url}" target="_blank" rel="noopener">ค้นหาเองที่ Google News ↗</a>'
    },
    en: {
      navInvest: 'Investing', pageTitle: 'Stock News',
      stCountLbl: 'Found', stTopicLbl: 'Selected topic', stUpdatedLbl: 'Last updated',
      searchPh: 'Search news, e.g. PTT', searchBtn: 'Search',
      oppdayLinkText: 'Opportunity Day',
      loadingNewsDefault: 'Loading news…', loadingDefault: 'Loading…',
      chipMarket: 'Thai Stock Market', chipEcon: 'Thai Economy', chipRate: 'Interest Rate/BOT', chipIpo: 'IPO News', chipDiv: 'Stock Dividends', chipOppday: 'Opportunity Day',
      newsCountItems: '{n} items', ageJustNow: 'just now', ageMinAgo: '{n} min ago', ageHrAgo: '{n} hr ago', ageDaysAgo: '{n} days ago',
      newsEmpty: 'No news found for this search — try a different search term',
      loadingTopic: 'Loading news for "{label}"…',
      staleUseSaved: 'Live fetch failed — using saved news from {age}', latestFor: 'Latest news for "{label}"',
      fetchFail: "Couldn't fetch news right now — try refreshing, or open Google News to search yourself ↗",
      fetchFailBody: 'Couldn\'t auto-fetch news right now — <a href="{url}" target="_blank" rel="noopener">search it yourself on Google News ↗</a>'
    }
  });
  var t = L.t, applyStaticI18n = L.apply;

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

  function newsDateText(pubDate) { return IC.newsDate(pubDate); }
  function cacheAgeText(ts) { return IC.ago(ts); }

  function setBadge(msg, cls) { var el = $('srcBadge'); el.textContent = msg; el.className = 'badge wrap' + (cls === 'real' ? ' ok' : cls === 'demo' ? ' warn' : ''); }

  function renderNews(r) {
    var body = $('newsBody');
    var stCount = $('stCount'); if (stCount) stCount.textContent = t('newsCountItems', { n: r.items.length });
    var stUpdated = $('stUpdated'); if (stUpdated) stUpdated.textContent = r.stale ? cacheAgeText(r.cachedAt) : t('ageJustNow');
    if (!r.items.length) { body.innerHTML = '<div class="news-empty">' + t('newsEmpty') + '</div>'; return; }
    var html = '<ul class="news-list">' + r.items.map(function (n) {
      var meta = [];
      if (n.source) meta.push('<span class="src">' + IC.esc(n.source) + '</span>');
      var dt = newsDateText(n.pubDate); if (dt) meta.push('<span>' + dt + '</span>');
      return '<li class="news-item">' +
        '<a class="title" href="' + IC.esc(n.link) + '" target="_blank" rel="noopener">' + IC.esc(n.title) + '</a>' +
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
    IC.news(query, { limit: 20 }).then(function (r) {
      if (curQuery !== query) return;
      setBadge(r.stale ? t('staleUseSaved', { age: cacheAgeText(r.cachedAt) }) : t('latestFor', { label: label }), 'real');
      renderNews(r);
    }, function () {
      if (curQuery !== query) return;
      setBadge(t('fetchFail'), 'paste');
      var direct = IC.newsSearchUrl(query);
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
    IC.subnav($('ivSubRow'), 'news');
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

  IC.onLang(function () {
    applyStaticI18n();
    renderChips();
    if (lastChipKey) selectChip(lastChipKey);
  });

})();
