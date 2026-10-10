/* แทน Worker tanot-ocr-proxy (ต้นฉบับ: docs/ocr-worker-original.js) — อ่านข้อความในรูป/PDF ด้วย Claude Vision
   ANTHROPIC_API_KEY และ OCR_PIN เป็น secret ที่ตั้งใน Pages dashboard เท่านั้น ห้ามใส่ใน wrangler.toml หรือโค้ด
   ใช้ fetch ตรงแทน SDK เพราะ repo นี้ห้ามมี package.json ที่ root (Pages จะรัน npm install ทุก build)

   ทุกคำขอต้องผ่านรหัส (header X-OCR-Pin == env.OCR_PIN) ก่อนเรียก Anthropic — ดู functions/_lib/ocrpin.js
   คำขอ: { imageBase64, mediaType } หรือ { pdfBase64, pageStart? } + prompt? + model?
     - รูป: base64 ≤ 5,000,000 ตัวอักษร (ลิมิตรูปของ Claude 5 MB) · JPEG/PNG/GIF/WebP
     - PDF: ส่งเป็น content block type "document" ทั้งไฟล์ (≤ 100 หน้า, ≤ 32 MB รวมคำขอ — เว็บแบ่งช่วงหน้าเองถ้าเกิน) ใช้ prompt ถอดข้อความเดิม
       + ข้อความต่อท้ายให้คั่นหน้าด้วยบรรทัด [[หน้า N]] (pageStart = เลขหน้าแรกของไฟล์ท่อนนี้ในเอกสารเต็ม) · ถ้าเว็บส่ง prompt เอง (เช่น ใบเสร็จ) ไม่ต่อท้าย
     - model: allowlist ด้านล่าง ไม่ส่ง = claude-sonnet-5 (ค่าเริ่มต้นเดิม)
   คำตอบ: { text, model, truncated? } · ลองใหม่ 1 ครั้งเมื่อ Anthropic ตอบ 429/5xx (ไม่ลองใหม่เมื่อ 4xx อื่น) · timeout ตายตัว */

import { recordUsage } from '../_lib/ai.js';
import { checkPin } from '../_lib/ocrpin.js';

const DEFAULT_MODEL = 'claude-sonnet-5';
/* ปิด thinking ต่างกันตามรุ่น (ตรวจจาก claude-api skill): Sonnet 5 / Haiku 5.5 รับ { type: 'disabled' } ที่ effort ค่าเริ่มต้น ·
   Sonnet 5.5 ส่ง disabled ไม่ได้ (400) ต้องใช้ between_tools (ไม่มีฟิลด์อื่น, effort ≤ high — ค่าเริ่มต้นคือ high) */
const MODELS = {
  'claude-sonnet-5': { type: 'disabled' },
  'claude-sonnet-5-5': { type: 'between_tools' },
  'claude-haiku-5-5': { type: 'disabled' },
};
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_B64 = 5000000;
const MAX_PDF_B64 = 30000000; // คำขอรวมต้อง ≤ 32 MB
const MAX_PROMPT = 8000;
const TIMEOUT_IMAGE_MS = 90000;
const TIMEOUT_PDF_MS = 240000;
const RETRY_MIN_MS = 500, RETRY_MAX_MS = 5000, RETRY_DEFAULT_MS = 1500;

/* prompt ถอดข้อความเดิมจาก Worker ต้นฉบับ — คงไว้ทุกตัวอักษร ข้อสำคัญที่สุดคือ "ห้ามแก้คำผิด" เพราะข้อความที่ได้
   จะถูกส่งไปตรวจคำผิดต่อ ถ้าโมเดลแอบแก้ให้ตั้งแต่ตอน OCR ผู้ใช้จะไม่เห็นคำผิดจริงในเอกสารเลย */
const DEFAULT_PROMPT =
  'คุณเป็นระบบถอดข้อความ (OCR) มืออาชีพ ทำหน้าที่อ่านข้อความในภาพนี้ให้ตรงกับต้นฉบับที่สุด\n' +
  'กฎสำคัญ:\n' +
  '1. ถอดข้อความทุกตัวอักษรตามที่ปรากฏจริงในภาพ (รวมลายมือเขียนถ้ามี) ห้ามแก้คำผิด ไวยากรณ์ ' +
  'หรือการสะกดใดๆ แม้จะรู้ว่าผิด — ให้คงคำผิดนั้นไว้ตรงๆ เพราะข้อความนี้จะถูกนำไปตรวจคำผิดต่อในขั้นตอนถัดไป\n' +
  '2. เรียงข้อความตามลำดับที่ปรากฏในภาพจากบนลงล่าง ซ้ายไปขวา คงการขึ้นบรรทัดใหม่/ย่อหน้าตามต้นฉบับ\n' +
  '3. ห้ามแปล ห้ามสรุป ห้ามใส่คำอธิบายหรือความเห็นใดๆ ห้ามใส่ markdown หรือเครื่องหมายคำพูดครอบ\n' +
  '4. ถ้าบางจุดอ่านไม่ออกจริงๆ ให้ใส่ [อ่านไม่ออก] แทนที่จุดนั้นแล้วอ่านต่อ\n' +
  '5. ถ้าในภาพไม่มีข้อความเลยให้ตอบว่า "ไม่พบข้อความในภาพ" คำเดียว\n' +
  'พิมพ์เฉพาะข้อความที่ถอดได้เท่านั้น ไม่ต้องมีหัวข้อหรือคำนำใดๆ ก่อนเริ่มถอดข้อความ';

/* ต่อท้าย DEFAULT_PROMPT เฉพาะ PDF (แยก text block ต่างหาก ไม่แก้ตัว prompt เดิม): ไฟล์มีหลายหน้า ต้องรู้ว่าข้อความไหนอยู่หน้าไหน */
function pageSuffix(start) {
  return 'ข้อยกเว้นข้อเดียวของข้อ 3 เพราะเอกสารนี้เป็น PDF หลายหน้า: ก่อนข้อความของแต่ละหน้าให้ขึ้นบรรทัดใหม่เป็น [[หน้า N]] ' +
    '(N คือเลขหน้า โดยหน้าแรกของไฟล์นี้คือหน้า ' + start + ' แล้วนับต่อไปตามลำดับ) คั่นระหว่างหน้า ' +
    'ห้ามเขียนอะไรอย่างอื่นนอกจากบรรทัดคั่นนี้เพิ่มเอง หน้าที่ไม่มีข้อความให้มีแค่บรรทัดคั่นของหน้านั้น';
}

function json(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) });
}

/* ฐาน URL ของ Anthropic — แก้ได้เฉพาะ localhost (ให้เทสต์ใช้ตัวหลอก) ค่าอื่นถูกเมินเพื่อกันคีย์รั่วไปโฮสต์อื่น */
function apiBase(env) {
  const b = typeof env.ANTHROPIC_BASE_URL === 'string' ? env.ANTHROPIC_BASE_URL : '';
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(b) ? b.replace(/\/$/, '') : 'https://api.anthropic.com';
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* เรียก Anthropic พร้อม timeout; 429/5xx → ลองใหม่ 1 ครั้ง (รอตาม retry-after ถ้ามี) · timeout/เครือข่ายล้ม → คืน { error } ไม่ลองซ้ำ (กันจ่ายซ้ำ) */
async function callClaude(env, bodyText, timeoutMs) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await fetch(apiBase(env) + '/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: bodyText,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const timedOut = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      return { error: timedOut ? 'timeout' : 'unreachable' };
    }
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      const ra = Number(res.headers.get('retry-after'));
      try { await res.arrayBuffer(); } catch (e) { /* ทิ้งเนื้อหาของคำตอบที่จะลองใหม่ */ }
      await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(RETRY_MAX_MS, Math.max(RETRY_MIN_MS, ra * 1000)) : RETRY_DEFAULT_MS);
      continue;
    }
    return { res };
  }
  return { error: 'unreachable' };
}

export async function onRequestPost({ request, env }) {
  // รหัสก่อนทุกอย่าง — ก่อนอ่านเนื้อหา ก่อนเช็กคีย์ Anthropic
  const denied = await checkPin(env, request);
  if (denied) return denied;

  if (!env.ANTHROPIC_API_KEY) return json(500, { error: 'ANTHROPIC_API_KEY secret not configured', code: 'config' });

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json(400, { error: 'invalid JSON body' });
  }
  if (!body || typeof body !== 'object') return json(400, { error: 'invalid JSON body' });
  const { imageBase64, mediaType, pdfBase64, prompt } = body;

  const model = body.model == null || body.model === '' ? DEFAULT_MODEL : body.model;
  if (typeof model !== 'string' || !Object.prototype.hasOwnProperty.call(MODELS, model)) {
    return json(400, { error: 'model not allowed (use ' + Object.keys(MODELS).join(' | ') + ')', code: 'bad_model' });
  }
  if (prompt != null && (typeof prompt !== 'string' || prompt.length > MAX_PROMPT)) return json(400, { error: 'invalid prompt' });

  const isPdf = pdfBase64 != null;
  if (isPdf === (imageBase64 != null)) return json(400, { error: 'send exactly one of imageBase64 (+ mediaType) or pdfBase64' });

  const content = [];
  if (isPdf) {
    if (typeof pdfBase64 !== 'string' || !pdfBase64) return json(400, { error: 'invalid pdfBase64' });
    if (pdfBase64.length > MAX_PDF_B64) return json(413, { error: 'PDF too large (max ~22 MB per request) — split into page ranges', code: 'too_large' });
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } });
  } else {
    if (typeof imageBase64 !== 'string' || !imageBase64 || !IMAGE_TYPES.includes(mediaType)) return json(400, { error: 'missing imageBase64 or mediaType (jpeg|png|gif|webp)' });
    if (imageBase64.length > MAX_IMAGE_B64) return json(413, { error: 'image too large (max 5 MB base64) — resize before sending', code: 'too_large' });
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } });
  }
  content.push({ type: 'text', text: prompt || DEFAULT_PROMPT });
  if (isPdf && !prompt) {
    const start = Math.floor(Number(body.pageStart));
    content.push({ type: 'text', text: pageSuffix(Number.isFinite(start) && start >= 1 && start <= 100000 ? start : 1) });
  }

  const r = await callClaude(env, JSON.stringify({
    model,
    max_tokens: isPdf ? 32000 : 16000,
    thinking: MODELS[model],
    messages: [{ role: 'user', content }],
  }), isPdf ? TIMEOUT_PDF_MS : TIMEOUT_IMAGE_MS);

  if (r.error === 'timeout') return json(504, { error: 'Claude ตอบช้าเกินกำหนด', code: 'timeout' });
  if (r.error) return json(502, { error: 'Anthropic API unreachable', code: 'upstream' });

  const res = r.res;
  let data;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || 'Anthropic API error';
    // 401/403 จาก Anthropic = คีย์ของเซิร์ฟเวอร์มีปัญหา ไม่ใช่เซสชัน Access ของผู้ใช้ → ห้ามส่งต่อเป็น 401 (ไคลเอนต์จะนึกว่าต้องล็อกอินใหม่)
    if (res.status === 401 || res.status === 403) return json(502, { error: 'Anthropic API key rejected: ' + msg, code: 'upstream' });
    // 429 ของ Anthropic ≠ โควตา Workers AI ของเรา (code 'quota') → รายงานเป็น "ไม่ว่าง"
    if (res.status === 429 || res.status === 529) return json(503, { error: 'Claude ไม่ว่างชั่วคราว ลองใหม่อีกครั้ง', code: 'upstream' });
    if (res.status >= 500) return json(502, { error: msg, code: 'upstream' });
    return json(res.status === 413 ? 413 : 400, { error: msg, code: res.status === 413 ? 'too_large' : 'bad' });
  }
  if (!data || data.stop_reason === 'refusal') {
    return json(422, { error: 'Model declined to transcribe this image' });
  }

  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  // Anthropic คิดเงินแยกจาก Workers AI — บันทึกแค่จำนวนคำขอ/โทเค็น (neurons = 0) ไม่นับรวมโควตา Neurons
  await recordUsage(env, 'ocr', { tokensIn: data.usage && data.usage.input_tokens, tokensOut: data.usage && data.usage.output_tokens });
  const out = { text, model };
  if (data.stop_reason === 'max_tokens') out.truncated = true;
  return json(200, out);
}
