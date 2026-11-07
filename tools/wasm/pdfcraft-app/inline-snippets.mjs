// รวมไฟล์ snippets/*.js ที่ wasm-bindgen แยกออกมา (inline JS ของ crate เช่น eframe) เข้าไปในไฟล์ glue ไฟล์เดียว
// เหตุผล: craft-frame.js import glue จาก Blob URL (ตรวจ sha256 แล้ว) ซึ่ง resolve "./snippets/…" ไม่ได้
// node inline-snippets.mjs <outDir ของ wasm-bindgen> <ชื่อ glue.js> — เขียนทับ glue · snippet ต้องมีแค่ export function/const
import fs from 'node:fs';
import path from 'node:path';

const [dir, name] = process.argv.slice(2);
const gluePath = path.join(dir, name);
let glue = fs.readFileSync(gluePath, 'utf8');
const mods = new Map(); // path → ชื่อตัวแปร
const re = /^import (\* as (\w+)|\{([^}]*)\}) from (['"])(\.\/snippets\/[^'"]+)\4;?[ \t]*$/gm;
let out = glue.replace(re, (all, _, star, names, q, rel) => {
  if (!mods.has(rel)) mods.set(rel, '__snip' + mods.size);
  const v = mods.get(rel);
  return star ? `const ${star} = ${v};` : `const {${names}} = ${v};`;
});
if (/^\s*import\s/m.test(out) || /from\s+['"]\.\/snippets\//.test(out)) throw new Error('glue ยังมี import ที่รวมไม่ได้');
const pre = [];
for (const [rel, v] of mods) {
  const src = fs.readFileSync(path.join(dir, rel), 'utf8');
  const exported = [];
  const body = src.replace(/^export (function|const|let|class) (\w+)/gm, (m, kind, id) => { exported.push(id); return `${kind} ${id}`; });
  if (/^\s*(export|import)\s/m.test(body)) throw new Error(`${rel}: มี export/import แบบที่รวมไม่ได้`);
  pre.push(`// ${rel}\nconst ${v} = (function () {\n${body.trimEnd()}\nreturn Object.freeze({ ${exported.join(', ')} });\n})();`);
}
fs.writeFileSync(gluePath, (pre.length ? pre.join('\n') + '\n' : '') + out);
