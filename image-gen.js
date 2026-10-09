/* ══════════════════════════════════════════════════════════════════
   Tanot — สร้างภาพ (image-gen.html)
   สร้างภาพด้วย Workers AI (FLUX) ผ่าน POST /api/ai/image (AiClient.image) — ฝั่งเซิร์ฟเวอร์ต่อท้าย prompt ตาม preset, เก็บภาพลง R2 (ns images)
   ข้อมูลกำกับภาพ 1 ภาพ = 1 แถวใน localStorage['tanot:images:items'] (sync list idField id):
     { id (= id ไฟล์ใน R2), preset, mode, model:'fast'|'quality', modelId, seed|null, prompt (ที่ผู้ใช้พิมพ์), fullPrompt (ที่ส่งเข้าโมเดล),
       name, mime, w, h, createdAt (ms) }
   เขียนด้วย TanotData.update (อ่านสด → แก้ → เขียน) · ตัวกรอง/ค่าที่เลือกล่าสุดอยู่ที่ 'tanot:images:ui' (local)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var TD = window.TanotData, AI = window.AiClient;
  var K = { items: 'tanot:images:items', ui: 'tanot:images:ui' };
  var T = OME_I18N.scope('ig', {
    th: {
      title: 'สร้างภาพ', quota: 'โควตา AI วันนี้', prompt: 'คำสั่ง', preset: 'แบบ', mode: 'โหมด', model: 'โมเดล', count: 'จำนวน',
      pBackground: 'พื้นหลัง', pIcon: 'ไอคอน', pFree: 'อิสระ', mLight: 'สว่าง', mDark: 'มืด', mBoth: 'ทั้งคู่', fast: 'เร็ว', quality: 'คุณภาพ',
      translate: 'แปลเป็นอังกฤษ', generate: 'สร้างภาพ', library: 'คลังภาพ', filter: 'กรอง', fAll: 'ทั้งหมด', empty: 'ยังไม่มีภาพ', view: 'ภาพ', close: 'ปิด',
      del: 'ลบ', again: 'สร้างซ้ำแบบนี้', download: 'ดาวน์โหลด',
      used: 'ใช้ไป <b>{used}</b> · เหลือ <b>{left}</b> / {limit}', working: 'กำลังสร้าง {n}/{total}',
      needPrompt: 'พิมพ์คำสั่งก่อน', unavailable: 'สร้างภาพได้เฉพาะบน pages.dev', quotaFull: 'โควตา AI ฟรีของวันนี้เต็มแล้ว (รีเซ็ต 07:00 น. เวลาไทย)', failed: 'ผิดพลาด',
      made: 'สร้างภาพแล้ว {n} ภาพ', madeStop: 'สร้างได้ {n} ภาพ แล้วหยุด: ', confirmDel: 'ลบภาพนี้?', deleted: 'ลบภาพแล้ว',
      delFail: 'ลบไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองใหม่'
    },
    en: {
      title: 'Image generator', quota: 'AI quota today', prompt: 'Prompt', preset: 'Type', mode: 'Mode', model: 'Model', count: 'Count',
      pBackground: 'Background', pIcon: 'Icon', pFree: 'Free', mLight: 'Light', mDark: 'Dark', mBoth: 'Both', fast: 'Fast', quality: 'Quality',
      translate: 'Translate to English', generate: 'Generate', library: 'Gallery', filter: 'Filter', fAll: 'All', empty: 'No images yet', view: 'Image', close: 'Close',
      del: 'Delete', again: 'Generate again', download: 'Download',
      used: 'Used <b>{used}</b> · <b>{left}</b> left / {limit}', working: 'Generating {n}/{total}',
      needPrompt: 'Enter a prompt first', unavailable: 'Image generation is only available on pages.dev', quotaFull: 'Today\'s free AI quota is used up (resets at 07:00 Thai time)', failed: 'Something went wrong',
      made: 'Generated {n} image(s)', madeStop: 'Generated {n} image(s), then stopped: ', confirmDel: 'Delete this image?', deleted: 'Image deleted',
      delFail: 'Could not delete. Check your connection and try again'
    }
  });
  var PRESET_KEY = { background: 'pBackground', icon: 'pIcon', free: 'pFree' };
  var MODE_KEY = { light: 'mLight', dark: 'mDark' };
  var MODEL_KEY = { fast: 'fast', quality: 'quality' };
  var presetName = function (k) { return PRESET_KEY[k] ? T(PRESET_KEY[k]) : ''; };
  var modeName = function (k) { return MODE_KEY[k] ? T(MODE_KEY[k]) : ''; };
  var lastUsage = null, progress = null;
  var state = { preset: 'background', mode: 'light', model: 'fast', count: 1, filter: 'all', busy: false, openId: null };

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
    } catch (e) {}
  }
  function saveUi() {
    try { localStorage.setItem(K.ui, JSON.stringify({ preset: state.preset, mode: state.mode, model: state.model, count: state.count, filter: state.filter })); } catch (e) {}
  }

  /* ── toast ── */
  function toast(msg, kind) { /* msg = ข้อความ หรือฟังก์ชันที่คืนข้อความตามภาษาปัจจุบัน (แปลสดตอนสลับภาษา) */
    var box = $('toasts');
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.innerHTML = (kind === 'err' ? icon('circle-alert') : '') + '<span></span>';
    OME_I18N.live(t.lastChild, typeof msg === 'function' ? msg : function () { return msg; });
    box.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 5000);
  }
  function errText(e) {
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
    $('genBtn').disabled = state.busy;
    $('trBtn').disabled = state.busy;
  }
  function bindSeg(id, key, num) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]');
      if (!b || state.busy && id !== 'filter') return;
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

  /* ── สร้างภาพ ── */
  function jobs() {
    var modes = state.preset !== 'background' ? ['light'] : state.mode === 'both' ? ['light', 'dark'] : [state.mode];
    var out = [];
    for (var i = 0; i < state.count; i++) modes.forEach(function (m) { out.push(m); });
    return out;
  }
  function generate() {
    var prompt = $('prompt').value.trim();
    if (!prompt) { toast(function () { return T('needPrompt'); }, 'err'); return; }
    if (!AI || !AI.available()) { toast(function () { return errText({ code: 'unavailable' }); }, 'err'); return; }
    var list = jobs(), done = 0;
    progress = null;
    state.busy = true; renderControls();
    function next() {
      if (done >= list.length) return Promise.resolve();
      progress = { n: done + 1, total: list.length };
      $('genTxt').textContent = T('working', progress);
      return AI.image({ prompt: prompt, preset: state.preset, mode: list[done], model: state.model }).then(function (r) {
        addItem({
          id: r.id, preset: r.preset, mode: r.preset === 'background' ? r.mode : null, model: state.model, modelId: r.model, seed: r.seed,
          prompt: prompt, fullPrompt: r.prompt, name: r.name, mime: r.mime, w: r.width, h: r.height, createdAt: Date.now()
        });
        done++;
        renderGrid();
        return loadQuota().then(next);
      });
    }
    next().then(function () {
      toast(function () { return T('made', { n: done }); }, 'ok');
    }, function (e) {
      toast(function () { return (done ? T('madeStop', { n: done }) : '') + errText(e); }, 'err');
      loadQuota();
    }).then(function () {
      state.busy = false; progress = null; $('genTxt').textContent = T('generate'); renderControls();
    });
  }

  /* ── คลังภาพ ── */
  function sorted() {
    return readItems().filter(function (x) { return x && x.id; })
      .filter(function (x) { return state.filter === 'all' || x.preset === state.filter; })
      .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  }
  function renderGrid() {
    var items = sorted();
    $('empty').hidden = items.length > 0;
    $('grid').innerHTML = items.map(function (x) {
      return '<button type="button" class="btn ig-item" data-id="' + esc(x.id) + '" aria-label="' + esc(presetName(x.preset)) + ' ' + esc(x.prompt || '') + '">' +
        '<img loading="lazy" alt="" src="' + fileUrl(x.id) + '"><span class="badge">' + esc(presetName(x.preset) || x.preset) + (x.mode ? ' · ' + esc(modeName(x.mode)) : '') + '</span></button>';
    }).join('');
    if (state.openId && !readItems().some(function (x) { return x && x.id === state.openId; })) closeView();
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
    saveUi(); renderControls(); closeView();
    $('prompt').focus();
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
    bindSeg('preset', 'preset'); bindSeg('mode', 'mode'); bindSeg('model', 'model'); bindSeg('count', 'count', true); bindSeg('filter', 'filter');
    $('genBtn').addEventListener('click', generate);
    $('trBtn').addEventListener('click', translate);
    $('grid').addEventListener('click', function (e) {
      var b = e.target.closest('.ig-item');
      if (b) openView(b.getAttribute('data-id'));
    });
    $('vClose').addEventListener('click', closeView);
    $('vAgain').addEventListener('click', again);
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
