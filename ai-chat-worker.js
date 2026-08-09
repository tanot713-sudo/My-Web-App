/* ══════════════════════════════════════════════════════════════════
   Web Worker แยกต่างหากสำหรับรันโมเดลแชท AI (Qwen2.5-Instruct ผ่าน transformers.js)
   ใช้โดยวิดเจ็ตแชทลอย (ai-chat-widget.js) ที่ฉีดเข้าทุกหน้าผ่าน shell.js
   เหตุผลเดียวกับ tts-worker.js: รัน WASM ในเธรดหลักจะบล็อกหน้าเว็บระหว่างคำนวณ (single-thread
   asyncify รันแบบ synchronous) ย้ายมารันใน Worker แทนให้ UI/หน้าเว็บว่างอยู่เสมอ

   ต่างจาก tts-worker.js ตรงที่ไม่ต้องมี "พูล" หลายตัวขนานกัน — แชทเป็นงานต่อเนื่องทีละคำตอบ
   (ไม่ใช่ตัดเป็นท่อนแล้วขนานแบบเสียง) ใช้ Worker ตัวเดียวพอ แต่คงไว้ไม่ให้ terminate ข้ามคำถาม
   เพื่อให้ pipeline ที่โหลด/แคชไว้แล้วถูกใช้ซ้ำได้ทุกข้อความถัดไปในเซสชันเดียวกัน (ไม่ต้องโหลดโมเดล
   ใหม่ทุกครั้งที่ถาม) — ฝั่ง ai-chat-widget.js เองก็ไม่ terminate() worker นี้ตอนกด "เริ่มแชทใหม่" ด้วย
   (แค่รีเซ็ต messages array) เพื่อคง pipeline ที่โหลดไว้แล้ว (~1GB) ไม่ให้ต้องโหลดซ้ำ */
'use strict';

var pipelinePromise = null;

/* ⚠️ ต้อง pin เวอร์ชัน onnxruntime-web เดียวกับ tts-worker.js (1.24.3) เพราะใช้ vendor bundle
   ชุดเดียวกัน (vendor/transformers/*) ห้ามอัปเดตแยกจากกันโดยไม่เช็ค microsoft/onnxruntime#28306 และ
   huggingface/transformers.js#1707 ก่อนเสมอ — ดูรายละเอียดเต็มที่คอมเมนต์เดียวกันใน tts-worker.js */
function configureOnnxWasmPaths(env) {
  var isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(self.navigator.userAgent);
  env.backends.onnx.wasm.wasmPaths = isSafari
    ? { mjs: './vendor/transformers/ort-wasm-simd-threaded.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.wasm' }
    : { mjs: './vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm' };
  env.backends.onnx.wasm.numThreads = 1; // ไม่มี SharedArrayBuffer อยู่แล้ว บังคับ single-thread กันค้าง
}

/* onnx-community/Qwen2.5-1.5B-Instruct: โมเดลแชทตระกูล Qwen2.5 ที่แปลงเป็น ONNX พร้อมใช้กับ
   transformers.js ไว้แล้ว (ไม่ต้องแปลงเองผ่าน Colab แบบ TTS) รองรับหลายภาษารวมไทย — อัปจากรุ่น 0.5B
   เดิม (ตอบสับสน/ผิดง่ายเกินไป) เป็น 1.5B ให้ตอบดีขึ้นชัดเจน แลกกับขนาดไฟล์ที่ใหญ่ขึ้น (~800MB-1GB ที่
   dtype q4) และหน่วยความจำที่ต้องใช้มากขึ้นตอนรัน — เลือก dtype 'q4' (บีบอัด 4-bit) ตามคำแนะนำอย่างเป็น
   ทางการของ Hugging Face สำหรับรันบนเบราว์เซอร์ อยู่แล้วเพื่อลดขนาดให้เล็กที่สุดเท่าที่ยังใช้งานได้ */
var MODEL_ID = 'onnx-community/Qwen2.5-1.5B-Instruct';

function loadPipeline(onProgress, jobId) {
  if (!pipelinePromise) {
    pipelinePromise = import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
      configureOnnxWasmPaths(mod.env);
      return mod.pipeline('text-generation', MODEL_ID, { dtype: 'q4', progress_callback: onProgress })
        .then(function (generator) { return { mod: mod, generator: generator }; });
    });
    pipelinePromise.then(function () {
      self.postMessage({ type: 'pipeline-ready', jobId: jobId });
    }, function () { /* โหลดพัง — ปล่อยให้ error จริงโผล่ตอนเรียก chat ครั้งแรกแทน */ });
  }
  return pipelinePromise;
}

var isBusy = false;

self.onmessage = function (e) {
  var msg = e.data;
  if (!msg || msg.type !== 'chat') return;
  var jobId = msg.jobId, messages = msg.messages;

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

  loadPipeline(onModelProgress, jobId).then(function (loaded) {
    var mod = loaded.mod, generator = loaded.generator;
    /* streamer ส่ง token ทีละตัวกลับหน้าเว็บทันทีที่โมเดลคำนวณเสร็จ (ไม่ต้องรอคำตอบเต็มทั้งก้อน) —
       ให้ความรู้สึกเหมือนแชทบอทจริงๆ ที่พิมพ์ตอบทีละตัวอักษร แทนที่จะขึ้นคำตอบทั้งหมดพร้อมกันตอนจบ */
    var streamer = new mod.TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: function (token) {
        self.postMessage({ type: 'token', jobId: jobId, token: token });
      }
    });
    return generator(messages, { max_new_tokens: 512, temperature: 0.7, streamer: streamer });
  }).then(function () {
    self.postMessage({ type: 'done', jobId: jobId });
  }).catch(function (err) {
    self.postMessage({ type: 'error', jobId: jobId, message: err && err.message ? err.message : String(err) });
  }).then(function () {
    isBusy = false;
  });
};
