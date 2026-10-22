// THIRD-PARTY.txt ของ vendor/gridcraft — license ของทุก crate ที่ลิงก์เข้า .wasm (dependency ปกติบน wasm32 ไม่นับ proc-macro/build/dev)
// GridCraft เอง = LICENSE-MIT ข้างกัน · เรียกจาก build.sh: node third-party.mjs > THIRD-PARTY.txt
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const meta = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--locked', '--filter-platform', 'wasm32-unknown-unknown'], { cwd: here, maxBuffer: 64 << 20 }));
const pkgs = new Map(meta.packages.map((p) => [p.id, p]));
const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
const isMacro = (p) => p.targets.some((t) => t.kind.includes('proc-macro'));

const seen = new Set();
const stack = [meta.resolve.root];
while (stack.length) {
  const id = stack.pop();
  if (seen.has(id)) continue;
  seen.add(id);
  for (const d of nodes.get(id).deps) {
    if (!d.dep_kinds.some((k) => k.kind === null)) continue;
    if (isMacro(pkgs.get(d.pkg))) continue;
    stack.push(d.pkg);
  }
}

// "A OR B" = เลือกได้ (ใช้ MIT เมื่อมีให้เลือก) · "X AND Y" = ต้องครบทุกส่วน → คืนรายการ license ที่ใช้
function chosen(expr) {
  return String(expr || '').split(/\s+AND\s+/).map((term) => {
    const alts = term.replace(/[()]/g, '').split(/\s+OR\s+|\//).map((s) => s.trim());
    return alts.includes('MIT') ? 'MIT' : alts[0];
  });
}
const FILE_OF = { MIT: /MIT/i, 'Apache-2.0': /APACHE|NOTICE/i, 'Unicode-3.0': /UNICODE/i };
function licenseFiles(dir, lics) {
  const all = fs.readdirSync(dir).filter((f) => /^(LICEN[CS]E|COPYING|UNLICENSE|NOTICE)/i.test(f)).sort();
  const want = new Set();
  for (const l of lics) {
    const hit = FILE_OF[l] ? all.filter((f) => FILE_OF[l].test(f)) : [];
    // ไม่มีไฟล์แยกตามชื่อ license (เช่น zlib-rs มีแค่ LICENSE) = ใช้ไฟล์ที่ไม่ได้เป็นของ license อื่น
    (hit.length ? hit : all.filter((f) => !/MIT|APACHE|UNLICENSE|UNICODE/i.test(f))).forEach((f) => want.add(f));
  }
  return [...want].map((f) => path.join(dir, f));
}

const list = [...seen].map((id) => pkgs.get(id)).filter((p) => !/^gridcraft-/.test(p.name)).sort((a, b) => a.name.localeCompare(b.name));
const out = [
  'Third-party software in gridcraft_recalc_bg.wasm',
  'Crates linked into the WebAssembly build (normal dependencies on wasm32-unknown-unknown; proc-macros and build tools are not shipped).',
  'GridCraft itself: see LICENSE-MIT. Where a crate offers a choice of licenses, it is used under the one marked "used under".',
  '',
];
for (const p of list) {
  const lic = chosen(p.license);
  out.push('='.repeat(78), `${p.name} ${p.version}`, `License: ${p.license}  (used under ${lic.join(' AND ')})`);
  if (p.repository) out.push(`Source: ${p.repository}`);
  out.push('-'.repeat(78));
  const files = licenseFiles(path.dirname(p.manifest_path), lic);
  if (!files.length) throw new Error(`no license file for ${p.name} ${p.version}`);
  for (const f of files) out.push(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').trimEnd(), '');
}
process.stdout.write(out.join('\n') + '\n');
