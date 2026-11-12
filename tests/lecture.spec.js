// @ts-check
// โน้ตจากเสียงบรรยาย (lecture-calc.js / lecture.html / ปุ่มในหน้า text-to-speech) — ROADMAP แถว 4
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');

const L = require(path.join(__dirname, '..', 'lecture-calc.js'));
const FS = require(path.join(__dirname, '..', 'fsrs.js'));

const NOW = Date.UTC(2026, 10, 12, 3, 0);
const GOOD = JSON.stringify({
  title: 'แรงเฉือนในคาน', subject: 'วิศวกรรมโครงสร้าง', summary: 'อธิบายแรงเฉือนและแผนภาพ SFD',
  points: ['แรงเฉือน V = dM/dx', 'จุดที่ V = 0 โมเมนต์สูงสุด'],
  cards: [{ q: 'แรงเฉือนคือ?', a: 'แรงภายในที่ขนานหน้าตัด' }, { q: 'V = 0 ที่จุดใด?', a: 'โมเมนต์ดัดสูงสุด' }],
});

test.describe('lecture-calc.js (known-answer)', () => {
  test('parse: JSON ล้วน / ในโค้ดบล็อก / มีข้อความนำหน้า — ได้ผลเดียวกัน', () => {
    const want = L.parse(GOOD);
    expect(want).toMatchObject({ title: 'แรงเฉือนในคาน', subject: 'วิศวกรรมโครงสร้าง' });
    expect(want.points).toHaveLength(2);
    expect(want.cards).toHaveLength(2);
    expect(L.parse('```json\n' + GOOD + '\n```')).toEqual(want);
    expect(L.parse('นี่คือผลลัพธ์:\n' + GOOD + '\nหวังว่าจะเป็นประโยชน์')).toEqual(want);
  });

  test('parse: ไม่ใช่ JSON / ไม่มีเนื้อหา = null · ตัดการ์ดที่ว่าง ซ้ำ เกินจำนวน · ตัดความยาว', () => {
    expect(L.parse('')).toBeNull();
    expect(L.parse('สรุป: ไม่มี json')).toBeNull();
    expect(L.parse('{"title":"","summary":"","points":[],"cards":[]}')).toBeNull();
    const many = [];
    for (let i = 0; i < 30; i++) many.push({ q: 'ข้อ ' + i, a: 'ตอบ ' + i });
    const r = L.parse(JSON.stringify({ title: 'ก', summary: 'ข', points: ['x', 'x', ' ', 'y'], cards: [{ q: 'a', a: '' }, { q: 'ข้อ 0', a: 'ตอบ' }, { q: 'ข้อ 0', a: 'ซ้ำ' }].concat(many) }));
    expect(r.points).toEqual(['x', 'y']);
    expect(r.cards.length).toBeLessThanOrEqual(L.MAX_CARDS);
    expect(r.cards.filter((c) => c.q === 'ข้อ 0')).toHaveLength(1);
    expect(r.cards.some((c) => !c.a)).toBe(false);
    expect(L.parse(JSON.stringify({ title: 'ก'.repeat(500), summary: 'ข' })).title.length).toBe(L.LIMITS.title);
  });

  test('messages: ข้อความถอดเสียงเป็น user, โครง JSON อยู่ใน system, subject ที่ผู้ใช้ตั้งถูกส่งไปด้วย', () => {
    const m = L.messages('สวัสดีครับวันนี้เรียนเรื่องคาน', 'วิศวกรรมโครงสร้าง');
    expect(m[0].role).toBe('system');
    expect(m[0].content).toContain('"cards"');
    expect(m[0].content).toContain('วิศวกรรมโครงสร้าง');
    expect(m.find((x) => x.role === 'user').content).toBe('สวัสดีครับวันนี้เรียนเรื่องคาน');
    expect(L.messages('x', '')[0].content).not.toContain('วิชา:');
  });

  test('chunk: ตัดที่ขอบย่อหน้า ท่อนไม่เกินเพดาน ต่อกันได้ข้อความเดิมครบ · ย่อหน้าเดียวยาวเกินถูกหั่นตามความยาว', () => {
    const paras = ['ก'.repeat(40), 'ข'.repeat(40), 'ค'.repeat(40)];
    const c = L.chunk(paras.join('\n\n'), 100);
    expect(c).toEqual([paras[0] + '\n' + paras[1], paras[2]]);
    const long = L.chunk('ง'.repeat(250), 100);
    expect(long.map((x) => x.length)).toEqual([100, 100, 50]);
    expect(long.join('')).toBe('ง'.repeat(250));
    expect(L.chunk('', 100)).toEqual([]);
  });

  test('cardId: ตายตัวต่อ (โน้ต, คำถาม) — สร้างซ้ำได้ id เดิม, คำถามต่างกัน id ต่างกัน, เว้นวรรค/ตัวพิมพ์ไม่นับ', () => {
    const a = L.cardId('lec-1', 'แรงเฉือนคือ?');
    expect(a).toBe(L.cardId('lec-1', '  แรงเฉือนคือ?  '));
    expect(a).not.toBe(L.cardId('lec-1', 'โมเมนต์คือ?'));
    expect(a).not.toBe(L.cardId('lec-2', 'แรงเฉือนคือ?'));
    expect(L.cardId('lec-1', 'ABC')).toBe(L.cardId('lec-1', 'abc'));
    expect(a.indexOf('card-lec-1-')).toBe(0);
  });

  test('makeCard: การ์ดใหม่ยังไม่มีฟิลด์ FSRS และถึงกำหนดทันที · สร้างซ้ำไม่ล้างตารางทบทวน', () => {
    const note = { id: 'lec-1', subject: 'วิศวกรรม' };
    const c = L.makeCard(note, { q: 'แรงเฉือนคือ?', a: 'แรงขนานหน้าตัด' }, NOW);
    expect(c).toMatchObject({ noteId: 'lec-1', front: 'แรงเฉือนคือ?', back: 'แรงขนานหน้าตัด', createdAt: NOW, dueAt: NOW });
    expect(c.stability).toBeUndefined();
    const scheduled = Object.assign({}, c, FS.schedule(c, 3, NOW));
    expect(scheduled.dueAt).toBeGreaterThan(NOW);
    const again = L.makeCard(note, { q: 'แรงเฉือนคือ?', a: 'แก้คำตอบใหม่' }, NOW + 999, scheduled);
    expect(again).toMatchObject({ back: 'แก้คำตอบใหม่', dueAt: scheduled.dueAt, stability: scheduled.stability, reps: scheduled.reps, createdAt: NOW });
  });

  test('noteFrom: แถวโน้ตมีเฉพาะที่ผู้ใช้เลือก, id ตายตัวจากเวลาสร้าง, ไม่เก็บข้อความถอดเสียง', () => {
    const p = L.parse(GOOD);
    const n = L.noteFrom(p, { id: 'lec-abc', now: NOW, subject: '' });
    expect(n).toMatchObject({ id: 'lec-abc', title: 'แรงเฉือนในคาน', subject: 'วิศวกรรมโครงสร้าง', createdAt: NOW });
    expect(n.points).toHaveLength(2);
    expect(n.transcript).toBeUndefined();
    expect(L.noteFrom(p, { id: 'x', now: NOW, subject: 'ผู้ใช้ตั้งเอง' }).subject).toBe('ผู้ใช้ตั้งเอง');
    expect(L.newId(NOW)).toBe(L.newId(NOW));
    expect(L.newId(NOW)).toMatch(/^lec-[0-9a-z]+$/);
  });
});

/* ── หน้า: ปุ่มใน text-to-speech → บันทึก → lecture.html → review.html ── */
const NOTES = 'tanot:lecture:notes', CARDS = 'tanot:lecture:cards';
const store = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);
const TRANSCRIPT = '[00:00:05] วันนี้เรียนเรื่องแรงเฉือนในคาน\n\n[00:01:10] แรงเฉือนคือแรงภายในที่ขนานหน้าตัด';

async function openTts(page, { reply = GOOD, status = 200 } = {}) {
  const errors = await prepare(page);
  const calls = [];
  await page.route('**/api/ai/summarize', (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    calls.push(b);
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { text: typeof reply === 'function' ? reply(b, calls.length) : reply, cached: false, model: 'm' } : { error: 'x' }) });
  });
  const other = [];
  await page.route('**/api/ocr', (route) => { other.push('ocr'); return route.abort(); });
  await page.route('**/api/ai/usage', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ used: 0, limit: 10000 }) }));
  await page.addInitScript(() => { window.TANOT_AI = { enabled: true }; localStorage.setItem('tanot:asr:lang', 'thai'); });
  await page.goto('/text-to-speech.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  await page.evaluate((t) => { const r = document.getElementById('asrResult'); r.value = t; document.getElementById('asrResultWrap').style.display = 'block'; }, TRANSCRIPT);
  return { errors, calls, other };
}

test.describe('หน้า text-to-speech: ทำเป็นโน้ตเรียน', () => {
  test('ปุ่มโผล่เฉพาะเมื่อมีคลาวด์ · ไม่มีคลาวด์ = ซ่อน', async ({ page }) => {
    await prepare(page);
    await page.goto('/text-to-speech.html', { waitUntil: 'load' });
    await expect(page.locator('#lecBtn')).toBeHidden();
  });

  test('สร้างร่าง → ตรวจ/เอาการ์ดออก → บันทึก = โน้ต 1 แถว + การ์ดเฉพาะที่ติ๊ก · บันทึกซ้ำไม่เกิดแถวซ้ำ · ไม่เก็บข้อความถอดเสียง · ไม่เรียก OCR', async ({ page }) => {
    const { errors, calls, other } = await openTts(page);
    await page.fill('#lecSubject', 'โครงสร้าง');
    await page.click('#lecBtn');
    await expect(page.locator('#lecWrap')).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ task: 'lecture' });
    const sent = calls[0].messages;
    expect(sent.find((m) => m.role === 'user').content).toBe('วันนี้เรียนเรื่องแรงเฉือนในคาน\n\nแรงเฉือนคือแรงภายในที่ขนานหน้าตัด'); // ไม่มี [hh:mm:ss]
    await expect(page.locator('#lecTitle')).toHaveValue('แรงเฉือนในคาน');
    await expect(page.locator('#lecSubject')).toHaveValue('โครงสร้าง');     // ที่ผู้ใช้ตั้งไว้ไม่ถูกทับ
    await expect(page.locator('#lecCards input')).toHaveCount(2);
    expect(await store(page, NOTES)).toBeNull();                              // ยังไม่บันทึกจนกดเอง
    await page.locator('#lecCards input').nth(1).uncheck();
    await page.click('#lecSave');
    const notes = await store(page, NOTES), cards = await store(page, CARDS);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ title: 'แรงเฉือนในคาน', subject: 'โครงสร้าง', summary: 'อธิบายแรงเฉือนและแผนภาพ SFD' });
    expect(JSON.stringify(notes)).not.toContain('วันนี้เรียนเรื่อง');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ noteId: notes[0].id, front: 'แรงเฉือนคือ?', subject: 'โครงสร้าง' });
    await expect(page.locator('#lecOpen')).toHaveAttribute('href', 'lecture.html#' + notes[0].id);
    await page.click('#lecSave');
    expect(await store(page, NOTES)).toHaveLength(1);
    expect(await store(page, CARDS)).toHaveLength(1);
    expect(other).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('ข้อความยาว > 40,000 ตัวอักษร = สรุปทีละท่อน (fast) แล้วรวมเป็นโน้ตเดียว', async ({ page }) => {
    const { calls } = await openTts(page, { reply: (b) => (b.task === 'lecture-part' ? '- ประเด็น' : GOOD) });
    await page.evaluate(() => { document.getElementById('asrResult').value = Array.from({ length: 60 }, (_, i) => 'บรรทัดที่ ' + i + ' ' + 'ก'.repeat(900)).join('\n'); });
    await page.click('#lecBtn');
    await expect(page.locator('#lecWrap')).toBeVisible();
    const parts = calls.filter((c) => c.task === 'lecture-part');
    expect(parts.length).toBeGreaterThanOrEqual(5);
    expect(parts.every((c) => c.model === 'fast')).toBe(true);
    expect(calls[calls.length - 1].task).toBe('lecture');
    expect(calls[calls.length - 1].messages.find((m) => m.role === 'user').content).toContain('- ประเด็น');
  });

  test('AI ตอบไม่ใช่ JSON / ล้ม = ข้อความ error ในกล่อง ไม่บันทึกอะไร กดซ้ำได้', async ({ page }) => {
    const { calls } = await openTts(page, { reply: 'ขอโทษครับ ทำไม่ได้' });
    await page.click('#lecBtn');
    await expect(page.locator('#lecStatus')).toHaveClass(/err/);
    await expect(page.locator('#lecWrap')).toBeHidden();
    expect(await store(page, NOTES)).toBeNull();
    await expect(page.locator('#lecBtn')).toBeEnabled();
    await page.click('#lecBtn');
    expect(calls).toHaveLength(2);
  });

  test('ไม่มีข้อความถอดเสียง = บอกผู้ใช้ ไม่เรียก AI', async ({ page }) => {
    const { calls } = await openTts(page);
    await page.evaluate(() => { document.getElementById('asrResult').value = ''; });
    await page.click('#lecBtn');
    await expect(page.locator('#lecStatus')).toHaveClass(/err/);
    expect(calls).toHaveLength(0);
  });
});

test.describe('lecture.html + review.html', () => {
  const NOW = new Date('2026-11-12T10:00:00+07:00');
  const seed = () => {
    const note = { id: 'lec-a', title: 'แรงเฉือนในคาน', subject: 'โครงสร้าง', summary: 'สรุป', points: ['ข้อ 1', 'ข้อ 2'], createdAt: NOW.getTime() };
    const card = (id, q) => ({ id, noteId: 'lec-a', subject: 'โครงสร้าง', front: q, back: 'ตอบ ' + q, createdAt: NOW.getTime() - 1000, dueAt: NOW.getTime() - 1000 });
    return { [NOTES]: [note, Object.assign({}, note, { id: 'lec-b', title: 'โน้ตอีกอัน', createdAt: NOW.getTime() - 9e5, points: [] })], [CARDS]: [card('card-lec-a-1', 'ข้อหนึ่ง?'), card('card-lec-a-2', 'ข้อสอง?')] };
  };
  async function open(page, p, data) {
    const errors = await prepare(page);
    await page.addInitScript((d) => { if (d && !localStorage.getItem('__seeded')) { for (const k of Object.keys(d)) localStorage.setItem(k, JSON.stringify(d[k])); localStorage.setItem('__seeded', '1'); } }, data);
    await page.clock.setFixedTime(NOW);
    await page.goto(p, { waitUntil: 'load' });
    await page.waitForSelector('nav.ome-nav');
    return errors;
  }

  test('ว่าง = ข้อความ + ปุ่มไปถอดเสียง · มีข้อมูล = โน้ตใหม่สุดก่อน + จำนวนการ์ด', async ({ page }) => {
    const errors = await open(page, '/lecture.html', null);
    await expect(page.locator('#list .empty')).toBeVisible();
    await expect(page.locator('#list a, #list button')).toHaveCount(0); // ปุ่มเริ่มอยู่ที่หัวหน้าปุ่มเดียว
    await page.evaluate(([k, d]) => { localStorage.setItem(k, JSON.stringify(d)); }, [NOTES, seed()[NOTES]]);
    await page.reload(); await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('.lec-note h2').first()).toHaveText('แรงเฉือนในคาน');
    expect(errors).toEqual([]);
  });

  test('ลบโน้ต = ลบการ์ดของโน้ตนั้นด้วย โน้ตอื่นไม่กระทบ', async ({ page }) => {
    const errors = await open(page, '/lecture.html', seed());
    await expect(page.locator('.lec-note')).toHaveCount(2);
    await expect(page.locator('#lec-a .lec-acts a')).toContainText('2');
    await page.locator('#lec-a .lec-acts button').click();
    const box = page.locator('dialog:has(.dialog-msg)');
    await box.locator('.btn.danger').click();
    await expect(page.locator('.lec-note')).toHaveCount(1);
    expect((await store(page, NOTES)).map((n) => n.id)).toEqual(['lec-b']);
    expect(await store(page, CARDS)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('การ์ดเข้ากองรวมของ review.html (แหล่ง lecture) → ให้คะแนน เขียน FSRS กลับที่แถวเดิม + นับในหน้าวันนี้', async ({ page }) => {
    const errors = await open(page, '/review.html#lecture', seed());
    await expect(page.locator('#rvFilter')).toContainText('โน้ตจากเสียง 2');
    await page.click('#rvCard');
    await expect(page.locator('#rvCard .a')).toContainText('ตอบ');
    await page.click('[data-r="3"]');
    const cards = await store(page, CARDS);
    expect(cards).toHaveLength(2);
    const done = cards.filter((c) => c.reps === 1);
    expect(done).toHaveLength(1);
    expect(done[0].dueAt).toBeGreaterThan(NOW.getTime());
    expect(await page.evaluate(() => window.LearnCore.summary().bySrc.lecture)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.LearnCore.dueCounts([]).lecture)).toBe(1);
    expect(errors).toEqual([]);
  });
});
