/* ══════════════════════════════════════════════════════════════════
   Tanot Service Worker — ให้เว็บเปิดออฟไลน์ได้ (เนื้อหาเรียนเป็น static เกือบหมด)
   กลยุทธ์: network-first สำหรับหน้า HTML (ได้ของใหม่เสมอเมื่อออนไลน์)
            cache-first สำหรับ asset อื่น (css/js/รูป/ฟอนต์)
   ══════════════════════════════════════════════════════════════════ */
'use strict';

const CACHE = 'ome-v620';
/* ภาพพื้นหลังรายหน้า (assets/backgrounds/) — แคชแยกที่ไม่ถูกล้างตอน bump CACHE (ภาพไม่ต้องโหลดใหม่ทุกรอบ deploy)
   ไม่ precache ทั้ง 30 ไฟล์: โหลดตอนเปิดหน้าที่ใช้ภาพนั้นครั้งแรก แล้วเสิร์ฟจากแคชก่อน + เช็คของใหม่เบื้องหลัง
   (stale-while-revalidate) — แทนไฟล์ภาพบนเว็บแล้วเครื่องเดิมได้ภาพใหม่ในการเปิดครั้งถัดไป */
const BG_CACHE = 'ome-bg-v1';
const PRECACHE = [
  './',
  './index.html',
  './index.js',
  './home-calc.js',
  './palette.js',
  './quick-add.js',
  './404.html',
  './documents.html',
  './area.html',
  './area.js',
  './run.html',
  './soon.html',
  './classroom-law.html',
  './classroom-law.js',
  './fsrs.js',
  './learn-core.js',
  './review.html',
  './review.js',
  './bar-prep.html',
  './classroom-business.html',
  './classroom-business.compiled.js',
  './classroom-engineering.html',
  './classroom-engineering.compiled.js',
  './languages.html',
  './languages.compiled.js',
  './legal.html',
  './legal.compiled.js',
  './react-pages.css',
  './vendor/react/react.production.min.js',
  './vendor/react/react-dom.production.min.js',
  './vendor/lucide/lucide.min.js',
  './budget.html',
  './text-to-speech.html',
  './text-to-speech.js',
  './tts-worker.js',
  './file-reader.js',
  './vendor/lamejs/lamejs.iife.js',
  './ai-client.js',
  './ai-chat-widget.js',
  './ai-chat-worker.js',
  './asr-worker.js',
  /* หมายเหตุ: ตั้งใจไม่ precache './vendor/transformers/*' (ไลบรารีแปลงข้อความ↔เสียงด้วย AI,
     ~14MB, โหลดผ่าน dynamic import() เฉพาะตอนกดใช้เท่านั้น) ที่นี่ — จะบังคับให้ทุกคนที่เปิดเว็บนี้
     โหลดไฟล์ใหญ่ก้อนนี้ทันทีแม้ไม่เคยใช้เครื่องมือนั้นเลย ปล่อยให้ fetch handler ด้านล่าง
     (cache-first สำหรับไฟล์ same-origin ทั่วไป) แคชให้เองอัตโนมัติตอนผู้ใช้เปิดใช้เครื่องมือนี้
     ครั้งแรกแทน (lazy caching) */
  './doc-check.html',
  './doc-check-file.html',
  './doc-check.js',
  './electrical.html',
  './electrical.js',
  './electrical-calc.js',
  './tax.html',
  './tax.js',
  './tax-calc.js',
  './tax-rules/index.json',
  './tax-rules/2568.json',
  './tax-rules/2569.json',
  './insurance.html',
  './insurance.js',
  './insurance-calc.js',
  './receipts.html',
  './receipts.js',
  './receipts-calc.js',
  './car.html',
  './car.js',
  './car-calc.js',
  './books.html',
  './books.js',
  './books-calc.js',
  './compare.html',
  './compare.js',
  './compare-calc.js',
  './image-gen.html',
  './image-gen.js',
  './slides.html',
  './slides.js',
  './slides-calc.js',
  './vendor/pptxgenjs/pptxgen.bundle.js',
  './health.html',
  './health.js',
  './health-calc.js',
  './maintenance.html',
  './maintenance.js',
  './mnt-calc.js',
  './mnt-qr.js',
  './vendor/qrcode-generator/qrcode.js',
  './vendor/jsqr/jsQR.js',
  './cad.html',
  './cad.js',
  './cad3d.html',
  './cad3d.js',
  './report-dashboard.html',
  './report-dashboard.utils.final43.js',
  './report-dashboard.performance.final43.js',
  './report-dashboard.complete.final43.local.js',
  './report-dashboard.mntsrc.js',
  './report-dashboard.bi-plus.final43.js',
  './report-dashboard.final62.projectcontrol.js',
  './report-dashboard.safety.final1.js',
  './report-dashboard.hr.final1.js',
  './report-dashboard.itops.final1.js',
  './report-dashboard.maintenance.final1.js',
  './report-dashboard.lawfirm.final1.js',
  './report-dashboard.risk.final1.js',
  './report-dashboard.finance.final1.js',
  './report-dashboard.reading.final1.js',
  './report-dashboard.kpidashboard.final1.js',
  './report-dashboard.organizational.final1.js',
  './typing.html',
  './typing.js',
  './coding.html',
  './coding.js',
  './code-runner-worker.js',
  './dom-runner-worker.js',
  './music.html',
  './music.js',
  './sports.html',
  './sports.js',
  './sports-log.js',
  './cooking.html',
  './cooking.js',
  './cooking-plan.js',
  './cooking-plan-calc.js',
  './extract-text.html',
  './extract-text.js',
  './word.html',
  './word.js',
  './excel.html',
  './excel.js',
  './invest.html',
  './invest-calc.js',
  './invest-core.js',
  './invest-hub.js',
  './invest-stock.html',
  './invest-stock.js',
  './invest-scan.js',
  './invest-paper.js',
  './invest-thai-stock.html',
  './invest-set50-scanner.html',
  './invest-trade-journal.html',
  './invest-trade-journal.js',
  './invest-global-stock.html',
  './invest-fund.html',
  './invest-fund.js',
  './invest-global-fund.html',
  './invest-thai-fund.html',
  './invest-gold.html',
  './invest-gold.js',
  './invest-markets.js',
  './invest-commodities.html',
  './invest-news.html',
  './invest-news.js',
  './invest-portfolio.html',
  './invest-business.html',
  './invest-business.js',
  './invest-bitcoin.html',
  './invest-bitcoin.js',
  './invest-gov-bond.html',
  './invest-gov-bond.js',
  './invest-gsb-lottery.html',
  './invest-baac-lottery.html',
  './invest-lottery.html',
  './invest-lottery.js',
  './invest-savings-lottery.js',
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
  './vendor/planegcs/index.js',
  './vendor/planegcs/planegcs_dist/enums.js',
  './vendor/planegcs/planegcs_dist/constraints.js',
  './vendor/planegcs/planegcs_dist/constraint_param_index.js',
  './vendor/planegcs/planegcs_dist/planegcs.js',
  './vendor/planegcs/planegcs_dist/planegcs.wasm',
  './vendor/planegcs/sketch/sketch_primitive.js',
  './vendor/planegcs/sketch/sketch_index.js',
  './vendor/planegcs/sketch/gcs_wrapper.js',
  './vendor/planegcs/sketch/emsc_vectors.js',
  './vendor/planegcs/sketch/geom_params.js',
  './credits.html',
  './theme.css',
  './theme-boot.js',
  './chart-theme.js',
  './icons.svg',
  './theme-preview.html',
  './theme-preview.js',
  './shell.js',
  './data-registry.js',
  './tanot-data.js',
  './data-import.js',
  './drive-backup.js',
  './data.html',
  './data.js',
  './notifications.html',
  './notifications.js',
  './tanot-push.js',
  './migrate.html',
  './migrate.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './i18n.js'
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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== BG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── Cloudflare Access (เฉพาะโดเมน *.pages.dev) ──
   พอเซสชัน Access หมดอายุ การเปิดหน้าจะถูก redirect ไปหน้าล็อกอินที่โดเมนอื่น ซึ่งแอปบนหน้าจอโฮม iPhone
   มักค้างอยู่ตรงนั้น จึงแสดงหน้าจากแคชพร้อมลิงก์เข้าสู่ระบบใหม่แทน — แต่ Pages เองก็ redirect ปกติด้วย
   (ตัด .html ออกจาก URL) และ SW อ่านปลายทางของ opaqueredirect ไม่ได้ เลยต้องถาม /api/session ก่อนว่า
   ยังล็อกอินอยู่ไหม (endpoint นี้ไม่โดน redirect ของ Pages จะ redirect ก็ต่อเมื่อ Access ไม่ผ่านเท่านั้น) */
const RELOGIN_PARAM = 'relogin';

async function accessSessionExpired() {
  try {
    const r = await fetch('/api/session', { redirect: 'manual', credentials: 'same-origin', cache: 'no-store' });
    return r.type === 'opaqueredirect' || r.status === 401 || r.status === 403;
  } catch (err) {
    return false;
  }
}

async function cachedPageFor(url) {
  const path = url.pathname;
  const candidates = [url.href];
  if (path.endsWith('.html')) candidates.push(path.slice(0, -5));
  else if (!path.endsWith('/')) candidates.push(path + '.html');
  if (path.endsWith('/index.html') || path.endsWith('/index')) candidates.push(path.replace(/index(\.html)?$/, ''));
  if (path.endsWith('/')) candidates.push(path + 'index.html');
  for (const c of candidates) {
    const hit = await caches.match(c, { ignoreSearch: true });
    if (hit && hit.ok) return hit;
  }
  return null;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function handleRedirectedNavigation(req, redirectRes) {
  if (!/\.pages\.dev$/.test(location.hostname)) return redirectRes;
  if (!(await accessSessionExpired())) return redirectRes;
  const url = new URL(req.url);
  const cached = await cachedPageFor(url);
  if (!cached) return redirectRes;

  const relogin = new URL(url.href);
  relogin.searchParams.set(RELOGIN_PARAM, '1');
  const bar =
    '<div id="tanot-relogin" style="position:fixed;left:0;right:0;bottom:0;z-index:99999;display:flex;gap:12px;' +
    'align-items:center;justify-content:center;flex-wrap:wrap;padding:10px 16px calc(10px + env(safe-area-inset-bottom));' +
    'background:#1B2030;color:#E6EAF2;font:600 13px/1.4 Prompt,system-ui,sans-serif;box-shadow:0 -4px 16px rgba(0,0,0,.25)">' +
    '<span>เซสชันหมดอายุ — กำลังแสดงหน้าจากแคช</span>' +
    '<a href="' + escapeHtml(relogin.href) + '" style="color:#fff;background:#0F8475;padding:6px 14px;border-radius:999px;' +
    'text-decoration:none">เข้าสู่ระบบใหม่</a></div>';
  let html = await cached.text();
  const i = html.lastIndexOf('</body>');
  html = i === -1 ? html + bar : html.slice(0, i) + bar + html.slice(i);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

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

  // API (Pages Functions) และหน้าล็อกอินของ Cloudflare Access ต้องไปถึงเครือข่ายเสมอ ห้ามแคช
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/cdn-cgi/')) return;

  // ลิงก์ "เข้าสู่ระบบใหม่" จากแถบเซสชันหมดอายุ — ปล่อยให้เบราว์เซอร์ตาม redirect ไปหน้าล็อกอินเอง
  if (req.mode === 'navigate' && url.searchParams.has(RELOGIN_PARAM)) return;

  if (url.pathname.indexOf('/assets/backgrounds/') !== -1) {
    e.respondWith(caches.open(BG_CACHE).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') c.put(req, res.clone());
        return res;
      });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net;
    })));
    return;
  }

  const isHTML = req.mode === 'navigate' || /\.html$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isHTML) {
    // network-first: ออนไลน์ได้ของสด ออฟไลน์ fallback แคช
    e.respondWith(
      fetch(req).then((res) => {
        if (res.type === 'opaqueredirect') return handleRedirectedNavigation(req, res);
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
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

/* ── Web Push (ROADMAP Phase 3) — ผู้ส่ง: Scheduler Worker / /api/push/test ผ่าน functions/_lib/webpush.js
   payload = JSON { title, body, url (หน้าในเว็บนี้ เช่น 'insurance.html'), tag } ── */
function notifyTarget(url) {
  // เปิดได้เฉพาะหน้าใน scope ของเว็บนี้ — URL นอกโดเมน/รูปแบบแปลกกลับไปหน้าแรก
  const base = self.registration.scope;
  try {
    const u = new URL(url || 'index.html', base);
    if (u.origin === location.origin && u.href.indexOf(base) === 0) return u.href;
  } catch (err) {}
  return new URL('index.html', base).href;
}

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  const title = String(d.title || 'Tanot');
  const opts = {
    body: String(d.body || ''),
    icon: new URL('icon-192.png', self.registration.scope).href,
    badge: new URL('icon-192.png', self.registration.scope).href,
    data: { url: notifyTarget(d.url) },
    lang: 'th',
  };
  if (d.tag) { opts.tag = String(d.tag); opts.renotify = true; }
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = notifyTarget(e.notification.data && e.notification.data.url);
  const path = new URL(target).pathname.replace(/\.html$/, '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    // หน้าเดียวกันเปิดค้างอยู่แล้ว (Pages ตัด .html ออกจาก URL ได้) → พาไป URL เป้าหมาย (hash อาจต่าง) แล้วโฟกัส
    for (const c of list) {
      if (new URL(c.url).pathname.replace(/\.html$/, '') !== path) continue;
      const go = c.url === target || !c.navigate ? Promise.resolve(c) : c.navigate(target).then((n) => n || c, () => c);
      return go.then((w) => (w.focus ? w.focus() : w));
    }
    return self.clients.openWindow(target);
  }));
});

// เบราว์เซอร์ต่ออายุ/เปลี่ยน subscription เอง → แจ้งเซิร์ฟเวอร์ (ยังล็อกอิน Access อยู่ คุกกี้ไปกับคำขอ same-origin)
self.addEventListener('pushsubscriptionchange', (e) => {
  const old = e.oldSubscription;
  const key = old && old.options && old.options.applicationServerKey;
  e.waitUntil((e.newSubscription ? Promise.resolve(e.newSubscription)
    : key ? self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) : Promise.resolve(null)
  ).then((sub) => {
    const post = (path, body) => fetch('/api/push/' + path, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return Promise.all([
      sub ? post('subscribe', { subscription: sub.toJSON(), device: 'ต่ออายุอัตโนมัติ' }) : null,
      old && (!sub || old.endpoint !== sub.endpoint) ? post('unsubscribe', { endpoint: old.endpoint }) : null,
    ]);
  }).catch(() => {}));
});
