// @ts-check
// ตัวตรวจกลุ่มการศึกษา "ตอนมีข้อมูล" (งานแก้ธีม รอบ 7A) — theme-audit.spec.js วัดหน้าว่างเท่านั้น
//   review · books · classroom-law · classroom-business · classroom-engineering
//   seed ข้อมูล (การ์ดถึงรอบจากทุกแหล่ง, หนังสือ + บันทึกการอ่าน + ไฮไลต์, ความคืบหน้า/โน้ต/ผลสอบของห้องเรียนทั้ง 3 ห้อง, XP) + mock /api
//   และบริการภายนอกทุกตัว (ห้ามเรียกของจริง) แล้วเปิดทุกแท็บ/บท/dialog + ทำการ์ดทบทวน/ข้อสอบจนจบ × 360/390/1100 × สว่าง/มืด วัด: axe สี, contrast, ขอบ control, คอมโพเนนต์กลาง, เป้ากด, 6 กฎมือถือ
//   + ภาษา EN: ข้อความไทยที่มองเห็นทุกจุดในทุกสถานะ (ยกเว้น data-i18n-skip และกล่องเอกสารที่ผู้ใช้แก้ [data-doc-area]) ต้องเป็น 0
//   + สลับภาษาสด th → en → th โดยไม่โหลดหน้าใหม่ (ฟังผ่าน OME_LANG.onChange) และไม่มี console error
// เป้า = 0 ทุกตัวชี้วัด (ไม่ใช้ ratchet) — ยกเว้นรายการใน ALLOW ที่ต้องมีเหตุผลรายจุด
//   EDU_AUDIT_ONLY=<regex หน้า> เลือกหน้า · EDU_AUDIT_DUMP=<โฟลเดอร์> เขียนผลทุกจุดลงไฟล์แทนการล้มเทสต์ · EDU_AUDIT_NOALLOW=1 ดูจุดที่ ALLOW ซ่อนไว้
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { prepare } = require('./helpers');

const DUMP = process.env.EDU_AUDIT_DUMP || '';
const ONLY = process.env.EDU_AUDIT_ONLY ? new RegExp(process.env.EDU_AUDIT_ONLY) : null;
const AUDIT_JS = path.join(__dirname, 'theme-audit-page.js');
const AXE_JS = require.resolve('axe-core/axe.min.js');
const NM = path.join(__dirname, 'node_modules');
const NOW = new Date('2026-10-03T03:00:00Z').getTime();
const F = require('./edu-fixtures');

/* จุดที่ยังไม่เป็น 0 และมีเหตุผล — { page regex, metric, selector regex, เหตุผล } (ห้ามเพิ่มโดยไม่มีเหตุผล) */
const ALLOW = F.ALLOW || [];
const allowed = (page, metric, s) => !process.env.EDU_AUDIT_NOALLOW && ALLOW.some((a) => a.page.test(page) && a.metric === metric && a.sel.test(String((s && s.sel) || '')));

/* ───────── ตัวช่วย ───────── */
const dom = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); return !!el; }, sel);
const settle = (page, ms) => page.waitForTimeout(ms || 250);
async function closeAll(page) {
  await page.evaluate(() => {
    document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (e) {} });
  });
  await page.keyboard.press('Escape').catch(() => {});
}
const val = async (page, sel, v) => { await page.fill(sel, String(v), { timeout: 4000 }); };
const sel = async (page, s, v) => { await page.selectOption(s, String(v), { timeout: 4000 }).catch(() => {}); };

/* ───────── เป้าหมาย: หน้า + ข้อมูลตั้งต้น + สถานะที่เปิด (สะสมต่อกัน) ───────── */
const TARGETS = F.targets({ dom, settle, closeAll, val, sel, NOW });

/* ───────── เปิดหน้า + mock ───────── */
async function open(page, t, { theme, width, lang }) {
  const errors = await prepare(page, { theme });
  await page.addInitScript(([seed, init, lang]) => {
    try {
      if (lang) localStorage.setItem('ome:lang', lang);
      if (!localStorage.getItem('__seeded')) {
        Object.keys(seed).forEach((k) => localStorage.setItem(k, typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k])));
        localStorage.setItem('__seeded', '1');
      }
    } catch (e) {}
    if (init) (0, eval)(init);
  }, [t.seed || {}, t.init || '', lang || '']);
  // CDN → แพ็กเกจใน tests/node_modules (ไม่มีไฟล์ = ปล่อยให้ถูกบล็อกเหมือนออฟไลน์)
  await page.route(/https:\/\/cdn\.jsdelivr\.net\/npm\/.+/, (route) => {
    const m = /npm\/((?:@[^/]+\/)?[^@/]+)@[^/]+\/(.+?)(?:\?.*)?$/.exec(route.request().url());
    let f = m && path.join(NM, m[1], m[2]);
    // chart.js@4.4.4 ไม่มีไฟล์ chart.umd.min.js ในแพ็กเกจ npm (มีแต่ chart.umd.js) — ใช้ตัวไม่ย่อแทน
    if (f && !fs.existsSync(f) && /\.min\.js$/.test(f)) f = f.replace(/\.min\.js$/, '.js');
    if (f && fs.existsSync(f) && fs.statSync(f).isFile()) {
      const ext = path.extname(f);
      return route.fulfill({ body: fs.readFileSync(f), contentType: ext === '.css' ? 'text/css' : ext === '.js' || ext === '.mjs' ? 'application/javascript' : 'application/octet-stream' });
    }
    return route.abort('internetdisconnected');
  });
  // /api ทุกตัวเป็น mock — ห้ามเรียกของจริง (ocr/ai ห้ามถูกเรียกในกลุ่มนี้)
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url()).pathname;
    if (/\/api\/(ocr|ai\/)/.test(u)) { errors.push('เรียก ' + u + ' (ห้าม)'); return route.fulfill({ status: 500, body: '{}' }); }
    if (/\/api\/files/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'f9', name: 'file.pdf', size: 1000, mime: 'application/pdf' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  if (t.route) await t.route(page, errors);
  await page.setViewportSize({ width, height: 800 });
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto('/' + t.page, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav', { timeout: 30000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await settle(page, 500);
  if (t.wait) await t.wait(page);
  await page.addScriptTag({ path: AUDIT_JS });
  return errors;
}

/** ข้อความไทยที่มองเห็นทุกจุด — ยกเว้น data-i18n-skip / กล่องเอกสารที่ผู้ใช้แก้ (data-doc-area) / ข้อมูลผู้ใช้ที่ seed */
async function thaiAnywhere(page, t) {
  return page.evaluate(([userSrc, skipSel]) => {
    const THAI = /[฀-฾เ-๿]/; /* ไม่นับ ฿ (U+0E3F) */
    const SKIP = 'script,style,noscript,option,[data-i18n-skip],[data-doc-area],.ome-nav,nav.ome-nav,footer.ome-footer,.ome-ai-fab,.ome-ai-panel' + (skipSel ? ',' + skipSel : '');
    const USER = userSrc ? new RegExp(userSrc) : null;
    const out = [], seen = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!THAI.test(n.nodeValue)) continue;
      const p = n.parentElement;
      if (!p || p.closest(SKIP)) continue;
      const r = p.getBoundingClientRect(), cs = getComputedStyle(p);
      if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (n.nodeValue.trim() === 'ไทย') continue; // ชื่อภาษาบนปุ่มสลับภาษา
      if (USER && USER.test(n.nodeValue)) continue;
      if (seen.has(p)) continue; seen.add(p);
      out.push((p.id ? '#' + p.id : p.tagName.toLowerCase() + (typeof p.className === 'string' && p.className.trim() ? '.' + p.className.trim().split(/\s+/)[0] : '')) + ' → ' + n.nodeValue.trim().slice(0, 40));
    }
    ['placeholder', 'title', 'aria-label'].forEach((a) => document.querySelectorAll('[' + a + ']').forEach((el) => {
      if (el.closest('[data-i18n-skip],[data-doc-area],.ome-nav,footer.ome-footer,.ome-ai-fab,.ome-ai-panel') || !THAI.test(el.getAttribute(a))) return;
      if (el.getAttribute(a).trim() === 'ไทย') return;
      if (USER && USER.test(el.getAttribute(a))) return;
      const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return;
      out.push('[' + a + '] ' + (el.id ? '#' + el.id : el.tagName.toLowerCase()) + ' → ' + el.getAttribute(a).slice(0, 40));
    }));
    return out;
  }, [t.user ? t.user.source : '', t.skipSel || '']);
}

async function measure(page, width, withAxe, t) {
  // dialog แบบ modal เปิดอยู่ = วัดเฉพาะในกล่อง (หน้าหลังกล่องใช้งานไม่ได้ ไม่ควรนับซ้อน/ชิดกับของในกล่อง)
  const modal = await page.evaluate((over) => {
    // ลิ้นชัก/แผงลอยที่ทับหน้า (t.overlay = selector) เปิดอยู่ = วัดเฉพาะในแผงนั้น
    const sels = over ? over.split(',').map((x) => x.trim()) : [];
    const ov = sels.map((x) => document.querySelector(x)).find((e) => e && e.checkVisibility && e.checkVisibility({ visibilityProperty: true }) && e.getBoundingClientRect().width > 0);
    const overlay = !!ov;
    const dlgs = [...document.querySelectorAll('dialog[open]')];
    if (!dlgs.length && !overlay) return false;
    // กล่องซ้อนกัน (เช่น กล่องยืนยันบนกล่องฟอร์ม) = วัดเฉพาะกล่องบนสุด (ท้ายสุดในเอกสาร) — กล่องข้างใต้ผู้ใช้กดไม่ได้
    dlgs.slice(0, -1).forEach((d) => d.setAttribute('data-audit-under', ''));
    const st = document.createElement('style'); st.id = 'audit-modal-style';
    st.textContent = dlgs.length ? 'body *{visibility:hidden !important}dialog[open]:not([data-audit-under]),dialog[open]:not([data-audit-under]) *{visibility:visible !important}' : ('body *{visibility:hidden !important}' + sels.map((x) => x + ',' + x + ' *').join(',') + '{visibility:visible !important}');
    document.head.appendChild(st); return true;
  }, t.overlay || '');
  try { return await measureInner(page, width, withAxe); }
  finally { if (modal) await page.evaluate(() => { const s = document.getElementById('audit-modal-style'); if (s) s.remove(); document.querySelectorAll('[data-audit-under]').forEach((d) => d.removeAttribute('data-audit-under')); }); }
}
async function measureInner(page, width, withAxe) {
  const res = await page.evaluate((m) => window.__tanotAudit.audit({ mobile: m }), width < 700);
  const samples = { contrast: res.contrast, controlBorder: res.controlBorder, nonCentral: res.nonCentral };
  if (withAxe) {
    await page.addScriptTag({ path: AXE_JS }).catch(() => {});
    samples.axe = await page.evaluate(async () => {
      if (!window.axe) return [];
      const r = await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations'] });
      const out = [];
      (r.violations || []).forEach((v) => v.nodes.forEach((n) => { const d = (n.any && n.any[0] && n.any[0].data) || {}; out.push({ sel: (n.target || []).join(' '), ratio: d.contrastRatio, fg: d.fgColor, bg: d.bgColor }); }));
      return out;
    });
  }
  if (width < 700) { samples.targetSize = res.targetSize; Object.assign(samples, await page.evaluate(() => window.__tanotAudit.mobile({ shell: false }))); }
  return samples;
}

/** error ที่รู้สาเหตุของหน้านั้น (เช่น CDN ที่ถูกบล็อกตอนออฟไลน์) กรองด้วย t.ignoreErrors — ใส่เหตุผลกำกับที่ fixture */
const errs = (errors, t) => errors.filter((e) => !(t.ignoreErrors && t.ignoreErrors.test(e)));

test.describe.configure({ timeout: 300000 });

for (const t of TARGETS) {
  if (ONLY && !ONLY.test(t.page)) continue;
  for (const width of [360, 390, ...(process.env.AUDIT_EXTRA_WIDTHS || '').split(',').map(Number).filter(Boolean), 1100]) { // AUDIT_EXTRA_WIDTHS=412,430 เพิ่ม Android ทั่วไป/iPhone Pro Max
    for (const theme of ['light', 'dark']) {
      test(`edu-data: ${t.page}|${width}|${theme}`, async ({ page }) => {
        const errors = await open(page, t, { theme, width });
        const bad = {}, uniq = {};
        for (const [name, fn] of t.states) {
          const t0 = Date.now();
          try { await fn(page, width); } catch (e) { errors.push(`state ${name}: ${String(e.message).split('\n')[0]}`); }
          await settle(page, 200);
          const s = await measure(page, width, true, t);
          if (process.env.EDU_AUDIT_TRACE) console.log(`[trace] ${t.page}|${width}|${theme} ${name} ${Date.now() - t0}ms`);
          Object.keys(s).forEach((k) => {
            const arr = s[k].filter((x) => !allowed(t.page, k, x));
            arr.forEach((x) => { (uniq[k] = uniq[k] || new Set()).add(String((x && (x.sel || x.s)) || JSON.stringify(x))); });
            if (arr.length) (bad[k] = bad[k] || []).push(...arr.slice(0, 6).map((x) => Object.assign({ state: name }, x)));
          });
        }
        if (DUMP) { fs.mkdirSync(DUMP, { recursive: true }); fs.writeFileSync(path.join(DUMP, `${t.page}|${width}|${theme}`.replace(/[^\w.|-]/g, '_') + '.json'), JSON.stringify({ bad, counts: Object.fromEntries(Object.keys(uniq).map((k) => [k, uniq[k].size])), errors: errs(errors, t) })); return; }
        expect(bad, `${t.page} ${width} ${theme}`).toEqual({});
        expect(errs(errors, t), 'console errors').toEqual([]);
      });
    }
  }

  test(`edu-data lang: ${t.page}`, async ({ page }) => {
    // ทุกสถานะในโหมด EN — ข้อความไทยที่โผล่ในกล่อง/แท็บ/ข้อความสถานะ/ผลลัพธ์ต้องเป็น 0
    const errors = await open(page, t, { theme: 'light', width: 1100, lang: 'en' });
    const hits = new Set();
    for (const [name, fn] of t.states) {
      try { await fn(page, 1100); } catch (e) { errors.push(`state ${name}: ${String(e.message).split('\n')[0]}`); }
      await settle(page, 250);
      (await thaiAnywhere(page, t)).forEach((h) => hits.add(name + ': ' + h));
    }
    const th = [...hits];
    if (DUMP) { fs.mkdirSync(DUMP, { recursive: true }); fs.writeFileSync(path.join(DUMP, `${t.page}|lang`.replace(/[^\w.|-]/g, '_') + '.json'), JSON.stringify(th.concat(errs(errors, t).map((e) => 'ERR ' + e)))); return; }
    expect(th).toEqual([]);
    expect(errs(errors, t)).toEqual([]);
  });

  test(`edu-data live switch: ${t.page}`, async ({ page }) => {
    // th → en → th จาก OME_LANG.set โดยไม่โหลดหน้าใหม่ (ฟังผ่าน OME_LANG.onChange) ที่สถานะ "มีข้อมูล" สุดท้าย
    const errors = await open(page, t, { theme: 'light', width: 1100, lang: 'th' });
    for (const [name, fn] of t.states) { try { await fn(page, 1100); } catch (e) { errors.push(`state ${name}: ${String(e.message).split('\n')[0]}`); } await settle(page, 200); }
    await closeAll(page); await settle(page, 300);
    if (t.beforeSwitch) await t.beforeSwitch(page);
    await page.evaluate(() => { window.__noReload = 1; window.OME_LANG.set('en'); });
    await settle(page, 1000);
    expect(await thaiAnywhere(page, t), 'หลังสลับเป็น EN').toEqual([]);
    expect(await page.evaluate(() => window.OME_PAGE_LIVE_LANG), 'หน้าประกาศว่าฟังการสลับภาษา').toBe(true);
    if (t.liveCheck) await t.liveCheck(page, 'en');
    await page.evaluate(() => window.OME_LANG.set('th'));
    await settle(page, 1000);
    expect(await page.evaluate(() => /[ก-ฺเ-๎]/.test((document.querySelector('main, .page, body') || document.body).innerText)), 'กลับไทย').toBe(true);
    if (t.liveCheck) await t.liveCheck(page, 'th');
    expect(await page.evaluate(() => window.__noReload)).toBe(1);
    expect(errs(errors, t)).toEqual([]);
  });
}
