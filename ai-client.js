/* ══════════════════════════════════════════════════════════════════
   ai-client.js — ทางเข้าเดียวของหน้าเว็บสู่ AI บนคลาวด์ (Phase 4): /api/ai/chat (สตรีม), /api/ai/summarize (แคชใน D1),
   /api/ai/embed, /api/ai/usage + /api/asr (Whisper) + /api/ocr — ทำงานบนมือถือ/iPhone ได้เพราะรันบน Workers AI ไม่ใช่ในเบราว์เซอร์

   ใช้ได้เฉพาะ *.pages.dev (GitHub Pages ไม่มี /api/*) — available() เป็น false ที่อื่น หน้าเรียกใช้ต้องไปทางเดิม
   (โมเดลในเบราว์เซอร์) เอง เช่นเดียวกับตอนออฟไลน์/โควตาเต็ม/Access หมดอายุ: ดู canFallback(err)

   ทุก method คืน Promise ที่ reject ด้วย AiClient.Error { code, status, message }
     unavailable = ไม่ใช่โดเมนที่มีคลาวด์ · offline = ไม่มีเน็ต · network = ติดต่อเซิร์ฟเวอร์ไม่ได้
     auth = ต้องล็อกอิน Access ใหม่ · quota = โควตา Neurons วันนี้เต็ม · upstream = โมเดล/เซิร์ฟเวอร์ผิดพลาด
     bad = คำขอไม่ถูกต้อง (แก้ที่โค้ด ไม่ควรถอยไปตัวสำรอง) · abort = ผู้ใช้ยกเลิก
   ทดสอบ: ตั้ง window.TANOT_AI = { enabled: true } ก่อนโหลดไฟล์นี้ (เหมือน TANOT_SYNC ของ tanot-data.js) */
(function () {
  'use strict';

  function AiError(code, message, status) {
    var e = new Error(message || code);
    e.name = 'AiError'; e.code = code; e.status = status || 0;
    return e;
  }

  function available() {
    if (window.TANOT_AI && typeof window.TANOT_AI.enabled === 'boolean') return window.TANOT_AI.enabled;
    return /\.pages\.dev$/.test(location.hostname);
  }

  /* ถอยไปโมเดลในเบราว์เซอร์ได้ไหม — ทุกกรณีที่ปัญหาอยู่ที่คลาวด์/เครือข่าย ไม่รวม bad (บั๊กของคำขอเอง) และ abort */
  function canFallback(err) {
    return !!err && ['unavailable', 'offline', 'network', 'auth', 'quota', 'upstream'].indexOf(err.code) >= 0;
  }

  /* ข้อความ error ที่แสดงผู้ใช้ — ไทยเป็นค่าเริ่มต้น, มีอังกฤษเมื่อหน้าโหลด i18n.js (ทุกหน้าโหลด) */
  var MSG = {
    th: { offline: 'ไม่มีอินเทอร์เน็ต', network: 'ติดต่อเซิร์ฟเวอร์ไม่ได้', auth: 'เซสชันล็อกอินหมดอายุ — เปิดหน้านี้ใหม่เพื่อล็อกอินอีกครั้ง', quota: 'โควตา AI ฟรีของวันนี้เต็มแล้ว (รีเซ็ต 07:00 น. เวลาไทย)', other: 'AI ผิดพลาด' },
    en: { offline: 'No internet connection', network: 'Could not reach the server', auth: 'Your login session expired — reopen this page to sign in again', quota: 'Today\'s free AI quota is used up (resets at 07:00 Thai time)', other: 'AI error' }
  };
  function friendlyMessage(err) {
    var en = window.OME_LANG && window.OME_LANG.get() === 'en', m = MSG[en ? 'en' : 'th'], c = err && err.code;
    if (m[c] && c !== 'other') return m[c];
    return (err && err.message) || m.other;
  }

  /* fetch ที่แปลงความล้มเหลวทุกแบบเป็น AiError — redirect:'manual' เพราะเซสชัน Access หมดอายุจะ 302 ไปหน้าล็อกอินข้ามโดเมน
     (fetch ธรรมดาจะพังด้วย CORS แล้วแยกไม่ออกจากเน็ตหลุด) */
  function request(path, opts) {
    opts = opts || {};
    if (!available()) return Promise.reject(AiError('unavailable', 'AI บนคลาวด์ใช้ได้เฉพาะบน pages.dev'));
    if (navigator.onLine === false) return Promise.reject(AiError('offline', 'offline'));
    var ctrl = new AbortController();
    var timedOut = false;
    var timer = setTimeout(function () { timedOut = true; ctrl.abort(); }, opts.timeoutMs || 90000);
    if (opts.signal) {
      if (opts.signal.aborted) ctrl.abort();
      else opts.signal.addEventListener('abort', function () { ctrl.abort(); });
    }
    var init = { method: opts.body === undefined ? 'GET' : 'POST', signal: ctrl.signal, redirect: 'manual', credentials: 'same-origin' };
    if (opts.body !== undefined) { init.headers = { 'Content-Type': 'application/json' }; init.body = JSON.stringify(opts.body); }
    return fetch(path, init).then(function (res) {
      clearTimeout(timer);
      if (res.type === 'opaqueredirect') throw AiError('auth', 'redirected to login', 401);
      if (res.ok) return res;
      return res.json().catch(function () { return {}; }).then(function (data) {
        var msg = (data && data.error) || ('HTTP ' + res.status);
        if (res.status === 401 || res.status === 403) throw AiError('auth', msg, res.status);
        if (res.status === 429 || (data && data.code === 'quota')) throw AiError('quota', msg, res.status);
        if (res.status >= 500) throw AiError('upstream', msg, res.status);
        throw AiError('bad', msg, res.status);
      });
    }, function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') throw AiError(timedOut ? 'network' : 'abort', timedOut ? 'timeout' : 'aborted');
      throw AiError('network', (err && err.message) || 'network error');
    });
  }

  function json(path, body, opts) {
    opts = opts || {};
    opts.body = body;
    return request(path, opts).then(function (res) {
      return res.json().catch(function () { throw AiError('upstream', 'คำตอบจากเซิร์ฟเวอร์อ่านไม่ได้'); });
    });
  }

  /* chat({ messages, model:'main'|'fast', maxTokens, temperature, onToken(piece, fullSoFar), signal })
     → { text, model, neurons, tokensIn, tokensOut } เมื่อจบสตรีม
     ใช้ ReadableStream ของ fetch (iOS Safari 10.3+ รองรับ); ถ้าไม่มี body stream จะอ่านทั้งก้อนแล้วป้อน onToken ทีเดียว */
  function chat(opts) {
    return request('/api/ai/chat', {
      body: { messages: opts.messages, model: opts.model, max_tokens: opts.maxTokens, temperature: opts.temperature },
      signal: opts.signal, timeoutMs: 45000
    }).then(function (res) {
      var text = '', meta = {}, buf = '';
      function handle(block) {
        var line = block.trim();
        if (line.indexOf('data:') !== 0) return;
        var j;
        try { j = JSON.parse(line.slice(5)); } catch (e) { return; }
        if (typeof j.t === 'string') { text += j.t; if (opts.onToken) opts.onToken(j.t, text); }
        else if (j.done) meta = j;
      }
      function finish() {
        if (buf.trim()) handle(buf);
        if (!text) throw AiError('upstream', 'ไม่ได้คำตอบกลับมา');
        return { text: text, model: meta.model, neurons: meta.neurons, tokensIn: meta.tokens_in, tokensOut: meta.tokens_out };
      }
      if (!res.body || !res.body.getReader) {
        return res.text().then(function (all) { all.split('\n\n').forEach(handle); return finish(); });
      }
      var reader = res.body.getReader(), dec = new TextDecoder();
      if (opts.signal) opts.signal.addEventListener('abort', function () { try { reader.cancel(); } catch (e) {} });
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return finish();
          buf += dec.decode(r.value, { stream: true });
          var i;
          while ((i = buf.indexOf('\n\n')) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 2); }
          return pump();
        }, function (err) {
          if (opts.signal && opts.signal.aborted) throw AiError('abort', 'aborted');
          throw AiError('network', (err && err.message) || 'stream error');
        });
      }
      return pump();
    });
  }

  /* summarize({ messages, task, model, maxTokens, temperature, ttlHours, refresh, signal }) → { text, cached, model, createdAt? }
     task = ป้ายชนิดงานที่ผสมเข้าคีย์แคช เช่น 'stock:globalstock' · ป้อนข้อมูลชุดเดิม = ได้ผลเดิมจากแคช D1 ไม่เสีย Neurons */
  function summarize(opts) {
    return json('/api/ai/summarize', {
      messages: opts.messages, task: opts.task, model: opts.model, max_tokens: opts.maxTokens,
      temperature: opts.temperature, ttlHours: opts.ttlHours, refresh: opts.refresh
    }, { signal: opts.signal, timeoutMs: 120000 });
  }

  /* embed(texts | text) → { vectors: number[][], dims, model } */
  function embed(texts, opts) {
    var body = typeof texts === 'string' ? { text: texts } : { texts: texts };
    return json('/api/ai/embed', body, opts);
  }

  /* usage() → { day, limit, used, remaining, byKind[] } — โควตา Neurons ของวันนี้ (UTC) รวมทุกงานรวม Whisper */
  function usage(opts) { return request('/api/ai/usage', opts).then(function (r) { return r.json(); }); }

  /* PCM Float32 (mono) → base64 ของไฟล์ WAV 16-bit — รูปแบบที่ /api/asr ต้องการ */
  function pcmToWavBase64(pcm, sampleRate) {
    var n = pcm.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) {
      var s = Math.max(-1, Math.min(1, pcm[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    var bytes = new Uint8Array(buf), bin = '', step = 0x8000;
    for (var k = 0; k < bytes.length; k += step) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + step));
    return btoa(bin);
  }

  /* asr({ pcm, sampleRate=16000, language:'th'|'en'|undefined }) หรือ { audioBase64 } → { text, neurons }
     ส่งทั้งก้อนในคำขอเดียว เหมาะกับคลิปสั้น (คำถามจากไมค์); ไฟล์ยาวให้ตัดเป็นท่อนก่อนเหมือน text-to-speech.js */
  function asr(opts) {
    var b64 = opts.audioBase64 || pcmToWavBase64(opts.pcm, opts.sampleRate || 16000);
    return json('/api/asr', { audio: b64, language: opts.language }, { signal: opts.signal, timeoutMs: 120000 });
  }

  /* ocr({ imageBase64, mediaType, prompt? }) → { text } */
  function ocr(opts) {
    return json('/api/ocr', { imageBase64: opts.imageBase64, mediaType: opts.mediaType, prompt: opts.prompt }, { signal: opts.signal, timeoutMs: 120000 });
  }

  /* image({ prompt, preset:'background'|'icon'|'free', mode:'light'|'dark', model:'fast'|'quality', seed?, signal })
     → { id, name, mime, size, model, seed, neurons, width, height, preset, mode, prompt } — ภาพถูกเก็บใน R2 (ns images) แล้ว ดึงด้วย /api/files?id= */
  function image(opts) {
    return json('/api/ai/image', { prompt: opts.prompt, preset: opts.preset, mode: opts.mode, model: opts.model, seed: opts.seed },
      { signal: opts.signal, timeoutMs: 120000 });
  }

  window.AiClient = {
    available: available, canFallback: canFallback, friendlyMessage: friendlyMessage, Error: AiError,
    chat: chat, summarize: summarize, embed: embed, usage: usage, asr: asr, ocr: ocr, image: image, pcmToWavBase64: pcmToWavBase64
  };
})();
