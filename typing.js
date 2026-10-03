/* ══════════════════════════════════════════════════════════════════
   Tanot — typing.js
   สอนพิมพ์สัมผัส (touch typing) ไทย/อังกฤษ: บทเรียนไล่ระดับ (แถวกลาง → คีย์บอร์ดเต็ม →
   คำศัพท์ → ประโยค → แป้น Shift) วัดความเร็ว (WPM) และความแม่นยำแบบ real-time พร้อมคีย์บอร์ดเสมือน
   ไฮไลต์ปุ่มที่ต้องกดถัดไป — ประมวลผลทั้งหมดในเบราว์เซอร์ ไม่มีอะไรถูกอัปโหลดขึ้นเซิร์ฟเวอร์

   ขอบเขต: ผังแป้นพิมพ์ไทยเกษมณี (Kedmanee, มอก. 820-2538) ครบทั้ง 2 ชั้น (ไม่กด Shift / กด Shift)
   คู่กับผัง QWERTY ชั้นเดียวกัน — บทเรียนเดิมทุกบท (id ขึ้นต้น en-home … th-sentences) ใช้เฉพาะชั้นไม่กด
   Shift และไม่ถูกแก้เลย ส่วนบทชั้น Shift เป็น track ใหม่ (`en-shift*`, `th-shift-*`, ตั้ง `shift: true`)
   ความคืบหน้าผูกกับ `<trackId>::<ลำดับบท>` จึงห้ามเปลี่ยน id/ลำดับบทที่มีอยู่แล้ว เพิ่มได้เฉพาะต่อท้าย

   ตรวจคำตอบจาก "ตัวอักษรที่ได้จริง" (ค่าในช่องพิมพ์ / event.key) ไม่ใช้ keyCode — ใช้ได้ไม่ว่าเครื่องตั้งแป้นไทย
   เกษมณีหรือสลับภาษาผ่าน IME; ถ้าบทภาษาไทยได้ตัวอักษรละติน (event.key) จะขึ้นสถานะเตือนสั้นๆ ว่าแป้นไม่ใช่ภาษาไทย

   ผังแป้นทั้งสองชั้น (ตรวจทานได้ที่นี่ — tests/typing.spec.js อ่านตารางนี้เทียบกับ KB_ROWS ทุกปุ่ม)
   รูปแบบ: R<แถว> <ชั้น>: ตามลำดับปุ่มซ้าย→ขวา คั่นด้วยช่องว่าง (อักขระผสม เช่น ุ ็ แสดงเดี่ยวๆ ได้)
   R1 en  : ` 1 2 3 4 5 6 7 8 9 0 - =
   R1 EN^ : ~ ! @ # $ % ^ & * ( ) _ +
   R1 th  : _ ๅ / - ภ ถ ุ ึ ค ต จ ข ช
   R1 TH^ : % + ๑ ๒ ๓ ๔ ู ฿ ๕ ๖ ๗ ๘ ๙
   R2 en  : q w e r t y u i o p [ ] \
   R2 EN^ : Q W E R T Y U I O P { } |
   R2 th  : ๆ ไ ำ พ ะ ั ี ร น ย บ ล ฃ
   R2 TH^ : ๐ " ฎ ฑ ธ ํ ๊ ณ ฯ ญ ฐ , ฅ
   R3 en  : a s d f g h j k l ; '
   R3 EN^ : A S D F G H J K L : "
   R3 th  : ฟ ห ก ด เ ้ ่ า ส ว ง
   R3 TH^ : ฤ ฆ ฏ โ ฌ ็ ๋ ษ ศ ซ .
   R4 en  : z x c v b n m , . /
   R4 EN^ : Z X C V B N M < > ?
   R4 th  : ผ ป แ อ ิ ื ท ม ใ ฝ
   R4 TH^ : ( ) ฉ ฮ ฺ ์ ? ฒ ฬ ฦ
   (ตัวที่มักสลับ: ฃ ฅ ฦ ๅ ฯ — ฃ ๅ อยู่ชั้นไม่กด Shift · ฅ ฯ ฦ อยู่ชั้น Shift · เลขไทย ๑–๙ อยู่ชั้น Shift ของปุ่ม 2–0 - =
   ส่วน ๐ อยู่ชั้น Shift ของปุ่ม q)
   ══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ══════════════════════════════════════════════════════════════════
   ผังแป้นพิมพ์ (สำหรับวาดคีย์บอร์ดเสมือน + หาตำแหน่งปุ่มที่ต้องกดถัดไป)
   แต่ละปุ่ม = [en, th, enShift, thShift] — สองตัวแรกคืออักษรที่ได้เมื่อไม่กด Shift (ลำดับเดิม ห้ามสลับ
   เพราะโค้ดเก่าอ่าน key[0]/key[1]) สองตัวหลังคืออักษรเมื่อกด Shift ค้าง · ตรงกับตารางในคอมเมนต์หัวไฟล์
   ══════════════════════════════════════════════════════════════════ */
var KB_ROWS = [
  [['`','_','~','%'],['1','ๅ','!','+'],['2','/','@','๑'],['3','-','#','๒'],['4','ภ','$','๓'],['5','ถ','%','๔'],['6','ุ','^','ู'],['7','ึ','&','฿'],['8','ค','*','๕'],['9','ต','(','๖'],['0','จ',')','๗'],['-','ข','_','๘'],['=','ช','+','๙']],
  [['q','ๆ','Q','๐'],['w','ไ','W','"'],['e','ำ','E','ฎ'],['r','พ','R','ฑ'],['t','ะ','T','ธ'],['y','ั','Y','ํ'],['u','ี','U','๊'],['i','ร','I','ณ'],['o','น','O','ฯ'],['p','ย','P','ญ'],['[','บ','{','ฐ'],[']','ล','}',','],['\\','ฃ','|','ฅ']],
  [['a','ฟ','A','ฤ'],['s','ห','S','ฆ'],['d','ก','D','ฏ'],['f','ด','F','โ'],['g','เ','G','ฌ'],['h','้','H','็'],['j','่','J','๋'],['k','า','K','ษ'],['l','ส','L','ศ'],[';','ว',':','ซ'],["'",'ง','"','.']],
  [['z','ผ','Z','('],['x','ป','X',')'],['c','แ','C','ฉ'],['v','อ','V','ฮ'],['b','ิ','B','ฺ'],['n','ื','N','์'],['m','ท','M','?'],[',','ม','<','ฒ'],['.','ใ','>','ฬ'],['/','ฝ','?','ฦ']]
];
var HOME_KEYS_EN = ['a','s','d','f','j','k','l',';'];

/* ตารางย้อนกลับ: อักษร -> ตำแหน่งปุ่ม {r,c,shift} — ใช้หาว่าอักษรถัดไปที่ต้องพิมพ์อยู่ปุ่มไหนและต้องกด Shift ไหม
   (ใส่ชั้นไม่กด Shift ก่อน ไม่ทับตัวที่มีอยู่แล้ว — tests/typing.spec.js ยืนยันว่าไม่มีอักษรซ้ำข้ามชั้น) */
function buildCharMap(baseIdx) {
  var map = {};
  [false, true].forEach(function (shift) {
    KB_ROWS.forEach(function (row, r) {
      row.forEach(function (key, c) {
        var ch = key[baseIdx + (shift ? 2 : 0)];
        if (!(ch in map)) map[ch] = { r: r, c: c, shift: shift };
      });
    });
  });
  map[' '] = { space: true };
  return map;
}
var EN_CHAR_MAP = buildCharMap(0);
var TH_CHAR_MAP = buildCharMap(1);

/* ══════════════════════════════════════════════════════════════════
   โซนสีนิ้ว (แนวทางเดียวกับแอปสอนพิมพ์มืออาชีพ เช่น RapidTyping/Typiq) — คำนวณจากตำแหน่งคอลัมน์
   ในแต่ละแถว (ไม่ผูกกับอักษร เพราะตำแหน่งนิ้วอ้างอิงตามตำแหน่งแป้นจริง ใช้ได้ทั้งผัง EN/TH)
   8 นิ้ว: ก้อยซ้าย(lp) นางซ้าย(lr) กลางซ้าย(lm) ชี้ซ้าย(li) ชี้ขวา(ri) กลางขวา(rm) นางขวา(rr) ก้อยขวา(rp)
   ══════════════════════════════════════════════════════════════════ */
function fingerFor(r, c) {
  if (r === 0) { /* ` 1 2 3 4 5 6 7 8 9 0 - = */
    if (c <= 1) return 'lp'; if (c === 2) return 'lr'; if (c === 3) return 'lm';
    if (c === 4 || c === 5) return 'li'; if (c === 6 || c === 7) return 'ri';
    if (c === 8) return 'rm'; if (c === 9) return 'rr'; return 'rp';
  }
  if (r === 1) { /* q w e r t y u i o p [ ] */
    if (c === 0) return 'lp'; if (c === 1) return 'lr'; if (c === 2) return 'lm';
    if (c === 3 || c === 4) return 'li'; if (c === 5 || c === 6) return 'ri';
    if (c === 7) return 'rm'; if (c === 8) return 'rr'; return 'rp';
  }
  if (r === 2) { /* a s d f g h j k l ; ' */
    if (c === 0) return 'lp'; if (c === 1) return 'lr'; if (c === 2) return 'lm';
    if (c === 3 || c === 4) return 'li'; if (c === 5 || c === 6) return 'ri';
    if (c === 7) return 'rm'; if (c === 8) return 'rr'; return 'rp';
  }
  /* r === 3: z x c v b n m , . / */
  if (c === 0) return 'lp'; if (c === 1) return 'lr'; if (c === 2) return 'lm';
  if (c === 3 || c === 4) return 'li'; if (c === 5 || c === 6) return 'ri';
  if (c === 7) return 'rm'; return c === 8 ? 'rr' : 'rp';
}
/* มือที่กดปุ่ม (l/r) และฝั่งปุ่ม Shift ที่ต้องกด — ตามหลักพิมพ์สัมผัสใช้ Shift ฝั่งตรงข้ามกับมือที่กดอักษร */
function handOf(r, c) { return fingerFor(r, c).charAt(0); }
function shiftSideFor(r, c) { return handOf(r, c) === 'l' ? 'r' : 'l'; }
var FINGER_NAMES = {
  lp: { th: 'ก้อยซ้าย', en: 'Left Pinky' }, lr: { th: 'นางซ้าย', en: 'Left Ring' },
  lm: { th: 'กลางซ้าย', en: 'Left Middle' }, li: { th: 'ชี้ซ้าย', en: 'Left Index' },
  ri: { th: 'ชี้ขวา', en: 'Right Index' }, rm: { th: 'กลางขวา', en: 'Right Middle' },
  rr: { th: 'นางขวา', en: 'Right Ring' }, rp: { th: 'ก้อยขวา', en: 'Right Pinky' },
  thumb: { th: 'โป้ง (เว้นวรรค)', en: 'Thumb (space)' }
};
var FINGER_ORDER = ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp'];

/* ══════════════════════════════════════════════════════════════════
   บทเรียน — แบ่งเป็น track (ไทย/อังกฤษ x แถวกลาง/คีย์บอร์ดเต็ม/คำศัพท์/ประโยค)
   ══════════════════════════════════════════════════════════════════ */
var TRACKS = [
  {
    id: 'en-home', lang: 'en', label: 'แถวกลาง', labelEn: 'Home Row',
    desc: '',
    lessons: [
      { title: 'พื้นฐาน a s d f', text: 'asdf asdf asdf fdsa fdsa asdf jaaa' },
      { title: 'พื้นฐาน j k l ;', text: 'jkl; jkl; jkl; ;lkj ;lkj jkl; fjjj' },
      { title: 'รวมสองมือ', text: 'asdf jkl; asdf jkl; fj fj dk dk sl sl a; a;' },
      { title: 'คำสั้นแถวกลาง', text: 'ask fall lads salad flask alas add jak' },
      { title: 'ประโยคแถวกลาง', text: 'a sad lad asks a lass; a flask falls; add salad' }
    ]
  },
  {
    id: 'en-full', lang: 'en', label: 'คีย์บอร์ดเต็ม', labelEn: 'Full Keyboard',
    desc: '',
    lessons: [
      { title: 'แถวบน q-p', text: 'qwert yuiop qwert yuiop trewq poiuy' },
      { title: 'แถวล่าง z-/', text: 'zxcvb nm,./ zxcvb nm,./ bvcxz /.,mn' },
      { title: 'รวมทุกแถว', text: 'the quick brown fox jumps over the lazy dog' },
      { title: 'ฝึกความแม่นยำ', text: 'we type fast and accurate every single day' },
      { title: 'ฝึกความเร็ว', text: 'practice makes perfect when you type daily without looking down' }
    ]
  },
  {
    id: 'en-words', lang: 'en', label: 'คำศัพท์', labelEn: 'Common Words',
    desc: '',
    lessons: [
      { title: 'คำศัพท์ชุด 1', text: 'the of and a to in is you that it he was for on are' },
      { title: 'คำศัพท์ชุด 2', text: 'as with his they at be this from have or one had by word' },
      { title: 'คำศัพท์ชุด 3', text: 'but not what all were we when your can said there use each' }
    ]
  },
  {
    id: 'en-sentences', lang: 'en', label: 'ประโยค', labelEn: 'Sentences',
    desc: '',
    lessons: [
      { title: 'ประโยคที่ 1', text: 'Practice typing every day to become faster and more accurate.' },
      { title: 'ประโยคที่ 2', text: 'A good typist keeps their eyes on the screen, not the keyboard.' },
      { title: 'ประโยคที่ 3', text: 'Learning to touch type will save you time in the long run.' },
      { title: 'ประโยคที่ 4', text: 'Speed comes naturally once accuracy becomes a habit.' },
      { title: 'ประโยคที่ 5', text: 'Take a short break if your fingers start to feel tired.' }
    ]
  },
  {
    id: 'th-home', lang: 'th', label: 'แถวกลาง (ไทย)', labelEn: 'Home Row (Thai)',
    desc: '',
    lessons: [
      { title: 'พื้นฐาน ฟ ห ก ด', text: 'ฟหกด ฟหกด ฟหกด ดกหฟ ฟหกด' },
      { title: 'พื้นฐาน ่ า ส ว', text: 'ก่า ห่า ด่า ส่า ก่า ห่า ว่า ว่า' },
      { title: 'รวมสองมือ', text: 'ฟหกด ่าสว กา หา ดา ดาว หาก สาก ฟาก ว่า ด่า' },
      { title: 'เติมแป้นชิด (เ ้ ง)', text: 'เกา เดา เสา เงา ก้า ห้า ด้า ส้า' },
      { title: 'ทบทวนแถวกลาง', text: 'กา หา ดาว สาก ฟาก เกา เดา ก้า ห้า ว่า ด่า เงา' }
    ]
  },
  {
    id: 'th-full', lang: 'th', label: 'คีย์บอร์ดเต็ม (ไทย)', labelEn: 'Full Keyboard (Thai)',
    desc: '',
    lessons: [
      { title: 'แถวบน', text: 'ไป มา ไทย นก บาน รัก บัว ปี น้ำ' },
      { title: 'แถวล่าง', text: 'มือ ทะเล แดด ฝน ใจ อาหาร ปลา แปะ' },
      { title: 'คำในชีวิตประจำวัน', text: 'กิน ดี ไป น้ำ บ้าน รัก สวย หนัง อาหาร เพื่อน' },
      { title: 'คำสองพยางค์', text: 'ครอบครัว ทะเล แดดจ้า สวยงาม เพื่อนบ้าน หนังสือ' },
      { title: 'ทบทวนทุกแถว', text: 'วันนี้ฝนตก เพื่อนชวนไปกินอาหารทะเล ที่บ้านมีแมวสวย' }
    ]
  },
  {
    id: 'th-words', lang: 'th', label: 'คำศัพท์ (ไทย)', labelEn: 'Common Words (Thai)',
    desc: '',
    lessons: [
      { title: 'คำศัพท์ชุด 1', text: 'กิน นอน ดู ฟัง พูด เดิน วิ่ง ทำ มา ไป อยู่ ยืน นั่ง' },
      { title: 'คำศัพท์ชุด 2', text: 'บ้าน รถ น้ำ ไฟ ข้าว ปลา ผัก ผลไม้ เสื้อ กางเกง' },
      { title: 'คำศัพท์ชุด 3', text: 'พ่อ แม่ พี่ น้อง เพื่อน ครู หมอ ตำรวจ ทหาร คนขับรถ' }
    ]
  },
  {
    id: 'th-sentences', lang: 'th', label: 'ประโยค (ไทย)', labelEn: 'Sentences (Thai)',
    desc: '',
    lessons: [
      { title: 'ประโยคที่ 1', text: 'วันนี้อากาศดีมาก เหมาะแก่การไปเที่ยวทะเล' },
      { title: 'ประโยคที่ 2', text: 'ฝึกพิมพ์ดีดทุกวันจะช่วยให้พิมพ์ได้เร็วและแม่นยำขึ้น' },
      { title: 'ประโยคที่ 3', text: 'เพื่อนบ้านชวนไปกินอาหารทะเลที่ร้านใหม่ริมทะเล' },
      { title: 'ประโยคที่ 4', text: 'ครอบครัวของฉันชอบไปเที่ยวทะเลกันทุกปี' },
      { title: 'ประโยคที่ 5', text: 'อย่าลืมวางนิ้วบนแป้นกลางแล้วมองจอ ไม่ต้องมองแป้นพิมพ์' }
    ]
  },
  {
    id: 'en-shift', lang: 'en', shift: true, label: 'Shift (อังกฤษ)', labelEn: 'Shift Keys (English)',
    desc: '',
    lessons: [
      { title: 'ตัวใหญ่ มือซ้าย', text: 'Sam Ted Eve Ada Fred Greg Bart Cara Dave Zara' },
      { title: 'ตัวใหญ่ มือขวา', text: 'Kim Lily Paul Joy Holly Molly Neil Jill Uma Owen' },
      { title: 'ตัวใหญ่ ผสม', text: 'Mary and John met Paul in London and Paris' },
      { title: 'เครื่องหมาย ! @ # $ %', text: 'Wow! #1 $50 100% me@mail.com' },
      { title: 'เครื่องหมาย ( ) : " ?', text: 'Note: (ok) "Yes" or "No"?' },
      { title: 'เครื่องหมายอื่นๆ', text: 'Tom & Jerry: A+ * a_b {x} <y> a|b ~z ^w' }
    ]
  },
  {
    id: 'en-shift-sentences', lang: 'en', shift: true, label: 'Shift: ประโยค (อังกฤษ)', labelEn: 'Shift Sentences (English)',
    desc: '',
    lessons: [
      { title: 'ประโยคที่ 1', text: 'Hello! My name is Anna, and I live in Bangkok.' },
      { title: 'ประโยคที่ 2', text: 'Do you know where Tom works? He works in London.' },
      { title: 'ประโยคที่ 3', text: 'Wow! Thank you very much, Professor Smith.' },
      { title: 'ประโยคที่ 4', text: 'She said, "Practice makes perfect," and smiled.' },
      { title: 'ประโยคที่ 5', text: 'Email me at Jane@Example.com by 5:30 PM (Monday).' }
    ]
  },
  {
    id: 'th-shift-letters', lang: 'th', shift: true, label: 'Shift: อักษร (ไทย)', labelEn: 'Shift Letters (Thai)',
    desc: '',
    lessons: [
      { title: 'ศ ซ โ', text: 'ศาล ศอก ศาลา ซอง ซอย ซื้อ โรง โลก โมง โกง' },
      { title: 'ธ ฉ ฮ', text: 'ธง ธนู ธาตุ ฉาก ฉัน ฉลาด ฮา ฮีโร่ ธุรกิจ' },
      { title: 'ณ ญ ษ ฤ', text: 'คุณ เณร หญิง หญ้า ปัญญา ปรัชญา บุญ ญาติ พิษ ฤษี' },
      { title: 'สระ ็ ู', text: 'เด็ก เล็ก เห็น เป็น ก็ ดู ครู หมู ผู้ชาย ผู้หญิง' },
      { title: 'วรรณยุกต์ ๊ ๋ และ ์', text: 'โต๊ะ ก๋วยเตี๋ยว ศิลป์ จันทร์ ฟิล์ม ซอฟต์แวร์ โทรทัศน์' },
      { title: 'ตัวที่ใช้น้อย', text: 'ฆ่า ฆ้อง ฌาน กฎ ฎีกา ปฏิทิน มณฑล บัณฑิต ผู้เฒ่า กีฬา นาฬิกา จุฬา ฤดู ฤทธิ์ ฐาน ฐานะ' },
      { title: 'อักษรโบราณ ฃ ฅ ฦ', text: 'ฃ ฅ ฦ ฃ ฅ ฦ ฃ ฅ ฦ' }
    ]
  },
  {
    id: 'th-shift-numbers', lang: 'th', shift: true, label: 'Shift: เลขไทย/เครื่องหมาย', labelEn: 'Shift Numbers (Thai)',
    desc: '',
    lessons: [
      { title: 'เลขไทย ๑–๕', text: '๑ ๒ ๓ ๔ ๕ ๑๒ ๒๓ ๓๔ ๔๕ ๕๑ ๑๒๓ ๓๔๕' },
      { title: 'เลขไทย ๖–๙ และ ๐', text: '๖ ๗ ๘ ๙ ๐ ๖๗ ๗๘ ๘๙ ๙๐ ๐๖ ๖๗๘ ๘๙๐' },
      { title: 'ตัวเลขในชีวิตจริง', text: 'ราคา ๑๒๕ บาท ปี ๒๕๖๙ ๑๐ คน ๓๐ นาที ๕๐๐ กรัม ๗๗ จังหวัด' },
      { title: 'เครื่องหมาย', text: 'กรุงเทพฯ ลด ๕๐% ราคา ฿๙๙ (รวมภาษี) "สวัสดี" ใช่ไหม? ๑ + ๑ ได้ ๒' }
    ]
  },
  {
    id: 'th-shift-words', lang: 'th', shift: true, label: 'Shift: คำศัพท์ (ไทย)', labelEn: 'Shift Words (Thai)',
    desc: '',
    lessons: [
      { title: 'คำศัพท์ชุด 1', text: 'ศาลา ศาสนา ศึกษา ศิลปะ ศูนย์ ศัพท์ ศรี ศักดิ์' },
      { title: 'คำศัพท์ชุด 2', text: 'ธนาคาร ธรรมชาติ ธุรกิจ ธงชาติ ฉบับ ฉลาด ฉลอง โรงเรียน โรงพยาบาล โทรศัพท์' },
      { title: 'คำศัพท์ชุด 3', text: 'ซื้อของ ซักผ้า ซุปไก่ ผู้ใหญ่ หญิงสาว คุณครู ปัญหา สุขภาพ' },
      { title: 'คำศัพท์ชุด 4', text: 'วิทยาศาสตร์ คอมพิวเตอร์ อินเทอร์เน็ต ซอฟต์แวร์ โทรทัศน์ เครื่องมือ' }
    ]
  },
  {
    id: 'th-shift-sentences', lang: 'th', shift: true, label: 'Shift: ประโยค (ไทย)', labelEn: 'Shift Sentences (Thai)',
    desc: '',
    lessons: [
      { title: 'ประโยคที่ 1', text: 'ครูศิลปะสอนเด็กวาดรูปที่ศาลา' },
      { title: 'ประโยคที่ 2', text: 'คุณครูให้นักเรียนศึกษาธรรมชาติรอบโรงเรียน' },
      { title: 'ประโยคที่ 3', text: 'เด็กๆ ชอบเล่นกีฬาและดูโทรทัศน์ตอนเย็น' },
      { title: 'ประโยคที่ 4', text: 'ผู้เฒ่าเล่าว่าฤดูฝนปีนี้ฝนตกหนักมาก' },
      { title: 'ประโยคที่ 5', text: 'ธนาคารเปิดทำการเวลา ๘.๓๐ น. ถึง ๑๖.๓๐ น.' },
      { title: 'ประโยคที่ 6', text: 'เขาถามว่า "ไปด้วยกันไหม?" แล้วเราก็ยิ้ม' }
    ]
  }
];

function trackById(id) {
  for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return TRACKS[i];
  return TRACKS[0];
}

/* ══════════════════════════════════════════════════════════════════
   บันทึกความคืบหน้า (WPM/ความแม่นยำที่ดีที่สุดต่อบทเรียน)
   ══════════════════════════════════════════════════════════════════ */
var PROGRESS_KEY = 'tanot:typing:progress';
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch (e) { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) {}
}
function progressKey(trackId, lessonIdx) { return trackId + '::' + lessonIdx; }

/* ปลดล็อกบทเรียนตามลำดับ: บทแรกของทุก track ปลดล็อกเสมอ บทถัดไปต้องทำบทก่อนหน้าให้ความแม่นยำ
   อย่างน้อย UNLOCK_MIN_ACC% ก่อน — ใช้ "ความแม่นยำ" ล้วนๆ ไม่ผูกกับ WPM เพราะความเร็วเป้าหมายที่
   เหมาะสมต่างกันมากระหว่างคนละคน/คนละภาษา (พิมพ์ไทยมักช้ากว่าอังกฤษโดยธรรมชาติเพราะตัวอักษร/
   วรรณยุกต์ซับซ้อนกว่า) แต่ความแม่นยำเป็นมาตรฐานเดียวที่ยุติธรรมกับทุก track */
var UNLOCK_MIN_ACC = 75;
var TYPING_XP_LESSON = 5;
var TYPING_XP_SPRINT = 10;
function isUnlocked(track, idx, progress) {
  if (idx === 0) return true;
  var prev = progress[progressKey(track.id, idx - 1)];
  return !!prev && prev.acc >= UNLOCK_MIN_ACC;
}

/* ══════════════════════════════════════════════════════════════════
   โหมดทดสอบจับเวลา 60 วินาที — สุ่มคำจากคลังคำศัพท์ของภาษานั้นๆ (ก็อปจาก track *-words ที่มีอยู่แล้ว)
   มาต่อกันเป็นข้อความยาวมากๆ (สลับหลายรอบ) ให้พอสำหรับพิมพ์ได้ตลอด 60 วิ ไม่มีใครพิมพ์ทันจริงๆ
   ══════════════════════════════════════════════════════════════════ */
var SPRINT_SECONDS = 60;
function buildSprintText(lang) {
  var words = [];
  TRACKS.forEach(function (tr) {
    if (tr.shift || tr.lang !== lang || tr.id.indexOf('-words') === -1) return; /* ชุดคำของรอบจับเวลาไม่รวมบทชั้น Shift */
    tr.lessons.forEach(function (l) { words = words.concat(l.text.split(/\s+/).filter(Boolean)); });
  });
  var pool = [];
  for (var rep = 0; rep < 20; rep++) {
    var shuffled = words.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }
    pool = pool.concat(shuffled);
  }
  return pool.join(' ');
}

var SPRINT_KEY = 'tanot:typing:sprint';
function loadSprintBest() {
  try { return JSON.parse(localStorage.getItem(SPRINT_KEY)) || {}; } catch (e) { return {}; }
}
function saveSprintBest(b) { try { localStorage.setItem(SPRINT_KEY, JSON.stringify(b)); } catch (e) {} }

/* แสดง/ซ่อนสีโซนนิ้วบนคีย์บอร์ดเสมือน — ค้างค่าไว้ (เปิดเป็นค่าเริ่มต้น) */
var FINGER_COLOR_KEY = 'tanot:typing:fingercolors';
function getFingerColorsOn() {
  try { return localStorage.getItem(FINGER_COLOR_KEY) !== '0'; } catch (e) { return true; }
}
function setFingerColorsOn(on) { try { localStorage.setItem(FINGER_COLOR_KEY, on ? '1' : '0'); } catch (e) {} }

/* ══════════════════════════════════════════════════════════════════
   ภาษา UI (ไทย/อังกฤษ) — คนละ key กับหน้าอื่น (แต่ละหน้าเก็บของตัวเอง ดูเหตุผลเดียวกับ doc-check.js)
   ══════════════════════════════════════════════════════════════════ */
var UI_LANG_KEY = 'ome:lang'; /* จุดกลางเดียวทั้งเว็บ (เดิม 'tanot:typinglang') */
function getUILang() {
  try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; }
}
function setUILang(l) { try { localStorage.setItem(UI_LANG_KEY, l); } catch (e) {} }

var I18N = {
  th: {
    pageTitle: 'สอนพิมพ์', pageDesc: '',
    crumbResp: 'งานที่รับผิดชอบ', crumbTyping: 'สอนพิมพ์',
    statsWpm: 'คำ/นาที', statsAcc: 'ความแม่นยำ', statsTime: 'เวลา',
    resultTitle: 'จบบทเรียนแล้ว!', resultWpm: 'ความเร็ว', resultAcc: 'ความแม่นยำ', resultBest: 'สถิติที่ดีที่สุด',
    btnRetry: 'ฝึกซ้ำ', btnNext: 'บทถัดไป', btnRestartHint: 'พิมพ์เพื่อเริ่มบทเรียน',
    thaiKbWarn: 'แป้นพิมพ์ยังไม่ใช่ภาษาไทย (เกษมณี)',
    clickToFocus: 'คลิกที่นี่เพื่อเริ่มพิมพ์',
    lockedMsg: 'บทนี้ยังไม่ปลดล็อก — ทำบทก่อนหน้าให้ความแม่นยำอย่างน้อย ' + UNLOCK_MIN_ACC + '% ก่อน',
    fingerLabel: 'นิ้ว', showFingerColors: 'แสดงสีโซนนิ้ว',
    sprintEn: 'ทดสอบจับเวลา 60 วิ (อังกฤษ)', sprintTh: 'ทดสอบจับเวลา 60 วิ (ไทย)',
    sprintResultTitle: 'หมดเวลา!', sprintBest: 'สถิติที่ดีที่สุด', statsTimeLeft: 'เวลาที่เหลือ',
    backToLessons: 'กลับไปฝึกบทเรียน'
  },
  en: {
    pageTitle: 'Typing Tutor', pageDesc: '',
    crumbResp: 'Responsibilities', crumbTyping: 'Typing Tutor',
    statsWpm: 'WPM', statsAcc: 'Accuracy', statsTime: 'Time',
    resultTitle: 'Lesson complete!', resultWpm: 'Speed', resultAcc: 'Accuracy', resultBest: 'Best score',
    btnRetry: 'Retry', btnNext: 'Next Lesson', btnRestartHint: 'Start typing to begin',
    thaiKbWarn: 'Keyboard is not set to Thai (Kedmanee)',
    clickToFocus: 'Click here to start typing',
    lockedMsg: 'This lesson is locked — complete the previous one with at least ' + UNLOCK_MIN_ACC + '% accuracy first',
    fingerLabel: 'Finger', showFingerColors: 'Show finger color zones',
    sprintEn: '60-Second Sprint (English)', sprintTh: '60-Second Sprint (Thai)',
    sprintResultTitle: "Time's up!", sprintBest: 'Best score', statsTimeLeft: 'Time Left',
    backToLessons: 'Back to lessons'
  }
};
/* เช็คด้วย !== undefined แทน truthy-check ตรงๆ — บาง key (เช่น desc ของบาง track/pageDesc)
   ตั้งใจให้เป็นสตริงว่างจริงๆ ('' เป็น falsy) ถ้าใช้ || เฉยๆ จะเข้าใจผิดว่า "ไม่มี key นี้" แล้ว
   fallback ไปคืนชื่อ key ดิบๆ ออกมาแทน (บั๊กที่เจอจริงตอนลบข้อความ desc ออก) */
function t(key) {
  var l = getUILang();
  if (I18N[l] && I18N[l][key] !== undefined) return I18N[l][key];
  if (I18N.th[key] !== undefined) return I18N.th[key];
  return key;
}

/* ══════════════════════════════════════════════════════════════════
   UI wiring
   ══════════════════════════════════════════════════════════════════ */
if (typeof document !== 'undefined' && document.getElementById('typingRoot')) {
  var $ = function (id) { return document.getElementById(id); };
  var trackTabs = $('trackTabs'), lessonList = $('lessonList'), practiceText = $('practiceText'),
      hiddenInput = $('hiddenInput'), kbEl = $('virtualKeyboard'), statWpm = $('statWpm'),
      statAcc = $('statAcc'), statTime = $('statTime'), resultPanel = $('resultPanel'),
      resultWpmEl = $('resultWpm'), resultAccEl = $('resultAcc'), resultBestEl = $('resultBest'),
      retryBtn = $('retryBtn'), nextBtn = $('nextBtn'), practiceArea = $('practiceArea'),
      langToggle = $('langToggle'), trackDesc = $('trackDesc'), focusHint = $('focusHint'),
      thaiKbWarn = $('thaiKbWarn'), fingerHint = $('fingerHint'), fingerLegend = $('fingerLegend'),
      fingerColorToggle = $('fingerColorToggle'), sprintEnBtn = $('sprintEnBtn'), sprintThBtn = $('sprintThBtn'),
      lockMsg = $('lockMsg'), statTimeLabel = $('statTimeLabel'), resultTitleEl = $('resultTitleEl'),
      resultBestLabel = $('resultBestLabel'), progressFill = $('progressFill'), trackProgress = $('trackProgress'),
      trackProgressFill = $('trackProgressFill'), trackProgressLabel = $('trackProgressLabel'),
      confettiLayer = $('confettiLayer');

  var state = {
    trackId: 'en-home', lessonIndex: 0, target: '', charStatus: [], attempted: [],
    startTime: null, keystrokes: 0, mistakes: 0, finished: false, timerId: null,
    sprintMode: false, sprintLang: null, sprintCountdownId: null
  };

  /* สถานะเตือนว่าแป้นของเครื่องไม่ใช่ภาษาไทย — ขึ้นเฉพาะเมื่อบทภาษาไทยได้ตัวอักษรละตินจริงๆ */
  function setKbWarn(on) { if (thaiKbWarn) thaiKbWarn.style.display = on ? 'flex' : 'none'; }

  function applyI18n() {
    document.documentElement.lang = getUILang();
    document.title = t('pageTitle') + ' | Tanot';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    if (langToggle) {
      langToggle.querySelectorAll('span').forEach(function (span) {
        span.classList.toggle('active', span.getAttribute('data-lt') === getUILang());
      });
    }
  }

  function renderTrackTabs() {
    trackTabs.innerHTML = '';
    TRACKS.forEach(function (tr) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tt-tab' + (tr.id === state.trackId ? ' active' : '');
      btn.textContent = getUILang() === 'en' ? tr.labelEn : tr.label;
      btn.addEventListener('click', function () { selectTrack(tr.id); });
      trackTabs.appendChild(btn);
    });
  }

  function renderLessonList() {
    var track = trackById(state.trackId);
    var progress = loadProgress();
    lessonList.innerHTML = '';
    track.lessons.forEach(function (lesson, i) {
      var unlocked = isUnlocked(track, i, progress);
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'tt-lesson' + (i === state.lessonIndex && !state.sprintMode ? ' active' : '') + (unlocked ? '' : ' locked');
      var best = progress[progressKey(track.id, i)];
      item.innerHTML = '<span class="tt-lesson-title">' + (unlocked ? '' : '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-lock"/></svg>') + (i + 1) + '. ' + lesson.title + '</span>' +
        (best ? '<span class="tt-lesson-best">' + Math.round(best.wpm) + ' ' + t('statsWpm') + '</span>' : '');
      item.addEventListener('click', function () {
        if (unlocked) selectLesson(i);
        else if (lockMsg) {
          lockMsg.textContent = t('lockedMsg');
          lockMsg.style.display = 'block';
          clearTimeout(lockMsg._hideTimer);
          lockMsg._hideTimer = setTimeout(function () { lockMsg.style.display = 'none'; }, 3000);
        }
      });
      lessonList.appendChild(item);
    });
  }

  function selectTrack(trackId) {
    state.trackId = trackId;
    state.lessonIndex = 0;
    state.sprintMode = false;
    renderTrackTabs();
    renderLessonList();
    renderTrackProgress();
    var track = trackById(trackId);
    trackDesc.textContent = track.desc;
    startLesson();
  }

  function selectLesson(idx) {
    state.lessonIndex = idx;
    state.sprintMode = false;
    renderLessonList();
    startLesson();
  }

  /* ภาษาที่กำลังฝึกอยู่ ณ ขณะนี้ — โหมดจับเวลาไม่ได้ผูกกับ track ปกติ (state.trackId อาจเป็นแทร็กเก่า
     ที่ค้างไว้ก่อนกดจับเวลา) จึงต้องเช็ค sprintMode ก่อนเสมอแทนที่จะอ่าน track.lang ตรงๆ */
  function currentLang() { return state.sprintMode ? state.sprintLang : trackById(state.trackId).lang; }

  /* ค่าเริ่มต้นของสถานะการฝึกที่ใช้ร่วมกันทั้งบทเรียนปกติและโหมดจับเวลา (กันโค้ดซ้ำ) */
  function resetAttemptState(targetText) {
    state.target = targetText;
    state.charStatus = new Array(targetText.length).fill('pending');
    state.attempted = new Array(targetText.length).fill(false);
    state.startTime = null;
    state.keystrokes = 0;
    state.mistakes = 0;
    state.finished = false;
    hiddenInput.value = '';
    setKbWarn(false);
    resultPanel.style.display = 'none';
    resultPanel.classList.remove('show');
    if (confettiLayer) confettiLayer.innerHTML = '';
    if (progressFill) progressFill.style.width = '0%';
    practiceArea.classList.remove('done');
    clearInterval(state.timerId);
  }

  function startLesson() {
    var track = trackById(state.trackId);
    var lesson = track.lessons[state.lessonIndex];
    resetAttemptState(lesson.text);
    statWpm.textContent = '0';
    statAcc.textContent = '100%';
    statTime.textContent = '0s';
    if (statTimeLabel) statTimeLabel.textContent = t('statsTime');
    renderPracticeText();
    renderKeyboard(track.lang);
    highlightNextKey(track.lang);
    hiddenInput.focus();
  }

  function startSprint(lang) {
    state.sprintMode = true;
    state.sprintLang = lang;
    resetAttemptState(buildSprintText(lang));
    statWpm.textContent = '0';
    statAcc.textContent = '100%';
    statTime.textContent = String(SPRINT_SECONDS) + 's';
    if (statTimeLabel) statTimeLabel.textContent = t('statsTimeLeft');
    renderLessonList();
    renderTrackProgress();
    renderPracticeText();
    renderKeyboard(lang);
    highlightNextKey(lang);
    hiddenInput.focus();
  }

  /* โหมดจับเวลาสร้างข้อความเป้าหมายยาวมาก (หลายพันตัวอักษร กันพิมพ์ทันใน 60 วิ) — เรนเดอร์ทั้งก้อน
     จะดันคีย์บอร์ด/สถิติหลุดจอไปไกลมาก จึงโชว์แค่ "หน้าต่าง" รอบตำแหน่งเคอร์เซอร์เท่านั้น (behind/ahead)
     บทเรียนปกติทุกบทสั้นกว่า WINDOW_AHEAD อยู่แล้วเสมอ จึงยังเห็นครบทั้งข้อความเหมือนเดิมทุกประการ
     ไม่มีผลกับ UX เดิมเลย ส่วนโหมดจับเวลาจะได้ประโยชน์เต็มๆ */
  var WINDOW_BEHIND = 40, WINDOW_AHEAD = 200;
  function renderPracticeText() {
    var cursor = hiddenInput.value.length;
    var start = Math.max(0, cursor - WINDOW_BEHIND);
    var end = Math.min(state.target.length, cursor + WINDOW_AHEAD);
    practiceText.innerHTML = '';
    for (var i = start; i < end; i++) {
      var span = document.createElement('span');
      span.className = 'tt-char ' + state.charStatus[i] + (i === cursor ? ' cursor' : '');
      span.textContent = state.target[i];
      practiceText.appendChild(span);
    }
    /* แถบความคืบหน้าของรอบนี้ — โหมดจับเวลาไม่มี "ครบ 100%" ที่มีความหมายจริง (ข้อความยาวมาก
       เกินพิมพ์ทันเสมอ) จึงไม่โชว์แถบนี้เลยในโหมดนั้น กันความเข้าใจผิดว่าใกล้จบแล้ว */
    if (progressFill) {
      progressFill.style.width = (state.sprintMode || !state.target.length)
        ? '0%' : Math.round((cursor / state.target.length) * 100) + '%';
    }
  }

  /* ป้ายความคืบหน้าของทั้งแทร็ก (กี่บทเสร็จแล้วจากทั้งหมด) — ไม่แสดงระหว่างโหมดจับเวลา
     เพราะไม่ได้ผูกกับ track/lesson ปกติ */
  function renderTrackProgress() {
    if (!trackProgress) return;
    if (state.sprintMode) { trackProgress.style.display = 'none'; return; }
    trackProgress.style.display = 'flex';
    var track = trackById(state.trackId);
    var progress = loadProgress();
    var done = track.lessons.filter(function (_, i) { return !!progress[progressKey(track.id, i)]; }).length;
    var pct = Math.round((done / track.lessons.length) * 100);
    if (trackProgressFill) trackProgressFill.style.width = pct + '%';
    if (trackProgressLabel) trackProgressLabel.textContent = done + '/' + track.lessons.length;
  }

  /* เอฟเฟกต์เล็กๆ ตอนกดปุ่มถูกต้อง — ให้ความรู้สึกเหมือนคีย์บอร์ดจริงตอบสนอง (ทำเฉพาะปุ่มที่เพิ่งพิมพ์
     ไปหมาดๆ ไม่ใช่ปุ่ม "ถัดไป" ที่ไฮไลต์ไว้ล่วงหน้าอยู่แล้ว — คนละความหมายกัน) */
  function pulseKey(lang, ch) {
    if (!kbEl) return;
    if (ch === ' ') {
      var sp = kbEl.querySelector('.tt-space');
      if (sp) { sp.classList.add('pressed'); setTimeout(function () { sp.classList.remove('pressed'); }, 100); }
      return;
    }
    var map = lang === 'th' ? TH_CHAR_MAP : EN_CHAR_MAP;
    var pos = map[ch];
    if (!pos || pos.space) return;
    var els = [kbEl.querySelector('.tt-key[data-r="' + pos.r + '"][data-c="' + pos.c + '"]')];
    if (pos.shift) els.push(kbEl.querySelector('.tt-shift[data-shift="' + shiftSideFor(pos.r, pos.c) + '"]'));
    els.forEach(function (el) {
      if (el) { el.classList.add('pressed'); setTimeout(function () { el.classList.remove('pressed'); }, 100); }
    });
  }

  /* คอนเฟตตี้เล็กๆ ตอนจบการฝึก — ทำเองล้วนๆ ด้วย CSS animation ไม่พึ่งไลบรารีภายนอก
     (สอดคล้องกับเว็บนี้ที่ปกติไม่โหลด asset หนักเกินจำเป็น) */
  var CONFETTI_COLORS = ['var(--ome-chart-1)', 'var(--ome-chart-2)', 'var(--ome-chart-3)', 'var(--ome-chart-4)', 'var(--ome-chart-5)'];
  function spawnConfetti() {
    if (!confettiLayer) return;
    confettiLayer.innerHTML = '';
    for (var i = 0; i < 18; i++) {
      var piece = document.createElement('span');
      piece.className = 'tt-confetti-piece';
      piece.style.left = Math.round(Math.random() * 100) + '%';
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDuration = (900 + Math.random() * 700) + 'ms';
      piece.style.animationDelay = Math.round(Math.random() * 200) + 'ms';
      confettiLayer.appendChild(piece);
    }
  }

  /* ปุ่ม Shift ซ้าย/ขวา — ก้อยซ้าย/ก้อยขวา (สีโซนนิ้วเดียวกับปุ่มข้างเคียง) */
  function makeShiftKey(side, showFingers) {
    var el = document.createElement('div');
    el.className = 'tt-key tt-shift' + (showFingers ? ' f-' + (side === 'l' ? 'lp' : 'rp') : '');
    el.dataset.shift = side;
    el.textContent = 'Shift';
    return el;
  }

  /* สลับป้ายอักษรบนทุกปุ่มระหว่างชั้นปกติกับชั้น Shift (ใช้ตอนอักษรถัดไปต้องกด Shift) */
  function setShiftLayer(lang, on) {
    if (kbEl.classList.contains('shifted') === on && kbEl.dataset.lang === lang) return;
    var idx = (lang === 'th' ? 1 : 0) + (on ? 2 : 0);
    kbEl.querySelectorAll('.tt-key[data-r]').forEach(function (k) {
      k.textContent = KB_ROWS[k.dataset.r][k.dataset.c][idx];
    });
    kbEl.classList.toggle('shifted', on);
    kbEl.dataset.lang = lang;
  }

  function renderKeyboard(lang) {
    kbEl.innerHTML = '';
    kbEl.classList.remove('shifted');
    kbEl.dataset.lang = lang;
    var showFingers = getFingerColorsOn();
    KB_ROWS.forEach(function (row, r) {
      var rowEl = document.createElement('div');
      rowEl.className = 'tt-kbrow';
      if (r === 3) rowEl.appendChild(makeShiftKey('l', showFingers));
      row.forEach(function (key, c) {
        var keyEl = document.createElement('div');
        var isHome = r === 2 && HOME_KEYS_EN.indexOf(key[0]) !== -1;
        keyEl.className = 'tt-key' + (isHome ? ' home' : '') + (showFingers ? ' f-' + fingerFor(r, c) : '');
        keyEl.dataset.r = r; keyEl.dataset.c = c;
        keyEl.textContent = key[lang === 'th' ? 1 : 0];
        rowEl.appendChild(keyEl);
      });
      if (r === 3) rowEl.appendChild(makeShiftKey('r', showFingers));
      kbEl.appendChild(rowEl);
    });
    var spaceRow = document.createElement('div');
    spaceRow.className = 'tt-kbrow';
    var spaceKey = document.createElement('div');
    spaceKey.className = 'tt-key tt-space';
    spaceKey.dataset.space = '1';
    spaceRow.appendChild(spaceKey);
    kbEl.appendChild(spaceRow);
    renderFingerLegend(showFingers);
  }

  function renderFingerLegend(showFingers) {
    if (!fingerLegend) return;
    fingerLegend.style.display = showFingers ? 'flex' : 'none';
    fingerLegend.innerHTML = '';
    FINGER_ORDER.forEach(function (fid) {
      var chip = document.createElement('span');
      chip.className = 'tt-flegend-chip f-' + fid;
      chip.textContent = FINGER_NAMES[fid][getUILang()];
      fingerLegend.appendChild(chip);
    });
  }

  function highlightNextKey(lang) {
    kbEl.querySelectorAll('.tt-key').forEach(function (k) { k.classList.remove('next'); });
    var nextChar = state.target[hiddenInput.value.length];
    if (nextChar === undefined) { setShiftLayer(lang, false); if (fingerHint) fingerHint.textContent = ''; return; }
    if (nextChar === ' ') {
      setShiftLayer(lang, false);
      var sp = kbEl.querySelector('.tt-space');
      if (sp) sp.classList.add('next');
      if (fingerHint) fingerHint.textContent = t('fingerLabel') + ': ' + FINGER_NAMES.thumb[getUILang()];
      return;
    }
    var map = lang === 'th' ? TH_CHAR_MAP : EN_CHAR_MAP;
    var pos = map[nextChar];
    if (!pos || pos.space) { setShiftLayer(lang, false); if (fingerHint) fingerHint.textContent = ''; return; }
    setShiftLayer(lang, pos.shift);
    var keyEl = kbEl.querySelector('.tt-key[data-r="' + pos.r + '"][data-c="' + pos.c + '"]');
    if (keyEl) keyEl.classList.add('next');
    var hint = t('fingerLabel') + ': ' + FINGER_NAMES[fingerFor(pos.r, pos.c)][getUILang()];
    if (pos.shift) {
      /* Shift ฝั่งตรงข้ามกับมือที่กดอักษร */
      var side = shiftSideFor(pos.r, pos.c);
      var shiftEl = kbEl.querySelector('.tt-shift[data-shift="' + side + '"]');
      if (shiftEl) shiftEl.classList.add('next');
      hint += ' + Shift ' + FINGER_NAMES[side === 'l' ? 'lp' : 'rp'][getUILang()];
    }
    if (fingerHint) fingerHint.textContent = hint;
  }

  function liveStats() {
    if (!state.startTime) return;
    var elapsedMs = Date.now() - state.startTime;
    var minutes = elapsedMs / 60000;
    var wpm = minutes > 0 ? Math.round((state.keystrokes / 5) / minutes) : 0;
    var acc = state.keystrokes > 0 ? Math.round(((state.keystrokes - state.mistakes) / state.keystrokes) * 100) : 100;
    statWpm.textContent = String(wpm);
    statAcc.textContent = acc + '%';
    if (state.sprintMode) {
      var remaining = SPRINT_SECONDS * 1000 - elapsedMs;
      if (remaining <= 0) { statTime.textContent = '0s'; finishAttempt(); return; }
      statTime.textContent = Math.ceil(remaining / 1000) + 's';
    } else {
      statTime.textContent = Math.round(elapsedMs / 1000) + 's';
    }
  }

  /* ให้คะแนน+บันทึกผลเมื่อจบการฝึก (ใช้ร่วมกันทั้งบทเรียนปกติ — จบเมื่อพิมพ์ครบ — และโหมดจับเวลา
     ที่จบเมื่อหมดเวลา ไม่ใช่พิมพ์ครบ) คำนวณจาก state.keystrokes/mistakes/เวลาที่ผ่านไปจริงเสมอ
     ไม่ได้อิงความยาว target เลย จึงใช้ตัวเดียวกันได้กับทั้งสองโหมดโดยไม่ต้องแยกสูตร */
  function finishAttempt() {
    if (state.finished) return;
    state.finished = true;
    clearInterval(state.timerId);
    var minutes = (Date.now() - state.startTime) / 60000;
    var wpm = minutes > 0 ? (state.keystrokes / 5) / minutes : 0;
    var acc = state.keystrokes > 0 ? ((state.keystrokes - state.mistakes) / state.keystrokes) * 100 : 100;
    // XP กลาง (learn-core.js): จบรอบที่แม่นพอปลดล็อกบทถัดไป / จบรอบจับเวลา — หน้านี้ไม่มี XP ของตัวเอง
    if (window.LearnCore && state.keystrokes > 0 && (state.sprintMode || acc >= UNLOCK_MIN_ACC)) {
      window.LearnCore.award('typing', state.sprintMode ? TYPING_XP_SPRINT : TYPING_XP_LESSON);
    }

    if (state.sprintMode) {
      var sprintBest = loadSprintBest();
      var prevSprint = sprintBest[state.sprintLang];
      if (!prevSprint || wpm > prevSprint.wpm) sprintBest[state.sprintLang] = { wpm: wpm, acc: acc, at: Date.now() };
      saveSprintBest(sprintBest);
      resultWpmEl.textContent = Math.round(wpm);
      resultAccEl.textContent = Math.round(acc) + '%';
      resultBestEl.textContent = Math.round(sprintBest[state.sprintLang].wpm) + ' ' + t('statsWpm');
      nextBtn.style.display = 'none';
    } else {
      /* เก็บ WPM สูงสุดและความแม่นยำสูงสุดแยกกันเป็นอิสระต่อกัน (ไม่จำเป็นต้องมาจากรอบเดียวกัน) —
         เพราะปลดล็อกบทถัดไป (isUnlocked) เช็คจาก acc เพียงอย่างเดียว ถ้าผูกไว้กับรอบที่ได้ WPM
         สูงสุดรอบเดียว อาจพลาดกรณีผู้เรียนเคยพิมพ์แม่นพอแล้วในรอบอื่นที่ WPM ไม่สูงสุด */
      var progress = loadProgress();
      var key = progressKey(state.trackId, state.lessonIndex);
      var prevBest = progress[key];
      var isNewBest = !prevBest || wpm > prevBest.wpm || acc > (prevBest.acc || 0);
      if (isNewBest) progress[key] = { wpm: Math.max(wpm, prevBest ? prevBest.wpm : 0), acc: Math.max(acc, prevBest ? prevBest.acc : 0), at: Date.now() };
      saveProgress(progress);
      resultWpmEl.textContent = Math.round(wpm);
      resultAccEl.textContent = Math.round(acc) + '%';
      resultBestEl.textContent = Math.round((progress[key] || { wpm: wpm }).wpm) + ' ' + t('statsWpm');
      nextBtn.style.display = '';
      renderLessonList();
      renderTrackProgress();
    }
    if (resultTitleEl) resultTitleEl.textContent = state.sprintMode ? t('sprintResultTitle') : t('resultTitle');
    if (resultBestLabel) resultBestLabel.textContent = state.sprintMode ? t('sprintBest') : t('resultBest');
    resultPanel.style.display = 'flex';
    /* set display ก่อนแล้วค่อยเพิ่ม class ในเฟรมถัดไป — ให้ transition (opacity/transform) เล่นจริง
       (เพิ่ม class พร้อม display:flex ในบรรทัดเดียวกัน เบราว์เซอร์จะข้าม transition ไปเลยเพราะ
       ยังไม่มี "สถานะก่อนหน้า" ให้ transition จาก) */
    requestAnimationFrame(function () { resultPanel.classList.add('show'); });
    if (acc >= 60) spawnConfetti(); /* ให้กำลังใจเฉพาะรอบที่พอใช้ได้ ไม่ใช่ทุกรอบแม้พิมพ์ผิดเยอะมาก */
    practiceArea.classList.add('done');
  }

  hiddenInput.addEventListener('input', function () {
    if (state.finished) return;
    if (!state.startTime) {
      state.startTime = Date.now();
      state.timerId = setInterval(liveStats, 500);
    }
    var val = hiddenInput.value;
    /* จำกัดไม่ให้พิมพ์เกินความยาวเป้าหมาย (กันเลย index ตอนคำนวณ) */
    if (val.length > state.target.length) {
      val = val.slice(0, state.target.length);
      hiddenInput.value = val;
    }
    var newlyTypedIndex = -1;
    for (var i = 0; i < val.length; i++) {
      if (!state.attempted[i]) {
        state.attempted[i] = true;
        state.keystrokes++;
        if (val[i] !== state.target[i]) state.mistakes++;
        newlyTypedIndex = i; /* พิมพ์ทีละตัวปกติมีแค่ 1 ตัวใหม่ต่อ event — วางไว้นอกลูปกันไว้เผื่อ paste */
      }
      state.charStatus[i] = val[i] === state.target[i] ? 'correct' : 'wrong';
    }
    for (var j = val.length; j < state.target.length; j++) state.charStatus[j] = 'pending';
    if (newlyTypedIndex !== -1 && currentLang() === 'th' && /[A-Za-z]/.test(val[newlyTypedIndex])) setKbWarn(true);
    /* เอฟเฟกต์กดปุ่ม — โชว์เฉพาะตอนพิมพ์ถูก (ตัวที่พิมพ์ผิดมีจุดสังเกตอยู่แล้วคือตัวอักษรขึ้นแดง) */
    if (newlyTypedIndex !== -1 && val[newlyTypedIndex] === state.target[newlyTypedIndex]) {
      pulseKey(currentLang(), val[newlyTypedIndex]);
    }

    renderPracticeText();
    highlightNextKey(currentLang());
    liveStats();

    if (val.length === state.target.length) finishAttempt();
  });

  /* ตรวจจาก event.key (ตัวอักษรที่ได้จริง ไม่ใช่ keyCode): บทไทยแต่ได้ตัวละติน = แป้นเครื่องไม่ใช่ภาษาไทย */
  hiddenInput.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    var k = e.key;
    if (!k || k.length !== 1 || currentLang() !== 'th') return;
    if (/[A-Za-z]/.test(k)) setKbWarn(true);
    else if (/[\u0E00-\u0E7F]/.test(k)) setKbWarn(false);
  });

  practiceArea.addEventListener('click', function () { hiddenInput.focus(); });
  hiddenInput.addEventListener('focus', function () { focusHint.style.display = 'none'; });
  hiddenInput.addEventListener('blur', function () { if (!state.finished) focusHint.style.display = 'block'; });

  retryBtn.addEventListener('click', function () {
    if (state.sprintMode) startSprint(state.sprintLang);
    else startLesson();
  });
  nextBtn.addEventListener('click', function () {
    if (state.sprintMode) return; /* ปุ่มนี้ถูกซ่อนในโหมดจับเวลาอยู่แล้ว (ดู finishAttempt) กันไว้อีกชั้น */
    var track = trackById(state.trackId);
    if (state.lessonIndex < track.lessons.length - 1) selectLesson(state.lessonIndex + 1);
    else startLesson();
  });

  if (sprintEnBtn) sprintEnBtn.addEventListener('click', function () { startSprint('en'); });
  if (sprintThBtn) sprintThBtn.addEventListener('click', function () { startSprint('th'); });

  if (fingerColorToggle) {
    fingerColorToggle.checked = getFingerColorsOn();
    fingerColorToggle.addEventListener('change', function () {
      setFingerColorsOn(fingerColorToggle.checked);
      renderKeyboard(currentLang());
      highlightNextKey(currentLang());
    });
  }

  if (langToggle) {
    langToggle.addEventListener('click', function () {
      setUILang(getUILang() === 'en' ? 'th' : 'en');
      applyI18n();
      renderTrackTabs();
      renderLessonList();
      var track = trackById(state.trackId);
      trackDesc.textContent = track.desc;
      renderKeyboard(currentLang());
      highlightNextKey(currentLang());
      if (statTimeLabel) statTimeLabel.textContent = state.sprintMode ? t('statsTimeLeft') : t('statsTime');
    });
  }
  window.omeApplyLang = function () {
    applyI18n();
    renderTrackTabs();
    renderLessonList();
    var track = trackById(state.trackId);
    trackDesc.textContent = track.desc;
    renderKeyboard(currentLang());
    highlightNextKey(currentLang());
    if (statTimeLabel) statTimeLabel.textContent = state.sprintMode ? t('statsTimeLeft') : t('statsTime');
  };

  applyI18n();
  selectTrack(state.trackId);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TRACKS: TRACKS, KB_ROWS: KB_ROWS, EN_CHAR_MAP: EN_CHAR_MAP, TH_CHAR_MAP: TH_CHAR_MAP, fingerFor: fingerFor, shiftSideFor: shiftSideFor, buildSprintText: buildSprintText };
}
})();
