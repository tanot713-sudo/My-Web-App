/* ══════════════════════════════════════════════════════════════════
   Tanot — coding.js
   สอนเขียนโค้ด: JavaScript (kind 'js', รันจริงใน Web Worker แยก sandbox + ตรวจ test case
   อัตโนมัติ), HTML/CSS (kind 'html', พรีวิวสดในกรอบ iframe แบบ sandbox, ตรวจด้วย DOMParser),
   และ DOM manipulation (kind 'dom', รันโค้ด JS กับ "DOM จำลอง" ใน Web Worker แยกอีกตัว แล้ว
   serialize ผลลัพธ์กลับเป็น HTML ธรรมดาให้พรีวิว) — บทเรียนไล่ระดับ คำอธิบาย → แบบฝึกหัด
   ปลดล็อกตามลำดับเมื่อทำแบบฝึกหัดก่อนหน้าผ่าน

   ⚠️ ความปลอดภัย/กันลูปไม่รู้จบ: โค้ด JS ของผู้เรียน (ทั้ง kind 'js' และ 'dom') รันใน Web Worker
   แยก มี timeout + .terminate() ฆ่าลูปไม่รู้จบได้จริง — ดูรายละเอียดที่ code-runner-worker.js และ
   dom-runner-worker.js (แทร็ก DOM เคยลองรันโค้ดตรงๆ ใน <iframe sandbox="allow-scripts"> มาก่อน
   แล้วพบว่า "ผิด" — sandbox iframe แยกแค่สิทธิ์ ไม่แยก JS thread จากหน้าเว็บหลัก ลูปไม่รู้จบใน
   iframe บล็อก event loop ของ parent ไปด้วย ทำให้ตั้ง timeout ฝั่ง parent ไม่ได้ผลจริง จึงย้ายมา
   ใช้ Worker เหมือนแทร็ก JS ทั่วไป ดูรายละเอียดเหตุผลที่หัวไฟล์ dom-runner-worker.js)
   โค้ด HTML พรีวิวใน <iframe sandbox="allow-scripts"> (ไม่มี allow-same-origin จึงเข้าถึง
   cookie/localStorage ของหน้าเว็บหลักไม่ได้) ส่วนการตรวจแบบฝึกหัด HTML ใช้ DOMParser แยกต่างหาก
   (แค่ parse โครงสร้าง ไม่ execute อะไรเลย) — แทร็ก DOM ก็ไม่เคย execute อะไรใน iframe เลยเช่นกัน
   (iframe พรีวิวของแทร็ก DOM ได้แค่ HTML string ที่ serialize มาแล้วจาก Worker เท่านั้น)
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
    id: 'js-functions', kind: 'js', label: 'ฟังก์ชัน (JS)', labelEn: 'Functions (JS)',
    concept: {
      explain: 'ฟังก์ชัน (function) คือโค้ดที่ห่อรวมกันไว้ใช้ซ้ำได้ โดยไม่ต้องเขียนซ้ำทุกครั้ง — ประกาศด้วย function ตามด้วยชื่อ() {...} ข้างในวงเล็บใส่ "พารามิเตอร์" (ค่าที่จะรับเข้ามา) ได้ ส่วน return ใช้ "คืนค่า" ผลลัพธ์กลับออกไปให้ผู้เรียก — เรียกใช้ฟังก์ชันด้วยชื่อตามด้วยวงเล็บ เช่น ชื่อฟังก์ชัน(ค่าที่ส่งเข้าไป)',
      example: 'function square(n) {\n  return n * n;\n}\nconsole.log(square(4));'
    },
    exercises: [
      {
        title: 'เรียกใช้ฟังก์ชัน',
        instructions: 'เพิ่มบรรทัด sayHello(); ต่อท้ายโค้ด เพื่อเรียกใช้ฟังก์ชันที่ประกาศไว้ แล้วรันดู — ควรเห็นคำว่า "สวัสดี"',
        starter: 'function sayHello() {\n  console.log("สวัสดี");\n}\n',
        tests: [{ type: 'log-includes', expected: 'สวัสดี', label: 'ต้องเรียก sayHello() แล้วเห็นคำว่า "สวัสดี"' }]
      },
      {
        title: 'ส่งค่าเข้าฟังก์ชัน',
        instructions: 'เปลี่ยนค่าที่ส่งเข้า square จาก 4 เป็น 5 แล้วรันดู — ควรได้ 25',
        starter: 'function square(n) {\n  return n * n;\n}\nconsole.log(square(4));',
        tests: [{ type: 'log-includes', expected: '25', label: 'console.log(square(5)) ต้องได้ 25' }]
      },
      {
        title: 'return คืนค่า',
        instructions: 'เติม return a + b; ในฟังก์ชัน add (บรรทัดว่าง) แล้วรันดู — ควรได้ 7',
        starter: 'function add(a, b) {\n  \n}\nconsole.log(add(3, 4));',
        tests: [{ type: 'log-includes', expected: '7', label: 'console.log(add(3, 4)) ต้องได้ 7' }]
      },
      {
        title: 'ใช้ผลลัพธ์จากฟังก์ชัน',
        instructions: 'เปลี่ยน double(3) เป็น double(10) แล้วรันดู — ผลรวมควรได้ 30 (double(5)=10 บวก double(10)=20)',
        starter: 'function double(n) {\n  return n * 2;\n}\nlet result = double(5) + double(3);\nconsole.log(result);',
        tests: [{ type: 'log-includes', expected: '30', label: 'console.log(result) ต้องได้ 30' }]
      }
    ]
  },
  {
    id: 'js-arrays', kind: 'js', label: 'อาร์เรย์ (JS)', labelEn: 'Arrays (JS)',
    concept: {
      explain: 'อาร์เรย์ (array) คือตัวแปรที่เก็บค่าหลายๆ ค่าเรียงกันเป็นลิสต์ สร้างด้วยเครื่องหมาย [ ] คั่นแต่ละค่าด้วย , — เข้าถึงสมาชิกแต่ละตัวด้วย index (ลำดับ) โดยเริ่มนับจาก 0 เสมอ เช่น arr[0] คือตัวแรก — .length บอกจำนวนสมาชิกทั้งหมด, .push(ค่า) ใช้เพิ่มสมาชิกใหม่ต่อท้าย',
      example: 'let fruits = ["แอปเปิ้ล", "กล้วย", "ส้ม"];\nconsole.log(fruits[0]);\nconsole.log(fruits.length);'
    },
    exercises: [
      {
        title: 'เข้าถึงสมาชิกด้วย index',
        instructions: 'เปลี่ยน index จาก 0 เป็น 1 แล้วรันดู — ควรเห็นคำว่า "กล้วย" (index เริ่มนับจาก 0)',
        starter: 'let fruits = ["แอปเปิ้ล", "กล้วย", "ส้ม"];\nconsole.log(fruits[0]);',
        tests: [{ type: 'log-includes', expected: 'กล้วย', label: 'ต้อง console.log("กล้วย")' }]
      },
      {
        title: 'เพิ่มสมาชิกด้วย push',
        instructions: 'เพิ่มบรรทัด numbers.push(5); ต่อจากบรรทัดแรก แล้วรันดู — numbers.length ควรเป็น 5',
        starter: 'let numbers = [1, 2, 3];\nnumbers.push(4);\nconsole.log(numbers.length);',
        tests: [{ type: 'log-includes', expected: '5', label: 'console.log(numbers.length) ต้องได้ 5' }]
      },
      {
        title: 'วนลูปอาร์เรย์ด้วย for',
        instructions: 'เติม colors.push("เหลือง"); ในบรรทัดว่าง (ก่อนลูป) แล้วรันดู — ผลลัพธ์ควรมีคำว่า "เหลือง" ปรากฏด้วย',
        starter: 'let colors = ["แดง", "เขียว", "น้ำเงิน"];\n\nfor (let i = 0; i < colors.length; i++) {\n  console.log(colors[i]);\n}',
        tests: [{ type: 'log-includes', expected: 'เหลือง', label: 'ผลลัพธ์ต้องมีคำว่า "เหลือง"' }]
      },
      {
        title: 'รวมผลรวมของอาร์เรย์',
        instructions: 'เติม sum = sum + nums[i]; ในลูป (บรรทัดว่าง) แล้วรันดู — ผลรวม 10+20+30 ควรได้ 60',
        starter: 'let nums = [10, 20, 30];\nlet sum = 0;\nfor (let i = 0; i < nums.length; i++) {\n  \n}\nconsole.log(sum);',
        tests: [{ type: 'log-includes', expected: '60', label: 'console.log(sum) ต้องออกมาเป็น 60' }]
      }
    ]
  },
  {
    id: 'js-objects', kind: 'js', label: 'อ็อบเจกต์ (JS)', labelEn: 'Objects (JS)',
    concept: {
      explain: 'อ็อบเจกต์ (object) คือตัวแปรที่เก็บข้อมูลเป็นคู่ "ชื่อ: ค่า" (key: value) สร้างด้วยเครื่องหมาย { } เช่น { name: "สมชาย", age: 25 } — เข้าถึงค่าแต่ละ key ด้วยจุด (.) เช่น person.name — เปลี่ยนค่าหรือเพิ่ม key ใหม่ก็ทำได้ด้วยการกำหนดค่าตรงๆ เช่น person.age = 26;',
      example: 'let person = { name: "สมชาย", age: 25 };\nconsole.log(person.name);\nconsole.log(person.age);'
    },
    exercises: [
      {
        title: 'เข้าถึงค่าด้วย .property',
        instructions: 'เปลี่ยน car.brand เป็น car.color แล้วรันดู — ควรเห็นคำว่า "แดง"',
        starter: 'let car = { brand: "Toyota", color: "แดง" };\nconsole.log(car.brand);',
        tests: [{ type: 'log-includes', expected: 'แดง', label: 'ต้อง console.log("แดง")' }]
      },
      {
        title: 'เปลี่ยนค่า property',
        instructions: 'เพิ่มบรรทัด user.score = 100; ก่อน console.log แล้วรันดู — ควรได้ 100',
        starter: 'let user = { name: "สมหญิง", score: 50 };\nconsole.log(user.score);',
        tests: [{ type: 'log-includes', expected: '100', label: 'console.log(user.score) ต้องได้ 100' }]
      },
      {
        title: 'เพิ่ม property ใหม่',
        instructions: 'เพิ่มบรรทัด book.pages = 200; ก่อน console.log แล้วรันดู — ตอนนี้ book ยังไม่มี pages เลยได้ undefined ต้องเพิ่มก่อนถึงจะได้ 200',
        starter: 'let book = { title: "นิยาย" };\nconsole.log(book.pages);',
        tests: [{ type: 'log-includes', expected: '200', label: 'console.log(book.pages) ต้องได้ 200' }]
      },
      {
        title: 'อ็อบเจกต์ที่มีอาร์เรย์ข้างใน',
        instructions: 'เปลี่ยน index จาก 0 เป็น 1 แล้วรันดู — ควรได้ 90',
        starter: 'let student = { name: "ปอ", grades: [80, 90, 70] };\nconsole.log(student.grades[0]);',
        tests: [{ type: 'log-includes', expected: '90', label: 'console.log(student.grades[1]) ต้องได้ 90' }]
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
  },
  {
    id: 'html-flexbox', kind: 'html', label: 'จัดวางด้วย Flexbox', labelEn: 'Flexbox',
    concept: {
      explain: 'Flexbox ใช้จัดวางกล่องหลายกล่องให้เรียงกันสวยงาม — ใส่ display: flex; ให้กล่องที่ครอบ (container) แล้วกล่องลูกข้างในจะเรียงกันแนวนอนอัตโนมัติ — justify-content จัดตำแหน่งแนวนอน (เช่น center คือกึ่งกลาง), align-items จัดตำแหน่งแนวตั้ง, gap กำหนดระยะห่างระหว่างกล่อง',
      example: '<div style="display: flex; gap: 10px;">\n  <div style="background: #2563EB; color: #fff; padding: 10px;">กล่อง 1</div>\n  <div style="background: #06B6D4; color: #fff; padding: 10px;">กล่อง 2</div>\n</div>'
    },
    exercises: [
      {
        title: 'เปิดใช้งาน Flexbox',
        instructions: 'เพิ่ม display: flex; ใน style ของ div ครอบนอกสุด ให้กล่อง 1 และ 2 เรียงกันแนวนอน',
        starter: '<div style="">\n  <div style="background:#2563EB;color:#fff;padding:10px;">1</div>\n  <div style="background:#06B6D4;color:#fff;padding:10px;">2</div>\n</div>',
        tests: [{ type: 'html-attr', selector: 'div', attr: 'style', includes: 'flex', label: 'div ครอบนอกต้องมี display: flex' }]
      },
      {
        title: 'จัดกึ่งกลางแนวนอน',
        instructions: 'เพิ่ม justify-content: center; ใน style ของ div ครอบนอก ให้กล่องอยู่กึ่งกลางแนวนอน',
        starter: '<div style="display: flex;">\n  <div style="background:#2563EB;color:#fff;padding:10px;">กล่อง</div>\n</div>',
        tests: [{ type: 'html-attr', selector: 'div', attr: 'style', includes: 'justify-content', label: 'div ครอบนอกต้องมี justify-content' }]
      },
      {
        title: 'จัดกึ่งกลางแนวตั้ง',
        instructions: 'เพิ่ม align-items: center; ใน style ของ div ครอบนอก ให้กล่องอยู่กึ่งกลางแนวตั้งของกรอบสูง 150px',
        starter: '<div style="display: flex; height: 150px;">\n  <div style="background:#2563EB;color:#fff;padding:10px;">กล่อง</div>\n</div>',
        tests: [{ type: 'html-attr', selector: 'div', attr: 'style', includes: 'align-items', label: 'div ครอบนอกต้องมี align-items' }]
      },
      {
        title: 'ระยะห่างระหว่างกล่อง',
        instructions: 'เพิ่ม gap: 16px; ใน style ของ div ครอบนอก ให้มีระยะห่างระหว่างกล่อง 1 กับ 2',
        starter: '<div style="display: flex;">\n  <div style="background:#2563EB;color:#fff;padding:10px;">1</div>\n  <div style="background:#06B6D4;color:#fff;padding:10px;">2</div>\n</div>',
        tests: [{ type: 'html-attr', selector: 'div', attr: 'style', includes: 'gap', label: 'div ครอบนอกต้องมี gap' }]
      }
    ]
  },
  {
    id: 'html-grid', kind: 'html', label: 'จัดวางด้วย Grid', labelEn: 'CSS Grid',
    concept: {
      explain: 'CSS Grid ใช้จัดวางเป็นตาราง (แถว+คอลัมน์) ต่างจาก Flexbox ที่จัดแนวเดียว — ใส่ display: grid; ให้ container แล้วกำหนด grid-template-columns เพื่อบอกว่าอยากได้กี่คอลัมน์ กว้างเท่าไหร่ เช่น 1fr 1fr 1fr คือ 3 คอลัมน์กว้างเท่ากัน (fr แปลว่าสัดส่วน) — gap กำหนดระยะห่างระหว่างช่อง เหมือน Flexbox — grid-column: span 2; ทำให้ 1 ช่องกินพื้นที่ 2 คอลัมน์รวด',
      example: '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">\n  <div style="background: #2563EB; color: #fff; padding: 10px;">1</div>\n  <div style="background: #06B6D4; color: #fff; padding: 10px;">2</div>\n  <div style="background: #17B26A; color: #fff; padding: 10px;">3</div>\n</div>'
    },
    exercises: [
      {
        title: 'เปิดใช้งาน Grid',
        instructions: 'เพิ่ม display: grid; ใน style ของ div ครอบนอกสุด',
        starter: '<div style="">\n  <div style="background:#2563EB;color:#fff;padding:10px;">1</div>\n  <div style="background:#06B6D4;color:#fff;padding:10px;">2</div>\n</div>',
        tests: [{ type: 'html-attr', selector: 'div', attr: 'style', includes: 'grid', label: 'div ครอบนอกต้องมี display: grid' }]
      },
      {
        title: 'กำหนดจำนวนคอลัมน์',
        instructions: 'เพิ่ม grid-template-columns: 1fr 1fr 1fr; ให้แบ่งเป็น 3 คอลัมน์เท่ากัน',
        starter: '<div style="display: grid;">\n  <div style="background:#2563EB;color:#fff;padding:10px;">1</div>\n  <div style="background:#06B6D4;color:#fff;padding:10px;">2</div>\n  <div style="background:#17B26A;color:#fff;padding:10px;">3</div>\n</div>',
        tests: [{ type: 'html-attr', selector: 'div', attr: 'style', includes: 'grid-template-columns', label: 'div ครอบนอกต้องมี grid-template-columns' }]
      },
      {
        title: 'ระยะห่างระหว่างช่อง',
        instructions: 'เพิ่ม gap: 12px; ให้มีระยะห่างระหว่างช่องแต่ละอัน',
        starter: '<div style="display: grid; grid-template-columns: 1fr 1fr;">\n  <div style="background:#2563EB;color:#fff;padding:10px;">1</div>\n  <div style="background:#06B6D4;color:#fff;padding:10px;">2</div>\n</div>',
        tests: [{ type: 'html-attr', selector: 'div', attr: 'style', includes: 'gap', label: 'div ครอบนอกต้องมี gap' }]
      },
      {
        title: 'ขยายช่องให้กินหลายคอลัมน์',
        instructions: 'เพิ่ม grid-column: span 2; ใน style ของกล่อง id="wide" ("กว้างพิเศษ") ให้มันกินพื้นที่ 2 คอลัมน์',
        starter: '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">\n  <div id="wide" style="background:#2563EB;color:#fff;padding:10px;">กว้างพิเศษ</div>\n  <div style="background:#06B6D4;color:#fff;padding:10px;">2</div>\n  <div style="background:#17B26A;color:#fff;padding:10px;">3</div>\n</div>',
        tests: [{ type: 'html-attr', selector: '#wide', attr: 'style', includes: 'grid-column', label: '#wide ต้องมี grid-column ใน style' }]
      }
    ]
  },
  {
    id: 'html-responsive-forms', kind: 'html', label: 'Responsive & Forms', labelEn: 'Responsive & Forms',
    concept: {
      explain: 'Responsive design ทำให้เว็บแสดงผลดีทั้งจอเล็ก (มือถือ) และจอใหญ่ (คอมพิวเตอร์) — ใช้ @media query กำหนด style ที่ใช้เฉพาะตอนจอเล็กกว่าค่าที่กำหนด เช่น @media (max-width: 600px) { ... } — ส่วนฟอร์ม (form) ควรใช้ <label> คู่กับ <input> เสมอ (เชื่อมด้วย for="id ของ input") เพื่อให้ผู้ใช้เข้าใจว่าต้องกรอกอะไร ใช้ attribute required บังคับกรอก, type="email" ให้เบราว์เซอร์ช่วยตรวจสอบรูปแบบเบื้องต้น',
      example: '<style>\n  .box { background: #2563EB; padding: 20px; }\n  @media (max-width: 600px) {\n    .box { background: red; }\n  }\n</style>\n<label for="email">อีเมล</label>\n<input id="email" type="email" required>'
    },
    exercises: [
      {
        title: 'เขียน media query พื้นฐาน',
        instructions: 'เพิ่ม @media (max-width: 600px) { .box { background: red; } } ต่อท้ายใน <style> แล้วรันดู',
        starter: '<style>\n  .box { background: #2563EB; color: #fff; padding: 20px; }\n</style>\n<div class="box">กล่องนี้ควรเปลี่ยนสีตอนจอเล็ก</div>',
        tests: [
          { type: 'html-text', selector: 'style', includes: '@media', label: '<style> ต้องมี @media' },
          { type: 'html-text', selector: 'style', includes: 'max-width', label: '<style> ต้องมี max-width' }
        ]
      },
      {
        title: 'เชื่อม label กับ input',
        instructions: 'เพิ่ม for="nameField" ในแท็ก <label> เพื่อเชื่อมโยงกับ input (ผู้ใช้กด label แล้วโฟกัสไปที่ input ได้เลย)',
        starter: '<label>ชื่อ</label>\n<input type="text" id="nameField">',
        tests: [{ type: 'html-attr', selector: 'label', attr: 'for', includes: 'nameField', label: '<label> ต้องมี for="nameField"' }]
      },
      {
        title: 'ตรวจสอบอีเมลและบังคับกรอก',
        instructions: 'เปลี่ยน type จาก "text" เป็น "email" แล้วเพิ่ม required ต่อท้าย (ไม่ต้องใส่ค่า พิมพ์แค่คำว่า required เฉยๆ) แล้วรันดู',
        starter: '<input type="text" placeholder="อีเมล">',
        tests: [
          { type: 'html-attr', selector: 'input', attr: 'type', includes: 'email', label: '<input> ต้องมี type="email"' },
          { type: 'html-has-attr', selector: 'input', attr: 'required', label: '<input> ต้องมี required' }
        ]
      },
      {
        title: 'เพิ่มตัวเลือกใน select',
        instructions: 'เพิ่ม <option>ญี่ปุ่น</option> อีกบรรทัดในแท็ก select แล้วรันดู — ควรมี option 2 อัน',
        starter: '<select id="country">\n  <option>ไทย</option>\n</select>',
        tests: [{ type: 'html-count', selector: '#country option', count: 2, label: '<select id="country"> ต้องมี <option> 2 อัน' }]
      }
    ]
  },
  {
    /* kind 'dom' — รันโค้ด JS ของผู้เรียนกับ "DOM จำลอง" (fake document) ใน Web Worker แยก
       (เหมือนแทร็ก 'js' ทุกประการ มี .terminate() ฆ่าลูปไม่รู้จบได้จริง) ต่างจาก 'js' ตรงที่ต้อง
       เตรียม document ปลอมให้โค้ดเรียก getElementById/querySelector ได้ ดูรายละเอียด+เหตุผลที่
       "ไม่ใช้ iframe จริง" (ลองแล้วพบว่า sandbox iframe บล็อก event loop หน้าเว็บหลักได้จริงถ้า
       โค้ดมีลูปไม่รู้จบ) ที่ dom-runner-worker.js — domSpec คือรายการ element เริ่มต้นแบบ declarative
       (ไม่ใช่ HTML string) ให้ worker สร้าง DOM จำลองจากมัน แล้ว serialize ผลลัพธ์สุดท้ายกลับเป็น
       HTML ธรรมดา (ไม่มีสคริปต์) ให้พรีวิว — ปลอดภัย 100% เพราะพรีวิวไม่ execute อะไรเลย */
    id: 'js-dom', kind: 'dom', label: 'DOM (JS)', labelEn: 'DOM (JS)',
    concept: {
      explain: 'DOM (Document Object Model) คือโครงสร้างของหน้าเว็บที่ JavaScript เข้าถึงและเปลี่ยนแปลงได้แบบ real-time — ใช้ document.getElementById("...") หรือ document.querySelector("...") เพื่อ "หา" องค์ประกอบ (element) บนหน้าเว็บ แล้วเปลี่ยนแปลงมันได้ เช่น .textContent (เปลี่ยนข้อความ), .style.xxx (เปลี่ยนสไตล์), .classList.add/remove (เพิ่ม/ลบ class) — พรีวิวด้านขวาจะอัปเดตทันทีเมื่อกดรัน นี่คือจุดเริ่มต้นของการทำเว็บโต้ตอบได้จริง',
      example: 'document.getElementById("demo").textContent = "เปลี่ยนข้อความแล้ว!";',
      domSpec: [{ tag: 'h1', id: 'demo', text: 'ข้อความเดิม' }]
    },
    exercises: [
      {
        title: 'เปลี่ยนข้อความด้วย textContent',
        instructions: 'เปลี่ยนค่าที่กำหนดให้เป็น "สวัสดี DOM!" แล้วรันดู — หัวข้อในพรีวิวด้านขวาจะเปลี่ยนทันที',
        domSpec: [{ tag: 'h1', id: 'title', text: 'ข้อความเดิม' }],
        starter: 'document.getElementById("title").textContent = "ข้อความเดิม";',
        tests: [{ type: 'dom-text', selector: '#title', includes: 'สวัสดี DOM', label: '#title ต้องมีข้อความ "สวัสดี DOM!"' }]
      },
      {
        title: 'เปลี่ยนสีด้วย style',
        instructions: 'เปลี่ยนค่าสีจาก "black" เป็น "red" แล้วรันดู — ข้อความในพรีวิวควรเปลี่ยนเป็นสีแดง',
        domSpec: [{ tag: 'p', id: 'msg', text: 'ข้อความนี้ควรเปลี่ยนสี' }],
        starter: 'document.getElementById("msg").style.color = "black";',
        tests: [{ type: 'dom-style', selector: '#msg', prop: 'color', includes: 'red', label: '#msg ต้องมีสีแดง (color: red)' }]
      },
      {
        title: 'เพิ่ม class ด้วย classList',
        instructions: 'เปลี่ยน "inactive" เป็น "active" แล้วรันดู — กล่องสี่เหลี่ยมในพรีวิวควรเปลี่ยนเป็นสีน้ำเงิน',
        domSpec: [{ tag: 'div', id: 'box', text: '', style: { width: '80px', height: '80px', background: '#ccc' } }],
        previewCss: '.active{background:#2563EB !important;}',
        starter: 'document.getElementById("box").classList.add("inactive");',
        tests: [{ type: 'dom-class', selector: '#box', class: 'active', label: '#box ต้องมี class "active"' }]
      },
      {
        title: 'จับเหตุการณ์คลิกด้วย addEventListener',
        instructions: 'เติมโค้ดในฟังก์ชัน ให้เปลี่ยน textContent ของ #result เป็น "กดแล้ว!" เมื่อคลิกปุ่ม แล้วรันดู (ระบบจะจำลองการคลิกปุ่มให้อัตโนมัติหลังรันเสร็จ)',
        domSpec: [{ tag: 'button', id: 'btn', text: 'กดฉัน' }, { tag: 'p', id: 'result', text: 'ยังไม่ได้กด' }],
        starter: 'document.getElementById("btn").addEventListener("click", function () {\n  \n});',
        preActions: [{ type: 'click', selector: '#btn' }],
        tests: [{ type: 'dom-text', selector: '#result', includes: 'กดแล้ว', label: 'หลังคลิกปุ่ม #result ต้องมีข้อความ "กดแล้ว"' }]
      }
    ]
  },
  {
    /* kind 'dom' เหมือน js-dom ทุกประการ (ใช้ dom-runner-worker.js ตัวเดียวกัน) — ต่อยอดความรู้
       addEventListener จากแทร็กก่อนหน้า มาใช้กับ input/form โดยเฉพาะ (.value, submit event,
       e.preventDefault()) domSpec รองรับ field "value" สำหรับ input/textarea แล้ว */
    id: 'js-events-forms', kind: 'dom', label: 'Events & Forms (JS)', labelEn: 'Events & Forms (JS)',
    concept: {
      explain: 'ฟอร์ม (form) และช่องกรอกข้อมูล (input) มี event พิเศษให้ใช้ — addEventListener("click", ...) ดักการคลิกปุ่ม, addEventListener("submit", ...) ดักการส่งฟอร์ม (ต้องเรียก e.preventDefault() กันหน้าเว็บโหลดใหม่) — อ่านค่าที่ผู้ใช้พิมพ์ในช่อง input ด้วย .value เช่น document.getElementById("name").value',
      example: 'let input = document.getElementById("nameInput");\nconsole.log(input.value);',
      domSpec: [{ tag: 'input', id: 'nameInput', value: 'สมชาย' }]
    },
    exercises: [
      {
        title: 'อ่านค่าจาก input ด้วย .value',
        instructions: 'เปลี่ยนบรรทัดนี้ให้ดึงค่าจากช่องกรอกด้วย document.getElementById("nameInput").value แทนข้อความคงที่ แล้วรันดู — ควรเห็นคำว่า "สมชาย"',
        domSpec: [{ tag: 'input', id: 'nameInput', value: 'สมชาย' }, { tag: 'p', id: 'output', text: 'ยังไม่แสดงชื่อ' }],
        starter: 'document.getElementById("output").textContent = "ยังไม่แสดงชื่อ";',
        tests: [{ type: 'dom-text', selector: '#output', includes: 'สมชาย', label: '#output ต้องแสดงชื่อจาก input' }]
      },
      {
        title: 'กดปุ่มแล้วอ่านค่าจาก input',
        instructions: 'เติมโค้ดในฟังก์ชัน ให้เปลี่ยน textContent ของ #result เป็นค่าจาก emailInput.value เมื่อกดปุ่ม แล้วรันดู (ระบบจะจำลองการคลิกปุ่มให้อัตโนมัติ)',
        domSpec: [{ tag: 'input', id: 'emailInput', value: 'test@email.com' }, { tag: 'button', id: 'submitBtn', text: 'ส่ง' }, { tag: 'p', id: 'result', text: 'ยังไม่ส่ง' }],
        starter: 'document.getElementById("submitBtn").addEventListener("click", function () {\n  \n});',
        preActions: [{ type: 'click', selector: '#submitBtn' }],
        tests: [{ type: 'dom-text', selector: '#result', includes: 'test@email.com', label: '#result ต้องแสดงอีเมลจาก emailInput' }]
      },
      {
        title: 'ป้องกันการส่งฟอร์มด้วย preventDefault',
        instructions: 'เติมโค้ดในฟังก์ชัน (บรรทัดว่าง) ให้เปลี่ยน textContent ของ #status เป็น "ส่งฟอร์มแล้ว!" แล้วรันดู (ระบบจะจำลองการส่งฟอร์มให้อัตโนมัติ) — e.preventDefault() ใช้กันไม่ให้หน้าเว็บโหลดใหม่ตอนส่งฟอร์มจริง',
        domSpec: [{ tag: 'form', id: 'myForm' }, { tag: 'p', id: 'status', text: 'รอส่งฟอร์ม' }],
        starter: 'document.getElementById("myForm").addEventListener("submit", function (e) {\n  e.preventDefault();\n  \n});',
        preActions: [{ type: 'submit', selector: '#myForm' }],
        tests: [{ type: 'dom-text', selector: '#status', includes: 'ส่งฟอร์มแล้ว', label: '#status ต้องมีข้อความ "ส่งฟอร์มแล้ว!"' }]
      },
      {
        title: 'รวมค่าจาก input หลายช่อง',
        instructions: 'แก้บรรทัดสุดท้ายในฟังก์ชันให้เป็น document.getElementById("fullName").textContent = first + last; (รวมชื่อกับนามสกุล) แล้วรันดู — ควรเห็น "สมชายใจดี"',
        domSpec: [{ tag: 'input', id: 'firstNameInput', value: 'สมชาย' }, { tag: 'input', id: 'lastNameInput', value: 'ใจดี' }, { tag: 'button', id: 'go', text: 'รวมชื่อ' }, { tag: 'p', id: 'fullName', text: '' }],
        starter: 'document.getElementById("go").addEventListener("click", function () {\n  var first = document.getElementById("firstNameInput").value;\n  var last = document.getElementById("lastNameInput").value;\n  document.getElementById("fullName").textContent = first;\n});',
        preActions: [{ type: 'click', selector: '#go' }],
        tests: [{ type: 'dom-text', selector: '#fullName', includes: 'สมชายใจดี', label: '#fullName ต้องเป็น "สมชายใจดี"' }]
      }
    ]
  },
  {
    /* kind 'js' เหมือนแทร็กอื่น (Worker + code-runner-worker.js) แต่แบบฝึกหัดทุกข้อมี settleMs
       (ดูเหตุผลที่หัวไฟล์ code-runner-worker.js) เพราะโค้ดเป็น async — console.log เกิดหลัง await
       ต้องให้ worker รอ "settle" ก่อนตรวจ tests ไม่งั้นจะตรวจเร็วเกินไปจนพลาดผลลัพธ์ที่ยังมาไม่ถึง */
    id: 'js-async', kind: 'js', label: 'Async/Fetch (JS)', labelEn: 'Async/Fetch (JS)',
    concept: {
      explain: 'Promise คือวัตถุที่แทน "ค่าที่จะได้ในอนาคต" (เช่น ผลจากการขอข้อมูลจากเซิร์ฟเวอร์ ซึ่งใช้เวลา ไม่ได้ค่ากลับทันที) — async/await คือไวยากรณ์ที่ทำให้เขียนโค้ดรอ Promise ได้อ่านง่ายเหมือนโค้ดปกติ: ใส่ async หน้าฟังก์ชัน แล้วใช้ await หน้า Promise ที่ต้องการรอผล โค้ดจะ "หยุดรอ" ตรงนั้นจนกว่าจะได้ค่ากลับมา (ระหว่างรอ หน้าเว็บไม่ค้าง ยังทำงานอย่างอื่นได้ปกติ) — fetch() คือฟังก์ชันจริงที่ใช้ขอข้อมูลจากเซิร์ฟเวอร์ผ่านอินเทอร์เน็ต ทำงานแบบเดียวกันนี้เป๊ะ',
      example: 'function delay(ms) {\n  return new Promise(function (resolve) {\n    setTimeout(resolve, ms);\n  });\n}\n\nasync function main() {\n  await delay(100);\n  console.log("รอเสร็จแล้ว");\n}\nmain();'
    },
    exercises: [
      {
        title: 'ใช้ .then() กับ Promise',
        instructions: 'เปลี่ยนข้อความใน console.log เป็น "รอเสร็จแล้ว" แล้วรันดู — ข้อความจะปรากฏหลังรอ 100 มิลลิวินาที (สังเกตว่าโค้ดไม่ค้างรอ แค่ "นัดหมาย" ให้ทำงานทีหลัง)',
        starter: 'function delay(ms) {\n  return new Promise(function (resolve) {\n    setTimeout(resolve, ms);\n  });\n}\ndelay(100).then(function () {\n  console.log("ยังไม่เสร็จ");\n});',
        settleMs: 400,
        tests: [{ type: 'log-includes', expected: 'รอเสร็จแล้ว', label: 'ต้อง console.log("รอเสร็จแล้ว")' }]
      },
      {
        title: 'async/await พื้นฐาน',
        instructions: 'เติมคำว่า await หน้า fetchUser() แล้วรันดู — ถ้าไม่มี await จะได้ user เป็น Promise object เฉยๆ (user.name จะเป็น undefined) ต้องมี await ถึงจะได้ค่าจริงจากใน Promise',
        starter: 'function fetchUser() {\n  return new Promise(function (resolve) {\n    setTimeout(function () {\n      resolve({ name: "สมชาย" });\n    }, 100);\n  });\n}\n\nasync function main() {\n  let user = fetchUser();\n  console.log(user.name);\n}\nmain();',
        settleMs: 400,
        tests: [{ type: 'log-includes', expected: 'สมชาย', label: 'ต้อง console.log(user.name) ออกมาเป็น "สมชาย"' }]
      },
      {
        title: 'รวมหลาย await ตามลำดับ',
        instructions: 'เปลี่ยนบรรทัดสุดท้ายในฟังก์ชันเป็น console.log(a + b); แล้วรันดู — ควรได้ 15 (รอ a แล้วรอ b ตามลำดับ ก่อนจะรวมกัน)',
        starter: 'function getNumber(n) {\n  return new Promise(function (resolve) {\n    setTimeout(function () {\n      resolve(n);\n    }, 50);\n  });\n}\n\nasync function main() {\n  let a = await getNumber(5);\n  let b = await getNumber(10);\n  console.log(a);\n}\nmain();',
        settleMs: 400,
        tests: [{ type: 'log-includes', expected: '15', label: 'ต้อง console.log(a + b) ออกมาเป็น 15' }]
      },
      {
        title: 'จัดการข้อผิดพลาดด้วย try/catch',
        instructions: 'เติม console.log("จับข้อผิดพลาดได้: " + err); ในบล็อก catch (บรรทัดว่าง) แล้วรันดู — เพราะ riskyTask() reject (ล้มเหลว) เสมอ โค้ดควรกระโดดไปที่ catch',
        starter: 'function riskyTask() {\n  return new Promise(function (resolve, reject) {\n    setTimeout(function () {\n      reject("เกิดข้อผิดพลาด!");\n    }, 50);\n  });\n}\n\nasync function main() {\n  try {\n    await riskyTask();\n    console.log("สำเร็จ");\n  } catch (err) {\n    \n  }\n}\nmain();',
        settleMs: 400,
        tests: [{ type: 'log-includes', expected: 'จับข้อผิดพลาดได้: เกิดข้อผิดพลาด!', label: 'ต้อง console.log("จับข้อผิดพลาดได้: เกิดข้อผิดพลาด!")' }]
      }
    ]
  },
  {
    /* kind 'js' เหมือนแทร็กอื่น แต่ code-runner-worker.js เตรียม localStorage ปลอมไว้ให้เป็น global
       (Worker จริงไม่มี localStorage เลย เป็น Window-only API — ยืนยันด้วยการทดสอบจริงว่า
       typeof localStorage เป็น undefined ใน Worker) เก็บข้อมูลแค่ในตัวแปรของ Worker เอง ไม่แตะ
       localStorage จริงของหน้าเว็บหลักเลย ปลอดภัย 100% — ดูรายละเอียดที่หัวไฟล์ code-runner-worker.js */
    id: 'js-localstorage', kind: 'js', label: 'localStorage (JS)', labelEn: 'localStorage (JS)',
    concept: {
      explain: 'localStorage เก็บข้อมูลไว้ในเบราว์เซอร์ของผู้ใช้ ข้อมูลจะยังอยู่ต่อแม้ปิดแท็บ/ปิดเบราว์เซอร์แล้วเปิดใหม่ (ต่างจากตัวแปรธรรมดาที่หายไปทันทีที่ปิดหน้าเว็บ) — localStorage.setItem("ชื่อคีย์", "ค่า") ใช้บันทึก, localStorage.getItem("ชื่อคีย์") ใช้ดึงค่ากลับ (เก็บได้แค่ string เท่านั้น ถ้าอยากเก็บ object/array ต้องแปลงด้วย JSON.stringify ก่อน แล้วแปลงกลับด้วย JSON.parse ตอนอ่าน) — localStorage.removeItem("ชื่อคีย์") ใช้ลบ',
      example: 'localStorage.setItem("username", "สมชาย");\nconsole.log(localStorage.getItem("username"));'
    },
    exercises: [
      {
        title: 'บันทึกและดึงค่าด้วย setItem/getItem',
        instructions: 'เปลี่ยน "nickname" ในบรรทัด getItem ให้เป็น "username" แล้วรันดู — ควรเห็นคำว่า "สมชาย"',
        starter: 'localStorage.setItem("username", "สมชาย");\nconsole.log(localStorage.getItem("nickname"));',
        tests: [{ type: 'log-includes', expected: 'สมชาย', label: 'ต้อง console.log("สมชาย")' }]
      },
      {
        title: 'localStorage เก็บได้แค่ string',
        instructions: 'รันโค้ดนี้ดูก่อน สังเกตว่า typeof ออกมาเป็น "string" ทั้งที่เซฟเป็นตัวเลข (100) เพราะ localStorage เก็บได้แค่ string เสมอ — ลองแก้บรรทัดสุดท้ายเป็น console.log(Number(saved) + 1); แล้วรันดู ควรได้ 101',
        starter: 'localStorage.setItem("score", 100);\nlet saved = localStorage.getItem("score");\nconsole.log(typeof saved);',
        tests: [{ type: 'log-includes', expected: '101', label: 'ต้อง console.log(Number(saved) + 1) ออกมาเป็น 101' }]
      },
      {
        title: 'เก็บ object ด้วย JSON.stringify/parse',
        instructions: 'เปลี่ยนบรรทัดสุดท้ายเป็น let loaded = JSON.parse(raw); console.log(loaded.name); แล้วรันดู — ควรเห็น "สมหญิง" (ต้องแปลงกลับด้วย JSON.parse ก่อนถึงจะอ่านค่า .name ได้ตรงๆ)',
        starter: 'let user = { name: "สมหญิง", age: 30 };\nlocalStorage.setItem("user", JSON.stringify(user));\nlet raw = localStorage.getItem("user");\nconsole.log(raw);',
        tests: [{ type: 'log-includes', expected: 'สมหญิง', label: 'ต้อง console.log(loaded.name) ออกมาเป็น "สมหญิง"' }]
      },
      {
        title: 'ลบข้อมูลด้วย removeItem',
        instructions: 'เพิ่ม localStorage.removeItem("temp"); ก่อนบรรทัด console.log แล้วรันดู — ควรได้ null เพราะข้อมูลถูกลบไปแล้ว',
        starter: 'localStorage.setItem("temp", "ข้อมูลชั่วคราว");\nconsole.log(localStorage.getItem("temp"));',
        tests: [{ type: 'log-includes', expected: 'null', label: 'console.log ต้องออกมาเป็น null หลังลบ' }]
      }
    ]
  },
  {
    /* ══ Track C: โปรเจกต์จบคอร์ส (capstone) — เอาความรู้ทุกแทร็กก่อนหน้ามารวมกันในโปรเจกต์จริง
       โปรเจกต์ที่ 1: Landing Page (kind 'html' เหมือนแทร็ก HTML/CSS/Flexbox/Grid ทั่วไป) */
    id: 'project-landing-page', kind: 'html', label: 'โปรเจกต์: Landing Page', labelEn: 'Project: Landing Page',
    concept: {
      explain: 'โปรเจกต์แรก: สร้างหน้า Landing Page ง่ายๆ ที่มีโครงสร้างเหมือนเว็บจริง — ส่วนหัว (header) มีชื่อแบรนด์, ส่วน hero มีข้อความโปรโมทกับปุ่มกดหลัก (CTA), การ์ดฟีเจอร์ด้วย Flexbox, และส่วนท้าย (footer) มีข้อมูลติดต่อ — นำความรู้ HTML+CSS+Flexbox ที่เรียนมาทั้งหมดมารวมกันในหน้าเดียว',
      example: '<header style="background:#1F2430;color:#fff;padding:16px;">MyBrand</header>\n<section style="text-align:center;padding:40px;">\n  <h1>สร้างเว็บของคุณวันนี้</h1>\n  <button style="background:#2563EB;color:#fff;padding:12px 24px;border:none;border-radius:8px;">เริ่มเลย</button>\n</section>'
    },
    exercises: [
      {
        title: 'ส่วนหัว (Header)',
        instructions: 'ใส่ชื่อแบรนด์ "MyBrand" ไว้ในกล่อง div ว่างๆ ในส่วนหัว แล้วรันดู',
        starter: '<header style="display: flex; justify-content: space-between; padding: 16px; background: #1F2430; color: #fff;">\n  <div style="font-weight: 700;"></div>\n</header>',
        tests: [{ type: 'html-text', selector: 'header div', includes: 'MyBrand', label: 'ส่วนหัวต้องมีคำว่า "MyBrand"' }]
      },
      {
        title: 'ส่วน Hero + ปุ่ม CTA',
        instructions: 'เพิ่ม style ให้ปุ่ม (background: #2563EB; color: #fff; padding: 12px 24px; border: none; border-radius: 8px;) แล้วรันดู',
        starter: '<section style="text-align: center; padding: 60px 20px;">\n  <h1>สร้างเว็บของคุณวันนี้</h1>\n  <p>เรียนเขียนโค้ดง่ายๆ ได้ที่นี่</p>\n  <button style="">เริ่มเลย</button>\n</section>',
        tests: [{ type: 'html-attr', selector: 'button', attr: 'style', includes: 'background', label: 'ปุ่มต้องมี background ใน style' }]
      },
      {
        title: 'การ์ดฟีเจอร์ด้วย Flexbox',
        instructions: 'เติมข้อความ "ปลอดภัย" ในกล่อง id="card2" ที่ยังว่างอยู่ แล้วรันดู',
        starter: '<div style="display: flex; gap: 16px; padding: 20px;">\n  <div style="flex: 1; background: #E8EFFE; padding: 16px; border-radius: 8px;">เร็ว</div>\n  <div id="card2" style="flex: 1; background: #E8EFFE; padding: 16px; border-radius: 8px;"></div>\n</div>',
        tests: [{ type: 'html-nonempty', selector: '#card2', label: '#card2 ต้องมีข้อความ' }]
      },
      {
        title: 'ส่วนท้าย (Footer)',
        instructions: 'ใส่ข้อความ "ติดต่อเรา: contact@mybrand.com" ในแท็ก p แล้วรันดู',
        starter: '<footer style="text-align: center; padding: 20px; color: #727C93;">\n  <p></p>\n</footer>',
        tests: [{ type: 'html-text', selector: 'footer p', includes: 'contact@mybrand.com', label: 'footer ต้องมีอีเมลติดต่อ' }]
      }
    ]
  },
  {
    /* โปรเจกต์ที่ 2: To-Do List App (kind 'dom' — ต้องมี createElement/appendChild/remove ของจริง
       ดูส่วนขยายที่ dom-runner-worker.js) */
    id: 'project-todo-list', kind: 'dom', label: 'โปรเจกต์: To-Do List', labelEn: 'Project: To-Do List',
    concept: {
      explain: 'โปรเจกต์ที่ 2: To-Do List App — แอปพื้นฐานที่รวมความรู้ DOM+Events เข้าด้วยกัน: เพิ่มรายการใหม่ด้วย document.createElement() + appendChild(), แสดงผลในลิสต์, ทำเครื่องหมายว่าเสร็จแล้วด้วย classList, และลบรายการด้วย .remove()',
      example: 'var li = document.createElement("li");\nli.textContent = "งานใหม่";\ndocument.getElementById("list").appendChild(li);',
      domSpec: [{ tag: 'ul', id: 'demoList', children: [{ tag: 'li', text: 'ตัวอย่างรายการ' }] }]
    },
    exercises: [
      {
        title: 'เพิ่มรายการใหม่ด้วย createElement',
        instructions: 'เติมโค้ดในฟังก์ชัน ให้สร้าง <li> ใหม่ด้วย document.createElement("li") ใส่ข้อความจาก taskInput.value แล้วเพิ่มเข้า #taskList ด้วย .appendChild() แล้วรันดู (ระบบจะกดปุ่มเพิ่มให้อัตโนมัติ)',
        domSpec: [{ tag: 'input', id: 'taskInput', value: 'ซื้อของ' }, { tag: 'button', id: 'addBtn', text: 'เพิ่ม' }, { tag: 'ul', id: 'taskList' }],
        starter: 'document.getElementById("addBtn").addEventListener("click", function () {\n  \n});',
        preActions: [{ type: 'click', selector: '#addBtn' }],
        tests: [
          { type: 'dom-count', selector: 'li', count: 1, label: '#taskList ต้องมี <li> 1 อันหลังกดเพิ่ม' },
          { type: 'dom-text', selector: 'li', includes: 'ซื้อของ', label: '<li> ต้องมีข้อความ "ซื้อของ"' }
        ]
      },
      {
        title: 'เพิ่มหลายรายการ (ดึงค่าจริงจาก input)',
        instructions: 'แก้ li.textContent = "งานใหม่"; ให้ดึงค่าจริงจาก document.getElementById("taskInput").value แทน แล้วรันดู — ควรได้ทั้งหมด 2 รายการ ("ซื้อของ" เดิม + "ทำการบ้าน" จาก input)',
        domSpec: [{ tag: 'input', id: 'taskInput', value: 'ทำการบ้าน' }, { tag: 'button', id: 'addBtn', text: 'เพิ่ม' }, { tag: 'ul', id: 'taskList', children: [{ tag: 'li', text: 'ซื้อของ' }] }],
        starter: 'document.getElementById("addBtn").addEventListener("click", function () {\n  var li = document.createElement("li");\n  li.textContent = "งานใหม่";\n  document.getElementById("taskList").appendChild(li);\n});',
        preActions: [{ type: 'click', selector: '#addBtn' }],
        tests: [{ type: 'dom-count', selector: 'li', count: 2, label: 'ต้องมี <li> ทั้งหมด 2 อัน (เดิม 1 + เพิ่มใหม่ 1)' }]
      },
      {
        title: 'ทำเครื่องหมายว่าเสร็จแล้ว (classList)',
        instructions: 'เติมโค้ดในฟังก์ชัน ให้เพิ่ม class "done" ให้กับ #task1 (ใช้ classList.add) เมื่อกดปุ่ม แล้วรันดู',
        domSpec: [{ tag: 'ul', id: 'taskList', children: [{ tag: 'li', id: 'task1', text: 'ซื้อของ' }] }, { tag: 'button', id: 'doneBtn', text: 'ทำเสร็จแล้ว' }],
        previewCss: '.done{text-decoration:line-through;color:#999;}',
        starter: 'document.getElementById("doneBtn").addEventListener("click", function () {\n  \n});',
        preActions: [{ type: 'click', selector: '#doneBtn' }],
        tests: [{ type: 'dom-class', selector: '#task1', class: 'done', label: '#task1 ต้องมี class "done" หลังกดปุ่ม' }]
      },
      {
        title: 'ลบรายการด้วย remove()',
        instructions: 'เติมโค้ดในฟังก์ชัน ให้ลบ #task1 ออกจากหน้าเว็บด้วย document.getElementById("task1").remove(); แล้วรันดู',
        domSpec: [{ tag: 'ul', id: 'taskList', children: [{ tag: 'li', id: 'task1', text: 'ลบฉันด้วย' }] }, { tag: 'button', id: 'delBtn', text: 'ลบ' }],
        starter: 'document.getElementById("delBtn").addEventListener("click", function () {\n  \n});',
        preActions: [{ type: 'click', selector: '#delBtn' }],
        tests: [{ type: 'dom-count', selector: 'li', count: 0, label: 'ต้องไม่เหลือ <li> เลยหลังลบ' }]
      }
    ]
  },
  {
    /* โปรเจกต์ที่ 3: ฟอร์มติดต่อพร้อม validation (kind 'dom') */
    id: 'project-contact-form', kind: 'dom', label: 'โปรเจกต์: ฟอร์มติดต่อ', labelEn: 'Project: Contact Form',
    concept: {
      explain: 'โปรเจกต์ที่ 3: ฟอร์มติดต่อพร้อม validation — ตรวจสอบว่าผู้ใช้กรอกครบไหม (required), ตรวจรูปแบบอีเมลง่ายๆ ด้วย .includes("@"), และแสดงข้อความแจ้งเตือน/สำเร็จ รวมความรู้ Events & Forms เข้ากับตรรกะเงื่อนไข',
      example: 'if (email === "") {\n  errorMsg.textContent = "กรุณากรอกอีเมล";\n} else if (!email.includes("@")) {\n  errorMsg.textContent = "รูปแบบไม่ถูกต้อง";\n} else {\n  errorMsg.textContent = "สำเร็จ!";\n}',
      domSpec: [{ tag: 'input', id: 'demoInput' }, { tag: 'p', id: 'demoMsg' }]
    },
    exercises: [
      {
        title: 'ตรวจสอบว่ากรอกครบหรือไม่',
        instructions: 'เติม document.getElementById("errorMsg").textContent = "กรุณากรอกอีเมล"; ในเงื่อนไข if (บรรทัดว่าง) แล้วรันดู (ระบบจะกดปุ่มส่งให้อัตโนมัติ — ช่องอีเมลว่างเปล่าอยู่)',
        domSpec: [{ tag: 'input', id: 'emailInput', value: '' }, { tag: 'button', id: 'submitBtn', text: 'ส่ง' }, { tag: 'p', id: 'errorMsg' }],
        starter: 'document.getElementById("submitBtn").addEventListener("click", function () {\n  var email = document.getElementById("emailInput").value;\n  if (email === "") {\n    \n  }\n});',
        preActions: [{ type: 'click', selector: '#submitBtn' }],
        tests: [{ type: 'dom-text', selector: '#errorMsg', includes: 'กรุณากรอกอีเมล', label: '#errorMsg ต้องแสดงข้อความเตือน' }]
      },
      {
        title: 'ตรวจสอบรูปแบบอีเมลด้วย includes',
        instructions: 'เติม document.getElementById("errorMsg").textContent = "รูปแบบอีเมลไม่ถูกต้อง"; ในเงื่อนไข (บรรทัดว่าง) แล้วรันดู (ช่องอีเมลมีค่า "notanemail" ที่ไม่มี @ อยู่)',
        domSpec: [{ tag: 'input', id: 'emailInput', value: 'notanemail' }, { tag: 'button', id: 'submitBtn', text: 'ส่ง' }, { tag: 'p', id: 'errorMsg' }],
        starter: 'document.getElementById("submitBtn").addEventListener("click", function () {\n  var email = document.getElementById("emailInput").value;\n  if (!email.includes("@")) {\n    \n  }\n});',
        preActions: [{ type: 'click', selector: '#submitBtn' }],
        tests: [{ type: 'dom-text', selector: '#errorMsg', includes: 'รูปแบบอีเมลไม่ถูกต้อง', label: '#errorMsg ต้องแสดงข้อความแจ้งรูปแบบผิด' }]
      },
      {
        title: 'แสดงข้อความสำเร็จเมื่อกรอกถูกต้อง',
        instructions: 'เติม document.getElementById("errorMsg").textContent = "ส่งสำเร็จ!"; ในส่วน else (บรรทัดว่าง) แล้วรันดู — เพราะอีเมลที่กรอกถูกต้องแล้ว',
        domSpec: [{ tag: 'input', id: 'emailInput', value: 'test@email.com' }, { tag: 'button', id: 'submitBtn', text: 'ส่ง' }, { tag: 'p', id: 'errorMsg' }],
        starter: 'document.getElementById("submitBtn").addEventListener("click", function () {\n  var email = document.getElementById("emailInput").value;\n  if (email === "" || !email.includes("@")) {\n    document.getElementById("errorMsg").textContent = "กรอกอีเมลให้ถูกต้อง";\n  } else {\n    \n  }\n});',
        preActions: [{ type: 'click', selector: '#submitBtn' }],
        tests: [{ type: 'dom-text', selector: '#errorMsg', includes: 'ส่งสำเร็จ', label: '#errorMsg ต้องแสดง "ส่งสำเร็จ!"' }]
      },
      {
        title: 'รวม validation หลายเงื่อนไข',
        instructions: 'เติม document.getElementById("errorMsg2").textContent = "ส่งสำเร็จ!"; ในส่วน else สุดท้าย (บรรทัดว่าง) แล้วรันดู — ทั้งชื่อและอีเมลกรอกถูกต้องแล้ว',
        domSpec: [{ tag: 'input', id: 'nameInput', value: 'สมชาย' }, { tag: 'input', id: 'emailInput2', value: 'a@b.com' }, { tag: 'button', id: 'submitBtn2', text: 'ส่ง' }, { tag: 'p', id: 'errorMsg2' }],
        starter: 'document.getElementById("submitBtn2").addEventListener("click", function () {\n  var name = document.getElementById("nameInput").value;\n  var email = document.getElementById("emailInput2").value;\n  if (name === "") {\n    document.getElementById("errorMsg2").textContent = "กรุณากรอกชื่อ";\n  } else if (!email.includes("@")) {\n    document.getElementById("errorMsg2").textContent = "อีเมลไม่ถูกต้อง";\n  } else {\n    \n  }\n});',
        preActions: [{ type: 'click', selector: '#submitBtn2' }],
        tests: [{ type: 'dom-text', selector: '#errorMsg2', includes: 'ส่งสำเร็จ', label: '#errorMsg2 ต้องแสดง "ส่งสำเร็จ!"' }]
      }
    ]
  },
  {
    /* โปรเจกต์ที่ 4: แอปดึงข้อมูลจาก API มาแสดง (kind 'js' — รวม async/await + array/object)
       ใช้ mock function จำลอง API ด้วย setTimeout-based Promise (ไม่พึ่ง fetch จริง เหตุผลเดียวกับ
       แทร็ก Async/Fetch: ต้องทำงานออฟไลน์ได้ ไม่มี backend จริงให้เรียก) */
    id: 'project-api-fetch', kind: 'js', label: 'โปรเจกต์: แอปดึงข้อมูล API', labelEn: 'Project: API Fetch App',
    concept: {
      explain: 'โปรเจกต์สุดท้าย: จำลองการดึงข้อมูลจาก API (เหมือนเว็บจริงที่ดึงข้อมูลสินค้า/โพสต์ ฯลฯ) แล้วแสดงผลออกมา — รวมความรู้ทั้งหมดที่เรียนมา: async/await, อาร์เรย์, อ็อบเจกต์, ลูป เข้าด้วยกันในโปรเจกต์เดียว',
      example: 'async function main() {\n  let posts = await fetchPosts();\n  for (let i = 0; i < posts.length; i++) {\n    console.log(posts[i].title);\n  }\n}\nmain();'
    },
    exercises: [
      {
        title: 'ดึงข้อมูลด้วย async/await แล้ววนลูปแสดงผล',
        instructions: 'เติม for loop ในฟังก์ชัน main (บรรทัดว่าง) ให้วน console.log(posts[i].title); ทุกโพสต์ แล้วรันดู — ควรเห็นทั้ง "โพสต์แรก" และ "โพสต์ที่สอง"',
        starter: 'function fetchPosts() {\n  return new Promise(function (resolve) {\n    setTimeout(function () {\n      resolve([\n        { title: "โพสต์แรก" },\n        { title: "โพสต์ที่สอง" }\n      ]);\n    }, 100);\n  });\n}\n\nasync function main() {\n  let posts = await fetchPosts();\n  \n}\nmain();',
        settleMs: 400,
        tests: [
          { type: 'log-includes', expected: 'โพสต์แรก', label: 'ต้องแสดง "โพสต์แรก"' },
          { type: 'log-includes', expected: 'โพสต์ที่สอง', label: 'ต้องแสดง "โพสต์ที่สอง"' }
        ]
      },
      {
        title: 'กรองข้อมูลด้วย filter',
        instructions: 'เปลี่ยน let activeUsers = users; เป็น let activeUsers = users.filter(function (u) { return u.active; }); แล้วรันดู — ควรได้ 2 (เฉพาะคนที่ active: true)',
        starter: 'function fetchUsers() {\n  return new Promise(function (resolve) {\n    setTimeout(function () {\n      resolve([\n        { name: "สมชาย", active: true },\n        { name: "สมหญิง", active: false },\n        { name: "สมศักดิ์", active: true }\n      ]);\n    }, 100);\n  });\n}\n\nasync function main() {\n  let users = await fetchUsers();\n  let activeUsers = users;\n  console.log(activeUsers.length);\n}\nmain();',
        settleMs: 400,
        tests: [{ type: 'log-includes', expected: '2', label: 'ต้อง console.log(activeUsers.length) ออกมาเป็น 2' }]
      },
      {
        title: 'จัดการข้อผิดพลาดตอนดึงข้อมูลล้มเหลว',
        instructions: 'เติม console.log("โหลดข้อมูลล้มเหลว: " + err); ในบล็อก catch (บรรทัดว่าง) แล้วรันดู',
        starter: 'function fetchData() {\n  return new Promise(function (resolve, reject) {\n    setTimeout(function () {\n      reject("เซิร์ฟเวอร์ไม่ตอบสนอง");\n    }, 100);\n  });\n}\n\nasync function main() {\n  try {\n    let data = await fetchData();\n    console.log(data);\n  } catch (err) {\n    \n  }\n}\nmain();',
        settleMs: 400,
        tests: [{ type: 'log-includes', expected: 'โหลดข้อมูลล้มเหลว: เซิร์ฟเวอร์ไม่ตอบสนอง', label: 'ต้อง console.log ข้อความ error ที่ถูกต้อง' }]
      },
      {
        title: 'ดึงหลาย endpoint พร้อมกันด้วย Promise.all',
        instructions: 'เปลี่ยนบรรทัดสุดท้ายในฟังก์ชันเป็น console.log(results[0] + results[1]); แล้วรันดู — ควรได้ 15 (Promise.all รอทุกตัวพร้อมกัน เร็วกว่าการ await ทีละตัว)',
        starter: 'function fetchA() {\n  return new Promise(function (resolve) {\n    setTimeout(function () { resolve(5); }, 50);\n  });\n}\nfunction fetchB() {\n  return new Promise(function (resolve) {\n    setTimeout(function () { resolve(10); }, 50);\n  });\n}\n\nasync function main() {\n  let results = await Promise.all([fetchA(), fetchB()]);\n  console.log(results[0]);\n}\nmain();',
        settleMs: 400,
        tests: [{ type: 'log-includes', expected: '15', label: 'ต้อง console.log(results[0] + results[1]) ออกมาเป็น 15' }]
      }
    ]
  },
  {
    /* ══ Track D: เนื้อหาสายอาชีพ (ไม่มีโค้ดให้เขียน) — kind 'reading' ต่างจากทุก kind ก่อนหน้า
       ตรงที่ไม่มี code editor/test เลย มีแค่เนื้อหาให้อ่าน + ปุ่ม "ทำเครื่องหมายว่าอ่านแล้ว"
       (เรียก handlePassFail(true) ตรงๆ) เพื่อปลดล็อกหัวข้อถัดไป — ดู UI wiring ส่วน
       runBtnLabel()/selectItem()/runBtn click handler สำหรับ branch ของ kind นี้ */
    id: 'career-path', kind: 'reading', label: 'สายอาชีพนักพัฒนา', labelEn: 'Career Path',
    concept: {
      explain: 'เขียนโค้ดเป็นแล้ว ต่อไปคือเอาไปใช้หารายได้จริง! หมวดนี้ไม่มีโค้ดให้เขียน แต่มีความรู้จริงที่ช่วยให้คุณก้าวจาก "เขียนโค้ดได้" ไปเป็น "หารายได้จากการเขียนโค้ด" — อ่านแต่ละหัวข้อแล้วกดทำเครื่องหมายว่าอ่านแล้วเพื่อปลดล็อกหัวข้อถัดไป'
    },
    exercises: [
      {
        title: 'สร้างพอร์ตโฟลิโอ (Portfolio)',
        content: 'พอร์ตโฟลิโอคือสิ่งแรกที่ลูกค้า/บริษัทจะดูก่อนตัดสินใจจ้างคุณ — ควรมีอย่างน้อย 3-5 โปรเจกต์ที่ทำเสร็จสมบูรณ์ (ใช้โปรเจกต์จากแทร็ก "โปรเจกต์จบคอร์ส" ในเว็บนี้ได้เลย เช่น Landing Page, To-Do List, ฟอร์มติดต่อ) แต่ละโปรเจกต์ควรมี:\n\n- ลิงก์ไปดูเว็บที่ deploy ไว้จริง (ไม่ใช่แค่โค้ด)\n- ลิงก์ไปดูซอร์สโค้ดบน GitHub\n- คำอธิบายสั้นๆ ว่าโปรเจกต์นี้ทำอะไร ใช้เทคโนโลยีอะไรบ้าง\n\nเว็บไซต์พอร์ตโฟลิโอที่ดีไม่จำเป็นต้องซับซ้อน — เพจเดียวที่มีลิงก์ไปโปรเจกต์ทั้งหมดก็เพียงพอสำหรับเริ่มต้น'
      },
      {
        title: 'หางานผ่านแพลตฟอร์ม Freelance',
        content: 'แพลตฟอร์มยอดนิยมสำหรับหางานฟรีแลนซ์สายเขียนโค้ด:\n\n- Fastwork.co — แพลตฟอร์มไทย เหมาะสำหรับเริ่มต้น มีลูกค้าไทยเยอะ\n- Upwork.com / Fiverr.com — แพลตฟอร์มระดับโลก งานเยอะกว่าแต่แข่งขันสูงกว่า\n\nเทคนิคเริ่มต้น:\n1. เริ่มจากงานราคาไม่แพงเพื่อสร้างรีวิว/เรตติ้งก่อน\n2. เขียนโปรไฟล์ให้ชัดเจนว่าทำอะไรได้บ้าง แนบพอร์ตโฟลิโอ\n3. ตอบงานที่ตรงกับทักษะจริงๆ ไม่รับงานเกินความสามารถ\n4. ส่งงานตรงเวลาเสมอ — ความน่าเชื่อถือสำคัญกว่าความเร็ว'
      },
      {
        title: 'Deploy เว็บของคุณด้วย GitHub Pages',
        content: 'GitHub Pages คือบริการฟรีที่ให้คุณเอาเว็บ HTML/CSS/JS ธรรมดา (ไม่ต้องมี backend) ขึ้นออนไลน์ได้จริง — เว็บ Tanot ที่คุณกำลังใช้อยู่นี้ก็ deploy ด้วยวิธีเดียวกันนี้!\n\nขั้นตอนคร่าวๆ:\n1. สร้าง repository บน GitHub แล้วอัปโหลดไฟล์เว็บของคุณ (index.html เป็นต้น)\n2. ไปที่ Settings → Pages ของ repository\n3. เลือก branch ที่จะ deploy (มักเป็น main) แล้วกด Save\n4. รอสักครู่ จะได้ลิงก์แบบ https://ชื่อผู้ใช้.github.io/ชื่อ-repo/ ที่เปิดดูได้จริงจากทุกที่\n\nข้อดี: ฟรี 100%, เชื่อมกับ GitHub ที่มีอยู่แล้ว, เหมาะมากสำหรับใส่ลิงก์ในพอร์ตโฟลิโอ'
      },
      {
        title: 'ก้าวต่อไป: เส้นทางสายอาชีพนักพัฒนา',
        content: 'หลังพื้นฐานแน่นแล้ว เส้นทางที่ไปต่อได้มีหลายสาย:\n\n- Front-end Developer — เชี่ยวชาญ React/Vue เพิ่มเติมจาก HTML/CSS/JS ที่มีอยู่แล้ว\n- Back-end Developer — เรียนภาษาฝั่งเซิร์ฟเวอร์ (Node.js ใช้ JS ตัวเดียวกับที่เรียนมาได้เลย) + ฐานข้อมูล\n- Full-stack Developer — ทำได้ทั้งสองฝั่ง เป็นที่ต้องการสูงในตลาด\n\nคำแนะนำ: อย่ารีบกระโดดไปเรียนทุกอย่างพร้อมกัน — ทำโปรเจกต์จริงต่อเนื่อง สร้างพอร์ตโฟลิโอที่แข็งแรง แล้วค่อยๆ ขยายทักษะตามงานที่อยากทำ ทักษะเขียนโค้ดพื้นฐานที่เรียนจบในคอร์สนี้คือรากฐานที่ใช้ได้กับทุกสายที่กล่าวมา'
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
function runJsCode(code, tests, settleMs) {
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
    worker.postMessage({ jobId: jobId, code: code, tests: tests || [], settleMs: settleMs || 0 });
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
      if (test.type === 'html-count') return { label: test.label, pass: doc.querySelectorAll(test.selector).length === test.count };
      var el = doc.querySelector(test.selector);
      if (!el) return { label: test.label, pass: false };
      if (test.type === 'html-text') return { label: test.label, pass: (el.textContent || '').indexOf(test.includes) !== -1 };
      if (test.type === 'html-nonempty') return { label: test.label, pass: (el.textContent || '').trim().length > 0 };
      if (test.type === 'html-attr') return { label: test.label, pass: ((el.getAttribute(test.attr) || '')).indexOf(test.includes) !== -1 };
      if (test.type === 'html-has-attr') return { label: test.label, pass: el.hasAttribute(test.attr) };
      return { label: test.label, pass: false };
    } catch (e) { return { label: test.label, pass: false }; }
  });
}

/* ══════════════════════════════════════════════════════════════════
   ตัว serialize DOM จำลอง (ดู dom-runner-worker.js) กลับเป็น HTML string ธรรมดา — ใช้ 2 ที่:
   (1) แสดงสถานะ "ก่อนรัน" ในพรีวิว (จาก domSpec ตรงๆ ยังไม่มีการรันโค้ดอะไรเลย)
   (2) ก็อปปี้ตรรกะเดียวกันไว้ใน dom-runner-worker.js เพื่อ serialize สถานะ "หลังรัน" (จาก DOM
   จำลองที่โค้ดผู้เรียนแก้ไขแล้ว) — จงใจก็อปแทนแชร์ฟังก์ชันเดียวกันข้าม Worker/main thread
   (ธรรมเนียมเดิมของโปรเจกต์นี้: clone-and-adapt แทน shared abstraction ข้ามไฟล์ที่โหลดคนละบริบท)
   ══════════════════════════════════════════════════════════════════ */
function escapeHtmlText(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function elementSpecToHtml(el) {
  var styleStr = Object.keys(el.style || {}).map(function (k) {
    var cssProp = k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
    return cssProp + ': ' + el.style[k] + ';';
  }).join(' ');
  var classes = el.classes ? (Array.isArray(el.classes) ? el.classes : Object.keys(el.classes).filter(function (c) { return el.classes[c]; })) : [];
  var classStr = classes.join(' ');
  var attrsStr = Object.keys(el.attrs || {}).map(function (k) { return ' ' + k + '="' + escapeHtmlText(el.attrs[k]) + '"'; }).join('');
  var valueStr = (el.tag === 'input' || el.tag === 'textarea') && el.value ? ' value="' + escapeHtmlText(el.value) + '"' : '';
  var childrenHtml = (el.children || []).map(elementSpecToHtml).join('');
  return '<' + el.tag +
    (el.id ? ' id="' + el.id + '"' : '') +
    (classStr ? ' class="' + classStr + '"' : '') +
    (styleStr ? ' style="' + styleStr + '"' : '') +
    valueStr + attrsStr + '>' + escapeHtmlText(el.text) + childrenHtml + '</' + el.tag + '>';
}
function domSpecToHtml(domSpec, previewCss) {
  var body = (domSpec || []).map(elementSpecToHtml).join('\n');
  return (previewCss ? '<style>' + previewCss + '</style>\n' : '') + body;
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
    allPassed: 'ผ่านหมดทุกข้อ! ปลดล็อกข้อถัดไปแล้ว', notAllPassed: 'ยังไม่ผ่านครบทุกข้อ ลองแก้โค้ดแล้วรันใหม่อีกครั้ง',
    lockedMsg: 'ข้อนี้ยังไม่ปลดล็อก — ทำข้อก่อนหน้าให้ผ่านก่อน',
    exerciseTitle: 'แบบฝึกหัด {n}', tryExample: 'ลองรันตัวอย่างนี้ดูได้เลย แล้วลองแก้โค้ดเล่นดู',
    openFullBtn: 'เปิดดูเต็มจอ',
    toastTrackDone: 'จบแทร็ก "{track}" แล้ว! 🎉', toastBadge: 'ได้เหรียญตรา "{badge}"!',
    toastLevelUp: 'เลเวลอัป! ระดับ {level} — {title}',
    markReadBtn: 'ทำเครื่องหมายว่าอ่านแล้ว'
  },
  en: {
    pageTitle: 'Coding', crumbResp: 'Responsibilities', crumbCoding: 'Coding',
    conceptLabel: 'Explanation', runBtn: '▶ Run', running: 'Running…',
    outputLabel: 'Output (console.log)', previewLabel: 'Preview', testsLabel: 'Test Results',
    noOutput: '(No output yet — try clicking Run)', timeoutMsg: 'Your code took too long to run (possibly an infinite loop) — it was stopped automatically. Check your loop condition.',
    allPassed: 'All tests passed! Next exercise unlocked.', notAllPassed: "Not all tests passed yet — fix your code and run again.",
    lockedMsg: 'This exercise is locked — pass the previous one first.',
    exerciseTitle: 'Exercise {n}', tryExample: 'Try running this example, then experiment with the code.',
    openFullBtn: 'Open Fullscreen',
    toastTrackDone: 'Track "{track}" complete! 🎉', toastBadge: 'Badge earned: "{badge}"!',
    toastLevelUp: 'Level up! Level {level} — {title}',
    markReadBtn: 'Mark as Read'
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
  { id: 'track-js-functions', icon: '🧩', th: 'เจ้าฟังก์ชัน', en: 'Function Master' },
  { id: 'track-js-arrays', icon: '📦', th: 'นักอาร์เรย์', en: 'Array Master' },
  { id: 'track-js-objects', icon: '🗂️', th: 'นักอ็อบเจกต์', en: 'Object Master' },
  { id: 'track-html-basics', icon: '🧱', th: 'สถาปนิก HTML', en: 'HTML Architect' },
  { id: 'track-html-css', icon: '🎨', th: 'ดีไซเนอร์ CSS', en: 'CSS Designer' },
  { id: 'track-html-flexbox', icon: '📐', th: 'นักจัดวาง Flexbox', en: 'Flexbox Layout Pro' },
  { id: 'track-html-grid', icon: '🔲', th: 'นักจัดวาง Grid', en: 'Grid Layout Pro' },
  { id: 'track-html-responsive-forms', icon: '📱', th: 'นักออกแบบตอบสนอง', en: 'Responsive Pro' },
  { id: 'track-js-dom', icon: '🕹️', th: 'เจ้าแห่ง DOM', en: 'DOM Master' },
  { id: 'track-js-events-forms', icon: '📝', th: 'นักฟอร์ม', en: 'Forms Master' },
  { id: 'track-js-async', icon: '⏳', th: 'เจ้าแห่ง Async', en: 'Async Master' },
  { id: 'track-js-localstorage', icon: '💾', th: 'นักเก็บข้อมูล', en: 'Storage Master' },
  { id: 'track-project-landing-page', icon: '🏠', th: 'นักสร้าง Landing Page', en: 'Landing Page Builder' },
  { id: 'track-project-todo-list', icon: '📋', th: 'นักสร้างแอป To-Do', en: 'To-Do App Builder' },
  { id: 'track-project-contact-form', icon: '📨', th: 'นักสร้างฟอร์ม', en: 'Form Builder' },
  { id: 'track-project-api-fetch', icon: '🌐', th: 'นักสร้างแอป API', en: 'API App Builder' },
  { id: 'track-career-path', icon: '🎓', th: 'พร้อมหารายได้!', en: 'Career Ready!' },
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
  var trackMenuBtn = $('trackMenuBtn'), trackMenuPanel = $('trackMenuPanel'), currentTrackLabel = $('currentTrackLabel'),
      itemList = $('itemList'), lockMsg = $('lockMsg'),
      instructionsBox = $('instructionsBox'), codeTextarea = $('codeTextarea'), runBtn = $('runBtn'),
      outputPanel = $('outputPanel'), outputLog = $('outputLog'), htmlPreviewWrap = $('htmlPreviewWrap'),
      htmlPreview = $('htmlPreview'), testsPanel = $('testsPanel'), testsList = $('testsList'),
      resultBanner = $('resultBanner'), langToggle = $('langToggle'), outputLabel = $('outputLabelEl'),
      itemHeading = $('itemHeading'), openFullBtn = $('openFullBtn'),
      levelNumEl = $('levelNum'), levelTitleEl = $('levelTitleEl'), xpFillEl = $('xpFill'),
      streakCountEl = $('streakCount'), badgeRowEl = $('badgeRow'), toastWrap = $('toastWrap'),
      confettiLayer = $('confettiLayer'), editorWrapEl = $('editorWrap');

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
    runBtn.textContent = runBtnLabel();
    renderGamifyBar();
  }

  /* ปุ่มหลักเปลี่ยนความหมายตาม kind ของแทร็ก: kind ปกติ = "รัน" โค้ด, kind 'reading' (แทร็กสาย
     อาชีพ ไม่มีโค้ดให้เขียน) = "ทำเครื่องหมายว่าอ่านแล้ว" เพื่อปลดล็อกหัวข้อถัดไป */
  function runBtnLabel() {
    var track = trackById(state.trackId);
    return track.kind === 'reading' ? t('markReadBtn') : t('runBtn');
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

  /* จัดกลุ่มแทร็กในเมนู hamburger ตาม id/kind — ไม่ต้องเติม field ใหม่ในแต่ละ track object
     (derive จากข้อมูลที่มีอยู่แล้ว) ลำดับกลุ่มเรียงตามลำดับที่พบครั้งแรกใน TRACKS array */
  function trackGroupLabel(tr) {
    if (tr.id === 'career-path') return { th: 'สายอาชีพ', en: 'Career Path' };
    if (tr.id.indexOf('project-') === 0) return { th: 'โปรเจกต์จบคอร์ส', en: 'Capstone Projects' };
    if (tr.kind === 'html') return { th: 'HTML / CSS', en: 'HTML / CSS' };
    if (tr.id === 'js-dom' || tr.id === 'js-events-forms' || tr.id === 'js-async' || tr.id === 'js-localstorage') {
      return { th: 'JavaScript ขั้นสูง', en: 'Advanced JavaScript' };
    }
    return { th: 'JavaScript พื้นฐาน', en: 'JavaScript Basics' };
  }

  function closeTrackMenu() {
    trackMenuPanel.classList.remove('open');
    trackMenuBtn.classList.remove('open');
    trackMenuBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleTrackMenu() {
    var opening = !trackMenuPanel.classList.contains('open');
    trackMenuPanel.classList.toggle('open', opening);
    trackMenuBtn.classList.toggle('open', opening);
    trackMenuBtn.setAttribute('aria-expanded', opening ? 'true' : 'false');
  }
  trackMenuBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleTrackMenu(); });
  trackMenuPanel.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () { closeTrackMenu(); });

  function renderTrackTabs() {
    var lang = getUILang();
    var track = trackById(state.trackId);
    currentTrackLabel.textContent = lang === 'en' ? track.labelEn : track.label;

    trackMenuPanel.innerHTML = '';
    var lastGroup = null;
    TRACKS.forEach(function (tr) {
      var group = trackGroupLabel(tr);
      var groupText = lang === 'en' ? group.en : group.th;
      if (groupText !== lastGroup) {
        var groupEl = document.createElement('div');
        groupEl.className = 'cx-track-group-label';
        groupEl.textContent = groupText;
        trackMenuPanel.appendChild(groupEl);
        lastGroup = groupText;
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cx-track-menu-item' + (tr.id === state.trackId ? ' active' : '');
      btn.textContent = lang === 'en' ? tr.labelEn : tr.label;
      btn.addEventListener('click', function () { selectTrack(tr.id); closeTrackMenu(); });
      trackMenuPanel.appendChild(btn);
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
    var isDom = track.kind === 'dom';
    var isReading = track.kind === 'reading';
    htmlPreviewWrap.style.display = (isHtml || isDom) ? 'block' : 'none';
    outputPanel.style.display = (isHtml || isReading) ? 'none' : 'block'; /* คอนโซล log ไม่เกี่ยวกับแทร็ก HTML/reading เลย ซ่อนไปเลยแทนโชว์เปล่าๆ — DOM ยังโชว์ต่อ เผื่อ debug ด้วย console.log */
    if (openFullBtn) openFullBtn.style.display = isHtml ? 'inline-flex' : 'none'; /* แทร็ก DOM ไม่โชว์ปุ่มนี้ เพราะโค้ดที่พิมพ์เป็น JS ไม่ใช่ HTML แบบ standalone ที่เปิดตรงๆ ได้ */
    if (editorWrapEl) editorWrapEl.style.display = isReading ? 'none' : 'block'; /* แทร็ก reading (สายอาชีพ) ไม่มีโค้ดให้เขียน ซ่อนกล่องแก้ไขทั้งหมด */
    runBtn.textContent = runBtnLabel();

    var drafts = loadDrafts();
    var draftKey = progressKey(state.trackId, idx);

    if (idx === 0) {
      itemHeading.textContent = t('conceptLabel');
      instructionsBox.textContent = track.concept.explain + (isReading ? '' : ('\n\n' + t('tryExample')));
      setCode(isReading ? '' : (drafts[draftKey] !== undefined ? drafts[draftKey] : track.concept.example));
    } else {
      var ex = track.exercises[idx - 1];
      itemHeading.textContent = t('exerciseTitle', { n: idx }) + ': ' + ex.title;
      instructionsBox.textContent = isReading ? ex.content : ex.instructions;
      setCode(isReading ? '' : (drafts[draftKey] !== undefined ? drafts[draftKey] : ex.starter));
    }
    if (isHtml) updateHtmlPreview();
    else if (isDom) updateDomPreviewIdle();
  }

  function updateHtmlPreview() {
    /* sandbox="allow-scripts" ไม่มี allow-same-origin -> iframe อยู่คนละ origin (opaque) เข้าถึง
       cookie/localStorage ของหน้าเว็บหลักไม่ได้ — ฝั่ง parent ก็อ่าน contentDocument กลับไม่ได้
       เช่นกัน (ตั้งใจ) การตรวจแบบฝึกหัด HTML จึงใช้ DOMParser แยกต่างหาก ไม่ใช้ iframe นี้เลย */
    htmlPreview.srcdoc = getCode();
  }

  /* โชว์สถานะเริ่มต้นของ DOM (ก่อนกดรัน) ในพรีวิว — ใช้ domSpec ของแบบฝึกหัด/คำอธิบายปัจจุบัน
     เฉยๆ ยังไม่รันโค้ดอะไรทั้งนั้น (แค่ให้เห็นจุดตั้งต้นก่อนโค้ดจะเปลี่ยนอะไร) เป็น static HTML ล้วน
     ไม่มีสคริปต์เลย ปลอดภัย 100% */
  function updateDomPreviewIdle() {
    var track = trackById(state.trackId);
    var item = state.itemIndex === 0 ? track.concept : track.exercises[state.itemIndex - 1];
    htmlPreview.srcdoc = domSpecToHtml(item.domSpec, item.previewCss);
  }

  /* รันโค้ด JS ของผู้เรียนกับ "DOM จำลอง" ใน Web Worker แยก (dom-runner-worker.js) — เหตุผลที่ไม่ใช้
     iframe จริงรันโค้ดตรงๆ (ลองแล้วเจอปัญหาจริง: ลูปไม่รู้จบในสคริปต์ของ sandboxed iframe บล็อก
     event loop ของหน้าเว็บหลักไปด้วย ทำให้ตั้ง timeout ฝั่ง parent ไม่ได้ผล) ดูรายละเอียดที่หัวไฟล์
     dom-runner-worker.js — โครงสร้าง Promise/timeout/terminate เหมือน runJsCode() ทุกประการ */
  var domJobSeq = 0;
  function runDomCode(domSpec, jsCode, tests, preActions, previewCss) {
    return new Promise(function (resolve) {
      var worker;
      try { worker = new Worker('./dom-runner-worker.js'); }
      catch (e) { resolve({ runtimeError: 'สร้าง Worker ไม่สำเร็จ: ' + (e && e.message ? e.message : e) }); return; }
      var jobId = ++domJobSeq;
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
      worker.postMessage({ jobId: jobId, domSpec: domSpec, code: jsCode, tests: tests || [], preActions: preActions || [], previewCss: previewCss });
    });
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
    runBtn.textContent = b ? t('running') : runBtnLabel();
  }

  runBtn.addEventListener('click', async function () {
    if (state.busy) return;
    var track = trackById(state.trackId);

    if (track.kind === 'reading') {
      if (state.itemIndex === 0) return; /* หน้าภาพรวมไม่มีอะไรให้ "ทำเครื่องหมายว่าอ่านแล้ว" แยกจากการเลือกหัวข้อถัดไปเอง */
      handlePassFail(true);
      return;
    }

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

    if (track.kind === 'dom') {
      if (state.itemIndex === 0) { updateDomPreviewIdle(); return; } /* หน้าคำอธิบายไม่มี tests ให้รัน แค่โชว์ base */
      var exd = track.exercises[state.itemIndex - 1];
      setBusy(true);
      outputLog.innerHTML = '<div class="cx-output-empty">' + t('running') + '</div>';
      var resd = await runDomCode(exd.domSpec, code, exd.tests, exd.preActions, exd.previewCss);
      setBusy(false);
      if (resd.timeout) {
        renderOutput([]);
        resultBanner.textContent = t('timeoutMsg');
        resultBanner.className = 'cx-result-banner fail';
        resultBanner.style.display = 'block';
        return;
      }
      renderOutput(resd.logs);
      if (resd.runtimeError) {
        var errLineD = document.createElement('div');
        errLineD.className = 'cx-output-line err';
        errLineD.textContent = '❌ ' + resd.runtimeError;
        outputLog.appendChild(errLineD);
      }
      if (resd.previewHtml !== undefined) htmlPreview.srcdoc = resd.previewHtml;
      renderTests(resd.testResults);
      handlePassFail(!resd.runtimeError && resd.testResults && resd.testResults.length > 0 && resd.testResults.every(function (r) { return r.pass; }));
      return;
    }

    setBusy(true);
    outputLog.innerHTML = '<div class="cx-output-empty">' + t('running') + '</div>';
    var currentEx = state.itemIndex > 0 ? track.exercises[state.itemIndex - 1] : null;
    var res = await runJsCode(code, currentEx && currentEx.tests, currentEx && currentEx.settleMs);
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
  module.exports = { TRACKS: TRACKS, checkHtmlTests: checkHtmlTests, domSpecToHtml: domSpecToHtml };
}
})();
