// @ts-check
// เปรียบเทียบข้อมูล (compare.html / compare-calc.js / ns 'compare' ของ /api/files) — ROADMAP Phase 6 การทำงาน
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const { prepare } = require('./helpers');

const C = require(path.join(__dirname, '..', 'compare-calc.js'));
const SRV = 'http://localhost:8133';
const XLSX_CDN = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
const XLSX_LOCAL = path.join(__dirname, 'node_modules', 'xlsx-js-style', 'dist', 'xlsx.bundle.js');
const MAMMOTH_CDN = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
const MAMMOTH_LOCAL = path.join(__dirname, 'node_modules', 'mammoth', 'mammoth.browser.min.js');
// ทั้งไฟล์ใช้เซิร์ฟเวอร์เดียวที่มี /__reset — ห้ามรันขนานกัน
test.describe.configure({ mode: 'serial' });

/* ══════════ A. compare-calc.js (known-answer) ══════════ */
const H = ['รหัส', 'ชื่อ', 'จำนวน', 'ราคา'];
const mapOf = (a, b) => C.suggestMapping(a, b);

test.describe('compare-calc.js — ตาราง', () => {
  const A = { headers: H, rows: [['001', 'สว่าน', 10, 100], ['002', 'ค้อน', 5, 50], ['003', 'เลื่อย', 2, 300], ['004', 'คีม', 1, 80], ['002', 'ค้อนซ้ำ', 9, 9]] };
  const B = { headers: H, rows: [['001', 'สว่าน', 10, 100], ['002', 'ค้อน', 5, 50.004], ['003', 'เลื่อย ', 3, 300], ['005', 'ไขควง', 7, 25], ['001', 'ซ้ำ', 1, 1]] };

  test('เพิ่ม/หาย/เปลี่ยน/เหมือน + คีย์ซ้ำในไฟล์เดียวกัน (เทียบเฉพาะแถวแรก) + ค่าคลาดเคลื่อน + ตัดช่องว่าง', () => {
    const r = C.diffTables(A, B, { map: mapOf(H, H), keys: [0], trim: true, ignoreCase: true, tol: 0.01 });
    expect(r.added).toEqual([{ b: 3, key: ['005'] }]);
    expect(r.removed).toEqual([{ a: 3, key: ['004'] }]);
    expect(r.changed).toHaveLength(1);
    expect(r.changed[0]).toMatchObject({ a: 2, b: 2, key: ['003'], cells: [{ m: 2, old: 2, new: 3 }] });
    expect(r.same).toBe(2); // 001 และ 002 (50 vs 50.004 อยู่ใน ±0.01)
    expect(r.dupA).toEqual([{ key: ['002'], rows: [1, 4] }]);
    expect(r.dupB).toEqual([{ key: ['001'], rows: [0, 4] }]);
    expect(r.total).toEqual({ a: 5, b: 5 });
  });

  test('ไม่ตัดช่องว่าง/ไม่มีค่าคลาดเคลื่อน → ต่างมากขึ้น · ตัวพิมพ์ใหญ่เล็ก', () => {
    const r = C.diffTables(A, B, { map: mapOf(H, H), keys: [0], trim: false, ignoreCase: false, tol: 0 });
    expect(r.changed.map((c) => c.key[0])).toEqual(['002', '003']);
    expect(r.changed[0].cells.map((c) => c.m)).toEqual([3]); // 50 vs 50.004
    expect(r.changed[1].cells.map((c) => c.m)).toEqual([1, 2]); // 'เลื่อย ' มีช่องว่างท้าย + จำนวน
    const r2 = C.diffTables({ headers: ['k', 'v'], rows: [['A1', 'Hello']] }, { headers: ['k', 'v'], rows: [['a1', 'hello']] }, { map: mapOf(['k', 'v'], ['k', 'v']), keys: [0], ignoreCase: true });
    expect(r2.same).toBe(1);
    const r3 = C.diffTables({ headers: ['k', 'v'], rows: [['A1', 'Hello']] }, { headers: ['k', 'v'], rows: [['a1', 'hello']] }, { map: mapOf(['k', 'v'], ['k', 'v']), keys: [0], ignoreCase: false });
    expect(r3.added).toHaveLength(1); expect(r3.removed).toHaveLength(1); // คีย์ต่างตัวพิมพ์ = คนละคีย์
  });

  test('คีย์หลายคอลัมน์ · คอลัมน์ที่ไม่เทียบ · แถวคีย์ว่างถูกข้าม · ตัวเลขกับข้อความตัวเลขเท่ากัน', () => {
    const h = ['สาขา', 'เดือน', 'ยอด', 'หมายเหตุ'];
    const a = { headers: h, rows: [['กทม', 1, 100, 'x'], ['กทม', 2, 200, 'x'], ['เชียงใหม่', 1, 50, 'x'], [null, null, 5, 'y']] };
    const b = { headers: h, rows: [['กทม', '1', '100', 'z'], ['กทม', 2, 250, 'z'], ['เชียงใหม่', 2, 60, 'z'], ['', '', 6, 'w']] };
    const r = C.diffTables(a, b, { map: mapOf(h, h), keys: [0, 1], skip: [3] });
    expect(r.same).toBe(1); // กทม|1: 1 vs '1' และ 100 vs '100' เท่ากัน, หมายเหตุไม่เทียบ
    expect(r.changed).toHaveLength(1);
    expect(r.changed[0]).toMatchObject({ key: ['กทม', 2], cells: [{ m: 2, old: 200, new: 250 }] });
    expect(r.removed.map((x) => x.key)).toEqual([['เชียงใหม่', 1]]);
    expect(r.added.map((x) => x.key)).toEqual([['เชียงใหม่', 2]]);
    expect(r.blankA).toBe(1); expect(r.blankB).toBe(1);
    expect(() => C.diffTables(a, b, { map: mapOf(h, h), keys: [] })).toThrow('no-key');
  });

  test('cellsEqual / toNumber / toCell / suggestMapping', () => {
    expect(C.cellsEqual(null, '', { trim: true })).toBe(true);
    expect(C.cellsEqual(0, null)).toBe(false);
    expect(C.cellsEqual('1,000.50', 1000.5)).toBe(true);
    expect(C.cellsEqual(10, 10.02, { tol: 0.01 })).toBe(false);
    expect(C.cellsEqual(10, 10.01, { tol: 0.01 })).toBe(true);
    expect(C.cellsEqual('abc', 'ABC', {})).toBe(false);
    expect(C.cellsEqual('abc', ' ABC ', { ignoreCase: true, trim: true })).toBe(true);
    expect(C.toNumber('12abc')).toBeNaN(); expect(C.toNumber('1,23')).toBeNaN(); expect(C.toNumber(' -3.5 ')).toBe(-3.5);
    expect(C.toCell(new Date(2026, 9, 3))).toBe('2026-10-03');
    expect(C.toCell(new Date(2026, 9, 3, 14, 5))).toBe('2026-10-03 14:05');
    expect(C.toCell('')).toBeNull(); expect(C.toCell(true)).toBe('TRUE');
    expect(mapOf(['Code', ' Name ', 'Qty', 'X'], ['name', 'code', 'Qty', 'Y'])).toEqual([
      { a: 0, b: 1, name: 'Code' }, { a: 1, b: 0, name: ' Name ' }, { a: 2, b: 2, name: 'Qty' }, { a: 3, b: null, name: 'X' }]);
    // คอลัมน์ B หนึ่งคอลัมน์ถูกใช้ครั้งเดียว
    expect(mapOf(['a', 'A'], ['a'])).toEqual([{ a: 0, b: 0, name: 'a' }, { a: 1, b: null, name: 'A' }]);
  });

  test('exportModel: เลขแถวใน Excel + ทำเครื่องหมายเซลล์ที่ต่าง', () => {
    const cfg = { map: mapOf(H, H), keys: [0], trim: true, ignoreCase: true, tol: 0.01, offA: 5, offB: 3 };
    const r = C.diffTables(A, B, cfg);
    const sheets = C.exportModel(A, B, cfg, r), by = Object.fromEntries(sheets.map((s) => [s.id, s]));
    expect(sheets.map((s) => s.name)).toEqual(['สรุป', 'เพิ่ม', 'หาย', 'เปลี่ยน', 'คีย์ซ้ำ']);
    expect(by.added.rows[0]).toEqual([6, '005', 'ไขควง', 7, 25]); // แถวข้อมูลที่ 3 ใน B → 3 + offB
    expect(by.removed.rows[0]).toEqual([8, '004', 'คีม', 1, 80]);
    expect(by.changed.rows[0]).toEqual([7, 5, '003', 'เลื่อย ', '2 → 3', 300]);
    expect(by.changed.marks[0]).toEqual([null, null, null, null, 'chg', null]);
    expect(by.summary.rows.find((x) => x[0] === 'เพิ่ม (มีเฉพาะ B)')[1]).toBe(1);
  });

  test('20,000 แถวเทียบเสร็จเร็ว (Map ตามคีย์)', () => {
    const rows = [];
    for (let i = 0; i < 20000; i++) rows.push(['K' + i, 'name' + i, i, i * 2.5, 'x' + (i % 7), 'y']);
    const hh = ['id', 'name', 'n', 'p', 'g', 'z'];
    const b = rows.map((r) => r.slice());
    for (let i = 0; i < 100; i++) b[i * 10][3] += 1;
    b.splice(50, 30); for (let i = 0; i < 40; i++) b.push(['NEW' + i, 'n', 1, 1, 'g', 'z']);
    const t0 = Date.now();
    const r = C.diffTables({ headers: hh, rows }, { headers: hh, rows: b }, { map: mapOf(hh, hh), keys: [0], trim: true });
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(r.added).toHaveLength(40);
    expect(r.removed).toHaveLength(30);
    expect(r.changed.length + r.same).toBe(19970);
  });
});

/* ══════════ ข้อความ ══════════ */
test.describe('compare-calc.js — ข้อความ', () => {
  function lcsLen(a, b) {
    const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]);
    return d[a.length][b.length];
  }

  test('Myers: เท่ากับ LCS และประกอบลำดับเดิมกลับได้ (สุ่ม 1,500 คู่)', () => {
    let seed = 7;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    for (let t = 0; t < 1500; t++) {
      const a = Array.from({ length: rnd(14) }, () => rnd(4)), b = Array.from({ length: rnd(14) }, () => rnd(4));
      const ops = C.myers(a, b);
      expect(ops.filter((o) => o.t === 'eq').length).toBe(lcsLen(a, b));
      expect(ops.filter((o) => o.t !== 'add').map((o) => a[o.a])).toEqual(a);
      expect(ops.filter((o) => o.t !== 'del').map((o) => b[o.b])).toEqual(b);
    }
    expect(C.myers([1, 2, 3, 4, 5], [9, 8, 7, 6, 5, 4, 3, 2], 2)).toBeNull(); // เกิน maxD
  });

  const TA = 'บรรทัดหนึ่ง\nสวัสดีครับ วันนี้อากาศดี\nบรรทัดสาม\nบรรทัดสี่';
  const TB = 'บรรทัดหนึ่ง\nสวัสดีค่ะ วันนี้อากาศร้อน\nบรรทัดสาม\nบรรทัดห้า\nบรรทัดหก';
  test('diff บรรทัด: แก้/ลบ/เพิ่ม + จุดที่ต่าง + เลขบรรทัด', () => {
    const r = C.diffLines(TA, TB);
    expect(r.stats).toEqual({ same: 2, chg: 2, del: 0, add: 1 });
    expect(r.hunks).toBe(2);
    expect(r.rows.map((x) => [x.type, x.a, x.b, x.h])).toEqual([['eq', 1, 1, -1], ['chg', 2, 2, 0], ['eq', 3, 3, -1], ['chg', 4, 4, 1], ['add', 0, 5, 1]]);
    const same = C.diffLines('a\nb\n', 'a\nb');
    expect(same.hunks).toBe(0); expect(same.stats.same).toBe(2); // ขึ้นบรรทัดใหม่ท้ายไฟล์ไม่นับ
    expect(C.diffLines('', 'x\ny').stats).toEqual({ same: 0, chg: 0, del: 0, add: 2 });
    expect(C.diffLines('a\r\nb', 'a\nb').hunks).toBe(0);
  });

  test('ไฮไลต์คำไทย (Intl.Segmenter th): เฉพาะคำที่เปลี่ยน ส่วนที่เหลือไม่ถูกไฮไลต์', () => {
    const w = C.wordDiff('สวัสดีครับ วันนี้อากาศดี', 'สวัสดีค่ะ วันนี้อากาศร้อน');
    const changed = (list) => list.filter((s) => s.c).map((s) => s.t);
    expect(changed(w.a)).toEqual(['ครับ', 'ดี']);
    expect(changed(w.b)).toEqual(['ค่ะ', 'ร้อน']);
    expect(w.a.map((s) => s.t).join('')).toBe('สวัสดีครับ วันนี้อากาศดี'); // ต่อกลับได้ตรงต้นฉบับ
    expect(w.b.map((s) => s.t).join('')).toBe('สวัสดีค่ะ วันนี้อากาศร้อน');
    // ภาษาอังกฤษปนไทย
    const m = C.wordDiff('ราคา 100 บาท', 'ราคา 120 บาท');
    expect(m.a.filter((s) => s.c).map((s) => s.t)).toEqual(['100']);
    expect(m.b.filter((s) => s.c).map((s) => s.t)).toEqual(['120']);
  });

  test('ไม่สนช่องว่าง', () => {
    expect(C.diffLines('สวัสดี ครับ', 'สวัสดีครับ').hunks).toBe(1);
    expect(C.diffLines('สวัสดี ครับ', 'สวัสดีครับ', { ignoreSpace: true }).hunks).toBe(0);
    expect(C.diffLines('a  b\n\nc', 'a b\nc', { ignoreSpace: true }).stats.same).toBe(2 + 0); // บรรทัดว่างหนึ่งบรรทัดเป็นส่วนเกิน
    const w = C.wordDiff('ค่าเช่า 10,000 บาท', 'ค่าเช่า  10,000  บาท', true);
    expect(w.a.some((s) => s.c)).toBe(false);
    expect(w.b.some((s) => s.c)).toBe(false);
  });

  test('ไฟล์ใหญ่ต่างกันมาก: ไม่ค้าง และบอกว่าแสดงแบบหยาบ', () => {
    const a = Array.from({ length: 6000 }, (_, i) => 'a' + i).join('\n'), b = Array.from({ length: 6000 }, (_, i) => 'b' + i).join('\n');
    const t0 = Date.now();
    const r = C.diffLines(a, b, { maxD: 500 });
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(r.approx).toBe(true);
    expect(r.stats.same).toBe(0);
    // ต่างกันนิดเดียวใน 20,000 บรรทัด — Myers จบเร็ว
    const big = Array.from({ length: 20000 }, (_, i) => 'line ' + i), big2 = big.slice(); big2[10000] = 'changed';
    const t1 = Date.now();
    const r2 = C.diffLines(big.join('\n'), big2.join('\n'));
    expect(Date.now() - t1).toBeLessThan(1500);
    expect(r2.hunks).toBe(1); expect(r2.approx).toBe(false);
  });
});

/* ══════════ ใบเสนอราคา ══════════ */
test.describe('compare-calc.js — ให้คะแนนใบเสนอราคา', () => {
  const crit = C.defaultCriteria();
  const mk = (id, price, d, w, t) => ({ id, name: id, price, scores: { delivery: d, warranty: w, tech: t } });

  test('ค่าเริ่มต้น: ราคา 50 ส่งมอบ 20 รับประกัน 15 เทคนิค 15 รวม 100', () => {
    expect(crit.map((c) => [c.id, c.weight])).toEqual([['price', 50], ['delivery', 20], ['warranty', 15], ['tech', 15]]);
    expect(C.weightTotal(crit)).toBe(100);
    expect(crit[0].auto).toBe('price');
  });

  test('คะแนนราคา: ต่ำสุดได้เต็ม ที่เหลือ = ต่ำสุด/ราคา × เต็ม · ไม่มีราคา = null', () => {
    const s = C.priceScores([{ id: 'a', price: 100 }, { id: 'b', price: 125 }, { id: 'c', price: 80 }, { id: 'd', price: '' }, { id: 'e', price: 0 }]);
    expect(s.c).toBe(10); expect(s.a).toBeCloseTo(8, 10); expect(s.b).toBeCloseTo(6.4, 10);
    expect(s.d).toBeNull(); expect(s.e).toBeNull();
    expect(C.priceScores([{ id: 'x', price: 5 }]).x).toBe(10);
  });

  test('รวมคะแนนถ่วงน้ำหนัก + จัดอันดับ + คะแนนเท่ากันได้อันดับเดียวกัน', () => {
    const job = { criteria: crit, bidders: [mk('A', 100, 8, 6, 9), mk('B', 125, 10, 10, 7), mk('C', 80, 5, 5, 6)] };
    const r = C.rankJob(job);
    expect(r.ok).toBe(true);
    expect(r.rows.map((x) => [x.id, x.rank])).toEqual([['A', 1], ['B', 2], ['C', 3]]);
    expect(r.rows[0].total).toBeCloseTo(78.5, 10); // 40 + 16 + 9 + 13.5
    expect(r.rows[1].total).toBeCloseTo(77.5, 10); // 32 + 20 + 15 + 10.5
    expect(r.rows[2].total).toBeCloseTo(76.5, 10); // 50 + 10 + 7.5 + 9
    const tie = C.rankJob({ criteria: crit, bidders: [mk('A', 100, 8, 6, 9), mk('B', 125, 10, 10, 7), mk('A2', 100, 8, 6, 9), mk('C', 80, 5, 5, 6)] });
    expect(tie.rows.map((x) => [x.id, x.rank])).toEqual([['A', 1], ['A2', 1], ['B', 3], ['C', 4]]);
  });

  test('น้ำหนักรวมไม่เท่า 100 · คะแนนที่ยังไม่กรอกนับ 0 · คะแนนเกิน 0–10 ถูกจำกัด · เกณฑ์ที่เพิ่มเอง', () => {
    const c2 = crit.map((c) => Object.assign({}, c)); c2[3].weight = 10;
    expect(C.rankJob({ criteria: c2, bidders: [] })).toMatchObject({ ok: false, total: 95 });
    const r = C.rankJob({ criteria: crit, bidders: [{ id: 'A', price: 100, scores: { delivery: 99, warranty: -4 } }] });
    expect(r.rows[0].scores).toMatchObject({ price: 10, delivery: 10, warranty: 0, tech: null });
    expect(r.rows[0].missing).toBe(1);
    expect(r.rows[0].total).toBeCloseTo(50 + 20 + 0 + 0, 10);
    const extra = crit.concat([{ id: 'x', name: 'บริการ', weight: 0, auto: null }]);
    expect(C.rankJob({ criteria: extra, bidders: [{ id: 'A', price: 1, scores: { x: 10 } }] }).rows[0].parts.x).toBe(0);
  });

  test('cleanJob: ค่าเริ่มต้น/จำกัดช่วง/ตัดเกณฑ์ที่หายไป · quoteSheets', () => {
    const j = C.cleanJob({ name: '  ', bidders: [{ name: 'ก', price: '1,200.5', scores: { tech: '12', zzz: 5 }, files: [{ id: 'f1', name: 'a.pdf', size: 3, mime: 'application/pdf', junk: 1 }, { name: 'no-id' }] }, { price: -5 }] }, 'id1', 123);
    expect(j.id).toBe('id1'); expect(j.name).toBe('งานเปรียบเทียบราคา'); expect(j.updatedAt).toBe(123);
    expect(j.criteria).toHaveLength(4);
    expect(j.bidders[0]).toMatchObject({ price: 1200.5, scores: { tech: 10 }, files: [{ id: 'f1', name: 'a.pdf', size: 3, mime: 'application/pdf' }] });
    expect(j.bidders[0].files[0]).not.toHaveProperty('junk');
    expect(j.bidders[1].price).toBeNull();
    const q = C.quoteSheets({ criteria: crit, bidders: [mk('A', 100, 8, 6, 9), mk('B', 125, 10, 10, 7)].map((b) => Object.assign({ delivery: '', warranty: '', payment: '', note: '', files: [] }, b)) });
    expect(q.sheets[0].name).toBe('จัดอันดับ');
    expect(q.sheets[0].header[0]).toBe('อันดับ');
    expect(q.sheets[0].rows[0].slice(0, 3)).toEqual([1, 'A', 100]);
    expect(q.sheets[0].rows[0].at(-1)).toBe(88.5); // มีแค่ A กับ B → A ราคาต่ำสุดได้เต็ม 50 + 16 + 9 + 13.5
  });
});

/* ══════════ B. หน้า compare.html ══════════ */
async function openPage(page, p, { files = false, sync = false, theme = 'light', width = 1100 } = {}) {
  const errors = await prepare(page, { theme });
  await page.addInitScript(({ files, sync }) => {
    if (files) window.TANOT_FILES = { enabled: true };
    if (sync) window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
  }, { files, sync });
  // CDN ที่ prepare() บล็อกไว้ → เสิร์ฟจากแพ็กเกจใน tests/node_modules (route ที่ลงทีหลังมาก่อน)
  await page.route(XLSX_CDN, (r) => r.fulfill({ path: XLSX_LOCAL, contentType: 'application/javascript' }));
  await page.route(MAMMOTH_CDN, (r) => r.fulfill({ path: MAMMOTH_LOCAL, contentType: 'application/javascript' }));
  await page.setViewportSize({ width, height: 900 });
  await page.goto(p, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav');
  return errors;
}
const xbuf = (sheets) => {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};
const upload = (page, sel, name, buffer) => page.setInputFiles(sel, { name, mimeType: 'application/octet-stream', buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer) });
const run = async (page) => { await page.click('#runTable'); await expect(page.locator('#resBox')).toBeVisible(); };
const kpi = async (page) => (await page.locator('#kpis .kpi-value').allInnerTexts()).map((s) => +s.replace(/,/g, ''));

test.describe('หน้า compare.html — เทียบตาราง', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });

  const SA = [H, ['001', 'สว่าน', 10, 100], ['002', 'ค้อน', 5, 50], ['003', 'เลื่อย', 2, 300], ['004', 'คีม', 1, 80]];
  const SB = [H, ['001', 'สว่าน', 10, 100], ['002', 'ค้อน', 6, 50], ['003', 'เลื่อย', 2, 350.5], ['005', 'ไขควง', 7, 25]];

  test('xlsx 2 ไฟล์ (เลือกชีต) → จับคู่คอลัมน์ตามชื่อ → ผลถูก → ส่งออกแล้วอ่านกลับได้พร้อมสีไฮไลต์', async ({ page }, info) => {
    const errors = await openPage(page, '/compare.html');
    await expect(page.locator('#mapCard')).toBeHidden();
    await upload(page, '#fileA', 'old.xlsx', xbuf({ Sheet1: [['อื่น'], ['x']], ข้อมูล: SA }));
    await expect(page.locator('#sheetA')).toBeEnabled();
    await page.selectOption('#sheetA', 'ข้อมูล');
    await expect(page.locator('#infoA')).toContainText('4 แถว · 4 คอลัมน์');
    await upload(page, '#fileB', 'new.xlsx', xbuf({ ข้อมูล: SB }));
    await expect(page.locator('#mapCard')).toBeVisible();
    // จับคู่ตามชื่อหัวอัตโนมัติ + เดาคีย์ = คอลัมน์แรกที่ไม่ซ้ำ
    await expect(page.locator('#mapBody tr')).toHaveCount(4);
    await expect(page.locator('#mapBody select')).toHaveCount(4);
    expect(await page.locator('#mapBody select').evaluateAll((els) => els.map((e) => e.options[e.selectedIndex].text))).toEqual(H);
    await expect(page.locator('#mapBody [data-key="0"]')).toBeChecked();
    await expect(page.locator('#runTable')).toBeEnabled();
    await page.click('#runTable');
    await expect(page.locator('#resBox')).toBeVisible();
    expect(await kpi(page)).toEqual([1, 1, 2, 1]); // เพิ่ม หาย เปลี่ยน เหมือน
    // เริ่มที่กลุ่ม "เปลี่ยน": ไฮไลต์เฉพาะเซลล์ที่ต่าง แสดงเก่า → ใหม่
    await expect(page.locator('#groupSeg [aria-pressed="true"]')).toContainText('เปลี่ยน 2');
    await expect(page.locator('#resBody tr')).toHaveCount(2);
    await expect(page.locator('#resBody td.chg')).toHaveCount(2);
    await expect(page.locator('#resBody tr').nth(0).locator('td.chg')).toHaveText('5 → 6');
    await expect(page.locator('#resBody tr').nth(1).locator('td.chg')).toHaveText('300 → 350.5');
    await expect(page.locator('#resBody tr').nth(0).locator('td.rn')).toHaveText(['3', '3']); // แถวใน Excel (หัวตารางแถว 1)
    await page.click('#groupSeg [data-g="added"]');
    await expect(page.locator('#resBody tr')).toHaveCount(1);
    await expect(page.locator('#resBody tr')).toContainText('005');
    await page.click('#groupSeg [data-g="removed"]');
    await expect(page.locator('#resBody tr')).toContainText('004');
    await page.click('#groupSeg [data-g="dups"]');
    await expect(page.locator('#resBody tr')).toContainText('ไม่มีรายการ');
    await expect(page.locator('#dupWarn')).toBeEmpty();

    // ส่งออก
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportTable')]);
    expect(dl.suggestedFilename()).toMatch(/^compare_\d{4}-\d{2}-\d{2}\.xlsx$/);
    const file = info.outputPath('out.xlsx');
    await dl.saveAs(file);
    const wb = require('xlsx-js-style').readFile(file, { cellStyles: true });
    expect(wb.SheetNames).toEqual(['สรุป', 'เพิ่ม', 'หาย', 'เปลี่ยน', 'คีย์ซ้ำ']);
    const rows = (n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
    expect(rows('สรุป').find((r) => r[0] === 'ค่าเปลี่ยน')[1]).toBe(2);
    expect(rows('เพิ่ม')).toEqual([['แถวใน B', ...H], [5, '005', 'ไขควง', 7, 25]]);
    expect(rows('หาย')).toEqual([['แถวใน A', ...H], [5, '004', 'คีม', 1, 80]]);
    const ch = rows('เปลี่ยน');
    expect(ch[1]).toEqual([3, 3, '002', 'ค้อน', '5 → 6', 50]);
    expect(ch[2]).toEqual([4, 4, '003', 'เลื่อย', 2, '300 → 350.5']);
    const fill = (ws, addr) => { const s = ws[addr] && ws[addr].s; return s && s.fgColor && s.fgColor.rgb; };
    expect(fill(wb.Sheets['เปลี่ยน'], 'E2')).toMatch(/FFEB9C$/i); // เซลล์ที่ต่างเท่านั้น
    expect(fill(wb.Sheets['เปลี่ยน'], 'D2')).toBeFalsy();
    expect(fill(wb.Sheets['เพิ่ม'], 'B2')).toMatch(/C6EFCE$/i);
    expect(fill(wb.Sheets['หาย'], 'B2')).toMatch(/FFC7CE$/i);
    expect(errors).toEqual([]);
  });

  test('ตัวเลือก: ไม่สนตัวพิมพ์/ช่องว่าง, ตัวเลขคลาดเคลื่อน ±, ไม่เทียบคอลัมน์, เปลี่ยนคอลัมน์หลัก · CSV · แถวหัวตาราง', async ({ page }) => {
    const errors = await openPage(page, '/compare.html');
    await upload(page, '#fileA', 'a.csv', '﻿รายงานประจำเดือน\nรหัส,ชื่อ,ยอด,หมายเหตุ\nA1,Hello,10.00,x\nB2,เก่า,5,y\n');
    await page.fill('#hdrA', '2'); await page.dispatchEvent('#hdrA', 'change');
    await upload(page, '#fileB', 'b.csv', 'รหัส,ชื่อ,ยอด,หมายเหตุ\na1 ,HELLO,10.004,z\nB2,ใหม่,5,y\n');
    await expect(page.locator('#infoA')).toContainText('2 แถว');
    await expect(page.locator('#mapBody [data-key="0"]')).toBeChecked();
    await run(page);
    expect(await kpi(page)).toEqual([0, 0, 2, 0]); // a1: ยอด 10 vs 10.004 และหมายเหตุ x vs z · B2: ชื่อ
    await page.fill('#optTol', '0.01'); // ตัวเลือกเปลี่ยน → ผลเก่าถูกซ่อนจนกว่าจะเทียบใหม่
    await page.dispatchEvent('#optTol', 'change');
    await expect(page.locator('#resBox')).toBeHidden();
    await page.check('#mapBody [data-skip="3"]');
    await run(page);
    expect(await kpi(page)).toEqual([0, 0, 1, 1]); // เหลือ B2 ที่ชื่อต่าง
    await expect(page.locator('#resBody td.chg')).toHaveText('เก่า → ใหม่');
    // ติ๊กไม่สนตัวพิมพ์ออก
    await page.uncheck('#optCase'); await run(page);
    expect(await kpi(page)).toEqual([1, 1, 1, 0]); // คีย์ 'A1' ≠ 'a1' เมื่อแยกตัวพิมพ์ → เพิ่ม 1 หาย 1 · B2 ชื่อต่าง
    // เปลี่ยนคีย์เป็น "ชื่อ" → ไม่มีชื่อซ้ำกันเลยสักแถว (เพิ่ม 2 หาย 2 เมื่อเทียบตามชื่อ)
    await page.uncheck('#mapBody [data-key="0"]');
    await expect(page.locator('#runTable')).toBeDisabled();
    await page.check('#mapBody [data-key="1"]'); await run(page);
    expect(await kpi(page)).toEqual([2, 2, 0, 0]);
    // ไม่จับคู่คอลัมน์
    await page.selectOption('#mapBody [data-b="3"]', '');
    await expect(page.locator('#mapBadges')).toContainText('มีเฉพาะ A 1');
    await expect(page.locator('#mapBadges')).toContainText('มีเฉพาะ B 1');
    expect(errors).toEqual([]);
  });

  test('คีย์ซ้ำในไฟล์เดียวกันแสดงคำเตือน + กลุ่มคีย์ซ้ำ + แถวคีย์ว่างถูกข้าม', async ({ page }) => {
    await openPage(page, '/compare.html');
    await upload(page, '#fileA', 'a.xlsx', xbuf({ S: [['id', 'v'], ['1', 'a'], ['2', 'b'], ['2', 'c'], ['', 'z']] }));
    await upload(page, '#fileB', 'b.xlsx', xbuf({ S: [['id', 'v'], ['1', 'a'], ['2', 'b'], ['1', 'q']] }));
    await expect(page.locator('#mapBody [data-key="0"]')).not.toBeChecked(); // id ซ้ำ/ว่างใน A → ไม่เดาให้ (เดาเป็น v ที่ไม่ซ้ำแทน)
    await expect(page.locator('#mapBody [data-key="1"]')).toBeChecked();
    await page.uncheck('#mapBody [data-key="1"]');
    await page.check('#mapBody [data-key="0"]');
    await run(page);
    await expect(page.locator('#dupWarn')).toContainText('คีย์ซ้ำในไฟล์เดียวกัน — A 1 · B 1');
    await expect(page.locator('#dupWarn')).toContainText('ข้ามแถวที่คีย์ว่าง — A 1 · B 0');
    expect(await kpi(page)).toEqual([0, 0, 0, 2]);
    await page.click('#groupSeg [data-g="dups"]');
    await expect(page.locator('#resBody tr')).toHaveCount(2);
    await expect(page.locator('#resBody tr').nth(0)).toContainText('A');
    await expect(page.locator('#resBody tr').nth(0)).toContainText('3, 4'); // แถวใน Excel ของคีย์ 2 ที่ซ้ำ
    await expect(page.locator('#resBody tr').nth(1)).toContainText('2, 4');
  });

  test('ไฟล์ 20,000 แถว: เทียบเสร็จภายในเวลาที่กำหนด ไม่ค้าง และ render ทีละหน้าเท่านั้น', async ({ page }) => {
    test.setTimeout(120000);
    const hh = ['id', 'name', 'qty', 'price', 'grp', 'z'];
    const a = [hh], b = [hh];
    for (let i = 0; i < 20000; i++) a.push(['K' + i, 'name' + i, i, i * 2.5, 'g' + (i % 7), 'z']);
    for (let i = 0; i < 20000; i++) {
      if (i >= 100 && i < 150) continue; // หาย 50
      const r = a[i + 1].slice();
      if (i % 200 === 0) r[3] += 1; // เปลี่ยน 100
      b.push(r);
    }
    for (let i = 0; i < 70; i++) b.push(['NEW' + i, 'n', 1, 1, 'g', 'z']); // เพิ่ม 70
    const errors = await openPage(page, '/compare.html');
    await upload(page, '#fileA', 'big-a.xlsx', xbuf({ S: a }));
    await upload(page, '#fileB', 'big-b.xlsx', xbuf({ S: b }));
    await expect(page.locator('#infoB')).toContainText('20,020 แถว', { timeout: 30000 });
    await expect(page.locator('#runTable')).toBeEnabled();
    const t0 = Date.now();
    await page.click('#runTable');
    await expect(page.locator('#resBox')).toBeVisible({ timeout: 15000 });
    const ms = Date.now() - t0;
    expect(ms).toBeLessThan(8000);
    expect(await kpi(page)).toEqual([70, 50, 100, 19850]);
    expect(await page.evaluate(() => document.querySelectorAll('#resBody tr').length)).toBeLessThanOrEqual(50);
    await page.click('#groupSeg [data-g="added"]');
    await expect(page.locator('#pager')).toContainText('1–50 จาก 70');
    await page.click('#pager [data-pg="1"]');
    await expect(page.locator('#pager')).toContainText('51–70 จาก 70');
    await expect(page.locator('#resBody tr')).toHaveCount(20);
    await expect(page.locator('#pager [data-pg="1"]')).toBeDisabled();
    expect(errors).toEqual([]);
  });
});

/* ── ไฟล์ .docx ที่สร้างใน Node ── */
async function docx(paragraphs) {
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  z.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    paragraphs.map((p) => '<w:p><w:r><w:t xml:space="preserve">' + esc(p) + '</w:t></w:r></w:p>').join('') + '</w:body></w:document>');
  return z.generateAsync({ type: 'nodebuffer' });
}
// page.fill กับข้อความไทยหลายพันบรรทัดช้ามาก (เลย์เอาต์ textarea ของ Chromium) — ตั้งค่าตรงๆ แทน
const setText = (page, sel, text) => page.evaluate(([s, t]) => { document.querySelector(s).value = t; }, [sel, text]);
async function pickFile(page, side, name, buffer) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(`[data-pick="${side}"]`)]);
  await fc.setFiles({ name, mimeType: 'application/octet-stream', buffer });
}

test.describe('หน้า compare.html — เทียบเอกสาร', () => {
  test.use({ baseURL: SRV });

  test('docx 2 ไฟล์ → diff บรรทัด + ไฮไลต์คำ · ซ้าย-ขวา/รวม · กระโดดจุดที่ต่าง', async ({ page }) => {
    const errors = await openPage(page, '/compare.html#tab=text');
    await expect(page.locator('#tab-text')).toBeVisible();
    const pa = ['สัญญาเช่า', 'ผู้เช่าชำระวันที่ 5 ของทุกเดือน', 'ค่าเช่า 10,000 บาท', 'ข้อสุดท้าย'];
    const pb = ['สัญญาเช่า', 'ผู้เช่าชำระวันที่ 7 ของทุกเดือน', 'ค่าเช่า 10,000 บาท', 'ข้อสุดท้าย', 'ภาคผนวก'];
    await pickFile(page, 'A', 'old.docx', await docx(pa));
    await expect(page.locator('#txtInfoA')).toContainText('ตัวอักษร');
    await pickFile(page, 'B', 'new.docx', await docx(pb));
    await expect(page.locator('#txtInfoB')).toContainText('new.docx · ');
    expect(await page.inputValue('#txtA')).toContain('ผู้เช่าชำระวันที่ 5');
    await page.click('#runText');
    await expect(page.locator('#diffBox')).toBeVisible();
    await expect(page.locator('#diffStats')).toContainText('แก้ไข 1');
    await expect(page.locator('#diffStats')).toContainText('เพิ่ม 2'); // ย่อหน้าใหม่ + บรรทัดว่างคั่นย่อหน้าที่ mammoth ใส่ให้
    await expect(page.locator('#hunkPos')).toHaveText('ต่างกัน 2 จุด');
    // ไฮไลต์เฉพาะคำที่เปลี่ยน: "5" ฝั่งซ้าย "7" ฝั่งขวา
    await expect(page.locator('#diffView td.del mark')).toHaveText(['5']);
    await expect(page.locator('#diffView td.add mark')).toHaveText(['7']);
    expect(await page.locator('#diffView td.ln').first().innerText()).toBe('1');
    // กระโดดไปจุดที่ต่างถัดไป/ก่อนหน้า (วนรอบ)
    await page.click('#nextHunk');
    await expect(page.locator('#hunkPos')).toHaveText('จุดที่ 1 / 2');
    await expect(page.locator('#diffView tr.cur').first()).toContainText('ผู้เช่าชำระ');
    await page.click('#nextHunk');
    await expect(page.locator('#hunkPos')).toHaveText('จุดที่ 2 / 2');
    await expect(page.locator('#diffView tr.cur', { hasText: 'ภาคผนวก' })).toHaveCount(1);
    await page.click('#nextHunk');
    await expect(page.locator('#hunkPos')).toHaveText('จุดที่ 1 / 2');
    await page.click('#prevHunk');
    await expect(page.locator('#hunkPos')).toHaveText('จุดที่ 2 / 2');
    // มุมมองรวม: แถว − และ +
    await page.click('#viewSeg [data-view="unified"]');
    await expect(page.locator('#diffView td.sg', { hasText: '−' })).toHaveCount(1);
    await expect(page.locator('#diffView td.sg', { hasText: '+' })).toHaveCount(3);
    await expect(page.locator('#diffView.unified')).toBeVisible();
    // ส่วนที่เหมือนกันยาวๆ ถูกพับ — ไม่ render ทุกบรรทัด
    expect(errors).toEqual([]);
  });

  test('วางข้อความ: ไม่สนช่องว่าง · พับบรรทัดที่เหมือนกันและกดขยายได้ · แบ่งหน้าเมื่อมีจุดต่างมาก', async ({ page }) => {
    await openPage(page, '/compare.html#tab=text');
    await page.fill('#txtA', 'สวัสดี ครับ\nสอง'); await page.fill('#txtB', 'สวัสดีครับ\nสอง');
    await page.click('#runText');
    await expect(page.locator('#diffStats')).toContainText('แก้ไข 1');
    await page.check('#optSpace'); await page.click('#runText');
    await expect(page.locator('#diffStats')).toContainText('แก้ไข 0');
    await expect(page.locator('#hunkPos')).toHaveText('ไม่มีจุดที่ต่าง');
    await expect(page.locator('#nextHunk')).toBeDisabled();

    const lines = Array.from({ length: 3000 }, (_, i) => 'บรรทัด ' + i);
    const lb = lines.slice(); lb[1500] = 'แก้ไข';
    await page.uncheck('#optSpace');
    await setText(page, '#txtA', lines.join('\n')); await setText(page, '#txtB', lb.join('\n'));
    await page.click('#runText');
    await expect(page.locator('#hunkPos')).toHaveText('ต่างกัน 1 จุด');
    expect(await page.locator('#diffView tr').count()).toBeLessThan(20); // 3000 บรรทัด แต่พับเหลือรอบจุดที่ต่าง
    await expect(page.locator('#diffView tr.fold')).toHaveCount(2);
    await page.locator('#diffView tr.fold').first().click();
    expect(await page.locator('#diffView tr').count()).toBeGreaterThan(1000);

    // จุดที่ต่างมาก → แบ่งหน้า
    const many = Array.from({ length: 200 }, (_, i) => 'l' + i), many2 = many.map((l, i) => (i % 2 ? l : l + 'x'));
    await setText(page, '#txtA', many.join('\n')); await setText(page, '#txtB', many2.join('\n'));
    await page.click('#runText');
    await expect(page.locator('#hunkPos')).toHaveText('ต่างกัน 100 จุด');
    await expect(page.locator('#diffPager')).toContainText('หน้า 1 / 3');
    await page.click('#prevHunk'); // จากไม่ได้เลือก → จุดสุดท้ายอยู่หน้า 3
    await expect(page.locator('#diffPager')).toContainText('หน้า 3 / 3');
    await expect(page.locator('#hunkPos')).toHaveText('จุดที่ 100 / 100');
    await page.click('#diffPager [data-dpg="-1"]');
    await expect(page.locator('#diffPager')).toContainText('หน้า 2 / 3');
  });

  test('.txt จากไฟล์ + ปุ่มล้าง', async ({ page }) => {
    await openPage(page, '/compare.html#tab=text');
    await pickFile(page, 'A', 'a.txt', Buffer.from('หนึ่ง\nสอง\n', 'utf8'));
    await expect(page.locator('#txtInfoA')).toContainText('a.txt · ');
    expect((await page.inputValue('#txtA')).trim()).toBe('หนึ่ง\nสอง');
    await page.click('[data-clear="A"]');
    expect(await page.inputValue('#txtA')).toBe('');
  });
});

/* ══════════ ใบเสนอราคา ══════════ */
test.describe('หน้า compare.html — ใบเสนอราคา', () => {
  test.use({ baseURL: SRV });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });
  const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tanot:compare:quotes') || '[]'));

  async function fillBidder(page, i, v) {
    const card = page.locator('#bidList .cp-bid').nth(i);
    await card.locator('[data-f="name"]').fill(v.name);
    await card.locator('[data-f="price"]').fill(String(v.price));
    if (v.delivery) await card.locator('[data-f="delivery"]').fill(v.delivery);
    if (v.warranty) await card.locator('[data-f="warranty"]').fill(v.warranty);
    if (v.payment) await card.locator('[data-f="payment"]').fill(v.payment);
    if (v.note) await card.locator('[data-f="note"]').fill(v.note);
    for (const [k, s] of Object.entries(v.scores)) await card.locator(`[data-score="${k}"]`).fill(String(s));
  }
  const rankRows = async (page) => (await page.locator('#rankBox tbody tr').allInnerTexts()).map((t) => t.split('\t').map((s) => s.trim()));

  test('สร้างงาน → เกณฑ์ค่าเริ่มต้น → คะแนนราคาอัตโนมัติ → จัดอันดับ → น้ำหนักรวมต้อง 100 → ส่งออก → ไฟล์แนบ R2 → บันทึกแล้วโหลดใหม่ยังอยู่ → ลบงานลบไฟล์', async ({ page }, info) => {
    await page.addInitScript(() => { const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dlName = this.download; return c.apply(this, arguments); }; });
    const errors = await openPage(page, '/compare.html#tab=quotes', { files: true });
    await expect(page.locator('#jobBody')).toBeHidden();
    await expect(page.locator('#jobDel')).toBeDisabled();
    await page.click('#jobNew');
    await expect(page.locator('#jobBody')).toBeVisible();
    await expect(page.locator('#critList .cp-crit')).toHaveCount(4);
    expect(await page.locator('#critList [data-f="name"]').evaluateAll((e) => e.map((x) => x.value))).toEqual(['ราคา', 'ส่งมอบ', 'รับประกัน', 'คุณสมบัติทางเทคนิค']);
    expect(await page.locator('#critList [data-f="weight"]').evaluateAll((e) => e.map((x) => x.value))).toEqual(['50', '20', '15', '15']);
    await expect(page.locator('#wTotal .badge')).toHaveClass(/ok/);
    await expect(page.locator('#wTotal')).toContainText('น้ำหนักรวม 100%');
    await expect(page.locator('#bidList .cp-bid')).toHaveCount(2);
    await page.click('#bidAdd');
    await expect(page.locator('#bidList .cp-bid')).toHaveCount(3);
    // เกณฑ์ราคาไม่มีช่องกรอกคะแนน (คำนวณเอง) · เกณฑ์อื่นมี
    await expect(page.locator('#bidList .cp-bid').first().locator('[data-score]')).toHaveCount(3);
    await page.fill('#jobName', 'จัดซื้อเครื่องปั๊มน้ำ');
    await fillBidder(page, 0, { name: 'บริษัท A', price: 100, delivery: '30 วัน', warranty: '2 ปี', payment: 'เครดิต 30 วัน', note: 'รวม VAT', scores: { delivery: 8, warranty: 6, tech: 9 } });
    await fillBidder(page, 1, { name: 'บริษัท B', price: 125, scores: { delivery: 10, warranty: 10, tech: 7 } });
    await fillBidder(page, 2, { name: 'บริษัท C', price: 80, scores: { delivery: 5, warranty: 5, tech: 6 } });
    await expect(page.locator('#bidList .cp-bid').first().locator('[data-auto]')).toHaveText('ราคา 8.00 / 10');
    await expect(page.locator('#bidList .cp-bid').nth(2).locator('[data-auto]')).toHaveText('ราคา 10.00 / 10');
    let rows = await rankRows(page);
    expect(rows.map((r) => [r[0], r[1], r.at(-1)])).toEqual([['1', 'บริษัท A', '78.50'], ['2', 'บริษัท B', '77.50'], ['3', 'บริษัท C', '76.50']]);
    expect(rows[0][3]).toBe('8.00'); // คะแนนราคาของ A
    await expect(page.locator('#rankBox tbody tr').first()).toHaveClass(/win/);

    // น้ำหนักรวมไม่ครบ 100 → เตือน + ส่งออกไม่ได้
    await page.fill('#critList .cp-crit:nth-child(4) [data-f="weight"]', '10');
    await expect(page.locator('#wTotal .badge')).toHaveClass(/err/);
    await expect(page.locator('#wTotal')).toContainText('95');
    await expect(page.locator('#rankBox .callout.err')).toContainText('ปรับให้เท่ากับ 100%');
    await expect(page.locator('#exportQuote')).toBeDisabled();
    // เพิ่มเกณฑ์เอง + แก้น้ำหนักให้ครบ 100
    await page.click('#critAdd');
    await expect(page.locator('#critList .cp-crit')).toHaveCount(5);
    await page.locator('#critList .cp-crit').nth(4).locator('[data-f="name"]').fill('บริการหลังขาย');
    await page.locator('#critList .cp-crit').nth(4).locator('[data-f="weight"]').fill('5');
    await expect(page.locator('#wTotal')).toContainText('น้ำหนักรวม 100%');
    await expect(page.locator('#exportQuote')).toBeEnabled();
    await expect(page.locator('#bidList .cp-bid').first().locator('[data-score]')).toHaveCount(4);

    // ส่งออก
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportQuote')]);
    // suggestedFilename() ของ Playwright ทำชื่อไทยเพี้ยนเป็น "download" — อ่านชื่อที่หน้าตั้งใส่ <a download> แทน
    expect(await page.evaluate(() => window.__dlName)).toMatch(/^จัดซื้อเครื่องปั๊มน้ำ_\d{4}-\d{2}-\d{2}\.xlsx$/);
    const file = info.outputPath('quote.xlsx');
    await dl.saveAs(file);
    const wb = require('xlsx-js-style').readFile(file, { cellStyles: true });
    expect(wb.SheetNames).toEqual(['จัดอันดับ', 'ผู้เสนอราคา']);
    const sheet = (n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
    const rk = sheet('จัดอันดับ');
    expect(rk[0][0]).toBe('อันดับ'); expect(rk[0].at(-1)).toBe('คะแนนรวม (เต็ม 100)');
    expect(rk[1].slice(0, 3)).toEqual([1, 'บริษัท A', 100]);
    expect(rk.slice(1).map((r) => r[1])).toEqual(['บริษัท A', 'บริษัท B', 'บริษัท C']);
    expect(sheet('ผู้เสนอราคา')[1]).toEqual(['บริษัท A', 100, '30 วัน', '2 ปี', 'เครดิต 30 วัน', 'รวม VAT', '']);

    // ไฟล์แนบ → R2 ns compare
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#bidList .cp-bid').first().locator('[data-attach]').click()]);
    await fc.setFiles({ name: 'quote-a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
    await expect(page.locator('#bidList .cp-bid').first().locator('.cp-file a')).toHaveText('quote-a.pdf');
    expect((await (await page.request.get(SRV + '/__files')).json())).toHaveLength(1);
    const href = await page.locator('#bidList .cp-file a').getAttribute('href');
    expect((await page.request.get(SRV + href)).status()).toBe(200);
    // ชนิดที่ไม่รองรับ
    const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#bidList .cp-bid').nth(1).locator('[data-attach]').click()]);
    await fc2.setFiles({ name: 'x.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('x') });
    await expect(page.locator('#qMsg')).not.toBeEmpty();
    await expect(page.locator('#bidList .cp-bid').nth(1).locator('.cp-file')).toHaveCount(0);

    // บันทึกอัตโนมัติ → โหลดใหม่ยังอยู่ครบ
    await expect.poll(async () => (await stored(page))[0] && (await stored(page))[0].bidders[0].files.length).toBe(1);
    const saved = (await stored(page))[0];
    expect(saved).toMatchObject({ name: 'จัดซื้อเครื่องปั๊มน้ำ' });
    expect(saved.bidders.map((b) => [b.name, b.price])).toEqual([['บริษัท A', 100], ['บริษัท B', 125], ['บริษัท C', 80]]);
    expect(saved.criteria.map((c) => c.weight)).toEqual([50, 20, 15, 10, 5]);
    expect(saved.bidders[0].files[0]).toMatchObject({ name: 'quote-a.pdf', mime: 'application/pdf' });
    await page.reload();
    await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('#jobName')).toHaveValue('จัดซื้อเครื่องปั๊มน้ำ');
    await expect(page.locator('#bidList .cp-bid')).toHaveCount(3);
    await expect(page.locator('#bidList .cp-bid').first().locator('[data-f="delivery"]')).toHaveValue('30 วัน');
    expect((await rankRows(page)).map((r) => r[1])).toEqual(['บริษัท A', 'บริษัท B', 'บริษัท C']);

    // หลายงาน: สร้างงานที่ 2 แล้วสลับกลับ
    await page.click('#jobNew');
    await expect(page.locator('#jobSel option')).toHaveCount(2);
    await page.selectOption('#jobSel', { label: 'จัดซื้อเครื่องปั๊มน้ำ' });
    await expect(page.locator('#bidList .cp-bid')).toHaveCount(3);
    // ลบผู้เสนอราคาที่มีไฟล์ → ไฟล์ใน R2 ถูกลบด้วย
    await page.locator('#bidList .cp-bid').first().locator('[data-rmbid]').click();
    await page.locator('dialog .btn.danger').click();
    await expect(page.locator('#bidList .cp-bid')).toHaveCount(2);
    await expect.poll(async () => (await (await page.request.get(SRV + '/__files')).json()).length).toBe(0);
    // ลบงาน
    await page.locator('#jobDel').click();
    await page.locator('dialog .btn.danger').click();
    await expect(page.locator('#jobSel option')).toHaveCount(1);
    expect(await stored(page)).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('ซิงก์ 2 เครื่อง: แต่ละเครื่องสร้างงานคนละงานไม่ทับกัน · แก้ชื่อแล้วอีกเครื่องเห็นโดยไม่ต้องโหลดซ้ำ', async ({ browser }) => {
    const mk = async () => {
      const ctx = await browser.newContext({ baseURL: SRV });
      const page = await ctx.newPage();
      const errors = await openPage(page, '/compare.html#tab=quotes', { sync: true });
      return { ctx, page, errors };
    };
    const A = await mk(), B = await mk();
    const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));
    await A.page.click('#jobNew'); await A.page.fill('#jobName', 'งาน A');
    await fillBidder(A.page, 0, { name: 'ผู้ขาย 1', price: 10, scores: {} });
    await B.page.click('#jobNew'); await B.page.fill('#jobName', 'งาน B');
    await expect.poll(async () => (await stored(A.page))[0].name).toBe('งาน A'); // รอบันทึกอัตโนมัติ (350 ms)
    await expect.poll(async () => (await stored(B.page))[0].name).toBe('งาน B');
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    for (const d of [A, B]) {
      const jobs = await stored(d.page);
      expect(jobs.map((j) => j.name).sort()).toEqual(['งาน A', 'งาน B']);
      expect(new Set(jobs.map((j) => j.id)).size).toBe(2);
    }
    await expect(A.page.locator('#jobSel option')).toHaveCount(2); // วาดใหม่เอง
    // B เปิดงาน A แล้วเห็นผู้เสนอราคาที่ A กรอก
    await B.page.selectOption('#jobSel', { label: 'งาน A' });
    await expect(B.page.locator('#bidList .cp-bid').first().locator('[data-f="name"]')).toHaveValue('ผู้ขาย 1');
    for (const d of [A, B]) { expect(d.errors).toEqual([]); await d.ctx.close(); }
  });
});

test.describe('หน้า compare.html — แสดงผล', () => {
  test.use({ baseURL: SRV });
  test('มือถือ 390px ไม่ล้นแนวนอนทุกแท็บ · ธีมมืด · ไม่มีข้อความอธิบายค้างหน้า', async ({ page }) => {
    const errors = await openPage(page, '/compare.html', { width: 390, theme: 'dark' });
    for (const t of ['table', 'text', 'quotes']) {
      await page.click(`#tabs [data-tab="${t}"]`);
      await expect(page.locator('#tab-' + t)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    expect(await page.locator('.page-head').evaluate((e) => e.nextElementSibling.className)).toContain('tabs');
    expect(errors).toEqual([]);
  });
});
