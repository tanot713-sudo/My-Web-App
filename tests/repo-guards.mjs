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
// 13. vendor/craft (ไลบรารี wasm ตระกูล *Craft): ทุกไฟล์ตรง vendor/craft/manifest.json (sha256/ขนาด) · ≤ 25 MiB · มีที่มา/license/การ์ดใน credits.html
//     · path ที่มีใน base แล้วห้ามเปลี่ยนเนื้อไฟล์ (รุ่นใหม่ = โฟลเดอร์ใหม่ เพราะ sw.js แคชแยกแบบ cache-first) · ไม่ precache · ห้ามชื่อ ArtCraft ในเมนู
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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

/* ── 13. vendor/craft: ไลบรารี wasm ตระกูล *Craft (ตัวโหลด craft-loader.js, แคชแยก tanot-craft-v1 ใน sw.js) ── */
{
  const G = 'craft';
  const MAN = 'vendor/craft/manifest.json';
  const bad = [];
  let man = null;
  try { man = JSON.parse(read(MAN)); } catch (e) {}
  const listed = new Set([MAN]);
  const sizeOf = (f) => fs.statSync(path.join(ROOT, f)).size;
  if (!man || !man.libs || typeof man.libs !== 'object') bad.push(`อ่าน ${MAN} ไม่ได้ / ไม่มี libs`);
  else {
    const dirs = new Set();
    for (const [key, L] of Object.entries(man.libs)) {
      const where = `libs.${key}`;
      if (!/^[a-z0-9-]+$/.test(key)) bad.push(`${where}: ชื่อไลบรารีต้องเป็น a-z 0-9 -`);
      if (!L || typeof L !== 'object') { bad.push(`${where}: ไม่ใช่ object`); continue; }
      if (typeof L.dir !== 'string' || !new RegExp(`^vendor/craft/${key}-[A-Za-z0-9._-]+$`).test(L.dir)) bad.push(`${where}.dir ต้องเป็น vendor/craft/${key}-<รุ่น> (ได้ ${L.dir})`);
      else if (dirs.has(L.dir)) bad.push(`${where}.dir ซ้ำกับไลบรารีอื่น`);
      else dirs.add(L.dir);
      if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(L.source || '')) bad.push(`${where}.source ต้องเป็น https://github.com/<owner>/<repo>`);
      if (!/^[0-9a-f]{40}$/.test(L.commit || '')) bad.push(`${where}.commit ต้องเป็น commit 40 ตัว`);
      if (!L.license || typeof L.license !== 'string') bad.push(`${where}.license ว่าง`);
      if (!L.name || typeof L.name !== 'string') bad.push(`${where}.name ว่าง`);
      if (/artcraft/i.test(L.name || '')) bad.push(`${where}.name ห้ามใช้ชื่อ ArtCraft (เครื่องหมายการค้า)`);
      const files = L.files && typeof L.files === 'object' ? L.files : {};
      if (!L.licenseFile || !files[L.licenseFile]) bad.push(`${where}.licenseFile ต้องชี้ไฟล์ license ที่อยู่ใน files`);
      if (!Object.keys(files).some((f) => /\.wasm$/.test(f))) bad.push(`${where}: ไม่มีไฟล์ .wasm`);
      for (const [f, meta] of Object.entries(files)) {
        if (!/^[A-Za-z0-9._-]+$/.test(f)) { bad.push(`${where}.files["${f}"]: ชื่อไฟล์ต้องไม่มี / หรืออักขระพิเศษ`); continue; }
        const p = `${L.dir}/${f}`;
        listed.add(p);
        if (!tracked.includes(p)) { bad.push(`${p} อยู่ใน manifest แต่ไม่มีไฟล์ใน repo`); continue; }
        const h = createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex');
        if (!meta || h !== meta.sha256) bad.push(`${p} sha256 ไม่ตรง manifest`);
        if (!meta || sizeOf(p) !== meta.bytes) bad.push(`${p} ขนาดไม่ตรง manifest`);
        if (sizeOf(p) > LIMIT) bad.push(`${p} ใหญ่เกิน 25 MiB`);
      }
      const short = String(L.commit || '').slice(0, 7);
      if (!credits.includes(`<span class="lib-name">${String(L.name || '').toLowerCase()}</span>`) || !credits.includes(`href="${String(L.source || '').toLowerCase()}"`) || !credits.includes(short)) {
        bad.push(`credits.html ต้องมีการ์ด ${L.name} (lib-name + ลิงก์ ${L.source} + commit ${short})`);
      }
    }
  }
  const extra = tracked.filter((f) => f.startsWith('vendor/craft/') && !listed.has(f));
  if (extra.length) bad.push(`ไฟล์ใน vendor/craft ที่ไม่อยู่ใน manifest: ${extra.slice(0, 5).join(', ')}`);
  const pre = precache.map((u) => u.replace(/^\.\//, '')).filter((u) => u.startsWith('vendor/craft/') && u !== MAN);
  if (pre.length) bad.push(`ห้าม precache ไฟล์ของไลบรารี (ใช้แคชแยก tanot-craft-v1): ${pre.join(', ')}`);
  const manPre = precache.includes('./' + MAN) || (/\bCRAFT_MANIFEST,/.test((precacheBlock || ['', ''])[1]) && /const CRAFT_MANIFEST = '\.\/vendor\/craft\/manifest\.json'/.test(swSrc));
  if (!manPre) bad.push(`${MAN} ต้องอยู่ใน PRECACHE (เปลี่ยนพร้อมโค้ดทุก deploy)`);
  // path ที่ deploy แล้วห้ามเปลี่ยนเนื้อไฟล์ — sw.js เสิร์ฟจาก CRAFT_CACHE แบบ cache-first ไม่ถูกล้างตอน bump CACHE
  const base = process.env.GUARD_BASE || 'origin/main';
  let baseMan = null;
  try { baseMan = JSON.parse(execFileSync('git', ['show', `${base}:${MAN}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) {}
  if (baseMan && baseMan.libs && man && man.libs) {
    const now = new Map();
    for (const L of Object.values(man.libs)) for (const [f, m] of Object.entries((L && L.files) || {})) now.set(`${L.dir}/${f}`, m && m.sha256);
    for (const L of Object.values(baseMan.libs)) for (const [f, m] of Object.entries((L && L.files) || {})) {
      const p = `${L.dir}/${f}`;
      if (now.has(p) && now.get(p) !== (m && m.sha256)) bad.push(`${p} เปลี่ยนเนื้อไฟล์ทั้งที่ path เดิม deploy แล้ว — ใช้โฟลเดอร์รุ่นใหม่ (${L.dir.replace(/-[^-]+$/, '')}-<รุ่น>)`);
    }
  }
  // ชื่อ ArtCraft เป็นเครื่องหมายการค้า — ห้ามเป็นชื่อเมนู/คำค้นใน MENU ของ shell.js
  const menu = (read('shell.js').match(/var MENU = \[[\s\S]*?\n  \];/) || [''])[0];
  if (!menu) bad.push('หา MENU ใน shell.js ไม่เจอ');
  else if (/artcraft/i.test(menu)) bad.push('MENU ใน shell.js มีชื่อ "ArtCraft" (เครื่องหมายการค้า — ห้ามใช้เป็นชื่อเมนู)');
  if (tracked.some((f) => f.startsWith('vendor/gridcraft/'))) bad.push('vendor/gridcraft/ ย้ายไป vendor/craft/ แล้ว — ห้ามเพิ่มกลับ');
  if (bad.length) fail(G, bad.join(' · '));
  else ok(G, `vendor/craft ${listed.size - 1} ไฟล์ ใน ${Object.keys(man.libs).length} ไลบรารีตรง manifest + credits · ไม่ precache · path เดิมไม่เปลี่ยน${baseMan ? '' : ` (ไม่มี manifest ใน ${base} — ข้ามข้อนี้)`}`);
}

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
  const stale = tg.staleAllowList(cur);
  if (stale.length) fail('theme-static-allow', 'allowlist ใน theme-guards.mjs มีชื่อที่หน้าไม่ได้ใช้แล้ว (ลบออก): ' + stale.map((x) => x.page + ' ' + x.name).join(', '));
  if (worse.length) {
    fail('theme-static', 'แย่ลงจาก tests/theme-baseline.json (ใช้ var(--ome-*)/คอมโพเนนต์กลางแทน — ดู skill tanot-design): ' +
      worse.map((w) => `${w.page} ${w.metric} ${w.base}→${w.now}${w.detail ? ' (' + w.detail + ')' : ''}`).join('; '));
  } else ok('theme-static', `${Object.keys(cur).length} หน้าไม่แย่ลงจาก baseline (สี hex / ปุ่มนิยามเอง)`);
}

/* ── 13. มือถือ: viewport-fit=cover + safe-area ของ element ที่ติดขอบจอ (รอบ 9) ──
   (a) ทุกหน้า .html ที่โหลด theme.css ต้องมี viewport-fit=cover ไม่งั้น env(safe-area-inset-*) เป็น 0 เสมอ (รอยบาก/แถบโฮมของ iPhone)
   (b) กฎ CSS ที่ position:fixed ติดขอบ (top:0 / bottom / left / right เป็นตัวเลข) ต้องมี env(safe-area-inset-*) ในกฎเดียวกัน
       — ข้าม: โอเวอร์เลย์เต็มจอ inset:0 ล้วน (backdrop/ฉาก), sticky ในกล่องเลื่อน · ยกเว้นเป็นรายชื่อด้านล่าง (มีเหตุผล) */
{
  const bad = [];
  const pagesHtml = tracked.filter((f) => /^[^/]+\.html$/.test(f) && read(f).includes('href="theme.css"')); // stub redirect ไม่มี UI → ข้าม
  for (const f of pagesHtml) {
    const vp = (read(f).match(/<meta[^>]+name="viewport"[^>]*>/i) || [''])[0];
    if (vp && !/viewport-fit=cover/.test(vp)) bad.push(`${f}: viewport ไม่มี viewport-fit=cover`);
  }
  /* ยกเว้นแบบระบุตัวเลือก (selector) + เหตุผล */
  const ALLOW = [
    [/\.sl-stage\b/, 'โหมดนำเสนอเต็มจอ: ภาพสไลด์ 16:9 กลางจอ ไม่มีปุ่ม/ข้อความชิดขอบ'],
    [/html\[data-bg\]::(before|after)/, 'ภาพ/scrim พื้นหลังตกแต่ง ไม่มีเนื้อหา'],
    [/#presentationOverlay|\.lg-modal-ov|\.dashboard-project-detail|\.dashboard-project-backdrop/, 'โอเวอร์เลย์เต็มจอ (inset:0) เนื้อหาอยู่ในกล่องกลางที่มี padding/ขอบของมันเอง'],
  ];
  const sources = tracked.filter((f) => /^[^/]+\.(html|css|js)$/.test(f) && !/\.(compiled|min)\.js$/.test(f) && f !== 'sw.js');
  for (const f of sources) {
    let css = read(f);
    if (f.endsWith('.html')) css = [...css.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    else if (f.endsWith('.js')) { if (!/position\s*:\s*fixed/.test(css)) continue; css = css.replace(/'\s*\+\s*\n?\s*'/g, ''); }
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*position\s*:\s*fixed[^{}]*)\}/g)) {
      const sel = m[1].trim().replace(/\s+/g, ' ').slice(-90), d = m[2];
      const edge = /(?:^|[;\s])(?:bottom|left|right)\s*:\s*(?:\d|calc|var)/.test(d) || /(?:^|[;\s])top\s*:\s*0(?:[;\s]|$)/.test(d);
      if (!edge || /safe-area-inset/.test(d)) continue;
      if (ALLOW.some(([re]) => re.test(m[1]))) continue;
      bad.push(`${f}: ${sel} — position:fixed ติดขอบแต่ไม่มี env(safe-area-inset-*)`);
    }
    // sticky ติดล่าง (แถบสถานะ/ปุ่มบันทึกค้างล่าง) ต้องมี safe-area ด้วย
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*position\s*:\s*sticky[^{}]*[;\s]bottom\s*:[^{}]*)\}/g)) {
      if (/safe-area-inset/.test(m[2]) || /\.wd-statusbar|\.dialog-foot/.test(m[1])) continue; // .wd-statusbar: padding-bottom ที่มี safe-area อยู่ในกฎหลักของมัน · .dialog-foot: ติดขอบล่างของ "กล่อง" ซึ่งเว้นจากขอบจอเสมอ (max-height 100dvh − 24px)
      bad.push(`${f}: ${m[1].trim().replace(/\s+/g, ' ').slice(-90)} — position:sticky; bottom แต่ไม่มี env(safe-area-inset-bottom)`);
    }
  }
  if (bad.length) fail('safe-area', bad.join('; '));
  else ok('safe-area', `${pagesHtml.length} หน้ามี viewport-fit=cover และ element fixed ติดขอบมี safe-area`);
}

/* ── 13. โมเดล Tanotfin ที่โค้ดโหลดได้ ── */
{
  const ALLOWED = ['mms-thai-jori-f5-onnx', 'mms-thai-riko-f5-onnx', 'distill-whisper-th-small-onnx', 'distill-whisper-th-medium-onnx'];
  const mm = read('media-models.js');
  const mig = mm.match(/var TTS_MIGRATE = \{[\s\S]*?\n  \};/);
  const bad = [];
  if (!mig) fail('tanotfin-models', 'หา TTS_MIGRATE ใน media-models.js ไม่เจอ');
  if (/TTS_LEGACY|ttsLegacy/.test(mm)) fail('tanotfin-models', 'media-models.js ยังมี TTS_LEGACY/ttsLegacy — ห้ามมีทางถอยไปเสียงอื่น');
  const files = tracked.filter((f) => /\.(?:js|mjs|jsx|html|json)$/.test(f) && !/^(?:tests|tools|docs|vendor|local)\//.test(f) && !/(?:^|\/)package(?:-lock)?\.json$/.test(f) && !/\.compiled\.js$/.test(f));
  for (const f of files) {
    let src = read(f);
    if (f === 'media-models.js' && mig) src = src.replace(mig[0], '');
    for (const m of src.matchAll(/Tanotfin\/([A-Za-z0-9._-]+)/g)) {
      const name = m[1];
      if (!ALLOWED.some((a) => a === name || a.startsWith(name))) bad.push(f + ' → Tanotfin/' + name);
    }
  }
  if (bad.length) fail('tanotfin-models', 'โมเดล Tanotfin นอกรายการที่อนุญาต (' + ALLOWED.join(', ') + '): ' + [...new Set(bad)].slice(0, 6).join('; '));
  else ok('tanotfin-models', 'โมเดล Tanotfin ที่อ้างถึงมีแค่ 4 ตัว (+ ชื่อเก่าในตาราง TTS_MIGRATE)');
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
