// สร้างภาพ (image-gen.html + functions/api/ai/image.js)
// 1) ฝั่งเซิร์ฟเวอร์: image.js ตัวจริงบน SQLite + R2 ตัวหลอก + FLUX ตัวหลอก (sync-server.mjs พอร์ต 8139) — allowlist, ต่อท้าย prompt, โควตา, เก็บไฟล์
// 2) ฝั่งหน้าเว็บ: mock /api/ai/image, /api/files, /api/ai/usage, /api/ai/chat ด้วย page.route
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');
const fs = require('fs');
const path = require('path');

const SRV = 'http://localhost:8139';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/* ── ภาพอ้างอิง ("แก้ภาพนี้", klein-4b input_image_0) ──
   ไฟล์ทดสอบสร้างเฉพาะส่วนหัว (เซิร์ฟเวอร์อ่านกว้าง/สูงจาก header อย่างเดียว FLUX ตัวหลอกไม่ถอดภาพ) */
function pngHead(w, h, total = 64) {
  const b = Buffer.alloc(Math.max(total, 33));
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'latin1'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  b[24] = 8; b[25] = 6;
  return b;
}
function jpegHead(w, h) {
  // SOI + APP0 (JFIF, ยาว 16) + SOF0 (ยาว 17: precision, height, width, 3 components)
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return Buffer.from([0xff, 0xd8, ...app0, ...sof, 0xff, 0xd9]);
}
const b64 = (buf) => buf.toString('base64');
/* ตัวโหลดของ Playwright อ่าน .js ใต้ repo เป็น CommonJS — ตัด "export" ออกแล้วรัน (แบบเดียวกับ hf.spec.js; ไฟล์ที่ไม่มี import) */
function loadEsm(rel, names) {
  let src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  for (const n of names) expect(src, rel + ' export ' + n).toMatch(new RegExp('export (async )?(function|const) ' + n + '\\b'));
  expect(src).not.toMatch(/^import /m);
  return new Function(src.replace(/^export /gm, '') + '\nreturn { ' + names.join(', ') + ' };')();
}

test.describe('เซิร์ฟเวอร์ /api/ai/image', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });
  const gen = (request, data) => request.post(SRV + '/api/ai/image', { data });
  const log = async (request) => (await request.get(SRV + '/__ailog')).json();

  test('allowlist: prompt ว่าง/ยาวเกิน/preset/mode/model นอกรายการ → 400 และไม่เรียกโมเดล', async ({ request }) => {
    const bad = [
      {}, { prompt: '   ' }, { prompt: 'x'.repeat(1501) },
      { prompt: 'a', preset: 'poster' }, { prompt: 'a', mode: 'sepia' }, { prompt: 'a', model: 'huge' },
      { prompt: 'a', model: '__proto__' }, { prompt: 'a', preset: 'constructor' },
    ];
    for (const b of bad) expect((await gen(request, b)).status(), JSON.stringify(b).slice(0, 40)).toBe(400);
    expect((await gen(request, { prompt: 'x'.repeat(1500), preset: 'free' })).status()).toBe(200);
    expect(await log(request)).toHaveLength(1);
  });

  test('คำขอข้ามโดเมน (Origin แปลก) ถูกปฏิเสธ', async ({ request }) => {
    const res = await request.post(SRV + '/api/ai/image', { data: { prompt: 'a' }, headers: { Origin: 'https://evil.example' } });
    expect(res.status()).toBe(403);
    expect(await log(request)).toHaveLength(0);
  });

  test('quality + background + light: multipart 1024×576, ต่อท้ายสไตล์พื้นหลัง + โทนสว่าง', async ({ request }) => {
    const res = await gen(request, { prompt: 'blue hills', preset: 'background', mode: 'light', model: 'quality', seed: 123 });
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j).toMatchObject({ model: '@cf/black-forest-labs/flux-2-klein-4b', seed: 123, width: 1024, height: 576, mime: 'image/png', preset: 'background', mode: 'light' });
    const [call] = await log(request);
    expect(call.model).toBe('@cf/black-forest-labs/flux-2-klein-4b');
    expect(call.fields).toMatchObject({ width: '1024', height: '576', seed: '123' });
    expect(call.fields.prompt).toBe('blue hills, soft minimal illustration, muted colors, subtle and calm, large empty negative space on the left and center, objects only near the right edge, no people, no hands, no faces, no text, no letters, no numbers, no logo, no watermark, light airy pastel tones on an off-white background, bright and clean');
    expect(j.prompt).toBe(call.fields.prompt);
  });

  test('fast + background + dark: JSON prompt/steps เท่านั้น (ไม่ส่ง seed/ขนาด), ได้ 1024×1024, seed = null', async ({ request }) => {
    const j = await (await gen(request, { prompt: 'moon', preset: 'background', mode: 'dark', model: 'fast', seed: 5 })).json();
    expect(j).toMatchObject({ model: '@cf/black-forest-labs/flux-1-schnell', seed: null, width: 1024, height: 1024 });
    const [call] = await log(request);
    expect(Object.keys(call.input).sort()).toEqual(['prompt', 'steps']);
    expect(call.input.steps).toBe(4);
    expect(call.input.prompt).toContain('deep dark charcoal and navy tones, low contrast, quiet night mood');
    expect(call.input.prompt).not.toContain('off-white');
  });

  test('icon ต่อท้ายสไตล์ไอคอน 1:1 (ไม่มีโทนสว่าง/มืด) · free ไม่ต่อท้าย', async ({ request }) => {
    await gen(request, { prompt: 'a leaf', preset: 'icon', mode: 'dark', model: 'quality' });
    await gen(request, { prompt: 'a cat', preset: 'free', model: 'quality' });
    const [icon, free] = await log(request);
    expect(icon.fields.prompt).toBe('a leaf, app icon, flat vector style, one simple bold symbol centered, symbol fills about 60 percent of the canvas with generous even margin, solid flat background color filling the whole square edge to edge, no border, no frame, no shadow, no text, no letters, crisp clean edges, readable when very small');
    expect(icon.fields).toMatchObject({ width: '1024', height: '1024' });
    expect(free.fields.prompt).toBe('a cat');
  });

  test('เก็บภาพลง R2 ns images + ดัชนี D1, ดึง/ลบผ่าน /api/files ได้, บันทึกโควตา kind image', async ({ request }) => {
    const j = await (await gen(request, { prompt: 'a', preset: 'icon', model: 'quality' })).json();
    expect((await request.get(SRV + '/__files')).json()).resolves.toEqual([expect.stringMatching(/^images\/[0-9a-f-]{36}$/)]);
    expect(j.name).toMatch(/^image-icon-.+\.png$/);
    const got = await request.get(SRV + '/api/files?id=' + j.id);
    expect(got.status()).toBe(200);
    expect(got.headers()['content-type']).toBe('image/png');
    expect(Buffer.compare(await got.body(), PNG)).toBe(0);
    const u = await (await request.get(SRV + '/api/ai/usage')).json();
    const k = u.byKind.find((x) => x.kind === 'image');
    expect(k.requests).toBe(1);
    expect(k.neurons).toBeCloseTo(j.neurons, 1);
    expect(u.used).toBeGreaterThan(0);
    expect((await request.delete(SRV + '/api/files?id=' + j.id)).status()).toBe(200);
    expect((await request.get(SRV + '/api/files?id=' + j.id)).status()).toBe(404);
  });

  test('โควตา: ประเมินเกินเพดาน → 429 code quota ก่อนเรียกโมเดล · Workers AI ตอบโควตาหมด → 429', async ({ request }) => {
    await request.get(SRV + '/__ai?limit=50');
    const r1 = await gen(request, { prompt: 'a', model: 'quality' });
    expect(r1.status()).toBe(429);
    expect((await r1.json()).code).toBe('quota');
    expect(await log(request)).toHaveLength(0);
    await request.get(SRV + '/__ai?limit=');
    await request.get(SRV + '/__ai?mode=quota');
    const r2 = await gen(request, { prompt: 'a', model: 'fast' });
    expect(r2.status()).toBe(429);
    expect((await r2.json()).code).toBe('quota');
    expect((await request.get(SRV + '/__files')).json()).resolves.toEqual([]);
    await request.get(SRV + '/__ai?mode=down');
    expect((await gen(request, { prompt: 'a' })).status()).toBe(502);
  });

  test.describe('เซิร์ฟเวอร์ /api/ai/image — ภาพอ้างอิง', () => {

    test('imageNeurons: นับ tile ขาเข้า 5.37/tile (known-answer) · ไม่มีภาพอ้างอิง = ค่าเดิม', async () => {
      const { MODELS, imageNeurons } = loadEsm('functions/_lib/ai.js', ['MODELS', 'imageNeurons']);
      expect(MODELS.imageQuality.perInputTile).toBe(5.37);
      expect(imageNeurons(MODELS.imageQuality, 1024, 1024)).toBe(130.25);            // 4 × 26.05 × 1.25
      expect(imageNeurons(MODELS.imageQuality, 1024, 1024, [])).toBe(130.25);
      expect(imageNeurons(MODELS.imageQuality, 1024, 1024, [{ width: 512, height: 384 }])).toBe(136.97); // (104.2 + 5.37) × 1.25 = 136.9625 ↑
      expect(imageNeurons(MODELS.imageQuality, 1024, 576, [{ width: 512, height: 512 }])).toBe(136.97);  // 576 ปัดขึ้นเป็น 2 แถว = 4 tile เท่า 1024×1024
      expect(imageNeurons(MODELS.imageQuality, 1024, 1024, [{ width: 513, height: 100 }])).toBe(143.68);  // 2 tile ขาเข้า
      expect(imageNeurons(MODELS.imageFast, 1024, 1024)).toBe(72);                    // (4 × 4.8 + 4 × 9.6) × 1.25 ไม่เปลี่ยน
    });

    test('REF_MAX ฝั่งเซิร์ฟเวอร์ = ฝั่งหน้า (ค่าเดียวกัน)', async () => {
      const srv = fs.readFileSync(path.join(__dirname, '..', 'functions/api/ai/image.js'), 'utf8');
      const REF_MAX = Number((srv.match(/^export const REF_MAX = (\d+);/m) || [])[1]);
      const REF_MAX_BYTES = eval((srv.match(/^export const REF_MAX_BYTES = ([\d *]+);/m) || [])[1]);
      const src = fs.readFileSync(path.join(__dirname, '..', 'image-gen.js'), 'utf8');
      const m = src.match(/var REF_MAX = (\d+);/);
      expect(m && Number(m[1])).toBe(REF_MAX);
      expect(REF_MAX_BYTES).toBe(1024 * 1024);
    });

    test('ref + fast = 400 (ไม่เรียกโมเดล) · ref ผิดรูปแบบ = 400 ตามรหัส', async ({ request }) => {
      const cases = [
        [{ prompt: 'a', model: 'fast', ref: b64(pngHead(100, 100)) }, 'ref_model'],
        [{ prompt: 'a', ref: b64(pngHead(100, 100)) }, 'ref_model'], // model ไม่ส่ง = fast
        [{ prompt: 'a', model: 'quality', ref: b64(Buffer.from('hello, not an image at all')) }, 'ref_type'],
        [{ prompt: 'a', model: 'quality', ref: b64(Buffer.from('RIFF\0\0\0\0WEBPVP8 xxxxxxxx')) }, 'ref_type'],
        [{ prompt: 'a', model: 'quality', ref: '***not base64***' }, 'ref_type'],
        [{ prompt: 'a', model: 'quality', ref: 123 }, 'ref_type'],
        [{ prompt: 'a', model: 'quality', ref: b64(pngHead(513, 100)) }, 'ref_size'],
        [{ prompt: 'a', model: 'quality', ref: b64(pngHead(100, 600)) }, 'ref_size'],
        [{ prompt: 'a', model: 'quality', ref: b64(jpegHead(600, 400)) }, 'ref_size'],
        [{ prompt: 'a', model: 'quality', ref: b64(pngHead(0, 10)) }, 'ref_size'],
        [{ prompt: 'a', model: 'quality', ref: b64(pngHead(100, 100, 1024 * 1024 + 1)) }, 'ref_bytes'],
      ];
      for (const [body, code] of cases) {
        const res = await gen(request, body);
        expect(res.status(), code + ' ' + String(body.ref).slice(0, 20)).toBe(400);
        expect((await res.json()).code).toBe(code);
      }
      expect(await log(request)).toHaveLength(0);
    });

    test('PNG 512×512 พอดี / JPEG ผ่าน: multipart มี input_image_0 + neurons นับ tile ขาเข้า', async ({ request }) => {
      const res = await gen(request, { prompt: 'make it night', preset: 'icon', model: 'quality', seed: 9, ref: b64(pngHead(512, 512, 1024 * 1024)) });
      expect(res.status()).toBe(200);
      const j = await res.json();
      expect(j.neurons).toBe(136.97);
      const [call] = await log(request);
      expect(call.fields).toMatchObject({ prompt: expect.stringContaining('make it night'), width: '1024', height: '1024', seed: '9' });
      expect(call.fields.input_image_0).toEqual({ name: expect.any(String), type: 'image/png', size: 1024 * 1024 });
      const u = await (await request.get(SRV + '/api/ai/usage')).json();
      expect(u.used).toBeCloseTo(136.97, 1);

      const r2 = await gen(request, { prompt: 'b', preset: 'background', model: 'quality', ref: 'data:image/jpeg;base64,' + b64(jpegHead(512, 288)) });
      expect(r2.status()).toBe(200);
      expect((await r2.json()).neurons).toBe(136.97);
      const call2 = (await log(request))[1];
      expect(call2.fields.input_image_0).toMatchObject({ type: 'image/jpeg' });
      // ไม่มีภาพอ้างอิง = ไม่มีฟิลด์ไฟล์
      await gen(request, { prompt: 'c', model: 'quality' });
      expect(Object.keys((await log(request))[2].fields)).not.toContain('input_image_0');
    });

    test('โมเดลปฏิเสธภาพอ้างอิง → 502 พก detail จาก upstream ให้หน้าแสดง', async ({ request }) => {
      await request.get(SRV + '/__ai?mode=down');
      const res = await gen(request, { prompt: 'a', model: 'quality', ref: b64(pngHead(512, 512)) });
      expect(res.status()).toBe(502);
      const j = await res.json();
      expect(j).toMatchObject({ code: 'upstream', detail: 'upstream unavailable' });
    });
  });
});

/* ── หน้าเว็บ (mock ทุก /api/*) ── */
async function setup(page, { theme = 'light' } = {}) {
  const errors = await prepare(page, { theme });
  const st = { used: 100, imageCalls: [], deletes: [], chatCalls: 0, n: 0, imageStatus: 200, delStatus: 200, fileStatus: 200, filePng: null, detail: '' };
  await page.addInitScript(() => { window.TANOT_AI = { enabled: true }; });
  await page.route('**/api/ai/usage', (r) => r.fulfill({ json: { day: '2026-09-30', limit: 10000, used: st.used, remaining: 10000 - st.used, byKind: [] } }));
  await page.route('**/api/ai/image', (r) => {
    const body = r.request().postDataJSON();
    st.imageCalls.push(body);
    if (st.imageStatus === 429) return r.fulfill({ status: 429, json: { error: 'quota', code: 'quota' } });
    if (st.imageStatus === 502) return r.fulfill({ status: 502, json: { error: 'AI request failed: x', code: 'upstream', detail: st.detail } });
    st.used += 60; st.n++;
    return r.fulfill({ json: { id: 'img' + st.n, name: 'image-' + st.n + '.png', mime: 'image/png', size: PNG.length, model: 'm', seed: 7, neurons: 60, width: 1024, height: body.preset === 'background' ? 576 : 1024, preset: body.preset, mode: body.mode, prompt: body.prompt + ', STYLE' } });
  });
  await page.route('**/api/ai/chat', async (r) => {
    st.chatCalls++;
    const sse = 'data: {"t":"a red apple"}\n\ndata: {"done":true,"model":"x","neurons":1}\n\n';
    return r.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: sse });
  });
  await page.route('**/api/files**', (r) => {
    const req = r.request();
    if (req.method() === 'DELETE') {
      st.deletes.push(new URL(req.url()).searchParams.get('id'));
      return r.fulfill({ status: st.delStatus, json: st.delStatus === 200 ? { ok: true } : { error: 'x' } });
    }
    if (st.fileStatus !== 200) return r.fulfill({ status: st.fileStatus, json: { error: 'x' } });
    return r.fulfill({ status: 200, contentType: 'image/png', body: st.filePng || PNG });
  });
  return { errors, st };
}

test.describe('หน้า image-gen.html', () => {
  test('สร้างภาพ → ขึ้นในคลัง + บันทึกข้อมูลกำกับ + โควตาอัปเดต', async ({ page }) => {
    const { errors, st } = await setup(page);
    await page.goto('/image-gen.html');
    await expect(page.locator('#quotaTxt')).toContainText('100');
    await page.fill('#prompt', 'a red apple');
    await page.click('#preset button[data-v="icon"]');
    await page.click('#model button[data-v="quality"]');
    await page.click('#genBtn');
    await expect(page.locator('.ig-item')).toHaveCount(1);
    expect(st.imageCalls).toEqual([{ prompt: 'a red apple', preset: 'icon', mode: 'light', model: 'quality' }]);
    await expect(page.locator('#quotaTxt')).toContainText('160');
    const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:images:items')));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'img1', preset: 'icon', model: 'quality', seed: 7, prompt: 'a red apple', fullPrompt: 'a red apple, STYLE' });
    await expect(page.locator('#genBtn')).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('พื้นหลัง + "ทั้งคู่" → ยิง 2 ครั้ง (light, dark); จำนวน 2 → 4 ครั้ง', async ({ page }) => {
    const { errors, st } = await setup(page);
    await page.goto('/image-gen.html');
    await page.fill('#prompt', 'hills');
    await page.click('#mode button[data-v="both"]');
    await page.click('#genBtn');
    await expect(page.locator('.ig-item')).toHaveCount(2);
    expect(st.imageCalls.map((c) => c.mode)).toEqual(['light', 'dark']);
    expect(st.imageCalls.every((c) => c.preset === 'background')).toBe(true);
    st.imageCalls.length = 0;
    await page.click('#count button[data-v="2"]');
    await page.click('#genBtn');
    await expect(page.locator('.ig-item')).toHaveCount(6);
    expect(st.imageCalls.map((c) => c.mode)).toEqual(['light', 'dark', 'light', 'dark']);
    // โหมดสว่าง/มืดมีเฉพาะพื้นหลัง
    await page.click('#preset button[data-v="icon"]');
    await expect(page.locator('#modeBox')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('โควตาหมด (429) → toast บอกสาเหตุ ปุ่มกลับมาใช้ได้ ไม่มีรายการเพิ่ม', async ({ page }) => {
    const { errors, st } = await setup(page);
    st.imageStatus = 429;
    await page.goto('/image-gen.html');
    await page.fill('#prompt', 'x');
    await page.click('#genBtn');
    await expect(page.locator('.toast.err')).toContainText('โควตา');
    await expect(page.locator('#genBtn')).toBeEnabled();
    await expect(page.locator('.ig-item')).toHaveCount(0);
    // เบราว์เซอร์ log "Failed to load resource: 429" เองทุกครั้งที่ fetch ได้สถานะ 4xx — ไม่ใช่ error ของโค้ด
    expect(errors.filter((e) => !/status of 429/.test(e))).toEqual([]);
  });

  test('ออฟไลน์ → toast ไม่ค้าง', async ({ page, context }) => {
    const { errors } = await setup(page);
    await page.goto('/image-gen.html');
    await page.fill('#prompt', 'x');
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.click('#genBtn');
    await expect(page.locator('.toast.err')).toBeVisible();
    await expect(page.locator('#genBtn')).toBeEnabled();
    await context.setOffline(false);
    expect(errors).toEqual([]);
  });

  test('แปลเป็นอังกฤษ: ใส่ผลกลับในช่อง แก้ต่อได้ · ไม่มีข้อความ = แจ้งเตือน', async ({ page }) => {
    const { errors, st } = await setup(page);
    await page.goto('/image-gen.html');
    await page.click('#trBtn');
    await expect(page.locator('.toast.err')).toBeVisible();
    expect(st.chatCalls).toBe(0);
    await page.fill('#prompt', 'แอปเปิลสีแดง');
    await page.click('#trBtn');
    await expect(page.locator('#prompt')).toHaveValue('a red apple');
    expect(st.chatCalls).toBe(1);
    expect(st.imageCalls).toHaveLength(0);
    expect(errors).toEqual([]);
  });

  test('คลัง: กรองตาม preset, เปิดดูภาพใหญ่ + prompt + seed, สร้างซ้ำแบบนี้, ดาวน์โหลด', async ({ page }) => {
    const { errors } = await setup(page);
    await page.addInitScript(() => {
      if (localStorage.getItem('tanot:images:items')) return;
      localStorage.setItem('tanot:images:items', JSON.stringify([
        { id: 'a1', preset: 'icon', mode: null, model: 'quality', seed: 11, prompt: 'leaf', fullPrompt: 'leaf, app icon', name: 'a1.png', mime: 'image/png', w: 1024, h: 1024, createdAt: 1000 },
        { id: 'b2', preset: 'background', mode: 'dark', model: 'fast', seed: null, prompt: 'hills', fullPrompt: 'hills, soft', name: 'b2.png', mime: 'image/png', w: 1024, h: 1024, createdAt: 2000 },
      ]));
    });
    await page.goto('/image-gen.html');
    await expect(page.locator('.ig-item')).toHaveCount(2);
    await expect(page.locator('.ig-item').first()).toHaveAttribute('data-id', 'b2'); // ล่าสุดก่อน
    await page.click('#filter button[data-v="icon"]');
    await expect(page.locator('.ig-item')).toHaveCount(1);
    await page.click('.ig-item');
    await expect(page.locator('#view')).toBeVisible();
    await expect(page.locator('#vPrompt')).toHaveText('leaf, app icon');
    await expect(page.locator('#vMeta')).toContainText('seed 11');
    await expect(page.locator('#vDl')).toHaveAttribute('href', /id=a1&download=1/);
    await page.click('#vAgain');
    await expect(page.locator('#view')).toBeHidden();
    await expect(page.locator('#prompt')).toHaveValue('leaf');
    await expect(page.locator('#preset button[data-v="icon"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#model button[data-v="quality"]')).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  });

  test('ลบภาพ: ยืนยันก่อน → DELETE /api/files + ลบรายการ · ยกเลิกไม่ลบ · ลบไฟล์ไม่สำเร็จ = เก็บรายการไว้', async ({ page }) => {
    const { errors, st } = await setup(page);
    await page.goto('/image-gen.html');
    await page.fill('#prompt', 'x');
    await page.click('#genBtn');
    await expect(page.locator('.ig-item')).toHaveCount(1);
    await page.click('.ig-item');
    await page.click('#vDel');
    await page.getByRole('button', { name: 'ยกเลิก' }).click();
    expect(st.deletes).toEqual([]);
    await expect(page.locator('.ig-item')).toHaveCount(1);

    st.delStatus = 500;
    await page.click('#vDel');
    await page.getByRole('button', { name: 'ลบ', exact: true }).last().click();
    await expect(page.locator('.toast.err')).toBeVisible();
    await expect(page.locator('.ig-item')).toHaveCount(1);

    st.delStatus = 200;
    await page.click('#vDel');
    await page.getByRole('button', { name: 'ลบ', exact: true }).last().click();
    await expect(page.locator('.ig-item')).toHaveCount(0);
    expect(st.deletes).toEqual(['img1', 'img1']);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:images:items')))).toEqual([]);
    await expect(page.locator('#empty')).toBeVisible();
    expect(errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
  });

  const SEED2 = () => {
    if (localStorage.getItem('tanot:images:items')) return;
    localStorage.setItem('tanot:images:items', JSON.stringify([
      { id: 'b2', preset: 'background', mode: 'dark', model: 'fast', seed: null, prompt: 'hills', fullPrompt: 'hills, soft', name: 'b2.png', mime: 'image/png', w: 1024, h: 576, createdAt: 2000 },
    ]));
  };
  // PNG ขนาดจริง (สร้างด้วย canvas ในหน้า) ไว้ให้ /api/files ตอบ — ตรวจว่าหน้าย่อด้านยาวเหลือ ≤ 512
  const bigPng = (page, w, h) => page.evaluate(([w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#336699'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffcc00'; g.fillRect(w / 2, 0, w / 2, h / 2);
    return c.toDataURL('image/png').split(',')[1];
  }, [w, h]).then((b) => Buffer.from(b, 'base64'));
  const pngSize = (b64) => { const b = Buffer.from(b64, 'base64'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

  test('แก้ภาพนี้: ชิปภาพอ้างอิง + ล็อกคุณภาพ → ส่ง ref ที่ย่อเหลือ ≤ 512 · แถวมี refId · ลบชิปคืนโมเดลเดิม', async ({ page }) => {
    const { errors, st } = await setup(page);
    await page.addInitScript(SEED2);
    await page.goto('/image-gen.html');
    st.filePng = await bigPng(page, 1024, 576);
    await expect(page.locator('#refBox')).toBeHidden();
    await page.click('.ig-item');
    await page.click('#vEdit');
    await expect(page.locator('#view')).toBeHidden();
    await expect(page.locator('#refBox')).toBeVisible();
    await expect(page.locator('#refImg')).toHaveAttribute('src', /id=b2/);
    await expect(page.locator('#refDel')).toHaveAttribute('aria-label', 'เอาภาพอ้างอิงออก');
    await expect(page.locator('#prompt')).toHaveValue('');
    await expect(page.locator('#prompt')).toBeFocused();
    await expect(page.locator('#model button[data-v="quality"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#model button[data-v="fast"]')).toBeDisabled();
    await expect(page.locator('#preset button[data-v="background"]')).toHaveAttribute('aria-pressed', 'true');
    await page.fill('#prompt', 'make it night');
    await page.click('#genBtn');
    await expect(page.locator('.ig-item')).toHaveCount(2);
    expect(st.imageCalls).toHaveLength(1);
    const call = st.imageCalls[0];
    expect(call).toMatchObject({ prompt: 'make it night', preset: 'background', mode: 'dark', model: 'quality' });
    expect(pngSize(call.ref)).toEqual([512, 288]);
    const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:images:items')));
    expect(rows.find((x) => x.id === 'img1')).toMatchObject({ refId: 'b2', model: 'quality' });
    expect(rows.find((x) => x.id === 'b2').refId).toBeUndefined();
    // ชิปยังอยู่ให้แก้ต่อ · ลบชิป → โมเดลเดิม (เร็ว) + ไม่ส่ง ref
    await expect(page.locator('#refBox')).toBeVisible();
    await page.click('#refDel');
    await expect(page.locator('#refBox')).toBeHidden();
    await expect(page.locator('#model button[data-v="fast"]')).toBeEnabled();
    await expect(page.locator('#model button[data-v="fast"]')).toHaveAttribute('aria-pressed', 'true');
    await page.click('#genBtn');
    await expect(page.locator('.ig-item')).toHaveCount(3);
    expect(st.imageCalls[1].model).toBe('fast');
    expect(st.imageCalls[1].ref).toBeUndefined();
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('tanot:images:ui'))).model).toBe('fast');
    // "สร้างซ้ำแบบนี้" ของภาพที่แก้มา = ใส่ภาพอ้างอิงเดิมกลับ
    await page.click('.ig-item[data-id="img1"]');
    await page.click('#vAgain');
    await expect(page.locator('#refBox')).toBeVisible();
    await expect(page.locator('#prompt')).toHaveValue('make it night');
    expect(errors).toEqual([]);
  });

  test('แก้ภาพนี้: ภาพเล็กไม่ขยาย · โหลดภาพอ้างอิงไม่ได้ = toast ไม่ยิงโมเดล · โมเดลปฏิเสธ = ข้อความ + detail', async ({ page }) => {
    const { errors, st } = await setup(page);
    await page.addInitScript(SEED2);
    await page.goto('/image-gen.html');
    st.filePng = await bigPng(page, 300, 200);
    await page.click('.ig-item'); await page.click('#vEdit');
    await page.fill('#prompt', 'x');
    await page.click('#genBtn');
    await expect(page.locator('.ig-item')).toHaveCount(2);
    expect(pngSize(st.imageCalls[0].ref)).toEqual([300, 200]);

    st.fileStatus = 404;
    await page.click('#genBtn');
    await expect(page.locator('.toast.err')).toContainText('โหลดภาพอ้างอิงไม่ได้');
    expect(st.imageCalls).toHaveLength(1);
    await expect(page.locator('#genBtn')).toBeEnabled();

    st.fileStatus = 200; st.imageStatus = 502; st.detail = 'Input image too large';
    await page.click('#genBtn');
    await expect(page.locator('.toast.err').last()).toContainText('โมเดลไม่รับภาพอ้างอิงนี้ (Input image too large)');
    // ภาพอ้างอิงถูกลบ → ชิปหายเอง
    st.imageStatus = 200;
    await page.click('.ig-item[data-id="b2"]');
    await page.click('#vDel');
    await page.getByRole('button', { name: 'ลบ', exact: true }).last().click();
    await expect(page.locator('.ig-item[data-id="b2"]')).toHaveCount(0);
    await expect(page.locator('#refBox')).toBeHidden();
    await expect(page.locator('#model button[data-v="fast"]')).toBeEnabled();
    expect(errors.filter((e) => !/status of (404|502)/.test(e))).toEqual([]);
  });

  test('แก้ภาพนี้ เป็นภาษาอังกฤษ: ปุ่ม/ชิป/aria-label/ข้อความ error ไม่มีไทย', async ({ page }) => {
    const { errors, st } = await setup(page);
    await page.addInitScript(() => { localStorage.setItem('ome:lang', 'en'); });
    await page.addInitScript(SEED2);
    await page.goto('/image-gen.html');
    await page.click('.ig-item');
    await expect(page.locator('#vEdit')).toHaveText('Edit this image');
    await page.click('#vEdit');
    await expect(page.locator('#refBox')).toContainText('Reference image');
    await expect(page.locator('#refDel')).toHaveAttribute('aria-label', 'Remove reference image');
    st.fileStatus = 404;
    await page.fill('#prompt', 'x');
    await page.click('#genBtn');
    await expect(page.locator('.toast.err')).toHaveText('Could not load the reference image. Open it again and retry');
    const thai = await page.evaluate(() => [...document.querySelectorAll('#refBox, #view .dialog-foot, .toast')].map((e) => e.innerText).join(' ').match(/[฀-๿]+/g));
    expect(thai).toBeNull();
    expect(errors.filter((e) => !/status of 404/.test(e))).toEqual([]);
  });

  for (const w of [360, 390]) {
    test(`แก้ภาพนี้ จอ ${w}px: ไม่ล้นแนวนอน · ปุ่มท้าย dialog อยู่ในจอ · ชิปกดได้ ≥ 40px`, async ({ page }) => {
      const { errors } = await setup(page);
      await page.addInitScript(SEED2);
      await page.setViewportSize({ width: w, height: 760 });
      await page.goto('/image-gen.html');
      await page.click('.ig-item');
      for (const id of ['#vDel', '#vEdit', '#vAgain', '#vDl']) {
        const b = await page.locator(id).boundingBox();
        expect(b.x, id).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, id).toBeLessThanOrEqual(w);
        // ป้ายในปุ่มไม่ถูกบีบจนล้น/ทับกัน
        expect(await page.locator(id).evaluate((e) => e.scrollWidth - e.clientWidth), id).toBeLessThanOrEqual(1);
      }
      await page.click('#vEdit');
      const d = await page.locator('#refDel').boundingBox();
      expect(d.width).toBeGreaterThanOrEqual(40);
      expect(d.height).toBeGreaterThanOrEqual(40);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
    });
  }

  for (const theme of ['light', 'dark']) {
    test(`จอ 390px ไม่ล้นแนวนอน (${theme}) และเมนูมี "สร้างภาพ"`, async ({ page }) => {
      const { errors } = await setup(page, { theme });
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto('/image-gen.html');
      await page.waitForSelector('nav.ome-nav');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => (window.OME_MENU || []).some(function f(m) { return m.href === 'image-gen.html' || (m.children || []).some(f); }))).toBe(true);
      expect(errors).toEqual([]);
    });
  }
});
