// @ts-check
// ภาษา E4 (ROADMAP แถว 36): พูดสรุปงานวันนี้ ≤ 2 นาที → ถอดเสียง → AI แก้ → เก็บเป็นการ์ด
// known-answer ของ lang-calc.js (reviewMessages/parseReview/reviewCard/clock) + หน้าจริงกับ ASR/AI ปลอม
const path = require('path');
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');
const LC = require(path.resolve(__dirname, '..', 'lang-calc.js'));

test.describe('lang-calc E4 (ตรรกะล้วน)', () => {
  test('DAILY_MAX_SEC = 120 · clock: m:ss', () => {
    expect(LC.DAILY_MAX_SEC).toBe(120);
    expect(LC.clock(0)).toBe('0:00');
    expect(LC.clock(7.9)).toBe('0:07');
    expect(LC.clock(65)).toBe('1:05');
    expect(LC.clock(120)).toBe('2:00');
    expect(LC.clock(-3)).toBe('0:00');
    expect(LC.clock(NaN)).toBe('0:00');
  });

  test('reviewMessages: system บอกภาษา/ระดับ/รูป JSON · user = ข้อความที่ถอดได้ (ตัดที่ 4000 ตัวอักษร) · ไม่มีข้อความ = null', () => {
    const m = LC.reviewMessages('อังกฤษ', 'B1', '  Today I checked the chiller.  ');
    expect(m.length).toBe(2);
    expect(m[0].role).toBe('system');
    expect(m[0].content).toContain('อังกฤษ');
    expect(m[0].content).toContain('B1');
    ['"orig"', '"fixed"', '"note"', '"th"'].forEach((k) => expect(m[0].content).toContain(k));
    expect(m[1]).toEqual({ role: 'user', content: 'Today I checked the chiller.' });
    expect(LC.reviewMessages('อังกฤษ', 'B1', 'x'.repeat(9000))[1].content.length).toBe(4000);
    expect(LC.reviewMessages('อังกฤษ', 'B1', '   ')).toBeNull();
    expect(LC.reviewMessages('อังกฤษ', 'B1', null)).toBeNull();
    // ระดับที่ไม่รู้จัก = A1 เหมือน L5
    expect(LC.reviewMessages('อังกฤษ', 'Z9', 'hi')[0].content).toContain('A1');
  });

  const ARR = '[{"orig":"Today I check the chiller.","fixed":"Today I checked the chiller.","note":"ใช้ past tense","th":"วันนี้ฉันตรวจเครื่องทำน้ำเย็น"},' +
    '{"orig":"It is fine.","fixed":"It is fine.","note":"","th":"ปกติดี"}]';

  test('parseReview: อาร์เรย์ตรง · changed คำนวณจากการเทียบ sentenceNorm', () => {
    const r = LC.parseReview(ARR);
    expect(r).toEqual([
      { orig: 'Today I check the chiller.', fixed: 'Today I checked the chiller.', note: 'ใช้ past tense', th: 'วันนี้ฉันตรวจเครื่องทำน้ำเย็น', changed: true },
      { orig: 'It is fine.', fixed: 'It is fine.', note: '', th: 'ปกติดี', changed: false },
    ]);
  });

  test('parseReview: ทนโค้ดบล็อก/ข้อความนำหน้า-ตามหลัง/ห่อด้วย object', () => {
    expect(LC.parseReview('```json\n' + ARR + '\n```').length).toBe(2);
    expect(LC.parseReview('Here you go:\n' + ARR + '\nHope this helps!').length).toBe(2);
    expect(LC.parseReview('{"items":' + ARR + '}').length).toBe(2);
    expect(LC.parseReview('{"sentences":' + ARR + '}').length).toBe(2);
    expect(LC.parseReview('{"orig":"I go.","fixed":"I went."}')).toEqual([{ orig: 'I go.', fixed: 'I went.', note: '', th: '', changed: true }]);
  });

  test('parseReview: JSON ไม่ครบ (ตัดกลางทาง) = เก็บเฉพาะรายการที่ปิดสมบูรณ์', () => {
    const cut = ARR.slice(0, ARR.indexOf('"fixed":"It is fine."') + 12);
    const r = LC.parseReview(cut);
    expect(r.length).toBe(1);
    expect(r[0].fixed).toBe('Today I checked the chiller.');
    // วงเล็บปีกกาในข้อความไม่ทำให้นับผิด
    expect(LC.parseReview('[{"orig":"Use {x} here.","fixed":"Use {x} here, please."}]')[0].fixed).toBe('Use {x} here, please.');
  });

  test('parseReview: ช่องขาด/ชนิดผิด/ซ้ำ/เกินเพดาน', () => {
    // fixed ขาด = ใช้ orig · orig ขาดแต่มี fixed = ใช้ fixed เป็น orig · ว่างทั้งคู่ = ข้าม · ไม่ใช่ object = ข้าม
    const r = LC.parseReview('[{"orig":"Hello there."},{"fixed":"Good morning."},{"orig":"","fixed":""},"text",7,null,{"orig":12,"fixed":["x"]}]');
    expect(r.map((x) => [x.orig, x.fixed, x.changed])).toEqual([['Hello there.', 'Hello there.', false], ['Good morning.', 'Good morning.', false]]);
    // ซ้ำ (ไม่สนตัวพิมพ์/วรรคตอน) = เก็บอันแรก
    expect(LC.parseReview('[{"orig":"I go.","fixed":"I went."},{"orig":"i go","fixed":"I WENT"}]').length).toBe(1);
    // เพดาน 20 รายการ · ข้อความ ≤ 300 · note ≤ 200
    const many = '[' + Array.from({ length: 30 }, (_, i) => '{"orig":"Sentence number ' + i + '."}').join(',') + ']';
    expect(LC.parseReview(many).length).toBe(20);
    const long = LC.parseReview('[{"orig":"' + 'a'.repeat(500) + '","fixed":"' + 'b'.repeat(500) + '","note":"' + 'n'.repeat(500) + '","th":"' + 'ท'.repeat(500) + '"}]')[0];
    expect([long.orig.length, long.fixed.length, long.note.length, long.th.length]).toEqual([300, 300, 200, 300]);
  });

  test('parseReview: ผลผิดรูปทั้งหมด = []', () => {
    ['', null, undefined, 'Sorry, I cannot help.', '{"error":"x"}', '[]', '[1,2,3]', '{{{', '```json\n```', '[{"orig":'].forEach((x) => expect(LC.parseReview(x)).toEqual([]));
  });

  test('reviewCard: ใช้การ์ดแบบ E3 (คีย์ lang-xx::u::<hash ของฉบับแก้> · หน้า = ฉบับแก้ · หลัง = th) ไม่มี th = ที่พูดเดิม', () => {
    const it = LC.parseReview(ARR)[0];
    const c = LC.reviewCard('lang-en', it);
    expect(c.key).toBe(LC.sentenceCardKey('lang-en', 'Today I checked the chiller.'));
    expect(c.face).toEqual(['Today I checked the chiller.', 'วันนี้ฉันตรวจเครื่องทำน้ำเย็น']);
    expect(LC.reviewCard('lang-en', Object.assign({}, it, { th: '' })).face).toEqual(['Today I checked the chiller.', 'Today I check the chiller.']);
    // ถูกอยู่แล้วไม่มี th → หลัง = ประโยคเดิม (เหมือน turnCard)
    expect(LC.reviewCard('lang-en', { orig: 'Fine.', fixed: 'Fine.', note: '', th: '', changed: false }).face).toEqual(['Fine.', 'Fine.']);
    // ฉบับแก้เดียวกับที่เก็บจากสวมบทบาท = คีย์เดียวกัน (ไม่เกิดการ์ดซ้ำข้ามโหมด)
    expect(c.key).toBe(LC.turnCard('lang-en', { typed: 'x', fixed: 'Today I checked the chiller.', changed: true, thai: '' }).key);
    expect(LC.reviewCard('lang-en', null)).toBeNull();
    expect(LC.reviewCard('lang-en', { orig: '?', fixed: '?', note: '', th: '', changed: false })).toBeNull();
  });
});

// ── หน้าจริง ──
// ไมค์/ถอดเสียงปลอม (แบบเดียวกับ E3) · MediaRecorder ไม่หยุดเองจึงเทสต์ตัดอัตโนมัติด้วย window.TANOT_LANG_DAILY.maxSec
const FAKE_MIC = () => {
  window.__asrJobs = [];
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
  window.__asrText = 'Today I check the chiller. It is fine. I write the report';
  window.__recStops = 0;
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  window.MediaRecorder = class {
    constructor() { this.state = 'inactive'; this.mimeType = 'audio/wav'; this._l = {}; }
    addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); }
    start() { this.state = 'recording'; }
    stop() {
      if (this.state !== 'recording') return;
      this.state = 'inactive'; window.__recStops++;
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

const REVIEW_JSON = JSON.stringify([
  { orig: 'Today I check the chiller.', fixed: 'Today I checked the chiller.', note: 'ใช้ past tense', th: 'วันนี้ฉันตรวจเครื่องทำน้ำเย็น' },
  { orig: 'It is fine.', fixed: 'It is fine.', note: '', th: 'ปกติดี' },
  { orig: 'I write the report', fixed: 'I wrote the report.', note: 'past tense', th: 'ฉันเขียนรายงาน' },
]);

async function setup(page, { cloud = true, reply, lang, maxSec } = {}) {
  const errors = await prepare(page);
  const calls = [], apiReqs = [], asrBodies = [];
  page.on('request', (r) => { if (/\/api\//.test(r.url())) apiReqs.push(new URL(r.url()).pathname); });
  await page.addInitScript(FAKE_MIC);
  if (lang) await page.addInitScript((l) => { try { localStorage.setItem('ome:lang', l); } catch (e) {} }, lang);
  if (maxSec) await page.addInitScript((n) => { window.TANOT_LANG_DAILY = { maxSec: n }; }, maxSec);
  if (cloud) await page.addInitScript(() => { window.TANOT_AI = { enabled: true }; });
  await page.route('**/api/asr', (route) => {
    asrBodies.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Today I check the chiller. It is fine. I write the report', segments: [], neurons: 1 }) });
  });
  await page.route('**/api/ai/chat', (route) => {
    calls.push(JSON.parse(route.request().postData() || '{}'));
    const r = typeof reply === 'function' ? reply(calls.length) : (reply == null ? REVIEW_JSON : reply);
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ t: r }) + '\n\ndata: {"done":true}\n\n' });
  });
  return { errors, calls, apiReqs, asrBodies };
}
async function openDaily(page) {
  await page.goto('/languages.html');
  await page.click('[data-k="tab-listen"]');
  await page.click('[data-k="lsub-daily"]');
}
async function recordOnce(page) {
  await page.click('[data-k="ds-rec"]');
  await expect(page.locator('[data-k="ds-stop"]')).toBeVisible();
  await page.click('[data-k="ds-stop"]');
}
const store = (page) => page.evaluate(() => ({
  faces: JSON.parse(localStorage.getItem('lang-practice:faces') || '{}'),
  srs: JSON.parse(localStorage.getItem('lang-practice:srs') || '{}'),
}));

test.describe('หน้า: พูดสรุปงานวันนี้', () => {
  test('ทางเดิน: อัด → /api/asr → AI main → ตารางต้นฉบับคู่ฉบับแก้ → ติ๊ก → เก็บการ์ด (faces + srs) → review.html', async ({ page }) => {
    const { errors, calls, apiReqs, asrBodies } = await setup(page);
    await openDaily(page);
    await recordOnce(page);
    await expect(page.locator('[data-k="ds-row"]')).toHaveCount(3);
    // ถอดเสียงทางคลาวด์ ไม่ใช้โมเดลในเครื่อง · AI ใช้ main · ส่งข้อความที่ถอดไปตรวจ
    expect(asrBodies.length).toBe(1);
    expect(asrBodies[0].language).toMatch(/^en/);
    expect(await page.evaluate(() => window.__asrJobs.length)).toBe(0);
    expect(calls.length).toBe(1);
    expect(calls[0].model).toBe('main');
    expect(calls[0].messages[1].content).toBe('Today I check the chiller. It is fine. I write the report');
    // ต้นฉบับคู่ฉบับแก้
    await expect(page.locator('[data-k="ds-orig"]').nth(0)).toHaveText('Today I check the chiller.');
    await expect(page.locator('[data-k="ds-fixed"]').nth(0)).toHaveText('Today I checked the chiller.');
    await expect(page.locator('[data-k="ds-note"]').nth(0)).toHaveText('ใช้ past tense');
    // ติ๊กเริ่มต้น = เฉพาะที่แก้ (2 จาก 3)
    await expect(page.locator('[data-k="ds-pick"]').nth(0)).toBeChecked();
    await expect(page.locator('[data-k="ds-pick"]').nth(1)).not.toBeChecked();
    await expect(page.locator('[data-k="ds-pick"]').nth(2)).toBeChecked();
    await expect(page.locator('[data-k="ds-save"]')).toHaveText('เก็บที่เลือกเป็นการ์ด (2)');
    await page.locator('[data-k="ds-pick"]').nth(1).check();
    await expect(page.locator('[data-k="ds-save"]')).toHaveText('เก็บที่เลือกเป็นการ์ด (3)');
    await page.locator('[data-k="ds-pick"]').nth(1).uncheck();
    await page.click('[data-k="ds-save"]');
    await expect(page.locator('[data-k="ds-added"]')).toHaveText('เพิ่มแล้ว 2 การ์ด');
    const k1 = LC.sentenceCardKey('lang-en', 'Today I checked the chiller.');
    const k3 = LC.sentenceCardKey('lang-en', 'I wrote the report.');
    const st = await store(page);
    expect(st.faces[k1]).toEqual(['Today I checked the chiller.', 'วันนี้ฉันตรวจเครื่องทำน้ำเย็น']);
    expect(Object.keys(st.faces).sort()).toEqual([k1, k3].sort());
    expect(Object.keys(st.srs).sort()).toEqual([k1, k3].sort());
    // XP 10 ต่อครั้งที่ทำจบ
    const xp = await page.evaluate(() => (JSON.parse(localStorage.getItem('tanot:learn:xp') || '[]')).reduce((n, r) => n + (r.xp || 0), 0));
    expect(xp).toBe(10);
    // review.js อ่านการ์ดได้
    await page.goto('/review.html#lang');
    await expect(page.locator('#rvDue')).toContainText('2');
    expect(apiReqs.filter((u) => !/^\/api\/(ai\/chat|asr|sync|session|files|push|ai\/usage)/.test(u))).toEqual([]);
    expect(apiReqs.filter((u) => /\/api\/ocr/.test(u))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('เก็บซ้ำ/ฉบับเดียวกับที่เก็บจากสวมบทบาท = การ์ดใบเดียว (ไม่ทับ SRS เดิม)', async ({ page }) => {
    await setup(page);
    const k1 = LC.sentenceCardKey('lang-en', 'Today I checked the chiller.');
    await page.addInitScript((k) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('lang-practice:srs', JSON.stringify({ [k]: { dueAt: 123, reps: 4 } }));
        localStorage.setItem('lang-practice:faces', JSON.stringify({ [k]: ['Today I checked the chiller.', 'เดิม'] }));
      }
    }, k1);
    await openDaily(page);
    await recordOnce(page);
    await expect(page.locator('[data-k="ds-row"]')).toHaveCount(3);
    await page.click('[data-k="ds-save"]');
    await expect(page.locator('[data-k="ds-added"]')).toBeVisible();
    const st = await store(page);
    expect(st.srs[k1]).toEqual({ dueAt: 123, reps: 4 });
    expect(Object.keys(st.srs).length).toBe(2);
    expect(Object.keys(st.faces).length).toBe(2);
  });

  test('ตัวนับเวลา + ตัดอัตโนมัติเมื่อครบเวลา (maxSec = 2 ในเทสต์) → ถอดเสียงต่อเอง', async ({ page }) => {
    await setup(page, { maxSec: 2 });
    await openDaily(page);
    await page.click('[data-k="ds-rec"]');
    await expect(page.locator('[data-k="ds-timer"]')).toContainText('/ 0:02');
    expect(await page.evaluate(() => window.__recStops)).toBe(0);
    await expect(page.locator('[data-k="ds-row"]')).toHaveCount(3, { timeout: 8000 });
    expect(await page.evaluate(() => window.__recStops)).toBe(1);
  });

  test('ค่าเริ่มต้นของเพดานเวลา = 2:00 ในตัวนับ', async ({ page }) => {
    await setup(page);
    await openDaily(page);
    await page.click('[data-k="ds-rec"]');
    await expect(page.locator('[data-k="ds-timer"]')).toHaveText(/^0:0\d \/ 2:00$/);
    await page.click('[data-k="ds-stop"]');
  });

  test('AI ตอบรูปที่อ่านไม่ได้ = ข้อความ + ปุ่มตรวจใหม่ (ไม่ถอดเสียงซ้ำ) · ไม่ได้ XP', async ({ page }) => {
    const { asrBodies, calls } = await setup(page, { reply: (n) => (n === 1 ? 'Sorry, I cannot do that.' : REVIEW_JSON) });
    await openDaily(page);
    await recordOnce(page);
    await expect(page.locator('[data-k="ds-error"]')).toBeVisible();
    await expect(page.locator('[data-k="ds-row"]')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('tanot:learn:xp'))).toBeNull();
    await page.click('[data-k="ds-retry"]');
    await expect(page.locator('[data-k="ds-row"]')).toHaveCount(3);
    expect(asrBodies.length).toBe(1);
    expect(calls.length).toBe(2);
  });

  test('ถอดเสียงว่าง = ข้อความ "ไม่ได้ยินเสียงพูด" ไม่เรียก AI', async ({ page }) => {
    const { calls } = await setup(page);
    await page.route('**/api/asr', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: '  ', segments: [], neurons: 1 }) }));
    await openDaily(page);
    await recordOnce(page);
    await expect(page.locator('[data-k="ds-error"]')).toContainText('ไม่ได้ยินเสียงพูด');
    expect(calls.length).toBe(0);
    await expect(page.locator('[data-k="ds-retry"]')).toHaveCount(0);
  });

  test('ถอดเสียงล้ม (/api/asr 500) = ข้อความบอก ไม่ถอยไปทางอื่นเงียบๆ บนคลาวด์ที่ใช้ได้ + ปุ่มอัดใหม่ใช้ได้', async ({ page }) => {
    await setup(page);
    await page.route('**/api/asr', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"code":"pin_required"}' }));
    await openDaily(page);
    await recordOnce(page);
    await expect(page.locator('[data-k="ds-error"]')).toBeVisible();
    await expect(page.locator('[data-k="ds-rec"]')).toBeEnabled();
  });

  test('ไม่เก็บเสียง/ข้อความถอด/บทตรวจ ที่ใด: ไม่อยู่ใน localStorage (นอกจากการ์ดที่ผู้ใช้เก็บ) · problem log · IndexedDB', async ({ page }) => {
    await setup(page);
    await openDaily(page);
    await recordOnce(page);
    await expect(page.locator('[data-k="ds-row"]')).toHaveCount(3);
    // ยังไม่กดเก็บ → ไม่มีข้อความใดอยู่ใน storage ทั้งหมด
    const dump = await page.evaluate(async () => {
      const ls = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
      let idb = '';
      try {
        const dbs = (indexedDB.databases ? await indexedDB.databases() : []);
        for (const d of dbs) {
          const db = await new Promise((res, rej) => { const q = indexedDB.open(d.name); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
          for (const sn of Array.from(db.objectStoreNames)) {
            const all = await new Promise((res) => { const q = db.transaction(sn).objectStore(sn).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => res([]); });
            idb += JSON.stringify(all, (k, v) => (v instanceof Blob ? 'BLOB:' + v.size : v));
          }
          db.close();
        }
      } catch (e) {}
      return ls + idb;
    });
    ['check the chiller', 'checked the chiller', 'I write the report', 'ใช้ past tense'].forEach((s) => expect(dump).not.toContain(s));
    expect(dump).not.toContain('BLOB:');
    expect(await page.evaluate(() => localStorage.getItem('tanot:media:log'))).toBeNull();
  });

  test('ล้างทุกอย่างเมื่อกด "สรุปใหม่" · ออกจากหน้า/สลับภาษาระหว่างอัดแล้วไมค์ถูกปิด', async ({ page }) => {
    await setup(page);
    await openDaily(page);
    await recordOnce(page);
    await expect(page.locator('[data-k="ds-row"]')).toHaveCount(3);
    await page.click('[data-k="ds-new"]');
    await expect(page.locator('[data-k="ds-row"]')).toHaveCount(0);
    await expect(page.locator('[data-k="ds-rec"]')).toBeEnabled();
    await page.click('[data-k="ds-rec"]');
    await expect(page.locator('[data-k="ds-stop"]')).toBeVisible();
    await page.click('[data-k="lsub-listening"]'); // ออกจากแผงขณะอัด = ทิ้งเสียง ไม่ถอดไม่ส่ง
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__asrJobs.length)).toBe(0);
  });

  test('EN: ข้อความ UI เป็นอังกฤษหมดบนแผงนี้ (ไม่มีไทยหลุดนอกข้อความของผู้ใช้/AI)', async ({ page }) => {
    await setup(page, { lang: 'en' });
    await openDaily(page);
    await expect(page.locator('[data-k="ds-rec"]')).toHaveText(/Record/);
    await recordOnce(page);
    await expect(page.locator('[data-k="ds-row"]')).toHaveCount(3);
    await expect(page.locator('[data-k="ds-save"]')).toHaveText('Save selected as cards (2)');
    const ui = await page.evaluate(() => {
      const root = document.querySelector('[data-k="ds-save"]').closest('div').parentElement;
      const c = root.cloneNode(true);
      c.querySelectorAll('[data-i18n-skip]').forEach((n) => n.remove());
      return c.textContent;
    });
    expect(ui).not.toMatch(/[฀-๿]/);
  });

  test('iPhone ไม่มีคลาวด์: ซ่อนปุ่มโหมดนี้ · iPhone + คลาวด์: ใช้ได้ ถอดผ่าน /api/asr เท่านั้น', async ({ browser }) => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const c1 = await browser.newContext({ userAgent: ua });
    const p1 = await c1.newPage();
    await setup(p1, { cloud: false });
    await p1.goto('/languages.html');
    await p1.click('[data-k="tab-listen"]');
    await expect(p1.locator('[data-k="lsub-listening"]')).toBeVisible();
    await expect(p1.locator('[data-k="lsub-daily"]')).toHaveCount(0);
    await c1.close();
    const c2 = await browser.newContext({ userAgent: ua });
    const p2 = await c2.newPage();
    const { asrBodies } = await setup(p2, { cloud: true });
    await openDaily(p2);
    await recordOnce(p2);
    await expect(p2.locator('[data-k="ds-row"]')).toHaveCount(3);
    expect(asrBodies.length).toBe(1);
    await c2.close();
  });

  test('มือถือ 390 / 360: ไม่มีแถบเลื่อนแนวนอน · ปุ่มกด ≥ 40px', async ({ browser }) => {
    for (const w of [390, 360]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
      const page = await ctx.newPage();
      await setup(page);
      await openDaily(page);
      await recordOnce(page);
      await expect(page.locator('[data-k="ds-row"]')).toHaveCount(3);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        small: Array.from(document.querySelectorAll('[data-k="ds-save"],[data-k="ds-new"],[data-k="ds-row"] label')).map((b) => Math.round(b.getBoundingClientRect().height)).filter((h) => h < 40) }));
      expect(m.sw).toBeLessThanOrEqual(m.cw);
      expect(m.small).toEqual([]);
      await ctx.close();
    }
  });
});
