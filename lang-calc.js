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

  return {
    LEVEL_BANDS: LEVEL_BANDS, LEVEL_NAMES: LEVEL_NAMES, LANG_CODE: LANG_CODE, AI_BATCH: AI_BATCH, TH_CACHE_MAX: TH_CACHE_MAX,
    levelOf: levelOf, tokenize: tokenize, packFile: packFile, isGzip: isGzip, cardKey: cardKey, parseKey: parseKey,
    prepare: prepare, pickNew: pickNew, dueItems: dueItems, queue: queue, sentencesFor: sentencesFor, toPoolItems: toPoolItems,
    thaiOf: thaiOf, face: face, missingThai: missingThai, thMessages: thMessages, parseTh: parseTh, mergeTh: mergeTh, chunk: chunk
  };
});
