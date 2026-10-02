/* ══════════════════════════════════════════════════════════════════
   ตัวจัดตารางทบทวน FSRS กลาง (ROADMAP Phase 5) — ไม่มี DOM ไม่แตะ storage
   แยกออกมาจาก classroom-law.js (หน้าภาษาเคยมีสำเนาเดียวกัน) — ผลการคำนวณต้องตรงกับของเดิมทุกการ์ด
   (tests/learn.spec.js เทียบกับสำเนาต้นฉบับใน tests/fixtures/fsrs-original.js)

   โมเดล: stability (วัน) + difficulty (1–10) ต่อการ์ด, R(t,S) = (1 + t/(9·S))⁻¹, เป้าความจำ 90% ⇒ interval = stability
   สูตรอัปเดต stability/difficulty เป็นแบบย่อ ไม่ใช่พารามิเตอร์ที่ทีม FSRS optimize จากข้อมูล Anki
   ฟิลด์การ์ดที่ใช้/คืน: stability, difficulty, reps, lapses, lastReview, dueAt (ms), srsIdx

   UMD: window.TanotFSRS ในหน้าเว็บ, require() ใน Node (tests)
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TanotFSRS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY_MS = 86400000;
  var RETENTION = 0.9;
  var RATING_LABEL = { 1: 'Again (ลืมสนิท)', 2: 'Hard (จำได้ยาก)', 3: 'Good (จำได้)', 4: 'Easy (จำง่ายมาก)' };

  function retrievability(elapsedDays, stability) {
    if (!stability || stability <= 0) return 0;
    return Math.pow(1 + elapsedDays / (9 * stability), -1);
  }

  /* ค่า stability/difficulty ใหม่ของการ์ด n หลังตอบด้วย rating (1=Again 2=Hard 3=Good 4=Easy)
     now (ms) ไม่ส่ง = Date.now() — คืนเฉพาะฟิลด์ที่อัปเดต ไม่แก้ object เดิม */
  function schedule(n, rating, now) {
    if (now == null) now = Date.now();
    n = n || {};
    var difficulty = n.difficulty == null ? 5 : n.difficulty;
    var stability = n.stability;
    if (stability == null) {
      // การ์ดใหม่ (หรือการ์ดจากระบบขั้นบันไดเดิมที่ยังไม่เคยผ่าน FSRS) — ค่าเริ่มต้นตามคะแนนแรก
      var initStability = { 1: 0.5, 2: 1, 3: 3, 4: 7 };
      stability = initStability[rating];
      difficulty = 5 - (rating - 3);
    } else {
      var elapsedDays = Math.max((now - (n.lastReview || now)) / DAY_MS, 0);
      var r = retrievability(elapsedDays, stability);
      if (rating === 1) {
        // ลืม — stability หด ยิ่งการ์ดยากยิ่งหดมาก ไม่ต่ำกว่า 0.5 วัน
        stability = Math.max(stability * 0.5 * (1 - difficulty / 20), 0.5);
        difficulty += 1;
      } else {
        var ratingMul = { 2: 0.5, 3: 1, 4: 1.6 }[rating];
        // ตอบตอนใกล้ลืม (R ต่ำ) ได้ผลตอกย้ำมากกว่า, การ์ดง่ายโตเร็วกว่า
        var growth = 1 + ((11 - difficulty) / 10) * (1 - r) * ratingMul;
        stability = stability * Math.max(growth, 1.05);
        difficulty += (rating - 3) * -0.5;
      }
    }
    difficulty = Math.min(Math.max(difficulty, 1), 10);
    var intervalDays = 9 * stability * (1 / RETENTION - 1);
    return {
      stability: stability, difficulty: difficulty,
      reps: (n.reps || 0) + (rating > 1 ? 1 : 0), lapses: (n.lapses || 0) + (rating === 1 ? 1 : 0),
      lastReview: now, dueAt: now + Math.max(intervalDays, 1 / 24) * DAY_MS, srsIdx: rating === 1 ? -1 : (n.srsIdx || 0) + 1
    };
  }

  // ช่วงเวลาถึงรอบถัดไป (ms) ถ้าตอบด้วย rating — ใช้แสดงบนปุ่ม
  function preview(n, rating, now) {
    if (now == null) now = Date.now();
    return schedule(n, rating, now).dueAt - now;
  }

  return { DAY_MS: DAY_MS, RETENTION: RETENTION, RATING_LABEL: RATING_LABEL,
    retrievability: retrievability, schedule: schedule, preview: preview };
});
