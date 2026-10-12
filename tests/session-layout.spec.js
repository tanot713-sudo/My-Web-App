// iPhone รอบนี้: (1) ช่องวันที่/เวลาไม่ล้นทับช่องข้างๆ ทั้งเว็บ (2) area.html แถว "ใช้ล่าสุด" เว้นระยะจากกล่องข้างล่าง
// (3) แถบ "เซสชันหมดอายุ" ของ sw.js — หน้าเว็บตรวจ /api/session เองก่อนแสดงแถบ, ไม่วนรีโหลด, จำนวนรอซิงก์, เข้าสู่ระบบใหม่ 2 ขั้น
//
// ข้อ 1: เครื่อง CI มีแต่ Chromium (ไม่มี WebKit) — จำลองอาการของ iOS Safari (ช่องวันที่มีความกว้างขั้นต่ำของตัวเองไม่หดตาม flex/grid)
//   ด้วย min-width ใน @layer ที่ฉีดเข้าหน้า: กฎใน layer แพ้กฎนอก layer เสมอ → กฎกลางใน theme.css (นอก layer) ต้องชนะได้ และถ้าลบกฎกลางออก
//   ช่องจะล้นจริง (เทสต์ "ไม่มีกฎกลาง = ล้น" ยืนยันว่าการจำลองจับอาการได้)
// ข้อ 3: โฮสต์ tanot-sw.pages.dev:8143 → 127.0.0.1 (--host-resolver-rules) + นับเป็น secure context ให้ลง SW ได้ · เซิร์ฟเวอร์ในสเปกนี้
//   ทำตัวเหมือน Pages (x.html → 308 → /x) + ด่าน Access ตัวหลอก: /api/session แยกผลของ SW กับของหน้าเว็บ (?via=page) ได้อิสระ,
//   /api/sync ส่งต่อไป sync-server ตัวจริงที่พอร์ต 8142 เมื่อ "หน้าเว็บผ่าน" ไม่งั้นตอบ 302 ไปหน้าล็อกอินแบบ Access
const { test, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOST = 'tanot-sw.pages.dev';
const PORT = 8143;
const ORIGIN = `http://${HOST}:${PORT}`;
const SYNC = 'http://localhost:8142';
const LOGIN = 'http://team.invalid/cdn-cgi/access/login/tanot';

// launchOptions ต้องอยู่ระดับไฟล์ (Playwright ไม่ให้ตั้งในกลุ่ม) — แมปเฉพาะโฮสต์จำลองของข้อ 3 ไม่กระทบกลุ่มอื่น
test.use({ launchOptions: { args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${ORIGIN}`] } });

const IOS_SIM = '@layer iossim{input:is([type=date],[type=time],[type=datetime-local],[type=month],[type=week]){min-width:240px}}';
const NO_CENTRAL = 'input:is([type=date],[type=time],[type=datetime-local],[type=month],[type=week]){min-width:revert-layer!important;max-width:none!important}' +
  ':is(.field,.frow > *){min-width:revert-layer!important}'; // .ome-qa-f มี min-width:0 ของตัวเองอยู่แล้วก่อนแก้

/* ── ตัววัดในหน้า: ช่องวันที่ทุกช่องที่มองเห็น ต้องอยู่ในกล่องแม่ + ไม่ทับ control ของกล่องพี่น้องในแถวเดียวกัน ── */
async function measureDates(page, opts) {
  return page.evaluate((o) => {
    const SEL = 'input:is([type=date],[type=time],[type=datetime-local],[type=month],[type=week])';
    if (o && o.unhide) {
      // เปิดกล่อง/แท็บที่ซ่อนอยู่ทุกชั้นเหนือช่อง (วัดเลย์เอาต์อย่างเดียว ไม่กดปุ่มใดๆ)
      document.querySelectorAll(SEL).forEach((inp) => {
        for (let el = inp; el && el !== document.body; el = el.parentElement) {
          if (el.tagName === 'DIALOG' && !el.open) { try { el.show(); } catch (e) { el.setAttribute('open', ''); } }
          if (el.hidden) el.hidden = false;
          if (getComputedStyle(el).display === 'none') el.style.setProperty('display', 'block', 'important');
        }
      });
    }
    const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const out = { count: 0, bad: [] };
    document.querySelectorAll(SEL).forEach((inp) => {
      const r = inp.getBoundingClientRect();
      if (!r.width || !r.height) return;
      out.count++;
      const name = (inp.id || inp.name || inp.className || inp.type) + '';
      const box = inp.parentElement, br = box.getBoundingClientRect();
      if (r.right > br.right + 1 || r.left < br.left - 1) out.bad.push(name + ': ล้นกล่องแม่ ' + Math.round(r.right - br.right) + 'px');
      if (r.right > document.documentElement.clientWidth + 1) out.bad.push(name + ': เลยขอบจอ');
      const row = box.parentElement;
      if (row) [...row.children].forEach((sib) => {
        if (sib === box) return;
        sib.querySelectorAll('input,select,textarea,button').forEach((c) => {
          const cr = c.getBoundingClientRect();
          if (cr.width && cr.height && hit(r, cr)) out.bad.push(name + ': ทับ ' + (c.id || c.name || c.className || c.tagName));
        });
      });
    });
    return out;
  }, opts || {});
}

async function openAt(page, url, width) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('about:blank');
  await page.goto(url);
  await page.addStyleTag({ content: IOS_SIM });
  // budget: ฟอร์มบันทึกเปิดด้วยปุ่ม "เพิ่มรายการ" (แถวกรอกแรกสร้างตอนเปิด)
  if (/budget\.html#record/.test(url)) await page.locator('#toggleAddForm').click();
}

test.describe('ช่องวันที่/เวลา (date input) ไม่ล้น — iOS จำลอง', () => {
  test.use({ serviceWorkers: 'block' });

  test('budget แท็บบันทึก: .f-date ไม่ทับ .f-type (700/390/360)', async ({ page }) => {
    for (const w of [700, 390, 360]) {
      await openAt(page, '/budget.html#record', w);
      const d = page.locator('.mp-entry-row .f-date').first(), t = page.locator('.mp-entry-row .f-type').first();
      await expect(d).toBeVisible();
      const [a, b] = [await d.boundingBox(), await t.boundingBox()];
      const sameRow = Math.abs(a.y - b.y) < 4;
      if (sameRow) expect(a.x + a.width, `${w}px: วันที่ทับประเภท`).toBeLessThanOrEqual(b.x + 1);
      else expect(a.y + a.height).toBeLessThanOrEqual(b.y + 1);
      const m = await measureDates(page);
      expect(m.bad, `${w}px`).toEqual([]);
    }
  });

  test('ไม่มีกฎกลาง = ล้นจริง (การจำลอง iOS จับอาการได้)', async ({ page }) => {
    await openAt(page, '/budget.html#record', 700);
    await page.addStyleTag({ content: NO_CENTRAL });
    await expect(page.locator('.mp-entry-row .f-date').first()).toBeVisible();
    expect((await measureDates(page)).bad.length, 'budget').toBeGreaterThan(0);
    await openAt(page, '/index.html', 430);
    await page.addStyleTag({ content: NO_CENTRAL });
    await page.addScriptTag({ url: '/quick-add.js' });
    await page.evaluate(() => window.OmeQuickAdd.open({ type: 'expense' }));
    await expect(page.locator('.ome-qa input[name=date]')).toBeVisible();
    expect((await measureDates(page)).bad.length, 'quick-add').toBeGreaterThan(0);
  });

  test('หน้าต่าง quick-add: ช่องวันที่ไม่ทับช่องบันทึก + ไม่ล้นหน้าต่าง (390/430/360)', async ({ page }) => {
    for (const w of [430, 390, 360]) {
      await openAt(page, '/index.html', w);
      await page.addScriptTag({ url: '/quick-add.js' });
      await page.evaluate(() => window.OmeQuickAdd.open({ type: 'expense' }));
      const date = page.locator('.ome-qa input[name=date]'), note = page.locator('.ome-qa input[name=note]');
      await expect(date).toBeVisible();
      const [a, b, box] = [await date.boundingBox(), await note.boundingBox(), await page.locator('.ome-qa-box').boundingBox()];
      const sameRow = Math.abs(a.y - b.y) < 4;
      if (sameRow) expect(a.x + a.width, `${w}px`).toBeLessThanOrEqual(b.x + 1);
      else expect(a.y + a.height, `${w}px`).toBeLessThanOrEqual(b.y + 1);
      expect(a.x + a.width, `${w}px: ล้นหน้าต่าง`).toBeLessThanOrEqual(box.x + box.width + 0.5);
      expect((await measureDates(page)).bad, `${w}px`).toEqual([]);
      // ความสูงเท่าช่องข้างๆ
      expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
    }
  });

  test('quick-add แถวเดียวกันที่ 430px: ช่องวันที่หดได้ (ไม่ดันช่องบันทึก)', async ({ page }) => {
    await openAt(page, '/index.html', 700);
    await page.addScriptTag({ url: '/quick-add.js' });
    await page.evaluate(() => window.OmeQuickAdd.open({ type: 'expense' }));
    const a = await page.locator('.ome-qa input[name=date]').boundingBox(), b = await page.locator('.ome-qa input[name=note]').boundingBox();
    expect(Math.abs(a.y - b.y)).toBeLessThan(4);
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(2); // flex:1 ทั้งคู่ → กว้างเท่ากัน ไม่ใช่วันที่ 240px ดันอีกช่อง
  });

  // ทุกหน้าที่มีช่องวันที่/เวลา (grep type=date|time|datetime-local|month|week ทั้ง repo) ที่ 360px — เปิดกล่อง/แท็บที่ซ่อนอยู่ให้เห็นก่อนวัด
  const PAGES = [
    ['books.html', 3], ['budget.html#record', 1], ['classroom-law.html', 3], ['car.html', 7], ['health.html', 4], ['insurance.html', 3],
    ['invest-gov-bond.html', 2], ['invest-stock.html', 1], ['maintenance.html', 8], ['receipts.html', 1], ['sports.html', 1],
  ];
  for (const [p, min] of PAGES) {
    test(`360px ไม่มีช่องวันที่ล้นกล่องแม่: ${p}`, async ({ page }) => {
      await openAt(page, '/' + p, 360);
      const m = await measureDates(page, { unhide: true });
      expect(m.count, 'จำนวนช่องที่วัดได้').toBeGreaterThanOrEqual(min);
      expect(m.bad).toEqual([]);
    });
  }

  test('360px ช่องที่ JS สร้าง: ลอตเตอรี่ออมสิน/ธ.ก.ส. + เวลากินยา + ตัวกรอง report-dashboard', async ({ page }) => {
    for (const h of ['#gsb', '#baac']) {
      await openAt(page, '/invest-lottery.html' + h, 360);
      await page.waitForFunction(() => document.querySelector('#gbPurchDate,#lgPurchDate'));
      const m = await measureDates(page, { unhide: true });
      expect(m.count, h).toBeGreaterThanOrEqual(2);
      expect(m.bad, h).toEqual([]);
    }
    // health: เวลากินยาในกล่องยา (span.hl-time ใน flex-wrap)
    await openAt(page, '/health.html', 360);
    await page.evaluate(() => {
      const t = document.getElementById('mTimes');
      t.innerHTML = '<span class="hl-time"><input class="input" type="time" value="08:00"><button class="btn sm icon ghost" type="button">x</button></span>' +
        '<span class="hl-time"><input class="input" type="time" value="20:00"><button class="btn sm icon ghost" type="button">x</button></span>';
    });
    let m = await measureDates(page, { unhide: true });
    expect(m.bad).toEqual([]);
    // report-dashboard: ตัวกรองวันที่ (label.db-filter-field ใน .db-filter-controls) + กล่องช่วงวันที่ (.rd-grid2 > .field)
    await openAt(page, '/report-dashboard.html', 360);
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'dashboardFilters';
      host.innerHTML = '<div class="db-filter-controls">' +
        '<label class="db-filter-field"><span>From</span><input id="dashboardDateFrom" type="date" value="2026-01-01"></label>' +
        '<label class="db-filter-field"><span>To</span><input id="dashboardDateTo" type="date" value="2026-10-11"></label></div>' +
        '<div class="rd-grid2"><div class="field"><label>From</label><input class="input" id="f24From" type="date" value="2026-01-01"></div>' +
        '<div class="field"><label>To</label><input class="input" id="f24To" type="date" value="2026-10-11"></div></div>';
      (document.querySelector('main') || document.body).prepend(host);
    });
    m = await measureDates(page);
    expect(m.count).toBeGreaterThanOrEqual(4);
    expect(m.bad).toEqual([]);
  });

  test('Chrome เดสก์ท็อป: ไอคอนปฏิทินยังอยู่ + กดเปิดตัวเลือกได้', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto('/budget.html#record');
    await page.locator('#toggleAddForm').click();
    const d = page.locator('.mp-entry-row .f-date').first();
    await expect(d).toBeVisible();
    const st = await d.evaluate((el) => ({
      ind: getComputedStyle(el, '::-webkit-calendar-picker-indicator').display,
      app: getComputedStyle(el).appearance,
      h: el.getBoundingClientRect().height,
      hType: el.closest('.frow').querySelector('.f-type').getBoundingClientRect().height,
    }));
    expect(st.ind).not.toBe('none');
    expect(st.app).toBe('none');
    expect(Math.abs(st.h - st.hType)).toBeLessThanOrEqual(1);
    await d.fill('2026-10-11');
    await expect(d).toHaveValue('2026-10-11');
  });
});

/* ── ข้อ 2: area.html ── */
test.describe('area.html — แถว "ใช้ล่าสุด" เว้นระยะจากกล่องข้างล่าง', () => {
  test.use({ serviceWorkers: 'block' });
  for (const w of [390, 1100]) {
    test(`ระยะ ≥ --ome-card-gap ที่ ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.addInitScript(() => {
        const now = Date.now();
        localStorage.setItem('tanot:nav:last', JSON.stringify({ 'budget.html': now - 60000, 'health.html': now - 120000, 'car.html': now - 180000 }));
      });
      await page.goto('/area.html?a=life');
      await expect(page.locator('.area-sec')).toBeVisible();
      const r = await page.evaluate(() => {
        const sec = document.querySelector('.area-sec'), cols = document.querySelector('.tile-cols');
        const first = cols.firstElementChild;
        const gap = parseFloat(getComputedStyle(document.body).getPropertyValue('--ome-card-gap'));
        return { space: first.getBoundingClientRect().top - sec.getBoundingClientRect().bottom, gap };
      });
      expect(r.gap).toBeGreaterThan(0);
      expect(r.space).toBeGreaterThanOrEqual(r.gap - 0.5);
    });
  }

  test('ไม่มีข้อมูลใช้ล่าสุด = ไม่มีช่องว่างเพิ่ม', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/area.html?a=life');
    await expect(page.locator('.tile-cols')).toBeVisible();
    expect(await page.locator('.area-sec').count()).toBe(0);
    const r = await page.evaluate(() => {
      const head = document.querySelector('.page-head'), cols = document.querySelector('.tile-cols');
      return cols.getBoundingClientRect().top - head.getBoundingClientRect().bottom;
    });
    // เทียบกับระยะเดิมก่อนแก้ (หัวหน้า → กล่องแรก) — ต้องไม่เกิน card-gap + ระยะหัวหน้าเดิม
    expect(r).toBeLessThan(60);
  });
});

/* ── ข้อ 3: แถบเซสชันหมดอายุ (sw.js + session-guard.js) ── */
const state = { sw: 'ok', page: 'ok', hits: [] };
let server;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url, ORIGIN);
      const p = url.pathname;
      if (p === '/__mode') {
        for (const k of ['sw', 'page']) if (url.searchParams.has(k)) state[k] = url.searchParams.get(k);
        if (url.searchParams.has('clear')) state.hits = [];
        res.end(JSON.stringify(state)); return;
      }
      if (p.startsWith('/api/') || p.startsWith('/cdn-cgi/') || req.headers['sec-fetch-mode'] === 'navigate') state.hits.push({ p: p + url.search, mode: req.headers['sec-fetch-mode'] || '' });
      if (p === '/api/session') {
        const ok = (url.searchParams.get('via') === 'page' ? state.page : state.sw) === 'ok';
        if (ok) { res.setHeader('Content-Type', 'application/json'); res.end('{"email":"owner@example.com"}'); return; }
        res.writeHead(302, { Location: LOGIN }); res.end(); return;
      }
      if (p === '/cdn-cgi/access/logout') {
        // Access ล้างคุกกี้ของแอป → เข้าใหม่ผ่าน (ทั้ง SW และหน้าเว็บ) แล้วส่งต่อไปโดเมนทีม
        state.page = 'ok'; state.sw = 'ok';
        res.writeHead(302, { Location: 'http://team.invalid/cdn-cgi/access/logout', 'Set-Cookie': 'CF_Authorization=; Max-Age=0; Path=/' }); res.end(); return;
      }
      if (p === '/api/sync') {
        if (state.page !== 'ok') { res.writeHead(302, { Location: LOGIN }); res.end(); return; }
        const body = await new Promise((ok) => { const b = []; req.on('data', (c) => b.push(c)); req.on('end', () => ok(Buffer.concat(b))); });
        const r = await fetch(SYNC + p + url.search, { method: req.method, headers: { 'Content-Type': 'application/json' }, body: req.method === 'POST' ? body : undefined });
        res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(Buffer.from(await r.arrayBuffer())); return;
      }
      if (p.startsWith('/api/')) { res.writeHead(404); res.end('{}'); return; }
      // Pages: x.html → 308 → /x (คง query) · /x → x.html
      if (/\.html$/.test(p) && p !== '/index.html') { res.writeHead(308, { Location: p.slice(0, -5) + url.search }); res.end(); return; }
      let f = p === '/' || p === '/index.html' ? '/index.html' : p;
      if (!path.extname(f)) f += '.html';
      const file = path.join(ROOT, decodeURIComponent(f));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    }).listen(PORT, '127.0.0.1', resolve);
  });
}

test.describe('sw.js — แถบเซสชันหมดอายุ', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({
    serviceWorkers: 'allow',
    baseURL: ORIGIN,
  });
  test.beforeAll(async () => { await startServer(); });
  test.afterAll(async () => { await new Promise((r) => server.close(r)); });
  test.beforeEach(async ({ request }) => {
    state.sw = 'ok'; state.page = 'ok'; state.hits = [];
    await request.post(SYNC + '/__reset');
  });

  // ลง SW + precache ให้ครบ แล้วกลับมาที่ index (ควบคุมโดย SW)
  async function primed(context) {
    const page = await context.newPage();
    await page.goto('/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('sw.js');
      const reg = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      void reg;
    });
    // หน้า budget ต้องอยู่ในแคช (PRECACHE มี budget.html)
    await page.waitForFunction(async () => !!(await caches.match('budget.html')) && !!(await caches.match('session-guard.js')), null, { timeout: 30000 });
    // tanot-data ซิงก์รอบแรกผ่าน → บอก SW ว่าเซสชันใช้ได้ (ตั้งใจ) — รอให้จบแล้วล้างความเชื่อ ให้ทุกเทสต์เริ่มจาก "SW ยังไม่รู้"
    await page.waitForFunction(() => window.TanotData && window.TanotData.status().state !== 'idle' && window.TanotData.status().state !== 'syncing', null, { timeout: 15000 });
    await page.evaluate(() => new Promise((ok) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => ok();
      navigator.serviceWorker.controller.postMessage({ type: 'tanot:session', ok: false }, [ch.port2]);
    }));
    return page;
  }
  const navs = () => state.hits.filter((h) => h.mode === 'navigate').map((h) => h.p);

  test('SW ว่าหมดอายุ แต่หน้าเว็บเข้า /api/session ได้ → ไม่มีแถบ ไม่วนรีโหลด + บันทึกปัญหา + SW เชื่อ 10 นาที', async ({ context }) => {
    const page = await primed(context);
    state.sw = 'expired'; state.page = 'ok'; state.hits = [];
    await page.evaluate(() => { location.href = 'budget.html'; });
    await page.waitForURL(/\/budget$/);
    await page.waitForLoadState('load');
    await page.waitForTimeout(800);
    await expect(page.locator('#tanot-relogin')).toHaveCount(0); // หน้าจริงจากเครือข่าย ไม่ใช่หน้าแคชที่ฉีดแถบ
    const n1 = navs().length;
    expect(n1).toBeLessThanOrEqual(3); // budget.html (308) → /budget …(SW ตัดสิน) → budget.html อีกรอบ → /budget — ไม่วน
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]').filter((r) => r.kind === 'session'));
    expect(log.length).toBe(1);
    expect(log[0].msg).toBe('sw=opaqueredirect/0 page=basic/200 -> ok reload');
    expect(log[0].code).toBe('info');
    expect(JSON.stringify(log[0])).not.toContain('owner@example.com');
    // เปลี่ยนหน้าต่อ: SW เชื่อผลของหน้าเว็บ (ไม่ถาม /api/session ของตัวเอง ไม่เสิร์ฟหน้าแคช)
    state.hits = [];
    await page.evaluate(() => { location.href = 'health.html'; });
    await page.waitForURL(/\/health$/);
    await page.waitForLoadState('load');
    await expect(page.locator('#tanot-relogin')).toHaveCount(0);
    expect(state.hits.filter((h) => h.p.startsWith('/api/session')).length).toBe(0);
  });

  test('หมดอายุจริงทั้ง SW และหน้าเว็บ → แถบขึ้น + จำนวนรอซิงก์ (ไม่มีเนื้อหา) + ภาษาอังกฤษ', async ({ context }) => {
    const page = await primed(context);
    state.sw = 'expired'; state.page = 'expired';
    await page.evaluate(() => {
      localStorage.setItem('tanot-sync:dirty', JSON.stringify({ 'budget:records': Date.now(), 'tanot:health:vitals': Date.now() }));
    });
    await page.evaluate(() => { location.href = 'budget.html'; });
    const bar = page.locator('#tanot-relogin');
    await expect(bar).toBeVisible();
    // จำนวน = TanotData.status().pending (คิว tanot-sync:dirty) — แสดงแค่ตัวเลข ไม่มีชื่อคีย์/เนื้อหา
    const n = await page.evaluate(() => window.TanotData.status().pending);
    expect(n).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#tanot-relogin-msg')).toHaveText(`เซสชันหมดอายุ — กำลังแสดงหน้าจากแคช · มี ${n} รายการยังไม่ซิงก์ — เข้าสู่ระบบใหม่เพื่อส่ง`);
    expect(await bar.innerText()).not.toMatch(/budget:records|vitals/);
    await expect(page.locator('#tanot-relogin-go')).toHaveAttribute('href', /budget\.html\?relogin=1$/);
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]').filter((r) => r.kind === 'session'));
    expect(log.map((r) => r.msg)).toEqual([`sw=opaqueredirect/0 page=opaqueredirect/0 -> expired dirty=${n}`]);
    // ไม่วน: อยู่หน้าเดิม 1.5 วิ ไม่มีการนำทางเพิ่ม
    const before = navs().length;
    await page.waitForTimeout(1500);
    expect(navs().length).toBe(before);
    // อังกฤษ (ภาษาจาก theme-boot) + สลับสด
    await page.evaluate(() => window.OME_LANG.set('en'));
    await expect(page.locator('#tanot-relogin-msg')).toHaveText(`Session expired — showing the cached page · ${n} items not synced yet — sign in again to send them`);
    await expect(page.locator('#tanot-relogin-go')).toHaveText('Sign in again');
    await page.evaluate(() => window.OME_LANG.set('th'));
  });

  test('ไม่มีรายการรอซิงก์ = ไม่แสดงจำนวน', async ({ context }) => {
    const page = await primed(context);
    state.sw = 'expired'; state.page = 'expired';
    // หน้าที่ไม่เขียนข้อมูลตอนโหลด (budget.html เขียนหมวดเริ่มต้นตอนเปิดครั้งแรก → คิวไม่ว่าง)
    await page.evaluate(() => { localStorage.removeItem('tanot-sync:dirty'); location.href = 'notifications.html'; });
    await expect(page.locator('#tanot-relogin')).toBeVisible();
    expect(await page.evaluate(() => window.TanotData.status().pending)).toBe(0);
    await expect(page.locator('#tanot-relogin-msg')).toHaveText('เซสชันหมดอายุ — กำลังแสดงหน้าจากแคช');
  });

  test('เข้าสู่ระบบใหม่: navigate ธรรมดายังไม่ผ่าน → logout (fetch) → กลับหน้าเดิม → ผ่าน → ส่งคิวซิงก์ทันที', async ({ context }) => {
    const page = await primed(context);
    state.sw = 'expired'; state.page = 'expired';
    await page.evaluate(() => {
      const recs = [{ id: 'r-relogin', date: '2026-10-11', type: 'expense', categoryId: 'cat-food', amount: 99, note: '' }];
      localStorage.setItem('budget:records', JSON.stringify(recs));
      location.href = 'budget.html';
    });
    await expect(page.locator('#tanot-relogin')).toBeVisible();
    state.hits = [];
    await page.locator('#tanot-relogin-go').click();
    // relogin=1 → (หน้าเว็บยังเข้าไม่ได้) → fetch /cdn-cgi/access/logout → relogin=2 → ผ่าน → URL สะอาด
    await page.waitForURL(/\/budget$/, { timeout: 15000 });
    await expect.poll(() => state.hits.some((h) => h.p.startsWith('/cdn-cgi/access/logout'))).toBe(true);
    const logout = state.hits.find((h) => h.p.startsWith('/cdn-cgi/access/logout'));
    expect(logout.mode).not.toBe('navigate'); // ไม่พาหน้าไปค้างที่หน้า logout
    await expect.poll(() => navs().filter((p) => p.indexOf('relogin=2') !== -1).length).toBe(1); // replaceState ทำให้ URL สะอาดก่อนขั้น 2 — รอการนำทางจริง
    await page.waitForURL(/\/budget$/);
    await page.waitForLoadState('load');
    // คิวถูกส่งถึง /api/sync จริง (sync-server 8142) — budget:records ขึ้นเซิร์ฟเวอร์
    await expect.poll(async () => {
      const r = await (await fetch(SYNC + '/api/sync?since=0&limit=200')).json();
      return r.docs.some((d) => d.id === 'r-relogin' || (d.data || '').indexOf('r-relogin') !== -1);
    }, { timeout: 15000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('tanot-sync:dirty') || '{}')).length)).toBe(0);
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]').filter((r) => r.kind === 'session').map((r) => r.msg));
    expect(log[0]).toMatch(/^sw=opaqueredirect\/0 page=opaqueredirect\/0 -> expired dirty=[1-9]\d*$/);
    expect(log.slice(1)).toEqual(['stage=1 page=opaqueredirect/0 -> logout', 'stage=2 page=basic/200 -> ok']);
  });

  test('relogin=2 ยังไม่ผ่าน → แจ้ง ไม่วนต่อ', async ({ context }) => {
    const page = await primed(context);
    state.page = 'expired';
    await page.route('**/cdn-cgi/access/logout', (r) => r.fulfill({ status: 200, body: 'logged out' })); // logout ไม่ช่วย
    state.hits = [];
    await page.goto('/budget?relogin=1');
    await page.waitForURL(/\/budget$/);
    await expect(page.locator('.toast, [role=status]').filter({ hasText: 'ยังเข้าสู่ระบบไม่ได้' }).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    expect(navs().filter((p) => /relogin=/.test(p)).length).toBe(2); // relogin=1 + relogin=2 เท่านั้น
  });

  test('tanot-data: 401/403/redirect = สถานะ auth คิวไม่หาย · กลับมาผ่าน = ส่งทันทีและบอก SW', async ({ context }) => {
    const page = await primed(context);
    await page.goto('/budget');
    await page.evaluate(() => {
      const recs = [{ id: 'r-auth', date: '2026-10-11', type: 'expense', categoryId: 'cat-food', amount: 5, note: '' }];
      localStorage.setItem('budget:records', JSON.stringify(recs));
    });
    for (const [mode, status] of [['redirect', 302], ['401', 401], ['403', 403]]) {
      await page.route('**/api/sync**', (r) => (status === 302
        ? r.fulfill({ status: 302, headers: { Location: LOGIN } })
        : r.fulfill({ status, contentType: 'application/json', body: '{"error":"x"}' })));
      const st = await page.evaluate(() => window.TanotData.syncNow().then((s) => ({ state: s.state, pending: s.pending })));
      expect(st.state, mode).toBe('auth');
      expect(st.pending, mode).toBeGreaterThan(0);
      await page.unroute('**/api/sync**');
    }
    // SW ได้ยิน "ไม่ผ่าน" จาก tanot-data → ไม่เชื่อ (หน้าถัดไปจะตรวจใหม่)
    const trust = () => page.evaluate(async () => {
      const hit = await (await caches.open('ome-state-v1')).match('/__tanot-sw/session-ok');
      return hit ? Number(await hit.text()) > Date.now() : false;
    });
    await expect.poll(trust).toBe(false);
    const st = await page.evaluate(() => window.TanotData.syncNow().then((s) => ({ state: s.state, pending: s.pending })));
    expect(st).toEqual({ state: 'ok', pending: 0 });
    await expect.poll(trust).toBe(true);
  });

  test('โดเมนที่ไม่ใช่ pages.dev: ไม่ถาม /api/session ไม่ฉีดแถบ (พฤติกรรมเดิม)', async ({ browser }) => {
    const ctx = await browser.newContext({ serviceWorkers: 'allow', baseURL: 'http://localhost:8123' });
    const page = await ctx.newPage();
    await page.goto('/index.html');
    await page.evaluate(async () => { await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    // python http.server ตอบ 301 เมื่อขอโฟลเดอร์ไม่มี / ท้าย → การนำทางของ SW ได้ opaqueredirect เหมือนที่ Pages ตัด .html
    await page.evaluate(() => { location.href = 'vendor'; });
    await page.waitForURL(/\/vendor\/$/);
    await expect(page.locator('#tanot-relogin')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]').filter((r) => r.kind === 'session').length)).toBe(0);
    await ctx.close();
  });
});
