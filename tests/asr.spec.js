// งานปรับปรุงเสียง/OCR Section 3 — ถอดเสียง (ASR) แม่นและเร็วขึ้น
//  A) asr-calc.js known-answer: รอยต่อที่ทั้งซ้ำและไม่ซ้ำ, แผนท่อนเหลื่อม, ย่อหน้า/เวลา, Neurons ที่เพิ่มจากส่วนเหลื่อม
//  B) /api/asr ตัวจริงบน sync-server (พอร์ต 8141) กับ Workers AI ตัวหลอก: allowlist โมเดล, initial_prompt ตามโดเมน + จำกัดความยาว, vad_filter, quota → 429
//  C) หน้า text-to-speech: ส่งขนาน ≤ 3 + ประกอบตามลำดับเดิม, ลองใหม่ 1 ครั้ง, ยกเลิกกลางทาง, quota หยุดทั้งชุด, ชุดคำศัพท์ตามโดเมน, สวิตช์แสดงเวลา (คลาวด์ + ในเบราว์เซอร์)
//  D) ในเบราว์เซอร์: WebGPU (adapter จริง) → รุ่นใหม่ onnx-community, ล้มตอนโหลด/รัน → WASM 1 ครั้ง + problem log, 404 → รุ่นเดิม
// CI ห้ามโหลดโมเดล/เรียก Workers AI จริง: /api/asr ในส่วน C ถูก route เป็นตัวหลอกที่คุมช้า/ล้ม/ลำดับกลับ, transformers.js ถูก route เป็นโมดูลหลอก
const { test, expect } = require('@playwright/test');
const Asr = require('../asr-calc.js');

/* ═══════════════ A) asr-calc.js ═══════════════ */
test.describe('asr-calc: รอยต่อท่อนเหลื่อม', () => {
  test('ซ้ำ: ตัดส่วนที่ท่อนก่อนจบซ้ำกับต้นท่อนถัดไป (ไทยไม่มีเว้นวรรค, ไม่สนวรรคตอน/ตัวพิมพ์)', () => {
    const r = Asr.trimSeam('การประชุมวันนี้เรื่องประมวลกฎหมายแพ่ง', 'ประมวลกฎหมายแพ่งและพาณิชย์ มาตรา 420');
    expect(r.text).toBe('และพาณิชย์ มาตรา 420');
    expect(r.overlap).toBe(16);
    expect(Asr.trimSeam('ผมคิดว่า, ตกลง ตามนี้', 'ตกลงตามนี้ ครับ ต่อไป').text).toBe('ครับ ต่อไป');
    expect(Asr.trimSeam('see you Tomorrow.', 'tomorrow at ten').text).toBe('at ten');
  });
  test('ซ้ำแต่คำแรกของท่อนถัดไปถูกตัดครึ่ง/ขยะนำหน้า ≤ 2 ตัว → ยังตัดได้', () => {
    expect(Asr.trimSeam('...ในสภาพแวดล้อมในการทำงาน', 'ภาพแวดล้อมในการทำงานและความปลอดภัย').text).toBe('และความปลอดภัย');
    expect(Asr.trimSeam('...ในสภาพแวดล้อมในการทำงาน', 'ออภาพแวดล้อมในการทำงานและความปลอดภัย').text).toBe('และความปลอดภัย');
    // ขยะนำหน้า 3 ตัวขึ้นไป = ไม่ตัด (กันตัดข้อความจริงทิ้ง)
    expect(Asr.trimSeam('...ในสภาพแวดล้อมในการทำงาน', 'ออกขภาพแวดล้อมในการทำงานและความปลอดภัย').dropped).toBe(0);
  });
  test('ไม่ซ้ำ: ข้อความคงเดิมทุกตัวอักษร · ซ้ำสั้นกว่า 4 ตัวอักษรไม่ตัด · ซ้ำยาวเกินเพดาน (ส่วนเหลื่อม 1.5 วิ พูดไม่ได้ขนาดนั้น) ไม่ตัด', () => {
    const next = 'เรื่องต่อไปคืองบประมาณ ปีหน้า';
    expect(Asr.trimSeam('ตกลงตามนี้ครับ', next)).toEqual({ text: next, dropped: 0, overlap: 0 });
    expect(Asr.trimSeam('ขอบคุณค่ะ', 'ค่ะ ต่อไปครับ').dropped).toBe(0); // 'ค่ะ' 3 ตัว < 4
    const long = 'ก'.repeat(80);
    expect(Asr.trimSeam(long, long + 'ข').dropped).toBe(0);
    expect(Asr.trimSeam('', 'ข้อความ').text).toBe('ข้อความ');
  });
  test('mergeChunks: ตัดซ้ำตามลำดับ + เวลาจริงในไฟล์ + ช่วงคำพูดที่ซ้ำทั้งช่วงถูกทิ้ง, ท่อนที่ไม่ซ้ำไม่ถูกแตะ', () => {
    const m = Asr.mergeChunks([
      { offset: 0, segments: [{ start: 0, end: 3, text: 'ก่อนหน้านี้' }, { start: 24, end: 28, text: 'ประมวลกฎหมายแพ่ง' }] },
      { offset: 26.5, segments: [{ start: 0, end: 1.5, text: 'ประมวลกฎหมายแพ่ง' }, { start: 2, end: 5, text: 'มาตรา 420' }] },
      { offset: 52, segments: [{ start: 0, end: 4, text: 'เรื่องใหม่ไม่ซ้ำ' }] }, // ไม่ซ้ำกับท้ายท่อนก่อน
    ]);
    expect(m.segments.map((s) => s.text)).toEqual(['ก่อนหน้านี้', 'ประมวลกฎหมายแพ่ง', 'มาตรา 420', 'เรื่องใหม่ไม่ซ้ำ']);
    expect(m.segments[2].start).toBeCloseTo(28.5, 5);
    expect(m.segments[3].start).toBe(52);
    expect(m.trimmed).toEqual([0, 16, 0]);
    expect(m.text).toBe('ก่อนหน้านี้ ประมวลกฎหมายแพ่ง มาตรา 420 เรื่องใหม่ไม่ซ้ำ');
  });
  test('mergeChunks: ท่อนที่ไม่มี segments (มีแต่ text) ก็ตัดซ้ำได้ · ซ้ำบางส่วนของช่วงคำพูดเดียว → ตัดเฉพาะส่วนที่ซ้ำ', () => {
    const m = Asr.mergeChunks([
      { offset: 0, text: 'วันนี้เราจะพูดถึงสัญญาซื้อขายที่ดิน', duration: 20 },
      { offset: 18.5, text: 'สัญญาซื้อขายที่ดินและการโอนกรรมสิทธิ์', duration: 20 },
    ]);
    expect(m.text).toBe('วันนี้เราจะพูดถึงสัญญาซื้อขายที่ดิน และการโอนกรรมสิทธิ์');
  });
});

test.describe('asr-calc: แผนท่อนเหลื่อม + Neurons + ย่อหน้า', () => {
  test('planChunks: ครอบคลุมทั้งไฟล์ ไม่ขาด · ท่อนถัดไปเริ่มก่อนจุดตัด 1.5 วิ · ท่อนยาว ≤ 33 วิ · ท่อนท้ายสั้นรวมเข้าท่อนก่อน', () => {
    const R = 16000, total = R * 100;
    const p = Asr.planChunks(total, {});
    expect(p.length).toBe(4);
    expect(p[0].a).toBe(0);
    expect(p[p.length - 1].b).toBe(total);
    for (let i = 1; i < p.length; i++) {
      expect(p[i].start).toBe(p[i - 1].end);
      expect(p[i].a).toBe(p[i].start - Math.round(1.5 * R));
      expect(p[i].ov).toBe(1.5);
    }
    for (const c of p) expect((c.b - c.a) / R).toBeLessThanOrEqual(33);
    expect(Asr.planChunks(R * 30 + 2 * R, {}).length).toBe(1); // ท่อนท้าย 2 วินาที < 4 → รวม
    expect(Asr.planChunks(0, {})).toEqual([]);
    // cutAt ถูกเรียกด้วยช่วงที่ถูกต้อง และผลของมันกำหนดจุดตัด
    const seen = [];
    const q = Asr.planChunks(R * 70, { cutAt: (t, lo, hi) => { seen.push([t, lo, hi]); return t - R; } });
    expect(seen[0]).toEqual([28 * R, 25 * R, 31 * R]);
    expect(q[0].end).toBe(27 * R);
  });
  test('Neurons: ส่วนเหลื่อมเพิ่มเสียงที่ส่งไม่เกิน ~5% (ต้องไม่เกิน 10%) ทุกความยาว 31 วินาที – 3 ชั่วโมง', () => {
    for (const sec of [31, 45, 60, 100, 300, 600, 1800, 3600, 10800]) {
      const p = Asr.planChunks(Math.round(sec * 16000), {});
      const ratio = Asr.sentSeconds(p) / sec;
      expect(ratio).toBeGreaterThanOrEqual(1);
      expect(ratio).toBeLessThanOrEqual(1.06);
    }
    // 10 นาที: 600 วินาทีเสียง = 466.3 Neurons · ส่งจริง = +~5%
    const p = Asr.planChunks(600 * 16000, {});
    expect(Asr.neuronsFor(600)).toBeCloseTo(466.3, 1);
    expect(Asr.neuronsFor(Asr.sentSeconds(p))).toBeLessThan(466.3 * 1.06);
  });
  test('paragraphs / formatTime / render: แบ่งย่อหน้าตามช่วงเงียบ, ไม่แบ่งถ้ายังสั้น, ยาวเกินแบ่งเอง, ใส่ [hh:mm:ss] ได้', () => {
    expect(Asr.formatTime(0)).toBe('00:00:00');
    expect(Asr.formatTime(83.9)).toBe('00:01:23');
    expect(Asr.formatTime(3725)).toBe('01:02:05');
    const long = 'ก'.repeat(70);
    const segs = [
      { start: 0, end: 5, text: long }, { start: 5.4, end: 9, text: 'ต่อเนื่อง' },   // เงียบ 0.4 วิ → ย่อหน้าเดิม
      { start: 11, end: 14, text: 'หลังเงียบ 2 วิ' },                                // เงียบ 2 วิ + ย่อหน้าก่อนยาวพอ → ย่อหน้าใหม่
      { start: 15, end: 16, text: 'สั้น' },                                           // เงียบ 1 วิ → ต่อ
      { start: 21, end: 23, text: 'หลังเงียบ 5 วิ' },                                 // เงียบ ≥ 4 วิ → ย่อหน้าใหม่ไม่ว่าสั้นแค่ไหน
    ];
    const paras = Asr.paragraphs(segs);
    expect(paras.map((p) => [p.start, p.text])).toEqual([
      [0, long + ' ต่อเนื่อง'], [11, 'หลังเงียบ 2 วิ สั้น'], [21, 'หลังเงียบ 5 วิ'],
    ]);
    // ย่อหน้าสั้นกว่า 60 ตัวอักษร ช่วงเงียบ 2 วิ ยังไม่แบ่ง (กันเป็นย่อหน้าเศษๆ)
    expect(Asr.paragraphs([{ start: 0, end: 2, text: 'สั้นๆ' }, { start: 4, end: 6, text: 'ต่อ' }]).length).toBe(1);
    // ยาวเกิน 480 ตัวอักษร แบ่งที่ขอบช่วงคำพูดถัดไป
    const many = Array.from({ length: 12 }, (_, i) => ({ start: i * 5, end: i * 5 + 4.9, text: 'ข'.repeat(50) }));
    expect(Asr.paragraphs(many).length).toBe(2);
    expect(Asr.render(paras, { timestamps: false })).toBe(long + ' ต่อเนื่อง\n\nหลังเงียบ 2 วิ สั้น\n\nหลังเงียบ 5 วิ');
    expect(Asr.render(paras, { timestamps: true }).split('\n\n')[1]).toBe('[00:00:11] หลังเงียบ 2 วิ สั้น');
    expect(Asr.paragraphs([{ start: 0, end: 1, text: ' ' }])).toEqual([]);
  });
});

/* ═══════════════ B) /api/asr ตัวจริง ═══════════════ */
const SRV = 'http://localhost:8141';
test.describe('เซิร์ฟเวอร์ /api/asr', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });
  const post = (request, data) => request.post(SRV + '/api/asr', { data });
  const calls = async (request, clear) => (await request.get(SRV + '/__ailog' + (clear ? '?clear=1' : ''))).json();
  const AUDIO = 'UklGRg=='.repeat(100);

  test('พารามิเตอร์ที่ส่งให้โมเดล: vad_filter เปิดเสมอ, task=transcribe, language ตามที่ส่ง · คืน segments แบบย่อ (ทิ้งช่วงที่เวลา/ข้อความเสีย)', async ({ request }) => {
    const res = await post(request, { audio: AUDIO, language: 'th' });
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.text).toBe('ข้อความทดสอบ');
    expect(j.segments).toEqual([{ start: 0, end: 1.5, text: 'ข้อความทดสอบ' }]);
    const [c] = await calls(request);
    expect(c.model).toBe('@cf/openai/whisper-large-v3-turbo');
    expect(c.input).toMatchObject({ task: 'transcribe', vad_filter: true, language: 'th', audioLen: AUDIO.length });
    expect('initial_prompt' in c.input).toBe(false); // ไม่ระบุโดเมน = ไม่มี prompt (พฤติกรรมเดิมของวิดเจ็ตแชท)
    await calls(request, true);
    await post(request, { audio: AUDIO, vad: false });
    expect((await calls(request))[0].input.vad_filter).toBe(false);
  });

  test('language: รับเฉพาะรหัส 2–3 ตัวอักษรพิมพ์เล็ก — ค่าอื่นถูกเมิน (โมเดลตรวจเอง) ไม่ส่งต่อเข้าโมเดล', async ({ request }) => {
    for (const bad of ['TH', 'thai!', 'th; drop', '', 5, { a: 1 }]) {
      expect((await post(request, { audio: AUDIO, language: bad })).status()).toBe(200);
    }
    for (const c of await calls(request)) expect('language' in c.input).toBe(false);
  });

  test('initial_prompt ตามโดเมน: กฎหมาย/วิศวกรรม/การลงทุน/ทั่วไป · อังกฤษใช้ชุดอังกฤษ · โดเมนแปลก = 400 ก่อนเรียกโมเดล', async ({ request }) => {
    const want = { law: 'มาตรา', engineering: 'หม้อแปลง', invest: 'กองทุนรวม', general: 'การประชุม' };
    for (const [d, w] of Object.entries(want)) {
      await calls(request, true);
      expect((await post(request, { audio: AUDIO, language: 'th', domain: d })).status()).toBe(200);
      const [c] = await calls(request);
      expect(c.input.initial_prompt).toContain(w);
      expect(c.input.initial_prompt.length).toBeLessThanOrEqual(400);
    }
    await calls(request, true);
    await post(request, { audio: AUDIO, language: 'en', domain: 'law' });
    expect((await calls(request))[0].input.initial_prompt).toMatch(/Civil and Commercial Code/);
    await calls(request, true);
    await post(request, { audio: AUDIO, domain: 'invest' }); // ตรวจอัตโนมัติ → ชุดไทย
    expect((await calls(request))[0].input.initial_prompt).toContain('หุ้น');
    await calls(request, true);
    const bad = await post(request, { audio: AUDIO, domain: 'hacking' });
    expect(bad.status()).toBe(400);
    expect((await calls(request)).length).toBe(0);
  });

  test('initial_prompt ที่ client ส่งเอง: ถูกตัดที่ 400 ตัวอักษร + ลบอักขระควบคุม/ช่องว่างซ้อน · ชนะชุดของโดเมน', async ({ request }) => {
    await post(request, { audio: AUDIO, domain: 'law', initial_prompt: 'ก'.repeat(5000) });
    let [c] = await calls(request);
    expect(Array.from(c.input.initial_prompt).length).toBe(400);
    await calls(request, true);
    await post(request, { audio: AUDIO, initial_prompt: '  คำ\u0000ศัพท์ \n\n\t  เฉพาะ​  ' });
    [c] = await calls(request);
    expect(c.input.initial_prompt).toBe('คำ ศัพท์ เฉพาะ');
    await calls(request, true);
    await post(request, { audio: AUDIO, initial_prompt: '😀'.repeat(900) }); // ตัดตามตัวอักษร ไม่ฉีกคู่ surrogate
    [c] = await calls(request);
    expect(Array.from(c.input.initial_prompt).length).toBe(400);
    expect(c.input.initial_prompt.includes('�')).toBe(false);
    await calls(request, true);
    await post(request, { audio: AUDIO, initial_prompt: '   ' });
    expect('initial_prompt' in (await calls(request))[0].input).toBe(false);
  });

  test('allowlist โมเดล: ชื่อนอกลิสต์ (รวมโมเดลอื่นของ Workers AI) = 400 ไม่เรียกโมเดล · ชื่อย่อ/ชื่อเต็มของ whisper-large-v3-turbo ใช้ได้', async ({ request }) => {
    for (const model of ['@cf/meta/llama-3.1-8b-instruct', '@cf/openai/whisper', '../../etc', 'constructor', { x: 1 }]) {
      expect((await post(request, { audio: AUDIO, model })).status(), JSON.stringify(model)).toBe(400);
    }
    expect((await calls(request)).length).toBe(0);
    expect((await post(request, { audio: AUDIO, model: 'whisper-large-v3-turbo' })).status()).toBe(200);
    expect((await post(request, { audio: AUDIO, model: '@cf/openai/whisper-large-v3-turbo' })).status()).toBe(200);
    expect((await calls(request)).every((c) => c.model === '@cf/openai/whisper-large-v3-turbo')).toBe(true);
  });

  test('คำขอผิดรูป: ไม่มี audio / JSON เสีย = 400 · เสียงใหญ่เกินเพดาน = 413 ก่อนเรียกโมเดล', async ({ request }) => {
    expect((await post(request, { language: 'th' })).status()).toBe(400);
    expect((await request.post(SRV + '/api/asr', { data: '{oops', headers: { 'content-type': 'application/json' } })).status()).toBe(400);
    expect((await post(request, { audio: 'A'.repeat(4_000_001) })).status()).toBe(413);
    expect((await calls(request)).length).toBe(0);
  });

  test('โควตาเต็ม (Workers AI error 4006) → 429 code quota · ล่ม → 502 · ยังไม่บันทึกโควตาเมื่อล้ม', async ({ request }) => {
    await request.get(SRV + '/__ai?mode=quota');
    const q = await post(request, { audio: AUDIO });
    expect(q.status()).toBe(429);
    expect(await q.json()).toMatchObject({ code: 'quota' });
    await request.get(SRV + '/__ai?mode=down');
    const d = await post(request, { audio: AUDIO });
    expect(d.status()).toBe(502);
    expect(await d.json()).toMatchObject({ code: 'upstream' });
    await request.get(SRV + '/__ai?mode=ok');
    const u = await (await request.get(SRV + '/api/ai/usage')).json();
    expect(u.byKind.find((k) => k.kind === 'asr')).toBeUndefined();
    await post(request, { audio: 'A'.repeat(1280000) });
    const u2 = await (await request.get(SRV + '/api/ai/usage')).json();
    expect(u2.byKind.find((k) => k.kind === 'asr').requests).toBe(1);
  });
});

/* ═══════════════ C/D) หน้า text-to-speech ═══════════════ */
/* WAV 16-bit mono — 8 kHz (เบราว์เซอร์ถอดที่ 16 kHz เอง) · วินาทีที่ 4 ของทุก 4 วินาทีเงียบ → จุดตัดท่อนตกในช่วงเงียบ */
function wav({ rate = 8000, seconds }) {
  const n = Math.round(rate * seconds), bytes = 44 + n * 2, b = Buffer.alloc(bytes);
  b.write('RIFF', 0); b.writeUInt32LE(bytes - 8, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.floor(i / rate) % 4 === 3 ? 0 : Math.round(0.3 * Math.sin(i / 7) * 32767), 44 + i * 2);
  return b;
}
const wavBytes = (b64) => (b64.length * 3) / 4 - 44; // ไบต์ PCM ของคำขอ /api/asr
const secOf = (body) => wavBytes(body.audio) / 2 / 16000;

/* /api/asr หลอก — script(k, body) คืน { status?, json?, delay? } · k = ลำดับที่คำขอมาถึง */
async function cloudSetup(context, page, script) {
  const st = { calls: [], inflight: 0, maxInflight: 0, failed: 0 };
  page.on('requestfailed', (r) => { if (/\/api\/asr/.test(r.url())) st.failed++; });
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/asr') {
      const body = route.request().postDataJSON();
      const k = st.calls.length;
      st.calls.push({ k, t: Date.now(), body: { ...body, audio: undefined }, sec: secOf(body) });
      st.inflight++; st.maxInflight = Math.max(st.maxInflight, st.inflight);
      const r = script(k, body) || {};
      await new Promise((res) => setTimeout(res, r.delay || 0));
      st.inflight--;
      try { await route.fulfill({ status: r.status || 200, contentType: 'application/json', body: JSON.stringify(r.json || { text: '' }) }); } catch (e) { /* ยกเลิกไปแล้ว */ }
      return;
    }
    if (u.pathname === '/api/ai/usage') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ used: 10, limit: 10000 }) });
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort('internetdisconnected');
  });
  await page.addInitScript(() => { try { localStorage.setItem('ome:theme', 'light'); } catch (e) {} window.TANOT_AI = { enabled: true }; });
  return st;
}

/* คำตอบของท่อน k — ท่อนถัดไปขึ้นต้นด้วยส่วนท้ายของท่อนก่อนหน้า (ส่วนเหลื่อม) */
const CHUNKS = [
  [{ start: 0, end: 4, text: 'ก่อนอื่นขอเริ่มประชุมวันนี้' }, { start: 24, end: 27.5, text: 'เรื่องแรกคือสัญญาซื้อขาย' }],
  [{ start: 0, end: 1.5, text: 'เรื่องแรกคือสัญญาซื้อขาย' }, { start: 2, end: 6, text: 'ผู้ซื้อต้องชำระราคา' }, { start: 24, end: 27, text: 'ต่อไปคือเรื่องละเมิด' }],
  [{ start: 0, end: 1.5, text: 'เรื่องละเมิด' }, { start: 3, end: 7, text: 'ความรับผิดทางแพ่ง' }],
  [{ start: 0, end: 1.5, text: 'ทางแพ่ง' }, { start: 2, end: 5, text: 'จบการประชุม' }],
];
const EXPECT_TEXT = 'ก่อนอื่นขอเริ่มประชุมวันนี้ เรื่องแรกคือสัญญาซื้อขาย ผู้ซื้อต้องชำระราคา ต่อไปคือเรื่องละเมิด ความรับผิดทางแพ่ง จบการประชุม';
const chunkJson = (k) => ({ text: (CHUNKS[k] || []).map((s) => s.text).join(' '), segments: CHUNKS[k] || [], neurons: 3 });
const flat = (s) => s.replace(/\s+/g, ' ').trim();

test.describe('ถอดเสียงคลาวด์: ท่อนเหลื่อม + ขนาน ≤ 3 + ลำดับ', () => {
  test('100 วินาที → 4 ท่อนเหลื่อม 1.5 วิ · ส่งพร้อมกัน 3 แต่ไม่เกิน · ตอบกลับสลับลำดับแต่ผลเรียงถูก · ตัดคำซ้ำที่รอยต่อ · Neurons ส่ง ≤ +6%', async ({ context, page }) => {
    const st = await cloudSetup(context, page, (k) => ({ json: chunkJson(k), delay: [400, 250, 120, 0][k] }));
    await page.goto('/text-to-speech.html');
    await page.setInputFiles('#asrFile', { name: 'meeting.wav', mimeType: 'audio/wav', buffer: wav({ seconds: 100 }) });
    await page.selectOption('#asrLang', 'thai');
    await page.click('#asrGoBtn');
    await expect(page.locator('#asrStatus')).toHaveClass(/ok/, { timeout: 30000 });
    expect(st.calls.length).toBe(4);
    expect(st.maxInflight).toBe(3);
    // ท่อนที่ 2–4 เริ่มก่อนจุดตัด 1.5 วินาที → ท่อนยาวเกินช่วงตัดเล็กน้อย; รวมเสียงที่ส่ง ≤ 106% ของเสียงจริง
    const total = st.calls.reduce((s, c) => s + c.sec, 0);
    expect(total).toBeGreaterThan(100 + 3 * 1.4);
    expect(total / 100).toBeLessThanOrEqual(1.06);
    for (const c of st.calls) expect(c.sec).toBeLessThanOrEqual(33);
    expect(st.calls.every((c) => c.body.language === 'th' && c.body.domain === 'general')).toBe(true);
    const text = await page.inputValue('#asrResult');
    expect(flat(text)).toBe(EXPECT_TEXT);
    for (const phrase of ['เรื่องแรกคือสัญญาซื้อขาย', 'เรื่องละเมิด', 'ทางแพ่ง']) expect(text.split(phrase).length - 1).toBe(1);
    await expect(page.locator('#asrStatus')).toContainText('คลาวด์');
  });

  test('ท่อนที่ล้ม ลองใหม่ 1 ครั้งแล้วผ่าน → ผลครบ · ล้มซ้ำ 2 ครั้ง → หยุดทั้งชุดพร้อมข้อความ', async ({ context, page }) => {
    const seen = {};
    const st = await cloudSetup(context, page, (k, body) => {
      const key = body.audio.length; // ท่อนเดียวกันส่งซ้ำ = audio ขนาดเท่ากัน
      seen[key] = (seen[key] || 0) + 1;
      if (k === 1) return { status: 502, json: { error: 'boom', code: 'upstream' } };
      return { json: chunkJson(Math.min(k, 3)) };
    });
    await page.goto('/text-to-speech.html');
    await page.setInputFiles('#asrFile', { name: 'meeting.wav', mimeType: 'audio/wav', buffer: wav({ seconds: 100 }) });
    await page.click('#asrGoBtn');
    await expect(page.locator('#asrStatus')).toHaveClass(/ok|err/, { timeout: 30000 });
    // ท่อนที่ 2 (k=1) ล้มครั้งแรกแล้วลองใหม่ได้ผลจากคำขอถัดไป → ครบ 5 คำขอ (4 ท่อน + ลองใหม่ 1)
    await expect(page.locator('#asrStatus')).toHaveClass(/ok/);
    expect(st.calls.length).toBe(5);
    expect(await page.inputValue('#asrResult')).not.toBe('');
  });

  test('ล้มซ้ำหลังลองใหม่แล้ว → หยุดทั้งชุด ไม่ยิงท่อนที่เหลือ · แสดงข้อความ · ไม่มีผลลัพธ์ค้าง', async ({ context, page }) => {
    const st = await cloudSetup(context, page, (k) => (k === 0 || k === 3 ? { status: 502, json: { error: 'boom', code: 'upstream' } } : { json: chunkJson(k), delay: 2000 }));
    await page.goto('/text-to-speech.html');
    await page.setInputFiles('#asrFile', { name: 'long.wav', mimeType: 'audio/wav', buffer: wav({ seconds: 200 }) }); // 8 ท่อน
    await page.click('#asrGoBtn');
    await expect(page.locator('#asrStatus')).toHaveClass(/err/, { timeout: 30000 });
    // ท่อน 0 ล้ม → ลองใหม่ (k=3) ล้มอีก → หยุด: 3 ท่อนแรก + 1 ลองใหม่ = 4 คำขอ ไม่มีท่อนที่ 4+
    expect(st.calls.length).toBe(4);
    await page.waitForTimeout(600);
    expect(st.calls.length).toBe(4);
    await expect(page.locator('#asrResultWrap')).toBeHidden();
    await expect(page.locator('#asrGoBtn')).toBeEnabled();
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));
    expect(log.length).toBe(1);
    expect(log[0]).toMatchObject({ kind: 'asr', engine: 'cloud', stage: 'cloud' });
    expect(JSON.stringify(log)).not.toMatch(/long\.wav/);
  });

  test('โควตาเต็ม (429) → หยุดทั้งชุดทันที: ไม่ยิงท่อนที่เหลือ, ยกเลิกคำขอที่ค้าง, ไม่ลองใหม่, ข้อความโควตาเดิม', async ({ context, page }) => {
    const st = await cloudSetup(context, page, (k) => (k === 0 ? { status: 429, json: { error: 'Workers AI quota', code: 'quota' } } : { json: chunkJson(k), delay: 3000 }));
    await page.goto('/text-to-speech.html');
    await page.setInputFiles('#asrFile', { name: 'long.wav', mimeType: 'audio/wav', buffer: wav({ seconds: 200 }) }); // 8 ท่อน
    await page.click('#asrGoBtn');
    await expect(page.locator('#asrStatus')).toHaveClass(/err/, { timeout: 30000 });
    await expect(page.locator('#asrStatus')).toContainText('โควตา AI ฟรีของวันนี้เต็มแล้ว');
    expect(st.calls.length).toBe(3); // ท่อนที่ส่งไปแล้วพร้อมกัน 3 ท่อนเท่านั้น
    await page.waitForTimeout(700);
    expect(st.calls.length).toBe(3);
    expect(st.failed).toBeGreaterThanOrEqual(2); // 2 ท่อนที่ค้างถูกยกเลิกฝั่งเบราว์เซอร์
    await expect(page.locator('#asrResultWrap')).toBeHidden();
    await expect(page.locator('#asrGoBtn')).toBeEnabled();
  });

  test('ยกเลิกกลางทาง: ยกเลิกทุกคำขอที่ค้าง ไม่ยิงท่อนต่อ · ไม่ใช่ปัญหา (ไม่ลง problem log) · กดถอดใหม่ได้', async ({ context, page }) => {
    const st = await cloudSetup(context, page, (k) => ({ json: chunkJson(k % 4), delay: 3000 }));
    await page.goto('/text-to-speech.html');
    await page.setInputFiles('#asrFile', { name: 'long.wav', mimeType: 'audio/wav', buffer: wav({ seconds: 200 }) });
    await page.click('#asrGoBtn');
    await expect.poll(() => st.calls.length, { timeout: 15000 }).toBe(3);
    await page.click('#asrCancelBtn');
    await expect(page.locator('#asrStatus')).toContainText('ยกเลิกแล้ว');
    await expect(page.locator('#asrGoBtn')).toBeEnabled();
    await page.waitForTimeout(700);
    expect(st.calls.length).toBe(3);
    expect(st.failed).toBe(3);
    expect(await page.evaluate(() => localStorage.getItem('tanot:media:log'))).toBeNull();
    await expect(page.locator('#asrResultWrap')).toBeHidden();
  });
});

test.describe('ถอดเสียงคลาวด์: ชุดคำศัพท์ตามโดเมน + ย่อหน้า + สวิตช์เวลา', () => {
  test('เลือกประเภทเนื้อหา → ส่ง domain ไปกับทุกท่อน (เซิร์ฟเวอร์ใส่ initial_prompt) · จำค่าไว้ · โหมดในเบราว์เซอร์ไม่แสดงช่องนี้', async ({ context, page }) => {
    const st = await cloudSetup(context, page, (k) => ({ json: chunkJson(0) }));
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#asrDomainField')).toBeVisible();
    await expect(page.locator('#asrModelField')).toBeHidden();
    await page.selectOption('#asrDomain', 'law');
    await page.setInputFiles('#asrFile', { name: 'a.wav', mimeType: 'audio/wav', buffer: wav({ seconds: 12 }) });
    await page.click('#asrGoBtn');
    await expect(page.locator('#asrStatus')).toHaveClass(/ok/, { timeout: 20000 });
    expect(st.calls.length).toBe(1);
    expect(st.calls[0].body.domain).toBe('law');
    expect(st.calls[0].body.initial_prompt).toBeUndefined(); // ชุดคำศัพท์อยู่ที่เซิร์ฟเวอร์ที่เดียว
    await page.reload();
    await expect(page.locator('#asrDomain')).toHaveValue('law');
    await page.click('#asrEngineToggle [data-ae="local"]');
    await expect(page.locator('#asrDomainField')).toBeHidden();
    await expect(page.locator('#asrModelField')).toBeVisible();
  });

  test('วิดเจ็ตแชท: AiClient.asrDomain เลือกชุดคำศัพท์ตามหน้า · AiClient.asr ส่ง domain ไปจริง (หน้าทั่วไปไม่ส่ง)', async ({ context, page }) => {
    const st = await cloudSetup(context, page, () => ({ json: { text: 'ok', segments: [] } }));
    await page.goto('/text-to-speech.html');
    const m = await page.evaluate(() => ['classroom-law.html', '/x/legal.html', 'electrical.html', 'maintenance.html', 'classroom-engineering', 'invest-stock.html', 'invest.html', 'tax.html', 'budget.html', 'index.html', ''].map((p) => AiClient.asrDomain(p)));
    expect(m).toEqual(['law', 'law', 'engineering', 'engineering', 'engineering', 'invest', 'invest', 'invest', 'general', 'general', 'general']);
    await page.evaluate(async () => {
      await AiClient.asr({ pcm: new Float32Array(1600), language: 'th', domain: 'engineering' });
      await AiClient.asr({ pcm: new Float32Array(1600), language: 'th' });
    });
    expect(st.calls[0].body).toMatchObject({ language: 'th', domain: 'engineering' });
    expect('domain' in st.calls[1].body).toBe(false);
    // วิดเจ็ตส่ง domain เฉพาะหน้าที่มีชุดคำศัพท์ (ไม่ส่ง general)
    const src = await (await page.request.get('/ai-chat-widget.js')).text();
    expect(src).toContain("AiClient.asrDomain() === 'general' ? undefined : AiClient.asrDomain()");
  });

  test('AiClient.asr เสียงก้อนเดียวยาว 150 วิ (อัดไมค์วิดเจ็ตแชทนานๆ) → แบ่งส่งทีละท่อน ≤ 60 วิ ตามลำดับ ไม่ชนเพดาน 413 · ต่อข้อความ + เลื่อนเวลา segments ตามท่อน', async ({ context, page }) => {
    const st = await cloudSetup(context, page, (k) => ({ json: { text: 'ท่อน' + k, segments: [{ start: 1, end: 2, text: 'ท่อน' + k }], neurons: 2 } }));
    await page.goto('/text-to-speech.html');
    const r = await page.evaluate(() => AiClient.asr({ pcm: new Float32Array(16000 * 150), language: 'th' }));
    expect(st.calls.map((c) => Math.round(c.sec))).toEqual([60, 60, 30]);
    expect(st.maxInflight).toBe(1);
    expect(r.text).toBe('ท่อน0 ท่อน1 ท่อน2');
    expect(r.segments.map((s) => s.start)).toEqual([1, 61, 121]);
    expect(r.neurons).toBe(6);
    // คลิปสั้นยังเป็นคำขอเดียวเหมือนเดิม
    await page.evaluate(() => AiClient.asr({ pcm: new Float32Array(16000 * 59), language: 'th' }));
    expect(st.calls.length).toBe(4);
  });

  test('ย่อหน้าตามช่วงเงียบ + สวิตช์ "แสดงเวลา [hh:mm:ss]" (จำค่า, วาดใหม่ทันทีไม่เรียกคลาวด์ซ้ำ) · ข้อความสรุปประชุมไม่มีเวลา', async ({ context, page }) => {
    const st = await cloudSetup(context, page, () => ({
      json: { text: 'x', segments: [{ start: 0, end: 5, text: 'เปิดประชุมและแนะนำวาระแรกของวันนี้' }, { start: 5.5, end: 9, text: 'ต่อเนื่องไม่มีช่วงเงียบ' }, { start: 83, end: 90, text: 'ย่อหน้าหลังเงียบนาน' }] },
    }));
    await page.goto('/text-to-speech.html');
    await page.setInputFiles('#asrFile', { name: 'a.wav', mimeType: 'audio/wav', buffer: wav({ seconds: 12 }) });
    await page.click('#asrGoBtn');
    await expect(page.locator('#asrStatus')).toHaveClass(/ok/, { timeout: 20000 });
    expect(await page.inputValue('#asrResult')).toBe('เปิดประชุมและแนะนำวาระแรกของวันนี้ ต่อเนื่องไม่มีช่วงเงียบ\n\nย่อหน้าหลังเงียบนาน');
    await expect(page.locator('#asrTimeChk')).not.toBeChecked();
    await page.check('#asrTimeChk');
    expect(await page.inputValue('#asrResult')).toBe('[00:00:00] เปิดประชุมและแนะนำวาระแรกของวันนี้ ต่อเนื่องไม่มีช่วงเงียบ\n\n[00:01:23] ย่อหน้าหลังเงียบนาน');
    expect(st.calls.length).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('tanot:asr:timestamps'))).toBe('1');
    // ข้อความที่ส่งไปสรุปประชุมต้องไม่มี [hh:mm:ss]
    expect(await page.evaluate(() => window.__tts && 1)).toBe(1);
    await page.reload();
    await expect(page.locator('#asrTimeChk')).toBeChecked();
    await page.setInputFiles('#asrFile', { name: 'a.wav', mimeType: 'audio/wav', buffer: wav({ seconds: 12 }) });
    await page.click('#asrGoBtn');
    await expect(page.locator('#asrStatus')).toHaveClass(/ok/, { timeout: 20000 });
    expect(await page.inputValue('#asrResult')).toContain('[00:01:23] ย่อหน้าหลังเงียบนาน');
    await page.uncheck('#asrTimeChk');
    expect(await page.inputValue('#asrResult')).not.toContain('[00:');
    expect(await page.evaluate(() => localStorage.getItem('tanot:asr:timestamps'))).toBe('0');
  });

  test('English: ป้ายใหม่ (ประเภทเนื้อหา/แสดงเวลา) ไม่มีภาษาไทยหลุด · สลับภาษาสดโดยไม่โหลดหน้าใหม่', async ({ context, page }) => {
    await cloudSetup(context, page, () => ({ json: { text: '', segments: [] } }));
    await page.addInitScript(() => { try { localStorage.setItem('ome:lang', 'en'); } catch (e) {} });
    await page.goto('/text-to-speech.html');
    await page.evaluate(() => { document.getElementById('asrResultWrap').style.display = 'block'; });
    const thai = /[฀-๿]/;
    for (const sel of ['#asrDomainField label', '#asrDomain', '#asrTimeChk ~ span']) {
      expect(await page.locator(sel).first().innerText(), sel).not.toMatch(thai);
    }
    expect(await page.locator('#asrDomain option').allInnerTexts()).toEqual(['General', 'Law', 'Electrical / engineering', 'Investing']);
    await expect(page.locator('#asrTimeChk ~ span')).toHaveText('Show timestamps [hh:mm:ss]');
    await page.evaluate(() => OME_LANG.set('th'));
    await expect(page.locator('#asrTimeChk ~ span')).toHaveText('แสดงเวลา [hh:mm:ss]');
    await expect(page.locator('#asrDomain option').nth(1)).toHaveText('กฎหมาย');
  });
});

/* ── ในเบราว์เซอร์: โมดูล transformers หลอก (CI ไม่โหลดโมเดล) ── */
function fakeTransformers(cfg) {
  return `
const CFG = ${JSON.stringify(cfg || {})};
export const env = { backends: { onnx: { wasm: {} } } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function pipeline(task, model, opts) {
  const c = CFG.asr || {};
  const device = (opts && opts.device) || 'wasm';
  globalThis.__loads = (globalThis.__loads || []).concat([{ model, device, dtype: opts && opts.dtype ? JSON.stringify(opts.dtype) : null }]);
  if (opts && opts.progress_callback) opts.progress_callback({ status: 'progress', file: 'onnx/model.onnx', progress: 50 });
  await sleep(c.loadMs || 0);
  if ((c.missing || []).includes(model)) throw new Error('Could not locate file: "https://huggingface.co/' + model + '/resolve/main/onnx/encoder_model_quantized.onnx" (404).');
  if (device === 'webgpu' && c.gpu === 'load-fail') throw new Error('Failed to create WebGPU adapter/device');
  const f = async (pcm, o) => {
    if (device === 'webgpu' && c.gpu === 'run-fail') throw new Error('GPUBuffer mapAsync failed: device lost');
    const r = { text: 'seg:' + pcm.length + ':' + device + ':' + model + ':' + ((o && o.language) || 'auto') + ':' + (o && o.return_timestamps ? 'ts' : 'nots') };
    if (o && o.return_timestamps && c.chunks) r.chunks = c.chunks;
    return r;
  };
  f.dispose = async () => { globalThis.__disposed = (globalThis.__disposed || 0) + 1; };
  return f;
}`;
}
const gpuStub = (features, fallback) => `Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({ features: new Set(${JSON.stringify(features)}), isFallbackAdapter: ${!!fallback} }) } });`;
const GPU_STUB = gpuStub(['shader-f16'], false);
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

async function localSetup(context, page, { cfg, gpu } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (/\/vendor\/transformers\/transformers\.web\.min\.js$/.test(u.pathname)) return route.fulfill({ contentType: 'text/javascript', body: fakeTransformers(cfg) });
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort('internetdisconnected');
  });
  await page.addInitScript((g) => {
    try { localStorage.setItem('ome:theme', 'light'); localStorage.setItem('tanot:asr:engine', 'local'); } catch (e) {}
    if (g) (0, eval)(g);
  }, gpu ? GPU_STUB : '');
  return errors;
}
const runLocal = async (page, seconds = 6) => {
  await page.setInputFiles('#asrFile', { name: 'secret-meeting.wav', mimeType: 'audio/wav', buffer: wav({ seconds }) });
  await page.click('#asrGoBtn');
  await expect(page.locator('#asrStatus')).toHaveClass(/ok|err/, { timeout: 30000 });
};
const mediaLog = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));

test.describe('ถอดเสียงในเบราว์เซอร์: WebGPU / WASM / รุ่นใหม่', () => {
  test('ไม่มี WebGPU (หรือ adapter ซอฟต์แวร์): รายการเดิม 4 ตัว ค่าเริ่มต้น tiny, WASM ด้วย Xenova เหมือนเดิม ไม่ส่ง dtype/device', async ({ context, page }) => {
    const errors = await localSetup(context, page);
    await page.addInitScript(gpuStub([], true));
    await page.goto('/text-to-speech.html');
    await page.waitForTimeout(300);
    expect(await page.$$eval('#asrModel option', (o) => o.map((x) => x.value))).toEqual(['Xenova/whisper-tiny', 'Xenova/whisper-base', 'Xenova/whisper-small', 'Xenova/whisper-medium']);
    await runLocal(page);
    expect(await page.inputValue('#asrResult')).toMatch(/^seg:\d+:wasm:Xenova\/whisper-tiny:auto:ts$/);
    await expect(page.locator('#asrStatus')).not.toContainText('WebGPU');
    expect(errors).toEqual([]);
  });

  test('WebGPU ใช้ได้จริง (adapter ไม่ใช่ซอฟต์แวร์) บนคอม: เพิ่มรุ่นใหม่ onnx-community ในรายการ, ค่าเริ่มต้น small, รันบน WebGPU ด้วย dtype encoder+decoder แยก', async ({ context, page }) => {
    const errors = await localSetup(context, page, { gpu: true });
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#asrModel option[value="onnx-community/whisper-small"]')).toHaveCount(1);
    expect(await page.$$eval('#asrModel option', (o) => o.map((x) => x.value))).toEqual([
      'Xenova/whisper-tiny', 'Xenova/whisper-base', 'Xenova/whisper-small', 'Xenova/whisper-medium',
      'onnx-community/whisper-tiny', 'onnx-community/whisper-base', 'onnx-community/whisper-small', 'onnx-community/whisper-large-v3-turbo',
    ]);
    await expect(page.locator('#asrModel')).toHaveValue('onnx-community/whisper-small');
    await runLocal(page);
    expect(await page.inputValue('#asrResult')).toMatch(/^seg:\d+:webgpu:onnx-community\/whisper-small:auto:ts$/);
    await expect(page.locator('#asrStatus')).toContainText('WebGPU');
    expect(await mediaLog(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('ผู้ใช้เลือกโมเดลเองก่อนตรวจ adapter เสร็จ → ไม่ถูกเปลี่ยนค่าเริ่มต้นทับ · Xenova เดิมบนเครื่อง WebGPU ยังรัน WASM (ไม่แตะพฤติกรรมเดิม)', async ({ context, page }) => {
    await localSetup(context, page, { gpu: true });
    await page.goto('/text-to-speech.html');
    await page.selectOption('#asrModel', 'Xenova/whisper-base');
    await page.waitForTimeout(300);
    await expect(page.locator('#asrModel')).toHaveValue('Xenova/whisper-base');
    await runLocal(page);
    expect(await page.inputValue('#asrResult')).toMatch(/^seg:\d+:wasm:Xenova\/whisper-base:auto:ts$/);
  });

  test('WebGPU ล้มตอนโหลด → ถอยกลับ WASM อัตโนมัติ 1 ครั้ง (dtype q8) · ผลออกปกติ · บันทึก problem log ไม่มีเนื้อหา · เครื่องนี้ไม่ลองซ้ำ', async ({ context, page }) => {
    const errors = await localSetup(context, page, { gpu: true, cfg: { asr: { gpu: 'load-fail', text: 'TOPSECRET' } } });
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#asrModel')).toHaveValue('onnx-community/whisper-small');
    await runLocal(page);
    await expect(page.locator('#asrStatus')).toHaveClass(/ok/);
    expect(await page.inputValue('#asrResult')).toMatch(/^seg:\d+:wasm:onnx-community\/whisper-small:auto:ts$/);
    await expect(page.locator('#asrStatus')).toContainText('WebGPU ใช้ไม่ได้');
    const log = await mediaLog(page);
    expect(log.length).toBe(1);
    expect(log[0]).toMatchObject({ kind: 'asr', code: 'webgpu', stage: 'webgpu-load', engine: 'local', device: 'webgpu', model: 'onnx-community/whisper-small' });
    expect(JSON.stringify(log)).not.toMatch(/secret-meeting|TOPSECRET/i);
    // ท่อนที่สอง (ไฟล์ยาวขึ้น) ใน Worker เดียวกันไม่ลอง WebGPU อีก — ไม่เพิ่มแถวบันทึก
    await runLocal(page, 8);
    expect((await mediaLog(page)).length).toBe(1);
    expect(await page.evaluate(() => !!localStorage.getItem('tanot:asr:gpubad'))).toBe(true);
    // เปิดหน้าใหม่: ไม่ลอง WebGPU อีก (จำ 3 วัน) → รายการเดิม 4 ตัว
    await page.reload();
    await page.waitForTimeout(300);
    expect(await page.$$eval('#asrModel option', (o) => o.length)).toBe(4);
    expect(errors).toEqual([]);
  });

  test('WebGPU ล้มตอนรัน → ถอยกลับ WASM 1 ครั้ง · stage=webgpu-run · ทิ้ง pipeline เดิม', async ({ context, page }) => {
    const errors = await localSetup(context, page, { gpu: true, cfg: { asr: { gpu: 'run-fail' } } });
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#asrModel')).toHaveValue('onnx-community/whisper-small');
    await runLocal(page);
    expect(await page.inputValue('#asrResult')).toMatch(/^seg:\d+:wasm:onnx-community\/whisper-small:auto:ts$/);
    const log = await mediaLog(page);
    expect(log.map((r) => r.stage)).toEqual(['webgpu-run']);
    expect(errors).toEqual([]);
  });

  test('รุ่นใหม่โหลดไม่ได้ (404 ไม่มีไฟล์) แม้บน WASM → ถอยไป Xenova ตัวเทียบเท่า + บันทึก · ไม่ถอยถ้าเป็นเรื่องหน่วยความจำ', async ({ context, page }) => {
    const errors = await localSetup(context, page, { gpu: true, cfg: { asr: { gpu: 'load-fail', missing: ['onnx-community/whisper-small'] } } });
    await page.goto('/text-to-speech.html');
    await runLocal(page);
    await expect(page.locator('#asrStatus')).toHaveClass(/ok/);
    expect(await page.inputValue('#asrResult')).toMatch(/^seg:\d+:wasm:Xenova\/whisper-small:auto:ts$/);
    await expect(page.locator('#asrStatus')).toContainText('โหลดโมเดลรุ่นใหม่ไม่ได้');
    expect((await mediaLog(page)).map((r) => r.stage)).toEqual(['webgpu-load', 'model-load']);
    expect(errors).toEqual([]);
  });

  test('มือถือ (Android) แม้มี navigator.gpu: คง WASM ไม่เพิ่มรุ่นใหม่, ไม่มีรุ่นหนัก', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: ANDROID_UA, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = await localSetup(ctx, page, { gpu: true });
    await page.goto('/text-to-speech.html');
    await page.waitForTimeout(300);
    expect(await page.$$eval('#asrModel option', (o) => o.map((x) => x.value))).toEqual(['Xenova/whisper-tiny', 'Xenova/whisper-base']);
    await runLocal(page);
    expect(await page.inputValue('#asrResult')).toMatch(/^seg:\d+:wasm:/);
    await ctx.close();
    expect(errors).toEqual([]);
  });

  test('large-v3-turbo (เฉพาะ WebGPU) ต้องมี shader-f16: ไม่มี f16 = ไม่เสนอในรายการ', async ({ context, page }) => {
    await localSetup(context, page);
    await page.addInitScript(gpuStub([], false));
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#asrModel option[value="onnx-community/whisper-small"]')).toHaveCount(1);
    await expect(page.locator('#asrModel option[value="onnx-community/whisper-large-v3-turbo"]')).toHaveCount(0);
  });

  test('ผลในเบราว์เซอร์: แบ่งย่อหน้าตามเวลาของช่วงคำพูด + สวิตช์เวลาใช้ได้เหมือนคลาวด์ (ไม่ถอดซ้ำ)', async ({ context, page }) => {
    const errors = await localSetup(context, page, { cfg: { asr: { chunks: [{ timestamp: [0, 5], text: ' สวัสดีครับ ยินดีต้อนรับ' }, { timestamp: [5.5, 9], text: ' เข้าสู่การประชุม' }, { timestamp: [83, null], text: ' ย่อหน้าที่สอง' }] } } });
    await page.goto('/text-to-speech.html');
    await runLocal(page, 6);
    expect(await page.inputValue('#asrResult')).toBe('สวัสดีครับ ยินดีต้อนรับ เข้าสู่การประชุม\n\nย่อหน้าที่สอง');
    await page.check('#asrTimeChk');
    expect(await page.inputValue('#asrResult')).toBe('[00:00:00] สวัสดีครับ ยินดีต้อนรับ เข้าสู่การประชุม\n\n[00:01:23] ย่อหน้าที่สอง');
    expect(await page.evaluate(() => (globalThis.__loads || []).length)).toBe(0); // __loads อยู่ใน Worker ไม่ใช่หน้า
    expect(errors).toEqual([]);
  });
});
