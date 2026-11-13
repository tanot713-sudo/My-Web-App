// @ts-check
// ร่างภาพสดในแท็บ 3 มิติของ cad.html: ป้ายขนาดจริงระหว่างลาก · snap กริดใช้ค่าเดียวกับแท็บ 2D · Backspace ลบจุดล่าสุดของเส้นหลายจุด
// (OCCT โหลดจาก CDN ไม่ได้ใน CI — ทดสอบเฉพาะส่วนที่ไม่ต้องสร้างรูปทรง: ป้าย/จุดที่วาง/ข้อความสถานะ)
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');

async function openSketch(page, lang) {
  const errors = await prepare(page);
  await page.addInitScript((l) => { try { localStorage.setItem('ome:lang', l); } catch (e) {} }, lang);
  await page.setViewportSize({ width: 1100, height: 1100 });
  await page.goto('/cad.html');
  await page.click('#tabBtn3d');
  await page.selectOption('#shapeKindSel', 'sketch');
  await page.click('#startLiveSketchBtn');
  await expect(page.locator('#c3SketchToolbar')).toBeVisible();
  // OCCT โหลดไม่ได้ → ฉากมีแผ่น error ทับวิวพอร์ต (ของจริงไม่มีเมื่อ OCCT โหลดได้) — ให้เมาส์ทะลุไปถึงพื้นที่ร่าง
  await page.addStyleTag({ content: '#c3Overlay,#c3Overlay *{pointer-events:none!important}' });
  await page.locator('#c3Viewport').scrollIntoViewIfNeeded();
  const box = /** @type {any} */ (await page.locator('#c3Viewport').boundingBox());
  return { errors, box };
}
const nums = (t) => (t.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

test.describe('cad live sketch 3D', () => {
  test('ลากสี่เหลี่ยม/วงกลมแล้วเห็นขนาด · snap ได้ค่ากลมตามระยะกริดของแท็บ 2D · ปิด snap = ค่าไม่กลม', async ({ page }) => {
    const { errors, box } = await openSketch(page, 'en');
    const dim = page.locator('#c3SketchDim');
    await expect(dim).toBeHidden(); // ยังไม่วางจุดแรก = ไม่มีป้าย
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down(); await page.mouse.up(); // จุดแรก
    const readSnapped = async (step) => {
      const seen = [];
      for (let i = 1; i <= 4; i++) {
        await page.mouse.move(cx + 37 * i + 3, cy + 23 * i + 1);
        await expect(dim).toBeVisible();
        seen.push(await dim.innerText());
      }
      for (const t of seen) { expect(t).toMatch(/^\d+(\.\d+)? × \d+(\.\d+)? mm$/); for (const n of nums(t)) expect(n % step).toBe(0); }
      return seen;
    };
    await readSnapped(10); // ค่าเริ่มต้นแท็บ 2D: snap เปิด ระยะ 10
    await page.evaluate(() => { const s = /** @type {HTMLSelectElement} */ (document.getElementById('snapStepSel')); s.value = '5'; s.dispatchEvent(new Event('change')); });
    await readSnapped(5);
    // ปิด snap ด้วยปุ่มเดียวกับแท็บ 2D → อย่างน้อยหนึ่งค่าไม่กลม
    await page.evaluate(() => document.getElementById('snapToggleBtn').click());
    const free = [];
    for (let i = 1; i <= 4; i++) { await page.mouse.move(cx + 41 * i + 7, cy + 19 * i + 5); free.push(...nums(await dim.innerText())); }
    expect(free.some((n) => n % 5 !== 0)).toBe(true);
    // วงกลม: ป้าย R… (เปลี่ยนเครื่องมือล้างจุดและป้ายเดิม)
    await page.click('#sketchToolCircleBtn');
    await expect(dim).toBeHidden();
    const b2 = /** @type {any} */ (await page.locator('#c3Viewport').boundingBox()); // คลิกปุ่มอาจเลื่อนหน้า
    const dx = b2.x + b2.width / 2, dy = b2.y + b2.height / 2;
    await page.mouse.move(dx, dy); await page.mouse.down(); await page.mouse.up();
    await page.mouse.move(dx + 60, dy + 10);
    await expect(dim).toHaveText(/^R\d+(\.\d+)? mm$/);
    await page.keyboard.press('Escape');
    await expect(dim).toBeHidden();
    expect(errors.filter((e) => !/opencascade|OCCT|cdn|jsdelivr|unpkg/i.test(e))).toEqual([]);
  });

  test('กดปุ่มในแถบเครื่องมือไม่นับเป็นคลิกวางจุด (ไม่ปิดสี่เหลี่ยมที่วาดค้าง/ไม่เพิ่มจุดให้เส้นหลายจุด)', async ({ page }) => {
    const { box } = await openSketch(page, 'en');
    await page.mouse.move(box.x + 200, box.y + 250); await page.mouse.down(); await page.mouse.up();
    await page.click('#sketchToolPolylineBtn'); // เดิม: pointerup ของปุ่มลอยขึ้นไปเป็นคลิกมุมที่ 2 แล้วจบโหมดร่าง
    await expect(page.locator('#c3SketchToolbar')).toBeVisible();
    await expect(page.locator('#sketchFinishBtn')).toBeVisible();
    for (const [dx, dy] of [[200, 250], [350, 260], [340, 380]]) { await page.mouse.move(box.x + dx, box.y + dy); await page.mouse.down(); await page.mouse.up(); }
    await expect(page.locator('#c3SketchHint')).toContainText('3 placed');
    await page.click('#sketchFinishBtn'); // ไม่เพิ่มจุดที่ 4 ใต้ปุ่ม
    await expect(page.locator('#c3SketchToolbar')).toBeHidden();
  });

  test('ป้ายเป็นไทยเมื่อภาษาไทย', async ({ page }) => {
    const { box } = await openSketch(page, 'th');
    await page.mouse.move(box.x + 200, box.y + 200); await page.mouse.down(); await page.mouse.up();
    await page.mouse.move(box.x + 300, box.y + 260);
    await expect(page.locator('#c3SketchDim')).toHaveText(/ มม\.$/);
  });

  test('Backspace ลบจุดล่าสุดของเส้นหลายจุด + ป้ายอัปเดตทันที (ไม่ลบเมื่อพิมพ์ในช่อง/เครื่องมืออื่น)', async ({ page }) => {
    const { box } = await openSketch(page, 'en');
    const hint = page.locator('#c3SketchHint');
    await page.click('#sketchToolPolylineBtn');
    const pts = [[160, 160], [320, 170], [330, 300], [180, 310]];
    for (const [dx, dy] of pts) { await page.mouse.move(box.x + dx, box.y + dy); await page.mouse.down(); await page.mouse.up(); }
    await expect(hint).toContainText('4 placed');
    // ป้ายความยาวเส้นล่าสุดต้องเปลี่ยนทันทีหลัง Backspace (ไม่ค้างค่าเก่าจนกว่าจะขยับเมาส์)
    const dim = page.locator('#c3SketchDim');
    await page.mouse.move(box.x + 700, box.y + 420);
    await expect(dim).toBeVisible();
    const d4 = await dim.innerText();
    await page.keyboard.press('Backspace');
    await expect(hint).toContainText('3 placed');
    await expect(dim).toBeVisible();
    expect(await dim.innerText()).not.toBe(d4);
    await page.keyboard.press('Backspace');
    await expect(hint).toContainText('2 placed');
    await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
    await expect(hint).toContainText('0 placed');
    await expect(page.locator('#c3SketchDim')).toBeHidden();
    // วางใหม่ต่อได้ และยังอยู่ในโหมดร่าง
    await page.mouse.move(box.x + 200, box.y + 200); await page.mouse.down(); await page.mouse.up();
    await expect(hint).toContainText('1 placed');
    // โฟกัสอยู่ในช่องกรอก (ช่อง "สูง" ที่มองเห็น) = Backspace แก้ข้อความในช่อง จำนวนจุดต้องเท่าเดิม
    await page.focus('#sketchHeight');
    await page.keyboard.press('Backspace');
    await expect(hint).toContainText('1 placed');
    await page.mouse.move(box.x + 200, box.y + 200); // กลับมาที่วิวพอร์ต
    // สี่เหลี่ยม: Backspace ไม่มีผล
    await page.click('#sketchToolRectBtn');
    await page.mouse.move(box.x + 200, box.y + 200); await page.mouse.down(); await page.mouse.up();
    const before = await hint.innerText();
    await page.keyboard.press('Backspace');
    expect(await hint.innerText()).toBe(before);
  });

  test('Backspace ในโหมดร่าง 3 มิติไม่ไปลบชิ้นงานที่เลือกค้างในแบบ 2 มิติ', async ({ page }) => {
    await prepare(page);
    await page.addInitScript(() => { try { localStorage.setItem('ome:lang', 'en'); } catch (e) {} });
    await page.setViewportSize({ width: 1100, height: 1100 });
    await page.goto('/cad.html');
    const cv = /** @type {any} */ (await page.locator('#cadCanvas').boundingBox());
    await page.click('#toolLineBtn');
    await page.mouse.click(cv.x + 200, cv.y + 200); await page.mouse.click(cv.x + 400, cv.y + 200);
    await page.click('#toolSelectBtn');
    const cv2 = /** @type {any} */ (await page.locator('#cadCanvas').boundingBox()); // คลิกปุ่มอาจเลื่อนหน้า วัดใหม่
    await page.mouse.move(cv2.x + 100, cv2.y + 20); await page.mouse.down(); await page.mouse.move(cv2.x + 440, cv2.y + 420, { steps: 5 }); await page.mouse.up(); // กรอบคลุมเส้นทั้งเส้น
    await expect(page.locator('#deleteBtn')).toBeEnabled();
    await expect(page.locator('#statCount')).toHaveText('1');
    await page.addStyleTag({ content: '#c3Overlay,#c3Overlay *{pointer-events:none!important}' });
    await page.click('#tabBtn3d');
    await page.selectOption('#shapeKindSel', 'sketch');
    await page.click('#startLiveSketchBtn');
    await page.click('#sketchToolPolylineBtn');
    await page.locator('#c3Viewport').scrollIntoViewIfNeeded();
    const box = /** @type {any} */ (await page.locator('#c3Viewport').boundingBox());
    for (const [dx, dy] of [[200, 250], [350, 260], [340, 380]]) { await page.mouse.move(box.x + dx, box.y + dy); await page.mouse.down(); await page.mouse.up(); }
    await expect(page.locator('#c3SketchHint')).toContainText('3 placed');
    await page.keyboard.press('Backspace');
    await expect(page.locator('#c3SketchHint')).toContainText('2 placed');
    await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace'); // ไม่มีจุดค้างแล้ว ยังต้องไม่ตกไปถึง cad.js
    await expect(page.locator('#c3SketchHint')).toContainText('0 placed');
    await page.click('#tabBtn2d');
    await expect(page.locator('#statCount')).toHaveText('1');
  });

  test('เส้นหลายจุดไม่รับจุดซ้ำพิกัดกับจุดล่าสุด/จุดแรก (ขอบยาว 0 สร้างรูปทรงไม่ได้)', async ({ page }) => {
    const { box } = await openSketch(page, 'en');
    const hint = page.locator('#c3SketchHint');
    await page.click('#sketchToolPolylineBtn');
    const click = async (dx, dy) => { await page.mouse.move(box.x + dx, box.y + dy); await page.mouse.down(); await page.mouse.up(); };
    await click(200, 250);
    await click(200, 250); // ซ้ำจุดล่าสุด
    await expect(hint).toContainText('1 placed');
    await click(350, 260); await click(340, 380);
    await expect(hint).toContainText('3 placed');
    await click(340, 380); // ซ้ำจุดล่าสุด
    await click(200, 250); // กลับที่จุดเริ่ม — ไม่ปิดรูปเอง ไม่เพิ่มจุด
    await expect(hint).toContainText('3 placed');
    await expect(page.locator('#c3SketchToolbar')).toBeVisible();
  });
});
