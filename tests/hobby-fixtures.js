// ข้อมูลตัวอย่าง + สถานะที่เปิดของ hobby-audit.spec.js (งานแก้ธีม รอบ 7B: งานอดิเรก + ตั้งค่า)
//   music · sports · cooking · coding · typing · image-gen · notifications · data · credits
// targets(h) คืน [{ page, seed, init, route, wait, user, skipSel, overlay, states, ignoreErrors }] — โครงเดียวกับ edu-fixtures.js
// ทุก selector ในสถานะต้องไม่พึ่งข้อความไทย (spec รันซ้ำด้วย ome:lang=en) — ใช้ id / class / data-*
const ALLOW = [];
const NOW = new Date('2026-10-03T03:00:00Z').getTime();
const DAY = 86400000;

/* ───────── หน้าเรียนแบบแทร็ก (music · sports · cooking · coding) ───────── */
const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** เติมความคืบหน้าทุกบท + XP/สตรีค/เหรียญตรา แล้วโหลดหน้าใหม่ — ใช้ฟังก์ชัน global ของหน้า (TRACKS/progressKey/saveProgress) */
function lessonWait(prefix, opts) {
  return async (p) => {
    await p.evaluate(([prefix, opts]) => {
      const prog = {};
      TRACKS.forEach((tr, ti) => {
        const n = opts.coding ? tr.exercises.length + 1 : tr.items.length;
        for (let i = 0; i < n; i++) if (opts.leave == null || ti !== opts.leave.track || i < opts.leave.item) prog[progressKey(tr.id, i)] = 1;
      });
      saveProgress(prog);
      localStorage.setItem('tanot:' + prefix + ':xp', '1450');
      localStorage.setItem('tanot:' + prefix + ':streak', JSON.stringify({ count: 9, lastDate: '2026-10-03' }));
      localStorage.setItem('tanot:' + prefix + ':badges', JSON.stringify(typeof BADGE_DEFS !== 'undefined' ? BADGE_DEFS.map((b) => b.id) : []));
    }, [prefix, opts || {}]);
    await p.reload({ waitUntil: 'load' });
    await p.waitForSelector('nav.ome-nav', { timeout: 30000 });
    await p.waitForTimeout(600);
  };
}

/** เลือกแทร็กที่ index (จากรายการในเมนู) */
const pickTrack = (h, idx) => async (p) => {
  await h.dom(p, '#trackMenuBtn'); await h.settle(p, 150);
  await p.evaluate((i) => { document.querySelectorAll('#trackMenuPanel button')[i].click(); }, idx);
  await h.settle(p, 250);
};
const pickItem = (h, j) => async (p) => {
  await p.evaluate((i) => { const b = document.querySelectorAll('#itemList > button')[i]; if (b) b.click(); }, j);
  await h.settle(p, 250);
};

function lessonStates(h, tracks, itemsOf) {
  const states = [['base', async () => {}], ['menu-open', async (p) => { await h.dom(p, '#trackMenuBtn'); await h.settle(p, 200); }]];
  tracks.forEach((ti) => {
    states.push([`track-${ti}`, pickTrack(h, ti)]);
    (itemsOf(ti) || [1]).forEach((j) => states.push([`track-${ti}-item-${j}`, pickItem(h, j)]));
  });
  states.push(['menu-open-2', async (p) => { await h.dom(p, '#trackMenuBtn'); await h.settle(p, 200); }]);
  states.push(['close', async (p) => { await p.mouse.click(5, 300).catch(() => {}); await h.settle(p, 150); }]);
  return states;
}

function music(h) {
  const states = lessonStates(h, [0, 3, 5, 6, 7, 8, 10, 11, 12, 14], () => [0, 1, 2]);
  // ตอบโจทย์ผิด/ถูก (ปุ่มแรก/ปุ่มสุดท้าย — อย่างน้อยหนึ่งผิด หนึ่งถูก) บนแทร็กเปียโน + กีตาร์
  states.push(['quiz-answer', async (p) => {
    await pickTrack(h, 7)(p); await pickItem(h, 1)(p);
    for (const pos of ['first', 'last']) {
      await p.evaluate((w) => { const b = document.querySelectorAll('#answerRow button'); if (b.length) (w === 'first' ? b[0] : b[b.length - 1]).click(); }, pos);
      await h.settle(p, 250);
    }
  }]);
  states.push(['mark-read', async (p) => { await pickTrack(h, 0)(p); await h.dom(p, '#markReadBtn'); await h.settle(p, 300); }]);
  return { page: 'music.html', overlay: '#trackMenuPanel.open', wait: lessonWait('music'), states };
}

function sports(h) {
  const log = [
    { id: 'sports:w1', at: NOW - 2 * 3600e3, date: '2026-10-03', kind: 'วิ่ง', minutes: 35, kcal: 320, distanceKm: 5.2, source: 'sports', ref: 'w1' },
    { id: 'sports:w2', at: NOW - DAY, date: '2026-10-02', kind: 'Football', minutes: 60, kcal: 540, source: 'sports', ref: 'w2' },
    { id: 'sports:w3', at: NOW - 2 * DAY, date: '2026-10-01', kind: 'Pickleball', minutes: 45, source: 'sports', ref: 'w3' }
  ];
  const states = lessonStates(h, [0, 1, 2, 4], () => [0, 1, 2, 3]);
  states.push(['log-edit', async (p) => { await p.evaluate(() => document.querySelector('#logList .list-row').click()); await h.settle(p, 300); }]);
  states.push(['log-error', async (p) => { await p.fill('#logMin', ''); await h.dom(p, '#logSave'); await h.settle(p, 250); }]);
  states.push(['log-other', async (p) => { await p.selectOption('#logKind', 'other').catch(() => {}); await h.settle(p, 250); }]);
  states.push(['log-cancel', async (p) => { await h.dom(p, '#logCancel'); await h.settle(p, 250); }]);
  return {
    page: 'sports.html', overlay: '#trackMenuPanel.open',
    seed: { 'tanot:health:workouts': log, 'tanot:health:vitals': [{ id: 'v1', at: NOW - DAY, date: '2026-10-02', kind: 'weight', value: 70 }] },
    wait: lessonWait('sports'), states
  };
}

function codingProgress() {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'coding.js'), 'utf8');
  const a = src.indexOf('var TRACKS = ['), b = src.indexOf('\n];', a) + 3;
  const TR = new Function(src.slice(a, b) + '; return TRACKS;')(), prog = {};
  TR.forEach((tr) => { for (let i = 0; i <= tr.exercises.length; i++) prog[tr.id + '::' + i] = 1; });
  return prog;
}

function coding(h) {
  const states = lessonStates(h, [0, 6, 11, 19], () => [0, 1, 2]);
  states.push(['run-js', async (p) => { await pickTrack(h, 0)(p); await pickItem(h, 1)(p); await h.dom(p, '#runBtn'); await h.settle(p, 900); }]);
  states.push(['run-html', async (p) => { await pickTrack(h, 6)(p); await pickItem(h, 1)(p); await h.dom(p, '#runBtn'); await h.settle(p, 900); }]);
  return {
    page: 'coding.html', overlay: '#trackMenuPanel.open', states,
    seed: { 'tanot:coding:progress': codingProgress(), 'tanot:coding:xp': '1450', 'tanot:coding:streak': { count: 9, lastDate: '2026-10-03' } },
    ignoreErrors: /Failed to read the 'serviceWorker'|codemirror|Failed to load resource/
  };
}

function cooking(h) {
  const WEEK = '2026-09-28';
  const ing = (name, qty, unit, cat) => ({ name, qty, unit, cat });
  const recipes = [
    { id: 'r1', name: 'Pad Kra Pao', servings: 2, ingredients: [ing('Chicken mince', 300, 'g', 'meat'), ing('Holy basil', 1, 'cup', 'veg'), ing('Soy sauce', 2, 'tbsp', 'sauce'), ing('Rice', 400, 'g', 'dry')], steps: ['Stir-fry garlic and chilli.', 'Add chicken and sauces.', 'Toss in basil.'], tags: ['quick', 'spicy'], photo: null, createdAt: NOW - 9 * DAY, updatedAt: NOW - 9 * DAY },
    { id: 'r2', name: 'Omelette Rice', servings: 1, ingredients: [ing('Egg', 3, 'pcs', 'meat'), ing('Rice', 200, 'g', 'dry'), ing('Ketchup', 1, 'tbsp', 'sauce')], steps: ['Beat eggs.', 'Cook and serve over rice.'], tags: ['breakfast'], photo: null, createdAt: NOW - 8 * DAY, updatedAt: NOW - 8 * DAY },
    { id: 'r3', name: 'Green Salad', servings: 2, ingredients: [ing('Lettuce', 1, 'head', 'veg'), ing('Tomato', 2, 'pcs', 'veg'), ing('Olive oil', 1, 'tbsp', 'sauce')], steps: ['Chop and toss.'], tags: ['light'], photo: null, createdAt: NOW - 7 * DAY, updatedAt: NOW - 7 * DAY }
  ];
  const plan = { id: 'week-' + WEEK, week: WEEK, slots: {
    '0:b': { recipeId: 'r2', servings: 1 }, '0:l': { recipeId: 'r3', servings: 2 }, '0:d': { recipeId: 'r1', servings: 2 },
    '1:l': { recipeId: 'r1', servings: 2 }, '2:d': { recipeId: 'r3', servings: 2 }, '4:b': { recipeId: 'r2', servings: 1 }, '5:d': { recipeId: 'r1', servings: 4 }
  }, done: { '0:b': NOW - 5 * DAY }, awarded: { '0:b': NOW - 5 * DAY }, updatedAt: NOW - DAY };
  const shop = { id: 'shop-' + WEEK, week: WEEK, name: 'Week', lines: [
    { id: 'l1', name: 'Chicken mince', qty: 900, unit: 'g', cat: 'meat' }, { id: 'l2', name: 'Rice', qty: 1.2, unit: 'kg', cat: 'dry' },
    { id: 'l3', name: 'Lettuce', qty: 2, unit: 'head', cat: 'veg' }, { id: 'l4', name: 'Soy sauce', qty: 6, unit: 'tbsp', cat: 'sauce' }, { id: 'l5', name: 'Egg', qty: 6, unit: 'pcs', cat: 'meat' }
  ], createdAt: NOW - DAY, updatedAt: NOW - DAY };
  const ticks = { id: 'shop-' + WEEK + '|t|dev1', kind: 'ticks', listId: 'shop-' + WEEK, dev: 'dev1', lines: { l1: { c: [true, NOW], p: [120, NOW] }, l2: { p: [65, NOW] }, l3: { c: [true, NOW] } } };
  const tab = (m) => async (p) => { await h.dom(p, `#planTabs [data-mode="${m}"]`); await h.settle(p, 350); };
  const act = (a, extra) => async (p) => { await p.evaluate(([a, extra]) => { const e = document.querySelector(`#planRoot [data-act="${a}"]${extra || ''}`); if (e) e.click(); }, [a, extra]); await h.settle(p, 350); };
  const closeDlg = async (p) => { await h.closeAll(p); await h.settle(p, 200); };
  const states = lessonStates(h, [0, 1], () => [0, 1, 2]);
  states.push(['conv-open', async (p) => { await h.dom(p, '#convBtn'); await h.settle(p, 250); }]);
  states.push(['conv-edit', async (p) => { await p.fill('#convVolIn', '3').catch(() => {}); await h.settle(p, 200); }]);
  states.push(['conv-close', async (p) => { await p.mouse.click(5, 300).catch(() => {}); await h.settle(p, 150); }]);
  states.push(['step-mode', async (p) => { await h.dom(p, '#stepModeBtn'); await h.settle(p, 300); await h.dom(p, '#stepNextBtn'); await h.settle(p, 250); }]);
  states.push(['step-off', async (p) => { await h.dom(p, '#stepModeBtn'); await h.settle(p, 250); }]);
  states.push(['notes', async (p) => { await p.fill('#notesBox', 'Use less salt next time.'); await h.settle(p, 700); }]);
  states.push(['mark-read', async (p) => { await h.dom(p, '#markReadBtn'); await h.settle(p, 300); }]);
  states.push(['tab-recipes', tab('recipes')]);
  states.push(['recipes-filter', async (p) => { await p.fill('#cpQ', 'rice').catch(() => {}); await h.settle(p, 250); await p.fill('#cpQ', '').catch(() => {}); await h.settle(p, 200); }]);
  states.push(['recipes-none', async (p) => { await p.fill('#cpQ', 'zzzzzz').catch(() => {}); await h.settle(p, 250); await p.fill('#cpQ', '').catch(() => {}); await h.settle(p, 200); }]);
  states.push(['recipe-edit', async (p) => { await p.evaluate(() => document.querySelector('#planRoot [data-act="edit"][data-id="r1"]').click()); await h.settle(p, 400); }]);
  states.push(['recipe-ing-add', async (p) => { await h.dom(p, '#rAddIng'); await h.settle(p, 250); }]);
  states.push(['recipe-error', async (p) => { await p.fill('#rName', ''); await h.dom(p, '#rSave'); await h.settle(p, 300); }]);
  states.push(['recipe-close', closeDlg]);
  states.push(['recipe-new-paste', async (p) => { await act('addPaste')(p); await p.fill('#rPaste', 'Fried egg: 2 eggs, 1 tbsp oil. Heat oil, fry eggs.'); await h.dom(p, '#rParse'); await h.settle(p, 500); }]);
  states.push(['recipe-new-close', closeDlg]);
  states.push(['tab-plan', tab('plan')]);
  states.push(['plan-slot', async (p) => { await p.evaluate(() => document.querySelector('#planRoot [data-act="slot"][data-slot="0:l"]').click()); await h.settle(p, 400); }]);
  states.push(['plan-slot-close', closeDlg]);
  states.push(['plan-empty-slot', async (p) => { await p.evaluate(() => document.querySelector('#planRoot [data-act="slot"][data-slot="3:b"]').click()); await h.settle(p, 400); }]);
  states.push(['plan-empty-close', closeDlg]);
  states.push(['plan-done', async (p) => { await p.evaluate(() => document.querySelector('#planRoot [data-act="done"][data-slot="0:l"]').click()); await h.settle(p, 3200); }]);
  states.push(['plan-undone', async (p) => { await p.evaluate(() => document.querySelector('#planRoot [data-act="done"][data-slot="0:l"]').click()); await h.settle(p, 400); }]);
  states.push(['plan-prev-week', async (p) => { await act('wprev')(p); }]);
  states.push(['plan-next-week', async (p) => { await act('wnext')(p); }]);
  states.push(['plan-fill', async (p) => { await act('fill')(p); }]);
  states.push(['tab-shop', tab('shop')]);
  states.push(['shop-add', async (p) => { await p.fill('#aName', 'Lime'); await p.fill('#aQty', '4'); await p.fill('#aUnit', 'pcs'); await act('addItem')(p); }]);
  states.push(['shop-tick', async (p) => { await p.evaluate(() => document.querySelector('#planRoot [data-act="tick"]').click()); await h.settle(p, 350); }]);
  states.push(['shop-price', async (p) => { await p.evaluate(() => { const e = document.querySelector('#planRoot [data-act="price"]'); e.value = '88'; e.dispatchEvent(new Event('change', { bubbles: true })); }); await h.settle(p, 300); }]);
  states.push(['shop-budget', async (p) => { await act('budget')(p); }]);
  states.push(['shop-delete-asks', async (p) => { p.once('dialog', (d) => d.dismiss()); await act('delShop')(p); }]);
  states.push(['shop-next-week-empty', async (p) => { await act('wnext')(p); }]);
  states.push(['tab-lessons', tab('')]);
  return {
    page: 'cooking.html', overlay: '#trackMenuPanel.open, #convPanel.open', wait: lessonWait('cooking'), states,
    init: 'window.TANOT_FILES = { enabled: true }; window.TANOT_AI = { enabled: false };',
    seed: {
      'tanot:cooking:recipes': recipes, 'tanot:cooking:plans': [plan], 'tanot:cooking:shopping': [shop, ticks],
      'budget:categories': [{ id: 'c1', name: 'Food', type: 'expense', color: 'chart-1' }],
      'tanot:cooking:notes': {}
    }
  };
}

function typing(h) {
  const T = require('../typing.js');
  const prog = {};
  T.TRACKS.forEach((tr, ti) => tr.lessons.forEach((l, i) => { if (i < tr.lessons.length - 1 && ti % 3 !== 2) prog[tr.id + '::' + i] = { wpm: 28 + ti * 3 + i, acc: 92 - i, at: NOW - i * DAY }; }));
  const tab = (i) => async (p) => { await p.evaluate((k) => document.querySelectorAll('#trackTabs button')[k].click(), i); await h.settle(p, 300); };
  const lesson = (i) => async (p) => { await p.evaluate((k) => { const b = document.querySelectorAll('#lessonList button')[k]; if (b) b.click(); }, i); await h.settle(p, 300); };
  const typeText = (frac, wrong) => async (p) => {
    const txt = await p.evaluate(() => [...document.querySelectorAll('#practiceText .tt-char')].map((e) => e.textContent).join(''));
    await p.click('#practiceArea'); await h.settle(p, 100);
    const n = frac >= 1 ? txt.length : Math.max(1, Math.floor(txt.length * frac));
    if (wrong) await p.keyboard.type('~', { delay: 0 });
    await p.keyboard.type(txt.slice(0, n), { delay: 0 });
    await h.settle(p, 300);
  };
  const states = [['base', async () => {}]];
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].forEach((i) => {
    states.push([`tab-${i}`, tab(i)]);
    states.push([`tab-${i}-lesson-1`, lesson(1)]);
  });
  states.push(['locked-lesson', async (p) => { await tab(0)(p); await p.evaluate(() => { const b = [...document.querySelectorAll('#lessonList button')].find((x) => x.classList.contains('locked')); if (b) b.click(); }); await h.settle(p, 300); }]);
  states.push(['fingers-off', async (p) => { await p.evaluate(() => document.getElementById('fingerColorToggle').click()); await h.settle(p, 250); }]);
  states.push(['fingers-on', async (p) => { await p.evaluate(() => document.getElementById('fingerColorToggle').click()); await h.settle(p, 250); }]);
  states.push(['typing-partial', async (p) => { await tab(0)(p); await lesson(0)(p); await typeText(0.4, true)(p); }]);
  states.push(['typing-shift', async (p) => { await tab(8)(p); await lesson(0)(p); await typeText(0.3, false)(p); }]);
  states.push(['typing-thai', async (p) => { await tab(4)(p); await lesson(0)(p); await typeText(0.4, false)(p); }]);
  states.push(['finish', async (p) => { await tab(0)(p); await lesson(0)(p); await typeText(1, false)(p); await h.settle(p, 500); }]);
  states.push(['finish-retry', async (p) => { await h.dom(p, '#retryBtn'); await h.settle(p, 300); }]);
  states.push(['finish-again', async (p) => { await typeText(1, true)(p); await h.settle(p, 500); }]);
  states.push(['finish-next', async (p) => { await h.dom(p, '#nextBtn'); await h.settle(p, 300); }]);
  states.push(['sprint-en', async (p) => { await h.dom(p, '#sprintEnBtn'); await h.settle(p, 300); await p.click('#practiceArea'); await p.keyboard.type('the of and', { delay: 0 }); await h.settle(p, 300); }]);
  states.push(['sprint-th', async (p) => { await h.dom(p, '#sprintThBtn'); await h.settle(p, 300); }]);
  states.push(['back-to-lesson', async (p) => { await tab(0)(p); await lesson(0)(p); }]);
  return {
    page: 'typing.html', states,
    seed: { 'tanot:typing:progress': prog, 'tanot:typing:sprint': { en: { wpm: 44, acc: 95, at: NOW - DAY }, th: { wpm: 31, acc: 90, at: NOW - 2 * DAY } } }
  };
}

function imageGen(h) {
  const items = [];
  const presets = ['background', 'icon', 'free'];
  for (let i = 0; i < 7; i++) {
    const preset = presets[i % 3];
    items.push({ id: 'img' + i, preset, mode: preset === 'background' ? (i % 2 ? 'dark' : 'light') : null, model: i % 2 ? 'quality' : 'fast', modelId: 'flux', seed: 100 + i,
      prompt: 'Calm mountain lake at dawn, soft light ' + i, fullPrompt: 'Calm mountain lake at dawn, soft light ' + i + ', wide composition, quiet mood', name: 'img' + i + '.png', mime: 'image/png', w: 1024, h: preset === 'background' ? 576 : 1024, createdAt: NOW - i * 3600e3 });
  }
  const PNG = Buffer.from(pngB64, 'base64');
  const route = async (page) => {
    await page.route('**/api/**', (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === '/api/files') return route.request().method() === 'DELETE' ? route.fulfill({ status: 200, body: '{}' }) : route.fulfill({ contentType: 'image/png', body: PNG });
      if (u.pathname === '/api/ai/usage') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ day: '2026-10-03', limit: 10000, used: 8200, remaining: 1800, byKind: [] }) });
      if (u.pathname === '/api/ai/image') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'img-new' + Date.now(), name: 'n.png', mime: 'image/png', size: 70, model: 'flux', seed: 5, width: 1024, height: 576, preset: 'background', mode: 'light', prompt: 'x, full' }) });
      if (u.pathname === '/api/ai/chat') return route.fulfill({ contentType: 'text/event-stream', body: 'data:{"t":"A calm lake at dawn"}\n\ndata:{"done":true}\n\n' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
  };
  const seg = (id, v) => async (p) => { await p.evaluate(([id, v]) => document.querySelector('#' + id + ' [data-v="' + v + '"]').click(), [id, v]); await h.settle(p, 250); };
  const states = [
    ['base', async () => {}],
    ['preset-icon', seg('preset', 'icon')], ['preset-free', seg('preset', 'free')], ['preset-bg', seg('preset', 'background')],
    ['mode-both', seg('mode', 'both')], ['model-quality', seg('model', 'quality')], ['count-3', seg('count', '3')],
    ['filter-icon', seg('filter', 'icon')], ['filter-all', seg('filter', 'all')],
    ['translate', async (p) => { await p.fill('#prompt', 'ทะเลสาบยามเช้า'); await h.dom(p, '#trBtn'); await h.settle(p, 500); }],
    ['generate', async (p) => { await p.fill('#prompt', 'A quiet lake'); await h.dom(p, '#genBtn'); await h.settle(p, 900); }],
    ['empty-prompt', async (p) => { await p.fill('#prompt', ''); await h.dom(p, '#genBtn'); await h.settle(p, 300); }],
    ['view', async (p) => { await p.evaluate(() => document.querySelector('#grid .ig-item').click()); await h.settle(p, 400); }],
    ['view-close', async (p) => { await h.dom(p, '#vClose'); await h.settle(p, 250); }],
    ['view-again', async (p) => { await p.evaluate(() => document.querySelector('#grid .ig-item').click()); await h.settle(p, 300); await h.dom(p, '#vAgain'); await h.settle(p, 300); }],
    ['view-delete', async (p) => { await p.evaluate(() => document.querySelector('#grid .ig-item').click()); await h.settle(p, 300); await h.dom(p, '#vDel'); await h.settle(p, 400); }],
    ['confirm-ok', async (p) => { await p.evaluate(() => { const b = [...document.querySelectorAll('dialog[open] .btn.danger, dialog[open] .btn.primary')].pop(); if (b) b.click(); }); await h.settle(p, 900); }]
  ];
  return {
    page: 'image-gen.html', overlay: '', route, states,
    init: 'window.TANOT_AI = { enabled: true };',
    seed: { 'tanot:images:items': items },
    user: /Calm mountain|A quiet lake|A calm lake/
  };
}

function notifications(h) {
  const items = [
    { id: 'a', source: 'insurance', title: 'ประกันรถยนต์ใกล้ต่ออายุ', body: 'Policy 123', url: 'insurance.html', due_at: NOW + 3 * DAY, kind: 'push', sent_at: null },
    { id: 'b', source: 'tax', title: 'Tax filing deadline', body: '', url: 'tax.html', due_at: NOW + 9 * DAY, kind: 'push', sent_at: NOW - DAY },
    { id: 'c', source: 'maintenance', title: 'PM digest', body: '3 due', url: 'maintenance.html', due_at: NOW + DAY, kind: 'digest', sent_at: null },
    { id: 'd', source: 'car', title: 'Car tax', body: '', url: 'car.html', due_at: NOW + 20 * DAY, kind: 'push', sent_at: null }
  ];
  const set = (st, list, listErr) => async (p) => {
    await p.evaluate(([st, list, listErr]) => {
      const P = window.TanotPush;
      P.state = () => Promise.resolve(st);
      P.listReminders = () => (listErr ? Promise.reject(Object.assign(new Error('x'), { code: listErr })) : Promise.resolve(list));
      document.dispatchEvent(new Event('visibilitychange'));
    }, [st, list, listErr || '']);
    await h.settle(p, 400);
  };
  const OFF = { support: 'ok', permission: 'default', subscribed: false, vapid: 'ok', subs: 1, lastOkAt: NOW - DAY };
  const ON = { support: 'ok', permission: 'granted', subscribed: true, vapid: 'ok', subs: 2, lastOkAt: NOW - 3600e3 };
  const stub = (fn) => async (p) => { await p.evaluate(fn); };
  return {
    page: 'notifications.html', init: 'window.TANOT_PUSH = { enabled: true };',
    skipSel: '#ntList',
    states: [
      ['base', async () => {}],
      ['off', set(OFF, items)],
      ['on-click', async (p) => {
        await p.evaluate(() => { window.TanotPush.subscribe = () => Promise.resolve(); });
        await h.dom(p, '#ntOn'); await h.settle(p, 500);
      }],
      ['on', set(ON, items)],
      ['test', async (p) => { await p.evaluate(() => { window.TanotPush.test = () => Promise.resolve({ sent: 1 }); }); await h.dom(p, '#ntTest'); await h.settle(p, 500); }],
      ['test-fail', async (p) => { await p.evaluate(() => { window.TanotPush.test = () => Promise.resolve({ sent: 0 }); }); await h.dom(p, '#ntTest'); await h.settle(p, 500); }],
      ['off-click', async (p) => { await p.evaluate(() => { window.TanotPush.unsubscribe = () => Promise.resolve(); }); await h.dom(p, '#ntOff'); await h.settle(p, 500); }],
      ['empty', set(ON, [])],
      ['ios', set({ support: 'ios-install' }, [])],
      ['denied', set({ support: 'denied' }, [])],
      ['browser', set({ support: 'browser' }, [])],
      ['vapid', set(Object.assign({}, OFF, { vapid: 'missing' }), items)],
      ['state-error', set(Object.assign({}, OFF, { error: 'offline' }), items, 'auth')],
      ['reminders-offline', set(ON, items, 'offline')],
      ['back', set(ON, items)]
    ]
  };
}

function data(h) {
  const status = (d) => async (p) => { await p.evaluate((d) => window.dispatchEvent(new CustomEvent('tanot:sync-status', { detail: d })), d); await h.settle(p, 300); };
  const historyRows = [
    { at: NOW - DAY, key: 'tanot:notes:one', id: 'tanot:notes:one', data: 'Local value that was replaced by another device ' + 'x'.repeat(60), reason: 'replaced-by-remote' },
    { at: NOW - 2 * DAY, key: 'tanot:books:items', id: 'b1', data: '{"title":"Atomic Habits"}', reason: 'replaced-by-remote' }
  ];
  const route = async (page) => {
    await page.route('**/api/sync**', (route) => route.fulfill({ contentType: 'application/json', body: route.request().method() === 'GET' ? '{"docs":[],"rev":0,"max":0,"more":false}' : '{"results":[],"rejected":[]}' }));
  };
  const importFile = (mutate) => async (p) => {
    await p.evaluate(async (mutate) => {
      const snap = await window.TanotData.snapshot();
      snap.ls = snap.ls || {};
      const keys = Object.keys(snap.ls);
      if (keys.length) snap.ls[keys[0]] = typeof snap.ls[keys[0]] === 'string' ? snap.ls[keys[0]] + ' (imported)' : snap.ls[keys[0]];
      snap.ls['tanot:audit:new'] = '{"a":1}';
      snap.ls['tanot:notes:one'] = 'Imported different value';
      const f = new File([JSON.stringify(snap)], 'tanot-backup.json', { type: 'application/json' });
      const dt = new DataTransfer(); dt.items.add(f);
      const inp = document.getElementById('dtFile'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
    }, mutate);
    await h.settle(p, 900);
  };
  return {
    page: 'data.html', route, init: 'window.TANOT_SYNC = { enabled: true };',
    seed: { 'tanot:notes:one': 'Local value', 'tanot:audit:keep': '{"k":1}' },
    skipSel: '#dtPlan .imp-key, #dtHistory .dt-key, .dt-key',
    wait: async (p) => {
      await p.evaluate((rows) => new Promise((res) => {
        const r = indexedDB.open('tanot-data', 1);
        r.onsuccess = () => { const tx = r.result.transaction('history', 'readwrite'); rows.forEach((x) => tx.objectStore('history').add(x)); tx.oncomplete = () => res(); };
        r.onerror = () => res();
      }), historyRows);
      await p.evaluate(() => window.dispatchEvent(new CustomEvent('tanot:data')));
      await h.settle(p, 500);
    },
    states: [
      ['base', async () => {}],
      ['status-ok', status({ state: 'ok', lastSyncAt: NOW - 600e3, pending: 3, lastError: '', skipped: [] })],
      ['status-syncing', status({ state: 'syncing', lastSyncAt: NOW - 600e3, pending: 0, lastError: '', skipped: ['tanot:big:key'] })],
      ['status-error', status({ state: 'error', lastSyncAt: 0, pending: 12, lastError: 'HTTP 500', skipped: [] })],
      ['status-offline', status({ state: 'offline', lastSyncAt: NOW - DAY, pending: 1, lastError: '', skipped: [] })],
      ['status-auth', status({ state: 'auth', lastSyncAt: NOW - DAY, pending: 1, lastError: '', skipped: [] })],
      ['sync-now', async (p) => { await h.dom(p, '#dtSyncNow'); await h.settle(p, 500); }],
      ['drive-list-empty', async (p) => { await p.evaluate(() => { window.DriveBackup = Object.assign(window.DriveBackup || {}, { lastBackupAt: () => 0, list: () => Promise.resolve([]) }); }); await h.dom(p, '#dtDriveList'); await h.settle(p, 400); }],
      ['drive-list', async (p) => { await p.evaluate(() => { DriveBackup.list = () => Promise.resolve([{ id: 'f1', name: 'tanot-backup-2026-10-02-dev1.json' }, { id: 'f2', name: 'tanot-backup-2026-10-01-dev1.json' }]); }); await h.dom(p, '#dtDriveList'); await h.settle(p, 400); }],
      ['drive-list-fail', async (p) => { await p.evaluate(() => { DriveBackup.list = () => Promise.reject(new Error('โหลด Google Identity Services ไม่ได้')); }); await h.dom(p, '#dtDriveList'); await h.settle(p, 400); }],
      ['drive-backup', async (p) => { await p.evaluate(() => { DriveBackup.backupNow = () => Promise.resolve({ name: 'tanot-backup-2026-10-03-dev1.json', keys: 42 }); }); await h.dom(p, '#dtDriveBackup'); await h.settle(p, 400); }],
      ['drive-backup-fail', async (p) => { await p.evaluate(() => { DriveBackup.backupNow = () => Promise.reject(new Error('quota')); }); await h.dom(p, '#dtDriveBackup'); await h.settle(p, 400); }],
      ['drive-last', async (p) => { await p.evaluate(([t]) => { DriveBackup.lastBackupAt = () => t; }, [NOW]); await h.settle(p, 100); }],
      ['import-plan', importFile()],
      ['import-all-incoming', async (p) => { await p.evaluate(() => { const b = document.querySelector('#dtPlan [data-act="all-incoming"]'); if (b) b.click(); }); await h.settle(p, 300); }],
      ['import-run', async (p) => { await p.evaluate(() => document.querySelector('#dtPlan [data-act="import"]').click()); await h.settle(p, 1200); }],
      ['history-restore', async (p) => { await p.evaluate(() => { const b = document.querySelector('#dtHistory button[data-n]'); if (b) b.click(); }); await h.settle(p, 600); }]
    ]
  };
}

function credits(h) {
  return { page: 'credits.html', skipSel: '', states: [['base', async () => {}], ['bottom', async (p) => { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await h.settle(p, 200); }]] };
}

module.exports = { targets(h) { return [music(h), sports(h), coding(h), cooking(h), typing(h), imageGen(h), notifications(h), data(h), credits(h)]; }, ALLOW, NOW };
