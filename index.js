/* ══════════════════════════════════════════════════════════════════
   หน้าแรก "วันนี้" (ROADMAP รอบ 3: Symmetrical Balance) — อ่านข้อมูลจากทุกด้านมาประกอบเป็น 6 กล่อง · ไม่ยิงเครือข่ายเอง
   ข้อยกเว้นที่ตั้งใจ: (1) การ์ด "พอร์ตลงทุน" เขียน snapshot มูลค่าวันละแถวลง tanot:invest:networth ด้วย TanotData.update (localStorage คีย์เดียว ไม่ยิงเน็ต)
   (2) ยอดรวมบท/วลีของวิชา (ภาษา/ธุรกิจ/วิศวกรรม) อ่านจากหน้าของวิชาเอง (same-origin) ครั้งเดียวต่อ 14 วันแล้วเก็บใน tanot:home:cache
   (3) ปุ่มทำทันทีที่เรียกตรรกะเดิมของหน้าเจ้าของ: "กินแล้ว" (HealthCalc.makeIntake → tanot:health:intake) และ "ทำแล้ว" (CookPlan.toggleDone + LearnCore.award)
   ตรรกะประกอบ/จัดเรียง/สรุปอยู่ใน home-calc.js (ห้ามมีสูตรของตัวเองที่นี่) · อ่านผ่าน TanotData.read / readIdb แล้ววาดใหม่เมื่อข้อมูลเปลี่ยน
   คีย์ที่อ่าน (รูปแบบต้องตรงกับหน้าเจ้าของข้อมูล — ดูหัว home-calc.js สำหรับคีย์ของหน้านี้เอง tanot:nav:last | tanot:home:layout | tanot:home:cache):
     budget:records|budgets|categories · การ์ดทบทวน/XP/วันติดต่อกันผ่าน learn-core.js (lang-practice:srs, lbe:*:srs, tanot-barprep/notes, tanot:books:cards, tanot:learn:*)
     ความคืบหน้าวิชา: lang-practice:progress, lbe:business|engineering:completed, tanot:barprep:lessonread, tanot:music|sports|cooking:progress
     สินทรัพย์ลงทุน: tanot:invest:thstock|globalstock|btc|gold|thaifund|spfund|govbond|gsblottery|baaclottery + nav + แคชราคา (ชื่อคีย์/สูตรใน invest-calc.js) + tanot:invest:networth + tanot:invest:hub:watch:thai|global
     tanot:insurance:policies (insurance-calc.js) · tanot:receipts:items (receipts-calc.js) · tanot:car:vehicles|services (car-calc.js)
     tanot:mnt:assets|plans|settings + IndexedDB tanot-mnt-<ปีนี้>/insp, tanot-mnt-<ปีก่อน>/insp, tanot-mnt/wo|woev (mnt-calc.js)
     tanot:health:vitals|meds|intake|ranges|workouts|settings (health-calc.js) · tanot:cooking:recipes|plans|shopping (cooking-plan-calc.js)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── ข้อความ UI สองภาษา (i18n.js) — คีย์ 'today.*' · ป้ายของโมดูลคำนวณที่เป็นไทยล้วน (ชนิดกรมธรรม์ ความถี่ ฯลฯ) แปลที่นี่ตามรหัส ── */
  var I18N = window.OME_I18N;
  if (I18N) I18N.add('today', {
    th: {
      title: 'Tanot — วันนี้', morning: 'สวัสดีตอนเช้า', afternoon: 'สวัสดีตอนบ่าย', evening: 'สวัสดีตอนเย็น',
      qExpense: 'รายจ่าย', qIncome: 'รายรับ', qReview: 'ทบทวน', qSearch: 'ค้นหา', qLayout: 'จัดหน้าแรก',
      hTodo: 'ต้องทำวันนี้', todoNone: 'ไม่มีเรื่องค้าง', todoCount: '{n} เรื่อง',
      hSpend: 'เงินเดือนนี้', lBudget: 'รายรับรายจ่าย', income: 'รายรับ', expense: 'รายจ่าย', balance: 'คงเหลือ', emptySpend: 'ยังไม่มีรายการเดือนนี้', openBudget: 'เปิดรายรับรายจ่าย',
      unknownCat: 'ไม่ทราบหมวดหมู่', usedPct: 'ใช้ไป {pct}% ของงบ', budgetOf: '{spent} / {budget}', shareOf: '{pct}% ของรายจ่าย',
      hStock: 'พอร์ตลงทุน', lInvest: 'การลงทุน', emptyInvest: 'ยังไม่มีสินทรัพย์ลงทุน', openInvest: 'เปิดหน้าการลงทุน', changeToday: 'วันนี้', change30: '30 วัน',
      noFx: 'ไม่รวมสินทรัพย์ USD (ยังไม่มีอัตราแลกเปลี่ยน)', priceAt: 'ราคา ณ {d}', sparkAria: 'มูลค่าพอร์ต 30 วันล่าสุด', noQuote: '—', watchAria: 'รายการติดตาม',
      hLearn: 'เรียนต่อ', lLearn: 'การศึกษา', streak: 'ติดต่อกัน', days: 'วัน', week7: '7 วันล่าสุด', xpToday: 'XP วันนี้', cardsDue: 'การ์ดถึงรอบ', review: 'ทบทวน',
      'dot.done': 'ฝึกแล้ว', 'dot.rest': 'วันพัก', 'dot.miss': 'ขาด', 'dot.today': 'วันนี้ยังไม่ฝึก',
      cont: 'ต่อ', nextT: 'บทถัดไป: {t}', doneN: 'เรียนแล้ว {n} บท', readN: 'อ่านแล้ว {n} หัวข้อ', phrasesN: 'ฝึกแล้ว {n} วลี', xpN: 'XP {n}', openedAt: 'เปิดล่าสุด {when}',
      emptyLearn: 'ยังไม่ได้เริ่มเรียน', openLearn: 'เริ่มเรียน', allDone: 'ครบทุกบทแล้ว',
      'src.law': 'กฎหมาย', 'src.lang': 'ภาษา', 'src.biz': 'ธุรกิจ', 'src.eng': 'วิศวกรรม', 'src.books': 'หนังสือ', 'src.music': 'ดนตรี', 'src.sports': 'กีฬา', 'src.cooking': 'ทำอาหาร',
      'lang.lang-en': 'ภาษาอังกฤษ', 'lang.lang-jp': 'ภาษาญี่ปุ่น', 'lang.lang-cn': 'ภาษาจีนกลาง', 'lang.lang-yue': 'ภาษาจีนกวางตุ้ง', 'lang.lang-kr': 'ภาษาเกาหลี', 'lang.lang-de': 'ภาษาเยอรมัน',
      'lang.lang-in': 'ภาษาฮินดี', 'lang.lang-fr': 'ภาษาฝรั่งเศส', 'lang.lang-it': 'ภาษาอิตาลี', 'lang.lang-mm': 'ภาษาพม่า', 'lang.lang-kh': 'ภาษาเขมร', 'lang.lang-la': 'ภาษาลาว',
      'lang.lang-vn': 'ภาษาเวียดนาม', 'lang.lang-my': 'ภาษามลายู', 'lang.lang-ar': 'ภาษาอาหรับ', 'lang.lang-es': 'ภาษาสเปน', 'lang.lang-pt': 'ภาษาโปรตุเกส', 'lang.lang-ru': 'ภาษารัสเซีย',
      hHealth: 'สุขภาพ', lHealth: 'เปิดหน้าสุขภาพ', weight: 'น้ำหนัก', bp: 'ความดัน', kg: 'กก.', weightChange: '{d} กก. ใน 30 วัน', workout: 'ออกกำลังกายสัปดาห์นี้ {a} / {b} นาที', workoutAria: 'ออกกำลังกายเทียบเป้า',
      noHealth: 'ยังไม่มีข้อมูลสุขภาพ', openHealth: 'บันทึกสุขภาพ',
      hMeals: 'เมนูวันนี้', lMeals: 'แผนอาหาร', 'meal.b': 'เช้า', 'meal.l': 'กลางวัน', 'meal.d': 'เย็น', notPicked: 'ยังไม่ได้เลือก', cooked: 'ทำแล้ว', undo: 'ยกเลิก', servingsN: '{n} ที่',
      toBuy: 'ของที่ยังไม่ซื้อ {n} รายการ', emptyMeals: 'วันนี้ยังไม่ได้วางเมนู', planMeals: 'วางแผนเมนู', toastXp: 'ทำเมนูแล้ว +{xp} XP',
      hMore: 'ไม่อยู่บนหน้าแรก', 'more.ins': 'ประกัน', 'more.car': 'รถ', 'more.war': 'ประกันสินค้า', 'more.mnt': 'บำรุงรักษา (PM)', 'more.files': 'เอกสาร/ไฟล์',
      layoutTitle: 'จัดหน้าแรก', layoutReset: 'คืนค่าเริ่มต้น', layoutDone: 'เสร็จ', moveUp: 'เลื่อนขึ้น', moveDown: 'เลื่อนลง',
      'box.todo': 'ต้องทำวันนี้', 'box.money': 'เงินเดือนนี้', 'box.invest': 'พอร์ตลงทุน', 'box.learn': 'เรียนต่อ', 'box.health': 'สุขภาพ', 'box.meals': 'เมนูวันนี้',
      'pill.review': 'ถึงรอบ', 'pill.med': 'ถึงเวลา', 'pill.over': 'เกินงบ', 'pill.near': 'ใกล้เต็ม', 'pill.overdue': 'เลย {n} วัน', 'pill.today': 'วันนี้', 'pill.inDays': 'อีก {n} วัน',
      'pill.late': 'เลยกำหนด', 'pill.due': 'ถึงกำหนด', 'pill.almost': 'ใกล้ถึง',
      'todo.review': 'ทบทวน{src} {n} ใบ', 'todo.minutes': 'ประมาณ {m} นาที', 'todo.med': 'กินยา · {name}', 'todo.budget': '{cat} ใช้ไป {pct}% ของงบ', 'todo.ins': 'ต่ออายุประกัน · {title}',
      'todo.war': 'ประกันสินค้าหมด · {name}', 'todo.mntOne': 'งานบำรุงรักษา · {name}', 'todo.mntLate': 'งานบำรุงรักษาเลยกำหนด {n} รายการ', 'todo.mntDue': 'งานบำรุงรักษาถึงกำหนด {n} รายการ',
      'act.review': 'ทบทวน', 'act.take': 'กินแล้ว', 'act.open': 'เปิด',
      policy: 'กรมธรรม์', ends: 'หมด {d}', timeAt: '{t} น.', within: 'ภายใน {d}', lateDays: 'เลย {n} วัน',
      'ins.life': 'ชีวิต', 'ins.health': 'สุขภาพ', 'ins.car': 'รถ', 'ins.home': 'บ้าน',
      'car.act': 'พ.ร.บ.', 'car.tax': 'ภาษีรถประจำปี', 'car.insurance': 'ประกันภาคสมัครใจ', 'car.inspect': 'ตรวจสภาพ (ตรอ.)', 'car.service': 'เข้าศูนย์', dueByKm: 'ถึงกำหนดตามไมล์', atKm: 'ที่ {n} กม.', car: 'รถ',
      'freq.Daily': 'รายวัน', 'freq.Weekly': 'รายสัปดาห์', 'freq.M1': 'รายเดือน', 'freq.M3': 'ราย 3 เดือน', 'freq.M6': 'ราย 6 เดือน', 'freq.Annually': 'รายปี'
    },
    en: {
      title: 'Tanot — Today', morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening',
      qExpense: 'Expense', qIncome: 'Income', qReview: 'Review', qSearch: 'Search', qLayout: 'Customise home',
      hTodo: 'To do today', todoNone: 'Nothing pending', todoCount: '{n} items',
      hSpend: "This month's money", lBudget: 'Income & expenses', income: 'Income', expense: 'Expenses', balance: 'Balance', emptySpend: 'No entries this month', openBudget: 'Open income & expenses',
      unknownCat: 'Unknown category', usedPct: '{pct}% of budget used', budgetOf: '{spent} / {budget}', shareOf: '{pct}% of spending',
      hStock: 'Investment portfolio', lInvest: 'Investing', emptyInvest: 'No investment assets yet', openInvest: 'Open investing', changeToday: 'Today', change30: '30 days',
      noFx: 'USD assets excluded (no exchange rate yet)', priceAt: 'Price as of {d}', sparkAria: 'Portfolio value, last 30 days', noQuote: '—', watchAria: 'Watchlist',
      hLearn: 'Keep learning', lLearn: 'Education', streak: 'Streak', days: 'days', week7: 'Last 7 days', xpToday: 'XP today', cardsDue: 'Cards due', review: 'Review',
      'dot.done': 'Practised', 'dot.rest': 'Rest day', 'dot.miss': 'Missed', 'dot.today': 'Not practised yet today',
      cont: 'Continue', nextT: 'Next: {t}', doneN: '{n} lessons done', readN: '{n} topics read', phrasesN: '{n} phrases practised', xpN: '{n} XP', openedAt: 'Opened {when}',
      emptyLearn: 'Nothing started yet', openLearn: 'Start learning', allDone: 'All lessons done',
      'src.law': 'Law', 'src.lang': 'Languages', 'src.biz': 'Business', 'src.eng': 'Engineering', 'src.books': 'Books', 'src.music': 'Music', 'src.sports': 'Sports', 'src.cooking': 'Cooking',
      'lang.lang-en': 'English', 'lang.lang-jp': 'Japanese', 'lang.lang-cn': 'Mandarin Chinese', 'lang.lang-yue': 'Cantonese', 'lang.lang-kr': 'Korean', 'lang.lang-de': 'German',
      'lang.lang-in': 'Hindi', 'lang.lang-fr': 'French', 'lang.lang-it': 'Italian', 'lang.lang-mm': 'Burmese', 'lang.lang-kh': 'Khmer', 'lang.lang-la': 'Lao',
      'lang.lang-vn': 'Vietnamese', 'lang.lang-my': 'Malay', 'lang.lang-ar': 'Arabic', 'lang.lang-es': 'Spanish', 'lang.lang-pt': 'Portuguese', 'lang.lang-ru': 'Russian',
      hHealth: 'Health', lHealth: 'Open health', weight: 'Weight', bp: 'Blood pressure', kg: 'kg', weightChange: '{d} kg in 30 days', workout: 'Exercise this week {a} / {b} min', workoutAria: 'Exercise vs goal',
      noHealth: 'No health data yet', openHealth: 'Log health',
      hMeals: "Today's menu", lMeals: 'Meal plan', 'meal.b': 'Breakfast', 'meal.l': 'Lunch', 'meal.d': 'Dinner', notPicked: 'Not chosen', cooked: 'Cooked', undo: 'Undo', servingsN: '{n} servings',
      toBuy: '{n} items left to buy', emptyMeals: 'No meals planned today', planMeals: 'Plan meals', toastXp: 'Cooked +{xp} XP',
      hMore: 'Not on home', 'more.ins': 'Insurance', 'more.car': 'Car', 'more.war': 'Warranties', 'more.mnt': 'Maintenance (PM)', 'more.files': 'Documents & files',
      layoutTitle: 'Customise home', layoutReset: 'Reset to default', layoutDone: 'Done', moveUp: 'Move up', moveDown: 'Move down',
      'box.todo': 'To do today', 'box.money': "This month's money", 'box.invest': 'Investment portfolio', 'box.learn': 'Keep learning', 'box.health': 'Health', 'box.meals': "Today's menu",
      'pill.review': 'Due', 'pill.med': 'Due now', 'pill.over': 'Over budget', 'pill.near': 'Almost full', 'pill.overdue': '{n}d late', 'pill.today': 'Today', 'pill.inDays': 'In {n}d',
      'pill.late': 'Overdue', 'pill.due': 'Due', 'pill.almost': 'Almost due',
      'todo.review': 'Review {src}: {n} cards', 'todo.minutes': 'About {m} min', 'todo.med': 'Take medication · {name}', 'todo.budget': '{cat}: {pct}% of budget used', 'todo.ins': 'Insurance renewal · {title}',
      'todo.war': 'Warranty ends · {name}', 'todo.mntOne': 'Maintenance task · {name}', 'todo.mntLate': '{n} maintenance tasks overdue', 'todo.mntDue': '{n} maintenance tasks due',
      'act.review': 'Review', 'act.take': 'Taken', 'act.open': 'Open',
      policy: 'Policy', ends: 'Ends {d}', timeAt: '{t}', within: 'By {d}', lateDays: '{n} days late',
      'ins.life': 'Life', 'ins.health': 'Health', 'ins.car': 'Car', 'ins.home': 'Home',
      'car.act': 'Compulsory insurance', 'car.tax': 'Annual road tax', 'car.insurance': 'Voluntary insurance', 'car.inspect': 'Vehicle inspection', 'car.service': 'Service', dueByKm: 'Due by mileage', atKm: 'At {n} km', car: 'Car',
      'freq.Daily': 'Daily', 'freq.Weekly': 'Weekly', 'freq.M1': 'Monthly', 'freq.M3': 'Every 3 months', 'freq.M6': 'Every 6 months', 'freq.Annually': 'Yearly'
    }
  });
  function T(k, v) { return I18N ? I18N.t('today.' + k, v) : ''; }
  function lang() { return I18N ? I18N.lang() : 'th'; }
  function dstr(d, o) { return I18N ? I18N.date(d, o) : d.toLocaleDateString('th-TH', o); }

  var TD = window.TanotData, HM = window.HomeCalc, LC = window.LearnCore, HC = window.HealthCalc, CP = window.CookPlan, IC = window.InvestCalc;
  var NAV_KEY = 'tanot:nav:last', LAYOUT_KEY = 'tanot:home:layout', CACHE_KEY = 'tanot:home:cache';
  function rd(k, d) {
    if (TD && TD.read) return TD.read(k, d);
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; }
  }
  function rdIdb(db, store, opts) { return TD && TD.readIdb ? TD.readIdb(db, store, opts) : Promise.resolve([]); }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function icon(name, cls) { return '<svg class="ome-icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function num(n, d) { var r = Math.round(n * Math.pow(10, d || 0)) / Math.pow(10, d || 0); return I18N ? I18N.number(r, { maximumFractionDigits: d || 0 }) : r.toLocaleString('th-TH', { maximumFractionDigits: d || 0 }); }
  function baht(n) { return '฿' + num(n, n % 1 ? 2 : 0); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isArr(v) { return Array.isArray(v); }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  /* สถานะว่างของกล่อง: ข้อความชวนเริ่ม 1 บรรทัด + ปุ่มเดียว จัดกลางแนวตั้ง (CSS .empty.compact) */
  function emptyHtml(ic, text, href, label) {
    return '<div class="empty compact">' + icon(ic) + '<p>' + esc(text) + '</p>' + (href ? '<a class="btn sm" href="' + href + '">' + esc(label) + '</a>' : '') + '</div>';
  }
  function meterHtml(pct, cls, label) {
    var p = Math.max(0, Math.min(100, pct));
    return '<div class="meter ' + (cls || '') + '" role="progressbar" aria-label="' + esc(label || '') + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(p) + '"><i style="width:' + p.toFixed(1) + '%"></i></div>';
  }
  function ago(ts) {
    var s = Math.max(0, (Date.now() - ts) / 1000), units = [['day', 86400], ['hour', 3600], ['minute', 60]];
    try {
      var f = new Intl.RelativeTimeFormat(lang(), { numeric: 'auto' });
      for (var i = 0; i < units.length; i++) if (s >= units[i][1]) return f.format(-Math.floor(s / units[i][1]), units[i][0]);
      return f.format(0, 'minute');
    } catch (e) { return dstr(new Date(ts)); }
  }

  /* ── หัว + ปุ่มด่วน ── */
  function renderHead() {
    var now = new Date(), h = now.getHours();
    $('greet').textContent = T(h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening');
    $('dateLine').textContent = dstr(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* ── เงินเดือนนี้: รายรับ/รายจ่าย/คงเหลือ + 3 หมวดที่ใช้มากสุดเทียบงบ ── */
  function renderSpend() {
    var el = $('spendBody'), records = rd('budget:records', []), budgets = rd('budget:budgets', {}), cats = rd('budget:categories', []);
    if (!isArr(records)) records = [];
    if (!isArr(cats)) cats = [];
    var now = new Date(), mk = now.getFullYear() + '-' + pad2(now.getMonth() + 1);
    var s = HM.monthSummary(records, budgets, mk, 3);
    if (!s.any) { el.innerHTML = emptyHtml('wallet', T('emptySpend'), 'budget.html', T('openBudget')); return; }
    var catName = {};
    cats.forEach(function (c) { if (c) catName[c.id] = I18N ? I18N.catName(c) : c.name; });
    var html = '<div class="strip three">' +
      '<div class="strip-cell"><span class="k">' + esc(T('income')) + '</span><span class="v" data-s="income">' + baht(s.income) + '</span></div>' +
      '<div class="strip-cell"><span class="k">' + esc(T('expense')) + '</span><span class="v" data-s="expense">' + baht(s.expense) + '</span></div>' +
      '<div class="strip-cell"><span class="k">' + esc(T('balance')) + '</span><span class="v ' + (s.balance < 0 ? 'down' : '') + '" data-s="balance">' + (s.balance < 0 ? '−' : '') + baht(Math.abs(s.balance)) + '</span></div></div>';
    html += '<div class="card-foot meter-list">' + s.cats.map(function (c) {
      var cls = c.budget ? (c.pct >= 100 ? 'err' : c.pct >= 90 ? 'warn' : '') : '';
      return '<div class="meter-row" data-cat="' + esc(c.id) + '"><span class="name">' + esc(catName[c.id] || T('unknownCat')) + '</span>' +
        '<span class="val">' + esc(c.budget ? T('budgetOf', { spent: baht(c.spent), budget: baht(c.budget) }) : baht(c.spent)) + '</span>' +
        meterHtml(c.pct, cls, c.budget ? T('usedPct', { pct: Math.round(c.pct) }) : T('shareOf', { pct: Math.round(c.pct) })) + '</div>';
    }).join('') + '</div>';
    el.innerHTML = html;
  }

  /* ── พอร์ตลงทุน (หัวข้อ 6 ของ docs/invest-consolidation-design.md) — สูตรมูลค่าอยู่ใน InvestCalc.netWorth ── */
  var NW_KEY = 'tanot:invest:networth';
  var INV_KEYS = ['thstock', 'globalstock', 'btc', 'gold', 'thaifund', 'spfund', 'govbond', 'gsblottery', 'baaclottery'];
  function pctHtml(p, label, d) {
    if (p == null || !isFinite(p)) return '';
    return '<span class="' + (p >= 0 ? 'up' : 'down') + '">' + (p >= 0 ? '+' : '−') + num(Math.abs(p), d == null ? 1 : d) + '%' + (label || '') + '</span>';
  }
  function plHtml(v) { return '<span class="' + (v >= 0 ? 'up' : 'down') + '">' + (v >= 0 ? '+' : '−') + '฿' + num(Math.abs(v), 0) + '</span>'; }
  function readInvest() {
    var data = {};
    INV_KEYS.forEach(function (k) { var v = rd('tanot:invest:' + k, []); data[k] = isArr(v) ? v : []; });
    return data;
  }
  /* snapshot รายวัน: เขียนเมื่อยังไม่มีแถวของวันนั้น (เวลาไทย) หรือมูลค่าเปลี่ยน ≥ 0.1% และห่างจากครั้งก่อน ≥ 1 ชม. · ไม่ลบแถวเก่า */
  function writeSnapshot(nw, now) {
    var row = IC.snapshotRow(nw, now), list = rd(NW_KEY, []);
    if (!isArr(list)) list = [];
    var prev = null;
    list.forEach(function (r) { if (r && r.d === row.d) prev = r; });
    if (!IC.shouldWriteSnapshot(prev, row, now)) return list;
    if (TD && TD.update) {
      return TD.update(NW_KEY, function (cur) {
        cur = isArr(cur) ? cur : [];
        var hit = -1;
        cur.forEach(function (r, i) { if (r && r.d === row.d) hit = i; });
        if (hit >= 0) cur[hit] = row; else cur.push(row);
        return cur;
      });
    }
    return list;
  }
  function sparkHtml(points) {
    var sp = HM.spark(points, 300, 64, 4);
    if (!sp) return '';
    return '<div class="spark" role="img" aria-label="' + esc(T('sparkAria')) + '"><svg viewBox="0 0 300 64" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="spark-area" d="' + sp.area + '"/><path class="spark-line" d="' + sp.line + '"/></svg><i class="spark-dot" style="left:' + sp.last.x + '%;top:' + sp.last.y + '%"></i></div>';
  }
  function watchHtml() {
    var data = readInvest(), tw = rd('tanot:invest:hub:watch:thai', null), gw = rd('tanot:invest:hub:watch:global', null);
    var held = function (k) { return data[k].map(function (r) { return r && r.sym; }); };
    var list = HM.watchList(isArr(tw) ? tw : [], isArr(gw) ? gw : [], held('thstock'), held('globalstock'), 3);
    if (!list.length) return '';
    return '<div class="list plain card-foot" role="list" aria-label="' + esc(T('watchAria')) + '">' + list.map(function (w) {
      var q = rd(IC.quoteKey(w.yahoo), null), px = q && isFinite(q.price) ? +q.price : null, prev = q && isFinite(q.prev) && q.prev ? +q.prev : null;
      var chg = px != null && prev != null ? (px / prev - 1) * 100 : null;
      return '<a class="list-row" role="listitem" href="' + esc(w.href) + '" data-sym="' + esc(w.sym) + '"><div class="grow"><div class="title">' + esc(w.sym) + '</div></div>' +
        '<div class="end"><span class="amt">' + (px != null ? num(px, 2) : esc(T('noQuote'))) + '</span>' + (chg != null ? '<span class="amt">' + pctHtml(chg, '', 2) + '</span>' : '') + '</div></a>';
    }).join('') + '</div>';
  }
  function renderInvest() {
    var el = $('investBody');
    if (!IC) { el.innerHTML = ''; return; }
    var data = readInvest(), now = Date.now();
    var prices = IC.collectPrices(function (k) { return rd(k, null); }, data);
    var nw = IC.netWorth(data, prices, prices.fx, now);
    if (!nw.rows.length) { el.innerHTML = emptyHtml('trending-up', T('emptyInvest'), 'invest.html', T('openInvest')); return; }
    var hist = writeSnapshot(nw, now), today = IC.thaiDate(now);
    /* เปลี่ยนแปลงเทียบ snapshot ≥ 30 วันก่อน (แถวล่าสุดที่เก่าถึงเกณฑ์) */
    var cutoff = IC.thaiDate(now - 30 * 86400000), base = null;
    (isArr(hist) ? hist : []).forEach(function (r) { if (r && typeof r.d === 'string' && r.d <= cutoff && isFinite(r.v) && r.v > 0 && (!base || r.d > base.d)) base = r; });
    var change = base && nw.n > 0 ? (nw.total / base.v - 1) * 100 : null;
    var dc = HM.dayChange(isArr(hist) ? hist : [], today, nw.total);

    var html = '<div class="home-big" data-i="total">฿' + num(nw.total, 0) + '</div>';
    var sub = [];
    if (dc) sub.push('<span data-i="today">' + esc(T('changeToday')) + ' ' + plHtml(dc.delta) + ' (' + pctHtml(dc.pct, '', 2) + ')</span>');
    if (nw.cost > 0) sub.push('<span data-i="pl">P/L ' + plHtml(nw.pl) + ' (' + pctHtml(nw.plPct, '', 2) + ')</span>');
    if (change != null) sub.push('<span data-i="change">' + esc(T('change30')) + ' ' + pctHtml(change) + '</span>');
    if (sub.length) html += '<div class="sub">' + sub.join(' · ') + '</div>';
    var warn = [];
    if (nw.missingFx) warn.push('<span class="badge warn" data-i="nofx">' + esc(T('noFx')) + '</span>');
    if (nw.stale) {
      var old = nw.rows.filter(function (r) { return r.stale && r.priceTs; }).sort(function (a, b) { return a.priceTs - b.priceTs; })[0];
      if (old) warn.push('<span class="badge warn" data-i="stale">' + esc(T('priceAt', { d: dstr(new Date(old.priceTs), { day: 'numeric', month: 'short' }) })) + '</span>');
    }
    if (warn.length) html += '<div class="row">' + warn.join('') + '</div>';
    html += sparkHtml(HM.series30(isArr(hist) ? hist : [], today, nw.total));
    html += watchHtml();
    el.innerHTML = html;
  }

  /* ── เรียนต่อ ── */
  var STUDY_SRC = ['lang', 'law', 'eng', 'biz', 'music', 'sports', 'cooking'];
  var studyCounts = null;     // การ์ดถึงรอบ (ต้องรอ IndexedDB ของกฎหมาย) — renderAll เติมให้
  var totalsLoading = {};
  function cache() { var c = lsGet(CACHE_KEY); return c && typeof c === 'object' ? c : {}; }
  /* ดึงยอดรวมบท/วลีจากหน้าของวิชาเอง (same-origin) เมื่อผู้ใช้มีความคืบหน้าแต่ยังไม่มียอดรวม/เก่าเกิน 14 วัน */
  function ensureTotals(need) {
    var c = cache(), now = Date.now(), fresh = HM.cacheFresh(c, now);
    need.forEach(function (src) {
      var has = src === 'lang' ? c.lang : c[src];
      if (fresh && has) return;
      if (totalsLoading[src]) return;
      var page = { lang: 'languages.html', biz: 'classroom-business.html', eng: 'classroom-engineering.html' }[src];
      var tag = src === 'lang' ? 'lang-data' : 'course-data';
      totalsLoading[src] = true;
      fetch(page, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (html) {
        var m = new RegExp('<script id="' + tag + '" type="application/json">([\\s\\S]*?)</script>').exec(html);
        if (!m) throw new Error('no data');
        var data = JSON.parse(m[1]), cur = cache();
        if (src === 'lang') cur.lang = HM.langMeta(data); else cur[src] = HM.lbeTopics(src, data);
        cur.ts = Date.now();
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cur)); } catch (e) {}
        totalsLoading[src] = false;
        renderLearn();
      }).catch(function () { totalsLoading[src] = false; });
    });
  }
  function studyRows(sum) {
    var c = cache(), nav = rd(NAV_KEY, {}), rows = [], need = [];
    var lang = HM.langRows(rd('lang-practice:progress', {}), c.lang);
    if (lang.length) { rows = rows.concat(lang); if (!c.lang || !HM.cacheFresh(c, Date.now())) need.push('lang'); }
    ['biz', 'eng'].forEach(function (src) {
      var comp = rd('lbe:' + (src === 'biz' ? 'business' : 'engineering') + ':completed', {}), r = HM.lbeRow(src, comp, c[src]);
      if (r) { rows.push(r); if (!c[src] || !HM.cacheFresh(c, Date.now())) need.push(src); }
    });
    var law = HM.lawRow(rd('tanot:barprep:lessonread', {}));
    if (law) rows.push(law);
    ['music', 'sports', 'cooking'].forEach(function (src) { var r = HM.hobbyRow(src, rd('tanot:' + src + ':progress', {})); if (r) rows.push(r); });
    // วิชาที่เปิดไว้/มี XP แต่ยังไม่มีความคืบหน้าให้แสดง → แถวเท่าที่มี (XP + เปิดล่าสุด) ลิงก์ไปหน้านั้น
    STUDY_SRC.forEach(function (src) {
      if (rows.some(function (r) { return r.src === src; })) return;
      if (nav[LC.SOURCES[src].href] || (sum.bySrc[src] || 0) > 0) rows.push({ src: src, done: null, total: null, pct: null });
    });
    rows = HM.sortStudy(rows, nav, function (src) { return LC.SOURCES[src].href; });
    return { rows: rows, need: need };
  }
  function rowHtml(r, sum) {
    var S = LC.SOURCES[r.src], href = r.src === 'lang' && r.langId ? S.href + '#' + r.langId : S.href;
    var title = r.src === 'lang' && r.langId ? (T('lang.' + r.langId) || r.title) : T('src.' + r.src);
    var info = [];
    if (r.pct != null) info.push(r.next ? T('nextT', { t: r.next }) : T('allDone'));
    else if (r.src === 'lang' && r.marked) info.push(T('phrasesN', { n: num(r.marked) }));
    else if (r.src === 'law' && r.done) info.push(T('readN', { n: num(r.done) }));
    else if (r.done) info.push(T('doneN', { n: num(r.done) }));
    else if ((sum.bySrc[r.src] || 0) > 0) info.push(T('xpN', { n: num(sum.bySrc[r.src]) }));
    if (r.lastOpen) info.push(T('openedAt', { when: ago(r.lastOpen) }));
    return '<div class="list-row" data-src="' + r.src + '"' + (r.langId ? ' data-lang="' + esc(r.langId) + '"' : '') + '><span class="lead">' + icon(S.icon) + '</span>' +
      '<div class="grow"><div class="title" data-i18n-skip>' + esc(title) + '</div><div class="meta">' + esc(info.join(' · ')) + '</div>' +
      (r.pct != null ? meterHtml(r.pct, '', title) : '') + '</div>' +
      '<div class="end">' + (r.pct != null ? '<span class="amt" data-p>' + r.pct + '%</span>' : '') + '<a class="btn sm" href="' + esc(href) + '">' + esc(T('cont')) + '</a></div></div>';
  }
  function renderLearn() {
    var el = $('learnBody');
    if (!LC) return;
    var sum = LC.summary(), counts = studyCounts || { lang: 0, law: 0, biz: 0, eng: 0, books: 0 };
    var total = 0;
    Object.keys(counts).forEach(function (k) { total += counts[k]; });
    var st = sum.streak, st2 = studyRows(sum);
    if (!st2.rows.length && !st.count && !sum.total) { el.innerHTML = emptyHtml('graduation-cap', T('emptyLearn'), 'area.html?a=edu', T('openLearn')); return; }
    var pct = Math.min(100, sum.goal ? Math.round(sum.todayXp / sum.goal * 100) : 0);
    var dots = HM.weekDots(sum.recent, st), wd = I18N ? I18N.weekdays('short') : ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    var html = '<div class="strip four" data-l="strip">' +
      '<div class="strip-cell"><span class="k">' + esc(T('streak')) + '</span><span class="v" data-l="streak">' + icon('flame', st.count ? 'flame' : '') + ' ' + num(st.count) + ' <small>' + esc(T('days')) + '</small></span></div>' +
      '<div class="strip-cell"><span class="k">' + esc(T('week7')) + '</span><span class="dots" data-l="dots">' + dots.map(function (d) {
        var dt = new Date(d.d + 'T00:00:00');
        return '<span class="dotcol"><i class="dot ' + d.state + '" role="img" aria-label="' + esc(T('dot.' + d.state)) + '" title="' + esc(T('dot.' + d.state)) + '"></i><small>' + esc(wd[dt.getDay()]) + '</small></span>';
      }).join('') + '</span></div>' +
      '<div class="strip-cell"><span class="k">' + esc(T('xpToday')) + '</span><span class="v" data-l="xp">' + num(sum.todayXp) + ' <small>/ ' + num(sum.goal) + '</small></span>' + meterHtml(pct, sum.goalMet ? 'ok' : '', T('xpToday')) + '</div>' +
      '<div class="strip-cell"><span class="k">' + esc(T('cardsDue')) + '</span><span class="v" data-l="due">' + num(total) + '</span><a class="btn sm primary" href="review.html">' + esc(T('review')) + '</a></div></div>';
    if (st2.rows.length) html += '<div class="list plain cols-2" id="studyList">' + st2.rows.map(function (r) { return rowHtml(r, sum); }).join('') + '</div>';
    el.innerHTML = html;
    if (st2.need.length) ensureTotals(st2.need);
  }

  /* ── สุขภาพ: น้ำหนัก + เปลี่ยนใน 30 วัน, ความดันล่าสุด, ออกกำลังกายสัปดาห์นี้เทียบเป้า (ยาที่ค้างอยู่ในรายการ "ต้องทำวันนี้") ── */
  function renderHealth() {
    var el = $('healthBody');
    var vitals = rd('tanot:health:vitals', []), meds = rd('tanot:health:meds', []), workouts = rd('tanot:health:workouts', []);
    vitals = isArr(vitals) ? vitals : []; meds = isArr(meds) ? meds : []; workouts = isArr(workouts) ? workouts : [];
    if (!HC || (!vitals.length && !meds.length && !workouts.length)) { el.innerHTML = emptyHtml('heart-pulse', T('noHealth'), 'health.html', T('openHealth')); return; }
    var ranges = rd('tanot:health:ranges', {});
    var s = HC.summary(vitals, [], [], Date.now()), w = s.latest.weight, wc = HC.change(vitals, 'weight', 30);
    var cls = function (f) { var st = HC.status(s.latest[f].v, HC.rangeOf(f, ranges)); return st === 'err' ? 'err' : st === 'warn' ? 'warn' : ''; };
    var bpCls = s.latest.sys && s.latest.dia ? (cls('sys') === 'err' || cls('dia') === 'err' ? 'err' : cls('sys') || cls('dia')) : '';
    var html = '<div class="strip two">' +
      '<div class="strip-cell"><span class="k">' + esc(T('weight')) + '</span><span class="v" data-h="weight">' + (w ? num(w.v, HC.METRICS.weight.dec) + ' <small>' + esc(T('kg')) + '</small>' : '—') + '</span>' +
      '<span class="s" data-h="weightChange">' + (wc ? esc(T('weightChange', { d: (wc.delta > 0 ? '+' : wc.delta < 0 ? '−' : '') + num(Math.abs(wc.delta), 1) })) : '') + '</span></div>' +
      '<div class="strip-cell"><span class="k">' + esc(T('bp')) + '</span><span class="v ' + bpCls + '" data-h="bp">' + (s.latest.sys && s.latest.dia ? num(s.latest.sys.v) + '/' + num(s.latest.dia.v) + ' <small>mmHg</small>' : '—') + '</span><span class="s"></span></div></div>';
    var ws = HC.workoutSummary(workouts, rd('tanot:health:settings', {}), Date.now());
    html += '<div class="card-foot" data-h="workout"><div class="sub">' + esc(T('workout', { a: num(ws.weekMinutes, 1), b: num(ws.goal) })) + '</div>' +
      meterHtml(Math.min(100, ws.pct), ws.weekMinutes >= ws.goal ? 'ok' : '', T('workoutAria')) + '</div>';
    el.innerHTML = html;
  }

  /* ── เมนูวันนี้ (แผนสัปดาห์ของหน้าทำอาหาร) ── */
  var K_PLAN = 'tanot:cooking:plans';
  function renderMeals() {
    var el = $('mealsBody');
    if (!CP) { el.innerHTML = ''; return; }
    var recipes = CP.effectiveRecipes(rd('tanot:cooking:recipes', []), Date.now()), plans = rd(K_PLAN, []);
    var tm = CP.todayMeals(isArr(plans) ? plans : [], recipes, Date.now());
    if (!tm.slots.some(function (s) { return s.planned; })) { el.innerHTML = emptyHtml('chef-hat', T('emptyMeals'), 'cooking.html', T('planMeals')); return; }
    var html = '<div class="list plain" id="mealList">' + tm.slots.map(function (s) {
      var name = s.recipe ? s.recipe.name : (s.planned ? '' : T('notPicked'));
      return '<div class="list-row" data-slot="' + s.slot + '"><span class="lead">' + icon('chef-hat') + '</span><div class="grow"><div class="title"' + (s.recipe ? ' data-i18n-skip' : '') + '>' + esc(name) + '</div>' +
        '<div class="meta">' + esc(T('meal.' + s.meal)) + (s.planned ? ' · ' + esc(T('servingsN', { n: s.servings })) : '') + '</div></div>' +
        (s.planned ? '<div class="end">' + (s.done ? '<span class="badge ok">' + esc(T('cooked')) + '</span>' : '') + '<button class="btn sm' + (s.done ? '' : ' primary') + '" type="button" data-act="cook" data-slot="' + s.slot + '">' + esc(s.done ? T('undo') : T('cooked')) + '</button></div>' : '') + '</div>';
    }).join('') + '</div>';
    var shop = rd('tanot:cooking:shopping', []), sid = CP.shopId(tm.week), left;
    var list = (isArr(shop) ? shop : []).filter(function (r) { return r && r.id === sid; })[0];
    if (list) { var view = CP.shoppingView(list, shop.filter(function (r) { return CP.isTickRow(r) && r.listId === sid; })); left = view.count - view.checked; }
    else left = CP.aggregate(tm.plan, recipes).length;
    html += '<a class="btn ghost sm card-foot" href="cooking.html" data-m="toBuy">' + esc(T('toBuy', { n: num(Math.max(0, left)) })) + '</a>';
    el.innerHTML = html;
  }
  function cookSlot(slot) {
    var gave = false;
    TD.update(K_PLAN, function (rows) {
      rows = isArr(rows) ? rows : [];
      var week = CP.weekStart(Date.now()), id = CP.planId(week), i = rows.findIndex(function (x) { return x && x.id === id; });
      var plan = CP.cleanPlan(i >= 0 ? rows[i] : null, week);
      var res = CP.toggleDone(plan, slot, Date.now()); // ตรรกะเดียวกับปุ่ม "ทำแล้ว" ในหน้าทำอาหาร
      if (!res) return undefined;
      gave = res.gave;
      if (i === -1) rows.push(plan); else rows[i] = plan;
      return rows;
    });
    if (gave && LC) { var xp = LC.award('cooking', CP.XP_PER_MEAL); if (xp && window.tanotToast) window.tanotToast(T('toastXp', { xp: xp }), 'ok'); }
  }
  function takeDose(medId, time) {
    var meds = rd('tanot:health:meds', []), med = (isArr(meds) ? meds : []).filter(function (m) { return m && m.id === medId; })[0];
    if (!med || !HC) return;
    var now = Date.now(), ymd = HC.ictDate(now);
    TD.update('tanot:health:intake', function (rows) {
      rows = isArr(rows) ? rows : [];
      var id = HC.intakeId(medId, ymd, time);
      if (rows.some(function (x) { return x && x.id === id; })) return undefined;
      rows.push(HC.makeIntake(med, ymd, time, now)); // แถวเดียวกับที่ปุ่ม "กินแล้ว" ในหน้าสุขภาพเขียน (id ตายตัว — 2 เครื่องกดพร้อมกัน = แถวเดียว)
      return rows;
    });
  }

  /* ── ต้องทำวันนี้: รวมจากทุกโมดูล เรียงตามความเร่ง ── */
  function dueText(d) { return d < 0 ? T('pill.overdue', { n: num(-d) }) : d === 0 ? T('pill.today') : T('pill.inDays', { n: num(d) }); }
  function insType(t) { return t ? (T('ins.' + t) || '') : ''; }
  function carTitle(v, CC) { var t = CC.title(v); return t === 'รถ' ? T('car') : t; }
  function collectTodos(ctx) {
    var out = [], now = new Date(), nowMs = now.getTime(), mk = now.getFullYear() + '-' + pad2(now.getMonth() + 1);
    // การ์ดถึงรอบ แยกตามวิชา
    HM.reviewTodos(ctx.counts, ['lang', 'law', 'biz', 'eng', 'books']).forEach(function (r) {
      out.push({ kind: 'review', urgency: r.urgency, sort: r.sort, pill: T('pill.review'), title: T('todo.review', { src: T('src.' + r.src), n: num(r.n) }), meta: T('todo.minutes', { m: num(r.minutes) }),
        act: { href: 'review.html#' + r.src, label: T('act.review') } });
    });
    // ยาที่ถึงเวลาแล้วและยังไม่ติ๊ก
    if (HC) {
      var meds = rd('tanot:health:meds', []), intake = rd('tanot:health:intake', []);
      HM.medTodos(HC.todayDoses(isArr(meds) ? meds : [], isArr(intake) ? intake : [], nowMs)).slice(0, 6).forEach(function (m) {
        var d = m.dose;
        out.push({ kind: 'med', urgency: m.urgency, sort: m.sort, pill: T('pill.med'), title: T('todo.med', { name: d.med.name }), meta: T('timeAt', { t: d.time }) + (d.med.dose ? ' · ' + d.med.dose : ''),
          act: { btn: 'take', med: d.med.id, time: d.time, label: T('act.take') } });
      });
    }
    // หมวดงบที่ใช้ ≥ 90%
    var cats = rd('budget:categories', []), catName = {};
    (isArr(cats) ? cats : []).forEach(function (c) { if (c) catName[c.id] = I18N ? I18N.catName(c) : c.name; });
    HM.budgetAlerts(rd('budget:records', []), rd('budget:budgets', {}), mk, 0.9).forEach(function (b) {
      out.push({ kind: 'budget', urgency: b.urgency, sort: b.sort, pill: T(b.urgency === 'err' ? 'pill.over' : 'pill.near'), title: T('todo.budget', { cat: catName[b.catId] || T('unknownCat'), pct: num(b.pct) }),
        meta: baht(b.spent) + ' / ' + baht(b.budget), act: { href: 'budget.html', label: T('act.open') } });
    });
    // ประกันต่ออายุ ≤ 30 วัน
    var INS = window.InsuranceCalc, pol = rd('tanot:insurance:policies', []);
    if (INS && isArr(pol)) INS.renewals(pol, now, 30).forEach(function (r) {
      var p = r.policy, title = [p.insurer, p.name].filter(Boolean).join(' · ') || insType(p.type) || T('policy');
      out.push({ kind: 'ins', urgency: HM.urgencyOfDays(r.days), sort: r.days, pill: dueText(r.days), title: T('todo.ins', { title: title }), meta: [insType(p.type), p.premium ? baht(p.premium) : ''].filter(Boolean).join(' · '),
        act: { href: 'insurance.html', label: T('act.open') } });
    });
    // รถ (พ.ร.บ./ภาษี/ประกัน/ตรอ./นัดศูนย์) ≤ 30 วัน
    var CC = window.CarCalc, vehicles = rd('tanot:car:vehicles', []), services = rd('tanot:car:services', []);
    if (CC && isArr(vehicles)) CC.dueList(vehicles, isArr(services) ? services : [], rd('tanot:insurance:policies', []), now, 30).forEach(function (x) {
      var byKm = x.kind === 'service' && !x.date, urg = byKm ? (x.service.state === 'overdue' ? 'err' : 'warn') : HM.urgencyOfDays(x.days);
      out.push({ kind: 'car', urgency: urg, sort: byKm ? (urg === 'err' ? -1 : 3) : x.days, pill: byKm ? T(urg === 'err' ? 'pill.due' : 'pill.almost') : dueText(x.days),
        title: (T('car.' + x.kind) || x.label) + ' · ' + carTitle(x.vehicle, CC),
        meta: x.date ? dstr(CC.parseDate(x.date), { day: 'numeric', month: 'short', year: 'numeric' }) : (x.service && x.service.nextKm ? T('atKm', { n: num(x.service.nextKm) }) : ''), act: { href: 'car.html', label: T('act.open') } });
    });
    // ประกันสินค้าหมด ≤ 30 วัน
    var RC = window.ReceiptsCalc, rec = rd('tanot:receipts:items', []);
    if (RC && isArr(rec)) RC.expiring(rec.filter(function (r) { return r && RC.warrantyEnd(r); }), now, 30).forEach(function (x) {
      out.push({ kind: 'war', urgency: HM.urgencyOfDays(x.days), sort: x.days, pill: dueText(x.days), title: T('todo.war', { name: RC.warrantyLabel(x.receipt) }),
        meta: [x.receipt.store, T('ends', { d: dstr(RC.parseDate(x.end), { day: 'numeric', month: 'short', year: 'numeric' }) })].filter(Boolean).join(' · '), act: { href: 'receipts.html', label: T('act.open') } });
    });
    // งาน PM เกินกำหนด/ถึงกำหนด (สรุปเป็นแถวเดียวต่อสถานะ; ถ้ามีรายการเดียวแสดงรายการนั้น)
    if (ctx.pm) {
      [['overdue', 'err', -2, 'pill.late', 'todo.mntLate'], ['due', 'warn', 0.5, 'pill.due', 'todo.mntDue']].forEach(function (g) {
        var list = ctx.pm[g[0]];
        if (!list.length) return;
        var one = list.length === 1 ? list[0] : null, M = window.MntCalc;
        var codes = list.slice(0, 3).map(function (x) { return x.asset.code; }).join(', ') + (list.length > 3 ? ' +' + num(list.length - 3) : '');
        out.push({ kind: 'mnt', urgency: g[1], sort: g[2], pill: T(g[3]),
          title: one ? T('todo.mntOne', { name: one.asset.code + ' · ' + one.asset.name }) : T(g[4], { n: num(list.length) }),
          meta: one ? (T('freq.' + one.plan.freq) || M.FREQ_LABEL[one.plan.freq]) + ' · ' + (g[0] === 'overdue' ? T('lateDays', { n: num(one.daysLate) }) : T('within', { d: dstr(M.parseYmd(one.window.end), { day: 'numeric', month: 'short' }) })) : codes,
          act: { href: 'maintenance.html' + (one ? '#asset=' + encodeURIComponent(one.asset.id) : ''), label: T('act.open') } });
      });
    }
    return HM.sortTodos(out);
  }
  function todoRowHtml(t) {
    var act = t.act.btn ? '<button class="btn sm primary" type="button" data-act="' + t.act.btn + '" data-med="' + esc(t.act.med) + '" data-time="' + esc(t.act.time) + '">' + esc(t.act.label) + '</button>'
      : '<a class="btn sm" href="' + esc(t.act.href) + '">' + esc(t.act.label) + '</a>';
    return '<div class="todo-row" data-kind="' + t.kind + '" data-urg="' + t.urgency + '"><span class="pill ' + t.urgency + '">' + esc(t.pill) + '</span>' +
      '<div class="grow"><div class="title" data-i18n-skip>' + esc(t.title) + '</div>' + (t.meta ? '<div class="meta" data-i18n-skip>' + esc(t.meta) + '</div>' : '') + '</div><div class="end">' + act + '</div></div>';
  }
  function renderTodo(ctx) {
    var items = collectTodos(ctx), el = $('todoBody'), badge = $('todoCount');
    badge.hidden = !items.length;
    badge.textContent = items.length ? T('todoCount', { n: num(items.length) }) : '';
    el.innerHTML = items.length ? '<div class="list plain todo-list">' + items.map(todoRowHtml).join('') + '</div>'
      : '<div class="todo-none">' + icon('circle-check') + '<span>' + esc(T('todoNone')) + '</span></div>';
  }

  /* ── งาน PM (IndexedDB): เลยกำหนด/ถึงกำหนด ── */
  function readPm() {
    var M = window.MntCalc, assets = rd('tanot:mnt:assets', []), plans = rd('tanot:mnt:plans', []), settings = rd('tanot:mnt:settings', {});
    if (!M || !isArr(assets) || !assets.length) return Promise.resolve(null);
    var Y = new Date().getFullYear();
    return Promise.all([rdIdb('tanot-mnt-' + Y, 'insp'), rdIdb('tanot-mnt-' + (Y - 1), 'insp')]).then(function (r) {
      var done = M.doneIndex([].concat(r[0] || [], r[1] || []));
      var list = M.dueList({ assets: assets, plans: isArr(plans) ? plans : [], settings: settings || {}, done: done, today: M.ymd(new Date()), ahead: 0 });
      return { overdue: list.filter(function (x) { return x.state === 'overdue'; }), due: list.filter(function (x) { return x.state === 'due'; }) };
    }).catch(function () { return null; });
  }

  /* ── ไม่อยู่บนหน้าแรก + จัดหน้าแรก ── */
  var BOX_EL = { todo: 'boxTodo', money: 'boxMoney', invest: 'boxInvest', learn: 'boxLearn', health: 'boxHealth', meals: 'boxMeals' };
  var BOX_HREF = { money: 'budget.html', invest: 'invest.html', learn: 'area.html?a=edu', health: 'health.html', meals: 'cooking.html' };
  var MORE = [['ins', 'insurance.html'], ['car', 'car.html'], ['war', 'receipts.html'], ['mnt', 'maintenance.html'], ['files', 'area.html?a=work']];
  function layout() { return HM.cleanLayout(lsGet(LAYOUT_KEY)); }
  function saveLayout(l) { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(l)); } catch (e) {} applyLayout(); renderMore(); }
  function applyLayout() {
    var plan = HM.layoutPlan(layout());
    Object.keys(BOX_EL).forEach(function (b) {
      var el = $(BOX_EL[b]), p = plan[b];
      el.hidden = p.hidden; el.style.order = p.order;
      el.classList.toggle('span-6', !p.wide); el.classList.toggle('span-12', p.wide);
    });
    $('boxMore').style.order = 100;
  }
  function renderMore() {
    var l = layout();
    var links = MORE.map(function (m) { return '<a class="chip" href="' + m[1] + '">' + esc(T('more.' + m[0])) + '</a>'; });
    l.hidden.forEach(function (b) { if (BOX_HREF[b]) links.push('<a class="chip" href="' + BOX_HREF[b] + '">' + esc(T('box.' + b)) + '</a>'); });
    $('moreLinks').innerHTML = links.join('');
  }
  function renderLayoutDialog() {
    var l = layout();
    $('layoutRows').innerHTML = l.order.map(function (row, i) {
      return '<div class="list-row" data-row="' + row + '"><div class="grow">' + HM.BOXES[row].map(function (b) {
        return '<label class="check"><input type="checkbox" data-box="' + b + '"' + (l.hidden.indexOf(b) < 0 ? ' checked' : '') + '> <span>' + esc(T('box.' + b)) + '</span></label>';
      }).join('') + '</div><div class="end">' +
        '<button class="btn icon" type="button" data-move="up" data-row="' + row + '" aria-label="' + esc(T('moveUp')) + '"' + (i === 0 ? ' disabled' : '') + '>' + icon('chevron-up') + '</button>' +
        '<button class="btn icon" type="button" data-move="down" data-row="' + row + '" aria-label="' + esc(T('moveDown')) + '"' + (i === l.order.length - 1 ? ' disabled' : '') + '>' + icon('chevron-down') + '</button></div></div>';
    }).join('');
  }

  /* ── วาดทั้งหน้า ── */
  var rendering = false, again = false;
  function renderAll() {
    if (rendering) { again = true; return; }
    rendering = true;
    renderHead();
    renderSpend();
    renderInvest();
    renderHealth();
    renderMeals();
    renderMore();
    applyLayout();
    Promise.all([rdIdb('tanot-barprep', 'notes'), readPm()]).catch(function () { return [[], null]; }).then(function (r) {
      var counts = LC ? LC.dueCounts(r[0] || []) : { lang: 0, law: 0, biz: 0, eng: 0, books: 0 }, n = 0;
      studyCounts = counts;
      Object.keys(counts).forEach(function (k) { n += counts[k]; });
      $('qaReviewN').textContent = num(n);
      renderTodo({ counts: counts, pm: r[1] });
      renderLearn();
    }).then(function () {
      rendering = false;
      if (again) { again = false; renderAll(); }
    });
  }
  var timer = 0;
  function renderSoon() { clearTimeout(timer); timer = setTimeout(renderAll, 200); }

  $('qaExpense').addEventListener('click', function () { openQuick('expense'); });
  $('qaIncome').addEventListener('click', function () { openQuick('income'); });
  $('qaSearch').addEventListener('click', function () { if (window.openOmePalette) window.openOmePalette(); });
  $('qaLayout').addEventListener('click', function () { renderLayoutDialog(); $('layoutDialog').showModal(); });
  $('layoutDone').addEventListener('click', function () { $('layoutDialog').close(); });
  $('layoutReset').addEventListener('click', function () { saveLayout(HM.cleanLayout(null)); renderLayoutDialog(); });
  $('layoutRows').addEventListener('change', function (e) {
    var b = e.target.getAttribute && e.target.getAttribute('data-box');
    if (b) { saveLayout(HM.toggleBox(layout(), b, e.target.checked)); renderLayoutDialog(); }
  });
  $('layoutRows').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-move]');
    if (btn) { saveLayout(HM.moveRow(layout(), btn.getAttribute('data-row'), btn.getAttribute('data-move') === 'up' ? -1 : 1)); renderLayoutDialog(); }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.getAttribute('data-act') === 'take') { takeDose(b.getAttribute('data-med'), b.getAttribute('data-time')); renderAll(); }
    else if (b.getAttribute('data-act') === 'cook') { cookSlot(b.getAttribute('data-slot')); renderAll(); }
  });

  var qaLoading = null;
  function openQuick(type) {
    if (window.OmeQuickAdd) { window.OmeQuickAdd.open({ type: type }); return; }
    if (!qaLoading) {
      qaLoading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'quick-add.js';
        s.onload = resolve;
        s.onerror = function () { qaLoading = null; reject(new Error('quick-add.js')); };
        document.head.appendChild(s);
      });
    }
    qaLoading.then(function () { window.OmeQuickAdd.open({ type: type }); }, function () {});
  }

  renderAll();
  if (window.OME_LANG) window.OME_LANG.onChange(function () { renderAll(); if ($('layoutDialog').open) renderLayoutDialog(); });
  window.addEventListener('tanot:quickadd', renderSoon);
  window.addEventListener('tanot:learn', renderSoon);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') renderSoon(); });
  if (TD && TD.onChange) TD.onChange(renderSoon);
})();
