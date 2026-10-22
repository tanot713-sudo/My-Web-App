/* ══════════════════════════════════════════════════════════════════
   Tanot — คำนวณสูตรที่ไฟล์ .xlsx ไม่ได้เก็บค่าไว้ (window.TanotXlsxRecalc) · ใช้ใน compare.js
   ไฟล์ที่ openpyxl/SheetJS เขียนมีสูตรแต่ไม่มีค่าแคช (<v/> ว่างหรือไม่มี <v>) — SheetJS 0.18.5 ทิ้งเซลล์พวกนี้ทั้งเซลล์
   จึงนับจาก XML ของชีตเอง (wb.files จาก X.read(…, {bookFiles:true})) ไม่ใช่จาก wb.Sheets
   ไม่มีเซลล์แบบนี้ = ไม่โหลด wasm · มี = ส่งไฟล์ให้ xlsx-recalc-worker.js (GridCraft, vendor/gridcraft/) ใน Worker เสมอ
   แล้วเติมค่า "เฉพาะเซลล์ที่ SheetJS ไม่มีค่า" (dense) — ไม่ทับค่าที่มี ไม่เขียนไฟล์ใหม่ ไม่มีข้อมูลออกจากเครื่อง
   ค่าที่ได้เป็นค่าดิบ (ตัวเลข/ข้อความ/บูลีน/error) — ไม่ใช้ข้อความที่จัดรูปจาก GridCraft (ไม่รู้ปี พ.ศ./[$-th-TH]);
   ตัวเลขในเซลล์รูปแบบวันที่แปลงเป็น Date ด้วย SheetJS เอง (X.SSF) ให้เหมือนเซลล์ที่มีค่าแคชตอนอ่านด้วย cellDates
   ฟังก์ชันล้วน (scanSheet/sheetPaths/missingCells/apply) require() ได้ใน test
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TanotXlsxRecalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WORKER_URL = 'xlsx-recalc-worker.js';
  var TIMEOUT_MS = 90000;
  // รหัส error ของ SheetJS (cell.t === 'e' เก็บ v เป็นตัวเลข)
  var ERR = { '#NULL!': 0x00, '#DIV/0!': 0x07, '#VALUE!': 0x0F, '#REF!': 0x17, '#NAME?': 0x1D, '#NUM!': 0x24, '#N/A': 0x2A, '#GETTING_DATA': 0x2B };

  function text(c) {
    if (c == null) return null;
    if (typeof c === 'string') return c;
    return new TextDecoder('utf-8').decode(c instanceof Uint8Array ? c : new Uint8Array(c));
  }
  function unxml(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (m, e) {
      var k = e.toLowerCase();
      if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[k];
    });
  }
  function attr(tag, name) {
    var m = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')').exec(tag);
    return m ? unxml(m[1] != null ? m[1] : m[2]) : null;
  }
  function resolve(base, target) {
    var out = target[0] === '/' ? [] : base.split('/').slice(0, -1);
    target.split('/').forEach(function (p) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); });
    return out.join('/');
  }
  function rels(xml, base) { // Id → {type, path}
    var map = {}, re = /<(?:\w+:)?Relationship\b([^>]*)>/g, m;
    while ((m = re.exec(xml || ''))) {
      var id = attr(m[1], 'Id'), t = attr(m[1], 'Target');
      if (id && t && attr(m[1], 'TargetMode') !== 'External') map[id] = { type: attr(m[1], 'Type') || '', path: resolve(base, t) };
    }
    return map;
  }
  function colIndex(s) { var n = 0; for (var i = 0; i < s.length; i++) n = n * 26 + s.charCodeAt(i) - 64; return n - 1; }

  /* ชื่อชีต → path ของ XML ชีตงาน (ตามลำดับใน workbook.xml) · get(path) คืนข้อความของไฟล์ใน zip หรือ null */
  function sheetPaths(get) {
    var main = 'xl/workbook.xml', r0 = rels(get('_rels/.rels'), '');
    Object.keys(r0).forEach(function (k) { if (/\/officeDocument$/.test(r0[k].type)) main = r0[k].path; });
    var wbXml = get(main);
    if (!wbXml) return [];
    var dir = main.split('/').slice(0, -1).join('/'), relPath = (dir ? dir + '/' : '') + '_rels/' + main.split('/').pop() + '.rels';
    var rm = rels(get(relPath), main), out = [], re = /<(?:\w+:)?sheet\b([^>]*)\/?>/g, m;
    while ((m = re.exec(wbXml))) {
      var name = attr(m[1], 'name'), id = (/(?:^|\s)[\w]+:id\s*=\s*"([^"]*)"/.exec(m[1]) || [])[1], rel = id && rm[id];
      if (name != null && rel && /\/worksheet$/.test(rel.type)) out.push({ name: name, path: rel.path });
    }
    return out;
  }

  /* เซลล์ในชีตที่มีสูตรแต่ไม่มีค่าแคช → [{r, c}] (เริ่ม 0) · t="str" ที่ <v></v> ว่าง = ผลเป็นข้อความว่างจริง ไม่นับ */
  function scanSheet(xml) {
    var out = [];
    if (!xml || !/<(?:\w+:)?f[\s>\/]/.test(xml)) return out;
    var open = /<(\w+:)?c\b([^>]*?)(\/?)>/g, m;
    while ((m = open.exec(xml))) {
      if (m[3]) continue;
      var close = '</' + (m[1] || '') + 'c>', end = xml.indexOf(close, open.lastIndex);
      if (end < 0) break;
      var body = xml.slice(open.lastIndex, end);
      open.lastIndex = end + close.length;
      if (!/<(?:\w+:)?f[\s>\/]/.test(body)) continue;
      var v = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(body), t = attr(m[2], 't');
      if (v && (v[1] !== '' || t === 'str')) continue;
      if (t === 'inlineStr' && /<(?:\w+:)?is[\s>]/.test(body)) continue;
      var ref = /^([A-Z]{1,3})(\d+)$/.exec(attr(m[2], 'r') || '');
      if (ref) out.push({ r: +ref[2] - 1, c: colIndex(ref[1]) });
    }
    return out;
  }

  /* ทุกชีตใน names → [{sheet, r, c}] */
  function missingCells(get, names) {
    var out = [];
    sheetPaths(get).forEach(function (s) {
      if (names && names.indexOf(s.name) < 0) return;
      scanSheet(get(s.path)).forEach(function (q) { out.push({ sheet: s.name, r: q.r, c: q.c }); });
    });
    return out;
  }

  function hasValue(ws, r, c) { var row = ws && ws[r], x = row && row[c]; return !!(x && x.v != null); }

  /* wb (dense) จาก X.read(…, {bookFiles:true}) → เซลล์ที่ต้องคำนวณ · ลบ wb.files/wb.keys ทิ้งเสมอ (ไม่ถือ zip ไว้ในหน่วยความจำ) */
  function missing(wb) {
    var files = wb.files || {};
    delete wb.files; delete wb.keys;
    var get = function (p) { var f = files[p] || files['/' + p]; return f ? text(f.content) : null; };
    try {
      return missingCells(get, wb.SheetNames).filter(function (q) { return !hasValue(wb.Sheets[q.sheet], q.r, q.c); });
    } catch (e) { return []; }
  }

  /* เติมผลลง wb.Sheets (dense) เฉพาะเซลล์ที่ยังไม่มีค่า → จำนวนที่เติม · X = SheetJS (ใช้ SSF/utils) · o.cellDates เหมือนตอน X.read */
  function apply(X, wb, cells, o) {
    o = o || {};
    var d1904 = !!(wb.Workbook && wb.Workbook.WBProps && wb.Workbook.WBProps.date1904), n = 0;
    (cells || []).forEach(function (q) {
      var ws = wb.Sheets[q.sheet];
      if (!ws || q.t === 'z' || hasValue(ws, q.r, q.c)) return;
      var cell;
      if (q.t === 'n' && typeof q.v === 'number') {
        cell = { t: 'n', v: q.v };
        if (o.cellDates && q.z && X.SSF.is_date(q.z)) {
          var p = X.SSF.parse_date_code(q.v, { date1904: d1904 });
          if (p) cell = { t: 'd', v: new Date(p.y, p.m - 1, p.d, p.H, p.M, Math.floor(p.S)) };
        }
      } else if (q.t === 's') cell = { t: 's', v: String(q.v) };
      else if (q.t === 'b') cell = { t: 'b', v: !!q.v };
      else if (q.t === 'e') cell = { t: 'e', v: q.v in ERR ? ERR[q.v] : 0xFF, w: String(q.v) };
      else return;
      (ws[q.r] || (ws[q.r] = []))[q.c] = cell;
      var rg = X.utils.decode_range(ws['!ref'] || 'A1:A1');
      if (q.r > rg.e.r || q.c > rg.e.c || !ws['!ref']) {
        if (!ws['!ref']) rg = { s: { r: q.r, c: q.c }, e: { r: q.r, c: q.c } };
        rg.e.r = Math.max(rg.e.r, q.r); rg.e.c = Math.max(rg.e.c, q.c);
        ws['!ref'] = X.utils.encode_range(rg);
      }
      n++;
    });
    return n;
  }

  /* คำนวณใน Worker แล้วเติมลง wb → Promise<{filled, ms}> · buf (ArrayBuffer) ถูกโอนให้ Worker (ใช้ต่อไม่ได้) · ล้ม = reject */
  function fillMissing(X, wb, buf, need, o) {
    return new Promise(function (resolve, reject) {
      var w, timer;
      function done(err, res) { clearTimeout(timer); try { w.terminate(); } catch (e) {} if (err) reject(err); else resolve(res); }
      try { w = new Worker(WORKER_URL); } catch (e) { reject(e); return; }
      timer = setTimeout(function () { done(new Error('timeout')); }, TIMEOUT_MS);
      w.onmessage = function (e) {
        var d = e.data || {};
        if (!d.ok) return done(new Error(d.error || 'recalc'));
        done(null, { filled: apply(X, wb, d.cells, o), ms: d.ms });
      };
      w.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); done(new Error((e && e.message) || 'worker')); };
      w.postMessage({ bytes: buf, cells: need }, [buf]);
    });
  }

  return { scanSheet: scanSheet, sheetPaths: sheetPaths, missingCells: missingCells, missing: missing, apply: apply, fillMissing: fillMissing };
});
