// @ts-check
// ตัวตรวจธีม + ภาษา แบบ runtime (งานแก้ธีม รอบ 1) — ทุกหน้าในเมนู ด้วย storage จำลอง + ปิดเน็ตแบบ smoke.spec.js
//   ต่อหน้า × 390/1100 × สว่าง/มืด:
//     axe            — axe-core เฉพาะกฎ color-contrast (จำนวน node ที่ไม่ผ่าน)
//     contrast       — ตัวอักษรบนปุ่ม/แท็บ/ช่องกรอกที่มองเห็น ≥ 4.5:1 (ตัวใหญ่ ≥ 3:1)
//     controlBorder  — ขอบ input/select/ปุ่ม outline/segmented ≥ 3:1 กับพื้นข้างๆ (WCAG 1.4.11)
//     nonCentral     — ปุ่ม/ช่องกรอกที่ไม่ได้ใช้คอมโพเนนต์กลาง (.btn/.tab/.chip/.field … ใน theme.css)
//     targetSize     — (390px) เป้ากด < 40px
//     มือถือ (รอบ 3; ที่ 390 ทุกหน้า + 360 เฉพาะหน้าที่แก้ในรอบนั้น = NARROW_360 ด้านล่าง; นิยามอยู่หัวส่วน "กฎตรวจมือถือ" ใน theme-audit-page.js):
//       mobileFont     — เนื้อหา < 14px · ข้อความรอง/ป้าย/ปุ่ม < 12px · h1 > 28px · h2 > 22px
//       mobileOverflow — ตัวหน้าเลื่อนแนวนอน / element เลยขอบจอ
//       mobileClip     — ข้อความถูกตัดโดยไม่มี ellipsis/title + ตัวเลขที่ถูกตัดกลางตัวข้ามบรรทัด
//       mobileCrowd    — เป้ากด 2 อันห่างกัน < 8px
//       mobileRowBreak — ปุ่มท้ายแถว (.list-row/.todo-row) ตกลงไปอยู่ใต้เนื้อหา
//       mobileAlign    — กล่อง/การ์ดพี่น้องขอบซ้าย-ขวาไม่ตรง หรือกว้างไม่เท่ากันในแถวเดียวกัน (> 2px)
//     textOnImage    — ตัวอักษรบนพื้นหน้าโดยตรงทับภาพพื้นหลัง (data-bg) < 4.5:1 วัดจากพิกเซลจริง
//   ต่อหน้า (1100 สว่าง): crawl — กดแท็บ/segmented/toggle/ปุ่มเปิด dialog ที่ปลอดภัย แล้วต้องไม่มี console error /
//     pageerror / request ไป /api (ไม่มี mock) → crawlErrors
//   ต่อหน้า (ome:lang = en): thaiInEn — ข้อความไทยที่มองเห็นใน UI (ยกเว้น [data-i18n-skip])
//   + bg-level: ทุกกลุ่มภาพ (หน้าตัวแทนกลุ่มละ 1) × 390/1100 × สว่าง/มืด × ระดับภาพพื้นหลัง "อ่อน" และ "ชัด" — ตัวอักษรบนภาพต้องไม่เกิน baseline
//     ("กลาง" = ค่าเริ่มต้น อยู่ในชุด theme ด้านบนแล้ว) · ตั้ง THEME_AUDIT_BG=soft|mid|strong เพื่อรันชุดเต็มทั้งเว็บที่ระดับนั้น
//   + สลับภาษาสดจากแผงตั้งค่า (หน้าที่มี window.omeApplyLang): ข้อความเปลี่ยนโดยไม่โหลดหน้าใหม่
// ratchet: เทียบ tests/theme-baseline.json ช่อง "runtime" — ล้มเฉพาะตัวเลขที่ "เพิ่มขึ้น" (คีย์ใหม่ = baseline 0)
// รายงาน: tests/theme-report/report.json + report.html + summary.md (ไม่ commit — CI อัปโหลดเป็น artifact)
//   สร้างโดย theme-report.js (globalTeardown) จากไฟล์ย่อยใน tests/theme-report/parts/
// อัปเดต baseline หลังแก้หน้า: THEME_AUDIT_UPDATE=1 npx playwright test theme-audit.spec.js  (ลดลงอย่างเดียว)
//   เพิ่มกฎใหม่ (เติมเฉพาะตัวชี้วัดที่ยังไม่มี ไม่แตะค่าเดิม): THEME_AUDIT_UPDATE=seed …
//   ตั้งตามค่าจริง (ครั้งแรก/ตั้งใจ): THEME_AUDIT_UPDATE=accept …
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { menuPages, prepare } = require('./helpers');

const PAGES = menuPages();
if (!PAGES.includes('doc-check-file.html')) PAGES.push('doc-check-file.html'); // หน้าลูกของ doc-check (ไม่อยู่ในเมนู) — รอบ 5
// หน้าที่ตรวจที่ 360px เพิ่มจาก 390 (หน้าที่แก้ในรอบนั้น — เพิ่มชื่อหน้าที่นี่ทุกรอบ) · index.html ตรวจรวม shell (nav/ฟุตเตอร์) ด้วย
const NARROW_360 = (p) => p === 'index.html' || /^area\.html/.test(p) || /^invest(-[a-z-]+)?\.html/.test(p) // รอบ 4: ตระกูลลงทุน
  || /^(word|excel|slides|extract-text|doc-check|doc-check-file|compare|text-to-speech)\.html$/.test(p) // รอบ 5: กลุ่มเอกสาร
  || /^(cad|electrical|maintenance|run|report-dashboard|tax)\.html(\?.*)?$/.test(p); // รอบ 6: วิศวกรรม/รายงาน/ภาษี (cad3d = redirect ไปแท็บ 3D ของ cad)
const WITH_SHELL = (p) => p === 'index.html';
const AUDIT_JS = path.join(__dirname, 'theme-audit-page.js');
const AXE_JS = require.resolve('axe-core/axe.min.js');
const PARTS = path.join(__dirname, 'theme-report', 'parts');
const BASELINE = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'theme-baseline.json'), 'utf8')); } catch (e) { return {}; } })();
const UPDATING = !!process.env.THEME_AUDIT_UPDATE;
// ระดับภาพพื้นหลังของชุดเต็ม (ไม่ตั้ง = ค่าเริ่มต้นของเว็บ "กลาง") — ผลลงรายงานต่อท้ายคีย์ด้วย @ระดับ แต่ตรวจกับ baseline เดียวกัน
const BG = process.env.THEME_AUDIT_BG || '';
const BG_SUFFIX = BG && BG !== 'mid' ? '@' + BG : '';

test.describe.configure({ timeout: 120000 });

const slug = (s) => s.replace(/[^\w.-]+/g, '_').slice(0, 120);
function writePart(key, page, config, metrics, samples) {
  fs.mkdirSync(PARTS, { recursive: true });
  fs.writeFileSync(path.join(PARTS, slug(key) + '.json'), JSON.stringify({ key, page, config, metrics, samples }));
}
/** ratchet: ล้มเมื่อเกิน baseline (ยังไม่มี runtime baseline เลย = ข้าม เพื่อสร้างครั้งแรก) */
function ratchet(key, metrics, samples) {
  if (UPDATING || !BASELINE.runtime) return;
  const base = BASELINE.runtime[key] || {};
  const worse = Object.keys(metrics).filter((k) => metrics[k] > (base[k] || 0))
    .map((k) => `${k}: ${base[k] || 0} → ${metrics[k]}\n    ${(samples[k] || []).slice(0, 6).map((s) => JSON.stringify(s)).join('\n    ')}`);
  expect(worse, `${key} แย่ลงจาก tests/theme-baseline.json (ดู tests/theme-report/report.html)`).toEqual([]);
}

async function open(page, p, { theme, width, lang, bg }) {
  const errors = await prepare(page, { theme });
  const level = bg || BG;
  if (level) await page.addInitScript((l) => { try { localStorage.setItem('ome:bg', l); } catch (e) {} }, level);
  if (lang) await page.addInitScript((l) => { try { localStorage.setItem('ome:lang', l); } catch (e) {} }, lang);
  await page.setViewportSize({ width, height: 800 });
  await page.clock.setFixedTime(new Date('2026-09-30T10:30:00+07:00'));
  await page.goto('/' + p, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav', { timeout: 30000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(400);
  await page.addScriptTag({ path: AUDIT_JS });
  return errors;
}

async function textOnImage(page) {
  const hasBg = await page.evaluate(() => document.documentElement.hasAttribute('data-bg'));
  if (!hasBg) return [];
  const items = await page.evaluate(() => window.__tanotAudit.textOnPage());
  if (!items.length) return [];
  await page.addStyleTag({ content: '*,*::before,*::after{color:transparent!important;text-shadow:none!important;caret-color:transparent!important}' +
    'html::before,html::after{color:initial!important} svg,img,canvas,video,input,select,textarea{visibility:hidden!important} ::placeholder{color:transparent!important}' });
  const buf = await page.screenshot({ animations: 'disabled' });
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
  return page.evaluate(([url, its, d]) => window.__tanotAudit.sampleOnImage(url, its, d), ['data:image/png;base64,' + buf.toString('base64'), items, dpr]);
}

for (const p of PAGES) {
  for (const width of NARROW_360(p) ? [360, 390, 1100] : [390, 1100]) {
    for (const theme of ['light', 'dark']) {
      const key = `${p}|${width}|${theme}`;
      test(`theme: ${key}`, async ({ page }) => {
        await open(page, p, { theme, width });
        const res = await page.evaluate((m) => window.__tanotAudit.audit({ mobile: m }), width < 700);
        await page.addScriptTag({ path: AXE_JS });
        const axe = await page.evaluate(async () => {
          const r = await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations'] });
          const out = [];
          (r.violations || []).forEach((v) => v.nodes.forEach((n) => {
            const d = (n.any && n.any[0] && n.any[0].data) || {};
            out.push({ sel: (n.target || []).join(' '), ratio: d.contrastRatio, fg: d.fgColor, bg: d.bgColor, need: d.expectedContrastRatio });
          }));
          return out;
        });
        const toi = await textOnImage(page);
        const samples = { axe, contrast: res.contrast, controlBorder: res.controlBorder, nonCentral: res.nonCentral, targetSize: res.targetSize, textOnImage: toi };
        if (width < 700) Object.assign(samples, await page.evaluate((o) => window.__tanotAudit.mobile(o), { shell: WITH_SHELL(p) }));
        const metrics = {};
        for (const k of Object.keys(samples)) if (k !== 'targetSize' || width < 700) metrics[k] = samples[k].length;
        writePart(key + BG_SUFFIX, p, { width, theme, bg: BG || 'mid' }, metrics, samples);
        ratchet(key, metrics, samples);
      });
    }
  }

  test(`crawl: ${p}`, async ({ page }) => {
    const apiCalls = [];
    await page.route('**/api/**', (route) => { apiCalls.push(route.request().method() + ' ' + new URL(route.request().url()).pathname); return route.abort(); });
    const errors = await open(page, p, { theme: 'light', width: 1100 });
    const startPath = new URL(page.url()).pathname;
    const clicked = [];
    const t0 = Date.now();
    for (let round = 0; round < 2 && Date.now() - t0 < 25000; round++) {
      const cands = await page.evaluate(() => window.__tanotAudit ? window.__tanotAudit.crawlCandidates() : []);
      if (!cands.length) break;
      for (const c of cands.slice(0, 60)) {
        if (Date.now() - t0 > 25000) break;
        const loc = page.locator(`[data-audit-crawl="${c.id}"]`);
        try {
          if (!(await loc.isVisible())) continue;
          await loc.click({ timeout: 1500 });
          clicked.push(c.text || c.sel);
        } catch (e) { continue; }
        await page.waitForTimeout(120);
        if (new URL(page.url()).pathname !== startPath) { // ไม่ควรเกิด (ข้ามลิงก์แล้ว) — กลับหน้าเดิมแล้วหยุด
          errors.push('crawl: ' + (c.text || c.sel) + ' พาไปหน้า ' + page.url());
          break;
        }
        const n = await page.evaluate(() => window.__tanotAudit.closeOverlays());
        if (!n && await page.locator('[role=dialog]:visible, .ome-pal:not([hidden])').count()) await page.keyboard.press('Escape');
      }
    }
    const samples = { crawlErrors: errors.concat(apiCalls.map((a) => 'request ไม่มี mock: ' + a)).map((e) => ({ text: String(e).slice(0, 300) })) };
    const metrics = { crawlErrors: samples.crawlErrors.length };
    writePart(`${p}|crawl`, p, { crawl: clicked.length }, metrics, samples);
    ratchet(`${p}|crawl`, metrics, samples);
  });

  test(`lang: ${p}`, async ({ page }) => {
    await open(page, p, { theme: 'light', width: 1100, lang: 'en' });
    const hits = await page.evaluate(() => window.__tanotAudit.thaiInEn());
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    const samples = { thaiInEn: hits };
    const metrics = { thaiInEn: hits.length };
    writePart(`${p}|en`, p, { lang: 'en' }, metrics, samples);
    ratchet(`${p}|en`, metrics, samples);
  });
}

/* ระดับภาพพื้นหลัง "อ่อน"/"ชัด" ทุกกลุ่มภาพ — ตัวอักษรบนภาพวัดจากพิกเซลจริง ต้องไม่เกิน baseline ของหน้าเดียวกัน (ไม่มี baseline = 0) */
const BG_PAGES = (() => {
  const boot = fs.readFileSync(path.join(__dirname, '..', 'theme-boot.js'), 'utf8');
  const block = (boot.match(/var BG_GROUPS = \{([\s\S]*?)\n  \};/) || [])[1] || '';
  const out = [];
  for (const m of block.matchAll(/^\s*(\w+):\s*\[\s*'([^']+)'/gm)) out.push(m[2] + '.html');
  out.push('invest-gold.html');
  return out.filter((p) => PAGES.includes(p));
})();
for (const p of BG_PAGES) {
  for (const level of ['soft', 'strong']) {
    for (const width of [390, 1100]) {
      for (const theme of ['light', 'dark']) {
        test(`bg-level: ${p}|${width}|${theme}|${level}`, async ({ page }) => {
          await open(page, p, { theme, width, bg: level });
          expect(await page.evaluate(() => document.documentElement.getAttribute('data-bg-level'))).toBe(level);
          const toi = await textOnImage(page);
          const key = `${p}|${width}|${theme}`;
          const base = ((BASELINE.runtime || {})[key] || {}).textOnImage || 0;
          writePart(`${key}@${level}`, p, { width, theme, bg: level }, { textOnImage: toi.length }, { textOnImage: toi });
          if (!UPDATING) expect(toi.slice(0, 6), `${key} ที่ระดับ ${level}: ตัวอักษรบนภาพแย่ลงจาก baseline (${base})`).toHaveLength(Math.min(toi.length, base));
        });
      }
    }
  }
}

/* สลับภาษาสดจากแผงตั้งค่า — หน้าที่รองรับแล้ว (มี window.omeApplyLang) ข้อความในหน้าต้องเปลี่ยนโดยไม่โหลดใหม่
   + ส่วนกลาง (เมนู/แผงตั้งค่า) เปลี่ยนทุกหน้า */
for (const p of PAGES) {
  test(`lang switch: ${p}`, async ({ page }) => {
    await open(page, p, { theme: 'light', width: 1100, lang: 'th' });
    const supported = await page.evaluate(() => typeof window.omeApplyLang === 'function' || !!window.InvestCore); // InvestCore ฟัง OME_LANG.onChange เอง (ไม่มี omeApplyLang แล้ว)
    await page.waitForLoadState('networkidle').catch(() => {});
    const before = await page.evaluate(() => { window.__noReload = 1; return window.__tanotAudit.thaiInEn({ excludeShell: true }).length; });
    await page.click('#omeGearBtn');
    await page.locator('.ome-settings-panel .ome-settings-row').filter({ hasText: 'ภาษา' }).click();
    await page.click('.ome-settings-panel [data-lang-id="en"]');
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('en');
    expect(await page.evaluate(() => window.__noReload), 'ไม่โหลดหน้าใหม่').toBe(1);
    await expect(page.locator('.ome-settings-panel .ome-settings-row').first()).toHaveText('Accent colour');
    expect(await page.getAttribute('.ome-hamburger', 'aria-label')).toBe('Open menu');
    if (supported) {
      // หน้าบางหน้าวาดใหม่แบบ async หลังสลับภาษา — รอได้ถึง 5 วินาที (เครื่อง CI ช้า)
      await expect.poll(() => page.evaluate(() => window.__tanotAudit.thaiInEn({ excludeShell: true }).length),
        { message: `ข้อความไทยในหน้าต้องลดลงหลังสลับเป็น EN (ก่อนสลับ ${before})`, timeout: 5000 }).toBeLessThan(Math.max(before, 1));
    }
    // สลับกลับไทยได้
    await page.click('.ome-settings-panel [data-lang-id="th"]');
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('th');
    await expect(page.locator('.ome-settings-panel .ome-settings-row').first()).toHaveText('เลือกธีมเว็บ');
  });
}
