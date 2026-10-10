/* แทน Worker tanot-whisper-proxy (ต้นฉบับ: docs/whisper-worker-original.js) — ใช้ binding AI จาก wrangler.toml
   ฝั่งเซิร์ฟเวอร์นับ Neurons ลง ai_usage (kind 'asr') ร่วมโควตาเดียวกับ /api/ai/* — ดู functions/_lib/ai.js
   ฝั่งเว็บ (asr-cloud.js / text-to-speech.js) ยังเตือนก่อนเกินโควตาเองจากค่า neurons ที่ส่งกลับไป

   body: { audio (base64 WAV), language?: 'th'|'en'|…, domain?: 'general'|'law'|'engineering'|'invest', initial_prompt?, model?, vad? }
   ตอบ: { text, segments: [{start,end,text}], neurons } · โมเดล/ภาษา/ชุดคำศัพท์/ความยาว prompt/ขนาดเสียงตรวจใน functions/_lib/asr.js
   โควตาเต็มจาก Workers AI (error 4006 "daily free allocation") → 429 code 'quota' (หน้าเว็บหยุดทั้งชุด ไม่ยิงท่อนที่เหลือ)
   หมายเหตุ: ที่นี่ไม่ checkQuota ล่วงหน้าเหมือน /api/ai/* — หน้าเว็บเตือนค่าใช้จ่ายส่วนเกินแล้วให้ผู้ใช้ตัดสินใจเองได้ (เปิดบัญชีแบบจ่ายเงิน) */

import { recordUsage, WHISPER_NEURONS_PER_MINUTE, json, aiErrorResponse } from '../_lib/ai.js';
import { buildAsrInput, compactSegments } from '../_lib/asr.js';

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json(500, { error: 'AI binding not configured' });

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }
  const built = buildAsrInput(body);
  if (built.error) return json(built.status || 400, { error: built.error });
  const { model, input } = built;

  let result;
  try {
    result = await env.AI.run(model, input);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (/neurons|daily.{0,20}(free )?allocation|quota|rate limit/i.test(msg)) return aiErrorResponse(err);
    return json(502, { error: 'Transcription failed: ' + msg, code: 'upstream' });
  }

  /* ไม่มี usage.neurons กลับมา → ประมาณจากขนาดไฟล์ (WAV 16kHz mono 16-bit = 32,000 ไบต์/วินาที, base64 ใหญ่กว่า 4/3) */
  const reported = result && result.usage && result.usage.neurons;
  const estMinutes = (input.audio.length * 0.75) / 32000 / 60;
  await recordUsage(env, 'asr', { neurons: reported || estMinutes * WHISPER_NEURONS_PER_MINUTE });

  return json(200, {
    text: (result && result.text) || '',
    segments: compactSegments(result),
    neurons: reported || null,
  });
}
