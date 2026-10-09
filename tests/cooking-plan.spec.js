// @ts-check
// ทำอาหาร stage 2 (cooking.html / cooking-plan.js / cooking-plan-calc.js / functions/api/files.js ns recipes) — ROADMAP งานอดิเรก P2
// กฎเหล็ก: แยกสูตรด้วย Workers AI (/api/ai/chat) เท่านั้น ไม่เรียก /api/ocr · ไม่แตะคีย์เดิมของบทเรียน (tanot:cooking:xp|streak|badges|progress|notes)
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');

const C = require(path.join(__dirname, '..', 'cooking-plan-calc.js'));
const SRV = 'http://localhost:8135';
const NOW = new Date('2026-09-30T10:30:00+07:00'); // พุธ — สัปดาห์ที่เริ่มจันทร์ 2026-09-28
const WEEK = '2026-09-28';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
// ทั้งไฟล์ใช้เซิร์ฟเวอร์เดียวที่มี /__reset ล้าง D1+R2 — ห้ามให้ describe ต่างกลุ่มรันขนานกัน
test.describe.configure({ mode: 'serial' });

const R = (id, name, servings, ings) => ({ id, name, servings, ingredients: ings.map(([n, q, u, c]) => ({ name: n, qty: q, unit: u, cat: c || 'other' })), steps: [], tags: [], photo: null });

test.describe('cooking-plan-calc.js (known-answer)', () => {
  test('unitInfo: ชื่อหน่วยไทย/อังกฤษ → กลุ่มเดียวกัน · หน่วยที่ไม่รู้จัก = กลุ่มของตัวเอง', () => {
    expect(C.unitInfo('กก.').fam).toBe('w'); expect(C.unitInfo('kg').f).toBe(1000); expect(C.unitInfo(' กรัม ').f).toBe(1);
    expect(C.unitInfo('ลิตร').f).toBe(1000); expect(C.unitInfo('มล.').fam).toBe('v');
    expect(C.unitInfo('ช้อนชา').f).toBe(5); expect(C.unitInfo('ช้อนโต๊ะ').f).toBe(15);
    expect(C.unitInfo('ฟอง').fam).not.toBe(C.unitInfo('ลูก').fam);
    expect(C.unitInfo('ฟอง').fam).toBe(C.unitInfo('ฟอง ').fam);
  });

  test('aggregate: ชื่อตรงกันไม่สนตัวพิมพ์/ช่องว่าง · กรัม+กก. บวกกัน · มล.+ลิตร · ช้อนชา 3 = ช้อนโต๊ะ 1 · ต่างหน่วยที่แปลงไม่ได้แยกบรรทัด', () => {
    const rs = [
      R('a', 'A', 2, [['หมูสับ', 500, 'กรัม', 'meat'], ['Egg', 2, 'ฟอง', 'meat'], ['น้ำมัน', 500, 'มล.', 'sauce'], ['เกลือ', 1, 'ช้อนชา', 'sauce'], ['น้ำตาล', 1, 'ช้อนโต๊ะ', 'sauce'], ['พริก', 100, 'กรัม', 'veg']]),
      R('b', 'B', 2, [['หมู สับ', 1, 'กก.', 'meat'], [' egg', 100, 'กรัม', 'meat'], ['น้ำมัน', 1, 'ลิตร', 'sauce'], ['เกลือ', 2, 'ช้อนชา', 'sauce'], ['น้ำตาล', 2, 'ช้อนโต๊ะ', 'sauce'], ['พริก', 1, 'ฟอง', 'veg']])
    ];
    const plan = { week: WEEK, slots: { '0:l': { recipeId: 'a', servings: 2 }, '1:d': { recipeId: 'b', servings: 2 } } };
    const lines = C.aggregate(plan, rs);
    const get = (n, u) => lines.find((l) => C.normName(l.name) === C.normName(n) && l.unit === u);
    expect(get('หมูสับ', 'กก.')).toMatchObject({ qty: 1.5, cat: 'meat' });
    expect(lines.filter((l) => C.normName(l.name) === 'egg').map((l) => [l.qty, l.unit]).sort()).toEqual([[100, 'กรัม'], [2, 'ฟอง']]); // ฟอง กับ กรัม แปลงกันไม่ได้
    expect(get('น้ำมัน', 'ลิตร')).toMatchObject({ qty: 1.5 });
    expect(get('เกลือ', 'ช้อนโต๊ะ')).toMatchObject({ qty: 1 });       // 1 + 2 ช้อนชา = 3 ช้อนชา = 1 ช้อนโต๊ะ
    expect(get('น้ำตาล', 'ช้อนโต๊ะ')).toMatchObject({ qty: 3 });
    expect(lines.filter((l) => l.name === 'พริก').map((l) => [l.qty, l.unit]).sort()).toEqual([[1, 'ฟอง'], [100, 'กรัม']]);
    expect(lines.length).toBe(8);
    // รวมช้อนที่ไม่ลงตัวกับ 3 ช้อนชา → ช้อนชา · ปนกับ มล. → มล.
    expect(C.aggregate({ week: WEEK, slots: { '0:l': { recipeId: 'c', servings: 1 } } }, [R('c', 'C', 1, [['ก', 1, 'ช้อนโต๊ะ'], ['ก', 1, 'ช้อนชา'], ['ข', 1, 'ช้อนโต๊ะ'], ['ข', 20, 'มล.']])])
      .map((l) => [l.name, l.qty, l.unit])).toEqual([['ก', 4, 'ช้อนชา'], ['ข', 35, 'มล.']]);
  });

  test('aggregate: ปรับตามจำนวนที่ของช่อง (÷ ที่ของสูตร) · qty ว่างไม่เพิ่มยอดแต่ยังขึ้นบรรทัด · สูตรที่หายไปข้าม', () => {
    const rs = [R('a', 'A', 2, [['หมูสับ', 200, 'กรัม', 'meat'], ['เกลือ', null, '', 'sauce']])];
    const plan = { week: WEEK, slots: { '0:l': { recipeId: 'a', servings: 6 }, '1:l': { recipeId: 'a', servings: 1 }, '2:l': { recipeId: 'zzz', servings: 2 } } };
    const lines = C.aggregate(plan, rs);
    expect(lines.map((l) => [l.name, l.qty, l.unit])).toEqual([['หมูสับ', 700, 'กรัม'], ['เกลือ', null, '']]); // 200×3 + 200×0.5
    expect(lines[0].from).toEqual(['A']);
    // id ของบรรทัดคงที่ (ติ๊กไว้แล้วสร้างใหม่ก็ยังตรงบรรทัดเดิม)
    expect(C.aggregate(plan, rs)[0].id).toBe(lines[0].id);
    expect(C.aggregate({ week: WEEK, slots: { '0:l': { recipeId: 'a', servings: 2 } } }, rs)[0].id).toBe(lines[0].id);
  });

  test('วันของแผน: จันทร์เริ่มสัปดาห์ เวลาไทย (ไม่ขึ้นกับเขตเวลาเครื่อง)', () => {
    expect(C.weekStart(Date.parse('2026-09-30T10:30:00+07:00'))).toBe('2026-09-28');
    expect(C.weekStart(Date.parse('2026-09-28T00:10:00+07:00'))).toBe('2026-09-28');
    expect(C.weekStart(Date.parse('2026-10-04T23:50:00+07:00'))).toBe('2026-09-28');
    expect(C.weekStart(Date.parse('2026-10-04T17:10:00Z'))).toBe('2026-10-05'); // 00:10 ไทยของวันจันทร์
    expect(C.addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(C.weekDays(WEEK)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  });

  test('copyPrev: เติมเฉพาะช่องว่าง ไม่ทับ ไม่ก๊อป "ทำแล้ว" ข้ามสูตรที่ไม่มีแล้ว · fillRandom: เติมทุกช่องว่าง ไม่ซ้ำสูตรติดกัน', () => {
    const rs = [R('a', 'A', 2, []), R('b', 'B', 3, []), R('c', 'C', 2, [])];
    const prev = { week: '2026-09-21', slots: { '0:l': { recipeId: 'a', servings: 2 }, '1:d': { recipeId: 'b', servings: 3 }, '2:b': { recipeId: 'gone', servings: 2 } }, done: { '0:l': 5 }, awarded: { '0:l': 5 } };
    const cur = { week: WEEK, slots: { '1:d': { recipeId: 'c', servings: 5 } } };
    const r = C.copyPrev(prev, cur, rs);
    expect(r.added).toBe(1);
    expect(r.plan.slots).toEqual({ '1:d': { recipeId: 'c', servings: 5 }, '0:l': { recipeId: 'a', servings: 2 } });
    expect(r.plan.done).toEqual({});
    let n = 0;
    const rng = () => ((n = (n * 7 + 3) % 11) / 11);
    const f = C.fillRandom({ week: WEEK, slots: { '0:l': { recipeId: 'a', servings: 9 } } }, rs, rng);
    expect(f.added).toBe(20);
    const order = C.allSlots().map((k) => f.plan.slots[k].recipeId);
    for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
    expect(f.plan.slots['0:l']).toEqual({ recipeId: 'a', servings: 9 }); // ช่องที่มีอยู่ไม่ถูกแตะ
    expect(C.fillRandom({ week: WEEK }, [], rng).added).toBe(0);
  });

  test('ติ๊ก/ราคา 2 เครื่อง: แต่ละช่องเอาค่าที่ใหม่สุด · คนละบรรทัดไม่ทับกัน · เพิ่มเอง/ลบบรรทัดได้ · ยอดรวมนับเฉพาะบรรทัดที่ใส่ราคา', () => {
    const list = { id: 'shop-' + WEEK, week: WEEK, lines: [{ id: 'g:1', name: 'หมูสับ', qty: 1, unit: 'กก.', cat: 'meat' }, { id: 'g:2', name: 'กระเทียม', qty: 5, unit: 'กลีบ', cat: 'veg' }, { id: 'g:3', name: 'เกลือ', qty: null, unit: '', cat: 'sauce' }] };
    const a = { id: C.tickRowId(list.id, 'A'), kind: 'ticks', listId: list.id, dev: 'A', lines: {} };
    const b = { id: C.tickRowId(list.id, 'B'), kind: 'ticks', listId: list.id, dev: 'B', lines: {} };
    C.setField(a, 'g:1', 'c', true, 1000); C.setField(a, 'g:1', 'p', 120, 1000);
    C.setField(b, 'g:2', 'c', true, 1001); C.setField(b, 'g:2', 'p', 15.5, 1001);
    C.setField(b, 'g:1', 'p', 130, 2000);                      // B แก้ราคาทีหลัง → ชนะ แต่ติ๊กของ A ยังอยู่
    C.setField(a, 'm:x', 'm', { name: 'ผักชี', qty: 2, unit: 'กำ', cat: 'veg' }, 1500);
    C.setField(a, 'g:3', 'x', true, 1600);                      // ลบบรรทัดเกลือ
    const v = C.shoppingView(list, [a, b]);
    const by = Object.fromEntries(v.lines.map((l) => [l.id, l]));
    expect(by['g:1']).toMatchObject({ checked: true, price: 130 });
    expect(by['g:2']).toMatchObject({ checked: true, price: 15.5 });
    expect(by['g:3']).toBeUndefined();
    expect(by['m:x']).toMatchObject({ name: 'ผักชี', manual: true, qty: 2, unit: 'กำ', cat: 'veg', checked: false });
    expect(v.total).toBe(145.5); expect(v.priced).toBe(2); expect(v.checked).toBe(2); expect(v.count).toBe(3);
    expect(v.groups.map((g) => g.cat)).toEqual(['veg', 'meat']);
    // ติ๊กออกทีหลังจากอีกเครื่อง = ชนะ
    C.setField(b, 'g:1', 'c', false, 3000);
    expect(C.shoppingView(list, [a, b]).lines.find((l) => l.id === 'g:1').checked).toBe(false);
    // setField เวลาย้อนกลับก็ยังใหม่กว่าค่าเดิมเสมอ
    C.setField(b, 'g:1', 'c', true, 10);
    expect(C.shoppingView(list, [a, b]).lines.find((l) => l.id === 'g:1').checked).toBe(true);
    expect(C.cleanPrice('1,234.567')).toBe(1234.57); expect(C.cleanPrice('')).toBeNull(); expect(C.cleanPrice('-3')).toBeNull();
  });

  test('budget: หมวดเริ่มต้น (อาหาร/ข้าว ถ้ามี) · id ตายตัวต่อรายการซื้อของ · รูปแบบเดิม { id, date, type, categoryId, amount, note }', () => {
    expect(C.defaultCategory([{ id: 'i', name: 'เงินเดือน', type: 'income' }, { id: 'x', name: 'ค่าน้ำ', type: 'expense' }, { id: 'f', name: 'ค่าอาหาร', type: 'expense' }])).toBe('f');
    expect(C.defaultCategory([{ id: 'x', name: 'ค่าน้ำ', type: 'expense' }, { id: 'y', name: 'ค่าไฟ', type: 'expense' }])).toBe('x');
    expect(C.defaultCategory([])).toBe('');
    const rec = C.budgetRecord({ id: 'shop-2026-09-28', week: WEEK }, { total: 145.5 }, '2026-09-30', 'f');
    expect(rec).toEqual({ id: 'cook-shop-2026-09-28', date: '2026-09-30', type: 'expense', categoryId: 'f', amount: 145.5, note: 'ซื้อของทำอาหาร 2026-09-28' });
  });

  test('parseRecipe: JSON ในข้อความ/ใน ```json · ตัดเลขนำหน้าขั้นตอน · cat ที่ไม่รู้จัก = other · อ่านไม่ได้ = null', () => {
    const r = C.parseRecipe('ได้เลย ```json\n{"name":" ผัดกะเพรา ","servings":"3","ingredients":[{"name":"หมูสับ","qty":"200","unit":"กรัม","cat":"meat"},{"name":"พริก","qty":null,"unit":"","cat":"zzz"},{"name":""}],"steps":["1. ผัดพริก","ขั้นตอนที่ 2 ใส่หมู"],"tags":["ผัด"]}\n```');
    expect(r).toEqual({ name: 'ผัดกะเพรา', servings: 3, ingredients: [{ name: 'หมูสับ', qty: 200, unit: 'กรัม', cat: 'meat' }, { name: 'พริก', qty: null, unit: '', cat: 'other' }], steps: ['ผัดพริก', 'ใส่หมู'], tags: ['ผัด'] });
    expect(C.parseRecipe('ขออภัย')).toBeNull(); expect(C.parseRecipe('{"name":"x"}')).toBeNull(); expect(C.parseRecipe('{เสีย')).toBeNull();
    expect(C.recipeMessages('สูตร X')[1]).toEqual({ role: 'user', content: 'สูตร X' });
  });

  test('สูตรตั้งต้น 12 เมนู: แก้แล้วแทนที่ id เดิม · ลบ = หลุม (ไม่โผล่กลับ) · เมนูของเราไม่ปะปน', () => {
    const seeds = C.seedRecipes(1);
    expect(seeds).toHaveLength(12);
    expect(new Set(seeds.map((s) => s.id)).size).toBe(12);
    for (const s of seeds) { expect(s.ingredients.length).toBeGreaterThan(2); expect(s.steps.length).toBeGreaterThan(1); expect(s.servings).toBeGreaterThan(0); }
    expect(seeds.map((s) => s.name)).toEqual(expect.arrayContaining(['ผัดกะเพราหมูสับ', 'ไข่เจียวหมูสับ', 'ต้มยำกุ้ง', 'แกงเขียวหวานไก่', 'ผัดผักบุ้งไฟแดง', 'ต้มจืดเต้าหู้หมูสับ']));
    expect(C.effectiveRecipes(null, 1)).toHaveLength(12);
    const stored = [{ id: 'seed-omelet', name: 'ไข่เจียวของฉัน', servings: 1, ingredients: [], steps: [], tags: [] }, { id: 'seed-kaprao', deleted: true }, { id: 'mine', name: 'ของฉัน', servings: 2, ingredients: [], steps: [], tags: [] }];
    const eff = C.effectiveRecipes(stored, 1);
    expect(eff).toHaveLength(12);
    expect(eff.find((r) => r.id === 'seed-omelet').name).toBe('ไข่เจียวของฉัน');
    expect(eff.find((r) => r.id === 'seed-kaprao')).toBeUndefined();
    expect(eff.find((r) => r.id === 'mine')).toBeTruthy();
    expect(C.cleanRecipe({ name: '  ' }, 'x', 1).error).toBe('name');
  });
});

test.describe('API /api/files ns recipes', () => {
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });
  test('รับ ns recipes: อัปโหลด → ลบ → หายจาก R2', async ({ request }) => {
    const res = await request.post(SRV + '/api/files?ns=recipes&ref=r1&name=a.jpg', { data: PNG, headers: { 'Content-Type': 'image/png' } });
    expect(res.status()).toBe(200);
    const meta = await res.json();
    expect(await (await request.get(SRV + '/__files')).json()).toEqual(['recipes/' + meta.id]);
    expect((await request.delete(SRV + '/api/files?id=' + meta.id)).status()).toBe(200);
    expect(await (await request.get(SRV + '/__files')).json()).toEqual([]);
  });
});

/* ── หน้า ── */
const OLD_KEYS = { 'tanot:cooking:xp': '40', 'tanot:cooking:streak': '{"count":2,"lastDate":"2026-9-29"}', 'tanot:cooking:badges': '["first"]', 'tanot:cooking:progress': '{"basics::0":true}', 'tanot:cooking:notes': '{"basics::0":"จดไว้"}' };
function seedFn() {
  return ({ rows, old }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (old) for (const k of Object.keys(old)) localStorage.setItem(k, old[k]);
    for (const k of Object.keys(rows || {})) localStorage.setItem(k, JSON.stringify(rows[k]));
  };
}
async function openPage(page, hash, o = {}) {
  const { ai = true, chat = null, chatStatus = 200, files = true, sync = false, rows, old, theme = 'light', width = 1100 } = o;
  const errors = await prepare(page, { theme });
  const log = { ocr: [], chat: [], del: [], posts: [] };
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/api/ocr')) log.ocr.push(1);
    if (u.includes('/api/ai/chat')) log.chat.push(r.postDataJSON());
    if (r.method() === 'DELETE' && u.includes('/api/files')) log.del.push(u);
    if (r.method() === 'POST' && u.includes('/api/files')) log.posts.push(u);
  });
  await page.addInitScript(({ ai, files, sync }) => {
    window.TANOT_AI = { enabled: ai };
    if (files) window.TANOT_FILES = { enabled: true };
    if (sync) window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
  }, { ai, files, sync });
  if (ai) {
    await page.route('**/api/ai/chat', (route) => chatStatus !== 200
      ? route.fulfill({ status: chatStatus, contentType: 'application/json', body: '{"error":"x"}' })
      : route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ t: chat || '{}' }) + '\n\ndata: {"done":true,"model":"fake"}\n\n' }));
  }
  await page.route('**/api/ocr', (route) => route.fulfill({ contentType: 'application/json', body: '{"text":"x"}' }));
  if (rows || old) await page.addInitScript(seedFn(), { rows, old });
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/cooking.html' + hash, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return { errors, log };
}
const store = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);
const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));
const PLAN3 = { 'tanot:cooking:plans': [{ id: 'week-' + WEEK, week: WEEK, slots: { '0:l': { recipeId: 'seed-kaprao', servings: 4 }, '1:d': { recipeId: 'seed-omelet', servings: 2 }, '2:d': { recipeId: 'seed-kaprao', servings: 2 } }, done: {}, awarded: {}, updatedAt: 1 }] };
const AI_RECIPE = JSON.stringify({ name: 'ผัดผักรวม', servings: 2, ingredients: [{ name: 'กะหล่ำปลี', qty: 200, unit: 'กรัม', cat: 'veg' }, { name: 'น้ำมันหอย', qty: 1, unit: 'ช้อนโต๊ะ', cat: 'sauce' }], steps: ['1. ผัดกระเทียม', '2. ใส่ผัก'], tags: ['ผัก'] });

test.describe('หน้า cooking.html', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('เปิดมาเป็นบทเรียนเหมือนเดิม · แท็บสูตร/แผน/ซื้อของ สลับได้ · สูตรตั้งต้น 12 เมนูพร้อมใช้ และยังไม่เขียนอะไรลงที่เก็บ', async ({ page }) => {
    const { errors } = await openPage(page, '', { old: OLD_KEYS });
    await expect(page.locator('#lessonsView')).toBeVisible();
    await expect(page.locator('#planRoot')).toBeHidden();
    await page.click('#planTabs [data-mode="recipes"]');
    await expect(page.locator('#lessonsView')).toBeHidden();
    await expect(page.locator('#cpList .cp-recipe')).toHaveCount(12);
    await page.fill('#cpQ', 'ต้มยำ');
    await expect(page.locator('#cpList .cp-recipe')).toHaveCount(1);
    await page.fill('#cpQ', '');
    await page.selectOption('#cpTag', 'เผ็ด');
    expect(await page.locator('#cpList .cp-recipe').count()).toBeGreaterThan(1);
    expect(await store(page, 'tanot:cooking:recipes')).toBeNull();
    await page.click('#planTabs [data-mode=""]');
    await expect(page.locator('#lessonsView')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('วางสูตร → AI แยก (/api/ai/chat, ไม่มี /api/ocr) → เติมฟอร์ม → บันทึก · รูป R2 ns recipes · ลบสูตรลบรูป', async ({ page, request }) => {
    const { errors, log } = await openPage(page, '#recipes', { chat: AI_RECIPE });
    await page.click('[data-act="addPaste"]');
    await expect(page.locator('#rPasteBox')).toHaveJSProperty('open', true);
    await page.fill('#rPaste', 'ผัดผักรวม 2 ที่\nกะหล่ำปลี 200 กรัม\nน้ำมันหอย 1 ช้อนโต๊ะ\n1. ผัดกระเทียม\n2. ใส่ผัก');
    await page.click('#rParse');
    await expect(page.locator('#rName')).toHaveValue('ผัดผักรวม');
    await expect(page.locator('#rIngs .cp-ing')).toHaveCount(2);
    await expect(page.locator('#rIngs .cp-ing').first().locator('[data-f="name"]')).toHaveValue('กะหล่ำปลี');
    await expect(page.locator('#rSteps')).toHaveValue('ผัดกระเทียม\nใส่ผัก');
    expect(log.chat).toHaveLength(1);
    expect(log.chat[0]).toMatchObject({ model: 'main' });
    expect(JSON.stringify(log.chat[0].messages)).toContain('กะหล่ำปลี 200 กรัม');
    expect(log.ocr).toHaveLength(0);

    await page.setInputFiles('#rPhotoInput', { name: 'a.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('#rPhotoImg')).toBeVisible();
    await page.click('#rSave');
    await expect(page.locator('#cpList .cp-recipe')).toHaveCount(13);
    const rows = await store(page, 'tanot:cooking:recipes');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'ผัดผักรวม', servings: 2, tags: ['ผัก'] });
    expect(rows[0].ingredients).toHaveLength(2);
    expect(rows[0].photo.id).toBeTruthy();
    expect(await (await request.get(SRV + '/__files')).json()).toEqual(['recipes/' + rows[0].photo.id]);

    // ลบ → ลบไฟล์ใน R2 ด้วย
    await page.locator('#cpList .cp-recipe', { hasText: 'ผัดผักรวม' }).click();
    page.once('dialog', (d) => d.accept());
    await page.click('#rDel');
    await expect(page.locator('#cpList .cp-recipe')).toHaveCount(12);
    expect(await (await request.get(SRV + '/__files')).json()).toEqual([]);
    expect(log.del).toHaveLength(1);
    expect(log.ocr).toHaveLength(0);
    expect(errors).toEqual([]);
  });

  test('AI ใช้ไม่ได้ (503) → ใส่ข้อความเป็นขั้นตอนให้กรอกเอง · ไม่เรียก /api/ocr · แก้สูตรตั้งต้นแล้วเก็บแถวเดียว · ลบสูตรตั้งต้นเก็บหลุม', async ({ page }) => {
    const { log } = await openPage(page, '#recipes', { chatStatus: 503 });
    await page.click('[data-act="addPaste"]');
    await page.fill('#rPaste', 'ต้มข้าว\nใส่น้ำ');
    await page.click('#rParse');
    await expect(page.locator('#rParseMsg')).toContainText('ใช้ AI ไม่ได้');
    await expect(page.locator('#rSteps')).toHaveValue('ต้มข้าว\nใส่น้ำ');
    await page.fill('#rName', 'ข้าวต้ม');
    await page.click('#rSave');
    await expect(page.locator('#cpList .cp-recipe')).toHaveCount(13);
    expect(log.ocr).toHaveLength(0);

    await page.locator('#cpList .cp-recipe', { hasText: 'ไข่เจียวหมูสับ' }).click();
    await page.fill('#rName', 'ไข่เจียวฟู');
    await page.click('#rSave');
    await expect(page.locator('#cpList .cp-recipe', { hasText: 'ไข่เจียวฟู' })).toHaveCount(1);
    await expect(page.locator('#cpList .cp-recipe')).toHaveCount(13);
    await page.locator('#cpList .cp-recipe', { hasText: 'ต้มยำกุ้ง' }).click();
    page.once('dialog', (d) => d.accept());
    await page.click('#rDel');
    await expect(page.locator('#cpList .cp-recipe')).toHaveCount(12);
    const rows = await store(page, 'tanot:cooking:recipes');
    expect(rows.filter((r) => r.id === 'seed-omelet')).toHaveLength(1);
    expect(rows.find((r) => r.id === 'seed-tomyum')).toMatchObject({ deleted: true });
    await page.reload();
    await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('#cpList .cp-recipe')).toHaveCount(12); // ต้มยำกุ้งไม่โผล่กลับ
  });

  test('แผนรายสัปดาห์: เลือกสูตร+จำนวนที่ต่อมื้อ · คัดลอกสัปดาห์ก่อน · สุ่มเติม · ไปรายการซื้อของ', async ({ page }) => {
    await openPage(page, '#plan', { rows: { 'tanot:cooking:plans': [{ id: 'week-2026-09-21', week: '2026-09-21', slots: { '3:d': { recipeId: 'seed-tomyum', servings: 3 } }, done: {}, awarded: {}, updatedAt: 1 }] } });
    await expect(page.locator('.cp-grid tbody tr')).toHaveCount(7);
    await expect(page.locator('.cp-grid tbody tr.today')).toContainText('พุธ');
    await page.locator('[data-act="slot"][data-slot="0:b"]').click();
    await page.selectOption('#sRecipe', 'seed-friedrice');
    await expect(page.locator('#sServ')).toHaveValue('2');
    await page.fill('#sServ', '3');
    await page.click('#sForm button[type=submit]');
    await expect(page.locator('.cp-cell[data-slot="0:b"]')).toContainText('ข้าวผัดไข่');
    await expect(page.locator('.cp-cell[data-slot="0:b"]')).toContainText('3 ที่');
    let plans = await store(page, 'tanot:cooking:plans');
    expect(plans.find((p) => p.id === 'week-' + WEEK).slots['0:b']).toEqual({ recipeId: 'seed-friedrice', servings: 3 });

    await page.click('[data-act="copyPrev"]'); // ช่อง 3:d ของสัปดาห์ก่อน → สัปดาห์นี้
    await expect(page.locator('.cp-cell[data-slot="3:d"]')).toContainText('ต้มยำกุ้ง');
    await expect(page.locator('.cp-cell[data-slot="3:d"]')).toContainText('3 ที่');
    await expect(page.locator('.cp-cell[data-slot="0:b"]')).toContainText('ข้าวผัดไข่');
    await page.click('[data-act="fill"]');
    await expect(page.locator('.cp-cell')).toHaveCount(21);
    await expect(page.locator('.cp-cell[data-slot="0:b"]')).toContainText('ข้าวผัดไข่'); // ช่องเดิมไม่ถูกสุ่มทับ
    // ล้างช่อง
    await page.locator('[data-act="slot"][data-slot="6:d"]').first().click();
    await page.click('#sClear');
    await expect(page.locator('.cp-cell')).toHaveCount(20);
    await page.click('[data-act="wnext"]');
    await expect(page.locator('.cp-cell')).toHaveCount(0);
    await page.click('[data-act="wnow"]');
    await expect(page.locator('.cp-cell')).toHaveCount(20);
    await page.click('[data-act="toShop"]');
    await expect(page.locator('#planTabs [data-mode="shop"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('แผน → รายการซื้อของ: รวมวัตถุดิบ แปลงหน่วย ปรับตามที่ · จัดกลุ่มตามหมวด · ติ๊ก/ราคา/เพิ่มเอง · อัปเดตจากแผนแล้วติ๊กยังอยู่', async ({ page }) => {
    const { errors } = await openPage(page, '#shop', { rows: PLAN3 });
    await expect(page.locator('#planRoot .empty')).toContainText('ยังไม่มีรายการซื้อของ');
    await page.click('[data-act="mkShop"]');
    const line = (name) => page.locator('.cp-line', { hasText: name });
    await expect(line('หมูสับ')).toContainText('650 กรัม');          // กะเพรา 200×(4/2) + 200×(2/2) + ไข่เจียว 50
    await expect(line('ไข่ไก่')).toContainText('9 ฟอง');             // 2×2 + 2×1 + 3
    await expect(line('น้ำปลา')).toContainText('10 ช้อนชา');         // (1 ช้อนโต๊ะ ×3) + 1 ช้อนชา = 50 มล. = 10 ช้อนชา
    await expect(line('น้ำมันพืช')).toContainText('190 มล.');        // 2 ช้อนโต๊ะ×3 = 90 มล. + 100 มล.
    await expect(line('กระเทียม')).toContainText('15 กลีบ');
    const groups = await page.locator('.cp-group h3').allTextContents();
    expect(groups).toEqual(['ผัก', 'เนื้อสัตว์', 'เครื่องปรุง']);
    const shop = (await store(page, 'tanot:cooking:shopping')).find((r) => !r.kind);
    expect(shop).toMatchObject({ id: 'shop-' + WEEK, week: WEEK });

    await line('กระเทียม').locator('input[type=checkbox]').check();
    await line('กระเทียม').locator('.cp-price').fill('12');
    await line('กระเทียม').locator('.cp-price').blur();
    await page.fill('#aName', 'ถุงขยะ'); await page.fill('#aQty', '1'); await page.fill('#aUnit', 'ม้วน');
    await page.click('[data-act="addItem"]');
    await expect(line('ถุงขยะ')).toContainText('1 ม้วน');
    await expect(page.locator('#cpTotal')).toContainText('฿12');
    await expect(page.locator('#cpCounts')).toContainText('ซื้อแล้ว 1/');
    await line('ไข่ไก่').locator('[data-act="rmLine"]').click();
    await expect(line('ไข่ไก่')).toHaveCount(0);

    // ติ๊ก/ราคาแยกเก็บเป็นแถวของเครื่องนี้ ไม่แก้แถวรายการ
    const rows = await store(page, 'tanot:cooking:shopping');
    expect(rows.filter((r) => r.kind === 'ticks')).toHaveLength(1);
    expect(rows.find((r) => !r.kind).lines.some((l) => l.name === 'ถุงขยะ')).toBe(false);

    // เปลี่ยนแผน (เพิ่มมื้อ) → อัปเดตจากแผน: บรรทัดเดิมคงติ๊กไว้
    await page.evaluate(() => {
      const ps = JSON.parse(localStorage.getItem('tanot:cooking:plans'));
      ps[0].slots['4:l'] = { recipeId: 'seed-friedrice', servings: 2 };
      localStorage.setItem('tanot:cooking:plans', JSON.stringify(ps));
    });
    await page.click('[data-act="mkShop"]');
    await expect(line('ข้าวสวย')).toContainText('400 กรัม');
    await expect(line('กระเทียม').locator('input[type=checkbox]')).toBeChecked();
    await expect(line('กระเทียม').locator('.cp-price')).toHaveValue('12');
    await expect(line('ถุงขยะ')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('ส่ง budget: 1 รายการ รูปแบบเดิม · กดซ้ำไม่เพิ่ม · ไม่แตะโครง budget อื่น · หมวดตามที่เลือก', async ({ page }) => {
    const cats = [{ id: 'cat-x', name: 'ค่าน้ำ', type: 'expense' }, { id: 'cat-food', name: 'ค่าอาหาร', type: 'expense' }, { id: 'cat-salary', name: 'เงินเดือน', type: 'income' }];
    const existing = [{ id: 'r-old', date: '2026-09-01', type: 'expense', categoryId: 'cat-x', amount: 50, note: 'เดิม' }];
    await openPage(page, '#shop', { rows: { ...PLAN3, 'budget:categories': cats, 'budget:records': existing } });
    await page.click('[data-act="mkShop"]');
    await expect(page.locator('#cpBudget')).toBeDisabled(); // ยังไม่มีราคา
    await expect(page.locator('#cpBcat')).toHaveValue('cat-food'); // หมวดอาหารเป็นค่าเริ่มต้น
    const setPrice = async (n, v) => { const el = page.locator('.cp-line', { hasText: n }).locator('.cp-price'); await el.fill(v); await el.blur(); };
    await setPrice('หมูสับ', '180'); await setPrice('กระเทียม', '20.5');
    await expect(page.locator('#cpTotal')).toContainText('฿200.5');
    await expect(page.locator('#cpBudget')).toBeEnabled();
    await page.click('#cpBudget');
    await expect(page.locator('#cpBudget')).toBeDisabled();
    await expect(page.locator('#cpBudget')).toContainText('บันทึกเป็นรายจ่ายแล้ว');
    let recs = await store(page, 'budget:records');
    expect(recs).toHaveLength(2);
    expect(recs[0]).toEqual(existing[0]);
    expect(recs[1]).toEqual({ id: 'cook-shop-' + WEEK, date: '2026-09-30', type: 'expense', categoryId: 'cat-food', amount: 200.5, note: 'ซื้อของทำอาหาร ' + WEEK });
    // บังคับกดซ้ำ (เปิดปุ่มเอง) ก็ไม่เพิ่มแถว
    await page.evaluate(() => { const b = document.getElementById('cpBudget'); b.disabled = false; b.click(); });
    recs = await store(page, 'budget:records');
    expect(recs).toHaveLength(2);
    expect((await store(page, 'tanot:cooking:shopping')).find((r) => !r.kind).budgetId).toBe('cook-shop-' + WEEK);
    await page.reload();
    await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('#cpBudget')).toBeDisabled();
  });

  test('XP: กด "ทำแล้ว" ครั้งเดียวต่อมื้อ (ยกเลิกแล้วกดใหม่ไม่ให้ซ้ำ) · เข้าระบบรวม LearnCore src cooking · คีย์ XP เดิมของบทเรียนไม่ถูกแตะ', async ({ page }) => {
    const { errors } = await openPage(page, '#plan', { rows: PLAN3, old: OLD_KEYS });
    const xp = () => page.evaluate(() => (JSON.parse(localStorage.getItem('tanot:learn:xp') || '[]')).filter((r) => r.src === 'cooking' && r.d !== undefined).reduce((s, r) => s + r.xp, 0));
    const cell = (k) => page.locator('.cp-cell[data-slot="' + k + '"]');
    await cell('0:l').locator('[data-act="done"]').click();
    await expect(cell('0:l')).toHaveClass(/done/);
    await expect(page.locator('.ck-toast')).toContainText('+10 XP');
    expect(await xp()).toBe(10);
    await cell('0:l').locator('[data-act="done"]').click(); // ยกเลิก
    await expect(cell('0:l')).not.toHaveClass(/done/);
    await cell('0:l').locator('[data-act="done"]').click(); // ทำใหม่ — ไม่ให้ XP ซ้ำ
    await expect(cell('0:l')).toHaveClass(/done/);
    expect(await xp()).toBe(10);
    await cell('1:d').locator('[data-act="done"]').click();
    await expect.poll(xp).toBe(20);
    const plan = (await store(page, 'tanot:cooking:plans'))[0];
    expect(Object.keys(plan.awarded).sort()).toEqual(['0:l', '1:d']);
    // คีย์เดิมของหน้าทำอาหารไม่ถูกแตะ
    for (const k of Object.keys(OLD_KEYS)) expect(await page.evaluate((key) => localStorage.getItem(key), k)).toBe(OLD_KEYS[k]);
    expect(errors).toEqual([]);
  });

  test('คีย์เดิมของบทเรียนไม่ถูกแตะตลอดทุกขั้น (สูตร → แผน → ซื้อของ → budget → XP) และคีย์ใหม่ถูกต้อง', async ({ page }) => {
    await openPage(page, '#recipes', { old: OLD_KEYS });
    await page.click('[data-act="add"]');
    await page.fill('#rName', 'ทดสอบ'); await page.fill('#rIngs .cp-ing [data-f="name"]', 'หอม'); await page.click('#rSave');
    await page.click('#planTabs [data-mode="plan"]');
    await page.locator('[data-act="slot"][data-slot="0:b"]').click();
    await page.click('#sForm button[type=submit]');
    await page.locator('.cp-cell[data-slot="0:b"] [data-act="done"]').click();
    await page.click('[data-act="toShop"]');
    await page.click('[data-act="mkShop"]');
    await page.locator('.cp-line .cp-price').first().fill('10');
    await page.locator('.cp-line .cp-price').first().blur();
    await page.click('#cpBudget');
    await expect(page.locator('#cpBudget')).toBeDisabled();
    for (const k of Object.keys(OLD_KEYS)) expect(await page.evaluate((key) => localStorage.getItem(key), k)).toBe(OLD_KEYS[k]);
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('tanot:cooking:')).sort());
    expect(keys).toEqual(['tanot:cooking:badges', 'tanot:cooking:notes', 'tanot:cooking:plans', 'tanot:cooking:progress', 'tanot:cooking:recipes', 'tanot:cooking:shopping', 'tanot:cooking:streak', 'tanot:cooking:xp']);
  });

  test('มือถือ 390px: ไม่มีแถบเลื่อนแนวนอนของหน้าทั้ง 3 แท็บ', async ({ page }) => {
    await openPage(page, '#plan', { rows: PLAN3, width: 390 });
    for (const m of ['recipes', 'plan', 'shop']) {
      await page.click('#planTabs [data-mode="' + m + '"]');
      if (m === 'shop') await page.click('[data-act="mkShop"]');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    }
  });
});

test.describe('ซิงก์ 2 เครื่อง', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('ติ๊ก/ราคาจาก 2 เครื่องพร้อมกันไม่หาย · ส่ง budget จาก 2 เครื่องได้แถวเดียว · XP ไม่ซ้ำ', async ({ browser }) => {
    const mk = async (rows) => {
      const ctx = await browser.newContext({ baseURL: SRV });
      const page = await ctx.newPage();
      const o = await openPage(page, '#shop', { sync: true, rows });
      return { ctx, page, errors: o.errors };
    };
    const A = await mk(PLAN3), B = await mk(undefined);
    await A.page.click('[data-act="mkShop"]');
    for (let i = 0; i < 3; i++) { await sync(A.page); await sync(B.page); }
    const line = (p, n) => p.locator('.cp-line', { hasText: n });
    await expect(line(B.page, 'หมูสับ')).toContainText('650 กรัม'); // เครื่อง B เห็นรายการที่ A สร้าง

    // ต่างเครื่องติ๊กคนละบรรทัด + ใส่ราคาพร้อมกัน (ยังไม่ซิงก์คั่น) · บรรทัดเดียวกันก็ใส่ราคาคนละช่อง
    await line(A.page, 'หมูสับ').locator('input[type=checkbox]').check();
    await line(A.page, 'หมูสับ').locator('.cp-price').fill('180'); await line(A.page, 'หมูสับ').locator('.cp-price').blur();
    await line(B.page, 'กระเทียม').locator('input[type=checkbox]').check();
    await line(B.page, 'กระเทียม').locator('.cp-price').fill('25'); await line(B.page, 'กระเทียม').locator('.cp-price').blur();
    // นาฬิกาในเทสต์ถูกตรึง — ขยับเวลาของ B ให้การแก้ราคาครั้งหลังใหม่กว่าของ A จริง (ช่องใหม่สุดชนะตามเวลา ไม่งั้นเสมอแล้วตัดสินด้วยรหัสเครื่องที่สุ่ม)
    await B.page.clock.setFixedTime(new Date(NOW.getTime() + 60000));
    await line(B.page, 'หมูสับ').locator('.cp-price').fill('185'); await line(B.page, 'หมูสับ').locator('.cp-price').blur(); // B แก้ราคาทีหลัง → ชนะ
    for (let i = 0; i < 3; i++) { await sync(A.page); await sync(B.page); }
    for (const d of [A, B]) {
      await expect(line(d.page, 'หมูสับ').locator('input[type=checkbox]')).toBeChecked();
      await expect(line(d.page, 'กระเทียม').locator('input[type=checkbox]')).toBeChecked();
      await expect(line(d.page, 'กระเทียม').locator('.cp-price')).toHaveValue('25');
      await expect(line(d.page, 'หมูสับ').locator('.cp-price')).toHaveValue('185');
      await expect(d.page.locator('#cpTotal')).toContainText('฿210');
      const rows = await store(d.page, 'tanot:cooking:shopping');
      expect(rows.filter((r) => r.kind === 'ticks')).toHaveLength(2); // 1 แถวต่อเครื่อง
      expect(d.errors).toEqual([]);
    }

    // ทั้งสองเครื่องกดบันทึกค่าซื้อของ → budget แถวเดียว
    for (const d of [A, B]) await d.page.click('#cpBudget');
    for (let i = 0; i < 3; i++) { await sync(A.page); await sync(B.page); }
    for (const d of [A, B]) {
      const budget = await store(d.page, 'budget:records');
      expect(budget).toHaveLength(1);
      expect(budget[0]).toMatchObject({ id: 'cook-shop-' + WEEK, type: 'expense', amount: 210 });
    }

    // ทั้งสองเครื่องกด "ทำแล้ว" มื้อเดียวกัน → แถวแผนเดียว XP รวมของวันนั้นไม่เกิน 2 เครื่อง (เครื่องละ 10) และกดซ้ำในเครื่องเดียวไม่เพิ่ม
    await A.page.click('#planTabs [data-mode="plan"]');
    await A.page.locator('.cp-cell[data-slot="0:l"] [data-act="done"]').click();
    await A.page.locator('.cp-cell[data-slot="0:l"] [data-act="done"]').click();
    await A.page.locator('.cp-cell[data-slot="0:l"] [data-act="done"]').click();
    const xpA = await A.page.evaluate(() => JSON.parse(localStorage.getItem('tanot:learn:xp') || '[]').filter((r) => r.src === 'cooking').reduce((s, r) => s + r.xp, 0));
    expect(xpA).toBe(10);
    await A.ctx.close(); await B.ctx.close();
  });
});
