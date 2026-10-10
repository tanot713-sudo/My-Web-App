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
  /* รายการเมนูที่มีแท็บ (n.tabs) ถือว่า active เมื่อ path ตรง ไม่สน hash (เปิด invest-stock.html#us แล้วเมนู "หุ้น" (#th) ยังไฮไลต์) */
  function nodeMatches(n) {
    if (!n.href) return false;
    if (hrefMatches(n.href)) return true;
    return !!n.tabs && n.href.split('#')[0].split('?')[0] === HERE;
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
    /* ai-client.js ต้องมาก่อนวิดเจ็ต (วิดเจ็ตเรียกคลาวด์ก่อนโมเดลในเครื่อง) · media-core.js = งบหน่วยความจำโมเดล/ถอดรหัสเสียง/บันทึกปัญหา
       ที่วิดเจ็ตใช้ร่วมกับหน้า text-to-speech · tts-normalize.js = ปรับข้อความก่อนพูด (วิดเจ็ตต้องใช้ก่อนส่งเข้าโมเดลเสียงเสมอ) — async=false ให้สคริปต์ที่ฉีดรันเรียงตามลำดับที่ใส่ */
    /* media-models.js = ตารางโมเดลเสียง (เสียงเริ่มต้น/ธงลดเสียงแหลมของวิดเจ็ต + dtype ที่ media-core ใช้) · asr-calc.js = วางแผนท่อน ≤ 30 วิ + ต่อผลถอดเสียงในเบราว์เซอร์ (media-core.js transcribeLocal) */
    ['ai-client.js', 'media-core.js', 'media-models.js', 'asr-calc.js', 'tts-normalize.js', 'audio-gain.js', 'ai-chat-widget.js'].forEach(function (f) {
      if (f === 'ai-client.js' && window.AiClient) return;
      if (f === 'media-core.js' && window.TanotMedia) return;
      if (f === 'media-models.js' && window.TanotMediaModels) return;
      if (f === 'asr-calc.js' && window.AsrCalc) return;
      if (f === 'tts-normalize.js' && window.TanotTtsNorm) return;
      if (f === 'audio-gain.js' && window.TanotAudioGain) return;
      var s = document.createElement('script');
      s.src = BASE + f; s.async = false;
      document.head.appendChild(s);
    });
  })();

  /* ── ธีม: ค่าและการตั้งค่าอยู่ที่ theme-boot.js (window.OmeTheme) ซึ่งตั้ง data-theme/accent/style
     + ฟอนต์ไว้ก่อนวาดจอแล้ว ที่นี่เก็บแค่ป้ายชื่อสำหรับแผงตั้งค่า ── */
  var OT = window.OmeTheme;
  /* ── ข้อความของ shell ทั้งหมด (ไทย/อังกฤษ) — ผ่าน OME_I18N (i18n.js) · ป้ายเมนูอยู่ใน MENU (label/labelEn) ── */
  var I18N = window.OME_I18N || null;
  if (I18N) I18N.add('shell', {
    th: {
      mainNav: 'เมนูหลัก Tanot', openMenu: 'เปิดเมนู', closeMenu: 'ปิดเมนู', menu: 'เมนู Tanot', expand: 'ขยาย {label}',
      search: 'ค้นหา (Ctrl+K)', themeToggle: 'สลับโหมดสว่าง/มืด', settings: 'ตั้งค่า',
      accent: 'เลือกธีมเว็บ', style: 'ประเภทธีม', lang: 'ภาษา', font: 'ตัวอักษร', bg: 'ความเข้มภาพพื้นหลัง',
      'bg.off': 'ปิด', 'bg.soft': 'อ่อน', 'bg.mid': 'กลาง (ปกติ)', 'bg.strong': 'ชัด',
      clearData: 'ล้างข้อมูล', help: 'Help', credits: 'เครดิต & ลิขสิทธิ์',
      'accent.teal': 'เขียวน้ำทะเล (ปกติ)', 'accent.blue': 'น้ำเงิน', 'accent.violet': 'ม่วง', 'accent.orange': 'ส้ม', 'accent.graphite': 'เทาเข้ม',
      'style.flat': 'เรียบ (ปกติ)', 'style.soft': 'นุ่ม', 'style.outline': 'เส้นขอบ',
      'font.prompt': 'Prompt (ปกติ)', 'font.ibmplex': 'IBM Plex Sans Thai',
      ok: 'ตกลง', cancel: 'ยกเลิก', del: 'ลบ', confirmDelete: 'ลบ{what}?', confirmDeleteGeneric: 'ลบรายการนี้?', soon: 'เร็วๆ นี้'
    },
    en: {
      mainNav: 'Tanot main menu', openMenu: 'Open menu', closeMenu: 'Close menu', menu: 'Tanot menu', expand: 'Expand {label}',
      search: 'Search (Ctrl+K)', themeToggle: 'Toggle light/dark mode', settings: 'Settings',
      accent: 'Accent colour', style: 'Surface style', lang: 'Language', font: 'Font', bg: 'Background image intensity',
      'bg.off': 'Off', 'bg.soft': 'Light', 'bg.mid': 'Medium (default)', 'bg.strong': 'Vivid',
      clearData: 'Clear data', help: 'Help', credits: 'Credits & licenses',
      'accent.teal': 'Teal (default)', 'accent.blue': 'Blue', 'accent.violet': 'Violet', 'accent.orange': 'Orange', 'accent.graphite': 'Graphite',
      'style.flat': 'Flat (default)', 'style.soft': 'Soft', 'style.outline': 'Outline',
      'font.prompt': 'Prompt (default)', 'font.ibmplex': 'IBM Plex Sans Thai',
      ok: 'OK', cancel: 'Cancel', del: 'Delete', confirmDelete: 'Delete {what}?', confirmDeleteGeneric: 'Delete this item?', soon: 'Coming soon'
    }
  });
  /* หน้าที่ไม่ได้โหลด i18n.js (ไม่ควรมี — repo-guards ตรวจ) ยังแสดงภาษาไทยได้ */
  var TH_FALLBACK = { ok: 'ตกลง', cancel: 'ยกเลิก', del: 'ลบ', confirmDeleteGeneric: 'ลบรายการนี้?', confirmDelete: 'ลบ{what}?' };
  function t(key, vars) {
    if (I18N) return I18N.t('shell.' + key, vars);
    var v = TH_FALLBACK[key] || '';
    return vars ? v.replace(/\{(\w+)\}/g, function (m, n) { return vars[n] != null ? vars[n] : m; }) : v;
  }
  function L(n) { return I18N ? I18N.label(n) : n.label; }
  /* ใส่ข้อความ + data-ome-t (ไม่ใช่ data-i18n — หน้าเดิมวน [data-i18n] ทั้งหน้าด้วยพจนานุกรมตัวเอง) ให้แปลใหม่ตอนสลับภาษา */
  function i18nText(el, key) { el.setAttribute('data-ome-t', 'shell.' + key); el.textContent = t(key); return el; }
  function i18nAttr(el, attr, key) {
    var cur = el.getAttribute('data-i18n-attr');
    el.setAttribute('data-i18n-attr', (cur ? cur + ',' : '') + attr + ':shell.' + key);
    el.setAttribute(attr, t(key));
    return el;
  }
  function icon(name, size) {
    return '<svg class="ome-icon" width="' + (size || 16) + '" height="' + (size || 16) + '" aria-hidden="true"><use href="' + BASE + 'icons.svg#i-' + name + '"/></svg>';
  }

  var ACCENTS = [
    { id: 'teal',     swatch: '#0F8475' },
    { id: 'blue',     swatch: '#2D6EE6' },
    { id: 'violet',   swatch: '#6A5AE0' },
    { id: 'orange',   swatch: '#C4500F' },
    { id: 'graphite', swatch: '#3F3F46' }
  ];
  var STYLES = [{ id: 'flat' }, { id: 'soft' }, { id: 'outline' }];
  var FONTS = [{ id: 'prompt' }, { id: 'ibmplex' }];
  function themeGet(kind) { return OT ? OT.get(kind) : (kind === 'theme' ? 'light' : ''); }
  function themeSet(kind, v) { if (OT) OT.set(kind, v); }
  function syncThemeBtn() {
    var btn = document.getElementById('omeThemeBtn');
    if (btn) btn.innerHTML = icon(themeGet('theme') === 'dark' ? 'sun' : 'moon');
  }
  if (OT) OT.onChange(syncThemeBtn);

  /* ── ภาษา UI: จุดกลางเดียวให้ทุกเครื่องมือที่รองรับ 2 ภาษาอ่าน/เขียนร่วมกัน ──────────
     เดิมแต่ละเครื่องมือ (cad/word/excel/doc-check ใช้ 'tanot:doclang' ร่วมกันอยู่แล้ว ส่วน
     music/sports/coding/cooking/typing/report-dashboard ใช้คนละคีย์แยกกัน) ทำให้สลับภาษา
     ที่เครื่องมือหนึ่งแล้วไปเปิดอีกเครื่องมือ ต้องกดสลับใหม่ทุกครั้ง — ย้ายมารวมเป็นคีย์เดียว
     ที่นี่ ('ome:lang') แต่ละไฟล์เครื่องมือ (ดู commit ที่แก้พร้อมกัน) ชี้ LANG_KEY ของตัวเอง
     มาที่คีย์นี้แทน และ expose window.omeApplyLang ไว้ให้จุดกลางนี้เรียกตอนสลับจากเมนูตั้งค่า
     (ปุ่มสลับภาษาเดิมของแต่ละหน้ายังใช้ได้ปกติ แค่เขียน/อ่านคีย์เดียวกันแล้ว) */
  /* ตั้งแต่งานแก้ธีม+ภาษารอบ 1: OME_LANG ย้ายไปอยู่ใน i18n.js (onChange หลาย listener + event 'ome:langchange'
     + ยังเรียก window.omeApplyLang ของหน้าเดิม) — ที่นี่เหลือตัวสำรองเผื่อหน้าที่ยังไม่โหลด i18n.js */
  function getUILangGlobal() {
    if (window.OME_LANG) return window.OME_LANG.get();
    try { return localStorage.getItem('ome:lang') === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; }
  }
  function setUILangGlobal(lang) {
    if (window.OME_LANG) { window.OME_LANG.set(lang); return; }
    try { localStorage.setItem('ome:lang', lang); } catch (e) {}
    if (typeof window.omeApplyLang === 'function') window.omeApplyLang();
  }
  if (!window.OME_LANG) window.OME_LANG = { get: getUILangGlobal, set: setUILangGlobal, onChange: function () { return function () {}; } };

  /* ── โครงสร้างเมนูทั้งเว็บ — จัดตาม 4 ด้านของชีวิต (ROADMAP 0d) ────────────
     ชั้นบนสุด = ด้าน (area: today/work/life/edu/hobby/settings) แต่ละด้านมี href ไปหน้า area.html?a=<area>
     key ไม่ซ้ำกัน, href = ลิงก์ไปหน้านั้น (ไม่ใส่ = เป็นแค่หมวดหมู่ให้กดขยาย), children = รายการย่อย
     label = ป้ายไทย, labelEn = ป้ายอังกฤษ (ทุกรายการต้องมี — OME_I18N.label() เลือกตามภาษา, palette ค้นได้ทั้งคู่)
     icon = ชื่อไอคอนใน icons.svg (ไม่ใส่ตัว "i-"), keywords = คำค้นไทย/อังกฤษ (ไว้ใช้กับ palette.js Phase 3),
     status = 'soon' สำหรับหน้าที่ยังไม่ทำ (ไม่ใส่ = พร้อมใช้) — อ่านโดย area.html และ tests/helpers.js */
  var MENU = [
    { key: 'home', area: 'today', label: 'วันนี้', labelEn: 'Today', icon: 'house', href: 'index.html', keywords: 'หน้าแรก home today วันนี้' },
    { key: 'work', area: 'work', label: 'งาน', labelEn: 'Work', icon: 'briefcase', href: 'area.html?a=work', keywords: 'งาน work ทำงาน', children: [
        { key: 'documents', label: 'เอกสาร', labelEn: 'Documents', icon: 'folder', children: [
            { key: 'word',         label: 'งาน Word', labelEn: 'Word', icon: 'file-text', href: 'word.html', keywords: 'word เอกสาร docx' },
            { key: 'excel',        label: 'งาน Excel', labelEn: 'Excel', icon: 'file-spreadsheet', href: 'excel.html', keywords: 'excel ตาราง xlsx' },
            { key: 'powerpoint',   label: 'งาน PowerPoint', labelEn: 'PowerPoint', icon: 'presentation', href: 'slides.html', keywords: 'powerpoint สไลด์ นำเสนอ pptx' },
            { key: 'extract-text', label: 'ดึงข้อความออกจากเอกสาร', labelEn: 'Extract text from documents', icon: 'copy', href: 'extract-text.html', keywords: 'ocr ดึงข้อความ pdf' },
            { key: 'doc-check',    label: 'ตรวจสอบเอกสาร', labelEn: 'Document check', icon: 'circle-check', href: 'doc-check.html', keywords: 'ตรวจเอกสาร สะกด ไวยากรณ์ proofread' },
            { key: 'data-compare', label: 'เปรียบเทียบข้อมูล', labelEn: 'Compare data', icon: 'arrow-up-down', href: 'compare.html', keywords: 'เปรียบเทียบ diff compare เทียบ ใบเสนอราคา ให้คะแนน จัดซื้อ' },
            { key: 'tts', label: 'แปลงเสียง ↔ ข้อความ', labelEn: 'Speech ↔ text', icon: 'mic', href: 'text-to-speech.html', keywords: 'เสียง ข้อความ tts asr whisper ถอดเสียง อ่านออกเสียง' }
          ]
        },
        { key: 'engineering', label: 'วิศวกรรม', labelEn: 'Engineering', icon: 'wrench', children: [
            { key: 'cad',         label: 'งานเขียนแบบ CAD (2D/3D)', labelEn: 'CAD drawing (2D/3D)', icon: 'box', href: 'cad.html', keywords: 'cad เขียนแบบ แบบ drawing' },
            { key: 'est-cost',    label: 'ประเมินราคา PM/CM', labelEn: 'PM/CM cost estimate', icon: 'calculator', href: 'run.html?tool=est-cost', keywords: 'ประเมินราคา ประมาณราคา pm cm boq' },
            { key: 'maintenance', label: 'บันทึกงานบำรุงรักษา', labelEn: 'Maintenance log', icon: 'clipboard-list', href: 'maintenance.html', keywords: 'บำรุงรักษา maintenance pm cm ใบสั่งงาน แจ้งซ่อม ตรวจเช็ก qr อุปกรณ์' },
            { key: 'electrical',  label: 'เครื่องคำนวณไฟฟ้า', labelEn: 'Electrical calculator', icon: 'zap', href: 'electrical.html', keywords: 'ไฟฟ้า คำนวณ electrical แรงดันตก voltage drop ขนาดสาย ลัดวงจร short circuit คาปาซิเตอร์ pf ฉนวน pi dar กราวด์ หลักดิน ground กับดักฟ้าผ่า arrester bil' }
          ]
        },
        { key: 'reports', label: 'ข้อมูล/รายงาน', labelEn: 'Data & reports', icon: 'chart-column', children: [
            { key: 'report-dashboard', label: 'นำเสนอรายงาน', labelEn: 'Report dashboard', icon: 'chart-pie', href: 'report-dashboard.html', keywords: 'รายงาน report dashboard' }
          ]
        },
        { key: 'legal', label: 'กฎหมาย', labelEn: 'Law', icon: 'scale', children: [
            { key: 'legal-plaint',        label: 'ร่างคำฟ้อง', labelEn: 'Draft a plaint', icon: 'scale', href: 'legal.html#plaint', keywords: 'คำฟ้อง กฎหมาย ฟ้อง' },
            { key: 'legal-answer',        label: 'ร่างคำให้การ', labelEn: 'Draft an answer', icon: 'scale', href: 'legal.html#answer', keywords: 'คำให้การ กฎหมาย' },
            { key: 'legal-petition',      label: 'ร่างคำขอ', labelEn: 'Draft a petition', icon: 'scale', href: 'legal.html#petition', keywords: 'คำขอ กฎหมาย' },
            { key: 'legal-statement',     label: 'ร่างคำแถลง', labelEn: 'Draft a statement', icon: 'scale', href: 'legal.html#statement', keywords: 'คำแถลง กฎหมาย' },
            { key: 'legal-counterclaim',  label: 'ร่างฟ้องแย้ง', labelEn: 'Draft a counterclaim', icon: 'scale', href: 'legal.html#counterclaim', keywords: 'ฟ้องแย้ง กฎหมาย' },
            { key: 'legal-prayer',        label: 'ร่างคำขอท้ายฟ้อง', labelEn: 'Draft a prayer for relief', icon: 'scale', href: 'legal.html#prayer', keywords: 'คำขอท้ายฟ้อง กฎหมาย' },
            { key: 'legal-police-report', label: 'ร่างเพื่อนำไปแจ้งความ', labelEn: 'Draft a police report', icon: 'scale', href: 'legal.html#police-report', keywords: 'แจ้งความ ตำรวจ กฎหมาย' }
          ]
        }
      ]
    },
    { key: 'life', area: 'life', label: 'ชีวิตประจำวัน', labelEn: 'Daily life', icon: 'wallet', href: 'area.html?a=life', keywords: 'ชีวิตประจำวัน life', children: [
        { key: 'money', label: 'การเงิน', labelEn: 'Money', icon: 'coins', children: [
            { key: 'finance',   label: 'รายรับรายจ่าย', labelEn: 'Income & expenses', icon: 'wallet', href: 'budget.html', keywords: 'รายรับ รายจ่าย งบ budget' },
            { key: 'tax',       label: 'การจ่ายภาษี', labelEn: 'Income tax', icon: 'landmark', href: 'tax.html', keywords: 'ภาษี tax ภาษีเงินได้ ลดหย่อน ภงด rmf ssf thaiesg ประกัน บำนาญ income tax deduction' },
            { key: 'insurance', label: 'ประกัน', labelEn: 'Insurance', icon: 'shield', href: 'insurance.html', keywords: 'ประกัน insurance กรมธรรม์ เบี้ยประกัน ต่ออายุ ลดหย่อน ประกันชีวิต ประกันสุขภาพ ประกันรถ ประกันบ้าน' },
            { key: 'invest', label: 'การลงทุน', labelEn: 'Investing', icon: 'trending-up', href: 'invest.html', keywords: 'ลงทุน invest หุ้น', children: [
                { key: 'stock',        label: 'หุ้น', labelEn: 'Stocks',              href: 'invest-stock.html#th', keywords: 'หุ้น stock set us หุ้นไทย หุ้นต่างประเทศ nasdaq',
                  tabs: [ { key: 'thai-stock', label: 'หุ้นไทย', labelEn: 'Thai stocks', hash: 'th', keywords: 'หุ้นไทย set' },
                          { key: 'global-stock', label: 'หุ้นต่างประเทศ', labelEn: 'Global stocks', hash: 'us', keywords: 'หุ้นนอก us nasdaq' },
                          { key: 'set50-scanner', label: 'สแกนเนอร์หุ้น', labelEn: 'Stock scanner', hash: 'scan', keywords: 'สแกน set50 scanner' },
                          { key: 'portfolio', label: 'พอร์ตจำลอง', labelEn: 'Paper portfolio', hash: 'paper', keywords: 'พอร์ตจำลอง ฝึกเทรด paper' } ] },
                { key: 'fund',         label: 'กองทุน', labelEn: 'Funds',            href: 'invest-fund.html#th', keywords: 'กองทุน fund rmf ssf thai esg dca s&p500 กองทุนไทย กองทุนต่างประเทศ nav',
                  tabs: [ { key: 'thai-fund', label: 'กองทุนไทย', labelEn: 'Thai funds', hash: 'th', keywords: 'กองทุนไทย rmf ssf thai esg ลดหย่อนภาษี' },
                          { key: 'global-fund', label: 'กองทุนต่างประเทศ', labelEn: 'Global funds', hash: 'global', keywords: 'กองทุนต่างประเทศ s&p500 สะสมมูลค่า ปันผล' } ] },
                { key: 'gold',         label: 'ทอง & สินค้าโภคภัณฑ์', labelEn: 'Gold & commodities', href: 'invest-gold.html#gold', keywords: 'ทอง gold ทองคำ ค่าเงิน วัตถุดิบ สินค้าโภคภัณฑ์ น้ำมัน commodities fx บาทดอลลาร์',
                  tabs: [ { key: 'gold-price', label: 'ทองคำ', labelEn: 'Gold', hash: 'gold', keywords: 'ทอง ทองคำ gold ราคาทอง ออมทอง' },
                          { key: 'commodities', label: 'ค่าเงิน & วัตถุดิบ', labelEn: 'FX & commodities', hash: 'markets', keywords: 'ค่าเงิน วัตถุดิบ น้ำมัน commodities fx ดอลลาร์' } ] },
                { key: 'bitcoin',      label: 'คริปโต (Bitcoin)', labelEn: 'Crypto (Bitcoin)', href: 'invest-bitcoin.html', keywords: 'bitcoin btc คริปโต crypto บิตคอยน์ กลัวโลภ' },
                { key: 'gov-bond',     label: 'พันธบัตรรัฐบาล', labelEn: 'Government bonds',   href: 'invest-gov-bond.html' },
                { key: 'lottery',      label: 'สลาก', labelEn: 'Lottery & savings bonds',              href: 'invest-lottery.html#gsb', keywords: 'สลาก lottery สลากออมสิน สลาก ธ.ก.ส. สลากกินแบ่ง ล็อตเตอรี่ หวย ตรวจหวย ค่าคาดหวัง',
                  tabs: [ { key: 'gsb-lottery', label: 'สลากออมสิน', labelEn: 'GSB savings lottery', hash: 'gsb', keywords: 'สลากออมสิน gsb ค่าคาดหวัง ev' },
                          { key: 'baac-lottery', label: 'สลาก ธ.ก.ส.', labelEn: 'BAAC savings lottery', hash: 'baac', keywords: 'สลาก ธ.ก.ส. baac ค่าคาดหวัง ev' },
                          { key: 'govt-lottery', label: 'สลากกินแบ่งรัฐบาล', labelEn: 'Government lottery', hash: 'govt', keywords: 'สลากกินแบ่ง หวย ตรวจหวย สุ่มเลข สถิติ' } ] },
                { key: 'journal',      label: 'สมุดเทรด', labelEn: 'Trade journal',          href: 'invest-trade-journal.html#all', keywords: 'สมุดเทรด journal เทรด สถิติ อัตราชนะ expectancy ผลเทรด' },
                { key: 'news',         label: 'ข่าวหุ้น', labelEn: 'Market news',          href: 'invest-news.html' },
                { key: 'business',     label: 'ลงทุนทำธุรกิจ', labelEn: 'Business plan',    href: 'invest-business.html' }
              ]
            }
          ]
        },
        { key: 'health',   label: 'สุขภาพ', labelEn: 'Health', icon: 'heart-pulse', href: 'health.html', keywords: 'สุขภาพ health น้ำหนัก ความดัน ชีพจร น้ำตาล รอบเอว ผลตรวจ แล็บ ยา อาหารเสริม เตือนกินยา วิตามิน' },
        { key: 'receipts', label: 'คลังใบเสร็จ/ประกันสินค้า', labelEn: 'Receipts & warranties', icon: 'receipt', href: 'receipts.html', keywords: 'ใบเสร็จ ประกันสินค้า warranty receipt คลังใบเสร็จ รับประกัน e-receipt ลดหย่อน บริจาค ocr' },
        { key: 'car', label: 'บันทึกรถ', labelEn: 'Car log', icon: 'car', href: 'car.html', keywords: 'รถ บันทึกรถ car พ.ร.บ. ภาษีรถ ประกันรถ ตรอ. ตรวจสภาพ เข้าศูนย์ เปลี่ยนน้ำมันเครื่อง ซ่อมบำรุง เลขไมล์ ทะเบียนรถ' }
      ]
    },
    { key: 'edu', area: 'edu', label: 'การศึกษา', labelEn: 'Education', icon: 'graduation-cap', href: 'area.html?a=edu', keywords: 'การศึกษา เรียน education', children: [
        { key: 'review', label: 'ทบทวนวันนี้', labelEn: 'Review today', icon: 'refresh-cw', href: 'review.html', keywords: 'ทบทวน flashcard review การ์ด xp วันติดต่อกัน streak เป้า' },
        { key: 'classroom', label: 'ห้องเรียน', labelEn: 'Classrooms', icon: 'graduation-cap', children: [
            { key: 'classroom-law',         label: 'เรียนกฎหมาย', labelEn: 'Law', icon: 'scale', href: 'classroom-law.html', keywords: 'เรียนกฎหมาย เนติ' },
            { key: 'classroom-business',    label: 'ธุรกิจ', labelEn: 'Business', icon: 'briefcase', href: 'classroom-business.html', keywords: 'เรียนธุรกิจ business' },
            { key: 'classroom-engineering', label: 'วิศวกรรม', labelEn: 'Engineering', icon: 'wrench', href: 'classroom-engineering.html', keywords: 'เรียนวิศวกรรม engineering' }
          ]
        },
        { key: 'language', label: 'ภาษา', labelEn: 'Languages', icon: 'languages', href: 'languages.html', keywords: 'ภาษา language อังกฤษ จีน ญี่ปุ่น' },
        { key: 'books',    label: 'หนังสือ', labelEn: 'Books', icon: 'book-open', href: 'books.html', keywords: 'หนังสือ book อ่าน ชั้นหนังสือ ไฮไลต์ open library' }
      ]
    },
    { key: 'hobby', area: 'hobby', label: 'งานอดิเรก/ทักษะ', labelEn: 'Hobbies & skills', icon: 'music', href: 'area.html?a=hobby', keywords: 'งานอดิเรก ทักษะ hobby', children: [
        { key: 'music',  label: 'เรียนดนตรี', labelEn: 'Music', icon: 'music', href: 'music.html', keywords: 'ดนตรี music' },
        { key: 'sports', label: 'เรียนกีฬา', labelEn: 'Sports', icon: 'dumbbell', href: 'sports.html', keywords: 'กีฬา sports' },
        { key: 'cooking', label: 'เรียนทำอาหาร', labelEn: 'Cooking', icon: 'chef-hat', href: 'cooking.html', keywords: 'ทำอาหาร cooking' },
        { key: 'coding', label: 'การเขียนโค้ด', labelEn: 'Coding', icon: 'code', href: 'coding.html', keywords: 'โค้ด code programming' },
        { key: 'image-gen', label: 'สร้างภาพ', labelEn: 'Image generator', icon: 'image', href: 'image-gen.html', keywords: 'ภาพ รูป ai image generate พื้นหลัง ไอคอน' },
        { key: 'typing', label: 'สอนพิมพ์', labelEn: 'Typing', icon: 'keyboard', href: 'typing.html', keywords: 'พิมพ์ดีด typing' },
        { key: 'games',  label: 'เกมที่เล่น', labelEn: 'Games', icon: 'gamepad-2', href: soonHref('เกมที่เล่น'), status: 'soon', keywords: 'เกม game' },
        { key: '3d-sim', label: 'จำลอง 3D', labelEn: '3D simulation', icon: 'box', children: [
            { key: '3d-objects', label: 'จำลองสิ่งของ', labelEn: 'Object simulator', icon: 'box', href: 'sim-objects.html', keywords: '3d จำลอง สิ่งของ three' },
            { key: '3d-people',  label: 'จำลองคน', labelEn: 'People simulator', icon: 'user', href: soonHref('จำลองคน 3D'), status: 'soon', keywords: '3d คน' }
          ]
        }
      ]
    },
    { key: 'settings', area: 'settings', label: 'ตั้งค่า/ข้อมูล', labelEn: 'Settings & data', icon: 'settings', href: 'area.html?a=settings', keywords: 'ตั้งค่า ข้อมูล settings', children: [
        { key: 'data', label: 'ข้อมูลและการซิงก์', labelEn: 'Data & sync', icon: 'refresh-cw', href: 'data.html', keywords: 'ซิงก์ สำรอง backup restore sync ข้อมูล drive' },
        { key: 'notifications', label: 'การแจ้งเตือน', labelEn: 'Notifications', icon: 'bell', href: 'notifications.html', keywords: 'แจ้งเตือน เตือน notification push reminder' },
        { key: 'migrate', label: 'ย้ายข้อมูลจาก github.io', labelEn: 'Move data from github.io', icon: 'download', href: 'migrate.html', keywords: 'ย้ายข้อมูล migrate github import' },
        { key: 'credits', label: 'เครดิต & ลิขสิทธิ์', labelEn: 'Credits & licenses', icon: 'info', href: 'credits.html', keywords: 'เครดิต ลิขสิทธิ์ credits license' }
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
      if (nodeMatches(n)) { path.push(n); return true; }
      if (n.children && findActivePath(n.children, path)) { path.push(n); return true; }
    }
    return false;
  }
  var activePath = [];
  findActivePath(MENU, activePath); // เรียงจากลึกสุด -> บนสุด

  function renderMenuNodes(nodes, container, depth) {
    nodes.forEach(function (n) {
      var isActive = nodeMatches(n);
      var isAncestorOfActive = activePath.indexOf(n) !== -1 && !isActive;
      var row = document.createElement('div');
      row.className = 'ome-menu-row';

      if (n.href) {
        var a = document.createElement('a');
        a.className = 'ome-menu-link' + (isActive ? ' active' : '');
        a.href = BASE + n.href;
        a.innerHTML = (n.icon ? '<svg class="ome-icon ome-menu-ic" aria-hidden="true"><use href="' + BASE + 'icons.svg#i-' + n.icon + '"/></svg>' : '') + '<span></span>';
        a.lastChild.textContent = L(n);
        row.appendChild(a);
      } else {
        var cat = document.createElement('div');
        cat.className = 'ome-menu-cat';
        cat.textContent = L(n);
        row.appendChild(cat);
      }

      var childrenWrap = null;
      if (n.children && n.children.length) {
        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'ome-menu-toggle';
        toggle.setAttribute('aria-label', t('expand', { label: L(n) }));
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = icon('chevron-right', 14);
        row.appendChild(toggle);

        childrenWrap = document.createElement('div');
        childrenWrap.className = 'ome-menu-children';
        renderMenuNodes(n.children, childrenWrap, depth + 1);

        var startOpen = isAncestorOfActive;
        if (startOpen) { toggle.classList.add('open'); childrenWrap.classList.add('open'); toggle.setAttribute('aria-expanded', 'true'); }

        toggle.addEventListener('click', function () {
          var open = childrenWrap.classList.toggle('open');
          toggle.classList.toggle('open', open);
          toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
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
    i18nAttr(nav, 'aria-label', 'mainNav');

    var hamburger = document.createElement('button');
    hamburger.type = 'button';
    hamburger.className = 'ome-hamburger';
    i18nAttr(hamburger, 'aria-label', 'openMenu');
    hamburger.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
    nav.appendChild(hamburger);

    var logo = document.createElement('a');
    logo.className = 'ome-nav-logo';
    logo.href = BASE + 'index.html';
    logo.setAttribute('aria-label', 'Tanot'); // บนจอแคบซ่อนข้อความ — ชื่อลิงก์ต้องไม่หายไป · ตัว T ในกรอบเป็นโลโก้ตกแต่ง
    logo.innerHTML = '<span class="dot" aria-hidden="true">T</span><span class="txt">Tanot</span>';
    nav.appendChild(logo);

    var right = document.createElement('div');
    right.className = 'ome-nav-right';
    var searchBtn = document.createElement('button');
    searchBtn.id = 'omeSearchBtn';
    searchBtn.type = 'button';
    searchBtn.className = 'ome-theme-btn';
    i18nAttr(searchBtn, 'aria-label', 'search');
    searchBtn.setAttribute('aria-haspopup', 'dialog');
    searchBtn.innerHTML = '<svg class="ome-icon" width="16" height="16" aria-hidden="true"><use href="' + BASE + 'icons.svg#i-search"/></svg>';
    searchBtn.addEventListener('click', function () { openPalette(); });
    right.appendChild(searchBtn);
    var themeBtn = document.createElement('button');
    themeBtn.id = 'omeThemeBtn';
    themeBtn.className = 'ome-theme-btn';
    themeBtn.type = 'button';
    i18nAttr(themeBtn, 'aria-label', 'themeToggle');
    themeBtn.innerHTML = icon(themeGet('theme') === 'dark' ? 'sun' : 'moon');
    themeBtn.addEventListener('click', function () {
      themeSet('theme', document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
    right.appendChild(themeBtn);

    var gearBtn = document.createElement('button');
    gearBtn.id = 'omeGearBtn';
    gearBtn.className = 'ome-theme-btn';
    gearBtn.type = 'button';
    i18nAttr(gearBtn, 'aria-label', 'settings');
    gearBtn.setAttribute('aria-haspopup', 'true');
    gearBtn.setAttribute('aria-expanded', 'false');
    gearBtn.innerHTML = icon('settings');
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
    themeRow.appendChild(i18nText(document.createElement('span'), 'accent'));
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
      sw.innerHTML = '<span class="dot" style="background:' + ac.swatch + '"></span>';
      sw.appendChild(i18nText(document.createElement('span'), 'accent.' + ac.id));
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
    styleRow.appendChild(i18nText(document.createElement('span'), 'style'));
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
      sw.appendChild(i18nText(document.createElement('span'), 'style.' + st.id));
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
    langRow.appendChild(i18nText(document.createElement('span'), 'lang'));
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
    fontRow.appendChild(i18nText(document.createElement('span'), 'font'));
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
      var fl = i18nText(document.createElement('span'), 'font.' + f.id);
      fl.style.fontFamily = OT ? OT.fonts[f.id].family : 'inherit';
      sw.appendChild(fl);
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

    /* แถว "ความเข้มภาพพื้นหลัง" — 4 ระดับ ปิด/อ่อน/กลาง(ค่าเริ่มต้น)/ชัด เก็บที่ OmeTheme ('ome:bg') แบบเดียวกับค่าธีมอื่น
       (theme-boot.js ตั้ง html[data-bg-level] ให้ theme.css คุม scrim/ฟิลเตอร์ของภาพ) */
    var bgRow = document.createElement('button');
    bgRow.type = 'button';
    bgRow.className = 'ome-settings-row';
    bgRow.appendChild(i18nText(document.createElement('span'), 'bg'));
    settingsPanel.appendChild(bgRow);

    var bgWrap = document.createElement('div');
    bgWrap.className = 'ome-theme-swatches';
    function markBg() {
      var cur = themeGet('bg');
      var nodes = bgWrap.querySelectorAll('.ome-theme-swatch');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].classList.toggle('sel', nodes[i].getAttribute('data-bg-id') === cur);
      }
    }
    (OT && OT.bgLevels ? OT.bgLevels : ['off', 'soft', 'mid', 'strong']).forEach(function (lv) {
      var sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'ome-theme-swatch';
      sw.setAttribute('data-bg-id', lv);
      sw.appendChild(i18nText(document.createElement('span'), 'bg.' + lv));
      sw.addEventListener('click', function () { themeSet('bg', lv); markBg(); });
      bgWrap.appendChild(sw);
    });
    markBg();
    bgRow.addEventListener('click', function () { bgWrap.classList.toggle('open'); });
    settingsPanel.appendChild(bgWrap);

    var SETTINGS_ROWS = [
      { key: 'clearData' },
      { key: 'help', divider: true }
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
      row.appendChild(i18nText(document.createElement('span'), r.key));
      settingsPanel.appendChild(row);
    });
    document.body.appendChild(settingsPanel);

    function closeSettings() { settingsPanel.classList.remove('open'); gearBtn.setAttribute('aria-expanded', 'false'); }
    gearBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      gearBtn.setAttribute('aria-expanded', settingsPanel.classList.toggle('open') ? 'true' : 'false');
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
    i18nAttr(drawer, 'aria-label', 'menu');

    var head = document.createElement('div');
    head.className = 'ome-drawer-head';
    head.innerHTML = '<a class="brand" href="' + BASE + 'index.html"><span class="dot">T</span><span>Tanot</span></a>';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ome-drawer-close';
    i18nAttr(closeBtn, 'aria-label', 'closeMenu');
    closeBtn.innerHTML = icon('x', 18);
    head.appendChild(closeBtn);
    drawer.appendChild(head);

    var menu = document.createElement('div');
    menu.className = 'ome-menu';
    renderMenuNodes(MENU, menu, 0);
    drawer.appendChild(menu);
    /* สลับภาษา: ข้อความที่มี data-ome-t/data-i18n-attr แปลเองผ่าน OME_I18N.apply — เมนูวาดใหม่ทั้งชุด (คงกลุ่มที่กางไว้) */
    if (window.OME_LANG && window.OME_LANG.onChange) window.OME_LANG.onChange(function () {
      var open = [];
      menu.querySelectorAll('.ome-menu-children').forEach(function (c, i) { if (c.classList.contains('open')) open.push(i); });
      menu.innerHTML = '';
      renderMenuNodes(MENU, menu, 0);
      var kids = menu.querySelectorAll('.ome-menu-children');
      open.forEach(function (i) {
        if (!kids[i]) return;
        kids[i].classList.add('open');
        var tg = kids[i].previousElementSibling && kids[i].previousElementSibling.querySelector('.ome-menu-toggle');
        if (tg) { tg.classList.add('open'); tg.setAttribute('aria-expanded', 'true'); }
      });
      markSelectedLang();
    });

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
    i18nText(a, 'credits');
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
     ใช้ <dialog class="dialog"> + showModal() (คอมโพเนนต์กลางใน theme.css) แทนกล่องของระบบปฏิบัติการ
     ที่แต่งด้วย CSS ไม่ได้ — Esc / คลิกนอกกล่อง = ยกเลิก (คืน false) ทุกหน้าเรียกผ่าน
     window.tanotConfirm(msg, opts) / window.tanotAlert(msg) ได้เลย ทั้งคู่คืน Promise
     หน้าที่ไม่มี data-layout (สไตล์ของ .dialog/.btn ยังไม่มี) ถอยไปใช้กล่องของเบราว์เซอร์ ══ */
  var nativeConfirm = window.confirm && window.confirm.bind(window);
  var nativeAlert = window.alert && window.alert.bind(window);
  function tanotModal(msg, buttons) {
    return new Promise(function (resolve) {
      if (!document.body.hasAttribute('data-layout') || typeof HTMLDialogElement === 'undefined') {
        if (buttons.length > 1) resolve(nativeConfirm ? nativeConfirm(msg) : true);
        else { if (nativeAlert) nativeAlert(msg); resolve(true); }
        return;
      }
      var dlg = document.createElement('dialog');
      dlg.className = 'dialog';
      dlg.setAttribute('aria-modal', 'true');
      var body = document.createElement('div');
      body.className = 'dialog-body';
      var p = document.createElement('p');
      p.className = 'dialog-msg';
      p.textContent = msg;
      body.appendChild(p);
      var foot = document.createElement('div');
      foot.className = 'dialog-foot';
      var result = false;
      buttons.forEach(function (b) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn' + (b.cls ? ' ' + b.cls : '');
        btn.textContent = b.label;
        btn.addEventListener('click', function () { result = b.value; dlg.close(); });
        foot.appendChild(btn);
      });
      dlg.appendChild(body);
      dlg.appendChild(foot);
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener('close', function () {
        if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
        resolve(result);
      });
      document.body.appendChild(dlg);
      dlg.showModal();
      if (foot.lastChild) foot.lastChild.focus();
    });
  }
  window.tanotConfirm = function (msg, opts) {
    opts = opts || {};
    return tanotModal(msg, [
      { label: opts.cancelLabel || t('cancel'), value: false },
      { label: opts.okLabel || t('ok'), value: true, cls: opts.danger ? 'danger' : 'primary' }
    ]);
  };
  window.tanotAlert = function (msg, opts) {
    opts = opts || {};
    return tanotModal(msg, [{ label: opts.okLabel || t('ok'), value: true, cls: 'primary' }]);
  };
  /* ยืนยันการลบกลาง — what = ชื่อสิ่งที่จะลบ (ข้อความตามภาษาของผู้เรียก) ไม่ใส่ = "ลบรายการนี้?" */
  window.tanotConfirmDelete = function (what, opts) {
    opts = opts || {};
    return window.tanotConfirm(opts.message || (what ? t('confirmDelete', { what: what }) : t('confirmDeleteGeneric')),
      { danger: true, okLabel: opts.okLabel || t('del'), cancelLabel: opts.cancelLabel });
  };
  /* toast กลาง — <div class="toast-region"> + .toast ของ theme.css (kind: 'ok' | 'err') · ข้อความตามภาษาของผู้เรียก */
  var toastTimer = 0;
  window.tanotToast = function (msg, opts) {
    opts = typeof opts === 'string' ? { kind: opts } : (opts || {});
    var region = document.querySelector('.toast-region');
    if (!region) {
      region = document.createElement('div');
      region.className = 'toast-region';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    region.innerHTML = '';
    var el = document.createElement('div');
    el.className = 'toast' + (opts.kind === 'ok' || opts.kind === 'err' ? ' ' + opts.kind : '');
    if (opts.kind === 'ok' || opts.kind === 'err') el.innerHTML = icon(opts.kind === 'ok' ? 'circle-check' : 'circle-alert');
    var span = document.createElement('span');
    span.textContent = msg;
    el.appendChild(span);
    region.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, opts.kind === 'err' ? 4200 : 2600);
    return el;
  };

  /* ── แตะนอกกล่อง (พื้น ::backdrop) ปิด <dialog class="dialog"> ทุกใบ (รอบ 9, กฎมือถือ) ──
     ต้องกดลงและปล่อยที่ตัว <dialog> เอง (ลากเลือกข้อความจากในกล่องออกไปนอกกล่องไม่ปิด) · ผ่าน event 'cancel' เหมือน Esc
     (หน้าที่ preventDefault ไว้ก็ยังกันได้) · dialog ที่กำลังทำงานค้าง/ห้ามปิดโดยไม่ตั้งใจใส่ data-keep-open
     กล่องที่ผู้ใช้เริ่มพิมพ์/เลือกค่าแล้ว (มี input/change ตั้งแต่เปิด) ไม่ปิดด้วยการแตะนอกกล่อง — กันข้อมูลที่กรอกหายเพราะแตะพลาด
     ต้องกดปุ่มปิด/ยกเลิก/Esc เอง · สถานะนี้ล้างเมื่อกล่องปิด (event 'close' ไม่ bubble จึงฟังแบบ capture) */
  var dialogDown = null, dirtyDialogs = new WeakSet();
  function markDirty(e) { var d = e.target && e.target.closest && e.target.closest('dialog'); if (d) dirtyDialogs.add(d); }
  document.addEventListener('input', markDirty, true);
  document.addEventListener('change', markDirty, true);
  document.addEventListener('close', function (e) { if (e.target && e.target.tagName === 'DIALOG') dirtyDialogs.delete(e.target); }, true);
  document.addEventListener('pointerdown', function (e) { dialogDown = e.target && e.target.tagName === 'DIALOG' ? e.target : null; }, true);
  document.addEventListener('click', function (e) {
    var d = e.target;
    if (!d || d.tagName !== 'DIALOG' || d !== dialogDown || !d.open || !d.classList.contains('dialog') || d.hasAttribute('data-keep-open') || dirtyDialogs.has(d)) return;
    var r = d.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return; // แตะที่ขอบ/ช่องว่างในกล่องเอง
    if (d.dispatchEvent(new Event('cancel', { cancelable: true }))) d.close();
  }, true);

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

  /* ── จำว่าเปิดหน้าไหนล่าสุดเมื่อไร (local, ไม่ซิงก์ — registry: tanot:nav:last) — ใช้กับ "เรียนต่อ" บนหน้าแรกและแถว "ใช้ล่าสุด" ของหน้าหมวด
     บันทึกเฉพาะหน้าที่อยู่ใน MENU (ไม่นับ index/area/soon/404 และโหมดฝังป๊อปอัพ) · คีย์ = ชื่อไฟล์หน้า ไม่รวม hash/query */
  function recordOpen() {
    if (isEmbedded()) return;
    try {
      var page = /\.[a-z]+$/i.test(HERE) ? HERE : HERE + '.html'; // Cloudflare Pages ตัด .html ออกจาก URL (x.html → /x)
      var known = false;
      (function walk(nodes) {
        nodes.forEach(function (n) {
          if (n.href && n.href.split('#')[0].split('?')[0] === page && !/^(index|area|soon)\.html$/.test(page)) known = true;
          if (n.children) walk(n.children);
        });
      })(MENU);
      if (!known) return;
      var m = JSON.parse(localStorage.getItem('tanot:nav:last') || 'null');
      if (!m || typeof m !== 'object' || Array.isArray(m)) m = {};
      m[page] = Date.now();
      localStorage.setItem('tanot:nav:last', JSON.stringify(m));
    } catch (e) {}
  }

  function initShellChrome() {
    recordOpen();
    if (!isEmbedded()) { buildNav(); buildFooter(); } /* ในป๊อปอัพ ไม่ต้องมีแถบนำทาง/เมนูลิ้นชัก/ฟุตเตอร์ซ้ำ */
    registerSW();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShellChrome);
  } else {
    initShellChrome();
  }
})();
