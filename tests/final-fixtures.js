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

const ALLOW = [];

function targets(h) {
  return [legal(h)];
}
module.exports = { targets, ALLOW, NOW };
