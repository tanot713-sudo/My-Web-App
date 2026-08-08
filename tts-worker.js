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

   หมายเหตุ: เคยลอง device:'webgpu' ก่อน WASM มาแล้วรอบหนึ่ง (คาดว่าจะเร็วกว่า) แต่ทดสอบจริงบน
   เครื่องผู้ใช้ (Windows, requestAdapter() สำเร็จจริง ไม่ error เลย) กลับช้ากว่าที่คาดมาก (ช้ากว่า
   WASM ล้วนๆ ที่รันขนานหลาย Worker ควรจะเป็น) น่าจะเพราะ backend WebGPU ของ onnxruntime-web ยังไม่มี
   kernel ที่ optimize ดีสำหรับ op แบบ quantized int8 (โมเดลนี้ต้องบีบอัด int8 เพื่อความเร็ว ขนาดไฟล์
   จึงจำเป็นต้องใช้ q8 เสมอ) เลยตัดออก ใช้ WASM ล้วนๆ พึ่ง worker pool ขนานอย่างเดียวแทน ซึ่งวัดผลจริง
   แล้วให้ผลเร็วกว่าและคาดเดาได้มากกว่า */
'use strict';

var pipelinePromiseByModel = {};

/* transformers.js เลือกไฟล์ ONNX ให้เองอัตโนมัติตาม dtype เริ่มต้นของแต่ละ backend (บน wasm คือ 'q8'
   → ไปหา onnx/model_quantized.onnx) โมเดลเสียงไทยของเราเอง (Tanotfin/mms-tts-2081-onnx) มีไฟล์นี้จริง
   จึงปล่อยดีฟอลต์ได้ปกติ — แต่โมเดล "หญิง (โทนพอดแคสต์)" (phlebotomy1996/mms-thai-female-podcast-spk0)
   ไม่มีไฟล์ quantized เลย (เช็คจริงในโฟลเดอร์ onnx/ มีแค่ model.onnx กับ model_fp16.onnx) ปล่อยดีฟอลต์
   จะ 404 ตอนโหลด ต้องบังคับ dtype ต่อโมเดลเป็นรายตัว — เลือก 'fp32' (ไม่ใช่ 'fp16') เพราะ fp32 รองรับ
   บน wasm backend ครบทุกเบราว์เซอร์แน่นอนกว่า fp16 ที่บาง engine/เบราว์เซอร์รุ่นเก่ายังไม่รองรับเต็มที่ */
var TTS_DTYPE_OVERRIDES = {
  'phlebotomy1996/mms-thai-female-podcast-spk0': 'fp32',
  /* แปลงเองผ่าน Colab (scripts/convert.py --quantize) — แต่ VITS เป็นโมเดล generative แบบสุ่ม
     (stochastic duration predictor) ความยาว output แต่ละรอบไม่เท่ากันเป๊ะ ทำให้ขั้นตอน validate
     output ของ optimum ตีว่า shape ไม่ตรง (ShapeError) แล้วสคริปต์ออกก่อนถึงขั้นตอน quantize จริง
     — ผลคือ repo มีแค่ model.onnx (fp32) ไม่มี model_quantized.onnx เหมือนโมเดลข้างบน */
  'Tanotfin/mms-tts-2081-FM-onnx': 'fp32',
  'Tanotfin/mms-tts-2081-M-onnx': 'fp32'
};
function ttsPipelineOpts(modelId, onProgress) {
  var opts = { progress_callback: onProgress };
  if (TTS_DTYPE_OVERRIDES[modelId]) opts.dtype = TTS_DTYPE_OVERRIDES[modelId];
  return opts;
}

/* ⚠️ ไฟล์ ort-wasm-simd-threaded*.mjs/.wasm, ort.webgpu.bundle.min.mjs, onnxruntime-common/* ใน
   vendor/transformers/ ถูก pin ไว้ที่ onnxruntime-web@1.24.3 โดยตั้งใจ (ห้ามอัปเดตเป็นเวอร์ชันใหม่กว่า
   1.24.x เฉยๆ) — เวอร์ชัน 1.25+ มีบั๊กที่ยืนยันแล้วจากทั้ง microsoft/onnxruntime#28306 และ
   huggingface/transformers.js#1707: ตัวปรับแต่งกราฟ (TransposeDQWeightsForMatMulNBits) พังตอนสร้าง
   session กับโมเดล quantized ที่ไม่มี scale tensor ตามฟอร์แมตใหม่ (เจอจริงกับ Whisper ที่ใช้ในหน้านี้
   ผ่าน error "Can't create a session... Missing required scale") ถ้าจะอัปเดตเวอร์ชันในอนาคต ต้องรอ
   ยืนยันว่า issue นี้ถูกแก้แล้วในเวอร์ชันที่จะอัปเดตไปก่อนเสมอ */
function configureOnnxWasmPaths(env) {
  var isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(self.navigator.userAgent);
  env.backends.onnx.wasm.wasmPaths = isSafari
    ? { mjs: './vendor/transformers/ort-wasm-simd-threaded.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.wasm' }
    : { mjs: './vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm' };
  env.backends.onnx.wasm.numThreads = 1; // ไม่มี SharedArrayBuffer อยู่แล้ว บังคับ single-thread กันค้าง (คนละเรื่องกับที่ทำให้หน้าเว็บค้าง — นั่นแก้ด้วยการย้ายมา Worker นี้)
}

/* jobId ส่งมาแค่เพื่อแปะกำกับสัญญาณ 'pipeline-ready' ที่ยิงกลับไปครั้งเดียวตอนโหลด pipeline
   เสร็จครั้งแรกของ worker ตัวนี้ (ดูเหตุผลที่ text-to-speech.js ใช้สัญญาณนี้ทำอะไร) — ไม่ได้ใช้
   แยกแคช pipeline ตาม jobId แต่อย่างใด (ยังแคชตาม modelId เดิม ใช้ข้ามหลายงานได้เหมือนเดิม) */
function loadPipeline(modelId, onProgress, jobId) {
  if (!pipelinePromiseByModel[modelId]) {
    pipelinePromiseByModel[modelId] = import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
      configureOnnxWasmPaths(mod.env);
      return mod.pipeline('text-to-speech', modelId, ttsPipelineOpts(modelId, onProgress));
    });
    pipelinePromiseByModel[modelId].then(function () {
      self.postMessage({ type: 'pipeline-ready', jobId: jobId, modelId: modelId });
    }, function () { /* โหลดพัง — ปล่อยให้ error จริงโผล่ตอนเรียก synth ท่อนแรกแทน ไม่ต้อง handle ซ้ำที่นี่ */ });
  }
  return pipelinePromiseByModel[modelId];
}

function synthesizeOneItem(text, modelId, onProgress, jobId) {
  return loadPipeline(modelId, onProgress, jobId).then(function (synth) {
    return synth(text);
  });
}

/* กัน batch ใหม่มาซ้อนทับ batch เก่าที่ยังทำงานไม่เสร็จใน worker ตัวเดียวกัน — ปกติฝั่งหน้าเว็บหลัก
   (text-to-speech.js) จะเช็ก busy ก่อนแล้วไม่ dispatch batch ใหม่มาซ้ำอยู่แล้ว (ถ้าพูลเดิมยังไม่ว่าง
   จะ terminate แล้วสร้างพูลใหม่แทน) แต่กันไว้อีกชั้นเผื่อ race condition ที่ไม่คาดคิด — ปฏิเสธ batch
   ที่ซ้อนเข้ามาทันทีแทนที่จะรัน items.reduce() 2 ชุดขนานกันในเครื่องมือ (pipeline) เดียวกัน */
var isBusy = false;

self.onmessage = function (e) {
  var msg = e.data;
  if (!msg || msg.type !== 'synthesize-batch') return;
  var items = msg.items, modelId = msg.modelId, jobId = msg.jobId;

  if (isBusy) {
    items.forEach(function (item) {
      self.postMessage({ type: 'item-error', jobId: jobId, i: item.i, message: 'Worker นี้กำลังยุ่งอยู่กับงานก่อนหน้า (ไม่ควรเกิดขึ้น)' });
    });
    return;
  }
  isBusy = true;

  function onModelProgress(p) {
    if (p && p.status === 'progress' && p.file) {
      self.postMessage({ type: 'model-progress', jobId: jobId, file: p.file, progress: p.progress });
    }
  }

  items.reduce(function (p, item) {
    return p.then(function () {
      self.postMessage({ type: 'item-start', jobId: jobId, i: item.i });
      return synthesizeOneItem(item.text, modelId, onModelProgress, jobId);
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
  }, Promise.resolve()).catch(function () { /* error ถูกรายงานผ่าน postMessage ไปแล้ว ไม่ต้องทำอะไรเพิ่ม */ }).then(function () {
    /* แจ้งฝั่งหน้าเว็บหลักเสมอไม่ว่าจะสำเร็จ/ล้มเหลว ว่า worker ตัวนี้ว่างแล้ว — ใช้เคลียร์สถานะ busy
       ที่ track ไว้ฝั่งหน้าเว็บหลัก (แยกจาก jobId เพราะ worker ตัวนี้รับได้ทีละ batch เท่านั้นเสมอ) */
    isBusy = false;
    self.postMessage({ type: 'batch-done', jobId: jobId });
  });
};
