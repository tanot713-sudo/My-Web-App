// @ts-check
// ภาษา E1 (ROADMAP แถว 33): ประโยคสำเร็จรูปสำหรับงาน 10 หมวด ใน lang-data ของ lang-en
// คีย์ SRS/progress/wrong ของวลี = `${langId}::${หมวด}::${idx}` → หมวด/ประโยคเดิมต้องไม่เปลี่ยน (เทียบ fixture จาก main)
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, prepare } = require('./helpers');

const ORIGINAL = require('./fixtures/lang-en-phrases-original.json');
const WORK_CATS = [
  'งาน: ประชุมหน้างาน',
  'งาน: แจ้งเหตุขัดข้องและสถานะงานซ่อม',
  'งาน: ผู้รับเหมาและการตรวจรับงาน',
  'งาน: ความปลอดภัย (PTW, LOTO)',
  'งาน: อีเมลและรายงาน',
  'งาน: ประเมินราคาและใบเสนอราคา',
  'งาน: เงื่อนไขสัญญา',
  'งาน: นำเสนอลูกค้าและผู้บริหาร',
  'งาน: ขายและพรีเซลส์',
  'งาน: สัมภาษณ์งานตำแหน่งวิศวกร',
];
// ชื่อหน่วยงาน/บริษัท/มาตรฐานจริง และชื่อคน — ข้อมูลเป็นสถานการณ์สมมุติเท่านั้น (repo public)
const STOP = [/\bFIDIC\b/i, /\bPTT\b/, /\bEGAT\b/i, /\bSCG\b/, /\bMEA\b/, /\bPEA\b/, /กฟผ|กฟน|กฟภ|ปตท|การไฟฟ้า|การประปา/,
  /\b(Siemens|ABB|Schneider|Toyota|Honda|Samsung|Google|Microsoft|Amazon|Shell|Chevron)\b/i,
  /\b(Mr|Mrs|Ms|Dr)\.?\s+[A-Z]/, /\b(John|Mary|David|Somchai|Somsak|Anan|Malee|Tom|Sarah|Peter|Michael)\b/];

function langData() {
  const h = fs.readFileSync(path.join(ROOT, 'languages.html'), 'utf8');
  const m = h.match(/<script id="lang-data" type="application\/json">([\s\S]*?)<\/script>/);
  return JSON.parse(m[1]);
}

test.describe('lang-data (ข้อมูล)', () => {
  const en = langData()['lang-en'];

  test('8 หมวดเดิม: ชื่อ ลำดับ และทุกประโยคไม่เปลี่ยน · หมวดงานต่อท้าย', () => {
    const keys = Object.keys(en.phrases);
    const orig = Object.keys(ORIGINAL);
    expect(orig.length).toBe(8);
    expect(keys.slice(0, orig.length)).toEqual(orig);
    orig.forEach((k) => expect(en.phrases[k]).toEqual(ORIGINAL[k]));
    expect(keys.slice(orig.length)).toEqual(WORK_CATS);
  });

  test('10 หมวด × 20–30 ประโยค · ทุกประโยคมี target/thai · ไม่ซ้ำ · note สั้น', () => {
    const seen = new Set();
    WORK_CATS.forEach((c) => {
      const rows = en.phrases[c];
      expect(rows.length, c).toBeGreaterThanOrEqual(20);
      expect(rows.length, c).toBeLessThanOrEqual(30);
      rows.forEach((r) => {
        expect(Object.keys(r).every((k) => ['target', 'thai', 'note'].includes(k))).toBe(true);
        expect(typeof r.target === 'string' && r.target.trim().length > 3).toBe(true);
        expect(r.target).toBe(r.target.trim());
        expect(/[A-Za-z]/.test(r.target)).toBe(true);
        expect(/[ก-๙]/.test(r.target), r.target).toBe(false);
        expect(typeof r.thai === 'string' && /[ก-๙]/.test(r.thai), r.target).toBe(true);
        if ('note' in r) expect(r.note.length, r.target).toBeLessThanOrEqual(120);
        expect(seen.has(r.target.toLowerCase()), r.target).toBe(false);
        seen.add(r.target.toLowerCase());
      });
    });
  });

  test('stop-list: ไม่มีชื่อหน่วยงาน/บริษัท/คนจริง', () => {
    WORK_CATS.forEach((c) => en.phrases[c].forEach((r) => {
      const text = [r.target, r.thai, r.note || ''].join(' ');
      STOP.forEach((re) => expect(re.test(text), `${re} ใน "${r.target}"`).toBe(false));
    }));
  });

  test('ภาษาอื่นไม่ถูกแตะ (ไม่มีหมวดงาน)', () => {
    const d = langData();
    Object.keys(d).filter((id) => id !== 'lang-en').forEach((id) => {
      expect(Object.keys(d[id].phrases).some((k) => k.startsWith('งาน: ')), id).toBe(false);
    });
  });
});

// ── หน้าจริง ──
async function openPractice(page) {
  await page.goto('/languages.html#lang-en');
  await expect(page.locator('[data-k="workCategory"]')).toHaveCount(10);
}

test('หน้า: กลุ่ม "งาน" แยกจากหมวดเดิม → ฟังแล้วพิมพ์ในหมวดงาน → บันทึก progress ด้วยคีย์หมวดงาน', async ({ page }) => {
  const errors = await prepare(page);
  const apiReqs = [];
  page.on('request', (r) => { if (/\/api\/ocr/.test(r.url())) apiReqs.push(r.url()); });
  await openPractice(page);
  await expect(page.locator('[data-k="category"]')).toHaveCount(8);
  await expect(page.locator('#workCatHead')).toHaveText('งาน');
  const chip = page.locator('[data-k="workCategory"]').filter({ hasText: 'เงื่อนไขสัญญา' });
  await expect(chip).toHaveText('เงื่อนไขสัญญา');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  const first = langData()['lang-en'].phrases['งาน: เงื่อนไขสัญญา'][0];
  await expect(page.getByText(first.target, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(first.note, { exact: true }).first()).toBeVisible();

  await page.click('[data-k="mode-dictation"]');
  await page.fill('[data-k="answer"]', first.target);
  await page.click('[data-k="check"]');
  await expect(page.locator('[data-k="next"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('lang-practice:progress') || '{}');
    return (p['lang-en:งาน: เงื่อนไขสัญญา'] || [])[0] || false;
  })).toBeTruthy();

  // ผิด → คิวคำที่ผิดใช้คีย์ `${langId}::${หมวด}::${idx}`
  await page.click('[data-k="next"]');
  await page.fill('[data-k="answer"]', 'zzz');
  await page.click('[data-k="check"]');
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('lang-practice:wrong') || '{}'))))
    .toContain('lang-en::งาน: เงื่อนไขสัญญา::1');
  expect(apiReqs).toEqual([]);
  expect(errors).toEqual([]);
});

test('หน้า: พูดตามเลือกหมวดงานได้ (ประโยคแรกของหมวด)', async ({ page }) => {
  const errors = await prepare(page);
  await page.goto('/languages.html#lang-en');
  await page.click('[data-k="tab-listen"]');
  await page.click('[data-k="lsub-shadowing"]');
  const sel = page.locator('[data-k="shCat"]');
  await expect(sel.locator('option')).toHaveCount(1 + 8 + 10);
  await sel.selectOption('งาน: ความปลอดภัย (PTW, LOTO)');
  const rows = langData()['lang-en'].phrases['งาน: ความปลอดภัย (PTW, LOTO)'];
  await expect(page.getByText(rows[0].target, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ประโยคต่อไป' }).click();
  await expect(page.getByText(rows[1].target, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('หน้า: ภาษาอังกฤษของ UI แสดงชื่อกลุ่ม/หมวดงานเป็นอังกฤษ', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('ome:lang', 'en'); } catch (e) {} });
  const errors = await prepare(page);
  await openPractice(page);
  await expect(page.locator('#workCatHead')).toHaveText('Work');
  await expect(page.locator('[data-k="workCategory"]').first()).toHaveText('Site meetings');
  const texts = await page.locator('[data-k="workCategory"]').allTextContents();
  texts.forEach((t) => expect(/[ก-๙]/.test(t), t).toBe(false));
  expect(errors).toEqual([]);
});
