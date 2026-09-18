/* ══════════════════════════════════════════════════════════════════
   Web Worker แยกต่างหากสำหรับรันโมเดลแชท AI (Qwen2.5-Instruct ผ่าน transformers.js)
   ใช้โดยวิดเจ็ตแชทลอย (ai-chat-widget.js) ที่ฉีดเข้าทุกหน้าผ่าน shell.js

   ⚠️ ประวัติปัญหา (2026-08-13 → 2026-09-18) — อ่านก่อนแก้ไฟล์นี้:
   1) เคยลองโมเดล 1.5B-Instruct ตรงๆ บน WASM มาก่อน (ตอบดีกว่าชัดเจน) แต่เจอ
      "Can't create a session...std::bad_alloc" จริงตอนใช้งาน (แม้บนเดสก์ท็อป) — WASM มีหน่วยความจำ
      "ก้อนเดียว" ขนาดจำกัดตายตัว (linear memory) 1.5B ใช้ RAM สูงเกินกว่าจะรองรับไหวหลายเครื่อง
   2) แก้ด้วยกลยุทธ์ "ลองตัวใหญ่ผ่าน WebGPU ก่อน พังค่อยถอยมาตัวเล็กบน WASM" ภายใน worker เดียวกัน
      (import() module เดียว ใช้ mod.pipeline() สองรอบ) — แต่พบจาก log จริงของผู้ใช้ (เครื่อง 16GB RAM,
      WebGPU พร้อม) ว่าตัวใหญ่พังด้วย std::bad_alloc แล้ว "ลากตัวเล็กที่ควรจะรันได้สบายๆ ให้พังตามไปด้วย
      ด้วย error เดิมเป๊ะ" แม้เป็น worker ที่เพิ่งสร้างใหม่ — สาเหตุคือ loadWith(BIG)/loadWith(SMALL) ใช้
      module instance เดียวกัน จึงแชร์ WASM linear memory ก้อนเดียวกัน (โตได้ทางเดียว หดไม่ได้)
   3) แก้ชั่วคราวด้วยการปิดตัวใหญ่ไปเลย (ENABLE_BIG_MODEL_ATTEMPT=false) — ปลอดภัย แต่ทุกคนช้าลง (ตัวเล็ก
      บน WASM เธรดเดียว ไม่มี SharedArrayBuffer เพราะ GitHub Pages ตั้ง COOP/COEP header เองไม่ได้)
   4) แก้แบบถาวร (เวอร์ชันนี้): แยก "โมเดลใหญ่" กับ "โมเดลเล็ก" ให้อยู่คนละ Worker/JS realm ไปเลย
      (คนละ WASM linear memory จริงๆ ไม่แชร์กัน) — worker instance หนึ่งๆ จะลองโหลด "แค่โมเดลเดียว"
      ตามที่สั่งผ่าน message 'probe' เท่านั้น ไม่มี auto-fallback ข้ามโมเดลภายใน worker เดียวอีกต่อไป
      ฝั่งหน้าเว็บ (ai-chat-widget.js / invest-*.js) เป็นคนสร้าง 2 worker พร้อมกัน (ถ้าเครื่องรองรับ
      WebGPU+แรมพอ) แล้วแข่งกันด้วย Promise.any — ตัวไหนพร้อมก่อนก็ใช้ตัวนั้น ตัวใหญ่พังไม่กระทบตัวเล็กเลย
      เพราะคนละ worker คนละหน่วยความจำจริงๆ (ดู getAiSumWorkerAsync()/getChatWorkerAsync() ฝั่งเรียกใช้) */
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

function loadSpecific(modelId, device, onProgress) {
  return import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
    configureOnnxWasmPaths(mod.env);
    var opts = { dtype: 'q4', progress_callback: onProgress };
    if (device) opts.device = device;
    return mod.pipeline('text-generation', modelId, opts).then(function (generator) {
      activeInfo = { modelId: modelId, device: device || 'wasm' };
      return { mod: mod, generator: generator };
    });
  });
}

/* เส้นทางเดิม ใช้เมื่อมีใครส่ง 'chat' มาตรงๆ โดยไม่เคย 'probe' มาก่อน (เช่น languages.jsx ที่ยังไม่ได้
   ย้ายมาใช้ pattern แข่ง 2 worker ด้านบน) — ปลอดภัยเหมือนเดิมทุกประการ (ลองแค่ตัวเล็ก ไม่แตะตัวใหญ่เลย
   ในเมื่อยังไม่มี isolation ให้ฝั่งเรียกใช้จัดการ) */
function loadPipelineAuto(onProgress, jobId) {
  if (!pipelinePromise) {
    pipelinePromise = loadSpecific(MODEL_ID_SMALL, undefined, onProgress);
    pipelinePromise.then(function () {
      self.postMessage({ type: 'pipeline-ready', jobId: jobId, modelId: activeInfo.modelId, device: activeInfo.device });
    }, function () {
      /* พัง — เคลียร์ cache ทิ้ง ไม่งั้น pipelinePromise จะค้างเป็น promise ที่ reject แล้วตลอดไปทั้งเซสชัน
         ครั้งถัดไปจะลองโหลดใหม่ตั้งแต่ต้นให้เอง (worker นี้เองก็ถูก terminate() จากฝั่งเรียกใช้ตอน error
         อยู่แล้วในทุกหน้าที่แก้ไปแล้ว แต่กันไว้เผื่อผู้เรียกที่ไม่ทำแบบนั้น) */
      pipelinePromise = null;
    });
  }
  return pipelinePromise;
}

var isBusy = false;

self.onmessage = function (e) {
  var msg = e.data;
  if (!msg) return;

  if (msg.type === 'probe') {
    /* worker instance นี้จะลองโหลด "แค่โมเดลเดียว" ตามที่สั่งเท่านั้น ไม่ auto-fallback ข้ามโมเดลเอง —
       fallback ทำที่ฝั่งเรียกใช้ด้วยการสร้าง worker คนละตัวแข่งกัน (ดูคอมเมนต์หัวไฟล์) ให้แน่ใจว่าพังแล้ว
       ไม่ลาก WASM memory ของ worker อื่นพังตาม เพราะแต่ละ worker มี JS realm/WASM memory แยกกันจริง */
    var modelId = msg.modelId === 'big' ? MODEL_ID_BIG : MODEL_ID_SMALL;
    var device = msg.modelId === 'big' ? 'webgpu' : undefined;
    pipelinePromise = loadSpecific(modelId, device, function (p) {
      if (p && p.status === 'progress' && p.file) {
        self.postMessage({ type: 'model-progress', jobId: msg.jobId, file: p.file, progress: p.progress });
      }
    });
    pipelinePromise.then(function () {
      self.postMessage({ type: 'probe-result', jobId: msg.jobId, ok: true, modelId: activeInfo.modelId, device: activeInfo.device });
    }, function (err) {
      console.error('[ai-chat-worker] probe(' + msg.modelId + ') failed:', err);
      pipelinePromise = null;
      self.postMessage({ type: 'probe-result', jobId: msg.jobId, ok: false, message: err && err.message ? err.message : String(err) });
    });
    return;
  }

  if (msg.type !== 'chat') return;
  var jobId = msg.jobId, messages = msg.messages, maxNewTokens = msg.maxNewTokens || 256;

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

  /* ถ้าเคย 'probe' สำเร็จมาก่อนในเซสชันเดียวกัน (worker นี้คือตัวที่ชนะการแข่งจากฝั่งเรียกใช้) จะเจอ
     pipelinePromise ตั้งไว้แล้ว loadPipelineAuto() ก็แค่คืนของเดิมกลับไปใช้ต่อ ไม่ต้องโหลดซ้ำ — ถ้ายังไม่
     เคย probe เลย (ผู้เรียกแบบเก่าที่ส่ง 'chat' ตรงๆ) จะ fallback ไปโหลดตัวเล็กแบบปลอดภัยตามปกติ */
  loadPipelineAuto(onModelProgress, jobId).then(function (loaded) {
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
    /* ลดจาก 512 → 256 เป็นค่าเริ่มต้น: เจอจริงว่าโมเดล 0.5B รันบน WASM ช้ามากกว่าจะได้คำตอบครบ
       (โดยเฉพาะรอบที่ต่อจากถอดเสียงจากไมค์ ซึ่งมีขั้นตอน ASR ต่อคิวมาก่อนหน้าอีกที) ตัดเพดานให้สั้นลง
       ช่วยให้ตอบเร็วขึ้นชัดเจนและกันโมเดลพูดยืดยาวเกินจำเป็นสำหรับแชทถาม-ตอบทั่วไปด้วย — ผู้เรียกสามารถ
       ส่ง msg.maxNewTokens มาขอเพดานที่สูงกว่านี้ได้ (เช่น หน้า languages.html โหมด "ฝึกเขียน" ที่ต้องการ
       คำตอบตรวจไวยากรณ์/แปลภาษายาวกว่าแชทตอบสั้นๆ ทั่วไป) ai-chat-widget.js เดิมไม่ส่งฟิลด์นี้มา จึงยังได้
       256 เท่าเดิมเป๊ะๆ ไม่กระทบพฤติกรรมเดิม */
    return generator(messages, { max_new_tokens: maxNewTokens, temperature: 0.7, streamer: streamer });
  }).then(function () {
    self.postMessage({ type: 'done', jobId: jobId });
  }).catch(function (err) {
    console.error('[ai-chat-worker] chat/model load failed:', err);
    self.postMessage({ type: 'error', jobId: jobId, message: err && err.message ? err.message : String(err) });
  }).then(function () {
    isBusy = false;
  });
};
