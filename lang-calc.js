/* lang-calc.js — ตรรกะล้วนของหน้าเรียนภาษา (languages.html) · UMD `window.LangCalc` · ไม่มี DOM/storage · `require()` ได้ใน test
   แต่ละงาน (L1, L4, L5 …) เพิ่มบล็อกของตัวเองเป็นหัว "// ── <งาน>" ต่อท้ายก่อน `return LangCalc` — อย่าแก้บล็อกของงานอื่น */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LangCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var LangCalc = {};

  // ── L4 ซับไตเติล ──────────────────────────────────────────────────────────────
  // parseSubs(text) → [{start,end,text}] (วินาที) · pairSubs(a, b) → a + {thai} · similarity/band = คะแนนพูดตาม
  // รูปแบบ: SRT + WebVTT · ไฟล์ของผู้ใช้อยู่ในเครื่องเท่านั้น (ฟังก์ชันพวกนี้ไม่แตะเครือข่าย/storage)
  LangCalc.subs = (function () {
    var NOSPACE = /[\u3000-\u30FF\u3400-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/; // ญี่ปุ่น/จีน — ต่อบรรทัดไม่ใส่ช่องว่าง (ไทย/อังกฤษใส่ — ตัดบรรทัดซับมักอยู่ที่ขอบวลี)
    var TIMING = /^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)/;
    var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', lrm: '', rlm: '' };

    // 'hh:mm:ss,mmm' | 'mm:ss.mmm' | 'h:mm:ss' → ms · ไม่ใช่เวลา/นาทีหรือวินาที ≥ 60 = null
    function toMs(s) {
      var m = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(s);
      if (!m) return null;
      var mi = +m[2], se = +m[3];
      if (mi > 59 || se > 59) return null;
      return (((m[1] ? +m[1] : 0) * 60 + mi) * 60 + se) * 1000 + (m[4] ? +(m[4] + '00').slice(0, 3) : 0);
    }
    function clean(line) {
      return line.replace(/\{\\[^}]*\}/g, '').replace(/<[^>]*>/g, '')
        .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (all, e) {
          if (e.charAt(0) === '#') { var n = e.charAt(1).toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
          var k = e.toLowerCase();
          return Object.prototype.hasOwnProperty.call(ENT, k) ? ENT[k] : all;
        }).replace(/\s+/g, ' ').trim();
    }
    function join(lines) {
      var out = '';
      lines.forEach(function (l) {
        if (!l) return;
        out += out && !(NOSPACE.test(out.slice(-1)) && NOSPACE.test(l.charAt(0))) ? ' ' + l : l;
      });
      return out;
    }

    // ไบต์ของไฟล์ซับ → ข้อความ: UTF-8 ก่อน (TextDecoder ตัด BOM เอง) · มีตัวถอดไม่ได้ (U+FFFD) → ลองรหัสเดิมของภาษานั้น (ซับไทยจำนวนมากเป็น TIS-620 = windows-874 ค่าเริ่มต้น)
    // legacy: label ของ TextDecoder (windows-1252, shift_jis, gbk …) · null = ไม่ลอง · เบราว์เซอร์ไม่รู้จัก label/ยังเป็น U+FFFD = คืนผล UTF-8 เดิม
    // shortcut: ไม่ตรวจ UTF-16/ไม่เดารหัสเอง — ผู้เรียกเป็นคนบอกรหัสตามภาษา · เปลี่ยนเมื่อมีผู้ใช้เจอซับ UTF-16 จริง
    function decode(bytes, legacy) {
      var u = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
      var text = new TextDecoder('utf-8').decode(u);
      if (text.indexOf('\uFFFD') < 0) return text;
      var label = legacy === undefined ? 'windows-874' : legacy;
      if (!label) return text;
      try { var alt = new TextDecoder(label).decode(u); return alt.indexOf('\uFFFD') < 0 ? alt : text; } catch (e) { return text; }
    }

    function parseSubs(text) {
      if (typeof text !== 'string') return [];
      var lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/), cues = [], cur = null, skip = false;
      function close() { if (cur) { var t = join(cur.lines); if (t) cues.push({ start: cur.start / 1000, end: cur.end / 1000, text: t }); } cur = null; }
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i], tm = TIMING.exec(ln);
        if (tm) {
          close(); skip = false;
          var a = toMs(tm[1]), b = toMs(tm[2]);
          if (a === null || b === null || b <= a) skip = true; else cur = { start: a, end: b, lines: [] };
        } else if (!ln.trim()) { close(); skip = false; }
        else if (cur && !skip) {
          // SRT ที่ลืมบรรทัดว่างคั่น: เลขลำดับของ cue ถัดไปไม่ใช่ข้อความ
          if (/^\s*\d+\s*$/.test(ln) && i + 1 < lines.length && TIMING.test(lines[i + 1])) continue;
          cur.lines.push(clean(ln));
        }
      }
      close();
      return cues.map(function (c, i) { return { c: c, i: i }; })
        .sort(function (x, y) { return x.c.start - y.c.start || x.i - y.i; })
        .map(function (x) { return x.c; });
    }

    // จับซับที่สอง (ไทย) เข้ากับซับหลักตามเวลาซ้อนทับมากสุด (เสมอ = cue แรก) · ไม่ซ้อนเลย = cue ที่ห่าง ≤ maxGap วิ
    // shortcut: O(n·m) · ซับหลักหลายหมื่น cue ค่อยเปลี่ยนเป็น two-pointer
    function pairSubs(a, b, opts) {
      var maxGap = opts && opts.maxGap != null ? opts.maxGap : 1;
      var buckets = a.map(function () { return []; });
      (b || []).forEach(function (cb) {
        var best = -1, bestOv = 0, near = -1, nearGap = Infinity;
        for (var i = 0; i < a.length; i++) {
          if (a[i].start > cb.end + maxGap) break;
          var ov = Math.min(a[i].end, cb.end) - Math.max(a[i].start, cb.start);
          if (ov > bestOv + 1e-9) { bestOv = ov; best = i; }
          else if (ov <= 0) { var g = -ov; if (g < nearGap - 1e-9) { nearGap = g; near = i; } }
        }
        if (best < 0 && nearGap <= maxGap) best = near;
        if (best >= 0) buckets[best].push(cb);
      });
      return a.map(function (c, i) {
        return { start: c.start, end: c.end, text: c.text, thai: buckets[i].map(function (x) { return x.text; }).join(' ') };
      });
    }

    // ตัดวรรคตอน/สัญลักษณ์ ตัวพิมพ์เล็ก NFKC · ช่องว่างซ้ำเหลืออันเดียว (ใช้โชว์ diff)
    function normalize(s) {
      var t = String(s == null ? '' : s);
      if (t.normalize) t = t.normalize('NFKC');
      t = t.toLowerCase();
      try { t = t.replace(/[\p{P}\p{S}]/gu, ''); } catch (e) { t = t.replace(/[.,!?;:'"“”‘’、。？！，：；（）()\[\]\-–—…]/g, ''); }
      return t.replace(/\s+/g, ' ').trim();
    }
    function lev(a, b) {
      var m = a.length, n = b.length;
      if (!m) return n; if (!n) return m;
      var prev = [], cur, i, j;
      for (j = 0; j <= n; j++) prev[j] = j;
      for (i = 1; i <= m; i++) {
        cur = [i];
        for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        prev = cur;
      }
      return prev[n];
    }
    // 0..1 = 1 − ระยะ Levenshtein ระดับตัวอักษร / ความยาวที่มากกว่า (ไม่นับช่องว่าง — Whisper ไม่เว้นวรรคเหมือนซับ) · ว่างฝั่งใดฝั่งหนึ่ง = 0
    function similarity(spoken, target) {
      var a = normalize(spoken).replace(/ /g, ''), b = normalize(target).replace(/ /g, '');
      if (!a || !b) return 0;
      return 1 - lev(a, b) / Math.max(a.length, b.length);
    }
    // เกณฑ์เดียวกับ gradeAnswer ของหน้า (ShadowingPanel)
    function band(sim) { return sim >= 0.9 ? 'correct' : sim >= 0.7 ? 'almost' : 'wrong'; }

    // cue ที่ครอบเวลา t ([start,end)) · ซ้อนกัน = อันที่เริ่มทีหลัง · ไม่มี = -1
    function cueAt(cues, t) {
      var r = -1;
      for (var i = 0; i < cues.length; i++) { if (cues[i].start > t) break; if (t < cues[i].end) r = i; }
      return r;
    }
    function fmt(sec) {
      var s = Math.max(0, Math.floor(sec || 0)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
      return (h ? h + ':' + (m < 10 ? '0' : '') + m : m) + ':' + (x < 10 ? '0' : '') + x;
    }
    // segments ของ ASR → cue: ตัดข้อความ ทิ้งว่าง end ≤ start ยืดเป็น +0.5 วิ ไม่ให้ซ้อนกัน (cue ก่อนหน้าจบเมื่อ cue ถัดไปเริ่ม)
    function segmentsToCues(segs) {
      var out = [];
      (segs || []).forEach(function (s) {
        var t = String(s && s.text != null ? s.text : '').replace(/\s+/g, ' ').trim(), a = +s.start, b = +s.end;
        if (!t || !isFinite(a)) return;
        if (!isFinite(b) || b <= a) b = a + 0.5;
        out.push({ start: a, end: b, text: t });
      });
      out.sort(function (x, y) { return x.start - y.start; });
      for (var i = 0; i + 1 < out.length; i++) if (out[i].end > out[i + 1].start) out[i].end = out[i + 1].start;
      return out.filter(function (c) { return c.end > c.start; });
    }

    return { decode: decode, parseSubs: parseSubs, pairSubs: pairSubs, normalize: normalize, similarity: similarity, band: band, cueAt: cueAt, fmt: fmt, segmentsToCues: segmentsToCues };
  })();

  return LangCalc;
});
