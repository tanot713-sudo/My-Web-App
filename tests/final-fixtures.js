// ข้อมูลตัวอย่าง + สถานะที่เปิดของ final-audit.spec.js (งานแก้ธีม รอบ 8 ปิดท้าย)
//   legal · sim-objects · languages
// targets(h) คืน [{ page, seed, init, route, wait, user, skipSel, overlay, states }] — โครงเดียวกับ edu-fixtures.js
// ทุก selector ในสถานะต้องไม่พึ่งข้อความไทย (spec รันซ้ำด้วย ome:lang=en) — ใช้ id / data-k
const NOW = new Date('2026-10-03T03:00:00Z').getTime();
const DAY = 86400000;

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/* ───────── legal.html ───────── */
function legal(h) {
  const { dom, settle, closeAll, val } = h;
  const k = async (p, key, extra) => { await dom(p, `[data-k="${key}"]${extra || ''}`); await settle(p, 250); };
  const seed = {
    'legal:drafts': {
      d1: { type: 'plaint', name: 'Lease dispute - Somchai', html: '<p>Draft one</p>', updatedAt: NOW - DAY },
      d2: { type: 'answer', name: 'Answer to the Smith claim, long draft name to check that the row never overflows the drawer', html: '<p>Draft two</p>', updatedAt: NOW - 3 * DAY },
      d3: { type: 'police-report', name: 'Police report', html: '<p>Draft three</p>', updatedAt: NOW - 9 * DAY }
    },
    'legal:checked': { plaint: [true, false, true], answer: [false, true] }
  };
  const ids = ['plaint', 'answer', 'petition', 'statement', 'counterclaim', 'prayer', 'police-report'];
  const states = [
    ['initial', async () => {}],
    ['drawer-open', async (p) => { await k(p, 'menu'); await settle(p, 400); }],
    ['draft-open', async (p) => { await k(p, 'draft', '[data-did="d2"]'); await settle(p, 300); }],
    ['drawer-open-2', async (p) => { await k(p, 'menu'); await settle(p, 400); }],
    ['draft-delete-confirm', async (p) => { await k(p, 'delDraft'); await settle(p, 400); }],
    ['draft-delete-cancel', async (p) => { await closeAll(p); await settle(p, 300); await dom(p, 'dialog[open] .btn:not(.danger)'); await settle(p, 300); }],
    ...ids.map((id) => [`template-${id}`, async (p) => { await closeAll(p); await dom(p, '[data-k="menu"]'); await settle(p, 200); await k(p, 'template', `[data-tid="${id}"]`); await settle(p, 250); }]),
    ['checklist-tick', async (p) => { await k(p, 'check'); await settle(p, 250); }],
    ['editor-typed', async (p) => { await p.evaluate(() => { const e = document.querySelector('.doc-editor'); e.focus(); document.execCommand('insertText', false, ' typed text'); }); await settle(p, 250); }],
    ['attach-image', async (p) => { await p.setInputFiles('input[type=file]', { name: 'a.png', mimeType: 'image/png', buffer: png }); await settle(p, 600); }],
    ['save-dialog', async (p) => { await k(p, 'saveDraft'); await settle(p, 400); }],
    ['save-dialog-typed', async (p) => { await val(p, '[data-k="draftName"]', 'My new draft'); await settle(p, 200); }],
    ['save-confirm', async (p) => { await k(p, 'nameSave'); await settle(p, 500); }],
    ['download', async (p) => { await p.evaluate(() => { URL.createObjectURL = () => 'blob:x'; HTMLAnchorElement.prototype.click = function () {}; }); await k(p, 'download'); }],
    ['sync', async (p) => { await k(p, 'sync'); await settle(p, 600); }],
    ['final', async (p) => { await closeAll(p); await settle(p, 200); }]
  ];
  return {
    page: 'legal.html',
    seed,
    user: /^\s*$/,
    overlay: 'aside.translate-x-0',
    init: 'window.google = undefined; window.print = function () {};',
    ignoreErrors: /accounts\.google\.com|gsi\/client|ERR_INTERNET_DISCONNECTED|Failed to load resource/,
    states
  };
}


/* ───────── sim-objects.html (3D) — แตะเฉพาะกรอบ UI: ฉาก/เรขาคณิต/ฟิสิกส์ไม่ถูกวัดนอกจากว่าโหลดได้และไม่มี error ───────── */
const OBJ_CUBE = Buffer.from('# cube\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nv 0 0 1\nv 1 0 1\nv 1 1 1\nv 0 1 1\nf 1 2 3 4\nf 5 8 7 6\nf 1 5 6 2\nf 2 6 7 3\nf 3 7 8 4\nf 5 1 4 8\n');
function sim(h) {
  const { dom, settle, closeAll, val, sel } = h;
  const api = (p, fn, arg) => p.evaluate(fn, arg);
  const keys = ['wall', 'door', 'window', 'column', 'table', 'chair', 'sofa', 'cabinet', 'bed', 'cone', 'barrel', 'crate', 'ladder', 'sign', 'scaffold'];
  const openPanel = async (p) => { await dom(p, '#s3PanelOpen'); await settle(p, 450); };
  const states = [
    ['initial', async () => {}],
    ['panel-open', openPanel],
    ['add-all', async (p) => { await api(p, (ks) => ks.forEach((k, i) => window.__sim3dObjects.addProcObject(k, (i % 5) * 1.5 - 3, Math.floor(i / 5) * -1.5 - 1, 0, null, 1)), keys); await settle(p, 500); }],
    ['select-first', async (p) => { await api(p, () => window.__sim3dObjects.select(window.__sim3dObjects.getPlaced()[0].id)); await settle(p, 300); }],
    ['nudge', async (p) => { for (const c of ['x1', 'z-1', 'ry1']) await dom(p, `[data-nudge="${c}"]`); await settle(p, 300); }],
    ['recolor', async (p) => { await dom(p, '.s3-swatch:nth-child(3)'); await settle(p, 300); }],
    ['size-apply', async (p) => { await sel(p, '#s3SizeAxis', 'x'); await val(p, '#s3SizeInput', 120); await dom(p, '#s3SizeApply'); await settle(p, 300); }],
    ['size-invalid', async (p) => { await val(p, '#s3SizeInput', 0); await dom(p, '#s3SizeApply'); await settle(p, 400); }],
    ['size-invalid-close', async (p) => { await dom(p, 'dialog[open] .btn'); await settle(p, 300); }],
    ['scale-buttons', async (p) => { await dom(p, '[data-scale="1.1"]'); await dom(p, '[data-scale="0.9"]'); await dom(p, '#s3SizeReset'); await settle(p, 300); }],
    ['upload-model', async (p) => { await p.setInputFiles('#s3FileInput', { name: 'my-cube.obj', mimeType: 'text/plain', buffer: OBJ_CUBE }); await settle(p, 1200); }],
    ['model-selected', async (p) => { await settle(p, 300); }],
    ['simplify', async (p) => { await api(p, () => { const r = document.getElementById('s3SimplifyRange'); if (r) { r.value = 50; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); } }); await settle(p, 400); }],
    ['upload-bad-ext', async (p) => { await p.setInputFiles('#s3FileInput', { name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }); await settle(p, 500); }],
    ['bad-ext-close', async (p) => { await dom(p, 'dialog[open] .btn'); await settle(p, 300); }],
    ['place-my-model', async (p) => { await dom(p, '[data-model-id]'); await settle(p, 1000); }],
    ['delete-model-confirm', async (p) => { await dom(p, '[data-del-id]'); await settle(p, 400); }],
    ['delete-model-cancel', async (p) => { await dom(p, 'dialog[open] .btn:not(.primary)'); await settle(p, 300); }],
    ['xform-on', async (p) => { await closeAll(p); await dom(p, '#s3XformToggle'); await dom(p, '[data-xmode="rotate"]'); await dom(p, '[data-xmode="scale"]'); await settle(p, 300); }],
    ['views', async (p) => { for (const v of ['top', 'front', 'side', 'persp']) { await dom(p, `[data-view="${v}"]`); } await settle(p, 300); }],
    ['csg-hint', async (p) => { await dom(p, '#s3CsgStart'); await settle(p, 300); }],
    ['csg-pick-modal', async (p) => { await api(p, () => { const pl = window.__sim3dObjects.getPlaced(); window.__sim3dObjects.handleCsgPick(pl[0].id); window.__sim3dObjects.handleCsgPick(pl[1].id); }); await settle(p, 500); }],
    ['csg-cancel', async (p) => { await dom(p, 'dialog[open] .btn:not(.primary)'); await settle(p, 300); }],
    ['csg-run', async (p) => { await api(p, () => { const pl = window.__sim3dObjects.getPlaced(); window.__sim3dObjects.handleCsgPick; window.__sim3dObjects.startCsgMode(); window.__sim3dObjects.handleCsgPick(pl[2].id); window.__sim3dObjects.handleCsgPick(pl[3].id); }); await settle(p, 400); await dom(p, 'dialog[open] .btn.primary'); await settle(p, 1500); }],
    ['csg-result-selected', async (p) => { await settle(p, 300); }],
    ['csg-need-two', async (p) => { await dom(p, '#s3Clear'); await settle(p, 300); await dom(p, 'dialog[open] .btn.primary'); await settle(p, 400); await dom(p, '#s3CsgStart'); await settle(p, 400); }],
    ['csg-need-two-close', async (p) => { await dom(p, 'dialog[open] .btn'); await settle(p, 300); }],
    ['export-empty', async (p) => { await dom(p, '#s3ExportAll'); await settle(p, 400); }],
    ['export-empty-close', async (p) => { await dom(p, 'dialog[open] .btn'); await settle(p, 300); }],
    ['panel-catalog-add', async (p) => { await dom(p, '#s3PanelOpen'); await settle(p, 300); await dom(p, '.s3-cat[data-key="table"]'); await settle(p, 500); }],
    ['panel-reopen', openPanel],
    ['panel-close', async (p) => { await dom(p, '#s3PanelClose'); await settle(p, 400); }],
    ['final', async (p) => { await closeAll(p); await settle(p, 200); }]
  ];
  return {
    page: 'sim-objects.html',
    seed: {},
    user: /^\s*$/,
    overlay: '.s3-aside.open',
    // วาดฉาก 3D ช้าลง (~5 เฟรม/วินาที) — WebGL ซอฟต์แวร์ในคอนเทนเนอร์ทดสอบกินซีพียูจนปุ่ม/ช่องกรอกตอบสนองช้า (ไม่แตะโค้ดของหน้า)
    init: '(function(){var r=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=function(cb){return setTimeout(function(){r(cb);},200);};})();',
    // ฉาก 3D: ถ้า CDN/WebGL ใช้ไม่ได้ในสภาพแวดล้อมทดสอบ error จากไลบรารีไม่ใช่ของกรอบ UI
    ignoreErrors: /ERR_INTERNET_DISCONNECTED|Failed to load resource|GPU stall|WebGL|GL Driver|swiftshader/i,
    states
  };
}

const ALLOW = [];

function targets(h) {
  return [legal(h), sim(h)];
}
module.exports = { targets, ALLOW, NOW };
