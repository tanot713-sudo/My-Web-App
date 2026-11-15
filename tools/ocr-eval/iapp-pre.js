// iapp-pre.js — preprocessing ของ iapp/OpenThai2.0-OCR-Markdown ใน JS (UMD ไม่มี DOM) · ตรวจกับ PIL/torch ตัวจริงใน iapp-pre.test.mjs (+ make_iapp_pre_fixtures.py)
// ตามโค้ดของ repo โมเดลที่ commit 7a15371: hf_nemotron_parse_processor.py (เส้นทาง content_hw = canvas ที่จัดแนวกริดแล้ว) + hf_prefix_geometry.py (_normalized_2d_position_pages)
//
// สัญญา (canvas คงที่ — ทางที่เลือกเพื่อให้ N คงที่ = 2464 ตามไฟล์ ONNX ของ ViT):
//   ภาพแนวตั้ง/จัตุรัส → canvas สูง 896 × กว้าง 704 · ภาพแนวนอน → สูง 704 × กว้าง 896 (สูงหาร 16 ลงตัว กว้างหาร 64 ลงตัว ทั้งสองแบบ → N = 2464)
//   ย่อภาพให้พอดี canvas (ย่ออย่างเดียว ไม่ขยาย; กฎขนาดแบบ LongestMaxSizeHW: int() ตัดเศษ) วางมุมซ้ายบน พื้นขาว 255 · content = (สูง, กว้าง) ของภาพที่ย่อแล้ว
//   patch = 16×16 เรียงแถวต่อแถว เวกเตอร์ละ 768 ค่า ลำดับ (ช่องสี, y, x) หลัง /255 แล้ว (x-mean)/std ของ CLIP
//   pos = ตารางตำแหน่ง 128×128×C สอดแทรกแบบ bilinear antialias ลงขนาด content ในหน่วย patch แล้ว grid_sample (bilinear, border, align_corners=false) ที่ตำแหน่งกึ่งกลางของแต่ละ patch
// ยังไม่ได้วัด CER ของ canvas คงที่ (ด่าน 0f ใน ROADMAP 3d) — ภาพกว้างอย่างใบเสร็จถูกย่อมากกว่าตอนวัดด้วยภาพขนาดธรรมชาติ
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.IappPre = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  var MEAN = [0.48145466, 0.4578275, 0.40821073], STD = [0.26862954, 0.26130258, 0.27577711];
  var PATCH = 16, CANVAS_LONG = 896, CANVAS_SHORT = 704;

  // ── ย่อภาพแบบ PIL (Image.resize) — เหมือนทุกบิตสำหรับ 8 บิต RGB ──
  var FILTERS = {
    bilinear: { support: 1.0, f: function (x) { x = Math.abs(x); return x < 1 ? 1 - x : 0; } },
    bicubic: { support: 2.0, f: function (x) { x = Math.abs(x); var a = -0.5; if (x < 1) return ((a + 2) * x - (a + 3)) * x * x + 1; if (x < 2) return (((x - 5) * x + 8) * x - 4) * a; return 0; } }
  };
  var PREC = 22;
  function coeffs(inSize, outSize, flt) {
    var scale = inSize / outSize, fs = Math.max(scale, 1), support = flt.support * fs, ksize = Math.ceil(support) * 2 + 1, ss = 1 / fs;
    var bounds = new Int32Array(outSize * 2), k = new Int32Array(outSize * ksize), tmp = new Float64Array(ksize);
    for (var xx = 0; xx < outSize; xx++) {
      var center = (xx + 0.5) * scale, ww = 0, xmin = Math.trunc(center - support + 0.5), xmax = Math.trunc(center + support + 0.5);
      if (xmin < 0) xmin = 0; if (xmax > inSize) xmax = inSize; xmax -= xmin;
      for (var x = 0; x < xmax; x++) { var w = flt.f((x + xmin - center + 0.5) * ss); tmp[x] = w; ww += w; }
      for (x = 0; x < xmax; x++) { if (ww !== 0) tmp[x] /= ww; k[xx * ksize + x] = Math.trunc(tmp[x] * (1 << PREC) + (tmp[x] < 0 ? -0.5 : 0.5)); }
      bounds[xx * 2] = xmin; bounds[xx * 2 + 1] = xmax;
    }
    return { bounds: bounds, k: k, ksize: ksize };
  }
  function clip8(v) { v >>= PREC; return v < 0 ? 0 : v > 255 ? 255 : v; }
  function resize(rgb, w, h, ow, oh, filter) {
    var flt = FILTERS[filter || 'bilinear'], cur = rgb, cw = w, ch = h, ssum = 1 << (PREC - 1);
    if (ow !== w) {   // ผ่านแนวนอนก่อน
      var c = coeffs(w, ow, flt), o = new Uint8Array(ow * h * 3);
      for (var y = 0; y < h; y++) for (var x = 0; x < ow; x++) {
        var xmin = c.bounds[x * 2], n = c.bounds[x * 2 + 1], s0 = ssum, s1 = ssum, s2 = ssum;
        for (var j = 0; j < n; j++) { var kk = c.k[x * c.ksize + j], p = (y * w + xmin + j) * 3; s0 += cur[p] * kk; s1 += cur[p + 1] * kk; s2 += cur[p + 2] * kk; }
        var q = (y * ow + x) * 3; o[q] = clip8(s0); o[q + 1] = clip8(s1); o[q + 2] = clip8(s2);
      }
      cur = o; cw = ow;
    }
    if (oh !== h) {   // แล้วแนวตั้ง
      var cv = coeffs(h, oh, flt), o2 = new Uint8Array(cw * oh * 3);
      for (var y2 = 0; y2 < oh; y2++) {
        var ymin = cv.bounds[y2 * 2], m = cv.bounds[y2 * 2 + 1];
        for (var x2 = 0; x2 < cw; x2++) {
          var a0 = ssum, a1 = ssum, a2 = ssum;
          for (var j2 = 0; j2 < m; j2++) { var k2 = cv.k[y2 * cv.ksize + j2], p2 = ((ymin + j2) * cw + x2) * 3; a0 += cur[p2] * k2; a1 += cur[p2 + 1] * k2; a2 += cur[p2 + 2] * k2; }
          var q2 = (y2 * cw + x2) * 3; o2[q2] = clip8(a0); o2[q2 + 1] = clip8(a1); o2[q2 + 2] = clip8(a2);
        }
      }
      cur = o2;
    }
    return cur;
  }

  // ── จัดภาพลง canvas คงที่ ──
  function toCanvas(rgb, w, h, opts) {
    opts = opts || {};
    var ch = w > h ? CANVAS_SHORT : CANVAS_LONG, cw = w > h ? CANVAS_LONG : CANVAS_SHORT;
    var aspect = w / h, nh = h, nw = w;
    if (nh > ch) { nh = ch; nw = Math.trunc(nh * aspect); }
    if (nw > cw) { nw = cw; nh = Math.trunc(nw / aspect); }
    var img = (nh === h && nw === w) ? rgb : resize(rgb, w, h, nw, nh, opts.filter || 'bilinear');
    var canvas = new Uint8Array(ch * cw * 3).fill(255);
    for (var y = 0; y < nh; y++) canvas.set(img.subarray(y * nw * 3, (y + 1) * nw * 3), y * cw * 3);
    return { canvas: canvas, canvasH: ch, canvasW: cw, contentH: nh, contentW: nw };
  }

  // ── patch: [rows*cols, 768] ลำดับ (c, y, x) ──
  function patchify(canvas, H, W) {
    var rows = H / PATCH, cols = W / PATCH, out = new Float32Array(rows * cols * 768), inv = [], i;
    for (i = 0; i < 3; i++) inv.push(1 / STD[i]);
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var base = (r * cols + c) * 768;
      for (var ch = 0; ch < 3; ch++) for (var y = 0; y < PATCH; y++) for (var x = 0; x < PATCH; x++) {
        var px = canvas[((r * PATCH + y) * W + c * PATCH + x) * 3 + ch] / 255;   // float64 → float32 ตอนเก็บ (torch ทำใน float32: ต่างได้ระดับ 1e-7)
        out[base + ch * 256 + y * PATCH + x] = (px - MEAN[ch]) * inv[ch];
      }
    }
    return out;
  }

  // ── pos: bilinear antialias ตาม ATen (_upsample_bilinear2d_aa) แล้ว grid_sample ──
  function aaWeights(inSize, outSize) {   // เหมือน _compute_indices_weights_aa (align_corners=false, bilinear)
    var scale = inSize / outSize, support = scale >= 1 ? scale : 1, inv = scale >= 1 ? 1 / scale : 1, res = [];
    for (var i = 0; i < outSize; i++) {
      var center = scale * (i + 0.5), xmin = Math.max(Math.trunc(center - support + 0.5), 0), xmax = Math.min(Math.trunc(center + support + 0.5), inSize) - xmin, ws = new Float64Array(xmax), tot = 0;
      for (var j = 0; j < xmax; j++) { var x = Math.abs((j + xmin - center + 0.5) * inv); var w = x < 1 ? 1 - x : 0; ws[j] = w; tot += w; }
      if (tot !== 0) for (j = 0; j < xmax; j++) ws[j] /= tot;
      res.push({ min: xmin, w: ws });
    }
    return res;
  }
  function interpolateAA(tbl, Hs, Ws, C, oh, ow) {   // tbl = [Hs][Ws][C] → [oh][ow][C]
    var wx = aaWeights(Ws, ow), wy = aaWeights(Hs, oh), tmp = new Float32Array(Hs * ow * C), i, j, c, t;
    for (var y = 0; y < Hs; y++) for (j = 0; j < ow; j++) {
      var b = wx[j], o = (y * ow + j) * C;
      for (t = 0; t < b.w.length; t++) { var wv = b.w[t], s = (y * Ws + b.min + t) * C; for (c = 0; c < C; c++) tmp[o + c] += wv * tbl[s + c]; }
    }
    var out = new Float32Array(oh * ow * C);
    for (i = 0; i < oh; i++) { var by = wy[i]; for (j = 0; j < ow; j++) { var o2 = (i * ow + j) * C; for (t = 0; t < by.w.length; t++) { var w2 = by.w[t], s2 = ((by.min + t) * ow + j) * C; for (c = 0; c < C; c++) out[o2 + c] += w2 * tmp[s2 + c]; } } }
    return out;
  }
  function avgPool(tbl, Hs, Ws, C, oh, ow) {   // adaptive_avg_pool2d (ใช้เมื่อ content แคบเหลือ 1 patch ในแกนใดแกนหนึ่ง)
    var out = new Float32Array(oh * ow * C);
    for (var i = 0; i < oh; i++) { var y0 = Math.floor(i * Hs / oh), y1 = Math.ceil((i + 1) * Hs / oh);
      for (var j = 0; j < ow; j++) { var x0 = Math.floor(j * Ws / ow), x1 = Math.ceil((j + 1) * Ws / ow), n = (y1 - y0) * (x1 - x0);
        for (var c = 0; c < C; c++) { var s = 0; for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) s += tbl[(y * Ws + x) * C + c]; out[(i * ow + j) * C + c] = s / n; } } }
    return out;
  }
  function posEmbed(tbl, Hs, Ws, C, H, W, contentH, contentW) {
    var rows = H / PATCH, cols = W / PATCH, cr = Math.ceil(contentH / PATCH), cc = Math.ceil(contentW / PATCH);
    var g = Math.min(cr, cc) === 1 ? avgPool(tbl, Hs, Ws, C, cr, cc) : interpolateAA(tbl, Hs, Ws, C, cr, cc);
    var out = new Float32Array(rows * cols * C);
    var fy = new Float64Array(rows), fx = new Float64Array(cols);
    for (var r = 0; r < rows; r++) { var rs = r * PATCH, re = Math.min(Math.max(contentH - rs, 0), PATCH); fy[r] = Math.min(rs + 0.5 * re, contentH) / contentH; }
    for (var c2 = 0; c2 < cols; c2++) { var cs = c2 * PATCH, ce = Math.min(Math.max(contentW - cs, 0), PATCH); fx[c2] = Math.min(cs + 0.5 * ce, contentW) / contentW; }
    function clamp(v, hi) { return v < 0 ? 0 : v > hi ? hi : v; }
    for (r = 0; r < rows; r++) {
      var py = clamp(((2 * fy[r] - 1 + 1) * cr - 1) / 2, cr - 1), y0 = Math.floor(py), y1 = Math.min(y0 + 1, cr - 1), wy = py - y0;   // unnormalize (align_corners=false) + border
      for (c2 = 0; c2 < cols; c2++) {
        var px = clamp(((2 * fx[c2] - 1 + 1) * cc - 1) / 2, cc - 1), x0 = Math.floor(px), x1 = Math.min(x0 + 1, cc - 1), wx = px - x0, o = (r * cols + c2) * C;
        var a = (y0 * cc + x0) * C, b = (y0 * cc + x1) * C, d = (y1 * cc + x0) * C, e = (y1 * cc + x1) * C;
        for (var k = 0; k < C; k++) out[o + k] = (1 - wy) * ((1 - wx) * g[a + k] + wx * g[b + k]) + wy * ((1 - wx) * g[d + k] + wx * g[e + k]);
      }
    }
    return out;
  }

  // ภาพ RGBA (จาก canvas.getImageData) → RGB
  function rgbaToRgb(rgba, w, h, bg) {   // โปร่งใสถูกวางบนพื้นขาว
    var o = new Uint8Array(w * h * 3);
    for (var i = 0, j = 0; i < w * h * 4; i += 4, j += 3) { var a = rgba[i + 3] / 255; o[j] = Math.round(rgba[i] * a + 255 * (1 - a)); o[j + 1] = Math.round(rgba[i + 1] * a + 255 * (1 - a)); o[j + 2] = Math.round(rgba[i + 2] * a + 255 * (1 - a)); }
    return o;
  }
  // ภาพ RGB → {patches [N*768], pos [N*C], canvasH, canvasW, contentH, contentW, N}
  function prepare(rgb, w, h, posTable, Hs, Ws, C, opts) {
    var t = toCanvas(rgb, w, h, opts), patches = patchify(t.canvas, t.canvasH, t.canvasW);
    return { patches: patches, pos: posEmbed(posTable, Hs, Ws, C, t.canvasH, t.canvasW, t.contentH, t.contentW), canvasH: t.canvasH, canvasW: t.canvasW, contentH: t.contentH, contentW: t.contentW, N: patches.length / 768 };
  }
  return { resize: resize, toCanvas: toCanvas, patchify: patchify, posEmbed: posEmbed, interpolateAA: interpolateAA, rgbaToRgb: rgbaToRgb, prepare: prepare, MEAN: MEAN, STD: STD };
});
