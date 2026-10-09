// รวมผลของ theme-audit.spec.js (tests/theme-report/parts/*.json) เป็นรายงาน — globalTeardown ของ playwright.config.js
//   tests/theme-report/report.json · report.html (เปิดในเบราว์เซอร์ได้เลย) · summary.md (ตาราง 15 หน้าที่แย่ที่สุด)
// THEME_AUDIT_UPDATE=1 → ลดค่า "runtime" ใน tests/theme-baseline.json ตามผลจริง (ลดอย่างเดียว)
// THEME_AUDIT_UPDATE=seed → เติมเฉพาะตัวชี้วัด/คีย์ที่ยังไม่มีใน baseline (เพิ่มกฎใหม่) ไม่แตะค่าเดิม
// THEME_AUDIT_UPDATE=accept → ตั้งค่า runtime ตามผลจริงทั้งหมด (ครั้งแรก / ตั้งใจยอมให้เพิ่ม — ต้องมีเหตุผลใน PR)
// รันเองได้: node tests/theme-report.js
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'theme-report');
const PARTS = path.join(DIR, 'parts');
const BASELINE_FILE = path.join(__dirname, 'theme-baseline.json');
const COLS = ['axe', 'contrast', 'controlBorder', 'textOnImage', 'nonCentral', 'targetSize', 'mobileFont', 'mobileOverflow', 'mobileClip', 'mobileCrowd', 'mobileAlign', 'mobileRowBreak', 'mobileInput', 'mobileDialog', 'mobileFabOverlap', 'landscape', 'dialogClose', 'crawlErrors', 'thaiInEn'];
const LABEL = {
  axe: 'axe คอนทราสต์', contrast: 'ตัวอักษรบน control', controlBorder: 'ขอบ control', textOnImage: 'ตัวอักษรบนภาพ',
  nonCentral: 'ไม่ใช้คอมโพเนนต์กลาง', targetSize: 'เป้ากด < 40px',
  mobileFont: 'มือถือ: ตัวอักษรเล็ก/หัวข้อใหญ่', mobileOverflow: 'มือถือ: ล้นจอ', mobileClip: 'มือถือ: ข้อความถูกตัด', mobileCrowd: 'มือถือ: เป้ากดชิด < 8px', mobileAlign: 'มือถือ: กล่องไม่เรียงตรง', mobileRowBreak: 'มือถือ: ปุ่มท้ายแถวตกบรรทัด', mobileInput: 'มือถือ: ช่องกรอก < 16px/ชนิดไม่เหมาะ', mobileDialog: 'มือถือ: กล่อง/ลิ้นชักล้นจอ', mobileFabOverlap: 'มือถือ: ปุ่มแชท AI บังปุ่ม', landscape: 'แนวนอน 844×390: ล้น/เมนูตกขอบ', dialogClose: 'กล่องปิดไม่ได้เมื่อแตะนอกกล่อง', crawlErrors: 'error ตอนกดสำรวจ', thaiInEn: 'ไทยหลุดในโหมด EN',
  hardcodedColors: 'สี hex ในหน้า', customButtons: 'ปุ่มนิยามเอง',
};
const WEIGHT = { axe: 1, contrast: 1, controlBorder: 1, textOnImage: 2, nonCentral: 0.5, targetSize: 0.5, mobileFont: 0.5, mobileOverflow: 1, mobileClip: 1, mobileCrowd: 0.5, mobileAlign: 0.5, mobileRowBreak: 0.5, mobileInput: 0.5, mobileDialog: 1, mobileFabOverlap: 1, landscape: 1, dialogClose: 1, crawlErrors: 5, hardcodedColors: 0.25, customButtons: 2 };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function loadStatic() {
  // theme-guards.mjs เป็น ESM — อ่านค่าล่าสุดที่ repo-guards เขียนไว้ไม่ได้ จึงคำนวณซ้ำแบบเบาๆ ที่นี่ผ่าน baseline + ไฟล์ static.json ถ้ามี
  try { return JSON.parse(fs.readFileSync(path.join(DIR, 'static.json'), 'utf8')); } catch (e) { return null; }
}

function build() {
  if (!fs.existsSync(PARTS)) return null;
  const files = fs.readdirSync(PARTS).filter((f) => f.endsWith('.json'));
  if (!files.length) return null;
  const pages = {};
  for (const f of files) {
    const part = JSON.parse(fs.readFileSync(path.join(PARTS, f), 'utf8'));
    const pg = pages[part.page] || (pages[part.page] = { configs: {}, totals: {} });
    pg.configs[part.key] = { config: part.config, metrics: part.metrics, samples: part.samples };
    // ชุดที่รันที่ระดับภาพพื้นหลังอื่น (คีย์ลงท้าย @อ่อน/@ชัด) แสดงในรายละเอียด แต่ไม่รวมคะแนนหน้า/baseline
    if (part.key.indexOf('@') >= 0) continue;
    for (const [k, v] of Object.entries(part.metrics)) pg.totals[k] = (pg.totals[k] || 0) + v;
  }
  const stat = loadStatic() || ((JSON.parse(fs.existsSync(BASELINE_FILE) ? fs.readFileSync(BASELINE_FILE, 'utf8') : '{}').static) || {});
  for (const [p, pg] of Object.entries(pages)) {
    const s = stat[p.split('?')[0]] || {};
    pg.static = { hardcodedColors: s.hardcodedColors || 0, customButtons: s.customButtons || 0 };
    let score = 0;
    for (const [k, w] of Object.entries(WEIGHT)) score += w * ((pg.totals[k] != null ? pg.totals[k] : pg.static[k]) || 0);
    pg.score = Math.round(score * 10) / 10;
  }
  const ranked = Object.entries(pages).sort((a, b) => b[1].score - a[1].score).map(([p]) => p);
  return { generatedAt: new Date().toISOString(), weights: WEIGHT, ranked, pages };
}

function html(rep) {
  const head = ['หน้า', 'คะแนน (ยิ่งมากยิ่งแย่)', ...COLS.map((c) => LABEL[c]), LABEL.hardcodedColors, LABEL.customButtons];
  let rows = '';
  for (const p of rep.ranked) {
    const pg = rep.pages[p];
    rows += `<tr><td><a href="#${esc(p)}">${esc(p)}</a></td><td class="n">${pg.score}</td>` +
      COLS.map((c) => `<td class="n${pg.totals[c] ? ' bad' : ''}">${pg.totals[c] || 0}</td>`).join('') +
      `<td class="n">${pg.static.hardcodedColors}</td><td class="n">${pg.static.customButtons}</td></tr>`;
  }
  let details = '';
  for (const p of rep.ranked) {
    const pg = rep.pages[p];
    details += `<section id="${esc(p)}"><h2>${esc(p)} <small>คะแนน ${pg.score}</small></h2>`;
    for (const [key, c] of Object.entries(pg.configs).sort()) {
      const has = Object.entries(c.samples || {}).filter(([, v]) => v && v.length);
      if (!has.length) continue;
      details += `<details><summary>${esc(key)} — ${has.map(([k, v]) => `${LABEL[k] || k} ${v.length}`).join(' · ')}</summary>`;
      for (const [k, list] of has) {
        details += `<h3>${esc(LABEL[k] || k)}</h3><table><tr><th>selector</th><th>ข้อความ</th><th>ค่า</th></tr>` +
          list.slice(0, 200).map((s) => {
            const val = ['ratio', 'need', 'fg', 'bg', 'border', 'w', 'h', 'kind'].filter((x) => s[x] != null).map((x) => `${x}=${s[x]}`).join(' ');
            return `<tr><td><code>${esc(s.sel || '')}</code></td><td>${esc(s.text || '')}</td><td>${esc(val)}</td></tr>`;
          }).join('') + '</table>';
      }
      details += '</details>';
    }
    details += '</section>';
  }
  return `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Theme audit</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1f2b;--mut:#5b657b;--line:#d7dce6;--bad:#c9353a}
@media (prefers-color-scheme:dark){:root{--bg:#0c0f15;--fg:#e8ecf3;--mut:#99a2b5;--line:#2f3648;--bad:#f0646a}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}
table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border-bottom:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}
th{font-size:12px;color:var(--mut)}td.n{text-align:right;font-variant-numeric:tabular-nums}td.bad{color:var(--bad);font-weight:600}
code{font-size:12px;word-break:break-all}section{margin-top:28px}summary{cursor:pointer;padding:4px 0}.wrap{overflow-x:auto}
</style>
<h1>Theme audit</h1><p>${esc(rep.generatedAt)} · รวม 4 ชุด (390/1100 × สว่าง/มืด) ต่อหน้า</p>
<div class="wrap"><table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rows}</table></div>${details}</html>`;
}

function summary(rep, n = 15) {
  const cols = ['axe', 'contrast', 'controlBorder', 'textOnImage', 'nonCentral', 'targetSize', 'mobileFont', 'mobileOverflow', 'mobileClip', 'mobileCrowd', 'mobileAlign', 'mobileRowBreak', 'mobileInput', 'mobileDialog', 'mobileFabOverlap', 'landscape', 'dialogClose', 'crawlErrors', 'hardcodedColors', 'customButtons', 'thaiInEn'];
  let md = `| # | หน้า | คะแนน | ${cols.map((c) => LABEL[c]).join(' | ')} |\n|---|---|---:|${cols.map(() => '---:').join('|')}|\n`;
  rep.ranked.slice(0, n).forEach((p, i) => {
    const pg = rep.pages[p];
    md += `| ${i + 1} | ${p} | ${pg.score} | ${cols.map((c) => (pg.totals[c] != null ? pg.totals[c] : pg.static[c]) || 0).join(' | ')} |\n`;
  });
  return md;
}

function fmtBaseline(b) {
  // บรรทัดละหนึ่งคีย์ — diff ของ PR อ่านง่าย
  return '{\n' + Object.keys(b).sort().map((sec) => ' ' + JSON.stringify(sec) + ': {\n' +
    Object.keys(b[sec]).sort().map((k) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(b[sec][k])).join(',\n') + '\n }').join(',\n') + '\n}\n';
}

function updateBaseline(rep, mode) {
  let b = {};
  try { b = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')); } catch (e) {}
  const rt = b.runtime || {};
  for (const pg of Object.values(rep.pages)) {
    for (const [key, c] of Object.entries(pg.configs)) {
      if (key.indexOf('@') >= 0) continue;
      const old = rt[key] || {};
      const row = {};
      // seed = ตั้งเฉพาะตัวชี้วัดที่ยังไม่มีใน baseline (ใช้ตอนเพิ่มกฎใหม่) · ตัวที่มีอยู่แล้วคงเดิม
      for (const [k, v] of Object.entries(c.metrics)) row[k] = mode === 'seed' ? (old[k] == null ? v : old[k]) : mode === 'accept' || !b.runtime ? v : Math.min(old[k] == null ? 0 : old[k], v);
      rt[key] = row;
    }
  }
  b.runtime = rt;
  fs.writeFileSync(BASELINE_FILE, fmtBaseline(b));
}

module.exports = async function themeReport() {
  const rep = build();
  if (!rep) return;
  fs.writeFileSync(path.join(DIR, 'report.json'), JSON.stringify(rep, null, 1));
  fs.writeFileSync(path.join(DIR, 'report.html'), html(rep));
  fs.writeFileSync(path.join(DIR, 'summary.md'), summary(rep));
  const mode = process.env.THEME_AUDIT_UPDATE;
  if (mode) updateBaseline(rep, mode);
  console.log(`theme-report: ${Object.keys(rep.pages).length} หน้า → tests/theme-report/report.html` + (mode ? ` · baseline runtime อัปเดต (${mode})` : ''));
};
module.exports.build = build;
module.exports.summary = summary;

if (require.main === module) module.exports();
