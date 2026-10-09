/* ตารางตรวจก่อนนำเข้า snapshot (ใช้ร่วมกัน: migrate.html, data.html)
   TanotImportUI.render(el, plan, { source, onDone(result) }) — ไม่เขียนอะไรจนกว่าผู้ใช้กดปุ่มนำเข้า */
window.TanotImportUI = (function () {
  'use strict';

  /* ข้อความของตาราง — แปลในที่ด้วย data-i18n (สลับภาษาตอนตารางเปิดอยู่ได้ โดยไม่วาดใหม่ ตัวเลือกที่เลือกไว้ไม่หาย) · ชื่อคีย์ข้อมูลคือข้อมูล ไม่แปล */
  var T = OME_I18N.scope('imp', {
    th: { 'new': 'ใหม่', same: 'ตรงกันแล้ว', merge: 'รวมรายการ', conflict: 'ไม่ตรงกัน', conflictKeep: 'ไม่ตรงกัน {n} (เก็บของเครื่องนี้)',
      choose: 'เลือกค่า', keepLocal: 'เก็บของเครื่องนี้', useIncoming: 'ใช้ของที่นำเข้า', thisDevice: 'เครื่องนี้:', incoming: 'นำเข้า:',
      colData: 'ข้อมูล', colStatus: 'สถานะ', allIncoming: 'ใช้ของที่นำเข้าทั้งหมด', doImport: 'นำเข้า', importing: 'กำลังนำเข้า…',
      done: 'นำเข้าและตรวจแล้ว {n} รายการ', partial: 'ตรวจผ่าน {ok}/{all} — {failed}', failed: 'นำเข้าไม่สำเร็จ: {err}' },
    en: { 'new': 'New', same: 'Already identical', merge: 'Merge entries', conflict: 'Different', conflictKeep: '{n} different (keeping this device\'s)',
      choose: 'Choose a value', keepLocal: 'Keep this device\'s', useIncoming: 'Use the imported one', thisDevice: 'This device:', incoming: 'Imported:',
      colData: 'Data', colStatus: 'Status', allIncoming: 'Use all imported values', doImport: 'Import', importing: 'Importing…',
      done: 'Imported and verified {n} item(s)', partial: 'Verified {ok}/{all} — {failed}', failed: 'Import failed: {err}' }
  });
  var tx = function (k) { return ' data-i18n="imp.' + k + '"'; };
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
      if (it.status === 'merge') extra = '+' + it.added + (it.conflicts ? ' · ' + T('conflictKeep', { n: it.conflicts }) : '');
      if (it.status === 'conflict') {
        extra = '<select data-i="' + i + '" aria-label="' + T('choose') + '" data-i18n-attr="aria-label:imp.choose">' +
          '<option value="local"' + tx('keepLocal') + '>' + T('keepLocal') + '</option><option value="incoming"' + tx('useIncoming') + '>' + T('useIncoming') + '</option></select>' +
          (it.type === 'ls' ? '<div class="imp-pv"><span' + tx('thisDevice') + '>' + T('thisDevice') + '</span> ' + esc(preview(it.local)) + '</div><div class="imp-pv"><span' + tx('incoming') + '>' + T('incoming') + '</span> ' + esc(preview(it.value)) + '</div>' : '');
      }
      rows.push('<tr><td class="imp-key" data-i18n-skip>' + esc(name(it)) + '</td><td><span class="badge"' + tx(it.status) + '>' + T(it.status) + '</span></td><td>' + extra + '</td></tr>');
    });
    el.innerHTML =
      '<div class="kpi-grid">' +
        ['new', 'merge', 'conflict', 'same'].map(function (k) {
          return '<div class="kpi"><div class="kpi-label"' + tx(k) + '>' + T(k) + '</div><div class="kpi-value" data-count="' + k + '">' + counts[k] + '</div></div>';
        }).join('') +
      '</div>' +
      (rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th'+ tx('colData') +'>' + T('colData') + '</th><th'+ tx('colStatus') +'>' + T('colStatus') + '</th><th></th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '') +
      '<div class="row">' +
        (counts.conflict ? '<button type="button" class="btn" data-act="all-incoming"' + tx('allIncoming') + '>' + T('allIncoming') + '</button>' : '') +
        '<button type="button" class="btn primary" data-act="import"' + (rows.length ? '' : ' disabled') + tx('doImport') + '>' + T('doImport') + '</button>' +
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
      OME_I18N.live(out, function () { return T('importing'); });
      window.TanotData.applyImport(plan, choices, opts.source).then(function (res) {
        var ok = !res.failed.length && res.verified === res.written;
        out.className = 'imp-result ' + (ok ? 'ok' : 'err');
        OME_I18N.live(out, function () { return ok ? T('done', { n: res.verified }) : T('partial', { ok: res.verified, all: res.written, failed: res.failed.join(' · ') }); });
        if (opts.onDone) opts.onDone(res, ok);
      }).catch(function (e) {
        out.className = 'imp-result err';
        OME_I18N.live(out, function () { return T('failed', { err: e && e.message || e }); });
        btn.disabled = false;
      });
    });
  }

  return { render: render };
})();
