/* ══════════════════════════════════════════════════════════════════
   Tanot — สร้างภาพ (image-gen.html)
   สร้างภาพด้วย Workers AI (FLUX) ผ่าน POST /api/ai/image (AiClient.image) — ฝั่งเซิร์ฟเวอร์ต่อท้าย prompt ตาม preset, เก็บภาพลง R2 (ns images)
   ข้อมูลกำกับภาพ 1 ภาพ = 1 แถวใน localStorage['tanot:images:items'] (sync list idField id):
     { id (= id ไฟล์ใน R2), preset, mode, model:'fast'|'quality', modelId, seed|null, prompt (ที่ผู้ใช้พิมพ์), fullPrompt (ที่ส่งเข้าโมเดล),
       name, mime, w, h, createdAt (ms), refId? (id ภาพที่ใช้เป็นภาพอ้างอิงตอน "แก้ภาพนี้" — ไม่มี = สร้างจากข้อความอย่างเดียว) }
   "แก้ภาพนี้": ดึงภาพจาก /api/files?id= → ย่อด้านยาว ≤ REF_MAX ด้วย canvas → PNG base64 → ส่งเป็น ref (โมเดล quality เท่านั้น)
   เขียนด้วย TanotData.update (อ่านสด → แก้ → เขียน) · ตัวกรอง/ค่าที่เลือกล่าสุด/อัตราส่วนอยู่ที่ 'tanot:images:ui' (local)
   การ์ด "กำลังสร้าง"/"ล้มเหลว" ในคลังอยู่ในหน่วยความจำของหน้า (state.pending) เท่านั้น — ไม่เขียนลง tanot:images:items, ไม่ซิงก์, ไม่ค้างข้ามการเปิดหน้า
   ลองใหม่ = งานเดิมด้วยพารามิเตอร์เดิมทั้งหมด (รวม refId/seed/ratio) · seed (ชิป) ใช้กับภาพแรกของแต่ละโหมดในชุด ภาพรอบถัดไปของชุดสุ่มใหม่
   ตรรกะล้วน (อัตราส่วน, prompt ล่าสุด) อยู่ใน image-gen-calc.js
   "พื้นโปร่ง"/"ลบพื้นหลัง" (ปุ่มใน dialog ดูภาพ — เฉพาะเมื่ออัปโหลดได้: *.pages.dev หรือ window.TANOT_FILES):
     พื้นโปร่ง = flood fill จาก 4 มุม (image-cutout-calc.js) ใน image-cutout-worker.js (ไม่มี Worker/OffscreenCanvas = เธรดหลักหลัง yield) · ปรับค่าความต่าง/ขอบนุ่มแล้วดูผลบนลายตาราง
     ลบพื้นหลัง = pipeline 'background-removal' ใน image-bgremove-worker.js (โมเดลใน TanotCutout.BG_MODEL) · ซ่อนบนมือถือ (โมเดลหนัก) · TanotMedia.budget id 'cutout'
       WebGPU เมื่อ TanotMedia.webgpuPlan() ได้ (ล้ม = Worker ถอย WASM เอง 1 ครั้ง) · ล้ม = ข้อความในกล่อง + problem log kind 'image' (ไม่มีภาพ/ชื่อไฟล์/prompt)
     ผล = PNG ใหม่ POST /api/files?ns=images → แถวใหม่ใน tanot:images:items (คัดลอกข้อมูลกำกับของต้นทาง + srcId + kind:'transparent'|'cutout')
       ไม่ทับแถวเดิม · ลบภาพต้นทางไม่ลบภาพที่ได้ (แถวแยกกัน ไฟล์แยกกัน)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var TD = window.TanotData, AI = window.AiClient, C = window.ImageGenCalc;
  var K = { items: 'tanot:images:items', ui: 'tanot:images:ui' };
  var REF_MAX = 512; // ต้องเท่ากับ REF_MAX ใน functions/api/ai/image.js (เทสต์ตรวจ)
  var T = OME_I18N.scope('ig', {
    th: {
      title: 'สร้างภาพ', quota: 'โควตา AI วันนี้', prompt: 'คำสั่ง', preset: 'แบบ', mode: 'โหมด', model: 'โมเดล', count: 'จำนวน',
      pBackground: 'พื้นหลัง', pIcon: 'ไอคอน', pFree: 'อิสระ', mLight: 'สว่าง', mDark: 'มืด', mBoth: 'ทั้งคู่', fast: 'เร็ว', quality: 'คุณภาพ',
      translate: 'แปลเป็นอังกฤษ', generate: 'สร้างภาพ', library: 'คลังภาพ', filter: 'กรอง', fAll: 'ทั้งหมด', empty: 'ยังไม่มีภาพ', view: 'ภาพ', close: 'ปิด',
      del: 'ลบ', again: 'สร้างซ้ำแบบนี้', download: 'ดาวน์โหลด',
      used: 'ใช้ไป <b>{used}</b> · เหลือ <b>{left}</b> / {limit}', working: 'กำลังสร้าง {n}/{total}',
      needPrompt: 'พิมพ์คำสั่งก่อน', unavailable: 'สร้างภาพได้เฉพาะบน pages.dev', quotaFull: 'โควตา AI ฟรีของวันนี้เต็มแล้ว (รีเซ็ต 07:00 น. เวลาไทย)', failed: 'ผิดพลาด',
      made: 'สร้างภาพแล้ว {n} ภาพ', madeStop: 'สร้างได้ {n} ภาพ แล้วหยุด: ', confirmDel: 'ลบภาพนี้?', deleted: 'ลบภาพแล้ว',
      delFail: 'ลบไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองใหม่',
      edit: 'แก้ภาพนี้', refLabel: 'ภาพอ้างอิง', refRemove: 'เอาภาพอ้างอิงออก',
      refLoad: 'โหลดภาพอ้างอิงไม่ได้ — เปิดภาพนั้นแล้วลองใหม่', refType: 'ภาพอ้างอิงต้องเป็น PNG หรือ JPEG', refSize: 'ภาพอ้างอิงใหญ่เกิน {n}px',
      refBytes: 'ภาพอ้างอิงใหญ่เกิน 1 MB', refModel: 'ภาพอ้างอิงใช้ได้กับโมเดลคุณภาพเท่านั้น', refRejected: 'โมเดลไม่รับภาพอ้างอิงนี้',
      recent: 'prompt ล่าสุด', seedRemove: 'เอา seed ออก', ratio: 'สัดส่วนภาพ', copy: 'คัดลอก prompt', copied: 'คัดลอก prompt แล้ว', copyFail: 'คัดลอกไม่สำเร็จ',
      queued: 'รอคิว', retry: 'ลองใหม่',
      transparent: 'พื้นโปร่ง', cutout: 'ลบพื้นหลัง', preview: 'ตัวอย่างผล', tolerance: 'ค่าความต่างสี', soft: 'ขอบนุ่ม', cancel: 'ยกเลิก', saveNew: 'บันทึกเป็นภาพใหม่',
      modelDl: 'โหลดโมเดลลบพื้นหลัง', mb: '{a} / {b} MB', cutReading: 'กำลังอ่านภาพ…', cutPreparing: 'กำลังเตรียมโมเดล…', cutWorking: 'กำลังลบพื้นหลัง…',
      noBg: 'ไม่พบพื้นสีเรียบที่มุมภาพ — เพิ่มค่าความต่างสี', allGone: 'ทั้งภาพถูกลบ — ลดค่าความต่างสี',
      cutNone: 'ไม่พบพื้นหลังที่ลบได้ในภาพนี้', cutEmpty: 'ไม่พบวัตถุในภาพนี้', srcLoad: 'โหลดภาพนี้ไม่ได้ — ตรวจการเชื่อมต่อแล้วลองใหม่',
      cutMissing: 'ไม่พบไฟล์โมเดลลบพื้นหลังบนเซิร์ฟเวอร์', cutNetwork: 'โหลดโมเดลลบพื้นหลังไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วลองใหม่',
      cutMemory: 'หน่วยความจำของเบราว์เซอร์ไม่พอ — ปิดแท็บอื่นแล้วลองใหม่', cutFail: 'ลบพื้นหลังไม่สำเร็จ — ลองใหม่อีกครั้ง',
      saveFail: 'บันทึกไม่สำเร็จ — ตรวจการเชื่อมต่อแล้วลองใหม่', savedNew: 'บันทึกเป็นภาพใหม่แล้ว'
    },
    en: {
      title: 'Image generator', quota: 'AI quota today', prompt: 'Prompt', preset: 'Type', mode: 'Mode', model: 'Model', count: 'Count',
      pBackground: 'Background', pIcon: 'Icon', pFree: 'Free', mLight: 'Light', mDark: 'Dark', mBoth: 'Both', fast: 'Fast', quality: 'Quality',
      translate: 'Translate to English', generate: 'Generate', library: 'Gallery', filter: 'Filter', fAll: 'All', empty: 'No images yet', view: 'Image', close: 'Close',
      del: 'Delete', again: 'Generate again', download: 'Download',
      used: 'Used <b>{used}</b> · <b>{left}</b> left / {limit}', working: 'Generating {n}/{total}',
      needPrompt: 'Enter a prompt first', unavailable: 'Image generation is only available on pages.dev', quotaFull: 'Today\'s free AI quota is used up (resets at 07:00 Thai time)', failed: 'Something went wrong',
      made: 'Generated {n} image(s)', madeStop: 'Generated {n} image(s), then stopped: ', confirmDel: 'Delete this image?', deleted: 'Image deleted',
      delFail: 'Could not delete. Check your connection and try again',
      edit: 'Edit this image', refLabel: 'Reference image', refRemove: 'Remove reference image',
      refLoad: 'Could not load the reference image. Open it again and retry', refType: 'The reference image must be PNG or JPEG', refSize: 'The reference image is larger than {n}px',
      refBytes: 'The reference image is larger than 1 MB', refModel: 'Reference images only work with the Quality model', refRejected: 'The image model rejected the reference image',
      recent: 'Recent prompts', seedRemove: 'Remove seed', ratio: 'Aspect ratio', copy: 'Copy prompt', copied: 'Prompt copied', copyFail: 'Could not copy',
      queued: 'Queued', retry: 'Retry',
      transparent: 'Transparent', cutout: 'Remove background', preview: 'Result preview', tolerance: 'Color tolerance', soft: 'Soft edges', cancel: 'Cancel', saveNew: 'Save as new image',
      modelDl: 'Downloading the background model', mb: '{a} / {b} MB', cutReading: 'Reading the image…', cutPreparing: 'Preparing the model…', cutWorking: 'Removing the background…',
      noBg: 'No plain background found at the corners. Raise the color tolerance', allGone: 'The whole image was removed. Lower the color tolerance',
      cutNone: 'No background to remove was found in this image', cutEmpty: 'No subject was found in this image', srcLoad: 'Could not load this image. Check your connection and try again',
      cutMissing: 'The background model files were not found on the server', cutNetwork: 'Could not download the background model. Check your connection and try again',
      cutMemory: 'The browser ran out of memory. Close other tabs and try again', cutFail: 'Could not remove the background. Try again',
      saveFail: 'Could not save. Check your connection and try again', savedNew: 'Saved as a new image'
    }
  });
  var PRESET_KEY = { background: 'pBackground', icon: 'pIcon', free: 'pFree' };
  var MODE_KEY = { light: 'mLight', dark: 'mDark' };
  var MODEL_KEY = { fast: 'fast', quality: 'quality' };
  var KIND_KEY = { transparent: 'transparent', cutout: 'cutout' };
  var kindName = function (k) { return KIND_KEY[k] ? T(KIND_KEY[k]) : ''; };
  var presetName = function (k) { return PRESET_KEY[k] ? T(PRESET_KEY[k]) : ''; };
  var modeName = function (k) { return MODE_KEY[k] ? T(MODE_KEY[k]) : ''; };
  var lastUsage = null, progress = null;
  var state = { preset: 'background', mode: 'light', model: 'fast', count: 1, filter: 'all', ratio: '1:1', busy: false, openId: null, ref: null, prevModel: null, seed: null, pending: [] };
  var seq = 0, recentList = [], recentInit = false;

  function $(id) { return document.getElementById(id); }
  function icon(n) { return '<svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-' + n + '"/></svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fileUrl(id, dl) { return '/api/files?id=' + encodeURIComponent(id) + (dl ? '&download=1' : ''); }

  /* ── storage ── */
  function readItems() {
    var a = TD ? TD.read(K.items, []) : [];
    return Array.isArray(a) ? a : [];
  }
  function addItem(row) {
    TD.update(K.items, function (a) {
      a = Array.isArray(a) ? a : [];
      return a.filter(function (x) { return x && x.id !== row.id; }).concat([row]);
    });
  }
  function removeItem(id) {
    TD.update(K.items, function (a) { return (Array.isArray(a) ? a : []).filter(function (x) { return x && x.id !== id; }); });
  }
  function loadUi() {
    try {
      var u = JSON.parse(localStorage.getItem(K.ui) || '{}') || {};
      if (['background', 'icon', 'free'].indexOf(u.preset) >= 0) state.preset = u.preset;
      if (['light', 'dark', 'both'].indexOf(u.mode) >= 0) state.mode = u.mode;
      if (u.model === 'fast' || u.model === 'quality') state.model = u.model;
      if (u.count >= 1 && u.count <= 4) state.count = u.count | 0;
      if (['all', 'background', 'icon', 'free'].indexOf(u.filter) >= 0) state.filter = u.filter;
      if (C.RATIOS.some(function (r) { return r.id === u.ratio; })) state.ratio = u.ratio;
    } catch (e) {}
  }
  function saveUi() {
    try { localStorage.setItem(K.ui, JSON.stringify({ preset: state.preset, mode: state.mode, model: state.ref ? state.prevModel : state.model, count: state.count, filter: state.filter, ratio: state.ratio })); } catch (e) {}
  }

  /* ── toast ── */
  function toast(msg, kind, hostId) { /* msg = ข้อความ หรือฟังก์ชันที่คืนข้อความตามภาษาปัจจุบัน (แปลสดตอนสลับภาษา) · hostId = กล่อง toast ใน dialog (dialog แบบ modal ทับ toast ของหน้า) */
    var box = $(hostId || 'toasts');
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.innerHTML = (kind === 'err' ? icon('circle-alert') : '') + '<span></span>';
    OME_I18N.live(t.lastChild, typeof msg === 'function' ? msg : function () { return msg; });
    box.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 5000);
  }
  var REF_ERR = { ref_model: 'refModel', ref_type: 'refType', ref_size: 'refSize', ref_bytes: 'refBytes', refLoad: 'refLoad' };
  function errText(e) {
    if (e && REF_ERR[e.code]) return T(REF_ERR[e.code], { n: REF_MAX });
    if (e && e.code === 'upstream' && e.detail) return T('refRejected') + ' (' + e.detail + ')';
    if (e && e.code === 'quota') return T('quotaFull');
    if (e && e.code === 'unavailable') return T('unavailable');
    return AI ? AI.friendlyMessage(e) : T('failed');
  }

  /* ── ปุ่มตัวเลือก ── */
  function syncSeg(id, val) {
    Array.prototype.forEach.call($(id).querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === String(val)));
    });
  }
  function renderControls() {
    syncSeg('preset', state.preset); syncSeg('mode', state.mode); syncSeg('model', state.model);
    syncSeg('count', state.count); syncSeg('filter', state.filter);
    $('modeBox').hidden = state.preset !== 'background';
    // มีภาพอ้างอิง = ล็อกโมเดล "คุณภาพ" (schnell ไม่รับภาพขาเข้า)
    $('model').querySelector('button[data-v="fast"]').disabled = !!state.ref;
    $('refBox').hidden = !state.ref;
    var seedOn = state.model === 'quality' && state.seed != null;
    $('seedBox').hidden = !seedOn;
    if (seedOn) $('seedTxt').textContent = 'seed ' + state.seed;
    $('chips').hidden = !state.ref && !seedOn;
    $('seedDel').disabled = state.busy;
    $('ratioBox').hidden = !(state.preset === 'free' && state.model === 'quality');
    syncSeg('ratio', state.ratio);
    $('refDel').disabled = state.busy;
    $('genBtn').disabled = state.busy;
    $('trBtn').disabled = state.busy;
  }
  function bindSeg(id, key, num) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]');
      if (!b || b.disabled || state.busy && id !== 'filter') return;
      var v = b.getAttribute('data-v');
      state[key] = num ? Number(v) : v;
      saveUi(); renderControls();
      if (key === 'filter') renderGrid();
    });
  }

  /* ── โควตา ── */
  function num(n) { return OME_I18N.number(Number(n) || 0, { maximumFractionDigits: 0 }); }
  function paintQuota() {
    var u = lastUsage;
    if (u) $('quotaTxt').innerHTML = T('used', { used: num(u.used), left: num(u.remaining), limit: num(u.limit) });
  }
  function loadQuota() {
    if (!AI || !AI.available()) { $('quotaTxt').innerHTML = '<b>–</b>'; return Promise.resolve(); }
    return AI.usage().then(function (u) {
      var pct = u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
      lastUsage = u; paintQuota();
      var bar = $('quotaBar');
      bar.className = 'ig-bar' + (pct >= 100 ? ' err' : pct >= 80 ? ' warn' : '');
      bar.firstElementChild.style.width = pct + '%';
    }).catch(function () { /* โควตาโหลดไม่ได้ไม่ต้องรบกวนผู้ใช้ — แถบคงค่าเดิม */ });
  }

  /* ── แปลเป็นอังกฤษ ── */
  function translate() {
    var text = $('prompt').value.trim();
    if (!text) { toast(function () { return T('needPrompt'); }, 'err'); return; }
    if (!AI || !AI.available()) { toast(function () { return errText({ code: 'unavailable' }); }, 'err'); return; }
    state.busy = true; renderControls();
    AI.chat({
      model: 'fast', maxTokens: 400, temperature: 0.2,
      messages: [
        { role: 'system', content: 'You translate image-generation prompts into natural English. Output only the English translation, no quotes, no notes.' },
        { role: 'user', content: text }
      ]
    }).then(function (r) {
      var out = String(r.text || '').trim().replace(/^["“]+|["”]+$/g, '');
      if (out) $('prompt').value = out.slice(0, 1500);
      loadQuota();
    }).catch(function (e) { toast(function () { return errText(e); }, 'err'); })
      .then(function () { state.busy = false; renderControls(); });
  }

  /* ── ภาพอ้างอิง ("แก้ภาพนี้") ── */
  function setRef(id) {
    if (!state.ref) state.prevModel = state.model;
    state.ref = { id: id };
    state.model = 'quality';
    $('refImg').src = fileUrl(id);
    renderControls();
  }
  function clearRef() {
    if (!state.ref) return;
    state.model = state.prevModel || state.model;
    state.ref = null; state.prevModel = null;
    $('refImg').removeAttribute('src');
    saveUi(); renderControls();
  }
  /* ดึงภาพ (same-origin) → ย่อด้านยาว ≤ REF_MAX (ไม่ขยาย) → PNG base64 · เกิน 1 MB (ไม่น่าเกิดที่ 512px) ใช้ JPEG แทน */
  function refFail() { var e = new Error('ref'); e.code = 'refLoad'; return e; }
  function loadRef(id) {
    return fetch(fileUrl(id), { credentials: 'same-origin', redirect: 'manual' }).then(function (res) {
      if (!res.ok) throw refFail();
      return res.blob();
    }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(blob), img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(refFail()); };
        img.src = url;
      });
    }).then(function (img) {
      var w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) throw refFail();
      var k = Math.min(1, REF_MAX / Math.max(w, h));
      var cw = Math.max(1, Math.min(REF_MAX, Math.round(w * k))), ch = Math.max(1, Math.min(REF_MAX, Math.round(h * k)));
      var c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      c.getContext('2d').drawImage(img, 0, 0, cw, ch);
      var b64 = c.toDataURL('image/png').split(',')[1] || '';
      if (b64.length * 3 / 4 > 1024 * 1024) b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1] || '';
      if (!b64) throw refFail();
      return b64;
    }, function (e) { throw e && e.code ? e : refFail(); });
  }

  /* ── สร้างภาพ ── */
  function modesOf() { return state.preset !== 'background' ? ['light'] : state.mode === 'both' ? ['light', 'dark'] : [state.mode]; }
  function pendingOf(key) {
    for (var i = 0; i < state.pending.length; i++) if (state.pending[i].key === key) return state.pending[i];
    return null;
  }
  function dropPending(key) { state.pending = state.pending.filter(function (j) { return j.key !== key; }); }
  /* 1 งาน = 1 ภาพ · ctx.refP = ภาพอ้างอิงที่โหลดแล้วของชุดนี้ (ย่อครั้งเดียว) */
  function runJob(job, ctx) {
    var refP = job.refId ? (ctx.refP || (ctx.refP = loadRef(job.refId))) : Promise.resolve(null);
    return refP.then(function (ref) {
      var opts = { prompt: job.prompt, preset: job.preset, mode: job.mode, model: job.model };
      if (job.ratio) opts.ratio = job.ratio;
      if (job.seed != null) opts.seed = job.seed;
      if (ref) opts.ref = ref;
      return AI.image(opts);
    }).then(function (r) {
      var row = {
        id: r.id, preset: r.preset, mode: r.preset === 'background' ? r.mode : null, model: job.model, modelId: r.model, seed: r.seed,
        prompt: job.prompt, fullPrompt: r.prompt, name: r.name, mime: r.mime, w: r.width, h: r.height, createdAt: Date.now()
      };
      if (job.refId) row.refId = job.refId;
      addItem(row);
      return r;
    });
  }
  function generate() {
    var prompt = $('prompt').value.trim();
    if (!prompt) { toast(function () { return T('needPrompt'); }, 'err'); return; }
    if (!AI || !AI.available()) { toast(function () { return errText({ code: 'unavailable' }); }, 'err'); return; }
    var refId = state.ref ? state.ref.id : null, model = refId ? 'quality' : state.model;
    var ratio = state.preset === 'free' && model === 'quality' ? state.ratio : null;
    var seed = model === 'quality' ? state.seed : null;
    var list = [], done = 0, ctx = {};
    for (var rep = 0; rep < state.count; rep++) modesOf().forEach(function (m) {
      var j = { key: ++seq, prompt: prompt, preset: state.preset, mode: m, model: model, ratio: ratio, seed: rep === 0 ? seed : null, refId: refId, status: 'queued', err: null };
      list.push(j); state.pending.push(j);
    });
    progress = null;
    state.busy = true; renderControls(); renderGrid();
    function next(i) {
      if (i >= list.length) return Promise.resolve();
      var job = list[i];
      job.status = 'busy'; job.n = i + 1; job.total = list.length;
      progress = { n: job.n, total: job.total };
      $('genTxt').textContent = T('working', progress);
      renderGrid();
      return runJob(job, ctx).then(function () {
        done++; dropPending(job.key); renderGrid();
        return loadQuota().then(function () { return next(i + 1); });
      }, function (e) {
        job.status = 'err'; job.err = e;
        list.slice(i + 1).forEach(function (q) { dropPending(q.key); }); // ที่เหลือในคิวไม่ถูกสร้าง — ลองใหม่ได้เฉพาะภาพที่ล้ม
        renderGrid();
        throw e;
      });
    }
    next(0).then(function () {
      toast(function () { return T('made', { n: done }); }, 'ok');
    }, function (e) {
      toast(function () { return (done ? T('madeStop', { n: done }) : '') + errText(e); }, 'err');
      loadQuota();
    }).then(function () {
      state.busy = false; progress = null; $('genTxt').textContent = T('generate'); renderControls(); renderGrid();
    });
  }
  function retry(key) {
    var job = pendingOf(key);
    if (!job || job.status !== 'err' || state.busy) return;
    job.status = 'busy'; job.err = null; job.n = 1; job.total = 1;
    state.busy = true; renderControls(); renderGrid();
    runJob(job, {}).then(function () {
      dropPending(key);
      toast(function () { return T('made', { n: 1 }); }, 'ok');
      return loadQuota();
    }, function (e) {
      job.status = 'err'; job.err = e;
      toast(function () { return errText(e); }, 'err');
      loadQuota();
    }).then(function () { state.busy = false; renderControls(); renderGrid(); });
  }

  /* ── คลังภาพ ── */
  function sorted() {
    return readItems().filter(function (x) { return x && x.id; })
      .filter(function (x) { return state.filter === 'all' || x.preset === state.filter; })
      .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  }
  function renderGrid() {
    var items = sorted();
    $('empty').hidden = items.length > 0 || state.pending.length > 0;
    $('grid').innerHTML = state.pending.map(cardHtml).join('') + items.map(function (x) {
      var kn = kindName(x.kind);
      return '<button type="button" class="btn ig-item" data-id="' + esc(x.id) + '"' + (kn ? ' data-kind="' + esc(x.kind) + '"' : '') + ' aria-label="' + esc(presetName(x.preset)) + (kn ? ' · ' + esc(kn) : '') + ' ' + esc(x.prompt || '') + '">' +
        '<img loading="lazy" alt="" src="' + fileUrl(x.id) + '"><span class="badge">' + esc(presetName(x.preset) || x.preset) + (x.mode ? ' · ' + esc(modeName(x.mode)) : '') + (kn ? ' · ' + esc(kn) : '') + '</span></button>';
    }).join('');
    renderRecent();
    if (state.openId && !readItems().some(function (x) { return x && x.id === state.openId; })) closeView();
    if (state.ref && !state.busy && !findItem(state.ref.id)) clearRef(); // ภาพอ้างอิงถูกลบ (เครื่องนี้หรือเครื่องอื่น)
  }
  function cardHtml(j) {
    if (j.status === 'err') {
      return '<div class="ig-fail" data-key="' + j.key + '"><div class="ig-fail-msg">' + icon('circle-alert') + '<span>' + esc(errText(j.err)) + '</span></div>' +
        '<div class="ig-fail-acts"><button type="button" class="btn sm" data-act="retry" data-key="' + j.key + '"' + (state.busy ? ' disabled' : '') + '>' + icon('rotate-ccw') + '<span>' + esc(T('retry')) + '</span></button>' +
        '<button type="button" class="btn sm ghost" data-act="dismiss" data-key="' + j.key + '"><span>' + esc(T('close')) + '</span></button></div></div>';
    }
    var txt = j.status === 'busy' ? T('working', { n: j.n, total: j.total }) : T('queued');
    return '<div class="ig-pend" role="group" aria-busy="true" aria-label="' + esc(txt) + '"><i class="ig-skel"></i><i class="ig-skel s"></i><span>' + esc(txt) + '</span></div>';
  }
  function renderRecent() {
    recentList = C.recentPrompts(readItems());
    $('recentBox').hidden = !recentList.length;
    if (!recentInit && recentList.length) { recentInit = true; $('recentBox').open = !(window.matchMedia && matchMedia('(max-width:700px)').matches); } // จอแคบพับไว้ (6 แถว ยาวเกิน)
    $('recent').innerHTML = recentList.map(function (p, i) {
      return '<li><button type="button" class="btn ghost ig-rp" data-i="' + i + '" title="' + esc(p) + '"><span>' + esc(p) + '</span></button></li>';
    }).join('');
  }
  function findItem(id) {
    var a = readItems();
    for (var i = 0; i < a.length; i++) if (a[i] && a[i].id === id) return a[i];
    return null;
  }
  function paintMeta(x) {
    var d = new Date(x.createdAt || 0);
    $('vMeta').textContent = [presetName(x.preset), x.mode ? modeName(x.mode) : '', kindName(x.kind), MODEL_KEY[x.model] ? T(MODEL_KEY[x.model]) : '', x.w && x.h ? x.w + '×' + x.h : '',
      'seed ' + (x.seed == null ? '–' : x.seed), isNaN(d) ? '' : OME_I18N.date(d, { dateStyle: 'medium', timeStyle: 'short' })].filter(Boolean).join(' · ');
  }
  function openView(id) {
    var x = findItem(id);
    if (!x) return;
    state.openId = id;
    $('vImg').src = fileUrl(id);
    $('vImg').alt = x.prompt || '';
    $('vPrompt').textContent = x.fullPrompt || x.prompt || '';
    paintMeta(x);
    var canCut = filesOn() && !!window.TanotCutout;
    $('vCutActs').hidden = !canCut;
    $('vTrans').className = 'btn' + (x.preset === 'icon' ? '' : ' ghost'); // ไอคอน (พื้นสีเรียบตาม preset) = ปุ่มเด่น · ภาพอื่นใช้ได้แต่ไม่เด่น
    $('vCutout').hidden = isMobile();
    $('vDl').href = fileUrl(id, true);
    $('vDl').setAttribute('download', x.name || 'image');
    var dlg = $('view');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function closeView() {
    state.openId = null;
    var dlg = $('view');
    if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
  }
  function again() {
    var x = findItem(state.openId);
    if (!x) return;
    $('prompt').value = x.prompt || '';
    if (PRESET_KEY[x.preset]) state.preset = x.preset;
    if (x.mode) state.mode = x.mode;
    if (x.model === 'fast' || x.model === 'quality') state.model = x.model;
    if (x.preset === 'free' && C.ratioOf(x.w, x.h)) state.ratio = C.ratioOf(x.w, x.h);
    if (x.refId && findItem(x.refId)) { state.ref = null; setRef(x.refId); } else { state.ref = null; state.prevModel = null; }
    state.seed = state.model === 'quality' && Number.isInteger(x.seed) ? x.seed : null; // fast ไม่มี seed
    saveUi(); renderControls(); closeView();
    $('prompt').focus();
  }
  function edit() {
    var x = findItem(state.openId);
    if (!x) return;
    $('prompt').value = '';
    if (PRESET_KEY[x.preset]) state.preset = x.preset;
    if (x.mode) state.mode = x.mode;
    setRef(x.id);
    state.seed = null; renderControls();
    saveUi(); closeView();
    $('prompt').focus();
  }
  function copyPrompt() {
    var x = findItem(state.openId);
    if (!x) return;
    var txt = x.prompt || x.fullPrompt || '';
    var p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject(new Error('no clipboard'));
    p.then(function () { toast(function () { return T('copied'); }, 'ok', 'vToasts'); },
      function () { toast(function () { return T('copyFail'); }, 'err', 'vToasts'); });
  }
  function del() {
    var id = state.openId, x = findItem(id);
    if (!x) return;
    window.tanotConfirm(T('confirmDel'), { okLabel: T('del'), danger: true }).then(function (ok) {
      if (!ok) return;
      fetch(fileUrl(id), { method: 'DELETE', credentials: 'same-origin', redirect: 'manual' }).then(function (res) {
        // 404 = ไฟล์หายไปแล้ว (ลบจากอีกเครื่อง) — ลบรายการต่อได้ · ข้อผิดพลาดอื่นเก็บรายการไว้ไม่ให้เหลือไฟล์กำพร้าใน R2
        if (!res.ok && res.status !== 404) throw new Error('HTTP ' + res.status);
        removeItem(id); closeView(); renderGrid();
        toast(function () { return T('deleted'); }, 'ok');
      }).catch(function () { toast(function () { return T('delFail'); }, 'err'); });
    });
  }

  /* ── พื้นโปร่ง / ลบพื้นหลัง ── */
  function filesOn() {
    try { if (window.TANOT_FILES) return !!window.TANOT_FILES.enabled; return /\.pages\.dev$/.test(location.hostname); } catch (e) { return false; }
  }
  function isMobile() { return !!(window.TanotMedia && TanotMedia.isMobile && TanotMedia.isMobile()); }
  var cut = null, cutSeq = 0, floodW = null, bgW = null, bgBusy = false, tolTimer = 0;
  var MODEL_ID = function () { return window.TanotCutout ? TanotCutout.BG_MODEL.id : ''; };
  function cutLive(id, fn) { OME_I18N.live($(id), fn); }
  function cutStatus(key) { cutLive('cStatus', key ? function () { return T(key); } : function () { return ''; }); }
  function cutError(key) { cutLive('cMsg', key ? function () { return T(key); } : function () { return ''; }); }
  function fetchBlob(id) {
    return fetch(fileUrl(id), { credentials: 'same-origin', redirect: 'manual' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.blob();
    });
  }
  function openCut(mode) {
    var x = findItem(state.openId);
    if (!x || !window.TanotCutout) return;
    closeView();
    cut = { mode: mode, src: x, id: ++cutSeq, seq: 0, ready: false, w: 0, h: 0, pixels: null, saving: false };
    $('cTitle').textContent = T(mode === 'transparent' ? 'transparent' : 'cutout');
    $('cTolBox').hidden = $('cSoftBox').hidden = mode !== 'transparent';
    $('cTol').value = String(TanotCutout.DEFAULT_TOLERANCE); $('cTolOut').textContent = $('cTol').value;
    $('cSoft').checked = true;
    $('cBar').hidden = true; $('cRetry').hidden = true;
    var c = $('cCanvas'); c.width = 1; c.height = 1;
    cutError(null); cutStatus('cutReading'); paintSave();
    var dlg = $('cut');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    startCut();
  }
  function startCut() {
    var job = cut;
    cutError(null); $('cRetry').hidden = true;
    fetchBlob(job.src.id).then(function (blob) {
      if (cut !== job) return;
      job.blob = blob;
      if (job.mode === 'transparent') floodLoad(job); else bgRun(job);
    }, function () {
      if (cut !== job) return;
      cutStatus(null); cutError('srcLoad'); $('cRetry').hidden = false;
    });
  }
  function paintSave() { $('cSave').disabled = !cut || !cut.ready || cut.saving; }
  function paintResult(job, data, w, h, kept, removed) {
    if (cut !== job) return;
    var c = $('cCanvas');
    c.width = w; c.height = h;
    c.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
    job.w = w; job.h = h;
    job.ready = kept > 0 && removed > 0;
    var flood = job.mode === 'transparent';
    cutStatus(kept === 0 ? (flood ? 'allGone' : 'cutEmpty') : removed === 0 ? (flood ? 'noBg' : 'cutNone') : null);
    paintSave();
  }
  /* พื้นโปร่ง: Worker ถอดภาพ + เก็บพิกเซลไว้ (เลื่อนแถบแล้วส่งแค่ค่า) · ไม่มี Worker/OffscreenCanvas = เธรดหลัก */
  function canFloodWorker() { return typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function'; }
  function floodWorker() {
    if (floodW) return floodW;
    floodW = new Worker('image-cutout-worker.js');
    floodW.onmessage = function (e) {
      var m = e.data || {}, job = cut;
      if (!job || m.id !== job.id) return;
      if (m.type === 'loaded') { job.loaded = true; runFlood(); }
      else if (m.type === 'result') { if (m.seq === job.seq) paintResult(job, m.data, m.w, m.h, m.kept, m.removed); }
      else if (m.type === 'error') { cutStatus(null); cutError('srcLoad'); $('cRetry').hidden = false; }
    };
    floodW.onerror = function () { floodW = null; if (cut) { cutStatus(null); cutError('srcLoad'); $('cRetry').hidden = false; } };
    return floodW;
  }
  function floodLoad(job) {
    if (canFloodWorker()) {
      try { floodWorker().postMessage({ type: 'load', id: job.id, blob: job.blob }); return; } catch (e) { floodW = null; }
    }
    var url = URL.createObjectURL(job.blob), im = new Image();
    im.onload = function () {
      URL.revokeObjectURL(url);
      if (cut !== job) return;
      var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      var g = c.getContext('2d'); g.drawImage(im, 0, 0);
      job.pixels = { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data };
      job.loaded = true; runFlood();
    };
    im.onerror = function () { URL.revokeObjectURL(url); if (cut === job) { cutStatus(null); cutError('srcLoad'); $('cRetry').hidden = false; } };
    im.src = url;
  }
  function runFlood() {
    var job = cut;
    if (!job || job.mode !== 'transparent' || !job.loaded) return;
    var seq = ++job.seq, tol = Number($('cTol').value), soft = $('cSoft').checked;
    job.ready = false; paintSave();
    if (!job.pixels) { floodWorker().postMessage({ type: 'flood', id: job.id, seq: seq, tolerance: tol, soft: soft }); return; }
    setTimeout(function () { // yield ให้หน้าวาดก่อนคำนวณบนเธรดหลัก
      if (cut !== job || job.seq !== seq) return;
      var px = job.pixels, r = TanotCutout.floodTransparent(px.data, px.w, px.h, { tolerance: tol, soft: soft });
      paintResult(job, r.data, px.w, px.h, r.kept, r.removed);
    }, 16);
  }
  /* ลบพื้นหลัง: Module Worker + transformers.js */
  function killBg() {
    if (bgW) { try { bgW.terminate(); } catch (e) {} }
    bgW = null; bgBusy = false;
    if (window.TanotMedia) TanotMedia.budget.release('cutout');
  }
  function mb(n) { return OME_I18N.number((n || 0) / 1e6, { maximumFractionDigits: 0 }); }
  function bgFail(job, code, ctx) {
    var key = code === 'missing' ? 'cutMissing' : code === 'network' ? 'cutNetwork' : code === 'memory' ? 'cutMemory' : code === 'session' ? null : 'cutFail';
    if (code === 'memory' || code === 'crash') killBg(); // หน่วยความจำ WASM หดไม่ได้ — ครั้งหน้าสร้าง Worker ใหม่
    bgBusy = false;
    if (cut !== job) return;
    $('cBar').hidden = true; cutStatus(null);
    if (key) cutError(key); else cutLive('cMsg', function () { return window.TanotMedia ? TanotMedia.errorText({ code: 'session', name: 'SessionError' }) : T('cutFail'); });
    $('cRetry').hidden = false;
  }
  function bgWorker() {
    if (bgW) return bgW;
    if (window.TanotMedia) TanotMedia.budget.acquire('cutout', function () { if (bgW) { try { bgW.terminate(); } catch (e) {} } bgW = null; if (bgBusy && cut) bgFail(cut, 'evicted'); });
    bgW = new Worker('image-bgremove-worker.js', { type: 'module' });
    bgW.onmessage = function (e) {
      var m = e.data || {}, job = cut, TM = window.TanotMedia;
      var ctx = { engine: 'local', model: MODEL_ID(), device: job && job.device || '' };
      if (m.type === 'fallback') {
        if (TM) TM.logError('image', { name: m.name, message: m.message }, { stage: 'cutout-webgpu-' + m.stage, engine: 'local', model: MODEL_ID(), device: 'webgpu' });
        if (job) job.device = 'wasm';
        return;
      }
      if (m.type === 'retry') { if (TM) TM.logNote('image', { stage: 'load-retry', engine: 'local', model: MODEL_ID() }, 'retry=1 network'); return; }
      if (!job || m.id !== job.id) return;
      if (m.type === 'progress') {
        $('cBar').hidden = false;
        var pct = m.total ? Math.min(100, Math.round(m.loaded / m.total * 100)) : 0;
        $('cBarMeter').firstElementChild.style.width = pct + '%';
        $('cBarMeter').setAttribute('aria-valuenow', String(pct));
        cutLive('cBarVal', function () { return T('mb', { a: mb(m.loaded), b: mb(m.total) }); });
        cutStatus(pct >= 100 ? 'cutWorking' : null);
      } else if (m.type === 'result') {
        bgBusy = false;
        $('cBar').hidden = true;
        var kept = 0, d = m.data;
        for (var i = 3; i < d.length; i += 4) if (d[i] > 0) kept++;
        paintResult(job, d, m.w, m.h, kept, m.w * m.h - kept);
      } else if (m.type === 'error') {
        ctx.stage = 'cutout-' + (m.stage || 'load');
        if (TM) TM.logError('image', { name: m.name, message: m.message }, ctx);
        bgFail(job, m.code, ctx);
      }
    };
    bgW.onerror = function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      var job = cut;
      if (window.TanotMedia) TanotMedia.logError('image', { name: 'WorkerError', message: 'worker crashed' }, { stage: 'cutout-crash', engine: 'local', model: MODEL_ID(), device: job && job.device || '' });
      killBg();
      if (job) bgFail(job, 'crash');
    };
    return bgW;
  }
  function bgRun(job) {
    cutStatus('cutPreparing');
    var TM = window.TanotMedia;
    var plan = TM && TM.webgpuPlan ? TM.webgpuPlan() : Promise.resolve({ ok: false, f16: false });
    plan.then(function (p) {
      if (cut !== job) return;
      job.device = p.ok ? 'webgpu' : 'wasm';
      var w;
      try { w = bgWorker(); } catch (e) {
        if (TM) TM.logError('image', e, { stage: 'cutout-worker', engine: 'local', model: MODEL_ID() });
        return bgFail(job, 'other');
      }
      bgBusy = true;
      w.postMessage({ type: 'run', id: job.id, blob: job.blob, device: job.device, f16: !!p.f16 });
    });
  }
  function closeCut() {
    var dlg = $('cut');
    if (dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  }
  function onCutClosed() {
    if (bgBusy) killBg(); // ยกเลิกระหว่างโหลด/รันโมเดล — WASM หยุดกลางทางได้ทางเดียวคือ terminate
    cut = null; clearTimeout(tolTimer);
  }
  function baseName(n) { return String(n || 'image').replace(/\.[a-z0-9]{2,5}$/i, '').slice(0, 80) || 'image'; }
  function saveCut() {
    var job = cut;
    if (!job || !job.ready || job.saving) return;
    job.saving = true; paintSave(); cutError(null);
    var x = job.src, name = baseName(x.name) + '-' + job.mode + '.png';
    new Promise(function (resolve, reject) {
      $('cCanvas').toBlob(function (b) { if (b) resolve(b); else reject(new Error('png')); }, 'image/png');
    }).then(function (blob) {
      return fetch('/api/files?ns=images&ref=' + encodeURIComponent(x.preset || 'free') + '&name=' + encodeURIComponent(name), {
        method: 'POST', body: blob, headers: { 'Content-Type': 'image/png' }, credentials: 'same-origin', redirect: 'manual'
      });
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (f) {
      if (!f || !f.id) throw new Error('bad response');
      var row = {
        id: f.id, preset: x.preset, mode: x.mode || null, model: x.model, modelId: x.modelId, seed: x.seed == null ? null : x.seed,
        prompt: x.prompt || '', fullPrompt: x.fullPrompt || '', name: f.name || name, mime: 'image/png', w: job.w, h: job.h, createdAt: Date.now(),
        srcId: x.id, kind: job.mode
      };
      addItem(row);
      job.saving = false;
      closeCut(); renderGrid();
      toast(function () { return T('savedNew'); }, 'ok');
    }).catch(function () {
      job.saving = false; paintSave();
      if (cut === job) cutError('saveFail');
    });
  }

  function init() {
    loadUi();
    $('prompt').value = '';
    bindSeg('preset', 'preset'); bindSeg('mode', 'mode'); bindSeg('model', 'model'); bindSeg('count', 'count', true); bindSeg('filter', 'filter'); bindSeg('ratio', 'ratio');
    $('genBtn').addEventListener('click', generate);
    $('trBtn').addEventListener('click', translate);
    $('grid').addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]');
      if (a) {
        var key = Number(a.getAttribute('data-key'));
        if (a.getAttribute('data-act') === 'retry') retry(key);
        else { dropPending(key); renderGrid(); }
        return;
      }
      var b = e.target.closest('.ig-item');
      if (b) openView(b.getAttribute('data-id'));
    });
    $('recent').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]');
      if (!b) return;
      $('prompt').value = String(recentList[Number(b.getAttribute('data-i'))] || '').slice(0, 1500);
      $('prompt').focus();
    });
    $('seedDel').addEventListener('click', function () { if (!state.busy) { state.seed = null; renderControls(); $('prompt').focus(); } });
    $('vCopy').addEventListener('click', copyPrompt);
    $('vClose').addEventListener('click', closeView);
    $('vAgain').addEventListener('click', again);
    $('vEdit').addEventListener('click', edit);
    $('refDel').addEventListener('click', function () { if (!state.busy) { clearRef(); $('prompt').focus(); } });
    $('vDel').addEventListener('click', del);
    $('view').addEventListener('close', function () { state.openId = null; });
    $('vTrans').addEventListener('click', function () { openCut('transparent'); });
    $('vCutout').addEventListener('click', function () { openCut('cutout'); });
    $('cClose').addEventListener('click', closeCut);
    $('cCancel').addEventListener('click', closeCut);
    $('cRetry').addEventListener('click', function () { if (cut) startCut(); });
    $('cSave').addEventListener('click', saveCut);
    $('cut').addEventListener('close', onCutClosed);
    $('cTol').addEventListener('input', function () {
      $('cTolOut').textContent = $('cTol').value;
      clearTimeout(tolTimer); tolTimer = setTimeout(runFlood, 120);
    });
    $('cSoft').addEventListener('change', runFlood);
    if (TD && TD.onChange) TD.onChange(function (keys) { if (!keys.length || keys.indexOf(K.items) >= 0) renderGrid(); });
    renderControls(); renderGrid(); loadQuota();
    window.OME_PAGE_LIVE_LANG = true;
    OME_LANG.onChange(function () {
      renderGrid(); paintQuota();
      if (progress) $('genTxt').textContent = T('working', progress);
      if (state.openId) { var x = findItem(state.openId); if (x) paintMeta(x); }
      if (cut) $('cTitle').textContent = T(cut.mode === 'transparent' ? 'transparent' : 'cutout');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
