/* GET /api/ai/usage — การใช้ Workers AI วันนี้ (UTC) เทียบเพดานรายวัน — รวมทุกชนิดงานรวม Whisper (asr) */
import { json, today, dailyLimit } from '../../_lib/ai.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return json(500, { error: 'DB binding not configured' });
  const day = today();
  const { results } = await env.DB.prepare(
    'SELECT kind, requests, neurons, tokens_in, tokens_out FROM ai_usage WHERE day = ? ORDER BY kind'
  ).bind(day).all();
  const used = results.reduce((s, r) => s + (Number(r.neurons) || 0), 0);
  const limit = dailyLimit(env);
  return json(200, {
    day, limit, used: Math.round(used), remaining: Math.max(0, Math.round(limit - used)),
    byKind: results.map((r) => ({ kind: r.kind, requests: r.requests, neurons: Math.round(Number(r.neurons) * 100) / 100, tokensIn: r.tokens_in, tokensOut: r.tokens_out })),
  });
}
