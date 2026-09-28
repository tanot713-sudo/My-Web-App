/* ══════════════════════════════════════════════════════════════════
   CORS proxy ของเราเอง — deploy บน Cloudflare Workers (free tier)

   ⚠️ ไฟล์นี้ "ไม่ได้" ถูก deploy จากที่นี่ — เว็บนี้เป็น GitHub Pages ล้วนๆ (static only ไม่มี
   backend ของตัวเอง, ดู deploy-pages.yml) และ repo นี้ไม่ได้ผูกกับบัญชี Cloudflare ของใครเลย
   ไฟล์นี้เก็บไว้เป็นซอร์สโค้ด/เอกสารอ้างอิงเท่านั้น — ผู้ดูแลเว็บ (เจ้าของบัญชี Cloudflare) ต้อง
   copy โค้ดด้านล่างไปวางเองใน Cloudflare Workers dashboard (ดูขั้นตอนท้ายไฟล์)

   ทำไมต้องมีไฟล์นี้: หน้า invest-*.html ทุกหน้าดึงราคาหุ้น/ข่าวจาก Yahoo Finance / Google News
   ตรงๆ จากเบราว์เซอร์ไม่ได้ (โดนบล็อกด้วย CORS) เดิมพึ่ง CORS proxy สาธารณะฟรีหลายตัว
   (allorigins.win, codetabs.com, cors.eu.org, ฯลฯ) แต่พบว่าไม่เสถียรเลย — บางตัวปิดตัว/ต้องเสียเงิน
   (corsproxy.io), บางตัวโดนบล็อกบางประเทศ (thingproxy.freeboard.io ตาย DNS), บางตัวต้องลงทะเบียน
   โดเมนก่อน (corsfix.com) และบางตัวไม่เคยส่ง Access-Control-Allow-Origin header ที่ถูกต้องเลยจริงๆ
   (cors.eu.org, test.cors.workers.dev) — Worker นี้คือ proxy "ของเราเอง" แทน ไม่ต้องแชร์โควตากับ
   เว็บอื่นทั้งอินเทอร์เน็ต เสถียรกว่ามาก และ free tier ของ Cloudflare Workers ให้ 100,000
   คำขอ/วัน ซึ่งเกินพอสำหรับเว็บนี้

   จำกัดปลายทางด้วย ALLOWED_HOSTS (allowlist) กันไม่ให้ใครเอา Worker นี้ไปใช้เป็น proxy เปิด
   สำหรับเว็บอื่นที่ไม่เกี่ยวข้อง (ป้องกันการถูกละเมิดโควตาฟรีจากคนนอก) ══════════════════════ */

const ALLOWED_HOSTS = new Set([
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'news.google.com',
  'api.alternative.me'
]);

function corsHeaders() {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'public, max-age=60'
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const reqUrl = new URL(request.url);
    const target = reqUrl.searchParams.get('url');
    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400, headers: corsHeaders() });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch (e) {
      return new Response('Invalid target URL', { status: 400, headers: corsHeaders() });
    }

    if (!ALLOWED_HOSTS.has(targetUrl.hostname)) {
      return new Response('Host not allowed: ' + targetUrl.hostname, { status: 403, headers: corsHeaders() });
    }

    let upstream;
    try {
      upstream = await fetch(targetUrl.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TanotCorsProxy/1.0)' }
      });
    } catch (e) {
      return new Response('Upstream fetch failed: ' + e.message, { status: 502, headers: corsHeaders() });
    }

    const body = await upstream.arrayBuffer();
    const headers = corsHeaders();
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'text/plain');
    return new Response(body, { status: upstream.status, headers });
  }
};

/* ── วิธี deploy (ทำครั้งเดียว ใช้เวลา ~2 นาที ไม่ต้องผูกบัตรเครดิต) ──────────────────────
   1. เข้า https://dash.cloudflare.com/ แล้วสมัครบัญชีฟรี (หรือ login ถ้ามีอยู่แล้ว)
   2. เมนูซ้าย → "Workers & Pages" → กด "Create" → เลือก "Create Worker"
   3. ตั้งชื่อ เช่น "tanot-cors-proxy" (ชื่อนี้จะกลายเป็นส่วนหนึ่งของ URL) → กด "Deploy"
      (ระบบจะสร้าง Worker เปล่าๆ ด้วยโค้ดตัวอย่างเริ่มต้นก่อน ไม่เป็นไร ขั้นตอนถัดไปจะแทนที่)
   4. กด "Edit code" (หรือ "Quick edit") → ลบโค้ดเดิมทั้งหมด → copy โค้ดทั้งไฟล์นี้ (ตั้งแต่
      "const ALLOWED_HOSTS" ถึง "};" ก่อน comment นี้) ไปวางแทน → กด "Save and deploy"
   5. จะได้ URL รูปแบบ https://tanot-cors-proxy.<ชื่อบัญชีของคุณ>.workers.dev — คัดลอก URL นี้
      แล้วส่งกลับมาให้ Claude เพื่อเอาไปใส่ใน proxy chain ของทุกหน้า invest-*.html แทนที่ proxy
      สาธารณะที่ไม่เสถียร (จะกลายเป็นตัวที่ลองก่อนเป็นอันดับแรกเพราะเชื่อถือได้กว่า)

   ทดสอบเองได้ก่อนส่งกลับมาด้วยการเปิดในเบราว์เซอร์:
   https://tanot-cors-proxy.<ชื่อบัญชี>.workers.dev/?url=https://query1.finance.yahoo.com/v8/finance/chart/PTT.BK?range=1d%26interval=1d
   ถ้าเห็นข้อมูล JSON ราคาหุ้นขึ้นมา แปลว่าใช้งานได้แล้ว ────────────────────────────────── */
