/* ══════════════════════════════════════════════════════════════════
   Tanot — สร้างภาพ: พื้นโปร่ง / ลบพื้นหลัง — ตรรกะล้วน (ไม่มี DOM/storage) · UMD — window/self.TanotCutout, require() ได้ใน tests/image-gen.spec.js
   ใช้โดย image-gen.js (เธรดหลักเมื่อไม่มี Worker/OffscreenCanvas), image-cutout-worker.js (flood fill) และ image-bgremove-worker.js (ตารางโมเดล)

   floodTransparent(rgba, w, h, { tolerance, soft }) → { data, removed, kept, partial, seeds }
   • rgba = Uint8ClampedArray ยาว w*h*4 (ไม่แก้ต้นฉบับ — คืนสำเนาใหม่)
   • จุดเริ่ม = มุมทั้ง 4 · มุมที่สีต่างจากมุมอื่นทุกมุม (เกินค่าความต่าง) ไม่ใช้ = วัตถุทับมุมนั้น — ถ้าทุกมุมต่างกันหมด ใช้ทุกมุม
   • ไล่แบบ 4 ทิศจากแต่ละมุม: พิกเซลที่ต่างจาก "สีของมุมนั้น" ≤ tolerance (%) = พื้น → alpha 0 (เทียบกับสีมุม ไม่ใช่เพื่อนบ้าน — พื้นไล่สีเล็กน้อยยังผ่าน
     แต่การไล่สีไม่ไหลเข้าวัตถุทีละนิด) · ส่วนที่ไม่ต่อกับขอบ (ช่องในวงแหวน) ไม่ถูกลบ
   • ความต่าง (%) = max(ระยะ RGB แบบยุคลิด / 441.67, |Δalpha| / 255) × 100 · โปร่งทั้งคู่ (alpha < 8) = 0
   • soft (ค่าเริ่มต้นเปิด) = ขอบนุ่ม: พิกเซลวัตถุที่ติดกับพื้นที่ถูกลบ (4 ทิศ) หา "สีวัตถุ" = พิกเซลที่ไม่ถูกลบในรัศมี 2 ที่ต่างจากพื้นมากสุด แล้ว
     alpha = สัดส่วนการฉาย (p − พื้น)·(วัตถุ − พื้น)/|วัตถุ − พื้น|² (0–1) และแยกสีพื้นออก c = พื้น + (p − พื้น)/alpha (ไม่มีขอบสีพื้นติดรอบวัตถุ)
   • removed = จำนวนพิกเซล alpha 0 · kept = ที่เหลือ (รวมขอบนุ่ม) · partial = ขอบนุ่มที่ 0 < alpha < 255
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TanotCutout = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_TOLERANCE = 12;   // % — พื้นเรียบของไอคอน FLUX (สีเดียว มีบีบอัด/ไล่สีเล็กน้อย)
  var MAX_RGB = Math.sqrt(3 * 255 * 255);
  var CLEAR_ALPHA = 8;

  /* ── โมเดลลบพื้นหลัง (ที่เดียวของเว็บ) ──
     BiRefNet_lite (ZhengPeng7/BiRefNet_lite, MIT) แปลง ONNX โดย onnx-community — ฝึกแบบ DIS = ตัดได้ทั้งสิ่งของและคน (MODNet เก่งแค่คน, RMBG ของ briaai ห้ามใช้เชิงพาณิชย์)
     transformers.js 4.2.0 (vendor/) รองรับ model_type 'birefnet' ใน pipeline 'background-removal'
     bytes = ขนาดโดยประมาณ (แถบดาวน์โหลดก่อนรู้ Content-Length) จากผลค้นเว็บ — sandbox เข้า huggingface.co ไม่ได้: ตรวจ/ล็อก revision ด้วย
     `node tools/media-eval/check-models.mjs --cutout [--pin]` บนเครื่องที่ออกเน็ตได้ (เปลี่ยน revision = ทุกเครื่องโหลดรุ่นใหม่ — คีย์แคชของ transformers.js มี commit อยู่ใน URL) */
  var BG_MODEL = {
    id: 'onnx-community/BiRefNet_lite-ONNX',
    revision: 'main',
    bytes: { fp16: 115e6, fp32: 224e6 }
  };
  /* WebGPU ที่มี shader-f16 = fp16 (ครึ่งขนาด) · อื่นๆ (WASM / WebGPU ไม่มี f16) = fp32 — ORT บน WASM ไม่มี kernel fp16 ที่ดี */
  function bgDtype(device, f16) { return device === 'webgpu' && f16 ? 'fp16' : 'fp32'; }

  function clampTol(t) {
    t = Number(t);
    if (!isFinite(t)) return DEFAULT_TOLERANCE;
    return Math.max(0, Math.min(100, t));
  }
  /* ความต่าง (%) ระหว่างพิกเซลที่ดัชนีไบต์ i ของ a กับสี ref [r,g,b,a] */
  function diff(d, i, ref) {
    var a1 = d[i + 3], a2 = ref[3];
    if (a1 < CLEAR_ALPHA && a2 < CLEAR_ALPHA) return 0;
    var dr = d[i] - ref[0], dg = d[i + 1] - ref[1], db = d[i + 2] - ref[2];
    var c = Math.sqrt(dr * dr + dg * dg + db * db) / MAX_RGB, al = Math.abs(a1 - a2) / 255;
    return (c > al ? c : al) * 100;
  }
  function colorAt(d, p) { var i = p * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; }

  /* มุมที่ใช้เป็นจุดเริ่ม (ดัชนี 0 ซ้ายบน · 1 ขวาบน · 2 ซ้ายล่าง · 3 ขวาล่าง) */
  function cornerSeeds(d, w, h, tol) {
    var pos = [0, w - 1, (h - 1) * w, h * w - 1], cols = pos.map(function (p) { return colorAt(d, p); });
    var lim = Math.max(tol, 6), ok = [];
    for (var k = 0; k < 4; k++) {
      for (var j = 0; j < 4; j++) {
        if (j !== k && diff(cols[k], 0, cols[j]) <= lim) { ok.push(k); break; }
      }
    }
    if (!ok.length) ok = [0, 1, 2, 3];
    return { idx: ok, pos: pos, cols: cols };
  }

  function floodTransparent(src, w, h, opts) {
    opts = opts || {};
    w = w | 0; h = h | 0;
    if (!src || w < 1 || h < 1 || src.length !== w * h * 4) throw new Error('floodTransparent: size mismatch');
    var tol = clampTol(opts.tolerance == null ? DEFAULT_TOLERANCE : opts.tolerance);
    var soft = opts.soft !== false;
    var n = w * h, out = new Uint8ClampedArray(src);
    var region = new Int8Array(n).fill(-1); // -1 = วัตถุ · k = พื้นของมุม k
    var seeds = cornerSeeds(src, w, h, tol);
    var queue = new Int32Array(n), removed = 0;
    seeds.idx.forEach(function (k) {
      var start = seeds.pos[k], ref = seeds.cols[k];
      if (region[start] !== -1) return;
      var qh = 0, qt = 0;
      region[start] = k; queue[qt++] = start;
      while (qh < qt) {
        var p = queue[qh++], x = p % w, q;
        removed++;
        // 4 ทิศ
        if (x > 0) { q = p - 1; if (region[q] === -1 && diff(src, q * 4, ref) <= tol) { region[q] = k; queue[qt++] = q; } }
        if (x < w - 1) { q = p + 1; if (region[q] === -1 && diff(src, q * 4, ref) <= tol) { region[q] = k; queue[qt++] = q; } }
        if (p >= w) { q = p - w; if (region[q] === -1 && diff(src, q * 4, ref) <= tol) { region[q] = k; queue[qt++] = q; } }
        if (p < n - w) { q = p + w; if (region[q] === -1 && diff(src, q * 4, ref) <= tol) { region[q] = k; queue[qt++] = q; } }
      }
    });
    for (var p = 0; p < n; p++) if (region[p] !== -1) out[p * 4 + 3] = 0;

    var partial = 0;
    if (soft && removed > 0 && removed < n) {
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var pi = y * w + x;
          if (region[pi] !== -1) continue;
          var bgk = -1;
          if (x > 0 && region[pi - 1] !== -1) bgk = region[pi - 1];
          else if (x < w - 1 && region[pi + 1] !== -1) bgk = region[pi + 1];
          else if (y > 0 && region[pi - w] !== -1) bgk = region[pi - w];
          else if (y < h - 1 && region[pi + w] !== -1) bgk = region[pi + w];
          if (bgk < 0) continue;
          var bg = seeds.cols[bgk], i4 = pi * 4;
          if (src[i4 + 3] < CLEAR_ALPHA || bg[3] < CLEAR_ALPHA) continue; // พื้นโปร่งอยู่แล้ว — ไม่ต้องแยกสี
          // สีวัตถุ = พิกเซลวัตถุในรัศมี 2 ที่ต่างจากพื้นมากสุด
          var best = -1, bestD = -1;
          for (var dy = -2; dy <= 2; dy++) {
            var yy = y + dy;
            if (yy < 0 || yy >= h) continue;
            for (var dx = -2; dx <= 2; dx++) {
              var xx = x + dx;
              if (xx < 0 || xx >= w) continue;
              var qi = yy * w + xx;
              if (region[qi] !== -1) continue;
              var dd = diff(src, qi * 4, bg);
              if (dd > bestD) { bestD = dd; best = qi; }
            }
          }
          if (best < 0 || best === pi) continue;
          var f4 = best * 4;
          var vr = src[f4] - bg[0], vg = src[f4 + 1] - bg[1], vb = src[f4 + 2] - bg[2];
          var len2 = vr * vr + vg * vg + vb * vb;
          if (len2 < 1) continue;
          var pr = src[i4] - bg[0], pg = src[i4 + 1] - bg[1], pb = src[i4 + 2] - bg[2];
          var a = (pr * vr + pg * vg + pb * vb) / len2;
          if (a >= 0.98) continue;
          if (a < 0.02) a = 0;
          var alpha = Math.round(a * (src[i4 + 3] / 255) * 255);
          if (alpha <= 0) { out[i4 + 3] = 0; region[pi] = bgk; removed++; continue; }
          out[i4] = bg[0] + pr / a; out[i4 + 1] = bg[1] + pg / a; out[i4 + 2] = bg[2] + pb / a; // Uint8ClampedArray บีบ 0–255 เอง
          out[i4 + 3] = alpha;
          partial++;
        }
      }
    }
    return { data: out, removed: removed, kept: n - removed, partial: partial, seeds: seeds.idx.slice() };
  }

  return { DEFAULT_TOLERANCE: DEFAULT_TOLERANCE, BG_MODEL: BG_MODEL, bgDtype: bgDtype, floodTransparent: floodTransparent, diff: diff };
});
