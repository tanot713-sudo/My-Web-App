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


/* ───────── languages.html (React) ───────── */
const LANG_IDS = ['lang-en', 'lang-jp', 'lang-cn', 'lang-yue', 'lang-kr', 'lang-de', 'lang-in', 'lang-fr', 'lang-it', 'lang-mm', 'lang-kh', 'lang-la', 'lang-vn', 'lang-my', 'lang-ar', 'lang-es', 'lang-pt', 'lang-ru'];
const FEATURE_LANGS = ['lang-cn', 'lang-en', 'lang-jp', 'lang-kr', 'lang-yue', 'lang-de', 'lang-fr', 'lang-it', 'lang-es', 'lang-pt', 'lang-ru', 'lang-in', 'lang-ar', 'lang-vn'];
function languages(h) {
  const { dom, settle, closeAll, val } = h;
  const k = async (p, key, extra) => { await dom(p, `[data-k="${key}"]${extra || ''}`); await settle(p, 200); };
  const lang = async (p, id) => { await dom(p, `[data-k="lang"][data-lang="${id}"]`); await settle(p, 250); };
  const fsrs = (due) => ({ stability: 3, difficulty: 5, reps: 2, lapses: 0, lastReview: NOW - 2 * DAY, dueAt: NOW + due, srsIdx: 1 });
  const cats = { 'lang-en': ['ทักทายและแนะนำตัว', 'การเดินทางและร้านอาหาร', 'การทำงานและสัมภาษณ์งาน'] };
  const seed = {
    'lang-practice:xp': '1250',
    'lang-practice:streak': { count: 5, longest: 12, lastDate: '2026-10-02' },
    'lang-practice:progress': { 'lang-en:ทักทายและแนะนำตัว': Array(12).fill(true), 'lang-en:การเดินทางและร้านอาหาร': [true, true, false, true], 'lang-jp:ทักทายและแนะนำตัว': Array(12).fill(true) },
    'lang-practice:notes': { 'lang-en': { text: 'Remember: the past tense of go is went', updatedAt: NOW - DAY } },
    'lang-practice:wrong': { 'lang-en::ทักทายและแนะนำตัว::1': { langId: 'lang-en', cat: 'ทักทายและแนะนำตัว', idx: 1, count: 3, last: NOW - DAY }, 'lang-jp::ทักทายและแนะนำตัว::0': { langId: 'lang-jp', cat: 'ทักทายและแนะนำตัว', idx: 0, count: 1, last: NOW - 2 * DAY } },
    'lang-practice:srs': { 'lang-en::vocab-คำศัพท์พื้นฐาน::0': fsrs(10 * DAY), 'lang-en::vocab-คำศัพท์พื้นฐาน::1': fsrs(-DAY), 'lang-en::vocab-คำศัพท์พื้นฐาน::2': fsrs(-2 * DAY), 'lang-jp::vocab-คำศัพท์พื้นฐาน::0': fsrs(-DAY) },
    'lang-practice:writing': [
      { id: 'w1', langId: 'lang-en', subMode: 'compose', prompt: '', userText: 'I goed to school', feedback: 'ประโยคที่แก้แล้ว: I went to school', grade: null, xpAwarded: 15, createdAt: NOW - DAY }
    ]
  };
  const exp = async (p, fn, arg) => p.evaluate(fn, arg);
  // เล่นข้อสอบให้จบเร็วๆ — คลิกตัวเลือกแรก/ปุ่มถัดไปจนเจอหน้าผล (ข้ามข้อเขียน AI + กดฝึกพูดเสร็จ)
  const finishExam = async (p) => {
    await exp(p, async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const q = (s) => { const el = document.querySelector(s); return el && el.offsetParent !== null ? el : null; };
      let idle = 0;
      for (let g = 0; g < 1200 && idle < 6; g++) {
        const step = q('[data-k=restart]') ? 'end' : null;
        if (step === 'end') break;
        const el = q('[data-k=sectionStart]') || q('[data-k=skipEssay]') || q('[data-k=speakDone]') || q('[data-k=nextQ]');
        if (el) { el.click(); idle = 0; await sleep(0); continue; }
        const chunks = [...document.querySelectorAll('[data-k=chunk]')].filter((b) => b.offsetParent !== null);
        if (chunks.length) { chunks.forEach((b) => b.click()); await sleep(0); const sb = q('[data-k=submitOrder]'); if (sb) sb.click(); idle = 0; await sleep(0); continue; }
        const c = q('[data-k=choice]:not([aria-disabled=true])') || q('[data-k=tf]:not([aria-disabled=true])');
        if (c) { c.click(); idle = 0; await sleep(0); continue; }
        idle++; await sleep(30);
      }
    });
    await settle(p, 400);
  };
  const states = [['stream', async () => {}]];
  FEATURE_LANGS.forEach((id) => states.push([`feature-${id}`, async (p) => { await lang(p, id); await k(p, 'tab-stream'); await settle(p, 250); }]));
  states.push(
    ['stream-en', async (p) => { await lang(p, 'lang-en'); await k(p, 'tab-stream'); }],
    ['filter-hit', async (p) => { await val(p, '[data-k=langFilter]', 'จีน'); await settle(p, 300); }],
    ['filter-none', async (p) => { await val(p, '[data-k=langFilter]', 'zzzqqq'); await settle(p, 300); }],
    ['filter-clear', async (p) => { await val(p, '[data-k=langFilter]', ''); await settle(p, 300); }],
    ['drawer-open', async (p) => { await k(p, 'menu'); await settle(p, 400); }],
    ['drawer-close', async (p) => { await k(p, 'closeNav'); await settle(p, 400); }],
    // ฝึกฝน
    ['practice', async (p) => { await lang(p, 'lang-en'); await k(p, 'tab-practice'); }],
    ['practice-speak', async (p) => { await dom(p, '.btn.ghost.icon.sm[aria-label]'); await settle(p, 500); }],
    ['practice-category', async (p) => { await k(p, 'category', ':nth-child(2)'); }],
    ['practice-wrong', async (p) => { await val(p, '[data-k=answer]', 'zzz'); await k(p, 'check'); }],
    ['practice-next', async (p) => { await k(p, 'next'); }],
    ['practice-almost', async (p) => { const t = await exp(p, () => (document.querySelector('.border-brand.bg-brandLight .font-semibold') || {}).textContent || ''); await val(p, '[data-k=answer]', t.slice(0, -1)); await k(p, 'check'); }],
    ['practice-next2', async (p) => { await k(p, 'next'); }],
    ['practice-correct', async (p) => { const t = await exp(p, () => (document.querySelector('.border-brand.bg-brandLight .font-semibold') || {}).textContent || ''); await val(p, '[data-k=answer]', t); await k(p, 'check'); }],
    ['practice-next3', async (p) => { await k(p, 'next'); }],
    ['mode-dictation', async (p) => { await k(p, 'mode-dictation'); }],
    ['dictation-wrong', async (p) => { await val(p, '[data-k=answer]', 'qqq'); await k(p, 'check'); }],
    ['mode-flashcard', async (p) => { await k(p, 'mode-flashcard'); }],
    ['flashcard-flip', async (p) => { await k(p, 'flashcard'); }],
    ['flashcard-notyet', async (p) => { await k(p, 'notyet'); }],
    ['flashcard-flip2', async (p) => { await k(p, 'flashcard'); }],
    ['flashcard-remembered', async (p) => { await k(p, 'remembered'); }],
    ['mode-translate', async (p) => { await k(p, 'mode-translate'); }],
    ['note-type', async (p) => { await val(p, '[data-k=note]', 'Note written by the learner'); await settle(p, 200); }],
    ['note-write', async (p) => { await dom(p, '.segmented.shrink-0 button:nth-child(2)'); await settle(p, 300); }],
    ['note-ocr', async (p) => { await k(p, 'noteOcr'); await settle(p, 700); }],
    ['note-type-back', async (p) => { await dom(p, '.segmented.shrink-0 button:nth-child(1)'); await settle(p, 300); }],
    ['sync', async (p) => { await k(p, 'sync'); await settle(p, 600); }]
  );
  // ฝึกเขียน
  states.push(['writing-en', async (p) => { await k(p, 'writeLang', '[data-lang="lang-en"]'); await settle(p, 400); }]);
  states.push(['writing-en-reveal', async (p) => { await k(p, 'reveal'); }]);
  states.push(['writing-en-reading', async (p) => { await val(p, '[data-k=reading]', 'ei'); await k(p, 'checkReading'); }]);
  states.push(['writing-en-rate', async (p) => { await k(p, 'rate3'); }]);
  states.push(['writing-en-pool-word', async (p) => { await k(p, 'pool-word'); await k(p, 'reveal'); await k(p, 'rate1'); }]);
  states.push(['writing-en-compose', async (p) => { await k(p, 'sub-compose'); await val(p, 'textarea', 'I goed to school yesterday.'); }]);
  states.push(['writing-en-compose-write', async (p) => { await dom(p, 'main .segmented.mb-2 button:nth-child(2)'); await settle(p, 300); }]);
  states.push(['writing-en-compose-ocr', async (p) => { await k(p, 'runOcr'); await settle(p, 700); }]);
  states.push(['writing-en-compose-submit', async (p) => { await exp(p, () => { try { Object.defineProperty(navigator, 'userAgent', { get: () => 'iPhone' }); } catch (e) {} }); await k(p, 'aiSubmit'); await settle(p, 400); }]);
  states.push(['writing-en-srs-compose', async (p) => { await k(p, 'sub-srsCompose'); await settle(p, 300); }]);
  states.push(['writing-en-srs-compose-check', async (p) => { await val(p, 'textarea', 'hello world'); await k(p, 'checkUsage'); await settle(p, 300); await k(p, 'aiCheck'); await settle(p, 300); }]);
  states.push(['writing-en-dictation', async (p) => { await k(p, 'sub-dictation'); await settle(p, 300); }]);
  states.push(['writing-en-dictation-check', async (p) => { await val(p, '[data-k=dictInput]', 'zzz'); await k(p, 'dictCheck'); await settle(p, 300); }]);
  states.push(['writing-en-translate', async (p) => { await k(p, 'sub-translate'); await settle(p, 300); }]);
  states.push(['writing-en-translate-quick', async (p) => { await val(p, 'textarea', 'zzz'); await k(p, 'quick'); await settle(p, 300); await k(p, 'aiCheck'); await settle(p, 300); }]);
  states.push(['writing-picker', async (p) => { await k(p, 'pickLang'); await settle(p, 300); }]);
  states.push(['writing-picker-close', async (p) => { await k(p, 'pickLang'); }]);
  LANG_IDS.forEach((id) => states.push([`writing-${id}`, async (p) => { await k(p, 'pickLang'); await k(p, 'pickLangItem', `[data-lang="${id}"]`); await settle(p, 350); }]));
  ['lang-cn', 'lang-jp', 'lang-kr', 'lang-ru', 'lang-vn', 'lang-in', 'lang-ar', 'lang-de', 'lang-mm'].forEach((id) => {
    states.push([`script-${id}`, async (p) => { await k(p, 'pickLang'); await k(p, 'pickLangItem', `[data-lang="${id}"]`); await settle(p, 300); await k(p, 'reveal'); await settle(p, 350); }]);
    states.push([`script-${id}-rate`, async (p) => { await dom(p, '[data-k=rate2]'); await settle(p, 250); }]);
  });
  // ข้อสอบ
  const examGoto = async (p, id) => { await dom(p, `[data-k="lang"][data-lang="${id}"]`); await settle(p, 200); await k(p, 'tab-exam'); await settle(p, 300); };
  states.push(['exam-cn-type', async (p) => { await examGoto(p, 'lang-cn'); }]);
  states.push(['exam-cn-levels', async (p) => { await k(p, 'examType', ':nth-child(1)'); }]);
  states.push(['exam-cn-intro', async (p) => { await k(p, 'examLevel', ':nth-child(1)'); }]);
  states.push(['exam-cn-q', async (p) => { await k(p, 'sectionStart'); }]);
  states.push(['exam-cn-answered', async (p) => { await dom(p, '[data-k=tf]'); await dom(p, '[data-k=choice]'); await settle(p, 250); }]);
  states.push(['exam-cn-done', async (p) => { await finishExam(p); }]);
  states.push(['exam-cn-bct', async (p) => { await k(p, 'backLevels'); await settle(p, 200); await k(p, 'examLevel'); await k(p, 'sectionStart'); await finishExam(p); }]);
  states.push(['exam-en-type', async (p) => { await examGoto(p, 'lang-en'); }]);
  states.push(['exam-en-ielts-intro', async (p) => { await k(p, 'examType', ':nth-child(1)'); }]);
  states.push(['exam-en-ielts-q', async (p) => { await k(p, 'sectionStart'); }]);
  states.push(['exam-en-ielts-done', async (p) => { await finishExam(p); }]);
  states.push(['exam-en-toeic', async (p) => { await dom(p, '[data-k=restart]'); await settle(p, 200); await k(p, 'examType', ':nth-child(2)'); await settle(p, 200); await k(p, 'sectionStart'); await settle(p, 250); }]);
  states.push(['exam-en-toeic-done', async (p) => { await finishExam(p); }]);
  ['lang-jp', 'lang-kr', 'lang-yue', 'lang-de', 'lang-fr', 'lang-it', 'lang-es', 'lang-pt', 'lang-ru', 'lang-in', 'lang-ar', 'lang-vn', 'lang-my', 'lang-mm', 'lang-kh', 'lang-la'].forEach((id) => {
    states.push([`exam-${id}-start`, async (p) => { await examGoto(p, id); }]);
    states.push([`exam-${id}-intro`, async (p) => { await k(p, 'examStart'); }]);
    states.push([`exam-${id}-q`, async (p) => { await k(p, 'sectionStart'); }]);
    states.push([`exam-${id}-answered`, async (p) => { await dom(p, '[data-k=choice]'); await settle(p, 250); }]);
    states.push([`exam-${id}-done`, async (p) => { await finishExam(p); }]);
  });
  // ฟัง-พูด
  states.push(['listen-en', async (p) => { await lang(p, 'lang-en'); await k(p, 'tab-listen'); await settle(p, 400); }]);
  states.push(['listen-passage', async (p) => { await dom(p, 'main .stat-card'); await settle(p, 300); }]);
  states.push(['listen-reveal', async (p) => { await dom(p, 'main .btn.ghost.sm.shrink-0:not(.icon)'); await settle(p, 250); }]);
  states.push(['listen-quiz', async (p) => { await dom(p, 'main .btn.primary.lg.w-full'); await settle(p, 300); }]);
  states.push(['listen-answer', async (p) => { await exp(p, () => document.querySelectorAll('[data-k=choice]').forEach((b, i) => { if (i % 3 === 0) b.click(); })); await settle(p, 250); await dom(p, 'main .btn.primary.lg.w-full'); await settle(p, 300); }]);
  states.push(['listen-shadowing', async (p) => { await k(p, 'lsub-shadowing'); await settle(p, 400); }]);
  states.push(['listen-reading', async (p) => { await k(p, 'lsub-reading'); await settle(p, 400); }]);
  states.push(['reading-passage', async (p) => { await dom(p, 'main .stat-card'); await settle(p, 300); }]);
  states.push(['listen-numbers', async (p) => { await k(p, 'lsub-numbers'); await settle(p, 400); }]);
  states.push(['numbers-cat', async (p) => { await dom(p, 'main .chip:nth-of-type(2)'); await settle(p, 300); }]);
  states.push(['numbers-answer', async (p) => { await dom(p, '[data-k=choice]'); await settle(p, 250); }]);
  states.push(['numbers-finish', async (p) => { await exp(p, async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); for (let g = 0; g < 80; g++) { const c = document.querySelector('[data-k=choice]:not([aria-disabled=true])'); if (c) { c.click(); await sleep(0); } const n = [...document.querySelectorAll('main .btn.primary')].pop(); if (n && /choice|button/.test(n.tagName.toLowerCase()) && document.querySelector('[data-k=choice][aria-disabled=true]')) { n.click(); await sleep(0); } if (!document.querySelector('[data-k=choice]')) break; } }); await settle(p, 400); }]);
  LANG_IDS.slice(0, 0);
  states.push(['final', async (p) => { await closeAll(p); await settle(p, 200); }]);
  return {
    page: 'languages.html',
    seed,
    user: /^\s*$/,
    overlay: 'aside.translate-x-0',
    init: 'window.google = undefined; window.Tesseract = {}; window.HanziWriter = { create: function () { return { animateCharacter: function () {}, quiz: function (o) { window.__hwQuiz = o; } }; } }; window.TanotFileReader = Object.assign(window.TanotFileReader || {}, { recognizeText: function () { return Promise.resolve("handwritten text"); }, preprocessForOcr: function (c) { return c; }, PSM_SINGLE_LINE: 7 });',
    ignoreErrors: /accounts\.google\.com|gsi\/client|ERR_INTERNET_DISCONNECTED|Failed to load resource|cdn\.jsdelivr\.net|tesseract|hanzi/i,
    states
  };
}

const ALLOW = [];

function targets(h) {
  return [legal(h), sim(h), languages(h)];
}
module.exports = { targets, ALLOW, NOW };
