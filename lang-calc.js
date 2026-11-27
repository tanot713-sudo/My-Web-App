/* ══════════════════════════════════════════════════════════════════
   ตรรกะล้วนของหน้าเรียนภาษา (docs/languages-design.md §3, L1 = ROADMAP แถว 22) — ไม่มี DOM/storage/เครือข่าย
   ใช้ได้ทั้งในหน้า (window.LangCalc, โหลดก่อน languages.compiled.js) และ Node (require ในเทสต์)

   ชุดคำ (pack) จาก tools/lang-data (L0) รูปแบบ v2 — lang-packs/<lang>-<hash8>.json.gz (+ index.json ไม่บีบ):
     { v, lang, src, w:[{id, r, th, ipa, g?}], s:[{id, t, th, en, au}] }
     w.id = คำ NFC ตัวพิมพ์เล็ก · r = อันดับความถี่ (ระดับคิดจาก r ด้วย LEVEL_BANDS) · g = gloss อังกฤษเมื่อไม่มีไทย
     s.id = id ประโยคของ Tatoeba · คำในประโยคไม่อยู่ในไฟล์ — หน้าตัดคำเองด้วย tokenize() (กฎเดียวกับตัวสร้าง)
   ⚠️ LEVEL_BANDS / tokenize / LANG_CODE ต้องตรงกับ tools/lang-data/lib.js (เทสต์ languages-packs.spec.js เทียบ)
   ข้อมูลในไฟล์มาจากแหล่งภายนอก → prepare() ตรวจทุกช่องก่อนใช้ (ช่องผิดรูป = ทิ้งแถวนั้น)

   คีย์การ์ด (lang-practice:srs) ไม่อิงดัชนี: `${langId}::w::${คำ}` / `${langId}::s::${id ประโยค}` — สร้างไฟล์ใหม่แล้วการ์ดเดิมยังตรง
   คำแปลไทยจาก AI: tanot:lang:th (cache) = {v:1, m:{คีย์การ์ด: คำแปล}}
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LangCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // [อันดับสูงสุดของช่วง, ระดับ] — เกินช่วงสุดท้าย = ระดับ 6 · ระดับ 1–6 = A1–C2
  var LEVEL_BANDS = [[500, 1], [1200, 2], [2500, 3], [5000, 4], [8000, 5]];
  var LEVEL_NAMES = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  // รหัสภาษาที่ตัวสร้างใช้ตัดคำ (lib.js LANGS[id].code)
  var LANG_CODE = {
    'lang-en': 'en', 'lang-jp': 'ja', 'lang-cn': 'zh', 'lang-yue': 'yue', 'lang-kr': 'ko', 'lang-de': 'de', 'lang-in': 'hi',
    'lang-fr': 'fr', 'lang-it': 'it', 'lang-mm': 'my', 'lang-kh': 'km', 'lang-la': 'lo', 'lang-vn': 'vi', 'lang-my': 'ms',
    'lang-ar': 'ar', 'lang-es': 'es', 'lang-pt': 'pt', 'lang-ru': 'ru'
  };
  var SEGMENTED = { ja: 1, zh: 1, yue: 1, km: 1, lo: 1, my: 1 };
  var MAX_ROWS = 5000;        // เพดานแถวต่อชนิดที่ยอมรับจากไฟล์ (ตัวสร้างทำ ≤ 3,000)
  var AI_BATCH = 20;          // ส่งแปลไทยทีละไม่เกิน 20 รายการ
  var TH_CACHE_MAX = 6000;    // tanot:lang:th เก็บได้ไม่เกินเท่านี้ (เกิน = ตัดรายการเก่าสุด)

  // \p{…} ต้องห่อ try (เบราว์เซอร์เก่าพาร์สไม่ได้) — ไม่มี = ตัวอักษรละติน/ไทย/CJK พื้นฐานแทน
  var WORD_RE, LETTER_RE, ID_RE;
  try {
    WORD_RE = new RegExp("[\\p{L}\\p{M}]+(?:['’][\\p{L}\\p{M}]+)*", 'gu');
    LETTER_RE = new RegExp('[\\p{L}\\p{M}]', 'u');
    ID_RE = new RegExp("^[\\p{L}\\p{M}]+(?:'[\\p{L}\\p{M}]+)*$", 'u');
  } catch (e) {
    var L = 'A-Za-z\\u00C0-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF\\u0600-\\u06FF\\u0900-\\u0DFF\\u0E00-\\u0EFF\\u1000-\\u109F\\u1780-\\u17FF\\u3040-\\u30FF\\u3400-\\u9FFF\\uAC00-\\uD7AF';
    WORD_RE = new RegExp('[' + L + "]+(?:['’][" + L + ']+)*', 'g');
    LETTER_RE = new RegExp('[' + L + ']');
    ID_RE = new RegExp('^[' + L + "]+(?:'[" + L + ']+)*$');
  }

  function levelOf(rank) {
    for (var i = 0; i < LEVEL_BANDS.length; i++) if (rank <= LEVEL_BANDS[i][0]) return LEVEL_BANDS[i][1];
    return 6;
  }
  function norm(s) { return String(s).normalize('NFC').toLowerCase(); }

  // ตัดคำแบบเดียวกับ tools/lang-data/lib.js tokenize (คำที่ได้ = รูปเดียวกับ w.id)
  function tokenize(text, code) {
    var t = String(text).normalize('NFC'), out = [], i;
    if (SEGMENTED[code] && typeof Intl !== 'undefined' && Intl.Segmenter) {
      var it = new Intl.Segmenter(code, { granularity: 'word' }).segment(t)[Symbol.iterator](), n;
      while (!(n = it.next()).done) if (n.value.isWordLike && LETTER_RE.test(n.value.segment)) out.push(norm(n.value.segment));
      return out;
    }
    WORD_RE.lastIndex = 0;
    var m = t.match(WORD_RE) || [];
    for (i = 0; i < m.length; i++) out.push(norm(m[i]).replace(/’/g, "'"));
    return out;
  }

  // ชื่อไฟล์จาก index.json ใช้ได้เฉพาะรูป <lang>-<hash>.json(.gz) (กันข้อมูลชี้ไปที่อื่น)
  function packFile(index, langId) {
    var p = index && index.packs && Object.prototype.hasOwnProperty.call(index.packs, langId) ? index.packs[langId] : null;
    var f = p && typeof p.file === 'string' ? p.file : '';
    if (!/^lang-[a-z]+-[0-9a-f]{6,64}\.json(\.gz)?$/.test(f) || f.indexOf(langId + '-') !== 0) return null;
    return 'lang-packs/' + f;
  }
  function isGzip(bytes) { return !!bytes && bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b; }

  function cardKey(langId, kind, id) { return langId + '::' + kind + '::' + id; }
  function parseKey(key) {
    var m = /^(lang-[a-z]+)::([ws])::(.+)$/.exec(String(key || ''));
    return m ? { langId: m[1], kind: m[2], id: m[3] } : null;
  }

  function str(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }

  /* ไฟล์ดิบ → ชุดที่ตรวจแล้ว: words/sents เรียงตายตัว (คำตามอันดับ, ประโยคตาม id) ไม่ขึ้นกับลำดับในไฟล์
     คืน null เมื่อไฟล์ไม่ใช่ชุดของภาษานี้ */
  function prepare(pack, langId) {
    if (!pack || typeof pack !== 'object' || (pack.v !== 1 && pack.v !== 2) || pack.lang !== langId) return null;
    var code = LANG_CODE[langId] || '';
    var words = [], rank = {}, seen = {}, i;
    var w = Array.isArray(pack.w) ? pack.w.slice(0, MAX_ROWS) : [];
    for (i = 0; i < w.length; i++) {
      var x = w[i];
      if (!x || typeof x.id !== 'string' || !(x.r > 0) || Math.floor(x.r) !== x.r) continue;
      var id = norm(x.id);
      if (!id || id.length > 64 || !ID_RE.test(id) || Object.prototype.hasOwnProperty.call(seen, id)) continue;
      seen[id] = 1;
      words.push({ kind: 'w', id: id, key: cardKey(langId, 'w', id), r: x.r, lv: levelOf(x.r), t: id, th: str(x.th, 200), ipa: str(x.ipa, 80), en: str(x.g, 200) });
    }
    words.sort(function (a, b) { return a.r - b.r || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    for (i = 0; i < words.length; i++) if (!Object.prototype.hasOwnProperty.call(rank, words[i].id)) rank[words[i].id] = words[i].r;
    var sents = [], sseen = {}, byWord = {};
    var s = Array.isArray(pack.s) ? pack.s.slice(0, MAX_ROWS) : [];
    for (i = 0; i < s.length; i++) {
      var y = s[i];
      if (!y || !(y.id > 0) || Math.floor(y.id) !== y.id || sseen[y.id]) continue;
      var t = str(y.t, 300);
      if (!t) continue;
      var toks = tokenize(t, code), lv = 0;
      for (var j = 0; j < toks.length; j++) if (Object.prototype.hasOwnProperty.call(rank, toks[j])) lv = Math.max(lv, levelOf(rank[toks[j]]));
      sseen[y.id] = 1;
      sents.push({ kind: 's', id: String(y.id), key: cardKey(langId, 's', y.id), n: y.id, lv: lv || 6, t: t, th: str(y.th, 300), en: str(y.en, 300), au: y.au ? 1 : 0, toks: toks });
    }
    sents.sort(function (a, b) { return a.n - b.n; });
    sents.forEach(function (x, k) {
      var u = {};
      x.toks.forEach(function (tk) {
        if (u[tk]) return;
        u[tk] = 1;
        (byWord[tk] = byWord[tk] || []).push(k);
      });
    });
    var levels = [0, 0, 0, 0, 0, 0, 0];
    words.forEach(function (x) { levels[x.lv]++; });
    return { langId: langId, code: code, words: words, sents: sents, byWord: byWord, levels: levels };
  }

  function listOf(prep, kind) { return !prep ? [] : kind === 's' ? prep.sents : prep.words; }

  // ของใหม่ (ยังไม่มีการ์ดใน srs) ระดับที่เลือก ตามลำดับความถี่ (ประโยค: ตาม id) — level 0 = ทุกระดับ
  function pickNew(prep, srs, opts) {
    opts = opts || {};
    var n = opts.n == null ? 10 : opts.n, out = [], list = listOf(prep, opts.kind || 'w');
    for (var i = 0; i < list.length && out.length < n; i++) {
      var it = list[i];
      if (opts.level && it.lv !== opts.level) continue;
      if (srs && Object.prototype.hasOwnProperty.call(srs, it.key)) continue;
      out.push(it);
    }
    return out;
  }

  // การ์ดชุดนี้ที่ถึงกำหนดทวน (เก่าสุดก่อน) — ไม่กรองระดับ (การ์ดที่เคยเรียนต้องได้ทวนเสมอ)
  function dueItems(prep, srs, opts) {
    opts = opts || {};
    var now = opts.now == null ? Date.now() : opts.now, out = [], list = listOf(prep, opts.kind || 'w');
    for (var i = 0; i < list.length; i++) {
      var r = srs && srs[list[i].key];
      if (r && typeof r === 'object' && Number(r.dueAt) <= now) out.push([Number(r.dueAt), list[i]]);
    }
    out.sort(function (a, b) { return a[0] - b[0] || (a[1].key < b[1].key ? -1 : 1); });
    return out.map(function (e) { return e[1]; });
  }

  // คิวของรอบ: การ์ดที่ถึงกำหนดก่อน แล้วต่อด้วยของใหม่จนครบ n
  function queue(prep, srs, opts) {
    opts = opts || {};
    var n = opts.n || 10;
    var due = dueItems(prep, srs, opts).slice(0, n);
    return due.concat(pickNew(prep, srs, { kind: opts.kind, level: opts.level, n: n - due.length }));
  }

  // ประโยคที่มีคำนี้ (สั้นก่อน แล้วตาม id)
  function sentencesFor(prep, wordId, n) {
    var idx = (prep && prep.byWord[norm(wordId)]) || [];
    var list = idx.map(function (k) { return prep.sents[k]; });
    list.sort(function (a, b) { return a.toks.length - b.toks.length || a.n - b.n; });
    return list.slice(0, n == null ? 3 : n);
  }

  // รูปเดียวกับ vocabPool() ของหน้า ({key, word, thai, extra})
  function toPoolItems(prep, kind, thCache) {
    return listOf(prep, kind || 'w').map(function (it) {
      return { key: it.key, word: it.t, thai: thaiOf(it, thCache).text, extra: it };
    });
  }

  function thMap(thCache) { return thCache && thCache.m && typeof thCache.m === 'object' ? thCache.m : {}; }
  // คำแปลที่จะแสดง: ไทยในไฟล์ → ไทยจาก AI (src 'ai') → อังกฤษ (src 'en') → ว่าง
  function thaiOf(it, thCache) {
    if (it.th) return { text: it.th, src: 'pack' };
    var m = thMap(thCache);
    if (typeof m[it.key] === 'string' && m[it.key]) return { text: m[it.key], src: 'ai' };
    if (it.en) return { text: it.en, src: 'en' };
    return { text: '', src: '' };
  }
  // IPA ตามที่มีในไฟล์ (kaikki ใส่ /…/ หรือ […] มาแล้ว) — ไม่มีวงเล็บ/ทับเลยค่อยครอบ /…/
  function ipaText(ipa) {
    var t = String(ipa || '').trim();
    if (!t) return '';
    return /^[\/\[]|[\/\]]$/.test(t) ? t : '/' + t + '/';
  }
  function face(it, thCache) { return [it.t, thaiOf(it, thCache).text]; }
  function missingThai(items, thCache) {
    var m = thMap(thCache);
    return (items || []).filter(function (it) { return it && !it.th && !(typeof m[it.key] === 'string' && m[it.key]); });
  }

  // ข้อความส่ง AI (task 'lang-th', โมเดล fast) — ตอบเป็น JSON array ของคำแปลตามลำดับ
  function thMessages(items, langName) {
    var list = (items || []).slice(0, AI_BATCH).map(function (it, i) {
      return (i + 1) + '. ' + it.t + (it.en ? ' (English: ' + it.en + ')' : '');
    }).join('\n');
    return [
      { role: 'system', content: 'You translate ' + (langName || 'foreign') + ' words and sentences into natural Thai for a Thai learner. ' +
        'Reply with a JSON array of strings only — one Thai translation per numbered line, in the same order. No notes, no romanization.' },
      { role: 'user', content: list }
    ];
  }
  // ผล AI → อาร์เรย์คำแปลยาว n (ช่องที่อ่านไม่ได้ = '') · ทนโค้ดบล็อก/ข้อความนำหน้า/บรรทัดเลขข้อ
  function parseTh(text, n) {
    var out = [], i, s = String(text || '');
    for (i = 0; i < n; i++) out.push('');
    var a = s.indexOf('['), b = s.lastIndexOf(']'), arr = null;
    if (a >= 0 && b > a) { try { arr = JSON.parse(s.slice(a, b + 1)); } catch (e) { arr = null; } }
    if (Array.isArray(arr)) {
      for (i = 0; i < n && i < arr.length; i++) out[i] = typeof arr[i] === 'string' ? arr[i].trim().slice(0, 300) : '';
      return out;
    }
    s.split(/\r?\n/).forEach(function (line) {
      var m = /^\s*(\d+)[.)]\s*(.+)$/.exec(line);
      if (m && +m[1] >= 1 && +m[1] <= n) out[+m[1] - 1] = m[2].trim().slice(0, 300);
    });
    return out;
  }
  // รวมผลแปลเข้าแคช (คืนก้อนใหม่ ไม่แก้ของเดิม) — ทับเฉพาะช่องที่ได้คำแปล, เกินเพดานตัดรายการเก่าสุด (ลำดับการใส่)
  function mergeTh(thCache, items, results) {
    var m = {}, old = thMap(thCache), k;
    for (k in old) if (Object.prototype.hasOwnProperty.call(old, k) && typeof old[k] === 'string') m[k] = old[k];
    (items || []).forEach(function (it, i) {
      var t = results && results[i];
      if (it && typeof t === 'string' && t) { delete m[it.key]; m[it.key] = t; }
    });
    var keys = Object.keys(m);
    for (var j = 0; j < keys.length - TH_CACHE_MAX; j++) delete m[keys[j]];
    return { v: 1, m: m };
  }
  function chunk(list, size) {
    var out = [];
    for (var i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  }


  // ── L4 ซับไตเติล ──────────────────────────────────────────────────────────────
  // parseSubs(text) → [{start,end,text}] (วินาที) · pairSubs(a, b) → a + {thai} · similarity/band = คะแนนพูดตาม
  // รูปแบบ: SRT + WebVTT · ไฟล์ของผู้ใช้อยู่ในเครื่องเท่านั้น (ฟังก์ชันพวกนี้ไม่แตะเครือข่าย/storage)
  var subs = (function () {
    var NOSPACE = /[\u3000-\u30FF\u3400-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/; // ญี่ปุ่น/จีน — ต่อบรรทัดไม่ใส่ช่องว่าง (ไทย/อังกฤษใส่ — ตัดบรรทัดซับมักอยู่ที่ขอบวลี)
    var TIMING = /^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)/;
    var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', lrm: '', rlm: '' };

    // 'hh:mm:ss,mmm' | 'mm:ss.mmm' | 'h:mm:ss' → ms · ไม่ใช่เวลา/นาทีหรือวินาที ≥ 60 = null
    function toMs(s) {
      var m = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(s);
      if (!m) return null;
      var mi = +m[2], se = +m[3];
      if (mi > 59 || se > 59) return null;
      return (((m[1] ? +m[1] : 0) * 60 + mi) * 60 + se) * 1000 + (m[4] ? +(m[4] + '00').slice(0, 3) : 0);
    }
    function clean(line) {
      return line.replace(/\{\\[^}]*\}/g, '').replace(/<[^>]*>/g, '')
        .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (all, e) {
          if (e.charAt(0) === '#') { var n = e.charAt(1).toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
          var k = e.toLowerCase();
          return Object.prototype.hasOwnProperty.call(ENT, k) ? ENT[k] : all;
        }).replace(/\s+/g, ' ').trim();
    }
    function join(lines) {
      var out = '';
      lines.forEach(function (l) {
        if (!l) return;
        out += out && !(NOSPACE.test(out.slice(-1)) && NOSPACE.test(l.charAt(0))) ? ' ' + l : l;
      });
      return out;
    }

    // ไบต์ของไฟล์ซับ → ข้อความ: UTF-8 ก่อน (TextDecoder ตัด BOM เอง) · มีตัวถอดไม่ได้ (U+FFFD) → ลองรหัสเดิมของภาษานั้น (ซับไทยจำนวนมากเป็น TIS-620 = windows-874 ค่าเริ่มต้น)
    // legacy: label ของ TextDecoder (windows-1252, shift_jis, gbk …) · null = ไม่ลอง · เบราว์เซอร์ไม่รู้จัก label/ยังเป็น U+FFFD = คืนผล UTF-8 เดิม
    // shortcut: ไม่ตรวจ UTF-16/ไม่เดารหัสเอง — ผู้เรียกเป็นคนบอกรหัสตามภาษา · เปลี่ยนเมื่อมีผู้ใช้เจอซับ UTF-16 จริง
    function decode(bytes, legacy) {
      var u = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
      var text = new TextDecoder('utf-8').decode(u);
      if (text.indexOf('\uFFFD') < 0) return text;
      var label = legacy === undefined ? 'windows-874' : legacy;
      if (!label) return text;
      try { var alt = new TextDecoder(label).decode(u); return alt.indexOf('\uFFFD') < 0 ? alt : text; } catch (e) { return text; }
    }

    function parseSubs(text) {
      if (typeof text !== 'string') return [];
      var lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/), cues = [], cur = null, skip = false;
      function close() { if (cur) { var t = join(cur.lines); if (t) cues.push({ start: cur.start / 1000, end: cur.end / 1000, text: t }); } cur = null; }
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i], tm = TIMING.exec(ln);
        if (tm) {
          close(); skip = false;
          var a = toMs(tm[1]), b = toMs(tm[2]);
          if (a === null || b === null || b <= a) skip = true; else cur = { start: a, end: b, lines: [] };
        } else if (!ln.trim()) { close(); skip = false; }
        else if (cur && !skip) {
          // SRT ที่ลืมบรรทัดว่างคั่น: เลขลำดับของ cue ถัดไปไม่ใช่ข้อความ
          if (/^\s*\d+\s*$/.test(ln) && i + 1 < lines.length && TIMING.test(lines[i + 1])) continue;
          cur.lines.push(clean(ln));
        }
      }
      close();
      return cues.map(function (c, i) { return { c: c, i: i }; })
        .sort(function (x, y) { return x.c.start - y.c.start || x.i - y.i; })
        .map(function (x) { return x.c; });
    }

    // จับซับที่สอง (ไทย) เข้ากับซับหลักตามเวลาซ้อนทับมากสุด (เสมอ = cue แรก) · ไม่ซ้อนเลย = cue ที่ห่าง ≤ maxGap วิ
    // shortcut: O(n·m) · ซับหลักหลายหมื่น cue ค่อยเปลี่ยนเป็น two-pointer
    function pairSubs(a, b, opts) {
      var maxGap = opts && opts.maxGap != null ? opts.maxGap : 1;
      var buckets = a.map(function () { return []; });
      (b || []).forEach(function (cb) {
        var best = -1, bestOv = 0, near = -1, nearGap = Infinity;
        for (var i = 0; i < a.length; i++) {
          if (a[i].start > cb.end + maxGap) break;
          var ov = Math.min(a[i].end, cb.end) - Math.max(a[i].start, cb.start);
          if (ov > bestOv + 1e-9) { bestOv = ov; best = i; }
          else if (ov <= 0) { var g = -ov; if (g < nearGap - 1e-9) { nearGap = g; near = i; } }
        }
        if (best < 0 && nearGap <= maxGap) best = near;
        if (best >= 0) buckets[best].push(cb);
      });
      return a.map(function (c, i) {
        return { start: c.start, end: c.end, text: c.text, thai: buckets[i].map(function (x) { return x.text; }).join(' ') };
      });
    }

    // ตัดวรรคตอน/สัญลักษณ์ ตัวพิมพ์เล็ก NFKC · ช่องว่างซ้ำเหลืออันเดียว (ใช้โชว์ diff)
    function normalize(s) {
      var t = String(s == null ? '' : s);
      if (t.normalize) t = t.normalize('NFKC');
      t = t.toLowerCase();
      try { t = t.replace(/[\p{P}\p{S}]/gu, ''); } catch (e) { t = t.replace(/[.,!?;:'"“”‘’、。？！，：；（）()\[\]\-–—…]/g, ''); }
      return t.replace(/\s+/g, ' ').trim();
    }
    function lev(a, b) {
      var m = a.length, n = b.length;
      if (!m) return n; if (!n) return m;
      var prev = [], cur, i, j;
      for (j = 0; j <= n; j++) prev[j] = j;
      for (i = 1; i <= m; i++) {
        cur = [i];
        for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        prev = cur;
      }
      return prev[n];
    }
    // 0..1 = 1 − ระยะ Levenshtein ระดับตัวอักษร / ความยาวที่มากกว่า (ไม่นับช่องว่าง — Whisper ไม่เว้นวรรคเหมือนซับ) · ว่างฝั่งใดฝั่งหนึ่ง = 0
    function similarity(spoken, target) {
      var a = normalize(spoken).replace(/ /g, ''), b = normalize(target).replace(/ /g, '');
      if (!a || !b) return 0;
      return 1 - lev(a, b) / Math.max(a.length, b.length);
    }
    // เกณฑ์เดียวกับ gradeAnswer ของหน้า (ShadowingPanel)
    function band(sim) { return sim >= 0.9 ? 'correct' : sim >= 0.7 ? 'almost' : 'wrong'; }

    // cue ที่ครอบเวลา t ([start,end)) · ซ้อนกัน = อันที่เริ่มทีหลัง · ไม่มี = -1
    function cueAt(cues, t) {
      var r = -1;
      for (var i = 0; i < cues.length; i++) { if (cues[i].start > t) break; if (t < cues[i].end) r = i; }
      return r;
    }
    function fmt(sec) {
      var s = Math.max(0, Math.floor(sec || 0)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
      return (h ? h + ':' + (m < 10 ? '0' : '') + m : m) + ':' + (x < 10 ? '0' : '') + x;
    }
    // segments ของ ASR → cue: ตัดข้อความ ทิ้งว่าง end ≤ start ยืดเป็น +0.5 วิ ไม่ให้ซ้อนกัน (cue ก่อนหน้าจบเมื่อ cue ถัดไปเริ่ม)
    function segmentsToCues(segs) {
      var out = [];
      (segs || []).forEach(function (s) {
        var t = String(s && s.text != null ? s.text : '').replace(/\s+/g, ' ').trim(), a = +s.start, b = +s.end;
        if (!t || !isFinite(a)) return;
        if (!isFinite(b) || b <= a) b = a + 0.5;
        out.push({ start: a, end: b, text: t });
      });
      out.sort(function (x, y) { return x.start - y.start; });
      for (var i = 0; i + 1 < out.length; i++) if (out[i].end > out[i + 1].start) out[i].end = out[i + 1].start;
      return out.filter(function (c) { return c.end > c.start; });
    }

    return { decode: decode, parseSubs: parseSubs, pairSubs: pairSubs, normalize: normalize, similarity: similarity, band: band, cueAt: cueAt, fmt: fmt, segmentsToCues: segmentsToCues };
  })();


  // ── L5 สวมบทบาท ─────────────────────────────────────────────────────────────
  var roleplay = (function () {
  var LEVELS = ['A1', 'A2', 'B1', 'B2'];
  // cat = ชื่อหมวดใน lang-data.phrases (ตรงตัว) · role = บทบาทของ AI (ภาษาอังกฤษ ใช้ใน prompt) · goal = เป้าของผู้เรียน (ไทย แสดงในฉาก)
  var SCENES = [
    { id: 'greet', cat: 'ทักทายและแนะนำตัว', th: 'ทักทายและแนะนำตัว', en: 'Greetings and introductions', role: 'a friendly person meeting the learner for the first time', goal: 'ทักทาย แนะนำตัว และถามไถ่อีกฝ่าย', goalEn: 'Greet, introduce yourself and ask about them' },
    { id: 'restaurant', cat: 'การเดินทางและร้านอาหาร', th: 'ร้านอาหารและการเดินทาง', en: 'Restaurant and getting around', role: 'a waiter at a restaurant', goal: 'สั่งอาหาร ถามราคา และขอบิล', goalEn: 'Order food, ask prices and ask for the bill' },
    { id: 'interview', cat: 'การทำงานและสัมภาษณ์งาน', th: 'สัมภาษณ์งาน', en: 'Job interview', role: 'an interviewer at a company', goal: 'แนะนำประสบการณ์และตอบคำถามสัมภาษณ์', goalEn: 'Describe your experience and answer interview questions' },
    { id: 'immigration', cat: 'เดินทางเข้าประเทศ', th: 'ตรวจคนเข้าเมือง', en: 'Immigration desk', role: 'an immigration officer at the airport', goal: 'ตอบวัตถุประสงค์การเดินทางและที่พัก', goalEn: 'Explain your trip and where you will stay' },
    { id: 'housing', cat: 'หาที่พักและเช่าบ้าน', th: 'เช่าที่พัก', en: 'Renting a home', role: 'a landlord showing a rental room', goal: 'ถามค่าเช่า เงินมัดจำ และเงื่อนไขสัญญา', goalEn: 'Ask about rent, deposit and contract terms' },
    { id: 'bank', cat: 'ธนาคารและซิมโทรศัพท์', th: 'ธนาคารและซิมโทรศัพท์', en: 'Bank and SIM card', role: 'a bank or phone shop clerk', goal: 'เปิดบัญชีหรือสมัครซิมโทรศัพท์', goalEn: 'Open an account or get a SIM card' },
    { id: 'shopping', cat: 'ชีวิตประจำวันและซื้อของ', th: 'ซื้อของ', en: 'Shopping', role: 'a shop assistant', goal: 'ถามราคา ต่อรอง และจ่ายเงิน', goalEn: 'Ask prices, bargain and pay' },
    { id: 'hospital', cat: 'โรงพยาบาลและเหตุฉุกเฉิน', th: 'โรงพยาบาล', en: 'At the hospital', role: 'a doctor or nurse at a hospital', goal: 'บอกอาการและตอบคำถามของแพทย์', goalEn: 'Describe symptoms and answer the doctor' }
  ];

  function sceneOf(id) {
    for (var i = 0; i < SCENES.length; i++) if (SCENES[i].id === id) return SCENES[i];
    throw new Error('unknown scene: ' + id);
  }
  function levelOf(level) { return LEVELS.indexOf(level) >= 0 ? level : 'A1'; }

  var FORMAT = 'ท้ายคำตอบทุกครั้งให้ต่อด้วยบรรทัดใหม่ที่เป็น JSON บรรทัดเดียวเท่านั้น: {"fix": "...", "th": "..."} ' +
    '— "fix" = ประโยคล่าสุดของผู้เรียนที่แก้ให้ถูก (ถ้าถูกแล้วหรือยังไม่มีประโยคของผู้เรียนให้เป็น "") · "th" = คำแปลไทยของคำตอบที่คุณเพิ่งพูด · ห้ามใส่ข้อความอื่นหลัง JSON';

  function roleplayMessages(sceneId, level, langName, history) {
    var s = sceneOf(sceneId), lv = levelOf(level);
    var sys = 'You are role-playing ' + s.role + '. Scene: ' + s.en + '. The learner (a Thai speaker) practises ' + langName + ' at CEFR level ' + lv + '.\n' +
      'พูดเป็นภาษา' + langName + ' ระดับ ' + lv + ' เท่านั้น ใช้คำและไวยากรณ์ที่ระดับนี้เข้าใจได้ ตอบสั้นไม่เกิน 2 ประโยค แล้วถามหรือชวนให้ผู้เรียนพูดต่อ อยู่ในบทบาทตลอด\n' +
      'เป้าของผู้เรียนในฉากนี้: ' + s.goal + '\n' + FORMAT;
    var msgs = [{ role: 'system', content: sys }];
    var h = Array.isArray(history) ? history : [];
    if (!h.length) msgs.push({ role: 'user', content: '(เริ่มฉาก — คุณพูดประโยคเปิดก่อน)' });
    else h.forEach(function (m) { if (m && (m.role === 'user' || m.role === 'assistant')) msgs.push({ role: m.role, content: String(m.content || '') }); });
    return msgs;
  }

  // แยกข้อความกับ JSON ท้ายคำตอบ · ไม่มี JSON = ข้อความล้วน · JSON ที่ยังไม่ครบ (กำลัง stream) = ซ่อนส่วนท้าย
  function parseRoleplay(raw) {
    var s = String(raw == null ? '' : raw).replace(/```(?:json)?/gi, '');
    var i = s.lastIndexOf('{');
    if (i >= 0) {
      var tail = s.slice(i).trim();
      try {
        var o = JSON.parse(tail);
        if (o && typeof o === 'object' && ('fix' in o || 'th' in o)) {
          return { text: s.slice(0, i).trim(), fix: String(o.fix || ''), th: String(o.th || '') };
        }
      } catch (e) {
        if (/^\{\s*"(?:fix|th)"/.test(tail)) return { text: s.slice(0, i).trim(), fix: '', th: '' };
      }
    }
    return { text: s.trim(), fix: '', th: '' };
  }

  function summaryMessages(sceneId, level, langName, history) {
    var s = sceneOf(sceneId);
    var sys = 'จากบทสนทนาฉาก "' + s.en + '" ภาษา' + langName + ' ระดับ ' + levelOf(level) + ' ด้านล่าง เลือกคำหรือวลีสั้นที่ผู้เรียนควรจำ ไม่เกิน 5 รายการ ' +
      'ตอบเป็น JSON บรรทัดเดียวเท่านั้น: {"words": [{"word": "คำในภาษา' + langName + '", "thai": "คำแปลไทย"}]} ห้ามมีข้อความอื่น';
    var convo = (history || []).map(function (m) { return (m.role === 'user' ? 'Learner: ' : 'Partner: ') + m.content; }).join('\n');
    return [{ role: 'system', content: sys }, { role: 'user', content: convo || '(ไม่มีบทสนทนา)' }];
  }

  function norm(w) { return String(w || '').replace(/\s+/g, ' ').trim(); }
  function userCardKey(langId, word) {
    var lemma = norm(word).toLowerCase().replace(/^[\s.,!?;:"'()\[\]{}¿¡…。、！？「」]+|[\s.,!?;:"'()\[\]{}¿¡…。、！？「」]+$/g, '');
    return lemma ? langId + '::u::' + lemma : '';
  }

  function parseSummary(raw) {
    var s = String(raw == null ? '' : raw).replace(/```(?:json)?/gi, '');
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) return [];
    var o;
    try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { return []; }
    var list = o && Array.isArray(o.words) ? o.words : [], seen = {}, out = [];
    list.forEach(function (x) {
      var w = norm(x && x.word), k = w.toLowerCase();
      if (!w || seen[k] || out.length >= 5) return;
      seen[k] = 1;
      out.push({ word: w.slice(0, 80), thai: norm(x.thai).slice(0, 120) });
    });
    return out;
  }

  return { LEVELS: LEVELS, SCENES: SCENES, sceneOf: sceneOf, roleplayMessages: roleplayMessages, parseRoleplay: parseRoleplay, summaryMessages: summaryMessages, parseSummary: parseSummary, userCardKey: userCardKey };
  })();

  return {
    LEVEL_BANDS: LEVEL_BANDS, LEVEL_NAMES: LEVEL_NAMES, LANG_CODE: LANG_CODE, AI_BATCH: AI_BATCH, TH_CACHE_MAX: TH_CACHE_MAX,
    levelOf: levelOf, tokenize: tokenize, packFile: packFile, isGzip: isGzip, cardKey: cardKey, parseKey: parseKey,
    prepare: prepare, pickNew: pickNew, dueItems: dueItems, queue: queue, sentencesFor: sentencesFor, toPoolItems: toPoolItems,
    thaiOf: thaiOf, ipaText: ipaText, face: face, missingThai: missingThai, thMessages: thMessages, parseTh: parseTh, mergeTh: mergeTh, chunk: chunk,
    subs: subs,
    LEVELS: roleplay.LEVELS, SCENES: roleplay.SCENES, sceneOf: roleplay.sceneOf, roleplayMessages: roleplay.roleplayMessages,
    parseRoleplay: roleplay.parseRoleplay, summaryMessages: roleplay.summaryMessages, parseSummary: roleplay.parseSummary, userCardKey: roleplay.userCardKey
  };
});
