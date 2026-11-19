/* ══════════════════════════════════════════════════════════════════
   palette-calc.js — ตรรกะล้วนของค้นหาด่วน (palette.js): รายการ "ข้อมูลในเครื่อง" + การแจ้งเตือนที่ตั้งเอง
   UMD (window.PaletteCalc) ไม่มี DOM/storage — require() ได้ใน test

   ข้อมูลที่ค้น (อ่านอย่างเดียว ผู้เรียกอ่านด้วย TanotData.read):
     tanot:books:items    { id, title, author, status }              → เปิด books.html
     tanot:lecture:notes  { id, title, subject }                     → เปิด lecture.html#<id>
   การแจ้งเตือนที่ตั้งเอง:
     tanot:reminders:custom (sync list idField id)  { id, title, at (ms), createdAt }
     ส่งขึ้น D1 ผ่าน TanotPush.setReminders('custom', reminders(list, now)) ด้วย "ชุดเต็ม" ทุกครั้ง
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PaletteCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_DATA = 400, MAX_CUSTOM = 100, KEEP_PAST_MS = 30 * 86400000; // เตือนที่เลยเวลาเกิน 30 วันถูกล้างทิ้ง
  function str(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); }
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }
  function list(v) { return Array.isArray(v) ? v : []; }

  /* หนังสือ + โน้ตเรียน → รายการค้น (label = ชื่อ, group = ป้ายชนิด/ผู้แต่ง/วิชา — ป้ายชนิดส่งเข้ามาตามภาษา) */
  function dataItems(src, labels) {
    var out = [], lb = labels || {};
    list(src && src.books).forEach(function (b) {
      var title = str(b && b.title, 120);
      if (!title || !b.id) return;
      var author = str(b.author, 80);
      out.push({ id: 'data:book:' + b.id, kind: 'data', label: title, icon: 'book-open', href: 'books.html',
        group: [lb.book || 'Book', author].filter(Boolean).join(' · '), hay: norm(title + ' ' + author) });
    });
    list(src && src.notes).forEach(function (n) {
      var title = str(n && n.title, 120);
      if (!title || !n.id) return;
      var subject = str(n.subject, 80);
      out.push({ id: 'data:lec:' + n.id, kind: 'data', label: title, icon: 'notebook-pen', href: 'lecture.html#' + encodeURIComponent(n.id),
        group: [lb.note || 'Lecture note', subject].filter(Boolean).join(' · '), hay: norm(title + ' ' + subject) });
    });
    return out.slice(0, MAX_DATA);
  }

  /* แถวการแจ้งเตือนที่ผู้ใช้ตั้งเอง: ล้างค่า, ไม่ซ้ำ id */
  function cleanCustom(v, now) {
    var seen = {}, out = [];
    list(v).forEach(function (r) {
      var id = str(r && r.id, 60), title = str(r && r.title, 120), at = Number(r && r.at);
      if (!id || !title || !isFinite(at) || at <= 0 || seen[id]) return;
      if (now && at < now - KEEP_PAST_MS) return;
      seen[id] = 1;
      out.push({ id: id, title: title, at: Math.round(at), createdAt: Number(r.createdAt) > 0 ? Math.round(r.createdAt) : 0 });
    });
    // เกินเพดาน = เก็บแถวที่ใกล้ถึงที่สุด (เวลามากสุด) ไม่ใช่แถวเก่าสุด
    if (out.length > MAX_CUSTOM) out = out.sort(function (a, b) { return b.at - a.at; }).slice(0, MAX_CUSTOM);
    return out;
  }

  /* ผลของฟอร์ม → แถวใหม่ หรือ { error:'title'|'when' } (เวลาต้องอยู่ในอนาคต) */
  function makeCustom(title, at, now, id) {
    var t = str(title, 120), a = Number(at);
    if (!t) return { error: 'title' };
    if (!isFinite(a) || a <= now) return { error: 'when' };
    return { row: { id: id, title: t, at: Math.round(a), createdAt: now } };
  }

  /* รายการส่ง TanotPush.setReminders('custom', …) — เฉพาะที่ยังไม่ถึงเวลา (ที่ผ่านแล้วไม่ต้องส่งอีก; ชุดเต็มเสมอ) */
  function reminders(rows, now) {
    return cleanCustom(rows, now).filter(function (r) { return r.at > now; }).map(function (r) {
      return { id: r.id, title: r.title, due_at: r.at, kind: 'push', url: 'notifications.html' };
    });
  }

  return { dataItems: dataItems, cleanCustom: cleanCustom, makeCustom: makeCustom, reminders: reminders, norm: norm };
});
