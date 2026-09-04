/* ══════════════════════════════════════════════════════════════════
   Tanot — cad.js (งานเขียนแบบ CAD, Stage 1)
   สเตจนี้คือแกนกลางของเอนจินเขียนแบบ: ระบบพิกัดโลกเป็นมิลลิเมตรจริง (แยกจาก
   พิกเซลบนจอเด็ดขาด — ทุกอย่างอ้างอิงมิลลิเมตรเสมอ พิกเซลเป็นแค่ผลลัพธ์ตอน
   วาดขึ้นจอเท่านั้น) แพน/ซูมได้ทั้งเมาส์/นิ้ว มีกริด+ไม้บรรทัดปรับสเกลอัตโนมัติ
   สแนปกริด โมเดลข้อมูล entity/layer พื้นฐาน (รองรับต่อยอด type อื่นในสเตจถัดไป)
   เครื่องมือ "เส้น" แบบหยาบๆ (คลิกสองจุด ยังไม่มีพิมพ์ระยะ/สแนปวัตถุ — ของสเตจ 2)
   ทำซ้ำ/เลิกทำ และบันทึกอัตโนมัติลง localStorage เหมือนเครื่องมืออื่นในเว็บนี้

   ไฟล์เดียวกันวันนี้แค่วาด "เส้น" ได้ชนิดเดียว แต่ entity model ({id,type,layer,...})
   ตั้งใจให้ทั่วไปพอที่จะเพิ่ม type อื่น (polyline/circle/arc/dimension ฯลฯ) ใน
   สเตจถัดไปได้โดยไม่ต้องรื้อโครงสร้างเดิม
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LANG_KEY = 'tanot:doclang';
  var AUTOSAVE_KEY = 'tanot:cad:autosave';

  var I18N = {
    th: {
      docTitle: 'งานเขียนแบบ CAD | Tanot',
      crumbResp: 'งานที่รับผิดชอบ', crumbCad: 'งานเขียนแบบ (CAD)',
      pageTitle: 'งานเขียนแบบ CAD',
      pageDesc: 'วาดแบบ 2 มิติด้วยพิกัดมิลลิเมตรจริง — ซูม/แพนดูแบบ วาดเส้นคร่าวๆ ทดสอบ (ระบบใส่ระยะเป๊ะ/สแนปวัตถุ/มิติจะตามมาในเวอร์ชันถัดไป)',
      toolSelect: '🖱️ เลือก', toolLine: '／ เส้น', deleteSel: '🗑️ ลบที่เลือก',
      zoomFit: 'พอดีจอ', snapToggle: '🧲 สแนปกริด', snapStepLbl: 'ระยะกริด',
      clearAll: '🧹 ล้างทั้งหมด',
      coordLbl: 'พิกัด:', zoomLbl: 'ซูม:', entCountLbl: 'เส้น:',
      hintText: '🖱️ ลากขวา/กลาง หรือลากด้วยนิ้วเพื่อเลื่อนมุมมอง · หมุนล้อเมาส์/บีบสองนิ้วเพื่อซูม · เลือกเครื่องมือ "เส้น" แล้วคลิกสองจุดเพื่อวาด · Esc ยกเลิกการวาด · Delete ลบเส้นที่เลือก',
      mmUnit: 'มม.',
      autosaveSaved: 'บันทึกอัตโนมัติแล้ว', restoredDraft: 'กู้คืนแบบร่างล่าสุดที่บันทึกอัตโนมัติไว้',
      clearConfirm: 'ล้างทั้งหมด? เส้นทุกเส้นในแบบนี้จะถูกลบ (ยังกด "เลิกทำ" ย้อนกลับได้)'
    },
    en: {
      docTitle: 'CAD Drafting | Tanot',
      crumbResp: 'Responsibilities', crumbCad: 'CAD Drafting',
      pageTitle: 'CAD Drafting',
      pageDesc: '2D drafting with real millimeter coordinates — zoom/pan to view, draw rough test lines (precise distance entry, object snap, and dimensions land in a later stage)',
      toolSelect: '🖱️ Select', toolLine: '／ Line', deleteSel: '🗑️ Delete selected',
      zoomFit: 'Fit view', snapToggle: '🧲 Grid snap', snapStepLbl: 'Grid step',
      clearAll: '🧹 Clear all',
      coordLbl: 'Coord:', zoomLbl: 'Zoom:', entCountLbl: 'Lines:',
      hintText: '🖱️ Right/middle-drag or drag with a finger to pan · scroll wheel / pinch to zoom · pick the "Line" tool then click two points to draw · Esc cancels the line in progress · Delete removes the selected line',
      mmUnit: 'mm',
      autosaveSaved: 'Autosaved', restoredDraft: 'Restored your last autosaved draft',
      clearConfirm: 'Clear everything? Every line in this drawing will be removed (you can still Undo).'
    }
  };
  function getUILang() { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  function setUILang(l) { try { localStorage.setItem(LANG_KEY, l); } catch (e) {} }
  function t(key, vars) {
    var s = (I18N[getUILang()] && I18N[getUILang()][key]) || I18N.th[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }
  function applyStaticI18n() {
    var lang = getUILang();
    document.documentElement.lang = lang;
    var titleKey = document.body.getAttribute('data-doctitle-key');
    if (titleKey) document.title = t(titleKey);
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      /* ปุ่ม "ระยะกริด" มี <select> ซ้อนอยู่ข้างในป้าย — เขียนทับแค่ text node แรก ไม่ทำ select หาย */
      if (el.querySelector('select')) { el.childNodes[0].textContent = t(key); return; }
      el.textContent = t(key);
    });
    var lt = document.getElementById('langToggle');
    if (lt) lt.querySelectorAll('span').forEach(function (s) { s.classList.toggle('active', s.getAttribute('data-lt') === lang); });
  }

  var $ = function (id) { return document.getElementById(id); };
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
  function genId() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var HISTORY_MAX = 100;
  var BASE_SCALE = 1;      // px ต่อ mm ตอนซูม 100% (นิยามเอง — ไม่ผูกกับมาตราส่วนพิมพ์จริง เก็บไว้คิดตอนสเตจ plot)
  var MIN_SCALE = 0.005, MAX_SCALE = 50;
  var RULER_SIZE = 22;     // px ที่กันไว้เป็นไม้บรรทัดบนสุด/ซ้ายสุดของ canvas
  var HIT_PX = 7;          // ระยะคลิกให้ถือว่าโดนเส้น (พิกเซล — แปลงเป็น mm ตามซูมทุกครั้งที่เช็ค)

  var state = {
    entities: [],          // [{id, type:'line', layer:'0', p1:{x,y}, p2:{x,y}}] พิกัดหน่วย mm เสมอ
    layers: { '0': { color: '#1F2430', visible: true } },
    activeLayer: '0',
    view: { cx: 0, cy: 0, scale: 0.5 }, // cx,cy = พิกัดโลก (mm) ที่อยู่กึ่งกลางจอ, scale = px ต่อ mm
    tool: 'select',        // 'select' | 'line'
    selectedId: null,
    snapOn: true,
    snapStep: 10,
    drawingPoint: null,    // จุดแรกของเส้นที่กำลังวาดอยู่ (world mm) หรือ null ถ้ายังไม่เริ่ม
    history: [], redoStack: [],
    cw: 0, ch: 0           // ขนาด canvas เป็น CSS px (อัปเดตตอน resize)
  };

  var viewport = $('cadViewport'), canvas = $('cadCanvas'), ctx = canvas.getContext('2d');

  /* ══════════════════ พิกัด: โลก (mm, Y ขึ้นบน แบบ CAD) ↔ จอ (px, Y ลงล่าง) ══════════════════ */
  function worldToScreen(x, y) {
    return { x: state.cw / 2 + (x - state.view.cx) * state.view.scale, y: state.ch / 2 - (y - state.view.cy) * state.view.scale };
  }
  function screenToWorld(sx, sy) {
    return { x: (sx - state.cw / 2) / state.view.scale + state.view.cx, y: -(sy - state.ch / 2) / state.view.scale + state.view.cy };
  }
  function snapPoint(w) {
    if (!state.snapOn) return w;
    var s = state.snapStep;
    return { x: Math.round(w.x / s) * s, y: Math.round(w.y / s) * s };
  }

  /* ══════════════════ กริด: หาระยะห่าง "กลมๆ" ที่พอดีจอ ตามระดับซูมปัจจุบัน ══════════════════
     เป้าหมาย: เส้นกริดย่อยห่างกันบนจอประมาณ targetPx เสมอไม่ว่าจะซูมแค่ไหน — ปัดค่าจริง (mm)
     ให้เป็น 1/2/5 × กำลังสิบ (แพทเทิร์นเดียวกับไม้บรรทัด/สเกลกราฟทั่วไป) */
  function niceStep(targetPx, scale) {
    var raw = targetPx / scale;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var mult = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
    return mult * mag;
  }

  function fmtMm(v) {
    // ตัดทศนิยมทิ้งเมื่อเป็นจำนวนเต็ม (กริด/ไม้บรรทัดส่วนใหญ่เป็นเลขกลมอยู่แล้ว) กันป้ายรก
    return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1);
  }

  /* ══════════════════ วาดทั้งฉาก ══════════════════ */
  function render() {
    var cw = state.cw, ch = state.ch;
    if (!cw || !ch) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.hasAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var col = {
      bg: dark ? '#0F1420' : '#FFFFFF', minor: dark ? '#1C2333' : '#EEF1F7', major: dark ? '#2A3348' : '#DDE3EF',
      axis: dark ? '#3A4560' : '#C7CEDC', ink: dark ? '#E6E9F2' : '#1F2430', muted: dark ? '#8A93A8' : '#727C93',
      rulerBg: dark ? '#141A28' : '#FAFBFD', entity: dark ? '#9FB4E8' : '#2554C7', selected: '#F5A524', preview: '#F5A524'
    };
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, cw, ch);

    var minorStep = niceStep(26, state.view.scale);
    var majorStep = minorStep * 5;
    var topLeft = screenToWorld(0, 0), botRight = screenToWorld(cw, ch);
    var xMin = Math.min(topLeft.x, botRight.x), xMax = Math.max(topLeft.x, botRight.x);
    var yMin = Math.min(topLeft.y, botRight.y), yMax = Math.max(topLeft.y, botRight.y);

    // ── เส้นกริดย่อย ──
    ctx.lineWidth = 1; ctx.strokeStyle = col.minor;
    ctx.beginPath();
    var xs = Math.ceil(xMin / minorStep) * minorStep;
    for (var gx = xs; gx <= xMax; gx += minorStep) {
      var sx = Math.round(worldToScreen(gx, 0).x) + 0.5;
      ctx.moveTo(sx, RULER_SIZE); ctx.lineTo(sx, ch);
    }
    var ys = Math.ceil(yMin / minorStep) * minorStep;
    for (var gy = ys; gy <= yMax; gy += minorStep) {
      var sy = Math.round(worldToScreen(0, gy).y) + 0.5;
      ctx.moveTo(RULER_SIZE, sy); ctx.lineTo(cw, sy);
    }
    ctx.stroke();

    // ── เส้นกริดหลัก (เข้มกว่า, ห่างกว่า) ──
    ctx.strokeStyle = col.major;
    ctx.beginPath();
    var xM = Math.ceil(xMin / majorStep) * majorStep;
    for (var gx2 = xM; gx2 <= xMax; gx2 += majorStep) {
      var sx2 = Math.round(worldToScreen(gx2, 0).x) + 0.5;
      ctx.moveTo(sx2, RULER_SIZE); ctx.lineTo(sx2, ch);
    }
    var yM = Math.ceil(yMin / majorStep) * majorStep;
    for (var gy2 = yM; gy2 <= yMax; gy2 += majorStep) {
      var sy2 = Math.round(worldToScreen(0, gy2).y) + 0.5;
      ctx.moveTo(RULER_SIZE, sy2); ctx.lineTo(cw, sy2);
    }
    ctx.stroke();

    // ── แกน X=0 / Y=0 ──
    ctx.strokeStyle = col.axis; ctx.lineWidth = 1.5;
    var origin = worldToScreen(0, 0);
    ctx.beginPath();
    if (origin.x >= RULER_SIZE && origin.x <= cw) { ctx.moveTo(Math.round(origin.x) + 0.5, RULER_SIZE); ctx.lineTo(Math.round(origin.x) + 0.5, ch); }
    if (origin.y >= RULER_SIZE && origin.y <= ch) { ctx.moveTo(RULER_SIZE, Math.round(origin.y) + 0.5); ctx.lineTo(cw, Math.round(origin.y) + 0.5); }
    ctx.stroke();

    // ── เอนทิตี้ (ตอนนี้มีแค่เส้น) ──
    state.entities.forEach(function (e) {
      if (e.type !== 'line') return;
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      var a = worldToScreen(e.p1.x, e.p1.y), b = worldToScreen(e.p2.x, e.p2.y);
      var selected = e.id === state.selectedId;
      ctx.strokeStyle = selected ? col.selected : (layer.color || col.entity);
      ctx.lineWidth = selected ? 2.5 : 1.6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (selected) {
        ctx.fillStyle = col.selected;
        [a, b].forEach(function (p) { ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill(); });
      }
    });

    // ── เส้นที่กำลังวาดอยู่ (พรีวิวเส้นประ) ──
    if (state.tool === 'line' && state.drawingPoint && state._cursorWorld) {
      var p1s = worldToScreen(state.drawingPoint.x, state.drawingPoint.y);
      var p2 = snapPoint(state._cursorWorld);
      var p2s = worldToScreen(p2.x, p2.y);
      ctx.strokeStyle = col.preview; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(p1s.x, p1s.y); ctx.lineTo(p2s.x, p2s.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col.preview;
      ctx.beginPath(); ctx.arc(p1s.x, p1s.y, 3, 0, Math.PI * 2); ctx.fill();
    }

    // ── จุดสแนปปัจจุบัน (โชว์ให้เห็นว่าจะคลิกโดนพิกัดไหน) ──
    if (state.snapOn && state._cursorWorld && state._cursorScreen) {
      var snapped = snapPoint(state._cursorWorld);
      var sp = worldToScreen(snapped.x, snapped.y);
      ctx.strokeStyle = col.preview; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(sp.x - 5, sp.y); ctx.lineTo(sp.x + 5, sp.y); ctx.moveTo(sp.x, sp.y - 5); ctx.lineTo(sp.x, sp.y + 5); ctx.stroke();
    }

    // ── ไม้บรรทัด (วาดทับกริด/เอนทิตี้ทีหลังสุดเสมอ กันโดนเส้นทะลุขึ้นมา) ──
    ctx.fillStyle = col.rulerBg;
    ctx.fillRect(0, 0, cw, RULER_SIZE); ctx.fillRect(0, 0, RULER_SIZE, ch);
    ctx.strokeStyle = col.major; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, RULER_SIZE + 0.5); ctx.lineTo(cw, RULER_SIZE + 0.5);
    ctx.moveTo(RULER_SIZE + 0.5, 0); ctx.lineTo(RULER_SIZE + 0.5, ch); ctx.stroke();
    ctx.fillStyle = col.muted; ctx.font = '10px Prompt, sans-serif'; ctx.textBaseline = 'middle';
    for (var rx = xM; rx <= xMax; rx += majorStep) {
      var rsx = worldToScreen(rx, 0).x;
      ctx.strokeStyle = col.axis;
      ctx.beginPath(); ctx.moveTo(rsx + 0.5, RULER_SIZE - 7); ctx.lineTo(rsx + 0.5, RULER_SIZE); ctx.stroke();
      ctx.textAlign = 'left'; ctx.fillText(fmtMm(rx), rsx + 3, RULER_SIZE / 2);
    }
    for (var ry = yM; ry <= yMax; ry += majorStep) {
      var rsy = worldToScreen(0, ry).y;
      ctx.strokeStyle = col.axis;
      ctx.beginPath(); ctx.moveTo(RULER_SIZE - 7, rsy + 0.5); ctx.lineTo(RULER_SIZE, rsy + 0.5); ctx.stroke();
      ctx.save(); ctx.translate(RULER_SIZE / 2, rsy); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(fmtMm(ry), 0, 0); ctx.restore();
    }
  }

  /* ══════════════════ ปรับขนาด canvas ให้คมชัดตาม devicePixelRatio ══════════════════ */
  function resizeCanvas() {
    var rect = viewport.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // โค้ดวาดทั้งหมดด้านล่างใช้หน่วย CSS px ได้ตรงๆ ไม่ต้องคูณ dpr เอง
    state.cw = rect.width; state.ch = rect.height;
    render();
  }

  /* ══════════════════ undo/redo ══════════════════ */
  function pushHistory() {
    state.history.push(deepClone(state.entities));
    if (state.history.length > HISTORY_MAX) state.history.shift();
    state.redoStack = [];
    updateUndoRedoUI();
  }
  function undo() {
    if (!state.history.length) return;
    state.redoStack.push(deepClone(state.entities));
    state.entities = state.history.pop();
    state.selectedId = null;
    updateUndoRedoUI(); updateSelectionUI(); updateCountUI(); scheduleSave(); render();
  }
  function redo() {
    if (!state.redoStack.length) return;
    state.history.push(deepClone(state.entities));
    state.entities = state.redoStack.pop();
    state.selectedId = null;
    updateUndoRedoUI(); updateSelectionUI(); updateCountUI(); scheduleSave(); render();
  }
  function updateUndoRedoUI() {
    $('undoBtn').disabled = state.history.length === 0;
    $('redoBtn').disabled = state.redoStack.length === 0;
  }
  function updateSelectionUI() { $('deleteBtn').disabled = !state.selectedId; }
  function updateCountUI() { $('statCount').textContent = state.entities.length.toLocaleString(getUILang() === 'en' ? 'en-US' : 'th-TH'); }

  /* ══════════════════ บันทึกอัตโนมัติ ══════════════════ */
  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ entities: state.entities, layers: state.layers, view: state.view }));
        var el = $('statSave'); el.textContent = t('autosaveSaved');
        clearTimeout(el._clearTimer);
        el._clearTimer = setTimeout(function () { el.textContent = ''; }, 2500);
      } catch (e) {}
    }, 600);
  }
  function restoreAutosave() {
    try {
      var raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && Array.isArray(saved.entities)) {
        state.entities = saved.entities;
        if (saved.layers) state.layers = saved.layers;
        if (saved.view) state.view = saved.view;
        $('statSave').textContent = t('restoredDraft');
      }
    } catch (e) {}
  }

  /* ══════════════════ hit test: จุดใกล้เส้นที่สุด (ระยะทางในหน่วย mm เทียบ threshold ที่แปลงจาก px) ══════════════════ */
  function distPointToSegment(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var lenSq = dx * dx + dy * dy;
    var tt = lenSq ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq)) : 0;
    var cx = a.x + tt * dx, cy = a.y + tt * dy;
    return Math.hypot(p.x - cx, p.y - cy);
  }
  function hitTestEntity(worldPt) {
    var thresholdMm = HIT_PX / state.view.scale;
    var best = null, bestDist = Infinity;
    state.entities.forEach(function (e) {
      if (e.type !== 'line') return;
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      var d = distPointToSegment(worldPt, e.p1, e.p2);
      if (d < thresholdMm && d < bestDist) { bestDist = d; best = e.id; }
    });
    return best;
  }

  /* ══════════════════ ซูม/แพน ══════════════════ */
  function zoomAt(screenX, screenY, factor) {
    var before = screenToWorld(screenX, screenY);
    state.view.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.view.scale * factor));
    var after = screenToWorld(screenX, screenY);
    state.view.cx += before.x - after.x;
    state.view.cy += before.y - after.y;
    updateZoomUI(); render();
  }
  function updateZoomUI() { $('statZoom').textContent = Math.round(state.view.scale / BASE_SCALE * 100) + '%'; }
  function zoomFit() {
    if (!state.entities.length) { state.view = { cx: 0, cy: 0, scale: 0.5 }; updateZoomUI(); render(); return; }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.entities.forEach(function (e) {
      [e.p1, e.p2].forEach(function (p) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; });
    });
    var w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
    var pad = 1.15; // เผื่อขอบรอบๆ กันเส้นชิดขอบจอเกินไป
    var availW = Math.max(50, state.cw - RULER_SIZE - 20), availH = Math.max(50, state.ch - RULER_SIZE - 20);
    state.view.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(availW / (w * pad), availH / (h * pad))));
    state.view.cx = (minX + maxX) / 2; state.view.cy = (minY + maxY) / 2;
    updateZoomUI(); render();
  }

  /* ══════════════════ เครื่องมือ ══════════════════ */
  function setTool(tool) {
    state.tool = tool; state.drawingPoint = null;
    $('toolSelectBtn').classList.toggle('active', tool === 'select');
    $('toolLineBtn').classList.toggle('active', tool === 'line');
    viewport.style.cursor = tool === 'line' ? 'crosshair' : 'default';
    render();
  }
  function deleteSelected() {
    if (!state.selectedId) return;
    pushHistory();
    state.entities = state.entities.filter(function (e) { return e.id !== state.selectedId; });
    state.selectedId = null;
    updateSelectionUI(); updateCountUI(); scheduleSave(); render();
  }
  function clearAll() {
    if (!state.entities.length) return;
    if (!window.confirm(t('clearConfirm'))) return;
    pushHistory();
    state.entities = []; state.selectedId = null;
    updateSelectionUI(); updateCountUI(); scheduleSave(); render();
  }

  /* ══════════════════ อินพุตเมาส์ ══════════════════ */
  var panState = null; // {startScreenX, startScreenY, startCx, startCy}
  function updateCoordUI(w) {
    $('statCoord').textContent = 'X ' + w.x.toFixed(1) + ', Y ' + w.y.toFixed(1) + ' ' + t('mmUnit');
  }
  function eventScreenPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  canvas.addEventListener('mousemove', function (e) {
    var sp = eventScreenPos(e);
    state._cursorScreen = sp; state._cursorWorld = screenToWorld(sp.x, sp.y);
    updateCoordUI(snapPoint(state._cursorWorld));
    if (panState) {
      var dx = (sp.x - panState.startScreenX) / state.view.scale, dy = (sp.y - panState.startScreenY) / state.view.scale;
      state.view.cx = panState.startCx - dx; state.view.cy = panState.startCy + dy;
    }
    render();
  });
  canvas.addEventListener('mouseleave', function () { state._cursorWorld = null; state._cursorScreen = null; render(); });
  canvas.addEventListener('mousedown', function (e) {
    var sp = eventScreenPos(e);
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      panState = { startScreenX: sp.x, startScreenY: sp.y, startCx: state.view.cx, startCy: state.view.cy };
      viewport.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0) return;
    var world = snapPoint(screenToWorld(sp.x, sp.y));
    if (state.tool === 'line') {
      if (!state.drawingPoint) { state.drawingPoint = world; }
      else {
        if (world.x !== state.drawingPoint.x || world.y !== state.drawingPoint.y) {
          pushHistory();
          state.entities.push({ id: genId(), type: 'line', layer: state.activeLayer, p1: state.drawingPoint, p2: world });
          updateCountUI(); scheduleSave();
        }
        state.drawingPoint = null;
      }
      render();
    } else if (state.tool === 'select') {
      state.selectedId = hitTestEntity(screenToWorld(sp.x, sp.y));
      updateSelectionUI(); render();
    }
  });
  window.addEventListener('mouseup', function () { if (panState) { panState = null; viewport.style.cursor = state.tool === 'line' ? 'crosshair' : 'default'; } });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var sp = eventScreenPos(e);
    zoomAt(sp.x, sp.y, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });

  /* ══════════════════ อินพุตนิ้ว (มือถือ/แท็บเล็ต) — ลากนิ้วเดียว = แพนเสมอ, แตะเบาไม่ขยับ = คลิก,
     สองนิ้ว = บีบซูม ══════════════════ */
  var touchState = null;
  function touchDist(t0, t1) { return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY); }
  function touchMid(t0, t1) { var r = canvas.getBoundingClientRect(); return { x: (t0.clientX + t1.clientX) / 2 - r.left, y: (t0.clientY + t1.clientY) / 2 - r.top }; }
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      var sp = eventScreenPos(e.touches[0]);
      touchState = { mode: 'pan1', startX: sp.x, startY: sp.y, startCx: state.view.cx, startCy: state.view.cy, moved: false, startTime: Date.now() };
    } else if (e.touches.length === 2) {
      touchState = { mode: 'pinch', startDist: touchDist(e.touches[0], e.touches[1]), startScale: state.view.scale, mid: touchMid(e.touches[0], e.touches[1]), startCx: state.view.cx, startCy: state.view.cy };
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!touchState) return;
    if (touchState.mode === 'pan1' && e.touches.length === 1) {
      var sp = eventScreenPos(e.touches[0]);
      state._cursorScreen = sp; state._cursorWorld = screenToWorld(sp.x, sp.y);
      var dx = (sp.x - touchState.startX) / state.view.scale, dy = (sp.y - touchState.startY) / state.view.scale;
      if (Math.abs(sp.x - touchState.startX) > 6 || Math.abs(sp.y - touchState.startY) > 6) touchState.moved = true;
      if (touchState.moved) { state.view.cx = touchState.startCx - dx; state.view.cy = touchState.startCy + dy; }
      render();
    } else if (touchState.mode === 'pinch' && e.touches.length === 2) {
      var d = touchDist(e.touches[0], e.touches[1]);
      var factor = d / (touchState.startDist || 1);
      var newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, touchState.startScale * factor));
      var mid = touchState.mid;
      var before = screenToWorld(mid.x, mid.y);
      state.view.scale = newScale;
      var after = screenToWorld(mid.x, mid.y);
      state.view.cx = touchState.startCx + (before.x - after.x);
      state.view.cy = touchState.startCy + (before.y - after.y);
      updateZoomUI(); render();
    }
  }, { passive: false });
  canvas.addEventListener('touchend', function (e) {
    if (touchState && touchState.mode === 'pan1' && !touchState.moved && Date.now() - touchState.startTime < 500) {
      // แตะเบาไม่ขยับ = เทียบเท่าคลิกซ้าย ณ ตำแหน่งนั้น
      var world = snapPoint({ x: (touchState.startX - state.cw / 2) / state.view.scale + state.view.cx, y: -(touchState.startY - state.ch / 2) / state.view.scale + state.view.cy });
      if (state.tool === 'line') {
        if (!state.drawingPoint) { state.drawingPoint = world; }
        else {
          if (world.x !== state.drawingPoint.x || world.y !== state.drawingPoint.y) {
            pushHistory();
            state.entities.push({ id: genId(), type: 'line', layer: state.activeLayer, p1: state.drawingPoint, p2: world });
            updateCountUI(); scheduleSave();
          }
          state.drawingPoint = null;
        }
      } else if (state.tool === 'select') {
        state.selectedId = hitTestEntity({ x: (touchState.startX - state.cw / 2) / state.view.scale + state.view.cx, y: -(touchState.startY - state.ch / 2) / state.view.scale + state.view.cy });
        updateSelectionUI();
      }
      render();
    }
    touchState = null;
  });

  /* ══════════════════ คีย์ลัด ══════════════════ */
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (state.drawingPoint) { state.drawingPoint = null; render(); } }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId && document.activeElement.tagName !== 'SELECT') { e.preventDefault(); deleteSelected(); }
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); }
  });

  /* ══════════════════ wiring ปุ่ม ══════════════════ */
  $('toolSelectBtn').addEventListener('click', function () { setTool('select'); });
  $('toolLineBtn').addEventListener('click', function () { setTool('line'); });
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('deleteBtn').addEventListener('click', deleteSelected);
  $('clearAllBtn').addEventListener('click', clearAll);
  $('zoomInBtn').addEventListener('click', function () { zoomAt(state.cw / 2, state.ch / 2, 1.25); });
  $('zoomOutBtn').addEventListener('click', function () { zoomAt(state.cw / 2, state.ch / 2, 1 / 1.25); });
  $('zoomFitBtn').addEventListener('click', zoomFit);
  $('snapToggleBtn').addEventListener('click', function () {
    state.snapOn = !state.snapOn;
    $('snapToggleBtn').classList.toggle('active', state.snapOn);
    render();
  });
  $('snapStepSel').addEventListener('change', function () { state.snapStep = +this.value || 10; render(); });
  var langToggle = $('langToggle');
  if (langToggle) langToggle.addEventListener('click', function () { setUILang(getUILang() === 'en' ? 'th' : 'en'); applyStaticI18n(); });

  /* ══════════════════ init ══════════════════ */
  function boot() {
    applyStaticI18n();
    restoreAutosave();
    $('snapToggleBtn').classList.toggle('active', state.snapOn);
    updateUndoRedoUI(); updateSelectionUI(); updateCountUI(); updateZoomUI();
    resizeCanvas(); // เรียกครั้งแรกหลัง layout นิ่ง (ผ่าน whenReady ด้านล่าง) จะได้ขนาด viewport ที่ถูกต้อง
  }
  var rsz = null;
  window.addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(resizeCanvas, 120); });
  function whenReady(fn) {
    var fire = function () { requestAnimationFrame(function () { requestAnimationFrame(fn); }); };
    if (document.readyState === 'complete') fire(); else window.addEventListener('load', fire, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  whenReady(resizeCanvas); // เรียกซ้ำอีกทีหลัง layout จริงนิ่ง (กัน viewport ยังไม่ได้ขนาดตอน boot() ครั้งแรก)
})();
