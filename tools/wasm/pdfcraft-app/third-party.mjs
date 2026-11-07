// THIRD-PARTY.txt ของ vendor/craft/pdfcraft-app-<commit> — license ของทุก crate ที่ลิงก์เข้า .wasm ของ apps/pdfcraft-web (dependency ปกติบน wasm32 ไม่นับ proc-macro/build/dev)
// PdfCraft เอง = LICENSE-MIT ข้างกัน, ฟอนต์ craft-fonts = OFL-*.txt ข้างกัน · เรียกจาก build.sh: node third-party.mjs <ซอร์ส PdfCraft> > THIRD-PARTY.txt
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
const MIT_BODY = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
const BSD3_BODY = `Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;
const meta = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--locked', '--filter-platform', 'wasm32-unknown-unknown'], { cwd: src, maxBuffer: 64 << 20 }));
const pkgs = new Map(meta.packages.map((p) => [p.id, p]));
const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
const isMacro = (p) => p.targets.some((t) => t.kind.includes('proc-macro'));

const seen = new Set();
const web = meta.packages.find((p) => p.name === 'pdfcraft-web');
const stack = [web.id];
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
  const all = fs.readdirSync(dir).filter((f) => /^(LICEN[CS]E|COPYING|UNLICENSE|NOTICE)/i.test(f) && fs.statSync(path.join(dir, f)).isFile()).sort();
  const want = new Set();
  for (const l of lics) {
    const hit = FILE_OF[l] ? all.filter((f) => FILE_OF[l].test(f)) : [];
    // ไม่มีไฟล์แยกตามชื่อ license (เช่น zlib-rs มีแค่ LICENSE) = ใช้ไฟล์ที่ไม่ได้เป็นของ license อื่น
    (hit.length ? hit : all.filter((f) => !/MIT|APACHE|UNLICENSE|UNICODE/i.test(f))).forEach((f) => want.add(f));
  }
  return [...want].map((f) => path.join(dir, f));
}

const list = [...seen].map((id) => pkgs.get(id)).filter((p) => !(meta.workspace_members.includes(p.id) && /^pdfcraft(-|$)/.test(p.name))).sort((a, b) => a.name.localeCompare(b.name));
const missing = [];
const STANDARD = {
  MIT: (who) => `MIT License\n\nCopyright (c) ${who}\n\n` + MIT_BODY,
  'Apache-2.0': () => fs.readFileSync(path.join(src, 'LICENSE-APACHE'), 'utf8').replace(/\r\n/g, '\n').trimEnd(),
  'BSD-3-Clause': (who) => `BSD 3-Clause License\n\nCopyright (c) ${who}\n\n` + BSD3_BODY,
};
const out = [
  'Third-party software in pdfcraft_app_bg.wasm',
  'Crates linked into the WebAssembly build (normal dependencies on wasm32-unknown-unknown; proc-macros and build tools are not shipped).',
  'PdfCraft itself: see LICENSE-MIT. Where a crate offers a choice of licenses, it is used under the one marked "used under".',
  '',
];
for (const p of list) {
  const lic = chosen(p.license);
  out.push('='.repeat(78), `${p.name} ${p.version}`, `License: ${p.license}  (used under ${lic.join(' AND ')})`);
  if (p.repository) out.push(`Source: ${p.repository}`);
  out.push('-'.repeat(78));
  const files = licenseFiles(path.dirname(p.manifest_path), lic);
  // ฟอนต์ที่ฝังมากับ crate (เช่น epaint_default_fonts) เก็บ license ไว้ใน fonts/
  const fdir = path.join(path.dirname(p.manifest_path), 'fonts');
  if (fs.existsSync(fdir)) for (const f of fs.readdirSync(fdir).sort()) if (/\.txt$/i.test(f)) files.push(path.join(fdir, f));
  if (files.length) {
    for (const f of files) out.push(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').trimEnd(), '');
    continue;
  }
  // แพ็กเกจของ crate ไม่มีไฟล์ license (เช่น egui, accesskit) → ข้อความมาตรฐานของ license นั้น + ผู้เขียนจาก Cargo.toml
  const who = (p.authors && p.authors.length ? p.authors.join(', ') : `the ${p.name} authors`);
  for (const l of lic) {
    const std = STANDARD[l];
    if (!std) { missing.push(`${p.name} ${p.version} (${p.license})`); continue; }
    out.push(`(The crate package ships no license file; standard ${l} text follows.)`, std(who), '');
  }
}
process.stdout.write(out.join('\n') + '\n');
if (missing.length) { process.stderr.write('missing:\n' + missing.join('\n') + '\n'); process.exit(1); }

