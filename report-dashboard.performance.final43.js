/* Tanot Report Dashboard - performance adapter */
(function (w) {
  'use strict';
  var worker = null, seq = 0, cache = null;
  function start(url, onResult) {
    if (worker || typeof Worker === 'undefined') return worker;
    try {
      worker = new Worker(url || 'report-dashboard.worker.final29.js');
      worker.onmessage = function (ev) {
        if (!ev || !ev.data) return;
        cache = ev.data.result || null;
        if (typeof onResult === 'function') onResult(cache, ev.data);
      };
      worker.onerror = function () { worker = null; };
    } catch (e) { worker = null; }
    return worker;
  }
  function analyze(payload) {
    if (!worker || !payload) return false;
    try { worker.postMessage(Object.assign({ id: ++seq, type: 'analyze' }, payload)); return true; }
    catch (e) { return false; }
  }
  function getCache() { return cache; }
  w.TanotReportPerformance = { start: start, analyze: analyze, getCache: getCache };
})(window);
