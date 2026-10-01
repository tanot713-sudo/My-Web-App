/* แทน Worker tanot-whisper-proxy (ต้นฉบับ: docs/whisper-worker-original.js) — ใช้ binding AI จาก wrangler.toml
   ฝั่งเซิร์ฟเวอร์นับ Neurons ลง ai_usage (kind 'asr') ร่วมโควตาเดียวกับ /api/ai/* — ดู functions/_lib/ai.js
   ฝั่งเว็บ (text-to-speech.js) ยังเตือนก่อนเกินโควตาเองจากค่า neurons ที่ส่งกลับไป */

import { recordUsage, WHISPER_NEURONS_PER_MINUTE } from '../_lib/ai.js';

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json(500, { error: 'AI binding not configured' });

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }
  const audio = body.audio;
  if (!audio || typeof audio !== 'string') {
    return json(400, { error: 'Missing "audio" (base64 string) in request body' });
  }

  const input = { audio };
  if (body.language) input.language = body.language;

  let result;
  try {
    result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', input);
  } catch (err) {
    return json(502, { error: 'Transcription failed: ' + (err && err.message ? err.message : String(err)) });
  }

  /* ไม่มี usage.neurons กลับมา → ประมาณจากขนาดไฟล์ (WAV 16kHz mono 16-bit = 32,000 ไบต์/วินาที, base64 ใหญ่กว่า 4/3) */
  const reported = result && result.usage && result.usage.neurons;
  const estMinutes = (audio.length * 0.75) / 32000 / 60;
  await recordUsage(env, 'asr', { neurons: reported || estMinutes * WHISPER_NEURONS_PER_MINUTE });

  return json(200, {
    text: (result && result.text) || '',
    neurons: reported || null,
  });
}
