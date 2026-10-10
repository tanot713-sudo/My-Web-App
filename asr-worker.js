/* ══════════════════════════════════════════════════════════════════
   Web Worker แยกต่างหากสำหรับถอดเสียงพูดเป็นข้อความ (Whisper ผ่าน transformers.js)
   ใช้โดย media-core.js (TanotMedia.transcribeLocal — หน้า text-to-speech + โหมด "เปิดไมค์คุย" ของวิดเจ็ตแชท) และ
   languages.jsx (ส่งข้อความรูปแบบเดิม { type:'transcribe', jobId, pcm, lang } — ยังใช้ได้เหมือนเดิม)
   รับ PCM 16kHz mono ที่ถอดรหัสมาแล้วจากฝั่งหน้าเว็บหลัก (decodeAudioData/OfflineAudioContext ใช้ใน Worker ไม่ได้ใน
   หลายเบราว์เซอร์) ทีละช่วง (≤ 5 นาที, transfer ArrayBuffer) แล้วส่งผลข้อความกลับ
   2026-10: เดิมหน้า text-to-speech รัน Whisper บนเธรดหลัก (loadAsrPipeline ในหน้า) — WASM เธรดเดียวรันแบบ
   synchronous บล็อกหน้าทั้งหน้าระหว่างถอด แล้วค้าง/แครชหลังโหลดโมเดลเสร็จ ย้ายมาใช้ Worker นี้ร่วมกันแล้ว

   2026-10 (Section 3): รับ msg.device ('webgpu'|'wasm'; ไม่ส่ง = 'wasm' เหมือนเดิม — วิดเจ็ตแชท/languages.jsx ไม่เปลี่ยน) และ msg.timestamps (ขอเวลาของแต่ละช่วงคำพูด)
   • WebGPU ใช้ได้เฉพาะโมเดลตระกูล onnx-community (media-models.js) · โหลด/รันบน WebGPU ล้ม → ถอยกลับ WASM อัตโนมัติ "1 ครั้ง" (จำไว้ใน Worker นี้ว่าล้มแล้ว
     ไม่ลองซ้ำ) แล้วส่ง { type:'fallback', what:'device', from:'webgpu', to:'wasm', stage:'load'|'run', message } ให้ฝั่งหน้าเว็บบันทึกลง problem log (ไม่มีเนื้อหาผู้ใช้)
   • โหลดโมเดล onnx-community ไม่ได้บน WASM (เช่น 404 ไม่มีไฟล์ dtype) และไม่ใช่เรื่องหน่วยความจำ → ถอยไป Xenova/whisper-* ตัวเทียบเท่า (what:'model')
   ══════════════════════════════════════════════════════════════════ */
'use strict';

var pipelinePromise = null;

/* ⚠️ pin เวอร์ชัน onnxruntime-web เดียวกับ tts-worker.js/ai-chat-worker.js (1.24.3) — ห้ามอัปเดตแยก
   จากกันโดยไม่เช็ค microsoft/onnxruntime#28306 / huggingface/transformers.js#1707 ก่อนเสมอ
   ⚠️ .wasm ตัว asyncify โหลดจาก jsDelivr แทนการฝังในเครื่อง (เกินลิมิต 25 MiB ของ Cloudflare Pages) —
   ดูเหตุผลเต็มที่คอมเมนต์เหนือ configureOnnxWasmPaths ใน tts-worker.js */
var ONNX_ASYNCIFY_WASM_CDN_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.asyncify.wasm';
function configureOnnxWasmPaths(env) {
  var isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(self.navigator.userAgent);
  env.backends.onnx.wasm.wasmPaths = isSafari
    ? { mjs: './vendor/transformers/ort-wasm-simd-threaded.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.wasm' }
    : { mjs: './vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs', wasm: ONNX_ASYNCIFY_WASM_CDN_URL };
  env.backends.onnx.wasm.numThreads = 1;
}

/* ค่าเริ่มต้น whisper-tiny (โหมดไมค์ของวิดเจ็ตแชท/หน้าภาษา ส่งมาไม่ระบุโมเดล — คำถามสั้นๆ ต่อเนื่อง ต้องการความเร็ว
   และไม่อยากให้โหลดโมเดลใหญ่ซ้อนกับโมเดลแชท) · หน้า text-to-speech ส่ง msg.modelId มาเอง (tiny/base/small/medium —
   media-core.js ซ่อน small/medium บนมือถือ) — Worker ตัวหนึ่งถือได้ทีละโมเดล เปลี่ยนโมเดลแล้วฝั่งหน้าเว็บ terminate
   Worker นี้ทิ้งแล้วสร้างใหม่ (หน่วยความจำ WASM หดไม่ได้) จึงแคช pipeline ไว้ตัวเดียวพอ */
var DEFAULT_MODEL_ID = 'Xenova/whisper-tiny';
var loadedKey = null;
var gpuFailed = false;   // WebGPU ล้มแล้วใน Worker นี้ → ครั้งต่อไปไม่ลองอีก
var modelsPromise = null;
function getModels() {
  if (!modelsPromise) modelsPromise = import('./media-models.js').then(function () { return self.TanotMediaModels; }, function () { return null; });
  return modelsPromise;
}

function disposePipeline() {
  var old = pipelinePromise;
  pipelinePromise = null; loadedKey = null;
  if (old) old.then(function (p) { if (p && p.dispose) return p.dispose(); }).catch(function () {});
}

/* plan = { modelId, device:'webgpu'|'wasm', dtype? } — pipeline ตัวเดียวต่อ Worker (เปลี่ยนโมเดล/อุปกรณ์ = ทิ้งตัวเก่า) */
function loadPipeline(plan, onProgress, jobId) {
  var key = plan.modelId + '|' + plan.device;
  if (pipelinePromise && loadedKey !== key) disposePipeline();
  if (!pipelinePromise) {
    loadedKey = key;
    pipelinePromise = import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
      configureOnnxWasmPaths(mod.env);
      var o = { progress_callback: onProgress };
      if (plan.device === 'webgpu') o.device = 'webgpu';
      if (plan.dtype) o.dtype = plan.dtype;
      return mod.pipeline('automatic-speech-recognition', plan.modelId, o);
    });
    var mine = pipelinePromise;
    mine.then(function () {
      self.postMessage({ type: 'pipeline-ready', jobId: jobId, modelId: plan.modelId, device: plan.device });
    }, function () { if (pipelinePromise === mine) { pipelinePromise = null; loadedKey = null; } /* โหลดพัง — ครั้งหน้าลองใหม่ (error จริงรายงานผ่าน transcribe) */ });
  }
  return pipelinePromise;
}

/* หน่วยความจำไม่พอ — ฝั่งหน้าเว็บใช้ธงนี้ตัดสินใจทิ้ง Worker ทั้งตัว + แนะนำโหมดคลาวด์ */
var MEM_RE = /out of memory|bad_alloc|Aborted\(|memory access out of bounds|cannot allocate|failed to grow|could not allocate|WebAssembly\.Memory|Array buffer allocation failed|Invalid typed array length/i;
function errPayload(jobId, err) {
  var name = (err && err.name) || 'Error', message = err && err.message ? err.message : String(err);
  return { type: 'error', jobId: jobId, name: name, message: message, oom: MEM_RE.test(message) || (name === 'RangeError' && /memory|alloc|buffer|array length/i.test(message)) };
}

var isBusy = false, currentJob = null;

/* error ที่ไม่มีใคร catch ใน Worker (เช่นจาก WASM รันไทม์) — แจ้งงานที่ค้างอยู่ให้จบด้วย error แทนที่จะเงียบหาย */
self.addEventListener('unhandledrejection', function (e) {
  if (currentJob == null) return;
  self.postMessage(errPayload(currentJob, e.reason));
  isBusy = false; currentJob = null;
});

function errMsg(e) { return e && e.message ? String(e.message).slice(0, 240) : String(e).slice(0, 240); }

self.onmessage = function (e) {
  var msg = e.data;
  if (!msg || msg.type !== 'transcribe') return;
  var jobId = msg.jobId, pcm = msg.pcm, lang = msg.lang, modelId = msg.modelId || DEFAULT_MODEL_ID;

  if (isBusy) {
    self.postMessage({ type: 'error', jobId: jobId, message: 'Worker กำลังยุ่งอยู่กับงานก่อนหน้า (ไม่ควรเกิดขึ้น)' });
    return;
  }
  isBusy = true; currentJob = jobId;

  function onModelProgress(p) {
    if (p && p.status === 'progress' && p.file) {
      self.postMessage({ type: 'model-progress', jobId: jobId, file: p.file, progress: p.progress });
    }
  }

  function transcribeWith(transcriber) {
    /* chunk_length_s/stride_length_s: Whisper รับเสียงทีละ ≤30 วินาที — ไม่ตัดจะ "หลอน" วนคำซ้ำทั้งไฟล์ ·
       no_repeat_ngram_size: กันแต่ละท่อนวนคำซ้ำ (โมเดลเล็ก/ภาษาไทย) — ห้ามเอาออก (ดูประวัติใน text-to-speech.js) ·
       return_timestamps: ขอเวลาของแต่ละช่วงคำพูด (แบ่งย่อหน้า/[hh:mm:ss]) เฉพาะเมื่อหน้าขอ */
    var opts = { task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, no_repeat_ngram_size: 3 };
    if (lang && lang !== 'auto') opts.language = lang;
    if (msg.timestamps) opts.return_timestamps = true;
    return transcriber(pcm, opts);
  }

  /* models = ตารางจาก media-models.js (null ถ้าโหลดไม่ได้ → ทำงานแบบเดิมทุกอย่าง) */
  function attempt(models, plan) {
    return loadPipeline(plan, onModelProgress, jobId).then(function (tr) {
      return transcribeWith(tr).then(function (r) { return { r: r, plan: plan }; }, function (err) { err.asrStage = 'run'; throw err; });
    }, function (err) { err.asrStage = 'load'; throw err; }).catch(function (err) {
      if (currentJob !== jobId) throw err;
      /* WebGPU ล้ม → WASM 1 ครั้ง (ตัวที่ใหญ่เกินรัน WASM ได้ไม่ถอย) */
      if (plan.device === 'webgpu' && !(models && models.asrGpuOnly(plan.modelId))) {
        gpuFailed = true; disposePipeline();
        self.postMessage({ type: 'fallback', jobId: jobId, what: 'device', from: 'webgpu', to: 'wasm', stage: err.asrStage || 'load', modelId: plan.modelId, name: (err && err.name) || 'Error', message: errMsg(err) });
        return attempt(models, wasmPlan(models, plan.modelId));
      }
      /* โมเดลตระกูลใหม่โหลดไม่ได้ (ไม่ใช่เรื่องหน่วยความจำ) → ตัวเทียบเท่าเดิม */
      var legacy = models && models.asrLegacy(plan.modelId);
      if (legacy && err.asrStage === 'load' && !MEM_RE.test(errMsg(err)) && plan.device === 'wasm') {
        disposePipeline();
        self.postMessage({ type: 'fallback', jobId: jobId, what: 'model', from: plan.modelId, to: legacy, stage: 'load', modelId: plan.modelId, name: (err && err.name) || 'Error', message: errMsg(err) });
        return attempt(models, { modelId: legacy, device: 'wasm', dtype: null });
      }
      throw err;
    });
  }
  function wasmPlan(models, id) { return { modelId: id, device: 'wasm', dtype: models ? models.asrDtype(id, 'wasm') : null }; }

  getModels().then(function (models) {
    var want = msg.device === 'webgpu' && !gpuFailed && models && models.asrWebgpuCapable(modelId);
    var plan = want ? { modelId: modelId, device: 'webgpu', dtype: models.asrDtype(modelId, 'webgpu') } : wasmPlan(models, modelId);
    return attempt(models, plan);
  }).then(function (out) {
    if (currentJob !== jobId) return;
    var result = out.r, chunks;
    if (result && Array.isArray(result.chunks)) {
      chunks = result.chunks.map(function (c) {
        var t = c.timestamp || [];
        return { start: +t[0] || 0, end: t[1] != null ? +t[1] : null, text: c.text || '' };
      });
    }
    var res = { type: 'result', jobId: jobId, text: (result && result.text) || '', device: out.plan.device, modelId: out.plan.modelId };
    if (chunks) res.chunks = chunks;
    self.postMessage(res);
  }).catch(function (err) {
    if (currentJob !== jobId) return;
    self.postMessage(errPayload(jobId, err));
  }).then(function () {
    if (currentJob === jobId) { isBusy = false; currentJob = null; }
  });
};
