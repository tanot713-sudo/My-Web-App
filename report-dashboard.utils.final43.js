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

  /* ── จานสีสำหรับกราฟ SVG ที่โมดูลรายงานวาดเอง ──
     แอตทริบิวต์ fill/stroke ของ SVG ที่ใส่ var(--x) จะหายสีตอน html2canvas แปลง SVG เป็นรูป จึงต้องใส่ค่า rgb ที่คำนวณแล้ว
     (อ่านจากโทเคน --ome-*) และวาดใหม่เมื่อธีมเปลี่ยน — โมดูลเรียก palette() ตอนวาด และ onTheme(schedule) */
  var FALLBACK = { series: ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#4A3AA7', '#E34948'],
    grid: '#E6E9F2', axis: '#727C93', text: '#1F2430', muted: '#727C93', faint: '#A3AABB', surface1: '#FFFFFF', surface2: '#F2F4F9', border: '#EAEDF5',
    ok: '#17B26A', warn: '#E08700', err: '#E5484D', info: '#3B9BEA', okSoft: '#E4F6EC', warnSoft: '#FCF0DE', errSoft: '#FCE9EA', infoSoft: '#E6F1FC',
    okInk: '#0F7C4A', warnInk: '#935B00', errInk: '#B3282D', infoInk: '#1E6BB0', accent: '#12A594', onAccent: '#FFFFFF' };
  var probe = null, cnv = null, pal = null;
  function token(name) {
    try {
      if (!probe) { probe = document.createElement('span'); probe.style.display = 'none'; document.body.appendChild(probe); cnv = document.createElement('canvas'); cnv.width = cnv.height = 1; }
      var ctx = cnv.getContext('2d', { willReadFrequently: true });
      probe.style.color = 'var(' + name + ')';
      var css = getComputedStyle(probe).color;
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
      var d = ctx.getImageData(0, 0, 1, 1).data;
      return d[3] === 255 ? 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')' : 'rgba(' + d[0] + ',' + d[1] + ',' + d[2] + ',' + (d[3] / 255).toFixed(3) + ')';
    } catch (e) { return null; }
  }
  function palette() {
    if (pal) return pal;
    var t = null; try { t = window.OmeChartTheme && window.OmeChartTheme.get(); } catch (e) {}
    if (!t || !document.body) return FALLBACK;
    function tk(n, k) { return token(n) || FALLBACK[k]; }
    pal = { series: t.series, grid: t.grid, axis: t.axis, text: t.text, muted: t.textMuted, faint: tk('--ome-text-3', 'faint'), surface1: t.surface, surface2: tk('--ome-surface-2', 'surface2'), border: t.border,
      ok: tk('--ome-ok', 'ok'), warn: tk('--ome-warn', 'warn'), err: tk('--ome-err', 'err'), info: tk('--ome-info', 'info'),
      okSoft: tk('--ome-ok-soft', 'okSoft'), warnSoft: tk('--ome-warn-soft', 'warnSoft'), errSoft: tk('--ome-err-soft', 'errSoft'), infoSoft: tk('--ome-info-soft', 'infoSoft'),
      okInk: tk('--ome-ok-ink', 'okInk'), warnInk: tk('--ome-warn-ink', 'warnInk'), errInk: tk('--ome-err-ink', 'errInk'), infoInk: tk('--ome-info-ink', 'infoInk'), accent: t.accent, onAccent: tk('--ome-on-accent', 'onAccent') };
    return pal;
  }
  var themeHooks = [];
  function onTheme(fn) { themeHooks.push(fn); }
  if (window.OmeChartTheme) window.OmeChartTheme.onChange(function () { pal = null; themeHooks.forEach(function (f) { try { f(); } catch (e) {} }); });
  w.TanotReportUtils = { clone: clone, clamp: clamp, unique: unique, median: median, esc: esc, icon: icon, toast: toast, modal: modal, palette: palette, onTheme: onTheme };
})(window);
