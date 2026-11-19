/* report-dashboard.modules.js — โหลดโมดูลแม่แบบ (projectcontrol + 10 โดเมน) เมื่อมีข้อมูลแล้วเท่านั้น
   core ยิง 'tanot:rd-data' ทุกครั้งที่ renderDashboard() ทำงานกับข้อมูลจริง:
   - ผู้ใช้เลือกแม่แบบไว้ (domainOverride) → โหลดเฉพาะไฟล์ของแม่แบบนั้น
   - Auto / ยังไม่เลือก → โหลดครบทุกตัว (แต่ละตัวตัดสินเองจากหัวคอลัมน์ว่าตรงกับตนไหม)
   - 'none' (Data Explorer) → ไม่โหลดอะไร
   โหลดตามลำดับเดิมของหน้า (async=false) แต่ละโมดูลเริ่มทำงานเองเมื่อโหลดเสร็จ (init → schedule → render)
   ทุกไฟล์ยังอยู่ใน PRECACHE ของ sw.js จึงใช้ออฟไลน์ได้ */
(function () {
  'use strict';
  var FILES = {
    project: 'report-dashboard.projectcontrol.js',
    safety: 'report-dashboard.safety.js',
    hr: 'report-dashboard.hr.js',
    itops: 'report-dashboard.itops.js',
    maintenance: 'report-dashboard.maintenance.js',
    legal: 'report-dashboard.lawfirm.js',
    risk: 'report-dashboard.risk.js',
    finance: 'report-dashboard.finance.js',
    reading: 'report-dashboard.reading.js',
    kpidashboard: 'report-dashboard.kpidashboard.js',
    organizational: 'report-dashboard.organizational.js'
  };
  var ORDER = ['project', 'safety', 'hr', 'itops', 'maintenance', 'legal', 'risk', 'finance', 'reading', 'kpidashboard', 'organizational'];
  var requested = {};

  function load(id) {
    if (requested[id]) return;
    requested[id] = true;
    var s = document.createElement('script');
    s.src = FILES[id];
    s.async = false;
    s.onerror = function () { requested[id] = false; console.error('[report-dashboard] โหลดโมดูลไม่ได้:', FILES[id]); };
    document.head.appendChild(s);
  }

  function need() {
    var A = window.TanotDashboard, st = A && A.getState && A.getState();
    if (!st || !st.rows || !st.rows.length) return;
    var ov = st.domainOverride;
    if (ov === 'none') return;
    if (ov && FILES[ov]) load(ov);
    else ORDER.forEach(load);
  }

  document.addEventListener('tanot:rd-data', need);
})();
