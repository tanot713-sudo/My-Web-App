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
     (small ~250MB, medium ~750MB-1GB ไฟล์โมเดล + หน่วยความจำ WASM ตอนรันอีกหลายเท่า) */
  var ASR_MODELS = [
    { id: 'Xenova/whisper-tiny', heavy: false },
    { id: 'Xenova/whisper-base', heavy: false },
    { id: 'Xenova/whisper-small', heavy: true },
    { id: 'Xenova/whisper-medium', heavy: true }
  ];
  g.TanotMediaModels = {
    TTS_DTYPE_OVERRIDES: TTS_DTYPE_OVERRIDES,
    ASR_MODELS: ASR_MODELS,
    ttsDtype: function (modelId) { return TTS_DTYPE_OVERRIDES[modelId] || null; },
    asrHeavy: function (modelId) { return ASR_MODELS.some(function (m) { return m.id === modelId && m.heavy; }); }
  };
})(typeof self !== 'undefined' ? self : window);
