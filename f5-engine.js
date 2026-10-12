/* ══════════════════════════════════════════════════════════════════
   f5-engine.js — ตัวรัน F5-TTS-THAI (ONNX 3 ส่วนจาก DakeQQ/F5-TTS-ONNX) ด้วย onnxruntime-web สำหรับหน้าทดลอง f5-lab.html
   ใช้ได้ 2 ที่ด้วยไฟล์เดียว: ใน f5-worker.js (ปกติ) และบนเธรดหลักของหน้า (เมื่อ Worker ไม่มี navigator.gpu แต่หน้ามี — เช่น เบราว์เซอร์ที่ยังไม่เปิด WebGPU ใน Worker)
   → สคริปต์ธรรมดาที่ตั้ง self.TanotF5Engine (ต้องมี TanotF5Calc + TanotMediaModels โหลดก่อนเรียก create)

   onnxruntime-web = vendor/transformers/ort.webgpu.bundle.min.mjs (pin 1.24.3 ตัวเดียวกับ transformers.js — ห้ามขึ้น 1.25+ ดู tts-worker.js)
   • backend WebGPU ของ bundle นี้ใช้ ort-wasm-simd-threaded.asyncify.{mjs,wasm} เสมอ (ทุกเบราว์เซอร์รวม Safari — ไม่ใช้ทางพิเศษของ Safari แบบ tts-worker.js
     เพราะตัว non-asyncify ไม่มี WebGPU) · .wasm (26 MB) โหลดจาก jsDelivr ครั้งเดียวแล้วเก็บในแคชเดียวกับโมเดล ส่งให้ ORT ผ่าน env.wasm.wasmBinary
   • ไฟล์โมเดล: repo บน Hugging Face เป็น private → โหลดผ่าน /api/hf/ เท่านั้น (TanotMediaModels.hfFetch: same-origin + คุกกี้, redirect:'manual',
     เซสชัน Access หมดอายุ = SessionError) · ไม่มี /api/hf/ (ไม่ใช่ *.pages.dev) = error code 'noproxy' — ไม่โหลดจาก huggingface.co ตรง
   • แคช: Cache Storage 'tanot-f5-models-v1' (sw.js ไม่ลบตอน bump CACHE) คีย์ = URL ของ huggingface.co (ไม่ขึ้นกับ origin/เซสชัน) → เปิดครั้งต่อไปไม่โหลดจากเน็ต
     หน่วยความจำ (iPhone ถูก Safari ปิดแท็บ): โหลดแบบ stream ตรงลงแคช (cache.put ของ ReadableStream — JS ถือทีละก้อน ไม่ถือทั้งไฟล์ + สำเนา) ·
     หลุดกลางทาง = ต่อด้วย Range: bytes=<ที่ได้แล้ว>- ในสตรีมเดิม (≤ 3 ครั้ง) · ไม่ครบ = ไม่ลงแคช · ตอนสร้าง session อ่านจากแคชทีละไฟล์ แล้วทิ้งทันทีหลัง create ·
     ไม่มี Cache Storage / ลงแคชไม่ได้ (พื้นที่เต็ม) = โหลดลงหน่วยความจำแบบเดิม · .wasm ของ ORT ถือไว้แค่จนสร้าง session แรกสำเร็จ (env.wasm.wasmBinary ถูกล้าง)
   • ระหว่าง step tensor อยู่บน GPU (preferredOutputLocation 'gpu-buffer') — ไม่คัดลอกกลับ CPU ทุก step · ปิดได้ (load {io:'cpu'}) · สร้าง session ไม่ได้ด้วยตัวเลือกนี้ = สร้างใหม่แบบ CPU (ioGpu false)
     tensor GPU ทุกตัว (ผลของ Preprocess, noise ของ step ก่อน) ถูก dispose ทันทีที่เลิกใช้ รวมตอนยกเลิก/ล้ม · time_step ใช้ tensor เดียวทุก step
   • crumb: ส่ง {type:'crumb', stage:'session'|'pre'|'step'|'dec'|'chunk', …ตัวเลข} ก่อนทุก run — หน้าเขียน localStorage ทันที (แท็บถูกปิดกลางทางก็ยังรู้ว่าไปถึงไหน)
   ข้อความ (msg.cmd): init {hfProxy} · status {variant} · load {variant, device:'webgpu'|'wasm', io:'gpu'|'cpu'} · synth {id, ref:{pcm}, items:[{full, frames}], probe?} · cancel · clear · dispose
   ตอบ (type): caps · cache · progress · loaded · crumb · step · chunk · probe · done · cancelled · cleared · error {stage, name, message, code} — ไม่มีข้อความ/เสียงของผู้ใช้ใน error */
(function (g) {
  'use strict';
  var ORT_PATH = 'vendor/transformers/ort.webgpu.bundle.min.mjs';
  var ORT_MJS = 'vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs';
  var RETRIES = 3;

  function now() { return (g.performance && g.performance.now) ? g.performance.now() : Date.now(); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function absUrl(p) { return new URL(p, g.location.href).href; }
  function err(code, message) { var e = new Error(message || code); e.code = code; return e; }
  function abortErr() { var e = err('abort', 'cancelled'); e.name = 'AbortError'; return e; }

  function create(post) {
    var C = g.TanotF5Calc, M = g.TanotMediaModels;
    var st = { ort: null, wasmSet: false, variant: null, device: null, sess: null, vocab: null, ioGpu: true, ioWant: true, cancel: false, busy: false };

    function models() { M = M || g.TanotMediaModels; return M; }
    function proxyOn() { var m = models(); return !!(m && m.hfProxyActive && m.hfProxyActive()); }
    function isSession(e) { var m = models(); return !!(m && m.isSessionError && m.isSessionError(e)); }

    async function gpuCaps() {
      var out = { gpu: !!(g.navigator && g.navigator.gpu), f16: false, adapter: null, fallback: false };
      if (!out.gpu) return out;
      try {
        var a = await g.navigator.gpu.requestAdapter();
        if (!a) { out.gpu = false; return out; }
        out.f16 = !!(a.features && a.features.has && a.features.has('shader-f16'));
        out.fallback = !!a.isFallbackAdapter;
        var info = a.info || (a.requestAdapterInfo ? await a.requestAdapterInfo() : null);
        if (info) out.adapter = [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' · ').slice(0, 120);
      } catch (e) { out.gpu = false; out.error = String(e && e.message || e).slice(0, 120); }
      return out;
    }

    /* ── โหลด/แคชไฟล์ ── */
    function cacheOpen() { return g.caches ? g.caches.open(C.CACHE_NAME) : Promise.resolve(null); }
    async function cachedSize(cache, key) {
      if (!cache) return 0;
      var hit = await cache.match(key);
      if (!hit) return 0;
      return +(hit.headers.get('X-Tanot-Size') || hit.headers.get('Content-Length') || 1) || 1;
    }
    function fetcherFor(isHf) {
      if (!isHf) return g.fetch.bind(g);
      if (!proxyOn()) throw err('noproxy', 'model proxy (/api/hf/) is only available on the main site');
      return models().hfFetch(g.fetch.bind(g));
    }
    /* ทางสำรอง (ไม่มีแคช/ลงแคชไม่ได้): โหลดลงบัฟเฟอร์ขนาด Content-Length ครั้งเดียว */
    async function download(key, isHf, onProg) {
      var fetcher = fetcherFor(isHf);
      var got = 0, total = 0, buf = null, chunks = null, tries = 0;
      for (;;) {
        if (st.cancel) throw abortErr();
        var headers = {};
        if (got > 0) headers.Range = 'bytes=' + got + '-';
        var res;
        try { res = await fetcher(key, { headers: headers, cache: 'no-store' }); }
        catch (e) {
          if (isSession(e) || ++tries > RETRIES) throw e;
          await sleep(1500 * tries); continue;
        }
        if (got > 0 && res.status === 200) { got = 0; buf = null; chunks = null; total = 0; } // ไม่รองรับ Range → เริ่มใหม่
        else if (got > 0 && res.status !== 206) throw err('http', 'HTTP ' + res.status);
        if (got === 0 && !res.ok) throw err('http', 'HTTP ' + res.status);
        if (!buf && !chunks) {
          var cr = /\/(\d+)\s*$/.exec(res.headers.get('Content-Range') || '');
          total = cr ? +cr[1] : (+res.headers.get('Content-Length') || 0);
          if (total > 0) buf = new Uint8Array(total); else chunks = [];
        }
        var reader = res.body.getReader();
        try {
          for (;;) {
            var r = await reader.read();
            if (r.done) break;
            if (st.cancel) { try { reader.cancel(); } catch (e) {} throw abortErr(); }
            var v = r.value;
            if (buf && got + v.length > total) { chunks = [buf.slice(0, got)]; buf = null; } // ขนาดไม่ตรง Content-Length (เช่น ถูกบีบอัดระหว่างทาง) → เก็บเป็นก้อน
            if (buf) buf.set(v, got); else chunks.push(v);
            got += v.length;
            onProg(got, total);
          }
        } catch (e) {
          if (e && e.code === 'abort') throw e;
          if (++tries > RETRIES) throw e;
          if (!buf) { got = 0; chunks = null; total = 0; }
          await sleep(1500 * tries); continue;
        }
        if (buf && got !== total) { if (++tries > RETRIES) throw err('incomplete', 'incomplete download ' + got + '/' + total); continue; }
        break;
      }
      if (buf) return buf;
      var out = new Uint8Array(got), at = 0;
      for (var i = 0; i < chunks.length; i++) { out.set(chunks[i], at); at += chunks[i].length; }
      return out;
    }
    /* stream ลงแคชโดยตรง — JS ถือทีละก้อน · หลุดกลางทางต่อด้วย Range ในสตรีมเดิม · คืนจำนวนไบต์ */
    async function streamToCache(cache, key, isHf, onProg) {
      var fetcher = fetcherFor(isHf), got = 0, total = 0, tries = 0, reader = null, failure = null;
      async function open() {
        for (;;) {
          if (st.cancel) throw abortErr();
          var headers = {};
          if (got > 0) headers.Range = 'bytes=' + got + '-';
          var res;
          try { res = await fetcher(key, { headers: headers, cache: 'no-store' }); }
          catch (e) {
            if (isSession(e) || ++tries > RETRIES) throw e;
            await sleep(1500 * tries); continue;
          }
          if (got > 0 && res.status !== 206) throw err('norange', 'HTTP ' + res.status + ' on resume'); // เขียนลงแคชไปแล้วบางส่วน เริ่มใหม่ในสตรีมเดิมไม่ได้
          if (got === 0 && !res.ok) throw err('http', 'HTTP ' + res.status);
          if (got === 0) { var cr = /\/(\d+)\s*$/.exec(res.headers.get('Content-Range') || ''); total = cr ? +cr[1] : (+res.headers.get('Content-Length') || 0); }
          reader = res.body.getReader();
          return;
        }
      }
      await open();
      var body = new ReadableStream({
        pull: async function (ctrl) {
          try {
            for (;;) {
              if (st.cancel) throw abortErr();
              var r;
              try { r = await reader.read(); }
              catch (e) { if (++tries > RETRIES) throw e; await sleep(1500 * tries); await open(); continue; }
              if (r.done) {
                if (total > 0 && got < total) { if (++tries > RETRIES) throw err('incomplete', 'incomplete download ' + got + '/' + total); await open(); continue; }
                ctrl.close(); return;
              }
              got += r.value.length;
              if (total > 0 && got > total) total = 0; // ขนาดไม่ตรง Content-Length (ถูกบีบอัดระหว่างทาง) → ไม่ตรวจความครบจากขนาด
              onProg(got, total);
              ctrl.enqueue(r.value);
              return;
            }
          } catch (e) {
            failure = e;
            try { reader.cancel(); } catch (x) {}
            ctrl.error(e);
          }
        },
        cancel: function () { try { reader.cancel(); } catch (e) {} }
      });
      var h = { 'Content-Type': 'application/octet-stream' };
      if (total > 0) h['X-Tanot-Size'] = String(total);
      try { await cache.put(key, new Response(body, { headers: h })); }
      catch (e) {
        if (failure) throw failure;
        try { reader.cancel(); } catch (x) {}
        e.putFailed = true; throw e;
      }
      if (failure) { try { await cache.delete(key); } catch (x) {} throw failure; }
      return got;
    }
    /* ให้ไฟล์อยู่ในแคช (ไม่อ่านเข้าหน่วยความจำ) · ไม่มีแคช/ลงแคชไม่ได้ = คืน bytes ที่โหลดลงหน่วยความจำ · คืน { fromCache, ms, bytes? } */
    async function ensureFile(key, isHf, label, part) {
      var t0 = now(), cache = await cacheOpen();
      var hit = cache && await cache.match(key);
      if (hit) {
        var n = +(hit.headers.get('X-Tanot-Size') || 0) || 0;
        post({ type: 'progress', file: label, loaded: n, total: n, part: part, fromCache: true });
        return { fromCache: true, ms: now() - t0 };
      }
      var last = 0;
      function prog(got, total) {
        var t = now();
        if (t - last < 150 && got !== total) return;
        last = t;
        post({ type: 'progress', file: label, loaded: got, total: total, part: part });
      }
      if (cache) {
        try { await streamToCache(cache, key, isHf, prog); return { fromCache: false, ms: now() - t0 }; }
        catch (e) {
          if (!(e && (e.putFailed || e.code === 'norange'))) throw e;
          if (e.putFailed) post({ type: 'warn', code: 'cacheFull', name: e && e.name || '', message: String(e && e.message || e).slice(0, 160) });
        }
      }
      return { fromCache: false, ms: now() - t0, bytes: await download(key, isHf, prog) };
    }
    /* อ่านไฟล์เข้าหน่วยความจำตอนจะใช้จริง (ทีละไฟล์) */
    async function bytesOf(key, r) {
      if (r && r.bytes) { var b = r.bytes; r.bytes = null; return b; }
      var cache = await cacheOpen(), hit = cache && await cache.match(key);
      if (!hit) throw err('evicted', 'model file missing from cache');
      return new Uint8Array(await hit.arrayBuffer());
    }

    async function status(variant) {
      // caches.open() สร้างแคชว่างขึ้นมา — ดูสถานะอย่างเดียวจึงเช็ก has() ก่อน (หลัง "ลบโมเดล" ต้องไม่เหลือแคชว่างค้าง)
      var cache = g.caches && await g.caches.has(C.CACHE_NAME) ? await cacheOpen() : null, files = {}, total = 0, complete = true;
      for (var i = 0; i < C.FILES.length; i++) {
        var f = C.FILES[i], n = await cachedSize(cache, C.modelUrl(variant, f));
        files[f] = n; total += n; if (!n) complete = false;
      }
      var wasm = await cachedSize(cache, C.ORT_WASM_URL);
      return { type: 'cache', variant: variant, files: files, bytes: total, complete: complete, wasm: wasm };
    }

    /* ── onnxruntime-web ── */
    async function ort() {
      if (!st.ort) st.ort = await import(absUrl(ORT_PATH));
      return st.ort;
    }
    async function release() {
      var s = st.sess; st.sess = null; st.vocab = null; st.variant = null; st.device = null;
      if (!s) return;
      for (var k in s) { try { await s[k].release(); } catch (e) {} }
    }
    function typeOf(sess, name, dflt) {
      var md = sess.inputMetadata;
      if (md && md.length) for (var i = 0; i < md.length; i++) if (md[i].name === name && md[i].type) return md[i].type;
      return dflt;
    }
    async function makeSession(O, bytes, device, location) {
      var opts = { executionProviders: [device], graphOptimizationLevel: 'all' };
      if (device === 'webgpu' && location && st.ioGpu) opts.preferredOutputLocation = location;
      try { return await O.InferenceSession.create(bytes, opts); }
      catch (e) {
        if (!opts.preferredOutputLocation || isMem(e)) throw e;
        st.ioGpu = false; // สร้างด้วย gpu-buffer ไม่ได้ → แบบ CPU (ช้ากว่า แต่ยังวัดได้)
        delete opts.preferredOutputLocation;
        return O.InferenceSession.create(bytes, opts);
      }
    }
    function isMem(e) { return /out of memory|bad_alloc|Aborted\(|memory access out of bounds|cannot allocate|failed to grow|Array buffer allocation failed/i.test(String(e && e.message || e)); }

    async function load(variant, device, io) {
      if (!C.VARIANTS[variant]) throw err('bad', 'unknown variant');
      device = device === 'wasm' ? 'wasm' : 'webgpu';
      var wantGpu = device === 'webgpu' && io !== 'cpu';
      if (st.sess && st.variant === variant && st.device === device && st.ioWant === wantGpu) { post({ type: 'loaded', variant: variant, device: device, reused: true, ioGpu: st.ioGpu }); return; }
      await release();
      st.cancel = false; st.ioGpu = wantGpu; st.ioWant = wantGpu;
      var tLoad = now(), O = await ort(), fromCache = true, files = C.FILES.length + 1, dlMs = 0, wasmFile = null;
      if (!st.wasmSet) {
        wasmFile = await ensureFile(C.ORT_WASM_URL, false, 'ort-wasm', 0);
        if (!wasmFile.fromCache) fromCache = false;
        dlMs += wasmFile.ms;
      }
      var got = {};
      for (var i = 0; i < C.FILES.length; i++) {
        var f = C.FILES[i], r = await ensureFile(C.modelUrl(variant, f), true, f, i + 1);
        if (!r.fromCache) fromCache = false;
        dlMs += r.ms; got[f] = r;
      }
      if (st.cancel) throw abortErr();
      if (wasmFile) {
        O.env.wasm.wasmBinary = await bytesOf(C.ORT_WASM_URL, wasmFile);
        O.env.wasm.wasmPaths = { mjs: absUrl(ORT_MJS), wasm: C.ORT_WASM_URL };
        O.env.wasm.numThreads = 1;
        O.env.wasm.proxy = false;
        if (O.env.webgpu) O.env.webgpu.powerPreference = 'high-performance'; // โน้ตบุ๊กที่มี GPU 2 ตัว: เลือกตัวแรง
      }
      st.vocab = C.parseVocab(new TextDecoder().decode(await bytesOf(C.modelUrl(variant, 'vocab.txt'), got['vocab.txt'])));
      var ms = { files: dlMs }, sess = {};
      post({ type: 'progress', stage: 'session', part: files });
      /* ทีละไฟล์: อ่านจากแคช → create → ทิ้ง bytes (ORT คัดลอกเข้า heap ของ WASM แล้ว) */
      async function one(key, file, loc) {
        post({ type: 'crumb', stage: 'session', part: file.replace(/\.onnx$/, '') });
        var b = await bytesOf(C.modelUrl(variant, file), got[file]);
        got[file] = null;
        var t = now(), s2 = await makeSession(O, b, device, loc);
        b = null;
        if (!st.wasmSet) { O.env.wasm.wasmBinary = undefined; st.wasmSet = true; } // ORT เริ่ม WASM แล้ว ไม่ต้องใช้ binary อีก
        sess[key] = s2;
        return now() - t;
      }
      try {
        ms.pre = await one('pre', 'F5_Preprocess.onnx', {
          noise: 'gpu-buffer', rope_cos: 'gpu-buffer', rope_sin: 'gpu-buffer', cat_mel_text: 'gpu-buffer', cat_mel_text_drop: 'gpu-buffer',
          ref_mel_tail: 'gpu-buffer', ref_signal_len: 'cpu', rms_scale: 'cpu' });
        if (st.cancel) throw abortErr();
        ms.tr = await one('tr', 'F5_Transformer.onnx', 'gpu-buffer');
        if (st.cancel) throw abortErr();
        ms.dec = await one('dec', 'F5_Decode.onnx', 'cpu');
      } catch (e) {
        for (var k in sess) { try { await sess[k].release(); } catch (x) {} }
        throw e;
      }
      ms.session = ms.pre + ms.tr + ms.dec;
      ms.total = now() - tLoad;
      st.sess = sess; st.variant = variant; st.device = device;
      post({ type: 'loaded', variant: variant, device: device, fromCache: fromCache, ms: ms, ioGpu: st.ioGpu,
        inputs: { audio: typeOf(sess.pre, 'audio', ''), text_ids: typeOf(sess.pre, 'text_ids', ''), noise: typeOf(sess.tr, 'noise', ''), time_step: typeOf(sess.tr, 'time_step', '') } });
    }

    /* ── tensor ── */
    function intTensor(O, type, values, dims) {
      if (type === 'int64') { var b = new BigInt64Array(values.length); for (var i = 0; i < values.length; i++) b[i] = BigInt(values[i]); return new O.Tensor('int64', b, dims); }
      if (type === 'float32') return new O.Tensor('float32', Float32Array.from(values), dims);
      return new O.Tensor('int32', Int32Array.from(values), dims);
    }
    function audioTensor(O, type, pcm) {
      var dims = [1, 1, pcm.length];
      if (type === 'int16') { var a = new Int16Array(pcm.length); for (var i = 0; i < pcm.length; i++) a[i] = Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32768))); return new O.Tensor('int16', a, dims); }
      if (type === 'float16') return new O.Tensor('float16', C.toF16(pcm), dims);
      return new O.Tensor('float32', pcm, dims);
    }
    async function toFloat32(t) {
      var d = t.location && t.location !== 'cpu' && t.getData ? await t.getData(true) : t.data;
      if (d instanceof Float32Array) return d;
      if (d instanceof Int16Array) { var o = new Float32Array(d.length); for (var i = 0; i < d.length; i++) o[i] = d[i] / 32768; return o; }
      if (t.type === 'float16' || d instanceof Uint16Array) return C.fromF16(d);
      return Float32Array.from(d);
    }
    function dispose(t) { try { if (t && t.dispose && t.location && t.location !== 'cpu') t.dispose(); } catch (e) {} }

    function setStep(t, k) { t.data[0] = t.type === 'int64' ? BigInt(k) : k; }

    async function synth(job) {
      if (!st.sess) throw err('notLoaded', 'model not loaded');
      st.cancel = false;
      var O = await ort(), s = st.sess, C2 = C, refPcm = job.ref.pcm, tJob = now();
      var aType = typeOf(s.pre, 'audio', 'float32'), idType = typeOf(s.pre, 'text_ids', 'int32'), durType = typeOf(s.pre, 'max_duration', 'int64');
      var stepType = typeOf(s.tr, 'time_step', 'int32');
      var audioT = audioTensor(O, aType, refPcm);
      var refFrames = C2.refFrames(refPcm.length);
      var tsT = intTensor(O, stepType, [0], [1]); // tensor เดียวทุก step (ORT คัดลอกค่าจาก CPU ตอน run)
      var items = job.probe ? job.items.slice(0, 1) : job.items, nItems = items.length;
      for (var i = 0; i < nItems; i++) {
        if (st.cancel) { post({ type: 'cancelled', id: job.id, i: i }); return; }
        var it = items[i], ids = C2.textIds(it.full, st.vocab);
        var maxDur = C2.maxDuration(ids.length, refFrames, it.frames);
        if (maxDur > C2.MAX_SIGNAL) throw err('tooLong', 'max_duration ' + maxDur);
        var at = { id: job.id, i: i, n: nItems, T: maxDur, idsLen: ids.length, refFrames: refFrames };
        var pre = null, noise = null, dec = null;
        try {
          post(Object.assign({ type: 'crumb', stage: 'pre' }, at));
          var t0 = now();
          pre = await s.pre.run({ audio: audioT, text_ids: intTensor(O, idType, ids, [1, ids.length]), max_duration: intTensor(O, durType, [maxDur], [1]) });
          var t1 = now(), stepMs = [], nfe = job.probe ? 1 : C2.NFE;
          noise = pre.noise;
          var names = s.tr.inputNames, feeds = {};
          for (var n = 0; n < names.length; n++) if (names[n] !== 'time_step' && names[n] !== 'noise') feeds[names[n]] = pre[names[n]];
          for (var k = 0; k < nfe; k++) {
            if (st.cancel) break;
            setStep(tsT, k);
            feeds.time_step = tsT; feeds.noise = noise;
            post(Object.assign({ type: 'crumb', stage: 'step', k: k + 1, of: C2.NFE }, at));
            var ts = now(), out = await s.tr.run(feeds);
            stepMs.push(now() - ts);
            post({ type: 'step', id: job.id, i: i, n: nItems, k: k + 1, of: C2.NFE });
            if (noise !== pre.noise) dispose(noise);
            noise = out[s.tr.outputNames[0]];
          }
          if (st.cancel) { post({ type: 'cancelled', id: job.id, i: i }); return; }
          if (job.probe) { post({ type: 'probe', id: job.id, T: maxDur, idsLen: ids.length, refFrames: refFrames, ms: { pre: t1 - t0, step: stepMs[0] || 0 } }); return; }
          var t2 = now(), dfeeds = {}, dn = s.dec.inputNames;
          for (var d = 0; d < dn.length; d++) dfeeds[dn[d]] = (dn[d] === 'denoised' || !pre[dn[d]]) ? noise : pre[dn[d]];
          post(Object.assign({ type: 'crumb', stage: 'dec' }, at));
          dec = await s.dec.run(dfeeds);
          var raw = await toFloat32(dec[s.dec.outputNames[0]]);
          var t3 = now();
          // ปล่อย tensor GPU ของท่อนนี้ก่อนทำงาน CPU ต่อ
          dispose(noise); noise = null;
          for (var q in pre) dispose(pre[q]);
          pre = null;
          for (var o in dec) dispose(dec[o]);
          dec = null;
          var audio = C2.trimOut(raw, C2.SR);
          if (audio === raw) audio = raw.slice(); // สำเนาของตัวเอง → ส่งแบบ transfer ได้ (trimOut คืน slice อยู่แล้วเมื่อตัด)
          raw = null;
          var sum = 0; for (var z = 0; z < stepMs.length; z++) sum += stepMs[z];
          post({ type: 'chunk', id: job.id, i: i, n: nItems, audio: audio, sr: C2.SR, samples: audio.length,
            ms: { pre: t1 - t0, steps: t2 - t1, step: stepMs.length ? sum / stepMs.length : 0, dec: t3 - t2, total: t3 - t0, sinceStart: t3 - tJob } }, [audio.buffer]);
          post(Object.assign({ type: 'crumb', stage: 'chunk' }, at));
        } finally {
          // ยกเลิก/ล้ม/probe: ไม่ทิ้ง tensor GPU ค้าง (dispose ซ้ำได้)
          if (noise) dispose(noise);
          if (pre) for (var p in pre) dispose(pre[p]);
          if (dec) for (var p2 in dec) dispose(dec[p2]);
        }
      }
      post({ type: 'done', id: job.id, ms: now() - tJob });
    }

    async function clear() {
      await release();
      if (g.caches) await g.caches.delete(C.CACHE_NAME);
      // st.wasmSet คงไว้: ORT ในหน้านี้มี .wasm ในหน่วยความจำแล้ว (เปิดหน้าใหม่ครั้งหน้าจะโหลดใหม่เพราะแคชถูกลบ)
      post({ type: 'cleared' });
    }

    function report(stage, e) {
      post({ type: 'error', stage: stage, name: (e && e.name) || 'Error', code: (e && e.code) || '', message: String((e && e.message) || e).slice(0, 300) });
    }

    async function handle(msg) {
      msg = msg || {};
      var stage = msg.cmd || '';
      try {
        if (msg.cmd === 'init') {
          if (msg.hfProxy) g.TANOT_HF_PROXY = msg.hfProxy;
          var caps = await gpuCaps();
          caps.type = 'caps'; caps.proxy = proxyOn(); caps.caches = !!g.caches;
          post(caps);
        } else if (msg.cmd === 'status') post(await status(msg.variant));
        else if (msg.cmd === 'load') { st.busy = true; await load(msg.variant, msg.device, msg.io); }
        else if (msg.cmd === 'synth') { st.busy = true; await synth(msg); }
        else if (msg.cmd === 'clear') await clear();
        else if (msg.cmd === 'dispose') await release();
      } catch (e) {
        if (e && e.code === 'abort') post({ type: 'cancelled', stage: stage });
        else report(stage, e);
      } finally { st.busy = false; }
    }
    return { handle: handle, cancel: function () { st.cancel = true; }, state: function () { return { variant: st.variant, device: st.device, ioGpu: st.ioGpu }; } };
  }

  g.TanotF5Engine = { create: create };
})(typeof self !== 'undefined' ? self : this);
