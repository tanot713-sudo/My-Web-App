/* ══════════════════════════════════════════════════════════════════
   Tanot Service Worker — ให้เว็บเปิดออฟไลน์ได้ (เนื้อหาเรียนเป็น static เกือบหมด)
   กลยุทธ์: network-first สำหรับหน้า HTML (ได้ของใหม่เสมอเมื่อออนไลน์)
            cache-first สำหรับ asset อื่น (css/js/รูป/ฟอนต์)
   ══════════════════════════════════════════════════════════════════ */
'use strict';

const CACHE = 'ome-v11';
const PRECACHE = [
  './',
  './index.html',
  './app.html',
  './404.html',
  './documents.html',
  './run.html',
  './law-business-engineering.html',
  './languages.html',
  './legal.html',
  './budget.html',
  './doc-check.html',
  './doc-check-file.html',
  './doc-check.js',
  './word.html',
  './word.js',
  './theme.css',
  './app-theme.css',
  './app-nav.js',
  './shell.js',
  './auth-gate.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './favicon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // ข้าม API ภายนอก (Google/CDN ที่ต้อง online เท่านั้น เช่น OAuth/Drive)
  if (url.origin !== location.origin) {
    // แคช CDN แบบ cache-first เฉพาะไฟล์สคริปต์/ฟอนต์ที่โหลดซ้ำบ่อย
    const cacheable = /fonts\.g(oogleapis|static)\.com|cdn\.jsdelivr\.net|unpkg\.com|cdn\.tailwindcss\.com/.test(url.host);
    if (!cacheable) return;
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
    return;
  }

  const isHTML = req.mode === 'navigate' || /\.html$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isHTML) {
    // network-first: ออนไลน์ได้ของสด ออฟไลน์ fallback แคช
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }))
    );
  } else {
    // cache-first: asset in-origin
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});
