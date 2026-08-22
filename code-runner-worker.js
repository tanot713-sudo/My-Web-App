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

   3. รองรับโค้ด async/await (แทร็ก "Async/Fetch") — (0, eval) รันแบบ synchronous เสร็จแล้วคืน
      ทันที แต่ถ้าโค้ดผู้เรียนเรียก async function ที่มี await ข้างใน (เช่น await delay(100))
      console.log ที่อยู่หลัง await จะยังไม่ทันเกิดตอน eval() คืนค่ากลับมา (มันถูก "นัดหมาย" ไว้ทำ
      ทีหลังผ่าน microtask/timer) ถ้าตรวจ tests ทันทีแบบเดิมจะพลาดผลลัพธ์ที่ยังมาไม่ถึง — จึงเพิ่ม
      msg.settleMs (ส่งมาเฉพาะแบบฝึกหัดที่เป็น async เท่านั้น ค่าเริ่มต้น 0 = พฤติกรรมเดิมทุกอย่าง
      ไม่กระทบแทร็กอื่น) ให้ worker รอเวลานี้ก่อนค่อยตรวจ tests เพื่อให้ Promise/setTimeout ข้างใน
      โค้ดผู้เรียนมีเวลา "settle" (ทำงานจนจบ) ก่อน — timeout ฆ่าลูปไม่รู้จบยังทำงานอิสระจากตรงนี้
      (ควบคุมจากฝั่ง main thread ผ่าน worker.terminate() เหมือนเดิมทุกประการ)
   4. รองรับแทร็ก "localStorage (JS)" — Worker จริงๆ ไม่มี localStorage เลย (เป็น Window-only API
      ไม่ได้ mixin เข้า WorkerGlobalScope ตามสเปก ยืนยันด้วยการทดสอบจริงว่า typeof localStorage
      เป็น "undefined" ใน Worker) จึงจำลอง localStorage ปลอมขึ้นมาเอง (เก็บในตัวแปรธรรมดา ไม่แตะ
      localStorage จริงของหน้าเว็บหลักเลย ปลอดภัย 100% และสอดคล้องกับที่ Worker เข้าถึง storage
      จริงไม่ได้อยู่แล้วโดยธรรมชาติ) — ต้องประกาศเป็น global ของสคริปต์ (นอกฟังก์ชัน onmessage)
      เหตุผลเดียวกับ document ใน dom-runner-worker.js: (0, eval) แบบ indirect เห็นแค่ global scope
      Worker ใหม่ถูกสร้างทุกครั้งที่กดรันอยู่แล้ว ข้อมูลจึงเริ่มว่างใหม่ทุกรอบโดยธรรมชาติ (ไม่ได้
      จำลอง "ข้อมูลอยู่ข้ามการปิดเปิดเบราว์เซอร์จริง" แต่พอสำหรับสอน API รูปแบบ set แล้ว get
      ในรันเดียวกัน ซึ่งเป็นรูปแบบแบบฝึกหัดที่ใช้ในแทร็กนี้)
   ══════════════════════════════════════════════════════════════════ */
'use strict';

var __lsStore = {};
var localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(__lsStore, k) ? __lsStore[k] : null; },
  setItem: function (k, v) { __lsStore[k] = String(v); },
  removeItem: function (k) { delete __lsStore[k]; },
  clear: function () { __lsStore = {}; },
  key: function (i) { var keys = Object.keys(__lsStore); return keys[i] !== undefined ? keys[i] : null; },
  get length() { return Object.keys(__lsStore).length; }
};

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

  function finish() {
    var testResults = (msg.tests || []).map(function (test) {
      if (test.type === 'log-includes') {
        return { label: test.label, pass: logs.some(function (l) { return l === String(test.expected); }) };
      }
      if (test.type === 'call') {
        try {
          var actual = (0, eval)(test.call);
          return { label: test.label, pass: JSON.stringify(actual) === JSON.stringify(test.expected), actual: actual };
        } catch (err) {
          return { label: test.label, pass: false, error: String(err && err.message || err) };
        }
      }
      return { label: test.label, pass: false };
    });
    console.log = origLog;
    self.postMessage({ jobId: msg.jobId, logs: logs, testResults: testResults, runtimeError: runtimeError });
  }

  try {
    /* eval แบบ indirect ((0, eval)) ให้รันใน global scope ของ worker นี้ (ไม่ใช่ local scope ของ
       ฟังก์ชันนี้) — จำเป็นสำหรับให้ฟังก์ชันที่ผู้เรียนประกาศ (function name(){}) เข้าถึงได้จาก
       การตรวจข้อสอบ (tests ที่ type 'call') ในขั้นตอนถัดไป */
    (0, eval)(msg.code || '');
  } catch (err) {
    runtimeError = String(err && err.message || err);
  }

  if (msg.settleMs > 0 && !runtimeError) setTimeout(finish, msg.settleMs);
  else finish();
};
