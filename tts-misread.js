/* ══════════════════════════════════════════════════════════════════
   tts-misread.js — "บันทึกคำอ่านผิด" ของเสียงไทย (MMS) — ตรรกะล้วน (UMD `window.TanotTtsMisread`, ไม่มี DOM/storage; `require()` ได้ใน test)
   เก็บคำที่เสียงอ่านไม่ได้/อ่านผิดระหว่างใช้งานจริง + ประโยคตัวอย่าง แล้วส่งออกเป็นข้อความไปฝึกโมเดลเสียงรอบถัดไป

   ที่เก็บ: localStorage 'tanot:tts:misread' = sync map (data-registry.js) — 1 คำ = 1 doc (key = คำตัดช่องว่างซ้ำ ตัวพิมพ์เล็ก)
     entry = { word, type:'skip'|'report', reading, count, first, last, voice, examples:[ประโยค ≤ 3, ไม่ซ้ำ, ≤ 200 ตัวอักษร] }
       skip   = บันทึกอัตโนมัติจาก Norm.skippedWords ตอนสร้างไฟล์เสียงไทยสำเร็จ (count += จำนวนครั้งที่พบในข้อความ)
       report = ผู้ใช้แจ้งเอง (count += 1) — ชนะ skip เมื่อคำเดียวกัน
   เพดาน MAX_WORDS คำ (เกิน → ตัดรายการที่ last เก่าสุด) · ห้ามส่งเข้า problem log (มีเนื้อหาผู้ใช้)
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TanotTtsMisread = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_WORDS = 500, MAX_EXAMPLES = 3, MAX_EXAMPLE_LEN = 200, MAX_WORD_LEN = 80, MAX_READING_LEN = 100, MAX_PER_RUN = 100;
  var LOOK = 600; // หาขอบประโยคไม่เกินระยะนี้จากคำ (บรรทัดยาวทั้งก้อนไม่ต้องสแกนทั้งบรรทัด)
  var ENDER = /[.!?…。！？]+["'”’)\]」』]*(?=\s|$)/g;

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  /* key ของคำ: ตัดช่องว่างซ้ำ + ตัวพิมพ์เล็ก · '' = ใช้ไม่ได้ (ว่าง/ยาวเกิน/ชื่อพิเศษของ object) */
  function key(word) {
    var k = String(word == null ? '' : word).replace(/\s+/g, ' ').trim().toLowerCase();
    if (!k || k.length > MAX_WORD_LEN || k === '__proto__') return '';
    return k;
  }
  function cleanWord(word) {
    var w = String(word == null ? '' : word).replace(/\s+/g, ' ').trim();
    return key(w) ? w : '';
  }
  function cleanReading(r) { return String(r == null ? '' : r).replace(/\s+/g, ' ').trim().slice(0, MAX_READING_LEN); }

  /* ── ค้นหาคำในข้อความ: อังกฤษ/เลขที่ขอบคำไม่ติดตัวอักษรละติน (เหมือน lexicon: ไม่แทนกลางคำ) · ไทยตรงช่วงตัวอักษร ── */
  var LATIN = /[A-Za-z0-9]/;
  function findAt(low, lw, from) {
    var needL = LATIN.test(lw.charAt(0)), needR = LATIN.test(lw.charAt(lw.length - 1));
    var i = from;
    while ((i = low.indexOf(lw, i)) >= 0) {
      var j = i + lw.length;
      if ((!needL || i === 0 || !LATIN.test(low.charAt(i - 1))) && (!needR || j >= low.length || !LATIN.test(low.charAt(j)))) return i;
      i += 1;
    }
    return -1;
  }
  /* toLowerCase เปลี่ยนความยาวได้ในบางตัวอักษร → ถ้าไม่เท่ากันค้นบนข้อความเดิม (พลาดตัวพิมพ์ใหญ่ ดีกว่าเลื่อนตำแหน่ง) */
  /* คู่ (ข้อความ, คำ) สำหรับค้น: ทั้งสองฝั่งเป็นตัวพิมพ์เล็ก — ถ้าข้อความ lowercase ไม่ได้ ใช้ทั้งสองฝั่งตามเดิม */
  function prep(text, word) {
    var low = text.toLowerCase(), lw = word.toLowerCase();
    return low.length === text.length && lw.length === word.length ? { low: low, lw: lw } : { low: text, lw: word };
  }

  var seg = null, segTried = false;
  function segmenter() {
    if (!segTried) { segTried = true; try { seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null; } catch (e) { seg = null; } }
    return seg;
  }
  /* ขยับขอบตัดเข้าด้านใน (ไม่ตัดกลางคำ): หาช่องว่างใกล้สุด ไม่มี → ขอบคำของ Intl.Segmenter ไม่มี → ตำแหน่งเดิม */
  function snapForward(text, pos, limit) { // ขอบซ้ายใหม่ ∈ [pos, limit]
    for (var k = pos; k < limit && k < text.length; k++) if (/\s/.test(text.charAt(k))) return k + 1;
    var s = segmenter();
    if (s) {
      var base = Math.max(0, pos - 20), slice = text.slice(base, Math.min(text.length, limit + 1)), it = s.segment(slice)[Symbol.iterator](), r;
      while (!(r = it.next()).done) { var p = base + r.value.index; if (p >= pos && p <= limit) return p; }
    }
    return pos;
  }
  function snapBackward(text, pos, floor) { // ขอบขวาใหม่ ∈ [floor, pos]
    for (var k = pos; k > floor; k--) if (/\s/.test(text.charAt(k - 1))) return k - 1;
    var s = segmenter();
    if (s) {
      var base = Math.max(0, floor - 1), slice = text.slice(base, Math.min(text.length, pos + 20)), it = s.segment(slice)[Symbol.iterator](), r, best = -1;
      while (!(r = it.next()).done) { var p = base + r.value.index; if (p >= floor && p <= pos) best = p; }
      if (best >= 0) return best;
    }
    return pos;
  }

  /* ประโยคที่คร่อมช่วง [i, j) ของข้อความ — ตัดที่บรรทัดใหม่ / จบประโยค (. ! ? … ตามด้วยช่องว่าง) · ยาวเกิน MAX_EXAMPLE_LEN → หน้าต่างรอบคำ ตัดที่ขอบคำ */
  function sentenceAround(text, i, j) {
    var lineStart = text.lastIndexOf('\n', i - 1) + 1;
    var lineEnd = text.indexOf('\n', j); if (lineEnd < 0) lineEnd = text.length;
    var lo = Math.max(lineStart, i - LOOK), hi = Math.min(lineEnd, j + LOOK);
    var start = lo, end = hi, m;
    ENDER.lastIndex = 0;
    var left = text.slice(lo, i);
    while ((m = ENDER.exec(left))) { start = lo + m.index + m[0].length; if (!m[0].length) ENDER.lastIndex++; }
    while (start < i && /\s/.test(text.charAt(start))) start++;
    ENDER.lastIndex = 0;
    var right = text.slice(j, hi);
    if ((m = ENDER.exec(right))) end = j + m.index + m[0].length;
    if (end - start > MAX_EXAMPLE_LEN) {
      var budget = MAX_EXAMPLE_LEN - (j - i), after = Math.min(end - j, Math.floor(budget / 2));
      var before = Math.min(i - start, budget - after);
      after = Math.min(end - j, budget - before);
      var l = i - before, r = j + after;
      if (l > start) l = snapForward(text, l, i);
      if (r < end) r = snapBackward(text, r, j);
      start = l; end = r;
    }
    return text.slice(start, end).replace(/\s+/g, ' ').trim();
  }

  /* ประโยคตัวอย่างของคำจากข้อความ (ไม่ซ้ำ, ≤ max ประโยค) */
  function examplesFor(text, word, max) {
    text = String(text == null ? '' : text);
    var w = cleanWord(word), out = [];
    if (!w || !text) return out;
    max = max > 0 ? Math.min(max, MAX_EXAMPLES) : MAX_EXAMPLES;
    var pp = prep(text, w), low = pp.low, lw = pp.lw;
    var from = 0, i;
    while (out.length < max && (i = findAt(low, lw, from)) >= 0) {
      var j = i + lw.length, s = sentenceAround(text, i, j);
      if (s && out.indexOf(s) < 0) out.push(s);
      // ข้ามไปหลังจบประโยคนี้ (ไม่วนซ้ำในประโยคเดียวกัน)
      var nl = text.indexOf('\n', j), stop = j;
      ENDER.lastIndex = 0;
      var tail = text.slice(j, Math.min(nl < 0 ? text.length : nl, j + LOOK)), m = ENDER.exec(tail);
      if (m) stop = j + m.index + m[0].length; else stop = Math.min(nl < 0 ? text.length : nl, j + LOOK);
      from = Math.max(stop, j);
    }
    return out;
  }

  function cleanExamples(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (e) {
      if (typeof e !== 'string') return;
      var s = e.replace(/\s+/g, ' ').trim();
      if (s.length > MAX_EXAMPLE_LEN) s = s.slice(0, MAX_EXAMPLE_LEN).trim();
      if (s && out.indexOf(s) < 0 && out.length < MAX_EXAMPLES) out.push(s);
    });
    return out;
  }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }

  /* entry จากที่เก็บ (ข้อมูลซิงก์มาจากเครื่องอื่น ต้องไม่เชื่อรูปแบบ) → entry ที่สะอาด หรือ null */
  function cleanEntry(raw) {
    if (!isObj(raw)) return null;
    var w = cleanWord(raw.word);
    if (!w) return null;
    return {
      word: w, type: raw.type === 'report' ? 'report' : 'skip', reading: cleanReading(raw.reading),
      count: Math.max(1, Math.floor(num(raw.count, 1))), first: num(raw.first, 0), last: num(raw.last, 0),
      voice: typeof raw.voice === 'string' ? raw.voice.slice(0, 200) : '', examples: cleanExamples(raw.examples)
    };
  }

  /* รวมรายการใหม่เข้า map เดิม (คืน object ใหม่ ไม่แก้ของเดิม)
     items: [{word, type, reading?, count?, examples?}] · ctx: {now, voice, max} */
  function apply(cur, items, ctx) {
    ctx = ctx || {};
    var now = num(ctx.now, Date.now()), max = ctx.max > 0 ? ctx.max : MAX_WORDS;
    var out = {};
    if (isObj(cur)) Object.keys(cur).forEach(function (k) { var e = cleanEntry(cur[k]); if (e && key(e.word) === k) out[k] = e; });
    (items || []).forEach(function (it) {
      var k = key(it && it.word); if (!k) return;
      var type = it.type === 'report' ? 'report' : 'skip', old = out[k];
      var e = old ? JSON.parse(JSON.stringify(old)) : { word: cleanWord(it.word), type: type, reading: '', count: 0, first: now, last: now, voice: '', examples: [] };
      if (type === 'report') e.type = 'report';
      var rd = cleanReading(it.reading); if (rd) e.reading = rd;
      e.count += type === 'report' ? 1 : Math.max(1, Math.floor(num(it.count, 1)));
      e.last = Math.max(e.last, now); if (!e.first) e.first = now;
      if (typeof ctx.voice === 'string' && ctx.voice) e.voice = ctx.voice.slice(0, 200);
      e.examples = cleanExamples(e.examples.concat(it.examples || []));
      out[k] = e;
    });
    var keys = Object.keys(out);
    if (keys.length > max) {
      keys.sort(function (a, b) { return out[a].last - out[b].last || out[a].first - out[b].first; });
      keys.slice(0, keys.length - max).forEach(function (k) { delete out[k]; });
    }
    return out;
  }

  /* ผลของ Norm.skippedWords ([{word,count}]) + ข้อความ → items ของ apply (ไม่เกิน MAX_PER_RUN คำที่พบบ่อยสุดต่อการสร้าง 1 ครั้ง) */
  function skipItems(text, skipped) {
    return (skipped || []).filter(function (w) { return w && key(w.word); }).slice(0, MAX_PER_RUN).map(function (w) {
      return { word: w.word, type: 'skip', count: w.count, examples: examplesFor(text, w.word, MAX_EXAMPLES) };
    });
  }
  function reportItem(text, word, reading) {
    return { word: word, type: 'report', reading: reading, examples: examplesFor(text, word, MAX_EXAMPLES) };
  }

  /* รายการสำหรับหน้า: ใหม่สุดก่อน */
  function list(map) {
    var out = [];
    if (isObj(map)) Object.keys(map).forEach(function (k) { var e = cleanEntry(map[k]); if (e) out.push(e); });
    out.sort(function (a, b) { return b.last - a.last || b.count - a.count || (a.word < b.word ? -1 : 1); });
    return out;
  }
  /* คำนี้อยู่ใน "คำอ่านของฉัน" แล้วหรือยัง (rows จาก Norm.parseLexicon(...).rows) */
  function inLexicon(rows, word) {
    var k = key(word);
    return !!k && (rows || []).some(function (r) { return key(r.from) === k; });
  }

  /* ── ส่งออกสำหรับฝึก ── */
  function replaceWord(text, word, reading) {
    var pp = prep(text, word), low = pp.low, lw = pp.lw;
    var out = '', from = 0, i;
    while ((i = findAt(low, lw, from)) >= 0) { out += text.slice(from, i) + reading; from = i + lw.length; }
    return out + text.slice(from);
  }
  function hasWord(text, word) {
    var pp = prep(text, word);
    return findAt(pp.low, pp.lw, 0) >= 0;
  }
  /* main = ประโยคตัวอย่างที่แทนคำที่มี reading แล้ว (หนึ่งประโยคต่อหนึ่งย่อหน้า คั่นบรรทัดว่าง) · ไม่ซ้ำ
     pending = ประโยคที่ยังมีคำที่ไม่มี reading (โมเดลอ่านไม่ได้อยู่ดี — เก็บไว้รอใส่คำอ่านทีหลัง) */
  function trainingTexts(map) {
    var entries = list(map);
    var withR = entries.filter(function (e) { return e.reading; }).sort(function (a, b) { return b.word.length - a.word.length; });
    var noR = entries.filter(function (e) { return !e.reading; });
    var mainSet = {}, pendSet = {}, main = [], pend = [];
    entries.forEach(function (e) {
      e.examples.forEach(function (ex) {
        var s = ex;
        withR.forEach(function (r) { s = replaceWord(s, r.word, r.reading); });
        s = s.replace(/\s+/g, ' ').trim();
        if (!s) return;
        var unresolved = noR.some(function (n) { return hasWord(s, n.word); });
        if (unresolved) { if (!pendSet[s]) { pendSet[s] = 1; pend.push(s); } } else if (!mainSet[s]) { mainSet[s] = 1; main.push(s); }
      });
    });
    return { main: main.length ? main.join('\n\n') + '\n' : '', pending: pend.length ? pend.join('\n\n') + '\n' : '', mainCount: main.length, pendingCount: pend.length };
  }
  /* วันที่ YYYYMMDD เวลาไทย (UTC+7) */
  function dateStamp(ms) {
    var d = new Date((ms == null ? Date.now() : ms) + 7 * 3600 * 1000);
    return d.getUTCFullYear() + ('0' + (d.getUTCMonth() + 1)).slice(-2) + ('0' + d.getUTCDate()).slice(-2);
  }
  function fileNames(ms) {
    var s = dateStamp(ms);
    return { txt: 'tts-misread-' + s + '.txt', pending: 'tts-misread-pending-' + s + '.txt', json: 'tts-misread-' + s + '.json' };
  }
  function exportJson(map) {
    var out = {};
    list(map).forEach(function (e) { out[key(e.word)] = e; });
    return JSON.stringify(out, null, 2) + '\n';
  }

  return {
    MAX_WORDS: MAX_WORDS, MAX_EXAMPLES: MAX_EXAMPLES, MAX_EXAMPLE_LEN: MAX_EXAMPLE_LEN, MAX_WORD_LEN: MAX_WORD_LEN, MAX_READING_LEN: MAX_READING_LEN, MAX_PER_RUN: MAX_PER_RUN,
    key: key, cleanWord: cleanWord, cleanReading: cleanReading, cleanEntry: cleanEntry,
    examplesFor: examplesFor, apply: apply, skipItems: skipItems, reportItem: reportItem, list: list, inLexicon: inLexicon,
    trainingTexts: trainingTexts, dateStamp: dateStamp, fileNames: fileNames, exportJson: exportJson
  };
});
