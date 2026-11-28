// @ts-check
// ห้องเรียนกฎหมายแบบใหม่ — ตรรกะล้วนของ law-calc.js (ROADMAP แถว 9b, docs/law-classroom-design.md 5.2/5.3/5.5)
// ข้อความฎีกาในเทสต์นี้แต่งขึ้นเอง ไม่ใช่คำพิพากษาจริง
const { test, expect } = require('@playwright/test');
const path = require('path');

const L = require(path.join(__dirname, '..', 'law-calc.js'));
const FS = require(path.join(__dirname, '..', 'fsrs.js'));

const NOW = Date.UTC(2026, 10, 28, 3, 0);

test.describe('law-calc.js — รหัสประมวล + เลขมาตรา', () => {
  test('normalizeCode: ชื่อย่อ/ชื่อเต็ม/ไม่มีจุด/รหัสเอง → รหัสเดียว', () => {
    const cases = {
      'ป.พ.พ.': 'ppk', 'ปพพ': 'ppk', 'ประมวลกฎหมายแพ่งและพาณิชย์': 'ppk', 'ppk': 'ppk', ' PPK ': 'ppk',
      'ป.อ.': 'pa', 'ปอ': 'pa', 'ประมวลกฎหมายอาญา': 'pa',
      'ป.วิ.พ.': 'pvp', 'ป.วิ.แพ่ง': 'pvp', 'ประมวลกฎหมายวิธีพิจารณาความแพ่ง': 'pvp',
      'ป.วิ.อ.': 'pva', 'ปวิอ': 'pva', 'ป.วิ.อาญา': 'pva', 'ประมวลกฎหมายวิธีพิจารณาความอาญา': 'pva',
      'พ.ร.บ.ทนายความ': 'lawyer', 'พระราชบัญญัติทนายความ พ.ศ. 2528': 'lawyer',
      'ข้อบังคับสภาทนายความว่าด้วยมรรยาททนายความ': 'ethics', 'มรรยาททนายความ': 'ethics',
      'พระธรรมนูญศาลยุติธรรม': 'court',
    };
    for (const [k, v] of Object.entries(cases)) expect(L.normalizeCode(k), k).toBe(v);
    for (const bad of ['', 'ประมวลอะไร', 'ป.', null, undefined, 42, '__proto__']) expect(L.normalizeCode(/** @type any */ (bad))).toBe('');
    // ตารางเดียว: ทุกรหัสมีชื่อ + วิชา
    expect(L.CODES.map((c) => c.code)).toEqual(['ppk', 'pa', 'pvp', 'pva', 'lawyer', 'ethics', 'court']);
    for (const c of L.CODES) { expect(c.name).toBeTruthy(); expect(c.subject).toBeTruthy(); }
  });

  test('parseSectionRef: รูปแบบที่ผู้ใช้พิมพ์ค้น', () => {
    expect(L.parseSectionRef('ป.พ.พ. มาตรา 150')).toEqual({ code: 'ppk', n: '150' });
    expect(L.parseSectionRef('ปพพ 150')).toEqual({ code: 'ppk', n: '150' });
    expect(L.parseSectionRef('ป.อ. ม.59')).toEqual({ code: 'pa', n: '59' });
    expect(L.parseSectionRef('ม.150')).toEqual({ code: '', n: '150' });
    expect(L.parseSectionRef('ม.150', 'pvp')).toEqual({ code: 'pvp', n: '150' });
    expect(L.parseSectionRef('มาตรา 150/1')).toEqual({ code: '', n: '150/1' });
    expect(L.parseSectionRef('มาตรา 7 ทวิ', 'pa')).toEqual({ code: 'pa', n: '7ทวิ' });
    expect(L.parseSectionRef('ป.วิ.อ. มาตรา ๑๓๔/๔')).toEqual({ code: 'pva', n: '134/4' });
    expect(L.parseSectionRef('มาตรา ๑๕๐ แห่งประมวลกฎหมายแพ่งและพาณิชย์')).toEqual({ code: 'ppk', n: '150' });
    expect(L.parseSectionRef('ม.150 ปพพ')).toEqual({ code: 'ppk', n: '150' });
    expect(L.parseSectionRef('150', 'ppk')).toEqual({ code: 'ppk', n: '150' });
    expect(L.parseSectionRef('ข้อบังคับมรรยาททนายความ ข้อ 5')).toEqual({ code: 'ethics', n: '5' });
    for (const bad of ['', 'มาตรา', 'ปพพ', 'ข้อ 5', 'ฉบับที่สอง', null]) expect(L.parseSectionRef(/** @type any */ (bad))).toBeNull();
    expect(L.refKey({ code: 'ppk', n: '150/1' })).toBe('ppk:150/1');
    expect(L.refKey({ code: '', n: '150' })).toBe('');
  });

  test('extractSections: หลายประมวล/หลายมาตรา/วรรค/อนุมาตรา/ไม่สับสนกับคำไทย', () => {
    const t = 'ตาม ป.พ.พ. มาตรา 150, 151 และ 154 วรรคหนึ่ง กับ ป.วิ.พ. มาตรา 142 (5) และมาตรา 55 ' +
      'ส่วนมาตรา 59 แห่ง ป.อ. ก็เช่นกัน ผู้ป่วยเป็นโรคปอด มาตรา 7 ทวิ';
    expect(L.extractSections(t)).toEqual([
      { code: 'ppk', n: '150' }, { code: 'ppk', n: '151' }, { code: 'ppk', n: '154' },
      { code: 'pvp', n: '142' }, { code: 'pvp', n: '55' },
      { code: 'pa', n: '59' }, { code: 'pa', n: '7ทวิ' },
    ]);
    // "ข้อ" นับเป็นเลขข้อเฉพาะหลังข้อบังคับมรรยาท
    expect(L.extractSections('ข้อ 3 ของสัญญา')).toEqual([]);
    expect(L.extractSections('มาตรา 18 ทวิวรรคสอง')).toEqual([{ code: '', n: '18' }]);
  });
});

test.describe('law-calc.js — ฎีกา', () => {
  const FULL = 'คำพิพากษาศาลฎีกาที่ ๑๒๓๔/๒๕๖๐\n' +
    'โจทก์ฟ้องว่าจำเลยทำสัญญาซื้อขายที่ดินโดยไม่ทำเป็นหนังสือ สัญญาจึงตกเป็นโมฆะตาม ป.พ.พ. มาตรา 456 วรรคหนึ่ง ' +
    'ประกอบมาตรา 150 แม้ ป.วิ.พ. มาตรา 94 จะห้ามนำพยานบุคคลมาสืบ ศาลเห็นว่า... (ข้อความสมมุติ ฎีกาที่ 99/2500 อ้างอิง)';

  test('parseDeka: เลข/ปี (ไทย/อารบิก/ย่อ) + มาตรา + วิชา + ข้อความเต็มเดิมไม่ถูกตัด', () => {
    const d = L.parseDeka(FULL);
    expect(d).toEqual({
      no: '1234', year: '2560', court: 'ฎีกา', id: 'dk-1234-2560',
      sections: ['ppk:456', 'ppk:150', 'pvp:94'], bare: [], subject: 'civil', text: FULL,
    });
    expect(L.parseDeka('ฎีกาที่ 1234/2560 ...').no).toBe('1234');
    expect(L.parseDeka('ฎ.1234/2560 วินิจฉัยว่า').year).toBe('2560');
    expect(L.parseDeka('ฎ. 77 / 2565').id).toBe('dk-77-2565');
    expect(L.parseDeka('คำวินิจฉัยศาลรัฐธรรมนูญที่ 3/2562').id).toBe('dk-rtn-3-2562');
    expect(L.parseDeka('ป.อ. มาตรา 59 และมาตรา 60 กับ ป.วิ.อ. มาตรา 134').subject).toBe('criminal');
    // ไม่มีเลขฎีกา → id จากแฮชข้อความ (วางข้อความเดียวกันสองเครื่อง = แถวเดียว)
    const a = L.parseDeka('จำเลยกระทำโดยประมาท มาตรา 59');
    expect(a.no).toBe('');
    expect(a.id).toMatch(/^dk-h[0-9a-z]+$/);
    expect(L.parseDeka('จำเลยกระทำโดยประมาท  มาตรา 59\r\n').id).toBe(a.id);
    expect(a.bare).toEqual(['59']);
    expect(a.subject).toBe('');
    // ข้อความยาวมาก — คืนครบทุกตัวอักษร
    const long = FULL + 'ก'.repeat(150000);
    expect(L.parseDeka(long).text).toBe(long);
    expect(L.parseDeka('').id).toBe('');
  });

  test('cleanDeka: ข้อมูลที่ซิงก์มา — ชนิดผิด/id นอกรูปแบบ/มาตราแปลกทิ้ง · ข้อความเต็มเก็บครบถึงเพดาน', () => {
    const ok = {
      v: 1, id: 'dk-1234-2560', no: '1234', year: '2560', court: 'ฎีกา', issue: 'ประเด็น', rule: 'หลัก',
      sections: ['ppk:150', 'xx:1', 'ppk:__proto__', 42, 'pa:7ทวิ'], subject: 'civil', text: FULL,
      url: 'https://example.com/x', tags: ['สัญญา', 7, ''], createdAt: NOW, updatedAt: NOW, evil: 1,
    };
    const c = L.cleanDeka(ok);
    expect(c).toEqual({
      v: 1, id: 'dk-1234-2560', no: '1234', year: '2560', court: 'ฎีกา', issue: 'ประเด็น', rule: 'หลัก',
      sections: ['ppk:150', 'pa:7ทวิ'], subject: 'civil', text: FULL, url: 'https://example.com/x',
      tags: ['สัญญา'], createdAt: NOW, updatedAt: NOW,
    });
    expect(L.cleanDeka({ ...ok, url: 'javascript:alert(1)' }).url).toBe('');
    expect(L.cleanDeka({ ...ok, subject: 'mars' }).subject).toBe('');
    expect(L.cleanDeka({ ...ok, court: 'x' }).court).toBe('ฎีกา');
    const big = 'ข'.repeat(L.MAX_DEKA_TEXT + 500);
    expect(L.cleanDeka({ ...ok, text: big }).text).toHaveLength(L.MAX_DEKA_TEXT);
    expect(L.cleanDeka({ ...ok, text: 'ค'.repeat(180000) }).text).toHaveLength(180000);
    for (const bad of [null, 'x', [], { ...ok, id: 'card-1' }, { ...ok, id: '__proto__' }, { ...ok, text: '' }, { ...ok, text: 5 }]) {
      expect(L.cleanDeka(/** @type any */ (bad))).toBeNull();
    }
    expect(L.cleanDeka({ ...ok, id: 'dk-h1a2b3' })).not.toBeNull();
  });
});

test.describe('law-calc.js — เติมคำ + การ์ด', () => {
  const S = 'การใดมิได้ทำให้ถูกต้องตามแบบที่กฎหมายบังคับไว้ การนั้นเป็นโมฆะ ผู้ซื้ออาจบอกล้างได้ภายในหนึ่งปี และต้องชำระ 5,000 บาท ภายใน 10 วัน';

  test('clozeCandidates: ระยะเวลา > ตัวเลข > โมฆะ/โมฆียะ > ต้อง/อาจ · ไม่ตัดกลางคำ', () => {
    const c = L.clozeCandidates(S);
    expect(c.map((x) => [x.t, x.kind])).toEqual([
      ['หนึ่งปี', 'time'], ['10 วัน', 'time'], ['5,000 บาท', 'num'], ['โมฆะ', 'void'], ['อาจ', 'modal'], ['ต้อง', 'modal'],
    ]);
    for (const x of c) expect(S.slice(x.i, x.i + x.t.length)).toBe(x.t);
    expect(L.clozeCandidates('อาจารย์สอนเรื่องอำนาจ').map((x) => x.t)).toEqual([]);
    expect(L.clozeCandidates('อาจารย์สอนเรื่องอำนาจ', { noSegmenter: true }).map((x) => x.t)).toEqual([]);
    expect(L.clozeCandidates('นิติกรรมเป็นโมฆียะ')).toEqual([{ t: 'โมฆียะ', i: 12, kind: 'void' }]);
    expect(L.clozeCandidates('ภายใน ๒ ปี').map((x) => x.t)).toEqual(['๒ ปี']);
    expect(L.clozeCandidates('')).toEqual([]);
  });

  test('clozeCard: ซ่อน 1–3 คำ เรียงตามตำแหน่ง · คำที่ผู้ใช้เลือกมาก่อน · ไม่มีคำให้ซ่อน = null', () => {
    const c = L.clozeCard(S);
    expect(c.cloze).toEqual(['หนึ่งปี', '5,000 บาท', '10 วัน']);
    expect(c.masked).toBe('การใดมิได้ทำให้ถูกต้องตามแบบที่กฎหมายบังคับไว้ การนั้นเป็นโมฆะ ผู้ซื้ออาจบอกล้างได้ภายใน[___] และต้องชำระ [___] ภายใน [___]');
    expect(c.parts.filter((p) => p.gap != null).map((p) => p.t)).toEqual(['หนึ่งปี', '5,000 บาท', '10 วัน']);
    expect(c.parts.map((p) => p.t).join('')).toBe(S);
    expect(L.clozeCard(S, { max: 1 }).cloze).toEqual(['หนึ่งปี']);
    expect(L.clozeCard(S, { words: ['ถูกต้องตามแบบ', 'ไม่มีในข้อความ'] }).cloze).toEqual(['ถูกต้องตามแบบ', 'หนึ่งปี', '10 วัน']);
    expect(L.clozeCard('ข้อความธรรมดาไม่มีอะไรซ่อน')).toBeNull();
  });

  test('cardId ตายตัว + makeCard สร้างซ้ำไม่ล้าง FSRS + cleanCard', () => {
    expect(L.cardId({ code: 'ppk', n: '150', type: 'a' })).toBe('st-ppk-150-a');
    expect(L.cardId({ code: 'pa', n: '7ทวิ', type: 'c' })).toBe('st-pa-7ทวิ-c');
    expect(L.cardId({ code: 'ppk', n: '150/1', type: 'b' })).toBe('st-ppk-150/1-b');
    expect(L.cardId({ no: '1234', year: '2560' })).toBe('dk-1234-2560');
    expect(L.cardId({ code: 'xx', n: '1', type: 'a' })).toBe('');
    expect(L.cardId({ code: 'ppk', n: '150', type: 'd' })).toBe('');
    expect(L.cardId({ no: '12', year: '60' })).toBe('');

    const b = L.makeCard({ code: 'ppk', n: '150', type: 'b', cloze: ['โมฆะ'] }, NOW);
    expect(b).toEqual({ id: 'st-ppk-150-b', kind: 'st', ref: 'ppk:150', cloze: ['โมฆะ'], createdAt: NOW, dueAt: NOW });
    const reviewed = { ...b, ...FS.schedule(b, 3, NOW + 1000) }; // แบบที่ review.js เขียนกลับ
    const again = L.makeCard({ code: 'ppk', n: '150', type: 'b', cloze: ['โมฆะ', 'ต้อง'] }, NOW + 5000, reviewed);
    expect(again.cloze).toEqual(['โมฆะ', 'ต้อง']);
    for (const k of ['stability', 'difficulty', 'reps', 'lapses', 'lastReview', 'dueAt', 'createdAt']) expect(again[k]).toEqual(reviewed[k]);

    const dk = L.makeCard({ no: '1234', year: '2560', front: 'สัญญาซื้อขายที่ดินไม่ทำเป็นหนังสือ?' }, NOW);
    expect(dk).toEqual({ id: 'dk-1234-2560', kind: 'dk', ref: 'dk-1234-2560', front: 'สัญญาซื้อขายที่ดินไม่ทำเป็นหนังสือ?', createdAt: NOW, dueAt: NOW });
    expect(L.makeCard({ code: 'zz', n: '1', type: 'a' }, NOW)).toBeNull();

    expect(L.cleanCard({ ...reviewed, evil: 1, front: 5 })).toEqual(
      Object.fromEntries(Object.entries(reviewed).filter(([k]) => k !== 'evil' && k !== 'front')));
    for (const bad of [null, [], { ...b, id: 'st-ppk-150-z' }, { ...b, id: '__proto__' }, { ...b, kind: 'dk' }, { ...b, ref: 'pa:59' }, { ...b, dueAt: 'x' }]) {
      expect(L.cleanCard(/** @type any */ (bad))).toBeNull();
    }
    expect(L.cleanCard({ ...b, cloze: ['a', 7, 'b', 'c', 'd'] }).cloze).toEqual(['a', 'b', 'c']);
    expect(L.cleanCard({ ...b, reps: -1 }).reps).toBeUndefined();
  });

  test('cleanStars / cleanTrack', () => {
    const raw = JSON.parse('{"ppk:150":{"at":1},"__proto__":{"at":2},"pa:7ทวิ":{"at":3},"xx:1":{"at":4},"ppk:151":{"at":"x"},"pvp:55":5}');
    const s = L.cleanStars(raw);
    expect(s).toEqual({ 'ppk:150': { at: 1 }, 'pa:7ทวิ': { at: 3 } });
    expect(Object.getPrototypeOf(s)).toBe(Object.prototype);
    expect(L.cleanStars(null)).toEqual({});
    expect(L.cleanStars([1])).toEqual({});
    expect(L.cleanTrack({ v: 1, exam: 'lawyer', newPerDay: 15 })).toEqual({ v: 1, exam: 'lawyer', newPerDay: 15 });
    expect(L.cleanTrack({ exam: 'x', newPerDay: 999 })).toEqual({ v: 1, exam: '', newPerDay: 50 });
    expect(L.cleanTrack(null)).toEqual({ v: 1, exam: '', newPerDay: 10 });
  });
});
