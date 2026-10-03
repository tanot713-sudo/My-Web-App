/* ══════════════════════════════════════════════════════════════════
   Tanot — ทำอาหาร stage 2 (ส่วนในหน้า cooking.html): สมุดสูตร · แผนเมนูรายสัปดาห์ · รายการซื้อของ → budget
   ตรรกะทั้งหมด (รวมวัตถุดิบ/แปลงหน่วย/วันของแผน/ติ๊กข้ามเครื่อง) อยู่ใน cooking-plan-calc.js — ไฟล์นี้อ่านช่อง/วาด/เขียนคีย์เท่านั้น
   คีย์: tanot:cooking:recipes|plans|shopping (sync list) · ไม่แตะ tanot:cooking:xp|streak|badges|progress|notes
   อ่านด้วย TanotData.read / เขียนด้วย TanotData.update (อ่านสด→แก้→เขียน ไม่ถือคีย์ → ไม่เด้งแถบรีโหลด)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CP = window.CookPlan, TD = window.TanotData;
  var root = document.getElementById('planRoot');
  if (!CP || !root) return;

  var K_REC = 'tanot:cooking:recipes', K_PLAN = 'tanot:cooking:plans', K_SHOP = 'tanot:cooking:shopping';
  var REC_KEY = 'budget:records', CAT_KEY = 'budget:categories';
  // ใช้เมื่อยังไม่เคยเปิด budget.html — id ต้องตรงกับ DEFAULT_CATEGORIES ใน budget.html (เหมือน receipts.js / quick-add.js)
  var FALLBACK_CATS = [
    { id: 'cat-rice', name: 'ค่าข้าว', type: 'expense' }, { id: 'cat-fuel', name: 'เติมน้ำมัน', type: 'expense' },
    { id: 'cat-personal', name: 'ซื้อของใช้ส่วนตัว', type: 'expense' }, { id: 'cat-shopping', name: 'Shopping', type: 'expense' }
  ];

  var T = {
    th: {
      tLessons: 'บทเรียน', cat: 'หมวด', tRecipes: 'สูตร', tPlan: 'แผนสัปดาห์', tShop: 'ซื้อของ',
      recipe: 'สูตรอาหาร', paste: 'วางสูตรเป็นข้อความ', parse: 'แยกเป็นวัตถุดิบ/ขั้นตอน', name: 'ชื่อเมนู', servings: 'จำนวนที่', ingredients: 'วัตถุดิบ',
      addIng: 'เพิ่มวัตถุดิบ', steps: 'ขั้นตอน (บรรทัดละขั้น)', tags: 'แท็ก (คั่นด้วยจุลภาค)', photo: 'รูป', photoDel: 'เอารูปออก', del: 'ลบ', cancel: 'ยกเลิก', save: 'บันทึก', clear: 'ล้างช่อง',
      search: 'ค้นหาสูตร', allTags: 'ทุกแท็ก', addRecipe: 'เพิ่มสูตร', pasteRecipe: 'วางสูตร', noRecipe: 'ไม่พบสูตร', sv: 'ที่', ingN: 'วัตถุดิบ {n} อย่าง',
      ingName: 'ชื่อ', ingQty: 'จำนวน', ingUnit: 'หน่วย', rm: 'เอาออก',
      eName: 'ใส่ชื่อเมนู', eIng: 'วัตถุดิบมีได้ไม่เกิน 80 รายการ', confirmDelRecipe: 'ลบสูตรนี้?',
      pBusy: 'กำลังแยก…', pEmpty: 'วางข้อความสูตรก่อน', pDone: 'แยกแล้ว ตรวจและแก้ได้ก่อนบันทึก', pFail: 'ใช้ AI ไม่ได้ — ใส่เป็นขั้นตอนให้แล้ว กรอกวัตถุดิบเอง', pBad: 'AI ตอบอ่านไม่ได้ — กรอกเอง',
      prev: 'สัปดาห์ก่อน', next: 'สัปดาห์ถัดไป', thisWeek: 'สัปดาห์นี้', copyPrev: 'คัดลอกสัปดาห์ก่อน', fill: 'สุ่มเติมช่องว่าง', toShop: 'ไปรายการซื้อของ',
      pick: '+ เลือก', done: 'ทำแล้ว', undone: 'ยกเลิก', slotTitle: '{day} · {meal}', toastXp: 'ทำเมนูแล้ว +{xp} XP',
      noRecipes: 'ยังไม่มีสูตร เพิ่มสูตรก่อน',
      mkShop: 'สร้างรายการจากแผน', upShop: 'อัปเดตจากแผน', delShop: 'ลบรายการ', confirmDelShop: 'ลบรายการซื้อของสัปดาห์นี้?', noShop: 'ยังไม่มีรายการซื้อของของสัปดาห์นี้', emptyPlan: 'แผนสัปดาห์นี้ยังไม่มีเมนู',
      price: 'ราคา', addItem: 'เพิ่มรายการ', itemName: 'รายการ', total: 'รวมที่จ่ายจริง', bCat: 'หมวดรายจ่าย', bSave: 'บันทึกค่าซื้อของ', bDone: 'บันทึกเป็นรายจ่ายแล้ว', counts: 'ซื้อแล้ว {c}/{n}',
      days: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'], months: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], yearOff: 543
    },
    en: {
      tLessons: 'Lessons', cat: 'Category', tRecipes: 'Recipes', tPlan: 'Weekly plan', tShop: 'Shopping',
      recipe: 'Recipe', paste: 'Paste a recipe as text', parse: 'Split into ingredients / steps', name: 'Dish name', servings: 'Servings', ingredients: 'Ingredients',
      addIng: 'Add ingredient', steps: 'Steps (one per line)', tags: 'Tags (comma separated)', photo: 'Photo', photoDel: 'Remove photo', del: 'Delete', cancel: 'Cancel', save: 'Save', clear: 'Clear slot',
      search: 'Search recipes', allTags: 'All tags', addRecipe: 'Add recipe', pasteRecipe: 'Paste recipe', noRecipe: 'No recipes found', sv: 'servings', ingN: '{n} ingredients',
      ingName: 'Name', ingQty: 'Qty', ingUnit: 'Unit', rm: 'Remove',
      eName: 'Enter a dish name', eIng: 'At most 80 ingredients', confirmDelRecipe: 'Delete this recipe?',
      pBusy: 'Splitting…', pEmpty: 'Paste the recipe text first', pDone: 'Done — check and edit before saving', pFail: 'AI unavailable — text put in steps; fill ingredients yourself', pBad: 'Could not read the AI answer — fill it in yourself',
      prev: 'Previous week', next: 'Next week', thisWeek: 'This week', copyPrev: 'Copy previous week', fill: 'Fill empty slots randomly', toShop: 'Go to shopping list',
      pick: '+ Pick', done: 'Cooked', undone: 'Undo', slotTitle: '{day} · {meal}', toastXp: 'Cooked +{xp} XP',
      noRecipes: 'No recipes yet — add one first',
      mkShop: 'Create from plan', upShop: 'Update from plan', delShop: 'Delete list', confirmDelShop: 'Delete this week’s shopping list?', noShop: 'No shopping list for this week yet', emptyPlan: 'No meals planned this week',
      price: 'Price', addItem: 'Add item', itemName: 'Item', total: 'Actually paid', bCat: 'Expense category', bSave: 'Save grocery spending', bDone: 'Saved as expense', counts: 'Bought {c}/{n}',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], yearOff: 0
    }
  };
  function lang() { try { return localStorage.getItem('ome:lang') === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  function L(k, v) {
    var s = (T[lang()] && T[lang()][k] != null ? T[lang()][k] : T.th[k]);
    if (typeof s !== 'string') return s;
    if (v) Object.keys(v).forEach(function (n) { s = s.replace('{' + n + '}', v[n]); });
    return s;
  }
  function pick2(o) { return lang() === 'en' ? o.en : o.th; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function numFmt(n) { return (Number(n) || 0).toLocaleString(lang() === 'en' ? 'en-US' : 'th-TH', { maximumFractionDigits: 2 }); }
  function baht(n) { return '฿' + numFmt(n); }
  function filesAvailable() { return /\.pages\.dev$/.test(location.hostname) || !!(window.TANOT_FILES && window.TANOT_FILES.enabled); }
  function uid() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function dev() { return window.LearnCore && LearnCore.deviceId ? LearnCore.deviceId() : 'local'; }
  function dayLabel(ymd) { var p = ymd.split('-'); return (+p[2]) + ' ' + L('months')[+p[1] - 1]; }

  /* ── storage ── */
  function rd(k) {
    var v = TD && TD.read ? TD.read(k, null) : null;
    if (v == null) { try { v = JSON.parse(localStorage.getItem(k)); } catch (e) { v = null; } }
    return Array.isArray(v) ? v.filter(function (r) { return r && typeof r === 'object' && r.id; }) : [];
  }
  function upd(k, fn) {
    function wrap(cur) { return fn(Array.isArray(cur) ? cur : []); }
    if (TD && TD.update) return TD.update(k, wrap);
    var cur = null;
    try { cur = JSON.parse(localStorage.getItem(k)); } catch (e) {}
    var next = wrap(cur);
    if (next !== undefined) localStorage.setItem(k, JSON.stringify(next));
    return next;
  }
  function upsert(k, row) {
    upd(k, function (rows) {
      var i = rows.findIndex(function (x) { return x && x.id === row.id; });
      if (i === -1) rows.push(row); else rows[i] = row;
      return rows;
    });
  }
  function recipes() { return CP.effectiveRecipes(rd(K_REC), Date.now()); }
  function recipeById(id) { return recipes().filter(function (r) { return r.id === id; })[0] || null; }
  function planOf(week) { return CP.cleanPlan(rd(K_PLAN).filter(function (p) { return p.id === CP.planId(week); })[0], week); }
  function savePlan(plan) { plan.updatedAt = Date.now(); upsert(K_PLAN, plan); }
  function shopRows() { return rd(K_SHOP); }
  function shopOf(week) { return shopRows().filter(function (r) { return r.id === CP.shopId(week) && !CP.isTickRow(r); })[0] || null; }
  function ticksOf(listId) { return shopRows().filter(function (r) { return CP.isTickRow(r) && r.listId === listId; }); }
  function budgetCats() {
    var c = TD && TD.read ? TD.read(CAT_KEY, null) : null;
    var list = Array.isArray(c) ? c.filter(function (x) { return x && x.type === 'expense'; }) : [];
    return list.length ? list : FALLBACK_CATS;
  }

  /* ── สถานะหน้า ── */
  var S = { mode: '', week: CP.weekStart(Date.now()), q: '', tag: '', bcat: '' };
  var MODES = ['', 'recipes', 'plan', 'shop'];

  function modeFromHash() { var h = (location.hash || '').replace(/^#/, ''); return MODES.indexOf(h) >= 0 ? h : ''; }
  function showTabs() {
    var tabs = [['', 'tLessons'], ['recipes', 'tRecipes'], ['plan', 'tPlan'], ['shop', 'tShop']];
    $('planTabs').innerHTML = '<div class="tabs" role="tablist">' + tabs.map(function (t) {
      return '<button class="tab" role="tab" type="button" data-mode="' + t[0] + '" aria-selected="' + (S.mode === t[0]) + '">' + esc(L(t[1])) + '</button>';
    }).join('') + '</div>';
  }
  function setMode(m) {
    S.mode = m;
    if (modeFromHash() !== m) history.replaceState(null, '', m ? '#' + m : location.pathname + location.search);
    render();
  }
  function applyLabels() { document.querySelectorAll('#rDlg [data-t],#sDlg [data-t]').forEach(function (el) { el.textContent = L(el.getAttribute('data-t')); }); }

  function render() {
    showTabs();
    applyLabels();
    $('lessonsView').hidden = S.mode !== '';
    root.hidden = S.mode === '';
    if (S.mode === 'recipes') renderRecipes();
    else if (S.mode === 'plan') renderPlan();
    else if (S.mode === 'shop') renderShop();
    else root.innerHTML = '';
  }
  var pending = false;
  function renderSoon() { // อีกเครื่อง/แท็บส่งข้อมูลมา — ไม่วาดทับช่องที่กำลังพิมพ์
    var a = document.activeElement;
    if (a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { pending = true; return; }
    render();
  }
  root.addEventListener('focusout', function () { if (pending) setTimeout(function () { pending = false; render(); }, 0); });

  /* ── สูตร ── */
  function renderRecipes() {
    var all = recipes(), tags = CP.allTags(all);
    root.innerHTML =
      '<div class="cp-bar"><div class="grow"><input type="search" id="cpQ" placeholder="' + esc(L('search')) + '" value="' + esc(S.q) + '" aria-label="' + esc(L('search')) + '"></div>' +
      '<select id="cpTag" aria-label="' + esc(L('tags')) + '"><option value="">' + esc(L('allTags')) + '</option>' + tags.map(function (t) { return '<option' + (t === S.tag ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
      '<button class="btn primary sm" type="button" data-act="add">' + esc(L('addRecipe')) + '</button>' +
      '<button class="btn sm" type="button" data-act="addPaste">' + esc(L('pasteRecipe')) + '</button></div>' +
      '<div id="cpList"></div>';
    renderRecipeList();
  }
  function renderRecipeList() {
    var list = recipes().filter(function (r) { return CP.recipeMatches(r, S.q, S.tag); }).sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    $('cpList').innerHTML = list.length ? '<div class="list">' + list.map(function (r) {
      return '<button class="list-row cp-recipe" type="button" data-act="edit" data-id="' + esc(r.id) + '">' +
        (r.photo ? '<img class="cp-thumb" alt="" loading="lazy" src="/api/files?id=' + encodeURIComponent(r.photo.id) + '">' : '') +
        '<span class="cp-main"><span class="cp-name">' + esc(r.name) + '</span><span class="cp-meta"><span>' + r.servings + ' ' + esc(L('sv')) + '</span><span>' + esc(L('ingN', { n: r.ingredients.length })) + '</span>' +
        (r.tags || []).map(function (t) { return '<span class="badge">' + esc(t) + '</span>'; }).join('') + '</span></span></button>';
    }).join('') + '</div>' : '<div class="empty">' + esc(L('noRecipe')) + '</div>';
  }

  var R = null; // สถานะกล่องสูตร { id, base, photo, newBlob, removePhoto }
  function ingRow(i) {
    i = i || { name: '', qty: '', unit: '', cat: 'other' };
    return '<div class="cp-ing">' +
      '<input data-f="name" type="text" maxlength="120" placeholder="' + esc(L('ingName')) + '" aria-label="' + esc(L('ingName')) + '" value="' + esc(i.name) + '">' +
      '<input data-f="qty" type="text" inputmode="decimal" placeholder="' + esc(L('ingQty')) + '" aria-label="' + esc(L('ingQty')) + '" value="' + esc(i.qty == null ? '' : i.qty) + '">' +
      '<input data-f="unit" type="text" maxlength="40" placeholder="' + esc(L('ingUnit')) + '" aria-label="' + esc(L('ingUnit')) + '" value="' + esc(i.unit) + '">' +
      '<select data-f="cat" class="cp-ing-cat" aria-label="cat">' + CP.CATS.map(function (c) { return '<option value="' + c.key + '"' + (c.key === i.cat ? ' selected' : '') + '>' + esc(pick2(c)) + '</option>'; }).join('') + '</select>' +
      '<button class="btn sm ghost" type="button" data-rm aria-label="' + esc(L('rm')) + '">✕</button></div>';
  }
  function setIngs(list) { $('rIngs').innerHTML = (list && list.length ? list : [null]).map(ingRow).join(''); }
  function readIngs() {
    return Array.prototype.map.call($('rIngs').querySelectorAll('.cp-ing'), function (row) {
      var o = {};
      row.querySelectorAll('[data-f]').forEach(function (el) { o[el.getAttribute('data-f')] = el.value; });
      return o;
    });
  }
  function openRecipe(id, withPaste) {
    var r = id ? recipeById(id) : null;
    R = { id: r ? r.id : uid(), base: r, photo: r && r.photo || null, newBlob: null, removePhoto: false, busy: false };
    $('rName').value = r ? r.name : ''; $('rServ').value = r ? r.servings : 2;
    setIngs(r ? r.ingredients : []);
    $('rSteps').value = r ? r.steps.join('\n') : ''; $('rTags').value = r ? r.tags.join(', ') : '';
    $('rPaste').value = ''; $('rParseMsg').textContent = ''; $('rMsg').textContent = '';
    $('rPasteBox').open = !!withPaste;
    $('rDel').hidden = !r;
    $('rPhotoRow').hidden = !filesAvailable();
    refreshPhoto();
    applyLabels();
    var d = $('rDlg');
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  function refreshPhoto() {
    var img = $('rPhotoImg'), has = !!(R && (R.newBlob || (R.photo && !R.removePhoto)));
    img.hidden = !has;
    if (has) img.src = R.newBlob ? R.newBlobUrl : '/api/files?id=' + encodeURIComponent(R.photo.id);
    $('rPhotoDel').hidden = !has;
  }
  function closeDlg(id) { var d = $(id); if (d.close) d.close(); else d.removeAttribute('open'); }

  /* ย่อรูป (ด้านยาว ≤1600px JPEG 0.8) + ส่ง R2 ns recipes — เหมือน receipts.js */
  function shrink(file) {
    function draw(src, w, h) {
      var k = Math.min(1, 1600 / Math.max(w, h)), cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(src, 0, 0, cv.width, cv.height);
      return new Promise(function (resolve, reject) { cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('convert')); }, 'image/jpeg', 0.8); });
    }
    function viaImg() {
      return new Promise(function (resolve, reject) {
        var u = URL.createObjectURL(file), img = new Image();
        img.onload = function () { URL.revokeObjectURL(u); draw(img, img.naturalWidth, img.naturalHeight).then(resolve, reject); };
        img.onerror = function () { URL.revokeObjectURL(u); reject(new Error('open')); };
        img.src = u;
      });
    }
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bmp) {
        return draw(bmp, bmp.width, bmp.height).then(function (b) { if (bmp.close) bmp.close(); return b; });
      }).catch(viaImg);
    }
    return viaImg();
  }
  function api(method, qs, opts) { return fetch('/api/files?' + qs, Object.assign({ method: method, credentials: 'same-origin' }, opts || {})); }
  function deleteRemote(id) { return id ? api('DELETE', 'id=' + encodeURIComponent(id)).catch(function () {}) : Promise.resolve(); }
  function upload(blob, name, rid) {
    return api('POST', 'ns=recipes&ref=' + encodeURIComponent(rid) + '&name=' + encodeURIComponent(name), { headers: { 'Content-Type': 'image/jpeg' }, body: blob })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || String(r.status)); return j; }); });
  }

  function saveRecipe() {
    if (!R || R.busy) return;
    var ings = readIngs();
    if (ings.filter(function (i) { return String(i.name || '').trim(); }).length > 80) { $('rMsg').textContent = L('eIng'); return; }
    var out = CP.cleanRecipe({
      name: $('rName').value, servings: $('rServ').value, ingredients: ings,
      steps: $('rSteps').value.split(/\r?\n/), tags: $('rTags').value.split(/[,，]/),
      photo: R.removePhoto ? null : R.photo, createdAt: R.base && R.base.createdAt, seed: R.base && R.base.seed
    }, R.id, Date.now());
    if (out.error) { $('rMsg').textContent = L('eName'); return; }
    var rec = out.rec, oldId = R.base && R.base.photo && R.base.photo.id;
    R.busy = true; $('rSave').disabled = true;
    var up = R.newBlob ? upload(R.newBlob, (rec.name || 'recipe') + '.jpg', R.id).then(function (j) { rec.photo = { id: j.id, name: j.name, size: j.size, mime: j.mime }; }) : Promise.resolve();
    up.then(function () {
      upsert(K_REC, rec);
      var gone = (R.newBlob || R.removePhoto) && oldId && (!rec.photo || rec.photo.id !== oldId);
      return gone ? deleteRemote(oldId) : null;
    }).then(function () { R.busy = false; $('rSave').disabled = false; R = null; closeDlg('rDlg'); render(); },
      function (e) { R.busy = false; $('rSave').disabled = false; $('rMsg').textContent = String(e && e.message || e); });
  }
  function deleteRecipe() {
    if (!R || !R.base || !window.confirm(L('confirmDelRecipe'))) return;
    var rec = R.base, pid = rec.photo && rec.photo.id;
    upd(K_REC, function (rows) {
      var left = rows.filter(function (x) { return x && x.id !== rec.id; });
      if (rec.seed || /^seed-/.test(rec.id)) left.push({ id: rec.id, deleted: true, updatedAt: Date.now() }); // หลุมกันสูตรตั้งต้นโผล่กลับ
      return left;
    });
    deleteRemote(pid);
    R = null; closeDlg('rDlg'); render();
  }

  /* วางสูตร → AI (Workers AI /api/ai/chat เท่านั้น) · ใช้ไม่ได้ → ใส่ข้อความเป็นขั้นตอนให้กรอกเอง */
  function parsePaste() {
    var text = $('rPaste').value.trim(), msg = $('rParseMsg');
    if (!text) { msg.textContent = L('pEmpty'); return; }
    function fallback(key) {
      if (!$('rSteps').value.trim()) $('rSteps').value = CP.textToSteps(text).join('\n');
      msg.textContent = L(key);
    }
    if (!(window.AiClient && AiClient.available())) { fallback('pFail'); return; }
    msg.textContent = L('pBusy'); $('rParse').disabled = true;
    AiClient.chat({ messages: CP.recipeMessages(text), model: 'main', maxTokens: 2048, temperature: 0.2 }).then(function (r) {
      var rec = CP.parseRecipe(r.text);
      if (!rec) { fallback('pBad'); return; }
      if (rec.name && !$('rName').value.trim()) $('rName').value = rec.name;
      $('rServ').value = rec.servings;
      setIngs(rec.ingredients);
      $('rSteps').value = rec.steps.join('\n');
      if (rec.tags.length) $('rTags').value = rec.tags.join(', ');
      msg.textContent = L('pDone');
    }).catch(function () { fallback('pFail'); }).then(function () { $('rParse').disabled = false; });
  }

  /* ── แผนรายสัปดาห์ ── */
  var todayYmd = function () { return CP.ymdOf(Date.now()); };
  function weekNav(extra) {
    var days = CP.weekDays(S.week), cur = CP.weekStart(Date.now());
    return '<div class="cp-bar"><div class="cp-week">' +
      '<button class="btn sm icon" type="button" data-act="wprev" aria-label="' + esc(L('prev')) + '"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-chevron-left"/></svg></button>' +
      '<span class="cp-week-label" id="cpWeekLabel">' + esc(dayLabel(days[0]) + ' – ' + dayLabel(days[6]) + ' ' + (+days[6].slice(0, 4) + L('yearOff'))) + '</span>' +
      '<button class="btn sm icon" type="button" data-act="wnext" aria-label="' + esc(L('next')) + '"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-chevron-right"/></svg></button>' +
      (S.week !== cur ? '<button class="btn sm ghost" type="button" data-act="wnow">' + esc(L('thisWeek')) + '</button>' : '') +
      '</div>' + (extra || '') + '</div>';
  }
  function renderPlan() {
    var plan = planOf(S.week), byId = {}, days = CP.weekDays(S.week), today = todayYmd();
    recipes().forEach(function (r) { byId[r.id] = r; });
    var head = '<thead><tr><th></th>' + CP.MEALS.map(function (m) { return '<th>' + esc(pick2(m)) + '</th>'; }).join('') + '</tr></thead>';
    var body = '<tbody>' + days.map(function (d, i) {
      return '<tr' + (d === today ? ' class="today"' : '') + '><th scope="row">' + esc(L('days')[i]) + '<br><span class="cp-meta">' + esc(dayLabel(d)) + '</span></th>' +
        CP.MEALS.map(function (m) {
          var k = CP.slotKey(i, m.key), s = plan.slots[k], r = s && byId[s.recipeId];
          if (!r) return '<td><button class="btn sm ghost" type="button" data-act="slot" data-slot="' + k + '" aria-label="' + esc(L('days')[i] + ' ' + pick2(m)) + '">' + esc(L('pick')) + '</button></td>';
          var done = !!plan.done[k];
          return '<td><div class="cp-cell' + (done ? ' done' : '') + '" data-slot="' + k + '"><button class="cp-pick" type="button" data-act="slot" data-slot="' + k + '">' + esc(r.name) + '</button>' +
            '<span class="cp-meta">' + s.servings + ' ' + esc(L('sv')) + '</span>' +
            '<div class="cp-cell-actions"><button class="btn sm' + (done ? '' : ' primary') + '" type="button" data-act="done" data-slot="' + k + '">' + esc(done ? L('undone') : L('done')) + '</button></div></div></td>';
        }).join('') + '</tr>';
    }).join('') + '</tbody>';
    root.innerHTML = weekNav(
      '<button class="btn sm" type="button" data-act="copyPrev"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-copy"/></svg>' + esc(L('copyPrev')) + '</button>' +
      '<button class="btn sm" type="button" data-act="fill">' + esc(L('fill')) + '</button>' +
      '<button class="btn sm primary" type="button" data-act="toShop">' + esc(L('toShop')) + '</button>') +
      '<div class="table-wrap"><table class="cp-grid">' + head + body + '</table></div>';
  }
  var SD = null; // ช่องที่กำลังเลือกสูตร
  function openSlot(k) {
    var rs = recipes().sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    if (!rs.length) return;
    var plan = planOf(S.week), cur = plan.slots[k], parts = k.split(':'), i = +parts[0];
    SD = { slot: k, rs: rs };
    var meal = CP.MEALS.filter(function (m) { return m.key === parts[1]; })[0];
    $('sDlgTitle').textContent = L('slotTitle', { day: L('days')[i] + ' ' + dayLabel(CP.weekDays(S.week)[i]), meal: pick2(meal) });
    $('sRecipe').innerHTML = rs.map(function (r) { return '<option value="' + esc(r.id) + '"' + (cur && cur.recipeId === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('');
    $('sServ').value = cur ? cur.servings : rs[0].servings;
    $('sClear').hidden = !cur;
    var d = $('sDlg');
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  function saveSlot() {
    if (!SD) return;
    var rid = $('sRecipe').value, r = recipeById(rid), plan = planOf(S.week), prev = plan.slots[SD.slot];
    if (!r) return;
    plan.slots[SD.slot] = { recipeId: rid, servings: Math.round(Number($('sServ').value)) || r.servings };
    if (prev && prev.recipeId !== rid) delete plan.done[SD.slot]; // เปลี่ยนเมนู = ยังไม่ได้ทำ (awarded เก็บไว้ ไม่ให้ XP ซ้ำ)
    savePlan(plan); SD = null; closeDlg('sDlg'); render();
  }
  function clearSlot() {
    if (!SD) return;
    var plan = planOf(S.week);
    delete plan.slots[SD.slot]; delete plan.done[SD.slot];
    savePlan(plan); SD = null; closeDlg('sDlg'); render();
  }
  function toast(msg) {
    var wrap = $('toastWrap');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'ck-toast'; el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () { el.classList.add('leaving'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320); }, 2200);
  }
  function toggleDone(k) {
    var gave = false;
    upd(K_PLAN, function (rows) {
      var id = CP.planId(S.week), i = rows.findIndex(function (x) { return x && x.id === id; });
      var plan = CP.cleanPlan(i >= 0 ? rows[i] : null, S.week);
      if (!plan.slots[k]) return undefined;
      if (plan.done[k]) delete plan.done[k];
      else {
        plan.done[k] = Date.now();
        if (!plan.awarded[k]) { plan.awarded[k] = Date.now(); gave = true; } // XP ครั้งเดียวต่อมื้อ
      }
      plan.updatedAt = Date.now();
      if (i === -1) rows.push(plan); else rows[i] = plan;
      return rows;
    });
    if (gave && window.LearnCore) { var xp = LearnCore.award('cooking', CP.XP_PER_MEAL); if (xp) toast(L('toastXp', { xp: xp })); }
    render();
  }

  /* ── รายการซื้อของ ── */
  function myTicks(listId, fn) {
    var rid = CP.tickRowId(listId, dev());
    upd(K_SHOP, function (rows) {
      var i = rows.findIndex(function (x) { return x && x.id === rid; });
      var row = i >= 0 ? rows[i] : { id: rid, kind: 'ticks', listId: listId, dev: dev(), lines: {} };
      fn(row);
      if (i === -1) rows.push(row); else rows[i] = row;
      return rows;
    });
  }
  function makeShop() {
    var plan = planOf(S.week), fresh = CP.newShopping(S.week, recipes(), plan, Date.now());
    upd(K_SHOP, function (rows) {
      var i = rows.findIndex(function (x) { return x && x.id === fresh.id && !CP.isTickRow(x); });
      if (i >= 0) { fresh.createdAt = rows[i].createdAt || fresh.createdAt; if (rows[i].budgetId) fresh.budgetId = rows[i].budgetId; rows[i] = fresh; } else rows.push(fresh);
      return rows;
    });
  }
  function deleteShop() {
    var list = shopOf(S.week);
    if (!list || !window.confirm(L('confirmDelShop'))) return;
    upd(K_SHOP, function (rows) { return rows.filter(function (x) { return x && x.id !== list.id && !(CP.isTickRow(x) && x.listId === list.id); }); });
    render();
  }
  function renderShop() {
    var list = shopOf(S.week), planHas = Object.keys(planOf(S.week).slots).length > 0;
    if (!list) {
      root.innerHTML = weekNav(planHas ? '<button class="btn sm primary" type="button" data-act="mkShop">' + esc(L('mkShop')) + '</button>' : '') +
        '<div class="empty">' + esc(planHas ? L('noShop') : L('emptyPlan')) + '</div>';
      return;
    }
    var view = CP.shoppingView(list, ticksOf(list.id)), cats = budgetCats();
    if (!S.bcat || !cats.some(function (c) { return c.id === S.bcat; })) S.bcat = CP.defaultCategory(cats);
    var saved = isSaved(list);
    var groups = view.groups.map(function (g) {
      var cat = CP.CATS.filter(function (c) { return c.key === g.cat; })[0];
      return '<div class="cp-group"><h3>' + esc(pick2(cat)) + '</h3><div class="list">' + g.lines.map(function (l) {
        return '<div class="list-row cp-line' + (l.checked ? ' checked' : '') + '" data-line="' + esc(l.id) + '">' +
          '<input type="checkbox" data-act="tick" aria-label="' + esc(l.name) + '"' + (l.checked ? ' checked' : '') + '>' +
          '<span class="cp-name">' + esc(l.name) + (l.qty != null || l.unit ? ' <span class="cp-meta" style="display:inline">' + esc((l.qty != null ? numFmt(l.qty) : '') + (l.unit ? ' ' + l.unit : '')) + '</span>' : '') + '</span>' +
          '<input class="cp-price" type="number" inputmode="decimal" min="0" step="any" data-act="price" placeholder="' + esc(L('price')) + '" aria-label="' + esc(L('price') + ' ' + l.name) + '" value="' + (l.price == null ? '' : l.price) + '">' +
          '<button class="btn sm ghost" type="button" data-act="rmLine" aria-label="' + esc(L('rm') + ' ' + l.name) + '">✕</button></div>';
      }).join('') + '</div></div>';
    }).join('');
    root.innerHTML = weekNav(
      '<button class="btn sm" type="button" data-act="mkShop">' + esc(L('upShop')) + '</button>' +
      '<button class="btn sm danger" type="button" data-act="delShop">' + esc(L('delShop')) + '</button>') +
      '<div class="cp-meta" id="cpCounts">' + esc(L('counts', { c: view.checked, n: view.count })) + '</div>' + groups +
      '<div class="cp-add"><div class="field"><label for="aName">' + esc(L('itemName')) + '</label><input id="aName" type="text" maxlength="120" autocomplete="off"></div>' +
      '<div class="field" style="flex:0 1 80px"><label for="aQty">' + esc(L('ingQty')) + '</label><input id="aQty" type="text" inputmode="decimal"></div>' +
      '<div class="field" style="flex:0 1 100px"><label for="aUnit">' + esc(L('ingUnit')) + '</label><input id="aUnit" type="text" maxlength="40"></div>' +
      '<div class="field" style="flex:0 1 130px"><label for="aCat">' + esc(L('cat')) + '</label><select id="aCat">' + CP.CATS.map(function (c) { return '<option value="' + c.key + '"' + (c.key === 'other' ? ' selected' : '') + '>' + esc(pick2(c)) + '</option>'; }).join('') + '</select></div>' +
      '<button class="btn" type="button" data-act="addItem">' + esc(L('addItem')) + '</button></div>' +
      '<div class="card cp-total"><div>' + esc(L('total')) + ' <strong id="cpTotal">' + esc(baht(view.total)) + '</strong></div>' +
      '<div class="cp-bar"><select id="cpBcat" aria-label="' + esc(L('bCat')) + '">' + cats.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === S.bcat ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select>' +
      '<button class="btn primary" type="button" id="cpBudget" data-act="budget"' + (saved || !(view.total > 0) ? ' disabled' : '') + '>' + esc(saved ? L('bDone') : L('bSave')) + '</button></div></div>';
  }
  function isSaved(list) { return !!list.budgetId || rd(REC_KEY).some(function (r) { return r.id === CP.budgetId(list.id); }); }
  function lineIdOf(el) { var row = el.closest('[data-line]'); return row ? row.getAttribute('data-line') : null; }
  function saveBudget() {
    var list = shopOf(S.week);
    if (!list) return;
    var view = CP.shoppingView(list, ticksOf(list.id));
    if (!(view.total > 0)) return;
    var rec = CP.budgetRecord(list, view, todayYmd(), S.bcat);
    upd(REC_KEY, function (rows) { // id ตายตัว: กดซ้ำ/อีกเครื่องกดไปแล้ว = ไม่เพิ่มแถวใหม่
      rows = Array.isArray(rows) ? rows : [];
      if (rows.some(function (x) { return x && x.id === rec.id; })) return undefined;
      rows.push(rec);
      return rows;
    });
    upd(K_SHOP, function (rows) {
      var i = rows.findIndex(function (x) { return x && x.id === list.id && !CP.isTickRow(x); });
      if (i === -1 || rows[i].budgetId) return undefined;
      rows[i] = Object.assign({}, rows[i], { budgetId: rec.id });
      return rows;
    });
    render();
  }

  /* ── เหตุการณ์ ── */
  document.addEventListener('click', function (e) {
    var tab = e.target.closest && e.target.closest('#planTabs [data-mode]');
    if (tab) { setMode(tab.getAttribute('data-mode')); return; }
  });
  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    var act = el.getAttribute('data-act'), slot = el.getAttribute('data-slot');
    if (act === 'add') openRecipe(null, false);
    else if (act === 'addPaste') openRecipe(null, true);
    else if (act === 'edit') openRecipe(el.getAttribute('data-id'), false);
    else if (act === 'wprev') { S.week = CP.addDays(S.week, -7); render(); }
    else if (act === 'wnext') { S.week = CP.addDays(S.week, 7); render(); }
    else if (act === 'wnow') { S.week = CP.weekStart(Date.now()); render(); }
    else if (act === 'slot') openSlot(slot);
    else if (act === 'done') toggleDone(slot);
    else if (act === 'copyPrev') {
      var r = CP.copyPrev(planOf(CP.addDays(S.week, -7)), planOf(S.week), recipes());
      if (r.added) savePlan(r.plan);
      render();
    } else if (act === 'fill') {
      var f = CP.fillRandom(planOf(S.week), recipes(), Math.random);
      if (f.added) savePlan(f.plan);
      render();
    } else if (act === 'toShop') setMode('shop');
    else if (act === 'mkShop') { makeShop(); render(); }
    else if (act === 'delShop') deleteShop();
    else if (act === 'rmLine') {
      var id = lineIdOf(el), list = shopOf(S.week);
      if (id && list) { myTicks(list.id, function (row) { CP.setField(row, id, 'x', true, Date.now()); }); render(); }
    } else if (act === 'addItem') {
      var name = $('aName').value.trim(), list2 = shopOf(S.week);
      if (!name || !list2) { $('aName').focus(); return; }
      var m = { name: name, qty: $('aQty').value.trim() === '' ? null : Number(String($('aQty').value).replace(/,/g, '')) || null, unit: $('aUnit').value.trim(), cat: $('aCat').value };
      myTicks(list2.id, function (row) { CP.setField(row, 'm:' + uid(), 'm', m, Date.now()); });
      render();
    } else if (act === 'budget') saveBudget();
  });
  root.addEventListener('change', function (e) {
    var el = e.target, act = el.getAttribute('data-act');
    if (el.id === 'cpTag') { S.tag = el.value; renderRecipeList(); return; }
    if (el.id === 'cpBcat') { S.bcat = el.value; return; }
    if (act !== 'tick' && act !== 'price') return;
    var id = lineIdOf(el), list = shopOf(S.week);
    if (!id || !list) return;
    myTicks(list.id, function (row) {
      if (act === 'tick') CP.setField(row, id, 'c', !!el.checked, Date.now());
      else CP.setField(row, id, 'p', CP.cleanPrice(el.value), Date.now());
    });
    if (act === 'tick') render(); else refreshTotals();
  });
  function refreshTotals() { // พิมพ์ราคา — อัปเดตยอดรวมโดยไม่วาดทั้งหน้า (ไม่เสียโฟกัส)
    var list = shopOf(S.week);
    if (!list) return;
    var view = CP.shoppingView(list, ticksOf(list.id)), b = $('cpBudget');
    if ($('cpTotal')) $('cpTotal').textContent = baht(view.total);
    if (b) b.disabled = isSaved(list) || !(view.total > 0);
  }
  root.addEventListener('input', function (e) {
    if (e.target.id === 'cpQ') { S.q = e.target.value; renderRecipeList(); }
  });

  // กล่องสูตร
  $('rForm').addEventListener('submit', function (e) { e.preventDefault(); saveRecipe(); });
  $('rCancel').addEventListener('click', function () { R = null; closeDlg('rDlg'); });
  $('rDlg').addEventListener('close', function () { if (R && R.newBlobUrl) URL.revokeObjectURL(R.newBlobUrl); R = null; });
  $('rDel').addEventListener('click', deleteRecipe);
  $('rAddIng').addEventListener('click', function () { $('rIngs').insertAdjacentHTML('beforeend', ingRow()); });
  $('rIngs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]');
    if (!b) return;
    var rows = $('rIngs').querySelectorAll('.cp-ing');
    if (rows.length > 1) b.closest('.cp-ing').remove(); else setIngs([]);
  });
  $('rParse').addEventListener('click', parsePaste);
  $('rPhotoBtn').addEventListener('click', function () { $('rPhotoInput').click(); });
  $('rPhotoInput').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f || !R) return;
    shrink(f).then(function (b) {
      if (!R) return;
      if (R.newBlobUrl) URL.revokeObjectURL(R.newBlobUrl);
      R.newBlob = b; R.newBlobUrl = URL.createObjectURL(b); R.removePhoto = false;
      refreshPhoto();
    }, function () { $('rMsg').textContent = '✕'; });
  });
  $('rPhotoDel').addEventListener('click', function () {
    if (!R) return;
    if (R.newBlobUrl) URL.revokeObjectURL(R.newBlobUrl);
    R.newBlob = null; R.newBlobUrl = null; R.removePhoto = true;
    refreshPhoto();
  });
  // กล่องเลือกสูตรในช่อง
  $('sForm').addEventListener('submit', function (e) { e.preventDefault(); saveSlot(); });
  $('sCancel').addEventListener('click', function () { SD = null; closeDlg('sDlg'); });
  $('sClear').addEventListener('click', clearSlot);
  $('sRecipe').addEventListener('change', function () { var r = recipeById(this.value); if (r) $('sServ').value = r.servings; });

  window.addEventListener('hashchange', function () { if (modeFromHash() !== S.mode) { S.mode = modeFromHash(); render(); } });
  var lt = $('langToggle');
  if (lt) lt.addEventListener('click', function () { setTimeout(render, 0); });
  if (TD && TD.onChange) TD.onChange(function (keys) {
    if (!keys.length || keys.some(function (k) { return k === K_REC || k === K_PLAN || k === K_SHOP || k === REC_KEY || k === CAT_KEY; })) renderSoon();
  });

  S.mode = modeFromHash();
  render();
})();
