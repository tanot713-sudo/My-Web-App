// @ts-check
// ภาษา L5 (ROADMAP แถว 26): ฝึกสนทนาสวมบทบาทกับ AI — known-answer ของ lang-calc.js + หน้าจริงกับ /api/ai/chat SSE ปลอม
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');
const LC = require(path.resolve(__dirname, '..', 'lang-calc.js'));

const PHRASE_CATS = ['ทักทายและแนะนำตัว', 'การเดินทางและร้านอาหาร', 'การทำงานและสัมภาษณ์งาน', 'เดินทางเข้าประเทศ', 'หาที่พักและเช่าบ้าน', 'ธนาคารและซิมโทรศัพท์', 'ชีวิตประจำวันและซื้อของ', 'โรงพยาบาลและเหตุฉุกเฉิน'];

test.describe('lang-calc (ตรรกะล้วน)', () => {
  test('SCENES: 8 ฉากแรก (L5) ตรงกับหมวดวลีเดิมทุกหมวด ลำดับเดิม (E3 ต่อท้ายได้อย่างเดียว)', () => {
    expect(LC.SCENES.slice(0, 8).map((s) => s.cat)).toEqual(PHRASE_CATS);
    LC.SCENES.forEach((s) => {
      expect(s.id).toMatch(/^[a-z]+$/);
      expect(s.th && s.en && s.role && s.goal).toBeTruthy();
    });
    expect(LC.LEVELS).toEqual(['A1', 'A2', 'B1', 'B2']);
  });

  test('roleplayMessages: system บอกบทบาท/ภาษา/ระดับ/รูปแบบ JSON แล้วตามด้วยประวัติ', () => {
    const m = LC.roleplayMessages('restaurant', 'A2', 'ญี่ปุ่น', [{ role: 'assistant', content: 'いらっしゃいませ' }, { role: 'user', content: 'メニューをください' }]);
    expect(m[0].role).toBe('system');
    expect(m[0].content).toContain('ญี่ปุ่น');
    expect(m[0].content).toContain('A2');
    expect(m[0].content).toContain('"fix"');
    expect(m[0].content).toContain('"th"');
    expect(m.slice(1).map((x) => x.role)).toEqual(['assistant', 'user']);
    expect(m.filter((x) => x.role === 'system').length).toBe(1);
  });

  test('roleplayMessages: ประวัติว่าง = สั่งให้ AI เปิดฉากก่อน (ลงท้ายด้วย user)', () => {
    const m = LC.roleplayMessages('greet', 'A1', 'อังกฤษ', []);
    expect(m[m.length - 1].role).toBe('user');
    expect(m.length).toBe(2);
    expect(() => LC.roleplayMessages('nope', 'A1', 'อังกฤษ', [])).toThrow();
  });

  test('parseRoleplay: แยกข้อความกับ JSON ท้ายคำตอบ', () => {
    const r = LC.parseRoleplay('Nice to meet you! What do you do?\n{"fix": "I am a student.", "th": "ยินดีที่ได้รู้จัก คุณทำงานอะไร"}');
    expect(r.text).toBe('Nice to meet you! What do you do?');
    expect(r.fix).toBe('I am a student.');
    expect(r.th).toBe('ยินดีที่ได้รู้จัก คุณทำงานอะไร');
  });
  test('parseRoleplay: ครอบด้วย code fence ได้ · ไม่มี JSON = ข้อความล้วน · JSON ยังมาไม่ครบ = ซ่อนส่วนท้าย', () => {
    const f = LC.parseRoleplay('Hello\n```json\n{"fix":"","th":"สวัสดี"}\n```');
    expect(f).toEqual({ text: 'Hello', fix: '', th: 'สวัสดี' });
    expect(LC.parseRoleplay('Just text')).toEqual({ text: 'Just text', fix: '', th: '' });
    expect(LC.parseRoleplay('Hi there\n{"fix": "I am').text).toBe('Hi there');
    expect(LC.parseRoleplay('Use {braces} in text').text).toBe('Use {braces} in text');
  });

  test('summaryMessages + parseSummary: ≤ 5 คำ ไม่ซ้ำ ตัดว่าง', () => {
    const m = LC.summaryMessages('bank', 'B1', 'เยอรมัน', [{ role: 'user', content: 'Hallo' }]);
    expect(m[0].role).toBe('system');
    expect(m[0].content).toContain('"words"');
    const w = LC.parseSummary('{"words":[{"word":"Konto","thai":"บัญชี"},{"word":" konto ","thai":"ซ้ำ"},{"word":"","thai":"x"},{"word":"Karte","thai":"บัตร"},{"word":"a","thai":"1"},{"word":"b","thai":"2"},{"word":"c","thai":"3"},{"word":"d","thai":"4"}]}');
    expect(w.map((x) => x.word)).toEqual(['Konto', 'Karte', 'a', 'b', 'c']);
    expect(LC.parseSummary('ไม่ใช่ JSON')).toEqual([]);
  });

  test('userCardKey: lang-xx::u::<lemma> ไม่อิงตำแหน่ง ตัดเครื่องหมายขอบ/ช่องว่างซ้ำ/ตัวพิมพ์', () => {
    expect(LC.userCardKey('lang-en', ' Hello,  World! ')).toBe('lang-en::u::hello, world');
    expect(LC.userCardKey('lang-jp', 'メニュー')).toBe('lang-jp::u::メニュー');
    expect(LC.userCardKey('lang-en', ' ?! ')).toBe('');
  });
});

// ── หน้าจริง ──
async function setup(page, mode) {
  const errors = await prepare(page);
  const calls = [];
  const apiReqs = [];
  page.on('request', (r) => { if (/\/api\//.test(r.url())) apiReqs.push(r.url()); });
  await page.addInitScript(() => { window.TANOT_AI = { enabled: true }; });
  await page.route('**/api/ai/chat', (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    calls.push(body);
    const sys = (body.messages || [])[0] && body.messages[0].content || '';
    if (mode === 'down') return route.fulfill({ status: 502, contentType: 'application/json', body: '{"code":"upstream"}' });
    let reply;
    if (/"words"/.test(sys)) reply = '{"words":[{"word":"menu","thai":"เมนู"},{"word":"bill","thai":"บิล"}]}';
    else reply = 'Hello! What would you like?\\n{"fix": "I would like a menu.", "th": "สวัสดี คุณต้องการอะไร"}';
    const sse = 'data: ' + JSON.stringify({ t: reply.replace(/\\n/g, '\n') }) + '\n\ndata: {"done":true}\n\n';
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  });
  return { errors, calls, apiReqs };
}
async function openRoleplay(page) {
  await page.goto('/languages.html');
  await page.click('[data-k="tab-listen"]');
  await page.click('[data-k="lsub-roleplay"]');
}

test('หน้า: เลือกฉาก → AI เปิดฉาก → พิมพ์ตอบ → คำแก้/คำแปล → จบฉาก → เพิ่มเป็นการ์ด', async ({ page }) => {
  const { errors, calls, apiReqs } = await setup(page, 'ok');
  await openRoleplay(page);
  await page.click('[data-k="rp-scene-restaurant"]');
  await page.click('[data-k="rp-start"]');
  await expect(page.locator('[data-k="rp-msg-ai"]').first()).toContainText('Hello! What would you like?');
  expect(calls[0].model).toBe('main');
  // JSON ท้ายคำตอบต้องไม่โผล่ในข้อความ
  await expect(page.locator('[data-k="rp-msg-ai"]').first()).not.toContainText('"fix"');
  await page.fill('[data-k="rp-input"]', 'I want menu');
  await page.click('[data-k="rp-send"]');
  await expect(page.locator('[data-k="rp-msg-user"]')).toHaveCount(1);
  await expect(page.locator('[data-k="rp-msg-ai"]')).toHaveCount(2);
  await page.locator('[data-k="rp-th"]').first().click();
  await expect(page.locator('[data-k="rp-th-text"]').first()).toContainText('สวัสดี คุณต้องการอะไร');
  // E3: คำแก้แสดงคู่กับที่พิมพ์ใต้ข้อความผู้เรียนเลย (ไม่ต้องกดปุ่ม)
  await expect(page.locator('[data-k="rp-fix-text"]').first()).toContainText('I would like a menu.');
  await page.click('[data-k="rp-finish"]');
  await expect(page.locator('[data-k="rp-word"]')).toHaveCount(2);
  await page.locator('[data-k="rp-word"]').nth(1).locator('input[type=checkbox]').uncheck();
  await page.click('[data-k="rp-addcards"]');
  await expect(page.locator('[data-k="rp-added"]')).toBeVisible();
  const st = await page.evaluate(() => ({
    faces: JSON.parse(localStorage.getItem('lang-practice:faces') || '{}'),
    srs: JSON.parse(localStorage.getItem('lang-practice:srs') || '{}'),
    xp: JSON.parse(localStorage.getItem('tanot:learn:xp') || '[]'),
  }));
  expect(st.faces['lang-en::u::menu']).toEqual(['menu', 'เมนู']);
  expect(st.faces['lang-en::u::bill']).toBeUndefined();
  expect(Object.keys(st.srs)).toContain('lang-en::u::menu');
  expect(st.xp.some((r) => r.src === 'lang' && r.xp >= 10)).toBe(true);
  expect(apiReqs.filter((u) => /\/api\/ocr/.test(u))).toEqual([]);
  expect(errors).toEqual([]);
});

test('หน้า: คลาวด์ล่ม (iOS ไม่ถอย) → ข้อความผิดพลาด ไม่ค้าง', async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage();
  const { apiReqs } = await setup(page, 'down');
  await openRoleplay(page);
  await page.click('[data-k="rp-scene-greet"]');
  await page.click('[data-k="rp-start"]');
  await expect(page.locator('[data-k="rp-error"]')).toBeVisible();
  expect(apiReqs.filter((u) => /\/api\/ocr/.test(u))).toEqual([]);
  await ctx.close();
});

test('review.js: การ์ด ::u:: เห็นหน้าการ์ดจาก lang-practice:faces', async ({ page }) => {
  await prepare(page);
  await page.addInitScript(() => {
    localStorage.setItem('lang-practice:srs', JSON.stringify({ 'lang-en::u::menu': { dueAt: 1 } }));
    localStorage.setItem('lang-practice:faces', JSON.stringify({ 'lang-en::u::menu': ['menu', 'เมนู'] }));
  });
  await page.goto('/review.html#lang');
  await expect(page.locator('body')).toContainText('menu');
});

test('data-registry: lang-practice:faces เป็น sync map เหนือ prefix', async () => {
  const src = require('fs').readFileSync(path.resolve(__dirname, '..', 'data-registry.js'), 'utf8');
  const i = src.indexOf("key: 'lang-practice:faces'");
  expect(i).toBeGreaterThan(0);
  expect(i).toBeLessThan(src.indexOf("{ prefix: 'lang-practice:'"));
  expect(src.slice(i, i + 80)).toContain("mode: 'map'");
});
