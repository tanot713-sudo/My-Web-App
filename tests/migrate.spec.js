// Phase 1 — ย้ายข้อมูลข้ามโดเมนด้วยข้อมูลจำลอง: 127.0.0.1 = "github.io", localhost = "pages.dev" (คนละ origin = คนละ storage)
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');

const GH = 'http://127.0.0.1:8125';
const PD = 'http://localhost:8125';
test.describe.configure({ mode: 'serial' });

const SOURCE = {
  'budget:records': JSON.stringify([{ id: 'g1', amt: 100 }, { id: 'g2', amt: 200 }]),
  'lang-practice:xp': '900',
  'tanot:typing:progress': '"from-github"',
  'tanot:market:live-config:v1': '{"apiKey":"LOCAL-ONLY"}',
  'ome:accent': 'violet',
  'tanot:invest:cache:us:AAPL': '{"stale":1}',
};

function seedIdb() {
  return new Promise((res) => {
    const r = indexedDB.open('tanot-barprep', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('notes', { keyPath: 'id' });
    r.onsuccess = () => {
      const tx = r.result.transaction('notes', 'readwrite');
      tx.objectStore('notes').put({ id: 'n1', title: 'โน้ตจาก github', at: new Date(1700000000000) });
      tx.oncomplete = () => {
        r.result.close();
        const s = indexedDB.open('tanot-sim3d', 1);
        s.onupgradeneeded = () => s.result.createObjectStore('models', { keyPath: 'id', autoIncrement: true });
        s.onsuccess = () => {
          const t2 = s.result.transaction('models', 'readwrite');
          t2.objectStore('models').put({ id: 1, name: 'cube.glb', data: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'model/gltf-binary' }) });
          t2.oncomplete = () => { s.result.close(); res(); };
        };
      };
    };
  });
}
function lsDump() { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; }

test.beforeEach(async ({ request }) => { await request.get(PD + '/__reset'); });

test('EXPORT_URL จริงชี้ path /My-Web-App/ ของ GitHub Pages (ตัวเล็กได้ 404)', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'migrate.js'), 'utf8');
  expect(src).toContain("'https://tanot713-sudo.github.io/My-Web-App/migrate-export.html'");
});

test('ย้ายจาก github.io → pages.dev: ครบ ตรวจแล้ว ต้นทางไม่ถูกแตะ ค่าเดิมปลายทางไม่ถูกทับถ้าไม่เลือก', async ({ browser, request }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript((pd) => {
    if (location.origin === pd) {
      window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
      window.TANOT_MIGRATE = { exportUrl: 'http://127.0.0.1:8125/migrate-export.html' };
    }
  }, PD);

  // ต้นทาง (github.io)
  const gh = await ctx.newPage();
  await prepare(gh);
  await gh.goto(GH + '/credits.html');
  await gh.evaluate((src) => { for (const [k, v] of Object.entries(src)) localStorage.setItem(k, v); }, SOURCE);
  await gh.evaluate(seedIdb);
  const before = await gh.evaluate(lsDump);

  // ปลายทางมีค่าเดิมที่ไม่ตรงอยู่แล้ว 1 คีย์ + รายการบัญชีของตัวเอง
  const pd = await ctx.newPage();
  const errors = await prepare(pd);
  await pd.goto(PD + '/migrate.html');
  await pd.evaluate(() => {
    localStorage.setItem('tanot:typing:progress', '"pages-dev-own"');
    localStorage.setItem('budget:records', JSON.stringify([{ id: 'p1', amt: 5 }]));
  });

  const [popup] = await Promise.all([ctx.waitForEvent('page'), pd.click('#mgOpen')]);
  await expect(pd.locator('#mgPlan [data-act="import"]')).toBeVisible({ timeout: 15000 });
  await expect(pd.locator('#mgPlan [data-count="conflict"]')).toHaveText('1');
  await expect(pd.locator('#mgPlan [data-count="merge"]')).toHaveText('1');
  await pd.click('#mgPlan [data-act="import"]');
  await expect(pd.locator('.imp-result')).toContainText('นำเข้าและตรวจแล้ว', { timeout: 15000 });
  await expect(pd.locator('.imp-result')).toContainText('ซิงก์ขึ้นคลาวด์แล้ว', { timeout: 15000 });

  const after = await pd.evaluate(lsDump);
  expect(after['lang-practice:xp']).toBe('900');
  expect(after['tanot:typing:progress']).toBe('"pages-dev-own"'); // conflict ค่าเริ่มต้น = เก็บของเครื่องนี้
  expect(JSON.parse(after['budget:records']).map((r) => r.id)).toEqual(['p1', 'g1', 'g2']);
  expect(after['ome:accent']).toBe('violet');
  expect(after['tanot:market:live-config:v1']).toBe('{"apiKey":"LOCAL-ONLY"}');
  expect(after['tanot:invest:cache:us:AAPL']).toBeUndefined();
  expect(JSON.parse(after['tanot:migrate:done']).verified).toBeGreaterThan(0);

  const notes = await pd.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('tanot-barprep');
    r.onsuccess = () => { const q = r.result.transaction('notes').objectStore('notes').getAll(); q.onsuccess = () => res(q.result.map((n) => [n.title, n.at instanceof Date && n.at.getTime()])); };
  }));
  expect(notes).toEqual([['โน้ตจาก github', 1700000000000]]);
  const model = await pd.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('tanot-sim3d');
    r.onsuccess = () => { const q = r.result.transaction('models').objectStore('models').get(1); q.onsuccess = () => q.result.data.arrayBuffer().then((b) => res([q.result.data.type, [...new Uint8Array(b)]])); };
  }));
  expect(model).toEqual(['model/gltf-binary', [1, 2, 3, 250]]);

  // ต้นทางไม่ถูกลบ/แก้ มีแค่คีย์บันทึกว่าส่งออกแล้ว
  await expect(popup.locator('#mxStatus')).toContainText('ย้ายเสร็จแล้ว');
  const ghAfter = await gh.evaluate(lsDump);
  const { ['tanot:migrate:exported']: marker, ...rest } = ghAfter;
  expect(rest).toEqual(before);
  expect(marker).toBeTruthy();

  // ขึ้น D1 แล้ว แต่ค่าเฉพาะเครื่องไม่ขึ้น
  const dump = JSON.stringify(await (await request.get(PD + '/__dump')).json());
  expect(dump).toContain('lang-practice:xp');
  expect(dump).toContain('idb:tanot-barprep/notes');
  expect(dump).not.toContain('LOCAL-ONLY');
  expect(dump).not.toContain('violet');

  // เลือก "ใช้ของที่นำเข้า" ในรอบสอง → ค่าเดิมเก็บไว้ใน stash
  await popup.close();
  await pd.reload();
  const [popup2] = await Promise.all([ctx.waitForEvent('page'), pd.click('#mgOpen')]);
  await expect(pd.locator('#mgPlan select[data-i]')).toHaveCount(1, { timeout: 15000 });
  await pd.selectOption('#mgPlan select[data-i]', 'incoming');
  await pd.click('#mgPlan [data-act="import"]');
  await expect(pd.locator('.imp-result')).toContainText('นำเข้าและตรวจแล้ว', { timeout: 15000 });
  expect(await pd.evaluate(() => localStorage.getItem('tanot:typing:progress'))).toBe('"from-github"');
  const stash = await pd.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('tanot-data');
    r.onsuccess = () => { const q = r.result.transaction('stash').objectStore('stash').getAll(); q.onsuccess = () => res(q.result.map((s) => s.replaced['tanot:typing:progress'])); };
  }));
  expect(stash).toContain('"pages-dev-own"');
  await popup2.close();
  expect(errors).toEqual([]);
  await ctx.close();
});

test('หน้า data.html โหลดได้ ส่งออก/นำเข้าไฟล์ผ่านตารางตรวจ', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 }; });
  const page = await ctx.newPage();
  const errors = await prepare(page);
  await page.goto(PD + '/data.html');
  await page.evaluate(() => localStorage.setItem('tanot:cooking:notes', '{"x":1}'));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dtDownload')]);
  const file = await dl.path();
  await page.evaluate(() => localStorage.setItem('tanot:cooking:notes', '{"x":2}'));
  await page.setInputFiles('#dtFile', file);
  await expect(page.locator('#dtPlan [data-count="conflict"]')).toHaveText('1');
  await page.selectOption('#dtPlan select[data-i]', 'incoming');
  await page.click('#dtPlan [data-act="import"]');
  await expect(page.locator('#dtPlan .imp-result')).toContainText('นำเข้าและตรวจแล้ว');
  expect(await page.evaluate(() => localStorage.getItem('tanot:cooking:notes'))).toBe('{"x":1}');
  await page.click('#dtSyncNow');
  await expect(page.locator('#dtState')).toHaveText('ปกติ');
  expect(errors).toEqual([]);
  await ctx.close();
});
