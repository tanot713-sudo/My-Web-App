// ตัวช่วยร่วมของ smoke.spec.js / visual.spec.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** ดึงทุกหน้าที่เมนูใน shell.js ลิงก์ไป (+ index.html, soon.html) โดยอ่านจาก MENU ตรงๆ ไม่ต้องดูแลลิสต์ซ้ำ */
function menuPages() {
  const src = fs.readFileSync(path.join(ROOT, 'shell.js'), 'utf8');
  const start = src.indexOf('var MENU = [');
  const end = src.indexOf('exposeInvestCats');
  const block = src.slice(start, end);
  const pages = new Set(['index.html']);
  let m;
  const hrefRe = /href:\s*'([^']+)'/g;
  while ((m = hrefRe.exec(block))) pages.add(m[1]);
  const soonRe = /soonHref\('([^']+)'\)/g;
  while ((m = soonRe.exec(block))) pages.add('soon.html?label=' + encodeURIComponent(m[1]));
  // ตัด hash ออก (legal.html#plaint ฯลฯ เป็นหน้าเดียวกัน) แล้ว dedupe
  const out = new Map();
  for (const p of pages) {
    const noHash = p.split('#')[0];
    if (!out.has(noHash)) out.set(noHash, noHash);
  }
  return [...out.values()].filter((p) => fs.existsSync(path.join(ROOT, p.split('?')[0])));
}

/** error ที่รู้สาเหตุและไม่ใช่บั๊ก — ใส่เหตุผลกำกับทุกรายการ อย่าเพิ่มโดยไม่มีเหตุผล */
const KNOWN_NOISE = [
  // run.html ลอง /tools/tools.json ก่อนแล้ว fallback ไป /tool/tools.json โดยตั้งใจ (404 แรกเป็นปกติ)
  { re: /Failed to load resource.*404/, url: /\/tools\/tools\.json/ },
  // coding.html รันโค้ดผู้ใช้ใน iframe sandbox (ไม่มี allow-same-origin) ซึ่ง shell.js ในกรอบนั้นเข้าถึง serviceWorker ไม่ได้
  { re: /Failed to read the 'serviceWorker' property/, page: /coding\.html/ },
];
function isKnownNoise(text, loc, pageUrl) {
  return KNOWN_NOISE.some((n) => n.re.test(text) && (!n.url || n.url.test(loc || text)) && (!n.page || n.page.test(pageUrl)));
}

/**
 * เตรียมหน้าให้ทดสอบได้แบบออฟไลน์/ไม่ต้องล็อกอิน:
 * - localStorage: ผ่าน auth gate + ตั้งธีม
 * - บล็อกทุก request ที่ไม่ใช่ localhost (จำลองปิดเน็ต)
 * คืน array ของ error ที่เก็บได้ (console error / pageerror ที่มาจาก origin ของเราเอง)
 */
async function prepare(page, { theme = 'light' } = {}) {
  const errors = [];
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('tanot:auth', '1');
      localStorage.setItem('ome:theme', t);
    } catch (e) {}
  }, theme);
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.protocol === 'data:' || u.protocol === 'blob:') {
      return route.continue();
    }
    return route.abort('internetdisconnected');
  });
  page.on('pageerror', (e) => { if (!isKnownNoise(e.message, '', page.url())) errors.push('pageerror: ' + e.message); });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const loc = msg.location().url || '';
    if (isKnownNoise(msg.text(), loc, page.url())) return;
    // error จากการโหลดทรัพยากรภายนอกที่เราตั้งใจบล็อกเอง ไม่นับ
    if (loc && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(loc)) return;
    if (/ERR_INTERNET_DISCONNECTED/.test(msg.text())) return;
    errors.push('console.error: ' + msg.text() + (loc ? ' @ ' + loc : ''));
  });
  return errors;
}

module.exports = { ROOT, menuPages, prepare };
