/* ══════════════════════════════════════════════════════════════════
   เตรียมสอบเนติบัณฑิต / ตั๋วทนาย / อัยการ / ผู้พิพากษา
   โน้ต+flashcard (spaced repetition แบบขั้นบันได) / ฝึกเขียนตอบจับเวลา /
   นับถอยหลังสนามสอบ (วันที่ผู้ใช้กรอกเอง — ไม่มี API ราชการ) /
   ถ่ายรูป→OCR (Tesseract.js)→ตรวจทาน→บันทึกโน้ต / ซิงก์ Google Drive ส่วนตัว
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var DAY_MS = 86400000;

  /* ══════════════════ กล่องยืนยัน/แจ้งเตือนของเว็บเอง (แทน confirm()/alert() ของเบราว์เซอร์) ══════════════════ */
  function showModal(opts) {
    return new Promise(function (resolve) {
      var backdrop = $('bpModalBackdrop');
      $('bpModalTitle').textContent = opts.title || '';
      $('bpModalMsg').textContent = opts.message || '';
      var btnsEl = $('bpModalBtns');
      btnsEl.innerHTML = '';
      var done = false;
      function close(val) {
        if (done) return;
        done = true;
        backdrop.classList.remove('open');
        backdrop.onclick = null;
        resolve(val);
      }
      (opts.buttons || []).forEach(function (b) {
        var btn = document.createElement('button');
        btn.className = 'btn sm' + (b.primary ? ' primary' : '');
        btn.type = 'button';
        btn.textContent = b.label;
        btn.addEventListener('click', function () { close(b.value); });
        btnsEl.appendChild(btn);
      });
      backdrop.onclick = function (e) { if (e.target === backdrop) close(opts.cancelValue !== undefined ? opts.cancelValue : null); };
      backdrop.classList.add('open');
    });
  }
  function bpConfirm(message, title) {
    return showModal({
      title: title || 'ยืนยัน',
      message: message,
      cancelValue: false,
      buttons: [
        { label: 'ยกเลิก', value: false },
        { label: 'ตกลง', value: true, primary: true }
      ]
    }).then(function (v) { return v === true; });
  }

  /* ══════════════════ สนามสอบ & นับถอยหลัง ══════════════════ */
  var EXAM_TYPES = [
    { key: 'neti1', name: 'เนติบัณฑิต ภาค 1', icon: '⚖️', url: 'https://www.thethaibar.or.th/thaibarweb/',
      prep: ['บัตรประจำตัวสอบ', 'บัตรประชาชน', 'ปากกา/ดินสอตามที่ระเบียบกำหนด'],
      banned: ['ตำรา/เอกสารกฎหมายทุกชนิด', 'อุปกรณ์สื่อสาร/นาฬิกาอัจฉริยะ', 'เครื่องคำนวณ (เว้นข้อสอบระบุอนุญาต)'] },
    { key: 'neti2', name: 'เนติบัณฑิต ภาค 2', icon: '⚖️', url: 'https://www.thethaibar.or.th/thaibarweb/',
      prep: ['บัตรประจำตัวสอบ', 'บัตรประชาชน', 'ปากกา/ดินสอตามที่ระเบียบกำหนด'],
      banned: ['ตำรา/เอกสารกฎหมายทุกชนิด', 'อุปกรณ์สื่อสาร/นาฬิกาอัจฉริยะ', 'เครื่องคำนวณ (เว้นข้อสอบระบุอนุญาต)'] },
    { key: 'judge', name: 'ผู้ช่วยผู้พิพากษา (ก.ต.)', icon: '👨‍⚖️', url: 'https://ojc.coj.go.th/',
      prep: ['บัตรประจำตัวสอบ', 'บัตรประชาชน', 'เอกสารรับรองคุณสมบัติตามประกาศรับสมัคร'],
      banned: ['ตำรา/เอกสารกฎหมายทุกชนิด', 'อุปกรณ์สื่อสาร/นาฬิกาอัจฉริยะ'] },
    { key: 'prosecutor', name: 'อัยการผู้ช่วย (ก.อ.)', icon: '🏛️', url: 'https://www3.ago.go.th/',
      prep: ['บัตรประจำตัวสอบ', 'บัตรประชาชน', 'เอกสารรับรองคุณสมบัติตามประกาศรับสมัคร'],
      banned: ['ตำรา/เอกสารกฎหมายทุกชนิด', 'อุปกรณ์สื่อสาร/นาฬิกาอัจฉริยะ'] },
    { key: 'lawyer', name: 'ตั๋วทนายความ (สภาทนายความ)', icon: '💼', url: 'https://lawyerscouncil.or.th/',
      prep: ['บัตรประจำตัวสอบ', 'บัตรประชาชน', 'ใบสมัครอบรม/หลักฐานฝึกงานตามเส้นทางที่เลือก (ตั๋วรุ่น/ตั๋วปี)'],
      banned: ['ตำรา/เอกสารกฎหมายทุกชนิด', 'อุปกรณ์สื่อสาร/นาฬิกาอัจฉริยะ'] }
  ];
  var EXAM_KEY = 'tanot:barprep:examdates';
  function loadExamDates() {
    var d = {};
    try { d = JSON.parse(localStorage.getItem(EXAM_KEY)) || {}; } catch (e) {}
    return d;
  }
  function saveExamDates(d) {
    try { localStorage.setItem(EXAM_KEY, JSON.stringify(d)); } catch (e) {}
    DriveSync.scheduleSync();
  }
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((d - today) / DAY_MS);
  }
  function renderExams() {
    var dates = loadExamDates();
    var wrap = $('bpExamList');
    wrap.innerHTML = EXAM_TYPES.map(function (ex) {
      var d = dates[ex.key] || {};
      var days = daysUntil(d.examDate);
      var cdCls = 'exam-cd unset', cdTxt = 'ยังไม่กรอกวันสอบ';
      if (days !== null) {
        if (days > 0) { cdTxt = 'อีก ' + days + ' วัน'; cdCls = 'exam-cd'; }
        else if (days === 0) { cdTxt = 'วันนี้!'; cdCls = 'exam-cd'; }
        else { cdTxt = 'ผ่านไปแล้ว ' + (-days) + ' วัน'; cdCls = 'exam-cd past'; }
      }
      var prepLi = ex.prep.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('');
      var banLi = ex.banned.map(function (p) { return '<li class="ban">' + esc(p) + '</li>'; }).join('');
      return '<div class="exam-card" data-key="' + ex.key + '">' +
        '<div class="exam-hd"><span class="name">' + ex.icon + ' ' + esc(ex.name) + '</span>' +
        '<span class="' + cdCls + '">' + cdTxt + '</span></div>' +
        '<div class="exam-dates">' +
          '<span>เปิดรับสมัคร: <b>' + (d.applyStart ? esc(d.applyStart) : '—') + '</b> ถึง <b>' + (d.applyEnd ? esc(d.applyEnd) : '—') + '</b></span>' +
          '<span>วันสอบ: <b>' + (d.examDate ? esc(d.examDate) : '—') + '</b></span>' +
        '</div>' +
        '<div class="exam-edit">' +
          '<div class="field"><label>เปิดรับสมัคร</label><input type="date" data-f="applyStart" value="' + (d.applyStart || '') + '"></div>' +
          '<div class="field"><label>ปิดรับสมัคร</label><input type="date" data-f="applyEnd" value="' + (d.applyEnd || '') + '"></div>' +
          '<div class="field"><label>วันสอบ</label><input type="date" data-f="examDate" value="' + (d.examDate || '') + '"></div>' +
        '</div>' +
        '<details class="exam-prep"><summary>สิ่งที่ต้องเตรียม / ของต้องห้ามในห้องสอบ (แนวทางทั่วไป — เช็กประกาศจริงเสมอ)</summary>' +
          '<ul>' + prepLi + banLi + '</ul></details>' +
        '<div style="margin-top:8px"><a class="exam-link" href="' + ex.url + '" target="_blank" rel="noopener">↗ ดูประกาศทางการล่าสุด</a></div>' +
      '</div>';
    }).join('');
    Array.prototype.forEach.call(wrap.querySelectorAll('.exam-card'), function (card) {
      var key = card.dataset.key;
      Array.prototype.forEach.call(card.querySelectorAll('input[data-f]'), function (inp) {
        inp.addEventListener('change', function () {
          var dates = loadExamDates();
          dates[key] = dates[key] || {};
          dates[key][inp.dataset.f] = inp.value;
          saveExamDates(dates);
          renderExams();
        });
      });
    });
  }

  /* ══════════════════ เช็กเส้นทาง 3 สายอาชีพ ══════════════════ */
  var CAREER_KEY = 'tanot:barprep:career';
  function evalCareer(o) {
    var out = {};
    var netiOk = o.neti === 'yes';

    // ผู้พิพากษา
    var judge = { met: [], missing: [] };
    if (netiOk) judge.met.push('เนติบัณฑิตแล้ว (คุณสมบัติพื้นฐานสนามใหญ่)'); else judge.missing.push('ยังไม่จบเนติบัณฑิต (จำเป็นสำหรับสนามใหญ่)');
    if (o.exp >= 2) judge.met.push('มีประสบการณ์ทำงานกฎหมาย ' + o.exp + ' ปี (เข้าเกณฑ์ขั้นต่ำทั่วไปของสนามใหญ่)');
    else judge.missing.push('ประสบการณ์ทำงานกฎหมายยังน้อย (สนามใหญ่มักกำหนดขั้นต่ำ ~2 ปีขึ้นไป แล้วแต่ประเภทงาน)');
    if (o.master === 'th') judge.met.push('มีวุฒิปริญญาโท/เอกกฎหมายในประเทศ (อาจเข้าเกณฑ์สนามเล็กบางสถาบัน)');
    if (o.master === 'intl') judge.met.push('มีวุฒิปริญญาโทกฎหมายต่างประเทศ (อาจเข้าเกณฑ์ "สนามจิ๋ว")');
    judge.verdict = (netiOk && o.exp >= 2) ? 'go' : (netiOk || o.master !== 'no') ? 'warn' : 'no';

    // อัยการ
    var prosecutor = { met: [], missing: [] };
    if (netiOk) prosecutor.met.push('เนติบัณฑิตแล้ว (คุณสมบัติพื้นฐานสนามใหญ่)'); else prosecutor.missing.push('ยังไม่จบเนติบัณฑิต');
    if (o.exp >= 2) prosecutor.met.push('มีประสบการณ์ทำงานกฎหมาย ' + o.exp + ' ปี');
    else prosecutor.missing.push('ประสบการณ์ทำงานกฎหมายยังน้อย (สนามใหญ่มักกำหนดขั้นต่ำ ~2 ปีขึ้นไป)');
    if (o.master !== 'no') prosecutor.met.push('มีวุฒิปริญญาโท/เอกกฎหมาย (อาจเข้าเกณฑ์สนามเล็กบางสถาบัน)');
    prosecutor.verdict = (netiOk && o.exp >= 2) ? 'go' : (netiOk || o.master !== 'no') ? 'warn' : 'no';

    // ทนายความ
    var lawyer = { met: [], missing: [] };
    if (o.lawyer === 'yes') { lawyer.met.push('มีตั๋วทนายความแล้ว — สมัครงาน Law Firm ได้เลย'); }
    else {
      if (netiOk) lawyer.met.push('เนติบัณฑิตแล้ว — สมัครอบรมวิชาว่าความ (ตั๋วรุ่น) กับสภาทนายความได้');
      else lawyer.missing.push('ยังไม่จบเนติบัณฑิต (เส้นทาง "ตั๋วรุ่น" ต้องใช้วุฒิเนติบัณฑิตหรือเทียบเท่าสมัครอบรม)');
      lawyer.missing.push('ยังไม่มีตั๋วทนายความ — ต้องอบรมภาคทฤษฎี 6 เดือน + ภาคปฏิบัติ 6 เดือน (ตั๋วรุ่น) หรือฝึกงานสำนักงานทนาย 1 ปีเต็มก่อนสอบ (ตั๋วปี)');
    }
    lawyer.verdict = o.lawyer === 'yes' ? 'go' : netiOk ? 'warn' : 'no';

    out.judge = judge; out.prosecutor = prosecutor; out.lawyer = lawyer;
    return out;
  }
  function careerBoxHtml(title, icon, r) {
    var bg = r.verdict === 'go' ? '#E9F9F0' : r.verdict === 'warn' ? '#FFF6E4' : '#FDECEC';
    var fg = r.verdict === 'go' ? '#0B7F52' : r.verdict === 'warn' ? '#8A6212' : '#B23838';
    var items = r.met.map(function (m) { return '<li>✅ ' + esc(m) + '</li>'; })
      .concat(r.missing.map(function (m) { return '<li>◻️ ' + esc(m) + '</li>'; })).join('');
    return '<div class="career-box" style="background:' + bg + ';color:' + fg + '">' +
      '<div class="ttl">' + icon + ' ' + title + '</div><ul>' + items + '</ul></div>';
  }
  function doCareerEval() {
    var o = {
      neti: $('bpNeti').value,
      exp: parseFloat($('bpExp').value) || 0,
      master: $('bpMaster').value,
      lawyer: $('bpLawyer').value
    };
    try { localStorage.setItem(CAREER_KEY, JSON.stringify(o)); } catch (e) {}
    DriveSync.scheduleSync();
    var r = evalCareer(o);
    $('bpCareerResult').innerHTML =
      careerBoxHtml('ผู้พิพากษา', '👨‍⚖️', r.judge) +
      careerBoxHtml('อัยการ', '🏛️', r.prosecutor) +
      careerBoxHtml('ทนายความ (Law Firm)', '💼', r.lawyer);
  }
  function loadCareerIntoForm() {
    var o = {};
    try { o = JSON.parse(localStorage.getItem(CAREER_KEY)) || {}; } catch (e) {}
    if (o.neti) $('bpNeti').value = o.neti;
    if (o.exp != null) $('bpExp').value = o.exp;
    if (o.master) $('bpMaster').value = o.master;
    if (o.lawyer) $('bpLawyer').value = o.lawyer;
  }

  /* ══════════════════ สมุดโน้ต + Flashcard (spaced repetition ขั้นบันได) ══════════════════ */
  var NOTES_KEY = 'tanot:barprep:notes';
  var SRS_STEPS = [1, 3, 7, 14, 30]; // วัน
  function loadNotes() {
    var a = [];
    try { a = JSON.parse(localStorage.getItem(NOTES_KEY)) || []; } catch (e) {}
    return a;
  }
  function saveNotes(a) {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(a)); } catch (e) {}
    DriveSync.scheduleSync();
  }
  function addNote(subj, q, a) {
    if (!q || !q.trim()) return;
    var notes = loadNotes();
    notes.unshift({ id: 'n' + Date.now() + Math.floor(Math.random() * 1000), subj: subj || '', q: q, a: a || '',
      createdAt: Date.now(), srsIdx: -1, dueAt: Date.now() });
    saveNotes(notes);
    renderNoteList();
    renderReviewCount();
  }
  function deleteNote(id) {
    saveNotes(loadNotes().filter(function (n) { return n.id !== id; }));
    renderNoteList();
    renderReviewCount();
  }
  function renderNoteList() {
    var notes = loadNotes();
    var el = $('bpNoteList');
    if (!notes.length) { el.innerHTML = '<p class="note-empty">ยังไม่มีโน้ต — เพิ่มด้านบนได้เลย</p>'; return; }
    /* จัดกลุ่มตามวิชา/หมวด เพื่อให้มีปุ่ม "ลบทั้งหมด" ต่อกลุ่ม — สำคัญมากเมื่อเพิ่งใช้
       "แบ่งเป็นรายมาตรา" แล้วได้โน้ตทีเดียวหลายสิบรายการในวิชาเดียวกัน */
    var groups = [], byKey = {};
    notes.forEach(function (n) {
      var key = n.subj || '';
      if (!byKey[key]) { byKey[key] = { subj: key, items: [] }; groups.push(byKey[key]); }
      byKey[key].items.push(n);
    });
    el.innerHTML = groups.map(function (g) {
      return '<li class="note-group-hd">' +
        '<span class="tag">' + (g.subj ? esc(g.subj) : 'ไม่ระบุวิชา') + '</span>' +
        '<span class="mini">' + g.items.length + ' โน้ต</span>' +
        '<button class="note-del-all" data-delsubj="' + esc(g.subj) + '">🗑 ลบทั้งหมดในวิชานี้</button>' +
      '</li>' +
      g.items.map(function (n) {
        return '<li class="note-item" data-id="' + n.id + '">' +
          '<div class="hd"><span></span>' +
          '<button class="note-del" data-del="' + n.id + '" aria-label="ลบโน้ต">🗑</button></div>' +
          '<div class="txt"><b>' + esc(n.q) + '</b>' + (n.a ? '<br>' + esc(n.a) : '') + '</div>' +
          '<div class="meta">ทบทวนรอบถัดไป: ' + new Date(n.dueAt).toLocaleDateString('th-TH') + '</div>' +
        '</li>';
      }).join('');
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('[data-del]'), function (b) {
      b.addEventListener('click', function () { deleteNote(b.dataset.del); });
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-delsubj]'), function (b) {
      b.addEventListener('click', function () { deleteNotesBySubject(b.dataset.delsubj); });
    });
  }
  function deleteNotesBySubject(subj) {
    var notes = loadNotes();
    var match = notes.filter(function (n) { return (n.subj || '') === subj; });
    if (!match.length) return;
    var label = subj || 'ไม่ระบุวิชา';
    bpConfirm('ลบโน้ตทั้งหมด ' + match.length + ' รายการในวิชา "' + label + '" ใช่หรือไม่? กู้คืนไม่ได้', 'ลบทั้งวิชา').then(function (ok) {
      if (!ok) return;
      saveNotes(loadNotes().filter(function (n) { return (n.subj || '') !== subj; }));
      renderNoteList();
      renderReviewCount();
    });
  }
  function dueNotes() {
    var now = Date.now();
    return loadNotes().filter(function (n) { return n.dueAt <= now; });
  }
  function renderReviewCount() {
    var n = dueNotes().length;
    $('bpReviewCount').textContent = n ? ' — วันนี้มี ' + n + ' การ์ดที่ถึงกำหนดทบทวน' : ' — วันนี้ไม่มีการ์ดค้างทบทวน 🎉';
  }
  var reviewQueue = [], reviewIdx = 0;
  function startReview() {
    reviewQueue = dueNotes();
    reviewIdx = 0;
    if (!reviewQueue.length) { $('bpReviewArea').innerHTML = '<p class="note-empty">ไม่มีการ์ดที่ถึงกำหนดทบทวนวันนี้ 🎉</p>'; return; }
    renderReviewCard();
  }
  function renderReviewCard() {
    var area = $('bpReviewArea');
    if (reviewIdx >= reviewQueue.length) {
      area.innerHTML = '<p class="note-empty">ทบทวนครบทุกการ์ดของวันนี้แล้ว 🎉</p>';
      renderReviewCount(); renderNoteList();
      return;
    }
    var n = reviewQueue[reviewIdx];
    area.innerHTML =
      '<div class="flash-card" id="bpFlashCard"><div class="q">' + esc(n.q) + '</div>' +
      '<div class="a">' + esc(n.a || '(ไม่มีเนื้อหาเพิ่มเติม)') + '</div>' +
      '<div class="hint">แตะการ์ดเพื่อดูคำตอบ</div></div>' +
      '<div class="flash-btns">' +
        '<button class="btn sm" id="bpFlashNo" type="button">😵 จำไม่ได้</button>' +
        '<button class="btn primary sm" id="bpFlashYes" type="button">✅ จำได้</button>' +
      '</div>' +
      '<div class="flash-progress">การ์ดที่ ' + (reviewIdx + 1) + ' / ' + reviewQueue.length + '</div>';
    $('bpFlashCard').addEventListener('click', function () { this.classList.toggle('show'); });
    $('bpFlashNo').addEventListener('click', function () { answerCard(n, false); });
    $('bpFlashYes').addEventListener('click', function () { answerCard(n, true); });
  }
  function answerCard(n, correct) {
    var notes = loadNotes();
    var rec = null;
    for (var i = 0; i < notes.length; i++) { if (notes[i].id === n.id) { rec = notes[i]; break; } }
    if (rec) {
      rec.srsIdx = correct ? Math.min(rec.srsIdx + 1, SRS_STEPS.length - 1) : -1;
      var days = SRS_STEPS[Math.max(rec.srsIdx, 0)];
      rec.dueAt = Date.now() + days * DAY_MS;
      saveNotes(notes);
    }
    reviewIdx++;
    renderReviewCard();
  }

  /* ══════════════════ ฝึกเขียนตอบจับเวลา ══════════════════ */
  var WRITING_KEY = 'tanot:barprep:writing';
  function loadWriting() {
    var a = [];
    try { a = JSON.parse(localStorage.getItem(WRITING_KEY)) || []; } catch (e) {}
    return a;
  }
  function saveWriting(a) {
    try { localStorage.setItem(WRITING_KEY, JSON.stringify(a)); } catch (e) {}
    DriveSync.scheduleSync();
  }
  var wrTimer = null, wrTotalSec = 0, wrRemainSec = 0, wrStartTs = 0;
  function fmtClock(sec) {
    var neg = sec < 0; sec = Math.abs(sec);
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return (neg ? '+' : '') + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function startWriting() {
    var mins = parseFloat($('bpWrMin').value) || 15;
    wrTotalSec = mins * 60; wrRemainSec = wrTotalSec; wrStartTs = Date.now();
    $('bpWrTimerBox').style.display = '';
    $('bpWrAnswer').value = '';
    $('bpWrChecklist').innerHTML =
      '<li><label><input type="checkbox" id="bpChkMatra"> อ้างมาตราที่เกี่ยวข้องแม่นยำ</label></li>' +
      '<li><label><input type="checkbox" id="bpChkDika"> อ้างฎีกาที่เกี่ยวข้อง (ถ้าจำเป็น)</label></li>' +
      '<li><label><input type="checkbox" id="bpChkComplete"> ตอบครบทุกประเด็นที่โจทย์ถาม</label></li>';
    $('bpWrStart').disabled = true; $('bpWrStop').disabled = false;
    tickWriting();
    wrTimer = setInterval(tickWriting, 1000);
  }
  function tickWriting() {
    wrRemainSec = wrTotalSec - Math.round((Date.now() - wrStartTs) / 1000);
    var el = $('bpWrTimerNum');
    el.textContent = fmtClock(wrRemainSec);
    el.className = 'timer-num' + (wrRemainSec < 0 ? ' over' : wrRemainSec < wrTotalSec * 0.2 ? ' warn' : '');
  }
  function stopWriting() {
    if (wrTimer) clearInterval(wrTimer);
    wrTimer = null;
    $('bpWrStart').disabled = false; $('bpWrStop').disabled = true;
  }
  function saveWritingResult() {
    var elapsedSec = Math.max(0, Math.round((Date.now() - wrStartTs) / 1000));
    var checklist = {
      matra: !!($('bpChkMatra') && $('bpChkMatra').checked),
      dika: !!($('bpChkDika') && $('bpChkDika').checked),
      complete: !!($('bpChkComplete') && $('bpChkComplete').checked)
    };
    var rec = {
      id: 'w' + Date.now(), subj: $('bpWrSubj').value || '(ไม่ระบุวิชา)', prompt: $('bpWrPrompt').value,
      answer: $('bpWrAnswer').value, minutes: parseFloat($('bpWrMin').value) || 15,
      elapsedSec: elapsedSec, checklist: checklist, ts: Date.now()
    };
    var all = loadWriting(); all.unshift(rec); saveWriting(all);
    stopWriting();
    $('bpWrTimerBox').style.display = 'none';
    renderWritingHistory();
  }
  function deleteWriting(id) {
    saveWriting(loadWriting().filter(function (w) { return w.id !== id; }));
    renderWritingHistory();
  }
  function renderWritingHistory() {
    var all = loadWriting();
    var table = $('bpWrTable'), empty = $('bpWrEmpty'), tbody = $('bpWrTbody');
    if (!all.length) { table.style.display = 'none'; empty.style.display = ''; return; }
    table.style.display = ''; empty.style.display = 'none';
    tbody.innerHTML = all.map(function (w) {
      var passed = [w.checklist.matra, w.checklist.dika, w.checklist.complete].filter(Boolean).length;
      return '<tr><td>' + new Date(w.ts).toLocaleDateString('th-TH') + '</td>' +
        '<td>' + esc(w.subj) + '</td>' +
        '<td>' + fmtClock(w.elapsedSec).replace('+', '') + ' / ' + w.minutes + ' นาที</td>' +
        '<td>' + passed + '/3</td>' +
        '<td><button class="note-del" data-wdel="' + w.id + '">🗑</button></td></tr>';
    }).join('');
    Array.prototype.forEach.call(tbody.querySelectorAll('[data-wdel]'), function (b) {
      b.addEventListener('click', function () { deleteWriting(b.dataset.wdel); });
    });
  }

  /* ══════════════════ นำเข้าข้อความ (ถ่ายรูป OCR หรือไฟล์จาก Drive) → ตรวจทาน → บันทึกโน้ต ══════════════════
     ใช้ชุด element เดียวกัน (#bpOcrText/#bpOcrSubj/#bpOcrSave) ไม่ว่าข้อความจะมาจากไหน
     เพื่อให้ผู้ใช้ตรวจทานก่อนบันทึกเป็นโน้ตเสมอ (สำคัญมากกับเลขมาตรา/เลขฎีกา) */
  /* ตัดข้อความหัวกระดาษ/ลายน้ำ/บล็อกลงนามที่ไม่ใช่เนื้อหากฎหมายจริงออกก่อนให้ตรวจทาน —
     "สำนักงานคณะกรรมการกฤษฎีกา" แทรกซ้ำแทบทุกบรรทัดในเอกสารจาก krisdika.go.th (ทั้งสะกด
     แบบสระอำผสมและสระอำ+นิคหิตแยกตัว) และท้ายแต่ละฉบับมักมี "ผู้รับสนองพระบรมราชโองการ
     <ชื่อนายกฯ> นายกรัฐมนตรี" ซึ่งชื่อเปลี่ยนไปตามแต่ละฉบับ ไม่ใช่เนื้อหามาตราที่ต้องท่องจำ */
  function stripBoilerplate(text) {
    if (!text) return text;
    var out = text;
    out = out.replace(/ส(?:ำ|ํา)นักงานคณะกรรมการกฤษฎีกา/g, ' ');
    out = out.replace(/ผู้รับสนองพระบรมราชโองการ[\s\S]{0,60}?นายกรัฐมนตรี/g, ' ');
    out = out.replace(/[ \t]+/g, ' ');
    out = out.replace(/\n[ \t]*\n[ \t]*\n+/g, '\n\n');
    out = out.replace(/^[ \t]+|[ \t]+$/gm, '');
    return out.trim();
  }
  function showTextForReview(text, subjHint, statusMsg) {
    text = stripBoilerplate(text);
    $('bpOcrStatus').className = 'status ok';
    $('bpOcrStatus').textContent = statusMsg || '✅ แปลงข้อความเสร็จแล้ว — ตรวจทานให้ดีก่อนบันทึก (โดยเฉพาะเลขมาตรา/เลขฎีกา)';
    if (subjHint && !$('bpOcrSubj').value) $('bpOcrSubj').value = subjHint;
    $('bpOcrText').value = text || '';
    $('bpOcrText').style.display = '';
    $('bpOcrEditWrap').style.display = '';
    $('bpOcrSave').style.display = '';
    $('bpMatraSplitBtn').style.display = '';
    $('bpMatraSplitWrap').style.display = 'none';
    $('bpOcrText').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ══════════════════ แบ่งข้อความยาว (เช่น ทั้งประมวลกฎหมาย) ออกเป็นรายมาตรา ══════════════════
     หา "มาตรา <เลข>" ทุกจุดในข้อความ แล้วตัดเป็นช่วงๆ ระหว่างจุดที่พบ — ใช้ได้ดีกับข้อความ
     ที่แยกมาจากตัวบทกฎหมายจริง แต่ถ้าเนื้อหาในมาตราหนึ่งอ้างอิงถึงเลขมาตราอื่น (เช่น
     "ตามมาตรา 420") จุดอ้างอิงนั้นจะถูกนับเป็นจุดแบ่งไปด้วย — ต้องให้ผู้ใช้เลือก/ตรวจทาน
     ก่อนบันทึกเสมอ ไม่บันทึกอัตโนมัติ */
  function splitByMatra(text) {
    var numPart = '([๐-๙0-9]+(?:\\s*\\/\\s*[๐-๙0-9]+)?(?:\\s*(?:ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|นว|ทศ))?)';
    function toSections(hits) {
      var out = [];
      for (var i = 0; i < hits.length; i++) {
        var start = hits[i].idx;
        var end = i + 1 < hits.length ? hits[i + 1].idx : text.length;
        var chunk = text.slice(start, end).trim();
        if (chunk) out.push({ num: hits[i].num, text: chunk });
      }
      return out;
    }
    /* โหมดเข้มงวด: นับเฉพาะ "มาตรา" ที่ขึ้นต้นบรรทัดใหม่ (หรือต้นข้อความ) — เอกสารกฎหมายจริง
       ขึ้นบรรทัด/ย่อหน้าใหม่ทุกมาตราเสมอ ส่วนการอ้างอิงมาตราอื่นกลางเนื้อหา (เช่น รายการ
       "(๑) มาตรา ๙ ... ให้แก้เป็น ...") จะไม่ได้อยู่ต้นบรรทัด จึงกรองออกไปเองโดยไม่ต้องเดา */
    var lineStartRe = new RegExp('(^|\\n)[ \\t]*มาตรา\\s*' + numPart, 'g');
    var strictHits = [], m;
    while ((m = lineStartRe.exec(text))) {
      strictHits.push({ idx: m.index + m[0].indexOf('มาตรา'), num: m[2].replace(/\s+/g, '') });
    }
    if (strictHits.length >= 2) return toSections(strictHits);
    /* โหมดกว้าง (สำรอง): ใช้เมื่อข้อความไม่มีการขึ้นบรรทัดใหม่เลย (เช่น ข้อความที่ดึงจาก PDF
       บางไฟล์ที่ไม่มีข้อมูลตำแหน่งบรรทัดชัดเจน) — สแกนหาทุกจุดที่มีคำว่า "มาตรา"+เลข แทน
       แม่นยำน้อยกว่าโหมดเข้มงวด ต้องตรวจทานพรีวิวก่อนบันทึกเสมอ */
    var looseRe = new RegExp('มาตรา\\s*' + numPart, 'g');
    var looseHits = [], m2;
    while ((m2 = looseRe.exec(text))) looseHits.push({ idx: m2.index, num: m2[1].replace(/\s+/g, '') });
    if (looseHits.length < 2) return [];
    return toSections(looseHits);
  }
  var matraSections = [];
  function renderMatraPreview(sections) {
    matraSections = sections;
    var list = $('bpMatraList');
    list.innerHTML = sections.map(function (s, i) {
      var snip = s.text.replace(/^มาตรา\s*[๐-๙0-9\/\s]+(?:ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|นว|ทศ)?\s*/, '').slice(0, 70);
      return '<li><label><input type="checkbox" checked data-mi="' + i + '">' +
        '<span class="mnum">มาตรา ' + esc(s.num) + '</span> <span class="msnip">' + esc(snip) + (s.text.length > 70 ? '…' : '') + '</span>' +
        '</label></li>';
    }).join('');
    $('bpMatraSplitStatus').textContent = 'พบ ' + sections.length + ' มาตรา — ติ๊กออกได้ถ้ามีจุดที่แบ่งผิด (เช่น ข้อความอ้างอิงมาตราอื่นในเนื้อหา) แล้วตรวจทานอีกครั้งก่อนบันทึก';
    $('bpMatraSplitWrap').style.display = '';
    $('bpMatraSplitWrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function bindOcr() {
    $('bpOcrFile').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var url = URL.createObjectURL(f);
      var img = $('bpOcrPreview'); img.src = url; img.style.display = '';
      var status = $('bpOcrStatus');
      status.className = 'status'; status.textContent = '⏳ กำลังแปลงข้อความ (OCR)… อาจใช้เวลาสักครู่';
      if (!window.Tesseract) { status.className = 'status err'; status.textContent = 'โหลดตัวแปลงข้อความไม่สำเร็จ ลองรีเฟรชหน้าแล้วลองใหม่'; return; }
      window.Tesseract.recognize(f, 'tha+eng', {
        logger: function (m) {
          if (m.status === 'recognizing text') {
            status.textContent = '⏳ กำลังแปลงข้อความ… ' + Math.round((m.progress || 0) * 100) + '%';
          }
        }
      }).then(function (result) {
        showTextForReview((result.data && result.data.text) || '');
      }).catch(function (err) {
        status.className = 'status err';
        status.textContent = '❌ แปลงข้อความไม่สำเร็จ: ' + (err && err.message ? err.message : err);
      });
    });
    $('bpOcrSave').addEventListener('click', function () {
      var text = $('bpOcrText').value;
      if (!text.trim()) return;
      addNote($('bpOcrSubj').value, text.split('\n')[0].slice(0, 80) || 'โน้ตที่นำเข้า', text);
      resetOcrUi('✅ บันทึกเป็นโน้ตแล้ว');
    });
    $('bpMatraSplitBtn').addEventListener('click', function () {
      var text = $('bpOcrText').value;
      var sections = splitByMatra(text);
      if (!sections.length) {
        $('bpMatraSplitWrap').style.display = 'none';
        $('bpOcrStatus').className = 'status err';
        $('bpOcrStatus').textContent = '❌ ไม่พบรูปแบบ "มาตรา <เลข>" อย่างน้อย 2 มาตราขึ้นไปในข้อความนี้ — ลองกด "บันทึกเป็นโน้ตเดียว" แทน';
        return;
      }
      renderMatraPreview(sections);
    });
    $('bpMatraCancelBtn').addEventListener('click', function () {
      $('bpMatraSplitWrap').style.display = 'none';
    });
    $('bpMatraSaveBtn').addEventListener('click', function () {
      var subj = $('bpOcrSubj').value;
      var boxes = $('bpMatraList').querySelectorAll('input[type=checkbox]');
      var n = 0;
      Array.prototype.forEach.call(boxes, function (b) {
        if (!b.checked) return;
        var s = matraSections[parseInt(b.dataset.mi, 10)];
        if (!s) return;
        addNote(subj, 'มาตรา ' + s.num, s.text);
        n++;
      });
      if (!n) return;
      $('bpMatraSplitWrap').style.display = 'none';
      resetOcrUi('✅ บันทึกแยกเป็นโน้ตแล้ว ' + n + ' มาตรา');
    });
  }
  function resetOcrUi(msg) {
    $('bpOcrText').value = ''; $('bpOcrText').style.display = 'none';
    $('bpOcrSave').style.display = 'none';
    $('bpMatraSplitBtn').style.display = 'none';
    $('bpMatraSplitWrap').style.display = 'none';
    $('bpOcrStatus').className = 'status ok';
    $('bpOcrStatus').textContent = msg;
    $('bpOcrPreview').style.display = 'none';
    $('bpOcrFile').value = '';
  }

  /* ══════════════════ ไฟล์ในโฟลเดอร์ Drive ของฉัน (browse — อ่านเฉพาะโฟลเดอร์ส่วนตัวของผู้ใช้เอง) ══════════════════ */
  var FILE_ICONS = { 'application/pdf': '📕', 'image/': '🖼️' };
  function fileIcon(mime) {
    if (mime === 'application/pdf') return FILE_ICONS['application/pdf'];
    if (mime && mime.indexOf('image/') === 0) return FILE_ICONS['image/'];
    return '📄';
  }
  var FOLDER_MIME = 'application/vnd.google-apps.folder';
  /* เดิน BFS หาโฟลเดอร์ย่อยทั้งหมด (ลึกได้ถึง maxDepth ชั้น) เพราะผู้ใช้มักจัดไฟล์เป็นหมวดย่อย
     (เช่น ภาค1/ภาค2/ตัวบทกฎหมาย) ไม่ได้วางไฟล์ไว้ที่โฟลเดอร์หลักตรงๆ */
  function listSubfoldersRecursive(rootId, maxDepth) {
    var all = [{ id: rootId, path: '' }];
    function step(queue, depth) {
      if (!queue.length || depth >= maxDepth) return Promise.resolve(all);
      var next = [];
      return Promise.all(queue.map(function (f) {
        var q = encodeURIComponent("'" + f.id + "' in parents and mimeType='" + FOLDER_MIME + "' and trashed=false");
        return DriveSync.authFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)')
          .then(function (r) { return r.ok ? r.json() : { files: [] }; })
          .then(function (data) {
            (data.files || []).forEach(function (sub) {
              var entry = { id: sub.id, path: f.path ? f.path + ' / ' + sub.name : sub.name };
              all.push(entry);
              next.push(entry);
            });
          });
      })).then(function () { return step(next, depth + 1); });
    }
    return step(all.slice(), 0);
  }
  function renderUploadFolderOptions(folders) {
    var sel = $('bpUploadTargetFolder');
    if (!sel) return;
    var prevValue = sel.value;
    sel.innerHTML = folders.map(function (fo) {
      return '<option value="' + fo.id + '">' + (fo.path ? esc(fo.path) : '(โฟลเดอร์หลัก)') + '</option>';
    }).join('');
    if (prevValue && folders.some(function (fo) { return fo.id === prevValue; })) sel.value = prevValue;
  }
  function listDriveFiles() {
    var status = $('bpDriveListStatus'), list = $('bpDriveFileList');
    if (!DriveSync.connected || !DriveSync.accessToken) {
      status.className = 'status err';
      status.textContent = 'ยังไม่ได้เชื่อมต่อ Google Drive — กดปุ่ม "เชื่อมต่อ Google Drive" ในการ์ดด้านล่างก่อน';
      return;
    }
    status.className = 'status'; status.textContent = '⏳ กำลังค้นโฟลเดอร์ย่อย…';
    var folders;
    DriveSync.ensureFolder().then(function (folderId) {
      return listSubfoldersRecursive(folderId, 4);
    }).then(function (f) {
      folders = f;
      renderUploadFolderOptions(folders);
      status.textContent = '⏳ กำลังโหลดรายชื่อไฟล์จาก ' + folders.length + ' โฟลเดอร์…';
      return Promise.all(folders.map(function (fo) {
        var q = encodeURIComponent("'" + fo.id + "' in parents and mimeType!='" + FOLDER_MIME + "' and trashed=false");
        return DriveSync.authFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name,mimeType,webViewLink,modifiedTime)')
          .then(function (r) { return r.ok ? r.json() : { files: [] }; })
          .then(function (data) {
            return (data.files || []).map(function (file) { file._path = fo.path; return file; });
          });
      }));
    }).then(function (groups) {
        var files = [].concat.apply([], groups).filter(function (f) { return f.name !== DRIVE_FILE_NAME; }); // ข้ามไฟล์ข้อมูลของแอปเอง
        files.sort(function (a, b) { return new Date(b.modifiedTime) - new Date(a.modifiedTime); });
        status.className = 'status ok';
        status.textContent = files.length ? ('พบ ' + files.length + ' ไฟล์ (รวมในโฟลเดอร์ย่อยแล้ว)') : 'ยังไม่มีไฟล์อื่นในโฟลเดอร์นี้ (เช็กแล้วรวมโฟลเดอร์ย่อยด้วย)';
        if (!files.length) { list.innerHTML = ''; return; }
        list.innerHTML = files.map(function (f) {
          var canExtract = f.mimeType === 'application/pdf' || (f.mimeType && f.mimeType.indexOf('image/') === 0);
          return '<li class="note-item" data-fid="' + f.id + '" data-mime="' + esc(f.mimeType) + '" data-name="' + esc(f.name) + '">' +
            '<div class="hd"><span class="tag">' + fileIcon(f.mimeType) + ' ' + esc(f.name) + '</span></div>' +
            '<div class="meta">' + (f._path ? '📁 ' + esc(f._path) + ' · ' : '') + 'แก้ไขล่าสุด: ' + new Date(f.modifiedTime).toLocaleString('th-TH') + '</div>' +
            '<div class="frow" style="margin-top:6px">' +
              '<a class="btn sm" href="' + f.webViewLink + '" target="_blank" rel="noopener">👁 เปิดดู</a>' +
              (canExtract ? '<button class="btn sm" type="button" data-extract="' + f.id + '">📝 แยกข้อความ</button>' : '') +
            '</div></li>';
        }).join('');
        Array.prototype.forEach.call(list.querySelectorAll('[data-extract]'), function (b) {
          b.addEventListener('click', function () {
            var row = b.closest('[data-fid]');
            extractFromDriveFile(row.dataset.fid, row.dataset.mime, row.dataset.name);
          });
        });
      })
      .catch(function (e) {
        status.className = 'status err';
        status.textContent = '❌ ' + (e.message || e);
      });
  }

  /* ══════════════════ อัปโหลดไฟล์เข้า Drive ผ่านแอปเอง ══════════════════
     จำเป็นเพราะสิทธิ์ drive.file ที่ขอไว้ (แคบเพื่อความเป็นส่วนตัว) เห็นได้แค่ไฟล์ที่
     "แอปนี้เป็นคนสร้าง/อัปโหลด" เท่านั้น — ไฟล์ที่ผู้ใช้ลากเข้า Drive เองผ่านเว็บ
     Google โดยตรงจะไม่ปรากฏให้แอปเห็นเลย ไม่ว่าจะอยู่โฟลเดอร์ไหนก็ตาม */
  function uploadOneFile(file, parentId) {
    var metadata = { name: file.name, parents: [parentId] };
    var form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    return DriveSync.authFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: form })
      .then(function (r) { if (!r.ok) throw new Error('อัปโหลด "' + file.name + '" ไม่สำเร็จ (' + r.status + ')'); return r.json(); });
  }
  function uploadFilesToDrive(files) {
    var status = $('bpUploadStatus');
    if (!DriveSync.connected || !DriveSync.accessToken) {
      status.className = 'status err';
      status.textContent = 'ยังไม่ได้เชื่อมต่อ Google Drive — กดปุ่ม "เชื่อมต่อ Google Drive" ในการ์ดด้านล่างก่อน';
      return;
    }
    var chosenId = $('bpUploadTargetFolder').value;
    var list = Array.prototype.slice.call(files);
    if (!list.length) return;
    (chosenId ? Promise.resolve(chosenId) : DriveSync.ensureFolder()).then(function (parentId) {
      var i = 0;
      function next() {
        if (i >= list.length) {
          status.className = 'status ok';
          status.textContent = '✅ อัปโหลดครบ ' + list.length + ' ไฟล์แล้ว';
          listDriveFiles();
          return Promise.resolve();
        }
        var f = list[i++];
        status.className = 'status'; status.textContent = '⏳ กำลังอัปโหลด (' + i + '/' + list.length + '): ' + f.name;
        return uploadOneFile(f, parentId).then(next);
      }
      return next();
    }).catch(function (e) {
      status.className = 'status err';
      status.textContent = '❌ ' + (e.message || e);
    });
  }

  function extractFromDriveFile(fileId, mime, name) {
    var status = $('bpDriveListStatus');
    status.className = 'status'; status.textContent = '⏳ กำลังดึงไฟล์ "' + name + '"…';
    DriveSync.authFetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media')
      .then(function (r) { if (!r.ok) throw new Error('ดึงไฟล์ไม่สำเร็จ (' + r.status + ')'); return r.arrayBuffer(); })
      .then(function (buf) {
        if (mime === 'application/pdf') return extractPdfText(buf);
        return extractImageText(buf, mime);
      })
      .then(function (text) {
        status.className = 'status ok'; status.textContent = '✅ แยกข้อความจาก "' + name + '" เสร็จแล้ว';
        showTextForReview(text, name.replace(/\.[^.]+$/, ''));
      })
      .catch(function (e) {
        status.className = 'status err';
        status.textContent = '❌ แยกข้อความไม่สำเร็จ: ' + (e.message || e);
      });
  }
  /* ต่อข้อความจาก PDF ทีละบรรทัดจริงตามที่ pdf.js รายงาน (แต่ละชิ้นข้อความมี hasEOL บอกว่า
     จบบรรทัดในต้นฉบับหรือไม่) แทนการรวมทั้งหน้าเป็นบรรทัดเดียวแบบเดิม — ทำให้ splitByMatra
     ด้านบนใช้ตำแหน่งขึ้นบรรทัดใหม่แยกจุดเริ่มมาตราจริงจากการอ้างอิงมาตราอื่นกลางเนื้อหาได้ */
  function pdfItemsToLines(items) {
    var lines = [], cur = '';
    for (var i = 0; i < items.length; i++) {
      var s = items[i].str || '';
      if (cur && s && !/\s$/.test(cur) && !/^\s/.test(s)) cur += ' ';
      cur += s;
      if (items[i].hasEOL) { lines.push(cur); cur = ''; }
    }
    if (cur) lines.push(cur);
    return lines.join('\n');
  }
  function extractPdfText(arrayBuffer) {
    if (!window.pdfjsLib) return Promise.reject(new Error('โหลดตัวอ่าน PDF ไม่สำเร็จ ลองรีเฟรชหน้าแล้วลองใหม่'));
    return window.pdfjsLib.getDocument({ data: arrayBuffer }).promise.then(function (doc) {
      var pages = [], chain = Promise.resolve();
      var _loop = function (i) {
        chain = chain.then(function () {
          return doc.getPage(i).then(function (page) {
            return page.getTextContent().then(function (content) {
              pages[i - 1] = pdfItemsToLines(content.items);
            });
          });
        });
      };
      for (var i = 1; i <= doc.numPages; i++) _loop(i);
      return chain.then(function () { return pages.join('\n\n'); });
    });
  }
  function extractImageText(arrayBuffer, mime) {
    if (!window.Tesseract) return Promise.reject(new Error('โหลดตัวแปลงข้อความไม่สำเร็จ ลองรีเฟรชหน้าแล้วลองใหม่'));
    var blob = new Blob([arrayBuffer], { type: mime || 'image/jpeg' });
    return window.Tesseract.recognize(blob, 'tha+eng').then(function (result) {
      return (result.data && result.data.text) || '';
    });
  }

  /* ══════════════════ Google Drive sync (โน้ต/flashcard/ประวัติฝึกเขียน/ผลประเมินเส้นทาง/วันสอบ) ══════════════════ */
  var DRIVE_CLIENT_ID = '497048581273-akpavakt6m34lhqbjf1irg3m8vl6u27u.apps.googleusercontent.com';
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var DRIVE_FOLDER_NAME = 'เนติ-ตั๋วทนาย-อัยการ-ผู้พิพากษา';
  var DRIVE_FILE_NAME = 'bar-prep-data.json';
  var DRIVE_CONNECTED_KEY = 'tanot:barprep:driveConnected';
  function nowTime() { return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }

  var DriveSync = {
    tokenClient: null, accessToken: null, folderId: null, fileId: null,
    connected: false, syncing: false, pending: false, timer: null,

    setStatus: function (text, cls) {
      var el = $('driveStatusTxt'); if (!el) return;
      el.textContent = text; el.className = 'status' + (cls ? ' ' + cls : '');
    },
    setBtn: function () {
      var b = $('driveConnectBtn'); if (!b) return;
      b.textContent = this.connected ? '🔗 เชื่อมต่อ Google Drive แล้ว' : '🔗 เชื่อมต่อ Google Drive';
    },
    init: function () {
      try { this.connected = localStorage.getItem(DRIVE_CONNECTED_KEY) === '1'; } catch (e) {}
      this.setBtn();
      var self = this;
      (function wait() {
        if (!window.google || !google.accounts || !google.accounts.oauth2) { setTimeout(wait, 300); return; }
        self.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: DRIVE_CLIENT_ID,
          scope: DRIVE_SCOPE,
          use_fedcm_for_prompt: true, // ลดโอกาสต้องกดยืนยันใหม่ทุกครั้งบนเบราว์เซอร์ที่บล็อก third-party cookie (เช่น Chrome รุ่นใหม่)
          callback: function (resp) {
            if (resp.error) {
              self.setStatus(self.connected ? 'เชื่อมต่ออัตโนมัติไม่สำเร็จ (อาจเพราะเบราว์เซอร์บล็อก cookie ข้ามโดเมน) — กดปุ่มเชื่อมต่ออีกครั้ง' : 'เชื่อมต่อไม่สำเร็จ: ' + resp.error, 'err');
              return;
            }
            self.accessToken = resp.access_token;
            self.connected = true;
            try { localStorage.setItem(DRIVE_CONNECTED_KEY, '1'); } catch (e) {}
            self.setBtn();
            self.firstSync();
          }
        });
        if (self.connected) self.tokenClient.requestAccessToken({ prompt: '' });
      })();
    },
    connect: function () {
      if (!this.tokenClient) { this.setStatus('กำลังโหลด Google Identity Services… รออีก 2-3 วิแล้วลองใหม่', 'err'); return; }
      this.setStatus('กำลังขอสิทธิ์เชื่อมต่อ…', '');
      this.tokenClient.requestAccessToken({ prompt: this.accessToken ? '' : 'consent' });
    },
    authFetch: function (url, opts) {
      opts = opts || {}; opts.headers = opts.headers || {};
      opts.headers.Authorization = 'Bearer ' + this.accessToken;
      return fetch(url, opts);
    },
    ensureFolder: function () {
      var self = this;
      if (self.folderId) return Promise.resolve(self.folderId);
      var q = encodeURIComponent("name='" + DRIVE_FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
      return self.authFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)')
        .then(function (r) { if (!r.ok) throw new Error('ค้นหาโฟลเดอร์ไม่สำเร็จ (' + r.status + ')'); return r.json(); })
        .then(function (data) {
          if (data.files && data.files.length) { self.folderId = data.files[0].id; return self.folderId; }
          return self.authFetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
          }).then(function (r) { if (!r.ok) throw new Error('สร้างโฟลเดอร์ไม่สำเร็จ (' + r.status + ')'); return r.json(); })
            .then(function (d) { self.folderId = d.id; return self.folderId; });
        });
    },
    findFile: function () {
      var self = this;
      if (self.fileId) return Promise.resolve(self.fileId);
      var q = encodeURIComponent("name='" + DRIVE_FILE_NAME + "' and '" + self.folderId + "' in parents and trashed=false");
      return self.authFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)')
        .then(function (r) { if (!r.ok) throw new Error('ค้นหาไฟล์ไม่สำเร็จ (' + r.status + ')'); return r.json(); })
        .then(function (data) { self.fileId = (data.files && data.files[0] && data.files[0].id) || null; return self.fileId; });
    },
    download: function () {
      var self = this;
      return self.authFetch('https://www.googleapis.com/drive/v3/files/' + self.fileId + '?alt=media')
        .then(function (r) { if (!r.ok) throw new Error('ดาวน์โหลดไม่สำเร็จ (' + r.status + ')'); return r.json(); });
    },
    upload: function (obj) {
      var self = this;
      var metadata = self.fileId ? {} : { name: DRIVE_FILE_NAME, parents: [self.folderId] };
      var form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([JSON.stringify(obj)], { type: 'application/json' }));
      var url = self.fileId
        ? 'https://www.googleapis.com/upload/drive/v3/files/' + self.fileId + '?uploadType=multipart'
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
      return self.authFetch(url, { method: self.fileId ? 'PATCH' : 'POST', body: form })
        .then(function (r) { if (!r.ok) throw new Error('บันทึกขึ้น Drive ไม่สำเร็จ (' + r.status + ')'); return r.json(); })
        .then(function (d) { if (d.id) self.fileId = d.id; return d; });
    },
    mergeById: function (a, b) {
      var map = {};
      (a || []).forEach(function (x) { if (x && x.id != null) map[x.id] = x; });
      (b || []).forEach(function (x) { if (x && x.id != null) map[x.id] = x; });
      return Object.keys(map).map(function (k) { return map[k]; });
    },
    payload: function () {
      return {
        notes: loadNotes(), writing: loadWriting(),
        examDates: loadExamDates(),
        career: (function () { try { return JSON.parse(localStorage.getItem(CAREER_KEY)) || null; } catch (e) { return null; } })(),
        savedAt: new Date().toISOString()
      };
    },
    firstSync: function () {
      var self = this;
      self.setStatus('กำลังซิงก์…', '');
      self.ensureFolder().then(function () { return self.findFile(); })
        .then(function (fid) { return fid ? self.download() : null; })
        .then(function (remote) {
          if (remote) {
            saveNotes(self.mergeById(remote.notes, loadNotes()));
            saveWriting(self.mergeById(remote.writing, loadWriting()));
            if (remote.examDates) {
              var merged = Object.assign({}, remote.examDates, loadExamDates());
              saveExamDates(merged);
            }
            if (remote.career && !localStorage.getItem(CAREER_KEY)) {
              try { localStorage.setItem(CAREER_KEY, JSON.stringify(remote.career)); } catch (e) {}
            }
          }
          renderNoteList(); renderReviewCount(); renderWritingHistory(); renderExams(); loadCareerIntoForm();
          return self.upload(self.payload());
        })
        .then(function () { self.setStatus('✅ ซิงก์กับ Google Drive แล้ว · ' + nowTime(), 'ok'); listDriveFiles(); })
        .catch(function (e) { self.setStatus('❌ ' + (e.message || e), 'err'); });
    },
    scheduleSync: function () {
      var self = this;
      if (!self.connected || !self.accessToken) return;
      self.pending = true;
      if (self.timer) clearTimeout(self.timer);
      self.timer = setTimeout(function () { self.pushNow(); }, 1800);
    },
    pushNow: function () {
      var self = this;
      if (self.syncing) { self.pending = true; return; }
      self.pending = false; self.syncing = true;
      self.setStatus('กำลังซิงก์…', '');
      self.ensureFolder().then(function () { return self.findFile(); })
        .then(function () { return self.upload(self.payload()); })
        .then(function () { self.setStatus('✅ ซิงก์ล่าสุด ' + nowTime(), 'ok'); })
        .catch(function (e) {
          var msg = String(e && e.message || e);
          if (msg.indexOf('401') !== -1 || msg.indexOf('403') !== -1) {
            self.accessToken = null;
            self.setStatus('เซสชันหมดอายุ — กดปุ่มเชื่อมต่อ Drive อีกครั้ง', 'err');
          } else {
            self.setStatus('❌ ซิงก์ไม่สำเร็จ: ' + msg, 'err');
          }
        })
        .finally(function () {
          self.syncing = false;
          if (self.pending) self.scheduleSync();
        });
    }
  };

  /* ══════════════════ init ══════════════════ */
  function init() {
    renderExams();
    loadCareerIntoForm();
    $('bpCareerBtn').addEventListener('click', doCareerEval);
    if (localStorage.getItem(CAREER_KEY)) doCareerEval();

    $('bpNoteAdd').addEventListener('click', function () {
      addNote($('bpNoteSubj').value, $('bpNoteQ').value, $('bpNoteA').value);
      $('bpNoteQ').value = ''; $('bpNoteA').value = '';
    });
    renderNoteList();
    renderReviewCount();
    $('bpReviewBtn').addEventListener('click', startReview);

    $('bpWrStart').addEventListener('click', startWriting);
    $('bpWrStop').addEventListener('click', stopWriting);
    $('bpWrSave').addEventListener('click', saveWritingResult);
    renderWritingHistory();

    bindOcr();

    $('driveConnectBtn').addEventListener('click', function () { DriveSync.connect(); });
    $('bpDriveListBtn').addEventListener('click', listDriveFiles);
    $('bpUploadFiles').addEventListener('change', function (e) {
      uploadFilesToDrive(e.target.files);
      e.target.value = '';
    });
    DriveSync.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__barprep = {
    evalCareer: evalCareer, daysUntil: daysUntil, fmtClock: fmtClock,
    DriveSync: DriveSync, listDriveFiles: listDriveFiles, uploadFilesToDrive: uploadFilesToDrive,
    splitByMatra: splitByMatra, pdfItemsToLines: pdfItemsToLines, stripBoilerplate: stripBoilerplate,
    showTextForReview: showTextForReview
  };
})();
