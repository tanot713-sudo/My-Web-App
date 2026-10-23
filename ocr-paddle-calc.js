/* ══════════════════════════════════════════════════════════════════
   ocr-paddle-calc.js — ตรรกะล้วนของ "อ่านแบบใหม่ (ทดลอง)" = PaddleOCR PP-OCRv5 ภาษาไทยในเบราว์เซอร์
   (UMD, window/self.TanotPaddleCalc, ไม่มี DOM/storage/เครือข่าย; require() ได้ใน test)
   ใช้โดย ocr-paddle-worker.js (ตัวรันโมเดล) และ file-reader.js (ตัดสินใจคลี่หน้า / แถบดาวน์โหลด)

   ผลวัดที่เป็นเหตุผล (Colab ของเจ้าของ, 20 ภาพจริง, CER — ข้อความเฉลยไม่อยู่ใน repo):
     PP-OCRv5 mobile det + th rec + หมุนหน้า + UVDoc = 20.4% · ไม่คลี่หน้า 42.9% · Tesseract.js ในเว็บ 45.5%
   ค่าที่ต้องตรงกับ Colab: ภาพย่อด้านยาว ≤ 2000px (MAX_SIDE) · ตัวอ่าน th_PP-OCRv5_mobile_rec ระบุชื่อเอง (ไม่ใช่ lang)
   · det ตามค่าทางการของไปป์ไลน์ OCR (limit_side_len 64 / min, max 4000, thresh 0.3, box_thresh 0.6, unclip 1.5, rec score 0)
   · เรียงบรรทัด: จุดกึ่งกลางแนวตั้งห่างกัน ≤ 0.5 × ความสูงกล่อง = บรรทัดเดียว แล้วเรียงซ้าย→ขวา (orderLines)

   1) MODELS / modelUrl — ไฟล์โมเดล ONNX ทางการของ PaddlePaddle บน Hugging Face (repo `<ชื่อโมเดล>_onnx` ตาม
      paddlex/inference/utils/official_models.py ONNX_SUPPORTED_MODELS) ล็อก revision = commit ที่ตรวจแล้ว
      (เปลี่ยนเลข = ทุกเครื่องโหลดรุ่นใหม่ เพราะ URL เป็นคีย์ของแคช) — ตรวจ/ล็อกด้วย `node tools/media-eval/check-models.mjs --paddle [--pin]`
   2) unwarpPlan / shouldUnwarp — คลี่หน้ากระดาษ (หมุนหน้า + UVDoc) เฉพาะภาพถ่าย
   3) readExifCamera — มี EXIF ของกล้อง (Make/Model) ไหม (JPEG/HEIC)
   4) rotateRgb — หมุนภาพตามผลของตัวจำแนกทิศหน้า (องศาทวนเข็มแบบ OpenCV ของ PaddleX rotate_image)
   5) parseCharDict — รายการตัวอักษรจาก inference.yml ของตัวอ่าน (PostProcess.character_dict)
   6) orderLines / linesText — จัดกล่องเป็นบรรทัด */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TanotPaddleCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_SIDE = 2000;          // ย่อภาพด้านยาวไม่เกินนี้ก่อนอ่าน (เท่ากับ Colab) — ภาพเล็กกว่าไม่ขยาย
  var UNEVEN_SPREAD = 28;       // เกณฑ์ "แสงไม่เท่ากัน" เดียวกับ ocr-prep.js (UNEVEN_SPREAD) — เกิน = น่าจะเป็นภาพถ่าย
  var LINE_RATIO = 0.5;         // จุดกึ่งกลางแนวตั้งห่างกัน ≤ 0.5 × ความสูงกล่อง = บรรทัดเดียว
  var HF = 'https://huggingface.co/';
  /* revision: commit 40 hex ของแต่ละ repo — 'main' = ยังไม่ได้ล็อก (sandbox ที่เขียนโค้ดเข้า Hugging Face ไม่ได้)
     ต้องรัน `node tools/media-eval/check-models.mjs --paddle --pin` บนเครื่องที่เข้า huggingface.co ได้ก่อนเปิดใช้จริง */
  var MODELS = {
    det:   { id: 'PP-OCRv5_mobile_det', repo: 'PaddlePaddle/PP-OCRv5_mobile_det_onnx', file: 'inference.onnx', revision: 'main', bytes: 4826518 },
    rec:   { id: 'th_PP-OCRv5_mobile_rec', repo: 'PaddlePaddle/th_PP-OCRv5_mobile_rec_onnx', file: 'inference.onnx', revision: 'main', bytes: 7918606 },
    dict:  { id: 'th_PP-OCRv5_mobile_rec', repo: 'PaddlePaddle/th_PP-OCRv5_mobile_rec_onnx', file: 'inference.yml', revision: 'main', bytes: 12000 },
    ori:   { id: 'PP-LCNet_x1_0_doc_ori', repo: 'PaddlePaddle/PP-LCNet_x1_0_doc_ori_onnx', file: 'inference.onnx', revision: 'main', bytes: 6787248 },
    uvdoc: { id: 'UVDoc', repo: 'PaddlePaddle/UVDoc_onnx', file: 'inference.onnx', revision: 'main', bytes: 31684150 }
  };
  var BASE_SET = ['det', 'rec', 'dict'], UNWARP_SET = ['ori', 'uvdoc'];
  /* ค่าของตัวหากล่องข้อความ (det) ตามไปป์ไลน์ OCR ทางการ (PaddleX OCR.yaml / ค่าเริ่มต้นของ PaddleOCR.js ทางการ) */
  var DET_OPTIONS = { maxSideLength: 64, limitType: 'min', maxSideLimit: 4000, textPixelThreshold: 0.3, boxScoreThreshold: 0.6, unclipRatio: 1.5 };
  var REC_SCORE_MIN = 0;

  function isSha(rev) { return /^[0-9a-f]{40}$/.test(String(rev || '')); }
  function modelUrl(m) { return HF + m.repo + '/resolve/' + (m.revision || 'main') + '/' + m.file; }
  function modelSet(unwarp) { return unwarp ? BASE_SET.concat(UNWARP_SET) : BASE_SET.slice(); }
  /* ขนาดดาวน์โหลดโดยประมาณ (ไบต์) ของชุดโมเดล — ใช้ก่อนเริ่มโหลดเท่านั้น ระหว่างโหลดใช้ Content-Length จริง */
  function setBytes(keys) { return keys.reduce(function (s, k) { return s + (MODELS[k] ? MODELS[k].bytes : 0); }, 0); }
  function mb(bytes) { return Math.round((bytes || 0) / 1048576 * 10) / 10; }

  /* ขนาดหลังย่อ (ไม่ขยาย) */
  function fitSize(w, h, max) {
    max = max || MAX_SIDE;
    var long = Math.max(w, h);
    if (!(long > max)) return { w: w, h: h, scale: 1 };
    var s = max / long;
    return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)), scale: s };
  }

  /* ── คลี่หน้ากระดาษไหม ──
     info: { source:'photo'|'pdf', mime, name, exifCamera }
     → 'no'      PDF ที่เรนเดอร์ / PNG (ภาพหน้าจอ) / GIF / SVG
       'yes'     JPEG หรือ HEIC/HEIF ที่มี EXIF กล้อง (Make/Model)
       'measure' อื่นๆ (JPEG ไม่มี EXIF กล้อง, WebP, BMP) → ตัดสินด้วย unevenness ของภาพ (shouldUnwarp) */
  function kindOf(info) {
    var mime = String(info.mime || '').toLowerCase(), name = String(info.name || '').toLowerCase();
    if (/png/.test(mime) || /\.png$/.test(name)) return 'png';
    if (/jpe?g/.test(mime) || /\.jpe?g$/.test(name)) return 'jpeg';
    if (/hei[cf]/.test(mime) || /\.hei[cf]$/.test(name)) return 'heic';
    if (/gif|svg/.test(mime) || /\.(gif|svg)$/.test(name)) return 'graphic';
    return 'other';
  }
  function unwarpPlan(info) {
    info = info || {};
    if (info.source === 'pdf') return 'no';
    var k = kindOf(info);
    if (k === 'png' || k === 'graphic') return 'no';
    if ((k === 'jpeg' || k === 'heic') && info.exifCamera) return 'yes';
    return 'measure';
  }
  function shouldUnwarp(plan, unevenness) {
    if (plan === 'yes') return true;
    if (plan === 'measure') return unevenness > UNEVEN_SPREAD;
    return false;
  }

  /* ── EXIF ของกล้อง ── bytes = Uint8Array ต้นไฟล์ (≥ 128 KB พอสำหรับ JPEG/HEIC จากมือถือ)
     หา "Exif\0\0" + หัว TIFF (II/MM) แล้วดู IFD0 ว่ามีแท็ก Make (0x010F) หรือ Model (0x0110) ที่ไม่ว่าง
     (JPEG: APP1 · HEIC: ไอเท็ม Exif ใน meta — ทั้งคู่มีลายเซ็นเดียวกัน) */
  function readExifCamera(bytes) {
    if (!bytes || !bytes.length) return false;
    var n = bytes.length;
    for (var i = 0; i + 14 < n; i++) {
      if (bytes[i] !== 0x45 || bytes[i + 1] !== 0x78 || bytes[i + 2] !== 0x69 || bytes[i + 3] !== 0x66 || bytes[i + 4] !== 0 || bytes[i + 5] !== 0) continue;
      var t = i + 6, le;
      if (bytes[t] === 0x49 && bytes[t + 1] === 0x49) le = true;
      else if (bytes[t] === 0x4D && bytes[t + 1] === 0x4D) le = false;
      else continue;
      var u16 = function (p) { return le ? bytes[p] | (bytes[p + 1] << 8) : (bytes[p] << 8) | bytes[p + 1]; };
      var u32 = function (p) { return le ? (bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16)) + bytes[p + 3] * 16777216 : bytes[p] * 16777216 + ((bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]); };
      if (u16(t + 2) !== 42) continue;
      var ifd = t + u32(t + 4);
      if (ifd + 2 > n) return false;
      var cnt = u16(ifd);
      for (var e = 0; e < cnt; e++) {
        var p = ifd + 2 + e * 12;
        if (p + 12 > n) break;
        var tag = u16(p), type = u16(p + 2), count = u32(p + 4);
        if ((tag === 0x010F || tag === 0x0110) && type === 2 && count > 1) {
          var off = count <= 4 ? p + 8 : t + u32(p + 8), any = false;
          for (var c = 0; c < count - 1 && off + c < n; c++) if (bytes[off + c] > 0x20) { any = true; break; }
          if (any) return true;
        }
      }
      return false;
    }
    return false;
  }

  /* ── หมุนภาพ RGB(A) ── angle = 0|90|180|270 องศา "ทวนเข็ม" (cv2.getRotationMatrix2D มุมบวก = ทวนเข็ม — PaddleX
     doc_preprocessor หมุนภาพด้วยป้ายของตัวจำแนก (label_names[0]) ตรงๆ) → { width, height, data } ช่องสีเท่าเดิม */
  function rotateRgb(img, angle) {
    var a = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
    var w = img.width, h = img.height, src = img.data, ch = Math.round(src.length / (w * h));
    if (!a) return img;
    var nw = a === 180 ? w : h, nh = a === 180 ? h : w;
    var out = new (src.constructor)(src.length);
    for (var y = 0; y < nh; y++) for (var x = 0; x < nw; x++) {
      var sx, sy;
      if (a === 90) { sx = w - 1 - y; sy = x; }            // ทวนเข็ม 90: มุมขวาบน → ซ้ายบน
      else if (a === 180) { sx = w - 1 - x; sy = h - 1 - y; }
      else { sx = y; sy = h - 1 - x; }                      // 270 ทวนเข็ม = 90 ตามเข็ม
      var si = (sy * w + sx) * ch, di = (y * nw + x) * ch;
      for (var c = 0; c < ch; c++) out[di + c] = src[si + c];
    }
    return { width: nw, height: nh, data: out };
  }

  /* ── รายการตัวอักษรจาก inference.yml ── อ่านเฉพาะลิสต์ใต้ `character_dict:` (YAML บล็อก "- ค่า")
     รองรับ 'single' ('' = ' ตัวเดียว), "double" (\\ \" \n \t \uXXXX), และค่าธรรมดา · ไม่รวม blank/ช่องว่าง (ผู้เรียกต่อท้าย ' ' เอง ตาม PaddleX use_space_char) */
  function parseScalar(s) {
    s = s.replace(/\s+$/, '');
    if (s.charAt(0) === "'" && s.length >= 2 && s.charAt(s.length - 1) === "'") return s.slice(1, -1).replace(/''/g, "'");
    if (s.charAt(0) === '"' && s.length >= 2 && s.charAt(s.length - 1) === '"') {
      return s.slice(1, -1).replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|x[0-9a-fA-F]{2}|.)/g, function (m, e) {
        var c = e.charAt(0);
        if (c === 'u' || c === 'U' || c === 'x') return String.fromCodePoint(parseInt(e.slice(1), 16));
        return { n: '\n', t: '\t', r: '\r', '0': '\0', '"': '"', '\\': '\\', '/': '/', ' ': ' ' }[c] || e;
      });
    }
    return s;
  }
  function parseCharDict(yml) {
    var lines = String(yml || '').split(/\r?\n/), out = [], inList = false, baseIndent = -1;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!inList) {
        var m = /^(\s*)character_dict:\s*(\[.*\])?\s*$/.exec(line);
        if (!m) continue;
        if (m[2]) { try { return JSON.parse(m[2]); } catch (e) { return []; } }
        inList = true; baseIndent = m[1].length; continue;
      }
      if (!line.trim()) continue;
      var item = /^(\s*)-(?: (.*))?$/.exec(line);
      if (!item || item[1].length < baseIndent) break;
      out.push(item[2] == null ? '' : parseScalar(item[2]));
    }
    return out;
  }

  /* ── เรียงบรรทัด ──
     items: [{ text, score, poly:[[x,y]×4] หรือ box:{x,y,width,height} }]
     → [[item…]…] บรรทัดบน→ล่าง ในบรรทัดซ้าย→ขวา
     วิธี: เรียงกล่องตามจุดกึ่งกลางแนวตั้ง แล้วไล่ทีละกล่อง — ถ้า |cy − cy เฉลี่ยของบรรทัดล่าสุด| ≤ 0.5 × ความสูงกล่อง
     (ใช้กล่องที่สูงกว่าระหว่างกล่องนี้กับความสูงเฉลี่ยของบรรทัด กันกล่องเล็ก เช่น จุด/ขีด หลุดเป็นบรรทัดของตัวเอง) = บรรทัดเดียวกัน */
  function geom(it) {
    var x0, x1, y0, y1;
    if (it.poly && it.poly.length) {
      x0 = y0 = Infinity; x1 = y1 = -Infinity;
      it.poly.forEach(function (p) { var x = p[0] != null ? p[0] : p.x, y = p[1] != null ? p[1] : p.y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
    } else {
      var b = it.box || {};
      x0 = b.x || 0; y0 = b.y || 0; x1 = x0 + (b.width || 0); y1 = y0 + (b.height || 0);
    }
    return { x: x0, cy: (y0 + y1) / 2, h: Math.max(1, y1 - y0) };
  }
  function orderLines(items, ratio) {
    ratio = ratio == null ? LINE_RATIO : ratio;
    var g = (items || []).filter(function (it) { return it && String(it.text || '').trim(); }).map(function (it, i) { var q = geom(it); q.it = it; q.i = i; return q; });
    g.sort(function (a, b) { return a.cy - b.cy || a.x - b.x || a.i - b.i; });
    var lines = [];
    g.forEach(function (q) {
      var L = lines[lines.length - 1];
      if (L && Math.abs(q.cy - L.cy) <= ratio * Math.max(q.h, L.h)) {
        L.q.push(q);
        L.cy = L.q.reduce(function (s, z) { return s + z.cy; }, 0) / L.q.length;
        L.h = L.q.reduce(function (s, z) { return s + z.h; }, 0) / L.q.length;
      } else lines.push({ q: [q], cy: q.cy, h: q.h });
    });
    return lines.map(function (L) { return L.q.sort(function (a, b) { return a.x - b.x || a.i - b.i; }).map(function (z) { return z.it; }); });
  }
  function linesText(lines) {
    return (lines || []).map(function (L) { return L.map(function (it) { return String(it.text).trim(); }).join(' '); }).join('\n');
  }

  return {
    MAX_SIDE: MAX_SIDE, UNEVEN_SPREAD: UNEVEN_SPREAD, LINE_RATIO: LINE_RATIO, MODELS: MODELS, BASE_SET: BASE_SET, UNWARP_SET: UNWARP_SET,
    DET_OPTIONS: DET_OPTIONS, REC_SCORE_MIN: REC_SCORE_MIN,
    isSha: isSha, modelUrl: modelUrl, modelSet: modelSet, setBytes: setBytes, mb: mb, fitSize: fitSize,
    kindOf: kindOf, unwarpPlan: unwarpPlan, shouldUnwarp: shouldUnwarp, readExifCamera: readExifCamera, rotateRgb: rotateRgb,
    parseCharDict: parseCharDict, orderLines: orderLines, linesText: linesText
  };
});
