/* POST /api/ai/embed — เวกเตอร์ความหมายภาษาไทย/อังกฤษด้วย bge-m3 (1024 มิติ)
   body: { texts: string[] } (สูงสุด 64 ข้อความ ข้อความละ ≤ 8000 ตัวอักษร) หรือ { text: string }
   ตอบ { model, dims, vectors: number[][] } */
import { MODELS, json, readBody, clampInt, checkQuota, recordUsage, aiErrorResponse, estTokens, neuronsFor } from '../../_lib/ai.js';

const MAX_TEXTS = 64;
const MAX_CHARS_EACH = 8000;

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json(500, { error: 'AI binding not configured' });
  if (!env.DB) return json(500, { error: 'DB binding not configured' });

  const body = await readBody(request);
  if (!body) return json(400, { error: 'Invalid JSON body' });
  const texts = Array.isArray(body.texts) ? body.texts : typeof body.text === 'string' ? [body.text] : null;
  if (!texts || !texts.length) return json(400, { error: 'texts must be a non-empty array of strings' });
  if (texts.length > MAX_TEXTS) return json(400, { error: 'too many texts (max ' + MAX_TEXTS + ')' });
  let chars = 0;
  for (const t of texts) {
    if (typeof t !== 'string' || !t.trim()) return json(400, { error: 'every text must be a non-empty string' });
    if (t.length > MAX_CHARS_EACH) return json(400, { error: 'text too long (max ' + MAX_CHARS_EACH + ' chars each)' });
    chars += t.length;
  }

  const model = MODELS.embed;
  const tokensIn = estTokens(chars);
  const neurons = neuronsFor(model, tokensIn, 0);
  const blocked = await checkQuota(env, neurons);
  if (blocked) return blocked;

  let result;
  try {
    result = await env.AI.run(model.id, { text: texts });
  } catch (err) {
    return aiErrorResponse(err);
  }
  const vectors = result && result.data;
  if (!Array.isArray(vectors) || vectors.length !== texts.length) {
    return json(502, { error: 'Unexpected embedding response', code: 'upstream' });
  }
  await recordUsage(env, 'embed', { neurons, tokensIn });
  return json(200, { model: model.id, dims: vectors[0].length, vectors });
}
