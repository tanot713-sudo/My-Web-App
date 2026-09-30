/* theme-preview.js — หน้าตัวอย่างธีม v2: เลือกฟอนต์/สีเน้น/พื้นผิว/โหมด (บันทึกเป็นค่าทั้งเว็บผ่าน OmeTheme) */
(function () {
  var T = window.OmeTheme;
  var ACCENT_SWATCH = { teal: '#12A594', blue: '#3D7CF4', violet: '#7C6FEA', orange: '#E8743B', graphite: '#3F3F46' };
  var ACCENT_LABEL = { teal: 'เขียวน้ำทะเล', blue: 'น้ำเงิน', violet: 'ม่วง', orange: 'ส้ม', graphite: 'เทาเข้ม' };
  var ICONS = ['house', 'wallet', 'trending-up', 'chart-line', 'file-text', 'file-spreadsheet', 'graduation-cap',
    'book-open', 'scale', 'languages', 'heart-pulse', 'music', 'dumbbell', 'chef-hat', 'code', 'keyboard',
    'gamepad-2', 'box', 'mic', 'calendar', 'bell', 'search', 'settings', 'cloud', 'calculator', 'receipt'];

  var accentRow = document.getElementById('tpAccent');
  T.accents.forEach(function (id) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('data-v', id);
    b.innerHTML = '<span class="tp-swatch" style="background:' + ACCENT_SWATCH[id] + '"></span>' + ACCENT_LABEL[id];
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
    t.innerHTML = '<svg class="ome-icon"><use href="icons.svg#i-circle-check"/></svg>บันทึกแล้ว';
    document.getElementById('tpToasts').appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  });
  var dlg = document.getElementById('tpDialog');
  document.getElementById('tpDialogBtn').addEventListener('click', function () { dlg.showModal(); });
  dlg.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close') || e.target === dlg) dlg.close(); });
})();
