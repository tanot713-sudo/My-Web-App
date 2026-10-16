/* ══════════════════════════════════════════════════════════════════
   tts-long.js — งานสร้างเสียงยาว (UMD, window/self.TanotTtsLong, ไม่มี DOM/storage/เครือข่าย; require() ได้ใน test)
   ใช้โดย text-to-speech.js (การ์ด "สร้างไฟล์เสียง") — ตรรกะล้วนอยู่ที่นี่ หน้าเว็บมีแต่การต่อสายกับ UI/Worker

   ปัญหาที่แก้ (นิยายแปล ~175,000 ตัวอักษร ≈ หลายชั่วโมงเสียง): เดิมเก็บเสียงทุกท่อนในหน้าแล้วต่อเป็นไฟล์เดียว → หน่วยความจำ
   (16 kHz float32 ≈ 64 KB/วินาที → 1 ชั่วโมง ≈ 230 MB ก่อนแปลงเป็น WAV/MP3) พุ่งจนแท็บแครชทั้งงาน และผู้ใช้ไม่ได้อะไรเลยสักไฟล์
   • splitChapters(text)  แบ่งข้อความตามหัวตอน (บรรทัดขึ้นต้น `เลข.` หรือ `เลข)`) → ส่วนละตอน · ไม่พบหัวตอน = null (หน้าแบ่งทุก ~30 นาทีเสียงแทน)
   • chapterFileName      ชื่อไฟล์ = เลขตอน 3 หลัก + หัวตอนสั้นๆ (ตัดอักขระที่ใช้ในชื่อไฟล์ไม่ได้ ไม่ตัดกลางพยางค์)
   • createCollector      รับเสียงรายท่อนที่เสร็จ "ลำดับใดก็ได้" แล้วส่งออกเป็นส่วน (ตอน/ช่วง ~30 นาที) ทันทีที่ท่อนในส่วนนั้นเสร็จครบต่อเนื่อง
                          → ส่วนที่ส่งออกแล้วถูกปล่อยจากหน่วยความจำ (เหลือเฉพาะส่วนที่ยังไม่ครบ)
   • createEta            ETA จากค่าเฉลี่ยเคลื่อนที่ (ไม่ใช้ elapsed/done ซึ่งรวมช่วงโหลดโมเดลและช่วงทยอยเปิด Worker แล้วประเมินสูงเกิน)
   • statsInfo            สรุปสถิติสำหรับ problem log — ตัวเลข/รหัสสั้นๆ เท่านั้น ไม่มีเนื้อหาของผู้ใช้ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TanotTtsLong = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TIME_SPLIT_SEC = 30 * 60;        // ไม่พบหัวตอน → ตัดส่วนที่ขอบย่อหน้าแรกหลังครบเวลานี้
  var TIME_HARD_CAP_SEC = 35 * 60;     // ย่อหน้ายาวมาก → ตัดที่ท่อนไหนก็ได้เมื่อเกินเวลานี้
  var HEADING_MAX_CHARS = 150;         // บรรทัดที่ยาวกว่านี้ไม่ใช่หัวตอน (เป็นย่อหน้าที่ขึ้นต้นด้วยเลขข้อ)
  var TITLE_MAX = 30;                  // ความยาวหัวตอนในชื่อไฟล์

  function arabic(s) {
    return String(s).replace(/[๐-๙]/g, function (c) { return String(c.charCodeAt(0) - 0x0E50); })
      .replace(/[０-９]/g, function (c) { return String(c.charCodeAt(0) - 0xFF10); });
  }
  /* `12. ชื่อตอน` · `2) ชื่อตอน` · `๓ . ชื่อ` — เลขตามด้วย . หรือ ) (ไม่ใช่ทศนิยม "3.5") */
  var HEADING_RE = /^\s*(\d{1,5})\s*[.)](?!\d)\s*(.*)$/;
  function headingOf(line) {
    if (!line || line.length > HEADING_MAX_CHARS) return null;
    var m = HEADING_RE.exec(arabic(line));
    return m ? { num: parseInt(m[1], 10), title: m[2].replace(/\s+/g, ' ').trim() } : null;
  }

  /* → [{ num, title, text }] หรือ null ถ้าไม่พบหัวตอนเลย · ข้อความก่อนหัวตอนแรก (ถ้ามี) เป็นส่วน num 0 · ใส่บรรทัดว่างหลังหัวตอน (หัวตอนเป็นท่อน/ย่อหน้าของตัวเอง) */
  function splitChapters(text) {
    var lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    var parts = [], cur = null, found = 0;
    function start(num, title) { cur = { num: num, title: title, lines: [] }; parts.push(cur); }
    lines.forEach(function (line) {
      var h = headingOf(line);
      if (h) { found++; start(h.num, h.title); cur.lines.push(line.trim(), ''); return; }
      if (!cur) { if (!/\S/.test(line)) return; start(0, ''); }
      cur.lines.push(line);
    });
    if (!found) return null;
    return parts.map(function (p) { return { num: p.num, title: p.title, text: p.lines.join('\n').replace(/^\n+|\n+$/g, '') }; });
  }

  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function cutTitle(t) {
    t = String(t || '').replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (t.length <= TITLE_MAX) return t;
    var cut = t.slice(0, TITLE_MAX), sp = cut.lastIndexOf(' ');
    if (sp >= 12) cut = cut.slice(0, sp);
    cut = cut.replace(/[เ-ไ]+$/, '');        // ไม่ลงท้ายด้วยสระนำ
    return cut.replace(/[\s.\-_]+$/, '');
  }
  /* ชื่อไฟล์ไม่มีนามสกุล: `012-ชื่อตอน` · ซ้ำกับที่มีอยู่แล้ว (used = {name:true}) ต่อท้าย -2, -3 … */
  function chapterFileName(part, used) {
    var base = pad(part.num || 0, 3) + (cutTitle(part.title) ? '-' + cutTitle(part.title) : ''), name = base, k = 1;
    used = used || {};
    while (used[name]) { k++; name = base + '-' + k; }
    used[name] = true;
    return name;
  }
  /* ไม่พบหัวตอน → ตัดตามเวลา: part-001, part-002 … */
  function timeFileName(index, used) { var name = 'part-' + pad(index + 1, 3), k = 1; used = used || {}; while (used[name]) { k++; name = 'part-' + pad(index + 1, 3) + '-' + k; } used[name] = true; return name; }

  function formatDur(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + pad(m, 2) : m) + ':' + pad(s, 2);
  }

  /* ══════════════ ตัวรวบรวมเสียงรายท่อน → ส่วน ══════════════
     opts: { total, gaps:[วินาทีหลังท่อน i], paras:[…], ends:[ดัชนีท่อนสุดท้ายของแต่ละส่วน] | targetSec/hardCapSec (แบบตามเวลา), onPart }
     add(i, audioFloat32, sampleRate) — เรียกตามลำดับใดก็ได้ · onPart({ index, from, to, parts:[Float32Array…], gaps:[วินาที…], samples, seconds, startSec }) */
  function createCollector(o) {
    var total = o.total, buf = new Array(total), sr = 16000, next = 0, partStart = 0, partSamples = 0, partIndex = 0, elapsedBefore = 0;
    var ends = o.ends || null, target = o.targetSec || TIME_SPLIT_SEC, cap = o.hardCapSec || TIME_HARD_CAP_SEC;
    function gapAfter(j) { return j >= total - 1 ? 0 : (o.gaps && o.gaps[j]) || 0; }
    function shouldClose(j, seconds) {
      if (j >= total - 1) return true;
      if (ends) return j === ends[partIndex];
      if (seconds >= cap) return true;
      return seconds >= target && !!o.paras && o.paras[j + 1] !== o.paras[j];
    }
    function closePart(j) {
      var parts = buf.slice(partStart, j + 1), gaps = [];
      for (var q = partStart; q <= j; q++) gaps.push(q === j ? 0 : gapAfter(q));
      for (q = partStart; q <= j; q++) buf[q] = undefined;     // ปล่อยหน่วยความจำของส่วนนี้ (ส่งต่อให้ตัวเข้ารหัสแบบ transfer)
      var samples = parts.reduce(function (s, a) { return s + a.length; }, 0) + gaps.reduce(function (s, g) { return s + Math.round(g * sr); }, 0);
      var info = { index: partIndex, from: partStart, to: j, parts: parts, gaps: gaps, samples: samples, rate: sr, seconds: samples / sr, startSec: elapsedBefore };
      elapsedBefore += samples / sr + gapAfter(j);
      partStart = j + 1; partSamples = 0; partIndex++;
      if (o.onPart) o.onPart(info);
    }
    function advance() {
      while (next < total && buf[next]) {
        var j = next;
        partSamples += buf[j].length + Math.round(gapAfter(j) * sr);
        next++;
        if (shouldClose(j, partSamples / sr)) closePart(j);
      }
    }
    return {
      add: function (i, audio, rate) { if (i < 0 || i >= total || buf[i]) return; if (rate) sr = rate; buf[i] = audio; advance(); },
      /* ท่อนที่ยังรอส่วนของตัวเองครบ (ใช้ทดสอบว่าหน่วยความจำถูกปล่อยจริง) */
      held: function () { var n = 0; for (var i = 0; i < total; i++) if (buf[i]) n++; return n; },
      closed: function () { return partIndex; }
    };
  }

  /* ══════════════ ETA แบบค่าเฉลี่ยเคลื่อนที่ ══════════════
     mark(done, total, nowMs, ramping) → { rate: วินาที/ท่อน | null, eta: วินาทีที่เหลือ | null }
     • ท่อนแรกที่เสร็จเป็นเส้นฐาน (รวมเวลาโหลดโมเดล/อุ่นเครื่อง — ไม่นับเป็นอัตรา)
     • อัตรา = (เวลา ÷ จำนวนท่อน) ในหน้าต่าง `win` จุดล่าสุด (ใช้ผลต่างของ done จริง — หลาย Worker เสร็จพร้อมกันได้)
     • ramping = true (ยังทยอยเปิด Worker อยู่) → ยังไม่ประเมิน ETA (อัตราช่วงนั้นต่ำกว่าอัตราเต็มกำลัง ประเมินแล้วจะสูงเกิน)
       และพอเปิดครบ (ramping เปลี่ยนเป็น false) หน้าต่างเริ่มใหม่ — ไม่ถัวช่วงทยอยเปิดเข้าไปในอัตราเต็มกำลัง */
  function createEta(opts) {
    opts = opts || {};
    var win = opts.window || 20, minSpan = opts.minChunks || 3, marks = [], wasRamping = false;
    return {
      mark: function (done, total, now, ramping) {
        if (wasRamping && !ramping) marks = []; // ทยอยเปิด Worker ครบแล้ว → เริ่มวัดอัตราเต็มกำลังใหม่ (ไม่ถัวช่วงที่ยังเปิดไม่ครบ)
        wasRamping = !!ramping;
        marks.push({ t: now, d: done });
        if (marks.length > win + 1) marks.shift();
        if (marks.length < 2 || ramping) return { rate: marks.length >= 2 ? rate() : null, eta: null };
        var r = rate();
        if (r == null || done - marks[0].d < minSpan) return { rate: r, eta: null };
        return { rate: r, eta: Math.max(0, total - done) * r };
      },
      reset: function () { marks = []; }
    };
    function rate() {
      var a = marks[0], b = marks[marks.length - 1], dd = b.d - a.d;
      return dd > 0 && b.t > a.t ? (b.t - a.t) / 1000 / dd : null;
    }
  }

  /* สถิติหลังงานเสร็จ → ข้อความสั้นสำหรับ TanotMedia.logNote (ไม่มีเนื้อหา/ชื่อไฟล์) */
  function statsInfo(s) {
    function n(v, d) { return v == null || !isFinite(v) ? '-' : (+v).toFixed(d == null ? 0 : d); }
    return ['chars=' + n(s.chars), 'chunks=' + n(s.chunks), 'max=' + n(s.max), 'workers=' + n(s.workers), 'device=' + (s.device || 'wasm'),
      'sec=' + n(s.sec, 1), 'sec/chunk=' + n(s.secPerChunk, 2), 'sec/1000ch=' + n(s.secPer1000, 1), 'parts=' + n(s.parts), 'mode=' + (s.mode || 'single'),
      s.cancelled ? 'cancelled' : ''].filter(Boolean).join(' ');
  }

  return {
    TIME_SPLIT_SEC: TIME_SPLIT_SEC, TIME_HARD_CAP_SEC: TIME_HARD_CAP_SEC,
    headingOf: headingOf, splitChapters: splitChapters, chapterFileName: chapterFileName, timeFileName: timeFileName, formatDur: formatDur,
    createCollector: createCollector, createEta: createEta, statsInfo: statsInfo
  };
});
