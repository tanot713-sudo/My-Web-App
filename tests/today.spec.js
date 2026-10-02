// @ts-check
// หน้า "วันนี้" (index.html) + ค้นหาด่วน (palette.js) + เพิ่มรายจ่ายด่วน (quick-add.js) — ROADMAP Phase 3
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');

const NOW = new Date('2026-09-30T10:30:00+07:00');

/** ข้อมูลจำลองครบทุกด้าน (เดือนนี้ = 2026-09, เดือนก่อน = 2026-08) */
function seed() {
  const day = (offset) => {
    const t = new Date('2026-09-30T10:30:00+07:00'); t.setDate(t.getDate() - offset);
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  };
  const S = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  S('budget:categories', [
    { id: 'cat-rice', name: 'ค่าข้าว', type: 'expense', color: '#F5A524' },
    { id: 'cat-fuel', name: 'เติมน้ำมัน', type: 'expense', color: '#EAB308' },
    { id: 'cat-salary', name: 'เงินเดือน', type: 'income', color: '#17B26A' },
  ]);
  S('budget:records', [
    { id: 'a', date: '2026-09-01', type: 'expense', categoryId: 'cat-rice', amount: 2600, note: '' },
    { id: 'b', date: '2026-09-02', type: 'expense', categoryId: 'cat-fuel', amount: 1400, note: '' },
    { id: 'c', date: '2026-09-01', type: 'income', categoryId: 'cat-salary', amount: 30000, note: '' },
    { id: 'd', date: '2026-08-01', type: 'expense', categoryId: 'cat-rice', amount: 1500, note: '' },
    { id: 'e', date: '2026-08-31', type: 'expense', categoryId: 'cat-rice', amount: 9999, note: '' }, // เกินวันที่ 30 — ไม่นับในช่วงเดียวกัน
  ]);
  S('budget:budgets', { '2026-09': { 'cat-rice': 3000, 'cat-fuel': 1200 } });
  S('lang-practice:srs', { a: { dueAt: 1 }, b: { dueAt: 1 }, c: { dueAt: Date.now() + 1e10 } });
  S('lang-practice:streak', { count: 5, longest: 12, lastDate: day(1) });
  S('lbe:business:srs', { q1: { due: 1 } });
  S('tanot:invest:thstock', [{ sym: 'PTT', shares: 200, cost: 32, ts: 1 }, { sym: 'PTT', shares: 100, cost: 36, ts: 2 }, { sym: 'AOT', shares: 500, cost: 60, ts: 3 }]);
  S('tanot:invest:cache:PTT', { ts: Date.now(), c: [30, 31, 32, 34.5] });
  S('tanot:invest:globalstock', [{ sym: 'AAPL', shares: 3, cost: 150, ts: 4 }]);
  S('tanot:invest:cache:us:AAPL', { ts: Date.now(), c: [200, 190] });
  S('tanot:word:autosave', { html: '<p>สรุปประชุมโครงการปรับปรุงระบบไฟฟ้า</p>', savedAt: Date.now() - 3 * 3600e3 });
  S('tanot:sheet:autosave', '[{"name":"s"}]');
}

async function openToday(page, { theme = 'light', withData = true, width = 1100 } = {}) {
  const errors = await prepare(page, { theme });
  if (withData) await page.addInitScript(seed);
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return errors;
}

test('วันนี้: รวมข้อมูลทุกด้านจาก storage', async ({ page }) => {
  const errors = await openToday(page);
  // ใช้จ่ายเดือนนี้ = 2600 + 1400 เทียบงบ 3000 + 1200; เทียบ 1–30 ส.ค. = 1500 (รายการ 31 ส.ค. ไม่นับ) → +167%
  const spend = page.locator('#spendBody');
  await expect(spend).toContainText('฿4,000');
  await expect(spend).toContainText('จากงบ ฿4,200');
  await expect(spend).toContainText('เหลือ ฿200');
  await expect(spend).toContainText('167%');
  await expect(spend.locator('.cat-row').first()).toContainText('เติมน้ำมัน'); // ใช้เกินสัดส่วนสูงสุดขึ้นก่อน
  await expect(spend.locator('.bar.err').first()).toBeVisible();
  // ทบทวน: ภาษา 2 + ธุรกิจ 1 (ใบที่ยังไม่ถึงกำหนดไม่นับ)
  await expect(page.locator('#reviewBody .big')).toContainText('3');
  await expect(page.locator('#reviewBody')).toContainText('ภาษา 2');
  await expect(page.locator('#reviewBody a.btn')).toHaveAttribute('href', 'review.html');
  // วันติดต่อกัน: ฝึกล่าสุดเมื่อวาน → ยังนับต่อ แต่ยังไม่ได้ฝึกวันนี้
  await expect(page.locator('#streakBody .big')).toContainText('5');
  await expect(page.locator('#streakBody')).toContainText('ยังไม่ได้ฝึกวันนี้');
  // หุ้น: PTT รวมสองล็อต ทุนเฉลี่ย 33.33, AOT ไม่มีราคาแคช, AAPL เป็นตลาด US
  const stock = page.locator('#stockBody');
  await expect(stock.locator('.list-row')).toHaveCount(3);
  await expect(stock).toContainText('฿34.5');
  await expect(stock).toContainText('ยังไม่มีราคา');
  await expect(stock).toContainText('$190');
  // ไฟล์ล่าสุด
  await expect(page.locator('#filesBody')).toContainText('สรุปประชุมโครงการปรับปรุงระบบไฟฟ้า');
  await expect(page.locator('#filesBody')).toContainText('Excel ฉบับร่าง');
  expect(errors).toEqual([]);
});

test('วันนี้: ไม่มีข้อมูล → empty state ทุกการ์ด ไม่มี error', async ({ page }) => {
  const errors = await openToday(page, { withData: false });
  await expect(page.locator('#spendBody .empty')).toBeVisible();
  await expect(page.locator('#stockBody .empty')).toBeVisible();
  await expect(page.locator('#filesBody .empty')).toBeVisible();
  await expect(page.locator('#reviewBody .big')).toContainText('0');
  await expect(page.locator('#mntBody .empty')).toContainText('ยังไม่มีทะเบียนอุปกรณ์');
  expect(errors).toEqual([]);
});

test('วันนี้: การ์ดงานบำรุงรักษา — เลยกำหนด/ถึงกำหนด/ทำแล้ว + ใบงานเปิด (อ่านจาก localStorage + IndexedDB)', async ({ page }) => {
  const errors = await openToday(page, { withData: false });
  await page.evaluate(() => {
    const S = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    const mk = (id, code, ph) => ({ id, code, name: 'บันไดเลื่อน', type: 'ESC', system: 'E&M', site: 's1', phase: { M3: ph }, status: 'active' });
    // startMonth 2026-07: phase 1 → ก.ค./ต.ค. (ก.ค. ค้าง) · phase 3 → ก.ย. (ถึงกำหนดอยู่)
    S('tanot:mnt:assets', [mk('e1', 'RN05-ESC-01', 1), mk('e2', 'RN05-ESC-02', 3), mk('e3', 'RN05-ESC-03', 3)]);
    S('tanot:mnt:plans', [{ id: 'ESC|M3', type: 'ESC', typeName: 'บันไดเลื่อน', freq: 'M3', hours: 2, items: [{ id: 'i1', text: 'x', kind: 'check' }] }]);
    S('tanot:mnt:settings', { v: 1, startMonth: '2026-07' });
  });
  await page.evaluate(() => new Promise((resolve, reject) => {
    const open = (name, stores) => new Promise((res, rej) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => stores.forEach((s) => r.result.createObjectStore(s, { keyPath: 'id' }));
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    const put = (db, store, rec) => new Promise((res, rej) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(rec); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    const at = new Date('2026-09-10T10:00:00+07:00').getTime();
    Promise.all([open('tanot-mnt-2026', ['insp']), open('tanot-mnt', ['wo', 'woev'])]).then(async ([insp, wo]) => {
      await put(insp, 'insp', { id: 's1|M3|2026-09|dx', site: 's1', freq: 'M3', period: '2026-09', dev: 'dx', by: 'ก', at, rows: { e3: { start: at, at, res: { i1: 'ok' }, note: '', photos: [], wo: null } } });
      await put(wo, 'wo', { id: 'w1', no: 'CM-260915-AAA', kind: 'cm', asset: 'e1', site: 's1', reportedAt: at, priority: 'normal', symptom: 'x', dev: 'dx', createdAt: at });
      await put(wo, 'wo', { id: 'w2', no: 'CM-260916-BBB', kind: 'cm', asset: 'e1', site: 's1', reportedAt: at, priority: 'normal', symptom: 'y', dev: 'dx', createdAt: at });
      await put(wo, 'woev', { id: 'w2|a|dx', wo: 'w2', at: at + 1, dev: 'dx', set: { status: 'done' }, note: '', photos: [] });
      insp.close(); wo.close(); resolve();
    }, reject);
  }));
  await page.reload();
  const mnt = page.locator('#mntBody');
  await expect(mnt.locator('.list-row')).toHaveCount(2); // e3 ทำแล้ว ไม่ขึ้น
  await expect(mnt).toContainText('เลยกำหนด 1');
  await expect(mnt).toContainText('ถึงกำหนด 1');
  await expect(mnt).toContainText('ใบงานเปิด 1'); // w2 ปิดแล้ว
  await expect(mnt.locator('.list-row').first()).toContainText('RN05-ESC-01');
  await expect(mnt.locator('.list-row').first()).toContainText('เลย 61 วัน');
  await expect(mnt.locator('.list-row').first()).toHaveAttribute('href', 'maintenance.html#asset=e1');
  await expect(mnt.locator('.list-row').nth(1)).toContainText('RN05-ESC-02');
  await expect(mnt.locator('.list-row').nth(1)).toContainText('ภายใน 30 ก.ย.');
  expect(errors).toEqual([]);
});

test('วันนี้: อ่านรายงานล่าสุดจาก IndexedDB (เฉพาะ 5 ฉบับท้าย)', async ({ page }) => {
  const errors = await openToday(page, { withData: false });
  await page.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('tanot-report-dashboard', 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('current', { keyPath: 'id' });
      d.createObjectStore('reports', { keyPath: 'id', autoIncrement: true });
    };
    r.onsuccess = () => {
      const tx = r.result.transaction('reports', 'readwrite');
      for (let i = 1; i <= 7; i++) tx.objectStore('reports').add({ name: 'รายงาน ' + i, savedAt: Date.now() - (8 - i) * 60000 });
      tx.oncomplete = () => { r.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    r.onerror = () => reject(r.error);
  }));
  await page.reload();
  await page.waitForSelector('#filesBody .list-row');
  await expect(page.locator('#filesBody .list-row')).toHaveCount(5);
  await expect(page.locator('#filesBody .list-row').first()).toContainText('รายงาน 7');
  expect(errors).toEqual([]);
});

test('วันนี้: 390px ไม่ล้นแนวนอน ทั้งสว่าง/มืด', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await openToday(page, { theme, width: 390 });
    await page.waitForSelector('#stockBody .list-row');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, theme).toBeLessThanOrEqual(1);
  }
});

test('เพิ่มรายจ่ายด่วน: บันทึกลง budget:records แล้วยอดบนหน้าวันนี้อัปเดต', async ({ page }) => {
  const errors = await openToday(page);
  await expect(page.locator('#spendBody')).toContainText('฿4,000');
  await page.click('#qaExpense');
  await page.waitForSelector('.ome-qa:not([hidden])');
  await page.fill('[name=amt]', '0');
  await page.click('.ome-qa-foot .primary');
  await expect(page.locator('.ome-qa-err')).toBeVisible(); // จำนวนต้องมากกว่า 0
  await page.fill('[name=amt]', '150.5');
  await page.selectOption('[name=cat]', 'cat-rice');
  await page.fill('[name=note]', 'ข้าวมันไก่');
  await page.click('.ome-qa-foot .primary');
  await expect(page.locator('.ome-qa')).toBeHidden();
  await expect(page.locator('#spendBody')).toContainText('฿4,150.5');
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('budget:records')).pop());
  expect(rec).toMatchObject({ type: 'expense', categoryId: 'cat-rice', amount: 150.5, note: 'ข้าวมันไก่' });
  expect(rec.id).toBeTruthy();
  expect(errors).toEqual([]);
});

test('วันนี้: ข้อมูลเปลี่ยนจากแท็บอื่น/เครื่องอื่น (event tanot:data) → วาดใหม่', async ({ page }) => {
  await openToday(page);
  await page.evaluate(() => {
    const recs = JSON.parse(localStorage.getItem('budget:records'));
    recs.push({ id: 'z', date: '2026-09-15', type: 'expense', categoryId: 'cat-fuel', amount: 1000, note: '' });
    localStorage.setItem('budget:records', JSON.stringify(recs));
    window.dispatchEvent(new CustomEvent('tanot:data', { detail: { keys: ['budget:records'] } }));
  });
  await expect(page.locator('#spendBody')).toContainText('฿5,000');
});

test.describe('ค้นหาด่วน (palette)', () => {
  test('Ctrl+K เปิด/ปิด, ค้นหาไทย/อังกฤษจากเมนูใน shell.js, Enter ไปหน้านั้น', async ({ page }) => {
    const errors = await openToday(page, { withData: false });
    const pal = page.locator('.ome-pal');
    await expect(pal).toHaveCount(0); // ยังไม่โหลดจนกว่าจะใช้
    await page.keyboard.press('Control+k');
    await expect(pal).toBeVisible();
    await expect(page.locator('.ome-pal-input')).toBeFocused();
    // ยังไม่พิมพ์: คำสั่ง + หมวดหลัก
    await expect(page.locator('.ome-pal-label', { hasText: 'เพิ่มรายจ่าย' })).toBeVisible();

    await page.keyboard.type('ตรวจเอกสาร');
    await expect(page.locator('.ome-pal-row').first()).toContainText('ตรวจสอบเอกสาร'); // มาจาก keywords
    await page.fill('.ome-pal-input', 'excel');
    await expect(page.locator('.ome-pal-row').first()).toContainText('งาน Excel');
    await page.fill('.ome-pal-input', 'หนังสือ');
    await expect(page.locator('.ome-pal-row').first()).toContainText('เร็วๆ นี้'); // หน้าที่ยังไม่ทำแสดงป้ายกำกับ
    await page.fill('.ome-pal-input', 'ไม่มีอะไรตรงกับคำนี้แน่นอน');
    await expect(page.locator('.ome-pal-empty')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(pal).toBeHidden();

    await page.click('#omeSearchBtn'); // ปุ่มบน nav
    await expect(pal).toBeVisible();
    await page.fill('.ome-pal-input', 'excel');
    await page.keyboard.press('ArrowDown'); // ไม่มีตัวเลือกที่สอง — ต้องไม่พัง
    await page.keyboard.press('Enter');
    await page.waitForURL('**/excel.html');
    expect(errors).toEqual([]);
  });

  test('ทำงานบนหน้าเดิมที่ยังไม่ย้ายธีม (word.html) + คำสั่งเพิ่มรายจ่ายเปิดกล่อง quick-add', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/word.html', { waitUntil: 'load' });
    await page.waitForSelector('nav.ome-nav');
    await page.keyboard.press('Control+k');
    await page.fill('.ome-pal-input', 'รายจ่าย');
    await expect(page.locator('.ome-pal-row').first()).toContainText('เพิ่มรายจ่าย');
    await page.keyboard.press('Enter');
    await expect(page.locator('.ome-qa')).toBeVisible();
    await expect(page.locator('.ome-qa-title')).toHaveText('เพิ่มรายจ่าย');
    await page.keyboard.press('Escape');
    await expect(page.locator('.ome-qa')).toBeHidden();
    expect(errors).toEqual([]);
  });
});
