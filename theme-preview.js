/* theme-preview.js — หน้าตัวอย่างธีม v2: เลือกฟอนต์/สีเน้น/พื้นผิว/โหมด (บันทึกเป็นค่าทั้งเว็บผ่าน OmeTheme) */
(function () {
  var T = window.OmeTheme;
  var tp = OME_I18N.scope('tp', {
    th: { title: 'ตัวอย่างธีม', light: 'สว่าง', dark: 'มืด', flat: 'เรียบ', soft: 'นุ่ม', outline: 'เส้นขอบ', mode: 'โหมด', font: 'ฟอนต์', accent: 'สีเน้น', style: 'พื้นผิว', kIncome: 'รายรับ', kExpense: 'รายจ่าย', kSaving: 'เงินออม', kCards: 'การ์ดที่ต้องทบทวน', kSavingSub: '56% ของรายรับ', kStreak: 'วันติดกัน 12 วัน', tabBtn: 'ปุ่ม', tabForm: 'ฟอร์ม', tabTable: 'ตาราง', add: 'เพิ่มรายการ', export: 'ส่งออก', delete: 'ลบ', skip: 'ข้าม', disabled: 'ปิดใช้งาน', small: 'เล็ก', medium: 'กลาง', large: 'ใหญ่', edit: 'แก้ไข', search: 'ค้นหา', settings: 'ตั้งค่า', all: 'ทั้งหมด', food: 'อาหาร', travel: 'เดินทาง', draft: 'ร่าง', info: 'ข้อมูล', error: 'ผิดพลาด', fItem: 'รายการ', fAmount: 'จำนวนเงิน', fCat: 'หมวด', fDate: 'วันที่', fNote: 'บันทึก', phCoffee: 'ค่ากาแฟ', oFood: 'อาหาร', oTravel: 'เดินทาง', oHome: 'บ้าน', badDate: 'วันที่ไม่ถูกต้อง', cDate: 'วันที่', cItem: 'รายการ', cCat: 'หมวด', cAmount: 'จำนวนเงิน', empty: 'ยังไม่มีไฟล์', showToast: 'แสดง toast', showDialog: 'เปิด dialog', dlgTitle: 'ลบรายการนี้?', dlgBody: 'ค่าไฟฟ้า 1,284.50 บาท', cancel: 'ยกเลิก', saved: 'บันทึกแล้ว', pageTitle: 'ตัวอย่างธีม — Tanot', aTeal: 'เขียวน้ำทะเล', aBlue: 'น้ำเงิน', aViolet: 'ม่วง', aOrange: 'ส้ม', aGraphite: 'เทาเข้ม' },
    en: { title: 'Theme preview', light: 'Light', dark: 'Dark', flat: 'Flat', soft: 'Soft', outline: 'Outline', mode: 'Mode', font: 'Font', accent: 'Accent colour', style: 'Surface', kIncome: 'Income', kExpense: 'Expenses', kSaving: 'Savings', kCards: 'Cards to review', kSavingSub: '56% of income', kStreak: '12-day streak', tabBtn: 'Buttons', tabForm: 'Form', tabTable: 'Table', add: 'Add item', export: 'Export', delete: 'Delete', skip: 'Skip', disabled: 'Disabled', small: 'Small', medium: 'Medium', large: 'Large', edit: 'Edit', search: 'Search', settings: 'Settings', all: 'All', food: 'Food', travel: 'Travel', draft: 'Draft', info: 'Info', error: 'Error', fItem: 'Item', fAmount: 'Amount', fCat: 'Category', fDate: 'Date', fNote: 'Note', phCoffee: 'Coffee', oFood: 'Food', oTravel: 'Travel', oHome: 'Home', badDate: 'Invalid date', cDate: 'Date', cItem: 'Item', cCat: 'Category', cAmount: 'Amount', empty: 'No files yet', showToast: 'Show toast', showDialog: 'Open dialog', dlgTitle: 'Delete this item?', dlgBody: 'Electricity bill, 1,284.50 baht', cancel: 'Cancel', saved: 'Saved', pageTitle: 'Theme preview — Tanot', aTeal: 'Teal', aBlue: 'Blue', aViolet: 'Violet', aOrange: 'Orange', aGraphite: 'Graphite' }
  });
  var ACCENT_SWATCH = { teal: '#0F8475', blue: '#2D6EE6', violet: '#6A5AE0', orange: '#C4500F', graphite: '#3F3F46' };
  var ACCENT_KEY = { teal: 'aTeal', blue: 'aBlue', violet: 'aViolet', orange: 'aOrange', graphite: 'aGraphite' };
  var ICONS = ['house', 'wallet', 'trending-up', 'chart-line', 'file-text', 'file-spreadsheet', 'graduation-cap',
    'book-open', 'scale', 'languages', 'heart-pulse', 'music', 'dumbbell', 'chef-hat', 'code', 'keyboard',
    'gamepad-2', 'box', 'mic', 'calendar', 'bell', 'search', 'settings', 'cloud', 'calculator', 'receipt'];

  var accentRow = document.getElementById('tpAccent');
  T.accents.forEach(function (id) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('data-v', id);
    b.innerHTML = '<span class="tp-swatch" style="background:' + ACCENT_SWATCH[id] + '"></span><span data-i18n="tp.' + ACCENT_KEY[id] + '"></span>';
    accentRow.appendChild(b);
  });

  var groups = [
    { el: document.getElementById('tpTheme'), kind: 'theme' },
    { el: document.getElementById('tpFont'), kind: 'font' },
    { el: accentRow, kind: 'accent' },
    { el: document.getElementById('tpStyle'), kind: 'style' }
  ];
  function sync() {
    groups.forEach(function (g) {
      var cur = T.get(g.kind);
      var btns = g.el.querySelectorAll('button[data-v]');
      for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-v') === cur ? 'true' : 'false');
    });
  }
  groups.forEach(function (g) {
    g.el.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]');
      if (b) T.set(g.kind, b.getAttribute('data-v'));
    });
  });
  T.onChange(sync);
  sync();

  OME_I18N.apply(document);
  document.title = tp('pageTitle');
  window.OME_PAGE_LIVE_LANG = true;
  OME_LANG.onChange(function () { document.title = tp('pageTitle'); });

  var tabs = document.querySelectorAll('#tpTabs .tab');
  var panels = document.querySelectorAll('[data-panel]');
  Array.prototype.forEach.call(tabs, function (tab, i) {
    tab.addEventListener('click', function () {
      for (var j = 0; j < tabs.length; j++) {
        tabs[j].setAttribute('aria-selected', j === i ? 'true' : 'false');
        panels[j].hidden = j !== i;
      }
    });
  });

  document.getElementById('tpIcons').innerHTML = ICONS.map(function (n) {
    return '<svg class="ome-icon" role="img" aria-label="' + n + '"><use href="icons.svg#i-' + n + '"/></svg>';
  }).join('');

  document.getElementById('tpToastBtn').addEventListener('click', function () {
    var t = document.createElement('div');
    t.className = 'toast ok';
    t.innerHTML = '<svg class="ome-icon"><use href="icons.svg#i-circle-check"/></svg>' + tp('saved');
    document.getElementById('tpToasts').appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  });
  var dlg = document.getElementById('tpDialog');
  document.getElementById('tpDialogBtn').addEventListener('click', function () { dlg.showModal(); });
  dlg.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close') || e.target === dlg) dlg.close(); });
})();
