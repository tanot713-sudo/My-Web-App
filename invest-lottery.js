/* ══════════════════════════════════════════════════════════════════
   Tanot — สลากกินแบ่งรัฐบาล · สถิติความถี่ย้อนหลัง + ตรวจหวย + สุ่มเลข 6 หลัก
   หมายเหตุสำคัญ: สลากกินแบ่งฯ ไม่มีเงินต้นคืน (ต่างจากสลากออมสิน/ธ.ก.ส. ในแอปนี้)
   สถิติความถี่คือข้อมูลเชิงพรรณนาในอดีต ไม่ใช่การพยากรณ์ — แต่ละงวดสุ่มเป็นอิสระเสมอ

   ══ หมายเหตุขนาดแคช ══
   แคชถาวรเก็บแค่ 6 หมวดที่ผู้ใช้ขอ (first/second/third/threeFirst/threeLast/legacyThree/twoDigit)
   ไม่เก็บ fourth/fifth/nearFirst ระยะยาว (~150 เลข 6 หลักต่องวด) เพื่อไม่ให้แคชที่ใช้ร่วมกับ
   ทุกหน้าอื่นบวมโดยไม่จำเป็น — ยัง fetch มาแสดงในการ์ด "ตรวจหวย" ได้ตามปกติ (ไม่แคชถาวรเฉยๆ)
   ประมาณการ: ~19 ปี × ~24 งวด/ปี ≈ 456 งวด × ~300-400 ไบต์/งวด (core-only) ≈ 150-180KB รวม
   สบายในโควตา localStorage (~5-10MB)

   ══ หมายเหตุการจัดการวันที่งวด ══
   404 = ไม่มีงวดวันนั้น ไม่ใช่ error — ทนต่อรายการข้อยกเว้นที่ไม่ครบได้เอง (ข้ามเฉยๆ ไม่ retry)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }

  /* ── บวกเดือนแบบกันวันที่ overflow (คัดลอกจาก invest-gov-bond.js/invest-baac-lottery.js) ── */
  function addMonths(date, months) {
    var d = new Date(date.getTime());
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
  }
  function parseYMD(s) {
    if (!s) return null;
    var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isFinite(d.getTime()) ? d : null;
  }
  function ymd(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function thaiDate(d) { return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); }

  /* ══════════════════════════════════════════════════════════════════
     ดึงไฟล์ผลรางวัลรายวันจาก GitHub raw (CORS เปิด ไม่ต้องพร็อกซี —
     ต่างจากทุกหน้าอื่นในแอปนี้ที่ต้องไล่ 5-proxy chain)
     ══════════════════════════════════════════════════════════════════ */
  var RAW_BASE = 'https://raw.githubusercontent.com/vicha-w/thai-lotto-archive/master/lottonumbers/';
  var EARLIEST_ARCHIVE = '2007-01-16';

  function parseDrawText(text, dateStr) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
    if (!lines.length) return null;
    lines.shift(); /* บรรทัดแรกเป็น URL อ้างอิงแหล่งข่าว ไม่ใช่ข้อมูล */
    var d = {
      date: dateStr, first: null, second: [], third: [], fourth: [], fifth: [],
      threeFirst: null, threeLast: null, legacyThree: null, twoDigit: null, nearFirst: null
    };
    lines.forEach(function (line) {
      var parts = line.split(/\s+/);
      var label = parts.shift();
      if (label === 'FIRST') d.first = parts[0] || null;
      else if (label === 'THREE') d.legacyThree = parts.slice(); /* รูปแบบเก่า ก่อน 1 ก.ย. 2558 — ไม่แยกหน้า/หลัง */
      else if (label === 'THREE_FIRST') d.threeFirst = parts.slice(0, 2);
      else if (label === 'THREE_LAST') d.threeLast = parts.slice(0, 2);
      else if (label === 'TWO') d.twoDigit = parts[0] || null;
      else if (label === 'NEAR_FIRST') d.nearFirst = parts.slice(0, 2);
      else if (label === 'SECOND') d.second = parts.slice();
      else if (label === 'THIRD') d.third = parts.slice();
      else if (label === 'FOURTH') d.fourth = parts.slice();
      else if (label === 'FIFTH') d.fifth = parts.slice();
      /* label ไม่รู้จัก: ข้าม ไม่ throw — กันไฟล์รูปแบบเปลี่ยนในอนาคตพังทั้งหน้า */
    });
    return d;
  }

  function fetchDrawFile(dateStr) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, 10000) : null;
    return fetch(RAW_BASE + dateStr + '.txt', ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) {
        if (to) clearTimeout(to);
        if (r.status === 404) return null; /* ไม่มีงวดวันนี้ — ปกติ ไม่ใช่ error */
        if (!r.ok) throw new Error('http ' + r.status);
        return r.text();
      })
      .then(function (t) { return t ? parseDrawText(t, dateStr) : null; });
  }

  /* ══════════════════════════════════════════════════════════════════
     ตารางวันจับรางวัลที่ "น่าจะเป็น" (1/16 ของเดือน + ข้อยกเว้นประจำ 3 ข้อ
     + ข้อยกเว้นเฉพาะกิจในอดีต — ข้อเท็จจริงที่ไม่เปลี่ยนแล้ว จึง hardcode ได้
     แต่ไม่รับประกันครบทุกรายการ — ระบบทนได้เองผ่าน 404=ข้าม)
     ══════════════════════════════════════════════════════════════════ */
  var DATE_OVERRIDES = {
    '2015-06-01': '2015-06-02', '2015-12-16': '2015-12-17',
    '2018-03-01': '2018-03-02', '2019-07-16': '2019-07-15',
    '2020-04-01': null, /* งดจับรางวัล เม.ย. 2563 (โควิด) ไม่มีวันทดแทน */
    '2022-02-16': '2022-02-17', '2024-12-30': '2025-01-02'
  };
  function candidateDrawDates(fromDate, toDate) {
    /* ตรวจสอบด้วย curl จริงพบว่ากฎ "1/16 ของเดือน ยกเว้นตายตัว 3 ข้อ" ที่ระบุใน README ต้นทาง
       ไม่ตรงทุกปีจริง (เช่น 2007/2010/2026: งวด 16 ม.ค. ออกวันที่ 16 จริง ไม่เลื่อนเป็น 17;
       รอยต่อปี 2025→2026 ออกวันที่ 2 ม.ค. ไม่ใช่ 30 ธ.ค. หรือ 1 ม.ค.) — จึงไม่ยึดวันเดียวแบบมั่นใจ
       เกินไป แต่สร้าง "ผู้สมัคร" หลายวันรอบจุดเสี่ยง (ม.ค./พ.ค./ปลาย ธ.ค.) แล้วปล่อยให้ fetch จริง
       (404=ไม่มีงวด) เป็นตัวตัดสินว่าวันไหนคือของจริง — คำขอส่วนเกินไม่กี่รายการต่อปีคุ้มกับความถูกต้อง */
    var out = [], anchor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1), guard = 0;
    while (anchor <= toDate && guard < 3000) {
      var y = anchor.getFullYear(), m = anchor.getMonth();
      out.push(new Date(y, m, 1));
      out.push(new Date(y, m, 16));
      if (m === 0) { out.push(new Date(y, 0, 2)); out.push(new Date(y, 0, 17)); }   /* ปีใหม่/วันครู อาจเลื่อน */
      if (m === 4) out.push(new Date(y, 4, 2));                                     /* วันแรงงาน อาจเลื่อนเป็น 2 พ.ค. */
      if (m === 11) { out.push(new Date(y, 11, 30)); out.push(new Date(y, 11, 31)); } /* รอยต่อปีใหม่ อาจออกช่วงปลาย ธ.ค. */
      anchor = addMonths(anchor, 1);
      guard++;
    }
    out = out.filter(function (d) { return d >= fromDate && d <= toDate; });
    var seen = {}, mapped = [];
    out.forEach(function (d) {
      var key = ymd(d);
      if (DATE_OVERRIDES.hasOwnProperty(key)) {
        var r = DATE_OVERRIDES[key];
        if (r && !seen[r]) { seen[r] = 1; mapped.push(r); }
      } else if (!seen[key]) { seen[key] = 1; mapped.push(key); }
    });
    mapped.sort();
    return mapped;
  }

  /* ══════════════════════════════════════════════════════════════════
     โหลดประวัติเป็นชุด: cache-first + progress + ยกเลิกได้
     (ปรับจาก doScan() ใน invest-thai-stock.js)
     ══════════════════════════════════════════════════════════════════ */
  var HIST_KEY = 'tanot:invest:lottery:cache';
  var loadingHist = false;

  function loadHistCache() { try { return JSON.parse(localStorage.getItem(HIST_KEY)) || {}; } catch (e) { return {}; } }
  function saveHistCache(map) { try { localStorage.setItem(HIST_KEY, JSON.stringify(map)); } catch (e) {} }

  function coreOnly(d) {
    return {
      date: d.date, first: d.first, second: d.second, third: d.third,
      threeFirst: d.threeFirst, threeLast: d.threeLast, legacyThree: d.legacyThree, twoDigit: d.twoDigit
    };
  }

  function loadHistory(fromDate, toDate, onProgress) {
    loadingHist = true;
    var all = candidateDrawDates(fromDate, toDate);
    var cache = loadHistCache();
    var todo = all.filter(function (k) { return !cache.hasOwnProperty(k); });
    var done = 0, total = todo.length;
    if (!total) { if (onProgress) onProgress(all.length || 1, all.length || 1); loadingHist = false; return Promise.resolve(cache); }

    function worker() {
      if (!loadingHist || !todo.length) return Promise.resolve();
      var dateStr = todo.shift();
      return fetchDrawFile(dateStr).then(function (d) {
        if (d) cache[dateStr] = coreOnly(d);
        done++; if (onProgress) onProgress(done, total);
        if (done % 20 === 0) saveHistCache(cache); /* กันหลุดกลางทางถ้าปิดแท็บ */
        return worker();
      }, function () { done++; if (onProgress) onProgress(done, total); return worker(); });
    }
    var CONC = 6, workers = [];
    for (var i = 0; i < CONC && i < todo.length; i++) workers.push(worker());
    return Promise.all(workers).then(function () { saveHistCache(cache); loadingHist = false; return cache; });
  }
  function cancelLoadHistory() { loadingHist = false; }

  /* ══════════════════════════════════════════════════════════════════
     สถิติความถี่ — "ความถี่ในอดีต" เท่านั้น ไม่ใช่ความน่าจะเป็นในอนาคต
     (แต่ละงวดสุ่มเป็นอิสระจากงวดก่อนหน้าเสมอ)
     ══════════════════════════════════════════════════════════════════ */
  function drawsInWindow(cache, fromDate, toDate) {
    var out = [];
    Object.keys(cache).forEach(function (k) {
      var dt = parseYMD(k);
      if (dt && dt >= fromDate && dt <= toDate) out.push(cache[k]);
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return out;
  }
  /* เลข 2 ตัว / 3 ตัวหน้า-หลัง: มีค่าไปได้แค่ 100/1000 แบบ นับซ้ำได้จริงในตัวอย่างขนาดนี้ */
  function frequencyTable(draws, field) {
    var counts = {};
    draws.forEach(function (d) {
      var vals = field === 'twoDigit' ? (d.twoDigit ? [d.twoDigit] : []) : (d[field] || []);
      vals.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    });
    return counts;
  }
  /* รางวัลที่ 1/2/3: เลข 6 หลักเป๊ะมีให้เลือกล้านแบบ ตัวอย่างไม่กี่ร้อยงวดจะไม่มีเลขซ้ำเลยเกือบทั้งหมด
     (แสดงความถี่เลข 6 หลักเต็มจะได้ตารางที่ "ทุกอย่าง = 0 หรือ 1" ไม่มีสาระ) —
     จึงนับความถี่ "แต่ละหลัก แยกตามตำแหน่ง" แทน ซึ่งมีตัวอย่างมากพอสรุปทางสถิติเชิงพรรณนาได้จริง */
  var POSITION_LABELS = ['แสน', 'หมื่น', 'พัน', 'ร้อย', 'สิบ', 'หน่วย'];
  function digitPositionFrequency(draws, tier) {
    var pos = [{}, {}, {}, {}, {}, {}];
    draws.forEach(function (d) {
      var nums = tier === 'first' ? (d.first ? [d.first] : []) : (d[tier] || []);
      nums.forEach(function (n) {
        if (!n || n.length !== 6) return;
        for (var i = 0; i < 6; i++) { var g = n[i]; pos[i][g] = (pos[i][g] || 0) + 1; }
      });
    });
    return pos;
  }

  /* ══════════════════════════════════════════════════════════════════
     ตรวจหวยกับงวดล่าสุด
     ══════════════════════════════════════════════════════════════════ */
  var LATEST_KEY = 'tanot:invest:lottery:latest';
  function findLatestDraw(onStatus) {
    var today = new Date();
    var cutoff = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    var dates = candidateDrawDates(cutoff, today).filter(function (k) { return k <= ymd(today); });
    dates.reverse();
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(LATEST_KEY)); } catch (e) {}
    if (cached && dates.length && cached.date === dates[0]) return Promise.resolve(cached);
    var i = 0;
    function tryNext() {
      if (i >= dates.length) return Promise.reject(new Error('no draw found'));
      var k = dates[i++];
      if (onStatus) onStatus(k);
      return fetchDrawFile(k).then(function (d) {
        if (d) { try { localStorage.setItem(LATEST_KEY, JSON.stringify(d)); } catch (e) {} return d; }
        return tryNext();
      }, function () { return tryNext(); });
    }
    return tryNext();
  }
  function checkTicket(ticketRaw, draw) {
    var ticket = (ticketRaw || '').replace(/\D/g, '');
    if (ticket.length !== 6 || !draw) return null;
    var two = ticket.slice(-2), threeFront = ticket.slice(0, 3), threeBack = ticket.slice(-3);
    var hits = [];
    if (draw.first === ticket) hits.push('รางวัลที่ 1');
    if ((draw.second || []).indexOf(ticket) !== -1) hits.push('รางวัลที่ 2');
    if ((draw.third || []).indexOf(ticket) !== -1) hits.push('รางวัลที่ 3');
    if (draw.nearFirst && draw.nearFirst.indexOf(ticket) !== -1) hits.push('ข้างเคียงรางวัลที่ 1');
    if (draw.fourth && draw.fourth.indexOf(ticket) !== -1) hits.push('รางวัลที่ 4');
    if (draw.fifth && draw.fifth.indexOf(ticket) !== -1) hits.push('รางวัลที่ 5');
    if (draw.threeFirst && draw.threeFirst.indexOf(threeFront) !== -1) hits.push('เลขหน้า 3 ตัว');
    if (draw.threeLast && draw.threeLast.indexOf(threeBack) !== -1) hits.push('เลขท้าย 3 ตัว');
    if (draw.twoDigit === two) hits.push('เลขท้าย 2 ตัว');
    return { ticket: ticket, drawDate: draw.date, hits: hits };
  }

  /* ══════════════════════════════════════════════════════════════════
     สุ่มเลข 6 หลักแบบสล็อต — เพื่อความสนุก ใช้ Math.random() ธรรมดา
     ══════════════════════════════════════════════════════════════════ */
  var SPIN_KEY = 'tanot:invest:lottery:spins';
  var BUDGET_KEY = 'tanot:invest:lottery:budget';
  function spinReels(onDone) {
    var reels = [].slice.call(document.querySelectorAll('.reel-digit'));
    if (!reels.length) return;
    var finalDigits = [];
    for (var i = 0; i < 6; i++) finalDigits.push(Math.floor(Math.random() * 10));
    var landedCount = 0;
    reels.forEach(function (el, i) {
      el.classList.remove('landed'); el.classList.add('spinning');
      var ticks = 0, maxTicks = 14 + i * 4; /* หยุดทีละตัวซ้ายไปขวา ให้ความรู้สึกสล็อตแมชชีน */
      var iv = setInterval(function () {
        el.textContent = Math.floor(Math.random() * 10);
        ticks++;
        if (ticks >= maxTicks) {
          clearInterval(iv);
          el.textContent = finalDigits[i];
          el.classList.remove('spinning'); el.classList.add('landed');
          setTimeout(function () { el.classList.remove('landed'); }, 400);
          landedCount++;
          if (landedCount === reels.length) { var full = finalDigits.join(''); logSpin(full); if (onDone) onDone(full); }
        }
      }, 60);
    });
  }
  function logSpin(n) {
    var list = []; try { list = JSON.parse(localStorage.getItem(SPIN_KEY)) || []; } catch (e) {}
    list.unshift({ n: n, ts: Date.now() }); list = list.slice(0, 20);
    try { localStorage.setItem(SPIN_KEY, JSON.stringify(list)); } catch (e) {}
    return list;
  }

  /* ══════════════════════════════════════════════════════════════════
     UI wiring
     ══════════════════════════════════════════════════════════════════ */
  function currentWindowRange() {
    var months = num($('ltWindow').value) || 3;
    var toDate = new Date();
    var fromDate = addMonths(toDate, -months);
    return { fromDate: fromDate, toDate: toDate };
  }

  function renderRangeNote(fromDate) {
    var earliest = parseYMD(EARLIEST_ARCHIVE);
    var el = $('ltRangeNote');
    if (fromDate < earliest) {
      el.textContent = 'ข้อมูลมีย้อนหลังจริงถึงปี 2550 (~19 ปี) เท่านั้น ช่วงที่เลือกยาวกว่าที่มีข้อมูลจริง ระบบใช้เท่าที่มีข้อมูล';
    } else {
      el.textContent = '';
    }
  }

  function doLoadHistory() {
    if (loadingHist) return;
    var range = currentWindowRange();
    $('ltProgressWrap').style.display = 'block';
    $('ltLoadBtn').disabled = true;
    $('ltStopBtn').hidden = false;
    $('ltProgressFill').style.width = '0%';
    $('ltProgressText').textContent = 'กำลังเตรียมรายการงวด…';
    loadHistory(range.fromDate, range.toDate, function (done, total) {
      var pct = total ? Math.round(done / total * 100) : 100;
      $('ltProgressFill').style.width = pct + '%';
      $('ltProgressText').textContent = 'กำลังดึงข้อมูลย้อนหลัง ' + done + '/' + total + ' งวด…';
    }).then(function () {
      $('ltLoadBtn').disabled = false;
      $('ltStopBtn').hidden = true;
      $('ltProgressText').textContent = 'ดึงข้อมูลเสร็จแล้ว';
      renderRangeNote(range.fromDate);
      renderFrequency();
    });
  }

  function doStopLoad() {
    cancelLoadHistory();
  }

  function doClearCache() {
    if (!confirm('ล้างข้อมูลย้อนหลังที่แคชไว้ทั้งหมด?')) return;
    try { localStorage.removeItem(HIST_KEY); } catch (e) {}
    $('ltStatOut').innerHTML = '<div class="log-empty">กด "ดึงข้อมูลย้อนหลัง" ด้านบนก่อน เพื่อดูสถิติความถี่</div>';
    $('ltRangeNote').textContent = '';
  }

  function renderFrequency() {
    var tier = $('ltStatTier').value;
    var range = currentWindowRange();
    var cache = loadHistCache();
    var draws = drawsInWindow(cache, range.fromDate, range.toDate);
    var out = $('ltStatOut');
    if (!draws.length) { out.innerHTML = '<div class="log-empty">ยังไม่มีข้อมูลในช่วงนี้ — กด "ดึงข้อมูลย้อนหลัง" ก่อน</div>'; return; }

    if (tier === 'first' || tier === 'second' || tier === 'third') {
      var pos = digitPositionFrequency(draws, tier);
      var html = '<div class="pos-groups">';
      pos.forEach(function (counts, i) {
        var max = 0; Object.keys(counts).forEach(function (k) { if (counts[k] > max) max = counts[k]; });
        html += '<div class="pos-group"><div class="pos-label">หลัก' + POSITION_LABELS[i] + '</div>';
        for (var d = 0; d <= 9; d++) {
          var c = counts[d] || 0, w = max ? Math.round(c / max * 100) : 0;
          html += '<div class="pos-bar-row"><span class="d">' + d + '</span><span class="bar"><i style="width:' + w + '%"></i></span><span class="c">' + c + '</span></div>';
        }
        html += '</div>';
      });
      html += '</div>';
      out.innerHTML = html;
    } else {
      var counts2 = frequencyTable(draws, tier);
      var entries = Object.keys(counts2).map(function (k) { return { v: k, c: counts2[k] }; });
      entries.sort(function (a, b) { return b.c - a.c || (a.v < b.v ? -1 : 1); });
      var top = entries.slice(0, 20);
      if (!top.length) { out.innerHTML = '<div class="log-empty">ไม่มีข้อมูลหมวดนี้ในช่วงที่เลือก</div>'; return; }
      var html2 = '<table class="log-table"><thead><tr><th>เลข</th><th>จำนวนครั้งที่ออก</th></tr></thead><tbody>';
      top.forEach(function (e) { html2 += '<tr><td>' + e.v + '</td><td>' + e.c + '</td></tr>'; });
      html2 += '</tbody></table>';
      out.innerHTML = html2;
    }
  }

  function doCheckTicket() {
    var ticket = ($('ltTicket').value || '').replace(/\D/g, '');
    if (ticket.length !== 6) { alert('กรอกเลข 6 หลักให้ถูกต้อง'); return; }
    $('ltCheckStatus').textContent = 'กำลังค้นหางวดล่าสุด…';
    $('ltCheckOut').innerHTML = '';
    findLatestDraw(function (tryDate) { $('ltCheckStatus').textContent = 'กำลังตรวจสอบงวด ' + tryDate + '…'; })
      .then(function (draw) {
        $('ltCheckStatus').textContent = 'ตรวจกับงวดวันที่ ' + thaiDate(parseYMD(draw.date));
        var res = checkTicket(ticket, draw);
        var out = $('ltCheckOut');
        if (res.hits.length) {
          out.innerHTML = '<div class="sumbox" style="margin-top:10px"><div class="lbl">ผลการตรวจ</div><div class="val grow">🎉 ถูกรางวัล: ' + res.hits.join(', ') + '</div></div>';
        } else {
          out.innerHTML = '<div class="sumbox" style="margin-top:10px"><div class="lbl">ผลการตรวจ</div><div class="val">ไม่ถูกรางวัลใดเลยในงวดนี้</div></div>';
        }
      })
      .catch(function () {
        $('ltCheckStatus').textContent = 'ดึงผลงวดล่าสุดไม่สำเร็จตอนนี้ ลองใหม่อีกครั้ง';
      });
  }

  function doSpin() {
    $('ltSpinBtn').disabled = true;
    spinReels(function (full) {
      $('ltSpinBtn').disabled = false;
      $('ltSpinDerived').style.display = 'flex';
      $('ltSpinFull').textContent = full;
      $('ltSpinFront').textContent = full.slice(0, 3);
      $('ltSpinBack3').textContent = full.slice(-3);
      $('ltSpinBack2').textContent = full.slice(-2);
      renderSpinHistory();
    });
  }
  function renderSpinHistory() {
    var list = []; try { list = JSON.parse(localStorage.getItem(SPIN_KEY)) || []; } catch (e) {}
    var el = $('ltSpinHistory');
    if (!list.length) { el.innerHTML = ''; return; }
    var html = '<div style="font-weight:700;font-size:13px;margin:10px 0 4px">ประวัติการสุ่มล่าสุด</div>' +
      '<table class="log-table"><thead><tr><th>เวลา</th><th>เลข</th></tr></thead><tbody>';
    list.forEach(function (r) {
      html += '<tr><td>' + new Date(r.ts).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</td><td>' + r.n + '</td></tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function init() {
    $('ltLoadBtn').addEventListener('click', doLoadHistory);
    $('ltStopBtn').addEventListener('click', doStopLoad);
    $('ltClearCacheBtn').addEventListener('click', doClearCache);
    $('ltStatTier').addEventListener('change', renderFrequency);
    $('ltWindow').addEventListener('change', renderFrequency);
    $('ltCheckBtn').addEventListener('click', doCheckTicket);
    $('ltSpinBtn').addEventListener('click', doSpin);

    var budget = null; try { budget = localStorage.getItem(BUDGET_KEY); } catch (e) {}
    if (budget) $('ltBudget').value = budget;
    $('ltBudget').addEventListener('input', function () { try { localStorage.setItem(BUDGET_KEY, $('ltBudget').value); } catch (e) {} });

    renderFrequency();
    renderSpinHistory();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__lottery = {
    parseDrawText: parseDrawText, candidateDrawDates: candidateDrawDates,
    drawsInWindow: drawsInWindow, frequencyTable: frequencyTable, digitPositionFrequency: digitPositionFrequency,
    checkTicket: checkTicket, loadHistCache: loadHistCache, saveHistCache: saveHistCache, coreOnly: coreOnly,
    fetchDrawFile: fetchDrawFile, loadHistory: loadHistory
  };
})();
