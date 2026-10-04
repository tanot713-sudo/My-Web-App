/* POST /api/ai/image — สร้างภาพจากข้อความด้วย Workers AI (FLUX) แล้วเก็บลง R2 + ตาราง files (ns 'images', ref = preset)
   body: { prompt, preset: 'background'|'icon'|'free', mode: 'light'|'dark', model: 'fast'|'quality', seed? }
   ตอบ { id, name, mime, size, model, seed, neurons, width, height, preset, mode, prompt(เต็ม) }
   โมเดล (เอกสาร: https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/ · .../flux-2-klein-4b/):
     fast    = @cf/black-forest-labs/flux-1-schnell — input JSON { prompt (≤2048), steps (≤8) } → { image: base64 } ขนาดคงที่ 1024×1024 (ไม่มี seed/width/height)
     quality = @cf/black-forest-labs/flux-2-klein-4b — input { multipart: { body, contentType } } (ฟอร์ม prompt/width/height/seed) → { image: base64 }
   ค่า Neurons ต่อภาพ: ดู MODELS ใน _lib/ai.js · error โควตาใช้ checkQuota / aiErrorResponse ชุดเดียวกับ endpoint อื่น */
import { MODELS, json, readBody, clampInt, checkQuota, recordUsage, aiErrorResponse, imageNeurons } from '../../_lib/ai.js';
import { putFile } from '../../_lib/files.js';

export const MAX_PROMPT = 1500;
export const PRESETS = ['background', 'icon', 'free'];
export const MODES = ['light', 'dark'];
export const IMAGE_MODELS = { fast: MODELS.imageFast, quality: MODELS.imageQuality };

/* สไตล์ที่ต่อท้าย prompt ฝั่งเซิร์ฟเวอร์ (ผู้ใช้ไม่ต้องพิมพ์ซ้ำ และแก้จากหน้าเว็บไม่ได้) */
export const PRESET_SUFFIX = {
  background: 'soft minimal illustration, muted colors, subtle and calm, large empty negative space on the left and center, objects only near the right edge, no people, no hands, no faces, no text, no letters, no numbers, no logo, no watermark',
  icon: 'app icon, flat vector style, one simple bold symbol centered, symbol fills about 60 percent of the canvas with generous even margin, solid flat background color filling the whole square edge to edge, no border, no frame, no shadow, no text, no letters, crisp clean edges, readable when very small',
  free: '',
};
export const MODE_SUFFIX = {
  light: 'light airy pastel tones on an off-white background, bright and clean',
  dark: 'deep dark charcoal and navy tones, low contrast, quiet night mood',
};

/* ขนาดภาพ: พื้นหลัง 16:9 (1024×576, ทวีคูณของ 16) / อื่นๆ 1:1 — schnell ไม่รับขนาด จึงได้ 1024×1024 เสมอ */
export function sizeFor(preset, model) {
  if (!model.sized) return { width: 1024, height: 1024 };
  return preset === 'background' ? { width: 1024, height: 576 } : { width: 1024, height: 1024 };
}

export function buildPrompt(prompt, preset, mode) {
  const parts = [prompt];
  if (PRESET_SUFFIX[preset]) parts.push(PRESET_SUFFIX[preset]);
  if (preset === 'background') parts.push(MODE_SUFFIX[mode]);
  return parts.join(', ');
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ชนิดไฟล์ดูจากไบต์แรก (ไม่เชื่อโมเดลว่าส่ง PNG หรือ JPEG) — อื่นๆ ที่ไม่ใช่ภาพ = null */
export function sniffImage(b) {
  if (b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return { mime: 'image/webp', ext: 'webp' };
  return null;
}

async function toBytes(res) {
  const img = res && typeof res === 'object' && !(res instanceof ReadableStream) && !(res instanceof ArrayBuffer) ? res.image : res;
  if (typeof img === 'string') return b64ToBytes(img.replace(/^data:[^,]*,/, ''));
  if (img instanceof ReadableStream) return new Uint8Array(await new Response(img).arrayBuffer());
  if (img instanceof ArrayBuffer) return new Uint8Array(img);
  return null;
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json(500, { error: 'AI binding not configured' });
  if (!env.DB) return json(500, { error: 'DB binding not configured' });
  if (!env.FILES) return json(500, { error: 'R2 binding FILES missing' });
  // คำขอเขียนต้องมาจากหน้าของเราเอง — กัน CSRF ที่อาศัยคุกกี้ Access (เหมือน /api/files)
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json(403, { error: 'Forbidden origin' });

  const body = await readBody(request);
  if (!body || typeof body !== 'object') return json(400, { error: 'Invalid JSON body' });
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return json(400, { error: 'prompt is required' });
  if (prompt.length > MAX_PROMPT) return json(400, { error: 'prompt too long (max ' + MAX_PROMPT + ' chars)' });
  const preset = body.preset === undefined ? 'free' : body.preset;
  if (!PRESETS.includes(preset)) return json(400, { error: 'preset must be one of ' + PRESETS.join('|') });
  const mode = body.mode === undefined ? 'light' : body.mode;
  if (!MODES.includes(mode)) return json(400, { error: 'mode must be one of ' + MODES.join('|') });
  const modelKey = body.model === undefined ? 'fast' : body.model;
  if (!Object.prototype.hasOwnProperty.call(IMAGE_MODELS, modelKey)) return json(400, { error: 'model must be fast|quality' });
  const model = IMAGE_MODELS[modelKey];

  const full = buildPrompt(prompt, preset, mode);
  const { width, height } = sizeFor(preset, model);
  const neurons = imageNeurons(model, width, height);
  const blocked = await checkQuota(env, neurons);
  if (blocked) return blocked;

  // seed: โมเดลที่รับ seed ใช้ค่าที่ผู้ใช้ส่งมา (หรือสุ่ม) · schnell ไม่รับ → null
  const seed = model.seed ? clampInt(body.seed, 0, 4294967295, Math.floor(Math.random() * 4294967296)) : null;

  let result;
  try {
    if (model.sized) {
      const form = new FormData();
      form.append('prompt', full);
      form.append('width', String(width));
      form.append('height', String(height));
      form.append('seed', String(seed));
      const r = new Response(form);
      result = await env.AI.run(model.id, { multipart: { body: r.body, contentType: r.headers.get('content-type') } });
    } else {
      result = await env.AI.run(model.id, { prompt: full, steps: model.steps });
    }
  } catch (err) {
    return aiErrorResponse(err);
  }
  const bytes = await toBytes(result);
  const kind = bytes && bytes.length ? sniffImage(bytes) : null;
  if (!kind) return json(502, { error: 'Unexpected image response', code: 'upstream' });

  let saved;
  try {
    saved = await putFile(env, { ns: 'images', ref: preset, name: 'image-' + preset + '-' + Date.now().toString(36) + '.' + kind.ext, mime: kind.mime, bytes: bytes.buffer });
  } catch (e) {
    return json(500, { error: 'บันทึกภาพไม่สำเร็จ' });
  }
  await recordUsage(env, 'image', { neurons });
  return json(200, { id: saved.id, name: saved.name, mime: saved.mime, size: saved.size, model: model.id, seed, neurons, width, height, preset, mode, prompt: full });
}
