/* ══════════════════════════════════════════════════════════════════
   media-models.js — ตารางกลางของโมเดลเสียงในเบราว์เซอร์ (ใช้ร่วมกันทั้งเธรดหลักและ Worker)
   โหลดได้ 2 แบบด้วยไฟล์เดียว: <script src="media-models.js"> ในหน้า (ผ่าน media-core.js) และ
   import('./media-models.js') ใน Worker แบบ module (tts-worker.js) — จึงเขียนเป็นสคริปต์ธรรมดาที่ตั้งค่า
   ลง self/window (ไม่มี export) ถึงจะใช้ได้ทั้งสองทาง

   ‼️ เดิม TTS_DTYPE_OVERRIDES มีซ้ำ 2 ชุดใน text-to-speech.js กับ tts-worker.js (คนละ execution context)
   และเคยลืมแก้คู่กันจนเกิดบั๊กจริง (2026-08-10: Worker ยังบังคับ fp32 ให้ 2 โมเดลที่ q8 ใช้ได้แล้ว →
   หน่วยความจำพุ่งตอนรันหลาย Worker ขนาน แท็บแครช "หน้ารีเฟรชเอง") — ย้ายมาไว้ที่นี่ที่เดียวแล้ว
   ทั้งสองฝั่งอ่านจากไฟล์นี้ แก้ตารางนี้ที่เดียวพอ

   ทำไมโมเดล "หญิง (โทนพอดแคสต์)" ต้องบังคับ fp32: transformers.js เลือกไฟล์ ONNX ตาม dtype เริ่มต้นของ
   backend (wasm = 'q8' → onnx/model_quantized.onnx) — phlebotomy1996/mms-thai-female-podcast-spk0 ไม่มี
   ไฟล์ quantized (มีแค่ model.onnx กับ model_fp16.onnx) ปล่อยดีฟอลต์จะ 404 · เลือก fp32 ไม่ใช่ fp16 เพราะ
   fp32 รองรับบน wasm ครบทุกเบราว์เซอร์แน่นอนกว่า · Tanotfin/mms-tts-2081-FM-onnx / M-onnx เคยต้อง fp32
   แต่แก้ต้นตอ (export ONNX ใหม่ด้วย torch.where shape คงที่) แล้ว ใช้ q8 ได้ตามปกติ — ห้ามเติมกลับ
   ไฟล์ fp32 ใหญ่กว่า q8 หลายเท่า → media-core.js ให้โมเดล fp32 รันได้ Worker เดียวเสมอทุกเครื่อง */
(function (g) {
  'use strict';
  var TTS_DTYPE_OVERRIDES = {
    'phlebotomy1996/mms-thai-female-podcast-spk0': 'fp32',
    /* ชุด stable (2026-10) — dtype ที่มีให้เหมือนต้นฉบับทุกประการ: พอดแคสต์ fp32 เท่านั้น, FM/M ใช้ q8 ตามค่าเริ่มต้น */
    'Tanotfin/mms-thai-female-podcast-spk0-stable-onnx': 'fp32'
  };
  /* เสียงไทย "stable" (2026-10): VITS ฝังความสุ่มไว้ใน ONNX (noise_scale_duration 0.8 / noise_scale 0.667) → อาการ "ยานตอนต้นคำ / สั่นตอนท้ายคำ"
     เจ้าของแปลงชุดใหม่ที่ noise_scale_duration 0.3 / noise_scale 0.333 (น้ำหนักเดิม) · stable → ต้นฉบับ = ทางถอยเมื่อโหลดชุดใหม่ไม่ได้ (404/เครือข่าย) ·
     id เดิมทั้ง 4 (รวม "ค่าเริ่มต้น" Tanotfin/mms-tts-2081-onnx ที่เอาออกจากรายการเพราะฟังไม่รู้เรื่อง) แปลงเป็น stable ด้วย ttsMigrate */
  var TTS_DEFAULT_VOICE = 'Tanotfin/mms-tts-2081-FM-stable-onnx';
  var TTS_LEGACY = {
    'Tanotfin/mms-tts-2081-FM-stable-onnx': 'Tanotfin/mms-tts-2081-FM-onnx',
    'Tanotfin/mms-tts-2081-M-stable-onnx': 'Tanotfin/mms-tts-2081-M-onnx',
    'Tanotfin/mms-thai-female-podcast-spk0-stable-onnx': 'phlebotomy1996/mms-thai-female-podcast-spk0'
  };
  var TTS_MIGRATE = {
    'Tanotfin/mms-tts-2081-onnx': TTS_DEFAULT_VOICE,
    'Tanotfin/mms-tts-2081-FM-onnx': 'Tanotfin/mms-tts-2081-FM-stable-onnx',
    'Tanotfin/mms-tts-2081-M-onnx': 'Tanotfin/mms-tts-2081-M-stable-onnx',
    'phlebotomy1996/mms-thai-female-podcast-spk0': 'Tanotfin/mms-thai-female-podcast-spk0-stable-onnx'
  };
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
  g.TanotMediaModels = {
    TTS_DTYPE_OVERRIDES: TTS_DTYPE_OVERRIDES,
    ASR_MODELS: ASR_MODELS,
    ttsDtype: function (modelId) { return TTS_DTYPE_OVERRIDES[modelId] || null; },
    TTS_DEFAULT_VOICE: TTS_DEFAULT_VOICE,
    TTS_LEGACY: TTS_LEGACY,
    /* id เสียงที่เคยเลือกไว้ (ชุดเดิม) → ตัว stable คู่กัน · id อื่น/ใหม่แล้ว = คืนค่าเดิม */
    ttsMigrate: function (modelId) { return Object.prototype.hasOwnProperty.call(TTS_MIGRATE, modelId) ? TTS_MIGRATE[modelId] : modelId; },
    /* ทางถอยของ stable = repo ต้นฉบับ (ไม่มี = null) */
    ttsLegacy: function (modelId) { return TTS_LEGACY[modelId] || null; },
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
