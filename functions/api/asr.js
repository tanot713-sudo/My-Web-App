/* แทน Worker tanot-whisper-proxy (ต้นฉบับ: docs/whisper-worker-original.js) — ใช้ binding AI จาก wrangler.toml
   ฝั่งเว็บ (text-to-speech.js) ยังเป็นคนนับโควตา Neurons รายวันเองจากค่า neurons ที่ส่งกลับไป */

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

  return json(200, {
    text: (result && result.text) || '',
    neurons: (result && result.usage && result.usage.neurons) || null,
  });
}
