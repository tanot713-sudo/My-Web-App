/* ══════════════════════════════════════════════════════════════════
   Tanot OCR Proxy — Cloudflare Worker
   คั่นระหว่างเว็บ (doc-check.html) กับ Anthropic API เพื่อไม่ให้ API key
   หลุดไปอยู่ในโค้ดฝั่งเบราว์เซอร์ — รับรูปภาพจากเว็บ ส่งต่อไป Claude Vision
   อ่านข้อความในรูป แล้วส่งข้อความที่อ่านได้กลับไป

   วิธี deploy: ดูคำแนะนำที่แชทแยกต่างหาก (ไม่ต้องใช้ CLI ก็ได้ ใช้ dashboard
   ของ Cloudflare วาง code นี้ตรงๆ ได้เลย)
   ══════════════════════════════════════════════════════════════════ */

// ตรวจรุ่นโมเดลล่าสุดได้ที่ https://docs.claude.com/en/docs/about-claude/models
// ถ้า deploy แล้วขึ้น error ว่าไม่รู้จักโมเดล ให้เปลี่ยนบรรทัดนี้เป็นชื่อรุ่นปัจจุบัน
const MODEL = 'claude-sonnet-4-5';

// จำกัดให้เรียกได้เฉพาะจาก origin ของเว็บตัวเอง กัน key ถูกคนอื่นแอบใช้ผ่าน worker
// เปลี่ยนเป็นโดเมนจริงของเว็บคุณ (ดูจาก URL บนแถบที่อยู่ตอนเปิดเว็บ) — ใส่ได้หลายโดเมน
const ALLOWED_ORIGINS = [
  'https://tanot713-sudo.github.io',
  'http://localhost:8000', // สำหรับทดสอบในเครื่องตัวเอง (ปรับพอร์ตตามจริง)
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
        status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const { imageBase64, mediaType, prompt } = body;
    if (!imageBase64 || !mediaType) {
      return new Response(JSON.stringify({ error: 'missing imageBase64 or mediaType' }), {
        status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Prompt นี้ปรับตามแนวทางจาก claude-cookbooks (multimodal/best_practices_for_vision.ipynb,
    // how_to_transcribe_text.ipynb): (1) role assignment ช่วยลด hallucination บนงานภาพ
    // (2) กฎ "ห้ามแก้คำผิด" คือส่วนสำคัญที่สุดของ prompt นี้ — ปกติโมเดลมักจะ "ช่วย" แก้คำสะกด/
    // ไวยากรณ์ที่มันเห็นว่าผิดโดยอัตโนมัติ (คล้าย hallucination ที่ cookbook พูดถึง) ซึ่งจะทำลาย
    // จุดประสงค์ของเครื่องมือนี้ทันที เพราะขั้นตอนถัดไปคือส่งข้อความที่ถอดได้ไปตรวจคำผิดต่อ —
    // ถ้า Claude แอบแก้คำผิดให้ตั้งแต่ตอน OCR ผู้ใช้จะไม่มีทางเห็นคำผิดตัวจริงในเอกสารเลย
    const userPrompt = prompt ||
      'คุณเป็นระบบถอดข้อความ (OCR) มืออาชีพ ทำหน้าที่อ่านข้อความในภาพนี้ให้ตรงกับต้นฉบับที่สุด\n' +
      'กฎสำคัญ:\n' +
      '1. ถอดข้อความทุกตัวอักษรตามที่ปรากฏจริงในภาพ (รวมลายมือเขียนถ้ามี) ห้ามแก้คำผิด ไวยากรณ์ ' +
      'หรือการสะกดใดๆ แม้จะรู้ว่าผิด — ให้คงคำผิดนั้นไว้ตรงๆ เพราะข้อความนี้จะถูกนำไปตรวจคำผิดต่อในขั้นตอนถัดไป\n' +
      '2. เรียงข้อความตามลำดับที่ปรากฏในภาพจากบนลงล่าง ซ้ายไปขวา คงการขึ้นบรรทัดใหม่/ย่อหน้าตามต้นฉบับ\n' +
      '3. ห้ามแปล ห้ามสรุป ห้ามใส่คำอธิบายหรือความเห็นใดๆ ห้ามใส่ markdown หรือเครื่องหมายคำพูดครอบ\n' +
      '4. ถ้าบางจุดอ่านไม่ออกจริงๆ ให้ใส่ [อ่านไม่ออก] แทนที่จุดนั้นแล้วอ่านต่อ\n' +
      '5. ถ้าในภาพไม่มีข้อความเลยให้ตอบว่า "ไม่พบข้อความในภาพ" คำเดียว\n' +
      'พิมพ์เฉพาะข้อความที่ถอดได้เท่านั้น ไม่ต้องมีหัวข้อหรือคำนำใดๆ ก่อนเริ่มถอดข้อความ';

    try {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
              { type: 'text', text: userPrompt },
            ],
          }],
        }),
      });

      const data = await anthropicRes.json();
      if (!anthropicRes.ok) {
        return new Response(JSON.stringify({ error: data.error?.message || 'Anthropic API error', raw: data }), {
          status: anthropicRes.status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        });
      }

      const text = (data.content || []).map((c) => c.text || '').join('');
      return new Response(JSON.stringify({ text }), {
        status: 200, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
  },
};
