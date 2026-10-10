// ปรับปรุงเสียง/OCR Section 2: รหัส OCR_PIN ก่อนใช้ Claude Vision + ย่อรูป/PDF สแกน + Tesseract แม่นขึ้น + เลือกโมเดล Claude
//   API: /api/ocr ตัวจริง (functions/api/ocr.js + functions/_lib/ocrpin.js) บน SQLite (migrations/0003_ocr_pin.sql) กับ Anthropic ตัวหลอก ใน sync-server.mjs พอร์ต 8140
//   หน้าเว็บ: extract-text / doc-check-file (โฮสต์ *.pages.dev จำลองด้วย --host-resolver-rules) ต่อกับ /api/ocr ตัวจริงเต็มทาง — รหัสจริงของเจ้าของไม่เกี่ยว (รหัสทดสอบ 246810 มาจาก sync-server)
//   ทั้งไฟล์ serial เพราะใช้ /__reset ร่วมกัน
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument, StandardFonts } = require('pdf-lib');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8140;
const SRV = `http://localhost:${PORT}`;
const PAGES_HOST = 'ocr-test.pages.dev';
const PAGES = `http://${PAGES_HOST}:${PORT}`;
const PIN = '246810';
const NM = (...p) => path.join(__dirname, 'node_modules', ...p);
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
// sha256 ของ prompt ถอดข้อความเดิม (DEFAULT_PROMPT) ที่ห้ามแก้ — คำนวณจากฉบับก่อนงาน Section 2
const PROMPT_SHA = '9f58bb91e8a04baaf10031c44c63952ac48c9fe02b254117f60a5e333346db24';
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

test.describe.configure({ mode: 'serial' });
// จำลองโฮสต์ *.pages.dev (ให้ตรวจ hostname แบบจริงของ doc-check/AiClient) โดยชี้ไปเซิร์ฟเวอร์ทดสอบในเครื่อง — ต้องตั้งระดับไฟล์ (บังคับเบราว์เซอร์ใหม่)
test.use({ launchOptions: { args: [`--host-resolver-rules=MAP ${PAGES_HOST} 127.0.0.1`] } });

/* ───────────────────────── API ───────────────────────── */
const reset = (request) => request.get(SRV + '/__reset');
const ocrCfg = (request, q) => request.get(SRV + '/__ocr?' + q);
const ocrLog = async (request) => (await request.get(SRV + '/__ocrlog')).json();
function post(request, body, pin) {
  const headers = { 'Content-Type': 'application/json' };
  if (pin !== undefined) headers['X-OCR-Pin'] = pin;
  return request.post(SRV + '/api/ocr', { headers, data: body });
}
const IMG = { imageBase64: PNG_1X1.toString('base64'), mediaType: 'image/png' };

test.describe('/api/ocr — รหัส OCR_PIN', () => {
  test.beforeEach(async ({ request }) => { await reset(request); });

  test('ไม่ตั้ง OCR_PIN = ปฏิเสธทุกคำขอ (503 pin_unset) แม้ใส่ header มาและไม่เรียก Anthropic', async ({ request }) => {
    await ocrCfg(request, 'pin=');
    for (const pin of [undefined, PIN, '']) {
      const r = await post(request, IMG, pin);
      expect(r.status()).toBe(503);
      const j = await r.json();
      expect(j.code).toBe('pin_unset');
      expect(j.error).toContain('ยังไม่ได้ตั้งรหัส');
    }
    expect(await ocrLog(request)).toHaveLength(0);
  });

  test('ไม่มี header = 401 pin_required (ไม่นับเป็นการเดา) · รหัสผิด = 401 pin_wrong · ทั้งคู่ไม่เรียก Claude', async ({ request }) => {
    let r = await post(request, IMG);
    expect(r.status()).toBe(401);
    expect((await r.json()).code).toBe('pin_required');
    r = await post(request, IMG, '000000');
    expect(r.status()).toBe(401);
    const j = await r.json();
    expect(j.code).toBe('pin_wrong');
    expect(j.remaining).toBe(4);
    expect(JSON.stringify(j)).not.toContain('000000');
    expect(await ocrLog(request)).toHaveLength(0);
    // pin_required ไม่ถูกนับ: ตัวนับมีแค่ครั้งที่ผิดจริง 1 แถว
    expect((await (await request.get(SRV + '/__ocrdb')).json()).attempts).toHaveLength(1);
  });

  test('รหัสถูก → เรียก Claude 1 ครั้งด้วยคีย์ฝั่งเซิร์ฟเวอร์ · prompt ถอดข้อความเดิมไม่ถูกแก้ · ค่าเริ่มต้น claude-sonnet-5 + thinking disabled', async ({ request }) => {
    const r = await post(request, IMG, PIN);
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.text).toBe('ข้อความจากรูป');
    expect(j.model).toBe('claude-sonnet-5');
    const log = await ocrLog(request);
    expect(log).toHaveLength(1);
    expect(log[0].model).toBe('claude-sonnet-5');
    expect(log[0].thinking).toEqual({ type: 'disabled' });
    expect(log[0].key).toBe('test-key');
    expect(log[0].blocks.map((b) => b.type)).toEqual(['image', 'text']);
    expect(sha(log[0].blocks[1].text)).toBe(PROMPT_SHA);
    expect(log[0].blocks[1].text).toContain('ห้ามแก้คำผิด');
  });

  test('ผิดครบ 5 ครั้ง → ครั้งที่ 6 ล็อก 15 นาที (429 + Retry-After) แม้รหัสถูก · ปลดล็อกแล้วใช้ได้ · ไม่มีรหัสเก็บใน D1', async ({ request }) => {
    for (let i = 1; i <= 5; i++) {
      const r = await post(request, IMG, 'wrong' + i);
      expect(r.status()).toBe(401);
      expect((await r.json()).remaining).toBe(5 - i);
    }
    let r = await post(request, IMG, 'wrong6');
    expect(r.status()).toBe(429);
    expect(Number(r.headers()['retry-after'])).toBeGreaterThan(14 * 60);
    expect((await r.json()).code).toBe('pin_locked');
    // ระหว่างล็อก: รหัสถูกก็ไม่ผ่าน และ Claude ไม่ถูกเรียก
    r = await post(request, IMG, PIN);
    expect(r.status()).toBe(429);
    expect(await ocrLog(request)).toHaveLength(0);
    const db = await (await request.get(SRV + '/__ocrdb')).json();
    expect(JSON.stringify(db)).not.toMatch(/wrong|246810/);
    expect(Object.keys(db.attempts[0]).sort()).toEqual(['at', 'id']);
    expect(db.lock).toHaveLength(1);
    // เวลาผ่านไปเกินช่วงล็อก
    await request.get(SRV + '/__ocrunlock');
    r = await post(request, IMG, PIN);
    expect(r.status()).toBe(200);
    expect(await ocrLog(request)).toHaveLength(1);
  });

  test('รหัสถูก = ล้างตัวนับ (ผิด 3 → ถูก → ผิดอีก 3 ไม่ล็อก) · ยิงพร้อมกัน 12 รหัสผิด เทียบรหัสผ่านได้ไม่เกิน 5 ครั้ง', async ({ request }) => {
    for (let i = 0; i < 3; i++) expect((await post(request, IMG, 'x' + i)).status()).toBe(401);
    expect((await post(request, IMG, PIN)).status()).toBe(200);
    for (let i = 0; i < 3; i++) expect((await post(request, IMG, 'y' + i)).status()).toBe(401);
    expect((await post(request, IMG, PIN)).status()).toBe(200);
    await reset(request);
    const rs = await Promise.all(Array.from({ length: 12 }, (_, i) => post(request, IMG, 'z' + i)));
    const st = rs.map((r) => r.status());
    expect(st.filter((s) => s === 401).length).toBeLessThanOrEqual(5);
    expect(st.filter((s) => s === 429).length).toBeGreaterThanOrEqual(7);
  });

  test('รหัสถูกต้องแต่ยังไม่ได้ตั้งคีย์ Anthropic → 500 config (รหัสถูกตรวจก่อนคีย์: รหัสผิด = 401 ไม่บอกว่าคีย์หาย)', async ({ request }) => {
    await ocrCfg(request, 'key=0');
    expect((await post(request, IMG, 'nope')).status()).toBe(401);
    const r = await post(request, IMG, PIN);
    expect(r.status()).toBe(500);
    expect((await r.json()).code).toBe('config');
  });

  test('ไม่มีรหัส/ค่า hash ของรหัสใน repo · ไม่ log รหัส · เทียบแบบ constant-time (digest คงที่ ไม่ใช้ ===) · ตั้งผ่าน secret เท่านั้น', async () => {
    const lib = fs.readFileSync(path.join(ROOT, 'functions/_lib/ocrpin.js'), 'utf8');
    const fn = fs.readFileSync(path.join(ROOT, 'functions/api/ocr.js'), 'utf8');
    const toml = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');
    expect(toml).not.toMatch(/OCR_PIN/);
    expect(lib + fn).not.toMatch(/console\./);
    expect(lib).toMatch(/crypto\.subtle\.digest\('SHA-256'/);
    expect(lib).toMatch(/diff \|= a\[i\] \^ b\[i\]/);
    expect(lib).not.toMatch(/OCR_PIN\s*===|===\s*env\.OCR_PIN|given\s*===/);
    // เนื้อหา migration ไม่มีคอลัมน์เก็บรหัส
    const mig = fs.readFileSync(path.join(ROOT, 'migrations/0003_ocr_pin.sql'), 'utf8');
    expect(mig).not.toMatch(/\bpin\s+TEXT|hash|secret/i);
    // รหัสทดสอบอยู่เฉพาะในโค้ดทดสอบ
    const out = require('child_process').execSync(`git -C "${ROOT}" ls-files`).toString().split('\n').filter((f) => f && !f.startsWith('tests/') && !f.startsWith('vendor/') && /\.(js|html|json|toml|md|sql|mjs|yml)$/.test(f));
    const leaks = out.filter((f) => new RegExp('(?<![0-9A-Za-z])' + PIN + '(?![0-9A-Za-z])').test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    expect(leaks).toEqual([]);
  });

  test('allowlist โมเดล: sonnet-5-5 ใช้ thinking between_tools (disabled ได้ 400) · haiku-5-5 ใช้ disabled · โมเดลนอกลิสต์ 400 ไม่เรียก Claude', async ({ request }) => {
    for (const [model, thinking] of [['claude-sonnet-5', { type: 'disabled' }], ['claude-sonnet-5-5', { type: 'between_tools' }], ['claude-haiku-5-5', { type: 'disabled' }]]) {
      const r = await post(request, { ...IMG, model }, PIN);
      expect(r.status()).toBe(200);
      expect((await r.json()).model).toBe(model);
    }
    const log = await ocrLog(request);
    expect(log.map((l) => l.model)).toEqual(['claude-sonnet-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']);
    expect(log[1].thinking).toEqual({ type: 'between_tools' });
    expect(log[2].thinking).toEqual({ type: 'disabled' });
    for (const bad of ['claude-opus-5-5', 'claude-sonnet-4-5', '../x', 5]) {
      const r = await post(request, { ...IMG, model: bad }, PIN);
      expect(r.status()).toBe(400);
      expect((await r.json()).code).toBe('bad_model');
    }
    expect(await ocrLog(request)).toHaveLength(3);
  });

  test('PDF → content block document (ก่อนข้อความ) + prompt เดิม + ตัวคั่นหน้า [[หน้า N]] เริ่มที่ pageStart · prompt ของหน้า (ใบเสร็จ) ไม่มีตัวคั่น', async ({ request }) => {
    const pdf = (await pdfBytes(2, false)).toString('base64');
    let r = await post(request, { pdfBase64: pdf, pageStart: 101 }, PIN);
    expect(r.status()).toBe(200);
    expect((await r.json()).text).toContain('[[หน้า 1]]');
    let log = await ocrLog(request);
    expect(log[0].max_tokens).toBe(32000);
    expect(log[0].blocks.map((b) => b.type)).toEqual(['document', 'text', 'text']);
    expect(log[0].blocks[0]).toMatchObject({ media: 'application/pdf', len: pdf.length });
    expect(sha(log[0].blocks[1].text)).toBe(PROMPT_SHA);
    expect(log[0].blocks[2].text).toContain('[[หน้า N]]');
    expect(log[0].blocks[2].text).toContain('คือหน้า 101');
    await request.get(SRV + '/__ocrlog?clear=1');
    r = await post(request, { pdfBase64: pdf, prompt: 'ตอบ JSON เท่านั้น' }, PIN);
    expect(r.status()).toBe(200);
    log = await ocrLog(request);
    expect(log[0].blocks.map((b) => b.type)).toEqual(['document', 'text']);
    expect(log[0].blocks[1].text).toBe('ตอบ JSON เท่านั้น');
  });

  test('ตรวจคำขอก่อนเรียก Claude: รูป+PDF พร้อมกัน/ไม่มีเลย/ชนิดรูปแปลก/ใหญ่เกิน 5 MB (413) → ไม่เรียก Claude', async ({ request }) => {
    const pdf = (await pdfBytes(1, false)).toString('base64');
    expect((await post(request, { ...IMG, pdfBase64: pdf }, PIN)).status()).toBe(400);
    expect((await post(request, {}, PIN)).status()).toBe(400);
    expect((await post(request, { imageBase64: 'QUJD', mediaType: 'image/heic' }, PIN)).status()).toBe(400);
    const big = await post(request, { imageBase64: 'A'.repeat(5000001), mediaType: 'image/jpeg' }, PIN);
    expect(big.status()).toBe(413);
    expect((await big.json()).code).toBe('too_large');
    expect(await ocrLog(request)).toHaveLength(0);
    // ขอบ: 5,000,000 พอดีผ่าน
    expect((await post(request, { imageBase64: 'A'.repeat(5000000), mediaType: 'image/jpeg' }, PIN)).status()).toBe(200);
  });

  test('Anthropic ล้ม: 429/5xx ลองใหม่ 1 ครั้ง (ผ่าน → 200, ไม่ผ่าน → 503/502) · 400 ไม่ลองซ้ำ · คีย์เซิร์ฟเวอร์ผิด (401) ไม่ส่งต่อเป็น 401 · ปฏิเสธ = 422 · ตัดที่ max_tokens = truncated', async ({ request }) => {
    const run = async (mode) => { await ocrCfg(request, 'mode=' + mode); await request.get(SRV + '/__ocrlog?clear=1'); const r = await post(request, IMG, PIN); return { r, n: (await ocrLog(request)).length }; };
    let x = await run('flaky429');
    expect(x.r.status()).toBe(200); expect(x.n).toBe(2);
    x = await run('flaky500');
    expect(x.r.status()).toBe(200); expect(x.n).toBe(2);
    x = await run('always429');
    expect(x.r.status()).toBe(503); expect((await x.r.json()).code).toBe('upstream'); expect(x.n).toBe(2);
    x = await run('always500');
    expect(x.r.status()).toBe(502); expect(x.n).toBe(2);
    x = await run('bad400');
    expect(x.r.status()).toBe(400); expect((await x.r.json()).error).toContain('bad image'); expect(x.n).toBe(1);
    x = await run('auth401');
    expect(x.r.status()).toBe(502); expect((await x.r.json()).code).toBe('upstream'); expect(x.n).toBe(1);
    x = await run('refusal');
    expect(x.r.status()).toBe(422);
    x = await run('maxtokens');
    expect(x.r.status()).toBe(200); expect((await x.r.json()).truncated).toBe(true);
  });
});

/* ───────────────────────── ocr-prep.js (พิกเซลล้วน) ───────────────────────── */
test.describe('ocr-prep — Sauvola / แก้ภาพเอียง / เลือกวิธีขาวดำ', () => {
  const P = require('../ocr-prep.js');
  function textLines(w, h, alpha) {
    const g = new Uint8ClampedArray(w * h).fill(240), t = Math.tan(alpha * Math.PI / 180);
    for (let L = 0; L < 12; L++) {
      const y0 = 60 + L * 35;
      for (let x = 20; x < w - 20; x++) if (x % 14 < 9) for (let dy = 0; dy < 4; dy++) { const y = Math.round(y0 + (x - w / 2) * t) + dy; if (y >= 0 && y < h) g[y * w + x] = 20; }
    }
    return g;
  }
  test('แก้ภาพเอียง ±14° ได้มุมแก้ตรงข้ามกับความเอียงภายใน 0.5° · ภาพตรง/เอียงน้อยมาก = ไม่หมุน · ภาพว่าง = ไม่หมุน', () => {
    for (const a of [3, -6, 10, -14]) {
      const r = P.detectSkew(textLines(520, 520, a), 520, 520);
      expect(Math.abs(r.angle + a)).toBeLessThanOrEqual(0.5);
      expect(r.gain).toBeGreaterThan(1.03);
    }
    expect(P.detectSkew(textLines(520, 520, 0), 520, 520).angle).toBe(0);
    expect(P.detectSkew(textLines(520, 520, 0.1), 520, 520).angle).toBe(0);
    expect(P.detectSkew(new Uint8ClampedArray(520 * 520).fill(255), 520, 520).angle).toBe(0);
  });
  test('แสงไล่เฉด: Otsu ทั้งภาพพลาดมาก แต่ Sauvola ถูกทุกพิกเซล · ภาพสม่ำเสมอ Sauvola ก็ถูก · unevenness แยกสองกรณีออกจากกัน', () => {
    const w = 400, h = 300, g = new Uint8ClampedArray(w * h), truth = new Uint8Array(w * h), flat = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const shade = 250 - 130 * (x / w), ink = (x % 24) < 4 && (y % 30) < 18;
      truth[y * w + x] = ink ? 0 : 255; g[y * w + x] = ink ? shade * 0.35 : shade; flat[y * w + x] = ink ? 30 : 240;
    }
    const acc = (bw) => { let ok = 0; for (let i = 0; i < bw.length; i++) if (bw[i] === truth[i]) ok++; return ok / bw.length; };
    const gs = P.stretch(new Uint8ClampedArray(g));
    expect(acc(P.binarizeGlobal(gs, P.otsuThreshold(gs)))).toBeLessThan(0.8);
    expect(acc(P.sauvola(gs, w, h, 31))).toBe(1);
    expect(acc(P.sauvola(P.stretch(new Uint8ClampedArray(flat)), w, h, 31))).toBe(1);
    expect(P.unevenness(g, w, h)).toBeGreaterThan(P.UNEVEN_SPREAD);
    expect(P.unevenness(flat, w, h)).toBeLessThan(P.UNEVEN_SPREAD);
  });
});

/* ───────────────────────── หน้าเว็บ ───────────────────────── */
async function pdfBytes(pages, withText) {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const p = d.addPage([300, 300]);
    if (withText) p.drawText('Hello page ' + (i + 1) + ' receipt total 100', { x: 20, y: 150, font: f, size: 14 });
  }
  return Buffer.from(await d.save());
}

// Tesseract ตัวหลอก: บันทึกวิธีสร้าง worker (ภาษา/OEM/ตัวเลือก) และชนิดของภาพที่ได้รับ
const TESS_STUB = `window.__cw=[];window.__rec=[];window.__term=0;
window.Tesseract={createWorker:function(l,o,opts){window.__cw.push({langs:l,oem:o,opts:opts||null});
 return Promise.resolve({setParameters:function(){return Promise.resolve();},terminate:function(){window.__term++;return Promise.resolve();},
  recognize:function(img){window.__rec.push({ctor:(img&&img.constructor&&img.constructor.name)||typeof img,type:img&&img.type||'',w:img&&img.width||0,h:img&&img.height||0});
   return Promise.resolve({data:{text:'ข้อความ tesseract'}});}});}};`;

async function openPage(page, p, { host = 'localhost', noOffscreen = false } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript((noOff) => {
    try { localStorage.setItem('tanot:auth', '1'); } catch (e) {}
    window.TANOT_AI = { enabled: true };
    if (noOff) delete window.OffscreenCanvas;
  }, noOffscreen);
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|ocr-test\.pages\.dev)/, (route) => route.abort('internetdisconnected'));
  await page.route(/https:\/\/cdn\.jsdelivr\.net\/npm\/.+/, (route) => {
    const url = route.request().url();
    if (/tesseract\.js@5\/dist\/tesseract\.min\.js/.test(url)) return route.fulfill({ contentType: 'application/javascript', body: TESS_STUB });
    if (/pdfjs-dist@4\.7\.76\/build\/(pdf\.min\.mjs|pdf\.worker\.min\.mjs)/.test(url)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(NM('pdfjs-dist', 'build', url.split('/').pop())) });
    if (/pdf-lib@1\.17\.1\/dist\/pdf-lib\.min\.js/.test(url)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(NM('pdf-lib', 'dist', 'pdf-lib.min.js')) });
    if (/\.js$|\.mjs$/.test(url)) return route.fulfill({ contentType: 'application/javascript', body: '' });
    return route.abort('internetdisconnected');
  });
  const ocrReqs = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/ocr') && r.method() === 'POST') ocrReqs.push({ headers: r.headers(), body: r.postDataJSON() });
  });
  await page.goto(`${host === 'localhost' ? SRV : PAGES}/${p}`, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return { errors, ocrReqs };
}
const dialog = (page) => page.locator('dialog[data-ocrv][open]');
async function submitPin(page, pin) {
  await expect(dialog(page)).toBeVisible();
  await dialog(page).locator('input[type=password]').fill(pin);
  await dialog(page).locator('[data-k=send]').click();
}

test.describe('extract-text — Claude Vision ต้องเลือกเอง + รหัสทุกครั้ง', () => {
  test.beforeEach(async ({ request }) => { await reset(request); });

  test('ค่าเริ่มต้นฟรี: แถวตัวเลือกโผล่เฉพาะเมื่อมีคลาวด์ · อ่านรูปฟรีไม่เรียก /api/ocr และไม่มี dialog', async ({ page }) => {
    const { ocrReqs, errors } = await openPage(page, 'extract-text.html');
    await expect(page.locator('#engRow')).toBeVisible();
    await expect(page.locator('#engToggle [data-oe=free]')).toHaveClass(/active/);
    await page.setInputFiles('#fileInput', { name: 'a.png', mimeType: 'image/png', buffer: PNG_1X1 });
    await expect(page.locator('#resultText')).toHaveValue('ข้อความ tesseract');
    expect(ocrReqs).toHaveLength(0);
    await expect(dialog(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('ไม่มีคลาวด์ (ไม่ใช่ pages.dev) → ไม่มีแถว Claude เลย', async ({ page }) => {
    await page.addInitScript(() => { window.TANOT_AI = { enabled: false }; });
    await page.route(/https:\/\/cdn\.jsdelivr\.net\/.+/, (route) => route.abort('internetdisconnected'));
    await page.goto(SRV + '/extract-text.html');
    await expect(page.locator('#engRow')).toBeHidden();
  });

  test('เลือก Claude → dialog ทุกครั้ง: ยกเลิก = ไม่มีคำขอ · รหัสผิด = ถามใหม่พร้อมข้อความ · ถูก = ส่งพร้อม X-OCR-Pin · ครั้งที่สามถามอีก · ไม่จำรหัสที่ไหนเลย', async ({ page, request, context }) => {
    const { ocrReqs, errors } = await openPage(page, 'extract-text.html');
    await page.click('#engToggle [data-oe=vision]');
    const file = { name: 'a.png', mimeType: 'image/png', buffer: PNG_1X1 };

    // 1) ยกเลิก
    await page.setInputFiles('#fileInput', file);
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator('input')).toHaveAttribute('type', 'password');
    await expect(dialog(page).locator('input')).toHaveAttribute('inputmode', 'numeric');
    await expect(dialog(page).locator('input')).toHaveAttribute('autocomplete', 'off');
    await dialog(page).locator('[data-k=cancel]').click();
    await expect(page.locator('dialog[data-ocrv]')).toHaveCount(0);
    await expect(page.locator('#readStatus')).toContainText('ยกเลิก');
    expect(ocrReqs).toHaveLength(0);
    expect(await ocrLog(request)).toHaveLength(0);

    // 2) รหัสผิด แล้วถูก
    await page.setInputFiles('#fileInput', file);
    await submitPin(page, '111111');
    await expect(dialog(page).locator('.form-msg')).toContainText('รหัสไม่ถูกต้อง');
    await expect(dialog(page).locator('input')).toHaveValue('');
    await submitPin(page, PIN);
    await expect(page.locator('#resultText')).toHaveValue('ข้อความจากรูป');
    expect(ocrReqs).toHaveLength(2);
    expect(ocrReqs[0].headers['x-ocr-pin']).toBe('111111');
    expect(ocrReqs[1].headers['x-ocr-pin']).toBe(PIN);
    expect(ocrReqs[1].body.mediaType).toBe('image/jpeg');
    expect(ocrReqs[1].body.imageBase64.length).toBeLessThanOrEqual(5000000);
    expect(ocrReqs[1].body.pin).toBeUndefined();
    expect(JSON.stringify(ocrReqs[1].body)).not.toContain(PIN);
    expect(await ocrLog(request)).toHaveLength(1);

    // 3) ไม่จำ: ครั้งต่อไปถามอีก · ปิดแล้ว DOM ไม่เหลือช่องรหัส/ค่ารหัส
    await expect(page.locator('dialog[data-ocrv]')).toHaveCount(0);
    await page.setInputFiles('#fileInput', file);
    await expect(dialog(page)).toBeVisible();
    expect(await dialog(page).locator('input').inputValue()).toBe('');
    await submitPin(page, PIN);
    await expect(page.locator('#readStatus')).toContainText('ดึงข้อความ');
    expect(ocrReqs).toHaveLength(3);
    const leak = await page.evaluate((pin) => {
      const hits = [];
      [localStorage, sessionStorage].forEach((s) => { for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k.includes(pin) || String(s.getItem(k)).includes(pin)) hits.push('storage:' + k); } });
      if (document.querySelector('input[type=password]')) hits.push('password-input-in-dom');
      if (document.documentElement.outerHTML.includes(pin)) hits.push('html');
      Object.keys(window).forEach((k) => { try { if (window[k] === pin) hits.push('window.' + k); } catch (e) {} });
      if (document.cookie.includes(pin)) hits.push('cookie');
      return hits;
    }, PIN);
    expect(leak).toEqual([]);
    expect((await context.cookies()).some((c) => c.value.includes(PIN))).toBe(false);
    // บันทึกปัญหา (data.html) ไม่มีรหัส
    expect(await page.evaluate(() => localStorage.getItem('tanot:media:log') || '')).not.toContain('246810');
    expect(errors).toEqual([]);
  });

  test('ล็อกหลังผิดครบ → แจ้งข้อความล็อก (ไม่ใช่ error แข็ง) · ไม่ได้ตั้งรหัสที่เซิร์ฟเวอร์ → แจ้งว่ายังไม่ได้ตั้ง', async ({ page, request }) => {
    await openPage(page, 'extract-text.html');
    await page.click('#engToggle [data-oe=vision]');
    const file = { name: 'a.png', mimeType: 'image/png', buffer: PNG_1X1 };
    await page.setInputFiles('#fileInput', file);
    for (let i = 0; i < 5; i++) {
      await submitPin(page, 'bad' + i);
      if (i < 4) await expect(dialog(page).locator('.form-msg')).toContainText('รหัสไม่ถูกต้อง');
    }
    // ครั้งที่ 6 ถูกล็อก → ปิด dialog แล้วแสดงข้อความในหน้า
    await submitPin(page, 'bad5');
    await expect(page.locator('#readStatus')).toContainText('ล็อกชั่วคราว');
    expect(await ocrLog(request)).toHaveLength(0);

    await reset(request);
    await ocrCfg(request, 'pin=');
    await page.setInputFiles('#fileInput', file);
    await submitPin(page, PIN);
    await expect(page.locator('#readStatus')).toContainText('ยังไม่ได้ตั้งรหัส');
    expect(await ocrLog(request)).toHaveLength(0);
  });

  test('รูปใหญ่ถูกย่อ ≤ 2000px / base64 ≤ 5 MB ก่อนส่ง · EXIF orientation ถูกเคารพ · HEIC ที่เบราว์เซอร์อ่านไม่ได้ = ข้อความชัดเจน ไม่ส่งคำขอ', async ({ page }) => {
    const { ocrReqs } = await openPage(page, 'extract-text.html');
    const r = await page.evaluate(async () => {
      const cv = document.createElement('canvas'); cv.width = 3200; cv.height = 2400;
      const ctx = cv.getContext('2d'), id = ctx.createImageData(cv.width, cv.height);
      for (let i = 0; i < id.data.length; i += 4) { id.data[i] = Math.random() * 255; id.data[i + 1] = Math.random() * 255; id.data[i + 2] = Math.random() * 255; id.data[i + 3] = 255; }
      ctx.putImageData(id, 0, 0);
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
      const out = await TanotOcr.shrinkImage(new File([blob], 'noise.png', { type: 'image/png' }));
      const bmp = await createImageBitmap(out);
      return { src: blob.size, type: out.type, size: out.size, w: bmp.width, h: bmp.height };
    });
    expect(r.src).toBeGreaterThan(5000000);
    expect(r.type).toBe('image/jpeg');
    expect(Math.ceil(r.size / 3) * 4).toBeLessThanOrEqual(5000000);
    expect(Math.max(r.w, r.h)).toBeLessThanOrEqual(2000);
    expect(r.w / r.h).toBeCloseTo(3200 / 2400, 1);

    // JPEG 40×20 ที่มี EXIF Orientation=6 (หมุน 90° ตามเข็ม) → ผลต้องเป็น 20×40
    const exif = await page.evaluate(async () => {
      const cv = document.createElement('canvas'); cv.width = 40; cv.height = 20;
      cv.getContext('2d').fillStyle = '#f00'; cv.getContext('2d').fillRect(0, 0, 40, 20);
      const jpg = new Uint8Array(await (await new Promise((res) => cv.toBlob(res, 'image/jpeg'))).arrayBuffer());
      const app1 = [0xFF, 0xE1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49, 0x2A, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0];
      const withExif = new Uint8Array(jpg.length + app1.length);
      withExif.set(jpg.slice(0, 2), 0); withExif.set(app1, 2); withExif.set(jpg.slice(2), 2 + app1.length);
      const out = await TanotOcr.shrinkImage(new File([withExif], 'rot.jpg', { type: 'image/jpeg' }));
      const bmp = await createImageBitmap(out);
      return { w: bmp.width, h: bmp.height };
    });
    expect(exif).toEqual({ w: 20, h: 40 });

    // HEIC ที่ Chromium ถอดรหัสไม่ได้ → เลือก Claude แล้วขึ้นข้อความ ไม่มี dialog ไม่มีคำขอ
    await page.click('#engToggle [data-oe=vision]');
    await page.setInputFiles('#fileInput', { name: 'x.png', mimeType: 'image/heic', buffer: Buffer.from('not an image at all') });
    await expect(page.locator('#readStatus')).toContainText('JPEG');
    await expect(dialog(page)).toHaveCount(0);
    expect(ocrReqs).toHaveLength(0);
  });

  test('PDF สแกน (ไม่มีเลเยอร์ข้อความ) + Claude → ส่งทั้งไฟล์เป็น pdfBase64 ครั้งเดียว · ผลแยกหน้า "--- หน้า N ---" · PDF ที่มีข้อความจริงใช้ข้อความฟรี ไม่ถามรหัส', async ({ page, request }) => {
    const { ocrReqs, errors } = await openPage(page, 'extract-text.html');
    await page.click('#engToggle [data-oe=vision]');

    await page.setInputFiles('#fileInput', { name: 'scan.pdf', mimeType: 'application/pdf', buffer: await pdfBytes(2, false) });
    await submitPin(page, PIN);
    await expect(page.locator('#resultText')).toHaveValue(/--- หน้า 1 ---\nหน้าแรก\n\n--- หน้า 2 ---\nหน้าสอง/);
    expect(ocrReqs).toHaveLength(1);
    expect(ocrReqs[0].body.imageBase64).toBeUndefined();
    expect(Buffer.from(ocrReqs[0].body.pdfBase64, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    expect(ocrReqs[0].body.pageStart).toBe(1);
    const log = await ocrLog(request);
    expect(log[0].blocks.map((b) => b.type)).toEqual(['document', 'text', 'text']);

    await page.setInputFiles('#fileInput', { name: 'text.pdf', mimeType: 'application/pdf', buffer: await pdfBytes(1, true) });
    await expect(page.locator('#resultText')).toHaveValue(/Hello page 1 receipt/);
    await expect(dialog(page)).toHaveCount(0);
    expect(ocrReqs).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('PDF เกิน 100 หน้า → แบ่งเป็นช่วงหน้า (100/100/5) ส่งทีละท่อน เลขหน้าต่อเนื่อง · ถามรหัสครั้งเดียวต่อไฟล์', async ({ page, request }) => {
    const { ocrReqs } = await openPage(page, 'extract-text.html');
    await page.click('#engToggle [data-oe=vision]');
    await page.setInputFiles('#fileInput', { name: 'big.pdf', mimeType: 'application/pdf', buffer: await pdfBytes(205, false) });
    await submitPin(page, PIN);
    await expect(page.locator('#readStatus')).toContainText('ดึงข้อความ', { timeout: 60000 });
    expect(ocrReqs.map((r) => r.body.pageStart)).toEqual([1, 101, 201]);
    expect(new Set(ocrReqs.map((r) => r.headers['x-ocr-pin']))).toEqual(new Set([PIN]));
    const log = await ocrLog(request);
    expect(log.map((l) => l.blocks[2].text.match(/คือหน้า (\d+)/)[1])).toEqual(['1', '101', '201']);
    // แต่ละท่อนเป็น PDF ที่เปิดได้และมีจำนวนหน้าตามช่วง
    const counts = [];
    for (const r of ocrReqs) counts.push((await PDFDocument.load(Buffer.from(r.body.pdfBase64, 'base64'))).getPageCount());
    expect(counts).toEqual([100, 100, 5]);
  });
});

test.describe('doc-check-file (โฮสต์ pages.dev) — Claude Vision + โหมดแม่นยำของ Tesseract', () => {
  test.beforeEach(async ({ request }) => { await reset(request); });

  test('เลือก Claude Vision (จำค่าในช่อง tanot:ocrengine) → รูป: dialog → ข้อความขึ้นหน้า · PDF สแกน: ส่งทั้งไฟล์ แยกเป็น 2 หน้า · ยกเลิกแล้วไม่มีคำขอ', async ({ page }) => {
    const { ocrReqs, errors } = await openPage(page, 'doc-check-file.html', { host: PAGES_HOST });
    await expect(page.locator('#ocrEngineToggle')).toBeVisible();
    await page.click('#ocrEngineToggle [data-oe=vision]');
    await expect(page.locator('#accChk')).toBeHidden();

    await page.setInputFiles('#fileInput', { name: 'a.png', mimeType: 'image/png', buffer: PNG_1X1 });
    await dialog(page).locator('[data-k=cancel]').click();
    await expect(page.locator('#statusMsg')).toContainText('ยกเลิก');
    expect(ocrReqs).toHaveLength(0);

    await page.setInputFiles('#fileInput', { name: 'a.png', mimeType: 'image/png', buffer: PNG_1X1 });
    await submitPin(page, PIN);
    await expect(page.locator('#docText')).toContainText('ข้อความจากรูป');
    expect(ocrReqs).toHaveLength(1);
    expect(ocrReqs[0].body.mediaType).toBe('image/jpeg');

    await page.click('#replaceFileBtn');
    await page.setInputFiles('#fileInput', { name: 'scan.pdf', mimeType: 'application/pdf', buffer: await pdfBytes(2, false) });
    await submitPin(page, PIN);
    await expect(page.locator('#pageIndicator')).toContainText('1 / 2');
    await expect(page.locator('#docText')).toHaveText('หน้าแรก');
    await page.click('#nextBtn');
    await expect(page.locator('#docText')).toHaveText('หน้าสอง');
    expect(ocrReqs).toHaveLength(2);
    expect(Buffer.from(ocrReqs[1].body.pdfBase64, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    expect(errors).toEqual([]);
  });

  test('โหมดฟรี: ค่าเริ่มต้นสร้าง worker แบบเดิม · ติ๊ก "แม่นยำ" → tessdata_best 4.1.0 แบบไม่บีบอัด + cachePath แยก (ไม่ชนแคชเดิม) แล้วปิดตัวเดิม · ภาพที่ส่งเป็น PNG จาก Worker เตรียมภาพ', async ({ page }) => {
    const { ocrReqs, errors } = await openPage(page, 'doc-check-file.html', { host: PAGES_HOST });
    await page.evaluate(() => localStorage.setItem('tanot:ocrengine', 'tesseract'));
    await page.reload();
    const png = { name: 'a.png', mimeType: 'image/png', buffer: PNG_1X1 };
    await page.setInputFiles('#fileInput', png);
    await expect(page.locator('#docText')).toContainText('ข้อความ tesseract');
    let cw = await page.evaluate(() => window.__cw);
    expect(cw).toHaveLength(1);
    expect(cw[0]).toEqual({ langs: 'eng+tha', oem: 1, opts: null });
    const rec = await page.evaluate(() => window.__rec);
    expect(rec[0].ctor).toBe('Blob');
    expect(rec[0].type).toBe('image/png');

    await page.click('#replaceFileBtn');
    await page.check('#accChk');
    await page.setInputFiles('#fileInput', png);
    await expect.poll(() => page.evaluate(() => window.__rec.length)).toBe(2);
    cw = await page.evaluate(() => window.__cw);
    expect(cw).toHaveLength(2);
    expect(cw[1].opts).toEqual({ langPath: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/4.1.0', gzip: false, cachePath: 'tessdata_best_4.1.0' });
    await expect.poll(() => page.evaluate(() => window.__term)).toBe(1);
    expect(ocrReqs).toHaveLength(0);
    expect(errors).toEqual([]);
  });

  test('ไม่มี OffscreenCanvas → เตรียมภาพบนเธรดหลักแทน (ยังใช้ได้ ส่ง canvas ที่ขยายเป็น 1800px ให้ Tesseract)', async ({ page }) => {
    await openPage(page, 'doc-check-file.html', { host: PAGES_HOST, noOffscreen: true });
    await page.evaluate(() => localStorage.setItem('tanot:ocrengine', 'tesseract'));
    await page.reload();
    await page.setInputFiles('#fileInput', { name: 'a.png', mimeType: 'image/png', buffer: PNG_1X1 });
    await expect(page.locator('#docText')).toContainText('ข้อความ tesseract');
    const rec = await page.evaluate(() => window.__rec[0]);
    expect(rec.ctor).toBe('HTMLCanvasElement');
    expect(Math.max(rec.w, rec.h)).toBe(1800);
  });

  test('ภาพถ่ายแสงไล่เฉด 3200×2400 → เตรียมใน Worker: ผลเป็น PNG ขาวดำล้วน ด้านยาว 2600 และหน้าไม่ค้าง (long task < 300 ms)', async ({ page }) => {
    await openPage(page, 'doc-check-file.html', { host: PAGES_HOST });
    const res = await page.evaluate(async () => {
      const cv = document.createElement('canvas'); cv.width = 3200; cv.height = 2400;
      const ctx = cv.getContext('2d'), g = ctx.createLinearGradient(0, 0, 3200, 0);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#6a6a6a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 3200, 2400);
      ctx.fillStyle = '#111'; for (let y = 80; y < 2300; y += 70) for (let x = 100; x < 3000; x += 60) ctx.fillRect(x, y, 30, 30);
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      let worst = 0;
      const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => { worst = Math.max(worst, e.duration); }));
      try { po.observe({ entryTypes: ['longtask'] }); } catch (e) {}
      const out = await TanotFileReader.prepareOcrImage(() => createImageBitmap(blob), { source: 'photo' });
      await new Promise((r) => setTimeout(r, 100));
      po.disconnect();
      const bmp = await createImageBitmap(out);
      const c2 = document.createElement('canvas'); c2.width = bmp.width; c2.height = bmp.height;
      const x2 = c2.getContext('2d'); x2.drawImage(bmp, 0, 0);
      const d = x2.getImageData(0, 0, c2.width, c2.height).data;
      let nonBw = 0, ink = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i] !== 0 && d[i] !== 255) nonBw++; else if (d[i] === 0) ink++; }
      return { ctor: out.constructor.name, w: bmp.width, h: bmp.height, nonBw, ink: ink / (c2.width * c2.height), worst };
    });
    expect(res.ctor).toBe('Blob'); // มาจาก Worker
    expect(Math.max(res.w, res.h)).toBe(2600);
    expect(res.nonBw).toBe(0);
    // หมึก ≈ 30×30 ในช่อง 60×70 ≈ 21% ถ้าเกณฑ์ทั้งภาพจะดำ/ขาวทั้งซีก — Sauvola ต้องเก็บหมึกทั้งสองซีก (ไม่ใช่ 0 หรือกลายเป็นดำเกือบหมด)
    expect(res.ink).toBeGreaterThan(0.15);
    expect(res.ink).toBeLessThan(0.3);
    expect(res.worst).toBeLessThan(300);
  });
});

test.describe('receipts — PDF สแกนส่งทั้งไฟล์ให้ Claude', () => {
  test.beforeEach(async ({ request }) => { await reset(request); });

  test('PDF หน้าแรกไม่มีข้อความ → ปุ่ม Claude ส่ง pdfBase64 พร้อม prompt ใบเสร็จ (ไม่มีตัวคั่นหน้า) หลังกรอกรหัส · PDF ที่มีข้อความ → ส่งภาพหน้าแรกเหมือนเดิม', async ({ page, request }) => {
    const { ocrReqs, errors } = await openPage(page, 'receipts.html');
    await page.evaluate(() => { window.TANOT_FILES = undefined; });
    await page.click('#addBtn');
    await page.setInputFiles('#fileInput', { name: 'scan.pdf', mimeType: 'application/pdf', buffer: await pdfBytes(1, false) });
    await expect(page.locator('#claudeBtn')).toBeEnabled();
    await page.click('#claudeBtn');
    await submitPin(page, PIN);
    await expect(page.locator('#readMsg')).toContainText('อ่านไม่ได้'); // ตัวหลอกคืนข้อความที่ไม่ใช่ JSON — สนใจแค่รูปแบบคำขอ
    expect(ocrReqs).toHaveLength(1);
    expect(Buffer.from(ocrReqs[0].body.pdfBase64, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    expect(ocrReqs[0].body.imageBase64).toBeUndefined();
    let log = await ocrLog(request);
    expect(log[0].blocks.map((b) => b.type)).toEqual(['document', 'text']);
    expect(log[0].blocks[1].text).toContain('JSON');

    await page.click('#cancelBtn');
    await page.click('#addBtn');
    await page.setInputFiles('#fileInput', { name: 'text.pdf', mimeType: 'application/pdf', buffer: await pdfBytes(1, true) });
    await expect(page.locator('#claudeBtn')).toBeEnabled();
    await page.click('#claudeBtn');
    await submitPin(page, PIN);
    await expect(page.locator('#readMsg')).toContainText('อ่านไม่ได้');
    expect(ocrReqs).toHaveLength(2);
    expect(ocrReqs[1].body.pdfBase64).toBeUndefined();
    expect(ocrReqs[1].body.mediaType).toBe('image/jpeg');
    expect(errors).toEqual([]);
  });
});

test.describe('dialog รหัส — ตัวตรวจธีม/ภาษา/มือถือ', () => {
  test.beforeEach(async ({ request }) => { await reset(request); });
  const AUDIT_JS = path.join(__dirname, 'theme-audit-page.js');
  const counts = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.length : v]));

  for (const [lang, theme, width] of [['th', 'light', 390], ['en', 'dark', 390], ['th', 'dark', 360], ['en', 'light', 1100]]) {
    test(`เปิด dialog รหัส ${lang}/${theme}/${width}px — ทุกตัวชี้วัดเป็น 0 ทั้งก่อน/หลังเปิด · ไม่ล้นจอ · ไทยไม่หลุดตอน EN · ปิดด้วยแตะนอกกล่อง/Esc`, async ({ page }) => {
      await page.addInitScript(([l, t]) => { try { localStorage.setItem('ome:lang', l); localStorage.setItem('ome:theme', t); } catch (e) {} }, [lang, theme]);
      await page.setViewportSize({ width, height: 800 });
      await openPage(page, 'extract-text.html');
      await page.addScriptTag({ path: AUDIT_JS });
      const measure = async () => {
        const a = await page.evaluate((m) => window.__tanotAudit.audit({ mobile: m }), width < 700);
        const m = width < 700 ? await page.evaluate(() => window.__tanotAudit.mobile({ shell: false })) : {};
        return counts({ contrast: a.contrast, controlBorder: a.controlBorder, nonCentral: a.nonCentral, targetSize: width < 700 ? a.targetSize : [], ...m });
      };
      const before = await measure();
      for (const k of Object.keys(before)) expect(before[k], 'before ' + k).toBe(0);
      await page.click('#engToggle [data-oe=vision]');
      await page.setInputFiles('#fileInput', { name: 'a.png', mimeType: 'image/png', buffer: PNG_1X1 });
      await expect(dialog(page)).toBeVisible();
      const after = await measure();
      for (const k of Object.keys(after)) expect(after[k], k).toBe(0);
      const box = await dialog(page).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(800);
      const input = dialog(page).locator('input');
      if (width < 700) expect(await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
      if (lang === 'en') {
        expect(await page.evaluate(() => window.__tanotAudit.thaiInEn({ excludeShell: true }))).toEqual([]);
        await expect(dialog(page).locator('[data-k=send]')).toHaveText('Use Claude Vision');
      } else {
        await expect(dialog(page).locator('[data-k=send]')).toHaveText('ใช้ Claude Vision');
      }
      // แตะนอกกล่องปิดได้ (ยังไม่พิมพ์) · เปิดใหม่ → Esc ปิด · ทั้งสองครั้งไม่ส่งคำขอ
      await page.mouse.click(2, 2);
      await expect(page.locator('dialog[data-ocrv]')).toHaveCount(0);
      await page.setInputFiles('#fileInput', { name: 'a.png', mimeType: 'image/png', buffer: PNG_1X1 });
      await expect(dialog(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[data-ocrv]')).toHaveCount(0);
    });
  }

  for (const [theme, width] of [['light', 390], ['dark', 360], ['light', 1100]]) {
    test(`doc-check-file บน pages.dev (แถวเลือก Claude + ติ๊กแม่นยำ) ${theme}/${width}px — ทุกตัวชี้วัดเป็น 0`, async ({ page }) => {
      await page.addInitScript((t) => { try { localStorage.setItem('ome:theme', t); } catch (e) {} }, theme);
      await page.setViewportSize({ width, height: 800 });
      await openPage(page, 'doc-check-file.html', { host: PAGES_HOST });
      await page.addScriptTag({ path: path.join(__dirname, 'theme-audit-page.js') });
      await expect(page.locator('#ocrEngineToggle')).toBeVisible();
      await expect(page.locator('#accChk')).toBeVisible();
      const a = await page.evaluate((m) => window.__tanotAudit.audit({ mobile: m }), width < 700);
      const m = width < 700 ? await page.evaluate(() => window.__tanotAudit.mobile({ shell: false })) : {};
      const all = counts({ contrast: a.contrast, controlBorder: a.controlBorder, nonCentral: a.nonCentral, targetSize: width < 700 ? a.targetSize : [], ...m });
      for (const k of Object.keys(all)) expect(all[k], k).toBe(0);
    });
  }

  test('พิมพ์รหัสบางส่วนแล้วแตะนอกกล่อง → ไม่ปิด (กันรหัสที่กรอกหาย) · Esc ยังปิดได้', async ({ page }) => {
    await openPage(page, 'extract-text.html');
    await page.click('#engToggle [data-oe=vision]');
    await page.setInputFiles('#fileInput', { name: 'a.png', mimeType: 'image/png', buffer: PNG_1X1 });
    await dialog(page).locator('input').fill('12');
    await page.mouse.click(2, 2);
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[data-ocrv]')).toHaveCount(0);
  });
});
