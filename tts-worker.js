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
   แล้วให้ผลเร็วกว่าและคาดเดาได้มากกว่า

   2026-10 (Section 5): ลอง WebGPU อีกครั้งแบบมีทางถอย — หน้า text-to-speech ส่ง msg.device:'webgpu' มาเฉพาะคอมที่ TanotMedia.webgpuPlan() ได้ adapter จริง (ไม่ใช่ซอฟต์แวร์) และผู้ใช้ไม่ปิด
   • WebGPU ใช้ dtype จาก TanotMediaModels.ttsGpuDtype (fp32 — ตัว q8 ของโมเดลนี้เป็นสาเหตุที่รอบก่อนช้า: op แบบ quantized ยังไม่มี kernel ดีบน WebGPU)
   • โหลด/รันล้ม หรือเสียงออกมาผิดปกติ (มี NaN/Infinity หรือเงียบทั้งท่อน) → ทิ้ง pipeline WebGPU แล้วทำท่อนเดิมซ้ำบน WASM "1 ครั้ง" (จำไว้ใน Worker นี้ว่าล้มแล้ว ไม่ลองซ้ำ)
     ส่ง { type:'fallback', what:'device', from:'webgpu', to:'wasm', stage:'load'|'run'|'output', modelId, name, message } ให้หน้าบันทึกลง problem log (ไม่มีเนื้อหาผู้ใช้)
   • ไม่ส่ง device = WASM เหมือนเดิมทุกอย่าง (วิดเจ็ตแชทไม่เปลี่ยน) */
'use strict';

var pipelinePromiseByModel = {}; // key = modelId + '|' + device
var gpuFailed = false;          // WebGPU ล้มแล้วใน Worker นี้ → ท่อนที่เหลือใช้ WASM เลย

/* dtype ต่อโมเดล (เช่น "หญิง (โทนพอดแคสต์)" ต้อง fp32 เพราะไม่มีไฟล์ quantized) อ่านจาก media-models.js — ตารางกลางที่
   text-to-speech.js ใช้ด้วย (2026-10: เดิมมีตารางซ้ำ 2 ชุดในไฟล์นี้กับ text-to-speech.js แล้วเคยลืมแก้คู่กันจน Worker
   บังคับ fp32 เกินจำเป็น → แรมพุ่ง แท็บแครช — ดูประวัติเต็มในหัวไฟล์ media-models.js) */
var modelsPromise = null;
function ttsPipelineOpts(modelId, device, onProgress) {
  if (!modelsPromise) modelsPromise = import('./media-models.js').then(function () { return self.TanotMediaModels; });
  return modelsPromise.then(function (M) {
    var opts = { progress_callback: onProgress };
    var dtype = M && (device === 'webgpu' ? M.ttsGpuDtype(modelId) : M.ttsDtype(modelId));
    if (dtype) opts.dtype = dtype;
    if (device === 'webgpu') opts.device = 'webgpu';
    return opts;
  });
}

/* ⚠️ ไฟล์ ort-wasm-simd-threaded*.mjs/.wasm, ort.webgpu.bundle.min.mjs, onnxruntime-common/* ใน
   vendor/transformers/ ถูก pin ไว้ที่ onnxruntime-web@1.24.3 โดยตั้งใจ (ห้ามอัปเดตเป็นเวอร์ชันใหม่กว่า
   1.24.x เฉยๆ) — เวอร์ชัน 1.25+ มีบั๊กที่ยืนยันแล้วจากทั้ง microsoft/onnxruntime#28306 และ
   huggingface/transformers.js#1707: ตัวปรับแต่งกราฟ (TransposeDQWeightsForMatMulNBits) พังตอนสร้าง
   session กับโมเดล quantized ที่ไม่มี scale tensor ตามฟอร์แมตใหม่ (เจอจริงกับ Whisper ที่ใช้ในหน้านี้
   ผ่าน error "Can't create a session... Missing required scale") ถ้าจะอัปเดตเวอร์ชันในอนาคต ต้องรอ
   ยืนยันว่า issue นี้ถูกแก้แล้วในเวอร์ชันที่จะอัปเดตไปก่อนเสมอ */
/* ⚠️ 2026-09-28: ort-wasm-simd-threaded.asyncify.wasm หนัก 25.93 MiB เกินลิมิตไฟล์เดียว 25 MiB ของ
   Cloudflare Pages (ทำ build ล้มตั้งแต่ ~11 ก.ย.) จึงย้ายเฉพาะไฟล์ .wasm ตัวนี้ไปโหลดจาก jsDelivr
   (pin @1.24.3 เดียวกับที่เหลือ ห้ามใช้ "latest") แทนการฝังในเครื่อง — ไฟล์ .mjs (ตัว glue script)
   ยังฝังในเครื่องเหมือนเดิม เพราะเป็นไฟล์เล็ก (<50KB ไม่ติดลิมิต) และ import() ของมันเป็น relative
   path อยู่แล้ว ไม่เจอบั๊ก bare-specifier แบบที่เคยเจอตอนโหลด transformers.js จาก CDN ตรงๆ ใน Worker
   ไฟล์ .wasm แบบ non-asyncify (threaded, เฉพาะ Safari) ขนาด ~12 MiB ไม่เกินลิมิต ยังฝังในเครื่องต่อไป */
var ONNX_ASYNCIFY_WASM_CDN_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.asyncify.wasm';
function configureOnnxWasmPaths(env) {
  var isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(self.navigator.userAgent);
  env.backends.onnx.wasm.wasmPaths = isSafari
    ? { mjs: './vendor/transformers/ort-wasm-simd-threaded.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.wasm' }
    : { mjs: './vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs', wasm: ONNX_ASYNCIFY_WASM_CDN_URL };
  env.backends.onnx.wasm.numThreads = 1; // ไม่มี SharedArrayBuffer อยู่แล้ว บังคับ single-thread กันค้าง (คนละเรื่องกับที่ทำให้หน้าเว็บค้าง — นั่นแก้ด้วยการย้ายมา Worker นี้)
}

/* jobId ส่งมาแค่เพื่อแปะกำกับสัญญาณ 'pipeline-ready' ที่ยิงกลับไปครั้งเดียวตอนโหลด pipeline
   เสร็จครั้งแรกของ worker ตัวนี้ (ดูเหตุผลที่ text-to-speech.js ใช้สัญญาณนี้ทำอะไร) — ไม่ได้ใช้
   แยกแคช pipeline ตาม jobId แต่อย่างใด (ยังแคชตาม modelId เดิม ใช้ข้ามหลายงานได้เหมือนเดิม) */
function loadPipeline(modelId, device, onProgress, jobId) {
  var key = modelId + '|' + device;
  if (!pipelinePromiseByModel[key]) {
    pipelinePromiseByModel[key] = Promise.all([import('./vendor/transformers/transformers.web.min.js'), ttsPipelineOpts(modelId, device, onProgress)]).then(function (r) {
      configureOnnxWasmPaths(r[0].env);
      return r[0].pipeline('text-to-speech', modelId, r[1]);
    });
    pipelinePromiseByModel[key].then(function () {
      self.postMessage({ type: 'pipeline-ready', jobId: jobId, modelId: modelId, device: device });
    }, function () { delete pipelinePromiseByModel[key]; /* โหลดพัง — error จริงโผล่ตอนเรียก synth ท่อนแรก · ล้างแคชให้ลองใหม่ได้ */ });
  }
  return pipelinePromiseByModel[key];
}

/* เสียงจาก WebGPU ผิดปกติไหม: มี NaN/Infinity หรือเงียบสนิททั้งท่อน (ข้อความจริงไม่มีทางเงียบทั้งท่อน) */
function audioProblem(audio) {
  var peak = 0;
  for (var i = 0; i < audio.length; i++) {
    var v = audio[i];
    if (v !== v || v === Infinity || v === -Infinity) return 'NaN/Infinity ในเสียง';
    var a = v < 0 ? -v : v;
    if (a > peak) peak = a;
  }
  return peak < 1e-4 ? 'เสียงเงียบทั้งท่อน' : null;
}
function disposeGpuPipelines() {
  Object.keys(pipelinePromiseByModel).forEach(function (k) {
    if (!/\|webgpu$/.test(k)) return;
    var old = pipelinePromiseByModel[k]; delete pipelinePromiseByModel[k];
    old.then(function (p) { if (p && p.dispose) return p.dispose(); }).catch(function () {});
  });
}

/* ทางถอยโมเดล (ไล่ทีละขั้น ขั้นละ 1 ครั้ง): stable2 → stable → ต้นฉบับ (media-models.js ttsLegacy = "ขั้นถัดไป" ของ id นั้น)
   โหลดไม่ได้ (404/เครือข่ายที่ลองซ้ำแล้วยังล้ม — ไม่ใช่เรื่องหน่วยความจำ) บน WASM → ใช้ขั้นถัดไปแทน จำไว้ใน modelRedirect (ต่อ Worker) + แจ้งหน้าลง problem log ทุกขั้น
   modelRedirect[ที่ขอ] = id ที่ใช้อยู่จริง · เครือข่ายสะดุดตอนโหลด → รอ NET_RETRY_MS แล้วลองโหลด id เดิมซ้ำ 1 ครั้ง (ส่ง {type:'retry'} ให้หน้าบันทึก) ก่อนเข้าทางถอย */
var modelRedirect = {};
var MEM_RE = /out of memory|bad_alloc|Aborted\(|memory access out of bounds|cannot allocate|failed to grow|could not allocate|WebAssembly\.Memory|Array buffer allocation failed|Invalid typed array length/i;
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function loadPipelineRetry(modelId, device, onProgress, jobId) {
  return loadPipeline(modelId, device, onProgress, jobId).catch(function (err) {
    return (modelsPromise || Promise.resolve(null)).then(function (M) {
      if (!M || !M.isNetworkError || !M.isNetworkError(err)) throw err;
      return wait(M.NET_RETRY_MS || 1500).then(function () {
        self.postMessage({ type: 'retry', jobId: jobId, what: 'load', modelId: modelId, device: device, name: (err && err.name) || 'Error', message: String(err && err.message ? err.message : err).slice(0, 240) });
        return loadPipeline(modelId, device, onProgress, jobId);
      }).catch(function (err2) { if (err2 && typeof err2 === 'object') err2.ttsRetried = true; throw err2; });
    });
  });
}
function synthesizeOnDevice(text, modelId, device, onProgress, jobId) {
  var eff = modelRedirect[modelId] || modelId;
  return synthesizeRaw(text, eff, device, onProgress, jobId).catch(function (err) {
    return (modelsPromise || Promise.resolve(null)).then(function (M) {
      var next = M && M.ttsLegacy ? M.ttsLegacy(eff) : null;
      if (!next || device !== 'wasm' || (err && err.ttsStage) !== 'load' || MEM_RE.test(String(err && err.message ? err.message : err))) throw err;
      modelRedirect[modelId] = next;
      delete pipelinePromiseByModel[eff + '|' + device];
      self.postMessage({ type: 'fallback', jobId: jobId, what: 'model', from: eff, to: next, stage: 'load', device: device, modelId: modelId, retried: !!(err && err.ttsRetried),
        name: (err && err.name) || 'Error', message: String(err && err.message ? err.message : err).slice(0, 240) });
      return synthesizeOnDevice(text, modelId, device, onProgress, jobId); // ขั้นถัดไป (ล้มอีก = ถอยต่อจนหมดห่วงโซ่)
    });
  });
}
function synthesizeRaw(text, modelId, device, onProgress, jobId) {
  return loadPipelineRetry(modelId, device, onProgress, jobId).then(function (synth) {
    return synth(text).then(function (output) {
      if (device === 'webgpu' && output && output.audio) {
        var bad = audioProblem(output.audio);
        if (bad) { var e = new Error(bad); e.name = 'GpuOutputError'; e.ttsStage = 'output'; throw e; }
      }
      return output;
    }, function (err) { if (err && !err.ttsStage) err.ttsStage = 'run'; throw err; });
  }, function (err) { if (err && !err.ttsStage) err.ttsStage = 'load'; throw err; });
}
/* ทำ 1 ท่อน: WebGPU (ถ้าขอและยังไม่เคยล้ม) → ล้มแล้วถอย WASM ท่อนเดิมทันที 1 ครั้ง */
function synthesizeOneItem(text, modelId, wantGpu, onProgress, jobId) {
  if (!wantGpu || gpuFailed) return synthesizeOnDevice(text, modelId, 'wasm', onProgress, jobId);
  return synthesizeOnDevice(text, modelId, 'webgpu', onProgress, jobId).catch(function (err) {
    gpuFailed = true; disposeGpuPipelines();
    self.postMessage({ type: 'fallback', jobId: jobId, what: 'device', from: 'webgpu', to: 'wasm', stage: (err && err.ttsStage) || 'run', modelId: modelId,
      name: (err && err.name) || 'Error', message: String(err && err.message ? err.message : err).slice(0, 240) });
    return synthesizeOnDevice(text, modelId, 'wasm', onProgress, jobId);
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
  var items = msg.items, modelId = msg.modelId, jobId = msg.jobId, wantGpu = msg.device === 'webgpu';

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
      return synthesizeOneItem(item.text, modelId, wantGpu, onModelProgress, jobId);
    }).then(function (output) {
      if (!output || !output.audio || !output.audio.length) throw new Error('ไม่ได้ข้อมูลเสียงกลับมา');
      self.postMessage(
        { type: 'item-done', jobId: jobId, i: item.i, audio: output.audio, samplingRate: output.sampling_rate },
        [output.audio.buffer]
      );
    }).catch(function (err) {
      self.postMessage({ type: 'item-error', jobId: jobId, i: item.i, name: (err && err.name) || 'Error', message: err && err.message ? err.message : String(err) });
      throw err; // หยุดท่อนที่เหลือใน worker ตัวนี้ (งานทั้งก้อนถือว่าล้มเหลวอยู่แล้วฝั่งหน้าเว็บหลัก)
    });
  }, Promise.resolve()).catch(function () { /* error ถูกรายงานผ่าน postMessage ไปแล้ว ไม่ต้องทำอะไรเพิ่ม */ }).then(function () {
    /* แจ้งฝั่งหน้าเว็บหลักเสมอไม่ว่าจะสำเร็จ/ล้มเหลว ว่า worker ตัวนี้ว่างแล้ว — ใช้เคลียร์สถานะ busy
       ที่ track ไว้ฝั่งหน้าเว็บหลัก (แยกจาก jobId เพราะ worker ตัวนี้รับได้ทีละ batch เท่านั้นเสมอ) */
    isBusy = false;
    self.postMessage({ type: 'batch-done', jobId: jobId });
  });
};
