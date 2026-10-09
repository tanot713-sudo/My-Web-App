/* ══════════════════════════════════════════════════════════════════
   Web Worker แยกต่างหากสำหรับถอดเสียงพูดเป็นข้อความ (Whisper ผ่าน transformers.js)
   ใช้โดย media-core.js (TanotMedia.transcribeLocal — หน้า text-to-speech + โหมด "เปิดไมค์คุย" ของวิดเจ็ตแชท) และ
   languages.jsx (ส่งข้อความรูปแบบเดิม { type:'transcribe', jobId, pcm, lang } — ยังใช้ได้เหมือนเดิม)
   รับ PCM 16kHz mono ที่ถอดรหัสมาแล้วจากฝั่งหน้าเว็บหลัก (decodeAudioData/OfflineAudioContext ใช้ใน Worker ไม่ได้ใน
   หลายเบราว์เซอร์) ทีละช่วง (≤ 5 นาที, transfer ArrayBuffer) แล้วส่งผลข้อความกลับ
   2026-10: เดิมหน้า text-to-speech รัน Whisper บนเธรดหลัก (loadAsrPipeline ในหน้า) — WASM เธรดเดียวรันแบบ
   synchronous บล็อกหน้าทั้งหน้าระหว่างถอด แล้วค้าง/แครชหลังโหลดโมเดลเสร็จ ย้ายมาใช้ Worker นี้ร่วมกันแล้ว
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
var loadedModelId = null;

function loadPipeline(modelId, onProgress, jobId) {
  if (pipelinePromise && loadedModelId !== modelId) {
    var old = pipelinePromise;
    pipelinePromise = null;
    old.then(function (p) { if (p && p.dispose) return p.dispose(); }).catch(function () {});
  }
  if (!pipelinePromise) {
    loadedModelId = modelId;
    pipelinePromise = import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
      configureOnnxWasmPaths(mod.env);
      return mod.pipeline('automatic-speech-recognition', modelId, { progress_callback: onProgress });
    });
    pipelinePromise.then(function () {
      self.postMessage({ type: 'pipeline-ready', jobId: jobId, modelId: modelId });
    }, function () { pipelinePromise = null; loadedModelId = null; /* โหลดพัง — ครั้งหน้าลองใหม่ (error จริงรายงานผ่าน transcribe) */ });
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

  loadPipeline(modelId, onModelProgress, jobId).then(function (transcriber) {
    /* chunk_length_s/stride_length_s: Whisper รับเสียงทีละ ≤30 วินาที — ไม่ตัดจะ "หลอน" วนคำซ้ำทั้งไฟล์ ·
       no_repeat_ngram_size: กันแต่ละท่อนวนคำซ้ำ (โมเดลเล็ก/ภาษาไทย) — ห้ามเอาออก (ดูประวัติใน text-to-speech.js) */
    var opts = { task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, no_repeat_ngram_size: 3 };
    if (lang && lang !== 'auto') opts.language = lang;
    return transcriber(pcm, opts);
  }).then(function (result) {
    if (currentJob !== jobId) return;
    self.postMessage({ type: 'result', jobId: jobId, text: (result && result.text) || '' });
  }).catch(function (err) {
    if (currentJob !== jobId) return;
    self.postMessage(errPayload(jobId, err));
  }).then(function () {
    if (currentJob === jobId) { isBusy = false; currentJob = null; }
  });
};
