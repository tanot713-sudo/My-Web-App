// ลงทะเบียน CADCraft แบบโปรแกรมเต็ม (libs["cadcraft-app"]) ใน vendor/craft/manifest.json — ดู CLAUDE.md "ไลบรารี wasm ตระกูล *Craft"
// sha256 + ขนาดของทุกไฟล์ในโฟลเดอร์ + ที่มา · tests/repo-guards.mjs ตรวจให้ตรง และห้ามแก้ไฟล์ใต้ path เดิม (เปลี่ยนรุ่น = โฟลเดอร์ใหม่)
// node manifest.mjs <root> <libDir> <wasm ทั้งก้อน> <rev> <fontsRev> <version> <rustc> <wasm-bindgen> [wasm-opt]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [root, out, whole, rev, fontsRev, version, rustc, wbg, opt] = process.argv.slice(2);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const br = (b) => zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const wb = fs.readFileSync(whole);
// wasm เกิน 24 MiB ถูกแบ่งเป็น cadcraft_app_bg.<n>.wasm (sha256/bytes ที่นี่ = ของทั้งก้อน) · ไม่เกิน = ไฟล์เดียว ไม่มี parts
const parts = fs.readdirSync(out).filter((f) => /^cadcraft_app_bg\.\d+\.wasm$/.test(f)).sort((a, b) => parseInt(a.split('.')[1], 10) - parseInt(b.split('.')[1], 10));
const files = {};
for (const f of fs.readdirSync(out).sort()) {
  const b = fs.readFileSync(path.join(out, f));
  const e = { sha256: sha(b), bytes: b.length };
  if (/\.(wasm|js)$/.test(f)) e.brotli = br(b);
  files[f] = e;
}
const manPath = path.join(root, 'vendor', 'craft', 'manifest.json');
let man = { v: 1, libs: {} };
try { man = JSON.parse(fs.readFileSync(manPath, 'utf8')); } catch (e) {}
man.libs = man.libs || {};
man.libs['cadcraft-app'] = {
  name: 'CADCraft',
  dir: path.relative(root, out).split(path.sep).join('/'),
  source: 'https://github.com/storytold/cadcraft',
  commit: rev,
  version,
  license: 'MIT OR Apache-2.0',
  licenseFile: 'LICENSE-MIT',
  app: 'apps/cadcraft-web',
  patches: fs.readdirSync(path.join(root, 'tools/wasm/cadcraft-app/patches')).filter((f) => f.endsWith('.patch')).sort(),
  buildLabel: 'tanot',
  fonts: { source: 'https://github.com/storytold/craft-fonts', commit: fontsRev, license: 'OFL-1.1' },
  wrapper: 'tools/wasm/cadcraft-app',
  rustc,
  wasmBindgen: wbg,
  wasmOpt: opt || null,
  ...(parts.length ? { wasm: { parts, sha256: sha(wb), bytes: wb.length, brotli: br(wb) } } : {}),
  files,
};
fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n');
