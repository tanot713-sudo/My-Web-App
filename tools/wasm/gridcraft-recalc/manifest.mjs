// vendor/gridcraft/manifest.json — sha256 ของทุกไฟล์ในโฟลเดอร์ + ที่มา (tests/repo-guards.mjs ตรวจ sha256 ให้ตรง)
// node manifest.mjs <out> <rev> <rustc> <wasm-bindgen> [wasm-opt]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [out, rev, rustc, wbg, opt] = process.argv.slice(2);
const files = {};
for (const f of fs.readdirSync(out).filter((x) => x !== 'manifest.json').sort()) {
  const b = fs.readFileSync(path.join(out, f));
  const e = { sha256: crypto.createHash('sha256').update(b).digest('hex'), bytes: b.length };
  if (/\.(wasm|js)$/.test(f)) e.brotli = zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
  files[f] = e;
}
const m = {
  source: 'https://github.com/storytold/gridcraft',
  commit: rev,
  crates: ['gridcraft-xlsx', 'gridcraft-calc'],
  wrapper: 'tools/wasm/gridcraft-recalc',
  rustc,
  wasmBindgen: wbg,
  wasmOpt: opt || null,
  files,
};
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
