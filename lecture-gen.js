/* lecture-gen.js — ปุ่ม "ทำเป็นโน้ตเรียน" ใต้ผลถอดเสียงของ text-to-speech.html
   ข้อความถอดเสียง → /api/ai/summarize (ฟรี, Workers AI เท่านั้น) → ร่างโน้ต + การ์ดให้ตรวจ/ติ๊กเลือก → บันทึกเมื่อกดเอง
   ตรรกะทั้งหมดอยู่ใน lecture-calc.js · เขียนด้วย TanotData.update (ไม่เด้งแถบรีโหลด) · ไม่เก็บข้อความถอดเสียง
   แสดงเฉพาะที่มีคลาวด์ (AiClient.available()) — ไม่มีโมเดลสำรองในเบราว์เซอร์ */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var LC = window.LectureCalc;
  if (!LC || !$('lecBtn')) return;

  var T = OME_I18N.scope('lec', {
    th: {
      make: 'ทำเป็นโน้ตเรียน', noText: 'ยังไม่มีข้อความที่ถอดเสียงไว้', working: 'กำลังทำโน้ต…', part: 'สรุปส่วนที่ {i}/{n}…', merge: 'รวมเป็นโน้ตเดียว…',
      bad: 'AI ตอบในรูปแบบที่อ่านไม่ได้ ลองกดอีกครั้ง', fail: 'ทำโน้ตไม่สำเร็จ: {msg}', ready: 'ตรวจโน้ตและติ๊กการ์ดที่ต้องการ แล้วกดบันทึก',
      title: 'ชื่อบทเรียน', subject: 'วิชา', summary: 'สรุป', points: 'ประเด็นสำคัญ (บรรทัดละข้อ)', cards: 'การ์ดทบทวน',
      save: 'บันทึกโน้ต', saved: 'บันทึกโน้ตแล้ว · การ์ด {n} ใบ', open: 'เปิดโน้ต', noCards: 'AI ไม่ได้สร้างการ์ดจากข้อความนี้'
    },
    en: {
      make: 'Turn into study notes', noText: 'There is no transcribed text yet', working: 'Making notes…', part: 'Summarizing part {i}/{n}…', merge: 'Combining into one note…',
      bad: 'The AI answered in a format I could not read. Try again', fail: 'Could not make notes: {msg}', ready: 'Check the notes and tick the cards you want, then save',
      title: 'Lesson title', subject: 'Subject', summary: 'Summary', points: 'Key points (one per line)', cards: 'Review cards',
      save: 'Save notes', saved: 'Notes saved · {n} cards', open: 'Open notes', noCards: 'The AI made no cards from this text'
    }
  });

  var DIRECT_MAX = 40000, PART_MAX = 12000;
  var busy = false, draft = null; // draft = { id, cards:[{q,a}] }

  function status(fn, cls) { var el = $('lecStatus'); OME_I18N.live(el, fn); el.className = 'status' + (cls ? ' ' + cls : ''); }
  function transcript() { return ($('asrResult').value || '').replace(/^\[\d{2}:\d{2}:\d{2}\] /gm, '').trim(); }
  function call(o) { return AiClient.summarize(o).then(function (r) { return r.text; }); }

  function generate(text, subject) {
    if (text.length <= DIRECT_MAX) return call({ task: 'lecture', maxTokens: 1800, messages: LC.messages(text, subject) });
    var parts = LC.chunk(text, PART_MAX), notes = [];
    function next(i) {
      if (i >= parts.length) return Promise.resolve();
      status(function () { return T('part', { i: i + 1, n: parts.length }); });
      return call({ task: 'lecture-part', model: 'fast', maxTokens: 600, messages: [{ role: 'system', content: LC.PART_SYSTEM }, { role: 'user', content: parts[i] }] })
        .then(function (t) { notes.push(t); return next(i + 1); });
    }
    return next(0).then(function () {
      status(function () { return T('merge'); });
      return call({ task: 'lecture', maxTokens: 1800, messages: LC.messages(notes.join('\n\n'), subject) });
    });
  }

  function renderCards() {
    var ul = $('lecCards'); ul.textContent = '';
    if (!draft.cards.length) { var li = document.createElement('div'); li.className = 'list-row'; li.textContent = T('noCards'); ul.appendChild(li); return; }
    draft.cards.forEach(function (c, i) {
      var li = document.createElement('div'), lab = document.createElement('label'), cb = document.createElement('input'), box = document.createElement('span'), q = document.createElement('b'), a = document.createElement('span');
      li.className = 'list-row'; lab.className = 'check'; cb.type = 'checkbox'; cb.checked = true; cb.dataset.i = String(i);
      q.textContent = c.q; a.textContent = c.a; a.className = 'meta'; box.className = 'lec-card'; box.setAttribute('data-i18n-skip', ''); box.appendChild(q); box.appendChild(document.createElement('br')); box.appendChild(a);
      lab.appendChild(cb); lab.appendChild(box); li.appendChild(lab); ul.appendChild(li);
    });
  }

  function onMake() {
    if (busy) return;
    var text = transcript();
    if (!text) { status(function () { return T('noText'); }, 'err'); return; }
    busy = true; $('lecBtn').disabled = true; $('lecWrap').hidden = true; $('lecOpen').hidden = true;
    status(function () { return T('working'); });
    generate(text, $('lecSubject').value).then(function (reply) {
      var p = LC.parse(reply);
      if (!p) { status(function () { return T('bad'); }, 'err'); return; }
      draft = { id: LC.newId(Date.now()), cards: p.cards };
      $('lecTitle').value = p.title; if (!$('lecSubject').value) $('lecSubject').value = p.subject;
      $('lecSummary').value = p.summary; $('lecPoints').value = p.points.join('\n');
      renderCards(); $('lecWrap').hidden = false;
      status(function () { return T('ready'); }, 'ok');
    }).catch(function (e) {
      status(function () { return T('fail', { msg: window.AiClient ? AiClient.friendlyMessage(e) : String(e && e.message || e) }); }, 'err');
    }).then(function () { busy = false; $('lecBtn').disabled = false; });
  }

  function onSave() {
    if (!draft) return;
    var now = Date.now();
    var note = LC.noteFrom({ title: $('lecTitle').value, subject: $('lecSubject').value, summary: $('lecSummary').value, points: $('lecPoints').value.split('\n') }, { id: draft.id, now: now, subject: $('lecSubject').value });
    var picked = [].slice.call($('lecCards').querySelectorAll('input:checked')).map(function (cb) { return draft.cards[+cb.dataset.i]; });
    TanotData.update('tanot:lecture:notes', function (rows) {
      rows = Array.isArray(rows) ? rows : [];
      var i = rows.findIndex(function (r) { return r && r.id === note.id; });
      if (i >= 0) rows[i] = Object.assign({}, rows[i], note, { createdAt: rows[i].createdAt || now }); else rows.push(note);
      return rows;
    });
    if (picked.length) TanotData.update('tanot:lecture:cards', function (rows) {
      rows = Array.isArray(rows) ? rows : [];
      picked.forEach(function (c) {
        var id = LC.cardId(note.id, c.q), i = rows.findIndex(function (r) { return r && r.id === id; });
        if (i >= 0) rows[i] = LC.makeCard(note, c, now, rows[i]); else rows.push(LC.makeCard(note, c, now));
      });
      return rows;
    });
    $('lecOpen').href = 'lecture.html#' + note.id; $('lecOpen').hidden = false;
    status(function () { return T('saved', { n: OME_I18N.number(picked.length) }); }, 'ok');
  }

  $('lecBtn').hidden = $('lecSubjField').hidden = !(window.AiClient && AiClient.available());
  $('lecBtn').addEventListener('click', onMake);
  $('lecSave').addEventListener('click', onSave);
})();
