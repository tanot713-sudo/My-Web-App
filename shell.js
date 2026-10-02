/* ══════════════════════════════════════════════════════════════════
   Tanot Shell — ปุ่มแฮมเบอร์เกอร์ + เมนูลิ้นชักกลาง + สลับธีมมืด/สว่าง + ลงทะเบียน PWA
   ใช้คู่กับ theme.css — ใส่ <script src="shell.js" defer></script> ในทุกหน้า

   โครงสร้างเมนูทั้งเว็บ (รวมหมวดย่อยการลงทุนที่เดิมอยู่ใน invest-nav.js) นิยามครั้งเดียวที่นี่
   ทุกหน้า (รวมโซนการลงทุน) อ่านจากที่นี่ผ่าน window.INVEST_CATS สำหรับ invest.html's hub tiles
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var BASE = location.pathname.replace(/[^/]*$/, '');
  var HERE = location.pathname.split('/').pop() || 'index.html';
  var HERE_FULL = HERE + location.search; // เทียบกับ href ที่มี query string (เช่น run.html?tool=est-cost)
  var HERE_HASH = HERE + location.hash;    // เทียบกับ href ที่มี hash (เช่น legal.html#plaint)
  var HERE_FULL_HASH = HERE + location.search + location.hash;
  function hrefMatches(href) {
    return href === HERE_FULL || href === HERE || href === HERE_HASH || href === HERE_FULL_HASH;
  }
  function soonHref(label) { return 'soon.html?label=' + encodeURIComponent(label); }

  /* ── โหมดฝังในป๊อปอัพ (?embed=1) — เปิดหน้าเดิมในกรอบลอยจากหน้าอื่น (เช่น invest.html) โดยไม่โหลด
     ซ้ำ: แถบนำทางบนสุด/เมนูลิ้นชัก/วิดเจ็ตแชท AI ลอย/ฟุตเตอร์ เพราะหน้าที่เปิดป๊อปอัพมีของพวกนี้อยู่แล้ว
     ธีม (theme-boot.js) และ window.INVEST_CATS ยังทำงานตามปกติ — หน้าที่ฝังยังพึ่งพาสิ่งเหล่านี้ได้ */
  function isEmbedded() {
    try { return new URLSearchParams(location.search).get('embed') === '1'; } catch (e) { return false; }
  }

  /* ── วิดเจ็ตแชท AI ลอย (ปุ่ม 💬 มุมขวาล่างทุกหน้า) — เดิมเป็นหน้าแยก ai-chat.html ย้ายมาเป็นวิดเจ็ต
     ลอยแทนตามที่ผู้ใช้ขอ ฉีด <script> เข้าไปจากที่นี่แทนที่จะต้องแก้ <head>/<body> ของทุกหน้า (30+ไฟล์)
     เอง — ตัว ai-chat-widget.js สร้าง DOM/CSS/logic ของวิดเจ็ตเองทั้งหมด ไม่โหลดโมเดล AI ใดๆ ตอนนี้
     (โหลดเฉพาะตอนผู้ใช้กดส่งข้อความ/ใช้ไมค์ครั้งแรกจริงๆ) */
  (function injectAiChatWidget() {
    if (isEmbedded()) return; /* ในป๊อปอัพ หน้าที่เปิดป๊อปอัพมีวิดเจ็ตแชทของตัวเองอยู่แล้ว ไม่ต้องซ้ำ */
    /* ai-client.js ต้องมาก่อนวิดเจ็ต (วิดเจ็ตเรียกคลาวด์ก่อนโมเดลในเครื่อง) — async=false ให้สคริปต์ที่ฉีดรันเรียงตามลำดับที่ใส่ */
    ['ai-client.js', 'ai-chat-widget.js'].forEach(function (f) {
      if (f === 'ai-client.js' && window.AiClient) return;
      var s = document.createElement('script');
      s.src = BASE + f; s.async = false;
      document.head.appendChild(s);
    });
  })();

  /* ── ธีม: ค่าและการตั้งค่าอยู่ที่ theme-boot.js (window.OmeTheme) ซึ่งตั้ง data-theme/accent/style
     + ฟอนต์ไว้ก่อนวาดจอแล้ว ที่นี่เก็บแค่ป้ายชื่อสำหรับแผงตั้งค่า ── */
  var OT = window.OmeTheme;
  var ACCENTS = [
    { id: 'teal',     label: 'เขียวน้ำทะเล (ปกติ)', swatch: '#12A594' },
    { id: 'blue',     label: 'น้ำเงิน',            swatch: '#3D7CF4' },
    { id: 'violet',   label: 'ม่วง',               swatch: '#7C6FEA' },
    { id: 'orange',   label: 'ส้ม',                swatch: '#E8743B' },
    { id: 'graphite', label: 'เทาเข้ม',            swatch: '#3F3F46' }
  ];
  var STYLES = [
    { id: 'flat',    label: 'เรียบ (ปกติ)' },
    { id: 'soft',    label: 'นุ่ม' },
    { id: 'outline', label: 'เส้นขอบ' }
  ];
  var FONTS = [
    { id: 'prompt',  label: 'Prompt (ปกติ)' },
    { id: 'ibmplex', label: 'IBM Plex Sans Thai' }
  ];
  function themeGet(kind) { return OT ? OT.get(kind) : (kind === 'theme' ? 'light' : ''); }
  function themeSet(kind, v) { if (OT) OT.set(kind, v); }
  function syncThemeBtn() {
    var btn = document.getElementById('omeThemeBtn');
    if (btn) btn.textContent = themeGet('theme') === 'dark' ? '☀️' : '🌙';
  }
  if (OT) OT.onChange(syncThemeBtn);

  /* ── ภาษา UI: จุดกลางเดียวให้ทุกเครื่องมือที่รองรับ 2 ภาษาอ่าน/เขียนร่วมกัน ──────────
     เดิมแต่ละเครื่องมือ (cad/word/excel/doc-check ใช้ 'tanot:doclang' ร่วมกันอยู่แล้ว ส่วน
     music/sports/coding/cooking/typing/report-dashboard ใช้คนละคีย์แยกกัน) ทำให้สลับภาษา
     ที่เครื่องมือหนึ่งแล้วไปเปิดอีกเครื่องมือ ต้องกดสลับใหม่ทุกครั้ง — ย้ายมารวมเป็นคีย์เดียว
     ที่นี่ ('ome:lang') แต่ละไฟล์เครื่องมือ (ดู commit ที่แก้พร้อมกัน) ชี้ LANG_KEY ของตัวเอง
     มาที่คีย์นี้แทน และ expose window.omeApplyLang ไว้ให้จุดกลางนี้เรียกตอนสลับจากเมนูตั้งค่า
     (ปุ่มสลับภาษาเดิมของแต่ละหน้ายังใช้ได้ปกติ แค่เขียน/อ่านคีย์เดียวกันแล้ว) */
  function getUILangGlobal() {
    try {
      var v = localStorage.getItem('ome:lang');
      if (v === 'en' || v === 'th') return v;
    } catch (e) {}
    return 'th';
  }
  function setUILangGlobal(lang) {
    try { localStorage.setItem('ome:lang', lang); } catch (e) {}
    if (typeof window.omeApplyLang === 'function') window.omeApplyLang();
  }
  window.OME_LANG = { get: getUILangGlobal, set: setUILangGlobal };

  /* ── โครงสร้างเมนูทั้งเว็บ — จัดตาม 4 ด้านของชีวิต (ROADMAP 0d) ────────────
     ชั้นบนสุด = ด้าน (area: today/work/life/edu/hobby/settings) แต่ละด้านมี href ไปหน้า area.html?a=<area>
     key ไม่ซ้ำกัน, href = ลิงก์ไปหน้านั้น (ไม่ใส่ = เป็นแค่หมวดหมู่ให้กดขยาย), children = รายการย่อย
     icon = ชื่อไอคอนใน icons.svg (ไม่ใส่ตัว "i-"), keywords = คำค้นไทย/อังกฤษ (ไว้ใช้กับ palette.js Phase 3),
     status = 'soon' สำหรับหน้าที่ยังไม่ทำ (ไม่ใส่ = พร้อมใช้) — อ่านโดย area.html และ tests/helpers.js */
  var MENU = [
    { key: 'home', area: 'today', label: 'วันนี้', icon: 'house', href: 'index.html', keywords: 'หน้าแรก home today วันนี้' },
    { key: 'work', area: 'work', label: 'งาน', icon: 'briefcase', href: 'area.html?a=work', keywords: 'งาน work ทำงาน', children: [
        { key: 'documents', label: 'เอกสาร', icon: 'folder', children: [
            { key: 'word',         label: 'งาน Word', icon: 'file-text', href: 'word.html', keywords: 'word เอกสาร docx' },
            { key: 'excel',        label: 'งาน Excel', icon: 'file-spreadsheet', href: 'excel.html', keywords: 'excel ตาราง xlsx' },
            { key: 'powerpoint',   label: 'งาน PowerPoint', icon: 'presentation', href: soonHref('งาน PowerPoint'), status: 'soon', keywords: 'powerpoint สไลด์ นำเสนอ pptx' },
            { key: 'extract-text', label: 'ดึงข้อความออกจากเอกสาร', icon: 'copy', href: 'extract-text.html', keywords: 'ocr ดึงข้อความ pdf' },
            { key: 'doc-check',    label: 'ตรวจสอบเอกสาร', icon: 'circle-check', href: 'doc-check.html', keywords: 'ตรวจเอกสาร สะกด ไวยากรณ์ proofread' },
            { key: 'data-compare', label: 'เปรียบเทียบข้อมูล', icon: 'arrow-up-down', href: soonHref('เปรียบเทียบข้อมูล'), status: 'soon', keywords: 'เปรียบเทียบ diff compare' }
          ]
        },
        { key: 'engineering', label: 'วิศวกรรม', icon: 'wrench', children: [
            { key: 'cad',         label: 'งานเขียนแบบ CAD (2D/3D)', icon: 'box', href: 'cad.html', keywords: 'cad เขียนแบบ แบบ drawing' },
            { key: 'est-cost',    label: 'ประเมินราคา PM/CM', icon: 'calculator', href: 'run.html?tool=est-cost', keywords: 'ประเมินราคา ประมาณราคา pm cm boq' },
            { key: 'maintenance', label: 'บันทึกงานบำรุงรักษา', icon: 'clipboard-list', href: 'maintenance.html', keywords: 'บำรุงรักษา maintenance pm cm ใบสั่งงาน แจ้งซ่อม ตรวจเช็ก qr อุปกรณ์' },
            { key: 'electrical',  label: 'เครื่องคำนวณไฟฟ้า', icon: 'zap', href: 'electrical.html', keywords: 'ไฟฟ้า คำนวณ electrical แรงดันตก voltage drop ขนาดสาย ลัดวงจร short circuit คาปาซิเตอร์ pf ฉนวน pi dar กราวด์ หลักดิน ground กับดักฟ้าผ่า arrester bil' }
          ]
        },
        { key: 'reports', label: 'ข้อมูล/รายงาน', icon: 'chart-column', children: [
            { key: 'report-dashboard', label: 'นำเสนอรายงาน', icon: 'chart-pie', href: 'report-dashboard.html', keywords: 'รายงาน report dashboard' }
          ]
        },
        { key: 'legal', label: 'กฎหมาย', icon: 'scale', children: [
            { key: 'legal-plaint',        label: 'ร่างคำฟ้อง', icon: 'scale', href: 'legal.html#plaint', keywords: 'คำฟ้อง กฎหมาย ฟ้อง' },
            { key: 'legal-answer',        label: 'ร่างคำให้การ', icon: 'scale', href: 'legal.html#answer', keywords: 'คำให้การ กฎหมาย' },
            { key: 'legal-petition',      label: 'ร่างคำขอ', icon: 'scale', href: 'legal.html#petition', keywords: 'คำขอ กฎหมาย' },
            { key: 'legal-statement',     label: 'ร่างคำแถลง', icon: 'scale', href: 'legal.html#statement', keywords: 'คำแถลง กฎหมาย' },
            { key: 'legal-counterclaim',  label: 'ร่างฟ้องแย้ง', icon: 'scale', href: 'legal.html#counterclaim', keywords: 'ฟ้องแย้ง กฎหมาย' },
            { key: 'legal-prayer',        label: 'ร่างคำขอท้ายฟ้อง', icon: 'scale', href: 'legal.html#prayer', keywords: 'คำขอท้ายฟ้อง กฎหมาย' },
            { key: 'legal-police-report', label: 'ร่างเพื่อนำไปแจ้งความ', icon: 'scale', href: 'legal.html#police-report', keywords: 'แจ้งความ ตำรวจ กฎหมาย' }
          ]
        },
        { key: 'tts', label: 'แปลงเสียง ↔ ข้อความ', icon: 'mic', href: 'text-to-speech.html', keywords: 'เสียง ข้อความ tts asr whisper ถอดเสียง อ่านออกเสียง' }
      ]
    },
    { key: 'life', area: 'life', label: 'ชีวิตประจำวัน', icon: 'wallet', href: 'area.html?a=life', keywords: 'ชีวิตประจำวัน life', children: [
        { key: 'money', label: 'การเงิน', icon: 'coins', children: [
            { key: 'finance',   label: 'รายรับรายจ่าย', icon: 'wallet', href: 'budget.html', keywords: 'รายรับ รายจ่าย งบ budget' },
            { key: 'tax',       label: 'การจ่ายภาษี', icon: 'landmark', href: 'tax.html', keywords: 'ภาษี tax ภาษีเงินได้ ลดหย่อน ภงด rmf ssf thaiesg ประกัน บำนาญ income tax deduction' },
            { key: 'insurance', label: 'ประกัน', icon: 'shield', href: 'insurance.html', keywords: 'ประกัน insurance กรมธรรม์ เบี้ยประกัน ต่ออายุ ลดหย่อน ประกันชีวิต ประกันสุขภาพ ประกันรถ ประกันบ้าน' },
            { key: 'invest', label: 'การลงทุน', icon: 'trending-up', href: 'invest.html', keywords: 'ลงทุน invest หุ้น', children: [
                { key: 'global-stock', label: 'หุ้นต่างประเทศ',  href: 'invest-global-stock.html' },
                { key: 'thai-stock',   label: 'หุ้นไทย',          href: 'invest-thai-stock.html' },
                { key: 'gold',         label: 'ทองคำ',            href: 'invest-gold.html' },
                { key: 'commodities',  label: 'ค่าเงิน & วัตถุดิบ', href: 'invest-commodities.html' },
                { key: 'news',         label: 'ข่าวหุ้น',          href: 'invest-news.html' },
                { key: 'portfolio',    label: 'พอร์ตจำลอง',        href: 'invest-portfolio.html' },
                { key: 'business',     label: 'ลงทุนทำธุรกิจ',    href: 'invest-business.html' },
                { key: 'gov-bond',     label: 'พันธบัตรรัฐบาล',   href: 'invest-gov-bond.html' },
                { key: 'gsb-lottery',  label: 'สลากออมสิน',       href: 'invest-gsb-lottery.html' },
                { key: 'baac-lottery', label: 'สลาก ธ.ก.ส.',      href: 'invest-baac-lottery.html' },
                { key: 'thai-fund',    label: 'กองทุนไทย',        href: 'invest-thai-fund.html' },
                { key: 'global-fund',  label: 'กองทุนต่างประเทศ', href: 'invest-global-fund.html' },
                { key: 'bitcoin',      label: 'Bitcoin',          href: 'invest-bitcoin.html' },
                { key: 'lottery',      label: 'สลากกินแบ่งรัฐบาล', href: 'invest-lottery.html' }
              ]
            }
          ]
        },
        { key: 'health',   label: 'สุขภาพ', icon: 'heart-pulse', href: soonHref('สุขภาพ'), status: 'soon', keywords: 'สุขภาพ health' },
        { key: 'receipts', label: 'คลังใบเสร็จ/ประกันสินค้า', icon: 'receipt', href: soonHref('คลังใบเสร็จ/ประกันสินค้า'), status: 'soon', keywords: 'ใบเสร็จ ประกันสินค้า warranty receipt' }
      ]
    },
    { key: 'edu', area: 'edu', label: 'การศึกษา', icon: 'graduation-cap', href: 'area.html?a=edu', keywords: 'การศึกษา เรียน education', children: [
        { key: 'review', label: 'ทบทวนวันนี้', icon: 'refresh-cw', href: 'review.html', keywords: 'ทบทวน flashcard review การ์ด xp วันติดต่อกัน streak เป้า' },
        { key: 'classroom', label: 'ห้องเรียน', icon: 'graduation-cap', children: [
            { key: 'classroom-law',         label: 'เรียนกฎหมาย', icon: 'scale', href: 'classroom-law.html', keywords: 'เรียนกฎหมาย เนติ' },
            { key: 'classroom-business',    label: 'ธุรกิจ', icon: 'briefcase', href: 'classroom-business.html', keywords: 'เรียนธุรกิจ business' },
            { key: 'classroom-engineering', label: 'วิศวกรรม', icon: 'wrench', href: 'classroom-engineering.html', keywords: 'เรียนวิศวกรรม engineering' }
          ]
        },
        { key: 'language', label: 'ภาษา', icon: 'languages', href: 'languages.html', keywords: 'ภาษา language อังกฤษ จีน ญี่ปุ่น' },
        { key: 'books',    label: 'หนังสือ', icon: 'book-open', href: soonHref('หนังสือ'), status: 'soon', keywords: 'หนังสือ book' }
      ]
    },
    { key: 'hobby', area: 'hobby', label: 'งานอดิเรก/ทักษะ', icon: 'music', href: 'area.html?a=hobby', keywords: 'งานอดิเรก ทักษะ hobby', children: [
        { key: 'music',  label: 'เรียนดนตรี', icon: 'music', href: 'music.html', keywords: 'ดนตรี music' },
        { key: 'sports', label: 'เรียนกีฬา', icon: 'dumbbell', href: 'sports.html', keywords: 'กีฬา sports' },
        { key: 'cooking', label: 'เรียนทำอาหาร', icon: 'chef-hat', href: 'cooking.html', keywords: 'ทำอาหาร cooking' },
        { key: 'coding', label: 'การเขียนโค้ด', icon: 'code', href: 'coding.html', keywords: 'โค้ด code programming' },
        { key: 'typing', label: 'สอนพิมพ์', icon: 'keyboard', href: 'typing.html', keywords: 'พิมพ์ดีด typing' },
        { key: 'games',  label: 'เกมที่เล่น', icon: 'gamepad-2', href: soonHref('เกมที่เล่น'), status: 'soon', keywords: 'เกม game' },
        { key: '3d-sim', label: 'จำลอง 3D', icon: 'box', children: [
            { key: '3d-objects', label: 'จำลองสิ่งของ', icon: 'box', href: 'sim-objects.html', keywords: '3d จำลอง สิ่งของ three' },
            { key: '3d-people',  label: 'จำลองคน', icon: 'user', href: soonHref('จำลองคน 3D'), status: 'soon', keywords: '3d คน' }
          ]
        }
      ]
    },
    { key: 'settings', area: 'settings', label: 'ตั้งค่า/ข้อมูล', icon: 'settings', href: 'area.html?a=settings', keywords: 'ตั้งค่า ข้อมูล settings', children: [
        { key: 'data', label: 'ข้อมูลและการซิงก์', icon: 'refresh-cw', href: 'data.html', keywords: 'ซิงก์ สำรอง backup restore sync ข้อมูล drive' },
        { key: 'migrate', label: 'ย้ายข้อมูลจาก github.io', icon: 'download', href: 'migrate.html', keywords: 'ย้ายข้อมูล migrate github import' },
        { key: 'credits', label: 'เครดิต & ลิขสิทธิ์', icon: 'info', href: 'credits.html', keywords: 'เครดิต ลิขสิทธิ์ credits license' }
      ]
    }
  ];
  window.OME_MENU = MENU;

  /* หมวดย่อยการลงทุน (เดิมมาจาก invest-nav.js) — คงชื่อ window.INVEST_CATS +
     รูปแบบ {key,label,icon,page} เดิม เพื่อไม่ต้องแก้ invest.html's tile-rendering script */
  (function exposeInvestCats() {
    var investNode = null;
    (function find(nodes) {
      nodes.forEach(function (n) {
        if (n.key === 'invest') investNode = n;
        else if (n.children) find(n.children);
      });
    })(MENU);
    if (!investNode) return;
    window.INVEST_CATS = (investNode.children || []).map(function (c) {
      return { key: c.key, label: c.label, icon: c.icon, page: c.href };
    });
  })();

  /* ── หาว่ากำลังอยู่หน้าไหน + เปิดกลุ่มที่ครอบหน้านั้นไว้ล่วงหน้า ──────── */
  function findActivePath(nodes, path) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.href && hrefMatches(n.href)) { path.push(n); return true; }
      if (n.children && findActivePath(n.children, path)) { path.push(n); return true; }
    }
    return false;
  }
  var activePath = [];
  findActivePath(MENU, activePath); // เรียงจากลึกสุด -> บนสุด

  function renderMenuNodes(nodes, container, depth) {
    nodes.forEach(function (n) {
      var isActive = !!n.href && hrefMatches(n.href);
      var isAncestorOfActive = activePath.indexOf(n) !== -1 && !isActive;
      var row = document.createElement('div');
      row.className = 'ome-menu-row';

      if (n.href) {
        var a = document.createElement('a');
        a.className = 'ome-menu-link' + (isActive ? ' active' : '');
        a.href = BASE + n.href;
        a.innerHTML = (n.icon ? '<svg class="ome-icon ome-menu-ic" aria-hidden="true"><use href="' + BASE + 'icons.svg#i-' + n.icon + '"/></svg>' : '') + '<span>' + n.label + '</span>';
        row.appendChild(a);
      } else {
        var cat = document.createElement('div');
        cat.className = 'ome-menu-cat';
        cat.textContent = n.label;
        row.appendChild(cat);
      }

      var childrenWrap = null;
      if (n.children && n.children.length) {
        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'ome-menu-toggle';
        toggle.setAttribute('aria-label', 'ขยาย ' + n.label);
        toggle.innerHTML = '▸';
        row.appendChild(toggle);

        childrenWrap = document.createElement('div');
        childrenWrap.className = 'ome-menu-children';
        renderMenuNodes(n.children, childrenWrap, depth + 1);

        var startOpen = isAncestorOfActive;
        if (startOpen) { toggle.classList.add('open'); childrenWrap.classList.add('open'); }

        toggle.addEventListener('click', function () {
          var open = childrenWrap.classList.toggle('open');
          toggle.classList.toggle('open', open);
        });

        /* กดชื่อหมวดที่ไม่มีลิงก์ (เช่น "ชีวิตประจำวัน"/"ห้องเรียน") ก็ขยาย/ยุบได้เหมือนกดลูกศร */
        if (!n.href) {
          row.style.cursor = 'pointer';
          row.addEventListener('click', function (e) {
            if (e.target === toggle) return;
            toggle.click();
          });
        }
      }

      container.appendChild(row);
      if (childrenWrap) container.appendChild(childrenWrap);
    });
  }

  function buildNav() {
    var nav = document.createElement('nav');
    nav.className = 'ome-nav';
    nav.setAttribute('aria-label', 'เมนูหลัก Tanot');

    var hamburger = document.createElement('button');
    hamburger.type = 'button';
    hamburger.className = 'ome-hamburger';
    hamburger.setAttribute('aria-label', 'เปิดเมนู');
    hamburger.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
    nav.appendChild(hamburger);

    var logo = document.createElement('a');
    logo.className = 'ome-nav-logo';
    logo.href = BASE + 'index.html';
    logo.innerHTML = '<span class="dot">T</span><span class="txt">Tanot</span>';
    nav.appendChild(logo);

    var right = document.createElement('div');
    right.className = 'ome-nav-right';
    var searchBtn = document.createElement('button');
    searchBtn.id = 'omeSearchBtn';
    searchBtn.type = 'button';
    searchBtn.className = 'ome-theme-btn';
    searchBtn.setAttribute('aria-label', 'ค้นหา (Ctrl+K)');
    searchBtn.setAttribute('aria-haspopup', 'dialog');
    searchBtn.innerHTML = '<svg class="ome-icon" width="16" height="16" aria-hidden="true"><use href="' + BASE + 'icons.svg#i-search"/></svg>';
    searchBtn.addEventListener('click', function () { openPalette(); });
    right.appendChild(searchBtn);
    var themeBtn = document.createElement('button');
    themeBtn.id = 'omeThemeBtn';
    themeBtn.className = 'ome-theme-btn';
    themeBtn.setAttribute('aria-label', 'สลับโหมดสว่าง/มืด');
    themeBtn.textContent = themeGet('theme') === 'dark' ? '☀️' : '🌙';
    themeBtn.addEventListener('click', function () {
      themeSet('theme', document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
    right.appendChild(themeBtn);

    var gearBtn = document.createElement('button');
    gearBtn.id = 'omeGearBtn';
    gearBtn.className = 'ome-theme-btn';
    gearBtn.setAttribute('aria-label', 'ตั้งค่า');
    gearBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    right.appendChild(gearBtn);

    nav.appendChild(right);

    document.body.insertBefore(nav, document.body.firstChild);

    /* ── แผงตั้งค่า (dropdown เล็กใต้ปุ่มฟันเฟือง) ── */
    var settingsPanel = document.createElement('div');
    settingsPanel.className = 'ome-settings-panel';

    /* แถว "เลือกธีมเว็บ" — กดแล้วกางรายการสวอตช์สีให้เลือกตรงนี้เลย ไม่ต้องเปิดหน้าใหม่
       (ก่อนหน้านี้เป็นปุ่มค้างไว้เฉยๆ ไม่มีฟังก์ชันจริง — ต่อสายจริงตรงนี้) */
    var themeRow = document.createElement('button');
    themeRow.type = 'button';
    themeRow.className = 'ome-settings-row';
    themeRow.innerHTML = '<span>เลือกธีมเว็บ</span>';
    settingsPanel.appendChild(themeRow);

    var swatchWrap = document.createElement('div');
    swatchWrap.className = 'ome-theme-swatches';
    function markSelectedSwatch() {
      var cur = themeGet('accent');
      var nodes = swatchWrap.querySelectorAll('.ome-theme-swatch');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].classList.toggle('sel', nodes[i].getAttribute('data-accent-id') === cur);
      }
    }
    ACCENTS.forEach(function (ac) {
      var sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'ome-theme-swatch';
      sw.setAttribute('data-accent-id', ac.id);
      sw.innerHTML = '<span class="dot" style="background:' + ac.swatch + '"></span><span>' + ac.label + '</span>';
      sw.addEventListener('click', function () {
        themeSet('accent', ac.id);
        markSelectedSwatch();
      });
      swatchWrap.appendChild(sw);
    });
    markSelectedSwatch();
    themeRow.addEventListener('click', function () { swatchWrap.classList.toggle('open'); });
    settingsPanel.appendChild(swatchWrap);

    /* แถบย่อย "ประเภทธีม" — อยู่ในกลุ่มเดียวกับ "เลือกธีมเว็บ" ด้านบน (คนละแกนกัน: สี vs พื้นผิว)
       ตามที่ผู้ใช้ขอ "ในธีมเพิ่มแถบย่อยประเภทธีม" กลไกเดียวกับสวอตช์สี แค่ไม่มีจุดสี */
    var styleRow = document.createElement('button');
    styleRow.type = 'button';
    styleRow.className = 'ome-settings-row';
    styleRow.innerHTML = '<span>ประเภทธีม</span>';
    settingsPanel.appendChild(styleRow);

    var styleWrap = document.createElement('div');
    styleWrap.className = 'ome-theme-swatches';
    function markSelectedStyle() {
      var cur = themeGet('style');
      var nodes = styleWrap.querySelectorAll('.ome-theme-swatch');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].classList.toggle('sel', nodes[i].getAttribute('data-style-id') === cur);
      }
    }
    STYLES.forEach(function (st) {
      var sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'ome-theme-swatch';
      sw.setAttribute('data-style-id', st.id);
      sw.innerHTML = '<span>' + st.label + '</span>';
      sw.addEventListener('click', function () {
        themeSet('style', st.id);
        markSelectedStyle();
      });
      styleWrap.appendChild(sw);
    });
    markSelectedStyle();
    styleRow.addEventListener('click', function () { styleWrap.classList.toggle('open'); });
    settingsPanel.appendChild(styleWrap);

    /* แถว "ภาษา" — จุดกลางเดียวสลับภาษาของทุกเครื่องมือที่รองรับ 2 ภาษา (กลไกเดียวกับ
       แถบเลือกธีมเว็บด้านบน) กดแล้วกางตัวเลือก ไทย/English เลือกแล้วอัปเดตทันทีถ้าเครื่องมือ
       ในหน้าปัจจุบันมี window.omeApplyLang (ไม่มีก็แค่บันทึกค่าไว้ ให้หน้าเครื่องมือถัดไปอ่านเจอ) */
    var LANGS = [{ id: 'th', label: 'ไทย' }, { id: 'en', label: 'English' }];
    var langRow = document.createElement('button');
    langRow.type = 'button';
    langRow.className = 'ome-settings-row';
    langRow.innerHTML = '<span>ภาษา</span>';
    settingsPanel.appendChild(langRow);

    var langWrap = document.createElement('div');
    langWrap.className = 'ome-theme-swatches';
    function markSelectedLang() {
      var cur = getUILangGlobal();
      var nodes = langWrap.querySelectorAll('.ome-theme-swatch');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].classList.toggle('sel', nodes[i].getAttribute('data-lang-id') === cur);
      }
    }
    LANGS.forEach(function (l) {
      var lb = document.createElement('button');
      lb.type = 'button';
      lb.className = 'ome-theme-swatch';
      lb.setAttribute('data-lang-id', l.id);
      lb.innerHTML = '<span>' + l.label + '</span>';
      lb.addEventListener('click', function () {
        setUILangGlobal(l.id);
        markSelectedLang();
      });
      langWrap.appendChild(lb);
    });
    markSelectedLang();
    langRow.addEventListener('click', function () { langWrap.classList.toggle('open'); });
    settingsPanel.appendChild(langWrap);

    /* แถว "ตัวอักษร" (เฟส 8 — เดิมชื่อ "ปรับขนาดตัวอักษร" เป็นแค่ปุ่มค้างไว้เฉยๆ ไม่มีฟังก์ชันจริง
       เปลี่ยนชื่อ + ต่อสายจริงตรงนี้ตามที่ผู้ใช้ขอ) กดแล้วกางรายชื่อฟอนต์ให้เลือก — แต่ละชื่อ
       แสดงด้วยฟอนต์จริงของตัวเอง (ไม่ใช่ตัวอักษรเดียวกันหมด) ช่วยพรีวิวหน้าตาก่อนเลือกจริง
       โหลดไฟล์ฟอนต์ (Google Fonts) แบบ lazy — โหลดตอนกดขยายรายการครั้งแรกเท่านั้น ไม่โหลดล่วงหน้า
       ทุกหน้าทั้งที่อาจไม่มีใครเปิดเมนูนี้เลย (ประหยัด request เว็บให้เบาเหมือนเดิม) */
    var fontRow = document.createElement('button');
    fontRow.type = 'button';
    fontRow.className = 'ome-settings-row';
    fontRow.innerHTML = '<span>ตัวอักษร</span>';
    settingsPanel.appendChild(fontRow);

    var fontWrap = document.createElement('div');
    fontWrap.className = 'ome-theme-swatches';
    function markSelectedFont() {
      var cur = themeGet('font');
      var nodes = fontWrap.querySelectorAll('.ome-theme-swatch');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].classList.toggle('sel', nodes[i].getAttribute('data-font-id') === cur);
      }
    }
    FONTS.forEach(function (f) {
      var sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'ome-theme-swatch';
      sw.setAttribute('data-font-id', f.id);
      sw.innerHTML = '<span style="font-family:' + (OT ? OT.fonts[f.id].family : 'inherit') + '">' + f.label + '</span>';
      sw.addEventListener('click', function () {
        themeSet('font', f.id);
        markSelectedFont();
      });
      fontWrap.appendChild(sw);
    });
    markSelectedFont();
    var fontsPreviewed = false;
    fontRow.addEventListener('click', function () {
      if (!fontsPreviewed) {
        fontsPreviewed = true;
        if (OT) FONTS.forEach(function (f) { OT.loadFont(OT.fonts[f.id].google); });
      }
      fontWrap.classList.toggle('open');
    });
    settingsPanel.appendChild(fontWrap);

    var SETTINGS_ROWS = [
      { label: 'ล้างข้อมูล' },
      { label: 'Help', divider: true }
    ];
    SETTINGS_ROWS.forEach(function (r) {
      if (r.divider) {
        var hr = document.createElement('div');
        hr.className = 'ome-settings-divider';
        settingsPanel.appendChild(hr);
      }
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'ome-settings-row';
      row.innerHTML = '<span>' + r.label + '</span>';
      settingsPanel.appendChild(row);
    });
    document.body.appendChild(settingsPanel);

    function openSettings() { settingsPanel.classList.add('open'); }
    function closeSettings() { settingsPanel.classList.remove('open'); }
    gearBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      settingsPanel.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!settingsPanel.contains(e.target) && e.target !== gearBtn) closeSettings();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSettings(); });

    /* ── ลิ้นชักเมนู ── */
    var backdrop = document.createElement('div');
    backdrop.className = 'ome-drawer-backdrop';

    var drawer = document.createElement('div');
    drawer.className = 'ome-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'เมนู Tanot');

    var head = document.createElement('div');
    head.className = 'ome-drawer-head';
    head.innerHTML = '<a class="brand" href="' + BASE + 'index.html"><span class="dot">T</span><span>Tanot</span></a>';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ome-drawer-close';
    closeBtn.setAttribute('aria-label', 'ปิดเมนู');
    closeBtn.textContent = '✕';
    head.appendChild(closeBtn);
    drawer.appendChild(head);

    var menu = document.createElement('div');
    menu.className = 'ome-menu';
    renderMenuNodes(MENU, menu, 0);
    drawer.appendChild(menu);

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    function openDrawer() { backdrop.classList.add('open'); drawer.classList.add('open'); }
    function closeDrawer() { backdrop.classList.remove('open'); drawer.classList.remove('open'); }

    hamburger.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
    drawer.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a.ome-menu-link')) closeDrawer();
    });
  }

  /* ── ฟุตเตอร์กลางล่างสุดของทุกหน้า — ลิงก์เดียว ไม่มีข้อความอื่นปน ── */
  function buildFooter() {
    var footer = document.createElement('footer');
    footer.className = 'ome-footer';
    var a = document.createElement('a');
    a.href = BASE + 'credits.html';
    a.textContent = 'เครดิต & ลิขสิทธิ์';
    footer.appendChild(a);
    document.body.appendChild(footer);
    stickFooter(footer);
  }

  /* ดัน footer ลงไปติดขอบล่างจริงของจอเมื่อเนื้อหาสั้นกว่า viewport
     ใช้ JS วัด/เติม margin-top แทนการเปลี่ยน display ของ body เป็น flex
     เพราะบางหน้า (เช่น word.html, legal.html) มีเลย์เอาต์ภายในซับซ้อนที่
     ชนกับกลไก sizing ของ flex item — วิธีนี้ไม่แตะ box model ของหน้าเดิมเลย */
  function stickFooter(footer) {
    var pendingRaf = null;
    function apply() {
      if (pendingRaf) cancelAnimationFrame(pendingRaf);
      pendingRaf = requestAnimationFrame(function () {
        pendingRaf = null;
        /* หัก margin-top ที่ใส่ไว้รอบก่อนออกก่อนวัด เพื่อให้เรียก apply() ซ้อนกันกี่ครั้ง/
           กี่จุด (attach ครั้งแรก, resize, load) ก็ได้ผลลัพธ์เดิมเสมอ (idempotent) —
           ถ้าไม่หักออก การเรียกซ้อนกันในเฟรมเดียวกันจะอ่านผลลัพธ์ของตัวเองแล้วคิดว่าไม่มีช่องว่างเหลือ
           ใช้ตำแหน่งจริงของ footer เทียบ viewport แทน document.documentElement.scrollHeight เพราะ
           scrollHeight รวมความสูงของ .ome-drawer/.ome-drawer-backdrop ที่ inset:0 เต็มจอเสมอ
           (แม้ซ่อนอยู่นอกจอด้วย transform/opacity) ทำให้วัดผิดเป็น viewport เต็มตลอด */
        var curMargin = parseFloat(getComputedStyle(footer).marginTop) || 0;
        var naturalBottom = footer.getBoundingClientRect().bottom - curMargin;
        var gap = window.innerHeight - naturalBottom;
        footer.style.marginTop = gap > 0 ? gap + 'px' : '0px';
      });
    }
    apply();
    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(apply, 150);
    });
    window.addEventListener('load', apply);
  }

  /* ── PWA ────────────────────────────────────────────────────────── */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      /* SW ใหม่ "เข้าควบคุม" หน้านี้ได้ (skipWaiting+clients.claim ใน sw.js) โดยไม่ทำให้โค้ด JS ที่โหลด
         และรันอยู่แล้วในแท็บนี้เปลี่ยนตามไปด้วย — ต้อง reload จริงๆ อีกครั้งถึงจะได้ report-dashboard.js
         ฉบับใหม่มาทำงาน ไม่งั้นผู้ใช้จะ "รีเฟรชแล้ว" แต่ยังเจอโค้ดเก่าอยู่ดี (สลับ controller ระหว่างกลาง
         แต่หน้าที่กำลังรันไม่ได้ re-execute script ใหม่) เจอเคสจริงว่าฟีเจอร์ที่เพิ่งแก้ไปแล้วดูเหมือน
         "ยังไม่ได้แก้" ทั้งที่ deploy สำเร็จแล้ว เพราะแท็บที่เปิดค้างไว้ตอน deploy ยังไม่เคย reload ครบ
         รอบตั้งแต่ SW ใหม่เข้าควบคุม — reload ให้อัตโนมัติทันทีที่ตรวจพบว่า controller เปลี่ยน (ครั้งเดียว
         กัน loop เผื่อ event ยิงซ้ำ) ผู้ใช้จะได้เห็นโค้ดล่าสุดจริงๆ โดยไม่ต้องกดรีเฟรชเอง 2 รอบ */
      /* สำคัญ: controllerchange ยิงด้วยตอน "ครั้งแรกที่เคยลงทะเบียน SW" เช่นกัน (จากไม่มี controller เลย
         กลายเป็นมี) ไม่ใช่แค่ตอนมี SW เก่าอยู่แล้วแล้วเปลี่ยนเป็นใหม่ — ต้องเช็คว่ามี controller อยู่ก่อน
         หน้าเว็บนี้โหลดเสร็จด้วย (แปลว่าเป็นแท็บที่เปิดค้าง/เข้าซ้ำ ไม่ใช่ครั้งแรก) ถึงจะ reload ไม่งั้น
         ทุกคนที่เข้าเว็บนี้ครั้งแรก (หรือเปิด private/ล้างแคช) จะโดน reload เด้งซ้ำโดยไม่จำเป็นทันทีที่เข้า */
      var hadController = !!navigator.serviceWorker.controller;
      var reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (reloading || !hadController) return;
        reloading = true;
        location.reload();
      });
      navigator.serviceWorker.register(BASE + 'sw.js').then(function (reg) {
        /* เช็คอัปเดต sw.js ทันทีทุกครั้งที่โหลดหน้า — ปกติเบราว์เซอร์จะเช็คให้เองอัตโนมัติแค่ทุก ~24
           ชั่วโมง (ตาม spec ของ Service Worker) เจอจริงว่าตอน deploy โค้ดใหม่หลายรอบในวันเดียวกัน (ระหว่าง
           debug) ผู้ใช้ปิดเปิดแท็บใหม่แล้วก็ยังเจอโค้ด/แคชเก่าอยู่ดี เพราะ "ปิดเปิดแท็บ" ไม่เท่ากับ "สั่ง
           เช็คอัปเดต SW" — เบราว์เซอร์ยังไม่ครบ 24 ชม. จากครั้งก่อนก็เลยไม่เช็คให้เอง ต้องเรียก
           reg.update() ตรงๆ ถึงจะบังคับเช็คทันทีไม่ติด throttle นี้ (ตาม spec การเรียก update() ตรงๆ
           ข้าม throttle 24 ชม. ที่ใช้กับการเช็คอัตโนมัติของเบราว์เซอร์เองเท่านั้น) */
        reg.update().catch(function () {});
      }).catch(function () {});
    }
  }

  /* ── กล่องยืนยัน/แจ้งเตือนของเว็บเอง (แทน confirm()/alert() ของเบราว์เซอร์)
     ใช้เพราะกล่อง confirm()/alert() ของเบราว์เซอร์เป็นกล่องของระบบปฏิบัติการ
     (ดำ/เทา แล้วแต่เครื่อง) แต่งด้วย CSS จากเว็บไม่ได้เลยไม่ว่ากรณีไหน ทุกหน้า
     เรียกใช้ผ่าน window.tanotConfirm(msg, opts) / window.tanotAlert(msg) แทน
     confirm()/alert() ตรงๆ ได้เลย ทั้งคู่คืน Promise ══ */
  function tanotModal(msg, buttons) {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'tanot-modal-overlay';
      var box = document.createElement('div');
      box.className = 'tanot-modal-box';
      var p = document.createElement('div');
      p.className = 'tanot-modal-msg';
      p.textContent = msg;
      box.appendChild(p);
      var actions = document.createElement('div');
      actions.className = 'tanot-modal-actions';
      function done(value) {
        if (!overlay.parentNode) return;
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', onKey);
        resolve(value);
      }
      function onKey(e) { if (e.key === 'Escape') done(false); }
      buttons.forEach(function (b) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = b.cls || '';
        btn.textContent = b.label;
        btn.addEventListener('click', function () { done(b.value); });
        actions.appendChild(btn);
      });
      box.appendChild(actions);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      if (actions.lastChild) actions.lastChild.focus();
      document.addEventListener('keydown', onKey);
    });
  }
  window.tanotConfirm = function (msg, opts) {
    opts = opts || {};
    return tanotModal(msg, [
      { label: opts.cancelLabel || 'ยกเลิก', value: false },
      { label: opts.okLabel || 'ตกลง', value: true, cls: opts.danger ? 'danger' : 'primary' }
    ]);
  };
  window.tanotAlert = function (msg, opts) {
    opts = opts || {};
    return tanotModal(msg, [{ label: opts.okLabel || 'ตกลง', value: true, cls: 'primary' }]);
  };

  /* ── ค้นหาด่วน (palette.js) — โหลดตอนใช้ครั้งแรกเท่านั้น ไม่ให้ทุกหน้าแบกโค้ดค้นหาไว้เปล่าๆ ──
     ปุ่มบน nav กับ Ctrl/⌘+K เรียกฟังก์ชันเดียวกัน; OME_MENU (ด้านบน) คือแหล่งข้อมูลที่ palette อ่าน */
  var paletteLoading = null;
  function openPalette() {
    if (window.OmePalette) { window.OmePalette.toggle(); return; }
    if (!paletteLoading) {
      paletteLoading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = BASE + 'palette.js';
        s.onload = resolve;
        s.onerror = function () { paletteLoading = null; reject(new Error('palette.js')); };
        document.head.appendChild(s);
      });
    }
    paletteLoading.then(function () { if (window.OmePalette) window.OmePalette.open(); }, function () {});
  }
  window.openOmePalette = openPalette;
  if (!isEmbedded()) {
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openPalette();
      }
    });
  }

  function initShellChrome() {
    if (!isEmbedded()) { buildNav(); buildFooter(); } /* ในป๊อปอัพ ไม่ต้องมีแถบนำทาง/เมนูลิ้นชัก/ฟุตเตอร์ซ้ำ */
    registerSW();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShellChrome);
  } else {
    initShellChrome();
  }
})();
