/* ══════════════════════════════════════════════════════════════════
   หนังสือ (books.html) — ตรรกะล้วน ไม่มี DOM/storage (UMD: window.BooksCalc, require() ได้ใน test)

   คีย์ (ลงทะเบียนใน data-registry.js — ทุกคีย์ sync list idField id ยกเว้น settings):
     tanot:books:items     1 เล่ม = 1 แถว
       { id, title, author, coverId (เลขปกของ Open Library หรือ 0), olKey, pages (0 = ไม่ทราบ), current (หน้าที่อ่านถึง),
         status 'want'|'reading'|'done', startedAt 'YYYY-MM-DD', finishedAt, rating 0–5, review, xpDone (true = ให้ XP อ่านจบแล้ว), createdAt }
     tanot:books:logs      บันทึกการอ่านรายวัน 1 ครั้ง = 1 แถว { id, bookId, date 'YYYY-MM-DD', pages, minutes, ts }
     tanot:books:notes     ไฮไลต์/โน้ต { id, bookId, page, text, q (คำถามหน้าการ์ด ไม่บังคับ), cardId, ts }
     tanot:books:cards     การ์ดทบทวน (id ตายตัว 'card-<noteId>' — สองเครื่องกดพร้อมกันได้แถวเดียว)
                           { id, noteId, bookId, front, back, createdAt } + ฟิลด์ FSRS (stability difficulty reps lapses lastReview dueAt srsIdx)
                           — หน้า review.html เขียนฟิลด์ FSRS กลับด้วย TanotFSRS.schedule เหมือนการ์ดกฎหมาย/ภาษา
     tanot:books:settings  blob { yearGoal } (เป้าจำนวนเล่มต่อปี)
   วันที่ทั้งหมดเป็นวันตามเวลาเครื่อง (ไม่ใช่ UTC)
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BooksCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STATUSES = ['want', 'reading', 'done'];
  var XP = { log: 5, finish: 20 }; // ทบทวนการ์ด = LearnCore.XP_PER_REVIEW (review.js)
  var DEFAULT_GOAL = 12;
  var SEARCH_FIELDS = 'key,title,author_name,cover_i,number_of_pages_median,first_publish_year';

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(t) { var d = t instanceof Date ? t : new Date(t == null ? Date.now() : t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseDay(k) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k || ''));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }
  function addDays(k, n) { var d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); }
  function weekStart(k) { var d = parseDay(k), dow = (d.getDay() + 6) % 7; return addDays(k, -dow); } // จันทร์เริ่มสัปดาห์
  function nint(v, max) { var n = Math.floor(Number(v)); return isFinite(n) && n > 0 ? Math.min(n, max || 1e7) : 0; }
  function str(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); }
  function validDay(v) { return parseDay(v) ? String(v) : ''; }

  /* ── เล่ม ── */
  function cleanBook(b) {
    b = b || {};
    var pages = nint(b.pages, 100000);
    var cur = nint(b.current, 100000);
    if (pages && cur > pages) cur = pages;
    var rating = Math.floor(Number(b.rating));
    return {
      id: String(b.id || ''), title: str(b.title, 200), author: str(b.author, 200),
      coverId: nint(b.coverId, 1e12), olKey: /^\/works\/OL\d+W$/.test(b.olKey || '') ? b.olKey : '',
      pages: pages, current: cur,
      status: STATUSES.indexOf(b.status) !== -1 ? b.status : 'want',
      startedAt: validDay(b.startedAt), finishedAt: validDay(b.finishedAt),
      rating: rating >= 1 && rating <= 5 ? rating : 0,
      review: String(b.review == null ? '' : b.review).trim().slice(0, 1000),
      xpDone: !!b.xpDone, createdAt: Number(b.createdAt) || 0
    };
  }
  function progress(b) {
    if (!b.pages) return { pct: b.status === 'done' ? 100 : 0, left: 0 };
    return { pct: Math.min(100, Math.round(b.current / b.pages * 100)), left: Math.max(b.pages - b.current, 0) };
  }
  // ผลของการบันทึกอ่านต่อเล่ม: หน้าที่อ่านถึง (ใส่ "ถึงหน้า" = ตามนั้น ไม่ใส่ = บวกจำนวนหน้าที่อ่าน) + เริ่มอ่านอัตโนมัติถ้ายังเป็น "อยากอ่าน"
  function applyLog(book, log) {
    var b = cleanBook(book);
    var to = nint(log.to, 100000);
    var cur = to || b.current + nint(log.pages, 100000);
    if (b.pages && cur > b.pages) cur = b.pages;
    b.current = cur;
    if (b.status === 'want') { b.status = 'reading'; b.startedAt = b.startedAt || validDay(log.date); }
    return b;
  }
  function finish(book, date) {
    var b = cleanBook(book);
    b.status = 'done';
    b.finishedAt = validDay(date) || dayKey();
    if (!b.startedAt) b.startedAt = b.finishedAt;
    if (b.pages) b.current = b.pages;
    return b;
  }

  /* ── บันทึกการอ่าน/สถิติ ── */
  function cleanLog(l) {
    l = l || {};
    return { id: String(l.id || ''), bookId: String(l.bookId || ''), date: validDay(l.date), pages: nint(l.pages, 100000), minutes: nint(l.minutes, 1440), ts: Number(l.ts) || 0 };
  }
  // หน้า/นาทีต่อสัปดาห์ n สัปดาห์ล่าสุด (เก่า → ใหม่) · สัปดาห์เริ่มวันจันทร์
  function weekly(logs, now, n) {
    n = n || 8;
    var cur = weekStart(dayKey(now)), out = [], idx = {}, i;
    for (i = n - 1; i >= 0; i--) { idx[addDays(cur, -7 * i)] = out.length; out.push({ start: addDays(cur, -7 * i), pages: 0, minutes: 0 }); }
    (logs || []).forEach(function (raw) {
      var l = cleanLog(raw);
      if (!l.date) return;
      var w = weekStart(l.date);
      if (w in idx) { out[idx[w]].pages += l.pages; out[idx[w]].minutes += l.minutes; }
    });
    return out;
  }
  function yearGoal(settings) { var g = nint(settings && settings.yearGoal, 999); return g || DEFAULT_GOAL; }
  function yearSummary(books, settings, now) {
    var y = String(new Date(now == null ? Date.now() : now).getFullYear()), goal = yearGoal(settings);
    var done = (books || []).filter(function (b) { return b && b.status === 'done' && String(b.finishedAt || '').slice(0, 4) === y; }).length;
    return { year: +y, done: done, goal: goal, pct: Math.min(100, Math.round(done / goal * 100)) };
  }

  /* ── ไฮไลต์ → การ์ด ── */
  function cleanNote(n) {
    n = n || {};
    return { id: String(n.id || ''), bookId: String(n.bookId || ''), page: nint(n.page, 100000), text: String(n.text == null ? '' : n.text).trim().slice(0, 2000), q: str(n.q, 300), cardId: String(n.cardId || ''), ts: Number(n.ts) || 0 };
  }
  function cardId(noteId) { return 'card-' + noteId; }
  // หน้าการ์ด: ด้านหน้า = คำถามที่ผู้ใช้ตั้งไว้ ไม่มี = ชื่อหนังสือ + หน้า; ด้านหลัง = ข้อความไฮไลต์
  function cardFace(note, book) {
    var n = cleanNote(note), b = cleanBook(book);
    return { front: n.q || (b.title + (n.page ? ' · หน้า ' + n.page : '')), back: n.text };
  }
  // ใหม่ = ยังไม่มีฟิลด์ FSRS, dueAt = ตอนสร้าง (ถึงกำหนดทบทวนทันที) · สร้างซ้ำ/แก้หน้าการ์ดต้องไม่ล้างตารางทบทวน — ส่งการ์ดเดิมเข้า existing
  function makeCard(note, book, now, existing) {
    var n = cleanNote(note), f = cardFace(n, book), c = Object.assign({}, existing || {});
    c.id = cardId(n.id); c.noteId = n.id; c.bookId = n.bookId; c.front = f.front; c.back = f.back;
    if (!existing) { c.createdAt = now; c.dueAt = now; }
    return c;
  }

  /* ── Open Library ── */
  function searchUrl(q) { return 'https://openlibrary.org/search.json?q=' + encodeURIComponent(str(q, 120)) + '&limit=8&fields=' + SEARCH_FIELDS; }
  function coverUrl(coverId, size) { return coverId ? 'https://covers.openlibrary.org/b/id/' + nint(coverId, 1e12) + '-' + (size === 'L' ? 'L' : 'M') + '.jpg' : ''; }
  function parseSearch(json) {
    var docs = json && Array.isArray(json.docs) ? json.docs : [];
    return docs.map(function (d) {
      return cleanBook({
        title: d.title, author: Array.isArray(d.author_name) ? d.author_name.slice(0, 2).join(', ') : '',
        coverId: d.cover_i, olKey: d.key, pages: d.number_of_pages_median
      });
    }).filter(function (b) { return b.title; }).slice(0, 8);
  }

  function byStatus(books, status) {
    return (books || []).filter(function (b) { return b && b.status === status; });
  }

  return {
    STATUSES: STATUSES, XP: XP, DEFAULT_GOAL: DEFAULT_GOAL,
    dayKey: dayKey, parseDay: parseDay, addDays: addDays, weekStart: weekStart,
    cleanBook: cleanBook, progress: progress, applyLog: applyLog, finish: finish, byStatus: byStatus,
    cleanLog: cleanLog, weekly: weekly, yearGoal: yearGoal, yearSummary: yearSummary,
    cleanNote: cleanNote, cardId: cardId, cardFace: cardFace, makeCard: makeCard,
    searchUrl: searchUrl, coverUrl: coverUrl, parseSearch: parseSearch
  };
});
