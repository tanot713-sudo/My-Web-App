/* ══════════════════════════════════════════════════════════════════
   Tanot — coding.js
   สอนเขียนโค้ด: JavaScript (รันจริงใน Web Worker แยก sandbox + ตรวจ test case
   อัตโนมัติ) และ HTML/CSS (พรีวิวสดในกรอบ iframe แบบ sandbox) — บทเรียนไล่ระดับ
   คำอธิบาย → แบบฝึกหัด ปลดล็อกตามลำดับเมื่อทำแบบฝึกหัดก่อนหน้าผ่าน

   ⚠️ ความปลอดภัย: โค้ด JS ของผู้เรียนรันใน Web Worker แยก (ไม่มีสิทธิ์เข้าถึง
   document/localStorage ของหน้าเว็บหลักโดยธรรมชาติของ Worker เอง) มี timeout
   ฆ่าลูปไม่รู้จบได้จริง — ดูรายละเอียดที่ code-runner-worker.js
   โค้ด HTML พรีวิวใน <iframe sandbox="allow-scripts"> (ไม่มี allow-same-origin
   จึงเข้าถึง cookie/localStorage ของหน้าเว็บหลักไม่ได้เช่นกัน) ส่วนการตรวจแบบฝึกหัด
   HTML ใช้ DOMParser แยกต่างหาก (แค่ parse โครงสร้าง ไม่ execute อะไรเลย ปลอดภัย
   กว่าการเข้าไปอ่านค่าจาก iframe ที่ render จริงซึ่งติดข้อจำกัด cross-origin อยู่แล้ว)
   ══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ══════════════════════════════════════════════════════════════════
   ข้อมูลบทเรียน — แต่ละ track มี kind ('js' หรือ 'html') กำหนดว่าจะใช้ตัวรัน/ตัวตรวจแบบไหน
   items[0] คือ "คำอธิบาย" (concept) ปลดล็อกเสมอ, items[1..] คือแบบฝึกหัด ปลดล็อกตามลำดับ
   ══════════════════════════════════════════════════════════════════ */
var TRACKS = [
  {
    id: 'js-variables', kind: 'js', label: 'ตัวแปร (JS)', labelEn: 'Variables (JS)',
    concept: {
      explain: 'ตัวแปร (variable) คือที่เก็บค่าไว้ใช้ภายหลัง สร้างด้วยคำว่า let แล้วตั้งชื่อ ตามด้วย = และค่าที่ต้องการเก็บ ปิดท้ายด้วย ; ถ้าค่าที่เก็บไม่ต้องเปลี่ยนอีกเลยให้ใช้ const แทน let — สั่งพิมพ์ค่าออกมาดูด้วย console.log(...)',
      example: 'let name = "สมชาย";\nlet age = 25;\nconsole.log(name);\nconsole.log(age);'
    },
    exercises: [
      {
        title: 'เปลี่ยนค่าตัวแปร',
        instructions: 'เปลี่ยนค่า score ให้เป็น 10 แล้วกด "รัน" — ผลลัพธ์ควรมีเลข 10 ปรากฏ',
        starter: 'let score = 0;\nconsole.log(score);',
        tests: [{ type: 'log-includes', expected: '10', label: 'console.log(score) ต้องออกมาเป็น 10' }]
      },
      {
        title: 'เพิ่มค่าตัวแปร',
        instructions: 'เพิ่มบรรทัด count = count + 1; อีก 2 ครั้งก่อน console.log — ผลลัพธ์ควรได้ 3',
        starter: 'let count = 1;\n\nconsole.log(count);',
        tests: [{ type: 'log-includes', expected: '3', label: 'console.log(count) ต้องออกมาเป็น 3' }]
      },
      {
        title: 'ใช้ const คำนวณ',
        instructions: 'แก้บรรทัดสุดท้ายให้เป็น console.log(pi * 2) แทน — ผลลัพธ์ควรได้ 6.28',
        starter: 'const pi = 3.14;\nconsole.log(pi);',
        tests: [{ type: 'log-includes', expected: '6.28', label: 'console.log(pi * 2) ต้องออกมาเป็น 6.28' }]
      },
      {
        title: 'รวมข้อความด้วย +',
        instructions: 'รวม firstName กับ lastName เข้าด้วยกันด้วย + แล้ว console.log ผลลัพธ์ — ควรเห็น "สมชายใจดี"',
        starter: 'let firstName = "สมชาย";\nlet lastName = "ใจดี";\nconsole.log(firstName);',
        tests: [{ type: 'log-includes', expected: 'สมชายใจดี', label: 'ต้อง console.log ออกมาเป็น "สมชายใจดี"' }]
      }
    ]
  },
  {
    id: 'js-conditionals', kind: 'js', label: 'เงื่อนไข (JS)', labelEn: 'Conditionals (JS)',
    concept: {
      explain: 'if/else ใช้ตัดสินใจว่าจะรันโค้ดส่วนไหนตามเงื่อนไขที่กำหนด — ถ้าเงื่อนไขในวงเล็บเป็นจริงจะรันส่วน if ถ้าไม่จริงจะรันส่วน else แทน ใช้ === เปรียบเทียบค่าเท่ากัน, >= มากกว่าหรือเท่ากับ, % หาเศษจากการหาร (เช็คเลขคู่/คี่ได้)',
      example: 'let age = 20;\nif (age >= 18) {\n  console.log("ผู้ใหญ่");\n} else {\n  console.log("เด็ก");\n}'
    },
    exercises: [
      {
        title: 'if / else พื้นฐาน',
        instructions: 'เปลี่ยนค่า age เป็น 20 แล้วรันดู — ควรเห็นคำว่า "ผู้ใหญ่"',
        starter: 'let age = 15;\nif (age >= 18) {\n  console.log("ผู้ใหญ่");\n} else {\n  console.log("เด็ก");\n}',
        tests: [{ type: 'log-includes', expected: 'ผู้ใหญ่', label: 'ต้อง console.log("ผู้ใหญ่")' }]
      },
      {
        title: 'เช็คเลขคู่/คี่',
        instructions: 'เปลี่ยนค่า num ให้เป็นเลขคู่ (เช่น 4) แล้วรันดู — ควรเห็นคำว่า "เลขคู่"',
        starter: 'let num = 7;\nif (num % 2 === 0) {\n  console.log("เลขคู่");\n} else {\n  console.log("เลขคี่");\n}',
        tests: [{ type: 'log-includes', expected: 'เลขคู่', label: 'ต้อง console.log("เลขคู่")' }]
      },
      {
        title: 'else if หลายเงื่อนไข',
        instructions: 'เปลี่ยนค่า score ให้ได้เกรด A (ตั้งแต่ 80 ขึ้นไป) แล้วรันดู',
        starter: 'let score = 55;\nif (score >= 80) {\n  console.log("A");\n} else if (score >= 60) {\n  console.log("B");\n} else {\n  console.log("C");\n}',
        tests: [{ type: 'log-includes', expected: 'A', label: 'ต้อง console.log("A")' }]
      },
      {
        title: 'เปรียบเทียบค่า',
        instructions: 'แก้ค่า a หรือ b ให้ a มากกว่า b แล้วรันดู — ควรเห็น "a มากกว่า"',
        starter: 'let a = 5;\nlet b = 8;\nif (a > b) {\n  console.log("a มากกว่า");\n} else {\n  console.log("b มากกว่าหรือเท่ากับ");\n}',
        tests: [{ type: 'log-includes', expected: 'a มากกว่า', label: 'ต้อง console.log("a มากกว่า")' }]
      }
    ]
  },
  {
    id: 'js-loops', kind: 'js', label: 'ลูป (JS)', labelEn: 'Loops (JS)',
    concept: {
      explain: 'ลูป (loop) ใช้วนทำงานซ้ำๆ โดยไม่ต้องเขียนโค้ดซ้ำหลายรอบ — for loop มี 3 ส่วนในวงเล็บ: ค่าเริ่มต้น (let i = 1), เงื่อนไขที่ต้องเป็นจริงถึงจะวนต่อ (i <= 5), และสิ่งที่ทำหลังแต่ละรอบ (i++ คือเพิ่มค่าทีละ 1) — ส่วน while loop จะวนต่อไปเรื่อยๆ ตราบใดที่เงื่อนไขในวงเล็บยังเป็นจริงอยู่',
      example: 'for (let i = 1; i <= 5; i++) {\n  console.log(i);\n}'
    },
    exercises: [
      {
        title: 'for loop พื้นฐาน',
        instructions: 'เปลี่ยน i <= 5 เป็น i <= 10 แล้วรันดู — ควรเห็นเลข 10 ปรากฏในผลลัพธ์ด้วย',
        starter: 'for (let i = 1; i <= 5; i++) {\n  console.log(i);\n}',
        tests: [{ type: 'log-includes', expected: '10', label: 'ผลลัพธ์ต้องมีเลข 10' }]
      },
      {
        title: 'รวมผลรวมด้วยลูป',
        instructions: 'เติมโค้ด sum = sum + i; ไว้ในลูป (บรรทัดว่างตรงกลาง) แล้วรันดู — ผลรวม 1+2+3+4+5 ควรได้ 15',
        starter: 'let sum = 0;\nfor (let i = 1; i <= 5; i++) {\n  \n}\nconsole.log(sum);',
        tests: [{ type: 'log-includes', expected: '15', label: 'console.log(sum) ต้องออกมาเป็น 15' }]
      },
      {
        title: 'while loop นับถอยหลัง',
        instructions: 'รันโค้ดนี้ดูก่อน สังเกตการทำงานของ while แล้วเปลี่ยนค่า count เริ่มต้นจาก 5 เป็น 3 — ควรเห็นเลข 3 ปรากฏเป็นตัวแรก',
        starter: 'let count = 5;\nwhile (count > 0) {\n  console.log(count);\n  count = count - 1;\n}',
        tests: [{ type: 'log-includes', expected: '3', label: 'ผลลัพธ์ต้องมีเลข 3 ปรากฏ' }]
      },
      {
        title: 'สูตรคูณด้วยลูป',
        instructions: 'เปลี่ยน i <= 3 เป็น i <= 5 เพื่อพิมพ์สูตรคูณแม่ 3 ตั้งแต่ 3×1 ถึง 3×5 — ผลลัพธ์ควรมีเลข 15 ปรากฏด้วย (3×5)',
        starter: 'let num = 3;\nfor (let i = 1; i <= 3; i++) {\n  console.log(num * i);\n}',
        tests: [{ type: 'log-includes', expected: '15', label: 'ผลลัพธ์ต้องมีเลข 15 (3×5)' }]
      }
    ]
  },
  {
    id: 'html-basics', kind: 'html', label: 'โครงสร้าง HTML', labelEn: 'HTML Basics',
    concept: {
      explain: 'HTML คือการ "ห่อ" ข้อความด้วยแท็ก (tag) เปิด-ปิด เช่น <h1>หัวข้อ</h1> — เบราว์เซอร์จะแปลแท็กเหล่านี้เป็นหน้าเว็บที่เห็นทางขวา ลองแก้โค้ดด้านล่างแล้วดูผลด้านขวาได้เลย เปลี่ยนแบบ real-time',
      example: '<h1>สวัสดี</h1>\n<p>นี่คือย่อหน้าแรกของฉัน</p>'
    },
    exercises: [
      {
        title: 'สร้างหัวข้อ',
        instructions: 'ใส่ข้อความ "ยินดีต้อนรับ" ไว้ในแท็ก <h1>...</h1>',
        starter: '<h1></h1>',
        tests: [{ type: 'html-text', selector: 'h1', includes: 'ยินดีต้อนรับ', label: '<h1> ต้องมีข้อความ "ยินดีต้อนรับ"' }]
      },
      {
        title: 'เพิ่มย่อหน้า',
        instructions: 'เพิ่มแท็ก <p>...</p> ต่อจาก h1 ใส่ข้อความอะไรก็ได้อย่างน้อย 1 ตัวอักษร',
        starter: '<h1>ยินดีต้อนรับ</h1>\n<p></p>',
        tests: [{ type: 'html-nonempty', selector: 'p', label: '<p> ต้องมีข้อความอยู่ข้างใน' }]
      },
      {
        title: 'ตัวหนา',
        instructions: 'แก้ <span> ให้เป็น <strong> (ทำให้คำว่า "สำคัญ" เป็นตัวหนา)',
        starter: '<p>ข้อความนี้ <span>สำคัญ</span> มาก</p>',
        tests: [{ type: 'html-text', selector: 'strong, b', includes: 'สำคัญ', label: 'ต้องมีแท็ก <strong> หรือ <b> ครอบคำว่า "สำคัญ"' }]
      },
      {
        title: 'สร้างลิงก์',
        instructions: 'สร้างลิงก์ไปที่ https://www.google.com ด้วยแท็ก <a href="...">ข้อความ</a>',
        starter: '<a></a>',
        tests: [{ type: 'html-attr', selector: 'a', attr: 'href', includes: 'google.com', label: '<a> ต้องมี href ที่มีคำว่า "google.com"' }]
      }
    ]
  },
  {
    id: 'html-css', kind: 'html', label: 'จัดรูปแบบด้วย CSS', labelEn: 'CSS Styling',
    concept: {
      explain: 'CSS ใช้กำหนดหน้าตา (สี ขนาด ระยะห่าง) ให้แท็ก HTML — วิธีง่ายสุดคือใส่ attribute style="..." ในแท็กโดยตรง เขียนเป็น property: value; คั่นด้วย ; ถ้ามีหลายอัน เช่น style="color: blue; font-size: 24px;"',
      example: '<h1 style="color: blue; font-size: 28px;">หัวข้อสีน้ำเงิน</h1>'
    },
    exercises: [
      {
        title: 'เปลี่ยนสีตัวอักษร',
        instructions: 'เพิ่ม style="color: red;" ในแท็ก h1 ให้ตัวอักษรเป็นสีแดง',
        starter: '<h1>สวัสดี</h1>',
        tests: [{ type: 'html-attr', selector: 'h1', attr: 'style', includes: 'red', label: '<h1> ต้องมี style ที่มีคำว่า "red"' }]
      },
      {
        title: 'ใส่สีพื้นหลัง',
        instructions: 'เพิ่ม style="background-color: yellow;" ให้ <p>',
        starter: '<p>ข้อความนี้ควรมีพื้นหลังสีเหลือง</p>',
        tests: [{ type: 'html-attr', selector: 'p', attr: 'style', includes: 'yellow', label: '<p> ต้องมี style ที่มีคำว่า "yellow"' }]
      },
      {
        title: 'ขยายขนาดตัวอักษร',
        instructions: 'เพิ่ม font-size: 30px; ใน style ของ <p> ให้ตัวอักษรใหญ่ขึ้น',
        starter: '<p style="">ข้อความนี้ควรตัวใหญ่ขึ้น</p>',
        tests: [{ type: 'html-attr', selector: 'p', attr: 'style', includes: 'font-size', label: '<p> ต้องมี font-size ใน style' }]
      },
      {
        title: 'จัดข้อความกึ่งกลาง',
        instructions: 'เพิ่ม text-align: center; ใน style ของ h1',
        starter: '<h1 style="">หัวข้อนี้ควรอยู่กึ่งกลาง</h1>',
        tests: [{ type: 'html-attr', selector: 'h1', attr: 'style', includes: 'center', label: '<h1> ต้องมี text-align: center ใน style' }]
      }
    ]
  }
];

function trackById(id) { for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return TRACKS[i]; return TRACKS[0]; }

/* ══════════════════════════════════════════════════════════════════
   ความคืบหน้า + ปลดล็อกตามลำดับ (แพทเทิร์นเดียวกับ typing.js)
   itemIndex: 0 = คำอธิบาย (ปลดล็อกเสมอ), 1..N = แบบฝึกหัด
   ══════════════════════════════════════════════════════════════════ */
var PROGRESS_KEY = 'tanot:coding:progress';
function loadProgress() { try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch (e) { return {}; } }
function saveProgress(p) { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) {} }
function progressKey(trackId, itemIndex) { return trackId + '::' + itemIndex; }

function isUnlocked(track, itemIndex, progress) {
  if (itemIndex <= 1) return true; /* คำอธิบาย + แบบฝึกหัดข้อแรก ปลดล็อกเสมอ */
  return !!progress[progressKey(track.id, itemIndex - 1)];
}

/* บันทึกโค้ดที่พิมพ์ค้างไว้ต่อ item กันหายตอนรีเฟรช/สลับหน้า (แยกจากสถานะผ่าน/ไม่ผ่าน) */
var DRAFT_KEY = 'tanot:coding:draft';
function loadDrafts() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; } catch (e) { return {}; } }
function saveDraft(trackId, itemIndex, code) {
  try {
    var d = loadDrafts();
    d[progressKey(trackId, itemIndex)] = code;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch (e) {}
}

/* ══════════════════════════════════════════════════════════════════
   ตัวรันโค้ด JS — spawn Worker ใหม่ทุกครั้ง + timeout ฆ่าลูปไม่รู้จบ (เหตุผลดูใน
   code-runner-worker.js) คืนค่าเป็น Promise เดียว ไม่ว่าจะจบแบบไหน (สำเร็จ/error/timeout)
   ══════════════════════════════════════════════════════════════════ */
var RUN_TIMEOUT_MS = 5000;
var jobSeq = 0;
function runJsCode(code, tests) {
  return new Promise(function (resolve) {
    var worker;
    try { worker = new Worker('./code-runner-worker.js'); }
    catch (e) { resolve({ runtimeError: 'สร้าง Worker ไม่สำเร็จ: ' + (e && e.message ? e.message : e) }); return; }
    var jobId = ++jobSeq;
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      worker.terminate();
      resolve({ timeout: true });
    }, RUN_TIMEOUT_MS);
    worker.onmessage = function (e) {
      if (!e.data || e.data.jobId !== jobId || done) return;
      done = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = function (e) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker.terminate();
      resolve({ runtimeError: (e && e.message) || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ' });
    };
    worker.postMessage({ jobId: jobId, code: code, tests: tests || [] });
  });
}

/* ตรวจแบบฝึกหัด HTML ด้วย DOMParser — parse โครงสร้างเฉยๆ ไม่ execute อะไรเลย (ไม่ต้องพึ่ง
   iframe ที่ render จริง ซึ่งจะติดข้อจำกัด cross-origin เวลาพยายามอ่านค่ากลับจากฝั่ง parent
   เพราะตั้งใจไม่ใส่ allow-same-origin ให้ iframe พรีวิว) */
function checkHtmlTests(code, tests) {
  var doc;
  try { doc = new DOMParser().parseFromString(code, 'text/html'); }
  catch (e) { return (tests || []).map(function (t) { return { label: t.label, pass: false }; }); }
  return (tests || []).map(function (test) {
    try {
      var el = doc.querySelector(test.selector);
      if (!el) return { label: test.label, pass: false };
      if (test.type === 'html-text') return { label: test.label, pass: (el.textContent || '').indexOf(test.includes) !== -1 };
      if (test.type === 'html-nonempty') return { label: test.label, pass: (el.textContent || '').trim().length > 0 };
      if (test.type === 'html-attr') return { label: test.label, pass: ((el.getAttribute(test.attr) || '')).indexOf(test.includes) !== -1 };
      return { label: test.label, pass: false };
    } catch (e) { return { label: test.label, pass: false }; }
  });
}

/* ══════════════════════════════════════════════════════════════════
   ภาษา UI (ไทย/อังกฤษ)
   ══════════════════════════════════════════════════════════════════ */
var UI_LANG_KEY = 'tanot:codinglang';
function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
function setUILang(l) { try { localStorage.setItem(UI_LANG_KEY, l); } catch (e) {} }

var I18N = {
  th: {
    pageTitle: 'การเขียนโค้ด', crumbResp: 'งานที่รับผิดชอบ', crumbCoding: 'การเขียนโค้ด',
    conceptLabel: 'คำอธิบาย', runBtn: '▶ รัน', running: 'กำลังรัน…',
    outputLabel: 'ผลลัพธ์ (console.log)', previewLabel: 'พรีวิว', testsLabel: 'ผลตรวจ',
    noOutput: '(ยังไม่มีผลลัพธ์ — ลองกดรันดู)', timeoutMsg: 'โค้ดรันนานเกินไป (อาจมีลูปไม่รู้จบ) — ระบบหยุดให้แล้ว ลองตรวจสอบเงื่อนไขการวนซ้ำดูอีกครั้ง',
    allPassed: '✅ ผ่านหมดทุกข้อ! ปลดล็อกข้อถัดไปแล้ว', notAllPassed: 'ยังไม่ผ่านครบทุกข้อ ลองแก้โค้ดแล้วรันใหม่อีกครั้ง',
    lockedMsg: 'ข้อนี้ยังไม่ปลดล็อก — ทำข้อก่อนหน้าให้ผ่านก่อน',
    exerciseTitle: 'แบบฝึกหัด {n}', tryExample: 'ลองรันตัวอย่างนี้ดูได้เลย แล้วลองแก้โค้ดเล่นดู',
    openFullBtn: '🔗 เปิดดูเต็มจอ',
    toastTrackDone: 'จบแทร็ก "{track}" แล้ว! 🎉', toastBadge: 'ได้เหรียญตรา "{badge}"!',
    toastLevelUp: 'เลเวลอัป! ระดับ {level} — {title}'
  },
  en: {
    pageTitle: 'Coding', crumbResp: 'Responsibilities', crumbCoding: 'Coding',
    conceptLabel: 'Explanation', runBtn: '▶ Run', running: 'Running…',
    outputLabel: 'Output (console.log)', previewLabel: 'Preview', testsLabel: 'Test Results',
    noOutput: '(No output yet — try clicking Run)', timeoutMsg: 'Your code took too long to run (possibly an infinite loop) — it was stopped automatically. Check your loop condition.',
    allPassed: '✅ All tests passed! Next exercise unlocked.', notAllPassed: "Not all tests passed yet — fix your code and run again.",
    lockedMsg: 'This exercise is locked — pass the previous one first.',
    exerciseTitle: 'Exercise {n}', tryExample: 'Try running this example, then experiment with the code.',
    openFullBtn: '🔗 Open Fullscreen',
    toastTrackDone: 'Track "{track}" complete! 🎉', toastBadge: 'Badge earned: "{badge}"!',
    toastLevelUp: 'Level up! Level {level} — {title}'
  }
};
function t(key, vars) {
  var l = getUILang();
  var s = (I18N[l] && I18N[l][key] !== undefined) ? I18N[l][key] : (I18N.th[key] !== undefined ? I18N.th[key] : key);
  if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
  return s;
}

/* ══════════════════════════════════════════════════════════════════
   Gamification — เลเวล/XP/สตรีค/เหรียญตรา (ผู้ใช้ขอ "ทำให้เหมือนเล่นเกม")
   ให้รางวัลเฉพาะตอน "ผ่านครั้งแรก" ของแต่ละแบบฝึกหัด (เช็คจาก progress เดิมก่อนบันทึกทับ)
   กันไม่ให้ฟาร์ม XP ด้วยการกดรันซ้ำข้อเดิมที่ผ่านไปแล้ว
   ══════════════════════════════════════════════════════════════════ */
var XP_KEY = 'tanot:coding:xp';
var STREAK_KEY = 'tanot:coding:streak';
var BADGES_KEY = 'tanot:coding:badges';
var XP_PER_EXERCISE = 20;
var XP_PER_TRACK_BONUS = 50;
var XP_PER_LEVEL = 50;

function loadXp() { try { return parseInt(localStorage.getItem(XP_KEY), 10) || 0; } catch (e) { return 0; } }
function saveXp(xp) { try { localStorage.setItem(XP_KEY, String(xp)); } catch (e) {} }
function levelFromXp(xp) { return 1 + Math.floor(xp / XP_PER_LEVEL); }
function xpIntoLevel(xp) { return xp % XP_PER_LEVEL; }
function levelTitle(level) {
  var th = ['มือใหม่หัดโค้ด', 'นักเรียนโค้ด', 'นักเขียนโค้ดฝึกหัด', 'โค้ดเดอร์รุ่นเยาว์', 'โค้ดเดอร์มือโปร', 'เซียนโค้ด'];
  var en = ['Code Newbie', 'Code Student', 'Junior Coder', 'Rising Coder', 'Pro Coder', 'Code Master'];
  var idx = Math.min(Math.floor((level - 1) / 2), th.length - 1);
  return getUILang() === 'en' ? en[idx] : th[idx];
}

/* วันที่แบบ local (ไม่ใช้ ISO/UTC) กันวันเลื่อนข้ามคืนผิดโซนเวลาไทย */
function todayStr() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function dateStrOffset(days) { var d = new Date(); d.setDate(d.getDate() + days); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function loadStreak() { try { return JSON.parse(localStorage.getItem(STREAK_KEY)) || { count: 0, lastDate: '' }; } catch (e) { return { count: 0, lastDate: '' }; } }
function saveStreak(s) { try { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); } catch (e) {} }
function bumpStreak() {
  var s = loadStreak();
  var today = todayStr();
  if (s.lastDate === today) return s; /* วันนี้ทำแบบฝึกหัดผ่านไปแล้ว ไม่นับซ้ำ */
  s.count = (s.lastDate === dateStrOffset(-1)) ? s.count + 1 : 1;
  s.lastDate = today;
  saveStreak(s);
  return s;
}

function loadBadges() { try { return JSON.parse(localStorage.getItem(BADGES_KEY)) || []; } catch (e) { return []; } }
function saveBadges(b) { try { localStorage.setItem(BADGES_KEY, JSON.stringify(b)); } catch (e) {} }

var BADGE_DEFS = [
  { id: 'first-pass', icon: '🥉', th: 'ก้าวแรก', en: 'First Step' },
  { id: 'track-js-variables', icon: '🔤', th: 'เจ้าแห่งตัวแปร', en: 'Variable Master' },
  { id: 'track-js-conditionals', icon: '🔀', th: 'เซียนเงื่อนไข', en: 'Logic Master' },
  { id: 'track-js-loops', icon: '🔁', th: 'นักวนซ้ำ', en: 'Loop Master' },
  { id: 'track-html-basics', icon: '🧱', th: 'สถาปนิก HTML', en: 'HTML Architect' },
  { id: 'track-html-css', icon: '🎨', th: 'ดีไซเนอร์ CSS', en: 'CSS Designer' },
  { id: 'streak-3', icon: '🔥', th: 'ขยัน 3 วันติด', en: '3-Day Streak' },
  { id: 'streak-7', icon: '🔥', th: 'สัปดาห์นักสู้', en: '7-Day Streak' },
  { id: 'all-tracks', icon: '🏆', th: 'จบคอร์สแรก!', en: 'Course Complete!' }
];
function badgeLabel(def) { return getUILang() === 'en' ? def.en : def.th; }

function trackCompleted(track, progress) {
  return track.exercises.every(function (ex, i) { return !!progress[progressKey(track.id, i + 1)]; });
}
function allTracksCompleted(progress) { return TRACKS.every(function (tr) { return trackCompleted(tr, progress); }); }

function checkAwardBadges(progress, streak) {
  var earned = loadBadges();
  var newly = [];
  function award(id) { if (earned.indexOf(id) === -1) { earned.push(id); newly.push(id); } }
  award('first-pass');
  TRACKS.forEach(function (tr) { if (trackCompleted(tr, progress)) award('track-' + tr.id); });
  if (streak.count >= 3) award('streak-3');
  if (streak.count >= 7) award('streak-7');
  if (allTracksCompleted(progress)) award('all-tracks');
  if (newly.length) saveBadges(earned);
  return newly;
}

/* ══════════════════════════════════════════════════════════════════
   UI wiring
   ══════════════════════════════════════════════════════════════════ */
if (typeof document !== 'undefined' && document.getElementById('codingRoot')) {
  var $ = function (id) { return document.getElementById(id); };
  var trackTabs = $('trackTabs'), itemList = $('itemList'), lockMsg = $('lockMsg'),
      instructionsBox = $('instructionsBox'), codeTextarea = $('codeTextarea'), runBtn = $('runBtn'),
      outputPanel = $('outputPanel'), outputLog = $('outputLog'), htmlPreviewWrap = $('htmlPreviewWrap'),
      htmlPreview = $('htmlPreview'), testsPanel = $('testsPanel'), testsList = $('testsList'),
      resultBanner = $('resultBanner'), langToggle = $('langToggle'), outputLabel = $('outputLabelEl'),
      itemHeading = $('itemHeading'), openFullBtn = $('openFullBtn'),
      levelNumEl = $('levelNum'), levelTitleEl = $('levelTitleEl'), xpFillEl = $('xpFill'),
      streakCountEl = $('streakCount'), badgeRowEl = $('badgeRow'), toastWrap = $('toastWrap'),
      confettiLayer = $('confettiLayer');

  var state = { trackId: TRACKS[0].id, itemIndex: 0, busy: false };
  var cm = null; /* CodeMirror instance ถ้าโหลดสำเร็จ — ไม่งั้น fallback ไปใช้ textarea ธรรมดา */

  function getCode() { return cm ? cm.getValue() : codeTextarea.value; }
  function setCode(v) { if (cm) cm.setValue(v); else codeTextarea.value = v; }

  function initEditor() {
    if (window.CodeMirror && !cm) {
      cm = window.CodeMirror.fromTextArea(codeTextarea, {
        lineNumbers: true, mode: 'javascript', indentUnit: 2, tabSize: 2,
        matchBrackets: true, autoCloseBrackets: true, viewportMargin: Infinity
      });
      cm.on('change', function () { saveDraft(state.trackId, state.itemIndex, getCode()); });
    }
  }
  /* CodeMirror โหลดผ่าน CDN แบบ async — ถ้าโหลดไม่ทันตอนหน้าเว็บพร้อม ให้ลองเช็คซ้ำเรื่อยๆ
     (ผู้เรียนพิมพ์ในกล่อง textarea ธรรมดาไปพลางๆ ได้ปกติ ไม่ต้องรอ ใช้งานได้จริงแม้ CDN ช้า/ล่ม) */
  var cmCheckCount = 0;
  var cmCheckTimer = setInterval(function () {
    cmCheckCount++;
    if (window.CodeMirror) { clearInterval(cmCheckTimer); initEditor(); }
    else if (cmCheckCount > 40) { clearInterval(cmCheckTimer); } /* เลิกลองหลัง ~20 วิ ใช้ textarea ต่อไป */
  }, 500);

  function applyI18n() {
    document.documentElement.lang = getUILang();
    document.title = t('pageTitle') + ' | Tanot';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    if (langToggle) {
      langToggle.querySelectorAll('span').forEach(function (span) {
        span.classList.toggle('active', span.getAttribute('data-lt') === getUILang());
      });
    }
    runBtn.textContent = t('runBtn');
    renderGamifyBar();
  }

  function renderGamifyBar() {
    var xp = loadXp();
    var level = levelFromXp(xp);
    if (levelNumEl) levelNumEl.textContent = String(level);
    if (levelTitleEl) levelTitleEl.textContent = levelTitle(level);
    if (xpFillEl) xpFillEl.style.width = Math.round((xpIntoLevel(xp) / XP_PER_LEVEL) * 100) + '%';
    var streak = loadStreak();
    if (streakCountEl) streakCountEl.textContent = String(streak.count);
    if (badgeRowEl) {
      var earned = loadBadges();
      badgeRowEl.innerHTML = '';
      BADGE_DEFS.forEach(function (def) {
        var b = document.createElement('div');
        b.className = 'cx-badge' + (earned.indexOf(def.id) !== -1 ? ' earned' : '');
        b.textContent = def.icon;
        b.title = badgeLabel(def) + (earned.indexOf(def.id) !== -1 ? '' : ' 🔒');
        badgeRowEl.appendChild(b);
      });
    }
  }

  /* คิวขึ้น toast ทีละอัน (แจ้งเลเวลอัป/เหรียญตราใหม่/จบแทร็ก) — กันข้อความซ้อนกันเวลามีหลาย
     event เกิดพร้อมกันในการผ่านครั้งเดียว (เช่น ผ่านข้อสุดท้ายของแทร็ก + ได้เหรียญตรา + เลเวลอัป) */
  var toastQueueState = [];
  var toastBusy = false;
  function showToastQueue(items) {
    if (!items || !items.length) return;
    toastQueueState = toastQueueState.concat(items);
    if (!toastBusy) processToastQueue();
  }
  function processToastQueue() {
    if (!toastQueueState.length) { toastBusy = false; return; }
    toastBusy = true;
    var item = toastQueueState.shift();
    var el = document.createElement('div');
    el.className = 'cx-toast';
    el.textContent = item.icon + ' ' + item.text;
    if (toastWrap) toastWrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('leaving');
      setTimeout(function () { el.remove(); processToastQueue(); }, 300);
    }, 2200);
  }

  /* confetti — ก็อปแพทเทิร์นจาก typing.js (spawnConfetti) ปรับสีให้เข้าธีมฟ้า-ฟ้าอมเขียวของหน้านี้ */
  var CONFETTI_COLORS = ['#2563EB', '#06B6D4', '#17B76A', '#F5A524', '#EC4899'];
  function spawnConfetti() {
    if (!confettiLayer) return;
    confettiLayer.innerHTML = '';
    for (var i = 0; i < 18; i++) {
      var piece = document.createElement('span');
      piece.className = 'cx-confetti-piece';
      piece.style.left = Math.round(Math.random() * 100) + '%';
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDuration = (900 + Math.random() * 700) + 'ms';
      piece.style.animationDelay = Math.round(Math.random() * 200) + 'ms';
      confettiLayer.appendChild(piece);
    }
  }

  function awardForPass(progress) {
    var track = trackById(state.trackId);
    var xp = loadXp();
    var prevLevel = levelFromXp(xp);
    xp += XP_PER_EXERCISE;
    var trackJustCompleted = trackCompleted(track, progress);
    if (trackJustCompleted) xp += XP_PER_TRACK_BONUS;
    saveXp(xp);
    var streak = bumpStreak();
    var newBadges = checkAwardBadges(progress, streak);
    var newLevel = levelFromXp(xp);
    renderGamifyBar();

    var toastQueue = [];
    if (trackJustCompleted) {
      toastQueue.push({ icon: '🎉', text: t('toastTrackDone', { track: getUILang() === 'en' ? track.labelEn : track.label }) });
    }
    newBadges.forEach(function (id) {
      var def = null;
      for (var i = 0; i < BADGE_DEFS.length; i++) if (BADGE_DEFS[i].id === id) { def = BADGE_DEFS[i]; break; }
      if (def) toastQueue.push({ icon: def.icon, text: t('toastBadge', { badge: badgeLabel(def) }) });
    });
    if (newLevel > prevLevel) toastQueue.push({ icon: '⭐', text: t('toastLevelUp', { level: newLevel, title: levelTitle(newLevel) }) });
    showToastQueue(toastQueue);
  }

  function renderTrackTabs() {
    trackTabs.innerHTML = '';
    TRACKS.forEach(function (tr) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cx-tab' + (tr.id === state.trackId ? ' active' : '');
      btn.textContent = getUILang() === 'en' ? tr.labelEn : tr.label;
      btn.addEventListener('click', function () { selectTrack(tr.id); });
      trackTabs.appendChild(btn);
    });
  }

  function renderItemList() {
    var track = trackById(state.trackId);
    var progress = loadProgress();
    itemList.innerHTML = '';
    var conceptBtn = document.createElement('button');
    conceptBtn.type = 'button';
    conceptBtn.className = 'cx-item' + (state.itemIndex === 0 ? ' active' : '');
    conceptBtn.textContent = '📖 ' + t('conceptLabel');
    conceptBtn.addEventListener('click', function () { selectItem(0); });
    itemList.appendChild(conceptBtn);

    track.exercises.forEach(function (ex, i) {
      var idx = i + 1;
      var unlocked = isUnlocked(track, idx, progress);
      var passed = !!progress[progressKey(track.id, idx)];
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'cx-item' + (idx === state.itemIndex ? ' active' : '') + (unlocked ? '' : ' locked');
      item.textContent = (passed ? '✅ ' : unlocked ? '' : '🔒 ') + (idx) + '. ' + ex.title;
      item.addEventListener('click', function () {
        if (unlocked) selectItem(idx);
        else showLockMsg();
      });
      itemList.appendChild(item);
    });
  }

  function showLockMsg() {
    lockMsg.textContent = t('lockedMsg');
    lockMsg.style.display = 'block';
    clearTimeout(lockMsg._hideTimer);
    lockMsg._hideTimer = setTimeout(function () { lockMsg.style.display = 'none'; }, 2600);
  }

  function selectTrack(trackId) {
    state.trackId = trackId;
    state.itemIndex = 0;
    renderTrackTabs();
    renderItemList();
    var track = trackById(trackId);
    if (cm) cm.setOption('mode', track.kind === 'html' ? 'htmlmixed' : 'javascript');
    selectItem(0);
  }

  function selectItem(idx) {
    state.itemIndex = idx;
    renderItemList();
    var track = trackById(state.trackId);
    resultBanner.style.display = 'none';
    resultBanner.className = 'cx-result-banner';
    testsPanel.style.display = 'none';
    outputLog.innerHTML = '';
    var isHtml = track.kind === 'html';
    htmlPreviewWrap.style.display = isHtml ? 'block' : 'none';
    outputPanel.style.display = isHtml ? 'none' : 'block'; /* คอนโซล log ไม่เกี่ยวกับแทร็ก HTML เลย ซ่อนไปเลยแทนโชว์เปล่าๆ */
    if (openFullBtn) openFullBtn.style.display = isHtml ? 'inline-flex' : 'none';

    var drafts = loadDrafts();
    var draftKey = progressKey(state.trackId, idx);

    if (idx === 0) {
      itemHeading.textContent = t('conceptLabel');
      instructionsBox.textContent = track.concept.explain + '\n\n' + t('tryExample');
      setCode(drafts[draftKey] !== undefined ? drafts[draftKey] : track.concept.example);
    } else {
      var ex = track.exercises[idx - 1];
      itemHeading.textContent = t('exerciseTitle', { n: idx }) + ': ' + ex.title;
      instructionsBox.textContent = ex.instructions;
      setCode(drafts[draftKey] !== undefined ? drafts[draftKey] : ex.starter);
    }
    if (track.kind === 'html') updateHtmlPreview();
  }

  function updateHtmlPreview() {
    /* sandbox="allow-scripts" ไม่มี allow-same-origin -> iframe อยู่คนละ origin (opaque) เข้าถึง
       cookie/localStorage ของหน้าเว็บหลักไม่ได้ — ฝั่ง parent ก็อ่าน contentDocument กลับไม่ได้
       เช่นกัน (ตั้งใจ) การตรวจแบบฝึกหัด HTML จึงใช้ DOMParser แยกต่างหาก ไม่ใช้ iframe นี้เลย */
    htmlPreview.srcdoc = getCode();
  }

  function renderOutput(logs) {
    outputLog.innerHTML = '';
    if (!logs || !logs.length) {
      var empty = document.createElement('div');
      empty.className = 'cx-output-empty';
      empty.textContent = t('noOutput');
      outputLog.appendChild(empty);
      return;
    }
    logs.forEach(function (l) {
      var line = document.createElement('div');
      line.className = 'cx-output-line';
      line.textContent = l;
      outputLog.appendChild(line);
    });
  }

  function renderTests(results) {
    if (!results || !results.length) { testsPanel.style.display = 'none'; return; }
    testsPanel.style.display = 'block';
    testsList.innerHTML = '';
    results.forEach(function (r) {
      var row = document.createElement('div');
      row.className = 'cx-test-row ' + (r.pass ? 'pass' : 'fail');
      row.textContent = (r.pass ? '✔ ' : '✘ ') + r.label;
      testsList.appendChild(row);
    });
  }

  function setBusy(b) {
    state.busy = b;
    runBtn.disabled = b;
    runBtn.textContent = b ? t('running') : t('runBtn');
  }

  runBtn.addEventListener('click', async function () {
    if (state.busy) return;
    var track = trackById(state.trackId);
    var code = getCode();
    saveDraft(state.trackId, state.itemIndex, code);
    resultBanner.style.display = 'none';

    if (track.kind === 'html') {
      updateHtmlPreview();
      if (state.itemIndex > 0) {
        var ex = track.exercises[state.itemIndex - 1];
        var results = checkHtmlTests(code, ex.tests);
        renderTests(results);
        handlePassFail(results.every(function (r) { return r.pass; }));
      }
      return;
    }

    setBusy(true);
    outputLog.innerHTML = '<div class="cx-output-empty">' + t('running') + '</div>';
    var testsForRun = state.itemIndex > 0 ? track.exercises[state.itemIndex - 1].tests : null;
    var res = await runJsCode(code, testsForRun);
    setBusy(false);

    if (res.timeout) {
      renderOutput([]);
      resultBanner.textContent = t('timeoutMsg');
      resultBanner.className = 'cx-result-banner fail';
      resultBanner.style.display = 'block';
      return;
    }
    renderOutput(res.logs);
    if (res.runtimeError) {
      var errLine = document.createElement('div');
      errLine.className = 'cx-output-line err';
      errLine.textContent = '❌ ' + res.runtimeError;
      outputLog.appendChild(errLine);
    }
    if (state.itemIndex > 0) {
      renderTests(res.testResults);
      handlePassFail(!res.runtimeError && res.testResults && res.testResults.length > 0 && res.testResults.every(function (r) { return r.pass; }));
    }
  });

  function handlePassFail(allPass) {
    if (state.itemIndex === 0) return;
    var progress = loadProgress();
    var key = progressKey(state.trackId, state.itemIndex);
    var alreadyPassed = !!progress[key];
    if (allPass) {
      progress[key] = { passed: true, at: Date.now() };
      saveProgress(progress);
      resultBanner.textContent = t('allPassed');
      resultBanner.className = 'cx-result-banner pass';
      renderItemList();
      if (!alreadyPassed) { awardForPass(progress); spawnConfetti(); }
    } else {
      resultBanner.textContent = t('notAllPassed');
      resultBanner.className = 'cx-result-banner fail';
    }
    resultBanner.style.display = 'block';
  }

  /* เปิดหน้า HTML ที่พิมพ์อยู่เป็นแท็บใหม่เต็มจอ — ใช้ Blob URL แทน data: URI ตรงๆ เพราะเบราว์เซอร์
     สมัยใหม่บางตัว (โดยเฉพาะบนมือถือ) เริ่มบล็อกการ navigate ไป data: URL ตรงๆ ด้วยเหตุผลความ
     ปลอดภัย แต่ blob: URL ยังเปิดผ่าน window.open ได้ปกติทุกเบราว์เซอร์ — เหมาะกับใช้ดูหน้าตาเว็บ
     ที่พิมพ์แบบเต็มจอจริงบนมือถือ (กรอบพรีวิวเล็กในหน้านี้อาจดูยากบนจอเล็ก) */
  if (openFullBtn) {
    openFullBtn.addEventListener('click', function () {
      /* บั๊กที่เจอจริง (ผู้ใช้รายงาน): เปิดแล้วภาษาไทยกลายเป็นตัวอักษรมั่วๆ ("เธชเธงเธฑเธชเธ”เธต")
         เพราะโค้ดที่ผู้เรียนพิมพ์เป็นแค่ชิ้นส่วน HTML (เช่น <h1>สวัสดี</h1>) ไม่มี <meta charset>
         ของตัวเอง เบราว์เซอร์เลยต้องเดา encoding เอง (เดาผิดเป็น Latin-1/Windows-1252 แทน UTF-8)
         แก้ 2 ชั้น: (1) ระบุ charset=utf-8 ตรงๆ ใน MIME type ของ Blob (2) แทรก <meta charset="utf-8">
         นำหน้าโค้ดเสมอถ้ายังไม่มี — กันไว้สองชั้นเผื่อบางเบราว์เซอร์ไม่อ่าน charset จาก Blob type */
      var code = getCode();
      var hasCharsetMeta = /<meta[^>]+charset/i.test(code);
      var fullHtml = hasCharsetMeta ? code : '<meta charset="utf-8">\n' + code;
      var blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    });
  }

  if (langToggle) {
    langToggle.addEventListener('click', function () {
      setUILang(getUILang() === 'en' ? 'th' : 'en');
      applyI18n();
      renderTrackTabs();
      renderItemList();
      selectItem(state.itemIndex);
    });
  }

  applyI18n();
  renderTrackTabs();
  selectTrack(state.trackId);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TRACKS: TRACKS, checkHtmlTests: checkHtmlTests };
}
})();
