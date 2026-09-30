/* แทน Worker tanot-ocr-proxy (ต้นฉบับ: docs/ocr-worker-original.js) — อ่านข้อความในรูปด้วย Claude Vision
   ANTHROPIC_API_KEY เป็น secret ที่ตั้งใน Pages dashboard เท่านั้น ห้ามใส่ใน wrangler.toml หรือโค้ด
   ใช้ fetch ตรงแทน SDK เพราะ repo นี้ห้ามมี package.json ที่ root (Pages จะรัน npm install ทุก build) */

import { recordUsage } from '../_lib/ai.js';

const MODEL = 'claude-sonnet-5';

/* prompt ถอดข้อความเดิมจาก Worker ต้นฉบับ — คงไว้ทุกตัวอักษร ข้อสำคัญที่สุดคือ "ห้ามแก้คำผิด" เพราะข้อความที่ได้
   จะถูกส่งไปตรวจคำผิดต่อ ถ้าโมเดลแอบแก้ให้ตั้งแต่ตอน OCR ผู้ใช้จะไม่เห็นคำผิดจริงในเอกสารเลย */
const DEFAULT_PROMPT =
  'คุณเป็นระบบถอดข้อความ (OCR) มืออาชีพ ทำหน้าที่อ่านข้อความในภาพนี้ให้ตรงกับต้นฉบับที่สุด\n' +
  'กฎสำคัญ:\n' +
  '1. ถอดข้อความทุกตัวอักษรตามที่ปรากฏจริงในภาพ (รวมลายมือเขียนถ้ามี) ห้ามแก้คำผิด ไวยากรณ์ ' +
  'หรือการสะกดใดๆ แม้จะรู้ว่าผิด — ให้คงคำผิดนั้นไว้ตรงๆ เพราะข้อความนี้จะถูกนำไปตรวจคำผิดต่อในขั้นตอนถัดไป\n' +
  '2. เรียงข้อความตามลำดับที่ปรากฏในภาพจากบนลงล่าง ซ้ายไปขวา คงการขึ้นบรรทัดใหม่/ย่อหน้าตามต้นฉบับ\n' +
  '3. ห้ามแปล ห้ามสรุป ห้ามใส่คำอธิบายหรือความเห็นใดๆ ห้ามใส่ markdown หรือเครื่องหมายคำพูดครอบ\n' +
  '4. ถ้าบางจุดอ่านไม่ออกจริงๆ ให้ใส่ [อ่านไม่ออก] แทนที่จุดนั้นแล้วอ่านต่อ\n' +
  '5. ถ้าในภาพไม่มีข้อความเลยให้ตอบว่า "ไม่พบข้อความในภาพ" คำเดียว\n' +
  'พิมพ์เฉพาะข้อความที่ถอดได้เท่านั้น ไม่ต้องมีหัวข้อหรือคำนำใดๆ ก่อนเริ่มถอดข้อความ';

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json(500, { error: 'ANTHROPIC_API_KEY secret not configured' });

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json(400, { error: 'invalid JSON body' });
  }
  const { imageBase64, mediaType, prompt } = body;
  if (!imageBase64 || !mediaType) return json(400, { error: 'missing imageBase64 or mediaType' });

  let res, data;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: prompt || DEFAULT_PROMPT },
          ],
        }],
      }),
    });
    data = await res.json();
  } catch (e) {
    return json(502, { error: 'Anthropic API unreachable: ' + String(e) });
  }

  if (!res.ok) {
    return json(res.status, { error: (data && data.error && data.error.message) || 'Anthropic API error' });
  }
  if (data.stop_reason === 'refusal') {
    return json(422, { error: 'Model declined to transcribe this image' });
  }

  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  // Anthropic คิดเงินแยกจาก Workers AI — บันทึกแค่จำนวนคำขอ/โทเค็น (neurons = 0) ไม่นับรวมโควตา Neurons
  await recordUsage(env, 'ocr', { tokensIn: data.usage && data.usage.input_tokens, tokensOut: data.usage && data.usage.output_tokens });
  return json(200, { text });
}
