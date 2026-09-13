/* ══════════════════════════════════════════════════════════════════
   Tanot — ลงทุนทำธุรกิจ (รายได้เสริม/ธุรกิจส่วนตัว)
   • เครื่องคำนวณจุดคุ้มทุน (breakeven) + ระยะเวลาคืนทุน
   • เช็กลิสต์ "พร้อมเริ่มหรือยัง?" (เงินสำรอง/สัญญาจ้าง/เวลา/ทุน/ใบอนุญาต)
   • บันทึกไอเดียที่กำลังพิจารณาไว้เทียบกัน เก็บใน localStorage
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุนหรือกฎหมาย
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LOG_KEY = 'tanot:invest:bizplan';
  var MARGIN_OK = 1.2; /* เผื่อกันชนอย่างน้อย ~20% เหนือจุดคุ้มทุนถึงจะถือว่า "เขียว" */

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function baht(n) { return '฿' + fmt0(n); }

  /* ══════ ระบบสองภาษา (ไทย/อังกฤษ) — ตามธรรมเนียมเดียวกับ invest-gold.js ══════ */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  /* L(): เลือกค่าตามภาษาปัจจุบันจาก object รูปแบบ {th:'...', en:'...'} — ใช้กับข้อมูลไอเดีย/เครื่องมือ
     ที่เป็นเนื้อหาโครงสร้างซ้อน (ไม่ใช่ UI string แบน) จึงสะดวกกว่าใส่ใน I18N dict ตรงๆ */
  function L(o) { return (o && (o[getUILang()] || o.th)) || ''; }
  var I18N = {
    th: {
      navInvest: 'การลงทุน', pageTitleShort: 'ลงทุนทำธุรกิจ',
      pageTitle: 'ลงทุนทำธุรกิจ — เช็กความพร้อม + จุดคุ้มทุน',
      ideasTitle: 'ไอเดียอ้างอิง (แรงบันดาลใจ)',
      ideasDesc: 'ตัวอย่างช่องทางรายได้เสริมที่คนทั่วไปเริ่มได้ — ไม่ผูกกับการคำนวณด้านล่าง แตะการ์ดเพื่อดูเครื่องมือที่ต้องใช้ตั้งแต่เริ่มจนส่งงาน',
      ideaBackBtn: '← กลับไปดูไอเดียทั้งหมด',
      calcTitle: 'เครื่องคำนวณจุดคุ้มทุน',
      lblStartup: 'เงินลงทุนเริ่มต้น', lblFixed: 'ต้นทุนคงที่ต่อเดือน', lblPrice: 'ราคาขายเฉลี่ย/หน่วย',
      lblVar: 'ต้นทุนผันแปร/หน่วย', lblVol: 'ปริมาณขายที่คาดหวัง/เดือน',
      calcBtn: 'คำนวณ',
      lblProfitUnit: 'กำไรต่อหน่วย', lblBreakeven: 'จุดคุ้มทุน', unitPerMonth: 'หน่วย/เดือน',
      lblProjected: 'กำไร/ขาดทุนคาดการณ์', subProjected: 'ต่อเดือน ที่ปริมาณคาดหวัง', lblPayback: 'ระยะเวลาคืนทุน',
      fromFirstUnit: 'ตั้งแต่หน่วยแรก', immediate: 'ทันที', months: '{n} เดือน',
      chkTitle: 'เช็กลิสต์ "พร้อมเริ่มหรือยัง?"',
      chkDesc: 'ตอบตามจริง 4 ข้อ + กรอกทุนที่มีอยู่จริง 1 ช่อง แล้วกด "ตรวจเช็กลิสต์" — กันเริ่มธุรกิจแบบไม่พร้อม',
      chkEmergency: 'มีเงินสำรองฉุกเฉินอย่างน้อย 3–6 เดือนของค่าใช้จ่าย (ไม่นับเงินที่จะเอามาลงทุน) แล้ว',
      chkContract: 'เช็คสัญญาจ้างงานปัจจุบันเรื่องข้อห้ามแข่งขัน (non-compete) และผลประโยชน์ทับซ้อนแล้ว',
      chkTime: 'มีเวลาจริงเพียงพอต่อสัปดาห์ นอกเหนือจากงานประจำ',
      chkLicense: 'ธุรกิจนี้ไม่ต้องมีใบอนุญาต/คุณสมบัติเฉพาะ หรือมีครบแล้ว (เช่น ใบอนุญาตขายอาหาร ตั๋ววิชาชีพ)',
      ynYes: 'ใช่', ynNo: 'ยัง', lblOwnCapital: 'ทุนที่มีอยู่จริงตอนนี้', phOwnCapital: 'เช่น 25000', chkBtn: 'ตรวจเช็กลิสต์',
      logTitle: 'บันทึกไอเดียที่กำลังพิจารณา', logDesc: 'บันทึกผลคำนวณของแต่ละไอเดียไว้เทียบกัน (เก็บในเครื่องคุณเท่านั้น)',
      lblIdeaName: 'ชื่อไอเดีย', phIdeaName: 'เช่น ขายขนมออนไลน์', addBtn: '+ บันทึกไอเดียนี้',
      logEmptyDefault: 'ยังไม่มีไอเดียที่บันทึก — กรอกเครื่องคำนวณด้านบนแล้วกด "บันทึกไอเดียนี้"',
      logThIdea: 'ไอเดีย', logThStartup: 'ลงทุนเริ่มต้น', logThBreakeven: 'คุ้มทุน(หน่วย/ด)', logThPayback: 'คืนทุน(ด)', logThProjected: 'กำไรคาด/ด',
      alertPrice: 'กรอกราคาขายเฉลี่ยต่อหน่วยให้ถูกต้อง',
      errPriceRequired: 'กรอกราคาขายเฉลี่ยต่อหน่วยให้ถูกต้องก่อน',
      errNoBreakeven: 'ราคาขาย ({price}) ต้องสูงกว่าต้นทุนผันแปรต่อหน่วย ({varCost}) ไม่งั้นยิ่งขายยิ่งขาดทุน — ไม่มีจุดคุ้มทุน',
      needVolume: 'กรอกปริมาณขายที่คาดหวังต่อเดือน เพื่อประเมินว่าคุ้มไหม (จุดคุ้มทุน ≈ {be})',
      zeroFixedProfit: 'ต้นทุนคงที่ต่ำมาก/เป็นศูนย์ คุ้มทุนตั้งแต่หน่วยแรก และคาดขายได้ {vol} หน่วย/เดือน — มีกำไรที่ปริมาณนี้',
      zeroVolNoProfit: 'ปริมาณขายที่คาดเป็น 0 — ยังไม่มีกำไร',
      belowBreakeven: 'ปริมาณขายที่คาด ({vol} หน่วย) ยังไม่ถึงจุดคุ้มทุน ({be} หน่วย) — ขาดทุน ~{loss}/เดือนที่ปริมาณนี้',
      thinMargin: 'คุ้มทุนพอดีๆ (เกินจุดคุ้มทุน {pct}%) กำไรเล็กน้อย เผื่อความผันผวนของยอดขายไม่ค่อยได้',
      goodMargin: 'ปริมาณขายที่คาดเกินจุดคุ้มทุนพอสมควร (+{pct}%) มีกันชนไว้บ้าง',
      alertIdeaName: 'ใส่ชื่อไอเดียก่อน', alertPriceInCalc: 'กรอกราคาขายเฉลี่ยต่อหน่วยในเครื่องคำนวณด้านบนก่อน',
      chkCapUnknown: 'ทุนเริ่มต้นครอบคลุมไหม — กรอกเงินลงทุนเริ่มต้น (การ์ดด้านบน) และทุนที่มีอยู่จริงก่อน',
      chkCapOk: 'ทุนที่มีอยู่จริง ({own}) ครอบคลุมเงินลงทุนเริ่มต้น ({startup})',
      chkCapNo: 'ทุนที่มีอยู่จริง ({own}) ยังไม่พอเงินลงทุนเริ่มต้น ({startup})',
      chkFail: 'ยังไม่พร้อม — ติด {n} ข้อ ควรแก้ให้ครบก่อนเริ่ม',
      chkNeedMore: 'ตอบให้ครบก่อนประเมิน — เหลือ {n} ข้อ',
      chkGo: 'พร้อมเริ่มได้ตามเกณฑ์ — ผ่านครบทุกข้อ (แต่ยังไม่การันตีความสำเร็จ)',
      toolGetFrom: 'หาได้จาก: {get}'
    },
    en: {
      navInvest: 'Investing', pageTitleShort: 'Starting a Business',
      pageTitle: 'Starting a Business — Readiness Check + Break-even Point',
      ideasTitle: 'Reference Ideas (Inspiration)',
      ideasDesc: "Example side-income channels anyone can start — not tied to the calculator below. Tap a card to see the tools needed from start to delivery",
      ideaBackBtn: '← Back to all ideas',
      calcTitle: 'Break-even Calculator',
      lblStartup: 'Startup capital', lblFixed: 'Fixed cost per month', lblPrice: 'Average selling price/unit',
      lblVar: 'Variable cost/unit', lblVol: 'Expected sales volume/month',
      calcBtn: 'Calculate',
      lblProfitUnit: 'Profit per unit', lblBreakeven: 'Break-even point', unitPerMonth: 'units/month',
      lblProjected: 'Projected profit/loss', subProjected: 'per month, at expected volume', lblPayback: 'Payback period',
      fromFirstUnit: 'From the first unit', immediate: 'Immediately', months: '{n} months',
      chkTitle: 'Checklist: "Are You Ready to Start?"',
      chkDesc: 'Answer 4 questions honestly + fill in the capital you actually have, then press "Check the checklist" — to avoid starting a business unprepared',
      chkEmergency: "You already have an emergency fund of at least 3–6 months of expenses (not counting the money you'd invest)",
      chkContract: 'You have checked your current employment contract for non-compete clauses and conflicts of interest',
      chkTime: 'You have genuinely enough time per week, outside of your regular job',
      chkLicense: 'This business needs no license/specific qualification, or you already have it all (e.g. a food-selling license, a professional license)',
      ynYes: 'Yes', ynNo: 'Not yet', lblOwnCapital: 'Capital you actually have now', phOwnCapital: 'e.g. 25000', chkBtn: 'Check the checklist',
      logTitle: 'Log of Ideas You\'re Considering', logDesc: 'Save the calculation results for each idea to compare them (stored on your device only)',
      lblIdeaName: 'Idea name', phIdeaName: 'e.g. selling snacks online', addBtn: '+ Save this idea',
      logEmptyDefault: 'No ideas logged yet — fill in the calculator above then press "Save this idea"',
      logThIdea: 'Idea', logThStartup: 'Startup capital', logThBreakeven: 'Break-even (units/mo)', logThPayback: 'Payback (mo)', logThProjected: 'Projected profit/mo',
      alertPrice: 'Enter a valid average selling price per unit',
      errPriceRequired: 'Enter a valid average selling price per unit first',
      errNoBreakeven: 'The selling price ({price}) must be higher than the variable cost per unit ({varCost}), otherwise selling more only loses more money — there is no break-even point',
      needVolume: 'Enter the expected sales volume per month to assess whether it pays off (break-even ≈ {be})',
      zeroFixedProfit: 'Fixed costs are very low/zero, so you break even from the first unit, and at an expected {vol} units/month sold, there is a profit at this volume',
      zeroVolNoProfit: 'Expected sales volume is 0 — no profit yet',
      belowBreakeven: 'The expected sales volume ({vol} units) does not yet reach the break-even point ({be} units) — a loss of ~{loss}/month at this volume',
      thinMargin: 'Just about breaking even (exceeding break-even by {pct}%), a small profit that leaves little buffer for sales volatility',
      goodMargin: 'Expected sales volume exceeds break-even by a fair margin (+{pct}%), giving you some buffer',
      alertIdeaName: 'Enter an idea name first', alertPriceInCalc: 'Enter the average selling price per unit in the calculator above first',
      chkCapUnknown: 'Does your starting capital cover it? — enter the startup capital (card above) and the capital you actually have first',
      chkCapOk: 'The capital you actually have ({own}) covers the startup capital ({startup})',
      chkCapNo: "The capital you actually have ({own}) isn't enough for the startup capital ({startup})",
      chkFail: 'Not ready yet — {n} item(s) failed; fix them all before starting',
      chkNeedMore: 'Answer all questions before assessing — {n} remaining',
      chkGo: 'Ready to start per the criteria — passed every item (still no guarantee of success)',
      toolGetFrom: 'Get it from: {get}'
    }
  };
  function t(key, vars) {
    var s = (I18N[getUILang()] || I18N.th)[key];
    if (s == null) s = (I18N.th[key] != null ? I18N.th[key] : key);
    if (vars) { for (var k in vars) { s = s.split('{' + k + '}').join(vars[k]); } }
    return s;
  }
  function applyStaticI18n() {
    [].forEach.call(document.querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    [].forEach.call(document.querySelectorAll('[data-i18n-html]'), function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    [].forEach.call(document.querySelectorAll('[data-i18n-placeholder]'), function (el) { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
  }

  /* ── ไอเดียอ้างอิง: รายละเอียดเครื่องมือครบวงจร (list ↔ detail แยกหน้าจอในการ์ดเดียวกัน) ──
     title/tagline และแต่ละ tool.name/why/get เป็น {th, en} — ใช้ L() เลือกตามภาษา ── */
  var PHASE_NAMES = [
    { th: 'เตรียมตัว/วางแผน', en: 'Prepare/Plan' },
    { th: 'หาลูกค้า/การตลาด', en: 'Find customers/Marketing' },
    { th: 'ทำงาน/ผลิต', en: 'Work/Produce' },
    { th: 'ส่งงาน/ส่งมอบ', en: 'Deliver' },
    { th: 'เก็บเงิน/บัญชี', en: 'Get paid/Accounting' }
  ];

  var IDEAS = [
    {
      id: 'freelance', icon: '',
      title: { th: 'ขายทักษะ/ที่ปรึกษาฟรีแลนซ์', en: 'Sell your skills/freelance consulting' },
      tagline: { th: 'ใช้ทักษะที่มีอยู่แล้วรับงานนอกเวลา', en: 'Use skills you already have to take on work outside your job' },
      phases: [
        { tools: [
          { name: { th: 'พอร์ตโฟลิโอออนไลน์', en: 'An online portfolio' }, why: { th: 'โชว์ผลงาน/ประวัติให้ลูกค้าเชื่อถือก่อนจ้าง', en: 'Show your work/history so clients trust you before hiring' }, get: { th: 'Notion หรือ Google Sites (ฟรี ทำเว็บพอร์ตง่ายๆ ได้เลย)', en: 'Notion or Google Sites (free, easy to build a simple portfolio site)' } },
          { name: { th: 'เทมเพลตสัญญาว่าจ้าง/ขอบเขตงาน (SOW)', en: 'A contract/scope-of-work (SOW) template' }, why: { th: 'กันปัญหาขอบเขตงานไม่ชัดหรือลูกค้าเบี้ยวภายหลัง', en: 'Prevents unclear scope or a client backing out later' }, get: { th: 'ค้นหา "freelance contract template" บน GitHub — มีเทมเพลตโอเพนซอร์สหลาย repo ให้โหลดปรับใช้ฟรี', en: 'Search "freelance contract template" on GitHub — several open-source repos have free templates you can adapt' } }
        ]},
        { tools: [
          { name: { th: 'แพลตฟอร์มฟรีแลนซ์ไทย', en: 'A Thai freelance platform' }, why: { th: 'ช่องทางหางานที่มีคนหาช่างอยู่แล้ว', en: 'A channel where people are already looking to hire' }, get: { th: 'Fastwork, Freelancer.co.th, กลุ่ม Facebook งานฟรีแลนซ์', en: 'Fastwork, Freelancer.co.th, Facebook freelance-work groups' } },
          { name: { th: 'LinkedIn', en: 'LinkedIn' }, why: { th: 'สร้างเครดิตมืออาชีพ หาลูกค้าองค์กร', en: 'Build professional credibility and reach corporate clients' }, get: { th: 'linkedin.com (ฟรี)', en: 'linkedin.com (free)' } }
        ]},
        { tools: [
          { name: { th: 'Google Workspace', en: 'Google Workspace' }, why: { th: 'เอกสาร/ชีต/สไลด์ทำงานร่วมกับลูกค้าได้', en: 'Docs/Sheets/Slides for collaborating with clients' }, get: { th: 'ฟรีสำหรับใช้งานพื้นฐาน', en: 'Free for basic use' } },
          { name: { th: 'Zoom / Google Meet', en: 'Zoom / Google Meet' }, why: { th: 'ประชุมลูกค้าทางไกล', en: 'Meet with clients remotely' }, get: { th: 'ฟรี (จำกัดเวลาบางแพ็กเกจ)', en: 'Free (time-limited on some plans)' } },
          { name: { th: 'Trello / Notion', en: 'Trello / Notion' }, why: { th: 'จัดการงาน/deadline ไม่ให้หลุด', en: 'Track tasks/deadlines so nothing slips' }, get: { th: 'ฟรีสำหรับผู้ใช้คนเดียว', en: 'Free for a single user' } }
        ]},
        { tools: [
          { name: { th: 'Google Drive / Dropbox', en: 'Google Drive / Dropbox' }, why: { th: 'ส่งไฟล์งานให้ลูกค้าเป็นระเบียบ', en: 'Deliver files to clients in an organized way' }, get: { th: 'ฟรี (พื้นที่จำกัด)', en: 'Free (limited storage)' } },
          { name: { th: 'WeTransfer', en: 'WeTransfer' }, why: { th: 'ส่งไฟล์ขนาดใหญ่โดยไม่ต้องมีบัญชี', en: 'Send large files without needing an account' }, get: { th: 'wetransfer.com (ฟรีไม่เกิน 2GB/ครั้ง)', en: 'wetransfer.com (free up to 2GB per send)' } }
        ]},
        { tools: [
          { name: { th: 'พร้อมเพย์ / โอนตรง', en: 'PromptPay / direct transfer' }, why: { th: 'รับเงินจากลูกค้าไทยง่ายสุด', en: 'The easiest way to get paid by Thai clients' }, get: { th: 'แอปธนาคารที่มีอยู่แล้ว', en: 'The banking app you already have' } },
          { name: { th: 'ระบบออกใบแจ้งหนี้', en: 'An invoicing system' }, why: { th: 'ดูมืออาชีพ + เก็บประวัติรายรับ', en: 'Looks professional and keeps an income record' }, get: { th: 'Invoice Ninja (โอเพนซอร์สบน GitHub ติดตั้งเองหรือใช้เว็บฟรีได้) หรือเว็บ invoice generator ฟรีทั่วไป', en: 'Invoice Ninja (open source on GitHub, self-host or use the free web version) or any free invoice generator' } }
        ]}
      ]
    },
    {
      id: 'course', icon: '',
      title: { th: 'สอน/ทำคอร์สออนไลน์', en: 'Teach/create an online course' },
      tagline: { th: 'ถ่ายทอดความรู้เป็นคอร์สหรือติวเตอร์', en: 'Turn your knowledge into a course or tutoring' },
      phases: [
        { tools: [
          { name: { th: 'โครงร่างเนื้อหา (Curriculum outline)', en: 'A curriculum outline' }, why: { th: 'วางลำดับหัวข้อสอนให้ผู้เรียนตามทันไม่กระโดดข้าม', en: "Sequence topics so students can follow along without skipping ahead" }, get: { th: 'Google Docs/Sheets (ฟรี) ร่างเป็นหัวข้อ-ซับหัวข้อ', en: 'Google Docs/Sheets (free) — draft it as topics and sub-topics' } },
          { name: { th: 'ไมโครโฟน + กล้อง/มือถือ', en: 'A microphone + camera/phone' }, why: { th: 'เสียงชัดคือปัจจัยที่คนดูให้อภัยภาพไม่สวยได้มากกว่าเสียงไม่ชัด', en: 'Clear audio is something viewers forgive far more readily than unclear audio with pretty visuals' }, get: { th: 'ไมค์ USB ราคาประหยัด (เช่น Fifine/Boya) หรือใช้มือถือรุ่นที่มีอยู่แล้ว', en: 'An affordable USB mic (e.g. Fifine/Boya) or the phone you already own' } }
        ]},
        { tools: [
          { name: { th: 'โพสต์ตัวอย่างสอนสั้นๆ', en: 'Short sample-lesson posts' }, why: { th: 'ให้คนเห็นสไตล์การสอนก่อนตัดสินใจซื้อ', en: 'Let people see your teaching style before they decide to buy' }, get: { th: 'TikTok / Facebook Reels / YouTube Shorts (ฟรี)', en: 'TikTok / Facebook Reels / YouTube Shorts (free)' } },
          { name: { th: 'LINE OA / กลุ่ม Facebook', en: 'LINE OA / a Facebook group' }, why: { th: 'รวมคนสนใจไว้ที่เดียว ตอบคำถามและปิดการขาย', en: 'Gather interested people in one place to answer questions and close sales' }, get: { th: 'LINE Official Account (ฟรีเริ่มต้น), Facebook Group', en: 'LINE Official Account (free to start), a Facebook Group' } }
        ]},
        { tools: [
          { name: { th: 'OBS Studio', en: 'OBS Studio' }, why: { th: 'อัดหน้าจอ/สอนสด คุณภาพเทียบเท่ามืออาชีพ', en: 'Record your screen/stream live with professional-grade quality' }, get: { th: 'โอเพนซอร์สฟรี ดาวน์โหลดจาก obsproject.com (โค้ดอยู่บน GitHub: obsproject/obs-studio)', en: 'Free and open source, download from obsproject.com (source on GitHub: obsproject/obs-studio)' } },
          { name: { th: 'CapCut หรือ DaVinci Resolve', en: 'CapCut or DaVinci Resolve' }, why: { th: 'ตัดต่อวิดีโอ ตัดส่วนเกิน ใส่คำบรรยาย', en: 'Edit video, trim excess footage, add captions' }, get: { th: 'แอปมือถือ/เดสก์ท็อป มีแผนฟรี', en: 'Mobile/desktop apps, both have free tiers' } },
          { name: { th: 'Canva', en: 'Canva' }, why: { th: 'ทำสไลด์ประกอบการสอนให้ดูเป็นมืออาชีพ', en: 'Make teaching slides that look professional' }, get: { th: 'canva.com มีแผนฟรี', en: 'canva.com has a free plan' } }
        ]},
        { tools: [
          { name: { th: 'แพลตฟอร์มโฮสต์คอร์ส', en: 'A course-hosting platform' }, why: { th: 'อัปโหลดวิดีโอ จัดการผู้เรียน ออกใบรับรอง', en: 'Upload videos, manage students, issue certificates' }, get: { th: 'YouTube (ฟรี, unlisted), Skooldio/Udemy (แบ่งรายได้), Google Classroom (ฟรีสำหรับติวเตอร์)', en: 'YouTube (free, unlisted), Skooldio/Udemy (revenue share), Google Classroom (free for tutors)' } },
          { name: { th: 'Google Forms', en: 'Google Forms' }, why: { th: 'แบบทดสอบ/แบบประเมินหลังเรียน', en: 'Quizzes/post-lesson evaluations' }, get: { th: 'ฟรี', en: 'Free' } }
        ]},
        { tools: [
          { name: { th: 'ระบบชำระเงินของแพลตฟอร์ม', en: "The platform's payment system" }, why: { th: 'แพลตฟอร์มคอร์สจัดการเก็บเงินให้อยู่แล้ว ปลอดภัยกว่าโอนตรงกับคนแปลกหน้า', en: 'The course platform handles payment collection already, safer than a direct transfer with a stranger' }, get: { th: 'ในตัวแพลตฟอร์ม (Skooldio/Udemy) หรือ Omise ถ้าขายเอง', en: 'Built into the platform (Skooldio/Udemy), or Omise if selling on your own' } },
          { name: { th: 'พร้อมเพย์', en: 'PromptPay' }, why: { th: 'รับเงินค่าติวตัวต่อตัวโดยตรง', en: 'Receive payment directly for one-on-one tutoring' }, get: { th: 'แอปธนาคารที่มีอยู่แล้ว', en: 'The banking app you already have' } }
        ]}
      ]
    },
    {
      id: 'online-sales', icon: '',
      title: { th: 'ขายสินค้าออนไลน์', en: 'Sell products online' },
      tagline: { th: 'ผลิตเองหรือหาสินค้ามาขายผ่านมาร์เก็ตเพลส/โซเชียล', en: 'Make your own or source products to sell via marketplaces/social media' },
      phases: [
        { tools: [
          { name: { th: 'หาสินค้า/ต้นทาง', en: 'Sourcing a product' }, why: { th: 'ตัดสินใจผลิตเองหรือหาซัพพลายเออร์ส่งต่อ (dropship)', en: 'Decide whether to make it yourself or dropship from a supplier' }, get: { th: 'ตลาดค้าส่งเช่นสำเพ็ง/โบ๊เบ๊ หรือแพลตฟอร์มซัพพลายเออร์อย่าง 1688 (ผ่านเอเย่นต์นำเข้า)', en: 'Wholesale markets like Sampeng/Bobae, or supplier platforms like 1688 (through an import agent)' } },
          { name: { th: 'ไฟถ่ายภาพสินค้า + ฉากหลัง', en: 'Product-photography lights + a backdrop' }, why: { th: 'ภาพสินค้าที่ดูดีเพิ่มยอดขายได้จริง', en: 'Good-looking product photos genuinely increase sales' }, get: { th: 'ชุดไฟ softbox ราคาประหยัดจาก Shopee/Lazada', en: 'An affordable softbox lighting kit from Shopee/Lazada' } }
        ]},
        { tools: [
          { name: { th: 'Canva', en: 'Canva' }, why: { th: 'ทำโพสต์/แบนเนอร์โปรโมตสินค้า', en: 'Make promotional posts/banners for your products' }, get: { th: 'ฟรี', en: 'Free' } },
          { name: { th: 'Facebook Marketplace/กลุ่มซื้อขาย, TikTok Shop', en: 'Facebook Marketplace/buy-sell groups, TikTok Shop' }, why: { th: 'ช่องทางที่มีคนซื้อของอยู่แล้วจำนวนมาก', en: 'Channels where large numbers of people are already buying' }, get: { th: 'ฟรีเปิดร้าน', en: 'Free to open a shop' } }
        ]},
        { tools: [
          { name: { th: 'Shopee/Lazada Seller Center', en: 'Shopee/Lazada Seller Center' }, why: { th: 'ลงขาย จัดการออเดอร์ โปรโมชั่นในที่เดียว', en: 'List products, manage orders and promotions in one place' }, get: { th: 'ฟรีสมัครเป็นผู้ขาย', en: 'Free to register as a seller' } },
          { name: { th: 'Google Sheets หรือ Loyverse POS', en: 'Google Sheets or Loyverse POS' }, why: { th: 'จัดการสต๊อกไม่ให้ขายเกินของที่มี', en: "Manage stock so you don't sell more than you have" }, get: { th: 'Google Sheets ฟรี / Loyverse POS ฟรีสำหรับร้านเล็ก', en: 'Google Sheets is free / Loyverse POS is free for small shops' } }
        ]},
        { tools: [
          { name: { th: 'บริการขนส่ง', en: 'A delivery service' }, why: { th: 'ส่งสินค้าถึงลูกค้า', en: 'Get products to customers' }, get: { th: 'Kerry Express, Flash Express, ไปรษณีย์ไทย (เทียบราคา/ความเร็ว)', en: 'Kerry Express, Flash Express, Thailand Post (compare price/speed)' } },
          { name: { th: 'เครื่องพิมพ์ใบปะหน้า/สติกเกอร์', en: 'A shipping-label/sticker printer' }, why: { th: 'ลดเวลาเขียนที่อยู่มือ ลดความผิดพลาด', en: 'Saves time hand-writing addresses and reduces mistakes' }, get: { th: 'เครื่องพิมพ์ความร้อนราคาประหยัดที่เชื่อมแอปขนส่งได้', en: 'An affordable thermal printer that connects to shipping apps' } }
        ]},
        { tools: [
          { name: { th: 'เก็บเงินปลายทาง (COD) ผ่านแพลตฟอร์ม', en: 'Cash-on-delivery (COD) via the platform' }, why: { th: 'แพลตฟอร์มโอนเงินให้หลังลูกค้ารับของ ลดความเสี่ยงโกง', en: 'The platform transfers money to you after the customer receives the item, reducing fraud risk' }, get: { th: 'ในตัว Shopee/Lazada', en: 'Built into Shopee/Lazada' } },
          { name: { th: 'พร้อมเพย์/คิวอาร์โค้ด', en: 'PromptPay/QR code' }, why: { th: 'รับเงินโอนตรงจากลูกค้าขายผ่านโซเชียล', en: 'Receive direct transfers from customers when selling via social media' }, get: { th: 'แอปธนาคารที่มีอยู่แล้ว', en: 'The banking app you already have' } }
        ]}
      ]
    },
    {
      id: 'tools-apps', icon: '',
      title: { th: 'ทำเครื่องมือ/แอปขายหรือให้เช่า', en: 'Build a tool/app to sell or rent out' },
      tagline: { th: 'สร้างของที่ใช้ซ้ำได้ ขายทีเดียวหรือเก็บค่าสมาชิก', en: 'Build something reusable, sell it once or charge a subscription' },
      phases: [
        { tools: [
          { name: { th: 'วางสเปคเครื่องมือ/ฟีเจอร์หลัก (MVP)', en: 'Spec out the core tool/features (MVP)' }, why: { th: 'กันทำเกินจำเป็นก่อนรู้ว่ามีคนอยากใช้จริง', en: 'Avoid overbuilding before knowing anyone actually wants to use it' }, get: { th: 'Notion/Google Docs ร่าง feature list ฟรี', en: 'Notion/Google Docs — draft a free feature list' } },
          { name: { th: 'VS Code', en: 'VS Code' }, why: { th: 'เครื่องมือเขียนโค้ดหลัก ฟรีและรองรับเกือบทุกภาษา', en: 'The main coding tool, free and supports nearly every language' }, get: { th: 'โอเพนซอร์สฟรี ดาวน์โหลดจาก code.visualstudio.com', en: 'Free and open source, download from code.visualstudio.com' } }
        ]},
        { tools: [
          { name: { th: 'โพสต์ตัวอย่างการใช้งานสั้นๆ', en: 'Short usage-demo posts' }, why: { th: 'โชว์ปัญหาที่เครื่องมือแก้ให้เห็นชัดในไม่กี่วินาที', en: 'Clearly show the problem your tool solves in a few seconds' }, get: { th: 'TikTok / Facebook / X (ฟรี)', en: 'TikTok / Facebook / X (free)' } },
          { name: { th: 'Landing page อธิบายสินค้า', en: 'A landing page explaining the product' }, why: { th: 'หน้าเดียวที่บอกว่าทำอะไร ราคาเท่าไร กดซื้อตรงไหน', en: 'One page that says what it does, the price, and where to buy' }, get: { th: 'GitHub Pages (ฟรี, โฮสต์แบบเดียวกับเว็บนี้เอง) หรือ Carrd (ฟรีเริ่มต้น)', en: 'GitHub Pages (free, hosted the same way as this site) or Carrd (free to start)' } }
        ]},
        { tools: [
          { name: { th: 'GitHub', en: 'GitHub' }, why: { th: 'เก็บโค้ด ย้อนดูประวัติแก้ไข และค้นหาไลบรารีโอเพนซอร์สมาใช้แทนสร้างเองตั้งแต่ต้น', en: 'Store your code, view edit history, and find open-source libraries instead of building everything from scratch' }, get: { th: 'github.com ฟรีสำหรับ repo จำนวนจำกัด', en: 'github.com, free for a limited number of repos' } },
          { name: { th: 'เครื่องมือ no-code (Bubble/Glide)', en: 'No-code tools (Bubble/Glide)' }, why: { th: 'ทำแอปได้โดยไม่ต้องเขียนโค้ดถ้าไม่ถนัดสายเทค', en: 'Build an app without coding if you\'re not technically inclined' }, get: { th: 'มีแผนฟรีเริ่มต้นให้ทดลอง', en: 'Free tiers available to try' } }
        ]},
        { tools: [
          { name: { th: 'GitHub Pages / Vercel / Netlify', en: 'GitHub Pages / Vercel / Netlify' }, why: { th: 'โฮสต์เว็บ/แอปให้ลูกค้าใช้งานได้จริงโดยไม่มีค่าใช้จ่ายเซิร์ฟเวอร์', en: 'Host the web app for real customer use with no server cost' }, get: { th: 'ฟรีสำหรับโปรเจกต์ขนาดเล็ก-กลาง', en: 'Free for small-to-medium projects' } },
          { name: { th: 'เอกสารวิธีใช้งาน', en: 'Usage documentation' }, why: { th: 'ลดคำถามซ้ำๆ จากผู้ใช้หลังส่งมอบ', en: 'Reduces repeated questions from users after delivery' }, get: { th: 'Notion หรือ Google Docs ฟรี', en: 'Notion or Google Docs, free' } }
        ]},
        { tools: [
          { name: { th: 'Gumroad หรือ itch.io', en: 'Gumroad or itch.io' }, why: { th: 'ขายซอฟต์แวร์/ไฟล์ดิจิทัลพร้อมระบบเก็บเงินและออกลิงก์ดาวน์โหลดให้อัตโนมัติ', en: 'Sell software/digital files with automatic payment collection and download links' }, get: { th: 'สมัครฟรี หักค่าธรรมเนียมต่อยอดขาย', en: 'Free to sign up, they take a fee per sale' } },
          { name: { th: 'ระบบสมาชิกรายเดือน (ถ้าเก็บค่าเช่าใช้)', en: 'A monthly subscription system (if charging rent for use)' }, why: { th: 'เก็บเงินอัตโนมัติแบบสมัครสมาชิกแทนขายทีเดียว', en: 'Collect payment automatically via subscription instead of a one-time sale' }, get: { th: 'Stripe/Omise (ต้องมีเอกสารตามเงื่อนไขผู้ให้บริการ)', en: "Stripe/Omise (requires documents per the provider's terms)" } }
        ]}
      ]
    },
    {
      id: 'rental', icon: '',
      title: { th: 'ให้เช่าทรัพย์สินที่มี', en: 'Rent out assets you already have' },
      tagline: { th: 'ห้อง/รถ/อุปกรณ์ที่ไม่ได้ใช้เต็มเวลา', en: "A room/car/equipment you don't use full-time" },
      phases: [
        { tools: [
          { name: { th: 'ทำความสะอาด+เตรียมของให้พร้อมใช้', en: 'Clean and prepare the item for use' }, why: { th: 'ของที่ดูแลดีได้ราคาเช่าดีกว่าและรีวิวดีกว่า', en: 'Well-maintained items command a better rental price and better reviews' }, get: { th: 'อุปกรณ์ทำความสะอาดที่มีอยู่แล้ว', en: 'Cleaning supplies you already have' } },
          { name: { th: 'เทมเพลตสัญญาเช่า', en: 'A rental-agreement template' }, why: { th: 'ระบุเงื่อนไข/มัดจำ/ความรับผิดชัดเจน กันข้อพิพาทภายหลัง', en: 'Clearly state terms/deposit/liability to avoid disputes later' }, get: { th: 'ค้นหาแบบฟอร์มสัญญาเช่ามาตรฐานจากหน่วยงานราชการ/เว็บกฎหมายทั่วไป ปรับใช้ได้ฟรี', en: 'Search for a standard rental-agreement form from a government agency/general legal website and adapt it for free' } }
        ]},
        { tools: [
          { name: { th: 'มือถือ + ไฟส่องสว่าง', en: 'A phone + lighting' }, why: { th: 'ภาพถ่ายที่ดูสว่างสะอาดตาเพิ่มโอกาสมีคนสนใจเช่า', en: 'Bright, clean-looking photos increase the odds someone is interested in renting' }, get: { th: 'ใช้มือถือที่มีอยู่ ถ่ายตอนกลางวัน/เปิดไฟให้ครบ', en: 'Use the phone you already have, shoot in daylight/with all lights on' } },
          { name: { th: 'แพลตฟอร์มลงประกาศ', en: 'A listing platform' }, why: { th: 'ช่องทางที่มีคนหาเช่าอยู่แล้ว', en: 'A channel where people are already looking to rent' }, get: { th: 'Airbnb (ห้อง/ที่พัก), Facebook Marketplace/กลุ่มเช่าเฉพาะทาง (รถ/อุปกรณ์)', en: 'Airbnb (rooms/accommodation), Facebook Marketplace/specialized rental groups (cars/equipment)' } }
        ]},
        { tools: [
          { name: { th: 'Google Calendar', en: 'Google Calendar' }, why: { th: 'กันชนวันจองซ้อนกันระหว่างหลายช่องทาง', en: 'Prevent double-bookings across multiple channels' }, get: { th: 'ฟรี', en: 'Free' } },
          { name: { th: 'แอปส่งข้อความอัตโนมัติ', en: 'Automated messaging apps' }, why: { th: 'ตอบคำถามลูกค้าเรื่องเช็คอิน/เงื่อนไขเร็วขึ้น', en: 'Answer customer questions about check-in/terms faster' }, get: { th: 'ระบบข้อความอัตโนมัติในตัว Airbnb หรือ LINE OA (ฟรี)', en: "Airbnb's built-in automated messaging, or LINE OA (free)" } }
        ]},
        { tools: [
          { name: { th: 'เช็กลิสต์ส่งมอบ/รับคืน', en: 'A handover/return checklist' }, why: { th: 'บันทึกสภาพก่อน-หลังเช่า กันข้อพิพาทเรื่องความเสียหาย', en: 'Document condition before/after the rental to avoid damage disputes' }, get: { th: 'ถ่ายรูป+บันทึกใน Google Sheets/Docs ฟรี', en: 'Take photos + record them in Google Sheets/Docs, free' } },
          { name: { th: 'กล่องเก็บกุญแจแบบรหัส (key lockbox)', en: 'A key lockbox' }, why: { th: 'ส่งมอบกุญแจสะดวกโดยไม่ต้องเจอหน้ากันทุกครั้ง', en: 'Hand over keys conveniently without meeting in person every time' }, get: { th: 'หาซื้อได้ทั่วไปตามร้านฮาร์ดแวร์/ออนไลน์', en: 'Available at most hardware stores/online' } }
        ]},
        { tools: [
          { name: { th: 'ระบบชำระเงินของแพลตฟอร์ม', en: "The platform's payment system" }, why: { th: 'แพลตฟอร์มอย่าง Airbnb โอนเงินให้อัตโนมัติหลังเช็คอินผ่านไปสักระยะ ปลอดภัยกว่าเก็บเงินสดเอง', en: 'Platforms like Airbnb transfer money automatically some time after check-in, safer than collecting cash yourself' }, get: { th: 'ในตัว Airbnb', en: 'Built into Airbnb' } },
          { name: { th: 'มัดจำ + โอนตรง', en: 'A deposit + direct transfer' }, why: { th: 'กรณีเช่านอกแพลตฟอร์ม (เช่น รถ/อุปกรณ์ให้เช่าเอง)', en: 'For rentals arranged outside a platform (e.g. renting out a car/equipment yourself)' }, get: { th: 'พร้อมเพย์ + สัญญาระบุเงื่อนไขมัดจำคืน', en: 'PromptPay + a contract specifying deposit-return terms' } }
        ]}
      ]
    }
  ];

  function findIdea(id) {
    for (var i = 0; i < IDEAS.length; i++) { if (IDEAS[i].id === id) return IDEAS[i]; }
    return null;
  }

  function toolListHtml(tools) {
    var html = '<ul class="tool-list">';
    tools.forEach(function (tool) {
      html += '<li><b>' + L(tool.name) + '</b><div class="mini">' + L(tool.why) + '</div><div class="tool-get">' + t('toolGetFrom', { get: L(tool.get) }) + '</div></li>';
    });
    html += '</ul>';
    return html;
  }

  function ideaDetailHtml(idea) {
    var html = '<button class="btn sm" id="bzIdeaBack" type="button">' + t('ideaBackBtn') + '</button>';
    html += '<div class="idea-detail-head"><span class="ic">' + idea.icon + '</span><div><b>' + L(idea.title) + '</b><div class="mini">' + L(idea.tagline) + '</div></div></div>';
    idea.phases.forEach(function (ph, i) {
      html += '<div class="phase-h">' + (i + 1) + '. ' + L(PHASE_NAMES[i]) + '</div>' + toolListHtml(ph.tools);
    });
    return html;
  }

  var curIdeaId = null;
  function renderIdeaList() {
    var html = '<div class="idea-grid">';
    IDEAS.forEach(function (idea) {
      html += '<div class="idea-card" data-id="' + idea.id + '"><span class="ic">' + idea.icon + '</span><b>' + L(idea.title) + '</b>' + L(idea.tagline) + '</div>';
    });
    html += '</div>';
    $('bzIdeaListWrap').innerHTML = html;
  }

  function showIdeaDetail(id) {
    var idea = findIdea(id);
    if (!idea) return;
    curIdeaId = id;
    $('bzIdeaDetail').innerHTML = ideaDetailHtml(idea);
    $('bzIdeaListWrap').style.display = 'none';
    $('bzIdeaDetail').style.display = 'block';
    try { history.replaceState(null, '', '#idea-' + id); } catch (e) {}
  }

  function hideIdeaDetail() {
    curIdeaId = null;
    $('bzIdeaDetail').style.display = 'none';
    $('bzIdeaListWrap').style.display = 'block';
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }

  /* ── เครื่องคำนวณจุดคุ้มทุน (pure — reuse ได้ทั้งการ์ดคำนวณและตอนบันทึกไอเดีย) ── */
  function computeBreakeven(o) {
    var startup = isFinite(o.startup) ? o.startup : 0;
    var fixed = Math.max(0, isFinite(o.fixed) ? o.fixed : 0);
    var price = o.price, varCost = isFinite(o.varCost) ? o.varCost : 0, vol = o.vol;
    var r = { profitPerUnit: NaN, breakevenUnits: NaN, monthlyProfitAtVol: NaN, paybackMonths: NaN, ratio: NaN, cls: 'warn', txt: '' };

    if (!isFinite(price) || price <= 0) { r.txt = t('errPriceRequired'); return r; }

    r.profitPerUnit = price - varCost;
    if (r.profitPerUnit <= 0) {
      r.cls = 'no';
      r.txt = t('errNoBreakeven', { price: fmt(price), varCost: fmt(varCost) });
      return r;
    }
    r.breakevenUnits = fixed / r.profitPerUnit;

    if (!isFinite(vol)) {
      r.cls = 'warn';
      r.txt = t('needVolume', { be: r.breakevenUnits <= 0 ? t('fromFirstUnit') : fmt(r.breakevenUnits, 1) + ' ' + t('unitPerMonth') });
      return r;
    }

    r.monthlyProfitAtVol = vol * r.profitPerUnit - fixed;
    if (r.monthlyProfitAtVol > 0) { r.paybackMonths = startup <= 0 ? 0 : startup / r.monthlyProfitAtVol; }

    if (r.breakevenUnits <= 0) {
      /* ต้นทุนคงที่ 0 (หรือคุ้มทุนตั้งแต่หน่วยแรก) */
      if (vol > 0) { r.cls = 'go'; r.ratio = Infinity; r.txt = t('zeroFixedProfit', { vol: fmt0(vol) }); }
      else { r.cls = 'no'; r.txt = t('zeroVolNoProfit'); }
      return r;
    }

    r.ratio = vol / r.breakevenUnits;
    if (r.ratio < 1) {
      r.cls = 'no';
      r.txt = t('belowBreakeven', { vol: fmt0(vol), be: fmt(r.breakevenUnits, 1), loss: baht(Math.abs(r.monthlyProfitAtVol)) });
    } else if (r.ratio < MARGIN_OK) {
      r.cls = 'warn';
      r.txt = t('thinMargin', { pct: fmt((r.ratio - 1) * 100, 0) });
    } else {
      r.cls = 'go';
      r.txt = t('goodMargin', { pct: fmt((r.ratio - 1) * 100, 0) });
    }
    return r;
  }

  function doCalc() {
    var price = num($('bzPrice').value);
    if (!isFinite(price) || price <= 0) { alert(t('alertPrice')); return; }
    var o = {
      startup: num($('bzStartup').value) || 0,
      fixed: num($('bzFixed').value) || 0,
      price: price,
      varCost: num($('bzVar').value) || 0,
      vol: num($('bzVol').value)
    };
    var r = computeBreakeven(o);
    $('bzOut').style.display = 'block';

    $('bzProfitUnit').textContent = isFinite(r.profitPerUnit) ? baht(r.profitPerUnit) : '—';
    $('bzBreakeven').textContent = !isFinite(r.breakevenUnits) ? '—' : (r.breakevenUnits <= 0 ? t('fromFirstUnit') : fmt(r.breakevenUnits, 1));

    var projEl = $('bzProjected');
    if (isFinite(r.monthlyProfitAtVol)) {
      projEl.textContent = (r.monthlyProfitAtVol >= 0 ? '+' : '−') + baht(Math.abs(r.monthlyProfitAtVol));
      projEl.style.color = r.monthlyProfitAtVol >= 0 ? 'var(--ok)' : 'var(--err)';
    } else { projEl.textContent = '—'; projEl.style.color = ''; }

    $('bzPayback').textContent = isFinite(r.paybackMonths) ? (r.paybackMonths <= 0 ? t('immediate') : t('months', { n: fmt(r.paybackMonths, 1) })) : '—';

    var v = $('bzVerdict');
    v.className = 'verdict-box ' + r.cls;
    v.innerHTML = (r.cls === 'go' ? '' : r.cls === 'no' ? '' : '') + r.txt;
  }

  /* ── เช็กลิสต์ "พร้อมเริ่มหรือยัง?" ── */
  var bzAnswers = { emergency: null, contract: null, time: null, license: null };

  function checklistChecks() {
    var checks = [];
    function ynCheck(key, txt) {
      var v = bzAnswers[key];
      checks.push({ ok: v === 'yes' ? true : v === 'no' ? false : null, txt: txt });
    }
    ynCheck('emergency', t('chkEmergency'));
    ynCheck('contract', t('chkContract'));
    ynCheck('time', t('chkTime'));

    var startup = num($('bzStartup').value), own = num($('bzOwnCapital').value);
    if (!isFinite(startup) || !isFinite(own)) {
      checks.push({ ok: null, txt: t('chkCapUnknown') });
    } else {
      var okCap = own >= startup;
      checks.push({ ok: okCap, txt: okCap ? t('chkCapOk', { own: baht(own), startup: baht(startup) }) : t('chkCapNo', { own: baht(own), startup: baht(startup) }) });
    }

    ynCheck('license', t('chkLicense'));
    return checks;
  }

  function doChecklist() {
    var checks = checklistChecks();
    var fails = checks.filter(function (c) { return c.ok === false; }).length;
    var unknowns = checks.filter(function (c) { return c.ok === null; }).length;
    var box = $('bzChkResult'), v = $('bzChkVerdict');
    if (fails > 0) { v.className = 'verdict-box no'; v.textContent = t('chkFail', { n: fails }); }
    else if (unknowns > 0) { v.className = 'verdict-box warn'; v.textContent = t('chkNeedMore', { n: unknowns }); }
    else { v.className = 'verdict-box go'; v.textContent = t('chkGo'); }
    var html = '';
    checks.forEach(function (c) {
      var ic = c.ok === true ? '' : c.ok === false ? '' : '◻️';
      html += '<li class="' + (c.ok === false ? 'fail' : 'pass') + '"><span class="ic">' + ic + '</span><span>' + c.txt + '</span></li>';
    });
    $('bzChkList').innerHTML = html;
    box.style.display = 'block';
  }

  /* ── บันทึกไอเดียที่กำลังพิจารณา (localStorage) ── */
  function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
  function saveLog(a) { try { localStorage.setItem(LOG_KEY, JSON.stringify(a)); } catch (e) {} }

  function renderLog() {
    var log = loadLog(), box = $('bzLogBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">' + t('logEmptyDefault') + '</div>'; return; }
    var html = '<table class="log-table"><thead><tr><th>' + t('logThIdea') + '</th><th>' + t('logThStartup') + '</th><th>' + t('logThBreakeven') + '</th><th>' + t('logThPayback') + '</th><th>' + t('logThProjected') + '</th><th></th></tr></thead><tbody>';
    log.forEach(function (r, i) {
      html += '<tr><td>' + r.name + '</td><td>' + baht(r.startup) + '</td>' +
        '<td>' + (isFinite(r.breakevenUnits) ? fmt(r.breakevenUnits, 1) : '—') + '</td>' +
        '<td>' + (isFinite(r.paybackMonths) ? fmt(r.paybackMonths, 1) : '—') + '</td>' +
        '<td style="color:' + (r.monthlyProfitAtVol >= 0 ? 'var(--ok)' : 'var(--err)') + '">' + (isFinite(r.monthlyProfitAtVol) ? ((r.monthlyProfitAtVol >= 0 ? '+' : '−') + baht(Math.abs(r.monthlyProfitAtVol))) : '—') + '</td>' +
        '<td><button class="log-del" data-i="' + i + '">✕</button></td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.log-del'), function (b) {
      b.addEventListener('click', function () { var log = loadLog(); log.splice(+b.getAttribute('data-i'), 1); saveLog(log); renderLog(); });
    });
  }

  function addIdea() {
    var name = ($('bzIdeaName').value || '').trim();
    var price = num($('bzPrice').value);
    if (!name) { alert(t('alertIdeaName')); return; }
    if (!isFinite(price) || price <= 0) { alert(t('alertPriceInCalc')); return; }
    var o = { startup: num($('bzStartup').value) || 0, fixed: num($('bzFixed').value) || 0, price: price, varCost: num($('bzVar').value) || 0, vol: num($('bzVol').value) };
    var r = computeBreakeven(o);
    var log = loadLog();
    log.push({
      name: name, startup: o.startup, fixed: o.fixed, price: o.price, varCost: o.varCost, vol: o.vol,
      profitPerUnit: r.profitPerUnit, breakevenUnits: r.breakevenUnits, paybackMonths: r.paybackMonths, monthlyProfitAtVol: r.monthlyProfitAtVol,
      ts: Date.now()
    });
    saveLog(log);
    $('bzIdeaName').value = '';
    renderLog();
  }

  function init() {
    applyStaticI18n();
    renderIdeaList();
    $('bzIdeaListWrap').addEventListener('click', function (e) {
      var card = e.target.closest('.idea-card'); if (!card) return;
      showIdeaDetail(card.getAttribute('data-id'));
    });
    $('bzIdeaDetail').addEventListener('click', function (e) {
      if (e.target.closest('#bzIdeaBack')) hideIdeaDetail();
    });
    var hashId = (location.hash || '').replace(/^#idea-/, '');
    if (hashId && findIdea(hashId)) showIdeaDetail(hashId);

    $('bzCalcBtn').addEventListener('click', doCalc);
    $('bzChkForm').addEventListener('click', function (e) {
      var btn = e.target.closest('.yn-btn'); if (!btn) return;
      var row = btn.closest('.yn-row'), key = row.getAttribute('data-key'), val = btn.getAttribute('data-val');
      bzAnswers[key] = val;
      [].forEach.call(row.querySelectorAll('.yn-btn'), function (b) { b.classList.remove('on', 'yes', 'no'); });
      btn.classList.add('on', val);
    });
    $('bzChkBtn').addEventListener('click', doChecklist);
    $('bzOwnCapital').addEventListener('input', function () { if ($('bzChkResult').style.display !== 'none') doChecklist(); });
    $('bzAddBtn').addEventListener('click', addIdea);
    renderLog();
    doCalc(); /* แสดงผลตั้งต้นทันที */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.omeApplyLang = function () {
    applyStaticI18n();
    renderIdeaList();
    if (curIdeaId) showIdeaDetail(curIdeaId);
    doCalc();
    if ($('bzChkResult').style.display !== 'none') doChecklist();
    renderLog();
  };

  window.__biz = { computeBreakeven: computeBreakeven };
})();
