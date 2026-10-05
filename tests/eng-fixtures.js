// ข้อมูลตัวอย่าง + สถานะที่เปิดของ eng-audit.spec.js (รอบ 6) — แยกจากตัวตรวจเพื่อให้อ่านง่าย
// targets(h) คืน [{ page, seed, init, route, wait, user (regex ข้อมูลผู้ใช้ที่ seed — ไม่นับเป็นไทยหลุด), skipSel, overlay, states }]
const NOW = new Date('2026-10-03T03:00:00Z').getTime();

/* ───────── ภาษี ───────── */
const TAX_SEED = {
  'budget:categories': [
    { id: 'cat-salary', name: 'เงินเดือน', type: 'income', color: '#2f9e6b' },
    { id: 'cat-free', name: 'งานฟรีแลนซ์', type: 'income', color: '#3b82f6' },
    { id: 'cat-misc', name: 'รายได้อื่น', type: 'income', color: '#f59e0b' },
    { id: 'cat-food', name: 'อาหาร', type: 'expense', color: '#ef4444' }
  ],
  'budget:records': ['01', '02', '03', '04', '05', '06', '07', '08', '09'].map((m, i) => ({ id: 'r' + i, date: '2026-' + m + '-25', type: 'income', categoryId: 'cat-salary', amount: 45000, note: '' }))
    .concat([{ id: 'f1', date: '2026-04-10', type: 'income', categoryId: 'cat-free', amount: 30000, note: '' }, { id: 'o1', date: '2026-05-10', type: 'income', categoryId: 'cat-misc', amount: 5000, note: '' }]),
  'tanot:tax:catmap': { 'cat-free': 'service', 'cat-misc': 'other' },
  'tanot:insurance:taxsummary': { v: 1, years: { 2026: { raw: { life: 40000, health: 20000, parentsHealth: 15000, spouseLife: 0, annuity: 120000 } } } },
  'tanot:invest:thaifund': [{ ts: NOW - 86400000 * 40, cat: 'rmf', amt: 50000 }, { ts: NOW - 86400000 * 20, cat: 'ssf', amt: 30000 }, { ts: NOW - 86400000 * 10, cat: 'esg', amt: 100000 }],
  'tanot:receipts:taxsummary': { v: 1, years: { 2026: { eReceipt: 20000, eReceiptOtop: 0, politic: 1000, donationEdu: 2000, donation: 3000 } } },
  'tanot:tax:years': { 2569: { v: { socialSecurity: '9000', pvd: '30000', children: '1', withheld: '25000', homeLoan: '50000' }, sim: {} } },
  'tanot:tax:ui': { year: 2569, tab: 'calc', proj: false }
};

/* ───────── ไฟฟ้า ───────── */
function electrical(h) {
  const { dom, val, sel } = h;
  const tab = (k) => async (p) => { await dom(p, `[data-tab="${k}"]`); };
  return {
    page: 'electrical.html',
    user: /Σ|∞/,
    states: [
      ['vd', async () => {}],
      ['vd-bad-vd', async (p) => { await val(p, '#vdI', 250); await val(p, '#vdL', 200); await val(p, '#vdPf', 0.8); }],
      ['vd-1ph-al', async (p) => { await sel(p, '#vdPhase', '1'); await sel(p, '#vdMat', 'al'); await sel(p, '#vdIns', 'xlpe'); await val(p, '#vdI', 60); await val(p, '#vdL', 40); await val(p, '#vdPar', 2); }],
      ['sc', async (p) => { await tab('sc')(p); }],
      ['sc-icu-bad', async (p) => { await val(p, '#scIcuTr', 12); await val(p, '#scIcuEnd', 5); await val(p, '#scSkq', 250); }],
      ['sc-method', async (p) => { await sel(p, '#scMethod', '1'); await sel(p, '#scMat', 'al'); await val(p, '#scIcuTr', 40); await val(p, '#scIcuEnd', 25); }],
      ['pf', async (p) => { await tab('pf')(p); }],
      ['pf-lead', async (p) => { await val(p, '#pfP', 100); await val(p, '#pfPf1', 0.95); await val(p, '#pfPf2', 0.99); await val(p, '#pfStep', 100); await sel(p, '#pfPhase', '1'); }],
      ['pf-none', async (p) => { await val(p, '#pfPf1', 0.97); await val(p, '#pfPf2', 0.95); }],
      ['ir', async (p) => { await tab('ir')(p); }],
      ['ir-bad', async (p) => { await sel(p, '#irKind', 'old'); await val(p, '#irR30', 3); await val(p, '#irR60', 3.2); await val(p, '#irR600', 3.4); }],
      ['ir-form', async (p) => { await sel(p, '#irKind', 'form'); await sel(p, '#irCls', 'A'); await val(p, '#irKv', 6.6); await val(p, '#irR30', 900); await val(p, '#irR60', 1800); await val(p, '#irR600', 6000); await val(p, '#irTemp', 55); }],
      ['gnd', async (p) => { await tab('gnd')(p); }],
      ['gnd-bad', async (p) => { await dom(p, '#gUseRho'); await val(p, '#gTarget', 1); await val(p, '#gN', 2); }],
      ['gnd-invalid', async (p) => { await val(p, '#gIk', 0); await val(p, '#gL', 0); }],
      ['sa', async (p) => { await tab('sa')(p); }],
      ['sa-bad', async (p) => { await val(p, '#saBil', 75); await val(p, '#saVres', 70); await val(p, '#saD', 12); await val(p, '#saS', 800); await val(p, '#saBsl', 90); await val(p, '#saSipl', 85); }],
      ['sa-mid', async (p) => { await val(p, '#saBil', 110); await val(p, '#saD', 2); }]
    ]
  };
}

/* ───────── ภาษี ───────── */
function tax(h) {
  const { dom, val, settle } = h;
  return {
    page: 'tax.html',
    seed: TAX_SEED,
    user: /เงินเดือน|งานฟรีแลนซ์|รายได้อื่น|^อาหาร$/,
    states: [
      ['base', async () => {}],
      ['cats-open', async (p) => { await p.evaluate(() => { document.getElementById('txCatBox').open = true; }); }],
      ['proj-year', async (p) => { await dom(p, '[data-proj="1"]'); }],
      ['typed-over-cap', async (p) => { await val(p, '#tx_lifeIns', 200000); await val(p, '#tx_rmf', 900000); await val(p, '#tx_donation', 400000); await val(p, '#tx_salary', 3000000); }],
      ['year-prev', async (p) => { await dom(p, '[data-year="2568"]'); }],
      ['year-cur', async (p) => { await dom(p, '[data-year="2569"]'); }],
      ['tab-sim', async (p) => { await dom(p, '[data-tab="sim"]'); await settle(p, 300); }],
      ['sim-fill', async (p) => { await dom(p, '[data-fill]'); await settle(p, 200); }],
      ['sim-clear', async (p) => { await dom(p, '#txSimClear'); await dom(p, '[data-tab="calc"]'); }]
    ]
  };
}


/* ───────── บันทึกงานบำรุงรักษา ───────── */
const MNT_SEED = {
  'tanot:mnt:sites': [
    { id: 's1', name: 'RN05 บางซื่อ', abbr: 'RN05', lat: 13.8, lng: 100.54, updatedAt: 1 },
    { id: 's2', name: 'สถานีกลาง', abbr: 'S02', lat: null, lng: null, updatedAt: 1 }
  ],
  'tanot:mnt:assets': [
    { id: 'e1', code: 'RN05-ESC-01', name: 'บันไดเลื่อน 1', type: 'ESC', system: 'E&M', site: 's1', serial: 'SN-001', phase: { M3: 3 }, status: 'active', updatedAt: 1 },
    { id: 'e2', code: 'RN05-ESC-02', name: 'บันไดเลื่อน 2', type: 'ESC', system: 'E&M', site: 's1', phase: { M3: 2 }, status: 'active', updatedAt: 1 },
    { id: 'e3', code: 'RN05-ESC-03', name: 'บันไดเลื่อน 3', type: 'ESC', system: 'E&M', site: 's1', phase: { M3: 1 }, status: 'active', updatedAt: 1 },
    { id: 'e4', code: 'S02-LIFT-01', name: 'ลิฟต์โดยสาร', type: 'LIFT', system: 'E&M', site: 's2', phase: { M6: 1 }, status: 'active', updatedAt: 1, lat: 13.75, lng: 100.5 },
    { id: 'e5', code: 'S02-PSD-01', name: 'ประตูกั้นชานชาลา', type: 'PSD', system: 'Platform', site: 's2', phase: { Annually: 4 }, status: 'retired', updatedAt: 1 },
    { id: 'e6', code: 'S02-PSD-02', name: 'ประตูกั้นชานชาลา 2', type: 'PSD', system: 'Platform', site: 's2', phase: { Annually: 5 }, status: 'active', missing: true, updatedAt: 1 }
  ],
  'tanot:mnt:plans': [
    { id: 'ESC|M3', type: 'ESC', typeName: 'บันไดเลื่อน', freq: 'M3', hours: 2, shift: 'D', edited: true, updatedAt: 1,
      items: [{ id: 'i1', text: 'ตรวจราวจับ', kind: 'check' }, { id: 'i2', text: 'วัดกระแสมอเตอร์', kind: 'num', unit: 'A', min: null, max: 32 }, { id: 'i3', text: 'ตรวจหวีขั้นบันได', kind: 'check' }] },
    { id: 'ESC|Daily', type: 'ESC', typeName: 'บันไดเลื่อน', freq: 'Daily', hours: 0.2, shift: 'N', edited: false, updatedAt: 1, items: [{ id: 'i1', text: 'เดินเครื่องทดสอบ', kind: 'check' }] },
    { id: 'LIFT|M6', type: 'LIFT', typeName: 'ลิฟต์', freq: 'M6', hours: 3, shift: '', edited: false, updatedAt: 1, items: [{ id: 'i1', text: 'ตรวจสลิง', kind: 'check' }] },
    { id: 'PSD|Annually', type: 'PSD', typeName: 'ประตูกั้นชานชาลา', freq: 'Annually', hours: 8, shift: '', edited: false, updatedAt: 1, items: [{ id: 'i1', text: 'ตรวจมอเตอร์ประตู', kind: 'check' }] }
  ],
  'tanot:mnt:settings': { v: 1, startMonth: '2026-08', project: 'Demo project', line: 'LN1', inspector: 'Somchai', labelSize: '3x8' }
};
const MNT_USER = /บางซื่อ|สถานีกลาง|บันไดเลื่อน|ลิฟต์|ประตูกั้นชานชาลา|ตรวจราวจับ|วัดกระแสมอเตอร์|ตรวจหวีขั้นบันได|เดินเครื่องทดสอบ|ตรวจสลิง|ตรวจมอเตอร์ประตู|ช่าง|เสียงดัง|สายพาน|ปั๊ม|ที่ใหม่/;
function estCostXlsx(XLSX, bad) {
  const wb = XLSX.utils.book_new();
  const add = (n, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), n);
  if (bad === 'bad') { add('Sheet1', [['x']]); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); }
  add('EQUIPMENT', [['EQUIPMENT'], ['location', 'system', 'name_th', 'name_en', 'code', 'qty', 'workers', 'old_code'],
    ['RN05 บางซื่อ', 'E&M', 'บันไดเลื่อน', 'Escalator', 'ESC', 3, 2, ''], ['สถานีกลาง', 'E&M', 'ลิฟต์', 'Lift', 'LIFT', 1, 2, ''], ['สถานีกลาง', 'E&M', 'ประตู', 'PSD', 'PSD', 2, 2, ''], ['ที่ใหม่', 'E&M', 'ปั๊ม', 'Pump', '', 1, 1, '']]);
  add('PM_PLAN', [['PM_PLAN'], ['code', '', 'Daily', 'Weekly', 'M1', 'M3', 'M6', 'Annually'], ['ESC', null, 0.5, null, null, 2.5, null, null], ['LIFT', null, null, null, 1, null, 3, null], ['ZZZ', null, null, 1, null, null, null, 8]]);
  add('PM_ACTIVITY', [['PM_ACTIVITY'], ['code', '', '', 'freq', 'text', 'shift', 'hr'], ['ESC', null, null, 'M3', '1. ตรวจราวจับ\n2. วัดกระแสมอเตอร์', 'D', null], ['ESC', null, null, 'Q9', 'x', 'D', null]]);
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
function maintenance(h) {
  const { dom, settle, closeAll, val, sel } = h;
  let XLSX = null; try { XLSX = require('xlsx'); } catch (e) {}
  const T0 = new Date('2026-10-03T10:00:00+07:00').getTime();
  const tab = (k) => async (p) => { await closeAll(p); await dom(p, `[data-tab="${k}"]`); await settle(p, 500); };
  return {
    page: 'maintenance.html',
    seed: MNT_SEED,
    init: 'window.TANOT_FILES = { enabled: true };',
    user: MNT_USER,
    wait: async (p) => {
      await p.evaluate(async (T0) => {
        const M = window.__mnt;
        await M.idbPut('tanot-mnt-2026', 'insp', { id: 's1|M3|2026-08|dx', site: 's1', freq: 'M3', period: '2026-08', dev: 'dx', by: 'Somchai', at: T0 - 40 * 86400000,
          rows: { e3: { start: 1, at: T0 - 40 * 86400000, res: { i1: 'ok', i2: 30.5, i3: 'ng' }, note: 'worn comb', photos: [], wo: 'w1' } } });
        await M.idbPut('tanot-mnt', 'wo', { id: 'w1', no: 'CM-261001-AAA', kind: 'cm', asset: 'e1', site: 's1', reportedAt: T0 - 5 * 86400000, reportedBy: 'Somchai', symptom: 'เสียงดัง', priority: 'high', fromInsp: null, dev: 'dx', createdAt: T0 });
        await M.idbPut('tanot-mnt', 'wo', { id: 'w2', no: 'CM-260920-BBB', kind: 'cm', asset: 'e4', site: 's2', reportedAt: T0 - 14 * 86400000, reportedBy: 'Somchai', symptom: 'door stuck', priority: 'normal', fromInsp: null, dev: 'dx', createdAt: T0 });
        await M.idbPut('tanot-mnt', 'wo', { id: 'w3', no: 'PM-260901-CCC', kind: 'pm', asset: 'e2', site: 's1', reportedAt: T0 - 30 * 86400000, reportedBy: '', symptom: 'routine', priority: 'low', fromInsp: null, dev: 'dx', createdAt: T0 });
        await M.idbPut('tanot-mnt', 'woev', { id: 'w1|a|dx', wo: 'w1', at: T0 - 4 * 86400000, dev: 'dx', set: { status: 'progress', assignee: 'ช่างสมชาย', parts: [{ name: 'สายพาน', qty: 2, unitCost: 150 }], laborCost: 500 }, note: 'started', photos: [] });
        await M.idbPut('tanot-mnt', 'woev', { id: 'w3|a|dx', wo: 'w3', at: T0 - 29 * 86400000, dev: 'dx', set: { status: 'done', endAt: T0 - 29 * 86400000 }, note: 'all good', photos: [] });
      }, T0);
      await p.reload(); await p.waitForSelector('nav.ome-nav'); await settle(p, 700);
    },
    states: [
      ['base', async (p) => { await settle(p, 500); }],
      ['filter-empty', async (p) => { await p.fill('#aSearch', 'zzzz'); await settle(p, 300); }],
      ['filter-reset', async (p) => { await p.fill('#aSearch', ''); await settle(p, 300); }],
      ['sites-plans-open', async (p) => { await p.evaluate(() => { document.getElementById('dSites').open = true; document.getElementById('dPlans').open = true; }); await settle(p, 300); }],
      ['dlg-asset-new', async (p) => { await dom(p, '#aAdd'); await settle(p, 250); }],
      ['dlg-asset-error', async (p) => { await dom(p, '#formAsset button[type=submit]'); await settle(p, 250); }],
      ['dlg-asset-edit', async (p) => { await closeAll(p); await dom(p, '#aList [data-id="e1"] [data-act="edit"]'); await settle(p, 250); }],
      ['dlg-asset-del-blocked', async (p) => { await p.evaluate(() => document.getElementById('eType').value = 'ESC'); await dom(p, '#eDel'); await settle(p, 400); }],
      ['dlg-site', async (p) => { await closeAll(p); await dom(p, '#sList [data-sid="s1"]'); await dom(p, '#sDel'); await settle(p, 300); }],
      ['dlg-site-new-error', async (p) => { await closeAll(p); await dom(p, '#sAdd'); await dom(p, '#formSite button[type=submit]'); await settle(p, 250); }],
      ['dlg-plan-edit', async (p) => { await closeAll(p); await dom(p, '#pList [data-pid="ESC|M3"]'); await settle(p, 250); }],
      ['dlg-plan-confirm-del', async (p) => { await dom(p, '#pDel'); await settle(p, 350); }],
      ['dlg-plan-new-error', async (p) => { await closeAll(p); await dom(p, '#pAdd'); await dom(p, '#formPlan button[type=submit]'); await settle(p, 250); }],
      ['dlg-scan', async (p) => { await closeAll(p); await dom(p, '#aScan'); await settle(p, 500); }],
      ['dlg-scan-miss', async (p) => { await val(p, '#scanCode', 'nope'); await dom(p, '#scanGo'); await settle(p, 250); }],
      ['asset-view', async (p) => { await closeAll(p); await p.evaluate(() => { location.hash = '#asset=e1'; }); await p.waitForSelector('#assetView [data-act="insp"]', { timeout: 8000 }).catch(() => {}); await settle(p, 500); }],
      ['dlg-insp', async (p) => { await dom(p, '[data-act="insp"][data-freq="M3"]'); await settle(p, 600); }],
      ['dlg-insp-ng', async (p) => { await val(p, '#inspBy', 'Somchai'); await dom(p, '[data-res="ng"][data-item="i1"]'); await val(p, '[data-num="i2"]', 40); await dom(p, '[data-res="ok"][data-item="i3"]'); await settle(p, 250); }],
      ['dlg-insp-save-wo', async (p) => { await dom(p, '#inspSave'); await settle(p, 800); }],
      ['dlg-wo-skip', async (p) => { await dom(p, '#wnSkip'); await settle(p, 500); }],
      ['dlg-wo-new', async (p) => { await closeAll(p); await dom(p, '[data-act="wo-new"]'); await settle(p, 250); }],
      ['dlg-wo-new-error', async (p) => { await dom(p, '#formWoNew button[type=submit]'); await settle(p, 250); }],
      ['asset-missing', async (p) => { await closeAll(p); await p.evaluate(() => { location.hash = '#asset=zzz'; }); await settle(p, 400); }],
      ['tab-calendar', async (p) => { await p.evaluate(() => { location.hash = ''; }); await tab('calendar')(p); }],
      ['calendar-comp', async (p) => { await p.evaluate(() => { document.getElementById('cComp').open = true; }); await settle(p, 300); }],
      ['dlg-batch', async (p) => { await sel(p, '#cSite', 's1'); await sel(p, '#cFreq', 'M3'); await dom(p, '#cBatch'); await settle(p, 700); }],
      ['dlg-batch-next', async (p) => { await dom(p, '#inspNext'); await settle(p, 500); }],
      ['tab-wo', async (p) => { await tab('wo')(p); }],
      ['wo-filter-all', async (p) => { await sel(p, '#wfStatus', ''); await settle(p, 300); }],
      ['wo-filter-empty', async (p) => { await sel(p, '#wfStatus', 'cancel'); await settle(p, 300); }],
      ['dlg-wo', async (p) => { await sel(p, '#wfStatus', ''); await settle(p, 300); await dom(p, '#wList [data-wid="w1"]'); await settle(p, 600); }],
      ['dlg-wo-edit', async (p) => { await dom(p, '#woPartAdd'); await sel(p, '#woStatus', 'done'); await val(p, '#woLabor', 300); await settle(p, 250); }],
      ['dlg-wo-nochange', async (p) => { await closeAll(p); await dom(p, '#wList [data-wid="w2"]'); await settle(p, 500); await dom(p, '#formWo button[type=submit]'); await settle(p, 250); }],
      ['tab-io', async (p) => { await tab('io')(p); }],
      ['io-bad-file', async (p) => { await p.setInputFiles('#ioFile', { name: 'bad.xlsx', mimeType: 'application/octet-stream', buffer: estCostXlsx(XLSX, 'bad') }); await settle(p, 900); }],
      ['io-preview', async (p) => { await p.setInputFiles('#ioFile', { name: 'input.xlsx', mimeType: 'application/octet-stream', buffer: estCostXlsx(XLSX) }); await p.waitForSelector('[data-pv="counts"]', { timeout: 10000 }).catch(() => {}); await settle(p, 500); }],
      ['io-overwrite', async (p) => { await dom(p, '[data-ow]'); await settle(p, 300); }],
      ['io-export-error', async (p) => { await val(p, '#exFrom', '2026-12-01'); await val(p, '#exTo', '2026-01-01'); await dom(p, '#exGo'); await settle(p, 300); }]
    ],
    beforeSwitch: async (p) => { await p.evaluate(() => { location.hash = ''; }); },
  };
}

const ALLOW = [];

function targets(h) {
  return [tax(h), electrical(h), maintenance(h)];
}
module.exports = { targets, ALLOW, NOW };
