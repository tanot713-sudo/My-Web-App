// ข้อมูลจำลองของหน้าแรก (index.html) + หน้าหมวด — ใช้ร่วมกันใน home.spec.js / theme-audit-home.spec.js / ภาพ visual
// นาฬิกาตายตัว = พุธ 30 ก.ย. 2569/2026 10:30 (เวลาไทย) · เดือนนี้ = 2026-09 · สัปดาห์นี้เริ่มจันทร์ 2026-09-28
const NOW = new Date('2026-09-30T10:30:00+07:00');
const NOW_MS = NOW.getTime();

/** ข้อมูลครบทุกแหล่งของ "ต้องทำวันนี้" + เรียนต่อ + เงิน + ลงทุน + สุขภาพ + อาหาร — เรียกใน addInitScript (ไม่อ้างตัวแปรนอกฟังก์ชัน) */
function seedFull() {
  const S = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  const now = new Date('2026-09-30T10:30:00+07:00').getTime(), DAY = 86400000; // ตายตัว — init script ของ seed รันก่อนนาฬิกาจำลอง Date.now() จึงยังเป็นเวลาจริง
  const ymd = (off) => { const d = new Date(now + off * DAY + 7 * 3600e3); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); };
  // ── เงิน: ข้าวใช้ 92% (warn) · น้ำมันเกินงบ 117% (err) · ค่าไฟ 45% ──
  S('budget:categories', [
    { id: 'cat-rice', name: 'ค่าข้าว', type: 'expense', color: '#F5A524' },
    { id: 'cat-fuel', name: 'เติมน้ำมัน', type: 'expense', color: '#EAB308' },
    { id: 'cat-elec', name: 'ค่าไฟ', type: 'expense', color: '#3B82F6' },
    { id: 'cat-salary', name: 'เงินเดือน', type: 'income', color: '#17B26A' },
  ]);
  S('budget:records', [
    { id: 'a', date: '2026-09-01', type: 'expense', categoryId: 'cat-rice', amount: 2760, note: '' },
    { id: 'b', date: '2026-09-02', type: 'expense', categoryId: 'cat-fuel', amount: 1400, note: '' },
    { id: 'c', date: '2026-09-01', type: 'income', categoryId: 'cat-salary', amount: 30000, note: '' },
    { id: 'd', date: '2026-09-05', type: 'expense', categoryId: 'cat-elec', amount: 900, note: '' },
    { id: 'e', date: '2026-08-01', type: 'expense', categoryId: 'cat-rice', amount: 1500, note: '' },
  ]);
  S('budget:budgets', { '2026-09': { 'cat-rice': 3000, 'cat-fuel': 1200, 'cat-elec': 2000 } });
  // ── เรียน: การ์ดถึงรอบ ภาษา 2 + ธุรกิจ 1 · วันติดต่อกัน 5 (ฝึกล่าสุดเมื่อวาน) · XP วันนี้ 42/50 ──
  S('lang-practice:srs', { a: { dueAt: 1 }, b: { dueAt: 1 }, c: { dueAt: now + 1e10 } });
  S('lang-practice:streak', { count: 5, longest: 12, lastDate: ymd(-1) });
  S('lbe:business:srs', { q1: { due: 1 } });
  S('tanot:learn:xp', [{ id: ymd(0) + '|dX|lang', d: ymd(0), dev: 'dX', area: 'edu', src: 'lang', xp: 42, n: 3, ts: now }, { id: ymd(-2) + '|dX|law', d: ymd(-2), dev: 'dX', area: 'edu', src: 'law', xp: 20, n: 2, ts: now - 2 * DAY }]);
  S('tanot:learn:settings', { goal: 50, rest: 1 });
  S('lang-practice:progress', {
    'lang-en:ทักทายและแนะนำตัว': [true, true, true, true], 'lang-en:การเดินทางและร้านอาหาร': [true, true, false, false],
    'lang-jp:ทักทายและแนะนำตัว': [true, false, false, false],
  });
  S('lbe:business:completed', { 'business:management': true, 'business:hrm': true });
  S('lbe:engineering:completed', { 'engineering:civil-eng': true });
  S('tanot:barprep:lessonread', { civil: { 'ภาค 1': 1, 'ภาค 2': 1, 'ภาค 3': 1 } });
  S('tanot:music:progress', { 'rhythm::0': true, 'rhythm::1': true });
  S('tanot:cooking:progress', { 'basics::0': true });
  S('tanot:nav:last', { 'languages.html': now - 3600e3, 'classroom-law.html': now - 26 * 3600e3, 'classroom-business.html': now - 3 * DAY, 'music.html': now - 5 * DAY, 'cooking.html': now - 2 * 3600e3, 'budget.html': now - 600e3, 'tax.html': now - 4 * DAY, 'insurance.html': now - 9 * DAY });
  // ── ลงทุน: PTT รวม 2 ล็อต (ราคาแคช 34.5) + AOT · snapshot 10 วันล่าสุดสำหรับกราฟ ──
  S('tanot:invest:thstock', [{ sym: 'PTT', shares: 200, cost: 32, ts: 1 }, { sym: 'PTT', shares: 100, cost: 36, ts: 2 }, { sym: 'AOT', shares: 500, cost: 60, ts: 3 }]);
  S('tanot:invest:cache:PTT', { ts: now, c: [30, 31, 32, 34.5] });
  S('tanot:invest:cache:q:PTT.BK', { ts: now, price: 34.5, prev: 34, prevClose: 34, spark: [] });
  S('tanot:invest:hub:watch:thai', ['PTT', 'AOT', 'CPALL']);
  const hist = [];
  for (let i = 12; i >= 1; i--) hist.push({ d: ymd(-i), v: 38000 + (13 - i) * 190 + (i % 3) * 120, c: 38000, n: 2, ts: now - i * DAY });
  S('tanot:invest:networth', hist);
  // ── สุขภาพ: น้ำหนัก 70.0 → 69.2 · ความดัน 118/76 · ยา 2 มื้อ/วัน (08:00 ผ่านแล้วยังไม่กิน) · ออกกำลังกาย 105 นาทีสัปดาห์นี้ ──
  S('tanot:health:vitals', [
    { id: 'v0', at: now - 25 * DAY, weight: 70.0 },
    { id: 'v1', at: now - 2 * DAY, weight: 69.2, sys: 118, dia: 76, hr: 70 },
  ]);
  S('tanot:health:meds', [{ id: 'm1', name: 'วิตามินดี', dose: '1 เม็ด', times: ['08:00', '20:00'], start: ymd(-30), end: '' }]);
  S('tanot:health:workouts', [
    { id: 'sports:w1', at: now - DAY, date: ymd(-1), kind: 'วิ่ง', minutes: 45, source: 'sports' },
    { id: 'sports:w2', at: now - 2 * DAY, date: ymd(-2), kind: 'ว่ายน้ำ', minutes: 60, source: 'sports' },
  ]);
  // ── อาหาร: แผนวันนี้ (พุธ = 2:*) เช้า/กลางวัน/เย็น · เช้าทำแล้ว ──
  S('tanot:cooking:plans', [{ id: 'week-2026-09-28', week: '2026-09-28', slots: { '2:b': { recipeId: 'seed-omelet', servings: 2 }, '2:l': { recipeId: 'seed-kaprao', servings: 2 }, '2:d': { recipeId: 'seed-tomyum', servings: 4 } }, done: { '2:b': now - 3600e3 }, awarded: { '2:b': now - 3600e3 }, updatedAt: now }]);
  // ── ใกล้กำหนด ≤ 30 วัน (+ ที่ไกลกว่านั้นต้องไม่โผล่) ──
  S('tanot:insurance:policies', [
    { id: 'p-health', type: 'health', insurer: 'เมืองไทย', name: 'สุขภาพ ผู้ป่วยใน', premium: 30000, freq: 'year', startDate: '2022-01-01', renewDate: ymd(10), taxCat: 'health', files: [] },
    { id: 'p-far', type: 'home', insurer: 'ทิพยประกันภัย', name: 'อัคคีภัย', premium: 3000, freq: 'year', startDate: '2024-05-01', renewDate: ymd(200), taxCat: 'none', files: [] },
  ]);
  S('tanot:car:vehicles', [{ id: 'v1', plate: 'กข 1234', province: 'กรุงเทพมหานคร', make: 'Toyota', model: 'Vios', year: 2022, odometer: 40000, actDue: ymd(5), taxDue: ymd(90), insuranceDue: '', inspectDue: '', files: [] }]);
  S('tanot:car:services', []);
  S('tanot:receipts:items', [
    { id: 'w1', store: 'Big C', date: ymd(-355), warrantyMonths: 12, warrantyProduct: 'พัดลม' },
    { id: 'w2', store: 'Home Pro', date: ymd(-30), warrantyMonths: 36, warrantyProduct: 'ตู้เย็น' },
  ]);
  S('tanot:mnt:assets', [
    { id: 'e1', code: 'RN05-ESC-01', name: 'บันไดเลื่อน', type: 'ESC', system: 'E&M', site: 's1', phase: { M3: 1 }, status: 'active' },
    { id: 'e2', code: 'RN05-ESC-02', name: 'บันไดเลื่อน', type: 'ESC', system: 'E&M', site: 's1', phase: { M3: 3 }, status: 'active' },
  ]);
  S('tanot:mnt:plans', [{ id: 'ESC|M3', type: 'ESC', typeName: 'บันไดเลื่อน', freq: 'M3', hours: 2, items: [{ id: 'i1', text: 'x', kind: 'check' }] }]);
  S('tanot:mnt:settings', { v: 1, startMonth: '2026-07' });
}

/** ทับค่าใน storage หลัง seedFull (ค่าเป็น JSON ธรรมดา; null = ลบคีย์) — ใช้ใน addInitScript ถัดจาก seedFull */
function applyOverrides(kv) {
  Object.keys(kv).forEach((k) => { if (kv[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(kv[k])); });
}
/** YYYY-MM-DD (เวลาไทย) ของ NOW + off วัน */
function ymd(off, base) {
  const d = new Date((base || NOW_MS) + off * 86400000 + 7 * 3600e3);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

module.exports = { NOW, NOW_MS, seedFull, applyOverrides, ymd };
