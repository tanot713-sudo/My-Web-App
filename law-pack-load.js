/* โหลดชุดตัวบท law-packs/ (ROADMAP แถว 9d/9e) — ใช้ร่วม classroom-law.js (แท็บตัวบท) และ review.js (หน้าการ์ดมาตรา)
   index.json network-first / ไฟล์ชุด cache-first ตอนใช้ (sw.js) · ตรวจรูปแบบด้วย LawCalc.packFile/preparePack
   window.TanotLawPacks: index() → Promise<[{code, name, sections, asOf}]> (เฉพาะรหัสใน LawCalc.CODES)
                         load(code) → Promise<pack | null> (null = ไม่มีชุดนี้) · ล้ม (เครือข่าย/ไฟล์เสีย/ไม่รองรับ gzip) = reject */
(function () {
  'use strict';
  var L = window.LawCalc, indexP = null, packs = {};

  function fetchIndex() {
    if (!indexP) {
      indexP = fetch('law-packs/index.json').then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
      indexP.catch(function () { indexP = null; });
    }
    return indexP;
  }
  function index() {
    return fetchIndex().then(function (idx) {
      return L.CODES.filter(function (c) { return L.packFile(idx, c.code); }).map(function (c) {
        var p = idx.packs[c.code];
        return { code: c.code, name: c.name, short: c.short, sections: +p.sections || 0, asOf: typeof p.asOf === 'string' ? p.asOf : '' };
      });
    });
  }
  function load(code) {
    if (!packs[code]) {
      packs[code] = fetchIndex().then(function (idx) {
        var file = L.packFile(idx, code);
        if (!file) return null;
        return fetch(file).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.arrayBuffer();
        }).then(function (buf) {
          var bytes = new Uint8Array(buf);
          if (!L.isGzip(bytes)) return new TextDecoder().decode(bytes); // เซิร์ฟเวอร์แตกให้แล้ว
          if (typeof DecompressionStream === 'undefined') { var e = new Error('gzip unsupported'); e.code = 'unsupported'; throw e; }
          return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
        }).then(function (text) {
          var p = L.preparePack(JSON.parse(text), code);
          if (!p) throw new Error('bad pack');
          return p;
        });
      });
      packs[code].catch(function () { delete packs[code]; });
    }
    return packs[code];
  }
  window.TanotLawPacks = { index: index, load: load };
})();
