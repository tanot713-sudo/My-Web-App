// งานปรับปรุงเสียง/OCR Section 5 (ปิดงาน) — คำอ่านของฉัน (lexicon) · พจนานุกรมเพิ่ม · ข้ามอังกฤษในวงเล็บ · คำที่ถูกข้าม · รวมบรรทัดในย่อหน้า
// · WebGPU ของเสียงพูด + ถอย WASM · งานยาวไม่หาย (Wake Lock, แบ่งไฟล์ตามตอน, ETA, ยกเลิกแล้วได้ไฟล์ที่เสร็จ)
// A) ตรรกะล้วน (Node require: tts-normalize.js, tts-long.js) · B) หน้า text-to-speech จริงใน Chromium (transformers.js หลอก — CI ไม่โหลดโมเดล)
// ข้อความตัวอย่างทุกชุดแต่งขึ้นเอง — ห้ามใช้ข้อความนิยายจริงของเจ้าของ
const { test, expect } = require('@playwright/test');
const N = require('../tts-normalize.js');
const L = require('../tts-long.js');

const VALID = new Set(N.VALID_CHARS.split(''));
const bad = (s) => [...s].filter((c) => !VALID.has(c));
const lex = (text) => N.compileLexicon(N.parseLexicon(text).rows);

/* ═══════════════ A1) คำอ่านของฉัน ═══════════════ */
test.describe('A) lexicon — parseLexicon / compileLexicon / forMms', () => {
  test('parse: บรรทัดละ "คำ = คำอ่าน" · วางหลายบรรทัด · เว้นบรรทัดว่าง/หมายเหตุ # · คำซ้ำ (ไม่สนตัวพิมพ์/ช่องว่าง) แถวหลังชนะ', () => {
    const r = N.parseLexicon('Origin Blood = ออริจิน บลัด\n\n# หมายเหตุ\r\nอสุรา=อะสุรา\nORIGIN  blood = ออริจินใหม่\n');
    expect(r.rejected).toEqual([]);
    expect(r.rows).toEqual([{ from: 'ORIGIN blood', to: 'ออริจินใหม่' }, { from: 'อสุรา', to: 'อะสุรา' }]);
  });

  test('คำอ่านที่มีตัวอักษรนอก vocab ถูกปฏิเสธ (ไม่บันทึกแถวนั้น) · แถวอื่นผ่าน · ำ ใช้ได้', () => {
    const r = N.parseLexicon('Ok = โอเค\nHero = hero\nทำ = ทำ\nเลข = 1 3 5\nไม่มีเท่ากับ\n = ว่าง\nเพิ่งกด = ');
    expect(r.rows.map((x) => x.from)).toEqual(['Ok', 'ทำ']);
    const why = r.rejected.map((x) => [x.line, x.why]);
    expect(why).toEqual([[2, 'vocab'], [4, 'vocab'], [5, 'format'], [6, 'format'], [7, 'empty']]);
    expect(r.rejected[0].bad).toEqual(['h', 'e', 'r', 'o']);
    expect(r.rejected[1].bad).toEqual(['3', '5']); // vocab มีเลขอารบิกแค่ 0 1 2 4
  });

  test('จับคำยาวสุดก่อน · อังกฤษไม่สนตัวพิมพ์ · ติดกับอักษรไทยได้ · วลีหลายคำ (ช่องว่างกี่ตัวก็ได้)', () => {
    const lx = lex('Origin = ออริจิน\nOrigin Blood = ออริจินบลัด\nBlood = บลัด\nฟ้า = ฟ้า');
    expect(N.forMms('แล้วเขาหมุน Origin Blood', { lexicon: lx })).toBe('แล้วเขาหมุน ออริจินบลัด');
    expect(N.forMms('แล้วเขาหมุน origin   BLOOD', { lexicon: lx })).toBe('แล้วเขาหมุน ออริจินบลัด');
    expect(N.forMms('ตามOriginไป', { lexicon: lx })).toBe('ตาม ออริจิน ไป');               // ติดอักษรไทยทั้งสองข้าง
    expect(N.forMms('Origin', { lexicon: lx })).toBe('ออริจิน');
    expect(N.forMms('Origin and Blood', { lexicon: lx })).toBe('ออริจิน บลัด');             // "and" ไม่มีใน lexicon/พจนานุกรม = ข้าม
    expect(N.forMms('Originality', { lexicon: lx })).toBe('');                              // ติดตัวอักษรละติน = ไม่ใช่คำนั้น (ไม่แทนกลางคำ)
    expect(N.forMms('ฟ้าใส', { lexicon: lx })).toBe('ฟ้าใส');
  });

  test('ใช้ก่อนกฎอื่นทั้งหมด: แทนคำที่พจนานุกรมในระบบมีอยู่แล้ว · คำอ่านไม่ถูกกฎตัวเลข/ตัวย่อแตะซ้ำ', () => {
    expect(N.forMms('GOD', {})).toBe('ก็อด');
    expect(N.forMms('GOD', { lexicon: lex('GOD = ก็อดจริง') })).toBe('ก็อดจริง');           // ของฉันชนะพจนานุกรมในระบบ
    expect(N.forMms('Part 2', { lexicon: lex('Part = ภาค') })).toBe('ภาค สอง');
    expect(N.forMms('ตอนจบ', { lexicon: lex('ตอนจบ = จบแล้ว') })).toBe('จบแล้ว');
  });

  test('ผลทุกกรณีอยู่ใน vocab · lexicon ว่าง/ผิดรูปแบบ ไม่เปลี่ยนผลเดิม · forNative ไม่ใช้ lexicon', () => {
    const lx = lex('Origin Blood = ออริจิน บลัด\nริมุรุ = ริมุรุ');
    for (const t of ['Origin Blood 5 ครั้ง', 'ริมุรุ vs Origin', '**Origin Blood** 😊 3,599 บาท']) expect(bad(N.forMms(t, { lexicon: lx })), t).toEqual([]);
    expect(N.forMms('สวัสดี Hero', { lexicon: null })).toBe(N.forMms('สวัสดี Hero'));
    expect(N.forMms('สวัสดี Hero', { lexicon: lex('') })).toBe(N.forMms('สวัสดี Hero'));
    expect(N.forNative('Origin Blood')).toBe('Origin Blood');
    expect(N.compileLexicon('')).toBe(null);
  });

  test('plan ใช้ lexicon เช่นกัน (ท่อน ≤ MAX · ทุกตัวอักษรใน vocab) และ ๆ หลังคำอ่านยังซ้ำคำได้', () => {
    const p = N.plan('เขาเรียก Origin Blood ว่า บลัดๆ\nOrigin Blood อีกครั้ง', { lexicon: lex('Origin Blood = ออริจิน บลัด') });
    p.chunks.forEach((c) => { expect(c.length).toBeLessThanOrEqual(N.MAX_CHUNK); expect(bad(c)).toEqual([]); });
    expect(p.chunks.join(' ')).toContain('ออริจิน บลัด');
  });
});

/* ═══════════════ A2) พจนานุกรมในระบบเพิ่ม ═══════════════ */
test('A) พจนานุกรม: vs = ปะทะ (ติดไทยได้) · GOD = ก็อด · EP = อีพี (EP3 = อีพีสาม) · part = พาร์ท', () => {
  const cases = [
    ['ริมุรุvsเวลดานาวา', 'ริมุรุ ปะทะ เวลดานาวา'], ['ริมุรุ vs เวลดานาวา', 'ริมุรุ ปะทะ เวลดานาวา'], ['A VS B', 'เอ ปะทะ บี'], ['Vs.', 'ปะทะ'],
    ['GOD', 'ก็อด'], ['God', 'ก็อด'], ['ผู้เป็น GOD นั้น', 'ผู้เป็น ก็อด นั้น'],
    ['EP', 'อีพี'], ['EP3', 'อีพี สาม'], ['ep 12', 'อีพี สิบสอง'], ['EP3 จบ', 'อีพี สาม จบ'],
    ['part', 'พาร์ท'], ['Part 2', 'พาร์ท สอง'], ['ตอน part2', 'ตอน พาร์ท สอง']
  ];
  for (const [input, want] of cases) { const got = N.forMms(input); expect(got, input).toBe(want); expect(bad(got)).toEqual([]); }
  for (const w of ['ปะทะ', 'ก็อด', 'อีพี', 'พาร์ท']) expect(bad(w), w).toEqual([]);
  expect(N.TABLES.EN_DICT.vs && N.TABLES.EN_DICT.god && N.TABLES.EN_DICT.ep && N.TABLES.EN_DICT.part).toBeTruthy();
});

/* ═══════════════ A3) อังกฤษในวงเล็บ + คำที่ถูกข้าม ═══════════════ */
test.describe('A) ข้ามอังกฤษในวงเล็บหลังคำไทย + รายการคำที่ถูกข้าม', () => {
  test('"คำไทย (English)" = ข้ามทั้งวงเล็บ แม้มีใน lexicon (กันอ่านซ้ำ) · ปิดตัวเลือก = อ่านตามปกติ', () => {
    const lx = lex('Asura = อสุรา');
    expect(N.forMms('อสุรา (Asura) ออกมา', { lexicon: lx })).toBe('อสุรา ออกมา');
    expect(N.forMms('อสุรา(Asura)ออกมา', { lexicon: lx })).toBe('อสุราออกมา');
    expect(N.forMms('อสุรา （Asura） ออกมา', { lexicon: lx })).toBe('อสุรา ออกมา');
    expect(N.forMms('อสุรา (Asura) ออกมา', { lexicon: lx, skipParen: false })).toBe('อสุรา อสุรา ออกมา'); // ปิด → อ่านซ้ำตามที่ผู้ใช้ขอ
    expect(N.forMms('อสุรา (Asura)', { skipParen: false })).toBe('อสุรา');                                 // ไม่มี lexicon → ข้ามเอง (ไม่รู้จักคำ)
  });

  test('ข้ามเฉพาะวงเล็บอังกฤษล้วนที่ตามหลังอักษรไทย — อย่างอื่นอ่านเหมือนเดิม', () => {
    expect(N.forMms('ยาว (30 เมตร)')).toBe('ยาว สามสิบ เมตร');           // ไทย/เลข ไม่ใช่อังกฤษล้วน
    expect(N.forMms('(Asura) มาแล้ว', { lexicon: lex('Asura = อสุรา') })).toBe('อสุรา มาแล้ว'); // ไม่มีคำไทยนำหน้า = ไม่ข้าม
    expect(N.forMms('ดูที่ (https://x.co/a)')).toBe('ดูที่ ลิงก์');       // ลิงก์ยังเป็น "ลิงก์"
    expect(N.forMms('ติดต่อ (a@b.com)')).toBe('ติดต่อ อีเมล');
    expect(N.forMms('พลัง (Power ไฟ)')).toBe('พลัง ไฟ');                 // มีอักษรไทยในวงเล็บ = ไม่ข้าม (อ่านส่วนไทย)
    expect(N.forMms('อสุรา (Asura) แล้ว (AI)')).toBe('อสุรา แล้ว');
  });

  test('skippedWords: นับจำนวนครั้ง · รวมคำติดกันเป็นวลี · ไม่นับแบบวงเล็บ · ไม่นับคำที่ทับศัพท์/lexicon อ่านให้แล้ว', () => {
    const text = 'อสุรา (Asura) กับ ฟินิกซ์ (Phoenix)\nแล้วเขาหมุน Origin Blood และ origin blood ริมุรุvsเวลดานาวา GOD EP3 Excel Zed Zed';
    const w = N.skippedWords(text);
    expect(w).toEqual([{ word: 'Origin Blood', count: 2 }, { word: 'Zed Zed', count: 1 }]);
    expect(N.skippedWords(text, { lexicon: lex('Origin Blood = ออริจิน บลัด') })).toEqual([{ word: 'Zed Zed', count: 1 }]);
    const off = N.skippedWords('อสุรา (Asura)', { skipParen: false });
    expect(off).toEqual([{ word: 'Asura', count: 1 }]);                                               // ปิดตัวเลือก → เริ่มนับ
    expect(N.skippedWords('ข้อความไทยล้วน 123')).toEqual([]);
  });
});

/* ═══════════════ A4) รวมบรรทัดในย่อหน้า ═══════════════ */
test.describe('A) ท่อน: รวมบรรทัดในย่อหน้าเดียวกัน', () => {
  // บรรทัดสั้นแต่งขึ้นเอง ~38 ตัวอักษรต่อบรรทัด (เลียนลักษณะนิยายแปลที่ตัดทุกบรรทัด) — ไม่ใช่ข้อความจริงของเจ้าของ
  const LINE = (i) => 'เล่าเรื่องสมมติบรรทัดที่ ' + (i + 1);
  const SENT = Array.from({ length: 60 }, (_, i) => LINE(i));

  test('MAX_CHUNK = 100 ค่าเดียว · ต่อกันทุกบรรทัด → จำนวนท่อนลดลง ≥ 50% เทียบกับตัดทุกบรรทัด · ทุกท่อน ≤ MAX · ข้อความครบ', () => {
    expect(N.MAX_CHUNK).toBe(100);
    const merged = N.plan(SENT.join('\n'));
    const perLine = N.plan(SENT.join('\n\n')); // บรรทัดว่างคั่น = ย่อหน้าละบรรทัด = พฤติกรรมเดิม (ตัดทุกบรรทัด)
    expect(perLine.chunks.length).toBe(60);
    expect(merged.chunks.length).toBeLessThanOrEqual(25);
    expect(merged.chunks.length / perLine.chunks.length).toBeLessThan(0.5);
    merged.chunks.forEach((c) => { expect(c.length).toBeLessThanOrEqual(100); expect(c.length).toBeGreaterThan(0); expect(bad(c)).toEqual([]); });
    expect(merged.chunks.join(' ')).toBe(N.forMms(SENT.join('\n'))); // ตัดแล้วต่อกันได้ข้อความเดิมพอดี
    expect(new Set(merged.paras).size).toBe(1);                        // ทั้งก้อนเป็นย่อหน้าเดียว
  });

  test('ช่วงเงียบ 3 ระดับ: ประโยคในย่อหน้า 0.12 · ขึ้นบรรทัดในย่อหน้า 0.25 · ย่อหน้าใหม่ 0.4 · ท่อนสุดท้าย 0', () => {
    const p = N.plan('ประโยคแรก. ประโยคสอง\nบรรทัดสามต่อกัน ยังอยู่ย่อหน้าเดิม. ประโยคสี่\n\nย่อหน้าใหม่ ประโยคเดียว');
    expect(p.chunks).toEqual(['ประโยคแรก', 'ประโยคสอง บรรทัดสามต่อกัน ยังอยู่ย่อหน้าเดิม', 'ประโยคสี่', 'ย่อหน้าใหม่ ประโยคเดียว']);
    expect(p.gaps).toEqual([0.12, 0.12, 0.4, 0]);
    expect(p.paras).toEqual([0, 0, 0, 1]);
    // ขอบท่อนตรงกับขอบบรรทัด → 0.25 · ขอบท่อนกลางบรรทัด → 0.12
    const q = N.plan('ก' + 'ข'.repeat(5) + ' ' + 'ค'.repeat(60) + '\n' + 'ง'.repeat(60));
    expect(q.paras.every((x) => x === 0)).toBe(true);
    expect(q.gaps.slice(0, -1).every((g) => g === 0.12 || g === 0.25)).toBe(true);
    expect(q.gaps).toContain(0.25);
    const e = N.plan('first line here\nsecond line here', { lang: 'en' });
    expect(e.chunks).toEqual(['first line here second line here']); expect(e.gaps).toEqual([0]);
  });

  test('บรรทัดเดียวยาวเกิน MAX ตัดที่ขอบคำ (Intl.Segmenter) ทั้งแบบมีและไม่มีตัวตัดคำ · ไม่ฉีกพยางค์', () => {
    for (const seg of [true, false]) {
      N.useSegmenter(seg);
      try {
        const long = 'เกมเด็กเล่นแม่น้ำใหญ่ไหลผ่านเมืองเก่า'.repeat(10);
        const cs = N.chunks(long + '\n' + long);
        expect(cs.length).toBeGreaterThan(5);
        cs.forEach((c) => { expect(c.length).toBeLessThanOrEqual(100); expect(/^[ะ-ฺๅ็-๎]/.test(c)).toBe(false); expect(/[เ-ไ]$/.test(c)).toBe(false); });
        expect(cs.join('')).toBe((long + long).replace(/ำ/g, 'ํา'));
      } finally { N.useSegmenter(true); }
    }
  });

  test('บรรทัดที่เหลือแต่อีโมจิ/--- นับเป็นบรรทัดว่าง (คั่นย่อหน้า)', () => {
    const p = N.plan('บรรทัดก\n---\nบรรทัดข');
    expect(p.chunks).toEqual(['บรรทัดก', 'บรรทัดข']); expect(p.gaps).toEqual([0.4, 0]);
  });
});

/* ═══════════════ A5) tts-long.js — ตอน / ส่วน / ETA / สถิติ ═══════════════ */
test.describe('A) tts-long.js', () => {
  test('หัวตอน 3 แบบ: "12. ชื่อ" · "2) ชื่อ" · "๓ . ชื่อ" (เลขไทย) → ส่วนละตอน · ชื่อไฟล์ = เลขตอน 3 หลัก + หัวตอนสั้นๆ', () => {
    const text = ['คำนำสั้นๆ ของเรื่องสมมติ', '', '1. จุดเริ่มต้น', 'บรรทัดแรกของตอน', 'บรรทัดสอง', '2) การเดินทาง', 'ราคา 3.5 เมตร ไม่ใช่หัวตอน', '', '  ๓ . ตอนที่สามมีชื่อยาวมากมากมากมากมากมากมากมาก ต่อท้ายอีกเยอะ', 'เนื้อหาตอนสาม'].join('\n');
    const ch = L.splitChapters(text);
    expect(ch.map((c) => [c.num, c.title.startsWith('ตอนที่สามมีชื่อ') ? 'ตอนที่สามมีชื่อ…' : c.title])).toEqual([[0, ''], [1, 'จุดเริ่มต้น'], [2, 'การเดินทาง'], [3, 'ตอนที่สามมีชื่อ…']]);
    expect(ch[1].text.split('\n').slice(0, 3)).toEqual(['1. จุดเริ่มต้น', '', 'บรรทัดแรกของตอน']);  // หัวตอนเป็นย่อหน้าของตัวเอง
    expect(ch[2].text).toContain('3.5 เมตร');
    const used = {};
    const names = ch.map((c) => L.chapterFileName(c, used));
    expect(names.slice(0, 3)).toEqual(['000', '001-จุดเริ่มต้น', '002-การเดินทาง']);
    expect(names[3]).toMatch(/^003-ตอนที่สามมีชื่อ/);
    expect(names[3].length).toBeLessThanOrEqual(4 + 30);
    expect(/[\\/:*?"<>|]/.test(names.join(''))).toBe(false);
    expect(L.chapterFileName({ num: 1, title: 'ซ้ำ: <a>' }, { '001-ซ้ำ a': true })).toBe('001-ซ้ำ a-2');
  });

  test('ไม่พบหัวตอน → null (หน้าแบ่งตามเวลาแทน) · บรรทัดยาวเกิน 150 ที่ขึ้นต้นด้วยเลขไม่ใช่หัวตอน', () => {
    expect(L.splitChapters('ย่อหน้าธรรมดา\nไม่มีเลขข้อ\n\n3.5 เมตรคือความยาว')).toBe(null);
    expect(L.splitChapters('')).toBe(null);
    expect(L.splitChapters('1. ' + 'ก'.repeat(200))).toBe(null);
  });

  test('collector: รับเสียงลำดับสลับได้ · ส่งเป็นส่วนทันทีที่ครบต่อเนื่อง · ปล่อยหน่วยความจำของส่วนที่ส่งแล้ว', () => {
    const out = [];
    const c = L.createCollector({ total: 6, gaps: [0.1, 0.1, 0.4, 0.1, 0.1, 0], ends: [1, 3, 5], onPart: (p) => out.push([p.index, p.from, p.to, p.samples, p.parts.length, p.gaps.join(',')]) });
    const feed = (i) => c.add(i, new Float32Array(100), 16000);
    feed(3); feed(1); expect(out).toEqual([]); expect(c.held()).toBe(2);
    feed(0); expect(out.length).toBe(1); expect(out[0].slice(0, 3)).toEqual([0, 0, 1]); expect(c.held()).toBe(1); // ส่วนที่ 1 ถูกปล่อย เหลือท่อน 3 รอท่อน 2
    feed(2); expect(out.length).toBe(2); expect(c.held()).toBe(0);
    feed(5); feed(4); expect(out.length).toBe(3);
    // ตัวอย่างต่อส่วน = เสียง 2 ท่อน (100 ตัวอย่างต่อท่อน) + ความเงียบ "ระหว่าง" ท่อนในส่วนนั้นเท่านั้น (ท้ายส่วนไม่มี): 0.1 วิ = 1,600 · 0.4 วิ = 6,400
    expect(out.map((p) => p[3])).toEqual([200 + 1600, 200 + 6400, 200 + 1600]);
    expect(out.map((p) => p[5])).toEqual(['0.1,0', '0.4,0', '0.1,0']);
  });

  test('collector: ช่องว่างระหว่างท่อนในส่วนนับรวม ส่วนท้ายส่วนไม่มี gap · ซ้ำ/นอกช่วงถูกเมิน · แบบตามเวลาตัดที่ขอบย่อหน้าหลังครบเวลา', () => {
    const got = [];
    const c = L.createCollector({ total: 4, gaps: [0.5, 0.5, 0.5, 0], ends: [1, 3], onPart: (p) => got.push(p) });
    [0, 1, 2, 3].forEach((i) => c.add(i, new Float32Array(1000), 16000));
    c.add(1, new Float32Array(5), 16000); c.add(99, new Float32Array(5), 16000);
    expect(got.map((p) => p.samples)).toEqual([2000 + 8000, 2000 + 8000]);
    expect(got[0].gaps).toEqual([0.5, 0]); expect(got[1].startSec).toBeCloseTo(2000 / 16000 + 8000 / 16000 + 0.5, 6);
    // ตามเวลา: ท่อนละ 10 วิ, เป้า 25 วิ → ตัดที่ขอบย่อหน้าแรกหลังเกิน 25 วิ (ท่อน 2 จบย่อหน้า 0 ที่ 30 วิ)
    const t = [];
    const paras = [0, 0, 0, 1, 1, 1, 2, 2];
    const c2 = L.createCollector({ total: 8, gaps: new Array(8).fill(0), paras, targetSec: 25, hardCapSec: 60, onPart: (p) => t.push([p.from, p.to, Math.round(p.seconds)]) });
    for (let i = 0; i < 8; i++) c2.add(i, new Float32Array(160000), 16000);
    expect(t).toEqual([[0, 2, 30], [3, 5, 30], [6, 7, 20]]);
    // ย่อหน้ายาวเกินเพดานแข็ง → ตัดกลางย่อหน้า
    const h = [];
    const c3 = L.createCollector({ total: 5, gaps: new Array(5).fill(0), paras: [0, 0, 0, 0, 0], targetSec: 25, hardCapSec: 35, onPart: (p) => h.push([p.from, p.to]) });
    for (let i = 0; i < 5; i++) c3.add(i, new Float32Array(160000), 16000);
    expect(h).toEqual([[0, 3], [4, 4]]);
  });

  test('ETA ค่าเฉลี่ยเคลื่อนที่: ไม่ประเมินช่วงทยอยเปิด Worker · หลังเปิดครบวัดอัตราเต็มกำลังใหม่ (ไม่ถัวช่วงช้า) · เวลาต่อท่อนสั่น ±50% แล้ว ETA ยังไม่กระโดด', () => {
    const e = L.createEta();
    let t = 0, done = 0; const etas = [];
    // ช่วงทยอยเปิด: ท่อนละ 9 วิ ×4 · แล้วเต็มกำลังเฉลี่ย 2 วิ/ท่อน (สั่นขึ้นลง ±50% แบบกำหนดตายตัว)
    const total = 100, jitter = [1, 3, 2, 1, 3, 2, 3, 1, 2, 2, 1, 3];
    for (let i = 1; i <= 60; i++) {
      t += i <= 4 ? 9000 : jitter[i % jitter.length] * 1000; done++;
      const r = e.mark(done, total, t, i <= 5);
      if (i <= 5) expect(r.eta).toBe(null);               // ยังทยอยเปิด → ไม่ประเมิน
      else if (r.eta != null) etas.push([i, r.eta, (total - done) * 2]);
    }
    expect(etas.length).toBeGreaterThan(40);
    const first = etas[0];
    expect(first[1] / first[2]).toBeLessThan(1.15);         // ไม่สูงเกินจริงตอนเพิ่งเริ่มประเมิน (ถ้าถัวช่วงเปิดช้าจะเกิน 2 เท่า)
    for (let k = 1; k < etas.length; k++) {
      const [, cur] = etas[k], [, prev] = etas[k - 1];
      expect(cur / prev, 'ETA ต้องไม่กระโดด ณ ท่อน ' + etas[k][0]).toBeLessThan(1.25);
    }
    const last = etas[etas.length - 1];
    expect(Math.abs(last[1] - last[2]) / last[2]).toBeLessThan(0.1);
    expect(L.createEta().mark(1, 10, 0, false)).toEqual({ rate: null, eta: null });
  });

  test('statsInfo เป็นตัวเลข/รหัสสั้นๆ ไม่มีเนื้อหา', () => {
    const s = L.statsInfo({ chars: 175000, chunks: 2722, max: 100, workers: 3, device: 'webgpu', sec: 100.04, secPerChunk: 2.345, secPer1000: 12.3, parts: 4, mode: 'chapters', cancelled: true });
    expect(s).toBe('chars=175000 chunks=2722 max=100 workers=3 device=webgpu sec=100.0 sec/chunk=2.35 sec/1000ch=12.3 parts=4 mode=chapters cancelled');
    expect(/[฀-๿]/.test(s)).toBe(false);
  });
});

/* ═══════════════ B) หน้า text-to-speech ═══════════════ */
const BIG_DEVICE = `Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 8 }); Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 8 });`;
const GPU_OK = `Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => ({ requestAdapter: async () => ({ isFallbackAdapter: false, features: new Set(['shader-f16']) }) }) });`;
const WAKE = `(() => { window.__wl = []; Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async (t) => { window.__wl.push('req:' + t); const s = { released: false, release() { if (this.released) return; this.released = true; window.__wl.push('rel'); return Promise.resolve(); }, addEventListener() {} }; return s; } } }); })();`;

/* transformers.js หลอก: TTS ตรวจ vocab + ความยาว ≤ MAX_CHUNK · cfg.gpu = พฤติกรรมเมื่อขอ device:'webgpu' · cfg.busyMs = เวลาต่อท่อน · แจ้ง device/dtype ที่ถูกโหลดกลับหน้า */
function fakeTransformers(cfg) {
  return `
const VOCAB = new Set(${JSON.stringify(N.VALID_CHARS.split(''))});
const CFG = ${JSON.stringify(cfg || {})};
export const env = { backends: { onnx: { wasm: {} } } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function busy(ms) { const t = Date.now(); while (Date.now() - t < ms) {} }
export async function pipeline(task, model, opts) {
  const device = (opts && opts.device) || 'wasm';
  self.postMessage({ type: 'fake-pipeline', model, device, dtype: (opts && opts.dtype) || null });
  if (opts && opts.progress_callback) opts.progress_callback({ status: 'progress', file: 'onnx/model.onnx', progress: 50 });
  await sleep(CFG.loadMs || 0);
  if (device === 'webgpu' && CFG.gpu === 'throw-load') throw new Error('WebGPU: no kernel for node ConvTranspose');
  return async (text) => {
    const out = [...text].filter((c) => !VOCAB.has(c));
    if (out.length) throw new Error('Gather node index out of bounds: ' + JSON.stringify(out.join('')));
    if (!text.trim() || text.length > ${N.MAX_CHUNK}) throw new Error('bad chunk length ' + text.length);
    busy(CFG.busyMs || 0);
    if (device === 'webgpu' && CFG.gpu === 'throw-run') throw new Error('WebGPU device lost');
    const a = new Float32Array(1600);
    for (let i = 0; i < a.length; i++) a[i] = device === 'webgpu' && CFG.gpu === 'silent' ? 0 : Math.sin(i / 5) * 0.3;
    if (device === 'webgpu' && CFG.gpu === 'nan') a[10] = NaN;
    return { audio: a, sampling_rate: 16000 };
  };
}`;
}
/* ดักข้อความที่หน้าส่งเข้า tts-worker (ท่อน + device) และข้อความที่ Worker ส่งกลับ */
const SPY = `(() => {
  const W = window.Worker;
  window.__batches = []; window.__wmsgs = []; window.__workers = [];
  function Spy(url, opts) {
    const w = new W(url, opts);
    const u = String(url); window.__workers.push(u);
    const post = w.postMessage.bind(w);
    w.postMessage = function (m, tr) { if (m && m.type === 'synthesize-batch') window.__batches.push({ url: u, model: m.modelId, device: m.device, items: m.items.map((i) => i.text) }); return post(m, tr); };
    if (/tts-worker/.test(u)) w.addEventListener('message', (e) => { const d = e.data; if (d && (d.type === 'fake-pipeline' || d.type === 'fallback')) window.__wmsgs.push(d); });
    return w;
  }
  Spy.prototype = W.prototype; window.Worker = Spy;
})();`;

async function setup(context, page, { cfg, init, route } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await context.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (/\/vendor\/transformers\/transformers\.web\.min\.js$/.test(u.pathname)) return r.fulfill({ contentType: 'text/javascript', body: fakeTransformers(cfg) });
    if (route) { const h = await route(r, u); if (h) return; }
    if (u.pathname === '/api/ai/usage') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ used: 10, limit: 10000 }) });
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return r.continue();
    return r.abort('internetdisconnected');
  });
  await page.addInitScript(SPY);
  await page.addInitScript((i) => { try { localStorage.setItem('ome:theme', 'light'); localStorage.setItem('tanot:asr:lang', 'auto'); } catch (e) {} if (i) (0, eval)(i); }, init || '');
  return errors;
}
const logRows = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));
const ok = (page) => expect(page.locator('#dlStatus')).toHaveClass(/ok/, { timeout: 30000 });
const openLex = async (page) => { await page.click('#lexBox > summary'); };
const sentences = (n, tag = '') => Array.from({ length: n }, (_, i) => 'ประโยคทดสอบ' + tag + ' ' + (i + 1) + ' สร้างเสียงพูดภาษาไทย').join('\n\n');

test.describe('B) คำอ่านของฉัน — ช่องในการ์ดสร้างไฟล์เสียง', () => {
  test('พิมพ์หลายบรรทัด → บันทึกเฉพาะแถวที่ผ่าน (blob ใน tanot:lexicon…) · แถวผิด vocab เตือนและไม่บันทึก · โหลดหน้าใหม่ยังอยู่ · คีย์เป็น sync ใน registry', async ({ context, page }) => {
    const errors = await setup(context, page);
    await page.goto('/text-to-speech.html');
    expect(await page.evaluate(() => ['tanot:tts:lexicon', 'tanot:tts:opts', 'tanot:tts:gpubad'].map((k) => TanotRegistry.classify(k)))).toEqual([
      expect.objectContaining({ kind: 'sync' }), expect.objectContaining({ kind: 'local' }), expect.objectContaining({ kind: 'cache' })]);
    await page.click('#lexBox > summary');
    await page.fill('#lexText', 'Origin Blood = ออริจิน บลัด\nHero = hero\nริมุรุ = ริมุรุ\nไม่มีเท่ากับ');
    await page.locator('#lexText').blur();
    await expect(page.locator('#lexMsg')).toContainText('บรรทัด 2');
    await expect(page.locator('#lexMsg')).toContainText('h e r o');
    await expect(page.locator('#lexMsg')).toContainText('บรรทัด 4');
    await expect(page.locator('#lexStatus')).toContainText('บันทึกแล้ว 2 คำ');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:tts:lexicon')));
    expect(stored).toEqual({ v: 1, text: 'Origin Blood = ออริจิน บลัด\nริมุรุ = ริมุรุ' }); // แถวที่ผิดไม่ถูกเก็บ
    // ช่องยังเก็บบรรทัดที่ผิดไว้ให้แก้ แต่เติมคำอ่านที่ถูก → เตือนหาย
    await page.fill('#lexText', 'Origin Blood = ออริจิน บลัด\nHero = ฮีโร่');
    await page.locator('#lexText').blur();
    await expect(page.locator('#lexMsg')).toHaveText('');
    await page.reload();
    await expect(page.locator('#lexText')).toHaveValue('Origin Blood = ออริจิน บลัด\nHero = ฮีโร่');
    expect(errors).toEqual([]);
  });

  test('ใช้ตอนสร้างไฟล์เสียง: ข้อความที่ส่งเข้าโมเดลมีคำอ่านของฉัน · ข้ามอังกฤษในวงเล็บตามตัวเลือก (เปิด/ปิด) · จำตัวเลือก', async ({ context, page }) => {
    const errors = await setup(context, page, { init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await openLex(page);
    await page.fill('#lexText', 'Asura = อสุรา\nOrigin Blood = ออริจิน บลัด');
    await page.fill('#ttsText', 'อสุรา (Asura) หมุน Origin Blood แล้วริมุรุvsเวลดานาวา');
    await page.click('#dlGenerateBtn'); await ok(page);
    let sent = (await page.evaluate(() => window.__batches.flatMap((b) => b.items))).join(' ');
    expect(sent).toBe('อสุรา หมุน ออริจิน บลัด แล้วริมุรุ ปะทะ เวลดานาวา');
    // ปิดตัวเลือก → อ่านซ้ำ
    await page.uncheck('#optParen');
    await page.evaluate(() => { window.__batches.length = 0; });
    await page.click('#dlGenerateBtn'); await ok(page);
    sent = (await page.evaluate(() => window.__batches.flatMap((b) => b.items))).join(' ');
    expect(sent).toBe('อสุรา อสุรา หมุน ออริจิน บลัด แล้วริมุรุ ปะทะ เวลดานาวา');
    await page.reload();
    await expect(page.locator('#optParen')).not.toBeChecked();
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('tanot:tts:opts')))).toMatchObject({ skipParen: false });
    expect(errors).toEqual([]);
  });

  test('"ดูข้อความที่จะอ่านจริง": รายการคำที่ถูกข้าม + จำนวนครั้ง (ไม่นับวงเล็บ) · ปุ่ม "เพิ่มคำอ่าน" ใส่ "คำ = " ในช่อง · พิมพ์คำอ่านแล้วคำหายจากรายการ', async ({ context, page }) => {
    const errors = await setup(context, page);
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', 'อสุรา (Asura) แล้วเขาหมุน Origin Blood และ origin blood อีกครั้ง ฟินิกซ์ (Phoenix) Zed ริมุรุvsเวลดานาวา');
    await page.click('#pvMmsBox > summary');
    const rows = page.locator('#pvSkipped .list-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Origin Blood'); await expect(rows.nth(0)).toContainText('2 ครั้ง');
    await expect(rows.nth(1)).toContainText('Zed');
    expect(await page.inputValue('#pvMms')).not.toContain('Asura');
    await rows.nth(0).locator('button').click();
    await expect(page.locator('#lexBox')).toHaveJSProperty('open', true);
    await expect(page.locator('#lexText')).toHaveValue('Origin Blood = ');
    await expect(page.locator('#lexText')).toBeFocused();
    await expect(page.locator('#lexMsg')).toHaveText(''); // "คำ = " ที่ยังไม่ได้พิมพ์ไม่ใช่ข้อผิดพลาด
    await page.keyboard.type('ออริจิน บลัด');
    await page.locator('#lexText').blur();
    await expect(page.locator('#pvSkipped .list-row')).toHaveCount(1);
    await expect(page.locator('#pvMms')).toHaveValue(/ออริจิน บลัด/);
    // กดซ้ำคำเดิมไม่เพิ่มบรรทัดซ้ำ
    await page.fill('#ttsText', 'ฟินิกซ์ Zed Zed');
    await page.locator('#pvSkipped .list-row button').first().click();
    await page.locator('#pvSkipped .list-row button').first().click().catch(() => {});
    expect((await page.inputValue('#lexText')).split('\n').filter((l) => /^Zed Zed =/.test(l)).length).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('วิดเจ็ตแชทพูดคำตอบด้วยคำอ่านของฉัน (หน้าอื่น) · ข้ามอังกฤษในวงเล็บตามตัวเลือกเดียวกัน', async ({ context, page }) => {
    const errors = await setup(context, page, { init: `localStorage.setItem('ome:aiChatSpeak', 'on'); localStorage.setItem('tanot:tts:lexicon', JSON.stringify({ v: 1, text: 'Origin Blood = ออริจิน บลัด' }));` });
    await context.route('**/api/ai/chat', (r) => r.fulfill({ contentType: 'text/event-stream', body: 'data:{"t":"อสุรา (Asura) ใช้ Origin Blood"}\n\ndata:{"done":true}\n\n' }));
    await page.addInitScript(() => { window.TANOT_AI = { enabled: true }; });
    await page.goto('/credits.html');
    await page.click('.ome-ai-fab');
    await page.fill('.ome-ai-inputrow textarea', 'ทดสอบ');
    await page.click('.ome-ai-btn.send');
    await expect.poll(() => page.evaluate(() => window.__batches.flatMap((b) => b.items).join(' ')), { timeout: 20000 }).toBe('อสุรา ใช้ ออริจิน บลัด');
    expect(errors).toEqual([]);
  });
});

test.describe('B) งานยาวไม่หาย', () => {
  test('Screen Wake Lock: ขอตอนเริ่ม · ปล่อยตอนจบ · ขอใหม่เมื่อแท็บกลับมาเห็น · เตือนอย่าสลับแท็บ (ข้อความเปลี่ยนเมื่อเคยสลับ) · ปล่อยตอนยกเลิกด้วย', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { busyMs: 60 }, init: WAKE + BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', sentences(14));
    await page.click('#dlGenerateBtn');
    await expect(page.locator('#dlKeepNote')).toBeVisible();
    await expect(page.locator('#dlKeepNote')).toContainText('อย่าสลับแท็บ');
    await expect.poll(() => page.evaluate(() => window.__wl.slice())).toEqual(['req:screen']);
    // แท็บถูกซ่อน → เบราว์เซอร์ปล่อย lock เอง → กลับมาเห็นแล้วต้องขอใหม่
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.evaluate(() => { window.__tts.wake.sentinel && window.__tts.wake.sentinel.release(); window.__tts.wake.sentinel = null; });
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('#dlKeepNote')).toContainText('เคยสลับแท็บ');
    await expect.poll(() => page.evaluate(() => window.__wl.filter((x) => x === 'req:screen').length)).toBe(2);
    await ok(page);
    await expect(page.locator('#dlKeepNote')).toBeHidden();
    const wl = await page.evaluate(() => window.__wl.slice());
    expect(wl.filter((x) => x === 'rel').length).toBe(wl.filter((x) => x === 'req:screen').length); // ขอกี่ครั้งปล่อยครบทุกครั้ง
    expect(await page.evaluate(() => window.__tts.wake.want)).toBe(false);
    // ยกเลิกกลางทาง → ปล่อยด้วย
    await page.evaluate(() => { window.__wl.length = 0; });
    await page.click('#dlGenerateBtn');
    await expect.poll(() => page.evaluate(() => window.__wl.slice())).toEqual(['req:screen']);
    await page.click('#dlCancelBtn');
    await expect(page.locator('#dlGenerateBtn')).toBeEnabled();
    expect(await page.evaluate(() => window.__wl.slice())).toEqual(['req:screen', 'rel']);
    expect(errors).toEqual([]);
  });

  test('สร้างไฟล์ซ้ำติดกัน (พูลยังไม่ปิด) ใช้ Worker เดิมที่อุ่นแล้ว · ไม่ค้าง · ไม่สร้าง Worker เพิ่ม', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { busyMs: 20 }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', sentences(12));
    await page.click('#dlGenerateBtn'); await ok(page);
    const n1 = await page.evaluate(() => window.__workers.filter((u) => /tts-worker/.test(u)).length);
    expect(n1).toBeGreaterThan(1);
    await page.fill('#ttsText', sentences(12, 'สอง'));
    await page.evaluate(() => { window.__batches.length = 0; });
    await page.click('#dlGenerateBtn');
    await expect(page.locator('#dlStatus')).toHaveClass(/ok/, { timeout: 30000 });
    await expect(page.locator('#dlStatus')).toContainText('สร้างไฟล์เสียงเสร็จแล้ว');
    expect(await page.evaluate(() => window.__workers.filter((u) => /tts-worker/.test(u)).length)).toBeLessThanOrEqual(4); // ใช้ตัวเดิม + ขยายได้ไม่เกินขนาดพูล (4)
    expect((await page.evaluate(() => window.__batches.flatMap((b) => b.items))).length).toBe(12);
    expect(errors).toEqual([]);
  });

  test('ไม่รองรับ Wake Lock → ข้ามเงียบๆ ยังสร้างไฟล์ได้ และยังเตือน', async ({ context, page }) => {
    const errors = await setup(context, page, { init: `delete Navigator.prototype.wakeLock; try { Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true }); } catch (e) {}` });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', sentences(3));
    await page.click('#dlGenerateBtn'); await ok(page);
    expect(errors).toEqual([]);
  });

  test('แบ่งไฟล์ตามตอน: หัวตอน 3 แบบ → ไฟล์ละตอนทันทีที่ตอนนั้นเสร็จ (ชื่อ = เลขตอน + หัวตอน) · ความยาวไฟล์ถูก · ไม่มีหัวตอน = ไม่แบ่งแบบตอน', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { busyMs: 30 }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    const book = ['คำนำ', '', '1. ต้นเรื่อง', 'ประโยคแรกของตอนหนึ่ง', 'ประโยคสองของตอนหนึ่ง', '', '2) การเดินทาง', 'เนื้อหาตอนสอง', '', '๓ . ตอนจบ: ปิดฉาก?', 'เนื้อหาตอนสาม'].join('\n');
    await page.fill('#ttsText', book);
    await page.check('#optSplit');
    await page.click('#dlGenerateBtn'); await ok(page);
    await expect(page.locator('#dlStatus')).toContainText('4 ไฟล์');
    const rows = await page.locator('#dlParts .list-row').evaluateAll((els) => els.map((e) => ({
      name: e.querySelector('.title').textContent, mp3: e.querySelector('a[data-ext=mp3]').getAttribute('download'), wav: e.querySelector('a[data-ext=wav]').getAttribute('download'), meta: e.querySelector('.meta').textContent })));
    expect(rows.map((r) => r.name)).toEqual(['000', '001-ต้นเรื่อง', '002-การเดินทาง', '003-ตอนจบ ปิดฉาก']);
    expect(rows.map((r) => r.mp3)).toEqual(rows.map((r) => r.name + '.mp3'));
    expect(rows.map((r) => r.wav)).toEqual(rows.map((r) => r.name + '.wav'));
    expect(await page.locator('#dlPlayerWrap').evaluate((e) => getComputedStyle(e).display)).toBe('none');
    // ไฟล์ wav ของตอนที่ 1: หัวตอนเป็นย่อหน้าของตัวเอง (0.4 วิ) แล้วตามด้วย 2 บรรทัดในย่อหน้าเดียวกัน (รวมเป็นท่อนเดียว)
    const info = await page.evaluate(async () => {
      const out = [];
      for (const a of document.querySelectorAll('#dlParts a[data-ext=wav]')) { const b = new Uint8Array(await (await fetch(a.href)).arrayBuffer()); out.push({ head: String.fromCharCode(...b.slice(0, 4)), len: b.length }); }
      return out;
    });
    expect(info.every((x) => x.head === 'RIFF')).toBe(true);
    const sec = (n, gaps) => 44 + (n * 1600 + gaps.reduce((s, g) => s + Math.round(16000 * g), 0)) * 2;
    expect(info[0].len).toBe(sec(1, []));                       // คำนำ: 1 ท่อน
    expect(info[1].len).toBe(sec(3, [0.12, 0.4]));              // "1." (จบประโยค) | "ต้นเรื่อง" | (2 บรรทัดรวมเป็น 1 ท่อน) — หัวตอนเป็นย่อหน้าของตัวเอง
    expect(info[2].len).toBe(sec(2, [0.4]));                    // "2) การเดินทาง" | เนื้อหา
    expect(info[3].len).toBe(sec(3, [0.12, 0.4]));
    const sent = await page.evaluate(() => window.__batches.flatMap((b) => b.items));
    expect(sent).toContain('ประโยคแรกของตอนหนึ่ง ประโยคสองของตอนหนึ่ง');
    expect(errors).toEqual([]);
  });

  test('แบ่งไฟล์ตามตอน: ไม่พบหัวตอน → ตัดทุก ~30 นาทีเสียงที่ขอบย่อหน้า (ทดสอบด้วย TANOT_TTS.timeSplitSec) · part-001 …', async ({ context, page }) => {
    const errors = await setup(context, page, { init: BIG_DEVICE + 'window.TANOT_TTS = { timeSplitSec: 0.55 };' });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', sentences(12));       // ท่อนละ 0.1 วิ + ช่องว่างย่อหน้า 0.4 → ตัดเมื่อเกิน 0.55 วิ ที่ขอบย่อหน้า
    await page.check('#optSplit');
    await page.click('#dlGenerateBtn'); await ok(page);
    const names = await page.locator('#dlParts .title').allTextContents();
    expect(names.length).toBeGreaterThanOrEqual(4);
    expect(names[0]).toBe('part-001'); expect(names[names.length - 1]).toBe('part-' + String(names.length).padStart(3, '0'));
    const total = (await page.locator('#dlParts .meta').allTextContents()).length;
    expect(total).toBe(names.length);
    expect(errors).toEqual([]);
  });

  test('ยกเลิกกลางทาง: ปุ่มยกเลิกหยุดพูล · ตอนที่เสร็จแล้วยังดาวน์โหลดได้ · ข้อความบอกจำนวนไฟล์ · บันทึกสถิติ (cancelled) ไม่มีเนื้อหา', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { busyMs: 400 }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    const book = Array.from({ length: 6 }, (_, i) => (i + 1) + '. ตอนสมมติ\n' + sentences(8, 'ตอน' + (i + 1))).join('\n\n');
    await page.fill('#ttsText', book);
    await page.check('#optSplit');
    await page.click('#dlGenerateBtn');
    await expect(page.locator('#dlParts .list-row')).not.toHaveCount(0, { timeout: 30000 });
    await page.click('#dlCancelBtn');
    await expect(page.locator('#dlStatus')).toContainText('ยกเลิกแล้ว', { timeout: 15000 });
    await expect(page.locator('#dlGenerateBtn')).toBeEnabled();
    await expect(page.locator('#dlCancelBtn')).toBeHidden();
    const n = await page.locator('#dlParts .list-row').count();
    expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThan(6);
    await expect(page.locator('#dlStatus')).toContainText(n + ' ไฟล์');
    const log = (await logRows(page)).filter((r) => r.kind === 'tts');
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ code: 'info', stage: 'stats', device: 'wasm' });
    expect(log[0].msg).toMatch(/cancelled/);
    expect(JSON.stringify(log)).not.toContain('ตอนสมมติ');
    expect(errors).toEqual([]);
  });

  test('สถานะระหว่างสร้าง: "Worker n ตัว · ~x วิ/ท่อน" + ETA หลังเปิด Worker ครบ · จบแล้วบันทึกสถิติลง problem log (code info) ไม่มีเนื้อหา', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { busyMs: 120, loadMs: 150 }, init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', sentences(40, 'ลับ'));
    await page.click('#dlGenerateBtn');
    await expect(page.locator('#dlStatus')).toContainText(/Worker \d+ ตัว · ~[\d.]+ วิ\/ท่อน/, { timeout: 30000 });
    await expect(page.locator('#dlStatus')).toContainText(/อีก(ประมาณ|ไม่กี่วินาที)/, { timeout: 30000 });
    await ok(page);
    const rows = (await logRows(page)).filter((r) => r.kind === 'tts');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ code: 'info', stage: 'stats', engine: 'local', device: 'wasm' });
    expect(rows[0].msg).toMatch(/^chars=\d+ chunks=40 max=100 workers=\d+ device=wasm sec=[\d.]+ sec\/chunk=[\d.]+ sec\/1000ch=[\d.]+ parts=1 mode=single$/);
    expect(JSON.stringify(rows)).not.toContain('ลับ');
    expect(errors).toEqual([]);
  });

  test('data.html แสดงแถวสถิติ (code info) ได้โดยไม่ error', async ({ context, page }) => {
    const errors = await setup(context, page, { init: BIG_DEVICE });
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', sentences(2));
    await page.click('#dlGenerateBtn'); await ok(page);
    await page.goto('/data.html');
    await expect(page.locator('#dtLog')).toContainText('สถิติ');
    await expect(page.locator('#dtLog')).toContainText('chunks=2');
    expect(errors).toEqual([]);
  });
});

test.describe('B) WebGPU ของเสียงพูด (MMS-TTS) + ถอย WASM', () => {
  const gpuText = () => sentences(6);
  async function run(page, text) {
    await page.goto('/text-to-speech.html');
    await page.fill('#ttsText', text || gpuText());
    await page.click('#dlGenerateBtn'); await ok(page);
  }

  test('เครื่องที่ webgpuPlan ok → ตัวเลือก "ใช้การ์ดจอ" โผล่ · ส่ง device:webgpu + Worker เดียว (fp32) · เสียงปกติไม่ถอย', async ({ context, page }) => {
    const errors = await setup(context, page, { cfg: { gpu: 'ok' }, init: BIG_DEVICE + GPU_OK });
    await run(page);
    await expect(page.locator('#optGpuWrap')).toBeVisible();
    const b = await page.evaluate(() => ({ batches: window.__batches, msgs: window.__wmsgs, workers: window.__workers.filter((u) => /tts-worker/.test(u)).length }));
    expect(b.workers).toBe(1);
    expect(b.batches.every((x) => x.device === 'webgpu')).toBe(true);
    expect(b.msgs.filter((m) => m.type === 'fake-pipeline')).toEqual([{ type: 'fake-pipeline', model: 'Tanotfin/mms-tts-2081-onnx', device: 'webgpu', dtype: 'fp32' }]);
    expect(b.msgs.filter((m) => m.type === 'fallback')).toEqual([]);
    expect((await logRows(page)).filter((r) => r.code !== 'info')).toEqual([]);
    await expect(page.locator('#dlStatus')).toContainText('สร้างไฟล์เสียงเสร็จแล้ว');
    expect(errors).toEqual([]);
  });

  test('ไม่ติ๊ก "ใช้การ์ดจอ" หรือไม่มี WebGPU → WASM เหมือนเดิม (ไม่ส่ง webgpu, ตัวเลือกซ่อน)', async ({ context, page }) => {
    await setup(context, page, { cfg: { gpu: 'ok' }, init: BIG_DEVICE });
    await run(page);
    await expect(page.locator('#optGpuWrap')).toBeHidden();
    expect(await page.evaluate(() => window.__batches.every((x) => x.device === 'wasm'))).toBe(true);
    const ctx2 = await context.browser().newContext();
    const p2 = await ctx2.newPage();
    await setup(ctx2, p2, { cfg: { gpu: 'ok' }, init: BIG_DEVICE + GPU_OK });
    await p2.goto('/text-to-speech.html');
    await expect(p2.locator('#optGpuWrap')).toBeVisible();
    await p2.uncheck('#optGpu');
    await p2.fill('#ttsText', gpuText());
    await p2.click('#dlGenerateBtn'); await ok(p2);
    expect(await p2.evaluate(() => window.__batches.every((x) => x.device === 'wasm'))).toBe(true);
    await ctx2.close();
  });

  for (const [mode, stage, why] of [['throw-load', 'load', 'โหลด WebGPU ไม่ได้'], ['throw-run', 'run', 'รันบน WebGPU ล้ม'], ['nan', 'output', 'เสียงมี NaN'], ['silent', 'output', 'เสียงเงียบทั้งท่อน']]) {
    test(`${why} → ถอย WASM 1 ครั้งแล้วสร้างไฟล์ได้ครบ · problem log (webgpu-${stage}) ไม่มีเนื้อหา · จำว่าล้ม (ครั้งหน้าไม่เสนอ WebGPU) · ขยายพูลเป็นหลาย Worker`, async ({ context, page }) => {
      const errors = await setup(context, page, { cfg: { gpu: mode, busyMs: 40 }, init: BIG_DEVICE + GPU_OK });
      await run(page, sentences(16, 'ลับ'));
      const b = await page.evaluate(() => ({ msgs: window.__wmsgs, workers: window.__workers.filter((u) => /tts-worker/.test(u)).length }));
      const fb = b.msgs.filter((m) => m.type === 'fallback');
      expect(fb).toHaveLength(1);                                          // ถอย 1 ครั้งเท่านั้น ไม่ลองซ้ำ
      expect(fb[0]).toMatchObject({ what: 'device', from: 'webgpu', to: 'wasm', stage });
      expect(b.msgs.filter((m) => m.type === 'fake-pipeline' && m.device === 'webgpu')).toHaveLength(mode === 'throw-load' ? 1 : 1);
      expect(b.msgs.some((m) => m.type === 'fake-pipeline' && m.device === 'wasm')).toBe(true);
      expect(b.workers).toBeGreaterThan(1);                                // ถอยแล้วขยายพูลเป็นขนาดปกติ
      await expect(page.locator('#dlStatus')).toContainText('สร้างไฟล์เสียงเสร็จแล้ว');
      const log = await logRows(page);
      const row = log.find((r) => r.stage === 'webgpu-' + stage);
      expect(row, JSON.stringify(log)).toBeTruthy();
      expect(row).toMatchObject({ kind: 'tts', engine: 'local', device: 'webgpu', model: 'Tanotfin/mms-tts-2081-onnx' });
      expect(JSON.stringify(log)).not.toContain('ลับ');
      expect(await page.evaluate(() => +localStorage.getItem('tanot:tts:gpubad'))).toBeGreaterThan(0);
      // ไฟล์ปลายทางถูกต้อง: ทุกท่อนมีเสียง (ไม่ใช่ NaN/เงียบ)
      const wav = await page.evaluate(async () => new Uint8Array(await (await fetch(document.getElementById('dlWavLink').href)).arrayBuffer()));
      const pcm = new Int16Array(wav.buffer, 44, (wav.length - 44) / 2);
      expect(pcm.some((v) => Math.abs(v) > 1000)).toBe(true);
      // ครั้งต่อไป (โหลดหน้าใหม่) ไม่เสนอ WebGPU เพราะเพิ่งล้ม
      await page.reload();
      await expect(page.locator('#optGpuWrap')).toBeHidden();
      expect(errors).toEqual([]);
    });
  }
});
