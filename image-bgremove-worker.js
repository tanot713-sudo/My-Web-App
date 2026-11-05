/* ══════════════════════════════════════════════════════════════════
   image-bgremove-worker.js — "ลบพื้นหลัง" ของหน้าสร้างภาพ: pipeline 'background-removal' ของ transformers.js (vendor/ — ไม่โหลดไลบรารีจาก CDN)
   ใน Module Worker (แบบ asr-worker.js) · โมเดล/dtype/revision จากตาราง BG_MODEL ใน image-cutout-calc.js ที่เดียว
   แคชโมเดล = กลไกของ transformers.js ('transformers-cache' — sw.js ไม่แตะ ไม่อยู่ใน PRECACHE)

   ข้อความเข้า: { type:'run', id, blob, device:'webgpu'|'wasm', f16 }
   ข้อความออก: { type:'progress', id, loaded, total }            (ดาวน์โหลดไฟล์โมเดลครั้งแรก — รวมทุกไฟล์)
               { type:'retry', id, what:'load' }                 (เครือข่ายสะดุดตอนโหลด → รอแล้วลองแผนเดิมซ้ำ 1 ครั้ง)
               { type:'fallback', id, what:'device', stage:'load'|'run', name, message } (WebGPU ล้ม → WASM 1 ครั้งในอายุ Worker)
               { type:'result', id, w, h, data (RGBA, transfer), device }
               { type:'error', id, stage:'load'|'run', code:'missing'|'network'|'memory'|'session'|'other', name, message } — ไม่มีภาพ/ชื่อไฟล์ของผู้ใช้
   ══════════════════════════════════════════════════════════════════ */
'use strict';

var ONNX_ASYNCIFY_WASM_CDN_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.asyncify.wasm';
/* ตั้ง path ของ .wasm แบบเดียวกับ asr-worker.js / tts-worker.js (onnxruntime-web pin 1.24.3 — ห้ามอัปแยก) */
function configureOnnxWasmPaths(env) {
  var isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(self.navigator.userAgent);
  env.backends.onnx.wasm.wasmPaths = isSafari
    ? { mjs: './vendor/transformers/ort-wasm-simd-threaded.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.wasm' }
    : { mjs: './vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs', wasm: ONNX_ASYNCIFY_WASM_CDN_URL };
  env.backends.onnx.wasm.numThreads = 1;
}

var libsP = null;
function libs() {
  if (!libsP) {
    libsP = Promise.all([
      import('./vendor/transformers/transformers.web.min.js'),
      import('./media-models.js').then(function () { return self.TanotMediaModels || null; }, function () { return null; }),
      import('./image-cutout-calc.js').then(function () { return self.TanotCutout; })
    ]).then(function (r) {
      configureOnnxWasmPaths(r[0].env);
      if (r[1]) r[1].useHfProxy(r[0].env); // ทุกจุดที่ import transformers.js ต้องเรียก (โมเดลนี้ไม่ใช่ของ Tanotfin — ไม่เปลี่ยน URL)
      return { T: r[0], M: r[1], C: r[2] };
    }, function (e) { libsP = null; throw e; });
  }
  return libsP;
}

var pipe = null, pipeKey = null, gpuFailed = false, currentId = null;
var MEM_RE = /out of memory|bad_alloc|Aborted\(|memory access out of bounds|cannot allocate|failed to grow|could not allocate|WebAssembly\.Memory|Array buffer allocation failed|Invalid typed array length/i;

function codeOf(L, err) {
  var msg = String((err && err.message) || err);
  if (L && L.M && L.M.isSessionError && L.M.isSessionError(err)) return 'session';
  if (MEM_RE.test(msg)) return 'memory';
  if (L && L.M && L.M.isNotFoundError && L.M.isNotFoundError(err)) return 'missing';
  if (L && L.M && L.M.isNetworkError && L.M.isNetworkError(err)) return 'network';
  return 'other';
}
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function load(L, plan, id) {
  var key = plan.device + '|' + plan.dtype;
  if (pipe && pipeKey === key) return pipe;
  if (pipe) pipe.then(function (p) { if (p && p.dispose) p.dispose(); }).catch(function () {});
  var files = {};
  function onProgress(p) {
    if (!p || p.status !== 'progress' || !p.file) return;
    files[p.file] = { loaded: +p.loaded || 0, total: +p.total || 0 };
    var l = 0, t = 0;
    for (var f in files) { l += files[f].loaded; t += files[f].total; }
    var est = L.C.BG_MODEL.bytes[plan.dtype] || 0;
    self.postMessage({ type: 'progress', id: id, loaded: l, total: Math.max(t, est) });
  }
  var o = { progress_callback: onProgress, dtype: plan.dtype, revision: L.C.BG_MODEL.revision };
  if (plan.device === 'webgpu') o.device = 'webgpu';
  pipeKey = key;
  var mine = pipe = L.T.pipeline('background-removal', L.C.BG_MODEL.id, o);
  mine.catch(function () { if (pipe === mine) { pipe = null; pipeKey = null; } });
  return mine;
}

function attempt(L, plan, m) {
  return load(L, plan, m.id).then(function (p) {
    return L.T.RawImage.fromBlob(m.blob).then(function (image) {
      return p(image);
    }).then(null, function (err) { err.bgStage = 'run'; throw err; });
  }, function (err) { if (!err.bgStage) err.bgStage = 'load'; throw err; }).catch(function (err) {
    if (currentId !== m.id) throw err;
    var code = codeOf(L, err);
    if (code === 'session') throw err;
    if (err.bgStage === 'load' && code === 'network' && !plan.netRetried) {
      return wait((L.M && L.M.NET_RETRY_MS) || 1500).then(function () {
        if (currentId !== m.id) throw err;
        self.postMessage({ type: 'retry', id: m.id, what: 'load' });
        return attempt(L, { device: plan.device, dtype: plan.dtype, netRetried: true }, m);
      });
    }
    if (plan.device === 'webgpu' && code !== 'missing') {
      gpuFailed = true; pipe = null; pipeKey = null;
      self.postMessage({ type: 'fallback', id: m.id, what: 'device', stage: err.bgStage || 'load', name: (err && err.name) || 'Error', message: String((err && err.message) || err).slice(0, 200) });
      return attempt(L, { device: 'wasm', dtype: L.C.bgDtype('wasm') }, m);
    }
    throw err;
  });
}

self.onmessage = function (e) {
  var m = e.data || {};
  if (m.type !== 'run') return;
  currentId = m.id;
  var L0 = null;
  libs().then(function (L) {
    L0 = L;
    var device = m.device === 'webgpu' && !gpuFailed ? 'webgpu' : 'wasm';
    return attempt(L, { device: device, dtype: L.C.bgDtype(device, !!m.f16) }, m).then(function (out) {
      return { out: out, device: pipeKey ? pipeKey.split('|')[0] : device };
    });
  }).then(function (r) {
    if (currentId !== m.id) return;
    var img = r.out && r.out.channels !== 4 && r.out.rgba ? r.out.rgba() : r.out;
    var data = new Uint8ClampedArray(img.data);
    self.postMessage({ type: 'result', id: m.id, w: img.width, h: img.height, data: data, device: r.device }, [data.buffer]);
  }).catch(function (err) {
    if (currentId !== m.id) return;
    self.postMessage({ type: 'error', id: m.id, stage: (err && err.bgStage) || 'load', code: codeOf(L0, err), name: (err && err.name) || 'Error', message: String((err && err.message) || err).slice(0, 200) });
  });
};
