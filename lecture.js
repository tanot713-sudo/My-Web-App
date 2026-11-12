/* lecture.js — หน้า "โน้ตจากเสียง": รายการโน้ตที่บันทึกจากหน้า text-to-speech (lecture-gen.js)
   อ่านด้วย TanotData.read, ลบด้วย TanotData.update (โน้ตลบแล้วการ์ดของโน้ตนั้นถูกลบด้วย) · การ์ดทบทวนอยู่ที่ review.html#lecture
   ข้อมูลโน้ต/ชื่อวิชาเป็นของผู้ใช้ → data-i18n-skip */
(function () {
  'use strict';
  var T = OME_I18N.scope('lecn', {
    th: { title: 'โน้ตจากเสียง', new: 'ถอดเสียงใหม่', empty: 'ยังไม่มีโน้ต',
      untitled: 'โน้ตจากเสียง', cards: '{n} การ์ด', review: 'ทบทวนการ์ด', del: 'ลบโน้ต', delWhat: 'โน้ต "{t}" และการ์ดของโน้ตนี้', deleted: 'ลบโน้ตแล้ว', points: 'ประเด็นสำคัญ' },
    en: { title: 'Lecture notes', new: 'New transcription', empty: 'No notes yet',
      untitled: 'Lecture note', cards: '{n} cards', review: 'Review cards', del: 'Delete note', delWhat: 'the note "{t}" and its cards', deleted: 'Note deleted', points: 'Key points' }
  });
  var NOTES = 'tanot:lecture:notes', CARDS = 'tanot:lecture:cards';
  var list = document.getElementById('list');

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function rows(k) { var r = TanotData.read(k, []); return Array.isArray(r) ? r : []; }

  function draw() {
    var notes = rows(NOTES).filter(function (n) { return n && n.id; }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    var cardsBy = {};
    rows(CARDS).forEach(function (c) { if (c && c.noteId) cardsBy[c.noteId] = (cardsBy[c.noteId] || 0) + 1; });
    list.textContent = '';
    if (!notes.length) {
      var em = el('div', 'empty compact'); em.appendChild(el('p', null, T('empty'))); list.appendChild(em);
      return;
    }
    notes.forEach(function (n) {
      var card = el('section', 'card lec-note'), head = el('div', 'card-head'), box = el('div'), nc = cardsBy[n.id] || 0;
      card.id = n.id; card.setAttribute('data-i18n-skip', '');
      box.appendChild(el('h2', null, n.title || T('untitled')));
      box.appendChild(el('div', 'lec-meta', [n.subject, n.createdAt ? OME_I18N.date(n.createdAt, { dateStyle: 'medium' }) : ''].filter(Boolean).join(' · ')));
      head.appendChild(box); card.appendChild(head);
      if (n.summary) card.appendChild(el('p', 'lec-sum', n.summary));
      if (Array.isArray(n.points) && n.points.length) {
        var ul = el('ul', 'lec-pts');
        n.points.forEach(function (p) { ul.appendChild(el('li', null, p)); });
        card.appendChild(ul);
      }
      var acts = el('div', 'lec-acts');
      if (nc) { var r = el('a', 'btn sm', T('review') + ' · ' + T('cards', { n: OME_I18N.number(nc) })); r.href = 'review.html#lecture'; acts.appendChild(r); }
      var d = el('button', 'btn sm ghost', T('del')); d.type = 'button';
      d.addEventListener('click', function () {
        window.tanotConfirmDelete(T('delWhat', { t: n.title || T('untitled') })).then(function (ok) {
          if (!ok) return;
          TanotData.update(NOTES, function (r) { return (Array.isArray(r) ? r : []).filter(function (x) { return !x || x.id !== n.id; }); });
          TanotData.update(CARDS, function (r) { return (Array.isArray(r) ? r : []).filter(function (x) { return !x || x.noteId !== n.id; }); });
          draw(); window.tanotToast(T('deleted'), 'ok');
        });
      });
      acts.appendChild(d); card.appendChild(acts);
      list.appendChild(card);
    });
    var id = decodeURIComponent(location.hash.slice(1)), t = id && document.getElementById(id);
    if (t) t.scrollIntoView({ block: 'start' });
  }

  OME_LANG.onChange(draw);
  window.OME_PAGE_LIVE_LANG = true;
  TanotData.onChange(function (keys) { if (!keys.length || keys.some(function (k) { return k === NOTES || k === CARDS; })) draw(); });
  document.title = T('title') + ' | Tanot';
  draw();
})();
