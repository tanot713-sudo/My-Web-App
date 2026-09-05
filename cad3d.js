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

   ส่วนขยาย: "จากภาพร่าง 2 มิติ" — ดึงเส้นขอบปิดจากแบบที่วาดไว้ในหน้า cad.html (อ่านตรงจาก localStorage
   คีย์เดียวกับที่ cad.js ใช้บันทึกอัตโนมัติ) แล้วอัดขึ้นตรง (extrude, BRepPrimAPI_MakePrism) หรือหมุนรอบแกน
   (revolve, BRepPrimAPI_MakeRevol) ให้เป็นชิ้นงาน 3 มิติจริง — รองรับเฉพาะเส้นขอบที่ "ปิด" อยู่แล้วในตัวเอง
   โดยไม่ต้องเดา: สี่เหลี่ยม/วงกลม/พอลีไลน์ปิด เท่านั้น (เส้นตรงหลายเส้นต่อกันเป็นวงปิด/เส้นโค้งส่วนโค้ง/
   สปไลน์ ยังไม่รองรับ — ต้องใช้อัลกอริทึมเดินกราฟหาวงปิดที่ซับซ้อนกว่านี้ ตัดออกไปตั้งใจในสเตจนี้)
   preview ของชนิดนี้เป็นแค่เส้นขอบแบนราบ (ไม่พองเป็น 3 มิติจริงแบบ preview ของกล่อง/ทรงกระบอก/ทรงกลม)
   เพราะการ extrude/revolve จริงต้องผ่าน OCCT เท่านั้น เห็นผลจริงหลังกดยืนยันแล้วเท่านั้น

   Stage 10a: เดิมไฟล์นี้อยู่คู่กับหน้าแยกต่างหาก cad3d.html แต่ตอนนี้ถูกรวมเข้าไปเป็นแท็บ
   "มุมมอง 3 มิติ" ในหน้า cad.html เดียวกับเครื่องมือเขียนแบบ 2 มิติแล้ว (cad3d.html เดิมเหลือไว้แค่
   เป็นหน้า redirect ไปหา cad.html#3d เพื่อไม่ให้ลิงก์/บุ๊กมาร์กเก่าพัง) — ไฟล์นี้เองยังทำงานเป็น IIFE
   แยก scope ของตัวเองเหมือนเดิมทุกอย่าง ไม่ต้องแก้ตรรกะภายในเลย มีแค่จุดเดียวที่เพิ่ม: ฟัง custom event
   'cad3d:tabshown' ที่ยิงมาจาก cad.html ตอนผู้ใช้สลับมาแท็บนี้ เพื่อ resize() วิวพอร์ตใหม่ (ตอนแท็บถูกซ่อน
   อยู่ ขนาด viewport เป็น 0 เพราะ CSS "hidden" ทำให้ boot() ตอนแรกไม่รู้ขนาดจริงที่จะใช้)

   Stage 10b: "feature tree" แก้ย้อนหลังได้ — state.steps เดิมเป็น feature list อยู่แล้วโดยธรรมชาติ
   (rebuildShape() replay ทั้งสายใหม่ทุกครั้งอยู่แล้ว) แต่ UI เดิมแก้ได้แค่ตัวท้ายสุด (undo/reset) สเตจนี้
   เพิ่ม 3 การกระทำต่อขั้นตอน โดยไม่แตะ pipeline การสร้างรูปทรงเลย:
   - แก้ไข (editStep): โหลดข้อมูลขั้นตอนนั้นกลับเข้าฟอร์ม "เพิ่มรูปทรง" ด้านบน แล้วกด "บันทึกการแก้ไข"
     แทนที่ข้อมูลเดิมที่ index นั้นตรงๆ ("จากภาพร่าง 2 มิติ" พิเศษหน่อย: profile เดิมเป็นสำเนาข้อมูลดิบ ไม่ใช่
     index อ้างอิง เลยต้องเทียบ JSON กับรายการ profile ปัจจุบันเพื่อหาช่องที่ตรงกัน — ถ้าภาพ 2 มิติเปลี่ยนไป
     จนหาไม่เจอ จะบังคับให้เลือกใหม่แทนการเดา/คงค่าที่มองไม่เห็นไว้เงียบๆ)
   - ลบ (deleteStep): ลบขั้นตอนกลางๆ ได้ ไม่ใช่แค่ตัวท้ายเหมือน undo เดิม
   - ปิด/เปิดใช้งานชั่วคราว (toggleSuppress): เก็บข้อมูลไว้แต่ข้ามตอน rebuildShape() — มีประโยชน์ตอนหา
     ว่าขั้นตอนไหนทำให้ boolean chain พังโดยไม่ต้องลบทิ้งจริง
   ตั้งใจไม่ทำ: สลับลำดับขั้นตอน (reorder) — boolean op มีผลตามลำดับ สลับมั่วอาจได้ผลลัพธ์ผิดแบบเงียบๆ

   Stage 10c: ร่างบนระนาบมาตรฐาน 3 แบบ (Top/Front/Right) แทนระนาบ XY ตายตัวเดิม — ดูฟังก์ชัน
   mapPlanePoint/planeNormalVec/extrudeVecForPlane/axisVectorForPlane/extrudeAxisLetter ด้านล่าง

   Stage 10d: "คลิกหน้าจริงของชิ้นงานเพื่อร่างบนหน้านั้น" — ต่อยอดจาก Stage 10c โดยขยาย "ระนาบ" (plane)
   จากเดิมที่เป็น string ('top'/'front'/'right') ให้รับอ็อบเจกต์ฐาน (basis object) ได้ด้วย:
   { origin:{x,y,z}, normal:{x,y,z}, xDir:{x,y,z}, yDir:{x,y,z} } — ทุกฟังก์ชัน map...Point/axis...ForPlane
   ด้านบนแก้ให้เช็ก "เป็นอ็อบเจกต์ไหม" ก่อน (isPlaneObject) แล้วค่อย fallback ไปกรณี string เดิม พิสูจน์แล้วว่าพฤติกรรม
   เดิมของ 3 ระนาบ string ไม่เปลี่ยนแปลงเลย (unit test)

   วิธีหา "หน้า" จากการคลิก: ใช้ three.js Raycaster ยิงเข้า mesh ที่แสดงผลอยู่แล้ว (ตาข่ายจาก STL, ไม่ใช่
   TopoDS_Face ของ OCCT โดยตรง) หาสามเหลี่ยมที่โดนคลิก แล้วรวบรวมสามเหลี่ยมอื่นๆ ที่ "อยู่ระนาบเดียวกัน"
   (ทิศ normal เดียวกัน + ระยะตั้งฉากจากจุดกำเนิดเท่ากัน ภายใน tolerance) — ตั้งใจเลือกวิธีนี้แทนการเดิน
   TopExp_Explorer + BRepAdaptor_Surface (วิธีมาตรฐานของ OCCT เอง) เพราะ (ก) ไม่ต้องเพิ่ม per-face meshing
   pipeline ใหม่ ใช้ mesh ที่มีอยู่แล้วตรงๆ (ข) เป็นคณิตศาสตร์ล้วนๆ ทดสอบได้เต็มที่แบบไม่ต้องพึ่ง OCCT/CDN เลย
   ต่างจากเส้นทาง OCCT ที่ยังไม่เคยรันจริงได้ในแซนด์บ็อกซ์นี้เลยสักครั้ง — ข้อจำกัดที่ยอมรับ: ตรวจจับ "หน้า"
   แบบ coplanar ล้วนๆ ไม่ได้เดิน adjacency จริง เลยถ้ามีหน้าเรียบคนละหน้าที่บังเอิญอยู่ระนาบเดียวกันเป๊ะ (เช่น
   ผิวกล่อง 2 ก้อนชนกันพอดี) จะถูกนับรวมเป็นหน้าเดียวกันผิดพลาด (กรณีหายากมาก ยอมรับได้)

   ข้อจำกัดอื่นที่ตั้งใจยอมรับในสเตจนี้: (1) รองรับเฉพาะโหมด "อัดขึ้นตรง" บนหน้าที่เลือกเอง ไม่รองรับ "หมุน
   รอบแกน" (แกนหมุนของ revolve บนระนาบ string เดิมยึดผ่านจุดกำเนิดโลกเสมอ ซึ่งไม่มีความหมายสำหรับระนาบที่
   ลอยอยู่กลางอากาศ ต้องคิดเรื่องตำแหน่งแกนใหม่ทั้งหมด ตัดออกไปก่อน) (2) จุดจับลากความสูง (height-drag
   handle จาก Stage ก่อนหน้า) ใช้ไม่ได้กับหน้าที่เลือกเอง เพราะทิศตั้งฉากของหน้าที่คลิกไม่จำเป็นต้องตรงกับ
   แกนโลกแกนใดแกนหนึ่งเสมอไป (TransformControls แบบ showX/Y/Z ล็อกได้แค่แกนโลก) — ใช้กรอกตัวเลขความสูง
   แทนเท่านั้นสำหรับกรณีนี้ (3) เป็นการอ้างอิงตำแหน่ง "ครั้งเดียว" (one-shot) ไม่ associative — ถ้าขั้นตอน
   ก่อนหน้าถูกแก้ไขทีหลังจนรูปทรงเปลี่ยนไป ตำแหน่งหน้าที่บันทึกไว้จะไม่ขยับตาม ต้องเลือกหน้าใหม่เอง
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
  var editingIndex = null; // Stage 10b: index ของขั้นตอนที่กำลังแก้ไขอยู่ (null = โหมดเพิ่มขั้นตอนใหม่ตามปกติ)
  var pickedPlaneBasis = null; // Stage 10d: อ็อบเจกต์ฐานของหน้าที่เลือกเองล่าสุด (null = ยังไม่เคยเลือก)
  var pickMode = false; // Stage 10d: กำลังรอให้ผู้ใช้คลิกหน้าในวิวพอร์ตอยู่หรือไม่
  /* Stage 11: ร่างภาพตรงในมุมมอง 3 มิติ (เหมือน SolidWorks) — วาดสี่เหลี่ยม/วงกลม/เส้นหลายจุดปิดรูปด้วย
     การคลิกในวิวพอร์ตตรงๆ แทนการสลับไปวาดที่แท็บ 2 มิติ ดูฟังก์ชันกลุ่ม "เริ่ม/จบการร่างภาพในวิว" ด้านล่าง */
  var liveSketchActive = false;
  var liveSketchTool = 'rect'; // 'rect' | 'circle' | 'polyline'
  var liveSketchPts = []; // จุด (u,v) ที่คลิกไว้แล้วของรูปที่กำลังวาดอยู่ (ยังไม่ปิดรูป)
  var liveSketchPlaneSnapshot = null; // { raw, normal:THREE.Vector3, origin:THREE.Vector3 } ล็อกไว้ตอนเริ่มร่าง กันระนาบเปลี่ยนกลางคัน
  var liveSketchPreviewGroup = null; // THREE.Group เส้น/จุด preview ระหว่างวาด (คนละก้อนกับ previewAnchor ของรูปทรงพื้นฐาน)
  var liveSketchDownPos = null; // แยกคลิกจริงจากการลากเล็กน้อย (เมาส์สั่น) เหมือน pickDownPos ของ Stage 10d
  var liveSketchProfiles = []; // เส้นขอบที่ร่างในวิว 3 มิติสะสมไว้ (รอดจากการกด "โหลดใหม่" ซึ่งอ่านจากแบบ 2 มิติเท่านั้น)
  var scene, camera, renderer, controls, mesh, viewportEl;
  var xform, previewAnchor;
  var heightXform, heightHandle, heightLine;
  var raycaster = new THREE.Raycaster(); // Stage 10d
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

  /* ══════════════════ Stage 10c: ร่างบนระนาบ (Front/Top/Right) ══════════════════
     ก่อนหน้านี้ profile (u,v) ของภาพร่าง 2 มิติถูกวางบนระนาบ XY โลก (z=0) ตายตัวเสมอ ตอนนี้เลือกได้ว่า
     จะวางบนระนาบไหนใน 3 ระนาบมาตรฐาน (ตามธรรมเนียม SolidWorks): Top (XY, ค่าเริ่มต้นเดิม) / Front (XZ) /
     Right (YZ) — extrude จะยืดตามทิศทาง "ตั้งฉากกับระนาบ" แทนแกน Z ตายตัว และแกนหมุน (revolve) เปลี่ยนไป
     ตามระนาบด้วย (ดูหมายเหตุที่ axisVectorForPlane ด้านล่าง)
     ฟังก์ชันเหล่านี้เป็นคณิตศาสตร์ล้วนๆ ไม่ต้องพึ่ง oc เลย (ทดสอบแยกได้โดยไม่ต้องมี OCCT/เบราว์เซอร์) —
     ใช้แค่ตอนแปลงเป็นจริง (ห่อด้วย oc.gp_Pnt_3/oc.gp_Dir_4/oc.gp_Vec_4) ในฟังก์ชันที่ต้องใช้ oc เท่านั้น */
  /* Stage 10d: "ระนาบ" (plane) ตอนนี้เป็นได้ 2 แบบ — string เดิม ('top'/'front'/'right') หรืออ็อบเจกต์ฐาน
     เต็มรูปแบบ { origin:{x,y,z}, normal:{x,y,z}, xDir:{x,y,z}, yDir:{x,y,z} } (จากการคลิกเลือกหน้าจริง) —
     ทุกฟังก์ชันด้านล่างเช็กแบบนี้ก่อนเสมอแล้วค่อย fallback ไปกรณี string 3 แบบเดิม (พฤติกรรมของ 3 แบบเดิม
     ไม่เปลี่ยนแปลงเลย ยืนยันด้วย unit test) */
  function isPlaneObject(plane) { return !!plane && typeof plane === 'object'; }
  function mapPlanePoint(plane, u, v) {
    if (isPlaneObject(plane)) {
      return {
        x: plane.origin.x + plane.xDir.x * u + plane.yDir.x * v,
        y: plane.origin.y + plane.xDir.y * u + plane.yDir.y * v,
        z: plane.origin.z + plane.xDir.z * u + plane.yDir.z * v
      };
    }
    if (plane === 'front') return { x: u, y: 0, z: v };
    if (plane === 'right') return { x: 0, y: u, z: v };
    return { x: u, y: v, z: 0 }; // top (ค่าเริ่มต้นเดิม)
  }
  function planeNormalVec(plane) {
    if (isPlaneObject(plane)) return plane.normal;
    if (plane === 'front') return { x: 0, y: 1, z: 0 };
    if (plane === 'right') return { x: 1, y: 0, z: 0 };
    return { x: 0, y: 0, z: 1 }; // top
  }
  function extrudeVecForPlane(plane, h) {
    var n = planeNormalVec(plane);
    return { x: n.x * h, y: n.y * h, z: n.z * h };
  }
  /* axis 'x'/'y' หมายถึง "แกนที่ 1/2 ของ profile เอง" (แกน u/v) ไม่ใช่แกนโลกตรงๆ — พอแมปผ่านระนาบแล้ว
     จะกลายเป็นแกนโลกที่ต่างกันไปตามระนาบ (ดูตารางในคอมเมนต์ dimsLabel/AXIS_LABELS_BY_PLANE ด้านล่าง)
     revolveAxisStraddle() ยังใช้ตรรกะเดิมได้ทั้งหมดโดยไม่ต้องแก้ เพราะเช็กจากพิกัด (u,v) ของ profile เอง
     ตรงๆ อยู่แล้ว ไม่สนใจว่าจะแมปไปเป็นแกนโลกไหน (ไม่ใช้กับระนาบที่เลือกเอง — โหมดหมุนรอบแกนไม่รองรับกรณีนั้น) */
  function axisVectorForPlane(plane, axis) {
    if (isPlaneObject(plane)) return axis === 'y' ? plane.yDir : plane.xDir;
    if (plane === 'front') return axis === 'y' ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    if (plane === 'right') return axis === 'y' ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
    return axis === 'y' ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }; // top (ค่าเริ่มต้นเดิม)
  }
  /* คืนค่า null สำหรับระนาบที่เลือกเอง (object) — หมายถึง "ไม่มีแกนโลกแกนเดียวที่ตรงกับทิศตั้งฉากของ
     ระนาบนี้เสมอไป" ใช้เป็นสัญญาณให้ updateHeightHandle() ซ่อนจุดจับลากความสูงไปเลยสำหรับกรณีนี้
     (ดูหมายเหตุ Stage 10d ที่หัวไฟล์) */
  function extrudeAxisLetter(plane) {
    if (isPlaneObject(plane)) return null;
    return plane === 'front' ? 'y' : (plane === 'right' ? 'x' : 'z');
  }
  /* Stage 11: จุดกำเนิดของระนาบ — string ทั้ง 3 แบบเดิมยึดจุดกำเนิดโลกเสมอ (0,0,0) ต่างจากอ็อบเจกต์ฐาน
     (หน้าที่เลือกเอง) ที่มี origin จริงลอยอยู่กลางอากาศ */
  function planeOriginVec(plane) {
    if (isPlaneObject(plane)) return plane.origin;
    return { x: 0, y: 0, z: 0 };
  }
  function dot3(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  /* Stage 11: ฟังก์ชันผกผันของ mapPlanePoint — แปลงจุดในโลก 3 มิติ (world point, สมมติว่าอยู่บนระนาบนี้
     พอดีอยู่แล้ว เช่นจากการยิง Raycaster ตัดกับระนาบจริง) กลับเป็นพิกัด (u,v) บนระนาบ ใช้หลักการเดียวกับ
     การฉายเวกเตอร์ตั้งฉาก (orthogonal projection): เพราะ xDir/yDir ของทุกระนาบเป็นเวกเตอร์หน่วยตั้งฉากกัน
     เสมอ (unit + orthogonal ทั้ง 3 กรณี string เดิมและอ็อบเจกต์ฐานที่สร้างจาก buildPlaneBasisFromNormal)
     การ dot product จุดที่ลบ origin ออกแล้วกับ xDir/yDir จึงคืนค่า u/v ที่ถูกต้องพอดี ไม่ต้องแก้สมการเชิงเส้น
     เต็มรูปแบบ (ยืนยันด้วย unit test round-trip กับ mapPlanePoint ทั้ง string และอ็อบเจกต์ฐาน รวมถึงกรณีเอียง) */
  function unmapPlanePoint(plane, worldPt) {
    var origin = planeOriginVec(plane);
    var rel = { x: worldPt.x - origin.x, y: worldPt.y - origin.y, z: worldPt.z - origin.z };
    return { x: dot3(rel, axisVectorForPlane(plane, 'x')), y: dot3(rel, axisVectorForPlane(plane, 'y')) };
  }

  /* ══════════════════ Stage 10d: หา "หน้าเรียบ" จากการคลิกบนตาข่ายที่แสดงผล ══════════════════
     ฟังก์ชันกลุ่มนี้เป็นคณิตศาสตร์ล้วนๆ (เวกเตอร์ 3 มิติแบบ plain object ไม่พึ่ง THREE.Vector3 หรือ OCCT
     เลย) ทดสอบแยกได้เต็มที่ในแซนด์บ็อกซ์ที่ CDN ถูกบล็อกอยู่ */
  function cross3(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
  function normalize3(v) { var l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; }
  /* normal ของสามเหลี่ยม (a,b,c) แต่ละจุดเป็น {x,y,z} — คืน null ถ้าสามเหลี่ยมเสื่อม (พื้นที่ ~0) */
  function triangleNormal(a, b, c) {
    var u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    var v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    var n = cross3(u, v);
    var len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
    if (len < 1e-12) return null;
    return { x: n.x / len, y: n.y / len, z: n.z / len };
  }
  /* positions: array แบบแบน [x0,y0,z0, x1,y1,z1, x2,y2,z2, ...] ไม่มี index (ตรงกับ
     BufferGeometry.attributes.position.array ที่ STLLoader สร้างให้ — ทุก 9 ค่า = 1 สามเหลี่ยม) —
     คืนสามเหลี่ยม (ตามลำดับ triangle index) ที่ "อยู่ระนาบเดียวกัน" กับสามเหลี่ยมที่ refTriIndex ทั้งหมด
     (normal ทิศเดียวกันภายในมุม tolerance + ระยะตั้งฉากจากจุดกำเนิดเท่ากันภายใน tolerance) */
  function findCoplanarTriangles(positions, refTriIndex, normalCosTol, distTol) {
    var triCount = Math.floor(positions.length / 9);
    if (refTriIndex < 0 || refTriIndex >= triCount) return null;
    function triPts(t) {
      var o = t * 9;
      return [
        { x: positions[o], y: positions[o + 1], z: positions[o + 2] },
        { x: positions[o + 3], y: positions[o + 4], z: positions[o + 5] },
        { x: positions[o + 6], y: positions[o + 7], z: positions[o + 8] }
      ];
    }
    var refPts = triPts(refTriIndex);
    var refN = triangleNormal(refPts[0], refPts[1], refPts[2]);
    if (!refN) return null;
    var refD = refN.x * refPts[0].x + refN.y * refPts[0].y + refN.z * refPts[0].z;
    var matched = [];
    for (var t = 0; t < triCount; t++) {
      var pts = triPts(t);
      var n = triangleNormal(pts[0], pts[1], pts[2]);
      if (!n) continue;
      var cos = n.x * refN.x + n.y * refN.y + n.z * refN.z;
      if (cos < normalCosTol) continue;
      var d = refN.x * pts[0].x + refN.y * pts[0].y + refN.z * pts[0].z;
      if (Math.abs(d - refD) > distTol) continue;
      matched.push(t);
    }
    return { normal: refN, offset: refD, triangles: matched };
  }
  /* สร้างแกน x/y ในระนาบตั้งฉากกับ normal แบบตายตัว (deterministic) ไม่มีความหมายพิเศษว่าแกนไหนคือ "ขวา/
     บน" ของหน้านั้น (ผู้ใช้ยังลากภาพร่าง 2 มิติในระนาบนี้ได้ปกติ แค่ทิศ u/v อาจไม่ตรงสัญชาตญาณเป๊ะ) —
     เลือกแกนโลกที่ไม่ขนานกับ normal มาช่วย cross ก่อน กัน edge case ที่ normal ขนานแกน X พอดี */
  function buildPlaneBasisFromNormal(normal, origin) {
    var helper = Math.abs(normal.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    var xDir = normalize3(cross3(helper, normal));
    var yDir = normalize3(cross3(normal, xDir));
    return { origin: { x: origin.x, y: origin.y, z: origin.z }, normal: normal, xDir: xDir, yDir: yDir };
  }

  /* ══════════════════ สร้างรูปทรง OCCT จริงจากสูตร ══════════════════ */
  /* เส้นขอบปิด (profile) จากแบบ 2 มิติ -> TopoDS_Wire — profile.points (สี่เหลี่ยม/พอลีไลน์ปิด) ต่อ
     จุดเป็นเส้นตรงทีละช่วงวนกลับมาปิดวง หรือ profile.circle (วงกลม) สร้างเป็นขอบวงกลมเต็มวงเส้นเดียว —
     แปลงพิกัด (u,v) ของ profile ผ่าน mapPlanePoint() ตามระนาบที่เลือกก่อนสร้างจุด/วงกลมจริงเสมอ */
  function buildWireFromProfile(oc, profile, plane) {
    var builder = new oc.BRepBuilderAPI_MakeWire_1();
    if (profile.points && profile.points.length > 2) {
      var pts = profile.points;
      for (var i = 0; i < pts.length; i++) {
        var pa = mapPlanePoint(plane, pts[i].x, pts[i].y), pb = mapPlanePoint(plane, pts[(i + 1) % pts.length].x, pts[(i + 1) % pts.length].y);
        var edge = new oc.BRepBuilderAPI_MakeEdge_3(new oc.gp_Pnt_3(pa.x, pa.y, pa.z), new oc.gp_Pnt_3(pb.x, pb.y, pb.z)).Edge();
        builder.Add_1(edge);
      }
    } else if (profile.circle) {
      var c = profile.circle, center = mapPlanePoint(plane, c.cx, c.cy), n = planeNormalVec(plane);
      var ax2 = new oc.gp_Ax2_3(new oc.gp_Pnt_3(center.x, center.y, center.z), new oc.gp_Dir_4(n.x, n.y, n.z));
      builder.Add_1(new oc.BRepBuilderAPI_MakeEdge_8(new oc.gp_Circ_2(ax2, c.r)).Edge());
    }
    return builder.Wire();
  }
  /* เส้นขอบที่จะหมุน (revolve) ต้องอยู่ฝั่งเดียวของแกนหมุนทั้งหมด (ไม่คร่อมแกน) ไม่งั้นผลลัพธ์จะซ้อนทับ
     ตัวเอง (self-intersecting) ซึ่ง OCCT สร้างเป็นทรงตันที่ถูกต้องไม่ได้ — เช็กจากพิกัด 2 มิติของ profile
     ตรงๆ ก่อนเรียก OCCT เลย (ไม่ต้องพึ่ง oc) เพื่อเตือนผู้ใช้ด้วยข้อความที่เข้าใจได้ แทนที่จะปล่อยให้ OCCT
     โยน exception เป็นแค่ตัวเลข pointer ดิบๆ ที่อ่านไม่รู้เรื่อง (ข้อจำกัดที่รู้กันของ opencascade.js) */
  function revolveAxisStraddle(profile, axis) {
    var key = axis === 'y' ? 'x' : 'y'; // หมุนรอบแกน X เช็กช่วงพิกัด Y ของ profile (และกลับกัน)
    var lo = Infinity, hi = -Infinity;
    if (profile.points && profile.points.length) {
      profile.points.forEach(function (p) { var v = p[key]; if (v < lo) lo = v; if (v > hi) hi = v; });
    } else if (profile.circle) {
      var center = key === 'x' ? profile.circle.cx : profile.circle.cy;
      lo = center - profile.circle.r; hi = center + profile.circle.r;
    } else return false;
    var EPS = 1e-6;
    return lo < -EPS && hi > EPS;
  }
  /* ขึ้นรูป 3 มิติจากเส้นขอบปิด: อัดขึ้นตรง (extrude, ตามแกน Z) หรือหมุนรอบแกน (revolve, รอบแกน X/Y ที่ผ่าน
     จุดกำเนิดโลก — ตำแหน่ง (pos) ใช้เลื่อนผลลัพธ์หลังขึ้นรูปแล้ว เหมือนรูปทรงพื้นฐานชนิดอื่น)
     หมุนเต็มรอบ (มุม >= 360°) ต้องใช้ BRepPrimAPI_MakeRevol_2 (overload ที่ไม่รับมุม เป็นตัวสร้างสำหรับ
     "หมุนเต็มวง" โดยเฉพาะของ OCCT) แทนการยัดมุม 2π เข้า overload ที่รับมุม (_1) ตรงๆ — การส่ง 2π เข้า
     overload แบบมีมุมทำให้เกิดขอบ/หน้าประกบกันพอดีที่จุดเริ่ม-จบการหมุน ซึ่ง OCCT มักสร้างทรงตันที่ถูกต้อง
     ไม่ได้ (เป็นสาเหตุ error ตัวเลข pointer ดิบๆ ที่เจอตอน revolve 360° จริงบน production) */
  function buildSketchSolid(oc, dims) {
    var plane = dims.plane || 'top';
    var face = new oc.BRepBuilderAPI_MakeFace_15(buildWireFromProfile(oc, dims.profile, plane), true).Face();
    if (dims.mode === 'revolve') {
      var av = axisVectorForPlane(plane, dims.axis);
      var ax1 = new oc.gp_Ax1_2(new oc.gp_Pnt_3(0, 0, 0), new oc.gp_Dir_4(av.x, av.y, av.z));
      var angleDeg = Math.max(0.01, dims.angle || 360);
      if (angleDeg >= 359.99) return new oc.BRepPrimAPI_MakeRevol_2(face, ax1, false).Shape();
      return new oc.BRepPrimAPI_MakeRevol_1(face, ax1, angleDeg * Math.PI / 180, false).Shape();
    }
    var ev = extrudeVecForPlane(plane, dims.height || 10);
    return new oc.BRepPrimAPI_MakePrism_1(face, new oc.gp_Vec_4(ev.x, ev.y, ev.z), false, true).Shape();
  }
  function buildPrimitive(oc, kind, dims, pos) {
    var shape;
    if (kind === 'box') shape = new oc.BRepPrimAPI_MakeBox_2(Math.max(0.01, dims.x), Math.max(0.01, dims.y), Math.max(0.01, dims.z)).Shape();
    else if (kind === 'cylinder') shape = new oc.BRepPrimAPI_MakeCylinder_1(Math.max(0.01, dims.r), Math.max(0.01, dims.h)).Shape();
    else if (kind === 'sketch') shape = buildSketchSolid(oc, dims);
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
      if (step.suppressed) return; // Stage 10b: ปิดใช้งานชั่วคราว — ข้ามไปเลย เหมือนไม่มีขั้นตอนนี้อยู่
      var prim = buildPrimitive(oc, step.kind, step.dims, step.pos);
      current = current ? booleanOp(oc, step.op, current, prim) : prim;
    });
    return current;
  }
  /* ขั้นตอน "หลัก" ที่ rebuildShape() จะใช้เป็นฐาน (ไม่ใช้ op ของมันเลย) คือขั้นตอนแรกที่ไม่ถูกปิดใช้งาน
     ไม่ใช่ index 0 เสมอไป (ถ้าขั้นแรกๆ ถูกปิดใช้งานอยู่) ใช้เช็กว่าตอนแก้ไขขั้นตอนหนึ่งควรโชว์ตัวเลือก
     "วิธีรวม" หรือไม่ */
  function isBaseStepIndex(idx) {
    for (var i = 0; i < state.steps.length; i++) { if (!state.steps[i].suppressed) return i === idx; }
    return false;
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

    /* ── จุดจับลากกำหนด "ความสูง" ตอนอัดขึ้นตรง (extrude) จากภาพร่าง 2 มิติ — คนละอันกับ xform ด้านบน
       (นั่นลากตำแหน่งทั้งชิ้น ส่วนนี้ลากแค่ตัวเลขความสูงตามแกนเดียว) โชว์แกนเดียวเท่านั้นด้วย showX/showY/
       showZ (รองรับใน TransformControls ของ three.js) — Stage 10c: แกนที่โชว์ตอนนี้ขึ้นกับ "ระนาบร่าง"
       ที่เลือกด้วย (Top=Z, Front=Y, Right=X) ตั้งค่าจริงใน updateHeightHandle() ทุกครั้งที่ preview
       เปลี่ยน ไม่ hardcode ไว้ตรงนี้แล้วเหมือนก่อนหน้านี้ (ตอนสร้างยังไม่รู้ว่าจะใช้ระนาบไหน) — attach
       เป็นลูกของ previewAnchor ตัวเดียวกับที่ xform คุมตำแหน่งอยู่ เพื่อให้จุดจับความสูงเคลื่อนตามไปด้วย
       เวลาลากย้ายตำแหน่งทั้งชิ้น */
    heightXform = new TransformControls(camera, renderer.domElement);
    heightXform.setMode('translate');
    heightXform.addEventListener('dragging-changed', function (e) { controls.enabled = !e.value; });
    heightXform.addEventListener('objectChange', function () {
      if (!heightHandle) return;
      var comp = heightXform.showX ? 'x' : (heightXform.showY ? 'y' : 'z');
      var h = Math.max(0.01, round2(heightHandle.position[comp]));
      heightHandle.position[comp] = h;
      $('sketchHeight').value = h;
      updateHeightGuideLine();
    });
    scene.add(heightXform.getHelper ? heightXform.getHelper() : heightXform);

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
  /* preview ของ "จากภาพร่าง 2 มิติ" ตั้งใจให้เป็นแค่เส้นขอบแบนราบ (ไม่พองเป็นทรง 3 มิติจริงเหมือนกล่อง/
     ทรงกระบอก/ทรงกลม) เพราะการ extrude/revolve จริงต้องผ่าน OCCT เท่านั้น (three.js ไม่มี solid kernel) —
     เห็นแค่ "จะใช้เส้นขอบไหน" ก่อน ส่วนความสูง/มุมหมุนจริงจะเห็นผลหลังกดยืนยันแล้วเท่านั้น */
  /* THREE.ShapeGeometry วางแบนอยู่ในระนาบ XY ท้องถิ่นเสมอ (z=0) — พอเลือกระนาบร่างเป็น Front/Right
     ต้องหมุนตัว mesh ทั้งก้อนให้ไปนอนในระนาบโลกที่ถูกต้อง คำนวณผ่าน "เมทริกซ์ฐาน" (basis) ตรงๆ แทนการไล่
     หมุนทีละแกน (Euler) เพื่อไม่ให้พลาดทิศทาง — เวกเตอร์แต่ละแกนตรงนี้ต้องตรงกับ mapPlanePoint() เป๊ะๆ
     (ทดสอบแล้วว่า local (u,v,0) แปลงเป็น mapPlanePoint(plane,u,v) พอดีหลังคูณเมทริกซ์นี้) */
  function planePreviewBasis(plane) {
    if (isPlaneObject(plane)) {
      return {
        x: new THREE.Vector3(plane.xDir.x, plane.xDir.y, plane.xDir.z),
        y: new THREE.Vector3(plane.yDir.x, plane.yDir.y, plane.yDir.z),
        z: new THREE.Vector3(plane.normal.x, plane.normal.y, plane.normal.z)
      };
    }
    if (plane === 'front') return { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 0, 1), z: new THREE.Vector3(0, 1, 0) };
    if (plane === 'right') return { x: new THREE.Vector3(0, 1, 0), y: new THREE.Vector3(0, 0, 1), z: new THREE.Vector3(1, 0, 0) };
    return { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }; // top (ไม่หมุนเลย)
  }
  function buildSketchPreviewMesh(dims) {
    if (!dims || !dims.profile) return null;
    var shape2d = new THREE.Shape();
    if (dims.profile.points && dims.profile.points.length > 2) {
      var pts = dims.profile.points;
      shape2d.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) shape2d.lineTo(pts[i].x, pts[i].y);
      shape2d.closePath();
    } else if (dims.profile.circle) {
      var c = dims.profile.circle;
      shape2d.absarc(c.cx, c.cy, c.r, 0, Math.PI * 2, false);
    } else return null;
    var mat = new THREE.MeshStandardMaterial({ color: 0xF5A524, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape2d), mat);
    var plane = dims.plane || 'top';
    var basis = planePreviewBasis(plane);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(basis.x, basis.y, basis.z));
    /* ระนาบ string เดิม (top/front/right) มี origin คงที่ (0,0,0) เสมอ (previewAnchor.position จากฟอร์ม
       ตำแหน่ง X/Y/Z จัดการการเลื่อนทั้งชิ้นอยู่แล้ว) แต่ระนาบที่เลือกเองมี origin จริงอยู่กลางอากาศ (จุดที่
       คลิกบนหน้าจริง) ต้องออฟเซตตรงนี้เพิ่ม (ฟอร์มตำแหน่ง X/Y/Z ยังใช้ "เลื่อนต่อ" จาก origin นี้ได้ปกติ) */
    if (isPlaneObject(plane)) mesh.position.set(plane.origin.x, plane.origin.y, plane.origin.z);
    return mesh;
  }
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
    } else if (kind === 'sketch') {
      inner = buildSketchPreviewMesh(dims);
    } else {
      inner = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.01, dims.r), 24, 16), mat);
    }
    if (inner) anchor.add(inner);
    return anchor;
  }
  function rebuildPreview() {
    var f = readForm();
    if (previewAnchor) { xform.detach(); scene.remove(previewAnchor); }
    previewAnchor = buildPreviewMesh(f.kind, f.dims);
    previewAnchor.position.set(f.pos.x, f.pos.y, f.pos.z);
    scene.add(previewAnchor);
    xform.attach(previewAnchor);
    updateHeightHandle(f);
  }
  /* จุดจับลากความสูง extrude — มีให้ใช้เฉพาะตอนเลือก "จากภาพร่าง 2 มิติ" + โหมด "อัดขึ้นตรง" + เลือก
     โปรไฟล์แล้วเท่านั้น (กรณีอื่นไม่มีความหมายอะไรให้ลาก) attach เป็นลูกของ previewAnchor
     Stage 10c: ตำแหน่ง/แกนที่ลากได้ของ handle นี้ขึ้นกับ "ระนาบร่าง" ที่เลือกด้วย (extrudeVecForPlane/
     extrudeAxisLetter) — เดิมเดินตามแกน Z เสมอ (ระนาบ Top เท่านั้น) ตอนนี้ Front=แกน Y, Right=แกน X */
  function updateHeightHandle(f) {
    var show = f.kind === 'sketch' && f.dims.mode === 'extrude' && !!f.dims.profile;
    if (heightHandle) { heightXform.detach(); previewAnchor.remove(heightHandle); heightHandle = null; }
    if (heightLine) { heightLine = null; } // (ถูกลบไปพร้อม previewAnchor เก่าแล้วตอน scene.remove ด้านบน)
    if (!show) return;
    var plane = f.dims.plane || 'top';
    var axisLetter = extrudeAxisLetter(plane);
    /* Stage 10d: ระนาบที่เลือกเอง (object) ไม่มีแกนโลกแกนเดียวที่ตรงกับทิศตั้งฉากเสมอไป (extrudeAxisLetter
       คืน null) — TransformControls ล็อกแกนได้แค่แกนโลก (showX/Y/Z) เท่านั้น เลยไม่แสดงจุดจับให้ลากในกรณี
       นี้ ใช้กรอกตัวเลขความสูงแทน (ข้อจำกัดที่ยอมรับ ดูหมายเหตุ Stage 10d ที่หัวไฟล์) */
    if (!axisLetter) return;
    var vec = extrudeVecForPlane(plane, Math.max(0.01, f.dims.height || 20));
    heightHandle = new THREE.Object3D();
    heightHandle.position.set(vec.x, vec.y, vec.z);
    previewAnchor.add(heightHandle);
    heightXform.showX = axisLetter === 'x'; heightXform.showY = axisLetter === 'y'; heightXform.showZ = axisLetter === 'z';
    updateHeightGuideLine();
    heightXform.attach(heightHandle);
  }
  /* เส้นประจากฐาน (จุดกำเนิดท้องถิ่น) ถึงจุดจับ — ให้เห็นระยะ extrude ชัดเจนเวลาลาก ไม่ใช่แค่เห็นลูกศรลอยๆ
     (ใช้ heightHandle.position ตรงๆ ไม่ผูกกับแกนใดแกนหนึ่ง เพื่อให้ใช้ได้ทั้ง 3 ระนาบ) */
  function updateHeightGuideLine() {
    if (heightLine) { previewAnchor.remove(heightLine); heightLine = null; }
    if (!heightHandle) return;
    var pts = [new THREE.Vector3(0, 0, 0), heightHandle.position.clone()];
    heightLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xF5A524, dashSize: 4, gapSize: 3 }));
    heightLine.computeLineDistances();
    previewAnchor.add(heightLine);
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
  var dimsBox = $('dimsBox'), dimsCylinder = $('dimsCylinder'), dimsSphere = $('dimsSphere'), dimsSketch = $('dimsSketch');
  var loadedProfiles = [];
  function updateDimsUI() {
    var k = shapeKindSel.value;
    dimsBox.hidden = k !== 'box'; dimsCylinder.hidden = k !== 'cylinder'; dimsSphere.hidden = k !== 'sphere'; dimsSketch.hidden = k !== 'sketch';
  }
  function num(id, fallback) { var v = parseFloat($(id).value); return isFinite(v) ? v : fallback; }
  /* ══════════════════ อ่านเส้นขอบปิดจากแบบ 2 มิติ (cad.html) ══════════════════
     อ่านตรงจาก localStorage คีย์เดียวกับที่ cad.js ใช้บันทึกอัตโนมัติ — รองรับเฉพาะ 3 ชนิดที่ "ปิด" อยู่
     แล้วในตัวโดยไม่ต้องเดาว่าเส้นหลายเส้นประกอบกันเป็นวงปิดหรือไม่ (ขอบเขตที่ตัดออกไปตั้งใจในสเตจนี้:
     เส้นตรงหลายเส้นต่อกัน/เส้นโค้งส่วนโค้ง/สปไลน์ — ต้องใช้อัลกอริทึมเดินกราฟหาวงปิดที่ซับซ้อนกว่านี้) */
  function read2DProfiles() {
    var profiles = [];
    try {
      var raw = localStorage.getItem('tanot:cad:autosave');
      if (!raw) return profiles;
      var ents = JSON.parse(raw).entities;
      if (!Array.isArray(ents)) return profiles;
      ents.forEach(function (e) {
        if (e.type === 'rect') {
          var w = Math.abs(e.p2.x - e.p1.x), d = Math.abs(e.p2.y - e.p1.y);
          var x0 = Math.min(e.p1.x, e.p2.x), y0 = Math.min(e.p1.y, e.p2.y);
          profiles.push({ label: 'สี่เหลี่ยม ' + w.toFixed(0) + '×' + d.toFixed(0) + ' มม.', points: [{ x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w, y: y0 + d }, { x: x0, y: y0 + d }] });
        } else if (e.type === 'circle') {
          profiles.push({ label: 'วงกลม R' + e.radius.toFixed(0) + ' มม.', circle: { cx: e.center.x, cy: e.center.y, r: e.radius } });
        } else if (e.type === 'polyline' && e.closed && Array.isArray(e.points) && e.points.length > 2) {
          profiles.push({ label: 'พอลีไลน์ปิด (' + e.points.length + ' จุด)', points: e.points.map(function (p) { return { x: p.x, y: p.y }; }) });
        }
      });
    } catch (err) {}
    return profiles;
  }
  /* เลือกภาพร่างล่าสุดให้อัตโนมัติเสมอ (ตัวสุดท้ายในลิสต์ = วาดล่าสุด ตามลำดับที่ read2DProfiles() คืนมา
     ซึ่งเดินตาม entities array ตามลำดับวาดจริง) แทนการปล่อยให้ browser เลือกตัวแรกสุด (ค่าเริ่มต้นเดิม) —
     ลดขั้นตอน "ต้องมาเลือกเองจาก dropdown" ทุกครั้งที่วาดรูปใหม่ ยังกด "โหลดใหม่"/เปลี่ยนเป็นภาพอื่นเองได้ตามปกติ */
  function refreshProfileList() {
    // Stage 11: ต่อท้ายด้วยภาพที่ร่างตรงในวิว 3 มิติ (liveSketchProfiles) เสมอ — ทำให้ภาพที่เพิ่งร่างเสร็จ
    // กลายเป็น "ตัวสุดท้าย" ในลิสต์และถูกเลือกอัตโนมัติทันที (logic เลือกตัวล่าสุดด้านล่างไม่ต้องแก้เลย)
    loadedProfiles = read2DProfiles().concat(liveSketchProfiles);
    var sel = $('sketchProfileSel');
    if (!loadedProfiles.length) {
      sel.innerHTML = '<option value="">(ไม่พบเส้นขอบปิด — วาดในหน้างานเขียนแบบ CAD ก่อน)</option>';
      sel.disabled = true;
    } else {
      sel.disabled = false;
      sel.innerHTML = loadedProfiles.map(function (p, i) { return '<option value="' + i + '">' + p.label + '</option>'; }).join('');
      sel.value = String(loadedProfiles.length - 1);
    }
    rebuildPreview();
    updateSketchAxisWarn();
  }
  function updateSketchModeUI() {
    var revolve = $('sketchModeSel').value === 'revolve';
    $('sketchExtrudeWrap').hidden = revolve;
    $('sketchRevolveWrap').hidden = !revolve;
    $('sketchAngleWrap').hidden = !revolve;
    updateSketchAxisWarn();
  }
  /* Stage 10c: axis 'x'/'y' หมายถึงแกนที่ 1/2 ของ profile เอง (ดูหมายเหตุที่ axisVectorForPlane) ไม่ใช่
     แกนโลกตรงๆ — ป้ายกำกับใน dropdown เลยต้องเปลี่ยนไปตามระนาบที่เลือกเพื่อไม่ให้ผู้ใช้งง (ค่า value ของ
     option ไม่ต้องเปลี่ยน แค่ label ที่โชว์) */
  var AXIS_LABELS_BY_PLANE = { top: ['แกน X', 'แกน Y'], front: ['แกน X', 'แกน Z'], right: ['แกน Y', 'แกน Z'] };
  function updateAxisOptionLabels() {
    var labels = AXIS_LABELS_BY_PLANE[$('sketchPlaneSel').value] || AXIS_LABELS_BY_PLANE.top;
    var opts = $('sketchAxisSel').options;
    opts[0].textContent = labels[0];
    opts[1].textContent = labels[1];
  }
  /* เตือนล่วงหน้าก่อนกด "วาง/รวม" ถ้าโปรไฟล์+แกนหมุนที่เลือกอยู่จะคร่อมแกน (จะสร้างทรงตันไม่ได้แน่ๆ) —
     ให้ผู้ใช้เห็นปัญหาทันทีตอนเลือก ไม่ต้องรอไปเจอตอนกด "วาง" แล้วเสียเวลารอ OCCT คำนวณก่อนถึงจะรู้ */
  function updateSketchAxisWarn() {
    var warnEl = $('sketchAxisWarn');
    if (shapeKindSel.value !== 'sketch' || $('sketchModeSel').value !== 'revolve') { warnEl.hidden = true; return; }
    var idx = parseInt($('sketchProfileSel').value, 10);
    var profile = (isFinite(idx) && loadedProfiles[idx]) ? loadedProfiles[idx] : null;
    warnEl.hidden = !profile || !revolveAxisStraddle(profile, $('sketchAxisSel').value);
  }
  function readForm() {
    var kind = shapeKindSel.value, dims;
    if (kind === 'box') dims = { x: num('boxX', 100), y: num('boxY', 80), z: num('boxZ', 40) };
    else if (kind === 'cylinder') dims = { r: num('cylR', 20), h: num('cylH', 60) };
    else if (kind === 'sketch') {
      var idx = parseInt($('sketchProfileSel').value, 10);
      var planeSelVal = $('sketchPlaneSel').value;
      dims = {
        profile: (isFinite(idx) && loadedProfiles[idx]) ? loadedProfiles[idx] : null,
        plane: (planeSelVal === 'picked' && pickedPlaneBasis) ? pickedPlaneBasis : planeSelVal,
        mode: $('sketchModeSel').value, height: num('sketchHeight', 20), axis: $('sketchAxisSel').value, angle: num('sketchAngle', 360)
      };
    } else dims = { r: num('sphR', 25) };
    return { kind: kind, dims: dims, pos: { x: num('posX', 0), y: num('posY', 0), z: num('posZ', 0) } };
  }
  function updateAddUI() {
    var hasActive = state.steps.some(function (s) { return !s.suppressed; });
    if (editingIndex !== null) {
      opWrap.hidden = isBaseStepIndex(editingIndex);
      addShapeBtn.textContent = '💾 บันทึกการแก้ไข';
      $('cancelEditBtn').hidden = false;
    } else {
      opWrap.hidden = !hasActive;
      addShapeBtn.textContent = hasActive ? '✔️ รวมเข้ากับชิ้นงานหลัก' : '✔️ วางเป็นชิ้นงานหลัก';
      $('cancelEditBtn').hidden = true;
    }
    $('undoStepBtn').disabled = !state.steps.length;
    $('resetBtn').disabled = !state.steps.length;
  }

  /* ══════════════════ รายการขั้นตอน (Stage 10b: feature tree แก้ย้อนหลังได้) ══════════════════ */
  var KIND_LABEL = { box: 'กล่อง', cylinder: 'ทรงกระบอก', sphere: 'ทรงกลม', sketch: 'ภาพร่าง 2 มิติ' };
  var OP_LABEL = { add: 'เริ่มจาก', union: 'รวมกับ', cut: 'ตัดออกด้วย', intersect: 'หาส่วนร่วมกับ' };
  var PLANE_LABEL = { top: 'ระนาบบน (Top)', front: 'ระนาบหน้า (Front)', right: 'ระนาบข้าง (Right)' };
  /* Stage 10d: step.dims.plane อาจเป็นอ็อบเจกต์ฐาน (หน้าที่เลือกเอง) แทน string เดิม — แสดงป้ายกำกับ
     พิเศษแทนการเทียบ string ตรงๆ */
  function planeLabelFor(plane) { return isPlaneObject(plane) ? 'หน้าที่เลือกเอง (Picked Face)' : (PLANE_LABEL[plane] || PLANE_LABEL.top); }
  function dimsLabel(step) {
    if (step.kind === 'box') return step.dims.x + '×' + step.dims.y + '×' + step.dims.z + ' มม.';
    if (step.kind === 'cylinder') return 'R' + step.dims.r + ' × สูง ' + step.dims.h + ' มม.';
    if (step.kind === 'sketch') {
      var planeTxt = ' บน' + planeLabelFor(step.dims.plane);
      return (step.dims.mode === 'revolve'
        ? '(หมุนรอบแกน' + step.dims.axis.toUpperCase() + ' ' + step.dims.angle + '°)'
        : '(อัดขึ้นตรงสูง ' + step.dims.height + ' มม.)') + planeTxt;
    }
    return 'R' + step.dims.r + ' มม.';
  }
  function updateStepsUI() {
    var list = $('stepsList');
    if (!state.steps.length) { list.innerHTML = '<div class="hint">ยังไม่มีขั้นตอน</div>'; return; }
    list.innerHTML = state.steps.map(function (s, i) {
      var p = s.pos, posTxt = (p.x || p.y || p.z) ? (' ที่ตำแหน่ง (' + p.x + ', ' + p.y + ', ' + p.z + ')') : '';
      var editTag = i === editingIndex ? ' <b class="c3-editing-tag">(กำลังแก้ไข)</b>' : '';
      return '<div class="c3-step-row' + (s.suppressed ? ' c3-step-suppressed' : '') + '">' +
        '<b>' + (i + 1) + '.</b><span>' + OP_LABEL[s.op] + KIND_LABEL[s.kind] + ' ' + dimsLabel(s) + posTxt + editTag + '</span>' +
        '<button class="btn sm icon-only" type="button" data-act="toggle" data-idx="' + i + '" title="' + (s.suppressed ? 'เปิดใช้งานขั้นตอนนี้' : 'ปิดใช้งานชั่วคราว (ไม่ลบ)') + '">' + (s.suppressed ? '🚫' : '👁️') + '</button>' +
        '<button class="btn sm icon-only" type="button" data-act="edit" data-idx="' + i + '" title="แก้ไขขั้นตอนนี้">✏️</button>' +
        '<button class="btn sm icon-only" type="button" data-act="delete" data-idx="' + i + '" title="ลบขั้นตอนนี้">🗑️</button>' +
      '</div>';
    }).join('');
  }
  function profilesEqual(a, b) { return !!a && !!b && JSON.stringify(a) === JSON.stringify(b); }
  /* โหลดข้อมูลขั้นตอนที่ index ที่กำหนดกลับเข้าฟอร์ม "เพิ่มรูปทรงพื้นฐาน" ด้านบนเพื่อแก้ไข — ไม่แตะ
     state.steps จริงจนกว่าจะกด "บันทึกการแก้ไข" (ปุ่มเดียวกับ addShapeBtn เดิม สลับความหมายตาม
     editingIndex) */
  function editStep(idx) {
    var step = state.steps[idx];
    if (!step) return;
    editingIndex = idx;
    shapeKindSel.value = step.kind;
    updateDimsUI();
    if (step.kind === 'box') { $('boxX').value = step.dims.x; $('boxY').value = step.dims.y; $('boxZ').value = step.dims.z; }
    else if (step.kind === 'cylinder') { $('cylR').value = step.dims.r; $('cylH').value = step.dims.h; }
    else if (step.kind === 'sphere') { $('sphR').value = step.dims.r; }
    else if (step.kind === 'sketch') {
      if (isPlaneObject(step.dims.plane)) {
        pickedPlaneBasis = step.dims.plane;
        markPickedPlaneAvailable();
        $('sketchPlaneSel').value = 'picked';
      } else {
        $('sketchPlaneSel').value = step.dims.plane || 'top';
      }
      onSketchPlaneChanged();
      updateAxisOptionLabels();
      refreshProfileList(); // อ่านแบบ 2 มิติล่าสุดใหม่ (rebuildPreview() ในตัวถูกเรียกซ้ำอีกทีด้านล่าง ไม่ซ้ำซ้อนเสียหาย)
      var matchIdx = -1;
      for (var i = 0; i < loadedProfiles.length; i++) { if (profilesEqual(loadedProfiles[i], step.dims.profile)) { matchIdx = i; break; } }
      var sel = $('sketchProfileSel');
      if (matchIdx >= 0) {
        sel.value = String(matchIdx);
      } else if (loadedProfiles.length) { // มีโปรไฟล์อื่นอยู่ แต่ตัวเดิมของขั้นตอนนี้หาไม่เจอในนั้น
        var opt = document.createElement('option');
        opt.value = ''; opt.textContent = '⚠️ ไม่พบเส้นขอบเดิม — กรุณาเลือกใหม่';
        sel.insertBefore(opt, sel.firstChild);
        sel.value = '';
      } // ถ้า loadedProfiles ว่างเปล่าอยู่แล้ว refreshProfileList() ใส่ placeholder ที่สื่อความหมายเดียวกันไว้ให้แล้ว
      $('sketchModeSel').value = step.dims.mode;
      updateSketchModeUI();
      $('sketchHeight').value = step.dims.height;
      $('sketchAxisSel').value = step.dims.axis;
      $('sketchAngle').value = step.dims.angle;
    }
    $('posX').value = step.pos.x; $('posY').value = step.pos.y; $('posZ').value = step.pos.z;
    if (!isBaseStepIndex(idx)) opSel.value = step.op;
    updateSketchAxisWarn();
    rebuildPreview();
    updateAddUI();
    updateStepsUI();
  }
  function exitEditMode() {
    editingIndex = null;
    updateAddUI();
    updateStepsUI();
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

  /* ══════════════════ Stage 10d: เลือกหน้าจริงของชิ้นงานเพื่อร่างบนหน้านั้น ══════════════════ */
  function markPickedPlaneAvailable(triCount) {
    var opt = $('pickedPlaneOption');
    opt.disabled = false;
    opt.textContent = 'หน้าที่เลือกเอง' + (triCount ? (' (เลือกแล้ว — ' + triCount + ' เหลี่ยม)') : ' (เลือกแล้ว)');
  }
  /* ระนาบที่เลือกเองไม่รองรับ "หมุนรอบแกน" (ดูหมายเหตุ Stage 10d ที่หัวไฟล์) — สลับตัวเลือกโหมด/ปิดใช้งาน
     ตัวเลือก revolve ให้ตรงกับระนาบที่เลือกอยู่ตอนนี้ทุกครั้งที่เปลี่ยนระนาบ */
  function onSketchPlaneChanged() {
    var isPicked = $('sketchPlaneSel').value === 'picked';
    var revolveOpt = $('sketchModeSel').querySelector('option[value="revolve"]');
    if (revolveOpt) revolveOpt.disabled = isPicked;
    if (isPicked && $('sketchModeSel').value === 'revolve') $('sketchModeSel').value = 'extrude';
    updateAxisOptionLabels();
    updateSketchModeUI();
    rebuildPreview();
  }
  function enterPickMode() {
    if (!mesh) { alert('ยังไม่มีชิ้นงาน 3 มิติให้เลือกหน้า — สร้างรูปทรงอย่างน้อย 1 ขั้นตอนก่อน'); return; }
    if (liveSketchActive) exitLiveSketch(); // คนละโหมดกัน ห้ามเปิดพร้อมกัน (Stage 11)
    pickMode = true;
    viewportEl.classList.add('c3-pick-cursor');
    controls.enabled = false; // กันไม่ให้ลาก orbit ทับการคลิกเลือกหน้า
    $('pickFaceStatus').textContent = 'คลิกที่หน้าเรียบของชิ้นงานด้านล่าง (กด Esc เพื่อยกเลิก)';
  }
  function exitPickMode() {
    pickMode = false;
    viewportEl.classList.remove('c3-pick-cursor');
    controls.enabled = true;
    $('pickFaceStatus').textContent = '';
  }
  var pickDownPos = null;
  function onViewportPointerDown(e) { pickDownPos = { x: e.clientX, y: e.clientY }; }
  function onViewportPointerUp(e) {
    if (!pickMode || !pickDownPos) return;
    var dx = e.clientX - pickDownPos.x, dy = e.clientY - pickDownPos.y;
    pickDownPos = null;
    if (Math.hypot(dx, dy) > 5) return; // ลากกล้อง (orbit) ไม่ใช่คลิกเลือกหน้า
    handleFaceClick(e.clientX, e.clientY);
  }
  function handleFaceClick(clientX, clientY) {
    if (!mesh || !mesh.geometry || !mesh.geometry.attributes.position) { exitPickMode(); return; }
    var rect = renderer.domElement.getBoundingClientRect();
    var ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObject(mesh, false);
    if (!hits.length) { $('pickFaceStatus').textContent = 'ไม่โดนชิ้นงาน — ลองคลิกใหม่อีกครั้ง (กด Esc เพื่อยกเลิก)'; return; }
    var hit = hits[0];
    if (typeof hit.faceIndex !== 'number') { $('pickFaceStatus').textContent = 'อ่านหน้านี้ไม่สำเร็จ — ลองคลิกจุดอื่น (กด Esc เพื่อยกเลิก)'; return; }
    var positions = mesh.geometry.attributes.position.array;
    // มุม tolerance ~3° (cos(3°)≈0.9986) และระยะ tolerance 0.05mm — พอสำหรับความคลาดเคลื่อนของการ mesh จริง
    var coplanar = findCoplanarTriangles(positions, hit.faceIndex, 0.9986, 0.05);
    if (!coplanar) { $('pickFaceStatus').textContent = 'อ่านหน้านี้ไม่สำเร็จ — ลองคลิกจุดอื่นบนหน้าเดียวกัน (กด Esc เพื่อยกเลิก)'; return; }
    pickedPlaneBasis = buildPlaneBasisFromNormal(coplanar.normal, { x: hit.point.x, y: hit.point.y, z: hit.point.z });
    markPickedPlaneAvailable(coplanar.triangles.length);
    $('sketchPlaneSel').value = 'picked';
    onSketchPlaneChanged();
    exitPickMode();
  }

  /* ══════════════════ Stage 11: ร่างภาพตรงในมุมมอง 3 มิติ (เหมือน SolidWorks จริง) ══════════════════
     ต่างจาก Stage 10d (คลิกหน้าเพื่อ "เลือกระนาบ" เฉยๆ) — สเตจนี้ให้ "วาดเส้นขอบปิด" เองตรงๆ ในวิวพอร์ต
     ด้วยการคลิกวางจุดบนระนาบร่างที่กำลังใช้งานอยู่ (มาตรฐาน 3 แบบ หรือหน้าที่เลือกเองจาก Stage 10d ก็ได้)
     หลักการออกแบบสำคัญ: ผลลัพธ์เป็นแค่ "profile" object รูปแบบเดียวกับที่ read2DProfiles() คืนมาทุกประการ
     ({points:[...]} หรือ {circle:{cx,cy,r}}) แล้วยัดเข้า loadedProfiles/sketchProfileSel เหมือนอ่านมาจาก
     แบบ 2 มิติจริง — pipeline ทั้งหมดด้านล่าง (buildWireFromProfile/buildSketchSolid/preview/commit) ใช้
     ต่อได้ทันทีโดยไม่ต้องแก้เลยแม้แต่บรรทัดเดียว (reuse สูงสุดตามที่ตั้งใจไว้)

     ขอบเขต MVP ของสเตจนี้ (ตั้งใจจำกัดไว้ก่อน): ร่างได้ทีละ 1 รูปต่อการกด "ร่างภาพใหม่ตรงนี้" 1 ครั้ง (วาด
     เสร็จแล้วออกจากโหมดร่างอัตโนมัติทันที ไม่ได้ต่อเนื่องหลายรูปในเซสชันเดียว) รูปทรงที่วาดได้มี 3 แบบ
     (สี่เหลี่ยม/วงกลม/เส้นหลายจุดปิดรูป) ไม่มี snap ยึดจุด/เส้นเดิม ไม่มีเครื่องมือมิติ (dimension) บังคับ
     ขนาดเป๊ะๆ ตอนวาด ไม่รองรับส่วนโค้ง/สปไลน์ ไม่รองรับแก้ไขจุดที่วางไปแล้ว (ผิดต้องกด "ยกเลิก" แล้วเริ่ม
     ใหม่ทั้งรูป) — ขยายเป็นสเตจถัดไปได้ตามความจำเป็นจริง ไม่ต่างจากแนวทางเดิมของ Stage 9/10 ในไฟล์นี้ */
  var LIVE_SKETCH_TOOL_LABEL = { rect: 'สี่เหลี่ยม', circle: 'วงกลม', polyline: 'เส้นหลายจุด' };
  function activeSketchPlaneValue() {
    var v = $('sketchPlaneSel').value;
    return (v === 'picked' && pickedPlaneBasis) ? pickedPlaneBasis : v;
  }
  function ensureLiveSketchPreviewGroup() {
    if (!liveSketchPreviewGroup) { liveSketchPreviewGroup = new THREE.Group(); scene.add(liveSketchPreviewGroup); }
    return liveSketchPreviewGroup;
  }
  function clearLiveSketchPreview() {
    if (!liveSketchPreviewGroup) return;
    while (liveSketchPreviewGroup.children.length) {
      var c = liveSketchPreviewGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  }
  function worldPtsFromUV(uvArr) {
    var planeRaw = liveSketchPlaneSnapshot.raw;
    return uvArr.map(function (uv) { var w = mapPlanePoint(planeRaw, uv.x, uv.y); return new THREE.Vector3(w.x, w.y, w.z); });
  }
  /* วาดเส้น/จุด "กำลังจะเป็น" ตามเครื่องมือที่เลือกอยู่ — เรียกทุกครั้งที่เมาส์ขยับระหว่างร่างอยู่ (rubber-band
     preview) เห็นผลลัพธ์ทันทีก่อนคลิกจริง ตรงตามพฤติกรรมเครื่องมือ CAD ทั่วไป */
  function updateLiveSketchPreview(cursorUV) {
    var group = ensureLiveSketchPreviewGroup();
    clearLiveSketchPreview();
    var lineMat = new THREE.LineBasicMaterial({ color: 0x2F6FED, depthTest: false });
    var ptMat = new THREE.PointsMaterial({ color: 0xE8590C, size: 11, sizeAttenuation: false, depthTest: false });
    if (liveSketchTool === 'rect' && liveSketchPts.length === 1 && cursorUV) {
      var a = liveSketchPts[0], b = cursorUV;
      var corners = [{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: b.y }, { x: a.x, y: a.y }];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(worldPtsFromUV(corners)), lineMat));
    } else if (liveSketchTool === 'circle' && liveSketchPts.length === 1 && cursorUV) {
      var c = liveSketchPts[0], r = Math.hypot(cursorUV.x - c.x, cursorUV.y - c.y);
      var segs = 48, circlePts = [];
      for (var i = 0; i <= segs; i++) { var t = (i / segs) * Math.PI * 2; circlePts.push({ x: c.x + Math.cos(t) * r, y: c.y + Math.sin(t) * r }); }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(worldPtsFromUV(circlePts)), lineMat));
    } else if (liveSketchTool === 'polyline' && liveSketchPts.length >= 1) {
      var chain = cursorUV ? liveSketchPts.concat([cursorUV]) : liveSketchPts.slice();
      if (chain.length > 1) group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(worldPtsFromUV(chain)), lineMat));
    }
    if (liveSketchPts.length) group.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(worldPtsFromUV(liveSketchPts)), ptMat));
  }
  function updateLiveSketchHint(customMsg) {
    var el = $('c3SketchHint');
    if (!el) return;
    if (customMsg) { el.textContent = customMsg; return; }
    if (liveSketchTool === 'rect') el.textContent = liveSketchPts.length === 0 ? 'คลิกมุมแรกของสี่เหลี่ยม' : 'คลิกมุมตรงข้ามเพื่อจบรูป';
    else if (liveSketchTool === 'circle') el.textContent = liveSketchPts.length === 0 ? 'คลิกจุดศูนย์กลางวงกลม' : 'คลิกอีกจุดเพื่อกำหนดรัศมี';
    else el.textContent = liveSketchPts.length < 3
      ? ('คลิกจุดถัดไป (วางแล้ว ' + liveSketchPts.length + ' จุด, ต้องอย่างน้อย 3 จุด)')
      : ('คลิกจุดถัดไป หรือกด "เสร็จ" เพื่อปิดรูป (วางแล้ว ' + liveSketchPts.length + ' จุด)');
  }
  /* ยิง Raycaster จากตำแหน่งเมาส์ตัดกับ "ระนาบร่าง" จริง (THREE.Plane จาก origin+normal ที่ล็อกไว้ตอนเริ่ม
     ร่าง) แล้วแปลงจุดที่ตัดกันกลับเป็นพิกัด (u,v) ผ่าน unmapPlanePoint() — คืน null ถ้าเมาส์ชี้ขนานกับระนาบ
     พอดี (ไม่มีจุดตัด เช่น มองระนาบเป๊ะๆ ด้านข้าง) */
  function liveSketchRayHit(clientX, clientY) {
    var rect = renderer.domElement.getBoundingClientRect();
    var ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    var thPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(liveSketchPlaneSnapshot.normal, liveSketchPlaneSnapshot.origin);
    var hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(thPlane, hit)) return null;
    return unmapPlanePoint(liveSketchPlaneSnapshot.raw, { x: hit.x, y: hit.y, z: hit.z });
  }
  function setLiveSketchTool(tool) {
    liveSketchTool = tool;
    liveSketchPts = [];
    clearLiveSketchPreview();
    ['rect', 'circle', 'polyline'].forEach(function (t) {
      var btn = $(t === 'rect' ? 'sketchToolRectBtn' : (t === 'circle' ? 'sketchToolCircleBtn' : 'sketchToolPolylineBtn'));
      btn.classList.toggle('active', t === tool);
    });
    $('sketchFinishBtn').hidden = tool !== 'polyline';
    updateLiveSketchHint();
  }
  function commitLiveSketchProfile(profile) {
    clearLiveSketchPreview();
    liveSketchProfiles.push(profile);
    exitLiveSketch();
    refreshProfileList(); // อ่านของแบบ 2 มิติใหม่ + ต่อท้ายด้วย liveSketchProfiles แล้วเลือกตัวล่าสุด (ตัวที่เพิ่งวาดเสร็จ) ให้อัตโนมัติ
    updateAddUI();
  }
  function finishRectShape() {
    var a = liveSketchPts[0], b = liveSketchPts[1];
    var x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    var w = x1 - x0, d = y1 - y0;
    if (w < 0.5 || d < 0.5) { liveSketchPts = []; clearLiveSketchPreview(); updateLiveSketchHint('สี่เหลี่ยมเล็กเกินไป — ลองคลิกใหม่'); return; }
    commitLiveSketchProfile({ label: 'ร่างในวิว 3 มิติ: สี่เหลี่ยม ' + w.toFixed(0) + '×' + d.toFixed(0) + ' มม.', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
  }
  function finishCircleShape() {
    var c = liveSketchPts[0], p = liveSketchPts[1];
    var r = Math.hypot(p.x - c.x, p.y - c.y);
    if (r < 0.5) { liveSketchPts = []; clearLiveSketchPreview(); updateLiveSketchHint('รัศมีเล็กเกินไป — ลองคลิกใหม่'); return; }
    commitLiveSketchProfile({ label: 'ร่างในวิว 3 มิติ: วงกลม R' + r.toFixed(0) + ' มม.', circle: { cx: c.x, cy: c.y, r: r } });
  }
  function finishPolylineShape() {
    if (liveSketchTool !== 'polyline' || liveSketchPts.length < 3) { updateLiveSketchHint('ต้องมีอย่างน้อย 3 จุดจึงจะปิดเป็นรูปได้'); return; }
    commitLiveSketchProfile({ label: 'ร่างในวิว 3 มิติ: เส้นหลายจุดปิดรูป (' + liveSketchPts.length + ' จุด)', points: liveSketchPts.map(function (p) { return { x: p.x, y: p.y }; }) });
  }
  function handleLiveSketchClick(clientX, clientY) {
    var uv = liveSketchRayHit(clientX, clientY);
    if (!uv) { updateLiveSketchHint('มุมมองนี้ขนานกับระนาบร่างพอดี มองไม่เห็นจุดตัด — หมุนมุมมองแล้วลองใหม่'); return; }
    liveSketchPts.push(uv);
    if (liveSketchTool === 'rect' && liveSketchPts.length === 2) finishRectShape();
    else if (liveSketchTool === 'circle' && liveSketchPts.length === 2) finishCircleShape();
    else { updateLiveSketchHint(); updateLiveSketchPreview(uv); }
  }
  /* เริ่มร่างภาพ: ล็อกระนาบปัจจุบัน (จาก sketchPlaneSel/pickedPlaneBasis) ไว้เป็น snapshot กันสับสนถ้าผู้ใช้
     ดันไปเปลี่ยน dropdown ระนาบระหว่างที่กำลังวาดค้างอยู่ (ซึ่งเป็นไปไม่ได้อยู่แล้วเพราะซ่อนฟอร์มไว้ทั้งหมด
     ระหว่างร่าง แต่ล็อกไว้ให้ชัดเจนเผื่ออนาคต) — ปิด OrbitControls เหมือน pick-mode ของ Stage 10d */
  function enterLiveSketch() {
    if (pickMode) exitPickMode();
    if (editingIndex !== null) exitEditMode();
    shapeKindSel.value = 'sketch';
    updateDimsUI();
    var raw = activeSketchPlaneValue();
    var n = planeNormalVec(raw), o = planeOriginVec(raw);
    liveSketchPlaneSnapshot = { raw: raw, normal: new THREE.Vector3(n.x, n.y, n.z), origin: new THREE.Vector3(o.x, o.y, o.z) };
    liveSketchActive = true;
    liveSketchPts = [];
    controls.enabled = false;
    viewportEl.classList.add('c3-pick-cursor');
    $('c3SketchToolbar').hidden = false;
    setLiveSketchTool('rect');
  }
  function exitLiveSketch() {
    liveSketchActive = false;
    liveSketchPts = [];
    controls.enabled = true;
    viewportEl.classList.remove('c3-pick-cursor');
    $('c3SketchToolbar').hidden = true;
    clearLiveSketchPreview();
  }
  function onLiveSketchPointerDown(e) { if (liveSketchActive) liveSketchDownPos = { x: e.clientX, y: e.clientY }; }
  function onLiveSketchPointerUp(e) {
    if (!liveSketchActive || !liveSketchDownPos) return;
    var dx = e.clientX - liveSketchDownPos.x, dy = e.clientY - liveSketchDownPos.y;
    liveSketchDownPos = null;
    if (Math.hypot(dx, dy) > 5) return; // มือสั่น/ลากเล็กน้อย ไม่นับเป็นคลิกวางจุด
    handleLiveSketchClick(e.clientX, e.clientY);
  }
  function onLiveSketchPointerMove(e) {
    if (!liveSketchActive) return;
    var uv = liveSketchRayHit(e.clientX, e.clientY);
    if (uv) updateLiveSketchPreview(uv);
  }

  /* ══════════════════ ผูกปุ่ม + boot ══════════════════ */
  function boot() {
    loadSteps();
    initScene();
    updateDimsUI();
    updateAddUI();
    rebuildAndRender();
    rebuildPreview();

    updateSketchModeUI();
    updateAxisOptionLabels();
    shapeKindSel.addEventListener('change', function () {
      if (pickMode) exitPickMode();
      if (liveSketchActive) exitLiveSketch();
      updateDimsUI();
      if (shapeKindSel.value === 'sketch') refreshProfileList(); else rebuildPreview();
    });
    ['boxX', 'boxY', 'boxZ', 'cylR', 'cylH', 'sphR', 'sketchHeight', 'sketchAngle'].forEach(function (id) {
      $(id).addEventListener('input', rebuildPreview);
    });
    ['sketchProfileSel', 'sketchAxisSel'].forEach(function (id) { $(id).addEventListener('change', function () { rebuildPreview(); updateSketchAxisWarn(); }); });
    $('sketchModeSel').addEventListener('change', function () { updateSketchModeUI(); rebuildPreview(); });
    $('sketchPlaneSel').addEventListener('change', function () { onSketchPlaneChanged(); updateSketchAxisWarn(); });
    $('sketchReloadBtn').addEventListener('click', refreshProfileList);
    $('pickFaceBtn').addEventListener('click', function () { if (pickMode) exitPickMode(); else enterPickMode(); });
    $('c3Viewport').addEventListener('pointerdown', onViewportPointerDown);
    $('c3Viewport').addEventListener('pointerup', onViewportPointerUp);
    /* Stage 11: ปุ่มเริ่มร่างภาพตรงในวิว 3 มิติ + แถบเครื่องมือลอย + pointer handler แยกจากของ Stage 10d
       ด้านบน (คนละโหมดกัน ไม่มีทางเปิดพร้อมกันได้ — enterLiveSketch()/enterPickMode() ปิดอีกฝั่งให้เองเสมอ) */
    $('startLiveSketchBtn').addEventListener('click', enterLiveSketch);
    $('sketchToolRectBtn').addEventListener('click', function () { setLiveSketchTool('rect'); });
    $('sketchToolCircleBtn').addEventListener('click', function () { setLiveSketchTool('circle'); });
    $('sketchToolPolylineBtn').addEventListener('click', function () { setLiveSketchTool('polyline'); });
    $('sketchFinishBtn').addEventListener('click', finishPolylineShape);
    $('sketchCancelBtn').addEventListener('click', exitLiveSketch);
    $('c3Viewport').addEventListener('pointerdown', onLiveSketchPointerDown);
    $('c3Viewport').addEventListener('pointerup', onLiveSketchPointerUp);
    $('c3Viewport').addEventListener('pointermove', onLiveSketchPointerMove);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (pickMode) exitPickMode();
      if (liveSketchActive) {
        // Esc ครั้งแรก (มีจุดวางค้างอยู่) แค่ล้างรูปที่วาดค้าง — Esc อีกครั้ง (ไม่มีจุดค้างแล้ว) ถึงจะออกจากโหมดร่างทั้งหมด
        if (liveSketchPts.length) { liveSketchPts = []; clearLiveSketchPreview(); updateLiveSketchHint(); }
        else exitLiveSketch();
      }
    });
    ['posX', 'posY', 'posZ'].forEach(function (id) {
      $(id).addEventListener('input', repositionPreview);
    });
    addShapeBtn.addEventListener('click', function () {
      var f = readForm();
      if (f.kind === 'sketch' && !f.dims.profile) { alert('กรุณาเลือกเส้นขอบปิดจากแบบ 2 มิติก่อน (หรือกด "โหลดใหม่" ถ้าเพิ่งวาดเพิ่ม)'); return; }
      if (f.kind === 'sketch' && f.dims.mode === 'revolve' && revolveAxisStraddle(f.dims.profile, f.dims.axis)) {
        alert('เส้นขอบที่เลือกอยู่คร่อมแกนหมุน (มีทั้งฝั่งบวกและฝั่งลบของแกน' + f.dims.axis.toUpperCase() + ') หมุนแล้วจะซ้อนทับตัวเอง สร้างเป็นทรงตันไม่ได้ — กรุณาย้ายภาพร่างในแท็บ "ร่างภาพ 2 มิติ" ให้อยู่ฝั่งเดียวของแกนก่อน หรือเปลี่ยนแกนหมุน');
        return;
      }
      if (editingIndex !== null) {
        var old = state.steps[editingIndex];
        var op = isBaseStepIndex(editingIndex) ? 'add' : opSel.value;
        state.steps[editingIndex] = { op: op, kind: f.kind, dims: f.dims, pos: f.pos, suppressed: old.suppressed };
        editingIndex = null;
      } else {
        var hasActive = state.steps.some(function (s) { return !s.suppressed; });
        state.steps.push({ op: hasActive ? opSel.value : 'add', kind: f.kind, dims: f.dims, pos: f.pos, suppressed: false });
      }
      saveSteps(); updateAddUI(); rebuildAndRender();
    });
    $('cancelEditBtn').addEventListener('click', exitEditMode);
    $('undoStepBtn').addEventListener('click', function () {
      state.steps.pop();
      if (editingIndex !== null && editingIndex >= state.steps.length) editingIndex = null; // ขั้นตอนที่กำลังแก้ไขถูกลบไปพร้อม undo
      saveSteps(); updateAddUI(); rebuildAndRender();
    });
    $('resetBtn').addEventListener('click', async function () {
      if (!(await window.tanotConfirm('เริ่มใหม่ทั้งหมด? ขั้นตอนทั้งหมดที่สร้างไว้จะถูกลบ'))) return;
      state.steps = []; editingIndex = null; saveSteps(); updateAddUI(); rebuildAndRender();
    });
    /* Event delegation เดียวจับทั้ง 3 ปุ่มต่อแถว (แก้ไข/ลบ/ปิดใช้งานชั่วคราว) แทนการผูก listener ทีละแถว
       เพราะ updateStepsUI() re-render ทั้งลิสต์ใหม่ทุกครั้งด้วย innerHTML (ผูกทีละแถวจะหลุดทุกครั้งที่ re-render) */
    $('stepsList').addEventListener('click', async function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var idx = parseInt(btn.getAttribute('data-idx'), 10);
      var act = btn.getAttribute('data-act');
      if (act === 'edit') {
        editStep(idx);
      } else if (act === 'toggle') {
        state.steps[idx].suppressed = !state.steps[idx].suppressed;
        saveSteps(); updateAddUI(); rebuildAndRender();
      } else if (act === 'delete') {
        if (!(await window.tanotConfirm('ลบขั้นตอนที่ ' + (idx + 1) + '? (ขั้นตอนถัดไปจะต่อกันใหม่ตามลำดับที่เหลือ ผลลัพธ์อาจเปลี่ยนไปถ้าลบขั้นตอนกลางๆ)'))) return;
        state.steps.splice(idx, 1);
        if (editingIndex === idx) editingIndex = null;
        else if (editingIndex !== null && editingIndex > idx) editingIndex--;
        saveSteps(); updateAddUI(); rebuildAndRender();
      }
    });
    $('exportStepBtn').addEventListener('click', exportStep);
    $('exportStlBtn').addEventListener('click', exportStl);
    $('exportGlbBtn').addEventListener('click', exportGlb);

    /* Stage 10a: ตอนนี้อยู่ในหน้าเดียวกับ cad.html (แท็บ "มุมมอง 3 มิติ") — ระหว่างที่แท็บนี้ถูกซ่อน
       ("hidden" attribute = display:none) ค่า clientWidth/Height ของ viewport เป็น 0 ทำให้ resize()
       ตอน boot() ข้ามการตั้งขนาด renderer ไป (ดู resize() ด้านบน) พอผู้ใช้กดสลับมาแท็บนี้จริง หน้า cad.html
       จะยิง custom event นี้ให้ resize() คำนวณขนาดใหม่จากขนาดจริงของ viewport ที่เพิ่งโผล่ */
    window.addEventListener('cad3d:tabshown', resize);

    /* ปุ่มลัด "⚡ ยืดเป็น 3 มิติ" ที่แท็บ 2D ยิงมา (ผ่าน cad.html หลังสลับแท็บให้แล้ว) — ตั้งชนิดเป็น
       "จากภาพร่าง 2 มิติ" รีเซ็ตระนาบ/โหมดกลับเป็นค่าเริ่มต้น (ระนาบบน + อัดขึ้นตรง เผื่อค้างค่าจากรอบก่อน)
       เลือกภาพร่างล่าสุดให้อัตโนมัติ (refreshProfileList() จัดการให้) แล้วกด "วางเป็นชิ้นงานหลัก"/"รวมเข้ากับ
       ชิ้นงานหลัก" ให้เองทันที เหมือนผู้ใช้กดปุ่มนั้นเอง (reuse โค้ด validation/commit เดิมทั้งหมด ไม่ต้อง
       เขียนตรรกะซ้ำ) — ถ้าไม่มีภาพร่างปิดให้ใช้เลย จะเตือนแทนการเพิ่มรูปทรงว่างเปล่า */
    window.addEventListener('cad3d:quickextrude', function () {
      if (editingIndex !== null) exitEditMode();
      if (pickMode) exitPickMode();
      if (liveSketchActive) exitLiveSketch();
      shapeKindSel.value = 'sketch';
      updateDimsUI();
      $('sketchPlaneSel').value = 'top';
      $('sketchModeSel').value = 'extrude';
      onSketchPlaneChanged();
      refreshProfileList();
      updateAddUI();
      if (loadedProfiles.length) {
        addShapeBtn.click();
      } else {
        alert('ยังไม่พบเส้นขอบปิดที่วาดไว้ — วาดสี่เหลี่ยม/วงกลม/พอลีไลน์ปิดในแท็บ "ร่างภาพ 2 มิติ" ก่อน แล้วลองกด "⚡ ยืดเป็น 3 มิติ" อีกครั้ง');
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
