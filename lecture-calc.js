/* ══════════════════════════════════════════════════════════════════
   lecture-calc.js — ตรรกะล้วนของ "โน้ตจากเสียงบรรยาย" (UMD, window.LectureCalc, ไม่มี DOM/storage)
   ข้อความถอดเสียง → /api/ai/summarize (task 'lecture') → { title, subject, summary, points[], cards[{q,a}] }

   คีย์ (sync list idField 'id' ใน data-registry.js):
     tanot:lecture:notes  { id 'lec-<เวลา base36>', title, subject, summary, points[], createdAt }
                          ไม่เก็บข้อความถอดเสียง (ยาว/ส่วนตัว — ผู้ใช้เก็บไฟล์เองจากหน้าถอดเสียง)
     tanot:lecture:cards  { id 'card-<noteId>-<hash คำถาม>', noteId, subject, front, back, createdAt }
                          + ฟิลด์ FSRS (stability difficulty reps lapses lastReview dueAt srsIdx) ที่ review.js เขียนกลับด้วย
                          TanotFSRS.schedule — id ตายตัวต่อ (โน้ต, คำถาม): สองเครื่อง/กดบันทึกซ้ำ = แถวเดียว
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LectureCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMITS = { title: 120, subject: 40, summary: 2000, point: 300, q: 300, a: 600 };
  var MAX_POINTS = 12, MAX_CARDS = 12;

  function str(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); }
  function norm(q) { return String(q == null ? '' : q).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function hash(s) { // djb2 → base36 (ไม่ใช่ความปลอดภัย แค่ให้ id คงที่)
    var h = 5381; s = norm(s);
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function messages(transcript, subject) {
    var sys = 'คุณเป็นผู้ช่วยทำโน้ตเรียนจากข้อความถอดเสียงคำบรรยาย อ่านแล้วตอบเป็น JSON อย่างเดียว (ไม่มีข้อความนอก JSON, ไม่มี markdown) ' +
      'รูปแบบ: {"title":"ชื่อบทเรียนสั้นๆ","subject":"วิชา/หมวด","summary":"สรุปย่อ 3-5 ประโยค","points":["ประเด็นสำคัญ (ไม่เกิน 8 ข้อ)"],' +
      '"cards":[{"q":"คำถามทบทวน","a":"คำตอบสั้นๆ"}]} ' +
      'cards 5-10 ข้อ แต่ละข้อถามเรื่องเดียวและตอบได้จากข้อความเท่านั้น ห้ามเดาหรือเติมสิ่งที่ผู้พูดไม่ได้พูด ใช้ภาษาเดียวกับข้อความ ' +
      'คำศัพท์เทคนิค สูตร และหน่วย คงตามที่พูด ถ้าข้อความถอดเสียงอ่านไม่ออกบางช่วงให้ข้ามช่วงนั้น' +
      (str(subject, LIMITS.subject) ? ' วิชา: ' + str(subject, LIMITS.subject) : '');
    return [{ role: 'system', content: sys }, { role: 'user', content: String(transcript || '') }];
  }

  function uniq(list, key) {
    var seen = {}, out = [];
    list.forEach(function (x) { var k = key(x); if (k && !seen[k]) { seen[k] = 1; out.push(x); } });
    return out;
  }
  // รับข้อความที่โมเดลตอบ → ผลที่ล้างแล้ว หรือ null (ไม่ใช่ JSON / ไม่มีเนื้อหาให้ใช้)
  function parse(text) {
    var s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    var o;
    try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
    if (!o || typeof o !== 'object') return null;
    var points = uniq((Array.isArray(o.points) ? o.points : []).map(function (p) { return str(p, LIMITS.point); }), function (p) { return p; }).slice(0, MAX_POINTS);
    var cards = uniq((Array.isArray(o.cards) ? o.cards : []).map(function (c) {
      return c && typeof c === 'object' ? { q: str(c.q, LIMITS.q), a: str(c.a, LIMITS.a) } : { q: '', a: '' };
    }).filter(function (c) { return c.q && c.a; }), function (c) { return norm(c.q); }).slice(0, MAX_CARDS);
    var r = { title: str(o.title, LIMITS.title), subject: str(o.subject, LIMITS.subject), summary: str(o.summary, LIMITS.summary), points: points, cards: cards };
    return r.title || r.summary || points.length || cards.length ? r : null;
  }

  // ข้อความยาวเกินที่โมเดลรับทีเดียว: ตัดที่ขอบย่อหน้า ท่อนละไม่เกิน max (ย่อหน้าเดียวยาวเกิน = ตัดตามความยาว) แล้วสรุปย่อทีละท่อนก่อน
  function chunk(text, max) {
    var out = [], cur = '';
    String(text || '').split(/\n+/).forEach(function (p) {
      while (p.length > max) { if (cur) { out.push(cur); cur = ''; } out.push(p.slice(0, max)); p = p.slice(max); }
      if (cur && cur.length + p.length + 1 > max) { out.push(cur); cur = p; }
      else cur = cur ? cur + '\n' + p : p;
    });
    if (cur) out.push(cur);
    return out;
  }
  var PART_SYSTEM = 'คุณเป็นผู้ช่วยจดบันทึกคำบรรยาย อ่านข้อความถอดเสียงส่วนหนึ่งของบทเรียนแล้วสรุปประเด็น นิยาม สูตร และตัวอย่างที่ผู้พูดอธิบายเป็นข้อๆ (ขึ้นต้นด้วย "- ") ห้ามทักทาย ห้ามเดาสิ่งที่ไม่ได้พูด';

  function newId(now) { return 'lec-' + Math.floor(Number(now) || 0).toString(36); }
  function cardId(noteId, q) { return 'card-' + noteId + '-' + hash(q); }

  function noteFrom(p, o) {
    o = o || {};
    return {
      id: o.id || newId(o.now), title: str(p.title, LIMITS.title) || 'โน้ตจากเสียง', subject: str(o.subject, LIMITS.subject) || str(p.subject, LIMITS.subject),
      summary: str(p.summary, LIMITS.summary), points: (p.points || []).slice(0, MAX_POINTS).map(function (x) { return str(x, LIMITS.point); }).filter(Boolean),
      createdAt: Number(o.now) || 0
    };
  }
  // ใหม่ = ยังไม่มีฟิลด์ FSRS, dueAt = ตอนสร้าง · สร้างซ้ำ/แก้คำตอบต้องไม่ล้างตารางทบทวน — ส่งการ์ดเดิมเข้า existing
  function makeCard(note, c, now, existing) {
    var r = Object.assign({}, existing || {});
    r.id = cardId(note.id, c.q); r.noteId = note.id; r.subject = str(note.subject, LIMITS.subject);
    r.front = str(c.q, LIMITS.q); r.back = str(c.a, LIMITS.a);
    if (!existing) { r.createdAt = now; r.dueAt = now; }
    return r;
  }

  return { LIMITS: LIMITS, MAX_POINTS: MAX_POINTS, MAX_CARDS: MAX_CARDS, messages: messages, chunk: chunk, PART_SYSTEM: PART_SYSTEM, parse: parse, newId: newId, cardId: cardId, noteFrom: noteFrom, makeCard: makeCard };
});
