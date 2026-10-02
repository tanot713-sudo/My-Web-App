/* ══════════════════════════════════════════════════════════════════
   report-dashboard.mntsrc.js — เปิดข้อมูลจากบันทึกงานบำรุงรักษาเข้า "นำเสนอรายงาน" โดยตรง
   report-dashboard.html?src=maintenance&from=YYYY-MM-DD&to=YYYY-MM-DD
   อ่านอย่างเดียว: TanotData.read / readIdb (ไม่เปิด tanot-report-dashboard เอง ไม่เพิ่มคีย์/ฐานข้อมูลใหม่) → MntCalc.reportRows →
   สร้าง workbook ชีต WorkOrders แล้วส่งผ่านทางเดียวกับการอัปโหลดไฟล์ (TanotDashboard.loadWorkbook = onWorkbookParsed)
   ไฟล์นี้เพิ่มเข้ามาเท่านั้น — ไม่แก้ตรรกะเดิมของ report-dashboard (docs/maintenance-design.md หัวข้อ 7.3)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var q;
  try { q = new URLSearchParams(location.search); } catch (e) { return; }
  if (q.get('src') !== 'maintenance') return;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var now = new Date(), t = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  var from = /^\d{4}-\d{2}-\d{2}$/.test(q.get('from') || '') ? q.get('from') : t.slice(0, 4) + '-01-01';
  var to = /^\d{4}-\d{2}-\d{2}$/.test(q.get('to') || '') ? q.get('to') : t;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.MntCalc) { resolve(); return; }
      var el = document.createElement('script');
      el.src = src; el.onload = resolve; el.onerror = function () { reject(new Error(src)); };
      document.head.appendChild(el);
    });
  }

  function run(D, TD, X) {
    return loadScript('mnt-calc.js').then(function () {
      var M = window.MntCalc, y0 = +from.slice(0, 4), y1 = Math.max(y0, +to.slice(0, 4)), reads = [];
      for (var y = y0; y <= y1 && y <= y0 + 5; y++) reads.push(TD.readIdb('tanot-mnt-' + y, 'insp'));
      reads.push(TD.readIdb('tanot-mnt', 'wo'), TD.readIdb('tanot-mnt', 'woev'));
      return Promise.all(reads).then(function (r) {
        var ev = r.pop(), wos = r.pop(), docs = [].concat.apply([], r);
        var rd = function (k, d) { var v = TD.read(k, d); return v == null ? d : v; };
        var rep = M.reportRows({ assets: rd('tanot:mnt:assets', []), sites: rd('tanot:mnt:sites', []), plans: rd('tanot:mnt:plans', []), settings: rd('tanot:mnt:settings', {}),
          inspDocs: docs, wos: wos, woEvents: ev, from: from, to: to, pmFreqs: M.PM_FREQS_DEFAULT, today: t });
        var ws = X.utils.aoa_to_sheet([rep.headers].concat(rep.rows), { cellDates: true });
        Object.keys(ws).forEach(function (k) { if (k[0] !== '!' && ws[k].t === 'd') ws[k].z = 'yyyy-mm-dd hh:mm'; });
        var wb = X.utils.book_new();
        X.utils.book_append_sheet(wb, ws, 'WorkOrders');
        var st = D.getState();
        // มีข้อมูลเปิดค้างอยู่ (หรือมีงานเก่ารอกู้) → ถามก่อนแทนที่
        var resume = document.getElementById('resumeCard');
        var busy = (st && st.rows && st.rows.length) || (resume && resume.style.display === 'block');
        if (busy && !window.confirm('มีข้อมูลที่เปิดค้างอยู่ — แทนที่ด้วยข้อมูลบำรุงรักษา?')) return;
        D.loadWorkbook(wb, 'maintenance.xlsx');
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
      });
    });
  }

  function boot(tries) {
    var D = window.TanotDashboard, TD = window.TanotData, X = window.XLSX;
    if (!D || typeof D.loadWorkbook !== 'function' || !TD || !X) {
      if (tries < 100) setTimeout(function () { boot(tries + 1); }, 100);
      return;
    }
    setTimeout(function () { run(D, TD, X).catch(function (e) { console.error(e); }); }, 500); // รอให้การ์ด "กู้งานค้าง" ของหน้าโผล่ก่อน
  }
  boot(0);
})();
