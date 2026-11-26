/* ══════════════════════════════════════════════════════════════════
   lang-tts.js — เสียงอ่านจากโมเดลของหน้าเรียนภาษา (ROADMAP แถว 27 / docs/languages-design.md L6)
   window.TanotLangTts — languages.jsx เรียกจาก speak() ที่เดียว

   • ค่าเริ่มต้น = เสียงของเครื่อง (speechSynthesis) · ใช้โมเดล MMS-TTS เมื่อ (ก) เครื่องไม่มีเสียงของภาษานั้น หรือ (ข) ผู้ใช้เลือก "เสียงโมเดล" ของภาษานั้นเอง
   • ตารางโมเดล + การกรองข้อความด้วย vocab อยู่ใน media-models.js (LANG_TTS / langTtsChunks) ที่เดียว
   • สังเคราะห์ใน tts-worker.js ตัวเดียวกับหน้า text-to-speech (Worker 1 ตัว โมเดลเดียวต่อครั้ง) · ลงทะเบียน TanotMedia.budget id 'tts-lang'
     (มือถือมีโมเดลในเบราว์เซอร์ได้ครั้งละ 1 ตัว) · โมเดลไม่ใช่ของ Tanotfin → โหลดตรงจาก huggingface.co (useHfProxy ไม่แตะ) แคชใน transformers-cache
   • ล้ม (โหลดไม่ได้/หน่วยความจำ/Worker พัง) = แจ้งผ่าน on() ให้หน้าแสดงข้อความ + เรียก fallback() (เสียงเครื่อง) + problem log ไม่มีข้อความผู้ใช้
     แล้วจำไว้ทั้งการเปิดหน้านี้ว่าภาษานั้นใช้โมเดลไม่ได้ (ครั้งต่อไปใช้เสียงเครื่องเลย ไม่โหลดซ้ำทุกครั้งที่กด)
   • คีย์ lang-practice:ttsvoice (local — เสียงที่เครื่องมีต่างกันทุกเครื่อง): { <รหัสภาษา>: 'model' } เฉพาะภาษาที่ผู้ใช้เลือกเสียงโมเดล */
(function () {
  'use strict';
  var PREF_KEY = 'lang-practice:ttsvoice';
  var BUDGET_ID = 'tts-lang';
  var subs = [];
  var failed = {};          // รหัสภาษา → true: ล้มแล้วในการเปิดหน้านี้
  var worker = null, workerModel = null, busy = false;
  var job = null;           // { id, key, model, n, done, fallback }
  var jobSeq = 0;
  var audioCtx = null, sources = [], nextAt = 0;

  function M() { return window.TanotMediaModels || null; }
  function TM() { return window.TanotMedia || null; }
  function info(code) { var m = M(); return m && m.langTtsInfo ? m.langTtsInfo(code) : null; }
  function emit(ev) { subs.slice().forEach(function (fn) { try { fn(ev); } catch (e) {} }); }

  function readPrefs() {
    try { var v = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
  }
  function pref(code) { var i = info(code); return i && readPrefs()[i.key] === 'model' ? 'model' : 'device'; }
  function setPref(code, v) {
    var i = info(code); if (!i) return;
    var p = readPrefs(); // อ่านสด → แก้ → เขียน
    if (v === 'model') p[i.key] = 'model'; else delete p[i.key];
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {}
    emit({ type: 'pref', code: code });
  }

  /* เครื่องมีเสียงของภาษานี้ไหม: true / false (ไม่มี speechSynthesis หรือรายชื่อเสียงไม่มีภาษานี้ — รายชื่อว่างนับเป็นไม่มี) */
  function deviceVoice(code) {
    try {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
      var voices = window.speechSynthesis.getVoices() || [];
      var prefix = String(code || '').split('-')[0].toLowerCase();
      return voices.some(function (v) { return v.lang && v.lang.toLowerCase().split(/[-_]/)[0] === prefix; });
    } catch (e) { return false; }
  }
  function usable(code) { var i = info(code); return !!(i && !failed[i.key]); }
  function useModel(code) { return usable(code) && (pref(code) === 'model' || !deviceVoice(code)); }

  function unlockAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (e) {} }
    return audioCtx;
  }
  function stopAudio() {
    sources.slice().forEach(function (s) { try { s.onended = null; s.stop(); } catch (e) {} });
    sources = []; nextAt = 0;
  }
  function killWorker() {
    if (worker) { try { worker.terminate(); } catch (e) {} }
    worker = null; workerModel = null; busy = false;
    var tm = TM(); if (tm) tm.budget.release(BUDGET_ID);
  }
  function getWorker(model) {
    if (worker && workerModel !== model) killWorker(); // ภาษาใหม่ = ปิดโมเดลเดิมก่อน (ไม่ถือ 2 โมเดลในหน่วยความจำ)
    if (!worker) {
      var tm = TM();
      if (tm) tm.budget.acquire(BUDGET_ID, function () { worker && stop(); killWorker(); });
      worker = new Worker('./tts-worker.js', { type: 'module' });
      workerModel = model;
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', function (e) {
        if (e && e.preventDefault) e.preventDefault();
        fail({ name: 'WorkerError', message: (e && e.message) || 'worker crashed', code: 'crash' }, 'worker', true);
      });
    }
    return worker;
  }

  function play(samples, rate) {
    var ctx = unlockAudio();
    if (!ctx) return;
    var buf = ctx.createBuffer(1, samples.length, rate);
    buf.getChannelData(0).set(samples);
    var src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination);
    var at = Math.max(ctx.currentTime, nextAt);
    src.start(at);
    nextAt = at + buf.duration + 0.15;
    sources.push(src);
    src.onended = function () {
      var k = sources.indexOf(src); if (k >= 0) sources.splice(k, 1);
      if (!sources.length && !job) emit({ type: 'idle' });
    };
  }

  /* kind: missing (404/403) · network · oom · crash · other — หน้าแปลเป็นข้อความเอง */
  function fail(cause, stage, dropWorker) {
    var j = job; job = null;
    var tm = TM();
    var kind = cause && cause.loadFail ? cause.loadFail : (cause && cause.code === 'crash') ? 'crash' : (tm && tm.isMemoryError && tm.isMemoryError(cause)) ? 'oom' : 'other';
    var key = j ? j.key : null, model = j ? j.model : workerModel;
    if (key) failed[key] = true;
    if (tm) tm.logError('tts', { name: (cause && cause.name) || 'Error', message: (cause && cause.message) || '', code: kind === 'crash' ? 'crash' : undefined }, { stage: stage, engine: 'local', model: model || '', lang: key || '' });
    if (dropWorker || kind !== 'other') killWorker();
    stopAudio();
    emit({ type: 'error', code: key, kind: kind });
    if (j && j.fallback) { try { j.fallback(); } catch (e) {} }
  }

  function onMessage(e) {
    var msg = e.data;
    if (!msg) return;
    if (msg.type === 'batch-done') { busy = false; return; }
    if (!job || msg.jobId !== job.id) return;
    if (msg.type === 'model-progress') {
      emit({ type: 'loading', code: job.key, progress: msg.progress != null ? Math.round(msg.progress) : null });
    } else if (msg.type === 'item-done') {
      if (job.done === 0) emit({ type: 'speaking', code: job.key });
      play(msg.audio, msg.samplingRate);
      if (++job.done >= job.n) job = null;
    } else if (msg.type === 'item-error') {
      fail({ name: msg.name, message: msg.message, loadFail: msg.loadFail }, msg.loadFail ? 'model-load' : 'synth', false);
    }
  }

  function stop() {
    stopAudio();
    if (job || busy) killWorker(); // Worker รับงานได้ทีละงาน — งานค้างต้องปิดทิ้ง
    job = null;
  }

  /* เรียกในจังหวะคลิก (AudioContext ต้องปลดล็อกตอนนั้น) · คืน false = ไม่มีอะไรให้โมเดลพูด (ภาษาไม่มีโมเดล/ข้อความกรองแล้วว่าง) → ผู้เรียกใช้เสียงเครื่อง */
  function speak(text, code, opts) {
    var i = info(code), m = M();
    if (!i || failed[i.key] || !m) return false;
    var chunks = m.langTtsChunks(code, text);
    if (!chunks.length) return false;
    stop();
    unlockAudio();
    var w;
    try { w = getWorker(i.model); } catch (err) {
      job = { id: 0, key: i.key, model: i.model, n: 0, done: 0, fallback: opts && opts.fallback };
      fail({ name: (err && err.name) || 'Error', message: (err && err.message) || 'no worker', code: 'crash' }, 'worker', true);
      return true;
    }
    job = { id: ++jobSeq, key: i.key, model: i.model, n: chunks.length, done: 0, fallback: opts && opts.fallback };
    busy = true;
    emit({ type: 'loading', code: i.key, progress: null });
    w.postMessage({ type: 'synthesize-batch', jobId: job.id, modelId: i.model, items: chunks.map(function (t, k) { return { i: k, text: t }; }) });
    return true;
  }

  if (window.speechSynthesis && window.speechSynthesis.addEventListener) {
    try { window.speechSynthesis.addEventListener('voiceschanged', function () { emit({ type: 'voices' }); }); } catch (e) {}
  }

  window.TanotLangTts = {
    has: function (code) { return !!info(code); },
    usable: usable,
    deviceVoice: deviceVoice,
    useModel: useModel,
    pref: pref,
    setPref: setPref,
    speak: speak,
    stop: stop,
    on: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; }
  };
})();
