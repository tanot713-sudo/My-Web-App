/* ══════════════════════════════════════════════════════════════════
   จำลองสิ่งของ 3D — จัดผัง/วางเฟอร์นิเจอร์+อุปกรณ์ก่อสร้าง
   + นำเข้าโมเดลที่สแกนจากของจริง (.glb/.gltf/.obj/.ply/.stl) มาปรับขนาด/
   ตัด-เจาะ-รวม/ลดโพลีกอน แล้ว export กลับไปใช้ในเกมหรือพิมพ์ 3D ได้

   สถาปัตยกรรม: ทุกวัตถุที่วางในฉาก (ทั้งที่สร้างจากทรงพื้นฐานในโค้ด และที่
   นำเข้าจากไฟล์) แทนด้วย record เดียวกันใน `placed[]` — group เดียวที่มี
   origin ท้องถิ่นอยู่ที่ "กึ่งกลาง X/Z, พื้นอยู่ Y=0" เสมอ ทำให้ nudge/หมุน/
   ปรับขนาดใช้โค้ดชุดเดียวกันได้ไม่ว่าวัตถุจะมาจากไหน

   โมเดลที่อัปโหลดเก็บไฟล์จริง (ArrayBuffer) ไว้ใน IndexedDB (คลังโมเดลของฉัน)
   ส่วน localStorage เก็บแค่ตำแหน่ง/สเกล/อ้างอิง modelId ของสิ่งที่วางในผัง
   (ไฟล์โมเดลอาจใหญ่หลาย MB เกินโควตา localStorage ~5-10MB)
   ══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';

(function () {
  'use strict';


  /* ══════════════════ ภาษา UI (ไทย/อังกฤษ) — เฉพาะกรอบ UI; ฉาก 3D/เรขาคณิต/ชื่อโมเดลที่ผู้ใช้อัปโหลดไม่แปล ══════════════════ */
  var T = OME_I18N.scope('sim', {
    th: {
      title: "จำลองสิ่งของ 3D",
      pageTitle: "จำลองสิ่งของ 3D — จัดผัง/วางอุปกรณ์ | Tanot",
      vPersp: "มุม 3D",
      vTop: "บนลงล่าง",
      vFront: "ด้านหน้า",
      vSide: "ด้านข้าง",
      snap: "Snap 0.5 ม.",
      shot: "บันทึกภาพ",
      clear: "ล้างทั้งหมด",
      panel: "แผงควบคุม",
      close: "ปิด",
      xform: "ลากปรับ",
      mMove: "ย้าย",
      mRotate: "หมุน",
      mScale: "สเกล",
      csg: "ตัด/รวม 2 ชิ้น",
      csgCancel: "ยกเลิกโหมด",
      exportAll: "รวม .stl ทั้งผัง",
      loading: "กำลังโหลด 3D…",
      selected: "วัตถุที่เลือก",
      library: "คลังของสำเร็จรูป",
      myModels: "โมเดลของฉัน",
      confirm: "ยืนยัน",
      alert: "แจ้งเตือน",
      cancel: "ยกเลิก",
      ok: "ตกลง",
      g_structure: "โครงสร้าง",
      g_furniture: "เฟอร์นิเจอร์",
      g_site: "ไซต์งาน",
      o_wall: "ผนัง",
      o_door: "ประตู",
      o_window: "หน้าต่าง",
      o_column: "เสา",
      o_table: "โต๊ะ",
      o_chair: "เก้าอี้",
      o_sofa: "โซฟา",
      o_cabinet: "ตู้",
      o_bed: "เตียง",
      o_cone: "กรวยจราจร",
      o_barrel: "ถังเก็บของ",
      o_crate: "ลัง/พาเลท",
      o_ladder: "บันได",
      o_sign: "ป้ายเตือน",
      o_scaffold: "นั่งร้าน",
      imported: "โมเดลที่นำเข้า",
      csgUnion: "รวมชิ้น",
      csgCut: "ตัดชิ้น",
      del: "ลบ",
      position: "ตำแหน่ง",
      nLeft: "ขยับซ้าย",
      nRight: "ขยับขวา",
      nIn: "ขยับเข้า",
      nOut: "ขยับออก",
      rot90: "หมุน 90°",
      rLeft: "หมุนซ้าย",
      rRight: "หมุนขวา",
      color: "สี",
      colorOf: "สี {c}",
      curSize: "ขนาดปัจจุบัน",
      sizeFmt: "{x} × {z} × {y} ซม. (ก×ล×ส)",
      resize: "ปรับขนาด",
      axisY: "สูง",
      axisX: "กว้าง",
      axisZ: "ลึก",
      cm: "ซม.",
      apply: "ปรับ",
      resetSize: "รีเซ็ตขนาดเดิม",
      simplify: "ลดความละเอียด",
      tris: "{n} เหลี่ยม",
      multiPart: "โมเดลนี้มีหลายชิ้นส่วนภายใน — ลดความละเอียด/ตัด-รวมใช้ไม่ได้กับไฟล์นี้ (ขยับ/หมุน/ปรับขนาด/ดาวน์โหลดยังใช้ได้)",
      download: "ดาวน์โหลด",
      eSize: "กรอกตัวเลขขนาดเป็นเซนติเมตรที่มากกว่า 0",
      eSimplify: "ลดความละเอียดไม่สำเร็จสำหรับโมเดลนี้: {m}",
      eGlb: "ส่งออก .glb ไม่สำเร็จ: {m}",
      eEmpty: "ยังไม่มีวัตถุในผัง",
      eMerge: "รวมไฟล์ไม่สำเร็จ: {m}",
      noModels: "ยังไม่มีโมเดลที่อัปโหลด",
      upload: "อัปโหลดโมเดล",
      delModelLabel: "ลบโมเดล {n}",
      delModelConfirm: "ลบโมเดลนี้ออกจากคลัง? (วัตถุที่วางในผังจากโมเดลนี้ไปแล้วจะไม่หายไป)",
      loadingModel: "กำลังโหลดโมเดล… ไฟล์ใหญ่หรือ .fbx อาจใช้เวลาสักครู่",
      noModel: "ไม่พบโมเดลนี้แล้ว",
      eLoadModel: "โหลดโมเดลไม่สำเร็จ: {m}",
      eExt: "รองรับเฉพาะไฟล์ .glb .gltf .obj .ply .stl .fbx",
      reading: "กำลังอ่านไฟล์ {f} …",
      converting: "กำลังแปลงโมเดล 3D… ไฟล์ใหญ่หรือ .fbx อาจใช้เวลาหลายวินาที หน้าจออาจไม่ตอบสนองชั่วขณะ (ไม่ได้ค้าง รอสักครู่)",
      eRead: "อ่านไฟล์โมเดลไม่สำเร็จ (ไฟล์อาจเสียหรือฟอร์แมตไม่ตรง): {m}",
      csgNeed2: "ต้องมีวัตถุอย่างน้อย 2 ชิ้นในผังก่อน",
      csgPickBase: "คลิกวัตถุ \"ฐาน\" ในภาพ (จะถูกแทนที่ด้วยผลลัพธ์)",
      csgPickTool: "คลิกวัตถุที่ 2 ที่จะใช้ตัด/รวม (จะถูกใช้แล้วลบทิ้ง)",
      csgTitle: "เลือกวิธีรวมวัตถุ",
      csgMsg: "จะลบส่วนที่ทับซ้อนออกจากฐาน (ตัด/เจาะรู) หรือรวมสองชิ้นเป็นก้อนเดียว (union)?",
      csgUnionBtn: "รวมเป็นก้อนเดียว",
      csgSubBtn: "ลบส่วนที่ทับซ้อน (ตัด)",
      csgMulti: "วัตถุที่เลือกมีหลายชิ้นส่วนภายใน ไม่รองรับการตัด/รวม",
      eCsg: "ตัด/รวมไม่สำเร็จ: {m}",
      clearConfirm: "ล้างวัตถุทั้งหมดในผังนี้?",
      saved: "บันทึกแล้ว",
      noIdb: "เบราว์เซอร์นี้ไม่รองรับ IndexedDB",
      noWebgl: "เบราว์เซอร์นี้ไม่รองรับ WebGL — ลองเปิดด้วยเบราว์เซอร์อื่นหรืออัปเดตเบราว์เซอร์",
      eFormat: "รูปแบบไฟล์ไม่รองรับ"
    },
    en: {
      title: "3D object simulator",
      pageTitle: "3D object simulator — layout & equipment | Tanot",
      vPersp: "3D view",
      vTop: "Top",
      vFront: "Front",
      vSide: "Side",
      snap: "Snap 0.5 m",
      shot: "Save image",
      clear: "Clear all",
      panel: "Controls",
      close: "Close",
      xform: "Drag to edit",
      mMove: "Move",
      mRotate: "Rotate",
      mScale: "Scale",
      csg: "Cut / merge 2 objects",
      csgCancel: "Cancel mode",
      exportAll: "Export all as .stl",
      loading: "Loading 3D…",
      selected: "Selected object",
      library: "Ready-made library",
      myModels: "My models",
      confirm: "Confirm",
      alert: "Notice",
      cancel: "Cancel",
      ok: "OK",
      g_structure: "Structure",
      g_furniture: "Furniture",
      g_site: "Site",
      o_wall: "Wall",
      o_door: "Door",
      o_window: "Window",
      o_column: "Column",
      o_table: "Table",
      o_chair: "Chair",
      o_sofa: "Sofa",
      o_cabinet: "Cabinet",
      o_bed: "Bed",
      o_cone: "Traffic cone",
      o_barrel: "Storage bin",
      o_crate: "Crate / pallet",
      o_ladder: "Ladder",
      o_sign: "Warning sign",
      o_scaffold: "Scaffolding",
      imported: "Imported model",
      csgUnion: "Merged piece",
      csgCut: "Cut piece",
      del: "Delete",
      position: "Position",
      nLeft: "Move left",
      nRight: "Move right",
      nIn: "Move back",
      nOut: "Move forward",
      rot90: "Rotate 90°",
      rLeft: "Rotate left",
      rRight: "Rotate right",
      color: "Colour",
      colorOf: "Colour {c}",
      curSize: "Current size",
      sizeFmt: "{x} × {z} × {y} cm (W×D×H)",
      resize: "Resize",
      axisY: "Height",
      axisX: "Width",
      axisZ: "Depth",
      cm: "cm",
      apply: "Apply",
      resetSize: "Reset to original size",
      simplify: "Reduce detail",
      tris: "{n} triangles",
      multiPart: "This model has several inner parts — reduce detail and cut/merge are not available for it (move, rotate, resize and download still work)",
      download: "Download",
      eSize: "Enter a size in centimetres greater than 0",
      eSimplify: "Could not reduce the detail of this model: {m}",
      eGlb: "Could not export .glb: {m}",
      eEmpty: "There are no objects in the layout yet",
      eMerge: "Could not merge the files: {m}",
      noModels: "No uploaded models yet",
      upload: "Upload model",
      delModelLabel: "Delete model {n}",
      delModelConfirm: "Remove this model from the library? (Objects already placed from it stay in the layout)",
      loadingModel: "Loading the model… large files or .fbx may take a moment",
      noModel: "This model no longer exists",
      eLoadModel: "Could not load the model: {m}",
      eExt: "Only .glb .gltf .obj .ply .stl .fbx files are supported",
      reading: "Reading file {f} …",
      converting: "Converting the 3D model… large files or .fbx can take several seconds and the page may pause briefly (it has not frozen, please wait)",
      eRead: "Could not read the model file (it may be damaged or in the wrong format): {m}",
      csgNeed2: "Place at least 2 objects in the layout first",
      csgPickBase: "Click the \"base\" object in the view (it will be replaced by the result)",
      csgPickTool: "Click the 2nd object to cut/merge with (it will be used up and removed)",
      csgTitle: "Choose how to combine",
      csgMsg: "Remove the overlapping part from the base (cut / hole) or merge the two pieces into one (union)?",
      csgUnionBtn: "Merge into one",
      csgSubBtn: "Remove overlap (cut)",
      csgMulti: "The selected object has several inner parts, so cut/merge is not supported",
      eCsg: "Cut/merge failed: {m}",
      clearConfirm: "Clear every object in this layout?",
      saved: "Saved",
      noIdb: "This browser does not support IndexedDB",
      noWebgl: "This browser does not support WebGL — try another browser or update this one",
      eFormat: "Unsupported file format"
    }
  });
  window.OME_PAGE_LIVE_LANG = true;
  var GROUP_KEY = { 'โครงสร้าง': 'g_structure', 'เฟอร์นิเจอร์': 'g_furniture', 'ไซต์งาน': 'g_site' };
  var DEF_KEY = { wall: 'o_wall', door: 'o_door', window: 'o_window', column: 'o_column', table: 'o_table', chair: 'o_chair', sofa: 'o_sofa', cabinet: 'o_cabinet', bed: 'o_bed',
    cone: 'o_cone', barrel: 'o_barrel', crate: 'o_crate', ladder: 'o_ladder', sign: 'o_sign', scaffold: 'o_scaffold' };
  function defLabel(d) { return T(DEF_KEY[d.key] || ('o_' + d.key)) || d.label; }
  function groupLabel(g) { return T(GROUP_KEY[g]) || g; }
  var SCENE_BG = 0xE7ECF4; /* พื้นฉาก 3D — ไม่ผูกกับธีม (ส่งไปที่ CSS ผ่าน --s3-scene-bg) */
  var STORAGE_KEY = 'tanot:sim3d:objects';
  var SNAP = 0.5;
  var UPLOAD_EXTS = ['glb', 'gltf', 'obj', 'ply', 'stl', 'fbx'];

  /* ══════════════════ IndexedDB — คลังโมเดลของฉัน (เก็บไฟล์จริง) ══════════════════ */
  var DB_NAME = 'tanot-sim3d', DB_STORE = 'models', DB_VERSION = 1;
  function dbOpen() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error(T('noIdb'))); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function dbAddModel(rec) {
    return dbOpen().then(function (db) { return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, 'readwrite');
      var req = tx.objectStore(DB_STORE).add(rec);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    }); });
  }
  function dbListModels() {
    return dbOpen().then(function (db) { return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, 'readonly');
      var req = tx.objectStore(DB_STORE).getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    }); });
  }
  function dbGetModel(id) {
    return dbOpen().then(function (db) { return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, 'readonly');
      var req = tx.objectStore(DB_STORE).get(id);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error); };
    }); });
  }
  function dbDeleteModel(id) {
    return dbOpen().then(function (db) { return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, 'readwrite');
      var req = tx.objectStore(DB_STORE).delete(id);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    }); });
  }

  /* ══════════════════ คลังวัตถุจากทรงพื้นฐาน (เดิม) ══════════════════ */
  var OBJECT_DEFS = [
    { key: 'wall', label: 'ผนัง', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-brick-wall"/></svg>', group: 'โครงสร้าง', color: 0xE0DDD3, build: function (c) {
        var g = new THREE.Group();
        var m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 0.15), new THREE.MeshStandardMaterial({ color: c }));
        m.position.y = 1.2; g.add(m); return g;
      } },
    { key: 'door', label: 'ประตู', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-door-open"/></svg>', group: 'โครงสร้าง', color: 0x8B5E3C, build: function (c) {
        var g = new THREE.Group();
        var m = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.1, 0.06), new THREE.MeshStandardMaterial({ color: c }));
        m.position.y = 1.05; g.add(m); return g;
      } },
    { key: 'window', label: 'หน้าต่าง', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-app-window"/></svg>', group: 'โครงสร้าง', color: 0x9FD8E8, build: function (c) {
        var g = new THREE.Group();
        var frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, 0.08), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
        frame.position.y = 1.5; g.add(frame);
        var glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.05), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.55 }));
        glass.position.set(0, 1.5, 0.01); g.add(glass);
        return g;
      } },
    { key: 'column', label: 'เสา', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-rectangle-vertical"/></svg>', group: 'โครงสร้าง', color: 0xC9C4B8, build: function (c) {
        var g = new THREE.Group();
        var m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.7, 16), new THREE.MeshStandardMaterial({ color: c }));
        m.position.y = 1.35; g.add(m); return g;
      } },
    { key: 'table', label: 'โต๊ะ', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-table-2"/></svg>', group: 'เฟอร์นิเจอร์', color: 0xB78C56, build: function (c) {
        var g = new THREE.Group();
        var top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.7), new THREE.MeshStandardMaterial({ color: c }));
        top.position.y = 0.75; g.add(top);
        var legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8);
        var legMat = new THREE.MeshStandardMaterial({ color: 0x3A2C1E });
        [[0.53, 0.31], [-0.53, 0.31], [0.53, -0.31], [-0.53, -0.31]].forEach(function (p) {
          var leg = new THREE.Mesh(legGeo, legMat); leg.position.set(p[0], 0.36, p[1]); g.add(leg);
        });
        return g;
      } },
    { key: 'chair', label: 'เก้าอี้', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-armchair"/></svg>', group: 'เฟอร์นิเจอร์', color: 0x6B7A8F, build: function (c) {
        var g = new THREE.Group();
        var seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.45), new THREE.MeshStandardMaterial({ color: c }));
        seat.position.y = 0.46; g.add(seat);
        var back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.05), new THREE.MeshStandardMaterial({ color: c }));
        back.position.set(0, 0.71, -0.2); g.add(back);
        var legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.46, 8);
        var legMat = new THREE.MeshStandardMaterial({ color: 0x2C2C2C });
        [[0.19, 0.19], [-0.19, 0.19], [0.19, -0.19], [-0.19, -0.19]].forEach(function (p) {
          var leg = new THREE.Mesh(legGeo, legMat); leg.position.set(p[0], 0.23, p[1]); g.add(leg);
        });
        return g;
      } },
    { key: 'sofa', label: 'โซฟา', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-sofa"/></svg>', group: 'เฟอร์นิเจอร์', color: 0x7C5C4A, build: function (c) {
        var g = new THREE.Group();
        var mat = new THREE.MeshStandardMaterial({ color: c });
        var base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.85), mat);
        base.position.y = 0.22; g.add(base);
        var back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.2), mat);
        back.position.set(0, 0.55, -0.33); g.add(back);
        var armGeo = new THREE.BoxGeometry(0.2, 0.45, 0.85);
        var arm1 = new THREE.Mesh(armGeo, mat); arm1.position.set(0.8, 0.42, 0); g.add(arm1);
        var arm2 = new THREE.Mesh(armGeo, mat); arm2.position.set(-0.8, 0.42, 0); g.add(arm2);
        return g;
      } },
    { key: 'cabinet', label: 'ตู้', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-archive"/></svg>', group: 'เฟอร์นิเจอร์', color: 0x9C7A4E, build: function (c) {
        var g = new THREE.Group();
        var body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.5), new THREE.MeshStandardMaterial({ color: c }));
        body.position.y = 0.9; g.add(body); return g;
      } },
    { key: 'bed', label: 'เตียง', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-bed"/></svg>', group: 'เฟอร์นิเจอร์', color: 0xD8C8B0, build: function (c) {
        var g = new THREE.Group();
        var frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 2.0), new THREE.MeshStandardMaterial({ color: 0x6B4A30 }));
        frame.position.y = 0.18; g.add(frame);
        var mattress = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.25, 1.95), new THREE.MeshStandardMaterial({ color: c }));
        mattress.position.y = 0.45; g.add(mattress);
        var pillow = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
        pillow.position.set(0, 0.62, -0.75); g.add(pillow);
        return g;
      } },
    { key: 'cone', label: 'กรวยจราจร', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-triangle"/></svg>', group: 'ไซต์งาน', color: 0xFF6B1A, build: function (c) {
        var g = new THREE.Group();
        var m = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 20), new THREE.MeshStandardMaterial({ color: c }));
        m.position.y = 0.27; g.add(m); return g;
      } },
    { key: 'barrel', label: 'ถังเก็บของ', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-cylinder"/></svg>', group: 'ไซต์งาน', color: 0x2E6DB4, build: function (c) {
        var g = new THREE.Group();
        var m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 20), new THREE.MeshStandardMaterial({ color: c }));
        m.position.y = 0.45; g.add(m); return g;
      } },
    { key: 'crate', label: 'ลัง/พาเลท', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-package"/></svg>', group: 'ไซต์งาน', color: 0xB08654, build: function (c) {
        var g = new THREE.Group();
        var m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 1.2), new THREE.MeshStandardMaterial({ color: c }));
        m.position.y = 0.08; g.add(m); return g;
      } },
    { key: 'ladder', label: 'บันได', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-chevrons-up"/></svg>', group: 'ไซต์งาน', color: 0xC9A227, build: function (c) {
        var g = new THREE.Group();
        var mat = new THREE.MeshStandardMaterial({ color: c });
        var railGeo = new THREE.BoxGeometry(0.06, 2.2, 0.06);
        var r1 = new THREE.Mesh(railGeo, mat); r1.position.set(0.25, 1.1, 0); g.add(r1);
        var r2 = new THREE.Mesh(railGeo, mat); r2.position.set(-0.25, 1.1, 0); g.add(r2);
        var rungGeo = new THREE.BoxGeometry(0.5, 0.04, 0.04);
        for (var i = 0; i < 7; i++) {
          var rung = new THREE.Mesh(rungGeo, mat); rung.position.set(0, 0.25 + i * 0.3, 0); g.add(rung);
        }
        return g;
      } },
    { key: 'sign', label: 'ป้ายเตือน', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-triangle-alert"/></svg>', group: 'ไซต์งาน', color: 0xF5C518, build: function (c) {
        var g = new THREE.Group();
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x555555 }));
        pole.position.y = 0.7; g.add(pole);
        var board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.03), new THREE.MeshStandardMaterial({ color: c }));
        board.position.y = 1.3; g.add(board);
        return g;
      } },
    { key: 'scaffold', label: 'นั่งร้าน', icon: '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-construction"/></svg>', group: 'ไซต์งาน', color: 0x8A8F99, build: function (c) {
        var g = new THREE.Group();
        var mat = new THREE.MeshStandardMaterial({ color: c });
        var postGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.0, 8);
        [[0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]].forEach(function (p) {
          var post = new THREE.Mesh(postGeo, mat); post.position.set(p[0], 1.0, p[1]); g.add(post);
        });
        var barGeoX = new THREE.BoxGeometry(1.0, 0.04, 0.04);
        var barGeoZ = new THREE.BoxGeometry(0.04, 0.04, 1.0);
        [0.5, 1.5].forEach(function (y) {
          var b1 = new THREE.Mesh(barGeoX, mat); b1.position.set(0, y, 0.5); g.add(b1);
          var b2 = new THREE.Mesh(barGeoX, mat); b2.position.set(0, y, -0.5); g.add(b2);
          var b3 = new THREE.Mesh(barGeoZ, mat); b3.position.set(0.5, y, 0); g.add(b3);
          var b4 = new THREE.Mesh(barGeoZ, mat); b4.position.set(-0.5, y, 0); g.add(b4);
        });
        return g;
      } }
  ];
  function defByKey(key) {
    for (var i = 0; i < OBJECT_DEFS.length; i++) if (OBJECT_DEFS[i].key === key) return OBJECT_DEFS[i];
    return null;
  }

  var PRESETS = {
    persp: { pos: [6, 6, 8], target: [0, 0.5, 0] },
    top: { pos: [0.001, 14, 0.001], target: [0, 0, 0] },
    front: { pos: [0, 2.2, 10], target: [0, 1, 0] },
    side: { pos: [10, 2.2, 0], target: [0, 1, 0] }
  };
  var COLOR_CHOICES = ['#12A594', '#E5484D', '#F5A524', '#3B9BEA', '#6C63D9', '#B08654', '#8A8F99', '#EC5E8A'];

  var scene, camera, renderer, controls, xform, viewportEl;
  var raycaster = new THREE.Raycaster();
  var placed = [];
  var myModels = []; // cache รายชื่อจาก IndexedDB (ไม่รวมไฟล์จริง กันหน่วยความจำบวม)
  var selectedId = null;
  var selHelper = null;
  var idSeq = 1;
  var stageCount = 0;
  var snapEnabled = true;
  var saveTimer = null;
  var xformOn = false;
  var csgMode = null; // null | 'pick-base' | 'pick-tool'
  var csgBaseId = null;
  var csgLoaded = false;

  function $(id) { return document.getElementById(id); }

  /* ══════════════════ กล่องยืนยัน/แจ้งเตือนของเว็บเอง (แทน confirm()/alert()) ══════════════════ */
  function showModal(opts) {
    return new Promise(function (resolve) {
      var dlg = $('s3Modal');
      $('s3ModalTitle').textContent = opts.title || '';
      $('s3ModalMsg').textContent = opts.message || '';
      var btnsEl = $('s3ModalBtns');
      btnsEl.innerHTML = '';
      var done = false;
      var cancelVal = opts.cancelValue !== undefined ? opts.cancelValue : null;
      function close(val) {
        if (done) return;
        done = true;
        dlg.onclose = null;
        dlg.onclick = null;
        if (dlg.open) dlg.close();
        resolve(val);
      }
      (opts.buttons || []).forEach(function (b) {
        var btn = document.createElement('button');
        btn.className = 'btn' + (b.primary ? ' primary' : '');
        btn.type = 'button';
        btn.textContent = b.label;
        btn.addEventListener('click', function () { close(b.value); });
        btnsEl.appendChild(btn);
      });
      dlg.onclick = function (e) { if (e.target === dlg) close(cancelVal); };   /* กดนอกกล่อง = ยกเลิก */
      dlg.onclose = function () { close(cancelVal); };                          /* Esc */
      dlg.showModal();
    });
  }
  function s3Confirm(message, title) {
    return showModal({
      title: title || T('confirm'),
      message: message,
      cancelValue: false,
      buttons: [
        { label: T('cancel'), value: false },
        { label: T('ok'), value: true, primary: true }
      ]
    }).then(function (v) { return v === true; });
  }
  function s3Alert(message, title) {
    return showModal({
      title: title || T('alert'),
      message: message,
      cancelValue: true,
      buttons: [{ label: T('ok'), value: true, primary: true }]
    }).then(function () {});
  }

  /* ══════════════════ ตั้งฉาก 3D ══════════════════ */
  function init() {
    viewportEl = $('s3Viewport');
    try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(SCENE_BG);
      viewportEl.style.setProperty('--s3-scene-bg', hexStr(SCENE_BG));
      scene.environment = new RoomEnvironment().texture || null;

      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(PRESETS.persp.pos[0], PRESETS.persp.pos[1], PRESETS.persp.pos[2]);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      viewportEl.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('data-doc-area', '');

      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(PRESETS.persp.target[0], PRESETS.persp.target[1], PRESETS.persp.target[2]);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.minDistance = 2;
      controls.maxDistance = 40;

      xform = new TransformControls(camera, renderer.domElement);
      xform.setSize(0.9);
      xform.visible = false;
      xform.enabled = false;
      xform.addEventListener('dragging-changed', function (e) { controls.enabled = !e.value; });
      xform.addEventListener('objectChange', onXformChange);
      scene.add(xform.getHelper ? xform.getHelper() : xform);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 0.9));
      var dir = new THREE.DirectionalLight(0xffffff, 1.3);
      dir.position.set(6, 10, 4);
      scene.add(dir);

      var floor = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ color: 0xF4F2EA })
      );
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);
      scene.add(new THREE.GridHelper(40, 80, 0xB8BEC9, 0xDADEE6));

      resize();
      window.addEventListener('resize', resize);
      bindPointer();

      var loadingEl = $('s3Loading');
      if (loadingEl) loadingEl.remove();

      bindToolbar();
      bindDrawer();
      refreshMyModelsCatalog();
      loadFromStorage().then(function () {
        buildProcCatalog();
      });
      animate();
      setupAR();
    } catch (e) {
      viewportEl.innerHTML = '<div class="s3-loading"></div>';
      viewportEl.firstChild.textContent = T('noWebgl');
      OME_I18N.live(viewportEl.firstChild, function () { return T('noWebgl'); });
    }
  }

  function resize() {
    if (!viewportEl || !renderer) return;
    var w = viewportEl.clientWidth, h = viewportEl.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function animate() {
    renderer.setAnimationLoop(function () {
      controls.update();
      renderer.render(scene, camera);
    });
  }

  /* ── เลือกวัตถุด้วยคลิก/แตะ แยกจากการลาก orbit กล้องด้วยระยะขยับ ── */
  function bindPointer() {
    var downPos = null;
    renderer.domElement.addEventListener('pointerdown', function (e) {
      downPos = { x: e.clientX, y: e.clientY };
    });
    renderer.domElement.addEventListener('pointerup', function (e) {
      if (!downPos) return;
      var dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
      downPos = null;
      if (Math.sqrt(dx * dx + dy * dy) > 6) return;
      handleClick(e);
    });
  }

  function handleClick(e) {
    var rect = renderer.domElement.getBoundingClientRect();
    var mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    var meshes = placed.map(function (r) { return r.group; });
    var hits = raycaster.intersectObjects(meshes, true);
    var hitId = null;
    if (hits.length) {
      var obj = hits[0].object;
      while (obj && obj.userData.simId == null) obj = obj.parent;
      hitId = obj ? obj.userData.simId : null;
    }
    if (csgMode) { handleCsgPick(hitId); return; }
    select(hitId);
  }

  /* ══════════════════ แปลงไฟล์ที่อัปโหลดเป็น Object3D ══════════════════ */
  function parseModelFile(ext, arrayBuffer) {
    if (ext === 'glb' || ext === 'gltf') {
      return new Promise(function (resolve, reject) {
        new GLTFLoader().parse(arrayBuffer, '', function (gltf) { resolve(gltf.scene); }, reject);
      });
    }
    if (ext === 'obj') {
      var text = new TextDecoder().decode(arrayBuffer);
      return Promise.resolve(new OBJLoader().parse(text));
    }
    if (ext === 'ply') {
      var geo = new PLYLoader().parse(arrayBuffer);
      geo.computeVertexNormals();
      var hasColor = !!geo.getAttribute('color');
      return Promise.resolve(new THREE.Mesh(geo, new THREE.MeshStandardMaterial(hasColor ? { vertexColors: true } : { color: 0x9C9C9C })));
    }
    if (ext === 'stl') {
      var geo2 = new STLLoader().parse(arrayBuffer);
      geo2.computeVertexNormals();
      return Promise.resolve(new THREE.Mesh(geo2, new THREE.MeshStandardMaterial({ color: 0x9C9C9C })));
    }
    if (ext === 'fbx') {
      // หมายเหตุ: ไม่ auto-scale ตาม GlobalSettings.UnitScaleFactor เพราะโปรแกรม/แอปสแกนหลายตัว
      // ไม่กรอกค่านี้ตรงกับหน่วยจริงของเนื้อโมเดล (ทำให้ไฟล์ที่ขนาดถูกต้องอยู่แล้วเพี้ยนไปแทน)
      // ให้ถือว่า 1 หน่วย = 1 เมตรเหมือนฟอร์แมตอื่น แล้วใช้ช่อง "ปรับขนาด" ตั้งขนาดจริงเอาเองแทน
      return Promise.resolve(new FBXLoader().parse(arrayBuffer, ''));
    }
    return Promise.reject(new Error(T('eFormat')));
  }

  /* รวมทุก mesh ในไฟล์ที่โหลดมาเป็นชิ้นเดียว (ทำให้ปรับขนาด/ลดโพลีกอน/ตัด-รวม
     ใช้โค้ดชุดเดียวกันได้ทั้งเว็บ ไม่ต้องแยก branch ตามจำนวนชิ้นส่วนภายใน)
     ถ้ารวมไม่ได้ (attribute ไม่ตรงกันข้ามชิ้น) คืน null แล้วผู้เรียกจะ fallback
     ไปใช้ต้นฉบับทั้งกลุ่มแทน (ยังขยับ/หมุน/สเกล/export ได้ปกติ แค่ลดโพลีกอน/
     ตัด-รวมไม่ได้เพราะต้องการเรขาคณิตชิ้นเดียว) */
  function mergeToSingleMesh(root) {
    try {
      var geometries = [];
      var firstMaterial = null;
      root.updateWorldMatrix(true, true);
      root.traverse(function (o) {
        if (o.isMesh && o.geometry) {
          var g = o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          if (!g.getAttribute('normal')) g.computeVertexNormals();
          if (!g.index) g.index = null; // ให้ mergeGeometries เห็นสถานะ index ตรงกันตามจริง
          geometries.push(g);
          if (!firstMaterial && o.material) firstMaterial = Array.isArray(o.material) ? o.material[0] : o.material;
        }
      });
      if (!geometries.length) return null;
      var merged = geometries.length === 1 ? geometries[0] : BufferGeometryUtils.mergeGeometries(geometries, false);
      if (!merged) return null;
      var mat = firstMaterial || new THREE.MeshStandardMaterial({ color: 0x9C9C9C });
      return new THREE.Mesh(merged, mat);
    } catch (e) {
      return null;
    }
  }

  function computeBaseSize(obj) {
    var box = new THREE.Box3().setFromObject(obj);
    var size = new THREE.Vector3();
    box.getSize(size);
    return { x: size.x || 0.01, y: size.y || 0.01, z: size.z || 0.01 };
  }

  function groundAndCenter(obj) {
    var box = new THREE.Box3().setFromObject(obj);
    var center = new THREE.Vector3();
    box.getCenter(center);
    obj.position.x -= center.x;
    obj.position.z -= center.z;
    obj.position.y -= box.min.y;
  }

  /* ══════════════════ วางวัตถุลงฉาก (ทางเข้าเดียวสำหรับทุกชนิด) ══════════════════ */
  function addProcObject(key, x, z, rotY, color, scale, skipSave) {
    var def = defByKey(key);
    if (!def) return null;
    var col = (color != null) ? color : def.color;
    var group = def.build(col);
    return finalizePlace({ type: 'proc', key: key, color: col }, group, x, z, rotY, scale, skipSave);
  }

  function addModelObject(modelRec, x, z, rotY, scale, skipSave, preParsedObj) {
    var p = preParsedObj ? Promise.resolve(preParsedObj) : parseModelFile(modelRec.format, modelRec.arrayBuffer);
    return p.then(function (obj) {
      groundAndCenter(obj);
      var merged = mergeToSingleMesh(obj);
      var finalObj = merged || obj;
      if (merged) groundAndCenter(finalObj); // merge อาจขยับกึ่งกลาง/พื้นเพี้ยนไปนิดหน่อยจากการ bake matrix รอบสอง
      return finalizePlace({ type: 'model', modelId: modelRec.id, name: modelRec.name, format: modelRec.format, mergedOk: !!merged }, finalObj, x, z, rotY, scale, skipSave);
    });
  }

  function finalizePlace(meta, group, x, z, rotY, scale, skipSave) {
    var baseSize = computeBaseSize(group);
    if (snapEnabled) { x = Math.round(x / SNAP) * SNAP; z = Math.round(z / SNAP) * SNAP; }
    group.position.x = x;
    group.position.z = z;
    group.rotation.y = rotY || 0;
    var s = (scale && scale > 0) ? scale : 1;
    group.scale.setScalar(s);
    var id = 'o' + (idSeq++);
    group.userData.simId = id;
    scene.add(group);
    var rec = {
      id: id, group: group, x: x, z: z, rotY: rotY || 0, scale: s, baseSize: baseSize,
      type: meta.type, key: meta.key, color: meta.color,
      modelId: meta.modelId, name: meta.name, nameKey: meta.nameKey, format: meta.format, mergedOk: meta.mergedOk
    };
    placed.push(rec);
    select(id);
    if (!skipSave) scheduleSave();
    return id;
  }

  function findRec(id) {
    for (var i = 0; i < placed.length; i++) if (placed[i].id === id) return placed[i];
    return null;
  }

  /* วัตถุนี้เป็นเรขาคณิตชิ้นเดียวไหม (จำเป็นสำหรับลดโพลีกอน/ตัด-รวม) */
  function getSingleMesh(rec) {
    var mesh = null, count = 0;
    rec.group.traverse(function (o) { if (o.isMesh) { mesh = o; count++; } });
    return count === 1 ? mesh : null;
  }

  function select(id) {
    selectedId = id;
    if (selHelper) { scene.remove(selHelper); selHelper = null; }
    var rec = id ? findRec(id) : null;
    if (rec) {
      selHelper = new THREE.BoxHelper(rec.group, 0x12A594);
      scene.add(selHelper);
      if (xformOn) { xform.attach(rec.group); xform.visible = true; xform.enabled = true; }
    } else if (xform) {
      xform.detach(); xform.visible = false; xform.enabled = false;
    }
    renderInspector();
  }

  function onXformChange() {
    var rec = findRec(selectedId);
    if (!rec) return;
    rec.x = rec.group.position.x;
    rec.z = rec.group.position.z;
    rec.rotY = rec.group.rotation.y;
    rec.scale = rec.group.scale.x; // สเกลแบบสม่ำเสมอเสมอ (uniform)
    rec.group.scale.setScalar(rec.scale);
    if (selHelper) selHelper.update();
    updateInspectorSizeOnly();
    scheduleSave();
  }

  function hexStr(n) { return '#' + ('000000' + n.toString(16)).slice(-6); }

  /* ══════════════════ แผงควบคุมวัตถุที่เลือก ══════════════════ */
  function sizeText(s) { return T('sizeFmt', { x: fmtCm(s.x), z: fmtCm(s.z), y: fmtCm(s.y) }); }
  function recLabel(rec) {
    if (rec.type === 'proc') return defLabel(defByKey(rec.key));
    return rec.nameKey ? T(rec.nameKey) : ('' + (rec.name || T('imported')));
  }
  function renderInspector() {
    var card = $('s3InspectorCard'), body = $('s3InspectorBody');
    var rec = selectedId ? findRec(selectedId) : null;
    if (!rec) { card.style.display = 'none'; return; }
    card.style.display = '';
    var isProc = rec.type === 'proc';
    var label = recLabel(rec);
    var ic = function (n) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + n + '"/></svg>'; };
    var nb = function (code, key, icon) { return '<button class="btn sm icon" type="button" data-nudge="' + code + '" aria-label="' + T(key) + '">' + ic(icon) + '</button>'; };

    var html = '<div class="s3-insp-row"><span class="lbl"' + (isProc ? '' : ' data-i18n-skip') + '>' + escHtml(label) + '</span>' +
      '<button class="btn sm" id="s3Del" type="button">' + T('del') + '</button></div>';

    html += '<div class="s3-insp-row"><span class="lbl">' + T('position') + '</span><div class="s3-nudge">' +
      nb('x-1', 'nLeft', 'arrow-left') + nb('x1', 'nRight', 'arrow-right') + nb('z-1', 'nIn', 'arrow-up') + nb('z1', 'nOut', 'arrow-down') + '</div></div>' +
      '<div class="s3-insp-row"><span class="lbl">' + T('rot90') + '</span><div class="s3-nudge">' +
      nb('ry-1', 'rLeft', 'rotate-ccw') + nb('ry1', 'rRight', 'rotate-cw') + '</div></div>';

    if (isProc) {
      var curHex = hexStr(rec.color).toLowerCase();
      var swatches = COLOR_CHOICES.map(function (c) {
        var on = c.toLowerCase() === curHex;
        return '<button class="btn sm icon s3-swatch" type="button" style="--sw:' + c + '" data-color="' + c + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + T('colorOf', { c: c }) + '"><span></span></button>';
      }).join('');
      html += '<div class="s3-insp-row"><span class="lbl">' + T('color') + '</span></div><div class="s3-color-row">' + swatches + '</div>';
    }

    var curSize = { x: rec.baseSize.x * rec.scale, y: rec.baseSize.y * rec.scale, z: rec.baseSize.z * rec.scale };
    html += '<div class="s3-insp-row" id="s3SizeInfo"><span class="lbl">' + T('curSize') + '</span>' +
      '<span class="s3-size-val">' + sizeText(curSize) + '</span></div>' +
      '<div class="s3-insp-row"><span class="lbl">' + T('resize') + '</span></div>' +
      '<div class="s3-size-row">' +
        '<select class="select" id="s3SizeAxis" aria-label="' + T('resize') + '"><option value="y">' + T('axisY') + '</option><option value="x">' + T('axisX') + '</option><option value="z">' + T('axisZ') + '</option></select>' +
        '<input class="input" type="number" id="s3SizeInput" min="0.1" step="0.5" placeholder="' + T('cm') + '" aria-label="' + T('cm') + '" value="' + fmtCm(curSize.y, true) + '">' +
        '<button class="btn sm" id="s3SizeApply" type="button">' + T('apply') + '</button>' +
      '</div>' +
      '<div class="s3-nudge" style="margin-top:8px">' +
        '<button class="btn sm" type="button" data-scale="0.9">－10%</button>' +
        '<button class="btn sm" type="button" data-scale="1.1">＋10%</button>' +
        '<button class="btn sm" type="button" id="s3SizeReset">' + T('resetSize') + '</button>' +
      '</div>';

    var mesh = getSingleMesh(rec);
    if (!isProc && mesh) {
      var triCount = mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3;
      html += '<div class="s3-insp-row"><span class="lbl">' + T('simplify') + '</span><span class="s3-size-val" id="s3TriCount">' + T('tris', { n: OME_I18N.number(Math.round(triCount)) }) + '</span></div>' +
        '<div class="s3-size-row"><input type="range" id="s3SimplifyRange" min="10" max="100" value="100" aria-label="' + T('simplify') + '" style="flex:1"><span id="s3SimplifyPct" class="s3-size-val" style="min-width:40px">100%</span></div>';
    } else if (!isProc && !mesh) {
      html += '<div class="s3-insp-row"><span class="lbl mini-note">' + T('multiPart') + '</span></div>';
    }

    html += '<div class="s3-insp-row"><span class="lbl">' + T('download') + '</span><div class="s3-nudge">' +
      '<button class="btn sm" id="s3ExpGlb" type="button">.glb</button>' +
      (mesh ? '<button class="btn sm" id="s3ExpStl" type="button">.stl</button>' : '') +
      '</div></div>';

    body.innerHTML = html;
    body.querySelector('#s3Del').addEventListener('click', deleteSelected);
    Array.prototype.forEach.call(body.querySelectorAll('[data-nudge]'), function (b) {
      b.addEventListener('click', function () { nudge(b.dataset.nudge); });
    });
    Array.prototype.forEach.call(body.querySelectorAll('.s3-swatch'), function (s) {
      s.addEventListener('click', function () { recolor(s.dataset.color); });
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-scale]'), function (b) {
      b.addEventListener('click', function () { scaleBy(parseFloat(b.dataset.scale)); });
    });
    body.querySelector('#s3SizeApply').addEventListener('click', applySizeInput);
    body.querySelector('#s3SizeReset').addEventListener('click', function () { setScale(1); });
    body.querySelector('#s3ExpGlb').addEventListener('click', function () { exportSelected('glb'); });
    var stlBtn = body.querySelector('#s3ExpStl');
    if (stlBtn) stlBtn.addEventListener('click', function () { exportSelected('stl'); });
    var simRange = body.querySelector('#s3SimplifyRange');
    if (simRange) {
      simRange.addEventListener('input', function () {
        body.querySelector('#s3SimplifyPct').textContent = simRange.value + '%';
      });
      simRange.addEventListener('change', function () { applySimplify(parseInt(simRange.value, 10)); });
    }
  }

  /* อัปเดตแค่ตัวเลขขนาด ไม่ build ใหม่ทั้งพาเนล (เรียกบ่อยตอนลาก gizmo) */
  function updateInspectorSizeOnly() {
    var rec = selectedId ? findRec(selectedId) : null;
    var el = $('s3SizeInfo');
    if (!rec || !el) return;
    var s = { x: rec.baseSize.x * rec.scale, y: rec.baseSize.y * rec.scale, z: rec.baseSize.z * rec.scale };
    el.querySelector('.s3-size-val').textContent = sizeText(s);
  }

  function fmtCm(m, raw) {
    var cm = m * 100;
    return raw ? (Math.round(cm * 10) / 10) : OME_I18N.number(Math.round(cm * 10) / 10);
  }

  function setScale(s) {
    var rec = findRec(selectedId);
    if (!rec) return;
    rec.scale = Math.max(0.02, s);
    rec.group.scale.setScalar(rec.scale);
    if (selHelper) selHelper.update();
    renderInspector();
    scheduleSave();
  }

  function scaleBy(factor) { var rec = findRec(selectedId); if (rec) setScale(rec.scale * factor); }

  function applySizeInput() {
    var rec = findRec(selectedId);
    if (!rec) return;
    var axis = $('s3SizeAxis').value;
    var targetCm = parseFloat($('s3SizeInput').value);
    if (!isFinite(targetCm) || targetCm <= 0) { s3Alert(T('eSize')); return; }
    var targetM = targetCm / 100;
    var base = rec.baseSize[axis];
    if (!base || base <= 0) return;
    setScale(targetM / base);
  }

  function nudge(code) {
    var rec = findRec(selectedId);
    if (!rec) return;
    var step = snapEnabled ? SNAP : 0.1;
    if (code === 'x-1') rec.x -= step;
    else if (code === 'x1') rec.x += step;
    else if (code === 'z-1') rec.z -= step;
    else if (code === 'z1') rec.z += step;
    else if (code === 'ry-1') rec.rotY -= Math.PI / 2;
    else if (code === 'ry1') rec.rotY += Math.PI / 2;
    rec.group.position.set(rec.x, rec.group.position.y, rec.z);
    rec.group.rotation.y = rec.rotY;
    if (selHelper) selHelper.update();
    scheduleSave();
  }

  function recolor(hex) {
    var rec = findRec(selectedId);
    if (!rec) return;
    var col = parseInt(hex.replace('#', ''), 16);
    rec.color = col;
    rec.group.traverse(function (o) { if (o.isMesh) o.material.color.setHex(col); });
    renderInspector();
    scheduleSave();
  }

  function deleteSelected() {
    var rec = findRec(selectedId);
    if (!rec) return;
    scene.remove(rec.group);
    placed = placed.filter(function (r) { return r.id !== rec.id; });
    select(null);
    scheduleSave();
  }

  /* ══════════════════ ลดความละเอียด (SimplifyModifier) ══════════════════ */
  function applySimplify(pct) {
    var rec = findRec(selectedId);
    if (!rec) return;
    var mesh = getSingleMesh(rec);
    if (!mesh) return;
    if (!rec.origGeometry) rec.origGeometry = mesh.geometry.clone(); // ต้นฉบับไว้ลดใหม่จากศูนย์เสมอ ไม่ลดซ้อนสะสม
    if (pct >= 100) {
      mesh.geometry.dispose();
      mesh.geometry = rec.origGeometry.clone();
    } else {
      var srcGeo = rec.origGeometry;
      var vertCount = srcGeo.attributes.position.count;
      var targetTris = Math.max(4, Math.round((vertCount / 3) * (pct / 100)));
      try {
        var simplified = new SimplifyModifier().modify(srcGeo.clone(), vertCount - targetTris * 3 > 0 ? Math.round(vertCount * (1 - pct / 100)) : 0);
        mesh.geometry.dispose();
        mesh.geometry = simplified;
      } catch (e) {
        s3Alert(T('eSimplify', { m: e && e.message ? e.message : e }));
      }
    }
    if (selHelper) selHelper.update();
    var triCountEl = $('s3TriCount');
    if (triCountEl) {
      var t = mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3;
      triCountEl.textContent = T('tris', { n: OME_I18N.number(Math.round(t)) });
    }
  }

  /* ══════════════════ Export .glb / .stl ══════════════════ */
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function exportSelected(format) {
    var rec = findRec(selectedId);
    if (!rec) return;
    var name = 'tanot-sim3d-' + (rec.name || rec.key || 'object').replace(/[^a-z0-9ก-๙_-]+/gi, '_');
    if (format === 'glb') {
      new GLTFExporter().parse(rec.group, function (result) {
        var blob = (result instanceof ArrayBuffer)
          ? new Blob([result], { type: 'model/gltf-binary' })
          : new Blob([JSON.stringify(result)], { type: 'application/json' });
        downloadBlob(blob, name + '.glb');
      }, function (err) { s3Alert(T('eGlb', { m: err })); }, { binary: true });
    } else if (format === 'stl') {
      var mesh = getSingleMesh(rec);
      if (!mesh) return;
      var data = new STLExporter().parse(mesh, { binary: true });
      downloadBlob(new Blob([data], { type: 'model/stl' }), name + '.stl');
    }
  }

  function exportAllAsStl() {
    if (!placed.length) { s3Alert(T('eEmpty')); return; }
    var geometries = [];
    placed.forEach(function (r) {
      r.group.updateWorldMatrix(true, true);
      r.group.traverse(function (o) {
        if (o.isMesh && o.geometry) {
          var g = o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          if (!g.getAttribute('normal')) g.computeVertexNormals();
          geometries.push(g);
        }
      });
    });
    if (!geometries.length) return;
    try {
      var merged = geometries.length === 1 ? geometries[0] : BufferGeometryUtils.mergeGeometries(geometries, false);
      var mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial());
      var data = new STLExporter().parse(mesh, { binary: true });
      downloadBlob(new Blob([data], { type: 'model/stl' }), 'tanot-sim3d-all.stl');
    } catch (e) {
      s3Alert(T('eMerge', { m: e && e.message ? e.message : e }));
    }
  }

  /* ══════════════════ คลังของ (procedural + โมเดลของฉัน) ══════════════════ */
  var procCatalogBound = false;
  function buildProcCatalog() {
    var groups = {}, order = [];
    OBJECT_DEFS.forEach(function (d) {
      if (!groups[d.group]) { groups[d.group] = []; order.push(d.group); }
      groups[d.group].push(d);
    });
    var html = '';
    order.forEach(function (g) {
      html += '<div class="s3-cat-group-h">' + groupLabel(g) + '</div><div class="s3-catalog-row">';
      groups[g].forEach(function (d) {
        html += '<button class="btn s3-cat" type="button" data-key="' + d.key + '">' +
          '<span class="ic">' + d.icon + '</span><span class="lb">' + defLabel(d) + '</span></button>';
      });
      html += '</div>';
    });
    $('s3CatalogProc').innerHTML = html;
    if (procCatalogBound) return;
    procCatalogBound = true;
    $('s3CatalogProc').addEventListener('click', function (e) {
      var btn = e.target.closest('.s3-cat');
      if (!btn) return;
      addProcObject(btn.dataset.key, stagingX(), -3, 0, null, 1);
      closeDrawer();
    });
  }

  function refreshMyModelsCatalog() {
    return dbListModels().then(function (list) {
      myModels = list;
      var wrap = $('s3CatalogModels');
      var rows = list.map(function (m) {
        return '<div class="s3-model-row" data-id="' + m.id + '">' +
          '<button class="btn s3-model-use" type="button" data-model-id="' + m.id + '" data-i18n-skip>' +
            '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-cuboid"/></svg><span class="nm">' + escHtml(m.name) + '</span></button>' +
          '<button class="btn ghost icon sm" type="button" data-del-id="' + m.id + '" aria-label="' + escHtml(T('delModelLabel', { n: m.name })) + '"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-trash-2"/></svg></button>' +
        '</div>';
      }).join('');
      wrap.innerHTML =
        (list.length ? '<div class="s3-model-list">' + rows + '</div>' : '<p class="s3-insp-empty">' + T('noModels') + '</p>') +
        '<button class="btn sm s3-upload" type="button" id="s3UploadBtn"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-upload"/></svg>' + T('upload') + '</button>' +
        '<input type="file" id="s3FileInput" accept=".glb,.gltf,.obj,.ply,.stl,.fbx" style="display:none">' +
        '<p class="s3-upload-status" id="s3UploadStatus" style="display:none"></p>';
      $('s3UploadBtn').addEventListener('click', function () { $('s3FileInput').click(); });
      $('s3FileInput').addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (f) handleFileUpload(f);
        e.target.value = '';
      });
      Array.prototype.forEach.call(wrap.querySelectorAll('[data-model-id]'), function (b) {
        b.addEventListener('click', function () { placeModelById(parseInt(b.dataset.modelId, 10)); closeDrawer(); });
      });
      Array.prototype.forEach.call(wrap.querySelectorAll('[data-del-id]'), function (b) {
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var id = parseInt(b.dataset.delId, 10);
          s3Confirm(T('delModelConfirm')).then(function (ok) {
            if (!ok) return;
            dbDeleteModel(id).then(refreshMyModelsCatalog);
          });
        });
      });
    });
  }

  /* ยกให้เบราว์เซอร์วาดหน้าจอก่อนเริ่มงานหนัก (parse ไฟล์ 3D เป็นงาน sync บล็อก main
     thread) เพื่อให้ข้อความ "กำลังประมวลผล…" ทันขึ้นก่อนหน้าจอจะไม่ตอบสนองชั่วขณะ */
  function nextPaint() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () { setTimeout(resolve, 0); });
    });
  }
  var uploadMsg = null; /* { k, v } — เก็บเป็นคีย์ข้อความ แปลสดตอนสลับภาษา */
  function uploadMsgText() { return uploadMsg ? T(uploadMsg.k, uploadMsg.v) : ''; }
  function setUploadBusy(busy, msg) {
    var btn = $('s3UploadBtn'), input = $('s3FileInput'), status = $('s3UploadStatus');
    if (btn) btn.disabled = busy;
    if (input) input.disabled = busy;
    uploadMsg = busy ? msg : null;
    if (status) {
      status.style.display = busy ? '' : 'none';
      status.innerHTML = busy ? '<span class="spinner"></span><span></span>' : '';
      if (busy) status.lastChild.textContent = uploadMsgText();
    }
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function placeModelById(id) {
    setUploadBusy(true, { k: 'loadingModel' });
    dbGetModel(id).then(function (rec) {
      if (!rec) { s3Alert(T('noModel')); return; }
      return nextPaint().then(function () { return addModelObject(rec, stagingX(), -3, 0, 1, false); });
    }).catch(function (e) { s3Alert(T('eLoadModel', { m: e && e.message ? e.message : e })); })
      .then(function () { setUploadBusy(false); });
  }

  function handleFileUpload(file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (UPLOAD_EXTS.indexOf(ext) === -1) { s3Alert(T('eExt')); return; }
    setUploadBusy(true, { k: 'reading', v: { f: file.name } });
    var bufHolder;
    file.arrayBuffer().then(function (buf) {
      bufHolder = buf;
      setUploadBusy(true, { k: 'converting' });
      return nextPaint();
    }).then(function () {
      return parseModelFile(ext, bufHolder); // parse ครั้งเดียว แล้วส่งต่อให้วางในผังเลย ไม่ parse ซ้ำสองรอบ
    }).then(function (parsedObj) {
      var rec = { name: file.name.replace(/\.[^.]+$/, ''), format: ext, arrayBuffer: bufHolder, sizeBytes: bufHolder.byteLength, createdAt: Date.now() };
      return dbAddModel(rec).then(function (id) {
        rec.id = id;
        return refreshMyModelsCatalog().then(function () { return addModelObject(rec, stagingX(), -3, 0, 1, false, parsedObj); });
      });
    }).then(function () {
      setUploadBusy(false);
    }).catch(function (err) {
      setUploadBusy(false);
      s3Alert(T('eRead', { m: err && err.message ? err.message : err }));
    });
  }

  function stagingX() {
    var x = (stageCount % 6) * 0.9 - 2.25;
    stageCount++;
    return x;
  }

  /* ══════════════════ ตัด/รวม (Boolean CSG, โหลด lazy) ══════════════════ */
  function loadScriptTag(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function ensureCsgLoaded() {
    if (csgLoaded) return Promise.resolve();
    window.THREE = THREE;
    return loadScriptTag('vendor/csg/three-mesh-bvh.umd.js')
      .then(function () { return loadScriptTag('vendor/csg/three-bvh-csg.umd.js'); })
      .then(function () { csgLoaded = true; });
  }

  function startCsgMode() {
    if (placed.length < 2) { s3Alert(T('csgNeed2')); return; }
    csgMode = 'pick-base';
    csgBaseId = null;
    select(null);
    setCsgHint('csgPickBase');
    closeDrawer();
  }
  function cancelCsgMode() {
    csgMode = null; csgBaseId = null;
    setCsgHint('');
  }
  var csgHintKey = '';
  function setCsgHint(key) {
    csgHintKey = key;
    var el = $('s3CsgHint');
    if (!el) return;
    el.textContent = key ? T(key) : '';
    el.style.display = key ? '' : 'none';
  }
  function handleCsgPick(hitId) {
    if (!hitId) return;
    if (csgMode === 'pick-base') {
      csgBaseId = hitId;
      csgMode = 'pick-tool';
      setCsgHint('csgPickTool');
      return;
    }
    if (csgMode === 'pick-tool') {
      if (hitId === csgBaseId) return;
      var baseId = csgBaseId, toolId = hitId;
      csgMode = null; csgBaseId = null;
      setCsgHint('');
      showModal({
        title: T('csgTitle'),
        message: T('csgMsg'),
        cancelValue: null,
        buttons: [
          { label: T('cancel'), value: null },
          { label: T('csgUnionBtn'), value: 'union' },
          { label: T('csgSubBtn'), value: 'subtract', primary: true }
        ]
      }).then(function (op) {
        if (!op) return;
        runCsg(baseId, toolId, op);
      });
    }
  }

  function runCsg(baseId, toolId, op) {
    var baseRec = findRec(baseId), toolRec = findRec(toolId);
    if (!baseRec || !toolRec) return;
    var baseMesh = getSingleMesh(baseRec), toolMesh = getSingleMesh(toolRec);
    if (!baseMesh || !toolMesh) { s3Alert(T('csgMulti')); return; }
    ensureCsgLoaded().then(function () {
      var CSG = window.ThreBvhCsg;
      var Brush = CSG.Brush, Evaluator = CSG.Evaluator;
      var brushA = new Brush(baseMesh.geometry.clone(), baseMesh.material);
      brushA.position.copy(baseRec.group.position);
      brushA.rotation.copy(baseRec.group.rotation);
      brushA.scale.copy(baseRec.group.scale);
      brushA.updateMatrixWorld(true);
      var brushB = new Brush(toolMesh.geometry.clone(), toolMesh.material);
      brushB.position.copy(toolRec.group.position);
      brushB.rotation.copy(toolRec.group.rotation);
      brushB.scale.copy(toolRec.group.scale);
      brushB.updateMatrixWorld(true);
      var evaluator = new Evaluator();
      var opCode = op === 'union' ? CSG.ADDITION : CSG.SUBTRACTION;
      var result = evaluator.evaluate(brushA, brushB, opCode);
      result.geometry.computeVertexNormals();
      var resultMesh = new THREE.Mesh(result.geometry, baseMesh.material);
      scene.remove(baseRec.group);
      scene.remove(toolRec.group);
      placed = placed.filter(function (r) { return r.id !== baseId && r.id !== toolId; });
      finalizePlace({ type: 'csg', name: op === 'union' ? 'รวมชิ้น' : 'ตัดชิ้น', nameKey: op === 'union' ? 'csgUnion' : 'csgCut', color: baseRec.color }, resultMesh, 0, 0, 0, 1, false);
    }).catch(function (e) {
      s3Alert(T('eCsg', { m: e && e.message ? e.message : e }));
    });
  }

  /* ══════════════════ AR preview (WebXR) ══════════════════ */
  function setupAR() {
    var slot = $('s3ArSlot');
    if (!slot) return;
    if (!navigator.xr) { slot.style.display = 'none'; return; }
    navigator.xr.isSessionSupported('immersive-ar').then(function (ok) {
      if (!ok) { slot.style.display = 'none'; return; }
      renderer.xr.enabled = true;
      var btn = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
      btn.classList.add('btn', 'sm');
      slot.appendChild(btn);
    }).catch(function () { slot.style.display = 'none'; });
  }

  /* ══════════════════ ลิ้นชักแผงควบคุม (จอ ≤ 1000px) + เปลี่ยนภาษาสด ══════════════════ */
  var drawerMq = window.matchMedia ? window.matchMedia('(max-width:1000px)') : null;
  function drawerOpen() { var a = $('s3Aside'); return !!(a && a.classList.contains('open')); }
  function openDrawer() {
    if (!drawerMq || !drawerMq.matches) return;
    $('s3Aside').classList.add('open');
    $('s3Backdrop').classList.add('open');
    $('s3PanelOpen').setAttribute('aria-expanded', 'true');
    var c = $('s3PanelClose'); if (c) c.focus();
  }
  function closeDrawer() {
    if (!drawerOpen()) return;
    $('s3Aside').classList.remove('open');
    $('s3Backdrop').classList.remove('open');
    var o = $('s3PanelOpen');
    o.setAttribute('aria-expanded', 'false');
    if (document.activeElement && $('s3Aside').contains(document.activeElement)) o.focus();
  }
  /* จอแคบ: เครื่องมือแถว 2 + กลุ่มบันทึกภาพ/ล้างทั้งหมดย้ายเข้าลิ้นชัก (ย้าย DOM เดิม ตัวฟังเหตุการณ์ยังอยู่) · จอกว้าง: คืนที่เดิม */
  function placeTools() {
    var g2 = $('s3Group2'), r2 = $('s3Row2'), dt = $('s3DrawerTools'), r1 = $('s3Row1'), hint = $('s3CsgHint');
    if (!g2 || !r2 || !dt || !r1 || !hint) return;
    if (drawerMq && drawerMq.matches) {
      if (g2.parentNode !== dt) dt.appendChild(g2);
      if (r2.parentNode !== dt) dt.appendChild(r2);
    } else {
      if (g2.parentNode !== r1) r1.appendChild(g2);
      if (r2.parentNode !== hint.parentNode) hint.parentNode.insertBefore(r2, hint);
      $('s3Aside').classList.remove('open');
      $('s3Backdrop').classList.remove('open');
    }
  }
  function bindDrawer() {
    $('s3PanelOpen').addEventListener('click', openDrawer);
    $('s3PanelClose').addEventListener('click', closeDrawer);
    $('s3Backdrop').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawerOpen() && !$('s3Modal').open) closeDrawer(); });
    if (drawerMq) {
      if (drawerMq.addEventListener) drawerMq.addEventListener('change', placeTools); else drawerMq.addListener(placeTools);
    }
    placeTools();
    document.title = T('pageTitle');
    OME_I18N.apply(document);
    OME_LANG.onChange(function () {
      document.title = T('pageTitle');
      buildProcCatalog();
      refreshMyModelsCatalog().then(function () { if (uploadMsg) setUploadBusy(true, uploadMsg); });
      renderInspector();
      setCsgHint(csgHintKey);
    });
  }

  /* ══════════════════ แถบเครื่องมือ ══════════════════ */
  function bindToolbar() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
      b.addEventListener('click', function () { flyTo(b.dataset.view); });
    });
    $('s3Snap').addEventListener('change', function (e) { snapEnabled = e.target.checked; });
    $('s3Shot').addEventListener('click', exportShot);
    $('s3Clear').addEventListener('click', function () {
      if (!placed.length) return;
      s3Confirm(T('clearConfirm')).then(function (ok) {
        if (!ok) return;
        placed.slice().forEach(function (r) { scene.remove(r.group); });
        placed = [];
        select(null);
        scheduleSave();
      });
    });
    $('s3XformToggle').addEventListener('click', function () {
      xformOn = !xformOn;
      $('s3XformToggle').classList.toggle('active', xformOn);
      if (xformOn && selectedId) { xform.attach(findRec(selectedId).group); xform.visible = true; xform.enabled = true; }
      else { xform.detach(); xform.visible = false; xform.enabled = false; }
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-xmode]'), function (b) {
      b.addEventListener('click', function () {
        xform.setMode(b.dataset.xmode);
        Array.prototype.forEach.call(document.querySelectorAll('[data-xmode]'), function (x) { x.classList.toggle('active', x === b); });
      });
    });
    $('s3CsgStart').addEventListener('click', startCsgMode);
    $('s3CsgCancel').addEventListener('click', cancelCsgMode);
    $('s3ExportAll').addEventListener('click', exportAllAsStl);
  }

  function flyTo(name) {
    var p = PRESETS[name];
    if (!p) return;
    if (window.gsap) {
      window.gsap.to(camera.position, { x: p.pos[0], y: p.pos[1], z: p.pos[2], duration: 0.85, ease: 'power2.inOut' });
      window.gsap.to(controls.target, { x: p.target[0], y: p.target[1], z: p.target[2], duration: 0.85, ease: 'power2.inOut' });
    } else {
      camera.position.set(p.pos[0], p.pos[1], p.pos[2]);
      controls.target.set(p.target[0], p.target[1], p.target[2]);
    }
  }

  function exportShot() {
    renderer.render(scene, camera);
    var a = document.createElement('a');
    a.href = renderer.domElement.toDataURL('image/png');
    a.download = 'tanot-sim3d-objects.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ══════════════════ บันทึก/โหลด (localStorage เก็บแค่ transform+อ้างอิง) ══════════════════ */
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveToStorage, 250);
  }

  var saveBarTimer = null;
  function saveToStorage() {
    var data = placed.map(function (r) {
      return { type: r.type, key: r.key, modelId: r.modelId, x: r.x, z: r.z, rotY: r.rotY, scale: r.scale, color: r.color };
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
    var bar = $('s3SaveBar');
    if (bar) {
      bar.textContent = T('saved');
      clearTimeout(saveBarTimer);
      saveBarTimer = setTimeout(function () { bar.textContent = ''; }, 1500);
    }
  }

  function loadFromStorage() {
    var data = [];
    try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) {}
    var chain = Promise.resolve();
    data.forEach(function (r) {
      chain = chain.then(function () {
        if (r.type === 'model') {
          return dbGetModel(r.modelId).then(function (modelRec) {
            if (!modelRec) return; // โมเดลถูกลบจากคลังไปแล้ว ข้ามเงียบๆ
            return addModelObject(modelRec, r.x, r.z, r.rotY, r.scale, true);
          }).catch(function () {});
        }
        if (r.type === 'csg') return Promise.resolve(); // ผล CSG ไม่บันทึกไฟล์ย้อนกลับ (ยังไม่รองรับข้ามเซสชัน)
        addProcObject(r.key, r.x, r.z, r.rotY, r.color, r.scale, true);
        return Promise.resolve();
      });
    });
    return chain.then(function () {
      stageCount = data.length % 6;
      select(null);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__sim3dObjects = {
    OBJECT_DEFS: OBJECT_DEFS,
    addProcObject: addProcObject,
    addModelObject: addModelObject,
    getPlaced: function () { return placed; },
    select: select,
    nudge: nudge,
    recolor: recolor,
    deleteSelected: deleteSelected,
    flyTo: flyTo,
    setScale: setScale,
    applySizeInput: function (axis, cm) { $('s3SizeAxis').value = axis; $('s3SizeInput').value = cm; applySizeInput(); },
    applySimplify: applySimplify,
    startCsgMode: startCsgMode,
    handleCsgPick: handleCsgPick,
    exportAllAsStl: exportAllAsStl,
    dbListModels: dbListModels,
    dbDeleteModel: dbDeleteModel,
    getMyModels: function () { return myModels; },
    handleFileUpload: handleFileUpload
  };
})();
