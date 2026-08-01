/* ══════════════════════════════════════════════════════════════════
   จำลองสิ่งของ 3D — จัดผัง/วางเฟอร์นิเจอร์+อุปกรณ์ก่อสร้าง
   วัตถุทั้งหมดสร้างจากทรงเรขาคณิตพื้นฐานของ Three.js ในโค้ดนี้ล้วนๆ
   (ไม่พึ่งพาโมเดล .glb จากภายนอก) — ระบบออกแบบให้ต่อโมเดลจริงได้ทีหลัง
   ถ้าต้องการ โดยไม่ต้องแก้โครงสร้าง OBJECT_DEFS/placed เดิม
   ══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

(function () {
  'use strict';

  var STORAGE_KEY = 'tanot:sim3d:objects';
  var SNAP = 0.5;

  /* ── คลังวัตถุ: แต่ละอันคืน THREE.Group จากทรงพื้นฐาน หน่วยเป็นเมตร ── */
  var OBJECT_DEFS = [
    { key: 'wall', label: 'ผนัง', icon: '🧱', group: 'โครงสร้าง', color: 0xE0DDD3, build: function (c) {
        var g = new THREE.Group();
        var m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 0.15), new THREE.MeshStandardMaterial({ color: c }));
        m.position.y = 1.2; g.add(m); return g;
      } },
    { key: 'door', label: 'ประตู', icon: '🚪', group: 'โครงสร้าง', color: 0x8B5E3C, build: function (c) {
        var g = new THREE.Group();
        var m = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.1, 0.06), new THREE.MeshStandardMaterial({ color: c }));
        m.position.y = 1.05; g.add(m); return g;
      } },
    { key: 'window', label: 'หน้าต่าง', icon: '🪟', group: 'โครงสร้าง', color: 0x9FD8E8, build: function (c) {
        var g = new THREE.Group();
        var frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, 0.08), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
        frame.position.y = 1.5; g.add(frame);
        var glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.05), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.55 }));
        glass.position.set(0, 1.5, 0.01); g.add(glass);
        return g;
      } },
    { key: 'column', label: 'เสา', icon: '🏛️', group: 'โครงสร้าง', color: 0xC9C4B8, build: function (c) {
        var g = new THREE.Group();
        var m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.7, 16), new THREE.MeshStandardMaterial({ color: c }));
        m.position.y = 1.35; g.add(m); return g;
      } },
    { key: 'table', label: 'โต๊ะ', icon: '🍽️', group: 'เฟอร์นิเจอร์', color: 0xB78C56, build: function (c) {
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
    { key: 'chair', label: 'เก้าอี้', icon: '🪑', group: 'เฟอร์นิเจอร์', color: 0x6B7A8F, build: function (c) {
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
    { key: 'sofa', label: 'โซฟา', icon: '🛋️', group: 'เฟอร์นิเจอร์', color: 0x7C5C4A, build: function (c) {
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
    { key: 'cabinet', label: 'ตู้', icon: '🗄️', group: 'เฟอร์นิเจอร์', color: 0x9C7A4E, build: function (c) {
        var g = new THREE.Group();
        var body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.5), new THREE.MeshStandardMaterial({ color: c }));
        body.position.y = 0.9; g.add(body); return g;
      } },
    { key: 'bed', label: 'เตียง', icon: '🛏️', group: 'เฟอร์นิเจอร์', color: 0xD8C8B0, build: function (c) {
        var g = new THREE.Group();
        var frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 2.0), new THREE.MeshStandardMaterial({ color: 0x6B4A30 }));
        frame.position.y = 0.18; g.add(frame);
        var mattress = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.25, 1.95), new THREE.MeshStandardMaterial({ color: c }));
        mattress.position.y = 0.45; g.add(mattress);
        var pillow = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
        pillow.position.set(0, 0.62, -0.75); g.add(pillow);
        return g;
      } },
    { key: 'cone', label: 'กรวยจราจร', icon: '🚧', group: 'ไซต์งาน', color: 0xFF6B1A, build: function (c) {
        var g = new THREE.Group();
        var m = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 20), new THREE.MeshStandardMaterial({ color: c }));
        m.position.y = 0.27; g.add(m); return g;
      } },
    { key: 'barrel', label: 'ถังเก็บของ', icon: '🛢️', group: 'ไซต์งาน', color: 0x2E6DB4, build: function (c) {
        var g = new THREE.Group();
        var m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 20), new THREE.MeshStandardMaterial({ color: c }));
        m.position.y = 0.45; g.add(m); return g;
      } },
    { key: 'crate', label: 'ลัง/พาเลท', icon: '📦', group: 'ไซต์งาน', color: 0xB08654, build: function (c) {
        var g = new THREE.Group();
        var m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 1.2), new THREE.MeshStandardMaterial({ color: c }));
        m.position.y = 0.08; g.add(m); return g;
      } },
    { key: 'ladder', label: 'บันได', icon: '🪜', group: 'ไซต์งาน', color: 0xC9A227, build: function (c) {
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
    { key: 'sign', label: 'ป้ายเตือน', icon: '⚠️', group: 'ไซต์งาน', color: 0xF5C518, build: function (c) {
        var g = new THREE.Group();
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x555555 }));
        pole.position.y = 0.7; g.add(pole);
        var board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.03), new THREE.MeshStandardMaterial({ color: c }));
        board.position.y = 1.3; g.add(board);
        return g;
      } },
    { key: 'scaffold', label: 'นั่งร้าน', icon: '🏗️', group: 'ไซต์งาน', color: 0x8A8F99, build: function (c) {
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

  var scene, camera, renderer, controls, viewportEl;
  var raycaster = new THREE.Raycaster();
  var placed = [];
  var selectedId = null;
  var selHelper = null;
  var idSeq = 1;
  var stageCount = 0;
  var snapEnabled = true;
  var saveTimer = null;

  function $(id) { return document.getElementById(id); }

  function init() {
    viewportEl = $('s3Viewport');
    try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xE7ECF4);

      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(PRESETS.persp.pos[0], PRESETS.persp.pos[1], PRESETS.persp.pos[2]);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      viewportEl.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(PRESETS.persp.target[0], PRESETS.persp.target[1], PRESETS.persp.target[2]);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.minDistance = 2;
      controls.maxDistance = 40;

      scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.1));
      var dir = new THREE.DirectionalLight(0xffffff, 1.5);
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

      loadFromStorage();
      buildCatalog();
      bindToolbar();
      animate();
    } catch (e) {
      viewportEl.innerHTML = '<div class="s3-loading">เบราว์เซอร์นี้ไม่รองรับ WebGL — ลองเปิดด้วยเบราว์เซอร์อื่นหรืออัปเดตเบราว์เซอร์</div>';
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
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
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
    if (hits.length) {
      var obj = hits[0].object;
      while (obj && obj.userData.simId == null) obj = obj.parent;
      select(obj ? obj.userData.simId : null);
    } else {
      select(null);
    }
  }

  function buildCatalog() {
    var groups = {}, order = [];
    OBJECT_DEFS.forEach(function (d) {
      if (!groups[d.group]) { groups[d.group] = []; order.push(d.group); }
      groups[d.group].push(d);
    });
    var html = '';
    order.forEach(function (g) {
      html += '<div class="s3-cat-group-h">' + g + '</div><div class="s3-catalog-row">';
      groups[g].forEach(function (d) {
        html += '<button class="s3-cat-btn" type="button" data-key="' + d.key + '">' +
          '<span class="ic">' + d.icon + '</span><span class="lb">' + d.label + '</span></button>';
      });
      html += '</div>';
    });
    var cat = $('s3Catalog');
    cat.innerHTML = html;
    cat.addEventListener('click', function (e) {
      var btn = e.target.closest('.s3-cat-btn');
      if (!btn) return;
      addObject(btn.dataset.key, stagingX(), -3, 0, null);
    });
  }

  function stagingX() {
    var x = (stageCount % 6) * 0.9 - 2.25;
    stageCount++;
    return x;
  }

  function addObject(key, x, z, rotY, color, skipSave) {
    var def = defByKey(key);
    if (!def) return null;
    var col = (color != null) ? color : def.color;
    var group = def.build(col);
    if (snapEnabled) { x = Math.round(x / SNAP) * SNAP; z = Math.round(z / SNAP) * SNAP; }
    group.position.set(x, 0, z);
    group.rotation.y = rotY || 0;
    var id = 'o' + (idSeq++);
    group.userData.simId = id;
    scene.add(group);
    placed.push({ id: id, key: key, group: group, x: x, z: z, rotY: rotY || 0, color: col });
    select(id);
    if (!skipSave) scheduleSave();
    return id;
  }

  function findRec(id) {
    for (var i = 0; i < placed.length; i++) if (placed[i].id === id) return placed[i];
    return null;
  }

  function select(id) {
    selectedId = id;
    if (selHelper) { scene.remove(selHelper); selHelper = null; }
    var rec = id ? findRec(id) : null;
    if (rec) {
      selHelper = new THREE.BoxHelper(rec.group, 0x12A594);
      scene.add(selHelper);
    }
    renderInspector();
  }

  function hexStr(n) { return '#' + ('000000' + n.toString(16)).slice(-6); }

  function renderInspector() {
    var card = $('s3InspectorCard'), body = $('s3InspectorBody');
    var rec = selectedId ? findRec(selectedId) : null;
    if (!rec) { card.style.display = 'none'; return; }
    card.style.display = '';
    var def = defByKey(rec.key);
    var curHex = hexStr(rec.color).toLowerCase();
    var swatches = COLOR_CHOICES.map(function (c) {
      var on = c.toLowerCase() === curHex;
      return '<button class="s3-swatch' + (on ? ' active' : '') + '" type="button" style="background:' + c + '" data-color="' + c + '" aria-label="สี ' + c + '"></button>';
    }).join('');
    body.innerHTML =
      '<div class="s3-insp-row"><span class="lbl">' + def.icon + ' ' + def.label + '</span>' +
        '<button class="btn sm" id="s3Del" type="button">🗑 ลบ</button></div>' +
      '<div class="s3-insp-row"><span class="lbl">ตำแหน่ง</span><div class="s3-nudge">' +
        '<button type="button" data-nudge="x-1" aria-label="ขยับซ้าย">◀</button>' +
        '<button type="button" data-nudge="x1" aria-label="ขยับขวา">▶</button>' +
        '<button type="button" data-nudge="z-1" aria-label="ขยับเข้า">▲</button>' +
        '<button type="button" data-nudge="z1" aria-label="ขยับออก">▼</button></div></div>' +
      '<div class="s3-insp-row"><span class="lbl">หมุน 90°</span><div class="s3-nudge">' +
        '<button type="button" data-nudge="ry-1" aria-label="หมุนซ้าย">⟲</button>' +
        '<button type="button" data-nudge="ry1" aria-label="หมุนขวา">⟳</button></div></div>' +
      '<div class="s3-insp-row"><span class="lbl">สี</span></div>' +
      '<div class="s3-color-row">' + swatches + '</div>';
    body.querySelector('#s3Del').addEventListener('click', deleteSelected);
    Array.prototype.forEach.call(body.querySelectorAll('[data-nudge]'), function (b) {
      b.addEventListener('click', function () { nudge(b.dataset.nudge); });
    });
    Array.prototype.forEach.call(body.querySelectorAll('.s3-swatch'), function (s) {
      s.addEventListener('click', function () { recolor(s.dataset.color); });
    });
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
    rec.group.position.set(rec.x, 0, rec.z);
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

  function bindToolbar() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
      b.addEventListener('click', function () { flyTo(b.dataset.view); });
    });
    $('s3Snap').addEventListener('change', function (e) { snapEnabled = e.target.checked; });
    $('s3Shot').addEventListener('click', exportShot);
    $('s3Clear').addEventListener('click', function () {
      if (!placed.length) return;
      if (!window.confirm('ล้างวัตถุทั้งหมดในผังนี้?')) return;
      placed.slice().forEach(function (r) { scene.remove(r.group); });
      placed = [];
      select(null);
      scheduleSave();
    });
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

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveToStorage, 250);
  }

  function saveToStorage() {
    var data = placed.map(function (r) {
      return { key: r.key, x: r.x, z: r.z, rotY: r.rotY, color: r.color };
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
    var bar = $('s3SaveBar');
    if (bar) {
      bar.classList.add('flash');
      setTimeout(function () { bar.classList.remove('flash'); }, 500);
    }
  }

  function loadFromStorage() {
    var data = [];
    try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) {}
    data.forEach(function (r) { addObject(r.key, r.x, r.z, r.rotY, r.color, true); });
    stageCount = data.length % 6;
    select(null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__sim3dObjects = {
    OBJECT_DEFS: OBJECT_DEFS,
    addObject: addObject,
    getPlaced: function () { return placed; },
    select: select,
    nudge: nudge,
    recolor: recolor,
    deleteSelected: deleteSelected,
    flyTo: flyTo
  };
})();
