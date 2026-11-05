/* POST /api/ai/image — สร้างภาพจากข้อความด้วย Workers AI (FLUX) แล้วเก็บลง R2 + ตาราง files (ns 'images', ref = preset)
   body: { prompt, preset: 'background'|'icon'|'free', mode: 'light'|'dark', model: 'fast'|'quality', seed?, ref?, ratio? }
   ratio = '1:1'|'3:4'|'4:3'|'9:16'|'16:9' (ASPECTS) — มีผลเฉพาะ preset free + quality · ค่าอื่น = 400 code ratio
   ref = ภาพอ้างอิงของ "แก้ภาพนี้" (base64 ของ PNG/JPEG หรือ data URL) — เฉพาะ quality · กว้าง/สูง ≤ REF_MAX (อ่านจาก header) · ≤ REF_MAX_BYTES
     ไม่ผ่าน = 400 code ref_model|ref_type|ref_size|ref_bytes · ส่งเข้าโมเดลเป็นฟิลด์ multipart input_image_0
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
/* ภาพอ้างอิง: เอกสาร klein-4b บอก "smaller than 512x512" — ยังไม่ได้ลองกับ Workers AI ว่า 512 พอดีผ่านไหม; ถ้าไม่ผ่านแก้เป็น 511
   ที่นี่และ REF_MAX ใน image-gen.js (เทสต์ตรวจว่าเท่ากัน) */
export const REF_MAX = 512;
export const REF_MAX_BYTES = 1024 * 1024;

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

/* ขนาดภาพ: พื้นหลัง 16:9 (1024×576, ทวีคูณของ 16) / อื่นๆ 1:1 — schnell ไม่รับขนาด จึงได้ 1024×1024 เสมอ
   preset อิสระ + โมเดลที่รับขนาด (quality) เลือกอัตราส่วนได้จาก ASPECTS เท่านั้น (ห้ามรับ width/height จาก client) — ต้องตรงกับ RATIOS ใน image-gen-calc.js */
export const ASPECTS = {
  '1:1': { width: 1024, height: 1024 },
  '3:4': { width: 768, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '9:16': { width: 576, height: 1024 },
  '16:9': { width: 1024, height: 576 },
};
export function sizeFor(preset, model, ratio) {
  if (!model.sized) return { width: 1024, height: 1024 };
  if (preset === 'background') return { width: 1024, height: 576 };
  if (preset === 'free' && ratio) return ASPECTS[ratio];
  return { width: 1024, height: 1024 };
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

/* กว้าง/สูงจาก header: PNG = IHDR (ไบต์ 16–23) · JPEG = ไล่ marker หา SOFn (C0–CF ยกเว้น C4 DHT, C8, CC DAC) · อ่านไม่ได้ = null */
export function imageSize(b, kind) {
  if (kind === 'png') {
    if (b.length < 24) return null;
    const u32 = (i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    return { width: u32(16), height: u32(20) };
  }
  if (kind === 'jpg') {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      if (m === 0xd9 || m === 0xda) return null;
      const len = (b[i + 2] << 8) | b[i + 3];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { width: (b[i + 7] << 8) | b[i + 8], height: (b[i + 5] << 8) | b[i + 6] };
      }
      if (len < 2) return null;
      i += 2 + len;
    }
  }
  return null;
}

/* ตรวจภาพอ้างอิง → { bytes, mime, ext, width, height } หรือ { status, code, error } */
export function readRef(raw) {
  if (typeof raw !== 'string' || !raw) return { code: 'ref_type', error: 'ref must be a base64 PNG or JPEG' };
  const b64 = raw.replace(/^data:[^,]*,/, '');
  if (b64.length > Math.ceil(REF_MAX_BYTES / 3) * 4 + 4) return { code: 'ref_bytes', error: 'ref image too large (max ' + REF_MAX_BYTES + ' bytes)' };
  let bytes;
  try { bytes = b64ToBytes(b64); } catch (e) { return { code: 'ref_type', error: 'ref is not valid base64' }; }
  if (bytes.length > REF_MAX_BYTES) return { code: 'ref_bytes', error: 'ref image too large (max ' + REF_MAX_BYTES + ' bytes)' };
  const kind = sniffImage(bytes);
  if (!kind || (kind.ext !== 'png' && kind.ext !== 'jpg')) return { code: 'ref_type', error: 'ref must be PNG or JPEG' };
  const size = imageSize(bytes, kind.ext);
  if (!size) return { code: 'ref_type', error: 'could not read ref image size' };
  if (!(size.width >= 1 && size.height >= 1 && size.width <= REF_MAX && size.height <= REF_MAX)) {
    return { code: 'ref_size', error: 'ref image must be at most ' + REF_MAX + '×' + REF_MAX + ' (got ' + size.width + '×' + size.height + ')' };
  }
  return { bytes, mime: kind.mime, ext: kind.ext, width: size.width, height: size.height };
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
  let ref = null;
  if (body.ref !== undefined && body.ref !== null) {
    if (!model.refs) return json(400, { error: 'ref is only supported with model quality', code: 'ref_model' });
    ref = readRef(body.ref);
    if (ref.code) return json(400, { error: ref.error, code: ref.code });
  }

  let ratio = null;
  if (body.ratio !== undefined && body.ratio !== null) {
    if (typeof body.ratio !== 'string' || !Object.prototype.hasOwnProperty.call(ASPECTS, body.ratio)) return json(400, { error: 'ratio must be one of ' + Object.keys(ASPECTS).join('|'), code: 'ratio' });
    ratio = body.ratio;
  }

  const full = buildPrompt(prompt, preset, mode);
  const { width, height } = sizeFor(preset, model, ratio);
  const neurons = imageNeurons(model, width, height, ref ? [ref] : []);
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
      if (ref) form.append('input_image_0', new Blob([ref.bytes], { type: ref.mime }), 'ref.' + ref.ext);
      const r = new Response(form);
      result = await env.AI.run(model.id, { multipart: { body: r.body, contentType: r.headers.get('content-type') } });
    } else {
      result = await env.AI.run(model.id, { prompt: full, steps: model.steps });
    }
  } catch (err) {
    const res = aiErrorResponse(err);
    if (!ref || res.status !== 502) return res;
    // มีภาพอ้างอิงแล้วโมเดลล้ม = มักเป็นภาพที่โมเดลไม่รับ — ส่งข้อความของ upstream (ตัดสั้น) ให้หน้าแสดงต่อท้ายข้อความของเรา
    const msg = String(err && err.message ? err.message : err).slice(0, 200);
    return json(502, { error: 'AI request failed: ' + msg, code: 'upstream', detail: msg });
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
