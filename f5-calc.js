/* ══════════════════════════════════════════════════════════════════
   f5-calc.js — ตรรกะล้วนของหน้าทดลอง "F5 ในเบราว์เซอร์" (f5-lab.html) — UMD, ไม่มี DOM/storage
   window/self.TanotF5Calc ในหน้าและใน Worker (f5-worker.js import เป็นสคริปต์ธรรมดา) · require() ได้ใน test (tests/f5.spec.js)

   ต้องตรงกับสคริปต์ Colab (tools/colab/tanot_audiobook_f5.py + f5-tts-th) ทุกตัวอักษร — known-answer ใน tests/fixtures/f5-thai.json:
   1) ข้อความ: TanotTtsNorm.plan(text, {max: 100}).chunks → แต่ละท่อน ํา→ำ → ลบสัญลักษณ์ SYMBOLS ทุกตัว → " ๆ"→"ๆ" → trim (normChunk)
   2) ข้อความเสียงตัวอย่าง: ไม่ลงท้าย ". " → ลงท้าย "." เติม " " ไม่งั้นเติม ". " (refText) · full = ref + "  " + norm (fullText)
   3) text_ids = ตัวอักษรละ 1 ตัวตาม vocab.txt (บรรทัด → index, ไม่มี = 0) (parseVocab/textIds)
   5) ความยาว (แทน IPA ของ pythainlp — หาจากนิยาย 503 ท่อน R² 0.981): feats × COEF → frames (estFrames) → max_duration (maxDuration ≤ MAX_SIGNAL)
   4) เสียงตัวอย่าง 24 kHz: ตัดเงียบหัว-ท้าย < −42 dBFS แบบ pydub (หัวทีละ 10 ms, ท้ายทีละ 1 ms) + ต่อเงียบ 50 ms (trimRef)
   ท่อนที่สร้างแล้ว: ตัดเงียบหัว-ท้ายแบบ Colab (−45 dB เฟรม 20 ms เว้น 50 ms — trimOut) แล้วต่อด้วยช่วงเงียบของ plan().gaps */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  var g = typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : root);
  if (g) g.TanotF5Calc = api;
})(this, function () {
  'use strict';

  var SR = 24000, HOP = 256, NFE = 32, MAX_SIGNAL = 4096, MAX_CHUNK = 100, MAX_CHARS = 1000;
  var REF_WARN_SEC = 8;
  var SYMBOLS = ',.{}[]()-_?/\\|!*%$&@#^<>+-";:~`=“”';
  var COEF = [1.728750122650088, 1.26738115963144, 1.3879229569865037, 1.7189003434718584, 0, 0.8972014114066885, 0.5805508400533895];

  /* ── โมเดล (repo บน Hugging Face เป็น private — โหลดผ่าน /api/hf/ เท่านั้น: TanotMediaModels.hfProxyUrl) ──
     ขนาดเป็น MB โดยประมาณ (ใช้แสดงผล) · vocab.txt เล็กมาก */
  var REPO = 'Tanotfin/f5-tts-thai-v1-onnx';
  var FILES = ['F5_Preprocess.onnx', 'F5_Transformer.onnx', 'F5_Decode.onnx', 'vocab.txt'];
  var VARIANTS = {
    q4: { mb: { 'F5_Preprocess.onnx': 43, 'F5_Transformer.onnx': 222, 'F5_Decode.onnx': 58, 'vocab.txt': 0.1 } },
    fp16: { mb: { 'F5_Preprocess.onnx': 40, 'F5_Transformer.onnx': 661, 'F5_Decode.onnx': 58, 'vocab.txt': 0.1 } }
  };
  /* ตัว .wasm ของ onnxruntime-web ที่ backend WebGPU ต้องใช้ (asyncify — เวอร์ชันเดียวกับ vendor/transformers ที่ pin 1.24.3) เก็บในแคชเดียวกับโมเดล */
  var ORT_WASM_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.asyncify.wasm';
  var ORT_WASM_MB = 26;
  var CACHE_NAME = 'tanot-f5-models-v1';

  /* คีย์แคช = URL ของ huggingface.co (ไม่ขึ้นกับ origin/เซสชัน) — URL ที่โหลดจริงได้จาก hfProxyUrl() */
  function modelUrl(variant, file) { return 'https://huggingface.co/' + REPO + '/resolve/main/' + variant + '/' + file; }
  function variantMb(variant) {
    var v = VARIANTS[variant], s = 0;
    if (!v) return 0;
    for (var k in v.mb) s += v.mb[k];
    return Math.round(s);
  }

  /* ── ขั้น 1: ข้อความ ── */
  function normChunk(chunk) {
    var s = String(chunk == null ? '' : chunk).replace(/ํา/g, 'ำ'), out = '';
    for (var i = 0; i < s.length; i++) if (SYMBOLS.indexOf(s.charAt(i)) < 0) out += s.charAt(i);
    return out.replace(/ ๆ/g, 'ๆ').trim();
  }
  /* ท่อนจาก TanotTtsNorm.plan (ไม่ใช้ lexicon — เหมือน Colab) → [{norm, gap}] · ท่อนที่ว่างหลังลบสัญลักษณ์ ยกช่วงเงียบไปให้ท่อนก่อนหน้า */
  function planText(text, Norm) {
    var p = Norm.plan(String(text == null ? '' : text), { max: MAX_CHUNK }), out = [];
    for (var i = 0; i < p.chunks.length; i++) {
      var n = normChunk(p.chunks[i]), gap = p.gaps[i] || 0;
      if (n) out.push({ norm: n, gap: gap });
      else if (out.length) out[out.length - 1].gap = Math.max(out[out.length - 1].gap, gap);
    }
    if (out.length) out[out.length - 1].gap = 0;
    return out;
  }

  /* ── ขั้น 2: ข้อความกำกับเสียงตัวอย่าง ── */
  function refText(rt) {
    var s = String(rt == null ? '' : rt).replace(/\s+/g, ' ').trim();
    if (/\. $/.test(s) || /。$/.test(s)) return s;
    return /\.$/.test(s) ? s + ' ' : s + '. ';
  }
  function fullText(ref, norm) { return ref + ' ' + ' ' + norm; }

  /* ── ขั้น 3: vocab + text_ids ── เหมือน Python: for i, char in enumerate(f): vocab[char[:-1]] = i (บรรทัดสุดท้ายที่ไม่มี \n ก็ถูกตัด 1 ตัวเหมือนกัน) */
  function parseVocab(txt) {
    var s = String(txt == null ? '' : txt), map = Object.create(null), i = 0, start = 0;
    while (start < s.length) {
      var nl = s.indexOf('\n', start), line = nl < 0 ? s.slice(start) : s.slice(start, nl + 1);
      map[Array.from(line).slice(0, -1).join('')] = i++;
      if (nl < 0) break;
      start = nl + 1;
    }
    return map;
  }
  function textIds(full, vocab) {
    var chars = Array.from(String(full)), ids = new Int32Array(chars.length);
    for (var i = 0; i < chars.length; i++) { var v = vocab[chars[i]]; ids[i] = v == null ? 0 : v; }
    return ids;
  }

  /* ── ขั้น 5: ความยาว ── */
  function count(s, re) { var m = s.match(re); return m ? m.length : 0; }
  function feats(norm) {
    var s = String(norm);
    return [count(s, /[ก-ฮ]/g), count(s, /[เแโใไ]/g), count(s, /[ัิ-ฺ็-๎]/g),
      count(s, /[ะาำๅ]/g), count(s, /[a-zA-Z]/g), count(s, / /g), 1];
  }
  function estimate(norm) {
    var f = feats(norm), e = 0;
    for (var i = 0; i < f.length; i++) e += f[i] * COEF[i];
    return Math.max(1, e);
  }
  function genFrames(norm) {
    var n = Math.floor(estimate(norm) * 5);
    if (n < 50) n *= 2;
    return n;
  }
  function estFrames(norm, refFrames) { return refFrames + genFrames(norm); }
  function maxDuration(idsLen, refFrames, frames) { return Math.max(Math.max(idsLen, refFrames + 1) + 1, frames); }

  /* ท่อนที่ max_duration เกิน MAX_SIGNAL → แบ่งครึ่งที่ช่องว่างใกล้กลางที่สุด (ไม่มีช่องว่าง = กลางท่อนที่ไม่ขึ้นต้นด้วยสระบน/ล่าง/วรรณยุกต์) จนพอดี
     แบ่งจนเหลือ ≤ 4 ตัวอักษรแล้วยังเกิน = เสียงตัวอย่างยาวเกินไป → error code 'tooLong' */
  var MARK_RE = /[ัิ-ฺ็-๎ะาำๅ]/;
  function prepare(norm, ref, refFrames, idsLen) {
    var full = fullText(ref, norm), len = idsLen != null ? idsLen : Array.from(full).length, frames = estFrames(norm, refFrames);
    return { norm: norm, full: full, frames: frames, maxDuration: maxDuration(len, refFrames, frames) };
  }
  function fitChunks(items, ref, refFrames) {
    var out = [];
    function push(norm, gap, depth) {
      var p = prepare(norm, ref, refFrames);
      if (p.maxDuration <= MAX_SIGNAL) { p.gap = gap; out.push(p); return; }
      var chars = Array.from(norm);
      if (chars.length <= 4 || depth > 12) { var e = new Error('max_duration ' + p.maxDuration + ' > ' + MAX_SIGNAL); e.code = 'tooLong'; throw e; }
      var mid = Math.floor(chars.length / 2), cut = -1, best = Infinity;
      for (var i = 1; i < chars.length - 1; i++) if (chars[i] === ' ' && Math.abs(i - mid) < best) { best = Math.abs(i - mid); cut = i; }
      var a, b;
      if (cut > 0) { a = chars.slice(0, cut).join('').trim(); b = chars.slice(cut + 1).join('').trim(); }
      else {
        cut = mid;
        while (cut < chars.length - 1 && MARK_RE.test(chars[cut])) cut++;
        a = chars.slice(0, cut).join(''); b = chars.slice(cut).join('');
      }
      push(a, 0.12, depth + 1);
      push(b, gap, depth + 1);
    }
    for (var i = 0; i < items.length; i++) push(items[i].norm, items[i].gap, 0);
    return out;
  }

  /* ── ขั้น 4: เสียงตัวอย่าง ── */
  function dbfs(x, a, b) {
    var s = 0, n = b - a;
    if (n <= 0) return -Infinity;
    for (var i = a; i < b; i++) s += x[i] * x[i];
    var rms = Math.sqrt(s / n);
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  }
  /* f5-tts remove_silence_edges(audio, silence_threshold=-42) ด้วย pydub: หัว = detect_leading_silence (ก้อน 10 ms, dBFS < th) · ท้าย = ถอยทีละ 1 ms จนเจอ dBFS > th
     แล้วต่อเงียบ 50 ms (AudioSegment.silent(50)) · x = Float32 [-1,1] ที่ sr */
  function trimRef(x, sr, db) {
    sr = sr || SR; var th = db == null ? -42 : db, n = x.length, ms = sr / 1000, c10 = Math.round(ms * 10), c1 = Math.max(1, Math.round(ms));
    var start = 0;
    while (start < n && dbfs(x, start, Math.min(n, start + c10)) < th) start += c10;
    start = Math.min(start, n);
    var end = n;
    while (end > start) {
      var a = Math.max(start, end - c1);
      if (dbfs(x, a, end) > th) break;
      end = a;
    }
    var pad = Math.round(sr * 0.05), out = new Float32Array(end - start + pad);
    out.set(x.subarray(start, end), 0);
    return out;
  }
  function refFrames(samples) { return Math.floor(samples / HOP); }

  /* tools/colab: trim(x, db=-45, keep=0.05) — ตัดความเงียบหัว/ท้ายท่อนที่ F5 ใส่มาเอง → ช่วงเงียบระหว่างท่อนเท่ากับ plan().gaps */
  function trimOut(x, sr, db, keep) {
    sr = sr || SR; db = db == null ? -45 : db; keep = keep == null ? 0.05 : keep;
    var fr = Math.round(sr * 0.02), th = Math.pow(10, db / 20), first = -1, last = -1, k = 0;
    for (var i = 0; i < Math.max(1, x.length - fr + 1); i += fr, k++) {
      var s = 0, e = Math.min(x.length, i + fr), m = e - i;
      for (var j = i; j < e; j++) s += x[j] * x[j];
      if (m > 0 && Math.sqrt(s / m) > th) { if (first < 0) first = k; last = k; }
    }
    if (first < 0) return x;
    return x.slice(Math.max(0, first * fr - Math.round(sr * keep)), Math.min(x.length, (last + 1) * fr + Math.round(sr * keep)));
  }

  /* ต่อท่อนด้วยช่วงเงียบ (วินาที) หลังแต่ละท่อน — ท่อนสุดท้ายไม่ต่อ */
  function concat(parts, gaps, sr) {
    sr = sr || SR; var total = 0, i;
    for (i = 0; i < parts.length; i++) total += parts[i].length + (i < parts.length - 1 ? Math.round(sr * (gaps[i] || 0)) : 0);
    var out = new Float32Array(total), at = 0;
    for (i = 0; i < parts.length; i++) {
      out.set(parts[i], at); at += parts[i].length;
      if (i < parts.length - 1) at += Math.round(sr * (gaps[i] || 0));
    }
    return out;
  }

  /* WAV PCM 16-bit mono */
  function encodeWav(x, sr) {
    sr = sr || SR; var n = x.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) { var s = x[i]; s = s !== s ? 0 : Math.max(-1, Math.min(1, s)); v.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true); }
    return buf;
  }

  /* float16 (บิตใน Uint16Array) ↔ float32 — ใช้เมื่อโมเดลรับ/คืน tensor(float16) ทาง CPU */
  var f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
  function toF16(arr) {
    var out = new Uint16Array(arr.length);
    for (var i = 0; i < arr.length; i++) {
      f32[0] = arr[i]; var x = u32[0], sign = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff;
      if (e <= 0) out[i] = e < -10 ? sign : sign | ((m | 0x800000) >> (1 - e)) >> 13;
      else if (e >= 31) out[i] = sign | 0x7c00 | (((x >>> 23) & 0xff) === 0xff && m ? 0x200 : 0);
      else out[i] = sign | (e << 10) | (m >> 13);
    }
    return out;
  }
  function fromF16(arr) {
    var out = new Float32Array(arr.length);
    for (var i = 0; i < arr.length; i++) {
      var h = arr[i], s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
      out[i] = e === 0 ? s * m * Math.pow(2, -24) : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * Math.pow(2, e - 15);
    }
    return out;
  }

  /* เวลาเป็นตัวเลข (วินาที) ต่อความยาวเสียง → RTF */
  function rtf(genSec, audioSec) { return audioSec > 0 ? genSec / audioSec : null; }

  return {
    SR: SR, HOP: HOP, NFE: NFE, MAX_SIGNAL: MAX_SIGNAL, MAX_CHUNK: MAX_CHUNK, MAX_CHARS: MAX_CHARS, REF_WARN_SEC: REF_WARN_SEC,
    SYMBOLS: SYMBOLS, COEF: COEF, REPO: REPO, FILES: FILES, VARIANTS: VARIANTS, ORT_WASM_URL: ORT_WASM_URL, ORT_WASM_MB: ORT_WASM_MB, CACHE_NAME: CACHE_NAME,
    modelUrl: modelUrl, variantMb: variantMb,
    normChunk: normChunk, planText: planText, refText: refText, fullText: fullText, parseVocab: parseVocab, textIds: textIds,
    feats: feats, estimate: estimate, genFrames: genFrames, estFrames: estFrames, maxDuration: maxDuration, prepare: prepare, fitChunks: fitChunks,
    trimRef: trimRef, refFrames: refFrames, trimOut: trimOut, concat: concat, encodeWav: encodeWav, toF16: toF16, fromF16: fromF16, rtf: rtf
  };
});
