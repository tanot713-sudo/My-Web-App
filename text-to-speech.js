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
        เอง แค่ชี้ไปไฟล์ที่ฝังในเว็บนี้แทน jsdelivr) */
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
      $('wsThaiNote').textContent = '⚠️ เบราว์เซอร์นี้ไม่รองรับการฟังเสียงสด — ใช้การ์ด "สร้างไฟล์เสียง" ด้านล่างแทนได้';
      $('wsPlayBtn').disabled = true;
      return;
    }
    if (!wsVoices.length) {
      sel.innerHTML = '<option value="">(ยังไม่พบเสียง — บางเบราว์เซอร์โหลดช้า ลองรอสักครู่)</option>';
      $('wsThaiNote').textContent = 'กำลังตรวจสอบเสียงที่มีในเครื่องนี้…';
      return;
    }
    var thaiVoices = wsVoices.filter(function (v) { return /^th/i.test(v.lang); });
    sel.innerHTML = wsVoices.map(function (v, i) {
      return '<option value="' + i + '">' + v.name + ' (' + v.lang + ')' + (v.default ? ' — ค่าเริ่มต้น' : '') + '</option>';
    }).join('');
    var defaultIdx = wsVoices.findIndex(function (v) { return v.default; });
    if (defaultIdx >= 0) sel.value = String(defaultIdx);
    $('wsThaiNote').textContent = thaiVoices.length
      ? ('✅ พบเสียงภาษาไทยในเครื่องนี้ ' + thaiVoices.length + ' เสียง: ' + thaiVoices.map(function (v) { return v.name; }).join(', '))
      : '⚠️ ไม่พบเสียงภาษาไทยในเบราว์เซอร์/เครื่องนี้ตอนนี้ — ลองใช้ Chrome หรือเปิดใช้ภาษาไทยในการตั้งค่าเสียงพูดของอุปกรณ์ ถ้าไม่มีให้ข้ามไปใช้การ์ด "สร้างไฟล์เสียง" ด้านล่างแทน (รองรับไทยเสมอ)';
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
    u.onstart = function () { $('wsStatus').className = 'status ok'; $('wsStatus').textContent = '🔊 กำลังเล่น…'; };
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
      $('wsStatus').className = 'status ok'; $('wsStatus').textContent = '🔊 กำลังเล่น…';
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
  function loadTtsPipeline(modelId, onProgress) {
    if (!ttsPipelinePromiseByModel[modelId]) {
      ttsPipelinePromiseByModel[modelId] = import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
        var env = mod.env;
        configureOnnxWasmPaths(env);
        /* โมเดลเสียงไทยที่แปลงเอง (Tanotfin/mms-tts-tha-onnx) มีแค่ onnx/model.onnx (fp32) เท่านั้น
           ยังไม่ได้ทำเวอร์ชันบีบอัด (quantized) — แต่ transformers.js ดีฟอลต์จะลองโหลด
           onnx/model_quantized.onnx ก่อนเสมอถ้าไม่ระบุ dtype เอง ทำให้หาไฟล์ไม่เจอ (404)
           ต้องบังคับ dtype:'fp32' เฉพาะโมเดลนี้ — โมเดลอังกฤษของ Xenova แปลงมาพร้อมไฟล์
           quantized จริงอยู่แล้ว ปล่อยให้ใช้ดีฟอลต์เดิมต่อไปไม่ต้องยุ่ง */
        var opts = { progress_callback: onProgress };
        if (modelId === 'Tanotfin/mms-tts-tha-onnx') opts.dtype = 'fp32';
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
  var TTS_MODELS = { th: 'Tanotfin/mms-tts-tha-onnx', en: 'Xenova/mms-tts-eng' };

  /* ══════════════════ ปรับข้อความก่อนส่งเข้าโมเดลเสียงไทย (Tanotfin/mms-tts-tha-onnx) ══════════════════
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

  function generateDownloadable() {
    var text = $('ttsText').value;
    if (!text.trim()) { $('dlStatus').className = 'status err'; $('dlStatus').textContent = 'พิมพ์ข้อความก่อน'; return; }
    var lang = $('dlLang').value;
    var modelId = TTS_MODELS[lang];
    if (lang === 'th') {
      text = normalizeForThaiTts(text);
      if (!text) { $('dlStatus').className = 'status err'; $('dlStatus').textContent = 'ข้อความหลังตัดอักขระที่โมเดลไม่รู้จักออกแล้วว่างเปล่า ลองพิมพ์เป็นภาษาไทยดู'; return; }
    }
    $('dlGenerateBtn').disabled = true;
    $('dlStatus').className = 'status';
    $('dlStatus').textContent = lang === 'th'
      ? '⏳ กำลังเตรียมโมเดลเสียง (ครั้งแรกต้องดาวน์โหลดจาก Hugging Face ~145MB เพราะยังไม่ได้บีบอัด — ครั้งต่อไปจะเร็วขึ้นเพราะแคชไว้แล้ว)…'
      : '⏳ กำลังเตรียมโมเดลเสียง (ครั้งแรกอาจต้องดาวน์โหลดจาก Hugging Face หลายสิบ MB — ครั้งต่อไปจะเร็วขึ้นเพราะแคชไว้แล้ว)…';
    synthesizeMmsTts(text, modelId, function (p) {
      if (p && p.status === 'progress' && p.file) {
        var pct = p.progress != null ? Math.round(p.progress) : null;
        $('dlStatus').textContent = '⏳ กำลังดาวน์โหลดโมเดล: ' + p.file + (pct != null ? (' (' + pct + '%)') : '');
      }
    })
      .then(function (output) {
        $('dlStatus').textContent = '⏳ กำลังสร้างไฟล์เสียง…';
        var wavBlob = float32ToWavBlob(output.audio, output.sampling_rate);
        var wavUrl = URL.createObjectURL(wavBlob);
        return wavBlob.arrayBuffer().then(function (buf) {
          return wavBytesToMp3Blob(new Uint8Array(buf)).then(function (mp3Blob) {
            var mp3Url = URL.createObjectURL(mp3Blob);
            showResult(wavUrl, mp3Url);
            $('dlStatus').className = 'status ok';
            $('dlStatus').textContent = '✅ สร้างไฟล์เสียงเสร็จแล้ว — เล่นฟังหรือดาวน์โหลดได้ด้านล่าง';
          });
        });
      })
      .catch(function (e) {
        $('dlStatus').className = 'status err';
        $('dlStatus').textContent = '❌ สร้างไฟล์เสียงไม่สำเร็จ: ' + (e && e.message ? e.message : e);
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
  function runAsr() {
    var fileInput = $('asrFile');
    var file = fileInput.files && fileInput.files[0];
    if (!file) { $('asrStatus').className = 'status err'; $('asrStatus').textContent = 'เลือกไฟล์เสียง/วิดีโอก่อน'; return; }
    var modelId = $('asrModel').value;
    var langOpt = $('asrLang').value;
    $('asrGoBtn').disabled = true;
    $('asrResultWrap').style.display = 'none';
    $('asrStatus').className = 'status';
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
        var opts = { task: 'transcribe' };
        if (langOpt !== 'auto') opts.language = langOpt;
        return transcriber(pcm, opts);
      })
      .then(function (result) {
        var text = (result && result.text) || '';
        $('asrResult').value = text.trim();
        $('asrResultWrap').style.display = 'block';
        $('asrStatus').className = 'status ok';
        $('asrStatus').textContent = text.trim() ? '✅ ถอดเสียงเสร็จแล้ว' : '⚠️ ถอดเสียงเสร็จแต่ไม่พบคำพูดในไฟล์นี้';
      })
      .catch(function (e) {
        $('asrStatus').className = 'status err';
        $('asrStatus').textContent = '❌ ถอดเสียงไม่สำเร็จ: ' + (e && e.message ? e.message : e);
      })
      .finally(function () { $('asrGoBtn').disabled = false; });
  }
  function copyAsrResult() {
    var text = $('asrResult').value;
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      $('asrStatus').className = 'status ok'; $('asrStatus').textContent = '📋 คัดลอกข้อความแล้ว';
    }).catch(function () {
      $('asrResult').select();
      document.execCommand('copy');
    });
  }

  /* ══════════════════ init ══════════════════ */
  function init() {
    $('ttsText').addEventListener('input', updateCharCount);
    updateCharCount();

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

    $('dlGenerateBtn').addEventListener('click', generateDownloadable);

    $('asrGoBtn').addEventListener('click', runAsr);
    $('asrCopyBtn').addEventListener('click', copyAsrResult);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__tts = {
    synthesizeMmsTts: synthesizeMmsTts, float32ToWavBlob: float32ToWavBlob,
    wavBytesToMp3Blob: wavBytesToMp3Blob, floatTo16BitPCM: floatTo16BitPCM,
    loadAsrPipeline: loadAsrPipeline, decodeFileToPcm: decodeFileToPcm, resampleTo16kMono: resampleTo16kMono
  };
})();
