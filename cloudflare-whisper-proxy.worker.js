/* ══════════════════════════════════════════════════════════════════
   Cloudflare Worker — ถอดเสียงเป็นข้อความผ่าน Workers AI (Whisper Large v3 Turbo)

   ⚠️ ไฟล์นี้ "ไม่ได้" ถูก deploy จากที่นี่ — เว็บนี้เป็น GitHub Pages ล้วนๆ (static only) ไฟล์นี้เก็บไว้
   เป็นซอร์สโค้ด/เอกสารอ้างอิงเท่านั้น — ผู้ดูแลเว็บต้อง copy โค้ดไปวางเองใน Cloudflare Workers
   dashboard (ดูขั้นตอนท้ายไฟล์) แล้วผูก "Workers AI" binding ชื่อ AI เข้ากับ Worker นี้เอง (ทำผ่าน
   dashboard เท่านั้น ทำจากโค้ดไม่ได้)

   ทำไมต้องมี Worker นี้: Whisper ที่รันในเบราว์เซอร์ (ai-summary-cache.js ไม่เกี่ยว — ดู asr-worker.js/
   text-to-speech.js) จำกัดทั้งความแม่นยำ (โมเดลใหญ่สุดที่รันไหวในเบราว์เซอร์คือ whisper-medium)
   และความเร็ว (WASM เธรดเดียวบนเครื่องผู้ใช้เอง) — Worker นี้ส่งเสียงไปให้ Cloudflare Workers AI
   รัน whisper-large-v3-turbo แทน (แม่นกว่า เร็วกว่ามาก เพราะรันบนเซิร์ฟเวอร์ Cloudflare) มี free tier
   ให้ 10,000 Neurons/วัน (~3.5 ชม.เสียง/วัน ฟรี) เกินจากนั้นคิดเงินจริง ~$0.011/1000 Neurons
   (whisper-large-v3-turbo กิน 46.63 Neurons ต่อนาทีเสียง) — ฝั่งเว็บ (text-to-speech.js) เป็นคนคุม
   โควตา/ล็อกรหัสผ่านเอง Worker นี้แค่ส่งต่อคำขอ+คืนค่า usage.neurons จริงจาก Cloudflare กลับไปให้
   ฝั่งเว็บสะสมยอดเอง (แม่นกว่าประมาณจากความยาวเสียงเอง) ══════════════════════════════════════ */

const ALLOWED_ORIGIN = 'https://tanot713-sudo.github.io';

function corsHeaders() {
  return new Headers({
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders() });
    }
    /* กัน Worker นี้ถูกเรียกจากเว็บอื่น (โควตาฟรี/ค่าใช้จ่ายเป็นของเว็บนี้เว็บเดียว) — ตรวจทั้ง Origin
       (browser ส่งมาปกติ) เผื่อไว้ */
    const origin = request.headers.get('Origin');
    if (origin && origin !== ALLOWED_ORIGIN) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers: corsHeaders() });
    }
    if (!env.AI) {
      return new Response(JSON.stringify({ error: 'AI binding not configured on this Worker (ผูก Workers AI binding ชื่อ AI ในหน้า Settings ของ Worker ก่อน)' }), { status: 500, headers: corsHeaders() });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders() });
    }
    const audioBase64 = body.audio;
    const language = body.language; // optional — ISO 639-1 เช่น 'th'/'en', ไม่ใส่ = auto-detect
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing "audio" (base64 string) in request body' }), { status: 400, headers: corsHeaders() });
    }

    const input = { audio: audioBase64 };
    if (language) input.language = language;

    let result;
    try {
      result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', input);
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Transcription failed: ' + (err && err.message ? err.message : String(err)) }), { status: 502, headers: corsHeaders() });
    }

    return new Response(JSON.stringify({
      text: (result && result.text) || '',
      neurons: (result && result.usage && result.usage.neurons) || null
    }), { status: 200, headers: corsHeaders() });
  }
};

/* ── วิธี deploy (ทำครั้งเดียว ~3 นาที ไม่ต้องผูกบัตรเครดิต) ──────────────────────────────
   1. เข้า https://dash.cloudflare.com/ → "Workers & Pages" → "Create" → "Start with Hello World!"
   2. ตั้งชื่อ เช่น "tanot-whisper-proxy" → Deploy
   3. "Edit code" → ลบโค้ดเดิม → วางโค้ดทั้งไฟล์นี้ (ตั้งแต่ "const ALLOWED_ORIGIN" ถึง "};" ก่อน
      comment นี้) → "Save and deploy"
   4. ⚠️ ขั้นตอนสำคัญที่ขาดไม่ได้ (ต่างจาก Worker ตัวอื่นที่เคยทำ — ตัวนี้ต้องผูก AI binding เพิ่ม):
      กลับไปหน้า Worker → แท็บ "Settings" → "Bindings" → "Add binding" → เลือก "Workers AI"
      → ตั้งชื่อตัวแปรเป็น "AI" (ตัวพิมพ์ใหญ่ ต้องตรงเป๊ะ เพราะโค้ดเรียก env.AI) → Save and deploy
      (ไม่ทำขั้นตอนนี้ Worker จะตอบ error "AI binding not configured" ทุกครั้ง)
   5. จะได้ URL แบบ https://tanot-whisper-proxy.<ชื่อบัญชีคุณ>.workers.dev — ส่ง URL นี้กลับมาให้ Claude
      เพื่อเอาไปผูกเข้าหน้า "แปลงเสียง↔ข้อความ"

   ทดสอบเองก่อนได้ด้วย curl (ต้องมีไฟล์เสียงสั้นๆ base64 encode ไว้ก่อน):
   curl -X POST https://tanot-whisper-proxy.<ชื่อบัญชี>.workers.dev/ \
     -H "Content-Type: application/json" \
     -H "Origin: https://tanot713-sudo.github.io" \
     -d '{"audio":"<base64>","language":"th"}'
   ถ้าเห็น {"text":"...","neurons":...} กลับมา แปลว่าใช้งานได้แล้ว ──────────────────────── */
