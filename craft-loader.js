/* craft-loader.js — ตัวโหลดกลางของไลบรารี wasm ตระกูล *Craft (vendor/craft/, ดู CLAUDE.md "ไลบรารี wasm ตระกูล *Craft")
   ใช้ได้ทั้งหน้าเว็บและ Worker (importScripts('craft-loader.js')) · UMD: window/self.TanotCraft, require() ได้ใน test
   - ทุกไฟล์ต้องอยู่ใน vendor/craft/manifest.json (path = libs[lib].dir + '/' + file) — ไม่อยู่ = error 'missing' ไม่ fetch
   - ตรวจ sha256 ตาม manifest ทุกครั้งที่โหลด · ไม่ตรง = โหลดใหม่จากเครือข่าย 1 ครั้ง (cache:'reload' — sw.js เขียนทับแคชให้) ยังไม่ตรง = 'integrity'
   - error ทุกตัวเป็น CraftError {craft:true, code:'missing'|'integrity'|'network'|'unsupported'|'init', lib, file}
     ผู้เรียกแสดง message(err) + report(err, ctx) (problem log) — ห้ามสลับไปทางอื่นเงียบๆ
   - โหลดเฉพาะตอนเรียก (lazy) · ไม่มี SharedArrayBuffer/COOP/COEP */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TanotCraft = api;
})(typeof self !== 'undefined' ? self : this, function (G) {
  'use strict';

  var MANIFEST = 'vendor/craft/manifest.json';
  var CODES = ['missing', 'integrity', 'network', 'unsupported', 'init'];
  // ที่ตั้งของไฟล์นี้ = root ของเว็บ (หน้าอยู่ root, Worker ก็อยู่ root) — ใช้ src ของสคริปต์ถ้ามี
  var BASE = (function () {
    try {
      var cs = G.document && G.document.currentScript;
      if (cs && cs.src) return new URL('.', cs.src).href;
    } catch (e) {}
    try { return new URL('.', G.location.href).href; } catch (e) { return ''; }
  })();
  var manP = null;

  function CraftError(code, lib, file, cause) {
    var c = cause && (cause.message || String(cause));
    var e = new Error('craft:' + code + ' ' + (lib || '') + (file ? '/' + file : '') + (c ? ' — ' + c : ''));
    e.name = 'CraftError';
    e.craft = true;
    e.code = CODES.indexOf(code) >= 0 ? code : 'init';
    e.lib = lib || '';
    e.file = file || '';
    return e;
  }
  /* ส่งข้าม postMessage (Error ถูก clone แต่ฟิลด์เสริมหาย) → toMessage ฝั่ง Worker / fromMessage ฝั่งหน้า */
  function toMessage(err) {
    if (err && err.craft) return { craft: true, code: err.code, lib: err.lib, file: err.file, message: err.message };
    return { craft: false, code: 'init', message: String((err && err.message) || err) };
  }
  function fromMessage(m) {
    m = m || {};
    if (!m.craft) return new Error(m.message || 'craft');
    var e = CraftError(m.code, m.lib, m.file);
    if (m.message) e.message = m.message;
    return e;
  }

  function abs(p) { return BASE ? new URL(p, BASE).href : p; }

  function manifest() {
    if (!manP) {
      manP = fetch(abs(MANIFEST)).then(function (res) {
        if (!res.ok) throw CraftError(res.status === 404 ? 'missing' : 'network', 'manifest');
        return res.json();
      }, function (err) { throw CraftError('network', 'manifest', '', err); }).then(function (m) {
        if (!m || typeof m.libs !== 'object' || !m.libs) throw CraftError('missing', 'manifest');
        return m;
      });
      manP.catch(function () { manP = null; }); // ล้ม = ครั้งหน้าลองใหม่
    }
    return manP;
  }

  function entry(m, lib, file) {
    var own = Object.prototype.hasOwnProperty;
    var L = own.call(m.libs, lib) ? m.libs[lib] : null;
    var f = L && L.files && own.call(L.files, file) ? L.files[file] : null;
    if (!f || typeof L.dir !== 'string' || !/^[0-9a-f]{64}$/.test(f.sha256 || '')) throw CraftError('missing', lib, file);
    return { url: abs(L.dir + '/' + file), sha256: f.sha256, bytes: f.bytes || 0 };
  }
  /* URL เต็มของไฟล์ (ไม่โหลด) — สำหรับไลบรารีที่ต้องการ path เอง */
  function url(lib, file) { return manifest().then(function (m) { return entry(m, lib, file).url; }); }

  function hex(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
    return s;
  }
  function sha256(buf) {
    var sub = G.crypto && G.crypto.subtle;
    if (!sub) return Promise.reject(CraftError('unsupported', '', '', 'crypto.subtle'));
    return sub.digest('SHA-256', buf).then(hex);
  }

  /* onProgress(ได้แล้ว, ทั้งหมด) — ทั้งหมด = ขนาดใน manifest (Content-Length อาจเป็นขนาดที่บีบอัด) */
  function get(u, lib, file, reload, total, onProgress) {
    return fetch(u, reload ? { cache: 'reload' } : undefined).then(function (res) {
      if (res.status === 404 || res.status === 410) throw CraftError('missing', lib, file, 'HTTP ' + res.status);
      if (!res.ok) throw CraftError('network', lib, file, 'HTTP ' + res.status);
      if (!onProgress || !res.body || typeof res.body.getReader !== 'function') return res.arrayBuffer();
      var reader = res.body.getReader(), parts = [], got = 0;
      onProgress(0, total);
      return (function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            var out = new Uint8Array(got), at = 0;
            for (var i = 0; i < parts.length; i++) { out.set(parts[i], at); at += parts[i].length; }
            return out.buffer;
          }
          parts.push(r.value);
          got += r.value.length;
          onProgress(got, Math.max(total || 0, got));
          return pump();
        });
      })();
    }).catch(function (err) { throw err && err.craft ? err : CraftError('network', lib, file, err); });
  }

  /* ไฟล์ที่ตรวจ sha256 แล้ว → Promise<ArrayBuffer> · opts.onProgress(ได้แล้ว, ทั้งหมด) ไม่บังคับ */
  function fetchFile(lib, file, opts) {
    var onProgress = opts && typeof opts.onProgress === 'function' ? opts.onProgress : null;
    return manifest().then(function (m) {
      var e = entry(m, lib, file);
      function attempt(reload) {
        return get(e.url, lib, file, reload, e.bytes, onProgress).then(function (buf) {
          return sha256(buf).then(function (h) {
            if (h === e.sha256) return buf;
            if (!reload) return attempt(true);
            throw CraftError('integrity', lib, file);
          });
        });
      }
      return attempt(false);
    });
  }

  /* wasm ล้วน (ไม่มี glue) → Promise<{instance, module}> */
  function instantiate(lib, file, imports) {
    if (typeof WebAssembly !== 'object') return Promise.reject(CraftError('unsupported', lib, file, 'WebAssembly'));
    return fetchFile(lib, file).then(function (buf) {
      return WebAssembly.instantiate(buf, imports || {}).catch(function (err) { throw CraftError('init', lib, file, err); });
    });
  }

  /* wasm-bindgen --target no-modules ใน Worker: glue JS + wasm ที่ตรวจ sha256 แล้ว → Promise<namespace ที่ init แล้ว>
     globalName = ชื่อที่ glue ประกาศ (ค่าเริ่มต้น wasm_bindgen) · เรียกครั้งเดียวต่อ Worker */
  function bindgen(lib, glue, wasmFile, globalName) {
    globalName = globalName || 'wasm_bindgen';
    if (typeof G.importScripts !== 'function') return Promise.reject(CraftError('unsupported', lib, glue, 'worker only'));
    if (typeof WebAssembly !== 'object') return Promise.reject(CraftError('unsupported', lib, wasmFile, 'WebAssembly'));
    return Promise.all([fetchFile(lib, glue), fetchFile(lib, wasmFile)]).then(function (r) {
      var u = URL.createObjectURL(new Blob([r[0]], { type: 'text/javascript' }));
      try { G.importScripts(u); } catch (err) { throw CraftError('init', lib, glue, err); } finally { URL.revokeObjectURL(u); }
      // glue ประกาศ `let wasm_bindgen = …` ระดับบนสุด = global lexical binding ไม่ใช่ property ของ self → อ่านด้วยชื่อ
      var ns = G[globalName];
      if (typeof ns !== 'function' && /^[A-Za-z_$][\w$]*$/.test(globalName)) {
        try { ns = new Function('return typeof ' + globalName + ' === "undefined" ? undefined : ' + globalName)(); } catch (e) {}
      }
      if (typeof ns !== 'function') throw CraftError('init', lib, glue, globalName);
      return Promise.resolve().then(function () { return ns({ module_or_path: r[1] }); })
        .then(function () { return ns; }, function (err) { throw CraftError('init', lib, wasmFile, err); });
    });
  }

  /* wasm-bindgen --target web (ES module) บนหน้า: glue ที่ตรวจ sha256 แล้ว → Promise<module namespace>
     import จาก Blob URL (glue ต้องไม่มี import ภายนอก — build ไม่มี snippets) · ผู้เรียกส่ง wasm ที่ fetchFile แล้วให้ init เอง */
  function esm(lib, glue) {
    return fetchFile(lib, glue).then(function (buf) {
      var u = URL.createObjectURL(new Blob([buf], { type: 'text/javascript' }));
      // new Function: ให้ไฟล์ UMD นี้ยังพาร์สได้ในเบราว์เซอร์เก่า/Worker แบบ classic ที่ไม่รู้จัก import()
      return Promise.resolve().then(function () { return new Function('u', 'return import(u)')(u); })
        .then(function (mod) { URL.revokeObjectURL(u); return mod; },
          function (err) { URL.revokeObjectURL(u); throw CraftError('init', lib, glue, err); });
    });
  }

  var TEXT = {
    th: {
      missing: 'ไม่พบไฟล์ของเครื่องมือนี้บนเซิร์ฟเวอร์ — โหลดหน้าใหม่แล้วลองอีกครั้ง',
      integrity: 'ไฟล์ของเครื่องมือนี้เสียหายหรือไม่ครบ — โหลดหน้าใหม่แล้วลองอีกครั้ง',
      network: 'โหลดเครื่องมือนี้ไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วลองใหม่',
      unsupported: 'เบราว์เซอร์นี้ไม่รองรับเครื่องมือนี้',
      init: 'เปิดเครื่องมือนี้ไม่สำเร็จ — โหลดหน้าใหม่แล้วลองอีกครั้ง'
    },
    en: {
      missing: 'This tool’s files were not found on the server — reload the page and try again',
      integrity: 'This tool’s files are damaged or incomplete — reload the page and try again',
      network: 'Could not load this tool — check your connection and try again',
      unsupported: 'This browser does not support this tool',
      init: 'Could not start this tool — reload the page and try again'
    }
  };
  /* ข้อความสำหรับผู้ใช้ (ไทย/อังกฤษตาม OME_LANG) */
  function message(err, lang) {
    if (!lang) { try { lang = G.OME_LANG && G.OME_LANG.get(); } catch (e) {} }
    var d = TEXT[lang === 'en' ? 'en' : 'th'];
    return d[(err && err.craft && err.code) || 'init'] || d.init;
  }
  /* problem log (tanot:media:log) — ชื่อไลบรารี/ไฟล์ของเราเท่านั้น ห้ามส่งชื่อไฟล์/เนื้อหาของผู้ใช้มาใน ctx */
  function report(err, ctx) {
    ctx = ctx || {};
    var M = G.TanotMedia;
    if (!M || typeof M.logError !== 'function') return null;
    var e = err && err.craft ? err : CraftError('init', ctx.lib, '', err);
    try {
      return M.logError('craft', e, { stage: ctx.stage || e.code, engine: 'local', model: e.lib + (e.file ? '/' + e.file : '') });
    } catch (x) { return null; }
  }

  return {
    MANIFEST: MANIFEST, manifest: manifest, url: url, fetchFile: fetchFile, instantiate: instantiate, bindgen: bindgen, esm: esm,
    CraftError: CraftError, toMessage: toMessage, fromMessage: fromMessage, message: message, report: report, sha256: sha256
  };
});
