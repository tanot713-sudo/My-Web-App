// ลงทะเบียน PdfCraft ใน vendor/craft/manifest.json (manifest กลางของไลบรารี wasm ตระกูล *Craft — ดู CLAUDE.md "ไลบรารี wasm ตระกูล *Craft")
// sha256 + ขนาดของทุกไฟล์ในโฟลเดอร์ + ที่มา · tests/repo-guards.mjs ตรวจให้ตรง และห้ามแก้ไฟล์ใต้ path เดิม (เปลี่ยนรุ่น = โฟลเดอร์ใหม่)
// node manifest.mjs <root> <libDir> <rev> <rustc> <wasm-bindgen> [wasm-opt]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [root, out, rev, rustc, wbg, opt] = process.argv.slice(2);
const files = {};
for (const f of fs.readdirSync(out).sort()) {
  const b = fs.readFileSync(path.join(out, f));
  const e = { sha256: crypto.createHash('sha256').update(b).digest('hex'), bytes: b.length };
  if (/\.(wasm|js)$/.test(f)) e.brotli = zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
  files[f] = e;
}
const manPath = path.join(root, 'vendor', 'craft', 'manifest.json');
let man = { v: 1, libs: {} };
try { man = JSON.parse(fs.readFileSync(manPath, 'utf8')); } catch (e) {}
man.libs = man.libs || {};
man.libs.pdfcraft = {
  name: 'PdfCraft',
  dir: path.relative(root, out).split(path.sep).join('/'),
  source: 'https://github.com/storytold/pdfcraft',
  commit: rev,
  license: 'MIT OR Apache-2.0',
  licenseFile: 'LICENSE-MIT',
  crates: ['pdfcraft-organize', 'pdfcraft-cos'],
  wrapper: 'tools/wasm/pdfcraft-pages',
  rustc,
  wasmBindgen: wbg,
  wasmOpt: opt || null,
  files,
};
fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n');
