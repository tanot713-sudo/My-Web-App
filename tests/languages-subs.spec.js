// @ts-check
// หน้า languages โหมด "ซับไตเติล" (ROADMAP แถว 25 / L4): known-answer ของ LangCalc.subs + หน้าจริงกับ WAV/ซับที่สร้างในเทสต์
// ไฟล์ของผู้ใช้อยู่ในเครื่องเท่านั้น — เทสต์ตรวจว่าไม่มีคำขอ /api อื่นนอกจาก /api/asr ของคลิปพูดตาม
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');
const S = require('../lang-calc.js').subs;

// ───────────────────────── ตรรกะล้วน ─────────────────────────
test.describe('LangCalc.subs.parseSubs', () => {
  test('SRT พื้นฐาน: เลขลำดับ + เวลา hh:mm:ss,mmm + หลายบรรทัดรวมเป็นประโยคเดียว', () => {
    const srt = '1\n00:00:01,000 --> 00:00:03,500\nHello there.\nHow are you?\n\n2\n00:01:02,250 --> 00:01:04,000\nFine, thanks.\n';
    expect(S.parseSubs(srt)).toEqual([
      { start: 1, end: 3.5, text: 'Hello there. How are you?' },
      { start: 62.25, end: 64, text: 'Fine, thanks.' },
    ]);
  });

  test('BOM + CRLF + CR เดี่ยว ได้ผลเดียวกับ LF', () => {
    const lf = '1\n00:00:01,000 --> 00:00:02,000\nA\n\n2\n00:00:03,000 --> 00:00:04,000\nB\n';
    const want = S.parseSubs(lf);
    expect(want.length).toBe(2);
    expect(S.parseSubs('﻿' + lf.replace(/\n/g, '\r\n'))).toEqual(want);
    expect(S.parseSubs(lf.replace(/\n/g, '\r'))).toEqual(want);
  });

  test('WebVTT: หัวไฟล์/NOTE/STYLE/id ของ cue/เวลา mm:ss.mmm/cue settings', () => {
    const vtt = 'WEBVTT - ตัวอย่าง\n\nNOTE นี่คือหมายเหตุ\nบรรทัดสอง\n\nSTYLE\n::cue { color: red }\n\nintro\n00:01.000 --> 00:02.500 align:start position:10%\nFirst cue\n\n01:00:00.000 --> 01:00:01.000\nHour cue\n';
    expect(S.parseSubs(vtt)).toEqual([
      { start: 1, end: 2.5, text: 'First cue' },
      { start: 3600, end: 3601, text: 'Hour cue' },
    ]);
  });

  test('ตัดแท็ก <i> <b> <c.x> <v> <00:00:01.000> และ {\\an8} + แปลง entity', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,000\n{\\an8}<i>Hello</i> <font color="#fff">W&amp;rld</font>\n\n2\n00:00:03,000 --> 00:00:04,000\n<v Bob>Hi <00:00:03.500><c.yellow>there</c> &lt;b&gt; &nbsp;x\n';
    expect(S.parseSubs(srt)).toEqual([
      { start: 1, end: 2, text: 'Hello W&rld' },
      { start: 3, end: 4, text: 'Hi there <b> x' },
    ]);
  });

  test('จุดทศนิยม/จุลภาคแบบสั้น ("1,5" = 500 ms) และไม่มีมิลลิวินาที', () => {
    const srt = '1\n00:00:01,5 --> 00:00:02\nA\n\n2\n00:00:03.25 --> 00:00:04.007\nB\n';
    expect(S.parseSubs(srt)).toEqual([
      { start: 1.5, end: 2, text: 'A' },
      { start: 3.25, end: 4.007, text: 'B' },
    ]);
  });

  test('เวลาเพี้ยน: end ≤ start, นาที/วินาที ≥ 60, ไม่ใช่เวลา — ข้าม cue นั้นแต่ cue อื่นยังอยู่', () => {
    const srt = [
      '1\n00:00:05,000 --> 00:00:04,000\nend ก่อน start',
      '2\n00:00:05,000 --> 00:00:05,000\nสั้นเป็นศูนย์',
      '3\n00:61:00,000 --> 00:62:00,000\nนาทีเกิน',
      '4\n00:00:xx,000 --> 00:00:09,000\nไม่ใช่เวลา',
      '5\n00:00:10,000 --> 00:00:12,000\nอันนี้ใช้ได้',
    ].join('\n\n');
    expect(S.parseSubs(srt)).toEqual([{ start: 10, end: 12, text: 'อันนี้ใช้ได้' }]);
  });

  test('cue ว่าง (ไม่มีข้อความ/มีแต่แท็ก) ถูกข้าม · เรียงตามเวลาเริ่ม', () => {
    const srt = '2\n00:00:10,000 --> 00:00:11,000\nlater\n\n1\n00:00:01,000 --> 00:00:02,000\n<i></i>\n\n3\n00:00:03,000 --> 00:00:04,000\nearly\n';
    expect(S.parseSubs(srt).map((c) => c.text)).toEqual(['early', 'later']);
  });

  test('SRT ที่ลืมบรรทัดว่างคั่น: เลขลำดับของ cue ถัดไปไม่ถูกนับเป็นข้อความ', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,000\nA\n2\n00:00:03,000 --> 00:00:04,000\nB\n';
    expect(S.parseSubs(srt)).toEqual([
      { start: 1, end: 2, text: 'A' },
      { start: 3, end: 4, text: 'B' },
    ]);
  });

  test('ญี่ปุ่น/จีนต่อบรรทัดโดยไม่ใส่ช่องว่าง · ไทย/อังกฤษใส่ช่องว่าง', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,000\nこんにちは、\n元気ですか\n\n2\n00:00:03,000 --> 00:00:04,000\nสวัสดีครับ\nวันนี้เป็นอย่างไร\n';
    const c = S.parseSubs(srt);
    expect(c[0].text).toBe('こんにちは、元気ですか');
    expect(c[1].text).toBe('สวัสดีครับ วันนี้เป็นอย่างไร');
  });

  test('ข้อความที่ไม่ใช่ซับ/ค่าว่าง = []', () => {
    expect(S.parseSubs('')).toEqual([]);
    expect(S.parseSubs(null)).toEqual([]);
    expect(S.parseSubs('แค่ข้อความธรรมดา\nไม่มีเวลา')).toEqual([]);
  });
});

test.describe('LangCalc.subs.pairSubs', () => {
  const a = [
    { start: 1, end: 3, text: 'Hello' },
    { start: 4, end: 6, text: 'How are you' },
    { start: 7, end: 9, text: 'Fine' },
  ];

  test('จับคู่ตามเวลาซ้อนทับมากสุด', () => {
    const b = [
      { start: 1.2, end: 2.8, text: 'สวัสดี' },
      { start: 4.1, end: 5.9, text: 'สบายดีไหม' },
      { start: 7.2, end: 9.1, text: 'สบายดี' },
    ];
    expect(S.pairSubs(a, b).map((c) => c.thai)).toEqual(['สวัสดี', 'สบายดีไหม', 'สบายดี']);
  });

  test('ซับไทยหนึ่งอันคร่อมสองประโยค → ไปอยู่ประโยคที่ซ้อนทับมากกว่า · สองอันในประโยคเดียว = ต่อกัน', () => {
    const b = [
      { start: 2.5, end: 4.5, text: 'ยาวคร่อม' },       // ซ้อน a0 0.5 วิ, a1 0.5 วิ → เสมอ → ตัวแรก
      { start: 4.6, end: 5.0, text: 'ก' },
      { start: 5.1, end: 5.9, text: 'ข' },
    ];
    const r = S.pairSubs(a, b);
    expect(r[0].thai).toBe('ยาวคร่อม');
    expect(r[1].thai).toBe('ก ข');
    expect(r[2].thai).toBe('');
  });

  test('ไม่ซ้อนกันเลยแต่ห่าง ≤ 1 วิ → จับกับ cue ที่ใกล้สุด · ไกลกว่านั้นทิ้ง', () => {
    const r = S.pairSubs(a, [{ start: 3.3, end: 3.6, text: 'ใกล้' }, { start: 20, end: 21, text: 'ไกล' }]);
    expect(r[0].thai).toBe('ใกล้');
    expect(r.map((c) => c.thai).join('')).toBe('ใกล้');
  });

  test('คืนฟิลด์เดิมของซับหลัก (start/end/text) ไม่แก้อาร์เรย์ต้นฉบับ · ไม่มีซับที่สอง = thai ว่าง', () => {
    const r = S.pairSubs(a, []);
    expect(r).toEqual(a.map((c) => Object.assign({}, c, { thai: '' })));
    expect(a[0].thai).toBeUndefined();
  });
});

test.describe('LangCalc.subs.similarity / band / cueAt / fmt', () => {
  test('similarity: เหมือนกัน = 1 แม้ต่างตัวพิมพ์/วรรคตอน/ช่องว่าง', () => {
    expect(S.similarity('Hello, World!', 'hello world')).toBe(1);
    expect(S.similarity('你好，世界。', '你好世界')).toBe(1);
  });

  test('similarity: known-answer ระยะ Levenshtein ระดับตัวอักษร', () => {
    expect(S.similarity('kitten', 'sitting')).toBeCloseTo(1 - 3 / 7, 10);
    expect(S.similarity('abcd', 'abxd')).toBeCloseTo(0.75, 10);
    expect(S.similarity('abc', 'xyz')).toBe(0);
  });

  test('similarity: ว่างฝั่งใดฝั่งหนึ่ง = 0 (ไม่ใช่ 1) · เทียบกับตัวเอง = 1', () => {
    expect(S.similarity('', 'abc')).toBe(0);
    expect(S.similarity('abc', '')).toBe(0);
    expect(S.similarity('', '')).toBe(0);
    expect(S.similarity('こんにちは', 'こんにちは')).toBe(1);
  });

  test('band: เกณฑ์เดียวกับ gradeAnswer ของหน้า (≥ .9 ถูก, ≥ .7 ใกล้เคียง)', () => {
    expect(S.band(1)).toBe('correct');
    expect(S.band(0.9)).toBe('correct');
    expect(S.band(0.89)).toBe('almost');
    expect(S.band(0.7)).toBe('almost');
    expect(S.band(0.69)).toBe('wrong');
    expect(S.band(0)).toBe('wrong');
  });

  test('cueAt: อยู่ในช่วง [start, end) · ช่องว่างระหว่าง cue = -1', () => {
    const c = [{ start: 1, end: 3 }, { start: 4, end: 6 }];
    expect(S.cueAt(c, 0.5)).toBe(-1);
    expect(S.cueAt(c, 1)).toBe(0);
    expect(S.cueAt(c, 2.99)).toBe(0);
    expect(S.cueAt(c, 3)).toBe(-1);
    expect(S.cueAt(c, 4.5)).toBe(1);
    expect(S.cueAt(c, 99)).toBe(-1);
  });

  test('fmt: m:ss และ h:mm:ss', () => {
    expect(S.fmt(0)).toBe('0:00');
    expect(S.fmt(65.9)).toBe('1:05');
    expect(S.fmt(3600)).toBe('1:00:00');
    expect(S.fmt(-3)).toBe('0:00');
  });

  test('segmentsToCues: ตัดข้อความ ทิ้งว่าง แก้ end ≤ start และไม่ให้ซ้อนกัน', () => {
    const r = S.segmentsToCues([
      { start: 0, end: 2.5, text: '  Hello  ' },
      { start: 2, end: 4, text: 'there' },     // ซ้อน → จบก่อน cue ถัดไปเริ่ม = ตัดอันก่อนที่ 2
      { start: 5, end: 5, text: 'zero' },      // end = start → ยืดให้ ≥ 0.5 วิ
      { start: 6, end: 7, text: '   ' },
    ]);
    expect(r).toEqual([
      { start: 0, end: 2, text: 'Hello' },
      { start: 2, end: 4, text: 'there' },
      { start: 5, end: 5.5, text: 'zero' },
    ]);
  });
});
