// @ts-check
// โปรแกรมเขียนแบบ 2 มิติ (cad-pro.html + craft-app.js) — CADCraft แบบโปรแกรมเต็ม wasm ตัวจริงใน vendor/craft/cadcraft-app-*
// (build จาก tools/wasm/cadcraft-app) · DXF สร้างในเทสต์ — ห้ามใช้ไฟล์ของเจ้าของ
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor/craft/manifest.json'), 'utf8'));
const LIB = MAN.libs['cadcraft-app'];
const WASM_RE = /\/vendor\/craft\/cadcraft-app-[^/]+\/cadcraft_app_bg(\.\d+)?\.wasm$/;
const PARTS = LIB && LIB.wasm ? LIB.wasm.parts : ['cadcraft_app_bg.wasm'];
const WASM_BYTES = LIB && LIB.wasm ? LIB.wasm.bytes : LIB && LIB.files['cadcraft_app_bg.wasm'].bytes;

/* DXF R12 ASCII เล็กๆ: เส้น 2 เส้น วงกลม และข้อความไทย (TEXT + MTEXT) — UTF-8 + $DWGCODEPAGE ANSI_874 ไม่ใช้ (ข้อความเป็น \U+ ของ DXF) */
function thaiEsc(s) { return [...s].map((c) => (c.charCodeAt(0) > 127 ? '\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0') : c)).join(''); }
function sampleDxf() {
  const g = (code, v) => `${code}\n${v}\n`;
  let s = g(0, 'SECTION') + g(2, 'HEADER') + g(9, '$ACADVER') + g(1, 'AC1009') + g(0, 'ENDSEC');
  s += g(0, 'SECTION') + g(2, 'ENTITIES');
  s += g(0, 'LINE') + g(8, '0') + g(10, 0) + g(20, 0) + g(30, 0) + g(11, 100) + g(21, 0) + g(31, 0);
  s += g(0, 'LINE') + g(8, '0') + g(10, 100) + g(20, 0) + g(30, 0) + g(11, 100) + g(21, 60) + g(31, 0);
  s += g(0, 'CIRCLE') + g(8, '0') + g(10, 50) + g(20, 30) + g(30, 0) + g(40, 15);
  s += g(0, 'TEXT') + g(8, '0') + g(10, 5) + g(20, 70) + g(30, 0) + g(40, 6) + g(1, thaiEsc('ห้องนอน กว้าง 3.5 ม.'));
  s += g(0, 'MTEXT') + g(8, '0') + g(10, 5) + g(20, 90) + g(30, 0) + g(40, 5) + g(41, 80) + g(1, thaiEsc('แบบทดสอบ: น้ำ ผู้ใหญ่ กำแพง'));
  s += g(0, 'ENDSEC') + g(0, 'EOF');
  return Buffer.from(s, 'utf8');
}

async function setup(context, page, { wasm = 'ok' } = {}) {
  const errors = [];
  const wasmHits = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push(m.text()); });
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (WASM_RE.test(u.pathname)) {
      wasmHits.push(u.pathname);
      if (wasm === '404') return route.fulfill({ status: 404, body: '' });
      if (wasm === 'bad') return route.fulfill({ status: 200, contentType: 'application/wasm', body: Buffer.from('not the wasm') });
    }
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort('internetdisconnected');
  });
  return { errors, wasmHits };
}

async function ready(page) {
  await page.waitForFunction(() => window.__craftApp && window.__craftApp.isReady(), null, { timeout: 150000 });
  const app = page.frame({ url: /craft-frame\.html\?id=cadcraft&host=parent&canvas=cadcraft_canvas$/ });
  expect(app).toBeTruthy();
  return app;
}

test.describe('โปรแกรมเขียนแบบ 2 มิติ (CADCraft ตัวจริง)', () => {
  test.setTimeout(120000);

  test('manifest: ไฟล์ตรง sha256 · ≤ 25 MiB · license + OFL ฟอนต์ไทย · glue ไม่ import ไฟล์อื่น · ไม่มีลิงก์ ArtCraft', async () => {
    expect(LIB, 'libs["cadcraft-app"]').toBeTruthy();
    for (const [f, m] of Object.entries(LIB.files)) {
      const b = fs.readFileSync(path.join(ROOT, LIB.dir, f));
      expect(crypto.createHash('sha256').update(b).digest('hex'), f).toBe(m.sha256);
      expect(b.length, f).toBeLessThanOrEqual(25 * 1024 * 1024);
    }
    expect(Object.keys(LIB.files)).toEqual(expect.arrayContaining(['cadcraft_app.js', 'LICENSE-MIT', 'NOTICE.txt', 'THIRD-PARTY.txt', 'OFL-noto-sans-thai.txt', ...PARTS]));
    const whole = Buffer.concat(PARTS.map((f) => fs.readFileSync(path.join(ROOT, LIB.dir, f))));
    expect(whole.length).toBe(WASM_BYTES);
    if (LIB.wasm) expect(crypto.createHash('sha256').update(whole).digest('hex')).toBe(LIB.wasm.sha256);
    expect(whole.subarray(0, 4).toString('hex')).toBe('0061736d');
    expect(whole.toString('latin1')).not.toMatch(/getartcraft|discord\.gg/i);
    const glue = fs.readFileSync(path.join(ROOT, LIB.dir, 'cadcraft_app.js'), 'utf8');
    expect(glue).not.toMatch(/^\s*import\s.+from\s/m);
    // ซ่อน DWG: ตัวเลือกไฟล์รับแค่ .dxf/.shx
    expect(whole.toString('latin1')).toContain('.dxf,.shx');
    expect(whole.toString('latin1')).not.toContain('.dxf,.dwg,.shx');
  });

  test('คอม: แอปขึ้น · เปิด DXF ไทยได้ · ธีมสดตามเว็บ · บันทึก = ดาวน์โหลด .dxf · ไฟล์ล่าสุด · ไม่มี error · ไม่ออกเน็ต', async ({ context, page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const { errors, wasmHits } = await setup(context, page);
    await page.goto('/cad-pro.html');
    const app = await ready(page);
    expect(wasmHits.length).toBe(PARTS.length);
    await expect(page.locator('#craOver')).toBeHidden();
    await expect(page.locator('#craOpen')).toBeEnabled();
    await expect(page.locator('#craRecent')).not.toHaveAttribute('open', ''); // ยังไม่มีไฟล์ล่าสุด = ไม่เปิดเอง
    const box = await page.frameLocator('#craFrame').locator('canvas#cadcraft_canvas').boundingBox();
    expect(box && box.width).toBeGreaterThan(1000);

    // ธีม: เริ่มตามเว็บ (สว่าง) แล้วสลับสดเป็นมืดโดยไม่โหลดใหม่
    const theme = () => app.evaluate(() => window.cadcraft.execute('ui.theme', {}));
    await expect.poll(async () => (await theme()).theme).toBe('light');
    await page.evaluate(() => window.OmeTheme.set('theme', 'dark'));
    await expect.poll(async () => (await theme()).theme).toBe('dark');
    await page.evaluate(() => window.OmeTheme.set('theme', 'light'));
    await expect.poll(async () => (await theme()).theme).toBe('light');

    // เปิด DXF จากเครื่อง → แอปมีแบบ 5 ชิ้น
    const dxf = sampleDxf();
    await page.locator('#craFile').setInputFiles({ name: 'plan.dxf', mimeType: 'image/vnd.dxf', buffer: dxf });
    const inspect = () => app.evaluate(() => window.cadcraft.docInspect().catch(() => null));
    await expect.poll(async () => { const d = await inspect(); return d && d.entityCount; }, { timeout: 30000 }).toBe(5);
    const doc = await inspect();
    expect(doc.counts).toEqual({ Circle: 1, Line: 2, MText: 1, Text: 1 });
    // ไฟล์ที่เปิดผ่านหน้า (ยังไม่บันทึก) ต้องอยู่ในไฟล์ล่าสุดแล้ว — ไบต์ถูกโอนเข้า iframe จึงต้องคัดลอกก่อน
    await expect.poll(() => page.evaluate(() => window.__craftApp.recent().then((l) => l.map((r) => r.name + ':' + (r.size > 0))))).toContain('plan.dxf:true');
    // ข้อความไทยผ่าน \U+ ของ DXF ถูกอ่านเป็นอักษรไทย (สระ/วรรณยุกต์ซ้อน, ำ)
    expect(doc.entities.map((e) => e.geometry.value || e.geometry.contents).filter(Boolean)).toEqual(['ห้องนอน กว้าง 3.5 ม.', 'แบบทดสอบ: น้ำ ผู้ใหญ่ กำแพง']);
    await app.evaluate(() => window.cadcraft.execute('zoom', { option: 'extents' }).catch(() => null));
    await page.locator('#craFrame').screenshot({ path: testInfo.outputPath('cad-pro-thai.png') });

    // บันทึก (qsave) = แอปส่ง cadcraft:save → ดาวน์โหลด .dxf ในเครื่อง
    const dl = page.waitForEvent('download');
    // รุ่นเว็บไม่มี DWG: ตั้งรูปแบบบันทึกเป็น dwg ไม่ได้ + ไม่มีคำสั่งเมนู ui.saveformat.dwg
    const dwg = await app.evaluate(() => window.cadcraft.execute('ui.saveformat', { format: 'dwg' }).then(() => 'ok', (e) => String(e)));
    expect(dwg).toMatch(/unknown save format/);
    const cmds = JSON.stringify(await app.evaluate(() => window.cadcraft.commands()));
    expect(cmds).not.toContain('DWG Reference');
    // บันทึกแบบผู้ใช้: คลิกในแอปแล้ว Ctrl+S (แบบที่ยังไม่เคยบันทึก = แอปใช้ชื่อเดิม plan.dxf)
    await page.locator('#craFrame').click({ position: { x: 700, y: 420 } });
    await page.keyboard.press('Control+s');
    const file = await dl;
    expect(file.suggestedFilename()).toMatch(/\.dxf$/);
    const saved = fs.readFileSync(await file.path(), 'latin1');
    expect(saved).toContain('SECTION');

    // ไฟล์ล่าสุด: โหลดหน้าใหม่ → รายการเปิดเองพร้อมไฟล์ที่เปิด · ลบได้
    await expect.poll(() => page.evaluate(() => window.__craftApp.recent().then((l) => l.map((r) => r.name)))).toContain('plan.dxf');
    await page.reload();
    await ready(page);
    await expect(page.locator('#craRecent')).toHaveAttribute('open', '');
    await expect(page.locator('#craRecentList')).toContainText('plan.dxf');
    const n = await page.locator('#craRecentList li').count();
    await page.locator('#craRecentList li').first().getByRole('button', { name: /plan\.dxf/ }).click();
    await expect(page.locator('#craRecentList li')).toHaveCount(n - 1);
    expect(errors).toEqual([]);
  });

  test('ลากไฟล์มาวางบนหน้า = เปิดไฟล์', async ({ context, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setup(context, page);
    await page.goto('/cad-pro.html');
    const app = await ready(page);
    await app.evaluate(() => {
      window.__opened = [];
      window.addEventListener('message', (e) => { if (e.data && e.data.type === 'cadcraft:open') window.__opened.push(e.data.name); });
    });
    const b64 = sampleDxf().toString('base64');
    await page.evaluate((b) => {
      const bytes = Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], 'drop.dxf'));
      document.querySelector('.cra-bar').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    }, b64);
    await expect.poll(() => app.evaluate(() => window.__opened)).toEqual(['drop.dxf']);
  });

  test('มือถือ 390: ไม่โหลดเอง · ลิงก์หน้า CAD แบบง่าย + ปุ่มโปรแกรมเต็มบอก MB', async ({ context, page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { wasmHits } = await setup(context, page, { wasm: '404' });
    await page.goto('/cad-pro.html');
    await expect(page.locator('#craGate')).toBeVisible();
    const mb = ((LIB.files['cadcraft_app.js'].bytes + WASM_BYTES) / 1048576).toFixed(1);
    await expect(page.locator('#craSimple')).toBeVisible();
    await expect(page.locator('#craSimple')).toHaveAttribute('href', 'cad.html');
    await expect(page.locator('#craGo')).toContainText(mb + ' MB');
    expect(wasmHits).toEqual([]);
    expect(await page.locator('#craFrame').getAttribute('src')).toBeNull();
    await page.locator('#craGo').click();
    await expect(page.locator('#craErr')).toBeVisible();
  });

  test('แท็บเล็ต 820 แนวตั้ง: บอก MB + แนะนำหมุนจอ + ปุ่มเปิดต่อ · ไม่มีลิงก์หน้าแบบง่าย', async ({ context, page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    const { wasmHits } = await setup(context, page, { wasm: '404' });
    await page.goto('/cad-pro.html');
    await expect(page.locator('#craGate')).toBeVisible();
    await expect(page.locator('#craGateHint')).toBeVisible();
    await expect(page.locator('#craSimple')).toBeHidden();
    await expect(page.locator('#craGo')).toHaveClass(/primary/);
    expect(wasmHits).toEqual([]);
  });

  test('wasm 404 = ข้อความ th/en + ลองใหม่ + problem log', async ({ context, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setup(context, page, { wasm: '404' });
    await page.goto('/cad-pro.html');
    await expect(page.locator('#craErrText')).toContainText('ไม่พบไฟล์ของเครื่องมือนี้');
    await expect(page.locator('#craRetry')).toBeVisible();
    const log = await page.evaluate(() => localStorage.getItem('tanot:media:log') || '');
    expect(log).toContain('cadcraft-app/' + PARTS[0]);
    await page.evaluate(() => window.OME_LANG.set('en'));
    await expect(page.locator('#craErrText')).toContainText('were not found');
    await expect(page.locator('h1')).toHaveText('2D drafting');
  });

  test('ปุ่มเต็มจอ: แอปขยายเต็มจอ (ไม่มีแถบเมนูเว็บ) · กดซ้ำ/ออกแล้วปุ่มกลับเป็นเต็มจอ · EN', async ({ context, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setup(context, page);
    await page.goto('/cad-pro.html');
    await ready(page);
    const btn = page.locator('#craFull');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('เต็มจอ');
    await btn.click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement && document.fullscreenElement.className)).toBe('cra-stage');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => document.exitFullscreen());
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await page.evaluate(() => window.OME_LANG.set('en'));
    await expect(btn).toHaveText('Full screen');
  });

  test('เมนูภาษาไทยตามเว็บ: เริ่มเป็นไทย · สลับสด th → en → th · คำแปลไทยอยู่ใน wasm', async ({ context, page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const { errors } = await setup(context, page);
    await page.goto('/cad-pro.html');
    const app = await ready(page);
    const lang = () => app.evaluate(() => window.cadcraft.execute('options', {}).then((r) => r.interfaceLanguage));
    await expect.poll(lang).toBe('th');
    // รายการคำสั่งของแอปยังเป็นชื่ออังกฤษ (id ของคำสั่งไม่แปล)
    expect(JSON.stringify(await app.evaluate(() => window.cadcraft.commands()))).toContain('"line"');
    await page.locator('#craFrame').screenshot({ path: testInfo.outputPath('cad-pro-th.png') });
    await page.evaluate(() => window.OME_LANG.set('en'));
    await expect.poll(lang).toBe('en');
    await page.evaluate(() => window.OME_LANG.set('th'));
    await expect.poll(lang).toBe('th');
    expect(errors).toEqual([]);
  });

  test('th.tsv: ทุกแถวมี 3 คอลัมน์ · {ตัวแปร} และ ... ตรงต้นฉบับ · ฝังใน wasm', async () => {
    const tsv = fs.readFileSync(path.join(ROOT, 'tools/wasm/cadcraft-app/patches/0002-thai-interface.patch'), 'utf8')
      .split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
    const rows = tsv.filter((l) => /^(|menu|@plural)\t[^\t]+\t[^\t]+$/.test(l));
    expect(rows.length).toBeGreaterThan(1400);
    const ph = (s) => (s.match(/\{[^}]*\}/g) || []).sort().join();
    for (const r of rows) {
      const [, en, th] = r.split('\t');
      expect(ph(th), en).toBe(ph(en));
      expect(/(\.\.\.|…)$/.test(th), en).toBe(/(\.\.\.|…)$/.test(en));
      expect(th, en).not.toMatch(/ArtCraft|Discord/i);
    }
    const whole = Buffer.concat(PARTS.map((f) => fs.readFileSync(path.join(ROOT, LIB.dir, f)))).toString('utf8');
    expect(whole).toContain('ระบุจุดแรก');
    expect(whole).toContain('จัดการคุณสมบัติเลเยอร์');
  });

  test('ปุ่มเต็มจอไม่แสดงก่อนแอปพร้อม (มือถือ/ล้ม)', async ({ context, page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setup(context, page, { wasm: '404' });
    await page.goto('/cad-pro.html');
    await expect(page.locator('#craGate')).toBeVisible();
    await expect(page.locator('#craFull')).toBeHidden();
    await expect(page.locator('#craRecentBtn')).toBeHidden();
  });

  test('wasm ไม่ตรง sha256 = integrity', async ({ context, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setup(context, page, { wasm: 'bad' });
    await page.goto('/cad-pro.html');
    await expect(page.locator('#craErrText')).toContainText('เสียหายหรือไม่ครบ');
  });
});
