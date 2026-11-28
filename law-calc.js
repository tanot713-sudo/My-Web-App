/* ══════════════════════════════════════════════════════════════════
   law-calc.js — ตรรกะล้วนของห้องเรียนกฎหมายแบบใหม่ (UMD, window.LawCalc, ไม่มี DOM/storage, require() ได้ใน test)
   แบบ: docs/law-classroom-design.md หัวข้อ 5.2 ท่องมาตรา · 5.3 ฎีกา · 5.5 โครงข้อมูล (ROADMAP แถว 9b)
   ชุดตัวบท law-packs (แถว 9c): packFile / isGzip / preparePack / findSection / searchPack — ไม่ตัดข้อความ
   กฎเนื้อหา 5.0: ห้ามย่อ — parseDeka คืนข้อความเต็มเดิม, cleanDeka ตัดแค่เพดาน MAX_DEKA_TEXT

   คีย์ (ลงทะเบียนใน data-registry.js เหนือ {prefix:'tanot:'}):
     tanot:law:stars  sync map   '<code>:<มาตรา>' → {at}                          (ผ่าน cleanStars)
     tanot:law:cards  sync list  { id 'st-<code>-<มาตรา>-<a|b|c>' | 'dk-…', kind 'st'|'dk', ref, front?, cloze?[≤3],
                                   createdAt } + ฟิลด์ FSRS (stability difficulty reps lapses lastReview dueAt srsIdx)
                                   — makeCard(…, existing) สร้างซ้ำไม่ล้าง FSRS (แบบ books-calc.js)  (ผ่าน cleanCard)
     tanot:law:deka   sync list  { v:1, id, no, year, court 'ฎีกา'|'รธน'|'ปค', issue, rule, sections ['ppk:150'],
                                   subject, text (ข้อความเต็ม บังคับ), url, tags[], createdAt, updatedAt } (ผ่าน cleanDeka)
     tanot:law:track  sync blob  { v:1, exam 'neti1'|'neti2'|'lawyer'|'', newPerDay 1–50 }            (ผ่าน cleanTrack)
     tanot:law:ui     local      แท็บ/วิชาที่เปิดล่าสุด
   id ของฎีกา: 'dk-<เลข>-<ปี>' (ศาลฎีกา) · 'dk-rtn-…' (ศาลรัฐธรรมนูญ) · 'dk-pk-…' (ศาลปกครอง) · ไม่มีเลข = 'dk-h<แฮชข้อความ>'
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LawCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ตารางเดียวของประมวล/กฎหมาย — รหัสเป็นส่วนของคีย์ดาว/การ์ด ห้ามเปลี่ยน (เพิ่มได้ต่อท้าย)
  // subject = id ใน SUBJECTS ของ classroom-law.js
  var CODES = [
    { code: 'ppk', name: 'ประมวลกฎหมายแพ่งและพาณิชย์', short: 'ป.พ.พ.', subject: 'civil',
      alias: ['ป.พ.พ.', 'ประมวลกฎหมายแพ่งและพาณิชย์'] },
    { code: 'pa', name: 'ประมวลกฎหมายอาญา', short: 'ป.อ.', subject: 'criminal',
      alias: ['ป.อ.', 'ประมวลกฎหมายอาญา'] },
    { code: 'pvp', name: 'ประมวลกฎหมายวิธีพิจารณาความแพ่ง', short: 'ป.วิ.พ.', subject: 'civpro',
      alias: ['ป.วิ.พ.', 'ป.วิ.แพ่ง', 'ประมวลกฎหมายวิธีพิจารณาความแพ่ง'] },
    { code: 'pva', name: 'ประมวลกฎหมายวิธีพิจารณาความอาญา', short: 'ป.วิ.อ.', subject: 'crimpro',
      alias: ['ป.วิ.อ.', 'ป.วิ.อาญา', 'ประมวลกฎหมายวิธีพิจารณาความอาญา'] },
    { code: 'lawyer', name: 'พระราชบัญญัติทนายความ พ.ศ. 2528', short: 'พ.ร.บ.ทนายความ', subject: 'lawyer-act',
      alias: ['พ.ร.บ.ทนายความ', 'พระราชบัญญัติทนายความ'] },
    { code: 'ethics', name: 'ข้อบังคับสภาทนายความว่าด้วยมรรยาททนายความ พ.ศ. 2529', short: 'มรรยาททนายความ', subject: 'lawyer-act', unit: 'ข้อ',
      alias: ['ข้อบังคับสภาทนายความว่าด้วยมรรยาททนายความ', 'ข้อบังคับว่าด้วยมรรยาททนายความ', 'ข้อบังคับมรรยาททนายความ', 'มรรยาททนายความ'] },
    { code: 'court', name: 'พระธรรมนูญศาลยุติธรรม', short: 'พระธรรมนูญศาลยุติธรรม', subject: 'court',
      alias: ['พระธรรมนูญศาลยุติธรรม'] }
  ];
  var CODE_IDS = CODES.map(function (c) { return c.code; });
  var SUBJECT_IDS = ['civil', 'criminal', 'civpro', 'crimpro', 'evidence', 'court', 'constitution', 'lawyer-act', 'jkoa'];
  var COURTS = { 'ฎีกา': '', 'รธน': 'rtn', 'ปค': 'pk' };
  var EXAMS = ['neti1', 'neti2', 'lawyer'];
  var MAX_DEKA_TEXT = 200000, MAX_NOTE = 20000, MAX_FRONT = 2000, MAX_CLOZE = 3;

  var THAI = '\\u0E01-\\u0E4E';
  var SUFFIX = 'ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|อัฎฐ|นว|ทศ';
  // "172 ทวิ/1" (ป.วิ.อ.) = มาตราที่แทรกหลัง 172 ทวิ → canon "172ทวิ/1"
  var N_SRC = '(\\d{1,4}(?:\\s*\\/\\s*\\d{1,3})?)(?:\\s*(' + SUFFIX + ')(?![' + THAI + '])(?:\\s*\\/\\s*(\\d{1,3}))?)?';
  var N_CANON = '\\d{1,4}(?:\\/\\d{1,3})?(?:(?:ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|นว|ทศ)(?:\\/\\d{1,3})?)?';
  var CODE_ALT = CODE_IDS.join('|');
  var REF_RE = new RegExp('^(' + CODE_ALT + '):(' + N_CANON + ')$');
  var ST_RE = new RegExp('^st-(' + CODE_ALT + ')-(' + N_CANON + ')-([abc])$');
  var DK_RE = /^dk-(?:(?:rtn|pk)-)?\d{1,6}-\d{4}$|^dk-h[0-9a-z]{1,16}$/;

  function str(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  // เลขไทย → อารบิก (ความยาวเท่าเดิม ตำแหน่งในข้อความจึงตรงกับต้นฉบับ)
  function arabic(s) { return String(s).replace(/[๐-๙]/g, function (d) { return String(d.charCodeAt(0) - 0x0E50); }); }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
  function isThai(ch) { return !!ch && ch >= 'ก' && ch <= '๎'; }

  // ชื่อย่อมีจุด (ป.พ.พ.) → ไม่บังคับจุด/เว้นวรรค · ชื่อย่อสั้นต้องไม่อยู่กลางคำไทย ("โรคปอด" ไม่ใช่ ป.อ.)
  function aliasSrc(a) {
    if (a.indexOf('.') < 0) return esc(a).replace(/\s+/g, '\\s*');
    var toks = a.split('.').map(function (t) { return t.trim(); }).filter(Boolean);
    var src = toks.map(esc).join('\\.?\\s*');
    return toks[toks.length - 1].length <= 3 ? src + '(?:\\.|(?![' + THAI + ']))' : src + '\\.?';
  }
  var ALIASES = [];
  CODES.forEach(function (c) {
    c.alias.forEach(function (a) {
      ALIASES.push({ code: c.code, src: aliasSrc(a), len: a.length });
    });
  });
  ALIASES.sort(function (x, y) { return y.len - x.len; });
  ALIASES.forEach(function (a) { a.re = new RegExp('^(?:' + a.src + ')'); });
  var ALIAS_ALT = ALIASES.map(function (a) { return a.src; }).join('|');
  var TOKEN_SRC = '(' + ALIAS_ALT + ')|(มาตรา|ม\\.)|(ข้อ)';

  function aliasAt(t) { // ชื่อประมวลที่ต้นข้อความ → {code, len} | null
    for (var i = 0; i < ALIASES.length; i++) {
      var m = ALIASES[i].re.exec(t);
      if (m) return { code: ALIASES[i].code, len: m[0].length };
    }
    return null;
  }

  function normalizeCode(s) {
    if (typeof s !== 'string') return '';
    var t = arabic(s).trim(), low = t.toLowerCase();
    if (CODE_IDS.indexOf(low) >= 0) return low;
    var a = aliasAt(t);
    if (!a) return '';
    return /^\s*(?:พ\.?\s*ศ\.?\s*\d{4})?\s*$/.test(t.slice(a.len)) ? a.code : '';
  }

  function canonN(m) {
    var n = m[1].replace(/\s+/g, '');
    if (m[2]) n += m[2] === 'อัฎฐ' ? 'อัฏฐ' : m[2];
    if (m[2] && m[3]) n += '/' + m[3];
    return n;
  }
  var NUM_AT = new RegExp('^\\s*' + N_SRC);
  var SUBPART = /^\s*(?:\([0-9ก-ฮ]{1,3}\)|วรรค(?:หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|แรก|ท้าย|\s*\d+)|อนุมาตรา\s*\(?\d+\)?)/;
  var SEP_NUM = new RegExp('^\\s*(?:,|และ|หรือ|ถึง|–|-)\\s*(?:(?:มาตรา|ม\\.)\\s*)?' + N_SRC);
  var TRAIL = /^\s*(แห่ง|ของ|ตาม|ใน)?\s*/;

  // รายการเลขมาตราที่ตำแหน่ง pos: "150, 151 และ 154 วรรคหนึ่ง" / "142 (5) และมาตรา 55" → {ns, end} | null
  function parseList(t, pos) {
    var m = NUM_AT.exec(t.slice(pos));
    if (!m) return null;
    var ns = [canonN(m)];
    pos += m[0].length;
    for (;;) {
      var s;
      while ((s = SUBPART.exec(t.slice(pos)))) pos += s[0].length;
      var n = SEP_NUM.exec(t.slice(pos));
      if (!n) break;
      ns.push(canonN(n));
      pos += n[0].length;
    }
    return { ns: ns, end: pos };
  }

  // ทุกมาตราที่อ้างในข้อความ ตามลำดับ ไม่ซ้ำ → [{code, n}] (code '' = ไม่รู้ประมวล)
  function extractSections(text) {
    var t = arabic(text == null ? '' : String(text)), out = [], seen = {}, cur = '';
    var re = new RegExp(TOKEN_SRC, 'g'), m;
    function add(code, ns) {
      ns.forEach(function (n) {
        var k = code + ':' + n;
        if (!seen[k]) { seen[k] = 1; out.push({ code: code, n: n }); }
      });
    }
    while ((m = re.exec(t))) {
      var at = m.index, end = at + m[0].length, list = null, code = cur;
      if (m[1]) {
        var al = aliasAt(m[0]);
        // ชื่อย่อไม่มีจุดที่ติดท้ายคำไทย ("สปอ") ไม่ใช่ชื่อประมวล
        if (!al || (isThai(t.charAt(at - 1)) && m[0].indexOf('.') < 0 && m[0].length <= 8)) { re.lastIndex = at + 1; continue; }
        cur = code = al.code;
        list = parseList(t, end); // "ปพพ 150"
      } else if (m[2]) {
        if (m[2] === 'ม.' && isThai(t.charAt(at - 1))) { re.lastIndex = at + 1; continue; }
        list = parseList(t, end);
      } else {
        if (cur !== 'ethics') continue;
        list = parseList(t, end);
      }
      if (!list) continue;
      // ประมวลที่ตามหลัง: "มาตรา 150 แห่ง ป.พ.พ." / "ม.150 ปพพ" (ไม่มีคำเชื่อมใช้ได้เฉพาะเมื่อยังไม่รู้ประมวล)
      var tr = TRAIL.exec(t.slice(list.end)), after = aliasAt(t.slice(list.end + tr[0].length));
      if (after && (tr[1] || !cur)) cur = code = after.code;
      add(code, list.ns);
      re.lastIndex = list.end;
    }
    return out;
  }

  function parseSectionRef(text, dflt) {
    if (typeof text !== 'string') return null;
    var d = CODE_IDS.indexOf(dflt) >= 0 ? dflt : '';
    var list = extractSections(text);
    if (list.length) return { code: list[0].code || d, n: list[0].n };
    var m = new RegExp('^' + N_SRC + '\\s*$').exec(arabic(text).trim());
    return m ? { code: d, n: canonN(m) } : null;
  }
  function refKey(r) { return r && CODE_IDS.indexOf(r.code) >= 0 && new RegExp('^' + N_CANON + '$').test(r.n) ? r.code + ':' + r.n : ''; }

  /* ── ฎีกา ── */
  var DEKA_NO = [
    { court: 'ฎีกา', re: /(?:คำพิพากษา(?:ศาล)?ฎีกา|ฎีกา|ฎ\.)\s*(?:ที่)?\s*(\d{1,6})\s*\/\s*(\d{4})/ },
    { court: 'รธน', re: /คำวินิจฉัยศาลรัฐธรรมนูญ\s*(?:ที่)?\s*(\d{1,6})\s*\/\s*(\d{4})/ },
    { court: 'ปค', re: /(?:คำสั่ง|คำพิพากษา)ศาลปกครอง(?:สูงสุด)?\s*(?:ที่)?\s*(?:[อฟ]\.\s*)?(\d{1,6})\s*\/\s*(\d{4})/ }
  ];
  function validYear(y) { return /^\d{4}$/.test(y) && +y >= 2400 && +y <= 2700; }
  function dekaId(no, year, court) {
    if (!/^\d{1,6}$/.test(String(no)) || !validYear(String(year))) return '';
    var p = COURTS[court || 'ฎีกา'];
    return p == null ? '' : 'dk-' + (p ? p + '-' : '') + no + '-' + year;
  }
  // แฮช 53 บิต (cyrb53) → base36 — สูตรเดียวกับ lang-calc.js
  function hash53(s) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  // ข้อความฎีกาที่วาง → ช่องให้ผู้ใช้ตรวจก่อนบันทึก · text = ข้อความเดิมทุกตัวอักษร (ไม่ตัด ไม่ย่อ)
  function parseDeka(text) {
    var orig = text == null ? '' : String(text), t = arabic(orig);
    var best = null;
    DEKA_NO.forEach(function (p) {
      var m = p.re.exec(t);
      if (m && validYear(m[2]) && (!best || m.index < best.at)) best = { at: m.index, no: m[1], year: m[2], court: p.court };
    });
    var secs = extractSections(t), keys = [], bare = [], count = {}, first = {};
    secs.forEach(function (s, i) {
      if (!s.code) { if (bare.indexOf(s.n) < 0) bare.push(s.n); return; }
      keys.push(s.code + ':' + s.n);
      count[s.code] = (count[s.code] || 0) + 1;
      if (first[s.code] == null) first[s.code] = i;
    });
    var top = '';
    Object.keys(count).forEach(function (c) {
      if (!top || count[c] > count[top] || (count[c] === count[top] && first[c] < first[top])) top = c;
    });
    var norm = t.replace(/\s+/g, ' ').trim();
    var id = best ? dekaId(best.no, best.year, best.court) : (norm ? 'dk-h' + hash53(norm) : '');
    return {
      no: best ? best.no : '', year: best ? best.year : '', court: best ? best.court : 'ฎีกา', id: id,
      sections: keys, bare: bare, subject: top ? CODES[CODE_IDS.indexOf(top)].subject : '', text: orig
    };
  }

  function cleanDeka(d) {
    if (!isObj(d) || typeof d.id !== 'string' || !DK_RE.test(d.id)) return null;
    if (typeof d.text !== 'string' || !d.text.trim()) return null;
    var secs = [];
    (Array.isArray(d.sections) ? d.sections : []).forEach(function (s) {
      if (typeof s === 'string' && REF_RE.test(s) && secs.indexOf(s) < 0 && secs.length < 300) secs.push(s);
    });
    var tags = [];
    (Array.isArray(d.tags) ? d.tags : []).forEach(function (g) {
      var s = str(g, 50);
      if (s && tags.indexOf(s) < 0 && tags.length < 30) tags.push(s);
    });
    var url = str(d.url, 2000);
    return {
      v: 1, id: d.id,
      no: /^\d{1,6}$/.test(d.no) ? d.no : '', year: validYear(d.year) ? d.year : '',
      court: Object.prototype.hasOwnProperty.call(COURTS, d.court) ? d.court : 'ฎีกา',
      issue: str(d.issue, MAX_NOTE), rule: str(d.rule, MAX_NOTE), sections: secs,
      subject: SUBJECT_IDS.indexOf(d.subject) >= 0 ? d.subject : '',
      text: d.text.slice(0, MAX_DEKA_TEXT), url: /^https?:\/\//i.test(url) ? url : '', tags: tags,
      createdAt: num(d.createdAt) || 0, updatedAt: num(d.updatedAt) || 0
    };
  }

  /* ── เติมคำ (cloze) ── */
  var NUMW = '(?:หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ยี่|เอ็ด|ร้อย|พัน|หมื่น|แสน|ล้าน)+';
  var UNIT = '(?:ปี|เดือน|สัปดาห์|วัน|ชั่วโมง|นาที)';
  var DIGITS = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
  var KINDS = [
    { kind: 'time', src: '(?:' + DIGITS + '\\s*|' + NUMW + '\\s*)' + UNIT },
    { kind: 'num', src: DIGITS + '(?:\\s*(?:บาท|เท่า|คน|ครั้ง))?' },
    { kind: 'void', src: 'โมฆียะ|โมฆะ', word: true },
    { kind: 'modal', src: 'ต้อง|อาจ', word: true }
  ];
  function wordBounds(t, opts) {
    if ((opts && opts.noSegmenter) || typeof Intl === 'undefined' || !Intl.Segmenter) return null;
    var b = {};
    try {
      var it = new Intl.Segmenter('th', { granularity: 'word' }).segment(t);
      var arr = Array.from ? Array.from(it) : [];
      arr.forEach(function (s) { b[s.index] = 1; b[s.index + s.segment.length] = 1; });
    } catch (e) { return null; }
    return b;
  }
  // ใช้ทั้งมี/ไม่มีตัวตัดคำ (ICU ตัด "ถูกต้อง" เป็น ถูก|ต้อง): คำต้องไม่ต่อด้วยสระตาม/วรรณยุกต์ (อาจารย์) และ "ต้อง" ไม่อยู่ใน "ถูกต้อง"
  function fallbackWord(t, i, len) {
    if (/[ะ-ฺๅ-๎]/.test(t.charAt(i + len))) return false;
    return !(t.substr(i, len) === 'ต้อง' && t.slice(Math.max(0, i - 3), i) === 'ถูก');
  }

  // คำที่ควรซ่อน เรียง ระยะเวลา > ตัวเลข > โมฆะ/โมฆียะ > ต้อง/อาจ แล้วตามตำแหน่ง · ไม่ซ้อนกัน → [{t, i, kind}]
  function clozeCandidates(text, opts) {
    var orig = text == null ? '' : String(text), t = arabic(orig), bounds = wordBounds(t, opts), taken = [], out = [];
    KINDS.forEach(function (k) {
      var re = new RegExp(k.src, 'g'), m;
      while ((m = re.exec(t))) {
        var i = m.index, len = m[0].length;
        if (k.word && (!fallbackWord(t, i, len) || (bounds && !(bounds[i] && bounds[i + len])))) continue;
        if (taken.some(function (r) { return i < r[1] && i + len > r[0]; })) continue;
        taken.push([i, i + len]);
        out.push({ t: orig.substr(i, len), i: i, kind: k.kind });
      }
    });
    return out;
  }

  // ซ่อน 1–3 คำ: คำที่ผู้ใช้ไฮไลต์ (opts.words) ก่อน แล้วเติมจาก clozeCandidates → {cloze, parts, masked} | null
  function clozeCard(text, opts) {
    opts = opts || {};
    var t = text == null ? '' : String(text);
    var max = Math.max(1, Math.min(MAX_CLOZE, Math.round(+opts.max) || MAX_CLOZE)), picks = [];
    function free(i, len) { return !picks.some(function (p) { return i < p.i + p.t.length && i + len > p.i; }); }
    (Array.isArray(opts.words) ? opts.words : []).forEach(function (w) {
      if (typeof w !== 'string' || !w || picks.length >= max) return;
      var i = t.indexOf(w);
      if (i >= 0 && free(i, w.length)) picks.push({ t: w, i: i });
    });
    clozeCandidates(t, opts).forEach(function (c) {
      if (picks.length < max && free(c.i, c.t.length)) picks.push({ t: c.t, i: c.i });
    });
    if (!picks.length) return null;
    picks.sort(function (a, b) { return a.i - b.i; });
    var parts = [], pos = 0;
    picks.forEach(function (p, g) {
      if (p.i > pos) parts.push({ t: t.slice(pos, p.i) });
      parts.push({ gap: g, t: p.t });
      pos = p.i + p.t.length;
    });
    if (pos < t.length) parts.push({ t: t.slice(pos) });
    return {
      cloze: picks.map(function (p) { return p.t; }), parts: parts,
      masked: parts.map(function (p) { return p.gap != null ? '[___]' : p.t; }).join('')
    };
  }

  /* ── การ์ด ── */
  // {code, n, type:'a'|'b'|'c'} → 'st-ppk-150-a' · {no, year, court?} → 'dk-1234-2560' · ผิดรูปแบบ = ''
  function cardId(o) {
    if (!isObj(o)) return '';
    if (o.no != null) return dekaId(String(o.no), String(o.year), o.court);
    var k = refKey(o);
    return k && /^[abc]$/.test(o.type) ? 'st-' + o.code + '-' + o.n + '-' + o.type : '';
  }
  function cleanCloze(a) {
    return Array.isArray(a) ? a.filter(function (w) { return typeof w === 'string' && w.trim(); })
      .map(function (w) { return w.slice(0, 200); }).slice(0, MAX_CLOZE) : [];
  }
  // ใหม่ = ยังไม่มีฟิลด์ FSRS, dueAt = ตอนสร้าง · สร้างซ้ำ/แก้หน้าการ์ด → ส่งการ์ดเดิมเข้า existing (ไม่ล้างตารางทบทวน)
  function makeCard(spec, now, existing) {
    var id = cardId(spec);
    if (!id) return null;
    var c = Object.assign({}, existing || {}), dk = id.indexOf('dk-') === 0;
    c.id = id; c.kind = dk ? 'dk' : 'st'; c.ref = dk ? id : spec.code + ':' + spec.n;
    var front = str(spec.front, MAX_FRONT), cloze = cleanCloze(spec.cloze);
    if (front) c.front = front;
    if (cloze.length) c.cloze = cloze;
    if (!existing) { c.createdAt = now; c.dueAt = now; }
    return c;
  }
  function cleanCard(c) {
    if (!isObj(c) || typeof c.id !== 'string') return null;
    var st = ST_RE.exec(c.id), kind = st ? 'st' : DK_RE.test(c.id) ? 'dk' : '';
    if (!kind || c.kind !== kind || c.ref !== (st ? st[1] + ':' + st[2] : c.id) || num(c.dueAt) == null) return null;
    var o = { id: c.id, kind: kind, ref: c.ref };
    var front = str(c.front, MAX_FRONT), cloze = cleanCloze(c.cloze);
    if (front) o.front = front;
    if (cloze.length) o.cloze = cloze;
    ['createdAt', 'stability', 'difficulty', 'lastReview', 'dueAt'].forEach(function (k) { if (num(c[k]) != null) o[k] = c[k]; });
    ['reps', 'lapses', 'srsIdx'].forEach(function (k) { if (num(c[k]) != null && c[k] >= 0 && c[k] % 1 === 0) o[k] = c[k]; });
    return o;
  }

  function cleanStars(m) {
    var o = {};
    if (!isObj(m)) return o;
    Object.keys(m).forEach(function (k) {
      var v = m[k];
      if (REF_RE.test(k) && isObj(v) && num(v.at) != null) o[k] = { at: v.at };
    });
    return o;
  }
  function cleanTrack(t) {
    t = isObj(t) ? t : {};
    var n = Math.round(Number(t.newPerDay));
    return { v: 1, exam: EXAMS.indexOf(t.exam) >= 0 ? t.exam : '', newPerDay: isFinite(n) && t.newPerDay != null ? Math.max(1, Math.min(50, n)) : 10 };
  }

  // ── ชุดตัวบท law-packs (ROADMAP แถว 9c · แบบ 5.4/5.5) ─────────────────────────────────────────
  // ไฟล์ law-packs/<code>-<hash>.json.gz จาก tools/law-data: {v:1, code, name, src, asOf, s:[{n, b, t, f?}], x?:[{h, t}]}
  // f = เชิงอรรถของมาตรา (ประวัติการแก้ไข) · x = ส่วนท้าย (บัญชี/อัตราท้ายพระราชบัญญัติ — เป็นตัวบท)
  // กฎ 5.0 ห้ามย่อ: preparePack ไม่ตัดข้อความ — รายการที่ผิดรูปแบบหรือยาวเกินเพดานถูกทิ้งทั้งรายการ ไม่ถูกตัดสั้น
  var MAX_PACK_SECTIONS = 6000, MAX_SECTION_TEXT = 100000, MAX_PACK_HEAD = 500, MAX_PACK_SRC = 500;
  var N_ONLY = new RegExp('^' + N_CANON + '$');

  // ชื่อไฟล์จาก index.json ใช้ได้เฉพาะรูป <code>-<hex>.json(.gz) ของรหัสนั้น (กันข้อมูลชี้ไปที่อื่น)
  function packFile(index, code) {
    if (CODE_IDS.indexOf(code) < 0) return null;
    var p = index && isObj(index.packs) && Object.prototype.hasOwnProperty.call(index.packs, code) ? index.packs[code] : null;
    var f = p && typeof p.file === 'string' ? p.file : '';
    return new RegExp('^' + code + '-[0-9a-f]{6,64}\\.json(\\.gz)?$').test(f) ? 'law-packs/' + f : null;
  }
  function isGzip(bytes) { return !!bytes && bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b; }

  function textOk(v, max) { return typeof v === 'string' && v.length > 0 && v.length <= max; }
  // ข้อมูลภายนอก → ชุดที่ใช้ได้ หรือ null (รุ่น/รหัสไม่ตรง/ไม่มีมาตราที่ใช้ได้)
  // ชื่อมาจาก CODES (ไม่เชื่อชื่อในไฟล์) · มาตราซ้ำเก็บตัวแรก · ลำดับคงตามไฟล์ · byN = ดัชนีเลขมาตรา → ลำดับใน s
  function preparePack(raw, code) {
    if (!isObj(raw) || raw.v !== 1 || CODE_IDS.indexOf(raw.code) < 0 || (code && raw.code !== code) || !Array.isArray(raw.s)) return null;
    var c = CODES[CODE_IDS.indexOf(raw.code)];
    var s = [], byN = Object.create(null);
    for (var i = 0; i < raw.s.length && s.length < MAX_PACK_SECTIONS; i++) {
      var r = raw.s[i];
      if (!isObj(r) || typeof r.n !== 'string' || !N_ONLY.test(r.n) || byN[r.n] != null || !textOk(r.t, MAX_SECTION_TEXT)) continue;
      var o = { n: r.n, b: typeof r.b === 'string' ? r.b.slice(0, MAX_PACK_HEAD) : '', t: r.t };
      if (Array.isArray(r.f)) {
        var f = r.f.filter(function (x) { return textOk(x, MAX_NOTE); });
        if (f.length) o.f = f;
      }
      byN[r.n] = s.length;
      s.push(o);
    }
    if (!s.length) return null;
    var pack = { v: 1, code: c.code, name: c.name, src: str(raw.src, MAX_PACK_SRC),
      asOf: /^\d{4}-\d{2}-\d{2}$/.test(raw.asOf) ? raw.asOf : '', s: s, byN: byN };
    if (Array.isArray(raw.x)) {
      var x = raw.x.filter(function (e) { return isObj(e) && textOk(e.h, MAX_PACK_HEAD) && textOk(e.t, MAX_SECTION_TEXT); })
        .map(function (e) { return { h: e.h, t: e.t }; });
      if (x.length) pack.x = x;
    }
    return pack;
  }

  // เลขที่ผู้ใช้พิมพ์ ("๑๕๐", "150 / 1", "7 ทวิ", "มาตรา 52", "ข้อ 21") → เลขแบบ canon หรือ ''
  function packN(q, code) {
    if (typeof q !== 'string') return '';
    var r = parseSectionRef(q, code) || parseSectionRef(q.replace(/^\s*(?:มาตรา|ม\.|ข้อ)\s*/, ''), code);
    return r && (!r.code || r.code === code) && N_ONLY.test(r.n) ? r.n : '';
  }
  function findSection(pack, n) {
    if (!pack || !pack.byN) return null;
    var k = packN(String(n == null ? '' : n), pack.code);
    return k && pack.byN[k] != null ? pack.s[pack.byN[k]] : null;
  }

  // ค้นในชุด: เลขมาตรา (ถ้าพิมพ์เป็นเลข) ขึ้นก่อน แล้วค้นคำในข้อความ/หัวหมวด
  // เลขไทย/อารบิกเทียบกันได้ ไม่สนช่องว่างซ้ำ/ตัวพิมพ์ละติน → [{n, b, exact?, at, len, pre, hit, post}] ≤ limit
  function foldSearch(s) { return arabic(String(s).normalize('NFC')).toLowerCase(); }
  function searchPack(pack, q, opts) {
    var out = [];
    if (!pack || !pack.s || typeof q !== 'string' || !q.trim()) return out;
    var limit = opts && opts.limit > 0 ? opts.limit : 50, ctx = opts && opts.ctx > 0 ? opts.ctx : 40;
    // เลขอย่างเดียว ("52", "มาตรา ๕๒", "ข้อ 21") — ข้อความยาวที่มีคำว่ามาตราอยู่กลางประโยคเป็นการค้นคำ
    var hit = q.length <= 24 && /^\s*(?:มาตรา|ม\.|ข้อ)?\s*[0-9๐-๙]/.test(q) ? findSection(pack, q) : null;
    if (hit) out.push({ n: hit.n, b: hit.b, exact: true, at: 0, len: 0, pre: '', hit: '', post: hit.t.slice(0, ctx * 2) });
    var words = foldSearch(q).trim().split(/\s+/).map(esc);
    var re = new RegExp(words.join('\\s+'));
    for (var i = 0; i < pack.s.length && out.length < limit; i++) {
      var sec = pack.s[i];
      if (hit && sec === hit) continue;
      var t = sec.t, m = re.exec(foldSearch(t)); // arabic() เปลี่ยนเลขทีละตัว — ตำแหน่งตรงกับข้อความเดิม
      if (!m) {
        if (re.test(foldSearch(sec.b))) out.push({ n: sec.n, b: sec.b, at: 0, len: 0, pre: '', hit: '', post: t.slice(0, ctx * 2) });
        continue;
      }
      out.push({ n: sec.n, b: sec.b, at: m.index, len: m[0].length,
        pre: t.slice(Math.max(0, m.index - ctx), m.index), hit: t.substr(m.index, m[0].length), post: t.substr(m.index + m[0].length, ctx) });
    }
    return out;
  }

  // ── ท่องมาตรา (ROADMAP แถว 9d/9e · แบบ 5.2) ─────────────────────────────────────────────────────
  var DAY = 86400000;
  // 'lawyer','52' → 'พ.ร.บ.ทนายความ มาตรา 52' (bare = 'มาตรา 52') · ข้อบังคับใช้ "ข้อ" · รหัสไม่รู้จัก = ''
  function secLabel(code, n, bare) {
    var c = CODES[CODE_IDS.indexOf(code)];
    return c ? (bare ? '' : c.short + ' ') + (c.unit || 'มาตรา') + ' ' + n : '';
  }
  // มาตราที่ติดดาว → การ์ด ก (เลข→หลัก) · ข (เติมคำ — เฉพาะเมื่อมีคำให้ซ่อน) · ค (หลัก→เลข)
  // ถึงกำหนดทยอยวันละแบบ (ไม่ให้ 3 ใบของมาตราเดียวโผล่ติดกัน) · existing = {id: การ์ดเดิม} → ไม่ล้างตารางทบทวน
  function starCards(code, sec, now, existing) {
    if (!sec || typeof sec.t !== 'string' || CODE_IDS.indexOf(code) < 0) return [];
    var out = [], ex = isObj(existing) ? existing : {}, cz = clozeCard(sec.t);
    ['a', 'b', 'c'].forEach(function (type, i) {
      if (type === 'b' && !cz) return;
      var spec = { code: code, n: sec.n, type: type, cloze: type === 'b' ? cz.cloze : null };
      var id = cardId(spec), old = id && Object.prototype.hasOwnProperty.call(ex, id) ? ex[id] : null;
      var c = makeCard(spec, now, old || null);
      if (!c) return;
      if (!old) c.dueAt = now + i * DAY;
      out.push(c);
    });
    return out;
  }
  // หน้าการ์ดมาตรา (review.html) จากชุดตัวบท — ข้อความเต็มไม่ตัด · ไม่มีมาตรานั้นในชุด = null
  function cardFace(card, pack) {
    var st = card && typeof card.id === 'string' ? ST_RE.exec(card.id) : null;
    if (!st || !pack || pack.code !== st[1]) return null;
    var sec = findSection(pack, st[2]);
    if (!sec) return null;
    var label = secLabel(st[1], sec.n), t = sec.t, sub = sec.b || '';
    if (st[3] === 'a') return { front: label, back: t, sub: sub };
    if (st[3] === 'c') return { front: card.front || t, back: label, sub: sub };
    var words = (card.cloze || []).filter(function (w) { return t.indexOf(w) >= 0; });
    var cz = clozeCard(t, { words: words, max: words.length || MAX_CLOZE }) || clozeCard(t);
    if (!cz) return { front: label, back: t, sub: sub };
    return { front: cz.masked, back: cz.cloze.join(' · ') + '\n\n' + t, sub: sub };
  }

  return {
    secLabel: secLabel, starCards: starCards, cardFace: cardFace,
    packFile: packFile, isGzip: isGzip, preparePack: preparePack, findSection: findSection, searchPack: searchPack,
    MAX_SECTION_TEXT: MAX_SECTION_TEXT,
    CODES: CODES, SUBJECT_IDS: SUBJECT_IDS, EXAMS: EXAMS, MAX_DEKA_TEXT: MAX_DEKA_TEXT,
    normalizeCode: normalizeCode, parseSectionRef: parseSectionRef, extractSections: extractSections, refKey: refKey,
    parseDeka: parseDeka, dekaId: dekaId, cleanDeka: cleanDeka,
    clozeCandidates: clozeCandidates, clozeCard: clozeCard,
    cardId: cardId, makeCard: makeCard, cleanCard: cleanCard, cleanStars: cleanStars, cleanTrack: cleanTrack
  };
});
