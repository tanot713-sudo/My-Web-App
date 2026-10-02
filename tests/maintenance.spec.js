// @ts-check
// บันทึกงานบำรุงรักษา (maintenance.html / mnt-calc.js / mnt-qr.js) — ROADMAP Phase 6 การทำงาน P1 · docs/maintenance-design.md หัวข้อ 9
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');

const C = require(path.join(__dirname, '..', 'mnt-calc.js'));
const SRV = 'http://localhost:8129';
// ใช้ /__reset ล้าง D1+R2 ของเซิร์ฟเวอร์ 8129 — ห้ามให้ describe ต่างกลุ่มรันขนานกัน
test.describe.configure({ mode: 'serial' });

/* ══════════ A. mnt-calc.js (require ตรง, known-answer) ══════════ */
test.describe('mnt-calc.js (known-answer)', () => {
  const S = { startMonth: '2026-10' };

  test('periodOf/window: Daily · Weekly เริ่มวันจันทร์ ข้ามปี · เดือน · กุมภาพันธ์อธิกสุรทิน', () => {
    expect(C.periodOf('Daily', '2026-10-02')).toBe('2026-10-02');
    expect(C.window('Daily', '2026-10-02')).toEqual({ start: '2026-10-02', end: '2026-10-02' });
    // 2026-10-02 เป็นวันศุกร์ → จันทร์ 2026-09-28
    expect(C.periodOf('Weekly', '2026-10-02')).toBe('2026-09-28');
    expect(C.periodOf('Weekly', '2026-12-28')).toBe('2026-12-28');
    expect(C.periodOf('Weekly', '2027-01-03')).toBe('2026-12-28'); // อาทิตย์ท้ายสัปดาห์
    expect(C.window('Weekly', '2026-12-28')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
    for (const f of ['M1', 'M3', 'M6', 'Annually']) expect(C.periodOf(f, '2026-11-17')).toBe('2026-11');
    expect(C.window('M3', '2026-11')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(C.window('M1', '2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(C.window('M1', '2027-02').end).toBe('2027-02-28');
    expect(C.periodYear('2026-12')).toBe(2026);
  });

  test('dueMonths: M3 phase 2 · M6 phase 6 · รายปี phase 12 · ก่อน startMonth ไม่มีรอบ', () => {
    expect(C.dueMonths('M3', 2, '2026-10', '2026-10', '2027-05')).toEqual(['2026-11', '2027-02', '2027-05']);
    expect(C.dueMonths('M6', 6, '2026-10', '2026-10', '2028-12')).toEqual(['2027-03', '2027-09', '2028-03', '2028-09']);
    expect(C.dueMonths('Annually', 12, '2026-10', '2026-10', '2028-12')).toEqual(['2027-09', '2028-09']);
    expect(C.dueMonths('M1', 1, '2026-10', '2026-08', '2026-12')).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(C.dueMonths('M3', 1, '2026-10', '2026-01', '2026-09')).toEqual([]);
    // เริ่มนับจากกลางรอบ
    expect(C.dueMonths('M3', 2, '2026-10', '2027-01', '2027-12')).toEqual(['2027-02', '2027-05', '2027-08', '2027-11']);
  });

  test('assignPhases: ESC 4 ตัว M3 เท่ากัน → 1,2,3,1 · ผลคงที่ · ไม่แตะ phase ที่มีอยู่', () => {
    const plans = [{ type: 'ESC', freq: 'M3', hours: 2 }];
    const assets = ['e1', 'e2', 'e3', 'e4'].map((id) => ({ id, type: 'ESC', status: 'active', phase: {} }));
    const r = C.assignPhases(assets, plans);
    expect([r.e1.M3, r.e2.M3, r.e3.M3, r.e4.M3]).toEqual([1, 2, 3, 1]);
    expect(C.assignPhases(assets, plans)).toEqual(r);
    // ผสมชั่วโมง: ผลต้องเหมือนกันทุกครั้ง และเรียงตามชั่วโมงมาก→น้อย
    const plans2 = [{ type: 'A', freq: 'M3', hours: 1 }, { type: 'B', freq: 'M3', hours: 5 }, { type: 'B', freq: 'M6', hours: 3 }];
    const assets2 = [{ id: 'a1', type: 'A', phase: {} }, { id: 'b1', type: 'B', phase: {} }, { id: 'b2', type: 'B', phase: {} }];
    const r2 = C.assignPhases(assets2, plans2);
    expect(C.assignPhases(assets2.slice().reverse(), plans2)).toEqual(r2);
    expect(r2.b1.M3).toBe(1); expect(r2.b2.M3).toBe(2); expect(r2.a1.M3).toBe(3);
    // ไม่แตะที่มี phase แล้ว และนับเป็นภาระ
    const assets3 = [{ id: 'e1', type: 'ESC', phase: { M3: 1 } }, { id: 'e2', type: 'ESC', phase: {} }];
    const r3 = C.assignPhases(assets3, plans);
    expect(r3.e1).toBeUndefined();
    expect(r3.e2.M3).toBe(2);
  });

  const asset = (id, extra) => Object.assign({ id, code: id.toUpperCase(), type: 'ESC', site: 's1', status: 'active', phase: { M3: 2, M6: 1, Annually: 1 } }, extra);
  const planM3 = { id: 'ESC|M3', type: 'ESC', freq: 'M3', hours: 2, items: [{ id: 'i1', text: 'ราวจับ', kind: 'check' }] };
  const planD = { id: 'ESC|Daily', type: 'ESC', freq: 'Daily', hours: 0.2, items: [{ id: 'i1', text: 'เดินเครื่อง', kind: 'check' }] };
  const planM1 = { id: 'ESC|M1', type: 'ESC', freq: 'M1', hours: 1, items: [{ id: 'i1', text: 'x', kind: 'check' }] };
  const doc = (aid, freq, period, at, extra) => Object.assign({ id: 'd', site: 's1', freq, period, dev: 'A', by: 'ช่าง', at, rows: { [aid]: { start: at - 1000, at, res: { i1: 'ok' } } } }, extra);
  const L = (s) => new Date(s + 'T12:00:00').getTime();

  test('dueList ที่ today คงที่: due / overdue / upcoming / ทำช้าแล้วหาย / รายวันไม่ overdue / retired ไม่ขึ้น', () => {
    const base = { assets: [asset('e1')], plans: [planM3, planD], settings: S, done: C.doneIndex([]), today: '2026-11-10', ahead: 7 };
    // M3 phase 2 → ครบ 2026-11 (ถึงกำหนดอยู่) ; รายวันวันนี้ยังไม่ทำ · กลุ่ม due เรียงตามวันสิ้นสุดช่วง (รายวันก่อน)
    let l = C.dueList(base);
    expect(l.map((x) => [x.plan.freq, x.state, x.period])).toEqual([['Daily', 'due', '2026-11-10'], ['M3', 'due', '2026-11']]);
    // ที่ 2027-01-10 → รอบพ.ย.ผ่านแล้วยังไม่ทำ = overdue; daysLate = 2027-01-10 − 2026-11-30 = 41
    l = C.dueList(Object.assign({}, base, { today: '2027-01-10', plans: [planM3] }));
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ state: 'overdue', period: '2026-11', daysLate: 41 });
    // 2027-01-30: รอบ ก.พ. เริ่ม 2027-02-01 ภายใน 7 วัน → upcoming มาพร้อม overdue พ.ย. (เรียง overdue ก่อน)
    l = C.dueList(Object.assign({}, base, { today: '2027-01-30', plans: [planM3] }));
    expect(l.map((x) => [x.state, x.period])).toEqual([['overdue', '2026-11'], ['upcoming', '2027-02']]);
    // ทำช้าแล้ว (บันทึกหลังช่วงจบ) = ไม่อยู่ในรายการ
    const lateDone = C.doneIndex([doc('e1', 'M3', '2026-11', L('2027-01-05'))]);
    l = C.dueList(Object.assign({}, base, { today: '2027-01-10', plans: [planM3], done: lateDone }));
    expect(l).toEqual([]);
    expect(C.status(asset('e1'), planM3, '2026-11', lateDone, '2027-01-10')).toBe('late-done');
    // รายวันที่พลาดเมื่อวานไม่ขึ้นเป็น overdue
    l = C.dueList(Object.assign({}, base, { plans: [planD], done: C.doneIndex([doc('e1', 'Daily', '2026-11-10', L('2026-11-10'))]) }));
    expect(l).toEqual([]);
    l = C.dueList(Object.assign({}, base, { plans: [planD], today: '2026-11-11', done: C.doneIndex([doc('e1', 'Daily', '2026-11-10', L('2026-11-10'))]) }));
    expect(l.map((x) => x.state)).toEqual(['due']);
    // retired ไม่ขึ้น
    expect(C.dueList(Object.assign({}, base, { assets: [asset('e1', { status: 'retired' })] }))).toEqual([]);
  });

  test('doneIndex: 2 doc คนละเครื่องรอบเดียวกัน → เอา at ล่าสุด', () => {
    const idx = C.doneIndex([
      doc('e1', 'M3', '2026-11', L('2026-11-05'), { dev: 'A', by: 'ก' }),
      doc('e1', 'M3', '2026-11', L('2026-11-20'), { dev: 'B', by: 'ข' }),
    ]);
    const d = idx.get('e1|M3|2026-11');
    expect(d).toMatchObject({ dev: 'B', by: 'ข', late: false });
    expect(d.at).toBe(L('2026-11-20'));
    expect(C.doneIndex([doc('e1', 'M3', '2026-11', L('2026-12-01'))]).get('e1|M3|2026-11').late).toBe(true);
  });

  test('compliance: onTime / late / missed ของเดือนตัวอย่าง', () => {
    const assets = [asset('e1', { phase: { M3: 2 } }), asset('e2', { phase: { M3: 2 } }), asset('e3', { phase: { M3: 2 } }), asset('e4', { phase: { M3: 2 } })];
    const done = C.doneIndex([
      doc('e1', 'M3', '2026-11', L('2026-11-12')),
      { id: 'x', site: 's1', freq: 'M3', period: '2026-11', dev: 'A', by: '', at: L('2026-12-03'), rows: { e2: { start: 1, at: L('2026-12-03'), res: {} } } },
    ]);
    const o = { assets, plans: [planM3], settings: S, done, from: '2026-11-01', to: '2026-11-30', today: '2026-12-15', freqs: ['M3'] };
    expect(C.compliance(o)).toEqual([{ month: '2026-11', site: 's1', freq: 'M3', due: 4, onTime: 1, late: 1, missed: 2 }]);
    // รอบที่ยังไม่จบและยังไม่ทำไม่นับเป็นพลาด
    expect(C.compliance(Object.assign({}, o, { today: '2026-11-20' }))[0]).toMatchObject({ due: 2, onTime: 1, late: 1, missed: 0 });
  });

  test('foldWo: event สลับลำดับ → ผลตาม at · at เท่ากันตัดด้วย dev · parts → matCost · note เรียงเวลา · cancel', () => {
    const wo = { id: 'w1', no: 'CM-261002-AAA', kind: 'cm', asset: 'e1', site: 's1', reportedAt: 1000, priority: 'normal', symptom: 'เสียงดัง', createdAt: 1000 };
    const ev = (id, at, dev, set, note, photos) => ({ id, wo: 'w1', at, dev, set, note, photos });
    const events = [
      ev('3', 3000, 'B', { status: 'done', endAt: 3000 }, 'เสร็จแล้ว'),
      ev('1', 2000, 'A', { status: 'progress', assignee: 'สมชาย', parts: [{ name: 'สายพาน', qty: 2, unitCost: 150 }, { name: 'น็อต', qty: 10, unitCost: 3 }], laborCost: 500 }, 'เริ่มงาน', [{ item: null, id: 'f1' }]),
      ev('2', 3000, 'A', { status: 'parts', cause: 'สายพานขาด' }),
    ];
    const f = C.foldWo(wo, events);
    // at เท่ากัน (3000) ตัดสินด้วย dev: A ก่อน B → B ชนะ status = done
    expect(f.status).toBe('done');
    expect(f.cause).toBe('สายพานขาด');
    expect(f.assignee).toBe('สมชาย');
    expect(f.matCost).toBe(330);
    expect(f.laborCost).toBe(500);
    expect(f.notes.map((n) => n.note)).toEqual(['เริ่มงาน', 'เสร็จแล้ว']);
    expect(f.photos).toHaveLength(1);
    expect(f.symptom).toBe('เสียงดัง');
    expect(C.foldWo(wo, events.slice().reverse())).toEqual(f);
    const c = C.foldWo(wo, [ev('9', 5000, 'A', { status: 'cancel' })]);
    expect(c.cancelled).toBe(true);
    expect(C.foldWo(wo, [])).toMatchObject({ status: 'open', matCost: 0 });
  });

  test('splitChecklist: เลขนำหน้า / บูลเล็ต / บรรทัดว่าง / ;', () => {
    expect(C.splitChecklist('1. ตรวจราวจับ\n2) ตรวจหวี\n- วัดกระแส\n• ทำความสะอาด\n\n   \n3.ตรวจเสียง; ตรวจน้ำมัน')).toEqual(
      ['ตรวจราวจับ', 'ตรวจหวี', 'วัดกระแส', 'ทำความสะอาด', 'ตรวจเสียง', 'ตรวจน้ำมัน']);
    expect(C.splitChecklist('')).toEqual([]);
    expect(C.splitChecklist(null)).toEqual([]);
  });

  /* ชีตตามสัญญาคอลัมน์ของ generate_v5.load_input() (แถว 1–2 หัวตาราง ข้อมูลเริ่มแถว 3) */
  function sheets(over) {
    const eq = [['h'], ['h'],
      ['RN05 บางซื่อ', 'E&M', 'บันไดเลื่อน', 'Escalator', 'ESC', 3, 2, ''],
      ['RN05 บางซื่อ', 'E&M', 'ลิฟต์', 'Lift', 'LIFT', 1, 2, ''],
      ['สถานีกลาง', 'E&M', 'บันไดเลื่อน', 'Escalator', 'ESC', 2, 2, '']];
    const plan = [['h'], ['h'],
      ['ESC', null, 0.5, null, 1, 2.5, 4, 8],
      ['LIFT', null, null, 0.5, 1, null, 3, null],
      ['ZZZ', null, null, null, 1, null, null, null]];
    const activity = [['h'], ['h'],
      ['ESC', null, null, 'M3', '1. ตรวจราวจับ\n2. วัดกระแสมอเตอร์', 'D', 2.5],
      ['ESC', null, null, 'Daily', 'เดินเครื่อง', 'N', null]];
    const route = [['h'], ['h'], ['RN05 บางซื่อ', 13.8, 100.54, 'C1', 1, null, null]];
    const project = [['h'], ['h'], ['project_name', null, 'โครงการทดสอบ'], ['project_short_name', null, 'LN1']];
    return Object.assign({ EQUIPMENT: eq, PM_PLAN: plan, PM_ACTIVITY: activity, ROUTE: route, PROJECT: project }, over || {});
  }

  test('fromEstCost: จำนวน/รหัส ABBR-CODE-NN/id คงที่/นำเข้าซ้ำ/qty ±/แผน edited/warning', () => {
    const r1 = C.fromEstCost(sheets(), {});
    expect(r1.sites.map((x) => [x.name, x.abbr])).toEqual([['RN05 บางซื่อ', 'RN05'], ['สถานีกลาง', 'S02']]);
    expect(r1.sites[0]).toMatchObject({ lat: 13.8, lng: 100.54, circuit: 'C1', order: 1 });
    expect(r1.assets.map((a) => a.code)).toEqual(['RN05-ESC-01', 'RN05-ESC-02', 'RN05-ESC-03', 'RN05-LIFT-01', 'S02-ESC-01', 'S02-ESC-02']);
    expect(r1.report.added).toEqual({ sites: 2, assets: 6, plans: 9 }); // ESC 5 ความถี่ + LIFT 3 + ZZZ 1
    expect(r1.settingsPatch).toEqual({ project: 'โครงการทดสอบ', line: 'LN1' });
    const byId = Object.fromEntries(r1.plans.map((p) => [p.id, p]));
    expect(Object.keys(byId).sort()).toEqual(['ESC|Annually', 'ESC|Daily', 'ESC|M1', 'ESC|M3', 'ESC|M6', 'LIFT|M1', 'LIFT|M6', 'LIFT|Weekly', 'ZZZ|M1'].sort());
    expect(byId['ESC|M3']).toMatchObject({ hours: 2.5, shift: 'D', typeName: 'บันไดเลื่อน', edited: false });
    expect(byId['ESC|M3'].items.map((i) => [i.id, i.text, i.kind])).toEqual([['i1', 'ตรวจราวจับ', 'check'], ['i2', 'วัดกระแสมอเตอร์', 'check']]);
    expect(byId['ESC|Daily'].shift).toBe('N');
    // ไม่มี PM_ACTIVITY ของแผนนั้น → ข้อเดียว = ชื่อแผน
    expect(byId['LIFT|M1'].items).toHaveLength(1);
    expect(byId['LIFT|M1'].items[0].text).toContain('ลิฟต์');
    expect(r1.warnings.join('\n')).toMatch(/ZZZ/);
    // id คงที่เมื่อรันซ้ำ และนำเข้าซ้ำไม่เพิ่ม
    const r1b = C.fromEstCost(sheets(), {});
    expect(r1b.assets.map((a) => a.id)).toEqual(r1.assets.map((a) => a.id));
    const r2 = C.fromEstCost(sheets(), r1);
    expect(r2.assets).toHaveLength(6);
    expect(r2.report.added).toEqual({ sites: 0, assets: 0, plans: 0 });
    expect(r2.report.missing).toBe(0);
    // qty +1 เพิ่ม 1 ตัวต่อท้าย
    const s3 = sheets(); s3.EQUIPMENT[2][5] = 4;
    const r3 = C.fromEstCost(s3, r1);
    expect(r3.assets).toHaveLength(7);
    expect(r3.assets[6].code).toBe('RN05-ESC-04');
    expect(r3.report.added.assets).toBe(1);
    // qty −1 ตั้ง missing ไม่ลบ · เก็บ code/phase/ที่ผู้ใช้กรอกไว้
    r1.assets[2].phase = { M3: 3 }; r1.assets[2].serial = 'SN-9'; r1.assets[2].code = 'ป้ายจริง-3';
    const s4 = sheets(); s4.EQUIPMENT[2][5] = 2;
    const r4 = C.fromEstCost(s4, r1);
    expect(r4.assets).toHaveLength(6);
    expect(r4.assets[2]).toMatchObject({ missing: true, code: 'ป้ายจริง-3', serial: 'SN-9', phase: { M3: 3 } });
    expect(r4.report.missing).toBe(1);
    // กลับมาอยู่ในไฟล์ → missing หาย
    expect(C.fromEstCost(sheets(), r4).assets[2].missing).toBe(false);
    // แผน edited ไม่ถูกทับ
    const ed = JSON.parse(JSON.stringify(r1)); ed.plans.find((p) => p.id === 'ESC|M3').edited = true; ed.plans.find((p) => p.id === 'ESC|M3').hours = 9;
    const s5 = sheets(); s5.PM_PLAN[2][5] = 7;
    const r5 = C.fromEstCost(s5, ed);
    expect(r5.plans.find((p) => p.id === 'ESC|M3').hours).toBe(9);
    expect(r5.report.skipped).toEqual(['ESC|M3']);
    // แผนไม่แก้ → ชั่วโมงใหม่ทับ, ข้อที่ข้อความเดิมคง id, ข้อใหม่ต่อเลข
    const s6 = sheets(); s6.PM_PLAN[2][5] = 7; s6.PM_ACTIVITY[2][4] = '1. วัดกระแสมอเตอร์\n2. ตรวจน้ำมัน';
    const r6 = C.fromEstCost(s6, r1);
    const p6 = r6.plans.find((p) => p.id === 'ESC|M3');
    expect(p6.hours).toBe(7);
    expect(p6.items.map((i) => [i.id, i.text])).toEqual([['i2', 'วัดกระแสมอเตอร์'], ['i3', 'ตรวจน้ำมัน']]);
    // ไม่มีชีต PM_ACTIVITY → ข้อเดียวต่อแผน + warning
    const s7 = sheets(); delete s7.PM_ACTIVITY;
    const r7 = C.fromEstCost(s7, {});
    expect(r7.plans.every((p) => p.items.length === 1)).toBe(true);
    expect(r7.warnings.join('\n')).toMatch(/PM_ACTIVITY/);
    // ตัวย่อชนกัน → ต่อท้าย -2
    const s8 = sheets(); s8.EQUIPMENT[4][0] = 'RN05 อีกแห่ง';
    expect(C.fromEstCost(s8, {}).sites.map((x) => x.abbr)).toEqual(['RN05', 'RN05-2']);
  });

  test('reportRows: หัวคอลัมน์/ลำดับ/ค่า · ช่องว่าง · ผ่านตรรกะ roleCol และ scoreHeaderRow ของ report-dashboard', () => {
    const XLSX = require('xlsx');
    const sites = [{ id: 's1', name: 'RN05 บางซื่อ', abbr: 'RN05', lat: 13.8, lng: 100.5 }];
    const assets = [asset('e1', { code: 'RN05-ESC-01', name: 'บันไดเลื่อน', system: 'E&M', phase: { M3: 2 } })];
    const plans = [{ id: 'ESC|M3', type: 'ESC', typeName: 'บันไดเลื่อน', freq: 'M3', hours: 2, items: [{ id: 'i1', text: 'ตรวจราวจับ', kind: 'check' }, { id: 'i2', text: 'วัดกระแส', kind: 'num', unit: 'A' }] }];
    const settings = { startMonth: '2026-10', line: 'LN1', project: 'ทดสอบ' };
    const inspDocs = [{ id: 'd', site: 's1', freq: 'M3', period: '2026-11', dev: 'A', by: 'สมชาย', at: L('2026-12-02'),
      rows: { e1: { start: L('2026-12-02') - 600000, at: L('2026-12-02'), res: { i1: 'ng', i2: 28.4 }, note: 'มีเสียง', photos: [{ item: 'i1', id: 'f' }] } } }];
    const wos = [
      { id: 'w1', no: 'CM-261105-AAA', kind: 'cm', asset: 'e1', site: 's1', reportedAt: L('2026-11-05'), priority: 'high', symptom: 'เสียงดัง', createdAt: 1 },
      { id: 'w2', no: 'CM-261106-BBB', kind: 'cm', asset: 'e1', site: 's1', reportedAt: L('2026-11-06'), priority: 'normal', symptom: 'x', createdAt: 1 },
      { id: 'w3', no: 'CM-261107-CCC', kind: 'cm', asset: 'e1', site: 's1', reportedAt: L('2026-11-07'), priority: 'low', symptom: 'y', createdAt: 1 },
    ];
    const woEvents = [
      { id: 'w1|a|A', wo: 'w1', at: L('2026-11-06'), dev: 'A', set: { status: 'done', startAt: L('2026-11-06'), endAt: L('2026-11-07'), downtimeH: 5, failureMode: 'สายพาน', cause: 'ขาด', action: 'เปลี่ยน', assignee: 'ช่าง', parts: [{ name: 'สายพาน', qty: 2, unitCost: 100 }], laborCost: 300, otherCost: 50 } },
      { id: 'w2|a|A', wo: 'w2', at: L('2026-11-07'), dev: 'A', set: { status: 'cancel' } },
      { id: 'w3|a|A', wo: 'w3', at: L('2026-11-08'), dev: 'A', set: { status: 'parts', planFinish: '2026-11-20' } },
    ];
    const r = C.reportRows({ assets, sites, plans, settings, inspDocs, wos, woEvents, from: '2026-10-01', to: '2026-12-31', today: '2026-12-15' });
    expect(r.headers).toEqual(['Work Order', 'Work Order Type', 'Equipment No', 'Equipment Type', 'Subsystem', 'Location', 'Line', 'Priority', 'Status',
      'Failure Mode', 'Plan Start', 'Plan Finish', 'Actual Start', 'Actual End', 'Downtime (h)', 'Material Cost', 'Labor Cost', 'Other Cost', 'Assignee', 'Cause', 'Action']);
    const H = (n) => r.headers.indexOf(n);
    const byNo = Object.fromEntries(r.rows.map((x) => [x[0], x]));
    expect(Object.keys(byNo).sort()).toEqual(['CM-261105-AAA', 'CM-261107-CCC', 'PM-RN05-ESC-01-M3-2026-11']);
    const cm = byNo['CM-261105-AAA'];
    expect(cm[H('Work Order Type')]).toBe('CM');
    expect(cm[H('Status')]).toBe('เสร็จ');
    expect(cm[H('Priority')]).toBe('สูง');
    expect(cm[H('Material Cost')]).toBe(200);
    expect(cm[H('Labor Cost')]).toBe(300);
    expect(cm[H('Downtime (h)')]).toBe(5);
    expect(cm[H('Line')]).toBe('LN1');
    expect(cm[H('Location')]).toBe('RN05 บางซื่อ');
    expect(cm[H('Actual End')]).toBeInstanceOf(Date);
    expect(byNo['CM-261107-CCC'][H('Status')]).toBe('ล่าช้า'); // รออะไหล่แต่เลย planFinish
    expect(byNo['CM-261107-CCC'][H('Failure Mode')]).toBeNull(); // ช่องว่างเป็นค่าว่าง
    const pm = byNo['PM-RN05-ESC-01-M3-2026-11'];
    expect(pm[H('Work Order Type')]).toBe('PM');
    expect(pm[H('Status')]).toBe('เสร็จ ล่าช้า');
    expect(pm[H('Failure Mode')]).toBe('ตรวจราวจับ');
    expect(pm[H('Assignee')]).toBe('สมชาย');
    expect(pm[H('Plan Start')]).toEqual(new Date(2026, 10, 1));
    expect(pm[H('Plan Finish')]).toEqual(new Date(2026, 10, 30));
    expect(r.inspections.rows).toHaveLength(2);
    expect(r.inspections.rows[0].slice(6, 9)).toEqual(['ตรวจราวจับ', 'ไม่ผ่าน', null]);
    expect(r.inspections.rows[1].slice(6, 10)).toEqual(['วัดกระแส', null, 28.4, 'A']);
    expect(r.compliance.rows).toEqual([['2026-11', 'RN05 บางซื่อ', 'ราย 3 เดือน', 1, 0, 1, 0]]);
    expect(r.assets.rows).toHaveLength(1);

    /* ── ตรรกะของ report-dashboard (คัดลอกมาเพื่อกันหัวคอลัมน์ไม่ตรง) ──
       roleCol / รายการคำ: report-dashboard.maintenance.final1.js บรรทัด 43–47, 96–111 (getData) · classifyWO บรรทัด 53–59
       scoreHeaderRow / findBestAutoImport: report-dashboard.complete.final43.local.js บรรทัด ~723–756 */
    const text = (v) => String(v == null ? '' : v).trim();
    const roleCol = (st, words) => (st.columns || []).find((c) => { const n = text(c.label).toLowerCase(); return words.some((w) => n === w || n.indexOf(w) >= 0); }) || null;
    const st = { columns: r.headers.map((h, i) => ({ key: i, label: h })) };
    const roles = {
      workorder: ['workorder', 'work order', 'ใบสั่งงาน', 'เลขที่งาน'], equipmentno: ['equipmentno', 'equipment no', 'equipment id', 'รหัสเครื่องจักร', 'รหัสอุปกรณ์'],
      equipmenttype: ['equipmenttype', 'equipment type', 'ประเภทเครื่องจักร', 'ประเภทอุปกรณ์'], downtime: ['downtime', 'เวลาหยุด', 'หยุดทำงาน'],
      planfinish: ['planfinish', 'plan finish', 'planworkfinish', 'กำหนดเสร็จ'], actstart: ['actworkstart', 'actualstart', 'actual start', 'เริ่มปฏิบัติงาน', 'เริ่มจริง'],
      actend: ['actworkend', 'actualend', 'actual end', 'เสร็จปฏิบัติงาน', 'เสร็จจริง'], matcost: ['matcost', 'material cost', 'ค่าวัสดุ', 'ค่าอะไหล่'],
      laborcost: ['laborcost', 'labourcost', 'labor cost', 'ค่าแรง'], status: ['status', 'สถานะ'], failuremode: ['failuremode', 'failure mode', 'อาการเสีย', 'สาเหตุเสีย', 'รูปแบบการเสีย'],
      workordertype: ['work order type', 'wo type', 'maintenance type', 'ประเภทงาน', 'ประเภทการซ่อมบำรุง'], line: ['line', 'route', 'สาย', 'โครงการ'],
    };
    const want = { workorder: 'Work Order', equipmentno: 'Equipment No', equipmenttype: 'Equipment Type', downtime: 'Downtime (h)', planfinish: 'Plan Finish', actstart: 'Actual Start',
      actend: 'Actual End', matcost: 'Material Cost', laborcost: 'Labor Cost', status: 'Status', failuremode: 'Failure Mode', workordertype: 'Work Order Type', line: 'Line' };
    for (const k of Object.keys(roles)) expect(roleCol(st, roles[k]) && roleCol(st, roles[k]).label, 'role ' + k).toBe(want[k]);
    const PM_KW = ['pm', 'preventive', 'planned', 'ตามแผน', 'ป้องกัน', 'บำรุงรักษาเชิงป้องกัน'];
    const CM_KW = ['cm', 'corrective', 'breakdown', 'unplanned', 'ฉุกเฉิน', 'ซ่อมฉุกเฉิน', 'เสีย', 'ขัดข้อง'];
    const classify = (a, b, c) => { const n = (text(a) + ' ' + text(b) + ' ' + text(c)).toLowerCase(); return CM_KW.some((k) => n.indexOf(k) >= 0) ? 'cm' : PM_KW.some((k) => n.indexOf(k) >= 0) ? 'pm' : 'other'; };
    // ใช้เฉพาะ 'Work Order Type' (ตามที่หน้า report-dashboard ส่งให้ตัวจำแนกจากคอลัมน์นั้น) — ชนิดงานต้องแยก CM/PM ได้
    expect(classify('CM', '', '')).toBe('cm');
    expect(classify('PM', '', '')).toBe('pm');
    // มีแถวที่มีวันที่ (actend/actstart/planfinish) ≥ 2
    const dated = r.rows.filter((x) => x[H('Actual End')] || x[H('Actual Start')] || x[H('Plan Finish')]);
    expect(dated.length).toBeGreaterThanOrEqual(2);

    // workbook 4 ชีต: WorkOrders ต้องเป็นชีตที่ได้คะแนน ≥ 8 สูงสุด ชีตอื่นต่ำกว่า
    const wb = XLSX.utils.book_new();
    const add = (name, o) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([o.headers].concat(o.rows)), name);
    add('WorkOrders', r); add('Inspections', r.inspections); add('Assets', r.assets); add('Compliance', r.compliance);
    const norm = (v) => String(v == null ? '' : v).toLowerCase().replace(/[\s_\-\/\(\)\[\]\.:%]/g, '');
    const score = (row) => {
      const joined = row.map(norm).filter(Boolean).join('|'); let sc = 0;
      if (/(^|\|)wbs($|\|)/.test(joined) || joined.indexOf('wbs') >= 0) sc += 4;
      if (joined.indexOf('taskname') >= 0 || joined.indexOf('task') >= 0) sc += 4;
      if (joined.indexOf('start') >= 0) sc += 3;
      if (joined.indexOf('finish') >= 0 || joined.indexOf('end') >= 0) sc += 3;
      if (joined.indexOf('actual') >= 0) sc += 3;
      if (joined.indexOf('plan') >= 0) sc += 3;
      if (joined.indexOf('spi') >= 0 || joined.indexOf('actualplan') >= 0) sc += 2;
      if (joined.indexOf('duration') >= 0) sc += 1;
      return sc;
    };
    const best = {};
    for (const name of wb.SheetNames) {
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
      let b = -1;
      for (let i = 0; i < Math.min(15, aoa.length); i++) {
        let sc = score(aoa[i] || []), dc = 0;
        for (let q = i + 1; q < Math.min(aoa.length, i + 8); q++) if ((aoa[q] || []).some((v) => v !== null && v !== undefined && v !== '')) dc++;
        b = Math.max(b, sc + Math.min(3, dc));
      }
      best[name] = b;
    }
    expect(best.WorkOrders).toBeGreaterThanOrEqual(8);
    for (const n of ['Inspections', 'Assets', 'Compliance']) expect(best[n], n).toBeLessThan(best.WorkOrders);
    expect(wb.SheetNames[0]).toBe('WorkOrders');
  });
});
