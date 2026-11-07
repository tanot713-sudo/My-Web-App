/* craft-app.js — แม่แบบหน้า "โปรแกรมเต็ม" ของตระกูล *Craft (PdfCraft ใน pdf-pro.html; CADCraft ฯลฯ ใช้ต่อได้)
   แอป egui/eframe (wasm-bindgen --target web) รันในหน้าเดียวกันแบบ "page host mode" ของต้นฉบับ:
   <canvas id="<prefix>" data-host="page"> + CustomEvent บน canvas (ไม่ bubble):
     แอป → หน้า: <prefix>:ready · <prefix>:save {name, saveAs, bytes} · <prefix>:dirty {dirty} · <prefix>:failed {error}
     หน้า → แอป: <prefix>:open {name, bytes}
   (สัญญาเดียวกับ craft-web-host ของ storytold/craft-libs — packaging/web/README.md ของแต่ละแอป)
   - ไฟล์ผู้ใช้อยู่ในเครื่องเท่านั้น: เปิด = อ่านจาก <input type=file> ส่งเข้าแอป · บันทึก = ดาวน์โหลดไฟล์ ไม่มีการส่งขึ้นเซิร์ฟเวอร์
   - glue + wasm โหลดผ่าน craft-loader.js (ตรวจ sha256 ตาม manifest, แคช tanot-craft-v1 ใน sw.js) · โหลดเมื่อเรียก start() เท่านั้น
   - ล้ม = state 'error' (หน้าแสดง TanotCraft.message + ลองใหม่) + TanotCraft.report — ไม่มีทางสำรองเงียบๆ
   - eframe รันได้ครั้งเดียวต่อหน้า: เริ่มสำเร็จแล้วล้มทีหลัง → ต้องโหลดหน้าใหม่ (reload:true ใน info)
   UMD: window.TanotCraftApp · ใช้: TanotCraftApp.create({lib, glue, wasm, prefix, canvas, onState}) */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TanotCraftApp = api;
})(typeof self !== 'undefined' ? self : this, function (G) {
  'use strict';

  var MAX_NAME = 255;

  /* ชื่อไฟล์ที่ดาวน์โหลด: ตัดอักขระที่ระบบไฟล์ไม่รับ · ไม่มีนามสกุล = ใส่ ext */
  function safeName(name, ext) {
    var s = String(name || '').replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    if (!s || /^\.+$/.test(s)) s = 'document';
    if (ext && !/\.[A-Za-z0-9]{1,8}$/.test(s)) s += ext;
    return s;
  }

  function download(bytes, name, mime) {
    var blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    var u = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = u;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 30000);
  }

  /* จอเล็ก/สัมผัสเป็นหลัก — หน้าแสดงสถานะ + ปุ่มเปิดต่อแทนการโหลดเอง */
  function isSmallScreen() {
    try { return G.matchMedia('(max-width: 700px)').matches; } catch (e) { return false; }
  }

  function create(o) {
    var C = G.TanotCraft;
    var canvas = o.canvas;
    var prefix = o.prefix;
    var ext = o.ext || '';
    var mime = o.mime || 'application/octet-stream';
    var emit = typeof o.onState === 'function' ? o.onState : function () {};
    var state = 'idle';
    var ready = false;
    var dirty = false;
    var started = false; // eframe เริ่มแล้ว (สำเร็จหรือไม่) — เรียก init ซ้ำไม่ได้
    var queue = [];

    function set(s, info) { state = s; emit(s, info || {}); }
    function fail(err, stage) {
      var e = err && err.craft ? err : (C ? C.CraftError('init', o.lib, '', err) : err);
      if (C) C.report(e, { lib: o.lib, stage: stage });
      set('error', { err: e, reload: started });
    }

    canvas.dataset.host = 'page';
    // ฟังก่อน init: แอปประกาศ ready ระหว่าง init ยังทำงาน (README ของต้นฉบับ)
    canvas.addEventListener(prefix + ':ready', function () {
      ready = true;
      set('ready');
      var q = queue; queue = [];
      q.forEach(send);
    });
    canvas.addEventListener(prefix + ':save', function (ev) {
      var d = ev.detail || {};
      if (!d.bytes) return;
      var name = safeName(d.name, ext);
      download(d.bytes, name, mime);
      emit('saved', { name: name });
    });
    canvas.addEventListener(prefix + ':dirty', function (ev) {
      dirty = !!(ev.detail && ev.detail.dirty);
      emit('dirty', { dirty: dirty });
    });
    canvas.addEventListener(prefix + ':failed', function () {
      // detail.error เป็นข้อความเทคนิคของแอป (ไม่ใช่เนื้อหาผู้ใช้) — ไม่ลง log ทั้งก้อน เก็บแค่รหัส
      fail(C ? C.CraftError('unsupported', o.lib, '') : new Error('failed'), 'app-failed');
    });
    G.addEventListener('beforeunload', function (e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });

    function send(f) {
      canvas.dispatchEvent(new CustomEvent(prefix + ':open', { detail: { name: f.name, bytes: f.bytes } }));
      try { canvas.focus(); } catch (e) {}
    }

    function start() {
      if (started || state === 'loading') return;
      if (!C) { fail(new Error('craft-loader'), 'loader'); return; }
      if (typeof WebAssembly !== 'object') { fail(C.CraftError('unsupported', o.lib, o.wasm, 'WebAssembly'), 'unsupported'); return; }
      set('loading', { got: 0, total: 0 });
      Promise.all([
        C.esm(o.lib, o.glue),
        C.fetchFile(o.lib, o.wasm, { onProgress: function (got, total) { if (!started) emit('progress', { got: got, total: total }); } })
      ]).then(function (r) {
        set('starting');
        started = true;
        var init = r[0] && r[0].default;
        if (typeof init !== 'function') throw C.CraftError('init', o.lib, o.glue, 'no default export');
        return Promise.resolve(init({ module_or_path: r[1] })).catch(function (err) { throw C.CraftError('init', o.lib, o.wasm, err); });
      }).catch(function (err) { fail(err, 'load'); });
    }

    /* เปิดไฟล์ของผู้ใช้ (File จาก input/ลากวาง) — ยังไม่พร้อม = เข้าคิวรอ ready */
    function open(file) {
      if (!file) return Promise.resolve();
      return file.arrayBuffer().then(function (bytes) {
        var f = { name: String(file.name || '').slice(0, MAX_NAME) || 'document', bytes: bytes };
        if (ready) send(f); else { queue.push(f); start(); }
      });
    }

    return {
      start: start,
      open: open,
      state: function () { return state; },
      isDirty: function () { return dirty; },
      isReady: function () { return ready; }
    };
  }

  /* ขนาดดาวน์โหลดของแอปจาก manifest (ไบต์ดิบของ glue + wasm) — สำหรับป้ายบนหน้า */
  function sizeOf(lib, files) {
    var C = G.TanotCraft;
    if (!C) return Promise.resolve(0);
    return C.manifest().then(function (m) {
      var L = m.libs && Object.prototype.hasOwnProperty.call(m.libs, lib) ? m.libs[lib] : null;
      var n = 0;
      (files || []).forEach(function (f) { if (L && L.files && L.files[f]) n += L.files[f].bytes || 0; });
      return n;
    }, function () { return 0; });
  }

  /* ── ส่วน DOM ของหน้าแม่แบบ (id ขึ้นต้น cra — ดู pdf-pro.html) ──
     cfg = {lib, glue, wasm, prefix, ext, mime} · หน้าให้แค่ config + ข้อความชื่อหน้าใน dictionary ของตัวเอง */
  var TXT = {
    th: {
      ready: 'พร้อมใช้', starting: 'กำลังเปิดโปรแกรม…', saved: 'ดาวน์โหลด {name} แล้ว', unsaved: 'มีการแก้ไขที่ยังไม่ได้บันทึก',
      mb: '{got} / {total} MB', gate: 'เหมาะกับคอมพิวเตอร์ · ดาวน์โหลด {mb} MB', gateNoSize: 'เหมาะกับคอมพิวเตอร์',
      reload: 'โหลดหน้าใหม่', retry: 'ลองใหม่', go: 'เปิดต่อ', loading: 'กำลังโหลดโปรแกรม'
    },
    en: {
      ready: 'Ready', starting: 'Starting…', saved: 'Downloaded {name}', unsaved: 'Unsaved changes',
      mb: '{got} / {total} MB', gate: 'Best on a computer · {mb} MB download', gateNoSize: 'Best on a computer',
      reload: 'Reload page', retry: 'Try again', go: 'Open anyway', loading: 'Loading the app'
    }
  };

  function page(cfg) {
    var I = G.OME_I18N, L = G.OME_LANG;
    var T = I && I.scope ? I.scope('craftapp', TXT) : function (k, v) {
      return String(TXT.th[k] || '').replace(/\{(\w+)\}/g, function (m, n) { return v && v[n] != null ? v[n] : m; });
    };
    var $ = function (id) { return document.getElementById(id); };
    var over = $('craOver'), load = $('craLoad'), gate = $('craGate'), errBox = $('craErr');
    var status = $('craStatus'), openBtn = $('craOpen'), input = $('craFile');
    var lastErr = null, reloadNeeded = false, total = 0, shown = 'idle';
    function mb(n) { return (n / 1048576).toFixed(1); }
    function live(el, fn) { if (I && I.live) I.live(el, fn); else el.textContent = fn ? fn() : ''; }
    function show(which) {
      shown = which;
      over.hidden = which === 'none';
      load.hidden = which !== 'load';
      gate.hidden = which !== 'gate';
      errBox.hidden = which !== 'err';
    }

    var app = create({
      lib: cfg.lib, glue: cfg.glue, wasm: cfg.wasm, prefix: cfg.prefix, ext: cfg.ext, mime: cfg.mime,
      canvas: $(cfg.prefix),
      onState: function (s, info) {
        if (s === 'loading' || s === 'progress') {
          show('load');
          var got = info.got || 0, tot = info.total || total;
          var pct = tot ? Math.min(100, Math.round(got / tot * 100)) : 0;
          var meter = $('craLoadMeter');
          meter.firstElementChild.style.width = pct + '%';
          meter.setAttribute('aria-valuenow', String(pct));
          live($('craLoadVal'), function () { return tot ? T('mb', { got: mb(got), total: mb(tot) }) : ''; });
          live(status, null); status.textContent = '';
        } else if (s === 'starting') {
          show('none');
          live(status, function () { return T('starting'); });
        } else if (s === 'ready') {
          show('none');
          openBtn.disabled = false;
          live(status, function () { return T('ready'); });
        } else if (s === 'dirty') {
          live(status, function () { return info.dirty ? T('unsaved') : T('ready'); });
        } else if (s === 'saved') {
          live(status, function () { return T('saved', { name: info.name }); });
        } else if (s === 'error') {
          lastErr = info.err;
          reloadNeeded = !!info.reload;
          show('err');
          live($('craErrText'), function () { return G.TanotCraft ? G.TanotCraft.message(lastErr) : String(lastErr); });
          live($('craRetry').lastElementChild, function () { return reloadNeeded ? T('reload') : T('retry'); });
          live(status, null); status.textContent = '';
        }
      }
    });

    openBtn.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      input.value = '';
      if (f) app.open(f);
    });
    $('craGo').addEventListener('click', function () { app.start(); });
    $('craRetry').addEventListener('click', function () {
      if (reloadNeeded) { location.reload(); return; }
      app.start();
    });
    if (L && L.onChange) G.OME_PAGE_LIVE_LANG = true;

    sizeOf(cfg.lib, [cfg.glue, cfg.wasm]).then(function (n) {
      total = n;
      if (shown === 'gate') live($('craGateText'), function () { return n ? T('gate', { mb: mb(n) }) : T('gateNoSize'); });
    });
    if (isSmallScreen()) {
      show('gate');
      live($('craGateText'), function () { return total ? T('gate', { mb: mb(total) }) : T('gateNoSize'); });
    } else {
      app.start();
    }
    G.__craftApp = app; // ให้เทสต์/ตัวตรวจอ่านสถานะ
    return app;
  }

  return { create: create, page: page, safeName: safeName, isSmallScreen: isSmallScreen, sizeOf: sizeOf };
});
