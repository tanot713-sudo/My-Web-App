/* ══════════════════════════════════════════════════════════════════
   Tanot — code-runner-worker.js
   รันโค้ด JavaScript ของผู้เรียนแบบแยกส่วน (sandbox) สำหรับหน้า "การเขียนโค้ด"

   ทำไมต้องรันใน Web Worker แยก แทนที่จะ eval() ตรงๆ บนหน้าเว็บหลัก:
   1. ปลอดภัย — Worker ไม่มีสิทธิ์เข้าถึง document/localStorage/cookie ของหน้าเว็บหลักอยู่แล้ว
      โดยธรรมชาติของ Worker เอง (คนละ global scope) ไม่ต้องสร้างระบบ sandbox เพิ่มเติมเอง
   2. กันลูปไม่รู้จบ (เช่น while(true){}) — ถ้ารันบน main thread เบราว์เซอร์จะค้างทันที แก้ไม่ได้
      นอกจากปิดแท็บ แต่ถ้ารันใน Worker ฝั่งหน้าเว็บตั้ง timeout แล้วสั่ง worker.terminate() ได้จริง
      (เป็นวิธีเดียวที่ "ฆ่า" ลูปไม่รู้จบได้เด็ดขาดจากภายนอก — ดู runCode() ใน coding.js)

   สร้าง Worker ใหม่ทุกครั้งที่กด "รัน" (ไม่ใช้ตัวเดียวซ้ำ) — ง่ายและปลอดภัยสุด ไม่มี state
   ค้างจากรอบก่อนหน้าให้ปนกัน ต้นทุนสร้าง Worker ใหม่ทุกครั้งถือว่าน้อยมากเพราะกดรันไม่บ่อย
   (ต่างจาก ai-chat-worker.js/tts-worker.js ที่ตั้งใจคงไว้ไม่ terminate เพราะโหลดโมเดล AI หนักมาก)
   ══════════════════════════════════════════════════════════════════ */
'use strict';

self.onmessage = function (e) {
  var msg = e.data || {};
  var logs = [];
  var origLog = console.log;
  console.log = function () {
    var parts = Array.prototype.slice.call(arguments).map(function (a) {
      if (typeof a === 'object') { try { return JSON.stringify(a); } catch (err) { return String(a); } }
      return String(a);
    });
    logs.push(parts.join(' '));
  };

  var runtimeError = null;
  var testResults = [];

  try {
    /* eval แบบ indirect ((0, eval)) ให้รันใน global scope ของ worker นี้ (ไม่ใช่ local scope ของ
       ฟังก์ชันนี้) — จำเป็นสำหรับให้ฟังก์ชันที่ผู้เรียนประกาศ (function name(){}) เข้าถึงได้จาก
       การตรวจข้อสอบ (tests ที่ type 'call') ในขั้นตอนถัดไป */
    (0, eval)(msg.code || '');

    (msg.tests || []).forEach(function (test) {
      if (test.type === 'log-includes') {
        var pass = logs.some(function (l) { return l === String(test.expected); });
        testResults.push({ label: test.label, pass: pass });
      } else if (test.type === 'call') {
        try {
          var actual = (0, eval)(test.call);
          var pass2 = JSON.stringify(actual) === JSON.stringify(test.expected);
          testResults.push({ label: test.label, pass: pass2, actual: actual });
        } catch (err) {
          testResults.push({ label: test.label, pass: false, error: String(err && err.message || err) });
        }
      }
    });
  } catch (err) {
    runtimeError = String(err && err.message || err);
  }

  console.log = origLog;
  self.postMessage({ jobId: msg.jobId, logs: logs, testResults: testResults, runtimeError: runtimeError });
};
