// ตัวตรวจกฎของ repo (ไม่ต้องใช้เบราว์เซอร์) — รัน: node tests/repo-guards.mjs (หรือ npm run guards ใน tests/)
//  1. แก้ไฟล์ที่ sw.js เสิร์ฟแบบ cache-first แล้วต้อง bump CACHE  (เทียบกับ GUARD_BASE, ค่าเริ่มต้น origin/main)
//  2. ทุกไฟล์ใน PRECACHE ต้องมีจริง
//  3. ไม่มีไฟล์ที่ track ใหญ่เกิน 25 MiB (ลิมิตของ Cloudflare Pages)
//  4. languages.compiled.js ต้องตรงกับที่ build จาก languages.jsx
//  5. CDN/vendor ที่ใช้ต้องมีใน credits.html
//  6. ห้ามมี package.json ที่ root (Pages จะรัน npm install ทุก build)
//  7. ทุกหน้าที่ใช้ theme.css โหลด theme-boot.js ก่อน
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });

const failures = [];
const fail = (guard, msg) => failures.push(`[${guard}] ${msg}`);
const ok = (guard, msg) => console.log(`ok   [${guard}] ${msg}`);
const warn = (guard, msg) => console.log(`skip [${guard}] ${msg}`);

const tracked = git('ls-files', '-z').split('\0').filter(Boolean);

/* ── 6. ห้าม package.json ที่ root ── */
if (fs.existsSync(path.join(ROOT, 'package.json')) || fs.existsSync(path.join(ROOT, 'package-lock.json'))) {
  fail('no-root-package', 'มี package.json/package-lock.json ที่ root — Cloudflare Pages จะรัน npm install ทุก build ให้ย้ายไปไว้ใน tests/');
} else ok('no-root-package', 'ไม่มี package.json ที่ root');

/* ── 2. PRECACHE มีจริง ── */
const swSrc = read('sw.js');
const precacheBlock = swSrc.match(/const PRECACHE = \[([\s\S]*?)\n\];/);
const precache = precacheBlock ? [...precacheBlock[1].replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
if (!precache.length) fail('precache', 'อ่าน PRECACHE จาก sw.js ไม่ได้');
const missing = precache.filter((u) => {
  const p = u.replace(/^\.\//, '').split(/[?#]/)[0];
  return p !== '' && !fs.existsSync(path.join(ROOT, p));
});
if (missing.length) fail('precache', `ไฟล์ใน PRECACHE ไม่มีจริง: ${missing.join(', ')}`);
else ok('precache', `${precache.length} รายการมีครบ`);

/* ── 3. ขนาดไฟล์ ── */
const LIMIT = 25 * 1024 * 1024;
const big = tracked.filter((f) => fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).size > LIMIT);
if (big.length) fail('file-size', `เกิน 25 MiB: ${big.join(', ')}`);
else ok('file-size', 'ไม่มีไฟล์เกิน 25 MiB');

/* ── 4. languages.compiled.js ตรงกับ .jsx ── */
try {
  const { transformSync } = await import('esbuild');
  const out = transformSync(read('languages.jsx'), {
    loader: 'jsx', jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
    target: 'es2019', format: 'iife',
  }).code;
  // เทียบโดยตัดช่องว่างทิ้ง: esbuild ต่างเวอร์ชันจัดรูปโค้ดต่างกันเล็กน้อยแต่ความหมายเหมือนกัน
  const squash = (t) => t.replace(/\s+/g, '');
  if (squash(out) !== squash(read('languages.compiled.js'))) {
    fail('languages-compiled', 'languages.compiled.js ไม่ตรงกับ languages.jsx — รัน ./build-languages.sh แล้ว commit คู่กัน');
  } else ok('languages-compiled', 'ตรงกับ languages.jsx');
} catch (e) {
  if (e && e.code === 'ERR_MODULE_NOT_FOUND') warn('languages-compiled', 'ไม่มี esbuild (รัน npm install ใน tests/ ก่อน)');
  else fail('languages-compiled', 'ตรวจไม่ได้: ' + e.message);
}

/* ── 5. credits.html ── */
const credits = read('credits.html').toLowerCase();
// ช่องโหว่เดิมที่มีอยู่ก่อนเพิ่มตัวตรวจ — รอเจ้าของเติมใน credits.html แล้วค่อยลบออกจากลิสต์นี้ (ห้ามเพิ่มรายการใหม่ที่นี่)
const CREDITS_BASELINE = new Set([
  'onnxruntime-web', 'opencascade.js', 'react', 'react-dom', '@babel/standalone', 'tailwindcss',
  'codemirror', 'hanzi-writer', '@k1low/hanzi-writer-data-jp', 'frappe-gantt', 'pyodide', 'luckyexcel', 'planegcs',
]);
const used = new Set();
for (const f of tracked.filter((f) => /^[^/]+\.(html|js|jsx)$/.test(f) && f !== 'languages.compiled.js')) {
  const text = read(f);
  for (const m of text.matchAll(/https:\/\/(?:cdn\.jsdelivr\.net\/npm|unpkg\.com)\/((?:@[\w.-]+\/)?[\w.-]+)/g)) used.add(m[1]);
  for (const m of text.matchAll(/https:\/\/cdn\.tailwindcss\.com/g)) used.add('tailwindcss');
  for (const m of text.matchAll(/https:\/\/cdn\.jsdelivr\.net\/(pyodide)\//g)) used.add(m[1]);
}
for (const f of tracked) {
  const m = f.match(/^vendor\/([^/]+)/);
  if (m) used.add(m[1].replace(/\.(min\.)?js$/, '').replace(/\.standalone$/, ''));
}
const ALIAS = { 'pdfjs-dist': 'pdf.js' };
const notCredited = [...used].filter((n) => !credits.includes((ALIAS[n] || n).toLowerCase().replace(/^@[^/]+\//, '')) && !CREDITS_BASELINE.has(n));
if (notCredited.length) fail('credits', `ไลบรารีที่ใช้แต่ไม่มีใน credits.html: ${notCredited.join(', ')}`);
else ok('credits', `${used.size} ไลบรารีมีใน credits.html (หรืออยู่ใน baseline)`);

/* ── 7. ทุกหน้าที่ใช้ theme.css ต้องโหลด theme-boot.js ก่อน (ไม่ defer) — ไม่งั้นจอกะพริบ และ shell.js ไม่มี OmeTheme ── */
{
  const bad = tracked.filter((f) => /^[^/]+\.html$/.test(f)).filter((f) => {
    const h = read(f);
    const css = h.indexOf('href="theme.css"');
    if (css < 0) return false;
    const boot = h.search(/<script src="theme-boot\.js"><\/script>/);
    return boot < 0 || boot > css;
  });
  if (bad.length) fail('theme-boot', `ไม่มี <script src="theme-boot.js"></script> ก่อน theme.css: ${bad.join(', ')}`);
  else ok('theme-boot', 'ทุกหน้าที่ใช้ theme.css โหลด theme-boot.js ก่อน');
}

/* ── 1. bump CACHE ── */
{
  const base = process.env.GUARD_BASE || 'origin/main';
  let baseSha = '';
  try { baseSha = git('rev-parse', '--verify', '--quiet', base + '^{commit}').trim(); } catch (e) {}
  if (!baseSha || /^0+$/.test(baseSha)) warn('cache-bump', `ไม่พบ base ref "${base}" — ข้าม`);
  else {
    const changed = git('diff', '--name-only', '-z', baseSha, 'HEAD').split('\0').filter(Boolean)
      // เฉพาะไฟล์ที่ผู้ใช้โหลดผ่าน sw.js (root + vendor) — ไม่นับ tests/ functions/ docs/ ฯลฯ
      .filter((f) => /^(?:[^/]+\.(?:html|js|css|json|svg|png)|vendor\/.+)$/.test(f) && f !== 'sw.js' && fs.existsSync(path.join(ROOT, f)));
    if (!changed.length) ok('cache-bump', 'ไม่มีไฟล์ที่ผู้ใช้โหลดเปลี่ยน');
    else {
      const cacheOf = (src) => (src.match(/const CACHE = '([^']+)'/) || [])[1];
      let baseSw = '';
      try { baseSw = git('show', `${baseSha}:sw.js`); } catch (e) {}
      const before = cacheOf(baseSw), after = cacheOf(swSrc);
      if (before && before === after) {
        fail('cache-bump', `แก้ ${changed.length} ไฟล์ที่ผู้ใช้โหลด (เช่น ${changed.slice(0, 3).join(', ')}) แต่ยังไม่ bump CACHE ใน sw.js (ยัง ${after}) — ผู้ใช้เดิมจะได้โค้ดเก่าค้าง`);
      } else ok('cache-bump', `CACHE ${before} → ${after}`);
    }
  }
}

if (failures.length) {
  console.error('\n' + failures.join('\n'));
  process.exit(1);
}
console.log('\nrepo-guards: ผ่านทั้งหมด');
