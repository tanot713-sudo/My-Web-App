/* ตารางตรวจก่อนนำเข้า snapshot (ใช้ร่วมกัน: migrate.html, data.html)
   TanotImportUI.render(el, plan, { source, onDone(result) }) — ไม่เขียนอะไรจนกว่าผู้ใช้กดปุ่มนำเข้า */
window.TanotImportUI = (function () {
  'use strict';

  var LABEL = { 'new': 'ใหม่', same: 'ตรงกันแล้ว', merge: 'รวมรายการ', conflict: 'ไม่ตรงกัน' };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function name(it) { return it.type === 'ls' ? it.key : it.db + '/' + it.store + ' · ' + JSON.stringify(it.key); }
  function preview(v) {
    var s = typeof v === 'string' ? v : JSON.stringify(v);
    return s == null ? '' : s.length > 80 ? s.slice(0, 80) + '…' : s;
  }

  function render(el, plan, opts) {
    opts = opts || {};
    var counts = { 'new': 0, same: 0, merge: 0, conflict: 0 };
    plan.items.forEach(function (it) { counts[it.status]++; });
    var rows = [];
    plan.items.forEach(function (it, i) {
      if (it.status === 'same') return;
      var extra = '';
      if (it.status === 'merge') extra = '+' + it.added + (it.conflicts ? ' · ไม่ตรงกัน ' + it.conflicts + ' (เก็บของเครื่องนี้)' : '');
      if (it.status === 'conflict') {
        extra = '<select data-i="' + i + '" aria-label="เลือกค่า">' +
          '<option value="local">เก็บของเครื่องนี้</option><option value="incoming">ใช้ของที่นำเข้า</option></select>' +
          (it.type === 'ls' ? '<div class="imp-pv"><span>เครื่องนี้:</span> ' + esc(preview(it.local)) + '</div><div class="imp-pv"><span>นำเข้า:</span> ' + esc(preview(it.value)) + '</div>' : '');
      }
      rows.push('<tr><td class="imp-key">' + esc(name(it)) + '</td><td><span class="badge">' + LABEL[it.status] + '</span></td><td>' + extra + '</td></tr>');
    });
    el.innerHTML =
      '<div class="kpi-grid">' +
        ['new', 'merge', 'conflict', 'same'].map(function (k) {
          return '<div class="kpi"><div class="kpi-label">' + LABEL[k] + '</div><div class="kpi-value" data-count="' + k + '">' + counts[k] + '</div></div>';
        }).join('') +
      '</div>' +
      (rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>ข้อมูล</th><th>สถานะ</th><th></th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '') +
      '<div class="row">' +
        (counts.conflict ? '<button type="button" class="btn" data-act="all-incoming">ใช้ของที่นำเข้าทั้งหมด</button>' : '') +
        '<button type="button" class="btn primary" data-act="import"' + (rows.length ? '' : ' disabled') + '>นำเข้า</button>' +
      '</div>' +
      '<div class="imp-result" role="status"></div>';

    var allBtn = el.querySelector('[data-act="all-incoming"]');
    if (allBtn) allBtn.addEventListener('click', function () {
      [].forEach.call(el.querySelectorAll('select[data-i]'), function (s) { s.value = 'incoming'; });
    });
    var btn = el.querySelector('[data-act="import"]');
    btn.addEventListener('click', function () {
      var choices = {};
      [].forEach.call(el.querySelectorAll('select[data-i]'), function (s) { choices[s.getAttribute('data-i')] = s.value; });
      btn.disabled = true;
      var out = el.querySelector('.imp-result');
      out.textContent = 'กำลังนำเข้า…';
      window.TanotData.applyImport(plan, choices, opts.source).then(function (res) {
        var ok = !res.failed.length && res.verified === res.written;
        out.className = 'imp-result ' + (ok ? 'ok' : 'err');
        out.textContent = ok ? 'นำเข้าและตรวจแล้ว ' + res.verified + ' รายการ' :
          'ตรวจผ่าน ' + res.verified + '/' + res.written + ' — ' + res.failed.join(' · ');
        if (opts.onDone) opts.onDone(res, ok);
      }).catch(function (e) {
        out.className = 'imp-result err';
        out.textContent = 'นำเข้าไม่สำเร็จ: ' + (e && e.message || e);
        btn.disabled = false;
      });
    });
  }

  return { render: render };
})();
