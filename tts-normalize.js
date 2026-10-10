/* ══════════════════════════════════════════════════════════════════
   tts-normalize.js — ปรับข้อความก่อนพูด (UMD, window/self.TanotTtsNorm, ไม่มี DOM/storage/เครือข่าย; require() ได้ใน test)
   ใช้โดย text-to-speech.js (ฟังทันที + สร้างไฟล์เสียง) และ ai-chat-widget.js (วิดเจ็ตแชทพูดคำตอบ) — ที่เดียว ไม่มีสำเนา

   API
   • forMms(text)    → ข้อความไทยล้วนพร้อมส่งโมเดล MMS (Tanotfin/mms-tts-2081*-onnx) — ตัวอักษรทุกตัวอยู่ใน vocab ของโมเดลเสมอ
                       (ตัวกรอง VALID_CHARS เป็นขั้นสุดท้ายเสมอ — โมเดลมีเลขอารบิกแค่ 0,1,2,4 และไม่มี <unk> ที่ใช้ได้
                        เจอตัวอักษรนอก vocab = Gather index out of bounds) · ย่อหน้าต่อกันด้วยช่องว่าง
   • forNative(text) → สำหรับ Web Speech (speechSynthesis): ล้าง markdown/อีโมจิ/URL + ขยายตัวย่อ/วันที่/เวลา — ไม่กรอง vocab ไม่แปลงตัวเลขเป็นคำ
   • forMmsEn(text)  → สำหรับโมเดลอังกฤษ (Xenova/mms-tts-eng): ล้างเหมือนกัน + ตัวเลขเป็นคำอังกฤษ + เหลือ a-z ' - และช่องว่าง
   • plan(text, {lang:'th'|'en', max:60}) → { chunks:[…], gaps:[วินาทีหลังท่อน i …], paras:[ย่อหน้าของท่อน i …] }
   • chunks(text, max=60, opts) → plan(...).chunks  — "ตัดท่อนหลัง normalize" เสมอ (ท่อน ≤ max ตัวอักษรหลังแปลงแล้ว)
   ช่วงเงียบ: ท่อนในย่อหน้าเดียวกัน GAP_SENT_SEC (0.12) · ขึ้นย่อหน้าใหม่ (ขึ้นบรรทัดใหม่) GAP_PARA_SEC (0.4)

   ลำดับกฎของ forMms (แต่ละขั้นเปลี่ยนเป็นคำไทยที่ไม่มีเลขเหลือ ขั้นถัดไปจึงไม่เห็นซ้ำ):
   เลขไทย/เต็มความกว้าง → อารบิก → ล้าง markdown/แชท/URL/อีเมล/อีโมจิ → วันที่ตัวเลข → เวลา → ตัวย่อ (มาตรา vs มัธยม)
   → เบอร์โทร → เลขคั่นขีด (บัตรประชาชน/รหัส) → ช่วงเลข (ถึง) → ติดลบ/บวก → จำนวน (เงิน/ทศนิยม/%/หน่วย/ล้านซ้อน/อ่านทีละตัว)
   → ๆ ซ้ำคำ / ฯ ตัดทิ้ง → อังกฤษปน (ทับศัพท์/สะกดตัวอักษร/ตัดทิ้ง) → กรอง vocab
   ⚠️ ไม่ใช้ lookbehind ใน regex (Safari < 16.4 พาร์สไม่ได้ → ทั้งไฟล์พัง) · \p{…} ห่อ try/catch */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TanotTtsNorm = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ตัวอักษรที่โมเดลเสียงไทย (mms-tts-2081 / -FM) รู้จัก — 72 ตัว ไม่รวม ำ (ต้องแตกเป็น ํา) ไม่มี ๆ ฯ และเลขอารบิกมีแค่ 0 1 2 4
     (ย้ายมาจาก text-to-speech.js — ห้ามเพิ่มตัวที่ยังไม่ยืนยันกับ vocab.json ของโมเดล) */
  var VALID_CHARS = 'าน่รเ้อกงวะัมทพยลจีคตดหขิแสบปไูใ็ื์ชุึํโผถญซธศณษฟภฉฝฐฤฏฮฆ๋ฎ\'0๊ฑ142-ฬฒฌ ';
  var VALID = {};
  for (var vi = 0; vi < VALID_CHARS.length; vi++) VALID[VALID_CHARS.charAt(vi)] = true;

  var GAP_SENT_SEC = 0.12, GAP_PARA_SEC = 0.4, DEFAULT_MAX = 60;

  /* ══════════════ ตัวเลข ══════════════ */
  var DIGIT = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  var PLACE = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
  var MAX_WORD_DIGITS = 18; // ถึงล้านล้านล้าน — ยาวกว่านี้อ่านทีละตัว

  /* ต่ำกว่าหนึ่งล้าน · carry = มีส่วนที่สูงกว่า (ล้านขึ้นไป) → หลักหน่วย 1 อ่าน "เอ็ด" */
  function belowMillion(s, carry) {
    s = s.replace(/^0+/, '');
    var n = s.length, out = '';
    for (var i = 0; i < n; i++) {
      var d = +s.charAt(i), p = n - 1 - i;
      if (!d) continue;
      if (p === 0) out += (d === 1 && (n > 1 || carry)) ? 'เอ็ด' : DIGIT[d];
      else if (p === 1) out += d === 1 ? 'สิบ' : d === 2 ? 'ยี่สิบ' : DIGIT[d] + 'สิบ';
      else out += DIGIT[d] + PLACE[p];
    }
    return out;
  }
  /* จำนวนเต็ม (สายตัวเลข) → คำอ่านไทย · ล้านซ้อน: 1,000,000,000,000 = หนึ่งล้านล้าน */
  function numberToWords(numStr) {
    var s = String(numStr).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (s === '' || s === '0') return DIGIT[0];
    if (s.length > MAX_WORD_DIGITS) return spellDigits(s);
    return wordsRec(s);
  }
  function wordsRec(s) {
    if (s.length <= 6) return belowMillion(s, false);
    return wordsRec(s.slice(0, -6)) + 'ล้าน' + belowMillion(s.slice(-6), true);
  }
  function spellDigits(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) out += DIGIT[+s.charAt(i)];
    return out;
  }
  /* อ่านทีละตัว แบ่งกลุ่มให้ฟังง่าย (10 หลัก = 3-3-4) */
  function spellGrouped(s) {
    var parts = [], n = s.length, i = 0;
    while (n > 4) { parts.push(s.substr(i, 3)); i += 3; n -= 3; }
    parts.push(s.substr(i, n));
    return parts.map(spellDigits).join(' ');
  }

  /* ══════════════ ตาราง ══════════════ */
  var MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var MONTH_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  /* ตัวย่อที่มีจุดหลายตัว/เฉพาะตัว — แทนได้ทุกตำแหน่ง (ปีพ.ศ. 2569 ไม่มีช่องว่างก็ต้องเจอ) เรียงยาว→สั้นตอนสร้าง regex */
  var ABBR_ANY = [
    ['กม./ชม.', 'กิโลเมตรต่อชั่วโมง'], ['พ.ร.บ.', 'พระราชบัญญัติ'], ['พ.ร.ก.', 'พระราชกำหนด'], ['พ.ศ.', 'พุทธศักราช'], ['ค.ศ.', 'คริสต์ศักราช'],
    ['ป.วิ.พ.', 'ประมวลกฎหมายวิธีพิจารณาความแพ่ง'], ['ป.วิ.อ.', 'ประมวลกฎหมายวิธีพิจารณาความอาญา'],
    ['ป.พ.พ.', 'ประมวลกฎหมายแพ่งและพาณิชย์'], ['ป.อ.', 'ประมวลกฎหมายอาญา'],
    ['ตร.ม.', 'ตารางเมตร'], ['ลบ.ม.', 'ลูกบาศก์เมตร'], ['ร.ร.', 'โรงเรียน'], ['บมจ.', 'บริษัทมหาชนจำกัด'],
    ['น.ส.', 'นางสาว '], ['ด.ช.', 'เด็กชาย '], ['ด.ญ.', 'เด็กหญิง '],
    ['ฯลฯ', 'และอื่นๆ'], ['กรุงเทพฯ', 'กรุงเทพ']
  ];
  MONTH_ABBR.forEach(function (a, i) { ABBR_ANY.push([a, MONTHS[i]]); });
  /* ตัวย่อจุดเดียว — แทนเฉพาะเมื่อตัวก่อนหน้าไม่ใช่อักษรไทย (ไม่งั้น "ประเทศ." จะกลายเป็น "ประเท" + ศาสตราจารย์) */
  var ABBR_WORD = [
    ['กทม.', 'กรุงเทพมหานคร'], ['นพ.', 'นายแพทย์ '], ['พญ.', 'แพทย์หญิง '], ['ทพ.', 'ทันตแพทย์ '], ['ผศ.', 'ผู้ช่วยศาสตราจารย์ '], ['รศ.', 'รองศาสตราจารย์ '],
    ['บจก.', 'บริษัทจำกัด'], ['หจก.', 'ห้างหุ้นส่วนจำกัด'], ['กม.', 'กิโลเมตร'], ['ซม.', 'เซนติเมตร'], ['มม.', 'มิลลิเมตร'], ['กก.', 'กิโลกรัม'],
    ['ชม.', 'ชั่วโมง'], ['รพ.', 'โรงพยาบาล'], ['ดร.', 'ดอกเตอร์ '], ['ศ.', 'ศาสตราจารย์ ']
  ];

  /* หน่วยที่ตามหลังตัวเลขทันที ("220V", "5 kg", "30°C") — เฉพาะที่ติดเลข ไม่งั้น "Plan A" จะกลายเป็นแอมป์ */
  var UNITS = {
    'kWh': 'กิโลวัตต์ชั่วโมง', 'kVA': 'กิโลโวลต์แอมป์', 'kHz': 'กิโลเฮิรตซ์', 'MHz': 'เมกะเฮิรตซ์', 'GHz': 'จิกะเฮิรตซ์',
    'kW': 'กิโลวัตต์', 'MW': 'เมกะวัตต์', 'kV': 'กิโลโวลต์', 'mA': 'มิลลิแอมป์', 'Hz': 'เฮิรตซ์', 'rpm': 'รอบต่อนาที', 'hp': 'แรงม้า',
    'KB': 'กิโลไบต์', 'MB': 'เมกะไบต์', 'GB': 'จิกะไบต์', 'TB': 'เทราไบต์',
    'km': 'กิโลเมตร', 'cm': 'เซนติเมตร', 'mm': 'มิลลิเมตร', 'kg': 'กิโลกรัม', 'mg': 'มิลลิกรัม', 'ml': 'มิลลิลิตร',
    '°C': 'องศาเซลเซียส', '°F': 'องศาฟาเรนไฮต์', 'V': 'โวลต์', 'A': 'แอมป์', 'W': 'วัตต์', 'm': 'เมตร', 'g': 'กรัม', 'L': 'ลิตร'
  };

  /* ทับศัพท์อังกฤษที่พบบ่อยในเว็บนี้ (คีย์ = ตัวพิมพ์เล็ก) */
  var EN_DICT = {
    'ai': 'เอไอ', 'ok': 'โอเค', 'okay': 'โอเค', 'pdf': 'พีดีเอฟ', 'excel': 'เอ็กเซล', 'word': 'เวิร์ด', 'powerpoint': 'พาวเวอร์พอยต์',
    'google': 'กูเกิล', 'line': 'ไลน์', 'facebook': 'เฟซบุ๊ก', 'youtube': 'ยูทูบ', 'tiktok': 'ติ๊กต็อก', 'instagram': 'อินสตาแกรม', 'twitter': 'ทวิตเตอร์',
    'email': 'อีเมล', 'e-mail': 'อีเมล', 'mail': 'เมล', 'gmail': 'จีเมล', 'app': 'แอป', 'application': 'แอปพลิเคชัน', 'file': 'ไฟล์', 'online': 'ออนไลน์',
    'offline': 'ออฟไลน์', 'set': 'เซ็ต', 'plc': 'พีแอลซี', 'wifi': 'ไวไฟ', 'wi-fi': 'ไวไฟ', 'bluetooth': 'บลูทูธ', 'internet': 'อินเทอร์เน็ต',
    'website': 'เว็บไซต์', 'web': 'เว็บ', 'link': 'ลิงก์', 'click': 'คลิก', 'download': 'ดาวน์โหลด', 'upload': 'อัปโหลด', 'login': 'ล็อกอิน',
    'logout': 'ล็อกเอาต์', 'password': 'พาสเวิร์ด', 'user': 'ยูสเซอร์', 'admin': 'แอดมิน', 'chat': 'แชต', 'chatgpt': 'แชตจีพีที', 'claude': 'คล็อด',
    'cloud': 'คลาวด์', 'cloudflare': 'คลาวด์แฟลร์', 'github': 'กิตฮับ', 'server': 'เซิร์ฟเวอร์', 'database': 'ดาต้าเบส', 'data': 'ดาต้า', 'code': 'โค้ด',
    'test': 'เทสต์', 'python': 'ไพธอน', 'javascript': 'จาวาสคริปต์', 'iphone': 'ไอโฟน', 'ipad': 'ไอแพด', 'android': 'แอนดรอยด์', 'windows': 'วินโดวส์',
    'mac': 'แมค', 'macos': 'แมคโอเอส', 'ios': 'ไอโอเอส', 'linux': 'ลินุกซ์', 'vat': 'แวต', 'scada': 'สคาดา', 'excel365': 'เอ็กเซล',
    'kw': 'กิโลวัตต์', 'kwh': 'กิโลวัตต์ชั่วโมง', 'kva': 'กิโลโวลต์แอมป์', 'hz': 'เฮิรตซ์', 'mhz': 'เมกะเฮิรตซ์', 'ghz': 'จิกะเฮิรตซ์',
    'mb': 'เมกะไบต์', 'gb': 'จิกะไบต์', 'tb': 'เทราไบต์', 'kb': 'กิโลไบต์', 'hp': 'แรงม้า', 'rpm': 'รอบต่อนาที', 'km': 'กิโลเมตร', 'cm': 'เซนติเมตร',
    'mm': 'มิลลิเมตร', 'kg': 'กิโลกรัม'
  };
  var LETTER = { A: 'เอ', B: 'บี', C: 'ซี', D: 'ดี', E: 'อี', F: 'เอฟ', G: 'จี', H: 'เอช', I: 'ไอ', J: 'เจ', K: 'เค', L: 'แอล', M: 'เอ็ม', N: 'เอ็น', O: 'โอ', P: 'พี', Q: 'คิว', R: 'อาร์', S: 'เอส', T: 'ที', U: 'ยู', V: 'วี', W: 'ดับเบิลยู', X: 'เอ็กซ์', Y: 'วาย', Z: 'แซด' };

  /* ══════════════ ตัวช่วย regex ══════════════ */
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
  function byLenDesc(list) { return list.slice().sort(function (a, b) { return b[0].length - a[0].length; }); }
  function re(src, flags) { try { return new RegExp(src, flags); } catch (e) { return null; } }
  var THAI_LETTER = /[ก-๎]/;       // พยัญชนะ สระ วรรณยุกต์ (ไม่รวมเลขไทย)
  function isThaiLetter(ch) { return !!ch && THAI_LETTER.test(ch); }
  function hasThai(s) { return /[฀-๿]/.test(s); }

  var ABBR_ANY_RE = new RegExp(byLenDesc(ABBR_ANY).map(function (e) { return esc(e[0]); }).join('|'), 'g');
  var ABBR_ANY_MAP = {}; ABBR_ANY.forEach(function (e) { ABBR_ANY_MAP[e[0]] = e[1]; });
  var ABBR_WORD_RE = new RegExp(byLenDesc(ABBR_WORD).map(function (e) { return esc(e[0]); }).join('|'), 'g');
  var ABBR_WORD_MAP = {}; ABBR_WORD.forEach(function (e) { ABBR_WORD_MAP[e[0]] = e[1]; });
  var UNIT_ALT = Object.keys(UNITS).sort(function (a, b) { return b.length - a.length; }).map(esc).join('|');
  var NUM_RE = new RegExp('([฿$])?(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d+))?(?:([ \\t]*(?:บาท|บ\\.))|([ \\t]?%)|[ \\t]?(' + UNIT_ALT + ')(?![A-Za-z]))?', 'g');

  /* อีโมจิ/สัญลักษณ์ภาพ — ใช้ property escape ถ้าเบราว์เซอร์รองรับ ไม่งั้นช่วงโค้ดโดยประมาณ */
  var EMOJI_RE = re('[\\p{Extended_Pictographic}\\p{Emoji_Modifier}\\u200D\\uFE0F\\u20E3\\u{1F1E6}-\\u{1F1FF}\\u{E0020}-\\u{E007F}]', 'gu') ||
    /[←-⇿⌀-⏿①-⓿■-➿⤀-⥿⬀-⯿〰〽㊗㊙‍️⃣\uD83C-􏰀-\uDFFF]/g;
  var URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'()\[\]]*[^\s<>"'()\[\].,;:!?]/gi;
  var MAIL_RE = /[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9.\-]{1,255}\.[A-Za-z]{2,}/g; // ขอบเขตความยาว — ไม่งั้นสายตัวอักษรยาวๆ สแกนซ้ำทุกตำแหน่ง (O(n²))

  /* ══════════════ 1) เลขไทย → อารบิก + ล้าง markdown/แชท ══════════════ */
  function arabicDigits(s) {
    return s.replace(/[๐-๙]/g, function (c) { return String(c.charCodeAt(0) - 0x0E50); })
      .replace(/[０-９]/g, function (c) { return String(c.charCodeAt(0) - 0xFF10); });
  }
  function cleanMarkup(s, lang) {
    var th = lang === 'th';
    s = s.replace(/\r\n?/g, '\n').replace(/[​‌﻿­]/g, '');
    s = s.replace(EMOJI_RE, '');
    s = s.replace(/```[^\n]*\n?/g, '\n').replace(/`+/g, '');           // รั้วโค้ด/โค้ดในบรรทัด: เก็บเนื้อใน ทิ้งเครื่องหมาย
    s = s.replace(/!\[([^\]]{0,300})\]\([^)]{0,2000}\)/g, '$1').replace(/\[([^\]]{1,300})\]\([^)]{0,2000}\)/g, '$1'); // รูป/ลิงก์ markdown → ข้อความ (จำกัดความยาว กันสแกนซ้ำ)
    s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[a-zA-Z][^<>]*>/g, ' ');
    s = s.replace(URL_RE, th ? 'ลิงก์' : 'link').replace(MAIL_RE, th ? 'อีเมล' : 'email');
    s = s.split('\n').map(function (line) {
      if (/^\s*([-*_=]\s*){3,}$/.test(line)) return '';                  // เส้นคั่น
      if (line.length < 400 && line.indexOf('|') >= 0 && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line)) return ''; // แถวคั่นหัวตาราง
      line = line.replace(/^\s{0,3}#{1,6}\s+/, '').replace(/^\s*>+\s?/, '').replace(/^\s*[-*+•·▪●◦‣]\s+/, '');
      if ((line.match(/\|/g) || []).length >= 2) line = line.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '').replace(/\s*\|\s*/g, ', ');
      return line;
    }).join('\n');
    s = s.replace(/\*+/g, '').replace(/~~/g, '').replace(/_+/g, ' ').replace(/[•·▪●◦‣]/g, ' ');
    return s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n');
  }

  /* ══════════════ 2) วันที่/เวลา ══════════════ */
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysIn(m, y) { return m === 2 ? (isLeap(y) ? 29 : 28) : (m === 4 || m === 6 || m === 9 || m === 11) ? 30 : 31; }
  function validDate(d, m, y4) {
    if (m < 1 || m > 12 || d < 1) return false;
    var g = y4 ? (y4 > 2400 ? y4 - 543 : y4) : 2000;
    return d <= daysIn(m, g);
  }
  function dateWords(d, m, yStr) {
    var y = yStr.length === 4 ? numberToWords(yStr) : (/^0/.test(yStr) ? spellDigits(yStr) : numberToWords(yStr));
    return numberToWords(String(d)) + ' ' + MONTHS[m - 1] + ' ' + y;
  }
  function dates(s) {
    // yyyy-mm-dd
    s = s.replace(/(^|[^\d\-\/.])(\d{4})-(\d{1,2})-(\d{1,2})(?![\d\-\/])/g, function (all, pre, y, m, d) {
      return validDate(+d, +m, +y) ? pre + dateWords(+d, +m, y) : all;
    });
    // d/m/yyyy · d/m/yy (ทับ) · d-m-yyyy · d.m.yyyy
    s = s.replace(/(^|[^\d\-\/.])(\d{1,2})([\/.\-])(\d{1,2})\3(\d{4}|\d{2})(?![\d\/])/g, function (all, pre, d, sep, m, y) {
      if (sep !== '/' && y.length !== 4) return all;
      return validDate(+d, +m, y.length === 4 ? +y : 0) ? pre + dateWords(+d, +m, y) : all;
    });
    return s;
  }
  function timeWords(h, mi, se, ap) {
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    return numberToWords(String(h)) + 'นาฬิกา' + (mi ? numberToWords(String(mi)) + 'นาที' : '') + (se ? numberToWords(String(se)) + 'วินาที' : '');
  }
  function times(s) {
    // 14:30 · 14:30:15 · 2:30 PM — ใช้ ':' ได้เลย
    s = s.replace(/(^|[^\d:.])(\d{1,2}):(\d{2})(?::(\d{2}))?(?![\d:])(?:[ \t]*น\.?(?![ก-๎])|[ \t]*([AaPp])\.?[Mm]\.?(?![A-Za-z]))?/g, function (all, pre, h, mi, se, ap) {
      h = +h; mi = +mi; se = se === undefined ? 0 : +se;
      if (h > 24 || mi > 59 || se > 59 || (h === 24 && (mi || se))) return all;
      if (ap && (h < 1 || h > 12)) return all;
      return pre + timeWords(h, mi, se, ap ? ap.toLowerCase() : '');
    });
    // 14.30 น. — ใช้ '.' ต้องมี "น." กำกับ (ไม่งั้นเป็นทศนิยม)
    s = s.replace(/(^|[^\d:.])(\d{1,2})\.(\d{2})(?![\d.])[ \t]*น(?:\.|(?![ก-๎]))/g, function (all, pre, h, mi) {
      h = +h; mi = +mi;
      if (h > 24 || mi > 59 || (h === 24 && mi)) return all;
      return pre + timeWords(h, mi, 0, '');
    });
    return s;
  }

  /* ══════════════ 3) ตัวย่อ ══════════════ */
  var SECTION_CTX = /วรรค|ประมวล|พระราชบัญญัติ/;
  function sectionContext(s, offset, memo) { // บรรทัดที่ offset อยู่มี วรรค/ประมวล/พระราชบัญญัติ ไหม (จำผลต่อบรรทัด — บรรทัดยาวที่มี "ม.5" หลายร้อยที่ไม่สแกนซ้ำ)
    if (memo.a !== undefined && offset > memo.a && offset <= memo.b) return memo.v;
    var a = s.lastIndexOf('\n', offset - 1), b = s.indexOf('\n', offset);
    if (b < 0) b = s.length;
    memo.a = a; memo.b = b; memo.v = SECTION_CTX.test(s.slice(a + 1, b));
    return memo.v;
  }
  function abbreviations(s) {
    s = s.replace(ABBR_ANY_RE, function (m) { return ABBR_ANY_MAP[m]; });
    // "ม." + เลข: มาตรา เมื่อเลข ≥ 2 หลัก หรือในบรรทัดมี วรรค/ประมวล/พระราชบัญญัติ — ไม่งั้น "ม.6" = มัธยม อ่านว่า "มอหก"
    var memo = {};
    s = s.replace(/ม\.[ \t]?(\d+)/g, function (m, num, offset, str) {
      if (isThaiLetter(str.charAt(offset - 1))) return m;
      var section = num.length >= 2 || sectionContext(str, offset, memo);
      return section ? 'มาตรา ' + num : 'มอ' + num;
    });
    s = s.replace(ABBR_WORD_RE, function (m, offset, str) {
      return isThaiLetter(str.charAt(offset - 1)) ? m : ABBR_WORD_MAP[m];
    });
    return s;
  }

  /* ══════════════ 4) จำนวน (เฉพาะ MMS) ══════════════ */
  function intWords(digits) {
    if (digits.length > 1 && digits.charAt(0) === '0') return spellDigits(digits);
    return numberToWords(digits);
  }
  function satangWords(dec) { // ".5" → 50 · ".05" → 5
    var n = +((dec + '0').slice(0, 2));
    return n ? numberToWords(String(n)) : '';
  }
  function numbers(s) {
    // เบอร์โทร 0x-xxxx-xxxx / 08x-xxx-xxxx / 0812345678 — ทีละตัว แยกกลุ่ม
    s = s.replace(/(^|[^\d\-.,])(0\d{1,2})([- ]?)(\d{3,4})\3(\d{4})(?![\d\-])/g, function (all, pre, a, sep, b, c) {
      return pre + spellDigits(a) + ' ' + spellDigits(b) + ' ' + spellDigits(c);
    });
    // เลขคั่นขีดต่อกัน ≥ 3 กลุ่ม (บัตรประชาชน 1-2345-67890-12-3, ISBN) — ทีละตัว
    s = s.replace(/(^|[^\d])(\d+(?:-\d+){2,})/g, function (m, pre, ids) { return pre + ids.split('-').map(spellDigits).join(' '); });
    // ช่วง 10-20 → ถึง
    s = s.replace(/(\d)[ \t]?[-–—~][ \t]?(?=\d)/g, '$1 ถึง ');
    // ติดลบ/บวก — เฉพาะตามหลังช่องว่าง/วงเล็บ/ต้นข้อความ (ไม่ใช่ตามหลังตัวอักษร เช่น COVID-19)
    s = s.replace(/(^|[^0-9A-Za-z฀-๿])[-−](?=\d)/g, '$1ลบ');
    s = s.replace(/(^|[^0-9A-Za-z฀-๿])\+(?=\d)/g, '$1บวก');
    s = s.replace(NUM_RE, function (m, cur, ip, dec, baht, pct, unit) {
      var comma = ip.indexOf(',') >= 0, digits = ip.replace(/,/g, '');
      var iw;
      if (digits.length > MAX_WORD_DIGITS) iw = spellGrouped(digits);
      else if (!comma && !dec && digits.length >= 9 && digits.charAt(0) !== '0') iw = spellGrouped(digits);
      else if (!comma && !dec && digits.length > 1 && digits.charAt(0) === '0') iw = digits.length >= 9 ? spellGrouped(digits) : spellDigits(digits);
      else iw = intWords(digits);
      var body;
      if (cur === '฿' || baht) {
        if (dec && dec.length <= 2) { var sw = satangWords(dec); return iw + 'บาท' + (sw ? sw + 'สตางค์' : ''); }
        body = iw + (dec ? 'จุด' + spellDigits(dec) : '');
        return cur === '฿' ? body + 'บาท' : body + baht.replace('บ.', 'บาท'); // "1,250 บาท" — ข้อความ "บาท" เดิมคงไว้ · "120 บ." = บาท
      }
      if (cur === '$') {
        if (dec && dec.length <= 2) { var cw = satangWords(dec); return iw + 'ดอลลาร์' + (cw ? cw + 'เซนต์' : ''); }
        return iw + (dec ? 'จุด' + spellDigits(dec) : '') + 'ดอลลาร์';
      }
      body = iw + (dec ? 'จุด' + spellDigits(dec) : '');
      if (pct) body += 'เปอร์เซ็นต์';
      else if (unit) body += UNITS[unit];
      return body;
    });
    return s.replace(/%/g, 'เปอร์เซ็นต์');
  }

  /* ══════════════ 5) ๆ ฯ ══════════════ */
  var segmenter, segmenterTried = false, segmenterOn = true;
  function getSegmenter() {
    if (!segmenterOn) return null;
    if (!segmenterTried) {
      segmenterTried = true;
      try { segmenter = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('th', { granularity: 'word' }) : null; } catch (e) { segmenter = null; }
    }
    return segmenter;
  }
  function lastWord(run) {
    var sg = getSegmenter();
    if (sg) {
      var last = '';
      try {
        var it = sg.segment(run)[Symbol.iterator](), r;
        while (!(r = it.next()).done) { if (r.value.isWordLike !== false) last = r.value.segment; }
      } catch (e) { last = ''; }
      return last;
    }
    return run.length <= 8 ? run : ''; // ไม่มีตัวตัดคำ: ซ้ำทั้งก้อนที่ติดกันถ้าสั้น ไม่งั้นตัดทิ้ง
  }
  var RUN_CH = /[\u0E01-\u0E45\u0E47-\u0E4E]/;
  function repeatMarks(s) {
    if (s.indexOf('ๆ') < 0) return s.replace(/ฯ/g, '');
    s = s.replace(/อื่นๆ+/g, 'อื่นอื่น').replace(/ต่างๆ+/g, 'ต่างต่าง'); // คำที่เจอบ่อย — ไม่พึ่งตัวตัดคำ
    var out = '', pos = 0, i;
    while ((i = s.indexOf('ๆ', pos)) >= 0) {
      var j = i, lim = Math.max(pos, i - 80);       // ก้อนอักษรไทยติดกันก่อน ๆ (ไม่ย้อนเกิน 80 ตัว — เร็วเป็นเส้นตรงแม้ข้อความยาวไม่เว้นวรรค)
      while (j > lim && RUN_CH.test(s.charAt(j - 1))) j--;
      var run = s.slice(j, i), k = i;
      while (s.charAt(k) === 'ๆ') k++;
      out += s.slice(pos, i) + (run ? lastWord(run) : '');
      pos = k;
    }
    return (out + s.slice(pos)).replace(/ฯ/g, '');
  }

  /* ══════════════ 6) อังกฤษปน (เฉพาะ MMS) ══════════════ */
  function transliterate(tok) {
    var lower = tok.toLowerCase();
    if (EN_DICT.hasOwnProperty(lower)) return EN_DICT[lower];
    var base = lower.replace(/['’]s$/, '');
    if (base !== lower && EN_DICT.hasOwnProperty(base)) return EN_DICT[base];
    if (/^[A-Z]{1,5}$/.test(tok)) return tok.split('').map(function (c) { return LETTER[c]; }).join(' ');
    if (/^[A-Z]{2,5}s$/.test(tok)) return transliterate(tok.slice(0, -1));
    if (/^[A-Z]{1,5}['’]s$/.test(tok)) return transliterate(tok.slice(0, -2));
    if (tok.indexOf('-') > 0) return tok.split('-').map(transliterate).join(' ');
    return ' ';
  }
  function english(s) {
    return s.replace(/[A-Za-z][A-Za-z']*(?:-[A-Za-z]+)*/g, function (tok) { return ' ' + transliterate(tok.replace(/’/g, "'")) + ' '; });
  }

  /* ══════════════ pipeline ══════════════ */
  function prepare(text, mode) {
    var s = arabicDigits(String(text == null ? '' : text));
    s = cleanMarkup(s, mode === 'native' && !hasThai(s) ? 'en' : 'th');
    s = dates(s);
    s = times(s);
    s = abbreviations(s);
    if (mode === 'mms') s = numbers(s);
    s = repeatMarks(s);
    if (mode === 'mms') s = english(s).replace(/[-\u2013\u2014]/g, ' ');
    return s;
  }
  function filterVocab(s) {
    s = s.replace(/ำ/g, 'ํา'); // ำ → ํา (ไม่อยู่ใน vocab; ํ และ า อยู่) — ไม่ทิ้งเป็นช่องว่าง "ทำ" ไม่กลายเป็น "ท"
    var out = '';
    for (var i = 0; i < s.length; i++) out += VALID[s.charAt(i)] ? s.charAt(i) : ' ';
    return out.replace(/ {2,}/g, ' ').replace(/^ | $/g, '');
  }
  function lines(s) { return s.split('\n'); }

  function forMms(text) {
    return lines(prepare(text, 'mms')).map(filterVocab).filter(Boolean).join(' ');
  }
  function forNative(text) {
    return lines(prepare(text, 'native')).map(function (l) { return l.replace(/[ \t]+/g, ' ').trim(); }).filter(Boolean).join('\n');
  }

  /* ── อังกฤษสำหรับโมเดล mms-tts-eng ── */
  var EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  var EN_SCALE = ['', ' thousand', ' million', ' billion', ' trillion'];
  function enBelow1000(n) {
    var out = '';
    if (n >= 100) { out += EN_ONES[Math.floor(n / 100)] + ' hundred'; n %= 100; if (n) out += ' '; }
    if (n >= 20) { out += EN_TENS[Math.floor(n / 10)]; if (n % 10) out += ' ' + EN_ONES[n % 10]; }
    else if (n > 0 || out === '') out += EN_ONES[n];
    return out;
  }
  function enNumber(digits) {
    digits = digits.replace(/^0+(?=\d)/, '');
    if (digits === '0') return 'zero';
    if (digits.length > 15) return digits.split('').map(function (c) { return EN_ONES[+c]; }).join(' ');
    var groups = [];
    for (var i = digits.length; i > 0; i -= 3) groups.unshift(+digits.slice(Math.max(0, i - 3), i));
    var out = [];
    groups.forEach(function (g, i) { if (g) out.push(enBelow1000(g) + EN_SCALE[groups.length - 1 - i]); });
    return out.join(' ');
  }
  function enClean(str) { return str.replace(/[^a-z' \-]/g, ' ').replace(/ {2,}/g, ' ').replace(/^[ \-']+|[ \-']+$/g, ''); }
  function prepareEn(text) { // ตัวพิมพ์เล็ก · เครื่องหมายจบประโยคยังอยู่ (ไว้ตัดท่อน) — forMmsEn ค่อยกรองทิ้ง
    var s = cleanMarkup(arabicDigits(String(text == null ? '' : text)), 'en');
    s = s.replace(/(\$)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(%)?/g, function (m, cur, ip, dec, pct) {
      var d = ip.replace(/,/g, '');
      var w = d.length > 1 && d.charAt(0) === '0' ? d.split('').map(function (c) { return EN_ONES[+c]; }).join(' ') : enNumber(d);
      if (dec) w += ' point ' + dec.split('').map(function (c) { return EN_ONES[+c]; }).join(' ');
      return ' ' + w + (pct ? ' percent' : '') + (cur ? ' dollars' : '') + ' ';
    });
    s = s.replace(/&/g, ' and ').replace(/\$/g, ' dollars ').replace(/%/g, ' percent ');
    return s.toLowerCase().replace(/[\u2018\u2019]/g, "'");
  }
  function forMmsEn(text) {
    return lines(prepareEn(text)).map(enClean).filter(Boolean).join(' ');
  }

  /* ══════════════ ตัดท่อน (หลัง normalize) ══════════════ */
  function safeCut(t, i, lo) { // ตำแหน่งตัดที่ไม่ฉีกพยางค์: ตัวถัดไปต้องไม่ใช่สระตาม/วรรณยุกต์ · ตัวก่อนต้องไม่ใช่สระนำ
    var j = i;
    while (j > lo) {
      var nx = t.charAt(j), pv = t.charAt(j - 1);
      var bad = /[ะ-ฺๅ็-๎]/.test(nx) || /[เ-ไ]/.test(pv);
      if (!bad) return j;
      j--;
    }
    return i;
  }
  function splitLong(t, max) { // t ไม่มีช่องว่างและยาวเกิน max → ตัดตามคำ (Intl.Segmenter) ไม่ได้ก็ตัดแบบปลอดภัย
    var pieces = [], cur = '', sg = getSegmenter(), words = null;
    if (sg) {
      try { words = []; var it = sg.segment(t)[Symbol.iterator](), r; while (!(r = it.next()).done) words.push(r.value.segment); } catch (e) { words = null; }
    }
    function pushHard(w) {
      while (w.length > max) { var c = safeCut(w, max, Math.floor(max / 2)); pieces.push(w.slice(0, c)); w = w.slice(c); }
      return w;
    }
    if (!words) {
      var rest = t;
      while (rest.length > max) { var c = safeCut(rest, max, Math.floor(max / 2)); pieces.push(rest.slice(0, c)); rest = rest.slice(c); }
      if (rest) pieces.push(rest);
      return pieces;
    }
    words.forEach(function (w) {
      if (cur.length + w.length <= max) { cur += w; return; }
      if (cur) pieces.push(cur);
      cur = w.length > max ? pushHard(w) : w;
    });
    if (cur) pieces.push(cur);
    return pieces;
  }
  function paragraphChunks(p, max) { // p = ข้อความหนึ่งย่อหน้า (ก่อนกรอง vocab — ยังมีเครื่องหมายวรรคตอนบอกจุดจบประโยค)
    var out = [], cur = '';
    function flush() { if (cur) { out.push(cur); cur = ''; } }
    var parts = p.split(/([\s.,!?;:…()\[\]{}"“”‘’«»<>|\/\\—–]+)/);
    for (var i = 0; i < parts.length; i += 2) {
      var seg = filterVocab(parts[i] || ''), delim = parts[i + 1] || '';
      var strong = /[.!?;…]/.test(delim);
      var toks = seg ? seg.split(' ') : [];
      for (var k = 0; k < toks.length; k++) {
        var t = toks[k];
        if (!t) continue;
        if (t.length > max) {
          flush();
          var pcs = splitLong(t, max);
          for (var q = 0; q < pcs.length - 1; q++) out.push(pcs[q]);
          cur = pcs[pcs.length - 1];
        } else if (!cur) cur = t;
        else if (cur.length + 1 + t.length <= max) cur += ' ' + t;
        else { flush(); cur = t; }
      }
      if (strong) flush();
    }
    flush();
    return out;
  }
  function plan(text, opts) {
    opts = opts || {};
    var max = opts.max > 0 ? opts.max : DEFAULT_MAX, en = opts.lang === 'en';
    var norm = en ? prepareEn(text) : prepare(text, 'mms');
    var chunks = [], paras = [], pi = 0;
    lines(norm).forEach(function (line) {
      var cs = en ? englishChunks(line, max) : paragraphChunks(line, max);
      if (!cs.length) return;
      cs.forEach(function (c) { chunks.push(c); paras.push(pi); });
      pi++;
    });
    var gaps = chunks.map(function (c, i) { return i === chunks.length - 1 ? 0 : (paras[i + 1] === paras[i] ? GAP_SENT_SEC : GAP_PARA_SEC); });
    return { chunks: chunks, gaps: gaps, paras: paras };
  }
  function englishChunks(line, max) { // บรรทัดอังกฤษ → ตัดที่จบประโยค แล้วจัดเป็นท่อน ≤ max ที่ช่องว่าง
    var out = [], cur = '';
    function flush() { if (cur) { out.push(cur); cur = ''; } }
    line.split(/[.!?;]+/).forEach(function (sent) {
      enClean(sent).split(' ').forEach(function (w) {
        if (!w) return;
        while (w.length > max) { flush(); out.push(w.slice(0, max)); w = w.slice(max); }
        if (!cur) cur = w; else if (cur.length + 1 + w.length <= max) cur += ' ' + w; else { flush(); cur = w; }
      });
      flush();
    });
    return out;
  }
  function chunks(text, max, opts) {
    var o = {}; for (var k in (opts || {})) o[k] = opts[k];
    o.max = max || DEFAULT_MAX;
    return plan(text, o).chunks;
  }

  return {
    VALID_CHARS: VALID_CHARS, GAP_SENT_SEC: GAP_SENT_SEC, GAP_PARA_SEC: GAP_PARA_SEC, MAX_CHUNK: DEFAULT_MAX,
    numberToWords: numberToWords, thaiNumberToWords: numberToWords, forMms: forMms, forNative: forNative, forMmsEn: forMmsEn,
    plan: plan, chunks: chunks, filterVocab: filterVocab,
    /* ตารางคำอ่านทั้งหมด — test ตรวจว่า "ทุกตัวอักษรของคำอ่านอยู่ใน vocab" (กรองแล้วไม่หายไปไหน) */
    TABLES: { DIGIT: DIGIT, MONTHS: MONTHS, ABBR: ABBR_ANY.concat(ABBR_WORD), UNITS: UNITS, EN_DICT: EN_DICT, LETTER: LETTER,
      FIXED: ['จุด', 'ลบ', 'บวก', 'ถึง', 'บาท', 'สตางค์', 'ดอลลาร์', 'เซนต์', 'เปอร์เซ็นต์', 'นาฬิกา', 'นาที', 'วินาที', 'มาตรา', 'มอ', 'ลิงก์', 'อีเมล', 'ล้าน', 'เอ็ด', 'ยี่สิบ'].concat(PLACE) },
    useSegmenter: function (on) { segmenterOn = on !== false; } // ทดสอบเส้นทางสำรองตอนไม่มี Intl.Segmenter
  };
});
