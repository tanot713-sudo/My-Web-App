/* ══════════════════════════════════════════════════════════════════
   Tanot — งาน PowerPoint (slides.html) · ส่วนแสดงผล
   ตรรกะ (parse โครงเรื่อง, เลือกแบบสไลด์, ตำแหน่งวาง, ข้อความสั่ง AI) อยู่ใน slides-calc.js (window.SlidesCalc) — ไฟล์นี้อ่าน/เขียนข้อมูลและวาดหน้า
   ข้อมูล: tanot:slides:decks (sync list, idField id — 1 ชุด = 1 แถว เก็บโครงเรื่อง+ธีม+ref รูป ไม่เก็บไบนารี) · tanot:slides:ui (local)
   รูป: ย่อ ≤1600px → outbox ในเครื่อง (IndexedDB tanot-slides-outbox ไม่ซิงก์ตั้งใจ) → /api/files?ns=slides (เฉพาะ *.pages.dev) แล้วแก้ ref ในชุด
   ส่งออก: PptxGenJS (vendor/pptxgenjs, โหลดตอนกดส่งออก) · PDF = โหมดพิมพ์ 16:9 · นำเสนอ = เต็มจอในเว็บ
   AI: /api/ai/chat เท่านั้น (Workers AI ฟรี) — ห้ามเรียกบริการอ่านภาพ (OCR) หรือ Claude จากหน้านี้
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  window.TANOT_NO_RELOAD_BAR = true; // วาดใหม่เองเมื่อ TanotData.onChange — ห้ามรีเซ็ตช่องที่กำลังพิมพ์

  var SC = window.SlidesCalc;
  var TD = window.TanotData;
  var K = { decks: 'tanot:slides:decks', ui: 'tanot:slides:ui' };
  var PPTX_URL = 'vendor/pptxgenjs/pptxgen.bundle.js';
  var MAMMOTH_URL = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
  var MAX_FILE = 15 * 1024 * 1024;
  var MAX_IMG = 1600;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + name + '"/></svg>'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dstr(ms) { var d = new Date(ms); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + (d.getFullYear() + 543 - 2500); }
  function filesAvailable() { return /\.pages\.dev$/.test(location.hostname) || !!(window.TANOT_FILES && window.TANOT_FILES.enabled); }
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function newKey() { return 'i' + Math.random().toString(36).slice(2, 7); }
  function safeName(s) { return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim().slice(0, 60) || 'slides'; }
  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function setMsg(t, err) { var m = $('msg'); m.textContent = t || ''; m.classList.toggle('err', !!err); }
  var NEED_NET = 'ต้องต่อเน็ตเพื่อโหลดไลบรารี (โหลดไม่สำเร็จ)';

  var loading = {};
  function loadScript(url, ready) {
    if (ready()) return Promise.resolve();
    if (!loading[url]) {
      loading[url] = new Promise(function (resolve, reject) {
        var el = document.createElement('script');
        el.src = url;
        el.onload = function () { ready() ? resolve() : reject(new Error('lib')); };
        el.onerror = function () { delete loading[url]; reject(new Error('offline')); };
        document.head.appendChild(el);
      });
    }
    return loading[url];
  }

  /* สีเน้นของเว็บตอนนี้ (--ome-accent) เป็น hex */
  function readAccent() {
    var el = document.createElement('span');
    el.style.cssText = 'position:absolute;visibility:hidden;color:var(--ome-accent)';
    document.body.appendChild(el);
    var c = getComputedStyle(el).color;
    el.remove();
    var m = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(c);
    if (!m) return null;
    return [m[1], m[2], m[3]].map(function (v) { var h = (+v).toString(16); return h.length < 2 ? '0' + h : h; }).join('').toUpperCase();
  }

  /* ── ค่าที่จำไว้ต่อเครื่อง ── */
  var ui = { deckId: '', view: 'outline' };
  try { var u = JSON.parse(localStorage.getItem(K.ui)); if (u && typeof u === 'object') ui = { deckId: u.deckId || '', view: u.view || 'outline' }; } catch (e) {}
  function saveUi() { try { localStorage.setItem(K.ui, JSON.stringify(ui)); } catch (e) {} }

  /* ══════════ ข้อมูลชุดสไลด์ ══════════ */
  function read(key, dflt) {
    var v = TD && TD.read ? TD.read(key, null) : null;
    if (v == null) { try { v = JSON.parse(localStorage.getItem(key)); } catch (e) { v = null; } }
    return v == null ? dflt : v;
  }
  function loadList() {
    var v = read(K.decks, []);
    return Array.isArray(v) ? v.filter(function (r) { return r && typeof r === 'object' && r.id; }) : [];
  }
  function saveList(list) { localStorage.setItem(K.decks, JSON.stringify(list)); }
  function upsert(rec) {
    var list = loadList(), i = list.findIndex(function (x) { return x.id === rec.id; });
    if (i === -1) list.push(rec); else list[i] = rec;
    saveList(list);
  }
  function removeRec(id) { saveList(loadList().filter(function (x) { return x.id !== id; })); }

  var decks = [], cur = null, saveTimer = null, query = '';

  function readDecks() {
    decks = loadList().map(function (d) { return SC.cleanDeck(d, d.id, d.updatedAt); }).sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  }
  function pickDeck(id) {
    var d = decks.filter(function (x) { return x.id === id; })[0] || decks[0] || null;
    cur = d ? JSON.parse(JSON.stringify(d)) : null;
    ui.deckId = cur ? cur.id : ''; saveUi();
  }
  function saveNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!cur) return;
    cur.updatedAt = Date.now();
    upsert(SC.cleanDeck(cur, cur.id, cur.updatedAt));
  }
  function scheduleSave() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(function () { saveNow(); readDecks(); renderList(); }, 350); }

  var STARTER = '# ชื่อเรื่อง\nผู้นำเสนอ · วันที่\n\n# หัวข้อที่ 1\n- ประเด็นที่ 1\n- ประเด็นที่ 2\n  - รายละเอียด';
  function newDeckRec() {
    var now = Date.now(), d = SC.newDeck(newId(), now);
    d.name = 'ชุดสไลด์ ' + (decks.length + 1);
    d.outline = STARTER;
    return d;
  }

  /* ══════════ รูป: outbox ในเครื่อง + R2 ══════════ */
  var outboxP = null, localUrls = {};
  function outbox() {
    if (!outboxP) outboxP = new Promise(function (resolve, reject) {
      var req;
      try { req = indexedDB.open('tanot-slides-outbox', 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () { req.result.createObjectStore('pending', { keyPath: 'id' }); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return outboxP;
  }
  function obx(mode, fn) {
    return outbox().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('pending', mode), st = tx.objectStore('pending'), r = fn(st);
        tx.oncomplete = function () { resolve(r && r.result); };
        tx.onerror = tx.onabort = function () { reject(tx.error); };
      });
    });
  }
  function obxPut(rec) { return obx('readwrite', function (s) { return s.put(rec); }); }
  function obxGet(id) { return obx('readonly', function (s) { return s.get(id); }); }
  function obxDel(id) { return obx('readwrite', function (s) { return s.delete(id); }); }
  function obxAll() { return obx('readonly', function (s) { return s.getAll(); }).then(function (r) { return r || []; }); }

  function imgSrc(deck, key) {
    var im = deck.images[key];
    if (!im) return '';
    if (im.id) return '/api/files?id=' + encodeURIComponent(im.id);
    return localUrls[deck.id + '|' + key] || '';
  }
  /* รูปที่ยังไม่อัปโหลดของชุดนี้ → สร้าง URL จาก outbox ให้ตัวอย่างแสดงได้ */
  function loadLocalUrls(deck) {
    var need = Object.keys(deck.images).filter(function (k) { return !deck.images[k].id && !localUrls[deck.id + '|' + k]; });
    if (!need.length) return Promise.resolve(false);
    return Promise.all(need.map(function (k) {
      return obxGet(deck.id + '|' + k).then(function (rec) { if (rec && rec.blob) localUrls[deck.id + '|' + k] = URL.createObjectURL(rec.blob); }).catch(function () {});
    })).then(function () { return true; });
  }

  function loadBitmap(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(url); resolve(im); };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('อ่านรูปนี้ไม่ได้')); };
      im.src = url;
    });
  }
  /* ย่อด้านยาว ≤1600px แล้วเก็บเป็น JPEG 0.8 (พื้นขาวรองกัน PNG โปร่งใสกลายเป็นดำ) */
  function shrinkImage(file) {
    return loadBitmap(file).then(function (im) {
      var w0 = im.naturalWidth || im.width, h0 = im.naturalHeight || im.height;
      var r = Math.min(1, MAX_IMG / Math.max(w0, h0)), w = Math.max(1, Math.round(w0 * r)), h = Math.max(1, Math.round(h0 * r));
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
      return new Promise(function (resolve, reject) {
        c.toBlob(function (b) { b ? resolve({ blob: b, w: w, h: h }) : reject(new Error('ย่อรูปไม่สำเร็จ')); }, 'image/jpeg', 0.8);
      });
    });
  }

  function api(method, qs, opts) { return fetch('/api/files?' + qs, Object.assign({ method: method, credentials: 'same-origin' }, opts || {})); }
  function deleteRemote(ids) { return Promise.all(ids.map(function (id) { return api('DELETE', 'id=' + encodeURIComponent(id)).catch(function () {}); })); }

  var flushing = false;
  function flushOutbox() {
    if (flushing || !filesAvailable() || navigator.onLine === false) return Promise.resolve();
    flushing = true;
    return obxAll().then(function (recs) {
      return recs.reduce(function (chain, rec) {
        return chain.then(function () {
          var deck = loadList().filter(function (d) { return d.id === rec.deckId; })[0];
          if (!deck || !deck.images || !deck.images[rec.key] || deck.images[rec.key].id) return obxDel(rec.id);
          return api('POST', 'ns=slides&ref=' + encodeURIComponent(rec.id) + '&name=' + encodeURIComponent(rec.name), { headers: { 'Content-Type': rec.mime }, body: rec.blob })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; }); })
            .then(function (j) {
              // อ่านสด → แก้เฉพาะรูปนี้ → เขียน (ชุดอาจถูกแก้จากที่อื่นระหว่างอัปโหลด)
              var fresh = loadList(), fd = fresh.filter(function (d) { return d.id === rec.deckId; })[0];
              if (!fd || !fd.images || !fd.images[rec.key]) { deleteRemote([j.id]); return obxDel(rec.id); }
              fd.images[rec.key] = { id: j.id, name: j.name, size: j.size, mime: j.mime, w: fd.images[rec.key].w, h: fd.images[rec.key].h };
              saveList(fresh);
              if (cur && cur.id === rec.deckId && cur.images[rec.key]) cur.images[rec.key] = fd.images[rec.key];
              return obxDel(rec.id);
            }).catch(function (e) { setMsg('อัปโหลดรูปไม่สำเร็จ — จะลองใหม่เมื่อออนไลน์ (' + (e.message || '') + ')', true); });
        });
      }, Promise.resolve());
    }).catch(function () {}).then(function () { flushing = false; renderPreview(); });
  }
  window.addEventListener('online', flushOutbox);

  /* ══════════ แผงรายการชุด ══════════ */
  function renderList() {
    var rows = decks.filter(function (d) { return SC.matches(d, query); });
    $('decks').innerHTML = rows.map(function (d) {
      return '<div class="sl-deck' + (cur && cur.id === d.id ? ' on' : '') + '" data-id="' + esc(d.id) + '">' +
        '<button class="pick" type="button"><b>' + esc(SC.deckTitle(d)) + '</b><span>' + SC.slideCount(d) + ' สไลด์ · ' + dstr(d.updatedAt) + '</span></button>' +
        '<button class="btn ghost sm icon" type="button" data-act="dup" aria-label="ทำซ้ำ" title="ทำซ้ำ">' + icon('copy') + '</button>' +
        '<button class="btn ghost sm icon" type="button" data-act="del" aria-label="ลบ" title="ลบ">' + icon('trash-2') + '</button></div>';
    }).join('');
  }

  $('deckQ').addEventListener('input', function () { query = this.value; renderList(); });
  $('decks').addEventListener('click', function (e) {
    var row = e.target.closest('.sl-deck');
    if (!row) return;
    var id = row.getAttribute('data-id'), act = (e.target.closest('[data-act]') || {}).getAttribute && e.target.closest('[data-act]').getAttribute('data-act');
    if (act === 'dup') return dupDeck(id);
    if (act === 'del') return delDeck(id);
    saveNow(); readDecks(); pickDeck(id); renderAll();
    if (matchNarrow()) setView('outline');
  });
  function matchNarrow() { return window.matchMedia && window.matchMedia('(max-width:1100px)').matches; }

  function createDeck() {
    saveNow();
    var d = newDeckRec();
    upsert(SC.cleanDeck(d, d.id, d.updatedAt));
    readDecks(); pickDeck(d.id); renderAll();
    if (matchNarrow()) setView('outline');
    $('deckName').focus(); $('deckName').select();
  }
  $('newBtn').addEventListener('click', createDeck);
  $('emptyNew').addEventListener('click', createDeck);

  function dupDeck(id) {
    saveNow(); readDecks();
    var src = decks.filter(function (d) { return d.id === id; })[0];
    if (!src) return;
    var c = SC.dupDeck(src, newId(), Date.now());
    upsert(c); readDecks(); pickDeck(c.id); renderAll();
  }
  function delDeck(id) {
    saveNow(); readDecks();
    var d = decks.filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    window.tanotConfirm('ลบชุด "' + SC.deckTitle(d) + '" และรูปที่ไม่มีชุดอื่นใช้?', { danger: true, okLabel: 'ลบ' }).then(function (ok) {
      if (!ok) return;
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      var others = loadList().filter(function (x) { return x.id !== id; });
      var ids = SC.exclusiveIds(d, others);
      removeRec(id);
      Object.keys(d.images).forEach(function (k) { obxDel(id + '|' + k).catch(function () {}); });
      if (ids.length && filesAvailable()) deleteRemote(ids);
      readDecks();
      pickDeck(cur && cur.id === id ? '' : (cur ? cur.id : ''));
      renderAll();
    });
  }

  /* ══════════ ธีม ══════════ */
  function renderTheme() {
    $('themeSeg').innerHTML = SC.THEMES.map(function (t) {
      return '<button type="button" data-theme="' + t.id + '" aria-pressed="' + (!!cur && cur.theme === t.id) + '">' + esc(t.name) + '</button>';
    }).join('');
  }
  $('themeSeg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-theme]');
    if (!b || !cur) return;
    cur.theme = b.getAttribute('data-theme');
    renderTheme(); renderPreview(); scheduleSave();
  });
  if (window.OmeTheme && OmeTheme.onChange) OmeTheme.onChange(function () { renderPreview(); });

  /* ══════════ วาดสไลด์ (ตัวอย่าง / นำเสนอ / พิมพ์) จาก shape ชุดเดียวกับที่ส่งออก ══════════ */
  var CQ = 100 / (72 * SC.W); // pt → cqw
  function pct(v, total) { return (Math.round(v / total * 10000) / 100) + '%'; }
  function cqw(pt) { return (Math.round(pt * CQ * 1000) / 1000) + 'cqw'; }

  function shapeHtml(sh, deck, model) {
    var pos = 'left:' + pct(sh.x, SC.W) + ';top:' + pct(sh.y, SC.H) + ';width:' + pct(sh.w, SC.W) + ';height:' + pct(sh.h, SC.H) + ';';
    if (sh.k === 'rect') return '<div class="sl-sh" style="' + pos + 'background:#' + sh.fill + '"></div>';
    if (sh.k === 'text') {
      var jc = sh.valign === 'middle' ? 'center' : sh.valign === 'bottom' ? 'flex-end' : 'flex-start';
      return '<div class="sl-sh" style="' + pos + 'justify-content:' + jc + '">' + sh.paras.map(function (p) {
        return '<div class="sl-p' + (p.bullet ? ' b' : '') + (p.lvl ? ' l1' : '') + '" style="font-size:' + cqw(p.size) + ';color:#' + p.color + ';' + (p.bold ? 'font-weight:700;' : '') +
          'text-align:' + (p.align || sh.align) + ';' + (p.after ? 'margin-bottom:' + cqw(p.after) + ';' : '') + '">' + esc(p.t) + '</div>';
      }).join('') + '</div>';
    }
    if (sh.k === 'image') {
      var src = imgSrc(deck, sh.key);
      return '<div class="sl-img' + (src ? '' : ' ph') + '" style="' + pos + 'color:#' + model.palette.muted + '">' + (src ? '<img alt="" src="' + esc(src) + '">' : icon('image')) + '</div>';
    }
    if (sh.k === 'table') {
      return '<div class="sl-sh" style="' + pos + '"><table class="sl-tbl" style="font-size:' + cqw(sh.size) + ';color:#' + sh.text + '">' + sh.rows.map(function (r, ri) {
        var st = ri === 0 ? 'background:#' + sh.headFill + ';color:#' + sh.headText + ';font-weight:700' : (ri % 2 === 0 ? 'background:#' + sh.zebra : '');
        return '<tr>' + r.map(function (c) { return '<td style="border:1px solid #' + sh.line + ';' + st + '">' + esc(c) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table></div>';
    }
    return '';
  }
  function slideHtml(sl, deck, model, attrs) {
    return '<div class="sl-s"' + (attrs || '') + ' style="background:#' + sl.bg + '">' + sl.shapes.map(function (sh) { return shapeHtml(sh, deck, model); }).join('') + '</div>';
  }
  function currentModel() { return SC.buildModel(cur, { accent: readAccent() }); }

  var pvTimer = null;
  function renderPreviewSoon() { if (pvTimer) clearTimeout(pvTimer); pvTimer = setTimeout(renderPreview, 120); }
  function renderPreview() {
    pvTimer = null;
    var box = $('preview');
    if (!cur) { box.innerHTML = ''; return; }
    var model = currentModel(), parsed = SC.parseOutline(cur.outline);
    var layoutOpts = SC.LAYOUTS.map(function (l) { return [l.id, l.name]; });
    box.innerHTML = model.slides.map(function (sl, i) {
      var ps = parsed.slides[i], lo = SC.layoutOf(ps, i);
      var sel = '<select class="select" data-act="layout" aria-label="แบบสไลด์ ' + (i + 1) + '"><option value=""' + (lo.auto ? ' selected' : '') + '>อัตโนมัติ · ' +
        esc(SC.LAYOUTS.filter(function (l) { return l.id === lo.id; })[0].name) + '</option>' + layoutOpts.map(function (o) {
          return '<option value="' + o[0] + '"' + (!lo.auto && lo.id === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
        }).join('') + '</select>';
      return '<div class="sl-card" data-i="' + i + '"><div class="sl-card-head"><span class="badge">' + (i + 1) + '</span>' + sel +
        '<button class="btn sm icon" type="button" data-act="img" aria-label="แทรกรูป" title="แทรกรูป">' + icon('image') + '</button>' +
        (ps.image ? '<button class="btn sm icon" type="button" data-act="noimg" aria-label="เอารูปออก" title="เอารูปออก">' + icon('x') + '</button>' : '') +
        (ps.notes ? '<span class="badge info" title="มีโน้ตผู้บรรยาย">โน้ต</span>' : '') + '</div>' +
        slideHtml(sl, cur, model, ' data-act="go"') + '</div>';
    }).join('');
    markCaretSlide();
    loadLocalUrls(cur).then(function (changed) { if (changed) renderPreviewSoon(); });
  }

  /* สไลด์ที่ตัวชี้ข้อความอยู่ → ไฮไลต์การ์ด */
  function caretSlide() {
    var ta = $('outline'), line = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
    var ps = SC.parseOutline(ta.value).slides, idx = 0;
    ps.forEach(function (s, i) { if (line >= s.startLine) idx = i; });
    return idx;
  }
  function markCaretSlide() {
    var idx = caretSlide();
    Array.prototype.forEach.call($('preview').children, function (c, i) { c.classList.toggle('on', i === idx); });
  }
  ['click', 'keyup', 'focus'].forEach(function (ev) { $('outline').addEventListener(ev, markCaretSlide); });

  /* ══════════ แก้โครงเรื่อง ══════════ */
  function onOutline() {
    if (!cur) return;
    cur.outline = $('outline').value;
    renderPreviewSoon(); scheduleSave(); markCaretSlide();
  }
  $('outline').addEventListener('input', onOutline);
  function setOutline(text) {
    $('outline').value = text;
    onOutline();
    renderPreview();
  }
  $('deckName').addEventListener('input', function () { if (!cur) return; cur.name = this.value; scheduleSave(); });

  $('preview').addEventListener('click', function (e) {
    var card = e.target.closest('.sl-card');
    if (!card || !cur) return;
    var i = +card.getAttribute('data-i'), act = (e.target.closest('[data-act]') || {}).getAttribute ? e.target.closest('[data-act]').getAttribute('data-act') : '';
    if (act === 'img') { imgTarget = i; $('imgFile').click(); return; }
    if (act === 'noimg') { removeSlideImage(i); return; }
    if (act === 'layout') return;
    var s = SC.parseOutline(cur.outline).slides[i];
    if (!s) return;
    var ta = $('outline'), pos = 0, lines = cur.outline.split('\n');
    for (var l = 0; l < s.startLine; l++) pos += lines[l].length + 1;
    ta.setSelectionRange(pos, pos);
    ta.scrollTop = Math.max(0, s.startLine * 22 - 40);
    markCaretSlide();
  });
  $('preview').addEventListener('change', function (e) {
    var sel = e.target.closest('select[data-act="layout"]'), card = e.target.closest('.sl-card');
    if (!sel || !card || !cur) return;
    $('outline').value = SC.setDirective($('outline').value, +card.getAttribute('data-i'), 'layout', sel.value);
    onOutline();
  });

  /* ── รูปต่อสไลด์ ── */
  var imgTarget = -1;
  function usedElsewhere(key, idx) {
    return SC.parseOutline(cur.outline).slides.some(function (s, i) { return i !== idx && s.image === key; });
  }
  function removeSlideImage(idx) {
    var s = SC.parseOutline(cur.outline).slides[idx];
    if (!s || !s.image) return;
    var key = s.image, im = cur.images[key];
    $('outline').value = SC.setDirective($('outline').value, idx, 'image', null);
    if (im && !usedElsewhere(key, idx)) {
      var others = loadList().filter(function (d) { return d.id !== cur.id; });
      var ids = SC.exclusiveIds(cur, others, [key]);
      delete cur.images[key];
      // id เดียวกันอาจถูกกุญแจอื่นในชุดนี้อ้างอยู่ด้วย (หลังคัดลอกบรรทัด) — ไม่ลบถ้ายังมีอ้าง
      ids = ids.filter(function (id) { return !Object.keys(cur.images).some(function (k) { return cur.images[k].id === id; }); });
      obxDel(cur.id + '|' + key).catch(function () {});
      if (ids.length && filesAvailable()) deleteRemote(ids);
    }
    onOutline(); saveNow();
  }
  $('imgFile').addEventListener('change', function () {
    var f = this.files && this.files[0], idx = imgTarget;
    this.value = '';
    if (!f || !cur || idx < 0) return;
    setMsg('');
    if (f.size > MAX_FILE) { setMsg(f.name + ' ใหญ่เกิน 15 MB', true); return; }
    var deck = cur;
    shrinkImage(f).then(function (r) {
      if (cur !== deck) return;
      var ps = SC.parseOutline($('outline').value).slides[idx];
      if (ps && ps.image) removeSlideImage(idx);
      var key = newKey(), name = (f.name || 'image').replace(/\.[a-z0-9]+$/i, '') + '.jpg';
      deck.images[key] = { name: name, size: r.blob.size, mime: 'image/jpeg', w: r.w, h: r.h, pending: true };
      localUrls[deck.id + '|' + key] = URL.createObjectURL(r.blob);
      return obxPut({ id: deck.id + '|' + key, deckId: deck.id, key: key, blob: r.blob, name: name, mime: 'image/jpeg' }).then(function () {
        $('outline').value = SC.setDirective($('outline').value, idx, 'image', key);
        onOutline(); saveNow(); renderPreview();
        flushOutbox();
      });
    }).catch(function (e) { setMsg((e && e.message) || 'แทรกรูปไม่สำเร็จ', true); });
  });

  /* ══════════ นำเข้าไฟล์ / ข้อความ ══════════ */
  function readTextFile(f) {
    var n = f.name.toLowerCase();
    if (!/\.(txt|docx)$/.test(n)) return Promise.reject(new Error('รองรับเฉพาะ .txt และ .docx'));
    if (f.size > MAX_FILE) return Promise.reject(new Error(f.name + ' ใหญ่เกินไป'));
    if (!window.TanotFileReader) return Promise.reject(new Error('โหลดตัวอ่านไฟล์ไม่สำเร็จ'));
    var pre = n.endsWith('.docx') ? loadScript(MAMMOTH_URL, function () { return !!window.mammoth; }) : Promise.resolve();
    return pre.then(function () { return window.TanotFileReader.readAnyFile(f, { ocr: false }); }).catch(function (e) {
      throw new Error(e && (e.message === 'offline' || e.message === 'lib') ? NEED_NET : (e && e.message) || 'อ่านไฟล์ไม่สำเร็จ');
    });
  }
  $('importBtn').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    setMsg('กำลังอ่าน ' + f.name + '…');
    readTextFile(f).then(function (text) {
      if (!cur) createDeck();
      var add = SC.textToOutline(text), old = $('outline').value.trim();
      setOutline(old ? old + '\n\n' + add : add);
      setMsg('');
    }).catch(function (e) { setMsg(e.message, true); });
  });

  /* ══════════ AI ช่วยร่าง (ฟรี: /api/ai/chat เท่านั้น) ══════════ */
  var aiCtl = null;
  function aiAvailable() { return !!(window.AiClient && AiClient.available()); }
  function setAiBusy(b) {
    $('aiRun').disabled = b; $('aiStop').hidden = !b; $('aiFileBtn').disabled = b;
  }
  function aiSt(t, err) { var s = $('aiSt'); s.textContent = t || ''; s.classList.toggle('err', !!err); }
  function aiOutChanged() { var has = !!$('aiOut').value.trim(); $('aiApply').disabled = !has; $('aiAppend').disabled = !has; }
  $('aiOut').addEventListener('input', aiOutChanged);

  $('aiBtn').addEventListener('click', function () {
    if (!cur) createDeck();
    aiSt(''); aiOutChanged();
    $('aiDlg').showModal();
    $('aiSrc').focus();
  });
  $('aiClose').addEventListener('click', function () { if (aiCtl) aiCtl.abort(); $('aiDlg').close(); });
  $('aiStop').addEventListener('click', function () { if (aiCtl) aiCtl.abort(); });
  $('aiFileBtn').addEventListener('click', function () { $('aiFile').click(); });
  $('aiFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    aiSt('กำลังอ่าน ' + f.name + '…');
    readTextFile(f).then(function (t) { $('aiSrc').value = t; aiSt(f.name + ' · ' + t.length.toLocaleString('en-US') + ' ตัวอักษร'); })
      .catch(function (e) { aiSt(e.message, true); });
  });
  $('aiRun').addEventListener('click', function () {
    var src = $('aiSrc').value.trim();
    if (!src) { aiSt('วางข้อความก่อน', true); return; }
    aiCtl = new AbortController();
    setAiBusy(true); aiSt('กำลังร่าง…'); $('aiOut').value = ''; aiOutChanged();
    AiClient.chat({
      messages: SC.aiMessages(src), model: 'main', maxTokens: 2048, temperature: 0.4, signal: aiCtl.signal,
      onToken: function (piece, full) { $('aiOut').value = full; }
    }).then(function (r) {
      $('aiOut').value = SC.cleanOutline(r.text);
      aiSt('');
    }).catch(function (e) {
      if (e && e.code === 'abort') { $('aiOut').value = SC.cleanOutline($('aiOut').value); aiSt('หยุดแล้ว'); }
      else aiSt(AiClient.friendlyMessage(e), true);
    }).then(function () { aiCtl = null; setAiBusy(false); aiOutChanged(); });
  });
  $('aiApply').addEventListener('click', function () { setOutline($('aiOut').value.trim()); $('aiDlg').close(); });
  $('aiAppend').addEventListener('click', function () {
    var old = $('outline').value.trim();
    setOutline((old ? old + '\n\n' : '') + $('aiOut').value.trim());
    $('aiDlg').close();
  });

  /* ══════════ ส่งออก .pptx (PptxGenJS แบบ lazy) ══════════ */
  function blobToDataUrl(b) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(b);
    });
  }
  function imageData(deck, key) {
    var im = deck.images[key];
    if (!im) return Promise.resolve(null);
    var p = im.id
      ? fetch('/api/files?id=' + encodeURIComponent(im.id), { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      : obxGet(deck.id + '|' + key).then(function (rec) { if (!rec) throw new Error('missing'); return rec.blob; });
    return p.then(blobToDataUrl).then(function (u) { return u.replace(/^data:/, ''); }).catch(function () { return null; });
  }
  function natSize(im, dataUrl) {
    if (im && im.w && im.h) return Promise.resolve({ w: im.w, h: im.h });
    return new Promise(function (resolve) {
      var i = new Image();
      i.onload = function () { resolve({ w: i.naturalWidth, h: i.naturalHeight }); };
      i.onerror = function () { resolve({ w: 0, h: 0 }); };
      i.src = 'data:' + dataUrl;
    });
  }

  function addShape(pptx, slide, sh, model, imgs) {
    var font = model.font;
    if (sh.k === 'rect') {
      slide.addShape(pptx.ShapeType.rect, { x: sh.x, y: sh.y, w: sh.w, h: sh.h, fill: { color: sh.fill }, line: { type: 'none' } });
    } else if (sh.k === 'text') {
      var runs = sh.paras.map(function (p) {
        return { text: p.t, options: { fontSize: p.size, bold: !!p.bold, color: p.color, align: p.align || sh.align, breakLine: true,
          bullet: p.bullet ? { indent: 20 } : false, indentLevel: p.lvl || 0, paraSpaceAfter: p.after || 0, lang: 'th-TH' } };
      });
      slide.addText(runs, { x: sh.x, y: sh.y, w: sh.w, h: sh.h, fontFace: font, margin: 0, valign: sh.valign, lang: 'th-TH', fit: 'none' });
    } else if (sh.k === 'image') {
      var d = imgs[sh.key];
      if (!d) return;
      var fr = SC.fitRect(sh.w, sh.h, d.w, d.h);
      slide.addImage({ data: d.data, x: sh.x + fr.x, y: sh.y + fr.y, w: fr.w, h: fr.h });
    } else if (sh.k === 'table') {
      var rows = sh.rows.map(function (r, ri) {
        return r.map(function (c) {
          var o = { color: ri === 0 ? sh.headText : sh.text, bold: ri === 0, lang: 'th-TH' };
          if (ri === 0) o.fill = { color: sh.headFill }; else if (ri % 2 === 0) o.fill = { color: sh.zebra };
          return { text: c, options: o };
        });
      });
      slide.addTable(rows, { x: sh.x, y: sh.y, w: sh.w, colW: sh.colW, fontFace: font, fontSize: sh.size, valign: 'middle',
        border: { type: 'solid', pt: 0.75, color: sh.line }, margin: [4, 8, 4, 8] });
    }
  }

  function exportPptx() {
    if (!cur) return;
    saveNow();
    var btn = $('pptxBtn'); btn.disabled = true; setMsg('กำลังสร้างไฟล์…');
    var deck = JSON.parse(JSON.stringify(cur)), model = SC.buildModel(deck, { accent: readAccent() });
    var keys = [];
    model.slides.forEach(function (s) { s.shapes.forEach(function (sh) { if (sh.k === 'image' && keys.indexOf(sh.key) < 0) keys.push(sh.key); }); });
    var imgs = {};
    loadScript(PPTX_URL, function () { return !!window.PptxGenJS; }).then(function () {
      return Promise.all(keys.map(function (k) {
        return imageData(deck, k).then(function (data) {
          if (!data) return;
          return natSize(deck.images[k], data).then(function (sz) { imgs[k] = { data: data, w: sz.w, h: sz.h }; });
        });
      }));
    }).then(function () {
      var pptx = new window.PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.title = SC.deckTitle(deck);
      pptx.theme = { headFontFace: model.font, bodyFontFace: model.font };
      model.slides.forEach(function (sl) {
        var s = pptx.addSlide();
        s.background = { color: sl.bg };
        sl.shapes.forEach(function (sh) { addShape(pptx, s, sh, model, imgs); });
        if (sl.notes) s.addNotes(sl.notes);
      });
      return pptx.write({ outputType: 'blob', compression: true });
    }).then(function (blob) {
      download(blob, safeName(SC.deckTitle(deck)) + '.pptx');
      var missing = keys.filter(function (k) { return !imgs[k]; }).length;
      setMsg(missing ? 'ส่งออกแล้ว แต่ใส่รูปไม่ได้ ' + missing + ' รูป' : '', !!missing);
    }).catch(function (e) {
      setMsg(e && (e.message === 'offline' || e.message === 'lib') ? NEED_NET : 'ส่งออกไม่สำเร็จ: ' + ((e && e.message) || ''), true);
    }).then(function () { btn.disabled = false; });
  }
  $('pptxBtn').addEventListener('click', exportPptx);

  /* ══════════ ส่งออก PDF (โหมดพิมพ์ 16:9) ══════════ */
  function waitImages(root) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll('img')).filter(function (i) { return !i.complete; });
    if (!imgs.length) return Promise.resolve();
    return Promise.race([
      Promise.all(imgs.map(function (i) { return new Promise(function (r) { i.onload = i.onerror = r; }); })),
      new Promise(function (r) { setTimeout(r, 4000); })
    ]);
  }
  function exportPdf() {
    if (!cur) return;
    saveNow();
    var model = currentModel(), pa = $('printArea');
    pa.innerHTML = model.slides.map(function (sl) { return slideHtml(sl, cur, model); }).join('');
    loadLocalUrls(cur).then(function () {
      pa.innerHTML = model.slides.map(function (sl) { return slideHtml(sl, cur, model); }).join('');
      return waitImages(pa);
    }).then(function () { window.print(); });
  }
  $('pdfBtn').addEventListener('click', exportPdf);
  window.addEventListener('afterprint', function () { $('printArea').innerHTML = ''; });

  /* ══════════ โหมดนำเสนอ ══════════ */
  var stage = { i: 0, model: null, fs: false };
  function drawStage() {
    var sl = stage.model.slides[stage.i];
    $('stageSlide').innerHTML = slideHtml(sl, cur, stage.model);
    $('stageNum').textContent = (stage.i + 1) + ' / ' + stage.model.slides.length;
  }
  function stageGo(d) {
    var n = Math.max(0, Math.min(stage.model.slides.length - 1, stage.i + d));
    if (n !== stage.i) { stage.i = n; drawStage(); }
  }
  function openStage() {
    if (!cur) return;
    saveNow();
    stage.model = currentModel();
    if (!stage.model.slides.length) return;
    stage.i = 0;
    var el = $('stage');
    el.hidden = false; drawStage();
    loadLocalUrls(cur).then(function (c) { if (c && !el.hidden) drawStage(); });
    el.focus();
    stage.fs = false;
    try {
      var p = el.requestFullscreen && el.requestFullscreen();
      if (p && p.then) p.then(function () { stage.fs = true; }, function () {});
    } catch (e) {}
  }
  function closeStage() {
    $('stage').hidden = true;
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
    stage.fs = false;
  }
  $('presentBtn').addEventListener('click', openStage);
  $('stageClose').addEventListener('click', function (e) { e.stopPropagation(); closeStage(); });
  $('stage').addEventListener('click', function (e) {
    if (e.target.closest('.sl-stage-bar')) return;
    var r = this.getBoundingClientRect();
    stageGo(e.clientX - r.left < r.width / 3 ? -1 : 1);
  });
  document.addEventListener('keydown', function (e) {
    if ($('stage').hidden) return;
    var k = e.key;
    if (k === 'Escape') { closeStage(); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter') { stageGo(1); e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') { stageGo(-1); e.preventDefault(); }
    else if (k === 'Home') { stage.i = 0; drawStage(); e.preventDefault(); }
    else if (k === 'End') { stage.i = stage.model.slides.length - 1; drawStage(); e.preventDefault(); }
  });
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && stage.fs && !$('stage').hidden) closeStage();
  });

  /* ══════════ แท็บมุมมอง (จอแคบ) ══════════ */
  function setView(v) {
    ui.view = v; saveUi();
    $('body').setAttribute('data-view', v);
    Array.prototype.forEach.call($('viewTabs').children, function (b) {
      var on = b.getAttribute('data-view') === v;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
    });
    if (v === 'preview') renderPreview();
  }
  $('viewTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-view]'); if (b) setView(b.getAttribute('data-view')); });

  /* ══════════ วาดทั้งหน้า ══════════ */
  function setValue(el, v) { // ค่าเปลี่ยนจริงเท่านั้นถึงเขียนทับ — ตัวชี้ที่กำลังพิมพ์อยู่คงตำแหน่งเดิม
    if (el.value === v) return;
    var a = el.selectionStart, b = el.selectionEnd, focus = document.activeElement === el;
    el.value = v;
    if (focus) { try { el.setSelectionRange(Math.min(a, v.length), Math.min(b, v.length)); } catch (e) {} }
  }
  function renderAll() {
    renderList(); renderTheme();
    var has = !!cur;
    $('outline').hidden = !has; $('emptyBox').hidden = has;
    ['deckName', 'themeSeg', 'presentBtn', 'pptxBtn', 'pdfBtn', 'importBtn', 'aiBtn'].forEach(function (id) {
      var el = $(id);
      if (id === 'themeSeg') Array.prototype.forEach.call(el.children, function (b) { b.disabled = !has; });
      else if (id !== 'aiBtn') el.disabled = !has;
    });
    $('aiBtn').hidden = !aiAvailable();
    if (has) {
      setValue($('deckName'), cur.name);
      setValue($('outline'), cur.outline);
    } else { $('deckName').value = ''; $('outline').value = ''; }
    renderPreview();
  }

  /* ── ข้อมูลเปลี่ยนจากเครื่องอื่น/แท็บอื่น → วาดใหม่ (ไม่ทับสิ่งที่กำลังพิมพ์) ── */
  if (TD && TD.onChange) {
    TD.onChange(function (keys) {
      if (keys.length && keys.indexOf(K.decks) === -1) return;
      if (saveTimer) return;
      readDecks();
      // saveTimer ว่าง = ไม่มีสิ่งที่พิมพ์ค้างยังไม่บันทึก (แค่โฟกัสอยู่ไม่นับ) → รับฉบับใหม่จากเครื่องอื่นได้ปลอดภัย
      var mine = cur && decks.filter(function (d) { return d.id === cur.id; })[0];
      if (mine && mine.updatedAt === cur.updatedAt && mine.outline === cur.outline && mine.name === cur.name) { renderList(); return; }
      pickDeck(cur ? cur.id : ui.deckId); renderAll();
    });
  }
  window.addEventListener('pagehide', saveNow);

  /* ══════════ เริ่มต้น ══════════ */
  readDecks();
  pickDeck(ui.deckId);
  renderAll();
  setView(['list', 'outline', 'preview'].indexOf(ui.view) >= 0 ? ui.view : 'outline');
  flushOutbox();
})();
