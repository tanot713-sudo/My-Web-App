/* ══════════════════════════════════════════════════════════════════
   Tanot — cad.js (งานเขียนแบบ CAD, Stage 1+2)
   Stage 1 วางรากฐาน: ระบบพิกัดโลกเป็นมิลลิเมตรจริงแยกจากพิกเซลจอเด็ดขาด, แพน/ซูม,
   กริด+ไม้บรรทัดปรับสเกลอัตโนมัติ, สแนปกริด, โมเดล entity/layer ทั่วไป, เครื่องมือ
   เส้นหยาบๆ, ทำซ้ำ/เลิกทำ, บันทึกอัตโนมัติ

   Stage 2 ต่อยอด: เพิ่มชนิดเอนทิตี้ (polyline/สี่เหลี่ยม/วงกลม/ส่วนโค้ง 3 จุด), ระบบ
   ใส่ระยะ-มุมเป๊ะๆ ระหว่างวาด (พิมพ์ตัวเลขได้ทันทีโดยไม่ต้องคลิกช่องอินพุตก่อน — พิมพ์
   "3500" แล้ว Enter จะวางจุดถัดไปห่างจากจุดยึด 3500 มม. ตามทิศทางเมาส์ปัจจุบันถ้าไม่ใส่
   มุม), จับจุดวัตถุ (ปลายเส้น/จุดกึ่งกลาง/ศูนย์กลาง/จุดตัด/ตั้งฉาก) และโหมดตั้งฉาก (Ortho)

   เครื่องมือวาดทุกตัวใช้ pendingPoints[] ร่วมกัน (จุดที่คลิกไปแล้วระหว่างวาดเอนทิตี้
   ปัจจุบัน) ต่างกันแค่จำนวนจุดที่ต้องใช้ก่อน commit — ทำให้เพิ่มเครื่องมือใหม่ในอนาคต
   (dimension ฯลฯ) ใช้โครงเดิมได้โดยไม่ต้องรื้อระบบ input/preview/osnap
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
      pageDesc: 'วาดแบบ 2 มิติด้วยพิกัดมิลลิเมตรจริง — เส้น/พอลีไลน์/สี่เหลี่ยม/วงกลม/ส่วนโค้ง พิมพ์ระยะ-มุมเป๊ะได้ จับจุดวัตถุ + โหมดตั้งฉาก',
      toolSelect: '🖱️ เลือก', toolLine: '／ เส้น', toolPolyline: '⌇ พอลีไลน์', toolRect: '▭ สี่เหลี่ยม',
      toolCircle: '○ วงกลม', toolArc: '◜ ส่วนโค้ง', deleteSel: '🗑️ ลบที่เลือก',
      zoomFit: 'พอดีจอ', snapToggle: '🧲 สแนปกริด', snapStepLbl: 'ระยะกริด',
      osnapToggle: '🎯 จับจุดวัตถุ', orthoToggle: '⊥ ตั้งฉาก (F8)',
      clearAll: '🧹 ล้างทั้งหมด',
      distLbl: 'ระยะ (มม.)', angLbl: 'มุม (°)', finishPolyline: '✔️ จบเส้นพอลีไลน์',
      preciseHint: 'พิมพ์ระยะแล้วกด Enter (ไม่ใส่มุม = ใช้ทิศทางเมาส์ปัจจุบัน)',
      coordLbl: 'พิกัด:', zoomLbl: 'ซูม:', entCountLbl: 'เอนทิตี้:',
      hintText: '🖱️ ลากขวา/กลาง หรือลากด้วยนิ้วเพื่อเลื่อนมุมมอง · หมุนล้อเมาส์/บีบสองนิ้วเพื่อซูม · เลือกเครื่องมือวาดแล้วคลิกจุดตามลำดับ · พิมพ์ตัวเลขได้ทันทีระหว่างวาดเพื่อใส่ระยะเป๊ะ · Esc ยกเลิกการวาด · Delete ลบเอนทิตี้ที่เลือก · F8 สลับโหมดตั้งฉาก',
      mmUnit: 'มม.',
      autosaveSaved: 'บันทึกอัตโนมัติแล้ว', restoredDraft: 'กู้คืนแบบร่างล่าสุดที่บันทึกอัตโนมัติไว้',
      clearConfirm: 'ล้างทั้งหมด? ทุกเอนทิตี้ในแบบนี้จะถูกลบ (ยังกด "เลิกทำ" ย้อนกลับได้)',
      snapEnd: 'ปลาย', snapMid: 'กึ่งกลาง', snapCenter: 'ศูนย์กลาง', snapInt: 'จุดตัด', snapPerp: 'ตั้งฉาก'
    },
    en: {
      docTitle: 'CAD Drafting | Tanot',
      crumbResp: 'Responsibilities', crumbCad: 'CAD Drafting',
      pageTitle: 'CAD Drafting',
      pageDesc: '2D drafting with real millimeter coordinates — line/polyline/rectangle/circle/arc, precise distance & angle entry, object snap + ortho mode',
      toolSelect: '🖱️ Select', toolLine: '／ Line', toolPolyline: '⌇ Polyline', toolRect: '▭ Rectangle',
      toolCircle: '○ Circle', toolArc: '◜ Arc', deleteSel: '🗑️ Delete selected',
      zoomFit: 'Fit view', snapToggle: '🧲 Grid snap', snapStepLbl: 'Grid step',
      osnapToggle: '🎯 Object snap', orthoToggle: '⊥ Ortho (F8)',
      clearAll: '🧹 Clear all',
      distLbl: 'Distance (mm)', angLbl: 'Angle (°)', finishPolyline: '✔️ Finish polyline',
      preciseHint: 'Type a distance and press Enter (leave angle blank to use the current mouse direction)',
      coordLbl: 'Coord:', zoomLbl: 'Zoom:', entCountLbl: 'Entities:',
      hintText: '🖱️ Right/middle-drag or drag with a finger to pan · scroll wheel / pinch to zoom · pick a draw tool then click points in order · type a number any time while drawing for a precise distance · Esc cancels the current draw · Delete removes the selected entity · F8 toggles ortho',
      mmUnit: 'mm',
      autosaveSaved: 'Autosaved', restoredDraft: 'Restored your last autosaved draft',
      clearConfirm: 'Clear everything? Every entity in this drawing will be removed (you can still Undo).',
      snapEnd: 'endpoint', snapMid: 'midpoint', snapCenter: 'center', snapInt: 'intersection', snapPerp: 'perpendicular'
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
      /* ป้ายบางอันมี input/select ซ้อนอยู่ข้างใน — เขียนทับแค่ text node แรก ไม่ทำ control หาย */
      if (el.querySelector('select, input')) { el.childNodes[0].textContent = t(key); return; }
      el.textContent = t(key);
    });
    var lt = document.getElementById('langToggle');
    if (lt) lt.querySelectorAll('span').forEach(function (s) { s.classList.toggle('active', s.getAttribute('data-lt') === lang); });
  }

  var $ = function (id) { return document.getElementById(id); };
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
  function genId() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function normAngle(a) { a = a % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a; }

  var HISTORY_MAX = 100;
  var BASE_SCALE = 1;      // px ต่อ mm ตอนซูม 100% (นิยามเอง — ไม่ผูกกับมาตราส่วนพิมพ์จริง เก็บไว้คิดตอนสเตจ plot)
  var MIN_SCALE = 0.005, MAX_SCALE = 50;
  var RULER_SIZE = 22;     // px ที่กันไว้เป็นไม้บรรทัดบนสุด/ซ้ายสุดของ canvas
  var HIT_PX = 7;          // ระยะคลิกให้ถือว่าโดนเอนทิตี้ (พิกเซล — แปลงเป็น mm ตามซูมทุกครั้งที่เช็ค)
  var OSNAP_PX = 12;        // รัศมีจับจุดวัตถุ (พิกเซล)
  var DUP_EPS = 1e-6;       // ระยะ (mm) ที่ถือว่าจุดสองจุด "เดียวกัน" (กันหารด้วยศูนย์/เอนทิตี้ยาว 0)

  var state = {
    entities: [],           // [{id, type, layer, ...}] พิกัดหน่วย mm เสมอ — ดูรูปแบบตาม type ด้านล่าง
    layers: { '0': { color: '#1F2430', visible: true } },
    activeLayer: '0',
    view: { cx: 0, cy: 0, scale: 0.5 }, // cx,cy = พิกัดโลก (mm) ที่อยู่กึ่งกลางจอ, scale = px ต่อ mm
    tool: 'select',         // 'select' | 'line' | 'polyline' | 'rect' | 'circle' | 'arc'
    selectedId: null,
    snapOn: true, snapStep: 10,
    osnapOn: true, orthoOn: false,
    pendingPoints: [],       // จุดที่คลิกไปแล้วระหว่างวาดเอนทิตี้ปัจจุบัน (ความยาวที่ต้องใช้ขึ้นกับ tool)
    history: [], redoStack: [],
    cw: 0, ch: 0,            // ขนาด canvas เป็น CSS px (อัปเดตตอน resize)
    _cursorWorld: null, _cursorScreen: null
  };

  /* รูปแบบข้อมูลต่อ type:
     line:     {p1:{x,y}, p2:{x,y}}
     polyline: {points:[{x,y},...], closed:bool}
     rect:     {p1:{x,y}, p2:{x,y}}                         (มุมตรงข้ามกัน แนวแกนตรงเสมอ)
     circle:   {center:{x,y}, radius}
     arc:      {center:{x,y}, radius, startAngle, endAngle} (เรเดียน, กวาดทวนเข็มจาก start ไป end เสมอ) */

  var viewport = $('cadViewport'), canvas = $('cadCanvas'), ctx = canvas.getContext('2d');
  var distInput = $('distInput'), angInput = $('angInput'), preciseRow = $('preciseRow'), finishPolyBtn = $('finishPolylineBtn');

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

  /* ══════════════════ เรขาคณิตพื้นฐาน ══════════════════ */
  function distPointToSegment(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var lenSq = dx * dx + dy * dy;
    var tt = lenSq ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq)) : 0;
    var cx = a.x + tt * dx, cy = a.y + tt * dy;
    return Math.hypot(p.x - cx, p.y - cy);
  }
  function rectCorners(e) { return [e.p1, { x: e.p2.x, y: e.p1.y }, e.p2, { x: e.p1.x, y: e.p2.y }]; }
  function arcPoints(e, n) {
    n = n || 48;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var a = e.startAngle + (e.endAngle - e.startAngle) * (i / n);
      pts.push({ x: e.center.x + e.radius * Math.cos(a), y: e.center.y + e.radius * Math.sin(a) });
    }
    return pts;
  }
  function distPointToArc(p, e) {
    var ang = Math.atan2(p.y - e.center.y, p.x - e.center.x);
    var rel = normAngle(ang - e.startAngle), span = normAngle(e.endAngle - e.startAngle);
    var distToCircle = Math.abs(Math.hypot(p.x - e.center.x, p.y - e.center.y) - e.radius);
    if (rel <= span) return distToCircle;
    var sp = { x: e.center.x + e.radius * Math.cos(e.startAngle), y: e.center.y + e.radius * Math.sin(e.startAngle) };
    var ep = { x: e.center.x + e.radius * Math.cos(e.endAngle), y: e.center.y + e.radius * Math.sin(e.endAngle) };
    return Math.min(Math.hypot(p.x - sp.x, p.y - sp.y), Math.hypot(p.x - ep.x, p.y - ep.y));
  }
  function distPointToEntity(p, e) {
    if (e.type === 'line') return distPointToSegment(p, e.p1, e.p2);
    if (e.type === 'polyline') {
      var d = Infinity;
      for (var i = 0; i < e.points.length - 1; i++) d = Math.min(d, distPointToSegment(p, e.points[i], e.points[i + 1]));
      if (e.closed && e.points.length > 2) d = Math.min(d, distPointToSegment(p, e.points[e.points.length - 1], e.points[0]));
      return d;
    }
    if (e.type === 'rect') {
      var c = rectCorners(e), dd = Infinity;
      for (var j = 0; j < 4; j++) dd = Math.min(dd, distPointToSegment(p, c[j], c[(j + 1) % 4]));
      return dd;
    }
    if (e.type === 'circle') return Math.abs(Math.hypot(p.x - e.center.x, p.y - e.center.y) - e.radius);
    if (e.type === 'arc') return distPointToArc(p, e);
    return Infinity;
  }
  /* วงกลมผ่าน 3 จุด (circumcircle) — คืน center/radius/startAngle/endAngle โดยเลือกทิศกวาด (จาก p1 ไป p2)
     ที่ผ่าน p3 จริง (แก้ปัญหาความกำกวมว่าจะกวาดทางไหนของวงกลมเมื่อรู้แค่ 2 จุดปลาย) */
  function computeArcFrom3Points(p1, p2, p3) {
    var ax = p1.x, ay = p1.y, bx = p2.x, by = p2.y, cx = p3.x, cy = p3.y;
    var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-9) return null; // สามจุดอยู่ในแนวเส้นตรงเดียวกัน หาวงกลมผ่านไม่ได้
    var ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    var uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    var radius = Math.hypot(ax - ux, ay - uy);
    var a1 = Math.atan2(ay - uy, ax - ux), a2 = Math.atan2(by - uy, bx - ux), a3 = Math.atan2(cy - uy, cx - ux);
    var span = normAngle(a2 - a1), rel3 = normAngle(a3 - a1);
    var startAngle, endAngle;
    if (rel3 <= span) { startAngle = a1; endAngle = a1 + span; }
    else { startAngle = a2; endAngle = a2 + normAngle(a1 - a2); }
    return { center: { x: ux, y: uy }, radius: radius, startAngle: startAngle, endAngle: endAngle };
  }
  function segIntersect(a1, a2, b1, b2) {
    var d1x = a2.x - a1.x, d1y = a2.y - a1.y, d2x = b2.x - b1.x, d2y = b2.y - b1.y;
    var denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) < 1e-9) return null;
    var tt = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom;
    var u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / denom;
    if (tt < 0 || tt > 1 || u < 0 || u > 1) return null;
    return { x: a1.x + tt * d1x, y: a1.y + tt * d1y };
  }
  function perpFoot(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, lenSq = dx * dx + dy * dy;
    if (!lenSq) return null;
    var tt = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    if (tt < 0 || tt > 1) return null; // เอาแค่ตั้งฉากกับ "เส้นจริง" ไม่ใช่เส้นสมมติที่ยืดออกไปไม่มีที่สิ้นสุด
    return { x: a.x + tt * dx, y: a.y + tt * dy };
  }
  function entitySnapPoints(e) {
    var pts = [];
    if (e.type === 'line') { pts.push({ p: e.p1, kind: 'end' }, { p: e.p2, kind: 'end' }, { p: mid(e.p1, e.p2), kind: 'mid' }); }
    else if (e.type === 'polyline') {
      e.points.forEach(function (p) { pts.push({ p: p, kind: 'end' }); });
      for (var i = 0; i < e.points.length - 1; i++) pts.push({ p: mid(e.points[i], e.points[i + 1]), kind: 'mid' });
      if (e.closed && e.points.length > 2) pts.push({ p: mid(e.points[e.points.length - 1], e.points[0]), kind: 'mid' });
    } else if (e.type === 'rect') {
      var c = rectCorners(e);
      c.forEach(function (p) { pts.push({ p: p, kind: 'end' }); });
      for (var j = 0; j < 4; j++) pts.push({ p: mid(c[j], c[(j + 1) % 4]), kind: 'mid' });
    } else if (e.type === 'circle') { pts.push({ p: e.center, kind: 'center' }); }
    else if (e.type === 'arc') {
      pts.push({ p: e.center, kind: 'center' });
      pts.push({ p: { x: e.center.x + e.radius * Math.cos(e.startAngle), y: e.center.y + e.radius * Math.sin(e.startAngle) }, kind: 'end' });
      pts.push({ p: { x: e.center.x + e.radius * Math.cos(e.endAngle), y: e.center.y + e.radius * Math.sin(e.endAngle) }, kind: 'end' });
    }
    return pts;
  }
  function entitySegments(e) {
    if (e.type === 'line') return [[e.p1, e.p2]];
    if (e.type === 'polyline') {
      var segs = [];
      for (var i = 0; i < e.points.length - 1; i++) segs.push([e.points[i], e.points[i + 1]]);
      if (e.closed && e.points.length > 2) segs.push([e.points[e.points.length - 1], e.points[0]]);
      return segs;
    }
    if (e.type === 'rect') { var c = rectCorners(e); return [[c[0], c[1]], [c[1], c[2]], [c[2], c[3]], [c[3], c[0]]]; }
    return []; // circle/arc ไม่รองรับจุดตัด/ตั้งฉากแบบเส้นตรงในสเตจนี้ (ขอบเขตที่ตัดออกไปก่อน)
  }
  function entityBoundsPoints(e) {
    if (e.type === 'line') return [e.p1, e.p2];
    if (e.type === 'polyline') return e.points;
    if (e.type === 'rect') return [e.p1, e.p2];
    if (e.type === 'circle') return [{ x: e.center.x - e.radius, y: e.center.y - e.radius }, { x: e.center.x + e.radius, y: e.center.y + e.radius }];
    if (e.type === 'arc') { var pts = arcPoints(e, 16); pts.push(e.center); return pts; }
    return [];
  }

  /* ══════════════════ กริด: หาระยะห่าง "กลมๆ" ที่พอดีจอ ตามระดับซูมปัจจุบัน ══════════════════ */
  function niceStep(targetPx, scale) {
    var raw = targetPx / scale;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var mult = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
    return mult * mag;
  }
  function fmtMm(v) { return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1); }

  /* ══════════════════ ตั้งฉาก + จับจุดวัตถุ + สแนป — คำนวณ "จุดที่เคอร์เซอร์จะวางจริง" ══════════════════ */
  function applyOrtho(rawWorld) {
    if (!state.orthoOn || !state.pendingPoints.length) return rawWorld;
    var anchor = state.pendingPoints[state.pendingPoints.length - 1];
    var dx = rawWorld.x - anchor.x, dy = rawWorld.y - anchor.y;
    return Math.abs(dx) >= Math.abs(dy) ? { x: rawWorld.x, y: anchor.y } : { x: anchor.x, y: rawWorld.y };
  }
  function findOsnapCandidate(worldPt) {
    if (!state.osnapOn) return null;
    var thresholdMm = OSNAP_PX / state.view.scale;
    var best = null, bestD = thresholdMm;
    var segs = [];
    state.entities.forEach(function (e) {
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      entitySnapPoints(e).forEach(function (sp) {
        var d = Math.hypot(worldPt.x - sp.p.x, worldPt.y - sp.p.y);
        if (d < bestD) { bestD = d; best = { x: sp.p.x, y: sp.p.y, kind: sp.kind }; }
      });
      entitySegments(e).forEach(function (s) { segs.push(s); });
    });
    for (var i = 0; i < segs.length; i++) {
      for (var j = i + 1; j < segs.length; j++) {
        var ip = segIntersect(segs[i][0], segs[i][1], segs[j][0], segs[j][1]);
        if (!ip) continue;
        var d2 = Math.hypot(worldPt.x - ip.x, worldPt.y - ip.y);
        if (d2 < bestD) { bestD = d2; best = { x: ip.x, y: ip.y, kind: 'int' }; }
      }
    }
    if (state.pendingPoints.length) {
      var anchor = state.pendingPoints[state.pendingPoints.length - 1];
      segs.forEach(function (s) {
        var foot = perpFoot(anchor, s[0], s[1]);
        if (!foot) return;
        var d3 = Math.hypot(worldPt.x - foot.x, worldPt.y - foot.y);
        if (d3 < bestD) { bestD = d3; best = { x: foot.x, y: foot.y, kind: 'perp' }; }
      });
    }
    return best;
  }
  /* จุดที่จะ "ใช้จริง" ถ้าเมาส์อยู่ตรงนี้ตอนนี้ — จับจุดวัตถุมาก่อนเสมอ (แม่เหล็กดูดของจริง) ถ้าไม่เจอค่อยใช้
     ตั้งฉาก+สแนปกริดตามลำดับ ให้ preview/คลิกจริงเรียกฟังก์ชันเดียวกันนี้เพื่อผลตรงกันเป๊ะ */
  function effectivePoint(rawWorld) {
    var osnap = findOsnapCandidate(rawWorld);
    if (osnap) return { x: osnap.x, y: osnap.y, snapKind: osnap.kind };
    var p = applyOrtho(rawWorld);
    if (state.snapOn) p = snapPoint(p);
    return { x: p.x, y: p.y, snapKind: null };
  }

  /* ══════════════════ วาดทั้งฉาก ══════════════════ */
  function render() {
    var cw = state.cw, ch = state.ch;
    if (!cw || !ch) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.hasAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var col = {
      bg: dark ? '#0F1420' : '#FFFFFF', minor: dark ? '#1C2333' : '#EEF1F7', major: dark ? '#2A3348' : '#DDE3EF',
      axis: dark ? '#3A4560' : '#C7CEDC', muted: dark ? '#8A93A8' : '#727C93',
      rulerBg: dark ? '#141A28' : '#FAFBFD', entity: dark ? '#9FB4E8' : '#2554C7', selected: '#F5A524',
      preview: '#F5A524', osnap: '#17B2C4'
    };
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, cw, ch);

    var minorStep = niceStep(26, state.view.scale);
    var majorStep = minorStep * 5;
    var topLeft = screenToWorld(0, 0), botRight = screenToWorld(cw, ch);
    var xMin = Math.min(topLeft.x, botRight.x), xMax = Math.max(topLeft.x, botRight.x);
    var yMin = Math.min(topLeft.y, botRight.y), yMax = Math.max(topLeft.y, botRight.y);

    ctx.lineWidth = 1; ctx.strokeStyle = col.minor;
    ctx.beginPath();
    var xs = Math.ceil(xMin / minorStep) * minorStep;
    for (var gx = xs; gx <= xMax; gx += minorStep) { var sx = Math.round(worldToScreen(gx, 0).x) + 0.5; ctx.moveTo(sx, RULER_SIZE); ctx.lineTo(sx, ch); }
    var ys = Math.ceil(yMin / minorStep) * minorStep;
    for (var gy = ys; gy <= yMax; gy += minorStep) { var sy = Math.round(worldToScreen(0, gy).y) + 0.5; ctx.moveTo(RULER_SIZE, sy); ctx.lineTo(cw, sy); }
    ctx.stroke();

    ctx.strokeStyle = col.major;
    ctx.beginPath();
    var xM = Math.ceil(xMin / majorStep) * majorStep;
    for (var gx2 = xM; gx2 <= xMax; gx2 += majorStep) { var sx2 = Math.round(worldToScreen(gx2, 0).x) + 0.5; ctx.moveTo(sx2, RULER_SIZE); ctx.lineTo(sx2, ch); }
    var yM = Math.ceil(yMin / majorStep) * majorStep;
    for (var gy2 = yM; gy2 <= yMax; gy2 += majorStep) { var sy2 = Math.round(worldToScreen(0, gy2).y) + 0.5; ctx.moveTo(RULER_SIZE, sy2); ctx.lineTo(cw, sy2); }
    ctx.stroke();

    ctx.strokeStyle = col.axis; ctx.lineWidth = 1.5;
    var origin = worldToScreen(0, 0);
    ctx.beginPath();
    if (origin.x >= RULER_SIZE && origin.x <= cw) { ctx.moveTo(Math.round(origin.x) + 0.5, RULER_SIZE); ctx.lineTo(Math.round(origin.x) + 0.5, ch); }
    if (origin.y >= RULER_SIZE && origin.y <= ch) { ctx.moveTo(RULER_SIZE, Math.round(origin.y) + 0.5); ctx.lineTo(cw, Math.round(origin.y) + 0.5); }
    ctx.stroke();

    /* ── เอนทิตี้ ── */
    function strokePolylinePts(pts, closed) {
      if (pts.length < 2) return;
      ctx.beginPath();
      var s0 = worldToScreen(pts[0].x, pts[0].y); ctx.moveTo(s0.x, s0.y);
      for (var i = 1; i < pts.length; i++) { var s = worldToScreen(pts[i].x, pts[i].y); ctx.lineTo(s.x, s.y); }
      if (closed) ctx.closePath();
      ctx.stroke();
    }
    state.entities.forEach(function (e) {
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      var selected = e.id === state.selectedId;
      ctx.strokeStyle = selected ? col.selected : (layer.color || col.entity);
      ctx.lineWidth = selected ? 2.5 : 1.6;
      if (e.type === 'line') strokePolylinePts([e.p1, e.p2], false);
      else if (e.type === 'polyline') strokePolylinePts(e.points, !!e.closed);
      else if (e.type === 'rect') strokePolylinePts(rectCorners(e), true);
      else if (e.type === 'circle') {
        var c0 = worldToScreen(e.center.x, e.center.y);
        ctx.beginPath(); ctx.ellipse(c0.x, c0.y, e.radius * state.view.scale, e.radius * state.view.scale, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (e.type === 'arc') strokePolylinePts(arcPoints(e), false);
      if (selected) {
        ctx.fillStyle = col.selected;
        entitySnapPoints(e).filter(function (sp) { return sp.kind === 'end' || sp.kind === 'center'; }).forEach(function (sp) {
          var p = worldToScreen(sp.p.x, sp.p.y);
          ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
        });
      }
    });

    /* ── พรีวิวเอนทิตี้ที่กำลังวาดอยู่ ── */
    var eff = (state.tool !== 'select' && state._cursorWorld) ? effectivePoint(applyOrtho(state._cursorWorld)) : null;
    if (eff && state.pendingPoints.length) {
      var anchor = state.pendingPoints[state.pendingPoints.length - 1];
      ctx.strokeStyle = col.preview; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
      if (state.tool === 'line' || state.tool === 'polyline') {
        var s1 = worldToScreen(anchor.x, anchor.y), s2 = worldToScreen(eff.x, eff.y);
        ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
        if (state.tool === 'polyline' && state.pendingPoints.length > 1) {
          ctx.setLineDash([]); strokePolylinePts(state.pendingPoints, false); ctx.setLineDash([5, 4]);
        }
      } else if (state.tool === 'rect') {
        strokePolylinePts(rectCorners({ p1: anchor, p2: eff }), true);
      } else if (state.tool === 'circle') {
        var cc = worldToScreen(anchor.x, anchor.y), r = Math.hypot(eff.x - anchor.x, eff.y - anchor.y) * state.view.scale;
        ctx.beginPath(); ctx.ellipse(cc.x, cc.y, r, r, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (state.tool === 'arc' && state.pendingPoints.length === 1) {
        var s1b = worldToScreen(anchor.x, anchor.y), s2b = worldToScreen(eff.x, eff.y);
        ctx.beginPath(); ctx.moveTo(s1b.x, s1b.y); ctx.lineTo(s2b.x, s2b.y); ctx.stroke();
      } else if (state.tool === 'arc' && state.pendingPoints.length === 2) {
        var arcDef = computeArcFrom3Points(state.pendingPoints[0], state.pendingPoints[1], eff);
        if (arcDef) strokePolylinePts(arcPoints(arcDef), false);
      }
      ctx.setLineDash([]);
      ctx.fillStyle = col.preview;
      state.pendingPoints.forEach(function (p) { var ps = worldToScreen(p.x, p.y); ctx.beginPath(); ctx.arc(ps.x, ps.y, 3, 0, Math.PI * 2); ctx.fill(); });
    }

    /* ── ตัวชี้จุดสแนป (จับจุดวัตถุ/กริด) ── */
    if (eff) {
      var epx = worldToScreen(eff.x, eff.y), s = 6;
      if (eff.snapKind) {
        ctx.strokeStyle = col.osnap; ctx.lineWidth = 1.6;
        ctx.beginPath();
        if (eff.snapKind === 'end') ctx.rect(epx.x - s, epx.y - s, s * 2, s * 2);
        else if (eff.snapKind === 'mid') { ctx.moveTo(epx.x, epx.y - s); ctx.lineTo(epx.x + s, epx.y + s); ctx.lineTo(epx.x - s, epx.y + s); ctx.closePath(); }
        else if (eff.snapKind === 'center') ctx.arc(epx.x, epx.y, s, 0, Math.PI * 2);
        else if (eff.snapKind === 'int') { ctx.moveTo(epx.x - s, epx.y - s); ctx.lineTo(epx.x + s, epx.y + s); ctx.moveTo(epx.x + s, epx.y - s); ctx.lineTo(epx.x - s, epx.y + s); }
        else if (eff.snapKind === 'perp') { ctx.moveTo(epx.x - s, epx.y + s); ctx.lineTo(epx.x - s, epx.y - s); ctx.lineTo(epx.x + s, epx.y - s); }
        ctx.stroke();
      } else if (state.snapOn) {
        ctx.strokeStyle = col.preview; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(epx.x - 5, epx.y); ctx.lineTo(epx.x + 5, epx.y); ctx.moveTo(epx.x, epx.y - 5); ctx.lineTo(epx.x, epx.y + 5); ctx.stroke();
      }
    }

    /* ── ไม้บรรทัด (วาดทับกริด/เอนทิตี้ทีหลังสุดเสมอ กันโดนเส้นทะลุขึ้นมา) ── */
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  function updateUndoRedoUI() { $('undoBtn').disabled = state.history.length === 0; $('redoBtn').disabled = state.redoStack.length === 0; }
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

  function hitTestEntity(worldPt) {
    var thresholdMm = HIT_PX / state.view.scale;
    var best = null, bestDist = Infinity;
    state.entities.forEach(function (e) {
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      var d = distPointToEntity(worldPt, e);
      if (d < thresholdMm && d < bestDist) { bestDist = d; best = e.id; }
    });
    return best;
  }

  /* ══════════════════ ซูม/แพน ══════════════════ */
  function zoomAt(screenX, screenY, factor) {
    var before = screenToWorld(screenX, screenY);
    state.view.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.view.scale * factor));
    var after = screenToWorld(screenX, screenY);
    state.view.cx += before.x - after.x; state.view.cy += before.y - after.y;
    updateZoomUI(); render();
  }
  function updateZoomUI() { $('statZoom').textContent = Math.round(state.view.scale / BASE_SCALE * 100) + '%'; }
  function zoomFit() {
    if (!state.entities.length) { state.view = { cx: 0, cy: 0, scale: 0.5 }; updateZoomUI(); render(); return; }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.entities.forEach(function (e) {
      entityBoundsPoints(e).forEach(function (p) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; });
    });
    var w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
    var pad = 1.15;
    var availW = Math.max(50, state.cw - RULER_SIZE - 20), availH = Math.max(50, state.ch - RULER_SIZE - 20);
    state.view.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(availW / (w * pad), availH / (h * pad))));
    state.view.cx = (minX + maxX) / 2; state.view.cy = (minY + maxY) / 2;
    updateZoomUI(); render();
  }

  /* ══════════════════ เครื่องมือวาด ══════════════════ */
  var TOOL_BTN_IDS = { select: 'toolSelectBtn', line: 'toolLineBtn', polyline: 'toolPolylineBtn', rect: 'toolRectBtn', circle: 'toolCircleBtn', arc: 'toolArcBtn' };
  function setTool(tool) {
    state.tool = tool; state.pendingPoints = [];
    Object.keys(TOOL_BTN_IDS).forEach(function (k) { $(TOOL_BTN_IDS[k]).classList.toggle('active', k === tool); });
    viewport.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    updatePreciseRowUI();
    render();
  }
  function updatePreciseRowUI() {
    var show = state.tool !== 'select' && state.pendingPoints.length > 0;
    preciseRow.classList.toggle('show', show);
    var showFinish = state.tool === 'polyline' && state.pendingPoints.length >= 2;
    finishPolyBtn.classList.toggle('show', showFinish);
    if (!show) { distInput.value = ''; angInput.value = ''; }
  }
  function clearPreciseInputs() { distInput.value = ''; angInput.value = ''; }
  function cancelDrawing() { state.pendingPoints = []; updatePreciseRowUI(); render(); }
  function finishDrawing() { state.pendingPoints = []; updatePreciseRowUI(); }
  function finishPolyline() {
    if (state.pendingPoints.length >= 2) {
      pushHistory();
      state.entities.push({ id: genId(), type: 'polyline', layer: state.activeLayer, points: state.pendingPoints.slice(), closed: false });
      updateCountUI(); scheduleSave();
    }
    finishDrawing(); render();
  }

  /* จุดเดียวที่ทั้งคลิกเมาส์/แตะนิ้ว/พิมพ์ระยะเป๊ะ เรียกร่วมกัน — รับประกันว่าทุกทางเข้าได้ผลลัพธ์เดียวกัน */
  function handlePointInput(pt) {
    if (state.tool === 'line' || state.tool === 'rect') {
      if (!state.pendingPoints.length) { state.pendingPoints = [pt]; }
      else {
        var a = state.pendingPoints[0];
        if (Math.hypot(a.x - pt.x, a.y - pt.y) > DUP_EPS) {
          pushHistory();
          if (state.tool === 'line') state.entities.push({ id: genId(), type: 'line', layer: state.activeLayer, p1: a, p2: pt });
          else state.entities.push({ id: genId(), type: 'rect', layer: state.activeLayer, p1: a, p2: pt });
          updateCountUI(); scheduleSave();
        }
        finishDrawing();
      }
    } else if (state.tool === 'circle') {
      if (!state.pendingPoints.length) { state.pendingPoints = [pt]; }
      else {
        var c = state.pendingPoints[0], r = Math.hypot(pt.x - c.x, pt.y - c.y);
        if (r > DUP_EPS) {
          pushHistory();
          state.entities.push({ id: genId(), type: 'circle', layer: state.activeLayer, center: c, radius: r });
          updateCountUI(); scheduleSave();
        }
        finishDrawing();
      }
    } else if (state.tool === 'arc') {
      state.pendingPoints.push(pt);
      if (state.pendingPoints.length >= 3) {
        var arcDef = computeArcFrom3Points(state.pendingPoints[0], state.pendingPoints[1], state.pendingPoints[2]);
        if (arcDef) {
          pushHistory();
          state.entities.push({ id: genId(), type: 'arc', layer: state.activeLayer, center: arcDef.center, radius: arcDef.radius, startAngle: arcDef.startAngle, endAngle: arcDef.endAngle });
          updateCountUI(); scheduleSave();
        }
        finishDrawing();
      } else updatePreciseRowUI();
    } else if (state.tool === 'polyline') {
      var last = state.pendingPoints[state.pendingPoints.length - 1];
      if (!last || Math.hypot(last.x - pt.x, last.y - pt.y) > DUP_EPS) state.pendingPoints.push(pt);
    }
    updatePreciseRowUI();
    clearPreciseInputs();
    render();
  }

  /* ระยะ/มุมที่พิมพ์ในกล่องอินพุต -> คำนวณจุดถัดไปจากจุดยึดปัจจุบัน แล้วส่งเข้า handlePointInput เหมือนคลิกจริง
     คืนค่า true ถ้าใช้ค่าที่พิมพ์ไปจริง (ให้ผู้เรียกรู้ว่าไม่ต้องทำอย่างอื่นซ้อน เช่น จบพอลีไลน์) */
  function commitPreciseInput() {
    if (!state.pendingPoints.length) return false;
    var distStr = distInput.value.trim();
    if (!distStr) return false;
    var dist = parseFloat(distStr);
    if (!isFinite(dist) || dist <= 0) return false;
    var anchor = state.pendingPoints[state.pendingPoints.length - 1];
    if (state.tool === 'circle') { handlePointInput({ x: anchor.x + dist, y: anchor.y }); return true; }
    var angStr = angInput.value.trim(), angleDeg;
    if (angStr && isFinite(parseFloat(angStr))) angleDeg = parseFloat(angStr);
    else {
      var raw = state._cursorWorld || { x: anchor.x + 1, y: anchor.y };
      var orthoed = applyOrtho(raw);
      angleDeg = Math.atan2(orthoed.y - anchor.y, orthoed.x - anchor.x) * 180 / Math.PI;
    }
    var rad = angleDeg * Math.PI / 180;
    handlePointInput({ x: anchor.x + dist * Math.cos(rad), y: anchor.y + dist * Math.sin(rad) });
    return true;
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
  var panState = null;
  function updateCoordUI(w) { $('statCoord').textContent = 'X ' + w.x.toFixed(1) + ', Y ' + w.y.toFixed(1) + ' ' + t('mmUnit'); }
  function eventScreenPos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('mousemove', function (e) {
    var sp = eventScreenPos(e);
    state._cursorScreen = sp; state._cursorWorld = screenToWorld(sp.x, sp.y);
    var eff = state.tool !== 'select' ? effectivePoint(applyOrtho(state._cursorWorld)) : snapPoint(state._cursorWorld);
    updateCoordUI(eff);
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
    var raw = screenToWorld(sp.x, sp.y);
    if (state.tool === 'select') { state.selectedId = hitTestEntity(raw); updateSelectionUI(); render(); return; }
    handlePointInput(effectivePoint(applyOrtho(raw)));
  });
  canvas.addEventListener('dblclick', function (e) {
    if (state.tool !== 'polyline') return;
    e.preventDefault();
    if (state.pendingPoints.length >= 2) {
      var n = state.pendingPoints.length, a = state.pendingPoints[n - 1], b = state.pendingPoints[n - 2];
      if (Math.hypot(a.x - b.x, a.y - b.y) < (3 / state.view.scale)) state.pendingPoints.pop();
    }
    finishPolyline();
  });
  window.addEventListener('mouseup', function () { if (panState) { panState = null; viewport.style.cursor = state.tool === 'select' ? 'default' : 'crosshair'; } });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var sp = eventScreenPos(e);
    zoomAt(sp.x, sp.y, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });

  /* ══════════════════ อินพุตนิ้ว (มือถือ/แท็บเล็ต) ══════════════════ */
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
      var mid2 = touchState.mid, before = screenToWorld(mid2.x, mid2.y);
      state.view.scale = newScale;
      var after = screenToWorld(mid2.x, mid2.y);
      state.view.cx = touchState.startCx + (before.x - after.x); state.view.cy = touchState.startCy + (before.y - after.y);
      updateZoomUI(); render();
    }
  }, { passive: false });
  canvas.addEventListener('touchend', function (e) {
    if (touchState && touchState.mode === 'pan1' && !touchState.moved && Date.now() - touchState.startTime < 500) {
      var raw = { x: (touchState.startX - state.cw / 2) / state.view.scale + state.view.cx, y: -(touchState.startY - state.ch / 2) / state.view.scale + state.view.cy };
      if (state.tool === 'select') { state.selectedId = hitTestEntity(raw); updateSelectionUI(); }
      else handlePointInput(effectivePoint(applyOrtho(raw)));
      render();
    }
    touchState = null;
  });

  /* ══════════════════ คีย์ลัด + ระบบพิมพ์ตัวเลขได้ทันที ══════════════════
     ระหว่างวาด (มีจุดยึดค้างอยู่) พิมพ์เลข/จุด/ลบได้เลยโดยไม่ต้องคลิกช่องอินพุตก่อน — คีย์นั้นจะถูก "โยน"
     ไปที่ช่องระยะให้อัตโนมัติ เหมือนโปรแกรม CAD ทั่วไป (Dynamic Input) */
  window.addEventListener('keydown', function (e) {
    var tag = document.activeElement.tagName;
    var typingInField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (!typingInField && e.key === 'F8') { e.preventDefault(); toggleOrtho(); return; }
    if (!typingInField && e.key === 'Escape') { if (state.pendingPoints.length) { e.preventDefault(); cancelDrawing(); } return; }
    if (!typingInField && (e.key === 'Delete' || e.key === 'Backspace') && state.tool === 'select' && state.selectedId) { e.preventDefault(); deleteSelected(); return; }
    if (!typingInField && e.key === 'Backspace' && state.pendingPoints.length) {
      e.preventDefault();
      state.pendingPoints.pop(); updatePreciseRowUI(); render();
      return;
    }
    if (!typingInField && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (!typingInField && (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); return; }
    if (!typingInField && state.pendingPoints.length && state.tool !== 'select' && /^[0-9.\-]$/.test(e.key)) {
      e.preventDefault();
      distInput.value = e.key;
      distInput.focus();
      try { distInput.setSelectionRange(1, 1); } catch (er) {}
    }
  });
  [distInput, angInput].forEach(function (inp) {
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var ok = commitPreciseInput();
        if (!ok && state.tool === 'polyline' && state.pendingPoints.length >= 2) finishPolyline();
      } else if (e.key === 'Escape') { e.preventDefault(); cancelDrawing(); inp.blur(); }
      else if (e.key === 'Tab' && inp === distInput) { e.preventDefault(); angInput.focus(); angInput.select(); }
    });
  });
  function toggleOrtho() { state.orthoOn = !state.orthoOn; $('orthoToggleBtn').classList.toggle('active', state.orthoOn); render(); }

  /* ══════════════════ wiring ปุ่ม ══════════════════ */
  Object.keys(TOOL_BTN_IDS).forEach(function (k) { $(TOOL_BTN_IDS[k]).addEventListener('click', function () { setTool(k); }); });
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('deleteBtn').addEventListener('click', deleteSelected);
  $('clearAllBtn').addEventListener('click', clearAll);
  $('zoomInBtn').addEventListener('click', function () { zoomAt(state.cw / 2, state.ch / 2, 1.25); });
  $('zoomOutBtn').addEventListener('click', function () { zoomAt(state.cw / 2, state.ch / 2, 1 / 1.25); });
  $('zoomFitBtn').addEventListener('click', zoomFit);
  $('snapToggleBtn').addEventListener('click', function () { state.snapOn = !state.snapOn; $('snapToggleBtn').classList.toggle('active', state.snapOn); render(); });
  $('snapStepSel').addEventListener('change', function () { state.snapStep = +this.value || 10; render(); });
  $('osnapToggleBtn').addEventListener('click', function () { state.osnapOn = !state.osnapOn; $('osnapToggleBtn').classList.toggle('active', state.osnapOn); render(); });
  $('orthoToggleBtn').addEventListener('click', toggleOrtho);
  $('finishPolylineBtn').addEventListener('click', finishPolyline);
  var langToggle = $('langToggle');
  if (langToggle) langToggle.addEventListener('click', function () { setUILang(getUILang() === 'en' ? 'th' : 'en'); applyStaticI18n(); });

  /* ══════════════════ init ══════════════════ */
  function boot() {
    applyStaticI18n();
    restoreAutosave();
    $('snapToggleBtn').classList.toggle('active', state.snapOn);
    $('osnapToggleBtn').classList.toggle('active', state.osnapOn);
    $('orthoToggleBtn').classList.toggle('active', state.orthoOn);
    updateUndoRedoUI(); updateSelectionUI(); updateCountUI(); updateZoomUI();
    resizeCanvas();
  }
  var rsz = null;
  window.addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(resizeCanvas, 120); });
  function whenReady(fn) {
    var fire = function () { requestAnimationFrame(function () { requestAnimationFrame(fn); }); };
    if (document.readyState === 'complete') fire(); else window.addEventListener('load', fire, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  whenReady(resizeCanvas);
})();
