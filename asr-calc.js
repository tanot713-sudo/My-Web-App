/* ══════════════════════════════════════════════════════════════════
   asr-calc.js — ตรรกะล้วนของการถอดเสียง (UMD, window.AsrCalc, ไม่มี DOM/storage/เครือข่าย; require() ได้ใน test)
   ใช้โดย asr-cloud.js (คลาวด์), text-to-speech.js (ผลลัพธ์/ย่อหน้า/เวลา), media-core.js ไม่ใช้ไฟล์นี้

   1) วางแผนท่อนเหลื่อม  planChunks  — ท่อนละ ~28 วินาที ตัดที่จุดเงียบ แต่ละท่อน (ยกเว้นท่อนแรก) เริ่มถอยหลังไป OVERLAP_SEC (1.5 วิ)
      จากจุดตัด → คำที่อยู่ตรงรอยต่อถูกถอดทั้งสองท่อน ไม่ขาดกลางคำ (Whisper พลาดบ่อยที่ขอบท่อน)
   2) ตัดคำซ้ำที่รอยต่อ  trimSeam / mergeChunks  — เทียบ "ท้ายข้อความที่ได้แล้ว" กับ "ต้นท่อนถัดไป" ระดับตัวอักษร
      (ไทยไม่มีเว้นวรรค จึงเทียบ suffix/prefix ที่ยาวที่สุด ≥ MIN_SEAM_CHARS โดยไม่นับช่องว่าง/เครื่องหมายวรรคตอน/ตัวพิมพ์)
      อนุญาตให้ต้นท่อนถัดไปมี "ตัวอักษรขยะ" นำหน้าได้ไม่เกิน MAX_HEAD_SKIP ตัว (คำแรกถูกตัดครึ่งแล้วโมเดลเดา)
   3) ย่อหน้า + เวลา  paragraphs / render / formatTime — แบ่งย่อหน้าตามช่วงเงียบระหว่างช่วงคำพูด (timestamp ของ segment)
   4) ประมาณ Neurons  neuronsFor — รวมส่วนเหลื่อม (ไม่เกิน ~5% ของเสียงจริง) ใช้เตือนก่อนเริ่ม
   ค่าคงที่ที่ฝั่งเซิร์ฟเวอร์ต้องตรงกัน (โมเดล/อัตรา Neurons) อยู่ที่ functions/_lib/ai.js + functions/_lib/asr.js ไม่ใช่ที่นี่ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AsrCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RATE = 16000;
  var STEP_SEC = 28;          // ระยะจากจุดตัดหนึ่งถึงจุดตัดถัดไป (เป้าหมาย; ขยับตามจุดเงียบ ±SEARCH_SEC)
  var SEARCH_SEC = 3;
  var OVERLAP_SEC = 1.5;      // ท่อนถัดไปเริ่มก่อนจุดตัดเท่านี้ (1–2 วินาที)
  var MAX_PARALLEL = 3;
  var MIN_SEAM_CHARS = 4;     // รอยต่อที่ซ้ำกันต้องยาวอย่างน้อยกี่ตัวอักษร (ไม่นับช่องว่าง/วรรคตอน) ถึงจะตัด
  var MAX_SEAM_CHARS = 18 * OVERLAP_SEC + 20; // ส่วนเหลื่อม 1.5 วิ พูดได้ไม่เกินราวนี้ — กันตัดข้อความจริงที่บังเอิญซ้ำกว่านั้น
  var MAX_HEAD_SKIP = 2;
  var NEURONS_PER_MINUTE = 46.63; // whisper-large-v3-turbo = 0.000513 USD/นาที ÷ 0.011 USD ต่อ 1,000 Neurons (functions/_lib/ai.js)

  /* ── ตัวอักษรที่นับเทียบ: ตัวอักษร/ตัวเลข/เครื่องหมายสระวรรณยุกต์ (\p{M}) — ไม่นับช่องว่าง วรรคตอน สัญลักษณ์ ── */
  var DROP_RE = /[\s​‌‍﻿]|\p{P}|\p{S}/u;
  /* → { s: 'ข้อความที่ปรับแล้ว', idx: [ตำแหน่งใน original ของแต่ละตัว] } */
  function squash(str) {
    str = String(str == null ? '' : str);
    var s = '', idx = [], i = 0;
    for (var ch of str) {
      if (!DROP_RE.test(ch)) { s += ch.toLowerCase(); idx.push(i); }
      i += ch.length;
    }
    return { s: s, idx: idx };
  }
  function squashLen(str) { return squash(str).s.length; }

  /* ── 1) รอยต่อ ── */
  /* tail = ข้อความท้ายที่ได้แล้ว, head = ข้อความต้นท่อนถัดไป → { drop: จำนวนตัวอักษร(ปรับแล้ว) ที่ต้องตัดออกจากต้น head, len: ความยาวส่วนที่ซ้ำ, skip }
     drop = 0 เมื่อไม่ซ้ำ · เลือก "ส่วนซ้ำที่ยาวที่สุด" ก่อน (ตัวขยะนำหน้าน้อยกว่าชนะเมื่อเท่ากัน) */
  function seamOverlap(tail, head, opts) {
    opts = opts || {};
    var min = opts.minChars != null ? opts.minChars : MIN_SEAM_CHARS;
    var max = opts.maxChars != null ? opts.maxChars : MAX_SEAM_CHARS;
    var maxSkip = opts.maxSkip != null ? opts.maxSkip : MAX_HEAD_SKIP;
    var a = squash(tail).s, b = squash(head).s;
    var best = { drop: 0, len: 0, skip: 0 };
    for (var skip = 0; skip <= maxSkip; skip++) {
      var top = Math.min(a.length, b.length - skip);
      for (var k = top; k >= min; k--) {
        if (a.slice(a.length - k) === b.slice(skip, skip + k)) {
          /* ซ้ำยาวเกินที่ส่วนเหลื่อม 1.5 วิ จะพูดได้ = ไม่ใช่รอยต่อ (เป็นข้อความจริงที่พูดซ้ำ) → ไม่ตัด */
          if (k <= max && k > best.len) best = { drop: skip + k, len: k, skip: skip };
          break;
        }
      }
    }
    return best;
  }
  /* ตัด "n ตัวอักษรที่ปรับแล้ว" ออกจากต้นข้อความ original (คงเครื่องหมาย/ช่องว่างตามเดิมหลังจุดตัด) → { text, frac: สัดส่วนที่ตัดไปของตัวอักษรทั้งหมด } */
  function dropHead(str, n) {
    var q = squash(str);
    if (n <= 0 || !q.s.length) return { text: String(str == null ? '' : str).trim(), frac: 0 };
    if (n >= q.s.length) return { text: '', frac: 1 };
    var cut = q.idx[n]; // ตำแหน่ง original ของตัวแรกที่เหลือ
    return { text: String(str).slice(cut).replace(/^[\s,.;:!?，。、]+/, '').trim(), frac: n / q.s.length };
  }
  /* ตัดซ้ำระดับข้อความล้วน: คืนข้อความต้นท่อนถัดไปที่ตัดส่วนซ้ำแล้ว */
  function trimSeam(tail, head, opts) {
    var o = seamOverlap(tail, head, opts);
    return { text: o.drop ? dropHead(head, o.drop).text : String(head == null ? '' : head).trim(), dropped: o.drop, overlap: o.len };
  }

  /* ── 2) วางแผนท่อน ── */
  /* total = จำนวน sample, cutAt(target, lo, hi) → ตำแหน่ง sample ของจุดเงียบที่สุดในช่วง [lo, hi) (ถ้าไม่ส่ง = ตัดตรงเป้า)
     → [{ a, b, start, end, ov }] : a..b = ช่วงที่ส่ง (a ถอยหลัง overlap), start = จุดตัดต้นท่อน (a ของท่อนแรก = 0), ov = วินาทีที่เหลื่อมกับท่อนก่อน */
  function planChunks(total, opts) {
    opts = opts || {};
    var rate = opts.rate || RATE;
    var step = Math.round((opts.stepSec || STEP_SEC) * rate), search = Math.round((opts.searchSec != null ? opts.searchSec : SEARCH_SEC) * rate);
    var ov = Math.round((opts.overlapSec != null ? opts.overlapSec : OVERLAP_SEC) * rate);
    var tailMin = Math.round((opts.tailMinSec != null ? opts.tailMinSec : 4) * rate); // ท่อนสุดท้ายสั้นกว่านี้ รวมเข้าท่อนก่อนหน้า
    var out = [], start = 0;
    if (!(total > 0)) return out;
    while (start < total) {
      var target = start + step, end;
      if (target >= total - tailMin) end = total;
      else {
        var lo = Math.max(start + Math.round(rate), target - search), hi = Math.min(total - 1, target + search);
        end = opts.cutAt ? opts.cutAt(target, lo, hi) : target;
        if (!(end > start)) end = target;
      }
      var a = out.length ? Math.max(0, start - ov) : 0;
      out.push({ a: a, b: end, start: start, end: end, ov: (start - a) / rate });
      start = end;
    }
    return out;
  }
  /* ส่งไปทั้งหมดกี่วินาทีเสียง (รวมส่วนเหลื่อม) */
  function sentSeconds(chunks, rate) {
    rate = rate || RATE;
    return chunks.reduce(function (s, c) { return s + (c.b - c.a) / rate; }, 0);
  }
  function neuronsFor(seconds) { return seconds / 60 * NEURONS_PER_MINUTE; }

  /* ── 3) ประกอบผลตามลำดับเดิม ── */
  /* chunks[i] = { offset (วินาทีที่ท่อนเริ่มในไฟล์), text, segments?: [{start,end,text}] (เวลาสัมพัทธ์กับท่อน), duration? }
     → { text, segments: [{start,end,text}] (เวลาจริงในไฟล์), trimmed: [จำนวนตัวอักษรที่ตัดต่อรอยต่อ] } */
  function mergeChunks(chunks, opts) {
    opts = opts || {};
    var segs = [], trimmed = [];
    chunks.forEach(function (c, ci) {
      var list = [];
      var off = +c.offset || 0;
      (c.segments || []).forEach(function (s) {
        var t = String(s.text == null ? '' : s.text).trim();
        if (t) list.push({ start: off + (+s.start || 0), end: off + (+s.end || 0), text: t });
      });
      if (!list.length) {
        var tx = String(c.text == null ? '' : c.text).trim();
        if (tx) list.push({ start: off, end: off + (+c.duration || 0), text: tx });
      }
      var drop = 0, dropped = 0;
      if (ci > 0 && segs.length && list.length) {
        var tail = segs.slice(-6).map(function (s) { return s.text; }).join(' ');
        var head = list.slice(0, 8).map(function (s) { return s.text; }).join(' ');
        drop = dropped = seamOverlap(tail, head, opts).drop;
        while (drop > 0 && list.length) {
          var n = squashLen(list[0].text);
          if (drop >= n) { drop -= n; list.shift(); continue; }
          var r = dropHead(list[0].text, drop);
          list[0].start += (list[0].end - list[0].start) * r.frac;
          list[0].text = r.text; drop = 0;
        }
      }
      trimmed.push(dropped);
      list.forEach(function (s) { if (s.text) segs.push(s); });
    });
    return { text: segs.map(function (s) { return s.text; }).join(' ').replace(/\s+/g, ' ').trim(), segments: segs, trimmed: trimmed };
  }

  /* ── 4) ย่อหน้า / เวลา ── */
  var PARA = { gapSec: 1.6, bigGapSec: 4, minChars: 60, maxChars: 480 };
  /* segments = [{start,end,text,para?}] เวลาเรียงขึ้น → [{start,end,text}] ย่อหน้าละหลายช่วงคำพูด
     ขึ้นย่อหน้าใหม่เมื่อ (ช่วงเงียบ ≥ gapSec และย่อหน้านี้ยาวพอ) หรือ (ช่วงเงียบ ≥ bigGapSec) หรือ (ยาวเกิน maxChars) หรือ seg.para === true */
  function paragraphs(segments, opts) {
    var o = {}; Object.keys(PARA).forEach(function (k) { o[k] = opts && opts[k] != null ? opts[k] : PARA[k]; });
    var out = [], cur = null, prevEnd = 0;
    (segments || []).forEach(function (s) {
      var t = String(s.text || '').trim();
      if (!t) return;
      var gap = cur ? s.start - prevEnd : 0;
      var curLen = cur ? cur.text.length : 0;
      var brk = !cur || s.para === true || gap >= o.bigGapSec || (gap >= o.gapSec && curLen >= o.minChars) || curLen >= o.maxChars;
      if (brk) { cur = { start: s.start, end: s.end, text: t }; out.push(cur); }
      else { cur.text += ' ' + t; cur.end = s.end; }
      prevEnd = s.end;
    });
    return out;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function formatTime(sec) {
    sec = Math.max(0, Math.floor(+sec || 0));
    return pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor(sec % 3600 / 60)) + ':' + pad(sec % 60);
  }
  /* ผลลัพธ์เป็นข้อความ: ย่อหน้าคั่นด้วยบรรทัดว่าง · timestamps = ใส่ [hh:mm:ss] หน้าย่อหน้า */
  function render(paras, opts) {
    var ts = !!(opts && opts.timestamps);
    return (paras || []).map(function (p) { return (ts ? '[' + formatTime(p.start) + '] ' : '') + p.text; }).join('\n\n');
  }

  return {
    RATE: RATE, STEP_SEC: STEP_SEC, SEARCH_SEC: SEARCH_SEC, OVERLAP_SEC: OVERLAP_SEC, MAX_PARALLEL: MAX_PARALLEL,
    MIN_SEAM_CHARS: MIN_SEAM_CHARS, MAX_SEAM_CHARS: MAX_SEAM_CHARS, NEURONS_PER_MINUTE: NEURONS_PER_MINUTE,
    squash: squash, seamOverlap: seamOverlap, trimSeam: trimSeam, planChunks: planChunks, sentSeconds: sentSeconds, neuronsFor: neuronsFor,
    mergeChunks: mergeChunks, paragraphs: paragraphs, formatTime: formatTime, render: render
  };
});
