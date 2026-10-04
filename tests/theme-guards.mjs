// ตัวตรวจธีมแบบ static (ไม่ใช้เบราว์เซอร์) — เรียกจาก repo-guards.mjs ทุกครั้ง หรือรันเอง: node tests/theme-guards.mjs
//   ต่อหน้า (*.html ที่โหลด theme.css) นับจาก <style> ในหน้า + .css ของเราเองที่หน้าลิงก์ (ยกเว้น theme.css,
//   react-pages.css ที่ Tailwind สร้างจาก token แล้ว, ไฟล์ vendor และบล็อก @media print):
//   · hardcodedColors — สี hex / rgb() / rgba() / hsl() ที่เขียนตรงๆ (ควรใช้ var(--ome-*) แทน)
//   · customButtons   — คลาสปุ่มที่หน้านิยามเอง: .btn ซ้ำของกลาง หรือ *-btn / btn-* ที่ไม่ใช่คอมโพเนนต์กลาง
// ระบบ ratchet: ค่าใน tests/theme-baseline.json (ช่อง "static") ห้ามเพิ่ม — เพิ่ม = repo-guards ล้ม
//   ลดลงแล้ว: node tests/theme-guards.mjs --update   (ลดค่าใน baseline ลงตามจริง ไม่เพิ่ม)
//   ตั้งใจเพิ่ม (หายาก ต้องมีเหตุผลใน PR): node tests/theme-guards.mjs --accept
//   หน้าใหม่ที่ยังไม่มีใน baseline ถือว่า baseline = 0 (หน้าใหม่ต้องสะอาดตั้งแต่แรก)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE_FILE = path.join(ROOT, 'tests', 'theme-baseline.json');
const SKIP_CSS = new Set(['theme.css', 'react-pages.css']);
export const STATIC_METRICS = ['hardcodedColors', 'customButtons'];

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** ตัด @media print { … } ออก (นับวงเล็บปีกกา) + คอมเมนต์ */
function stripPrintAndComments(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '';
  let i = 0;
  const re = /@media\s+print\b[^{]*\{/gi;
  let m;
  while ((m = re.exec(css))) {
    out += css.slice(i, m.index);
    let depth = 1, j = m.index + m[0].length;
    while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    i = j;
    re.lastIndex = j;
  }
  return out + css.slice(i);
}

export function pageCss(file) {
  const html = read(file);
  const parts = [];
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) parts.push(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+\.css)"/gi)) {
    const href = m[1];
    if (/^(https?:)?\/\//.test(href) || href.startsWith('vendor/') || SKIP_CSS.has(href)) continue;
    if (fs.existsSync(path.join(ROOT, href))) parts.push(read(href));
  }
  return stripPrintAndComments(parts.join('\n'));
}

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*[\d.]/g;
/* ปุ่มกลาง (theme.css) — ตัวขยายของ .btn ที่หน้าใช้ร่วมได้ ไม่นับว่านิยามเอง */
const CENTRAL_BTN_MODS = new Set(['primary', 'ghost', 'danger', 'sm', 'lg', 'icon', 'on', 'active']);

export function analyzeCss(css) {
  const colors = (css.match(COLOR_RE) || []).length;
  const buttons = new Set();
  // เฉพาะส่วน selector (ก่อน {) — ไม่ใช่ค่า property
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    const sel = m[1];
    if (/^\s*@/.test(sel)) continue;
    for (const c of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      const name = c[1];
      if (name === 'btn') {
        // .btn ตามด้วยตัวขยายกลางอย่างเดียว (.btn.primary) ก็ยังเป็นการนิยามปุ่มกลางซ้ำ
        buttons.add('.btn');
      } else if (/(^|-)btn$|^btn-/.test(name) && !name.startsWith('ome-') && !CENTRAL_BTN_MODS.has(name)) {
        buttons.add('.' + name);
      }
    }
  }
  return { hardcodedColors: colors, customButtons: buttons.size, buttonClasses: [...buttons].sort() };
}

export function themePages() {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && read(f).includes('href="theme.css"')).sort();
}

export function collectStatic() {
  const out = {};
  for (const f of themePages()) out[f] = analyzeCss(pageCss(f));
  return out;
}

export function loadBaseline() {
  try { return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')); } catch (e) { return {}; }
}
export function fmtBaseline(b) {
  // บรรทัดละหนึ่งคีย์ — diff ของ PR อ่านง่าย
  return '{\n' + Object.keys(b).sort().map((sec) => ' ' + JSON.stringify(sec) + ': {\n' +
    Object.keys(b[sec]).sort().map((k) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(b[sec][k])).join(',\n') + '\n }').join(',\n') + '\n}\n';
}
export function saveBaseline(b) {
  fs.writeFileSync(BASELINE_FILE, fmtBaseline(b));
}

/** ค่าปัจจุบันให้ theme-report.js ใส่ในรายงาน (tests/theme-report/ ไม่ commit) */
export function writeStaticReport(cur) {
  const dir = path.join(ROOT, 'tests', 'theme-report');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'static.json'), JSON.stringify(cur, null, 1));
}

/** เทียบกับ baseline — คืนรายการที่แย่ลง [{page, metric, now, base}] */
export function compareStatic(current, baseline) {
  const worse = [];
  const base = (baseline && baseline.static) || {};
  for (const [page, v] of Object.entries(current)) {
    for (const k of STATIC_METRICS) {
      const b = base[page] ? base[page][k] || 0 : 0;
      if (v[k] > b) worse.push({ page, metric: k, now: v[k], base: b, detail: k === 'customButtons' ? v.buttonClasses.join(' ') : '' });
    }
  }
  return worse;
}

export function updateStatic(current, { accept = false } = {}) {
  const b = loadBaseline();
  const old = b.static || {};
  const next = {};
  for (const [page, v] of Object.entries(current)) {
    const o = old[page] || {};
    const row = {};
    // --update ลดได้อย่างเดียว (หน้าใหม่ = 0 ตามนโยบาย); --accept ตั้งตามค่าจริง
    for (const k of STATIC_METRICS) row[k] = accept ? v[k] : Math.min(o[k] == null ? 0 : o[k], v[k]);
    next[page] = row;
  }
  b.static = next;
  saveBaseline(b);
  return next;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const cur = collectStatic();
  const accept = process.argv.includes('--accept');
  if (accept || process.argv.includes('--update')) {
    const before = (loadBaseline().static) || {};
    if (!accept && !Object.keys(before).length) {
      console.error('ยังไม่มี baseline — ใช้ --accept ครั้งแรก');
      process.exit(1);
    }
    updateStatic(cur, { accept });
    console.log(`theme-baseline.json (static) ${accept ? 'ตั้งตามค่าปัจจุบัน' : 'ลดลงตามจริง'} — ${Object.keys(cur).length} หน้า`);
  } else {
    writeStaticReport(cur);
    const worse = compareStatic(cur, loadBaseline());
    const rows = Object.entries(cur).sort((a, b) => (b[1].hardcodedColors + b[1].customButtons * 5) - (a[1].hardcodedColors + a[1].customButtons * 5));
    for (const [p, v] of rows.slice(0, 20)) console.log(`${p.padEnd(32)} สี ${String(v.hardcodedColors).padStart(4)}  ปุ่มเอง ${v.customButtons}  ${v.buttonClasses.join(' ')}`);
    if (worse.length) {
      console.error('\nแย่ลงจาก baseline:\n' + worse.map((w) => `  ${w.page} ${w.metric} ${w.base} → ${w.now} ${w.detail}`).join('\n'));
      process.exit(1);
    }
    console.log('\ntheme-guards: ไม่มีหน้าไหนแย่ลง');
  }
}
