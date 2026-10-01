// Phase 4 — AI บนคลาวด์: functions/api/ai/* + asr.js ตัวจริงบน SQLite กับ Workers AI ตัวหลอก (ดู sync-server.mjs) + ai-client.js / วิดเจ็ตแชท / หน้าสรุป
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');

const SRV = 'http://localhost:8126';
test.describe.configure({ mode: 'serial' });
test.use({ baseURL: SRV });

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

const post = (request, path, data) => request.post(SRV + path, { data });
const aiLog = async (request, clear) => (await request.get(SRV + '/__ailog' + (clear ? '?clear=1' : ''))).json();
const usage = async (request) => (await request.get(SRV + '/api/ai/usage')).json();

function parseSse(text) {
  return text.split('\n\n').filter((b) => b.startsWith('data:')).map((b) => JSON.parse(b.slice(5)));
}

test.describe('เซิร์ฟเวอร์ /api/ai/*', () => {
  test('chat: สตรีม SSE ที่ normalize แล้ว + บันทึกโควตา + รวม system หลายข้อความเป็นข้อความเดียว', async ({ request }) => {
    const res = await post(request, '/api/ai/chat', {
      messages: [
        { role: 'system', content: 'ตอบไทย' },
        { role: 'system', content: 'บริบทหน้า' },
        { role: 'user', content: 'สวัสดี' },
        { role: 'system', content: 'ย้ำ: ตอบไทย' },
      ],
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/event-stream');
    const events = parseSse(await res.text());
    expect(events.filter((e) => e.t).map((e) => e.t).join('')).toBe('สวัสดีครับ');
    const done = events[events.length - 1];
    expect(done).toMatchObject({ done: true, model: '@cf/aisingapore/gemma-sea-lion-v4-27b-it', tokens_in: 11, tokens_out: 7 });
    expect(done.neurons).toBeGreaterThan(0);

    // Gemma รับ system ได้แค่ข้อความแรก → ต้องรวมเป็นข้อความเดียว และคำสั่งย้ำท้ายสุดไปต่อท้ายข้อความ user
    const [call] = await aiLog(request);
    expect(call.input.stream).toBe(true);
    expect(call.input.messages).toEqual([
      { role: 'system', content: 'ตอบไทย\n\nบริบทหน้า' },
      { role: 'user', content: 'สวัสดี\n\nย้ำ: ตอบไทย' },
    ]);

    const u = await usage(request);
    expect(u.byKind.find((k) => k.kind === 'chat')).toMatchObject({ requests: 1, tokensIn: 11, tokensOut: 7 });
    expect(u.used).toBeGreaterThan(0);
    expect(u.limit).toBe(10000);
  });

  test('chat โมเดลเร็ว (qwen): ตัด <think> ที่ถูกหั่นข้ามท่อน + ปิดโหมดคิด', async ({ request }) => {
    const res = await post(request, '/api/ai/chat', { model: 'fast', messages: [{ role: 'user', content: 'ทดสอบ' }] });
    const events = parseSse(await res.text());
    expect(events.filter((e) => e.t).map((e) => e.t).join('')).toBe('สวัสดีครับ');
    const [call] = await aiLog(request);
    expect(call.model).toBe('@cf/qwen/qwen3-30b-a3b-fp8');
    expect(call.input.messages[0].content).toBe('ทดสอบ /no_think');
  });

  test('chat: ตรวจคำขอที่ผิดรูปแบบ', async ({ request }) => {
    expect((await post(request, '/api/ai/chat', { messages: [] })).status()).toBe(400);
    expect((await post(request, '/api/ai/chat', { messages: [{ role: 'tool', content: 'x' }] })).status()).toBe(400);
    expect((await post(request, '/api/ai/chat', { messages: [{ role: 'user', content: 5 }] })).status()).toBe(400);
    expect((await post(request, '/api/ai/chat', { messages: [{ role: 'user', content: 'x'.repeat(120001) }] })).status()).toBe(400);
    expect((await aiLog(request)).length).toBe(0);
  });

  test('summarize: แคชใน D1 (ข้อมูลชุดเดิม = ไม่เรียกโมเดลซ้ำ), refresh บังคับสรุปใหม่, ตัด <think>', async ({ request }) => {
    const body = { task: 'stock:gold', messages: [{ role: 'system', content: 'สรุป' }, { role: 'user', content: 'ราคา 100' }] };
    const a = await (await post(request, '/api/ai/summarize', body)).json();
    expect(a).toMatchObject({ text: 'สรุปหลัก', cached: false });
    const b = await (await post(request, '/api/ai/summarize', body)).json();
    expect(b).toMatchObject({ text: 'สรุปหลัก', cached: true });
    expect((await aiLog(request)).length).toBe(1);

    // ตัวเลขเปลี่ยน = คีย์เปลี่ยน = สรุปใหม่
    const c = await (await post(request, '/api/ai/summarize', { ...body, messages: [body.messages[0], { role: 'user', content: 'ราคา 101' }] })).json();
    expect(c.cached).toBe(false);
    expect((await aiLog(request)).length).toBe(2);

    const d = await (await post(request, '/api/ai/summarize', { ...body, refresh: true })).json();
    expect(d.cached).toBe(false);
    expect((await aiLog(request)).length).toBe(3);

    const f = await (await post(request, '/api/ai/summarize', { ...body, model: 'fast' })).json();
    expect(f).toMatchObject({ text: 'สรุปเร็ว', cached: false });

    const rows = await (await request.get(SRV + '/__aidump')).json();
    expect(rows.length).toBe(3);
    expect(rows.find((r) => r.task === 'stock:gold' && r.model.includes('gemma'))).toBeTruthy();
    const u = await usage(request);
    expect(u.byKind.find((k) => k.kind === 'summarize').requests).toBe(4); // แคชที่โดนไม่นับเป็นคำขอ AI
  });

  test('embed: คืนเวกเตอร์ตามจำนวนข้อความ + ตรวจอินพุต', async ({ request }) => {
    const r = await (await post(request, '/api/ai/embed', { texts: ['กฎหมายแพ่ง', 'หุ้นไทย'] })).json();
    expect(r).toMatchObject({ model: '@cf/baai/bge-m3', dims: 8 });
    expect(r.vectors.length).toBe(2);
    const single = await (await post(request, '/api/ai/embed', { text: 'ทอง' })).json();
    expect(single.vectors.length).toBe(1);
    expect((await post(request, '/api/ai/embed', { texts: [] })).status()).toBe(400);
    expect((await post(request, '/api/ai/embed', { texts: ['ok', ''] })).status()).toBe(400);
    expect((await post(request, '/api/ai/embed', { texts: Array(65).fill('x') })).status()).toBe(400);
    expect((await usage(request)).byKind.find((k) => k.kind === 'embed').requests).toBe(2);
  });

  test('โควตา: เกินเพดาน → 429 code quota ก่อนเรียกโมเดล, แคชยังอ่านได้, Whisper นับรวมโควตาเดียวกัน', async ({ request }) => {
    const sum = { task: 'meeting', messages: [{ role: 'user', content: 'บทประชุม' }] };
    await post(request, '/api/ai/summarize', sum); // เก็บแคชไว้ก่อน

    // Whisper: ไม่มี usage.neurons จากตัวหลอก → เซิร์ฟเวอร์ประมาณจากขนาดเสียง (30 วินาที WAV 16kHz mono = 960,000 ไบต์ ≈ 1,280,000 ตัวอักษร base64 → ~23 Neurons)
    const audio = 'A'.repeat(1280000);
    const asr = await post(request, '/api/asr', { audio, language: 'th' });
    expect(asr.status()).toBe(200);
    const u1 = await usage(request);
    const asrRow = u1.byKind.find((k) => k.kind === 'asr');
    expect(asrRow.requests).toBe(1);
    expect(asrRow.neurons).toBeGreaterThan(20);
    expect(asrRow.neurons).toBeLessThan(30);

    await request.get(SRV + '/__ai?limit=' + Math.ceil(u1.used + 1));
    await aiLog(request, true);
    const chat = await post(request, '/api/ai/chat', { messages: [{ role: 'user', content: 'ถามอะไรสักอย่างที่ยาวพอสมควร'.repeat(20) }] });
    expect(chat.status()).toBe(429);
    expect(await chat.json()).toMatchObject({ code: 'quota', limit: Math.ceil(u1.used + 1) });
    expect((await post(request, '/api/ai/embed', { texts: ['x'.repeat(4000)] })).status()).toBe(429);
    expect((await aiLog(request)).length).toBe(0);

    const cached = await (await post(request, '/api/ai/summarize', sum)).json();
    expect(cached.cached).toBe(true);
    const fresh = await post(request, '/api/ai/summarize', { ...sum, refresh: true });
    expect(fresh.status()).toBe(429);
  });

  test('ข้อผิดพลาดจากโมเดล: โควตาของ Cloudflare เองหมด → 429, อย่างอื่น → 502', async ({ request }) => {
    await request.get(SRV + '/__ai?mode=quota');
    const q = await post(request, '/api/ai/summarize', { messages: [{ role: 'user', content: 'x' }] });
    expect(q.status()).toBe(429);
    expect((await q.json()).code).toBe('quota');
    await request.get(SRV + '/__ai?mode=down');
    const d = await post(request, '/api/ai/chat', { messages: [{ role: 'user', content: 'x' }] });
    expect(d.status()).toBe(502);
    expect((await d.json()).code).toBe('upstream');
    expect((await usage(request)).used).toBe(0);
  });
});

test.describe('ไคลเอนต์', () => {
  const enable = (page) => page.addInitScript(() => { window.TANOT_AI = { enabled: true }; });

  test('AiClient: สตรีม onToken ทีละท่อน, summarize แคช, embed, usage, และรหัสข้อผิดพลาด', async ({ page }) => {
    const errors = await prepare(page);
    await enable(page);
    await page.goto('/credits.html');
    const out = await page.evaluate(async () => {
      const pieces = [];
      const chat = await AiClient.chat({ messages: [{ role: 'user', content: 'hi' }], onToken: (p, full) => pieces.push(full) });
      const s1 = await AiClient.summarize({ task: 't', messages: [{ role: 'user', content: 'a' }] });
      const s2 = await AiClient.summarize({ task: 't', messages: [{ role: 'user', content: 'a' }] });
      const e = await AiClient.embed(['a', 'b']);
      const u = await AiClient.usage();
      const wav = AiClient.pcmToWavBase64(new Float32Array(160), 16000);
      return { pieces, chat, cached: [s1.cached, s2.cached], vecs: e.vectors.length, used: u.used, wavHead: atob(wav).slice(0, 4), wavLen: atob(wav).length };
    });
    expect(out.pieces).toEqual(['สวัสดี', 'สวัสดีครับ']);
    expect(out.chat).toMatchObject({ text: 'สวัสดีครับ', tokensIn: 11, tokensOut: 7 });
    expect(out.cached).toEqual([false, true]);
    expect(out.vecs).toBe(2);
    expect(out.used).toBeGreaterThan(0);
    expect(out.wavHead).toBe('RIFF');
    expect(out.wavLen).toBe(44 + 160 * 2);
    expect(errors).toEqual([]);
  });

  test('AiClient: รหัสข้อผิดพลาด (bad / quota / upstream / unavailable) และ canFallback', async ({ page, request }) => {
    await prepare(page);
    await enable(page);
    await page.goto('/credits.html');
    const codes = async () => page.evaluate(async () => {
      const grab = (p) => p.then(() => null, (e) => ({ code: e.code, fb: AiClient.canFallback(e), msg: AiClient.friendlyMessage(e) }));
      return {
        bad: await grab(AiClient.chat({ messages: [] })),
        chat: await grab(AiClient.chat({ messages: [{ role: 'user', content: 'x' }] })),
        sum: await grab(AiClient.summarize({ messages: [{ role: 'user', content: 'x' }], refresh: true })),
      };
    });
    const bad = (await codes()).bad;
    expect(bad).toMatchObject({ code: 'bad', fb: false });

    await request.get(SRV + '/__ai?mode=quota');
    const q = await codes();
    expect(q.chat).toMatchObject({ code: 'quota', fb: true });
    expect(q.chat.msg).toContain('โควตา');

    await request.get(SRV + '/__ai?mode=down');
    expect((await codes()).sum).toMatchObject({ code: 'upstream', fb: true });

    // ไม่ใช่โดเมนที่มีคลาวด์ → unavailable โดยไม่ยิงเครือข่าย
    const un = await page.evaluate(() => { window.TANOT_AI = { enabled: false }; return AiClient.chat({ messages: [{ role: 'user', content: 'x' }] }).then(() => null, (e) => e.code); });
    expect(un).toBe('unavailable');
  });

  test('วิดเจ็ตแชท: iPhone ใช้ได้ผ่านคลาวด์ (สตรีมคำตอบ) และไม่ถอยไปโมเดลในเครื่องเมื่อโควตาเต็ม', async ({ browser, request }) => {
    const ctx = await browser.newContext({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    const errors = await prepare(page);
    await enable(page);
    await page.goto('/credits.html');
    await page.locator('.ome-ai-fab').click();
    const input = page.locator('.ome-ai-inputrow textarea');
    await expect(input).toBeEnabled(); // เดิม iPhone ถูกปิดทั้งวิดเจ็ต
    await expect(page.locator('.ome-ai-disclaimer')).toHaveCount(0);

    await input.fill('สวัสดี');
    await page.locator('.ome-ai-btn.send').click();
    await expect(page.locator('.ome-ai-row.bot .ome-ai-bubble')).toHaveText('สวัสดีครับ');
    await expect(input).toBeEnabled();
    const [call] = await aiLog(request);
    expect(call.input.messages[0].role).toBe('system');
    expect(call.input.messages.filter((m) => m.role === 'system').length).toBe(1);
    expect(call.input.messages[call.input.messages.length - 1].content).toContain('ย้ำ: ตอบข้อความล่าสุดนี้เป็นภาษาไทย');

    await request.get(SRV + '/__ai?mode=quota');
    await input.fill('ถามอีกที');
    await page.locator('.ome-ai-btn.send').click();
    await expect(page.locator('.ome-ai-status')).toContainText('โควตา AI');
    await expect(page.locator('.ome-ai-row.bot')).toHaveCount(1); // ไม่มีคำตอบใหม่
    await expect(input).toBeEnabled();
    // 429 ที่ตั้งใจให้เกิดเป็นข้อความ "Failed to load resource" ของเบราว์เซอร์เอง ไม่ใช่ข้อผิดพลาดของโค้ด
    expect(errors.filter((e) => !/status of 429/.test(e))).toEqual([]);
    await ctx.close();
  });

  test('วิดเจ็ตแชท: สรุปหน้านี้ผ่านคลาวด์', async ({ page, request }) => {
    const errors = await prepare(page);
    await enable(page);
    await page.goto('/credits.html');
    await page.locator('.ome-ai-fab').click();
    await page.locator('.ome-ai-sumbtn').click();
    await expect(page.locator('.ome-ai-row.bot .ome-ai-bubble')).toHaveText('สวัสดีครับ');
    const [call] = await aiLog(request);
    expect(call.input.messages[0].content).toContain('หัวข้อหลัก:');
    expect(errors).toEqual([]);
  });

  test('สรุปทอง: เรียกคลาวด์ก่อน (แคชใน D1 ไม่ใช้ Firebase) — iPhone ก็ใช้ได้', async ({ browser, request }) => {
    const ctx = await browser.newContext({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    const errors = await prepare(page);
    await enable(page);
    // ชุดราคาสังเคราะห์ใน cache ของหน้า (ปิดเน็ตอยู่ จึงใช้แคชแทนการดึงราคาจริง)
    await page.addInitScript(() => {
      const n = 160, t = [], c = [];
      for (let i = 0; i < n; i++) { t.push(1700000000 + i * 86400); c.push(2000 + i * 0.8 + Math.sin(i / 5) * 12); }
      localStorage.setItem('tanot:invest:cache:gold:GC=F', JSON.stringify({
        ts: Date.now(), t, o: c.map((v) => v - 1), h: c.map((v) => v + 3), l: c.map((v) => v - 3), c,
      }));
    });
    await page.goto('/invest-gold.html');
    const btn = page.locator('#aiSumBtn');
    await expect(btn).toBeVisible({ timeout: 15000 });
    await btn.click();
    await expect(page.locator('#aiSumOut')).toHaveText('สรุปหลัก');
    let [call] = await aiLog(request, true);
    expect(call.input.messages[0].role).toBe('system');
    expect(call.input.messages.map((m) => m.role)).toEqual(['system', 'user']);

    await btn.click(); // ข้อมูลชุดเดิม → แคชใน D1 ไม่เรียกโมเดลอีก
    await expect(page.locator('#aiSumStatus')).toContainText('แคช');
    expect((await aiLog(request)).length).toBe(0);
    expect(errors).toEqual([]);
    await ctx.close();
  });
  test('คลาวด์ล่ม: คอมถอยไปโมเดลในเบราว์เซอร์ (สร้าง ai-chat-worker), iPhone แสดงข้อความและไม่ลองโหลดโมเดล', async ({ browser, request }) => {
    const seed = () => {
      const n = 160, t = [], c = [];
      for (let i = 0; i < n; i++) { t.push(1700000000 + i * 86400); c.push(2000 + i * 0.8 + Math.sin(i / 5) * 12); }
      localStorage.setItem('tanot:invest:cache:gold:GC=F', JSON.stringify({ ts: Date.now(), t, o: c.map((v) => v - 1), h: c.map((v) => v + 3), l: c.map((v) => v - 3), c }));
    };
    for (const ua of [undefined, IPHONE_UA]) {
      await request.get(SRV + '/__ai?mode=down');
      const ctx = await browser.newContext(ua ? { userAgent: ua, viewport: { width: 390, height: 844 }, hasTouch: true } : {});
      const page = await ctx.newPage();
      await prepare(page);
      await enable(page);
      await page.addInitScript(seed);
      const workers = [];
      page.on('worker', (w) => workers.push(w.url()));
      await page.goto('/invest-gold.html');
      await expect(page.locator('#aiSumBtn')).toBeVisible({ timeout: 15000 });
      await page.locator('#aiSumBtn').click();
      if (ua) {
        await expect(page.locator('#aiSumStatus')).toContainText('AI request failed');
        await page.waitForTimeout(500);
        expect(workers.filter((u) => /ai-chat-worker/.test(u))).toEqual([]);
      } else {
        await expect.poll(() => workers.filter((u) => /ai-chat-worker/.test(u)).length, { timeout: 10000 }).toBeGreaterThan(0);
      }
      await ctx.close();
    }
  });
});
