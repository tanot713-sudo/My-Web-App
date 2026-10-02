// @ts-check
// Web Push + การแจ้งเตือน (ROADMAP Phase 3 / 0a ข้อ 6): tanot-push.js, functions/api/push/*, functions/_lib/{webpush,reminders,push,scheduler}.js, sw.js
// เซิร์ฟเวอร์ทดสอบพอร์ต 8130 (sync-server.mjs): D1 = SQLite, R2 ตัวหลอก, บริการ push ตัวหลอก /__pushsink/<id> — ข้อความที่ส่งจริงถูกเข้ารหัส
// aes128gcm + ลงชื่อ VAPID ตามมาตรฐาน แล้วเทสต์ถอดรหัสด้วยคีย์ฝั่งเบราว์เซอร์ที่สร้างเองที่นี่ (พิสูจน์ว่าเบราว์เซอร์จริงอ่านได้)
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const zlib = require('zlib');
const { prepare } = require('./helpers');

const ROOT = path.resolve(__dirname, '..');
const SRV = 'http://localhost:8130';
const NOW = new Date('2026-10-02T10:30:00+07:00');
const IC = require(path.join(ROOT, 'insurance-calc.js'));
const TC = require(path.join(ROOT, 'tax-calc.js'));
const MC = require(path.join(ROOT, 'mnt-calc.js'));
// functions/_lib/*.js เป็น ES module ในโฟลเดอร์ที่ไม่มี package.json "type":"module" (ตั้งใจ — ไม่เพิ่ม package.json ในโปรเจกต์ Pages)
// ตัวโหลดของ Playwright จึงอ่านเป็น CommonJS ไม่ได้ → คัดลอกเป็น .mjs ไว้ในโฟลเดอร์ชั่วคราวแล้ว import (โค้ดเดียวกันทุกไบต์ ยกเว้นนามสกุลใน import)
let libDir;
function lib(f) {
  if (!libDir) {
    libDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tanot-lib-'));
    for (const n of fs.readdirSync(path.join(ROOT, 'functions/_lib'))) {
      const src = fs.readFileSync(path.join(ROOT, 'functions/_lib', n), 'utf8').replace(/(from\s+'\.\/[\w-]+)\.js'/g, "$1.mjs'");
      fs.writeFileSync(path.join(libDir, n.replace(/\.js$/, '.mjs')), src);
    }
  }
  return import(require('url').pathToFileURL(path.join(libDir, f.replace(/\.js$/, '.mjs'))).href);
}

test.describe.configure({ mode: 'serial' });

/* ── ฝั่ง "เบราว์เซอร์" ของบริการ push: คู่คีย์ ECDH + auth secret, ถอดรหัส aes128gcm, ตรวจลายเซ็น VAPID ── */
const enc = new TextEncoder();
const b64u = (u8) => Buffer.from(u8).toString('base64url');
const unb64u = (s) => new Uint8Array(Buffer.from(s, 'base64url'));
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function newSubscriber(id) {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { kp, pub, auth, endpoint: SRV + '/__pushsink/' + id, keys: { p256dh: b64u(pub), auth: b64u(auth) } };
}
async function hkdf(salt, ikm, info, n) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, n * 8));
}
async function decrypt(sub, b64body) {
  const buf = new Uint8Array(Buffer.from(b64body, 'base64'));
  const salt = buf.slice(0, 16), rs = new DataView(buf.buffer).getUint32(16), idlen = buf[20];
  const asPub = buf.slice(21, 21 + idlen), ct = buf.slice(21 + idlen);
  expect(rs).toBe(4096);
  const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, sub.kp.privateKey, 256));
  const ikm = await hkdf(sub.auth, ecdh, cat(enc.encode('WebPush: info\0'), sub.pub, asPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct));
  let end = plain.length - 1;
  while (end >= 0 && plain[end] === 0) end--;
  expect(plain[end]).toBe(2); // ตัวคั่น record สุดท้าย
  return JSON.parse(new TextDecoder().decode(plain.slice(0, end)));
}
async function verifyVapid(headers, publicKey) {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(headers.authorization || '');
  expect(m, 'Authorization: vapid t=…, k=…').toBeTruthy();
  expect(m[2]).toBe(publicKey);
  const [h, p, s] = m[1].split('.');
  const key = await crypto.subtle.importKey('raw', unb64u(m[2]), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64u(s), enc.encode(h + '.' + p));
  return { ok, header: JSON.parse(Buffer.from(h, 'base64url').toString()), claims: JSON.parse(Buffer.from(p, 'base64url').toString()) };
}

const T = (iso) => new Date(iso).getTime();
const dump = async (request) => (await request.get(SRV + '/__push')).json();
const pushLog = async (request, clear) => (await request.get(SRV + '/__pushlog' + (clear ? '?clear=1' : ''))).json();
async function apiSubscribe(request, sub, device = 'test') {
  const r = await request.post(SRV + '/api/push/subscribe', { data: { subscription: { endpoint: sub.endpoint, keys: sub.keys }, device } });
  expect(r.status()).toBe(200);
}
async function setScope(request, scope, items) {
  const r = await request.post(SRV + '/api/push/reminders', { data: { scope, items } });
  expect(r.status(), await r.text()).toBe(200);
  return r.json();
}

/* ══════════ A. ตรรกะล้วน (functions/_lib/reminders.js) — เวลาไทย ══════════ */
test.describe('reminders.js (เวลาไทย)', () => {
  test('ictDate / ictDayStart / ictAt: วันเปลี่ยนตอนเที่ยงคืนเวลาไทย (17:00 UTC) ไม่ใช่เที่ยงคืน UTC', async () => {
    const R = await lib('reminders.js');
    expect(R.ictDate(T('2026-10-02T16:59:59Z'))).toBe('2026-10-02');
    expect(R.ictDate(T('2026-10-02T17:00:00Z'))).toBe('2026-10-03');
    expect(R.ictDayStart(T('2026-10-02T23:30:00Z'))).toBe(T('2026-10-02T17:00:00Z'));
    expect(R.ictAt('2026-10-03', 7)).toBe(T('2026-10-03T00:00:00Z'));
    expect(R.ictAt('2026-10-03', 8)).toBe(T('2026-10-03T08:00:00+07:00'));
    expect(Number.isNaN(R.ictAt('ไม่ใช่วันที่'))).toBe(true);
  });

  test('nextRepeat / advance: เดือนถัดไปถอยเป็นวันสุดท้าย · ข้ามรอบที่พลาด', async () => {
    const R = await lib('reminders.js');
    const jan31 = T('2027-01-31T08:00:00+07:00');
    expect(R.nextRepeat(jan31, 'monthly')).toBe(T('2027-02-28T08:00:00+07:00'));
    expect(R.nextRepeat(T('2028-02-29T08:00:00+07:00'), 'yearly')).toBe(T('2029-02-28T08:00:00+07:00'));
    expect(R.nextRepeat(jan31, 'weekly')).toBe(T('2027-02-07T08:00:00+07:00'));
    expect(R.nextRepeat(jan31, null)).toBeNull();
    // พลาดมา 3 วัน (รายวัน) → ไปวันถัดจาก now ทันที ไม่ส่ง 3 ครั้งรัว
    expect(R.advance(T('2026-10-01T08:00:00+07:00'), 'daily', T('2026-10-04T09:00:00+07:00'))).toBe(T('2026-10-05T08:00:00+07:00'));
  });

  test('pickDue: ถึงเวลา (≤ now) ส่ง · ยังไม่ถึงไม่ส่ง · เลยมาเกิน 2 วันปิดเงียบ · digest/ส่งแล้ว/ปิดแล้วไม่ใช่งานของ tick', async () => {
    const R = await lib('reminders.js');
    const now = T('2026-10-03T08:00:00+07:00');
    const rows = [
      { id: 'a', kind: 'push', due_at: T('2026-10-03T08:00:00+07:00'), sent_at: null, done: 0 },
      { id: 'b', kind: 'push', due_at: T('2026-10-03T08:00:01+07:00'), sent_at: null, done: 0 },
      { id: 'c', kind: 'push', due_at: T('2026-09-30T08:00:00+07:00'), sent_at: null, done: 0 },
      { id: 'd', kind: 'push', due_at: T('2026-10-02T08:00:00+07:00'), sent_at: 1, done: 0 },
      { id: 'e', kind: 'digest', due_at: T('2026-10-03T07:00:00+07:00'), sent_at: null, done: 0 },
      { id: 'f', kind: 'push', due_at: T('2026-10-01T09:00:00+07:00'), sent_at: null, done: 0 },
      { id: 'g', kind: 'push', due_at: T('2026-10-02T08:00:00+07:00'), sent_at: null, done: 1 },
    ];
    const { send, stale } = R.pickDue(rows, now);
    expect(send.map((r) => r.id)).toEqual(['f', 'a']);
    expect(stale.map((r) => r.id)).toEqual(['c']);
  });

  test('digestFor: เอาเฉพาะแถว digest ของ "วันนี้" ตามเวลาไทย — 00:30 ไทยของวันที่ 3 ยังเป็น 2 ต.ค. ตาม UTC', async () => {
    const R = await lib('reminders.js');
    const rows = [
      { id: 'maintenance:2026-10-03', source: 'maintenance', kind: 'digest', title: 'งานบำรุงรักษา', body: 'ถึงกำหนด 2', url: 'maintenance.html#tab=calendar', due_at: R.ictAt('2026-10-03', 7) },
      { id: 'maintenance:2026-10-04', source: 'maintenance', kind: 'digest', title: 'งานบำรุงรักษา', body: 'ถึงกำหนด 3', url: 'maintenance.html#tab=calendar', due_at: R.ictAt('2026-10-04', 7) },
      { id: 'insurance:x', source: 'insurance', kind: 'push', title: 'ต่ออายุ', due_at: R.ictAt('2026-10-03', 8) },
    ];
    expect(R.digestFor(rows, T('2026-10-02T16:59:00Z'))).toBeNull(); // 23:59 ไทย วันที่ 2
    const d = R.digestFor(rows, T('2026-10-02T17:30:00Z')); // 00:30 ไทย วันที่ 3
    expect(d).toMatchObject({ title: 'สรุปประจำวัน', body: 'งานบำรุงรักษา: ถึงกำหนด 2', url: 'maintenance.html#tab=calendar', tag: 'daily-2026-10-03', ids: ['maintenance:2026-10-03'] });
    // หลายแหล่ง → ลิงก์ไปหน้าวันนี้
    const d2 = R.digestFor([rows[0], { ...rows[1], id: 'car:1', source: 'car', title: 'รถ', body: 'พ.ร.บ.', url: 'soon.html', due_at: rows[0].due_at }], T('2026-10-03T00:00:00Z'));
    expect(d2.body).toBe('รถ: พ.ร.บ.\nงานบำรุงรักษา: ถึงกำหนด 2');
    expect(d2.url).toBe('index.html');
  });

  test('cleanItems: id ขึ้นต้นด้วย scope · ทิ้ง URL นอกเว็บ/เวลาเพี้ยน/repeat แปลก/id ซ้ำ · scope ต้องเป็นตัวพิมพ์เล็ก', async () => {
    const R = await lib('reminders.js');
    const due = T('2026-10-10T08:00:00+07:00');
    const { rows, dropped } = R.cleanItems('insurance', [
      { id: 'p1', title: 'ok', url: 'insurance.html', due_at: due },
      { id: 'p2', title: 'ลิงก์นอก', url: 'https://evil.example/x.html', due_at: due },
      { id: 'p3', title: 'protocol', url: 'javascript:alert(1).html', due_at: due },
      { id: 'p4', title: 'เวลาเพี้ยน', due_at: 'พรุ่งนี้' },
      { id: 'p5', title: 'repeat', due_at: due, repeat: 'hourly' },
      { id: 'p1', title: 'ซ้ำ', due_at: due },
      { id: 'p6', title: 'digest', due_at: due, kind: 'digest', url: 'maintenance.html#tab=calendar' },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['insurance:p1', 'insurance:p6']);
    expect(rows[1].kind).toBe('digest');
    expect(dropped).toBe(5);
    expect(() => R.cleanItems('Insurance!', [])).toThrow('scope');
    expect(() => R.cleanItems('tax', Array(201).fill({ id: 'x', title: 'x', due_at: due }))).toThrow('too many');
  });

  test('validEndpoint: ส่งได้เฉพาะบริการ push ของเบราว์เซอร์ (https) — กันใช้เป็นทางยิงไปที่อื่น', async () => {
    const W = await lib('webpush.js');
    expect(W.validEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(W.validEndpoint('https://web.push.apple.com/QGx')).toBe(true);
    expect(W.validEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(W.validEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true);
    expect(W.validEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(W.validEndpoint('https://fcm.googleapis.com.evil.example/x')).toBe(false);
    expect(W.validEndpoint('https://169.254.169.254/latest')).toBe(false);
    expect(W.validEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
    expect(W.validEndpoint(SRV + '/__pushsink/x')).toBe(false);
    expect(W.validEndpoint(SRV + '/__pushsink/x', { PUSH_DEV_ENDPOINT: SRV + '/__pushsink/' })).toBe(true);
  });
});

/* ══════════ B. ตัวสร้างการแจ้งเตือนของแต่ละหน้า (known-answer) ══════════ */
test.describe('ตัวสร้างการแจ้งเตือน (insurance-calc / tax-calc / mnt-calc)', () => {
  test('InsuranceCalc.reminders: ก่อน 30/7 วัน + วันครบกำหนด 08:00 ไทย · เฉพาะที่ยังไม่ถึง · ข้ามที่สิ้นสุดแล้ว', () => {
    const pols = [
      { id: 'a', type: 'health', name: 'สุขภาพ', insurer: 'AIA', premium: 12000, renewDate: '2026-10-15' },
      { id: 'b', type: 'car', insurer: 'วิริยะ', renewDate: '2026-12-01' },
      { id: 'c', type: 'life', renewDate: '2026-11-01', endDate: '2026-09-01' }, // สิ้นสุดแล้ว
      { id: 'd', type: 'home', renewDate: '' },
    ];
    const r = IC.reminders(pols, NOW);
    expect(r.map((x) => x.id)).toEqual(['a:2026-10-15:7', 'a:2026-10-15:0', 'b:2026-12-01:30', 'b:2026-12-01:7', 'b:2026-12-01:0']);
    expect(r[0]).toEqual({
      id: 'a:2026-10-15:7', title: 'ต่ออายุประกันใน 7 วัน', body: 'สุขภาพ · AIA · ครบกำหนด 15 ต.ค. 2569 · ฿12,000',
      url: 'insurance.html', due_at: T('2026-10-08T08:00:00+07:00'), kind: 'push',
    });
    expect(r[1].title).toBe('ครบกำหนดต่ออายุประกันวันนี้');
    expect(r[2].body).toBe('รถ · วิริยะ · ครบกำหนด 1 ธ.ค. 2569');
    expect(r[2].due_at).toBe(T('2026-11-01T08:00:00+07:00'));
  });

  test('TaxCalc.reminders: วันที่มาจากไฟล์กฎ (deadlines.online) ก่อน 30/7/1 วัน + วันสุดท้าย · ปีที่เลยกำหนดไม่มี', () => {
    const rules = { 2568: require(path.join(ROOT, 'tax-rules/2568.json')), 2569: require(path.join(ROOT, 'tax-rules/2569.json')) };
    const r = TC.reminders(rules, NOW);
    expect(r.map((x) => x.id)).toEqual(['2569:2027-04-08:30', '2569:2027-04-08:7', '2569:2027-04-08:1', '2569:2027-04-08:0']);
    expect(r[0]).toEqual({
      id: '2569:2027-04-08:30', title: 'ยื่นภาษีเงินได้ปี 2569 — อีก 30 วัน', body: 'ยื่นออนไลน์ภายใน 8 เม.ย. 2570 · แบบกระดาษ 31 มี.ค. 2570',
      url: 'tax.html', due_at: T('2027-03-09T08:00:00+07:00'), kind: 'push',
    });
    expect(r[3].title).toBe('วันสุดท้ายยื่นภาษีเงินได้ปี 2569');
    // 2568 ยังไม่เลยกำหนดถ้า "วันนี้" อยู่ต้นปี 2569
    expect(TC.reminders(rules, new Date('2026-04-07T12:00:00+07:00')).map((x) => x.id)).toEqual(['2568:2026-04-08:0', '2569:2027-04-08:30', '2569:2027-04-08:7', '2569:2027-04-08:1', '2569:2027-04-08:0']);
  });

  test('MntCalc.digest: 1 รายการต่อวัน (ไม่ใช่ทีละเครื่อง) · รอบเดือนที่จบโดยไม่ทำกลายเป็นเลยกำหนด · ทำแล้วหายจากสรุป · 07:00 ไทย', () => {
    const mk = (id, ph) => ({ id, code: 'ESC-0' + id, name: 'บันไดเลื่อน', type: 'ESC', site: 's1', phase: { M3: ph }, status: 'active' });
    const assets = [mk('1', 2), mk('2', 1), mk('3', 2), mk('4', 1), mk('5', 2)];
    const plans = [{ id: 'ESC|M3', type: 'ESC', freq: 'M3', items: [] }];
    const settings = { startMonth: '2026-10' };
    const d = MC.digest({ assets, plans, settings, done: new Map(), today: '2026-10-30', days: 4 });
    expect(d.map((x) => [x.id, x.body])).toEqual([
      ['2026-10-30', 'ถึงกำหนด 2'], ['2026-10-31', 'ถึงกำหนด 2'],
      ['2026-11-01', 'เลยกำหนด 2 · ถึงกำหนด 3'], ['2026-11-02', 'เลยกำหนด 2 · ถึงกำหนด 3'],
    ]);
    expect(d[0]).toMatchObject({ title: 'งานบำรุงรักษา', url: 'maintenance.html#tab=calendar', kind: 'digest', due_at: T('2026-10-30T07:00:00+07:00') });
    // ตรวจ ESC-02 รอบ ต.ค. แล้ว → เหลือถึงกำหนด 1 / เลยกำหนด 1
    const done = MC.doneIndex([{ freq: 'M3', period: '2026-10', dev: 'x', rows: { 2: { at: T('2026-10-20T10:00:00+07:00'), res: {} } } }]);
    expect(MC.digest({ assets, plans, settings, done, today: '2026-10-31', days: 2 }).map((x) => x.body)).toEqual(['ถึงกำหนด 1', 'เลยกำหนด 1 · ถึงกำหนด 3']);
    // ไม่มีงาน = ไม่มีรายการ
    expect(MC.digest({ assets: [], plans, settings, done: new Map(), today: '2026-10-30', days: 3 })).toEqual([]);
  });
});

/* ══════════ C. API + scheduler (D1/R2 ตัวหลอก, บริการ push ตัวหลอก) ══════════ */
test.describe('API /api/push/* + scheduler', () => {
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('subscribe → ส่งทดสอบ: ข้อความเข้ารหัส aes128gcm ถอดได้ด้วยคีย์ของเบราว์เซอร์ + JWT VAPID ลงชื่อถูก · unsubscribe ลบแถว', async ({ request }) => {
    const sub = await newSubscriber('dev1');
    const cfg0 = await (await request.get(SRV + '/api/push/config?endpoint=' + encodeURIComponent(sub.endpoint))).json();
    expect(cfg0).toMatchObject({ vapid: 'ok', subs: 0, subscribed: false });
    await apiSubscribe(request, sub, 'iPhone · Safari · แอป');
    const cfg = await (await request.get(SRV + '/api/push/config?endpoint=' + encodeURIComponent(sub.endpoint))).json();
    expect(cfg).toMatchObject({ subs: 1, subscribed: true });

    const r = await request.post(SRV + '/api/push/test', { data: { endpoint: sub.endpoint } });
    expect(await r.json()).toMatchObject({ subs: 1, sent: 1 });
    const log = await pushLog(request);
    expect(log).toHaveLength(1);
    expect(log[0].headers['content-encoding']).toBe('aes128gcm');
    expect(+log[0].headers.ttl).toBeGreaterThan(0);
    expect(await decrypt(sub, log[0].body)).toEqual({ title: 'Tanot', body: 'ทดสอบการแจ้งเตือน', url: 'notifications.html', tag: 'test' });
    const v = await verifyVapid(log[0].headers, cfg.publicKey);
    expect(v.ok).toBe(true);
    expect(v.header).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(v.claims.aud).toBe(SRV);
    expect(v.claims.sub).toBe('mailto:test@example.com');
    expect(v.claims.exp * 1000).toBeGreaterThan(Date.now());
    expect(v.claims.exp * 1000).toBeLessThanOrEqual(Date.now() + 24 * 3600 * 1000);
    expect((await dump(request)).subs[0]).toMatchObject({ device: 'iPhone · Safari · แอป', fail_count: 0 });
    expect((await dump(request)).subs[0].last_ok_at).toBeGreaterThan(0);

    const u = await request.post(SRV + '/api/push/unsubscribe', { data: { endpoint: sub.endpoint } });
    expect(u.status()).toBe(200);
    expect((await dump(request)).subs).toEqual([]);
  });

  test('subscribe ปฏิเสธ endpoint นอกบริการ push / คีย์ผิด / Origin ของเว็บอื่น · ไม่มีคีย์ VAPID = ส่งทดสอบไม่ได้', async ({ request }) => {
    const sub = await newSubscriber('x');
    const bad = (data, headers) => request.post(SRV + '/api/push/subscribe', { data, headers });
    expect((await bad({ subscription: { endpoint: 'https://evil.example/push', keys: sub.keys } })).status()).toBe(400);
    expect((await bad({ subscription: { endpoint: sub.endpoint, keys: { p256dh: 'abc', auth: sub.keys.auth } } })).status()).toBe(400);
    expect((await bad({ subscription: { endpoint: sub.endpoint, keys: sub.keys } }, { Origin: 'https://evil.example' })).status()).toBe(403);
    expect((await dump(request)).subs).toEqual([]);
    await request.get(SRV + '/__vapid?off=1');
    expect(await (await request.get(SRV + '/api/push/config')).json()).toMatchObject({ vapid: 'missing', publicKey: '' });
    await apiSubscribe(request, sub);
    const t = await request.post(SRV + '/api/push/test', { data: { endpoint: sub.endpoint } });
    expect(t.status()).toBe(503);
    expect((await t.json()).code).toBe('vapid');
  });

  test('reminders: แทนที่ทั้ง scope · เขียนเฉพาะที่เปลี่ยน · ส่งแล้วไม่ส่งซ้ำถ้าวันเดิม · เลื่อนวัน = ส่งใหม่ · scope อื่นไม่โดน', async ({ request }) => {
    const due1 = T('2026-10-08T08:00:00+07:00'), due2 = T('2026-10-15T08:00:00+07:00');
    expect(await setScope(request, 'insurance', [
      { id: 'a:7', title: 'ต่ออายุใน 7 วัน', url: 'insurance.html', due_at: due1 },
      { id: 'a:0', title: 'ครบกำหนดวันนี้', url: 'insurance.html', due_at: due2 },
    ])).toMatchObject({ total: 2, changed: 2, removed: 0 });
    await setScope(request, 'tax', [{ id: '2569:30', title: 'ภาษี', url: 'tax.html', due_at: T('2027-03-09T08:00:00+07:00') }]);
    expect(await setScope(request, 'insurance', [
      { id: 'a:7', title: 'ต่ออายุใน 7 วัน', url: 'insurance.html', due_at: due1 },
      { id: 'a:0', title: 'ครบกำหนดวันนี้', url: 'insurance.html', due_at: due2 },
    ])).toMatchObject({ changed: 0, removed: 0 });

    const sub = await newSubscriber('dev1');
    await apiSubscribe(request, sub);
    expect(await (await request.get(SRV + '/__tick?now=' + due1)).json()).toMatchObject({ due: 1, sent: 1 });
    const sentAt = (await dump(request)).reminders.find((r) => r.id === 'insurance:a:7').sent_at;
    expect(sentAt).toBe(due1);
    // ลงทะเบียนชุดเดิมซ้ำ (เครื่องอื่นเปิดหน้า) → sent_at ยังอยู่ ไม่ส่งซ้ำ
    await setScope(request, 'insurance', [
      { id: 'a:7', title: 'ต่ออายุใน 7 วัน (แก้ชื่อ)', url: 'insurance.html', due_at: due1 },
      { id: 'a:0', title: 'ครบกำหนดวันนี้', url: 'insurance.html', due_at: due2 },
    ]);
    expect((await dump(request)).reminders.find((r) => r.id === 'insurance:a:7').sent_at).toBe(due1);
    expect(await (await request.get(SRV + '/__tick?now=' + (due1 + 60000))).json()).toMatchObject({ due: 0 });
    // เลื่อนวัน (ต่ออายุแล้ว ปีหน้า) → sent_at ล้าง ส่งใหม่ตอนถึงวัน · ลบ a:0 ออกจากชุด → แถวหาย
    const next = T('2027-10-08T08:00:00+07:00');
    expect(await setScope(request, 'insurance', [{ id: 'a:7', title: 'ต่ออายุใน 7 วัน', url: 'insurance.html', due_at: next }])).toMatchObject({ changed: 1, removed: 1 });
    const d = await dump(request);
    expect(d.reminders.map((r) => r.id)).toEqual(['tax:2569:30', 'insurance:a:7']); // เรียงตาม due_at
    expect(d.reminders[1].sent_at).toBeNull();
    // GET รายการ (ตั้งแต่วันนี้เวลาไทย)
    const list = await (await request.get(SRV + '/api/push/reminders')).json();
    expect(list.items.map((r) => r.id)).toEqual(['tax:2569:30', 'insurance:a:7']);
  });

  test('scheduler tick: เลือกตามเวลาไทย · ถอดรหัสได้ทุกเครื่อง · 410 ลบเครื่องนั้น · repeat เลื่อนรอบ · เลยมานานไม่ส่งย้อน', async ({ request }) => {
    const a = await newSubscriber('phone'), b = await newSubscriber('laptop');
    await apiSubscribe(request, a); await apiSubscribe(request, b);
    const due = T('2026-10-03T08:00:00+07:00'); // = 01:00 UTC
    await setScope(request, 'insurance', [{ id: 'p1:0', title: 'ครบกำหนดต่ออายุประกันวันนี้', body: 'สุขภาพ · AIA', url: 'insurance.html', due_at: due }]);
    await setScope(request, 'car', [
      { id: 'tax', title: 'ภาษีรถ', url: 'index.html', due_at: T('2026-10-01T08:00:00+07:00'), repeat: 'monthly' },
      { id: 'old', title: 'เก่า', url: 'index.html', due_at: T('2026-09-20T08:00:00+07:00') },
    ]);

    // 00:45 UTC = 07:45 ไทย ยังไม่ถึง 08:00 → ส่งเฉพาะ repeat ที่ค้างมา (≤ 2 วัน) และปิด "เก่า" แบบไม่ส่ง
    let out = await (await request.get(SRV + '/__tick?now=' + T('2026-10-03T00:45:00Z'))).json();
    expect(out).toMatchObject({ due: 1, stale: 1, subs: 2, sent: 2 });
    let log = await pushLog(request, true);
    expect(log.map((l) => l.id).sort()).toEqual(['laptop', 'phone']);
    expect((await decrypt(a, log.find((l) => l.id === 'phone').body)).title).toBe('ภาษีรถ');
    let d = await dump(request);
    expect(d.reminders.find((r) => r.id === 'car:tax')).toMatchObject({ due_at: T('2026-11-01T08:00:00+07:00'), sent_at: null }); // รอบหน้า
    expect(d.reminders.find((r) => r.id === 'car:old').sent_at).toBe(T('2026-10-03T00:45:00Z'));

    // laptop ยกเลิกไปแล้ว (บริการ push ตอบ 410) → ลบออกจาก push_subs
    await request.get(SRV + '/__pushsink?status=410&id=laptop');
    out = await (await request.get(SRV + '/__tick?now=' + T('2026-10-03T01:00:00Z'))).json();
    expect(out).toMatchObject({ due: 1, sent: 1 });
    log = await pushLog(request, true);
    const msg = await decrypt(a, log.find((l) => l.id === 'phone').body);
    expect(msg).toEqual({ title: 'ครบกำหนดต่ออายุประกันวันนี้', body: 'สุขภาพ · AIA', url: 'insurance.html', tag: 'insurance:p1:0' });
    d = await dump(request);
    expect(d.subs.map((s) => s.endpoint)).toEqual([a.endpoint]);
    expect(d.reminders.find((r) => r.id === 'insurance:p1:0').sent_at).toBe(T('2026-10-03T01:00:00Z'));
    // tick ถัดไปไม่ส่งซ้ำ
    expect(await (await request.get(SRV + '/__tick?now=' + T('2026-10-03T01:15:00Z'))).json()).toMatchObject({ due: 0, sent: 0 });

    // บริการ push ล่มชั่วคราว (500) → ไม่ตั้ง sent_at ลองใหม่รอบหน้า, fail_count เพิ่ม
    await setScope(request, 'tax', [{ id: 'x', title: 'ภาษี', url: 'tax.html', due_at: T('2026-10-03T02:00:00Z') }]);
    await request.get(SRV + '/__pushsink?status=500&id=phone');
    expect(await (await request.get(SRV + '/__tick?now=' + T('2026-10-03T02:00:00Z'))).json()).toMatchObject({ due: 1, sent: 0 });
    d = await dump(request);
    expect(d.reminders.find((r) => r.id === 'tax:x').sent_at).toBeNull();
    expect(d.subs[0].fail_count).toBe(1);
    await request.get(SRV + '/__pushsink?status=201&id=phone');
    expect(await (await request.get(SRV + '/__tick?now=' + T('2026-10-03T02:15:00Z'))).json()).toMatchObject({ due: 1, sent: 1 });
    expect((await dump(request)).subs[0].fail_count).toBe(0);
  });

  test('scheduler daily 07:00 ไทย: สรุปงาน PM ของวันนี้ 1 ข้อความ · ไม่ส่งซ้ำ · ล้างแถวเก่า · สำรอง D1 → R2 (gzip) เก็บ 30 วัน', async ({ request }) => {
    const R = await lib('reminders.js');
    const sub = await newSubscriber('phone');
    await apiSubscribe(request, sub);
    await setScope(request, 'maintenance', [
      { id: '2026-09-20', title: 'งานบำรุงรักษา', body: 'ถึงกำหนด 1', url: 'maintenance.html#tab=calendar', due_at: R.ictAt('2026-09-20', 7), kind: 'digest' },
      { id: '2026-10-03', title: 'งานบำรุงรักษา', body: 'เลยกำหนด 1 · ถึงกำหนด 2', url: 'maintenance.html#tab=calendar', due_at: R.ictAt('2026-10-03', 7), kind: 'digest' },
      { id: '2026-10-04', title: 'งานบำรุงรักษา', body: 'ถึงกำหนด 4', url: 'maintenance.html#tab=calendar', due_at: R.ictAt('2026-10-04', 7), kind: 'digest' },
    ]);
    const daily = T('2026-10-03T00:00:00Z'); // cron 0 0 * * * = 07:00 ไทย
    const out = await (await request.get(SRV + '/__daily?now=' + daily)).json();
    expect(out).toMatchObject({ date: '2026-10-03', digest: 1, sent: 1, cleaned: 1 });
    const log = await pushLog(request, true);
    expect(log).toHaveLength(1);
    expect(await decrypt(sub, log[0].body)).toEqual({ title: 'สรุปประจำวัน', body: 'งานบำรุงรักษา: เลยกำหนด 1 · ถึงกำหนด 2', url: 'maintenance.html#tab=calendar', tag: 'daily-2026-10-03' });
    const d = await dump(request);
    expect(d.reminders.map((r) => r.id)).toEqual(['maintenance:2026-10-03', 'maintenance:2026-10-04']); // 20 ก.ย. เก่าเกิน 7 วัน ลบแล้ว
    // cron ซ้ำในวันเดียวกัน → ไม่ส่งสรุปซ้ำ
    expect(await (await request.get(SRV + '/__daily?now=' + (daily + 60000))).json()).toMatchObject({ digest: 0, sent: 0 });

    // สำรอง: backups/d1/2026-10-03.json.gz มีตาราง reminders/push_subs ครบ
    expect(out.backup.key).toBe('backups/d1/2026-10-03.json.gz');
    const keys = await (await request.get(SRV + '/__files')).json();
    expect(keys).toContain('backups/d1/2026-10-03.json.gz');
    const S = await lib('scheduler.js');
    const store = new Map();
    const FILES = { async put(k, v) { store.set(k, Buffer.from(v)); }, async delete(k) { store.delete(k); }, async list({ prefix }) { return { objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; } };
    const DB = { prepare: (sql) => ({ bind: () => ({ all: async () => ({ results: /FROM reminders/.test(sql) ? [{ id: 'r1' }] : [] }) }) }) };
    store.set('backups/d1/2026-09-01.json.gz', Buffer.alloc(1)); // เก่ากว่า 30 วัน
    store.set('backups/d1/2026-09-10.json.gz', Buffer.alloc(1));
    const b = await S.backupD1({ DB, FILES }, daily);
    expect(b.pruned).toBe(1);
    expect([...store.keys()].sort()).toEqual(['backups/d1/2026-09-10.json.gz', 'backups/d1/2026-10-03.json.gz']);
    const json = JSON.parse(zlib.gunzipSync(store.get('backups/d1/2026-10-03.json.gz')).toString());
    expect(json).toMatchObject({ v: 1, at: daily, tables: { reminders: [{ id: 'r1' }], docs: [] } });
    expect(Object.keys(json.tables)).toEqual(S.BACKUP_TABLES);
  });
});

/* ══════════ D. หน้าเว็บ: สมัคร/ยกเลิก (notifications.html) + ลงทะเบียนจากหน้าประกัน/ภาษี/บำรุงรักษา ══════════ */
// PushManager จริงของ Chromium ต้องคุยกับ FCM (ไม่มีในเทสต์) — แทนที่ด้วยตัวหลอกที่คืน subscription ชี้ไป /__pushsink พร้อมคีย์จริงจากฝั่งเทสต์
function fakePushManager(sub) {
  const KEY = '__fakeSub';
  const make = (j) => j && {
    endpoint: j.endpoint,
    options: { applicationServerKey: new Uint8Array(j.ask).buffer },
    toJSON: () => ({ endpoint: j.endpoint, expirationTime: null, keys: j.keys }),
    unsubscribe: async () => { localStorage.removeItem(KEY); return true; },
  };
  PushManager.prototype.getSubscription = async function () { return make(JSON.parse(localStorage.getItem(KEY) || 'null')); };
  PushManager.prototype.subscribe = async function (opts) {
    const j = { endpoint: sub.endpoint, keys: sub.keys, ask: Array.from(new Uint8Array(opts.applicationServerKey)), userVisibleOnly: opts.userVisibleOnly };
    localStorage.setItem(KEY, JSON.stringify(j));
    return make(j);
  };
}

test.describe('หน้าเว็บ', () => {
  test.use({ serviceWorkers: 'allow', baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  async function open(page, context, url, { sub, push = true, standaloneIOS } = {}) {
    const errors = await prepare(page);
    await context.grantPermissions(['notifications'], { origin: SRV });
    await page.addInitScript(({ push, standaloneIOS }) => {
      if (push) window.TANOT_PUSH = { enabled: true };
      if (standaloneIOS) Object.defineProperty(navigator, 'standalone', { get: () => true });
    }, { push, standaloneIOS });
    if (sub) await page.addInitScript(fakePushManager, { endpoint: sub.endpoint, keys: sub.keys });
    await page.goto(url);
    await page.waitForSelector('nav.ome-nav');
    return errors;
  }

  test('notifications.html: เปิด → ส่งทดสอบ (ถอดรหัสได้) → ปิด · ใช้คีย์ VAPID จากเซิร์ฟเวอร์ · ไม่มี console error', async ({ page, context, request }) => {
    const sub = await newSubscriber('browser');
    const errors = await open(page, context, '/notifications.html', { sub });
    await expect(page.locator('#ntOn')).toBeVisible();
    await expect(page.locator('#ntState')).toHaveText('ปิด');
    await page.click('#ntOn');
    await expect(page.locator('#ntState')).toHaveText('เปิดอยู่');
    await expect(page.locator('#ntOn')).toBeHidden();
    await expect(page.locator('#ntMsg')).toHaveText('เปิดการแจ้งเตือนแล้ว');
    const d = await dump(request);
    expect(d.subs).toHaveLength(1);
    expect(d.subs[0]).toMatchObject({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
    expect(d.subs[0].device).toMatch(/Chrome/);
    // applicationServerKey ที่ส่งให้ PushManager = public key ของเซิร์ฟเวอร์
    const cfg = await (await request.get(SRV + '/api/push/config')).json();
    const fake = await page.evaluate(() => JSON.parse(localStorage.getItem('__fakeSub')));
    expect(b64u(Uint8Array.from(fake.ask))).toBe(cfg.publicKey);
    expect(fake.userVisibleOnly).toBe(true);

    await page.click('#ntTest');
    await expect(page.locator('#ntMsg')).toHaveText('ส่งแล้ว');
    const log = await pushLog(request, true);
    expect(await decrypt(sub, log[0].body)).toMatchObject({ title: 'Tanot', url: 'notifications.html' });
    await expect(page.locator('#ntLast')).not.toHaveText('—');

    await page.click('#ntOff');
    await expect(page.locator('#ntState')).toHaveText('ปิด');
    await expect(page.locator('#ntOn')).toBeVisible();
    expect((await dump(request)).subs).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('__fakeSub'))).toBeNull();
    expect(errors).toEqual([]);
  });

  test('iPhone ใน Safari (ไม่ได้ติดตั้งลงหน้าจอโฮม) ซ่อนปุ่มสมัคร · เปิดจากแอปบนหน้าจอโฮมแล้วปุ่มกลับมา · ไม่มีคีย์ VAPID ซ่อนปุ่ม', async ({ browser, request }) => {
    const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    for (const standaloneIOS of [false, true]) {
      const ctx = await browser.newContext({ userAgent: UA, baseURL: SRV, serviceWorkers: 'allow', viewport: { width: 390, height: 800 } });
      const page = await ctx.newPage();
      await open(page, ctx, '/notifications.html', { standaloneIOS, sub: await newSubscriber('ios') });
      if (!standaloneIOS) {
        await expect(page.locator('#ntMsg')).toHaveText('บน iPhone/iPad ต้องเปิดจากแอปที่เพิ่มลงหน้าจอโฮม');
        await expect(page.locator('#ntState')).toHaveText('ไม่พร้อม');
        await expect(page.locator('#ntOn')).toBeHidden();
        expect(await page.evaluate(() => TanotPush.support())).toBe('ios-install');
      } else {
        await expect(page.locator('#ntOn')).toBeVisible();
        expect(await page.evaluate(() => TanotPush.support())).toBe('ok');
      }
      await ctx.close();
    }
    await request.get(SRV + '/__vapid?off=1');
    const ctx = await browser.newContext({ baseURL: SRV, serviceWorkers: 'allow' });
    const page = await ctx.newPage();
    await open(page, ctx, '/notifications.html', { sub: await newSubscriber('nokey') });
    await expect(page.locator('#ntMsg')).toHaveText('ยังไม่ได้ตั้งคีย์ VAPID');
    await expect(page.locator('#ntOn')).toBeHidden();
    await ctx.close();
  });

  test('นอก pages.dev (ไม่มี /api) ไม่เรียก /api/push และไม่ลงทะเบียน', async ({ page, context }) => {
    const calls = [];
    page.on('request', (r) => { if (r.url().includes('/api/push/')) calls.push(r.url()); });
    const errors = await open(page, context, '/notifications.html', { push: false });
    await expect(page.locator('#ntMsg')).toHaveText('ใช้ได้บน my-web-app-5w2.pages.dev');
    await expect(page.locator('#ntOn')).toBeHidden();
    expect(await page.evaluate(() => TanotPush.setReminders('tax', [{ id: 'x', title: 'x', due_at: 1 }]))).toEqual({ skipped: 'domain' });
    expect(calls).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('หน้าประกันลงทะเบียนวันต่ออายุ → แก้วันต่ออายุ/ลบกรมธรรม์แล้วชุดใน D1 ตามทัน', async ({ page, context, request }) => {
    await page.clock.setFixedTime(NOW);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('tanot:insurance:policies', JSON.stringify([
        { id: 'p1', type: 'health', name: 'สุขภาพ', insurer: 'AIA', premium: 12000, freq: 'year', renewDate: '2026-10-15' },
        { id: 'p2', type: 'car', insurer: 'วิริยะ', premium: 18000, freq: 'year', renewDate: '2026-12-01' },
      ]));
    });
    const errors = await open(page, context, '/insurance.html');
    const ids = async () => (await dump(request)).reminders.map((r) => r.id);
    await expect.poll(ids).toEqual(['insurance:p1:2026-10-15:7', 'insurance:p1:2026-10-15:0', 'insurance:p2:2026-12-01:30', 'insurance:p2:2026-12-01:7', 'insurance:p2:2026-12-01:0']);
    const r0 = (await dump(request)).reminders[0];
    expect(r0).toMatchObject({ source: 'insurance', kind: 'push', url: 'insurance.html', title: 'ต่ออายุประกันใน 7 วัน', due_at: T('2026-10-08T08:00:00+07:00') });

    // ลบ p2 + เลื่อนวันต่ออายุ p1 (เหมือนกด "จ่ายแล้ว" → ปีหน้า) แล้วเปิดหน้าใหม่
    await page.evaluate(() => localStorage.setItem('tanot:insurance:policies', JSON.stringify([
      { id: 'p1', type: 'health', name: 'สุขภาพ', insurer: 'AIA', premium: 12000, freq: 'year', renewDate: '2027-10-15' },
    ])));
    await page.reload();
    await expect.poll(ids).toEqual(['insurance:p1:2027-10-15:30', 'insurance:p1:2027-10-15:7', 'insurance:p1:2027-10-15:0']);
    expect(errors).toEqual([]);
  });

  test('หน้าภาษีลงทะเบียนกำหนดยื่นจากไฟล์กฎ · เปิดซ้ำไม่ส่งซ้ำ (ชุดเดิม)', async ({ page, context, request }) => {
    await page.clock.setFixedTime(NOW);
    const posts = [];
    page.on('request', (r) => { if (r.url().endsWith('/api/push/reminders') && r.method() === 'POST') posts.push(r.postDataJSON()); });
    const errors = await open(page, context, '/tax.html');
    await expect.poll(async () => (await dump(request)).reminders.map((r) => r.id)).toEqual(['tax:2569:2027-04-08:30', 'tax:2569:2027-04-08:7', 'tax:2569:2027-04-08:1', 'tax:2569:2027-04-08:0']);
    expect((await dump(request)).reminders[3]).toMatchObject({ title: 'วันสุดท้ายยื่นภาษีเงินได้ปี 2569', url: 'tax.html', due_at: T('2027-04-08T08:00:00+07:00') });
    expect(posts).toHaveLength(1);
    expect(posts[0].scope).toBe('tax');
    await page.reload();
    await page.waitForTimeout(1500);
    expect(posts).toHaveLength(1); // hash เดิม + ยังไม่เกิน 6 ชม. = ไม่ยิงซ้ำ
    expect(errors).toEqual([]);
  });

  test('หน้าบำรุงรักษาลงทะเบียนสรุปรายวัน (1 แถวต่อวัน) · บันทึกใบตรวจแล้วตัวเลขลด', async ({ page, context, request }) => {
    await page.clock.setFixedTime(new Date('2026-10-30T10:00:00+07:00'));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const mk = (id, ph) => ({ id, code: 'ESC-0' + id, name: 'บันไดเลื่อน', type: 'ESC', system: 'E&M', site: 's1', phase: { M3: ph }, status: 'active', updatedAt: 1 });
      localStorage.setItem('tanot:mnt:sites', JSON.stringify([{ id: 's1', name: 'RN05', abbr: 'RN05', updatedAt: 1 }]));
      localStorage.setItem('tanot:mnt:assets', JSON.stringify([mk('1', 2), mk('2', 1), mk('3', 2), mk('4', 1), mk('5', 2)]));
      localStorage.setItem('tanot:mnt:plans', JSON.stringify([{ id: 'ESC|M3', type: 'ESC', typeName: 'บันไดเลื่อน', freq: 'M3', hours: 2, shift: '', edited: false, items: [{ id: 'i1', text: 'ตรวจ', kind: 'check' }], updatedAt: 1 }]));
      localStorage.setItem('tanot:mnt:settings', JSON.stringify({ v: 1, startMonth: '2026-10', project: '', line: '', inspector: '', labelSize: '3x8' }));
    });
    const errors = await open(page, context, '/maintenance.html');
    const rows = async () => (await dump(request)).reminders.filter((r) => r.source === 'maintenance');
    await expect.poll(async () => (await rows()).length).toBe(14);
    let r = await rows();
    expect(r.every((x) => x.kind === 'digest' && x.url === 'maintenance.html#tab=calendar' && x.title === 'งานบำรุงรักษา')).toBe(true);
    expect(r.slice(0, 3).map((x) => [x.id, x.body, x.due_at])).toEqual([
      ['maintenance:2026-10-30', 'ถึงกำหนด 2', T('2026-10-30T07:00:00+07:00')],
      ['maintenance:2026-10-31', 'ถึงกำหนด 2', T('2026-10-31T07:00:00+07:00')],
      ['maintenance:2026-11-01', 'เลยกำหนด 2 · ถึงกำหนด 3', T('2026-11-01T07:00:00+07:00')],
    ]);
    // บันทึกใบตรวจ ESC-02 รอบ ต.ค. ลง IndexedDB ของหน้า แล้ววาดหน้าใหม่ → ชุดใหม่ขึ้น D1
    await page.evaluate(async () => {
      const m = window.__mnt, dev = m.deviceId();
      await m.idbPut('tanot-mnt-2026', 'insp', { id: 's1|M3|2026-10|' + dev, site: 's1', freq: 'M3', period: '2026-10', dev, by: '', rows: { 2: { at: Date.now(), res: { i1: 'pass' } } }, updatedAt: Date.now() });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await expect.poll(async () => (await rows()).slice(0, 3).map((x) => x.body)).toEqual(['ถึงกำหนด 1', 'ถึงกำหนด 1', 'เลยกำหนด 1 · ถึงกำหนด 3']);
    expect(errors).toEqual([]);
  });
});

/* ══════════ E. sw.js: รับ push → แสดงการแจ้งเตือน → กดแล้วเปิดหน้าถูก ══════════ */
function loadSw(scope, clientsList) {
  const listeners = {}, shown = [], opened = [], focused = [], navigated = [];
  const self = {
    addEventListener: (t, f) => { listeners[t] = f; },
    registration: { scope, showNotification: async (title, opts) => { shown.push({ title, opts }); } },
    clients: {
      matchAll: async () => clientsList,
      openWindow: async (u) => { opened.push(u); return { url: u }; },
      claim: async () => {},
    },
    skipWaiting: async () => {},
  };
  for (const c of clientsList) {
    c.focus = async () => { focused.push(c.url); return c; };
    c.navigate = async (u) => { navigated.push(u); c.url = u; return c; };
  }
  const ctx = vm.createContext({ self, location: new URL(scope + 'sw.js'), URL, Promise, console, caches: {}, fetch: async () => { throw new Error('offline'); } });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), ctx);
  async function fire(type, ev) {
    const waits = [];
    ev.waitUntil = (p) => waits.push(p);
    listeners[type](ev);
    await Promise.all(waits);
  }
  return { fire, shown, opened, focused, navigated };
}
const pushEvent = (obj) => ({ data: { json: () => obj, text: () => JSON.stringify(obj) } });
const clickEvent = (data) => ({ notification: { data, close() {} } });

test.describe('sw.js (push / notificationclick)', () => {
  const SCOPE = 'https://my-web-app-5w2.pages.dev/';

  test('push → showNotification ด้วย title/body/tag + URL เต็มใน data · URL นอกเว็บถูกแทนด้วยหน้าแรก', async () => {
    const sw = loadSw(SCOPE, []);
    await sw.fire('push', pushEvent({ title: 'ต่ออายุประกันใน 7 วัน', body: 'สุขภาพ · AIA', url: 'insurance.html', tag: 'insurance:p1:7' }));
    expect(sw.shown).toHaveLength(1);
    expect(sw.shown[0].title).toBe('ต่ออายุประกันใน 7 วัน');
    expect(sw.shown[0].opts).toMatchObject({ body: 'สุขภาพ · AIA', tag: 'insurance:p1:7', renotify: true, data: { url: SCOPE + 'insurance.html' }, icon: SCOPE + 'icon-192.png' });
    await sw.fire('push', pushEvent({ title: 'x', url: 'https://evil.example/' }));
    expect(sw.shown[1].opts.data.url).toBe(SCOPE + 'index.html');
    await sw.fire('push', pushEvent({ title: 'x', url: '//evil.example/a.html' }));
    expect(sw.shown[2].opts.data.url).toBe(SCOPE + 'index.html');
    await sw.fire('push', { data: { json: () => { throw new Error('not json'); }, text: () => 'ข้อความล้วน' } });
    expect(sw.shown[3]).toMatchObject({ title: 'Tanot', opts: { body: 'ข้อความล้วน' } });
  });

  test('กดการแจ้งเตือน: ไม่มีหน้าเปิดอยู่ → openWindow · หน้าเดียวกันเปิดอยู่ (URL ไม่มี .html) → navigate + focus · หน้าอื่นเปิดอยู่ → เปิดหน้าต่างใหม่', async () => {
    let sw = loadSw(SCOPE, []);
    await sw.fire('notificationclick', clickEvent({ url: SCOPE + 'maintenance.html#tab=calendar' }));
    expect(sw.opened).toEqual([SCOPE + 'maintenance.html#tab=calendar']);

    sw = loadSw(SCOPE, [{ url: SCOPE + 'index' }, { url: SCOPE + 'maintenance' }]);
    await sw.fire('notificationclick', clickEvent({ url: SCOPE + 'maintenance.html#tab=calendar' }));
    expect(sw.opened).toEqual([]);
    expect(sw.navigated).toEqual([SCOPE + 'maintenance.html#tab=calendar']);
    expect(sw.focused).toEqual([SCOPE + 'maintenance.html#tab=calendar']);

    sw = loadSw(SCOPE, [{ url: SCOPE + 'insurance.html' }]);
    await sw.fire('notificationclick', clickEvent({ url: SCOPE + 'insurance.html' }));
    expect(sw.navigated).toEqual([]); // URL ตรงอยู่แล้ว แค่โฟกัส
    expect(sw.focused).toEqual([SCOPE + 'insurance.html']);

    sw = loadSw(SCOPE, [{ url: SCOPE + 'index.html' }]);
    await sw.fire('notificationclick', clickEvent({ url: 'https://evil.example/' }));
    expect(sw.opened).toEqual([]);
    expect(sw.focused).toEqual([SCOPE + 'index.html']); // URL นอกเว็บ → หน้าแรกที่เปิดอยู่
  });

  test('Chromium จริง: push ที่ส่งเข้า service worker แสดงการแจ้งเตือนพร้อม URL ของหน้า', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: SRV, serviceWorkers: 'allow' });
    await ctx.grantPermissions(['notifications'], { origin: SRV });
    const page = await ctx.newPage();
    await prepare(page);
    await page.goto('/notifications.html');
    await page.evaluate(() => navigator.serviceWorker.ready);
    const cdp = await ctx.newCDPSession(page);
    const regs = [];
    cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => regs.push(...e.registrations));
    await cdp.send('ServiceWorker.enable');
    await expect.poll(() => regs.filter((r) => !r.isDeleted).length).toBeGreaterThan(0);
    const reg = regs.find((r) => !r.isDeleted);
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin: SRV, registrationId: reg.registrationId,
      data: JSON.stringify({ title: 'สรุปประจำวัน', body: 'งานบำรุงรักษา: ถึงกำหนด 2', url: 'maintenance.html#tab=calendar', tag: 'daily-2026-10-03' }),
    });
    await expect.poll(() => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).length)).toBe(1);
    const n = await page.evaluate(async () => {
      const [x] = await (await navigator.serviceWorker.ready).getNotifications();
      return { title: x.title, body: x.body, tag: x.tag, data: x.data };
    });
    expect(n).toEqual({ title: 'สรุปประจำวัน', body: 'งานบำรุงรักษา: ถึงกำหนด 2', tag: 'daily-2026-10-03', data: { url: SRV + '/maintenance.html#tab=calendar' } });
    await ctx.close();
  });
});
