// ลงทะเบียน PdfCraft แบบโปรแกรมเต็ม (libs["pdfcraft-app"]) ใน vendor/craft/manifest.json — ดู CLAUDE.md "ไลบรารี wasm ตระกูล *Craft"
// sha256 + ขนาดของทุกไฟล์ในโฟลเดอร์ + ที่มา · tests/repo-guards.mjs ตรวจให้ตรง และห้ามแก้ไฟล์ใต้ path เดิม (เปลี่ยนรุ่น = โฟลเดอร์ใหม่)
// node manifest.mjs <root> <libDir> <wasm ทั้งก้อน> <rev> <fontsRev> <i18nRev> <version> <rustc> <wasm-bindgen> [wasm-opt]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [root, out, whole, rev, fontsRev, i18nRev, version, rustc, wbg, opt] = process.argv.slice(2);
const wb = fs.readFileSync(whole);
const wasm = {
  // ลำดับส่วนที่ต่อกันแล้วได้ wasm ทั้งก้อน (sha256/bytes = ของทั้งก้อน)
  parts: fs.readdirSync(out).filter((f) => /^pdfcraft_app_bg\.\d+\.wasm$/.test(f)).sort((a, b) => parseInt(a.split('.')[1], 10) - parseInt(b.split('.')[1], 10)),
  sha256: crypto.createHash('sha256').update(wb).digest('hex'),
  bytes: wb.length,
  brotli: zlib.brotliCompressSync(wb, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
};
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
man.libs['pdfcraft-app'] = {
  name: 'PdfCraft',
  dir: path.relative(root, out).split(path.sep).join('/'),
  source: 'https://github.com/storytold/pdfcraft',
  commit: rev,
  version,
  license: 'MIT OR Apache-2.0',
  licenseFile: 'LICENSE-MIT',
  app: 'apps/pdfcraft-web',
  patches: fs.readdirSync(path.join(root, 'tools/wasm/pdfcraft-app/patches')).filter((f) => f.endsWith('.patch')).sort(),
  buildLabel: 'tanot',
  fonts: { source: 'https://github.com/storytold/craft-fonts', commit: fontsRev, license: 'OFL-1.1' },
  i18n: { source: 'https://github.com/storytold/craft-i18n', commit: i18nRev, license: 'MIT OR Apache-2.0' },
  wrapper: 'tools/wasm/pdfcraft-app',
  rustc,
  wasmBindgen: wbg,
  wasmOpt: opt || null,
  wasm,
  files,
};
fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n');
