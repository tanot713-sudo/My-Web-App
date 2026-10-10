/* ══════════════════════════════════════════════════════════════════
   media-core.js — ของกลางของงานเสียง/OCR ในเบราว์เซอร์ (window.TanotMedia)
   ใช้โดย text-to-speech.js, ai-chat-widget.js (shell.js ฉีดให้ทุกหน้า), file-reader.js/doc-check.js/receipts.js (บันทึกปัญหา OCR), data.js

   1) decode16k(arrayBuffer) — ถอดรหัสเสียงที่ 16kHz ตั้งแต่แรก (OfflineAudioContext(1, 1, 16000).decodeAudioData)
      เดิม decodeFileToPcm ถอดรหัสทั้งไฟล์ที่ความถี่เดิม (44.1/48kHz × 2 ช่อง) แล้วค่อย resample — ไฟล์ประชุม 1 ชม.
      ใช้แรม ~1.4GB แค่ขั้นนี้ (แท็บมือถือแครช) · 16kHz ตั้งแต่แรกเหลือ 1/3 และรวมเป็นโมโนทีละช่วงตอนส่ง (segment)
      ไม่สร้างสำเนาโมโนทั้งไฟล์ · ใช้ฟังก์ชันเดียวกันทั้งถอดเสียงคลาวด์/ในเบราว์เซอร์/ไมค์ของวิดเจ็ตแชท
   2) transcribeLocal() — Whisper ใน asr-worker.js (ไม่ใช่เธรดหลัก) ส่งทีละท่อน (≤ 30 วิ ตัดที่จุดเงียบ + เหลื่อม 1.5 วิ ด้วย AsrCalc.planChunks แบบเดียวกับคลาวด์ →
      ต่อด้วย AsrCalc.mergeChunks ตัดคำซ้ำที่รอยต่อ + เวลา segments จริงในไฟล์) แบบ transfer ArrayBuffer · เลิกใช้ chunk_length_s/stride_length_s ของ pipeline (เคยทำข้อความซ้ำที่รอยต่อ ~30 วิ) · ยกเลิกได้ (terminate Worker — WASM ที่กำลังคำนวณหยุดกลางทางได้ทางเดียว) · Worker พัง/
      หน่วยความจำไม่พอ → ปิดตัวที่พังทิ้ง ครั้งต่อไปสร้างใหม่ (โหลดโมเดลจากแคช)
      2026-10 Section 3: device:'auto' = ใช้ WebGPU เมื่อมี (webgpuPlan: navigator.gpu + requestAdapter ได้จริง + ไม่ใช่อะแดปเตอร์ซอฟต์แวร์, ไม่ใช่มือถือ/iOS) กับโมเดลตระกูล
      onnx-community · ล้มตอนโหลด/รัน → asr-worker.js ถอยกลับ WASM เอง 1 ครั้ง · เหตุการณ์ถอยลง problem log (ไม่มีเนื้อหา) และจำ 3 วัน (tanot:asr:gpubad, kind cache)
      ไม่ให้ลองซ้ำทุกครั้ง · transcribeLocalDetailed ได้ { text, segments[{start,end,text}], device, modelId } (เวลาของแต่ละช่วงคำพูดสำหรับย่อหน้า/[hh:mm:ss])
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
      noWorker: 'สร้าง Web Worker ไม่ได้',
      webgpu: 'WebGPU ใช้ไม่ได้บนเครื่องนี้ — ถอยกลับไปใช้ WASM', modelFallback: 'โหลดโมเดลรุ่นใหม่ไม่ได้ — ใช้รุ่นเดิมแทน'
    },
    en: {
      oom: 'The browser ran out of memory for this model — try a smaller model, close other tabs, or use cloud mode',
      crash: 'The in-browser processor stopped part way (usually not enough memory) — try again with a smaller model, or use cloud mode',
      abort: 'Cancelled', evicted: 'Stopped to free memory for another task', decode: 'Could not decode this audio file — try another type (mp3/wav/mp4/webm)',
      noWorker: 'Could not create a Web Worker',
      webgpu: 'WebGPU is not usable on this device — falling back to WASM', modelFallback: 'Could not load the newer model — using the previous one instead'
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
  /* ctx: { stage, engine:'local'|'cloud', model, lang, device:'webgpu'|'wasm', file: File|{type,name,size,dur} } — ห้ามส่งข้อความ/เสียงของผู้ใช้มาที่นี่ */
  function logError(kind, err, ctx) {
    ctx = ctx || {};
    var code = classify(err);
    if (code === 'abort') return null; // ผู้ใช้ยกเลิกเอง ไม่ใช่ปัญหา
    var d = device();
    var row = {
      at: Date.now(), kind: String(kind || 'other'), stage: ctx.stage || '', engine: ctx.engine || '', model: ctx.model || '',
      lang: ctx.lang || '', device: ctx.device || '', code: code, name: scrub((err && (err.causeName || err.name)) || ''),
      msg: scrub((err && (err.causeMessage || err.message)) || err), page: (location.pathname.split('/').pop() || 'index.html'),
      ua: d.ua, mem: d.mem, cores: d.cores, online: navigator.onLine !== false, file: fileMeta(ctx.file)
    };
    var rows = readLog(); rows.push(row); writeLog(rows);
    return row;
  }
  /* บันทึกสถิติ/เหตุการณ์ที่ไม่ใช่ error (เช่น สรุปความเร็วหลังสร้างไฟล์เสียงเสร็จ) — แถวชนิดเดียวกับ logError แต่ code:'info' · info = ตัวเลข/รหัสสั้นๆ เท่านั้น ห้ามมีข้อความ/ชื่อไฟล์ของผู้ใช้ */
  function logNote(kind, ctx, info) {
    ctx = ctx || {};
    var d = device();
    var row = {
      at: Date.now(), kind: String(kind || 'other'), stage: ctx.stage || 'stats', engine: ctx.engine || '', model: ctx.model || '',
      lang: ctx.lang || '', device: ctx.device || '', code: 'info', name: '', msg: scrub(info), page: (location.pathname.split('/').pop() || 'index.html'),
      ua: d.ua, mem: d.mem, cores: d.cores, online: navigator.onLine !== false, file: null
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
  /* ── WebGPU (เฉพาะเครื่องคอม: ไม่ใช่มือถือ/iOS) ── */
  var GPU_BAD_KEY = 'tanot:asr:gpubad', GPU_BAD_MS = 3 * 24 * 3600 * 1000;
  function gpuBad() {
    try { var t = +localStorage.getItem(GPU_BAD_KEY); return t > 0 && Date.now() - t < GPU_BAD_MS; } catch (e) { return false; }
  }
  function markGpuBad() { try { localStorage.setItem(GPU_BAD_KEY, String(Date.now())); } catch (e) {} }
  var gpuPlanP = null;
  /* WebGPU สำหรับเสียงพูด (MMS-TTS, text-to-speech.js → tts-worker.js): แผนเดียวกับ webgpuPlan แต่ธงล้มแยกของเสียงพูด (คนละโมเดล/คนละ op กับ Whisper — ล้มฝั่งหนึ่งไม่ควรปิดอีกฝั่ง) · 3 วัน */
  var TTS_GPU_BAD_KEY = 'tanot:tts:gpubad';
  function ttsGpuBad() { try { var t = +localStorage.getItem(TTS_GPU_BAD_KEY); return t > 0 && Date.now() - t < GPU_BAD_MS; } catch (e) { return false; } }
  function markTtsGpuBad() { try { localStorage.setItem(TTS_GPU_BAD_KEY, String(Date.now())); } catch (e) {} }
  function ttsGpuPlan() {
    return webgpuPlan().then(function (p) { return p.ok && ttsGpuBad() ? { ok: false, f16: p.f16, reason: 'failed-before' } : p; });
  }
  /* → Promise<{ ok, f16, reason }> — ok เฉพาะเมื่อ adapter ได้จริง (navigator.gpu มีเฉยๆ ไม่พอ) และไม่ใช่ซอฟต์แวร์เรนเดอร์ */
  function webgpuPlan(force) {
    if (gpuPlanP && !force) return gpuPlanP;
    gpuPlanP = new Promise(function (resolve) {
      if (isMobile()) return resolve({ ok: false, f16: false, reason: 'mobile' });
      if (!navigator.gpu || !navigator.gpu.requestAdapter) return resolve({ ok: false, f16: false, reason: 'unsupported' });
      if (gpuBad()) return resolve({ ok: false, f16: false, reason: 'failed-before' });
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve({ ok: false, f16: false, reason: 'timeout' }); } }, 4000);
      Promise.resolve().then(function () { return navigator.gpu.requestAdapter(); }).then(function (ad) {
        if (done) return; done = true; clearTimeout(t);
        if (!ad) return resolve({ ok: false, f16: false, reason: 'no-adapter' });
        var soft = ad.isFallbackAdapter === true || (ad.info && ad.info.isFallbackAdapter === true);
        if (soft) return resolve({ ok: false, f16: false, reason: 'software' });
        resolve({ ok: true, f16: !!(ad.features && ad.features.has && ad.features.has('shader-f16')), reason: '' });
      }, function () { if (done) return; done = true; clearTimeout(t); resolve({ ok: false, f16: false, reason: 'error' }); });
    });
    return gpuPlanP;
  }
  /* โมเดลเริ่มต้นตามเครื่อง/ภาษา:
     • ภาษา = ไทย บนคอม (ไม่ใช่มือถือ) → Thonburian small (Tanotfin/distill-whisper-th-small-onnx) ทั้ง WebGPU และ WASM
     • WebGPU + แรมพอ → onnx-community/whisper-small (WebGPU ทำให้ตัวกลางเร็วพอ) · WebGPU แรมน้อย → base
     • WASM → ค่าเดิม (Xenova/whisper-tiny; มือถือ → base ตามที่หน้า text-to-speech ตัดสินใจ) — ตระกูล onnx-community บน WASM ยังไม่ใช่ค่าเริ่มต้น
       จนกว่า tools/media-eval/check-models.mjs ยืนยันชื่อ repo/ไฟล์กับ Hugging Face จริง
     ภาษาอังกฤษ/อัตโนมัติ/ไม่ระบุ = ค่าเดิมทุกกรณี (วิดเจ็ตแชท/languages.jsx ไม่เรียกฟังก์ชันนี้ — ยังใช้ Xenova/whisper-tiny) */
  var THAI_DEFAULT_MODEL = 'Tanotfin/distill-whisper-th-small-onnx';
  function asrDefaultModel(plan, lang) {
    if (lang === 'thai' && !isMobile()) return THAI_DEFAULT_MODEL;
    if (plan && plan.ok) {
      var mem = navigator.deviceMemory || 0; // เบราว์เซอร์รายงานสูงสุด 8
      return mem && mem < 8 ? 'onnx-community/whisper-base' : 'onnx-community/whisper-small';
    }
    return 'Xenova/whisper-tiny';
  }

  /* ส่ง 1 ช่วง → Promise<{ text, chunks?, device, modelId }> */
  function asrOne(pcm, modelId, lang, onProgress, extra) {
    extra = extra || {};
    return new Promise(function (resolve, reject) {
      var w = asrWorker(modelId), jobId = 'asr-' + (++asr.seq);
      var job = { resolve: resolve, reject: reject };
      asr.pending = job;
      function done() { w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); if (asr.pending === job) asr.pending = null; }
      function onMsg(e) {
        var m = e.data;
        if (!m || m.jobId !== jobId) return;
        if (m.type === 'model-progress') { if (onProgress) onProgress({ stage: 'model', file: m.file, progress: m.progress }); }
        else if (m.type === 'pipeline-ready') { if (onProgress) onProgress({ stage: 'ready', device: m.device, modelId: m.modelId }); }
        else if (m.type === 'fallback') {
          /* ถอยกลับอัตโนมัติ (WebGPU → WASM / รุ่นใหม่ → รุ่นเดิม) — บันทึกลง problem log โดยไม่มีเนื้อหาผู้ใช้ และแจ้งหน้า */
          var cause = { name: m.name || 'Error', message: m.message || '' };
          var fe = mediaError(m.what === 'device' ? 'webgpu' : 'model', m.what === 'device' ? T('webgpu') : T('modelFallback'), cause);
          if (m.what === 'device') markGpuBad();
          logError('asr', fe, { stage: (m.what === 'device' ? 'webgpu-' : 'model-') + (m.stage || 'load'), engine: 'local', model: m.what === 'model' ? m.from : (m.modelId || modelId), device: m.what === 'device' ? 'webgpu' : 'wasm', lang: extra.logLang });
          fe.mediaLogged = true;
          if (onProgress) onProgress({ stage: 'fallback', what: m.what, from: m.from, to: m.to });
        }
        else if (m.type === 'retry') {
          /* เครือข่ายสะดุดตอนโหลดโมเดล → Worker รอแล้วลองใหม่ 1 ครั้ง · บันทึกว่าลองซ้ำแล้ว (ไม่มีเนื้อหาผู้ใช้) */
          logNote('asr', { stage: 'load-retry', engine: 'local', model: m.modelId || modelId, device: m.device || 'wasm', lang: extra.logLang }, 'retry=1 network');
          if (onProgress) onProgress({ stage: 'retry', modelId: m.modelId || modelId });
        }
        else if (m.type === 'result') { done(); resolve({ text: m.text || '', chunks: m.chunks, device: m.device || 'wasm', modelId: m.modelId || modelId }); }
        else if (m.type === 'error') {
          done();
          var cause2 = { name: m.name || 'Error', message: m.message || '' };
          var oom = m.oom || isMemoryError(cause2);
          if (oom) asrKill(); // หน่วยความจำของ Worker นี้เสียแล้ว — ทิ้งทั้งตัว
          reject(mediaError(oom ? 'oom' : 'asr', oom ? T('oom') : m.message, cause2));
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
      var msg = { type: 'transcribe', jobId: jobId, pcm: pcm, lang: lang, modelId: modelId };
      if (extra.device) msg.device = extra.device;
      if (extra.timestamps) msg.timestamps = true;
      w.postMessage(msg, [pcm.buffer]);
    });
  }
  /* ท่อนถอดเสียงในเบราว์เซอร์: Whisper รับ ≤ 30 วิต่อหน้าต่าง → step 25 + ค้นจุดเงียบ ±3 + เหลื่อมหลัง 1.5 = ยาวสุด 29.5 วิ (ท่อนสุดท้ายก้อนท้าย ≤ 3 วิ รวมเข้าท่อนก่อนหน้า: 25 + 3 + 1.5 = 29.5)
     คลาวด์ใช้ค่าเริ่มต้นของ AsrCalc (step 28) ได้เพราะ Whisper large-v3-turbo ที่ Workers AI รับยาวกว่า · ที่นี่ต้องไม่เกิน 30 วิจริง ไม่งั้น feature extractor ของ Whisper ตัดท้ายทิ้ง */
  var ASR_CHUNK = { stepSec: 25, searchSec: 3, overlapSec: 1.5, tailMinSec: 3 };
  function ensureAsrCalc() {
    if (window.AsrCalc) return Promise.resolve(window.AsrCalc);
    return new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = BASE + 'asr-calc.js';
      sc.onload = function () { window.AsrCalc ? resolve(window.AsrCalc) : reject(mediaError('asr', 'asr-calc.js')); };
      sc.onerror = function () { reject(mediaError('asr', 'asr-calc.js')); };
      document.head.appendChild(sc);
    });
  }
  /* → [{ a, b, start, end, ov }] (ดัชนี sample) — ตัดที่จุดเงียบที่สุดในรัศมี ±3 วิรอบเป้า */
  function planAsrChunks(dec, o) {
    var A = window.AsrCalc, frame = Math.round(RATE * 0.02), c = o || ASR_CHUNK;
    return A.planChunks(dec.length, {
      rate: RATE, stepSec: c.stepSec, searchSec: c.searchSec, overlapSec: c.overlapSec, tailMinSec: c.tailMinSec,
      cutAt: function (target, lo, hi) { var win = dec.segment(lo, hi); return lo + quietCut(win, 0, win.length, frame); }
    });
  }
  /* opts: { dec (จาก decode16k) | pcm, modelId, lang:'auto'|'thai'|…, device:'auto'|'wasm' (ไม่ส่ง = 'wasm' เหมือนเดิม), timestamps,
             onProgress({stage:'model'|'segment'|'ready'|'fallback'|'retry', …}) — 'segment' = ท่อนที่ i จาก n, signal }
     → Promise<{ text, segments:[{start,end,text}], device, modelId, chunks }> · ยกเลิก (signal.abort()) = terminate Worker ทันที */
  function transcribeLocalDetailed(opts) {
    var dec = opts.dec || wrapPcm(opts.pcm);
    var modelId = opts.modelId || 'Xenova/whisper-tiny';
    var chunks = [], results = [], i = 0, usedDevice = 'wasm', usedModel = modelId;
    persistOnce();
    return new Promise(function (resolve, reject) {
      var finished = false;
      function fail(e) { if (finished) return; finished = true; reject(e); }
      if (opts.signal) {
        if (opts.signal.aborted) { fail(mediaError('abort')); return; }
        opts.signal.addEventListener('abort', function () { asrKill('abort'); fail(mediaError('abort')); });
      }
      var M = window.TanotMediaModels;
      var devP = opts.device === 'auto' && M && M.asrWebgpuCapable(modelId)
        ? webgpuPlan().then(function (p) { return p.ok && (!M.asrInfo(modelId).f16 || p.f16) ? 'webgpu' : 'wasm'; })
        : Promise.resolve('wasm');
      Promise.all([devP, ensureAsrCalc()]).then(function (r) {
        var device = r[0];
        chunks = planAsrChunks(dec);
        function next() {
          if (finished) return;
          if (i >= chunks.length) {
            finished = true;
            var merged = window.AsrCalc.mergeChunks(results); // ตัดคำซ้ำที่รอยต่อ + เวลา segments จริงในไฟล์
            resolve({ text: merged.text, segments: merged.segments, device: usedDevice, modelId: usedModel, chunks: chunks.length });
            return;
          }
          if (opts.onProgress) opts.onProgress({ stage: 'segment', i: i + 1, n: chunks.length });
          var c = chunks[i], pcm = dec.segment(c.a, c.b), p;
          try { p = asrOne(pcm, modelId, opts.lang, opts.onProgress, { device: device, timestamps: opts.timestamps, logLang: opts.lang }); } catch (e) { fail(e); return; }
          p.then(function (res) {
            usedDevice = res.device; usedModel = res.modelId;
            var dur = (c.b - c.a) / RATE, segs = [];
            (res.chunks || []).forEach(function (ck) {
              var ct = String(ck.text || '').trim();
              if (!ct) return;
              var st = +ck.start || 0;
              segs.push({ start: st, end: Math.max(st, ck.end != null ? +ck.end : Math.min(dur, st + 5)), text: ct });
            });
            results.push({ offset: c.a / RATE, text: String(res.text || '').trim(), segments: segs, duration: dur });
            i++; next();
          }, fail);
        }
        next();
      }, fail);
    });
  }
  /* เหมือนเดิม: คืนข้อความล้วน (วิดเจ็ตแชท / languages.jsx ใช้) */
  function transcribeLocal(opts) { return transcribeLocalDetailed(opts).then(function (r) { return r.text; }); }

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
    LOG_KEY: LOG_KEY, logError: logError, logNote: logNote, readLog: readLog, clearLog: clearLog,
    budget: budget,
    decode16k: decode16k, fromPcm: wrapPcm, planSegments: planSegments, planAsrChunks: planAsrChunks, ASR_CHUNK: ASR_CHUNK, quietCut: quietCut,
    transcribeLocal: transcribeLocal, transcribeLocalDetailed: transcribeLocalDetailed, webgpuPlan: webgpuPlan, ttsGpuPlan: ttsGpuPlan, markTtsGpuBad: markTtsGpuBad, asrDefaultModel: asrDefaultModel, cancelLocalAsr: function () { asrKill('abort'); },
    persistOnce: persistOnce, modelCacheInfo: modelCacheInfo, clearModelCache: clearModelCache
  };
})();
