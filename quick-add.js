/* ══════════════════════════════════════════════════════════════════
   Tanot quick-add — กล่องเพิ่มรายจ่าย/รายรับด่วน (ROADMAP Phase 3) เรียกได้จากทุกหน้า: OmeQuickAdd.open({ type: 'expense' | 'income' })
   เขียนลง localStorage 'budget:records' รูปแบบเดียวกับ budget.html (id/date/type/categoryId/amount/note) ผ่าน setItem ตัวจริง
   → tanot-data.js ดักจับแล้วซิงก์ให้เหมือนบันทึกจากหน้ารายรับรายจ่ายเอง; เสร็จแล้วยิง event 'tanot:quickadd' ให้หน้าที่แสดงยอดวาดใหม่
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.OmeQuickAdd) return;

  var REC_KEY = 'budget:records', CAT_KEY = 'budget:categories';
  // ใช้เมื่อยังไม่เคยเปิด budget.html (หน้านั้นสร้างหมวดเริ่มต้นตอนเปิดครั้งแรก) — id/ชื่อต้องตรงกับ DEFAULT_CATEGORIES ใน budget.html
  var FALLBACK_CATS = [
    { id: 'cat-salary', name: 'เงินเดือน', type: 'income' },
    { id: 'cat-other-income', name: 'รายได้อื่นๆ', type: 'income' },
    { id: 'cat-rice', name: 'ค่าข้าว', type: 'expense' },
    { id: 'cat-fuel', name: 'เติมน้ำมัน', type: 'expense' },
    { id: 'cat-personal', name: 'ซื้อของใช้ส่วนตัว', type: 'expense' },
    { id: 'cat-shopping', name: 'Shopping', type: 'expense' }
  ];

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function readJSON(k, dflt) {
    if (window.TanotData && window.TanotData.read) return window.TanotData.read(k, dflt);
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? dflt : v; } catch (e) { return dflt; }
  }
  function todayYMD() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function fmtMoney(n) { return '฿' + (Math.round(n * 100) / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 }); }

  var root = null, type = 'expense', prevFocus = null, isOpen = false, toastTimer = 0;

  function categories() {
    var c = readJSON(CAT_KEY, null);
    return Array.isArray(c) && c.length ? c : FALLBACK_CATS;
  }
  function fillCategories() {
    var sel = root.querySelector('[name=cat]');
    var list = categories().filter(function (c) { return c.type === type; });
    sel.innerHTML = list.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('');
  }
  function setType(t) {
    type = t;
    var btns = root.querySelectorAll('[data-type]');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-type') === t;
      btns[i].classList.toggle('on', on);
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    root.querySelector('.ome-qa-title').textContent = t === 'income' ? 'เพิ่มรายรับ' : 'เพิ่มรายจ่าย';
    fillCategories();
  }

  function build() {
    root = document.createElement('div');
    root.className = 'ome-qa';
    root.hidden = true;
    root.innerHTML =
      '<form class="ome-qa-box" role="dialog" aria-modal="true" aria-labelledby="omeQaTitle" novalidate>' +
      '<div class="ome-qa-head"><h2 class="ome-qa-title" id="omeQaTitle">เพิ่มรายจ่าย</h2>' +
      '<button type="button" class="ome-qa-x" data-close aria-label="ปิด">✕</button></div>' +
      '<div class="ome-qa-seg" role="group" aria-label="ประเภท">' +
      '<button type="button" data-type="expense" aria-pressed="true">รายจ่าย</button>' +
      '<button type="button" data-type="income" aria-pressed="false">รายรับ</button></div>' +
      '<label class="ome-qa-f"><span>จำนวนเงิน (บาท)</span><input name="amt" type="number" inputmode="decimal" min="0" step="any" required></label>' +
      '<label class="ome-qa-f"><span>หมวดหมู่</span><select name="cat"></select></label>' +
      '<div class="ome-qa-row"><label class="ome-qa-f"><span>วันที่</span><input name="date" type="date" required></label>' +
      '<label class="ome-qa-f"><span>บันทึก</span><input name="note" type="text" maxlength="200" autocomplete="off"></label></div>' +
      '<p class="ome-qa-err" role="alert" hidden></p>' +
      '<div class="ome-qa-foot"><button type="button" data-close>ยกเลิก</button><button type="submit" class="primary">บันทึก</button></div></form>';
    document.body.appendChild(root);

    root.addEventListener('mousedown', function (e) { if (e.target === root) { e.preventDefault(); close(); } });
    root.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-type],[data-close]');
      if (!t) return;
      if (t.hasAttribute('data-close')) close(); else setType(t.getAttribute('data-type'));
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = root.querySelectorAll('button:not([disabled]),input,select');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    root.querySelector('form').addEventListener('submit', onSubmit);
  }

  function showErr(msg) {
    var p = root.querySelector('.ome-qa-err');
    p.textContent = msg; p.hidden = !msg;
  }

  function onSubmit(e) {
    e.preventDefault();
    var f = e.target;
    var amt = parseFloat(f.amt.value);
    if (!(amt > 0)) { showErr('กรอกจำนวนเงินมากกว่า 0'); f.amt.focus(); return; }
    if (!f.cat.value) { showErr('ยังไม่มีหมวดหมู่ประเภทนี้ — เพิ่มที่หน้ารายรับรายจ่ายก่อน'); return; }
    var rec = { id: uid(), date: f.date.value || todayYMD(), type: type, categoryId: f.cat.value, amount: amt, note: f.note.value.trim() };
    var records = readJSON(REC_KEY, []);
    if (!Array.isArray(records)) records = [];
    records.push(rec);
    try { localStorage.setItem(REC_KEY, JSON.stringify(records)); }
    catch (err) { showErr('บันทึกไม่สำเร็จ (พื้นที่จัดเก็บเต็มหรือถูกปิด)'); return; }
    close();
    toast((type === 'income' ? 'บันทึกรายรับ ' : 'บันทึกรายจ่าย ') + fmtMoney(amt) + ' แล้ว');
    try { window.dispatchEvent(new CustomEvent('tanot:quickadd', { detail: { record: rec } })); } catch (err2) {}
  }

  function toast(msg) {
    var t = document.querySelector('.ome-qa-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'ome-qa-toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function open(opts) {
    if (!root) build();
    if (isOpen) return;
    isOpen = true;
    prevFocus = document.activeElement;
    var f = root.querySelector('form');
    f.reset();
    f.date.value = todayYMD();
    showErr('');
    setType(opts && opts.type === 'income' ? 'income' : 'expense');
    root.hidden = false;
    f.amt.focus();
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.hidden = true;
    if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) {} }
  }

  window.OmeQuickAdd = { open: open, close: close };
})();
