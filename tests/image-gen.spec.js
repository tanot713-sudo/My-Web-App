// สร้างภาพ (image-gen.html + functions/api/ai/image.js)
// 1) ฝั่งเซิร์ฟเวอร์: image.js ตัวจริงบน SQLite + R2 ตัวหลอก + FLUX ตัวหลอก (sync-server.mjs พอร์ต 8139) — allowlist, ต่อท้าย prompt, โควตา, เก็บไฟล์
// 2) ฝั่งหน้าเว็บ: mock /api/ai/image, /api/files, /api/ai/usage, /api/ai/chat ด้วย page.route
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');

const SRV = 'http://localhost:8139';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

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
});

/* ── หน้าเว็บ (mock ทุก /api/*) ── */
async function setup(page, { theme = 'light' } = {}) {
  const errors = await prepare(page, { theme });
  const st = { used: 100, imageCalls: [], deletes: [], chatCalls: 0, n: 0, imageStatus: 200, delStatus: 200 };
  await page.addInitScript(() => { window.TANOT_AI = { enabled: true }; });
  await page.route('**/api/ai/usage', (r) => r.fulfill({ json: { day: '2026-09-30', limit: 10000, used: st.used, remaining: 10000 - st.used, byKind: [] } }));
  await page.route('**/api/ai/image', (r) => {
    const body = r.request().postDataJSON();
    st.imageCalls.push(body);
    if (st.imageStatus === 429) return r.fulfill({ status: 429, json: { error: 'quota', code: 'quota' } });
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
    return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
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
