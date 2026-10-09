// ข้อมูลตัวอย่าง + สถานะที่เปิดของ edu-audit.spec.js (งานแก้ธีม รอบ 7A: การศึกษา)
//   review · books · classroom-law · classroom-business · classroom-engineering
// targets(h) คืน [{ page, seed, init, route, wait, user, skipSel, overlay, states }] — โครงเดียวกับ eng-fixtures.js
// ทุก selector ในสถานะต้องไม่พึ่งข้อความไทย (spec รันซ้ำด้วย ome:lang=en) — ใช้ id / data-k / data-act
const fs = require('fs');
const path = require('path');
const NOW = new Date('2026-10-03T03:00:00Z').getTime();
const DAY = 86400000;
const ROOT = path.resolve(__dirname, '..');

/* ───────── ข้อมูลหลักสูตรจริง (course-data ในหน้าห้องเรียน) — ใช้สร้างคิวทบทวนที่ review.js อ่านได้ ───────── */
function course(name) {
  const html = fs.readFileSync(path.join(ROOT, `classroom-${name}.html`), 'utf8');
  const m = /<script id="course-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  const c = JSON.parse(m[1]), out = [];
  Object.keys(c).forEach((subj) => {
    const v = c[subj];
    const topics = Array.isArray(v) ? v : Object.keys(v).map((id) => Object.assign({ id }, v[id]));
    topics.forEach((t) => out.push({ subj, id: t.id, title: t.title, quiz: t.quiz || [] }));
  });
  return out;
}
const BIZ = course('business'), ENG = course('engineering');
const quizKeys = (list, n) => {
  const keys = [];
  list.forEach((t) => t.quiz.forEach((q, i) => keys.push(`${t.subj}:${t.id}:${i}`)));
  return keys.slice(0, n);
};

/* ───────── ข้อมูลการเรียนรวม (XP / วันติดต่อกัน / ยอดเดิม) ───────── */
function xpRows() {
  const rows = [];
  const srcs = [['law', 'edu'], ['lang', 'edu'], ['biz', 'edu'], ['eng', 'edu'], ['books', 'edu'], ['music', 'hobby'], ['cooking', 'hobby']];
  for (let d = 0; d < 12; d++) {
    const day = new Date(NOW - d * DAY + 7 * 3600e3).toISOString().slice(0, 10);
    srcs.forEach(([src, area], i) => {
      if ((d + i) % 3 === 2) return;
      rows.push({ id: `${day}|dev1|${src}`, d: day, dev: 'dev1', area, src, xp: 10 + ((d * 7 + i * 11) % 60), n: 2 + (i % 4), ts: NOW - d * DAY });
    });
  }
  return rows;
}
const LEARN_SEED = {
  'tanot:learn:xp': xpRows(),
  'tanot:learn:settings': { goal: 100, rest: 2 },
  'lang-practice:xp': '420', 'lbe:business:xp': '1300', 'lbe:engineering:xp': '1450', 'tanot:music:xp': '120',
  'tanot:music:streak': { count: 3, longest: 5, lastDate: '2026-10-01' }
};

/* ───────── review.html ───────── */
function seedLawIdb(notes) {
  return new Promise((res, rej) => {
    const r = indexedDB.open('tanot-barprep', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('notes')) r.result.createObjectStore('notes', { keyPath: 'id' }); };
    r.onsuccess = () => {
      const tx = r.result.transaction('notes', 'readwrite');
      notes.forEach((n) => tx.objectStore('notes').put(n));
      tx.oncomplete = () => { r.result.close(); res(); };
      tx.onerror = () => rej(tx.error);
    };
    r.onerror = () => rej(r.error);
  });
}
const lawNotes = () => {
  const t0 = NOW;
  const fsrs = (stab, dueOff) => ({ stability: stab, difficulty: 5, reps: 3, lapses: 0, lastReview: t0 - 5 * DAY, srsIdx: 1, dueAt: t0 + dueOff });
  return [
    Object.assign({ id: 'n1', subj: 'ป.พ.พ. บรรพ 1', q: 'Section 149 juristic act', a: 'An intentional manifestation of will to create legal effect.', createdAt: t0 - 20 * DAY }, fsrs(0.8, -DAY)),
    Object.assign({ id: 'n2', subj: 'ป.พ.พ. บรรพ 1', q: 'Section 150 unlawful object', a: 'Void if the object is prohibited by law.', createdAt: t0 - 19 * DAY }, fsrs(3, -2 * DAY)),
    Object.assign({ id: 'n3', subj: 'ป.อ.', q: 'Section 288 murder', a: 'Intentionally killing another person.', createdAt: t0 - 18 * DAY }, fsrs(8, DAY)),
    Object.assign({ id: 'n4', subj: 'ป.วิ.พ.', q: 'Section 55 cause of action', a: 'Right to bring a claim.', createdAt: t0 - 10 * DAY }, fsrs(15, 3 * DAY)),
    { id: 'n5', subj: 'พยาน', q: 'Hearsay', a: 'Out-of-court statement.', createdAt: t0 - DAY, srsIdx: -1, dueAt: t0 - 1000 }
  ];
};
function review(h) {
  const { dom, settle } = h;
  const t0 = NOW;
  const bizKeys = quizKeys(BIZ, 3), engKeys = quizKeys(ENG, 3);
  const seed = Object.assign({}, LEARN_SEED, {
    'lang-practice:srs': { 'lang-en::vocab-basic::0': { stability: 1, difficulty: 6, lastReview: t0 - 2 * DAY, dueAt: t0 - 1000, reps: 1, lapses: 1, srsIdx: 0 }, 'lang-en::vocab-basic::1': { stability: 1, difficulty: 6, lastReview: t0 - 2 * DAY, dueAt: t0 - 2000, reps: 1, lapses: 0, srsIdx: 0 }, 'lang-en::vocab-basic::99': { dueAt: t0 - 5 } },
    'tanot:learn:faces:lang': { v: 1, langs: { 'lang-en': 'English' }, cards: { 'lang-en::vocab-basic::0': ['apple', 'a round fruit'], 'lang-en::vocab-basic::1': ['bridge', 'a structure over a river'] } },
    'lbe:business:srs': Object.fromEntries(bizKeys.map((k, i) => [k, { interval: 3, due: t0 - (i + 1) * 1000 }]).concat([['business:nope:0', { interval: 1, due: t0 - 1 }]])),
    'lbe:engineering:srs': Object.fromEntries(engKeys.map((k, i) => [k, { interval: 7, due: t0 - (i + 1) * 1000 }])),
    'tanot:books:items': [{ id: 'b1', title: 'Atomic Habits', author: 'James Clear', status: 'reading', pages: 320, current: 100, createdAt: t0 - 5 * DAY }],
    'tanot:books:cards': [
      { id: 'card-n1', noteId: 'n1', bookId: 'b1', front: 'Atomic Habits · p. 42', back: 'Systems beat goals.', createdAt: t0 - 3 * DAY, dueAt: t0 - 1000 },
      { id: 'card-n2', noteId: 'n2', bookId: 'b1', front: 'What is a habit loop?', back: 'Cue, craving, response, reward.', createdAt: t0 - 3 * DAY, stability: 2, difficulty: 5, reps: 1, lapses: 0, lastReview: t0 - 2 * DAY, srsIdx: 0, dueAt: t0 - 500 }
    ]
  });
  const states = [
    ['base', async () => {}],
    ['reveal', async (p) => { await dom(p, '#rvCard'); await settle(p, 200); }]
  ];
  ['law', 'lang', 'biz', 'eng', 'books'].forEach((src) => states.push(['filter-' + src, async (p) => {
    await dom(p, `#rvFilter [data-f="${src}"]`); await settle(p, 200); await dom(p, '#rvCard'); await settle(p, 200);
  }]));
  states.push(['filter-all', async (p) => { await dom(p, '#rvFilter [data-f="all"]'); await settle(p, 200); }]);
  states.push(['settings', async (p) => { await p.selectOption('#rvGoal', '100').catch(() => {}); await p.selectOption('#rvRest', '2').catch(() => {}); await settle(p, 300); await p.evaluate(() => document.activeElement && document.activeElement.blur()); }]);
  // ทำการ์ดทบทวน 1 รอบจนจบ — ให้คะแนนสลับ Again/Hard/Good/Easy
  states.push(['rate-through', async (p) => {
    for (let i = 0; i < 16; i++) {
      const has = await p.evaluate(() => !!document.getElementById('rvCard'));
      if (!has) break;
      await dom(p, '#rvCard'); await settle(p, 120);
      await dom(p, `.rv-rate [data-r="${(i % 4) + 1}"]`); await settle(p, 150);
    }
    await settle(p, 300);
  }]);
  return {
    page: 'review.html',
    seed,
    wait: async (p) => { // การ์ดกฎหมายอยู่ใน IndexedDB ของหน้ากฎหมาย → ใส่แล้วโหลดหน้าใหม่
      await p.evaluate(seedLawIdb, lawNotes());
      await p.reload({ waitUntil: 'load' }); await p.waitForSelector('nav.ome-nav', { timeout: 30000 }); await settle(p, 1200);
    },
    states
  };
}

/* ───────── books.html ───────── */
function books(h) {
  const { dom, settle, closeAll, val, sel } = h;
  const t0 = NOW;
  const day = (off) => new Date(t0 + 7 * 3600e3 - off * DAY).toISOString().slice(0, 10);
  const seed = Object.assign({}, LEARN_SEED, {
    'tanot:books:items': [
      { id: 'b1', title: 'Atomic Habits', author: 'James Clear', coverId: 12345, olKey: '/works/OL45883W', pages: 320, current: 100, status: 'reading', startedAt: day(10), rating: 0, review: '', createdAt: t0 - 10 * DAY },
      { id: 'b2', title: 'A very long book title that keeps going to check how the row wraps on a narrow phone screen', author: 'An Author With A Long Name', pages: 0, current: 12, status: 'reading', startedAt: day(3), createdAt: t0 - 3 * DAY },
      { id: 'b3', title: 'Deep Work', author: 'Cal Newport', pages: 296, current: 0, status: 'want', createdAt: t0 - 2 * DAY },
      { id: 'b4', title: 'Sapiens', author: 'Yuval Noah Harari', pages: 443, current: 443, status: 'done', startedAt: day(40), finishedAt: day(20), rating: 4, review: 'Great sweeping history.\nWorth a re-read.', xpDone: true, createdAt: t0 - 40 * DAY },
      { id: 'b5', title: 'Walden', author: 'Henry David Thoreau', pages: 352, current: 352, status: 'done', startedAt: day(60), finishedAt: day(50), rating: 5, xpDone: true, createdAt: t0 - 60 * DAY }
    ],
    'tanot:books:logs': [0, 1, 2, 3, 5, 8, 12, 15, 20, 30, 40].map((o, i) => ({ id: 'l' + i, bookId: i % 2 ? 'b2' : 'b1', date: day(o), pages: 10 + i * 3, minutes: 15 + i * 2, ts: t0 - o * DAY })),
    'tanot:books:notes': [
      { id: 'n1', bookId: 'b1', page: 42, text: 'Systems beat goals every single time.', q: '', cardId: 'card-n1', ts: t0 - 3 * DAY },
      { id: 'n2', bookId: 'b1', page: 77, text: 'You do not rise to the level of your goals; you fall to the level of your systems.', q: 'What do you fall to?', cardId: 'card-n2', ts: t0 - 2 * DAY },
      { id: 'n3', bookId: 'b4', page: 0, text: 'A highlight without a card yet.', q: '', cardId: '', ts: t0 - DAY }
    ],
    'tanot:books:cards': [
      { id: 'card-n1', noteId: 'n1', bookId: 'b1', front: 'Atomic Habits · p. 42', back: 'Systems beat goals every single time.', createdAt: t0 - 3 * DAY, dueAt: t0 - 1000 },
      { id: 'card-n2', noteId: 'n2', bookId: 'b1', front: 'What do you fall to?', back: 'The level of your systems.', createdAt: t0 - 2 * DAY, stability: 3, difficulty: 5, reps: 1, lapses: 0, lastReview: t0 - DAY, srsIdx: 0, dueAt: t0 + 4 * DAY }
    ],
    'tanot:books:settings': { yearGoal: 12 }
  });
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const OL = { numFound: 2, docs: [
    { key: '/works/OL45883W', title: 'Atomic Habits', author_name: ['James Clear'], cover_i: 12345, number_of_pages_median: 320, first_publish_year: 2018 },
    { key: '/works/OL1W', title: 'No cover here', number_of_pages_median: 0 }
  ] };
  const open = async (p, id) => { await closeAll(p); await dom(p, id); await settle(p, 250); };
  const tab = (k) => async (p) => { await closeAll(p); await dom(p, `#tabs [data-tab="${k}"]`); await settle(p, 250); };
  const shelf = (k) => async (p) => { await closeAll(p); await dom(p, '#tabs [data-tab="shelf"]'); await dom(p, `#shelfSeg [data-shelf="${k}"]`); await settle(p, 250); };
  const states = [
    ['shelf-reading', async () => {}],
    ['shelf-want', shelf('want')],
    ['shelf-done', shelf('done')],
    ['dlg-add', async (p) => { await shelf('reading')(p); await open(p, '#addBtn'); }],
    ['dlg-add-search', async (p) => { await val(p, '#sQ', 'atomic'); await dom(p, '#sGo'); await settle(p, 600); }],
    ['dlg-add-empty-save', async (p) => { await val(p, '#bTitle', ''); await dom(p, '#bSave'); await settle(p, 250); }],
    ['dlg-add-pick', async (p) => { await dom(p, '#sRes [data-hit="0"]'); await settle(p, 300); await sel(p, '#bRating', '4'); }],
    ['dlg-add-search-none', async (p) => { await closeAll(p); await open(p, '#addBtn'); await val(p, '#sQ', 'nothing'); await p.route('https://openlibrary.org/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ numFound: 0, docs: [] }) })); await dom(p, '#sGo'); await settle(p, 600); }],
    ['dlg-edit', async (p) => { await closeAll(p); await p.evaluate(() => { const b = document.querySelector('[data-bid] [data-act="edit"]'); if (b) b.click(); }); await settle(p, 300); }],
    ['dlg-edit-delete-confirm', async (p) => { await dom(p, '#bDel'); await settle(p, 400); }],
    ['dlg-log', async (p) => { await closeAll(p); await shelf('reading')(p); await p.evaluate(() => { const b = document.querySelector('[data-bid] [data-act="log"]'); if (b) b.click(); }); await settle(p, 300); }],
    ['dlg-log-empty-save', async (p) => { await p.evaluate(() => document.querySelector('#lform button[type="submit"]').click()); await settle(p, 250); }],
    ['tab-stats', tab('stats')],
    ['stats-goal', async (p) => { await sel(p, '#goalSel', '24'); await settle(p, 250); }],
    ['stats-del-log-confirm', async (p) => { await p.evaluate(() => { const b = document.querySelector('#logList [data-act="del-log"]'); if (b) b.click(); }); await settle(p, 400); }],
    ['tab-notes', tab('notes')],
    ['notes-filter', async (p) => { await sel(p, '#noteBook', 'b1'); await settle(p, 250); }],
    ['dlg-note', async (p) => { await open(p, '#addNote'); }],
    ['dlg-note-empty-save', async (p) => { await p.evaluate(() => document.querySelector('#nform button[type="submit"]').click()); await settle(p, 250); }],
    ['notes-del-confirm', async (p) => { await closeAll(p); await p.evaluate(() => { const b = document.querySelector('#noteList [data-act="del-note"]'); if (b) b.click(); }); await settle(p, 400); }],
    ['notes-mkcard', async (p) => { await closeAll(p); await p.evaluate(() => { const b = document.querySelector('#noteList [data-act="mkcard"]'); if (b) b.click(); }); await settle(p, 300); }]
  ];
  return {
    page: 'books.html',
    seed,
    user: /^\s*$/,
    route: async (p) => {
      await p.route('https://openlibrary.org/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(OL) }));
      await p.route('https://covers.openlibrary.org/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    },
    states
  };
}

/* ───────── classroom-business / classroom-engineering ───────── */
function lbe(h, name) {
  const { dom, settle, val } = h;
  const list = name === 'business' ? BIZ : ENG;
  const withQuiz = list.filter((t) => t.quiz.length);
  const noQuiz = list.filter((t) => !t.quiz.length);
  const second = withQuiz[1] || withQuiz[0];
  const key = (t, i) => `${t.subj}:${t.id}:${i}`;
  const t0 = NOW;
  const seed = Object.assign({}, LEARN_SEED, {
    [`lbe:${name}:xp`]: '1300',
    [`lbe:${name}:completed`]: { [`${list[0].subj}:${list[0].id}`]: true, [`${list[1].subj}:${list[1].id}`]: true },
    [`lbe:${name}:written`]: { [`${list[0].id}:0`]: 'My earlier answer' },
    [`lbe:${name}:notes`]: {
      [`${list[0].subj}:${list[0].id}`]: { text: '# Heading\n## Sub heading\n- point **one** with ==highlight==\n- point two\n\n1. first\n2. second\n`code` and *italic*', updatedAt: t0 - DAY },
      [`${second.subj}:${second.id}`]: { text: 'A short note about this topic.', updatedAt: t0 - 3 * DAY }
    },
    [`lbe:${name}:srs`]: Object.fromEntries(quizKeys(list, 5).map((k, i) => [k, { interval: 3, due: t0 - (i + 1) * 1000 }]).concat([[key(second, 0), { interval: 14, due: t0 + 9 * DAY }]])),
    [`lbe:${name}:exams`]: [
      { date: new Date(t0 - DAY).toISOString(), score: 8, total: 10, sec: 312 },
      { date: new Date(t0 - 4 * DAY).toISOString(), score: 5, total: 10, sec: 410 },
      { date: new Date(t0 - 9 * DAY).toISOString(), score: 15, total: 20, sec: 734 }
    ]
  });
  const k = (p, key) => p.evaluate((q) => { const el = document.querySelector(`[data-k="${q}"]`); if (el) el.click(); return !!el; }, key);
  const topic = (id) => async (p) => { await p.evaluate((i) => { const el = document.querySelector(`[data-k="topic"][data-tid="${i}"]`); if (el) el.click(); }, id); await settle(p, 300); };
  const answer = async (p, text) => { await p.fill('main textarea', text, { timeout: 4000 }).catch(() => {}); };
  const states = [
    ['stream', async () => {}],
    ['stream-subject', async (p) => { await k(p, 'subj'); await settle(p, 300); }],
    ['tab-stream', async (p) => { await k(p, 'tab-stream'); await settle(p, 200); }],
    ['todo-open', async (p) => { await k(p, 'todo'); await settle(p, 300); }],
    ['work-summary', async (p) => { await k(p, 'tab-summary'); await settle(p, 250); }],
    ['work-quiz', async (p) => { await k(p, 'tab-quiz'); await settle(p, 250); }],
    ['quiz-typed', async (p) => { await answer(p, 'An answer typed by the learner.'); await settle(p, 200); }],
    ['quiz-submitted', async (p) => { await k(p, 'qsubmit'); await settle(p, 300); }],
    ['quiz-marked-wrong', async (p) => { await k(p, 'qwrong'); await settle(p, 300); }],
    ['quiz-next-correct', async (p) => { await k(p, 'qnext'); await answer(p, 'second answer'); await k(p, 'qsubmit'); await k(p, 'qcorrect'); await settle(p, 300); }],
    ['quiz-finish', async (p) => {
      for (let i = 0; i < 12; i++) {
        const done = await p.evaluate(() => !!document.querySelector('[data-k="retry"]'));
        if (done) break;
        await k(p, 'qnext'); await answer(p, 'x'); await k(p, 'qsubmit'); await k(p, 'qcorrect'); await settle(p, 100);
      }
      await settle(p, 300);
    }],
    ['quiz-retry', async (p) => { await k(p, 'retry'); await settle(p, 250); }],
    ['work-notes', async (p) => { await k(p, 'tab-mynotes'); await settle(p, 250); }],
    ['notes-typed', async (p) => { await p.fill('main textarea', '# Title\n- bullet **bold** ==mark==\n\nplain text', { timeout: 4000 }).catch(() => {}); await settle(p, 250); }],
    ['notes-preview', async (p) => { await k(p, 'note-preview'); await settle(p, 250); }],
    ['notes-preview-empty', async (p) => { await k(p, 'note-edit'); await p.fill('main textarea', '', { timeout: 4000 }).catch(() => {}); await k(p, 'note-preview'); await settle(p, 250); await k(p, 'note-edit'); }],
    ['topic-second', async (p) => { await topic(second.id)(p); }]
  ];
  if (noQuiz.length) {
    states.push(['topic-reflection', async (p) => { await topic(noQuiz[0].id)(p); await k(p, 'tab-quiz'); await settle(p, 250); }]);
    states.push(['reflection-submitted', async (p) => { await answer(p, 'Reflection answer'); await k(p, 'qsubmit'); await settle(p, 300); }]);
  }
  states.push(['drawer', async (p) => { await k(p, 'menu'); await settle(p, 400); }]);
  states.push(['drawer-group', async (p) => { await k(p, 'group'); await settle(p, 250); await k(p, 'group'); await settle(p, 250); }]);
  states.push(['drawer-close', async (p) => { await k(p, 'closeNav'); await settle(p, 400); }]);
  states.push(['allnotes', async (p) => { await k(p, 'tab-notes'); await settle(p, 300); }]);
  states.push(['allnotes-query', async (p) => { await p.fill('[data-k="notesQuery"]', 'note', { timeout: 4000 }).catch(() => {}); await settle(p, 250); }]);
  states.push(['allnotes-none', async (p) => { await p.fill('[data-k="notesQuery"]', 'zzzzqq', { timeout: 4000 }).catch(() => {}); await settle(p, 250); }]);
  states.push(['allnotes-open', async (p) => { await p.fill('[data-k="notesQuery"]', '', { timeout: 4000 }).catch(() => {}); await k(p, 'noteRow'); await settle(p, 300); }]);
  states.push(['review-start', async (p) => { await k(p, 'tab-review'); await settle(p, 300); }]);
  states.push(['review-reveal', async (p) => { await p.fill('main textarea, [data-k="reveal"] ~ *', '', { timeout: 500 }).catch(() => {}); await k(p, 'reveal'); await settle(p, 300); }]);
  states.push(['review-through', async (p) => {
    for (let i = 0; i < 8; i++) {
      const has = await p.evaluate(() => !!document.querySelector('[data-k="reveal"], [data-k="recalled"]'));
      if (!has) break;
      await k(p, 'reveal'); await settle(p, 80);
      await k(p, i % 2 ? 'notyet' : 'recalled'); await settle(p, 100);
    }
    await settle(p, 300);
  }]);
  states.push(['review-empty', async (p) => { await settle(p, 100); }]);
  states.push(['exam-menu', async (p) => { await k(p, 'tab-exam'); await settle(p, 300); }]);
  states.push(['exam-q', async (p) => { await k(p, 'start10'); await settle(p, 300); }]);
  states.push(['exam-typed', async (p) => { await p.fill('main textarea, #root textarea', 'exam answer', { timeout: 4000 }).catch(() => {}); await settle(p, 200); }]);
  states.push(['exam-submitted', async (p) => { await k(p, 'esubmit'); await settle(p, 300); }]);
  states.push(['exam-through', async (p) => {
    for (let i = 0; i < 12; i++) {
      const ta = await p.evaluate(() => !!document.querySelector('#root textarea'));
      if (!ta) break;
      await p.fill('#root textarea', 'a', { timeout: 2000 }).catch(() => {});
      await k(p, 'esubmit'); await settle(p, 60);
      await k(p, i % 3 ? 'ecorrect' : 'ewrong'); await settle(p, 80);
    }
    await settle(p, 300);
  }]);
  states.push(['exam-result-back', async (p) => { await k(p, 'tab-exam'); await settle(p, 300); }]);
  states.push(['stream-final', async (p) => { await k(p, 'tab-stream'); await settle(p, 300); }]);
  states.push(['sync-click', async (p) => { await k(p, 'sync'); await settle(p, 500); }]);
  return {
    page: `classroom-${name}.html`,
    seed,
    user: /^\s*$/,
    overlay: 'aside.translate-x-0',
    init: 'window.google = undefined;',
    ignoreErrors: /accounts\.google\.com|gsi\/client|ERR_INTERNET_DISCONNECTED|Failed to load resource/,
    states
  };
}

/* ───────── classroom-law.html ───────── */
function law(h) {
  const { dom, settle, closeAll, val, sel } = h;
  const t0 = NOW;
  const seed = Object.assign({}, LEARN_SEED, {
    'tanot:barprep:activity': Array.from({ length: 26 }, (_, i) => ({ t: ['note', 'review', 'writing', 'mockexam', 'drill'][i % 5], ts: t0 - (i % 17) * DAY - i * 1000 })),
    'tanot:barprep:writing': [
      { id: 'w1', subj: 'ป.อ.', prompt: 'Q', answer: 'A', minutes: 15, elapsedSec: 700, checklist: { matra: true, dika: false, complete: true }, ts: t0 - 2 * DAY },
      { id: 'w2', subj: '(ไม่ระบุวิชา)', prompt: 'Q', answer: 'A', minutes: 20, elapsedSec: 1300, checklist: { matra: false, dika: false, complete: false }, ts: t0 - 4 * DAY },
      { id: 'w3', subj: 'ป.พ.พ. บรรพ 1', prompt: 'Q', answer: 'A', minutes: 10, elapsedSec: 500, checklist: { matra: true, dika: true, complete: true }, ts: t0 - 6 * DAY }
    ],
    'tanot:barprep:examdates': { neti1: { applyStart: '2026-10-01', applyEnd: '2026-10-20', examDate: '2026-11-15' }, judge: { examDate: '2026-09-20' }, lawyer: { examDate: '2026-10-03' } },
    'tanot:barprep:career': { neti: 'yes', exp: 3, master: 'th', lawyer: 'no' }
  });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const go = (hash) => async (p) => { await closeAll(p); await p.evaluate((x) => { location.hash = x; }, hash); await settle(p, 500); };
  const click = (sel2) => async (p) => { await dom(p, sel2); await settle(p, 250); };
  const states = [
    ['dashboard', async () => {}],
    ['hb-open', async (p) => { await dom(p, '#clHbToggle'); await settle(p, 400); }],
    ['hb-close', async (p) => { await dom(p, '#clHbBackdrop'); await settle(p, 400); }],
    ['goals', go('#goals')],
    ['goals-exam-open', async (p) => { await p.evaluate(() => document.querySelectorAll('.exam-prep').forEach((d) => { d.open = true; })); await settle(p, 250); }],
    ['goals-date', async (p) => { await p.evaluate(() => { const i = document.querySelector('.exam-card[data-key="neti2"] input[data-f="examDate"]'); if (i) { i.value = '2026-12-05'; i.dispatchEvent(new Event('change', { bubbles: true })); } }); await settle(p, 300); }],
    ['goals-career-none', async (p) => { await sel(p, '#bpNeti', 'no'); await val(p, '#bpExp', 0); await sel(p, '#bpMaster', 'no'); await sel(p, '#bpLawyer', 'no'); await dom(p, '#bpCareerBtn'); await settle(p, 300); }],
    ['goals-career-intl', async (p) => { await sel(p, '#bpMaster', 'intl'); await dom(p, '#bpCareerBtn'); await settle(p, 300); }],
    ['goals-career-all', async (p) => { await sel(p, '#bpNeti', 'yes'); await val(p, '#bpExp', 3); await sel(p, '#bpMaster', 'th'); await sel(p, '#bpLawyer', 'yes'); await dom(p, '#bpCareerBtn'); await settle(p, 300); }],
    ['allnotes', go('#allnotes')],
    ['search-short', async (p) => { await val(p, '#clRefSearch', 'ก'); await settle(p, 450); }],
    ['search-hit', async (p) => { await val(p, '#clRefSearch', 'มาตรา 150'); await settle(p, 500); }],
    ['search-none', async (p) => { await val(p, '#clRefSearch', 'zzqqxx'); await settle(p, 450); }],
    ['search-clear', async (p) => { await val(p, '#clRefSearch', ''); await settle(p, 450); }],
    ['note-edit', async (p) => { await dom(p, '[data-edit]'); await settle(p, 400); }],
    ['note-edit-cancel', async (p) => { await dom(p, '#bpNoteCancelEdit'); await settle(p, 250); }],
    ['note-add', async (p) => { await val(p, '#bpNoteSubj', 'ป.พ.พ. บรรพ 2'); await val(p, '#bpNoteQ', 'Section 600 loan'); await val(p, '#bpNoteA', 'Loan for use.'); await dom(p, '#bpNoteAdd'); await settle(p, 400); }],
    ['review-start', click('#bpReviewBtn')],
    ['review-reveal', click('#bpFlashCard')],
    ['review-rate', async (p) => { for (let i = 0; i < 8; i++) { const has = await p.evaluate(() => !!document.getElementById('bpFlashCard')); if (!has) break; await dom(p, '#bpFlashCard'); await dom(p, ['#bpFlashAgain', '#bpFlashHard', '#bpFlashGood', '#bpFlashEasy'][i % 4]); await settle(p, 100); } await settle(p, 300); }],
    ['wr-start', async (p) => { await val(p, '#bpWrSubj', 'ป.อ.'); await val(p, '#bpWrMin', 1); await val(p, '#bpWrPrompt', 'A prompt'); await dom(p, '#bpWrStart'); await settle(p, 400); }],
    ['wr-typed', async (p) => { await val(p, '#bpWrAnswer', 'My written answer'); await dom(p, '#bpChkMatra'); await dom(p, '#bpChkComplete'); await settle(p, 200); }],
    ['wr-save', async (p) => { await dom(p, '#bpWrSave'); await settle(p, 400); }],
    ['ocr-text', async (p) => {
      await p.evaluate(() => { window.__barprep.showTextForReview('มาตรา ๑ ข้อความตัวอย่าง\nมาตรา ๒ ข้อความที่สอง\nมาตรา ๓ ข้อความที่สาม', 'sample'); });
      await settle(p, 400);
    }],
    ['ocr-split', async (p) => { await dom(p, '#bpMatraSplitBtn'); await settle(p, 400); }],
    ['ocr-split-save', async (p) => { await dom(p, '#bpMatraSaveBtn'); await settle(p, 400); }],
    ['ocr-no-sections', async (p) => { await p.evaluate(() => { window.__barprep.showTextForReview('plain text without section markers', 'x'); }); await settle(p, 200); await dom(p, '#bpMatraSplitBtn'); await settle(p, 300); }],
    ['ocr-save-single', async (p) => { await dom(p, '#bpOcrSave'); await settle(p, 300); }],
    ['ocr-file', async (p) => {
      await p.evaluate(() => { window.Tesseract = {}; window.TanotFileReader = Object.assign(window.TanotFileReader || {}, { readImageFile: () => Promise.resolve('มาตรา ๑ จากรูป\nมาตรา ๒ จากรูป') }); });
      await p.setInputFiles('#bpOcrFile', { name: 'page.png', mimeType: 'image/png', buffer: png }).catch(() => {});
      await settle(p, 600);
    }],
    ['ocr-file-error', async (p) => {
      await p.evaluate(() => { window.TanotFileReader.readImageFile = () => Promise.reject(new Error('boom')); });
      await p.setInputFiles('#bpOcrFile', { name: 'page2.png', mimeType: 'image/png', buffer: png }).catch(() => {});
      await settle(p, 500);
    }],
    ['subject-civil', go('#subject-civil')],
    ['civil-lesson-tick', async (p) => { await p.evaluate(() => { const c = document.querySelector('[data-lread="0"]'); if (c) c.click(); }); await settle(p, 400); }],
    ['civil-lesson-note', async (p) => { await p.evaluate(() => { const b = document.querySelector('[data-lnotebtn="0"]'); if (b) b.click(); }); await settle(p, 250); await p.fill('[data-lnotearea="0"]', 'My lesson note', { timeout: 3000 }).catch(() => {}); await settle(p, 250); }],
    ['civil-lesson-chip', async (p) => { await p.evaluate(() => { const c = document.querySelector('.lchip'); if (c) c.click(); }); await settle(p, 500); }],
    ['civil-tts', async (p) => { await p.evaluate(() => { const b = document.querySelector('[data-ttsplay="0"]'); if (b) b.click(); }); await settle(p, 500); }],
    ['civil-tts-pause', async (p) => { await p.evaluate(() => { const b = document.getElementById('clTtsPauseBtn'); if (b) b.click(); }); await settle(p, 300); await p.evaluate(() => { const b = document.getElementById('clTtsStopBtn'); if (b) b.click(); }); await settle(p, 300); }],
    ['civil-export', async (p) => { await p.evaluate(() => { window.print = () => {}; const b = document.getElementById('clExportPdf'); if (b) b.click(); }); await settle(p, 400); }],
    ['civil-autoflash', async (p) => { await dom(p, '#bpAutoFlash'); await settle(p, 400); }],
    ['course-nitikam', go('#course-nitikam')],
    ['nitikam-playlist', async (p) => { await p.evaluate(() => { const b = document.getElementById('clTtsPlaylistBtn'); if (b) b.click(); }); await settle(p, 500); await p.evaluate(() => { const b = document.getElementById('clTtsStopBtn'); if (b) b.click(); }); await settle(p, 300); }],
    ['nitikam-exam-open', async (p) => { await p.evaluate(() => { const d = document.querySelector('#clExamBody details.examq'); if (d) d.open = true; const s = d && d.querySelector('details.disclosure'); if (s) s.open = true; }); await settle(p, 300); }],
    ['nitikam-exam-search', async (p) => { await val(p, '#exqSearch', 'zzqqxx'); await settle(p, 300); }],
    ['nitikam-exam-filter', async (p) => { await val(p, '#exqSearch', ''); await p.evaluate(() => { const s = document.getElementById('exqTopicFilter'); if (s && s.options.length > 1) { s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bubbles: true })); } }); await settle(p, 300); }],
    ['nitikam-mock-start', async (p) => { await p.evaluate(() => { const s = document.getElementById('exqTopicFilter'); if (s) { s.selectedIndex = 0; s.dispatchEvent(new Event('change', { bubbles: true })); } }); await val(p, '#clMockCount', 3); await dom(p, '#clMockStart'); await settle(p, 400); }],
    ['nitikam-mock-next', async (p) => { await dom(p, '#clMockNext'); await settle(p, 300); }],
    ['nitikam-mock-finish', async (p) => { for (let i = 0; i < 4; i++) { const f = await dom(p, '#clMockFinish'); if (f) break; await dom(p, '#clMockNext'); } await settle(p, 400); }],
    ['nitikam-drill-start', async (p) => { await dom(p, '#clDrillStart'); await settle(p, 300); }],
    ['nitikam-drill-reveal', async (p) => { await dom(p, '#clDrillReveal'); await settle(p, 300); }],
    ['nitikam-drill-answer', async (p) => { await dom(p, '#clDrillRight'); await dom(p, '#clDrillReveal'); await dom(p, '#clDrillWrong'); await settle(p, 300); }],
    ['nitikam-drill-stop', async (p) => { await dom(p, '#clDrillStop'); await settle(p, 300); }],
    ['tools', go('#tools')],
    ['tools-drive-list', click('#bpDriveListBtn')],
    ['tools-drive-connect', click('#driveConnectBtn')],
    ['tools-clean', click('#bpCleanNotesBtn')],
    ['dashboard-final', go('#dashboard')]
  ];
  return {
    page: 'classroom-law.html',
    seed,
    user: /^\s*$/,
    overlay: '#clHbPanel.open',
    init: 'window.google = undefined; window.print = function () {};',
    ignoreErrors: /accounts\.google\.com|gsi\/client|ERR_INTERNET_DISCONNECTED|Failed to load resource|cdn\.jsdelivr\.net|pdfjs|Tesseract|html2canvas|jspdf|googleapis/,
    wait: async (p) => {
      await p.evaluate(seedLawIdb, lawNotes());
      await p.reload({ waitUntil: 'load' }); await p.waitForSelector('nav.ome-nav', { timeout: 30000 }); await settle(p, 1200);
    },
    states
  };
}

const ALLOW = [];

function targets(h) {
  return [review(h), books(h), law(h), lbe(h, 'business'), lbe(h, 'engineering')];
}
module.exports = { targets, ALLOW, NOW };
