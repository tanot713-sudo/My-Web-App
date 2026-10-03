// @ts-check
// พิมพ์ดีด — แป้นเกษมณีชั้น Shift: known-answer ของผังทั้ง 2 ชั้นเทียบตารางในคอมเมนต์หัวไฟล์ typing.js, ตัวอักษรของบทชั้น Shift
// ต้องอยู่ในผัง, พิมพ์จบบท th-shift-letters ด้วย event.key จำลอง (ได้ XP), ไฮไลต์ Shift ฝั่งตรงข้ามมือ, สถานะเตือนแป้นไม่ใช่ภาษาไทย,
// ความคืบหน้า/คีย์เดิมไม่ถูกแตะ
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');
const T = require('../typing.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'typing.js'), 'utf8');

/* ── ผังทุกปุ่ม: เทียบตาราง R1–R4 ในคอมเมนต์หัวไฟล์ ── */
function tableFromComment() {
  const rows = {};
  const re = /^\s*R([1-4]) (en|EN\^|th|TH\^)\s*: (.*)$/gm;
  let m;
  while ((m = re.exec(SRC))) (rows[m[1]] = rows[m[1]] || {})[m[2].trim()] = m[3].trim().split(/\s+/);
  return rows;
}

test('ผังแป้น: ทุกปุ่มทั้ง 4 ชั้นตรงกับตารางในคอมเมนต์หัวไฟล์', () => {
  const table = tableFromComment();
  expect(Object.keys(table)).toEqual(['1', '2', '3', '4']);
  const layers = ['en', 'th', 'EN^', 'TH^'];
  T.KB_ROWS.forEach((row, r) => {
    layers.forEach((layer, li) => {
      expect(row.map((k) => k[li]), `แถว ${r + 1} ชั้น ${layer}`).toEqual(table[String(r + 1)][layer]);
    });
  });
  expect(T.KB_ROWS.map((r) => r.length)).toEqual([13, 13, 11, 10]);
  expect(T.KB_ROWS.every((r) => r.every((k) => k.length === 4))).toBe(true);
});

test('ผังแป้น: ตัวที่มักสลับ — ฃ ฅ ฦ ๅ ฯ และเลขไทยอยู่ปุ่ม/ชั้นที่ถูก', () => {
  const at = (r, c) => T.KB_ROWS[r][c];
  expect(at(1, 12)).toEqual(['\\', 'ฃ', '|', 'ฅ']); // ฃ ไม่กด Shift, ฅ กด Shift — ปุ่มเดียวกัน
  expect(at(3, 9)).toEqual(['/', 'ฝ', '?', 'ฦ']);
  expect(at(0, 1)[1]).toBe('ๅ');
  expect(at(0, 1)[3]).toBe('+');
  expect(at(1, 8)).toEqual(['o', 'น', 'O', 'ฯ']);
  // เลขไทย: ๑–๙ ที่ปุ่ม 2 3 4 5 8 9 0 - = (ชั้น Shift), ๐ ที่ Shift+q, ู ที่ Shift+6, ฿ ที่ Shift+7
  expect(T.KB_ROWS[0].slice(2, 6).map((k) => k[3]).join('')).toBe('๑๒๓๔');
  expect(T.KB_ROWS[0].slice(8, 13).map((k) => k[3]).join('')).toBe('๕๖๗๘๙');
  expect(at(1, 0)[3]).toBe('๐');
  expect(at(0, 6)[3]).toBe('ู');
  expect(at(0, 7)[3]).toBe('฿');
  // ชั้น Shift แถวกลาง: ฤ ฆ ฏ โ ฌ ็ ๋ ษ ศ ซ .
  expect(T.KB_ROWS[2].map((k) => k[3]).join('')).toBe('ฤฆฏโฌ็๋ษศซ.');
});

test('ผังแป้น: ไม่มีอักษรซ้ำข้ามชั้น และครอบคลุมอักษรไทยครบทุกตัว + ASCII ที่พิมพ์ได้ทุกตัว', () => {
  for (const [name, li] of [['EN', 0], ['TH', 1]]) {
    const all = T.KB_ROWS.flatMap((row) => row.flatMap((k) => [k[li], k[li + 2]]));
    expect(new Set(all).size, `${name} ซ้ำกัน`).toBe(all.length);
    const map = name === 'EN' ? T.EN_CHAR_MAP : T.TH_CHAR_MAP;
    for (const ch of all) expect(map[ch], ch).toBeTruthy();
  }
  const th = [];
  const addRange = (a, b) => { for (let c = a; c <= b; c++) th.push(String.fromCharCode(c)); };
  addRange(0x0e01, 0x0e3a); addRange(0x0e3f, 0x0e4d); addRange(0x0e50, 0x0e59); // พยัญชนะ+สระ ฯ, ฿, ๅ ๆ วรรณยุกต์ ์ ํ, ๐–๙
  expect(th.filter((ch) => !T.TH_CHAR_MAP[ch])).toEqual([]);
  const ascii = [];
  for (let c = 0x21; c <= 0x7e; c++) ascii.push(String.fromCharCode(c));
  expect(ascii.filter((ch) => !T.EN_CHAR_MAP[ch])).toEqual([]);
});

test('ฝั่ง Shift: มือซ้ายกดอักษรใช้ Shift ขวา และกลับกัน', () => {
  expect(T.shiftSideFor(2, 0)).toBe('r'); // A ก้อยซ้าย
  expect(T.shiftSideFor(2, 3)).toBe('r'); // F ชี้ซ้าย
  expect(T.shiftSideFor(0, 5)).toBe('r'); // 5 ชี้ซ้าย
  expect(T.shiftSideFor(0, 6)).toBe('l'); // 6 ชี้ขวา
  expect(T.shiftSideFor(2, 8)).toBe('l'); // L นางขวา
  expect(T.shiftSideFor(3, 9)).toBe('l'); // / ก้อยขวา
  expect(T.TH_CHAR_MAP['ศ']).toEqual({ r: 2, c: 8, shift: true });
  expect(T.TH_CHAR_MAP['ก']).toEqual({ r: 2, c: 2, shift: false });
  expect(T.EN_CHAR_MAP['S']).toEqual({ r: 2, c: 1, shift: true });
});

/* ── เนื้อหาบท ── */
const OLD_IDS = { 'en-home': 5, 'en-full': 5, 'en-words': 3, 'en-sentences': 5, 'th-home': 5, 'th-full': 5, 'th-words': 3, 'th-sentences': 5 };
const shiftTracks = T.TRACKS.filter((tr) => tr.shift);
const chars = (tr) => tr.lessons.flatMap((l) => [...l.text]);

test('บทเดิม: เนื้อหา/id/ลำดับบทไม่เปลี่ยนแม้แต่ตัวเดียว (ความคืบหน้าผูกกับ id)', () => {
  expect(T.TRACKS.slice(0, 8).map((tr) => [tr.id, tr.lessons.length])).toEqual(Object.entries(OLD_IDS));
  // แฮชของ TRACKS เดิม 8 ชุดจาก typing.js ก่อนเพิ่มบทชั้น Shift — ถ้าเปลี่ยนบทเดิมต้องเปลี่ยนเลขนี้โดยตั้งใจ
  const sha1 = require('crypto').createHash('sha1').update(JSON.stringify(T.TRACKS.slice(0, 8))).digest('hex');
  expect(sha1).toBe('56d28c29d803bd7cb4b7625efb230e8fc0aa0ab9');
  // ตัวใหม่ต้องต่อท้ายเท่านั้น
  expect(T.TRACKS.slice(8).every((tr) => tr.shift)).toBe(true);
});

test('บทชั้น Shift: id ครบ, ทุกตัวอักษรมีอยู่ในผัง, ทุกบทต้องกด Shift อย่างน้อย 1 ตัว', () => {
  expect(shiftTracks.map((tr) => tr.id)).toEqual(['en-shift', 'en-shift-sentences', 'th-shift-letters', 'th-shift-numbers', 'th-shift-words', 'th-shift-sentences']);
  expect(T.TRACKS.map((tr) => tr.id).length).toBe(new Set(T.TRACKS.map((tr) => tr.id)).size);
  for (const tr of shiftTracks) {
    const map = tr.lang === 'th' ? T.TH_CHAR_MAP : T.EN_CHAR_MAP;
    for (const l of tr.lessons) {
      const missing = [...l.text].filter((ch) => !map[ch]);
      expect(missing, `${tr.id} / ${l.title}`).toEqual([]);
      expect([...l.text].some((ch) => map[ch] && map[ch].shift), `${tr.id} / ${l.title} ไม่มีตัวชั้น Shift`).toBe(true);
      expect(l.text).toBe(l.text.trim());
      expect(l.text).not.toMatch(/ {2}/);
    }
  }
});

test('บทไทย: สะกดเบื้องต้นถูกรูป (ไม่ขึ้นต้นด้วยสระ/วรรณยุกต์ลอย ไม่มีวรรณยุกต์ซ้อนกัน)', () => {
  const lead = /(^|\s)[ะ-ฺๅ-๎]/; // สระตามหลัง/วรรณยุกต์/อักษรผสมที่ขึ้นต้นคำไม่ได้
  const tones = /[่-๋]{2}/;
  for (const tr of shiftTracks.filter((x) => x.lang === 'th')) {
    for (const l of tr.lessons) {
      const text = l.text.replace(/^(?:[ฃฅฦ] ?)+$/, ''); // บทอักษรโบราณเป็นตัวเดี่ยวโดยตั้งใจ
      expect(text, `${tr.id} / ${l.title}`).not.toMatch(lead);
      expect(l.text, `${tr.id} / ${l.title}`).not.toMatch(tones);
    }
  }
});

test('รอบจับเวลา: ชุดคำเท่าเดิม ไม่รวมคำจากบทชั้น Shift', () => {
  for (const lang of ['th', 'en']) {
    const oldWords = new Set(T.TRACKS.slice(0, 8).filter((tr) => tr.lang === lang && tr.id.endsWith('-words')).flatMap((tr) => tr.lessons.flatMap((l) => l.text.split(' '))));
    const pool = new Set(T.buildSprintText(lang).split(' '));
    expect([...pool].filter((w) => !oldWords.has(w))).toEqual([]);
    expect(pool.size).toBe(oldWords.size);
  }
});

/* ── หน้าเว็บ ── */
const PROGRESS = 'tanot:typing:progress';
const OLD_PROGRESS = { 'en-home::0': { wpm: 31, acc: 96, at: 1 }, 'th-home::0': { wpm: 18.5, acc: 88, at: 2 }, 'th-home::1': { wpm: 12, acc: 75, at: 3 } };

async function openTyping(page, seed) {
  const errors = await prepare(page);
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, seed || {});
  await page.goto('/typing.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return errors;
}
const selectTrack = (page, label) => page.locator('.tt-tab', { hasText: label }).click();
const next = (page) => page.locator('#virtualKeyboard .tt-key.next');

/** จำลองการกดแป้น 1 ครั้ง: keydown (event.key = ตัวอักษรที่ได้จริง) → ค่าในช่องเปลี่ยน → input → keyup */
async function press(page, ch) {
  await page.evaluate((c) => {
    const i = /** @type {HTMLInputElement} */ (document.getElementById('hiddenInput'));
    i.dispatchEvent(new KeyboardEvent('keydown', { key: c, bubbles: true }));
    i.value += c;
    i.dispatchEvent(new InputEvent('input', { data: c, inputType: 'insertText', bubbles: true }));
    i.dispatchEvent(new KeyboardEvent('keyup', { key: c, bubbles: true }));
  }, ch);
}
async function typeAll(page, text) { for (const ch of text) await press(page, ch); }
const summary = (page) => page.evaluate(() => window.LearnCore.summary());

test('พิมพ์ครบบท th-shift-letters ด้วย event.key: ผ่าน + ได้ XP + บันทึกความคืบหน้า โดยไม่แตะความคืบหน้าเดิม', async ({ page }) => {
  const errors = await openTyping(page, { [PROGRESS]: JSON.stringify(OLD_PROGRESS), 'tanot:music:xp': '100' });
  await selectTrack(page, 'Shift: อักษร (ไทย)');
  const lesson = T.TRACKS.find((tr) => tr.id === 'th-shift-letters').lessons[0];
  await page.locator('#hiddenInput').focus();
  const xpBefore = (await summary(page)).bySrc.typing || 0;
  await typeAll(page, lesson.text);
  await expect(page.locator('#resultPanel')).toBeVisible();
  await expect(page.locator('#resultAcc')).toHaveText('100%');
  expect((await summary(page)).bySrc.typing).toBe(xpBefore + 5);
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), PROGRESS);
  expect(saved['th-shift-letters::0'].acc).toBe(100);
  for (const [k, v] of Object.entries(OLD_PROGRESS)) expect(saved[k], k).toEqual(v); // บทเดิมยังอยู่ครบ ค่าเดิม
  expect(await page.evaluate(() => localStorage.getItem('tanot:music:xp'))).toBe('100');
  // ปลดล็อกบทถัดไปของ track ใหม่ตามกฎเดิม
  await expect(page.locator('.tt-lesson.locked')).toHaveCount(T.TRACKS.find((tr) => tr.id === 'th-shift-letters').lessons.length - 2);
  expect(errors).toEqual([]);
});

test('ตัวผิดไม่ผ่านบท: พิมพ์เลขอารบิกแทนเลขไทยแล้วความแม่นยำตก (ตรวจตามตัวอักษรจริง)', async ({ page }) => {
  await openTyping(page, { [PROGRESS]: JSON.stringify({ 'th-shift-numbers::0': { wpm: 10, acc: 100 } }) });
  await selectTrack(page, 'Shift: เลขไทย/เครื่องหมาย');
  await page.locator('.tt-lesson').nth(1).click();
  await page.locator('#hiddenInput').focus();
  await typeAll(page, '6 7 8 9 0 67 78 89 90 06 678 890'); // เลขอารบิกทั้งหมด
  await expect(page.locator('#resultPanel')).toBeVisible();
  await expect(page.locator('#resultAcc')).not.toHaveText('100%');
  expect(await summary(page).then((s) => s.bySrc.typing || 0)).toBe(0); // แม่นต่ำกว่าเกณฑ์ไม่ได้ XP
});

test('คีย์บอร์ดบนจอ: ตัวถัดไปชั้น Shift ไฮไลต์ปุ่มอักษร + Shift ฝั่งตรงข้ามมือ และสลับป้ายเป็นอักษรชั้น Shift', async ({ page }) => {
  await openTyping(page, { [PROGRESS]: JSON.stringify({ 'en-shift::0': { wpm: 10, acc: 100 }, 'th-shift-letters::1': { wpm: 10, acc: 100 } }) });
  const kb = page.locator('#virtualKeyboard');
  await expect(page.locator('#virtualKeyboard .tt-shift')).toHaveCount(2);

  // อังกฤษ 'Sam' — S มือซ้าย → Shift ขวา
  await selectTrack(page, 'Shift (อังกฤษ)');
  await expect(kb).toHaveClass(/shifted/);
  await expect(next(page)).toHaveCount(2);
  await expect(page.locator('.tt-shift[data-shift="r"]')).toHaveClass(/next/);
  await expect(page.locator('.tt-shift[data-shift="l"]')).not.toHaveClass(/next/);
  await expect(page.locator('.tt-key[data-r="2"][data-c="1"]')).toHaveText('S');
  await expect(page.locator('.tt-key[data-r="2"][data-c="1"]')).toHaveClass(/next/);
  await expect(page.locator('.tt-key[data-r="0"][data-c="1"]')).toHaveText('!');
  // ตัวถัดไป 'a' ไม่ต้องกด Shift → ป้ายกลับเป็นตัวเล็ก ไฮไลต์เฉพาะปุ่มเดียว
  await page.locator('#hiddenInput').focus();
  await press(page, 'S');
  await expect(kb).not.toHaveClass(/shifted/);
  await expect(next(page)).toHaveCount(1);
  await expect(page.locator('.tt-key[data-r="2"][data-c="0"]')).toHaveText('a');

  // อังกฤษ 'Kim' (บท 2) — K มือขวา → Shift ซ้าย
  await page.locator('.tt-lesson').nth(1).click();
  await expect(page.locator('.tt-shift[data-shift="l"]')).toHaveClass(/next/);
  await expect(page.locator('.tt-shift[data-shift="r"]')).not.toHaveClass(/next/);

  // ไทย บท 'ณ ญ ษ ฤ' ตัวแรก 'ค' ไม่ใช้ Shift, แต่คำ 'ฤษี' (ท้ายบท) ใช้ — ตรวจที่ ฤ (A, ก้อยซ้าย → Shift ขวา)
  await selectTrack(page, 'Shift: อักษร (ไทย)');
  await page.locator('.tt-lesson').nth(2).click();
  await page.locator('#hiddenInput').focus();
  const text = T.TRACKS.find((tr) => tr.id === 'th-shift-letters').lessons[2].text;
  await typeAll(page, text.slice(0, text.indexOf('ฤ')));
  await expect(kb).toHaveClass(/shifted/);
  await expect(page.locator('.tt-key[data-r="2"][data-c="0"]')).toHaveText('ฤ');
  await expect(page.locator('.tt-shift[data-shift="r"]')).toHaveClass(/next/);
  await expect(page.locator('#fingerHint')).toContainText('Shift');
});

test('แป้นของเครื่องไม่ใช่ภาษาไทย: บทไทยได้ตัวละตินขึ้นสถานะเตือน, ได้ตัวไทยแล้วหาย, บทอังกฤษไม่เตือน', async ({ page }) => {
  await openTyping(page);
  const warn = page.locator('#thaiKbWarn');
  await selectTrack(page, 'แถวกลาง (ไทย)');
  await expect(warn).toBeHidden(); // ไม่มีข้อความคงที่ — ขึ้นเฉพาะเมื่อตรวจเจอ
  await page.locator('#hiddenInput').focus();
  await page.evaluate(() => document.getElementById('hiddenInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })));
  await expect(warn).toBeVisible();
  await page.evaluate(() => document.getElementById('hiddenInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'ฟ', bubbles: true })));
  await expect(warn).toBeHidden();
  await press(page, 'f'); // ผ่านทาง input (แป้นเสมือน/IME ที่ไม่มี event.key)
  await expect(warn).toBeVisible();
  await page.locator('.tt-tab', { hasText: /^แถวกลาง$/ }).click();
  await expect(warn).toBeHidden();
  await page.locator('#hiddenInput').focus();
  await page.evaluate(() => document.getElementById('hiddenInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })));
  await expect(warn).toBeHidden();
});
