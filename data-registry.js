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
    { prefix: 'tanot:learn:faces:', kind: 'cache' }, // หน้าการ์ดภาษาที่หน้าภาษาเขียนไว้ให้หน้าทบทวนวันนี้ — สร้างใหม่ได้ทุกครั้งที่เปิดหน้าภาษา

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
    { key: 'tanot:tax:ui', kind: 'local' }, // ปี/แท็บที่เปิดค้างในหน้าภาษี
    { prefix: 'tanot:push:', kind: 'cache' }, // tanot-push.js: ชุดการแจ้งเตือนที่เครื่องนี้ส่งขึ้น D1 ล่าสุด (hash) — สร้างใหม่ได้เสมอ ข้อมูลจริงอยู่ในตาราง reminders

    // ── บันทึกงานบำรุงรักษา (maintenance.html) — ต้องอยู่เหนือกฎ 'tanot:' ทั้งก้อนด้านล่าง ──
    { key: 'tanot:mnt:device', kind: 'cache' }, // รหัสเครื่องสำหรับ id ใบตรวจ/event — ห้ามย้าย/สำรอง ไม่งั้นกู้ backup ลงอีกเครื่องแล้วรหัสชนกัน
    { key: 'tanot:mnt:ui', kind: 'local' },
    { key: 'tanot:mnt:draft', kind: 'local' },
    { key: 'tanot:mnt:sites', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:mnt:assets', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:mnt:plans', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:mnt:settings', kind: 'sync' },

    // ── สุขภาพ (health.html) — 1 การบันทึก = 1 แถว · intake id = ยา|วัน|เวลา (กดกินพร้อมกัน 2 เครื่อง = แถวเดียวกัน) ──
    // ── เปรียบเทียบข้อมูล (compare.html) — เฉพาะงานให้คะแนนใบเสนอราคา (1 งาน = 1 แถว) · ไฟล์ที่เทียบในแท็บตาราง/เอกสารไม่เก็บ ──
    { key: 'tanot:compare:quotes', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:compare:ui', kind: 'local' },
    // ── งาน PowerPoint (slides.html) — 1 ชุดสไลด์ = 1 แถว (โครงเรื่อง+ธีม+ref รูปใน R2 ไม่มีไบนารี) · ui = ชุดที่เปิด/มุมมองต่อเครื่อง
    { key: 'tanot:slides:decks', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:slides:ui', kind: 'local' },
    // ── สร้างภาพ (image-gen.html) — ข้อมูลกำกับภาพ 1 ภาพ = 1 แถว (ตัวภาพอยู่ใน R2 ผ่าน /api/files?ns=images) · ui = ตัวกรอง/ค่าที่เลือกต่อเครื่อง
    { key: 'tanot:images:items', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:images:ui', kind: 'local' },
    { key: 'tanot:health:vitals', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:health:checkups', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:health:meds', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:health:intake', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:health:workouts', kind: 'sync', mode: 'list', idField: 'id' }, // หน้ากีฬา (sports-log.js) เขียน
    { key: 'tanot:health:ranges', kind: 'sync', mode: 'map' },
    { key: 'tanot:health:settings', kind: 'sync' },

    // ── ทำอาหาร stage 2 (cooking-plan.js) — สูตร 1 แถว · แผน 1 สัปดาห์ 1 แถว · รายการซื้อของ 1 รายการ 1 แถว + แถวติ๊ก/ราคาแยกรายเครื่อง ──
    // (ไม่ยุ่งกับ tanot:cooking:xp|streak|badges|progress|notes ของบทเรียนเดิม)
    { key: 'tanot:cooking:recipes', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:cooking:plans', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:cooking:shopping', kind: 'sync', mode: 'list', idField: 'id' },
    // ── คลังใบเสร็จ (receipts.html) — 1 ใบเสร็จ = 1 แถว · taxsummary = ยอดป้ายลดหย่อนต่อปีที่หน้าภาษีอ่าน (เขียนใหม่จากรายการได้เสมอ) ──
    { key: 'tanot:receipts:items', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:receipts:taxsummary', kind: 'sync' },

    // ── บันทึกรถ (car.html) — 1 คัน = 1 แถว · 1 ครั้งเข้าศูนย์/ซ่อม = 1 แถว (ผูกรถด้วย vehicleId) ──
    { key: 'tanot:car:vehicles', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:car:services', kind: 'sync', mode: 'list', idField: 'id' },

    // ── หนังสือ (books.html) — 1 เล่ม/1 บันทึกการอ่าน/1 ไฮไลต์/1 การ์ดทบทวน = 1 แถว · ui = local ──
    { key: 'tanot:books:items', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:books:logs', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:books:notes', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:books:cards', kind: 'sync', mode: 'list', idField: 'id' },
    { key: 'tanot:books:settings', kind: 'sync' },
    { key: 'tanot:books:ui', kind: 'local' },

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
    // ── ยุบรวมหน้าลงทุน (docs/invest-consolidation-design.md 3.2): ui = แท็บ/ช่วงกราฟล่าสุดต่อเครื่อง · nav = NAV ล่าสุดที่ผู้ใช้กรอกต่อกองทุน (1 กองทุน = 1 doc)
    //    · networth = snapshot มูลค่าสินทรัพย์วันละแถว (id = วันที่เวลาไทย — 2 เครื่องเขียนวันเดียวกัน = แถวเดียว) ──
    { key: 'tanot:invest:ui', kind: 'local' },
    { key: 'tanot:invest:nav', kind: 'sync', mode: 'map' },
    { key: 'tanot:invest:networth', kind: 'sync', mode: 'list', idField: 'd' },
    { key: 'lang-practice:srs', kind: 'sync', mode: 'map' },
    { key: 'lang-practice:progress', kind: 'sync', mode: 'map' },
    { key: 'lang-practice:notes', kind: 'sync', mode: 'map' },
    { key: 'lang-practice:wrong', kind: 'sync', mode: 'map' },
    { prefix: 'lbe:', suffixes: [':srs', ':notes', ':written', ':completed'], kind: 'sync', mode: 'map' },
    { prefix: 'lbe:', suffix: ':exams', kind: 'sync', mode: 'list', idField: 'date' },
    { key: 'legal:drafts', kind: 'sync', mode: 'map' },
    { key: 'legal:checked', kind: 'sync', mode: 'map' },
    { key: 'tanot:tax:years', kind: 'sync', mode: 'map' }, // หน้าภาษี: แต่ละปีภาษีเป็นคนละ doc
    { key: 'tanot:learn:xp', kind: 'sync', mode: 'list', idField: 'id' },     // learn-core.js: 1 แถวต่อ (วัน, เครื่อง, ที่มา)
    { key: 'tanot:learn:legacy', kind: 'sync', mode: 'list', idField: 'id' }, // learn-core.js: ยอดเดิมของแต่ละหน้า เครื่องละแถว
    { key: 'tanot:learn:settings', kind: 'sync' },                             // learn-core.js: เป้ารายวัน + วันพัก

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
    { db: 'tanot-sim3d', version: 1, stores: { models: { keyPath: 'id', autoIncrement: true } }, sync: [] }, // ไฟล์ 3D ไบนารี — ย้าย/สำรองเท่านั้น
    // บันทึกงานบำรุงรักษา: ใบสั่งงาน = header ที่ไม่แก้ (wo) + event ต่อท้าย (woev) — ดู docs/maintenance-design.md หัวข้อ 3.2
    { db: 'tanot-mnt', version: 1, stores: { wo: { keyPath: 'id' }, woev: { keyPath: 'id' } }, sync: ['wo', 'woev'] }
  ];
  // ผลตรวจบำรุงรักษา: 1 ฐานข้อมูลต่อปีของรอบ — ซิงก์เฉพาะปีปัจจุบัน ±1 เพราะ tanot-data อ่านทั้ง store ทุกครั้งที่โหลดหน้า
  // ปีที่เก่ากว่านั้นเป็นย้าย/สำรองเท่านั้น (ทั้ง 2 เครื่องมีครบแล้วตอนที่ยังเป็นปีปัจจุบัน) และหน้าเว็บล็อกให้แก้ไม่ได้
  var MNT_Y = new Date().getFullYear();
  for (var y = 2026; y <= MNT_Y + 1; y++) {
    IDB.push({ db: 'tanot-mnt-' + y, version: 1, stores: { insp: { keyPath: 'id' } }, sync: y >= MNT_Y - 1 ? ['insp'] : [] });
  }

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
