/* ตัวช่วยของ /api/asr (Whisper บน Workers AI) — ไฟล์นี้ไม่ export onRequest* จึงไม่ใช่ route
   พารามิเตอร์ของ @cf/openai/whisper-large-v3-turbo ตรวจจาก schema ทางการ (cloudflare-docs, workers-ai-models/whisper-large-v3-turbo.json):
     audio (base64) · task · language · vad_filter (boolean, ค่าเริ่มต้น false) · initial_prompt (string) · prefix · beam_size ·
     condition_on_previous_text · no_speech_threshold · compression_ratio_threshold · log_prob_threshold · hallucination_silence_threshold
   ผลลัพธ์: text, segments[{start,end,text,…}], word_count, vtt, transcription_info{duration, duration_after_vad,…}
   ที่ใช้จริงมี 4 ตัว: language, vad_filter (เปิดเสมอ), initial_prompt, และอ่าน segments คืนให้หน้าเว็บทำย่อหน้า/เวลา */

/* โมเดลที่ client เลือกได้ — ค่าอื่นนอกลิสต์ = 400 (ไม่ส่งชื่อโมเดลที่ client ส่งมาเข้า env.AI.run ตรงๆ) */
export const ASR_MODELS = {
  'whisper-large-v3-turbo': '@cf/openai/whisper-large-v3-turbo',
  '@cf/openai/whisper-large-v3-turbo': '@cf/openai/whisper-large-v3-turbo',
};
export const DEFAULT_ASR_MODEL = '@cf/openai/whisper-large-v3-turbo';

export const MAX_PROMPT_CHARS = 400;      // Whisper ใช้ prompt ได้ ≤ 224 โทเค็น (ไทย ~1–2 ตัวอักษร/โทเค็น) — เกินนี้ไม่มีประโยชน์และเปลืองคำขอ
export const MAX_AUDIO_B64 = 4_000_000;   // ~3 MB ≈ 95 วินาที WAV 16 kHz — หน้าเว็บส่งท่อน ≤ ~33 วินาที (~1.4 MB)
export const MAX_SEGMENTS = 400;

/* คำศัพท์เฉพาะตามประเภทเนื้อหา — Whisper ใช้ initial_prompt เป็น "บริบทก่อนหน้า" ช่วยสะกดคำเฉพาะ/ชื่อกฎหมาย/ศัพท์ช่างให้ถูก
   เขียนเป็นประโยคธรรมชาติ ไม่ใช่รายการคำล้วน (รายการล้วนทำให้บางครั้งโมเดลพ่นรายการนั้นออกมาตอนเสียงเงียบ) · th = ภาษาไทยหรือตรวจอัตโนมัติ */
export const DOMAIN_PROMPTS = {
  general: {
    th: 'บันทึกการประชุมและการสนทนาภาษาไทย พูดเป็นประโยคต่อเนื่อง มีเครื่องหมายวรรคตอนและชื่อเฉพาะ',
    en: 'A transcript of a meeting or conversation, spoken in full sentences with punctuation and proper names.',
  },
  law: {
    th: 'การบรรยายกฎหมายไทย ประมวลกฎหมายแพ่งและพาณิชย์ ประมวลกฎหมายอาญา ประมวลกฎหมายวิธีพิจารณาความแพ่ง มาตรา วรรคหนึ่ง วรรคสอง คำพิพากษาศาลฎีกา ฎีกา โจทก์ จำเลย นิติกรรม สัญญา ละเมิด ทรัพย์สิน',
    en: 'A lecture on Thai law: Civil and Commercial Code, Criminal Code, Civil Procedure Code, section, paragraph, Supreme Court judgment, plaintiff, defendant, juristic act, contract, tort.',
  },
  engineering: {
    th: 'การสนทนาด้านวิศวกรรมไฟฟ้าและงานบำรุงรักษา หม้อแปลง เบรกเกอร์ สายเคเบิล แรงดันไฟฟ้า กระแสไฟฟ้า กิโลวัตต์ เพาเวอร์แฟกเตอร์ มอเตอร์ ระบบสายดิน แผงควบคุม PLC การบำรุงรักษาเชิงป้องกัน',
    en: 'An electrical engineering and maintenance discussion: transformer, circuit breaker, cable, voltage, current, kilowatt, power factor, motor, grounding, control panel, PLC, preventive maintenance.',
  },
  invest: {
    th: 'การพูดคุยเรื่องการลงทุน หุ้น กองทุนรวม ตลาดหลักทรัพย์แห่งประเทศไทย SET50 เงินปันผล พันธบัตร ทองคำ บิตคอยน์ ดัชนี อัตราดอกเบี้ย เงินเฟ้อ กองทุน RMF SSF ThaiESG',
    en: 'A discussion about investing: stocks, mutual funds, the Stock Exchange of Thailand, SET50, dividends, government bonds, gold, Bitcoin, index, interest rate, inflation, RMF, SSF, ThaiESG.',
  },
};

const LANG_RE = /^[a-z]{2,3}$/;

/* ตัดอักขระควบคุม + ช่องว่างซ้อน แล้วจำกัดความยาวตามจำนวนตัวอักษร (ไม่ตัดกลางตัวอักษรคู่ surrogate) */
export function cleanPrompt(v) {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f​-‍﻿]+/g, ' ').replace(/\s+/g, ' ').trim();
  const chars = Array.from(s);
  return chars.length > MAX_PROMPT_CHARS ? chars.slice(0, MAX_PROMPT_CHARS).join('').trim() : s;
}

export function promptFor(domain, language) {
  const p = DOMAIN_PROMPTS[domain];
  if (!p) return '';
  return language === 'en' ? p.en : p.th;
}

/* body จาก client → { error } หรือ { model, input, domain }
   - model: ตัวเลือกได้เฉพาะใน ASR_MODELS · audio: base64 ไม่ว่าง ≤ MAX_AUDIO_B64
   - language: รหัส ISO 2–3 ตัวอักษรพิมพ์เล็กเท่านั้น (ที่เหลือ = ไม่ส่ง → โมเดลตรวจเอง)
   - initial_prompt: ถ้า client ส่งมาเอง ใช้ (ถูกตัดความยาว) · ไม่ส่งแต่ระบุ domain ที่รู้จัก = ใช้ชุดคำศัพท์ของเซิร์ฟเวอร์ · domain แปลก = 400
   - vad_filter: เปิดเสมอ (ปิดได้เฉพาะเมื่อ client ส่ง vad:false ชัดเจน) */
export function buildAsrInput(body) {
  if (!body || typeof body !== 'object') return { error: 'Invalid JSON body' };
  const audio = body.audio;
  if (!audio || typeof audio !== 'string') return { error: 'Missing "audio" (base64 string) in request body' };
  if (audio.length > MAX_AUDIO_B64) return { error: 'audio too large (max ' + MAX_AUDIO_B64 + ' base64 chars)', status: 413 };

  let model = DEFAULT_ASR_MODEL;
  if (body.model != null && body.model !== '') {
    if (typeof body.model !== 'string' || !Object.prototype.hasOwnProperty.call(ASR_MODELS, body.model)) return { error: 'model not allowed' };
    model = ASR_MODELS[body.model];
  }

  let domain = 'general';
  if (body.domain != null && body.domain !== '') {
    if (typeof body.domain !== 'string' || !Object.prototype.hasOwnProperty.call(DOMAIN_PROMPTS, body.domain)) return { error: 'unknown domain' };
    domain = body.domain;
  }

  const input = { audio, task: 'transcribe', vad_filter: body.vad !== false };
  let language = '';
  if (typeof body.language === 'string' && LANG_RE.test(body.language)) { language = body.language; input.language = language; }

  let prompt = '';
  if (typeof body.initial_prompt === 'string' && body.initial_prompt.trim()) prompt = cleanPrompt(body.initial_prompt);
  else if (body.domain != null && body.domain !== '') prompt = promptFor(domain, language);
  if (prompt) input.initial_prompt = prompt;

  return { model, input, domain };
}

/* ผลจากโมเดล → ช่วงคำพูดแบบย่อ (ส่งเฉพาะที่หน้าเว็บใช้: เวลา + ข้อความ) */
export function compactSegments(result) {
  const segs = result && Array.isArray(result.segments) ? result.segments : [];
  const out = [];
  for (const s of segs) {
    if (out.length >= MAX_SEGMENTS) break;
    const text = s && typeof s.text === 'string' ? s.text.trim() : '';
    const start = Number(s && s.start), end = Number(s && s.end);
    if (!text || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    out.push({ start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100, text });
  }
  return out;
}
