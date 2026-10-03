// @ts-check
// งาน PowerPoint (slides.html / slides-calc.js / ns 'slides' ของ /api/files / PptxGenJS ใน vendor/) — ROADMAP Phase 6 การทำงาน
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { prepare } = require('./helpers');

const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'slides-calc.js'));
const SRV = 'http://localhost:8134';
// ทั้งไฟล์ใช้เซิร์ฟเวอร์เดียวที่มี /__reset ล้าง D1+R2 — ห้ามให้ describe ต่างกลุ่มรันขนานกัน
test.describe.configure({ mode: 'serial' });

const OUTLINE = [
  '# ประชุมไตรมาส 3', 'สรุปผลงานและแผนงาน', '> สวัสดีครับ ยินดีต้อนรับ', '',
  '# ผลงานไตรมาสนี้', '- ยอดขายโต 10%', '  - ภาคเหนือโตสูงสุด', '- กำไรเพิ่มขึ้น', '> พูดถึงภาคเหนือเป็นพิเศษ', '',
  '# เปรียบเทียบ', '- ก่อน', '- หลัง', '---', '- ต้นทุนลดลง', '', '# ตารางยอดขาย', 'เดือน\tยอด', 'ต.ค.\t100', 'พ.ย.\t120', '', '# ขั้นตอนถัดไป', '',
].join('\n');

/* ══════════ A. slides-calc.js (known-answer) ══════════ */
test.describe('slides-calc.js — parse โครงเรื่อง', () => {
  test('# = สไลด์ใหม่ · - bullet 2 ระดับ · ข้อความธรรมดา · > โน้ต · --- คอลัมน์ · แท็บ = ตาราง', () => {
    const p = C.parseOutline(OUTLINE);
    expect(p.slides.map((s) => s.title)).toEqual(['ประชุมไตรมาส 3', 'ผลงานไตรมาสนี้', 'เปรียบเทียบ', 'ตารางยอดขาย', 'ขั้นตอนถัดไป']);
    expect(p.slides[0].items).toEqual([{ t: 'สรุปผลงานและแผนงาน', l: 0, bullet: false }]);
    expect(p.slides[0].notes).toBe('สวัสดีครับ ยินดีต้อนรับ');
    expect(p.slides[1].items).toEqual([
      { t: 'ยอดขายโต 10%', l: 0, bullet: true }, { t: 'ภาคเหนือโตสูงสุด', l: 1, bullet: true }, { t: 'กำไรเพิ่มขึ้น', l: 0, bullet: true }]);
    expect(p.slides[1].notes).toBe('พูดถึงภาคเหนือเป็นพิเศษ');
    expect(p.slides[2].items.map((x) => x.t)).toEqual(['ก่อน', 'หลัง']);
    expect(p.slides[2].items2.map((x) => x.t)).toEqual(['ต้นทุนลดลง']);
    expect(p.slides[3].table).toEqual([['เดือน', 'ยอด'], ['ต.ค.', '100'], ['พ.ย.', '120']]);
  });

  test('ย่อหน้าซ้อน: แท็บ/ช่องว่าง ≥ 2 = ระดับ 2 · ลึกกว่านั้นยังเป็นระดับ 2', () => {
    const s = C.parseOutline('# ก\n- a\n\t- b\n    - c\n * d').slides[0];
    expect(s.items.map((x) => x.l)).toEqual([0, 1, 1, 0]);
  });

  test('ตาราง markdown (|) ข้ามแถวคั่น · บรรทัดก่อน # แรก = สไลด์ไม่มีชื่อ · เลขบรรทัดของสไลด์', () => {
    const p = C.parseOutline('ข้อความลอย\n# สอง\n| a | b |\n|---|---|\n| 1 | 2 |');
    expect(p.slides[0]).toMatchObject({ title: '', titled: false, startLine: 0 });
    expect(p.slides[1].table).toEqual([['a', 'b'], ['1', '2']]);
    expect(p.slides[1]).toMatchObject({ startLine: 1, titled: true });
  });

  test('เลือก layout อัตโนมัติจากเนื้อหา', () => {
    const lay = (t, i = 1) => C.layoutOf(C.parseOutline(t).slides[0], i);
    expect(lay('# ก\nคำบรรยาย', 0)).toEqual({ id: 'cover', auto: true });
    expect(lay('# ก', 0).id).toBe('cover');
    expect(lay('# ก', 3).id).toBe('section');
    expect(lay('# ก\n- ข\n- ค').id).toBe('bullets');
    expect(lay('# ก\n- ข\n- ค', 0).id).toBe('bullets'); // สไลด์แรกที่มี bullet ไม่ใช่หน้าปก
    expect(lay('# ก\n- ข\n---\n- ค').id).toBe('two');
    expect(lay('# ก\n- ข\n@image k1').id).toBe('image');
    expect(lay('# ก\nx\ty\n1\t2').id).toBe('table');
    expect(lay('# ก\n- ข\n@layout section')).toEqual({ id: 'section', auto: false });
    expect(lay('# ก\n- ข\n@layout ไม่มีจริง').auto).toBe(true); // ค่าที่ไม่รู้จักถูกเมิน
  });

  test('setDirective: เพิ่ม/แก้/ลบ @layout ใต้หัวสไลด์ที่ถูกต้อง', () => {
    let t = C.setDirective(OUTLINE, 1, 'layout', 'two');
    expect(t.split('\n')[5]).toBe('@layout two');
    expect(C.parseOutline(t).slides[1].layoutExplicit).toBe('two');
    expect(C.parseOutline(t).slides.map((s) => s.title)).toEqual(C.parseOutline(OUTLINE).slides.map((s) => s.title));
    t = C.setDirective(t, 1, 'layout', 'bullets');
    expect(t.match(/@layout/g)).toHaveLength(1);
    expect(C.parseOutline(t).slides[1].layoutExplicit).toBe('bullets');
    t = C.setDirective(t, 1, 'layout', '');
    expect(t).toBe(OUTLINE);
    expect(C.setDirective('ลอย\n# ก', 0, 'image', 'k1')).toBe('@image k1\nลอย\n# ก'); // สไลด์ไม่มีชื่อ: ใส่ต้นข้อความ
    expect(C.setDirective(OUTLINE, 99, 'layout', 'two')).toBe(OUTLINE);
  });

  test('textToOutline: ย่อหน้า = สไลด์ (ชื่อ + bullet) · ข้อความที่เป็นโครงเรื่องอยู่แล้วไม่แตะ', () => {
    expect(C.textToOutline('หัวข้อ A\nข้อ 1\nข้อ 2\n\nหัวข้อ B')).toBe('# หัวข้อ A\n- ข้อ 1\n- ข้อ 2\n\n# หัวข้อ B');
    expect(C.textToOutline('# ก\n- ข')).toBe('# ก\n- ข');
    const long = 'ก'.repeat(100);
    expect(C.textToOutline(long).split('\n')).toEqual(['# ' + 'ก'.repeat(50) + '…', '- ' + long]);
    expect(C.textToOutline('  ')).toBe('');
  });

  test('cleanOutline: ตัดรั้ว ``` / คำนำ · จุดหัวข้อแบบอื่นเป็นแบบของเรา · ** ถูกถอด', () => {
    const raw = 'นี่คือโครงเรื่องครับ\n```markdown\n## **สรุป**\n* ข้อหนึ่ง\n• ข้อสอง\n1. ข้อสาม\n\n\n\n# ปิด\n```';
    expect(C.cleanOutline(raw)).toBe('# สรุป\n- ข้อหนึ่ง\n- ข้อสอง\n- ข้อสาม\n\n# ปิด');
  });

  test('aiMessages: system + user · ตัดข้อความต้นฉบับยาวเกินที่ AI_MAX_CHARS', () => {
    const m = C.aiMessages('ก'.repeat(C.AI_MAX_CHARS + 500));
    expect(m.map((x) => x.role)).toEqual(['system', 'user']);
    expect(m[0].content).toContain('# ');
    expect(m[1].content.length).toBeLessThan(C.AI_MAX_CHARS + 100);
  });
});

test.describe('slides-calc.js — ธีม/ตำแหน่ง/ชุดสไลด์', () => {
  test('palette: สีเน้นมาจาก accent · ตัวหนังสือบนสีเน้นเลือกขาว/เข้มตามความสว่าง · 4 ธีม', () => {
    expect(C.THEMES.map((t) => t.id)).toEqual(['light', 'dark', 'accent', 'plain']);
    expect(C.palette('light', '#0F8F82')).toMatchObject({ accent: '0F8F82', onAccent: 'FFFFFF', bg: 'FFFFFF' });
    expect(C.palette('light', 'FFD500').onAccent).toBe('1F2430');
    expect(C.palette('dark', null).bg).toBe('151A26');
    const a = C.palette('accent', '1E40AF');
    expect(a.coverBg).toBe('1E40AF'); expect(a.coverTitle).toBe('FFFFFF');
    expect(C.palette('ไม่มี', 'abc').id).toBe('light');
    expect(C.normHex('#abc')).toBe('AABBCC'); expect(C.normHex('xyz')).toBeNull();
  });

  test('buildModel: shape ต่อสไลด์ในหน่วยนิ้ว 16:9 · ทุกสไลด์อยู่ในกรอบ · โน้ตติดมา · ฟอนต์ pptx = Tahoma', () => {
    const m = C.buildModel({ outline: OUTLINE, theme: 'light', name: 'ทดสอบ' });
    expect(m.slides.map((s) => s.layout)).toEqual(['cover', 'bullets', 'two', 'table', 'section']);
    expect(m.slides.map((s) => s.auto)).toEqual([true, true, true, true, true]);
    expect(m.slides[0].notes).toBe('สวัสดีครับ ยินดีต้อนรับ');
    expect(m.w).toBeCloseTo(13.333, 3); expect(m.h).toBe(7.5);
    expect(m.font).toBe('Tahoma'); expect(m.webFont).toBe('Prompt');
    for (const s of m.slides) for (const sh of s.shapes) {
      expect(sh.x).toBeGreaterThanOrEqual(0); expect(sh.y).toBeGreaterThanOrEqual(0);
      expect(sh.x + sh.w).toBeLessThanOrEqual(13.34); expect(sh.y + sh.h).toBeLessThanOrEqual(7.5);
    }
    const body = m.slides[1].shapes.find((x) => x.k === 'text' && x.paras.length === 3);
    expect(body.paras.map((p) => [p.t, p.bullet, p.lvl])).toEqual([['ยอดขายโต 10%', true, 0], ['ภาคเหนือโตสูงสุด', true, 1], ['กำไรเพิ่มขึ้น', true, 0]]);
    expect(m.slides[1].shapes.filter((x) => x.k === 'text' && x.paras[0].t === '2')).toHaveLength(1); // เลขหน้า
    const tbl = m.slides[3].shapes.find((x) => x.k === 'table');
    expect(tbl.rows).toEqual([['เดือน', 'ยอด'], ['ต.ค.', '100'], ['พ.ย.', '120']]);
    expect(tbl.colW.reduce((a, b) => a + b, 0)).toBeCloseTo(11.93, 2);
    expect(m.slides[2].shapes.filter((x) => x.k === 'text' && x.paras.some((p) => p.bullet))).toHaveLength(2); // 2 คอลัมน์
  });

  test('ธีมเปลี่ยนสีพื้น/ตัวหนังสือ · ธีมสีเน้นหน้าปกพื้นสีเน้น', () => {
    const d = (theme) => C.buildModel({ outline: '# ก\nข', theme, accent: '1E40AF' }).slides[0];
    expect(d('light').bg).toBe('FFFFFF');
    expect(d('dark').bg).toBe('151A26');
    expect(d('accent').bg).toBe('1E40AF');
    expect(d('plain').shapes.some((s) => s.k === 'rect' && s.fill === '1E40AF')).toBe(false);
    expect(d('light').shapes.some((s) => s.k === 'rect' && s.fill === '1E40AF')).toBe(true);
  });

  test('เนื้อหายาวลดขนาดตัวอักษรลง ไม่ต่ำกว่าขั้นต่ำ', () => {
    const short = [{ t: 'ก', l: 0, bullet: true }];
    const long = Array.from({ length: 14 }, () => ({ t: 'ข้อความยาวมากๆ '.repeat(8), l: 0, bullet: true }));
    expect(C.fitSize(short, 11.93, 4.85, 26, 14)).toBe(26);
    expect(C.fitSize(long, 11.93, 4.85, 26, 14)).toBe(14);
    const mid = C.fitSize(long.slice(0, 5), 11.93, 4.85, 26, 14);
    expect(mid).toBeLessThan(26); expect(mid).toBeGreaterThanOrEqual(14);
  });

  test('fitRect: รูปอยู่กลางกล่อง คงสัดส่วน', () => {
    expect(C.fitRect(5.53, 4.85, 1000, 1000)).toEqual({ x: (5.53 - 4.85) / 2, y: 0, w: 4.85, h: 4.85 });
    const r = C.fitRect(10, 5, 400, 100);
    expect(r.w).toBe(10); expect(r.h).toBe(2.5); expect(r.y).toBe(1.25);
    expect(C.fitRect(4, 3, 0, 0)).toEqual({ x: 0, y: 0, w: 4, h: 3 });
  });

  test('cleanDeck / dupDeck / exclusiveIds: รูปที่ชุดอื่นยังใช้ห้ามลบ', () => {
    const a = C.cleanDeck({ id: 'a', name: 'ก', outline: '# x', theme: 'ผิด', accent: 'zz', images: { k1: { id: 'f1', name: 'p.jpg', size: 5, mime: 'image/jpeg', w: 10, h: 10 }, k2: { id: 'f2', name: 'q.jpg' }, 'bad key!': { id: 'f9' }, k3: { name: 'local.jpg', pending: true } } }, 'a', 1);
    expect(a.theme).toBe('light'); expect(a.accent).toBeNull();
    expect(Object.keys(a.images)).toEqual(['k1', 'k2', 'k3']);
    expect(a.images.k3.pending).toBe(true); expect(a.images.k1.pending).toBeUndefined();
    const b = C.dupDeck(a, 'b', 9);
    expect(b).toMatchObject({ id: 'b', name: 'ก (สำเนา)', createdAt: 9, updatedAt: 9 });
    expect(b.images.k1.id).toBe('f1'); // อ้างไฟล์เดิม ไม่คัดลอกไบนารี
    expect(C.exclusiveIds(a, [b])).toEqual([]);
    const c = C.cleanDeck({ id: 'c', images: { z: { id: 'f2', name: 'q.jpg' } } }, 'c', 1);
    expect(C.exclusiveIds(a, [c]).sort()).toEqual(['f1']); // f2 ถูก c ใช้อยู่
    expect(C.exclusiveIds(a, [])).toEqual(['f1', 'f2']);
    expect(C.exclusiveIds(a, [], ['k2'])).toEqual(['f2']);
    expect(C.deckTitle({ name: '', outline: '# หัวแรก' })).toBe('หัวแรก');
    expect(C.slideCount({ outline: OUTLINE })).toBe(5);
    expect(C.matches({ name: 'รายงาน', outline: '# Q3' }, 'q3')).toBe(true);
    expect(C.matches({ name: 'รายงาน', outline: '# Q3' }, 'zzz')).toBe(false);
  });
});

/* ══════════ B. หน้า slides.html ══════════ */
async function openPage(page, p = '/slides.html', { files = false, sync = false, ai = false, theme = 'light', width = 1280 } = {}) {
  const errors = await prepare(page, { theme });
  const ocr = [];
  page.on('request', (r) => { if (/\/api\/ocr/.test(r.url())) ocr.push(r.url()); });
  await page.addInitScript(({ files, sync, ai }) => {
    if (files) window.TANOT_FILES = { enabled: true };
    if (ai) window.TANOT_AI = { enabled: true };
    if (sync) window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
    const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dlName = this.download; return c.apply(this, arguments); };
    window.__prints = [];
    window.print = () => { window.__prints.push(document.querySelectorAll('#printArea .sl-s').length); };
  }, { files, sync, ai });
  await page.setViewportSize({ width, height: 900 });
  await page.goto(p, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return { errors, ocr };
}
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tanot:slides:decks') || '[]'));
const newDeck = async (page, text) => {
  await page.click('#newBtn');
  await page.fill('#outline', text);
  await expect(page.locator('#preview .sl-card')).toHaveCount(C.slideCount({ outline: text }));
};
const pngBuf = async (page) => Buffer.from((await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 40;
  const g = c.getContext('2d'); g.fillStyle = '#d33'; g.fillRect(0, 0, 64, 40); g.fillStyle = '#fff'; g.fillRect(8, 8, 20, 12);
  return c.toDataURL('image/png').split(',')[1];
})), 'base64');
const attachImage = async (page, idx, buffer, name = 'photo.png') => {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#preview .sl-card').nth(idx).locator('[data-act="img"]').click()]);
  await fc.setFiles({ name, mimeType: 'image/png', buffer });
};
const readPptx = async (dl) => {
  const zip = await JSZip.loadAsync(fs.readFileSync(await dl.path()));
  const names = Object.keys(zip.files);
  const slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1]) - parseInt(b.match(/(\d+)\.xml/)[1]));
  return { zip, names, slides, xml: async (n) => zip.file(n).async('string') };
};
const sseBody = (text) => {
  const parts = text.match(/[\s\S]{1,40}/g) || [];
  return parts.map((t) => 'data: ' + JSON.stringify({ t }) + '\n\n').join('') + 'data: ' + JSON.stringify({ done: true, model: 'fake', neurons: 1, tokens_in: 1, tokens_out: 1 }) + '\n\n';
};

test.describe('หน้า slides.html — สร้างจากโครงเรื่อง', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('ไม่มีชุด → สร้างใหม่ → พิมพ์โครงเรื่อง → ตัวอย่างจำนวนสไลด์ถูก/แบบอัตโนมัติ · เปลี่ยนแบบ/ธีม · บันทึกอัตโนมัติ', async ({ page }) => {
    const { errors } = await openPage(page);
    await expect(page.locator('#emptyBox')).toBeVisible();
    await expect(page.locator('#pptxBtn')).toBeDisabled();
    await page.click('#emptyNew');
    await expect(page.locator('#emptyBox')).toBeHidden();
    await expect(page.locator('#preview .sl-card')).toHaveCount(2); // เริ่มต้น: ปก + 1 หัวข้อ
    await page.fill('#outline', OUTLINE);
    await expect(page.locator('#preview .sl-card')).toHaveCount(5);
    // แบบอัตโนมัติ + ข้อความไทยอยู่ในสไลด์
    const opts = await page.locator('#preview select[data-act="layout"]').evaluateAll((els) => els.map((e) => e.options[e.selectedIndex].textContent));
    expect(opts).toEqual(['อัตโนมัติ · หน้าปก', 'อัตโนมัติ · หัวข้อ + bullet', 'อัตโนมัติ · 2 คอลัมน์', 'อัตโนมัติ · ตาราง', 'อัตโนมัติ · หัวข้อตอน']);
    await expect(page.locator('#preview .sl-card').nth(1).locator('.sl-s')).toContainText('ภาคเหนือโตสูงสุด');
    await expect(page.locator('#preview .sl-card').nth(3).locator('.sl-tbl td')).toHaveCount(6);
    await expect(page.locator('#preview .sl-card').nth(0).locator('.badge.info')).toHaveText('โน้ต');
    // เลือกแบบเอง → เขียน @layout ลงโครงเรื่อง
    await page.locator('#preview .sl-card').nth(1).locator('select').selectOption('section');
    expect(await page.inputValue('#outline')).toContain('# ผลงานไตรมาสนี้\n@layout section');
    await expect(page.locator('#preview .sl-card').nth(1).locator('select option:checked')).toHaveText('หัวข้อตอน');
    await page.locator('#preview .sl-card').nth(1).locator('select').selectOption('');
    expect(await page.inputValue('#outline')).not.toContain('@layout');
    // ธีม
    // toHaveCSS หาองค์ประกอบใหม่ทุกครั้งที่ลอง — ตัวอย่างถูกวาดใหม่ทั้งชุด (innerHTML) evaluate บน element เดิมอาจได้ตัวที่หลุดจากหน้าแล้ว (ค่า "")
    await expect(page.locator('#preview .sl-s').nth(1)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.click('#themeSeg [data-theme="dark"]');
    await expect(page.locator('#preview .sl-s').nth(1)).toHaveCSS('background-color', 'rgb(21, 26, 38)');
    await expect(page.locator('#themeSeg [data-theme="dark"]')).toHaveAttribute('aria-pressed', 'true');
    // สีเน้นของสไลด์ตามสีเน้นของเว็บ
    await page.click('#themeSeg [data-theme="accent"]');
    const acc = await page.evaluate(() => { const s = document.createElement('i'); s.style.color = 'var(--ome-accent)'; document.body.appendChild(s); return getComputedStyle(s).color; });
    await expect(page.locator('#preview .sl-s').first()).toHaveCSS('background-color', acc);
    // ตั้งชื่อ + บันทึกอัตโนมัติ
    await page.fill('#deckName', 'ประชุมไตรมาส');
    await expect.poll(async () => (await stored(page))[0] && (await stored(page))[0].name).toBe('ประชุมไตรมาส');
    const rec = (await stored(page))[0];
    expect(rec).toMatchObject({ v: 1, theme: 'accent', outline: OUTLINE });
    expect(rec.images).toEqual({});
    await page.reload();
    await expect(page.locator('#preview .sl-card')).toHaveCount(5);
    expect(await page.inputValue('#deckName')).toBe('ประชุมไตรมาส');
    expect(errors).toEqual([]);
  });

  test('ไม่มีข้อความอธิบายค้างหน้า · AI ซ่อนเมื่อไม่ใช่ pages.dev · ไม่มีการเรียก /api/ocr · slides.js ไม่อ้าง /api/ocr', async ({ page }) => {
    const { errors, ocr } = await openPage(page);
    await expect(page.locator('#aiBtn')).toBeHidden();
    await page.click('#emptyNew');
    expect(await page.locator('.sl-top .page-head').evaluate((e) => e.nextElementSibling.id)).toBe('bar');
    expect(await page.locator('p:not(#msg):not(.dialog-msg)').count()).toBe(1); // เหลือเฉพาะ "ยังไม่มีชุดสไลด์" ใน empty state (ซ่อนอยู่)
    expect(fs.readFileSync(path.join(ROOT, 'slides.js'), 'utf8')).not.toMatch(/api\/ocr|\.ocr\(/);
    expect(ocr).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('มือถือ 390px: ไม่ล้นแนวนอน · สลับแท็บ รายการ/โครงเรื่อง/ตัวอย่าง · ธีมมืด', async ({ page }) => {
    const { errors } = await openPage(page, '/slides.html', { width: 390, theme: 'dark' });
    await page.click('#emptyNew');
    for (const v of ['list', 'outline', 'preview']) {
      await page.click(`#viewTabs [data-view="${v}"]`);
      await expect(page.locator(v === 'list' ? '#listPane' : v === 'outline' ? '#editPane' : '#previewPane')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });

  test('นำเข้าไฟล์ .txt (ไม่มี AI) → โครงเรื่องแบบหยาบต่อท้าย · .docx ผ่าน file-reader', async ({ page }) => {
    const { errors } = await openPage(page);
    await page.click('#emptyNew');
    await page.fill('#outline', '# เดิม\n- หนึ่ง');
    await page.setInputFiles('#importFile', { name: 'บันทึก.txt', mimeType: 'text/plain', buffer: Buffer.from('หัวข้อ A\nข้อ 1\nข้อ 2\n\nหัวข้อ B', 'utf8') });
    await expect(page.locator('#preview .sl-card')).toHaveCount(3);
    expect(await page.inputValue('#outline')).toBe('# เดิม\n- หนึ่ง\n\n# หัวข้อ A\n- ข้อ 1\n- ข้อ 2\n\n# หัวข้อ B');
    // .docx จริง (mammoth จาก tests/node_modules แทน CDN)
    await page.route('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js', (r) => r.fulfill({ path: path.join(__dirname, 'node_modules', 'mammoth', 'mammoth.browser.min.js'), contentType: 'application/javascript' }));
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>สรุปประชุม</w:t></w:r></w:p><w:p><w:r><w:t>ตกลงงบ 5 ล้าน</w:t></w:r></w:p></w:body></w:document>');
    await page.setInputFiles('#importFile', { name: 'm.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await zip.generateAsync({ type: 'nodebuffer' }) });
    await expect.poll(() => page.inputValue('#outline')).toContain('# สรุปประชุม\n\n# ตกลงงบ 5 ล้าน'); // mammoth คืนทีละย่อหน้า → ย่อหน้า = สไลด์
    expect(errors).toEqual([]);
  });
});

test.describe('หน้า slides.html — AI ช่วยร่าง', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  const DRAFT = 'นี่คือโครงเรื่อง\n# สรุปประชุมโครงการ\nไตรมาส 3\n\n# ความคืบหน้า\n* งานโครงสร้างเสร็จ 80%\n* ติดตั้งระบบไฟฟ้าเริ่มแล้ว\n> เน้นเรื่องความปลอดภัย\n\n# ขั้นตอนถัดไป\n- ตรวจรับงานงวดที่ 2';

  test('AI ปลอมคืนโครงเรื่อง → เติมแทนที่/ต่อท้ายได้ · ส่งข้อความสั่ง+ต้นฉบับไป /api/ai/chat เท่านั้น · ไม่มีคำขอ /api/ocr', async ({ page }) => {
    const { errors, ocr } = await openPage(page, '/slides.html', { ai: true });
    const calls = [];
    await page.route('**/api/ai/chat', async (route) => {
      calls.push(JSON.parse(route.request().postData() || '{}'));
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sseBody(DRAFT) });
    });
    await expect(page.locator('#aiBtn')).toBeVisible();
    await page.click('#emptyNew');
    await page.fill('#outline', '# ของเดิม\n- ก');
    await page.click('#aiBtn');
    await expect(page.locator('#aiDlg')).toBeVisible();
    await expect(page.locator('#aiApply')).toBeDisabled();
    await page.fill('#aiSrc', 'ประชุมโครงการไตรมาส 3 งานโครงสร้างเสร็จ 80% เริ่มติดตั้งระบบไฟฟ้า ต้องเน้นความปลอดภัย');
    await page.click('#aiRun');
    await expect(page.locator('#aiApply')).toBeEnabled();
    const out = await page.inputValue('#aiOut');
    expect(out).toBe('# สรุปประชุมโครงการ\nไตรมาส 3\n\n# ความคืบหน้า\n- งานโครงสร้างเสร็จ 80%\n- ติดตั้งระบบไฟฟ้าเริ่มแล้ว\n> เน้นเรื่องความปลอดภัย\n\n# ขั้นตอนถัดไป\n- ตรวจรับงานงวดที่ 2');
    expect(calls).toHaveLength(1);
    expect(calls[0].messages[0].role).toBe('system');
    expect(calls[0].messages[1].content).toContain('งานโครงสร้างเสร็จ 80%');
    expect(calls[0].model).toBe('main');
    // ต่อท้าย
    await page.click('#aiAppend');
    await expect(page.locator('#aiDlg')).toBeHidden();
    expect(await page.inputValue('#outline')).toBe('# ของเดิม\n- ก\n\n' + out);
    await expect(page.locator('#preview .sl-card')).toHaveCount(4);
    // แทนที่ (แก้ผลต่อได้ก่อนใช้)
    await page.click('#aiBtn');
    await page.fill('#aiOut', '# แก้เอง\n- ใหม่');
    await page.click('#aiApply');
    expect(await page.inputValue('#outline')).toBe('# แก้เอง\n- ใหม่');
    await expect(page.locator('#preview .sl-card')).toHaveCount(1);
    await expect.poll(async () => (await stored(page))[0].outline).toBe('# แก้เอง\n- ใหม่');
    expect(ocr).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('AI ใช้ไม่ได้ (โควตาเต็ม/ออฟไลน์) → แจ้งข้อความ ไม่ทับโครงเรื่อง · อ่านไฟล์เข้าช่องต้นฉบับได้', async ({ page }) => {
    const { errors, ocr } = await openPage(page, '/slides.html', { ai: true });
    await page.route('**/api/ai/chat', (route) => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'quota', code: 'quota' }) }));
    await page.click('#emptyNew');
    await page.fill('#outline', '# เดิม');
    await page.click('#aiBtn');
    await page.setInputFiles('#aiFile', { name: 'm.txt', mimeType: 'text/plain', buffer: Buffer.from('รายงานประจำเดือน ยอดเพิ่ม 5%', 'utf8') });
    await expect(page.locator('#aiSrc')).toHaveValue('รายงานประจำเดือน ยอดเพิ่ม 5%');
    await page.click('#aiRun');
    await expect(page.locator('#aiSt')).toContainText('โควตา AI');
    await expect(page.locator('#aiSt')).toHaveClass(/err/);
    await expect(page.locator('#aiApply')).toBeDisabled();
    await page.click('#aiClose');
    expect(await page.inputValue('#outline')).toBe('# เดิม');
    expect(ocr).toEqual([]);
    expect(errors.filter((e) => !/status of 429/.test(e))).toEqual([]); // 429 ที่จำลองขึ้นเองถูกบันทึกเป็น console error ของเบราว์เซอร์
  });
});

test.describe('หน้า slides.html — ส่งออก/นำเสนอ', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('ส่งออก .pptx → แกะด้วย jszip: จำนวนสไลด์ · ข้อความไทยเป็นข้อความแก้ได้ใน XML · โน้ตผู้บรรยาย · ตาราง · ฟอนต์ · ขนาด 16:9', async ({ page }) => {
    const { errors } = await openPage(page);
    await page.click('#newBtn');
    await page.fill('#deckName', 'รายงาน Q3');
    await page.fill('#outline', OUTLINE);
    await expect(page.locator('#preview .sl-card')).toHaveCount(5);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pptxBtn')]);
    expect(await page.evaluate(() => window.__dlName)).toBe('รายงาน Q3.pptx');
    const px = await readPptx(dl);
    expect(px.slides).toHaveLength(5);
    const all = (await Promise.all(px.slides.map(px.xml)));
    // ข้อความอยู่ใน <a:t> (แก้ได้) ไม่ใช่รูป
    expect(all[0]).toContain('<a:t>ประชุมไตรมาส 3</a:t>');
    expect(all[1]).toContain('<a:t>ภาคเหนือโตสูงสุด</a:t>');
    expect(all[1]).toContain('<a:buChar'); // bullet จริง
    expect(all[1]).toMatch(/lvl="1"/); // ระดับย่อย
    expect(all[3]).toContain('<a:tbl>');
    expect(all[3]).toContain('<a:t>ต.ค.</a:t>');
    expect(all[0]).toContain('lang="th-TH"');
    expect(all[0]).toContain('typeface="Tahoma"');
    expect(all.join('')).not.toContain('<p:pic>');
    // โน้ตผู้บรรยาย
    const notes = px.names.filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n));
    expect(notes.length).toBeGreaterThanOrEqual(2);
    const notesXml = (await Promise.all(notes.map(px.xml))).join('');
    expect(notesXml).toContain('สวัสดีครับ ยินดีต้อนรับ');
    expect(notesXml).toContain('พูดถึงภาคเหนือเป็นพิเศษ');
    // 16:9 กว้าง
    const pres = await px.xml('ppt/presentation.xml');
    expect(pres).toMatch(/<p:sldSz cx="12192000" cy="6858000"/);
    expect(errors).toEqual([]);
  });

  test('PDF = โหมดพิมพ์: วาดทุกสไลด์ใน #printArea (16:9) แล้วเรียก print · @page 13.333×7.5in', async ({ page }) => {
    const { errors } = await openPage(page);
    await newDeck(page, OUTLINE);
    await page.click('#pdfBtn');
    await expect.poll(() => page.evaluate(() => window.__prints)).toEqual([5]);
    const hasPage = await page.evaluate(() => [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.constructor.name === 'CSSPageRule' && /13\.333in 7\.5in/.test(r.cssText)); } catch (e) { return false; } }));
    expect(hasPage).toBe(true);
    // ใต้ @media print เห็นเฉพาะสไลด์
    await page.evaluate(() => { document.getElementById('printArea').innerHTML = ''; });
    await page.click('#pdfBtn');
    await page.emulateMedia({ media: 'print' });
    expect(await page.locator('main.page').isVisible()).toBe(false);
    const box = await page.locator('#printArea .sl-s').first().boundingBox();
    expect(Math.round(box.width / box.height * 100)).toBe(178);
    await page.emulateMedia({ media: 'screen' });
    expect(errors).toEqual([]);
  });

  test('โหมดนำเสนอ: ลูกศร/แตะเปลี่ยนสไลด์ · ไม่เกินขอบ · Esc ปิด', async ({ page }) => {
    const { errors } = await openPage(page);
    await newDeck(page, OUTLINE);
    await page.click('#presentBtn');
    await expect(page.locator('#stage')).toBeVisible();
    await expect(page.locator('#stageNum')).toHaveText('1 / 5');
    await expect(page.locator('#stageSlide')).toContainText('ประชุมไตรมาส 3');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#stageNum')).toHaveText('2 / 5');
    await expect(page.locator('#stageSlide')).toContainText('กำไรเพิ่มขึ้น');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#stageNum')).toHaveText('1 / 5');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#stageNum')).toHaveText('1 / 5'); // ไม่ต่ำกว่าสไลด์แรก
    await page.keyboard.press('End');
    await expect(page.locator('#stageNum')).toHaveText('5 / 5');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#stageNum')).toHaveText('5 / 5');
    // แตะ: ซ้ายถอย ขวาไป
    const vp = page.viewportSize();
    await page.mouse.click(vp.width * 0.1, vp.height / 2);
    await expect(page.locator('#stageNum')).toHaveText('4 / 5');
    await page.mouse.click(vp.width * 0.9, vp.height / 2);
    await expect(page.locator('#stageNum')).toHaveText('5 / 5');
    const sb = await page.locator('#stageSlide .sl-s').boundingBox();
    expect(sb.width).toBeLessThanOrEqual(vp.width + 1); expect(sb.height).toBeLessThanOrEqual(vp.height + 1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#stage')).toBeHidden();
    expect(errors).toEqual([]);
  });
});

test.describe('หน้า slides.html — รูปใน R2 / หลายชุด / ซิงก์ / ออฟไลน์', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });
  const r2 = async (page) => (await (await page.request.get(SRV + '/__files')).json());

  test('แทรกรูป → ย่อ → อัปโหลด ns=slides → ref ในชุด (ไม่มีไบนารี) → ส่งออก pptx มีรูป → ทำซ้ำชุดแบ่งรูป → ลบชุดเรียก DELETE เฉพาะรูปที่ไม่มีชุดอื่นใช้', async ({ page }) => {
    const { errors } = await openPage(page, '/slides.html', { files: true });
    const posts = [], dels = [];
    page.on('request', (r) => {
      if (/\/api\/files/.test(r.url()) && r.method() === 'POST') posts.push(r.url());
      if (/\/api\/files/.test(r.url()) && r.method() === 'DELETE') dels.push(r.url());
    });
    await newDeck(page, '# หน้าปก\n\n# มีรูป\n- ข้อความข้างรูป');
    await attachImage(page, 1, await pngBuf(page));
    await expect.poll(async () => (await stored(page))[0] && Object.values((await stored(page))[0].images)[0] && Object.values((await stored(page))[0].images)[0].id).toBeTruthy();
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatch(/ns=slides&ref=/);
    const rec = (await stored(page))[0];
    const [key, im] = Object.entries(rec.images)[0];
    expect(im).toMatchObject({ name: 'photo.jpg', mime: 'image/jpeg' });
    expect(im.pending).toBeUndefined();
    expect(im.w).toBe(64); expect(im.h).toBe(40);
    expect(JSON.stringify(rec)).not.toMatch(/base64|blob:/);
    expect(rec.outline).toContain('@image ' + key);
    expect((await r2(page)).length).toBe(1);
    expect((await r2(page))[0]).toMatch(/^slides\//);
    // แบบรูป + ข้อความ เลือกอัตโนมัติ และตัวอย่างมี <img> ชี้ไฟล์ใน R2
    await expect(page.locator('#preview select[data-act="layout"]').nth(1).locator('option:checked')).toHaveText('อัตโนมัติ · รูป + ข้อความ');
    await expect(page.locator('#preview .sl-card').nth(1).locator('.sl-img img')).toHaveAttribute('src', '/api/files?id=' + encodeURIComponent(im.id));
    // ส่งออก pptx มีรูป (ดึงจาก R2) และอยู่ในกรอบรูปด้านขวา
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pptxBtn')]);
    const px = await readPptx(dl);
    expect(px.names.some((n) => /^ppt\/media\/.+\.(jpe?g)$/.test(n))).toBe(true);
    const x1 = await px.xml(px.slides[1]);
    expect(x1).toContain('<p:pic>');
    expect(x1).toContain('<a:t>ข้อความข้างรูป</a:t>');
    // ทำซ้ำ → รูปใช้ร่วม
    await page.locator('#decks .sl-deck.on [data-act="dup"]').click();
    await expect(page.locator('#decks .sl-deck')).toHaveCount(2);
    await expect(page.locator('#deckName')).toHaveValue(/\(สำเนา\)/);
    await expect.poll(async () => (await stored(page)).length).toBe(2);
    const decks = await stored(page);
    expect(decks.map((d) => Object.values(d.images)[0].id)).toEqual([im.id, im.id]);
    // ลบสำเนา: รูปยังมีชุดเดิมใช้ → ไม่ DELETE
    await page.locator('#decks .sl-deck.on [data-act="del"]').click();
    await page.locator('dialog .btn.danger').click();
    await expect(page.locator('#decks .sl-deck')).toHaveCount(1);
    expect(dels).toHaveLength(0);
    expect((await r2(page)).length).toBe(1);
    // ลบชุดสุดท้าย → DELETE รูปใน R2
    await page.locator('#decks .sl-deck [data-act="del"]').click();
    await page.locator('dialog .btn.danger').click();
    await expect(page.locator('#decks .sl-deck')).toHaveCount(0);
    await expect.poll(async () => (await r2(page)).length).toBe(0);
    expect(dels).toHaveLength(1);
    expect(dels[0]).toContain(encodeURIComponent(im.id));
    expect(await stored(page)).toHaveLength(0);
    expect(errors).toEqual([]);
  });

  test('เอารูปออกจากสไลด์ = ลบ @image + DELETE ไฟล์ · ค้นหา/สลับชุด', async ({ page }) => {
    const { errors } = await openPage(page, '/slides.html', { files: true });
    await newDeck(page, '# ก\n- x');
    await page.fill('#deckName', 'ชุดแรก');
    await attachImage(page, 0, await pngBuf(page), 'p.png');
    await expect.poll(async () => (await r2(page)).length).toBe(1);
    await expect(page.locator('#preview [data-act="noimg"]')).toBeVisible();
    await page.click('#preview [data-act="noimg"]');
    await expect.poll(async () => (await r2(page)).length).toBe(0);
    expect(await page.inputValue('#outline')).not.toContain('@image');
    expect(Object.keys((await stored(page))[0].images)).toHaveLength(0);
    // หลายชุด + ค้นหา
    await page.click('#newBtn'); await page.fill('#deckName', 'รายงานการเงิน'); await page.fill('#outline', '# ภาษี');
    await expect(page.locator('#decks .sl-deck')).toHaveCount(2);
    await page.fill('#deckQ', 'ภาษี');
    await expect(page.locator('#decks .sl-deck')).toHaveCount(1);
    await page.fill('#deckQ', 'ชุดแรก');
    await expect(page.locator('#decks .sl-deck')).toHaveCount(1);
    await page.fill('#deckQ', '');
    await page.locator('#decks .sl-deck', { hasText: 'ชุดแรก' }).locator('.pick').click();
    await expect(page.locator('#deckName')).toHaveValue('ชุดแรก');
    expect(await page.inputValue('#outline')).toBe('# ก\n- x');
    expect(errors).toEqual([]);
  });

  test('ซิงก์ 2 เครื่อง: ชุดที่ A สร้างไปโผล่ที่ B · แก้โครงเรื่องแล้วอีกเครื่องเห็น · ไม่เก็บไบนารีใน row', async ({ browser }) => {
    const mk = async () => {
      const ctx = await browser.newContext({ baseURL: SRV });
      const page = await ctx.newPage();
      const o = await openPage(page, '/slides.html', { sync: true, files: true });
      return { ctx, page, errors: o.errors };
    };
    const A = await mk(), B = await mk();
    const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));
    await A.page.click('#newBtn'); await A.page.fill('#deckName', 'ชุด A'); await A.page.fill('#outline', '# จาก A\n- ข้อ 1');
    await B.page.click('#newBtn'); await B.page.fill('#deckName', 'ชุด B'); await B.page.fill('#outline', '# จาก B');
    await expect.poll(async () => (await stored(A.page))[0].outline).toBe('# จาก A\n- ข้อ 1');
    await expect.poll(async () => (await stored(B.page))[0].outline).toBe('# จาก B');
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    for (const d of [A, B]) {
      const decks = await stored(d.page);
      expect(decks.map((x) => x.name).sort()).toEqual(['ชุด A', 'ชุด B']);
      expect(new Set(decks.map((x) => x.id)).size).toBe(2);
    }
    await expect(A.page.locator('#decks .sl-deck')).toHaveCount(2); // วาดรายการใหม่เอง
    await B.page.locator('#decks .sl-deck', { hasText: 'ชุด A' }).locator('.pick').click();
    await expect(B.page.locator('#outline')).toHaveValue('# จาก A\n- ข้อ 1');
    await expect(B.page.locator('#preview .sl-card')).toHaveCount(1);
    // B แก้ชุด A → A เห็น (A ไม่ได้พิมพ์อยู่)
    await B.page.fill('#outline', '# จาก A\n- ข้อ 1\n- ข้อ B เพิ่ม');
    await expect.poll(async () => (await stored(B.page)).find((x) => x.name === 'ชุด A').outline).toContain('ข้อ B เพิ่ม');
    for (let i = 0; i < 2; i++) { await sync(B.page); await sync(A.page); }
    await expect(A.page.locator('#outline')).toHaveValue('# จาก A\n- ข้อ 1\n- ข้อ B เพิ่ม');
    for (const d of [A, B]) { expect(d.errors).toEqual([]); await d.ctx.close(); }
  });

  test('ออฟไลน์: เปิดหน้า/แทรกรูปในเครื่อง/ส่งออก pptx ได้ (PptxGenJS อยู่ใน vendor/) · รูปค้างใน outbox ไม่มี ref ใน R2', async ({ page, context }) => {
    const { errors } = await openPage(page); // ไม่มี TANOT_FILES = ไม่ใช่ pages.dev → ไม่อัปโหลด รูปอยู่ในเครื่อง
    await newDeck(page, '# ปก\nย่อย\n\n# รูปในเครื่อง\n- ข้อความ');
    // อุ่นสคริปต์ส่งออกก่อนตัดเน็ต (ที่แคชของเบราว์เซอร์/Service Worker จริงทำให้) แล้วตัดเน็ตทั้งหมด
    await page.evaluate(() => new Promise((res, rej) => { const e = document.createElement('script'); e.src = 'vendor/pptxgenjs/pptxgen.bundle.js'; e.onload = res; e.onerror = rej; document.head.appendChild(e); }));
    await context.setOffline(true);
    await attachImage(page, 1, await pngBuf(page), 'local.png');
    await expect.poll(async () => Object.keys((await stored(page))[0].images).length).toBe(1);
    const rec = (await stored(page))[0];
    const im = Object.values(rec.images)[0];
    expect(im.pending).toBe(true); expect(im.id).toBeUndefined();
    await expect(page.locator('#preview .sl-card').nth(1).locator('.sl-img img')).toHaveAttribute('src', /^blob:/);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pptxBtn')]);
    const px = await readPptx(dl);
    expect(px.slides).toHaveLength(2);
    expect(px.names.some((n) => /^ppt\/media\//.test(n))).toBe(true);
    expect(await px.xml(px.slides[1])).toContain('<a:t>ข้อความ</a:t>');
    await context.setOffline(false);
    expect((await r2(page)).length).toBe(0);
    expect(errors).toEqual([]);
  });

  test('ไฟล์ของแอปพร้อมใช้ออฟไลน์: sw.js PRECACHE มี slides + PptxGenJS ที่ pin เวอร์ชัน · credits · เมนู · ns slides', async () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    for (const f of ['./slides.html', './slides.js', './slides-calc.js', './vendor/pptxgenjs/pptxgen.bundle.js']) {
      expect(sw).toContain("'" + f + "'");
      expect(fs.existsSync(path.join(ROOT, f))).toBe(true);
    }
    expect(fs.readFileSync(path.join(ROOT, 'vendor/pptxgenjs/pptxgen.bundle.js'), 'utf8').slice(0, 80)).toContain('PptxGenJS 3.12.0');
    expect(fs.readFileSync(path.join(ROOT, 'credits.html'), 'utf8')).toContain('PptxGenJS');
    const shell = fs.readFileSync(path.join(ROOT, 'shell.js'), 'utf8');
    expect(shell).toMatch(/key: 'powerpoint'.*href: 'slides\.html'/);
    expect(shell).not.toMatch(/key: 'powerpoint'.*status: 'soon'/);
    expect(fs.readFileSync(path.join(ROOT, 'functions/api/files.js'), 'utf8')).toMatch(/NAMESPACES = \[[^\]]*'slides'/);
    expect(fs.readFileSync(path.join(ROOT, 'data-registry.js'), 'utf8')).toMatch(/tanot:slides:decks'.*mode: 'list', idField: 'id'/);
  });

  test('POST /api/files?ns=slides รับรูป · ns อื่นที่ไม่รู้จักถูกปฏิเสธ', async ({ request }) => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const ok = await request.post(SRV + '/api/files?ns=slides&ref=d1|k1&name=a.png', { headers: { 'Content-Type': 'image/png' }, data: png });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).mime).toBe('image/png');
    const bad = await request.post(SRV + '/api/files?ns=slidez&ref=x&name=a.png', { headers: { 'Content-Type': 'image/png' }, data: png });
    expect(bad.status()).toBe(400);
  });
});
