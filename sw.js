/* ══════════════════════════════════════════════════════════════════
   Tanot Service Worker — ให้เว็บเปิดออฟไลน์ได้ (เนื้อหาเรียนเป็น static เกือบหมด)
   กลยุทธ์: network-first สำหรับหน้า HTML (ได้ของใหม่เสมอเมื่อออนไลน์)
            cache-first สำหรับ asset อื่น (css/js/รูป/ฟอนต์)
   ══════════════════════════════════════════════════════════════════ */
'use strict';

const CACHE = 'ome-v243';
const PRECACHE = [
  './',
  './index.html',
  './404.html',
  './documents.html',
  './run.html',
  './soon.html',
  './classroom-law.html',
  './classroom-law.js',
  './bar-prep.html',
  './classroom-business.html',
  './classroom-engineering.html',
  './languages.html',
  './legal.html',
  './budget.html',
  './firebase-sync.js',
  './text-to-speech.html',
  './text-to-speech.js',
  './tts-worker.js',
  './file-reader.js',
  './vendor/lamejs/lamejs.iife.js',
  './ai-chat-widget.js',
  './ai-chat-worker.js',
  './asr-worker.js',
  /* หมายเหตุ: ตั้งใจไม่ precache './vendor/transformers/*' (ไลบรารีแปลงข้อความ↔เสียงด้วย AI,
     ~14MB, โหลดผ่าน dynamic import() เฉพาะตอนกดใช้เท่านั้น) และ './vendor/firebase/*'
     (ไลบรารีซิงก์เรียลไทม์ของหน้ารายรับรายจ่ายเท่านั้น) ที่นี่ — จะบังคับให้ทุกคนที่เปิดเว็บนี้
     โหลดไฟล์ใหญ่ก้อนนี้ทันทีแม้ไม่เคยใช้เครื่องมือนั้นเลย ปล่อยให้ fetch handler ด้านล่าง
     (cache-first สำหรับไฟล์ same-origin ทั่วไป) แคชให้เองอัตโนมัติตอนผู้ใช้เปิดใช้เครื่องมือนี้
     ครั้งแรกแทน (lazy caching) */
  './doc-check.html',
  './doc-check-file.html',
  './doc-check.js',
  './extract-text.html',
  './extract-text.js',
  './word.html',
  './word.js',
  './excel.html',
  './excel.js',
  './invest.html',
  './invest-thai-stock.html',
  './invest-thai-stock.js',
  './invest-global-stock.html',
  './invest-global-stock.js',
  './invest-global-fund.html',
  './invest-global-fund.js',
  './invest-thai-fund.html',
  './invest-thai-fund.js',
  './invest-gold.html',
  './invest-gold.js',
  './invest-business.html',
  './invest-business.js',
  './invest-bitcoin.html',
  './invest-bitcoin.js',
  './invest-gov-bond.html',
  './invest-gov-bond.js',
  './invest-gsb-lottery.html',
  './invest-gsb-lottery.js',
  './invest-baac-lottery.html',
  './invest-baac-lottery.js',
  './invest-lottery.html',
  './invest-lottery.js',
  './sim-objects.html',
  './sim-objects.js',
  './vendor/lightweight-charts.standalone.js',
  './vendor/three/three.module.min.js',
  './vendor/three/three.core.min.js',
  './vendor/three/jsm/controls/OrbitControls.js',
  './vendor/three/jsm/controls/TransformControls.js',
  './vendor/three/jsm/loaders/GLTFLoader.js',
  './vendor/three/jsm/loaders/OBJLoader.js',
  './vendor/three/jsm/loaders/PLYLoader.js',
  './vendor/three/jsm/loaders/STLLoader.js',
  './vendor/three/jsm/loaders/FBXLoader.js',
  './vendor/three/jsm/curves/NURBSCurve.js',
  './vendor/three/jsm/curves/NURBSUtils.js',
  './vendor/three/jsm/libs/fflate.module.js',
  './vendor/three/jsm/exporters/GLTFExporter.js',
  './vendor/three/jsm/exporters/STLExporter.js',
  './vendor/three/jsm/utils/BufferGeometryUtils.js',
  './vendor/three/jsm/utils/SkeletonUtils.js',
  './vendor/three/jsm/modifiers/SimplifyModifier.js',
  './vendor/three/jsm/environments/RoomEnvironment.js',
  './vendor/three/jsm/webxr/ARButton.js',
  './vendor/gsap.min.js',
  './credits.html',
  './theme.css',
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
