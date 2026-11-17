#!/usr/bin/env node
/* ไลบรารี *Craft ที่เก็บใน R2 ("store": "r2" ใน vendor/craft/manifest.json — ROADMAP แถว 11f, CLAUDE.md "ไลบรารี wasm ตระกูล *Craft")
   node tools/wasm/craft-r2.mjs verify <lib>   ตรวจผล build ใน <dir>/ กับ manifest ที่ commit แล้ว (HEAD) — ชุดไฟล์ + sha256 + ขนาดต้องตรงทุกไฟล์
   node tools/wasm/craft-r2.mjs upload <lib>   verify ก่อน แล้วอัปโหลดทีละไฟล์ขึ้น R2 tanot-files/craft/<ชื่อโฟลเดอร์>/<ไฟล์> ด้วย wrangler
   • ใช้โดย .github/workflows/craft-r2-upload.yml และใช้บนเครื่องเจ้าของได้ (ทางสำรองเมื่อ runner build ไม่ไหว) — ต้องตั้ง
     CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID ใน environment (ห้ามใส่ในไฟล์/แชต)
   • ไม่ตรง manifest = ไม่อัปโหลดอะไรเลย (exit 1) · "encoding": "br" = บีบ brotli ก่อนอัปโหลด (sha256 ใน manifest = ไฟล์ก่อนบีบ)
   • ไฟล์ใน R2 ที่ path เดิมห้ามเปลี่ยนเนื้อ (เหมือน vendor/craft) — รุ่นใหม่ = โฟลเดอร์ใหม่ */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const MAN = 'vendor/craft/manifest.json';
const BUCKET = 'tanot-files';
const WRANGLER = 'wrangler@4.150.0';

export function committedManifest(root = ROOT) {
  try { return JSON.parse(execFileSync('git', ['show', 'HEAD:' + MAN], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); }
  catch (e) { return JSON.parse(fs.readFileSync(path.join(root, MAN), 'utf8')); }
}

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  }).sort();
}

/* → { L, dir, files: [{ file, abs, bytes }], bad: [ข้อความ] } */
export function verify(lib, root = ROOT, man = committedManifest(root)) {
  const bad = [];
  if (!/^[a-z0-9-]+$/.test(lib || '')) return { bad: ['ชื่อไลบรารีต้องเป็น a-z 0-9 -'] };
  const L = man.libs && Object.prototype.hasOwnProperty.call(man.libs, lib) ? man.libs[lib] : null;
  if (!L) return { bad: [`ไม่มี libs.${lib} ใน ${MAN} ที่ commit แล้ว`] };
  if (L.store !== 'r2') return { bad: [`libs.${lib} ไม่ใช่ "store": "r2"`] };
  if (!/^vendor\/craft\/[A-Za-z0-9._-]+$/.test(L.dir || '')) return { bad: [`libs.${lib}.dir ไม่ถูกรูปแบบ`] };
  const dir = path.join(root, L.dir);
  const want = Object.keys(L.files || {}).sort();
  const have = walk(dir);
  for (const f of want) if (!have.includes(f)) bad.push(`ไม่มี ${f} ในผล build`);
  for (const f of have) if (!want.includes(f)) bad.push(`ผล build มี ${f} ที่ไม่อยู่ใน manifest`);
  const files = [];
  for (const f of want) {
    if (!have.includes(f)) continue;
    const abs = path.join(dir, f), buf = fs.readFileSync(abs);
    const h = createHash('sha256').update(buf).digest('hex');
    if (h !== L.files[f].sha256) bad.push(`${f} sha256 ไม่ตรง manifest (build ซ้ำไม่ได้ไบต์เดิม?)`);
    if (buf.length !== L.files[f].bytes) bad.push(`${f} ขนาด ${buf.length} ไม่ตรง manifest ${L.files[f].bytes}`);
    files.push({ file: f, abs, bytes: buf.length });
  }
  return { L, dir, files, bad };
}

function upload(lib) {
  const r = verify(lib);
  if (r.bad.length) { console.error(r.bad.join('\n')); process.exit(1); }
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    console.error('ต้องตั้ง CLOUDFLARE_API_TOKEN และ CLOUDFLARE_ACCOUNT_ID ใน environment'); process.exit(1);
  }
  const name = r.L.dir.replace(/^vendor\/craft\//, '');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-r2-'));
  try {
    for (const f of r.files) {
      let src = f.abs;
      const args = ['--yes', WRANGLER, 'r2', 'object', 'put', `${BUCKET}/craft/${name}/${f.file}`, '--remote'];
      if (r.L.encoding === 'br') {
        src = path.join(tmp, f.file.replace(/\//g, '__') + '.br');
        fs.writeFileSync(src, zlib.brotliCompressSync(fs.readFileSync(f.abs), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_LGWIN]: 24 } }));
        args.push('--content-encoding', 'br');
      }
      args.push('--file', src);
      console.log(`→ craft/${name}/${f.file} (${(fs.statSync(src).size / 2 ** 20).toFixed(2)} MiB)`);
      execFileSync('npx', args, { cwd: tmp, stdio: 'inherit' });
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`อัปโหลด ${r.files.length} ไฟล์ของ ${lib} แล้ว`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [cmd, lib] = process.argv.slice(2);
  if (cmd === 'verify') {
    const r = verify(lib);
    if (r.bad.length) { console.error(r.bad.join('\n')); process.exit(1); }
    console.log(`${lib}: ${r.files.length} ไฟล์ตรง manifest (${(r.files.reduce((a, f) => a + f.bytes, 0) / 2 ** 20).toFixed(1)} MiB)`);
  } else if (cmd === 'upload') upload(lib);
  else { console.error('ใช้: node tools/wasm/craft-r2.mjs verify|upload <lib>'); process.exit(2); }
}
