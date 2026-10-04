/* ตัวช่วยร่วมของ /api/ai/* (chat / summarize / embed / usage / image) — ไฟล์นี้ไม่ export onRequest* จึงไม่ใช่ route
   ทุก endpoint ใต้ /api/ อยู่หลัง _middleware.js (Cloudflare Access) อยู่แล้ว

   โควตา: Workers AI ฟรีวันละ 10,000 Neurons ใช้ร่วมกันทุกโมเดลรวม Whisper — นับที่ตาราง ai_usage (day เป็น UTC
   ตรงกับรอบตัดของ Cloudflare) ค่าเพดานตั้งได้ที่ [vars] AI_DAILY_NEURONS ใน wrangler.toml (ถ้าอัปเกรด Workers Paid)
   ⚠️ อัตรา Neurons/ล้านโทเค็นด้านล่างเป็นค่าประมาณจากราคาที่ Cloudflare ประกาศ ยังไม่ได้ยืนยันกับเอกสารทางการ
   (ตัวเลขแหล่งที่พบขัดกันเองที่ output ของ qwen3) จึงเลือกค่าสูงไว้ก่อนเพื่อให้เผื่อโควตามากกว่าน้อย
   — ถ้าไม่ตรงให้แก้เฉพาะตาราง MODELS นี้ที่เดียว */

export const MODELS = {
  main: { id: '@cf/aisingapore/gemma-sea-lion-v4-27b-it', inRate: 31909, outRate: 50455, noThink: false },
  fast: { id: '@cf/qwen/qwen3-30b-a3b-fp8', inRate: 4625, outRate: 68182, noThink: true },
  embed: { id: '@cf/baai/bge-m3', inRate: 1075, outRate: 0, noThink: false },
  /* สร้างภาพ (/api/ai/image) — คิดเป็น Neurons ต่อภาพ ไม่ใช่ต่อโทเค็น · ราคา: https://developers.cloudflare.com/workers-ai/platform/pricing/
     flux-1-schnell: 4.80 neurons ต่อ tile 512×512 + 9.60 ต่อ step (รับแค่ prompt+steps ≤8, ภาพออกขนาดคงที่ 1024×1024 ไม่มี width/height/seed)
       https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
     flux-2-klein-4b: 26.05 neurons ต่อ tile 512×512 ของภาพออก (+5.37 ต่อ tile ภาพอ้างอิงขาเข้า — เราไม่ส่ง) · input เป็น multipart (prompt, width, height, seed)
       https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/
     (เลือก 4b ไม่ใช้ 9b: 9b คิด 1,363 neurons ต่อภาพ 1 MP ≈ 7 ภาพ/วันของโควตาฟรี)
     ⚠️ ชื่อฟิลด์ multipart/ขนาดสูงสุดของ klein อ่านจาก schema ใน repo เอกสารของ Cloudflare ซึ่งระบุแค่ { multipart } ยังไม่ได้ยิงกับ Workers AI จริง
     จึงใส่ margin ×IMAGE_MARGIN ให้คิดเผื่อสูงไว้ก่อน — ถ้าไม่ตรงให้แก้เฉพาะตารางนี้ที่เดียว */
  imageFast: { id: '@cf/black-forest-labs/flux-1-schnell', perTile: 4.8, perStep: 9.6, steps: 4, sized: false, seed: false },
  imageQuality: { id: '@cf/black-forest-labs/flux-2-klein-4b', perTile: 26.05, perStep: 0, steps: 0, sized: true, seed: true },
};
export const IMAGE_MARGIN = 1.25;
export const DEFAULT_DAILY_NEURONS = 10000;
export const WHISPER_NEURONS_PER_MINUTE = 46.63;

const MAX_MESSAGES = 40;
const MAX_TOTAL_CHARS = 120000;

export function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function today() { return new Date().toISOString().slice(0, 10); }
export function dailyLimit(env) {
  const n = Number(env.AI_DAILY_NEURONS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_NEURONS;
}

/* ประมาณโทเค็นจากจำนวนตัวอักษร (ไทยหนาแน่นกว่าอังกฤษ → หาร 2 ให้เผื่อสูงไว้) ใช้เฉพาะเมื่อ API ไม่ส่ง usage กลับมา */
export function estTokens(chars) { return Math.ceil(chars / 2); }
export function neuronsFor(model, tokensIn, tokensOut) {
  return (tokensIn * model.inRate + tokensOut * model.outRate) / 1e6;
}

export async function readBody(request) {
  try { return await request.json(); } catch (e) { return null; }
}

/* ตรวจ messages ก่อนส่งเข้าโมเดล: คืน { messages, chars } หรือ { error } */
export function validateMessages(raw) {
  if (!Array.isArray(raw) || !raw.length) return { error: 'messages must be a non-empty array' };
  if (raw.length > MAX_MESSAGES) return { error: 'too many messages (max ' + MAX_MESSAGES + ')' };
  let chars = 0;
  const messages = [];
  for (const m of raw) {
    if (!m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string') {
      return { error: 'each message needs role (system|user|assistant) and string content' };
    }
    chars += m.content.length;
    messages.push({ role: m.role, content: m.content });
  }
  if (chars > MAX_TOTAL_CHARS) return { error: 'messages too long (max ' + MAX_TOTAL_CHARS + ' chars)' };
  return { messages, chars };
}

/* Neurons ที่ประเมินต่อภาพ (ปัดขึ้น + margin) — tile = 512×512 ปัดขึ้นทั้งสองแกน */
export function imageNeurons(model, width, height) {
  const tiles = Math.ceil(width / 512) * Math.ceil(height / 512);
  return Math.ceil((tiles * model.perTile + model.steps * model.perStep) * IMAGE_MARGIN * 100) / 100;
}

export function pickModel(name) { return name === 'fast' ? MODELS.fast : MODELS.main; }

/* จัดข้อความให้เป็นรูปที่ chat template ของโมเดลรับได้ทุกตัว: template แบบ Gemma (SEA-LION) มี system ได้แค่ข้อความแรกและบังคับให้
   user/assistant สลับกัน — แต่หน้าเว็บส่ง system ซ้อนหลายข้อความ (system prompt + บริบทหน้า + คำสั่ง "ย้ำ" ท้ายสุด) ตามที่โมเดลในเบราว์เซอร์ต้องการ
   → รวม system ที่นำหน้าเป็นข้อความเดียว, system ที่แทรกทีหลัง (คำสั่งย้ำ) ต่อท้ายข้อความ user ล่าสุดแทน (ยังอยู่ใกล้จุดเริ่มตอบ),
   และรวมข้อความ role เดียวกันที่ติดกัน
   Qwen3 คิดยาวก่อนตอบโดยปริยาย (เสียโทเค็น/Neurons) — "/no_think" ท้ายข้อความ user ล่าสุดคือสวิตช์ของ Qwen3 เอง */
export function prepareMessages(model, messages) {
  const lead = [];
  let i = 0;
  while (i < messages.length && messages[i].role === 'system') lead.push(messages[i++].content);
  const later = [];
  const convo = [];
  for (; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'system') { later.push(m.content); continue; }
    const prev = convo[convo.length - 1];
    if (prev && prev.role === m.role) prev.content += '\n\n' + m.content;
    else convo.push({ role: m.role, content: m.content });
  }
  let lastUser = -1;
  for (let k = convo.length - 1; k >= 0; k--) if (convo[k].role === 'user') { lastUser = k; break; }
  if (later.length) {
    if (lastUser >= 0) convo[lastUser].content += '\n\n' + later.join('\n\n');
    else convo.push({ role: 'user', content: later.join('\n\n') });
    if (lastUser < 0) lastUser = convo.length - 1;
  }
  if (model.noThink && lastUser >= 0) convo[lastUser].content += ' /no_think';
  const out = [];
  if (lead.length) out.push({ role: 'system', content: lead.join('\n\n') });
  return out.concat(convo);
}

export function clampInt(v, lo, hi, dflt) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}
export function clampNum(v, lo, hi, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}

/* ── โควตา / usage ── */
export async function usedToday(env) {
  const row = await env.DB.prepare('SELECT COALESCE(SUM(neurons), 0) AS n FROM ai_usage WHERE day = ?').bind(today()).first();
  return row ? Number(row.n) || 0 : 0;
}

/* คืน Response 429 ถ้าคำขอนี้ (ประมาณการ) จะเกินเพดานวันนี้ ไม่งั้นคืน null */
export async function checkQuota(env, estimateNeurons) {
  const limit = dailyLimit(env);
  const used = await usedToday(env);
  if (used + estimateNeurons > limit) {
    return json(429, {
      error: 'Workers AI daily quota reached', code: 'quota',
      used: Math.round(used), limit, remaining: Math.max(0, Math.round(limit - used)),
    });
  }
  return null;
}

export async function recordUsage(env, kind, { neurons = 0, tokensIn = 0, tokensOut = 0 } = {}) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      'INSERT INTO ai_usage (day, kind, requests, neurons, tokens_in, tokens_out) VALUES (?, ?, 1, ?, ?, ?) ' +
      'ON CONFLICT(day, kind) DO UPDATE SET requests = requests + 1, neurons = neurons + excluded.neurons, ' +
      'tokens_in = tokens_in + excluded.tokens_in, tokens_out = tokens_out + excluded.tokens_out'
    ).bind(today(), kind, neurons, Math.round(tokensIn), Math.round(tokensOut)).run();
  } catch (e) { /* บันทึกโควตาพลาดต้องไม่ทำให้คำตอบที่ได้แล้วหาย */ }
}

/* Workers AI ตอบ error เมื่อโควตาฟรีหมด (ข้อความมี "neurons"/"allocation") → แปลงเป็น 429 ให้ไคลเอนต์ถอยไปใช้ตัวสำรอง */
export function aiErrorResponse(err) {
  const msg = err && err.message ? err.message : String(err);
  if (/neurons|daily.{0,20}(free )?allocation|quota|rate limit/i.test(msg)) {
    return json(429, { error: 'Workers AI quota/rate limit: ' + msg, code: 'quota' });
  }
  return json(502, { error: 'AI request failed: ' + msg, code: 'upstream' });
}

/* ── อ่านผลลัพธ์ (ทั้งรูปแบบ { response } และแบบ chat-completions { choices }) ── */
export function textOf(j) {
  if (!j) return '';
  if (typeof j.response === 'string') return j.response;
  const c = j.choices && j.choices[0];
  if (c) {
    if (c.delta && typeof c.delta.content === 'string') return c.delta.content;
    if (c.message && typeof c.message.content === 'string') return c.message.content;
    if (typeof c.text === 'string') return c.text;
  }
  return '';
}
export function usageOf(j) {
  const u = j && j.usage;
  if (!u) return null;
  return { tokensIn: Number(u.prompt_tokens) || 0, tokensOut: Number(u.completion_tokens) || 0 };
}

/* ตัด <think>…</think> ของ Qwen3 (ถ้าหลุดมา) — ใช้กับข้อความเต็ม */
export function stripThink(text) {
  return String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\s*<\/think>/, '').trim();
}

/* ตัวกรองแบบสตรีม: ซ่อนทุกอย่างระหว่าง <think> ... </think> (แท็กอาจถูกหั่นข้ามท่อน จึงถือท้ายข้อความไว้ก่อนถ้าอาจเป็นแท็กที่ยังมาไม่ครบ) */
export function makeThinkFilter() {
  let buf = '', inThink = false;
  const OPEN = '<think>', CLOSE = '</think>';
  function keepTail(s, tag) {
    for (let k = Math.min(tag.length - 1, s.length); k > 0; k--) if (tag.startsWith(s.slice(s.length - k))) return k;
    return 0;
  }
  return {
    push(chunk) {
      buf += chunk;
      let out = '';
      for (;;) {
        if (inThink) {
          const i = buf.indexOf(CLOSE);
          if (i < 0) { buf = buf.slice(Math.max(0, buf.length - (CLOSE.length - 1))); return out; }
          buf = buf.slice(i + CLOSE.length); inThink = false;
        } else {
          const i = buf.indexOf(OPEN);
          if (i < 0) {
            const hold = keepTail(buf, OPEN);
            out += buf.slice(0, buf.length - hold); buf = buf.slice(buf.length - hold);
            return out;
          }
          out += buf.slice(0, i); buf = buf.slice(i + OPEN.length); inThink = true;
        }
      }
    },
    flush() { const out = inThink ? '' : buf; buf = ''; return out; },
  };
}

/* ── แคชสรุป (ai_cache) ── */
export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const CACHE_KEEP_MS = 30 * 24 * 3600 * 1000;

export async function cacheGet(env, key, ttlMs) {
  const row = await env.DB.prepare('SELECT result, model, created_at FROM ai_cache WHERE key = ?').bind(key).first();
  if (!row || Date.now() - row.created_at > ttlMs) return null;
  await env.DB.prepare('UPDATE ai_cache SET hits = hits + 1 WHERE key = ?').bind(key).run();
  return { text: row.result, model: row.model, createdAt: row.created_at };
}
export async function cachePut(env, key, task, model, text) {
  await env.DB.prepare(
    'INSERT INTO ai_cache (key, task, model, result, created_at, hits) VALUES (?, ?, ?, ?, ?, 0) ' +
    'ON CONFLICT(key) DO UPDATE SET task = excluded.task, model = excluded.model, result = excluded.result, created_at = excluded.created_at, hits = 0'
  ).bind(key, task, model, text, Date.now()).run();
  if (Math.random() < 0.05) {
    await env.DB.prepare('DELETE FROM ai_cache WHERE created_at < ?').bind(Date.now() - CACHE_KEEP_MS).run();
  }
}
