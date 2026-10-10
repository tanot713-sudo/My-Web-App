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
    'phlebotomy1996/mms-thai-female-podcast-spk0': 'fp32'
  };
  /* Whisper ที่เลือกได้ในหน้า text-to-speech — heavy = ซ่อนบนมือถือ (iOS/Android) เพราะแรมต่อแท็บไม่พอ
     (small ~250MB, medium ~750MB-1GB ไฟล์โมเดล + หน่วยความจำ WASM ตอนรันอีกหลายเท่า)
     2 ตระกูล:
     • Xenova/whisper-*  = ตัวเดิม (WASM q8 ตามค่าเริ่มต้นของ transformers.js) — คงไว้ให้เลือกและเป็นค่าเริ่มต้นของเครื่องที่ใช้ WASM
     • onnx-community/whisper-* = ONNX รุ่นใหม่ที่รันบน WebGPU ได้ (encoder fp32/fp16 + decoder q4 — ตามตัวอย่าง webgpu-whisper ของ transformers.js)
       เลือกได้ทั้ง WebGPU และ WASM (WASM ใช้ q8 ทั้งคู่) · legacy = ตัวเทียบเท่าใน Xenova ที่ถอยไปใช้อัตโนมัติถ้าโหลดตัวใหม่ไม่ได้ (404/ไฟล์ dtype ไม่มี)
       gpuOnly = ใหญ่เกินกว่าจะรันบน WASM ได้ — โชว์เฉพาะเครื่องที่ใช้ WebGPU ได้จริง · f16 = encoder เป็น fp16 ต้องมี shader-f16
     ⚠️ ชื่อ repo/ไฟล์ dtype ของ onnx-community ตรวจจาก sandbox ไม่ได้ (เข้า huggingface.co ไม่ได้) — ใช้ `node tools/media-eval/check-models.mjs`
        ตรวจกับ Hugging Face จริงก่อนปล่อย/เมื่อแก้ตารางนี้ */
  var GPU_DTYPE = { encoder_model: 'fp32', decoder_model_merged: 'q4' };
  var GPU_DTYPE_F16 = { encoder_model: 'fp16', decoder_model_merged: 'q4' };
  var WASM_DTYPE = { encoder_model: 'q8', decoder_model_merged: 'q8' };
  var ASR_MODELS = [
    { id: 'Xenova/whisper-tiny', heavy: false },
    { id: 'Xenova/whisper-base', heavy: false },
    { id: 'Xenova/whisper-small', heavy: true },
    { id: 'Xenova/whisper-medium', heavy: true },
    { id: 'onnx-community/whisper-tiny', heavy: false, legacy: 'Xenova/whisper-tiny', gpu: GPU_DTYPE, wasm: WASM_DTYPE },
    { id: 'onnx-community/whisper-base', heavy: false, legacy: 'Xenova/whisper-base', gpu: GPU_DTYPE, wasm: WASM_DTYPE },
    { id: 'onnx-community/whisper-small', heavy: true, legacy: 'Xenova/whisper-small', gpu: GPU_DTYPE, wasm: WASM_DTYPE },
    { id: 'onnx-community/whisper-large-v3-turbo', heavy: true, gpuOnly: true, f16: true, gpu: GPU_DTYPE_F16 }
  ];
  function asrInfo(modelId) {
    for (var i = 0; i < ASR_MODELS.length; i++) if (ASR_MODELS[i].id === modelId) return ASR_MODELS[i];
    return null;
  }
  g.TanotMediaModels = {
    TTS_DTYPE_OVERRIDES: TTS_DTYPE_OVERRIDES,
    ASR_MODELS: ASR_MODELS,
    ttsDtype: function (modelId) { return TTS_DTYPE_OVERRIDES[modelId] || null; },
    asrHeavy: function (modelId) { var m = asrInfo(modelId); return !!(m && m.heavy); },
    asrInfo: asrInfo,
    /* รันบน WebGPU ได้ไหม (ตระกูล onnx-community เท่านั้น — Xenova เดิมคง WASM เหมือนก่อนหน้า) */
    asrWebgpuCapable: function (modelId) { var m = asrInfo(modelId); return !!(m && m.gpu); },
    asrGpuOnly: function (modelId) { var m = asrInfo(modelId); return !!(m && m.gpuOnly); },
    /* dtype ที่ส่งให้ pipeline() — null = ใช้ค่าเริ่มต้นของ transformers.js (Xenova เดิม) */
    asrDtype: function (modelId, device) { var m = asrInfo(modelId); return (m && (device === 'webgpu' ? m.gpu : m.wasm)) || null; },
    asrLegacy: function (modelId) { var m = asrInfo(modelId); return (m && m.legacy) || null; }
  };
})(typeof self !== 'undefined' ? self : window);
