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
  var CENTRAL_BTN = '.btn,.tab,.chip,.list-row,.tile,.dropzone,.lang-toggle,.stat-card,.segmented > *,.subnav-groups button,.subnav-row a,details.disclosure > summary';
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
        /* พื้นที่กดจริง = กล่องของตัวเองหรือ ::after ล่องหนที่ขยายออก (ปุ่มเล็กในแถว) — ใช้ค่าที่ใหญ่กว่า */
        var pcs = getComputedStyle(el, '::after'), pw = pcs.position === 'absolute' && pcs.content !== 'none' ? parseFloat(pcs.width) : 0, ph = pcs.position === 'absolute' && pcs.content !== 'none' ? parseFloat(pcs.height) : 0;
        var hw = Math.max(rect.width, pw || 0), hh = Math.max(rect.height, ph || 0);
        if (!isTextLink && Math.min(hw, hh) < 39.5) {
          out.targetSize.push({ sel: sel, text: snippet(el), w: Math.round(hw), h: Math.round(hh) });
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

  /* ══ กฎตรวจมือถือ (รอบ 3) — เรียกที่ viewport แคบ (390 / 360) ═══════════════════════════════
     mobileFont     ข้อความเนื้อหา < 14px · ข้อความรอง/ป้ายเล็ก/ปุ่ม < 12px · h1 > 28px · h2 > 22px
     mobileOverflow ตัวหน้าเลื่อนแนวนอน หรือ element ที่เลยขอบจอ (ยกเว้นอยู่ใน container ที่ overflow-x เป็น auto/scroll/hidden เอง)
     mobileClip     ข้อความถูกตัด (scrollWidth > clientWidth ใน container ที่ overflow ไม่ visible) โดยไม่มี ellipsis และไม่มี title/aria-label
                    + ตัวเลขที่ถูกตัดกลางตัวข้ามบรรทัด (Range.getClientRects ของก้อนตัวเลขมากกว่า 1 บรรทัด เช่น "118/7 | 6")
     mobileCrowd    เป้ากด 2 อันที่ขอบห่างกัน < 8px (ยกเว้นลิงก์ในบรรทัด, ตัวควบคุมที่ติดกันโดยออกแบบ (.segmented/.lang-toggle), แถวกว้าง ≥ 60% ของจอและสูง ≥ 44px เรียงซ้อนกัน)
     mobileRowBreak ปุ่มท้ายแถว (.list-row/.todo-row ที่มี .end) ตกลงไปอยู่ใต้เนื้อหา (ปุ่มต้องอยู่บรรทัดเดียวกันชิดขวา)
     mobileAlign    พี่น้อง (.card, .grid > *, .list-row, .tile, .kpi, .todo-row) ที่เรียงซ้อนแล้วขอบซ้าย/ขวาไม่ตรง (> 2px)
                    หรือเรียงแถวเดียวกันแล้วกว้างไม่เท่ากัน (> 2px) / แถวที่สองยื่นพ้นขอบแถวแรก
     ข้อความใน shell (nav/ลิ้นชัก/ฟุตเตอร์) ไม่นับ เว้นแต่ opts.shell = true (ใช้กับหน้าแรกหน้าเดียว) */
  var BODY_MIN = 14, SMALL_MIN = 12, H1_MAX = 28, H2_MAX = 22, GAP_MIN = 8, ALIGN_TOL = 2;
  var SECONDARY = 'small,sub,sup,.meta,.sub,.badge,.muted,figcaption,caption,th,time,.sz,.hint,.pill,.tag,.alloc-legend,.cat-row,.kv .k,.strip-cell .k,.strip-cell .s,.meter-row .val,.dotcol small,.tile-desc,.todo-sub,.ome-footer *';
  var CONTROLS = 'button,.btn,input,select,textarea,summary,[role=tab],[role=button],.tab,.chip,.segmented *,.lang-toggle *,.tabs *';
  var SCROLL_OV = /auto|scroll|hidden|clip/;

  function skipShell(el, opts) { return !(opts && opts.shell) && !!el.closest(SHELL); }
  /* mobileCrowd นับปุ่มแชท AI ลอยด้วย (รอบ 9 เอาข้อยกเว้นเดิมออก): ปุ่มอื่นต้องห่างจากมัน ≥ 8px ตอนอยู่ในจอแรก */
  var SHELL_NO_FAB = '.ome-nav,.ome-drawer,.ome-settings-panel,.ome-footer,.ome-pal,.ome-qa,.ome-ai-panel';
  function skipShellCrowd(el, opts) { return !(opts && opts.shell) && !!el.closest(SHELL_NO_FAB); }
  function textElements(opts) {
    var out = [], seen = new Set();
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (var t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!/\S/.test(t.nodeValue)) continue;
      var el = t.parentElement;
      if (!el || seen.has(el) || el.closest('script,style,noscript,svg,canvas,option,[data-audit-skip],[data-doc-area]')) continue;
      seen.add(el);
      if (!visible(el) || skipShell(el, opts)) continue;
      out.push(el);
    }
    return out;
  }
  function mobileFont(opts) {
    var bad = [];
    textElements(opts).forEach(function (el) {
      var px = parseFloat(getComputedStyle(el).fontSize), tag = el.tagName;
      var kind = tag === 'H1' ? 'h1' : tag === 'H2' ? 'h2' : (el.matches(CONTROLS) || el.closest(CONTROLS.split(',').slice(0, 5).join(','))) ? 'small' : el.matches(SECONDARY) || el.closest(SECONDARY) ? 'small' : 'body';
      var fail = (kind === 'h1' && px > H1_MAX) || (kind === 'h2' && px > H2_MAX) || (kind === 'body' && px < BODY_MIN) || ((kind === 'small') && px < SMALL_MIN);
      if (!fail && (kind === 'h1' || kind === 'h2') && px < BODY_MIN) fail = true;
      if (fail) bad.push({ sel: selector(el), text: snippet(el), kind: kind, px: +px.toFixed(1) });
    });
    return bad;
  }
  function insideScroller(el) {
    for (var n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (SCROLL_OV.test(cs.overflowX)) return true;
    }
    return false;
  }
  function mobileOverflow(opts) {
    var bad = [], vw = window.innerWidth, reported = new Set();
    if (document.documentElement.scrollWidth > vw + 1) bad.push({ sel: 'html', text: 'หน้าเลื่อนแนวนอน scrollWidth ' + document.documentElement.scrollWidth + ' > ' + vw });
    var all = document.body.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest('script,style,svg,option,[data-audit-skip]') || skipShell(el, opts) || !visible(el)) continue;
      var cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.display === 'contents') continue;
      var r = el.getBoundingClientRect();
      if (!(r.right > vw + 1 || r.left < -1)) continue;
      if (insideScroller(el)) continue;
      if (el.parentElement && reported.has(el.parentElement)) continue;
      reported.add(el);
      bad.push({ sel: selector(el), text: snippet(el), w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right) });
      if (bad.length >= 60) break;
    }
    return bad;
  }
  function mobileClip(opts) {
    var bad = [];
    textElements(opts).forEach(function (el) {
      if (el.matches('input,select,textarea')) return;
      var cs = getComputedStyle(el);
      if (cs.display === 'inline') return;
      var clipX = SCROLL_OV.test(cs.overflowX) && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && el.scrollWidth > el.clientWidth + 1;
      var lc = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
      var clipY = !lc && /hidden|clip/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0;
      if (!clipX && !clipY) return;
      var ellipsis = cs.textOverflow === 'ellipsis' || lc;
      var titled = !!(el.getAttribute('title') || el.getAttribute('aria-label') || el.closest('[title],[aria-label]'));
      if (ellipsis || titled) return;
      bad.push({ sel: selector(el), text: snippet(el), w: el.clientWidth, sw: el.scrollWidth, h: el.clientHeight, sh: el.scrollHeight });
    });
    return bad.concat(numberBreaks(opts));
  }
  /* ตัวเลขที่ถูกตัดกลางตัวข้ามบรรทัด (เช่น "118/7 | 6", "฿24,9 | 40") — ดูจาก Range.getClientRects ของแต่ละก้อนตัวเลขในข้อความ: มากกว่า 1 บรรทัด = ผิด
     แก้ด้วย white-space:nowrap ที่ก้อนตัวเลข (.n) ให้หน่วยขึ้นบรรทัดใหม่ทั้งก้อน · นับรวมใน mobileClip */
  var NUM_TOKEN = /[฿$€£]?\d[\d.,:\/%]*\d%?|[฿$€£]?\d/g;
  function numberBreaks(opts) {
    var bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n = 0;
    for (var t = walker.nextNode(); t && n < 600; t = walker.nextNode()) {
      var txt = t.nodeValue;
      if (!/\d/.test(txt)) continue;
      var el = t.parentElement;
      if (!el || el.closest('script,style,noscript,svg,canvas,option,textarea,[data-audit-skip]') || !visible(el) || skipShell(el, opts)) continue;
      NUM_TOKEN.lastIndex = 0;
      var m;
      while ((m = NUM_TOKEN.exec(txt)) && n < 600) {
        n++;
        var r = document.createRange();
        r.setStart(t, m.index); r.setEnd(t, m.index + m[0].length);
        var rects = [].filter.call(r.getClientRects(), function (q) { return q.width > 0.5 && q.height > 0.5; }), tops = [];
        rects.forEach(function (q) { if (!tops.some(function (y) { return Math.abs(y - q.top) < q.height * 0.5; })) tops.push(q.top); });
        if (tops.length > 1) { bad.push({ sel: selector(el), text: snippet(el), kind: 'numberBreak', token: m[0], lines: tops.length }); break; }
      }
    }
    return bad;
  }
  var TAP = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=switch],[role=checkbox]';
  function rectGap(a, b) {
    var dx = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
    var dy = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
    return Math.hypot(dx, dy);
  }
  /* ถูกขอบของกล่องเลื่อนในกล่องโต้ตอบ (dialog / .dialog-body) ตัดอยู่ทั้งหมดหรือบางส่วน — ตำแหน่งขึ้นกับว่าเลื่อนไปที่ไหน ไม่นับว่า "ชิดกัน"
     กับปุ่มหัว/ท้ายกล่องที่อยู่นอกพื้นที่เลื่อน (ตัวที่เลื่อนมาเห็นครบแล้วยังวัดตามปกติ) */
  function cutOffInDialog(el, r) {
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (!p.matches('dialog,.dialog-body')) continue;
      var cs = getComputedStyle(p);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      var pr = p.getBoundingClientRect();
      if (r.top < pr.top - 1 || r.bottom > pr.bottom + 1 || r.left < pr.left - 1 || r.right > pr.right + 1) return true;
    }
    return false;
  }
  function inPinned(el) {
    for (var p = el; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      var pos = getComputedStyle(p).position;
      if (pos === 'fixed' || pos === 'sticky') return true;
    }
    return false;
  }
  function mobileCrowd(opts) {
    var bad = [], vw = window.innerWidth, items = [];
    document.querySelectorAll(TAP).forEach(function (el) {
      if (items.length >= 500 || !visible(el) || skipShellCrowd(el, opts)) return; // รวมปุ่ม AI ลอย (.ome-ai-fab); การทับเนื้อหาท้ายหน้าตรวจที่ mobileFabOverlap
      if (el.tagName === 'A' && !el.matches('.btn,.tile,.list-row,.tab,.chip,[role=button]') && getComputedStyle(el).display === 'inline') return; // ลิงก์ในบรรทัด
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || cutOffInDialog(el, r)) return;
      // ถูกบังโดยของอื่น (ส่วนท้ายกล่องที่ค้างทับเนื้อหาที่เลื่อนอยู่ข้างใต้, กล่อง modal ที่เปิดอยู่) = ผู้ใช้กดไม่ได้อยู่แล้ว ไม่นับ
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx >= 0 && cy >= 0 && cx < window.innerWidth && cy < window.innerHeight && !el.closest('.ome-ai-fab')) {
        var stack = document.elementsFromPoint(cx, cy).filter(function (e) { return !e.closest('.ome-ai-fab'); });
        var topEl = stack[0];
        if (topEl && !(topEl === el || el.contains(topEl) || topEl.contains(el))) return;
      }
      // ส่วนท้ายกล่องที่ค้างขอบล่าง (sticky) ทับเนื้อหาที่เลื่อนอยู่ข้างใต้: นับเฉพาะส่วนที่เห็นเหนือส่วนท้าย
      var dlg = el.closest('dialog');
      var foot = dlg && !el.closest('.dialog-foot') ? dlg.querySelector('.dialog-foot') : null;
      if (foot && getComputedStyle(foot).position === 'sticky') {
        var fr = foot.getBoundingClientRect();
        if (r.bottom > fr.top && r.top < fr.top) r = { left: r.left, right: r.right, top: r.top, bottom: fr.top, width: r.width, height: fr.top - r.top };
      }
      items.push({ el: el, r: r });
    });
    function row(x) { return x.r.width >= vw * 0.6 && x.r.height >= 44; }
    var seen = new Set();
    for (var i = 0; i < items.length; i++) {
      for (var j = i + 1; j < items.length; j++) {
        var a = items[i], b = items[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (rectGap(a.r, b.r) >= GAP_MIN) continue;
        // ปุ่มแชท AI ลอย: เนื้อหาที่เลื่อนผ่านใต้ปุ่มลอยเป็นธรรมชาติของปุ่มลอย (แก้ด้วยซ่อนตอนเลื่อนลง + เว้นที่ท้ายหน้า → mobileFabOverlap)
        // ที่นี่นับเฉพาะ element ที่ติดจอถาวร (fixed/sticky) ซึ่งทับปุ่มตลอดเวลา
        var fabPair = a.el.closest('.ome-ai-fab') ? b.el : b.el.closest('.ome-ai-fab') ? a.el : null;
        if (fabPair && !inPinned(fabPair)) continue;
        if (row(a) && row(b)) continue;
        var grp = a.el.closest('.segmented,.lang-toggle');
        if (grp && grp === b.el.closest('.segmented,.lang-toggle')) continue;
        var lab = (a.el.closest('label') && a.el.closest('label') === b.el.closest('label')); // ช่องติ๊ก + ข้อความของมันเอง
        if (lab) continue;
        var k = selector(a.el) + ' ↔ ' + selector(b.el);
        if (seen.has(k)) continue;
        seen.add(k);
        bad.push({ sel: k, text: snippet(a.el) + ' | ' + snippet(b.el), gap: +rectGap(a.r, b.r).toFixed(1) });
        if (bad.length >= 60) return bad;
      }
    }
    return bad;
  }
  var ALIGN_SEL = '.card,.grid > *,.list-row,.tile,.kpi,.todo-row';
  function mobileAlign(opts) {
    var bad = [], byParent = new Map();
    document.querySelectorAll(ALIGN_SEL).forEach(function (el) {
      if (!visible(el) || skipShell(el, opts) || !el.parentElement) return;
      var list = byParent.get(el.parentElement); if (!list) byParent.set(el.parentElement, list = []);
      if (list.indexOf(el) < 0) list.push(el);
    });
    byParent.forEach(function (kids, parent) {
      if (kids.length < 2) return;
      var rects = kids.map(function (el) { return { el: el, r: el.getBoundingClientRect() }; });
      var rows = [];
      rects.slice().sort(function (a, b) { return a.r.top - b.r.top || a.r.left - b.r.left; }).forEach(function (x) {
        var last = rows[rows.length - 1];
        if (last && x.r.top < last.bottom - 1) { last.items.push(x); last.bottom = Math.max(last.bottom, x.r.bottom); }
        else rows.push({ items: [x], bottom: x.r.bottom });
      });
      var maxCols = Math.max.apply(null, rows.map(function (r) { return r.items.length; }));
      var ref = null;
      rows.forEach(function (row) {
        var its = row.items.slice().sort(function (a, b) { return a.r.left - b.r.left; });
        if (its.length > 1) {
          var w0 = its[0].r.width;
          its.forEach(function (x) { if (Math.abs(x.r.width - w0) > ALIGN_TOL) bad.push({ sel: selector(x.el), text: snippet(x.el), kind: 'width', w: Math.round(x.r.width), expect: Math.round(w0) }); });
        }
        var l = its[0].r.left, r = Math.max.apply(null, its.map(function (x) { return x.r.right; }));
        if (!ref) { ref = { l: l, r: r, full: its.length === maxCols }; return; }
        var offL = Math.abs(l - ref.l) > ALIGN_TOL, offR = its.length === maxCols && ref.full && Math.abs(r - ref.r) > ALIGN_TOL;
        if (offL || offR) bad.push({ sel: selector(its[0].el), text: snippet(its[0].el), kind: 'edge', left: Math.round(l), right: Math.round(r), expectLeft: Math.round(ref.l), expectRight: Math.round(ref.r) });
      });
    });
    return bad.slice(0, 60);
  }
  /* ปุ่มท้ายแถว (.list-row / .todo-row ที่มี .end) ตกลงไปอยู่ใต้เนื้อหา = ผิด — ปุ่มต้องอยู่บรรทัดเดียวกับเนื้อหา ชิดขวา (นับ 1 ต่อแถว) */
  function mobileRowBreak(opts) {
    var bad = [];
    document.querySelectorAll('.list-row,.todo-row').forEach(function (row) {
      if (!visible(row) || skipShell(row, opts)) return;
      var end = [].filter.call(row.children, function (c) { return c.classList.contains('end'); })[0];
      var content = [].filter.call(row.children, function (c) { return c.classList.contains('grow'); })[0];
      if (!end || !content || !end.offsetWidth || !content.offsetWidth) return;
      var e = end.getBoundingClientRect(), c = content.getBoundingClientRect();
      if (e.top >= c.bottom - 1) bad.push({ sel: selector(row), text: snippet(row), endTop: Math.round(e.top), contentBottom: Math.round(c.bottom) });
    });
    return bad.slice(0, 60);
  }
  /* ── กฎมือถือ รอบ 9 ─────────────────────────────────────────────────────────────────────────────
     mobileFabOverlap ปุ่มแชท AI ลอย (.ome-ai-fab) ทับ element ที่กดได้ เมื่อเลื่อนทุกตัวเลื่อนไปท้ายสุดแล้วบังคับให้ปุ่มโผล่ (ไม่พึ่งการซ่อนตอนเลื่อนลง)
                      → วัดว่า "เว้นที่ท้ายหน้า" ได้จริง (padding-bottom ของ body/.page ใน ai-chat-widget.js + theme.css)
     mobileInput      ช่องกรอก: font-size < 16px (iOS ซูมอัตโนมัติตอนแตะ) · type=text ที่ชื่อ/placeholder/label บอกว่าเป็นอีเมล/เบอร์โทร/จำนวนเงิน-ตัวเลข
                      · placeholder ที่ยาวเกินช่อง (ถูกตัด) — ย่อข้อความ หรือขยายช่อง/ให้ช่องขึ้นบรรทัดเต็มบนจอแคบ
                      แต่ไม่มี type/inputmode ที่เหมาะ · email/tel/password/url ที่ไม่มี autocomplete
     mobileDialog     กล่องที่เปิดอยู่ (dialog/ลิ้นชัก/palette/เมนู role=dialog): ล้นขอบจอ · เนื้อหายาวแต่ไม่มีที่เลื่อนในกล่อง · ปุ่มท้ายกล่อง (.dialog-foot) ตกขอบ/ถูกตัด
     (ปิดด้วยปุ่ม/แตะนอกกล่อง/Esc ตรวจเป็นพฤติกรรมใน theme-audit.spec.js "dialogs:" เพราะต้องกดจริง) */
  var FAB_CLEAR = 'transition:none';
  function mobileFabOverlap(opts) {
    var fab = document.querySelector('.ome-ai-fab');
    if (!fab || !fab.offsetWidth) return [];
    var scrollers = [document.scrollingElement].concat([].filter.call(document.querySelectorAll('body *'), function (el) {
      if (el.closest('.ome-ai-panel,.ome-drawer,.ome-settings-panel,.ome-pal')) return false;
      var cs = getComputedStyle(el);
      return /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 8 && el.clientHeight > 80 && visible(el);
    }));
    var saved = scrollers.map(function (el) { return el.scrollTop; });
    var wasHidden = fab.classList.contains('ome-ai-fab-hide'), oldTr = fab.style.transition;
    fab.style.transition = 'none'; fab.classList.remove('ome-ai-fab-hide');
    scrollers.forEach(function (el) { el.scrollTop = el.scrollHeight; });
    var fr = fab.getBoundingClientRect(), bad = [];
    document.querySelectorAll(TAP).forEach(function (el) {
      if (bad.length >= 60 || el.closest('.ome-ai-fab,.ome-ai-panel,.ome-nav,.ome-drawer,.ome-settings-panel') || !visible(el)) return;
      var r = el.getBoundingClientRect();
      var l = Math.max(r.left, fr.left), t = Math.max(r.top, fr.top), rr = Math.min(r.right, fr.right), b = Math.min(r.bottom, fr.bottom);
      if (rr - l <= 1 || b - t <= 1) return;
      // ลำดับซ้อนที่จุดกึ่งกลางของส่วนที่ซ้อนกัน (บน → ล่าง): ปุ่มแชทต้องอยู่เหนือ element นั้นถึงจะ "บัง" (กล่อง modal/ลิ้นชักที่ z-index สูงกว่าบังปุ่มเองแทน)
      var els = document.elementsFromPoint((l + rr) / 2, (t + b) / 2), iFab = -1, iEl = -1;
      for (var i = 0; i < els.length; i++) {
        if (iFab < 0 && els[i].closest('.ome-ai-fab')) iFab = i;
        if (iEl < 0 && (els[i] === el || el.contains(els[i]) || els[i].contains(el)) && !els[i].closest('.ome-ai-fab')) iEl = i;
      }
      if (iFab >= 0 && iEl >= 0 && iFab < iEl && cutOffInDialog(el, r) === false) bad.push({ sel: selector(el), text: snippet(el), overlap: Math.round(rr - l) + 'x' + Math.round(b - t) });
    });
    scrollers.forEach(function (el, i) { el.scrollTop = saved[i]; });
    fab.style.transition = oldTr; if (wasHidden) fab.classList.add('ome-ai-fab-hide');
    return bad;
  }
  var NUM_HINT = /amount|price|cost|qty|quantity|salary|total|baht|weight|distance|mileage|odometer|จำนวน|ราคา|เงิน|บาท|ยอด|น้ำหนัก|ระยะทาง|ไมล์|กิโล|ดอกเบี้ย|ค่า/i;
  var EMAIL_HINT = /e-?mail|อีเมล/i, TEL_HINT = /\btel\b|phone|mobile|เบอร์|โทร/i;
  function labelText(el) {
    var l = el.labels && el.labels[0] ? el.labels[0].innerText : '';
    if (!l && el.closest('label')) l = el.closest('label').innerText;
    return [el.id, el.name, el.getAttribute('placeholder'), el.getAttribute('aria-label'), l].join(' ');
  }
  function mobileInput(opts) {
    var bad = [];
    document.querySelectorAll('input,textarea,select').forEach(function (el) {
      if (bad.length >= 80 || !visible(el) || skipShell(el, opts) || el.closest('[data-doc-area],[data-audit-skip],.luckysheet,#luckysheet')) return;
      var type = (el.getAttribute('type') || 'text').toLowerCase();
      if (el.tagName === 'INPUT' && /^(checkbox|radio|range|file|color|hidden|image|button|submit|reset)$/.test(type)) return;
      var fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 15.99) bad.push({ sel: selector(el), text: snippet(el), kind: 'fontSize', px: +fs.toFixed(1) });
      if (el.tagName !== 'INPUT') return;
      var hint = labelText(el), mode = el.getAttribute('inputmode');
      if (type === 'text' && !mode) {
        if (EMAIL_HINT.test(hint)) bad.push({ sel: selector(el), text: snippet(el), kind: 'type', expect: 'type=email' });
        else if (TEL_HINT.test(hint)) bad.push({ sel: selector(el), text: snippet(el), kind: 'type', expect: 'type=tel' });
        else if (NUM_HINT.test(hint) && !/ชื่อ|name|หมายเหตุ|note|memo/i.test(hint)) bad.push({ sel: selector(el), text: snippet(el), kind: 'inputmode', expect: 'inputmode=decimal|numeric' });
      }
      if (/^(email|tel|password|url)$/.test(type) && !el.hasAttribute('autocomplete')) bad.push({ sel: selector(el), text: snippet(el), kind: 'autocomplete', type: type });
      // placeholder ถูกตัด: ช่องว่าง (placeholder แสดงอยู่) ที่ข้อความ placeholder กว้างกว่าพื้นที่ในช่อง — ช่องกรอก 16px ทำให้ placeholder ยาวล้นง่าย
      var ph = el.getAttribute('placeholder');
      if (ph && !el.value) {
        var cs = getComputedStyle(el);
        PH_CTX.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        var need = PH_CTX.measureText(ph).width, avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        if (need > avail + 0.5) bad.push({ sel: selector(el), text: ph.slice(0, 60), kind: 'placeholderClip', need: Math.round(need), avail: Math.round(avail) });
      }
    });
    return bad;
  }
  var PH_CTX = document.createElement('canvas').getContext('2d');
  function mobileDialog(opts) {
    var bad = [], vw = window.innerWidth, vh = window.innerHeight;
    document.querySelectorAll('dialog[open],[role=dialog]:not(dialog),.ome-drawer.open,.ome-pal:not([hidden]),.ome-settings-panel.open').forEach(function (d) {
      if (!visible(d)) return;
      var r = d.getBoundingClientRect(), id = selector(d);
      if (d.matches('[role=dialog]:not(dialog)') && (r.right <= 0 || r.left >= vw || r.bottom <= 0 || r.top >= vh || getComputedStyle(d).opacity === '0')) return; // ปิดอยู่ (เลื่อนออกนอกจอ/โปร่งใส) ไม่ใช่กล่องที่เปิด
      if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) bad.push({ sel: id, kind: 'offscreen', rect: [r.left, r.top, r.right, r.bottom].map(Math.round) });
      var scrollable = false, tall = false;
      [d].concat([].slice.call(d.querySelectorAll('*'))).forEach(function (el) {
        var cs = getComputedStyle(el);
        if (el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) {
          if (/auto|scroll/.test(cs.overflowY)) scrollable = true;
          else if (el === d || /hidden|clip/.test(cs.overflowY)) tall = tall || el === d;
        }
      });
      if (tall && !scrollable) bad.push({ sel: id, kind: 'noScroll', scrollHeight: d.scrollHeight, clientHeight: d.clientHeight });
      d.querySelectorAll('.dialog-foot button,.dialog-foot a,.modal-foot button').forEach(function (b) {
        if (!visible(b)) return;
        var br = b.getBoundingClientRect();
        if (br.left < -1 || br.right > vw + 1 || br.bottom > vh + 1 || br.top < -1 || br.bottom > r.bottom + 1 || br.right > r.right + 1) bad.push({ sel: selector(b), text: snippet(b), kind: 'footerButton', rect: [br.left, br.top, br.right, br.bottom].map(Math.round) });
      });
    });
    return bad;
  }
  function mobile(opts) {
    opts = opts || {};
    var out = { mobileFont: mobileFont(opts), mobileOverflow: mobileOverflow(opts), mobileClip: mobileClip(opts), mobileCrowd: mobileCrowd(opts), mobileAlign: mobileAlign(opts), mobileRowBreak: mobileRowBreak(opts) };
    if (!opts.only || opts.only === 'round9') {
      out.mobileInput = mobileInput(opts);
      out.mobileDialog = mobileDialog(opts);
      out.mobileFabOverlap = mobileFabOverlap(opts); // ท้ายสุด: เลื่อนตัวเลื่อนทั้งหมดไปท้ายแล้วคืนค่า
    }
    return out;
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
    crawlCandidates: crawlCandidates, closeOverlays: closeOverlays, mobile: mobile, mobileDialog: mobileDialog, mobileOverflow: mobileOverflow };
})();
