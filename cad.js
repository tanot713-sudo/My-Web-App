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
   Stage 4b/5b (ทำ Stage 4-5 ให้ครบตามแผนเดิม 7 stage): เพิ่มมิติเส้นผ่าศูนย์กลาง (diadim) + มิติมุม (angdim) +
   ลูกศรชี้ (leader) + ลายแรเงา (hatch) + สไตล์มิติเริ่มต้น (ความสูงตัวอักษร/ขนาดหัวลูกศร ปรับได้ทั้งค่าเริ่มต้น
   และรายเอนทิตี้), และ plot PDF ตามมาตราส่วนจริงด้วย jsPDF (เลือกกระดาษ A4/A3/A1 + แนว + มาตราส่วนมาตรฐาน
   1:1 ถึง 1:500 หรือพอดีหน้ากระดาษ) แยกจากปุ่ม "พิมพ์/PDF" เดิมที่ยังคงไว้เป็นทางลัดพิมพ์แบบง่าย
   Stage 6: คลังบล็อก/สัญลักษณ์มาตรฐาน (ประตู/หน้าต่าง/สุขภัณฑ์/ไฟฟ้า ฯลฯ) + เครื่องมือแทรกบล็อกคำนวณสเกลจากขนาด
   จริงที่พิมพ์ + ตารางรายการแบบ (title block) มาตรฐานไทย
   Stage 7 (จุดเริ่มของแผนขยายงานวิศวกรรมเครื่องกล — spline/NURBS → planegcs → OpenCascade.js ฯลฯ): เพิ่มเอนทิตี้
   เส้นโค้งสปไลน์ (spline) — คลิกจุดควบคุมเรียงกันเหมือนพอลีไลน์ แต่วาดเป็นเส้นโค้งเรียบผ่านจุดเหล่านั้นจริง
   (Catmull-Rom interpolating spline) แทนเส้นตรงต่อกัน ใช้รูปแบบข้อมูล {points,closed} เดียวกับพอลีไลน์เป๊ะ
   (ได้ mapEntityPoints/entityGrips/transform ฟรีจากโครงสร้างเดิม) ต่างแค่ตอน render/hit-test/bounds/export ที่
   สุ่มจุดตามเส้นโค้งจริงผ่าน splinePoints() แทนการต่อจุดควบคุมตรงๆ
   Stage 8: ตัวแก้สมการข้อจำกัดเรขาคณิต 2 มิติ (2D geometric constraint solver) ผ่าน planegcs (wasm ของ
   FreeCAD's PlaneGCS, vendor ไว้ที่ vendor/planegcs/ โหลดแบบ lazy dynamic import() เฉพาะตอนใช้เครื่องมือ
   นี้ครั้งแรก) รองรับข้อจำกัด 11 ชนิด: จุดตรงกัน/แนวนอน/แนวตั้ง/ขนาน/ตั้งฉาก/เท่ากัน/สัมผัส/ระยะห่างคงที่/
   มุมคงที่/สมมาตร/ตรึงตำแหน่ง — ใช้ได้เฉพาะเอนทิตี้ line/circle เท่านั้น (ขอบเขตที่ตัดออกไปตั้งใจ ไม่รองรับ
   arc/polyline ในสเตจนี้) แก้สมการแบบ "กดยืนยัน" ไม่ใช่ live-solve ทุกการแก้ไข: แก้สมการอัตโนมัติทันทีที่
   เพิ่มข้อจำกัดใหม่ และมีปุ่ม "แก้สมการทั้งหมด" ให้กดซ้ำเองได้ทุกเมื่อ (เช่น หลังลากจุดจับแก้ไขเอนทิตี้ที่มี
   ข้อจำกัดอยู่แล้วให้หลุดตำแหน่งไป)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LANG_KEY = 'tanot:doclang';
  var AUTOSAVE_KEY = 'tanot:cad:autosave';

  var I18N = {
    th: {
      docTitle: 'งานเขียนแบบ CAD | Tanot',
      crumbResp: 'งานที่รับผิดชอบ', crumbCad: 'งานเขียนแบบ CAD (2D + 3D)',
      pageTitle: 'งานเขียนแบบ CAD',
      pageDesc: 'วาดแบบ 2 มิติด้วยพิกัดมิลลิเมตรจริง แล้วขึ้นรูปเป็นทรงตัน 3 มิติต่อได้ในหน้าเดียวกัน — เส้น/พอลีไลน์/สี่เหลี่ยม/วงกลม/ส่วนโค้ง พิมพ์ระยะ-มุมเป๊ะได้ จับจุดวัตถุ + โหมดตั้งฉาก',
      tab2dLbl: '📐 ร่างภาพ 2 มิติ', tab3dLbl: '🧊 มุมมอง 3 มิติ',
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
      importDxfEmpty: 'ไม่พบเอนทิตี้ที่รองรับในไฟล์ DXF นี้ (รองรับ LINE/CIRCLE/ARC/LWPOLYLINE/TEXT)',
      toolDiadim: '⌀⌀ มิติเส้นผ่าศูนย์กลาง', toolAngdim: '∠ มิติมุม', toolLeader: '➹ ลูกศรชี้', toolHatch: '▤ แรเงา',
      diadimHint: 'คลิกวงกลมหรือส่วนโค้งที่จะใส่มิติเส้นผ่าศูนย์กลาง',
      angdimHintPick: 'คลิกเลือกเส้นตรง 2 เส้นที่จะวัดมุม',
      angdimHintPlace: 'คลิกตำแหน่งที่จะวางส่วนโค้งแสดงมุม',
      leaderHint: 'คลิกจุดที่จะชี้ แล้วคลิกตำแหน่งข้อความ แล้วพิมพ์ข้อความ',
      hatchHintPick: 'คลิกสี่เหลี่ยม/วงกลม/พอลีไลน์ปิด ที่จะแรเงา',
      hatchHintApply: 'ปรับระยะห่าง/มุมลายเส้น แล้วกด "แรเงา" เพื่อยืนยัน',
      hatchSpacingLbl: 'ระยะห่างลาย (มม.)', hatchAngleLbl: 'มุมลาย (°)', hatchApplyBtn: '✔️ แรเงา',
      dimStyleTitle: 'สไตล์มิติเริ่มต้น', dimTextHeightLbl: 'ตัวอักษรมิติ (มม.)', dimArrowSizeLbl: 'หัวลูกศร (มม.)',
      propsTitleDiadim: 'คุณสมบัติ: มิติเส้นผ่าศูนย์กลาง', propsTitleAngdim: 'คุณสมบัติ: มิติมุม',
      propsTitleLeader: 'คุณสมบัติ: ลูกศรชี้', propsTitleHatch: 'คุณสมบัติ: แรเงา',
      propArrowSize: 'ขนาดหัวลูกศร (มม.)', propSpacing: 'ระยะห่างลาย (มม.)', propHatchAngle: 'มุมลาย (°)',
      plotTitle: 'จัดพิมพ์ตามมาตราส่วนจริง (PDF)', plotPaperLbl: 'ขนาดกระดาษ', plotOrientLbl: 'แนวกระดาษ',
      plotScaleLbl: 'มาตราส่วน', plotGenerateBtn: '📄 สร้าง PDF', plotHint: 'เลือกกระดาษ/แนว/มาตราส่วน แล้วกด "สร้าง PDF" — วาดแบบตามมาตราส่วนจริงแบบเวกเตอร์ พร้อมกรอบและป้ายมาตราส่วน',
      plotOrientPortrait: 'แนวตั้ง', plotOrientLandscape: 'แนวนอน', plotOrientAuto: 'อัตโนมัติ', plotScaleFit: 'พอดีหน้ากระดาษ',
      pdfLibMissing: 'โหลดไลบรารีสร้าง PDF ไม่สำเร็จ — เช็คอินเทอร์เน็ตแล้วลองใหม่',
      plotOverflowConfirm: 'แบบมีขนาดใหญ่กว่ากระดาษที่มาตราส่วนนี้ — พิมพ์ต่อไปโดยอาจมีบางส่วนล้นขอบกระดาษ?',
      toolBlock: '📦 แทรกบล็อก', toolTitleBlock: '🗂️ ตารางรายการแบบ',
      blockSizeLbl: 'ขนาดจริง (มม.)', blockRotLbl: 'มุมหมุน (°)', blockMirrorToggle: '🔄 มิเรอร์', blockApplyBtn: '✔️ แทรก',
      blockHint: 'เลือกสัญลักษณ์จากรายการ แล้วคลิกตำแหน่งที่จะแทรก ปรับขนาด/มุม/มิเรอร์ แล้วกด "แทรก"',
      titleBlockHint: 'คลิกตำแหน่งมุมล่างซ้ายที่จะวางตารางรายการแบบ (แก้ข้อความ/ขนาดทีหลังได้ด้วยเครื่องมือเลือกปกติ)',
      blockDoor1: 'ประตูบานเดี่ยว', blockDoor2: 'ประตูบานคู่', blockWindow: 'หน้าต่าง',
      blockToilet: 'โถสุขภัณฑ์', blockSink: 'อ่างล้างหน้า', blockBathtub: 'อ่างอาบน้ำ',
      blockOutlet: 'เต้ารับไฟฟ้า', blockSwitch: 'สวิตช์ไฟ', blockLight: 'โคมไฟเพดาน',
      propsTitleBlock: 'คุณสมบัติ: บล็อก/สัญลักษณ์', propBlockSize: 'ขนาดจริง (มม.)', propBlockRotation: 'มุมหมุน (°)', propBlockMirror: 'มิเรอร์',
      toolSpline: '∿ สปไลน์', splineHint: 'คลิกจุดควบคุมเรียงกัน แล้วกด "จบเส้นพอลีไลน์" หรือดับเบิลคลิกเพื่อจบเป็นเส้นโค้งเรียบ',
      propsTitleSpline: 'คุณสมบัติ: สปไลน์', propSplineNote: 'สปไลน์มี {n} จุดควบคุม — ลากจุดสี่เหลี่ยมบนเส้นเพื่อแก้รูปทรงโค้งโดยตรง',
      toolConstraint: '🔗 ข้อจำกัด',
      constraintCoincident: 'จุดตรงกัน (เส้น 2 เส้น)', constraintHorizontal: 'แนวนอน (เส้น 1 เส้น)', constraintVertical: 'แนวตั้ง (เส้น 1 เส้น)',
      constraintParallel: 'ขนาน (เส้น 2 เส้น)', constraintPerpendicular: 'ตั้งฉาก (เส้น 2 เส้น)', constraintEqual: 'เท่ากัน (เส้น/วงกลม 2 ชิ้นชนิดเดียวกัน)',
      constraintTangent: 'สัมผัส (เส้น-วงกลม หรือ วงกลม-วงกลม)', constraintDistance: 'ระยะห่างคงที่ (เส้น 1 เส้น)', constraintAngle: 'มุมคงที่ (เส้น 2 เส้น)',
      constraintSymmetric: 'สมมาตร (เส้น 2 เส้น + แกน 1 เส้น)', constraintFix: 'ตรึงตำแหน่ง (เส้น/วงกลม 1 ชิ้น)',
      constraintsTitle: 'ข้อจำกัดเรขาคณิต', constraintSolveBtn: '🧮 แก้สมการทั้งหมด',
      constraintHint: 'เลือกชนิดข้อจำกัด แล้วคลิกเส้น/วงกลมตามจำนวนที่ต้องการ (ระยะ/มุมคงที่ต้องพิมพ์ค่าในช่องระยะ/มุมด้านบนแล้วกด Enter) — ใช้ได้กับเส้นตรงและวงกลมเท่านั้น',
      constraintEmpty: 'ยังไม่มีข้อจำกัด', constraintWrongTypes: 'ชนิดเอนทิตี้ที่เลือกไม่ตรงกับข้อจำกัดนี้ (เช่น เท่ากัน/สัมผัส ต้องเป็นชนิดที่รองรับ)',
      constraintConflict: 'แก้สมการไม่สำเร็จ — ข้อจำกัดนี้ขัดแย้งกับข้อจำกัดที่มีอยู่ (ยกเลิกข้อจำกัดนี้แล้ว)',
      constraintLibLoadError: 'โหลดตัวแก้สมการไม่สำเร็จ — เช็คอินเทอร์เน็ตแล้วลองใหม่',
      backLink: '← กลับหน้างานที่รับผิดชอบ'
    },
    en: {
      docTitle: 'CAD Drafting | Tanot',
      crumbResp: 'Responsibilities', crumbCad: 'CAD Drafting (2D + 3D)',
      pageTitle: 'CAD Drafting',
      pageDesc: '2D drafting with real millimeter coordinates, now with 3D solid modeling in the same page — line/polyline/rectangle/circle/arc, precise distance & angle entry, object snap + ortho mode',
      tab2dLbl: '📐 2D Sketch', tab3dLbl: '🧊 3D View',
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
      importDxfEmpty: 'No supported entities found in this DXF file (supports LINE/CIRCLE/ARC/LWPOLYLINE/TEXT)',
      toolDiadim: '⌀⌀ Diameter dim', toolAngdim: '∠ Angle dim', toolLeader: '➹ Leader', toolHatch: '▤ Hatch',
      diadimHint: 'Click a circle or arc to add a diameter dimension',
      angdimHintPick: 'Click 2 straight lines to measure the angle between them',
      angdimHintPlace: 'Click where to place the angle arc',
      leaderHint: 'Click the point to indicate, then click where the text goes, then type it in',
      hatchHintPick: 'Click a rectangle / circle / closed polyline to hatch',
      hatchHintApply: 'Adjust the line spacing/angle, then click "Hatch" to confirm',
      hatchSpacingLbl: 'Line spacing (mm)', hatchAngleLbl: 'Line angle (°)', hatchApplyBtn: '✔️ Hatch',
      dimStyleTitle: 'Default dimension style', dimTextHeightLbl: 'Dim text (mm)', dimArrowSizeLbl: 'Arrowhead (mm)',
      propsTitleDiadim: 'Properties: Diameter dim', propsTitleAngdim: 'Properties: Angle dim',
      propsTitleLeader: 'Properties: Leader', propsTitleHatch: 'Properties: Hatch',
      propArrowSize: 'Arrowhead size (mm)', propSpacing: 'Line spacing (mm)', propHatchAngle: 'Line angle (°)',
      plotTitle: 'Plot to scale (PDF)', plotPaperLbl: 'Paper size', plotOrientLbl: 'Orientation',
      plotScaleLbl: 'Scale', plotGenerateBtn: '📄 Generate PDF', plotHint: 'Pick paper/orientation/scale, then click "Generate PDF" — draws the plan to true scale as vector graphics, with a border and scale label',
      plotOrientPortrait: 'Portrait', plotOrientLandscape: 'Landscape', plotOrientAuto: 'Auto', plotScaleFit: 'Fit to page',
      pdfLibMissing: 'Could not load the PDF library — check your connection and try again',
      plotOverflowConfirm: 'The drawing is larger than the page at this scale — plot anyway (some parts may run off the page)?',
      toolBlock: '📦 Insert block', toolTitleBlock: '🗂️ Title block',
      blockSizeLbl: 'Real size (mm)', blockRotLbl: 'Rotation (°)', blockMirrorToggle: '🔄 Mirror', blockApplyBtn: '✔️ Insert',
      blockHint: 'Pick a symbol from the list, click where to place it, adjust size/rotation/mirror, then click "Insert"',
      titleBlockHint: 'Click the bottom-left corner where the title block goes (edit its text/size afterward with the normal select tool)',
      blockDoor1: 'Single door', blockDoor2: 'Double door', blockWindow: 'Window',
      blockToilet: 'Toilet', blockSink: 'Sink', blockBathtub: 'Bathtub',
      blockOutlet: 'Electrical outlet', blockSwitch: 'Light switch', blockLight: 'Ceiling light',
      propsTitleBlock: 'Properties: Block/symbol', propBlockSize: 'Real size (mm)', propBlockRotation: 'Rotation (°)', propBlockMirror: 'Mirror',
      toolSpline: '∿ Spline', splineHint: 'Click control points in order, then click "Finish polyline" or double-click to finish as a smooth curve',
      propsTitleSpline: 'Properties: Spline', propSplineNote: 'Spline has {n} control points — drag a square grip on the curve to reshape it directly',
      toolConstraint: '🔗 Constraint',
      constraintCoincident: 'Coincident (2 lines)', constraintHorizontal: 'Horizontal (1 line)', constraintVertical: 'Vertical (1 line)',
      constraintParallel: 'Parallel (2 lines)', constraintPerpendicular: 'Perpendicular (2 lines)', constraintEqual: 'Equal (2 lines or 2 circles, same type)',
      constraintTangent: 'Tangent (line-circle or circle-circle)', constraintDistance: 'Fixed distance (1 line)', constraintAngle: 'Fixed angle (2 lines)',
      constraintSymmetric: 'Symmetric (2 lines + 1 axis line)', constraintFix: 'Fix in place (1 line or circle)',
      constraintsTitle: 'Geometric constraints', constraintSolveBtn: '🧮 Solve all',
      constraintHint: 'Pick a constraint type, then click the line(s)/circle(s) it needs (fixed distance/angle need a value typed into the distance/angle box above, then Enter) — lines and circles only',
      constraintEmpty: 'No constraints yet', constraintWrongTypes: "The entity types you picked don't fit this constraint (e.g. Equal/Tangent need supported types)",
      constraintConflict: 'Could not solve — this constraint conflicts with an existing one (it has been removed)',
      constraintLibLoadError: 'Could not load the constraint solver — check your connection and try again',
      backLink: '← Back to responsibilities'
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
  function entityById(id) { return state.entities.filter(function (e) { return e.id === id; })[0]; } // ใช้เยอะใน Stage 8 (constraint solver) — จุดอื่นในไฟล์ที่ต้องหาเอนทิตี้จาก id ยังใช้ .filter(...)[0] ตรงๆ ตามเดิม ไม่แก้ย้อนหลัง
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
    dimStyle: { textHeight: 3, arrowSize: 2.5 }, // สไตล์มิติเริ่มต้น (มม.) — ใช้ตอนสร้าง dim/raddim/diadim/angdim
                             // ใหม่ทุกครั้ง (เอนทิตี้แต่ละตัวเก็บค่าของตัวเองแยก แก้ทีหลังผ่านแผงคุณสมบัติได้
                             // ไม่กระทบของเดิม — ไม่ใช่ระบบ named style เต็มรูปแบบแบบ AutoCAD ตั้งใจให้ง่ายกว่านั้น)
    pendingPoints: [],       // จุดที่คลิกไปแล้วระหว่างวาด/ย้าย/หมุน/มิเรอร์/มิติเส้นเอนทิตี้ปัจจุบัน
    pendingEntityIds: [],    // เอนทิตี้ที่คลิกเลือกไว้แล้วสำหรับเครื่องมือ fillet/มิติมุม (ต้องการ 2 เส้น)
    trimCutterId: null,      // เอนทิตี้ที่เป็นเส้นตัด/เส้นขอบ สำหรับเครื่องมือ trim/extend
    offsetSourceId: null,    // เอนทิตี้ต้นทางสำหรับเครื่องมือ offset
    hatchSourcePts: null,    // จุดขอบเขต (snapshot) ของเอนทิตี้ที่เลือกไว้แล้วสำหรับเครื่องมือแรเงา (ก่อนกด "แรเงา")
    constraints: [],         // Stage 8: [{id, type, entities:[entityId,...], value}] — ดูรายละเอียดที่ CONSTRAINT_DEFS
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
     dim:      {p1:{x,y}, p2:{x,y}, offset, textHeight, arrowSize} (มิติเส้นตรง — offset = ระยะตั้งฉากมีเครื่องหมาย
                                                              จาก p1-p2 ไปยังตำแหน่งเส้นมิติที่วางจริง)
     raddim:   {center:{x,y}, radius, angle, textHeight, arrowSize} (มิติรัศมี — snapshot ค่า ณ ตอนสร้าง ไม่ผูกกับ
                                                              วงกลม/ส่วนโค้งต้นทางอีกต่อไป, angle = ทิศทางขีดนำ)
     diadim:   {center:{x,y}, radius, angle, textHeight, arrowSize} (มิติเส้นผ่าศูนย์กลาง — รูปแบบเดียวกับ raddim
                                                              เป๊ะ ต่างแค่ตอน render/export ที่ลากเส้นทะลุผ่าน
                                                              ศูนย์กลางทั้ง 2 ด้านแทนขีดเดียว และป้ายใช้ ⌀ ไม่ใช่ R)
     angdim:   {center:{x,y}, radius, startAngle, endAngle, textHeight, arrowSize} (มิติมุม — รูปแบบเดียวกับ arc
                                                              เป๊ะ (ใช้ arcPoints/แปลงรูปทรงร่วมกับ arc ได้เลย)
                                                              ต่างแค่ตอน render ที่เพิ่มเส้นช่วยขยาย+หัวลูกศร+ป้ายมุม)
     leader:   {p1:{x,y}, p2:{x,y}, text, height}            (ลูกศรชี้ — p1 คือปลายลูกศรที่ชี้ไปยังจุดสนใจ, p2 คือ
                                                              จุดเริ่มข้อความ)
     hatch:    {points:[{x,y},...], spacing, angle}          (ลายแรเงา — snapshot ขอบเขตปิด ณ ตอนสร้าง ไม่ผูกกับ
                                                              เอนทิตี้ต้นทางอีกต่อไป, เส้นลายคำนวณสดทุกครั้งจาก
                                                              points/spacing/angle ผ่าน hatchLines())
     block:    {blockId, p:{x,y}, scale, rotation, mirrored}  (บล็อก/สัญลักษณ์จากคลัง BLOCK_LIBRARY — p คือจุดแทรก,
                                                              scale = อัตราส่วนจากขนาดจริงที่ผู้ใช้กำหนด/baseSize
                                                              ของสัญลักษณ์, rotation หน่วยเรเดียน, mirrored พลิกซ้าย-ขวา)
     text:     {p:{x,y}, text, height}                       (คำอธิบายข้อความ — p คือมุมล่างซ้ายของข้อความ)
     spline:   {points:[{x,y},...], closed:bool}              (เส้นโค้งสปไลน์ — รูปแบบข้อมูลเดียวกับ polyline เป๊ะ
                                                              (points = จุดควบคุม) ต่างแค่ตอน render/hit-test/bounds/
                                                              export ที่สุ่มจุดตามเส้นโค้ง Catmull-Rom จริงผ่าน
                                                              splinePoints() แทนการต่อจุดควบคุมด้วยเส้นตรง) */

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
  /* จุดตามเส้นโค้งสปไลน์ (Catmull-Rom interpolating spline ผ่านจุดควบคุมทุกจุดจริง ไม่ใช่แค่ผ่านใกล้ๆ แบบ B-spline
     ทั่วไป — เลือกแบบนี้เพราะผู้ใช้คลิกจุดที่ต้องการให้เส้นโค้ง "ผ่านตรงนั้นเป๊ะ" เหมือนพฤติกรรมเริ่มต้นของคำสั่ง
     SPLINE ในโปรแกรม CAD ทั่วไป) — ที่ปลายสุด (ไม่ปิด) ใช้จุดปลายซ้ำแทนจุดควบคุมที่ไม่มีจริง (clamped ends)
     segN = จำนวนช่วงย่อยต่อ 1 ช่วงจุดควบคุม (ยิ่งมากยิ่งเรียบ, ใช้ค่าน้อยลงได้ตอนต้องการแค่กะ bounds คร่าวๆ) */
  function catmullRomPoint(p0, p1, p2, p3, tt) {
    var t2 = tt * tt, t3 = t2 * tt;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * tt + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * tt + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  }
  function splinePoints(e, segN) {
    segN = segN || 16;
    var pts = e.points, n = pts.length;
    if (n < 2) return pts.slice();
    if (n === 2) return [pts[0], pts[1]]; // สองจุด = ไม่มีเส้นโค้งให้คำนวณ เป็นแค่เส้นตรง
    var closed = !!e.closed;
    function at(i) { return closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]; }
    var out = [], segs = closed ? n : n - 1;
    for (var i = 0; i < segs; i++) {
      var p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (var j = 0; j < segN; j++) out.push(catmullRomPoint(p0, p1, p2, p3, j / segN));
    }
    if (closed) out.push(out[0]); else out.push(pts[n - 1]);
    return out;
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
  /* มิติเส้นผ่าศูนย์กลาง (diadim) ใช้รูปแบบข้อมูลเดียวกับ raddim เป๊ะ ({center,radius,angle}) — จุดปลายด้านหนึ่ง
     คือ raddimLeaderPoint(e) เดิม อีกด้านคือจุดตรงข้ามผ่านศูนย์กลาง คำนวณสดทุกครั้งจากสองค่านี้ */
  function diaEndpoints(e) {
    var p1 = raddimLeaderPoint(e);
    return { p1: p1, p2: { x: 2 * e.center.x - p1.x, y: 2 * e.center.y - p1.y } };
  }
  function estimateTextWidth(text, height) { return (text || '').length * height * 0.58; } // ประมาณความกว้าง (ไม่มีการวัดฟอนต์จริงในสเตจนี้)
  /* จุดอยู่ในรูปหลายเหลี่ยมปิดไหม (even-odd rule) — ใช้กับการคลิกเลือกลายแรเงา (คลิกที่ไหนในพื้นที่ก็เลือกได้ ไม่ใช่
     แค่ตรงเส้นลายพอดี เหมือนโปรแกรม CAD ทั่วไป) */
  function pointInPolygon(p, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      var intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  /* คำนวณเส้นลายแรเงา (hatch): หมุนพิกัดให้เส้นลายอยู่แนวนอนชั่วคราว (ทำงานง่ายกว่ามาก), กวาดเส้นแนวนอนทีละ
     spacing ตัดกับขอบเขตรูปหลายเหลี่ยมด้วย even-odd scanline algorithm มาตรฐาน (นับจุดตัดตามแนวนอน จับคู่เข้า-ออก
     สลับกัน) แล้วหมุนกลับ — คำนวณสดทุกครั้งที่ใช้ (ไม่เก็บผลลัพธ์ไว้) จาก points/spacing/angle เท่านั้น */
  function hatchLines(e) {
    var cosN = Math.cos(-e.angle), sinN = Math.sin(-e.angle), cosP = Math.cos(e.angle), sinP = Math.sin(e.angle);
    function toLocal(p) { return { x: p.x * cosN - p.y * sinN, y: p.x * sinN + p.y * cosN }; }
    function toWorld(p) { return { x: p.x * cosP - p.y * sinP, y: p.x * sinP + p.y * cosP }; }
    var pts = e.points.map(toLocal);
    var n = pts.length;
    if (n < 3) return [];
    var minY = Infinity, maxY = -Infinity;
    pts.forEach(function (p) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; });
    var spacing = Math.max(0.1, e.spacing || 5);
    var segs = [], startK = Math.ceil((minY + 1e-6) / spacing);
    for (var k = startK; k * spacing <= maxY - 1e-6; k++) {
      var y = k * spacing, xs = [];
      for (var i = 0; i < n; i++) {
        var a = pts[i], b = pts[(i + 1) % n];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x));
      }
      xs.sort(function (p1, p2) { return p1 - p2; });
      for (var j = 0; j + 1 < xs.length; j += 2) segs.push([toWorld({ x: xs[j], y: y }), toWorld({ x: xs[j + 1], y: y })]);
    }
    return segs;
  }
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
    if (e.type === 'arc' || e.type === 'angdim') return distPointToArc(p, e);
    if (e.type === 'spline') {
      var sp = splinePoints(e), sd = Infinity;
      for (var si = 0; si < sp.length - 1; si++) sd = Math.min(sd, distPointToSegment(p, sp[si], sp[si + 1]));
      return sd;
    }
    if (e.type === 'dim') { var dl = dimLinePoints(e); return distPointToSegment(p, dl.dimP1, dl.dimP2); }
    if (e.type === 'raddim') return distPointToSegment(p, e.center, raddimLeaderPoint(e));
    if (e.type === 'diadim') { var de = diaEndpoints(e); return distPointToSegment(p, de.p1, de.p2); }
    if (e.type === 'leader') {
      var lw = estimateTextWidth(e.text, e.height);
      return Math.min(distPointToSegment(p, e.p1, e.p2), distPointToRect(p, e.p2.x, e.p2.y, e.p2.x + lw, e.p2.y + e.height));
    }
    if (e.type === 'hatch') {
      if (pointInPolygon(p, e.points)) return 0;
      var hd = Infinity;
      for (var k = 0; k < e.points.length; k++) hd = Math.min(hd, distPointToSegment(p, e.points[k], e.points[(k + 1) % e.points.length]));
      return hd;
    }
    if (e.type === 'text') {
      var w = estimateTextWidth(e.text, e.height);
      return distPointToRect(p, e.p.x, e.p.y, e.p.x + w, e.p.y + e.height);
    }
    if (e.type === 'block') {
      var sym = BLOCK_LIBRARY[e.blockId];
      if (!sym) return Infinity;
      var bd = Infinity;
      sym.entities.forEach(function (sub) { bd = Math.min(bd, distPointToEntity(p, transformBlockSubEntity(sub, e))); });
      return bd;
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
    else if (e.type === 'arc' || e.type === 'angdim') {
      pts.push({ p: e.center, kind: 'center' });
      pts.push({ p: { x: e.center.x + e.radius * Math.cos(e.startAngle), y: e.center.y + e.radius * Math.sin(e.startAngle) }, kind: 'end' });
      pts.push({ p: { x: e.center.x + e.radius * Math.cos(e.endAngle), y: e.center.y + e.radius * Math.sin(e.endAngle) }, kind: 'end' });
    } else if (e.type === 'dim') {
      var dl0 = dimLinePoints(e);
      pts.push({ p: dl0.dimP1, kind: 'end' }, { p: dl0.dimP2, kind: 'end' });
    } else if (e.type === 'raddim') { pts.push({ p: e.center, kind: 'center' }, { p: raddimLeaderPoint(e), kind: 'end' }); }
    else if (e.type === 'diadim') { var de0 = diaEndpoints(e); pts.push({ p: e.center, kind: 'center' }, { p: de0.p1, kind: 'end' }, { p: de0.p2, kind: 'end' }); }
    else if (e.type === 'leader') { pts.push({ p: e.p1, kind: 'end' }, { p: e.p2, kind: 'end' }); }
    else if (e.type === 'text') { pts.push({ p: e.p, kind: 'end' }); }
    else if (e.type === 'block') { pts.push({ p: e.p, kind: 'end' }); }
    else if (e.type === 'spline') { e.points.forEach(function (p) { pts.push({ p: p, kind: 'end' }); }); } // จุดควบคุมเท่านั้น (จุดกึ่งกลางเส้นตรงจะไม่ตรงกับเส้นโค้งจริง เลยไม่ใส่)
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
    if (e.type === 'arc' || e.type === 'angdim') { var pts = arcPoints(e, 16); pts.push(e.center); return pts; }
    if (e.type === 'dim') { var dl1 = dimLinePoints(e); return [e.p1, e.p2, dl1.dimP1, dl1.dimP2]; }
    if (e.type === 'raddim') return [e.center, raddimLeaderPoint(e)];
    if (e.type === 'diadim') { var de1 = diaEndpoints(e); return [de1.p1, de1.p2]; }
    if (e.type === 'leader') { var lw2 = estimateTextWidth(e.text, e.height); return [e.p1, e.p2, { x: e.p2.x + lw2, y: e.p2.y + e.height }]; }
    if (e.type === 'hatch') return e.points;
    if (e.type === 'text') { var w2 = estimateTextWidth(e.text, e.height); return [e.p, { x: e.p.x + w2, y: e.p.y + e.height }]; }
    if (e.type === 'block') {
      var sym = BLOCK_LIBRARY[e.blockId];
      if (!sym) return [e.p];
      var bpts = [];
      sym.entities.forEach(function (sub) { entityBoundsPoints(transformBlockSubEntity(sub, e)).forEach(function (p) { bpts.push(p); }); });
      return bpts.length ? bpts : [e.p];
    }
    if (e.type === 'spline') return splinePoints(e, 8); // 8 พอสำหรับ bounds/zoomFit/drag-select คร่าวๆ ไม่ต้องเรียบเท่าตอน render จริง
    return [];
  }

  /* ══════════════════ บล็อก/สัญลักษณ์ (Stage 6) ══════════════════
     คลังสัญลักษณ์มาตรฐานงานสถาปัตย์/งานระบบ — แต่ละสัญลักษณ์นิยามในพิกัดท้องถิ่น (origin 0,0 = จุดแทรก) หน่วย มม.
     ที่ "ขนาดจริงมาตรฐาน" ของตัวเอง (baseSize) เช่น ประตูกว้าง 900 มม. ตอนแทรกจริงผู้ใช้พิมพ์ "ขนาดจริง" ที่ต้องการ
     แล้วระบบคำนวณ scale = ขนาดที่พิมพ์ / baseSize ให้เอง (ใช้งานง่ายกว่าพิมพ์ตัวคูณสเกลตรงๆ)
     เอนทิตี้ย่อยในสัญลักษณ์รองรับเฉพาะชนิดพื้นฐาน (line/polyline/rect/circle/arc/text) เท่านั้น — ไม่ซ้อนบล็อกในบล็อก
     หรือใส่มิติเส้น/ลายแรเงาไว้ข้างในเพื่อความเรียบง่าย (ขอบเขตที่ตัดออกไปตั้งใจ) */
  var BLOCK_LIBRARY = {
    door1: { nameKey: 'blockDoor1', baseSize: 900, entities: [
      { type: 'line', p1: { x: 0, y: 0 }, p2: { x: 0, y: 900 } },
      { type: 'arc', center: { x: 0, y: 0 }, radius: 900, startAngle: 0, endAngle: Math.PI / 2 }
    ] },
    door2: { nameKey: 'blockDoor2', baseSize: 1800, entities: [
      { type: 'line', p1: { x: 0, y: 0 }, p2: { x: 0, y: 900 } },
      { type: 'arc', center: { x: 0, y: 0 }, radius: 900, startAngle: 0, endAngle: Math.PI / 2 },
      { type: 'line', p1: { x: 1800, y: 0 }, p2: { x: 1800, y: 900 } },
      { type: 'arc', center: { x: 1800, y: 0 }, radius: 900, startAngle: Math.PI / 2, endAngle: Math.PI }
    ] },
    window1: { nameKey: 'blockWindow', baseSize: 1200, entities: [
      { type: 'rect', p1: { x: 0, y: -50 }, p2: { x: 1200, y: 50 } },
      { type: 'line', p1: { x: 0, y: -16.667 }, p2: { x: 1200, y: -16.667 } },
      { type: 'line', p1: { x: 0, y: 16.667 }, p2: { x: 1200, y: 16.667 } }
    ] },
    toilet: { nameKey: 'blockToilet', baseSize: 400, entities: [
      { type: 'rect', p1: { x: -200, y: 400 }, p2: { x: 200, y: 550 } },
      { type: 'circle', center: { x: 0, y: 150 }, radius: 180 }
    ] },
    sink: { nameKey: 'blockSink', baseSize: 500, entities: [
      { type: 'rect', p1: { x: -250, y: 0 }, p2: { x: 250, y: 400 } },
      { type: 'circle', center: { x: 0, y: 200 }, radius: 150 }
    ] },
    bathtub: { nameKey: 'blockBathtub', baseSize: 700, entities: [
      { type: 'rect', p1: { x: 0, y: 0 }, p2: { x: 700, y: 1600 } },
      { type: 'rect', p1: { x: 60, y: 60 }, p2: { x: 640, y: 1540 } }
    ] },
    outlet: { nameKey: 'blockOutlet', baseSize: 150, entities: [
      { type: 'circle', center: { x: 0, y: 0 }, radius: 75 },
      { type: 'line', p1: { x: -50, y: -50 }, p2: { x: 50, y: 50 } },
      { type: 'line', p1: { x: -50, y: 50 }, p2: { x: 50, y: -50 } }
    ] },
    switch: { nameKey: 'blockSwitch', baseSize: 150, entities: [
      { type: 'circle', center: { x: 0, y: 0 }, radius: 75 },
      { type: 'text', p: { x: 20, y: -20 }, text: 'S', height: 100 }
    ] },
    light: { nameKey: 'blockLight', baseSize: 300, entities: [
      { type: 'circle', center: { x: 0, y: 0 }, radius: 150 },
      { type: 'line', p1: { x: -106, y: -106 }, p2: { x: 106, y: 106 } },
      { type: 'line', p1: { x: -106, y: 106 }, p2: { x: 106, y: -106 } }
    ] }
  };
  /* แปลงเอนทิตี้ย่อย (พิกัดท้องถิ่น) ของสัญลักษณ์ เป็นเอนทิตี้จริงในพิกัดโลก ตามค่าของ instance (จุดแทรก/สเกล/
     มุมหมุน/มิเรอร์) — มิเรอร์ทำโดยพลิกแกน X ท้องถิ่นก่อนหมุน (x → -x), ส่วนโค้งต้องพลิกทิศกวาด+สลับ start/end ด้วย
     (ใช้หลักการเดียวกับการมิเรอร์ข้ามเส้นแนวตั้งที่ reflectAng ในเครื่องมือมิเรอร์ทั่วไปใช้: มุมใหม่ = π - มุมเดิม) */
  function transformBlockSubEntity(sub, inst) {
    var mirrored = !!inst.mirrored, rot = inst.rotation || 0, scl = inst.scale || 1;
    function localToWorld(p) {
      var lx = mirrored ? -p.x : p.x, ly = p.y;
      var c = Math.cos(rot), s = Math.sin(rot);
      return { x: inst.p.x + (lx * c - ly * s) * scl, y: inst.p.y + (lx * s + ly * c) * scl };
    }
    var copy = deepClone(sub);
    mapEntityPoints(copy, localToWorld);
    if (copy.type === 'circle' || copy.type === 'arc') copy.radius *= scl;
    if (copy.type === 'arc') {
      if (mirrored) { copy.startAngle = Math.PI - sub.endAngle + rot; copy.endAngle = Math.PI - sub.startAngle + rot; }
      else { copy.startAngle = sub.startAngle + rot; copy.endAngle = sub.endAngle + rot; }
    }
    if (copy.type === 'text') copy.height *= scl;
    return copy;
  }
  /* แทรกตารางรายการแบบ (title block) แบบไทยมาตรฐาน — เป็นเอนทิตี้พื้นฐานล้วนๆ (line/rect/text) ไม่ใช่บล็อกที่แก้
     ทีหลังแบบ "smart" — ตั้งใจให้ง่าย: แก้ข้อความ/ขยับ/ย่อ-ขยายทีหลังได้ด้วยเครื่องมือเลือก+แก้ไขปกติทั้งหมด
     ขนาดเริ่มต้น 3000×800 มม., ตัวอักษรสูง 120 มม. (พอดีตัวที่มาตราส่วน 1:50 ~2.4มม.บนกระดาษ ตามธรรมเนียมงานพิมพ์) */
  function buildTitleBlockEntities(anchor, layer) {
    var W = 3000, H = 800, TH = 120;
    var x0 = anchor.x, y0 = anchor.y;
    var mk = function (type, extra) { return Object.assign({ id: genId(), type: type, layer: layer }, extra); };
    var out = [];
    out.push(mk('rect', { p1: { x: x0, y: y0 }, p2: { x: x0 + W, y: y0 + H } }));
    out.push(mk('line', { p1: { x: x0, y: y0 + H - 400 }, p2: { x: x0 + W, y: y0 + H - 400 } }));
    [1, 2, 3].forEach(function (i) {
      var lx = x0 + i * (W / 4);
      out.push(mk('line', { p1: { x: lx, y: y0 }, p2: { x: lx, y: y0 + H - 400 } }));
    });
    out.push(mk('text', { p: { x: x0 + 40, y: y0 + H - 130 }, text: 'ชื่อโครงการ: .................................................', height: TH }));
    out.push(mk('text', { p: { x: x0 + 40, y: y0 + H - 320 }, text: 'ชื่อแบบ: .................................................', height: TH }));
    var labels = ['มาตราส่วน: ...........', 'วันที่: ...........', 'ผู้ออกแบบ: ...........', 'เลขที่แบบ: ...........'];
    labels.forEach(function (lbl, i) {
      out.push(mk('text', { p: { x: x0 + i * (W / 4) + 30, y: y0 + 30 }, text: lbl, height: TH * 0.7 }));
    });
    return out;
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
    else if (e.type === 'arc' || e.type === 'angdim') { e.center = fn(e.center); }
    else if (e.type === 'dim') { e.p1 = fn(e.p1); e.p2 = fn(e.p2); }
    else if (e.type === 'raddim' || e.type === 'diadim') { e.center = fn(e.center); }
    else if (e.type === 'leader') { e.p1 = fn(e.p1); e.p2 = fn(e.p2); }
    else if (e.type === 'hatch') { e.points = e.points.map(fn); }
    else if (e.type === 'text') { e.p = fn(e.p); }
    else if (e.type === 'block') { e.p = fn(e.p); }
    else if (e.type === 'spline') { e.points = e.points.map(fn); }
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
      if (mods.rotateDeltaRad != null && (src.type === 'arc' || src.type === 'angdim')) { src.startAngle += mods.rotateDeltaRad; src.endAngle += mods.rotateDeltaRad; }
      if (mods.rotateDeltaRad != null && (src.type === 'raddim' || src.type === 'diadim')) src.angle += mods.rotateDeltaRad;
      if (mods.rotateDeltaRad != null && src.type === 'hatch') src.angle += mods.rotateDeltaRad;
      if (mods.rotateDeltaRad != null && src.type === 'block') src.rotation += mods.rotateDeltaRad;
      if (mods.mirrorLine) {
        var phi = Math.atan2(mods.mirrorLine.b.y - mods.mirrorLine.a.y, mods.mirrorLine.b.x - mods.mirrorLine.a.x);
        var reflectAng = function (a) { return 2 * phi - a; };
        if (src.type === 'arc' || src.type === 'angdim') { var ns = reflectAng(src.endAngle), ne = reflectAng(src.startAngle); src.startAngle = ns; src.endAngle = ne; }
        else if (src.type === 'raddim' || src.type === 'diadim') src.angle = reflectAng(src.angle);
        else if (src.type === 'hatch') src.angle = reflectAng(src.angle);
        else if (src.type === 'dim') src.offset = -src.offset; // มิเรอร์กลับด้าน (chirality) ต้องพลิกเครื่องหมาย offset ด้วย ไม่งั้นเส้นมิติจะไปโผล่ผิดฝั่ง
        else if (src.type === 'block') { src.rotation = reflectAng(src.rotation); src.mirrored = !src.mirrored; }
      }
      if (mods.scaleFactor != null && (src.type === 'circle' || src.type === 'arc' || src.type === 'raddim' || src.type === 'diadim' || src.type === 'angdim')) src.radius *= mods.scaleFactor;
      if (mods.scaleFactor != null && src.type === 'dim') src.offset *= mods.scaleFactor;
      if (mods.scaleFactor != null && (src.type === 'text' || src.type === 'leader')) src.height *= mods.scaleFactor;
      if (mods.scaleFactor != null && src.type === 'hatch') src.spacing *= mods.scaleFactor;
      if (mods.scaleFactor != null && src.type === 'block') src.scale *= mods.scaleFactor;
      if (mods.scaleFactor != null && (src.type === 'dim' || src.type === 'raddim' || src.type === 'diadim' || src.type === 'angdim')) {
        src.textHeight *= mods.scaleFactor; src.arrowSize *= mods.scaleFactor; // สไตล์มิติ (ตัวอักษร/หัวลูกศร) ก็ต้องสเกลตามแบบด้วย ไม่งั้นดูไม่สมส่วนหลังสเกล
      }
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
    if (e.type === 'arc' || e.type === 'angdim') {
      var mAng = (e.startAngle + e.endAngle) / 2;
      return [{ p: e.center, ref: 'center' }, { p: { x: e.center.x + e.radius * Math.cos(mAng), y: e.center.y + e.radius * Math.sin(mAng) }, ref: 'radius' }];
    }
    if (e.type === 'dim') { var dl2 = dimLinePoints(e); return [{ p: e.p1, ref: 'p1' }, { p: e.p2, ref: 'p2' }, { p: dl2.dimP1, ref: 'dimoffset' }]; }
    if (e.type === 'raddim' || e.type === 'diadim') return [{ p: e.center, ref: 'center' }, { p: raddimLeaderPoint(e), ref: 'raddimleader' }];
    if (e.type === 'leader') return [{ p: e.p1, ref: 'p1' }, { p: e.p2, ref: 'p2' }];
    if (e.type === 'text' || e.type === 'block') return [{ p: e.p, ref: 'p' }];
    if (e.type === 'spline') return e.points.map(function (p, i) { return { p: p, ref: { idx: i } }; }); // ref รูปแบบเดียวกับ polyline — applyGripEdit จัดการให้ฟรีอยู่แล้ว
    return []; // hatch: ไม่มีจุดจับต่อจุด — ย้าย/หมุน/มิเรอร์/สเกลทั้งก้อนผ่านเครื่องมือแก้ไขปกติเท่านั้น
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

  /* ══════════════════ Stage 8: ตัวแก้สมการข้อจำกัดเรขาคณิต 2 มิติ (planegcs) ══════════════════
     รองรับเฉพาะเอนทิตี้ line/circle เท่านั้น (ตัดขอบเขต arc/polyline ออกตั้งใจ) — แต่ละข้อจำกัดเก็บแค่
     {id, type, entities:[entityId,...], value} ไม่ได้เก็บ id ของจุด/เส้นฝั่ง planegcs ไว้เลย เพราะจุด/เส้น
     ฝั่ง gcs ถูกสร้างขึ้นใหม่ทุกครั้งที่แก้สมการ (สดจากพิกัดปัจจุบันของเอนทิตี้ใน state.entities) ผ่าน
     buildGcsProblem() — เลี่ยงปัญหาข้อมูลสองชุดไม่ตรงกันได้ง่ายกว่าเก็บ mapping ค้างไว้ */
  var constraintTypeSel = $('constraintTypeSel'), constraintSolveBtn = $('constraintSolveBtn'), constraintsList = $('constraintsList');
  function gcsPtId(entityId, which) { return 'pt_' + entityId + '_' + which; }   // which: 'p1' | 'p2' | 'c' (จุดศูนย์กลางวงกลม)
  function gcsLnId(entityId) { return 'ln_' + entityId; }
  function gcsCiId(entityId) { return 'ci_' + entityId; }
  /* หาคู่ปลายเส้นที่ใกล้กันที่สุดระหว่างเส้น 2 เส้น (สำหรับ coincident/symmetric ที่ผูกกับ "ปลายเส้น" ไม่ใช่ทั้งเส้น) */
  function nearestEndpointPair(idA, idB) {
    var a = entityById(idA), b = entityById(idB), pairs = [['p1', 'p1'], ['p1', 'p2'], ['p2', 'p1'], ['p2', 'p2']], best = null, bestD = Infinity;
    pairs.forEach(function (pr) {
      var d = Math.hypot(a[pr[0]].x - b[pr[1]].x, a[pr[0]].y - b[pr[1]].y);
      if (d < bestD) { bestD = d; best = { a: pr[0], b: pr[1] }; }
    });
    return best;
  }
  function isLineOrCircle(e) { return !!e && (e.type === 'line' || e.type === 'circle'); }
  /* ตารางนิยามข้อจำกัดแต่ละชนิด: needed = จำนวนเอนทิตี้ที่ต้องคลิกเลือก, value = 'distance'|'angle'|null (ต้อง
     พิมพ์ค่าเพิ่มไหม), validate = ชนิดเอนทิตี้ที่เลือกมาต้องตรงเงื่อนไขไหม, build = แปลงเป็น constraint object
     ของ planegcs (ตาม field ที่ planegcs กำหนด — อ้างอิงจาก planegcs_dist/constraints.ts ต้นทาง) */
  var CONSTRAINT_DEFS = {
    coincident: { needed: 2, valueKind: null,
      validate: function (es) { return es[0].type === 'line' && es[1].type === 'line'; },
      build: function (ids) { var np = nearestEndpointPair(ids[0], ids[1]); return { type: 'p2p_coincident', p1_id: gcsPtId(ids[0], np.a), p2_id: gcsPtId(ids[1], np.b) }; } },
    horizontal: { needed: 1, valueKind: null,
      validate: function (es) { return es[0].type === 'line'; },
      build: function (ids) { return { type: 'horizontal_l', l_id: gcsLnId(ids[0]) }; } },
    vertical: { needed: 1, valueKind: null,
      validate: function (es) { return es[0].type === 'line'; },
      build: function (ids) { return { type: 'vertical_l', l_id: gcsLnId(ids[0]) }; } },
    parallel: { needed: 2, valueKind: null,
      validate: function (es) { return es[0].type === 'line' && es[1].type === 'line'; },
      build: function (ids) { return { type: 'parallel', l1_id: gcsLnId(ids[0]), l2_id: gcsLnId(ids[1]) }; } },
    perpendicular: { needed: 2, valueKind: null,
      validate: function (es) { return es[0].type === 'line' && es[1].type === 'line'; },
      build: function (ids) { return { type: 'perpendicular_ll', l1_id: gcsLnId(ids[0]), l2_id: gcsLnId(ids[1]) }; } },
    equal: { needed: 2, valueKind: null,
      validate: function (es) { return es[0].type === es[1].type && isLineOrCircle(es[0]); },
      build: function (ids) {
        return entityById(ids[0]).type === 'circle'
          ? { type: 'equal_radius_cc', c1_id: gcsCiId(ids[0]), c2_id: gcsCiId(ids[1]) }
          : { type: 'equal_length', l1_id: gcsLnId(ids[0]), l2_id: gcsLnId(ids[1]) };
      } },
    tangent: { needed: 2, valueKind: null,
      validate: function (es) { return isLineOrCircle(es[0]) && isLineOrCircle(es[1]) && !(es[0].type === 'line' && es[1].type === 'line'); },
      build: function (ids) {
        var e0 = entityById(ids[0]), e1 = entityById(ids[1]);
        if (e0.type === 'circle' && e1.type === 'circle') return { type: 'tangent_cc', c1_id: gcsCiId(ids[0]), c2_id: gcsCiId(ids[1]) };
        var lineId = e0.type === 'line' ? ids[0] : ids[1], circId = e0.type === 'circle' ? ids[0] : ids[1];
        return { type: 'tangent_lc', l_id: gcsLnId(lineId), c_id: gcsCiId(circId) };
      } },
    distance: { needed: 1, valueKind: 'distance',
      validate: function (es) { return es[0].type === 'line'; },
      build: function (ids, value) { return { type: 'p2p_distance', p1_id: gcsPtId(ids[0], 'p1'), p2_id: gcsPtId(ids[0], 'p2'), distance: value }; } },
    angle: { needed: 2, valueKind: 'angle',
      validate: function (es) { return es[0].type === 'line' && es[1].type === 'line'; },
      build: function (ids, value) { return { type: 'l2l_angle_ll', l1_id: gcsLnId(ids[0]), l2_id: gcsLnId(ids[1]), angle: value * Math.PI / 180 }; } },
    symmetric: { needed: 3, valueKind: null,
      validate: function (es) { return es[0].type === 'line' && es[1].type === 'line' && es[2].type === 'line'; },
      build: function (ids) { var np = nearestEndpointPair(ids[0], ids[1]); return { type: 'p2p_symmetric_ppl', p1_id: gcsPtId(ids[0], np.a), p2_id: gcsPtId(ids[1], np.b), l_id: gcsLnId(ids[2]) }; } },
    fix: { needed: 1, valueKind: null, validate: function (es) { return isLineOrCircle(es[0]); }, build: null } // ไม่สร้าง constraint object — จัดการผ่าน fixed:true ตอนสร้างจุดใน buildGcsProblem() แทน
  };
  var CONSTRAINT_TYPE_KEY = {
    coincident: 'constraintCoincident', horizontal: 'constraintHorizontal', vertical: 'constraintVertical', parallel: 'constraintParallel',
    perpendicular: 'constraintPerpendicular', equal: 'constraintEqual', tangent: 'constraintTangent', distance: 'constraintDistance',
    angle: 'constraintAngle', symmetric: 'constraintSymmetric', fix: 'constraintFix'
  };
  function entityIndexLabel(id) { var i = state.entities.findIndex(function (e) { return e.id === id; }); return '#' + (i + 1); }
  function constraintRowLabel(c) {
    var label = t(CONSTRAINT_TYPE_KEY[c.type]).replace(/\s*\(.*\)$/, '') + ': ' + c.entities.map(entityIndexLabel).join(' · ');
    if (c.value != null) label += ' = ' + fmtMm(c.value) + (c.type === 'angle' ? '°' : (' ' + t('mmUnit')));
    return label;
  }
  /* ลบข้อจำกัดที่อ้างถึงเอนทิตี้ที่ไม่มีอยู่แล้ว (ถูกลบทิ้งไปโดยเครื่องมือลบ/ล้างทั้งหมด) ป้องกัน solve พังเพราะ id ค้าง */
  function pruneConstraints() {
    var before = state.constraints.length;
    state.constraints = state.constraints.filter(function (c) { return c.entities.every(function (id) { return !!entityById(id); }); });
    if (state.constraints.length !== before) renderConstraintsPanel();
  }
  /* รวบรวมเอนทิตี้ที่ถูกอ้างถึงโดยข้อจำกัดอย่างน้อย 1 อัน แปลงเป็น sketch primitive ของ planegcs (จุด+เส้น/วงกลม)
     จุดที่ถูกอ้างถึงโดยข้อจำกัด "ตรึงตำแหน่ง" (fix) จะได้ fixed:true (ไม่ขยับตอนแก้สมการ) */
  function buildGcsProblem() {
    var referenced = {};
    state.constraints.forEach(function (c) { c.entities.forEach(function (id) { referenced[id] = true; }); });
    var fixedPoints = {};
    state.constraints.forEach(function (c) {
      if (c.type !== 'fix') return;
      var e = entityById(c.entities[0]);
      if (e) fixedPoints[e.type === 'circle' ? gcsPtId(c.entities[0], 'c') : gcsPtId(c.entities[0], 'p1')] = true;
    });
    var prims = [], referencedIds = Object.keys(referenced);
    referencedIds.forEach(function (id) {
      var e = entityById(id);
      if (!e) return;
      if (e.type === 'line') {
        var p1id = gcsPtId(id, 'p1'), p2id = gcsPtId(id, 'p2');
        prims.push({ id: p1id, type: 'point', x: e.p1.x, y: e.p1.y, fixed: !!fixedPoints[p1id] });
        prims.push({ id: p2id, type: 'point', x: e.p2.x, y: e.p2.y, fixed: !!fixedPoints[p2id] });
        prims.push({ id: gcsLnId(id), type: 'line', p1_id: p1id, p2_id: p2id });
      } else if (e.type === 'circle') {
        var cid = gcsPtId(id, 'c');
        prims.push({ id: cid, type: 'point', x: e.center.x, y: e.center.y, fixed: !!fixedPoints[cid] });
        prims.push({ id: gcsCiId(id), type: 'circle', c_id: cid, radius: e.radius });
      }
    });
    return { prims: prims, referencedIds: referencedIds };
  }
  /* โหลด planegcs แบบ lazy (dynamic import) ครั้งแรกที่ใช้เครื่องมือนี้เท่านั้น — cache promise ไว้กันโหลดซ้ำ
     vendor ไว้ที่ vendor/planegcs/ (wasm ~500KB) ไม่ผูกกับ CDN ภายนอก (ต่างจาก jsPDF ที่ยังใช้ CDN) เพราะ
     ไลบรารีนี้ไม่มี prebuilt CDN bundle ที่ใช้ตรงๆ แบบไม่ต้องมี bundler ได้เลย ต้อง vendor ไฟล์ ESM+wasm เอง */
  var _planegcsPromise = null;
  function loadPlanegcs() {
    if (!_planegcsPromise) {
      _planegcsPromise = import('./vendor/planegcs/index.js').then(function (mod) {
        return {
          make_gcs_wrapper: function () { return mod.make_gcs_wrapper('./vendor/planegcs/planegcs_dist/planegcs.wasm'); },
          Algorithm: mod.Algorithm, SolveStatus: mod.SolveStatus
        };
      });
    }
    return _planegcsPromise;
  }
  /* แก้สมการข้อจำกัดทั้งหมดที่มีอยู่ ณ ตอนนี้ แล้วเขียนพิกัดที่แก้แล้วกลับเข้าเอนทิตี้จริง — คืน true ถ้าสำเร็จ
     (หรือไม่มีข้อจำกัดให้แก้เลย ถือว่าสำเร็จ), false ถ้าแก้ไม่ได้ (ขัดแย้งกัน/โหลดไลบรารีไม่สำเร็จ) โดยไม่แตะ
     เอนทิตี้เลยในกรณีหลัง (ของเดิมยังอยู่ครบ) */
  function solveSketch() {
    pruneConstraints();
    var constraintEntries = state.constraints.filter(function (c) { return c.type !== 'fix'; });
    if (!constraintEntries.length) return Promise.resolve(true);
    var built = buildGcsProblem();
    var constraintPrims = constraintEntries.map(function (c, i) {
      var def = CONSTRAINT_DEFS[c.type];
      var obj = def.build(c.entities, c.value);
      obj.id = 'cn_' + i + '_' + c.id;
      return obj;
    });
    return loadPlanegcs().then(function (mod) {
      var gcs;
      return Promise.resolve(mod.make_gcs_wrapper()).then(function (wrapper) {
        gcs = wrapper;
        gcs.push_primitives_and_params(built.prims.concat(constraintPrims));
        var status = gcs.solve(mod.Algorithm.DogLeg);
        if (status !== mod.SolveStatus.Success && status !== mod.SolveStatus.Converged) return false;
        gcs.apply_solution();
        pushHistory();
        built.referencedIds.forEach(function (id) {
          var e = entityById(id);
          if (!e) return;
          if (e.type === 'line') {
            var p1 = gcs.sketch_index.get_sketch_point(gcsPtId(id, 'p1')), p2 = gcs.sketch_index.get_sketch_point(gcsPtId(id, 'p2'));
            e.p1 = { x: p1.x, y: p1.y }; e.p2 = { x: p2.x, y: p2.y };
          } else if (e.type === 'circle') {
            var cc = gcs.sketch_index.get_sketch_point(gcsPtId(id, 'c')), circ = gcs.sketch_index.get_sketch_circle(gcsCiId(id));
            e.center = { x: cc.x, y: cc.y }; e.radius = circ.radius;
          }
        });
        updateCountUI(); scheduleSave(); render(); updatePropsPanel();
        return true;
      }).finally(function () { if (gcs) gcs.destroy_gcs_module(); });
    }, function () { alert(t('constraintLibLoadError')); return false; });
  }
  /* เพิ่มข้อจำกัดใหม่ 1 อัน แล้วแก้สมการทันที — ถ้าแก้ไม่ได้ (ขัดแย้งกับข้อจำกัดเดิม) ยกเลิกข้อจำกัดที่เพิ่งเพิ่มทิ้ง
     (ไม่ปล่อยให้แบบอยู่ในสถานะแก้สมการไม่ได้ค้างไว้) แล้วแจ้งเตือนผู้ใช้ */
  function finalizeConstraint(type, entityIds, value) {
    var c = { id: genId(), type: type, entities: entityIds, value: value != null ? value : null };
    state.constraints.push(c);
    solveSketch().then(function (ok) {
      if (!ok) { state.constraints = state.constraints.filter(function (x) { return x.id !== c.id; }); alert(t('constraintConflict')); }
      scheduleSave(); renderConstraintsPanel(); render();
    });
  }
  /* คลิกเอนทิตี้ระหว่างใช้เครื่องมือ "ข้อจำกัด" — สะสมใน pendingEntityIds (ใช้ตัวเดียวกับ fillet/มิติมุม) จน
     ครบจำนวนที่ชนิดข้อจำกัดที่เลือกไว้ต้องการ ถ้าไม่ต้องพิมพ์ค่าเพิ่ม (valueKind null) จะสร้างข้อจำกัดทันที
     ถ้าต้องพิมพ์ค่า (ระยะ/มุม) จะโผล่แถว preciseRow รอผู้ใช้พิมพ์แล้วกด Enter (ดู keydown handler ของ distInput/angInput) */
  function handleConstraintClick(raw) {
    var hit = hitTestEntity(raw);
    if (!hit) return;
    var e = entityById(hit);
    if (!isLineOrCircle(e) || state.pendingEntityIds.indexOf(hit) !== -1) return;
    var def = CONSTRAINT_DEFS[constraintTypeSel.value];
    state.pendingEntityIds.push(hit);
    if (state.pendingEntityIds.length > def.needed) state.pendingEntityIds.shift();
    if (state.pendingEntityIds.length === def.needed) {
      var ents = state.pendingEntityIds.map(entityById);
      if (!def.validate(ents)) { alert(t('constraintWrongTypes')); state.pendingEntityIds = []; }
      else if (!def.valueKind) { finalizeConstraint(constraintTypeSel.value, state.pendingEntityIds.slice(), null); state.pendingEntityIds = []; }
    }
    updatePreciseRowUI(); render();
  }
  function renderConstraintsPanel() {
    if (!constraintsList) return;
    if (!state.constraints.length) { constraintsList.innerHTML = '<div class="cad-props-note">' + t('constraintEmpty') + '</div>'; return; }
    constraintsList.innerHTML = state.constraints.map(function (c) {
      return '<div class="cad-layer-row" data-cid="' + c.id + '"><span style="flex:1">' + constraintRowLabel(c) + '</span>' +
        '<button type="button" class="cad-layer-icon" data-act="delcon">🗑️</button></div>';
    }).join('');
    Array.prototype.forEach.call(constraintsList.querySelectorAll('[data-act="delcon"]'), function (btn) {
      btn.addEventListener('click', function () {
        var cid = btn.closest('[data-cid]').getAttribute('data-cid');
        state.constraints = state.constraints.filter(function (c) { return c.id !== cid; });
        scheduleSave(); renderConstraintsPanel();
      });
    });
  }
  if (constraintTypeSel) constraintTypeSel.addEventListener('change', function () { state.pendingEntityIds = []; updatePreciseRowUI(); render(); });
  if (constraintSolveBtn) constraintSolveBtn.addEventListener('click', function () { solveSketch().then(function (ok) { if (!ok) alert(t('constraintConflict')); }); });

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
    /* หัวลูกศร/ป้ายตัวเลขมิติ — ขนาดคำนวณจาก "สไตล์มิติ" ของเอนทิตี้นั้นๆ (มม.) คูณด้วยระดับซูมปัจจุบัน แทนค่าคงที่
       เป็นพิกเซลตายตัวแบบเดิม (ให้ตรงกับสไตล์ที่ผู้ใช้ปรับได้จริง ใช้ค่าเดียวกันตอนส่งออก/plot PDF ด้วย) */
    function dimArrowPx(e) { return Math.max(4, (e.arrowSize || state.dimStyle.arrowSize) * state.view.scale); }
    function dimTextPx(e) { return Math.max(7, (e.textHeight || state.dimStyle.textHeight) * state.view.scale); }
    function drawArrowHead(screenPt, dirAngle, color, lenPx) {
      var len = lenPx || 8, wid = len * 0.375, dx = Math.cos(dirAngle), dy = Math.sin(dirAngle), px = -dy, py = dx;
      var bx = screenPt.x - dx * len, by = screenPt.y - dy * len;
      ctx.beginPath();
      ctx.moveTo(screenPt.x, screenPt.y);
      ctx.lineTo(bx + px * wid, by + py * wid);
      ctx.lineTo(bx - px * wid, by - py * wid);
      ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
    }
    function drawDimText(midScreen, text, screenAngle, color, fontPx) {
      var a = screenAngle;
      if (a > Math.PI / 2 || a < -Math.PI / 2) a += Math.PI;
      ctx.save();
      ctx.translate(midScreen.x, midScreen.y); ctx.rotate(a);
      ctx.fillStyle = color; ctx.font = (fontPx || 11) + 'px Prompt, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(text, 0, -4);
      ctx.restore();
    }
    /* วาดเอนทิตี้พื้นฐาน 5 ชนิด (line/polyline/rect/circle/arc/text) — แยกออกมาเป็นฟังก์ชันเดียว เพราะต้องใช้ซ้ำ
       ตอนวาดเอนทิตี้ย่อยภายในบล็อก/สัญลักษณ์ (block) ด้วย (สัญลักษณ์ในคลังประกอบด้วยชนิดพื้นฐานนี้เท่านั้น) */
    function drawPrimitive(e2, col_) {
      if (e2.type === 'line') strokePolylinePts([e2.p1, e2.p2], false);
      else if (e2.type === 'polyline') strokePolylinePts(e2.points, !!e2.closed);
      else if (e2.type === 'rect') strokePolylinePts(rectCorners(e2), true);
      else if (e2.type === 'circle') {
        var c0 = worldToScreen(e2.center.x, e2.center.y);
        ctx.beginPath(); ctx.ellipse(c0.x, c0.y, e2.radius * state.view.scale, e2.radius * state.view.scale, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (e2.type === 'arc') strokePolylinePts(arcPoints(e2), false);
      else if (e2.type === 'text') {
        var tsp2 = worldToScreen(e2.p.x, e2.p.y);
        ctx.fillStyle = col_; ctx.font = Math.max(6, e2.height * state.view.scale) + 'px Prompt, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(e2.text, tsp2.x, tsp2.y);
      }
    }
    state.entities.forEach(function (e) {
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      var selected = state.selectedIds.indexOf(e.id) !== -1;
      var isCutterOrPick = e.id === state.trimCutterId || e.id === state.offsetSourceId || state.pendingEntityIds.indexOf(e.id) !== -1;
      var col_ = isCutterOrPick ? col.osnap : (selected ? col.selected : (layer.color || col.entity));
      ctx.strokeStyle = col_;
      ctx.lineWidth = (selected || isCutterOrPick) ? 2.5 : 1.6;
      if (e.type === 'line' || e.type === 'polyline' || e.type === 'rect' || e.type === 'circle' || e.type === 'arc' || e.type === 'text') drawPrimitive(e, col_);
      else if (e.type === 'block') {
        var sym = BLOCK_LIBRARY[e.blockId];
        if (sym) sym.entities.forEach(function (sub) { drawPrimitive(transformBlockSubEntity(sub, e), col_); });
      }
      else if (e.type === 'dim') {
        var dl = dimLinePoints(e);
        strokePolylinePts([e.p1, dl.dimP1], false);
        strokePolylinePts([e.p2, dl.dimP2], false);
        strokePolylinePts([dl.dimP1, dl.dimP2], false);
        var ds1 = worldToScreen(dl.dimP1.x, dl.dimP1.y), ds2 = worldToScreen(dl.dimP2.x, dl.dimP2.y);
        var dAng = Math.atan2(ds2.y - ds1.y, ds2.x - ds1.x);
        drawArrowHead(ds1, dAng + Math.PI, col_, dimArrowPx(e)); drawArrowHead(ds2, dAng, col_, dimArrowPx(e));
        var dMid = { x: (ds1.x + ds2.x) / 2, y: (ds1.y + ds2.y) / 2 };
        var dLen = Math.hypot(e.p2.x - e.p1.x, e.p2.y - e.p1.y);
        drawDimText(dMid, fmtMm(dLen) + ' ' + t('mmUnit'), dAng, col_, dimTextPx(e));
      } else if (e.type === 'raddim') {
        var rlp = raddimLeaderPoint(e);
        var rs1 = worldToScreen(e.center.x, e.center.y), rs2 = worldToScreen(rlp.x, rlp.y);
        ctx.beginPath(); ctx.moveTo(rs1.x, rs1.y); ctx.lineTo(rs2.x, rs2.y); ctx.stroke();
        var rAng = Math.atan2(rs2.y - rs1.y, rs2.x - rs1.x);
        drawArrowHead(rs2, rAng, col_, dimArrowPx(e));
        drawDimText({ x: rs2.x + Math.cos(rAng) * 14, y: rs2.y + Math.sin(rAng) * 14 }, 'R' + fmtMm(e.radius), rAng, col_, dimTextPx(e));
      } else if (e.type === 'diadim') {
        var de = diaEndpoints(e);
        var das1 = worldToScreen(de.p1.x, de.p1.y), das2 = worldToScreen(de.p2.x, de.p2.y);
        ctx.beginPath(); ctx.moveTo(das1.x, das1.y); ctx.lineTo(das2.x, das2.y); ctx.stroke();
        var daAng = Math.atan2(das2.y - das1.y, das2.x - das1.x);
        drawArrowHead(das1, daAng + Math.PI, col_, dimArrowPx(e)); drawArrowHead(das2, daAng, col_, dimArrowPx(e));
        drawDimText({ x: das2.x + Math.cos(daAng) * 14, y: das2.y + Math.sin(daAng) * 14 }, '⌀' + fmtMm(e.radius * 2), daAng, col_, dimTextPx(e));
      } else if (e.type === 'angdim') {
        var TICK = e.radius * 0.12 + 3 / state.view.scale;
        var av1 = worldToScreen(e.center.x, e.center.y);
        var ae1 = worldToScreen(e.center.x + (e.radius + TICK) * Math.cos(e.startAngle), e.center.y + (e.radius + TICK) * Math.sin(e.startAngle));
        var ae2 = worldToScreen(e.center.x + (e.radius + TICK) * Math.cos(e.endAngle), e.center.y + (e.radius + TICK) * Math.sin(e.endAngle));
        ctx.beginPath(); ctx.moveTo(av1.x, av1.y); ctx.lineTo(ae1.x, ae1.y); ctx.moveTo(av1.x, av1.y); ctx.lineTo(ae2.x, ae2.y); ctx.stroke();
        strokePolylinePts(arcPoints(e), false);
        var as1 = worldToScreen(e.center.x + e.radius * Math.cos(e.startAngle), e.center.y + e.radius * Math.sin(e.startAngle));
        var as2 = worldToScreen(e.center.x + e.radius * Math.cos(e.endAngle), e.center.y + e.radius * Math.sin(e.endAngle));
        drawArrowHead(as1, e.startAngle + Math.PI / 2, col_, dimArrowPx(e)); drawArrowHead(as2, e.endAngle - Math.PI / 2, col_, dimArrowPx(e));
        var aMidAng = e.startAngle + normAngle(e.endAngle - e.startAngle) / 2;
        var aMidScreen = worldToScreen(e.center.x + e.radius * Math.cos(aMidAng), e.center.y + e.radius * Math.sin(aMidAng));
        var angDeg = normAngle(e.endAngle - e.startAngle) * 180 / Math.PI;
        drawDimText(aMidScreen, angDeg.toFixed(1) + '°', aMidAng + Math.PI / 2, col_, dimTextPx(e));
      } else if (e.type === 'leader') {
        var lps1 = worldToScreen(e.p1.x, e.p1.y), lps2 = worldToScreen(e.p2.x, e.p2.y);
        ctx.beginPath(); ctx.moveTo(lps1.x, lps1.y); ctx.lineTo(lps2.x, lps2.y); ctx.stroke();
        var lAng = Math.atan2(lps2.y - lps1.y, lps2.x - lps1.x);
        drawArrowHead(lps1, lAng + Math.PI, col_, Math.max(4, e.height * 0.5 * state.view.scale));
        ctx.fillStyle = col_; ctx.font = Math.max(6, e.height * state.view.scale) + 'px Prompt, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(e.text, lps2.x, lps2.y);
      } else if (e.type === 'hatch') {
        hatchLines(e).forEach(function (seg) { strokePolylinePts(seg, false); });
      } else if (e.type === 'spline') {
        strokePolylinePts(splinePoints(e), !!e.closed);
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
    var GUIDE_LINE_TOOLS = { line: 1, polyline: 1, spline: 1, move: 1, copy: 1, rotate: 1, mirror: 1, dim: 1 };
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
        if ((state.tool === 'polyline' || state.tool === 'spline') && state.pendingPoints.length > 1) {
          ctx.setLineDash([]);
          strokePolylinePts(state.tool === 'spline' ? splinePoints({ points: state.pendingPoints, closed: false }) : state.pendingPoints, false);
          ctx.setLineDash([5, 4]);
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
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ entities: state.entities, layers: state.layers, activeLayer: state.activeLayer, layerSeq: state.layerSeq, view: state.view, dimStyle: state.dimStyle, constraints: state.constraints }));
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
        if (saved.dimStyle) state.dimStyle = saved.dimStyle;
        if (Array.isArray(saved.constraints)) state.constraints = saved.constraints;
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
    select: 'toolSelectBtn', line: 'toolLineBtn', polyline: 'toolPolylineBtn', rect: 'toolRectBtn', circle: 'toolCircleBtn', arc: 'toolArcBtn', spline: 'toolSplineBtn',
    move: 'toolMoveBtn', copy: 'toolCopyBtn', rotate: 'toolRotateBtn', mirror: 'toolMirrorBtn', scale: 'toolScaleBtn',
    trim: 'toolTrimBtn', extend: 'toolExtendBtn', fillet: 'toolFilletBtn', offset: 'toolOffsetBtn', arrayrect: 'toolArrayRectBtn',
    dim: 'toolDimBtn', raddim: 'toolRaddimBtn', diadim: 'toolDiadimBtn', angdim: 'toolAngdimBtn', text: 'toolTextBtn', leader: 'toolLeaderBtn', hatch: 'toolHatchBtn',
    block: 'toolBlockBtn', titleblock: 'toolTitleBlockBtn', constraint: 'toolConstraintBtn'
  };
  var distLbl = document.querySelector('label[data-i18n="distLbl"]'), angLbl = document.querySelector('label[data-i18n="angLbl"]');
  var arrayRow = $('arrayRow'), textRow = $('textRow'), textContentInput = $('textContentInput'), textHeightInput = $('textHeightInput');
  var hatchRow = $('hatchRow'), hatchSpacingInput = $('hatchSpacing'), hatchAngleInput = $('hatchAngle');
  var blockLibSel = $('blockLibSel'), insertRow = $('insertRow'), blockSizeInput = $('blockSizeInput'), blockRotInput = $('blockRotInput'), blockMirrorBtn = $('blockMirrorBtn');
  var TEXT_ROW_POINTS_NEEDED = { text: 1, leader: 2 }; // จำนวนจุดที่ต้องคลิกก่อน textRow จะโผล่ (ข้อความ=1 จุด, ลูกศรชี้=2 จุด)
  function setTool(tool) {
    state.tool = tool; state.pendingPoints = []; state.pendingEntityIds = []; state.trimCutterId = null; state.offsetSourceId = null; state.hatchSourcePts = null; state.gripDrag = null;
    Object.keys(TOOL_BTN_IDS).forEach(function (k) { $(TOOL_BTN_IDS[k]).classList.toggle('active', k === tool); });
    viewport.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    arrayRow.classList.toggle('show', tool === 'arrayrect');
    if (tool === 'block') blockMirrorBtn.classList.remove('active'); // เริ่มทุกครั้งที่ยัง ไม่มิเรอร์
    updatePreciseRowUI();
    updateTextRowUI();
    updateHatchRowUI();
    updateInsertRowUI();
    render();
  }
  function updateTextRowUI() {
    var needed = TEXT_ROW_POINTS_NEEDED[state.tool];
    var show = needed != null && state.pendingPoints.length === needed;
    textRow.classList.toggle('show', show);
    if (show) { textHeightInput.value = state.textDefaultHeight; textContentInput.value = ''; textContentInput.focus(); }
  }
  function applyTextRow() {
    var needed = TEXT_ROW_POINTS_NEEDED[state.tool];
    if (needed == null || state.pendingPoints.length !== needed) return;
    var content = textContentInput.value;
    if (!content.trim()) { cancelDrawing(); return; }
    var h = parseFloat(textHeightInput.value);
    if (!isFinite(h) || h <= 0) h = state.textDefaultHeight;
    state.textDefaultHeight = h;
    pushHistory();
    if (state.tool === 'text') state.entities.push({ id: genId(), type: 'text', layer: state.activeLayer, p: state.pendingPoints[0], text: content, height: h });
    else state.entities.push({ id: genId(), type: 'leader', layer: state.activeLayer, p1: state.pendingPoints[0], p2: state.pendingPoints[1], text: content, height: h });
    updateCountUI(); scheduleSave();
    finishDrawing(); updateTextRowUI(); render();
  }
  /* แถวปรับระยะห่าง/มุมลาย ก่อนกดปุ่ม "แรเงา" ยืนยันสร้างจริง — โผล่หลังจากคลิกเลือกเอนทิตี้ขอบเขตแล้วเท่านั้น */
  function updateHatchRowUI() {
    var show = state.tool === 'hatch' && !!state.hatchSourcePts;
    hatchRow.classList.toggle('show', show);
    if (show && !hatchSpacingInput.value) { hatchSpacingInput.value = '5'; hatchAngleInput.value = '45'; }
  }
  function applyHatchRow() {
    if (!state.hatchSourcePts) return;
    var spacing = parseFloat(hatchSpacingInput.value);
    if (!isFinite(spacing) || spacing <= 0) spacing = 5;
    var angleDeg = parseFloat(hatchAngleInput.value);
    if (!isFinite(angleDeg)) angleDeg = 45;
    pushHistory();
    state.entities.push({ id: genId(), type: 'hatch', layer: state.activeLayer, points: state.hatchSourcePts, spacing: spacing, angle: angleDeg * Math.PI / 180 });
    state.hatchSourcePts = null;
    updateCountUI(); scheduleSave(); updateHatchRowUI(); render();
  }
  /* แถวปรับขนาดจริง/มุมหมุน/มิเรอร์ ก่อนกดปุ่ม "แทรก" ยืนยันวางบล็อก — โผล่หลังจากคลิกจุดแทรกแล้วเท่านั้น */
  function updateInsertRowUI() {
    var show = state.tool === 'block' && state.pendingPoints.length === 1;
    insertRow.classList.toggle('show', show);
    if (show) { var sym = BLOCK_LIBRARY[blockLibSel.value]; blockSizeInput.value = sym ? sym.baseSize : ''; blockRotInput.value = '0'; }
  }
  function applyInsertRow() {
    if (state.tool !== 'block' || state.pendingPoints.length !== 1) return;
    var sym = BLOCK_LIBRARY[blockLibSel.value];
    if (!sym) return;
    var sizeMm = parseFloat(blockSizeInput.value);
    if (!isFinite(sizeMm) || sizeMm <= 0) sizeMm = sym.baseSize;
    var rotDeg = parseFloat(blockRotInput.value);
    if (!isFinite(rotDeg)) rotDeg = 0;
    pushHistory();
    state.entities.push({
      id: genId(), type: 'block', layer: state.activeLayer, blockId: blockLibSel.value, p: state.pendingPoints[0],
      scale: sizeMm / sym.baseSize, rotation: rotDeg * Math.PI / 180, mirrored: blockMirrorBtn.classList.contains('active')
    });
    updateCountUI(); scheduleSave();
    finishDrawing(); updateInsertRowUI(); render();
  }
  /* ตารางรายการแบบ (title block): คลิกจุดเดียว = มุมล่างซ้าย แล้วแทรกทันที ไม่มีขั้นตอนปรับค่าก่อน (ปรับทีหลังผ่าน
     เครื่องมือเลือก+แก้ไขปกติได้เต็มที่ เพราะเป็นแค่เอนทิตี้พื้นฐานล้วนๆ ไม่ใช่บล็อกที่ผูกกับต้นแบบ) */
  function handleTitleBlockClick(raw) {
    pushHistory();
    var ents = buildTitleBlockEntities(raw, state.activeLayer);
    state.entities = state.entities.concat(ents);
    updateCountUI(); scheduleSave(); render();
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
    else if (state.tool === 'constraint') {
      var cdef0 = CONSTRAINT_DEFS[constraintTypeSel.value];
      distShow = cdef0.valueKind === 'distance'; angShow = cdef0.valueKind === 'angle';
    }
    distLbl.childNodes[0].textContent = distText; distLbl.style.display = distShow ? '' : 'none';
    angLbl.childNodes[0].textContent = angText; angLbl.style.display = angShow ? '' : 'none';
  }
  function updatePreciseRowUI() {
    updatePreciseLabels();
    var PRECISE_ROW_EXCLUDED = { select: 1, trim: 1, extend: 1, arrayrect: 1, dim: 1, raddim: 1, diadim: 1, angdim: 1, text: 1, leader: 1, hatch: 1, block: 1, titleblock: 1, constraint: 1 };
    var show = (!PRECISE_ROW_EXCLUDED[state.tool] && state.pendingPoints.length > 0) ||
      (state.tool === 'offset' && state.offsetSourceId) || (state.tool === 'fillet' && state.pendingEntityIds.length === 2) ||
      (state.tool === 'constraint' && CONSTRAINT_DEFS[constraintTypeSel.value].valueKind && state.pendingEntityIds.length === CONSTRAINT_DEFS[constraintTypeSel.value].needed);
    preciseRow.classList.toggle('show', show);
    var showFinish = (state.tool === 'polyline' || state.tool === 'spline') && state.pendingPoints.length >= 2;
    finishPolyBtn.classList.toggle('show', showFinish);
    if (!show) { distInput.value = ''; angInput.value = ''; }
  }
  function clearPreciseInputs() { distInput.value = ''; angInput.value = ''; }
  function cancelDrawing() {
    state.pendingPoints = []; state.pendingEntityIds = []; state.trimCutterId = null; state.offsetSourceId = null; state.hatchSourcePts = null;
    updatePreciseRowUI(); updateTextRowUI(); updateHatchRowUI(); updateInsertRowUI(); render();
  }
  function finishDrawing() { state.pendingPoints = []; updatePreciseRowUI(); updateTextRowUI(); updateInsertRowUI(); }
  function finishPolyline() {
    if (state.pendingPoints.length >= 2) {
      pushHistory();
      state.entities.push({ id: genId(), type: state.tool === 'spline' ? 'spline' : 'polyline', layer: state.activeLayer, points: state.pendingPoints.slice(), closed: false });
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
    } else if (state.tool === 'polyline' || state.tool === 'spline') {
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
          state.entities.push({ id: genId(), type: 'dim', layer: state.activeLayer, p1: d1, p2: d2, offset: offset, textHeight: state.dimStyle.textHeight, arrowSize: state.dimStyle.arrowSize });
          updateCountUI(); scheduleSave();
        }
        finishDrawing();
      }
    } else if (state.tool === 'text') {
      state.pendingPoints = [pt]; // จุดเดียว — เนื้อหาข้อความกรอกผ่าน textRow แยกต่างหาก (ดู applyTextRow)
    } else if (state.tool === 'leader') {
      if (state.pendingPoints.length < 2) state.pendingPoints.push(pt); // 2 จุด (ปลายลูกศร + จุดข้อความ) แล้วกรอกข้อความผ่าน textRow เหมือนกัน
    } else if (state.tool === 'block') {
      state.pendingPoints = [pt]; // จุดแทรกจุดเดียว — ขนาด/มุม/มิเรอร์ปรับผ่าน insertRow แยกต่างหาก (ดู applyInsertRow)
    }
    updatePreciseRowUI();
    updateTextRowUI();
    updateInsertRowUI();
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
    pruneConstraints();
    updateSelectionUI(); updateCountUI(); scheduleSave(); render();
  }
  function clearAll() {
    if (!state.entities.length) return;
    if (!window.confirm(t('clearConfirm'))) return;
    pushHistory();
    state.entities = []; state.selectedIds = [];
    pruneConstraints();
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
    state.entities.push({ id: genId(), type: 'raddim', layer: state.activeLayer, center: { x: e.center.x, y: e.center.y }, radius: e.radius, angle: angle, textHeight: state.dimStyle.textHeight, arrowSize: state.dimStyle.arrowSize });
    updateCountUI(); scheduleSave(); render();
  }
  /* มิติเส้นผ่าศูนย์กลาง (diadim): เหมือน handleRaddimClick เป๊ะ ต่างแค่ type ที่สร้าง (การ render/export ต่างกัน) */
  function handleDiadimClick(raw) {
    var hit = hitTestEntity(raw);
    if (!hit) return;
    var e = state.entities.filter(function (x) { return x.id === hit; })[0];
    if (!e || (e.type !== 'circle' && e.type !== 'arc')) return;
    var angle = Math.atan2(raw.y - e.center.y, raw.x - e.center.x);
    pushHistory();
    state.entities.push({ id: genId(), type: 'diadim', layer: state.activeLayer, center: { x: e.center.x, y: e.center.y }, radius: e.radius, angle: angle, textHeight: state.dimStyle.textHeight, arrowSize: state.dimStyle.arrowSize });
    updateCountUI(); scheduleSave(); render();
  }
  /* มิติมุม (angdim): คลิกเลือกเส้นตรง 2 เส้น (ใช้ pendingEntityIds ร่วมกับ fillet) แล้วคลิกจุดที่ 3 เพื่อวางส่วนโค้ง
     — หาจุดตัดของเส้นทั้งสอง (ต่อเส้นไม่มีที่สิ้นสุด) เป็นจุดยอดมุม, ทิศทางแต่ละเส้นจากจุดยอดไปยัง "ปลายที่ไกล
     จากจุดตัดที่สุด" คือทิศเริ่ม/จบ (กันปัญหาเลือกทิศผิดถ้าจุดตัดอยู่นอกช่วงเส้นจริง), รัศมีส่วนโค้ง = ระยะจากจุด
     ยอดถึงจุดคลิกที่ 3, เลือกกวาดทิศทางที่ "ผ่าน" ทิศของจุดคลิกที่ 3 จริง (เหมือน computeArcFrom3Points) */
  function handleAngdimClick(raw) {
    if (state.pendingEntityIds.length < 2) {
      var hit = hitTestEntity(raw);
      if (!hit) return;
      var e = state.entities.filter(function (x) { return x.id === hit; })[0];
      if (!e || e.type !== 'line' || state.pendingEntityIds.indexOf(hit) !== -1) return;
      state.pendingEntityIds.push(hit);
      render();
      return;
    }
    var lineA = state.entities.filter(function (x) { return x.id === state.pendingEntityIds[0]; })[0];
    var lineB = state.entities.filter(function (x) { return x.id === state.pendingEntityIds[1]; })[0];
    state.pendingEntityIds = [];
    if (!lineA || !lineB) { render(); return; }
    var V = lineIntersectInfinite(lineA.p1, lineA.p2, lineB.p1, lineB.p2);
    if (!V) { render(); return; } // เส้นขนานกัน วัดมุมไม่ได้
    function farEnd(line) {
      var d1 = Math.hypot(line.p1.x - V.x, line.p1.y - V.y), d2 = Math.hypot(line.p2.x - V.x, line.p2.y - V.y);
      return d1 > d2 ? line.p1 : line.p2;
    }
    var ra1 = Math.atan2(farEnd(lineA).y - V.y, farEnd(lineA).x - V.x);
    var ra2 = Math.atan2(farEnd(lineB).y - V.y, farEnd(lineB).x - V.x);
    var radius = Math.max(1, Math.hypot(raw.x - V.x, raw.y - V.y));
    var clickAng = Math.atan2(raw.y - V.y, raw.x - V.x);
    var span = normAngle(ra2 - ra1), relClick = normAngle(clickAng - ra1);
    var startAngle, endAngle;
    if (relClick <= span) { startAngle = ra1; endAngle = ra1 + span; } else { startAngle = ra2; endAngle = ra2 + normAngle(ra1 - ra2); }
    pushHistory();
    state.entities.push({ id: genId(), type: 'angdim', layer: state.activeLayer, center: { x: V.x, y: V.y }, radius: radius, startAngle: startAngle, endAngle: endAngle, textHeight: state.dimStyle.textHeight, arrowSize: state.dimStyle.arrowSize });
    updateCountUI(); scheduleSave(); render();
  }
  /* แรเงา (hatch): คลิกเลือกเอนทิตี้ขอบเขตปิด (สี่เหลี่ยม/วงกลม/พอลีไลน์ปิด) — snapshot จุดขอบเขตไว้ก่อน แล้วให้
     ปรับระยะห่าง/มุมลายในแถว hatchRow ก่อนกด "แรเงา" ยืนยันสร้างจริง (ดู applyHatchRow) */
  function handleHatchClick(raw) {
    var hit = hitTestEntity(raw);
    if (!hit) return;
    var e = state.entities.filter(function (x) { return x.id === hit; })[0];
    if (!e) return;
    var pts = null;
    if (e.type === 'rect') pts = rectCorners(e);
    else if (e.type === 'polyline' && e.closed && e.points.length > 2) pts = e.points.slice();
    else if (e.type === 'circle') pts = arcPoints({ center: e.center, radius: e.radius, startAngle: 0, endAngle: Math.PI * 2 }, 64);
    if (!pts) return;
    state.hatchSourcePts = pts;
    updateHatchRowUI(); render();
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
    if (state.tool === 'diadim') { handleDiadimClick(raw); return; }
    if (state.tool === 'angdim') { handleAngdimClick(raw); return; }
    if (state.tool === 'hatch') { handleHatchClick(raw); return; }
    if (state.tool === 'titleblock') { handleTitleBlockClick(effectivePoint(applyOrtho(raw))); return; }
    if (state.tool === 'constraint') { handleConstraintClick(raw); return; }
    if (state.tool === 'arrayrect') return; // อาเรย์ทำงานผ่านปุ่ม "แทรกอาเรย์" ไม่ใช้คลิกบน canvas
    handlePointInput(effectivePoint(applyOrtho(raw)));
  });
  canvas.addEventListener('dblclick', function (e) {
    if (state.tool !== 'polyline' && state.tool !== 'spline') return;
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
      else if (state.tool === 'diadim') handleDiadimClick(raw);
      else if (state.tool === 'angdim') handleAngdimClick(raw);
      else if (state.tool === 'hatch') handleHatchClick(raw);
      else if (state.tool === 'titleblock') handleTitleBlockClick(effectivePoint(applyOrtho(raw)));
      else if (state.tool === 'constraint') handleConstraintClick(raw);
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
    return state.pendingPoints.length > 0 || !!state.trimCutterId || !!state.offsetSourceId || !!state.hatchSourcePts || state.pendingEntityIds.length > 0;
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
        if (state.tool === 'constraint') {
          var cdef1 = CONSTRAINT_DEFS[constraintTypeSel.value];
          if (cdef1.valueKind && state.pendingEntityIds.length === cdef1.needed) {
            var cval = parseFloat((cdef1.valueKind === 'distance' ? distInput : angInput).value.trim());
            if (isFinite(cval) && (cdef1.valueKind !== 'distance' || cval > 0)) {
              finalizeConstraint(constraintTypeSel.value, state.pendingEntityIds.slice(), cval);
              state.pendingEntityIds = []; clearPreciseInputs(); updatePreciseRowUI();
            }
          }
          return;
        }
        var ok = commitPreciseInput();
        if (!ok && (state.tool === 'polyline' || state.tool === 'spline') && state.pendingPoints.length >= 2) finishPolyline();
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
  $('hatchApplyBtn').addEventListener('click', applyHatchRow);
  [hatchSpacingInput, hatchAngleInput].forEach(function (inp) {
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applyHatchRow(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelDrawing(); inp.blur(); }
    });
  });
  Object.keys(BLOCK_LIBRARY).forEach(function (bid) {
    var opt = document.createElement('option'); opt.value = bid; opt.textContent = t(BLOCK_LIBRARY[bid].nameKey);
    opt.setAttribute('data-i18n', BLOCK_LIBRARY[bid].nameKey); // ให้ applyStaticI18n() แปลภาษาให้อัตโนมัติตอนสลับภาษาทีหลัง
    blockLibSel.appendChild(opt);
  });
  blockLibSel.addEventListener('change', function () { if (state.tool === 'block' && state.pendingPoints.length === 1) updateInsertRowUI(); });
  blockMirrorBtn.addEventListener('click', function () { blockMirrorBtn.classList.toggle('active'); });
  $('blockApplyBtn').addEventListener('click', applyInsertRow);
  [blockSizeInput, blockRotInput].forEach(function (inp) {
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applyInsertRow(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelDrawing(); inp.blur(); }
    });
  });
  var dimTextHeightInput = $('dimTextHeightInput'), dimArrowSizeInput = $('dimArrowSizeInput');
  if (dimTextHeightInput) dimTextHeightInput.addEventListener('change', function () {
    var v = parseFloat(dimTextHeightInput.value); if (isFinite(v) && v > 0) { state.dimStyle.textHeight = v; scheduleSave(); }
  });
  if (dimArrowSizeInput) dimArrowSizeInput.addEventListener('change', function () {
    var v = parseFloat(dimArrowSizeInput.value); if (isFinite(v) && v > 0) { state.dimStyle.arrowSize = v; scheduleSave(); }
  });
  var langToggle = $('langToggle');
  if (langToggle) langToggle.addEventListener('click', function () { setUILang(getUILang() === 'en' ? 'th' : 'en'); applyStaticI18n(); updatePropsPanel(); renderLayersPanel(); renderConstraintsPanel(); });

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
      arc: 'propsTitleArc', dim: 'propsTitleDim', raddim: 'propsTitleRaddim', diadim: 'propsTitleDiadim',
      angdim: 'propsTitleAngdim', text: 'propsTitleText', leader: 'propsTitleLeader', hatch: 'propsTitleHatch', block: 'propsTitleBlock', spline: 'propsTitleSpline'
    };
    propsTitle.textContent = t(TITLE_KEY[e.type] || e.type);
    var fields = [], noteHtml = '';
    if (e.type === 'polyline') { noteHtml = '<div class="cad-props-note">' + t('propPolylineNote', { n: e.points.length }) + '</div>'; }
    else if (e.type === 'spline') { noteHtml = '<div class="cad-props-note">' + t('propSplineNote', { n: e.points.length }) + '</div>'; }
    else if (e.type === 'line' || e.type === 'rect' || e.type === 'dim') {
      fields = [
        { k: 'propX1', v: e.p1.x, set: function (v) { e.p1.x = v; } }, { k: 'propY1', v: e.p1.y, set: function (v) { e.p1.y = v; } },
        { k: 'propX2', v: e.p2.x, set: function (v) { e.p2.x = v; } }, { k: 'propY2', v: e.p2.y, set: function (v) { e.p2.y = v; } }
      ];
    } else if (e.type === 'circle' || e.type === 'raddim' || e.type === 'diadim') {
      fields = [
        { k: 'propCx', v: e.center.x, set: function (v) { e.center.x = v; } }, { k: 'propCy', v: e.center.y, set: function (v) { e.center.y = v; } },
        { k: 'propR', v: e.radius, set: function (v) { e.radius = Math.max(0.01, v); } }
      ];
    } else if (e.type === 'arc' || e.type === 'angdim') {
      fields = [
        { k: 'propCx', v: e.center.x, set: function (v) { e.center.x = v; } }, { k: 'propCy', v: e.center.y, set: function (v) { e.center.y = v; } },
        { k: 'propR', v: e.radius, set: function (v) { e.radius = Math.max(0.01, v); } },
        { k: 'propStartDeg', v: e.startAngle * 180 / Math.PI, set: function (v) { e.startAngle = v * Math.PI / 180; } },
        { k: 'propEndDeg', v: e.endAngle * 180 / Math.PI, set: function (v) { e.endAngle = v * Math.PI / 180; } }
      ];
    } else if (e.type === 'text' || e.type === 'leader') {
      fields = [
        { k: 'propHeight', v: e.height, set: function (v) { e.height = Math.max(0.1, v); } }
      ];
    } else if (e.type === 'hatch') {
      fields = [
        { k: 'propSpacing', v: e.spacing, set: function (v) { e.spacing = Math.max(0.1, v); } },
        { k: 'propHatchAngle', v: e.angle * 180 / Math.PI, set: function (v) { e.angle = v * Math.PI / 180; } }
      ];
    } else if (e.type === 'block') {
      var symP = BLOCK_LIBRARY[e.blockId] || { baseSize: 1 };
      fields = [
        { k: 'propBlockSize', v: e.scale * symP.baseSize, set: function (v) { e.scale = Math.max(0.001, v) / symP.baseSize; } },
        { k: 'propBlockRotation', v: e.rotation * 180 / Math.PI, set: function (v) { e.rotation = v * Math.PI / 180; } }
      ];
    }
    if (e.type === 'dim' || e.type === 'raddim' || e.type === 'diadim' || e.type === 'angdim') {
      fields.push({ k: 'propHeight', v: e.textHeight, set: function (v) { e.textHeight = Math.max(0.1, v); } });
      fields.push({ k: 'propArrowSize', v: e.arrowSize, set: function (v) { e.arrowSize = Math.max(0.1, v); } });
    }
    var textFieldHtml = (e.type === 'text' || e.type === 'leader') ? '<label>' + t('propText') + '<input type="text" id="propTextContent" value="' + e.text.replace(/"/g, '&quot;') + '"></label>' : '';
    var mirrorFieldHtml = e.type === 'block' ? '<label style="flex-direction:row;align-items:center;gap:7px"><input type="checkbox" id="propBlockMirror"' + (e.mirrored ? ' checked' : '') + '>' + t('propBlockMirror') + '</label>' : '';
    var numFieldsHtml = fields.map(function (f, i) {
      return '<label>' + t(f.k) + '<input type="text" inputmode="decimal" data-fidx="' + i + '" value="' + fmtMm(f.v) + '"></label>';
    }).join('');
    var layerOptsHtml = Object.keys(state.layers).map(function (lid) {
      return '<option value="' + lid + '"' + (e.layer === lid ? ' selected' : '') + '>' + (state.layers[lid].name || lid) + '</option>';
    }).join('');
    var layerFieldHtml = '<label>' + t('propLayer') + '<select id="propLayerSel">' + layerOptsHtml + '</select></label>';
    propsGrid.innerHTML = noteHtml + textFieldHtml + numFieldsHtml + mirrorFieldHtml + layerFieldHtml;
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
    var mirrorInp = $('propBlockMirror');
    if (mirrorInp) mirrorInp.addEventListener('change', function () { pushHistory(); e.mirrored = mirrorInp.checked; scheduleSave(); render(); });
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
    function drawPrim(e2) {
      if (e2.type === 'line') poly([e2.p1, e2.p2], false);
      else if (e2.type === 'polyline') poly(e2.points, !!e2.closed);
      else if (e2.type === 'rect') poly(rectCorners(e2), true);
      else if (e2.type === 'circle') { var cc = w2s(e2.center.x, e2.center.y); c.beginPath(); c.ellipse(cc.x, cc.y, e2.radius * pxPerMm, e2.radius * pxPerMm, 0, 0, Math.PI * 2); c.stroke(); }
      else if (e2.type === 'arc') poly(arcPoints(e2), false);
      else if (e2.type === 'text') {
        var tsp2 = w2s(e2.p.x, e2.p.y);
        c.font = Math.max(6, e2.height * pxPerMm) + 'px Prompt, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'bottom';
        c.fillText(e2.text, tsp2.x, tsp2.y);
      }
    }
    state.entities.forEach(function (e) {
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      c.strokeStyle = layer.color || '#1F2430'; c.fillStyle = c.strokeStyle;
      if (e.type === 'line' || e.type === 'polyline' || e.type === 'rect' || e.type === 'circle' || e.type === 'arc' || e.type === 'text') drawPrim(e);
      else if (e.type === 'block') {
        var sym = BLOCK_LIBRARY[e.blockId];
        if (sym) sym.entities.forEach(function (sub) { drawPrim(transformBlockSubEntity(sub, e)); });
      }
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
        c.font = Math.max(9, (e.textHeight || 3) * pxPerMm) + 'px Prompt, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText('R' + fmtMm(e.radius), rs2.x + 4, rs2.y);
      } else if (e.type === 'diadim') {
        var de = diaEndpoints(e), dds1 = w2s(de.p1.x, de.p1.y), dds2 = w2s(de.p2.x, de.p2.y);
        c.beginPath(); c.moveTo(dds1.x, dds1.y); c.lineTo(dds2.x, dds2.y); c.stroke();
        c.font = Math.max(9, (e.textHeight || 3) * pxPerMm) + 'px Prompt, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText('⌀' + fmtMm(e.radius * 2), dds2.x + 4, dds2.y);
      } else if (e.type === 'angdim') {
        poly(arcPoints(e), false);
        var aas1 = w2s(e.center.x, e.center.y);
        var aae1 = w2s(e.center.x + e.radius * Math.cos(e.startAngle), e.center.y + e.radius * Math.sin(e.startAngle));
        var aae2 = w2s(e.center.x + e.radius * Math.cos(e.endAngle), e.center.y + e.radius * Math.sin(e.endAngle));
        c.beginPath(); c.moveTo(aas1.x, aas1.y); c.lineTo(aae1.x, aae1.y); c.moveTo(aas1.x, aas1.y); c.lineTo(aae2.x, aae2.y); c.stroke();
        var aMidAng = e.startAngle + normAngle(e.endAngle - e.startAngle) / 2;
        var aMidS = w2s(e.center.x + e.radius * Math.cos(aMidAng), e.center.y + e.radius * Math.sin(aMidAng));
        var angDeg = normAngle(e.endAngle - e.startAngle) * 180 / Math.PI;
        c.font = Math.max(9, (e.textHeight || 3) * pxPerMm) + 'px Prompt, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom';
        c.fillText(angDeg.toFixed(1) + '°', aMidS.x, aMidS.y - 4);
      } else if (e.type === 'leader') {
        poly([e.p1, e.p2], false);
        var lps2 = w2s(e.p2.x, e.p2.y);
        c.font = Math.max(6, e.height * pxPerMm) + 'px Prompt, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'bottom';
        c.fillText(e.text, lps2.x, lps2.y);
      } else if (e.type === 'hatch') {
        hatchLines(e).forEach(function (seg) { poly(seg, false); });
      } else if (e.type === 'spline') {
        poly(splinePoints(e), !!e.closed);
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
    function primSvg(e2, color) {
      if (e2.type === 'line') parts.push('<path d="' + polyPath([e2.p1, e2.p2], false) + '" stroke="' + color + '"/>');
      else if (e2.type === 'polyline') parts.push('<path d="' + polyPath(e2.points, !!e2.closed) + '" stroke="' + color + '"/>');
      else if (e2.type === 'rect') parts.push('<path d="' + polyPath(rectCorners(e2), true) + '" stroke="' + color + '"/>');
      else if (e2.type === 'circle') parts.push('<circle cx="' + sx(e2.center.x) + '" cy="' + sy(e2.center.y) + '" r="' + e2.radius.toFixed(3) + '" stroke="' + color + '"/>');
      else if (e2.type === 'arc') parts.push('<path d="' + polyPath(arcPoints(e2), false) + '" stroke="' + color + '"/>');
      else if (e2.type === 'text') parts.push('<text x="' + sx(e2.p.x) + '" y="' + sy(e2.p.y) + '" font-size="' + e2.height.toFixed(2) + '" fill="' + color + '">' + svgEsc(e2.text) + '</text>');
    }
    state.entities.forEach(function (e) {
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      var color = layer.color || '#1F2430';
      if (e.type === 'line' || e.type === 'polyline' || e.type === 'rect' || e.type === 'circle' || e.type === 'arc' || e.type === 'text') primSvg(e, color);
      else if (e.type === 'block') {
        var sym = BLOCK_LIBRARY[e.blockId];
        if (sym) sym.entities.forEach(function (sub) { primSvg(transformBlockSubEntity(sub, e), color); });
      }
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
        parts.push('<text x="' + sx(rlp.x) + '" y="' + sy(rlp.y) + '" font-size="' + (e.textHeight || 3) + '" fill="' + color + '">' + svgEsc('R' + fmtMm(e.radius)) + '</text>');
      } else if (e.type === 'diadim') {
        var de = diaEndpoints(e);
        parts.push('<path d="' + polyPath([de.p1, de.p2], false) + '" stroke="' + color + '"/>');
        parts.push('<text x="' + sx(de.p2.x) + '" y="' + sy(de.p2.y) + '" font-size="' + (e.textHeight || 3) + '" fill="' + color + '">' + svgEsc('⌀' + fmtMm(e.radius * 2)) + '</text>');
      } else if (e.type === 'angdim') {
        parts.push('<path d="' + polyPath(arcPoints(e), false) + '" stroke="' + color + '"/>');
        var ae1 = { x: e.center.x + e.radius * Math.cos(e.startAngle), y: e.center.y + e.radius * Math.sin(e.startAngle) };
        var ae2 = { x: e.center.x + e.radius * Math.cos(e.endAngle), y: e.center.y + e.radius * Math.sin(e.endAngle) };
        parts.push('<path d="' + polyPath([e.center, ae1], false) + '" stroke="' + color + '"/>');
        parts.push('<path d="' + polyPath([e.center, ae2], false) + '" stroke="' + color + '"/>');
        var aMidAng = e.startAngle + normAngle(e.endAngle - e.startAngle) / 2;
        var aMid = { x: e.center.x + e.radius * Math.cos(aMidAng), y: e.center.y + e.radius * Math.sin(aMidAng) };
        var angDeg = normAngle(e.endAngle - e.startAngle) * 180 / Math.PI;
        parts.push('<text x="' + sx(aMid.x) + '" y="' + sy(aMid.y) + '" font-size="' + (e.textHeight || 3) + '" fill="' + color + '" text-anchor="middle">' + svgEsc(angDeg.toFixed(1) + '°') + '</text>');
      } else if (e.type === 'leader') {
        parts.push('<path d="' + polyPath([e.p1, e.p2], false) + '" stroke="' + color + '"/>');
        parts.push('<text x="' + sx(e.p2.x) + '" y="' + sy(e.p2.y) + '" font-size="' + e.height.toFixed(2) + '" fill="' + color + '">' + svgEsc(e.text) + '</text>');
      } else if (e.type === 'hatch') {
        hatchLines(e).forEach(function (seg) { parts.push('<path d="' + polyPath(seg, false) + '" stroke="' + color + '"/>'); });
      } else if (e.type === 'spline') {
        parts.push('<path d="' + polyPath(splinePoints(e), !!e.closed) + '" stroke="' + color + '"/>');
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
    if (e.type === 'block') {
      var sym = BLOCK_LIBRARY[e.blockId];
      if (!sym) return [];
      var chunks2 = [];
      sym.entities.forEach(function (sub) { chunks2 = chunks2.concat(entityToDxfChunks(transformBlockSubEntity(sub, e))); });
      return chunks2;
    }
    if (e.type === 'dim') {
      var dl = dimLinePoints(e), dm = mid(dl.dimP1, dl.dimP2);
      var dLen = Math.hypot(e.p2.x - e.p1.x, e.p2.y - e.p1.y);
      return [].concat(dxfLine(e.p1, dl.dimP1), dxfLine(e.p2, dl.dimP2), dxfLine(dl.dimP1, dl.dimP2), dxfText({ x: dm.x, y: dm.y }, 3, fmtMm(dLen) + 'mm'));
    }
    if (e.type === 'raddim') {
      var rlp = raddimLeaderPoint(e);
      return [].concat(dxfLine(e.center, rlp), dxfText(rlp, e.textHeight || 3, 'R' + fmtMm(e.radius)));
    }
    if (e.type === 'diadim') {
      var de = diaEndpoints(e);
      return [].concat(dxfLine(de.p1, de.p2), dxfText(de.p2, e.textHeight || 3, 'dia' + fmtMm(e.radius * 2)));
    }
    if (e.type === 'angdim') {
      var ae1 = { x: e.center.x + e.radius * Math.cos(e.startAngle), y: e.center.y + e.radius * Math.sin(e.startAngle) };
      var ae2 = { x: e.center.x + e.radius * Math.cos(e.endAngle), y: e.center.y + e.radius * Math.sin(e.endAngle) };
      var aMidAng = e.startAngle + normAngle(e.endAngle - e.startAngle) / 2;
      var aMid = { x: e.center.x + e.radius * Math.cos(aMidAng), y: e.center.y + e.radius * Math.sin(aMidAng) };
      var angDeg = normAngle(e.endAngle - e.startAngle) * 180 / Math.PI;
      return [].concat(dxfArc(e.center, e.radius, e.startAngle, e.endAngle), dxfLine(e.center, ae1), dxfLine(e.center, ae2), dxfText(aMid, e.textHeight || 3, angDeg.toFixed(1) + 'deg'));
    }
    if (e.type === 'leader') return [].concat(dxfLine(e.p1, e.p2), dxfText(e.p2, e.height, e.text));
    if (e.type === 'hatch') {
      var chunks = [];
      hatchLines(e).forEach(function (seg) { chunks = chunks.concat(dxfLine(seg[0], seg[1])); });
      return chunks;
    }
    if (e.type === 'spline') return dxfLwpolyline(splinePoints(e, 16), !!e.closed); // ไม่มี DXF SPLINE entity เต็มรูปแบบในสเตจนี้ (ตามหลักการเดียวกับ dim/hatch: แตกเป็นชนิดพื้นฐานเพื่อให้โปรแกรมอ่าน DXF ใดๆ ก็แสดงถูก)
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
  /* ══════════════════ จัดพิมพ์ตามมาตราส่วนจริง (Stage 5b): PDF เวกเตอร์ด้วย jsPDF (โหลดจาก CDN ใน cad.html
     เหมือนที่ word.html/excel.html ใช้อยู่แล้ว — เวอร์ชันเดียวกันเป๊ะ) เลือกกระดาษมาตรฐาน (A4/A3/A1) + แนว
     (ตั้ง/นอน/อัตโนมัติ) + มาตราส่วนวิศวกรรม/สถาปัตย์มาตรฐาน (1:1 ถึง 1:500) หรือพอดีหน้ากระดาษอัตโนมัติ
     ต่างจากปุ่ม "พิมพ์/PDF" เดิม (Stage 5, ใช้กลไกพิมพ์เบราว์เซอร์) ตรงที่อันนี้คุมมาตราส่วน/ขนาดกระดาษได้ตรงเป๊ะ
     ไม่ขึ้นกับการตั้งค่าเครื่องพิมพ์ของผู้ใช้ — เหมาะสำหรับพิมพ์แบบก่อสร้าง/แบบวิศวกรรมจริงจัง */
  var PLOT_PAPER_MM = { A4: { w: 210, h: 297 }, A3: { w: 297, h: 420 }, A1: { w: 594, h: 841 } };
  function hexToRgb(hex) {
    var h = (hex || '#1F2430').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var num = parseInt(h, 16) || 0x1F2430;
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  function plotPDF() {
    var bbox = computeSceneBBox();
    if (!bbox) { alert(t('exportEmptyWarn')); return; }
    if (!(window.jspdf && window.jspdf.jsPDF)) { alert(t('pdfLibMissing')); return; }
    var paperKey = $('plotPaperSel').value, orient = $('plotOrientSel').value, scaleSel = $('plotScaleSel').value;
    var paper = PLOT_PAPER_MM[paperKey] || PLOT_PAPER_MM.A4;
    var drawW = bbox.maxx - bbox.minx, drawH = bbox.maxy - bbox.miny;
    var MARGIN = 15, scaleFactor, pw, ph, scaleLabel;
    if (scaleSel === 'fit') {
      var cands = orient === 'auto' ? ['portrait', 'landscape'] : [orient];
      var best = null;
      cands.forEach(function (o) {
        var cw = o === 'landscape' ? paper.h : paper.w, ch = o === 'landscape' ? paper.w : paper.h;
        var sf = Math.min((cw - 2 * MARGIN) / drawW, (ch - 2 * MARGIN) / drawH);
        if (!best || sf > best.sf) best = { o: o, sf: sf, w: cw, h: ch };
      });
      orient = best.o; scaleFactor = best.sf; pw = best.w; ph = best.h;
      var ratio = 1 / scaleFactor;
      scaleLabel = '1:' + (ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1));
    } else {
      var scaleN = parseFloat(scaleSel);
      scaleFactor = 1 / scaleN; scaleLabel = '1:' + scaleN;
      if (orient === 'auto') {
        var fitsP = (drawW * scaleFactor + 2 * MARGIN <= paper.w) && (drawH * scaleFactor + 2 * MARGIN <= paper.h);
        var fitsL = (drawW * scaleFactor + 2 * MARGIN <= paper.h) && (drawH * scaleFactor + 2 * MARGIN <= paper.w);
        orient = fitsP ? 'portrait' : (fitsL ? 'landscape' : 'portrait');
      }
      pw = orient === 'landscape' ? paper.h : paper.w; ph = orient === 'landscape' ? paper.w : paper.h;
      var neededW = drawW * scaleFactor + 2 * MARGIN, neededH = drawH * scaleFactor + 2 * MARGIN;
      if (neededW > pw + 0.5 || neededH > ph + 0.5) { if (!window.confirm(t('plotOverflowConfirm'))) return; }
    }
    var pdf = new window.jspdf.jsPDF({ orientation: orient === 'landscape' ? 'landscape' : 'portrait', unit: 'mm', format: [pw, ph] });
    var offX = (pw - drawW * scaleFactor) / 2, offY = (ph - drawH * scaleFactor) / 2;
    function w2p(x, y) { return { x: offX + (x - bbox.minx) * scaleFactor, y: ph - offY - (y - bbox.miny) * scaleFactor }; }
    function pdfPoly(pts, closed) {
      for (var i = 0; i < pts.length - 1; i++) { var a = w2p(pts[i].x, pts[i].y), b = w2p(pts[i + 1].x, pts[i + 1].y); pdf.line(a.x, a.y, b.x, b.y); }
      if (closed && pts.length > 2) { var a2 = w2p(pts[pts.length - 1].x, pts[pts.length - 1].y), b2 = w2p(pts[0].x, pts[0].y); pdf.line(a2.x, a2.y, b2.x, b2.y); }
    }
    function pdfArrow(tipWorld, dirAngleWorld, sizeMm, rgb) {
      var lenMm = Math.max(0.5, sizeMm * scaleFactor), wid = lenMm * 0.375;
      var dx = Math.cos(dirAngleWorld), dy = -Math.sin(dirAngleWorld), px = -dy, py = dx;
      var tip = w2p(tipWorld.x, tipWorld.y);
      var bx = tip.x - dx * lenMm, by = tip.y - dy * lenMm;
      pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
      pdf.triangle(tip.x, tip.y, bx + px * wid, by + py * wid, bx - px * wid, by - py * wid, 'F');
    }
    pdf.setLineWidth(Math.max(0.05, EXPORT_LINE_MM));
    var inkRgb = hexToRgb('#1F2430');
    function pdfPrim(e2) {
      if (e2.type === 'line') pdfPoly([e2.p1, e2.p2], false);
      else if (e2.type === 'polyline') pdfPoly(e2.points, !!e2.closed);
      else if (e2.type === 'rect') pdfPoly(rectCorners(e2), true);
      else if (e2.type === 'circle') { var cc = w2p(e2.center.x, e2.center.y); pdf.ellipse(cc.x, cc.y, e2.radius * scaleFactor, e2.radius * scaleFactor, 'S'); }
      else if (e2.type === 'arc') pdfPoly(arcPoints(e2), false);
      else if (e2.type === 'text') { var tp2 = w2p(e2.p.x, e2.p.y); pdf.setFontSize(e2.height * 2.83465); pdf.text(e2.text, tp2.x, tp2.y); }
    }
    state.entities.forEach(function (e) {
      var layer = state.layers[e.layer] || state.layers['0'];
      if (layer.visible === false) return;
      var rgb = hexToRgb(layer.color || '#1F2430');
      pdf.setDrawColor(rgb[0], rgb[1], rgb[2]); pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
      if (e.type === 'line' || e.type === 'polyline' || e.type === 'rect' || e.type === 'circle' || e.type === 'arc' || e.type === 'text') pdfPrim(e);
      else if (e.type === 'block') {
        var sym = BLOCK_LIBRARY[e.blockId];
        if (sym) sym.entities.forEach(function (sub) { pdfPrim(transformBlockSubEntity(sub, e)); });
      }
      else if (e.type === 'dim') {
        var dl = dimLinePoints(e);
        pdfPoly([e.p1, dl.dimP1], false); pdfPoly([e.p2, dl.dimP2], false); pdfPoly([dl.dimP1, dl.dimP2], false);
        var dAngW = Math.atan2(dl.dimP2.y - dl.dimP1.y, dl.dimP2.x - dl.dimP1.x);
        pdfArrow(dl.dimP1, dAngW + Math.PI, e.arrowSize || 3, rgb); pdfArrow(dl.dimP2, dAngW, e.arrowSize || 3, rgb);
        var dm = mid(dl.dimP1, dl.dimP2), dmP = w2p(dm.x, dm.y);
        var dLen = Math.hypot(e.p2.x - e.p1.x, e.p2.y - e.p1.y);
        pdf.setFontSize((e.textHeight || 3) * 2.83465);
        pdf.text(fmtMm(dLen) + ' mm', dmP.x, dmP.y - 1, { align: 'center' });
      } else if (e.type === 'raddim') {
        var rlp = raddimLeaderPoint(e), rp2 = w2p(rlp.x, rlp.y);
        var rAngW = Math.atan2(rlp.y - e.center.y, rlp.x - e.center.x);
        pdfPoly([e.center, rlp], false); pdfArrow(rlp, rAngW, e.arrowSize || 3, rgb);
        pdf.setFontSize((e.textHeight || 3) * 2.83465); pdf.text('R' + fmtMm(e.radius), rp2.x + 2, rp2.y + 1);
      } else if (e.type === 'diadim') {
        var de = diaEndpoints(e), dp2 = w2p(de.p2.x, de.p2.y);
        var daAngW = Math.atan2(de.p2.y - de.p1.y, de.p2.x - de.p1.x);
        pdfPoly([de.p1, de.p2], false);
        pdfArrow(de.p1, daAngW + Math.PI, e.arrowSize || 3, rgb); pdfArrow(de.p2, daAngW, e.arrowSize || 3, rgb);
        pdf.setFontSize((e.textHeight || 3) * 2.83465); pdf.text('dia' + fmtMm(e.radius * 2), dp2.x + 2, dp2.y + 1);
      } else if (e.type === 'angdim') {
        pdfPoly(arcPoints(e), false);
        var ae1 = { x: e.center.x + e.radius * Math.cos(e.startAngle), y: e.center.y + e.radius * Math.sin(e.startAngle) };
        var ae2 = { x: e.center.x + e.radius * Math.cos(e.endAngle), y: e.center.y + e.radius * Math.sin(e.endAngle) };
        pdfPoly([e.center, ae1], false); pdfPoly([e.center, ae2], false);
        var aMidAng = e.startAngle + normAngle(e.endAngle - e.startAngle) / 2;
        var aMidP = w2p(e.center.x + e.radius * Math.cos(aMidAng), e.center.y + e.radius * Math.sin(aMidAng));
        var angDeg = normAngle(e.endAngle - e.startAngle) * 180 / Math.PI;
        pdf.setFontSize((e.textHeight || 3) * 2.83465); pdf.text(angDeg.toFixed(1) + 'deg', aMidP.x, aMidP.y - 1, { align: 'center' });
      } else if (e.type === 'leader') {
        var lAngW = Math.atan2(e.p2.y - e.p1.y, e.p2.x - e.p1.x), lp2 = w2p(e.p2.x, e.p2.y);
        pdfPoly([e.p1, e.p2], false); pdfArrow(e.p1, lAngW + Math.PI, e.height * 0.5, rgb);
        pdf.setFontSize(e.height * 2.83465); pdf.text(e.text, lp2.x, lp2.y);
      } else if (e.type === 'hatch') { hatchLines(e).forEach(function (seg) { pdfPoly(seg, false); }); }
      else if (e.type === 'spline') { pdfPoly(splinePoints(e), !!e.closed); }
    });
    pdf.setDrawColor(inkRgb[0], inkRgb[1], inkRgb[2]); pdf.setLineWidth(0.3);
    pdf.rect(MARGIN / 2, MARGIN / 2, pw - MARGIN, ph - MARGIN, 'S');
    pdf.setFontSize(9); pdf.setTextColor(inkRgb[0], inkRgb[1], inkRgb[2]);
    pdf.text(t('plotScaleLbl') + ' ' + scaleLabel + '  ·  ' + paperKey + '  ·  ' + exportFilenameBase(), pw - MARGIN / 2 - 2, ph - MARGIN / 2 - 2, { align: 'right' });
    pdf.save(exportFilenameBase() + '.pdf');
  }
  $('plotGenerateBtn').addEventListener('click', plotPDF);

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
    if (dimTextHeightInput) dimTextHeightInput.value = state.dimStyle.textHeight;
    if (dimArrowSizeInput) dimArrowSizeInput.value = state.dimStyle.arrowSize;
    updateUndoRedoUI(); updateSelectionUI(); updateCountUI(); updateZoomUI(); renderLayersPanel(); renderConstraintsPanel();
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
