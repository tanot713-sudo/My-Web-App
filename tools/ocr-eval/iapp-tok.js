// iapp-tok.js — ถอดรหัสโทเค็นของ iapp/OpenThai2.0-OCR-Markdown (ByteLevel BPE + added tokens) เป็นข้อความ · UMD ไม่มี DOM · ตรวจกับ tokenizers (Python) ใน iapp-tok.test.mjs
// รูปแบบ vocab: iapp-vocab.json = {v:1, tokens:[id → สตริง|null]} จาก make_iapp_vocab.py
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.IappTok = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  // GPT-2 byte↔unicode: ไบต์ที่พิมพ์ได้คงเดิม ไบต์ที่เหลือถูกย้ายไปที่ U+0100.. ตามลำดับ
  var U2B = (function () {
    var bs = [], i, m = {};
    for (i = 33; i <= 126; i++) bs.push(i);
    for (i = 161; i <= 172; i++) bs.push(i);
    for (i = 174; i <= 255; i++) bs.push(i);
    var cs = bs.slice(), n = 0;
    for (i = 0; i < 256; i++) if (bs.indexOf(i) < 0) { bs.push(i); cs.push(256 + n); n++; }
    for (i = 0; i < bs.length; i++) m[String.fromCharCode(cs[i])] = bs[i];
    return m;
  })();
  function utf8(cp) { return Array.prototype.slice.call(new TextEncoder().encode(String.fromCodePoint(cp))); }
  function decode(tokens, ids) {
    var bytes = [];
    for (var k = 0; k < ids.length; k++) {
      var s = tokens[ids[k]];
      if (s == null) continue;
      for (var ch of s) {
        var b = U2B[ch];
        if (b !== undefined) bytes.push(b); else Array.prototype.push.apply(bytes, utf8(ch.codePointAt(0)));
      }
    }
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  }
  return { decode: decode, U2B: U2B };
});
