/* ══════════════════════════════════════════════════════════════════
   asr-cloud.js — ถอดเสียงไฟล์ยาวผ่านคลาวด์ (/api/asr → Whisper large-v3-turbo บน Workers AI) — window.TanotAsrCloud
   ใช้โดย text-to-speech.js · ต้องโหลดหลัง asr-calc.js, ai-client.js, media-core.js

   ขั้นตอน (ROADMAP ปรับปรุงเสียง/OCR Section 3 ข้อ 1–2)
   1) แผนท่อน  AsrCalc.planChunks — ~28 วินาที/ท่อน ตัดที่จุดเงียบ ท่อนถัดไปเริ่มก่อนจุดตัด 1.5 วินาที (เหลื่อม)
   2) ส่งขนาน ≤ 3 ท่อน (คิวจำกัดจำนวน) — ผลเก็บตามดัชนีท่อน ประกอบตามลำดับเดิมเสมอ ไม่ขึ้นกับว่าท่อนไหนเสร็จก่อน
   3) ท่อนล้ม (เครือข่าย/เซิร์ฟเวอร์ 5xx) ลองใหม่ 1 ครั้ง · quota (429)/ล็อกอินหมดอายุ/คำขอผิด/ยกเลิก = หยุดทั้งชุดทันที:
      ไม่เริ่มท่อนที่ยังไม่ส่ง และยกเลิกคำขอที่ค้างทั้งหมด (ไม่เสีย Neurons เพิ่มกับท่อนที่เหลือ)
   4) ตัดคำซ้ำที่รอยต่อ AsrCalc.mergeChunks → { text, segments } เวลาจริงในไฟล์ (ใช้ทำย่อหน้า/[hh:mm:ss])
   ค่าใช้จ่าย: ส่งเสียงเกินจริงเฉพาะส่วนเหลื่อม 1.5 วิ ต่อท่อน ≈ +5% (AsrCalc.sentSeconds) ไม่มีส่วนอื่นเพิ่ม */
(function () {
  'use strict';
  if (window.TanotAsrCloud) return;

  var RETRYABLE = { network: 1, upstream: 1 };
  /* ปรับค่าได้จากภายนอกเฉพาะตอนวัดผล/ทดสอบ: window.TANOT_ASR_CLOUD = { parallel, overlapSec, stepSec } (tools/media-eval ใช้เทียบ "ขนาน+เหลื่อม" กับ "ทีละท่อนไม่เหลื่อม") */
  function cfg() { return window.TANOT_ASR_CLOUD || {}; }

  function cutFinder(dec) {
    var frame = Math.round(AsrCalc.RATE * 0.02);
    return function (target, lo, hi) {
      var win = dec.segment(lo, hi);
      return lo + TanotMedia.quietCut(win, 0, win.length, frame);
    };
  }
  function plan(dec) {
    var c = cfg();
    return AsrCalc.planChunks(dec.length, { rate: AsrCalc.RATE, cutAt: cutFinder(dec), overlapSec: c.overlapSec, stepSec: c.stepSec });
  }

  function delay(ms, signal) {
    return new Promise(function (resolve) {
      var t = setTimeout(resolve, ms);
      if (signal) signal.addEventListener('abort', function () { clearTimeout(t); resolve(); });
    });
  }

  /* opts: { dec, language:'th'|'en'|undefined, domain, signal, parallel=3, retryDelayMs=700, chunks (แผนที่คำนวณแล้ว),
             onProgress({done,total,active}), onChunk({index, seconds, neurons}) }
     → Promise<{ text, segments, chunks: n, sentSeconds }> · reject: AiClient.Error (code quota|auth|bad|network|upstream|unavailable|offline) หรือ TanotMedia.error('abort') */
  function transcribe(opts) {
    var dec = opts.dec, chunks = opts.chunks || plan(dec), total = chunks.length;
    var parallel = Math.max(1, Math.min(opts.parallel || cfg().parallel || AsrCalc.MAX_PARALLEL, AsrCalc.MAX_PARALLEL));
    var retryDelay = opts.retryDelayMs != null ? opts.retryDelayMs : 700;
    return new Promise(function (resolve, reject) {
      var results = new Array(total), next = 0, active = 0, done = 0, finished = false;
      var ctrl = new AbortController();
      var user = opts.signal;
      function onUserAbort() { fail(TanotMedia.error('abort')); }
      function cleanup() { if (user) user.removeEventListener('abort', onUserAbort); }
      function fail(err) {
        if (finished) return;
        finished = true; cleanup();
        try { ctrl.abort(); } catch (e) {} // ยกเลิกทุกคำขอที่ค้างอยู่
        reject(err);
      }
      if (user) {
        if (user.aborted) { fail(TanotMedia.error('abort')); return; }
        user.addEventListener('abort', onUserAbort);
      }
      if (!total) { finished = true; cleanup(); resolve({ text: '', segments: [], chunks: 0, sentSeconds: 0 }); return; }

      function send(i) {
        var c = chunks[i];
        var pcm = dec.segment(c.a, c.b);
        return AiClient.asr({ pcm: pcm, sampleRate: AsrCalc.RATE, language: opts.language, domain: opts.domain, signal: ctrl.signal }).then(function (r) {
          var seconds = (c.b - c.a) / AsrCalc.RATE;
          if (opts.onChunk) opts.onChunk({ index: i, seconds: seconds, neurons: r && r.neurons != null ? r.neurons : AsrCalc.neuronsFor(seconds) });
          return { offset: c.a / AsrCalc.RATE, text: (r && r.text) || '', segments: (r && r.segments) || [], duration: seconds };
        });
      }
      function attempt(i, n) {
        return send(i).catch(function (err) {
          if (finished || ctrl.signal.aborted || !err || !RETRYABLE[err.code] || n >= 1) throw err;
          return delay(retryDelay, ctrl.signal).then(function () {
            if (finished || ctrl.signal.aborted) throw err;
            return attempt(i, n + 1);
          });
        });
      }
      function pump() {
        while (!finished && active < parallel && next < total) {
          (function (i) {
            active++;
            attempt(i, 0).then(function (r) {
              active--; results[i] = r; done++;
              if (opts.onProgress) opts.onProgress({ done: done, total: total, active: active });
              pump();
            }, function (err) { active--; fail(err); });
          })(next++);
        }
        if (!finished && done === total) {
          finished = true; cleanup();
          var merged = AsrCalc.mergeChunks(results);
          resolve({ text: merged.text, segments: merged.segments, chunks: total, sentSeconds: AsrCalc.sentSeconds(chunks) });
        }
      }
      pump();
    });
  }

  window.TanotAsrCloud = { plan: plan, transcribe: transcribe };
})();
