/* ══════════════════════════════════════════════════════════════════
   Web Worker แยกต่างหากสำหรับถอดเสียงพูดเป็นข้อความ (Whisper ผ่าน transformers.js)
   ใช้โดยวิดเจ็ตแชท AI ลอย (ai-chat-widget.js) โหมด "เปิดไมค์คุย" — รับ PCM 16kHz mono ที่ถอดรหัส/
   resample มาแล้วจากฝั่งหน้าเว็บหลัก (decodeAudioData/OfflineAudioContext ใช้ใน Worker ไม่ได้ในหลาย
   เบราว์เซอร์ ต้องทำที่เธรดหลักเสมอ เหมือนที่ text-to-speech.js ทำกับไฟล์อัปโหลด) แล้วส่งผลข้อความกลับ
   ══════════════════════════════════════════════════════════════════ */
'use strict';

var pipelinePromise = null;

/* ⚠️ pin เวอร์ชัน onnxruntime-web เดียวกับ tts-worker.js/ai-chat-worker.js (1.24.3) — ห้ามอัปเดตแยก
   จากกันโดยไม่เช็ค microsoft/onnxruntime#28306 / huggingface/transformers.js#1707 ก่อนเสมอ */
function configureOnnxWasmPaths(env) {
  var isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(self.navigator.userAgent);
  env.backends.onnx.wasm.wasmPaths = isSafari
    ? { mjs: './vendor/transformers/ort-wasm-simd-threaded.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.wasm' }
    : { mjs: './vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm' };
  env.backends.onnx.wasm.numThreads = 1;
}

/* ใช้ whisper-tiny เสมอ (ไม่ให้เลือกขนาดแบบหน้า text-to-speech.html) — โหมดเปิดไมค์คุยเป็นคำถามสั้นๆ
   ต่อเนื่องหลายรอบ ต้องการความเร็วตอบสนองมากกว่าความแม่นยำสูงสุด และไม่อยากให้ผู้ใช้ต้องโหลดโมเดลใหญ่
   เพิ่มอีกก้อนซ้อนกับโมเดลแชท (Qwen) ที่โหลดอยู่แล้ว — เสี่ยงหน่วยความจำรวมสูงเกินไปบนมือถือ */
var MODEL_ID = 'Xenova/whisper-tiny';

function loadPipeline(onProgress, jobId) {
  if (!pipelinePromise) {
    pipelinePromise = import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
      configureOnnxWasmPaths(mod.env);
      return mod.pipeline('automatic-speech-recognition', MODEL_ID, { progress_callback: onProgress });
    });
    pipelinePromise.then(function () {
      self.postMessage({ type: 'pipeline-ready', jobId: jobId });
    }, function () { /* โหลดพัง — ปล่อยให้ error จริงโผล่ตอน transcribe ครั้งแรกแทน */ });
  }
  return pipelinePromise;
}

var isBusy = false;

self.onmessage = function (e) {
  var msg = e.data;
  if (!msg || msg.type !== 'transcribe') return;
  var jobId = msg.jobId, pcm = msg.pcm, lang = msg.lang;

  if (isBusy) {
    self.postMessage({ type: 'error', jobId: jobId, message: 'Worker กำลังยุ่งอยู่กับงานก่อนหน้า (ไม่ควรเกิดขึ้น)' });
    return;
  }
  isBusy = true;

  function onModelProgress(p) {
    if (p && p.status === 'progress' && p.file) {
      self.postMessage({ type: 'model-progress', jobId: jobId, file: p.file, progress: p.progress });
    }
  }

  loadPipeline(onModelProgress, jobId).then(function (transcriber) {
    var opts = { task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, no_repeat_ngram_size: 3 };
    if (lang && lang !== 'auto') opts.language = lang;
    return transcriber(pcm, opts);
  }).then(function (result) {
    self.postMessage({ type: 'result', jobId: jobId, text: (result && result.text) || '' });
  }).catch(function (err) {
    self.postMessage({ type: 'error', jobId: jobId, message: err && err.message ? err.message : String(err) });
  }).then(function () {
    isBusy = false;
  });
};
