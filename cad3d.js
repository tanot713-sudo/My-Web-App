/* ══════════════════════════════════════════════════════════════════
   Tanot — cad3d.js (โมเดล 3 มิติวิศวกรรม, Stage 9 ของแผนขยาย CAD — proof of concept)
   เคอร์เนล B-Rep solid modeling จริงผ่าน OpenCascade.js (wasm ของ OCCT ตัวเดียวกับที่ FreeCAD/
   หลายโปรแกรม CAD วิศวกรรมใช้) โหลดจาก CDN (jsdelivr) แบบ lazy dynamic import() ครั้งแรกที่หน้านี้
   ต้องสร้างรูปทรงจริงเท่านั้น (ไฟล์ ~15-50MB ขึ้นกับการบีบอัดของ CDN — ไม่ vendor เข้าโปรเจกต์เพราะ
   ใหญ่เกินจะ commit ลง git ได้อย่างเหมาะสม ต่างจาก planegcs ของ Stage 8 ที่เล็กพอจะ vendor)

   ขอบเขต MVP ของสเตจนี้ (ตั้งใจจำกัดไว้ก่อน จะขยายเป็นสเตจถัดไปตามความจำเป็นจริง):
   - รูปทรงพื้นฐาน 3 แบบ: กล่อง/ทรงกระบอก/ทรงกลม (BRepPrimAPI_MakeBox/MakeCylinder/MakeSphere)
   - รวม/ตัดออก/หาส่วนร่วม (BRepAlgoAPI_Fuse/Cut/Common) ต่อกันเป็น "ชิ้นงานหลัก" ชิ้นเดียวเท่านั้น
     (ยังไม่รองรับหลายชิ้นงานอิสระพร้อมกันในฉากเดียว)
   - เลื่อนตำแหน่ง (translation) ได้อย่างเดียว ยังไม่รองรับหมุน/มุมโค้ง (fillet)/champfer
   - เก็บ "สูตร" ขั้นตอน (steps: ชนิด+ขนาด+ตำแหน่ง+วิธีรวม) ลง localStorage แล้วสร้างรูปทรงจริงใหม่
     ทุกครั้งที่โหลดหน้า/แก้ไข (ไม่พยายามเก็บ handle ของเอนทิตี้ OCCT เองซึ่งเป็นอ็อบเจกต์ใน WASM heap
     ไม่สามารถ serialize ได้ตรงๆ)
   - แปลงรูปทรงเป็นตาข่ายสามเหลี่ยม (mesh) สำหรับแสดงผลผ่าน STL ชั่วคราวในหน่วยความจำ (StlAPI_Writer
     เขียนลง virtual filesystem ของ Emscripten แล้วอ่านกลับด้วย STLLoader ของ three.js ที่มีอยู่แล้ว
     ในโปรเจกต์ — ปลอดภัยกว่าและโค้ดสั้นกว่าการเดินเอง TopExp_Explorer/BRep_Tool.Triangulation ทีละหน้า)
   ══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

(function () {
  'use strict';
  var STORE_KEY = 'tanot:cad3d:steps';
  var OCC_VERSION = '2.0.0-beta.b5ff984';
  var OCC_BASE = 'https://cdn.jsdelivr.net/npm/opencascade.js@' + OCC_VERSION + '/dist/';

  var $ = function (id) { return document.getElementById(id); };

  var state = { steps: [], oc: null, lastShape: null, lastStlBytes: null };
  var scene, camera, renderer, controls, mesh, viewportEl;
  var xform, previewAnchor;
  var overlayEl = $('c3Overlay'), spinnerEl = $('c3Spinner'), overlayTextEl = $('c3OverlayText');

  /* ══════════════════ โหลด OpenCascade.js แบบ lazy จาก CDN (ครั้งแรกเท่านั้น, cache promise ไว้) ══════════════════
     opencascade.full.js เป็นไฟล์ ESM จริง (มี "export default Module" ที่ท้ายไฟล์) แม้เนื้อในส่วนใหญ่จะ
     เป็นโค้ด Emscripten ทั่วไป — เรียก factory function นี้ตรงๆ (ไม่ต้อง new) พร้อม locateFile ชี้ไปยัง
     .wasm บน CDN เดียวกัน (แพตเทิร์นเดียวกับที่ dist/index.js ต้นทางทำ แต่เขียนเองแทนเพราะไฟล์ต้นทาง
     import .wasm ตรงๆ แบบที่ต้องพึ่ง bundler ซึ่งเราไม่มี) */
  var _ocPromise = null;
  function loadOC() {
    if (!_ocPromise) {
      _ocPromise = import(OCC_BASE + 'opencascade.full.js').then(function (mod) {
        var initFactory = mod.default;
        return initFactory({
          locateFile: function (path) { return path.endsWith('.wasm') ? (OCC_BASE + 'opencascade.full.wasm') : path; }
        });
      });
    }
    return _ocPromise;
  }

  /* ══════════════════ persistence: เก็บแค่ "สูตร" ขั้นตอน ไม่เก็บอ็อบเจกต์ OCCT ══════════════════ */
  function saveSteps() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state.steps)); } catch (e) {} }
  function loadSteps() { try { var r = localStorage.getItem(STORE_KEY); if (r) { var s = JSON.parse(r); if (Array.isArray(s)) state.steps = s; } } catch (e) {} }

  /* ══════════════════ สร้างรูปทรง OCCT จริงจากสูตร ══════════════════ */
  function buildPrimitive(oc, kind, dims, pos) {
    var shape;
    if (kind === 'box') shape = new oc.BRepPrimAPI_MakeBox_2(Math.max(0.01, dims.x), Math.max(0.01, dims.y), Math.max(0.01, dims.z)).Shape();
    else if (kind === 'cylinder') shape = new oc.BRepPrimAPI_MakeCylinder_1(Math.max(0.01, dims.r), Math.max(0.01, dims.h)).Shape();
    else shape = new oc.BRepPrimAPI_MakeSphere_1(Math.max(0.01, dims.r)).Shape();
    if (pos.x || pos.y || pos.z) {
      var trsf = new oc.gp_Trsf_1();
      trsf.SetTranslation_1(new oc.gp_Vec_4(pos.x, pos.y, pos.z));
      shape = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();
    }
    return shape;
  }
  function booleanOp(oc, op, a, b) {
    var pr = new oc.Message_ProgressRange_1();
    var maker = op === 'union' ? new oc.BRepAlgoAPI_Fuse_3(a, b, pr)
      : op === 'cut' ? new oc.BRepAlgoAPI_Cut_3(a, b, pr)
      : new oc.BRepAlgoAPI_Common_3(a, b, pr);
    return maker.Shape();
  }
  function rebuildShape(oc, steps) {
    var current = null;
    steps.forEach(function (step) {
      var prim = buildPrimitive(oc, step.kind, step.dims, step.pos);
      current = current ? booleanOp(oc, step.op, current, prim) : prim;
    });
    return current;
  }
  /* ตาข่ายสามเหลี่ยมสำหรับแสดงผล — เขียนเป็น STL ชั่วคราวลง virtual FS ของ Emscripten แล้วอ่านกลับด้วย
     STLLoader ของ three.js (ที่ vendor ไว้อยู่แล้วในโปรเจกต์) แทนการเดิน TopExp_Explorer/
     BRep_Tool.Triangulation เอง — ได้ผลลัพธ์เดียวกัน โค้ดสั้นกว่ามาก และ byte เดียวกันนี้ใช้เป็นไฟล์
     ส่งออก STL ได้เลยโดยไม่ต้องคำนวณซ้ำ */
  function shapeToGeometry(oc, shape) {
    new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, false);
    var writer = new oc.StlAPI_Writer();
    var fname = '/tanot_model.stl';
    writer.Write(shape, fname, new oc.Message_ProgressRange_1());
    var data = oc.FS.readFile(fname);
    try { oc.FS.unlink(fname); } catch (e) {}
    var bytes = new Uint8Array(data); // คัดลอกออกมาเป็นก้อนของตัวเอง กัน buffer ถูกใช้ซ้ำ/เคลียร์โดย Emscripten heap ทีหลัง
    var geometry = new STLLoader().parse(bytes.buffer);
    return { geometry: geometry, bytes: bytes };
  }

  /* ══════════════════ ฉาก 3 มิติ (three.js, แพตเทิร์นเดียวกับ sim-objects.js) ══════════════════ */
  function initScene() {
    viewportEl = $('c3Viewport');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xE7ECF4);
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
    camera.position.set(220, 180, 260);
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    viewportEl.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.0));
    var dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(150, 300, 200);
    scene.add(dir);
    scene.add(new THREE.GridHelper(400, 40, 0xB8BEC9, 0xDADEE6));

    /* ── จุดจับลากวางตำแหน่งรูปทรงที่กำลังจะเพิ่ม (ก่อนกด "วาง/รวม") — เฉพาะเลื่อนตำแหน่ง (translate)
       เพราะฝั่ง OCCT (buildPrimitive) รองรับแค่การเลื่อนตำแหน่งเท่านั้นในสเตจนี้ ลากแล้วช่องตัวเลข
       ตำแหน่ง X/Y/Z ด้านบนจะอัปเดตตามให้อัตโนมัติ (และพิมพ์ตัวเลขเองก็ยังใช้ได้เหมือนเดิม) ── */
    xform = new TransformControls(camera, renderer.domElement);
    xform.setMode('translate');
    xform.addEventListener('dragging-changed', function (e) { controls.enabled = !e.value; });
    xform.addEventListener('objectChange', function () {
      if (!previewAnchor) return;
      $('posX').value = round2(previewAnchor.position.x);
      $('posY').value = round2(previewAnchor.position.y);
      $('posZ').value = round2(previewAnchor.position.z);
    });
    scene.add(xform.getHelper ? xform.getHelper() : xform);

    resize();
    window.addEventListener('resize', resize);
    renderer.setAnimationLoop(function () { controls.update(); renderer.render(scene, camera); });
  }
  function round2(v) { return Math.round(v * 100) / 100; }
  /* ── รูปทรงโปร่งแสงสีส้ม (preview) ของ "ชิ้นที่กำลังจะเพิ่ม" — ใช้ geometry ของ three.js ตรงๆ
     (ไม่ผ่าน OCCT) เพื่อให้ลากดูตำแหน่งได้ลื่นไหลทันที รูปทรงจริงจะคำนวณผ่าน OCCT ตอนกดยืนยันเท่านั้น
     ห่อด้วย Object3D "anchor" เพราะ BRepPrimAPI_MakeBox/MakeCylinder ของ OCCT ยึดมุม/ฐานที่จุดกำเนิด
     ไม่ได้ยึดกึ่งกลางแบบ THREE.BoxGeometry/CylinderGeometry — เลยต้องขยับตัว mesh ให้เยื้องจาก anchor
     ให้ตรงกับตำแหน่งที่ OCCT จะวางจริง แต่ตัว anchor เองยังคงเป็น "จุดตำแหน่งที่ป้อนให้ OCCT" ตรงๆ */
  function buildPreviewMesh(kind, dims) {
    var anchor = new THREE.Object3D();
    var mat = new THREE.MeshStandardMaterial({ color: 0xF5A524, transparent: true, opacity: 0.55, depthWrite: false });
    var inner;
    if (kind === 'box') {
      inner = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.01, dims.x), Math.max(0.01, dims.y), Math.max(0.01, dims.z)), mat);
      inner.position.set(dims.x / 2, dims.y / 2, dims.z / 2);
    } else if (kind === 'cylinder') {
      inner = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.01, dims.r), Math.max(0.01, dims.r), Math.max(0.01, dims.h), 32), mat);
      inner.rotation.x = Math.PI / 2; // three.js ทรงกระบอกยึดแกน Y เป็นค่าเริ่มต้น หมุนให้ตรงกับ OCCT ที่ยึดแกน Z
      inner.position.set(0, 0, dims.h / 2);
    } else {
      inner = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.01, dims.r), 24, 16), mat);
    }
    anchor.add(inner);
    return anchor;
  }
  function rebuildPreview() {
    var f = readForm();
    if (previewAnchor) { xform.detach(); scene.remove(previewAnchor); }
    previewAnchor = buildPreviewMesh(f.kind, f.dims);
    previewAnchor.position.set(f.pos.x, f.pos.y, f.pos.z);
    scene.add(previewAnchor);
    xform.attach(previewAnchor);
  }
  function repositionPreview() {
    if (!previewAnchor) return;
    previewAnchor.position.set(num('posX', 0), num('posY', 0), num('posZ', 0));
  }
  function resize() {
    if (!viewportEl || !renderer) return;
    var w = viewportEl.clientWidth, h = viewportEl.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  function frameCamera(sphere) {
    if (!sphere || !isFinite(sphere.radius) || sphere.radius <= 0) return;
    var dir = new THREE.Vector3(0.6, 0.5, 0.7).normalize();
    camera.position.copy(sphere.center).addScaledVector(dir, sphere.radius * 2.6);
    controls.target.copy(sphere.center);
    camera.near = Math.max(0.1, sphere.radius / 100);
    camera.far = sphere.radius * 50;
    camera.updateProjectionMatrix();
  }

  /* ══════════════════ overlay (loading/idle/error) ══════════════════ */
  function setOverlay(mode, text) {
    if (mode === 'hidden') { overlayEl.hidden = true; return; }
    overlayEl.hidden = false;
    spinnerEl.style.display = mode === 'loading' ? '' : 'none';
    overlayTextEl.textContent = text;
    overlayTextEl.className = mode === 'error' ? 'c3-error' : '';
  }
  function setExportEnabled(on) {
    $('exportStepBtn').disabled = !on; $('exportStlBtn').disabled = !on; $('exportGlbBtn').disabled = !on;
  }

  /* ══════════════════ สร้างรูปทรงใหม่ + วาดใหม่ทุกครั้งที่ steps เปลี่ยน ══════════════════
     rebuildToken กัน race condition: ถ้าผู้ใช้กดเพิ่ม/ลบขั้นตอนรัวๆ ระหว่างที่ยังโหลด/คำนวณค้างอยู่
     ผลลัพธ์เก่าที่มาทีหลังจะถูกทิ้งไป ใช้แค่ผลจากคำขอล่าสุดเท่านั้น */
  var rebuildToken = 0;
  function rebuildAndRender() {
    var myToken = ++rebuildToken;
    updateStepsUI();
    if (!state.steps.length) {
      if (mesh) { scene.remove(mesh); mesh = null; }
      setOverlay('idle', 'เพิ่มรูปทรงแรกด้านบนเพื่อเริ่มสร้างชิ้นงาน');
      setExportEnabled(false);
      return;
    }
    setOverlay('loading', state.oc ? 'กำลังสร้างรูปทรง 3 มิติ...' : 'กำลังโหลดเคอร์เนล 3 มิติ (OpenCascade) จากอินเทอร์เน็ต — ครั้งแรกอาจใช้เวลาสักครู่ตามความเร็วอินเทอร์เน็ต...');
    loadOC().then(function (oc) {
      if (myToken !== rebuildToken) return;
      state.oc = oc;
      var shape = rebuildShape(oc, state.steps);
      var result = shapeToGeometry(oc, shape);
      if (myToken !== rebuildToken) return;
      state.lastStlBytes = result.bytes;
      state.lastShape = shape;
      if (mesh) scene.remove(mesh);
      result.geometry.computeVertexNormals();
      result.geometry.computeBoundingSphere();
      mesh = new THREE.Mesh(result.geometry, new THREE.MeshStandardMaterial({ color: 0x5D8AF0, metalness: 0.12, roughness: 0.55 }));
      scene.add(mesh);
      frameCamera(result.geometry.boundingSphere);
      setOverlay('hidden');
      setExportEnabled(true);
    }).catch(function (err) {
      if (myToken !== rebuildToken) return;
      console.error('[cad3d] สร้างรูปทรงไม่สำเร็จ:', err);
      setOverlay('error', 'สร้างรูปทรง 3 มิติไม่สำเร็จ — ' + (err && err.message ? err.message : String(err)) + ' (ดูรายละเอียดเพิ่มเติมใน console ของเบราว์เซอร์)');
      setExportEnabled(false);
    });
  }

  /* ══════════════════ ฟอร์มเพิ่มรูปทรง ══════════════════ */
  var shapeKindSel = $('shapeKindSel'), addShapeBtn = $('addShapeBtn'), opWrap = $('opWrap'), opSel = $('opSel');
  var dimsBox = $('dimsBox'), dimsCylinder = $('dimsCylinder'), dimsSphere = $('dimsSphere');
  function updateDimsUI() {
    var k = shapeKindSel.value;
    dimsBox.hidden = k !== 'box'; dimsCylinder.hidden = k !== 'cylinder'; dimsSphere.hidden = k !== 'sphere';
  }
  function num(id, fallback) { var v = parseFloat($(id).value); return isFinite(v) ? v : fallback; }
  function readForm() {
    var kind = shapeKindSel.value, dims;
    if (kind === 'box') dims = { x: num('boxX', 100), y: num('boxY', 80), z: num('boxZ', 40) };
    else if (kind === 'cylinder') dims = { r: num('cylR', 20), h: num('cylH', 60) };
    else dims = { r: num('sphR', 25) };
    return { kind: kind, dims: dims, pos: { x: num('posX', 0), y: num('posY', 0), z: num('posZ', 0) } };
  }
  function updateAddUI() {
    var has = state.steps.length > 0;
    opWrap.hidden = !has;
    addShapeBtn.textContent = has ? '✔️ รวมเข้ากับชิ้นงานหลัก' : '✔️ วางเป็นชิ้นงานหลัก';
    $('undoStepBtn').disabled = !has;
    $('resetBtn').disabled = !has;
  }

  /* ══════════════════ รายการขั้นตอน ══════════════════ */
  var KIND_LABEL = { box: 'กล่อง', cylinder: 'ทรงกระบอก', sphere: 'ทรงกลม' };
  var OP_LABEL = { add: 'เริ่มจาก', union: 'รวมกับ', cut: 'ตัดออกด้วย', intersect: 'หาส่วนร่วมกับ' };
  function dimsLabel(step) {
    if (step.kind === 'box') return step.dims.x + '×' + step.dims.y + '×' + step.dims.z + ' มม.';
    if (step.kind === 'cylinder') return 'R' + step.dims.r + ' × สูง ' + step.dims.h + ' มม.';
    return 'R' + step.dims.r + ' มม.';
  }
  function updateStepsUI() {
    var list = $('stepsList');
    if (!state.steps.length) { list.innerHTML = '<div class="hint">ยังไม่มีขั้นตอน</div>'; return; }
    list.innerHTML = state.steps.map(function (s, i) {
      var p = s.pos, posTxt = (p.x || p.y || p.z) ? (' ที่ตำแหน่ง (' + p.x + ', ' + p.y + ', ' + p.z + ')') : '';
      return '<div class="c3-step-row"><b>' + (i + 1) + '.</b><span>' + OP_LABEL[s.op] + KIND_LABEL[s.kind] + ' ' + dimsLabel(s) + posTxt + '</span></div>';
    }).join('');
  }

  /* ══════════════════ ส่งออกไฟล์ ══════════════════ */
  function downloadBlob(bytes, filename, mime) {
    var blob = new Blob([bytes], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportStep() {
    if (!state.oc || !state.lastShape) return;
    try {
      var oc = state.oc;
      var writer = new oc.STEPControl_Writer_1();
      writer.Transfer(state.lastShape, oc.STEPControl_StepModelType.STEPControl_AsIs, true, new oc.Message_ProgressRange_1());
      var fname = '/tanot_export.step';
      writer.Write(fname);
      var data = oc.FS.readFile(fname);
      try { oc.FS.unlink(fname); } catch (e) {}
      downloadBlob(new Uint8Array(data), 'tanot-model.step', 'application/step');
    } catch (err) {
      console.error('[cad3d] ส่งออก STEP ไม่สำเร็จ:', err);
      alert('ส่งออก STEP ไม่สำเร็จ — ดูรายละเอียดใน console ของเบราว์เซอร์');
    }
  }
  function exportStl() {
    if (!state.lastStlBytes) return;
    downloadBlob(state.lastStlBytes, 'tanot-model.stl', 'model/stl');
  }
  function exportGlb() {
    if (!mesh) return;
    new GLTFExporter().parse(mesh, function (result) {
      downloadBlob(new Uint8Array(result), 'tanot-model.glb', 'model/gltf-binary');
    }, function (err) { console.error('[cad3d] ส่งออก GLB ไม่สำเร็จ:', err); alert('ส่งออก GLB ไม่สำเร็จ'); }, { binary: true });
  }

  /* ══════════════════ ผูกปุ่ม + boot ══════════════════ */
  function boot() {
    loadSteps();
    initScene();
    updateDimsUI();
    updateAddUI();
    rebuildAndRender();
    rebuildPreview();

    shapeKindSel.addEventListener('change', function () { updateDimsUI(); rebuildPreview(); });
    ['boxX', 'boxY', 'boxZ', 'cylR', 'cylH', 'sphR'].forEach(function (id) {
      $(id).addEventListener('input', rebuildPreview);
    });
    ['posX', 'posY', 'posZ'].forEach(function (id) {
      $(id).addEventListener('input', repositionPreview);
    });
    addShapeBtn.addEventListener('click', function () {
      var f = readForm();
      var step = { op: state.steps.length ? opSel.value : 'add', kind: f.kind, dims: f.dims, pos: f.pos };
      state.steps.push(step);
      saveSteps(); updateAddUI(); rebuildAndRender();
    });
    $('undoStepBtn').addEventListener('click', function () {
      state.steps.pop(); saveSteps(); updateAddUI(); rebuildAndRender();
    });
    $('resetBtn').addEventListener('click', function () {
      if (!window.confirm('เริ่มใหม่ทั้งหมด? ขั้นตอนทั้งหมดที่สร้างไว้จะถูกลบ')) return;
      state.steps = []; saveSteps(); updateAddUI(); rebuildAndRender();
    });
    $('exportStepBtn').addEventListener('click', exportStep);
    $('exportStlBtn').addEventListener('click', exportStl);
    $('exportGlbBtn').addEventListener('click', exportGlb);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
