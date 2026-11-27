/* ══════════════════════════════════════════════════════════════════
   media-models.js — ตารางกลางของโมเดลเสียงในเบราว์เซอร์ (ใช้ร่วมกันทั้งเธรดหลักและ Worker)
   โหลดได้ 2 แบบด้วยไฟล์เดียว: <script src="media-models.js"> ในหน้า (ผ่าน media-core.js) และ
   import('./media-models.js') ใน Worker แบบ module (tts-worker.js) — จึงเขียนเป็นสคริปต์ธรรมดาที่ตั้งค่า
   ลง self/window (ไม่มี export) ถึงจะใช้ได้ทั้งสองทาง

   ‼️ เดิม TTS_DTYPE_OVERRIDES มีซ้ำ 2 ชุดใน text-to-speech.js กับ tts-worker.js (คนละ execution context)
   และเคยลืมแก้คู่กันจนเกิดบั๊กจริง (2026-08-10: Worker ยังบังคับ fp32 ให้ 2 โมเดลที่ q8 ใช้ได้แล้ว →
   หน่วยความจำพุ่งตอนรันหลาย Worker ขนาน แท็บแครช "หน้ารีเฟรชเอง") — ย้ายมาไว้ที่นี่ที่เดียวแล้ว
   ทั้งสองฝั่งอ่านจากไฟล์นี้ แก้ตารางนี้ที่เดียวพอ

   ทำไม Jori / Riko ต้องบังคับ fp32: transformers.js เลือกไฟล์ ONNX ตาม dtype เริ่มต้นของ backend
   (wasm = 'q8' → onnx/model_quantized.onnx) — สอง repo นี้มีแค่ onnx/model.onnx ปล่อยดีฟอลต์จะ 404 ·
   ไฟล์ fp32 ใหญ่กว่า q8 หลายเท่า → text-to-speech.js ให้โมเดล fp32 รันได้ Worker เดียวเสมอทุกเครื่อง */
(function (g) {
  'use strict';
  var TTS_DTYPE_OVERRIDES = {
    /* Jori / Riko — มีแต่ onnx/model.onnx (fp32) ไม่มีไฟล์ quantized ·  */
    'Tanotfin/mms-thai-jori-f5-onnx': 'fp32',
    'Tanotfin/mms-thai-riko-f5-onnx': 'fp32',
    'Tanotfin/vits-thai-nat-onnx': 'fp32'
  };
  /* เสียงไทย (2026-10): เหลือ 2 ตัว — หญิง (Jori) ค่าเริ่มต้น · ชาย (Riko)
     ทั้งคู่ fine-tune จาก VIZINTZOR MMS-TTS-THAI-FEMALEV2 / MALEV2 ด้วยเสียงที่สังเคราะห์โดย F5-TTS-THAI แล้วตั้งความสุ่มต่ำแบบ stable2
     (VITS ฝังความสุ่มไว้ใน ONNX: ต้นฉบับ noise_scale 0.667 / noise_scale_duration 0.8 → อาการ "ยานต้นคำ / สั่นท้ายคำ"
      • stable  = 0.333 / 0.3 · stable2 = 0.1 / 0.0 (น้ำหนักเดิม) — เจ้าของฟังเทียบแล้วเลือก stable2)
     ไม่มีทางถอยไปเสียง/โมเดลอื่น (2026-10: เสียงเก่าฟังไม่รู้เรื่อง) — โหลด Jori/Riko ไม่ได้ = แจ้ง error แล้วหยุด (tts-worker.js / text-to-speech.js)
     id ที่เคยเลือกไว้ทุกตัว (พอดแคสต์/หญิง ทั่วไป/ชาย ทั่วไป ทุกชุด) แปลงเป็น Jori/Riko ด้วย ttsMigrate · ค่าที่ไม่รู้จัก → Jori */
  var TTS_DEFAULT_VOICE = 'Tanotfin/mms-thai-jori-f5-onnx';
  var TTS_MALE = 'Tanotfin/mms-thai-riko-f5-onnx';
  /* Nat (2026-11): VITS ฝึกจากศูนย์ (ไม่ใช้น้ำหนัก MMS/F5 — ไม่ติด CC-BY-NC) ด้วยเสียงที่สังเคราะห์โดย VoxCPM2 (Apache-2.0) จากเสียงที่ออกแบบเอง
     tools/voice-training สคริปต์ 10 → 6 → 12 → 13 (เลือก checkpoint 66k ด้วย CER) → 14 · speaking_rate 0.85 ฝังใน ONNX
     tokenizer เป็นของเราเอง (ตัวอักษรไทย + ช่องว่างระหว่างตัว "_") แต่รับข้อความเดียวกับ Jori/Riko (tts-normalize.js forMms) */
  var TTS_NAT = 'Tanotfin/vits-thai-nat-onnx';
  var TTS_VOICE_IDS = [TTS_DEFAULT_VOICE, TTS_MALE, TTS_NAT];
  var TTS_MIGRATE = {
    'Tanotfin/mms-tts-2081-onnx': TTS_DEFAULT_VOICE,
    'Tanotfin/mms-tts-2081-FM-onnx': TTS_DEFAULT_VOICE,
    'Tanotfin/mms-tts-2081-FM-stable-onnx': TTS_DEFAULT_VOICE,
    'Tanotfin/mms-tts-2081-FM-stable2-onnx': TTS_DEFAULT_VOICE,
    'phlebotomy1996/mms-thai-female-podcast-spk0': TTS_DEFAULT_VOICE,
    'Tanotfin/mms-thai-female-podcast-spk0-stable-onnx': TTS_DEFAULT_VOICE,
    'Tanotfin/mms-thai-female-podcast-spk0-stable2-onnx': TTS_DEFAULT_VOICE,
    'Tanotfin/mms-tts-2081-M-onnx': TTS_MALE,
    'Tanotfin/mms-tts-2081-M-stable-onnx': TTS_MALE,
    'Tanotfin/mms-tts-2081-M-stable2-onnx': TTS_MALE
  };
  /* ล็อกรุ่นโมเดลด้วย commit ของ Hugging Face (ไม่ใช้ 'main'): transformers.js ใส่ revision ลง URL (…/resolve/<sha>/…) และใช้ URL นั้นเป็นคีย์แคช
     → เครื่องที่เคยโหลดรุ่นเก่าไว้จะโหลดรุ่นใหม่เองเมื่อเลขเปลี่ยน · /api/hf/ รับ commit 40 hex และตอบ Cache-Control immutable (functions/_lib/hf.js)
     ‼️ ฝึกรุ่นใหม่ → อัปโหลดขึ้น Hugging Face → เปลี่ยนเลข commit ตรงนี้ (ไม่มีในตาราง = 'main' — ทางถอยทั้งหมดใช้ main) */
  /* รุ่นนี้ฝัง speaking_rate ไว้ใน ONNX (Jori 0.8 / Riko 0.75) ด้วยสคริปต์ 9 (tools/voice-training/tanot_mms_speed.py) · รุ่นก่อนหน้า (ความเร็วเดิม) = 9a95f85… / 55d6042… */
  var TTS_REVISION = {
    'Tanotfin/mms-thai-jori-f5-onnx': 'b9b254f86dfdf0c3ea4b49d8a6c92c4da5d4b913',
    'Tanotfin/mms-thai-riko-f5-onnx': 'd61cbf24ee518b31cbaa29c8a9eb8f251d5f4451',
    'Tanotfin/vits-thai-nat-onnx': 'a87a8e1abb1e1a8cf38a4d188fbc877a87a378e4'
  };
  /* "ลดเสียงแหลม" (ตัวกรอง low-pass 2nd-order biquad Q 0.707 ที่ TTS_LOWPASS_HZ — audio-gain.js): หญิง ทั่วไป (22.05 kHz) มีเสียงแหลมจนมีเสียงรบกวนเล็กน้อย (เจ้าของฟังจริง)
     ค่าเริ่มต้นเปิดเฉพาะเสียงที่อยู่ในตารางนี้ (Jori/Riko ไม่เปิด — ผู้ใช้ติ๊กเองได้) · ใช้กับเสียงที่ sampleRate > 16 kHz เท่านั้น (โมเดล 16 kHz ไม่มีย่านเหนือ 8 kHz ให้กรอง) · ผู้ใช้สลับเองได้ (tanot:tts:opts.lowpass) */
  var TTS_LOWPASS_HZ = 7000;
  var TTS_LOWPASS_DEFAULT = {}; // ว่าง: Jori/Riko ไม่เปิดเป็นค่าเริ่มต้น (เสียงหญิง ทั่วไปที่เคยเปิดไม่ได้โหลดแล้ว) — ใส่ id ที่นี่ถ้าเสียงใหม่ต้องการ
  /* error ตอนโหลดโมเดลที่เป็นเครือข่ายสะดุด (เคยเจอ "TypeError: network error" ตอนโหลดโมเดลเสียงพอดแคสต์ 1 ครั้ง ครั้งต่อไปผ่าน) → tts-worker.js/asr-worker.js รอ NET_RETRY_MS แล้วลองโหลดใหม่ 1 ครั้งก่อนเข้าทางถอย
     ไม่ใช่: 404/403/401/ไม่พบไฟล์ (ลองซ้ำไม่ช่วย → แจ้ง error ทันที) · หน่วยความจำไม่พอ (ลองซ้ำซ้ำเติม) */
  var NET_RETRY_MS = 1500;
  var NET_ERR_RE = /network ?error|failed to fetch|load failed|fetch failed|networkerror when attempting|net::err_|err_(network|internet|connection|timed_out|name_not|empty_response)|econn(reset|refused)|etimedout|socket hang up|\btimed? ?out\b|the network connection was lost|connection (was )?(reset|closed|lost)/i;
  var NOT_NET_RE = /\b(40[0-9]|410|5\d\d)\b|could not locate|not found|unauthorized|forbidden|out of memory|bad_alloc|Aborted\(|memory access out of bounds|cannot allocate|failed to grow|could not allocate|WebAssembly\.Memory|Array buffer allocation failed|Invalid typed array length/i;
  function isNetworkError(err) {
    if (isSessionError(err)) return false;
    var m = err && err.message ? String(err.message) : String(err == null ? '' : err);
    return NET_ERR_RE.test(m) && !NOT_NET_RE.test(m);
  }
  /* ── โมเดลของ Tanotfin โหลดผ่าน /api/hf/ เท่านั้น (2026-10: เตรียมตั้ง repo บน Hugging Face เป็น private) ──
     functions/api/hf/[[path]].js อยู่หลัง Cloudflare Access (+ _middleware.js) แล้วส่งต่อไป huggingface.co พร้อม HF_TOKEN (Secret)
     useHfProxy(env) ตั้ง env.fetch ของ transformers.js: เปลี่ยนเฉพาะ https://huggingface.co/Tanotfin/… → <origin>/api/hf/Tanotfin/… (same-origin + คุกกี้)
     repo อื่น (onnx-community, Xenova …) และไฟล์อื่น (jsDelivr) โหลดตรงเหมือนเดิม
     • ทำงานเฉพาะ *.pages.dev (มี /api/*) หรือเมื่อเทสต์ตั้ง self.TANOT_HF_PROXY = { enabled: true } · ที่อื่น = โหลดตรง (ใช้ได้เฉพาะตอน repo ยัง public)
     • แคชของ transformers.js (Cache Storage 'transformers-cache') ใช้ URL ของ huggingface.co เป็นคีย์ ไม่ใช่ URL ที่ fetch จริง → แคชเดิมในเครื่องใช้ต่อได้ ไม่ต้องโหลดใหม่
     • เซสชัน Access หมดอายุ (opaqueredirect ไปหน้าล็อกอิน / 401 / 403 จาก _middleware.js) → โยน SessionError (code 'session') — ไม่ใช่ "เครือข่ายสะดุด"
       (ไม่ลองซ้ำ) และไม่ถอยรุ่น · media-core.js แสดง "เข้าสู่ระบบใหม่" · Function ตอบ 401/403 ของ HF เป็น 502 จึงไม่ปนกับเซสชัน */
  var HF_OWNER = 'Tanotfin';
  var HF_DIRECT_RE = /^https:\/\/(?:huggingface\.co|hf\.co)\/Tanotfin\/([^?#]+)/;
  var SESSION_RE = /tanot-session/;
  function hfProxyActive() {
    try {
      if (g.TANOT_HF_PROXY) return !!g.TANOT_HF_PROXY.enabled;
      return /\.pages\.dev$/.test(g.location.hostname);
    } catch (e) { return false; }
  }
  /* URL ของ huggingface.co/Tanotfin/… → URL ของ /api/hf/ (null = ไม่ต้องเปลี่ยน) */
  function hfProxyUrl(url) {
    var m = HF_DIRECT_RE.exec(String(url == null ? '' : url));
    if (!m || !hfProxyActive()) return null;
    return g.location.origin + '/api/hf/' + HF_OWNER + '/' + m[1];
  }
  function sessionError(why) {
    var e = new Error('tanot-session: sign-in expired (' + why + ')');
    e.name = 'SessionError'; e.code = 'session';
    return e;
  }
  /* error (หรือ {name,message} ที่ส่งข้าม Worker) มาจากเซสชันหมดอายุไหม */
  function isSessionError(err) {
    if (!err) return false;
    if (err.code === 'session' || err.name === 'SessionError' || err.causeName === 'SessionError') return true;
    return SESSION_RE.test(String(err.message || '') + ' ' + String(err.causeMessage || ''));
  }
  function hfFetch(base) {
    return function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || String(input);
      var proxied = hfProxyUrl(url);
      if (!proxied) return base(input, init);
      var o = {};
      if (init) for (var k in init) if (Object.prototype.hasOwnProperty.call(init, k)) o[k] = init[k];
      o.credentials = 'same-origin';
      o.redirect = 'manual'; // Access พาไปหน้าล็อกอิน (ข้ามโดเมน) = opaqueredirect · Function ตาม redirect ของ HF เองฝั่งเซิร์ฟเวอร์ เบราว์เซอร์จึงไม่เคยเห็น redirect ปกติ
      return base(proxied, o).then(function (res) {
        if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) throw sessionError('redirect');
        if (res.status === 401 || res.status === 403) throw sessionError(res.status);
        return res;
      });
    };
  }
  /* ตั้งใน env ของ transformers.js ทุกจุดที่ import มัน (tts-worker.js, asr-worker.js, ai-chat-worker.js, text-to-speech.js) — ซ้ำได้ ไม่ห่อซ้อน */
  function useHfProxy(env) {
    if (!env || env.__tanotHfFetch) return env;
    var base = typeof env.fetch === 'function' ? env.fetch : (typeof g.fetch === 'function' ? g.fetch.bind(g) : null);
    if (!base) return env;
    env.fetch = hfFetch(base);
    env.__tanotHfFetch = true;
    return env;
  }
  /* MMS-TTS บน WebGPU (Section 5, ทดลอง): ใช้ fp32 เสมอ — ตัว q8 (ค่าเริ่มต้นของ WASM) ต้องใช้ op แบบ quantized ที่ backend WebGPU ของ onnxruntime-web ยังไม่มี kernel ที่ดี
     (นี่คือเหตุผลที่รอบก่อนวัดแล้วช้ากว่า WASM) · ชื่อไฟล์ onnx/model.onnx (fp32) ของแต่ละ repo ยังไม่ได้ตรวจกับ Hugging Face จริง — ไม่มี/โหลดไม่ได้ = tts-worker.js ถอย WASM อัตโนมัติ + problem log
     เพิ่ม override รายโมเดลที่นี่ถ้าวัดแล้วพบว่า dtype อื่นดีกว่า */
  var TTS_GPU_DTYPE = 'fp32';
  var TTS_GPU_DTYPE_OVERRIDES = {};
  /* Whisper ที่เลือกได้ในหน้า text-to-speech — heavy = ซ่อนบนมือถือ (iOS/Android) เพราะแรมต่อแท็บไม่พอ
     (small ~250MB, medium ~750MB-1GB ไฟล์โมเดล + หน่วยความจำ WASM ตอนรันอีกหลายเท่า)
     2 ตระกูล:
     • Xenova/whisper-*  = ตัวเดิม (WASM q8 ตามค่าเริ่มต้นของ transformers.js) — คงไว้ให้เลือกและเป็นค่าเริ่มต้นของเครื่องที่ใช้ WASM
     • onnx-community/whisper-* = ONNX รุ่นใหม่ที่รันบน WebGPU ได้ (encoder fp32/fp16 + decoder q4 — ตามตัวอย่าง webgpu-whisper ของ transformers.js)
       เลือกได้ทั้ง WebGPU และ WASM (WASM ใช้ q8 ทั้งคู่) · legacy = ตัวเทียบเท่าใน Xenova ที่ถอยไปใช้อัตโนมัติถ้าโหลดตัวใหม่ไม่ได้ (404/ไฟล์ dtype ไม่มี)
       gpuOnly = ใหญ่เกินกว่าจะรันบน WASM ได้ — โชว์เฉพาะเครื่องที่ใช้ WebGPU ได้จริง · f16 = encoder เป็น fp16 ต้องมี shader-f16
     • Tanotfin/distill-whisper-th-*-onnx = Thonburian Whisper (biodatlab/distill-whisper-th-*, MIT — Whisper ที่ฝึกภาษาไทย) ที่เจ้าของแปลงเป็น ONNX เอง
       (transformers.js 3.8.1 scripts/convert.py --quantize; ทดสอบถอดเสียงไทยกับ transformers.js 4.2.0 แล้ว) · ไฟล์ใน onnx/ มีเฉพาะ
       encoder_model / decoder_model_merged × {'' (fp32), _quantized (q8), _fp16, _q4, _q4f16} — ห้ามเดา dtype อื่น (int8/uint8/bnb4 ไม่มี)
       thai = ฝึกไทยเป็นหลัก: asr-worker.js ส่ง language:'thai' เสมอเมื่อหน้าเลือก "อัตโนมัติ" (ผู้ใช้เลือกอังกฤษเองก็ตามที่เลือก + หน้าขึ้นคำแนะนำ)
          และโชว์ในรายการบนคอมทุกเครื่อง (ไม่ต้องมี WebGPU เหมือนตระกูล onnx-community) · wasmMinMem = WASM ต้องการ navigator.deviceMemory ≥ ค่านี้ GB
          (ไม่รู้ค่า = ผ่าน) — medium encoder fp32 ~1.2GB จึงห้ามใช้เป็น dtype ของ WebGPU เด็ดขาด: ใช้ fp16 เท่านั้น (f16:true → ไม่มี shader-f16 = ไม่ใช้ WebGPU)
     ⚠️ ชื่อ repo/ไฟล์ dtype ของ onnx-community ตรวจจาก sandbox ไม่ได้ (เข้า huggingface.co ไม่ได้) — ใช้ `node tools/media-eval/check-models.mjs`
        ตรวจกับ Hugging Face จริงก่อนปล่อย/เมื่อแก้ตารางนี้ */
  var GPU_DTYPE = { encoder_model: 'fp32', decoder_model_merged: 'q4' };
  var GPU_DTYPE_F16 = { encoder_model: 'fp16', decoder_model_merged: 'q4' };
  var WASM_DTYPE = { encoder_model: 'q8', decoder_model_merged: 'q8' };
  var THAI_LANG = 'thai';
  var ASR_MODELS = [
    { id: 'Xenova/whisper-tiny', heavy: false },
    { id: 'Xenova/whisper-base', heavy: false },
    { id: 'Xenova/whisper-small', heavy: true },
    { id: 'Xenova/whisper-medium', heavy: true },
    { id: 'onnx-community/whisper-tiny', heavy: false, legacy: 'Xenova/whisper-tiny', gpu: GPU_DTYPE, wasm: WASM_DTYPE },
    { id: 'onnx-community/whisper-base', heavy: false, legacy: 'Xenova/whisper-base', gpu: GPU_DTYPE, wasm: WASM_DTYPE },
    { id: 'onnx-community/whisper-small', heavy: true, legacy: 'Xenova/whisper-small', gpu: GPU_DTYPE, wasm: WASM_DTYPE },
    { id: 'onnx-community/whisper-large-v3-turbo', heavy: true, gpuOnly: true, f16: true, gpu: GPU_DTYPE_F16 },
    { id: 'Tanotfin/distill-whisper-th-small-onnx', heavy: true, thai: true, legacy: 'Xenova/whisper-small', gpu: GPU_DTYPE, wasm: WASM_DTYPE },
    { id: 'Tanotfin/distill-whisper-th-medium-onnx', heavy: true, thai: true, f16: true, wasmMinMem: 8, legacy: 'Xenova/whisper-medium', gpu: GPU_DTYPE_F16, wasm: WASM_DTYPE }
  ];
  function asrInfo(modelId) {
    for (var i = 0; i < ASR_MODELS.length; i++) if (ASR_MODELS[i].id === modelId) return ASR_MODELS[i];
    return null;
  }
  /* ── L6 เสียงอ่านของหน้าเรียนภาษา (languages.html → lang-tts.js) ──
     ใช้เมื่อเครื่องไม่มีเสียงของภาษานั้น หรือผู้ใช้เลือก "เสียงโมเดล" เอง (ค่าเริ่มต้น = เสียงเครื่อง) · คีย์ = รหัสภาษาตัวหน้า (km, pt-BR → pt)
     ตรวจกับ Hugging Face จริง 2026-11-26 (tokenizer_config.json: is_uroman/phonemize = false ทุกตัว) · revision = commit ที่ล็อกไว้ (URL …/resolve/<sha>/… = คีย์แคช)
     • facebook/mms-tts-* (CC BY-NC 4.0) ไม่มีไฟล์ ONNX → ใช้ repo ที่แปลงแล้ว: Xenova/mms-tts-* (q8 = onnx/model_quantized.onnx ค่าเริ่มต้นของ WASM),
       เขมร VanNet2003/mms-tts-khm-onnx (ONNX ของ KrorngAI/mms-tts-khm-finetuned, CC BY-NC 4.0), พม่า 233contentisContent/mms-tts-mya-onnx (ONNX ของ facebook/mms-tts-mya, CC BY-NC 4.0)
       สองตัวหลังมีแค่ onnx/model.onnx → dtype fp32
     • ข้าม: ลาว/มลายู (ไม่มี repo ONNX ที่ใช้กับ transformers.js), เกาหลี (is_uroman = true), จีน/ญี่ปุ่น/อิตาลี/อังกฤษ (ไม่มี MMS ONNX หรือเครื่องมีเสียงเสมอ)
     • vocab = คีย์ตัวอักษรเดียวของ vocab.json ที่ commit นั้น — langTtsChunks กรองข้อความให้เหลือแค่ตัวในนี้ (ตัวนอก vocab ทำ ONNX พังได้ แบบเสียงไทยใน Section 4) */
  var LANG_TTS = {
    km: { model: 'VanNet2003/mms-tts-khm-onnx', revision: '0786bea2c6068d337964af8a1001cee8df4f84a5', dtype: 'fp32', vocab: " -1_q\u1780\u1781\u1782\u1783\u1784\u1785\u1786\u1787\u1788\u1789\u178a\u178b\u178c\u178e\u178f\u1790\u1791\u1792\u1793\u1794\u1795\u1796\u1797\u1798\u1799\u179a\u179b\u179c\u179f\u17a0\u17a1\u17a2\u17a5\u17a7\u17aa\u17ab\u17ac\u17ad\u17ae\u17af\u17b1\u17b6\u17b7\u17b8\u17b9\u17ba\u17bb\u17bc\u17bd\u17be\u17bf\u17c0\u17c1\u17c2\u17c3\u17c4\u17c5\u17c6\u17c7\u17c8\u17c9\u17ca\u17cb\u17cc\u17cd\u17ce\u17cf\u17d0\u17d2" },
    my: { model: '233contentisContent/mms-tts-mya-onnx', revision: 'ba723f1daac33a98cc43442c789975ea95a63453', dtype: 'fp32', vocab: " '\u1000\u1001\u1002\u1004\u1005\u1006\u1007\u1008\u1009\u100a\u100b\u100c\u100d\u100f\u1010\u1011\u1012\u1013\u1014\u1015\u1016\u1017\u1018\u1019\u101a\u101b\u101c\u101d\u101e\u101f\u1021\u1023\u1024\u1025\u1026\u1027\u1029\u102b\u102c\u102d\u102e\u102f\u1030\u1031\u1032\u1036\u1037\u1038\u1039\u103a\u103b\u103c\u103d\u103e\u103f" },
    hi: { model: 'Xenova/mms-tts-hin', revision: '3fc18cc9d5ce10023fb0d22e8339e318fdcae9d9', vocab: " '-012348_`\u0901\u0902\u0903\u0905\u0906\u0907\u0908\u0909\u090a\u090f\u0910\u0911\u0913\u0914\u0915\u0916\u0917\u0918\u091a\u091b\u091c\u091d\u091e\u091f\u0920\u0921\u0922\u0923\u0924\u0925\u0926\u0927\u0928\u092a\u092b\u092c\u092d\u092e\u092f\u0930\u0932\u0935\u0936\u0937\u0938\u0939\u093c\u093e\u093f\u0940\u0941\u0942\u0943\u0945\u0947\u0948\u0949\u094b\u094c\u094d\u200d" },
    ar: { model: 'Xenova/mms-tts-ara', revision: 'e9dd80f91dcc6fb96b590806bb15421ec6d381c4', vocab: " _\u0621\u0622\u0623\u0624\u0625\u0626\u0627\u0628\u0629\u062a\u062b\u062c\u062d\u062e\u062f\u0630\u0631\u0632\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063a\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u0648\u0649\u064a\u2013" },
    vi: { model: 'Xenova/mms-tts-vie', revision: '7f40ca63bb6072ac57026210f2fea55242511214', vocab: " '-2_abcdeghiklmnopqrstuvxy\u00e0\u00e1\u00e2\u00e3\u00e8\u00e9\u00ea\u00ec\u00ed\u00f2\u00f3\u00f4\u00f5\u00f9\u00fa\u00fd\u0103\u0111\u0129\u0169\u01a1\u01b0\u1ea1\u1ea3\u1ea5\u1ea7\u1ea9\u1eab\u1ead\u1eaf\u1eb1\u1eb3\u1eb5\u1eb7\u1eb9\u1ebb\u1ebd\u1ebf\u1ec1\u1ec3\u1ec5\u1ec7\u1ec9\u1ecb\u1ecd\u1ecf\u1ed1\u1ed3\u1ed5\u1ed7\u1ed9\u1edb\u1edd\u1edf\u1ee1\u1ee3\u1ee5\u1ee7\u1ee9\u1eeb\u1eed\u1eef\u1ef1\u1ef3\u1ef5\u1ef7\u1ef9\u2013" },
    ru: { model: 'Xenova/mms-tts-rus', revision: '4eae20fc9e3442ec4ad1254d7f703a8cbbbab692', vocab: " -0124_cmoq\u0430\u0431\u0432\u0433\u0434\u0435\u0436\u0437\u0438\u0439\u043a\u043b\u043c\u043d\u043e\u043f\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044a\u044b\u044c\u044d\u044e\u044f\u2013" },
    es: { model: 'Xenova/mms-tts-spa', revision: '03f05a694412894ff930e9418fa05f52d66d6ad3', vocab: " 0123456789_abcdefghijklmnopqrstuvxyz\u00e1\u00e9\u00ed\u00f1\u00f3\u00fa\u00fc\u2014" },
    fr: { model: 'Xenova/mms-tts-fra', revision: 'c7aa283bf5b599d3c804e4accab07f6394a2b4ae', vocab: " '-_abcdefghijklmnopqrstuvxyz\u00e0\u00e2\u00e7\u00e8\u00e9\u00ea\u00eb\u00ee\u00ef\u00f4\u00f9\u00fb\u00fc\u0153\u2013" },
    de: { model: 'Xenova/mms-tts-deu', revision: 'b95ad64a0715453237dc47ed873235a0024b4275', vocab: " -012345678_abcdefghijklmnopqrstuvwxyz\u00df\u00e4\u00eb\u00ef\u00f6\u00fc\u2013" },
    pt: { model: 'Xenova/mms-tts-por', revision: '0b60fe3ec9126a6b6158afac517198d756e55b87', vocab: " '-124_abcdefghijlmnopqrstuvxz\u00e0\u00e1\u00e2\u00e3\u00e7\u00e9\u00ea\u00ed\u00f3\u00f4\u00f5\u00fa\u2014" }
  };
  var LANG_TTS_BY_MODEL = {};
  Object.keys(LANG_TTS).forEach(function (k) { LANG_TTS[k].key = k; LANG_TTS_BY_MODEL[LANG_TTS[k].model] = LANG_TTS[k]; });
  var LANG_TTS_MAX = 120; // ท่อนยาวสุดที่ส่งเข้าโมเดล (VITS ช้าแบบ O(n²) ตามความยาว — วลีในหน้าสั้นกว่านี้เกือบทั้งหมด)
  var LANG_SENT_RE = /[.!?;:\n\r\u3002\uff01\uff1f\u0964\u0965\u104a\u104b\u17d4\u17d5\u061f\u060c\u061b]+/;
  var LANG_SKIP = { '_': 1, '`': 1, '0': 1, '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1, '7': 1, '8': 1, '9': 1 }; // อยู่ใน vocab บางตัวแต่ไม่ใช่เสียงพูด (เลขมีแค่บางหลัก → ตัดทั้งหมดให้เหมือนกัน)
  var MARK_RE = null;
  try { MARK_RE = new RegExp('\\p{M}', 'u'); } catch (e) { MARK_RE = /[\u0300-\u036f\u064b-\u065f\u0670]/; }
  function langTtsInfo(code) {
    var k = String(code || '').toLowerCase().split(/[-_]/)[0];
    return Object.prototype.hasOwnProperty.call(LANG_TTS, k) ? LANG_TTS[k] : null;
  }
  /* ข้อความ → ท่อนที่มีแต่ตัวอักษรใน vocab: NFC → ตัวใน vocab เก็บ · ไม่อยู่แต่ตัวพิมพ์เล็กอยู่ = ใช้ตัวเล็ก · เครื่องหมายกำกับที่ไม่อยู่ (ฮะรากัตอาหรับ) = ตัดทิ้งไม่เว้นวรรค · อื่นๆ = ช่องว่าง
     ตัดท่อนที่วรรคตอนจบประโยคก่อน แล้วที่ช่องว่าง ≤ LANG_TTS_MAX (ไม่มีช่องว่าง = ตัดที่ตัวที่ไม่ใช่เครื่องหมายกำกับ ไม่ฉีกสระ/วรรณยุกต์ออกจากพยัญชนะ) · ท่อนที่ไม่มีตัวอักษรจริง = ทิ้ง */
  function langTtsChunks(code, text) {
    var info = langTtsInfo(code), out = [];
    if (!info || !text) return out;
    var vocab = info.vocab, s = String(text);
    try { s = s.normalize('NFC'); } catch (e) {}
    s.split(LANG_SENT_RE).forEach(function (part) {
      var t = '';
      for (var i = 0; i < part.length; i++) {
        var ch = part.charAt(i), lo = ch.toLowerCase();
        if (LANG_SKIP[ch]) t += ' ';
        else if (vocab.indexOf(ch) >= 0) t += ch;
        else if (lo.length === 1 && vocab.indexOf(lo) >= 0) t += lo;
        else if (!MARK_RE.test(ch)) t += ' ';
      }
      t = t.replace(/\s+/g, ' ').trim();
      while (t.length > LANG_TTS_MAX) {
        var cut = t.lastIndexOf(' ', LANG_TTS_MAX);
        if (cut <= 0) { cut = LANG_TTS_MAX; while (cut > 1 && MARK_RE.test(t.charAt(cut))) cut--; }
        out.push(t.slice(0, cut).trim());
        t = t.slice(cut).trim();
      }
      out.push(t);
    });
    return out.filter(function (c) { return /[^\s'\-\u2013\u2014]/.test(c); });
  }
  g.TanotMediaModels = {
    TTS_DTYPE_OVERRIDES: TTS_DTYPE_OVERRIDES,
    ASR_MODELS: ASR_MODELS,
    ttsDtype: function (modelId) { return TTS_DTYPE_OVERRIDES[modelId] || (LANG_TTS_BY_MODEL[modelId] && LANG_TTS_BY_MODEL[modelId].dtype) || null; },
    LANG_TTS: LANG_TTS,
    LANG_TTS_MAX: LANG_TTS_MAX,
    langTtsInfo: langTtsInfo,
    langTtsChunks: langTtsChunks,
    TTS_DEFAULT_VOICE: TTS_DEFAULT_VOICE,
    TTS_VOICE_IDS: TTS_VOICE_IDS,
    TTS_REVISION: TTS_REVISION,
    /* id เสียงที่เคยเลือกไว้ → Jori/Riko (ฝั่งหญิงทุกตัว → Jori · ฝั่งชาย → Riko) · Jori/Riko คืนค่าเดิม · ค่าที่ไม่รู้จัก/ว่าง → Jori */
    ttsMigrate: function (modelId) {
      if (TTS_VOICE_IDS.indexOf(modelId) >= 0) return modelId;
      return Object.prototype.hasOwnProperty.call(TTS_MIGRATE, modelId) ? TTS_MIGRATE[modelId] : TTS_DEFAULT_VOICE;
    },
    /* commit ของ Hugging Face ที่ล็อกไว้ (ไม่มีในตาราง = 'main') — ส่งเป็น option revision ของ pipeline() ทุกทาง */
    ttsRevision: function (modelId) { return Object.prototype.hasOwnProperty.call(TTS_REVISION, modelId) ? TTS_REVISION[modelId] : (LANG_TTS_BY_MODEL[modelId] ? LANG_TTS_BY_MODEL[modelId].revision : 'main'); },
    /* ชื่อเสียงที่ผู้ใช้เห็น (ใช้ในข้อความ error) · id อื่น = id เอง */
    ttsVoiceLabel: function (modelId, lang) {
      var en = lang === 'en';
      if (modelId === TTS_DEFAULT_VOICE) return en ? 'Female (Jori)' : 'หญิง (Jori)';
      if (modelId === TTS_MALE) return en ? 'Male (Riko)' : 'ชาย (Riko)';
      if (modelId === TTS_NAT) return en ? 'Female (Nat)' : 'หญิง (Nat)';
      return String(modelId || '');
    },
    /* ไฟล์โมเดลไม่อยู่บนเซิร์ฟเวอร์ (404/403 ฯลฯ ที่ไม่ใช่เซสชันหมดอายุ) */
    isNotFoundError: function (err) {
      if (isSessionError(err)) return false;
      var m = err && err.message ? String(err.message) : String(err == null ? '' : err);
      return /could not locate|not found|\b(404|403|410)\b/i.test(m);
    },
    TTS_LOWPASS_HZ: TTS_LOWPASS_HZ,
    /* ธงเริ่มต้นของ "ลดเสียงแหลม" ต่อเสียง (ผู้ใช้ override ได้ที่ tanot:tts:opts.lowpass) */
    ttsLowpassDefault: function (modelId) { return TTS_LOWPASS_DEFAULT[modelId] === true; },
    NET_RETRY_MS: NET_RETRY_MS,
    isNetworkError: isNetworkError,
    HF_OWNER: HF_OWNER,
    hfProxyActive: hfProxyActive,
    hfProxyUrl: hfProxyUrl,
    hfFetch: hfFetch,
    useHfProxy: useHfProxy,
    sessionError: sessionError,
    isSessionError: isSessionError,
    ttsGpuDtype: function (modelId) { return TTS_GPU_DTYPE_OVERRIDES[modelId] || TTS_GPU_DTYPE; },
    asrHeavy: function (modelId) { var m = asrInfo(modelId); return !!(m && m.heavy); },
    asrInfo: asrInfo,
    /* รันบน WebGPU ได้ไหม (ทุกรายการที่มี gpu dtype: onnx-community + Thonburian — Xenova เดิมคง WASM เหมือนก่อนหน้า; ไม่ผูกกับชื่อ repo) */
    asrWebgpuCapable: function (modelId) { var m = asrInfo(modelId); return !!(m && m.gpu); },
    asrGpuOnly: function (modelId) { var m = asrInfo(modelId); return !!(m && m.gpuOnly); },
    /* dtype ที่ส่งให้ pipeline() — null = ใช้ค่าเริ่มต้นของ transformers.js (Xenova เดิม) */
    asrDtype: function (modelId, device) { var m = asrInfo(modelId); return (m && (device === 'webgpu' ? m.gpu : m.wasm)) || null; },
    asrLegacy: function (modelId) { var m = asrInfo(modelId); return (m && m.legacy) || null; },
    /* Thonburian (ฝึกไทยเป็นหลัก) */
    asrThai: function (modelId) { var m = asrInfo(modelId); return !!(m && m.thai); },
    /* ภาษาที่ส่งให้ Whisper: Thonburian + หน้าเลือก "อัตโนมัติ"/ไม่ระบุ → 'thai' · ผู้ใช้เลือกภาษาเองก็ตามนั้น · รุ่นอื่นคืนค่าที่ส่งมาตามเดิม (ไม่ระบุ/auto → undefined) */
    asrLanguage: function (modelId, lang) {
      var m = asrInfo(modelId), explicit = lang && lang !== 'auto' ? lang : undefined;
      return explicit || (m && m.thai ? THAI_LANG : undefined);
    },
    /* WASM รันรุ่นนี้ได้บนเครื่องที่รายงานแรมเท่านี้ไหม (mem = navigator.deviceMemory; ไม่รู้ค่า/0 = ผ่าน) */
    asrWasmOk: function (modelId, mem) { var m = asrInfo(modelId); return !(m && m.wasmMinMem && mem && mem < m.wasmMinMem); }
  };
})(typeof self !== 'undefined' ? self : window);
