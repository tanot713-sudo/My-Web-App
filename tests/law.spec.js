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

// ── ชุดตัวบท law-packs (ROADMAP แถว 9c) ─────────────────────────────────────────────────────────────
// ไฟล์จริงใน law-packs/ สร้างด้วย tools/law-data/build.mjs จาก PDF + เทียบตัวอักษรทุกมาตรากับฉบับกฤษฎีกา (thailaw-v1.0)
// ตัวเลขด้านล่าง = ค่าที่ต้องได้หลังสร้างใหม่ทุกครั้ง (กฎ 5.0 ห้ามย่อ: จำนวนตัวอักษรลดลง = ข้อความหาย → เทสต์ล้ม)
const fs = require('fs');
const zlib = require('zlib');
const LD = require(path.join(__dirname, '..', 'tools', 'law-data', 'lib.js'));
const PACK_DIR = path.join(__dirname, '..', 'law-packs');
function loadPack(code) {
  const idx = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'index.json'), 'utf8'));
  const rel = L.packFile(idx, code);
  expect(rel, code).toBeTruthy();
  const bytes = fs.readFileSync(path.join(__dirname, '..', rel));
  expect(L.isGzip(bytes)).toBe(true);
  const raw = JSON.parse(zlib.gunzipSync(bytes).toString('utf8'));
  return { idx, raw, pack: L.preparePack(raw, code) };
}
const range = (n) => Array.from({ length: n }, (_, i) => String(i + 1));

test.describe('law-packs — ชุดตัวบทจริง', () => {
  test('index.json: รหัสจาก LawCalc.CODES เท่านั้น · ไฟล์มีจริง · ≤ 25 MiB · ไม่มีไฟล์ค้าง', () => {
    const idx = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'index.json'), 'utf8'));
    expect(idx.v).toBe(1);
    const codes = L.CODES.map((c) => c.code);
    const files = [];
    for (const [code, p] of Object.entries(idx.packs)) {
      expect(codes).toContain(code);
      const rel = L.packFile(idx, code);
      expect(rel).toBe('law-packs/' + p.file);
      const st = fs.statSync(path.join(__dirname, '..', rel));
      expect(st.size).toBe(p.bytes);
      expect(st.size).toBeLessThanOrEqual(25 * 1024 * 1024);
      expect(p.name).toBe(L.CODES.find((c) => c.code === code).name);
      files.push(p.file);
    }
    expect(fs.readdirSync(PACK_DIR).filter((f) => f !== 'index.json').sort()).toEqual(files.sort());
  });

  test('พ.ร.บ.ทนายความ 2528: 89 มาตราเรียง 1–89 · ข้อความเต็ม · หัวหมวด · อัตราค่าธรรมเนียมท้าย พ.ร.บ.', () => {
    const { raw, pack, idx } = loadPack('lawyer');
    expect(raw.s.length).toBe(89); // preparePack ไม่ทิ้งมาตราไหน
    expect(pack.s.map((s) => s.n)).toEqual(range(89));
    expect(idx.packs.lawyer.sections).toBe(89);
    expect(pack.s.reduce((a, s) => a + s.t.length, 0)).toBe(30618);
    expect(pack.asOf).toBe('1985-09-19');
    expect(L.findSection(pack, '1').t).toBe('พระราชบัญญัตินี้เรียกว่า “พระราชบัญญัติทนายความ พ.ศ. ๒๕๒๘”');
    expect(L.findSection(pack, '2').f).toEqual(['ราชกิจจานุเบกษา เล่ม ๑๐๒/ตอนที่ ๑๒๙/ฉบับพิเศษ หน้า ๑/๑๙ กันยายน ๒๕๒๘']);
    const s52 = L.findSection(pack, 'มาตรา ๕๒');
    expect(s52.b).toBe('หมวด ๖ มรรยาททนายความ');
    expect(s52.t).toBe('โทษผิดมรรยาททนายความมี ๓ สถาน คือ\n(๑) ภาคทัณฑ์\n(๒) ห้ามทำการเป็นทนายความมีกำหนดไม่เกินสามปี หรือ\n(๓) ลบชื่อออกจากทะเบียนทนายความ\n'
      + 'ในกรณีประพฤติผิดมรรยาททนายความเล็กน้อยและเป็นความผิดครั้งแรก ถ้าผู้มีอำนาจสั่งลงโทษตามมาตรา ๖๖ มาตรา ๖๗ หรือมาตรา ๖๘ แล้วแต่กรณี '
      + 'เห็นว่ามีเหตุอันควรงดโทษ จะงดโทษให้โดยว่ากล่าวตักเตือน หรือให้ทำทัณฑ์บนเป็นหนังสือไว้ก่อนก็ได้');
    expect(L.findSection(pack, '89').b).toBe('บทเฉพาะกาล');
    expect([...new Set(pack.s.map((s) => s.b))]).toEqual(['', 'หมวด ๑ สภาทนายความ', 'หมวด ๒ สมาชิกสภาทนายความ',
      'หมวด ๓ คณะกรรมการสภาทนายความ', 'หมวด ๔ การขอจดทะเบียนและรับใบอนุญาตให้เป็นทนายความ', 'หมวด ๕ การประชุมใหญ่ของสภาทนายความ',
      'หมวด ๖ มรรยาททนายความ', 'หมวด ๗ คณะกรรมการมรรยาททนายความ', 'หมวด ๘ กองทุนสวัสดิการทนายความ',
      'หมวด ๙ การช่วยเหลือประชาชนทางกฎหมาย', 'หมวด ๑๐ บทกำหนดโทษ', 'บทเฉพาะกาล']);
    expect(pack.x).toEqual([{ h: 'อัตราค่าธรรมเนียม', t: '(๑) การจดทะเบียนเป็นทนายความ ๘๐๐ บาท\n(๒) การรับใบอนุญาตให้เป็นทนายความตลอดชีพ\nฉบับละ ๔,๐๐๐ บาท\n'
      + '(๓) การรับใบอนุญาตให้เป็นทนายความสองปี\nฉบับละ ๘๐๐ บาท\n(๔) การต่อใบอนุญาตให้เป็นทนายความ\nฉบับละ ๘๐๐ บาท\n(๕) การออกใบแทนใบอนุญาตให้เป็นทนายความ\nฉบับละ ๑๐๐ บาท' }]);
    expect(LD.checkPack(raw)).toEqual([]);
  });

  test('ข้อบังคับมรรยาททนายความ 2529: 21 ข้อเรียง 1–21 · แก้ตามฉบับกฤษฎีกา · รอยตัดบรรทัดมีช่องว่างตามต้นฉบับ', () => {
    const { raw, pack } = loadPack('ethics');
    expect(pack.s.map((s) => s.n)).toEqual(range(21));
    expect(pack.s.reduce((a, s) => a + s.t.length, 0)).toBe(4778);
    expect(pack.asOf).toBe('1986-02-18');
    // ฉบับกฤษฎีกาเองไม่มีช่องว่างก่อน "พ.ศ." ในข้อนี้ — คงตามต้นฉบับ
    expect(L.findSection(pack, 'ข้อ ๑').t).toBe('ข้อบังคับนี้เรียกว่า “ข้อบังคับสภาทนายความว่าด้วยมรรยาททนายความพ.ศ. ๒๕๒๙”');
    expect(L.findSection(pack, '21').t).toBe('ทนายความจะต้องปฏิบัติตนอย่างเคร่งครัดเพื่อให้เป็นไปตามคำสั่งของสภานายกพิเศษแห่งสภาทนายความ คณะกรรมการสภาทนายความ '
      + 'และคณะกรรมการมรรยาททนายความ ตลอดจนบรรดาข้อบังคับหรือข้อกำหนดที่บุคคลหรือคณะบุคคลดังกล่าวได้สั่งหรือมีไว้ แล้วแต่กรณี ตามอำนาจหน้าที่ซึ่งมีอยู่ตามบทบัญญัติแห่งกฎหมาย');
    const s20 = L.findSection(pack, '20');
    expect(s20.t).toContain('สีอื่นที่ไม่ฉูดฉาด เชิ้ตขาวผ้าผูกคอสีดำ'); // บรรทัดใน PDF ตัดตรงช่องว่าง
    expect(s20.t).toContain('แบบเงื่อนกลาสี');
    expect(s20.b).toBe('หมวด ๕ มรรยาทในการแต่งกาย');
    expect(L.findSection(pack, '10').t).toContain('ถ้าไม่ให้ตนว่าคดีนั้นแล้วจะหาหนทาง');
    expect(LD.checkPack(raw)).toEqual([]);
  });

  test('ทุกชุด: ไม่มีลายน้ำ/อักขระควบคุม/ฟอนต์เพี้ยน · ำ ไม่แตกเป็น ํ+า', () => {
    for (const code of ['lawyer', 'ethics']) {
      const { pack } = loadPack(code);
      const all = pack.s.map((s) => s.b + '\n' + s.t + '\n' + (s.f || []).join('\n')).join('\n') + (pack.x || []).map((e) => e.h + e.t).join('');
      expect(all).not.toContain('สำนักงานคณะกรรมการกฤษฎีกา');
      expect(all).not.toMatch(/[\u0000-\u0008\u000b-\u001f�]/); // eslint-disable-line no-control-regex
      expect(all).not.toMatch(/ํ\s*า/);
      expect(LD.garbleReport(all)).toEqual([]);
    }
  });
});

test.describe('law-calc.js — อ่านชุดตัวบท', () => {
  const RAW = {
    v: 1, code: 'ppk', name: 'ชื่อในไฟล์ไม่ถูกใช้', src: 'ทดสอบ', asOf: '2025-01-02',
    s: [
      { n: '150', b: 'บรรพ ๑ หลักทั่วไป', t: 'การใดมีวัตถุประสงค์เป็นการต้องห้ามชัดแจ้งโดยกฎหมาย การนั้นเป็นโมฆะ' },
      { n: '150/1', b: 'บรรพ ๑ หลักทั่วไป', t: 'ข้อความทดสอบมาตรา ๑๕๐/๑ ภายใน   ๓๐ วัน' },
      { n: '7ทวิ', b: '', t: 'ข้อความทดสอบเจ็ดทวิ', f: ['เชิงอรรถ', 42, ''] },
      { n: '150', b: '', t: 'มาตราซ้ำ — ทิ้ง' },
      { n: '__proto__', t: 'ทิ้ง' },
      { n: '151 ', t: 'เลขมีช่องว่าง — ทิ้ง' },
      { n: '152', t: '' },
      { n: '153', t: 'ก'.repeat(L.MAX_SECTION_TEXT + 1) },
      { n: 154, t: 'เลขไม่ใช่สตริง' },
      null,
    ],
    x: [{ h: 'บัญชีท้าย', t: 'รายการ' }, { h: '', t: 'ทิ้ง' }],
  };

  test('packFile: เฉพาะ <code>-<hex>.json(.gz) ของรหัสนั้น', () => {
    const idx = (file) => ({ v: 1, packs: { ppk: { file } } });
    expect(L.packFile(idx('ppk-0a1b2c3d.json.gz'), 'ppk')).toBe('law-packs/ppk-0a1b2c3d.json.gz');
    expect(L.packFile(idx('ppk-0a1b2c3d.json'), 'ppk')).toBe('law-packs/ppk-0a1b2c3d.json');
    for (const bad of ['../ppk-0a1b2c3d.json.gz', 'pa-0a1b2c3d.json.gz', 'ppk-XYZ12345.json.gz', 'ppk-0a1b2c3d.json.gz?x', 'https://x/ppk-0a1b2c3d.json.gz', 'ppk-0a1.json']) {
      expect(L.packFile(idx(bad), 'ppk'), bad).toBeNull();
    }
    expect(L.packFile(idx('ppk-0a1b2c3d.json.gz'), 'pa')).toBeNull();
    expect(L.packFile(idx('ppk-0a1b2c3d.json.gz'), '__proto__')).toBeNull();
    expect(L.packFile(JSON.parse('{"packs":{"__proto__":{"file":"ppk-0a1b2c3d.json.gz"}}}'), 'ppk')).toBeNull();
    expect(L.packFile(null, 'ppk')).toBeNull();
    expect(L.isGzip(new Uint8Array([0x1f, 0x8b, 8]))).toBe(true);
    expect(L.isGzip(new Uint8Array([0x7b, 0x22, 0x76]))).toBe(false);
    expect(L.isGzip(null)).toBe(false);
  });

  test('preparePack: ตรวจทุกช่อง · ทิ้งรายการผิด ไม่ตัดข้อความ · ชื่อจาก CODES', () => {
    const p = L.preparePack(JSON.parse(JSON.stringify(RAW)), 'ppk');
    expect(p.name).toBe('ประมวลกฎหมายแพ่งและพาณิชย์');
    expect(p.s.map((s) => s.n)).toEqual(['150', '150/1', '7ทวิ']);
    expect(p.s[0].t).toBe(RAW.s[0].t);
    expect(p.s[2].f).toEqual(['เชิงอรรถ']);
    expect(p.x).toEqual([{ h: 'บัญชีท้าย', t: 'รายการ' }]);
    expect(p.asOf).toBe('2025-01-02');
    expect(Object.getPrototypeOf(p.byN)).toBeNull();
    // ข้อความยาวเท่าเพดานพอดีเก็บครบ ไม่ตัด
    const big = L.preparePack({ v: 1, code: 'pa', s: [{ n: '1', t: 'ข'.repeat(L.MAX_SECTION_TEXT) }] }, 'pa');
    expect(big.s[0].t.length).toBe(L.MAX_SECTION_TEXT);
    expect(L.preparePack({ ...RAW, v: 2 }, 'ppk')).toBeNull();
    expect(L.preparePack(RAW, 'pa')).toBeNull();
    expect(L.preparePack({ ...RAW, code: 'xx' })).toBeNull();
    expect(L.preparePack({ v: 1, code: 'ppk', s: [{ n: 'x', t: 'y' }] }, 'ppk')).toBeNull();
    expect(L.preparePack({ ...RAW, asOf: '2568-01-01x' }, 'ppk').asOf).toBe('');
    expect(L.preparePack(null)).toBeNull();
    expect(L.preparePack([1])).toBeNull();
  });

  test('findSection: เลขไทย/อารบิก · /1 · ทวิ · มาตรา/ข้อ นำหน้า', () => {
    const p = L.preparePack(RAW, 'ppk');
    expect(L.findSection(p, '150/1').n).toBe('150/1');
    expect(L.findSection(p, '๑๕๐ / ๑').n).toBe('150/1');
    expect(L.findSection(p, 'มาตรา 150/1').n).toBe('150/1');
    expect(L.findSection(p, '7 ทวิ').n).toBe('7ทวิ');
    expect(L.findSection(p, 'ป.พ.พ. ม.150').n).toBe('150');
    expect(L.findSection(p, 'ป.อ. มาตรา 150')).toBeNull(); // คนละประมวล
    expect(L.findSection(p, '151')).toBeNull();
    expect(L.findSection(p, '')).toBeNull();
    expect(L.findSection(null, '150')).toBeNull();
  });

  test('searchPack: เลขมาตราขึ้นก่อน · ค้นคำ (เลขไทย = อารบิก, ช่องว่างกี่ตัวก็ได้) · หัวหมวด · limit', () => {
    const p = L.preparePack(RAW, 'ppk');
    expect(L.searchPack(p, '150/1')[0]).toMatchObject({ n: '150/1', exact: true });
    const r2 = L.searchPack(p, 'ภายใน 30 วัน', { ctx: 10 });
    expect(r2).toHaveLength(1);
    expect(r2[0]).toMatchObject({ n: '150/1', hit: 'ภายใน   ๓๐ วัน', pre: 'ตรา ๑๕๐/๑ ', post: '' });
    expect(r2[0].pre + r2[0].hit + r2[0].post).toBe(p.s[1].t.slice(r2[0].at - r2[0].pre.length));
    expect(L.searchPack(p, 'โมฆะ').map((r) => r.n)).toEqual(['150']);
    expect(L.searchPack(p, 'หลักทั่วไป').map((r) => r.n)).toEqual(['150', '150/1']); // ตรงหัวหมวด
    // ข้อความยาวที่มีคำว่ามาตราอยู่กลาง = ค้นคำ ไม่ใช่เปิดมาตรา
    expect(L.searchPack(p, 'ข้อความทดสอบมาตรา ๑๕๐/๑').map((r) => [r.n, !!r.exact])).toEqual([['150/1', false]]);
    expect(L.searchPack(p, 'ข้อความ', { limit: 1 })).toHaveLength(1);
    expect(L.searchPack(p, '(.*)')).toEqual([]); // ไม่ใช่ regex
    expect(L.searchPack(p, '   ')).toEqual([]);
    expect(L.searchPack(null, 'x')).toEqual([]);
  });
});

test.describe('tools/law-data/lib.js — ตัวสร้างชุด', () => {
  test('normalizeText: ํ+า / U+FFFD → ำ · คำพูด ` ′ → “ ”', () => {
    expect(LD.normalizeText('นํ้า')).toBe('น้ำ');
    expect(LD.normalizeText('ส� า')).toBe('สำ');
    expect(LD.normalizeText('`ทนายความ′')).toBe('“ทนายความ”');
  });

  test('resolveWraps: รอยตัดบรรทัดไทย → ช่องว่างตามฉบับอ้างอิง · ไม่มีอ้างอิง/หาไม่พบ = ต่อติด', () => {
    const W = LD.WRAP;
    const t = 'สีอื่นที่ไม่ฉูดฉาด' + W + 'เชิ้ตขาวผ้าผูก' + W + 'คอสีดำ';
    const ref = 'สีอื่นที่ไม่ฉูดฉาด\r\nเชิ้ตขาวผ้าผูกคอ[๑]สีดำ';
    expect(LD.resolveWraps(t, ref)).toBe('สีอื่นที่ไม่ฉูดฉาด เชิ้ตขาวผ้าผูกคอสีดำ');
    expect(LD.resolveWraps(t, null)).toBe('สีอื่นที่ไม่ฉูดฉาดเชิ้ตขาวผ้าผูกคอสีดำ');
    expect(LD.resolveWraps(t, 'ข้อความอื่นทั้งหมด')).toBe('สีอื่นที่ไม่ฉูดฉาดเชิ้ตขาวผ้าผูกคอสีดำ');
    expect(LD.resolveWraps('ไม่มีรอย', 'x')).toBe('ไม่มีรอย');
    expect(LD.joinWrap('ทนาย', 'ความ')).toBe('ทนาย' + W + 'ความ');
    expect(LD.joinWrap('(๑)', 'ภาค')).toBe('(๑) ภาค');
  });

  test('checkPack: ลำดับย้อน/ซ้ำ/ลายน้ำ/รอยตัดค้าง/เลขผิดรูปแบบ', () => {
    const ok = { v: 1, code: 'pa', asOf: '2020-01-01', s: [{ n: '1', b: '', t: 'ก' }, { n: '1/1', b: '', t: 'ข' }, { n: '2', b: '', t: 'ค' }, { n: '2ทวิ', b: '', t: 'ง' }, { n: '3', b: '', t: 'จ' }] };
    expect(LD.checkPack(ok)).toEqual([]);
    const bad = { v: 1, code: 'pa', asOf: '', s: [{ n: '2', b: '', t: 'ก' }, { n: '1', b: '', t: 'ข' + LD.WATERMARK }, { n: '1', b: '', t: 'ค' + LD.WRAP + 'ง' }, { n: 'x', b: '', t: '' }] };
    const msgs = LD.checkPack(bad).join('\n');
    for (const k of ['asOf', 'ลำดับมาตราย้อน', 'ลายน้ำ', 'มาตราซ้ำ', 'resolveWraps', 'รูปแบบ', 'ไม่มีข้อความ']) expect(msgs).toContain(k);
  });

  test('compareLetters: ไม่นับช่องว่าง/คำพูด/เลขเชิงอรรถ · ต่างหนึ่งตัวก็ไม่ผ่าน', () => {
    expect(LD.compareLetters('“ก ข” ค', 'ก\r\nข\u0093ค[๑]').same).toBe(true);
    const c = LD.compareLetters('อำนาจห้าที่', 'อำนาจหน้าที่');
    expect(c.same).toBe(false);
    expect(c.at).toBe(6); // อำนาจห แล้ว ้ ≠ น
  });
});

// ── ด่าน 9d/9e: ป้ายมาตรา + การ์ดจากมาตราที่ติดดาว + หน้าการ์ด ─────────────────────────────────────
test.describe('law-calc.js — ท่องมาตรา (9e)', () => {
  const NOW = 1764300000000, DAY = 86400000;
  const PACK = L.preparePack({ v: 1, code: 'lawyer', s: [
    { n: '52', b: 'หมวด ๕', t: 'ทนายความผู้ใดประพฤติผิดมรรยาท ให้ลงโทษภายในสามสิบวัน' },
    { n: '7ทวิ', b: '', t: 'ข้อความไม่มีคำให้ซ่อน' },
  ] }, 'lawyer');

  test('secLabel: ชื่อย่อ + มาตรา/ข้อ ตามชนิดกฎหมาย', () => {
    expect(L.secLabel('lawyer', '52')).toBe('พ.ร.บ.ทนายความ มาตรา 52');
    expect(L.secLabel('ethics', '21')).toBe('มรรยาททนายความ ข้อ 21');
    expect(L.secLabel('ppk', '150/1')).toBe('ป.พ.พ. มาตรา 150/1');
    expect(L.secLabel('ethics', '21', true)).toBe('ข้อ 21');
    expect(L.secLabel('xx', '1')).toBe('');
  });

  test('searchPack: "มาตรา ๕๒" / "ข้อ 52" เปิดมาตรานั้นก่อน', () => {
    expect(L.searchPack(PACK, 'มาตรา ๕๒')[0]).toMatchObject({ n: '52', exact: true });
    expect(L.searchPack(PACK, 'ม. 52')[0]).toMatchObject({ n: '52', exact: true });
  });

  test('starCards: 3 แบบ (ข้ามเติมคำเมื่อไม่มีคำให้ซ่อน) · ทยอยวันละแบบ · ของเดิมไม่ล้าง FSRS', () => {
    const cs = L.starCards('lawyer', PACK.s[0], NOW);
    expect(cs.map((c) => [c.id, c.dueAt])).toEqual([
      ['st-lawyer-52-a', NOW], ['st-lawyer-52-b', NOW + DAY], ['st-lawyer-52-c', NOW + 2 * DAY]]);
    expect(cs[1].cloze.length).toBeGreaterThan(0);
    for (const c of cs) expect(L.cleanCard(c)).toEqual(c);
    expect(L.starCards('lawyer', PACK.s[1], NOW).map((c) => c.id)).toEqual(['st-lawyer-7ทวิ-a', 'st-lawyer-7ทวิ-c']);
    const reviewed = { ...cs[0], ...FS.schedule(cs[0], 3, NOW + 1000) };
    const again = L.starCards('lawyer', PACK.s[0], NOW + 9999, { 'st-lawyer-52-a': reviewed });
    expect(again[0]).toEqual(reviewed);
    expect(L.starCards('xx', PACK.s[0], NOW)).toEqual([]);
    expect(L.starCards('lawyer', null, NOW)).toEqual([]);
  });

  test('cardFace: ก เลข→หลัก · ข เติมคำ · ค หลัก→เลข · ข้อความเต็มไม่ตัด · ไม่มีมาตราในชุด = null', () => {
    const [a, b, c] = L.starCards('lawyer', PACK.s[0], NOW);
    const t = PACK.s[0].t;
    expect(L.cardFace(a, PACK)).toEqual({ front: 'พ.ร.บ.ทนายความ มาตรา 52', back: t, sub: 'หมวด ๕' });
    const fb = L.cardFace(b, PACK);
    expect(fb.front).toContain('[___]');
    expect(fb.front).not.toContain(b.cloze[0]);
    expect(fb.back).toBe(b.cloze.join(' · ') + '\n\n' + t);
    expect(L.cardFace(c, PACK)).toEqual({ front: t, back: 'พ.ร.บ.ทนายความ มาตรา 52', sub: 'หมวด ๕' });
    expect(L.cardFace({ ...c, front: 'หลักที่ตั้งเอง' }, PACK).front).toBe('หลักที่ตั้งเอง');
    // คำที่เก็บไว้หายจากตัวบท (ชุดใหม่แก้ถ้อยคำ) → เลือกคำใหม่จากข้อความปัจจุบัน
    expect(L.cardFace({ ...b, cloze: ['ไม่มีในตัวบท'] }, PACK).front).toContain('[___]');
    expect(L.cardFace({ ...a, id: 'st-lawyer-99-a', ref: 'lawyer:99' }, PACK)).toBeNull();
    expect(L.cardFace(a, null)).toBeNull();
    expect(L.cardFace({ id: 'dk-1-2560', kind: 'dk', ref: 'dk-1-2560', dueAt: 1 }, PACK)).toBeNull();
  });
});

// ── หน้า classroom-law#statutes (9d) + review.html การ์ดมาตรา (9e) ─────────────────────────────────
test.describe('หน้า: ตัวบท + ท่องมาตรา', () => {
  const lawyer = () => loadPack('lawyer').raw;
  async function open(page, seed) {
    await page.addInitScript((s) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('ome:lang', s.lang || 'th');
        for (const [k, v] of Object.entries(s.ls || {})) localStorage.setItem(k, JSON.stringify(v));
      }
      window.__spoken = [];
      if (window.speechSynthesis) window.speechSynthesis.speak = (u) => { window.__spoken.push(u.text); };
    }, seed || {});
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/classroom-law.html#statutes');
    await page.waitForSelector('.st-sec');
    return errors;
  }

  test('อ่านรายมาตราครบทุกตัวอักษร + หัวหมวด + ส่วนท้าย · สลับชุด · ค้นเลข/คำ', async ({ page }) => {
    const errors = await open(page);
    const raw = lawyer();
    await expect(page.locator('#stPack')).toHaveValue('lawyer');
    await expect(page.locator('.st-sec')).toHaveCount(89);
    const texts = await page.locator('.st-sec .st-t').allTextContents();
    expect(texts).toEqual(raw.s.map((s) => s.t)); // ห้ามย่อ: ข้อความเต็มเท่าชุดทุกมาตรา
    await expect(page.locator('.st-sec').first().locator('.st-no')).toHaveText('มาตรา 1');
    for (const h of new Set(raw.s.map((s) => s.b).filter(Boolean))) await expect(page.locator('#stList .sub-head', { hasText: h }).first()).toBeVisible();
    await expect(page.locator('#stList .sub-head', { hasText: raw.x[0].h })).toHaveCount(1);
    await expect(page.locator('#stMeta')).toContainText('89');

    await page.fill('#stSearch', 'มาตรา ๕๒');
    await expect(page.locator('.st-sec.hit')).toHaveAttribute('data-n', '52');
    await page.fill('#stSearch', 'ไม่มีคำนี้แน่นอน');
    await expect(page.locator('#stList .empty')).toBeVisible();
    await page.fill('#stSearch', 'มรรยาท');
    await expect(page.locator('.st-sec mark').first()).toHaveText('มรรยาท');

    await page.selectOption('#stPack', 'ethics');
    await expect(page.locator('.st-sec')).toHaveCount(21);
    await expect(page.locator('.st-sec').first().locator('.st-no')).toHaveText('ข้อ 1');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:law:ui')).pack)).toBe('ethics');
    await page.reload();
    await page.waitForSelector('.st-sec');
    await expect(page.locator('#stPack')).toHaveValue('ethics'); // จำชุดล่าสุด
    expect(errors).toEqual([]);
  });

  test('ติดดาว → การ์ด 3 แบบ + ตัวนับ · เฉพาะที่ติดดาว · ฟัง · เอาดาวออก (ทบทวนแล้วถามก่อน)', async ({ page }) => {
    const errors = await open(page);
    const sec = page.locator('.st-sec[data-n="52"]');
    await sec.locator('[data-star]').click();
    await expect(sec.locator('[data-star]')).toHaveAttribute('aria-pressed', 'true');
    const st = await page.evaluate(() => ({ stars: JSON.parse(localStorage.getItem('tanot:law:stars')), cards: JSON.parse(localStorage.getItem('tanot:law:cards')) }));
    expect(Object.keys(st.stars)).toEqual(['lawyer:52']);
    expect(st.cards.map((c) => c.id)).toEqual(['st-lawyer-52-a', 'st-lawyer-52-b', 'st-lawyer-52-c']);
    await expect(page.locator('#stMemoStrip .v')).toHaveText(['1', '3', '1']);
    await expect(page.locator('#stReviewLbl')).toHaveText('ทบทวน 1 ใบ');

    await page.click('#stStarOnly');
    await expect(page.locator('.st-sec')).toHaveCount(1);
    await page.click('#stPlayStars');
    await expect(page.locator('#clStTtsControls')).toBeVisible();
    expect((await page.evaluate(() => window.__spoken)).join('')).toContain('ทนายความ');
    await page.click('#clStTtsStopBtn');
    await expect(page.locator('#clStTtsControls')).toBeHidden();

    // ติดดาวซ้ำหลังทบทวนแล้ว → ไม่ล้าง FSRS · เอาดาวออกต้องยืนยัน
    await page.evaluate(() => {
      const a = JSON.parse(localStorage.getItem('tanot:law:cards'));
      a[0] = { ...a[0], reps: 2, stability: 5 };
      localStorage.setItem('tanot:law:cards', JSON.stringify(a));
    });
    await sec.locator('[data-star]').click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    await page.locator('dialog[open] .btn.danger').click();
    await expect(page.locator('#stList .empty')).toBeVisible();
    expect(await page.evaluate(() => [localStorage.getItem('tanot:law:stars'), localStorage.getItem('tanot:law:cards')])).toEqual(['{}', '[]']);
    expect(errors).toEqual([]);
  });

  test('review.html#law: การ์ดมาตรา 3 แบบจากชุดตัวบท · ให้คะแนนเขียน FSRS กลับ · นับใน dueCounts · ชุดหาย = ส่งไปหน้ากฎหมาย', async ({ page }) => {
    const now = Date.now(), t52 = lawyer().s.find((s) => s.n === '52').t;
    const card = (type, extra) => ({ id: 'st-lawyer-52-' + type, kind: 'st', ref: 'lawyer:52', createdAt: now - 9e5, dueAt: now - 1000, ...extra });
    await page.addInitScript((s) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('ome:lang', 'th');
      localStorage.setItem('tanot:law:cards', JSON.stringify(s));
    }, [card('a'), card('c', { dueAt: now + 864e5 }), { id: 'st-ppk-150-a', kind: 'st', ref: 'ppk:150', dueAt: now - 5 }]);
    await page.goto('/review.html#law');
    await expect(page.locator('#rvCard .q')).toHaveText('พ.ร.บ.ทนายความ มาตรา 52');
    await expect(page.locator('#rvCard .a')).toHaveText(t52);
    await expect(page.locator('.rv-more a[href="classroom-law.html"]')).toBeVisible(); // ppk ยังไม่มีชุด
    expect(await page.evaluate(() => LearnCore.dueCounts([]).law)).toBe(2);
    await page.click('#rvCard');
    await page.locator('.rv-rate [data-r="3"]').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:law:cards')).find((c) => c.id === 'st-lawyer-52-a'));
    expect(saved.reps).toBe(1);
    expect(saved.dueAt).toBeGreaterThan(now);
    expect(await page.evaluate(() => LearnCore.dueCounts([]).law)).toBe(1);
  });
});
