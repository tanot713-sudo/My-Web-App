/* ══════════════════════════════════════════════════════════════════
   media-core.js — ของกลางของงานเสียง/OCR ในเบราว์เซอร์ (window.TanotMedia)
   ใช้โดย text-to-speech.js, ai-chat-widget.js (shell.js ฉีดให้ทุกหน้า), file-reader.js/doc-check.js/receipts.js (บันทึกปัญหา OCR), data.js

   1) decode16k(arrayBuffer) — ถอดรหัสเสียงที่ 16kHz ตั้งแต่แรก (OfflineAudioContext(1, 1, 16000).decodeAudioData)
      เดิม decodeFileToPcm ถอดรหัสทั้งไฟล์ที่ความถี่เดิม (44.1/48kHz × 2 ช่อง) แล้วค่อย resample — ไฟล์ประชุม 1 ชม.
      ใช้แรม ~1.4GB แค่ขั้นนี้ (แท็บมือถือแครช) · 16kHz ตั้งแต่แรกเหลือ 1/3 และรวมเป็นโมโนทีละช่วงตอนส่ง (segment)
      ไม่สร้างสำเนาโมโนทั้งไฟล์ · ใช้ฟังก์ชันเดียวกันทั้งถอดเสียงคลาวด์/ในเบราว์เซอร์/ไมค์ของวิดเจ็ตแชท
   2) transcribeLocal() — Whisper ใน asr-worker.js (ไม่ใช่เธรดหลัก) ส่งทีละช่วง (≤ 5 นาที) แบบ transfer
      ArrayBuffer · ยกเลิกได้ (terminate Worker — WASM ที่กำลังคำนวณหยุดกลางทางได้ทางเดียว) · Worker พัง/
      หน่วยความจำไม่พอ → ปิดตัวที่พังทิ้ง ครั้งต่อไปสร้างใหม่ (โหลดโมเดลจากแคช)
   3) budget — งบหน่วยความจำ: บนมือถือมีโมเดลในเบราว์เซอร์ได้ครั้งละ 1 ตัว (แชท/ถอดเสียง/เสียงพูด) —
      acquire() ปิด Worker โมเดลตัวอื่นก่อนโหลดตัวใหม่ (เดิมวิดเจ็ตแชทมี LLM + Whisper + TTS พร้อมกันได้)
   4) บันทึกปัญหา (crash log) — localStorage 'tanot:media:log' (kind cache ใน data-registry.js: อยู่เครื่องนี้
      เท่านั้น ไม่ซิงก์/ไม่สำรอง) 50 รายการล่าสุด · เก็บเฉพาะข้อมูลเครื่อง/โมเดล/ขั้นตอน/ชนิด-ขนาด-ความยาวไฟล์
      ห้ามเก็บชื่อไฟล์ ข้อความ หรือเสียงของผู้ใช้ · แสดง/คัดลอก/ล้างที่ data.html
   5) พื้นที่เก็บโมเดล — navigator.storage.persist() ตอนเริ่มโหลดโมเดลครั้งแรก (iOS ลบแคชโมเดลบ่อยถ้าไม่ขอ),
      ขนาดแคช transformers.js ('transformers-cache' ใน Cache Storage) + ปุ่มล้างที่ data.html */
(function () {
  'use strict';
  if (window.TanotMedia) return;

  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]*$/, '') : './';
  })();

  /* ── ข้อความกลาง (error ของเครื่องมือเสียง) ── */
  var I18N = window.OME_I18N;
  var DICT = {
    th: {
      oom: 'หน่วยความจำของเบราว์เซอร์ไม่พอสำหรับโมเดลนี้ — ลองโมเดลที่เล็กลง ปิดแท็บอื่น หรือใช้โหมดคลาวด์',
      crash: 'ตัวประมวลผลในเบราว์เซอร์หยุดทำงานกลางทาง (มักเป็นเพราะหน่วยความจำไม่พอ) — ลองใหม่ด้วยโมเดลที่เล็กลง หรือใช้โหมดคลาวด์',
      abort: 'ยกเลิกแล้ว', evicted: 'หยุดแล้วเพื่อคืนหน่วยความจำให้งานอื่น', decode: 'ถอดรหัสไฟล์เสียงนี้ไม่ได้ — ลองไฟล์ชนิดอื่น (mp3/wav/mp4/webm)',
      noWorker: 'สร้าง Web Worker ไม่ได้'
    },
    en: {
      oom: 'The browser ran out of memory for this model — try a smaller model, close other tabs, or use cloud mode',
      crash: 'The in-browser processor stopped part way (usually not enough memory) — try again with a smaller model, or use cloud mode',
      abort: 'Cancelled', evicted: 'Stopped to free memory for another task', decode: 'Could not decode this audio file — try another type (mp3/wav/mp4/webm)',
      noWorker: 'Could not create a Web Worker'
    }
  };
  var T = I18N ? I18N.scope('media', DICT) : function (k) { return DICT.th[k] || ''; };

  /* ── เครื่อง ── */
  function ua() { return navigator.userAgent || ''; }
  function isIOS() {
    if (/iPad|iPhone|iPod/.test(ua()) && !window.MSStream) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }
  function isAndroid() { return /Android/i.test(ua()); }
  function isMobile() { return isIOS() || isAndroid(); }
  function device() {
    return { ua: ua().slice(0, 200), mem: navigator.deviceMemory || null, cores: navigator.hardwareConcurrency || null, mobile: isMobile(), ios: isIOS() };
  }

  /* ── จำแนก error ── */
  var MEM_RE = /out of memory|bad_alloc|Aborted\(|memory access out of bounds|cannot allocate|failed to grow|could not allocate|WebAssembly\.Memory|Array buffer allocation failed|Invalid typed array length|\bOOM\b/i;
  function mediaError(code, message, cause) {
    var e = new Error(message || T(code) || code);
    e.name = 'MediaError'; e.code = code;
    if (cause) { e.cause = cause; e.causeName = cause.name; e.causeMessage = cause.message; }
    return e;
  }
  function isMemoryError(err) {
    if (!err) return false;
    if (err.code === 'oom') return true;
    var m = String(err.message || err.causeMessage || err), n = err.name || err.causeName || '';
    return MEM_RE.test(m) || (n === 'RangeError' && /memory|alloc|buffer|array length/i.test(m));
  }
  function classify(err) {
    if (!err) return 'other';
    if (err.code === 'abort' || err.code === 'evicted' || err.code === 'crash' || err.code === 'decode') return err.code;
    if (isMemoryError(err)) return 'oom';
    if (err.code) return err.code;
    if (err.name === 'AbortError') return 'abort';
    return 'other';
  }
  /* ข้อความให้ผู้ใช้อ่าน — ใช้ใน OME_I18N.live(el, fn) ได้ (แปลตามภาษาปัจจุบันทุกครั้ง) */
  function errorText(err) {
    var c = classify(err);
    if (c === 'oom' || c === 'crash' || c === 'abort' || c === 'evicted' || c === 'decode') return T(c);
    return (err && err.message) || String(err);
  }
  /* ควรแนะนำคลาวด์ไหม — ปัญหาที่เกิดจากเครื่อง (หน่วยความจำ/Worker พัง) */
  function isDeviceLimit(err) { var c = classify(err); return c === 'oom' || c === 'crash'; }

  /* ── บันทึกปัญหา ── */
  var LOG_KEY = 'tanot:media:log', LOG_MAX = 50;
  function scrub(s) {
    return String(s == null ? '' : s)
      .replace(/(blob:|data:)[^\s'")]+/g, '$1…')
      .replace(/"[^"]{40,}"|'[^']{40,}'/g, '"…"')
      .replace(/\s+/g, ' ').trim().slice(0, 240);
  }
  function readLog() {
    try { var v = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function writeLog(rows) {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(rows.slice(-LOG_MAX))); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('tanot:medialog')); } catch (e) {}
  }
  function fileMeta(f) {
    if (!f) return null;
    var ext = /\.([a-z0-9]{1,5})$/i.exec(f.name || '');
    return { type: f.type || '', ext: ext ? ext[1].toLowerCase() : '', size: f.size || 0, dur: f.dur != null ? Math.round(f.dur) : null };
  }
  /* ctx: { stage, engine:'local'|'cloud', model, lang, file: File|{type,name,size,dur} } — ห้ามส่งข้อความ/เสียงของผู้ใช้มาที่นี่ */
  function logError(kind, err, ctx) {
    ctx = ctx || {};
    var code = classify(err);
    if (code === 'abort') return null; // ผู้ใช้ยกเลิกเอง ไม่ใช่ปัญหา
    var d = device();
    var row = {
      at: Date.now(), kind: String(kind || 'other'), stage: ctx.stage || '', engine: ctx.engine || '', model: ctx.model || '',
      lang: ctx.lang || '', code: code, name: scrub((err && (err.causeName || err.name)) || ''),
      msg: scrub((err && (err.causeMessage || err.message)) || err), page: (location.pathname.split('/').pop() || 'index.html'),
      ua: d.ua, mem: d.mem, cores: d.cores, online: navigator.onLine !== false, file: fileMeta(ctx.file)
    };
    var rows = readLog(); rows.push(row); writeLog(rows);
    return row;
  }
  function clearLog() { try { localStorage.removeItem(LOG_KEY); } catch (e) {} try { window.dispatchEvent(new CustomEvent('tanot:medialog')); } catch (e) {} }
  /* error ที่หลุดมาถึง window (ไม่มีใคร catch) — บันทึกเฉพาะที่มาจากงานเสียง/OCR */
  var GLOBAL_RE = /onnx|ort-wasm|transformers|tesseract|whisper|mms-tts|asr-worker|tts-worker|audio-encode|lamejs|decodeAudioData|bad_alloc|out of memory/i;
  function kindOf(s) { return /tesseract|ocr/i.test(s) ? 'ocr' : /whisper|asr/i.test(s) ? 'asr' : /tts|lame|audio-encode/i.test(s) ? 'tts' : 'media'; }
  window.addEventListener('error', function (e) {
    var s = [e.message, e.filename, e.error && e.error.stack].join(' ');
    if (GLOBAL_RE.test(s)) logError(kindOf(s), e.error || { message: e.message, name: 'Error' }, { stage: 'uncaught' });
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason, s = r ? [r.message, r.stack, r].join(' ') : '';
    if (r && r.mediaLogged) return;
    if (GLOBAL_RE.test(s)) logError(kindOf(s), r, { stage: 'unhandled' });
  });

  /* ── งบหน่วยความจำของโมเดลในเบราว์เซอร์ ── */
  var active = []; // [{ id, release }]
  var budget = {
    limit: function () { return isMobile() ? 1 : Infinity; },
    /* ลงทะเบียนโมเดล id (เรียกก่อนสร้าง/โหลด Worker) — มือถือ: ปิดตัวอื่นทั้งหมดก่อน · release() ต้อง terminate Worker ของเจ้าของเอง */
    acquire: function (id, release) {
      if (isMobile()) {
        active.slice().forEach(function (a) {
          if (a.id === id) return;
          active = active.filter(function (x) { return x !== a; });
          try { a.release(); } catch (e) {}
        });
      }
      active = active.filter(function (x) { return x.id !== id; });
      active.push({ id: id, release: release });
    },
    release: function (id) { active = active.filter(function (x) { return x.id !== id; }); },
    active: function () { return active.map(function (a) { return a.id; }); },
    releaseAll: function () { var all = active; active = []; all.forEach(function (a) { try { a.release(); } catch (e) {} }); }
  };

  /* ── ถอดรหัสเสียงที่ 16kHz ── */
  var RATE = 16000;
  function wrapBuffer(ab) {
    var ch = ab.numberOfChannels;
    return {
      sampleRate: RATE, length: ab.length, duration: ab.length / RATE, channels: ch,
      /* โมโนของช่วง [a, b) เป็น Float32Array ใหม่ (transfer เข้า Worker ได้โดยไม่กระทบต้นฉบับ) */
      segment: function (a, b) {
        a = Math.max(0, a | 0); b = Math.min(ab.length, b == null ? ab.length : b | 0);
        var out = new Float32Array(Math.max(0, b - a));
        if (ch === 1) { out.set(ab.getChannelData(0).subarray(a, b)); return out; }
        for (var c = 0; c < ch; c++) {
          var d = ab.getChannelData(c);
          for (var i = 0; i < out.length; i++) out[i] += d[a + i];
        }
        for (var j = 0; j < out.length; j++) out[j] /= ch;
        return out;
      },
      mono: function () { return this.segment(0, ab.length); }
    };
  }
  function wrapPcm(pcm) {
    return {
      sampleRate: RATE, length: pcm.length, duration: pcm.length / RATE, channels: 1,
      segment: function (a, b) { return pcm.slice(Math.max(0, a | 0), b == null ? pcm.length : b | 0); },
      mono: function () { return pcm.slice(); }
    };
  }
  function decodeWith(ctx, buf) {
    return new Promise(function (resolve, reject) {
      var p = ctx.decodeAudioData(buf, resolve, reject); // แบบ callback รองรับ Safari รุ่นเก่า
      if (p && p.then) p.then(resolve, reject);
    });
  }
  /* ทางสำรองของเบราว์เซอร์ที่สร้าง OfflineAudioContext ที่ 16kHz ไม่ได้: ถอดที่ความถี่ของเครื่องแล้ว resample (วิธีเดิม) */
  function resample(audioBuffer) {
    var Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var off = new Off(1, Math.max(1, Math.ceil(audioBuffer.duration * RATE)), RATE);
    var src = off.createBufferSource();
    src.buffer = audioBuffer; src.connect(off.destination); src.start(0);
    return off.startRendering().then(function (r) { return wrapPcm(r.getChannelData(0)); });
  }
  function decode16k(arrayBuffer) {
    var Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var ctx = null;
    try { ctx = new Off(1, 1, RATE); } catch (e) { ctx = null; }
    if (ctx) {
      return decodeWith(ctx, arrayBuffer).then(function (ab) {
        return ab.sampleRate === RATE ? wrapBuffer(ab) : resample(ab);
      }, function (err) { throw mediaError('decode', T('decode'), err); });
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    var ac = new AC();
    return decodeWith(ac, arrayBuffer).then(function (ab) {
      try { ac.close(); } catch (e) {}
      return resample(ab);
    }, function (err) { try { ac.close(); } catch (e) {} throw mediaError('decode', T('decode'), err); });
  }
  /* หาจุดเงียบที่สุด (พลังงานต่ำสุดต่อเฟรม) ในรัศมี ±search รอบ target — ตัดช่วงไม่ให้ขาดกลางคำ */
  function quietCut(pcm, target, search, frame) {
    var lo = Math.max(0, target - search), hi = Math.min(pcm.length, target + search), best = target, bestE = Infinity;
    for (var i = lo; i < hi; i += frame) {
      var end = Math.min(i + frame, pcm.length), s = 0;
      for (var j = i; j < end; j++) s += pcm[j] * pcm[j];
      var e = s / Math.max(1, end - i);
      if (e < bestE) { bestE = e; best = i; }
    }
    return best;
  }
  var SEGMENT_SEC = 300;
  /* แบ่งเสียงที่ถอดแล้วเป็นช่วงละ ~segSec วินาที ตัดตรงจุดเงียบ ±3 วินาที → [[a, b], …] (ดัชนี sample) */
  function planSegments(dec, segSec) {
    var len = Math.round((segSec || SEGMENT_SEC) * RATE), search = 3 * RATE, frame = Math.round(RATE * 0.02);
    var out = [], start = 0;
    while (start < dec.length) {
      var target = start + len;
      if (target >= dec.length - RATE) { out.push([start, dec.length]); break; }
      var lo = Math.max(start + 1, target - search), win = dec.segment(lo, Math.min(dec.length, target + search));
      var cut = lo + quietCut(win, target - lo, search, frame);
      if (cut <= start) cut = target;
      out.push([start, cut]);
      start = cut;
    }
    return out;
  }

  /* ── Whisper ในเบราว์เซอร์ (asr-worker.js) ── */
  var asr = { w: null, model: null, seq: 0, pending: null };
  function asrKill(code) {
    if (asr.w) { try { asr.w.terminate(); } catch (e) {} }
    asr.w = null; asr.model = null;
    budget.release('asr');
    var p = asr.pending; asr.pending = null;
    if (p) p.reject(mediaError(code || 'evicted'));
  }
  function asrWorker(modelId) {
    if (asr.w && asr.model !== modelId) asrKill('evicted'); // เปลี่ยนโมเดล = Worker ใหม่ (หน่วยความจำ WASM หดไม่ได้ ต้องทิ้งทั้งก้อน)
    if (!asr.w) {
      budget.acquire('asr', function () { asrKill('evicted'); });
      try { asr.w = new Worker(BASE + 'asr-worker.js', { type: 'module' }); } catch (e) { budget.release('asr'); throw mediaError('noWorker', T('noWorker'), e); }
      asr.model = modelId;
    }
    return asr.w;
  }
  /* ส่ง 1 ช่วง → Promise<text> */
  function asrOne(pcm, modelId, lang, onProgress) {
    return new Promise(function (resolve, reject) {
      var w = asrWorker(modelId), jobId = 'asr-' + (++asr.seq);
      var job = { resolve: resolve, reject: reject };
      asr.pending = job;
      function done() { w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); if (asr.pending === job) asr.pending = null; }
      function onMsg(e) {
        var m = e.data;
        if (!m || m.jobId !== jobId) return;
        if (m.type === 'model-progress') { if (onProgress) onProgress({ stage: 'model', file: m.file, progress: m.progress }); }
        else if (m.type === 'pipeline-ready') { if (onProgress) onProgress({ stage: 'ready' }); }
        else if (m.type === 'result') { done(); resolve(m.text || ''); }
        else if (m.type === 'error') {
          done();
          var cause = { name: m.name || 'Error', message: m.message || '' };
          var oom = m.oom || isMemoryError(cause);
          if (oom) asrKill(); // หน่วยความจำของ Worker นี้เสียแล้ว — ทิ้งทั้งตัว
          reject(mediaError(oom ? 'oom' : 'asr', oom ? T('oom') : m.message, cause));
        }
      }
      function onErr(e) {
        done();
        if (e && e.preventDefault) e.preventDefault();
        asrKill();
        reject(mediaError('crash', T('crash'), { name: 'WorkerError', message: (e && e.message) || 'worker crashed' }));
      }
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage({ type: 'transcribe', jobId: jobId, pcm: pcm, lang: lang, modelId: modelId }, [pcm.buffer]);
    });
  }
  /* opts: { dec (จาก decode16k) | pcm, modelId, lang:'auto'|'thai'|…, segSec, onProgress({stage:'model'|'segment', …}), signal }
     → Promise<text> · ยกเลิก (signal.abort()) = terminate Worker ทันที */
  function transcribeLocal(opts) {
    var dec = opts.dec || wrapPcm(opts.pcm);
    var modelId = opts.modelId || 'Xenova/whisper-tiny';
    var segs = planSegments(dec, opts.segSec);
    var texts = [], i = 0;
    persistOnce();
    return new Promise(function (resolve, reject) {
      var finished = false;
      function fail(e) { if (finished) return; finished = true; reject(e); }
      if (opts.signal) {
        if (opts.signal.aborted) { fail(mediaError('abort')); return; }
        opts.signal.addEventListener('abort', function () { asrKill('abort'); fail(mediaError('abort')); });
      }
      (function next() {
        if (finished) return;
        if (i >= segs.length) { finished = true; resolve(texts.join(' ').replace(/\s+/g, ' ').trim()); return; }
        if (opts.onProgress) opts.onProgress({ stage: 'segment', i: i + 1, n: segs.length });
        var pcm = dec.segment(segs[i][0], segs[i][1]);
        var p;
        try { p = asrOne(pcm, modelId, opts.lang, opts.onProgress); } catch (e) { fail(e); return; }
        p.then(function (t) { texts.push(String(t).trim()); i++; next(); }, fail);
      })();
    });
  }

  /* ── พื้นที่เก็บโมเดล ── */
  var MODEL_CACHE = 'transformers-cache';
  var persistAsked = false;
  function persistOnce() {
    if (persistAsked) return;
    persistAsked = true;
    try {
      var S = navigator.storage;
      if (!S || !S.persist) return;
      (S.persisted ? S.persisted() : Promise.resolve(false)).then(function (p) { return p || S.persist(); }).catch(function () {});
    } catch (e) {}
  }
  /* → { modelBytes, modelFiles, usage, quota, persisted } (ค่าที่หาไม่ได้ = null) */
  function modelCacheInfo() {
    var S = navigator.storage, out = { modelBytes: null, modelFiles: 0, usage: null, quota: null, persisted: null };
    var est = S && S.estimate ? S.estimate().then(function (e) { out.usage = e.usage; out.quota = e.quota; }, function () {}) : Promise.resolve();
    var per = S && S.persisted ? S.persisted().then(function (p) { out.persisted = p; }, function () {}) : Promise.resolve();
    var cache = !window.caches ? Promise.resolve() : caches.has(MODEL_CACHE).then(function (has) {
      if (!has) { out.modelBytes = 0; return; }
      return caches.open(MODEL_CACHE).then(function (c) {
        return c.keys().then(function (reqs) {
          out.modelFiles = reqs.length;
          return Promise.all(reqs.map(function (r) {
            return c.match(r).then(function (res) {
              if (!res) return 0;
              var n = +res.headers.get('content-length');
              return n > 0 ? n : res.blob().then(function (b) { return b.size; });
            }).catch(function () { return 0; });
          })).then(function (sizes) { out.modelBytes = sizes.reduce(function (a, b) { return a + b; }, 0); });
        });
      });
    }).catch(function () {});
    return Promise.all([est, per, cache]).then(function () { return out; });
  }
  function clearModelCache() {
    budget.releaseAll(); // Worker ที่ถือโมเดลอยู่ปิดก่อน (ครั้งหน้าจะดาวน์โหลดใหม่)
    if (!window.caches) return Promise.resolve(false);
    return caches.delete(MODEL_CACHE);
  }

  window.TanotMedia = {
    BASE: BASE, RATE: RATE, SEGMENT_SEC: SEGMENT_SEC,
    isIOS: isIOS, isAndroid: isAndroid, isMobile: isMobile, device: device,
    error: mediaError, isMemoryError: isMemoryError, isDeviceLimit: isDeviceLimit, classify: classify, errorText: errorText,
    LOG_KEY: LOG_KEY, logError: logError, readLog: readLog, clearLog: clearLog,
    budget: budget,
    decode16k: decode16k, fromPcm: wrapPcm, planSegments: planSegments, quietCut: quietCut,
    transcribeLocal: transcribeLocal, cancelLocalAsr: function () { asrKill('abort'); },
    persistOnce: persistOnce, modelCacheInfo: modelCacheInfo, clearModelCache: clearModelCache
  };
})();
