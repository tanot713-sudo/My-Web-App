/* ══════════════════════════════════════════════════════════════════
   Tanot — หนังสือ (books.html) · ส่วนแสดงผล
   ตรรกะ (ล้าง/รวมข้อมูล, สถิติรายสัปดาห์, การ์ดจากไฮไลต์, Open Library) อยู่ใน books-calc.js (window.BooksCalc) — ไฟล์นี้อ่าน/เขียน storage + วาดหน้า
   ข้อมูล: localStorage['tanot:books:items|logs|notes|cards|settings'] (sync) · ['tanot:books:ui'] (local) — รูปแบบอธิบายที่หัว books-calc.js
   ออกเน็ตจุดเดียว: ค้นหนังสือที่ openlibrary.org (ส่งเฉพาะคำค้นที่พิมพ์ ไม่ส่งคุกกี้/referrer) + รูปปกจาก covers.openlibrary.org
   การ์ดทบทวน: แถวใน tanot:books:cards — review.html อ่านแล้วเขียนผล FSRS กลับด้วยตัวเอง
   XP: LearnCore.award('books') เมื่อบันทึกการอ่าน (5) / อ่านจบครั้งแรกของเล่ม (20)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  window.TANOT_NO_RELOAD_BAR = true; // วาดใหม่เองเมื่อ TanotData.onChange — ห้ามรีเซ็ตช่องในฟอร์มที่กำลังกรอก

  var B = window.BooksCalc, LC = window.LearnCore, TD = window.TanotData;
  var K = { items: 'tanot:books:items', logs: 'tanot:books:logs', notes: 'tanot:books:notes', cards: 'tanot:books:cards', settings: 'tanot:books:settings', ui: 'tanot:books:ui' };
  var SHELVES = ['want', 'reading', 'done'];
  var GOALS = [6, 12, 24, 36, 52];

  var T = OME_I18N.scope('bk', {
    th: {
      title: 'หนังสือ', add: 'เพิ่มหนังสือ', tabShelf: 'ชั้นหนังสือ', tabStats: 'สถิติ', tabNotes: 'ไฮไลต์', shelfAria: 'ชั้น',
      wkTitle: 'หน้าต่อสัปดาห์', wkAria: 'หน้าต่อสัปดาห์ 8 สัปดาห์ล่าสุด', goalTitle: 'เป้าหนังสือปีนี้', goalAria: 'เป้าเล่มต่อปี',
      logTitle: 'บันทึกการอ่าน', bookAria: 'หนังสือ', addNote: 'เพิ่มไฮไลต์', searchLbl: 'ค้นหาหนังสือ (Open Library)', search: 'ค้นหา',
      titleLbl: 'ชื่อหนังสือ', author: 'ผู้แต่ง', shelf: 'ชั้น', pages: 'จำนวนหน้า', readTo: 'อ่านถึงหน้า', start: 'วันเริ่ม', end: 'วันจบ',
      rating: 'คะแนน', review: 'รีวิวสั้น', date: 'วันที่', lPages: 'อ่านกี่หน้า', lMin: 'กี่นาที', page: 'หน้า', nText: 'ข้อความ / โน้ต',
      nQ: 'คำถามหน้าการ์ด (ไม่บังคับ)', want: 'อยากอ่าน', reading: 'กำลังอ่าน', done: 'อ่านจบ', del: 'ลบ', cancel: 'ยกเลิก', save: 'บันทึก',
      startRead: 'เริ่มอ่าน', note: 'ไฮไลต์', edit: 'แก้ไข', pagesOf: '{a} / {b} หน้า', readToN: 'อ่านถึงหน้า {n}', started: 'เริ่ม {d}', finished: 'จบ {d}',
      empty: 'ยังไม่มีหนังสือ', kWeekPages: 'หน้าสัปดาห์นี้', kWeekMin: 'นาทีสัปดาห์นี้', kYear: 'อ่านจบปีนี้', kTotal: 'หน้าที่บันทึกทั้งหมด',
      uPages: 'หน้า', uMin: 'นาที', uBooks: 'เล่ม', weekTip: 'สัปดาห์เริ่ม {d} · {n} หน้า', booksN: '{n} เล่ม', nPages: '{n} หน้า', nMin: '{n} นาที',
      delLog: 'ลบบันทึก', noLogs: 'ยังไม่มีบันทึกการอ่าน', allBooks: 'ทุกเล่ม', isCard: 'เป็นการ์ดแล้ว', cardDue: ' · ถึงรอบทบทวน',
      mkcard: 'ทำเป็นการ์ดทบทวน', pageN: ' · หน้า {n}', noNotes: 'ยังไม่มีไฮไลต์', offline: 'ออฟไลน์ — กรอกเอง', searching: 'กำลังค้นหา…',
      notFound: 'ไม่พบ — กรอกเอง', failed: 'ค้นหาไม่ได้ — กรอกเอง', needTitle: 'ใส่ชื่อหนังสือ', needDate: 'เลือกวันที่', needPages: 'ใส่จำนวนหน้าหรือนาที',
      needText: 'ใส่ข้อความ', addFirst: 'เพิ่มหนังสือก่อน', editBook: 'แก้ไขหนังสือ', editNote: 'แก้ไขไฮไลต์', noRating: 'ไม่ให้คะแนน',
      starsAria: 'คะแนน {n} จาก 5', cDelBook: 'ลบหนังสือเล่มนี้ พร้อมบันทึกการอ่าน ไฮไลต์ และการ์ดทบทวนของเล่มนี้?', cDelLog: 'ลบบันทึกการอ่านนี้?',
      cDelNote: 'ลบไฮไลต์นี้ (และการ์ดทบทวนของไฮไลต์นี้)?'
    },
    en: {
      title: 'Books', add: 'Add book', tabShelf: 'Shelf', tabStats: 'Stats', tabNotes: 'Highlights', shelfAria: 'Shelf',
      wkTitle: 'Pages per week', wkAria: 'Pages per week, last 8 weeks', goalTitle: 'Reading goal this year', goalAria: 'Books per year',
      logTitle: 'Reading log', bookAria: 'Book', addNote: 'Add highlight', searchLbl: 'Search books (Open Library)', search: 'Search',
      titleLbl: 'Title', author: 'Author', shelf: 'Shelf', pages: 'Pages', readTo: 'Read up to page', start: 'Start date', end: 'Finish date',
      rating: 'Rating', review: 'Short review', date: 'Date', lPages: 'Pages read', lMin: 'Minutes', page: 'Page', nText: 'Text / note',
      nQ: 'Card question (optional)', want: 'Want to read', reading: 'Reading', done: 'Finished', del: 'Delete', cancel: 'Cancel', save: 'Save',
      startRead: 'Start reading', note: 'Highlight', edit: 'Edit', pagesOf: '{a} / {b} pages', readToN: 'Read up to page {n}', started: 'Started {d}', finished: 'Finished {d}',
      empty: 'No books yet', kWeekPages: 'Pages this week', kWeekMin: 'Minutes this week', kYear: 'Finished this year', kTotal: 'Total pages logged',
      uPages: 'pages', uMin: 'min', uBooks: 'books', weekTip: 'Week of {d} · {n} pages', booksN: '{n} books', nPages: '{n} pages', nMin: '{n} min',
      delLog: 'Delete entry', noLogs: 'No reading log yet', allBooks: 'All books', isCard: 'Already a card', cardDue: ' · due for review',
      mkcard: 'Make review card', pageN: ' · page {n}', noNotes: 'No highlights yet', offline: 'Offline — enter it yourself', searching: 'Searching…',
      notFound: 'Not found — enter it yourself', failed: 'Search failed — enter it yourself', needTitle: 'Enter a title', needDate: 'Choose a date', needPages: 'Enter pages or minutes',
      needText: 'Enter some text', addFirst: 'Add a book first', editBook: 'Edit book', editNote: 'Edit highlight', noRating: 'No rating',
      starsAria: 'Rating {n} of 5', cDelBook: 'Delete this book with its reading log, highlights and review cards?', cDelLog: 'Delete this reading entry?',
      cDelNote: 'Delete this highlight (and its review card)?'
    }
  });
  window.OME_PAGE_LIVE_LANG = true;
  function setTitle() { document.title = T('title') + ' | Tanot'; }
  setTitle();

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function num(n) { return OME_I18N.number(Number(n) || 0, { maximumFractionDigits: 0 }); }
  function today() { return B.dayKey(Date.now()); }
  function dateTh(k) { var d = B.parseDay(k); return d ? OME_I18N.date(d, { day: 'numeric', month: 'short', year: '2-digit' }) : ''; }
  function newId(p) {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function openDlg(d) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }
  function closeDlg(d) { if (d.close) d.close(); else d.removeAttribute('open'); }
  function stars(n) { return n ? '<span class="bk-stars" aria-label="' + esc(T('starsAria', { n: n })) + '">' + '★'.repeat(n) + '☆'.repeat(5 - n) + '</span>' : ''; }
  function award(n) { if (LC && LC.award) LC.award('books', n); }

  /* ── storage: อ่านสดทุกครั้ง · เขียนด้วย getItem → แก้ → setItem (tanot-data รู้ว่าหน้านี้เห็นแถวจากเครื่องอื่นแล้ว ลบแล้วไม่ถูก merge ใส่กลับ) ── */
  function load(key) {
    var v = TD && TD.read ? TD.read(key, []) : null;
    if (v == null) { try { v = JSON.parse(localStorage.getItem(key)); } catch (e) { v = null; } }
    return Array.isArray(v) ? v.filter(function (x) { return x && typeof x === 'object' && x.id; }) : [];
  }
  function mutate(key, fn) {
    var cur = null;
    try { cur = JSON.parse(localStorage.getItem(key)); } catch (e) {}
    var next = fn(Array.isArray(cur) ? cur : []);
    if (next !== undefined) localStorage.setItem(key, JSON.stringify(next));
    return next;
  }
  function upsert(key, rec) {
    mutate(key, function (list) {
      var i = list.findIndex(function (x) { return x && x.id === rec.id; });
      if (i === -1) list.push(rec); else list[i] = rec;
      return list;
    });
  }
  function removeWhere(key, pred) { mutate(key, function (list) { return list.filter(function (x) { return x && !pred(x); }); }); }
  function settings() { var s = TD && TD.read ? TD.read(K.settings, null) : null; return s && typeof s === 'object' ? s : {}; }
  var ui = (function () { try { return JSON.parse(localStorage.getItem(K.ui)) || {}; } catch (e) { return {}; } })();
  function saveUi() { try { localStorage.setItem(K.ui, JSON.stringify(ui)); } catch (e) {} }
  function books() { return load(K.items).map(B.cleanBook); }
  function bookById(id) { return books().filter(function (b) { return b.id === id; })[0]; }
  function commit(rec) { // อ่านจบครั้งแรก = XP ครั้งเดียวต่อเล่ม (xpDone เก็บในเล่ม ซิงก์ข้ามเครื่อง)
    if (rec.status === 'done' && !rec.xpDone) { rec.xpDone = true; award(B.XP.finish); }
    if (!rec.createdAt) rec.createdAt = Date.now();
    upsert(K.items, rec);
    return rec;
  }

  /* ── วาด ── */
  function coverHtml(b) {
    var u = B.coverUrl(b.coverId, 'M');
    return '<span class="bk-cover">' + icon('book-open') + (u ? '<img src="' + esc(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span>';
  }
  function bookRow(b) {
    var p = B.progress(b), acts = [];
    if (b.status === 'want') acts.push(['start', T('startRead'), 'primary']);
    if (b.status === 'reading') { acts.push(['log', T('logTitle'), 'primary']); acts.push(['finish', T('done'), '']); }
    acts.push(['note', T('note'), '']); acts.push(['edit', T('edit'), '']);
    var meta = [];
    if (b.pages) meta.push(T('pagesOf', { a: num(b.status === 'want' ? 0 : b.current), b: num(b.pages) }));
    else if (b.current) meta.push(T('readToN', { n: num(b.current) }));
    if (b.startedAt) meta.push(T('started', { d: dateTh(b.startedAt) }));
    if (b.finishedAt) meta.push(T('finished', { d: dateTh(b.finishedAt) }));
    return '<div class="bk-book" data-bid="' + esc(b.id) + '">' + coverHtml(b) +
      '<div class="bk-body"><div class="bk-title">' + esc(b.title) + '</div>' +
      (b.author ? '<div class="bk-meta">' + esc(b.author) + '</div>' : '') +
      (meta.length ? '<div class="bk-meta">' + esc(meta.join(' · ')) + '</div>' : '') +
      (b.pages && b.status !== 'want' ? '<div class="bk-bar' + (b.status === 'done' ? ' ok' : '') + '"><i style="width:' + p.pct + '%"></i></div>' : '') +
      (b.rating ? '<div>' + stars(b.rating) + '</div>' : '') +
      (b.review ? '<div class="bk-review">' + esc(b.review) + '</div>' : '') +
      '<div class="bk-acts">' + acts.map(function (a) { return '<button class="btn sm ' + a[2] + '" type="button" data-act="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div>' +
      '</div></div>';
  }
  function renderShelf() {
    var all = books(), cur = ui.shelf || 'reading';
    $('shelfSeg').innerHTML = SHELVES.map(function (s) {
      return '<button type="button" data-shelf="' + s + '" aria-pressed="' + (cur === s) + '">' + esc(T(s)) + ' ' + num(B.byStatus(all, s).length) + '</button>';
    }).join('');
    var list = B.byStatus(all, cur).sort(function (a, b) {
      return cur === 'done' ? String(b.finishedAt).localeCompare(String(a.finishedAt)) : b.createdAt - a.createdAt;
    });
    $('shelf').innerHTML = list.length ? list.map(bookRow).join('') :
      '<div class="empty">' + icon('book-open') + '<p class="empty-title">' + esc(T('empty')) + '</p></div>';
  }
  function renderStats() {
    var logs = load(K.logs).map(B.cleanLog), wk = B.weekly(logs, Date.now(), 8), cur = wk[wk.length - 1];
    var ys = B.yearSummary(books(), settings(), Date.now()), totalPages = logs.reduce(function (s, l) { return s + l.pages; }, 0);
    function k(label, value, unit, id) { return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value" id="' + id + '">' + value + (unit ? '<small>' + unit + '</small>' : '') + '</div></div>'; }
    $('kpis').innerHTML = k(T('kWeekPages'), num(cur.pages), T('uPages'), 'kWeekPages') + k(T('kWeekMin'), num(cur.minutes), T('uMin'), 'kWeekMin') +
      k(T('kYear'), num(ys.done) + ' / ' + num(ys.goal), T('uBooks'), 'kYear') + k(T('kTotal'), num(totalPages), T('uPages'), 'kTotal');
    var max = Math.max.apply(null, wk.map(function (w) { return w.pages; }).concat([1]));
    $('chart').innerHTML = wk.map(function (w, i) {
      var d = B.parseDay(w.start);
      return '<div class="bk-col' + (i === wk.length - 1 ? ' cur' : '') + '" title="' + esc(T('weekTip', { d: dateTh(w.start), n: w.pages })) + '"><b>' + (w.pages ? num(w.pages) : '') + '</b><i style="height:' + Math.round(w.pages / max * 100) + '%"></i><span>' + d.getDate() + '/' + (d.getMonth() + 1) + '</span></div>';
    }).join('');
    var goals = GOALS.slice();
    if (goals.indexOf(ys.goal) === -1) { goals.push(ys.goal); goals.sort(function (a, b) { return a - b; }); }
    if (document.activeElement !== $('goalSel')) $('goalSel').innerHTML = goals.map(function (g) { return '<option value="' + g + '"' + (g === ys.goal ? ' selected' : '') + '>' + esc(T('booksN', { n: g })) + '</option>'; }).join('');
    $('goalBox').innerHTML = '<div class="bk-bar' + (ys.done >= ys.goal ? ' ok' : '') + '"><i style="width:' + ys.pct + '%"></i></div>';
    var titles = {};
    books().forEach(function (b) { titles[b.id] = b.title; });
    var rows = logs.filter(function (l) { return l.date; }).sort(function (a, b) { return b.date.localeCompare(a.date) || b.ts - a.ts; }).slice(0, 30);
    $('logList').innerHTML = rows.length ? rows.map(function (l) {
      return '<div class="list-row" data-lid="' + esc(l.id) + '"><span class="grow"><span class="title">' + esc(titles[l.bookId] || '—') + '</span><span class="meta" style="display:block">' +
        esc(dateTh(l.date) + ' · ' + (l.pages ? T('nPages', { n: num(l.pages) }) : '') + (l.pages && l.minutes ? ' · ' : '') + (l.minutes ? T('nMin', { n: num(l.minutes) }) : '')) + '</span></span>' +
        '<button class="btn sm ghost icon" type="button" data-act="del-log" aria-label="' + esc(T('delLog')) + '">' + icon('trash-2') + '</button></div>';
    }).join('') : '<div class="empty">' + icon('clock') + '<p class="empty-title">' + esc(T('noLogs')) + '</p></div>';
  }
  function renderNotes() {
    var all = books(), sel = $('noteBook'), keep = sel.value || ui.noteBook || '';
    if (document.activeElement !== sel) {
      sel.innerHTML = '<option value="">' + esc(T('allBooks')) + '</option>' + all.map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.title) + '</option>'; }).join('');
      sel.value = all.some(function (b) { return b.id === keep; }) ? keep : '';
    }
    var titles = {}, cards = {};
    all.forEach(function (b) { titles[b.id] = b.title; });
    load(K.cards).forEach(function (c) { cards[c.id] = c; });
    var now = Date.now();
    var list = load(K.notes).map(B.cleanNote).filter(function (n) { return !sel.value || n.bookId === sel.value; }).sort(function (a, b) { return b.ts - a.ts; });
    $('noteList').innerHTML = list.length ? list.map(function (n) {
      var c = cards[B.cardId(n.id)];
      var cardBtn = c ? '<span class="badge ' + (Number(c.dueAt) <= now ? 'warn' : 'ok') + '">' + esc(T('isCard') + (Number(c.dueAt) <= now ? T('cardDue') : '')) + '</span>'
        : '<button class="btn sm primary" type="button" data-act="mkcard">' + icon('brain') + esc(T('mkcard')) + '</button>';
      return '<div class="bk-note" data-nid="' + esc(n.id) + '"><div class="bk-quote">' + esc(n.text) + '</div>' +
        '<div class="bk-meta">' + esc((titles[n.bookId] || '—') + (n.page ? T('pageN', { n: n.page }) : '')) + '</div>' +
        '<div class="bk-acts">' + cardBtn + '<button class="btn sm" type="button" data-act="edit-note">' + esc(T('edit')) + '</button><button class="btn sm ghost" type="button" data-act="del-note">' + esc(T('del')) + '</button></div></div>';
    }).join('') : '<div class="empty">' + icon('highlighter') + '<p class="empty-title">' + esc(T('noNotes')) + '</p></div>';
  }
  function render() {
    var tab = ui.tab || 'shelf';
    Array.prototype.forEach.call(document.querySelectorAll('#tabs .tab'), function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === tab)); });
    $('paneShelf').hidden = tab !== 'shelf'; $('paneStats').hidden = tab !== 'stats'; $('paneNotes').hidden = tab !== 'notes';
    if (tab === 'shelf') renderShelf(); else if (tab === 'stats') renderStats(); else renderNotes();
  }

  /* ── เพิ่ม/แก้หนังสือ + ค้น Open Library ── */
  var editing = null, meta = { coverId: 0, olKey: '' }, searchSeq = 0;
  function fillBook(b) {
    $('bTitle').value = b.title || ''; $('bAuthor').value = b.author || '';
    $('bStatus').value = b.status || 'want'; $('bPages').value = b.pages || ''; $('bCur').value = b.current || '';
    $('bStart').value = b.startedAt || ''; $('bEnd').value = b.finishedAt || '';
    $('bRating').value = String(b.rating || 0); $('bReview').value = b.review || '';
  }
  function openBook(b) {
    editing = b || null;
    meta = { coverId: b ? b.coverId : 0, olKey: b ? b.olKey : '' };
    $('bTitleH').textContent = b ? T('editBook') : T('add');
    fillBook(b || { status: ui.shelf || 'want' });
    $('searchBox').hidden = !!b; $('sQ').value = ''; $('sRes').innerHTML = ''; $('sMsg').textContent = ''; $('bMsg').textContent = '';
    $('bDel').hidden = !b;
    openDlg($('bdlg'));
    $(b ? 'bTitle' : 'sQ').focus();
  }
  function search() {
    var q = $('sQ').value.trim(), seq = ++searchSeq;
    if (!q) return;
    $('sRes').innerHTML = '';
    if (navigator.onLine === false) { $('sMsg').textContent = T('offline'); return; }
    $('sMsg').textContent = T('searching');
    var ctl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    fetch(B.searchUrl(q), { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        if (seq !== searchSeq) return;
        var res = B.parseSearch(j);
        $('sMsg').textContent = res.length ? '' : T('notFound');
        $('sRes').innerHTML = res.map(function (b, i) {
          return '<button type="button" class="btn bk-hit" data-hit="' + i + '">' + coverHtml(b) + '<span class="bk-body"><span class="bk-title">' + esc(b.title) + '</span><span class="bk-meta">' + esc([b.author, b.pages ? T('nPages', { n: num(b.pages) }) : ''].filter(Boolean).join(' · ')) + '</span></span></button>';
        }).join('');
        $('sRes')._res = res;
      })
      .catch(function () { if (seq === searchSeq) $('sMsg').textContent = T('failed'); })
      .then(function () { clearTimeout(t); });
  }
  function saveBook(e) {
    e.preventDefault();
    var title = $('bTitle').value.trim();
    if (!title) { $('bMsg').textContent = T('needTitle'); return; }
    var rec = B.cleanBook(Object.assign({}, editing || {}, {
      id: editing ? editing.id : newId('b'), title: title, author: $('bAuthor').value, status: $('bStatus').value,
      pages: $('bPages').value, current: $('bCur').value, startedAt: $('bStart').value, finishedAt: $('bEnd').value,
      rating: $('bRating').value, review: $('bReview').value, coverId: meta.coverId, olKey: meta.olKey
    }));
    if (rec.status === 'reading' && !rec.startedAt) rec.startedAt = today();
    if (rec.status === 'done') rec = B.finish(Object.assign({}, rec, { finishedAt: rec.finishedAt || today() }), rec.finishedAt || today());
    else if (rec.status !== 'done') rec.finishedAt = '';
    commit(rec);
    closeDlg($('bdlg')); render();
  }
  function deleteBook(id) {
    window.tanotConfirm(T('cDelBook'), { danger: true, okLabel: T('del') }).then(function (ok) {
      if (!ok) return;
      removeWhere(K.items, function (x) { return x.id === id; });
      removeWhere(K.logs, function (x) { return x.bookId === id; });
      removeWhere(K.notes, function (x) { return x.bookId === id; });
      removeWhere(K.cards, function (x) { return x.bookId === id; });
      closeDlg($('bdlg')); render();
    });
  }

  /* ── บันทึกการอ่าน ── */
  var logBook = null;
  function openLog(b) {
    logBook = b;
    $('lTitleH').textContent = b.title;
    $('lDate').value = today(); $('lPages').value = ''; $('lMin').value = ''; $('lTo').value = ''; $('lMsg').textContent = '';
    openDlg($('ldlg')); $('lPages').focus();
  }
  function saveLog(e) {
    e.preventDefault();
    var b = bookById(logBook && logBook.id);
    if (!b) { closeDlg($('ldlg')); return; }
    var date = $('lDate').value, pages = Math.floor(Number($('lPages').value)) || 0, min = Math.floor(Number($('lMin').value)) || 0, to = Math.floor(Number($('lTo').value)) || 0;
    if (!B.parseDay(date)) { $('lMsg').textContent = T('needDate'); return; }
    if (!pages && to) pages = Math.max(to - b.current, 0);
    if (!pages && !min) { $('lMsg').textContent = T('needPages'); return; }
    upsert(K.logs, { id: newId('l'), bookId: b.id, date: date, pages: pages, minutes: min, ts: Date.now() });
    commit(B.applyLog(b, { date: date, pages: pages, to: to }));
    award(B.XP.log);
    closeDlg($('ldlg')); render();
  }

  /* ── ไฮไลต์/การ์ด ── */
  var editNote = null;
  function noteBooksOptions(sel) {
    var all = books();
    $('nBookSel').innerHTML = all.map(function (b) { return '<option value="' + esc(b.id) + '"' + (b.id === sel ? ' selected' : '') + '>' + esc(b.title) + '</option>'; }).join('');
    return all.length;
  }
  function openNote(n, bookId) {
    if (!noteBooksOptions(n ? n.bookId : bookId || $('noteBook').value || (books().filter(function (b) { return b.status === 'reading'; })[0] || {}).id)) {
      window.tanotAlert(T('addFirst')); return;
    }
    editNote = n || null;
    $('nTitleH').textContent = n ? T('editNote') : T('tabNotes');
    $('nPage').value = n && n.page ? n.page : ''; $('nText').value = n ? n.text : ''; $('nQ').value = n ? n.q : ''; $('nMsg').textContent = '';
    openDlg($('ndlg')); $('nText').focus();
  }
  function makeCard(note, now) {
    var book = bookById(note.bookId), had = null;
    mutate(K.cards, function (list) {
      var id = B.cardId(note.id), i = list.findIndex(function (x) { return x && x.id === id; });
      had = i === -1 ? null : list[i];
      var c = B.makeCard(note, book, now, had);
      if (i === -1) list.push(c); else list[i] = c;
      return list;
    });
  }
  function saveNote(e) {
    e.preventDefault();
    var text = $('nText').value.trim();
    if (!text) { $('nMsg').textContent = T('needText'); return; }
    var n = B.cleanNote({ id: editNote ? editNote.id : newId('n'), bookId: $('nBookSel').value, page: $('nPage').value, text: text, q: $('nQ').value, cardId: editNote ? editNote.cardId : '', ts: editNote ? editNote.ts : Date.now() });
    upsert(K.notes, n);
    if (n.cardId) makeCard(n, Date.now()); // แก้หน้าการ์ดตามไฮไลต์ ตารางทบทวนเดิมไม่ถูกล้าง
    ui.noteBook = n.bookId; saveUi();
    closeDlg($('ndlg')); render();
  }
  function noteById(id) { return load(K.notes).map(B.cleanNote).filter(function (n) { return n.id === id; })[0]; }

  /* ── events ── */
  $('addBtn').addEventListener('click', function () { openBook(null); });
  $('tabs').addEventListener('click', function (e) { var t = e.target.closest('[data-tab]'); if (t) { ui.tab = t.dataset.tab; saveUi(); render(); } });
  $('shelfSeg').addEventListener('click', function (e) { var t = e.target.closest('[data-shelf]'); if (t) { ui.shelf = t.dataset.shelf; saveUi(); render(); } });
  $('shelf').addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]'), row = e.target.closest('[data-bid]');
    if (!a || !row) return;
    var b = bookById(row.dataset.bid);
    if (!b) return;
    if (a.dataset.act === 'edit') openBook(b);
    else if (a.dataset.act === 'log') openLog(b);
    else if (a.dataset.act === 'note') { ui.tab = 'notes'; ui.noteBook = b.id; saveUi(); render(); openNote(null, b.id); }
    else if (a.dataset.act === 'start') { b.status = 'reading'; b.startedAt = b.startedAt || today(); commit(b); ui.shelf = 'reading'; saveUi(); render(); }
    else if (a.dataset.act === 'finish') { commit(B.finish(b, today())); ui.shelf = 'done'; saveUi(); render(); openBook(bookById(b.id)); }
  });
  $('shelf').addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.remove(); }, true);
  $('sRes').addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.remove(); }, true);
  $('sGo').addEventListener('click', search);
  $('sQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); search(); } });
  $('sRes').addEventListener('click', function (e) {
    var h = e.target.closest('[data-hit]');
    if (!h) return;
    var b = $('sRes')._res[+h.dataset.hit];
    meta = { coverId: b.coverId, olKey: b.olKey };
    fillBook(Object.assign({}, b, { status: $('bStatus').value }));
    $('sRes').innerHTML = ''; $('sMsg').textContent = '';
  });
  $('bform').addEventListener('submit', saveBook);
  $('bCancel').addEventListener('click', function () { closeDlg($('bdlg')); });
  $('bDel').addEventListener('click', function () { if (editing) deleteBook(editing.id); });
  $('lform').addEventListener('submit', saveLog);
  $('lCancel').addEventListener('click', function () { closeDlg($('ldlg')); });
  $('nform').addEventListener('submit', saveNote);
  $('nCancel').addEventListener('click', function () { closeDlg($('ndlg')); });
  $('addNote').addEventListener('click', function () { openNote(null); });
  $('noteBook').addEventListener('change', function () { ui.noteBook = this.value; saveUi(); renderNotes(); });
  $('goalSel').addEventListener('change', function () {
    var v = +this.value;
    if (TD && TD.update) TD.update(K.settings, function (s) { s = s && typeof s === 'object' ? s : {}; s.yearGoal = v; return s; });
    else localStorage.setItem(K.settings, JSON.stringify({ yearGoal: v }));
    this.blur(); render();
  });
  $('logList').addEventListener('click', function (e) {
    var a = e.target.closest('[data-act="del-log"]'), row = e.target.closest('[data-lid]');
    if (!a || !row) return;
    window.tanotConfirm(T('cDelLog'), { danger: true, okLabel: T('del') }).then(function (ok) {
      if (ok) { removeWhere(K.logs, function (x) { return x.id === row.dataset.lid; }); render(); }
    });
  });
  $('noteList').addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]'), row = e.target.closest('[data-nid]');
    if (!a || !row) return;
    var n = noteById(row.dataset.nid);
    if (!n) return;
    if (a.dataset.act === 'edit-note') openNote(n);
    else if (a.dataset.act === 'mkcard') {
      n.cardId = B.cardId(n.id);
      upsert(K.notes, n);
      makeCard(n, Date.now());
      render();
    } else if (a.dataset.act === 'del-note') {
      window.tanotConfirm(T('cDelNote'), { danger: true, okLabel: T('del') }).then(function (ok) {
        if (!ok) return;
        removeWhere(K.notes, function (x) { return x.id === n.id; });
        removeWhere(K.cards, function (x) { return x.id === B.cardId(n.id); });
        render();
      });
    }
  });

  function ratingOpts() {
    var v = $('bRating').value;
    $('bRating').innerHTML = '<option value="0">' + esc(T('noRating')) + '</option>' + [1, 2, 3, 4, 5].map(function (i) { return '<option value="' + i + '">' + '★'.repeat(i) + '</option>'; }).join('');
    if (v) $('bRating').value = v;
  }
  ratingOpts();
  if (TD && TD.onChange) TD.onChange(render);
  OME_LANG.onChange(function () {
    setTitle();
    ratingOpts();
    if (!$('bdlg').open) $('bTitleH').textContent = T('title');
    if (!$('ldlg').open) $('lTitleH').textContent = T('logTitle');
    if (!$('ndlg').open) $('nTitleH').textContent = T('tabNotes');
    render();
  });
  render();
})();
