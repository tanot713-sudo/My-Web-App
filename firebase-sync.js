/* ══════════════════════════════════════════════════════════════════
   ตัวช่วยซิงก์ข้อมูลแบบเรียลไทม์ข้ามอุปกรณ์ผ่าน Firebase Realtime Database
   ใช้ร่วมกันได้หลายหน้า — แต่ละหน้าแค่บอก path ของตัวเอง (กันข้อมูลปนกัน)
   ต้องมี Google sign-in ก่อนอ่าน/เขียนได้เสมอ (บังคับด้วย Security Rules ฝั่ง Firebase
   ไม่ใช่แค่ฝั่งเว็บ) ข้อมูลจะซิงก์เข้าทุกอุปกรณ์ที่ล็อกอินบัญชีเดียวกันทันทีผ่าน WebSocket
   ไม่ต้องกดปุ่มซิงก์เอง ต่างจาก DriveSync ที่ใช้ในเครื่องมืออื่นของเว็บนี้ (ซึ่งเป็นการอัปโหลด/
   ดาวน์โหลดไฟล์เป็นรอบๆ ไม่ใช่การเชื่อมต่อค้างแบบนี้)
   ══════════════════════════════════════════════════════════════════ */
window.FirebaseSync = (function () {
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
      modulePromise = Promise.all([
        import('@firebase/app'),
        import('@firebase/auth'),
        import('@firebase/database')
      ]).then(function (mods) {
        var appMod = mods[0], authMod = mods[1], dbMod = mods[2];
        var app = appMod.initializeApp(firebaseConfig);
        var auth = authMod.getAuth(app);
        var db = dbMod.getDatabase(app);
        return { appMod: appMod, authMod: authMod, dbMod: dbMod, app: app, auth: auth, db: db };
      });
    }
    return modulePromise;
  }

  /* connect(basePath, opts) — เริ่มใช้งานเครื่องมือซิงก์สำหรับหน้านี้
     basePath: เช่น 'budget' — ข้อมูลของผู้ใช้แต่ละคนจะแยกตาม uid อัตโนมัติ (path จริง = basePath/uid/...)
     opts.onSignedIn(uid) / opts.onSignedOut() / opts.onStatus(text, cls) — callback แจ้งสถานะ */
  function connect(basePath, opts) {
    opts = opts || {};
    var state = { uid: null, db: null, dbMod: null, authMod: null, auth: null, basePath: basePath };
    if (opts.onStatus) opts.onStatus('⏳ กำลังเชื่อมต่อ…', '');
    loadFirebase().then(function (fb) {
      state.db = fb.db; state.dbMod = fb.dbMod; state.authMod = fb.authMod; state.auth = fb.auth;
      fb.authMod.onAuthStateChanged(fb.auth, function (user) {
        if (user) {
          state.uid = user.uid;
          if (opts.onStatus) opts.onStatus('✅ ซิงก์เรียลไทม์กับ ' + (user.email || 'บัญชีนี้') + ' แล้ว', 'ok');
          if (opts.onSignedIn) opts.onSignedIn(user.uid);
        } else {
          state.uid = null;
          if (opts.onStatus) opts.onStatus('ยังไม่ได้เชื่อมต่อ — กดปุ่มเชื่อมต่อเพื่อซิงก์ข้ามอุปกรณ์', '');
          if (opts.onSignedOut) opts.onSignedOut();
        }
      });
    }).catch(function (e) {
      if (opts.onStatus) opts.onStatus('❌ โหลดตัวซิงก์ไม่สำเร็จ: ' + (e && e.message ? e.message : e), 'err');
    });
    return {
      signIn: function () {
        return loadFirebase().then(function (fb) {
          var provider = new fb.authMod.GoogleAuthProvider();
          return fb.authMod.signInWithPopup(fb.auth, provider).catch(function (e) {
            /* แสดงข้อความให้ผู้ใช้เห็นตรงนี้แล้ว ไม่ throw ต่อ กัน unhandled promise rejection
               เพราะปุ่มเชื่อมต่อในหน้าที่เรียก signIn() ไม่ได้ผูก .catch() ไว้ */
            if (opts.onStatus) opts.onStatus('❌ เชื่อมต่อไม่สำเร็จ: ' + (e && e.message ? e.message : e), 'err');
          });
        });
      },
      signOut: function () {
        return loadFirebase().then(function (fb) { return fb.authMod.signOut(fb.auth); });
      },
      /* watch(subPath, callback) — ฟังการเปลี่ยนแปลงแบบเรียลไทม์ที่ basePath/uid/subPath
         callback(value) ถูกเรียกทันทีที่โหลดครั้งแรก แล้วเรียกซ้ำทุกครั้งที่มีการเปลี่ยนแปลง
         (จากอุปกรณ์ไหนก็ตามที่ล็อกอินบัญชีเดียวกัน) คืนฟังก์ชัน unwatch() ไว้ยกเลิกฟัง */
      watch: function (subPath, callback) {
        var unwatchFn = function () {};
        loadFirebase().then(function (fb) {
          if (!state.uid) return;
          var r = fb.dbMod.ref(fb.db, state.basePath + '/' + state.uid + '/' + subPath);
          unwatchFn = fb.dbMod.onValue(r, function (snap) { callback(snap.val()); });
        });
        return function () { unwatchFn(); };
      },
      /* write(subPath, value) — บันทึกค่าทับทั้งก้อนที่ basePath/uid/subPath ซิงก์เข้าทุกอุปกรณ์ทันที */
      write: function (subPath, value) {
        return loadFirebase().then(function (fb) {
          if (!state.uid) throw new Error('ยังไม่ได้เชื่อมต่อบัญชี');
          return fb.dbMod.set(fb.dbMod.ref(fb.db, state.basePath + '/' + state.uid + '/' + subPath), value);
        });
      },
      getUid: function () { return state.uid; }
    };
  }

  return { connect: connect };
})();
