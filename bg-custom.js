/* ภาพพื้นหลังที่ผู้ใช้ตั้งเอง (ROADMAP แถว 10) — ใช้ภาพที่สร้างจาก image-gen เป็นพื้นหลังของ "กลุ่มหน้า" (กลุ่มเดียวกับ BG_GROUPS ใน theme-boot.js)
   • ค่าที่ตั้ง = sync map 'tanot:bg:custom' {กลุ่ม: {id, b, ts}} เขียนผ่าน OmeTheme.setBgCustom เท่านั้น (id = ไฟล์ R2 ns images, ไม่เก็บ Blob)
   • theme-boot.js ตั้ง data-bg-custom + --ome-bg-url ตอนบูต · sw.js แคชไฟล์ใน 'ome-bgc-v1' (ออฟไลน์ใช้ได้) · เลิกใช้ = ภาพเดิมของกลุ่ม
   • ตั้งภาพแล้ววัดความสว่างด้านซ้าย (ที่ตัวอักษรอยู่) เก็บเป็น l (0–1) → theme-boot.js ตั้ง data-bg-lum → theme.css ปรับ scrim/ฟิลเตอร์ให้ตัวอักษรอ่านออกทั้งสองธีม
   • ใช้ได้เฉพาะ *.pages.dev (หรือ window.TANOT_FILES={enabled}) เพราะภาพอยู่ใน R2 หลัง Access
   ตรรกะวัดสีล้วน (brightLeft) ไม่มี DOM — เรียกจากเทสต์ได้ */
(function (root) {
  'use strict';
  var CACHE = 'ome-bgc-v1', LEFT_FRAC = 0.6, SAMPLE_W = 64;
  var IMG_KEY = 'tanot:images:items';
  var LABELS = {
    today: ['วันนี้', 'Today'], documents: ['เอกสาร', 'Documents'], engineering: ['วิศวกรรม', 'Engineering'], report: ['รายงาน', 'Reports'],
    law: ['กฎหมาย', 'Law'], money: ['การเงินและภาษี', 'Money & tax'], invest: ['การลงทุน', 'Investing'], health: ['สุขภาพ', 'Health'],
    car: ['รถ', 'Car'], education: ['การศึกษา', 'Education'], music: ['ดนตรี', 'Music'], sports: ['กีฬา', 'Sports'],
    cooking: ['ทำอาหาร', 'Cooking'], coding: ['โค้ดและพิมพ์ดีด', 'Coding & typing'], settings: ['ตั้งค่าและอื่นๆ', 'Settings & more']
  };

  /* ความสว่างเฉลี่ย (0–1, น้ำหนัก Rec.709 บนค่า sRGB) ของ LEFT_FRAC ด้านซ้ายของภาพ — พิกเซลโปร่งใสนับเป็นสีขาว (พื้นหลังหน้า) */
  function brightLeft(data, w, h) {
    var maxX = Math.max(1, Math.round(w * LEFT_FRAC)), sum = 0, n = 0;
    for (var y = 0; y < h; y++) for (var x = 0; x < maxX; x++) {
      var i = (y * w + x) * 4, a = data[i + 3] / 255;
      var r = data[i] * a + 255 * (1 - a), g = data[i + 1] * a + 255 * (1 - a), b = data[i + 2] * a + 255 * (1 - a);
      sum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; n++;
    }
    return n ? sum / n : 0;
  }

  function T(k, v) { var I = root.OME_I18N; return I ? (I.t('bgc.' + k, v) || k) : k; }
  function lang() { return root.OME_LANG && root.OME_LANG.get() === 'en' ? 1 : 0; }
  function label(g) { return (LABELS[g] || [g, g])[lang()]; }
  function available() { return /\.pages\.dev$/.test(location.hostname) || !!(root.TANOT_FILES && root.TANOT_FILES.enabled); }
  function toast(k, kind) { if (root.tanotToast) root.tanotToast(T(k), kind || 'ok'); }
  function bgUrl(id) { return '/api/files?id=' + encodeURIComponent(id) + '&bg=1'; }
  function thumbUrl(id) { return '/api/files?id=' + encodeURIComponent(id); }
  function groups() { return root.OmeTheme ? root.OmeTheme.bgAllGroups() : []; }
  function items() {
    var a = root.TanotData ? root.TanotData.read(IMG_KEY, []) : [];
    return (Array.isArray(a) ? a : []).filter(function (x) { return x && typeof x.id === 'string' && /^image\//.test(x.mime || 'image/'); })
      .sort(function (p, q) { return (q.createdAt || q.at || 0) - (p.createdAt || p.at || 0); });
  }
  function dropCache(id) {
    if (!id || !root.caches) return Promise.resolve();
    return root.caches.open(CACHE).then(function (c) { return c.delete(bgUrl(id)); }).catch(function () {});
  }
  function stillUsed(id) {
    var m = root.OmeTheme.bgMap();
    return Object.keys(m).some(function (g) { return m[g] && m[g].id === id; });
  }

  /* ดึงภาพ (ผ่าน sw.js จึงลงแคชไปในตัว) แล้ววัดความสว่างด้านซ้าย */
  function measure(id) {
    return fetch(bgUrl(id), { credentials: 'same-origin', redirect: 'manual' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.blob();
    }).then(function (blob) {
      return createImageBitmap(blob);
    }).then(function (bmp) {
      var w = SAMPLE_W, h = Math.max(1, Math.round(bmp.height * w / bmp.width));
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      return brightLeft(ctx.getImageData(0, 0, w, h).data, w, h);
    });
  }

  function set(group, id) {
    var old = root.OmeTheme.bgCustom(group);
    return measure(id).then(function (lum) {
      var ok = root.OmeTheme.setBgCustom(group, { id: id, l: lum });
      if (!ok) throw new Error('write');
      if (old && old.id !== id && !stillUsed(old.id)) dropCache(old.id);
      toast('setOk');
      return lum;
    }).catch(function () { toast('setFail', 'err'); return null; });
  }
  function reset(group) {
    var old = root.OmeTheme.bgCustom(group);
    root.OmeTheme.setBgCustom(group, null);
    if (old && !stillUsed(old.id)) dropCache(old.id);
    toast('resetOk');
  }
  /* image-gen ลบภาพ → กลุ่มที่ใช้ภาพนี้กลับเป็นภาพเดิม + ลบสำเนาในเครื่อง */
  function clearById(id) {
    var hit = root.OmeTheme.clearBgCustomById(id);
    if (hit.length) dropCache(id);
    return hit;
  }

  /* ── dialog ── */
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function openDialog(title, buildBody) {
    var dlg = el('dialog', 'dialog bgc-dialog');
    dlg.setAttribute('aria-label', title);
    var head = el('div', 'dialog-head'); head.appendChild(el('h2', null, title));
    var x = el('button', 'btn icon ghost', '×'); x.type = 'button'; x.setAttribute('aria-label', T('close'));
    head.appendChild(x);
    var body = el('div', 'dialog-body'); buildBody(body, function () { dlg.close(); });
    dlg.appendChild(head); dlg.appendChild(body);
    function done() { dlg.remove(); }
    dlg.addEventListener('close', done);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    x.addEventListener('click', function () { dlg.close(); });
    document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    return dlg;
  }

  /* เลือกภาพจากคลัง image-gen ให้กลุ่มนี้ */
  function choose(group) {
    var list = items(), cur = root.OmeTheme.bgCustom(group);
    return openDialog(T('chooseTitle', { group: label(group) }), function (body, close) {
      if (!list.length) { body.appendChild(el('p', 'bgc-empty', T('noImages'))); var a = el('a', 'btn primary', T('openGen')); a.href = 'image-gen.html'; body.appendChild(a); return; }
      var grid = el('div', 'bgc-grid');
      list.forEach(function (x) {
        var b = el('button', 'bgc-tile' + (cur && cur.id === x.id ? ' sel' : '')); b.type = 'button';
        b.setAttribute('data-id', x.id); b.setAttribute('aria-label', x.prompt || x.name || x.id);
        var im = el('img'); im.loading = 'lazy'; im.alt = ''; im.src = thumbUrl(x.id); b.appendChild(im);
        b.addEventListener('click', function () { b.disabled = true; set(group, x.id).then(function () { close(); }); });
        grid.appendChild(b);
      });
      body.appendChild(grid);
      if (cur) {
        var r = el('button', 'btn', T('reset')); r.type = 'button'; r.setAttribute('data-act', 'reset');
        r.addEventListener('click', function () { reset(group); close(); });
        body.appendChild(r);
      }
    });
  }

  /* เลือกกลุ่มให้ภาพนี้ (เรียกจาก image-gen) */
  function chooseGroup(id, defaultGroup) {
    return openDialog(T('groupTitle'), function (body, close) {
      var m = root.OmeTheme.bgMap();
      var ul = el('div', 'bgc-groups');
      groups().forEach(function (g) {
        var row = el('div', 'bgc-grow' + (g === defaultGroup ? ' sel' : ''));
        var b = el('button', 'btn' + (m[g] && m[g].id === id ? ' primary' : ''), label(g)); b.type = 'button'; b.setAttribute('data-group', g);
        b.addEventListener('click', function () { b.disabled = true; set(g, id).then(function () { close(); }); });
        row.appendChild(b);
        if (m[g]) {
          var r = el('button', 'btn ghost sm', T('reset')); r.type = 'button'; r.setAttribute('data-reset', g);
          r.addEventListener('click', function () { reset(g); close(); });
          row.appendChild(r);
        }
        ul.appendChild(row);
      });
      body.appendChild(ul);
    });
  }

  if (root.OME_I18N) root.OME_I18N.add('bgc', {
    th: { chooseTitle: 'ภาพพื้นหลัง — {group}', groupTitle: 'ตั้งเป็นพื้นหลังของกลุ่มหน้า', noImages: 'ยังไม่มีภาพในคลัง', openGen: 'ไปสร้างภาพ',
      reset: 'กลับเป็นภาพเดิม', close: 'ปิด', setOk: 'ตั้งเป็นพื้นหลังแล้ว',
      setFail: 'ตั้งภาพไม่สำเร็จ', resetOk: 'กลับเป็นภาพเดิมแล้ว' },
    en: { chooseTitle: 'Background image — {group}', groupTitle: 'Set as background for a page group', noImages: 'No images in your library yet', openGen: 'Create an image',
      reset: 'Back to default image', close: 'Close', setOk: 'Background set',
      setFail: 'Could not set the image', resetOk: 'Back to the default image' }
  });

  root.TanotBgCustom = { available: available, label: label, brightLeft: brightLeft, set: set, reset: reset, clearById: clearById, choose: choose, chooseGroup: chooseGroup };
})(typeof window !== "undefined" ? window : (typeof module !== "undefined" ? module.exports : {}));
