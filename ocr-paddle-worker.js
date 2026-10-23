/* ══════════════════════════════════════════════════════════════════
   ocr-paddle-worker.js — "อ่านแบบใหม่ (ทดลอง)": PaddleOCR PP-OCRv5 ภาษาไทยใน Module Worker (ไม่บล็อกหน้า)
   สร้างโดย file-reader.js (`new Worker('ocr-paddle-worker.js', {type:'module'})`) · ตรรกะล้วนอยู่ใน ocr-paddle-calc.js

   ไลบรารี (ทั้งหมดอยู่ในเครื่อง ไม่โหลดจาก CDN ยกเว้นไฟล์ .wasm แบบ asyncify ตามเดิมของ transformers — ดู tts-worker.js):
   • onnxruntime-web 1.24.3 = vendor/transformers/ort.webgpu.bundle.min.mjs ตัวเดียวกับ transformers.js (pin เดิม ห้ามอัป — เหตุผลใน tts-worker.js)
   • vendor/paddleocr/paddleocr.mjs (npm paddleocr@1.2.0, MIT) — pre/post-process ของ PaddleOCR/PaddleX แบบ JS ล้วน ไม่มี OpenCV:
     DB postprocess + ตัดกล่องเอียง + CTC decode + ตัวจำแนกทิศหน้า + UVDoc
     (PaddleOCR.js ทางการ @paddleocr/paddleocr-js 0.4.2 ไม่รองรับ doc orientation/UVDoc — เมิน DocPreprocessor — และไม่มี lang "th" จึงไม่ใช้)
   • โมเดล ONNX ทางการจาก Hugging Face (TanotPaddleCalc.MODELS) แคชใน Cache Storage `tanot-paddle-models` ตอนใช้ครั้งแรก (ไม่อยู่ใน PRECACHE ของ sw.js)

   ข้อความเข้า: { type:'run', id, img:{width,height,data: RGBA Uint8ClampedArray (transfer)}, plan:'yes'|'no'|'measure', device:'webgpu'|'wasm' }
   ข้อความออก: { type:'progress', id, stage:'download', loaded, total } · { type:'progress', id, stage:'orient'|'unwarp'|'detect'|'recognize', i?, n? }
              { type:'fallback', id, what:'device', stage } (WebGPU ล้ม → WASM ครั้งเดียวในอายุ Worker)
              { type:'result', id, items:[{text,score,poly}], text, unwarped, angle, device, ms:{…}, size:[w,h] }
              { type:'error', id, stage:'load'|'run', code:'missing'|'network'|'memory'|'other', name, message } — ไม่มีข้อความ/ภาพของผู้ใช้ */
var CACHE_NAME = 'tanot-paddle-models';
var ONNX_ASYNCIFY_WASM_CDN_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.asyncify.wasm';

var libsP = null;
function libs() {
  if (!libsP) {
    libsP = Promise.all([
      import('./vendor/transformers/ort.webgpu.bundle.min.mjs'),
      import('./vendor/paddleocr/paddleocr.mjs'),
      import('./ocr-paddle-calc.js'),
      import('./ocr-prep.js')
    ]).then(function (r) {
      var ort = r[0];
      /* ตั้ง path ของ .wasm แบบเดียวกับ tts-worker.js (Safari = non-asyncify ในเครื่อง, อื่นๆ = asyncify จาก jsDelivr pin 1.24.3) */
      var isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(self.navigator.userAgent);
      ort.env.wasm.wasmPaths = isSafari
        ? { mjs: new URL('./vendor/transformers/ort-wasm-simd-threaded.mjs', import.meta.url).href, wasm: new URL('./vendor/transformers/ort-wasm-simd-threaded.wasm', import.meta.url).href }
        : { mjs: new URL('./vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs', import.meta.url).href, wasm: ONNX_ASYNCIFY_WASM_CDN_URL };
      ort.env.wasm.numThreads = 1;
      return { ort: ort, P: r[1], C: self.TanotPaddleCalc, prep: self.TanotOcrPrep };
    }, function (e) { libsP = null; throw e; });
  }
  return libsP;
}

/* ── ดาวน์โหลดโมเดล (แคชในเครื่อง) ── */
function httpError(status, url) {
  var e = new Error('HTTP ' + status + ' ' + url.replace(/^https:\/\/[^/]+\//, ''));
  e.status = status;
  return e;
}
function openCache() {
  try { return self.caches ? self.caches.open(CACHE_NAME).catch(function () { return null; }) : Promise.resolve(null); }
  catch (e) { return Promise.resolve(null); }
}
/* keys = ชื่อใน MODELS · onBytes(loaded, total) — total = Content-Length จริง (ไม่รู้ = ค่าประมาณในตาราง) · คืน { key: ArrayBuffer } */
function fetchModels(C, keys, onBytes) {
  var out = {}, sizes = {}, got = {}, anyNet = false;
  keys.forEach(function (k) { sizes[k] = C.MODELS[k].bytes; got[k] = 0; });
  function report() {
    if (!anyNet) return;
    var t = 0, l = 0;
    keys.forEach(function (k) { t += sizes[k]; l += got[k]; });
    onBytes(l, t);
  }
  return openCache().then(function (cache) {
    var chain = Promise.resolve();
    keys.forEach(function (k) {
      chain = chain.then(function () {
        var url = C.modelUrl(C.MODELS[k]);
        return (cache ? cache.match(url) : Promise.resolve(null)).then(function (hit) {
          if (hit) return hit.arrayBuffer().then(function (b) { out[k] = b; sizes[k] = got[k] = b.byteLength; report(); });
          anyNet = true;
          return fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' }).then(function (res) {
            if (!res.ok) throw httpError(res.status, url);
            var len = +res.headers.get('Content-Length') || 0;
            if (len) sizes[k] = len;
            report();
            var p;
            if (res.body && res.body.getReader) {
              var reader = res.body.getReader(), parts = [], n = 0;
              p = (function pump() {
                return reader.read().then(function (r) {
                  if (r.done) {
                    var buf = new Uint8Array(n), o = 0;
                    parts.forEach(function (c) { buf.set(c, o); o += c.length; });
                    return buf.buffer;
                  }
                  parts.push(r.value); n += r.value.length; got[k] = n;
                  if (n > sizes[k]) sizes[k] = n;
                  report();
                  return pump();
                });
              })();
            } else p = res.arrayBuffer();
            return p.then(function (b) {
              out[k] = b; sizes[k] = got[k] = b.byteLength; report();
              if (cache) return cache.put(url, new Response(b, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(b.byteLength) } })).catch(function () {});
            });
          });
        });
      });
    });
    return chain.then(function () { return out; });
  });
}

/* ── session ต่ออุปกรณ์ ── */
var sessions = {};   // 'det|wasm' → Promise<service>
var dict = null;     // รายการตัวอักษรของตัวอ่าน (จาก inference.yml)
var gpuFailed = false;
function deviceFor(want) { return want === 'webgpu' && !gpuFailed ? 'webgpu' : 'wasm'; }
function parseDict(C, buf) {
  var chars = C.parseCharDict(new TextDecoder('utf-8').decode(buf));
  if (chars.length < 10) { var e = new Error('character_dict not found in inference.yml'); e.code = 'missing'; throw e; }
  return chars.concat([' ']); // PaddleX BaseRecLabelDecode: use_space_char=True → ต่อท้ายช่องว่าง (blank อยู่หน้า — ไลบรารีจัดการเอง)
}
function service(L, key, device, buf) {
  var sk = key + '|' + device;
  if (!sessions[sk]) {
    sessions[sk] = L.ort.InferenceSession.create(buf, { executionProviders: [device], graphOptimizationLevel: 'all' }).then(function (s) {
      var P = L.P, C = L.C;
      if (key === 'det') return new P.DetectionService(L.ort, s, Object.assign({}, P.getModelPresetOptions('PP-OCRv5_mobile').detection, C.DET_OPTIONS));
      if (key === 'rec') return new P.RecognitionService(L.ort, s, P.getModelPresetOptions('PP-OCRv5_mobile').recognition);
      if (key === 'ori') return new P.ImageClassificationService(L.ort, s, P.getImageClassificationPresetOptions('PP-LCNet_x1_0_doc_ori'));
      return new P.TextImageUnwarpingService(L.ort, s, P.getTextImageUnwarpingPresetOptions('UVDoc'));
    }, function (e) { delete sessions[sk]; throw e; });
  }
  return sessions[sk];
}
/* โหลด (ดาวน์โหลด + สร้าง session) ชุดโมเดล — ดาวน์โหลดรอบเดียว (แถบ MB ต่อเนื่อง) เฉพาะที่ยังไม่มี session ของอุปกรณ์นั้น + dict ครั้งแรก */
function loadSet(L, keys, device, onBytes) {
  var need = keys.filter(function (k) { return !sessions[k + '|' + device]; });
  if (!dict) need.push('dict');
  var dl = need.length ? fetchModels(L.C, need, onBytes) : Promise.resolve({});
  return dl.then(function (bufs) {
    if (bufs.dict) dict = parseDict(L.C, bufs.dict);
    return Promise.all(keys.map(function (k) { return service(L, k, device, bufs[k]); }));
  });
}

function rgbOf(img) {
  var n = img.width * img.height, src = img.data;
  if (src.length === n * 3) return img;
  var out = new Uint8Array(n * 3);
  for (var p = 0, i = 0, j = 0; p < n; p++, i += 4, j += 3) { out[j] = src[i]; out[j + 1] = src[i + 1]; out[j + 2] = src[i + 2]; }
  return { width: img.width, height: img.height, data: out };
}
function now() { return (self.performance && performance.now) ? performance.now() : Date.now(); }

function classifyError(e) {
  var s = String((e && (e.message || e)) || '');
  if (e && e.code === 'missing') return 'missing';
  if (e && (e.status === 404 || e.status === 403 || e.status === 401)) return 'missing';
  if (/memory|bad_alloc|allocation|OOM|Out of memory/i.test(s)) return 'memory';
  if (e && e.status) return 'network';
  if (/Failed to fetch|NetworkError|network|Load failed|net::ERR/i.test(s)) return 'network';
  return 'other';
}

function run(msg) {
  var id = msg.id, t0 = now(), ms = {};
  var post = function (m) { m.id = id; self.postMessage(m); };
  var onBytes = function (loaded, total) { post({ type: 'progress', stage: 'download', loaded: loaded, total: total }); };
  var stage = 'load';
  return libs().then(function (L) {
    var C = L.C, img = rgbOf(msg.img), plan = msg.plan || 'no', unwarp = false, angle = 0, uneven = null;
    if (plan === 'measure') {
      var rgba = msg.img.data.length === msg.img.width * msg.img.height * 4 ? msg.img.data : null;
      if (rgba && L.prep) uneven = L.prep.unevenness(L.prep.toGray(rgba, msg.img.width * msg.img.height), msg.img.width, msg.img.height);
    }
    unwarp = C.shouldUnwarp(plan, uneven);
    var keys = C.modelSet(unwarp).filter(function (k) { return k !== 'dict'; });

    function attempt(device) {
      stage = 'load';
      var tl = now();
      return loadSet(L, keys, device, onBytes).then(function (list) {
        ms.load = Math.round(now() - tl);
        stage = 'run';
        var svc = {}, cur = img;
        keys.forEach(function (k, i) { svc[k] = list[i]; });
        var p = Promise.resolve();
        if (unwarp) {
          p = p.then(function () {
            post({ type: 'progress', stage: 'orient' });
            var ta = now();
            return svc.ori.run(cur).then(function (cls) {
              angle = cls && cls[0] ? (parseInt(cls[0].label, 10) || 0) : 0;
              if (angle) cur = C.rotateRgb(cur, angle);
              ms.orient = Math.round(now() - ta);
              post({ type: 'progress', stage: 'unwarp' });
              var tu = now();
              return svc.uvdoc.run(cur).then(function (u) { cur = u.doctrImage; ms.unwarp = Math.round(now() - tu); });
            });
          });
        }
        return p.then(function () {
          post({ type: 'progress', stage: 'detect' });
          var td = now(), image = new L.P.Image(cur.width, cur.height, 3, cur.data);
          return svc.det.run(image).then(function (boxes) {
            ms.detect = Math.round(now() - td);
            var tr = now();
            post({ type: 'progress', stage: 'recognize', i: 0, n: boxes.length });
            return svc.rec.run(image, boxes, {
              recognition: { charactersDictionary: dict },
              onProgress: function (ev) { if (ev && ev.stage === 'item' && ev.progress) post({ type: 'progress', stage: 'recognize', i: ev.progress.current, n: ev.progress.total }); }
            }).then(function (res) {
              ms.recognize = Math.round(now() - tr);
              var items = res.filter(function (x) { return x.confidence >= C.REC_SCORE_MIN && String(x.text || '').trim(); }).map(function (x) {
                var b = x.box, poly = b.points ? b.points.map(function (q) { return [Math.round(q.x != null ? q.x : q[0]), Math.round(q.y != null ? q.y : q[1])]; })
                  : [[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]];
                return { text: x.text, score: Math.round(x.confidence * 1000) / 1000, poly: poly };
              });
              ms.total = Math.round(now() - t0);
              post({ type: 'result', items: items, text: C.linesText(C.orderLines(items)), unwarped: unwarp, angle: angle, device: device, ms: ms, size: [cur.width, cur.height], boxes: boxes.length });
            });
          });
        });
      });
    }

    var dev = deviceFor(msg.device);
    return attempt(dev).catch(function (e) {
      if (dev !== 'webgpu' || classifyError(e) === 'missing' || classifyError(e) === 'network') throw e;
      gpuFailed = true; // WebGPU ล้ม (โหลด/รัน) → ทำซ้ำบน WASM ครั้งเดียว
      post({ type: 'fallback', what: 'device', stage: stage, name: String((e && e.name) || ''), message: String((e && e.message) || e).slice(0, 200) });
      return attempt('wasm');
    });
  }).catch(function (e) {
    post({ type: 'error', stage: stage, code: classifyError(e), name: String((e && e.name) || 'Error'), message: String((e && e.message) || e).slice(0, 300) });
  });
}

var queue = Promise.resolve();
self.onmessage = function (ev) {
  var m = ev.data || {};
  if (m.type === 'run') queue = queue.then(function () { return run(m); });
};
