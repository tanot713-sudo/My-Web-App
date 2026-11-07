/* pdf-pro.js — โปรแกรมแก้ไข PDF: PdfCraft แบบโปรแกรมเต็ม (vendor/craft/pdfcraft-app-*) ผ่านหน้าแม่แบบ craft-app.js
   หน้านี้มีแค่ config + ชื่อหน้า · การโหลด/เปิดไฟล์/ดาวน์โหลด/สถานะอยู่ใน craft-app.js */
(function () {
  'use strict';
  window.OME_I18N.add('pp', {
    th: { title: 'โปรแกรมแก้ไข PDF | Tanot', crumb: 'งาน', h1: 'โปรแกรมแก้ไข PDF', open: 'เปิดไฟล์' },
    en: { title: 'PDF editor | Tanot', crumb: 'Work', h1: 'PDF editor', open: 'Open file' }
  });
  window.TanotCraftApp.page({
    lib: 'pdfcraft-app',
    glue: 'pdfcraft_app.js',
    wasm: 'pdfcraft_app_bg.wasm',
    prefix: 'pdfcraft',
    ext: '.pdf',
    mime: 'application/pdf'
  });
})();
