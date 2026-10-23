// อ่านแบบใหม่ (ทดลอง) — PaddleOCR PP-OCRv5 ไทยในเบราว์เซอร์ (ocr-paddle-calc.js / ocr-paddle-worker.js / file-reader.js engine 'paddle')
//   1) known-answer ของตรรกะล้วน: เรียงบรรทัด · ตัดสินใจคลี่หน้า · EXIF กล้อง · หมุนภาพ · dict จาก inference.yml · ขนาด/URL โมเดล
//   2) หน้าจริง (extract-text / doc-check-file) กับของหลอก: CI โหลดโมเดล/ORT จริงไม่ได้ —
//      vendor/paddleocr/paddleocr.mjs + vendor/transformers/ort.webgpu.bundle.min.mjs ถูก route เป็นโมดูลหลอก (แบบ transformers ตัวหลอกใน media.spec.js)
//      และไฟล์โมเดลบน huggingface.co ถูก route เป็นไบต์สั้นๆ — Worker ตัวจริง/file-reader ตัวจริง/หน้าเว็บตัวจริงทั้งหมด
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const C = require(path.join(__dirname, '..', 'ocr-paddle-calc.js'));

/* ── ตัวช่วย ── */
// ใส่ APP1 Exif (TIFF little/big endian) ที่มีแท็ก Make (และ/หรือ Orientation) หลัง SOI ของ JPEG
function exifSegment({ make = 'TestCam', be = false, onlyOrientation = false } = {}) {
  const str = Buffer.from(make + '\0', 'latin1');
  const entries = onlyOrientation ? [[0x0112, 3, 1, 1]] : [[0x010F, 2, str.length, null]];
  const ifdLen = 2 + entries.length * 12 + 4, tiff = Buffer.alloc(8 + ifdLen + str.length);
  const u16 = (v, o) => (be ? tiff.writeUInt16BE(v, o) : tiff.writeUInt16LE(v, o));
  const u32 = (v, o) => (be ? tiff.writeUInt32BE(v, o) : tiff.writeUInt32LE(v, o));
  tiff.write(be ? 'MM' : 'II', 0, 'latin1'); u16(42, 2); u32(8, 4); u16(entries.length, 8);
  entries.forEach(([tag, type, count, val], i) => {
    const p = 10 + i * 12; u16(tag, p); u16(type, p + 2); u32(count, p + 4);
    if (val != null) u16(val, p + 8);
    else if (str.length <= 4) str.copy(tiff, p + 8); // ค่าสั้น ≤ 4 ไบต์อยู่ในช่องค่าเอง (TIFF)
    else u32(8 + ifdLen, p + 8);
  });
  str.copy(tiff, 8 + ifdLen);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const head = Buffer.alloc(4); head.writeUInt16BE(0xFFE1, 0); head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}
const withExif = (jpeg, opts) => Buffer.concat([jpeg.subarray(0, 2), exifSegment(opts), jpeg.subarray(2)]);
const FAKE_JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xDB, 0x00, 0x04, 0x00, 0x00, 0xFF, 0xD9]);
const it = (text, x, y, w, h) => ({ text, score: 0.9, poly: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] });

test.describe('ocr-paddle-calc — known-answer', () => {
  test('เรียงบรรทัด: กล่องสลับลำดับ → บน→ล่าง ซ้าย→ขวา · กล่องเอียงเล็กน้อย/จุดเล็กอยู่บรรทัดเดียวกัน · เส้นแบ่ง 0.5 × ความสูง', () => {
    const items = [
      it('ค่า', 400, 212, 120, 40),    // บรรทัด 2 ขวา (เยื้องลง 2px)
      it('หัวเรื่อง', 50, 100, 300, 40), // บรรทัด 1 ซ้าย
      it('ราคา', 50, 210, 200, 40),     // บรรทัด 2 ซ้าย
      it('.', 360, 128, 8, 8),          // จุดเล็กท้ายบรรทัด 1 (กลางแนวตั้ง 132 ห่างจาก 120 = 12 ≤ 0.5×40)
      it('ฉบับ', 380, 96, 150, 44),     // บรรทัด 1 ขวา
      it('   ', 600, 100, 50, 40)       // กล่องว่างถูกทิ้ง
    ];
    const lines = C.orderLines(items);
    expect(lines.map((L) => L.map((x) => x.text))).toEqual([['หัวเรื่อง', '.', 'ฉบับ'], ['ราคา', 'ค่า']]);
    expect(C.linesText(lines)).toBe('หัวเรื่อง . ฉบับ\nราคา ค่า');
    // เส้นแบ่ง: กล่องสูง 40 → ห่าง 20 = บรรทัดเดียว · ห่าง 21 = บรรทัดใหม่
    expect(C.orderLines([it('ก', 0, 0, 50, 40), it('ข', 100, 20, 50, 40)]).length).toBe(1);
    expect(C.orderLines([it('ก', 0, 0, 50, 40), it('ข', 100, 21, 50, 40)]).length).toBe(2);
    // ใช้ box {x,y,width,height} ได้ด้วย · ไม่มีกล่อง = ว่าง
    expect(C.linesText(C.orderLines([{ text: 'บน', box: { x: 0, y: 0, width: 10, height: 10 } }, { text: 'ล่าง', box: { x: 0, y: 30, width: 10, height: 10 } }]))).toBe('บน\nล่าง');
    expect(C.linesText(C.orderLines([]))).toBe('');
  });

  test('ตัดสินใจคลี่หน้า: PDF/PNG = ไม่ · JPEG/HEIC ที่มี EXIF กล้อง = คลี่ · อื่นๆ วัด unevenness > 28', () => {
    const P = (o) => C.unwarpPlan(o);
    expect(P({ source: 'pdf', mime: 'application/pdf' })).toBe('no');
    expect(P({ source: 'photo', mime: 'image/png', name: 'shot.png', exifCamera: true })).toBe('no');
    expect(P({ source: 'photo', mime: '', name: 'IMG.PNG' })).toBe('no');
    expect(P({ source: 'photo', mime: 'image/gif' })).toBe('no');
    expect(P({ source: 'photo', mime: 'image/jpeg', exifCamera: true })).toBe('yes');
    expect(P({ source: 'photo', mime: '', name: 'a.heic', exifCamera: true })).toBe('yes');
    expect(P({ source: 'photo', mime: 'image/jpeg', exifCamera: false })).toBe('measure');
    expect(P({ source: 'photo', mime: 'image/webp', exifCamera: true })).toBe('measure');
    expect(P({ source: 'photo', mime: 'image/bmp' })).toBe('measure');
    expect(C.shouldUnwarp('yes')).toBe(true);
    expect(C.shouldUnwarp('no', 200)).toBe(false);
    expect(C.shouldUnwarp('measure', 29)).toBe(true);
    expect(C.shouldUnwarp('measure', 28)).toBe(false);
    expect(C.shouldUnwarp('measure', null)).toBe(false);
    expect(C.UNEVEN_SPREAD).toBe(require(path.join(__dirname, '..', 'ocr-prep.js')).UNEVEN_SPREAD);
  });

  test('EXIF กล้อง: Make (II/MM, ค่ายาว/สั้นในช่อง) = มี · มีแค่ Orientation / ไม่มี Exif / Make ว่าง = ไม่มี', () => {
    const u8 = (b) => new Uint8Array(b);
    expect(C.readExifCamera(u8(withExif(FAKE_JPEG, { make: 'Apple' })))).toBe(true);
    expect(C.readExifCamera(u8(withExif(FAKE_JPEG, { make: 'Canon', be: true })))).toBe(true);
    expect(C.readExifCamera(u8(withExif(FAKE_JPEG, { make: 'LG' })))).toBe(true); // 3 ไบต์ อยู่ในช่องค่าเอง
    expect(C.readExifCamera(u8(withExif(FAKE_JPEG, { onlyOrientation: true })))).toBe(false);
    expect(C.readExifCamera(u8(withExif(FAKE_JPEG, { make: '   ' })))).toBe(false);
    expect(C.readExifCamera(u8(FAKE_JPEG))).toBe(false);
    expect(C.readExifCamera(new Uint8Array(0))).toBe(false);
    // HEIC: ไอเท็ม Exif = ออฟเซ็ต 4 ไบต์ + "Exif\0\0" + TIFF อยู่กลางไฟล์
    const heic = Buffer.concat([Buffer.from('....ftypheic....meta', 'latin1'), Buffer.from([0, 0, 0, 6]), exifSegment({ make: 'Apple' }).subarray(4)]);
    expect(C.readExifCamera(u8(heic))).toBe(true);
  });

  test('หมุนภาพทวนเข็มแบบ OpenCV (ป้าย 90/180/270 ของตัวจำแนกทิศหน้า) · 90 สองครั้ง = 180', () => {
    // ภาพ 3×2 ช่องสีเดียว: [1 2 3 / 4 5 6]
    const img = { width: 3, height: 2, data: Uint8Array.from([1, 2, 3, 4, 5, 6]) };
    const r90 = C.rotateRgb(img, 90);
    expect([r90.width, r90.height, Array.from(r90.data)]).toEqual([2, 3, [3, 6, 2, 5, 1, 4]]);
    const r180 = C.rotateRgb(img, 180);
    expect(Array.from(r180.data)).toEqual([6, 5, 4, 3, 2, 1]);
    const r270 = C.rotateRgb(img, 270);
    expect([r270.width, r270.height, Array.from(r270.data)]).toEqual([2, 3, [4, 1, 5, 2, 6, 3]]);
    expect(Array.from(C.rotateRgb(C.rotateRgb(img, 90), 90).data)).toEqual(Array.from(r180.data));
    expect(C.rotateRgb(img, 0)).toBe(img);
    // 3 ช่องสี: พิกเซลย้ายทั้งก้อน
    const rgb = { width: 2, height: 1, data: Uint8Array.from([10, 11, 12, 20, 21, 22]) };
    expect(Array.from(C.rotateRgb(rgb, 90).data)).toEqual([20, 21, 22, 10, 11, 12]);
  });

  test('dict จาก inference.yml: ทั้งแบบ escape (\\u0E01) และ unicode ตรง · \'\'\' · หยุดที่คีย์ถัดไป · ลิสต์แบบ [ ]', () => {
    const esc = 'Global:\n  model_name: th_PP-OCRv5_mobile_rec\nPostProcess:\n  character_dict:\n  - \'!\'\n  - \'"\'\n  - \'\'\'\'\n  - $\n  - "\\u0E01"\n  - "\\xA9"\n  - "\\u0E33"\n  name: CTCLabelDecode\nPreProcess:\n  - x\n';
    expect(C.parseCharDict(esc)).toEqual(['!', '"', "'", '$', 'ก', '©', 'ำ']);
    const uni = 'PostProcess:\n  character_dict:\n  - ก\n  - ข\n  - \'0\'\n  - \'#\'\n';
    expect(C.parseCharDict(uni)).toEqual(['ก', 'ข', '0', '#']);
    expect(C.parseCharDict('PostProcess:\n  character_dict: ["a", "b"]\n')).toEqual(['a', 'b']);
    expect(C.parseCharDict('nothing here')).toEqual([]);
  });

  test('ย่อด้านยาว ≤ 2000 (ไม่ขยาย) · ชุดโมเดล/ขนาด MB · URL = repo ทางการ PaddlePaddle/*_onnx ที่ revision ในตาราง (ไม่ใช่ Tanotfin)', () => {
    expect(C.fitSize(4000, 3000)).toEqual({ w: 2000, h: 1500, scale: 0.5 });
    expect(C.fitSize(1500, 2600).h).toBe(2000);
    expect(C.fitSize(1000, 500)).toEqual({ w: 1000, h: 500, scale: 1 });
    expect(C.modelSet(false)).toEqual(['det', 'rec', 'dict']);
    expect(C.modelSet(true)).toEqual(['det', 'rec', 'dict', 'ori', 'uvdoc']);
    expect(C.mb(C.setBytes(C.modelSet(true)))).toBeGreaterThan(40);
    Object.keys(C.MODELS).forEach((k) => {
      const m = C.MODELS[k];
      expect(m.repo).toMatch(/^PaddlePaddle\/[A-Za-z0-9_.-]+_onnx$/);
      expect(C.isSha(m.revision)).toBe(true); // ล็อก commit แล้ว (ตรวจด้วย check-models.mjs --paddle) — ห้ามกลับไปใช้ 'main'
      expect(C.modelUrl(m)).toBe('https://huggingface.co/' + m.repo + '/resolve/' + m.revision + '/' + m.file);
    });
    expect(C.MODELS.rec.repo).toBe('PaddlePaddle/th_PP-OCRv5_mobile_rec_onnx');
    expect(C.DET_OPTIONS).toEqual({ maxSideLength: 64, limitType: 'min', maxSideLimit: 4000, textPixelThreshold: 0.3, boxScoreThreshold: 0.6, unclipRatio: 1.5 });
  });
});

/* ── หน้าเว็บกับของหลอก ── */
// ORT หลอก: สร้าง session ได้เมื่อได้ไบต์โมเดล · WebGPU ล้มเสมอ (ทดสอบถอย WASM)
const FAKE_ORT = `export const env = { wasm: {} };
export const InferenceSession = { create: async (buf, o) => {
  if (!buf || !(buf.byteLength > 0)) throw new Error('no model bytes');
  if (o && o.executionProviders && o.executionProviders[0] === 'webgpu') throw new Error('webgpu backend not available');
  return { ep: o.executionProviders[0] };
} };
export class Tensor {}`;
// paddleocr.mjs หลอก: กล่องสลับลำดับ 4 กล่อง (2 บรรทัด) · ข้อความมี "ํา" (ต้องถูก fixThaiOcr แก้) · ทิศหน้าตอบ 90 เสมอ
// (__FAIL__ = 'memory' → ตัวหากล่องโยน error หน่วยความจำ)
const fakePaddle = (fail) => `
const FAIL = ${JSON.stringify(fail || '')};
export class Image { constructor(w, h, c, d) { this.width = w; this.height = h; this.channels = c; this.data = d; } }
export function getModelPresetOptions() { return { detection: { channelOrder: 'bgr' }, recognition: { channelOrder: 'bgr' } }; }
export function getImageClassificationPresetOptions(n) { return { preset: n }; }
export function getTextImageUnwarpingPresetOptions(n) { return { preset: n }; }
const box = (x, y, w, h, tag) => ({ x, y, width: w, height: h, tag, points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
export class DetectionService {
  constructor(ort, s, o) { this.o = o; }
  async run(img) {
    if (FAIL === 'memory') throw new RangeError('Out of memory');
    const W = img.width, H = img.height;
    if (this.o.maxSideLength !== 64 || this.o.limitType !== 'min' || this.o.boxScoreThreshold !== 0.6) throw new Error('det options');
    return [box(W * .55, H * .55, W * .3, H * .1, 'บาท'), box(W * .05, H * .2, W * .4, H * .1, 'น้ํามัน'), box(W * .05, H * .56, W * .4, H * .1, 'รวม 120'), box(W * .55, H * .21, W * .3, H * .1, 'ดีเซล')];
  }
}
export class RecognitionService {
  constructor(ort, s, o) { this.o = o; }
  async run(img, boxes, opts) {
    const d = opts.recognition.charactersDictionary;
    if (d[d.length - 1] !== ' ' || d.indexOf('ก') < 0) throw new Error('dict');
    boxes.forEach((b, i) => opts.onProgress && opts.onProgress({ type: 'rec', stage: 'item', progress: { current: i + 1, total: boxes.length } }));
    return boxes.map((b) => ({ text: b.tag, confidence: 0.91, box: b }));
  }
}
export class ImageClassificationService { async run() { return [{ classId: 1, score: 0.97, label: '90' }]; } }
export class TextImageUnwarpingService { async run(img) { return { doctrImage: { width: img.width, height: img.height, data: img.data } }; } }`;
const YML = 'Global:\n  model_name: th_PP-OCRv5_mobile_rec\nPostProcess:\n  name: CTCLabelDecode\n  character_dict:\n  - \'!\'\n  - "\\u0E01"\n  - "\\u0E02"\n  - "\\u0E33"\n  - a\n  - b\n  - c\n  - d\n  - e\n  - f\n  - g\n';
const TESS_STUB = `window.__rec = []; window.Tesseract = { createWorker: function () { return Promise.resolve({ setParameters: function () { return Promise.resolve(); },
  recognize: function () { window.__rec.push(1); return Promise.resolve({ data: { text: 'ข้อความ tesseract' } }); }, terminate: function () { return Promise.resolve(); } }); } };`;

async function setup(context, page, { fail = '', paddleFail = '', gate = null, gpu = false } = {}) {
  const hf = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/vendor/paddleocr/paddleocr.mjs')) return route.fulfill({ contentType: 'text/javascript', body: fakePaddle(paddleFail) });
    if (u.pathname.endsWith('/vendor/transformers/ort.webgpu.bundle.min.mjs')) return route.fulfill({ contentType: 'text/javascript', body: FAKE_ORT });
    if (u.hostname === 'huggingface.co') {
      hf.push(u.pathname);
      if (fail === 'missing') return route.fulfill({ status: 404, body: 'Entry not found' });
      if (fail === 'network') return route.abort('internetdisconnected');
      if (gate && gate.match.test(u.pathname)) await gate.wait;
      const body = /\.yml$/.test(u.pathname) ? Buffer.from(YML) : Buffer.alloc(/UVDoc/.test(u.pathname) ? 300000 : 100000, 7);
      return route.fulfill({ status: 200, body, headers: { 'Content-Length': String(body.length), 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/octet-stream' } });
    }
    if (/tesseract\.js@5\/dist\/tesseract\.min\.js/.test(u.href)) return route.fulfill({ contentType: 'application/javascript', body: TESS_STUB });
    if (/pdfjs-dist@4\.7\.76\/build\/(pdf\.min\.mjs|pdf\.worker\.min\.mjs)/.test(u.href)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, 'node_modules', 'pdfjs-dist', 'build', u.pathname.split('/').pop())) });
    if (u.hostname === 'cdn.jsdelivr.net' && /\.m?js$/.test(u.pathname)) return route.fulfill({ contentType: 'application/javascript', body: '' });
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort('internetdisconnected');
  });
  await page.addInitScript((gpu) => {
    try { localStorage.setItem('ome:theme', 'light'); } catch (e) {}
    if (gpu) Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: () => Promise.resolve({ isFallbackAdapter: false, features: new Set() }) } });
  }, gpu);
  return { hf, errors };
}
// รูปที่สร้างในเบราว์เซอร์ (มีตัวอักษรบนพื้นขาว / พื้นไล่เฉดแสงไม่เท่ากัน) → Buffer
async function makeImage(page, { type = 'image/png', w = 900, h = 600, gradient = false } = {}) {
  const b64 = await page.evaluate(({ type, w, h, gradient }) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (gradient) { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#555555'); x.fillStyle = g; } else x.fillStyle = '#ffffff';
    x.fillRect(0, 0, w, h); x.fillStyle = '#111'; x.font = '36px sans-serif';
    for (let i = 0; i < 6; i++) x.fillText('ทดสอบข้อความบรรทัด ' + i, 40, 80 + i * 80);
    return c.toDataURL(type, 0.9).split(',')[1];
  }, { type, w, h, gradient });
  return Buffer.from(b64, 'base64');
}
const statusText = (page) => page.locator('#readStatus');
async function logRows(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]')); }

test.describe('extract-text — อ่านแบบใหม่ (ทดลอง)', () => {
  test('ตัวเลือกโผล่ทุกโฮสต์ ค่าเริ่มต้นปิด · ติ๊กแล้วจำค่า · PNG = ไม่คลี่หน้า · ข้อความเรียงบรรทัด + แก้ ํา · Tesseract ไม่ถูกเรียก · ไม่มี error', async ({ context, page }) => {
    const { hf, errors } = await setup(context, page);
    await page.goto('/extract-text.html');
    await expect(page.locator('#paddleChk')).toBeVisible();
    await expect(page.locator('#paddleChk')).not.toBeChecked();
    await page.check('#paddleChk');
    expect(await page.evaluate(() => localStorage.getItem('tanot:ocr:paddle'))).toBe('1');
    await page.reload();
    await expect(page.locator('#paddleChk')).toBeChecked();

    await page.setInputFiles('#fileInput', { name: 'หน้าจอ.png', mimeType: 'image/png', buffer: await makeImage(page) });
    await expect(page.locator('#resultCard')).toBeVisible({ timeout: 30000 });
    expect(await page.inputValue('#resultText')).toBe('น้ำมัน ดีเซล\nรวม 120 บาท');
    await expect(statusText(page)).toHaveClass(/ok/);
    expect(await page.evaluate(() => window.__rec ? window.__rec.length : 0)).toBe(0);
    // PNG ไม่โหลดตัวจำแนกทิศ/UVDoc
    expect(hf.some((p) => /doc_ori|UVDoc/.test(p))).toBe(false);
    expect(hf.filter((p) => /resolve\//.test(p)).sort()).toEqual([
      '/PaddlePaddle/PP-OCRv5_mobile_det_onnx/resolve/' + C.MODELS.det.revision + '/inference.onnx',
      '/PaddlePaddle/th_PP-OCRv5_mobile_rec_onnx/resolve/' + C.MODELS.rec.revision + '/inference.onnx',
      '/PaddlePaddle/th_PP-OCRv5_mobile_rec_onnx/resolve/' + C.MODELS.dict.revision + '/inference.yml'
    ]);
    // สถิติลง problem log (ไม่มีข้อความ/ชื่อไฟล์)
    const rows = await logRows(page);
    const note = rows.find((r) => r.stage === 'paddle');
    expect(note.code).toBe('info');
    expect(note.msg).toMatch(/unwarped=0 angle=0 src=photo/);
    expect(note.device).toBe('wasm');
    expect(JSON.stringify(rows)).not.toMatch(/น้ำมัน|ดีเซล|หน้าจอ/);
    expect(errors).toEqual([]);
  });

  test('แถบโหลดโมเดลครั้งแรกบอก MB · อ่านไฟล์ที่ 2 / เปิดหน้าใหม่ = ใช้โมเดลในเครื่อง (ไม่ดาวน์โหลดซ้ำ ไม่มีแถบ)', async ({ context, page }) => {
    let release;
    const gate = { match: /th_PP-OCRv5_mobile_rec_onnx.*\.onnx$/, wait: new Promise((r) => { release = r; }) };
    const { hf } = await setup(context, page, { gate });
    await page.addInitScript(() => localStorage.setItem('tanot:ocr:paddle', '1'));
    await page.goto('/extract-text.html');
    await page.setInputFiles('#fileInput', { name: 'a.png', mimeType: 'image/png', buffer: await makeImage(page) });
    await expect(page.locator('#modelBar')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#modelBarVal')).toHaveText(/^\d+\.\d \/ \d+\.\d MB$/);
    const now = Number(await page.locator('#modelBarMeter').getAttribute('aria-valuenow'));
    expect(now).toBeGreaterThan(0);
    expect(now).toBeLessThan(100);
    release();
    await expect(page.locator('#resultCard')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#modelBar')).toBeHidden();
    const n1 = hf.length;
    await page.setInputFiles('#fileInput', { name: 'b.png', mimeType: 'image/png', buffer: await makeImage(page, { w: 700 }) });
    await expect(statusText(page)).toContainText('b.png', { timeout: 20000 });
    await expect(statusText(page)).toHaveClass(/ok/);
    expect(hf.length).toBe(n1);
    await page.reload();
    await page.setInputFiles('#fileInput', { name: 'c.png', mimeType: 'image/png', buffer: await makeImage(page) });
    await expect(statusText(page)).toContainText('c.png', { timeout: 20000 });
    await expect(statusText(page)).toHaveClass(/ok/);
    expect(hf.length).toBe(n1); // จาก Cache Storage tanot-paddle-models
    expect(await page.evaluate(() => caches.keys())).toContain('tanot-paddle-models');
  });

  test('JPEG ที่มี EXIF กล้อง → หมุนหน้า (ป้าย 90 → ภาพกลับด้านกว้าง/สูง) + UVDoc · JPEG ไม่มี EXIF พื้นเรียบ = ไม่คลี่ · แสงไม่เท่ากัน = คลี่', async ({ context, page }) => {
    const { hf } = await setup(context, page);
    await page.addInitScript(() => localStorage.setItem('tanot:ocr:paddle', '1'));
    await page.goto('/extract-text.html');
    const jpeg = await makeImage(page, { type: 'image/jpeg', w: 900, h: 600 });
    await page.setInputFiles('#fileInput', { name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: withExif(jpeg, { make: 'Apple' }) });
    await expect(page.locator('#resultCard')).toBeVisible({ timeout: 30000 });
    let note = (await logRows(page)).filter((r) => r.stage === 'paddle').pop();
    expect(note.msg).toMatch(/size=600x900 .*unwarped=1 angle=90/);
    expect(hf.some((p) => /PP-LCNet_x1_0_doc_ori_onnx/.test(p))).toBe(true);
    expect(hf.some((p) => /UVDoc_onnx/.test(p))).toBe(true);

    await page.setInputFiles('#fileInput', { name: 'scan.jpg', mimeType: 'image/jpeg', buffer: jpeg });
    await expect(statusText(page)).toContainText('scan.jpg', { timeout: 20000 });
    await expect(statusText(page)).toHaveClass(/ok/);
    note = (await logRows(page)).filter((r) => r.stage === 'paddle').pop();
    expect(note.msg).toMatch(/unwarped=0 angle=0/);

    await page.setInputFiles('#fileInput', { name: 'shadow.jpg', mimeType: 'image/jpeg', buffer: await makeImage(page, { type: 'image/jpeg', gradient: true }) });
    await expect(statusText(page)).toContainText('shadow.jpg', { timeout: 20000 });
    await expect(statusText(page)).toHaveClass(/ok/);
    note = (await logRows(page)).filter((r) => r.stage === 'paddle').pop();
    expect(note.msg).toMatch(/unwarped=1/);
  });

  for (const [fail, re] of [['missing', /ไม่พบไฟล์โมเดล/], ['network', /ตรวจอินเทอร์เน็ต/]]) {
    test(`โหลดโมเดลไม่ได้ (${fail}) → ข้อความชัดเจน + ปุ่ม "อ่านด้วยแบบเดิม" (ไม่สลับไป Tesseract เอง) → กดแล้วได้ผลของ Tesseract`, async ({ context, page }) => {
      await setup(context, page, { fail });
      await page.addInitScript(() => localStorage.setItem('tanot:ocr:paddle', '1'));
      await page.goto('/extract-text.html');
      await page.setInputFiles('#fileInput', { name: 'x.png', mimeType: 'image/png', buffer: await makeImage(page) });
      await expect(statusText(page)).toHaveClass(/err/, { timeout: 30000 });
      await expect(statusText(page)).toContainText(re);
      await expect(page.locator('#legacyBtn')).toBeVisible();
      await expect(page.locator('#modelBar')).toBeHidden();
      await expect(page.locator('#resultCard')).toBeHidden();
      expect(await page.evaluate(() => window.__rec.length)).toBe(0);
      const row = (await logRows(page)).find((r) => r.stage === 'paddle-load');
      expect(row.code).toBe('paddle-' + fail);
      expect(row.engine).toBe('paddle');
      expect(JSON.stringify(row)).not.toContain('x.png');
      await page.click('#legacyBtn');
      await expect(page.locator('#resultCard')).toBeVisible({ timeout: 20000 });
      expect(await page.inputValue('#resultText')).toBe('ข้อความ tesseract');
      expect(await page.evaluate(() => window.__rec.length)).toBe(1);
      await expect(page.locator('#legacyRow')).toBeHidden();
      // ค่าที่จำไว้ไม่ถูกเปลี่ยน (ปุ่มแบบเดิม = เฉพาะไฟล์นี้)
      expect(await page.evaluate(() => localStorage.getItem('tanot:ocr:paddle'))).toBe('1');
    });
  }

  test('รันล้มเพราะหน่วยความจำ → ข้อความหน่วยความจำไม่พอ + ปุ่มแบบเดิม · ภาษาอังกฤษ', async ({ context, page }) => {
    await setup(context, page, { paddleFail: 'memory' });
    await page.addInitScript(() => { localStorage.setItem('tanot:ocr:paddle', '1'); localStorage.setItem('ome:lang', 'en'); });
    await page.goto('/extract-text.html');
    await expect(page.locator('#paddleChk + span')).toHaveText('New reader (experimental)');
    await page.setInputFiles('#fileInput', { name: 'x.png', mimeType: 'image/png', buffer: await makeImage(page) });
    await expect(statusText(page)).toHaveClass(/err/, { timeout: 30000 });
    await expect(statusText(page)).toContainText('ran out of memory');
    await expect(page.locator('#legacyBtn')).toHaveText('Read with the old method');
    const row = (await logRows(page)).find((r) => r.stage === 'paddle-run');
    expect(row.code).toBe('oom'); // TanotMedia.classify จัดหน่วยความจำเป็น oom (หมวดเดียวกับ Whisper/TTS)
  });

  test('WebGPU ใช้ได้แต่ล้ม → ทำซ้ำบน WASM เอง (ได้ผล) + จำ 3 วัน + problem log', async ({ context, page }) => {
    await setup(context, page, { gpu: true });
    await page.addInitScript(() => localStorage.setItem('tanot:ocr:paddle', '1'));
    await page.goto('/extract-text.html');
    await page.setInputFiles('#fileInput', { name: 'x.png', mimeType: 'image/png', buffer: await makeImage(page) });
    await expect(page.locator('#resultCard')).toBeVisible({ timeout: 30000 });
    const rows = await logRows(page);
    expect(rows.find((r) => /^paddle-webgpu-/.test(r.stage))).toBeTruthy();
    expect(rows.filter((r) => r.stage === 'paddle').pop().device).toBe('wasm');
    expect(Number(await page.evaluate(() => localStorage.getItem('tanot:ocr:gpubad')))).toBeGreaterThan(0);
  });

  test('PDF สแกน 2 หน้า → อ่านแบบใหม่ทีละหน้า (src=pdf ไม่คลี่หน้า แม้หน้าเรนเดอร์จะใหญ่) · PDF ที่มีข้อความใช้ข้อความจริง ไม่เรียกโมเดล', async ({ context, page }) => {
    const { hf } = await setup(context, page);
    await page.addInitScript(() => localStorage.setItem('tanot:ocr:paddle', '1'));
    await page.goto('/extract-text.html');
    const { PDFDocument, StandardFonts } = require('pdf-lib');
    const scan = await PDFDocument.create();
    for (let i = 0; i < 2; i++) scan.addPage([595, 842]).drawRectangle({ x: 50, y: 600, width: 300, height: 40 });
    await page.setInputFiles('#fileInput', { name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await scan.save()) });
    await expect(page.locator('#resultCard')).toBeVisible({ timeout: 30000 });
    expect(await page.inputValue('#resultText')).toBe('น้ำมัน ดีเซล\nรวม 120 บาท\n\nน้ำมัน ดีเซล\nรวม 120 บาท');
    const notes = (await logRows(page)).filter((r) => r.stage === 'paddle');
    expect(notes).toHaveLength(2);
    notes.forEach((n) => expect(n.msg).toMatch(/size=\d+x2000 .*unwarped=0 angle=0 src=pdf/));
    expect(hf.some((p) => /doc_ori|UVDoc/.test(p))).toBe(false);

    const real = await PDFDocument.create();
    real.addPage([595, 842]).drawText('Hello text layer', { x: 50, y: 700, size: 18, font: await real.embedFont(StandardFonts.Helvetica) });
    const before = hf.length;
    await page.setInputFiles('#fileInput', { name: 'real.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await real.save()) });
    await expect(statusText(page)).toContainText('real.pdf', { timeout: 20000 });
    await expect(statusText(page)).toHaveClass(/ok/);
    expect(await page.inputValue('#resultText')).toBe('Hello text layer');
    expect((await logRows(page)).filter((r) => r.stage === 'paddle')).toHaveLength(2);
    expect(hf.length).toBe(before);
  });

  test('ตัวอ่านทำงานใน Module Worker (ไม่ใช่เธรดหลัก) · ไม่มี script ของไลบรารี/โมเดลบนหน้า', async ({ context, page }) => {
    await setup(context, page);
    await page.addInitScript(() => {
      window.__w = [];
      const W = window.Worker;
      window.Worker = function (url, opts) { window.__w.push({ url: String(url), type: opts && opts.type }); return new W(url, opts); };
      window.Worker.prototype = W.prototype;
      localStorage.setItem('tanot:ocr:paddle', '1');
    });
    await page.goto('/extract-text.html');
    await page.setInputFiles('#fileInput', { name: 'x.png', mimeType: 'image/png', buffer: await makeImage(page) });
    await expect(page.locator('#resultCard')).toBeVisible({ timeout: 30000 });
    expect(await page.evaluate(() => window.__w)).toContainEqual({ url: 'ocr-paddle-worker.js', type: 'module' });
    expect(await page.evaluate(() => typeof window.TanotPaddleCalc)).toBe('object');
    expect(await page.evaluate(() => [...document.scripts].some((s) => /paddleocr\.mjs|ort\.webgpu/.test(s.src)))).toBe(false);
  });
});

test.describe('doc-check-file — อ่านแบบใหม่ (ทดลอง)', () => {
  test('ติ๊กแล้วอ่านรูปด้วย PaddleOCR (จำค่าร่วมกับ extract-text) · ล้ม = ปุ่มแบบเดิม', async ({ context, page }) => {
    await setup(context, page);
    await page.addInitScript(() => localStorage.setItem('tanot:ocr:paddle', '1'));
    await page.goto('/doc-check-file.html');
    await expect(page.locator('#paddleChk')).toBeChecked();
    await page.setInputFiles('#fileInput', { name: 'a.png', mimeType: 'image/png', buffer: await makeImage(page) });
    await expect(page.locator('#docText')).toHaveText('น้ำมัน ดีเซล\nรวม 120 บาท', { timeout: 30000 });
    expect(await page.evaluate(() => window.__rec ? window.__rec.length : 0)).toBe(0);
  });

  test('โหลดโมเดลไม่ได้ → ข้อความ + ปุ่มอ่านด้วยแบบเดิม → Tesseract', async ({ context, page }) => {
    await setup(context, page, { fail: 'missing' });
    await page.addInitScript(() => localStorage.setItem('tanot:ocr:paddle', '1'));
    await page.goto('/doc-check-file.html');
    await page.setInputFiles('#fileInput', { name: 'a.png', mimeType: 'image/png', buffer: await makeImage(page) });
    await expect(page.locator('#statusMsg')).toHaveClass(/err/, { timeout: 30000 });
    await expect(page.locator('#statusMsg')).toContainText('ไม่พบไฟล์โมเดล');
    await expect(page.locator('#legacyBtn')).toBeVisible();
    expect(await page.evaluate(() => window.__rec.length)).toBe(0);
    await page.click('#legacyBtn');
    await expect(page.locator('#docText')).toHaveText('ข้อความ tesseract', { timeout: 20000 });
    await expect(page.locator('#legacyRow')).toBeHidden();
  });
});
