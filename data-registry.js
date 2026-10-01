/* ══════════════════════════════════════════════════════════════════
   Tanot data registry (ROADMAP Phase 1) — รายชื่อข้อมูลทั้งเว็บ: อะไรซิงก์ขึ้น D1 / อะไรย้ายจาก github.io / อะไรเป็นแคชทิ้งได้
   โหลดก่อน tanot-data.js ใน <head> ทุกหน้า

   kind:
     'sync'  = ซิงก์ข้ามเครื่อง + ย้าย + สำรอง
     'local' = ค่าเฉพาะเครื่อง (ไม่ซิงก์) แต่ย้าย/สำรองด้วย — เช่นธีม, API key ที่หน้าเว็บบอกว่า "เก็บในเครื่องเท่านั้น"
     'cache' = แคชราคา/ข่าว/สถานะชั่วคราว — ไม่ซิงก์ ไม่ย้าย ไม่สำรอง
   mode (เฉพาะ sync):
     'blob' = ทั้งคีย์เป็นก้อนเดียว (ค่าเริ่มต้น) — แก้ทีหลังชนะ
     'list' = JSON array ของ object ที่มี idField — แยกรายการย่อยเป็นคนละ doc บันทึกพร้อมกันหลายเครื่องไม่ทับกัน
     'map'  = JSON object — แต่ละ property เป็นคนละ doc
   กฎแรกที่ตรงชนะ; คีย์ที่ไม่ตรงกฎใดเลย = 'local' (ย้ายให้ แต่ไม่ซิงก์ — ปลอดภัยไว้ก่อน)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LS = [
    // ── ภายในระบบซิงก์เอง / ด่านรหัสผ่าน ──
    { prefix: 'tanot-sync:', kind: 'cache' },
    { key: 'tanot:auth', kind: 'cache' },
    { prefix: 'tanot:migrate:', kind: 'cache' },

    // ── แคช (ดึงใหม่ได้เสมอ) ──
    { prefix: 'tanot:invest:cache:', kind: 'cache' },
    { prefix: 'tanot:invest:newscache:', kind: 'cache' },
    { key: 'tanot:invest:fxcache', kind: 'cache' },
    { key: 'tanot:invest:lottery:cache', kind: 'cache' },
    { key: 'tanot:invest:lottery:latest', kind: 'cache' },
    { key: 'tanot:invest:comm:lastKey', kind: 'cache' },
    { key: 'tanot:invest:news:lastChip', kind: 'cache' },

    // ── ค่าเฉพาะเครื่อง ──
    { prefix: 'ome:', kind: 'local' },
    { suffix: ':driveConnected', kind: 'local' },
    { key: 'tanot:aiChat:noBigModel', kind: 'local' },
    { key: 'tanot:asr:engine', kind: 'local' },
    { key: 'tanot:asrcloud:neuronUsage', kind: 'local' },
    { key: 'tanot:ocrengine', kind: 'local' },
    { key: 'tanot:market:live-config:v1', kind: 'local' }, // มี API key ที่ UI บอกว่าเก็บในเครื่องเท่านั้น — ห้ามส่งขึ้นเซิร์ฟเวอร์
    { key: 'tanot:barprep:ttsvoice', kind: 'local' },
    { key: 'tanot:dashboardDensity', kind: 'local' },
    { key: 'tanot:tableSizes:v2', kind: 'local' },
    { key: 'tanot:elec:inputs', kind: 'local' }, // ค่าที่กรอกในเครื่องคำนวณไฟฟ้า — กระดาษทดของเครื่องนี้ ไม่ต้องซิงก์

    // ── รายการที่เพิ่มได้จากหลายเครื่อง (แยกรายการย่อย) ──
    { key: 'tanot:insurance:policies', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'budget:records', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'budget:categories', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'budget:budgets', kind: 'sync', mode: 'map' },
    { key: 'tanot:invest:thstock', kind: 'sync', mode: 'list', idField: 'ts' },
    { key: 'tanot:invest:thjournal', kind: 'sync', mode: 'list', idField: 'ts' },
    { key: 'tanot:invest:globalstock', kind: 'sync', mode: 'list', idField: 'ts' },
    { key: 'tanot:invest:globaljournal', kind: 'sync', mode: 'list', idField: 'ts' },
    { key: 'tanot:invest:btc', kind: 'sync', mode: 'list', idField: 'ts' },
    { key: 'tanot:invest:btcjournal', kind: 'sync', mode: 'list', idField: 'ts' },
    { key: 'tanot:invest:gold', kind: 'sync', mode: 'list', idField: 'ts' },
    { key: 'tanot:invest:thaifund', kind: 'sync', mode: 'list', idField: 'ts' },
    { key: 'tanot:invest:spfund', kind: 'sync', mode: 'list', idField: 'ts' },
    { key: 'tanot:invest:govbond', kind: 'sync', mode: 'list', idField: 'ts' },
    { key: 'tanot:invest:gsblottery', kind: 'sync', mode: 'list', idField: 'ts' },
    { key: 'tanot:invest:baaclottery', kind: 'sync', mode: 'list', idField: 'ts' },
    { key: 'tanot:invest:bizplan', kind: 'sync', mode: 'list', idField: 'ts' },
    { key: 'lang-practice:srs', kind: 'sync', mode: 'map' },
    { key: 'lang-practice:progress', kind: 'sync', mode: 'map' },
    { key: 'lang-practice:notes', kind: 'sync', mode: 'map' },
    { key: 'lang-practice:wrong', kind: 'sync', mode: 'map' },
    { prefix: 'lbe:', suffixes: [':srs', ':notes', ':written', ':completed'], kind: 'sync', mode: 'map' },
    { prefix: 'lbe:', suffix: ':exams', kind: 'sync', mode: 'list', idField: 'date' },
    { key: 'legal:drafts', kind: 'sync', mode: 'map' },
    { key: 'legal:checked', kind: 'sync', mode: 'map' },

    // ── ข้อมูลผู้ใช้อื่นๆ ทั้งก้อน ──
    { prefix: 'tanot:', kind: 'sync' },
    { prefix: 'tanot.', kind: 'sync' },
    { prefix: 'budget:', kind: 'sync' },
    { prefix: 'lang-practice:', kind: 'sync' },
    { prefix: 'lbe:', kind: 'sync' },
    { prefix: 'legal:', kind: 'sync' }
  ];

  /* IndexedDB ของหน้าเดิม — schema ต้องตรงกับโค้ดของหน้านั้น (ใช้สร้างฐานข้อมูลตอนรับข้อมูลจากเครื่องอื่น
     บนเครื่องที่ยังไม่เคยเปิดหน้านั้น) ทุก store ต้องมี keyPath */
  var IDB = [
    { db: 'tanot-barprep', version: 1, stores: { notes: { keyPath: 'id' } }, sync: ['notes'] },
    // reports ใช้ id แบบ autoIncrement — แต่ละเครื่องนับ 1,2,3… เอง รายงานคนละฉบับจากคนละเครื่องได้ id ซ้ำแล้วทับกัน → ย้าย/สำรองเท่านั้น
    // (ซิงก์ได้เมื่อหน้าเปลี่ยนไปใช้ id ที่ไม่ซ้ำข้ามเครื่อง) ห้ามใส่ store แบบ autoIncrement ใน sync
    { db: 'tanot-report-dashboard', version: 2,
      stores: { current: { keyPath: 'id' }, reports: { keyPath: 'id', autoIncrement: true } }, sync: [] },
    { db: 'tanot-sim3d', version: 1, stores: { models: { keyPath: 'id', autoIncrement: true } }, sync: [] } // ไฟล์ 3D ไบนารี — ย้าย/สำรองเท่านั้น
  ];

  function ruleMatches(r, k) {
    if (r.key) return k === r.key;
    if (r.prefix && k.indexOf(r.prefix) !== 0) return false;
    if (r.suffix && k.slice(-r.suffix.length) !== r.suffix) return false;
    if (r.suffixes && !r.suffixes.some(function (s) { return k.slice(-s.length) === s; })) return false;
    return !!(r.prefix || r.suffix);
  }

  var memo = Object.create(null);
  function classify(k) {
    if (memo[k]) return memo[k];
    var out = { kind: 'local', mode: null };
    for (var i = 0; i < LS.length; i++) {
      if (ruleMatches(LS[i], k)) {
        out = { kind: LS[i].kind, mode: LS[i].kind === 'sync' ? (LS[i].mode || 'blob') : null, idField: LS[i].idField || null };
        break;
      }
    }
    memo[k] = out;
    return out;
  }

  function idbSpec(db) { for (var i = 0; i < IDB.length; i++) if (IDB[i].db === db) return IDB[i]; return null; }
  function idbSynced(db, store) {
    var s = idbSpec(db);
    return !!(s && s.sync.indexOf(store) !== -1 && s.stores[store] && !s.stores[store].autoIncrement);
  }

  window.TanotRegistry = { version: 1, ls: LS, idb: IDB, classify: classify, idbSpec: idbSpec, idbSynced: idbSynced };
})();
