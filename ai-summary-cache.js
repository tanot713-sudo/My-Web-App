/* ══════════════════════════════════════════════════════════════════
   แคชผลสรุปหุ้นด้วย AI แบบ "คำนวณครั้งเดียว อ่านซ้ำได้ฟรี" — ผ่าน Firebase Realtime Database
   (โปรเจกต์เดียวกับที่หน้ารายรับ-รายจ่าย (budget.html) ใช้ซิงก์ข้อมูลอยู่แล้ว คนละ path กัน คนละ
   Firebase App instance กัน (ชื่อ 'aiSummaryCache') กันชนกันเผื่อวันหลังโหลดทั้งสองตัวพร้อมกันในหน้าเดียว)

   ใช้โดย: invest-global-stock.js / invest-bitcoin.js / invest-gold.js / invest-commodities.js
   (ทุกหน้าที่มีปุ่ม "สรุปหุ้นด้วย AI" ที่รันโมเดลในเครื่องผู้ใช้เองผ่าน ai-chat-worker.js)

   หลักการ: ผู้ใช้คนแรกของวันที่กดสรุปหุ้นตัวหนึ่ง จะเป็นคนรันโมเดลในเครื่องตัวเองตามปกติ (เหมือนเดิมทุก
   ประการ ไม่มีอะไรเปลี่ยนสำหรับคนแรก) — แต่พอสรุปสำเร็จ จะแอบบันทึกผลลัพธ์ไว้ใน Firebase ให้ด้วย (best-effort
   ไม่บล็อกอะไร) ผู้ใช้คนถัดไปที่กดสรุปหุ้น "ตัวเดียวกัน วันเดียวกัน ภาษาเดียวกัน" จะได้อ่านผลที่แคชไว้ทันที
   โดยไม่ต้องโหลด/รันโมเดลในเครื่องเลย — แก้ปัญหาความเปราะบางของ WASM (แรม/พื้นที่ดิสก์ไม่พอ) ให้คนส่วนใหญ่
   ได้จริง เพราะมีแค่คนแรกของแต่ละวัน/หุ้นเท่านั้นที่ต้องพึ่งการรันโมเดลในเครื่อง

   ข้อจำกัดที่ตั้งใจ (เพื่อความง่าย เหมือนรูปแบบอื่นๆ ในเว็บนี้):
   - แคชแยกตาม "วันที่ปฏิทินของเครื่องผู้ใช้" (ไม่ใช่เวลาตลาดปิดจริง) — ผลสรุปอาจไม่ตรงกับราคาล่าสุดเป๊ะถ้า
     ราคาขยับแรงระหว่างวัน แต่ระบุไว้ชัดเจนในหน้าเว็บว่าเป็นผลที่แคชไว้ (ดู "cached" badge ที่แต่ละหน้าเพิ่มเอง)
   - เขียนได้ "ครั้งเดียวต่อช่อง" เท่านั้น (บังคับด้วย Security Rules ฝั่ง Firebase — ดู database.rules.json)
     กันไม่ให้ใครมาทับ/ป่วนแคชที่มีอยู่แล้ว คนแรกที่เขียนสำเร็จ ชนะ ไม่มีการอัปเดตทับภายในวันเดียวกัน
   - อ่าน/เขียนสาธารณะ ไม่ต้องล็อกอิน (ต่างจาก budget.html ที่บังคับ Google sign-in) เพราะข้อมูลไม่อ่อนไหว
     เป็นแค่ข้อความสรุปทั่วไปจากตัวเลขที่คำนวณไว้แล้ว ไม่ใช่ข้อมูลส่วนตัวของใคร
   - อ่าน/เขียนพังแบบไหนก็ตาม (ยังไม่ได้ deploy กติกาใหม่, ออฟไลน์, โควตาเต็ม ฯลฯ) โค้ดฝั่งนี้ดักจับให้หมด
     คืนค่า null/เงียบๆ เสมอ ไม่ throw ต่อ — หน้าที่เรียกใช้จึงตกไป "คำนวณสดตามปกติ" ได้เสมอ เหมือนไม่มีแคชเลย
     (ปลอดภัย แม้ยังไม่ได้ deploy database.rules.json เวอร์ชันใหม่ก็ใช้งานหน้าเว็บได้ปกติ แค่ยังไม่ได้อานิสงส์
     ของแคชเท่านั้น) */
window.AiSummaryCache = (function () {
  'use strict';

  var firebaseConfig = {
    apiKey: "AIzaSyC_Pzrv3erZt5zqoGSMNultfQZTJLsm40A",
    authDomain: "tanot-budget.firebaseapp.com",
    databaseURL: "https://tanot-budget-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tanot-budget",
    storageBucket: "tanot-budget.firebasestorage.app",
    messagingSenderId: "28211092865",
    appId: "1:28211092865:web:9f17b1f7a6c9a4d9929c80"
  };

  var modulePromise = null;
  function loadFirebase() {
    if (!modulePromise) {
      modulePromise = Promise.all([import('@firebase/app'), import('@firebase/database')]).then(function (mods) {
        var appMod = mods[0], dbMod = mods[1];
        var app = appMod.initializeApp(firebaseConfig, 'aiSummaryCache');
        var db = dbMod.getDatabase(app);
        return { dbMod: dbMod, db: db };
      });
    }
    return modulePromise;
  }

  /* คีย์ของ Firebase Realtime Database ห้ามมี . # $ [ ] / หรือช่องว่าง — แทนที่ด้วย _ ให้หมด
     (สัญลักษณ์หุ้น/โภคภัณฑ์ส่วนใหญ่ในเว็บนี้ไม่ติดปัญหานี้อยู่แล้ว เช่น AAPL, BTC-USD, GC=F แต่กันไว้ก่อน
     เผื่อสัญลักษณ์แปลกๆ ในอนาคต) */
  function sanitizeKey(s) {
    var v = String(s || '').replace(/[.#$\[\]\/\s]+/g, '_').slice(0, 120);
    return v || '_';
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function pathFor(page, symbol, lang) {
    return 'aiSummaryCache/' + sanitizeKey(page) + '/' + sanitizeKey(symbol) + '/' + todayKey() + '/' + sanitizeKey(lang);
  }

  /* read(page, symbol, lang) -> Promise<{text,ts}|null>
     คืน null เสมอถ้าไม่มี/อ่านไม่ได้/พัง (ไม่มีวัน reject) — เรียกแล้วเช็คแค่ null หรือไม่พอ */
  function read(page, symbol, lang) {
    return loadFirebase().then(function (fb) {
      var r = fb.dbMod.ref(fb.db, pathFor(page, symbol, lang));
      return fb.dbMod.get(r).then(function (snap) {
        var v = snap.val();
        return (v && typeof v.text === 'string' && v.text) ? v : null;
      });
    }).catch(function () { return null; });
  }

  /* write(page, symbol, lang, {text}) — บันทึกแบบ best-effort ล้วนๆ (fire-and-forget) ไม่คืนอะไรให้รอ
     ไม่ต้อง .catch() ฝั่งผู้เรียก — เขียนไม่ผ่าน (เช่นมีคนเขียนไปแล้วตามกติกา "ครั้งเดียว", ยังไม่ได้ deploy
     กติกาใหม่, ออฟไลน์) ก็แค่เงียบๆ ไป ไม่กระทบผู้ใช้ที่กำลังดูผลสรุปสดอยู่ตรงหน้าเลย */
  function write(page, symbol, lang, data) {
    if (!data || !data.text) return;
    loadFirebase().then(function (fb) {
      var r = fb.dbMod.ref(fb.db, pathFor(page, symbol, lang));
      return fb.dbMod.set(r, { text: data.text, ts: Date.now() });
    }).catch(function () {});
  }

  return { read: read, write: write };
})();
