/* ══════════════════════════════════════════════════════════════════
   แปลงข้อความเป็นเสียง — 2 โหมด:
   1) ฟังทันที: Web Speech API ของเบราว์เซอร์ (เล่นสดเท่านั้น ดาวน์โหลดไม่ได้)
   2) สร้างไฟล์เสียง: eSpeak NG (WASM, ฝังในเว็บเอง) → .wav ตรงๆ จาก virtual FS
      แล้วเข้ารหัสเป็น .mp3 ด้วย lamejs ฝั่งเบราว์เซอร์ล้วนๆ ไม่มีเซิร์ฟเวอร์
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  /* ══════════════════ ตั้งค่า path ไฟล์ WASM ของ onnxruntime-web (ใช้ร่วมกันทั้ง TTS/ASR) ══════════════════
     แก้บั๊ก 2 ชั้นที่เจอจริงในโปรดักชัน:
     1) ตั้ง wasmPaths เป็น string เฉยๆ ('./vendor/transformers/') ทำให้ path ที่เบราว์เซอร์ขอจริง
        กลายเป็น .../vendor/transformers/vendor/transformers/ort-wasm-....mjs (ซ้ำโฟลเดอร์) เพราะ
        transformers.js จะเอา string นี้ไปประกอบกับชื่อไฟล์ default ของมันเองอีกที — ต้องตั้งเป็น
        object {mjs, wasm} ชี้ path เต็มตรงๆ แทน ถึงจะข้ามตรรกะประกอบ path ที่มีบั๊กนี้ไปได้
     2) เว็บนี้ไม่มี header COOP/COEP (GitHub/Cloudflare Pages ธรรมดาไม่ส่งให้) ทำให้ SharedArrayBuffer
        ใช้ไม่ได้ — ไฟล์ .wasm รุ่น "threaded" ปกติ (ที่ฝังไว้แต่แรก) คอมไพล์มาแบบ pthread ต้องพึ่ง
        SharedArrayBuffer เสมอไม่ว่าจะตั้ง numThreads=1 หรือไม่ก็ตาม จึงโหลดไม่ได้จริง — ต้องใช้รุ่น
        "asyncify" (คอมไพล์แบบ single-thread ล้วนๆ ไม่พึ่ง pthread/SharedArrayBuffer) แทน ยกเว้น Safari
        ที่ตัว onnxruntime-web เองแนะนำให้ใช้รุ่น threaded ปกติ (ตรรกะเดียวกับ default ของไลบรารี
        เอง แค่ชี้ไปไฟล์ที่ฝังในเว็บนี้แทน jsdelivr)
     ⚠️ ไฟล์ vendor onnxruntime-web ทั้งชุด pin ไว้ที่ 1.24.3 ตั้งใจ ห้ามอัปเดตเฉยๆ — ดูเหตุผลเต็มที่
        คอมเมนต์เหนือ configureOnnxWasmPaths ใน tts-worker.js (บั๊ก TransposeDQWeightsForMatMulNBits
        ในเวอร์ชัน 1.25+ ที่ทำให้สร้าง session พังกับโมเดล quantized บางตัวรวมถึง Whisper) */
  function configureOnnxWasmPaths(env) {
    var isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
    env.backends.onnx.wasm.wasmPaths = isSafari
      ? { mjs: './vendor/transformers/ort-wasm-simd-threaded.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.wasm' }
      : { mjs: './vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm' };
    env.backends.onnx.wasm.numThreads = 1; // ไม่มี SharedArrayBuffer อยู่แล้ว บังคับ single-thread กันค้าง
  }

  /* ══════════════════ ตัวนับตัวอักษร ══════════════════ */
  function updateCharCount() {
    $('ttsCharCount').textContent = $('ttsText').value.length + ' ตัวอักษร';
  }

  /* ══════════════════ แนบไฟล์ → นำเข้าข้อความ (file-reader.js) ══════════════════
     รองรับ .txt/.docx/.xlsx/.xls/.csv/.pptx/.pdf/รูปภาพ — ดูรายละเอียดการอ่านแต่ละชนิดไฟล์ใน
     file-reader.js (ไฟล์กลาง ใช้ร่วมกับหน้าอื่นได้ในอนาคต ไม่ผูกกับ UI ของหน้านี้โดยเฉพาะ) */
  function formatImportProgress(p) {
    if (!p) return '⏳ กำลังอ่านไฟล์…';
    if (p.stage === 'ocr') return '⏳ กำลังอ่านด้วย OCR หน้า/รูป ' + p.page + '/' + p.total + ' (อาจใช้เวลาสักครู่ต่อหน้า)…';
    if (p.stage === 'pdf') return '⏳ กำลังอ่าน PDF หน้า ' + p.page + '/' + p.total + '…';
    return '⏳ กำลังอ่านไฟล์…';
  }
  function importFileChange(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = ''; // เคลียร์ค่า input ไว้ กันเลือกไฟล์เดิมซ้ำแล้ว change event ไม่ยิง
    if (!file) return;
    if (!window.TanotFileReader) {
      $('importStatus').className = 'status err';
      $('importStatus').textContent = 'โหลดตัวอ่านไฟล์ไม่สำเร็จ (อาจเป็นเพราะเน็ตช้า/ถูกบล็อก) ลองรีเฟรชหน้าใหม่';
      return;
    }
    $('importFileBtn').disabled = true;
    $('importStatus').className = 'status';
    $('importStatus').textContent = '⏳ กำลังอ่านไฟล์ ' + file.name + '…';
    window.TanotFileReader.readAnyFile(file, {
      ocr: $('importOcrChk').checked,
      onProgress: function (p) { $('importStatus').textContent = formatImportProgress(p); }
    }).then(function (text) {
      text = (text || '').trim();
      if (!text) {
        $('importStatus').className = 'status err';
        $('importStatus').textContent = 'ไม่พบข้อความในไฟล์นี้';
        return;
      }
      $('ttsText').value = text;
      updateCharCount();
      $('importStatus').className = 'status ok';
      $('importStatus').textContent = 'นำเข้าข้อความจาก ' + file.name + ' แล้ว (' + text.length + ' ตัวอักษร) — ตรวจทานก่อนกด "สร้างไฟล์เสียง" ได้';
    }).catch(function (err) {
      $('importStatus').className = 'status err';
      $('importStatus').textContent = 'อ่านไฟล์ไม่สำเร็จ: ' + (err && err.message ? err.message : err);
    }).finally(function () {
      $('importFileBtn').disabled = false;
    });
  }

  /* ══════════════════ โหมด 1: Web Speech API (เล่นสด) ══════════════════ */
  var wsVoices = [];
  function loadWsVoices() {
    wsVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    renderWsVoiceOptions();
  }
  function renderWsVoiceOptions() {
    var sel = $('wsVoice');
    if (!window.speechSynthesis) {
      sel.innerHTML = '<option value="">(เบราว์เซอร์นี้ไม่รองรับ Web Speech API)</option>';
      $('wsPlayBtn').disabled = true;
      return;
    }
    if (!wsVoices.length) {
      sel.innerHTML = '<option value="">(ยังไม่พบเสียง — บางเบราว์เซอร์โหลดช้า ลองรอสักครู่)</option>';
      return;
    }
    sel.innerHTML = wsVoices.map(function (v, i) {
      return '<option value="' + i + '">' + v.name + ' (' + v.lang + ')' + (v.default ? ' — ค่าเริ่มต้น' : '') + '</option>';
    }).join('');
    var defaultIdx = wsVoices.findIndex(function (v) { return v.default; });
    if (defaultIdx >= 0) sel.value = String(defaultIdx);
  }
  function wsPlay() {
    var text = $('ttsText').value;
    if (!text.trim()) { $('wsStatus').className = 'status err'; $('wsStatus').textContent = 'พิมพ์ข้อความก่อน'; return; }
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var idx = parseInt($('wsVoice').value, 10);
    if (wsVoices[idx]) { u.voice = wsVoices[idx]; u.lang = wsVoices[idx].lang; }
    u.rate = parseFloat($('wsRate').value) || 1;
    u.onstart = function () { $('wsStatus').className = 'status ok'; $('wsStatus').textContent = 'กำลังเล่น…'; };
    u.onend = function () { $('wsStatus').className = 'status'; $('wsStatus').textContent = 'เล่นจบแล้ว'; };
    u.onerror = function (e) {
      if (e && e.error === 'interrupted') return; // ผู้ใช้กดหยุด/เล่นใหม่เอง ไม่ใช่ข้อผิดพลาดจริง
      $('wsStatus').className = 'status err'; $('wsStatus').textContent = 'เล่นไม่สำเร็จ: ' + (e && e.error);
    };
    window.speechSynthesis.speak(u);
  }
  function wsPauseToggle() {
    if (!window.speechSynthesis) return;
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      $('wsStatus').className = 'status'; $('wsStatus').textContent = '⏸ หยุดชั่วคราว';
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      $('wsStatus').className = 'status ok'; $('wsStatus').textContent = 'กำลังเล่น…';
    }
  }
  function wsStop() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    $('wsStatus').className = 'status'; $('wsStatus').textContent = '';
  }

  /* ══════════════════ โหมด 2: สร้างไฟล์เสียง (MMS-TTS ผ่าน transformers.js → wav → mp3) ══════════════════
     เดิมใช้ eSpeak NG แต่พบว่าโมดูลแปลภาษาไทยเป็นหน่วยเสียงของ eSpeak NG (ทั้งรุ่นที่ฝังไว้และรุ่นล่าสุด
     ที่คอมไพล์จากซอร์สทางการเองสดๆ) แปลผิดตั้งแต่ต้นทาง ฟังไม่รู้เรื่อง — เป็นข้อจำกัดของตัวเอนจินเอง
     ไม่ใช่เรื่องความเร็ว/พิทช์ จึงเปลี่ยนมาใช้ MMS-TTS (โมเดล AI จาก Meta รองรับ 1,100+ ภาษา) ผ่าน
     transformers.js แทน — เป็นโมเดลเสียงประสาทเทียมจริง (เสียงเป็นธรรมชาติกว่ามาก) แต่ละภาษาเป็นคนละ
     โมเดล ต้องดาวน์โหลดจาก Hugging Face ตอนใช้ครั้งแรกเหมือนโหมดถอดเสียงเป็นข้อความ */
  var ttsPipelinePromiseByModel = {};
  /* transformers.js เลือกไฟล์ ONNX ให้เองอัตโนมัติตาม dtype เริ่มต้นของแต่ละ backend (บน wasm คือ 'q8'
     → ไปหา onnx/model_quantized.onnx) โมเดลเสียงไทยที่แปลงเอง (Tanotfin/mms-tts-2081-onnx) มีไฟล์นี้จริง
     จึงปล่อยดีฟอลต์ได้ปกติ — แต่โมเดล "หญิง (โทนพอดแคสต์)" (phlebotomy1996/mms-thai-female-podcast-spk0)
     ไม่มีไฟล์ quantized เลย (เช็คจริงในโฟลเดอร์ onnx/ มีแค่ model.onnx กับ model_fp16.onnx) ปล่อยดีฟอลต์
     จะ 404 ตอนโหลด ต้องบังคับ dtype ต่อโมเดลเป็นรายตัว — เลือก 'fp32' (ไม่ใช่ 'fp16') เพราะ fp32 รองรับ
     บน wasm backend ครบทุกเบราว์เซอร์แน่นอนกว่า fp16 ที่บาง engine/เบราว์เซอร์รุ่นเก่ายังไม่รองรับเต็มที่ */
  var TTS_DTYPE_OVERRIDES = {
    'phlebotomy1996/mms-thai-female-podcast-spk0': 'fp32'
    /* Tanotfin/mms-tts-2081-FM-onnx และ mms-tts-2081-M-onnx (แปลงจาก VIZINTZOR/MMS-TTS-THAI-FEMALEV2/
       MALEV2) เคยพังทั้ง dtype=fp32 และ q8 ด้วย error เดียวกัน "[ShapeInferenceError] Incompatible
       dimensions" ที่ node Where ใน duration_predictor/flows.X — ตอนแรกเข้าใจผิดว่าเป็นปัญหา
       quantization เลยบังคับ fp32 ไว้ (ดูประวัติได้ใน git log) แต่ที่จริงสาเหตุคือโค้ด
       _unconstrained_rational_quadratic_spline ใน transformers ใช้ boolean-mask fancy indexing
       (tensor[mask] = ...) ที่ trace-based ONNX export แล้วได้กราฟ shape ไม่คงที่ (data-dependent)
       สำหรับน้ำหนักของสองโมเดลนี้โดยเฉพาะ แก้ต้นตอแล้วด้วยการแพตช์ฟังก์ชันนั้นให้ใช้ torch.where แบบ
       shape คงที่ก่อน export ใหม่ (ยืนยันด้วย onnx.checker.check_model(full_check=True) ผ่านทั้ง
       model.onnx และ model_quantized.onnx ของทั้งสองโมเดลแล้ว) จึงไม่ต้องบังคับ dtype อีกต่อไป
       ปล่อยดีฟอลต์ (q8) ได้ตามปกติเหมือนเสียงอื่น */
    /* ‼️ tts-worker.js มีตารางนี้ซ้ำอยู่อีกชุด (คนละ execution context กัน ไม่มี module กลางให้ import
       ร่วมกันได้ตรงๆ) — 2026-08-10 เจอบั๊กจริงว่าตอนแก้ตารางนี้ (ถอด fp32 ออกจาก 2 โมเดลด้านบน) ลืมแก้
       ไฟล์ tts-worker.js คู่กันไปด้วย ทำให้ Worker พูล (เส้นทางหลักที่ใช้งานจริงเกือบตลอด) ยังบังคับ fp32
       (ไฟล์ใหญ่กว่า q8 หลายเท่า) ทิ้งไว้เกินความจำเป็น น่าจะเป็นสาเหตุอาการ "หน้าเว็บรีเฟรชเอง" ที่เคย
       มีคนรายงาน (แท็บแครชเพราะหน่วยความจำไม่พอตอนรัน Worker หลายตัวขนาน) แก้ไขให้ตรงกันแล้ว — แก้ตารางนี้
       ครั้งต่อไป ต้องแก้ tts-worker.js คู่กันเสมอ */
  };
  function loadTtsPipeline(modelId, onProgress) {
    if (!ttsPipelinePromiseByModel[modelId]) {
      ttsPipelinePromiseByModel[modelId] = import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
        var env = mod.env;
        configureOnnxWasmPaths(env);
        var opts = { progress_callback: onProgress };
        if (TTS_DTYPE_OVERRIDES[modelId]) opts.dtype = TTS_DTYPE_OVERRIDES[modelId];
        return mod.pipeline('text-to-speech', modelId, opts);
      });
    }
    return ttsPipelinePromiseByModel[modelId];
  }
  function synthesizeMmsTts(text, modelId, onProgress) {
    return loadTtsPipeline(modelId, onProgress).then(function (synthesizer) {
      return synthesizer(text);
    }).then(function (output) {
      if (!output || !output.audio || !output.audio.length) throw new Error('ไม่ได้ข้อมูลเสียงกลับมา');
      return output;
    });
  }
  /* ══════════════════ ตัดข้อความยาวเป็นท่อนสั้นๆ ก่อนสังเคราะห์เสียง ══════════════════
     เจอจริงในโปรดักชัน: วางข้อความยาว (เช่นย่อหน้ากฎหมายหลายพันตัวอักษร) แล้วทั้งแท็บค้าง/แครช
     (ไม่ใช่แค่ช้า) — โมเดล VITS คำนวณ attention แบบ O(n²) กับความยาวข้อความทั้งก้อน ยิ่งข้อความยาว
     หน่วยความจำ/เวลาคำนวณยิ่งพุ่งแบบทวีคูณ ไม่ใช่เชิงเส้น ตัดขนาดโมเดลให้เล็กลง (quantize) ก็ช่วย
     ได้แค่ความเร็วต่อท่อน ไม่ได้ช่วยเรื่องนี้เลยเพราะเป็นคนละสาเหตุกัน ทางแก้ที่ถูกต้องคือตัดข้อความ
     เป็นท่อนสั้นๆ ก่อนเสมอ แล้วสังเคราะห์ทีละท่อนต่อกัน (เรียงตามลำดับ ไม่ขนาน กันแย่งหน่วยความจำ) */
  var MAX_TTS_CHUNK_CHARS = 60;
  function splitIntoTtsChunks(text, maxLen) {
    maxLen = maxLen || MAX_TTS_CHUNK_CHARS;
    var lines = text.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    var chunks = [];
    lines.forEach(function (line) {
      while (line.length > maxLen) {
        var head = line.slice(0, maxLen);
        var punctIdx = Math.max(head.lastIndexOf('.'), head.lastIndexOf('ๆ'), head.lastIndexOf('ฯ'));
        var spaceIdx = head.lastIndexOf(' ');
        var cut = punctIdx > 10 ? punctIdx + 1 : (spaceIdx > 10 ? spaceIdx : maxLen);
        chunks.push(line.slice(0, cut).trim());
        line = line.slice(cut).trim();
      }
      if (line) chunks.push(line);
    });
    return chunks;
  }
  function concatFloat32Arrays(arrays, gapSamples) {
    gapSamples = gapSamples || 0;
    var total = arrays.reduce(function (sum, a) { return sum + a.length; }, 0) + gapSamples * Math.max(0, arrays.length - 1);
    var out = new Float32Array(total);
    var offset = 0;
    arrays.forEach(function (a, i) {
      out.set(a, offset);
      offset += a.length + (i < arrays.length - 1 ? gapSamples : 0);
    });
    return out;
  }
  /* สังเคราะห์เสียงทีละท่อนเรียงลำดับ (ไม่ใช่พร้อมกัน) แล้วต่อรวมเป็นเสียงเดียว — ใช้เป็น fallback
     สุดท้ายเท่านั้น (ไม่มี Worker เลย หรือ Worker pool ทั้งพูลใช้งานไม่ได้จริงๆ) เพราะรันบล็อกเธรดหลัก
     pipeline ถูกแคชไว้แล้วหลังท่อนแรก (ดู loadTtsPipeline) ท่อนต่อไปจึงไม่ดาวน์โหลดโมเดลซ้ำ
     onProgress(done, total) เรียกหลังแต่ละท่อนเสร็จ (ไม่ใช่ก่อนเริ่ม) ให้ตรงความหมายเดียวกับ
     ฝั่ง Worker pool ที่นับความคืบหน้ารวมจากหลาย Worker พร้อมกัน — เรียก generateDownloadable
     คำนวณเวลาประมาณการที่เหลือ (ETA) จากอัตรานี้ได้ตรงกันไม่ว่าจะวิ่งทางไหน */
  function synthesizeMmsTtsChunks(chunks, modelId, onModelProgress, onProgress) {
    var audioParts = [], samplingRate = null, done = 0;
    return chunks.reduce(function (p, chunk) {
      return p.then(function () {
        return synthesizeMmsTts(chunk, modelId, onModelProgress);
      }).then(function (output) {
        samplingRate = output.sampling_rate;
        audioParts.push(output.audio);
        done++;
        if (onProgress) onProgress(done, chunks.length);
      });
    }, Promise.resolve()).then(function () {
      return { audio: concatFloat32Arrays(audioParts, Math.round(samplingRate * 0.3)), sampling_rate: samplingRate };
    });
  }
  /* ══════════════════ รันสังเคราะห์เสียงใน Web Worker "พูล" (กันหน้าเว็บค้าง + ใช้หลาย core ขนาน) ══
     รอบก่อนย้ายไปรันใน Worker ตัวเดียวแก้เรื่องหน้าเว็บค้างได้ (คำนวณไม่บล็อก UI) แต่ยังรันทีละท่อน
     เรียงคิวอยู่ดี — เวลารวมเท่าเดิม ไม่เร็วขึ้น รอบนี้เปลี่ยนเป็นสร้าง Worker หลายตัว (ตามจำนวน core
     ของเครื่อง) แบ่งท่อนข้อความไปให้แต่ละ Worker คำนวณขนานกันจริง (ไม่ใช่แค่ย้ายออกจากเธรดหลัก) —
     ยังคง fallback กลับมารันในหน้าเว็บตรงๆ (ทีละท่อน) ถ้าสร้าง Worker ไม่สำเร็จเลยสักตัว */
  var ttsWorkerPool = [];
  var ttsWorkerBusy = []; // ขนานไปกับ ttsWorkerPool — true = worker ตัวนั้นยังทำ batch ก่อนหน้าไม่เสร็จ
  var ttsJobSeq = 0;
  function ttsPoolSize() {
    var cores = navigator.hardwareConcurrency || 2;
    var mem = navigator.deviceMemory; // GB — มีเฉพาะ Chrome/Edge เท่านั้น เบราว์เซอร์อื่น (รวม Safari/iOS
    // ทั้งหมด ไม่มีข้อยกเว้น) เป็น undefined เสมอ — เจอจริงว่า iPhone ทุกรุ่นจะได้ mem=undefined ไม่ว่า
    // เครื่องนั้นจะแรมเยอะแค่ไหนก็ตาม พลาดจากเดิมที่ตั้งดีฟอลต์เป็น "สันนิษฐานว่าแรมเยอะ" (cap=4) เมื่อ
    // ไม่รู้ค่า — กลับด้านลอจิกใหม่: ไม่รู้ค่า = ระมัดระวังไว้ก่อน (cap=2 เหมือนเครื่องแรมน้อยที่ยืนยันแล้ว)
    // ค่อยขยับเป็น cap=4 เฉพาะตอนที่ "ยืนยันแล้วจริง" ว่าแรมเยอะพอ (mem>=4, มีแค่ Chrome/Edge ที่รายงานได้)
    // เหตุผล: แต่ละ Worker โหลดโมเดลเป็นสำเนาของตัวเอง (WASM linear memory แยกก้อนกันคนละ Worker) ยิ่ง
    // ขนานเยอะยิ่งใช้แรมพร้อมกันเยอะขึ้นเป็นทวีคูณ — เจอจริงว่า iPhone (deviceMemory เป็น undefined จึง
    // เคยได้ cap=4 มาตลอด) รัน 4 Worker ขนานพร้อมกันจนได้ "RangeError: Out of memory" จาก WASM รันไทม์
    var cap = 2;
    if (mem && mem >= 4) cap = 4;
    return Math.max(1, Math.min(cores, cap));
  }
  /* ผูก listener ถาวร (ไม่ผูก/ลบตามแต่ละงานเหมือน onMsg ใน synthesizeMmsTtsChunksInWorkerPool) ไว้
     คอยฟังแค่ 'batch-done' จาก worker ตัวนี้เพื่ออัปเดตสถานะ busy — ต้องแยกจาก listener รายงานเพราะ
     ถ้างานหนึ่งพังกลางทาง (reject ไปแล้ว) worker ตัวอื่นในพูลที่ยังไม่ error อาจยังคำนวณค้างอยู่
     ต่อไปอีกพักหนึ่ง ต้องรู้ให้ได้ว่า "ว่างจริงเมื่อไร" ไม่ใช่แค่ตอนงานที่ dispatch ไปถูก reject */
  function attachBusyTracker(worker, idx) {
    worker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'batch-done') ttsWorkerBusy[idx] = false;
    });
  }
  function getTtsWorkerPool() {
    /* ถ้าพูลเดิมมี worker ตัวไหนยังไม่ว่าง (งานก่อนหน้ายังทำไม่เสร็จ เช่น ผู้ใช้กด "สร้างไฟล์เสียง"
       ซ้ำทันทีหลังเจอ error ก่อนที่ worker ตัวอื่นในพูลเดิมจะทำงานที่ค้างอยู่เสร็จ) ห้ามส่งงานใหม่ไปแทรก
       เด็ดขาด (จะไปต่อคิวหลังงานเก่าที่ทิ้งไปแล้ว ทำให้ล่าช้าโดยไม่จำเป็น) — เลิกใช้พูลเก่าทั้งชุด สั่ง
       terminate() ตัวที่ยังไม่ว่างทิ้งทันที (หยุดคำนวณเปล่าประโยชน์) แล้วสร้างพูลใหม่สะอาดๆ แทน */
    if (ttsWorkerPool.length && ttsWorkerBusy.indexOf(true) !== -1) {
      ttsWorkerPool.forEach(function (w) { w.terminate(); });
      ttsWorkerPool = [];
      ttsWorkerBusy = [];
    }
    if (!ttsWorkerPool.length) {
      var n = ttsPoolSize();
      for (var i = 0; i < n; i++) {
        try {
          var w = new Worker('./tts-worker.js', { type: 'module' });
          attachBusyTracker(w, ttsWorkerPool.length);
          ttsWorkerPool.push(w);
          ttsWorkerBusy.push(false);
        } catch (e) { break; } // สร้างไม่ได้ (เบราว์เซอร์เก่ามาก) — ใช้เท่าที่สร้างได้ อาจเหลือ 0 ตัวก็ได้
      }
    }
    return ttsWorkerPool;
  }
  /* แบ่งท่อนแบบ round-robin ให้ทุก Worker ในพูลได้งานพอๆ กัน แล้วให้ทำงานขนานกัน — เก็บผลลัพธ์แต่ละ
     ท่อนกลับมาใส่ตำแหน่งเดิม (msg.i) กันลำดับสลับ เพราะ Worker ต่างตัวเสร็จไม่พร้อมกันแน่นอน */
  function synthesizeMmsTtsChunksInWorkerPool(chunks, modelId, onModelProgress, onProgress) {
    return new Promise(function (resolve, reject) {
      var pool = getTtsWorkerPool();
      if (!pool.length) { reject(new Error('สร้าง Web Worker ไม่ได้')); return; }
      var jobId = ++ttsJobSeq;
      var total = chunks.length;
      var results = new Array(total);
      var samplingRate = null;
      var doneCount = 0;
      var settled = false;
      var restDispatched = false;

      function cleanup() { pool.forEach(function (w) { w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); }); }
      function finishError(err) { if (settled) return; settled = true; cleanup(); reject(err); }
      /* ส่งงานให้ worker ตัวแรก (index 0) ไปก่อนตัวเดียว รอสัญญาณ 'pipeline-ready' (โหลด/แคชโมเดล
         เสร็จแล้ว) แล้วค่อยปล่อยงานให้ worker ที่เหลือทั้งหมดพร้อมกัน — กัน worker ทุกตัวแย่งดาวน์โหลด
         ไฟล์โมเดลเดียวกันพร้อมกันตอนยังไม่มีแคชเลย (ครั้งแรกสุดที่ใช้เครื่องมือนี้) ซึ่งทำให้ช้ากว่า
         ดาวน์โหลดครั้งเดียวมากบนเน็ตที่ไม่เร็วนัก — ถ้าเคยใช้มาก่อนแล้ว (มีแคชอยู่แล้ว) 'pipeline-ready'
         จะมาเร็วมากแทบไม่หน่วงอะไรเลย มี timeout สำรองกันไว้เผื่อสัญญาณไม่มาด้วยเหตุผลใดก็ตาม */
      function dispatchRest() {
        if (restDispatched) return;
        restDispatched = true;
        pool.forEach(function (w, wi) {
          if (wi === 0 || !perWorkerItems[wi].length) return; // worker 0 ถูกส่งไปแล้วตั้งแต่แรก
          ttsWorkerBusy[wi] = true;
          w.postMessage({ type: 'synthesize-batch', jobId: jobId, items: perWorkerItems[wi], modelId: modelId });
        });
      }
      function onMsg(e) {
        var msg = e.data;
        if (!msg || msg.jobId !== jobId || settled) return;
        if (msg.type === 'model-progress') { if (onModelProgress) onModelProgress({ status: 'progress', file: msg.file, progress: msg.progress }); }
        else if (msg.type === 'pipeline-ready') { dispatchRest(); }
        else if (msg.type === 'item-done') {
          results[msg.i] = msg.audio;
          samplingRate = msg.samplingRate;
          doneCount++;
          if (onProgress) onProgress(doneCount, total);
          if (doneCount === total) {
            settled = true; cleanup();
            resolve({ audio: concatFloat32Arrays(results, Math.round(samplingRate * 0.3)), sampling_rate: samplingRate });
          }
        } else if (msg.type === 'item-error') { finishError(new Error(msg.message)); }
      }
      function onErr(e) { finishError(new Error(e.message || 'Web Worker error')); }
      pool.forEach(function (w) { w.addEventListener('message', onMsg); w.addEventListener('error', onErr); });

      var perWorkerItems = pool.map(function () { return []; });
      chunks.forEach(function (text, i) { perWorkerItems[i % pool.length].push({ i: i, text: text }); });
      if (perWorkerItems[0].length) {
        ttsWorkerBusy[0] = true;
        pool[0].postMessage({ type: 'synthesize-batch', jobId: jobId, items: perWorkerItems[0], modelId: modelId });
      }
      setTimeout(dispatchRest, 15000);
    });
  }
  function synthesizeMmsTtsChunksResponsive(chunks, modelId, onModelProgress, onProgress) {
    if (typeof Worker === 'undefined') return synthesizeMmsTtsChunks(chunks, modelId, onModelProgress, onProgress);
    return synthesizeMmsTtsChunksInWorkerPool(chunks, modelId, onModelProgress, onProgress).catch(function (err) {
      console.warn('สร้างเสียงผ่าน Web Worker (พูล) ไม่สำเร็จ กลับไปรันในหน้าเว็บโดยตรงแทน (หน้าอาจค้างชั่วคราวระหว่างคำนวณ):', err);
      return synthesizeMmsTtsChunks(chunks, modelId, onModelProgress, onProgress);
    });
  }
  /* ห่อ Float32Array ตัวอย่างเสียงดิบเป็นไฟล์ .wav มาตรฐาน (mono, PCM 16-bit) — MMS-TTS คืนมาเป็น
     ตัวเลขดิบล้วนๆ ไม่ใช่ไฟล์สำเร็จรูปแบบที่ eSpeak NG เคยให้ ต้องประกอบ WAV header เอง */
  function float32ToWavBlob(samples, sampleRate) {
    var pcm = floatTo16BitPCM(samples);
    var buf = new ArrayBuffer(44 + pcm.length * 2);
    var view = new DataView(buf);
    function writeStr(offset, s) { for (var i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); }
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); writeStr(8, 'WAVE');
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeStr(36, 'data'); view.setUint32(40, pcm.length * 2, true);
    for (var i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);
    return new Blob([buf], { type: 'audio/wav' });
  }
  function floatTo16BitPCM(floatArr) {
    var out = new Int16Array(floatArr.length);
    for (var i = 0; i < floatArr.length; i++) {
      var s = Math.max(-1, Math.min(1, floatArr[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }
  function wavBytesToMp3Blob(wavBytes) {
    return new Promise(function (resolve, reject) {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) { reject(new Error('เบราว์เซอร์นี้ไม่รองรับ Web Audio API สำหรับแปลงเป็น mp3')); return; }
      var audioCtx = new AudioCtx();
      var ab = wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength);
      audioCtx.decodeAudioData(ab, function (audioBuffer) {
        try {
          var channels = audioBuffer.numberOfChannels;
          var sampleRate = audioBuffer.sampleRate;
          var encoder = new window.lamejs.Mp3Encoder(channels, sampleRate, 128);
          var mp3Chunks = [];
          var left = floatTo16BitPCM(audioBuffer.getChannelData(0));
          var right = channels > 1 ? floatTo16BitPCM(audioBuffer.getChannelData(1)) : null;
          var blockSize = 1152;
          for (var i = 0; i < left.length; i += blockSize) {
            var leftChunk = left.subarray(i, i + blockSize);
            var buf;
            if (right) { buf = encoder.encodeBuffer(leftChunk, right.subarray(i, i + blockSize)); }
            else { buf = encoder.encodeBuffer(leftChunk); }
            if (buf.length > 0) mp3Chunks.push(new Int8Array(buf));
          }
          var endBuf = encoder.flush();
          if (endBuf.length > 0) mp3Chunks.push(new Int8Array(endBuf));
          resolve(new Blob(mp3Chunks, { type: 'audio/mpeg' }));
        } catch (e) { reject(e); }
        finally { audioCtx.close(); }
      }, function (err) { audioCtx.close(); reject(err || new Error('ถอดรหัสไฟล์ .wav ไม่สำเร็จ')); });
    });
  }
  var lastWavUrl = null, lastMp3Url = null;
  function showResult(wavUrl, mp3Url) {
    if (lastWavUrl) URL.revokeObjectURL(lastWavUrl);
    if (lastMp3Url) URL.revokeObjectURL(lastMp3Url);
    lastWavUrl = wavUrl; lastMp3Url = mp3Url;
    $('dlPlayerWrap').style.display = 'block';
    $('dlAudio').src = mp3Url;
    $('dlWavLink').href = wavUrl;
    $('dlMp3Link').href = mp3Url;
  }
  var TTS_VOICES = {
    th: [
      { id: 'Tanotfin/mms-tts-2081-onnx', label: 'ค่าเริ่มต้น' },
      { id: 'phlebotomy1996/mms-thai-female-podcast-spk0', label: 'หญิง (โทนพอดแคสต์)' },
      { id: 'Tanotfin/mms-tts-2081-FM-onnx', label: 'หญิง (ทั่วไป)' },
      { id: 'Tanotfin/mms-tts-2081-M-onnx', label: 'ชาย (ทั่วไป)' }
    ],
    en: [
      { id: 'Xenova/mms-tts-eng', label: 'ค่าเริ่มต้น' }
    ]
  };
  function renderVoiceOptions() {
    var lang = $('dlLang').value;
    var voices = TTS_VOICES[lang] || TTS_VOICES.th;
    $('dlVoice').innerHTML = voices.map(function (v) { return '<option value="' + v.id + '">' + v.label + '</option>'; }).join('');
  }

  /* ══════════════════ ปรับข้อความก่อนส่งเข้าโมเดลเสียงไทย (Tanotfin/mms-tts-2081-onnx) ══════════════════
     เจอจริงในโปรดักชัน: โมเดลนี้เทรนมาด้วยอักษรไทยล้วนๆ (vocab แค่ 71 ตัวอักษร ไม่รวม <unk>) ตัวเลข
     อารบิกมีอยู่ในนั้นแค่บางส่วน (0,1,2,4 เท่านั้น ไม่มี 3,5,6,7,8,9) — เจอเลขที่ไม่อยู่ใน vocab
     (เช่น "9" ใน "149") จะโดนแมปเป็น <unk> ซึ่งเป็น id ที่ตาราง embedding ของโมเดลไม่มีจริง (bug เดิม
     ที่ติดมาจากโมเดลต้นฉบับของ Meta เอง ไม่ใช่ที่เราทำพลาด) ทำให้พังกลางคัน (ONNX Runtime error:
     Gather node index out of bounds) จึงต้องแปลงตัวเลขทุกตัวเป็นคำอ่านภาษาไทยก่อนเสมอ (กันปัญหาทั้ง
     เลขที่มีจริงและไม่มีใน vocab ให้พฤติกรรมสม่ำเสมอ) แล้วกรองอักขระอื่นที่ไม่อยู่ใน vocab ทิ้ง (แทนที่
     ด้วยช่องว่าง) กันพังจากตัวอักษรแปลกอื่นๆ ที่อาจพิมพ์ปนมา (อังกฤษ, อีโมจิ, สัญลักษณ์แปลกๆ) */
  var THAI_DIGIT_WORDS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  var THAI_PLACE_WORDS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  function thaiNumberToWords(numStr) {
    numStr = numStr.replace(/^0+(?=\d)/, '');
    if (numStr === '' || numStr === '0') return THAI_DIGIT_WORDS[0];
    if (numStr.length > 7) return numStr.split('').map(function (c) { return THAI_DIGIT_WORDS[+c]; }).join(''); // เลขยาวเกินหลักล้าน อ่านทีละตัวกันซับซ้อนเกินจำเป็น
    var digits = numStr.split('').map(Number), n = digits.length, words = '';
    for (var i = 0; i < n; i++) {
      var place = n - 1 - i, d = digits[i];
      if (d === 0) continue;
      if (place === 0) words += (d === 1 && n > 1) ? 'เอ็ด' : THAI_DIGIT_WORDS[d];
      else if (place === 1) words += (d === 1) ? 'สิบ' : (d === 2) ? 'ยี่สิบ' : THAI_DIGIT_WORDS[d] + 'สิบ';
      else words += THAI_DIGIT_WORDS[d] + THAI_PLACE_WORDS[place];
    }
    return words;
  }
  var THAI_TTS_VALID_CHARS = 'าน่รเ้อกงวะัมทพยลจีคตดหขิแสบปไูใ็ื์ชุึํโผถญซธศณษฟภฉฝฐฤฏฮฆ๋ฎ\'0๊ฑ142-ฬฒฌ ';
  function normalizeForThaiTts(text) {
    var withWords = text.replace(/\d+/g, thaiNumberToWords);
    var out = '';
    for (var i = 0; i < withWords.length; i++) {
      var ch = withWords[i];
      out += THAI_TTS_VALID_CHARS.indexOf(ch) !== -1 ? ch : ' ';
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  /* แปลงวินาทีเป็นข้อความอ่านง่าย ใช้โชว์เวลาที่เหลือโดยประมาณ (ETA) ระหว่างสร้างเสียง */
  function formatEta(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 5) return 'อีกไม่กี่วินาที';
    if (sec < 60) return 'อีกประมาณ ' + sec + ' วินาที';
    var m = Math.floor(sec / 60), s = sec % 60;
    return 'อีกประมาณ ' + m + ' นาที' + (s > 0 ? ' ' + s + ' วินาที' : '');
  }
  function generateDownloadable() {
    var rawText = $('ttsText').value;
    if (!rawText.trim()) { $('dlStatus').className = 'status err'; $('dlStatus').textContent = 'พิมพ์ข้อความก่อน'; return; }
    var lang = $('dlLang').value;
    var modelId = $('dlVoice').value;
    var chunks = splitIntoTtsChunks(rawText);
    if (lang === 'th') {
      chunks = chunks.map(normalizeForThaiTts).filter(Boolean);
      if (!chunks.length) { $('dlStatus').className = 'status err'; $('dlStatus').textContent = 'ข้อความหลังตัดอักขระที่โมเดลไม่รู้จักออกแล้วว่างเปล่า ลองพิมพ์เป็นภาษาไทยดู'; return; }
    }
    $('dlGenerateBtn').disabled = true;
    $('dlStatus').className = 'status';
    $('dlStatus').textContent = lang === 'th'
      ? '⏳ กำลังเตรียมโมเดลเสียง (ครั้งแรกต้องดาวน์โหลดจาก Hugging Face — ครั้งต่อไปจะเร็วขึ้นเพราะแคชไว้แล้ว)…'
      : '⏳ กำลังเตรียมโมเดลเสียง (ครั้งแรกอาจต้องดาวน์โหลดจาก Hugging Face หลายสิบ MB — ครั้งต่อไปจะเร็วขึ้นเพราะแคชไว้แล้ว)…';
    var startedAt = Date.now();
    synthesizeMmsTtsChunksResponsive(chunks, modelId, function (p) {
      if (p && p.status === 'progress' && p.file) {
        var pct = p.progress != null ? Math.round(p.progress) : null;
        $('dlStatus').textContent = '⏳ กำลังดาวน์โหลดโมเดล: ' + p.file + (pct != null ? (' (' + pct + '%)') : '');
      }
    }, function (done, total) {
      /* นับความคืบหน้าหลังท่อนเสร็จ (ไม่ใช่ก่อนเริ่ม) — ใช้ตัวเลขเดียวกันคำนวณ ETA ได้ทั้งตอนรันขนาน
         หลาย Worker พร้อมกันและตอน fallback รันทีละท่อนในหน้าเว็บตรงๆ เพราะเป็นอัตราความเร็วรวมจริง
         ไม่ผูกกับว่ามีกี่ Worker ทำงานอยู่ */
      var elapsed = (Date.now() - startedAt) / 1000;
      var etaTxt = (done > 0 && done < total) ? (' — ' + formatEta((elapsed / done) * (total - done))) : '';
      $('dlStatus').textContent = total > 1
        ? '⏳ สร้างเสียงแล้ว ' + done + '/' + total + ' ท่อน' + etaTxt
        : '⏳ กำลังสร้างเสียง… (อาจใช้เวลาถึงหลายนาทีถ้าเครื่องไม่แรงมาก)';
    })
      .then(function (output) {
        $('dlStatus').textContent = '⏳ กำลังประกอบไฟล์เสียง…';
        var wavBlob = float32ToWavBlob(output.audio, output.sampling_rate);
        var wavUrl = URL.createObjectURL(wavBlob);
        return wavBlob.arrayBuffer().then(function (buf) {
          return wavBytesToMp3Blob(new Uint8Array(buf)).then(function (mp3Blob) {
            var mp3Url = URL.createObjectURL(mp3Blob);
            showResult(wavUrl, mp3Url);
            $('dlStatus').className = 'status ok';
            $('dlStatus').textContent = 'สร้างไฟล์เสียงเสร็จแล้ว — เล่นฟังหรือดาวน์โหลดได้ด้านล่าง';
          });
        });
      })
      .catch(function (e) {
        $('dlStatus').className = 'status err';
        /* ใส่ modelId + dtype ที่ใช้จริงต่อท้าย error เสมอ (เพิ่มเข้ามาเพื่อวินิจฉัยปัญหา cache เก่า
           ค้าง vs. ปัญหาโมเดลจริง — ถ้า error หน้าเว็บบอก dtype ไม่ตรงกับที่โค้ดล่าสุดควรใช้ แปลว่า
           browser/service worker ยังไม่ได้โหลดโค้ดใหม่จริง ไม่ใช่โมเดลพัง) */
        var usedDtype = TTS_DTYPE_OVERRIDES[modelId] || 'ดีฟอลต์ของเบราว์เซอร์ (มักเป็น q8)';
        $('dlStatus').textContent = 'สร้างไฟล์เสียงไม่สำเร็จ: ' + (e && e.message ? e.message : e)
          + ' [model=' + modelId + ', dtype=' + usedDtype + ']';
      })
      .finally(function () { $('dlGenerateBtn').disabled = false; });
  }

  /* ══════════════════ เสียง/วิดีโอ → ข้อความ (Whisper ผ่าน transformers.js, WASM ในเบราว์เซอร์) ══════════════════
     ตัวไลบรารี + ตัวรันไทม์ ONNX ฝังในเว็บเอง (vendor/transformers/) แต่ตัวโมเดล AI เอง (หลายสิบ MB)
     ต้องดาวน์โหลดจาก Hugging Face ตอนใช้ครั้งแรกเสมอ — ไม่มีทางเลี่ยงได้เพราะโมเดลใหญ่เกินจะฝังในเว็บ */
  var asrPipelinePromiseByModel = {};
  function loadAsrPipeline(modelId, onProgress) {
    if (!asrPipelinePromiseByModel[modelId]) {
      asrPipelinePromiseByModel[modelId] = import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
        var env = mod.env;
        configureOnnxWasmPaths(env);
        return mod.pipeline('automatic-speech-recognition', modelId, { progress_callback: onProgress });
      });
    }
    return asrPipelinePromiseByModel[modelId];
  }
  function resampleTo16kMono(audioBuffer) {
    var targetRate = 16000;
    var OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var offlineCtx = new OfflineCtx(1, Math.ceil(audioBuffer.duration * targetRate), targetRate);
    var source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    return offlineCtx.startRendering().then(function (rendered) { return rendered.getChannelData(0); });
  }
  function decodeFileToPcm(file) {
    return file.arrayBuffer().then(function (buf) {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      var ctx = new AudioCtx();
      return ctx.decodeAudioData(buf).then(function (audioBuffer) {
        ctx.close();
        return resampleTo16kMono(audioBuffer);
      }, function () {
        ctx.close();
        throw new Error('ถอดเสียงจากไฟล์นี้ไม่ได้ — ลองไฟล์เสียง/วิดีโอชนิดอื่น (mp3/wav/mp4/webm)');
      });
    });
  }
  function isMobileUA() { return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || ''); }
  /* หาความยาวไฟล์เสียง/วิดีโอแบบเบาๆ ผ่าน metadata ของ <audio>/<video> element (ไม่ต้องถอดเสียงทั้งไฟล์
     เหมือน decodeAudioData) ใช้แค่เช็คว่าไฟล์ยาวเกินไปสำหรับมือถือไหมก่อนเริ่มถอดเสียงจริง */
  function getMediaDuration(file) {
    return new Promise(function (resolve) {
      try {
        var isVideo = /^video\//.test(file.type) || /\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name || '');
        var el = document.createElement(isVideo ? 'video' : 'audio');
        var url = URL.createObjectURL(file);
        el.preload = 'metadata';
        el.onloadedmetadata = function () { URL.revokeObjectURL(url); resolve(isFinite(el.duration) ? el.duration : null); };
        el.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
        el.src = url;
      } catch (e) { resolve(null); }
    });
  }
  /* ══════════════════ ถอดเสียงผ่านคลาวด์ (Whisper Large v3 Turbo บน Cloudflare Workers AI) ══════════════════
     ทางเลือกแม่นกว่า/เร็วกว่าโหมดในเบราว์เซอร์ด้านบนมาก (รันบนเซิร์ฟเวอร์ ไม่ใช่เครื่องผู้ใช้) แต่มี
     ค่าใช้จ่ายจริงเมื่อเกินโควตาฟรี (10,000 Neurons/วัน ≈ 3.5 ชม.เสียง, whisper-large-v3-turbo กิน
     46.63 Neurons/นาทีเสียง) — ล็อกด้วยรหัสผ่านเดียวกับโหมด Claude Vision OCR ของหน้าตรวจสอบเอกสาร
     (doc-check.js) ตามที่ขอให้ใช้ร่วมกัน คุมค่าใช้จ่ายทั้งสองฟีเจอร์ด้วยรหัสเดียว */
  var WHISPER_WORKER_URL = 'https://tanot-whisper-proxy.tanot713.workers.dev/';
  var ASR_PW_HASH = '19ed10f154f60ec76aa832459c8631a232686dc39d6a14f7189ae91297f1896b'; // เดียวกับ doc-check.js
  var ASR_PW_UNLOCK_KEY = 'tanot:asrcloud:unlocked';
  var ASR_ENGINE_KEY = 'tanot:asr:engine';
  var NEURON_USAGE_KEY = 'tanot:asrcloud:neuronUsage'; // { date: 'YYYY-MM-DD' (UTC), used: number }
  var DAILY_NEURON_LIMIT = 10000;
  var NEURONS_PER_AUDIO_MINUTE = 46.63;

  async function sha256Hex(str) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function isAsrCloudUnlocked() {
    try { return localStorage.getItem(ASR_PW_UNLOCK_KEY) === '1'; } catch (e) { return false; }
  }
  function getAsrEngine() {
    try { return localStorage.getItem(ASR_ENGINE_KEY) === 'cloud' ? 'cloud' : 'local'; } catch (e) { return 'local'; }
  }
  function setAsrEngine(engine) {
    try { localStorage.setItem(ASR_ENGINE_KEY, engine); } catch (e) {}
  }
  function todayUTC() { return new Date().toISOString().slice(0, 10); }
  function getNeuronUsage() {
    try {
      var raw = JSON.parse(localStorage.getItem(NEURON_USAGE_KEY) || 'null');
      if (raw && raw.date === todayUTC()) return raw.used;
    } catch (e) {}
    return 0;
  }
  function addNeuronUsage(n) {
    if (!n || n < 0) return;
    try { localStorage.setItem(NEURON_USAGE_KEY, JSON.stringify({ date: todayUTC(), used: getNeuronUsage() + n })); } catch (e) {}
  }
  function remainingNeurons() { return Math.max(0, DAILY_NEURON_LIMIT - getNeuronUsage()); }
  function updateNeuronStatusUI() {
    var el = $('asrNeuronStatus');
    if (!el) return;
    el.textContent = 'ใช้ไปแล้ววันนี้ ' + Math.round(getNeuronUsage()) + ' / ' + DAILY_NEURON_LIMIT + ' Neurons (เหลือฟรี ~' +
      (remainingNeurons() / NEURONS_PER_AUDIO_MINUTE / 60).toFixed(1) + ' ชม.เสียง)';
  }

  /* แปลง PCM Float32 (16kHz mono ที่ decodeFileToPcm/resampleTo16kMono ให้มาอยู่แล้ว) เป็น base64
     ของไฟล์ .wav — ใช้ float32ToWavBlob() ที่มีอยู่แล้วในไฟล์นี้ (เดิมใช้ห่อเสียงจาก MMS-TTS) แทนเขียน
     WAV header ซ้ำเอง Workers AI ต้องการไฟล์เสียงจริงเป็น base64 ไม่ใช่ raw sample ลอยๆ */
  function pcmToWavBase64(pcm, sampleRate) {
    return float32ToWavBlob(pcm, sampleRate).arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf), binary = '', chunkSize = 0x8000;
      for (var i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      return btoa(binary);
    });
  }

  /* หาจุดตัดที่ใกล้ตำแหน่งเป้าหมาย (targetIdx) ที่สุด โดยเลือกจุดที่พลังงานเสียงต่ำสุด (เงียบที่สุด) ในช่วง
     ค้นหา ±searchSamples รอบๆ เป้าหมาย — ใช้แบ่งท่อนเสียงส่งไปถอดทีละท่อน */
  function findQuietCutPoint(pcm, targetIdx, searchSamples, frameLen) {
    var lo = Math.max(0, targetIdx - searchSamples), hi = Math.min(pcm.length, targetIdx + searchSamples);
    var bestIdx = targetIdx, bestEnergy = Infinity;
    for (var i = lo; i < hi; i += frameLen) {
      var end = Math.min(i + frameLen, pcm.length), sum = 0;
      for (var j = i; j < end; j++) sum += pcm[j] * pcm[j];
      var energy = sum / (end - i);
      if (energy < bestEnergy) { bestEnergy = energy; bestIdx = i; }
    }
    return bestIdx;
  }
  /* ตัด PCM ยาวๆ เป็นท่อนละประมาณ chunkSec วินาที — เดิมตัดตรงจุดตายตัวเป๊ะๆ ทุก chunkSec วินาที ซึ่งเจอ
     ปัญหาจริงว่าตัดกลางคำ/กลางประโยคบ่อย (โดยเฉพาะเสียงประชุมยาวๆ) ทำให้ Whisper "หลอน" ออกมาเป็นคำ
     แปลกๆ/ภาษาอื่นปนที่รอยต่อแต่ละท่อน แก้โดยขยับจุดตัดไปหาช่วงที่เงียบที่สุดในรัศมี ±3 วินาทีรอบเป้าหมาย
     แทน (ค้นด้วย findQuietCutPoint ด้านบน) ให้ท่อนที่ตัดจบพอดีตรงช่วงเงียบ/หยุดพูดแทนกลางคำ */
  function chunkPcm(pcm, sampleRate, chunkSec) {
    var chunkLen = sampleRate * chunkSec, searchSamples = sampleRate * 3, frameLen = Math.round(sampleRate * 0.02);
    var chunks = [], start = 0;
    while (start < pcm.length) {
      var target = start + chunkLen;
      if (target >= pcm.length) { chunks.push(pcm.subarray(start, pcm.length)); break; }
      var cut = findQuietCutPoint(pcm, target, searchSamples, frameLen);
      if (cut <= start) cut = target; // กันท่อนว่างเปล่า/จุดตัดถอยหลังไปทับท่อนก่อนหน้า
      chunks.push(pcm.subarray(start, cut));
      start = cut;
    }
    return chunks;
  }

  function transcribeChunkCloud(pcm, sampleRate, language) {
    return pcmToWavBase64(pcm, sampleRate).then(function (base64) {
      return fetch(WHISPER_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, language: language })
      });
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data && data.error ? data.error : ('HTTP ' + res.status));
        return data;
      });
    });
  }

  async function runAsrCloud(pcm, langOpt) {
    var langMap = { thai: 'th', english: 'en' };
    var language = langOpt !== 'auto' ? langMap[langOpt] : undefined;
    var sampleRate = 16000;
    var totalMinutes = pcm.length / sampleRate / 60;
    var estimatedNeurons = totalMinutes * NEURONS_PER_AUDIO_MINUTE;

    if (estimatedNeurons > remainingNeurons()) {
      /* คิดค่าใช้จ่ายจากเฉพาะส่วนที่เกินโควตาฟรี ไม่ใช่ยอดรวมทั้งไฟล์ (โควตาฟรี 10,000 Neurons/วัน
         ไม่เสียเงินอยู่แล้ว เสียเฉพาะส่วนเกิน) */
      var overageNeurons = estimatedNeurons - remainingNeurons();
      var estCost = (overageNeurons / 1000 * 0.011).toFixed(3);
      var proceed = window.confirm(
        'เสียงไฟล์นี้ยาว ~' + totalMinutes.toFixed(1) + ' นาที ต้องใช้ ~' + Math.round(estimatedNeurons) + ' Neurons ' +
        'แต่วันนี้เหลือโควตาฟรีแค่ ' + Math.round(remainingNeurons()) + ' Neurons (ใช้ไปแล้ว ' + Math.round(getNeuronUsage()) + '/' + DAILY_NEURON_LIMIT + ') — ' +
        'ส่วนที่เกิน ~' + Math.round(overageNeurons) + ' Neurons จะมีค่าใช้จ่ายจริง (~$' + estCost + ') กดตกลงเพื่อทำต่อ หรือยกเลิกเพื่อหยุด'
      );
      if (!proceed) throw new Error('ยกเลิกแล้ว (เกินโควตาฟรีวันนี้)');
    }

    var chunks = chunkPcm(pcm, sampleRate, 30);
    var texts = [];
    for (var i = 0; i < chunks.length; i++) {
      $('asrStatus').textContent = '⏳ กำลังถอดเสียงผ่านคลาวด์… ท่อน ' + (i + 1) + '/' + chunks.length;
      var data = await transcribeChunkCloud(chunks[i], sampleRate, language);
      texts.push((data.text || '').trim());
      /* บันทึก Neurons จริงจาก response ถ้ามี (แม่นกว่าประมาณจากความยาวเสียงเอง) ไม่มีก็ใช้ค่าประมาณ
         ของท่อนนี้แทน (ความยาวท่อนเป็นวินาทีคูณอัตรา Neurons/นาที) */
      var chunkMinutes = chunks[i].length / sampleRate / 60;
      addNeuronUsage(data.neurons != null ? data.neurons : chunkMinutes * NEURONS_PER_AUDIO_MINUTE);
      updateNeuronStatusUI();
    }
    return texts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function runAsr() {
    var fileInput = $('asrFile');
    var file = fileInput.files && fileInput.files[0];
    if (!file) { $('asrStatus').className = 'status err'; $('asrStatus').textContent = 'เลือกไฟล์เสียง/วิดีโอก่อน'; return; }
    var langOpt = $('asrLang').value;
    var engine = getAsrEngine();
    $('asrGoBtn').disabled = true;
    $('asrResultWrap').style.display = 'none';
    $('asrStatus').className = 'status';

    /* มือถือมีหน่วยความจำแท็บเบราว์เซอร์จำกัดกว่าคอมมาก — ถอดเสียงไฟล์ยาวมาก (เช่นอัดประชุมทั้งวัน)
       เสี่ยงทำให้แท็บแครชกลางทาง (เสียหมด ไม่เหลือผลลัพธ์บางส่วนให้เลย) เช็คความยาวไฟล์แบบเบาๆ ก่อน
       (ไม่ถอดเสียงทั้งไฟล์) แล้วเตือนถ้ายาวเกินไปบนมือถือ ให้ผู้ใช้เลือกเองว่าจะเสี่ยงต่อหรือไม่ */
    if (!isMobileUA()) { proceedRunAsr(file, langOpt, engine); return; }
    getMediaDuration(file).then(function (durSec) {
      var mins = durSec ? Math.round(durSec / 60) : null;
      if (mins && mins > 45) {
        var proceed = window.confirm(
          'ไฟล์นี้ยาว ~' + mins + ' นาที การถอดเสียงไฟล์ยาวขนาดนี้บนมือถืออาจทำให้เบราว์เซอร์ค้างหรือแครชกลางทาง ' +
          '(หน่วยความจำจำกัดกว่าคอม) แนะนำให้ใช้คอมพิวเตอร์แทน หรือตัดไฟล์ให้สั้นลงก่อน — กดตกลงถ้าต้องการลองต่อบนมือถือนี้เลย'
        );
        if (!proceed) { $('asrGoBtn').disabled = false; $('asrStatus').textContent = 'ยกเลิกแล้ว'; return; }
      }
      proceedRunAsr(file, langOpt, engine);
    });
  }
  function proceedRunAsr(file, langOpt, engine) {
    if (engine === 'cloud') {
      $('asrStatus').textContent = '⏳ กำลังถอดรหัสไฟล์เสียง…';
      decodeFileToPcm(file)
        .then(function (pcm) { return runAsrCloud(pcm, langOpt); })
        .then(function (text) {
          $('asrResult').value = text;
          $('asrResultWrap').style.display = 'block';
          $('asrStatus').className = 'status ok';
          $('asrStatus').textContent = text ? 'ถอดเสียงเสร็จแล้ว (คลาวด์)' : 'ถอดเสียงเสร็จแต่ไม่พบคำพูดในไฟล์นี้';
          updateNeuronStatusUI();
        })
        .catch(function (e) {
          $('asrStatus').className = 'status err';
          $('asrStatus').textContent = 'ถอดเสียงไม่สำเร็จ: ' + (e && e.message ? e.message : e);
        })
        .finally(function () { $('asrGoBtn').disabled = false; });
      return;
    }

    var modelId = $('asrModel').value;
    $('asrStatus').textContent = '⏳ กำลังเตรียมโมเดล AI (ครั้งแรกอาจต้องดาวน์โหลดจาก Hugging Face หลายสิบ MB — ครั้งต่อไปจะเร็วขึ้นเพราะแคชไว้แล้ว)…';
    var transcriberPromise = loadAsrPipeline(modelId, function (p) {
      if (p && p.status === 'progress' && p.file) {
        var pct = p.progress != null ? Math.round(p.progress) : null;
        $('asrStatus').textContent = '⏳ กำลังดาวน์โหลดโมเดล: ' + p.file + (pct != null ? (' (' + pct + '%)') : '');
      }
    });
    Promise.all([transcriberPromise, decodeFileToPcm(file)])
      .then(function (results) {
        var transcriber = results[0], pcm = results[1];
        $('asrStatus').textContent = '⏳ กำลังถอดเสียงเป็นข้อความ…';
        /* Whisper เทรนมาให้รับเสียงทีละ ≤30 วินาทีเท่านั้น — ถ้าไม่บอก chunk_length_s/stride_length_s
           ไฟล์เสียงที่ยาวกว่า 30 วินาทีจะถูกยัดเข้าโมเดลเป็นก้อนเดียวทั้งไฟล์ ทำให้โมเดล "หลอน"
           (hallucinate) ออกมาเป็นคำซ้ำๆ ไม่จบ (เจอจริง เช่น "นำ นำ นำ นำ..." ไม่หยุด) แก้โดยบอกให้ตัด
           เสียงเป็นท่อนละ 30 วินาที เหลื่อมกันท่อนละ 5 วินาที (กันคำขาดตรงรอยตัด) แล้วรวมผลลัพธ์กลับ
           มาเป็นข้อความเดียวให้เอง — ค่านี้ใช้ได้ทั้งไฟล์สั้น/ยาว (ไฟล์สั้นกว่า 30 วิ ก็แค่ได้ท่อนเดียว)
           การตัดเป็นท่อนช่วยกันไม่ให้ทั้งไฟล์วนซ้ำเป็นก้อนเดียว แต่แต่ละท่อนเองก็ยังวนซ้ำได้อยู่ดี
           (โดยเฉพาะโมเดลขนาดเล็ก/ภาษาที่โมเดลไม่ถนัด เช่นไทย) — กันด้วย no_repeat_ngram_size บังคับ
           ไม่ให้มี 3 คำ/โทเคนติดกันซ้ำแบบเป๊ะๆ เกิดขึ้นซ้ำสอง ตัดวงจรการวนคำได้โดยไม่กระทบประโยคปกติ
           (ประโยคจริงแทบไม่มี 3-gram ซ้ำเป๊ะติดกันอยู่แล้ว) */
        var opts = { task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, no_repeat_ngram_size: 3 };
        if (langOpt !== 'auto') opts.language = langOpt;
        return transcriber(pcm, opts);
      })
      .then(function (result) {
        var text = (result && result.text) || '';
        $('asrResult').value = text.trim();
        $('asrResultWrap').style.display = 'block';
        $('asrStatus').className = 'status ok';
        $('asrStatus').textContent = text.trim() ? 'ถอดเสียงเสร็จแล้ว' : 'ถอดเสียงเสร็จแต่ไม่พบคำพูดในไฟล์นี้';
      })
      .catch(function (e) {
        $('asrStatus').className = 'status err';
        $('asrStatus').textContent = 'ถอดเสียงไม่สำเร็จ: ' + (e && e.message ? e.message : e);
      })
      .finally(function () { $('asrGoBtn').disabled = false; });
  }
  function copyAsrResult() {
    var text = $('asrResult').value;
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      $('asrStatus').className = 'status ok'; $('asrStatus').textContent = 'คัดลอกข้อความแล้ว';
    }).catch(function () {
      $('asrResult').select();
      document.execCommand('copy');
    });
  }

  /* ══════════════════ สรุปประชุมด้วย AI (รันในเบราว์เซอร์ ฟรี) → ส่งออกเป็นไฟล์ Word (.docx) ══════════════════
     ใช้ ai-chat-worker.js ตัวเดียวกับที่หน้าลงทุนใช้สรุปข่าว (โมเดลเล็ก/ใหญ่แข่งกันหาโหลดได้ก่อนใน worker
     คนละตัวกัน กันปัญหาหน่วยความจำ WASM ปนกันที่เคยเจอมาก่อน) — บทถอดเสียงประชุมมักยาวเกินกว่าโมเดลเล็ก
     (context window จำกัด) จะสรุปทีเดียวจบได้ดี จึงตัดเป็นท่อนๆ สรุปย่อทีละท่อนก่อน (map) แล้วเอาสรุปย่อย
     ทั้งหมดมาสังเคราะห์เป็นสรุปเดียวอีกที (reduce) — ข้อจำกัดตามจริง: (1) ไม่แยกผู้พูด เพราะ Whisper ถอด
     ได้แค่เนื้อความ ไม่บอกว่าใครพูด (2) โมเดลเล็กฟรีที่รันบนเบราว์เซอร์ได้ คุณภาพสรุปภาษาไทยสู้โมเดลใหญ่
     ระดับเซิร์ฟเวอร์ไม่ได้ ต้องตรวจทานก่อนใช้จริงเสมอ */
  function isIOS() {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }
  /* โมเดลเล็กบางครั้ง "พูดตาม" ข้อความ system/reminder ที่สั่งห้ามออกมาเป็นเนื้อหาจริง แทนที่จะทำตามคำสั่ง
     เงียบๆ — กรองทิ้งบรรทัดที่ขึ้นต้นด้วย "ห้าม"/"Never" (ปัญหาเดียวกับที่เจอในหน้าสรุปข่าวหุ้น) */
  function stripLeakedInstructions(text) {
    return (text || '').split('\n').filter(function (line) {
      return !/^\s*(ห้าม|Never\b)/i.test(line);
    }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function chunkText(text, maxChars) {
    var paras = text.split(/\n+/), chunks = [], cur = '';
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      if (cur && (cur.length + p.length + 1) > maxChars) { chunks.push(cur); cur = p; }
      else cur = cur ? cur + '\n' + p : p;
    }
    if (cur) chunks.push(cur);
    return chunks;
  }

  var meetingSumWorker = null, meetingSumWorkerRacePromise = null;
  function spawnProbedWorkerForMeeting(modelKind) {
    return new Promise(function (resolve, reject) {
      var w = new Worker('./ai-chat-worker.js', { type: 'module' });
      var probeId = 'probe-' + modelKind + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      function onMsg(e) {
        var msg = e.data;
        if (!msg || msg.jobId !== probeId || msg.type !== 'probe-result') return;
        w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr);
        if (msg.ok) resolve(w);
        else { try { w.terminate(); } catch (err) {} reject(new Error(msg.message || 'probe failed')); }
      }
      function onErr(e) {
        w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr);
        try { w.terminate(); } catch (err) {}
        reject(e);
      }
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage({ type: 'probe', jobId: probeId, modelId: modelKind });
    });
  }
  /* ใช้ key เดียวกับหน้าลงทุน (tanot:aiChat:noBigModel) — เบราว์เซอร์เดียวกัน ถ้าเคยรู้แล้วว่าโมเดลใหญ่
     พังบนเครื่องนี้ ไม่ต้องลองซ้ำอีกไม่ว่าจะเข้าหน้าไหนของเว็บ */
  var AI_BIG_MODEL_BLOCKLIST_KEY = 'tanot:aiChat:noBigModel';
  function getMeetingSumWorkerAsync() {
    if (meetingSumWorker) return Promise.resolve(meetingSumWorker);
    if (meetingSumWorkerRacePromise) return meetingSumWorkerRacePromise;
    var mem = (typeof navigator !== 'undefined') ? navigator.deviceMemory : undefined;
    var noBig = false;
    try { noBig = localStorage.getItem(AI_BIG_MODEL_BLOCKLIST_KEY) === '1'; } catch (e) {}
    var canTryBig = !noBig && typeof navigator !== 'undefined' && !!navigator.gpu && mem && mem >= 4;
    var candidates = canTryBig
      ? [spawnProbedWorkerForMeeting('big').catch(function (err) {
          try { localStorage.setItem(AI_BIG_MODEL_BLOCKLIST_KEY, '1'); } catch (e2) {}
          throw err;
        }), spawnProbedWorkerForMeeting('small')]
      : [spawnProbedWorkerForMeeting('small')];
    meetingSumWorkerRacePromise = Promise.any(candidates).then(function (winner) {
      meetingSumWorker = winner; meetingSumWorkerRacePromise = null;
      candidates.forEach(function (p) { p.then(function (w) { if (w !== winner) { try { w.terminate(); } catch (err) {} } }, function () {}); });
      return winner;
    }, function () {
      meetingSumWorkerRacePromise = null;
      var w = new Worker('./ai-chat-worker.js', { type: 'module' });
      meetingSumWorker = w;
      return w;
    });
    return meetingSumWorkerRacePromise;
  }
  /* ส่ง messages ไปคุยกับ worker ทีละครั้ง คืนข้อความตอบกลับแบบเต็ม (รอจน 'done') — ใช้ซ้ำได้หลายครั้ง
     กับ worker ตัวเดิม (map แล้ว reduce ต้องคุยหลายรอบ ไม่อยากสร้าง/โหลดโมเดลใหม่ทุกรอบ) */
  function runChatOnce(worker, messages, maxNewTokens) {
    return new Promise(function (resolve, reject) {
      var jobId = 'ms-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      var replyText = '';
      function onMsg(e) {
        var msg = e.data;
        if (!msg || msg.jobId !== jobId) return;
        if (msg.type === 'token') replyText += msg.token;
        else if (msg.type === 'done') { cleanup(); resolve(stripLeakedInstructions(replyText)); }
        else if (msg.type === 'error') { cleanup(); reject(new Error(msg.message || 'chat failed')); }
      }
      function onErr(e) { cleanup(); reject(e); }
      function cleanup() { worker.removeEventListener('message', onMsg); worker.removeEventListener('error', onErr); }
      worker.addEventListener('message', onMsg);
      worker.addEventListener('error', onErr);
      worker.postMessage({ type: 'chat', jobId: jobId, messages: messages, maxNewTokens: maxNewTokens });
    });
  }

  var MEETING_CHUNK_SYSTEM = 'คุณเป็นผู้ช่วยสรุปการประชุม อ่านข้อความถอดเสียงประชุมส่วนหนึ่งด้านล่าง แล้วสรุปประเด็นสำคัญที่พูดถึงเป็นข้อๆ สั้นๆ เท่านั้น (ขึ้นต้นแต่ละข้อด้วย "- ") ห้ามทักทาย ห้ามใส่ความเห็นส่วนตัว ห้ามเดาสิ่งที่ไม่ได้พูดถึงในข้อความ';
  var MEETING_FINAL_SYSTEM = 'คุณเป็นผู้ช่วยเขียนสรุปการประชุมฉบับสมบูรณ์ จากบันทึกย่อหลายช่วงของการประชุมเดียวกันด้านล่าง ให้เขียนตามโครงสร้างหัวข้อนี้เป๊ะๆ (แต่ละหัวข้อขึ้นบรรทัดใหม่ จบด้วย ":" ตามด้วยเนื้อหา):\n\nภาพรวมการประชุม:\n(ย่อหน้าสั้นๆ 2-3 ประโยค)\n\nประเด็นสำคัญที่พูดคุย:\n(รายการ ขึ้นต้นแต่ละข้อด้วย "- ")\n\nการตัดสินใจ:\n(รายการ หรือถ้าไม่มีการตัดสินใจชัดเจนให้เขียนว่า "ไม่มีการตัดสินใจที่ชัดเจนในบันทึกนี้")\n\nงานที่ต้องติดตาม:\n(รายการ หรือถ้าไม่มีให้เขียนว่า "ไม่มีงานที่ต้องติดตามที่ระบุชัดเจน")';
  var MEETING_FINAL_REMINDER = 'ตอบตามโครงสร้างหัวข้อด้านบนเท่านั้น เริ่มตอบด้วย "ภาพรวมการประชุม:" ทันที ไม่ต้องมีคำนำ ไม่ต้องอธิบายว่ากำลังทำอะไร';

  function setMeetingSumStatus(text, cls) {
    var el = $('meetingSumStatus'); if (!el) return;
    el.textContent = text || ''; el.className = 'status' + (cls ? ' ' + cls : '');
  }

  var meetingSumBusy = false;
  function doMeetingSummary() {
    if (meetingSumBusy) return;
    var transcript = ($('asrResult').value || '').trim();
    if (!transcript) { setMeetingSumStatus('ยังไม่มีข้อความที่ถอดเสียงไว้', 'err'); return; }
    if (isIOS()) { setMeetingSumStatus('โหมดนี้ไม่รองรับบน iPhone/iPad (เบราว์เซอร์มือถือรุ่นนี้รันโมเดล AI แบบนี้ไม่เสถียร) — ใช้คอมพิวเตอร์แทน', 'err'); return; }
    if (typeof window.docx === 'undefined') { setMeetingSumStatus('โหลดไลบรารีสร้างไฟล์ Word ไม่สำเร็จ ลองรีเฟรชหน้านี้ใหม่', 'err'); return; }

    meetingSumBusy = true;
    $('meetingSumBtn').disabled = true;
    $('meetingSumWrap').style.display = 'none';
    setMeetingSumStatus('⏳ กำลังเตรียมโมเดล AI…', '');

    var chunks = chunkText(transcript, 1800);

    getMeetingSumWorkerAsync().then(function (worker) {
      var chunkSummaries = [];
      function summarizeNextChunk(i) {
        if (i >= chunks.length) return Promise.resolve();
        setMeetingSumStatus('⏳ กำลังสรุปช่วงที่ ' + (i + 1) + '/' + chunks.length + '…', '');
        return runChatOnce(worker, [
          { role: 'system', content: MEETING_CHUNK_SYSTEM },
          { role: 'user', content: chunks[i] }
        ], 180).then(function (summary) {
          chunkSummaries.push(summary);
          return summarizeNextChunk(i + 1);
        });
      }
      return summarizeNextChunk(0).then(function () {
        if (chunks.length === 1) return chunkSummaries[0];
        setMeetingSumStatus('⏳ กำลังรวมเป็นสรุปฉบับเดียว…', '');
        return runChatOnce(worker, [
          { role: 'system', content: MEETING_FINAL_SYSTEM },
          { role: 'user', content: chunkSummaries.join('\n\n') },
          { role: 'system', content: MEETING_FINAL_REMINDER }
        ], 350);
      });
    }).then(function (finalSummary) {
      finalSummary = (finalSummary || '').trim();
      if (!finalSummary) { setMeetingSumStatus('สรุปไม่สำเร็จ ไม่ได้คำตอบจากโมเดล', 'err'); return; }
      $('meetingSumResult').value = finalSummary;
      $('meetingSumWrap').style.display = 'block';
      setMeetingSumStatus('สรุปเสร็จแล้ว ตรวจทานก่อนดาวน์โหลดได้เลย', 'ok');
      return buildMeetingDocxBlob(finalSummary, transcript).then(function (blob) {
        var link = $('meetingDocxLink');
        if (link.dataset.prevUrl) URL.revokeObjectURL(link.dataset.prevUrl);
        var url = URL.createObjectURL(blob);
        link.href = url;
        link.dataset.prevUrl = url;
      });
    }).catch(function (e) {
      setMeetingSumStatus('สรุปไม่สำเร็จ: ' + (e && e.message ? e.message : e), 'err');
    }).finally(function () {
      meetingSumBusy = false;
      $('meetingSumBtn').disabled = false;
    });
  }

  /* แปลงสรุป (ข้อความมีโครงหัวข้อ "...:" / บูลเล็ต "- ") + บทถอดเสียงเต็ม (เก็บเป็นภาคผนวก) เป็นไฟล์ .docx
     จริง ใช้ไลบรารี docx.js ตัวเดียวกับหน้า "พิมพ์และแก้ไขเอกสาร" (word.js) แต่สร้างแบบง่ายตรงๆ ไม่ผ่าน
     กลไกแปลง HTML เต็มรูปแบบของหน้านั้น เพราะที่นี่มีแค่ข้อความล้วนที่มีโครงสร้างชัดเจนอยู่แล้ว */
  function buildMeetingDocxBlob(summaryText, transcriptText) {
    var docx = window.docx;
    var FONT = 'TH Sarabun New', SIZE = 32; // 16pt — ขนาดมาตรฐานเอกสารไทย เดียวกับ word.js
    function titleP(text) { return new docx.Paragraph({ children: [new docx.TextRun({ text: text, bold: true, font: FONT, size: 48 })], spacing: { after: 60 } }); }
    function metaP(text) { return new docx.Paragraph({ children: [new docx.TextRun({ text: text, italics: true, font: FONT, size: 24, color: '727C93' })], spacing: { after: 200 } }); }
    function headingP(text) { return new docx.Paragraph({ children: [new docx.TextRun({ text: text, bold: true, font: FONT, size: 36 })], spacing: { before: 200, after: 100 } }); }
    function bodyP(text) { return new docx.Paragraph({ children: [new docx.TextRun({ text: text, font: FONT, size: SIZE })], spacing: { after: 80 } }); }
    function bulletP(text) { return new docx.Paragraph({ children: [new docx.TextRun({ text: text, font: FONT, size: SIZE })], bullet: { level: 0 }, spacing: { after: 40 } }); }

    var children = [
      titleP('สรุปการประชุม'),
      metaP('สร้างโดย AI จากข้อความถอดเสียง — ' + new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }))
    ];
    summaryText.split('\n').forEach(function (line) {
      var s = line.trim();
      if (!s) return;
      if (/^[-•]\s+/.test(s)) children.push(bulletP(s.replace(/^[-•]\s+/, '')));
      else if (/:$/.test(s) && s.length < 60) children.push(headingP(s.replace(/:$/, '')));
      else children.push(bodyP(s));
    });
    if (transcriptText) {
      children.push(new docx.Paragraph({ children: typeof docx.PageBreak === 'function' ? [new docx.PageBreak()] : [] }));
      children.push(headingP('ภาคผนวก: ข้อความที่ถอดเสียงได้ทั้งหมด'));
      transcriptText.split('\n').forEach(function (line) { if (line.trim()) children.push(bodyP(line.trim())); });
    }

    var doc = new docx.Document({
      sections: [{ children: children }],
      styles: { default: { document: { run: { font: FONT, size: SIZE } } } }
    });
    return docx.Packer.toBlob(doc);
  }

  /* ══════════════════ init ══════════════════ */
  function init() {
    $('ttsText').addEventListener('input', updateCharCount);
    updateCharCount();
    $('importFileBtn').addEventListener('click', function () { $('importFileInput').click(); });
    $('importFileInput').addEventListener('change', importFileChange);

    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadWsVoices;
      loadWsVoices();
    } else {
      renderWsVoiceOptions();
    }
    $('wsPlayBtn').addEventListener('click', wsPlay);
    $('wsPauseBtn').addEventListener('click', wsPauseToggle);
    $('wsStopBtn').addEventListener('click', wsStop);
    $('wsRate').addEventListener('input', function () { $('wsRateVal').textContent = parseFloat($('wsRate').value).toFixed(1) + 'x'; });

    renderVoiceOptions();
    $('dlLang').addEventListener('change', renderVoiceOptions);
    $('dlGenerateBtn').addEventListener('click', generateDownloadable);

    $('asrGoBtn').addEventListener('click', runAsr);
    $('asrCopyBtn').addEventListener('click', copyAsrResult);
    $('meetingSumBtn').addEventListener('click', doMeetingSummary);

    /* ══ เลือกโหมดถอดเสียง (ในเบราว์เซอร์ฟรี / คลาวด์แม่นกว่า) — ล็อกโหมดคลาวด์ด้วยรหัสผ่าน ══ */
    var asrEngineToggle = $('asrEngineToggle'), asrEngineNote = $('asrEngineNote'),
      asrModelField = $('asrModelField'), asrPwOverlay = $('asrPwOverlay'), asrPwInput = $('asrPwInput'),
      asrPwErr = $('asrPwErr'), asrPwCancel = $('asrPwCancel'), asrPwSubmit = $('asrPwSubmit');

    function applyAsrEngineUI() {
      if (!asrEngineToggle) return;
      var engine = getAsrEngine();
      asrEngineToggle.querySelectorAll('[data-ae]').forEach(function (span) {
        span.classList.toggle('active', span.getAttribute('data-ae') === engine);
      });
      if (asrEngineNote) asrEngineNote.style.display = engine === 'cloud' ? 'block' : 'none';
      if (asrModelField) asrModelField.style.display = engine === 'cloud' ? 'none' : '';
      if (engine === 'cloud') updateNeuronStatusUI();
    }
    function showAsrPwModal() {
      if (!asrPwOverlay) return;
      asrPwErr.style.display = 'none';
      asrPwInput.value = '';
      asrPwOverlay.style.display = 'flex';
      asrPwInput.focus();
    }
    function hideAsrPwModal() {
      if (asrPwOverlay) asrPwOverlay.style.display = 'none';
    }
    function submitAsrPw() {
      var pw = asrPwInput.value;
      sha256Hex(pw).then(function (hex) {
        if (hex === ASR_PW_HASH) {
          try { localStorage.setItem(ASR_PW_UNLOCK_KEY, '1'); } catch (e) {}
          hideAsrPwModal();
          setAsrEngine('cloud');
          applyAsrEngineUI();
        } else {
          asrPwErr.style.display = 'block';
          asrPwInput.value = '';
          asrPwInput.focus();
        }
      });
    }
    if (asrEngineToggle) {
      asrEngineToggle.addEventListener('click', function (e) {
        var span = e.target.closest('[data-ae]');
        if (!span) return;
        var engine = span.getAttribute('data-ae');
        if (engine === 'cloud' && !isAsrCloudUnlocked()) { showAsrPwModal(); return; }
        setAsrEngine(engine);
        applyAsrEngineUI();
      });
    }
    if (asrPwCancel) asrPwCancel.addEventListener('click', hideAsrPwModal);
    if (asrPwSubmit) asrPwSubmit.addEventListener('click', submitAsrPw);
    if (asrPwInput) asrPwInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitAsrPw(); });
    applyAsrEngineUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__tts = {
    synthesizeMmsTts: synthesizeMmsTts, float32ToWavBlob: float32ToWavBlob,
    wavBytesToMp3Blob: wavBytesToMp3Blob, floatTo16BitPCM: floatTo16BitPCM,
    loadAsrPipeline: loadAsrPipeline, decodeFileToPcm: decodeFileToPcm, resampleTo16kMono: resampleTo16kMono,
    isMobileUA: isMobileUA, getMediaDuration: getMediaDuration,
    splitIntoTtsChunks: splitIntoTtsChunks, ttsPoolSize: ttsPoolSize, formatEta: formatEta,
    synthesizeMmsTtsChunks: synthesizeMmsTtsChunks,
    synthesizeMmsTtsChunksInWorkerPool: synthesizeMmsTtsChunksInWorkerPool,
    synthesizeMmsTtsChunksResponsive: synthesizeMmsTtsChunksResponsive,
    chunkText: chunkText, buildMeetingDocxBlob: buildMeetingDocxBlob, isIOS: isIOS,
    chunkPcm: chunkPcm, findQuietCutPoint: findQuietCutPoint
  };
})();
