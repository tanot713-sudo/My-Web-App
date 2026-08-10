/* ══════════════════════════════════════════════════════════════════
   Web Worker แยกต่างหากสำหรับรันโมเดลแชท AI (Qwen2.5-Instruct ผ่าน transformers.js)
   ใช้โดยวิดเจ็ตแชทลอย (ai-chat-widget.js) ที่ฉีดเข้าทุกหน้าผ่าน shell.js
   เหตุผลเดียวกับ tts-worker.js: รัน WASM ในเธรดหลักจะบล็อกหน้าเว็บระหว่างคำนวณ (single-thread
   asyncify รันแบบ synchronous) ย้ายมารันใน Worker แทนให้ UI/หน้าเว็บว่างอยู่เสมอ

   ต่างจาก tts-worker.js ตรงที่ไม่ต้องมี "พูล" หลายตัวขนานกัน — แชทเป็นงานต่อเนื่องทีละคำตอบ
   (ไม่ใช่ตัดเป็นท่อนแล้วขนานแบบเสียง) ใช้ Worker ตัวเดียวพอ แต่คงไว้ไม่ให้ terminate ข้ามคำถาม
   เพื่อให้ pipeline ที่โหลด/แคชไว้แล้วถูกใช้ซ้ำได้ทุกข้อความถัดไปในเซสชันเดียวกัน (ไม่ต้องโหลดโมเดล
   ใหม่ทุกครั้งที่ถาม) — ฝั่ง ai-chat-widget.js เองก็ไม่ terminate() worker นี้ตอนกด "เริ่มแชทใหม่" ด้วย
   (แค่รีเซ็ต messages array) เพื่อคง pipeline ที่โหลดไว้แล้วไม่ให้ต้องโหลดซ้ำ

   ⚠️ ประวัติ: เคยลองอัป MODEL_ID เป็น 1.5B-Instruct ตรงๆ บน WASM มาก่อน (ตอบดีกว่าชัดเจน) แต่เจอ
   "Can't create a session... ERROR_MESSAGE: std::bad_alloc" จริงตอนใช้งาน (แม้บนเดสก์ท็อป) — WASM
   รันไทม์มีหน่วยความจำ "ก้อนเดียว" ขนาดจำกัดตายตัว (linear memory) 1.5B ใช้ RAM สูงตอนคำนวณจริงเกินกว่า
   จะรองรับไหวในหลายเครื่อง — ตอนนี้แก้ด้วยกลยุทธ์ "ลองตัวใหญ่ผ่าน WebGPU ก่อน พังค่อยถอยมาตัวเล็กบน WASM"
   ด้านล่างแทน (ดู loadPipeline) WebGPU ไม่ผูกกับเพดาน WASM linear memory เดียวกัน เพราะข้อมูลอยู่ใน
   หน่วยความจำการ์ดจอแทน จึงมีโอกาสรัน 1.5B ได้จริงบนเครื่องที่รองรับ */
'use strict';

var pipelinePromise = null;
var activeInfo = null; // { modelId, device } ของ pipeline ที่โหลดสำเร็จจริง — แจ้งฝั่งหน้าเว็บได้

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

var MODEL_ID_BIG = 'onnx-community/Qwen2.5-1.5B-Instruct';   // ลองก่อน ถ้าเครื่องรองรับ WebGPU
var MODEL_ID_SMALL = 'onnx-community/Qwen2.5-0.5B-Instruct'; // ตัวสำรอง (ใช้แน่ๆ ถ้าตัวใหญ่พัง/ไม่มี WebGPU)

function loadPipeline(onProgress, jobId) {
  if (!pipelinePromise) {
    pipelinePromise = import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
      configureOnnxWasmPaths(mod.env);

      function loadWith(modelId, device) {
        var opts = { dtype: 'q4', progress_callback: onProgress };
        if (device) opts.device = device;
        return mod.pipeline('text-generation', modelId, opts).then(function (generator) {
          activeInfo = { modelId: modelId, device: device || 'wasm' };
          return { mod: mod, generator: generator };
        });
      }

      /* navigator.gpu มีเฉพาะเบราว์เซอร์ที่รองรับ WebGPU จริง (Chrome/Edge รุ่นใหม่ ฯลฯ) — เช็คก่อน
         เพื่อไม่เสียเวลาลองดาวน์โหลดโมเดล 1.5B ก้อนใหญ่ทิ้งเปล่าๆ บนเบราว์เซอร์ที่ไม่มีทางใช้ได้อยู่แล้ว
         ⚠️ 2026-08-10: แค่มี navigator.gpu (ตัว adapter/driver รองรับ WebGPU) ไม่ได้แปลว่าการ์ดจอมี VRAM
         พอรันโมเดล 1.5B จริง — ตัว loadWith().catch() ด้านล่างจับได้แค่กรณี "สร้าง session ไม่สำเร็จ"
         (พังตอนโหลด) เท่านั้น แต่ถ้าโหลดสำเร็จแล้ว "พังตอน generate จริง" (VRAM ไม่พอกลางคัน) มักเป็น
         การ crash ระดับ GPU process/driver ที่ JS try/catch หรือ Promise.catch() ดักจับไม่ได้เลย (ต่างจาก
         std::bad_alloc ฝั่ง WASM ที่อย่างน้อยยัง reject เป็น JS error ให้ดักได้) เบราว์เซอร์กู้คืนด้วยการ
         reload แท็บเอง ผู้ใช้เห็นเป็นเหมือน "หน้าเว็บรีเฟรชเอง" — ป้องกันไม่ให้เกิดตั้งแต่ต้นทาง (แทนที่จะ
         พยายามดักจับซึ่งทำไม่ได้จริง) ด้วยการเช็ก navigator.deviceMemory (GB) ประกอบก่อนเสมอ ใช้เกณฑ์
         เดียวกับ ttsPoolSize() ใน text-to-speech.js/tts-worker.js (ระมัดระวังไว้ก่อนเมื่อไม่รู้ค่า — คือ
         iOS Safari ทั้งหมดและเบราว์เซอร์อื่นนอก Chrome/Edge เสมอ — ค่อยลองตัวใหญ่เฉพาะตอน "ยืนยันแล้วจริง"
         ว่าแรมเยอะพอ mem>=4) แลกกับคำตอบที่อาจไม่ดีเท่าโมเดลใหญ่บนเครื่องที่ไม่รู้ค่าแต่ที่จริงแรงพอ
         เพื่อความเสถียร (ไม่เสี่ยงแท็บแครช) เป็นหลัก */
      var mem = (typeof navigator !== 'undefined') ? navigator.deviceMemory : undefined;
      var canTryBig = typeof navigator !== 'undefined' && navigator.gpu && mem && mem >= 4;
      if (canTryBig) {
        return loadWith(MODEL_ID_BIG, 'webgpu').catch(function (err) {
          self.postMessage({
            type: 'fallback', jobId: jobId,
            message: 'ลองโมเดลใหญ่ (1.5B) ผ่าน WebGPU ไม่สำเร็จ (' + (err && err.message ? err.message : err) + ') ใช้ตัวเล็กแทน'
          });
          return loadWith(MODEL_ID_SMALL, undefined);
        });
      }
      return loadWith(MODEL_ID_SMALL, undefined);
    });
    pipelinePromise.then(function () {
      self.postMessage({ type: 'pipeline-ready', jobId: jobId, modelId: activeInfo.modelId, device: activeInfo.device });
    }, function () { /* โหลดพังทั้งคู่ — ปล่อยให้ error จริงโผล่ตอนเรียก chat ครั้งแรกแทน */ });
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
    self.postMessage({ type: 'model-info', jobId: jobId, modelId: activeInfo.modelId, device: activeInfo.device });
    /* streamer ส่ง token ทีละตัวกลับหน้าเว็บทันทีที่โมเดลคำนวณเสร็จ (ไม่ต้องรอคำตอบเต็มทั้งก้อน) —
       ให้ความรู้สึกเหมือนแชทบอทจริงๆ ที่พิมพ์ตอบทีละตัวอักษร แทนที่จะขึ้นคำตอบทั้งหมดพร้อมกันตอนจบ */
    var streamer = new mod.TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: function (token) {
        self.postMessage({ type: 'token', jobId: jobId, token: token });
      }
    });
    /* ลดจาก 512 → 256: เจอจริงว่าโมเดล 0.5B รันบน WASM ช้ามากกว่าจะได้คำตอบครบ (โดยเฉพาะรอบที่ต่อจาก
       ถอดเสียงจากไมค์ ซึ่งมีขั้นตอน ASR ต่อคิวมาก่อนหน้าอีกที) ตัดเพดานให้สั้นลงช่วยให้ตอบเร็วขึ้นชัดเจน
       และกันโมเดลพูดยืดยาวเกินจำเป็นสำหรับแชทถาม-ตอบทั่วไปด้วย */
    return generator(messages, { max_new_tokens: 256, temperature: 0.7, streamer: streamer });
  }).then(function () {
    self.postMessage({ type: 'done', jobId: jobId });
  }).catch(function (err) {
    self.postMessage({ type: 'error', jobId: jobId, message: err && err.message ? err.message : String(err) });
  }).then(function () {
    isBusy = false;
  });
};
