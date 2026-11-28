// ตรรกะล้วนของตัวสร้างชุดตัวบท (tools/law-data) — ไม่มี I/O, require() ได้จาก build.mjs และ tests/law.spec.js
// แบบ: docs/law-classroom-design.md 5.0 (ห้ามย่อ) · 5.4 · 5.5 (รูปแบบชุด) · ROADMAP แถว 9c
//
// ทางเดิน: ข้อความรายชิ้นจาก pdf.js ({str, h, x, y, w, page}) → บรรทัด (ตัดลายน้ำ/เลขหน้า, แยกเชิงอรรถตามขนาดตัวอักษร)
//          → ย่อหน้า (บรรทัดย่อหน้าแรกเยื้องเข้า) → มาตรา + หัวหมวด → ชุด {v:1, code, name, src, asOf, s:[{n,b,t,f?}], x?}
// กฎ: ไม่ตัด ไม่สรุป ไม่แก้ถ้อยคำ — แก้ได้เฉพาะรหัสตัวอักษรที่ฟอนต์ PDF เพี้ยน (ํ+า → ำ, U+FFFD ที่ตำแหน่ง ํ) ·
//     PDF ที่ฟอนต์เพี้ยนจนวรรณยุกต์หาย/กลายเป็นอักษรละติน (เช่น "ว.า", "เป8น") ถูกปฏิเสธด้วย garbleReport ไม่ "เดาซ่อม"
'use strict';

const L = require('../../law-calc.js');

const WATERMARK = 'สำนักงานคณะกรรมการกฤษฎีกา';
const THAI_RE = /[ก-๎]/;
const HEAD_RE = /^(ภาค|ลักษณะ|หมวด|ส่วนที่|ส่วน|บรรพ)\s*[๐-๙0-9]+|^บทเฉพาะกาล$|^บทนิยาม$/;
const END_RE = /^(ผู้รับสนองพระบรมราชโองการ|ประกาศ ณ วันที่|หมายเหตุ\s*:-)/;
const ACT_TITLE_RE = /^(พระราชบัญญัติ|พระราชกฤษฎีกา|พระราชกำหนด|รัฐธรรมนูญ|ประกาศของคณะ|คำสั่งหัวหน้าคณะ)/;
const DIGIT_TH = '๐๑๒๓๔๕๖๗๘๙';

function arabic(s) { return String(s).replace(/[๐-๙]/g, (d) => String(DIGIT_TH.indexOf(d))); }

// glyph ของฟอนต์ Bai Jamjuree (OFL, cadsondemak/Bai-Jamjuree) ที่ PDF "ฉบับ Update ล่าสุด" ของกฤษฎีกาฝังไว้แต่ ToUnicode
// ไม่มีรหัสกำกับ — pdf.js คืน U+0000 ("เมื อ", "ฟ อง"). รหัส CID ใน PDF = ลำดับ glyph (GID) ของฟอนต์ต้นฉบับ (ตรวจแล้ว:
// CID ที่มี ToUnicode เช่น 731 ่ 734 ้ 742 ์ 745 ็ ตรงกับ cmap ของ BaiJamjuree-Regular/SemiBold.ttf ใน google/fonts)
// ตารางนี้ถอดจากชื่อ glyph ในตาราง post ของฟอนต์ต้นฉบับ (Regular และ SemiBold ชุดเดียวกัน) — ไม่ใช่การเดา:
// .small = ยกสูงเหนือสระบน · .narrow = เลื่อนซ้ายหลัง ป ฝ ฟ ฬ · .less/.short = ตัดหางเมื่อมีสระล่าง · uni0E4D0E48 = ํ+่ (ใน "ค่ำ")
const BAI_JAMJUREE_UNMAPPED = {
  442: 'ฤๅ', 443: 'ฦๅ', 445: 'ญ', 447: 'ฎ', 449: 'ฏ', 451: 'ฐ', 472: 'ฤ', 475: 'ฦ', 482: 'ฬ',
  730: 'ั', 732: '่', 733: '่', 735: '้', 736: '้', 738: '๊', 739: '๊', 741: '๋', 743: '์', 744: '์', 746: '็',
  749: 'ิ', 751: 'ี', 753: 'ึ', 755: 'ื',
  // วรรณยุกต์ + นิคหิตของ "ำ" — เขียนตามลำดับ Unicode (วรรณยุกต์ก่อน ํ) แล้ว normalizeText รวม ํ+า เป็น ำ
  757: '่ํ', 758: '้ํ', 759: '๊ํ', 760: '๋ํ', 769: '่ํ', 770: '้ํ', 771: '๊ํ', 772: '๋ํ',
  762: 'ฺ', 764: 'ุ', 766: 'ู', 767: '๋', 768: 'ํ',
};

// แทน U+0000 ในชิ้นข้อความ (getTextContent) ด้วยตัวอักษรของ glyph ตามลำดับเดียวกับ operator list ของหน้าเดียวกัน
// glyphs = [{font: ชื่อฟอนต์ใน PDF, cid, prev: ตัวอักษรของ glyph ก่อนหน้าใน showText เดียวกัน | null}] เฉพาะ glyph ที่คืน U+0000
// คืน {items, problems} — problems ไม่ว่าง = ห้ามใช้หน้านี้ (จำนวนไม่ตรง / ฟอนต์อื่น / CID ไม่มีในตาราง / ลำดับไม่ตรงกัน)
function fillUnmappedGlyphs(items, glyphs) {
  const problems = [];
  let k = 0;
  const out = items.map((it) => {
    if (!it.str || it.str.indexOf('\u0000') < 0) return it;
    let s = '';
    for (let i = 0; i < it.str.length; i++) {
      const ch = it.str[i];
      if (ch !== '\u0000') { s += ch; continue; }
      const g = glyphs[k++];
      if (!g) { problems.push('U+0000 ในข้อความมากกว่า glyph ใน operator list'); s += ch; continue; }
      const rep = /BaiJamjuree/.test(g.font) ? BAI_JAMJUREE_UNMAPPED[g.cid] : undefined;
      if (rep === undefined) { problems.push('glyph ไม่มีรหัสในตาราง: ' + g.font + ' CID ' + g.cid); s += ch; continue; }
      const before = it.str[i - 1];
      if (g.prev && before && before !== '\u0000' && before !== g.prev) problems.push('ลำดับ glyph ไม่ตรงกับข้อความ (CID ' + g.cid + ')');
      s += rep;
    }
    return Object.assign({}, it, { str: s });
  });
  if (k !== glyphs.length) problems.push('glyph U+0000 ใน operator list ' + glyphs.length + ' ตัว แต่ข้อความมี ' + k);
  return { items: out, problems };
}

// รหัสตัวอักษรที่ฟอนต์ของ PDF กฤษฎีกาเขียนเพี้ยน (ไม่ใช่การแก้ถ้อยคำ):
//  - "ำ" ถูกเก็บเป็น ํ (U+0E4D) + า หรือ U+FFFD + า และวรรณยุกต์อาจคั่นกลาง ("น�้า" = น้ำ) หรือมีช่องว่างแทรก ("ส� า")
//  - เครื่องหมายคำพูดเปิด/ปิดที่บางเล่มถูกแมปเป็น ` และ ′ (ตัวบทไม่ใช้สองตัวนี้)
function normalizeText(s) {
  return String(s).normalize('NFC')
    .replace(/`(?=[ก-๎])/g, '“')
    .replace(/([ก-๎๐-๙.])′/g, '$1”')
    .replace(/�/g, 'ํ')
    .replace(/ํ([่-๋]?)[ \t]*า/g, '$1ำ')
    .replace(/[  -​　]/g, ' ');
}

// ร่องรอยฟอนต์เพี้ยนที่ซ่อมเองไม่ได้ → รายการตัวอย่าง (ว่าง = ใช้ได้)
// วรรณยุกต์/สระบนถูกแทนด้วยอักษรละติน/ตัวเลข/จุด ("ว.า", "เป8น", "ณM", "ต6อ") หรือ ํ ลอยไม่มี า ตาม
function garbleReport(text) {
  const out = [];
  // ต้องอยู่กลางคำ (ตัวหน้าเป็นอักษรไทย) — ตัวย่อ "ป.ร." / "พ.ศ." / "ม.๑" ขึ้นต้นหลังช่องว่างจึงไม่โดน
  const re = /[ก-๎][ก-ฮะ-ฺเ-๎][A-Za-z0-9.\/:;@\[\]<>|=~^\\][ก-๎]|ํ(?![าำ])|[ก-ฮ][A-Za-z](?![A-Za-z])/g;
  let m;
  while ((m = re.exec(text)) && out.length < 20) {
    // ตัวย่อที่ติดคำหน้าโดยไม่เว้นวรรค ("ความพ.ศ." / "ตามพ.ร.บ.") ไม่ใช่ฟอนต์เพี้ยน
    if (/^[ก-ฮ]\.[ก-ฮ]\./.test(text.slice(m.index + 1, m.index + 6))) { re.lastIndex = m.index + 1; continue; }
    const ctx = text.slice(Math.max(0, m.index - 8), m.index + 10).replace(/\s+/g, ' ');
    out.push(ctx);
  }
  return out;
}

function median(a) { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; }
function mode(a) {
  const c = new Map(); let best = 0, bv = 0;
  for (const v of a) { const k = Math.round(v); const n = (c.get(k) || 0) + 1; c.set(k, n); if (n > best) { best = n; bv = k; } }
  return bv;
}

// ชิ้นข้อความของหน้าเดียว → บรรทัด {y, x, x2, h, kind:'body'|'note', text, marks:[{at, n}]}
// kind ตามขนาดตัวอักษร: ตัวเนื้อ = ขนาดที่พบมากที่สุดของทั้งเอกสาร (bodyH), เชิงอรรถเล็กกว่า, เลขเชิงอรรถยกสูง < 0.7×bodyH
function pageLines(items, bodyH) {
  const parts = [];
  for (const it of items) {
    if (!it.str) continue;
    const s = normalizeText(it.str);
    if (s.trim() === WATERMARK) continue; // ลายน้ำทุกหน้า + หัวกระดาษ
    parts.push({ s, x: it.x, y: it.y, w: it.w || 0, h: it.h });
  }
  // เลขเชิงอรรถ: ตัวยกเล็ก (ไฟล์เดิม) หรือ "[12]" ขนาด ~0.75 ของตัวเนื้อ (ไฟล์ "ฉบับ Update ล่าสุด" — ชิ้นเดียวอาจมีหลายเลข)
  const isBracketNote = (p) => BRACKET_NOTE_RE.test(p.s) && p.h < bodyH * 0.9;
  const sup = [];
  for (const p of parts) {
    if (!p.s.trim()) continue;
    if (isBracketNote(p)) { for (const m of p.s.match(/[0-9๐-๙]+/g)) sup.push(Object.assign({}, p, { s: m })); }
    else if (p.h < bodyH * 0.7) sup.push(p);
  }
  const txt = parts.filter((p) => p.h >= bodyH * 0.7 && !isBracketNote(p));
  const lines = [];
  for (const p of txt) {
    let ln = lines.find((l) => Math.abs(l.y - p.y) < Math.max(2, p.h * 0.3));
    if (!ln) { ln = { y: p.y, items: [] }; lines.push(ln); }
    ln.items.push(p);
  }
  // เลขเชิงอรรถยกสูง → บรรทัดที่อยู่ใต้ไม่เกินครึ่งบรรทัด
  for (const p of sup) {
    let best = null;
    for (const l of lines) { const d = p.y - l.y; if (d >= -1 && d < bodyH * 0.8 && (!best || d < p.y - best.y)) best = l; }
    if (best) best.items.push({ s: '\u0001' + p.s.trim() + '\u0002', x: p.x, y: best.y, w: p.w, h: 0 });
  }
  lines.sort((a, b) => b.y - a.y);
  return lines.map((l) => {
    l.items.sort((a, b) => a.x - b.x);
    const hs = l.items.filter((i) => i.h > 0 && i.s.trim()).map((i) => i.h);
    const h = hs.length ? median(hs) : bodyH;
    let text = '';
    const marks = [];
    let prevEnd = null;
    for (const i of l.items) {
      if (i.s[0] === '\u0001') { marks.push({ at: text.length, n: arabic(i.s.slice(1, -1)) }); continue; }
      // pdf.js ไม่ใส่ชิ้นช่องว่างเมื่อ PDF เลื่อนตำแหน่งแทนการพิมพ์ช่องว่าง → ดูระยะห่างแทน
      if (prevEnd != null && text && !/\s$/.test(text) && !/^\s/.test(i.s) && i.x - prevEnd > Math.max(1, i.h * 0.08)) text += ' ';
      text += i.s;
      prevEnd = i.x + i.w;
    }
    text = normalizeText(text);
    const last = l.items[l.items.length - 1];
    return { y: l.y, x: l.items[0].x, x2: last.x + last.w, h, kind: h < bodyH - 1 ? 'note' : 'body', text: text.replace(/\s+$/, ''), marks };
  }).filter((l) => (l.text.trim() || l.marks.length) && !MARK_ONLY_RE.test(l.text));
}

// บรรทัดที่มีแต่สระบน/ล่าง/วรรณยุกต์ ไม่มีพยัญชนะ = เศษ glyph ที่ PDF วางไว้นอกบรรทัดจริง (เช่นท้ายหน้า) ไม่ใช่ข้อความ
const MARK_ONLY_RE = /^[\sัิ-ฺ็-๎]+$/;
const BRACKET_NOTE_RE = /^(?:\s*\[\s*[0-9๐-๙]+\s*\])+\s*$/;

// เลขหน้า "- ๕ -" / "20" / "| 16" (ไฟล์ "ฉบับ Update ล่าสุด")
const PAGE_NO_RE = /^\s*(?:-\s*|\|\s*)?[๐-๙0-9]+(?:\s*-)?\s*$/;

// ทุกหน้า → {body: [บรรทัดเนื้อ], notes: Map(เลข → ข้อความเชิงอรรถ)}
function documentLines(pages) {
  const bodyH = mode(pages.flatMap((p) => p.items.filter((i) => i.str && i.str.trim()).map((i) => i.h)));
  const body = [];
  const notes = new Map();
  let lastNote = null;
  // เชิงอรรถท้ายเล่ม (ไฟล์ "ฉบับ Update ล่าสุด"): หลังบรรทัดจบตัวบท (END_RE) บรรทัดตัวเนื้อที่ขึ้นต้นด้วยเลขเชิงอรรถ
  // = เริ่มเชิงอรรถเลขนั้น และทุกบรรทัดหลังจากนั้นเป็นเชิงอรรถ (บรรทัดต่อของเลขล่าสุด)
  let afterEnd = false, endnotes = false;
  pages.forEach((pg, pi) => {
    const lines = pageLines(pg.items, bodyH);
    // เลขหน้า "- ๕ -" / "20" อยู่บรรทัดบนสุดหรือล่างสุดของหน้า (บางไฟล์ "-" แยกบรรทัด)
    const pageNo = (l) => l && !l.marks.length && (PAGE_NO_RE.test(l.text) || /^\s*-\s*$/.test(l.text));
    while (lines.length && pageNo(lines[0])) lines.shift();
    while (lines.length && pageNo(lines[lines.length - 1])) lines.pop();
    for (const ln of lines) {
      if (ln.kind === 'note') {
        const m0 = ln.marks.find((m) => m.at === 0);
        if (m0) { lastNote = m0.n; notes.set(m0.n, ln.text.trim()); }
        else if (lastNote) notes.set(lastNote, notes.get(lastNote) + ' ' + ln.text.trim()); // เชิงอรรถยาวต่อบรรทัด
        continue;
      }
      if (END_RE.test(ln.text.trim())) afterEnd = true;
      if (afterEnd && ln.marks.length && ln.marks[0].at === 0 && ln.text.trim()) {
        endnotes = true; lastNote = ln.marks[0].n; notes.set(lastNote, ln.text.trim()); continue;
      }
      if (endnotes) { if (lastNote) notes.set(lastNote, notes.get(lastNote) + ' ' + ln.text.trim()); continue; }
      ln.page = pi + 1;
      body.push(ln);
    }
  });
  return { body, notes, bodyH };
}

// กล่องความเห็นกฤษฎีกาที่ไฟล์ "ฉบับ Update ล่าสุด" แทรกไว้ระหว่างบรรทัดตัวบท (ไม่ใช่ตัวบท — เป็นลิงก์ไปเรื่องเสร็จ):
//   "เรื่องเสร็จที่ ๑๒๔/๒๕๔๖" → "บันทึกสำนักงานคณะกรรมการกฤษฎีกา" / "บันทึก" → "เรื่อง …" (หลายบรรทัด)
//   → "สำหรับรายละเอียดของความเห็นฯ โปรดดูที่ไฟล์ PDF"
// ตัดระดับบรรทัดก่อนรวมย่อหน้า (บรรทัดตัวบทที่ต่อหลังกล่องจึงต่อกับย่อหน้าเดิมได้ถูก) · รูปแบบไม่ครบ = problems ห้ามใช้ไฟล์
const BOX_START_RE = /^(เรื่องเสร็จที่\s*[๐-๙0-9][๐-๙0-9\s\-–,]*\/\s*[๐-๙0-9]+|บันทึกสำนักงานคณะกรรมการกฤษฎีกา.*|บันทึก)$/;
const BOX_END_RE = /^สำหรับรายละเอียดของความเห็นฯ\s*โปรดดูที่ไฟล์\s*PDF$/;
// ยาวสุดที่พบจริง 9 บรรทัด (ชื่อเรื่องยาว/ข้ามหน้า) · ในกล่องมีบรรทัด "มาตรา ๑๔๙๗ แห่ง…" ได้ (ชื่อเรื่อง) จึงไม่ใช้เลขมาตราเป็นตัวหยุด
const BOX_MAX_LINES = 12;
function stripOpinionBoxes(body) {
  const out = [];
  const problems = [];
  let boxes = 0;
  for (let i = 0; i < body.length; i++) {
    const t = body[i].text.trim();
    if (BOX_END_RE.test(t)) { problems.push('หน้า ' + body[i].page + ': ท้ายกล่องความเห็นไม่มีหัวกล่อง'); continue; }
    if (!BOX_START_RE.test(t)) { out.push(body[i]); continue; }
    let j = i + 1;
    while (j < body.length && j - i < BOX_MAX_LINES && !BOX_END_RE.test(body[j].text.trim())) j++;
    if (j >= body.length || !BOX_END_RE.test(body[j].text.trim())) {
      problems.push('หน้า ' + body[i].page + ': กล่องความเห็นไม่มีบรรทัดท้าย "โปรดดูที่ไฟล์ PDF" ภายใน ' + BOX_MAX_LINES + ' บรรทัด: ' + t.slice(0, 40));
      out.push(body[i]);
      continue;
    }
    boxes++;
    i = j;
  }
  return { body: out, boxes, problems };
}

// ต่อบรรทัดที่ตัดคำ: ไทยชนไทย = ใส่ WRAP ไว้ก่อน (ต้นฉบับอาจตัดกลางคำ หรือตรงช่องว่างก็ได้ — resolveWraps ตัดสิน
// จากฉบับอ้างอิงถ้ามี ไม่มี = ไม่เว้น) · อย่างอื่น = เว้นวรรค 1
const WRAP = '\u0003';
function joinWrap(a, b) {
  if (!a) return b;
  const x = a[a.length - 1], y = b[0];
  if (THAI_RE.test(x) && THAI_RE.test(y)) return a + WRAP + b;
  if (/[(\[“"‘]/.test(x) || /[)\]”"’,]/.test(y)) return a + b;
  return a + ' ' + b;
}

// บรรทัดเนื้อ → ย่อหน้า: บรรทัดที่เริ่มเยื้องจากขอบซ้าย ≥ 1 ตัวอักษร = ย่อหน้าใหม่ (บรรทัดต่อของย่อหน้าชิดขอบซ้าย)
// เลขเชิงอรรถยังติดอยู่ในข้อความเป็น \u0001n\u0002 ให้ splitSections ย้ายออก
function paragraphs(body, bodyH) {
  const left = median(body.map((l) => l.x).filter((x) => x < 200));
  const right = median(body.map((l) => l.x2));
  const center = (left + right) / 2;
  // ระยะบรรทัดปกติ (ค่ากลางของระยะห่างบรรทัดติดกันในหน้าเดียวกัน)
  const steps = [];
  for (let i = 1; i < body.length; i++) {
    const d = body[i - 1].y - body[i].y;
    if (body[i].page === body[i - 1].page && d > 0 && d < bodyH * 3) steps.push(d);
  }
  const step = median(steps) || bodyH * 1.5;
  const out = [];
  let cur = null, prev = null;
  for (const ln of body) {
    let t = '';
    let at = 0;
    for (const m of ln.marks) { t += ln.text.slice(at, m.at) + '\u0001' + m.n + '\u0002'; at = m.at; }
    t += ln.text.slice(at);
    t = t.replace(/\s+/g, ' ').trim();
    const indent = ln.x - left > bodyH * 0.8;
    const mid = (ln.x + ln.x2) / 2;
    const centered = indent && Math.abs(mid - center) < bodyH * 2 && ln.x2 < right - bodyH * 2;
    const pageBreak = cur && ln.page !== cur.page;
    const plain = t.replace(/\u0001[^\u0002]*\u0002/g, '');
    // บรรทัดจบตัวบท ("หมายเหตุ :-" ฯลฯ) ขึ้นย่อหน้าใหม่เสมอ — ไฟล์ "ฉบับ Update ล่าสุด" พิมพ์ชิดซ้ายไม่เยื้อง
    const endLine = END_RE.test(plain);
    // ชื่อกฎหมายฉบับแก้ไขท้ายเล่ม (ป.พ.พ.): ชิดซ้าย + เว้นห่างจากบรรทัดก่อน > 2 บรรทัด — ตัวบทจริงขึ้นย่อหน้าด้วยบรรทัดเยื้องเสมอ
    // บรรทัดชิดซ้ายจึงเป็นบรรทัดต่อได้อย่างเดียว ยกเว้นมีช่องว่างใหญ่คั่น
    const gap = prev && prev.page === ln.page ? prev.y - ln.y : 0;
    const actTitle = !indent && gap > step * 2.2 && ACT_TITLE_RE.test(plain);
    prev = ln;
    if (!cur || indent || endLine || actTitle || (centered && !(cur.centered && pageBreak))) {
      cur = { text: t, centered, page: ln.page, x: ln.x };
      if (actTitle) cur.end = true;
      out.push(cur);
    } else {
      cur.text = joinWrap(cur.text, t);
      cur.page = ln.page;
    }
  }
  return out;
}

// "มาตรา ๑๗๒ ทวิ/๑" (ป.วิ.อ.) = มาตราที่แทรกหลัง ๑๗๒ ทวิ → "172ทวิ/1" (รูปแบบเดียวกับ LawCalc)
const SEC_RE = /^(มาตรา|ข้อ)\s*([๐-๙0-9]{1,4}(?:\s*\/\s*[๐-๙0-9]{1,3})?)(?:\s*(ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|อัฎฐ|นว|ทศ)(?![ก-๎])(?:\s*\/\s*([๐-๙0-9]{1,3}))?)?/;

function canonN(num, suf, sub) {
  let n = arabic(num).replace(/\s+/g, '');
  if (suf) n += suf === 'อัฎฐ' ? 'อัฏฐ' : suf;
  if (suf && sub) n += '/' + arabic(sub);
  return n;
}
// ลำดับมาตราเพื่อเทียบ: เลข › /เลข › ทวิ ตรี … › /เลขหลังคำต่อท้าย (7 < 7ทวิ < 7ทวิ/1 < 7ตรี < 7/1 < 8)
const SUF_ORDER = ['ทวิ', 'ตรี', 'จัตวา', 'เบญจ', 'ฉ', 'สัตต', 'อัฏฐ', 'นว', 'ทศ'];
function nKey(n) {
  const m = /^(\d+)(?:\/(\d+))?([^/\d]*)(?:\/(\d+))?$/.exec(n) || [];
  return [+m[1] || 0, +m[2] || 0, m[3] ? SUF_ORDER.indexOf(m[3]) + 1 : 0, +m[4] || 0];
}
function nLess(a, b) {
  const x = nKey(a), y = nKey(b);
  for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
}

// ย่อหน้า → มาตรา: หัว (ภาค/ลักษณะ/หมวด/ส่วน + ชื่อบรรทัดถัดไปที่อยู่กลางหน้า) สะสมเป็น b ·
// เลือกช่วงมาตราที่เรียงขึ้นต่อเนื่องที่ยาวที่สุด (ตัด พ.ร.บ.ให้ใช้ประมวล ข้างหน้า และบทเฉพาะกาลของฉบับแก้ไขข้างท้าย)
// marker = 'มาตรา' | 'ข้อ' · stopHeads = หัวส่วนท้าย (บัญชี/ตารางท้ายประมวล) — มาตราก่อนหน้าจบที่หัวนั้น ไม่กินส่วนท้ายเข้าไป
function splitSections(paras, notes, marker, stopHeads) {
  const runs = [];
  let run = null, sec = null, heads = [], tail = null, pendingTitle = false;
  const close = () => { sec = null; };
  for (const p of paras) {
    const raw = p.text;
    const plain = raw.replace(/\u0001[^\u0002]*\u0002/g, '');
    if (END_RE.test(plain) || p.end || (stopHeads && stopHeads.indexOf(plain.trim()) >= 0)) { close(); tail = 'end'; continue; }
    const m = SEC_RE.exec(plain);
    if (m && m[1] === marker) { // บรรทัดแรกของมาตราที่สั้นอาจบังเอิญอยู่กลางหน้า — เลขมาตราชนะเสมอ
      const n = canonN(m[2], m[3], m[4]);
      if (!run || !nLess(run.last, n)) { run = { secs: [], last: n }; runs.push(run); }
      run.last = n;
      tail = null;
      // ตัด "มาตรา ๑๒" + เลขเชิงอรรถที่ติดหัวมาตรา ออกจากข้อความ เก็บข้อความหลังเลขมาตรา
      let pos = 0, used = 0, headMarks = '';
      while (pos < raw.length && used < m[0].length) {
        if (raw[pos] === '\u0001') { const e = raw.indexOf('\u0002', pos); headMarks += raw.slice(pos, e + 1); pos = e + 1; continue; }
        pos++; used++;
      }
      while (raw[pos] === '\u0001') { const e = raw.indexOf('\u0002', pos); headMarks += raw.slice(pos, e + 1); pos = e + 1; }
      sec = { n, b: heads.join(' › '), paras: [headMarks + raw.slice(pos).trim()] };
      run.secs.push(sec);
      pendingTitle = false;
      continue;
    }
    if (p.centered && HEAD_RE.test(plain.trim())) {
      const word = plain.trim().split(/\s+/)[0];
      const lvl = ['บรรพ', 'ภาค', 'ลักษณะ', 'หมวด', 'ส่วนที่', 'ส่วน'].indexOf(word.replace(/[๐-๙0-9]+$/, ''));
      const keep = [];
      for (const h of heads) {
        const w = h.split(/\s+/)[0].replace(/[๐-๙0-9]+$/, '');
        const hl = ['บรรพ', 'ภาค', 'ลักษณะ', 'หมวด', 'ส่วนที่', 'ส่วน'].indexOf(w);
        if (lvl >= 0 && hl >= 0 && hl < lvl) keep.push(h);
      }
      heads = keep.concat(plain.trim().replace(/\s+/g, ' '));
      pendingTitle = lvl >= 0; // "หมวด ๑" บรรทัดถัดไปเป็นชื่อหมวด
      sec = null;
      continue;
    }
    if (p.centered && pendingTitle && !sec) {
      heads[heads.length - 1] += ' ' + plain.trim().replace(/\s+/g, ' ');
      pendingTitle = false;
      continue;
    }
    pendingTitle = false;
    if (sec && !tail) sec.paras.push(raw.trim());
  }
  let best = null;
  for (const r of runs) if (!best || r.secs.length > best.secs.length) best = r;
  if (!best) return [];
  return best.secs.map((s) => {
    const f = [];
    const t = s.paras.join('\n').replace(/\u0001([^\u0002]*)\u0002/g, (all, n) => {
      if (notes.has(n) && f.indexOf(notes.get(n)) < 0) f.push(notes.get(n));
      return '';
    }).replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').trim();
    const o = { n: s.n, b: s.b, t };
    if (f.length) o.f = f;
    return o;
  });
}

// ส่วนท้าย (บัญชี/อัตราท้ายพระราชบัญญัติ) หลังบรรทัดผู้รับสนองฯ — เป็นตัวบท ห้ามทิ้ง
// heads = ชื่อหัวที่ยอมรับ เช่น ['อัตราค่าธรรมเนียม']
function appendices(paras, heads) {
  const out = [];
  let cur = null;
  for (const p of paras) {
    const plain = p.text.replace(/\u0001[^\u0002]*\u0002/g, '').trim();
    // ส่วนท้ายจบที่บรรทัดจบตัวบท หรือชื่อกฎหมายฉบับแก้ไขที่ตามมา (p.end จาก paragraphs)
    if (END_RE.test(plain) || p.end) { cur = null; continue; }
    // หัวเดียวกันที่โผล่อีกในฉบับแก้ไขท้ายเล่ม ("ให้ใช้ตาราง ๑ ท้าย … แทน") ไม่ใช่ส่วนท้ายฉบับปัจจุบัน — ใช้ครั้งแรกเท่านั้น
    if (heads.indexOf(plain) >= 0) {
      if (out.some((a) => a.h === plain)) { cur = null; continue; }
      cur = { h: plain, t: [] }; out.push(cur); continue;
    }
    if (cur) cur.t.push(plain);
  }
  return out.map((a) => ({ h: a.h, t: a.t.join('\n') }));
}

// วันที่ไทย "๑๙ กันยายน ๒๕๒๘" → '1985-09-19'
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
function thaiDateIso(s) {
  const m = new RegExp('([๐-๙0-9]{1,2})\\s*(' + MONTHS.join('|') + ')\\s*(?:พ\\.\\s*ศ\\.\\s*)?([๐-๙0-9]{4})').exec(String(s));
  if (!m) return '';
  const d = +arabic(m[1]), mo = MONTHS.indexOf(m[2]) + 1, y = +arabic(m[3]) - 543;
  if (d < 1 || d > 31 || y < 1800) return '';
  return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
// วันที่ล่าสุดในราชกิจจานุเบกษาที่เชิงอรรถอ้าง = ฉบับแก้ไขล่าสุดที่ข้อความนี้รวมไว้
function latestGazette(notes, extra) {
  let best = '';
  for (const t of [...notes.values(), ...(extra || [])]) {
    if (!/ราชกิจจา/.test(t)) continue;
    const iso = thaiDateIso(t.slice(t.lastIndexOf('/') + 1)) || thaiDateIso(t);
    if (iso > best) best = iso;
  }
  return best;
}

// รายการแก้จาก corrections.json → แก้ใน sections (ที่เดิม) · คืนข้อความรายงาน · from ต้องพบครั้งเดียวพอดี ไม่งั้นโยน
function applyCorrections(sections, list) {
  const log = [];
  for (const c of list || []) {
    const s = sections.find((x) => x.n === c.n);
    if (!s) throw new Error('แก้ไม่ได้: ไม่มีมาตรา ' + c.n);
    const k = s.t.split(c.from).length - 1;
    if (k !== 1) throw new Error('แก้ไม่ได้: "' + c.from + '" พบ ' + k + ' ครั้งในมาตรา ' + c.n);
    s.t = s.t.replace(c.from, c.to);
    log.push(c.n + ': "' + c.from + '" → "' + c.to + '" (' + c.why + ')');
  }
  return log;
}

function makePack(code, sections, meta) {
  const c = L.CODES.find((x) => x.code === code);
  if (!c) throw new Error('ไม่รู้จักรหัส ' + code + ' (ต้องอยู่ใน LawCalc.CODES)');
  const pack = { v: 1, code, name: c.name, src: meta.src, asOf: meta.asOf, s: sections };
  if (meta.x && meta.x.length) pack.x = meta.x;
  return pack;
}

// ตรวจชุดก่อนเขียน → รายการปัญหา (ว่าง = ผ่าน)
function checkPack(pack) {
  const bad = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pack.asOf || '')) bad.push('asOf ไม่ใช่ YYYY-MM-DD');
  const seen = new Set();
  let prev = null;
  for (const s of pack.s) {
    if (!L.refKey({ code: pack.code, n: s.n })) bad.push('เลขมาตราไม่ตรงรูปแบบ LawCalc: ' + s.n);
    if (seen.has(s.n)) bad.push('มาตราซ้ำ: ' + s.n);
    seen.add(s.n);
    if (prev && !nLess(prev, s.n)) bad.push('ลำดับมาตราย้อน: ' + prev + ' → ' + s.n);
    prev = s.n;
    if (!s.t) bad.push('มาตรา ' + s.n + ' ไม่มีข้อความ');
    if (s.t.indexOf(WATERMARK) >= 0) bad.push('ลายน้ำหลุดในมาตรา ' + s.n);
    if (/[\u0001\u0002�]/.test(s.t)) bad.push('อักขระควบคุมหลุดในมาตรา ' + s.n); // eslint-disable-line no-control-regex
    if ((s.t + (s.b || '')).indexOf(WRAP) >= 0) bad.push('รอยตัดบรรทัดยังไม่ได้ resolveWraps ในมาตรา ' + s.n);
    const g = garbleReport(s.t);
    if (g.length) bad.push('ฟอนต์เพี้ยนในมาตรา' + s.n + ': ' + g.slice(0, 3).join(' | '));
  }
  return bad;
}

// เทียบกับข้อความอ้างอิง (thailaw) แบบตัวอักษรต่อตัวอักษร ไม่นับช่องว่าง/เครื่องหมายคำพูด/เลขเชิงอรรถ
// → {same, a, b, at, ctxA, ctxB} — ใช้ยืนยันว่าดึง PDF ครบ ไม่ตก ไม่เกิน
function letters(s) {
  // thailaw เก็บเครื่องหมายคำพูดเป็น U+0093/U+0094 (cp1252 ถอดผิด)
  return normalizeText(s).replace(/\[[๐-๙0-9]+\]/g, '').replace(/[\s“”"'‘’`\u0091-\u0094]/g, '');
}
function compareLetters(a, b) {
  const x = letters(a), y = letters(b);
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return { same: x === y, a: x.length, b: y.length, at: i, ctxA: x.slice(Math.max(0, i - 20), i + 30), ctxB: y.slice(Math.max(0, i - 20), i + 30) };
}

// แยกข้อความ thailaw (HTML ของกฤษฎีกา) เป็นมาตรา เพื่อเทียบรายมาตรา
function refSections(text, marker) {
  const out = new Map();
  const re = new RegExp('(?:^|\\n)\\s*' + marker + '\\s*([๐-๙0-9]{1,4}(?:\\s*\\/\\s*[๐-๙0-9]{1,3})?)(?:\\s*(ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|นว|ทศ)(?![\\u0E01-\\u0E4E])(?:\\s*\\/\\s*([๐-๙0-9]{1,3}))?)?', 'g');
  const hits = [];
  let m;
  while ((m = re.exec(text))) hits.push({ n: canonN(m[1], m[2], m[3]), at: m.index, start: m.index + m[0].length });
  hits.forEach((h, i) => { h.end = i + 1 < hits.length ? hits[i + 1].at : text.length; });
  // ช่วงเลขที่เรียงขึ้นยาวที่สุด แบบเดียวกับ splitSections (ข้าม พ.ร.บ.ให้ใช้ ข้างหน้าที่มีเลขมาตราซ้ำกับตัวประมวล)
  const runs = [];
  let run = null;
  for (const h of hits) {
    if (!run || !nLess(run[run.length - 1].n, h.n)) { run = []; runs.push(run); }
    run.push(h);
  }
  let best = [];
  for (const r of runs) if (r.length > best.length) best = r;
  for (const h of best) {
    let t = text.slice(h.start, h.end);
    t = t.replace(/\n\s*(หมวด|ภาค|ลักษณะ|ส่วนที่|บรรพ)\s*[๐-๙0-9]+[\s\S]*$/, '').replace(/\n\s*บทเฉพาะกาล[\s\S]*$/, '')
      .replace(/\n\s*(ผู้รับสนองพระบรมราชโองการ|ประกาศ ณ วันที่|หมายเหตุ\s*:-)[\s\S]*$/, '');
    if (!out.has(h.n)) out.set(h.n, t);
  }
  return out;
}

// WRAP (บรรทัดใน PDF ตัดระหว่างอักษรไทยสองตัว) → ' ' ถ้าฉบับอ้างอิงมีช่องว่าง/ขึ้นบรรทัดตรงรอยนั้น ไม่งั้น ''
// หาตำแหน่งด้วยตัวอักษรรอบรอย (ซ้าย 8 + ขวา 8, ไม่พบลด 6/4) ในข้อความอ้างอิงที่ตัดช่องว่าง/คำพูด/เลขเชิงอรรถออก
// ref = null หรือหาไม่พบ = '' (ข้อความกฎหมายไทยตัดบรรทัดกลางคำได้)
function resolveWraps(t, ref) {
  if (t.indexOf(WRAP) < 0) return t;
  if (ref == null) return t.split(WRAP).join('');
  const SKIP = /[\s“”"'‘’`\u0091-\u0094]/;
  const src = normalizeText(ref).replace(/\[[๐-๙0-9]+\]/g, '');
  let flat = '';
  const gap = [];
  let sp = false;
  for (const ch of src) {
    if (SKIP.test(ch)) { if (/\s/.test(ch)) sp = true; continue; }
    gap.push(sp); flat += ch; sp = false;
  }
  const parts = t.split(WRAP);
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const left = letters(out), right = letters(parts.slice(i).join(''));
    let space = false;
    for (const k of [8, 6, 4]) {
      const a = left.slice(-k), b = right.slice(0, k);
      if (a.length < 2 || b.length < 2) continue;
      const p = flat.indexOf(a + b);
      if (p >= 0) { space = gap[p + a.length]; break; }
    }
    out += (space ? ' ' : '') + parts[i];
  }
  return out;
}

module.exports = {
  WRAP, resolveWraps, WATERMARK, normalizeText, garbleReport, pageLines, documentLines, paragraphs, joinWrap,
  splitSections, appendices, canonN, nLess, thaiDateIso, latestGazette, applyCorrections, makePack, checkPack,
  compareLetters, refSections, arabic, BAI_JAMJUREE_UNMAPPED, fillUnmappedGlyphs, stripOpinionBoxes,
};
