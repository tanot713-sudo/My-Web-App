#!/usr/bin/env node
// สร้าง law-packs/<code>-<hash8>.json.gz + law-packs/index.json จาก PDF ของสำนักงานคณะกรรมการกฤษฎีกา — ROADMAP แถว 9c
// ไม่รันใน CI · ไม่เรียกเครือข่าย/AI · อ่านไฟล์ต้นฉบับอย่างเดียว · ใช้ pdfjs-dist ที่ล็อกไว้ใน tests/package.json (cd tests && npm ci)
// ใช้: node tools/law-data/build.mjs --code lawyer --pdf "E:/law/พระราชบัญญัติทนายความ พ.ศ.๒๕๒๘.pdf" \
//        [--ref thailaw.jsonl --ref-title "พระราชบัญญัติทนายความ พ.ศ. 2528"] [--as-of YYYY-MM-DD] [--appendix "อัตราค่าธรรมเนียม"] \
//        [--src "ข้อความ"] [--out law-packs] [--dry]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const req = createRequire(import.meta.url);
const L = req('./lib.js');
const LawCalc = req('../../law-calc.js');

function die(msg) { process.stderr.write(msg + '\n'); process.exit(1); }
const args = { appendix: [] };
const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) {
  const k = av[i];
  if (k === '--dry') { args.dry = true; continue; }
  if (!k.startsWith('--') || av[i + 1] === undefined) die('อาร์กิวเมนต์ไม่ถูกต้อง: ' + k);
  const key = k.slice(2), v = av[++i];
  if (key === 'appendix') args.appendix.push(v); else args[key] = v;
}
const code = args.code;
if (!LawCalc.CODES.some((c) => c.code === code)) die('--code ต้องเป็นหนึ่งใน: ' + LawCalc.CODES.map((c) => c.code).join(', '));
if (!args.pdf || !fs.existsSync(args.pdf)) die('ไม่พบไฟล์ --pdf: ' + args.pdf);
const marker = code === 'ethics' ? 'ข้อ' : 'มาตรา';
const outDir = path.resolve(args.out || path.join(root, 'law-packs'));

// pdf.js → ชิ้นข้อความพร้อมตำแหน่ง/ขนาด
let pdfjs;
for (const base of [path.join(root, 'tests'), path.join(root, '..', '..', '..', 'tests')]) {
  const p = path.join(base, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
  if (fs.existsSync(p)) { pdfjs = await import(pathToFileURL(p).href); break; }
}
if (!pdfjs) die('ไม่พบ pdfjs-dist — รัน `cd tests && npm ci` ก่อน');
const bytes = new Uint8Array(fs.readFileSync(args.pdf));
const doc = await pdfjs.getDocument({ data: bytes, verbosity: 0, useSystemFonts: false }).promise;
const pages = [];
for (let p = 1; p <= doc.numPages; p++) {
  const tc = await (await doc.getPage(p)).getTextContent();
  pages.push({ items: tc.items.map((it) => ({ str: it.str, h: it.height, x: it.transform[4], y: it.transform[5], w: it.width })) });
}

const { body, notes, bodyH } = L.documentLines(pages);
const paras = L.paragraphs(body, bodyH);
const garble = L.garbleReport(paras.map((p) => L.resolveWraps(p.text, null)).join('\n'));
if (garble.length) die('PDF นี้ฟอนต์เพี้ยน (วรรณยุกต์/สระถูกแทนด้วยอักษรอื่น) — ไม่สร้างชุด ใช้ไฟล์จากกฤษฎีกาที่คัดลอกข้อความได้ถูกต้อง:\n  ' + garble.slice(0, 8).join('\n  '));
const sections = L.splitSections(paras, notes, marker);
if (!sections.length) die('ไม่พบ ' + marker + ' ในไฟล์');
// ข้อความอ้างอิง thailaw (ถ้าให้มา): ใช้ตัดสินรอยตัดบรรทัด (resolveWraps) และยืนยันว่าทุกมาตรามีตัวอักษรตรงกันทุกตัว
let refText = null, ref = null;
if (args.ref) {
  if (!args['ref-title']) die('ต้องระบุ --ref-title คู่กับ --ref');
  const rl = readline.createInterface({ input: fs.createReadStream(args.ref), crlfDelay: Infinity });
  for await (const l of rl) { const r = JSON.parse(l); if (String(r.title).trim() === args['ref-title']) { refText = r.text; break; } }
  if (refText == null) die('ไม่พบ title ใน --ref: ' + args['ref-title']);
  ref = L.refSections(L.normalizeText(refText), marker);
}
for (const s of sections) {
  s.t = L.resolveWraps(s.t, ref && ref.has(s.n) ? ref.get(s.n) : null);
  s.b = L.resolveWraps(s.b, refText);
}
const corrections = JSON.parse(fs.readFileSync(path.join(here, 'corrections.json'), 'utf8'))[code] || [];
let fixLog;
try { fixLog = L.applyCorrections(sections, corrections); } catch (e) { die(e.message); }
const x = (args.appendix.length ? L.appendices(paras, args.appendix) : []).map((e) => ({ h: L.resolveWraps(e.h, refText), t: L.resolveWraps(e.t, refText) }));
for (const a of args.appendix) if (!x.some((e) => e.h === a)) die('ไม่พบส่วนท้าย "' + a + '"');

const asOf = args['as-of'] || L.latestGazette(notes, paras.map((p) => L.resolveWraps(p.text, null)));
const src = args.src || (path.basename(args.pdf, '.pdf') + (args.ref ? ' · ตรวจตัวอักษรทุกมาตรากับฉบับกฤษฎีกา (pythainlp/thailaw-v1.0, CC0)' : ''));
const pack = L.makePack(code, sections, { src, asOf, x });
const problems = L.checkPack(pack);

// ทุกมาตราต้องมีตัวอักษรตรงกับฉบับอ้างอิงทุกตัว ไม่นับช่องว่าง/เครื่องหมายคำพูด/เลขเชิงอรรถ
let refReport = null;
if (ref) {
  const diff = [];
  for (const s of sections) {
    const r = ref.get(s.n);
    if (r == null) { diff.push(s.n + ': ไม่มีในข้อความอ้างอิง'); continue; }
    const c = L.compareLetters(s.t, r);
    if (!c.same) diff.push(s.n + ': ต่างที่ตัวที่ ' + c.at + '\n      PDF: ' + c.ctxA + '\n      ref: ' + c.ctxB);
  }
  for (const n of ref.keys()) if (!sections.some((s) => s.n === n)) diff.push(n + ': มีในข้อความอ้างอิงแต่ไม่มีในชุด');
  refReport = { refSections: ref.size, diff };
}

const json = JSON.stringify(pack);
const gz = zlib.gzipSync(Buffer.from(json), { level: 9 });
const hash = crypto.createHash('sha256').update(json).digest('hex').slice(0, 8);
const file = code + '-' + hash + '.json.gz';
const chars = sections.reduce((a, s) => a + s.t.length, 0);
console.log(`${code}: ${sections.length} ${marker} (${sections[0].n}–${sections[sections.length - 1].n}) · ${chars} ตัวอักษร · asOf ${asOf} · ${json.length} → ${gz.length} ไบต์ gzip · ${file}`);
if (x.length) console.log('  ส่วนท้าย: ' + x.map((e) => e.h).join(', '));
for (const f of fixLog) console.log('  แก้ตามฉบับกฤษฎีกา ' + marker + ' ' + f);
if (refReport) {
  console.log(`  เทียบ thailaw: ${refReport.refSections} ${marker} · ต่าง ${refReport.diff.length}`);
  for (const d of refReport.diff) console.log('    ' + d);
}
if (problems.length) die('ไม่ผ่านการตรวจ:\n  ' + problems.join('\n  '));
if (args.dry) process.exit(0);

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (new RegExp('^' + code + '-[0-9a-f]{8}\\.json\\.gz$').test(f) && f !== file) fs.unlinkSync(path.join(outDir, f));
fs.writeFileSync(path.join(outDir, file), gz);
const idxPath = path.join(outDir, 'index.json');
const idx = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, 'utf8')) : { v: 1, packs: {} };
idx.packs[code] = { file, name: pack.name, sections: sections.length, asOf, src, bytes: gz.length, raw: json.length };
const sorted = { v: 1, packs: {} };
for (const c of LawCalc.CODES) if (idx.packs[c.code]) sorted.packs[c.code] = idx.packs[c.code];
fs.writeFileSync(idxPath, JSON.stringify(sorted, null, 1) + '\n');
console.log('  เขียน ' + path.relative(root, path.join(outDir, file)) + ' + index.json');
