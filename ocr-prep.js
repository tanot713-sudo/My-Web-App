/* ══════════════════════════════════════════════════════════════════
   ocr-prep.js — เตรียมภาพก่อนส่ง Tesseract (โหมดฟรี) · UMD: window.TanotOcrPrep / self.TanotOcrPrep (Worker) / require() (เทสต์ Node)
   ฟังก์ชันพิกเซลล้วน (ไม่แตะ DOM) + prepare() ที่รับ "ตัวสร้างแคนวาส" จากผู้เรียก จึงรันได้ทั้ง <canvas> บนเธรดหลัก
   และ OffscreenCanvas ใน ocr-prep-worker.js (รูปใหญ่ไม่ทำให้หน้าค้าง)

   ขั้นตอนของ prepare():
     1) ปรับขนาด: ด้านยาวเล็กกว่า MIN_DIM ขยายขึ้น · ใหญ่กว่า MAX_DIM ย่อลง (จำกัดหน่วยความจำของมือถือ)
     2) แก้ภาพเอียงอัตโนมัติ ±15° ด้วย projection profile (หามุมที่แถวของตัวอักษรคมที่สุด) — เอียงน้อยกว่า 0.3° หรือไม่ชัด = ไม่หมุน
     3) ขาวดำ: ภาพ "สม่ำเสมอ" (PDF ที่เรนเดอร์ / สแกนแสงเรียบ) ใช้ Otsu ทั้งภาพ · รูปถ่ายที่แสงไม่เท่ากัน (เงา/ไล่เฉด) ใช้เกณฑ์รายพื้นที่แบบ Sauvola
        — Otsu ทั้งภาพกับภาพที่ครึ่งหนึ่งอยู่ในเงา จะทำให้ครึ่งนั้นดำสนิทหรือขาวสนิท ตัวอักษรหาย */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TanotOcrPrep = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_DIM = 1800, MAX_DIM = 2600;
  var SKEW_MAX = 15, SKEW_APPLY_MIN = 0.3, SKEW_GAIN_MIN = 1.03;
  var UNEVEN_SPREAD = 28;      // ผลต่างความสว่างพื้นหลังระหว่างบริเวณสว่าง/มืดของภาพ (0–255) ที่เกินนี้ = แสงไม่เท่ากัน
  var SAUVOLA_K = 0.25, SAUVOLA_R = 128;

  /* RGBA → ระดับเทา (Rec.601) */
  function toGray(rgba, n) {
    var g = new Uint8ClampedArray(n);
    for (var i = 0, p = 0; p < n; i += 4, p++) g[p] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    return g;
  }

  /* ยืดคอนทราสต์ให้เต็ม 0–255 (min-max) แก้ในที่ */
  function stretch(gray) {
    var n = gray.length, min = 255, max = 0, p;
    for (p = 0; p < n; p++) { var v = gray[p]; if (v < min) min = v; if (v > max) max = v; }
    var range = (max - min) || 1;
    for (p = 0; p < n; p++) gray[p] = Math.round((gray[p] - min) * 255 / range);
    return gray;
  }

  function histogram(gray) {
    var h = new Array(256).fill(0);
    for (var p = 0; p < gray.length; p++) h[gray[p]]++;
    return h;
  }

  /* Otsu — threshold ที่ทำให้ variance ระหว่างสองกลุ่ม (มืด/สว่าง) มากที่สุด */
  function otsuThreshold(gray) {
    var hist = histogram(gray), n = gray.length, sum = 0, t;
    for (t = 0; t < 256; t++) sum += t * hist[t];
    var sumB = 0, wB = 0, wF, varMax = 0, threshold = 127;
    for (t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      wF = n - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      var mB = sumB / wB, mF = (sum - sumB) / wF;
      var v = wB * wF * (mB - mF) * (mB - mF);
      if (v > varMax) { varMax = v; threshold = t; }
    }
    return threshold;
  }

  function binarizeGlobal(gray, threshold) {
    var out = new Uint8Array(gray.length);
    for (var p = 0; p < gray.length; p++) out[p] = gray[p] > threshold ? 255 : 0; // threshold = ระดับสุดท้ายของกลุ่มมืด
    return out;
  }

  /* Sauvola: T(x,y) = m·(1 + k·(s/R − 1)) โดย m, s = ค่าเฉลี่ย/ส่วนเบี่ยงเบนมาตรฐานในหน้าต่าง win×win รอบพิกเซล
     คำนวณด้วยผลรวมเลื่อนหน้าต่างทีละแถว (ไม่สร้าง integral image ขนาดภาพ) → หน่วยความจำเพิ่มแค่ O(กว้าง) ต่อภาพ */
  function sauvola(gray, w, h, win, k, R) {
    k = k == null ? SAUVOLA_K : k; R = R || SAUVOLA_R;
    var r = Math.max(1, (win >> 1)), out = new Uint8Array(w * h);
    var colS = new Float64Array(w), colQ = new Float64Array(w);
    var pS = new Float64Array(w + 1), pQ = new Float64Array(w + 1);
    function addRow(y, sign) {
      var o = y * w, x;
      for (x = 0; x < w; x++) { var v = gray[o + x]; pS[x + 1] = pS[x] + v; pQ[x + 1] = pQ[x] + v * v; }
      for (x = 0; x < w; x++) {
        var x0 = x - r < 0 ? 0 : x - r, x1 = x + r >= w ? w - 1 : x + r;
        colS[x] += sign * (pS[x1 + 1] - pS[x0]);
        colQ[x] += sign * (pQ[x1 + 1] - pQ[x0]);
      }
    }
    for (var y0 = 0; y0 < r && y0 < h; y0++) addRow(y0, 1); // เตรียมแถว 0..r-1 (แถว y+r เข้ามาในรอบถัดไป)
    for (var y = 0; y < h; y++) {
      if (y + r < h) addRow(y + r, 1);
      if (y - r - 1 >= 0) addRow(y - r - 1, -1);
      var top = y - r < 0 ? 0 : y - r, bot = y + r >= h ? h - 1 : y + r, rows = bot - top + 1, o = y * w;
      for (var x = 0; x < w; x++) {
        var left = x - r < 0 ? 0 : x - r, right = x + r >= w ? w - 1 : x + r, cnt = rows * (right - left + 1);
        var m = colS[x] / cnt, vr = colQ[x] / cnt - m * m, s = vr > 0 ? Math.sqrt(vr) : 0;
        out[o + x] = gray[o + x] > m * (1 + k * (s / R - 1)) ? 255 : 0;
      }
    }
    return out;
  }

  /* แสงไม่เท่ากันแค่ไหน — แบ่งภาพเป็นตาราง 8×8 หาความสว่างพื้นหลัง (เปอร์เซ็นไทล์ที่ 90) ของแต่ละช่อง
     แล้วคืนผลต่างระหว่างช่องที่พื้นสว่างที่สุดกับมืดที่สุดแบบทนข้อมูลโดด (P90 − P10 ของช่อง) */
  function unevenness(gray, w, h) {
    var G = 8, bgs = [], gx, gy, x, y;
    for (gy = 0; gy < G; gy++) for (gx = 0; gx < G; gx++) {
      var x0 = Math.floor(gx * w / G), x1 = Math.floor((gx + 1) * w / G), y0 = Math.floor(gy * h / G), y1 = Math.floor((gy + 1) * h / G);
      var hist = new Array(256).fill(0), cnt = 0;
      for (y = y0; y < y1; y += 2) for (x = x0; x < x1; x += 2) { hist[gray[y * w + x]]++; cnt++; }
      if (!cnt) continue;
      var target = cnt * 0.9, acc = 0, v = 0;
      for (v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) break; }
      bgs.push(v);
    }
    if (bgs.length < 4) return 0;
    bgs.sort(function (a, b) { return a - b; });
    return bgs[Math.floor(bgs.length * 0.9)] - bgs[Math.floor(bgs.length * 0.1)];
  }

  /* ลดขนาด (เฉลี่ยกล่อง) ให้ด้านยาว ≤ maxDim สำหรับหามุมเอียง */
  function shrinkGray(gray, w, h, maxDim) {
    var f = Math.max(1, Math.ceil(Math.max(w, h) / maxDim));
    if (f === 1) return { g: gray, w: w, h: h };
    var nw = Math.floor(w / f), nh = Math.floor(h / f), out = new Uint8ClampedArray(nw * nh);
    for (var y = 0; y < nh; y++) for (var x = 0; x < nw; x++) {
      var s = 0;
      for (var dy = 0; dy < f; dy++) for (var dx = 0; dx < f; dx++) s += gray[(y * f + dy) * w + x * f + dx];
      out[y * nw + x] = s / (f * f);
    }
    return { g: out, w: nw, h: nh };
  }

  /* หามุมแก้ภาพเอียง (องศา, บวก = หมุนตามเข็มแบบ ctx.rotate) ที่ทำให้แถวของตัวอักษรคมที่สุด
     คืน { angle, gain } — angle = 0 เมื่อไม่ชัด (หมึกน้อย / ไม่ดีขึ้นพอ / เอียงน้อยกว่า SKEW_APPLY_MIN) */
  function detectSkew(gray, w, h) {
    var sm = shrinkGray(gray, w, h, 520), g = sm.g, sw = sm.w, sh = sm.h, n = sw * sh, p;
    var t = otsuThreshold(g), ink = 0;
    for (p = 0; p < n; p++) if (g[p] <= t) ink++;
    var inkDark = ink <= n / 2; // หมึกเป็นกลุ่มส่วนน้อย (ปกติคือสีเข้มบนพื้นสว่าง; ถ้ากลับด้านก็นับกลุ่มสว่าง)
    var xs = [], ys = [], stride = Math.max(1, Math.floor(Math.min(ink, n - ink) / 50000));
    var seen = 0;
    for (var y = 0; y < sh; y++) for (var x = 0; x < sw; x++) {
      var isInk = inkDark ? g[y * sw + x] <= t : g[y * sw + x] > t;
      if (isInk && (seen++ % stride === 0)) { xs.push(x); ys.push(y); }
    }
    if (xs.length < 200) return { angle: 0, gain: 1 };
    var pad = Math.ceil(sw * Math.sin(SKEW_MAX * Math.PI / 180)) + 2, size = sh + 2 * pad + 2;
    function score(deg) {
      var b = deg * Math.PI / 180, sn = Math.sin(b), cs = Math.cos(b), bins = new Float64Array(size), i;
      for (i = 0; i < xs.length; i++) bins[Math.round(xs[i] * sn + ys[i] * cs) + pad]++;
      var s = 0;
      for (i = 0; i < size; i++) s += bins[i] * bins[i];
      return s;
    }
    var base = score(0), best = 0, bestS = base, a;
    for (a = -SKEW_MAX; a <= SKEW_MAX; a++) { var s1 = score(a); if (s1 > bestS) { bestS = s1; best = a; } }
    var center = best;
    for (a = center - 0.75; a <= center + 0.75 + 1e-9; a += 0.25) {
      if (a < -SKEW_MAX || a > SKEW_MAX) continue;
      var s2 = score(a); if (s2 > bestS) { bestS = s2; best = a; }
    }
    var gain = base > 0 ? bestS / base : 1;
    if (Math.abs(best) < SKEW_APPLY_MIN || gain < SKEW_GAIN_MIN) return { angle: 0, gain: gain };
    return { angle: best, gain: gain };
  }

  function medianBorder(gray, w, h) {
    var vals = [], m = Math.max(1, Math.floor(Math.min(w, h) * 0.02)), x, y;
    for (y = 0; y < h; y += 3) for (x = 0; x < w; x += 3) if (x < m || y < m || x >= w - m || y >= h - m) vals.push(gray[y * w + x]);
    vals.sort(function (a, b) { return a - b; });
    return vals.length ? vals[vals.length >> 1] : 255;
  }

  /* prepare(src, sw, sh, opts, makeCanvas) → { canvas, angle, mode, w, h }
     src = ImageBitmap | <canvas> | OffscreenCanvas | <img> · makeCanvas(w, h) คืนแคนวาสที่มี getContext('2d')
     opts: { source:'photo'|'pdf'(ค่าเริ่มต้น photo), deskew:true, mode:'auto'|'otsu'|'sauvola', minDim, maxDim } */
  function prepare(src, sw, sh, opts, makeCanvas) {
    opts = opts || {};
    var minDim = opts.minDim || MIN_DIM, maxDim = opts.maxDim || MAX_DIM;
    var long = Math.max(sw, sh), scale = long < minDim ? minDim / long : (long > maxDim ? maxDim / long : 1);
    var w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
    var cv = makeCanvas(w, h), ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);
    var img = ctx.getImageData(0, 0, w, h), gray = toGray(img.data, w * h), angle = 0;

    if (opts.deskew !== false) {
      var sk = detectSkew(gray, w, h);
      if (sk.angle) {
        angle = sk.angle;
        var b = angle * Math.PI / 180, ca = Math.abs(Math.cos(b)), sa = Math.abs(Math.sin(b));
        var nw = Math.ceil(w * ca + h * sa), nh = Math.ceil(w * sa + h * ca), fill = medianBorder(gray, w, h);
        var rc = makeCanvas(nw, nh), rx = rc.getContext('2d', { willReadFrequently: true });
        rx.imageSmoothingEnabled = true; rx.imageSmoothingQuality = 'high';
        rx.fillStyle = 'rgb(' + fill + ',' + fill + ',' + fill + ')'; rx.fillRect(0, 0, nw, nh);
        rx.translate(nw / 2, nh / 2); rx.rotate(b); rx.drawImage(cv, -w / 2, -h / 2);
        cv = rc; ctx = rx; w = nw; h = nh;
        img = ctx.getImageData(0, 0, w, h); gray = toGray(img.data, w * h);
      }
    }

    var mode = opts.mode || 'auto';
    if (mode === 'auto') mode = (opts.source === 'pdf') ? 'otsu' : (unevenness(gray, w, h) > UNEVEN_SPREAD ? 'sauvola' : 'otsu');
    stretch(gray);
    var bw;
    if (mode === 'sauvola') {
      var win = Math.max(25, Math.round(Math.min(w, h) / 16)) | 1;
      bw = sauvola(gray, w, h, win, SAUVOLA_K, SAUVOLA_R);
    } else {
      bw = binarizeGlobal(gray, otsuThreshold(gray));
    }
    var d = img.data;
    for (var p = 0, i = 0; p < bw.length; p++, i += 4) { d[i] = d[i + 1] = d[i + 2] = bw[p]; d[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return { canvas: cv, angle: angle, mode: mode, w: w, h: h };
  }

  return {
    MIN_DIM: MIN_DIM, MAX_DIM: MAX_DIM, UNEVEN_SPREAD: UNEVEN_SPREAD,
    toGray: toGray, stretch: stretch, otsuThreshold: otsuThreshold, binarizeGlobal: binarizeGlobal,
    sauvola: sauvola, unevenness: unevenness, detectSkew: detectSkew, prepare: prepare
  };
}));
