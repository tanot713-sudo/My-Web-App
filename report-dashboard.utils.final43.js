/* Tanot Report Dashboard - shared pure utilities */
(function (w) {
  'use strict';
  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); } catch (e) { return value; }
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function unique(values) {
    var seen = Object.create(null), out = [];
    (values || []).forEach(function (v) { var k = String(v); if (!seen[k]) { seen[k] = 1; out.push(v); } });
    return out;
  }
  function median(values) {
    var a = (values || []).filter(function (v) { return typeof v === 'number' && isFinite(v); }).slice().sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  /* ── UI กลางของหน้า: ไอคอน Lucide / toast / กล่องโต้ตอบ (<dialog class="dialog">) ──
     ทุกโมดูลและ patch เรียกจากที่นี่ที่เดียว (แทนระบบ toast/modal ที่เคยมีหลายชุด) */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  var toastTimer = 0;
  /* kind: 'ok' | 'err' | ไม่ระบุ (info) — ขึ้นทีละอัน แทนอันก่อนหน้า */
  function toast(message, kind) {
    if (kind === 'error') kind = 'err';
    if (kind === 'success') kind = 'ok';
    var region = document.querySelector('.toast-region');
    if (!region) { region = document.createElement('div'); region.className = 'toast-region'; region.setAttribute('role', 'status'); document.body.appendChild(region); }
    region.innerHTML = '';
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'ok' || kind === 'err' ? ' ' + kind : '');
    el.innerHTML = icon(kind === 'ok' ? 'circle-check' : kind === 'err' ? 'circle-alert' : 'info') + '<span>' + esc(message) + '</span>';
    region.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, kind === 'err' ? 4200 : 2600);
  }
  var dlgSeq = 0;
  /* modal(title, bodyHTML, footerHTML) → { el, body, close } (body = element ของกล่องทั้งใบ) — Esc / คลิกนอกกล่อง / ปุ่ม [data-cancel] ปิดเอง */
  function modal(title, bodyHTML, footerHTML) {
    var id = 'rdDlg' + (++dlgSeq);
    var dlg = document.createElement('dialog');
    dlg.className = 'dialog rd-dialog';
    dlg.setAttribute('aria-labelledby', id);
    dlg.innerHTML = '<div class="dialog-head"><h2 id="' + id + '">' + esc(title) + '</h2>' +
      '<button type="button" class="btn ghost icon sm" data-dlg-x aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="dialog-body">' + (bodyHTML || '') + '</div>' + (footerHTML ? '<div class="dialog-foot">' + footerHTML + '</div>' : '');
    document.body.appendChild(dlg);
    function close() { if (dlg.open) dlg.close(); else if (dlg.parentNode) dlg.parentNode.removeChild(dlg); }
    dlg.addEventListener('close', function () { if (dlg.parentNode) dlg.parentNode.removeChild(dlg); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.querySelector('[data-dlg-x]').addEventListener('click', close);
    var cancel = dlg.querySelector('[data-cancel]');
    if (cancel) cancel.addEventListener('click', close);
    dlg.showModal();
    /* body = ทั้งกล่อง (รวมส่วนท้ายปุ่ม) เพื่อให้ ui.body.querySelector('[data-apply]') หาปุ่มท้ายกล่องเจอ */
    return { el: dlg, close: close, body: dlg };
  }
  w.TanotReportUtils = { clone: clone, clamp: clamp, unique: unique, median: median, esc: esc, icon: icon, toast: toast, modal: modal };
})(window);
