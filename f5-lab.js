/* ══════════════════════════════════════════════════════════════════
   f5-lab.js — หน้าทดลอง "F5 ในเบราว์เซอร์" (f5-lab.html): สร้างเสียงไทยด้วย F5-TTS-THAI v1 (ONNX) บนเครื่องผู้ใช้ทั้งหมด ผ่าน WebGPU
   เป้าหมาย = วัดว่า iPhone (Safari) และคอมทำได้จริงไหม เร็วแค่ไหน — ยังไม่ใช่ฟีเจอร์หลัก (ไม่อยู่ในเมนู ลิงก์จากการ์ด F5 ใน text-to-speech.html)
   • ตรรกะข้อความ/ความยาว/เสียงตัวอย่าง = f5-calc.js (ตรงกับ Colab — tests/fixtures/f5-thai.json) · รันโมเดล = f5-engine.js ใน f5-worker.js
     (Worker ไม่มี navigator.gpu แต่หน้ามี → รัน engine บนเธรดหลักแทน)
   • ไม่ fallback ไป CPU เอง (ช้ามาก ~2 นาที/ประโยค) — มีปุ่ม "ลองบน CPU" ให้กดเองพร้อมคำเตือนเมื่อไม่มี WebGPU
   • เสียงตัวอย่าง: IndexedDB 'tanot-f5-lab' (store voices: {id, name, text, pcm Float32 24 kHz ที่ตัดเงียบแล้ว, sec, at}) — ไม่อยู่ใน data-registry
     ตั้งใจ: ไม่ซิงก์/ไม่สำรอง/ไม่ย้าย ไม่ออกนอกเครื่อง · ข้อความที่พิมพ์ก็ไม่ถูกเก็บ/ส่งไปไหน
   • ผลวัด/ข้อผิดพลาดลง tanot:media:log (TanotMedia.logNote/logError, kind 'f5') — ตัวเลข/รหัสเท่านั้น ไม่มีข้อความหรือเสียงของผู้ใช้
   • คีย์: tanot:f5lab:ui (cache — รุ่นที่เลือก + เสียงที่เลือก) */
(function () {
  'use strict';
  var C = window.TanotF5Calc, Norm = window.TanotTtsNorm, TM = window.TanotMedia, I18N = window.OME_I18N;
  var UI_KEY = 'tanot:f5lab:ui', DB = 'tanot-f5-lab', STORE = 'voices';
  var MB = 1024 * 1024;

  var T = I18N.scope('f5lab', {
    th: {
      docTitle: 'F5 ในเบราว์เซอร์ (ทดลอง) | Tanot', crumb: 'ตำแหน่ง', back: 'แปลงเสียง ↔ ข้อความ', title: 'F5 ในเบราว์เซอร์', lab: 'ทดลอง',
      colab: 'ใช้ Google Colab', cpu: 'ลองบน CPU (ช้ามาก)', model: 'โมเดล', need: 'ขนาดที่ต้องโหลด', cached: 'โหลดไว้ในเครื่อง',
      load: 'โหลดโมเดล', stop: 'หยุด', clear: 'ลบโมเดลที่โหลดไว้', license: 'ใช้ส่วนตัว/ไม่แสวงกำไรเท่านั้น (CC BY-NC 4.0)', credits: 'เครดิต',
      voices: 'เสียงตัวอย่าง', noVoice: 'ยังไม่มีเสียงตัวอย่าง', addVoice: 'เพิ่มเสียงตัวอย่าง', consent: 'ใช้เสียงที่สร้างเองหรือได้รับอนุญาตเท่านั้น',
      vFile: 'ไฟล์เสียง (wav / mp3 / m4a)', vName: 'ชื่อเสียง', vText: 'ข้อความที่พูดในไฟล์ (ตรงทุกคำ)', vSave: 'บันทึกเสียงตัวอย่าง',
      gen: 'สร้างเสียง', text: 'ข้อความ', genBtn: 'สร้างและฟัง', wav: 'ดาวน์โหลด WAV', stats: 'ผลวัด', copy: 'คัดลอกผลวัด',
      use: 'ใช้', inUse: 'ใช้อยู่', del: 'ลบเสียง {name}', sec: '{n} วิ',
      mb: '≈ {n} MB', none: 'ยังไม่มี', partial: 'บางส่วน {n} MB', full: 'ครบ {n} MB',
      noGpu: 'เบราว์เซอร์นี้ใช้ WebGPU ไม่ได้ — ลองบน Safari/Chrome รุ่นที่มี WebGPU (แนะนำรุ่น q4) หรือใช้ Google Colab',
      noF16: 'GPU นี้ไม่รองรับ shader-f16 — รุ่น fp16 อาจสร้าง session ไม่ได้ แนะนำ q4',
      noProxy: 'โหลดโมเดลได้เฉพาะบนเว็บหลัก (pages.dev)', noCache: 'เบราว์เซอร์นี้ไม่มี Cache Storage — โหลดโมเดลใหม่ทุกครั้งที่เปิดหน้า',
      cpuOn: 'กำลังใช้ CPU (WASM) — ช้ามาก',
      cpuWarn: 'CPU ช้ามาก (ประมาณ 2 นาทีต่อประโยค) และเครื่องอาจร้อน — ใช้ CPU ต่อไหม?', cpuOk: 'ใช้ CPU',
      clearAsk: 'ลบไฟล์โมเดล F5 ที่โหลดไว้ทั้งหมดในเครื่องนี้?', cleared: 'ลบโมเดลแล้ว',
      dl: 'กำลังโหลด {file} {pct}% ({got}/{total} MB)', dlNoTotal: 'กำลังโหลด {file} ({got} MB)', fromCache: 'อ่าน {file} จากเครื่อง',
      session: 'กำลังสร้าง session…', ready: 'พร้อม: {variant} · {device}', readyCache: 'พร้อม: {variant} · {device} (จากเครื่อง)',
      loadStopped: 'หยุดโหลดแล้ว', space: 'พื้นที่ว่างในเบราว์เซอร์อาจไม่พอ (เหลือ ≈ {free} MB ต้องใช้ ≈ {need} MB)',
      cacheFull: 'บันทึกโมเดลลงเครื่องไม่ได้ (พื้นที่ไม่พอ) — ใช้ได้รอบนี้ แต่ครั้งหน้าต้องโหลดใหม่',
      needVoice: 'เลือกหรือเพิ่มเสียงตัวอย่างก่อน', needText: 'พิมพ์ข้อความก่อน', nothing: 'ไม่มีข้อความที่อ่านได้',
      vNeedFile: 'เลือกไฟล์เสียง', vNeedText: 'พิมพ์ข้อความที่พูดในไฟล์', vDecoding: 'กำลังอ่านไฟล์เสียง…', vBad: 'อ่านไฟล์เสียงนี้ไม่ได้',
      vShort: 'เสียงตัวอย่างสั้นเกินไป (หลังตัดเงียบเหลือ {n} วิ)', vTooLong: 'เสียงตัวอย่างยาวเกินไป ({n} วิ) — ใช้ไม่เกิน 30 วิ',
      vLong: 'เสียงยาว {n} วิ — 3–5 วิจะสร้างเร็วขึ้นมาก', vSaved: 'บันทึกแล้ว ({n} วิ)', vDefault: 'เสียง {n}',
      gWait: 'กำลังเตรียมโมเดล…', gChunk: 'กำลังสร้างท่อนที่ {i}/{n} · step {k}/{of}', gDone: 'เสร็จ {n} ท่อน · เสียง {sec} วิ · ใช้ {gen} วิ',
      gStopped: 'หยุดแล้ว', tooLong: 'ท่อนยาวเกินที่โมเดลรับได้ — ใช้เสียงตัวอย่างที่สั้นลง',
      oom: 'หน่วยความจำไม่พอ — ลองรุ่น q4 ปิดแท็บอื่น หรือใช้ Google Colab', notFound: 'ไม่พบไฟล์โมเดล ({msg})',
      failed: 'ทำไม่สำเร็จ: {msg}', copied: 'คัดลอกแล้ว', copyFail: 'คัดลอกไม่ได้',
      sVariant: 'รุ่น', sDevice: 'อุปกรณ์', sWhere: 'รันที่', sAdapter: 'GPU', sF16: 'shader-f16', sIo: 'tensor ระหว่าง step', sFiles: 'เวลาโหลดไฟล์',
      sSession: 'เวลาสร้าง session', sFirst: 'เวลาถึงเสียงแรก', sStep: 'ms/step เฉลี่ย', sRtf: 'RTF (เวลาสร้าง/ความยาวเสียง)', sAudio: 'ความยาวเสียง',
      sChunks: 'จำนวนท่อน', sRef: 'เสียงตัวอย่าง', worker: 'Worker', page: 'หน้าเว็บ', yes: 'มี', no: 'ไม่มี', onGpu: 'อยู่บน GPU', onCpu: 'คัดลอกผ่าน CPU',
      fromCacheShort: '{t} (จากเครื่อง)'
    },
    en: {
      docTitle: 'F5 in the browser (lab) | Tanot', crumb: 'Breadcrumb', back: 'Speech ↔ text', title: 'F5 in the browser', lab: 'Lab',
      colab: 'Use Google Colab', cpu: 'Try on CPU (very slow)', model: 'Model', need: 'Download size', cached: 'Stored on this device',
      load: 'Load model', stop: 'Stop', clear: 'Delete downloaded model', license: 'Personal / non-commercial use only (CC BY-NC 4.0)', credits: 'Credits',
      voices: 'Reference voices', noVoice: 'No reference voice yet', addVoice: 'Add a reference voice', consent: 'Only use voices you made yourself or have permission to use',
      vFile: 'Audio file (wav / mp3 / m4a)', vName: 'Voice name', vText: 'Exact words spoken in the file', vSave: 'Save reference voice',
      gen: 'Generate speech', text: 'Text', genBtn: 'Generate and play', wav: 'Download WAV', stats: 'Measurements', copy: 'Copy measurements',
      use: 'Use', inUse: 'In use', del: 'Delete voice {name}', sec: '{n} s',
      mb: '≈ {n} MB', none: 'Not yet', partial: 'Partial {n} MB', full: 'Complete {n} MB',
      noGpu: 'This browser cannot use WebGPU — try a Safari/Chrome version with WebGPU (q4 recommended) or use Google Colab',
      noF16: 'This GPU lacks shader-f16 — the fp16 model may fail to create a session; q4 is recommended',
      noProxy: 'The model can only be downloaded on the main site (pages.dev)', noCache: 'This browser has no Cache Storage — the model is downloaded every visit',
      cpuOn: 'Using the CPU (WASM) — very slow',
      cpuWarn: 'The CPU is very slow (about 2 minutes per sentence) and the device may get hot — use the CPU anyway?', cpuOk: 'Use CPU',
      clearAsk: 'Delete all downloaded F5 model files on this device?', cleared: 'Model deleted',
      dl: 'Downloading {file} {pct}% ({got}/{total} MB)', dlNoTotal: 'Downloading {file} ({got} MB)', fromCache: 'Reading {file} from this device',
      session: 'Creating sessions…', ready: 'Ready: {variant} · {device}', readyCache: 'Ready: {variant} · {device} (from this device)',
      loadStopped: 'Download stopped', space: 'Browser storage may be too small (≈ {free} MB free, ≈ {need} MB needed)',
      cacheFull: 'Could not store the model on this device (out of space) — works now, but it will download again next time',
      needVoice: 'Pick or add a reference voice first', needText: 'Type some text first', nothing: 'Nothing readable in the text',
      vNeedFile: 'Pick an audio file', vNeedText: 'Type the words spoken in the file', vDecoding: 'Reading the audio file…', vBad: 'Cannot read this audio file',
      vShort: 'Reference voice too short ({n} s after trimming silence)', vTooLong: 'Reference voice too long ({n} s) — use 30 s or less',
      vLong: 'The voice is {n} s long — 3–5 s generates much faster', vSaved: 'Saved ({n} s)', vDefault: 'Voice {n}',
      gWait: 'Preparing the model…', gChunk: 'Generating chunk {i}/{n} · step {k}/{of}', gDone: 'Done: {n} chunks · {sec} s of audio · took {gen} s',
      gStopped: 'Stopped', tooLong: 'A chunk is longer than the model accepts — use a shorter reference voice',
      oom: 'Out of memory — try q4, close other tabs, or use Google Colab', notFound: 'Model file not found ({msg})',
      failed: 'Failed: {msg}', copied: 'Copied', copyFail: 'Cannot copy',
      sVariant: 'Model', sDevice: 'Device', sWhere: 'Runs in', sAdapter: 'GPU', sF16: 'shader-f16', sIo: 'Tensors between steps', sFiles: 'File load time',
      sSession: 'Session creation', sFirst: 'Time to first audio', sStep: 'Avg ms/step', sRtf: 'RTF (generation time / audio length)', sAudio: 'Audio length',
      sChunks: 'Chunks', sRef: 'Reference voice', worker: 'Worker', page: 'Page', yes: 'Yes', no: 'No', onGpu: 'Stay on the GPU', onCpu: 'Copied via the CPU',
      fromCacheShort: '{t} (from this device)'
    }
  });
  window.OME_PAGE_LIVE_LANG = true;

  function $(id) { return document.getElementById(id); }
  function now() { return performance.now(); }
  function fmt(n, d) { return n == null || !isFinite(n) ? '—' : I18N.number(n, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function secTxt(ms) { return ms == null ? '—' : T('sec', { n: fmt(ms / 1000, ms < 10000 ? 2 : 1) }); }
  function readUi() { try { var v = JSON.parse(localStorage.getItem(UI_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify({ variant: st.variant, voice: st.voiceId })); } catch (e) {} }

  var ui = readUi();
  var st = {
    variant: ui.variant === 'fp16' ? 'fp16' : 'q4', voiceId: ui.voice || null, device: 'webgpu', where: 'worker',
    caps: null, cache: {}, loaded: null, loading: null, gen: null, voices: [], ctx: null, wavUrl: null, stats: {},
    worker: null, eng: null, send: null, ready: null, switched: false
  };

  /* ── engine (Worker หรือเธรดหลัก) ── */
  function startEngine() {
    if (st.ready) return st.ready;
    st.ready = new Promise(function (resolve) {
      st.onCaps = resolve;
      var w = null;
      try { w = new Worker('./f5-worker.js', { type: 'module' }); } catch (e) { w = null; }
      if (!w) { pageEngine(); return; }
      st.worker = w; st.where = 'worker';
      w.onmessage = function (e) { onMsg(e.data || {}); };
      w.onerror = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        killEngine();
        fail('worker', { name: 'MediaError', code: 'crash', message: (e && e.message) || 'worker crashed' });
      };
      st.send = function (m, tr) { w.postMessage(m, tr || []); };
      st.send({ cmd: 'init', hfProxy: window.TANOT_HF_PROXY || null });
    });
    return st.ready;
  }
  function loadScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function pageEngine() {
    st.where = 'page';
    (window.TanotF5Engine ? Promise.resolve() : loadScript('f5-engine.js')).then(function () {
      var eng = window.TanotF5Engine.create(function (m) { Promise.resolve().then(function () { onMsg(m); }); });
      var q = Promise.resolve();
      st.eng = eng;
      st.send = function (m) { if (m.cmd === 'cancel') eng.cancel(); else q = q.then(function () { return eng.handle(m); }); };
      st.send({ cmd: 'init' });
    }, function (e) { fail('init', e); });
  }
  function killEngine() {
    if (st.worker) { try { st.worker.terminate(); } catch (e) {} }
    if (st.eng) { try { st.eng.cancel(); st.eng.handle({ cmd: 'dispose' }); } catch (e) {} }
    st.worker = null; st.eng = null; st.send = null; st.ready = null; st.loaded = null;
    if (st.loading) { st.loading.reject({ code: 'abort', name: 'AbortError', message: 'released' }); st.loading = null; }
    if (st.gen) endGen(T('gStopped'));
  }
  function send(m, tr) { return startEngine().then(function () { st.send(m, tr); }); }

  function onMsg(m) {
    if (m.type === 'caps') {
      // Worker ไม่มี WebGPU แต่หน้ามี → ใช้ engine บนเธรดหลัก (ครั้งเดียว)
      if (st.where === 'worker' && !m.gpu && navigator.gpu && !st.switched) {
        st.switched = true;
        try { st.worker.terminate(); } catch (e) {}
        st.worker = null;
        pageEngine();
        return;
      }
      st.caps = m;
      if (st.onCaps) { st.onCaps(); st.onCaps = null; }
      renderEnv(); renderStats();
      refreshCache();
    } else if (m.type === 'cache') {
      st.cache[m.variant] = m; renderModel(); renderEnv();
    } else if (m.type === 'progress') {
      onProgress(m);
    } else if (m.type === 'warn') {
      if (m.code === 'cacheFull') setStatus('modelStatus', function () { return T('cacheFull'); }, 'warn');
    } else if (m.type === 'loaded') {
      st.loaded = { variant: m.variant, device: m.device, ioGpu: m.ioGpu };
      if (!m.reused) {
        st.stats.files = m.ms && m.ms.files; st.stats.fromCache = m.fromCache; st.stats.session = m.ms && m.ms.session; st.stats.ioGpu = m.ioGpu;
        st.stats.variant = m.variant; st.stats.device = m.device;
        TM && TM.logNote('f5', { stage: 'load', model: 'f5-' + m.variant, device: m.device, engine: 'local' },
          'where=' + st.where + ' files=' + Math.round(m.ms.files) + 'ms cache=' + (m.fromCache ? 1 : 0) + ' session=' + Math.round(m.ms.session) +
          'ms pre=' + Math.round(m.ms.pre) + ' tr=' + Math.round(m.ms.tr) + ' dec=' + Math.round(m.ms.dec) + ' io=' + (m.ioGpu ? 'gpu' : 'cpu') +
          ' in=' + [m.inputs && m.inputs.audio, m.inputs && m.inputs.text_ids, m.inputs && m.inputs.noise, m.inputs && m.inputs.time_step].join('/'));
      }
      $('dlMeter').hidden = true;
      var fromCache = m.fromCache || m.reused;
      setStatus('modelStatus', function () { return T(fromCache ? 'readyCache' : 'ready', { variant: m.variant, device: m.device }); }, 'ok');
      if (st.loading) { st.loading.resolve(); st.loading = null; }
      renderStats(); refreshCache(); renderBusy();
    } else if (m.type === 'step') {
      onStep(m);
    } else if (m.type === 'chunk') {
      onChunk(m);
    } else if (m.type === 'done') {
      onDone(m);
    } else if (m.type === 'cancelled') {
      if (st.loading) { st.loading.reject({ code: 'abort', name: 'AbortError', message: 'cancelled' }); st.loading = null; setStatus('modelStatus', function () { return T('loadStopped'); }); $('dlMeter').hidden = true; }
      if (st.gen) endGen(T('gStopped'));
      renderBusy();
    } else if (m.type === 'cleared') {
      st.loaded = null; st.cache = {};
      setStatus('modelStatus', function () { return T('cleared'); }, 'ok');
      refreshCache(); renderStats();
    } else if (m.type === 'error') {
      fail(m.stage, m);
    }
  }

  /* ── สถานะ/ข้อผิดพลาด ── */
  function setStatus(id, fn, kind) {
    var el = $(id);
    el.className = 'status' + (kind ? ' ' + kind : '');
    I18N.live(el, fn || null);
    if (!fn) el.textContent = '';
  }
  function errText(e) {
    var c = TM ? TM.classify(e) : (e && e.code) || '';
    if (c === 'session') return TM.errorText(e);
    if (c === 'oom') return T('oom');
    if (e && e.code === 'noproxy') return T('noProxy');
    if (e && e.code === 'tooLong') return T('tooLong');
    if (e && e.code === 'http' && /404/.test(e.message || '')) return T('notFound', { msg: e.message });
    if (c === 'crash' && TM) return TM.errorText(e);
    return T('failed', { msg: (e && e.message) || String(e) });
  }
  function fail(stage, e) {
    var err = { name: (e && e.name) || 'Error', message: (e && e.message) || String(e), code: (e && e.code) || '' };
    if (TM) TM.logError('f5', err, { stage: stage || '', model: 'f5-' + st.variant, device: st.device, engine: 'local' });
    var target = stage === 'synth' || (st.gen && stage !== 'load') ? 'genStatus' : 'modelStatus';
    setStatus(target, function () { return errText(err); }, 'err');
    $('dlMeter').hidden = true;
    if (st.loading) { st.loading.reject(err); st.loading = null; }
    if (st.gen) endGen(null);
    renderBusy();
  }

  /* ── โมเดล ── */
  function refreshCache() { if (st.send) { st.send({ cmd: 'status', variant: 'q4' }); st.send({ cmd: 'status', variant: 'fp16' }); } }
  function cacheOf(v) { return st.cache[v] || null; }
  function needMb(v) { var c = cacheOf(v); return C.variantMb(v) + (c && c.wasm ? 0 : C.ORT_WASM_MB); }
  function renderModel() {
    var vs = $('variant').querySelectorAll('button');
    for (var i = 0; i < vs.length; i++) {
      var v = vs[i].getAttribute('data-v');
      vs[i].setAttribute('aria-pressed', v === st.variant ? 'true' : 'false');
      vs[i].textContent = v + ' · ' + T('mb', { n: fmt(C.variantMb(v)) });
    }
    $('needSize').textContent = T('mb', { n: fmt(needMb(st.variant)) });
    var c = cacheOf(st.variant);
    $('cachedSize').textContent = !c || !c.bytes ? T('none') : T(c.complete ? 'full' : 'partial', { n: fmt(c.bytes / MB, c.bytes < 10 * MB ? 1 : 0) });
    renderBusy();
  }
  function cachedComplete() { var c = cacheOf(st.variant); return !!(c && c.complete); }
  function renderEnv() {
    var caps = st.caps, box = $('envMsg'), msgs = [];
    if (!caps) { box.hidden = true; return; }
    var noGpu = !caps.gpu;
    if (st.device === 'wasm') msgs.push(T('cpuOn'));
    else if (noGpu) msgs.push(T('noGpu'));
    if (!noGpu && st.device !== 'wasm' && st.variant === 'fp16' && !caps.f16) msgs.push(T('noF16'));
    if (!caps.proxy && !cachedComplete()) msgs.push(T('noProxy'));
    if (!caps.caches) msgs.push(T('noCache'));
    box.hidden = !msgs.length;
    $('envText').textContent = msgs.join(' · ');
    $('cpuBtn').hidden = !(noGpu && st.device !== 'wasm');
    $('colabLink').hidden = !(noGpu || st.device === 'wasm' || (st.variant === 'fp16' && !caps.f16));
  }
  function renderBusy() {
    var busy = !!(st.loading || st.gen), caps = st.caps;
    var canLoad = !!caps && (caps.proxy || cachedComplete()) && (caps.gpu || st.device === 'wasm');
    $('loadBtn').disabled = busy || !canLoad;
    $('stopLoadBtn').hidden = !st.loading;
    $('clearBtn').disabled = busy;
    $('genBtn').disabled = busy || !canLoad;
    $('stopBtn').hidden = !st.gen;
    var vs = $('variant').querySelectorAll('button');
    for (var i = 0; i < vs.length; i++) vs[i].disabled = busy;
  }
  function onProgress(m) {
    var meter = $('dlMeter');
    if (m.stage === 'session') { meter.hidden = true; setStatus('modelStatus', function () { return T('session'); }); return; }
    if (m.fromCache) { setStatus('modelStatus', function () { return T('fromCache', { file: m.file }); }); return; }
    meter.hidden = !m.total;
    if (m.total) meter.firstElementChild.style.width = Math.min(100, m.loaded / m.total * 100).toFixed(1) + '%';
    setStatus('modelStatus', function () {
      return m.total ? T('dl', { file: m.file, pct: fmt(m.loaded / m.total * 100), got: fmt(m.loaded / MB), total: fmt(m.total / MB) })
        : T('dlNoTotal', { file: m.file, got: fmt(m.loaded / MB) });
    });
  }
  function load() {
    if (st.loaded && st.loaded.variant === st.variant && st.loaded.device === st.device) return Promise.resolve();
    if (st.loading) return st.loading.promise;
    var d = {};
    d.promise = new Promise(function (res, rej) { d.resolve = res; d.reject = rej; });
    st.loading = d;
    renderBusy();
    if (TM) {
      TM.persistOnce();
      TM.budget.acquire('f5', function () { killEngine(); });
    }
    checkSpace();
    send({ cmd: 'load', variant: st.variant, device: st.device });
    return d.promise;
  }
  function checkSpace() {
    if (cachedComplete()) return;
    try {
      navigator.storage.estimate().then(function (e) {
        var need = needMb(st.variant), free = (e.quota - e.usage) / MB;
        if (isFinite(free) && free < need * 1.1 && st.loading) setStatus('modelStatus', function () { return T('space', { free: fmt(free), need: fmt(need) }); }, 'warn');
      }, function () {});
    } catch (e) {}
  }

  /* ── เสียงตัวอย่าง (IndexedDB ในเครื่องเท่านั้น) ── */
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, mode), out = fn(t.objectStore(STORE));
        t.oncomplete = function () { db.close(); res(out && out.result !== undefined ? out.result : out); };
        t.onerror = t.onabort = function () { db.close(); rej(t.error); };
      });
    });
  }
  function loadVoices() {
    return tx('readonly', function (s) { return s.getAll(); }).then(function (rows) {
      st.voices = (rows || []).sort(function (a, b) { return a.at - b.at; });
      if (st.voiceId && !st.voices.some(function (v) { return v.id === st.voiceId; })) st.voiceId = null;
      if (!st.voiceId && st.voices.length) st.voiceId = st.voices[0].id;
      renderVoices();
    }, function () { st.voices = []; renderVoices(); });
  }
  function currentVoice() { for (var i = 0; i < st.voices.length; i++) if (st.voices[i].id === st.voiceId) return st.voices[i]; return null; }
  function icon(name) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ome-icon'); s.setAttribute('aria-hidden', 'true'); var u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', 'icons.svg#i-' + name); s.appendChild(u); return s; }
  function renderVoices() {
    var box = $('voiceList');
    box.textContent = '';
    $('voiceEmpty').hidden = st.voices.length > 0;
    box.hidden = !st.voices.length;
    st.voices.forEach(function (v) {
      var row = document.createElement('div'), grow = document.createElement('div'), title = document.createElement('div'), meta = document.createElement('div'), end = document.createElement('div');
      row.className = 'list-row'; grow.className = 'grow'; title.className = 'title'; meta.className = 'meta'; end.className = 'end';
      title.textContent = v.name; title.title = v.name;
      meta.textContent = T('sec', { n: fmt(v.sec, 1) }) + ' · ' + v.text;
      var use = document.createElement('button'), on = v.id === st.voiceId;
      use.type = 'button'; use.className = 'btn sm'; use.setAttribute('aria-pressed', on ? 'true' : 'false');
      use.textContent = on ? T('inUse') : T('use');
      use.addEventListener('click', function () { st.voiceId = v.id; saveUi(); renderVoices(); renderStats(); });
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'btn icon ghost'; del.setAttribute('aria-label', T('del', { name: v.name })); del.appendChild(icon('trash-2'));
      del.addEventListener('click', function () {
        window.tanotConfirmDelete(v.name).then(function (ok) {
          if (!ok) return;
          tx('readwrite', function (s) { return s.delete(v.id); }).then(loadVoices);
        });
      });
      grow.appendChild(title); grow.appendChild(meta); end.appendChild(use); end.appendChild(del);
      row.appendChild(grow); row.appendChild(end); box.appendChild(row);
    });
  }
  function decodeRef(file) {
    return file.arrayBuffer().then(function (buf) {
      var Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var ctx = new Ctx(1, 1, C.SR);
      return new Promise(function (res, rej) {
        var p = ctx.decodeAudioData(buf, res, rej);
        if (p && p.then) p.then(res, rej);
      });
    }).then(function (ab) {
      var n = ab.length, mono = new Float32Array(n), ch = ab.numberOfChannels;
      for (var c = 0; c < ch; c++) { var d = ab.getChannelData(c); for (var i = 0; i < n; i++) mono[i] += d[i] / ch; }
      if (ab.sampleRate === C.SR) return mono;
      var Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var off = new Ctx(1, Math.ceil(n * C.SR / ab.sampleRate), C.SR), src = off.createBufferSource(), b = off.createBuffer(1, n, ab.sampleRate);
      b.getChannelData(0).set(mono); src.buffer = b; src.connect(off.destination); src.start(0);
      return off.startRendering().then(function (r) { return new Float32Array(r.getChannelData(0)); });
    });
  }
  function saveVoice() {
    var f = $('vFile').files && $('vFile').files[0], text = $('vText').value.trim();
    if (!f) { setStatus('vStatus', function () { return T('vNeedFile'); }, 'err'); return; }
    if (!text) { setStatus('vStatus', function () { return T('vNeedText'); }, 'err'); return; }
    var name = $('vName').value.trim() || T('vDefault', { n: st.voices.length + 1 });
    $('vSave').disabled = true;
    setStatus('vStatus', function () { return T('vDecoding'); });
    decodeRef(f).then(function (raw) {
      var pcm = C.trimRef(raw, C.SR), sec = pcm.length / C.SR;
      if (sec < 1) { setStatus('vStatus', function () { return T('vShort', { n: fmt(sec, 1) }); }, 'err'); return; }
      if (sec > 30) { setStatus('vStatus', function () { return T('vTooLong', { n: fmt(sec, 1) }); }, 'err'); return; }
      var rec = { id: 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name.slice(0, 40), text: text.slice(0, 400), pcm: pcm, sec: sec, at: Date.now() };
      return tx('readwrite', function (s) { return s.put(rec); }).then(function () {
        st.voiceId = rec.id; saveUi();
        $('vFile').value = ''; $('vName').value = ''; $('vText').value = '';
        var long = sec > C.REF_WARN_SEC;
        setStatus('vStatus', function () { return long ? T('vLong', { n: fmt(sec, 1) }) : T('vSaved', { n: fmt(sec, 1) }); }, long ? 'warn' : 'ok');
        return loadVoices();
      });
    }).catch(function (e) {
      if (TM) TM.logError('f5', e, { stage: 'ref-decode', file: { type: f.type, name: f.name, size: f.size } });
      setStatus('vStatus', function () { return T('vBad'); }, 'err');
    }).then(function () { $('vSave').disabled = false; });
  }

  /* ── สร้างเสียง: ท่อนแรกเสร็จก็เล่นเลย ระหว่างฟังทำท่อนถัดไป ── */
  function ensureCtx() {
    var A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    if (!st.ctx) st.ctx = new A();
    if (st.ctx.state === 'suspended') st.ctx.resume();
    return st.ctx;
  }
  function stopAudio() {
    if (!st.gen) return;
    st.gen.sources.forEach(function (s) { try { s.stop(); } catch (e) {} });
    st.gen.sources = [];
  }
  function generate() {
    if (st.gen || st.loading) return;
    var text = $('genText').value.trim(), v = currentVoice();
    if (!v) { setStatus('genStatus', function () { return T('needVoice'); }, 'err'); return; }
    if (!text) { setStatus('genStatus', function () { return T('needText'); }, 'err'); return; }
    ensureCtx(); // ต้องสร้าง/resume ในจังหวะที่ผู้ใช้กด (iOS)
    var items = C.planText(text.slice(0, C.MAX_CHARS), Norm);
    if (!items.length) { setStatus('genStatus', function () { return T('nothing'); }, 'err'); return; }
    var fit;
    try { fit = C.fitChunks(items, C.refText(v.text), C.refFrames(v.pcm.length)); }
    catch (e) { setStatus('genStatus', function () { return T('tooLong'); }, 'err'); return; }
    if (st.wavUrl) { URL.revokeObjectURL(st.wavUrl); st.wavUrl = null; }
    $('wavBtn').hidden = true; $('player').hidden = true; $('player').removeAttribute('src');
    var g = st.gen = { id: Date.now(), n: fit.length, gaps: fit.map(function (x) { return x.gap; }), parts: [], sources: [], nextAt: 0,
      t0: 0, first: null, stepMs: [], chars: fit.reduce(function (s, x) { return s + x.norm.length; }, 0), refSec: v.sec };
    $('genMeter').hidden = false; $('genMeter').firstElementChild.style.width = '0%';
    setStatus('genStatus', function () { return T('gWait'); });
    renderBusy();
    load().then(function () {
      if (st.gen !== g) return;
      g.t0 = now();
      send({ cmd: 'synth', id: g.id, ref: { pcm: v.pcm }, items: fit.map(function (x) { return { full: x.full, frames: x.frames }; }) });
    }, function (e) {
      if (st.gen !== g) return;
      if (e && e.code === 'abort') endGen(T('gStopped'));
      else { endGen(null); setStatus('genStatus', function () { return errText(e); }, 'err'); }
    });
  }
  function onStep(m) {
    var g = st.gen;
    if (!g || m.id !== g.id) return;
    $('genMeter').firstElementChild.style.width = ((m.i + m.k / m.of) / m.n * 100).toFixed(1) + '%';
    setStatus('genStatus', function () { return T('gChunk', { i: m.i + 1, n: m.n, k: m.k, of: m.of }); });
  }
  function onChunk(m) {
    var g = st.gen;
    if (!g || m.id !== g.id) return;
    if (g.first == null) g.first = now() - g.t0;
    g.parts[m.i] = m.audio; g.stepMs.push(m.ms.step);
    var ctx = st.ctx;
    if (ctx && m.audio.length) {
      var b = ctx.createBuffer(1, m.audio.length, m.sr || C.SR);
      b.getChannelData(0).set(m.audio);
      var src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination);
      var at = Math.max(ctx.currentTime + 0.05, g.nextAt);
      src.start(at); g.sources.push(src);
      g.nextAt = at + b.duration + (g.gaps[m.i] || 0);
    }
  }
  function onDone(m) {
    var g = st.gen;
    if (!g || m.id !== g.id) return;
    var parts = [], gaps = [];
    for (var i = 0; i < g.n; i++) if (g.parts[i]) { parts.push(g.parts[i]); gaps.push(g.gaps[i]); }
    var x = C.concat(parts, gaps, C.SR);
    var genMs = now() - g.t0, audioSec = x.length / C.SR;
    if (window.TanotAudioGain) TanotAudioGain.process(x, C.SR, { normalize: true });
    st.wavUrl = URL.createObjectURL(new Blob([C.encodeWav(x, C.SR)], { type: 'audio/wav' }));
    $('wavBtn').href = st.wavUrl; $('wavBtn').hidden = false;
    $('player').src = st.wavUrl; $('player').hidden = false;
    var stepAvg = g.stepMs.length ? g.stepMs.reduce(function (a, b) { return a + b; }, 0) / g.stepMs.length : null;
    st.stats.first = g.first; st.stats.step = stepAvg; st.stats.rtf = C.rtf(genMs / 1000, audioSec); st.stats.audio = audioSec;
    st.stats.chunks = g.n; st.stats.ref = g.refSec; st.stats.gen = genMs;
    if (TM) TM.logNote('f5', { stage: 'stats', model: 'f5-' + (st.loaded && st.loaded.variant || st.variant), device: st.device, engine: 'local' },
      'where=' + st.where + ' chunks=' + g.n + ' chars=' + g.chars + ' ref=' + g.refSec.toFixed(1) + 's audio=' + audioSec.toFixed(1) + 's gen=' + (genMs / 1000).toFixed(1) +
      's first=' + Math.round(g.first || 0) + 'ms step=' + Math.round(stepAvg || 0) + 'ms rtf=' + (st.stats.rtf == null ? '' : st.stats.rtf.toFixed(2)) +
      ' io=' + (st.loaded && st.loaded.ioGpu ? 'gpu' : 'cpu') + ' gpu=' + ((st.caps && st.caps.adapter) || ''));
    var n = g.n;
    endGen(null);
    setStatus('genStatus', function () { return T('gDone', { n: n, sec: fmt(audioSec, 1), gen: fmt(genMs / 1000, 1) }); }, 'ok');
    renderStats();
  }
  function endGen(msg) {
    var g = st.gen;
    st.gen = null;
    $('genMeter').hidden = true;
    if (msg != null) { if (g) g.sources.forEach(function (s) { try { s.stop(); } catch (e) {} }); setStatus('genStatus', function () { return msg; }); }
    renderBusy();
  }
  function stopGen() {
    if (!st.gen) return;
    stopAudio();
    if (st.send) st.send({ cmd: 'cancel' });
    endGen(T('gStopped'));
  }

  /* ── ผลวัด ── */
  function statRows() {
    var s = st.stats, caps = st.caps || {}, v = currentVoice();
    var files = s.files == null ? '—' : s.fromCache ? T('fromCacheShort', { t: secTxt(s.files) }) : secTxt(s.files);
    return [
      ['sVariant', (st.loaded && st.loaded.variant) || st.variant],
      ['sDevice', st.device],
      ['sWhere', T(st.where === 'page' ? 'page' : 'worker')],
      ['sAdapter', caps.adapter || (caps.gpu ? '—' : T('no'))],
      ['sF16', caps.gpu ? T(caps.f16 ? 'yes' : 'no') : '—'],
      ['sIo', s.ioGpu == null ? '—' : T(s.ioGpu ? 'onGpu' : 'onCpu')],
      ['sFiles', files],
      ['sSession', secTxt(s.session)],
      ['sFirst', secTxt(s.first)],
      ['sStep', s.step == null ? '—' : fmt(s.step)],
      ['sRtf', s.rtf == null ? '—' : fmt(s.rtf, 2)],
      ['sAudio', s.audio == null ? '—' : T('sec', { n: fmt(s.audio, 1) })],
      ['sChunks', s.chunks == null ? '—' : fmt(s.chunks)],
      ['sRef', s.ref != null ? T('sec', { n: fmt(s.ref, 1) }) : v ? T('sec', { n: fmt(v.sec, 1) }) : '—']
    ];
  }
  function renderStats() {
    var box = $('stats');
    box.textContent = '';
    statRows().forEach(function (r) {
      var k = document.createElement('span'), v = document.createElement('span');
      k.className = 'k'; v.className = 'v'; k.textContent = T(r[0]); v.textContent = r[1];
      if (r[0] === 'sAdapter') v.setAttribute('data-i18n-skip', '');
      box.appendChild(k); box.appendChild(v);
    });
  }
  function copyStats() {
    var lines = statRows().map(function (r) { return T(r[0]) + ': ' + r[1]; });
    lines.unshift('Tanot F5 lab · ' + new Date().toISOString().slice(0, 16).replace('T', ' '));
    lines.push('UA: ' + navigator.userAgent);
    var txt = lines.join('\n');
    var p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject();
    p.then(function () { window.tanotToast && tanotToast(T('copied'), 'ok'); }, function () { window.tanotToast && tanotToast(T('copyFail'), 'err'); });
  }

  /* ── ผูกปุ่ม ── */
  function charCount() { I18N.live($('charCount'), function () { return fmt($('genText').value.length) + '/' + fmt(C.MAX_CHARS); }); }
  $('variant').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-v]');
    if (!b || b.disabled) return;
    st.variant = b.getAttribute('data-v'); saveUi();
    renderModel(); renderEnv(); renderStats();
  });
  $('loadBtn').addEventListener('click', function () { load().catch(function () {}); });
  $('stopLoadBtn').addEventListener('click', function () { if (st.send) st.send({ cmd: 'cancel' }); });
  $('clearBtn').addEventListener('click', function () {
    window.tanotConfirm(T('clearAsk'), { danger: true, okLabel: T('clear') }).then(function (ok) { if (ok) send({ cmd: 'clear' }); });
  });
  $('cpuBtn').addEventListener('click', function () {
    window.tanotConfirm(T('cpuWarn'), { okLabel: T('cpuOk') }).then(function (ok) {
      if (!ok) return;
      st.device = 'wasm'; renderEnv(); renderBusy(); renderStats();
    });
  });
  $('vSave').addEventListener('click', saveVoice);
  $('genBtn').addEventListener('click', generate);
  $('stopBtn').addEventListener('click', stopGen);
  $('copyBtn').addEventListener('click', copyStats);
  $('genText').addEventListener('input', charCount);
  OME_LANG.onChange(function () { renderModel(); renderEnv(); renderVoices(); renderStats(); });

  renderModel(); renderStats(); charCount(); renderBusy();
  loadVoices();
  startEngine();
  window.__f5lab = { state: function () { return st; } }; // ให้เทสต์อ่านสถานะ
})();
