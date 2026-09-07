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
  w.TanotReportUtils = { clone: clone, clamp: clamp, unique: unique, median: median };
})(window);
