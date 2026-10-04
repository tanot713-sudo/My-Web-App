// ตัวตรวจกฎของ repo (ไม่ต้องใช้เบราว์เซอร์) — รัน: node tests/repo-guards.mjs (หรือ npm run guards ใน tests/)
//  1. แก้ไฟล์ที่ sw.js เสิร์ฟแบบ cache-first แล้วต้อง bump CACHE  (เทียบกับ GUARD_BASE, ค่าเริ่มต้น origin/main)
//  2. ทุกไฟล์ใน PRECACHE ต้องมีจริง
//  3. ไม่มีไฟล์ที่ track ใหญ่เกิน 25 MiB (ลิมิตของ Cloudflare Pages)
//  4. หน้า React 4 หน้า: *.compiled.js ตรงกับ *.jsx · react-pages.css ตรงกับ Tailwind · ไม่อ้าง CDN (Tailwind/unpkg/Babel)
//  5. CDN/vendor ที่ใช้ต้องมีใน credits.html
//  6. ห้ามมี package.json ที่ root (Pages จะรัน npm install ทุก build)
//  7. ทุกหน้าที่ใช้ theme.css โหลด theme-boot.js ก่อน
//  9. ทุกหน้าโหลด i18n.js ต่อจาก tanot-data.js (ระบบภาษากลาง)
// 10. ไอคอนแอป: ทุกหน้าลิงก์ apple-touch-icon.png + favicon-32.png, manifest มี any/maskable แยกกัน, ไฟล์มีจริง
// 11. ภาพพื้นหลังรายหน้า: ทุกกลุ่มใน theme-boot.js มีไฟล์ -light/-dark.webp และกฎใน theme.css
// 12. ตัวตรวจธีม static (theme-guards.mjs): สี hex/ปุ่มนิยามเองต่อหน้าห้ามเพิ่มจาก tests/theme-baseline.json
import fs from 'node:fs';
import os from 'node:os';
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

/* ── 4. หน้า React 4 หน้า: *.compiled.js ตรงกับ .jsx, react-pages.css ตรงกับ Tailwind ต้นฉบับ, ไม่พึ่ง CDN ── */
const REACT_PAGES = ['languages', 'legal', 'classroom-business', 'classroom-engineering'];
{
  // เทียบโดยตัดช่องว่างทิ้ง: esbuild ต่างเวอร์ชันจัดรูปโค้ดต่างกันเล็กน้อยแต่ความหมายเหมือนกัน
  const squash = (t) => t.replace(/\s+/g, '');
  const REBUILD = 'รัน ./build-react.sh แล้ว commit ไฟล์ที่คอมไพล์คู่กัน';
  try {
    const { transformSync } = await import('esbuild');
    for (const page of REACT_PAGES) {
      const out = transformSync(read(`${page}.jsx`), {
        loader: 'jsx', jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
        target: 'es2019', format: 'iife',
      }).code;
      if (squash(out) !== squash(read(`${page}.compiled.js`))) fail('react-compiled', `${page}.compiled.js ไม่ตรงกับ ${page}.jsx — ${REBUILD}`);
      else ok('react-compiled', `${page}.compiled.js ตรงกับ ${page}.jsx`);
    }
  } catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND') warn('react-compiled', 'ไม่มี esbuild (รัน npm ci ใน tests/ ก่อน)');
    else fail('react-compiled', 'ตรวจไม่ได้: ' + e.message);
  }

  const twBin = path.join(ROOT, 'tests/node_modules/.bin/tailwindcss');
  if (!fs.existsSync(twBin)) warn('react-css', 'ไม่มี tailwindcss (รัน npm ci ใน tests/ ก่อน)');
  else {
    const tmp = path.join(os.tmpdir(), `react-pages-${process.pid}.css`);
    try {
      execFileSync(twBin, ['-c', 'tests/react-build/tailwind.config.js', '-i', 'tests/react-build/input.css', '-o', tmp, '--minify'],
        { cwd: ROOT, stdio: 'pipe' });
      if (squash(fs.readFileSync(tmp, 'utf8')) !== squash(read('react-pages.css'))) fail('react-css', `react-pages.css ไม่ตรงกับที่ Tailwind คอมไพล์จาก 4 หน้า — ${REBUILD}`);
      else ok('react-css', 'react-pages.css ตรงกับต้นฉบับ');
    } catch (e) {
      fail('react-css', 'คอมไพล์ Tailwind ตรวจไม่ได้: ' + String(e.stderr || e.message).split('\n').slice(0, 3).join(' '));
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }

  const bad = [];
  for (const page of REACT_PAGES) {
    for (const f of [`${page}.html`, `${page}.jsx`]) {
      const m = read(f).match(/cdn\.tailwindcss\.com|unpkg\.com|@babel\/standalone|type="text\/babel"/);
      if (m) bad.push(`${f} (${m[0]})`);
    }
    const h = read(`${page}.html`);
    for (const need of ['href="react-pages.css"', 'src="vendor/react/react.production.min.js"', 'src="vendor/react/react-dom.production.min.js"', `src="${page}.compiled.js"`]) {
      if (!h.includes(need)) bad.push(`${page}.html ไม่มี ${need}`);
    }
    if (!/<body data-layout="(tool|reader|app)"/.test(h)) bad.push(`${page}.html ไม่มี body[data-layout]`);
  }
  if (bad.length) fail('react-no-cdn', `หน้า React ต้องไม่พึ่ง Tailwind/Babel/unpkg ตอนรัน: ${bad.join('; ')}`);
  else ok('react-no-cdn', '4 หน้าใช้ vendor/ + CSS/JS ที่คอมไพล์แล้ว ไม่มี CDN ของ Tailwind/React/Babel');
}

/* ── 5. credits.html ── */
const credits = read('credits.html').toLowerCase();
// ช่องโหว่เดิมที่มีอยู่ก่อนเพิ่มตัวตรวจ — รอเจ้าของเติมใน credits.html แล้วค่อยลบออกจากลิสต์นี้ (ห้ามเพิ่มรายการใหม่ที่นี่)
const CREDITS_BASELINE = new Set([
  'onnxruntime-web', 'opencascade.js',
  'codemirror', 'hanzi-writer', '@k1low/hanzi-writer-data-jp', 'frappe-gantt', 'pyodide', 'luckyexcel', 'planegcs',
]);
const used = new Set();
for (const f of tracked.filter((f) => /^[^/]+\.(html|js|jsx)$/.test(f) && !/\.compiled\.js$/.test(f))) {
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

/* ── 8. ทุกหน้าที่โหลด theme-boot.js ต้องโหลด data-registry.js + tanot-data.js ต่อทันที (ซิงก์ Phase 1 ดักจับ storage ก่อนสคริปต์ของหน้า) ── */
{
  const bad = tracked.filter((f) => /^[^/]+\.html$/.test(f)).filter((f) => {
    const h = read(f);
    return h.includes('<script src="theme-boot.js"></script>') &&
      !h.includes('<script src="theme-boot.js"></script>\n<script src="data-registry.js"></script>\n<script src="tanot-data.js"></script>');
  });
  if (bad.length) fail('tanot-data', `ไม่มี data-registry.js + tanot-data.js ต่อจาก theme-boot.js: ${bad.join(', ')}`);
  else ok('tanot-data', 'ทุกหน้าโหลด tanot-data.js ใน <head>');
}

/* ── 9. i18n.js ต่อจาก tanot-data.js ── */
{
  const bad = tracked.filter((f) => /^[^/]+\.html$/.test(f)).filter((f) => {
    const h = read(f);
    return h.includes('<script src="tanot-data.js"></script>') && !h.includes('<script src="tanot-data.js"></script>\n<script src="i18n.js"></script>');
  });
  if (bad.length) fail('i18n', `ไม่มี <script src="i18n.js"></script> ต่อจาก tanot-data.js: ${bad.join(', ')}`);
  else ok('i18n', 'ทุกหน้าโหลด i18n.js ใน <head>');
}

/* ── 10. ไอคอนแอป ── */
{
  const bad = [];
  for (const f of ['apple-touch-icon.png', 'favicon-32.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
    if (!fs.existsSync(path.join(ROOT, f))) bad.push(`ไม่มีไฟล์ ${f}`);
  }
  for (const f of tracked.filter((f) => /^[^/]+\.html$/.test(f))) {
    const h = read(f);
    if (!h.includes('href="theme.css"')) continue;
    if (!h.includes('<link rel="apple-touch-icon" href="apple-touch-icon.png">')) bad.push(`${f}: ไม่มี apple-touch-icon.png`);
    if (!h.includes('<link rel="icon" href="favicon-32.png" type="image/png" sizes="32x32">')) bad.push(`${f}: ไม่มี favicon-32.png`);
    if (/favicon\.svg/.test(h)) bad.push(`${f}: ยังอ้าง favicon.svg`);
  }
  try {
    const man = JSON.parse(read('manifest.json'));
    for (const ic of man.icons || []) {
      if (!fs.existsSync(path.join(ROOT, ic.src))) bad.push(`manifest: ไม่มีไฟล์ ${ic.src}`);
      if (/\s/.test(ic.purpose || '')) bad.push(`manifest: ${ic.src} purpose "${ic.purpose}" — ใช้ any/maskable แยกไอคอน`);
    }
    const purposes = (man.icons || []).map((i) => i.purpose);
    if (!purposes.includes('any') || !purposes.includes('maskable')) bad.push('manifest: ต้องมีไอคอน purpose any และ maskable');
  } catch (e) { bad.push('อ่าน manifest.json ไม่ได้: ' + e.message); }
  if (bad.length) fail('icons', bad.join('; '));
  else ok('icons', 'ทุกหน้าลิงก์ไอคอนครบ + manifest any/maskable');
}

/* ── 11. ภาพพื้นหลังรายหน้า ── */
{
  const boot = read('theme-boot.js');
  const block = (boot.match(/var BG_GROUPS = \{([\s\S]*?)\n  \};/) || [])[1] || '';
  const groups = [...block.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]).concat(['invest']);
  const css = read('theme.css');
  const bad = [];
  if (!block) bad.push('อ่าน BG_GROUPS จาก theme-boot.js ไม่ได้');
  for (const g of groups) {
    for (const t of ['light', 'dark']) {
      const f = `assets/backgrounds/${g}-${t}.webp`;
      if (!fs.existsSync(path.join(ROOT, f))) bad.push(`ไม่มีไฟล์ ${f}`);
      if (!css.includes(`url(${f})`)) bad.push(`theme.css ไม่มีกฎของ ${f}`);
    }
  }
  if (bad.length) fail('backgrounds', bad.join('; '));
  else ok('backgrounds', `${groups.length} กลุ่มภาพมีไฟล์ light/dark + กฎใน theme.css`);
}

/* ── 12. ตัวตรวจธีม static (ratchet) ── */
{
  const tg = await import('./theme-guards.mjs');
  const cur = tg.collectStatic();
  tg.writeStaticReport(cur);
  const worse = tg.compareStatic(cur, tg.loadBaseline());
  if (worse.length) {
    fail('theme-static', 'แย่ลงจาก tests/theme-baseline.json (ใช้ var(--ome-*)/คอมโพเนนต์กลางแทน — ดู .claude/skills/tanot-design): ' +
      worse.map((w) => `${w.page} ${w.metric} ${w.base}→${w.now}${w.detail ? ' (' + w.detail + ')' : ''}`).join('; '));
  } else ok('theme-static', `${Object.keys(cur).length} หน้าไม่แย่ลงจาก baseline (สี hex / ปุ่มนิยามเอง)`);
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
