/* ══════════════════════════════════════════════════════════════════
   ทบทวนวันนี้ (ROADMAP Phase 5) — การ์ดที่ถึงกำหนดจากทุกหน้ารวมเป็นกองเดียว + XP/วันติดต่อกัน/เป้ารายวันจาก learn-core.js
   การ์ดอยู่ที่เดิมของแต่ละหน้า หน้านี้อ่านแล้วเขียนผลทบทวนกลับไปที่เดิมในรูปแบบเดียวกับที่หน้านั้นเขียนเอง:
     law  — IndexedDB tanot-barprep/notes (FSRS, ฟิลด์เดียวกับ classroom-law.js answerCard) + log tanot:barprep:activity
     lang — lang-practice:srs {key: FSRS} · หน้าการ์ดจาก tanot:learn:faces:lang (หน้าภาษาเขียนไว้)
     books — tanot:books:cards (sync list, FSRS ฟิลด์เดียวกับ law/lang) · หน้าการ์ด front/back อยู่ในแถวเอง
     biz/eng — lbe:<business|engineering>:srs {qKey: {interval, due}} ขั้นบันได · หน้าการ์ดจาก <script id="course-data"> ในหน้าห้องเรียน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LC = window.LearnCore, FS = window.TanotFSRS;
  window.TANOT_NO_RELOAD_BAR = true; // หน้านี้วาดใหม่เองเมื่อข้อมูลเปลี่ยน

  var LBE = {
    biz: { key: 'lbe:business:srs', page: 'classroom-business.html' },
    eng: { key: 'lbe:engineering:srs', page: 'classroom-engineering.html' }
  };
  var BOOK_CARDS = 'tanot:books:cards';
  var DECK_SRC = ['law', 'lang', 'biz', 'eng', 'books'];
  var RATINGS = [
    { r: 1, cls: 'again', label: 'Again' },
    { r: 2, cls: 'hard', label: 'Hard' },
    { r: 3, cls: 'good', label: 'Good' },
    { r: 4, cls: 'easy', label: 'Easy' }
  ];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function icon(name, cls) { return '<svg class="ome-icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function num(n) { return Math.round(n).toLocaleString('th-TH'); }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function fmtInterval(ms) {
    var h = ms / 3600000;
    if (h < 23.5) return Math.max(1, Math.round(h)) + ' ชม.';
    var d = h / 24;
    if (d < 45) return Math.round(d) + ' วัน';
    return Math.round(d / 30) + ' เดือน';
  }

  /* ── หน้าการ์ดของห้องเรียนธุรกิจ/วิศวะ: qKey = `${subjId}:${topicId}:${i}` เฉพาะหัวข้อที่มี quiz (ตรงกับ QUESTION_BANK ในหน้านั้น) ── */
  var lbeCache = {};
  function lbeQuestions(src) {
    if (lbeCache[src]) return lbeCache[src];
    lbeCache[src] = fetch(LBE[src].page, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (html) {
      var m = /<script id="course-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
      var course = m ? JSON.parse(m[1]) : {}, out = {};
      Object.keys(course).forEach(function (subjId) {
        var subj = course[subjId];
        var topics = Array.isArray(subj) ? subj : Object.keys(subj || {}).map(function (id) { return Object.assign({}, subj[id], { id: id }); });
        topics.forEach(function (t) {
          if (!t || !t.quiz || !t.quiz.length) return;
          t.quiz.forEach(function (q, i) {
            out[subjId + ':' + t.id + ':' + i] = { q: q.q, a: q.options ? q.options[q.answer] : '', topic: t.title };
          });
        });
      });
      return out;
    }).catch(function () { delete lbeCache[src]; return null; });
    return lbeCache[src];
  }

  /* ── รวมกอง ── */
  var deck = { cards: [], missing: {} };
  var rated = {};       // การ์ดที่ตอบไปแล้วในรอบนี้ (src|id) — กันโผล่ซ้ำระหว่างรอเขียนเสร็จ
  var ratedCount = 0;
  var filter = 'all';
  var shown = false;

  function dueMap(key, field, now) {
    var m = LC.read(key, {}), out = [];
    if (!isObj(m)) return out;
    Object.keys(m).forEach(function (k) { var r = m[k]; if (isObj(r) && Number(r[field]) <= now) out.push([k, r]); });
    return out;
  }
  function loadDeck() {
    var now = Date.now();
    var langDue = dueMap('lang-practice:srs', 'dueAt', now);
    var lbeDue = { biz: dueMap(LBE.biz.key, 'due', now), eng: dueMap(LBE.eng.key, 'due', now) };
    return Promise.all([
      LC.lawNotes(),
      lbeDue.biz.length ? lbeQuestions('biz') : null,
      lbeDue.eng.length ? lbeQuestions('eng') : null
    ]).then(function (res) {
      var cards = [], missing = { law: 0, lang: 0, biz: 0, eng: 0, books: 0 };
      (res[0] || []).forEach(function (n) {
        if (n && n.id != null && Number(n.dueAt) <= now) cards.push({ src: 'law', id: n.id, front: n.q, back: n.a, sub: n.subj, due: Number(n.dueAt), rec: n });
      });
      var faces = LC.read('tanot:learn:faces:lang', {}) || {}, fc = faces.cards || {}, langs = faces.langs || {};
      langDue.forEach(function (e) {
        var f = fc[e[0]];
        if (!f) { missing.lang++; return; }
        cards.push({ src: 'lang', id: e[0], front: f[0], back: f[1], sub: langs[e[0].split('::')[0]] || '', due: Number(e[1].dueAt), rec: e[1] });
      });
      ['biz', 'eng'].forEach(function (src, i) {
        var qb = res[1 + i];
        lbeDue[src].forEach(function (e) {
          var q = qb && qb[e[0]];
          if (!q) { missing[src]++; return; }
          cards.push({ src: src, id: e[0], front: q.q, back: q.a, sub: q.topic, due: Number(e[1].due), rec: e[1] });
        });
      });
      var bookTitle = {};
      (LC.read('tanot:books:items', []) || []).forEach(function (b) { if (b && b.id) bookTitle[b.id] = b.title; });
      (LC.read(BOOK_CARDS, []) || []).forEach(function (c) {
        if (isObj(c) && c.id && Number(c.dueAt) <= now && c.back) cards.push({ src: 'books', id: c.id, front: c.front, back: c.back, sub: bookTitle[c.bookId] || '', due: Number(c.dueAt), rec: c });
      });
      cards.sort(function (a, b) { return a.due - b.due; });
      deck = { cards: cards, missing: missing };
    });
  }
  function queue() {
    return deck.cards.filter(function (c) { return !rated[c.src + '|' + c.id] && (filter === 'all' || c.src === filter); });
  }
  function remaining(src) {
    var n = 0;
    deck.cards.forEach(function (c) { if (!rated[c.src + '|' + c.id] && (!src || c.src === src)) n++; });
    if (src) return n + (deck.missing[src] || 0);
    DECK_SRC.forEach(function (s) { n += deck.missing[s] || 0; });
    return n;
  }

  /* ── เขียนผลทบทวนกลับที่เดิม ── */
  function writeLaw(card, rating, now) {
    return new Promise(function (resolve, reject) {
      var r = indexedDB.open('tanot-barprep');
      r.onupgradeneeded = function () { try { r.transaction.abort(); } catch (e) {} }; // ห้ามสร้างฐานข้อมูลของหน้ากฎหมายเอง
      r.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); reject(r.error); };
      r.onsuccess = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains('notes')) { db.close(); reject(new Error('no notes store')); return; }
        var tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes'), g = os.get(card.id);
        g.onsuccess = function () {
          var rec = g.result;
          if (!rec) return;
          var u = FS.schedule(rec, rating, now);
          rec.stability = u.stability; rec.difficulty = u.difficulty; rec.reps = u.reps;
          rec.lapses = u.lapses; rec.lastReview = u.lastReview; rec.dueAt = u.dueAt; rec.srsIdx = u.srsIdx;
          os.put(rec);
        };
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error); };
      };
    }).then(function () {
      // log เดียวกับ logActivity('review') ของหน้ากฎหมาย — กราฟ 30 วันในหน้านั้นนับรอบที่ทบทวนจากหน้านี้ด้วย
      LC.update('tanot:barprep:activity', function (a) {
        a = Array.isArray(a) ? a : [];
        a.push({ t: 'review', ts: now });
        return a.length > 500 ? a.slice(a.length - 500) : a;
      });
    });
  }
  function rate(card, rating) {
    var now = Date.now();
    rated[card.src + '|' + card.id] = 1;
    ratedCount++;
    var p;
    if (card.src === 'law') p = writeLaw(card, rating, now);
    else if (card.src === 'books') {
      LC.update(BOOK_CARDS, function (rows) {
        rows = Array.isArray(rows) ? rows : [];
        for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].id === card.id) { rows[i] = Object.assign({}, rows[i], FS.schedule(rows[i], rating, now)); break; }
        return rows;
      });
    } else if (card.src === 'lang') {
      LC.update('lang-practice:srs', function (m) {
        m = isObj(m) ? m : {};
        m[card.id] = FS.schedule(m[card.id] || {}, rating, now);
        return m;
      });
    } else {
      LC.update(LBE[card.src].key, function (m) {
        m = isObj(m) ? m : {};
        m[card.id] = LC.lbeNext(m[card.id], rating >= 2, now);
        return m;
      });
    }
    LC.award(card.src, LC.XP_PER_REVIEW);
    shown = false;
    renderDeck();
    if (p) p.catch(function (e) { console.warn('บันทึกผลทบทวนการ์ดกฎหมายไม่สำเร็จ', e); delete rated[card.src + '|' + card.id]; ratedCount--; renderDeck(); });
  }

  /* ── วาด ── */
  function previewMs(card, r, now) {
    if (card.src === 'law' || card.src === 'lang' || card.src === 'books') return FS.preview(card.rec, r, now);
    return LC.lbeNext(card.rec, r >= 2, now).due - now;
  }
  function renderFilter() {
    var chips = [{ id: 'all', label: 'ทั้งหมด', n: remaining() }];
    DECK_SRC.forEach(function (s) { var n = remaining(s); if (n) chips.push({ id: s, label: LC.SOURCES[s].label, n: n }); });
    if (filter !== 'all' && !chips.some(function (c) { return c.id === filter; })) filter = 'all';
    $('rvFilter').innerHTML = chips.length > 1 || chips[0].n ? chips.map(function (c) {
      return '<button class="chip" type="button" data-f="' + c.id + '" aria-pressed="' + (filter === c.id) + '">' + esc(c.label) + ' ' + num(c.n) + '</button>';
    }).join('') : '';
  }
  function renderDeck() {
    renderFilter();
    var q = queue(), area = $('rvArea'), now = Date.now();
    var more = DECK_SRC.filter(function (s) { return deck.missing[s] && (filter === 'all' || filter === s); }).map(function (s) {
      return '<a class="btn sm" href="' + LC.SOURCES[s].href + '">' + icon(LC.SOURCES[s].icon) + esc(LC.SOURCES[s].label) + ' ' + num(deck.missing[s]) + '</a>';
    }).join('');
    more = more ? '<div class="rv-more">' + more + '</div>' : '';
    if (!q.length) {
      area.innerHTML = '<div class="empty">' + icon('circle-check') +
        '<p class="empty-title">' + (ratedCount ? 'ทบทวนครบแล้ว ' + num(ratedCount) + ' ใบ' : 'ไม่มีการ์ดค้างทบทวน') + '</p></div>' + more;
      renderKpis();
      return;
    }
    var c = q[0], S = LC.SOURCES[c.src];
    area.innerHTML =
      '<div class="rv-card' + (shown ? ' show' : '') + '" id="rvCard" tabindex="0" role="button" aria-expanded="' + shown + '">' +
        '<span class="src badge">' + icon(S.icon) + esc(S.label + (c.sub ? ' · ' + c.sub : '')) + '</span>' +
        '<div class="q">' + esc(c.front) + '</div>' +
        '<div class="a">' + esc(c.back || '—') + '</div>' +
      '</div>' +
      '<div class="rv-rate">' + RATINGS.map(function (x) {
        return '<button class="btn ' + x.cls + '" type="button" data-r="' + x.r + '">' + x.label + '<small>' + fmtInterval(previewMs(c, x.r, now)) + '</small></button>';
      }).join('') + '</div>' +
      '<div class="rv-progress">' + (ratedCount ? 'ทบทวนแล้ว ' + num(ratedCount) + ' · ' : '') + 'เหลือ ' + num(q.length) + '</div>' + more;
    renderKpis();
  }
  function renderKpis() {
    var s = LC.summary(), due = remaining();
    var pct = Math.min(100, s.goal ? Math.round(s.todayXp / s.goal * 100) : 0);
    var subStreak = [];
    if (s.streak.longest > s.streak.count) subStreak.push('สูงสุด ' + num(s.streak.longest) + ' วัน');
    if (s.streak.restUsed) subStreak.push('พัก ' + num(s.streak.restUsed) + ' วัน');
    if (!s.streak.doneToday && s.streak.count) subStreak.push('ยังไม่ได้ฝึกวันนี้');
    $('rvKpis').innerHTML =
      '<div class="kpi"><span class="kpi-label">ค้างทบทวน</span><span class="kpi-value" id="rvDue">' + num(due) + ' <small>ใบ</small></span></div>' +
      '<div class="kpi"><span class="kpi-label">XP วันนี้</span><span class="kpi-value" id="rvToday">' + num(s.todayXp) + ' <small>/ ' + num(s.goal) + '</small></span>' +
        '<div class="bar' + (s.goalMet ? ' ok' : '') + '"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="kpi"><span class="kpi-label">ติดต่อกัน</span><span class="kpi-value" id="rvStreak">' + icon('flame', 'flame') + ' ' + num(s.streak.count) + ' <small>วัน</small></span>' +
        (subStreak.length ? '<span class="sub">' + esc(subStreak.join(' · ')) + '</span>' : '') + '</div>' +
      '<div class="kpi"><span class="kpi-label">XP สะสม</span><span class="kpi-value" id="rvTotal">' + num(s.total) + '</span>' +
        (s.legacy ? '<span class="sub">ยอดเดิม ' + num(s.legacy) + '</span>' : '') + '</div>';
    $('rvDays').innerHTML = s.recent.map(function (d) {
      var cls = 'rv-day' + (d.active ? ' on' : '') + (d.xp >= s.goal ? ' goal' : '') + (d.d === s.today ? ' today' : '');
      return '<div class="' + cls + '" title="' + esc(d.d + ' · ' + d.xp + ' XP') + '"><i></i><span>' + parseInt(d.d.slice(8), 10) + '</span></div>';
    }).join('');
    var rows = LC.SRC_ORDER.filter(function (k) { return s.bySrc[k] > 0; }).sort(function (a, b) { return s.bySrc[b] - s.bySrc[a]; });
    $('rvSources').className = rows.length ? 'list' : '';
    $('rvSources').innerHTML = rows.length ? rows.map(function (k) {
      var S = LC.SOURCES[k], t = s.todayBySrc[k];
      return '<a class="list-row" href="' + S.href + '"><span class="lead">' + icon(S.icon) + '</span>' +
        '<span class="grow"><span class="title">' + esc(S.label) + '</span><span class="meta">' + esc(LC.AREAS[S.area]) + (t ? ' · วันนี้ +' + num(t) : '') + '</span></span>' +
        '<span class="val">' + num(s.bySrc[k]) + ' XP</span></a>';
    }).join('') : '<div class="empty">' + icon('star') + '<p>ยังไม่มี XP</p></div>';
    renderSettings(s);
  }
  function renderSettings(s) {
    var g = $('rvGoal'), r = $('rvRest');
    if (document.activeElement === g || document.activeElement === r) return;
    var goals = LC.GOALS.slice();
    if (goals.indexOf(s.goal) === -1) goals.push(s.goal), goals.sort(function (a, b) { return a - b; });
    g.innerHTML = goals.map(function (v) { return '<option value="' + v + '"' + (v === s.goal ? ' selected' : '') + '>' + v + ' XP</option>'; }).join('');
    r.innerHTML = LC.RESTS.map(function (v) { return '<option value="' + v + '"' + (v === s.rest ? ' selected' : '') + '>' + v + ' วัน</option>'; }).join('');
  }

  function flip() {
    var el = $('rvCard');
    if (!el) return;
    shown = !shown;
    el.classList.toggle('show', shown);
    el.setAttribute('aria-expanded', String(shown));
  }
  function current() { return queue()[0]; }

  $('rvArea').addEventListener('click', function (e) {
    var b = e.target.closest('[data-r]');
    if (b) { var c = current(); if (c) rate(c, +b.dataset.r); return; }
    if (e.target.closest('#rvCard')) flip();
  });
  $('rvFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f; shown = false; renderDeck();
  });
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) return;
    if (document.querySelector('.ome-pal:not([hidden]), .ome-qa:not([hidden]), dialog[open]')) return; // ค้นหาด่วน/เพิ่มด่วน/กล่องโต้ตอบเปิดอยู่
    if ((e.key === ' ' || e.key === 'Enter') && (e.target === document.body || e.target.id === 'rvCard')) { e.preventDefault(); flip(); return; }
    if (/^[1-4]$/.test(e.key) && shown) { var c = current(); if (c) { e.preventDefault(); rate(c, +e.key); } }
  });
  $('rvGoal').addEventListener('change', function () { LC.saveSettings({ goal: +this.value }); this.blur(); });
  $('rvRest').addEventListener('change', function () { LC.saveSettings({ rest: +this.value }); this.blur(); });

  // ข้อมูลเปลี่ยน (แท็บอื่น / เครื่องอื่น / XP ที่เพิ่งให้) — XP/ตั้งค่าวาดใหม่ทันที, กองการ์ดโหลดใหม่เฉพาะเมื่อคีย์การ์ดเปลี่ยนจากที่อื่น
  window.addEventListener('tanot:learn', function () { renderKpis(); });
  if (window.TanotData && window.TanotData.onChange) {
    window.TanotData.onChange(function (keys) {
      var deckChanged = !keys.length || keys.some(function (k) { return /srs$|^idb:tanot-barprep|^tanot:learn:faces|^tanot:books:(cards|items)/.test(k); });
      if (deckChanged) loadDeck().then(renderDeck); else renderKpis();
    });
  }

  renderKpis();
  loadDeck().then(renderDeck, function (e) { console.warn(e); renderDeck(); });
})();
