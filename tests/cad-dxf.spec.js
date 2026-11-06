// @ts-check
// นำเข้า DXF ด้วย CADCraft (vendor/craft/cadcraft-*, wasm ตัวจริงที่ build จาก tools/wasm/cadcraft-dxf) — ปุ่ม "นำเข้า DXF" ของ cad.html
// DXF ทุกไฟล์สร้างในเทสต์ (เขียน group code เอง) — ห้ามใช้ไฟล์ของเจ้าของ
const { test, expect } = require('@playwright/test');

/* ── ตัวสร้าง DXF ── */
const g = (...pairs) => pairs.map(([c, v]) => c + '\n' + v + '\n').join('');
const header = (ver, extra = []) => g([0, 'SECTION'], [2, 'HEADER'], [9, '$ACADVER'], [1, ver], ...extra, [0, 'ENDSEC']);
const section = (name, body) => g([0, 'SECTION'], [2, name]) + body + g([0, 'ENDSEC']);
const EOF = g([0, 'EOF']);
const layerTable = (...layers) => section('TABLES', g([0, 'TABLE'], [2, 'LAYER'], [70, layers.length]) +
  layers.map(([n, c]) => g([0, 'LAYER'], [2, n], [70, 0], [62, c], [6, 'CONTINUOUS'])).join('') + g([0, 'ENDTAB']));

/* R2000: เลเยอร์ + สี, LINE/CIRCLE/ARC, LWPOLYLINE ที่มีส่วนโค้ง (bulge), TEXT, MTEXT 2 บรรทัด,
   บล็อกซ้อน (B2 ใส่ B1 หมุน 90°) วางด้วย INSERT ที่ย่อขยาย 2 เท่า + IMAGE (ข้าม) */
const BASIC = header('AC1015') + layerTable(['0', 7], ['WALL', 1]) +
  section('BLOCKS',
    g([0, 'BLOCK'], [8, '0'], [2, 'B1'], [70, 0], [10, 0], [20, 0], [30, 0],
      [0, 'LINE'], [8, '0'], [10, 0], [20, 0], [30, 0], [11, 10], [21, 0], [31, 0], [0, 'ENDBLK'], [8, '0']) +
    g([0, 'BLOCK'], [8, '0'], [2, 'B2'], [70, 0], [10, 0], [20, 0], [30, 0],
      [0, 'INSERT'], [8, '0'], [2, 'B1'], [10, 5], [20, 0], [30, 0], [50, 90], [0, 'ENDBLK'], [8, '0'])) +
  section('ENTITIES', g(
    [0, 'LINE'], [8, 'WALL'], [10, 0], [20, 0], [30, 0], [11, 100], [21, 50], [31, 0],
    [0, 'CIRCLE'], [8, '0'], [10, 5], [20, 5], [30, 0], [40, 2.5],
    [0, 'ARC'], [8, '0'], [10, 0], [20, 0], [30, 0], [40, 10], [50, 0], [51, 90],
    [0, 'LWPOLYLINE'], [8, '0'], [90, 3], [70, 1], [10, 0], [20, 0], [42, 1], [10, 10], [20, 0], [10, 10], [20, 10],
    [0, 'TEXT'], [8, '0'], [10, 1], [20, 2], [30, 0], [40, 3], [1, 'Hello'],
    [0, 'MTEXT'], [8, '0'], [10, 0], [20, 20], [30, 0], [40, 2], [1, '\\fArial|b0;Line1\\PLine2'],
    [0, 'INSERT'], [8, 'WALL'], [2, 'B2'], [10, 100], [20, 0], [30, 0], [41, 2], [42, 2], [43, 2],
    [0, 'IMAGE'], [8, '0'], [10, 0], [20, 0], [30, 0])) + EOF;

/* R12 + $DWGCODEPAGE ANSI_874: ข้อความ/ชื่อเลเยอร์ไทยเป็นไบต์ TIS-620, POLYLINE/VERTEX, ARC ที่ extrusion −Z (กลับด้าน) */
function tis620(str) {
  return Buffer.from([...str].map((ch) => { const c = ch.codePointAt(0); return c >= 0x0e01 && c <= 0x0e5b ? c - 0x0e00 + 0xa0 : c; }));
}
const THAI = tis620(header('AC1009', [[9, '$DWGCODEPAGE'], [3, 'ANSI_874']]) + section('ENTITIES', g(
  [0, 'TEXT'], [8, 'ผนัง'], [10, 0], [20, 0], [30, 0], [40, 2.5], [1, 'ห้องนอน'],
  [0, 'POLYLINE'], [8, '0'], [66, 1], [70, 0], [10, 0], [20, 0], [30, 0],
  [0, 'VERTEX'], [8, '0'], [10, 0], [20, 0], [30, 0], [0, 'VERTEX'], [8, '0'], [10, 10], [20, 0], [30, 0],
  [0, 'VERTEX'], [8, '0'], [10, 10], [20, 10], [30, 0], [0, 'SEQEND'], [8, '0'],
  [0, 'ARC'], [8, '0'], [10, 5], [20, 0], [30, 0], [40, 1], [50, 0], [51, 90], [210, 0], [220, 0], [230, -1])) + EOF);

/* ELLIPSE เต็มวง + SPLINE (กำลัง 3, 4 จุดควบคุม) */
const CURVES = header('AC1015') + section('ENTITIES', g(
  [0, 'ELLIPSE'], [8, '0'], [10, 0], [20, 0], [30, 0], [11, 10], [21, 0], [31, 0], [40, 0.5], [41, 0], [42, 2 * Math.PI],
  [0, 'SPLINE'], [8, '0'], [70, 8], [71, 3], [72, 8], [73, 4], ...[0, 0, 0, 0, 1, 1, 1, 1].map((k) => [40, k]),
  [10, 0], [20, 0], [30, 0], [10, 1], [20, 2], [30, 0], [10, 3], [20, 2], [30, 0], [10, 4], [20, 0], [30, 0])) + EOF;

/* DXF แบบ binary (R2000: group code 2 ไบต์) — LINE 1 เส้นบนเลเยอร์ BIN */
function binaryDxf(pairs) {
  const parts = [Buffer.from('AutoCAD Binary DXF\r\n\x1a\x00', 'latin1')];
  for (const [c, v] of pairs) {
    const code = Buffer.alloc(2); code.writeUInt16LE(c); parts.push(code);
    if ((c >= 10 && c < 60) || (c >= 110 && c < 150) || (c >= 210 && c < 240)) { const b = Buffer.alloc(8); b.writeDoubleLE(v); parts.push(b); }
    else if ((c >= 60 && c < 80) || (c >= 170 && c < 180)) { const b = Buffer.alloc(2); b.writeInt16LE(v); parts.push(b); }
    else if (c >= 90 && c < 100) { const b = Buffer.alloc(4); b.writeInt32LE(v); parts.push(b); }
    else parts.push(Buffer.from(String(v) + '\0', 'latin1'));
  }
  return Buffer.concat(parts);
}
const BINARY = binaryDxf([[0, 'SECTION'], [2, 'HEADER'], [9, '$ACADVER'], [1, 'AC1015'], [0, 'ENDSEC'],
  [0, 'SECTION'], [2, 'ENTITIES'], [0, 'LINE'], [8, 'BIN'], [10, 1], [20, 2], [30, 0], [11, 3], [21, 4], [31, 0], [0, 'ENDSEC'], [0, 'EOF']]);

/* DIMENSION แนวนอน 0→100 (ไม่มีบล็อกภาพมิติในไฟล์ — CADCraft วาดเองตามรูปแบบมิติ) + HATCH สี่เหลี่ยม (เอาขอบ) */
const DIMHATCH = header('AC1015') + section('ENTITIES', g(
  [0, 'DIMENSION'], [8, 'DIM'], [2, ''], [10, 0], [20, 10], [30, 0], [11, 50], [21, 10], [31, 0], [70, 32], [1, ''], [3, 'Standard'],
  [13, 0], [23, 0], [33, 0], [14, 100], [24, 0], [34, 0], [50, 0],
  [0, 'HATCH'], [8, 'H'], [10, 0], [20, 0], [30, 0], [210, 0], [220, 0], [230, 1], [2, 'SOLID'], [70, 1], [71, 0], [91, 1], [92, 1], [93, 4],
  [72, 1], [10, 0], [20, 0], [11, 10], [21, 0], [72, 1], [10, 10], [20, 0], [11, 10], [21, 10],
  [72, 1], [10, 10], [20, 10], [11, 0], [21, 10], [72, 1], [10, 0], [20, 10], [11, 0], [21, 0], [97, 0], [75, 0], [76, 1], [98, 0])) + EOF;

const EMPTY = header('AC1015') + section('ENTITIES', '') + EOF;

async function setup(context, page, { wasm404 = false } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push(m.text()); }); // ภายนอกที่บล็อกเอง (ฟอนต์/CDN) ไม่นับ
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (wasm404 && /\/vendor\/craft\/cadcraft-[^/]+\/cadcraft_dxf_bg\.wasm$/.test(u.pathname)) return route.fulfill({ status: 404, body: '' });
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    if (u.hostname === 'cdn.jsdelivr.net' && /\.m?js$/.test(u.pathname)) return route.fulfill({ contentType: 'application/javascript', body: '' });
    return route.abort('internetdisconnected');
  });
  return { errors };
}

/* เรียก cad-dxf-worker.js ตรงๆ ในหน้า → {ok, data} | {ok:false, dxf|craft} */
async function viaWorker(page, buf) {
  return page.evaluate((b64) => new Promise((resolve) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const w = new Worker('cad-dxf-worker.js');
    w.onmessage = (e) => { w.terminate(); const d = e.data; delete d.ms; resolve(d); };
    w.postMessage({ bytes: bytes.buffer }, [bytes.buffer]);
  }), Buffer.from(buf).toString('base64'));
}
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-4);

test.describe('CADCraft (wasm ตัวจริง) — อ่าน DXF', () => {
  test.beforeEach(async ({ context, page }) => { await setup(context, page); await page.goto('/cad.html'); });

  test('ชนิดพื้นฐาน + bulge + MTEXT + บล็อกซ้อน/หมุน/ย่อขยาย + เลเยอร์/สี + ชนิดที่ข้าม', async ({ page }) => {
    const r = await viaWorker(page, BASIC);
    expect(r.ok).toBe(true);
    const { layers, entities, skipped } = r.data;
    expect(layers).toEqual([{ n: 'WALL', c: '#ff0000' }, { n: '0', c: null }]);
    const by = (t) => entities.filter((e) => e.t === t);
    expect(by('line')[0]).toEqual({ t: 'line', l: 0, a: [0, 0], b: [100, 50] });
    expect(by('circle')).toEqual([{ t: 'circle', l: 1, c: [5, 5], r: 2.5 }]);
    expect(by('arc')[0]).toMatchObject({ c: [0, 0], r: 10, a0: 0 });
    expect(by('arc')[0].a1).toBeCloseTo(Math.PI / 2, 5);
    // bulge 1 = ครึ่งวงกลมใต้แกน x จาก (0,0) ไป (10,0) แล้วเส้นตรงไป (10,10) · ปิดรูป
    const pl = by('poly')[0];
    expect(pl.c).toBe(true);
    expect(pl.p.length).toBeGreaterThan(10);
    expect(Math.min(...pl.p.map((p) => p[1]))).toBeCloseTo(-5, 1); // จุดแทนเส้นโค้งเบี่ยงได้ ≤ 0.2% ของรัศมี
    expect(pl.p[pl.p.length - 1]).toEqual([10, 10]);
    expect(by('text').map((e) => e.s)).toEqual(['Hello', 'Line1', 'Line2']);
    // B2 ที่ (100,0) ×2 → B1 ที่ (5,0) หมุน 90° → เส้น (0,0)-(10,0) กลายเป็น (110,0)-(110,20) บนเลเยอร์ของ INSERT (บล็อกอยู่เลเยอร์ 0)
    const ins = by('line')[1];
    expect(ins.l).toBe(0);
    expect(near(ins.a, [110, 0]) && near(ins.b, [110, 20])).toBe(true);
    expect(skipped).toEqual({ IMAGE: 1 });
  });

  test('R12 ANSI_874: ข้อความ/เลเยอร์ไทยถูกต้อง · POLYLINE/VERTEX · ARC extrusion −Z กลับด้าน', async ({ page }) => {
    const r = await viaWorker(page, THAI);
    expect(r.ok).toBe(true);
    expect(r.data.layers.map((l) => l.n)).toEqual(['ผนัง', '0']);
    expect(r.data.entities[0]).toMatchObject({ t: 'text', s: 'ห้องนอน', l: 0 });
    expect(r.data.entities[1]).toEqual({ t: 'poly', l: 1, p: [[0, 0], [10, 0], [10, 10]], c: false });
    const arc = r.data.entities[2];
    expect(arc.c).toEqual([-5, 0]);
    expect(arc.a0).toBeCloseTo(Math.PI / 2, 5);
    expect(arc.a1).toBeCloseTo(Math.PI, 5);
  });

  test('ELLIPSE เต็มวง = รูปปิด · SPLINE ผ่านจุดปลายทั้งสอง', async ({ page }) => {
    const r = await viaWorker(page, CURVES);
    const [el, sp] = r.data.entities;
    expect(el.c).toBe(true);
    expect(Math.max(...el.p.map((p) => p[1]))).toBeCloseTo(5, 1);
    expect(sp.c).toBe(false);
    expect(sp.p[0]).toEqual([0, 0]);
    expect(sp.p[sp.p.length - 1]).toEqual([4, 0]);
    expect(sp.p.length).toBeLessThan(400);
  });

  test('DIMENSION = เส้นช่วย/เส้นมิติ/หัวลูกศร + ค่าตัวเลข · HATCH = ขอบเป็นรูปปิด', async ({ page }) => {
    const r = await viaWorker(page, DIMHATCH);
    const dim = r.data.entities.filter((e) => e.l === 0);
    const txt = dim.find((e) => e.t === 'text');
    expect(txt.s).toBe('100.0000');
    expect(Math.abs(txt.p[0] + txt.s.length * txt.h * 0.3 - 50)).toBeLessThan(1e-3); // วางให้กึ่งกลางอยู่ที่ x = 50
    expect(dim.filter((e) => e.t === 'poly' && !e.c).length).toBe(4); // เส้นช่วย 2 + เส้นมิติ 2 ท่อน (เว้นที่ข้อความ)
    expect(dim.filter((e) => e.t === 'poly' && e.c).length).toBe(2); // หัวลูกศร 2
    expect(r.data.entities.find((e) => e.l === 1)).toEqual({ t: 'poly', l: 1, p: [[0, 0], [10, 0], [10, 10], [0, 10]], c: true });
  });

  test('DXF แบบ binary อ่านได้', async ({ page }) => {
    const r = await viaWorker(page, BINARY);
    expect(r.data).toEqual({ layers: [{ n: 'BIN', c: null }], entities: [{ t: 'line', l: 0, a: [1, 2], b: [3, 4] }], skipped: {}, truncated: false });
  });

  test('ไม่ใช่ DXF = damaged · ไม่มีอะไรให้นำเข้า = empty (รหัสเท่านั้น ไม่มีเนื้อหาไฟล์)', async ({ page }) => {
    expect(await viaWorker(page, Buffer.from('hello, not a dxf'))).toEqual({ ok: false, dxf: 'damaged' });
    expect(await viaWorker(page, EMPTY)).toEqual({ ok: false, dxf: 'empty' });
  });
});

test.describe('cad.html — ปุ่มนำเข้า DXF', () => {
  /* cad.html เปลี่ยน alert() เป็น tanotAlert (<dialog class="dialog">) → อ่านข้อความแล้วกดตกลง */
  async function importFile(page, name, buffer) {
    await page.setInputFiles('#importDxfInput', { name, mimeType: 'application/dxf', buffer: Buffer.from(buffer) });
    const dlg = page.locator('dialog.dialog[open]');
    await expect(dlg).toBeVisible({ timeout: 30000 });
    const msg = await dlg.locator('.dialog-msg').textContent();
    await dlg.locator('.btn.primary').click();
    await expect(dlg).toHaveCount(0);
    return msg;
  }

  test('นำเข้าแล้ว: ชิ้นงานต่อท้าย + เลือกไว้ · เลเยอร์ตามไฟล์ (สร้างใหม่ + สี) · บอกชนิดที่ข้าม · ไม่มี error', async ({ context, page }) => {
    const { errors } = await setup(context, page);
    await page.goto('/cad.html');
    const msg = await importFile(page, 'plan.dxf', BASIC);
    expect(msg).toContain('นำเข้า 8 เอนทิตี้');
    expect(msg).toContain('IMAGE ×1');
    await expect(page.locator('#statCount')).toHaveText('8');
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('tanot:cad:autosave') || '{"entities":[]}'));
    await expect.poll(async () => (await read()).entities.length).toBe(8);
    const saved = await read();
    const wallId = Object.keys(saved.layers).find((id) => saved.layers[id].name === 'WALL');
    expect(saved.layers[wallId].color).toBe('#ff0000');
    expect(saved.entities.filter((e) => e.layer === wallId)).toHaveLength(2);
    expect(saved.entities.find((e) => e.type === 'polyline').closed).toBe(true);
    await expect(page.locator('#importDxfBtn')).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('ไฟล์เสีย → ข้อความเดิม · ไม่มีอะไรนำเข้า', async ({ context, page }) => {
    await setup(context, page);
    await page.goto('/cad.html');
    expect(await importFile(page, 'x.dxf', 'garbage')).toBe('อ่านไฟล์นี้ไม่ได้ — ไม่ใช่ไฟล์ DXF หรือไฟล์เสียหาย');
    expect(await importFile(page, 'y.dxf', EMPTY)).toBe('ไม่พบสิ่งที่นำเข้าได้ในไฟล์ DXF นี้');
  });

  test('โหลด wasm ไม่ได้ (404) → ข้อความของตัวโหลดกลาง + problem log ไม่มีชื่อไฟล์ผู้ใช้ · ไม่นำเข้าอะไร', async ({ context, page }) => {
    await setup(context, page, { wasm404: true });
    await page.goto('/cad.html');
    expect(await importFile(page, 'ลับมาก.dxf', BASIC)).toBe('ไม่พบไฟล์ของเครื่องมือนี้บนเซิร์ฟเวอร์ — โหลดหน้าใหม่แล้วลองอีกครั้ง');
    const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));
    expect(rows.some((r) => r.kind === 'craft' && /cadcraft\/cadcraft_dxf_bg\.wasm/.test(r.model || ''))).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/ลับมาก/);
    await expect(page.locator('#statCount')).toHaveText('0');
  });

  test('ภาษาอังกฤษ: ข้อความนำเข้าเป็นอังกฤษ', async ({ context, page }) => {
    await setup(context, page);
    await page.addInitScript(() => localStorage.setItem('ome:lang', 'en'));
    await page.goto('/cad.html');
    const msg = await importFile(page, 'plan.dxf', BASIC);
    expect(msg).toContain('Imported 8 entities');
    expect(msg).toContain('Skipped unsupported types: IMAGE ×1');
  });
});
