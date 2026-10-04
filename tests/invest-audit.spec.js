// @ts-check
// ตัวตรวจตระกูลลงทุน "ตอนมีข้อมูล" (งานแก้ธีม รอบ 4) — theme-audit.spec.js วัดหน้าว่างเท่านั้น
//   seed พอร์ตตัวอย่าง (หุ้นไทย/ต่างประเทศ, กองทุน, ทอง, BTC, พันธบัตร, สลาก, บันทึกเทรด, แผนธุรกิจ) + proxy ปลอม (กราฟ/ข่าว/ทอง)
//   แล้วเปิดทุกหน้า/แท็บ × 360/390/1100 × สว่าง/มืด วัด: axe สี, contrast, ขอบ control, คอมโพเนนต์กลาง, เป้ากด, 6 กฎมือถือ
//   + ภาษา EN: ข้อความไทยที่มองเห็นทุกจุด (ยกเว้น data-i18n-skip และข้อมูลที่ seed ไว้เป็นไทย = ข้อมูลผู้ใช้) ต้องเป็น 0
//   + กราฟ: ไม่มีกราฟล้นจอ (ตรวจใน mobileOverflow) และเปลี่ยนสีตามธีมสด
// เป้า = 0 ทุกตัวชี้วัด (ไม่ใช้ ratchet) — ยกเว้นรายการใน ALLOW ที่ต้องมีเหตุผล
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { prepare } = require('./helpers');
const DUMP = process.env.INVEST_AUDIT_DUMP || ''; // ตั้ง = เขียนผลทุกจุดลงโฟลเดอร์นี้แทนการล้มเทสต์ (ไว้ไล่แก้)

const AUDIT_JS = path.join(__dirname, 'theme-audit-page.js');
const AXE_JS = require.resolve('axe-core/axe.min.js');
const NOW = new Date('2026-10-03T03:00:00Z').getTime();

/* ข้อมูลผู้ใช้ที่ seed เป็นภาษาไทย — ไม่นับเป็นไทยหลุด */
const USER_TEXT = /ออมสิน 3 ปี|ธ\.ก\.ส\. 2 ปี|ขายขนม|ที่ 1|ที่ 2|สะสมมูลค่า|ข่าวหุ้น|ตลาดหุ้นไทยปิดบวก|สำนักข่าว A|SET พุ่ง|แรง/;

const DATA = {
  'tanot:invest:thstock': [{ sym: 'PTT', shares: 200, cost: 32, ts: 1, cur: 33 }, { sym: 'AOT', shares: 500, cost: 60, ts: 3, cur: 58 }, { sym: 'KBANK', shares: 300, cost: 120, ts: 4 }],
  'tanot:invest:globalstock': [{ sym: 'AAPL', shares: 3, cost: 150, ts: 4 }, { sym: 'NVDA', shares: 2, cost: 110, ts: 5 }],
  'tanot:invest:btc': [{ qty: 0.05, cost: 60000, ts: 5, cur: 62000 }, { qty: 0.1, cost: 55000, ts: 8 }],
  'tanot:invest:btcjournal': [{ en: 60000, ex: 65000, qty: 0.1, pl: 500, ts: 11 }, { en: 70000, ex: 69000, qty: 0.01, pl: -10, ts: 12 }],
  'tanot:invest:gold': [{ type: 'bar', unit: 'baht', amt: 40000, price: 40000, weight: 1, ts: 6 }, { type: 'jewelry', unit: 'gram', amt: 21000, price: 2770.45, weight: 7.58, ts: 7 }],
  'tanot:invest:thaifund': [{ fund: 'K-RMF', cat: 'rmf', amt: 10000, nav: 10, units: 1000, ts: Date.parse('2026-05-01T10:00:00+07:00') }, { fund: 'Y-ESG', cat: 'esg', amt: 60000, nav: 10, units: 6000, ts: Date.parse('2026-06-01T10:00:00+07:00') }],
  'tanot:invest:spfund': [{ cls: 'สะสมมูลค่า', amt: 5000, nav: 20, units: 250, ts: 9 }],
  'tanot:invest:govbond': [{ name: 'LB30', purchDate: '2025-01-01', maturity: '2030-01-01', face: 100000, coupon: 3, freq: 2, ts: 10 }, { name: 'LB26', purchDate: '2024-01-01', maturity: '2026-01-01', face: 50000, coupon: 2.5, freq: 2, ts: 11 }],
  'tanot:invest:gsblottery': [{ name: 'ออมสิน 3 ปี', purchDate: '2025-01-01', maturity: '2028-01-01', unitPrice: 100, units: 200, drawFreq: '16', evPerDraw: 0.5, results: { '2025-02-16': 300 }, ts: 12 }],
  'tanot:invest:baaclottery': [{ name: 'ธ.ก.ส. 2 ปี', purchDate: '2026-01-01', maturity: '2028-01-01', unitPrice: 100, units: 50, drawFreq: '1,16', evPerDraw: 0, results: {}, ts: 13 }],
  'tanot:invest:thjournal': [{ sym: 'PTT', en: 30, ex: 33, sh: 100, pl: 300, ts: 3 }, { sym: 'AOT', en: 60, ex: 55, sh: 100, pl: -500, ts: 1 }],
  'tanot:invest:globaljournal': [{ sym: 'AAPL', en: 100, ex: 110, sh: 2, pl: 20, ts: 2 }],
  'tanot:invest:bizplan': [{ name: 'ขายขนม', startup: 20000, fixed: 5000, price: 50, varCost: 20, vol: 300, profitPerUnit: 30, breakevenUnits: 166.7, paybackMonths: 2.3, monthlyProfitAtVol: 4000, ts: 21 }],
  'tanot:invest:portfolio': { cash: 900000, startCash: 1000000, holdings: [{ sym: 'PTT', shares: 1000, avgCost: 30 }], tx: [{ ts: 1700000000000, type: 'buy', sym: 'PTT', shares: 1000, price: 30, amount: 30000 }] },
  'tanot:invest:nav': { 'th:K-RMF': { nav: 11, d: '2026-10-02' } },
  'tanot:invest:fxcache': { ts: NOW, rate: 36.5 },
  'tanot:invest:cache:gold:th': { barSellPrice: 42000, jewelrySellPrice: 41000, ts: NOW },
  'tanot:invest:networth': [{ d: '2026-09-28', v: 900000 }, { d: '2026-09-30', v: 950000 }, { d: '2026-10-02', v: 980000 }],
};

function yahooChart(n, base) {
  const t0 = 1767225600;
  const ts = Array.from({ length: n }, (_, i) => t0 + i * 86400);
  const mk = (f) => Array.from({ length: n }, (_, i) => +(base + Math.sin(i / 7) * base * 0.05 + i * base * 0.002 + f).toFixed(2));
  return { chart: { result: [{ timestamp: ts, meta: { regularMarketPrice: base * 1.1, previousClose: base * 1.09 },
    indicators: { quote: [{ open: mk(0), high: mk(base * 0.01), low: mk(-base * 0.01), close: mk(base * 0.003), volume: ts.map((_, i) => 1000 + i * 3) }] } }] } };
}
const RSS = '<?xml version="1.0"?><rss><channel>' + [
  { title: 'ตลาดหุ้นไทยปิดบวก', link: 'https://example.com/a', pub: 'Fri, 02 Oct 2026 08:00:00 GMT', src: 'สำนักข่าว A' },
  { title: 'SET พุ่ง <b>แรง</b> หลังข้อมูลเศรษฐกิจดีกว่าคาดและแรงซื้อจากนักลงทุนต่างชาติ', link: 'https://example.com/b', pub: 'Fri, 02 Oct 2026 07:00:00 GMT', src: 'B' },
].map((i) => `<item><title>${i.title}</title><link>${i.link}</link><pubDate>${i.pub}</pubDate><source>${i.src}</source></item>`).join('') + '</channel></rss>';

/* [หน้า#แท็บ, สคริปต์เตรียมหลังเปิด (ถ้ามี)] — เปิดทุกหน้า/แท็บ */
const TARGETS = [
  ['invest.html'],
  ['invest-stock.html#th', async (page) => { await page.fill('#sym', 'PTT'); await page.click('#fetchBtn'); await page.waitForSelector('#shead[style*="flex"]', { timeout: 8000 }).catch(() => {}); }],
  ['invest-stock.html#us', async (page) => { await page.fill('#sym', 'AAPL'); await page.click('#fetchBtn'); await page.waitForSelector('#shead[style*="flex"]', { timeout: 8000 }).catch(() => {}); }],
  ['invest-stock.html#scan'],
  ['invest-stock.html#paper'],
  ['invest-fund.html#th'],
  ['invest-fund.html#global'],
  ['invest-gold.html#gold'],
  ['invest-gold.html#markets'],
  ['invest-bitcoin.html'],
  ['invest-gov-bond.html'],
  ['invest-lottery.html#gsb'],
  ['invest-lottery.html#baac'],
  ['invest-lottery.html#govt'],
  ['invest-trade-journal.html#all'],
  ['invest-trade-journal.html#th'],
  ['invest-trade-journal.html#us'],
  ['invest-trade-journal.html#btc'],
  ['invest-news.html'],
  ['invest-business.html'],
];
const ONLY = process.env.INVEST_AUDIT_ONLY ? new RegExp(process.env.INVEST_AUDIT_ONLY) : null;

async function open(page, target, { theme, width, lang }) {
  const errors = await prepare(page, { theme });
  await page.addInitScript(([d, lang]) => {
    window.TANOT_PROXY = { enabled: true };
    window.Worker = function () { throw new Error('no worker'); };
    try {
      if (lang) localStorage.setItem('ome:lang', lang);
      if (localStorage.getItem('__seeded')) return;
      Object.keys(d).forEach((k) => localStorage.setItem(k, JSON.stringify(d[k])));
      localStorage.setItem('__seeded', '1');
    } catch (e) {}
  }, [DATA, lang || '']);
  await page.route('**/api/proxy?*', (route) => {
    const u = new URL(route.request().url()).searchParams.get('url') || '';
    if (u.startsWith('https://news.google.com/rss/search')) return route.fulfill({ contentType: 'application/xml', body: RSS });
    if (/THB%3DX|THB=X/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ chart: { result: [{ meta: { regularMarketPrice: 36 }, indicators: { quote: [{ close: [36] }] } }] } }) });
    if (/finance\.yahoo|query1|query2/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(yahooChart(120, /AAPL|NVDA/.test(u) ? 150 : /BTC/.test(u) ? 60000 : /GC=F|XAU/.test(u) ? 2400 : 32)) });
    return route.fulfill({ status: 502, body: 'down' });
  });
  await page.setViewportSize({ width, height: 800 });
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto('/' + target[0], { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav', { timeout: 30000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(500);
  if (target[1]) await target[1](page);
  await page.waitForTimeout(700);
  await page.addScriptTag({ path: AUDIT_JS });
  return errors;
}

/** ข้อความไทยที่มองเห็นทุกจุด (ไม่จำกัดชนิด element) — ยกเว้น data-i18n-skip และข้อมูลผู้ใช้ที่ seed */
async function thaiAnywhere(page) {
  return page.evaluate((userRe) => {
    const THAI = /[\u0E00-\u0E3E\u0E40-\u0E7F]/, re  /* ไม่นับ ฿ (U+0E3F) */ = new RegExp(userRe);
    const out = [], seen = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (!THAI.test(t.nodeValue)) continue;
      const p = t.parentElement;
      if (!p || p.closest('script,style,noscript,option,[data-i18n-skip],.ome-nav,nav.ome-nav,footer.ome-footer,.ome-ai-fab,.ome-ai-panel')) continue;
      const r = p.getBoundingClientRect(), cs = getComputedStyle(p);
      if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (re.test(t.nodeValue) || t.nodeValue.trim() === 'ไทย') continue; // 'ไทย' = ชื่อภาษาบนปุ่มสลับภาษา
      if (seen.has(p)) continue;
      seen.add(p);
      out.push((p.id ? '#' + p.id : p.tagName.toLowerCase() + (p.className && typeof p.className === 'string' ? '.' + p.className.trim().split(/\s+/)[0] : '')) + ' → ' + t.nodeValue.trim().slice(0, 40));
    }
    ['placeholder', 'title', 'aria-label'].forEach((a) => document.querySelectorAll('[' + a + ']').forEach((el) => {
      if (el.closest('[data-i18n-skip],.ome-nav,footer.ome-footer,.ome-ai-fab,.ome-ai-panel') || !THAI.test(el.getAttribute(a)) || re.test(el.getAttribute(a))) return;
      const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return;
      out.push('[' + a + '] ' + (el.id ? '#' + el.id : el.tagName.toLowerCase()) + ' → ' + el.getAttribute(a).slice(0, 40));
    }));
    return out;
  }, USER_TEXT.source);
}

test.describe.configure({ timeout: 120000 });

for (const target of TARGETS) {
  if (ONLY && !ONLY.test(target[0])) continue;
  for (const width of [360, 390, 1100]) {
    for (const theme of ['light', 'dark']) {
      test(`invest-data: ${target[0]}|${width}|${theme}`, async ({ page }) => {
        const errors = await open(page, target, { theme, width });
        const res = await page.evaluate((m) => window.__tanotAudit.audit({ mobile: m }), width < 700);
        await page.addScriptTag({ path: AXE_JS });
        const axe = await page.evaluate(async () => {
          const r = await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations'] });
          const out = [];
          (r.violations || []).forEach((v) => v.nodes.forEach((n) => { const d = (n.any && n.any[0] && n.any[0].data) || {}; out.push({ sel: (n.target || []).join(' '), ratio: d.contrastRatio, fg: d.fgColor, bg: d.bgColor }); }));
          return out;
        });
        const samples = { axe, contrast: res.contrast, controlBorder: res.controlBorder, nonCentral: res.nonCentral };
        if (width < 700) { samples.targetSize = res.targetSize; Object.assign(samples, await page.evaluate(() => window.__tanotAudit.mobile({ shell: false }))); }
        const bad = {};
        Object.keys(samples).forEach((k) => { if (samples[k].length) bad[k] = samples[k].slice(0, 8); });
        if (DUMP) { fs.mkdirSync(DUMP, { recursive: true }); fs.writeFileSync(path.join(DUMP, `${target[0]}|${width}|${theme}`.replace(/[^\w.|-]/g, '_') + '.json'), JSON.stringify(samples)); return; }
        expect(bad, `${target[0]} ${width} ${theme}`).toEqual({});
        expect(errors, 'console errors').toEqual([]);
      });
    }
  }

  test(`invest-data lang: ${target[0]}`, async ({ page }) => {
    await open(page, target, { theme: 'light', width: 1100, lang: 'en' });
    const th = await thaiAnywhere(page);
    if (DUMP) { fs.mkdirSync(DUMP, { recursive: true }); fs.writeFileSync(path.join(DUMP, `${target[0]}|lang`.replace(/[^\w.|-]/g, '_') + '.json'), JSON.stringify(th)); return; }
    expect(th).toEqual([]);
  });

  test(`invest-data explore: ${target[0]}`, async ({ page }) => {
    // กดทุกปุ่มที่ไม่ทำลายข้อมูล (2 รอบ รอบ 2 กรอกช่องว่างด้วยตัวเลขก่อน เพื่อให้ปุ่ม "เพิ่ม/คำนวณ" ทำงานจริง) ในโหมด EN —
    // ข้อความไทยที่โผล่ในกล่อง/toast/ข้อความสถานะ/ผลลัพธ์ต้องเป็น 0 และห้ามมี console error
    const errors = await open(page, target, { theme: 'light', width: 1100, lang: 'en' });
    const hits = new Set();
    const collect = async () => { (await thaiAnywhere(page)).forEach((h) => hits.add(h)); };
    const start = new URL(page.url()).pathname;
    for (let round = 0; round < 2; round++) {
      if (round === 1) {
        await page.evaluate(() => document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden])').forEach((el) => {
          if (!el.offsetParent || el.value) return;
          const ty = el.getAttribute('type') || 'text';
          el.value = ty === 'number' ? '10' : ty === 'date' ? '2026-10-01' : /^(sym|.*Sym)$/.test(el.id) ? 'PTT' : 'A';
          el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
        }));
      }
      const ids = await page.evaluate(() => {
        const bad = /ลบ|ล้าง|รีเซ็ต|delete|remove|clear|reset|wipe|erase|logout|sign ?out/i;
        const out = []; let n = 0;
        document.querySelectorAll('button,summary,[role=tab],.chip,.tab').forEach((el) => {
          if (el.closest('.ome-nav,nav.ome-nav,footer.ome-footer,.ome-ai-fab,.ome-ai-panel,dialog:not([open])') || el.disabled) return;
          const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return;
          if (bad.test([el.innerText, el.getAttribute('aria-label'), el.getAttribute('title'), el.id, el.className].join(' '))) return;
          el.setAttribute('data-ex', String(++n)); out.push(n);
        });
        return out;
      });
      for (const id of ids.slice(0, 120)) {
        const loc = page.locator(`[data-ex="${id}"]`);
        try { if (!(await loc.isVisible())) continue; await loc.click({ timeout: 1200 }); } catch (e) { continue; }
        await page.waitForTimeout(120);
        if (new URL(page.url()).pathname !== start) { await page.goBack().catch(() => {}); await page.waitForTimeout(300); continue; }
        await collect();
        await page.evaluate(() => { document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (e) {} }); });
        await page.keyboard.press('Escape').catch(() => {});
      }
    }
    const th = [...hits];
    if (DUMP) { fs.mkdirSync(DUMP, { recursive: true }); fs.writeFileSync(path.join(DUMP, `${target[0]}|explore`.replace(/[^\w.|-]/g, '_') + '.json'), JSON.stringify(th.concat(errors.map((e) => 'ERR ' + e)))); return; }
    expect(th).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`invest-data chart theme: ${target[0]}`, async ({ page }) => {
    // สลับสว่าง→มืดสด: ภาพกราฟ (canvas) ต้องเปลี่ยน (อ่านสีจาก chart-theme.js ไม่ hardcode)
    await open(page, target, { theme: 'light', width: 1100 });
    const n = await page.locator('canvas:visible').count();
    test.skip(n === 0, 'หน้า/แท็บนี้ไม่มีกราฟ canvas');
    const grab = () => page.evaluate(() => [].map.call(document.querySelectorAll('canvas'), (c) => { try { return c.toDataURL().length + ':' + c.toDataURL().slice(-400); } catch (e) { return ''; } }).join('|'));
    const before = await grab();
    await page.evaluate(() => window.OmeTheme.set('theme', 'dark'));
    await page.waitForTimeout(800);
    expect(await grab()).not.toBe(before);
  });
}
