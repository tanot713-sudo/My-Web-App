// งานปรับปรุงเสียง/OCR Section 4 — ข้อความก่อนพูด (tts-normalize.js, window.TanotTtsNorm) + วิดเจ็ตแชทพูดไม่พัง + ภาษาถอดเสียงเริ่มต้นไทย
// A) known-answer ของทุกกฎ (Node require) · B) fuzz 2,000 ข้อความ (ทุกตัวอักษรอยู่ใน vocab, ทุกท่อน ≤ MAX_CHUNK) · C) หน้า/วิดเจ็ตจริงใน Chromium
// CI ห้ามโหลดโมเดลจริง: vendor/transformers/transformers.web.min.js ถูก route เป็นโมดูลหลอกที่ "โยน error เมื่อเจอตัวอักษรนอก vocab" (เหมือน Gather out of bounds ของจริง)
const { test, expect } = require('@playwright/test');
const N = require('../tts-normalize.js');

const VALID = new Set(N.VALID_CHARS.split(''));
const bad = (s) => [...s].filter((c) => !VALID.has(c));

/* ═══════════════ A) known-answer ═══════════════ */
const MMS = [
  // ── จำนวน ──
  ['0', 'ศูนย์'], ['1', 'หนึ่ง'], ['10', 'สิบ'], ['11', 'สิบเอ็ด'], ['20', 'ยี่สิบ'], ['21', 'ยี่สิบเอ็ด'], ['101', 'หนึ่งร้อยเอ็ด'],
  ['1,250', 'หนึ่งพันสองร้อยห้าสิบ'], ['3,599', 'สามพันห้าร้อยเก้าสิบเก้า'], ['100,000', 'หนึ่งแสน'], ['1,000,000', 'หนึ่งล้าน'],
  ['1,000,001', 'หนึ่งล้านเอ็ด'], ['21,000,000', 'ยี่สิบเอ็ดล้าน'], ['1,234,567', 'หนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ด'],
  ['1,000,000,000,000', 'หนึ่งล้านล้าน'], ['2,500,000,000,000', 'สองล้านห้าแสนล้าน'],
  ['12,345,678,901,234', 'สิบสองล้านสามแสนสี่หมื่นห้าพันหกร้อยเจ็ดสิบแปดล้านเก้าแสนหนึ่งพันสองร้อยสามสิบสี่'],
  ['123456789', 'หนึ่งสองสาม สี่ห้าหก เจ็ดแปดเก้า'], ['เลขบัญชี 1234567890', 'เลขบัญชี หนึ่งสองสาม สี่ห้าหก เจ็ดแปดเก้าศูนย์'],
  ['007', 'ศูนย์ศูนย์เจ็ด'], ['3.5', 'สามจุดห้า'], ['3.25', 'สามจุดสองห้า'], ['0.05', 'ศูนย์จุดศูนย์ห้า'],
  ['1,250.75', 'หนึ่งพันสองร้อยห้าสิบจุดเจ็ดห้า'], ['-5', 'ลบห้า'], ['อุณหภูมิ -12.5 องศา', 'อุณหภูมิ ลบสิบสองจุดห้า องศา'], ['+5', 'บวกห้า'],
  ['15%', 'สิบห้าเปอร์เซ็นต์'], ['12.5%', 'สิบสองจุดห้าเปอร์เซ็นต์'], ['ลด 50 %', 'ลด ห้าสิบเปอร์เซ็นต์'],
  ['10-20', 'สิบ ถึง ยี่สิบ'], ['ปี 2569-2570', 'ปี สองพันห้าร้อยหกสิบเก้า ถึง สองพันห้าร้อยเจ็ดสิบ'],
  ['1-2345-67890-12-3', 'หนึ่ง สองสามสี่ห้า หกเจ็ดแปดเก้าศูนย์ หนึ่งสอง สาม'],
  ['081-234-5678', 'ศูนย์แปดหนึ่ง สองสามสี่ ห้าหกเจ็ดแปด'], ['0812345678', 'ศูนย์แปดหนึ่ง สองสามสี่ ห้าหกเจ็ดแปด'],
  ['02-1234-5678', 'ศูนย์สอง หนึ่งสองสามสี่ ห้าหกเจ็ดแปด'], ['02-123-4567', 'ศูนย์สอง หนึ่งสองสาม สี่ห้าหกเจ็ด'],
  ['๑๒๓', 'หนึ่งร้อยยี่สิบสาม'], ['๓.๕', 'สามจุดห้า'], ['๑,๒๕๐', 'หนึ่งพันสองร้อยห้าสิบ'], ['๐๘๑-๒๓๔-๕๖๗๘', 'ศูนย์แปดหนึ่ง สองสามสี่ ห้าหกเจ็ดแปด'],
  // ── เงิน ──
  ['฿1,250', 'หนึ่งพันสองร้อยห้าสิบบาท'], ['1,250 บาท', 'หนึ่งพันสองร้อยห้าสิบ บาท'], ['1,250.50 บาท', 'หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์'],
  ['1,250.05 บาท', 'หนึ่งพันสองร้อยห้าสิบบาทห้าสตางค์'], ['1,250.00 บาท', 'หนึ่งพันสองร้อยห้าสิบบาท'], ['฿99.5', 'เก้าสิบเก้าบาทห้าสิบสตางค์'],
  ['ราคา 120 บ.', 'ราคา หนึ่งร้อยยี่สิบ บาท'], ['5.50 บ.', 'ห้าบาทห้าสิบสตางค์'],
  ['$20', 'ยี่สิบดอลลาร์'], ['$12.50', 'สิบสองดอลลาร์ห้าสิบเซนต์'], ['2.5 ล้านบาท', 'สองจุดห้า ล้านบาท'],
  // ── วันที่ ──
  ['12/10/2569', 'สิบสอง ตุลาคม สองพันห้าร้อยหกสิบเก้า'], ['1/1/2026', 'หนึ่ง มกราคม สองพันยี่สิบหก'], ['5/3/69', 'ห้า มีนาคม หกสิบเก้า'],
  ['2026-10-12', 'สิบสอง ตุลาคม สองพันยี่สิบหก'], ['12 ต.ค. 2569', 'สิบสอง ตุลาคม สองพันห้าร้อยหกสิบเก้า'], ['1 ม.ค. 2570', 'หนึ่ง มกราคม สองพันห้าร้อยเจ็ดสิบ'],
  ['32/13/2569', 'สามสิบสอง สิบสาม สองพันห้าร้อยหกสิบเก้า'], ['31/4/2569', 'สามสิบเอ็ด สี่ สองพันห้าร้อยหกสิบเก้า'],
  ['29/2/2567', 'ยี่สิบเก้า กุมภาพันธ์ สองพันห้าร้อยหกสิบเจ็ด'], ['29/2/2569', 'ยี่สิบเก้า สอง สองพันห้าร้อยหกสิบเก้า'],
  ['ก.พ.', 'กุมภาพันธ์'], ['พ.ย.', 'พฤศจิกายน'], ['ธ.ค.', 'ธันวาคม'], ['เม.ย.', 'เมษายน'], ['ส.ค.', 'สิงหาคม'],
  // ── เวลา ──
  ['14:30', 'สิบสี่นาฬิกาสามสิบนาที'], ['14.30 น.', 'สิบสี่นาฬิกาสามสิบนาที'], ['08:05', 'แปดนาฬิกาห้านาที'], ['9:00', 'เก้านาฬิกา'], ['00:00', 'ศูนย์นาฬิกา'],
  ['2:30 PM', 'สิบสี่นาฬิกาสามสิบนาที'], ['25:00', 'ยี่สิบห้า ศูนย์ศูนย์'], ['เวลา 14.30 น. ที่ห้อง', 'เวลา สิบสี่นาฬิกาสามสิบนาที ที่ห้อง'],
  // ── ตัวย่อ ──
  ['พ.ศ. 2569', 'พุทธศักราช สองพันห้าร้อยหกสิบเก้า'], ['ค.ศ. 2026', 'คริสต์ศักราช สองพันยี่สิบหก'], ['พ.ร.บ.คอมพิวเตอร์', 'พระราชบัญญัติคอมพิวเตอร์'],
  ['ป.พ.พ.', 'ประมวลกฎหมายแพ่งและพาณิชย์'], ['ป.อ.', 'ประมวลกฎหมายอาญา'], ['ป.วิ.พ.', 'ประมวลกฎหมายวิธีพิจารณาความแพ่ง'], ['ป.วิ.อ.', 'ประมวลกฎหมายวิธีพิจารณาความอาญา'],
  ['5 กม.', 'ห้า กิโลเมตร'], ['60 กม./ชม.', 'หกสิบ กิโลเมตรต่อชั่วโมง'], ['10 ซม.', 'สิบ เซนติเมตร'], ['3 มม.', 'สาม มิลลิเมตร'], ['2 กก.', 'สอง กิโลกรัม'],
  ['50 ตร.ม.', 'ห้าสิบ ตารางเมตร'], ['2 ชม.', 'สอง ชั่วโมง'], ['กทม.', 'กรุงเทพมหานคร'], ['รพ.', 'โรงพยาบาล'], ['ร.ร.', 'โรงเรียน'],
  ['ดร.สมชาย', 'ดอกเตอร์ สมชาย'], ['นพ.สมศักดิ์', 'นายแพทย์ สมศักดิ์'], ['ผศ.สมหญิง', 'ผู้ช่วยศาสตราจารย์ สมหญิง'], ['รศ.สมหญิง', 'รองศาสตราจารย์ สมหญิง'],
  ['ศ.สมหญิง', 'ศาสตราจารย์ สมหญิง'], ['บจก.ไทย', 'บริษัทจํากัดไทย'], ['หจก.ไทย', 'ห้างหุ้นส่วนจํากัดไทย'],
  ['ฯลฯ', 'และอื่นอื่น'], ['กรุงเทพฯ', 'กรุงเทพ'], ['ประเทศ.', 'ประเทศ'], ['นี่ฯ', 'นี่'],
  ['ม.6', 'มอหก'], ['ม.14', 'มาตรา สิบสี่'], ['ตาม ม.5 วรรคสอง', 'ตาม มาตรา ห้า วรรคสอง'], ['ตามประมวลกฎหมายอาญา ม.3', 'ตามประมวลกฎหมายอาญา มาตรา สาม'],
  ['พ.ร.บ.นี้ ม.9', 'พระราชบัญญัตินี้ มาตรา เก้า'], ['นักเรียน ม.6 ห้อง 2', 'นักเรียน มอหก ห้อง สอง'], ['ม.ค.', 'มกราคม'],
  // ── ๆ ฯ ──
  ['เด็กๆ', 'เด็กเด็ก'], ['ดีๆ', 'ดีดี'], ['ขอบคุณมากๆ', 'ขอบคุณมากมาก'], ['เรื่องต่างๆ', 'เรื่องต่างต่าง'], ['ๆ', ''], ['ทำ น้ำ', 'ทํา น้ํา'],
  // ── อังกฤษปน ──
  ['AI', 'เอไอ'], ['ok', 'โอเค'], ['PDF', 'พีดีเอฟ'], ['Excel', 'เอ็กเซล'], ['Google', 'กูเกิล'], ['LINE', 'ไลน์'], ['Facebook', 'เฟซบุ๊ก'], ['email', 'อีเมล'], ['online', 'ออนไลน์'],
  ['SET', 'เซ็ต'], ['PLC', 'พีแอลซี'], ['kW', 'กิโลวัตต์'], ['ABC', 'เอ บี ซี'], ['XYZ', 'เอ็กซ์ วาย แซด'], ['Hello', ''], ['hello world', ''], ['ใช้Excelทำ', 'ใช้ เอ็กเซล ทํา'],
  ['220V', 'สองร้อยยี่สิบโวลต์'], ['5 kg', 'ห้ากิโลกรัม'], ['30°C', 'สามสิบองศาเซลเซียส'], ['7.5 kW', 'เจ็ดจุดห้ากิโลวัตต์'], ['Plan A', 'เอ'], ["AI's", 'เอไอ'],
  // ── markdown / แชท ──
  ['**ตัวหนา**', 'ตัวหนา'], ['*ตัวเอียง*', 'ตัวเอียง'], ['__ตัวหนา__', 'ตัวหนา'], ['# หัวข้อ', 'หัวข้อ'], ['## หัวข้อรอง', 'หัวข้อรอง'], ['> อ้างอิง', 'อ้างอิง'], ['- รายการ', 'รายการ'],
  ['* รายการ', 'รายการ'], ['• รายการ', 'รายการ'], ['`ทดสอบ`', 'ทดสอบ'], ['[ข้อความ](https://example.com/a?b=1)', 'ข้อความ'], ['https://example.com/abc', 'ลิงก์'],
  ['ดูที่ https://x.co/a.', 'ดูที่ ลิงก์'], ['ติดต่อ a@b.com', 'ติดต่อ อีเมล'], ['😊', ''], ['ดีมาก 👍🏽 ครับ', 'ดีมาก ครับ'], ['| ก | ข |', 'ก ข'], ['---', ''],
  ['ราคา 3,599 บาท **ลด 15%** 😊', 'ราคา สามพันห้าร้อยเก้าสิบเก้า บาท ลด สิบห้าเปอร์เซ็นต์'],
  ['สวัสดีครับ', 'สวัสดีครับ'], ['', '']
];
test.describe('A) forMms — known-answer ทุกกฎ', () => {
  test(`ตารางหลัก (${MMS.length} กรณี) + ผลทุกตัวอยู่ใน vocab`, () => {
    expect(MMS.length).toBeGreaterThanOrEqual(60);
    const wrong = [];
    for (const [input, want] of MMS) {
      const got = N.forMms(input);
      if (got !== want) wrong.push({ input, want, got });
      expect(bad(got), JSON.stringify(input)).toEqual([]);
    }
    expect(wrong).toEqual([]);
  });

  test('ไม่มี Intl.Segmenter: ๆ ซ้ำคำสั้นที่ติดกัน / ตัดทิ้งถ้ายาว — ผลอื่นไม่เปลี่ยน', () => {
    N.useSegmenter(false);
    try {
      expect(N.forMms('เด็กๆ')).toBe('เด็กเด็ก');
      expect(N.forMms('ดีๆ')).toBe('ดีดี');
      expect(N.forMms('ขอบคุณมากๆ')).toBe('ขอบคุณมาก'); // ยาวเกิน 8 ตัวอักษรติดกัน = ตัดทิ้ง
      expect(N.forMms('ฯลฯ')).toBe('และอื่นอื่น'); // คำที่เจอบ่อย ไม่พึ่งตัวตัดคำ
      expect(N.forMms('เรื่องต่างๆ')).toBe('เรื่องต่างต่าง');
      expect(N.forMms('ราคา 3,599 บาท')).toBe('ราคา สามพันห้าร้อยเก้าสิบเก้า บาท');
    } finally { N.useSegmenter(true); }
  });

  test('ตารางคำอ่านทุกตัว (เลข/เดือน/ตัวย่อ/หน่วย/ทับศัพท์/ชื่อตัวอักษร) ผ่านตัวกรอง vocab โดยไม่มีตัวอักษรหาย', () => {
    const T = N.TABLES, words = [];
    T.DIGIT.forEach((w) => words.push(w)); T.MONTHS.forEach((w) => words.push(w)); T.ABBR.forEach((e) => words.push(e[1]));
    Object.values(T.UNITS).forEach((w) => words.push(w)); Object.values(T.EN_DICT).forEach((w) => words.push(w)); Object.values(T.LETTER).forEach((w) => words.push(w));
    T.FIXED.forEach((w) => words.push(w));
    expect(Object.keys(T.EN_DICT).length).toBeGreaterThanOrEqual(80);
    for (const w of words) {
      const clean = w.replace(/ๆ/g, '').replace(/ำ/g, 'ํา').replace(/ +/g, ' ').trim();
      expect(N.filterVocab(w.replace(/ๆ/g, '')), w).toBe(clean);
    }
  });

  test('numberToWords: ล้านซ้อน · เอ็ด/ยี่สิบ · ยาวเกิน 18 หลักอ่านทีละตัว', () => {
    const cases = { 0: 'ศูนย์', 5: 'ห้า', 12: 'สิบสอง', 100: 'หนึ่งร้อย', 1001: 'หนึ่งพันเอ็ด', 10001: 'หนึ่งหมื่นเอ็ด', 999999: 'เก้าแสนเก้าหมื่นเก้าพันเก้าร้อยเก้าสิบเก้า' };
    for (const [n, w] of Object.entries(cases)) expect(N.numberToWords(n)).toBe(w);
    expect(N.numberToWords('1' + '0'.repeat(18))).toBe('หนึ่งสองศูนย์'.slice(0, 0) + '1000000000000000000'.split('').map((c) => N.TABLES.DIGIT[+c]).join(''));
    expect(N.numberToWords('1' + '0'.repeat(12))).toBe('หนึ่งล้านล้าน');
  });
});

const NATIVE = [
  ['# หัวข้อ\n**ตัวหนา** 😊', 'หัวข้อ\nตัวหนา'], ['12 ต.ค. 2569', '12 ตุลาคม 2569'], ['12/10/2569', 'สิบสอง ตุลาคม สองพันห้าร้อยหกสิบเก้า'],
  ['14.30 น.', 'สิบสี่นาฬิกาสามสิบนาที'], ['ดร.สมชาย', 'ดอกเตอร์ สมชาย'], ['พ.ศ. ๒๕๖๙', 'พุทธศักราช 2569'], ['[ลิงก์](http://a.b) https://x.y/z', 'ลิงก์ ลิงก์'],
  ['Read the **docs** at https://x.y/z 😊', 'Read the docs at link'], ['ราคา 1,250 บาท', 'ราคา 1,250 บาท'], ['เด็กๆ ฯลฯ', 'เด็กเด็ก และอื่นอื่น'],
  ['ม.6 / ม.14', 'มอ6 / มาตรา 14'], ['😊😊', ''], ['- หนึ่ง\n- สอง', 'หนึ่ง\nสอง'], ['ติดต่อ a@b.com', 'ติดต่อ อีเมล'], ['Email me: a@b.com', 'Email me: email']
];
test.describe('A) forNative / forMmsEn / plan', () => {
  test(`forNative (${NATIVE.length} กรณี): ล้าง markdown/อีโมจิ/URL + ขยายตัวย่อ · ไม่แปลงตัวเลขเป็นคำ · ไม่กรอง vocab`, () => {
    for (const [input, want] of NATIVE) expect(N.forNative(input), JSON.stringify(input)).toBe(want);
    expect(N.forNative('Hello, world! (test)')).toBe('Hello, world! (test)'); // เครื่องหมาย/อังกฤษคงไว้
  });

  test('forMmsEn: ตัวเลขเป็นคำอังกฤษ · เหลือ a-z \' - และช่องว่างเท่านั้น', () => {
    const cases = [
      ['The price is 3,599 dollars. **Great** 15%!', 'the price is three thousand five hundred ninety nine dollars great fifteen percent'],
      ['Hello, world! 😊', 'hello world'], ['$5.50 and 100', 'five point five zero dollars and one hundred'], ['2026', 'two thousand twenty six'],
      ['1,000,000', 'one million'], ['0.5', 'zero point five'], ['007', 'zero zero seven'], ["It's a well-known fact", "it's a well-known fact"], ['ไทย', ''],
      ['See https://x.y/z', 'see link']
    ];
    for (const [input, want] of cases) expect(N.forMmsEn(input), JSON.stringify(input)).toBe(want);
  });

  test('plan: ช่วงเงียบประโยค 0.12 วิ / ขึ้นบรรทัดในย่อหน้า 0.25 วิ / ย่อหน้า 0.4 วิ / ท่อนสุดท้าย 0', () => {
    expect(N.GAP_SENT_SEC).toBe(0.12); expect(N.GAP_LINE_SEC).toBe(0.25); expect(N.GAP_PARA_SEC).toBe(0.4);
    let p = N.plan('ประโยคหนึ่ง. ประโยคสอง');
    expect(p.chunks).toEqual(['ประโยคหนึ่ง', 'ประโยคสอง']); expect(p.gaps).toEqual([0.12, 0]); expect(p.paras).toEqual([0, 0]);
    p = N.plan('ก\n\nข');
    expect(p.chunks).toEqual(['ก', 'ข']); expect(p.gaps).toEqual([0.4, 0]); expect(p.paras).toEqual([0, 1]);
    p = N.plan('ประโยคหนึ่ง! ประโยคสอง?\nย่อหน้าสอง ประโยคเดียว. จบ');
    expect(p.chunks).toEqual(['ประโยคหนึ่ง', 'ประโยคสอง', 'ย่อหน้าสอง ประโยคเดียว', 'จบ']);
    expect(p.gaps).toEqual([0.12, 0.25, 0.12, 0]); // บรรทัดใหม่ในย่อหน้าเดียวกัน (ไม่มีบรรทัดว่างคั่น) = 0.25 วิ · paras ยังเป็นย่อหน้าเดียว
    expect(p.paras).toEqual([0, 0, 0, 0]);
    p = N.plan('ประโยคหนึ่ง! ประโยคสอง?\n\nย่อหน้าสอง ประโยคเดียว. จบ');
    expect(p.gaps).toEqual([0.12, 0.4, 0.12, 0]); expect(p.paras).toEqual([0, 0, 1, 1]);
    p = N.plan('ก ข ค'); expect(p.chunks).toEqual(['ก ข ค']); expect(p.gaps).toEqual([0]);
    p = N.plan(''); expect(p).toEqual({ chunks: [], gaps: [], paras: [] });
    p = N.plan('😊\n\n**'); expect(p.chunks).toEqual([]);
    p = N.plan('This is the first sentence. This is another one.', { lang: 'en' });
    expect(p.chunks).toEqual(['this is the first sentence', 'this is another one']); expect(p.gaps).toEqual([0.12, 0]);
  });

  test('chunks: แปลงก่อนตัด — เลขที่ขยายเป็นคำแล้วยาวเกินเพดานไม่หลุดเพดาน · ไม่ฉีกคำ · max ปรับได้', () => {
    const nums = 'ราคา ' + Array.from({ length: 40 }, () => '1,250').join(' ');
    const cs = N.chunks(nums);
    expect(cs.length).toBeGreaterThan(5);
    cs.forEach((c) => { expect(c.length).toBeLessThanOrEqual(N.MAX_CHUNK); expect(bad(c)).toEqual([]); });
    expect(cs.join(' ')).toBe(N.forMms(nums)); // ตัดแล้วต่อกันได้ข้อความเดิมพอดี (ไม่มีอะไรหาย/เบิ้ล)
    // เดิม (ตัด 60 ก่อนแปลง): "999,999 บาท" ซ้ำ ๆ → ท่อนหลังแปลงยาวหลายเท่า
    const big = Array.from({ length: 20 }, () => '999,999').join(' ');
    N.chunks(big).forEach((c) => expect(c.length).toBeLessThanOrEqual(N.MAX_CHUNK));
    N.chunks('สวัสดีครับ ' + 'ทดสอบ '.repeat(30), 20).forEach((c) => expect(c.length).toBeLessThanOrEqual(20));
    expect(N.chunks('เลข ' + '7'.repeat(N.MAX_CHUNK + 10)).every((c) => c.length <= N.MAX_CHUNK)).toBe(true);
  });

  for (const seg of [true, false]) {
    test(`ข้อความไทยยาวไม่เว้นวรรค (${seg ? 'Intl.Segmenter' : 'ไม่มีตัวตัดคำ'}): ทุกท่อน ≤ MAX_CHUNK · ไม่ตัดกลางพยางค์ (ไม่ขึ้นต้นด้วยสระตาม/วรรณยุกต์ ไม่ลงท้ายด้วยสระนำ) · ข้อความครบ`, () => {
      N.useSegmenter(seg);
      try {
        const long = 'เกมเด็กเล่นแม่น้ำใหญ่ไหลผ่านเมืองเก่า'.repeat(14);
        const cs = N.chunks(long);
        expect(cs.length).toBeGreaterThan(3);
        cs.forEach((c) => {
          expect(c.length).toBeLessThanOrEqual(N.MAX_CHUNK);
          expect(/^[ะ-ฺๅ็-๎]/.test(c), 'ขึ้นต้น: ' + c).toBe(false);
          expect(/[เ-ไ]$/.test(c), 'ลงท้าย: ' + c).toBe(false);
        });
        expect(cs.join('')).toBe(long.replace(/ำ/g, 'ํา')); // ำ → ํา (ไม่อยู่ใน vocab)
      } finally { N.useSegmenter(true); }
    });
  }
});

test('ไม่ช้าแบบกำลังสองกับข้อความยาว/แพทเทิร์นแย่ (เลข/อักษรติดกัน 100,000+ ตัว, "[" ซ้ำ, "@", "ม.5" ซ้ำ, เอกสาร 400,000 ตัวอักษร) — แต่ละกรณี < 4 วินาที', () => {
  const base = 'ราคา 3,599 บาท **ลด 15%** วันที่ 12/10/2569 เวลา 14.30 น. โทร 081-234-5678 ตาม ม.14 ม.5 พ.ร.บ. ดูที่ https://example.com/a?b=1 เด็กๆ AI OK 😊\n';
  const cases = {
    เอกสารยาว: base.repeat(3000), ไทยติดกัน: 'ก'.repeat(200000), เลขติดกัน: '9'.repeat(100000), 'อังกฤษ+ขีด': 'a'.repeat(100000) + ' ' + '-'.repeat(30000),
    'อังกฤษ+@': 'a'.repeat(100000) + '@', 'วงเล็บเหลี่ยม': '['.repeat(100000), 'ม.5 ซ้ำ': 'ม.5 '.repeat(20000), 'เลขคั่นขีด': '1-'.repeat(50000), 'ๆ ท้ายสายยาว': 'ก'.repeat(100000) + 'ๆ'
  };
  for (const [name, text] of Object.entries(cases)) {
    const t0 = Date.now();
    N.forMms(text); N.plan(text); N.forNative(text);
    expect(Date.now() - t0, name).toBeLessThan(4000);
  }
});

/* ═══════════════ B) fuzz ═══════════════ */
function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const POOL = {
  th: ['สวัสดี', 'ครับ', 'ค่ะ', 'ราคา', 'บาท', 'ทำ', 'น้ำ', 'ประเทศไทย', 'กรุงเทพฯ', 'เด็กๆ', 'ฯลฯ', 'พ.ร.บ.', 'ม.6', 'ม.14', 'วรรคสอง', 'ดร.สมชาย', 'กม.', 'ตร.ม.', 'ต.ค.', 'พ.ศ.', 'ไฟฟ้า', 'วงจร', 'การลงทุน', 'ผลตอบแทน', 'ขอบคุณมากๆ', 'ปรากฏการณ์ธรรมชาติที่น่าสนใจอย่างยิ่ง', 'ๆ', 'ฯ', 'ฤๅษี', 'ฦ', 'ฃ', 'ฅ'],
  en: ['AI', 'OK', 'PDF', 'Excel', 'Google', 'hello', 'world', 'PLC', 'kW', 'XYZ', 'iPhone', 'COVID-19', 'e-mail', "don't", 'Wi-Fi', 'ABCDEFG', 'x', 'I'],
  num: ['0', '7', '42', '100', '1,250', '3,599', '1,000,000', '12,345,678,901,234', '3.5', '3.25', '0.05', '-5', '+7', '15%', '12.5%', '123456789', '0812345678', '081-234-5678', '02-1234-5678', '1-2345-67890-12-3', '10-20', '฿1,250', '1,250.50 บาท', '$12.50', '220V', '5 kg', '30°C', '๑๒๓', '๓.๕', '99999999999999999999999', '007', '1,25'],
  date: ['12/10/2569', '1/1/26', '2026-10-12', '12 ต.ค. 2569', '32/13/2569', '29/2/2569', '31/4/2569', '14:30', '14.30 น.', '08:05', '25:99', '2:30 PM', '24:00'],
  emoji: ['😊', '👍🏽', '🇹🇭', '❤️', '✅', '👨‍👩‍👧', '🎉', '→', '↔', '™'],
  md: ['**', '__', '#', '##', '`', '```', '>', '- ', '* ', '•', '[ลิงก์](https://a.b/c)', 'https://example.com/path?q=1', 'a@b.com', '|', '---', '~~', '<br>', '<b>x</b>', '\\', '_'],
  punct: ['.', ',', '!', '?', ';', ':', '…', '(', ')', '"', '“', '”', '/', '-', '–', '\n', '\n\n', '\t', '  ', '​']
};
test('B) fuzz 2,000 ข้อความสุ่ม (ไทย/อังกฤษ/ตัวเลข/อีโมจิ/markdown): ทุกตัวอักษรของ forMms อยู่ใน vocab · ไม่มีเลขเหลือ · ทุกท่อน ≤ MAX_CHUNK · ท่อนต่อกัน = forMms · ไม่มี exception', () => {
  const r = rng(20261010);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const kinds = Object.keys(POOL);
  const problems = [];
  for (let i = 0; i < 2000; i++) {
    let s = '';
    const n = 1 + Math.floor(r() * 30);
    for (let k = 0; k < n; k++) {
      s += pick(POOL[pick(kinds)]);
      s += r() < 0.6 ? ' ' : '';
    }
    if (i % 97 === 0) s += pick(POOL.th).repeat(40); // ข้อความไทยติดกันยาว
    if (i % 53 === 0) s += '9'.repeat(1 + Math.floor(r() * 80));
    let out, cs, pl, en;
    try {
      out = N.forMms(s); pl = N.plan(s); cs = pl.chunks; en = N.forMmsEn(s);
      N.forNative(s);
    } catch (e) { problems.push({ s, error: String(e) }); continue; }
    const b = bad(out);
    if (b.length || /\d/.test(out.replace(/[0124]/g, (m) => (VALID.has(m) ? '' : m))) || /[0-9]/.test(out)) problems.push({ s, out, why: 'นอก vocab/มีเลขเหลือ', b });
    for (const c of cs) {
      if (c.length > N.MAX_CHUNK || c.length === 0 || c !== c.trim() || bad(c).length) problems.push({ s, c, why: 'ท่อนผิด' });
    }
    if (cs.join(' ').replace(/ /g, '') !== out.replace(/ /g, '')) problems.push({ s, out, cs, why: 'ท่อนต่อกันไม่เท่า forMms' });
    if (pl.gaps.length !== cs.length || pl.paras.length !== cs.length || (cs.length && pl.gaps[cs.length - 1] !== 0)) problems.push({ s, why: 'gaps' });
    if (/[^a-z' \-\n]/.test(en)) problems.push({ s, en, why: 'forMmsEn นอก a-z' });
  }
  expect(problems.slice(0, 5)).toEqual([]);
});

test('B) fuzz ซ้ำแบบไม่มีตัวตัดคำ (500 ข้อความ) — เส้นทางสำรองก็ไม่หลุดเพดาน/vocab', () => {
  N.useSegmenter(false);
  try {
    const r = rng(77), pick = (a) => a[Math.floor(r() * a.length)];
    for (let i = 0; i < 500; i++) {
      let s = '';
      for (let k = 0; k < 25; k++) s += pick(POOL.th) + pick(['', ' ', '.', '\n']) + (r() < 0.2 ? pick(POOL.num) : '');
      s += 'กรุงเทพมหานครอมรรัตนโกสินทร์'.repeat(1 + (i % 6));
      const cs = N.chunks(s);
      cs.forEach((c) => { expect(c.length).toBeLessThanOrEqual(N.MAX_CHUNK); expect(bad(c)).toEqual([]); });
    }
  } finally { N.useSegmenter(true); }
});

/* ═══════════════ C) หน้า/วิดเจ็ตจริง ═══════════════ */
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const TH_SMALL = 'Tanotfin/distill-whisper-th-small-onnx';

/* transformers.js หลอก: TTS "โยน error เมื่อเจอตัวอักษรนอก vocab" เหมือนโมเดลจริง (Gather index out of bounds) · บันทึกข้อความที่ได้รับทุกครั้ง */
function fakeTransformers({ chat }) {
  return `
const VOCAB = new Set(${JSON.stringify(N.VALID_CHARS.split(''))});
const CHAT = ${JSON.stringify(chat || ['สวัสดี', 'ครับ'])};
export const env = { backends: { onnx: { wasm: {} } } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export class TextStreamer { constructor(tok, o) { this.o = o; } }
export async function pipeline(task, model, opts) {
  if (opts && opts.progress_callback) opts.progress_callback({ status: 'progress', file: 'onnx/model.onnx', progress: 50 });
  if (task === 'automatic-speech-recognition') {
    const f = async (pcm, o) => ({ text: 'seg:' + pcm.length + ':' + ((o && o.language) || 'auto') + ':' + model });
    f.dispose = async () => {};
    return f;
  }
  if (task === 'text-to-speech') {
    return async (text) => {
      const out = [...text].filter((c) => !VOCAB.has(c));
      if (out.length) throw new Error('Gather node index out of bounds: ' + JSON.stringify(out.join('')));
      if (!text.trim() || text.length > ${N.MAX_CHUNK}) throw new Error('bad chunk length ' + text.length);
      const a = new Float32Array(1600);
      for (let i = 0; i < a.length; i++) a[i] = Math.sin(i / 5) * 0.3;
      return { audio: a, sampling_rate: 16000 };
    };
  }
  const g = async (messages, o) => { for (const t of CHAT) { o.streamer.o.callback_function(t); await sleep(5); } return []; };
  g.tokenizer = {};
  return g;
}`;
}
/* ดักข้อความที่ส่งเข้า tts-worker + เวลาที่ AudioBufferSourceNode.start() ถูกสั่ง */
const SPY = `(() => {
  const W = window.Worker;
  window.__batches = []; window.__workers = [];
  function Spy(url, opts) {
    const w = new W(url, opts);
    window.__workers.push(String(url));
    const post = w.postMessage.bind(w);
    w.postMessage = function (m, tr) { if (m && m.type === 'synthesize-batch') window.__batches.push({ url: String(url), model: m.modelId, items: m.items.map((i) => i.text) }); return post(m, tr); };
    return w;
  }
  Spy.prototype = W.prototype; window.Worker = Spy;
  window.__starts = [];
  const st = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when) { window.__starts.push({ when: when || 0, dur: this.buffer ? this.buffer.duration : 0 }); return st.apply(this, arguments); };
})();`;

async function setup(context, page, { chat, init, route } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await context.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (/\/vendor\/transformers\/transformers\.web\.min\.js$/.test(u.pathname)) return r.fulfill({ contentType: 'text/javascript', body: fakeTransformers({ chat }) });
    if (route) { const h = await route(r, u); if (h) return; }
    if (u.pathname === '/api/ai/usage') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ used: 10, limit: 10000 }) });
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return r.continue();
    return r.abort('internetdisconnected');
  });
  await page.addInitScript(SPY);
  await page.addInitScript((i) => { try { localStorage.setItem('ome:theme', 'light'); } catch (e) {} if (i) (0, eval)(i); }, init || '');
  return errors;
}
async function ask(page, text) {
  await page.click('.ome-ai-fab');
  await page.fill('.ome-ai-inputrow textarea', text);
  await page.click('.ome-ai-btn.send');
}

test.describe('C) วิดเจ็ตแชท — พูดคำตอบไม่พังและพูดข้อความที่ normalize แล้วเท่านั้น', () => {
  test('"ราคา 3,599 บาท **ลด 15%** 😊" → Worker ได้รับเฉพาะตัวอักษรใน vocab (ท่อน ≤ MAX_CHUNK) · ไม่ error · ไม่มี log ปัญหา · เล่นเสียงครบทุกท่อน', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await ctx.newPage();
    const errors = await setup(ctx, page, { chat: ['ราคา 3,599 บาท ', '**ลด 15%** ', '😊\n\nขอบคุณมากๆ ครับ เปิดดูที่ https://example.com/a วันที่ 12/10/2569 เวลา 14.30 น.'] });
    await page.addInitScript(() => localStorage.setItem('ome:aiChatSpeak', 'on'));
    await page.goto('/credits.html');
    await ask(page, 'ทดสอบ');
    await expect(page.locator('.ome-ai-row.bot .ome-ai-bubble')).toContainText('ขอบคุณมากๆ', { timeout: 15000 });
    await expect.poll(() => page.evaluate(() => window.__batches.length), { timeout: 10000 }).toBe(1);
    const b = (await page.evaluate(() => window.__batches))[0];
    expect(b.model).toBe('Tanotfin/mms-tts-2081-FM-onnx');
    expect(b.items.length).toBeGreaterThanOrEqual(2);
    for (const t of b.items) { expect(bad(t), t).toEqual([]); expect(t.length).toBeLessThanOrEqual(N.MAX_CHUNK); expect(t).not.toMatch(/\d/); }
    expect(b.items[0]).toBe('ราคา สามพันห้าร้อยเก้าสิบเก้า บาท ลด สิบห้าเปอร์เซ็นต์');
    expect(b.items.join(' ')).toContain('สิบสอง ตุลาคม สองพันห้าร้อยหกสิบเก้า');
    expect(b.items.join(' ')).toContain('สิบสี่นาฬิกาสามสิบนาที');
    expect(b.items.join(' ')).toContain('ขอบคุณมากมาก');
    // เล่นครบทุกท่อน (ท่อนละ 0.1 วิ) และไม่มีข้อความ error
    await expect.poll(() => page.evaluate(() => window.__starts.length), { timeout: 10000 }).toBe(b.items.length);
    await expect(page.locator('.ome-ai-status')).not.toHaveClass(/err/);
    await expect(page.locator('.ome-ai-panel, body').first()).not.toContainText('พูดคำตอบไม่สำเร็จ');
    expect(await page.evaluate(() => localStorage.getItem('tanot:media:log'))).toBeNull();
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('ช่องว่างระหว่างท่อน: ประโยคเดียวกัน ~0.12 วิ · ขึ้นย่อหน้าใหม่ ~0.4 วิ (เล่นต่อท้ายท่อนก่อนหน้า)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await ctx.newPage();
    await setup(ctx, page, { chat: ['ประโยคหนึ่ง. ประโยคสอง\n\nย่อหน้าใหม่'] });
    await page.addInitScript(() => localStorage.setItem('ome:aiChatSpeak', 'on'));
    await page.goto('/credits.html');
    await ask(page, 'ทดสอบ');
    await expect.poll(() => page.evaluate(() => window.__starts.length), { timeout: 15000 }).toBe(3);
    const s = await page.evaluate(() => window.__starts);
    expect((await page.evaluate(() => window.__batches[0].items))).toEqual(['ประโยคหนึ่ง', 'ประโยคสอง', 'ย่อหน้าใหม่']);
    const d1 = s[1].when - s[0].when - s[0].dur, d2 = s[2].when - s[1].when - s[1].dur;
    expect(d1).toBeGreaterThanOrEqual(0.115); expect(d1).toBeLessThan(0.3);
    expect(d2).toBeGreaterThanOrEqual(0.395); expect(d2).toBeLessThan(0.6);
    await ctx.close();
  });

  test('คำตอบที่มีแต่อีโมจิ/สัญลักษณ์ → ไม่พูด ไม่ error ไม่สร้าง Worker เสียง', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await ctx.newPage();
    const errors = await setup(ctx, page, { chat: ['😊 ', '👍', ' ***'] });
    await page.addInitScript(() => localStorage.setItem('ome:aiChatSpeak', 'on'));
    await page.goto('/credits.html');
    await ask(page, 'ทดสอบ');
    await expect(page.locator('.ome-ai-row.bot .ome-ai-bubble')).toContainText('👍', { timeout: 15000 });
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => window.__workers.filter((u) => /tts-worker/.test(u)).length)).toBe(0);
    await expect(page.locator('.ome-ai-status')).not.toHaveClass(/err/);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('คำตอบอังกฤษล้วน → โมเดลอังกฤษ ได้เฉพาะ a-z \' - ช่องว่าง (ตัวเลขเป็นคำ)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await ctx.newPage();
    await setup(ctx, page, { chat: ['The total is 3,599 dollars. **Thanks** 😊'] });
    await page.addInitScript(() => localStorage.setItem('ome:aiChatSpeak', 'on'));
    await page.goto('/credits.html');
    await ask(page, 'test');
    await expect.poll(() => page.evaluate(() => window.__batches.length), { timeout: 15000 }).toBe(1);
    const b = (await page.evaluate(() => window.__batches))[0];
    expect(b.model).toBe('Xenova/mms-tts-eng');
    expect(b.items).toEqual(['the total is three thousand five hundred ninety nine dollars', 'thanks']);
    await ctx.close();
  });

  test('iPhone: ใช้เสียงของระบบ (speechSynthesis) ด้วย forNative — ไม่มีมาร์กดาวน์/อีโมจิ, ไม่สร้าง Worker เสียง', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: IOS_UA, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const sse = 'data:{"t":"ราคา 3,599 บาท **ลด 15%** 😊 ดร.สมชาย"}\n\ndata:{"done":true,"model":"fake"}\n\n';
    const errors = await setup(ctx, page, {
      init: `window.TANOT_AI = { enabled: true }; window.__spoken = [];
        window.SpeechSynthesisUtterance = function (t) { this.text = t; };
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { window.__spoken.push({ text: u.text, lang: u.lang }); }, cancel() {}, getVoices() { return []; } } });`,
      route: async (r, u) => { if (u.pathname === '/api/ai/chat') { await r.fulfill({ contentType: 'text/event-stream', body: sse }); return true; } return false; }
    });
    await page.addInitScript(() => localStorage.setItem('ome:aiChatSpeak', 'on'));
    await page.goto('/credits.html');
    await ask(page, 'ทดสอบ');
    await expect.poll(() => page.evaluate(() => window.__spoken.filter((s) => s.text).length), { timeout: 15000 }).toBe(1);
    const sp = (await page.evaluate(() => window.__spoken)).filter((s) => s.text);
    expect(sp[0]).toEqual({ text: 'ราคา 3,599 บาท ลด 15% ดอกเตอร์ สมชาย', lang: 'th-TH' });
    expect(await page.evaluate(() => window.__workers.filter((u) => /tts-worker/.test(u)).length)).toBe(0);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

function wav({ seconds, rate = 16000 }) {
  const n = Math.round(rate * seconds), bytes = 44 + n * 2, b = Buffer.alloc(bytes);
  b.write('RIFF', 0); b.writeUInt32LE(bytes - 8, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(0.3 * Math.sin(i / 7) * 32767), 44 + i * 2);
  return b;
}

test.describe('C) หน้า text-to-speech', () => {
  test('สร้างไฟล์เสียง: ท่อนที่ส่งเข้าโมเดลอยู่ใน vocab ทั้งหมด · ความเงียบรายท่อน 0.12 / 0.4 วิ ในไฟล์ .wav', async ({ context, page }) => {
    const errors = await setup(context, page);
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', 'ราคา 3,599 บาท. ลด 15%\n\nย่อหน้าใหม่ 😊');
    await page.click('#dlGenerateBtn');
    await expect(page.locator('#dlStatus')).toHaveClass(/ok/, { timeout: 30000 });
    const items = (await page.evaluate(() => window.__batches)).flatMap((b) => b.items);
    expect(items.length).toBe(3);
    for (const t of items) expect(bad(t), t).toEqual([]);
    const files = await page.evaluate(async () => {
      const wav = new Uint8Array(await (await fetch(document.getElementById('dlWavLink').href)).arrayBuffer());
      return { len: wav.length };
    });
    // 3 ท่อน × 1600 sample + ความเงียบ: ท่อน1→2 ประโยคเดียวกัน 0.12 วิ, ท่อน2→3 ขึ้นย่อหน้าใหม่ 0.4 วิ
    expect(files.len).toBe(44 + (3 * 1600 + Math.round(16000 * 0.12) + Math.round(16000 * 0.4)) * 2);
    expect(errors).toEqual([]);
  });

  test('ข้อความที่ปกติทำให้พัง (เลข 3/5–9, เลขไทย, ๆ ฯ, markdown, อีโมจิ) สร้างไฟล์เสียงได้ไม่ error', async ({ context, page }) => {
    const errors = await setup(context, page);
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', '**สรุป** 1,250 บาท 3.5% เลข ๓๕๗๙ เด็กๆ ฯลฯ 12 ต.ค. 2569 เวลา 14:30 โทร 081-234-5678 ม.14 ดู https://x.co 😊');
    await page.click('#dlGenerateBtn');
    await expect(page.locator('#dlStatus')).toHaveClass(/ok/, { timeout: 30000 });
    expect(errors).toEqual([]);
  });

  test('ดูข้อความที่จะอ่านจริง: forMms ตามภาษาที่เลือก + forNative สำหรับฟังทันที · อัปเดตตามที่พิมพ์ · ไม่ล้นจอมือถือ', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = await setup(ctx, page);
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', 'ราคา 3,599 บาท **ลด 15%** 😊\n\nย่อหน้าสอง');
    await page.locator('#pvMmsBox > summary').click();
    await expect(page.locator('#pvMms')).toHaveValue('ราคา สามพันห้าร้อยเก้าสิบเก้า บาท ลด สิบห้าเปอร์เซ็นต์\n\nย่อหน้าสอง');
    await page.locator('#pvNativeBox > summary').click();
    await expect(page.locator('#pvNative')).toHaveValue('ราคา 3,599 บาท ลด 15%\nย่อหน้าสอง');
    await page.fill('#ttsText', 'ยอดรวม ๒๕๐ บาท');
    await expect(page.locator('#pvMms')).toHaveValue('ยอดรวม สองร้อยห้าสิบ บาท');
    await expect(page.locator('#pvNative')).toHaveValue('ยอดรวม 250 บาท');
    await page.fill('#ttsText', 'Hello 25 world');
    await page.selectOption('#dlLang', 'en');
    await expect(page.locator('#pvMms')).toHaveValue('hello twenty five world');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('#pvMms').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('ดูข้อความที่จะอ่านจริง: ภาษาอังกฤษ (ome:lang=en) ป้ายครบ ไม่มีไทยหลุด', async ({ context, page }) => {
    await setup(context, page);
    await page.addInitScript(() => localStorage.setItem('ome:lang', 'en'));
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#pvMmsBox > summary')).toHaveText('See the text that will be read');
    await expect(page.locator('#pvNativeBox > summary')).toHaveText('See the text that will be read');
    await expect(page.locator('#pvMms')).toHaveAttribute('aria-label', 'Text that will be read aloud');
    await page.locator('#pvMmsBox > summary').click();
    const thai = await page.evaluate(() => [...document.querySelectorAll('#pvMmsBox summary, #pvNativeBox summary')].filter((e) => /[฀-๿]/.test(e.textContent)).length);
    expect(thai).toBe(0);
  });
});

test.describe('C) ถอดเสียง — ภาษาเริ่มต้นไทย + จำที่เลือก', () => {
  const localEngine = () => localStorage.setItem('tanot:asr:engine', 'local');

  test('เปิดครั้งแรก = ไทย → Thonburian small · เลือกอังกฤษแล้วโหลดหน้าใหม่ = อังกฤษ (จำใน tanot:asr:lang) · ตรวจจับอัตโนมัติก็จำ', async ({ context, page }) => {
    const errors = await setup(context, page);
    await page.addInitScript(localEngine);
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#asrLang')).toHaveValue('thai');
    await expect(page.locator('#asrModel')).toHaveValue(TH_SMALL);
    expect(await page.evaluate(() => localStorage.getItem('tanot:asr:lang'))).toBeNull(); // ยังไม่เลือกเอง = ไม่เขียนอะไร
    await page.selectOption('#asrLang', 'english');
    await expect(page.locator('#asrModel')).toHaveValue('Xenova/whisper-tiny');
    expect(await page.evaluate(() => localStorage.getItem('tanot:asr:lang'))).toBe('english');
    await page.reload();
    await expect(page.locator('#asrLang')).toHaveValue('english');
    await expect(page.locator('#asrModel')).toHaveValue('Xenova/whisper-tiny');
    await page.selectOption('#asrLang', 'auto');
    await page.reload();
    await expect(page.locator('#asrLang')).toHaveValue('auto');
    await page.selectOption('#asrLang', 'thai');
    await page.reload();
    await expect(page.locator('#asrLang')).toHaveValue('thai');
    await expect(page.locator('#asrModel')).toHaveValue(TH_SMALL);
    expect(errors).toEqual([]);
  });

  test('ค่าที่เก็บไว้เสียหาย → กลับเป็นไทย', async ({ context, page }) => {
    await setup(context, page);
    await page.addInitScript(() => { localStorage.setItem('tanot:asr:lang', 'klingon'); localStorage.setItem('tanot:asr:engine', 'local'); });
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#asrLang')).toHaveValue('thai');
  });

  test('เลือกรุ่นเองแล้วไม่ถูกทับ — เปลี่ยนภาษาไปมา รุ่นที่เลือกยังอยู่ (แม้โหลดหน้าใหม่ด้วยภาษาไทยที่จำไว้)', async ({ context, page }) => {
    await setup(context, page);
    await page.addInitScript(localEngine);
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#asrModel')).toHaveValue(TH_SMALL);
    await page.selectOption('#asrModel', 'Xenova/whisper-base');
    await page.selectOption('#asrLang', 'english');
    await expect(page.locator('#asrModel')).toHaveValue('Xenova/whisper-base');
    await page.selectOption('#asrLang', 'thai');
    await expect(page.locator('#asrModel')).toHaveValue('Xenova/whisper-base');
    await page.reload(); // ภาษาไทยที่จำไว้ + ไม่เคยเลือกรุ่นในหน้านี้ → ค่าเริ่มต้นของภาษา (รุ่นไม่ถูกจำข้ามการเปิดหน้า เหมือนเดิม)
    await expect(page.locator('#asrLang')).toHaveValue('thai');
    await expect(page.locator('#asrModel')).toHaveValue(TH_SMALL);
  });

  test('ในเบราว์เซอร์: ไม่แตะอะไรเลย → ถอดด้วย Thonburian small และบังคับภาษา thai', async ({ context, page }) => {
    const errors = await setup(context, page);
    await page.addInitScript(localEngine);
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#asrModel')).toHaveValue(TH_SMALL);
    await page.setInputFiles('#asrFile', { name: 'a.wav', mimeType: 'audio/wav', buffer: wav({ seconds: 2 }) });
    await page.click('#asrGoBtn');
    await expect(page.locator('#asrStatus')).toHaveClass(/ok/, { timeout: 20000 });
    expect(await page.inputValue('#asrResult')).toMatch(new RegExp('^seg:\\d+:thai:' + TH_SMALL + '$'));
    expect(errors).toEqual([]);
  });

  test('คลาวด์: ค่าเริ่มต้น → ส่ง language=th · เลือกอังกฤษแล้วโหลดใหม่ → language=en · อัตโนมัติ → ไม่ส่ง language', async ({ context, page }) => {
    const langs = [];
    await setup(context, page, {
      init: 'window.TANOT_AI = { enabled: true };',
      route: async (r, u) => {
        if (u.pathname !== '/api/asr') return false;
        langs.push(r.request().postDataJSON().language);
        await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: 'ok', segments: [{ start: 0, end: 1, text: 'ok' }], neurons: 1 }) });
        return true;
      }
    });
    await page.goto('/text-to-speech.html');
    const run = async () => {
      await page.setInputFiles('#asrFile', { name: 'a.wav', mimeType: 'audio/wav', buffer: wav({ seconds: 2 }) });
      await page.click('#asrGoBtn');
      await expect(page.locator('#asrStatus')).toHaveClass(/ok/, { timeout: 20000 });
    };
    await run();
    expect(langs).toEqual(['th']);
    await page.selectOption('#asrLang', 'english');
    await page.reload();
    await expect(page.locator('#asrLang')).toHaveValue('english');
    await run();
    expect(langs).toEqual(['th', 'en']);
    await page.selectOption('#asrLang', 'auto');
    await page.reload();
    await run();
    expect(langs).toEqual(['th', 'en', undefined]);
  });
});
