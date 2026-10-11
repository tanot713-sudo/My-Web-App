// หนังสือเสียงคุณภาพสูง (F5-TTS-THAI บน Google Colab) — tools/colab/ + การ์ดในหน้า text-to-speech
// A) notebook สร้างจาก .py ตรงทุกตัวอักษร + known-answer ของ TanotTtsLong.f5Estimate (Node require)
// B) การ์ดในหน้าจริง: ซ่อน/แสดงส่วนประเมิน · ตัวเลข · จำนวนตอน · ปุ่ม .txt (Playwright download) · ลิงก์ Colab · ไทย/อังกฤษ + สลับสด · 360px ไม่ล้น
// ข้อความตัวอย่างทุกชุดแต่งขึ้นเอง — ห้ามใช้ข้อความนิยายจริงของเจ้าของ
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const N = require('../tts-normalize.js');
const L = require('../tts-long.js');
const NB = require('../tools/colab/build-notebook.js');

const COLAB = 'https://colab.research.google.com/github/tanot713-sudo/My-Web-App/blob/main/tools/colab/tanot-audiobook-f5.ipynb';
const SENT = 'เขาเดินไปตามถนนสายเล็กแล้วหยุดมองท้องฟ้า'; // 40 ตัวอักษร ไทยล้วน ไม่มีตัวเลข/ำ → แปลงแล้วยาวเท่าเดิม

/* ═══════════════ A) notebook + ตรรกะล้วน ═══════════════ */
test.describe('A) tools/colab', () => {
  test('.ipynb เป็น JSON ถูกต้อง · cell โค้ดเดียว = .py ทุกตัวอักษร · ไม่มี output · GPU L4 · สร้างใหม่แล้วได้ไฟล์เดิม', () => {
    const py = fs.readFileSync(NB.PY, 'utf8');
    const raw = fs.readFileSync(NB.NB, 'utf8');
    const nb = JSON.parse(raw);
    expect(nb.nbformat).toBe(4);
    expect(nb.metadata.accelerator).toBe('GPU');
    expect(nb.metadata.colab.gpuType).toBe('L4');
    expect(nb.cells.map((c) => c.cell_type)).toEqual(['markdown', 'code']);
    const code = nb.cells.filter((c) => c.cell_type === 'code');
    expect(code).toHaveLength(1);
    expect(code[0].source.join('')).toBe(py);
    expect(code[0].outputs).toEqual([]);
    expect(code[0].execution_count).toBeNull();
    expect(nb.cells[0].source.join('')).toMatch(/L4/);
    // กันลืมรัน build-notebook.js หลังแก้ .py (รวมการเปลี่ยนเฉพาะ markdown/metadata ในสคริปต์สร้าง)
    expect(raw).toBe(NB.build(py));
  });

  test('ไฟล์ใน tools/colab ไม่มีเสียง/token · สคริปต์ดึง tts-normalize.js/tts-long.js จาก main ของ repo นี้', () => {
    const dir = path.dirname(NB.PY);
    expect(fs.readdirSync(dir).filter((f) => /\.(wav|mp3|m4a|ogg|flac)$/i.test(f))).toEqual([]);
    const py = fs.readFileSync(NB.PY, 'utf8');
    expect(py).toContain('https://raw.githubusercontent.com/tanot713-sudo/My-Web-App/main/');
    expect(py).toContain('"tts-normalize.js", "tts-long.js"');
    expect(py).not.toMatch(/hf_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}/);
    expect(fs.readFileSync(path.join(dir, 'README.md'), 'utf8')).toContain(COLAB);
  });

  test('f5Estimate: known-answer — ตัวอักษร ÷ 13.5 = วินาทีเสียง · ÷ 3.7 = เวลาสร้าง · ไม่มีหัวตอน = 1 ส่วน', () => {
    expect(L.F5_CHARS_PER_SEC).toBe(13.5);
    expect(L.F5_L4_SPEED).toBe(3.7);
    const text = Array.from({ length: 27 }, () => SENT).join('\n\n'); // 27 × 40 = 1,080 ตัวอักษร
    const e = L.f5Estimate(text, N);
    expect(e).toMatchObject({ chars: 1080, parts: 1, chapters: false });
    expect(e.audioSec).toBeCloseTo(80, 6);
    expect(e.genSec).toBeCloseTo(80 / 3.7, 6);
    expect(L.f5Estimate('', N)).toMatchObject({ chars: 0, parts: 0 });
    expect(L.f5Estimate('   \n😀\n', N).chars).toBe(0);
  });

  test('f5Estimate: แปลงก่อนนับ (ตัวเลขเป็นคำ) · ํา นับเป็น ำ ตัวเดียวแบบเดียวกับสคริปต์ Colab', () => {
    expect(L.f5Estimate('ราคา 5 บาท', N).chars).toBe(N.plan('ราคา 5 บาท', { max: 100 }).chunks.join('').length);
    expect(L.f5Estimate('ทำงาน', N).chars).toBe(5); // forMms แตก ำ เป็น ํา (6 ตัว) — F5 ใช้ ำ
  });

  test('f5Estimate: มีหัวตอน = จำนวนตอน (ข้อความก่อนตอนแรกเป็นส่วน 000) · ไม่มีหัวตอน = ตัดทุก 25,000 ตัวอักษรที่ขอบย่อหน้า', () => {
    const ch = (n) => n + '. ตอนที่ ' + n + '\n\n' + SENT + '\n\n' + SENT;
    expect(L.f5Estimate([1, 2, 3].map(ch).join('\n\n'), N)).toMatchObject({ parts: 3, chapters: true });
    expect(L.f5Estimate(SENT + '\n\n' + [1, 2].map(ch).join('\n\n'), N)).toMatchObject({ parts: 3, chapters: true });
    // 1,300 ย่อหน้า × 40 = 52,000 ตัวอักษร → ส่วนละ 25,000 (625 ย่อหน้า) → 3 ส่วน (25,000 / 25,000 / 2,000)
    const long = Array.from({ length: 1300 }, () => SENT).join('\n\n');
    expect(L.f5Estimate(long, N)).toMatchObject({ chars: 52000, parts: 3, chapters: false });
    // ย่อหน้าเดียวยาวมาก (ไม่มีขอบย่อหน้า) = ไม่ตัด
    expect(L.f5Estimate(Array.from({ length: 1300 }, () => SENT).join(' '), N).parts).toBe(1);
  });
});

/* ═══════════════ B) การ์ดในหน้า text-to-speech ═══════════════ */
async function setup(context, page, lang) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  const outside = [];
  await context.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return r.continue();
    outside.push(u.hostname);
    return r.abort('internetdisconnected');
  });
  await page.addInitScript(() => { window.__dlNames = []; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.hasAttribute('download')) window.__dlNames.push(this.download); return c.call(this); }; });
  await page.addInitScript((l) => { try { localStorage.setItem('ome:theme', 'light'); if (l) localStorage.setItem('ome:lang', l); } catch (e) {} }, lang || '');
  return { errors, outside };
}
const fillText = (page, v) => page.locator('#ttsText').fill(v);

test.describe('B) การ์ดหนังสือเสียงคุณภาพสูง', () => {
  test('ค่าเริ่มต้นพับ · ลิงก์ Colab ถูก (แท็บใหม่ noopener) · ข้อความว่าง = ซ่อนส่วนประเมิน · พิมพ์แล้วแสดงตัวเลขถูก · ล้างแล้วซ่อน', async ({ context, page }) => {
    const { errors } = await setup(context, page);
    await page.goto('/text-to-speech.html');
    await expect(page.locator('#f5Box')).not.toHaveAttribute('open', /.*/);
    const link = page.locator('#f5ColabLink');
    await expect(link).toHaveAttribute('href', COLAB);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await page.click('#f5Box > summary');
    await expect(page.locator('#f5Est')).toBeHidden();
    // 27 ย่อหน้า × 40 = 1,080 ตัวอักษร → 80 วิเสียง = ~1 นาที · สร้าง 21.6 วิ = ~1 นาที (ขั้นต่ำ 1 นาที)
    await fillText(page, Array.from({ length: 27 }, () => SENT).join('\n\n'));
    await expect(page.locator('#f5Est')).toBeVisible();
    await expect(page.locator('#f5EstChars')).toHaveText('1,080');
    await expect(page.locator('#f5EstAudio')).toHaveText('~1 นาที');
    await expect(page.locator('#f5EstGen')).toHaveText('~1 นาที');
    await expect(page.locator('#f5EstParts')).toHaveText('1');
    await expect(page.locator('#f5EstPartsK')).toContainText('ไม่พบหัวตอน');
    await fillText(page, '');
    await expect(page.locator('#f5Est')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('ข้อความยาว: ชั่วโมง/นาที · มีหัวตอน = จำนวนตอน · คำนวณตอนกางกล่อง (ไม่คำนวณตอนพับ)', async ({ context, page }) => {
    const { errors } = await setup(context, page);
    await page.goto('/text-to-speech.html');
    // 3 ตอน × 1,350 ย่อหน้า × 40 + หัวตอน → ~162,000 ตัวอักษร ≈ 3 ชม. 20 นาที เสียง, ≈ 54 นาทีบน L4
    const body = Array.from({ length: 1350 }, () => SENT).join('\n\n');
    const text = [1, 2, 3].map((n) => n + '. ตอนที่ ' + n + '\n\n' + body).join('\n\n');
    await page.evaluate((t) => { document.getElementById('ttsText').value = t; document.getElementById('ttsText').dispatchEvent(new Event('input')); }, text);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.__tts.f5Estimate())).toBeNull(); // พับอยู่ = ไม่คำนวณ
    await page.click('#f5Box > summary');
    const want = L.f5Estimate(text, N);
    expect(want.parts).toBe(3);
    const fmt = (sec) => { const m = Math.max(1, Math.round(sec / 60)), h = Math.floor(m / 60); return m < 60 ? '~' + m + ' นาที' : (m % 60 ? '~' + h + ' ชม. ' + (m % 60) + ' นาที' : '~' + h + ' ชม.'); };
    await expect(page.locator('#f5EstChars')).toHaveText(want.chars.toLocaleString('en-US'));
    await expect(page.locator('#f5EstAudio')).toHaveText(fmt(want.audioSec));
    await expect(page.locator('#f5EstAudio')).toContainText('ชม.');
    await expect(page.locator('#f5EstGen')).toHaveText(fmt(want.genSec));
    await expect(page.locator('#f5EstParts')).toHaveText('3');
    await expect(page.locator('#f5EstPartsK')).toHaveText('จำนวนตอน');
    expect(errors).toEqual([]);
  });

  test('ปุ่ม .txt: ดาวน์โหลดเนื้อหาในกล่องตรงทุกตัวอักษร (UTF-8) · ชื่อ tanot-text.txt · แนบไฟล์มา = ใช้ชื่อไฟล์นั้น · ไม่มีคำขอออกนอกเครื่อง', async ({ context, page }) => {
    const { errors, outside } = await setup(context, page);
    await page.goto('/text-to-speech.html');
    await page.click('#f5Box > summary');
    await page.click('#f5TxtBtn');
    await expect(page.locator('#f5Status')).toHaveClass(/err/); // ว่าง = ไม่ดาวน์โหลด
    const text = '1. ตอนแรก\n\nสวัสดีครับ ราคา 1,250 บาท "quote" emoji 😀\nบรรทัดสอง';
    await fillText(page, text);
    let [dl] = await Promise.all([page.waitForEvent('download'), page.click('#f5TxtBtn')]);
    expect(dl.suggestedFilename()).toBe('tanot-text.txt');
    expect(fs.readFileSync(await dl.path(), 'utf8')).toBe(text);
    await expect(page.locator('#f5Status')).toHaveClass(/ok/);
    // แนบไฟล์ → ชื่อไฟล์เดิม เปลี่ยนนามสกุลเป็น .txt
    await page.setInputFiles('#importFileInput', { name: 'เรื่องสั้น ทดสอบ.txt', mimeType: 'text/plain', buffer: Buffer.from('ข้อความจากไฟล์ที่แนบ\n\nย่อหน้าที่สอง', 'utf8') });
    await expect(page.locator('#importStatus')).toHaveClass(/ok/);
    [dl] = await Promise.all([page.waitForEvent('download'), page.click('#f5TxtBtn')]);
    // ชื่อที่หน้าตั้ง (a.download) — Chromium คืน "download" แทนชื่อไทยเมื่อ locale ของเครื่องไม่ใช่ UTF-8 จึงตรวจทั้งสองทาง
    expect(await page.evaluate(() => window.__dlNames.slice(-1)[0])).toBe('เรื่องสั้น ทดสอบ.txt');
    if (dl.suggestedFilename() !== 'download') expect(dl.suggestedFilename()).toBe('เรื่องสั้น ทดสอบ.txt');
    expect(fs.readFileSync(await dl.path(), 'utf8')).toBe('ข้อความจากไฟล์ที่แนบ\n\nย่อหน้าที่สอง');
    await expect(page.locator('#f5Est')).toBeVisible(); // นำเข้าไฟล์ → ประเมินใหม่ (กางกล่องอยู่)
    expect(outside.filter((h) => !/jsdelivr|googleapis|gstatic/.test(h))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('อังกฤษ: ป้าย/ขั้นตอน/ตัวเลขเป็นอังกฤษ ไม่มีไทยหลุด (ยกเว้นชื่อโฟลเดอร์ใน Drive) · สลับ en→th สดไม่ต้องโหลดใหม่', async ({ context, page }) => {
    const { errors } = await setup(context, page, 'en');
    await page.goto('/text-to-speech.html');
    await page.click('#f5Box > summary');
    await fillText(page, Array.from({ length: 27 }, () => SENT).join('\n\n'));
    await expect(page.locator('#f5EstAudio')).toHaveText('~1 min');
    await expect(page.locator('#f5Card h2')).toContainText('High-quality audiobook (Google Colab)');
    await expect(page.locator('#f5EstPartsK')).toContainText('no chapter headings');
    const thai = await page.evaluate(() => {
      const out = [], w = document.createTreeWalker(document.getElementById('f5Card'), NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) if (/[ก-๛]/.test(n.nodeValue) && !n.parentElement.closest('[data-i18n-skip]')) out.push(n.nodeValue.trim());
      return out;
    });
    expect(thai).toEqual([]);
    await page.evaluate(() => OME_LANG.set('th'));
    await expect(page.locator('#f5EstAudio')).toHaveText('~1 นาที');
    await expect(page.locator('#f5EstPartsK')).toContainText('ไม่พบหัวตอน');
    await expect(page.locator('#f5Card h2')).toContainText('หนังสือเสียงคุณภาพสูง');
    expect(errors).toEqual([]);
  });

  for (const w of [360, 390]) {
    test(`มือถือ ${w}px: การ์ดกางแล้วไม่ล้นจอ`, async ({ context, page }) => {
      const { errors } = await setup(context, page);
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto('/text-to-speech.html');
      await page.click('#f5Box > summary');
      await fillText(page, '1. ตอนแรก\n\n' + Array.from({ length: 30 }, () => SENT).join('\n\n'));
      await expect(page.locator('#f5Est')).toBeVisible();
      const over = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth, bad = [];
        if (document.documentElement.scrollWidth > vw + 1) bad.push('page ' + document.documentElement.scrollWidth);
        document.querySelectorAll('#f5Card, #f5Card *').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width && r.right > vw + 1) bad.push(el.id || el.className || el.tagName); });
        return bad;
      });
      expect(over).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
});
