/* ══════════════════════════════════════════════════════════════════
   แปลงข้อความเป็นเสียง — 2 โหมด:
   1) ฟังทันที: Web Speech API ของเบราว์เซอร์ (เล่นสดเท่านั้น ดาวน์โหลดไม่ได้)
   2) สร้างไฟล์เสียง: eSpeak NG (WASM, ฝังในเว็บเอง) → .wav ตรงๆ จาก virtual FS
      แล้วเข้ารหัสเป็น .mp3 ด้วย lamejs ฝั่งเบราว์เซอร์ล้วนๆ ไม่มีเซิร์ฟเวอร์
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

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

  /* ══════════════════ โหมด 2: สร้างไฟล์เสียง (eSpeak NG WASM → wav → mp3) ══════════════════
     โหลด vendor/espeak-ng/espeak-ng.js (ES module, ~9MB รวม .wasm) แบบ lazy ด้วย dynamic import()
     เฉพาะตอนกดใช้ครั้งแรก — เก็บ promise ไว้ใช้ซ้ำ ไม่ต้องโหลดใหม่ทุกครั้ง (เบราว์เซอร์แคชไฟล์ให้เองด้วย) */
  var espeakFactoryPromise = null;
  function loadEspeakFactory() {
    if (!espeakFactoryPromise) {
      espeakFactoryPromise = import('./vendor/espeak-ng/espeak-ng.js').then(function (m) { return m.default; });
    }
    return espeakFactoryPromise;
  }
  function synthesizeWav(text, voice, rateWpm, pitch) {
    return loadEspeakFactory().then(function (ESpeakNG) {
      return ESpeakNG({
        arguments: ['-v', voice, '-s', String(rateWpm), '-p', String(pitch), '-w', 'out.wav', text]
      });
    }).then(function (mod) {
      var bytes = mod.FS.readFile('out.wav');
      if (!bytes || !bytes.length) throw new Error('ไม่ได้ข้อมูลเสียงกลับมา (อาจเป็นเพราะรหัสภาษา/เสียงไม่ถูกต้อง)');
      return bytes;
    });
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
  function generateDownloadable() {
    var text = $('ttsText').value;
    if (!text.trim()) { $('dlStatus').className = 'status err'; $('dlStatus').textContent = 'พิมพ์ข้อความก่อน'; return; }
    var lang = $('dlLang').value;
    var rate = $('dlRate').value;
    var pitch = $('dlPitch').value;
    $('dlGenerateBtn').disabled = true;
    $('dlStatus').className = 'status';
    $('dlStatus').textContent = '⏳ กำลังโหลดเครื่องมือสังเคราะห์เสียง (ครั้งแรกอาจใช้เวลาสักครู่ ~9MB — ครั้งต่อไปจะเร็วขึ้นเพราะแคชไว้แล้ว)…';
    var wavBytes;
    synthesizeWav(text, lang, rate, pitch)
      .then(function (bytes) {
        wavBytes = bytes;
        $('dlStatus').textContent = '⏳ กำลังแปลงเป็น .mp3…';
        var wavBlob = new Blob([bytes], { type: 'audio/wav' });
        var wavUrl = URL.createObjectURL(wavBlob);
        return wavBytesToMp3Blob(bytes).then(function (mp3Blob) {
          var mp3Url = URL.createObjectURL(mp3Blob);
          showResult(wavUrl, mp3Url);
          $('dlStatus').className = 'status ok';
          $('dlStatus').textContent = '✅ สร้างไฟล์เสียงเสร็จแล้ว — เล่นฟังหรือดาวน์โหลดได้ด้านล่าง';
        });
      })
      .catch(function (e) {
        $('dlStatus').className = 'status err';
        $('dlStatus').textContent = '❌ สร้างไฟล์เสียงไม่สำเร็จ: ' + (e && e.message ? e.message : e);
      })
      .finally(function () { $('dlGenerateBtn').disabled = false; });
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

    $('dlRate').addEventListener('input', function () { $('dlRateVal').textContent = $('dlRate').value; });
    $('dlPitch').addEventListener('input', function () { $('dlPitchVal').textContent = $('dlPitch').value; });
    $('dlGenerateBtn').addEventListener('click', generateDownloadable);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__tts = {
    synthesizeWav: synthesizeWav, wavBytesToMp3Blob: wavBytesToMp3Blob, floatTo16BitPCM: floatTo16BitPCM
  };
})();
