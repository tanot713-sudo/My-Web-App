// สำเนาตัวจัดตารางทบทวน (FSRS) ก่อนแยกเป็น fsrs.js — คัดลอกตามตัวอักษรจาก commit 71a2f06 ห้ามแก้
// learn.spec.js ใช้เทียบว่า fsrs.js ให้ผลเหมือนเดิมทุกการ์ด (Date.now ถูกตรึงจากฝั่งทดสอบ)
'use strict';
/* ── classroom-law.js บรรทัด 2389–2427 ── */
var lawCopy = (function () {
  var DAY_MS = 86400000;
  var FSRS_RETENTION = 0.9;
  var FSRS_RATING_LABEL = { 1: 'Again (ลืมสนิท)', 2: 'Hard (จำได้ยาก)', 3: 'Good (จำได้)', 4: 'Easy (จำง่ายมาก)' };
  function fsrsRetrievability(elapsedDays, stability) {
    if (!stability || stability <= 0) return 0;
    return Math.pow(1 + elapsedDays / (9 * stability), -1);
  }
  /* คำนวณค่า stability/difficulty ใหม่ของการ์ด n หลังตอบด้วย rating (1-4) แล้วคืนค่าฟิลด์ที่อัปเดต */
  function fsrsSchedule(n, rating) {
    var now = Date.now();
    var difficulty = n.difficulty == null ? 5 : n.difficulty;
    var stability = n.stability;
    if (stability == null) {
      /* การ์ดใหม่ (หรือการ์ดเก่าจากระบบขั้นบันไดที่ยังไม่เคยผ่าน FSRS) — ตั้งค่าเริ่มต้นตามคะแนนแรก */
      var initStability = { 1: 0.5, 2: 1, 3: 3, 4: 7 };
      stability = initStability[rating];
      difficulty = 5 - (rating - 3); // Again→6, Hard→5.5(ปัด), Good→5, Easy→4 (เก็บช่วง 1-10)
    } else {
      var elapsedDays = Math.max((now - (n.lastReview || now)) / DAY_MS, 0);
      var r = fsrsRetrievability(elapsedDays, stability);
      if (rating === 1) {
        /* ลืม (lapse) — stability หดตัวลง ยิ่งการ์ดยากยิ่งหดมาก ห้ามต่ำกว่า 0.5 วัน */
        stability = Math.max(stability * 0.5 * (1 - difficulty / 20), 0.5);
        difficulty += 1;
      } else {
        var ratingMul = { 2: 0.5, 3: 1, 4: 1.6 }[rating];
        /* ยิ่งตอบตอนใกล้ลืม (retrievability ต่ำ) ยิ่งได้ผลตอกย้ำความจำมาก (spacing effect) การ์ดง่ายโตเร็วกว่า */
        var growth = 1 + ((11 - difficulty) / 10) * (1 - r) * ratingMul;
        stability = stability * Math.max(growth, 1.05);
        difficulty += (rating - 3) * -0.5;
      }
    }
    difficulty = Math.min(Math.max(difficulty, 1), 10);
    var intervalDays = 9 * stability * (1 / FSRS_RETENTION - 1); // = stability พอดีที่ retention 90%
    return {
      stability: stability, difficulty: difficulty,
      reps: (n.reps || 0) + (rating > 1 ? 1 : 0), lapses: (n.lapses || 0) + (rating === 1 ? 1 : 0),
      lastReview: now, dueAt: now + Math.max(intervalDays, 1 / 24) * DAY_MS, srsIdx: rating === 1 ? -1 : (n.srsIdx || 0) + 1
    };
  }
  return fsrsSchedule;
})();
/* ── languages.jsx บรรทัด 389–424 (สำเนาที่หน้าภาษาเคยใช้) ── */
var langCopy = (function () {
        const DAY_MS = 86400000;
        function fsrsRetrievability(elapsedDays, stability) {
            if (!stability || stability <= 0) return 0;
            return Math.pow(1 + elapsedDays / (9 * stability), -1);
        }
        function fsrsSchedule(n, rating) { // rating: 1=Again 2=Hard 3=Good 4=Easy
            const now = Date.now();
            let difficulty = n.difficulty == null ? 5 : n.difficulty;
            let stability = n.stability;
            if (stability == null) {
                const initStability = { 1: 0.5, 2: 1, 3: 3, 4: 7 };
                stability = initStability[rating];
                difficulty = 5 - (rating - 3);
            } else {
                const elapsedDays = Math.max((now - (n.lastReview || now)) / DAY_MS, 0);
                const r = fsrsRetrievability(elapsedDays, stability);
                if (rating === 1) {
                    stability = Math.max(stability * 0.5 * (1 - difficulty / 20), 0.5);
                    difficulty += 1;
                } else {
                    const ratingMul = { 2: 0.5, 3: 1, 4: 1.6 }[rating];
                    const growth = 1 + ((11 - difficulty) / 10) * (1 - r) * ratingMul;
                    stability = stability * Math.max(growth, 1.05);
                    difficulty += (rating - 3) * -0.5;
                }
            }
            difficulty = Math.min(Math.max(difficulty, 1), 10);
            const FSRS_RETENTION = 0.9;
            const intervalDays = 9 * stability * (1 / FSRS_RETENTION - 1); // = stability พอดีที่เป้าหมาย 90%
            return {
                stability, difficulty,
                reps: (n.reps || 0) + (rating > 1 ? 1 : 0), lapses: (n.lapses || 0) + (rating === 1 ? 1 : 0),
                lastReview: now, dueAt: now + Math.max(intervalDays, 1 / 24) * DAY_MS,
                srsIdx: rating === 1 ? -1 : (n.srsIdx || 0) + 1,
            };
        }
  return fsrsSchedule;
})();
module.exports = { lawCopy: lawCopy, langCopy: langCopy };
