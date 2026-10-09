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

/* ───────── ประเมินราคา PM/CM (run.html?tool=est-cost) ───────── */
// Pyodide / Google Identity / Drive API ปลอมทั้งหมด — ไม่โหลด Python จริง ไม่ออกเน็ต (อ่านไฟล์ tool/est-cost จากเซิร์ฟเวอร์ในเครื่อง)
const RUN_INIT = `
window.__pyOut = null; window.__pyFail = false;
window.loadPyodide = async () => ({
  setStdout(o) { window.__pyOut = o.batched; }, setStderr() {},
  loadPackage: async () => {}, pyimport: () => ({ install: async () => {} }),
  FS: { writeFile() {}, readFile: () => new Uint8Array(2048) },
  runPythonAsync: async (code) => {
    if (code.indexOf('tool_run.check(') >= 0) { ['⚠️ row 12: hours missing', '❌ code ZZZ unknown', 'checked'].forEach((l) => window.__pyOut && window.__pyOut(l)); return; }
    if (code.indexOf('tool_run.run(') >= 0) {
      if (window.__pyFail) throw new Error('Traceback: boom');
      ['reading input', '✅ estimate written', '⚠️ 2 assets skipped'].forEach((l) => window.__pyOut && window.__pyOut(l));
      return { toJs: () => ['/home/pyodide/out/estimate_v5.xlsx', '/home/pyodide/out/route_map.svg', '/home/pyodide/out/summary.pdf'], destroy() {} };
    }
    if (code.indexOf('tool_run.compare(') >= 0) return { toJs: () => [
      { code: 'ESC-01', name: 'Escalator', current_hours: 120, history_avg_hours: 80, deviation_pct: 50, history_n: 3, flag: true },
      { code: 'LIFT-01', name: 'Lift', current_hours: 60, history_avg_hours: 58, deviation_pct: 3.4, history_n: 3, flag: false }], destroy() {} };
  }
});
window.google = { accounts: { oauth2: { initTokenClient: (cfg) => ({ requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: 'tok' }), 10) }) } } };
`;
function runPage(h) {
  const { dom, settle, closeAll } = h;
  const XLSX = (() => { try { return require('xlsx'); } catch (e) { return null; } })();
  const xl = () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a', 'b'], [1, 2]]), 'EQUIPMENT'); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); };
  return {
    page: 'run.html?tool=est-cost',
    init: RUN_INIT,
    route: async (page) => {
      await page.route('https://www.googleapis.com/**', (route) => {
        const u = decodeURIComponent(route.request().url());
        if (route.request().method() === 'POST') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'u1', name: 'x', webViewLink: '' }) });
        if (/alt=media/.test(u)) return route.fulfill({ body: 'x' });
        if (/mimeType='application\/vnd.google-apps.folder'/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ files: [{ id: 'F1', name: 'AMR_EstCost' }] }) });
        if (/key='kind' and value='estcost_input'/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ files: [{ id: 'h1', name: 'old1.xlsx', modifiedTime: '2026-09-01T03:00:00Z' }, { id: 'h2', name: 'old2.xlsx', modifiedTime: '2026-08-01T03:00:00Z' }] }) });
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ files: [
          { id: 'h1', name: 'input_2026-09.xlsx', modifiedTime: '2026-09-01T03:00:00Z', properties: { kind: 'estcost_input' } },
          { id: 'h3', name: 'estimate_v5.xlsx', modifiedTime: '2026-09-01T03:10:00Z', properties: { kind: 'estcost_output' } },
          { id: 'h4', name: 'misc.bin', modifiedTime: '2026-08-20T03:10:00Z', properties: {} }] }) });
      });
    },
    wait: async (p) => { await p.waitForFunction(() => /Ready|พร้อมใช้งาน/.test(document.getElementById('status').textContent), null, { timeout: 15000 }).catch(() => {}); await settle(p, 400); },
    states: [
      ['base', async () => {}],
      ['wrong-ext', async (p) => { await p.setInputFiles('#file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }); await settle(p, 300); }],
      ['file-chosen', async (p) => { await p.setInputFiles('#file', { name: 'input_est_cost_2026.xlsx', mimeType: 'application/octet-stream', buffer: xl() }); await settle(p, 400); }],
      ['check', async (p) => { await dom(p, '#check'); await settle(p, 500); }],
      ['run-done', async (p) => { await dom(p, '#run'); await p.waitForSelector('#result.show .list-row', { timeout: 8000 }).catch(() => {}); await settle(p, 800); }],
      ['drive-ready', async (p) => { await p.evaluate(() => window.initDrive && window.initDrive()); await settle(p, 300); }],
      ['drive-upload', async (p) => { await dom(p, '#driveBtn'); await settle(p, 900); }],
      ['compare', async (p) => { await dom(p, '#cmpBtn'); await settle(p, 1200); }],
      ['history', async (p) => { await dom(p, '#histBtn'); await settle(p, 900); }],
      ['history-use', async (p) => { await dom(p, '[data-act="use"]'); await settle(p, 700); }],
      ['run-fail', async (p) => { await p.evaluate(() => { window.__pyFail = true; }); await dom(p, '#run'); await settle(p, 900); }]
    ]
  };
}

/* ───────── CAD 2D + 3D (cad.html) ───────── */
const CAD_SEED = {
  'tanot:cad:autosave': {
    entities: [
      { id: 'r1', type: 'rect', layer: '0', p1: { x: 100, y: 100 }, p2: { x: 500, y: 400 } },
      { id: 'c1', type: 'circle', layer: 'L1', center: { x: 800, y: 300 }, radius: 120 },
      { id: 'l1', type: 'line', layer: 'L1', p1: { x: 100, y: 600 }, p2: { x: 700, y: 600 } },
      { id: 'pl1', type: 'polyline', layer: 'L2', points: [{ x: 900, y: 500 }, { x: 1100, y: 500 }, { x: 1100, y: 700 }, { x: 900, y: 650 }], closed: true },
      { id: 'a1', type: 'arc', layer: '0', center: { x: 1000, y: 150 }, radius: 100, startAngle: 0, endAngle: Math.PI },
      { id: 't1', type: 'text', layer: '0', p: { x: 100, y: 700 }, text: 'Title A', height: 40 },
      { id: 'd1', type: 'dim', layer: 'L2', p1: { x: 100, y: 100 }, p2: { x: 500, y: 100 }, offset: -60, textHeight: 3, arrowSize: 2.5 },
      { id: 'rd1', type: 'raddim', layer: 'L2', center: { x: 800, y: 300 }, radius: 120, angle: 0.8, textHeight: 3, arrowSize: 2.5 },
      { id: 'h1', type: 'hatch', layer: '0', points: [{ x: 150, y: 150 }, { x: 450, y: 150 }, { x: 450, y: 350 }, { x: 150, y: 350 }], spacing: 20, angle: 0.785 },
      { id: 'ld1', type: 'leader', layer: '0', p1: { x: 1000, y: 250 }, p2: { x: 1100, y: 350 }, text: 'Note', height: 30 }
    ],
    layers: {
      '0': { name: 'เลเยอร์ 0', color: null, visible: true, locked: false },
      L1: { name: 'Walls', color: '#c0392b', visible: true, locked: false },
      F1: { name: 'Annotation', isFolder: true, collapsed: false, visible: true, locked: false },
      L2: { name: 'Dims', color: '#2e86c1', visible: true, locked: true, parentId: 'F1' }
    },
    layerOrder: ['0', 'L1', 'F1', 'L2'], activeLayer: '0', layerSeq: 3,
    view: { cx: 600, cy: 400, scale: 0.5 }, dimStyle: { textHeight: 3, arrowSize: 2.5, centerMarkSize: 4 },
    constraints: [{ id: 'k1', type: 'horizontal', entities: ['l1'], value: null }, { id: 'k2', type: 'equal', entities: ['c1', 'c1'], value: null }]
  },
  // ขั้นตอน 3 มิติ (OpenCascade โหลดจาก CDN ไม่ได้ตอนออฟไลน์ → ป้ายผิดพลาดบนวิว; รายการขั้นตอน/แผงคุณสมบัติยังแสดงตามข้อมูล)
  'tanot:cad3d:steps': [
    { op: 'add', kind: 'box', dims: { x: 100, y: 80, z: 40 }, pos: { x: 0, y: 0, z: 0 }, suppressed: false },
    { op: 'cut', kind: 'cylinder', dims: { r: 20, h: 60 }, pos: { x: 10, y: 10, z: 0 }, suppressed: false },
    { op: 'union', kind: 'sketch', dims: { profile: { label: 'สี่เหลี่ยม 400×300 มม.', points: [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 400 }, { x: 100, y: 400 }], entityId: 'r1' }, sourceEntityId: 'r1', plane: 'top', mode: 'extrude', height: 20, axis: 'x', angle: 360 }, pos: { x: 0, y: 0, z: 40 }, suppressed: true }
  ]
};
function cad(h) {
  const { dom, settle, closeAll, val, sel } = h;
  const wclick = async (p, wx, wy, shift) => {
    const pt = await p.evaluate(([wx, wy]) => { const v = document.getElementById('cadViewport'); v.scrollIntoView({ block: 'center' }); const r = v.getBoundingClientRect(); return { x: r.left + r.width / 2 + (wx - 600) * 0.5, y: r.top + r.height / 2 - (wy - 400) * 0.5 }; }, [wx, wy]);
    if (shift) await p.keyboard.down('Shift');
    await p.mouse.click(pt.x, pt.y);
    if (shift) await p.keyboard.up('Shift');
    await settle(p, 200);
  };
  const esc = async (p) => { await p.keyboard.press('Escape'); await settle(p, 100); };
  // จอ ≤ 980px แผงขวาเป็นลิ้นชัก (ปุ่ม #panelsBtn) — จอกว้างไม่มีปุ่มนี้ (ไม่ต้องทำอะไร)
  const drawer = async (p, open) => {
    const vis = await p.evaluate(() => { const b = document.getElementById('panelsBtn'); return !!b && getComputedStyle(b).display !== 'none'; });
    if (!vis) return;
    await p.evaluate((open) => { const d = document.getElementById('cadDrawer'); if (d.classList.contains('open') !== open) document.getElementById(open ? 'panelsBtn' : 'drawerCloseBtn').click(); }, open);
    await settle(p, 450);
  };
  const reset = async (p) => { await p.evaluate(() => { const e = document.getElementById('panel2d'); if (e) e.scrollTop = 0; window.scrollTo(0, 0); }); };
  return {
    page: 'cad.html',
    seed: CAD_SEED,
    init: 'window.TANOT_FILES = { enabled: true };',
    user: /Title A|Note|Walls|Annotation|Dims/,
    overlay: '#cadDrawer.open, .cad-dropdown-menu:not([hidden])',
    ignoreErrors: /opencascade|Failed to fetch dynamically imported module|cad3d\]/i,
    states: [
      ['base', async (p) => { await settle(p, 500); }],
      ['menu-file', async (p) => { await dom(p, '#fileMenuBtn'); await settle(p, 200); }],
      ['menu-edit', async (p) => { await dom(p, '#editMenuBtn'); await settle(p, 200); }],
      ['menu-view', async (p) => { await dom(p, '#viewMenuBtn'); await settle(p, 200); }],
      ['menus-closed', async (p) => { await dom(p, '#viewMenuBtn'); await settle(p, 200); }],
      ['select-rect', async (p) => { await wclick(p, 300, 100); await reset(p); }],
      ['drawer-props', async (p) => { await drawer(p, true); }],
      ['drawer-layers', async (p) => { await dom(p, '#layerAddBtn'); await dom(p, '#layerAddFolderBtn'); await settle(p, 300); }],
      ['drawer-constraint', async (p) => { await dom(p, '#toolConstraintBtn'); await sel(p, '#constraintTypeSel', 'distance'); await settle(p, 300); }],
      ['drawer-plot', async (p) => { await sel(p, '#plotPaperSel', 'A3'); await sel(p, '#plotOrientSel', 'landscape'); await sel(p, '#plotScaleSel', '50'); await settle(p, 200); }],
      ['drawer-closed', async (p) => { await drawer(p, false); await dom(p, '#toolSelectBtn'); await settle(p, 200); }],
      ['select-circle', async (p) => { await wclick(p, 920, 300); await reset(p); }],
      ['select-arc', async (p) => { await wclick(p, 929, 221); await reset(p); await drawer(p, true); }],
      ['select-poly', async (p) => { await drawer(p, false); await wclick(p, 1000, 500); await reset(p); await drawer(p, true); }],
      ['select-dim', async (p) => { await drawer(p, false); await wclick(p, 300, 40); await reset(p); await drawer(p, true); }],
      ['select-leader', async (p) => { await drawer(p, false); await wclick(p, 1050, 300); await reset(p); await drawer(p, true); }],
      ['layer-delete-confirm', async (p) => { await dom(p, '#layersList [data-lid="L1"] [data-act="delete"]'); await settle(p, 400); }],
      ['layer-delete-closed', async (p) => { await closeAll(p); await drawer(p, false); await settle(p, 200); }],
      ['alert-pdf-lib', async (p) => { await dom(p, '#plotGenerateBtn'); await settle(p, 500); }],
      ['alert-closed', async (p) => { await closeAll(p); await settle(p, 200); }],
      ['select-text', async (p) => { await wclick(p, 130, 715); await reset(p); }],
      ['select-multi', async (p) => { await wclick(p, 400, 600, true); await reset(p); }],
      ['tool-array-rect', async (p) => { await dom(p, '#toolArrayRectBtn'); await settle(p, 300); }],
      ['tool-array-polar', async (p) => { await dom(p, '#toolArrayPolarBtn'); await settle(p, 300); }],
      ['tool-line-pending', async (p) => { await dom(p, '#toolLineBtn'); await wclick(p, 300, 500); await reset(p); }],
      ['tool-polyline', async (p) => { await esc(p); await dom(p, '#toolPolylineBtn'); await wclick(p, 200, 520); await wclick(p, 260, 560); await reset(p); }],
      ['tool-text', async (p) => { await esc(p); await dom(p, '#toolTextBtn'); await wclick(p, 700, 700); await reset(p); }],
      ['tool-hatch', async (p) => { await esc(p); await dom(p, '#toolHatchBtn'); await wclick(p, 300, 250); await reset(p); }],
      ['tool-block', async (p) => { await esc(p); await dom(p, '#toolBlockBtn'); await wclick(p, 600, 500); await reset(p); }],
      ['tool-fillet', async (p) => { await esc(p); await dom(p, '#toolFilletBtn'); await settle(p, 300); }],
      ['tool-dim', async (p) => { await esc(p); await dom(p, '#toolDimBtn'); await wclick(p, 100, 100); await reset(p); }],
      ['tool-leader-list', async (p) => { await esc(p); await dom(p, '#toolLeaderBtn'); await settle(p, 300); }],
      ['drawer-options', async (p) => { await drawer(p, true); }],
      ['drawer-closed-2', async (p) => { await drawer(p, false); await esc(p); }],
      ['confirm-clear', async (p) => { await dom(p, '#fileMenuBtn'); await dom(p, '#clearAllBtn'); await settle(p, 400); }],
      ['confirm-closed', async (p) => { await closeAll(p); await settle(p, 200); }],
      ['tab-3d', async (p) => { await dom(p, '#tabBtn3d'); await settle(p, 800); }],
      ['3d-steps', async (p) => { await settle(p, 800); }],
      ['3d-step-edit', async (p) => { await dom(p, '#stepsList [data-act="edit"][data-idx="1"]'); await settle(p, 400); }],
      ['3d-step-edit-cancel', async (p) => { await dom(p, '#cancelEditBtn'); await settle(p, 300); }],
      ['3d-step-toggle', async (p) => { await dom(p, '#stepsList [data-act="toggle"][data-idx="2"]'); await settle(p, 300); }],
      ['3d-step-delete-confirm', async (p) => { await dom(p, '#stepsList [data-act="delete"][data-idx="1"]'); await settle(p, 400); }],
      ['3d-confirm-closed', async (p) => { await closeAll(p); await settle(p, 200); }],
      ['3d-cylinder', async (p) => { await sel(p, '#shapeKindSel', 'cylinder'); await settle(p, 250); }],
      ['3d-sphere', async (p) => { await sel(p, '#shapeKindSel', 'sphere'); await settle(p, 250); }],
      ['3d-sketch', async (p) => { await sel(p, '#shapeKindSel', 'sketch'); await settle(p, 400); }],
      ['3d-sketch-advanced', async (p) => { await p.evaluate(() => { document.getElementById('sketchAdvanced').open = true; }); await sel(p, '#sketchModeSel', 'revolve'); await settle(p, 300); }],
      ['3d-live-sketch', async (p) => { await dom(p, '#startLiveSketchBtn'); await settle(p, 500); }],
      ['3d-live-sketch-circle', async (p) => { await dom(p, '#sketchToolCircleBtn'); await settle(p, 250); }],
      ['3d-live-sketch-poly', async (p) => { await dom(p, '#sketchToolPolylineBtn'); await settle(p, 250); }],
      ['3d-live-sketch-cancel', async (p) => { await dom(p, '#sketchCancelBtn'); await settle(p, 300); }],
      ['3d-materials', async (p) => { await dom(p, '[data-material="steel"]'); await settle(p, 300); }]
    ]
  };
}

/* ───────── รายงาน / Dashboard (report-dashboard.html) ───────── */
// ไฟล์ xlsx สร้างตามหัวคอลัมน์ของแม่แบบแต่ละโมดูล (TEMPLATES ใน report-dashboard.html) ใส่ผ่าน #fileInput เหมือนผู้ใช้จริง
const RD_D = (n) => new Date(Date.UTC(2026, 9, 3) - n * 86400000);
function rdSheet(key) {
  const pick = (a, i) => a[i % a.length];
  const rows = [];
  const N = 14;
  const hdr = {
    maintenance: ['Work Order', 'Equipment No', 'Equipment Type', 'Downtime', 'Plan Finish', 'Actual Start', 'Actual End', 'Material Cost', 'Labor Cost', 'Status', 'Failure Mode', 'Work Order Type', 'Line'],
    project: ['Project', 'Task', 'Customer', 'Owner', 'Start Date', 'End Date', 'Actual', 'Plan', 'SPI', 'Status', 'Cost', 'Duration'],
    legal: ['Matter ID', 'Client', 'Practice Area', 'Attorney', 'Billable Hours', 'Amount Billed', 'Amount Collected', 'Status', 'Open Date', 'Close Date', 'Court Date', 'Role'],
    risk: ['Risk Name', 'Risk Category', 'Severity', 'Likelihood', 'Risk Level', 'Mitigation', 'Residual', 'Reference', 'Status', 'Risk Owner', 'Identified Date', 'Closed Date'],
    finance: ['Date', 'Income', 'Expense', 'Amount', 'Transaction Type', 'Category', 'Account', 'Description', 'Budget'],
    reading: ['Book Title', 'Author', 'Start Date', 'Finish Date', 'Pages', 'Genre', 'Rating', 'Status'],
    safety: ['Incident Date', 'Incident Type', 'Severity', 'Department', 'Status', 'Due Date', 'Project', 'Finding'],
    hr: ['Employee ID', 'Employee Name', 'Department', 'Position', 'Join Date', 'Exit Date', 'Employment Status', 'Employment Type', 'Training Status'],
    itops: ['Ticket ID', 'System', 'Priority', 'Status', 'Opened Date', 'Closed Date', 'Assignee', 'Subject'],
    kpidashboard: ['KPI Name', 'Weight', 'Target', 'Actual', 'Min', 'Max', 'Frequency', 'Direction'],
    organizational: ['Employee ID', 'Full Name', 'Nickname', 'Position', 'Job Level', 'Team', 'System', 'Work Site', 'Start Date', 'Manager ID', 'Manager Name', 'Date of Birth', 'Email', 'Phone', 'Gender']
  }[key];
  for (let i = 0; i < N; i++) {
    const st = pick(['Open', 'In Progress', 'Closed', 'Overdue'], i);
    const r = {
      maintenance: () => ['WO-' + (100 + i), 'EQ-' + (i % 5), pick(['Escalator', 'Lift', 'PSD', 'Pump'], i), (i % 4) * 2.5, RD_D(30 - i), RD_D(32 - i), RD_D(31 - i), 1200 + i * 150, 800 + i * 90, pick(['Closed', 'Open', 'In Progress'], i), pick(['Wear', 'Electrical', 'Jam'], i), pick(['PM', 'CM'], i), pick(['Line A', 'Line B'], i)],
      project: () => ['Project ' + (i % 3), 'Task ' + i, pick(['ACME', 'Globex'], i), pick(['Somchai', 'Somsri'], i), RD_D(60 - i * 2), RD_D(20 - i), 40 + i * 4, 50 + i * 3, 0.7 + (i % 5) * 0.12, pick(['On track', 'Delayed', 'Done'], i), 10000 + i * 900, 10 + i],
      legal: () => ['M-' + i, pick(['ACME', 'Globex', 'Initech'], i), pick(['Corporate', 'Litigation'], i), pick(['Anan', 'Boon'], i), 4 + i, 20000 + i * 1500, 15000 + i * 1000, pick(['Open', 'Closed', 'Pending'], i), RD_D(90 - i * 3), i % 3 ? null : RD_D(5), RD_D(-i), pick(['Lead', 'Associate'], i)],
      risk: () => ['Risk ' + i, pick(['Operational', 'Financial', 'Safety'], i), (i % 5) + 1, ((i * 2) % 5) + 1, ((i % 5) + 1) * (((i * 2) % 5) + 1), 'Mitigation ' + i, (i % 4) + 1, 'REF-' + i, pick(['Open', 'Mitigated', 'Closed'], i), pick(['Nok', 'Mali'], i), RD_D(80 - i * 3), i % 3 ? null : RD_D(4)],
      finance: () => [RD_D(i * 4), i % 2 ? 0 : 30000 + i * 500, i % 2 ? 2000 + i * 300 : 0, 2000 + i * 300, pick(['Income', 'Expense'], i), pick(['Salary', 'Food', 'Rent', 'Travel'], i), pick(['Bank A', 'Cash'], i), 'Item ' + i, 5000],
      reading: () => ['Book ' + i, pick(['Author A', 'Author B'], i), RD_D(70 - i * 4), i % 4 ? RD_D(55 - i * 4) : null, 180 + i * 12, pick(['Novel', 'Science', 'History'], i), (i % 5) + 1, pick(['Reading', 'Finished'], i)],
      safety: () => [RD_D(i * 5), pick(['Near miss', 'First aid', 'Property damage'], i), pick(['Low', 'Medium', 'High'], i), pick(['Ops', 'Maintenance'], i), pick(['Open', 'Closed'], i), RD_D(-3 - i), 'Project ' + (i % 3), 'Finding ' + i],
      hr: () => ['E' + (100 + i), 'Employee ' + i, pick(['Ops', 'Finance', 'IT'], i), pick(['Engineer', 'Manager', 'Clerk'], i), RD_D(900 - i * 40), i % 7 ? null : RD_D(20), i % 7 ? 'Active' : 'Resigned', pick(['Full-time', 'Contract'], i), pick(['Done', 'Pending'], i)],
      itops: () => ['T-' + (1000 + i), pick(['ERP', 'Mail', 'VPN'], i), pick(['P1', 'P2', 'P3'], i), pick(['Open', 'Closed', 'Pending'], i), RD_D(20 - i), i % 2 ? RD_D(10 - i / 2) : null, pick(['Ake', 'Bee'], i), 'Subject ' + i],
      kpidashboard: () => ['KPI ' + i, 10 + (i % 3) * 5, 100, 60 + i * 3, 0, 120, pick(['Monthly', 'Quarterly'], i), pick(['Higher', 'Lower'], i)],
      organizational: () => ['E' + (200 + i), 'Person ' + i, 'Nick' + i, pick(['Engineer', 'Manager', 'Director'], i), pick(['L1', 'L2', 'L3'], i), pick(['Team A', 'Team B'], i), pick(['E&M', 'Civil'], i), pick(['HQ', 'Site 1'], i), RD_D(900 - i * 30), i ? 'E200' : '', i ? 'Person 0' : '', RD_D(11000 + i * 90), 'p' + i + '@example.com', '08' + (10000000 + i), pick(['F', 'M'], i)]
    }[key]();
    rows.push(r);
  }
  return [hdr].concat(rows);
}
// คดีมีขั้นตอน 37 ข้อ (คอลัมน์ "N. …" = วันที่ทำเสร็จ, "Plan N" = จำนวนวันมาตรฐาน) → ปลุกตัวติดตามความคืบหน้าคดี + กล่องดูรายละเอียดขั้นตอน
function rdLitigation() {
  const stages = ['Intake', 'Facts', 'Notice', 'Plaint', 'Answer', 'Counterclaim', 'Filing', 'Pauper', 'Default', 'Mediation', 'Interim', 'Pre-trial'];
  const hdr = ['Matter ID', 'Client', 'Practice Area', 'Attorney', 'Billable Hours', 'Amount Billed', 'Amount Collected', 'Status', 'Open Date', 'Court Date', 'Role']
    .concat(stages.map((x, i) => (i + 1) + '. ' + x)).concat(stages.map((x, i) => 'Plan ' + (i + 1)));
  const rows = [];
  for (let i = 0; i < 6; i++) {
    const done = 3 + i * 2;
    rows.push(['L-' + i, ['ACME', 'Globex'][i % 2], ['Corporate', 'Litigation'][i % 2], ['Anan', 'Boon'][i % 2], 10 + i, 30000 + i * 2000, 20000 + i * 1500, ['Open', 'Closed'][i % 2], RD_D(200 - i * 10), RD_D(-5 - i), ['Plaintiff', 'Defendant', ''][i % 3]]
      .concat(stages.map((x, k) => (k < done ? RD_D(190 - i * 10 - k * 8) : null))).concat(stages.map(() => 14)));
  }
  return [hdr].concat(rows);
}
function rdXlsx(XLSX, key) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(key === 'legal-lit' ? rdLitigation() : rdSheet(key), { cellDates: true }), 'Data');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true }));
}
function reportDashboard(h) {
  const { dom, settle, closeAll } = h;
  let XLSX = null; try { XLSX = require('xlsx'); } catch (e) {}
  const upload = (key) => async (p) => {
    await closeAll(p);
    await p.setInputFiles('#fileInput', { name: key + '.xlsx', mimeType: 'application/octet-stream', buffer: rdXlsx(XLSX, key) });
    await settle(p, 900);
    if (await p.evaluate(() => { const b = document.getElementById('confirmHeaderBtn'); return !!(b && b.offsetParent); })) { await dom(p, '#confirmHeaderBtn'); await settle(p, 900); }
    await p.waitForFunction(() => { const v = document.getElementById('dashboardView'); return v && v.offsetParent; }, null, { timeout: 12000 }).catch(() => {});
    await settle(p, 900);
    // ตรวจจับแม่แบบอัตโนมัติไม่เลือกโมดูลโดเมนให้ทุกชุดข้อมูล — ล็อกแม่แบบเป็นของโมดูลที่กำลังทดสอบ (ผู้ใช้ทำได้เองจากตัวเลือก "แม่แบบ")
    await p.evaluate((k) => { const el = document.getElementById('domainOverrideSel'); if (el) { el.value = k; el.dispatchEvent(new Event('change', { bubbles: true })); } }, key === 'legal-lit' ? 'legal' : key);
    await settle(p, 1000);
  };
  const states = [];
  const section = (n) => async (p) => { await dom(p, `[data-section-page="${n}"]`); await settle(p, 500); };
  const view = (n) => async (p) => { await closeAll(p); await dom(p, `#viewTabs [data-view="${n}"]`); await settle(p, 700); };
  const menu = (trig) => async (p) => {
    await closeAll(p); await view('dashboard')(p);
    await dom(p, '#utilityHamburgerBtn'); await settle(p, 300);
    await dom(p, `.utility-menu-item[data-trigger="${trig}"]`); await settle(p, 600);
  };
  ['maintenance', 'project', 'legal', 'legal-lit', 'risk', 'finance', 'reading', 'safety', 'hr', 'itops', 'kpidashboard', 'organizational'].forEach((k) => {
    states.push(['dash-' + k, upload(k)]);
    ['projects', 'analytics', 'details'].forEach((n) => states.push(['dash-' + k + '-' + n, section(n)]));
    if (k === 'legal-lit') {
      states.push(['legal-lit-detail', async (p) => { await closeAll(p); await dom(p, '[data-section-page="projects"]'); await settle(p, 600); await dom(p, '.lg-detail-btn'); await settle(p, 700); }]);
      states.push(['legal-lit-detail-close', async (p) => { await dom(p, '.lg-modal-close'); await settle(p, 400); }]);
    }
    if (k === 'finance') {
      states.push(['mode-analysis', async (p) => { await dom(p, '[data-dbmode="analysis"]'); await settle(p, 600); }]);
      states.push(['mode-table', async (p) => { await dom(p, '[data-dbmode="table"]'); await settle(p, 600); }]);
      states.push(['mode-exec', async (p) => { await dom(p, '[data-dbmode="executive"]'); await settle(p, 600); }]);
      states.push(['utility-menu', async (p) => { await dom(p, '#utilityHamburgerBtn'); await settle(p, 500); }]);
      ['bookmarkBtn', 'bookmarksBtn', 'versionBtn', 'auditBtn', 'dashboardStyleBtn', 'dashboardBgBtn', 'autoSummaryBtn'].forEach((t) => states.push(['menu-' + t, menu(t)]));
      states.push(['dlg-filters', async (p) => { await closeAll(p); await dom(p, '#final25DbFilterBtn'); await settle(p, 500); }]);
      states.push(['dlg-design', async (p) => { await closeAll(p); await dom(p, '#dashboardDesignBtn'); await settle(p, 500); }]);
      states.push(['palette', async (p) => { await closeAll(p); await dom(p, '#commandPaletteBtn'); await settle(p, 500); }]);
      states.push(['view-table', view('table')]);
      ['addRowBtn', 'addColBtn', 'addFormulaColBtn', 'dataHealthBtn', 'freezeColBtn', 'groupByBtn', 'saveReportBtn'].forEach((b) => states.push(['table-' + b, async (p) => { await closeAll(p); await dom(p, '#' + b); await settle(p, 600); }]));
      states.push(['view-custom', view('custom')]);
      // กล่องแบบกำหนดเอง: ป๊อปโอเวอร์เพิ่มกล่อง → เพิ่มทุกชนิด (กล่อง KPI/กราฟ/ตาราง/ข้อความ + แม่แบบ) แล้วเปิดตั้งค่ากล่อง
      const must = async (p, sel) => { if (!(await dom(p, sel))) throw new Error('ไม่พบ ' + sel); };
      states.push(['custom-add-popover', async (p) => { await closeAll(p); await must(p, '#addWidgetBtn'); await settle(p, 500); }]);
      ['kpi', 'chart', 'table', 'text'].forEach((k) => states.push(['custom-add-' + k, async (p) => {
        if (!(await p.evaluate(() => !!document.querySelector('.add-widget-pick')))) await must(p, '#addWidgetBtn');
        await settle(p, 300); await must(p, `.add-widget-pick [data-type="${k}"]`); await settle(p, 700);
      }]));
      states.push(['custom-add-template', async (p) => { await must(p, '#addWidgetBtn'); await settle(p, 300); await must(p, '.add-widget-pick [data-template="maintenance"]'); await settle(p, 1800); }]);
      states.push(['custom-widget-config', async (p) => { await closeAll(p); await must(p, '#customView .grid-stack-item [data-act="edit"], #customView .cw-edit, #customView .grid-stack-item button'); await settle(p, 600); }]);
      // ตาราง: เมนูตัวกรองของหัวคอลัมน์ + สี/จัดรูปแบบเซลล์
      states.push(['table-col-filter', async (p) => { await closeAll(p); await view('table')(p); await must(p, '#dataTable .th-fbtn'); await settle(p, 500); }]);
      states.push(['table-cell-color', async (p) => { await closeAll(p); await p.evaluate(() => { const c = document.querySelector('#dataTable td[data-col]'); if (c) c.click(); }); await must(p, '#cellColorBtn'); await settle(p, 500); }]);
      states.push(['table-cell-style', async (p) => { await closeAll(p); await must(p, '#cellStyleBtn'); await settle(p, 500); }]);
      states.push(['table-cond-format', async (p) => { await closeAll(p); await must(p, '#condFormatToolbarBtn'); await settle(p, 500); }]);
    }
  });
  // ท้ายสุด (รีโหลดหน้า = ล้างสถานะในหน้า): บันทึกเป็นรายงาน → รีโหลดเห็นการ์ด "ทำค้างไว้"/"รายงานของฉัน" → ดำเนินการต่อ → ไฟล์หลายชีต (ตัวเลือกชีต/แถวหัวตาราง)
  const must2 = async (p, sel) => { if (!(await dom(p, sel))) throw new Error('ไม่พบ ' + sel); };
  states.push(['save-report', async (p) => {
    await closeAll(p); await must2(p, '#saveReportBtn'); await settle(p, 500);
    await p.fill('#whiteTextPromptInput', 'Report A', { timeout: 4000 }); await must2(p, '[data-wapply]'); await settle(p, 900);
  }]);
  states.push(['resume-cards', async (p) => {
    await p.reload({ waitUntil: 'load' }); await p.waitForSelector('nav.ome-nav', { timeout: 30000 }); await settle(p, 1500);
    await p.addScriptTag({ path: require('path').join(__dirname, 'theme-audit-page.js') }); // รีโหลด = ตัวตรวจในหน้าหาย ใส่ใหม่
    if (!(await p.evaluate(() => { const c = document.getElementById('resumeCard'); return !!(c && c.offsetParent); }))) throw new Error('ไม่เห็นการ์ดทำค้างไว้');
  }]);
  const setTpl = async (p, v) => { await p.evaluate((k) => { const el = document.getElementById('domainOverrideSel'); if (el) { el.value = k; el.dispatchEvent(new Event('change', { bubbles: true })); } }, v); await settle(p, 900); };
  states.push(['resume', async (p) => { await must2(p, '#resumeBtn'); await settle(p, 1500); await setTpl(p, 'organizational'); }]);
  const multi = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Name', 'Qty'], ['A', 1], ['B', 2]]), 'Sheet A');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Name', 'Qty'], ['C', 3]]), 'Sheet B');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  };
  states.push(['sheet-picker', async (p) => {
    await p.setInputFiles('#fileInput', { name: 'multi.xlsx', mimeType: 'application/octet-stream', buffer: multi() }); await settle(p, 1200);
  }]);
  states.push(['sheet-single', async (p) => { await must2(p, '#sheetModeSingle'); await settle(p, 400); await must2(p, '#sheetChips .chip'); await settle(p, 900); await setTpl(p, 'none'); }]);
  return {
    page: 'report-dashboard.html',
    overlay: '#filterPopover,#utilityMenuPanel,.lg-modal-ov',
    seed: {},
    init: 'window.TANOT_AI = { enabled: false };',
    user: null,
    states
  };
}

const ALLOW = [];

function targets(h) {
  return [tax(h), electrical(h), maintenance(h), runPage(h), cad(h), reportDashboard(h)];
}
module.exports = { targets, ALLOW, NOW };
