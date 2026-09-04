/* ══════════════════════════════════════════════════════════════════
   Tanot — cad.js (งานเขียนแบบ CAD, Stage 1+2+3+4)
   Stage 1: ระบบพิกัดโลกมิลลิเมตรจริง, แพน/ซูม, กริด+ไม้บรรทัด, สแนปกริด, โมเดล entity/layer
   ทั่วไป, เครื่องมือเส้น, undo/redo, บันทึกอัตโนมัติ
   Stage 2: ชนิดเอนทิตี้ครบ (polyline/สี่เหลี่ยม/วงกลม/ส่วนโค้ง), ใส่ระยะ-มุมเป๊ะๆ, จับจุด
   วัตถุ (osnap), โหมดตั้งฉาก (ortho)
   Stage 3: เลือกได้หลายชิ้น (shift-คลิก/ลากเลือกเป็นกลุ่ม), จุดจับ (grips) ลากแก้รูปทรง
   ตรงๆ, แผงคุณสมบัติ (แก้พิกัด/รัศมี/มุมตรงๆ), เครื่องมือแก้ไข: ย้าย/คัดลอก/หมุน/มิเรอร์/
   สเกล/ตัดเส้น(trim)/ต่อเส้น(extend)/มุมโค้ง(fillet)/ออฟเซ็ต/อาเรย์สี่เหลี่ยม
   Stage 4: ใส่มิติเส้น (linear dimension) + มิติรัศมี (radius dimension) + คำอธิบายข้อความ
   (text annotation), แผงจัดการเลเยอร์เต็มรูปแบบ (เพิ่ม/ลบ/เปลี่ยนชื่อ/สี/ซ่อน/ล็อก/ย้าย
   เอนทิตี้ข้ามเลเยอร์)
   Stage 5: ส่งออกแบบเป็น PNG (แรสเตอร์)/SVG (เวกเตอร์ สเกลจริงหน่วย มม.)/DXF (มาตรฐานแลกเปลี่ยนไฟล์ CAD
   ใช้เปิดต่อในโปรแกรมอื่นได้), นำเข้าไฟล์ DXF (LINE/CIRCLE/ARC/LWPOLYLINE/TEXT), พิมพ์/บันทึกเป็น PDF
   ผ่านกลไกพิมพ์ของเบราว์เซอร์
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
      hintText: '🖱️ ลากขวา/กลาง หรือลากด้วยนิ้วเพื่อเลื่อนมุมมอง · หมุนล้อเมาส์/บีบสองนิ้วเพื่อซูม · เลือกเครื่องมือวาดแล้วคลิกจุดตามลำดับ · พิมพ์ตัวเลขได้ทันทีระหว่างวาดเพื่อใส่ระยะเป๊ะ · Shift+คลิกหรือลากคลุมเพื่อเลือกหลายชิ้น · ลากจุดสี่เหลี่ยมบนเอนทิตี้ที่เลือกเพื่อแก้รูปทรงตรงๆ · Esc ยกเลิก · Delete ลบที่เลือก · F8 สลับโหมดตั้งฉาก',
      mmUnit: 'มม.',
      autosaveSaved: 'บันทึกอัตโนมัติแล้ว', restoredDraft: 'กู้คืนแบบร่างล่าสุดที่บันทึกอัตโนมัติไว้',
      clearConfirm: 'ล้างทั้งหมด? ทุกเอนทิตี้ในแบบนี้จะถูกลบ (ยังกด "เลิกทำ" ย้อนกลับได้)',
      snapEnd: 'ปลาย', snapMid: 'กึ่งกลาง', snapCenter: 'ศูนย์กลาง', snapInt: 'จุดตัด', snapPerp: 'ตั้งฉาก',
      toolMove: '✥ ย้าย', toolCopy: '⧉ คัดลอก', toolRotate: '↻ หมุน', toolMirror: '⇋ มิเรอร์',
      mirrorKeepToggle: '🗐 เก็บต้นฉบับ', toolScale: '⤢ สเกล',
      toolTrim: '✂️ ตัดเส้น', toolExtend: '⤴ ต่อเส้น', toolFillet: '◠ มุมโค้ง', toolOffset: '∥ ออฟเซ็ต',
      toolArrayRect: '▦ อาเรย์',
      radiusLbl: 'รัศมี (มม.)', rotAngLbl: 'มุมหมุน (°)', scaleFactorLbl: 'อัตราส่วนสเกล',
      offsetDistLbl: 'ระยะออฟเซ็ต (มม.)', filletRadiusLbl: 'รัศมีมุมโค้ง (มม.)',
      transformHint: 'คลิกจุดฐาน แล้วคลิก/พิมพ์ค่าเพื่อยืนยัน',
      mirrorHint: 'คลิก 2 จุดกำหนดแนวมิเรอร์',
      trimHint: 'คลิกเส้นตัด (cutting edge) ก่อน แล้วคลิกส่วนของเส้นอื่นที่จะตัดออก',
      extendHint: 'คลิกเส้นขอบ (boundary) ก่อน แล้วคลิกปลายเส้นที่จะต่อให้ไปชน',
      filletHintPick: 'คลิกเลือกเส้นตรง 2 เส้นที่จะทำมุมโค้ง',
      filletHintRadius: 'พิมพ์รัศมีแล้วกด Enter เพื่อสร้างมุมโค้ง',
      offsetHintPick: 'คลิกเอนทิตี้ที่จะออฟเซ็ต',
      offsetHintSide: 'พิมพ์ระยะ (ไม่บังคับ) แล้วคลิกด้านที่ต้องการ',
      arrRowsLbl: 'แถว', arrColsLbl: 'คอลัมน์', arrSpXLbl: 'ห่างแนวนอน (มม.)', arrSpYLbl: 'ห่างแนวตั้ง (มม.)',
      arrApplyBtn: '✔️ แทรกอาเรย์', arrayHint: 'เลือกเอนทิตี้ก่อน แล้วกำหนดจำนวนแถว/คอลัมน์และระยะห่าง',
      propsTitleLine: 'คุณสมบัติ: เส้น', propsTitlePolyline: 'คุณสมบัติ: พอลีไลน์', propsTitleRect: 'คุณสมบัติ: สี่เหลี่ยม',
      propsTitleCircle: 'คุณสมบัติ: วงกลม', propsTitleArc: 'คุณสมบัติ: ส่วนโค้ง',
      propX1: 'X1 (มม.)', propY1: 'Y1 (มม.)', propX2: 'X2 (มม.)', propY2: 'Y2 (มม.)',
      propCx: 'ศูนย์กลาง X (มม.)', propCy: 'ศูนย์กลาง Y (มม.)', propR: 'รัศมี (มม.)',
      propStartDeg: 'มุมเริ่ม (°)', propEndDeg: 'มุมจบ (°)',
      propPolylineNote: 'พอลีไลน์มี {n} จุด — ลากจุดสี่เหลี่ยมบนเส้นเพื่อแก้แต่ละจุดโดยตรง',
      selCountLbl: 'เลือกอยู่ {n} ชิ้น',
      toolDim: '📏 มิติเส้น', toolRaddim: '⌀ มิติรัศมี', toolText: '🅰️ ข้อความ',
      dimHint: 'คลิก 2 จุดที่จะวัดระยะ แล้วคลิกจุดที่ 3 เพื่อวางเส้นมิติ',
      raddimHint: 'คลิกวงกลมหรือส่วนโค้งที่จะใส่มิติรัศมี',
      textContentLbl: 'ข้อความ', textHeightLbl: 'ความสูงตัวอักษร (มม.)', textApplyBtn: '✔️ วางข้อความ',
      textHint: 'คลิกตำแหน่งที่จะวางข้อความ แล้วพิมพ์ข้อความ',
      propsTitleDim: 'คุณสมบัติ: มิติเส้น', propsTitleRaddim: 'คุณสมบัติ: มิติรัศมี', propsTitleText: 'คุณสมบัติ: ข้อความ',
      propText: 'ข้อความ', propHeight: 'ความสูงตัวอักษร (มม.)', propLayer: 'เลเยอร์',
      layersTitle: 'เลเยอร์', layerAddBtn: '➕ เลเยอร์ใหม่', layerNamePlaceholder: 'ชื่อเลเยอร์',
      layerActiveLbl: 'ใช้งานอยู่', layerDeleteConfirm: 'ลบเลเยอร์ "{name}"? เอนทิตี้ในเลเยอร์นี้จะถูกย้ายไปเลเยอร์ 0',
      layerCantDeleteLast: 'ต้องมีอย่างน้อย 1 เลเยอร์',
      exportPngBtn: '📷 PNG', exportSvgBtn: '🗺️ SVG', exportDxfBtn: '📐 DXF', importDxfBtn: '📥 นำเข้า DXF',
      printBtn: '🖨️ พิมพ์/PDF',
      exportEmptyWarn: 'ยังไม่มีเอนทิตี้ให้ส่งออก (หรือทุกเลเยอร์ถูกซ่อนอยู่)',
      popupBlocked: 'เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — กรุณาอนุญาตป๊อปอัปสำหรับเว็บนี้แล้วลองใหม่',
      importDxfSuccess: 'นำเข้า {n} เอนทิตี้จากไฟล์ DXF เรียบร้อย (ถูกเลือกไว้ให้แล้ว)',
      importDxfError: 'อ่านไฟล์นี้ไม่ได้ — ไม่ใช่ไฟล์ DXF หรือไฟล์เสียหาย',
      importDxfEmpty: 'ไม่พบเอนทิตี้ที่รองรับในไฟล์ DXF นี้ (รองรับ LINE/CIRCLE/ARC/LWPOLYLINE/TEXT)'
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
      hintText: '🖱️ Right/middle-drag or drag with a finger to pan · scroll wheel / pinch to zoom · pick a draw tool then click points in order · type a number any time while drawing for a precise distance · Shift+click or drag a box to select multiple · drag a square grip on a selected entity to reshape it directly · Esc cancels · Delete removes selection · F8 toggles ortho',
      mmUnit: 'mm',
      autosaveSaved: 'Autosaved', restoredDraft: 'Restored your last autosaved draft',
      clearConfirm: 'Clear everything? Every entity in this drawing will be removed (you can still Undo).',
      snapEnd: 'endpoint', snapMid: 'midpoint', snapCenter: 'center', snapInt: 'intersection', snapPerp: 'perpendicular',
      toolMove: '✥ Move', toolCopy: '⧉ Copy', toolRotate: '↻ Rotate', toolMirror: '⇋ Mirror',
      mirrorKeepToggle: '🗐 Keep original', toolScale: '⤢ Scale',
      toolTrim: '✂️ Trim', toolExtend: '⤴ Extend', toolFillet: '◠ Fillet', toolOffset: '∥ Offset',
      toolArrayRect: '▦ Array',
      radiusLbl: 'Radius (mm)', rotAngLbl: 'Rotation angle (°)', scaleFactorLbl: 'Scale factor',
      offsetDistLbl: 'Offset distance (mm)', filletRadiusLbl: 'Fillet radius (mm)',
      transformHint: 'Click a base point, then click/type a value to confirm',
      mirrorHint: 'Click 2 points to define the mirror line',
      trimHint: 'Click the cutting edge first, then click the part of another line to trim away',
      extendHint: 'Click the boundary edge first, then click the end of a line to extend it to meet it',
      filletHintPick: 'Click 2 straight lines to fillet',
      filletHintRadius: 'Type a radius and press Enter to create the fillet',
      offsetHintPick: 'Click the entity to offset',
      offsetHintSide: 'Type a distance (optional), then click the side you want',
      arrRowsLbl: 'Rows', arrColsLbl: 'Columns', arrSpXLbl: 'X spacing (mm)', arrSpYLbl: 'Y spacing (mm)',
      arrApplyBtn: '✔️ Insert array', arrayHint: 'Select entities first, then set rows/columns and spacing',
      propsTitleLine: 'Properties: Line', propsTitlePolyline: 'Properties: Polyline', propsTitleRect: 'Properties: Rectangle',
      propsTitleCircle: 'Properties: Circle', propsTitleArc: 'Properties: Arc',
      propX1: 'X1 (mm)', propY1: 'Y1 (mm)', propX2: 'X2 (mm)', propY2: 'Y2 (mm)',
      propCx: 'Center X (mm)', propCy: 'Center Y (mm)', propR: 'Radius (mm)',
      propStartDeg: 'Start angle (°)', propEndDeg: 'End angle (°)',
      propPolylineNote: 'Polyline has {n} points — drag a square grip on the line to edit each point directly',
      selCountLbl: '{n} selected',
      toolDim: '📏 Dimension', toolRaddim: '⌀ Radius dim', toolText: '🅰️ Text',
      dimHint: 'Click 2 points to measure, then click a 3rd point to place the dimension line',
      raddimHint: 'Click a circle or arc to add a radius dimension',
      textContentLbl: 'Text', textHeightLbl: 'Text height (mm)', textApplyBtn: '✔️ Place text',
      textHint: 'Click where to place the text, then type it in',
      propsTitleDim: 'Properties: Dimension', propsTitleRaddim: 'Properties: Radius dim', propsTitleText: 'Properties: Text',
      propText: 'Text', propHeight: 'Text height (mm)', propLayer: 'Layer',
      layersTitle: 'Layers', layerAddBtn: '➕ New layer', layerNamePlaceholder: 'Layer name',
      layerActiveLbl: 'Active', layerDeleteConfirm: 'Delete layer "{name}"? Its entities will move to layer 0',
      layerCantDeleteLast: 'At least 1 layer is required',
      exportPngBtn: '📷 PNG', exportSvgBtn: '🗺️ SVG', exportDxfBtn: '📐 DXF', importDxfBtn: '📥 Import DXF',
      printBtn: '🖨️ Print/PDF',
      exportEmptyWarn: 'Nothing to export yet (or every layer is hidden)',
      popupBlocked: 'Your browser blocked the print window — please allow pop-ups for this site and try again',
      importDxfSuccess: 'Imported {n} entities from the DXF file (now selected)',
      importDxfError: "Couldn't read this file — not a DXF file, or it's corrupted",
      importDxfEmpty: 'No supported entities found in this DXF file (supports LINE/CIRCLE/ARC/LWPOLYLINE/TEXT)'
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
    layers: { '0': { name: 'เลเยอร์ 0', color: null, visible: true, locked: false } }, // color:null = ใช้สีธีมอัตโนมัติ (col.entity ใน render()) แทนสีตายตัว กันปัญหามองไม่เห็นตอนสลับโหมดมืด
    layerSeq: 1,             // ตัวนับสำหรับตั้งชื่อ id เลเยอร์ใหม่ถัดไป ('1','2',...)
    activeLayer: '0',
    view: { cx: 0, cy: 0, scale: 0.5 }, // cx,cy = พิกัดโลก (mm) ที่อยู่กึ่งกลางจอ, scale = px ต่อ mm
    tool: 'select',         // 'select' | เครื่องมือวาด | 'move'|'copy'|'rotate'|'mirror'|'scale'|'trim'|'extend'|'fillet'|'offset'|'arrayrect'|'dim'|'raddim'|'text'
    selectedIds: [],         // Stage 3: เลือกได้หลายชิ้น (เดิม Stage 1-2 เป็น selectedId เดี่ยว)
    snapOn: true, snapStep: 10,
    osnapOn: true, orthoOn: false,
    mirrorKeepOriginal: true,
    textDefaultHeight: 12,   // ความสูงตัวอักษรเริ่มต้น (มม.) สำหรับเครื่องมือข้อความ
    pendingPoints: [],       // จุดที่คลิกไปแล้วระหว่างวาด/ย้าย/หมุน/มิเรอร์/มิติเส้นเอนทิตี้ปัจจุบัน
    pendingEntityIds: [],    // เอนทิตี้ที่คลิกเลือกไว้แล้วสำหรับเครื่องมือ fillet (ต้องการ 2 เส้น)
    trimCutterId: null,      // เอนทิตี้ที่เป็นเส้นตัด/เส้นขอบ สำหรับเครื่องมือ trim/extend
    offsetSourceId: null,    // เอนทิตี้ต้นทางสำหรับเครื่องมือ offset
    gripDrag: null,          // { entityId, ref } ระหว่างลากจุดจับ (grip) แก้รูปทรง
    dragSelect: null,        // { startWorld, startScreen, curScreen, additive } ระหว่างลากเลือกเป็นกลุ่ม
    history: [], redoStack: [],
    cw: 0, ch: 0,            // ขนาด canvas เป็น CSS px (อัปเดตตอน resize)
    _cursorWorld: null, _cursorScreen: null
  };
  var GRIP_PX = 9;           // รัศมีคลิกโดนจุดจับ (grip) เป็นพิกเซล

  /* รูปแบบข้อมูลต่อ type:
     line:     {p1:{x,y}, p2:{x,y}}
     polyline: {points:[{x,y},...], closed:bool}
     rect:     {p1:{x,y}, p2:{x,y}}                         (มุมตรงข้ามกัน แนวแกนตรงเสมอ)
     circle:   {center:{x,y}, radius}
     arc:      {center:{x,y}, radius, startAngle, endAngle} (เรเดียน, กวาดทวนเข็มจาก start ไป end เสมอ)
     dim:      {p1:{x,y}, p2:{x,y}, offset}                 (มิติเส้นตรง — offset = ระยะตั้งฉากมีเครื่องหมาย
                                                              จาก p1-p2 ไปยังตำแหน่งเส้นมิติที่วางจริง)
     raddim:   {center:{x,y}, radius, angle}                (มิติรัศมี — snapshot ค่า ณ ตอนสร้าง ไม่ผูกกับ
                                                              วงกลม/ส่วนโค้งต้นทางอีกต่อไป, angle = ทิศทางขีดนำ)
     text:     {p:{x,y}, text, height}                       (คำอธิบายข้อความ — p คือมุมล่างซ้ายของข้อความ) */

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
  /* มิติเส้น (dim): p1,p2 คือคู่จุดที่วัดระยะ, offset คือระยะตั้งฉากมีเครื่องหมายจากเส้น p1-p2 ไปยัง
     เส้นมิติที่วางจริง — คำนวณจุดปลายเส้นมิติทั้งสอง (dimP1,dimP2) จากค่านี้สดทุกครั้งที่ใช้ ทำให้ย้าย/
     หมุนเอนทิตี้นี้ผ่าน mapEntityPoints (ที่แก้แค่ p1,p2) ได้ผลถูกต้องอัตโนมัติโดยไม่ต้องจัดการ offset เอง */
  function dimLinePoints(e) {
    var dx = e.p2.x - e.p1.x, dy = e.p2.y - e.p1.y, len = Math.hypot(dx, dy);
    var nx = len ? -dy / len : 0, ny = len ? dx / len : 1;
    return {
      dimP1: { x: e.p1.x + nx * e.offset, y: e.p1.y + ny * e.offset },
      dimP2: { x: e.p2.x + nx * e.offset, y: e.p2.y + ny * e.offset },
      n: { x: nx, y: ny }
    };
  }
  function raddimLeaderPoint(e) { return { x: e.center.x + e.radius * Math.cos(e.angle), y: e.center.y + e.radius * Math.sin(e.angle) }; }
  function estimateTextWidth(text, height) { return (text || '').length * height * 0.58; } // ประมาณความกว้าง (ไม่มีการวัดฟอนต์จริงในสเตจนี้)
  function distPointToRect(p, xmin, ymin, xmax, ymax) {
    var dx = Math.max(xmin - p.x, 0, p.x - xmax), dy = Math.max(ymin - p.y, 0, p.y - ymax);
    return Math.hypot(dx, dy);
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
    if (e.type === 'dim') { var dl = dimLinePoints(e); return distPointToSegment(p, dl.dimP1, dl.dimP2); }
    if (e.type === 'raddim') return distPointToSegment(p, e.center, raddimLeaderPoint(e));
    if (e.type === 'text') {
      var w = estimateTextWidth(e.text, e.height);
      return distPointToRect(p, e.p.x, e.p.y, e.p.x + w, e.p.y + e.height);
    }
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
    } else if (e.type === 'dim') {
      var dl0 = dimLinePoints(e);
      pts.push({ p: dl0.dimP1, kind: 'end' }, { p: dl0.dimP2, kind: 'end' });
    } else if (e.type === 'raddim') { pts.push({ p: e.center, kind: 'center' }, { p: raddimLeaderPoint(e), kind: 'end' }); }
    else if (e.type === 'text') { pts.push({ p: e.p, kind: 'end' }); }
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
    return []; // circle/arc/dim/raddim/text ไม่รองรับจุดตัด/ตั้งฉากแบบเส้นตรงในสเตจนี้ (ขอบเขตที่ตัดออกไปก่อน)
  }
  function entityBoundsPoints(e) {
    if (e.type === 'line') return [e.p1, e.p2];
    if (e.type === 'polyline') return e.points;
    if (e.type === 'rect') return [e.p1, e.p2];
    if (e.type === 'circle') return [{ x: e.center.x - e.radius, y: e.center.y - e.radius }, { x: e.center.x + e.radius, y: e.center.y + e.radius }];
    if (e.type === 'arc') { var pts = arcPoints(e, 16); pts.push(e.center); return pts; }
    if (e.type === 'dim') { var dl1 = dimLinePoints(e); return [e.p1, e.p2, dl1.dimP1, dl1.dimP2]; }
    if (e.type === 'raddim') return [e.center, raddimLeaderPoint(e)];
    if (e.type === 'text') { var w2 = estimateTextWidth(e.text, e.height); return [e.p, { x: e.p.x + w2, y: e.p.y + e.height }]; }
    return [];
  }

  /* ══════════════════ เรขาคณิตสำหรับเครื่องมือแก้ไข (ย้าย/หมุน/มิเรอร์/สเกล/ตัด-ต่อเส้น/มุมโค้ง) ══════════════════ */
  function rotateAround(p, base, rad) {
    var dx = p.x - base.x, dy = p.y - base.y, c = Math.cos(rad), s = Math.sin(rad);
    return { x: base.x + dx * c - dy * s, y: base.y + dx * s + dy * c };
  }
  function scaleAround(p, base, factor) { return { x: base.x + (p.x - base.x) * factor, y: base.y + (p.y - base.y) * factor }; }
  function mirrorPointAcrossLine(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, lenSq = dx * dx + dy * dy;
    if (!lenSq) return { x: p.x, y: p.y };
    var tt = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    var projX = a.x + tt * dx, projY = a.y + tt * dy;
    return { x: 2 * projX - p.x, y: 2 * projY - p.y };
  }
  function lineIntersectInfinite(a1, a2, b1, b2) {
    var d1x = a2.x - a1.x, d1y = a2.y - a1.y, d2x = b2.x - b1.x, d2y = b2.y - b1.y;
    var denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) < 1e-9) return null;
    var tt = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom;
    return { x: a1.x + tt * d1x, y: a1.y + tt * d1y };
  }
  /* จุดตัดของ "รังสี" (จุดเริ่ม + ทิศทาง ยิงไม่มีที่สิ้นสุด) กับ "ส่วนของเส้นตรง" ที่มีขอบเขตจริง — ใช้กับ extend
     (ต่อเส้นให้ไปชนขอบ) คืน t (ระยะตามทิศทาง dir จาก origin, ต้องเป็นบวกและอยู่ในขอบเขตของ b ด้วย) */
  function rayIntersectSegment(origin, dir, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var denom = dir.x * dy - dir.y * dx;
    if (Math.abs(denom) < 1e-9) return null;
    var tt = ((a.x - origin.x) * dy - (a.y - origin.y) * dx) / denom;
    var u = ((a.x - origin.x) * dir.y - (a.y - origin.y) * dir.x) / denom;
    if (u < 0 || u > 1) return null;
    return { t: tt, point: { x: origin.x + tt * dir.x, y: origin.y + tt * dir.y } };
  }
  function paramOnLine(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, lenSq = dx * dx + dy * dy;
    return lenSq ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq : 0;
  }
  function pointAtParam(a, b, tt) { return { x: a.x + (b.x - a.x) * tt, y: a.y + (b.y - a.y) * tt }; }
  function vsub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function vnorm(v) { var len = Math.hypot(v.x, v.y); return len ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 }; }
  function vdot(a, b) { return a.x * b.x + a.y * b.y; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* แปลงเอนทิตี้ 'rect' (แกนตรงเสมอ ผูกด้วย p1/p2 มุมตรงข้าม) ให้เป็น polyline ปิด 4 จุด — ต้องทำก่อนหมุน/มิเรอร์
     เสมอ เพราะการหมุน/มิเรอร์ทั่วไปทำให้สี่เหลี่ยมไม่ขนานแกน X/Y อีกต่อไป ซึ่งโมเดล p1/p2 แทนไม่ได้ */
  function rectToPolyline(e) { return { id: e.id, type: 'polyline', layer: e.layer, points: rectCorners(e), closed: true }; }

  /* map ฟังก์ชัน fn ทับทุกจุดของเอนทิตี้ (แก้ e ตรงๆ, ไม่คืนค่าใหม่) — ใช้ร่วมกับ ย้าย/หมุน/มิเรอร์/สเกล
     หมายเหตุ: รัศมีของวงกลม/ส่วนโค้งไม่ถูกแตะโดยฟังก์ชันนี้ (ผู้เรียกต้องจัดการเองถ้าเป็นการสเกล) */
  function mapEntityPoints(e, fn) {
    if (e.type === 'line') { e.p1 = fn(e.p1); e.p2 = fn(e.p2); }
    else if (e.type === 'polyline') { e.points = e.points.map(fn); }
    else if (e.type === 'rect') { e.p1 = fn(e.p1); e.p2 = fn(e.p2); }
    else if (e.type === 'circle') { e.center = fn(e.center); }
    else if (e.type === 'arc') { e.center = fn(e.center); }
    else if (e.type === 'dim') { e.p1 = fn(e.p1); e.p2 = fn(e.p2); }
    else if (e.type === 'raddim') { e.center = fn(e.center); }
    else if (e.type === 'text') { e.p = fn(e.p); }
    return e;
  }

  /* ย้าย/คัดลอก/หมุน/มิเรอร์/สเกล เอนทิตี้ที่เลือกไว้ทั้งหมดพร้อมกัน — ฟังก์ชันกลางตัวเดียว ต่างกันแค่ mods
     mods.duplicate: สร้างสำเนาใหม่แทนแก้ของเดิม (คัดลอก/มิเรอร์แบบเก็บต้นฉบับ)
     mods.rotateDeltaRad: มุมหมุน (เรเดียน) — ใช้ปรับ startAngle/endAngle ของส่วนโค้งด้วย (จุดศูนย์กลางหมุนผ่าน fn อยู่แล้ว)
     mods.mirrorLine: {a,b} เส้นมิเรอร์ — ใช้คำนวณมุมสะท้อนใหม่ของส่วนโค้ง (มิเรอร์กลับทิศทางกวาดด้วย)
     mods.scaleFactor: อัตราส่วนสเกล — ใช้คูณรัศมีวงกลม/ส่วนโค้งด้วย (จุดศูนย์กลางสเกลผ่าน fn อยู่แล้ว)
     mods.convertRect: แปลง rect เป็น polyline ก่อน map จุด (จำเป็นสำหรับหมุน/มิเรอร์ ไม่จำเป็นสำหรับย้าย/สเกล) */
  function transformSelectedEntities(fn, mods) {
    mods = mods || {};
    var selSet = {};
    state.selectedIds.forEach(function (id) { selSet[id] = true; });
    var added = [];
    var updated = state.entities.map(function (e) {
      if (!selSet[e.id]) return e;
      var src = mods.convertRect && e.type === 'rect' ? rectToPolyline(e) : deepClone(e);
      mapEntityPoints(src, fn);
      if (mods.rotateDeltaRad != null && src.type === 'arc') { src.startAngle += mods.rotateDeltaRad; src.endAngle += mods.rotateDeltaRad; }
      if (mods.rotateDeltaRad != null && src.type === 'raddim') src.angle += mods.rotateDeltaRad;
      if (mods.mirrorLine) {
        var phi = Math.atan2(mods.mirrorLine.b.y - mods.mirrorLine.a.y, mods.mirrorLine.b.x - mods.mirrorLine.a.x);
        var reflectAng = function (a) { return 2 * phi - a; };
        if (src.type === 'arc') { var ns = reflectAng(src.endAngle), ne = reflectAng(src.startAngle); src.startAngle = ns; src.endAngle = ne; }
        else if (src.type === 'raddim') src.angle = reflectAng(src.angle);
        else if (src.type === 'dim') src.offset = -src.offset; // มิเรอร์กลับด้าน (chirality) ต้องพลิกเครื่องหมาย offset ด้วย ไม่งั้นเส้นมิติจะไปโผล่ผิดฝั่ง
      }
      if (mods.scaleFactor != null && (src.type === 'circle' || src.type === 'arc' || src.type === 'raddim')) src.radius *= mods.scaleFactor;
      if (mods.scaleFactor != null && src.type === 'dim') src.offset *= mods.scaleFactor;
      if (mods.scaleFactor != null && src.type === 'text') src.height *= mods.scaleFactor;
      if (mods.duplicate) { src.id = genId(); added.push(src); return e; }
      return src;
    });
    state.entities = mods.duplicate ? updated.concat(added) : updated;
    if (mods.duplicate) state.selectedIds = added.map(function (s) { return s.id; });
  }

  /* อาเรย์สี่เหลี่ยม (rectangular array): ทำสำเนาเอนทิตี้ที่เลือกไว้เรียงเป็นตาราง rows×cols ตามระยะห่างที่กำหนด
     (ไม่รวมตำแหน่งเดิมที่ (0,0) ซึ่งคือของเดิมอยู่แล้ว) */
  function doArrayRect(rows, cols, spx, spy) {
    if (!state.selectedIds.length || rows < 1 || cols < 1) return;
    var selSet = {};
    state.selectedIds.forEach(function (id) { selSet[id] = true; });
    var sources = state.entities.filter(function (e) { return selSet[e.id]; });
    if (!sources.length) return;
    var added = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (r === 0 && c === 0) continue;
        (function (dx, dy) {
          sources.forEach(function (e) {
            var clone = deepClone(e); clone.id = genId();
            mapEntityPoints(clone, function (p) { return { x: p.x + dx, y: p.y + dy }; });
            added.push(clone);
          });
        })(c * spx, r * spy);
      }
    }
    pushHistory();
    state.entities = state.entities.concat(added);
    updateCountUI(); scheduleSave(); render();
  }

  /* ตัดเส้น (trim): หาจุดตัดทั้งหมดของ lineEntity กับส่วนของ cutterEntity แล้วลบช่วงที่มีจุดคลิกอยู่ระหว่าง
     จุดตัดที่ใกล้ที่สุดสองข้าง (หรือลบถึงปลายเส้นถ้าคลิกอยู่นอกสุด) — คืน array ของ {p1,p2} เส้นที่เหลือ (0-2 เส้น) */
  function trimLineAgainst(lineEntity, cutterEntity, clickPt) {
    var segs = entitySegments(cutterEntity);
    if (!segs.length) return null; // วงกลม/ส่วนโค้งยังไม่รองรับเป็นเส้นตัดในสเตจนี้
    var ts = [];
    segs.forEach(function (s) {
      var ip = segIntersect(lineEntity.p1, lineEntity.p2, s[0], s[1]);
      if (ip) ts.push(paramOnLine(ip, lineEntity.p1, lineEntity.p2));
    });
    if (!ts.length) return null;
    ts.sort(function (a, b) { return a - b; });
    var clickT = clamp(paramOnLine(clickPt, lineEntity.p1, lineEntity.p2), 0, 1);
    var lo = null, hi = null;
    ts.forEach(function (tt) {
      if (tt <= clickT && (lo === null || tt > lo)) lo = tt;
      if (tt >= clickT && (hi === null || tt < hi)) hi = tt;
    });
    var EPS = 1e-4, pieces = [];
    if (lo !== null && lo > EPS) pieces.push({ p1: lineEntity.p1, p2: pointAtParam(lineEntity.p1, lineEntity.p2, lo) });
    if (hi !== null && hi < 1 - EPS) pieces.push({ p1: pointAtParam(lineEntity.p1, lineEntity.p2, hi), p2: lineEntity.p2 });
    return pieces;
  }

  /* ต่อเส้น (extend): หาปลายที่ใกล้จุดคลิกที่สุด (ปลายอิสระ) แล้วยิงรังสีจากปลายอีกด้าน ผ่านปลายอิสระ ออกไปหา
     ส่วนของ boundaryEntity ที่ใกล้ที่สุด (ต้องอยู่ "เลยปลายอิสระออกไป" เท่านั้น ไม่ใช่ย้อนกลับเข้ามา) */
  function extendLineTo(lineEntity, boundaryEntity, clickPt) {
    var d1 = Math.hypot(clickPt.x - lineEntity.p1.x, clickPt.y - lineEntity.p1.y);
    var d2 = Math.hypot(clickPt.x - lineEntity.p2.x, clickPt.y - lineEntity.p2.y);
    var freeIsP1 = d1 < d2;
    var anchor = freeIsP1 ? lineEntity.p2 : lineEntity.p1;
    var free = freeIsP1 ? lineEntity.p1 : lineEntity.p2;
    var len = Math.hypot(free.x - anchor.x, free.y - anchor.y);
    if (!len) return null;
    var dir = { x: (free.x - anchor.x) / len, y: (free.y - anchor.y) / len };
    var segs = entitySegments(boundaryEntity);
    var bestT = null, bestPt = null;
    segs.forEach(function (s) {
      var r = rayIntersectSegment(anchor, dir, s[0], s[1]);
      if (r && r.t > len + 1e-6 && (bestT === null || r.t < bestT)) { bestT = r.t; bestPt = r.point; }
    });
    if (!bestPt) return null;
    var updated = deepClone(lineEntity);
    if (freeIsP1) updated.p1 = bestPt; else updated.p2 = bestPt;
    return updated;
  }

  /* มุมโค้ง (fillet): หาจุดตัดของเส้นตรงทั้งสอง (ต่อเส้นออกไปไม่มีที่สิ้นสุด) แล้ววางส่วนโค้งรัศมีที่กำหนดให้
     สัมผัสเส้นทั้งสองพอดี — ปลายที่ "ใกล้จุดตัดที่สุด" ของแต่ละเส้นจะถูกตัดออกแล้วแทนที่ด้วยจุดสัมผัส */
  function computeFillet(lineA, lineB, radius) {
    var V = lineIntersectInfinite(lineA.p1, lineA.p2, lineB.p1, lineB.p2);
    if (!V) return null;
    function pickKept(line) {
      var da = Math.hypot(line.p1.x - V.x, line.p1.y - V.y), db = Math.hypot(line.p2.x - V.x, line.p2.y - V.y);
      return da > db ? { kept: line.p1, trimmedEnd: 'p2' } : { kept: line.p2, trimmedEnd: 'p1' };
    }
    var ka = pickKept(lineA), kb = pickKept(lineB);
    var u1 = vnorm(vsub(ka.kept, V)), u2 = vnorm(vsub(kb.kept, V));
    var theta = Math.acos(clamp(vdot(u1, u2), -1, 1));
    if (theta < 1e-3 || Math.abs(theta - Math.PI) < 1e-3) return null; // เส้นขนาน/ทับเส้นตรง ทำมุมโค้งไม่ได้
    var dist = radius / Math.tan(theta / 2);
    var T1 = { x: V.x + dist * u1.x, y: V.y + dist * u1.y };
    var T2 = { x: V.x + dist * u2.x, y: V.y + dist * u2.y };
    var bis = vnorm({ x: u1.x + u2.x, y: u1.y + u2.y });
    var cdist = radius / Math.sin(theta / 2);
    var C = { x: V.x + cdist * bis.x, y: V.y + cdist * bis.y };
    var a1 = Math.atan2(T1.y - C.y, T1.x - C.x), a2 = Math.atan2(T2.y - C.y, T2.x - C.x);
    var span = normAngle(a2 - a1), startAngle, endAngle;
    if (span <= Math.PI) { startAngle = a1; endAngle = a1 + span; } else { startAngle = a2; endAngle = a2 + normAngle(a1 - a2); }
    return {
      lineAUpdate: { end: ka.trimmedEnd, point: T1 }, lineBUpdate: { end: kb.trimmedEnd, point: T2 },
      arc: { center: C, radius: radius, startAngle: startAngle, endAngle: endAngle }
    };
  }

  /* ออฟเซ็ต (offset): สร้างสำเนาขนานของเอนทิตี้ ห่างออกไปตามระยะที่กำหนด ทางด้านที่จุด sidePoint อยู่
     รองรับ เส้น/วงกลม/ส่วนโค้ง/สี่เหลี่ยม (พอลีไลน์ยังไม่รองรับในสเตจนี้ — การต่อมุมที่ถูกต้องซับซ้อนเกินขอบเขต) */
  function offsetEntity(e, distance, sidePoint) {
    if (e.type === 'line') {
      var dx = e.p2.x - e.p1.x, dy = e.p2.y - e.p1.y, len = Math.hypot(dx, dy);
      if (!len) return null;
      var side = (dx * (sidePoint.y - e.p1.y) - dy * (sidePoint.x - e.p1.x)) > 0 ? 1 : -1;
      var ux = (-dy / len) * side, uy = (dx / len) * side;
      return { id: genId(), type: 'line', layer: e.layer, p1: { x: e.p1.x + ux * distance, y: e.p1.y + uy * distance }, p2: { x: e.p2.x + ux * distance, y: e.p2.y + uy * distance } };
    }
    if (e.type === 'circle' || e.type === 'arc') {
      var growing = Math.hypot(sidePoint.x - e.center.x, sidePoint.y - e.center.y) > e.radius;
      var nr = e.radius + (growing ? distance : -distance);
      if (nr <= 0) return null;
      return e.type === 'circle'
        ? { id: genId(), type: 'circle', layer: e.layer, center: { x: e.center.x, y: e.center.y }, radius: nr }
        : { id: genId(), type: 'arc', layer: e.layer, center: { x: e.center.x, y: e.center.y }, radius: nr, startAngle: e.startAngle, endAngle: e.endAngle };
    }
    if (e.type === 'rect') {
      var minx = Math.min(e.p1.x, e.p2.x), maxx = Math.max(e.p1.x, e.p2.x);
      var miny = Math.min(e.p1.y, e.p2.y), maxy = Math.max(e.p1.y, e.p2.y);
      var outward = sidePoint.x < minx || sidePoint.x > maxx || sidePoint.y < miny || sidePoint.y > maxy;
      var sign = outward ? 1 : -1;
      var nminx = minx - sign * distance, nmaxx = maxx + sign * distance, nminy = miny - sign * distance, nmaxy = maxy + sign * distance;
      if (nmaxx <= nminx || nmaxy <= nminy) return null;
      return { id: genId(), type: 'rect', layer: e.layer, p1: { x: nminx, y: nminy }, p2: { x: nmaxx, y: nmaxy } };
    }
    return null;
  }

  /* จุดจับ (grips): จุดที่ลากได้ตรงๆ บนเอนทิตี้ที่เลือกอยู่ตัวเดียว — ref บอกว่าจะเขียนค่ากลับตรงไหนของเอนทิตี้ */
  function entityGrips(e) {
    if (e.type === 'line') return [{ p: e.p1, ref: 'p1' }, { p: e.p2, ref: 'p2' }];
    if (e.type === 'polyline') return e.points.map(function (p, i) { return { p: p, ref: { idx: i } }; });
    if (e.type === 'rect') {
      var c = rectCorners(e);
      return [{ p: e.p1, ref: 'p1' }, { p: e.p2, ref: 'p2' }, { p: c[1], ref: 'p2x-p1y' }, { p: c[3], ref: 'p1x-p2y' }];
    }
    if (e.type === 'circle') return [{ p: e.center, ref: 'center' }, { p: { x: e.center.x + e.radius, y: e.center.y }, ref: 'radius' }];
    if (e.type === 'arc') {
      var mAng = (e.startAngle + e.endAngle) / 2;
      return [{ p: e.center, ref: 'center' }, { p: { x: e.center.x + e.radius * Math.cos(mAng), y: e.center.y + e.radius * Math.sin(mAng) }, ref: 'radius' }];
    }
    if (e.type === 'dim') { var dl2 = dimLinePoints(e); return [{ p: e.p1, ref: 'p1' }, { p: e.p2, ref: 'p2' }, { p: dl2.dimP1, ref: 'dimoffset' }]; }
    if (e.type === 'raddim') return [{ p: e.center, ref: 'center' }, { p: raddimLeaderPoint(e), ref: 'raddimleader' }];
    if (e.type === 'text') return [{ p: e.p, ref: 'p' }];
    return [];
  }
  function applyGripEdit(e, ref, pt) {
    if (ref === 'p1') e.p1 = { x: pt.x, y: pt.y };
    else if (ref === 'p2') e.p2 = { x: pt.x, y: pt.y };
    else if (ref === 'p') e.p = { x: pt.x, y: pt.y };
    else if (ref === 'center') e.center = { x: pt.x, y: pt.y };
    else if (ref === 'radius') e.radius = Math.max(0.01, Math.hypot(pt.x - e.center.x, pt.y - e.center.y));
    else if (ref === 'p2x-p1y') { e.p2.x = pt.x; e.p1.y = pt.y; }
    else if (ref === 'p1x-p2y') { e.p1.x = pt.x; e.p2.y = pt.y; }
    else if (ref === 'dimoffset') {
      var dx = e.p2.x - e.p1.x, dy = e.p2.y - e.p1.y, len = Math.hypot(dx, dy);
      e.offset = len ? ((pt.x - e.p1.x) * (-dy / len) + (pt.y - e.p1.y) * (dx / len)) : 0;
    } else if (ref === 'raddimleader') { e.radius = Math.max(0.01, Math.hypot(pt.x - e.center.x, pt.y - e.center.y)); e.angle = Math.atan2(pt.y - e.center.y, pt.x - e.center.x); }
    else if (ref && typeof ref === 'object' && 'idx' in ref) e.points[ref.idx] = { x: pt.x, y: pt.y };
  }
  function hitTestGrip(worldPt) {
    if (state.selectedIds.length !== 1) return null;
    var e = state.entities.filter(function (x) { return x.id === state.selectedIds[0]; })[0];
    if (!e) return null;
    var thresholdMm = GRIP_PX / state.view.scale, best = null, bestD = thresholdMm;
    entityGrips(e).forEach(function (g) {
      var d = Math.hypot(worldPt.x - g.p.x, worldPt.y - g.p.y);
      if (d < bestD) { bestD = d; best = { entityId: e.id, ref: g.ref }; }
    });
    return best;
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
    function drawArrowHead(screenPt, dirAngle, color) {
      var len = 8, wid = 3, dx = Math.cos(dirAngle), dy = Math.sin(dirAngle), px = -dy, py = dx;
      var bx = screenPt.x - dx * len, by = screenPt.y - dy * len;
      ctx.beginPath();
      ctx.moveTo(screenPt.x, screenPt.y);
      ctx.lineTo(bx + px * wid, by + py * wid);
      ctx.lineTo(bx - px * wid, by - py * wid);
      ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
    }
    function drawDimText(midScreen, text, screenAngle, color) {
      var a = screenAngle;
      if (a > Math.PI / 2 || a < -Math.PI / 2) a += Math.PI;
      ctx.save();
      ctx.translate(midScreen.x, midScreen.y); ctx.rotate(a);
      ctx.fillStyle = color; ctx.font = '11px Prompt, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(text, 0, -4);
      ctx.restore();
    }
    state.entities.forEach(function (e) {
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      var selected = state.selectedIds.indexOf(e.id) !== -1;
      var isCutterOrPick = e.id === state.trimCutterId || e.id === state.offsetSourceId || state.pendingEntityIds.indexOf(e.id) !== -1;
      var col_ = isCutterOrPick ? col.osnap : (selected ? col.selected : (layer.color || col.entity));
      ctx.strokeStyle = col_;
      ctx.lineWidth = (selected || isCutterOrPick) ? 2.5 : 1.6;
      if (e.type === 'line') strokePolylinePts([e.p1, e.p2], false);
      else if (e.type === 'polyline') strokePolylinePts(e.points, !!e.closed);
      else if (e.type === 'rect') strokePolylinePts(rectCorners(e), true);
      else if (e.type === 'circle') {
        var c0 = worldToScreen(e.center.x, e.center.y);
        ctx.beginPath(); ctx.ellipse(c0.x, c0.y, e.radius * state.view.scale, e.radius * state.view.scale, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (e.type === 'arc') strokePolylinePts(arcPoints(e), false);
      else if (e.type === 'dim') {
        var dl = dimLinePoints(e);
        strokePolylinePts([e.p1, dl.dimP1], false);
        strokePolylinePts([e.p2, dl.dimP2], false);
        strokePolylinePts([dl.dimP1, dl.dimP2], false);
        var ds1 = worldToScreen(dl.dimP1.x, dl.dimP1.y), ds2 = worldToScreen(dl.dimP2.x, dl.dimP2.y);
        var dAng = Math.atan2(ds2.y - ds1.y, ds2.x - ds1.x);
        drawArrowHead(ds1, dAng + Math.PI, col_); drawArrowHead(ds2, dAng, col_);
        var dMid = { x: (ds1.x + ds2.x) / 2, y: (ds1.y + ds2.y) / 2 };
        var dLen = Math.hypot(e.p2.x - e.p1.x, e.p2.y - e.p1.y);
        drawDimText(dMid, fmtMm(dLen) + ' ' + t('mmUnit'), dAng, col_);
      } else if (e.type === 'raddim') {
        var rlp = raddimLeaderPoint(e);
        var rs1 = worldToScreen(e.center.x, e.center.y), rs2 = worldToScreen(rlp.x, rlp.y);
        ctx.beginPath(); ctx.moveTo(rs1.x, rs1.y); ctx.lineTo(rs2.x, rs2.y); ctx.stroke();
        var rAng = Math.atan2(rs2.y - rs1.y, rs2.x - rs1.x);
        drawArrowHead(rs2, rAng, col_);
        drawDimText({ x: rs2.x + Math.cos(rAng) * 14, y: rs2.y + Math.sin(rAng) * 14 }, 'R' + fmtMm(e.radius), rAng, col_);
      } else if (e.type === 'text') {
        var tsp = worldToScreen(e.p.x, e.p.y);
        ctx.fillStyle = col_; ctx.font = Math.max(6, e.height * state.view.scale) + 'px Prompt, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(e.text, tsp.x, tsp.y);
      }
    });
    /* จุดจับ (grips) — วาดเฉพาะตอนเลือกอยู่ตัวเดียวและเครื่องมือคือ "เลือก" (กันสับสนตอนใช้เครื่องมือแก้ไขอื่น) */
    if (state.tool === 'select' && state.selectedIds.length === 1) {
      var selE = state.entities.filter(function (x) { return x.id === state.selectedIds[0]; })[0];
      if (selE) {
        entityGrips(selE).forEach(function (g) {
          var isDragging = state.gripDrag && state.gripDrag.entityId === selE.id && JSON.stringify(state.gripDrag.ref) === JSON.stringify(g.ref);
          var gp = worldToScreen(g.p.x, g.p.y), gs = 5;
          ctx.fillStyle = isDragging ? col.preview : '#FFFFFF';
          ctx.strokeStyle = col.selected; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.rect(gp.x - gs, gp.y - gs, gs * 2, gs * 2); ctx.fill(); ctx.stroke();
        });
      }
    }

    /* ── พรีวิวเอนทิตี้ที่กำลังวาดอยู่ (รวมเครื่องมือย้าย/คัดลอก/หมุน/มิเรอร์ ที่ใช้จุดยึด+เคอร์เซอร์แบบเดียวกัน) ── */
    var GUIDE_LINE_TOOLS = { line: 1, polyline: 1, move: 1, copy: 1, rotate: 1, mirror: 1, dim: 1 };
    var eff = (state.tool !== 'select' && state._cursorWorld) ? effectivePoint(applyOrtho(state._cursorWorld)) : null;
    if (eff && state.pendingPoints.length) {
      var anchor = state.pendingPoints[state.pendingPoints.length - 1];
      ctx.strokeStyle = col.preview; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
      if (state.tool === 'dim' && state.pendingPoints.length === 2) {
        var dp1 = state.pendingPoints[0], dp2 = state.pendingPoints[1];
        var dpdx = dp2.x - dp1.x, dpdy = dp2.y - dp1.y, dplen = Math.hypot(dpdx, dpdy);
        var dOffset = dplen ? ((eff.x - dp1.x) * (-dpdy / dplen) + (eff.y - dp1.y) * (dpdx / dplen)) : 0;
        var dlp = dimLinePoints({ p1: dp1, p2: dp2, offset: dOffset });
        strokePolylinePts([dp1, dlp.dimP1], false); strokePolylinePts([dp2, dlp.dimP2], false); strokePolylinePts([dlp.dimP1, dlp.dimP2], false);
      } else if (GUIDE_LINE_TOOLS[state.tool]) {
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

    /* ── กรอบลากเลือกเป็นกลุ่ม — สีฟ้าทึบ (ลากซ้ายไปขวา = window select เอาที่อยู่ในกรอบล้วนๆ) หรือ
       เขียวประ (ลากขวาไปซ้าย = crossing select เอาที่แตะกรอบก็ได้ เหมือนโปรแกรม CAD ทั่วไป) ── */
    if (state.dragSelect && state.dragSelect.curScreen) {
      var ds = state.dragSelect;
      var x0 = Math.min(ds.startScreen.x, ds.curScreen.x), x1 = Math.max(ds.startScreen.x, ds.curScreen.x);
      var y0 = Math.min(ds.startScreen.y, ds.curScreen.y), y1 = Math.max(ds.startScreen.y, ds.curScreen.y);
      var isCrossing = ds.curScreen.x < ds.startScreen.x;
      ctx.fillStyle = isCrossing ? 'rgba(23,178,106,.10)' : 'rgba(37,84,199,.10)';
      ctx.strokeStyle = isCrossing ? '#17B26A' : col.entity;
      ctx.lineWidth = 1.3; ctx.setLineDash(isCrossing ? [5, 4] : []);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, y1 - y0);
      ctx.setLineDash([]);
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
    state.selectedIds = [];
    updateUndoRedoUI(); updateSelectionUI(); updateCountUI(); scheduleSave(); render();
  }
  function redo() {
    if (!state.redoStack.length) return;
    state.history.push(deepClone(state.entities));
    state.entities = state.redoStack.pop();
    state.selectedIds = [];
    updateUndoRedoUI(); updateSelectionUI(); updateCountUI(); scheduleSave(); render();
  }
  function updateUndoRedoUI() { $('undoBtn').disabled = state.history.length === 0; $('redoBtn').disabled = state.redoStack.length === 0; }
  var TRANSFORM_BTN_IDS = ['toolMoveBtn', 'toolCopyBtn', 'toolRotateBtn', 'toolMirrorBtn', 'toolScaleBtn', 'toolArrayRectBtn'];
  function updateSelectionUI() {
    var n = state.selectedIds.length;
    $('deleteBtn').disabled = n === 0;
    TRANSFORM_BTN_IDS.forEach(function (id) { var el = $(id); if (el) el.disabled = n === 0; });
    updatePropsPanel();
  }
  function updateCountUI() { $('statCount').textContent = state.entities.length.toLocaleString(getUILang() === 'en' ? 'en-US' : 'th-TH'); }

  /* ══════════════════ บันทึกอัตโนมัติ ══════════════════ */
  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ entities: state.entities, layers: state.layers, activeLayer: state.activeLayer, layerSeq: state.layerSeq, view: state.view }));
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
        if (saved.activeLayer && state.layers[saved.activeLayer]) state.activeLayer = saved.activeLayer;
        if (saved.layerSeq) state.layerSeq = saved.layerSeq;
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
      if (layer.visible === false || layer.locked) return;
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
  var TOOL_BTN_IDS = {
    select: 'toolSelectBtn', line: 'toolLineBtn', polyline: 'toolPolylineBtn', rect: 'toolRectBtn', circle: 'toolCircleBtn', arc: 'toolArcBtn',
    move: 'toolMoveBtn', copy: 'toolCopyBtn', rotate: 'toolRotateBtn', mirror: 'toolMirrorBtn', scale: 'toolScaleBtn',
    trim: 'toolTrimBtn', extend: 'toolExtendBtn', fillet: 'toolFilletBtn', offset: 'toolOffsetBtn', arrayrect: 'toolArrayRectBtn',
    dim: 'toolDimBtn', raddim: 'toolRaddimBtn', text: 'toolTextBtn'
  };
  var distLbl = document.querySelector('label[data-i18n="distLbl"]'), angLbl = document.querySelector('label[data-i18n="angLbl"]');
  var arrayRow = $('arrayRow'), textRow = $('textRow'), textContentInput = $('textContentInput'), textHeightInput = $('textHeightInput');
  function setTool(tool) {
    state.tool = tool; state.pendingPoints = []; state.pendingEntityIds = []; state.trimCutterId = null; state.offsetSourceId = null; state.gripDrag = null;
    Object.keys(TOOL_BTN_IDS).forEach(function (k) { $(TOOL_BTN_IDS[k]).classList.toggle('active', k === tool); });
    viewport.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    arrayRow.classList.toggle('show', tool === 'arrayrect');
    updatePreciseRowUI();
    updateTextRowUI();
    render();
  }
  function updateTextRowUI() {
    var show = state.tool === 'text' && state.pendingPoints.length === 1;
    textRow.classList.toggle('show', show);
    if (show) { textHeightInput.value = state.textDefaultHeight; textContentInput.value = ''; textContentInput.focus(); }
  }
  function applyTextRow() {
    if (state.tool !== 'text' || state.pendingPoints.length !== 1) return;
    var content = textContentInput.value;
    if (!content.trim()) { cancelDrawing(); return; }
    var h = parseFloat(textHeightInput.value);
    if (!isFinite(h) || h <= 0) h = state.textDefaultHeight;
    state.textDefaultHeight = h;
    pushHistory();
    state.entities.push({ id: genId(), type: 'text', layer: state.activeLayer, p: state.pendingPoints[0], text: content, height: h });
    updateCountUI(); scheduleSave();
    finishDrawing(); updateTextRowUI(); render();
  }
  /* เปลี่ยนป้าย/ซ่อน-โชว์ช่องระยะ/มุม ตามความหมายจริงของเครื่องมือปัจจุบัน (วงกลม=รัศมี, หมุน=มุมหมุนอย่างเดียว,
     สเกล=อัตราส่วน, ออฟเซ็ต/มุมโค้ง=ระยะ/รัศมีอย่างเดียว, มิเรอร์=ไม่ใช้ช่องตัวเลขเลย) */
  function updatePreciseLabels() {
    var distText = t('distLbl'), angText = t('angLbl'), distShow = true, angShow = true;
    if (state.tool === 'circle') distText = t('radiusLbl');
    else if (state.tool === 'rotate') { distShow = false; angText = t('rotAngLbl'); }
    else if (state.tool === 'scale') { distText = t('scaleFactorLbl'); angShow = false; }
    else if (state.tool === 'offset') { distText = t('offsetDistLbl'); angShow = false; }
    else if (state.tool === 'fillet') { distText = t('filletRadiusLbl'); angShow = false; }
    else if (state.tool === 'mirror') { distShow = false; angShow = false; }
    distLbl.childNodes[0].textContent = distText; distLbl.style.display = distShow ? '' : 'none';
    angLbl.childNodes[0].textContent = angText; angLbl.style.display = angShow ? '' : 'none';
  }
  function updatePreciseRowUI() {
    updatePreciseLabels();
    var PRECISE_ROW_EXCLUDED = { select: 1, trim: 1, extend: 1, arrayrect: 1, dim: 1, raddim: 1, text: 1 };
    var show = (!PRECISE_ROW_EXCLUDED[state.tool] && state.pendingPoints.length > 0) ||
      (state.tool === 'offset' && state.offsetSourceId) || (state.tool === 'fillet' && state.pendingEntityIds.length === 2);
    preciseRow.classList.toggle('show', show);
    var showFinish = state.tool === 'polyline' && state.pendingPoints.length >= 2;
    finishPolyBtn.classList.toggle('show', showFinish);
    if (!show) { distInput.value = ''; angInput.value = ''; }
  }
  function clearPreciseInputs() { distInput.value = ''; angInput.value = ''; }
  function cancelDrawing() {
    state.pendingPoints = []; state.pendingEntityIds = []; state.trimCutterId = null; state.offsetSourceId = null;
    updatePreciseRowUI(); updateTextRowUI(); render();
  }
  function finishDrawing() { state.pendingPoints = []; updatePreciseRowUI(); updateTextRowUI(); }
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
    } else if (state.tool === 'move' || state.tool === 'copy') {
      if (!state.pendingPoints.length) { state.pendingPoints = [pt]; }
      else {
        var mBase = state.pendingPoints[0], mdx = pt.x - mBase.x, mdy = pt.y - mBase.y;
        if (Math.hypot(mdx, mdy) > DUP_EPS) {
          pushHistory();
          transformSelectedEntities(function (p) { return { x: p.x + mdx, y: p.y + mdy }; }, { duplicate: state.tool === 'copy' });
          updateCountUI(); scheduleSave(); updateSelectionUI();
        }
        finishDrawing();
      }
    } else if (state.tool === 'rotate') {
      if (!state.pendingPoints.length) { state.pendingPoints = [pt]; }
      else {
        var rBase = state.pendingPoints[0], rDeg = Math.atan2(pt.y - rBase.y, pt.x - rBase.x) * 180 / Math.PI;
        pushHistory();
        transformSelectedEntities(function (p) { return rotateAround(p, rBase, rDeg * Math.PI / 180); }, { rotateDeltaRad: rDeg * Math.PI / 180, convertRect: true });
        scheduleSave(); finishDrawing();
      }
    } else if (state.tool === 'scale') {
      state.pendingPoints = [pt]; // คลิกแค่กำหนด/ปรับจุดฐาน — อัตราส่วนต้องพิมพ์ในช่องแล้วกด Enter เท่านั้น (กันความกำกวม)
    } else if (state.tool === 'mirror') {
      state.pendingPoints.push(pt);
      if (state.pendingPoints.length >= 2) {
        var mA = state.pendingPoints[0], mB = state.pendingPoints[1];
        pushHistory();
        transformSelectedEntities(function (p) { return mirrorPointAcrossLine(p, mA, mB); }, { mirrorLine: { a: mA, b: mB }, convertRect: true, duplicate: state.mirrorKeepOriginal });
        updateCountUI(); scheduleSave(); updateSelectionUI(); finishDrawing();
      }
    } else if (state.tool === 'dim') {
      if (state.pendingPoints.length < 2) {
        var dLast = state.pendingPoints[state.pendingPoints.length - 1];
        if (!dLast || Math.hypot(dLast.x - pt.x, dLast.y - pt.y) > DUP_EPS) state.pendingPoints.push(pt);
      } else {
        var d1 = state.pendingPoints[0], d2 = state.pendingPoints[1];
        var ddx = d2.x - d1.x, ddy = d2.y - d1.y, dlen = Math.hypot(ddx, ddy);
        if (dlen > DUP_EPS) {
          var offset = (pt.x - d1.x) * (-ddy / dlen) + (pt.y - d1.y) * (ddx / dlen);
          pushHistory();
          state.entities.push({ id: genId(), type: 'dim', layer: state.activeLayer, p1: d1, p2: d2, offset: offset });
          updateCountUI(); scheduleSave();
        }
        finishDrawing();
      }
    } else if (state.tool === 'text') {
      state.pendingPoints = [pt]; // จุดเดียว — เนื้อหาข้อความกรอกผ่าน textRow แยกต่างหาก (ดู applyTextRow)
    }
    updatePreciseRowUI();
    updateTextRowUI();
    clearPreciseInputs();
    render();
  }

  /* ระยะ/มุมที่พิมพ์ในกล่องอินพุต -> คำนวณจุดถัดไปจากจุดยึดปัจจุบัน แล้วส่งเข้า handlePointInput เหมือนคลิกจริง
     คืนค่า true ถ้าใช้ค่าที่พิมพ์ไปจริง (ให้ผู้เรียกรู้ว่าไม่ต้องทำอย่างอื่นซ้อน เช่น จบพอลีไลน์) */
  function commitPreciseInput() {
    if (!state.pendingPoints.length) return false;
    var anchor = state.pendingPoints[state.pendingPoints.length - 1];
    if (state.tool === 'rotate') {
      var rDeg2 = parseFloat(angInput.value.trim());
      if (!isFinite(rDeg2)) return false;
      pushHistory();
      transformSelectedEntities(function (p) { return rotateAround(p, anchor, rDeg2 * Math.PI / 180); }, { rotateDeltaRad: rDeg2 * Math.PI / 180, convertRect: true });
      scheduleSave(); finishDrawing(); clearPreciseInputs(); render();
      return true;
    }
    if (state.tool === 'scale') {
      var factor = parseFloat(distInput.value.trim());
      if (!isFinite(factor) || factor <= 0) return false;
      pushHistory();
      transformSelectedEntities(function (p) { return scaleAround(p, anchor, factor); }, { scaleFactor: factor });
      updateCountUI(); scheduleSave(); finishDrawing(); clearPreciseInputs(); render();
      return true;
    }
    var distStr = distInput.value.trim();
    if (!distStr) return false;
    var dist = parseFloat(distStr);
    if (!isFinite(dist) || dist <= 0) return false;
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
    if (!state.selectedIds.length) return;
    pushHistory();
    var selSet = {}; state.selectedIds.forEach(function (id) { selSet[id] = true; });
    state.entities = state.entities.filter(function (e) { return !selSet[e.id]; });
    state.selectedIds = [];
    updateSelectionUI(); updateCountUI(); scheduleSave(); render();
  }
  function clearAll() {
    if (!state.entities.length) return;
    if (!window.confirm(t('clearConfirm'))) return;
    pushHistory();
    state.entities = []; state.selectedIds = [];
    updateSelectionUI(); updateCountUI(); scheduleSave(); render();
  }

  /* ══════════════════ อินพุตเมาส์ ══════════════════ */
  var panState = null;
  function updateCoordUI(w) { $('statCoord').textContent = 'X ' + w.x.toFixed(1) + ', Y ' + w.y.toFixed(1) + ' ' + t('mmUnit'); }
  function eventScreenPos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  /* ── เครื่องมือ trim/extend: คลิกแรกเลือกเส้นตัด/เส้นขอบ คลิกต่อไปเลือกเป้าหมายที่จะแก้ ── */
  function handleTrimExtendClick(raw) {
    var hit = hitTestEntity(raw);
    if (!state.trimCutterId) { if (hit) { state.trimCutterId = hit; render(); } return; }
    if (!hit || hit === state.trimCutterId) return;
    var targetE = state.entities.filter(function (x) { return x.id === hit; })[0];
    var cutterE = state.entities.filter(function (x) { return x.id === state.trimCutterId; })[0];
    if (!targetE || !cutterE || targetE.type !== 'line') return;
    if (state.tool === 'trim') {
      var pieces = trimLineAgainst(targetE, cutterE, raw);
      if (pieces) {
        pushHistory();
        state.entities = state.entities.filter(function (x) { return x.id !== hit; });
        pieces.forEach(function (pc) { state.entities.push({ id: genId(), type: 'line', layer: targetE.layer, p1: pc.p1, p2: pc.p2 }); });
        updateCountUI(); scheduleSave(); render();
      }
    } else {
      var updated = extendLineTo(targetE, cutterE, raw);
      if (updated) {
        pushHistory();
        var idx = state.entities.findIndex(function (x) { return x.id === hit; });
        state.entities[idx] = updated;
        scheduleSave(); render();
      }
    }
  }
  /* ── เครื่องมือ fillet: คลิกเลือกเส้นตรง 2 เส้น แล้วพิมพ์รัศมี+Enter (ดู keydown ของ distInput) ── */
  function handleFilletClick(raw) {
    var hit = hitTestEntity(raw);
    if (!hit) return;
    var e = state.entities.filter(function (x) { return x.id === hit; })[0];
    if (!e || e.type !== 'line' || state.pendingEntityIds.indexOf(hit) !== -1) return;
    state.pendingEntityIds.push(hit);
    if (state.pendingEntityIds.length > 2) state.pendingEntityIds.shift();
    updatePreciseRowUI(); render();
  }
  function applyFillet(idA, idB, radius) {
    var eA = state.entities.filter(function (x) { return x.id === idA; })[0];
    var eB = state.entities.filter(function (x) { return x.id === idB; })[0];
    if (!eA || !eB) return false;
    var res = computeFillet(eA, eB, radius);
    if (!res) return false;
    pushHistory();
    eA[res.lineAUpdate.end] = res.lineAUpdate.point;
    eB[res.lineBUpdate.end] = res.lineBUpdate.point;
    state.entities.push({ id: genId(), type: 'arc', layer: state.activeLayer, center: res.arc.center, radius: res.arc.radius, startAngle: res.arc.startAngle, endAngle: res.arc.endAngle });
    updateCountUI(); scheduleSave(); render();
    return true;
  }
  /* ── เครื่องมือ offset: คลิกแรกเลือกเอนทิตี้ต้นทาง คลิกที่สองบอกด้าน (+ระยะเป๊ะถ้าพิมพ์ไว้) ── */
  function handleOffsetClick(raw) {
    if (!state.offsetSourceId) {
      var hit = hitTestEntity(raw);
      if (hit) { state.offsetSourceId = hit; updatePreciseRowUI(); render(); }
      return;
    }
    var src = state.entities.filter(function (x) { return x.id === state.offsetSourceId; })[0];
    if (!src) { state.offsetSourceId = null; updatePreciseRowUI(); return; }
    var typedDist = parseFloat(distInput.value.trim());
    var dist = isFinite(typedDist) && typedDist > 0 ? typedDist : distPointToEntity(raw, src);
    if (!(dist > 0)) return;
    var ne = offsetEntity(src, dist, raw);
    if (ne) {
      pushHistory();
      state.entities.push(ne);
      updateCountUI(); scheduleSave();
    }
    state.offsetSourceId = null;
    clearPreciseInputs(); updatePreciseRowUI(); render();
  }
  /* มิติรัศมี (raddim): คลิกวงกลม/ส่วนโค้งแล้วสร้าง snapshot รัศมี ณ ตำแหน่งที่คลิก (ทิศทางขีดนำ) — ไม่ผูก
     กับเอนทิตี้ต้นทางอีกต่อไป แก้วงกลมทีหลังจะไม่กระทบมิติที่วางไปแล้ว (ข้อจำกัดที่ตั้งใจ ทำให้ง่ายและคาดเดาได้) */
  function handleRaddimClick(raw) {
    var hit = hitTestEntity(raw);
    if (!hit) return;
    var e = state.entities.filter(function (x) { return x.id === hit; })[0];
    if (!e || (e.type !== 'circle' && e.type !== 'arc')) return;
    var angle = Math.atan2(raw.y - e.center.y, raw.x - e.center.x);
    pushHistory();
    state.entities.push({ id: genId(), type: 'raddim', layer: state.activeLayer, center: { x: e.center.x, y: e.center.y }, radius: e.radius, angle: angle });
    updateCountUI(); scheduleSave(); render();
  }
  /* ── โหมด "เลือก": จุดจับ (grip) ก่อน แล้วค่อยคลิกเอนทิตี้/ลากเลือกเป็นกลุ่ม ── */
  function handleSelectMouseDown(raw, sp, shiftKey) {
    if (state.selectedIds.length === 1) {
      var gp = hitTestGrip(raw);
      if (gp) { pushHistory(); state.gripDrag = gp; return; }
    }
    var hit = hitTestEntity(raw);
    if (hit) {
      if (shiftKey) {
        var idx = state.selectedIds.indexOf(hit);
        if (idx >= 0) state.selectedIds.splice(idx, 1); else state.selectedIds.push(hit);
      } else state.selectedIds = [hit];
      updateSelectionUI(); render();
      return;
    }
    if (!shiftKey) state.selectedIds = [];
    state.dragSelect = { startWorld: raw, startScreen: sp, curScreen: sp, additive: shiftKey };
    updateSelectionUI(); render();
  }
  function finishDragSelect() {
    var ds = state.dragSelect; state.dragSelect = null;
    if (!ds || !ds.curScreen) return;
    var moved = Math.hypot(ds.curScreen.x - ds.startScreen.x, ds.curScreen.y - ds.startScreen.y) > 3;
    if (!moved) { render(); return; }
    var endWorld = screenToWorld(ds.curScreen.x, ds.curScreen.y);
    var xmin = Math.min(ds.startWorld.x, endWorld.x), xmax = Math.max(ds.startWorld.x, endWorld.x);
    var ymin = Math.min(ds.startWorld.y, endWorld.y), ymax = Math.max(ds.startWorld.y, endWorld.y);
    var crossing = ds.curScreen.x < ds.startScreen.x; // ลากขวา→ซ้าย = crossing (แตะกรอบก็เอา), ซ้าย→ขวา = window (ต้องอยู่ในกรอบทั้งชิ้น)
    var picked = [];
    state.entities.forEach(function (e) {
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false || layer.locked) return;
      var pts = entityBoundsPoints(e);
      var allIn = pts.every(function (p) { return p.x >= xmin && p.x <= xmax && p.y >= ymin && p.y <= ymax; });
      var anyIn = pts.some(function (p) { return p.x >= xmin && p.x <= xmax && p.y >= ymin && p.y <= ymax; });
      if (crossing ? anyIn : allIn) picked.push(e.id);
    });
    if (ds.additive) picked.forEach(function (id) { if (state.selectedIds.indexOf(id) === -1) state.selectedIds.push(id); });
    else state.selectedIds = picked;
    updateSelectionUI(); render();
  }
  canvas.addEventListener('mousemove', function (e) {
    var sp = eventScreenPos(e);
    state._cursorScreen = sp; state._cursorWorld = screenToWorld(sp.x, sp.y);
    var eff = state.tool !== 'select' ? effectivePoint(applyOrtho(state._cursorWorld)) : snapPoint(state._cursorWorld);
    updateCoordUI(eff);
    if (panState) {
      var dx = (sp.x - panState.startScreenX) / state.view.scale, dy = (sp.y - panState.startScreenY) / state.view.scale;
      state.view.cx = panState.startCx - dx; state.view.cy = panState.startCy + dy;
    } else if (state.gripDrag) {
      var ge = state.entities.filter(function (x) { return x.id === state.gripDrag.entityId; })[0];
      if (ge) { applyGripEdit(ge, state.gripDrag.ref, effectivePoint(state._cursorWorld)); }
    } else if (state.dragSelect) {
      state.dragSelect.curScreen = sp;
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
    if (state.tool === 'select') { handleSelectMouseDown(raw, sp, e.shiftKey); return; }
    if (state.tool === 'trim' || state.tool === 'extend') { handleTrimExtendClick(raw); return; }
    if (state.tool === 'fillet') { handleFilletClick(raw); return; }
    if (state.tool === 'offset') { handleOffsetClick(raw); return; }
    if (state.tool === 'raddim') { handleRaddimClick(raw); return; }
    if (state.tool === 'arrayrect') return; // อาเรย์ทำงานผ่านปุ่ม "แทรกอาเรย์" ไม่ใช้คลิกบน canvas
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
  window.addEventListener('mouseup', function () {
    if (panState) { panState = null; viewport.style.cursor = state.tool === 'select' ? 'default' : 'crosshair'; }
    if (state.gripDrag) { state.gripDrag = null; scheduleSave(); updatePropsPanel(); render(); }
    if (state.dragSelect) finishDragSelect();
  });
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
      if (state.tool === 'select') handleSelectMouseDown(raw, { x: touchState.startX, y: touchState.startY }, false);
      else if (state.tool === 'trim' || state.tool === 'extend') handleTrimExtendClick(raw);
      else if (state.tool === 'fillet') handleFilletClick(raw);
      else if (state.tool === 'offset') handleOffsetClick(raw);
      else if (state.tool === 'raddim') handleRaddimClick(raw);
      else if (state.tool !== 'arrayrect') handlePointInput(effectivePoint(applyOrtho(raw)));
      render();
    }
    if (state.dragSelect) state.dragSelect = null;
    touchState = null;
  });

  /* ══════════════════ คีย์ลัด + ระบบพิมพ์ตัวเลขได้ทันที ══════════════════
     ระหว่างวาด (มีจุดยึดค้างอยู่) พิมพ์เลข/จุด/ลบได้เลยโดยไม่ต้องคลิกช่องอินพุตก่อน — คีย์นั้นจะถูก "โยน"
     ไปที่ช่องระยะให้อัตโนมัติ เหมือนโปรแกรม CAD ทั่วไป (Dynamic Input) */
  function hasPendingOp() {
    return state.pendingPoints.length > 0 || !!state.trimCutterId || !!state.offsetSourceId || state.pendingEntityIds.length > 0;
  }
  window.addEventListener('keydown', function (e) {
    var tag = document.activeElement.tagName;
    var typingInField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (!typingInField && e.key === 'F8') { e.preventDefault(); toggleOrtho(); return; }
    if (!typingInField && e.key === 'Escape') { if (hasPendingOp()) { e.preventDefault(); cancelDrawing(); } return; }
    if (!typingInField && (e.key === 'Delete' || e.key === 'Backspace') && state.tool === 'select' && state.selectedIds.length) { e.preventDefault(); deleteSelected(); return; }
    if (!typingInField && e.key === 'Backspace' && state.pendingPoints.length) {
      e.preventDefault();
      state.pendingPoints.pop(); updatePreciseRowUI(); render();
      return;
    }
    if (!typingInField && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (!typingInField && (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); return; }
    if (!typingInField && state.pendingPoints.length && state.tool !== 'select' && state.tool !== 'rotate' && state.tool !== 'scale' && /^[0-9.\-]$/.test(e.key)) {
      e.preventDefault();
      var fld = state.tool === 'rotate' ? angInput : distInput;
      fld.value = e.key; fld.focus();
      try { fld.setSelectionRange(1, 1); } catch (er) {}
    }
  });
  [distInput, angInput].forEach(function (inp) {
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (state.tool === 'fillet' && state.pendingEntityIds.length === 2) {
          var rr = parseFloat(distInput.value.trim());
          if (isFinite(rr) && rr > 0 && applyFillet(state.pendingEntityIds[0], state.pendingEntityIds[1], rr)) { state.pendingEntityIds = []; clearPreciseInputs(); updatePreciseRowUI(); }
          return;
        }
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
  $('mirrorKeepBtn').addEventListener('click', function () { state.mirrorKeepOriginal = !state.mirrorKeepOriginal; $('mirrorKeepBtn').classList.toggle('active', state.mirrorKeepOriginal); });
  $('arrApplyBtn').addEventListener('click', function () {
    var rows = Math.max(1, parseInt($('arrRows').value, 10) || 1);
    var cols = Math.max(1, parseInt($('arrCols').value, 10) || 1);
    var spx = parseFloat($('arrSpX').value) || 0, spy = parseFloat($('arrSpY').value) || 0;
    doArrayRect(rows, cols, spx, spy);
  });
  $('textApplyBtn').addEventListener('click', applyTextRow);
  [textContentInput, textHeightInput].forEach(function (inp) {
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applyTextRow(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelDrawing(); inp.blur(); }
    });
  });
  var langToggle = $('langToggle');
  if (langToggle) langToggle.addEventListener('click', function () { setUILang(getUILang() === 'en' ? 'th' : 'en'); applyStaticI18n(); updatePropsPanel(); renderLayersPanel(); });

  /* ══════════════════ แผงคุณสมบัติ — แก้ไขพิกัด/รัศมี/มุมของเอนทิตี้ที่เลือกอยู่ตัวเดียวได้ตรงๆ ══════════════════ */
  var propsCard = $('propsCard'), propsTitle = $('propsTitle'), propsGrid = $('propsGrid');
  function updatePropsPanel() {
    if (!propsCard) return;
    if (state.selectedIds.length !== 1) { propsCard.hidden = true; return; }
    var e = state.entities.filter(function (x) { return x.id === state.selectedIds[0]; })[0];
    if (!e) { propsCard.hidden = true; return; }
    propsCard.hidden = false;
    var TITLE_KEY = {
      line: 'propsTitleLine', polyline: 'propsTitlePolyline', rect: 'propsTitleRect', circle: 'propsTitleCircle',
      arc: 'propsTitleArc', dim: 'propsTitleDim', raddim: 'propsTitleRaddim', text: 'propsTitleText'
    };
    propsTitle.textContent = t(TITLE_KEY[e.type] || e.type);
    var fields = [], noteHtml = '';
    if (e.type === 'polyline') { noteHtml = '<div class="cad-props-note">' + t('propPolylineNote', { n: e.points.length }) + '</div>'; }
    else if (e.type === 'line' || e.type === 'rect' || e.type === 'dim') {
      fields = [
        { k: 'propX1', v: e.p1.x, set: function (v) { e.p1.x = v; } }, { k: 'propY1', v: e.p1.y, set: function (v) { e.p1.y = v; } },
        { k: 'propX2', v: e.p2.x, set: function (v) { e.p2.x = v; } }, { k: 'propY2', v: e.p2.y, set: function (v) { e.p2.y = v; } }
      ];
    } else if (e.type === 'circle' || e.type === 'raddim') {
      fields = [
        { k: 'propCx', v: e.center.x, set: function (v) { e.center.x = v; } }, { k: 'propCy', v: e.center.y, set: function (v) { e.center.y = v; } },
        { k: 'propR', v: e.radius, set: function (v) { e.radius = Math.max(0.01, v); } }
      ];
    } else if (e.type === 'arc') {
      fields = [
        { k: 'propCx', v: e.center.x, set: function (v) { e.center.x = v; } }, { k: 'propCy', v: e.center.y, set: function (v) { e.center.y = v; } },
        { k: 'propR', v: e.radius, set: function (v) { e.radius = Math.max(0.01, v); } },
        { k: 'propStartDeg', v: e.startAngle * 180 / Math.PI, set: function (v) { e.startAngle = v * Math.PI / 180; } },
        { k: 'propEndDeg', v: e.endAngle * 180 / Math.PI, set: function (v) { e.endAngle = v * Math.PI / 180; } }
      ];
    } else if (e.type === 'text') {
      fields = [
        { k: 'propHeight', v: e.height, set: function (v) { e.height = Math.max(0.1, v); } }
      ];
    }
    var textFieldHtml = e.type === 'text' ? '<label>' + t('propText') + '<input type="text" id="propTextContent" value="' + e.text.replace(/"/g, '&quot;') + '"></label>' : '';
    var numFieldsHtml = fields.map(function (f, i) {
      return '<label>' + t(f.k) + '<input type="text" inputmode="decimal" data-fidx="' + i + '" value="' + fmtMm(f.v) + '"></label>';
    }).join('');
    var layerOptsHtml = Object.keys(state.layers).map(function (lid) {
      return '<option value="' + lid + '"' + (e.layer === lid ? ' selected' : '') + '>' + (state.layers[lid].name || lid) + '</option>';
    }).join('');
    var layerFieldHtml = '<label>' + t('propLayer') + '<select id="propLayerSel">' + layerOptsHtml + '</select></label>';
    propsGrid.innerHTML = noteHtml + textFieldHtml + numFieldsHtml + layerFieldHtml;
    Array.prototype.forEach.call(propsGrid.querySelectorAll('input[data-fidx]'), function (inp, i) {
      inp.addEventListener('change', function () {
        var v = parseFloat(inp.value);
        if (!isFinite(v)) { inp.value = fmtMm(fields[i].v); return; }
        pushHistory();
        fields[i].set(v);
        scheduleSave(); render(); updatePropsPanel();
      });
    });
    var textInp = $('propTextContent');
    if (textInp) textInp.addEventListener('change', function () { pushHistory(); e.text = textInp.value; scheduleSave(); render(); });
    var layerSel = $('propLayerSel');
    if (layerSel) layerSel.addEventListener('change', function () { pushHistory(); e.layer = layerSel.value; scheduleSave(); render(); });
  }

  /* ══════════════════ แผงจัดการเลเยอร์ — เพิ่ม/ลบ/เปลี่ยนชื่อ/สี/ซ่อน/ล็อก, เลือกเลเยอร์ที่กำลังวาดอยู่ ══════════════════
     เลเยอร์ '0' เป็นเลเยอร์ถาวร ลบไม่ได้ (ตามธรรมเนียมโปรแกรม CAD ทั่วไป) — ลบเลเยอร์อื่นแล้วเอนทิตี้ในนั้นย้ายไปเลเยอร์ 0
     ล็อกเลเยอร์ = เลือก/แก้เอนทิตี้ในเลเยอร์นั้นไม่ได้ (hitTestEntity/finishDragSelect ข้ามให้แล้ว) แต่ยังวาดเอนทิตี้ใหม่ทับ
     ไปลงเลเยอร์นั้นได้ถ้าตั้งเป็นเลเยอร์ใช้งานอยู่ (ข้อจำกัดที่ตั้งใจ ไม่ปิดกั้นการวาดเพื่อความง่าย) */
  var layersList = $('layersList');
  function renderLayersPanel() {
    if (!layersList) return;
    var ids = Object.keys(state.layers);
    layersList.innerHTML = ids.map(function (lid) {
      var ly = state.layers[lid];
      var isActive = lid === state.activeLayer;
      return '<div class="cad-layer-row' + (isActive ? ' active' : '') + '" data-lid="' + lid + '">' +
        '<button type="button" class="cad-layer-icon" data-act="setactive" title="' + t('layerActiveLbl') + '">' + (isActive ? '🔘' : '⚪') + '</button>' +
        '<input type="color" class="cad-layer-color" data-act="color" value="' + (ly.color || '#1F2430') + '">' +
        '<input type="text" class="cad-layer-name" data-act="rename" value="' + (ly.name || lid).replace(/"/g, '&quot;') + '" placeholder="' + t('layerNamePlaceholder') + '">' +
        '<button type="button" class="cad-layer-icon" data-act="visible" title="' + (ly.visible === false ? 'show' : 'hide') + '">' + (ly.visible === false ? '🚫' : '👁️') + '</button>' +
        '<button type="button" class="cad-layer-icon" data-act="lock">' + (ly.locked ? '🔒' : '🔓') + '</button>' +
        '<button type="button" class="cad-layer-icon" data-act="delete"' + (lid === '0' ? ' disabled' : '') + '>🗑️</button>' +
        '</div>';
    }).join('');
    Array.prototype.forEach.call(layersList.querySelectorAll('[data-act]'), function (el) {
      var row = el.closest('.cad-layer-row'), lid = row.getAttribute('data-lid'), act = el.getAttribute('data-act');
      if (act === 'setactive') el.addEventListener('click', function () { state.activeLayer = lid; renderLayersPanel(); });
      else if (act === 'color') el.addEventListener('change', function () { state.layers[lid].color = el.value; scheduleSave(); render(); });
      else if (act === 'rename') el.addEventListener('change', function () { state.layers[lid].name = el.value || lid; scheduleSave(); updatePropsPanel(); });
      else if (act === 'visible') el.addEventListener('click', function () { state.layers[lid].visible = state.layers[lid].visible === false; scheduleSave(); render(); renderLayersPanel(); });
      else if (act === 'lock') el.addEventListener('click', function () { state.layers[lid].locked = !state.layers[lid].locked; scheduleSave(); renderLayersPanel(); });
      else if (act === 'delete') el.addEventListener('click', function () { deleteLayer(lid); });
    });
  }
  function addLayer() {
    var id = String(state.layerSeq++);
    while (state.layers[id]) id = String(state.layerSeq++);
    state.layers[id] = { name: 'เลเยอร์ ' + id, color: '#2554C7', visible: true, locked: false };
    state.activeLayer = id;
    scheduleSave(); renderLayersPanel();
  }
  function deleteLayer(lid) {
    if (lid === '0') return;
    var name = state.layers[lid] ? (state.layers[lid].name || lid) : lid;
    if (!window.confirm(t('layerDeleteConfirm', { name: name }))) return;
    pushHistory();
    state.entities.forEach(function (e) { if (e.layer === lid) e.layer = '0'; });
    delete state.layers[lid];
    if (state.activeLayer === lid) state.activeLayer = '0';
    updateCountUI(); scheduleSave(); renderLayersPanel(); updatePropsPanel(); render();
  }
  var layerAddBtn = $('layerAddBtn');
  if (layerAddBtn) layerAddBtn.addEventListener('click', addLayer);

  /* ══════════════════ ส่งออก/นำเข้าไฟล์ (Stage 5) ══════════════════
     PNG: แรสเตอร์ snapshot ของทั้งแบบ (auto-fit, พื้นหลังขาวเสมอไม่ว่าจะเปิดธีมไหนอยู่ — เอาไว้แชร์/พิมพ์ให้อ่านง่าย)
     SVG: เวกเตอร์ สเกลจริงหน่วยมิลลิเมตร (viewBox + width/height เป็น "mm" ตรงๆ) แก้ไขต่อในโปรแกรมเวกเตอร์อื่นได้
     DXF: มาตรฐานแลกเปลี่ยนไฟล์ CAD (ASCII R12) เปิดต่อใน AutoCAD/LibreCAD/QCAD ฯลฯ ได้ — ดูหมายเหตุขอบเขตที่
          entityToDxfChunks() ด้านล่าง
     พิมพ์/PDF: ไม่ได้เขียน PDF byte-stream เอง (ซับซ้อนเกินสัดส่วนของสเตจนี้) แต่เปิดหน้าต่างใหม่ใส่ SVG ที่สเกล
          จริงแล้วเรียกกลไกพิมพ์ของเบราว์เซอร์ (window.print) แทน — ผู้ใช้เลือก "บันทึกเป็น PDF" จาก dialog พิมพ์เอง
     ทุกฟังก์ชันส่งออกใช้ computeSceneBBox() (เฉพาะเอนทิตี้ในเลเยอร์ที่มองเห็นอยู่ตอนนี้ — ส่งออกตามที่ตาเห็นจริง) */
  var EXPORT_PAD_MM = 20;    // ระยะขอบรอบแบบตอนส่งออก (มม.)
  var EXPORT_LINE_MM = 0.3;  // ความหนาเส้นมาตรฐานตอนส่งออก (มม. — ใกล้เคียงเส้นบางในงานเขียนแบบจริง)

  function computeSceneBBox() {
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    state.entities.forEach(function (e) {
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      entityBoundsPoints(e).forEach(function (p) {
        if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
        if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
      });
    });
    if (!isFinite(minx)) return null;
    return { minx: minx - EXPORT_PAD_MM, miny: miny - EXPORT_PAD_MM, maxx: maxx + EXPORT_PAD_MM, maxy: maxy + EXPORT_PAD_MM };
  }

  function downloadBlob(content, filename, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function exportFilenameBase() {
    var d = new Date();
    return 'tanot-cad-' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes());
  }

  /* วาดเอนทิตี้ทั้งหมด (ที่มองเห็น) ลงบน context ที่กำหนด — ใช้ระบบพิกัดของตัวเองแยกจาก state.view เสมอ
     (ไม่ผูกกับตำแหน่งที่กำลังมองอยู่บนจอ ณ ขณะกดส่งออก — auto-fit ทั้งแบบทุกครั้ง) */
  function renderEntitiesForExport(c, bbox, pxPerMm) {
    var h = (bbox.maxy - bbox.miny) * pxPerMm;
    function w2s(x, y) { return { x: (x - bbox.minx) * pxPerMm, y: h - (y - bbox.miny) * pxPerMm }; }
    function poly(pts, closed) {
      if (pts.length < 2) return;
      c.beginPath();
      var s0 = w2s(pts[0].x, pts[0].y); c.moveTo(s0.x, s0.y);
      for (var i = 1; i < pts.length; i++) { var s = w2s(pts[i].x, pts[i].y); c.lineTo(s.x, s.y); }
      if (closed) c.closePath();
      c.stroke();
    }
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, (bbox.maxx - bbox.minx) * pxPerMm, h);
    c.lineWidth = Math.max(1, EXPORT_LINE_MM * pxPerMm);
    state.entities.forEach(function (e) {
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      c.strokeStyle = layer.color || '#1F2430'; c.fillStyle = c.strokeStyle;
      if (e.type === 'line') poly([e.p1, e.p2], false);
      else if (e.type === 'polyline') poly(e.points, !!e.closed);
      else if (e.type === 'rect') poly(rectCorners(e), true);
      else if (e.type === 'circle') { var cc = w2s(e.center.x, e.center.y); c.beginPath(); c.ellipse(cc.x, cc.y, e.radius * pxPerMm, e.radius * pxPerMm, 0, 0, Math.PI * 2); c.stroke(); }
      else if (e.type === 'arc') poly(arcPoints(e), false);
      else if (e.type === 'dim') {
        var dl = dimLinePoints(e);
        poly([e.p1, dl.dimP1], false); poly([e.p2, dl.dimP2], false); poly([dl.dimP1, dl.dimP2], false);
        var dm = mid(dl.dimP1, dl.dimP2), dms = w2s(dm.x, dm.y);
        var dLen = Math.hypot(e.p2.x - e.p1.x, e.p2.y - e.p1.y);
        c.font = Math.max(9, 3 * pxPerMm) + 'px Prompt, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom';
        c.fillText(fmtMm(dLen) + ' ' + t('mmUnit'), dms.x, dms.y - 4);
      } else if (e.type === 'raddim') {
        var rlp = raddimLeaderPoint(e), rs1 = w2s(e.center.x, e.center.y), rs2 = w2s(rlp.x, rlp.y);
        c.beginPath(); c.moveTo(rs1.x, rs1.y); c.lineTo(rs2.x, rs2.y); c.stroke();
        c.font = Math.max(9, 3 * pxPerMm) + 'px Prompt, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText('R' + fmtMm(e.radius), rs2.x + 4, rs2.y);
      } else if (e.type === 'text') {
        var tsp = w2s(e.p.x, e.p.y);
        c.font = Math.max(6, e.height * pxPerMm) + 'px Prompt, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'bottom';
        c.fillText(e.text, tsp.x, tsp.y);
      }
    });
  }
  function exportPNG() {
    var bbox = computeSceneBBox();
    if (!bbox) { alert(t('exportEmptyWarn')); return; }
    var pxPerMm = 4; // ความละเอียดพิมพ์ที่ดี (~4px/mm ที่มาตราส่วน 1:1)
    var w = (bbox.maxx - bbox.minx) * pxPerMm, h = (bbox.maxy - bbox.miny) * pxPerMm;
    var MAXPX = 6000; // กันไฟล์ใหญ่เกินไปถ้าแบบกว้างมาก — ลดความละเอียดลงตามสัดส่วนแทนที่จะปฏิเสธ
    if (w > MAXPX || h > MAXPX) { var sc = MAXPX / Math.max(w, h); pxPerMm *= sc; w *= sc; h *= sc; }
    var off = document.createElement('canvas'); off.width = Math.max(1, Math.round(w)); off.height = Math.max(1, Math.round(h));
    renderEntitiesForExport(off.getContext('2d'), bbox, pxPerMm);
    off.toBlob(function (blob) { if (blob) downloadBlob(blob, exportFilenameBase() + '.png', 'image/png'); }, 'image/png');
  }

  function svgEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function buildSvgMarkup() {
    var bbox = computeSceneBBox();
    if (!bbox) return null;
    var w = bbox.maxx - bbox.minx, h = bbox.maxy - bbox.miny;
    function sx(x) { return (x - bbox.minx).toFixed(3); }
    function sy(y) { return (h - (y - bbox.miny)).toFixed(3); }
    function polyPath(pts, closed) {
      if (pts.length < 2) return '';
      var d = 'M ' + sx(pts[0].x) + ' ' + sy(pts[0].y);
      for (var i = 1; i < pts.length; i++) d += ' L ' + sx(pts[i].x) + ' ' + sy(pts[i].y);
      if (closed) d += ' Z';
      return d;
    }
    var parts = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + w.toFixed(2) + 'mm" height="' + h.toFixed(2) + 'mm" viewBox="0 0 ' + w.toFixed(3) + ' ' + h.toFixed(3) + '">',
      '<rect x="0" y="0" width="' + w.toFixed(3) + '" height="' + h.toFixed(3) + '" fill="#FFFFFF"/>',
      '<g fill="none" stroke-width="' + EXPORT_LINE_MM + '" font-family="Prompt, sans-serif">'];
    state.entities.forEach(function (e) {
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      var color = layer.color || '#1F2430';
      if (e.type === 'line') parts.push('<path d="' + polyPath([e.p1, e.p2], false) + '" stroke="' + color + '"/>');
      else if (e.type === 'polyline') parts.push('<path d="' + polyPath(e.points, !!e.closed) + '" stroke="' + color + '"/>');
      else if (e.type === 'rect') parts.push('<path d="' + polyPath(rectCorners(e), true) + '" stroke="' + color + '"/>');
      else if (e.type === 'circle') parts.push('<circle cx="' + sx(e.center.x) + '" cy="' + sy(e.center.y) + '" r="' + e.radius.toFixed(3) + '" stroke="' + color + '"/>');
      else if (e.type === 'arc') parts.push('<path d="' + polyPath(arcPoints(e), false) + '" stroke="' + color + '"/>');
      else if (e.type === 'dim') {
        var dl = dimLinePoints(e), dm = mid(dl.dimP1, dl.dimP2);
        var dLen = Math.hypot(e.p2.x - e.p1.x, e.p2.y - e.p1.y);
        parts.push('<path d="' + polyPath([e.p1, dl.dimP1], false) + '" stroke="' + color + '"/>');
        parts.push('<path d="' + polyPath([e.p2, dl.dimP2], false) + '" stroke="' + color + '"/>');
        parts.push('<path d="' + polyPath([dl.dimP1, dl.dimP2], false) + '" stroke="' + color + '"/>');
        parts.push('<text x="' + sx(dm.x) + '" y="' + (parseFloat(sy(dm.y)) - 1).toFixed(3) + '" font-size="3" fill="' + color + '" text-anchor="middle">' + svgEsc(fmtMm(dLen) + ' ' + t('mmUnit')) + '</text>');
      } else if (e.type === 'raddim') {
        var rlp = raddimLeaderPoint(e);
        parts.push('<path d="' + polyPath([e.center, rlp], false) + '" stroke="' + color + '"/>');
        parts.push('<text x="' + sx(rlp.x) + '" y="' + sy(rlp.y) + '" font-size="3" fill="' + color + '">' + svgEsc('R' + fmtMm(e.radius)) + '</text>');
      } else if (e.type === 'text') {
        parts.push('<text x="' + sx(e.p.x) + '" y="' + sy(e.p.y) + '" font-size="' + e.height.toFixed(2) + '" fill="' + color + '">' + svgEsc(e.text) + '</text>');
      }
    });
    parts.push('</g></svg>');
    return { svg: parts.join('\n'), w: w, h: h };
  }
  function exportSVG() {
    var built = buildSvgMarkup();
    if (!built) { alert(t('exportEmptyWarn')); return; }
    downloadBlob(built.svg, exportFilenameBase() + '.svg', 'image/svg+xml');
  }
  function exportPrintPDF() {
    var built = buildSvgMarkup();
    if (!built) { alert(t('exportEmptyWarn')); return; }
    var win = window.open('', '_blank');
    if (!win) { alert(t('popupBlocked')); return; }
    win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + svgEsc(exportFilenameBase()) + '</title>' +
      '<style>@page{size:auto;margin:10mm}body{margin:0;display:flex;justify-content:center}</style></head><body>' + built.svg + '</body></html>');
    win.document.close();
    win.addEventListener('load', function () { setTimeout(function () { win.print(); }, 200); });
  }

  /* DXF (Drawing Exchange Format) รูปแบบ ASCII R12 แบบย่อ — เปิดต่อในโปรแกรม CAD อื่นได้ (AutoCAD/LibreCAD/QCAD ฯลฯ)
     ขอบเขตที่ตัดออกไปโดยตั้งใจ: (1) ทุกเอนทิตี้ส่งไปที่เลเยอร์ "0" ของ DXF เดียวกันหมด ไม่แยกตามเลเยอร์ของ Tanot
     — เลเยอร์ "0" มีอยู่ในตัวมาตรฐาน DXF อยู่แล้ว ทำให้ไม่ต้องประกาศ TABLES/LAYER section เพิ่ม ไฟล์เล็กและใช้งาน
     ร่วมกับโปรแกรมอ่าน DXF ได้กว้างที่สุด (แลกกับการไม่รักษาการแบ่งเลเยอร์ข้ามโปรแกรม)
     (2) มิติเส้น/มิติรัศมี/ข้อความ ถูก "แตก" เป็น LINE/TEXT พื้นฐานแทนการใช้ DXF DIMENSION entity เต็มรูปแบบ (ซึ่งต้อง
     มีฟิลด์บังคับจำนวนมากและผูก associative geometry) เพื่อรับประกันว่าโปรแกรมอ่าน DXF ใดๆ ก็แสดงผลได้ถูกต้อง */
  function dxfLine(a, b) { return ['0', 'LINE', '8', '0', '10', a.x.toFixed(4), '20', a.y.toFixed(4), '30', '0', '11', b.x.toFixed(4), '21', b.y.toFixed(4), '31', '0']; }
  function dxfCircle(center, r) { return ['0', 'CIRCLE', '8', '0', '10', center.x.toFixed(4), '20', center.y.toFixed(4), '30', '0', '40', r.toFixed(4)]; }
  function dxfArc(center, r, a0, a1) {
    return ['0', 'ARC', '8', '0', '10', center.x.toFixed(4), '20', center.y.toFixed(4), '30', '0', '40', r.toFixed(4),
      '50', (a0 * 180 / Math.PI).toFixed(3), '51', (a1 * 180 / Math.PI).toFixed(3)];
  }
  function dxfText(p, height, str) { return ['0', 'TEXT', '8', '0', '10', p.x.toFixed(4), '20', p.y.toFixed(4), '30', '0', '40', height.toFixed(4), '1', str]; }
  function dxfLwpolyline(pts, closed) {
    var lines = ['0', 'LWPOLYLINE', '8', '0', '90', String(pts.length), '70', closed ? '1' : '0'];
    pts.forEach(function (p) { lines.push('10', p.x.toFixed(4), '20', p.y.toFixed(4)); });
    return lines;
  }
  function entityToDxfChunks(e) {
    if (e.type === 'line') return dxfLine(e.p1, e.p2);
    if (e.type === 'polyline') return dxfLwpolyline(e.points, !!e.closed);
    if (e.type === 'rect') return dxfLwpolyline(rectCorners(e), true);
    if (e.type === 'circle') return dxfCircle(e.center, e.radius);
    if (e.type === 'arc') return dxfArc(e.center, e.radius, e.startAngle, e.endAngle);
    if (e.type === 'text') return dxfText(e.p, e.height, e.text);
    if (e.type === 'dim') {
      var dl = dimLinePoints(e), dm = mid(dl.dimP1, dl.dimP2);
      var dLen = Math.hypot(e.p2.x - e.p1.x, e.p2.y - e.p1.y);
      return [].concat(dxfLine(e.p1, dl.dimP1), dxfLine(e.p2, dl.dimP2), dxfLine(dl.dimP1, dl.dimP2), dxfText({ x: dm.x, y: dm.y }, 3, fmtMm(dLen) + 'mm'));
    }
    if (e.type === 'raddim') {
      var rlp = raddimLeaderPoint(e);
      return [].concat(dxfLine(e.center, rlp), dxfText(rlp, 3, 'R' + fmtMm(e.radius)));
    }
    return [];
  }
  function exportDXF() {
    var bbox = computeSceneBBox();
    if (!bbox) { alert(t('exportEmptyWarn')); return; }
    var lines = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
    state.entities.forEach(function (e) {
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      lines = lines.concat(entityToDxfChunks(e));
    });
    lines = lines.concat(['0', 'ENDSEC', '0', 'EOF']);
    downloadBlob(lines.join('\r\n') + '\r\n', exportFilenameBase() + '.dxf', 'application/dxf');
  }

  /* นำเข้า DXF: อ่านเฉพาะ ENTITIES section รองรับ LINE/CIRCLE/ARC/LWPOLYLINE/TEXT (ชนิดที่ตัวส่งออกของเราเองสร้าง
     และเป็นชุดพื้นฐานที่สุดที่โปรแกรม CAD อื่นก็ใช้กันทั่วไป) — เอนทิตี้ที่นำเข้าจะถูก "เพิ่ม" ต่อท้ายแบบปัจจุบัน
     (ไม่ล้างของเดิม) ลงเลเยอร์ที่ใช้งานอยู่ตอนนี้ทั้งหมด (ไฟล์ DXF ต้นทางอาจมีเลเยอร์ที่ไม่ตรงกับของเรา) */
  function isFiniteNum(v) { return typeof v === 'number' && isFinite(v); }
  function parseDxf(text) {
    var lines = text.split(/\r\n|\r|\n/);
    var pairs = [];
    for (var i = 0; i + 1 < lines.length; i += 2) pairs.push({ code: (lines[i] || '').trim(), value: (lines[i + 1] || '').replace(/\r$/, '') });
    var idx = 0;
    while (idx < pairs.length - 1 && !(pairs[idx].code === '0' && pairs[idx].value.trim() === 'SECTION' &&
      pairs[idx + 1].code === '2' && pairs[idx + 1].value.trim() === 'ENTITIES')) idx++;
    idx += 2; // ข้าม 0/SECTION + 2/ENTITIES ไปยังเอนทิตี้แรก
    var out = [];
    while (idx < pairs.length) {
      if (pairs[idx].code !== '0') { idx++; continue; }
      var typeVal = pairs[idx].value.trim();
      if (typeVal === 'ENDSEC' || !typeVal) break;
      idx++;
      var g = {}, verts = [];
      while (idx < pairs.length && pairs[idx].code !== '0') {
        var code = pairs[idx].code, val = pairs[idx].value;
        if (typeVal === 'LWPOLYLINE' && code === '10') verts.push({ x: parseFloat(val), y: 0 });
        else if (typeVal === 'LWPOLYLINE' && code === '20' && verts.length) verts[verts.length - 1].y = parseFloat(val);
        else g[code] = val;
        idx++;
      }
      var ent = null;
      if (typeVal === 'LINE') {
        var p1 = { x: parseFloat(g['10']), y: parseFloat(g['20']) }, p2 = { x: parseFloat(g['11']), y: parseFloat(g['21']) };
        if (isFiniteNum(p1.x) && isFiniteNum(p1.y) && isFiniteNum(p2.x) && isFiniteNum(p2.y)) ent = { type: 'line', layer: state.activeLayer, p1: p1, p2: p2 };
      } else if (typeVal === 'CIRCLE') {
        var cc = { x: parseFloat(g['10']), y: parseFloat(g['20']) }, r = parseFloat(g['40']);
        if (isFiniteNum(cc.x) && isFiniteNum(cc.y) && isFiniteNum(r) && r > 0) ent = { type: 'circle', layer: state.activeLayer, center: cc, radius: r };
      } else if (typeVal === 'ARC') {
        var ac = { x: parseFloat(g['10']), y: parseFloat(g['20']) }, ar = parseFloat(g['40']);
        var a0 = parseFloat(g['50']), a1 = parseFloat(g['51']);
        if (isFiniteNum(ac.x) && isFiniteNum(ac.y) && isFiniteNum(ar) && ar > 0 && isFiniteNum(a0) && isFiniteNum(a1))
          ent = { type: 'arc', layer: state.activeLayer, center: ac, radius: ar, startAngle: a0 * Math.PI / 180, endAngle: a1 * Math.PI / 180 };
      } else if (typeVal === 'LWPOLYLINE') {
        var validVerts = verts.filter(function (p) { return isFiniteNum(p.x) && isFiniteNum(p.y); });
        if (validVerts.length >= 2) ent = { type: 'polyline', layer: state.activeLayer, points: validVerts, closed: g['70'] === '1' };
      } else if (typeVal === 'TEXT') {
        var tp = { x: parseFloat(g['10']), y: parseFloat(g['20']) }, th = parseFloat(g['40']);
        if (isFiniteNum(tp.x) && isFiniteNum(tp.y) && (g['1'] || '').length) ent = { type: 'text', layer: state.activeLayer, p: tp, text: g['1'], height: (isFiniteNum(th) && th > 0) ? th : 3 };
      }
      if (ent) { ent.id = genId(); out.push(ent); }
    }
    return out;
  }
  function importDXF(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var ents;
      try { ents = parseDxf(String(reader.result)); } catch (err) { ents = null; }
      if (ents === null) { alert(t('importDxfError')); return; }
      if (!ents.length) { alert(t('importDxfEmpty')); return; }
      pushHistory();
      state.entities = state.entities.concat(ents);
      state.selectedIds = ents.map(function (e) { return e.id; });
      updateCountUI(); updateSelectionUI(); scheduleSave(); render();
      alert(t('importDxfSuccess', { n: ents.length }));
    };
    reader.onerror = function () { alert(t('importDxfError')); };
    reader.readAsText(file);
  }
  $('exportPngBtn').addEventListener('click', exportPNG);
  $('exportSvgBtn').addEventListener('click', exportSVG);
  $('exportDxfBtn').addEventListener('click', exportDXF);
  $('printBtn').addEventListener('click', exportPrintPDF);
  var importDxfInput = $('importDxfInput');
  $('importDxfBtn').addEventListener('click', function () { importDxfInput.click(); });
  importDxfInput.addEventListener('change', function () {
    var file = importDxfInput.files && importDxfInput.files[0];
    importDxfInput.value = ''; // เคลียร์ทันที เผื่อผู้ใช้อยากนำเข้าไฟล์ชื่อเดิมซ้ำ (change event ไม่ยิงถ้า value ไม่เปลี่ยน)
    if (file) importDXF(file);
  });

  /* ══════════════════ init ══════════════════ */
  function boot() {
    applyStaticI18n();
    restoreAutosave();
    $('snapToggleBtn').classList.toggle('active', state.snapOn);
    $('osnapToggleBtn').classList.toggle('active', state.osnapOn);
    $('orthoToggleBtn').classList.toggle('active', state.orthoOn);
    $('mirrorKeepBtn').classList.toggle('active', state.mirrorKeepOriginal);
    updateUndoRedoUI(); updateSelectionUI(); updateCountUI(); updateZoomUI(); renderLayersPanel();
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
