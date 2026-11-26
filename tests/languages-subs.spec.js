// @ts-check
// หน้า languages โหมด "ซับไตเติล" (ROADMAP แถว 25 / L4): known-answer ของ LangCalc.subs + หน้าจริงกับ WAV/ซับที่สร้างในเทสต์
// ไฟล์ของผู้ใช้อยู่ในเครื่องเท่านั้น — เทสต์ตรวจว่าไม่มีคำขอ /api อื่นนอกจาก /api/asr ของคลิปพูดตาม
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');
const S = require('../lang-calc.js').subs;

// ───────────────────────── ตรรกะล้วน ─────────────────────────
test.describe('LangCalc.subs.parseSubs', () => {
  test('SRT พื้นฐาน: เลขลำดับ + เวลา hh:mm:ss,mmm + หลายบรรทัดรวมเป็นประโยคเดียว', () => {
    const srt = '1\n00:00:01,000 --> 00:00:03,500\nHello there.\nHow are you?\n\n2\n00:01:02,250 --> 00:01:04,000\nFine, thanks.\n';
    expect(S.parseSubs(srt)).toEqual([
      { start: 1, end: 3.5, text: 'Hello there. How are you?' },
      { start: 62.25, end: 64, text: 'Fine, thanks.' },
    ]);
  });

  test('BOM + CRLF + CR เดี่ยว ได้ผลเดียวกับ LF', () => {
    const lf = '1\n00:00:01,000 --> 00:00:02,000\nA\n\n2\n00:00:03,000 --> 00:00:04,000\nB\n';
    const want = S.parseSubs(lf);
    expect(want.length).toBe(2);
    expect(S.parseSubs('﻿' + lf.replace(/\n/g, '\r\n'))).toEqual(want);
    expect(S.parseSubs(lf.replace(/\n/g, '\r'))).toEqual(want);
  });

  test('WebVTT: หัวไฟล์/NOTE/STYLE/id ของ cue/เวลา mm:ss.mmm/cue settings', () => {
    const vtt = 'WEBVTT - ตัวอย่าง\n\nNOTE นี่คือหมายเหตุ\nบรรทัดสอง\n\nSTYLE\n::cue { color: red }\n\nintro\n00:01.000 --> 00:02.500 align:start position:10%\nFirst cue\n\n01:00:00.000 --> 01:00:01.000\nHour cue\n';
    expect(S.parseSubs(vtt)).toEqual([
      { start: 1, end: 2.5, text: 'First cue' },
      { start: 3600, end: 3601, text: 'Hour cue' },
    ]);
  });

  test('ตัดแท็ก <i> <b> <c.x> <v> <00:00:01.000> และ {\\an8} + แปลง entity', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,000\n{\\an8}<i>Hello</i> <font color="#fff">W&amp;rld</font>\n\n2\n00:00:03,000 --> 00:00:04,000\n<v Bob>Hi <00:00:03.500><c.yellow>there</c> &lt;b&gt; &nbsp;x\n';
    expect(S.parseSubs(srt)).toEqual([
      { start: 1, end: 2, text: 'Hello W&rld' },
      { start: 3, end: 4, text: 'Hi there <b> x' },
    ]);
  });

  test('จุดทศนิยม/จุลภาคแบบสั้น ("1,5" = 500 ms) และไม่มีมิลลิวินาที', () => {
    const srt = '1\n00:00:01,5 --> 00:00:02\nA\n\n2\n00:00:03.25 --> 00:00:04.007\nB\n';
    expect(S.parseSubs(srt)).toEqual([
      { start: 1.5, end: 2, text: 'A' },
      { start: 3.25, end: 4.007, text: 'B' },
    ]);
  });

  test('เวลาเพี้ยน: end ≤ start, นาที/วินาที ≥ 60, ไม่ใช่เวลา — ข้าม cue นั้นแต่ cue อื่นยังอยู่', () => {
    const srt = [
      '1\n00:00:05,000 --> 00:00:04,000\nend ก่อน start',
      '2\n00:00:05,000 --> 00:00:05,000\nสั้นเป็นศูนย์',
      '3\n00:61:00,000 --> 00:62:00,000\nนาทีเกิน',
      '4\n00:00:xx,000 --> 00:00:09,000\nไม่ใช่เวลา',
      '5\n00:00:10,000 --> 00:00:12,000\nอันนี้ใช้ได้',
    ].join('\n\n');
    expect(S.parseSubs(srt)).toEqual([{ start: 10, end: 12, text: 'อันนี้ใช้ได้' }]);
  });

  test('cue ว่าง (ไม่มีข้อความ/มีแต่แท็ก) ถูกข้าม · เรียงตามเวลาเริ่ม', () => {
    const srt = '2\n00:00:10,000 --> 00:00:11,000\nlater\n\n1\n00:00:01,000 --> 00:00:02,000\n<i></i>\n\n3\n00:00:03,000 --> 00:00:04,000\nearly\n';
    expect(S.parseSubs(srt).map((c) => c.text)).toEqual(['early', 'later']);
  });

  test('SRT ที่ลืมบรรทัดว่างคั่น: เลขลำดับของ cue ถัดไปไม่ถูกนับเป็นข้อความ', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,000\nA\n2\n00:00:03,000 --> 00:00:04,000\nB\n';
    expect(S.parseSubs(srt)).toEqual([
      { start: 1, end: 2, text: 'A' },
      { start: 3, end: 4, text: 'B' },
    ]);
  });

  test('ญี่ปุ่น/จีนต่อบรรทัดโดยไม่ใส่ช่องว่าง · ไทย/อังกฤษใส่ช่องว่าง', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,000\nこんにちは、\n元気ですか\n\n2\n00:00:03,000 --> 00:00:04,000\nสวัสดีครับ\nวันนี้เป็นอย่างไร\n';
    const c = S.parseSubs(srt);
    expect(c[0].text).toBe('こんにちは、元気ですか');
    expect(c[1].text).toBe('สวัสดีครับ วันนี้เป็นอย่างไร');
  });

  test('ข้อความที่ไม่ใช่ซับ/ค่าว่าง = []', () => {
    expect(S.parseSubs('')).toEqual([]);
    expect(S.parseSubs(null)).toEqual([]);
    expect(S.parseSubs('แค่ข้อความธรรมดา\nไม่มีเวลา')).toEqual([]);
  });
});

test.describe('LangCalc.subs.pairSubs', () => {
  const a = [
    { start: 1, end: 3, text: 'Hello' },
    { start: 4, end: 6, text: 'How are you' },
    { start: 7, end: 9, text: 'Fine' },
  ];

  test('จับคู่ตามเวลาซ้อนทับมากสุด', () => {
    const b = [
      { start: 1.2, end: 2.8, text: 'สวัสดี' },
      { start: 4.1, end: 5.9, text: 'สบายดีไหม' },
      { start: 7.2, end: 9.1, text: 'สบายดี' },
    ];
    expect(S.pairSubs(a, b).map((c) => c.thai)).toEqual(['สวัสดี', 'สบายดีไหม', 'สบายดี']);
  });

  test('ซับไทยหนึ่งอันคร่อมสองประโยค → ไปอยู่ประโยคที่ซ้อนทับมากกว่า · สองอันในประโยคเดียว = ต่อกัน', () => {
    const b = [
      { start: 2.5, end: 4.5, text: 'ยาวคร่อม' },       // ซ้อน a0 0.5 วิ, a1 0.5 วิ → เสมอ → ตัวแรก
      { start: 4.6, end: 5.0, text: 'ก' },
      { start: 5.1, end: 5.9, text: 'ข' },
    ];
    const r = S.pairSubs(a, b);
    expect(r[0].thai).toBe('ยาวคร่อม');
    expect(r[1].thai).toBe('ก ข');
    expect(r[2].thai).toBe('');
  });

  test('ไม่ซ้อนกันเลยแต่ห่าง ≤ 1 วิ → จับกับ cue ที่ใกล้สุด · ไกลกว่านั้นทิ้ง', () => {
    const r = S.pairSubs(a, [{ start: 3.3, end: 3.6, text: 'ใกล้' }, { start: 20, end: 21, text: 'ไกล' }]);
    expect(r[0].thai).toBe('ใกล้');
    expect(r.map((c) => c.thai).join('')).toBe('ใกล้');
  });

  test('คืนฟิลด์เดิมของซับหลัก (start/end/text) ไม่แก้อาร์เรย์ต้นฉบับ · ไม่มีซับที่สอง = thai ว่าง', () => {
    const r = S.pairSubs(a, []);
    expect(r).toEqual(a.map((c) => Object.assign({}, c, { thai: '' })));
    expect(a[0].thai).toBeUndefined();
  });
});

test.describe('LangCalc.subs.similarity / band / cueAt / fmt', () => {
  test('similarity: เหมือนกัน = 1 แม้ต่างตัวพิมพ์/วรรคตอน/ช่องว่าง', () => {
    expect(S.similarity('Hello, World!', 'hello world')).toBe(1);
    expect(S.similarity('你好，世界。', '你好世界')).toBe(1);
  });

  test('similarity: known-answer ระยะ Levenshtein ระดับตัวอักษร', () => {
    expect(S.similarity('kitten', 'sitting')).toBeCloseTo(1 - 3 / 7, 10);
    expect(S.similarity('abcd', 'abxd')).toBeCloseTo(0.75, 10);
    expect(S.similarity('abc', 'xyz')).toBe(0);
  });

  test('similarity: ว่างฝั่งใดฝั่งหนึ่ง = 0 (ไม่ใช่ 1) · เทียบกับตัวเอง = 1', () => {
    expect(S.similarity('', 'abc')).toBe(0);
    expect(S.similarity('abc', '')).toBe(0);
    expect(S.similarity('', '')).toBe(0);
    expect(S.similarity('こんにちは', 'こんにちは')).toBe(1);
  });

  test('band: เกณฑ์เดียวกับ gradeAnswer ของหน้า (≥ .9 ถูก, ≥ .7 ใกล้เคียง)', () => {
    expect(S.band(1)).toBe('correct');
    expect(S.band(0.9)).toBe('correct');
    expect(S.band(0.89)).toBe('almost');
    expect(S.band(0.7)).toBe('almost');
    expect(S.band(0.69)).toBe('wrong');
    expect(S.band(0)).toBe('wrong');
  });

  test('cueAt: อยู่ในช่วง [start, end) · ช่องว่างระหว่าง cue = -1', () => {
    const c = [{ start: 1, end: 3 }, { start: 4, end: 6 }];
    expect(S.cueAt(c, 0.5)).toBe(-1);
    expect(S.cueAt(c, 1)).toBe(0);
    expect(S.cueAt(c, 2.99)).toBe(0);
    expect(S.cueAt(c, 3)).toBe(-1);
    expect(S.cueAt(c, 4.5)).toBe(1);
    expect(S.cueAt(c, 99)).toBe(-1);
  });

  test('fmt: m:ss และ h:mm:ss', () => {
    expect(S.fmt(0)).toBe('0:00');
    expect(S.fmt(65.9)).toBe('1:05');
    expect(S.fmt(3600)).toBe('1:00:00');
    expect(S.fmt(-3)).toBe('0:00');
  });

  test('segmentsToCues: ตัดข้อความ ทิ้งว่าง แก้ end ≤ start และไม่ให้ซ้อนกัน', () => {
    const r = S.segmentsToCues([
      { start: 0, end: 2.5, text: '  Hello  ' },
      { start: 2, end: 4, text: 'there' },     // ซ้อน → จบก่อน cue ถัดไปเริ่ม = ตัดอันก่อนที่ 2
      { start: 5, end: 5, text: 'zero' },      // end = start → ยืดให้ ≥ 0.5 วิ
      { start: 6, end: 7, text: '   ' },
    ]);
    expect(r).toEqual([
      { start: 0, end: 2, text: 'Hello' },
      { start: 2, end: 4, text: 'there' },
      { start: 5, end: 5.5, text: 'zero' },
    ]);
  });
});

// ───────────────────────── หน้าจริง (languages.html › ฟัง-พูด › ซับไตเติล) ─────────────────────────
// WAV จริงที่สร้างในเทสต์ (ไซน์ 440 Hz 12 วิ) + ซับ 3 ประโยค (1–3, 4–6, 7–9 วิ) · ไมค์/asr ปลอมผ่าน init script

function wavBuffer(seconds, rate = 16000) {
  const n = Math.round(seconds * rate), buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * 8000), 44 + i * 2);
  return buf;
}
const SRT_EN = '﻿1\r\n00:00:01,000 --> 00:00:03,000\r\n<i>Hello there.</i>\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\nHow are you today?\r\n\r\n3\r\n00:00:07,000 --> 00:00:09,000\r\nI am fine, thank you.\r\n';
const SRT_TH = '1\n00:00:01,100 --> 00:00:02,900\nสวัสดี\n\n2\n00:00:04,100 --> 00:00:05,900\nวันนี้เป็นอย่างไรบ้าง\n\n3\n00:00:07,100 --> 00:00:08,900\nสบายดี ขอบคุณ\n';

// ไมค์ + asr ในเครื่องปลอม: Worker ของ asr-worker.js ตอบ __asrText (อัดสั้น) หรือ chunks ตาม __asrChunks (ถอดทั้งไฟล์)
const FAKE_MEDIA = () => {
  window.__asrJobs = [];
  window.__asrText = 'Hello there';
  window.__asrChunks = [{ text: ' Local first', start: 0.5, end: 2.0 }, { text: ' Local second', start: 3.0, end: 5.0 }];
  const W = window.Worker;
  window.Worker = function (url, o) {
    if (!/asr-worker/.test(String(url))) return new W(url, o);
    const l = {};
    return {
      addEventListener(t, f) { (l[t] = l[t] || []).push(f); },
      removeEventListener(t, f) { l[t] = (l[t] || []).filter((x) => x !== f); },
      postMessage(m) {
        window.__asrJobs.push({ lang: m.lang, ts: !!m.timestamps, len: m.pcm.length });
        const send = (d) => (l.message || []).slice().forEach((f) => f({ data: d }));
        setTimeout(() => {
          send({ type: 'pipeline-ready', jobId: m.jobId, device: 'wasm' });
          send(m.timestamps
            ? { type: 'result', jobId: m.jobId, text: window.__asrChunks.map((c) => c.text).join(''), chunks: window.__asrChunks, device: 'wasm' }
            : { type: 'result', jobId: m.jobId, text: window.__asrText });
        }, 10);
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

async function openSubs(page, { lang = 'th', cloud = false } = {}) {
  const errors = await prepare(page);
  const api = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) api.push(u.pathname); });
  await page.addInitScript((l) => { try { localStorage.setItem('ome:lang', l); } catch (e) {} }, lang);
  await page.addInitScript(FAKE_MEDIA);
  if (cloud) await page.addInitScript(() => { window.TANOT_AI = { enabled: true }; });
  await page.goto('/languages.html');
  await page.click('[data-k="tab-listen"]');
  await page.click('[data-k="lsub-subs"]');
  return { errors, api };
}
const mediaFile = { name: 'clip.wav', mimeType: 'audio/wav', buffer: wavBuffer(12) };
async function loadAll(page, { thai = false } = {}) {
  await page.setInputFiles('[data-k="subs-media"]', mediaFile);
  await page.setInputFiles('[data-k="subs-file"]', { name: 'en.srt', mimeType: 'application/x-subrip', buffer: Buffer.from(SRT_EN, 'utf8') });
  await expect(page.locator('[data-k="subs-cue"]')).toHaveCount(3);
  if (thai) await page.setInputFiles('[data-k="subs-file-th"]', { name: 'th.srt', mimeType: 'application/x-subrip', buffer: Buffer.from(SRT_TH, 'utf8') });
}
const curIdx = (page) => page.evaluate(() => [...document.querySelectorAll('[data-k="subs-cue"]')].findIndex((b) => b.getAttribute('aria-current') === 'true'));
const elState = (page) => page.evaluate(() => { const e = document.querySelector('[data-k="subs-el"]'); return { t: e.currentTime, paused: e.paused, rate: e.playbackRate }; });

test.describe('หน้า: ซับไตเติล', () => {
  test('โหลดซับ SRT (BOM+CRLF+แท็ก) → 3 ประโยค · ไม่มีคำขอ /api · ไม่มี error', async ({ page }) => {
    const { errors, api } = await openSubs(page);
    await loadAll(page);
    await expect(page.locator('[data-k="subs-cue"]').first()).toContainText('Hello there.');
    await expect(page.locator('[data-k="subs-cue"]').first()).not.toContainText('<i>');
    expect(api).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('เล่นประโยคนี้: ไปที่เวลาเริ่มแล้วหยุดที่เวลาจบของประโยค', async ({ page }) => {
    await openSubs(page);
    await loadAll(page);
    await page.locator('[data-k="subs-cue"]').nth(1).click();
    await expect.poll(async () => (await elState(page)).t, { timeout: 3000 }).toBeGreaterThan(4.2);
    await expect.poll(async () => (await elState(page)).paused, { timeout: 6000 }).toBe(true);
    const s = await elState(page);
    expect(s.t).toBeGreaterThan(5.9);
    expect(s.t).toBeLessThan(6.4);
    expect(await curIdx(page)).toBe(1);
  });

  test('วนประโยค: เล่นซ้ำภายในช่วง 4–6 วิ ไม่หยุด ไม่หลุดช่วง', async ({ page }) => {
    await openSubs(page);
    await loadAll(page);
    await page.click('[data-k="subs-loop"]');
    await page.locator('[data-k="subs-cue"]').nth(1).click();
    const r = await page.evaluate(() => new Promise((resolve) => {
      const e = document.querySelector('[data-k="subs-el"]');
      let min = 99, max = 0, wraps = 0, paused = false, prev = e.currentTime;
      const iv = setInterval(() => {
        const t = e.currentTime;
        if (t < prev - 1) wraps++;
        prev = t; min = Math.min(min, t); max = Math.max(max, t); if (e.paused) paused = true;
      }, 40);
      setTimeout(() => { clearInterval(iv); resolve({ min, max, wraps, paused }); }, 4800);
    }));
    expect(r.paused).toBe(false);
    expect(r.wraps).toBeGreaterThanOrEqual(1);
    expect(r.min).toBeGreaterThan(3.9);
    expect(r.max).toBeLessThan(6.25);
  });

  test('ความเร็ว 0.75/1 + ซ่อน/แสดงซับ', async ({ page }) => {
    await openSubs(page);
    await loadAll(page);
    await page.click('[data-k="subs-rate-075"]');
    expect((await elState(page)).rate).toBe(0.75);
    await page.click('[data-k="subs-rate-1"]');
    expect((await elState(page)).rate).toBe(1);
    await page.click('[data-k="subs-hide"]');
    await expect(page.locator('[data-k="subs-cue"]').first()).not.toContainText('Hello');
    await page.click('[data-k="subs-hide"]');
    await expect(page.locator('[data-k="subs-cue"]').first()).toContainText('Hello');
  });

  test('คีย์ลัด → ← และ Space (ไม่เล่นเมื่อโฟกัสอยู่ในช่องกรอก)', async ({ page }) => {
    await openSubs(page);
    await loadAll(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => curIdx(page)).toBe(1);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => curIdx(page)).toBe(2);
    await page.keyboard.press('ArrowRight');
    expect(await curIdx(page)).toBe(2); // ไม่เลยประโยคสุดท้าย
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => curIdx(page)).toBe(1);
    await page.keyboard.press('Space');
    await expect.poll(async () => (await elState(page)).paused).toBe(true); // เล่นประโยค 1 (4–6 วิ) แล้ว Space อีกครั้ง = หยุด
  });

  test('ซับไทยจับคู่ตามเวลา แสดงใต้ประโยค + ซ่อนได้', async ({ page }) => {
    await openSubs(page);
    await loadAll(page, { thai: true });
    await expect(page.locator('[data-k="subs-cue"]').nth(1)).toContainText('วันนี้เป็นอย่างไรบ้าง');
    await page.click('[data-k="subs-hide-th"]');
    await expect(page.locator('[data-k="subs-cue"]').nth(1)).not.toContainText('วันนี้');
  });

  test('ไฟล์ซับเสีย/ไม่ใช่ซับ → ข้อความ ไม่ล้มทั้งหน้า', async ({ page }) => {
    const { errors } = await openSubs(page);
    await page.setInputFiles('[data-k="subs-file"]', { name: 'bad.srt', mimeType: 'text/plain', buffer: Buffer.from('ไม่ใช่ซับ\nแค่ข้อความ', 'utf8') });
    await expect(page.getByText('ไม่พบซับในไฟล์นี้')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('พูดตาม (ในเครื่อง): ถอดตรง = 100% + ผิดมาก = ต่ำ · ภาษาส่งให้ Worker เป็นชื่อเต็ม', async ({ page }) => {
    await openSubs(page);
    await loadAll(page);
    await page.locator('[data-k="subs-cue"]').first().click();
    await page.click('[data-k="subs-rec"]');
    await page.click('[data-k="subs-rec-stop"]');
    await expect(page.locator('[data-k="subs-score"]')).toContainText('100%');
    expect((await page.evaluate(() => window.__asrJobs))[0].ts).toBe(false);
    await page.evaluate(() => { window.__asrText = 'completely different words'; });
    await page.click('[data-k="subs-rec"]');
    await page.click('[data-k="subs-rec-stop"]');
    await expect(page.locator('[data-k="subs-result"]')).toContainText('completely different words');
    const pct = Number((await page.locator('[data-k="subs-score"]').innerText()).match(/(\d+)%/)[1]);
    expect(pct).toBeLessThan(50);
    expect(await page.evaluate(() => window.__asrJobs.length)).toBe(2);
  });

  test('พูดตาม (คลาวด์): ส่ง /api/asr พร้อมรหัสภาษา แล้วให้คะแนนจากข้อความที่ได้', async ({ page }) => {
    const { api } = await openSubs(page, { cloud: true });
    const bodies = [];
    await page.route('**/api/asr', (route) => {
      bodies.push(JSON.parse(route.request().postData() || '{}'));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'How are you today', segments: [], neurons: 1 }) });
    });
    await loadAll(page);
    await page.locator('[data-k="subs-cue"]').nth(1).click();
    await page.click('[data-k="subs-rec"]');
    await page.click('[data-k="subs-rec-stop"]');
    await expect(page.locator('[data-k="subs-score"]')).toContainText('100%');
    expect(bodies.length).toBe(1);
    expect(typeof bodies[0].language).toBe('string');
    expect(await page.evaluate(() => window.__asrJobs.length)).toBe(0); // ไม่ใช้โมเดลในเครื่อง
    expect([...new Set(api)]).toEqual(['/api/asr']);
  });

  test('ไม่มีซับ → สร้างซับด้วยการถอดเสียงในเครื่อง (segments → ประโยค) ไม่มีคำขอ /api', async ({ page }) => {
    const { errors, api } = await openSubs(page);
    await page.setInputFiles('[data-k="subs-media"]', mediaFile);
    await page.click('[data-k="subs-gen"]');
    await expect(page.locator('[data-k="subs-cue"]')).toHaveCount(2);
    await expect(page.locator('[data-k="subs-cue"]').nth(1)).toContainText('Local second');
    const job = (await page.evaluate(() => window.__asrJobs))[0];
    expect(job.ts).toBe(true);
    expect(api).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('ไม่มีซับ → สร้างซับผ่านคลาวด์ (ไฟล์ ≤ 30 นาที) · คลาวด์ล่มบนคอม → ถอยไปถอดในเครื่อง', async ({ page }) => {
    await openSubs(page, { cloud: true });
    let mode = 'down';
    await page.route('**/api/asr', (route) => (mode === 'ok'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Cloud one Cloud two', segments: [{ start: 0.5, end: 2, text: 'Cloud one' }, { start: 3, end: 5, text: 'Cloud two' }], neurons: 1 }) })
      : route.fulfill({ status: 502, contentType: 'application/json', body: '{"code":"upstream"}' })));
    await page.setInputFiles('[data-k="subs-media"]', mediaFile);
    await page.click('[data-k="subs-gen"]');
    await expect(page.locator('[data-k="subs-cue"]').first()).toContainText('Local first');
    expect(await page.evaluate(() => window.__asrJobs.length)).toBeGreaterThan(0);
    // เปลี่ยนไฟล์ซับด้วยตัวใหม่ (คลาวด์ปกติ) — เริ่มใหม่จากหน้าเปล่า
    await page.reload();
    await page.click('[data-k="tab-listen"]');
    await page.click('[data-k="lsub-subs"]');
    mode = 'ok';
    await page.setInputFiles('[data-k="subs-media"]', mediaFile);
    await page.click('[data-k="subs-gen"]');
    await expect(page.locator('[data-k="subs-cue"]')).toHaveCount(2);
    await expect(page.locator('[data-k="subs-cue"]').first()).toContainText('Cloud one');
    expect(await page.evaluate(() => window.__asrJobs.length)).toBe(0);
  });

  test('EN: ข้อความ UI ของแผงไม่มีภาษาไทยเหลือ (ยกเว้นข้อมูลผู้ใช้)', async ({ page }) => {
    await openSubs(page, { lang: 'en' });
    await loadAll(page, { thai: true });
    await page.locator('[data-k="subs-cue"]').first().click();
    const thai = await page.evaluate(() => {
      const root = document.querySelector('[data-k="subs-list"]').closest('.space-y-4');
      const c = root.cloneNode(true);
      c.querySelectorAll('[data-i18n-skip]').forEach((n) => n.remove());
      return /[฀-๿]/.test(c.innerText + ' ' + [...c.querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label')).join(' '));
    });
    expect(thai).toBe(false);
  });
});

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
test.describe('หน้า: ซับไตเติล บน iPhone', () => {
  test.use({ userAgent: IOS_UA });

  test('สร้างซับ: โควตาเต็ม → ไม่ถอยไปโมเดลในเครื่อง บอกสาเหตุ และ problem log ไม่มีชื่อไฟล์', async ({ page }) => {
    await openSubs(page, { cloud: true });
    await page.route('**/api/asr', (route) => route.fulfill({ status: 429, contentType: 'application/json', body: '{"code":"quota"}' }));
    await page.setInputFiles('[data-k="subs-media"]', mediaFile);
    await page.click('[data-k="subs-gen"]');
    await expect(page.getByText('ถอดเสียงไม่สำเร็จ')).toBeVisible();
    await expect(page.locator('[data-k="subs-gen"]')).toBeVisible();
    expect(await page.evaluate(() => window.__asrJobs.length)).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('tanot:media:log') || '')).not.toContain('clip.wav');
  });

  test('ไม่มีคลาวด์ → สร้างซับ/พูดตามบอกว่าไม่รองรับ ไม่สร้าง Worker ถอดเสียง', async ({ page }) => {
    await openSubs(page);
    await page.setInputFiles('[data-k="subs-media"]', mediaFile);
    await page.click('[data-k="subs-gen"]');
    await expect(page.getByText('ยังไม่รองรับ iPhone/iPad')).toBeVisible();
    expect(await page.evaluate(() => window.__asrJobs.length)).toBe(0);
  });
});
