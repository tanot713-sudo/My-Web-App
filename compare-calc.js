/* ══════════════════════════════════════════════════════════════════
   Tanot — compare-calc.js · ตรรกะล้วนของหน้า "เปรียบเทียบข้อมูล" (compare.html) — ไม่มี DOM/storage
   UMD: window.CompareCalc ในหน้า, require() ได้ใน tests/compare.spec.js

   1) เทียบตาราง (Excel/CSV)  diffTables(A, B, cfg) · suggestMapping · cellsEqual · toCell
        ตาราง = { headers: [ชื่อคอลัมน์...], rows: [[ค่า...], ...] }   (ค่า = string | number | null)
        cfg   = { map: [{ a: ดัชนีคอลัมน์ใน A, b: ดัชนีใน B | null, name }],   ← คอลัมน์ที่จับคู่แล้ว
                  keys: [ดัชนีใน map ที่เป็นคีย์หลัก],  skip: [ดัชนีใน map ที่ไม่เทียบ],
                  ignoreCase, trim, tol (ค่าคลาดเคลื่อนตัวเลข ≥ 0) }
        ผล    = { added:[{b,key}], removed:[{a,key}], changed:[{a,b,key,cells:[{m,old,new}]}], same,
                  dupA:[{key,rows:[…]}], dupB, blankA, blankB, total:{a,b} }
        ตัวเลขในผลเป็น "ดัชนีแถวข้อมูล" (เริ่ม 0 ไม่รวมหัวตาราง) — ไม่คัดลอกข้อมูล เพื่อให้ไฟล์หลายหมื่นแถวไม่กินหน่วยความจำเพิ่ม
        คีย์ซ้ำในไฟล์เดียวกัน: เทียบเฉพาะแถวแรกของคีย์นั้น แถวที่เหลือรายงานใน dupA/dupB (ไม่นับเป็นเพิ่ม/หาย/เปลี่ยน)
        แถวที่ช่องคีย์ว่างทุกช่อง: ข้าม นับใน blankA/blankB
   2) เทียบข้อความ  diffLines(textA, textB, opts) — Myers (O(ND)) ระดับบรรทัด แล้ว diff ระดับคำในบรรทัดที่แก้
        คำภาษาไทยตัดด้วย Intl.Segmenter('th', {granularity:'word'}) (ไม่มี = regex สำรอง)
   3) ให้คะแนนใบเสนอราคา  rankJob(job) · priceScores · defaultCriteria · cleanJob · weightTotal
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CompareCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ══════════ ค่าในเซลล์ ══════════ */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // ค่าจากชีต → string | number | null (Date → 'YYYY-MM-DD' หรือ 'YYYY-MM-DD HH:MM' ถ้ามีเวลา · boolean → 'TRUE'/'FALSE')
  function toCell(v) {
    if (v == null) return null;
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return null;
      var d = v.getFullYear() + '-' + pad2(v.getMonth() + 1) + '-' + pad2(v.getDate());
      return v.getHours() || v.getMinutes() ? d + ' ' + pad2(v.getHours()) + ':' + pad2(v.getMinutes()) : d;
    }
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    var s = String(v);
    return s === '' ? null : s;
  }

  function isBlank(v, trim) {
    if (v == null) return true;
    if (typeof v === 'number') return false;
    return (trim ? String(v).trim() : String(v)) === '';
  }

  var NUM_RE = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$|^[+-]?\.\d+$/;
  // number | string ที่หน้าตาเป็นตัวเลข ("1,234.50", " 12 ") → number · ไม่ใช่ → NaN
  function toNumber(v) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') return NaN;
    var s = v.trim();
    return NUM_RE.test(s) ? parseFloat(s.replace(/,/g, '')) : NaN;
  }

  function normText(v, o) {
    var s = v == null ? '' : String(v);
    if (o && o.trim) s = s.trim();
    if (o && o.ignoreCase) s = s.toLowerCase();
    return s;
  }

  // ว่างเทียบกับว่างเท่ากัน · ตัวเลขทั้งคู่ → ต่างกันไม่เกิน tol · ที่เหลือเทียบข้อความ (ตาม ignoreCase/trim)
  function cellsEqual(a, b, o) {
    o = o || {};
    var ba = isBlank(a, o.trim), bb = isBlank(b, o.trim);
    if (ba || bb) return ba && bb;
    var na = toNumber(a), nb = toNumber(b);
    if (!isNaN(na) && !isNaN(nb)) return Math.abs(na - nb) <= (o.tol > 0 ? o.tol : 0) + 1e-12;
    return normText(a, o) === normText(b, o);
  }

  // ข้อความที่ใช้เป็นคีย์: ตัวเลข "1" กับข้อความ "1" ต้องเป็นคีย์เดียวกัน (Excel เก็บรหัสเป็นตัวเลขบ้าง ข้อความบ้าง)
  function keyPart(v, o) {
    if (v == null) return '';
    var s = String(v);
    if (o.trim) s = s.trim();
    if (o.ignoreCase) s = s.toLowerCase();
    return s;
  }

  /* ══════════ จับคู่คอลัมน์ตามชื่อหัว ══════════ */
  function normHeader(h) { return String(h == null ? '' : h).replace(/\s+/g, ' ').trim().toLowerCase(); }

  // คืน [{a, b, name}] ต่อคอลัมน์ของ A (b = null ถ้าไม่เจอ) — ชื่อตรงกันเป๊ะก่อน แล้วตามด้วยชื่อที่เหมือนกันหลัง normalize · ใช้ 1 คอลัมน์ B ได้ครั้งเดียว
  function suggestMapping(headersA, headersB) {
    var used = {}, out = headersA.map(function (h, i) { return { a: i, b: null, name: String(h == null ? '' : h) }; });
    function pass(norm) {
      out.forEach(function (m) {
        if (m.b != null) return;
        var na = norm(headersA[m.a]);
        if (na === '') return;
        for (var j = 0; j < headersB.length; j++) {
          if (!used[j] && norm(headersB[j]) === na) { m.b = j; used[j] = true; return; }
        }
      });
    }
    pass(function (h) { return String(h == null ? '' : h); });
    pass(normHeader);
    return out;
  }

  /* ══════════ diff ตาราง ══════════ */
  function diffTables(A, B, cfg) {
    var map = cfg.map || [], o = { ignoreCase: !!cfg.ignoreCase, trim: !!cfg.trim, tol: cfg.tol > 0 ? +cfg.tol : 0 };
    var skip = {}; (cfg.skip || []).forEach(function (m) { skip[m] = true; });
    var keys = (cfg.keys || []).filter(function (m) { return map[m] && map[m].a != null && map[m].b != null; });
    if (!keys.length) throw new Error('no-key');
    var cmp = [];
    map.forEach(function (m, i) { if (m.a != null && m.b != null && !skip[i] && keys.indexOf(i) === -1) cmp.push(i); });
    // คีย์เทียบกันด้วยตัวคีย์อยู่แล้ว — เทียบค่าเฉพาะคอลัมน์ที่ไม่ใช่คีย์

    function index(T, side) {
      var m = Object.create(null), dup = Object.create(null), dupList = [], blank = 0, rows = T.rows;
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r], parts = new Array(keys.length), empty = true;
        for (var k = 0; k < keys.length; k++) {
          var v = row[map[keys[k]][side]];
          if (!isBlank(v, true)) empty = false;
          parts[k] = keyPart(v, o);
        }
        if (empty) { blank++; continue; }
        var key = parts.join('\u0001');
        if (key in m) {
          if (!(key in dup)) { dup[key] = { key: parts, rows: [m[key]] }; dupList.push(dup[key]); }
          dup[key].rows.push(r);
        } else m[key] = r;
      }
      return { m: m, dupList: dupList, blank: blank };
    }
    var ia = index(A, 'a'), ib = index(B, 'b');
    var res = { added: [], removed: [], changed: [], same: 0, dupA: ia.dupList, dupB: ib.dupList, blankA: ia.blank, blankB: ib.blank, total: { a: A.rows.length, b: B.rows.length }, keys: keys, compared: cmp };

    function keyOf(row, side) { return keys.map(function (m) { var v = row[map[m][side]]; return v == null ? '' : v; }); }

    var ka = Object.keys(ia.m);
    for (var i = 0; i < ka.length; i++) {
      var key = ka[i], ra = ia.m[key];
      if (!(key in ib.m)) { res.removed.push({ a: ra, key: keyOf(A.rows[ra], 'a') }); continue; }
      var rb = ib.m[key], rowA = A.rows[ra], rowB = B.rows[rb], cells = null;
      for (var c = 0; c < cmp.length; c++) {
        var mm = map[cmp[c]], va = rowA[mm.a], vb = rowB[mm.b];
        if (!cellsEqual(va, vb, o)) (cells || (cells = [])).push({ m: cmp[c], old: va == null ? null : va, new: vb == null ? null : vb });
      }
      if (cells) res.changed.push({ a: ra, b: rb, key: keyOf(rowB, 'b'), cells: cells });
      else res.same++;
    }
    var kb = Object.keys(ib.m);
    for (var j = 0; j < kb.length; j++) {
      if (!(kb[j] in ia.m)) res.added.push({ b: ib.m[kb[j]], key: keyOf(B.rows[ib.m[kb[j]]], 'b') });
    }
    // เรียงตามลำดับแถวในไฟล์ (Object.keys เรียงตามการแทรกแต่คีย์ที่เป็นเลขล้วนจะถูกจัดใหม่)
    res.removed.sort(function (x, y) { return x.a - y.a; });
    res.changed.sort(function (x, y) { return x.b - y.b; });
    res.added.sort(function (x, y) { return x.b - y.b; });
    return res;
  }

  function showCell(v) {
    var x = toCell(v);
    return x == null ? '' : x;
  }

  /* โมเดลสำหรับส่งออก .xlsx — หน้าเป็นคนแปลงเป็นชีตและสี
     คืน [{ id, name, header:[...], rows:[[...]], marks:[[null|'chg'|'old'|'new']] }]
     ชีต "เปลี่ยน": คอลัมน์ = คอลัมน์ที่จับคู่แล้วทั้งหมด (ค่าจาก B) · เซลล์ที่ต่างเป็น "เก่า → ใหม่" ทำเครื่องหมาย 'chg' */
  function exportModel(A, B, cfg, res) {
    var map = cfg.map, cols = [], oa = cfg.offA || 2, ob = cfg.offB || 2; // offA/offB = เลขแถวใน Excel ของแถวข้อมูลแรก
    map.forEach(function (m, i) { if (m.a != null && m.b != null) cols.push(i); });
    var head = cols.map(function (i) { return map[i].name || A.headers[map[i].a]; });
    function rowOf(T, r, side) { return cols.map(function (i) { return showCell(T.rows[r][map[i][side]]); }); }
    var sheets = [];
    sheets.push({ id: 'summary', name: 'สรุป', header: ['รายการ', 'จำนวนแถว'], rows: [
      ['แถวในไฟล์ A', res.total.a], ['แถวในไฟล์ B', res.total.b], ['เพิ่ม (มีเฉพาะ B)', res.added.length], ['หาย (มีเฉพาะ A)', res.removed.length],
      ['ค่าเปลี่ยน', res.changed.length], ['เหมือนกัน', res.same], ['คีย์ซ้ำในไฟล์ A', res.dupA.length], ['คีย์ซ้ำในไฟล์ B', res.dupB.length],
      ['แถวคีย์ว่างที่ข้าม (A / B)', res.blankA + ' / ' + res.blankB]
    ], marks: [] });
    sheets.push({ id: 'added', name: 'เพิ่ม', header: ['แถวใน B'].concat(head), rows: res.added.map(function (x) { return [x.b + ob].concat(rowOf(B, x.b, 'b')); }), marks: [] });
    sheets.push({ id: 'removed', name: 'หาย', header: ['แถวใน A'].concat(head), rows: res.removed.map(function (x) { return [x.a + oa].concat(rowOf(A, x.a, 'a')); }), marks: [] });
    var marks = [];
    sheets.push({ id: 'changed', name: 'เปลี่ยน', header: ['แถวใน A', 'แถวใน B'].concat(head), rows: res.changed.map(function (x) {
      var row = [x.a + oa, x.b + ob].concat(rowOf(B, x.b, 'b')), mk = [null, null];
      var byM = {}; x.cells.forEach(function (c) { byM[c.m] = c; });
      cols.forEach(function (i, ci) {
        var c = byM[i];
        if (c) { row[2 + ci] = showCell(c.old) + ' → ' + showCell(c.new); mk.push('chg'); } else mk.push(null);
      });
      marks.push(mk);
      return row;
    }), marks: marks });
    var dups = [];
    res.dupA.forEach(function (d) { dups.push(['A', d.key.join(' | '), d.rows.map(function (r) { return r + oa; }).join(', ')]); });
    res.dupB.forEach(function (d) { dups.push(['B', d.key.join(' | '), d.rows.map(function (r) { return r + ob; }).join(', ')]); });
    sheets.push({ id: 'dups', name: 'คีย์ซ้ำ', header: ['ไฟล์', 'คีย์', 'แถว'], rows: dups, marks: [] });
    return sheets;
  }

  /* ══════════ diff ลำดับ (Myers) ══════════ */
  // a, b = Int32/Array ของ id (เทียบด้วย ===) · คืน ops [{t:'eq'|'del'|'add', a, b}] เรียงตามลำดับ · maxD เกิน = null
  function myers(a, b, maxD) {
    var N = a.length, M = b.length, pre = 0, suf = 0;
    while (pre < N && pre < M && a[pre] === b[pre]) pre++;
    while (suf < N - pre && suf < M - pre && a[N - 1 - suf] === b[M - 1 - suf]) suf++;
    var ops = [], i;
    for (i = 0; i < pre; i++) ops.push({ t: 'eq', a: i, b: i });
    var n = N - pre - suf, m = M - pre - suf, mid = null;
    if (n === 0) { mid = []; for (i = 0; i < m; i++) mid.push({ t: 'add', a: -1, b: pre + i }); }
    else if (m === 0) { mid = []; for (i = 0; i < n; i++) mid.push({ t: 'del', a: pre + i, b: -1 }); }
    else mid = myersCore(a, b, pre, n, m, maxD == null ? 4000 : maxD);
    if (mid === null) return null;
    for (i = 0; i < mid.length; i++) ops.push(mid[i]);
    for (i = 0; i < suf; i++) ops.push({ t: 'eq', a: N - suf + i, b: M - suf + i });
    return ops;
  }

  function myersCore(a, b, off0, N, M, maxD) {
    var max = N + M, off = max + 1, V = new Int32Array(2 * max + 3), trace = [], d, k, x, y;
    for (d = 0; d <= Math.min(max, maxD); d++) {
      trace.push(V.slice(off - d, off + d + 1)); // สถานะก่อนชั้น d (ดัชนี = k + d)
      for (k = -d; k <= d; k += 2) {
        if (k === -d || (k !== d && V[off + k - 1] < V[off + k + 1])) x = V[off + k + 1]; else x = V[off + k - 1] + 1;
        y = x - k;
        while (x < N && y < M && a[off0 + x] === b[off0 + y]) { x++; y++; }
        V[off + k] = x;
        if (x >= N && y >= M) return backtrack(trace, N, M, off0);
      }
    }
    return null;
  }

  function backtrack(trace, N, M, off0) {
    var x = N, y = M, ops = [];
    for (var d = trace.length - 1; d >= 0; d--) {
      var v = trace[d], k = x - y, prevK, prevX, prevY;
      if (d === 0) { prevX = 0; prevY = 0; }
      else {
        prevK = (k === -d || (k !== d && v[k - 1 + d] < v[k + 1 + d])) ? k + 1 : k - 1;
        prevX = v[prevK + d]; prevY = prevX - prevK;
      }
      while (x > prevX && y > prevY) { ops.push({ t: 'eq', a: off0 + x - 1, b: off0 + y - 1 }); x--; y--; }
      if (d > 0) {
        if (x === prevX) ops.push({ t: 'add', a: -1, b: off0 + y - 1 }); else ops.push({ t: 'del', a: off0 + x - 1, b: -1 });
      }
      x = prevX; y = prevY;
    }
    return ops.reverse();
  }

  function intern(strs) {
    var ids = new Map(), out = new Int32Array(strs.length);
    for (var i = 0; i < strs.length; i++) {
      var id = ids.get(strs[i]);
      if (id === undefined) { id = ids.size; ids.set(strs[i], id); }
      out[i] = id;
    }
    return { ids: ids, arr: out };
  }

  /* ══════════ diff ข้อความ ══════════ */
  function splitLines(text) {
    var s = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
    if (s === '') return [];
    var lines = s.split('\n');
    if (lines[lines.length - 1] === '') lines.pop(); // ขึ้นบรรทัดใหม่ท้ายไฟล์ไม่นับเป็นบรรทัดว่างเพิ่ม
    return lines;
  }

  var segmenter = null;
  function getSegmenter() {
    if (segmenter === null) {
      try { segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : false; } catch (e) { segmenter = false; }
    }
    return segmenter;
  }

  // ตัดคำ: [{text, key}] — ignoreSpace: ช่องว่างไปต่อท้ายคำก่อนหน้า (key ไม่รวมช่องว่าง) จึงไม่ถูกนับว่าต่าง
  function tokenize(line, ignoreSpace) {
    var parts = [], seg = getSegmenter();
    if (seg) { for (var it = seg.segment(line)[Symbol.iterator](), r = it.next(); !r.done; r = it.next()) parts.push(r.value.segment); }
    else parts = line.match(/\s+|[A-Za-z0-9_]+|[฀-๿]+|[\s\S]/g) || [];
    var out = [];
    parts.forEach(function (p) {
      if (ignoreSpace) {
        if (/^\s+$/.test(p)) { if (out.length) out[out.length - 1].text += p; else out.push({ text: p, key: '' }); return; }
        out.push({ text: p, key: p });
      } else out.push({ text: p, key: p });
    });
    return out;
  }

  // diff ระดับคำของบรรทัดที่แก้ → { a:[{t,c}], b:[{t,c}] } (c = true ถ้าส่วนนี้ต่าง) · ต่อส่วนที่ติดกันและมีสถานะเดียวกัน
  function wordDiff(la, lb, ignoreSpace) {
    var ta = tokenize(la, ignoreSpace), tb = tokenize(lb, ignoreSpace);
    var ia = intern(ta.map(function (t) { return t.key; }).concat(tb.map(function (t) { return t.key; })));
    var arrA = ia.arr.subarray(0, ta.length), arrB = ia.arr.subarray(ta.length);
    var ops = myers(arrA, arrB, 1500), sa = [], sb = [];
    function push(list, text, c) {
      if (list.length && list[list.length - 1].c === c) list[list.length - 1].t += text; else list.push({ t: text, c: c });
    }
    if (ops === null) { push(sa, la, true); push(sb, lb, true); return { a: sa, b: sb }; }
    ops.forEach(function (op) {
      if (op.t === 'eq') { push(sa, ta[op.a].text, false); push(sb, tb[op.b].text, false); }
      else if (op.t === 'del') push(sa, ta[op.a].text, true);
      else push(sb, tb[op.b].text, true);
    });
    return { a: sa, b: sb };
  }

  /* diffLines → { rows, stats:{same,del,add,chg}, hunks:n, approx }
     row = { type:'eq'|'del'|'add'|'chg', a: เลขบรรทัดใน A (1..)|0, b: เลขบรรทัดใน B|0, ta, tb, wa, wb, h: เลขกลุ่มที่ต่าง (เริ่ม 0)|-1 }
     'chg' = บรรทัดที่ถูกแทนที่ (จับคู่ตามลำดับภายในกลุ่มที่ลบ+เพิ่มติดกัน) มี wa/wb = ส่วนของคำ */
  function diffLines(textA, textB, opts) {
    opts = opts || {};
    var la = splitLines(textA), lb = splitLines(textB), ign = !!opts.ignoreSpace;
    var norm = function (s) { return ign ? s.replace(/\s+/g, '') : s; };
    var ia = intern(la.map(norm).concat(lb.map(norm)));
    var arrA = ia.arr.subarray(0, la.length), arrB = ia.arr.subarray(la.length);
    var ops = myers(arrA, arrB, opts.maxD), approx = false;
    if (ops === null) { // ต่างกันมากเกินไป — ถือว่าส่วนกลางเปลี่ยนทั้งหมด (ยังหาบรรทัดหัว/ท้ายที่เหมือนกันให้)
      approx = true; ops = [];
      var pre = 0, suf = 0;
      while (pre < la.length && pre < lb.length && arrA[pre] === arrB[pre]) pre++;
      while (suf < la.length - pre && suf < lb.length - pre && arrA[la.length - 1 - suf] === arrB[lb.length - 1 - suf]) suf++;
      var i;
      for (i = 0; i < pre; i++) ops.push({ t: 'eq', a: i, b: i });
      for (i = pre; i < la.length - suf; i++) ops.push({ t: 'del', a: i, b: -1 });
      for (i = pre; i < lb.length - suf; i++) ops.push({ t: 'add', a: -1, b: i });
      for (i = 0; i < suf; i++) ops.push({ t: 'eq', a: la.length - suf + i, b: lb.length - suf + i });
    }
    var rows = [], stats = { same: 0, del: 0, add: 0, chg: 0 }, hunks = 0, p = 0;
    while (p < ops.length) {
      if (ops[p].t === 'eq') {
        rows.push({ type: 'eq', a: ops[p].a + 1, b: ops[p].b + 1, ta: la[ops[p].a], tb: lb[ops[p].b], h: -1 });
        stats.same++; p++; continue;
      }
      var dels = [], adds = [];
      while (p < ops.length && ops[p].t !== 'eq') { (ops[p].t === 'del' ? dels : adds).push(ops[p]); p++; }
      var h = hunks++, pair = Math.min(dels.length, adds.length), q;
      for (q = 0; q < pair; q++) {
        var wd = wordDiff(la[dels[q].a], lb[adds[q].b], ign);
        rows.push({ type: 'chg', a: dels[q].a + 1, b: adds[q].b + 1, ta: la[dels[q].a], tb: lb[adds[q].b], wa: wd.a, wb: wd.b, h: h });
        stats.chg++;
      }
      for (q = pair; q < dels.length; q++) { rows.push({ type: 'del', a: dels[q].a + 1, b: 0, ta: la[dels[q].a], tb: '', h: h }); stats.del++; }
      for (q = pair; q < adds.length; q++) { rows.push({ type: 'add', a: 0, b: adds[q].b + 1, ta: '', tb: lb[adds[q].b], h: h }); stats.add++; }
    }
    return { rows: rows, stats: stats, hunks: hunks, approx: approx };
  }

  /* ══════════ ให้คะแนนใบเสนอราคา ══════════ */
  var SCORE_MAX = 10;

  function defaultCriteria() {
    return [
      { id: 'price', name: 'ราคา', weight: 50, auto: 'price' },
      { id: 'delivery', name: 'ส่งมอบ', weight: 20, auto: null },
      { id: 'warranty', name: 'รับประกัน', weight: 15, auto: null },
      { id: 'tech', name: 'คุณสมบัติทางเทคนิค', weight: 15, auto: null }
    ];
  }

  function num(v) {
    if (v == null || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : null;
  }

  function weightTotal(criteria) {
    var t = 0;
    (criteria || []).forEach(function (c) { t += Math.max(0, num(c.weight) || 0); });
    return Math.round(t * 1e6) / 1e6;
  }

  // ราคาต่ำสุด (> 0) ได้เต็ม · ที่เหลือ = ต่ำสุด / ราคา × เต็ม · ไม่มีราคา/ราคา ≤ 0 → null · คืน { [bidderId]: คะแนน|null }
  function priceScores(bidders, max) {
    max = max || SCORE_MAX;
    var prices = bidders.map(function (b) { var p = num(b.price); return p != null && p > 0 ? p : null; });
    var min = null;
    prices.forEach(function (p) { if (p != null && (min == null || p < min)) min = p; });
    var out = {};
    bidders.forEach(function (b, i) { out[b.id] = prices[i] == null ? null : min / prices[i] * max; });
    return out;
  }

  /* rankJob(job) → { total (น้ำหนักรวม), ok (น้ำหนักรวม = 100), rows:[{id, name, scores:{critId:คะแนน|null}, parts:{critId:คะแนนถ่วงน้ำหนัก}, total, missing, rank}] }
     คะแนนรวม = Σ (คะแนนเกณฑ์ / เต็ม × น้ำหนัก) → เต็ม 100 · คะแนนที่ยังไม่กรอก = 0 (นับใน missing) · คะแนนเท่ากันได้อันดับเดียวกัน (1,1,3) · rows เรียงตามอันดับ */
  function rankJob(job) {
    var crit = job.criteria || [], bidders = job.bidders || [], ps = priceScores(bidders, SCORE_MAX);
    var rows = bidders.map(function (b) {
      var scores = {}, parts = {}, total = 0, missing = 0;
      crit.forEach(function (c) {
        var s = c.auto === 'price' ? ps[b.id] : num(b.scores && b.scores[c.id]);
        if (s != null) s = Math.min(SCORE_MAX, Math.max(0, s));
        scores[c.id] = s;
        if (s == null) missing++;
        parts[c.id] = (s == null ? 0 : s) / SCORE_MAX * Math.max(0, num(c.weight) || 0);
        total += parts[c.id];
      });
      return { id: b.id, name: b.name || '', scores: scores, parts: parts, total: total, missing: missing, rank: 0 };
    });
    var order = rows.map(function (r, i) { return i; }).sort(function (x, y) { return rows[y].total - rows[x].total || x - y; });
    var sorted = order.map(function (i) { return rows[i]; });
    sorted.forEach(function (r, i) {
      r.rank = i > 0 && Math.abs(r.total - sorted[i - 1].total) < 1e-9 ? sorted[i - 1].rank : i + 1;
    });
    var wt = weightTotal(crit);
    return { total: wt, ok: Math.abs(wt - 100) < 1e-6, rows: sorted };
  }

  var FILE_FIELDS = ['id', 'name', 'size', 'mime'];
  // ทำความสะอาดงานเปรียบเทียบราคาที่อ่านจาก storage/ฟอร์ม — คืนอ็อบเจ็กต์ใหม่เสมอ
  function cleanJob(raw, id, now) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var seen = {}, crit = (Array.isArray(raw.criteria) ? raw.criteria : defaultCriteria()).filter(function (c) { return c && typeof c === 'object'; }).map(function (c, i) {
      var cid = String(c.id || 'c' + (i + 1));
      while (seen[cid]) cid += '_';
      seen[cid] = true;
      return { id: cid, name: String(c.name == null ? '' : c.name).slice(0, 80), weight: Math.max(0, num(c.weight) || 0), auto: c.auto === 'price' ? 'price' : null };
    });
    var bseen = {};
    var bidders = (Array.isArray(raw.bidders) ? raw.bidders : []).filter(function (b) { return b && typeof b === 'object'; }).map(function (b, i) {
      var bid = String(b.id || 'b' + (i + 1));
      while (bseen[bid]) bid += '_';
      bseen[bid] = true;
      var scores = {};
      crit.forEach(function (c) {
        var s = num(b.scores && b.scores[c.id]);
        if (s != null) scores[c.id] = Math.min(SCORE_MAX, Math.max(0, s));
      });
      var files = (Array.isArray(b.files) ? b.files : []).filter(function (f) { return f && f.id; }).map(function (f) {
        var o = {}; FILE_FIELDS.forEach(function (k) { o[k] = f[k]; }); return o;
      });
      var price = num(b.price);
      var s = function (k, n) { return String(b[k] == null ? '' : b[k]).slice(0, n); };
      return { id: bid, name: s('name', 120), price: price != null && price >= 0 ? price : null, delivery: s('delivery', 120), warranty: s('warranty', 120), payment: s('payment', 200), note: s('note', 1000), scores: scores, files: files };
    });
    var t = now == null ? Date.now() : now;
    return { id: String(raw.id || id || ''), name: String(raw.name == null ? '' : raw.name).slice(0, 120).trim() ? String(raw.name).slice(0, 120) : 'งานเปรียบเทียบราคา', criteria: crit, bidders: bidders, createdAt: num(raw.createdAt) || t, updatedAt: t };
  }

  // แถวสำหรับส่งออก .xlsx ของใบเสนอราคา → { sheets:[{name, header, rows}] } (ชีตแรก = จัดอันดับ, ชีตที่สอง = ข้อมูลผู้เสนอราคา)
  function quoteSheets(job) {
    var r = rankJob(job), crit = job.criteria, byId = {};
    job.bidders.forEach(function (b) { byId[b.id] = b; });
    var rank = { name: 'จัดอันดับ', header: ['อันดับ', 'ผู้เสนอราคา', 'ราคา'].concat(crit.map(function (c) { return c.name + ' (' + c.weight + '%)'; }), ['คะแนนรวม (เต็ม 100)']),
      rows: r.rows.map(function (x) {
        return [x.rank, x.name, byId[x.id].price == null ? '' : byId[x.id].price].concat(crit.map(function (c) { return x.scores[c.id] == null ? '' : Math.round(x.scores[c.id] * 100) / 100; }), [Math.round(x.total * 100) / 100]);
      }) };
    var info = { name: 'ผู้เสนอราคา', header: ['ผู้เสนอราคา', 'ราคา', 'ระยะส่งมอบ', 'รับประกัน', 'เงื่อนไขชำระ', 'หมายเหตุ', 'ไฟล์แนบ'],
      rows: job.bidders.map(function (b) { return [b.name, b.price == null ? '' : b.price, b.delivery, b.warranty, b.payment, b.note, b.files.map(function (f) { return f.name; }).join(', ')]; }) };
    return { sheets: [rank, info], ranking: r };
  }

  return {
    toCell: toCell, toNumber: toNumber, isBlank: isBlank, cellsEqual: cellsEqual, normHeader: normHeader, suggestMapping: suggestMapping,
    diffTables: diffTables, exportModel: exportModel,
    myers: myers, splitLines: splitLines, tokenize: tokenize, wordDiff: wordDiff, diffLines: diffLines,
    SCORE_MAX: SCORE_MAX, defaultCriteria: defaultCriteria, weightTotal: weightTotal, priceScores: priceScores, rankJob: rankJob, cleanJob: cleanJob, quoteSheets: quoteSheets
  };
});
