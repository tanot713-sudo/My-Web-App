/* ══════════════════════════════════════════════════════════════════
   Web Worker แยกต่างหากสำหรับรันโมเดลเสียง MMS-TTS (transformers.js)
   เหตุผลที่ต้องแยกออกมาเป็น Worker: เดิมรันตรงในเธรดหลักของหน้าเว็บ — แม้ตัดข้อความ
   เป็นท่อนสั้นๆ แล้ว (กัน attention คำนวณแบบ O(n²) บวมจนแครช) หน้าเว็บก็ยังค้าง/ไม่ตอบสนอง
   ระหว่างคำนวณแต่ละท่อนอยู่ดี เพราะ WASM แบบ single-thread (asyncify) รันแบบ synchronous
   บล็อก event loop ของเธรดที่มันทำงานอยู่เสมอไม่ว่าจะเธรดไหนก็ตาม — ย้ายมารันใน Worker
   (เธรดแยกต่างหาก) แทน ทำให้เธรดหลัก/UI ของหน้าเว็บว่างอยู่เสมอ ไม่ค้างอีกต่อไป แม้การ
   คำนวณจริงจะยังใช้เวลาเท่าเดิม (ฮาร์ดแวร์จำกัดแค่ไหนก็ยังจำกัดเท่านั้น แค่ไม่บล็อกหน้าจอ)
   ══════════════════════════════════════════════════════════════════ */
'use strict';

var pipelinePromiseByModel = {};

function configureOnnxWasmPaths(env) {
  var isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(self.navigator.userAgent);
  env.backends.onnx.wasm.wasmPaths = isSafari
    ? { mjs: './vendor/transformers/ort-wasm-simd-threaded.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.wasm' }
    : { mjs: './vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm' };
  env.backends.onnx.wasm.numThreads = 1; // ไม่มี SharedArrayBuffer อยู่แล้ว บังคับ single-thread กันค้าง (คนละเรื่องกับที่ทำให้หน้าเว็บค้าง — นั่นแก้ด้วยการย้ายมา Worker นี้)
}

function loadPipeline(modelId, onProgress) {
  if (!pipelinePromiseByModel[modelId]) {
    pipelinePromiseByModel[modelId] = import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
      var env = mod.env;
      configureOnnxWasmPaths(env);
      return mod.pipeline('text-to-speech', modelId, { progress_callback: onProgress });
    });
  }
  return pipelinePromiseByModel[modelId];
}

self.onmessage = function (e) {
  var msg = e.data;
  if (!msg || msg.type !== 'synthesize') return;
  var chunks = msg.chunks, modelId = msg.modelId, jobId = msg.jobId;
  var audioParts = [], samplingRate = null;

  function onModelProgress(p) {
    if (p && p.status === 'progress' && p.file) {
      self.postMessage({ type: 'model-progress', jobId: jobId, file: p.file, progress: p.progress });
    }
  }

  chunks.reduce(function (p, chunk, idx) {
    return p.then(function () {
      self.postMessage({ type: 'chunk-start', jobId: jobId, index: idx + 1, total: chunks.length });
      return loadPipeline(modelId, onModelProgress);
    }).then(function (synthesizer) {
      return synthesizer(chunk);
    }).then(function (output) {
      if (!output || !output.audio || !output.audio.length) throw new Error('ไม่ได้ข้อมูลเสียงกลับมา');
      samplingRate = output.sampling_rate;
      audioParts.push(output.audio);
    });
  }, Promise.resolve()).then(function () {
    var gapSamples = Math.round(samplingRate * 0.3);
    var total = audioParts.reduce(function (s, a) { return s + a.length; }, 0) + gapSamples * Math.max(0, audioParts.length - 1);
    var combined = new Float32Array(total);
    var offset = 0;
    audioParts.forEach(function (a, i) {
      combined.set(a, offset);
      offset += a.length + (i < audioParts.length - 1 ? gapSamples : 0);
    });
    self.postMessage({ type: 'done', jobId: jobId, audio: combined, sampling_rate: samplingRate }, [combined.buffer]);
  }).catch(function (err) {
    self.postMessage({ type: 'error', jobId: jobId, message: err && err.message ? err.message : String(err) });
  });
};
