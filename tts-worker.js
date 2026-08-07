/* ══════════════════════════════════════════════════════════════════
   Web Worker แยกต่างหากสำหรับรันโมเดลเสียง MMS-TTS (transformers.js)
   เดิมรันตรงในเธรดหลักของหน้าเว็บ — แม้ตัดข้อความเป็นท่อนสั้นๆ แล้ว (กัน attention คำนวณแบบ
   O(n²) บวมจนแครช) หน้าเว็บก็ยังค้าง/ไม่ตอบสนองระหว่างคำนวณแต่ละท่อนอยู่ดี เพราะ WASM แบบ
   single-thread (asyncify) รันแบบ synchronous บล็อก event loop ของเธรดที่มันทำงานอยู่เสมอ —
   ย้ายมารันใน Worker (เธรดแยกต่างหาก) แทน ทำให้เธรดหลัก/UI ของหน้าเว็บว่างอยู่เสมอ ไม่ค้างอีกต่อไป

   ไฟล์นี้ถูกสร้างเป็น "หลายอินสแตนซ์พร้อมกัน" (worker pool) จากฝั่ง text-to-speech.js เพื่อรัน
   หลายท่อนข้อความขนานกันจริงๆ ใช้ core CPU ที่มีอยู่แทนที่จะรันทีละท่อนเรียงคิว — โค้ดในไฟล์นี้
   จึงเขียนแบบไม่มี state ข้ามงาน (แต่ละ Worker แคชแค่ pipeline ของตัวเอง ไม่รู้จักอินสแตนซ์อื่น
   ในพูลเลย) ตัว orchestration ที่แบ่งงาน/รวมผลลัพธ์กลับมาเรียงลำดับถูกต้องอยู่ฝั่งหน้าเว็บหลัก

   ยังพยายามใช้ WebGPU ก่อน (เร็วกว่า WASM มาก ถ้าเครื่อง/เบราว์เซอร์รองรับจริง — ไฟล์
   ort.webgpu.bundle.min.mjs ที่ฝังในเว็บรองรับอยู่แล้ว) แต่ยังไม่เคยทดสอบกับโมเดลที่บีบอัด
   int8 ตัวนี้จริงบนฮาร์ดแวร์จริง (แซนด์บ็อกซ์พัฒนาไม่มี GPU/เน็ตให้ทดสอบ) จึงต้องมี fallback ที่
   แข็งแรง: ถ้าสร้าง pipeline ไม่ได้ หรือสร้างได้แต่รันจริงแล้ว error (เช่น GPU ไม่รองรับ op
   แบบ quantized บางตัว) ให้เปลี่ยนไปใช้ WASM แทนทันทีแบบเงียบๆ ไม่ถือเป็นความล้มเหลวของงาน
   ══════════════════════════════════════════════════════════════════ */
'use strict';

var pipelinePromiseByModel = {};
var usingWebgpuByModel = {}; // modelId -> true ถ้า pipeline ที่แคชไว้ตอนนี้เป็นความพยายามใช้ WebGPU ที่ยังไม่ยืนยันว่ารันได้จริง

function configureOnnxWasmPaths(env) {
  var isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(self.navigator.userAgent);
  env.backends.onnx.wasm.wasmPaths = isSafari
    ? { mjs: './vendor/transformers/ort-wasm-simd-threaded.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.wasm' }
    : { mjs: './vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm' };
  env.backends.onnx.wasm.numThreads = 1; // ไม่มี SharedArrayBuffer อยู่แล้ว บังคับ single-thread กันค้าง (คนละเรื่องกับที่ทำให้หน้าเว็บค้าง — นั่นแก้ด้วยการย้ายมา Worker นี้)
}

function loadWasmPipeline(modelId, onProgress) {
  return import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
    configureOnnxWasmPaths(mod.env);
    return mod.pipeline('text-to-speech', modelId, { progress_callback: onProgress });
  });
}

function loadWebgpuPipeline(modelId, onProgress) {
  return import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
    /* บังคับ dtype:'q8' ด้วย เพราะดีฟอลต์ของ transformers.js จะเลือก dtype ตาม device — บน
       device อื่นที่ไม่ใช่ 'wasm' ดีฟอลต์คือ fp32 (ไฟล์ onnx/model.onnx ตัวใหญ่ที่ยังไม่บีบอัด)
       ถ้าไม่ระบุเอง จะกลายเป็นดาวน์โหลด/รันไฟล์ fp32 แทนไฟล์ quantized ที่เราอัปโหลดไว้ */
    return mod.pipeline('text-to-speech', modelId, { device: 'webgpu', dtype: 'q8', progress_callback: onProgress });
  });
}

function loadPipeline(modelId, onProgress) {
  if (!pipelinePromiseByModel[modelId]) {
    var hasWebgpu = typeof self.navigator !== 'undefined' && !!self.navigator.gpu;
    usingWebgpuByModel[modelId] = hasWebgpu;
    pipelinePromiseByModel[modelId] = hasWebgpu ? loadWebgpuPipeline(modelId, onProgress) : loadWasmPipeline(modelId, onProgress);
  }
  return pipelinePromiseByModel[modelId];
}

function fallBackToWasm(modelId, onProgress) {
  usingWebgpuByModel[modelId] = false;
  pipelinePromiseByModel[modelId] = loadWasmPipeline(modelId, onProgress);
  return pipelinePromiseByModel[modelId];
}

/* สังเคราะห์ 1 ท่อน — ถ้ากำลังลองใช้ WebGPU อยู่แล้วพัง (ตอนสร้าง pipeline หรือตอนรันจริงก็ตาม)
   ให้ล้มกลับไปใช้ WASM แล้วลองท่อนเดิมซ้ำอีกครั้งเดียว จากนั้นท่อนถัดๆ ไปใน worker ตัวนี้จะใช้
   WASM ไปเลยไม่ลอง WebGPU ซ้ำอีก (กันเสียเวลา retry ซ้ำๆ ทุกท่อน) */
function synthesizeOneItem(text, modelId, onProgress) {
  return loadPipeline(modelId, onProgress).then(function (synth) {
    return synth(text);
  }).catch(function (err) {
    if (usingWebgpuByModel[modelId]) {
      console.warn('WebGPU ใช้ไม่สำเร็จ กลับไปรันด้วย WASM แทน:', err && err.message ? err.message : err);
      return fallBackToWasm(modelId, onProgress).then(function (synth) { return synth(text); });
    }
    throw err;
  });
}

self.onmessage = function (e) {
  var msg = e.data;
  if (!msg || msg.type !== 'synthesize-batch') return;
  var items = msg.items, modelId = msg.modelId, jobId = msg.jobId;

  function onModelProgress(p) {
    if (p && p.status === 'progress' && p.file) {
      self.postMessage({ type: 'model-progress', jobId: jobId, file: p.file, progress: p.progress });
    }
  }

  items.reduce(function (p, item) {
    return p.then(function () {
      self.postMessage({ type: 'item-start', jobId: jobId, i: item.i });
      return synthesizeOneItem(item.text, modelId, onModelProgress);
    }).then(function (output) {
      if (!output || !output.audio || !output.audio.length) throw new Error('ไม่ได้ข้อมูลเสียงกลับมา');
      self.postMessage(
        { type: 'item-done', jobId: jobId, i: item.i, audio: output.audio, samplingRate: output.sampling_rate },
        [output.audio.buffer]
      );
    }).catch(function (err) {
      self.postMessage({ type: 'item-error', jobId: jobId, i: item.i, message: err && err.message ? err.message : String(err) });
      throw err; // หยุดท่อนที่เหลือใน worker ตัวนี้ (งานทั้งก้อนถือว่าล้มเหลวอยู่แล้วฝั่งหน้าเว็บหลัก)
    });
  }, Promise.resolve()).catch(function () { /* error ถูกรายงานผ่าน postMessage ไปแล้ว ไม่ต้องทำอะไรเพิ่ม */ });
};
