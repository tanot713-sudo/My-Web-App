// สร้าง ../icons.svg (SVG sprite ของ Lucide) ใหม่ — รัน: node build-icons.mjs [ชื่อไอคอนเพิ่ม,คั่นด้วยจุลภาค]
// เก็บไอคอนเดิมทั้งหมดใน icons.svg ไว้ + เพิ่มตามที่ระบุ (ชื่อตาม lucide.dev เช่น house, trash-2) → id="i-<ชื่อ>"
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'icons.svg');
const pkgDir = path.dirname(require.resolve('lucide-static/package.json'));
const ver = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version;

const current = fs.existsSync(OUT) ? [...fs.readFileSync(OUT, 'utf8').matchAll(/<symbol id="i-([\w-]+)"/g)].map((m) => m[1]) : [];
const extra = (process.argv[2] || '').split(',').map((s) => s.trim()).filter(Boolean);
const names = [...new Set([...current, ...extra])];

let out = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n<!-- Lucide v${ver} (ISC License, https://lucide.dev) — ใช้: <svg class="ome-icon"><use href="icons.svg#i-house"/></svg> · สร้างใหม่ด้วย tests/build-icons.mjs -->\n`;
const missing = [];
for (const n of names) {
  const f = path.join(pkgDir, 'icons', n + '.svg');
  if (!fs.existsSync(f)) { missing.push(n); continue; }
  const src = fs.readFileSync(f, 'utf8');
  const body = src.slice(src.indexOf('>', src.indexOf('<svg')) + 1, src.lastIndexOf('</svg>'))
    .split('\n').map((s) => s.trim()).filter(Boolean).join('');
  out += `<symbol id="i-${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>\n`;
}
out += '</svg>\n';
if (missing.length) { console.error('ไม่พบไอคอนใน lucide-static v' + ver + ': ' + missing.join(', ')); process.exit(1); }
fs.writeFileSync(OUT, out);
console.log(`icons.svg: ${names.length} ไอคอน, ${out.length} bytes`);
