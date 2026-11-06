// @ts-check
// นำเข้า .pptx ด้วย DeckCraft (vendor/craft/deckcraft-*, wasm ตัวจริงที่ build จาก tools/wasm/deckcraft-pptx) — ปุ่ม "นำเข้าไฟล์" ของ slides.html
// pptx ทุกไฟล์สร้างในเทสต์ (ส่งออกจากหน้าเอง / เขียน XML เองด้วย jszip) — ห้ามใช้ไฟล์ของเจ้าของ
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { prepare } = require('./helpers');

const C = require(path.join(__dirname, '..', 'slides-calc.js'));
const SRV = 'http://localhost:8134';
test.describe.configure({ mode: 'serial' }); // เซิร์ฟเวอร์เดียวกับ slides.spec.js (มี /__reset)

/* ── pptx ที่เขียน XML เอง: ลำดับใน sldIdLst สลับกับเลขชื่อไฟล์ · หัวข้อ placeholder · bullet 2 ระดับ · ตาราง · โน้ต · สไลด์ซ่อน · ส่วนท้าย ── */
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const sp = (id, ph, paras) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr>${ph ? `<p:ph type="${ph}"${ph === 'body' ? ' idx="1"' : ''}/>` : ''}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>${paras.map(([lvl, t]) => `<a:p><a:pPr lvl="${lvl}"/><a:r><a:t>${t}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp>`;
const tbl = (rows) => `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="9" name="t"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblGrid>${rows[0].map(() => '<a:gridCol w="100"/>').join('')}</a:tblGrid>${rows.map((r) => `<a:tr h="10">${r.map((c) => `<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>${c}</a:t></a:r></a:p></a:txBody></a:tc>`).join('')}</a:tr>`).join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
const slideXml = (shapes, hidden) => `<?xml version="1.0" encoding="UTF-8"?><p:sld ${NS}${hidden ? ' show="0"' : ''}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree></p:cSld></p:sld>`;
async function handPptx() {
  const z = new JSZip();
  const slides = [ // [ไฟล์, xml, โน้ต] — sldIdLst เรียง 2, 1, 3
    ['slide1.xml', slideXml(sp(2, 'title', [[0, 'สไลด์ที่สอง']]) + tbl([['เดือน', 'ยอด'], ['ต.ค.', '100']])), null],
    ['slide2.xml', slideXml(sp(2, 'title', [[0, 'สไลด์แรก']]) + sp(3, 'body', [[0, 'ข้อหนึ่ง'], [1, 'ย่อยของข้อหนึ่ง'], [0, 'ข้อสอง']]) + sp(4, 'ftr', [[0, 'ส่วนท้าย']])), 'พูดเรื่องข้อหนึ่งก่อน'],
    ['slide3.xml', slideXml(sp(2, 'title', [[0, 'สไลด์ซ่อน']]), true), null],
  ];
  const ct = ['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
    ...slides.map(([f]) => `<Override PartName="/ppt/slides/${f}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`),
    '<Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>'];
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${ct.join('')}</Types>`);
  z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`);
  z.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8"?><p:presentation ${NS}><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/><p:sldId id="258" r:id="rId3"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  z.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slides.map(([f], i) => `<Relationship Id="rId${i + 1}" Type="${REL}/slide" Target="slides/${f}"/>`).join('')}</Relationships>`);
  slides.forEach(([f, xml]) => z.file('ppt/slides/' + f, xml));
  z.file('ppt/slides/_rels/slide2.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`);
  z.file('ppt/notesSlides/notesSlide1.xml', `<?xml version="1.0" encoding="UTF-8"?><p:notes ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${sp(2, 'body', [[0, 'พูดเรื่องข้อหนึ่งก่อน']])}</p:spTree></p:cSld></p:notes>`);
  return z.generateAsync({ type: 'nodebuffer' });
}

async function openPage(page, { wasm404 = false, lang } = {}) {
  const errors = await prepare(page, { theme: 'light' });
  if (lang) await page.addInitScript((l) => localStorage.setItem('ome:lang', l), lang);
  if (wasm404) await page.route(/\/vendor\/craft\/deckcraft-[^/]+\/deckcraft_pptx_bg\.wasm$/, (r) => r.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => {
    const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dlName = this.download; return c.apply(this, arguments); };
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/slides.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return errors;
}
const importPptx = (page, name, buffer) => page.setInputFiles('#importFile', { name, mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer });

test.describe('slides-calc.js — pptxToOutline', () => {
  test('หัวข้อ · bullet 2 ระดับ · ย่อหน้าธรรมดา · ตารางแรก (| ในเซลล์ → /) · โน้ต · ข้ามสไลด์ซ่อน · ไม่มีหัวข้อ = #', () => {
    const o = C.pptxToOutline({ slides: [
      { title: 'หัว\nข้อ', paras: [[0, 'คำบรรยาย', 0], [0, 'ก', 1], [1, 'ข', 1], [3, 'ค', 1]], tables: [[['a|b', 'c'], ['1', '2']], [['x']]], notes: ['โน้ต  หนึ่ง'], hidden: false },
      { title: 'ซ่อน', paras: [[0, 'z', 1]], tables: [], notes: [], hidden: true },
      { title: '', paras: [[0, '3', 0], [0, 'x'], [0, '3', 1]], tables: [], notes: [] },
    ] });
    expect(o).toBe('# หัว ข้อ\nคำบรรยาย\n- ก\n  - ข\n  - ค\n| a/b | c |\n| 1 | 2 |\n> โน้ต หนึ่ง\n\n#\n- x\n- 3');
    const p = C.parseOutline(o).slides;
    expect(p.map((s) => s.title)).toEqual(['หัว ข้อ', '']);
    expect(p[0].items).toEqual([{ t: 'คำบรรยาย', l: 0, bullet: false }, { t: 'ก', l: 0, bullet: true }, { t: 'ข', l: 1, bullet: true }, { t: 'ค', l: 1, bullet: true }]);
    expect(p[0].table).toEqual([['a/b', 'c'], ['1', '2']]);
    expect(p[0].notes).toBe('โน้ต หนึ่ง');
    expect(C.pptxToOutline(null)).toBe('');
  });
});

test.describe('slides.html — นำเข้า .pptx (DeckCraft wasm ตัวจริง)', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  test('ส่งออก .pptx จากหน้าเอง → นำเข้ากลับ = หัวข้อ/bullet/ระดับ/โน้ต/ตารางเดิม · ไม่มี error', async ({ page }) => {
    const errors = await openPage(page);
    const SRC = '# ประชุมไตรมาส 3\nสรุปผลงาน\n> สวัสดีครับ\n\n# ผลงาน\n- ยอดขายโต 10%\n  - ภาคเหนือโตสูงสุด\n- กำไรเพิ่มขึ้น\n> เน้นภาคเหนือ\n\n# ตารางยอดขาย\n| เดือน | ยอด |\n| ต.ค. | 100 |';
    await page.click('#newBtn');
    await page.fill('#outline', SRC);
    await expect(page.locator('#preview .sl-card')).toHaveCount(3);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pptxBtn')]);
    const buf = fs.readFileSync(await dl.path());
    await page.click('#newBtn');
    await page.fill('#outline', '');
    await importPptx(page, 'round.pptx', buf);
    await expect.poll(() => page.inputValue('#outline'), { timeout: 30000 }).toContain('# ตารางยอดขาย');
    const back = C.parseOutline(await page.inputValue('#outline')).slides;
    const orig = C.parseOutline(SRC).slides;
    expect(back.map((s) => s.title)).toEqual(orig.map((s) => s.title));
    expect(back.map((s) => s.items.map((x) => [x.t, x.l, x.bullet]))).toEqual(orig.map((s) => s.items.map((x) => [x.t, x.l, x.bullet])));
    expect(back.map((s) => s.notes)).toEqual(orig.map((s) => s.notes));
    expect(back[2].table).toEqual(orig[2].table);
    await expect(page.locator('#preview .sl-card')).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test('ไฟล์ที่เขียน XML เอง: ลำดับตาม sldIdLst (ไม่ใช่เลขชื่อไฟล์) · ข้ามสไลด์ซ่อน/ส่วนท้าย · โน้ต · ต่อท้ายโครงเรื่องเดิม', async ({ page }) => {
    const errors = await openPage(page);
    await page.click('#emptyNew');
    await page.fill('#outline', '# เดิม');
    await importPptx(page, 'มือ.pptx', await handPptx());
    await expect.poll(() => page.inputValue('#outline'), { timeout: 30000 }).toContain('สไลด์ที่สอง');
    expect(await page.inputValue('#outline')).toBe('# เดิม\n\n# สไลด์แรก\n- ข้อหนึ่ง\n  - ย่อยของข้อหนึ่ง\n- ข้อสอง\n> พูดเรื่องข้อหนึ่งก่อน\n\n# สไลด์ที่สอง\n| เดือน | ยอด |\n| ต.ค. | 100 |');
    expect(errors).toEqual([]);
  });

  test('ไม่ใช่ pptx / ไม่มีสไลด์ → ข้อความในหน้า · โครงเรื่องไม่เปลี่ยน', async ({ page }) => {
    await openPage(page);
    await page.click('#emptyNew');
    await page.fill('#outline', '# เดิม');
    await importPptx(page, 'x.pptx', Buffer.from('not a zip'));
    await expect(page.locator('#msg')).toHaveText('อ่านไฟล์นี้ไม่ได้ — ไม่ใช่ไฟล์ .pptx หรือไฟล์เสียหาย', { timeout: 30000 });
    expect(await page.inputValue('#outline')).toBe('# เดิม');
  });

  test('โหลด wasm ไม่ได้ (404) → ข้อความของตัวโหลดกลาง + problem log ไม่มีชื่อไฟล์ผู้ใช้', async ({ page }) => {
    await openPage(page, { wasm404: true });
    await page.click('#emptyNew');
    const before = await page.inputValue('#outline');
    await importPptx(page, 'ลับมาก.pptx', await handPptx());
    await expect(page.locator('#msg')).toHaveText('ไม่พบไฟล์ของเครื่องมือนี้บนเซิร์ฟเวอร์ — โหลดหน้าใหม่แล้วลองอีกครั้ง', { timeout: 30000 });
    const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:media:log') || '[]'));
    expect(rows.some((r) => r.kind === 'craft' && /deckcraft\/deckcraft_pptx_bg\.wasm/.test(r.model || ''))).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/ลับมาก/);
    expect(await page.inputValue('#outline')).toBe(before);
  });

  test('ภาษาอังกฤษ: ข้อความ error เป็นอังกฤษ', async ({ page }) => {
    await openPage(page, { lang: 'en' });
    await page.click('#emptyNew');
    await importPptx(page, 'x.pptx', Buffer.from('not a zip'));
    await expect(page.locator('#msg')).toHaveText("Couldn't read this file — not a .pptx file, or it's corrupted", { timeout: 30000 });
  });
});
