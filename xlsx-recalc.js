/* ══════════════════════════════════════════════════════════════════
   Tanot — คำนวณสูตรที่ไฟล์ .xlsx ไม่ได้เก็บค่าไว้ (window.TanotXlsxRecalc) · ใช้ใน compare.js
   ไฟล์ที่ openpyxl/SheetJS เขียนมีสูตรแต่ไม่มีค่าแคช (<v/> ว่างหรือไม่มี <v>) — SheetJS 0.18.5 ทิ้งเซลล์พวกนี้ทั้งเซลล์
   จึงนับจาก XML ของชีตเอง (wb.files จาก X.read(…, {bookFiles:true})) ไม่ใช่จาก wb.Sheets
   ไม่มีเซลล์แบบนี้ = ไม่โหลด wasm · มี = ส่งไฟล์ให้ xlsx-recalc-worker.js (GridCraft, vendor/gridcraft/) ใน Worker เสมอ
   แล้วเติมค่า "เฉพาะเซลล์ที่ SheetJS ไม่มีค่า" (dense) — ไม่ทับค่าที่มี ไม่เขียนไฟล์ใหม่ ไม่มีข้อมูลออกจากเครื่อง
   ค่าที่ได้เป็นค่าดิบ (ตัวเลข/ข้อความ/บูลีน/error) — ไม่ใช้ข้อความที่จัดรูปจาก GridCraft (ไม่รู้ปี พ.ศ./[$-th-TH]);
   ตัวเลขในเซลล์รูปแบบวันที่แปลงเป็น Date ด้วย SheetJS เอง (X.SSF) ให้เหมือนเซลล์ที่มีค่าแคชตอนอ่านด้วย cellDates
   ฟังก์ชันล้วน (scanSheet/sheetPaths/missingCells/apply/writeSheet/writeValues) require() ได้ใน test
   ── ไฟล์ดาวน์โหลด (run.html): fillXlsx(JSZip, bytes) เขียน <v> ลง XML ของชีตเอง (writeValues) แล้วอัดกลับด้วย JSZip
   ไม่ใช้ writer ของ GridCraft (ทิ้งส่วนที่ไม่รู้จัก) · คงสูตร <f>, ส่วนอื่นของไฟล์ และ fullCalcOnLoad ใน workbook.xml ไว้ทั้งหมด
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

  function xmlText(s) { // ข้อความใน <v> · ตัดอักขระควบคุมที่ XML 1.0 ไม่รับ
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function colName(c) { var s = ''; c++; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = (c - 1 - m) / 26; } return s; }
  function date1904(wbXml) { var m = /<(?:\w+:)?workbookPr\b([^>]*)>/.exec(wbXml || ''), v = m && attr(m[1], 'date1904'); return v === '1' || v === 'true'; }
  function serial(d, d1904) { // Date → serial ของ Excel (1900: ข้ามวันที่ 29 ก.พ. 1900 ที่ไม่มีจริง)
    var ms = d.getTime() - d.getTimezoneOffset() * 60000, x = ms / 86400000 + (d1904 ? 24107 : 25569);
    return !d1904 && x < 61 ? x - 1 : x;
  }
  /* ผล {t, v} → [ค่า t (null = ไม่มี), ข้อความใน <v>] · ไม่รู้จัก/ว่าง/ไม่จำกัด = null (ไม่เขียน) */
  function cellOut(q, d1904) {
    var v = q.v;
    if (q.t === 'd' && v != null) { var d = v instanceof Date ? v : new Date(v); if (isNaN(d)) return null; v = serial(d, d1904); return [null, String(v)]; }
    if (q.t === 'n') return typeof v === 'number' && isFinite(v) ? [null, String(v)] : null;
    if (q.t === 's') return v == null ? null : ['str', xmlText(v)];
    if (q.t === 'b') return ['b', v ? '1' : '0'];
    if (q.t === 'e') return v == null ? null : ['e', xmlText(v)];
    return null;
  }

  /* XML ของชีต + ผลของชีตนั้น → {xml, filled} · เขียนเฉพาะเซลล์ที่มีสูตรแต่ยังไม่มีค่า (ตามกฎ scanSheet) ไม่ทับค่าที่มี
     ลบ <v>/<v/> ว่างเดิม ใส่ <v> ต่อจาก <f> · ตั้ง t ใหม่ (ตัวเลข = ไม่มี t) · ไม่แตะ <f> และ attribute อื่น */
  function writeSheet(xml, cells, d1904) {
    var want = {}, n = 0;
    (cells || []).forEach(function (q) { var o = cellOut(q, d1904); if (o) want[colName(q.c) + (q.r + 1)] = o; });
    if (!xml || !Object.keys(want).length) return { xml: xml, filled: 0 };
    var out = '', last = 0, open = /<(\w+:)?c\b([^>]*?)(\/?)>/g, m;
    while ((m = open.exec(xml))) {
      if (m[3]) continue;
      var pre = m[1] || '', close = '</' + pre + 'c>', end = xml.indexOf(close, open.lastIndex);
      if (end < 0) break;
      var head = m[2], body = xml.slice(open.lastIndex, end), ref = attr(head, 'r'), o = ref && want[ref];
      open.lastIndex = end + close.length;
      if (!o || !/<(?:\w+:)?f[\s>\/]/.test(body)) continue;
      var v = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(body), t = attr(head, 't');
      if ((v && (v[1] !== '' || t === 'str')) || (t === 'inlineStr' && /<(?:\w+:)?is[\s>]/.test(body))) continue;
      var nb = body.replace(/<(\w+:)?v\s*\/>|<(\w+:)?v>\s*<\/(?:\w+:)?v>/g, ''), vt = '<' + pre + 'v>' + o[1] + '</' + pre + 'v>';
      var fEnd = /<(?:\w+:)?f\b[^>]*\/>|<(?:\w+:)?f\b[^>]*>[\s\S]*?<\/(?:\w+:)?f>/.exec(nb);
      nb = nb.slice(0, fEnd.index + fEnd[0].length) + vt + nb.slice(fEnd.index + fEnd[0].length);
      var nh = head.replace(/\s+t\s*=\s*(?:"[^"]*"|'[^']*')/, '') + (o[0] ? ' t="' + o[0] + '"' : '');
      out += xml.slice(last, m.index) + '<' + pre + 'c' + nh + '>' + nb + close;
      last = open.lastIndex; n++;
    }
    return { xml: n ? out + xml.slice(last) : xml, filled: n };
  }

  /* get(path) + ผลจาก Worker [{sheet, r, c, t, v}] → {files: {path: xml ใหม่}, filled} · ไม่แตะ workbook.xml */
  function writeValues(get, cells) {
    var by = {}, files = {}, n = 0, d1904 = false, paths = sheetPaths(get);
    (cells || []).forEach(function (q) { (by[q.sheet] || (by[q.sheet] = [])).push(q); });
    var r0 = rels(get('_rels/.rels'), ''), main = 'xl/workbook.xml';
    Object.keys(r0).forEach(function (k) { if (/\/officeDocument$/.test(r0[k].type)) main = r0[k].path; });
    d1904 = date1904(get(main));
    paths.forEach(function (s) {
      if (!by[s.name]) return;
      var res = writeSheet(get(s.path), by[s.name], d1904);
      if (res.filled) { files[s.path] = res.xml; n += res.filled; }
    });
    return { files: files, filled: n };
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

  /* ส่งไฟล์ให้ Worker คำนวณ → Promise<{cells, ms}> · buf (ArrayBuffer) ถูกโอนให้ Worker (ใช้ต่อไม่ได้) · ล้ม/หมดเวลา = reject */
  function recalc(buf, need, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var w, timer;
      function done(err, res) { clearTimeout(timer); try { w.terminate(); } catch (e) {} if (err) reject(err); else resolve(res); }
      try { w = new Worker(WORKER_URL); } catch (e) { reject(e); return; }
      timer = setTimeout(function () { done(new Error('timeout')); }, timeoutMs || TIMEOUT_MS);
      w.onmessage = function (e) {
        var d = e.data || {};
        if (!d.ok) return done(new Error(d.error || 'recalc'));
        done(null, { cells: d.cells, ms: d.ms });
      };
      w.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); done(new Error((e && e.message) || 'worker')); };
      w.postMessage({ bytes: buf, cells: need }, [buf]);
    });
  }

  /* คำนวณใน Worker แล้วเติมลง wb → Promise<{filled, ms}> · buf (ArrayBuffer) ถูกโอนให้ Worker (ใช้ต่อไม่ได้) · ล้ม = reject */
  function fillMissing(X, wb, buf, need, o) {
    return recalc(buf, need).then(function (d) { return { filled: apply(X, wb, d.cells, o), ms: d.ms }; });
  }

  /* ไฟล์ .xlsx (Uint8Array/ArrayBuffer) → Promise<{bytes, need, filled, ms}> · JSZip = ตัว JSZip (โหลดโดยผู้เรียก)
     ไม่มีเซลล์ที่ขาดค่า = bytes เดิม (ไม่เรียก Worker/wasm) · ล้ม/หมดเวลา = reject (ผู้เรียกใช้ไฟล์เดิม) · o.timeout (ms) */
  function fillXlsx(JSZip, bytes, o) {
    o = o || {};
    var src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return JSZip.loadAsync(src).then(function (zip) {
      var names = Object.keys(zip.files).filter(function (p) { return /\.(xml|rels)$/i.test(p) && !zip.files[p].dir; });
      return Promise.all(names.map(function (p) { return zip.file(p).async('string'); })).then(function (texts) {
        var txt = {};
        names.forEach(function (p, i) { txt[p] = texts[i]; });
        var get = function (p) { return txt[p] != null ? txt[p] : txt['/' + p] != null ? txt['/' + p] : null; };
        var need = missingCells(get);
        if (!need.length) return { bytes: src, need: 0, filled: 0, ms: 0 };
        return recalc(src.slice().buffer, need, o.timeout).then(function (d) {
          var w = writeValues(get, d.cells);
          if (!w.filled) return { bytes: src, need: need.length, filled: 0, ms: d.ms };
          Object.keys(w.files).forEach(function (p) { zip.file(p, w.files[p], { createFolders: false }); });
          return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } }).then(function (out) {
            return { bytes: out, need: need.length, filled: w.filled, ms: d.ms };
          });
        });
      });
    });
  }

  return {
    scanSheet: scanSheet, sheetPaths: sheetPaths, missingCells: missingCells, missing: missing, apply: apply, fillMissing: fillMissing,
    writeSheet: writeSheet, writeValues: writeValues, recalc: recalc, fillXlsx: fillXlsx
  };
});
