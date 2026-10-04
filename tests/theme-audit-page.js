/* โค้ดฝั่งเบราว์เซอร์ของ tests/theme-audit.spec.js — ฉีดด้วย page.addScriptTag แล้วเรียก window.__tanotAudit.*
   ไม่ใช่ไฟล์ของเว็บ (อยู่ใน tests/ ไม่ถูกเสิร์ฟให้ผู้ใช้) */
(function () {
  'use strict';

  /* ── สี ── */
  function parse(str) {
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(str || '');
    if (!m) {
      // color(srgb r g b / a) จาก color-mix
      var c = /color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\)/.exec(str || '');
      if (!c) return { r: 0, g: 0, b: 0, a: 0 };
      var ca = c[4] == null ? 1 : (/%$/.test(c[4]) ? parseFloat(c[4]) / 100 : parseFloat(c[4]));
      return { r: +c[1] * 255, g: +c[2] * 255, b: +c[3] * 255, a: ca };
    }
    var a = m[4] == null ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return { r: +m[1], g: +m[2], b: +m[3], a: a };
  }
  function blend(top, bot) {
    var a = top.a + bot.a * (1 - top.a);
    if (!a) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (top.r * top.a + bot.r * bot.a * (1 - top.a)) / a,
      g: (top.g * top.a + bot.g * bot.a * (1 - top.a)) / a,
      b: (top.b * top.a + bot.b * bot.a * (1 - top.a)) / a, a: a
    };
  }
  function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function hex(c) { return '#' + [c.r, c.g, c.b].map(function (v) { return Math.round(v).toString(16).padStart(2, '0'); }).join(''); }

  var WHITE = { r: 255, g: 255, b: 255, a: 1 };
  function canvasColor() {
    var b = parse(getComputedStyle(document.body).backgroundColor);
    var h = parse(getComputedStyle(document.documentElement).backgroundColor);
    return blend(b.a ? b : h, WHITE);
  }
  /* พื้นหลังที่มองเห็นจริงใต้ el: ซ้อนสีพื้นของบรรพบุรุษ (รวม alpha) จนเจอสีทึบ
     image = มีภาพ/gradient ขวาง (ตัดสินด้วยสีไม่ได้) · page = ไม่มีกล่องทึบ อยู่บนพื้นหน้าโดยตรง */
  function effectiveBg(el) {
    var layers = [], n = el, page = true;
    for (; n && n.nodeType === 1; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (n !== document.documentElement && n !== document.body && cs.backgroundImage && cs.backgroundImage !== 'none') return { image: true };
      var c = parse(cs.backgroundColor);
      if (c.a > 0 && n !== document.body && n !== document.documentElement) {
        var o = parseFloat(cs.opacity);
        layers.push(c);
        if (c.a >= 0.999) { page = false; break; }
      }
    }
    var col = canvasColor();
    for (var i = layers.length - 1; i >= 0; i--) col = blend(layers[i], col);
    return { color: col, page: page };
  }

  function visible(el) {
    if (!el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (r.right < 0 || r.bottom < 0 || r.left > document.documentElement.scrollWidth) return false;
    if (el.closest('[aria-hidden="true"],[inert],.ome-drawer:not(.open),.ome-settings-panel:not(.open),details:not([open]) > :not(summary)')) return false;
    return true;
  }

  function selector(el) {
    var parts = [];
    for (var n = el, d = 0; n && n.nodeType === 1 && d < 4; n = n.parentElement, d++) {
      if (n.id) { parts.unshift('#' + CSS.escape(n.id)); break; }
      var s = n.tagName.toLowerCase();
      var cls = [].filter.call(n.classList, function (c) { return !/^(on|active|open|sel)$/.test(c); }).slice(0, 2);
      if (cls.length) s += '.' + cls.map(function (c) { return CSS.escape(c); }).join('.');
      var p = n.parentElement;
      if (p) {
        var same = [].filter.call(p.children, function (x) { return x.tagName === n.tagName; });
        if (same.length > 1) s += ':nth-of-type(' + (same.indexOf(n) + 1) + ')';
      }
      parts.unshift(s);
    }
    return parts.join(' > ');
  }
  function snippet(el) {
    var t = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
    return t.length > 40 ? t.slice(0, 40) + '…' : t;
  }

  var SHELL = '.ome-nav,.ome-drawer,.ome-settings-panel,.ome-footer,.ome-pal,.ome-qa,.ome-ai-fab,.ome-ai-panel';
  var CENTRAL_BTN = '.btn,.tab,.chip,.list-row,.tile,.dropzone,.lang-toggle,.segmented > *,.subnav-groups button,.subnav-row a,details.disclosure > summary';
  var CENTRAL_INPUT = '.input,.select,.textarea,.field input,.field select,.field textarea';
  var SKIP_INPUT = /^(checkbox|radio|range|file|color|hidden|image)$/;

  function isLarge(cs) {
    var px = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight, 10) || 400;
    return px >= 24 || (px >= 18.66 && w >= 700);
  }
  function borderColorOver(el, cs, under) {
    var best = null;
    ['Top', 'Right', 'Bottom', 'Left'].forEach(function (s) {
      var w = parseFloat(cs['border' + s + 'Width']);
      if (!(w > 0) || cs['border' + s + 'Style'] === 'none') return;
      var c = parse(cs['border' + s + 'Color']);
      if (!c.a) return;
      var col = blend(c, under);
      var r = ratio(col, under);
      if (!best || r > best.ratio) best = { color: col, ratio: r };
    });
    return best;
  }

  /* ── ตรวจ control ทั้งหน้า ── */
  function audit(opts) {
    opts = opts || {};
    var out = { contrast: [], controlBorder: [], nonCentral: [], targetSize: [] };
    var els = document.querySelectorAll('button, a.btn, a[role=button], [role=button], [role=tab], [role=switch], input, select, textarea, summary, .segmented');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!visible(el)) continue;
      var tag = el.tagName.toLowerCase();
      var type = (el.getAttribute('type') || '').toLowerCase();
      var isInput = tag === 'input' || tag === 'select' || tag === 'textarea';
      if (tag === 'input' && SKIP_INPUT.test(type)) continue;
      var cs = getComputedStyle(el);
      var inShell = !!el.closest(SHELL);
      var sel = selector(el);
      var bg = effectiveBg(el);

      /* 1) ใช้คอมโพเนนต์กลางไหม (ไม่นับ shell — shell คือส่วนกลางเอง) */
      if (!inShell && !el.matches('.segmented')) {
        var central = isInput ? el.matches(CENTRAL_INPUT) : el.matches(CENTRAL_BTN);
        if (!central) out.nonCentral.push({ sel: sel, text: snippet(el) });
      }

      /* 2) คอนทราสต์ตัวอักษร ≥ 4.5 (ตัวใหญ่ ≥ 3) */
      if (!bg.image && !el.matches('.segmented')) {
        var hasText = isInput ? !!(el.value || el.getAttribute('placeholder') || tag === 'select') : !!(el.innerText || '').trim();
        if (hasText) {
          var fg = blend(parse(cs.color), bg.color);
          var r = ratio(fg, bg.color), need = isLarge(cs) ? 3 : 4.5;
          if (el.disabled || el.getAttribute('aria-disabled') === 'true') need = 0; // ปุ่มที่ปิดใช้งานได้รับยกเว้นตาม WCAG
          if (r < need) out.contrast.push({ sel: sel, text: snippet(el), ratio: +r.toFixed(2), fg: hex(fg), bg: hex(bg.color), need: need });
        }
      }

      /* 3) ขอบของ control ≥ 3:1 กับพื้นข้างๆ (หรือพื้นของตัวเองต่างจากพื้นข้างๆ ≥ 3:1) */
      if (!el.disabled) {
        var parentBg = el.parentElement ? effectiveBg(el.parentElement) : { color: canvasColor() };
        if (!parentBg.image && !bg.image) {
          var fill = ratio(bg.color, parentBg.color);
          var b = borderColorOver(el, cs, parentBg.color);
          var mustHave = isInput || el.matches('.segmented') || (!!b && fill < 3 && tag !== 'summary');
          if (mustHave && fill < 3 && (!b || b.ratio < 3)) {
            out.controlBorder.push({ sel: sel, text: snippet(el), ratio: b ? +b.ratio.toFixed(2) : 0, border: b ? hex(b.color) : 'none', bg: hex(parentBg.color) });
          }
        }
      }

      /* 4) เป้ากดบนมือถือ ≥ 40px */
      if (opts.mobile && !el.matches('.segmented')) {
        var rect = el.getBoundingClientRect();
        var isTextLink = tag === 'a' && !el.matches('.btn');
        if (!isTextLink && Math.min(rect.width, rect.height) < 39.5) {
          out.targetSize.push({ sel: sel, text: snippet(el), w: Math.round(rect.width), h: Math.round(rect.height) });
        }
      }
    }
    return out;
  }

  /* ── ตัวอักษรที่อยู่บนพื้นหน้าโดยตรง (ไม่อยู่ในกล่องทึบ) — สำหรับเทียบกับพิกเซลของภาพพื้นหลัง ── */
  function textOnPage() {
    var out = [], seen = new Set();
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var vw = window.innerWidth, vh = window.innerHeight;
    for (var t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!/\S/.test(t.nodeValue)) continue;
      var el = t.parentElement;
      if (!el || seen.has(el) || el.closest('script,style,noscript,svg,canvas')) continue;
      seen.add(el);
      if (!visible(el) || el.closest(SHELL)) continue;
      var bg = effectiveBg(el);
      if (bg.image || !bg.page) continue;
      var range = document.createRange();
      range.selectNodeContents(t);
      var rr = range.getBoundingClientRect();
      if (rr.width < 2 || rr.height < 2 || rr.bottom < 0 || rr.top > vh || rr.left > vw) continue;
      var cs = getComputedStyle(el);
      var col = parse(cs.color);
      out.push({
        sel: selector(el), text: snippet(el), color: col, large: isLarge(cs),
        rect: { x: Math.max(0, rr.left), y: Math.max(0, rr.top), w: Math.min(vw, rr.right) - Math.max(0, rr.left), h: Math.min(vh, rr.bottom) - Math.max(0, rr.top) }
      });
      if (out.length >= 80) break;
    }
    return out;
  }
  /* เทียบสีตัวอักษรกับพิกเซลพื้น (ภาพหน้าจอที่ซ่อนตัวอักษรแล้ว) — ใช้เปอร์เซ็นไทล์ที่ 5 ของคอนทราสต์ */
  function sampleOnImage(pngDataUrl, items, dpr) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        var ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        var res = [];
        items.forEach(function (it) {
          var x = Math.floor(it.rect.x * dpr), y = Math.floor(it.rect.y * dpr);
          var w = Math.max(1, Math.floor(it.rect.w * dpr)), h = Math.max(1, Math.floor(it.rect.h * dpr));
          if (x + w > cv.width) w = cv.width - x;
          if (y + h > cv.height) h = cv.height - y;
          if (w < 1 || h < 1) return;
          var d = ctx.getImageData(x, y, w, h).data, ratios = [];
          var step = Math.max(1, Math.floor((w * h) / 4000));
          for (var p = 0; p < w * h; p += step) {
            var px = { r: d[p * 4], g: d[p * 4 + 1], b: d[p * 4 + 2], a: 1 };
            ratios.push(ratio(blend(it.color, px), px));
          }
          ratios.sort(function (a, b) { return a - b; });
          var r5 = ratios[Math.floor(ratios.length * 0.05)];
          var need = it.large ? 3 : 4.5;
          if (r5 < need) res.push({ sel: it.sel, text: it.text, ratio: +r5.toFixed(2), need: need });
        });
        resolve(res);
      };
      img.onerror = function () { resolve([]); };
      img.src = pngDataUrl;
    });
  }

  /* ── นับข้อความไทยใน UI ตอนโหมด EN ── */
  /* อักษร/เลข/วรรณยุกต์ไทย — ไม่นับ ฿ (U+0E3F สัญลักษณ์เงินบาท ใช้ได้ในโหมด EN) */
  var THAI = /[\u0E01-\u0E3E\u0E40-\u0E5B]/;
  function thaiInEn(opts) {
    opts = opts || {};
    var hits = [], seenEl = new Set();
    var UI = 'button,label,h1,h2,h3,h4,th,nav,[role=tab]';
    function skip(el) { return el.closest('[data-i18n-skip]') || (opts.excludeShell && el.closest(SHELL)); }
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (var t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!THAI.test(t.nodeValue)) continue;
      var p = t.parentElement;
      if (!p || p.closest('script,style,noscript,option')) continue;
      var ui = p.closest(UI);
      if (!ui || skip(p) || !visible(p)) continue;
      var key = ui.tagName === 'NAV' ? p : ui; // ใน nav นับทีละรายการ
      if (seenEl.has(key)) continue;
      seenEl.add(key);
      hits.push({ sel: selector(key), kind: 'text', text: snippet(key) });
    }
    var attrs = ['placeholder', 'title', 'aria-label'];
    document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(function (el) {
      if (skip(el) || !visible(el)) return;
      attrs.forEach(function (a) {
        var v = el.getAttribute(a);
        if (v && THAI.test(v)) hits.push({ sel: selector(el), kind: a, text: v.slice(0, 40) });
      });
    });
    document.querySelectorAll('select').forEach(function (s) {
      if (skip(s) || !visible(s)) return;
      [].forEach.call(s.options, function (o) {
        if (THAI.test(o.text) && !o.closest('[data-i18n-skip]')) hits.push({ sel: selector(s) + ' option', kind: 'option', text: o.text.slice(0, 40) });
      });
    });
    return hits;
  }

  /* ── ตัวกดสำรวจ (crawler) — หาเฉพาะแท็บ/segmented/toggle/ปุ่มเปิด dialog ที่ปลอดภัย ── */
  /* ข้ามปุ่มที่อาจทำลายข้อมูล/ส่งออกนอก/ใช้เน็ต-ไมค์-กล้อง/บันทึกข้อมูล (ข้อความ + aria-label + title) */
  var DANGER = /ลบ|ล้าง|รีเซ็ต|ส่ง|ซิงก์|ออก|นำเข้า|อัปโหลด|ดาวน์โหลด|พิมพ์|บันทึก|ยืนยัน|ตกลง|บันทึกเสียง|อัดเสียง|ไมค์|กล้อง|สแกน|ฟัง|อ่านออกเสียง|เล่น|เริ่ม|หยุด|สร้าง|สรุป|ถาม|แปล|อ่าน|ค้นหา|AI|delete|remove|reset|clear|sync|send|import|export|upload|download|print|save|confirm|log ?out|sign ?out|record|mic|camera|scan|listen|speak|play|start|stop|generate|summar|ask|translate|search|ocr/i;
  /* แท็บ / segmented / toggle / ปุ่มเปิด dialog และปุ่มทั่วไปที่ไม่เข้า DANGER */
  var CRAWL = '[role=tab],.tab,.tabs button,.segmented > button,[aria-haspopup],[aria-expanded],[aria-pressed],[role=switch],details > summary,.chip,.lang-toggle,.subnav-groups button,button,[role=button]';
  var crawlId = 0;
  function crawlCandidates() {
    var out = [];
    document.querySelectorAll(CRAWL).forEach(function (el) {
      if (el.hasAttribute('data-audit-crawl') || !visible(el) || el.closest(SHELL)) return;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      if (el.matches('[type=submit]') || (el.tagName === 'BUTTON' && el.form && !el.hasAttribute('type'))) return;
      if (el.tagName === 'A') {
        var href = el.getAttribute('href') || '';
        if (href && href.charAt(0) !== '#') return; // ลิงก์ไปหน้าอื่น/นอกโดเมน
      }
      var label = [el.innerText, el.getAttribute('aria-label'), el.getAttribute('title')].join(' ');
      if (DANGER.test(label)) return;
      var id = String(++crawlId);
      el.setAttribute('data-audit-crawl', id);
      out.push({ id: id, sel: selector(el), text: snippet(el) });
    });
    return out;
  }
  function closeOverlays() {
    var closed = 0;
    document.querySelectorAll('dialog[open]').forEach(function (d) { try { d.close(); closed++; } catch (e) {} });
    return closed;
  }

  window.__tanotAudit = { audit: audit, textOnPage: textOnPage, sampleOnImage: sampleOnImage, thaiInEn: thaiInEn,
    crawlCandidates: crawlCandidates, closeOverlays: closeOverlays };
})();
