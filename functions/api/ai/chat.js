/* POST /api/ai/chat — แชทแบบสตรีม (SSE) บน Workers AI
   body: { messages: [{role, content}], model?: 'main' | 'fast', max_tokens?, temperature? }
   main = SEA-LION (ภาษาไทยดีที่สุด) · fast = Qwen3 (ถูกและเร็ว)
   ตอบเป็น text/event-stream ที่ normalize แล้ว (ไม่ว่าโมเดลจะส่งรูปแบบไหนมา):
     data: {"t":"ข้อความท่อนใหม่"}     … ซ้ำหลายครั้ง
     data: {"done":true,"model":"…","neurons":N,"tokens_in":N,"tokens_out":N}
   ถ้าโควตารายวันเต็มตอบ 429 {code:'quota'} ก่อนเรียกโมเดล (ไม่เสีย Neurons) */
import {
  json, readBody, validateMessages, pickModel, prepareMessages, clampInt, clampNum, checkQuota, recordUsage,
  aiErrorResponse, textOf, usageOf, estTokens, neuronsFor, makeThinkFilter,
} from '../../_lib/ai.js';

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json(500, { error: 'AI binding not configured' });
  if (!env.DB) return json(500, { error: 'DB binding not configured' });

  const body = await readBody(request);
  if (!body) return json(400, { error: 'Invalid JSON body' });
  const v = validateMessages(body.messages);
  if (v.error) return json(400, { error: v.error });

  const model = pickModel(body.model);
  const maxTokens = clampInt(body.max_tokens, 1, 2048, 512);
  const temperature = clampNum(body.temperature, 0, 1.5, 0.7);
  const tokensInEst = estTokens(v.chars);

  const blocked = await checkQuota(env, neuronsFor(model, tokensInEst, maxTokens / 2));
  if (blocked) return blocked;

  let upstream;
  try {
    upstream = await env.AI.run(model.id, {
      messages: prepareMessages(model, v.messages), stream: true, max_tokens: maxTokens, temperature,
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
  if (!upstream || typeof upstream.getReader !== 'function') {
    return json(502, { error: 'AI returned no stream', code: 'upstream' });
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const filter = model.noThink ? makeThinkFilter() : null;
  let pending = '', outChars = 0, usage = null;
  const send = (ctrl, obj) => ctrl.enqueue(enc.encode('data: ' + JSON.stringify(obj) + '\n\n'));

  function handleLine(ctrl, line) {
    line = line.trim();
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    let j;
    try { j = JSON.parse(payload); } catch (e) { return; }
    const u = usageOf(j);
    if (u) usage = u;
    let t = textOf(j);
    if (!t) return;
    if (filter) t = filter.push(t);
    if (t) { outChars += t.length; send(ctrl, { t }); }
  }

  const out = upstream.pipeThrough(new TransformStream({
    transform(chunk, ctrl) {
      pending += dec.decode(chunk, { stream: true });
      let i;
      while ((i = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, i); pending = pending.slice(i + 1);
        handleLine(ctrl, line);
      }
    },
    async flush(ctrl) {
      if (pending) handleLine(ctrl, pending);
      if (filter) { const rest = filter.flush(); if (rest) { outChars += rest.length; send(ctrl, { t: rest }); } }
      const tokensIn = usage && usage.tokensIn ? usage.tokensIn : tokensInEst;
      const tokensOut = usage && usage.tokensOut ? usage.tokensOut : estTokens(outChars);
      const neurons = neuronsFor(model, tokensIn, tokensOut);
      await recordUsage(env, 'chat', { neurons, tokensIn, tokensOut });
      send(ctrl, { done: true, model: model.id, neurons: Math.round(neurons * 100) / 100, tokens_in: tokensIn, tokens_out: tokensOut });
    },
  }));

  return new Response(out, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
