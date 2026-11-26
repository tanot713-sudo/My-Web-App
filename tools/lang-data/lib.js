// ตรรกะล้วนของตัวสร้างชุดข้อมูลภาษา (ROADMAP แถว 21 / docs/languages-design.md L0) — ไม่มี DOM/เครือข่าย/ไฟล์
// UMD แบบเรียบ: ใช้ได้จาก Node (`require`) เท่านั้น เพราะเป็นเครื่องมือที่เจ้าของรันเอง ไม่ได้โหลดในหน้าเว็บ
// ค่า LEVEL_BANDS ต้องตรงกับ LangCalc.LEVEL_BANDS ที่ L1 จะเพิ่มใน lang-calc.js (ที่เดียวในหน้าเว็บ)
'use strict';
var crypto = require('crypto');

// [อันดับสูงสุดของช่วง, ระดับ] — อันดับเกินช่วงสุดท้าย = ระดับ 6 (A1–C2)
var LEVEL_BANDS = [[500, 1], [1200, 2], [2500, 3], [5000, 4], [8000, 5]];
var DEFAULT_CAPS = { words: 3000, sentences: 3000 };
var MAX_WORDS_LATIN = 12;
var MAX_CHARS_CJK = 25;
var CJK = { ja: 1, zh: 1, yue: 1 };
var SEGMENTED = { ja: 1, zh: 1, yue: 1, km: 1, lo: 1, my: 1 };

function levelOfRank(r) {
  for (var i = 0; i < LEVEL_BANDS.length; i++) if (r <= LEVEL_BANDS[i][0]) return LEVEL_BANDS[i][1];
  return 6;
}

function norm(s) { return String(s).normalize('NFC').toLowerCase(); }

// FrequencyWords: "คำ จำนวน" ต่อบรรทัด เรียงมากไปน้อย → อันดับ = ลำดับบรรทัดที่ใช้ได้
function parseFreq(lines) {
  var list = [], rank = new Map();
  for (var i = 0; i < lines.length; i++) {
    var line = String(lines[i]).trim();
    if (!line) continue;
    var sp = line.lastIndexOf(' ');
    if (sp <= 0) continue;
    var count = Number(line.slice(sp + 1));
    if (!isFinite(count) || !/^\d+$/.test(line.slice(sp + 1))) continue;
    var id = norm(line.slice(0, sp).trim());
    if (!id || rank.has(id)) continue;
    list.push({ id: id, count: count });
    rank.set(id, list.length);
  }
  return { list: list, rank: rank };
}

var WORD_RE = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;

function tokenize(text, code) {
  var t = String(text).normalize('NFC');
  var out = [], i;
  if (SEGMENTED[code] && typeof Intl !== 'undefined' && Intl.Segmenter) {
    var seg = new Intl.Segmenter(code, { granularity: 'word' });
    var it = seg.segment(t);
    for (var s of it) if (s.isWordLike && /[\p{L}\p{M}]/u.test(s.segment)) out.push(norm(s.segment));
    return out;
  }
  var m = t.match(WORD_RE) || [];
  for (i = 0; i < m.length; i++) out.push(norm(m[i]).replace(/’/g, "'"));
  return out;
}

function lengthOk(text, code) {
  if (CJK[code]) return String(text).replace(/[\s\p{P}\p{S}]/gu, '').length <= MAX_CHARS_CJK;
  return tokenize(text, code).length <= MAX_WORDS_LATIN;
}

// kaikki.org: หนึ่งบรรทัด JSON = หนึ่งรายการคำ (en.wiktionary แยกเป็น JSON)
function parseKaikkiLine(line) {
  var o;
  try { o = JSON.parse(line); } catch (e) { return null; }
  if (!o || typeof o.word !== 'string' || !o.word) return null;
  var th = '', ipa = '', gloss = '', i, j;
  var tr = Array.isArray(o.translations) ? o.translations : [];
  for (i = 0; i < tr.length && !th; i++) if (tr[i] && tr[i].code === 'th' && typeof tr[i].word === 'string') th = tr[i].word.trim();
  var so = Array.isArray(o.sounds) ? o.sounds : [];
  for (i = 0; i < so.length && !ipa; i++) if (so[i] && typeof so[i].ipa === 'string') ipa = so[i].ipa.trim();
  var se = Array.isArray(o.senses) ? o.senses : [];
  for (i = 0; i < se.length && !gloss; i++) {
    var g = se[i] && se[i].glosses;
    if (Array.isArray(g)) for (j = 0; j < g.length && !gloss; j++) if (typeof g[j] === 'string') gloss = g[j].trim();
  }
  return { id: norm(o.word), th: th, ipa: ipa, gloss: gloss };
}

// หลายรายการของคำเดียวกัน (ต่างชนิดคำ) — เก็บค่าแรกที่ไม่ว่างของแต่ละช่อง
function mergeKaikki(map, e) {
  var cur = map.get(e.id);
  if (!cur) { map.set(e.id, { id: e.id, th: e.th, ipa: e.ipa, gloss: e.gloss }); return; }
  if (!cur.th && e.th) cur.th = e.th;
  if (!cur.ipa && e.ipa) cur.ipa = e.ipa;
  if (!cur.gloss && e.gloss) cur.gloss = e.gloss;
}

// Tatoeba (ไฟล์ .tsv/.csv คั่นด้วยแท็บ)
function parseSentenceLine(line) {
  var p = String(line).replace(/\r$/, '').split('\t');
  if (p.length < 3 || !/^\d+$/.test(p[0]) || !p[1]) return null;
  return { id: Number(p[0]), lang: p[1], text: p.slice(2).join('\t') };
}
function parseLinkLine(line) {
  var p = String(line).replace(/\r$/, '').split('\t');
  if (p.length < 2 || !/^\d+$/.test(p[0]) || !/^\d+$/.test(p[1])) return null;
  return [Number(p[0]), Number(p[1])];
}
// sentences_with_audio: sentence_id, audio_id, username, license, attribution_url
// ใช้เฉพาะ license ที่ระบุ CC BY / CC BY-SA / CC0 (ไม่มี NC/ND) — ว่างหรือไม่รู้จัก = ไม่ใช้
function parseAudioLine(line) {
  var p = String(line).replace(/\r$/, '').split('\t');
  if (p.length < 4 || !/^\d+$/.test(p[0])) return null;
  var lic = p[3].trim().toUpperCase();
  if (!/^CC( BY(-SA)?|0)\b/.test(lic) || /-N[CD]\b/.test(lic)) return null;
  return Number(p[0]);
}

function buildPack(o) {
  var caps = Object.assign({}, DEFAULT_CAPS, o.caps || {});
  var stop = o.stop || new Set();
  var kaikki = o.kaikki || null;
  var words = [], kept = new Map(), i;
  var list = o.freq.list;
  for (i = 0; i < list.length && words.length < caps.words; i++) {
    var id = list[i].id, r = i + 1;
    if (stop.has(id) || !/^[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*$/u.test(id)) continue;
    var k = kaikki ? kaikki.get(id) : null;
    if (kaikki && !(k && (k.th || k.gloss))) continue;
    var w = { id: id, r: r, th: k ? k.th : '' };
    if (k && !k.th && k.gloss) w.g = k.gloss;
    w.ipa = k ? k.ipa : '';
    w.lv = levelOfRank(r);
    words.push(w);
    kept.set(id, r);
  }
  var cands = (o.candidates || []).slice().sort(function (a, b) { return a.id - b.id; });
  var seen = new Set(), buckets = [[], [], [], [], [], [], []];
  for (i = 0; i < cands.length; i++) {
    var c = cands[i], key = norm(c.text);
    if (seen.has(key) || !(c.en || c.th) || !lengthOk(c.text, o.code)) continue;
    var toks = tokenize(c.text, o.code);
    if (!toks.length) continue;
    var lv = 1, ok = true;
    for (var j = 0; j < toks.length; j++) {
      var rr = kept.get(toks[j]);
      if (!rr) { ok = false; break; }
      var l = levelOfRank(rr);
      if (l > lv) lv = l;
    }
    if (!ok) continue;
    seen.add(key);
    buckets[lv].push({ id: c.id, t: c.text, th: c.th || '', en: c.en || '', w: toks, lv: lv, au: c.au ? 1 : 0 });
  }
  // เลือกวนทีละระดับจนครบเพดาน (ประโยคสั้นก่อนในแต่ละระดับ) — ไม่ให้ระดับง่ายกินโควตาทั้งหมด
  var b, pos = [0, 0, 0, 0, 0, 0, 0], picked = [];
  for (b = 1; b <= 6; b++) buckets[b].sort(function (x, y) { return x.w.length - y.w.length || x.id - y.id; });
  var progress = true;
  while (picked.length < caps.sentences && progress) {
    progress = false;
    for (b = 1; b <= 6 && picked.length < caps.sentences; b++) {
      if (pos[b] < buckets[b].length) { picked.push(buckets[b][pos[b]++]); progress = true; }
    }
  }
  picked.sort(function (x, y) { return x.id - y.id; });
  return { v: 1, lang: o.lang, src: o.src, w: words, s: picked };
}

function packFileName(lang, pack) {
  var h = crypto.createHash('sha256').update(JSON.stringify(pack)).digest('hex').slice(0, 8);
  return lang + '-' + h + '.json';
}

// รหัสต่อภาษา: freq = path ใน hermitdave/FrequencyWords (ตรวจด้วย HEAD ว่ามีไฟล์จริง 2026-11-26; null = repo ไม่มีไฟล์ → ไม่สร้าง pack) · tat = รหัส Tatoeba 3 ตัว (จากความรู้ ยังไม่ได้เปิดยืนยัน — sandbox เข้า tatoeba.org ไม่ได้)
var LANGS = {
  'lang-en': { code: 'en', freq: 'content/2018/en/en_50k.txt', tat: 'eng' },
  'lang-jp': { code: 'ja', freq: 'content/2016/ja/ja_50k.txt', tat: 'jpn' },
  'lang-cn': { code: 'zh', freq: 'content/2018/zh_cn/zh_cn_50k.txt', tat: 'cmn' },
  'lang-yue': { code: 'yue', freq: null, tat: 'yue' },
  'lang-kr': { code: 'ko', freq: 'content/2018/ko/ko_50k.txt', tat: 'kor' },
  'lang-de': { code: 'de', freq: 'content/2018/de/de_50k.txt', tat: 'deu' },
  'lang-in': { code: 'hi', freq: 'content/2016/hi/hi_50k.txt', tat: 'hin' },
  'lang-fr': { code: 'fr', freq: 'content/2018/fr/fr_50k.txt', tat: 'fra' },
  'lang-it': { code: 'it', freq: 'content/2018/it/it_50k.txt', tat: 'ita' },
  'lang-mm': { code: 'my', freq: null, tat: 'mya' },
  'lang-kh': { code: 'km', freq: null, tat: 'khm' },
  'lang-la': { code: 'lo', freq: null, tat: 'lao' },
  'lang-vn': { code: 'vi', freq: 'content/2018/vi/vi_50k.txt', tat: 'vie' },
  'lang-my': { code: 'ms', freq: 'content/2018/ms/ms_50k.txt', tat: 'zsm' },
  'lang-ar': { code: 'ar', freq: 'content/2018/ar/ar_50k.txt', tat: 'ara' },
  'lang-es': { code: 'es', freq: 'content/2018/es/es_50k.txt', tat: 'spa' },
  'lang-pt': { code: 'pt', freq: 'content/2018/pt/pt_50k.txt', tat: 'por' },
  'lang-ru': { code: 'ru', freq: 'content/2018/ru/ru_50k.txt', tat: 'rus' }
};

module.exports = {
  LEVEL_BANDS: LEVEL_BANDS, DEFAULT_CAPS: DEFAULT_CAPS, LANGS: LANGS,
  levelOfRank: levelOfRank, parseFreq: parseFreq, tokenize: tokenize, lengthOk: lengthOk,
  parseKaikkiLine: parseKaikkiLine, mergeKaikki: mergeKaikki,
  parseSentenceLine: parseSentenceLine, parseLinkLine: parseLinkLine, parseAudioLine: parseAudioLine,
  buildPack: buildPack, packFileName: packFileName
};
