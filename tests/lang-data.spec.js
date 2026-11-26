// @ts-check
// ROADMAP แถว 21 (ภาษา L0) — ตัวแปลงข้อมูล tools/lang-data (ไม่มี DOM/เครือข่าย)
// known-answer จากไฟล์ดิบจำลองขนาดเล็กที่สร้างในเทสต์ — ไม่มีข้อมูลจริงของ Tatoeba/Wiktionary ใน repo
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const L = require(path.join(ROOT, 'tools', 'lang-data', 'lib.js'));
const BUILD = path.join(ROOT, 'tools', 'lang-data', 'build.mjs');

test.describe('ระดับจากอันดับความถี่', () => {
  test('ขอบของแต่ละช่วง', () => {
    const cases = [[1, 1], [500, 1], [501, 2], [1200, 2], [1201, 3], [2500, 3], [2501, 4], [5000, 4], [5001, 5], [8000, 5], [8001, 6], [50000, 6]];
    for (const [r, lv] of cases) expect(L.levelOfRank(r), 'rank ' + r).toBe(lv);
  });
});

test.describe('FrequencyWords', () => {
  test('อ่านบรรทัด "คำ จำนวน" → อันดับตามลำดับบรรทัด, NFC + ตัวพิมพ์เล็ก, ข้ามบรรทัดเสีย/ซ้ำ', () => {
    const f = L.parseFreq(['you 22484400', 'I 19975318', 'the 17594291', '', 'bad', 'x notnum', 'YOU 5', 'café 9']);
    expect(f.list.map((e) => e.id)).toEqual(['you', 'i', 'the', 'café']);
    expect(f.rank.get('i')).toBe(2);
    expect(f.rank.get('café')).toBe(4); // NFC
    expect(f.list[0].count).toBe(22484400);
  });
});

test.describe('ตัดคำ + ประโยค', () => {
  test('ภาษาเว้นวรรค: คำตัวพิมพ์เล็ก คง apostrophe ภายในคำ', () => {
    expect(L.tokenize("Let's try SOMETHING, now!", 'en')).toEqual(["let's", 'try', 'something', 'now']);
  });
  test('ตัวเลขล้วนไม่นับเป็นคำ', () => {
    expect(L.tokenize('I have 3 cats', 'en')).toEqual(['i', 'have', 'cats']);
  });
  test('ภาษาไม่เว้นวรรคใช้ Intl.Segmenter ตัดตามภาษา', () => {
    const t = L.tokenize('私は学生です。', 'ja');
    expect(t.join('')).toBe('私は学生です');
    expect(t.length).toBeGreaterThan(1);
  });
  test('maxLen: ละติน ≤ 12 คำ · CJK ≤ 25 ตัวอักษร', () => {
    expect(L.lengthOk('one two three four five six seven eight nine ten eleven twelve', 'en')).toBe(true);
    expect(L.lengthOk('one two three four five six seven eight nine ten eleven twelve thirteen', 'en')).toBe(false);
    expect(L.lengthOk('あ'.repeat(25), 'ja')).toBe(true);
    expect(L.lengthOk('あ'.repeat(26), 'ja')).toBe(false);
  });
});

test.describe('kaikki (Wiktionary JSONL)', () => {
  const entry = {
    word: 'Water', lang_code: 'en', pos: 'noun',
    senses: [{ glosses: ['A transparent liquid.'] }],
    sounds: [{ tags: ['US'] }, { ipa: '/ˈwɔtɚ/' }],
    translations: [{ code: 'fr', word: 'eau' }, { code: 'th', lang: 'Thai', word: 'น้ำ' }, { code: 'th', word: 'วารี' }],
  };
  test('ดึงคำแปลไทยตัวแรก + IPA + gloss อังกฤษ', () => {
    const r = L.parseKaikkiLine(JSON.stringify(entry));
    expect(r).toEqual({ id: 'water', th: 'น้ำ', ipa: '/ˈwɔtɚ/', gloss: 'A transparent liquid.' });
  });
  test('ไม่มีคำแปลไทย → th ว่าง แต่ยังมี gloss', () => {
    const r = L.parseKaikkiLine(JSON.stringify({ word: 'cat', senses: [{ glosses: ['A feline.'] }] }));
    expect(r.th).toBe('');
    expect(r.gloss).toBe('A feline.');
  });
  test('บรรทัดเสีย/ว่าง/ไม่มี word = null (ไม่ throw)', () => {
    expect(L.parseKaikkiLine('')).toBeNull();
    expect(L.parseKaikkiLine('{not json')).toBeNull();
    expect(L.parseKaikkiLine('{"x":1}')).toBeNull();
  });
  test('หลายรายการของคำเดียวกัน: เก็บค่าแรกที่ไม่ว่างของแต่ละช่อง', () => {
    const m = new Map();
    L.mergeKaikki(m, { id: 'bank', th: '', ipa: '', gloss: 'A shore.' });
    L.mergeKaikki(m, { id: 'bank', th: 'ธนาคาร', ipa: '/bæŋk/', gloss: 'Money place.' });
    expect(m.get('bank')).toEqual({ id: 'bank', th: 'ธนาคาร', ipa: '/bæŋk/', gloss: 'A shore.' });
  });
});

test.describe('Tatoeba', () => {
  test('parseSentenceLine: id\\tlang\\ttext', () => {
    expect(L.parseSentenceLine('1276\teng\tLet\'s try something.')).toEqual({ id: 1276, lang: 'eng', text: "Let's try something." });
    expect(L.parseSentenceLine('x\teng\ty')).toBeNull();
    expect(L.parseSentenceLine('5\teng')).toBeNull();
  });
  test('parseLinkLine: id\\tid', () => {
    expect(L.parseLinkLine('10\t20')).toEqual([10, 20]);
    expect(L.parseLinkLine('a\tb')).toBeNull();
  });
  test('parseAudioLine: อนุญาตเฉพาะ license ที่ระบุเป็นรายการ (CC BY…), ปฏิเสธ NC/ND/ว่าง', () => {
    expect(L.parseAudioLine('1276\t55\tbob\tCC BY 4.0\thttp://x')).toBe(1276);
    expect(L.parseAudioLine('1277\t56\tamy\tCC BY-NC 4.0\thttp://x')).toBeNull();
    expect(L.parseAudioLine('1278\t57\tzed\tCC BY-ND 4.0\t')).toBeNull();
    expect(L.parseAudioLine('1279\t58\tnoone\t\t')).toBeNull();
    expect(L.parseAudioLine('1280\t59\tsa\tCC BY-SA 4.0\t')).toBe(1280);
    expect(L.parseAudioLine('1281\t60\tc0\tCC0 1.0\t')).toBe(1281);
  });
});

test.describe('buildPack', () => {
  const freq = L.parseFreq(['the 100', 'cat 90', 'sat 80', 'on 70', 'mat 60', 'tom 55', 'dog 50', 'zzz 1']);
  const kaikki = new Map([
    ['the', { id: 'the', th: '', ipa: '/ðə/', gloss: 'Definite article.' }],
    ['cat', { id: 'cat', th: 'แมว', ipa: '/kæt/', gloss: 'A feline.' }],
    ['sat', { id: 'sat', th: 'นั่ง', ipa: '', gloss: '' }],
    ['on', { id: 'on', th: 'บน', ipa: '', gloss: '' }],
    ['mat', { id: 'mat', th: 'เสื่อ', ipa: '', gloss: '' }],
    ['dog', { id: 'dog', th: 'หมา', ipa: '', gloss: '' }],
  ]);
  const cands = [
    { id: 11, text: 'The cat sat on the mat.', en: 'The cat sat on the mat.', th: 'แมวนั่งบนเสื่อ', au: true },
    { id: 12, text: 'Tom saw the dog.', en: 'Tom saw the dog.', th: '', au: false }, // tom ถูกตัดด้วย stop + saw ไม่มีในรายการ
    { id: 13, text: 'The dog sat.', en: 'The dog sat.', th: '', au: false },
    { id: 14, text: 'The zzz cat.', en: 'The zzz cat.', th: '', au: false },
    { id: 15, text: 'The cat sat on the mat.', en: 'dup', th: '', au: false }, // ข้อความซ้ำ
    { id: 16, text: 'The cat', en: '', th: '', au: false }, // ไม่มีคำแปลเลย
  ];
  const base = { lang: 'lang-en', code: 'en', freq, stop: new Set(['tom']), kaikki, candidates: cands, src: { freq: 'FrequencyWords@abc1234', tatoeba: '2026-11-26', wikt: 'kaikki 2026-11-26' } };

  test('คำ: ตัดคำใน stop, เรียงตามอันดับ, th/ipa/lv, gloss เฉพาะเมื่อไม่มี th', () => {
    const p = L.buildPack(base);
    expect(p.v).toBe(2);
    expect(p.lang).toBe('lang-en');
    expect(p.w.map((x) => x.id)).toEqual(['the', 'cat', 'sat', 'on', 'mat', 'dog']);
    expect(p.w.find((x) => x.id === 'tom')).toBeUndefined();
    const the = p.w.find((x) => x.id === 'the');
    expect(the).toEqual({ id: 'the', r: 1, g: 'Definite article.', ipa: '/ðə/' }); // th ว่าง = ไม่มีช่อง, ไม่มี lv
    const cat = p.w.find((x) => x.id === 'cat');
    expect(cat).toEqual({ id: 'cat', r: 2, th: 'แมว', ipa: '/kæt/' });
    expect(cat.g).toBeUndefined();
  });
  test('คำที่ไม่มีคำแปลและไม่มี gloss ถูกตัด เมื่อมี kaikki', () => {
    const p = L.buildPack(base);
    expect(p.w.find((x) => x.id === 'zzz')).toBeUndefined();
  });
  test('ไม่มี kaikki: เก็บทุกคำที่ไม่ติด stop (th ว่าง)', () => {
    const p = L.buildPack({ ...base, kaikki: null });
    expect(p.w.map((x) => x.id)).toEqual(['the', 'cat', 'sat', 'on', 'mat', 'dog', 'zzz']);
    expect(p.w[0]).toEqual({ id: 'the', r: 1 });
  });
  test('ประโยค: ทุกคำต้องอยู่ในรายการคำที่เก็บ · ไม่ซ้ำข้อความ · ต้องมีคำแปล · แท็ก au/lv/w', () => {
    const p = L.buildPack(base);
    expect(p.s.map((x) => x.id).sort((a, b) => a - b)).toEqual([11, 13]);
    const s = p.s.find((x) => x.id === 11);
    expect(s).toEqual({ id: 11, t: 'The cat sat on the mat.', th: 'แมวนั่งบนเสื่อ', lv: 1, au: 1 }); // en = ข้อความเอง ไม่เขียนซ้ำ, ไม่มี w
    expect(p.s.find((x) => x.id === 13)).toEqual({ id: 13, t: 'The dog sat.', lv: 1 });
    expect(p.s.some((x) => 'w' in x || 'n' in x)).toBe(false);
  });
  test('เพดานคำ/ประโยค', () => {
    const p = L.buildPack({ ...base, caps: { words: 3, sentences: 1 } });
    expect(p.w.length).toBe(3);
    expect(p.s.length).toBeLessThanOrEqual(1);
  });
  test('ระดับของประโยค = ระดับของคำที่ยากที่สุด', () => {
    const lines = [];
    const nm = (i) => 'w' + String.fromCharCode(97 + Math.floor(i / 26) % 26) + String.fromCharCode(97 + (i % 26));
    for (let i = 1; i <= 600; i++) lines.push(nm(i) + ' ' + (1000 - i));
    lines.push('hard 1');
    const f2 = L.parseFreq(lines);
    const p = L.buildPack({ ...base, freq: f2, kaikki: null, stop: new Set(), candidates: [{ id: 1, text: nm(1) + ' ' + nm(600) + ' hard', en: 'x', th: '', au: false }], caps: { words: 3000, sentences: 10 } });
    expect(p.s[0].lv).toBe(2); // hard = อันดับ 601 → lv 2
  });
  test('ผลคงที่: เรียก 2 ครั้ง = JSON เดียวกัน และชื่อไฟล์ตาม hash เนื้อหา', () => {
    const a = L.buildPack(base), b = L.buildPack(base);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const ba = L.packBytes(a), bb = L.packBytes(b);
    expect(ba.gz.equals(bb.gz)).toBe(true); // gzip ซ้ำได้ไบต์เดิม
    expect(ba.gz[9]).toBe(3);
    expect(require('zlib').gunzipSync(ba.gz).toString()).toBe(JSON.stringify(a));
    expect(ba.gz.length).toBeLessThan(ba.raw.length + 40);
    const ha = L.packFileName('lang-en', a);
    expect(ha).toMatch(/^lang-en-[0-9a-f]{8}\.json\.gz$/);
    const c = L.buildPack({ ...base, caps: { words: 2, sentences: 1 } });
    expect(L.packFileName('lang-en', c)).not.toBe(ha);
  });
});

test.describe('build.mjs (CLI) บนไฟล์ดิบจำลอง', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'langdata-'));
  const w = (n, s) => { const p = path.join(tmp, n); fs.writeFileSync(p, s); return p; };

  test('สร้าง pack + index.json จากไฟล์ดิบ แล้วรันซ้ำได้ไฟล์เดิม', () => {
    const freq = w('en_50k.txt', ['the 100', 'cat 90', 'sat 80', 'on 70', 'mat 60', 'dog 50'].join('\n') + '\n');
    const sent = w('sentences.tsv', [
      "1\teng\tThe cat sat on the mat.",
      "2\tthb\tignored",
      "3\ttha\tแมวนั่งบนเสื่อ",
      "4\teng\tThe dog sat.",
      "5\tfra\tLe chat.",
      "6\teng\tTom ran.",
    ].join('\n') + '\n');
    const links = w('links.tsv', ['1\t3', '3\t1', '4\t1'].join('\n') + '\n');
    const audio = w('audio.tsv', ['1\t9\tbob\tCC BY 4.0\t\\N', '4\t10\tamy\tCC BY-NC 4.0\t\\N'].join('\n') + '\n');
    const kaikki = w('kaikki.jsonl', [
      JSON.stringify({ word: 'cat', senses: [{ glosses: ['A feline.'] }], translations: [{ code: 'th', word: 'แมว' }] }),
      JSON.stringify({ word: 'the', senses: [{ glosses: ['Article.'] }] }),
      JSON.stringify({ word: 'sat', senses: [{ glosses: ['Past of sit.'] }] }),
      JSON.stringify({ word: 'on', senses: [{ glosses: ['Atop.'] }] }),
      JSON.stringify({ word: 'mat', senses: [{ glosses: ['A rug.'] }] }),
      JSON.stringify({ word: 'dog', senses: [{ glosses: ['A canine.'] }] }),
    ].join('\n') + '\n');
    const out = path.join(tmp, 'out');
    const args = [BUILD, '--lang', 'lang-en', '--freq', freq, '--sentences', sent, '--links', links, '--audio', audio, '--kaikki', kaikki,
      '--out', out, '--freq-commit', 'abc1234', '--tatoeba-date', '2026-11-26', '--wikt-date', '2026-11-26'];
    const run = () => execFileSync('node', args, { encoding: 'utf8', cwd: tmp });
    const log = run();
    expect(log).toMatch(/lang-en/);
    const idx = JSON.parse(fs.readFileSync(path.join(out, 'index.json'), 'utf8'));
    expect(idx.v).toBe(1);
    const e = idx.packs['lang-en'];
    expect(e.words).toBe(6);
    expect(e.sentences).toBe(2); // ประโยค 1 และ 4 (อังกฤษ: en = ข้อความเอง, th เฉพาะที่มีลิงก์ไทย)
    const gzBuf = fs.readFileSync(path.join(out, e.file));
    expect(e.bytes).toBe(gzBuf.length);
    const pack = JSON.parse(require('zlib').gunzipSync(gzBuf).toString('utf8'));
    expect(e.raw).toBe(Buffer.byteLength(JSON.stringify(pack)));
    expect(pack.src).toEqual({ freq: 'FrequencyWords@abc1234', tatoeba: '2026-11-26', wikt: 'kaikki 2026-11-26' });
    const s1 = pack.s.find((x) => x.id === 1);
    expect(s1.th).toBe('แมวนั่งบนเสื่อ');
    expect(s1.au).toBe(1);
    expect(pack.v).toBe(2);
    expect(pack.s.find((x) => x.id === 6)).toBeUndefined(); // Tom ran. มีคำนอกรายการ
    run();
    const idx2 = JSON.parse(fs.readFileSync(path.join(out, 'index.json'), 'utf8'));
    expect(idx2.packs['lang-en'].file).toBe(e.file);
    expect(fs.readdirSync(out).filter((f) => f.startsWith('lang-en-')).length).toBe(1);
  });

  test('ไม่มีไฟล์ความถี่ = ออกด้วยรหัสไม่ใช่ 0 และไม่สร้างไฟล์', () => {
    const out = path.join(tmp, 'out2');
    let code = 0;
    try { execFileSync('node', [BUILD, '--lang', 'lang-en', '--freq', path.join(tmp, 'nope.txt'), '--out', out], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    expect(code).not.toBe(0);
    expect(fs.existsSync(out) ? fs.readdirSync(out).length : 0).toBe(0);
  });

  test('ภาษาที่ไม่มีข้อมูลต้นทาง (lang-yue ไม่มี FrequencyWords) = ออก 2 พร้อมข้อความ ไม่แต่งข้อมูล', () => {
    let code = 0, msg = '';
    try { execFileSync('node', [BUILD, '--lang', 'lang-yue', '--out', path.join(tmp, 'out3')], { stdio: 'pipe' }); } catch (e) { code = e.status; msg = String(e.stderr); }
    expect(code).toBe(2);
    expect(msg).toMatch(/lang-yue/);
  });
});
