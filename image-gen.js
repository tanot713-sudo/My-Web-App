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
      queued: 'รอคิว', retry: 'ลองใหม่'
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
      queued: 'Queued', retry: 'Retry'
    }
  });
  var PRESET_KEY = { background: 'pBackground', icon: 'pIcon', free: 'pFree' };
  var MODE_KEY = { light: 'mLight', dark: 'mDark' };
  var MODEL_KEY = { fast: 'fast', quality: 'quality' };
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
      return '<button type="button" class="btn ig-item" data-id="' + esc(x.id) + '" aria-label="' + esc(presetName(x.preset)) + ' ' + esc(x.prompt || '') + '">' +
        '<img loading="lazy" alt="" src="' + fileUrl(x.id) + '"><span class="badge">' + esc(presetName(x.preset) || x.preset) + (x.mode ? ' · ' + esc(modeName(x.mode)) : '') + '</span></button>';
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
    $('vMeta').textContent = [presetName(x.preset), x.mode ? modeName(x.mode) : '', MODEL_KEY[x.model] ? T(MODEL_KEY[x.model]) : '', x.w && x.h ? x.w + '×' + x.h : '',
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
    if (TD && TD.onChange) TD.onChange(function (keys) { if (!keys.length || keys.indexOf(K.items) >= 0) renderGrid(); });
    renderControls(); renderGrid(); loadQuota();
    window.OME_PAGE_LIVE_LANG = true;
    OME_LANG.onChange(function () {
      renderGrid(); paintQuota();
      if (progress) $('genTxt').textContent = T('working', progress);
      if (state.openId) { var x = findItem(state.openId); if (x) paintMeta(x); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
