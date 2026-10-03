/* ══════════════════════════════════════════════════════════════════
   Tanot — ทำอาหาร stage 2: ตรรกะล้วน (ไม่มี DOM/storage) · UMD — window.CookPlan ในหน้า, require() ได้ใน test
   cooking.html / cooking-plan.js ใช้ไฟล์นี้ร่วมกัน — ห้ามมีสูตรรวมวัตถุดิบ/แปลงหน่วย/วันของแผนในหน้าเอง

   คีย์ (sync list idField id):
     tanot:cooking:recipes  — 1 สูตร = 1 แถว
       { id, name, servings, ingredients:[{name, qty|null, unit, cat}], steps:[text], tags:[text], photo:{id,name,size,mime}|null,
         seed?:true (สูตรตั้งต้น), createdAt, updatedAt }
       cat = veg | meat | dry | sauce | other
     tanot:cooking:plans    — 1 สัปดาห์ = 1 แถว  id 'week-YYYY-MM-DD' (วันจันทร์ เวลาไทย)
       { id, week, slots:{ '<วัน 0-6>:<มื้อ b|l|d>': { recipeId, servings } }, done:{ slot: ms }, awarded:{ slot: ms }, updatedAt }
       awarded = เคยให้ XP ของมื้อนั้นแล้ว (ยกเลิก "ทำแล้ว" ก็ไม่ให้ซ้ำ)
     tanot:cooking:shopping — แถวรายการ (kind ไม่มี) + แถวติ๊ก/ราคาแยกรายเครื่อง (kind 'ticks')
       รายการ { id 'shop-<week>', week, name, lines:[{id, name, qty|null, unit, cat}], budgetId?, createdAt, updatedAt }
       แถวเครื่อง { id '<shopId>|t|<dev>', kind:'ticks', listId, dev, lines:{ <lineId>: { c:[bool,ms], p:[บาท|null,ms], m:[{name,qty,unit,cat},ms], x:[bool,ms] } } }
       แต่ละเครื่องเขียนเฉพาะแถวของตัวเอง → ติ๊ก/ราคา/รายการที่เพิ่มเองจากสองเครื่องพร้อมกันไม่ทับกัน (ซิงก์ทีละแถว) ·
       รวมเป็นสถานะเดียวด้วย mergeLines: แต่ละช่องของแต่ละบรรทัดเอาค่าที่เวลาใหม่สุด
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CookPlan = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CATS = [
    { key: 'veg', th: 'ผัก', en: 'Vegetables' },
    { key: 'meat', th: 'เนื้อสัตว์', en: 'Meat & seafood' },
    { key: 'dry', th: 'ของแห้ง', en: 'Dry goods' },
    { key: 'sauce', th: 'เครื่องปรุง', en: 'Seasonings' },
    { key: 'other', th: 'อื่นๆ', en: 'Other' }
  ];
  var MEALS = [
    { key: 'b', th: 'เช้า', en: 'Breakfast' },
    { key: 'l', th: 'กลางวัน', en: 'Lunch' },
    { key: 'd', th: 'เย็น', en: 'Dinner' }
  ];
  var XP_PER_MEAL = 10;

  function catKey(c) { for (var i = 0; i < CATS.length; i++) if (CATS[i].key === c) return c; return 'other'; }
  function str(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 200); }
  function pos(n) { n = Number(n); return isFinite(n) && n > 0 ? n : null; }
  function r6(n) { return Math.round(n * 1e6) / 1e6; }
  function r2(n) { return Math.round(n * 100) / 100; }

  /* ── หน่วย ── */
  // fam: กลุ่มที่แปลงหากันได้ · f: ตัวคูณไปหน่วยฐาน (กรัม / มล.) · ชื่ออื่นที่ไม่รู้จัก = กลุ่มของตัวเอง (ฟอง, ลูก, กำ ... รวมได้เฉพาะหน่วยเดียวกัน)
  var UNITS = {
    'กรัม': { fam: 'w', f: 1 }, 'g': { fam: 'w', f: 1 }, 'gram': { fam: 'w', f: 1 }, 'grams': { fam: 'w', f: 1 }, 'ก.': { fam: 'w', f: 1 },
    'กก.': { fam: 'w', f: 1000 }, 'กก': { fam: 'w', f: 1000 }, 'กิโลกรัม': { fam: 'w', f: 1000 }, 'กิโล': { fam: 'w', f: 1000 }, 'kg': { fam: 'w', f: 1000 }, 'kgs': { fam: 'w', f: 1000 },
    'มล.': { fam: 'v', f: 1, spoon: false }, 'มล': { fam: 'v', f: 1 }, 'มิลลิลิตร': { fam: 'v', f: 1 }, 'ml': { fam: 'v', f: 1 },
    'ลิตร': { fam: 'v', f: 1000 }, 'ล.': { fam: 'v', f: 1000 }, 'l': { fam: 'v', f: 1000 }, 'liter': { fam: 'v', f: 1000 }, 'litre': { fam: 'v', f: 1000 },
    'ช้อนชา': { fam: 'v', f: 5, spoon: 'tsp' }, 'ชช.': { fam: 'v', f: 5, spoon: 'tsp' }, 'ชช': { fam: 'v', f: 5, spoon: 'tsp' }, 'tsp': { fam: 'v', f: 5, spoon: 'tsp' },
    'ช้อนโต๊ะ': { fam: 'v', f: 15, spoon: 'tbsp' }, 'ชต.': { fam: 'v', f: 15, spoon: 'tbsp' }, 'ชต': { fam: 'v', f: 15, spoon: 'tbsp' }, 'tbsp': { fam: 'v', f: 15, spoon: 'tbsp' }
  };
  function unitInfo(unit) {
    var u = str(unit, 40).toLowerCase().replace(/\s+/g, '');
    if (Object.prototype.hasOwnProperty.call(UNITS, u)) return UNITS[u];
    return { fam: 'u:' + u, f: 1, own: true, label: str(unit, 40) };
  }
  function normName(s) { return str(s, 120).toLowerCase().replace(/\s+/g, ''); }

  // ยอดรวมเป็นหน่วยฐาน → หน่วยแสดงผล: น้ำหนัก ≥1000 = กก. · ปริมาตร: ถ้ามีแต่ช้อนทั้งหมด = ช้อนโต๊ะ (ถ้าหารลงตัว) ไม่งั้นช้อนชา, นอกนั้น มล./ลิตร
  function displayUnit(fam, base, spoonOnly) {
    if (fam === 'w') return base >= 1000 ? { qty: r2(base / 1000), unit: 'กก.' } : { qty: r2(base), unit: 'กรัม' };
    if (fam === 'v') {
      if (spoonOnly) {
        var tsp = Math.round(base / 5 * 1e4) / 1e4;
        if (Math.abs(tsp / 3 - Math.round(tsp / 3)) < 1e-6) return { qty: r2(tsp / 3), unit: 'ช้อนโต๊ะ' };
        return { qty: r2(tsp), unit: 'ช้อนชา' };
      }
      return base >= 1000 ? { qty: r2(base / 1000), unit: 'ลิตร' } : { qty: r2(base), unit: 'มล.' };
    }
    return null;
  }

  /* ── วัน (เวลาไทย UTC+7 เสมอ ไม่ขึ้นกับเขตเวลาเครื่อง) ── */
  var ICT = 7 * 3600 * 1000, DAY = 86400000;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymdOf(ms) { var d = new Date(ms + ICT); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function utcDayMs(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  function addDays(ymd, n) { return ymdOf(utcDayMs(ymd) + n * DAY); }
  function weekStart(ms) { // วันจันทร์ของสัปดาห์ที่ ms อยู่
    var d = new Date(ms + ICT), dow = (d.getUTCDay() + 6) % 7; // จันทร์ = 0
    return ymdOf(ms - dow * DAY);
  }
  function weekDays(week) { var out = []; for (var i = 0; i < 7; i++) out.push(addDays(week, i)); return out; }
  function planId(week) { return 'week-' + week; }
  function shopId(week) { return 'shop-' + week; }
  function slotKey(day, meal) { return day + ':' + meal; }
  function allSlots() { var out = []; for (var d = 0; d < 7; d++) MEALS.forEach(function (m) { out.push(slotKey(d, m.key)); }); return out; }
  function validSlot(k) { return /^[0-6]:[bld]$/.test(k); }

  /* ── สูตร ── */
  function cleanIngredient(x) {
    if (!x || typeof x !== 'object') return null;
    var name = str(x.name, 120);
    if (!name) return null;
    var qty = x.qty === '' || x.qty == null ? null : pos(typeof x.qty === 'string' ? x.qty.replace(/,/g, '') : x.qty);
    return { name: name, qty: qty, unit: str(x.unit, 40), cat: catKey(x.cat) };
  }
  function cleanRecipe(raw, id, now) {
    raw = raw || {};
    var name = str(raw.name, 120);
    if (!name) return { error: 'name' };
    var ings = (Array.isArray(raw.ingredients) ? raw.ingredients : []).map(cleanIngredient).filter(Boolean).slice(0, 80);
    var steps = (Array.isArray(raw.steps) ? raw.steps : []).map(function (s) { return str(s, 600); }).filter(Boolean).slice(0, 60);
    var tags = [];
    (Array.isArray(raw.tags) ? raw.tags : []).forEach(function (t) { t = str(t, 30); if (t && tags.indexOf(t) < 0) tags.push(t); });
    var p = raw.photo && typeof raw.photo === 'object' && raw.photo.id ? { id: String(raw.photo.id), name: str(raw.photo.name, 120), size: Number(raw.photo.size) || 0, mime: str(raw.photo.mime, 60) } : null;
    var rec = { id: String(id), name: name, servings: Math.round(pos(raw.servings) || 2), ingredients: ings, steps: steps, tags: tags.slice(0, 10), photo: p,
      createdAt: Number(raw.createdAt) || now || 0, updatedAt: now || 0 };
    if (raw.seed) rec.seed = true;
    return { rec: rec };
  }
  function recipeMatches(r, q, tag) {
    if (tag && (r.tags || []).indexOf(tag) < 0) return false;
    q = normName(q);
    if (!q) return true;
    if (normName(r.name).indexOf(q) >= 0) return true;
    return (r.ingredients || []).some(function (i) { return normName(i.name).indexOf(q) >= 0; }) || (r.tags || []).some(function (t) { return normName(t).indexOf(q) >= 0; });
  }
  function allTags(recipes) {
    var seen = {}, out = [];
    recipes.forEach(function (r) { (r.tags || []).forEach(function (t) { if (!seen[t]) { seen[t] = 1; out.push(t); } }); });
    return out.sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
  }

  /* ── แผน ── */
  function emptyPlan(week, now) { return { id: planId(week), week: week, slots: {}, done: {}, awarded: {}, updatedAt: now || 0 }; }
  function cleanPlan(p, week) {
    var out = emptyPlan(week, 0);
    if (!p || typeof p !== 'object') return out;
    ['slots', 'done', 'awarded'].forEach(function (f) {
      var src = p[f] && typeof p[f] === 'object' ? p[f] : {};
      Object.keys(src).forEach(function (k) { if (validSlot(k)) out[f][k] = src[k]; });
    });
    Object.keys(out.slots).forEach(function (k) {
      var s = out.slots[k];
      if (!s || !s.recipeId) { delete out.slots[k]; return; }
      out.slots[k] = { recipeId: String(s.recipeId), servings: Math.round(pos(s.servings) || 2) };
    });
    out.updatedAt = Number(p.updatedAt) || 0;
    return out;
  }
  // คัดลอกสัปดาห์ก่อน: เติมเฉพาะช่องที่ยังว่าง (ไม่ทับของที่ใส่ไว้แล้ว) · ไม่ก๊อป "ทำแล้ว" · ข้ามสูตรที่ไม่มีแล้ว
  function copyPrev(prev, cur, recipes) {
    var ids = {};
    (recipes || []).forEach(function (r) { ids[r.id] = 1; });
    var out = cleanPlan(cur, cur && cur.week), p = cleanPlan(prev, prev && prev.week), n = 0;
    Object.keys(p.slots).forEach(function (k) {
      if (out.slots[k] || !ids[p.slots[k].recipeId]) return;
      out.slots[k] = { recipeId: p.slots[k].recipeId, servings: p.slots[k].servings }; n++;
    });
    return { plan: out, added: n };
  }
  // สุ่มเติมช่องว่าง: ไม่ซ้ำสูตรเดียวกับช่องก่อนหน้า (ถ้ามีมากกว่า 1 สูตร) และใช้ให้ทั่วก่อนวนรอบใหม่ · rng() ∈ [0,1) ส่งเข้ามาเพื่อทดสอบได้
  function fillRandom(plan, recipes, rng, weekOnlyMeals) {
    rng = rng || Math.random;
    var out = cleanPlan(plan, plan && plan.week), pool = (recipes || []).filter(function (r) { return r && r.id; }), n = 0;
    if (!pool.length) return { plan: out, added: 0 };
    var bag = [], last = null, slots = allSlots();
    function draw(avoid) {
      if (!bag.length) bag = pool.slice();
      function ok(r) { return avoid.indexOf(r.id) < 0; }
      var cand = bag.filter(ok);
      if (!cand.length) { bag = pool.slice(); cand = bag.filter(ok); }
      if (!cand.length) cand = pool.slice(); // สูตรน้อยเกินจะเลี่ยง — ยอมซ้ำ
      var r = cand[Math.min(cand.length - 1, Math.floor(rng() * cand.length))], bi = bag.indexOf(r);
      if (bi >= 0) bag.splice(bi, 1);
      return r;
    }
    slots.forEach(function (k, i) {
      if (weekOnlyMeals && weekOnlyMeals.indexOf(k.split(':')[1]) < 0) return;
      if (out.slots[k]) { last = out.slots[k].recipeId; return; }
      var nxt = out.slots[slots[i + 1]], r = draw([last, nxt && nxt.recipeId]);
      out.slots[k] = { recipeId: r.id, servings: r.servings || 2 };
      last = r.id; n++;
    });
    return { plan: out, added: n };
  }

  /* ── รวมวัตถุดิบจากแผน → บรรทัดรายการซื้อของ ──
     คีย์รวม = ชื่อ (ตัดช่องว่าง/ไม่สนตัวพิมพ์) + กลุ่มหน่วย · หน่วยเดียวกันบวกกัน · กรัม↔กก./มล.↔ลิตร↔ช้อน แปลงก่อนบวก ·
     ต่างกลุ่ม (เช่น กรัม กับ ฟอง) แยกบรรทัด · qty ว่างไม่เพิ่มยอดแต่ยังขึ้นบรรทัด · ปรับตาม servings ของช่อง ÷ servings ของสูตร */
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function lineId(nameKey, fam) { return 'g:' + hash(nameKey + '|' + fam); }
  function aggregate(plan, recipes) {
    var byId = {};
    (recipes || []).forEach(function (r) { byId[r.id] = r; });
    var p = cleanPlan(plan, plan && plan.week), acc = {}, order = [];
    allSlots().forEach(function (k) {
      var s = p.slots[k], r = s && byId[s.recipeId];
      if (!r) return;
      var ratio = s.servings / (r.servings || s.servings || 1);
      (r.ingredients || []).forEach(function (ing) {
        var nk = normName(ing.name);
        if (!nk) return;
        var u = unitInfo(ing.unit), key = nk + '|' + u.fam, a = acc[key];
        if (!a) { a = acc[key] = { id: lineId(nk, u.fam), name: str(ing.name, 120), fam: u.fam, base: 0, hasQty: false, spoonOnly: true, ownUnit: u.own ? u.label : '', cat: ing.cat, from: [] }; order.push(key); }
        if (a.cat === 'other' && ing.cat !== 'other') a.cat = ing.cat;
        var q = pos(ing.qty);
        if (q) { a.base += q * ratio * u.f; a.hasQty = true; if (!u.spoon) a.spoonOnly = false; }
        if (a.from.indexOf(r.name) < 0) a.from.push(r.name);
      });
    });
    return order.map(function (key) {
      var a = acc[key], qty = null, unit = '';
      if (a.hasQty) {
        if (a.ownUnit !== '' || a.fam.slice(0, 2) === 'u:') { qty = r2(a.base); unit = a.ownUnit; }
        else { var d = displayUnit(a.fam, r6(a.base), a.spoonOnly); qty = d.qty; unit = d.unit; }
      } else if (a.ownUnit) unit = a.ownUnit;
      return { id: a.id, name: a.name, qty: qty, unit: unit, cat: a.cat, from: a.from };
    });
  }

  /* ── ติ๊ก/ราคา/รายการเพิ่มเอง: รวมแถวของทุกเครื่องเป็นสถานะเดียว ── */
  function tickRowId(listId, dev) { return listId + '|t|' + dev; }
  function isTickRow(r) { return !!r && r.kind === 'ticks'; }
  function setField(row, lineKey, field, val, now) {
    row.lines = row.lines || {};
    var e = row.lines[lineKey] = row.lines[lineKey] || {};
    // ถ้าเวลาเครื่องนี้ย้อนกลับ (นาฬิกาเดิน/ซิงก์) ให้เพิ่มจากค่าเดิมเสมอ — ค่าที่เขียนทีหลังต้องใหม่กว่า
    var prev = e[field] ? e[field][1] : 0;
    e[field] = [val, Math.max(now, prev + 1)];
    return row;
  }
  function mergeLines(tickRows) {
    var out = {};
    (tickRows || []).forEach(function (row) {
      if (!isTickRow(row) || !row.lines) return;
      Object.keys(row.lines).forEach(function (lk) {
        var e = row.lines[lk], o = out[lk] = out[lk] || {};
        ['c', 'p', 'm', 'x'].forEach(function (f) {
          if (Array.isArray(e[f]) && (!o[f] || e[f][1] > o[f][1] || (e[f][1] === o[f][1] && String(row.dev) > String(o[f][2])))) o[f] = [e[f][0], e[f][1], row.dev];
        });
      });
    });
    return out;
  }
  function cleanPrice(v) {
    if (v === '' || v == null) return null;
    var n = Number(String(v).replace(/,/g, ''));
    return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  }
  // มุมมองรายการซื้อของ: บรรทัดที่สร้างจากแผน + บรรทัดที่เพิ่มเอง (ที่ไม่ถูกลบ) จัดกลุ่มตามหมวด
  function shoppingView(list, tickRows) {
    var st = mergeLines(tickRows), lines = [];
    function push(base, manual) {
      var s = st[base.id] || {};
      if (s.x && s.x[0]) return;
      lines.push({ id: base.id, name: base.name, qty: base.qty == null ? null : base.qty, unit: base.unit || '', cat: catKey(base.cat), manual: !!manual,
        from: base.from || [], checked: !!(s.c && s.c[0]), price: s.p && s.p[0] != null ? cleanPrice(s.p[0]) : null });
    }
    ((list && list.lines) || []).forEach(function (l) { push(l, false); });
    Object.keys(st).forEach(function (lk) {
      var m = st[lk].m;
      if (m && m[0] && lk.slice(0, 2) === 'm:') push({ id: lk, name: str(m[0].name, 120), qty: pos(m[0].qty), unit: str(m[0].unit, 40), cat: m[0].cat }, true);
    });
    var groups = CATS.map(function (c) {
      return { cat: c.key, lines: lines.filter(function (l) { return l.cat === c.key; }).sort(function (a, b) { return a.checked === b.checked ? 0 : a.checked ? 1 : -1; }) };
    }).filter(function (g) { return g.lines.length; });
    var total = 0, priced = 0, checked = 0;
    lines.forEach(function (l) { if (l.price != null) { total += l.price; priced++; } if (l.checked) checked++; });
    return { groups: groups, lines: lines, total: Math.round(total * 100) / 100, priced: priced, checked: checked, count: lines.length };
  }
  function newShopping(week, recipes, plan, now) {
    return { id: shopId(week), week: week, name: 'ซื้อของ ' + week, lines: aggregate(plan, recipes).map(function (l) { return { id: l.id, name: l.name, qty: l.qty, unit: l.unit, cat: l.cat, from: l.from }; }), createdAt: now || 0, updatedAt: now || 0 };
  }

  /* ── budget ── */
  var FOOD_RE = /อาหาร|ของกิน|ตลาด|ซื้อของ|food|grocer|ข้าว/i;
  function defaultCategory(cats) {
    var list = (Array.isArray(cats) ? cats : []).filter(function (c) { return c && c.id && c.type === 'expense'; });
    for (var i = 0; i < list.length; i++) if (FOOD_RE.test(list[i].name || '')) return list[i].id;
    return list.length ? list[0].id : '';
  }
  function budgetId(listId) { return 'cook-' + listId; }
  function budgetRecord(list, view, date, categoryId) {
    return { id: budgetId(list.id), date: date, type: 'expense', categoryId: categoryId, amount: view.total, note: 'ซื้อของทำอาหาร ' + (list.week || '') };
  }

  /* ── วางสูตรเป็นข้อความ → ให้ AI แยก (Workers AI /api/ai/chat เท่านั้น) ── */
  function recipeMessages(text) {
    var sys = 'คุณแยกสูตรอาหารจากข้อความให้เป็น JSON เท่านั้น ห้ามอธิบายเพิ่ม ห้ามแต่งข้อมูลที่ไม่มีในข้อความ\n' +
      'รูปแบบ: {"name":"ชื่อเมนู","servings":จำนวนที่เสิร์ฟเป็นตัวเลข,"ingredients":[{"name":"ชื่อวัตถุดิบ","qty":ตัวเลขหรือnull,"unit":"หน่วย","cat":"veg|meat|dry|sauce|other"}],"steps":["ขั้นตอนที่ 1","ขั้นตอนที่ 2"],"tags":["แท็ก"]}\n' +
      'cat: veg=ผัก/สมุนไพร, meat=เนื้อสัตว์/อาหารทะเล/ไข่, dry=ของแห้ง/ข้าว/เส้น/แป้ง, sauce=เครื่องปรุง/น้ำมัน/ซอส, other=อื่นๆ · ไม่ระบุจำนวนให้ qty เป็น null · ไม่ระบุจำนวนที่ให้ servings เป็น 2';
    return [{ role: 'system', content: sys }, { role: 'user', content: String(text || '').slice(0, 6000) }];
  }
  function parseRecipe(reply) {
    var s = String(reply || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    var j;
    try { j = JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
    if (!j || typeof j !== 'object') return null;
    var out = { name: str(j.name, 120), servings: Math.round(pos(j.servings) || 2), ingredients: [], steps: [], tags: [] };
    out.ingredients = (Array.isArray(j.ingredients) ? j.ingredients : []).map(cleanIngredient).filter(Boolean);
    out.steps = (Array.isArray(j.steps) ? j.steps : []).map(function (x) { return str(x, 600).replace(/^\s*(?:ขั้นตอนที่\s*)?\d+[.)\s]+/, ''); }).filter(Boolean);
    out.tags = (Array.isArray(j.tags) ? j.tags : []).map(function (x) { return str(x, 30); }).filter(Boolean);
    return out.ingredients.length || out.steps.length ? out : null;
  }
  // ใช้ AI ไม่ได้: เอาข้อความทีละบรรทัดใส่ช่องขั้นตอนให้ผู้ใช้แก้เอง
  function textToSteps(text) { return String(text || '').split(/\r?\n/).map(function (x) { return str(x, 600); }).filter(Boolean); }

  /* ── สูตรตั้งต้น (อาหารไทยบ้านๆ 2 ที่) — id ตายตัว เปิดจากสองเครื่องแล้วได้แถวเดียวกัน ── */
  function I(name, qty, unit, cat) { return { name: name, qty: qty, unit: unit, cat: cat }; }
  var SEED = [
    { id: 'seed-kaprao', name: 'ผัดกะเพราหมูสับ', servings: 2, tags: ['จานเดียว', 'ผัด'], ingredients: [I('หมูสับ', 200, 'กรัม', 'meat'), I('ใบกะเพรา', 1, 'กำ', 'veg'), I('พริกขี้หนู', 10, 'เม็ด', 'veg'), I('กระเทียม', 5, 'กลีบ', 'veg'), I('น้ำปลา', 1, 'ช้อนโต๊ะ', 'sauce'), I('ซีอิ๊วดำ', 1, 'ช้อนชา', 'sauce'), I('น้ำตาลทราย', 1, 'ช้อนชา', 'sauce'), I('น้ำมันพืช', 2, 'ช้อนโต๊ะ', 'sauce'), I('ไข่ไก่', 2, 'ฟอง', 'meat')], steps: ['โขลกพริกกับกระเทียมให้พอแหลก', 'ตั้งกระทะ ใส่น้ำมัน ผัดพริกกระเทียมให้หอม', 'ใส่หมูสับผัดจนสุก ปรุงด้วยน้ำปลา ซีอิ๊วดำ น้ำตาล', 'ใส่ใบกะเพรา ผัดพอเหี่ยว ตักเสิร์ฟกับข้าวสวยและไข่ดาว'] },
    { id: 'seed-omelet', name: 'ไข่เจียวหมูสับ', servings: 2, tags: ['จานเดียว', 'ทอด'], ingredients: [I('ไข่ไก่', 3, 'ฟอง', 'meat'), I('หมูสับ', 50, 'กรัม', 'meat'), I('น้ำปลา', 1, 'ช้อนชา', 'sauce'), I('น้ำมันพืช', 100, 'มล.', 'sauce')], steps: ['ตอกไข่ใส่ชาม ใส่หมูสับและน้ำปลา ตีให้เข้ากัน', 'ตั้งน้ำมันให้ร้อนจัด เทไข่ลงกระทะ', 'ทอดจนฟูและเหลืองทั้งสองด้าน ตักพักให้สะเด็ดน้ำมัน'] },
    { id: 'seed-tomyum', name: 'ต้มยำกุ้ง', servings: 2, tags: ['ต้ม', 'เผ็ด'], ingredients: [I('กุ้งสด', 300, 'กรัม', 'meat'), I('เห็ดฟาง', 100, 'กรัม', 'veg'), I('ข่า', 3, 'แว่น', 'veg'), I('ตะไคร้', 2, 'ต้น', 'veg'), I('ใบมะกรูด', 4, 'ใบ', 'veg'), I('พริกขี้หนู', 8, 'เม็ด', 'veg'), I('มะนาว', 2, 'ลูก', 'veg'), I('น้ำปลา', 2, 'ช้อนโต๊ะ', 'sauce'), I('น้ำพริกเผา', 1, 'ช้อนโต๊ะ', 'sauce'), I('น้ำซุป', 600, 'มล.', 'other')], steps: ['ต้มน้ำซุปกับข่า ตะไคร้ ใบมะกรูดจนหอม', 'ใส่เห็ดและกุ้ง ต้มจนกุ้งสุก', 'ปรุงรสด้วยน้ำปลา น้ำพริกเผา พริกขี้หนูทุบ', 'ปิดไฟ บีบมะนาว ตักเสิร์ฟร้อนๆ'] },
    { id: 'seed-greencurry', name: 'แกงเขียวหวานไก่', servings: 4, tags: ['แกง', 'เผ็ด'], ingredients: [I('อกไก่', 400, 'กรัม', 'meat'), I('พริกแกงเขียวหวาน', 3, 'ช้อนโต๊ะ', 'sauce'), I('กะทิ', 400, 'มล.', 'sauce'), I('มะเขือเปราะ', 6, 'ลูก', 'veg'), I('ใบโหระพา', 1, 'กำ', 'veg'), I('พริกชี้ฟ้า', 2, 'เม็ด', 'veg'), I('น้ำปลา', 2, 'ช้อนโต๊ะ', 'sauce'), I('น้ำตาลปี๊บ', 1, 'ช้อนโต๊ะ', 'sauce')], steps: ['ผัดพริกแกงกับกะทิส่วนหนึ่งจนแตกมัน', 'ใส่ไก่ผัดจนเปลี่ยนสี เติมกะทิที่เหลือ', 'ใส่มะเขือเปราะ ต้มจนสุก ปรุงด้วยน้ำปลา น้ำตาลปี๊บ', 'ใส่พริกชี้ฟ้าและใบโหระพา ปิดไฟ'] },
    { id: 'seed-morningglory', name: 'ผัดผักบุ้งไฟแดง', servings: 2, tags: ['ผัก', 'ผัด'], ingredients: [I('ผักบุ้ง', 300, 'กรัม', 'veg'), I('กระเทียม', 4, 'กลีบ', 'veg'), I('พริกขี้หนู', 5, 'เม็ด', 'veg'), I('เต้าเจี้ยว', 1, 'ช้อนโต๊ะ', 'sauce'), I('ซอสหอยนางรม', 1, 'ช้อนโต๊ะ', 'sauce'), I('น้ำมันพืช', 2, 'ช้อนโต๊ะ', 'sauce')], steps: ['ล้างผักบุ้ง ตัดเป็นท่อน', 'โขลกกระเทียมกับพริก ผัดในน้ำมันไฟแรงให้หอม', 'ใส่ผักบุ้ง เต้าเจี้ยว ซอสหอยนางรม ผัดเร็วๆ ให้สุกกรอบ'] },
    { id: 'seed-tomjued', name: 'ต้มจืดเต้าหู้หมูสับ', servings: 2, tags: ['ต้ม', 'ไม่เผ็ด'], ingredients: [I('เต้าหู้ไข่', 1, 'หลอด', 'other'), I('หมูสับ', 150, 'กรัม', 'meat'), I('ผักกาดขาว', 150, 'กรัม', 'veg'), I('ต้นหอม', 1, 'ต้น', 'veg'), I('กระเทียม', 2, 'กลีบ', 'veg'), I('พริกไทย', 0.5, 'ช้อนชา', 'sauce'), I('ซีอิ๊วขาว', 1, 'ช้อนโต๊ะ', 'sauce'), I('น้ำซุป', 600, 'มล.', 'other')], steps: ['โขลกกระเทียมกับพริกไทย คลุกกับหมูสับ ปั้นเป็นก้อน', 'ต้มน้ำซุปให้เดือด ใส่หมูสับลงไปจนสุก', 'ใส่เต้าหู้และผักกาดขาว ปรุงด้วยซีอิ๊วขาว โรยต้นหอม'] },
    { id: 'seed-friedrice', name: 'ข้าวผัดไข่', servings: 2, tags: ['จานเดียว', 'ผัด'], ingredients: [I('ข้าวสวย', 400, 'กรัม', 'dry'), I('ไข่ไก่', 2, 'ฟอง', 'meat'), I('กระเทียม', 3, 'กลีบ', 'veg'), I('ต้นหอม', 2, 'ต้น', 'veg'), I('ซีอิ๊วขาว', 1, 'ช้อนโต๊ะ', 'sauce'), I('น้ำมันพืช', 2, 'ช้อนโต๊ะ', 'sauce'), I('แตงกวา', 1, 'ลูก', 'veg')], steps: ['ผัดกระเทียมในน้ำมันให้หอม ตอกไข่ลงไปผัดให้กระจาย', 'ใส่ข้าวสวย ผัดไฟแรงให้ข้าวร่วน', 'ปรุงด้วยซีอิ๊วขาว ใส่ต้นหอม เสิร์ฟกับแตงกวา'] },
    { id: 'seed-palo', name: 'ไข่พะโล้', servings: 4, tags: ['ต้ม', 'หวาน'], ingredients: [I('ไข่ไก่', 6, 'ฟอง', 'meat'), I('หมูสามชั้น', 300, 'กรัม', 'meat'), I('เต้าหู้ทอด', 150, 'กรัม', 'other'), I('ผงพะโล้', 1, 'ช้อนโต๊ะ', 'sauce'), I('ซีอิ๊วดำ', 2, 'ช้อนโต๊ะ', 'sauce'), I('น้ำตาลปี๊บ', 2, 'ช้อนโต๊ะ', 'sauce'), I('น้ำปลา', 1, 'ช้อนโต๊ะ', 'sauce'), I('กระเทียม', 5, 'กลีบ', 'veg'), I('น้ำเปล่า', 1, 'ลิตร', 'other')], steps: ['ต้มไข่ให้สุก ปอกเปลือก', 'ผัดกระเทียมกับผงพะโล้ ใส่หมูสามชั้นผัดจนเปลี่ยนสี', 'เติมน้ำ ซีอิ๊วดำ น้ำตาลปี๊บ น้ำปลา เคี่ยวไฟอ่อนจนหมูนุ่ม', 'ใส่ไข่และเต้าหู้ เคี่ยวต่ออีก 15 นาที'] },
    { id: 'seed-padthai', name: 'ผัดไทยกุ้งสด', servings: 2, tags: ['จานเดียว', 'เส้น'], ingredients: [I('เส้นจันท์', 150, 'กรัม', 'dry'), I('กุ้งสด', 150, 'กรัม', 'meat'), I('ไข่ไก่', 1, 'ฟอง', 'meat'), I('เต้าหู้เหลือง', 50, 'กรัม', 'other'), I('ถั่วงอก', 100, 'กรัม', 'veg'), I('กุยช่าย', 1, 'กำ', 'veg'), I('น้ำมะขามเปียก', 3, 'ช้อนโต๊ะ', 'sauce'), I('น้ำปลา', 2, 'ช้อนโต๊ะ', 'sauce'), I('น้ำตาลปี๊บ', 2, 'ช้อนโต๊ะ', 'sauce'), I('ถั่วลิสงคั่ว', 2, 'ช้อนโต๊ะ', 'dry'), I('น้ำมันพืช', 3, 'ช้อนโต๊ะ', 'sauce')], steps: ['แช่เส้นจันท์ในน้ำจนนุ่ม สะเด็ดน้ำ', 'ผัดเต้าหู้และกุ้งในน้ำมัน ใส่เส้น เติมน้ำมะขามเปียก น้ำปลา น้ำตาล', 'ดันเส้นไปข้างกระทะ ตอกไข่ลงผัดแล้วคลุกเข้ากัน', 'ใส่ถั่วงอกและกุยช่าย ผัดพอสุก เสิร์ฟกับถั่วลิสงป่น'] },
    { id: 'seed-namprik', name: 'น้ำพริกกะปิ ผักต้ม ไข่ต้ม', servings: 2, tags: ['ผัก', 'จานเดียว'], ingredients: [I('กะปิ', 1, 'ช้อนโต๊ะ', 'sauce'), I('พริกขี้หนู', 8, 'เม็ด', 'veg'), I('กระเทียม', 5, 'กลีบ', 'veg'), I('มะนาว', 1, 'ลูก', 'veg'), I('น้ำตาลปี๊บ', 1, 'ช้อนชา', 'sauce'), I('มะเขือพวง', 50, 'กรัม', 'veg'), I('ถั่วฝักยาว', 100, 'กรัม', 'veg'), I('แตงกวา', 1, 'ลูก', 'veg'), I('ไข่ไก่', 2, 'ฟอง', 'meat')], steps: ['โขลกกระเทียมกับพริกให้ละเอียด ใส่กะปิโขลกต่อ', 'ปรุงรสด้วยน้ำมะนาวและน้ำตาลปี๊บ', 'ต้มไข่ ลวกถั่วฝักยาวและผักอื่นๆ เสิร์ฟกับน้ำพริก'] },
    { id: 'seed-garlicpork', name: 'หมูทอดกระเทียมพริกไทย', servings: 2, tags: ['ทอด', 'กับข้าว'], ingredients: [I('หมูสามชั้น', 300, 'กรัม', 'meat'), I('กระเทียม', 8, 'กลีบ', 'veg'), I('รากผักชี', 3, 'ราก', 'veg'), I('พริกไทย', 1, 'ช้อนชา', 'sauce'), I('ซีอิ๊วขาว', 1, 'ช้อนโต๊ะ', 'sauce'), I('น้ำมันพืช', 200, 'มล.', 'sauce')], steps: ['โขลกกระเทียม รากผักชี พริกไทย คลุกกับหมูหั่นชิ้น ใส่ซีอิ๊วขาว หมักสัก 30 นาที', 'ทอดในน้ำมันไฟกลางจนเหลืองกรอบ ตักสะเด็ดน้ำมัน'] },
    { id: 'seed-yumwoonsen', name: 'ยำวุ้นเส้น', servings: 2, tags: ['ยำ', 'เผ็ด'], ingredients: [I('วุ้นเส้น', 100, 'กรัม', 'dry'), I('หมูสับ', 100, 'กรัม', 'meat'), I('กุ้งสด', 100, 'กรัม', 'meat'), I('หอมแดง', 3, 'หัว', 'veg'), I('ขึ้นฉ่าย', 1, 'ต้น', 'veg'), I('พริกขี้หนู', 5, 'เม็ด', 'veg'), I('มะนาว', 2, 'ลูก', 'veg'), I('น้ำปลา', 2, 'ช้อนโต๊ะ', 'sauce'), I('น้ำตาลทราย', 1, 'ช้อนโต๊ะ', 'sauce')], steps: ['แช่วุ้นเส้นให้นุ่ม ลวกสุก สะเด็ดน้ำ', 'ลวกหมูสับและกุ้งให้สุก', 'ผสมน้ำปลา น้ำมะนาว น้ำตาล พริก คลุกกับวุ้นเส้น หมู กุ้ง หอมแดง ขึ้นฉ่าย'] }
  ];
  function seedRecipes(now) {
    return SEED.map(function (s) { var o = cleanRecipe(Object.assign({ seed: true }, s), s.id, now || 0).rec; return o; });
  }

  /* สูตรที่ใช้งานจริง = สูตรตั้งต้นที่ยังไม่ถูกแก้/ลบ + แถวที่เก็บไว้ · สูตรตั้งต้นไม่ถูกเขียนลงที่เก็บจนกว่าผู้ใช้แก้ (แถวเดียวกัน id เดิม)
     ลบสูตรตั้งต้น = เก็บแถวหลุม { id, deleted:true } (สองเครื่องจึงไม่เสกสูตรที่ลบแล้วกลับมา) */
  function effectiveRecipes(stored, now) {
    var rows = (Array.isArray(stored) ? stored : []).filter(function (r) { return r && typeof r === 'object' && r.id; });
    var by = {};
    rows.forEach(function (r) { by[r.id] = r; });
    var out = [];
    seedRecipes(now).forEach(function (s) { if (!by[s.id]) out.push(s); });
    rows.forEach(function (r) { if (!r.deleted && r.name) out.push(r); });
    return out;
  }

  return {
    effectiveRecipes: effectiveRecipes,
    CATS: CATS, MEALS: MEALS, XP_PER_MEAL: XP_PER_MEAL, UNITS: UNITS,
    unitInfo: unitInfo, normName: normName, displayUnit: displayUnit,
    ymdOf: ymdOf, addDays: addDays, weekStart: weekStart, weekDays: weekDays, planId: planId, shopId: shopId, slotKey: slotKey, allSlots: allSlots, validSlot: validSlot,
    cleanIngredient: cleanIngredient, cleanRecipe: cleanRecipe, recipeMatches: recipeMatches, allTags: allTags,
    emptyPlan: emptyPlan, cleanPlan: cleanPlan, copyPrev: copyPrev, fillRandom: fillRandom,
    aggregate: aggregate, lineId: lineId,
    tickRowId: tickRowId, isTickRow: isTickRow, setField: setField, mergeLines: mergeLines, cleanPrice: cleanPrice, shoppingView: shoppingView, newShopping: newShopping,
    defaultCategory: defaultCategory, budgetId: budgetId, budgetRecord: budgetRecord,
    recipeMessages: recipeMessages, parseRecipe: parseRecipe, textToSteps: textToSteps,
    seedRecipes: seedRecipes
  };
});
