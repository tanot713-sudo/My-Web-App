#!/usr/bin/env node
// สร้าง lang-packs/<lang>-<hash>.json จากไฟล์ดิบที่ดาวน์โหลดเอง (ดู README.md) — ROADMAP แถว 21
// Node ล้วน ไม่มี dependency · ไม่เรียกเครือข่าย · ไม่เรียก AI (คำแปลไทยที่ขาดปล่อยว่าง ให้หน้าเว็บแปลตอนใช้)
// ใช้: node tools/lang-data/build.mjs --lang lang-en --freq en_50k.txt --sentences eng_sentences.tsv --sentences tha_sentences.tsv \
//        --links links.tsv [--audio sentences_with_audio.tsv] [--kaikki kaikki.org-dictionary-English.jsonl] \
//        --freq-commit <sha7> --tatoeba-date YYYY-MM-DD --wikt-date YYYY-MM-DD [--out lang-packs]
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const L = createRequire(import.meta.url)('./lib.js');

function parseArgs(argv) {
  const a = { sentences: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) throw new Error('อาร์กิวเมนต์ไม่รู้จัก: ' + k);
    const key = k.slice(2), v = argv[++i];
    if (v === undefined) throw new Error('ขาดค่าของ ' + k);
    if (key === 'sentences') a.sentences.push(v); else a[key] = v;
  }
  return a;
}
function die(code, msg) { process.stderr.write(msg + '\n'); process.exit(code); }

async function* lines(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const l of rl) yield l;
}

let args;
try { args = parseArgs(process.argv.slice(2)); } catch (e) { die(1, String(e.message)); }
const lang = args.lang;
const cfg = L.LANGS[lang];
if (!cfg) die(1, 'ไม่รู้จักภาษา ' + lang + ' (ต้องเป็นหนึ่งใน: ' + Object.keys(L.LANGS).join(', ') + ')');
if (!args.freq && !cfg.freq) {
  die(2, lang + ': hermitdave/FrequencyWords ไม่มีรายการความถี่ของภาษานี้ — ไม่สร้างชุดข้อมูล (ไม่แต่งข้อมูลเอง) · ถ้ามีแหล่งอื่นที่ license ตรวจแล้ว ให้ส่งด้วย --freq <ไฟล์>');
}
if (!args.freq) die(1, 'ต้องระบุ --freq <ไฟล์> (ดาวน์โหลดจาก ' + cfg.freq + ' ของ hermitdave/FrequencyWords)');
if (!fs.existsSync(args.freq)) die(1, 'ไม่พบไฟล์ความถี่: ' + args.freq);
for (const f of [...args.sentences, args.links, args.audio, args.kaikki]) if (f && !fs.existsSync(f)) die(1, 'ไม่พบไฟล์: ' + f);

const outDir = path.resolve(args.out || path.join(here, '..', '..', 'lang-packs'));

// 1) ความถี่ + รายการตัด + kaikki
const freqLines = fs.readFileSync(args.freq, 'utf8').split(/\r?\n/).slice(0, 60000);
const freq = L.parseFreq(freqLines);
const stopFile = path.join(here, 'stop', cfg.code + '.txt');
const stop = new Set(fs.existsSync(stopFile)
  ? fs.readFileSync(stopFile, 'utf8').split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter((s) => s && !s.startsWith('#'))
  : []);
let kaikki = null;
if (args.kaikki) {
  kaikki = new Map();
  for await (const l of lines(args.kaikki)) {
    const e = L.parseKaikkiLine(l);
    if (e && freq.rank.has(e.id)) L.mergeKaikki(kaikki, e);
  }
}

// 2) ประโยคตัวเลือก (3 รอบ: ประโยคเป้าหมาย → ลิงก์ → ข้อความของคู่แปล) — อ่านเป็นสตรีม ไม่โหลดไฟล์ใหญ่ทั้งไฟล์
const cands = new Map(); // id → {id,text,en,th,au,_en,_th}
for (const f of args.sentences) {
  for await (const l of lines(f)) {
    const s = L.parseSentenceLine(l);
    if (!s || s.lang !== cfg.tat || cands.has(s.id)) continue;
    if (!L.lengthOk(s.text, cfg.code)) continue;
    const toks = L.tokenize(s.text, cfg.code);
    if (!toks.length || !toks.every((t) => freq.rank.has(t) && !stop.has(t))) continue;
    cands.set(s.id, { id: s.id, text: s.text, en: cfg.tat === 'eng' ? s.text : '', th: '', au: false, _en: 0, _th: 0 });
  }
}
const partners = new Map(); // id ของคู่แปล → [id ประโยคเป้าหมาย]
if (args.links && cands.size) {
  for await (const l of lines(args.links)) {
    const p = L.parseLinkLine(l);
    if (!p) continue;
    const [a, b] = p;
    if (cands.has(a)) { if (!partners.has(b)) partners.set(b, []); partners.get(b).push(a); }
  }
  const want = { eng: cfg.tat === 'eng' ? null : 'en', tha: 'th' };
  for (const f of args.sentences) {
    for await (const l of lines(f)) {
      const s = L.parseSentenceLine(l);
      if (!s || !want[s.lang] || !partners.has(s.id)) continue;
      for (const cid of partners.get(s.id)) {
        const c = cands.get(cid), fld = want[s.lang], mark = '_' + fld;
        if (!c[mark] || s.id < c[mark]) { c[fld] = s.text; c[mark] = s.id; }
      }
    }
  }
}
if (args.audio) {
  for await (const l of lines(args.audio)) {
    const id = L.parseAudioLine(l);
    if (id !== null && cands.has(id)) cands.get(id).au = true;
  }
}

const pack = L.buildPack({
  lang, code: cfg.code, freq, stop, kaikki,
  candidates: [...cands.values()].map(({ id, text, en, th, au }) => ({ id, text, en, th, au })),
  src: {
    freq: 'FrequencyWords@' + (args['freq-commit'] || 'unknown'),
    tatoeba: args['tatoeba-date'] || '',
    wikt: args.kaikki ? 'kaikki ' + (args['wikt-date'] || 'unknown') : ''
  }
});

// 3) เขียนไฟล์ + index.json (รวมกับของเดิม ภาษาอื่นไม่ถูกแตะ)
fs.mkdirSync(outDir, { recursive: true });
const file = L.packFileName(lang, pack);
const body = JSON.stringify(pack);
fs.writeFileSync(path.join(outDir, file), body);
const idxPath = path.join(outDir, 'index.json');
const idx = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, 'utf8')) : { v: 1, packs: {} };
const old = idx.packs[lang];
if (old && old.file !== file) fs.rmSync(path.join(outDir, old.file), { force: true });
idx.packs[lang] = { file, words: pack.w.length, sentences: pack.s.length, sources: [pack.src.freq, 'Tatoeba ' + pack.src.tatoeba, pack.src.wikt].filter(Boolean) };
idx.packs = Object.fromEntries(Object.entries(idx.packs).sort(([x], [y]) => (x < y ? -1 : 1)));
fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1) + '\n');

const kb = Math.round(Buffer.byteLength(body) / 1024);
const withTh = pack.w.filter((w) => w.th).length, sTh = pack.s.filter((s) => s.th).length;
process.stdout.write(`${lang}: ${file} · คำ ${pack.w.length} (มีคำแปลไทย ${withTh}) · ประโยค ${pack.s.length} (มีคำแปลไทย ${sTh}, มีเสียง ${pack.s.filter((s) => s.au).length}) · ${kb} KB\n`);
if (kb > 700) process.stdout.write('คำเตือน: ไฟล์ใหญ่เกินเป้า ~600 KB — ลด caps หรือตรวจข้อมูลดิบ\n');
