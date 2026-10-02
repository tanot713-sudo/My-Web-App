// สร้างเว็บ GitHub Pages แบบ redirect อย่างเดียว: ทุกหน้า .html → หน้าเดียวกันบน pages.dev
// ยกเว้น migrate-export.html (+ ไฟล์ที่มันใช้) ที่ยังต้องทำงานจริง เพราะ localStorage ของ github.io อ่านได้จาก origin นี้เท่านั้น
// sw.js เป็นตัวถอนการติดตั้ง service worker เดิม ไม่อย่างนั้นเครื่องที่เคยเปิดเว็บจะเสิร์ฟหน้าเก่าจากแคชต่อไป
// ใช้: node .github/scripts/github-pages-redirect.mjs <outDir>
import { readdirSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TARGET = 'https://my-web-app-5w2.pages.dev';
export const KEEP = ['migrate-export.html', 'migrate-export.js', 'theme-boot.js', 'data-registry.js', 'tanot-data.js', 'theme.css', 'favicon.svg'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function esc(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

export function stub(path) {
  const url = TARGET + '/' + path;
  return '<!DOCTYPE html>\n<html lang="th"><head><meta charset="utf-8"><meta name="robots" content="noindex">' +
    '<title>Tanot</title>' +
    '<script>location.replace(' + JSON.stringify(url) + ' + location.search + location.hash);</script>' +
    '<meta http-equiv="refresh" content="0; url=' + esc(url) + '">' +
    '</head><body><a href="' + esc(url) + '">' + esc(url) + '</a></body></html>\n';
}

export const NOT_FOUND = '<!DOCTYPE html>\n<html lang="th"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Tanot</title>' +
  '<script>(function () {\n' +
  '  var p = location.pathname.replace(/^\\/my-web-app\\/?/i, "");\n' +
  '  var old = { "excel-work": "excel", "word-work": "word" };\n' +
  '  var m = p.match(/^(excel-work|word-work)\\/?$/);\n' +
  '  if (m) p = old[m[1]];\n' +
  '  p = p.replace(/(^|\\/)index\\.html$/, "$1").replace(/\\.html$/, "");\n' +
  '  location.replace(' + JSON.stringify(TARGET + '/') + ' + p + location.search + location.hash);\n' +
  '})();</script></head><body><a href="' + TARGET + '/">' + TARGET + '/</a></body></html>\n';

export const KILL_SW = "'use strict';\n" +
  "self.addEventListener('install', function () { self.skipWaiting(); });\n" +
  "self.addEventListener('activate', function (e) {\n" +
  "  e.waitUntil(caches.keys()\n" +
  "    .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })\n" +
  "    .then(function () { return self.registration.unregister(); })\n" +
  "    .then(function () { return self.clients.matchAll({ type: 'window' }); })\n" +
  "    .then(function (cs) { cs.forEach(function (c) { c.navigate(c.url); }); }));\n" +
  "});\n";

export function build(out) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html') && !KEEP.includes(f) && f !== '404.html');
  for (const f of pages) writeFileSync(join(out, f), stub(f === 'index.html' ? '' : f.slice(0, -5)));
  for (const f of KEEP) copyFileSync(join(ROOT, f), join(out, f));
  writeFileSync(join(out, '404.html'), NOT_FOUND);
  writeFileSync(join(out, 'sw.js'), KILL_SW);
  writeFileSync(join(out, '.nojekyll'), '');
  return pages;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2];
  if (!out) { console.error('usage: github-pages-redirect.mjs <outDir>'); process.exit(1); }
  const pages = build(out);
  console.log('redirect stubs: ' + pages.length + ' · kept: ' + KEEP.join(', '));
}
