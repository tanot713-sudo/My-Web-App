/* craft-app.js — แม่แบบหน้า "โปรแกรมเต็ม" ของตระกูล *Craft (PdfCraft ใน pdf-pro.html; CADCraft ฯลฯ ใช้ต่อได้)
   แอป egui/eframe (wasm-bindgen --target web) รันใน <iframe> origin เดียวกัน (craft-frame.html?id=<prefix>&host=parent)
   ด้วย bridge "?host=parent" ของต้นฉบับ (PdfCraft 0.9.0 apps/pdfcraft-web/src/main.rs mod host) — postMessage:
     แอป → หน้า: <prefix>:ready · <prefix>:save {name, saveAs, bytes} · <prefix>:dirty {dirty} · <prefix>:failed {error}
     หน้า → แอป: <prefix>:open {name, bytes}
   หน้านี้โหลด glue + wasm เอง (ตรวจ sha256, แถบ MB) แล้วส่งให้ iframe ด้วย craft:boot — iframe ไม่ fetch ไฟล์ของแอปเอง
   (แอปรุ่นหลังมีโหมด data-host="page" ไม่ต้องใช้ iframe — เปลี่ยนเมื่ออัปรุ่นแล้วทดสอบใหม่)
   - ไฟล์ผู้ใช้อยู่ในเครื่องเท่านั้น: เปิด = อ่านจาก <input type=file> ส่งเข้าแอป · บันทึก = ดาวน์โหลดไฟล์ ไม่มีการส่งขึ้นเซิร์ฟเวอร์
   - glue + wasm โหลดผ่าน craft-loader.js (ตรวจ sha256 ตาม manifest, แคช tanot-craft-v1 ใน sw.js) · โหลดเมื่อเรียก start() เท่านั้น
   - ล้ม = state 'error' (หน้าแสดง TanotCraft.message + ลองใหม่) + TanotCraft.report — ไม่มีทางสำรองเงียบๆ
   - eframe รันได้ครั้งเดียวต่อเอกสาร: ส่ง craft:boot แล้วล้ม → ต้องโหลดหน้าใหม่ (reload:true ใน info)
   UMD: window.TanotCraftApp · ใช้: TanotCraftApp.page({lib, glue, wasm, prefix, ext, mime}) หรือ create({…, frame, onState})
   ตัวเลือกเพิ่ม (ไม่ใส่ = แบบ pdf-pro เดิม):
   - canvas: id ของ canvas ที่แอปหา (CADCraft = 'cadcraft_canvas'; ไม่ใส่ = prefix)
   - prefs:false = ไม่เขียนธีม/ภาษาลงค่าที่แอปบันทึกเองตอนเริ่ม · liveTheme:true = ตั้งธีมผ่าน window.<prefix>.execute('ui.theme')
     ตอนพร้อมและทุกครั้งที่เว็บสลับสว่าง/มืด (craft-web-api ของแอป — ไม่มี API = เมินเงียบๆ)
   - mimes: {'.ext': mime} ของไฟล์ที่แอปบันทึก/ส่งออก (ไม่ตรง = mime)
   - recent:true = "ล่าสุด" 10 ไฟล์ต่อแอปใน IndexedDB tanot-craft-recent (เฉพาะเครื่องนี้, ภาพย่อจาก window.<prefix>.screenshot)
   - phoneMax (700) / tabletMax (ไม่ใส่ = ไม่มีช่วงแท็บเล็ต) / simple: {href} = ปุ่มไปหน้าแบบง่ายบนมือถือ */
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

  function libOf(m, lib) {
    return m && m.libs && Object.prototype.hasOwnProperty.call(m.libs, lib) ? m.libs[lib] : null;
  }
  /* wasm ของแอป: ไฟล์เดียว หรือแบ่งหลายส่วน (manifest libs[lib].wasm = {parts, sha256, bytes} — Cloudflare Pages
     รับไฟล์ละ ≤ 25 MiB) · แต่ละส่วนตรวจ sha256 ใน fetchFile แล้วต่อกันตามลำดับ + ตรวจ sha256 ของทั้งก้อนอีกชั้น
     → Promise<ArrayBuffer> · onProgress(ได้แล้ว, ทั้งหมด) ของทั้งก้อน */
  function loadWasm(lib, file, onProgress) {
    var C = G.TanotCraft;
    return C.manifest().then(function (m) {
      var L = libOf(m, lib), W = L && L.wasm;
      if (!W || !W.parts || !W.parts.length) return C.fetchFile(lib, file, { onProgress: onProgress });
      if (!/^[0-9a-f]{64}$/.test(W.sha256 || '')) throw C.CraftError('missing', lib, file);
      var total = W.bytes || 0, done = 0, bufs = [];
      return W.parts.reduce(function (p, part) {
        return p.then(function () {
          return C.fetchFile(lib, part, { onProgress: function (got) { onProgress(done + got, Math.max(total, done + got)); } }).then(function (b) {
            bufs.push(b);
            done += b.byteLength;
          });
        });
      }, Promise.resolve()).then(function () {
        var out = new Uint8Array(done), at = 0;
        bufs.forEach(function (b) { out.set(new Uint8Array(b), at); at += b.byteLength; });
        bufs = null;
        return C.sha256(out.buffer).then(function (h) {
          if (h !== W.sha256) throw C.CraftError('integrity', lib, file);
          return out.buffer;
        });
      });
    });
  }

  /* ── ไฟล์ล่าสุด (IndexedDB tanot-craft-recent, store files keyPath id = '<prefix>|<ชื่อ>') ──
     data-registry.js: ย้าย/สำรองเท่านั้น ไม่ซิงก์ · ไฟล์ใหญ่กว่า RECENT_MAX_BYTES ไม่เก็บ (shortcut: เพดานคงที่, ถ้าเจ้าของใช้แบบใหญ่กว่านี้ค่อยเพิ่ม) */
  var RECENT_DB = 'tanot-craft-recent', RECENT_KEEP = 10, RECENT_MAX_BYTES = 15 * 1048576;
  function recentDb() {
    return new Promise(function (resolve, reject) {
      if (!G.indexedDB) { reject(new Error('idb')); return; }
      var rq = G.indexedDB.open(RECENT_DB, 1);
      rq.onupgradeneeded = function () { if (!rq.result.objectStoreNames.contains('files')) rq.result.createObjectStore('files', { keyPath: 'id' }); };
      rq.onsuccess = function () { resolve(rq.result); };
      rq.onerror = function () { reject(rq.error); };
    });
  }
  function recentTx(mode, fn) {
    return recentDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('files', mode), st = tx.objectStore('files'), out;
        out = fn(st);
        tx.oncomplete = function () { db.close(); resolve(out && out.result !== undefined ? out.result : out); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error); };
      });
    });
  }
  function recentList(app) {
    return recentTx('readonly', function (st) { return st.getAll(); }).then(function (all) {
      return (all || []).filter(function (r) { return r && r.app === app; }).sort(function (a, b) { return b.at - a.at; });
    });
  }
  function recentPut(app, name, bytes, thumb) {
    if (!bytes || bytes.byteLength > RECENT_MAX_BYTES) return Promise.resolve();
    var id = app + '|' + name;
    return recentList(app).then(function (list) {
      var old = list.filter(function (r) { return r.id === id; })[0];
      var drop = list.filter(function (r) { return r.id !== id; }).slice(RECENT_KEEP - 1);
      return recentTx('readwrite', function (st) {
        st.put({ id: id, app: app, name: name, at: Date.now(), size: bytes.byteLength, bytes: bytes.slice(0), thumb: thumb || (old && old.thumb) || '' });
        drop.forEach(function (r) { st.delete(r.id); });
      });
    });
  }
  function recentThumb(app, name, thumb) {
    var id = app + '|' + name;
    return recentTx('readwrite', function (st) {
      var g = st.get(id);
      g.onsuccess = function () { if (g.result) { g.result.thumb = thumb; st.put(g.result); } };
    });
  }
  function recentDelete(id) { return recentTx('readwrite', function (st) { st.delete(id); }); }

  /* ภาพย่อ ~320px JPEG จาก PNG base64 ของ screenshot() */
  function shrinkPng(b64) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = 320, h = Math.max(1, Math.round(img.height * w / Math.max(1, img.width)));
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try { resolve(c.toDataURL('image/jpeg', 0.7)); } catch (e) { resolve(''); }
      };
      img.onerror = function () { resolve(''); };
      img.src = 'data:image/png;base64,' + b64;
    });
  }

  var FRAME = 'craft-frame.html';

  function create(o) {
    var C = G.TanotCraft;
    var frame = o.frame;
    var prefix = o.prefix;
    var ext = o.ext || '';
    var mime = o.mime || 'application/octet-stream';
    var emit = typeof o.onState === 'function' ? o.onState : function () {};
    var mimes = o.mimes || {};
    function mimeOf(name) {
      var m = /\.[A-Za-z0-9]{1,8}$/.exec(name);
      return (m && mimes[m[0].toLowerCase()]) || mime;
    }
    /* window.<prefix> ของแอปใน iframe (craft-web-api) — ไม่มี = null */
    function appApi() {
      try { var a = frame.contentWindow && frame.contentWindow[prefix]; return a && typeof a.execute === 'function' ? a : null; } catch (e) { return null; }
    }
    function isDark() {
      return G.OmeTheme && typeof G.OmeTheme.get === 'function' ? G.OmeTheme.get('theme') === 'dark' : document.documentElement.getAttribute('data-theme') === 'dark';
    }
    function pushTheme() {
      var a = o.liveTheme && ready && appApi();
      if (!a) return;
      try { Promise.resolve(a.execute('ui.theme', { theme: isDark() ? 'dark' : 'light' })).catch(function () {}); } catch (e) {}
    }
    if (o.liveTheme && G.OmeTheme && typeof G.OmeTheme.onChange === 'function') G.OmeTheme.onChange(pushTheme);
    /* ภาพย่อของไฟล์ล่าสุด: ขอภาพจอจากแอป (ไม่มี screenshot() = ไม่มีภาพย่อ) */
    function snapThumb(name, delay) {
      if (!o.recent) return;
      setTimeout(function () {
        var a = appApi();
        if (!a || typeof a.screenshot !== 'function') return;
        Promise.resolve(a.screenshot()).then(function (r) {
          return r && typeof r.data === 'string' ? shrinkPng(r.data) : '';
        }).then(function (t) { if (t) return recentThumb(prefix, name, t).then(function () { emit('recent', {}); }); }).catch(function () {});
      }, delay);
    }
    function remember(name, bytes) {
      if (!o.recent) return;
      recentPut(prefix, name, bytes).then(function () { emit('recent', {}); }, function () {});
    }
    var origin = G.location.origin;
    var state = 'idle';
    var ready = false;
    var dirty = false;
    var started = false; // ส่ง glue + wasm ให้ iframe แล้ว (eframe เริ่มได้ครั้งเดียวต่อเอกสาร — ลองใหม่ = โหลดหน้าใหม่)
    var queue = [];
    var frameReady = null;
    var frameLoaded = null;

    function set(s, info) { state = s; emit(s, info || {}); }
    function fail(err, stage) {
      var e = err && err.craft ? err : (C ? C.CraftError('init', o.lib, '', err) : err);
      if (C) C.report(e, { lib: o.lib, stage: stage });
      set('error', { err: e, reload: started });
    }
    function post(msg, transfer) { frame.contentWindow.postMessage(msg, origin, transfer || []); }

    // ฟังเฉพาะ iframe ของเราเอง บน origin เดียวกัน (bridge ?host=parent ของต้นฉบับก็ตอบเฉพาะ parent origin เดียวกัน)
    G.addEventListener('message', function (ev) {
      if (ev.origin !== origin || !frame.contentWindow || ev.source !== frame.contentWindow) return;
      var d = ev.data || {};
      if (d.type === 'craft:frame-ready') { if (frameLoaded) frameLoaded(); return; }
      if (d.type === 'craft:boot-failed') { fail(C ? C.CraftError('init', o.lib, o.wasm) : new Error('boot'), 'init'); return; }
      if (d.type === prefix + ':ready') {
        ready = true;
        set('ready');
        pushTheme();
        var q = queue; queue = [];
        q.forEach(send);
      } else if (d.type === prefix + ':save') {
        if (!d.bytes) return;
        var name = safeName(d.name, ext);
        // ไฟล์งานของแอป (ext) เก็บเป็นไฟล์ล่าสุดด้วย — ไฟล์ส่งออกอื่น (pdf/png/svg) ไม่เก็บ
        if (ext && name.toLowerCase().slice(-ext.length) === ext) { remember(name, d.bytes); snapThumb(name, 0); }
        download(d.bytes, name, mimeOf(name));
        emit('saved', { name: name });
      } else if (d.type === prefix + ':dirty') {
        dirty = !!d.dirty;
        emit('dirty', { dirty: dirty });
      } else if (d.type === prefix + ':failed') {
        // d.error เป็นข้อความเทคนิคของแอป (เช่นไม่มี WebGL) — ไม่ลง log ทั้งก้อน เก็บแค่รหัส
        fail(C ? C.CraftError('unsupported', o.lib, '') : new Error('failed'), 'app-failed');
      }
    });
    G.addEventListener('beforeunload', function (e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });

    function send(f) {
      remember(f.name, f.bytes);
      snapThumb(f.name, 1500);
      post({ type: prefix + ':open', name: f.name, bytes: f.bytes }, [f.bytes]);
      try { frame.focus(); } catch (e) {}
    }

    /* iframe ว่าง (craft-frame.html) — ตั้ง src ตอนเริ่มเท่านั้น (มือถือ/หน้าที่ยังไม่กดเปิดต่อไม่โหลดอะไร) */
    function loadFrame() {
      if (!frameReady) {
        frameReady = new Promise(function (resolve) { frameLoaded = resolve; });
        frame.src = FRAME + '?id=' + encodeURIComponent(prefix) + '&host=parent' + (o.canvas ? '&canvas=' + encodeURIComponent(o.canvas) : '');
      }
      return frameReady;
    }

    function start() {
      if (started || state === 'loading') return;
      if (!C) { fail(new Error('craft-loader'), 'loader'); return; }
      if (typeof WebAssembly !== 'object') { fail(C.CraftError('unsupported', o.lib, o.wasm, 'WebAssembly'), 'unsupported'); return; }
      set('loading', { got: 0, total: 0 });
      Promise.all([
        C.fetchFile(o.lib, o.glue),
        loadWasm(o.lib, o.wasm, function (got, total) { if (!started) emit('progress', { got: got, total: total }); }),
        loadFrame()
      ]).then(function (r) {
        started = true;
        set('starting');
        var lang = 'th';
        try { lang = G.OME_LANG && G.OME_LANG.get() === 'en' ? 'en' : 'th'; } catch (e) {}
        post({ type: 'craft:boot', glue: r[0], wasm: r[1], theme: isDark() ? 'Dark' : 'Light', lang: lang, prefs: o.prefs !== false }, [r[0], r[1]]);
      }).catch(function (err) { fail(err, 'load'); });
    }

    /* เปิดไฟล์ของผู้ใช้ (File จาก input/ลากวาง) — ยังไม่พร้อม = เข้าคิวรอ ready */
    function open(file) {
      if (!file) return Promise.resolve();
      return file.arrayBuffer().then(function (bytes) { openBytes(file.name, bytes); });
    }
    /* เปิดจากไบต์ (ไฟล์ล่าสุด) — ส่งสำเนา เพราะ postMessage โอน ArrayBuffer ไปแล้วใช้ซ้ำไม่ได้ */
    function openBytes(name, bytes) {
      var f = { name: String(name || '').slice(0, MAX_NAME) || 'document', bytes: bytes.slice(0) };
      if (ready) send(f); else { queue.push(f); start(); }
    }

    return {
      start: start,
      open: open,
      openBytes: openBytes,
      recent: function () { return o.recent ? recentList(prefix) : Promise.resolve([]); },
      forget: function (id) { return recentDelete(id).then(function () { emit('recent', {}); }); },
      hasQueue: function () { return queue.length > 0; },
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
      var L = libOf(m, lib), W = L && L.wasm;
      var n = 0;
      (files || []).forEach(function (f) {
        if (W && W.parts && W.parts.length && /\.wasm$/.test(f)) n += W.bytes || 0;
        else if (L && L.files && L.files[f]) n += L.files[f].bytes || 0;
      });
      return n;
    }, function () { return 0; });
  }

  /* ── ส่วน DOM ของหน้าแม่แบบ (id ขึ้นต้น cra — ดู pdf-pro.html) ──
     cfg = {lib, glue, wasm, prefix, ext, mime, …ตัวเลือกของ create} · หน้าให้แค่ config + ข้อความชื่อหน้าใน dictionary ของตัวเอง
     ส่วนที่มีเฉพาะบางหน้า (ไม่มี element = ข้าม): #craSimple (ลิงก์หน้าแบบง่ายบนมือถือ), #craGateHint (หมุนจอ),
     #craRecentBtn + <dialog #craRecent> (ไฟล์ล่าสุด), #craFull (เต็มจอ: Fullscreen API บน .cra-stage — ไม่รองรับ = ซ่อนปุ่ม, Esc ออก) */
  var TXT = {
    th: {
      ready: 'พร้อมใช้', starting: 'กำลังเปิดโปรแกรม…', saved: 'ดาวน์โหลด {name} แล้ว', unsaved: 'มีการแก้ไขที่ยังไม่ได้บันทึก',
      mb: '{got} / {total} MB', gate: 'เหมาะกับคอมพิวเตอร์ · ดาวน์โหลด {mb} MB', gateNoSize: 'เหมาะกับคอมพิวเตอร์',
      reload: 'โหลดหน้าใหม่', retry: 'ลองใหม่', go: 'เปิดต่อ', loading: 'กำลังโหลดโปรแกรม',
      goFull: 'เปิดโปรแกรมเต็มต่อ ({mb} MB)', rotate: 'หมุนจอเป็นแนวนอนจะใช้ง่ายกว่า',
      full: 'เต็มจอ', fullExit: 'ออกจากเต็มจอ',
      recent: 'ล่าสุด', recentEmpty: 'ยังไม่มีไฟล์', open: 'เปิด', del: 'ลบ {name} ออกจากรายการ', close: 'ปิด'
    },
    en: {
      ready: 'Ready', starting: 'Starting…', saved: 'Downloaded {name}', unsaved: 'Unsaved changes',
      mb: '{got} / {total} MB', gate: 'Best on a computer · {mb} MB download', gateNoSize: 'Best on a computer',
      reload: 'Reload page', retry: 'Try again', go: 'Open anyway', loading: 'Loading the app',
      goFull: 'Open the full app ({mb} MB)', rotate: 'Turn the screen sideways for more room',
      full: 'Full screen', fullExit: 'Exit full screen',
      recent: 'Recent', recentEmpty: 'No files yet', open: 'Open', del: 'Remove {name} from the list', close: 'Close'
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

    var recentDlg = $('craRecent'), recentBtn = $('craRecentBtn'), recentShown = false, opened = false;
    var app = create({
      lib: cfg.lib, glue: cfg.glue, wasm: cfg.wasm, prefix: cfg.prefix, ext: cfg.ext, mime: cfg.mime,
      canvas: cfg.canvas, prefs: cfg.prefs, liveTheme: cfg.liveTheme, mimes: cfg.mimes, recent: !!(cfg.recent && recentDlg),
      frame: $('craFrame'),
      onState: function (s, info) {
        if (s === 'recent') { if (recentDlg && recentDlg.open) drawRecent(); return; }
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
          if (recentBtn && recentDlg) { recentBtn.hidden = false; recentBtn.disabled = false; }
          if (fullBtn && canFs) fullBtn.hidden = false; // ปุ่มเต็มจอแสดงเมื่อแอปพร้อม (ก่อนนั้นไม่มีอะไรให้ขยาย)
          live(status, function () { return T('ready'); });
          // หน้าเริ่ม: มีไฟล์ล่าสุดและยังไม่ได้เปิดไฟล์ใด = แสดงรายการครั้งเดียว
          if (recentDlg && !opened && !app.hasQueue() && !recentShown) {
            app.recent().then(function (l) { if (l.length && !opened && !recentShown) openRecent(); }, function () {});
          }
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

    function openFile(f) { opened = true; return app.open(f); }
    openBtn.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      input.value = '';
      if (f) openFile(f);
    });
    // ลากไฟล์มาวางบนหน้า (นอก iframe — ในแอปเองแอปรับไฟล์ที่วางได้อยู่แล้ว)
    document.addEventListener('dragover', function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1) e.preventDefault();
    });
    document.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      if (recentDlg && recentDlg.open) recentDlg.close();
      openFile(f);
    });

    /* ไฟล์ล่าสุด: <dialog class="dialog"> รายการ (ภาพย่อ ชื่อ วันที่) + เปิด/ลบ */
    function fmtDate(ms) {
      try { return I && I.date ? I.date(new Date(ms), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : new Date(ms).toLocaleString(); } catch (e) { return ''; }
    }
    function drawRecent() {
      var list = $('craRecentList');
      app.recent().then(function (rows) {
        list.textContent = '';
        $('craRecentEmpty').hidden = rows.length > 0;
        rows.forEach(function (r) {
          var li = document.createElement('li');
          li.className = 'list-row cra-rec';
          var th = document.createElement(r.thumb ? 'img' : 'span');
          th.className = 'cra-thumb';
          if (r.thumb && /^data:image\/jpeg;base64,/.test(r.thumb)) { th.src = r.thumb; th.alt = ''; }
          var body = document.createElement('span');
          body.className = 'cra-rec-body';
          var nm = document.createElement('span'); nm.className = 'cra-rec-name'; nm.textContent = r.name; nm.setAttribute('data-i18n-skip', '');
          var dt = document.createElement('span'); dt.className = 'cra-rec-meta'; dt.textContent = fmtDate(r.at) + ' · ' + (r.size / 1048576).toFixed(1) + ' MB';
          body.appendChild(nm); body.appendChild(dt);
          var go = document.createElement('button');
          go.type = 'button'; go.className = 'btn sm'; go.textContent = T('open');
          go.addEventListener('click', function () { opened = true; recentDlg.close(); app.openBytes(r.name, r.bytes); });
          var del = document.createElement('button');
          del.type = 'button'; del.className = 'btn sm ghost icon';
          del.setAttribute('aria-label', T('del', { name: r.name }));
          del.innerHTML = '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-trash-2"/></svg>';
          del.addEventListener('click', function () { app.forget(r.id); });
          li.appendChild(th); li.appendChild(body); li.appendChild(go); li.appendChild(del);
          list.appendChild(li);
        });
      }, function () { list.textContent = ''; $('craRecentEmpty').hidden = false; });
    }
    function openRecent() {
      recentShown = true;
      drawRecent();
      if (!recentDlg.open) recentDlg.showModal();
    }
    if (recentDlg && recentBtn) {
      recentBtn.addEventListener('click', openRecent);
      $('craRecentClose').addEventListener('click', function () { recentDlg.close(); });
      recentDlg.addEventListener('click', function (e) { if (e.target === recentDlg) recentDlg.close(); });
      if (L && L.onChange) L.onChange(function () { if (recentDlg.open) drawRecent(); });
    }
    $('craGo').addEventListener('click', function () { app.start(); });
    $('craRetry').addEventListener('click', function () {
      if (reloadNeeded) { location.reload(); return; }
      app.start();
    });
    if (L && L.onChange) G.OME_PAGE_LIVE_LANG = true;

    // เต็มจอ: ขยาย .cra-stage (iframe ของแอป) ทั้งจอ — ไม่มีแถบเมนูของเว็บ
    var fullBtn = $('craFull'), stage = document.querySelector('.cra-stage');
    var fsEl = function () { return document.fullscreenElement || document.webkitFullscreenElement || null; };
    var canFs = !!(stage && (document.fullscreenEnabled || document.webkitFullscreenEnabled));
    function drawFull() {
      if (!fullBtn) return;
      var on = fsEl() === stage;
      fullBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      fullBtn.querySelector('use').setAttribute('href', 'icons.svg#i-' + (on ? 'minimize-2' : 'maximize-2'));
      live(fullBtn.querySelector('span'), function () { return on ? T('fullExit') : T('full'); });
    }
    if (fullBtn && canFs) {
      drawFull();
      fullBtn.addEventListener('click', function () {
        if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
        var rq = stage.requestFullscreen || stage.webkitRequestFullscreen;
        Promise.resolve(rq.call(stage)).then(function () { try { $('craFrame').focus(); } catch (e) {} }, function () {});
      });
      document.addEventListener('fullscreenchange', drawFull);
      document.addEventListener('webkitfullscreenchange', drawFull);
    }

    // ขนาดจอ: ≤ phoneMax (700) = ไม่โหลดเอง (+ ลิงก์หน้าแบบง่ายถ้ามี) · ≤ tabletMax = บอก MB + กดเปิดต่อ (+ แนะนำหมุนจอถ้าแนวตั้ง)
    var phone = cfg.phoneMax ? mq('(max-width: ' + cfg.phoneMax + 'px)') : isSmallScreen();
    var tablet = !phone && cfg.tabletMax && mq('(max-width: ' + cfg.tabletMax + 'px)');
    function mq(q) { try { return G.matchMedia(q).matches; } catch (e) { return false; } }
    var simple = $('craSimple'), hint = $('craGateHint');
    function gateText() {
      live($('craGateText'), function () { return total ? T('gate', { mb: mb(total) }) : T('gateNoSize'); });
      // มีลิงก์หน้าแบบง่าย = ปุ่มเปิดต่อบอกขนาดในตัว
      if (simple) live($('craGo'), function () { return phone && total ? T('goFull', { mb: mb(total) }) : T('go'); });
    }
    sizeOf(cfg.lib, [cfg.glue, cfg.wasm]).then(function (n) {
      total = n;
      if (shown === 'gate') gateText();
    });
    if (phone || tablet) {
      show('gate');
      if (simple && phone) simple.hidden = false;
      else $('craGo').classList.add('primary');
      if (hint && tablet && mq('(orientation: portrait)')) { hint.hidden = false; live(hint, function () { return T('rotate'); }); }
      gateText();
    } else {
      app.start();
    }
    G.__craftApp = app; // ให้เทสต์/ตัวตรวจอ่านสถานะ
    return app;
  }

  return { create: create, page: page, safeName: safeName, isSmallScreen: isSmallScreen, sizeOf: sizeOf };
});
