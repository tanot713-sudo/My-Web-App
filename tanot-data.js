/* ══════════════════════════════════════════════════════════════════
   Tanot data layer (ROADMAP Phase 1) — ซิงก์ข้อมูลแบบ local-first ผ่าน /api/sync (D1)
   ใส่ใน <head> ทุกหน้าต่อจาก data-registry.js (ไม่ defer — ต้องดักจับ localStorage ก่อนสคริปต์ของหน้ารัน)

   หลักการ (หน้าเดิมไม่ต้องแก้):
   - ข้อมูลยังอยู่ที่เดิม (localStorage / IndexedDB ของหน้า) ไฟล์นี้แค่ดักจับการเขียน แล้วส่งส่วนที่เปลี่ยนขึ้นเซิร์ฟเวอร์
   - "shadow" (IndexedDB 'tanot-data') = สถานะล่าสุดที่ตรงกับเซิร์ฟเวอร์ เทียบกับค่าปัจจุบันแล้วส่งเฉพาะส่วนต่าง
     คิวรอส่ง = คีย์ที่ถูกแก้ (localStorage 'tanot-sync:dirty' เขียนทันทีแบบ synchronous ไม่หายแม้ปิดแท็บ) + ตรวจซ้ำทั้งหมดทุกครั้งที่โหลดหน้า
   - หน้าเว็บที่ถือข้อมูลเก่าไว้ในหน่วยความจำแล้วบันทึกทับ จะไม่ลบรายการที่เพิ่งมาจากเครื่องอื่น (merge 3 ทางตอน setItem
     สำหรับคีย์แบบ list/map; IndexedDB ที่ถูก clear() ทั้ง store จะคืนรายการที่มาจากเครื่องอื่นที่หน้ายังไม่เคยเห็นให้)
   - ค่าในเครื่องที่ยังไม่เคยซิงก์ถูกแทนด้วยค่าจากเครื่องอื่นเมื่อไหร่ เก็บสำเนาไว้ใน history (กู้คืนได้ที่ data.html)
   - ทำงานเฉพาะบน *.pages.dev (มี /api/*) — ที่อื่น (GitHub Pages) ไม่ดักจับอะไรเลย มีแค่ฟังก์ชัน snapshot/import
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var REG = window.TanotRegistry;
  var CFG = window.TANOT_SYNC || {};
  var ENABLED = !!REG && (CFG.enabled != null ? !!CFG.enabled : /\.pages\.dev$/.test(location.hostname));
  var ENDPOINT = CFG.endpoint || '/api/sync';
  var DIRTY_KEY = 'tanot-sync:dirty';
  var DEVICE_KEY = 'tanot-sync:device';
  var MAX_DOC = 1000 * 1000;
  var MAX_BODY = 1500 * 1000;
  var BATCH = 40;
  var HISTORY_MAX = 300;

  var LS = window.localStorage;
  var SP = Storage.prototype;
  var origGet = SP.getItem, origSet = SP.setItem, origRemove = SP.removeItem;
  function lsGet(k) { try { return origGet.call(LS, k); } catch (e) { return null; } }
  function lsSet(k, v) { origSet.call(LS, k, v); }
  function lsRemove(k) { try { origRemove.call(LS, k); } catch (e) {} }
  function lsKeys() { var out = []; try { for (var i = 0; i < LS.length; i++) out.push(LS.key(i)); } catch (e) {} return out; }

  /* ── utils ── */
  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16) + ':' + s.length;
  }
  function parse(s) { try { return JSON.parse(s); } catch (e) { return undefined; } }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function classify(k) { return REG ? REG.classify(k) : { kind: 'local' }; }

  // JSON ที่เก็บ Date/ไบนารีได้ (ไบนารีไม่ซิงก์ขึ้น D1 แต่ใช้กับ snapshot ย้าย/สำรอง)
  function b64(buf) {
    var bytes = new Uint8Array(buf), s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function unb64(s) { var bin = atob(s), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out.buffer; }
  function encodeSync(v, allowBinary) {
    if (v instanceof Date) return { $date: v.getTime() };
    if (v instanceof ArrayBuffer) { if (!allowBinary) throw new Error('binary'); return { $ab: b64(v) }; }
    if (ArrayBuffer.isView(v)) { if (!allowBinary) throw new Error('binary'); return { $ta: v.constructor.name, $ab: b64(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)) }; }
    if (typeof Blob !== 'undefined' && v instanceof Blob) throw new Error('blob');
    if (Array.isArray(v)) return v.map(function (x) { return encodeSync(x, allowBinary); });
    if (v && typeof v === 'object') {
      if (v instanceof Map || v instanceof Set) throw new Error('map/set');
      var o = {}; Object.keys(v).forEach(function (k) { o[k] = encodeSync(v[k], allowBinary); }); return o;
    }
    return v;
  }
  // Blob ต้องอ่านแบบ async — แปลงเป็น ArrayBuffer ก่อนแล้วค่อย encodeSync
  function resolveBlobs(v) {
    if (typeof Blob !== 'undefined' && v instanceof Blob) {
      return v.arrayBuffer().then(function (buf) { return { $blob: b64(buf), type: v.type || '' }; });
    }
    if (Array.isArray(v)) return Promise.all(v.map(resolveBlobs));
    if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof ArrayBuffer) && !ArrayBuffer.isView(v)) {
      var keys = Object.keys(v);
      return Promise.all(keys.map(function (k) { return resolveBlobs(v[k]); })).then(function (vals) {
        var o = {}; keys.forEach(function (k, i) { o[k] = vals[i]; }); return o;
      });
    }
    return Promise.resolve(v);
  }
  function encodeDeep(v) {
    return resolveBlobs(v).then(function (r) {
      return (function walk(x) {
        if (x && x.$blob !== undefined && Object.keys(x).length === 2) return x;
        if (x instanceof Date || x instanceof ArrayBuffer || ArrayBuffer.isView(x)) return encodeSync(x, true);
        if (Array.isArray(x)) return x.map(walk);
        if (x && typeof x === 'object') { var o = {}; Object.keys(x).forEach(function (k) { o[k] = walk(x[k]); }); return o; }
        return x;
      })(r);
    });
  }
  function decode(v) {
    if (Array.isArray(v)) return v.map(decode);
    if (v && typeof v === 'object') {
      if (typeof v.$date === 'number' && Object.keys(v).length === 1) return new Date(v.$date);
      if (typeof v.$blob === 'string') return new Blob([unb64(v.$blob)], { type: v.type || '' });
      if (typeof v.$ab === 'string') {
        var buf = unb64(v.$ab);
        if (v.$ta && typeof window[v.$ta] === 'function') return new window[v.$ta](buf);
        return buf;
      }
      var o = {}; Object.keys(v).forEach(function (k) { o[k] = decode(v[k]); }); return o;
    }
    return v;
  }

  /* ── IndexedDB helpers ── */
  function reqP(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function txDone(tx) { return new Promise(function (res, rej) { tx.oncomplete = function () { res(); }; tx.onerror = tx.onabort = function () { rej(tx.error || new Error('tx aborted')); }; }); }

  var internal = 0; // >0 = เราเขียนเอง ไม่ต้องดักจับ

  // เปิดฐานข้อมูลของหน้าโดยไม่สร้างใหม่ (ถ้าเปิดแบบไม่ระบุเวอร์ชันแล้วไม่มีอยู่ เบราว์เซอร์จะสร้างเวอร์ชัน 1 ว่างๆ — หน้าเดิมจะพัง)
  function openExisting(name) {
    return new Promise(function (resolve) {
      var r;
      try { r = indexedDB.open(name); } catch (e) { resolve(null); return; }
      var created = false;
      r.onupgradeneeded = function () { created = true; try { r.transaction.abort(); } catch (e) {} };
      r.onsuccess = function () { if (created) { r.result.close(); resolve(null); } else resolve(r.result); };
      r.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); resolve(null); };
      r.onblocked = function () { resolve(null); };
    });
  }
  function openOrCreate(spec) {
    return openExisting(spec.db).then(function (db) {
      if (db) {
        var missing = Object.keys(spec.stores).some(function (s) { return !db.objectStoreNames.contains(s); });
        if (!missing) return db;
        db.close();
        return null; // โครงสร้างไม่ตรงกับที่หน้าคาดไว้ — ไม่แตะ
      }
      return new Promise(function (resolve, reject) {
        var r = indexedDB.open(spec.db, spec.version);
        r.onupgradeneeded = function () {
          var d = r.result;
          Object.keys(spec.stores).forEach(function (s) {
            if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, spec.stores[s]);
          });
        };
        r.onsuccess = function () { resolve(r.result); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }
  function readStore(db, store) {
    var tx = db.transaction(store, 'readonly'), os = tx.objectStore(store);
    return Promise.all([reqP(os.getAllKeys()), reqP(os.getAll())]).then(function (r) {
      return r[0].map(function (k, i) { return { key: k, value: r[1][i] }; });
    });
  }

  var dataDbP = null;
  function dataDb() {
    if (!dataDbP) {
      dataDbP = new Promise(function (resolve, reject) {
        var r = indexedDB.open('tanot-data', 1);
        r.onupgradeneeded = function () {
          var d = r.result;
          var sh = d.createObjectStore('shadow', { keyPath: 'k' });
          sh.createIndex('ns', 'ns');
          d.createObjectStore('meta', { keyPath: 'k' });
          d.createObjectStore('history', { keyPath: 'n', autoIncrement: true });
          d.createObjectStore('stash', { keyPath: 'n', autoIncrement: true });
        };
        r.onsuccess = function () { resolve(r.result); };
        r.onerror = function () { reject(r.error); };
      });
    }
    return dataDbP;
  }
  function metaGet(k, dflt) {
    return dataDb().then(function (d) { return reqP(d.transaction('meta').objectStore('meta').get(k)); })
      .then(function (r) { return r ? r.v : dflt; });
  }
  function metaSet(k, v) {
    return dataDb().then(function (d) { var tx = d.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ k: k, v: v }); return txDone(tx); });
  }
  function shadowNs(ns) {
    return dataDb().then(function (d) { return reqP(d.transaction('shadow').objectStore('shadow').index('ns').getAll(ns)); })
      .then(function (rows) { var m = {}; rows.forEach(function (r) { m[r.id] = r; }); return m; });
  }
  function shadowPut(rows) {
    if (!rows.length) return Promise.resolve();
    return dataDb().then(function (d) {
      var tx = d.transaction('shadow', 'readwrite'), os = tx.objectStore('shadow');
      rows.forEach(function (r) { r.k = r.ns + '\u0000' + r.id; os.put(r); });
      return txDone(tx);
    });
  }
  function addHistory(entries) {
    if (!entries.length) return Promise.resolve();
    return dataDb().then(function (d) {
      var tx = d.transaction('history', 'readwrite'), os = tx.objectStore('history');
      entries.forEach(function (e) { os.add(e); });
      var cnt = os.count();
      cnt.onsuccess = function () {
        var extra = cnt.result - HISTORY_MAX;
        if (extra <= 0) return;
        var cur = os.openCursor();
        cur.onsuccess = function () { var c = cur.result; if (c && extra-- > 0) { c.delete(); c.continue(); } };
      };
      return txDone(tx);
    });
  }

  /* ── คีย์ localStorage → docs ── */
  function listIds(arr, idField) {
    var seen = {};
    return arr.map(function (it) {
      var base = it && typeof it === 'object' && it[idField] != null && it[idField] !== '' ? String(it[idField]) : '@' + hash(JSON.stringify(it));
      var n = seen[base] || 0; seen[base] = n + 1;
      return n ? base + '~' + n : base;
    });
  }
  function nsFor(k, rule) { return rule.mode === 'list' ? 'll:' + k : rule.mode === 'map' ? 'lm:' + k : 'ls'; }
  // คืน {id: dataString} ของค่าปัจจุบัน หรือ null ถ้ารูปแบบไม่ตรง (ไม่ซิงก์ครั้งนี้ ข้อมูลในเครื่องไม่ถูกแตะ)
  function docsOf(k, raw, rule) {
    var out = {};
    if (rule.mode === 'blob' || !rule.mode) { if (raw != null) out[k] = JSON.stringify(raw); return out; }
    if (raw == null) return out;
    var v = parse(raw);
    if (rule.mode === 'list') {
      if (!Array.isArray(v)) return null;
      var ids = listIds(v, rule.idField);
      v.forEach(function (it, i) { out[ids[i]] = JSON.stringify(it); });
      return out;
    }
    if (!isObj(v)) return null;
    Object.keys(v).forEach(function (p) { out[p] = JSON.stringify(v[p]); });
    return out;
  }
  // สร้างค่าใหม่ของคีย์จากค่าปัจจุบัน + รายการที่เปลี่ยน (changes: {id: dataString|null})
  function rebuild(k, raw, rule, changes) {
    if (rule.mode === 'blob' || !rule.mode) {
      var c = changes[k];
      return c == null ? null : JSON.parse(c);
    }
    var v = raw == null ? undefined : parse(raw);
    if (rule.mode === 'list') {
      var arr = Array.isArray(v) ? v.slice() : [];
      var ids = listIds(arr, rule.idField), done = {};
      var out = [];
      arr.forEach(function (it, i) {
        var id = ids[i];
        if (!(id in changes)) { out.push(it); return; }
        done[id] = 1;
        if (changes[id] != null) out.push(JSON.parse(changes[id]));
      });
      Object.keys(changes).forEach(function (id) { if (!done[id] && changes[id] != null) out.push(JSON.parse(changes[id])); });
      return JSON.stringify(out);
    }
    var obj = isObj(v) ? v : {};
    Object.keys(changes).forEach(function (p) { if (changes[p] == null) delete obj[p]; else obj[p] = JSON.parse(changes[p]); });
    return JSON.stringify(obj);
  }

  /* ── merge 3 ทาง: base = ค่าที่หน้าอ่าน/เขียนครั้งล่าสุด, mine = ที่หน้ากำลังเขียน, cur = ค่าในเครื่องตอนนี้ ── */
  function merge3(k, base, mine, cur, rule) {
    var db = docsOf(k, base, rule), dm = docsOf(k, mine, rule), dc = docsOf(k, cur, rule);
    if (!db || !dm || !dc) return mine;
    var changes = {};
    Object.keys(dm).forEach(function (id) { if (db[id] !== dm[id]) changes[id] = dm[id]; });       // หน้าเพิ่ม/แก้
    Object.keys(db).forEach(function (id) { if (!(id in dm)) changes[id] = null; });                // หน้าลบ
    // เริ่มจากลำดับของหน้า แล้วเติมรายการจากที่อื่นที่หน้าไม่รู้จัก
    var mineV = parse(mine);
    var result = rebuild(k, mine, rule, {});
    var extra = {};
    Object.keys(dc).forEach(function (id) {
      if (id in changes) return;
      if (!(id in db)) { extra[id] = dc[id]; return; }                 // เพิ่มจากที่อื่น
      if (dc[id] !== db[id]) extra[id] = dc[id];                       // แก้จากที่อื่น (หน้าไม่ได้แตะ)
    });
    Object.keys(db).forEach(function (id) {
      if (!(id in dc) && !(id in changes)) extra[id] = null;          // ลบจากที่อื่น (หน้าไม่ได้แตะ)
    });
    if (mineV === undefined) return mine;
    return rebuild(k, result, rule, extra);
  }

  /* ══════════════ ตัวดักจับ localStorage ══════════════ */
  var pageBase = Object.create(null);    // ค่าที่หน้านี้อ่าน/เขียนล่าสุด
  var remoteBefore = Object.create(null); // ค่าก่อนเครื่องอื่นเปลี่ยนครั้งแรกในรอบหน้านี้
  var pageRead = Object.create(null);

  // คิวอ่าน/เขียนจาก localStorage ทุกครั้ง (ไม่แคชในหน่วยความจำ) — หลายแท็บใช้คิวเดียวกัน แท็บหนึ่งต้องไม่เขียนทับ/ลบคิวของอีกแท็บ
  function dirtyMap() { var m = parse(lsGet(DIRTY_KEY) || '{}'); return isObj(m) ? m : {}; }
  function saveDirty(m) { try { lsSet(DIRTY_KEY, JSON.stringify(m)); } catch (e) {} }
  function markDirty(k) {
    var m = dirtyMap();
    m[k] = Math.max(Date.now(), (m[k] || 0) + 1); // เพิ่มขึ้นเสมอ — clearDirty จะได้รู้ว่ามีการแก้ใหม่ระหว่างส่ง
    saveDirty(m); schedule(2000);
  }
  // เอาออกจากคิวเฉพาะเมื่อไม่มีใครแก้คีย์นี้ใหม่หลังจากที่อ่าน ts ไว้
  function clearDirty(k, ts) { var m = dirtyMap(); if (k in m && m[k] === ts) { delete m[k]; saveDirty(m); } }

  if (ENABLED) {
    SP.getItem = function (k) {
      var v = origGet.apply(this, arguments);
      if (this === LS && typeof k === 'string' && classify(k).kind === 'sync') { pageBase[k] = v; pageRead[k] = 1; }
      return v;
    };
    SP.setItem = function (k, v) {
      if (this !== LS || internal) return origSet.apply(this, arguments);
      k = String(k); v = String(v);
      var rule = classify(k);
      if (rule.kind !== 'sync') return origSet.call(this, k, v);
      var cur = lsGet(k);
      var base = k in pageBase ? pageBase[k] : (k in remoteBefore ? remoteBefore[k] : cur);
      var toWrite = v;
      if (rule.mode !== 'blob' && base !== cur && cur != null) toWrite = merge3(k, base, v, cur, rule);
      origSet.call(this, k, toWrite);
      pageBase[k] = v;
      if (toWrite !== cur) markDirty(k);
    };
    SP.removeItem = function (k) {
      if (this !== LS || internal) return origRemove.apply(this, arguments);
      k = String(k);
      var had = lsGet(k) != null;
      origRemove.call(this, k);
      if (classify(k).kind === 'sync') { pageBase[k] = null; if (had) markDirty(k); }
    };
    SP.clear = (function (origClear) {
      // ไม่ส่งการลบทั้งหมดขึ้นเซิร์ฟเวอร์ (อันตรายเกิน) — ดึงข้อมูลกลับมาใหม่ในรอบถัดไปแทน
      return function () {
        var r = origClear.apply(this, arguments);
        if (this === LS && !internal) { resetRequested = true; schedule(500); }
        return r;
      };
    })(SP.clear);
  }

  /* ══════════════ ตัวดักจับ IndexedDB (store ที่ซิงก์) ══════════════ */
  var idbSeen = Object.create(null);      // 'db/store' → {idString:1} ที่หน้าอ่านเห็นแล้ว
  var txPuts = new WeakMap();
  function storeTag(os) { try { return os.transaction.db.name + '/' + os.name; } catch (e) { return ''; } }
  function osSynced(os) { var t = storeTag(os); var i = t.indexOf('/'); return i > 0 && REG.idbSynced(t.slice(0, i), t.slice(i + 1)); }
  function keyOf(os, value, fallback) {
    var kp = os.keyPath;
    if (typeof kp === 'string' && value && typeof value === 'object' && value[kp] !== undefined) return value[kp];
    return fallback;
  }

  if (ENABLED && window.IDBObjectStore) {
    var OSP = IDBObjectStore.prototype;
    ['put', 'add'].forEach(function (m) {
      var orig = OSP[m];
      OSP[m] = function (value) {
        var req = orig.apply(this, arguments);
        if (!internal && osSynced(this)) {
          var os = this, tag = storeTag(os), tx = os.transaction;
          var set = txPuts.get(tx); if (!set) { set = {}; txPuts.set(tx, set); }
          req.addEventListener('success', function () {
            var id = JSON.stringify(keyOf(os, value, req.result));
            set[tag + '|' + id] = 1;
            (idbSeen[tag] || (idbSeen[tag] = {}))[id] = 1;
          });
          markDirty('idb:' + tag);
        }
        return req;
      };
    });
    var origDel = OSP.delete;
    OSP.delete = function () {
      var req = origDel.apply(this, arguments);
      if (!internal && osSynced(this)) markDirty('idb:' + storeTag(this));
      return req;
    };
    var origGetAll = OSP.getAll;
    OSP.getAll = function () {
      var req = origGetAll.apply(this, arguments);
      if (!internal && osSynced(this)) {
        var os = this, tag = storeTag(os);
        req.addEventListener('success', function () {
          var seen = idbSeen[tag] || (idbSeen[tag] = {});
          (req.result || []).forEach(function (v) { var k = keyOf(os, v); if (k !== undefined) seen[JSON.stringify(k)] = 1; });
        });
      }
      return req;
    };
    var origClear = OSP.clear;
    OSP.clear = function () {
      if (internal || !osSynced(this)) return origClear.apply(this, arguments);
      var os = this, tag = storeTag(os), tx = os.transaction, db = tx.db, name = os.name;
      markDirty('idb:' + tag);
      // รายการที่อยู่ใน store ก่อน clear แต่หน้านี้ไม่เคยอ่านเห็น (มาจากเครื่องอื่น/แท็บอื่นหลังหน้าโหลดข้อมูลไปแล้ว)
      // → ถ้าหน้าไม่ได้ใส่กลับใน transaction เดียวกัน ให้คืนหลัง transaction จบ (หน้าจะลบได้เฉพาะรายการที่เคยเห็น)
      var before = origGetAll.call(os);
      tx.addEventListener('complete', function () {
        var set = txPuts.get(tx) || {}, seen = idbSeen[tag] || {};
        var restore = (before.result || []).filter(function (v) {
          var k = keyOf(os, v);
          if (k === undefined) return false;
          var id = JSON.stringify(k);
          return !set[tag + '|' + id] && !seen[id];
        });
        if (!restore.length) return;
        internal++;
        try {
          var t2 = db.transaction(name, 'readwrite'), o2 = t2.objectStore(name);
          restore.forEach(function (v) { o2.put(v); });
        } catch (e) {} finally { internal--; }
      });
      return origClear.apply(this, arguments);
    };
  }

  function idbDocs(spec, store) {
    return openExisting(spec.db).then(function (db) {
      if (!db) return {};
      if (!db.objectStoreNames.contains(store)) { db.close(); return {}; }
      internal++;
      var p;
      try { p = readStore(db, store); } finally { internal--; }
      return p.then(function (rows) {
        db.close();
        var out = {};
        rows.forEach(function (r) {
          try { out[JSON.stringify(r.key)] = JSON.stringify(encodeSync(r.value, false)); }
          catch (e) { /* มีไบนารี — ไม่ซิงก์รายการนี้ (ยังอยู่ในเครื่องครบ) */ }
        });
        return out;
      });
    });
  }

  /* ══════════════ รอบซิงก์ ══════════════ */
  var status = { enabled: ENABLED, state: 'idle', lastSyncAt: 0, lastError: '', pending: 0, rev: 0, device: '', skipped: [] };
  var resetRequested = false;
  var timer = null, running = null, loadedAt = Date.now();

  function emitStatus() {
    status.pending = Object.keys(dirtyMap()).length;
    try { window.dispatchEvent(new CustomEvent('tanot:sync-status', { detail: status })); } catch (e) {}
  }
  function deviceId() {
    var d = lsGet(DEVICE_KEY);
    if (!d) { d = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); try { lsSet(DEVICE_KEY, d); } catch (e) {} }
    return d;
  }
  function schedule(ms) {
    if (!ENABLED) return;
    clearTimeout(timer);
    timer = setTimeout(function () { syncNow(); }, ms);
  }
  function withLock(fn) {
    if (navigator.locks && navigator.locks.request) return navigator.locks.request('tanot-sync', fn);
    return fn();
  }

  function api(method, qs, body) {
    return fetch(ENDPOINT + (qs || ''), {
      method: method, credentials: 'same-origin', cache: 'no-store', redirect: 'manual',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (r.type === 'opaqueredirect' || r.status === 401 || r.status === 403) { var e = new Error('auth'); e.auth = true; throw e; }
      if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 200)); });
      return r.json();
    });
  }

  // target ของ ns: {type:'ls', key, rule} | {type:'idb', spec, store, tag}
  function targetOf(ns, id) {
    // โหมดของคีย์ต้องตรงกับ ns (กัน registry ต่างเวอร์ชันระหว่างเครื่องแปลงข้อมูลผิดรูป)
    if (ns === 'ls') { var rb = classify(id); return rb.mode === 'blob' ? { type: 'ls', key: id, rule: rb } : null; }
    if (ns.indexOf('ll:') === 0 || ns.indexOf('lm:') === 0) {
      var k = ns.slice(3), rl = classify(k);
      return rl.mode === (ns.charAt(1) === 'l' ? 'list' : 'map') ? { type: 'ls', key: k, rule: rl } : null;
    }
    if (ns.indexOf('idb:') === 0) {
      var t = ns.slice(4), i = t.indexOf('/'), spec = REG.idbSpec(t.slice(0, i));
      if (spec && REG.idbSynced(spec.db, t.slice(i + 1))) return { type: 'idb', spec: spec, store: t.slice(i + 1), tag: t };
    }
    return null;
  }
  function targetKey(t) { return t.type === 'ls' ? t.key : 'idb:' + t.tag; }

  function currentDocs(t) {
    if (t.type === 'ls') return Promise.resolve(docsOf(t.key, lsGet(t.key), t.rule));
    return idbDocs(t.spec, t.store);
  }
  function nsOfTarget(t) { return t.type === 'ls' ? nsFor(t.key, t.rule) : 'idb:' + t.tag; }
  function shadowFor(t) {
    var ns = nsOfTarget(t);
    return shadowNs(ns).then(function (m) {
      if (t.type === 'ls' && ns === 'ls') { var one = {}; if (m[t.key]) one[t.key] = m[t.key]; return one; }
      return m;
    });
  }

  /* นำ docs จากเซิร์ฟเวอร์ (ของ target เดียว) ลงเครื่อง */
  function applyRemote(t, docs) {
    var tkey = targetKey(t);
    return Promise.all([currentDocs(t), shadowFor(t)]).then(function (r) {
      var cur = r[0], sh = r[1];
      if (cur === null) { status.skipped.push(tkey); return false; }
      var dts = dirtyMap()[tkey] || 0;
      var changes = {}, history = [], rows = [];
      docs.forEach(function (d) {
        var old = sh[d.id];
        var remoteData = d.deleted ? undefined : d.data;
        var oldData = old && !old.deleted ? old.data : undefined;
        var local = cur[d.id];
        rows.push({ ns: d.ns, id: d.id, data: d.deleted ? null : d.data, deleted: d.deleted ? 1 : 0, rev: d.rev, updated_at: d.updated_at });
        if (local === remoteData) return;
        var localDirty = local !== oldData;
        if (localDirty && dts && dts > d.updated_at) return; // แก้ในเครื่องใหม่กว่า — เก็บไว้ รอบส่งจะส่งขึ้นไปชนะ
        if (localDirty && local !== undefined) history.push({ at: Date.now(), key: tkey, id: d.id, data: local, reason: 'replaced-by-remote' });
        changes[d.id] = remoteData === undefined ? null : remoteData;
      });
      var ids = Object.keys(changes);
      var write = ids.length ? writeTarget(t, changes) : Promise.resolve();
      return write.then(function () { return addHistory(history); })
        .then(function () { return shadowPut(rows); })
        .then(function () { return ids.length > 0; });
    });
  }

  function writeTarget(t, changes) {
    if (t.type === 'ls') {
      var raw = lsGet(t.key);
      if (!(t.key in remoteBefore)) remoteBefore[t.key] = t.key in pageBase ? pageBase[t.key] : raw;
      var next = rebuild(t.key, raw, t.rule, changes);
      internal++;
      try { if (next == null) lsRemove(t.key); else lsSet(t.key, next); }
      catch (e) { status.skipped.push(t.key); }
      finally { internal--; }
      changedKeys[t.key] = 1;
      return Promise.resolve();
    }
    return openOrCreate(t.spec).then(function (db) {
      if (!db) return;
      internal++;
      var done;
      try {
        var tx = db.transaction(t.store, 'readwrite'), os = tx.objectStore(t.store);
        Object.keys(changes).forEach(function (id) {
          var key = JSON.parse(id);
          if (changes[id] == null) { os.delete(key); return; }
          var val = decode(JSON.parse(changes[id]));
          if (typeof os.keyPath === 'string' && val && typeof val === 'object') val[os.keyPath] = key;
          os.put(val);
        });
        done = txDone(tx);
      } finally { internal--; }
      return done.then(function () { db.close(); changedKeys['idb:' + t.tag] = 1; });
    });
  }

  var changedKeys = {};

  function pull() {
    return metaGet('rev', 0).then(function (since) {
      function page(since) {
        return api('GET', '?since=' + since + '&limit=200').then(function (res) {
          if (res.max < since) { return metaSet('rev', 0).then(function () { return page(0); }); } // ฐานข้อมูลถูกรีเซ็ต
          var groups = {}, order = [];
          res.docs.forEach(function (d) {
            var t = targetOf(d.ns, d.id);
            if (!t || (t.type === 'ls' && t.rule.kind !== 'sync')) return;
            var gk = d.ns === 'ls' ? 'ls\u0000' + d.id : d.ns;
            if (!groups[gk]) { groups[gk] = { t: t, docs: [] }; order.push(gk); }
            groups[gk].docs.push(d);
          });
          return order.reduce(function (p, gk) {
            return p.then(function () { return applyRemote(groups[gk].t, groups[gk].docs); });
          }, Promise.resolve()).then(function () {
            status.rev = res.rev;
            return metaSet('rev', res.rev);
          }).then(function () { return res.more ? page(res.rev) : null; });
        });
      }
      return page(since);
    });
  }

  /* ส่งส่วนต่างของทุกคีย์ที่ถูกแก้ */
  function targetFor(tkey) { return tkey.indexOf('idb:') === 0 ? targetOf(tkey, '') : { type: 'ls', key: tkey, rule: classify(tkey) }; }
  // ต้องตรงกับ validDoc ใน functions/api/sync.js — ถ้าส่งรายการที่เซิร์ฟเวอร์ไม่รับ ทั้งชุดจะได้ 400 และซิงก์ล้มทุกรอบ จึงเก็บไว้ในเครื่องแทน
  function sendable(ns, id) { return ns.length <= 256 && id.length > 0 && id.length <= 1024; }
  function push(fullCheck) {
    return (fullCheck ? reconcile() : Promise.resolve()).then(function () {
      var dm = dirtyMap();
      var keys = Object.keys(dm);
      var out = [];
      return keys.reduce(function (p, tkey) {
        return p.then(function () {
          var t = targetFor(tkey);
          if (!t || (t.type === 'ls' && t.rule.kind !== 'sync')) { clearDirty(tkey, dm[tkey]); return; }
          return Promise.all([currentDocs(t), shadowFor(t)]).then(function (r) {
            var cur = r[0], sh = r[1], ns = nsOfTarget(t), ts = dm[tkey] || Date.now();
            if (cur === null) { status.skipped.push(tkey); return; }
            Object.keys(cur).forEach(function (id) {
              var s = sh[id];
              if (s && !s.deleted && s.data === cur[id]) return;
              if (!sendable(ns, id)) { status.skipped.push(tkey + ' ' + JSON.stringify(id)); return; }
              if (cur[id].length > MAX_DOC) { status.skipped.push(tkey + ' (ใหญ่เกิน)'); return; }
              out.push({ t: t, tkey: tkey, doc: { ns: ns, id: id, data: cur[id], updated_at: ts, deleted: 0 } });
            });
            Object.keys(sh).forEach(function (id) {
              if (!(id in cur) && !sh[id].deleted) out.push({ t: t, tkey: tkey, doc: { ns: ns, id: id, data: null, updated_at: ts, deleted: 1 } });
            });
          });
        });
      }, Promise.resolve()).then(function () { return sendAll(out); }).then(function () {
        // คีย์ที่ไม่มีส่วนต่างเหลือแล้ว → เอาออกจากคิว (ถ้าระหว่างนี้มีการแก้ใหม่ ts จะเปลี่ยน clearDirty จะไม่ลบ)
        return Promise.all(keys.map(function (tkey) {
          var t = targetFor(tkey), ts0 = dirtyMap()[tkey];
          if (!t || ts0 === undefined) return null;
          return Promise.all([currentDocs(t), shadowFor(t)]).then(function (r) {
            var cur = r[0], sh = r[1], ns = nsOfTarget(t);
            if (cur === null) return;
            var diff = Object.keys(cur).some(function (id) { return sendable(ns, id) && (!sh[id] || sh[id].deleted || sh[id].data !== cur[id]); }) ||
              Object.keys(sh).some(function (id) { return !(id in cur) && !sh[id].deleted; });
            if (!diff) clearDirty(tkey, ts0);
          });
        }));
      }).then(function () { return saveKeyState(); });
    });
  }

  function sendAll(items) {
    var batches = [], curB = [], size = 0;
    items.forEach(function (it) {
      var s = (it.doc.data ? it.doc.data.length : 0) + 200;
      if (curB.length && (curB.length >= BATCH || size + s > MAX_BODY)) { batches.push(curB); curB = []; size = 0; }
      curB.push(it); size += s;
    });
    if (curB.length) batches.push(curB);
    return batches.reduce(function (p, b) {
      return p.then(function () {
        return api('POST', '', { device: status.device, docs: b.map(function (x) { return x.doc; }) }).then(function (res) {
          var rows = [];
          res.results.forEach(function (r, i) {
            if (!r.applied) return;
            var d = b[i].doc;
            rows.push({ ns: d.ns, id: d.id, data: d.deleted ? null : d.data, deleted: d.deleted, rev: r.rev, updated_at: d.updated_at });
          });
          return shadowPut(rows).then(function () {
            if (!res.rejected || !res.rejected.length) return;
            // เซิร์ฟเวอร์มีฉบับใหม่กว่า → ใช้ฉบับนั้น (ค่าในเครื่องเก็บลง history)
            var groups = {};
            res.rejected.forEach(function (d) {
              var t = targetOf(d.ns, d.id); if (!t) return;
              (groups[d.ns + (d.ns === 'ls' ? '\u0000' + d.id : '')] = groups[d.ns + (d.ns === 'ls' ? '\u0000' + d.id : '')] || { t: t, docs: [] }).docs.push(d);
            });
            return Object.keys(groups).reduce(function (p2, g) { return p2.then(function () { return applyRemote(groups[g].t, groups[g].docs); }); }, Promise.resolve());
          });
        });
      });
    }, Promise.resolve());
  }

  /* ตรวจทุกคีย์เทียบกับครั้งล่าสุดที่ซิงก์ (จับการเขียนที่ดักไม่ได้ เช่นก่อนสคริปต์นี้โหลด / แท็บอื่น) */
  function reconcile() {
    return metaGet('keyState', null).then(function (ks) {
      var dm = dirtyMap(), now = Date.now();
      var present = {};
      lsKeys().forEach(function (k) {
        if (classify(k).kind !== 'sync') return;
        present[k] = 1;
        var h = hash(lsGet(k) || '');
        if (!ks || ks[k] !== h) { if (!dm[k]) dm[k] = ks ? now : 0; }
      });
      if (ks) {
        var gone = Object.keys(ks).filter(function (k) { return k.indexOf('idb:') !== 0 && !present[k]; });
        var known = Object.keys(ks).filter(function (k) { return k.indexOf('idb:') !== 0; }).length;
        // storage หายยกชุด ไม่ใช่ผู้ใช้ลบ (รวมกรณีหายครบทุกคีย์แม้มีไม่กี่คีย์)
        if (gone.length && (gone.length === known || (gone.length > 5 && gone.length > known / 2))) { resetRequested = true; return; }
        gone.forEach(function (k) { if (!dm[k]) dm[k] = now; });
      }
      REG.idb.forEach(function (spec) { spec.sync.forEach(function (s) { var k = 'idb:' + spec.db + '/' + s; if (!(k in dm)) dm[k] = 0; }); });
      saveDirty(dm);
    });
  }
  function saveKeyState() {
    var ks = {};
    lsKeys().forEach(function (k) { if (classify(k).kind === 'sync' && !(k in dirtyMap())) ks[k] = hash(lsGet(k) || ''); });
    return metaSet('keyState', ks);
  }
  function hardReset() {
    resetRequested = false;
    return dataDb().then(function (d) {
      var tx = d.transaction(['shadow', 'meta'], 'readwrite');
      tx.objectStore('shadow').clear(); tx.objectStore('meta').clear();
      return txDone(tx);
    });
  }

  function notify() {
    var keys = Object.keys(changedKeys);
    changedKeys = {};
    if (!keys.length) return;
    try { window.dispatchEvent(new CustomEvent('tanot:data', { detail: { keys: keys } })); } catch (e) {}
    var touched = keys.some(function (k) {
      if (pageRead[k] || k in pageBase) return true;
      if (k.indexOf('idb:') === 0) { var s = idbSeen[k.slice(4)]; return !!(s && Object.keys(s).length); }
      return false;
    });
    if (touched && !window.TANOT_NO_RELOAD_BAR) showReloadBar();
  }
  function showReloadBar() {
    if (document.getElementById('tanot-sync-bar') || !document.body) return;
    var bar = document.createElement('div');
    bar.id = 'tanot-sync-bar';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99998;display:flex;gap:10px;align-items:center;' +
      'padding:8px 10px 8px 16px;border-radius:999px;background:var(--ome-surface-2,#1B2030);color:var(--ome-text-1,#E6EAF2);' +
      'border:1px solid var(--ome-border,#2A3040);box-shadow:0 6px 20px rgba(0,0,0,.2);font:600 13px/1.4 inherit;max-width:calc(100vw - 32px)';
    var t = document.createElement('span'); t.textContent = 'มีข้อมูลใหม่จากเครื่องอื่น';
    var b = document.createElement('button'); b.type = 'button'; b.textContent = 'โหลดใหม่';
    b.style.cssText = 'border:0;border-radius:999px;padding:6px 14px;background:var(--ome-accent,#12A594);color:var(--ome-on-accent,#fff);font:inherit;cursor:pointer';
    b.addEventListener('click', function () { location.reload(); });
    bar.appendChild(t); bar.appendChild(b);
    document.body.appendChild(bar);
  }

  var firstCycle = true;
  function syncNow() {
    if (!ENABLED) return Promise.resolve(status);
    if (running) { schedule(1500); return running; }
    if (!navigator.onLine) { status.state = 'offline'; emitStatus(); return Promise.resolve(status); }
    status.device = deviceId();
    status.state = 'syncing'; status.skipped = []; emitStatus();
    var full = firstCycle;
    running = withLock(function () {
      return (resetRequested ? hardReset() : Promise.resolve())
        .then(function () { return full ? reconcile() : null; })
        .then(function () { return resetRequested ? hardReset().then(function () { return reconcile(); }) : null; })
        .then(pull)
        .then(function () { return push(false); })
        .then(function () {
          firstCycle = false;
          status.state = 'ok'; status.lastError = ''; status.lastSyncAt = Date.now();
          return metaSet('lastSyncAt', status.lastSyncAt);
        });
    }).catch(function (e) {
      status.state = e && e.auth ? 'auth' : 'error';
      status.lastError = String(e && e.message || e);
    }).then(function () {
      running = null;
      notify();
      emitStatus();
      return status;
    });
    return running;
  }

  /* ══════════════ snapshot / import (ใช้ร่วมกับ migrate + drive-backup — ทำงานทุกโดเมน) ══════════════ */
  function snapshot() {
    var ls = {};
    lsKeys().forEach(function (k) {
      var kind = classify(k).kind;
      if (kind === 'sync' || kind === 'local') ls[k] = lsGet(k);
    });
    var idb = {};
    var dbsP = (REG ? REG.idb : []).map(function (spec) {
      return openExisting(spec.db).then(function (db) {
        if (!db) return;
        var stores = Object.keys(spec.stores).filter(function (s) { return db.objectStoreNames.contains(s); });
        internal++;
        var ps;
        try { ps = stores.map(function (s) { return readStore(db, s).then(function (rows) { return [s, rows]; }); }); } finally { internal--; }
        return Promise.all(ps).then(function (res) {
          db.close();
          var out = {};
          return Promise.all(res.map(function (pair) {
            return encodeDeep(pair[1].map(function (r) { return r.value; })).then(function (vals) {
              out[pair[0]] = pair[1].map(function (r, i) { return { key: r.key, value: vals[i] }; });
            });
          })).then(function () { idb[spec.db] = out; });
        });
      });
    });
    return Promise.all(dbsP).then(function () {
      return { format: 'tanot-snapshot', v: 1, at: Date.now(), origin: location.origin, ls: ls, idb: idb };
    });
  }

  function mergeUnion(k, local, incoming, rule) {
    var dl = docsOf(k, local, rule), di = docsOf(k, incoming, rule);
    if (!dl || !di) return null;
    var add = {}, conflicts = 0;
    Object.keys(di).forEach(function (id) {
      if (!(id in dl)) add[id] = di[id];
      else if (dl[id] !== di[id]) conflicts++;
    });
    return { value: rebuild(k, local, rule, add), added: Object.keys(add).length, conflicts: conflicts };
  }

  /* แผนการนำเข้า: ไม่เขียนอะไรจนกว่าจะเรียก applyImport */
  function planImport(snap) {
    if (!snap || snap.format !== 'tanot-snapshot') return Promise.reject(new Error('ไฟล์ไม่ใช่ snapshot ของ Tanot'));
    var items = [];
    Object.keys(snap.ls || {}).forEach(function (k) {
      var rule = classify(k);
      if (rule.kind === 'cache') return;
      var inc = snap.ls[k], cur = lsGet(k);
      if (inc == null) return;
      if (cur == null) { items.push({ type: 'ls', key: k, status: 'new', value: inc }); return; }
      if (cur === inc) { items.push({ type: 'ls', key: k, status: 'same' }); return; }
      if (rule.mode === 'list' || rule.mode === 'map') {
        var m = mergeUnion(k, cur, inc, rule);
        if (m) { items.push({ type: 'ls', key: k, status: 'merge', value: m.value, added: m.added, conflicts: m.conflicts, incoming: inc }); return; }
      }
      items.push({ type: 'ls', key: k, status: 'conflict', value: inc, local: cur });
    });
    var dbs = Object.keys(snap.idb || {});
    return Promise.all(dbs.map(function (name) {
      var spec = REG.idbSpec(name);
      if (!spec) return null;
      return openExisting(name).then(function (db) {
        var stores = Object.keys(snap.idb[name]);
        return Promise.all(stores.map(function (s) {
          var existing = db && db.objectStoreNames.contains(s) ? (function () {
            internal++;
            try { return readStore(db, s); } finally { internal--; }
          })() : Promise.resolve([]);
          return existing.then(function (rows) {
            return Promise.all(rows.map(function (r) { return encodeDeep(r.value); })).then(function (vals) {
              var have = {};
              rows.forEach(function (r, i) { have[JSON.stringify(r.key)] = JSON.stringify(vals[i]); });
              snap.idb[name][s].forEach(function (rec) {
                var id = JSON.stringify(rec.key), data = JSON.stringify(rec.value);
                var st = !(id in have) ? 'new' : have[id] === data ? 'same' : 'conflict';
                items.push({ type: 'idb', db: name, store: s, key: rec.key, status: st, value: rec.value });
              });
            });
          });
        })).then(function () { if (db) db.close(); });
      });
    })).then(function () { return { at: snap.at, origin: snap.origin, items: items, snapshot: snap }; });
  }

  /* choices: {index: 'incoming'|'local'} สำหรับ conflict (ค่าเริ่มต้น = เก็บของเครื่องนี้)
     ก่อนเขียน: เก็บ snapshot ที่นำเข้า + ค่าเดิมที่จะถูกแทน ลง stash (กู้คืนได้) → เขียน → อ่านกลับมาตรวจทุกรายการ */
  function applyImport(plan, choices, source) {
    choices = choices || {};
    var todo = plan.items.map(function (it, i) {
      if (it.status === 'same') return null;
      if (it.status === 'conflict' && choices[i] !== 'incoming') return null;
      return it;
    }).filter(Boolean);
    var replaced = {};
    return snapshotReplaced(todo, replaced).then(function () {
      return dataDb().then(function (d) {
        var tx = d.transaction('stash', 'readwrite');
        tx.objectStore('stash').add({ at: Date.now(), source: source || plan.origin || '', snapshot: plan.snapshot, replaced: replaced });
        return txDone(tx);
      });
    }).then(function () {
      var failed = [];
      todo.filter(function (it) { return it.type === 'ls'; }).forEach(function (it) {
        try { LS.setItem(it.key, it.value); } catch (e) { failed.push(it.key + ': ' + (e.message || e)); }
      });
      var byStore = {};
      todo.filter(function (it) { return it.type === 'idb'; }).forEach(function (it) {
        var g = it.db + '/' + it.store; (byStore[g] = byStore[g] || []).push(it);
      });
      return Object.keys(byStore).reduce(function (p, g) {
        return p.then(function () {
          var list = byStore[g], spec = REG.idbSpec(list[0].db);
          return openOrCreate(spec).then(function (db) {
            if (!db) { failed.push(g + ': เปิดฐานข้อมูลไม่ได้'); return; }
            var tx = db.transaction(list[0].store, 'readwrite'), os = tx.objectStore(list[0].store);
            internal++;
            try {
              list.forEach(function (it) {
                var v = decode(it.value);
                if (typeof os.keyPath === 'string' && v && typeof v === 'object') v[os.keyPath] = it.key;
                if (typeof os.keyPath === 'string') os.put(v); else os.put(v, it.key);
              });
            } finally { internal--; }
            return txDone(tx).then(function () { db.close(); if (REG.idbSynced(list[0].db, list[0].store)) markDirty('idb:' + g); })
              .catch(function (e) { failed.push(g + ': ' + (e.message || e)); });
          });
        });
      }, Promise.resolve()).then(function () { return verifyImport(todo, failed); });
    });
  }
  function snapshotReplaced(todo, replaced) {
    todo.forEach(function (it) { if (it.type === 'ls') { var c = lsGet(it.key); if (c != null) replaced[it.key] = c; } });
    // ระเบียน IndexedDB ที่จะถูกเขียนทับ (conflict ที่เลือกใช้ของที่นำเข้า) — เก็บค่าเดิมด้วย ไม่ใช่แค่ localStorage
    var idbItems = todo.filter(function (it) { return it.type === 'idb' && it.status === 'conflict'; });
    return idbItems.reduce(function (p, it) {
      return p.then(function () {
        return openExisting(it.db).then(function (db) {
          if (!db) return;
          if (!db.objectStoreNames.contains(it.store)) { db.close(); return; }
          internal++;
          var r;
          try { r = reqP(db.transaction(it.store).objectStore(it.store).get(it.key)); } finally { internal--; }
          return r.then(function (v) { db.close(); return v === undefined ? null : encodeDeep(v); }).then(function (v) {
            if (v != null) replaced['idb:' + it.db + '/' + it.store + ' ' + JSON.stringify(it.key)] = v;
          });
        });
      });
    }, Promise.resolve());
  }
  function verifyImport(todo, failed) {
    var ok = 0, bad = failed.slice();
    todo.filter(function (it) { return it.type === 'ls'; }).forEach(function (it) {
      if (lsGet(it.key) === it.value) ok++;
      else if (bad.indexOf(it.key) === -1 && !bad.some(function (b) { return b.indexOf(it.key + ':') === 0; })) bad.push(it.key + ': อ่านกลับไม่ตรง');
    });
    var idbItems = todo.filter(function (it) { return it.type === 'idb'; });
    return idbItems.reduce(function (p, it) {
      return p.then(function () {
        return openExisting(it.db).then(function (db) {
          if (!db) { bad.push(it.db + ': ไม่พบฐานข้อมูล'); return; }
          internal++;
          var r;
          try { r = reqP(db.transaction(it.store).objectStore(it.store).get(it.key)); } finally { internal--; }
          return r.then(function (v) { return encodeDeep(v); }).then(function (v) {
            db.close();
            if (JSON.stringify(v) === JSON.stringify(it.value)) ok++;
            else bad.push(it.db + '/' + it.store + ' ' + JSON.stringify(it.key) + ': อ่านกลับไม่ตรง');
          });
        });
      });
    }, Promise.resolve()).then(function () { return { written: todo.length, verified: ok, failed: bad }; });
  }

  function history() {
    return dataDb().then(function (d) { return reqP(d.transaction('history').objectStore('history').getAll()); });
  }
  function restoreHistory(n) {
    return dataDb().then(function (d) { return reqP(d.transaction('history').objectStore('history').get(n)); }).then(function (h) {
      if (!h) throw new Error('ไม่พบรายการ');
      if (h.key.indexOf('idb:') === 0) {
        var t = targetOf(h.key, ''); if (!t) throw new Error('ไม่รองรับ');
        return writeTarget(t, (function () { var c = {}; c[h.id] = h.data; return c; })()).then(function () { markDirty(h.key); });
      }
      var rule = classify(h.key), raw = lsGet(h.key), c = {}; c[h.id] = h.data;
      LS.setItem(h.key, rebuild(h.key, raw, rule, c));
    });
  }

  /* ── API อ่านสำหรับหน้าที่รวบรวมข้อมูลหลายด้าน (หน้าวันนี้ / palette) ──
     อ่านผ่าน origGet + ห่อ internal++ เหมือน snapshot — ไม่นับว่า "หน้านี้เคยอ่านคีย์นั้น" จึงไม่เด้งแถบให้รีโหลดตอนข้อมูลใหม่มาจากเครื่องอื่น
     (หน้าที่ใช้ต้องฟัง onChange แล้ววาดใหม่เอง) */
  function readJSON(k, dflt) {
    var v = parse(lsGet(k));
    return v === undefined || v === null ? dflt : v;
  }
  function readRaw(k) { return lsGet(k); }
  // opts.last = อ่านเฉพาะ N ระเบียนท้ายสุด (ตามคีย์) ด้วย cursor — ใช้กับ store ที่ระเบียนใหญ่ (รายงาน/ไฟล์ 3D) ไม่ต้องดึงทั้งหมดเข้าหน่วยความจำ
  function readIdb(db, store, opts) {
    var last = opts && opts.last;
    return openExisting(db).then(function (d) {
      if (!d) return [];
      if (!d.objectStoreNames.contains(store)) { d.close(); return []; }
      var os, rows = [];
      internal++;
      try {
        os = d.transaction(store, 'readonly').objectStore(store);
        if (!last) return reqP(os.getAll()).then(function (r) { d.close(); return r || []; }, function () { d.close(); return []; });
        return new Promise(function (resolve) {
          var c = os.openCursor(null, 'prev');
          c.onsuccess = function () {
            var cur = c.result;
            if (cur && rows.length < last) { rows.push(cur.value); cur.continue(); } else { d.close(); resolve(rows); }
          };
          c.onerror = function () { d.close(); resolve(rows); };
        });
      } finally { internal--; }
    }).catch(function () { return []; });
  }
  /* อ่านค่าล่าสุด → fn แก้ → เขียนทันที (ไม่ถือค่าเก่าค้างในหน่วยความจำ) — ใช้กับโมดูลกลางที่เขียนคีย์ของตัวเองจากหลายหน้า
     (learn-core.js): ผ่าน setItem ที่ดักจับปกติ (ซิงก์/merge ครบ) แต่คืนสถานะ "หน้านี้ถือคีย์นี้" เป็นแบบก่อนเรียก
     หน้าเลยไม่เด้งแถบรีโหลดเมื่อเครื่องอื่นเพิ่มแถวในคีย์นั้น · fn คืน undefined = ไม่เขียน */
  function update(k, fn) {
    var hadBase = k in pageBase, base = pageBase[k], hadRead = !!pageRead[k];
    var next = fn(parse(lsGet(k)));
    if (next === undefined) return next;
    LS.setItem(k, JSON.stringify(next));
    if (hadBase) pageBase[k] = base; else delete pageBase[k];
    if (!hadRead) delete pageRead[k];
    return next;
  }
  // fn(keys) ถูกเรียกเมื่อข้อมูลใหม่มาจากเครื่องอื่น (tanot:data) หรือแท็บอื่นในเครื่องเดียวกันเขียน localStorage (storage) — คืนฟังก์ชันยกเลิก
  function onChange(fn) {
    function a(e) { fn((e.detail && e.detail.keys) || []); }
    function b(e) { fn(e.key ? [e.key] : []); }
    window.addEventListener('tanot:data', a);
    window.addEventListener('storage', b);
    return function () { window.removeEventListener('tanot:data', a); window.removeEventListener('storage', b); };
  }

  window.TanotData = {
    enabled: ENABLED,
    read: readJSON,
    raw: readRaw,
    update: update,
    readIdb: readIdb,
    onChange: onChange,
    status: function () { status.pending = Object.keys(dirtyMap()).length; return status; },
    syncNow: syncNow,
    snapshot: snapshot,
    planImport: planImport,
    applyImport: applyImport,
    history: history,
    restoreHistory: restoreHistory,
    _merge3: merge3, _docsOf: docsOf, _encodeDeep: encodeDeep, _decode: decode
  };

  if (ENABLED) {
    window.addEventListener('online', function () { schedule(500); });
    window.addEventListener('focus', function () { if (Date.now() - status.lastSyncAt > 15000) schedule(300); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && Object.keys(dirtyMap()).length) syncNow(); });
    setInterval(function () { if (document.visibilityState === 'visible') syncNow(); }, CFG.interval || 60000);
    schedule(CFG.initialDelay != null ? CFG.initialDelay : 1500);
    void loadedAt;
  }
})();
