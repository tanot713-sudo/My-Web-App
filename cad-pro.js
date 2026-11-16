/* cad-pro.js — โปรแกรมเขียนแบบ 2 มิติ: CADCraft แบบโปรแกรมเต็ม (vendor/craft/cadcraft-app-*) ผ่านหน้าแม่แบบ craft-app.js
   หน้านี้มีแค่ config + ชื่อหน้า · การโหลด/เปิดไฟล์/ดาวน์โหลด/ไฟล์ล่าสุด/สถานะอยู่ใน craft-app.js
   เมนูของแอปเป็นภาษาอังกฤษ (CADCraft ยังไม่มีคำแปลไทย — ROADMAP 11c) · รุ่นเว็บไม่มี DWG (patch ซ่อนตัวเลือก) */
(function () {
  'use strict';
  window.OME_I18N.add('cp', {
    th: { title: 'โปรแกรมเขียนแบบ 2 มิติ | Tanot', crumb: 'งาน', h1: 'โปรแกรมเขียนแบบ 2 มิติ', open: 'เปิดไฟล์', simple: 'ดู/แก้แบบง่ายในหน้า CAD' },
    en: { title: '2D drafting | Tanot', crumb: 'Work', h1: '2D drafting', open: 'Open file', simple: 'View/edit simply on the CAD page' }
  });
  window.TanotCraftApp.page({
    lib: 'cadcraft-app',
    glue: 'cadcraft_app.js',
    wasm: 'cadcraft_app_bg.wasm',
    prefix: 'cadcraft',
    canvas: 'cadcraft_canvas',
    prefs: false,
    liveTheme: true,
    recent: true,
    ext: '.dxf',
    mime: 'image/vnd.dxf',
    mimes: { '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.png': 'image/png' },
    phoneMax: 700,
    tabletMax: 900
  });
})();
