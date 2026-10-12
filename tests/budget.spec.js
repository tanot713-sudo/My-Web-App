// @ts-check
// budget.html: โดนัทสัดส่วนรายรับ/รายจ่ายใช้สีของหมวดที่ผู้ใช้ตั้ง (สีไม่ถูกรูปแบบ → สีสำรองจาก chart-theme)
// + ช่องคั่นระหว่างชิ้น + คำเตือนสีใกล้กันในฟอร์มเพิ่มหมวด
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');

const NOW = '2026-09-30T10:30:00+07:00';
const CATS = [
  { id: 'cat-salary', name: 'Salary', type: 'income', color: '#17B26A' },
  { id: 'cat-food', name: 'Food', type: 'expense', color: '#FFD600' },
  { id: 'cat-bad', name: 'Bad', type: 'expense', color: 'red;background:url(https://x.invalid/a)' },
  { id: 'cat-short', name: 'Short', type: 'expense', color: '#0a0' },
];
const RECS = [
  { id: 'r1', date: '2026-09-01', type: 'income', categoryId: 'cat-salary', amount: 30000, note: '' },
  { id: 'r2', date: '2026-09-02', type: 'expense', categoryId: 'cat-food', amount: 5000, note: '' },
  { id: 'r3', date: '2026-09-03', type: 'expense', categoryId: 'cat-bad', amount: 3000, note: '' },
  { id: 'r4', date: '2026-09-04', type: 'expense', categoryId: 'cat-short', amount: 2000, note: '' },
  { id: 'r5', date: '2026-09-05', type: 'expense', categoryId: 'cat-gone', amount: 1000, note: '' },
];

async function open(page, { theme = 'light', lang = '', hash = '' } = {}) {
  const errors = await prepare(page, { theme });
  await page.addInitScript(([c, r, l]) => {
    localStorage.setItem('budget:categories', JSON.stringify(c));
    localStorage.setItem('budget:records', JSON.stringify(r));
    if (l) localStorage.setItem('ome:lang', l);
  }, [CATS, RECS, lang]);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto('/budget.html' + hash, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return errors;
}

/** จุด legend: ชื่อ → สี computed */
async function legend(page, id) {
  return page.$$eval('#' + id + ' .mp-leg-item', (rows) => rows.map((r) => ({
    name: r.querySelector('.mp-leg-name').textContent,
    color: getComputedStyle(r.querySelector('.mp-leg-dot')).backgroundColor,
  })));
}
/** สีของชิ้นตามลำดับใน conic-gradient (ไม่รวมช่องคั่น) — อ่านจาก style ดิบที่หน้าเขียน */
async function slices(page, id) {
  const style = await page.getAttribute('#' + id + ' .mp-donut', 'style');
  return style;
}
const rgb = (hex) => {
  let h = hex.slice(1); if (h.length === 3) h = h.replace(/./g, '$&$&');
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
};

for (const theme of ['light', 'dark']) {
  test(`โดนัทใช้สีหมวดของผู้ใช้ · สีผิดรูปแบบ → สีสำรอง · ไม่พบหมวด → other (${theme})`, async ({ page }) => {
    const errors = await open(page, { theme });
    await expect(page.locator('#donutExpense .mp-leg-item')).toHaveCount(4);
    const fb = await page.evaluate(() => {
      const t = window.OmeChartTheme.get();
      const probe = (c) => { const s = document.createElement('span'); s.style.color = c; document.body.appendChild(s); const v = getComputedStyle(s).color; s.remove(); return v; };
      return { series: t.series.map(probe), other: probe(t.axis) };
    });
    const leg = await legend(page, 'donutExpense');
    // เรียงตามยอด: Food 5000, Bad 3000, Short 2000, ไม่ทราบหมวด 1000
    expect(leg.map((l) => l.name)).toEqual(['Food', 'Bad', 'Short', 'ไม่ทราบหมวดหมู่']);
    expect(leg[0].color).toBe(rgb('#FFD600'));
    expect(leg[1].color).toBe(fb.series[1]); // สีไม่ใช่ hex → สีสำรองตามอันดับ
    expect(leg[2].color).toBe(rgb('#0a0')); // #rgb ใช้ได้
    expect(leg[3].color).toBe(fb.other);

    const st = await slices(page, 'donutExpense');
    expect(st).toContain('#FFD600 0.00%');
    expect(st).toContain('#0a0 ');
    expect(st).not.toContain('url(');
    expect(st).not.toContain('red;');
    // ช่องคั่นสีพื้นการ์ดระหว่างชิ้น (4 ชิ้น = 4 ช่อง)
    expect((st.match(/var\(--ome-surface-1\)/g) || []).length).toBe(4);
    // จุด legend สีเดียวกับชิ้น: เทียบสีที่ใช้ใน gradient จริงกับจุด
    const gradColors = await page.evaluate(() => {
      const s = document.querySelector('#donutExpense .mp-donut').getAttribute('style');
      return s.replace(/^background:conic-gradient\(|\)$/g, '').split(/,(?![^(]*\))/).map((x) => x.trim().split(' ')[0]).filter((c) => c !== 'var(--ome-surface-1)');
    });
    const resolved = await page.evaluate((cs) => cs.map((c) => { const s = document.createElement('span'); s.style.color = c; document.body.appendChild(s); const v = getComputedStyle(s).color; s.remove(); return v; }), gradColors);
    expect(resolved).toEqual(leg.map((l) => l.color));

    // รายรับมีหมวดเดียว → ไม่มีช่องคั่น
    const inc = await slices(page, 'donutIncome');
    expect(inc).toContain('#17B26A 0.00% 100.00%');
    expect(inc).not.toContain('--ome-surface-1');
    expect((await legend(page, 'donutIncome'))[0].color).toBe(rgb('#17B26A'));
    expect(errors).toEqual([]);
  });
}

test('คำเตือนสีใกล้หมวดประเภทเดียวกัน ขึ้น/หายถูกต้อง · ไม่ห้ามบันทึก · EN', async ({ page }) => {
  const errors = await open(page, { hash: '#categories' });
  const warn = page.locator('#catColorWarn');
  const setColor = (c) => page.evaluate((v) => { const el = document.getElementById('catColor'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, c);
  await expect(warn).toBeHidden();
  await page.selectOption('#catType', 'expense');
  await setColor('#ffcc00'); // ใกล้ Food #FFD600
  await expect(warn).toBeVisible();
  await expect(warn).toHaveText('สีใกล้กับหมวด Food — ในกราฟอาจแยกยาก');
  await setColor('#3355ff'); // ไกลจากหมวดรายจ่ายทุกหมวด
  await expect(warn).toBeHidden();
  await setColor('#ffcc00');
  await expect(warn).toBeVisible();
  await page.selectOption('#catType', 'income'); // ประเภทอื่นไม่เทียบ (Salary เขียว)
  await expect(warn).toBeHidden();
  await page.selectOption('#catType', 'expense');
  await expect(warn).toBeVisible();
  // สลับภาษาสด
  await page.evaluate(() => window.OME_LANG.set('en'));
  await expect(warn).toHaveText('Colour is close to Food — may be hard to tell apart in the chart');
  await page.evaluate(() => window.OME_LANG.set('th'));
  // บันทึกได้ทั้งที่เตือน แล้วคำเตือนหาย (ไม่เทียบกับหมวดที่เพิ่งบันทึก)
  await page.fill('#catName', 'Snacks');
  await page.click('#saveCategory');
  await expect(warn).toBeHidden();
  const cats = await page.evaluate(() => JSON.parse(localStorage.getItem('budget:categories')));
  expect(cats.find((c) => c.name === 'Snacks')).toMatchObject({ type: 'expense', color: '#ffcc00' });
  expect(Object.keys(cats.find((c) => c.name === 'Snacks')).sort()).toEqual(['color', 'id', 'name', 'type']);
  expect(errors).toEqual([]);
});
