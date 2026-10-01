/* POST /api/ai/summarize — สรุปแบบไม่สตรีม + แคชผลใน D1 (ai_cache) แทน Firebase (ai-summary-cache.js)
   body: { messages, task?: 'stock:globalstock' | 'meeting' | …, model?: 'main' | 'fast', max_tokens?,
           temperature?, ttlHours?, refresh? }
   คีย์แคช = sha256(task + model + messages + max_tokens) — ข้อมูลที่ป้อนเหมือนเดิมเป๊ะ (ตัวเลขราคา/สัญญาณชุดเดิม)
   ได้ผลเดิมทันทีโดยไม่เสีย Neurons; ตัวเลขเปลี่ยน = คีย์เปลี่ยน = สรุปใหม่ · หมดอายุหลัง ttlHours (ค่าเริ่มต้น 168)
   ตอบ { text, cached, model, createdAt?, neurons? } */
import {
  json, readBody, validateMessages, pickModel, prepareMessages, clampInt, clampNum, checkQuota, recordUsage,
  aiErrorResponse, textOf, usageOf, estTokens, neuronsFor, stripThink, sha256Hex, cacheGet, cachePut,
} from '../../_lib/ai.js';

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json(500, { error: 'AI binding not configured' });
  if (!env.DB) return json(500, { error: 'DB binding not configured' });

  const body = await readBody(request);
  if (!body) return json(400, { error: 'Invalid JSON body' });
  const v = validateMessages(body.messages);
  if (v.error) return json(400, { error: v.error });

  const model = pickModel(body.model);
  const maxTokens = clampInt(body.max_tokens, 1, 2048, 700);
  const temperature = clampNum(body.temperature, 0, 1, 0.3);
  const task = String(body.task || 'summary').replace(/[^\w:.\-]/g, '_').slice(0, 60);
  const ttlMs = clampInt(body.ttlHours, 1, 720, 168) * 3600 * 1000;
  const key = await sha256Hex(JSON.stringify([task, model.id, maxTokens, v.messages]));

  if (!body.refresh) {
    const hit = await cacheGet(env, key, ttlMs);
    if (hit) return json(200, { text: hit.text, cached: true, model: hit.model, createdAt: hit.createdAt });
  }

  const tokensInEst = estTokens(v.chars);
  const blocked = await checkQuota(env, neuronsFor(model, tokensInEst, maxTokens / 2));
  if (blocked) return blocked;

  let result;
  try {
    result = await env.AI.run(model.id, { messages: prepareMessages(model, v.messages), max_tokens: maxTokens, temperature });
  } catch (err) {
    return aiErrorResponse(err);
  }

  const text = stripThink(textOf(result));
  const u = usageOf(result);
  const tokensIn = u && u.tokensIn ? u.tokensIn : tokensInEst;
  const tokensOut = u && u.tokensOut ? u.tokensOut : estTokens(text.length);
  const neurons = neuronsFor(model, tokensIn, tokensOut);
  await recordUsage(env, 'summarize', { neurons, tokensIn, tokensOut });

  if (!text) return json(502, { error: 'Model returned an empty answer', code: 'empty' });
  try { await cachePut(env, key, task, model.id, text); } catch (e) { /* แคชพลาดไม่ทำให้ผลสรุปที่ได้แล้วหาย */ }
  return json(200, { text, cached: false, model: model.id, neurons: Math.round(neurons * 100) / 100 });
}
