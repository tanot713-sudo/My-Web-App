/* ภาพประกอบคำศัพท์ของหน้าเรียนภาษา (L9 · ROADMAP แถว 31 · docs/languages-design.md L9) — window.TanotLangPics
   ภาพอยู่ใน R2 (ns images) อย่างเดียว: ใช้ได้เฉพาะ *.pages.dev หรือเมื่อเทสต์ตั้ง window.TANOT_FILES = {enabled:true} · ที่อื่น = การ์ดข้อความเหมือนเดิม
   ตรรกะล้วน (ตาราง concept, ตัวล้าง, คิวสร้าง, เกณฑ์โควตา) อยู่ใน LangCalc.pics (lang-calc.js) — ไฟล์นี้มีแต่ส่วนที่แตะเครือข่าย/storage
   คีย์ tanot:lang:pics (sync map concept → {id, status}) เขียนด้วย TanotData.update เท่านั้น (ไม่ถือคีย์ → ไม่เด้งแถบโหลดใหม่)
   สร้างเมื่อเจ้าของกดเท่านั้น (ไม่มี scheduler): AiClient.image({prompt: ชื่อสิ่งของ, preset:'vocab'}) — prompt จริงอยู่ฝั่งเซิร์ฟเวอร์ ส่งข้อความอิสระไม่ได้
   ทุกภาพเริ่มที่ pending · ผ่าน (✓) = ย่อเป็น WebP ≤ 256px แล้วแทนไฟล์เดิม · ไม่ผ่าน/สร้างใหม่ = DELETE ไฟล์ใน R2 */
(function () {
  'use strict';
  var LC = window.LangCalc;
  if (!LC || !LC.pics) return;
  var P = LC.pics, KEY = P.KEY, LP_CACHE = 'tanot-langpics-v1', THUMB = 256;
  var listeners = [];

  function enabled() { return /\.pages\.dev$/.test(location.hostname) || !!(window.TANOT_FILES && window.TANOT_FILES.enabled); }
  function admin() { return enabled() && !!(window.AiClient && window.AiClient.available()); }

  function read() {
    try { return P.clean(window.TanotData ? window.TanotData.read(KEY, {}) : JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return {}; }
  }
  function emit() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); }
  function on(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }
  // entry = {id,status} | null (ลบรายการ — concept กลับไปอยู่ในคิว) · อ่านสด → แก้ → เขียน
  function put(concept, entry) {
    if (!P.known(concept)) return;
    var fn = function (cur) {
      var m = cur && typeof cur === 'object' && !Array.isArray(cur) ? Object.assign({}, cur) : {};
      if (entry) m[concept] = entry; else delete m[concept];
      return m;
    };
    try {
      if (window.TanotData && window.TanotData.update) window.TanotData.update(KEY, fn);
      else localStorage.setItem(KEY, JSON.stringify(fn(JSON.parse(localStorage.getItem(KEY) || '{}'))));
    } catch (e) {}
    emit();
  }
  if (window.TanotData && window.TanotData.onChange) window.TanotData.onChange(function (keys) { if (!keys.length || keys.indexOf(KEY) >= 0) emit(); });

  function del(id) {
    return fetch('/api/files?id=' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' })
      .then(function (r) { return r.ok || r.status === 404; }, function () { return false; });
  }
  function forget(id) {
    try { if (window.caches) caches.open(LP_CACHE).then(function (c) { return c.delete(P.urlOf(id)); }).catch(function () {}); } catch (e) {}
  }

  // สร้าง 1 ภาพ → pending · โยน AiError (code quota/upstream/…) ให้ผู้เรียกตัดสิน
  function generate(concept, signal) {
    var prompt = P.promptOf(concept);
    if (!prompt) return Promise.reject(new Error('concept'));
    return window.AiClient.image({ prompt: prompt, preset: 'vocab', signal: signal }).then(function (r) {
      put(concept, { id: r.id, status: 'pending' });
      return r;
    });
  }

  // ย่อภาพที่ผ่านแล้วเป็น WebP ≤ 256px (~10–20 KB) — Blob หรือ null (ย่อไม่ได้ = ใช้ไฟล์เดิม)
  function shrink(id) {
    return fetch('/api/files?id=' + encodeURIComponent(id), { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('get'); return r.blob(); })
      .then(function (blob) { return createImageBitmap(blob); })
      .then(function (bmp) {
        var k = Math.min(1, THUMB / Math.max(bmp.width, bmp.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        if (bmp.close) bmp.close();
        return new Promise(function (res) { c.toBlob(function (b) { res(b || null); }, 'image/webp', 0.85); });
      })
      .catch(function () { return null; });
  }

  // ✓ ผ่าน: ย่อ → อัปโหลดไฟล์ย่อ → ลบไฟล์เดิม · ขั้นไหนพังก็ยังผ่านด้วยไฟล์เดิม (ไม่ทิ้งภาพที่เจ้าของเพิ่งอนุมัติ)
  function approve(concept, id) {
    var keep = function () { put(concept, { id: id, status: 'ok' }); };
    return shrink(id).then(function (blob) {
      if (!blob || !/^image\//.test(blob.type)) return keep();
      return fetch('/api/files?ns=images&ref=lang-pic&name=' + encodeURIComponent(concept + '.' + (blob.type === 'image/webp' ? 'webp' : 'png')), {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': blob.type }, body: blob
      }).then(function (r) { if (!r.ok) throw new Error('post'); return r.json(); }).then(function (f) {
        if (!f || !f.id || !P.urlOf(f.id)) throw new Error('id');
        put(concept, { id: f.id, status: 'ok' });
        return del(id).then(function () { forget(id); });
      });
    }).catch(keep);
  }
  // ไม่ใช้ / เอาออก: ลบไฟล์ แล้วจำว่า "ไม่ใช้" (ไม่ถูกสร้างซ้ำเอง)
  function reject(concept, id) {
    put(concept, { status: 'no' });
    if (!id) return Promise.resolve();
    return del(id).then(function () { forget(id); });
  }
  // สร้างใหม่: ลบไฟล์เดิม แล้วสร้างภาพใหม่ (pending)
  function regenerate(concept, id, signal) {
    put(concept, null);
    var gone = id ? del(id).then(function () { forget(id); }) : Promise.resolve();
    return gone.then(function () { return generate(concept, signal); });
  }

  /* สร้างทยอย n ภาพ (≤ 50) ทีละภาพ: ก่อนทุกภาพดู /api/ai/usage — เหลือ < 3,000 Neurons = หยุด · หยุดทันทีเมื่อผิดพลาด/โควตาหมด/ยกเลิก
     opts: { n, signal, onProgress({i, n, remaining}) } → Promise<{ made, planned, reason: 'done'|'low'|'quota'|'error'|'cancel'|'empty', remaining, err }> */
  function run(opts) {
    opts = opts || {};
    var batch = P.nextBatch(read(), opts.n), made = 0, remaining = null;
    if (!batch.length) return Promise.resolve({ made: 0, planned: 0, reason: 'empty', remaining: null });
    var end = function (reason, err) { return { made: made, planned: batch.length, reason: reason, remaining: remaining, err: err }; };
    function step(i) {
      if (opts.signal && opts.signal.aborted) return end('cancel');
      if (i >= batch.length) return end('done');
      return window.AiClient.usage({ signal: opts.signal }).then(function (u) {
        remaining = u && u.remaining;
        if (P.shouldStop(remaining)) return end('low');
        return generate(batch[i], opts.signal).then(function (r) {
          made++;
          if (typeof r.neurons === 'number' && typeof remaining === 'number') remaining -= r.neurons;
          if (opts.onProgress) opts.onProgress({ i: i + 1, n: batch.length, remaining: remaining });
          return step(i + 1);
        });
      }).catch(function (err) {
        if (opts.signal && opts.signal.aborted) return end('cancel');
        return end(err && err.code === 'quota' ? 'quota' : 'error', err);
      });
    }
    return Promise.resolve(step(0));
  }

  window.TanotLangPics = {
    enabled: enabled, admin: admin, read: read, on: on, put: put, generate: generate, approve: approve, reject: reject,
    regenerate: regenerate, run: run, forget: forget, urlOf: P.urlOf
  };
})();
