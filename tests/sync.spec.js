// Phase 1 — ซิงก์ข้าม 2 เครื่อง (Playwright 2 context = 2 เบราว์เซอร์แยก storage) ผ่าน functions/api/sync.js ตัวจริงบน SQLite
const { test, expect } = require('@playwright/test');
const { prepare, menuPages } = require('./helpers');

const SYNC = 'http://localhost:8124';
test.describe.configure({ mode: 'serial' });
test.use({ baseURL: SYNC });

async function device(browser, { seed, idb } = {}) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(({ seed }) => {
    window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
    window.TANOT_NO_RELOAD_BAR = true;
    try {
      if (seed && !sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      }
    } catch (e) { /* iframe sandbox (coding.html) ไม่มี storage */ }
  }, { seed });
  const page = await ctx.newPage();
  const errors = await prepare(page);
  await page.goto('/credits.html');
  if (idb) await page.evaluate(seedIdb, idb);
  return { ctx, page, errors };
}

// ใส่ข้อมูลลง IndexedDB ของ bar-prep แบบเดียวกับที่ classroom-law.js สร้าง
function seedIdb(notes) {
  return new Promise((res, rej) => {
    const r = indexedDB.open('tanot-barprep', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('notes', { keyPath: 'id' });
    r.onsuccess = () => {
      const tx = r.result.transaction('notes', 'readwrite');
      notes.forEach((n) => tx.objectStore('notes').put(n));
      tx.oncomplete = () => { r.result.close(); res(); };
      tx.onerror = () => rej(tx.error);
    };
  });
}
function readIdb() {
  return new Promise((res) => {
    const r = indexedDB.open('tanot-barprep');
    r.onsuccess = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('notes')) { d.close(); res([]); return; }
      const q = d.transaction('notes').objectStore('notes').getAll();
      q.onsuccess = () => { d.close(); res(q.result.sort((a, b) => (a.id > b.id ? 1 : -1))); };
    };
  });
}
const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => ({ state: s.state, err: s.lastError, pending: s.pending })));
const get = (p, k) => p.evaluate((k) => localStorage.getItem(k), k);
const set = (p, k, v) => p.evaluate(([k, v]) => localStorage.setItem(k, v), [k, v]);
const addRecord = (p, rec) => p.evaluate((rec) => {
  const a = JSON.parse(localStorage.getItem('budget:records') || '[]'); a.push(rec);
  localStorage.setItem('budget:records', JSON.stringify(a));
}, rec);

test.beforeEach(async ({ request }) => { await request.get(SYNC + '/__reset'); await request.get(SYNC + '/__offline?v=0'); });

test('เครื่อง A แก้ → เครื่อง B เห็น (blob / list / map / IndexedDB) และค่าเฉพาะเครื่องไม่ขึ้นเซิร์ฟเวอร์', async ({ browser, request }) => {
  const A = await device(browser, {
    seed: {
      'lang-practice:xp': '120',
      'budget:records': JSON.stringify([{ id: 'r1', amt: 50, cat: 'cat-rice' }, { id: 'r2', amt: 20 }]),
      'lang-practice:srs': JSON.stringify({ hello: { due: 1 }, world: { due: 2 } }),
      'tanot:market:live-config:v1': JSON.stringify({ apiKey: 'SECRET-LOCAL' }),
      'ome:theme': 'dark',
      'tanot:invest:cache:us:AAPL': '{"p":1}',
    },
    idb: [{ id: 'n1', title: 'มาตรา 1', body: 'x' }, { id: 'n2', title: 'มาตรา 2', body: 'y' }],
  });
  expect((await sync(A.page)).state).toBe('ok');
  const dump = await (await request.get(SYNC + '/__dump')).json();
  const nss = dump.map((d) => d.ns + '|' + d.id);
  expect(nss).toContain('ls|lang-practice:xp');
  expect(nss).toContain('ll:budget:records|r1');
  expect(nss).toContain('lm:lang-practice:srs|hello');
  expect(nss).toContain('idb:tanot-barprep/notes|"n1"');
  expect(JSON.stringify(dump)).not.toContain('SECRET-LOCAL');
  expect(nss.some((n) => n.includes('ome:') || n.includes('cache'))).toBe(false);

  const B = await device(browser);
  expect((await sync(B.page)).state).toBe('ok');
  expect(await get(B.page, 'lang-practice:xp')).toBe('120');
  expect(JSON.parse(await get(B.page, 'budget:records')).map((r) => r.id)).toEqual(['r1', 'r2']);
  expect(JSON.parse(await get(B.page, 'lang-practice:srs'))).toEqual({ hello: { due: 1 }, world: { due: 2 } });
  expect(await get(B.page, 'tanot:market:live-config:v1')).toBeNull();
  expect((await B.page.evaluate(readIdb)).map((n) => n.title)).toEqual(['มาตรา 1', 'มาตรา 2']);
  expect([...A.errors, ...B.errors]).toEqual([]);
  await A.ctx.close(); await B.ctx.close();
});

test('เพิ่มรายการพร้อมกัน 2 เครื่องไม่ทับกัน + ลบแล้วลบตาม + blob แก้ทีหลังชนะ', async ({ browser }) => {
  const A = await device(browser, { seed: { 'budget:records': JSON.stringify([{ id: 'r0', amt: 1 }]) } });
  await sync(A.page);
  const B = await device(browser);
  await sync(B.page);
  await addRecord(A.page, { id: 'ra', amt: 10 });
  await addRecord(B.page, { id: 'rb', amt: 20 });
  await sync(A.page); await sync(B.page); await sync(A.page);
  const ids = async (p) => JSON.parse(await get(p, 'budget:records')).map((r) => r.id).sort();
  expect(await ids(A.page)).toEqual(['r0', 'ra', 'rb']);
  expect(await ids(B.page)).toEqual(['r0', 'ra', 'rb']);

  await A.page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('budget:records')).filter((r) => r.id !== 'r0');
    localStorage.setItem('budget:records', JSON.stringify(a));
  });
  await sync(A.page); await sync(B.page);
  expect(await ids(B.page)).toEqual(['ra', 'rb']);

  await set(A.page, 'tanot:music:xp', '10');
  await sync(A.page); await sync(B.page);
  await B.page.waitForTimeout(5);
  await set(B.page, 'tanot:music:xp', '20');
  await sync(B.page); await sync(A.page);
  expect(await get(A.page, 'tanot:music:xp')).toBe('20');
  expect([...A.errors, ...B.errors]).toEqual([]);
  await A.ctx.close(); await B.ctx.close();
});

test('หน้าที่ถือข้อมูลเก่าในหน่วยความจำบันทึกทับ ไม่ลบรายการที่มาจากเครื่องอื่น (merge 3 ทาง)', async ({ browser }) => {
  const A = await device(browser, { seed: { 'lang-practice:srs': JSON.stringify({ a: 1 }), 'budget:records': JSON.stringify([{ id: 'r1' }]) } });
  await sync(A.page);
  const B = await device(browser);
  await sync(B.page);
  // B: หน้าอ่านค่าเข้าหน่วยความจำ (เหมือน React state / ตัวแปร records ของ budget.html)
  await B.page.evaluate(() => { window.__srs = JSON.parse(localStorage.getItem('lang-practice:srs')); window.__rec = JSON.parse(localStorage.getItem('budget:records')); });
  // A เพิ่มของ แล้ว B ดึงมา (หน้า B ยังไม่รู้)
  await A.page.evaluate(() => {
    localStorage.setItem('lang-practice:srs', JSON.stringify({ a: 1, fromA: 2 }));
    localStorage.setItem('budget:records', JSON.stringify([{ id: 'r1' }, { id: 'rA' }]));
  });
  await sync(A.page); await sync(B.page);
  // B บันทึกจากหน่วยความจำเก่า + ของใหม่ของตัวเอง
  await B.page.evaluate(() => {
    window.__srs.fromB = 3; localStorage.setItem('lang-practice:srs', JSON.stringify(window.__srs));
    window.__rec.push({ id: 'rB' }); localStorage.setItem('budget:records', JSON.stringify(window.__rec));
  });
  expect(JSON.parse(await get(B.page, 'lang-practice:srs'))).toEqual({ a: 1, fromB: 3, fromA: 2 });
  await sync(B.page); await sync(A.page);
  expect(JSON.parse(await get(A.page, 'lang-practice:srs'))).toEqual({ a: 1, fromA: 2, fromB: 3 });
  expect(JSON.parse(await get(A.page, 'budget:records')).map((r) => r.id).sort()).toEqual(['r1', 'rA', 'rB']);
  await A.ctx.close(); await B.ctx.close();
});

test('IndexedDB: หน้า clear() แล้วเขียนทั้ง store จากหน่วยความจำเก่า ไม่ลบโน้ตจากเครื่องอื่น', async ({ browser }) => {
  const A = await device(browser, { idb: [{ id: 'n1', t: 'a' }] });
  await sync(A.page);
  const B = await device(browser);
  await sync(B.page);
  const notesB = await B.page.evaluate(readIdb); // หน้าอ่านเข้าหน่วยความจำ (getAll)
  await A.page.evaluate(seedIdb, [{ id: 'n2', t: 'from A' }]);
  await sync(A.page); await sync(B.page);
  // B ใช้ idbReplaceAllNotes แบบ classroom-law.js: clear + put ทุกตัวจากหน่วยความจำ (+ โน้ตใหม่ของ B)
  await B.page.evaluate((notes) => new Promise((res) => {
    const r = indexedDB.open('tanot-barprep', 1);
    r.onsuccess = () => {
      const tx = r.result.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
      os.clear(); notes.concat([{ id: 'n3', t: 'from B' }]).forEach((n) => os.put(n));
      tx.oncomplete = () => setTimeout(res, 50);
    };
  }), notesB);
  expect((await B.page.evaluate(readIdb)).map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);
  await sync(B.page); await sync(A.page);
  expect((await A.page.evaluate(readIdb)).map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);
  await A.ctx.close(); await B.ctx.close();
});

test('ออฟไลน์ → คิวรอส่ง → กลับมาออนไลน์แล้วซิงก์ครบ', async ({ browser, request }) => {
  const A = await device(browser);
  const B = await device(browser);
  await sync(A.page); await sync(B.page);
  await request.get(SYNC + '/__offline?v=1');
  await addRecord(A.page, { id: 'off1' });
  await set(A.page, 'tanot:coding:xp', '77');
  const s = await sync(A.page);
  expect(s.state).toBe('error');
  expect(s.pending).toBeGreaterThan(0);
  // ปิดแท็บ/เปิดใหม่ระหว่างออฟไลน์ — คิวยังอยู่
  await A.page.reload();
  await request.get(SYNC + '/__offline?v=0');
  const s2 = await sync(A.page);
  expect(s2.state).toBe('ok');
  expect(s2.pending).toBe(0);
  await sync(B.page);
  expect(await get(B.page, 'tanot:coding:xp')).toBe('77');
  expect(JSON.parse(await get(B.page, 'budget:records')).map((r) => r.id)).toEqual(['off1']);
  await A.ctx.close(); await B.ctx.close();
});

test('เครื่องใหม่ที่มีค่าเดิมไม่เคยซิงก์: ค่าที่ถูกแทนเก็บใน history กู้คืนได้', async ({ browser }) => {
  const A = await device(browser, { seed: { 'tanot:typing:progress': '"A-progress"' } });
  await sync(A.page);
  const B = await device(browser, { seed: { 'tanot:typing:progress': '"B-progress"', 'tanot:cooking:xp': '5' } });
  await sync(B.page);
  expect(await get(B.page, 'tanot:typing:progress')).toBe('"A-progress"');
  const hist = await B.page.evaluate(() => window.TanotData.history());
  const h = hist.find((x) => x.key === 'tanot:typing:progress');
  expect(h && JSON.parse(h.data)).toBe('"B-progress"');
  await B.page.evaluate((n) => window.TanotData.restoreHistory(n), h.n);
  expect(await get(B.page, 'tanot:typing:progress')).toBe('"B-progress"');
  await sync(B.page); await sync(A.page);
  expect(await get(A.page, 'tanot:typing:progress')).toBe('"B-progress"');
  expect(await get(A.page, 'tanot:cooking:xp')).toBe('5'); // ค่าที่อีกฝั่งไม่มี ถูกส่งขึ้นไปตามปกติ
  await A.ctx.close(); await B.ctx.close();
});

test('storage ในเครื่องหายยกชุด (ไม่ใช่ผู้ใช้ลบ) → ไม่ส่งการลบขึ้นไป ดึงกลับมาครบ', async ({ browser, request }) => {
  const seed = {};
  for (let i = 0; i < 10; i++) seed['tanot:k' + i] = String(i);
  const A = await device(browser, { seed });
  await sync(A.page);
  await A.page.evaluate(() => { const ks = []; for (let i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i)); ks.filter((k) => k.startsWith('tanot:k')).forEach((k) => Storage.prototype.removeItem.call(localStorage, k)); });
  // จำลองการลบที่ดักไม่ได้ (เช่นเบราว์เซอร์ล้าง) — ล้างคิวที่ removeItem ที่ถูกดักเพิ่งสร้าง แล้วโหลดหน้าใหม่
  await A.page.evaluate(() => localStorage.setItem('tanot-sync:dirty', '{}'));
  await A.page.reload();
  await sync(A.page);
  const dump = await (await request.get(SYNC + '/__dump')).json();
  expect(dump.filter((d) => d.deleted).length).toBe(0);
  expect(await get(A.page, 'tanot:k3')).toBe('3');
  await A.ctx.close();
});

test('ทุกหน้าในเมนูโหลดได้ขณะเปิดซิงก์ ไม่มี console error', async ({ browser }) => {
  test.setTimeout(240000);
  const A = await device(browser, { seed: { 'budget:records': '[]' } });
  for (const p of menuPages()) {
    await A.page.goto('/' + p, { waitUntil: 'load' });
    await A.page.waitForTimeout(150);
  }
  expect((await sync(A.page)).state).toBe('ok');
  expect(A.errors).toEqual([]);
  await A.ctx.close();
});
