// @ts-check
// ตัวตรวจกลุ่มเอกสาร "ตอนมีข้อมูล" (งานแก้ธีม รอบ 5) — theme-audit.spec.js วัดหน้าว่างเท่านั้น
//   word · excel · slides · extract-text · doc-check · doc-check-file · compare · text-to-speech
//   seed เอกสาร/ตาราง/สไลด์/ผลตรวจ/ไฟล์เทียบ/ข้อความถอดเสียง (ไฟล์ที่ผู้ใช้เลือกส่งผ่าน setInputFiles) + mock /api ทุกตัว
//   (ocr, asr, ai/*, files — ไม่เรียกของจริง) + CDN ของไลบรารี (luckysheet/xlsx/mammoth/jszip) ชี้ไปแพ็กเกจใน tests/node_modules
//   แล้วเปิดทุกแท็บ/dialog/ผลลัพธ์ × 360/390/1100 × สว่าง/มืด วัด: axe สี, contrast, ขอบ control, คอมโพเนนต์กลาง, เป้ากด, 6 กฎมือถือ
//   + ภาษา EN: ข้อความไทยที่มองเห็นทุกจุดในทุกสถานะ (ยกเว้น data-i18n-skip และกล่องเอกสารที่ผู้ใช้แก้ [data-doc-area]) ต้องเป็น 0
//   + สลับภาษาสด th → en → th โดยไม่โหลดหน้าใหม่ (ฟังผ่าน OME_LANG.onChange) และไม่มี console error
// เป้า = 0 ทุกตัวชี้วัด (ไม่ใช้ ratchet) — ยกเว้นรายการใน ALLOW ที่ต้องมีเหตุผลรายจุด
//   DOCS_AUDIT_ONLY=<regex หน้า> เลือกหน้า · DOCS_AUDIT_DUMP=<โฟลเดอร์> เขียนผลทุกจุดลงไฟล์แทนการล้มเทสต์
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { prepare } = require('./helpers');

const DUMP = process.env.DOCS_AUDIT_DUMP || '';
const ONLY = process.env.DOCS_AUDIT_ONLY ? new RegExp(process.env.DOCS_AUDIT_ONLY) : null;
const AUDIT_JS = path.join(__dirname, 'theme-audit-page.js');
const AXE_JS = require.resolve('axe-core/axe.min.js');
const NM = path.join(__dirname, 'node_modules');
const NOW = new Date('2026-10-03T03:00:00Z').getTime();
let XLSX = null; try { XLSX = require('xlsx'); } catch (e) {}

/* จุดที่ยังไม่เป็น 0 และมีเหตุผล — { page regex, metric, selector regex, เหตุผล } (ห้ามเพิ่มโดยไม่มีเหตุผล) */
const ALLOW = [
  // ปุ่ม/ไอคอนของ Luckysheet ที่ย้ายเข้าริบบอน — สร้างและกำหนดขนาดโดยไลบรารี (ไม่ใช่คอมโพเนนต์ของเรา)
  { page: /excel/, metric: 'nonCentral', sel: /luckysheet|xlr-panel|iconfont/, why: 'ปุ่ม/ช่องของ Luckysheet ที่ย้ายเข้าริบบอน' },
  { page: /excel/, metric: 'targetSize', sel: /luckysheet|xlr-panel/, why: 'ปุ่มของ Luckysheet ในริบบอน (ขนาดกำหนดโดยไลบรารี เลื่อนแนวนอนได้)' },
  { page: /excel/, metric: 'mobileCrowd', sel: /luckysheet|xlr-panel/, why: 'ปุ่มของ Luckysheet ในริบบอน (ชิดกันโดยออกแบบของไลบรารี)' },
  { page: /excel/, metric: 'contrast', sel: /luckysheet|xlr-panel/, why: 'ไอคอน/ข้อความของ Luckysheet ในริบบอน' },
  { page: /excel/, metric: 'axe', sel: /luckysheet|xlr-panel/, why: 'ไอคอน/ข้อความของ Luckysheet ในริบบอน' },
  { page: /excel/, metric: 'controlBorder', sel: /luckysheet|xlr-panel/, why: 'ปุ่มของ Luckysheet ในริบบอน' },
  { page: /excel/, metric: 'mobileFont', sel: /luckysheet|xlr-panel/, why: 'ป้ายของ Luckysheet ในริบบอน' },
  { page: /excel/, metric: 'mobileClip', sel: /luckysheet|xlr-panel/, why: 'ป้ายของ Luckysheet ในริบบอน' },
  { page: /excel/, metric: 'mobileOverflow', sel: /luckysheet|xlr-panel/, why: 'ริบบอนเลื่อนแนวนอนในกล่องของมันเอง' }
];
const allowed = (page, metric, s) => !process.env.DOCS_AUDIT_NOALLOW && ALLOW.some((a) => a.page.test(page) && a.metric === metric && a.sel.test(String((s && s.sel) || '')));

/* ───────── ข้อมูลตัวอย่าง ───────── */
const WORD_HTML = '<h1>รายงานประจำปี 2569</h1><p>This is a sample paragraph with teh recieve error to check.</p>' +
  '<p>ข้อความภาษาไทยสำหรับทดสอบการแสดงผลของเอกสารที่ยาวพอจะขึ้นบรรทัดใหม่หลายบรรทัดในหน้ากระดาษ A4 ตามความกว้างที่กำหนด</p>' +
  '<h2>หัวข้อที่สอง</h2><ul><li>รายการที่หนึ่ง</li><li>รายการที่สอง</li></ul>' +
  '<table><tbody><tr><td>ชื่อ</td><td>จำนวน</td></tr><tr><td>A</td><td>10</td></tr></tbody></table>' +
  Array.from({ length: 14 }, (_, i) => '<p>Paragraph ' + (i + 1) + ' lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore.</p>').join('') +
  '<h2>Section three</h2><p>Last paragraph.</p>';
const SHEET = [{ name: 'Sheet1', index: '0', status: 1, order: 0, row: 30, column: 12, celldata: [].concat(
  ['ชื่อ', 'จำนวน', 'ราคา'].map((h, c) => ({ r: 0, c, v: { v: h, m: h, ct: { fa: 'General', t: 'g' }, bl: 1 } })),
  [['apple', 3, 10], ['banana', 5, 20], ['cherry', 7, 30]].reduce((a, row, ri) => a.concat(row.map((v, c) => ({ r: ri + 1, c, v: { v, m: String(v), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 'g' } } }))), [])
), config: {} }];
const OUTLINE = '# รายงานประจำปี\nผู้นำเสนอ · 3 ต.ค. 2569\n> โน้ตผู้บรรยาย\n\n# Agenda\n- First point\n- Second point\n  - detail\n\n# Two columns\n- left a\n- left b\n---\n- right a\n- right b\n\n# Image slide\n@image k1\n- caption\n\n# Table\nName\tQty\nApple\t3\nPear\t5\n\n# Section';
const DECKS = [
  { v: 1, id: 'd1', name: 'Quarterly review', outline: OUTLINE, theme: 'light', accent: '', images: { k1: { name: 'pic.jpg', size: 1000, mime: 'image/jpeg', w: 800, h: 600, pending: true } }, createdAt: NOW - 86400000, updatedAt: NOW - 3600000 },
  { v: 1, id: 'd2', name: 'ชุดสไลด์ทดสอบ', outline: '# หัวข้อ\n- ประเด็น', theme: 'dark', accent: '', images: {}, createdAt: NOW - 172800000, updatedAt: NOW - 7200000 }
];
const QUOTE_JOB = { id: 'q1', name: 'Server purchase', createdAt: NOW, criteria: [{ id: 'price', name: 'Price', weight: 50, auto: 'price' }, { id: 'delivery', name: 'Delivery', weight: 20, auto: null }, { id: 'warranty', name: 'Warranty', weight: 15, auto: null }, { id: 'tech', name: 'Technical specs', weight: 15, auto: null }],
  bidders: [
    { id: 'b1', name: 'Alpha Co', price: '100000', delivery: '30 days', warranty: '2 years', payment: 'Net 30', note: '', scores: { delivery: '8', warranty: '7', tech: '9' }, files: [{ id: 'f1', name: 'quote-alpha.pdf', size: 1000, mime: 'application/pdf' }] },
    { id: 'b2', name: 'บริษัท เบต้า', price: '120000', delivery: '14 days', warranty: '3 years', payment: 'Net 15', note: 'หมายเหตุ', scores: { delivery: '9', warranty: '8', tech: '7' }, files: [] }] };

function xlsxBuf(rows, sheetNames) {
  const wb = XLSX.utils.book_new();
  (sheetNames || ['Sheet1']).forEach((n) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), n));
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
const TABLE_A = [['id', 'name', 'qty', 'note'], [1, 'apple', 3, 'a'], [2, 'banana', 5, 'b'], [3, 'cherry', 7, 'c'], [4, 'date', 9, 'd']];
const TABLE_B = [['id', 'name', 'qty', 'extra'], [1, 'apple', 3, 'x'], [2, 'banana', 6, 'y'], [3, 'cherry', 7, 'z'], [5, 'elder', 1, 'w']];
const TXT_A = 'Line one\nLine two\nLine three\nLine four\nLine five\nLine six\nLine seven\nLine eight\nLine nine\nLine ten';
const TXT_B = 'Line one\nLine 2\nLine three\nLine four\nLine five\nLine six\nLine seven\nLine eight changed\nLine nine\nLine ten\nLine eleven';

/* ───────── ตัวช่วย ───────── */
const dom = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); return !!el; }, sel);
const settle = (page, ms) => page.waitForTimeout(ms || 250);
async function closeAll(page) {
  await page.evaluate(() => {
    document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (e) {} });
    document.querySelectorAll('.di-popover').forEach((p) => { p.style.display = 'none'; });
    const st = document.getElementById('stage'); if (st && !st.hidden) st.hidden = true;
  });
  await page.keyboard.press('Escape').catch(() => {});
}
async function files(page, sel, list) { await page.setInputFiles(sel, list); }
const txtFile = (name, text) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });

/* ───────── เป้าหมาย: หน้า + ข้อมูลตั้งต้น + สถานะที่เปิด (สะสมต่อกัน) ───────── */
const TARGETS = [
  { page: 'word.html', seed: { 'tanot:word:autosave': { html: WORD_HTML, header: 'Header text', footer: 'Footer', pageNum: true, headerHtml: 'Header text', footerHtml: 'Footer', pageSize: 'A4', orientation: 'portrait', margins: 'normal', savedAt: NOW } },
    states: [
      ['base', async () => {}],
      ...['insert', 'layout', 'refs', 'review', 'view', 'home'].map((tab) => ['tab-' + tab, async (p) => { await dom(p, `[data-tab="${tab}"]`); }]),
      ['dlg-find', async (p) => { await dom(p, '[data-tab="home"]'); await dom(p, '#findReplaceBtn'); }],
      ['dlg-table', async (p) => { await closeAll(p); await dom(p, '[data-tab="insert"]'); await dom(p, '#tableBtn'); }],
      ['dlg-link', async (p) => { await closeAll(p); await dom(p, '#linkBtn'); }],
      ['dlg-symbol', async (p) => { await closeAll(p); await dom(p, '#symbolBtn'); }],
      ['dlg-footnote', async (p) => { await closeAll(p); await dom(p, '[data-tab="refs"]'); await dom(p, '#footnoteBtn'); }],
      ['dlg-wordcount', async (p) => { await closeAll(p); await dom(p, '[data-tab="review"]'); await dom(p, '#wordCountBtn'); }],
      ['nav-pane', async (p) => { await closeAll(p); await dom(p, '[data-tab="view"]'); await dom(p, '#navPaneBtn'); await settle(p, 400); }],
      ['nav-pane-pages', async (p) => { await dom(p, '[data-navtab="pages"]'); }],
      ['issues', async (p) => {
        await dom(p, '#navCloseBtn'); await closeAll(p);
        await p.selectOption('#langSelect', 'en').catch(() => {});
        await dom(p, '[data-tab="review"]'); await dom(p, '#runBtn'); await settle(p, 900);
      }]
    ] },
  { page: 'excel.html', seed: { 'tanot:sheet:autosave': SHEET }, wait: async (p) => { await p.waitForSelector('#xlRibbon:not([hidden])', { timeout: 20000 }).catch(() => {}); await settle(p, 600); },
    states: [
      ['base', async () => {}],
      ...['insert', 'formulas', 'data', 'view', 'home'].map((tab) => ['tab-' + tab, async (p) => { await dom(p, `[data-rtab="${tab}"]`); await settle(p); }]),
      ['di-fuzzy', async (p) => { await dom(p, '#diFuzzyBtn'); await settle(p, 400); }],
      ['di-summary', async (p) => { await closeAll(p); await dom(p, '#diSummaryBtn'); await settle(p, 400); }],
      ['di-trend', async (p) => { await closeAll(p); await dom(p, '#diTrendBtn'); await settle(p, 400); }],
      ['dlg-new', async (p) => { await closeAll(p); await dom(p, '#newBtn'); await settle(p, 300); }]
    ] },
  { page: 'slides.html', seed: { 'tanot:slides:decks': DECKS, 'tanot:slides:ui': { deckId: 'd1', view: 'outline' } }, init: 'window.TANOT_AI = { enabled: true };',
    states: [
      ['base', async () => {}],
      ['view-list', async (p) => { await dom(p, '[data-view="list"]'); }],
      ['view-preview', async (p) => { await dom(p, '[data-view="preview"]'); await settle(p, 400); }],
      ['view-outline', async (p) => { await dom(p, '[data-view="outline"]'); }],
      ['dlg-ai', async (p) => { await dom(p, '#aiBtn'); await settle(p); }],
      ['dlg-ai-result', async (p) => { await p.fill('#aiSrc', 'Quarterly results were strong. Revenue grew 12%.'); await dom(p, '#aiRun'); await settle(p, 900); }],
      ['dlg-delete', async (p) => { await closeAll(p); await dom(p, '[data-view="list"]'); await dom(p, '.sl-deck [data-act="del"]'); await settle(p, 300); }],
      ['stage', async (p) => { await closeAll(p); await dom(p, '[data-view="preview"]'); await dom(p, '#presentBtn'); await settle(p, 300); }]
    ] },
  { page: 'extract-text.html',
    states: [
      ['base', async () => {}],
      ['loaded', async (p) => { await files(p, '#fileInput', txtFile('notes.txt', 'บรรทัดแรกของไฟล์\nSecond line of the file\n' + 'More text. '.repeat(40))); await settle(p, 600); }],
      ['pdf-actions', async (p) => { await p.evaluate(() => { document.getElementById('splitPdfBtn').style.display = ''; }); await dom(p, '#copyBtn'); await settle(p, 300); }],
      ['read-error', async (p) => { await files(p, '#fileInput', { name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n') }); await settle(p, 900); }]
    ] },
  { page: 'doc-check.html',
    states: [
      ['base', async () => {}],
      ['typed', async (p) => { await p.fill('#typeTextarea', 'This is teh best recieve of the year.\n\nSecond paragraph is fine.'); await dom(p, '#useTypedTextBtn'); await settle(p, 400); }],
      ['issues', async (p) => { await p.selectOption('#langSelect', 'en').catch(() => {}); await dom(p, '#runBtn'); await settle(p, 900); }],
      ['fixed', async (p) => { await dom(p, '#applyFixBtn'); await settle(p, 400); }]
    ] },
  { page: 'doc-check-file.html',
    states: [
      ['base', async () => {}],
      ['loaded', async (p) => { await files(p, '#fileInput', txtFile('draft.txt', 'This is teh best recieve of the year.\n\nSecond paragraph.')).catch(() => {}); await settle(p, 800); }],
      ['issues', async (p) => { await p.selectOption('#langSelect', 'en').catch(() => {}); await dom(p, '#runBtn'); await settle(p, 900); }]
    ] },
  { page: 'compare.html', seed: { 'tanot:compare:quotes': [QUOTE_JOB] }, init: 'window.TANOT_FILES = { enabled: true };',
    states: [
      ['base', async () => {}],
      ['tables-loaded', async (p) => {
        await files(p, '#fileA', { name: 'a.xlsx', mimeType: 'application/octet-stream', buffer: xlsxBuf(TABLE_A) });
        await files(p, '#fileB', { name: 'b.xlsx', mimeType: 'application/octet-stream', buffer: xlsxBuf(TABLE_B) });
        await p.waitForSelector('#mapCard:not([hidden])', { timeout: 15000 }).catch(() => {}); await settle(p, 300);
      }],
      ['tables-result', async (p) => { await dom(p, '#runTable'); await p.waitForSelector('#resBox:not([hidden])', { timeout: 10000 }).catch(() => {}); await settle(p, 300); }],
      ['tables-removed', async (p) => { await dom(p, '[data-g="removed"]'); await settle(p, 200); }],
      ['tables-added', async (p) => { await dom(p, '[data-g="added"]'); await settle(p, 200); }],
      ['tables-dups', async (p) => { await dom(p, '[data-g="dups"]'); await settle(p, 200); }],
      ['tab-text', async (p) => { await dom(p, '[data-tab="text"]'); await p.fill('#txtA', TXT_A); await p.fill('#txtB', TXT_B); await settle(p, 200); }],
      ['text-diff', async (p) => { await dom(p, '#runText'); await p.waitForSelector('#diffBox:not([hidden])', { timeout: 10000 }).catch(() => {}); await settle(p, 300); }],
      ['text-unified', async (p) => { await dom(p, '[data-view="unified"]'); await settle(p, 200); }],
      ['text-next', async (p) => { await dom(p, '#nextHunk'); await settle(p, 200); }],
      ['tab-quotes', async (p) => { await dom(p, '[data-tab="quotes"]'); await settle(p, 400); }],
      ['quotes-add', async (p) => { await dom(p, '#critAdd'); await dom(p, '#bidAdd'); await settle(p, 300); }],
      ['quotes-confirm', async (p) => { await dom(p, '[data-rmbid]'); await settle(p, 300); }]
    ] },
  { page: 'text-to-speech.html', init: 'window.TANOT_AI = { enabled: true };',
    states: [
      ['base', async () => {}],
      ['text', async (p) => { await p.fill('#ttsText', 'Hello world. สวัสดีครับ นี่คือข้อความทดสอบสำหรับแปลงเป็นเสียง'); await settle(p, 200); }],
      ['imported', async (p) => { await files(p, '#importFileInput', txtFile('speech.txt', 'Imported speech text. ' + 'ข้อความที่นำเข้า '.repeat(10))); await settle(p, 600); }],
      ['live-status', async (p) => { await p.evaluate(() => { const s = document.getElementById('wsStatus'); s.className = 'status err'; s.textContent = 'x'; }); await dom(p, '#wsPlayBtn'); await settle(p, 300); }],
      ['download-ready', async (p) => { await p.evaluate(() => { document.getElementById('dlPlayerWrap').style.display = 'block'; }); await settle(p, 200); }],
      ['asr-no-file', async (p) => { await dom(p, '#asrGoBtn'); await settle(p, 300); }],
      ['asr-result', async (p) => { await p.evaluate(() => { document.getElementById('asrResultWrap').style.display = 'block'; document.getElementById('asrResult').value = 'ข้อความที่ถอดเสียงได้ transcript text '.repeat(6); const m = document.getElementById('asrEngineNote'); if (m) m.style.display = 'block'; }); await settle(p, 200); }],
      ['meeting-result', async (p) => { await p.evaluate(() => { document.getElementById('meetingSumWrap').style.display = 'block'; document.getElementById('meetingSumResult').value = 'ภาพรวมการประชุม:\nSummary text\n'.repeat(5); }); await settle(p, 200); }]
    ] }
];

/* ───────── เปิดหน้า + mock ───────── */
function ltResponse(text) {
  const matches = [];
  ['teh', 'recieve'].forEach((w) => { const i = text.indexOf(w); if (i >= 0) matches.push({ message: 'Possible spelling mistake', shortMessage: 'Spelling', offset: i, length: w.length, replacements: [{ value: w === 'teh' ? 'the' : 'receive' }], rule: { id: 'MORFOLOGIK_RULE_EN_US', category: { id: 'TYPOS' } } }); });
  return { matches };
}
async function open(page, t, { theme, width, lang }) {
  const errors = await prepare(page, { theme });
  await page.addInitScript(([seed, init, lang]) => {
    try {
      if (lang) localStorage.setItem('ome:lang', lang);
      if (!localStorage.getItem('__seeded')) {
        Object.keys(seed).forEach((k) => localStorage.setItem(k, JSON.stringify(seed[k])));
        localStorage.setItem('__seeded', '1');
      }
    } catch (e) {}
    if (init) (0, eval)(init);
  }, [t.seed || {}, t.init || '', lang || '']);
  // CDN → แพ็กเกจใน tests/node_modules (ไม่มีไฟล์ = ปล่อยให้ถูกบล็อกเหมือนออฟไลน์)
  await page.route(/https:\/\/cdn\.jsdelivr\.net\/npm\/.+/, (route) => {
    const m = /npm\/((?:@[^/]+\/)?[^@/]+)@[^/]+\/(.+?)(?:\?.*)?$/.exec(route.request().url());
    const f = m && path.join(NM, m[1], m[2]);
    if (f && fs.existsSync(f) && fs.statSync(f).isFile()) {
      const ext = path.extname(f);
      return route.fulfill({ body: fs.readFileSync(f), contentType: ext === '.css' ? 'text/css' : ext === '.js' || ext === '.mjs' ? 'application/javascript' : 'application/octet-stream' });
    }
    return route.abort('internetdisconnected');
  });
  await page.route('https://api.languagetool.org/**', async (route) => {
    const body = route.request().postData() || '';
    const text = new URLSearchParams(body).get('text') || '';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(ltResponse(text)) });
  });
  // /api ทุกตัวเป็น mock — ห้ามเรียกของจริง (ocr ห้ามถูกเรียกเลย)
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url()).pathname;
    if (/\/api\/ocr/.test(u)) { errors.push('เรียก /api/ocr (ห้าม)'); return route.fulfill({ status: 500, body: '{}' }); }
    if (/\/api\/ai\/chat/.test(u)) return route.fulfill({ contentType: 'text/event-stream', body: 'data:{"t":"# Title\\n- point one\\n- point two"}\n\ndata:{"done":true}\n\n' });
    if (/\/api\/ai\/summarize/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: 'ภาพรวมการประชุม:\nสรุป', cached: false }) });
    if (/\/api\/ai\/usage/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ used: 120, limit: 10000 }) });
    if (/\/api\/asr/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: 'transcript', neurons: 1 }) });
    if (/\/api\/files/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'f9', name: 'file.pdf', size: 1000, mime: 'application/pdf' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.setViewportSize({ width, height: 800 });
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto('/' + t.page, { waitUntil: 'load' });
  await page.waitForSelector('nav.ome-nav', { timeout: 30000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await settle(page, 500);
  if (t.wait) await t.wait(page);
  await page.addScriptTag({ path: AUDIT_JS });
  return errors;
}

/** ข้อความไทยที่มองเห็นทุกจุด — ยกเว้น data-i18n-skip / กล่องเอกสารที่ผู้ใช้แก้ (data-doc-area) / ข้อมูลผู้ใช้ที่ seed */
async function thaiAnywhere(page) {
  return page.evaluate(() => {
    const THAI = /[฀-฾เ-๿]/; /* ไม่นับ ฿ (U+0E3F) */
    const SKIP = 'script,style,noscript,option,[data-i18n-skip],[data-doc-area],.wd-sym-grid,.wd-nav-list,.ome-nav,nav.ome-nav,footer.ome-footer,.ome-ai-fab,.ome-ai-panel,.luckysheet,#luckysheet,#xlCellEditor';
    const USER = /รายงานประจำปี|ชุดสไลด์ทดสอบ|บริษัท เบต้า|หมายเหตุ|ข้อความที่ถอดเสียงได้|ภาพรวมการประชุม|ข้อความที่นำเข้า|บรรทัดแรกของไฟล์|ผู้นำเสนอ|สวัสดีครับ|นี่คือข้อความทดสอบ|ชื่อ|จำนวน|ราคา|หัวข้อ|ประเด็น|สรุป|ไฟล์เสียง/;
    const out = [], seen = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (!THAI.test(t.nodeValue)) continue;
      const p = t.parentElement;
      if (!p || p.closest(SKIP)) continue;
      const r = p.getBoundingClientRect(), cs = getComputedStyle(p);
      if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (t.nodeValue.trim() === 'ไทย') continue; // ชื่อภาษาบนปุ่มสลับภาษา
      if (USER.test(t.nodeValue) && p.closest('.dc-text,.dc-viewer,#diffView,.cp-diff,td,textarea,.sl-s,.sl-deck,.cp-bid,.cp-crit,#critList,#bidList,#rankBox,select')) continue;
      if (seen.has(p)) continue; seen.add(p);
      out.push((p.id ? '#' + p.id : p.tagName.toLowerCase() + (typeof p.className === 'string' && p.className.trim() ? '.' + p.className.trim().split(/\s+/)[0] : '')) + ' → ' + t.nodeValue.trim().slice(0, 40));
    }
    ['placeholder', 'title', 'aria-label'].forEach((a) => document.querySelectorAll('[' + a + ']').forEach((el) => {
      if (el.closest('[data-i18n-skip],[data-doc-area],.wd-nav-list,.ome-nav,footer.ome-footer,.ome-ai-fab,.ome-ai-panel,.luckysheet') || !THAI.test(el.getAttribute(a))) return;
      if (el.getAttribute(a).trim() === 'ไทย') return;
      const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return;
      out.push('[' + a + '] ' + (el.id ? '#' + el.id : el.tagName.toLowerCase()) + ' → ' + el.getAttribute(a).slice(0, 40));
    }));
    return out;
  });
}

async function measure(page, width, withAxe) {
  // dialog แบบ modal เปิดอยู่ = วัดเฉพาะในกล่อง (หน้าหลังกล่องใช้งานไม่ได้ ไม่ควรนับซ้อน/ชิดกับของในกล่อง)
  const modal = await page.evaluate(() => {
    const drawer = document.querySelector('.wd-nav:not([hidden])'); // ลิ้นชักนำทางของ word (≤1300px ทับหน้า + ฉากหลัง)
    const drawerOver = drawer && getComputedStyle(drawer).position === 'fixed';
    const pop = [...document.querySelectorAll('.di-popover')].some((x) => getComputedStyle(x).display !== 'none'); // ป็อปอัพวิเคราะห์ข้อมูลของ excel (fixed ทับหน้า)
    if (!document.querySelector('dialog[open]') && !drawerOver && !pop) return false;
    const st = document.createElement('style'); st.id = 'audit-modal-style';
    st.textContent = pop ? 'body > *:not(.di-popover){visibility:hidden !important}' : drawerOver ? '.wd-top,.wd-page-wrap,.wd-side,.wd-statusbar,.ome-nav{visibility:hidden !important}' : 'body > *:not(dialog[open]){visibility:hidden !important}';
    document.head.appendChild(st); return true;
  });
  try { return await measureInner(page, width, withAxe); }
  finally { if (modal) await page.evaluate(() => { const s = document.getElementById('audit-modal-style'); if (s) s.remove(); }); }
}
async function measureInner(page, width, withAxe) {
  const res = await page.evaluate((m) => window.__tanotAudit.audit({ mobile: m }), width < 700);
  const samples = { contrast: res.contrast, controlBorder: res.controlBorder, nonCentral: res.nonCentral };
  if (withAxe) {
    await page.addScriptTag({ path: AXE_JS }).catch(() => {});
    samples.axe = await page.evaluate(async () => {
      if (!window.axe) return [];
      const r = await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations'] });
      const out = [];
      (r.violations || []).forEach((v) => v.nodes.forEach((n) => { const d = (n.any && n.any[0] && n.any[0].data) || {}; out.push({ sel: (n.target || []).join(' '), ratio: d.contrastRatio, fg: d.fgColor, bg: d.bgColor }); }));
      return out;
    });
  }
  if (width < 700) { samples.targetSize = res.targetSize; Object.assign(samples, await page.evaluate(() => window.__tanotAudit.mobile({ shell: false }))); }
  return samples;
}

test.describe.configure({ timeout: 240000 });

for (const t of TARGETS) {
  if (ONLY && !ONLY.test(t.page)) continue;
  for (const width of [360, 390, ...(process.env.AUDIT_EXTRA_WIDTHS || '').split(',').map(Number).filter(Boolean), 1100]) { // AUDIT_EXTRA_WIDTHS=412,430 เพิ่ม Android ทั่วไป/iPhone Pro Max
    for (const theme of ['light', 'dark']) {
      test(`docs-data: ${t.page}|${width}|${theme}`, async ({ page }) => {
        const errors = await open(page, t, { theme, width });
        const bad = {};
        for (const [name, fn] of t.states) {
          try { await fn(page); } catch (e) { errors.push(`state ${name}: ${String(e.message).split('\n')[0]}`); }
          await settle(page, 200);
          const s = await measure(page, width, true);
          Object.keys(s).forEach((k) => {
            const arr = s[k].filter((x) => !allowed(t.page, k, x));
            if (arr.length) (bad[k] = bad[k] || []).push(...arr.slice(0, 6).map((x) => Object.assign({ state: name }, x)));
          });
        }
        if (DUMP) { fs.mkdirSync(DUMP, { recursive: true }); fs.writeFileSync(path.join(DUMP, `${t.page}|${width}|${theme}`.replace(/[^\w.|-]/g, '_') + '.json'), JSON.stringify({ bad, errors })); return; }
        expect(bad, `${t.page} ${width} ${theme}`).toEqual({});
        expect(errors, 'console errors').toEqual([]);
      });
    }
  }

  test(`docs-data lang: ${t.page}`, async ({ page }) => {
    // ทุกสถานะในโหมด EN — ข้อความไทยที่โผล่ในกล่อง/แท็บ/ข้อความสถานะ/ผลลัพธ์ต้องเป็น 0
    const errors = await open(page, t, { theme: 'light', width: 1100, lang: 'en' });
    const hits = new Set();
    for (const [name, fn] of t.states) {
      try { await fn(page); } catch (e) { errors.push(`state ${name}: ${String(e.message).split('\n')[0]}`); }
      await settle(page, 250);
      (await thaiAnywhere(page)).forEach((h) => hits.add(name + ': ' + h));
    }
    const th = [...hits];
    if (DUMP) { fs.mkdirSync(DUMP, { recursive: true }); fs.writeFileSync(path.join(DUMP, `${t.page}|lang`.replace(/[^\w.|-]/g, '_') + '.json'), JSON.stringify(th.concat(errors.map((e) => 'ERR ' + e)))); return; }
    expect(th).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`docs-data live switch: ${t.page}`, async ({ page }) => {
    // th → en → th จาก OME_LANG.set โดยไม่โหลดหน้าใหม่ (ฟังผ่าน OME_LANG.onChange) ที่สถานะ "มีข้อมูล" สุดท้าย:
    // en ไทยหลุด 0 · กลับไทยแล้วข้อความไทยกลับมา · ภาษาของเนื้อหาเอกสาร (ตัวเลือกภาษาตรวจคำผิด/ถอดเสียง) ไม่ถูกเปลี่ยนตาม UI
    const errors = await open(page, t, { theme: 'light', width: 1100, lang: 'th' });
    for (const [name, fn] of t.states) { try { await fn(page); } catch (e) { errors.push(`state ${name}: ${String(e.message).split('\n')[0]}`); } await settle(page, 200); }
    await closeAll(page); await settle(page, 300); // กล่องยืนยันที่ค้างอยู่ปิดก่อน (ผู้ใช้สลับภาษาตอนมี modal เปิดไม่ได้)
    const docLang = await page.evaluate(() => { const s = document.querySelector('#langSelect, #dlLang, #asrLang'); return s ? s.value : null; });
    await page.evaluate(() => { window.__noReload = 1; window.OME_LANG.set('en'); });
    await settle(page, 1000);
    expect(await thaiAnywhere(page), 'หลังสลับเป็น EN').toEqual([]);
    expect(await page.evaluate(() => window.OME_PAGE_LIVE_LANG), 'หน้าประกาศว่าฟังการสลับภาษา').toBe(true);
    expect(await page.evaluate(() => { const s = document.querySelector('#langSelect, #dlLang, #asrLang'); return s ? s.value : null; }), 'ภาษาของเนื้อหาไม่เปลี่ยนตาม UI').toBe(docLang);
    await page.evaluate(() => window.OME_LANG.set('th'));
    await settle(page, 1000);
    expect(await page.evaluate(() => /[ก-ฺเ-๎]/.test((document.querySelector('main, .page, body') || document.body).innerText)), 'กลับไทย').toBe(true);
    expect(await page.evaluate(() => window.__noReload)).toBe(1);
    expect(errors).toEqual([]);
  });
}
