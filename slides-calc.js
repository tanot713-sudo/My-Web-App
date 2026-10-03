/* ══════════════════════════════════════════════════════════════════
   Tanot — งาน PowerPoint: ตรรกะล้วน (ไม่มี DOM/storage) · UMD — window.SlidesCalc ในหน้า, require() ได้ใน tests/slides.spec.js
   slides.html / slides.js ใช้ไฟล์นี้ร่วมกัน — ห้ามมีกฎ parse/เลือกแบบสไลด์/ตำแหน่งวางของตัวเองใน slides.js

   รูปแบบโครงเรื่อง (outline) — ข้อความธรรมดาที่ผู้ใช้พิมพ์:
     # ชื่อสไลด์            ขึ้นสไลด์ใหม่
     - bullet               ย่อหน้าซ้อนด้วยช่องว่าง/แท็บนำหน้า (ได้ 2 ระดับ: 0 และ 1)
     ข้อความธรรมดา          ย่อหน้าไม่มีจุด (หน้าปก/หัวข้อตอนใช้เป็นคำบรรยายใต้ชื่อ)
     > โน้ต                 โน้ตผู้บรรยาย (หลายบรรทัดต่อกัน)
     ---                    ขึ้นคอลัมน์ที่ 2 (แบบ 2 คอลัมน์)
     บรรทัดที่มีแท็บ / เริ่มด้วย |   แถวของตาราง (วางจาก Excel ได้ตรงๆ)
     @layout two            เลือกแบบสไลด์เอง (cover|bullets|two|image|table|section) — ไม่ใส่ = เลือกอัตโนมัติ
     @image k1              รูปของสไลด์ (k1 = กุญแจใน deck.images)

   ชุดสไลด์ (localStorage['tanot:slides:decks'] = array, sync mode 'list' idField 'id', 1 ชุด = 1 แถว — ไม่เก็บไบนารี):
     { v:1, id, name, outline, theme: 'light'|'dark'|'accent'|'plain', accent: 'RRGGBB'|null (null = ตามสีเน้นของเว็บตอนนั้น),
       images: { <key>: { id?, name, size, mime, w, h, pending? } }  (id = ไฟล์ใน R2 ผ่าน /api/files?ns=slides; pending = ยังอยู่ใน outbox ของเครื่องเดียว),
       createdAt, updatedAt }

   ตำแหน่งทุกอย่างเป็นนิ้วบนสไลด์ 16:9 (13.333 × 7.5) — หน้าเว็บวาดตัวอย่าง/โหมดนำเสนอ/PDF จาก shape ชุดเดียวกับที่ส่งให้ PptxGenJS
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SlidesCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 13.333, H = 7.5;
  var PPTX_FONT = 'Tahoma'; // มีทั้ง Windows/Mac และรองรับไทย (Prompt ใช้ในเว็บเท่านั้น — ไม่มีในเครื่องคนรับไฟล์)
  var WEB_FONT = 'Prompt';
  var AI_MAX_CHARS = 30000;
  var MAX_OUTLINE = 200000;

  var LAYOUTS = [
    { id: 'cover', name: 'หน้าปก' },
    { id: 'bullets', name: 'หัวข้อ + bullet' },
    { id: 'two', name: '2 คอลัมน์' },
    { id: 'image', name: 'รูป + ข้อความ' },
    { id: 'table', name: 'ตาราง' },
    { id: 'section', name: 'หัวข้อตอน' }
  ];
  var THEMES = [
    { id: 'light', name: 'สว่าง' },
    { id: 'dark', name: 'มืด' },
    { id: 'accent', name: 'สีเน้น' },
    { id: 'plain', name: 'เรียบ' }
  ];
  function layoutIds() { return LAYOUTS.map(function (l) { return l.id; }); }
  function themeIds() { return THEMES.map(function (t) { return t.id; }); }

  /* ══════════ สี ══════════ */
  function normHex(s, dflt) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(s == null ? '' : s).trim());
    if (m) return m[1].toUpperCase();
    var m3 = /^#?([0-9a-f]{3})$/i.exec(String(s == null ? '' : s).trim());
    if (m3) return (m3[1][0] + m3[1][0] + m3[1][1] + m3[1][1] + m3[1][2] + m3[1][2]).toUpperCase();
    return dflt === undefined ? null : dflt;
  }
  function lum(hex) {
    var c = [0, 2, 4].map(function (i) {
      var v = parseInt(hex.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function onColor(hex) { return lum(hex) > 0.4 ? '1F2430' : 'FFFFFF'; }

  function palette(themeId, accent) {
    var a = normHex(accent, '0F8F82');
    var t = themeIds().indexOf(themeId) >= 0 ? themeId : 'light';
    var p = { id: t, accent: a, onAccent: onColor(a), bar: true };
    if (t === 'dark') {
      p.bg = '151A26'; p.title = 'F4F6FB'; p.text = 'D5DAE6'; p.muted = '8A93A8'; p.panel = '20273A'; p.line = '33405A';
      p.coverBg = p.bg; p.coverTitle = p.title; p.coverText = p.muted; p.sectionBg = p.panel; p.sectionTitle = p.title; p.sectionText = p.muted;
      p.headFill = a; p.headText = p.onAccent;
    } else if (t === 'accent') {
      p.bg = 'FFFFFF'; p.title = '1F2430'; p.text = '33394A'; p.muted = '727C93'; p.panel = 'F3F5F9'; p.line = 'DDE2EC';
      p.coverBg = a; p.coverTitle = p.onAccent; p.coverText = p.onAccent; p.sectionBg = a; p.sectionTitle = p.onAccent; p.sectionText = p.onAccent;
      p.headFill = a; p.headText = p.onAccent; p.bar = false;
    } else if (t === 'plain') {
      p.bg = 'FFFFFF'; p.title = '000000'; p.text = '222222'; p.muted = '666666'; p.panel = 'FFFFFF'; p.line = '999999';
      p.coverBg = p.bg; p.coverTitle = p.title; p.coverText = p.muted; p.sectionBg = p.bg; p.sectionTitle = p.title; p.sectionText = p.muted;
      p.headFill = 'EEEEEE'; p.headText = '000000'; p.bar = false;
    } else {
      p.bg = 'FFFFFF'; p.title = '1F2430'; p.text = '33394A'; p.muted = '727C93'; p.panel = 'F3F5F9'; p.line = 'DDE2EC';
      p.coverBg = p.bg; p.coverTitle = p.title; p.coverText = p.muted; p.sectionBg = p.panel; p.sectionTitle = p.title; p.sectionText = p.muted;
      p.headFill = a; p.headText = p.onAccent;
    }
    return p;
  }

  /* ══════════ parse โครงเรื่อง ══════════ */
  function indentOf(ws) {
    var n = 0;
    for (var i = 0; i < ws.length; i++) n += ws[i] === '\t' ? 2 : 1;
    return n;
  }
  function newSlide(title, line, titled) {
    return { i: 0, title: title, items: [], items2: [], colBreak: false, table: [], notes: '', image: null, layoutExplicit: null,
      startLine: line, endLine: line + 1, titled: !!titled };
  }
  function tableCells(line) {
    var t = line.trim();
    if (line.indexOf('\t') >= 0) return line.replace(/\s+$/, '').split('\t').map(function (c) { return c.trim(); });
    t = t.replace(/^\|/, '').replace(/\|$/, '');
    return t.split('|').map(function (c) { return c.trim(); });
  }

  function parseOutline(text) {
    var lines = String(text == null ? '' : text).split(/\r\n|\r|\n/);
    var slides = [], cur = null;
    function ensure(i) {
      if (!cur) { cur = newSlide('', i, false); slides.push(cur); }
      return cur;
    }
    lines.forEach(function (raw, i) {
      var trimmed = raw.trim();
      var m;
      if (!trimmed) { if (cur) cur.endLine = i + 1; return; }
      if ((m = /^#\s+(.*)$/.exec(trimmed)) || trimmed === '#') {
        cur = newSlide(m ? m[1].trim() : '', i, true);
        slides.push(cur);
        return;
      }
      var s = ensure(i);
      s.endLine = i + 1;
      if ((m = /^@(\w+)\s*(.*)$/.exec(trimmed))) {
        var name = m[1].toLowerCase(), val = m[2].trim();
        if (name === 'layout' && layoutIds().indexOf(val) >= 0) s.layoutExplicit = val;
        else if (name === 'image' && /^[a-z0-9]{1,12}$/i.test(val)) s.image = val;
        return;
      }
      if ((m = /^>\s?(.*)$/.exec(trimmed))) { s.notes += (s.notes ? '\n' : '') + m[1]; return; }
      if (/^-{3,}$/.test(trimmed)) { s.colBreak = true; return; }
      if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(trimmed) && trimmed.indexOf('|') >= 0) return; // แถวคั่นของตาราง markdown
      if (raw.indexOf('\t') >= 0 && !/^\s*[-*•]\s/.test(raw) || /^\|.*\|?$/.test(trimmed)) {
        var cells = tableCells(raw);
        if (cells.some(function (c) { return c !== ''; })) s.table.push(cells);
        return;
      }
      var b = /^(\s*)[-*•]\s+(.*)$/.exec(raw);
      var item;
      if (b) item = { t: b[2].trim(), l: indentOf(b[1]) >= 2 ? 1 : 0, bullet: true };
      else item = { t: trimmed, l: 0, bullet: false };
      (s.colBreak ? s.items2 : s.items).push(item);
    });
    slides.forEach(function (s, i) { s.i = i; });
    return { slides: slides, lines: lines };
  }

  /* เลือกแบบสไลด์อัตโนมัติจากเนื้อหา — คืน { id, auto } */
  function layoutOf(slide, index) {
    if (slide.layoutExplicit) return { id: slide.layoutExplicit, auto: false };
    var id;
    var bullets = slide.items.filter(function (x) { return x.bullet; }).length + slide.items2.filter(function (x) { return x.bullet; }).length;
    var any = slide.items.length + slide.items2.length;
    if (slide.table.length) id = 'table';
    else if (slide.image) id = 'image';
    else if (slide.colBreak && slide.items2.length) id = 'two';
    else if (!any) id = index === 0 ? 'cover' : 'section';
    else if (index === 0 && !bullets && slide.items.length <= 2) id = 'cover';
    else id = 'bullets';
    return { id: id, auto: true };
  }

  /* แก้/เพิ่ม/ลบบรรทัด @name ของสไลด์ที่ idx ในข้อความโครงเรื่อง — value ว่าง/null = ลบ */
  function setDirective(text, idx, name, value) {
    var p = parseOutline(text), s = p.slides[idx];
    if (!s) return String(text == null ? '' : text);
    var lines = p.lines.slice();
    var re = new RegExp('^\\s*@' + name + '(\\s|$)', 'i');
    var found = -1;
    for (var i = s.startLine; i < s.endLine && i < lines.length; i++) if (re.test(lines[i])) { found = i; break; }
    var has = value != null && value !== '';
    if (found >= 0) {
      if (has) lines[found] = '@' + name + ' ' + value; else lines.splice(found, 1);
    } else if (has) {
      lines.splice(s.titled ? s.startLine + 1 : s.startLine, 0, '@' + name + ' ' + value);
    }
    return lines.join('\n');
  }

  /* ══════════ ขนาดตัวอักษร (ประมาณจำนวนบรรทัด แล้วลดจนพอดีกล่อง) ══════════ */
  var CHAR_W = 0.55; // ความกว้างตัวอักษรเฉลี่ย (เท่าของ font-size) ครอบคลุมไทย+อังกฤษแบบหยาบ
  function estLines(t, size, w) {
    var per = Math.max(4, Math.floor((w * 72) / (size * CHAR_W)));
    var n = 0;
    String(t).split('\n').forEach(function (ln) { n += Math.max(1, Math.ceil(ln.length / per)); });
    return n;
  }
  function estHeight(items, size, w) {
    var h = 0;
    items.forEach(function (it) {
      var sz = it.l ? size - 3 : size, iw = w - (it.bullet ? 0.4 : 0) - (it.l ? 0.5 : 0);
      h += estLines(it.t, sz, iw) * sz * 1.35 / 72 + size * 0.45 / 72;
    });
    return h;
  }
  function fitSize(items, w, h, base, min) {
    var s = base;
    while (s > min && estHeight(items, s, w) > h) s -= 2;
    return Math.max(min, s);
  }

  function fitRect(boxW, boxH, iw, ih) {
    if (!(iw > 0 && ih > 0)) return { x: 0, y: 0, w: boxW, h: boxH };
    var r = Math.min(boxW / iw, boxH / ih), w = iw * r, h = ih * r;
    return { x: (boxW - w) / 2, y: (boxH - h) / 2, w: w, h: h };
  }

  /* ══════════ สร้าง shape ของสไลด์ ══════════ */
  function textShape(x, y, w, h, paras, o) {
    o = o || {};
    return { k: 'text', x: x, y: y, w: w, h: h, paras: paras, valign: o.valign || 'top', align: o.align || 'left' };
  }
  function bodyParas(items, size, color, forcePlain) {
    return items.map(function (it) {
      return { t: it.t, size: it.l ? size - 3 : size, color: color, bullet: forcePlain ? false : !!it.bullet, lvl: it.l, after: Math.round(size * 0.45) };
    });
  }
  function pageNum(i, p) {
    return textShape(11.93, 6.95, 0.7, 0.3, [{ t: String(i + 1), size: 11, color: p.muted, align: 'right' }], { valign: 'middle' });
  }
  function titleBlock(slide, p) {
    var out = [];
    var sz = fitSize([{ t: slide.title, l: 0 }], 11.93, 1.0, 32, 20);
    out.push(textShape(0.7, 0.45, 11.93, 1.0, [{ t: slide.title, size: sz, bold: true, color: p.title }], { valign: 'middle' }));
    if (p.bar) out.push({ k: 'rect', x: 0.7, y: 1.5, w: 1.2, h: 0.06, fill: p.accent });
    else out.push({ k: 'rect', x: 0.7, y: 1.52, w: 11.93, h: 0.015, fill: p.line });
    return out;
  }
  function tableFont(rows, cols) {
    var s = rows <= 6 ? 18 : rows <= 9 ? 15 : rows <= 12 ? 13 : rows <= 16 ? 11 : 9;
    if (cols > 5) s = Math.min(s, 14);
    if (cols > 7) s = Math.min(s, 11);
    return s;
  }

  /* slide = ผลจาก parseOutline · ctx = { index, total, palette } → { bg, shapes, notes, layout } */
  function slideShapes(slide, layoutId, ctx) {
    var p = ctx.palette, i = ctx.index, shapes = [], bg = p.bg;
    var title = slide.title || '';
    var all = slide.items.concat(slide.items2);

    if (layoutId === 'cover') {
      bg = p.coverBg;
      if (p.id === 'accent') { /* พื้นสีเน้นทั้งหน้า */ }
      else if (p.bar) shapes.push({ k: 'rect', x: 0.7, y: 2.15, w: 0.1, h: 2.5, fill: p.accent });
      else shapes.push({ k: 'rect', x: 0.7, y: 4.62, w: 11.93, h: 0.015, fill: p.line });
      var tsz = fitSize([{ t: title, l: 0 }], 11.6, 1.7, 44, 26);
      shapes.push(textShape(1.05, 2.1, 11.6, 1.7, [{ t: title, size: tsz, bold: true, color: p.coverTitle }], { valign: 'bottom' }));
      if (all.length) shapes.push(textShape(1.05, 3.95, 11.6, 1.5, bodyParas(all, 22, p.coverText, true), { valign: 'top' }));
    } else if (layoutId === 'section') {
      bg = p.sectionBg;
      shapes.push({ k: 'rect', x: 0.7, y: 2.55, w: 0.1, h: 1.6, fill: p.id === 'accent' ? p.onAccent : p.accent });
      var ssz = fitSize([{ t: title, l: 0 }], 11.3, 1.6, 40, 24);
      shapes.push(textShape(1.05, 2.55, 11.3, 1.6, [{ t: title, size: ssz, bold: true, color: p.sectionTitle }], { valign: 'middle' }));
      if (all.length) shapes.push(textShape(1.05, 4.3, 11.3, 1.6, bodyParas(all, 20, p.sectionText, true), { valign: 'top' }));
    } else {
      shapes = shapes.concat(titleBlock(slide, p));
      if (layoutId === 'two') {
        var l = slide.items, r = slide.items2;
        var sz2 = Math.min(fitSize(l, 5.8, 4.85, 24, 14), fitSize(r, 5.8, 4.85, 24, 14));
        shapes.push(textShape(0.7, 1.85, 5.8, 4.85, bodyParas(l, sz2, p.text)));
        shapes.push({ k: 'rect', x: 6.66, y: 1.95, w: 0.012, h: 4.6, fill: p.line });
        shapes.push(textShape(6.83, 1.85, 5.8, 4.85, bodyParas(r, sz2, p.text)));
      } else if (layoutId === 'image') {
        var szi = fitSize(all, 6.0, 4.85, 24, 14);
        shapes.push(textShape(0.7, 1.85, 6.0, 4.85, bodyParas(all, szi, p.text)));
        if (slide.image) shapes.push({ k: 'image', x: 7.1, y: 1.85, w: 5.53, h: 4.85, key: slide.image });
      } else if (layoutId === 'table' && slide.table.length) {
        var cols = 0;
        slide.table.forEach(function (r2) { cols = Math.max(cols, r2.length); });
        var rows = slide.table.map(function (r2) { var c = r2.slice(); while (c.length < cols) c.push(''); return c; });
        var cw = []; for (var c = 0; c < cols; c++) cw.push(Math.round(11.93 / cols * 1000) / 1000);
        shapes.push({ k: 'table', x: 0.7, y: 1.85, w: 11.93, h: 4.85, colW: cw, rows: rows, size: tableFont(rows.length, cols),
          headFill: p.headFill, headText: p.headText, text: p.text, line: p.line, zebra: p.panel });
        if (all.length) { /* ข้อความที่พิมพ์ปนกับตารางไม่แสดง */ }
      } else {
        var szb = fitSize(all, 11.93, 4.85, 26, 14);
        shapes.push(textShape(0.7, 1.85, 11.93, 4.85, bodyParas(all, szb, p.text)));
      }
      shapes.push(pageNum(i, p));
    }
    return { bg: bg, shapes: shapes, notes: slide.notes || '', layout: layoutId };
  }

  /* โครงข้อมูลทั้งชุดสำหรับส่งให้ PptxGenJS / วาดตัวอย่าง */
  function buildModel(deck, opts) {
    opts = opts || {};
    var p = palette(deck && deck.theme, (deck && deck.accent) || opts.accent);
    var parsed = parseOutline(deck ? deck.outline : '');
    var slides = parsed.slides.map(function (s, i) {
      var lo = layoutOf(s, i);
      var sh = slideShapes(s, lo.id, { index: i, total: parsed.slides.length, palette: p });
      sh.auto = lo.auto; sh.title = s.title;
      return sh;
    });
    return { w: W, h: H, font: PPTX_FONT, webFont: WEB_FONT, palette: p, title: (deck && deck.name) || '', slides: slides };
  }

  /* ══════════ AI ช่วยร่างโครงเรื่อง ══════════ */
  var AI_SYSTEM = 'คุณคือผู้ช่วยสร้างโครงเรื่องงานนำเสนอ (PowerPoint) จากข้อความที่ผู้ใช้วางมา ตอบเป็นภาษาเดียวกับข้อความต้นฉบับ (ส่วนใหญ่ไทย) '
    + 'ตอบเฉพาะโครงเรื่องตามรูปแบบนี้เท่านั้น ห้ามมีคำอธิบายนำหรือท้าย ห้ามใช้ markdown อื่นนอกจากรูปแบบนี้:\n'
    + '# ชื่อสไลด์ (บรรทัดที่ขึ้นต้นด้วย "# " = สไลด์ใหม่; สไลด์แรกคือหน้าปก)\n'
    + '- ประเด็นสั้นๆ (หนึ่งบรรทัดต่อหนึ่งประเด็น ไม่เกิน 12 คำ; ซ้อนระดับย่อยได้ 1 ชั้นด้วยการเว้นวรรค 2 ช่องนำหน้า)\n'
    + '> โน้ตสำหรับผู้บรรยาย (ไม่บังคับ)\n'
    + 'สไลด์ละ 3–5 ประเด็น รวมประมาณ 6–12 สไลด์ ใช้เฉพาะข้อเท็จจริงที่มีในข้อความ ห้ามแต่งตัวเลขหรือข้อมูลเพิ่ม';

  function aiMessages(source, o) {
    o = o || {};
    var src = String(source == null ? '' : source).trim();
    if (src.length > AI_MAX_CHARS) src = src.slice(0, AI_MAX_CHARS);
    var sys = AI_SYSTEM;
    if (o.slides > 0) sys += '\nจำนวนสไลด์ที่ต้องการ: ประมาณ ' + Math.round(o.slides) + ' สไลด์';
    return [{ role: 'system', content: sys }, { role: 'user', content: 'ข้อความต้นฉบับ:\n\n' + src }];
  }

  /* คำตอบโมเดล → โครงเรื่องที่ parse ได้: ตัดรั้ว ```, คำนำก่อน "# " แรก, ปรับจุด bullet/หัวข้อให้เป็นรูปแบบของเรา */
  function cleanOutline(text) {
    var t = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
    t = t.replace(/^\s*```[a-z]*\s*$/gim, '');
    var lines = t.split('\n');
    var first = -1;
    for (var i = 0; i < lines.length; i++) if (/^\s*#{1,6}\s+\S/.test(lines[i])) { first = i; break; }
    if (first > 0) lines = lines.slice(first);
    lines = lines.map(function (ln) {
      ln = ln.replace(/\s+$/, '').replace(/\*\*([^*]+)\*\*/g, '$1');
      ln = ln.replace(/^\s*#{1,6}\s+/, '# ');
      ln = ln.replace(/^(\s*)[*•–—]\s+/, '$1- ');
      ln = ln.replace(/^(\s*)\d{1,2}[.)]\s+/, '$1- ');
      return ln;
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ข้อความล้วน (จากไฟล์) → โครงเรื่องแบบหยาบเมื่อไม่มี AI: ย่อหน้า = สไลด์, บรรทัดแรก = ชื่อ, ที่เหลือ = bullet */
  function textToOutline(text) {
    var t = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
    if (!t) return '';
    if (/^#\s+\S/m.test(t)) return t;
    var out = [];
    t.split(/\n\s*\n/).forEach(function (para) {
      var ls = para.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      if (!ls.length) return;
      if (ls.length === 1) {
        if (ls[0].length <= 60) out.push('# ' + ls[0]);
        else { out.push('# ' + ls[0].slice(0, 50).trim() + '…'); out.push('- ' + ls[0]); }
      } else {
        out.push('# ' + ls[0].slice(0, 80));
        ls.slice(1).forEach(function (x) { out.push('- ' + x.replace(/^[-*•]\s+/, '')); });
      }
      out.push('');
    });
    return out.join('\n').trim();
  }

  /* ══════════ ชุดสไลด์ (เรคคอร์ด) ══════════ */
  function cleanImages(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).slice(0, 200).forEach(function (k) {
      var v = raw[k];
      if (!/^[a-z0-9]{1,12}$/i.test(k) || !v || typeof v !== 'object') return;
      var o = { name: String(v.name || 'image').slice(0, 200), size: Math.max(0, +v.size || 0), mime: String(v.mime || '').slice(0, 60),
        w: Math.max(0, Math.round(+v.w || 0)), h: Math.max(0, Math.round(+v.h || 0)) };
      if (v.id) o.id = String(v.id).slice(0, 80);
      if (v.pending && !v.id) o.pending = true;
      out[k] = o;
    });
    return out;
  }
  function cleanDeck(raw, id, now) {
    raw = raw || {};
    var th = themeIds().indexOf(raw.theme) >= 0 ? raw.theme : 'light';
    return {
      v: 1, id: String(raw.id || id),
      name: String(raw.name == null ? '' : raw.name).slice(0, 120),
      outline: String(raw.outline == null ? '' : raw.outline).slice(0, MAX_OUTLINE),
      theme: th, accent: normHex(raw.accent, null),
      images: cleanImages(raw.images),
      createdAt: +raw.createdAt || now || 0, updatedAt: +raw.updatedAt || now || 0
    };
  }
  function newDeck(id, now) { return cleanDeck({ id: id }, id, now); }
  function dupDeck(deck, id, now) {
    var c = cleanDeck(deck, id, now);
    c.id = id; c.name = ((deck.name || 'ชุดสไลด์') + ' (สำเนา)').slice(0, 120); c.createdAt = now; c.updatedAt = now;
    return c; // รูปอ้างไฟล์เดิมใน R2 ร่วมกัน (ไม่คัดลอกไบนารี) — ลบชุดใดชุดหนึ่งต้องดู exclusiveIds
  }
  function deckTitle(deck) {
    if (deck.name) return deck.name;
    var p = parseOutline(deck.outline);
    for (var i = 0; i < p.slides.length; i++) if (p.slides[i].title) return p.slides[i].title;
    return 'ชุดสไลด์ใหม่';
  }
  function slideCount(deck) { return parseOutline(deck.outline).slides.length; }
  function matches(deck, q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return true;
    return (String(deck.name || '') + '\n' + String(deck.outline || '')).toLowerCase().indexOf(q) >= 0;
  }

  /* id ไฟล์ R2 ในชุดนี้ (เฉพาะกุญแจ keys ถ้าระบุ) ที่ไม่มีชุดอื่นอ้างถึง — ใช้ตัดสินว่าจะ DELETE ได้ไหม */
  function exclusiveIds(deck, allDecks, keys) {
    var used = {};
    (allDecks || []).forEach(function (d) {
      if (!d || d.id === deck.id) return;
      Object.keys(d.images || {}).forEach(function (k) { var im = d.images[k]; if (im && im.id) used[im.id] = true; });
    });
    var out = [];
    Object.keys(deck.images || {}).forEach(function (k) {
      if (keys && keys.indexOf(k) < 0) return;
      var im = deck.images[k];
      if (im && im.id && !used[im.id] && out.indexOf(im.id) < 0) out.push(im.id);
    });
    return out;
  }

  return {
    W: W, H: H, PPTX_FONT: PPTX_FONT, WEB_FONT: WEB_FONT, AI_MAX_CHARS: AI_MAX_CHARS, LAYOUTS: LAYOUTS, THEMES: THEMES,
    normHex: normHex, onColor: onColor, palette: palette,
    parseOutline: parseOutline, layoutOf: layoutOf, setDirective: setDirective,
    fitSize: fitSize, fitRect: fitRect, slideShapes: slideShapes, buildModel: buildModel,
    aiMessages: aiMessages, cleanOutline: cleanOutline, textToOutline: textToOutline,
    cleanDeck: cleanDeck, newDeck: newDeck, dupDeck: dupDeck, deckTitle: deckTitle, slideCount: slideCount, matches: matches,
    exclusiveIds: exclusiveIds
  };
});
