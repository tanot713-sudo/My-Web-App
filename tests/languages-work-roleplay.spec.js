// @ts-check
// ภาษา E3 (ROADMAP แถว 35): ฉากงานในโหมดสวมบทบาท + ประโยคฉบับแก้เก็บเป็นการ์ด
// known-answer ของ lang-calc.js (scenesFor/turnReview/sentenceCardKey/turnCard) + หน้าจริงกับ /api/ai/chat SSE ปลอม + ไมค์/ถอดเสียงปลอม + review.html
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');
const LC = require(path.resolve(__dirname, '..', 'lang-calc.js'));

// 10 หมวดงานของ E1 อ่านจาก lang-data ในหน้าจริง (ชื่อหมวดเป็นส่วนของคีย์ SRS)
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'languages.html'), 'utf8');
const WORK_CATS = [...new Set([...HTML.matchAll(/"(งาน: [^"]+)"/g)].map((m) => m[1]))];
const WORK_IDS = ['workmeeting', 'workrepair', 'workhandover', 'workpermit', 'workreport', 'workquote', 'workcontract', 'workpresent', 'workpresales', 'workinterview'];
const OLD_IDS = ['greet', 'restaurant', 'interview', 'immigration', 'housing', 'bank', 'shopping', 'hospital'];

test.describe('lang-calc E3 (ตรรกะล้วน)', () => {
  test('SCENES: 8 ฉากเดิมอยู่หัวลำดับเดิม + ฉากงาน 10 ฉากต่อท้าย ตรงกับ 10 หมวดของ E1 ครบ', () => {
    expect(LC.SCENES.slice(0, 8).map((s) => s.id)).toEqual(OLD_IDS);
    expect(LC.SCENES.slice(8).map((s) => s.id)).toEqual(WORK_IDS);
    expect(WORK_CATS.length).toBe(10);
    expect(LC.SCENES.slice(8).map((s) => s.cat).sort()).toEqual([...WORK_CATS].sort());
    LC.SCENES.slice(8).forEach((s) => {
      expect(s.group).toBe('work');
      expect(s.only).toEqual(['lang-en']);
      expect(s.th && s.en && s.role && s.situation && s.goal && s.goalEn).toBeTruthy();
    });
    expect(new Set(LC.SCENES.map((s) => s.id)).size).toBe(18);
  });

  test('ฉากงาน: สถานการณ์สมมุติ ไม่มีชื่อหน่วยงาน/คนจริง และไม่อ้าง FIDIC · บทบาท AI ครบ 5 แบบ', () => {
    const stop = /FIDIC|PTT|SCG|EGAT|PEA\b|MEA\b|Siemens|Daikin|Carrier|Trane|บริษัท.{0,30}จำกัด|กรม|กระทรวง/i;
    LC.SCENES.slice(8).forEach((s) => {
      expect([s.role, s.situation, s.th, s.en, s.goal, s.goalEn].join(' ')).not.toMatch(stop);
    });
    const roles = LC.SCENES.slice(8).map((s) => s.role).join(' | ');
    ['consultant', 'foreign contractor', 'manager|supervisor', 'client', 'interviewing'].forEach((r) => expect(roles).toMatch(new RegExp(r)));
  });

  test('scenesFor: อังกฤษเห็นทั้ง 18 ฉาก · ภาษาอื่นเห็นแค่ 8 ฉากเดิมตามลำดับ', () => {
    expect(LC.scenesFor('lang-en').length).toBe(18);
    expect(LC.scenesFor('lang-jp').map((s) => s.id)).toEqual(OLD_IDS);
    expect(LC.scenesFor('lang-cn').length).toBe(8);
  });

  test('roleplayMessages: ฉากงานส่งสถานการณ์สมมุติให้ AI + ขอ fixTh · ฉากเดิมไม่มีบรรทัดสถานการณ์', () => {
    const w = LC.roleplayMessages('workcontract', 'B1', 'อังกฤษ', []);
    expect(w[0].content).toContain('Situation (invented');
    expect(w[0].content).toContain('extension of time');
    expect(w[0].content).toContain('"fixTh"');
    const o = LC.roleplayMessages('hospital', 'A1', 'อังกฤษ', []);
    expect(o[0].content).not.toContain('Situation');
    expect(() => LC.sceneOf('workinterview')).not.toThrow();
  });

  test('parseRoleplay: อ่าน fixTh ได้ · ไม่มี fixTh = ผลเหมือนเดิมทุกคีย์ · stream ยังไม่ครบ = ซ่อน', () => {
    const r = LC.parseRoleplay('Fine.\n{"fix": "I need a quote.", "fixTh": "ฉันต้องการใบเสนอราคา", "th": "ได้ครับ"}');
    expect(r).toEqual({ text: 'Fine.', fix: 'I need a quote.', th: 'ได้ครับ', fixTh: 'ฉันต้องการใบเสนอราคา' });
    expect(LC.parseRoleplay('Fine.\n{"fix": "", "th": "ได้ครับ"}')).toEqual({ text: 'Fine.', fix: '', th: 'ได้ครับ' });
    expect(LC.parseRoleplay('Fine.\n{"fix": "I need", "fixTh": "ฉัน').text).toBe('Fine.');
  });

  test('sentenceNorm: ไม่สนตัวพิมพ์/วรรคตอน/ช่องว่างซ้ำ/อัญประกาศโค้ง', () => {
    expect(LC.sentenceNorm('  I’d  like a QUOTE!! ')).toBe("i'd like a quote");
    expect(LC.sentenceNorm('Hello, world — again…')).toBe('hello world again');
    expect(LC.sentenceNorm('?!')).toBe('');
    expect(LC.sentenceNorm(null)).toBe('');
  });

  test('sentenceCardKey: lang-xx::u::<hash> ตายตัว · ฉบับเดียวกันต่างตัวพิมพ์/วรรคตอน = คีย์เดียว · คนละประโยค/คนละภาษา = คนละคีย์', () => {
    const k = LC.sentenceCardKey('lang-en', 'I would like a quotation for the service.');
    expect(k).toMatch(/^lang-en::u::[0-9a-z]{8,12}$/);
    expect(k).toBe('lang-en::u::' + k.split('::')[2]);
    expect(LC.sentenceCardKey('lang-en', ' i would LIKE a quotation, for the service ')).toBe(k);
    expect(LC.sentenceCardKey('lang-en', 'I would like a quotation for the services.')).not.toBe(k);
    expect(LC.sentenceCardKey('lang-jp', 'I would like a quotation for the service.')).toBe(k.replace('lang-en', 'lang-jp'));
    expect(LC.sentenceCardKey('lang-en', '  ... ')).toBe('');
    // known-answer: ค่าแฮชต้องไม่เปลี่ยนข้ามรุ่น (เปลี่ยน = การ์ดเดิมของผู้ใช้กลายเป็นคนละใบ)
    expect(LC.sentenceCardKey('lang-en', 'I would like a menu.')).toBe('lang-en::u::kxpuagymqk');
  });

  test('turnReview: ผูกคำแก้ของ AI ข้อความถัดไปกับประโยคผู้เรียน · ต้องตอบจบแล้ว + มี JSON', () => {
    const u = { role: 'user', content: 'I want quote' };
    const done = (a) => Object.assign({ role: 'assistant', content: 'Sure.', th: '', fix: '', fixTh: '', done: true }, a);
    // ยังไม่มีคำตอบ / ยังสตรีม / ไม่มี JSON = ยังไม่รู้
    expect(LC.turnReview([u], 0)).toBeNull();
    expect(LC.turnReview([u, done({ done: false, fix: 'I want a quote.' })], 0)).toBeNull();
    expect(LC.turnReview([u, done({})], 0)).toBeNull();
    expect(LC.turnReview([done({}), done({})], 0)).toBeNull();
    // แก้แล้ว
    const rv = LC.turnReview([u, done({ fix: 'I would like a quote.', fixTh: 'ขอใบเสนอราคา', th: 'ครับ' })], 0);
    expect(rv).toEqual({ typed: 'I want quote', fixed: 'I would like a quote.', changed: true, thai: 'ขอใบเสนอราคา' });
    // ถูกอยู่แล้ว (fix ว่างแต่มี th) · fix ต่างแค่ตัวพิมพ์/วรรคตอน = ไม่นับว่าแก้
    expect(LC.turnReview([u, done({ th: 'ครับ' })], 0)).toEqual({ typed: 'I want quote', fixed: 'I want quote', changed: false, thai: '' });
    expect(LC.turnReview([u, done({ fix: 'i want quote!', th: 'x' })], 0).changed).toBe(false);
  });

  test('turnCard: หน้า = ฉบับแก้ · หลัง = คำแปลไทย (ไม่มี = ที่พิมพ์เดิม) · ข้อความว่าง = null', () => {
    const rv = { typed: 'I want quote', fixed: 'I would like a quote.', changed: true, thai: 'ขอใบเสนอราคา' };
    const c = LC.turnCard('lang-en', rv);
    expect(c.key).toBe(LC.sentenceCardKey('lang-en', 'I would like a quote.'));
    expect(c.face).toEqual(['I would like a quote.', 'ขอใบเสนอราคา']);
    expect(LC.turnCard('lang-en', Object.assign({}, rv, { thai: '' })).face).toEqual(['I would like a quote.', 'I want quote']);
    expect(LC.turnCard('lang-en', { typed: 'Fine.', fixed: 'Fine.', changed: false, thai: '' }).face).toEqual(['Fine.', 'Fine.']);
    expect(LC.turnCard('lang-en', null)).toBeNull();
    expect(LC.turnCard('lang-en', { typed: '?', fixed: '?', changed: false, thai: '' })).toBeNull();
  });
});

// ── หน้าจริง ──
const FAKE_MIC = () => {
  window.__asrJobs = [];
  window.__asrText = 'I need quotation for service';
  const W = window.Worker;
  window.Worker = function (url, o) {
    if (!/asr-worker/.test(String(url))) return new W(url, o);
    const l = {};
    return {
      addEventListener(t, f) { (l[t] = l[t] || []).push(f); },
      removeEventListener(t, f) { l[t] = (l[t] || []).filter((x) => x !== f); },
      postMessage(m) {
        window.__asrJobs.push({ lang: m.lang, len: m.pcm.length });
        const send = (d) => (l.message || []).slice().forEach((f) => f({ data: d }));
        setTimeout(() => { send({ type: 'pipeline-ready', jobId: m.jobId, device: 'wasm' }); send({ type: 'result', jobId: m.jobId, text: window.__asrText }); }, 10);
      },
      terminate() {},
    };
  };
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  window.MediaRecorder = class {
    constructor() { this.state = 'inactive'; this.mimeType = 'audio/wav'; this._l = {}; }
    addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      const n = 16000, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
      'RIFF'.split('').forEach((c, i) => v.setUint8(i, c.charCodeAt(0))); v.setUint32(4, 36 + n * 2, true);
      'WAVEfmt '.split('').forEach((c, i) => v.setUint8(8 + i, c.charCodeAt(0)));
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      'data'.split('').forEach((c, i) => v.setUint8(36 + i, c.charCodeAt(0))); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 20) * 6000, true);
      const blob = new Blob([b], { type: 'audio/wav' });
      (this._l.dataavailable || []).forEach((f) => f({ data: blob }));
      (this._l.stop || []).forEach((f) => f());
    }
  };
};

const FIX = 'I would like a quotation for the service.';
const FIX_TH = 'ฉันต้องการใบเสนอราคาสำหรับงานบริการ';

async function setup(page, { cloud = true, lang } = {}) {
  const errors = await prepare(page);
  const calls = [], apiReqs = [], asrBodies = [];
  page.on('request', (r) => { if (/\/api\//.test(r.url())) apiReqs.push(new URL(r.url()).pathname); });
  await page.addInitScript(FAKE_MIC);
  if (lang) await page.addInitScript((l) => { try { localStorage.setItem('ome:lang', l); } catch (e) {} }, lang);
  if (cloud) await page.addInitScript(() => { window.TANOT_AI = { enabled: true }; });
  await page.route('**/api/asr', (route) => {
    asrBodies.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'I need quotation for service', segments: [], neurons: 1 }) });
  });
  await page.route('**/api/ai/chat', (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    calls.push(body);
    const msgs = body.messages || [];
    const sys = (msgs[0] && msgs[0].content) || '';
    const users = msgs.filter((m) => m.role === 'user' && !/^\(เริ่มฉาก/.test(m.content));
    const last = users.length ? users[users.length - 1].content : '';
    let reply;
    if (/"words"/.test(sys)) reply = '{"words":[{"word":"quotation","thai":"ใบเสนอราคา"}]}';
    else if (!users.length) reply = 'Hello. I need a quote for servicing our air-conditioners.\n{"fix": "", "fixTh": "", "th": "สวัสดี ผมต้องการใบเสนอราคาสำหรับการบำรุงรักษาแอร์"}';
    else if (sentenceSame(last, FIX)) reply = 'Great. What is the scope?\n{"fix": "", "fixTh": "' + FIX_TH + '", "th": "ดีครับ ขอบเขตงานคืออะไร"}';
    else reply = 'Sure. Which units?\n{"fix": "' + FIX + '", "fixTh": "' + FIX_TH + '", "th": "ได้ครับ ตัวไหนบ้าง"}';
    const sse = 'data: ' + JSON.stringify({ t: reply }) + '\n\ndata: {"done":true}\n\n';
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  });
  return { errors, calls, apiReqs, asrBodies };
}
function sentenceSame(a, b) { return LC.sentenceNorm(a) === LC.sentenceNorm(b); }
async function openRoleplay(page) {
  await page.goto('/languages.html');
  await page.click('[data-k="tab-listen"]');
  await page.click('[data-k="lsub-roleplay"]');
}
async function say(page, text) {
  const n = await page.locator('[data-k="rp-msg-user"]').count();
  await page.fill('[data-k="rp-input"]', text);
  await page.click('[data-k="rp-send"]');
  await expect(page.locator('[data-k="rp-msg-user"]')).toHaveCount(n + 1);
  await expect(page.locator('[data-k="rp-msg-ai"]')).toHaveCount(n + 2);
}

test.describe('หน้า: ฉากงาน', () => {
  test('อังกฤษ: กลุ่ม "งาน" มี 10 ฉาก + ฉากเดิม 8 ฉากอยู่เหมือนเดิม · ไม่มี error', async ({ page }) => {
    const { errors } = await setup(page);
    await openRoleplay(page);
    await expect(page.locator('[data-k="rp-work-head"]')).toBeVisible();
    for (const id of WORK_IDS) await expect(page.locator('[data-k="rp-scene-' + id + '"]')).toBeVisible();
    for (const id of OLD_IDS) await expect(page.locator('[data-k="rp-scene-' + id + '"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('ฉากงานแสดงเป็นอังกฤษเมื่อสลับภาษา (ชื่อฉาก + กลุ่ม)', async ({ page }) => {
    await setup(page, { lang: 'en' });
    await openRoleplay(page);
    await expect(page.locator('[data-k="rp-work-head"]')).toHaveText('Work');
    await expect(page.locator('[data-k="rp-scene-workquote"]')).toContainText('Quotation');
  });

  test('ทางเดิน: เลือกฉากงาน → ที่พิมพ์คู่ฉบับแก้ → เก็บเป็นการ์ด (lang-en::u::<hash> + faces + srs) → review.html เห็นการ์ด', async ({ page }) => {
    const { errors, calls, apiReqs } = await setup(page);
    await openRoleplay(page);
    await page.click('[data-k="rp-scene-workquote"]');
    await page.click('[data-k="rp-level-B1"]');
    await page.click('[data-k="rp-start"]');
    await expect(page.locator('[data-k="rp-msg-ai"]').first()).toContainText('I need a quote');
    expect(calls[0].model).toBe('main');
    expect(calls[0].messages[0].content).toContain('Situation (invented');
    // เปิดฉากยังไม่มีประโยคผู้เรียน
    await expect(page.locator('[data-k="rp-card"]')).toHaveCount(0);

    await say(page, 'I want quotation for service');
    // "ที่พิมพ์/พูด" คู่ "ฉบับแก้" เห็นพร้อมกัน
    await expect(page.locator('[data-k="rp-msg-user"]').first()).toHaveText('I want quotation for service');
    await expect(page.locator('[data-k="rp-fix-text"]').first()).toHaveText(FIX);
    await expect(page.locator('[data-k="rp-correct"]')).toHaveCount(0);
    const key = LC.sentenceCardKey('lang-en', FIX);
    await page.locator('[data-k="rp-card"]').first().click();
    await expect(page.locator('[data-k="rp-card"]').first()).toBeDisabled();
    await expect(page.locator('[data-k="rp-card"]').first()).toHaveText('เก็บแล้ว');
    const st = await page.evaluate(() => ({
      faces: JSON.parse(localStorage.getItem('lang-practice:faces') || '{}'),
      srs: JSON.parse(localStorage.getItem('lang-practice:srs') || '{}'),
    }));
    expect(st.faces[key]).toEqual([FIX, FIX_TH]);
    expect(Object.keys(st.srs)).toContain(key);
    expect(Object.keys(st.faces)).toEqual([key]);

    // ตอบด้วยประโยคฉบับแก้ (ต่างแค่วรรคตอน/ตัวพิมพ์) → ถูกต้องแล้ว + การ์ดใบเดิม (ไม่เกิดใบที่สอง)
    await say(page, 'i would like a quotation for the service');
    await expect(page.locator('[data-k="rp-correct"]')).toHaveCount(1);
    // คีย์เดียวกับใบแรก → ปุ่มขึ้น "เก็บแล้ว" ทันที (ไม่มีทางสร้างใบที่สอง)
    await expect(page.locator('[data-k="rp-card"]').nth(1)).toBeDisabled();
    await expect(page.locator('[data-k="rp-card"]').nth(1)).toHaveText('เก็บแล้ว');
    const st2 = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('lang-practice:faces') || '{}')));
    expect(st2).toEqual([key]);

    // review.js อ่านการ์ดนี้ได้ (ถึงกำหนดทันที)
    await page.goto('/review.html#lang');
    await expect(page.locator('#rvDue')).toContainText('1');
    await expect(page.locator('#rvCard .q')).toHaveText(FIX);
    await page.keyboard.press('Space');
    await expect(page.locator('#rvCard .a')).toHaveText(FIX_TH);
    expect(apiReqs.filter((u) => /\/api\/ocr/.test(u))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('ไมค์ (คลาวด์): อัด → /api/asr → ข้อความเข้าช่องพิมพ์ให้ตรวจก่อนส่ง · ไม่ใช้โมเดลในเครื่อง · บทสนทนาไม่ถูกเก็บ', async ({ page }) => {
    const { errors, asrBodies } = await setup(page);
    await openRoleplay(page);
    await page.click('[data-k="rp-scene-workinterview"]');
    await page.click('[data-k="rp-start"]');
    await expect(page.locator('[data-k="rp-msg-ai"]').first()).toBeVisible();
    await page.click('[data-k="rp-mic"]');
    await expect(page.locator('[data-k="rp-mic-stop"]')).toBeVisible();
    await page.click('[data-k="rp-mic-stop"]');
    await expect(page.locator('[data-k="rp-input"]')).toHaveValue('I need quotation for service');
    expect(asrBodies.length).toBe(1);
    expect(asrBodies[0].language).toMatch(/^en/);
    expect(await page.evaluate(() => window.__asrJobs.length)).toBe(0);
    // แก้ข้อความที่ถอดได้ก่อนส่ง
    await page.fill('[data-k="rp-input"]', 'I need a quotation for service');
    await page.click('[data-k="rp-send"]');
    await expect(page.locator('[data-k="rp-msg-user"]')).toHaveText('I need a quotation for service');
    // ไม่เก็บบทสนทนา/เสียง/ข้อความถอดไว้ที่ใด
    const dump = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(dump).not.toContain('I need a quotation for service');
    expect(dump).not.toContain('I need quotation for service');
    expect(errors).toEqual([]);
  });

  test('iPhone ไม่มีคลาวด์: ซ่อนปุ่มพูด (และแจ้งว่าสนทนาไม่รองรับ)', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    const page = await ctx.newPage();
    await setup(page, { cloud: false });
    await openRoleplay(page);
    await page.click('[data-k="rp-scene-workmeeting"]');
    await page.click('[data-k="rp-start"]');
    await expect(page.locator('[data-k="rp-error"]')).toBeVisible();
    await expect(page.locator('[data-k="rp-mic"]')).toHaveCount(0);
    await ctx.close();
  });

  test('iPhone + คลาวด์: มีปุ่มพูด ถอดผ่าน /api/asr เท่านั้น', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    const page = await ctx.newPage();
    const { asrBodies } = await setup(page, { cloud: true });
    await openRoleplay(page);
    await page.click('[data-k="rp-scene-workpresent"]');
    await page.click('[data-k="rp-start"]');
    await expect(page.locator('[data-k="rp-msg-ai"]').first()).toBeVisible();
    await page.click('[data-k="rp-mic"]');
    await page.click('[data-k="rp-mic-stop"]');
    await expect(page.locator('[data-k="rp-input"]')).toHaveValue('I need quotation for service');
    expect(asrBodies.length).toBe(1);
    await ctx.close();
  });
});
