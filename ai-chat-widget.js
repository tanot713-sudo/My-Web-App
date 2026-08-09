/* ══════════════════════════════════════════════════════════════════
   วิดเจ็ตแชท AI ลอย — ปุ่ม 💬 มุมขวาล่างทุกหน้า (ฉีดโดย shell.js) กดแล้วเปิดแผงแชทได้จากทุกที่ในเว็บ
   ไม่ต้องไปหน้าแยกอีกต่อไป (เดิมเป็น ai-chat.html หน้าเดี่ยว — ย้ายมาเป็นวิดเจ็ตลอยแทนตามที่ผู้ใช้ขอ)

   3 โหมดในแผงเดียว:
   1) พิมพ์คุย — เหมือนแชทบอททั่วไป ตอบแบบสตรีมทีละคำ
   2) 🎤 เปิดไมค์คุย — แตะไมค์ พูดคำถาม แตะอีกทีเพื่อหยุด ถอดเสียงเป็นข้อความอัตโนมัติแล้วส่งเลย
      (บังคับพูดคำตอบกลับด้วยเสียงเสมอในโหมดนี้ ให้ความรู้สึกเหมือนคุยด้วยเสียงจริงๆ)
   3) 🔊 "พูดคำตอบด้วยเสียง" (checkbox ค้างค่าไว้ใน localStorage) — เปิดไว้ให้พิมพ์คุยแต่ได้ยินเสียงตอบด้วย

   ทุกโมเดล AI (แชท/ถอดเสียง/สังเคราะห์เสียง) รันแยกเธรดใน Web Worwork คนละไฟล์ (ai-chat-worker.js,
   asr-worker.js, tts-worker.js — ตัวหลังใช้ไฟล์เดิมของหน้า text-to-speech.html ได้เลย โปรโตคอล
   message ตรงกันพอดีเพราะออกแบบมาให้ส่งได้ทีละ 1 ท่อน (batch ขนาด 1) อยู่แล้ว) กันหน้าเว็บค้าง — ไม่โหลด
   อะไรหนักตอนหน้าเว็บเปิด/ตอนกดเปิดแผงด้วยซ้ำ โหลดโมเดลจริงตอนกดส่งข้อความ/ใช้ไมค์ครั้งแรกเท่านั้น */
(function () {
  'use strict';

  var SYSTEM_PROMPT = 'คุณเป็นผู้ช่วย AI ที่ตอบเป็นภาษาไทยเสมอ (เว้นแต่ผู้ใช้ถามเป็นภาษาอื่นชัดเจน) ' +
    'ตอบให้กระชับ ตรงประเด็น สุภาพ ถ้าไม่แน่ใจคำตอบให้บอกตามตรงว่าไม่แน่ใจ แทนที่จะเดาส่ง';
  /* เจอจริงว่าถ้าผู้ใช้ถามเป็นอังกฤษ โมเดลแชทจะตอบเป็นอังกฤษกลับ (ตาม system prompt) แล้วป้อนข้อความ
     อังกฤษเข้าโมเดลเสียงไทยล้วน (Tanotfin/mms-tts-2081-FM-onnx) ทำให้ tokenize/คำนวณ tensor พังจริง
     ("Tensor shape.Size() must be >= 0") — ต้องเลือกโมเดลเสียงตามภาษาจริงของข้อความที่จะพูด ไม่ใช่ตายตัว
     ตัวเดียว เช็คแค่ "มีตัวอักษรไทยอยู่ไหม" ก็พอ (ระบบตอบเต็มประโยคเป็นภาษาเดียวเสมอ ไม่สลับภาษากลางคำตอบ) */
  function pickTtsModel(text) {
    return /[฀-๿]/.test(text) ? 'Tanotfin/mms-tts-2081-FM-onnx' : 'Xenova/mms-tts-eng';
  }

  /* ── CSS (ฉีดครั้งเดียว ใช้ตัวแปรสี --ome-* จาก theme.css ที่โหลดอยู่แล้วทุกหน้า จึงสลับมืด/สว่าง
     อัตโนมัติตาม data-theme โดยไม่ต้องกำหนด token สีเองซ้ำแบบหน้าเครื่องมือทั่วไป) ────────────────── */
  var css = ''
    + '.ome-ai-fab{position:fixed;right:16px;bottom:16px;width:56px;height:56px;border-radius:50%;'
    + 'background:var(--ome-brand);color:#fff;border:none;font-size:25px;cursor:pointer;z-index:170;'
    + 'display:grid;place-items:center;box-shadow:0 8px 22px rgba(18,165,148,.4);font-family:var(--ome-f)}'
    + '.ome-ai-fab:hover{filter:brightness(1.06)}'
    + '.ome-ai-panel{position:fixed;right:16px;bottom:82px;width:360px;max-width:92vw;height:520px;'
    + 'max-height:72vh;background:var(--ome-card);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.22);'
    + 'z-index:170;display:none;flex-direction:column;overflow:hidden;font-family:var(--ome-f);'
    + 'border:1px solid var(--ome-line)}'
    + '.ome-ai-panel.open{display:flex}'
    + '@media(max-width:480px){.ome-ai-panel{right:8px;left:8px;bottom:78px;width:auto;max-width:none;height:auto;max-height:calc(100vh - 100px)}}'
    + '.ome-ai-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;'
    + 'border-bottom:1px solid var(--ome-line);flex-shrink:0}'
    + '.ome-ai-head b{font-size:14px;color:var(--ome-ink)}'
    + '.ome-ai-close{width:28px;height:28px;border-radius:9px;border:none;background:transparent;'
    + 'color:var(--ome-muted);cursor:pointer;font-size:16px}'
    + '.ome-ai-close:hover{background:var(--ome-bg);color:var(--ome-ink)}'
    + '.ome-ai-disclaimer{font-size:11.5px;color:var(--ome-muted);padding:0 14px 10px;line-height:1.5;flex-shrink:0}'
    + '.ome-ai-log{flex:1;overflow-y:auto;padding:8px 12px;display:flex;flex-direction:column;gap:9px}'
    + '.ome-ai-row{display:flex}'
    + '.ome-ai-row.me{justify-content:flex-end}'
    + '.ome-ai-bubble{max-width:82%;padding:9px 12px;border-radius:13px;font-size:13.5px;line-height:1.55;'
    + 'white-space:pre-wrap;word-break:break-word;color:var(--ome-ink)}'
    + '.ome-ai-row.me .ome-ai-bubble{background:var(--ome-brand);color:#fff;border-bottom-right-radius:4px}'
    + '.ome-ai-row.bot .ome-ai-bubble{background:var(--ome-bg);border:1px solid var(--ome-line);border-bottom-left-radius:4px}'
    + '.ome-ai-status{font-size:11.5px;color:var(--ome-muted);padding:2px 14px;min-height:1.3em;flex-shrink:0}'
    + '.ome-ai-status.err{color:var(--ome-err)}'
    + '.ome-ai-inputwrap{padding:8px 12px 10px;border-top:1px solid var(--ome-line);flex-shrink:0}'
    + '.ome-ai-inputrow{display:flex;gap:6px;align-items:flex-end}'
    + '.ome-ai-inputrow textarea{flex:1;font-family:inherit;font-size:14px;padding:8px 10px;border-radius:10px;'
    + 'border:1.5px solid var(--ome-line);background:var(--ome-bg);color:var(--ome-ink);resize:none;'
    + 'line-height:1.5;max-height:80px;-webkit-appearance:none}'
    + '.ome-ai-inputrow textarea:focus{outline:none;border-color:var(--ome-brand)}'
    + '.ome-ai-btn{border:none;border-radius:10px;cursor:pointer;font-size:15px;flex-shrink:0;'
    + 'width:38px;height:38px;display:grid;place-items:center;background:var(--ome-bg);color:var(--ome-ink)}'
    + '.ome-ai-btn.send{background:var(--ome-brand);color:#fff;width:auto;padding:0 14px;font-size:13.5px;font-weight:700}'
    + '.ome-ai-btn:disabled{opacity:.5;cursor:default}'
    + '.ome-ai-btn.mic.recording{background:var(--ome-err);color:#fff;animation:ome-ai-pulse 1.1s infinite}'
    + '@keyframes ome-ai-pulse{0%,100%{opacity:1}50%{opacity:.55}}'
    + '.ome-ai-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;flex-wrap:wrap}'
    + '.ome-ai-speak-lbl{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--ome-muted);cursor:pointer}'
    + '.ome-ai-speak-lbl input{accent-color:var(--ome-brand)}'
    + '.ome-ai-newbtn{border:none;background:transparent;color:var(--ome-muted);font-size:11.5px;'
    + 'cursor:pointer;font-family:inherit;font-weight:600}'
    + '.ome-ai-newbtn:hover{color:var(--ome-brand-dk)}';
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── DOM ────────────────────────────────────────────────────────── */
  var fab = document.createElement('button');
  fab.className = 'ome-ai-fab'; fab.type = 'button'; fab.title = 'ผู้ช่วย AI ถาม-ตอบ';
  fab.textContent = '💬';

  var panel = document.createElement('div');
  panel.className = 'ome-ai-panel';
  panel.innerHTML =
    '<div class="ome-ai-head"><b>💬 ผู้ช่วย AI ถาม-ตอบ</b><button class="ome-ai-close" type="button" title="ปิด">✕</button></div>' +
    '<div class="ome-ai-disclaimer">AI ตัวเล็กรันในเครื่องคุณเอง ไม่ส่งข้อความออกไปไหน — ไม่ใช่ agent เหมาะกับคำถามพื้นฐานเท่านั้น</div>' +
    '<div class="ome-ai-log"></div>' +
    '<div class="ome-ai-status"></div>' +
    '<div class="ome-ai-inputwrap">' +
      '<div class="ome-ai-inputrow">' +
        '<button class="ome-ai-btn mic" type="button" title="เปิดไมค์คุย">🎤</button>' +
        '<textarea rows="1" placeholder="พิมพ์คำถาม… (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"></textarea>' +
        '<button class="ome-ai-btn send" type="button">ส่ง</button>' +
      '</div>' +
      '<div class="ome-ai-foot">' +
        '<label class="ome-ai-speak-lbl"><input type="checkbox">🔊 พูดคำตอบด้วยเสียง</label>' +
        '<button class="ome-ai-newbtn" type="button">🔄 เริ่มแชทใหม่</button>' +
      '</div>' +
    '</div>';

  function ready() {
    document.body.appendChild(fab);
    document.body.appendChild(panel);
    wire();
  }
  if (document.body) ready();
  else document.addEventListener('DOMContentLoaded', ready);

  /* ── เนื้อหาหน้าเว็บปัจจุบัน (ให้ผู้ช่วยเข้าใจบริบทหน้าที่ผู้ใช้เปิดอยู่ได้) ───────────────────
     ดึงครั้งเดียวตอนวิดเจ็ตเริ่มทำงาน ไม่ดึงซ้ำทุกครั้งที่ส่งข้อความ (ประหยัด token ของโมเดลเล็ก และ
     เนื้อหาหน้าเว็บปกติไม่เปลี่ยนระหว่างที่เปิดแชทอยู่) — เดินผ่านเฉพาะ direct children ของ body แล้ว
     ข้าม fab/panel ของวิดเจ็ตเอง (สร้างไว้แล้วด้านบน แม้ยังไม่ถูก appendChild เข้า DOM จริงตอนนี้ก็ตาม)
     กันไม่ให้ดึงข้อความของวิดเจ็ตเองปนเข้ามาเป็นบริบทหน้าเว็บ ⚠️ ข้อจำกัด: หน้าที่เนื้อหาโหลด/render
     แบบ async (เช่นหน้า React บางหน้า) เนื้อหาที่ยังไม่ขึ้นตอนนี้จะไม่ถูกดึงไปด้วย */
  function getPageContextText() {
    try {
      var parts = [];
      Array.prototype.forEach.call(document.body.childNodes, function (node) {
        if (node === fab || node === panel) return;
        var t = node.innerText || node.textContent || '';
        if (t) parts.push(t);
      });
      var text = parts.join(' ').replace(/\s+/g, ' ').trim();
      if (text.length > 3000) text = text.slice(0, 3000) + '…';
      return text;
    } catch (e) { return ''; }
  }
  function buildInitialMessages() {
    var msgs = [{ role: 'system', content: SYSTEM_PROMPT }];
    var pageText = getPageContextText();
    if (pageText) {
      msgs.push({
        role: 'system',
        content: 'นี่คือเนื้อหาบางส่วนของหน้าเว็บที่ผู้ใช้กำลังเปิดอยู่ตอนนี้ (ชื่อหน้า: "' + document.title +
          '") ใช้ข้อมูลนี้ช่วยตอบคำถามที่เกี่ยวกับหน้านี้ได้ ถ้าคำถามไม่เกี่ยวกับหน้านี้ก็ตอบตามปกติ ' +
          'ไม่ต้องพูดถึงเนื้อหานี้เองถ้าไม่มีใครถาม:\n\n' + pageText
      });
    }
    return msgs;
  }

  /* ── ตัวแปรสถานะ + worker (สร้างแบบ lazy ตอนใช้จริงครั้งแรกเท่านั้น) ──────────────── */
  var chatWorker = null, ttsWorker = null, asrWorker = null;
  var jobSeq = 0;
  var isBusy = false;
  var isRecording = false;
  var messages = buildInitialMessages();
  var mediaStream = null, mediaRecorder = null, recordedChunks = [];
  var sharedAudioCtx = null;

  function getChatWorker() { if (!chatWorker) chatWorker = new Worker('./ai-chat-worker.js', { type: 'module' }); return chatWorker; }
  function getTtsWorker() { if (!ttsWorker) ttsWorker = new Worker('./tts-worker.js', { type: 'module' }); return ttsWorker; }
  function getAsrWorker() { if (!asrWorker) asrWorker = new Worker('./asr-worker.js', { type: 'module' }); return asrWorker; }
  /* ต้องสร้าง/ปลดล็อก AudioContext "ในจังหวะคลิกของผู้ใช้โดยตรง" เท่านั้น (synchronous ในตัว event
     handler) ไม่งั้นเบราว์เซอร์ (autoplay policy) จะสั่ง suspended ค้างไว้ — ที่ผ่านมาสร้าง AudioContext
     ใหม่ตอน playPcm() ซึ่งรันหลัง worker ตอบกลับมา (async, ห่างจาก click event ไปหลายวินาที) จึงโดนบล็อก
     เสียงไม่ออกเลยแม้ synthesize สำเร็จ — แก้โดยเรียกฟังก์ชันนี้ตั้งแต่ตอน click ปุ่มส่ง/ไมค์/เปิดแผง
     (ดูจุดเรียกด้านล่าง) แล้วใช้ context เดียวกันซ้ำตอนเล่นเสียงจริงทีหลัง */
  function unlockAudioCtx() {
    if (!sharedAudioCtx) {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume();
    return sharedAudioCtx;
  }

  function wire() {
    var logEl = panel.querySelector('.ome-ai-log');
    var statusEl = panel.querySelector('.ome-ai-status');
    var inputEl = panel.querySelector('.ome-ai-inputrow textarea');
    var sendBtn = panel.querySelector('.ome-ai-btn.send');
    var micBtn = panel.querySelector('.ome-ai-btn.mic');
    var closeBtn = panel.querySelector('.ome-ai-close');
    var speakChk = panel.querySelector('.ome-ai-speak-lbl input');
    var newBtn = panel.querySelector('.ome-ai-newbtn');

    try { speakChk.checked = localStorage.getItem('ome:aiChatSpeak') === 'on'; } catch (e) {}
    speakChk.addEventListener('change', function () {
      try { localStorage.setItem('ome:aiChatSpeak', speakChk.checked ? 'on' : 'off'); } catch (e) {}
    });

    function setStatus(text, cls) {
      statusEl.textContent = text || '';
      statusEl.className = 'ome-ai-status' + (cls ? ' ' + cls : '');
    }
    function setBusy(b) {
      isBusy = b;
      inputEl.disabled = b; sendBtn.disabled = b; micBtn.disabled = b;
    }
    function scrollBottom() { logEl.scrollTop = logEl.scrollHeight; }
    function appendBubble(role, text) {
      var row = document.createElement('div');
      row.className = 'ome-ai-row ' + (role === 'user' ? 'me' : 'bot');
      var b = document.createElement('div');
      b.className = 'ome-ai-bubble';
      b.textContent = text;
      row.appendChild(b);
      logEl.appendChild(row);
      scrollBottom();
      return b;
    }

    fab.addEventListener('click', function () {
      unlockAudioCtx(); // ปลดล็อกไว้ตั้งแต่กดเปิดแผง กันปัญหา autoplay policy ตอนเล่นเสียงตอบทีหลัง
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) inputEl.focus();
    });
    closeBtn.addEventListener('click', function () { panel.classList.remove('open'); });

    /* ── สังเคราะห์เสียงพูดคำตอบ (ใช้ tts-worker.js ตัวเดียวกับหน้าแปลงข้อความเป็นเสียง ส่ง batch
       ขนาด 1 ท่อน) ─────────────────────────────────────────────────────────────────── */
    function playPcm(samples, sampleRate) {
      try {
        var ctx = unlockAudioCtx();
        if (!ctx) { setStatus('❌ เบราว์เซอร์นี้ไม่รองรับ AudioContext', 'err'); return; }
        var buf = ctx.createBuffer(1, samples.length, sampleRate);
        buf.getChannelData(0).set(samples);
        var src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      } catch (e) { setStatus('❌ เล่นเสียงไม่ได้: ' + (e && e.message ? e.message : e), 'err'); }
    }
    function speakText(text) {
      if (!text) return;
      var w = getTtsWorker();
      var jobId = ++jobSeq;
      function onMsg(e) {
        var msg = e.data;
        if (!msg || msg.jobId !== jobId) return;
        if (msg.type === 'model-progress') {
          var pct = msg.progress != null ? Math.round(msg.progress) + '%' : '';
          setStatus('⏳ กำลังโหลดเสียงพูด (ครั้งแรกเท่านั้น) ' + msg.file + ' ' + pct, '');
        } else if (msg.type === 'item-done') {
          cleanup(); setStatus('', ''); playPcm(msg.audio, msg.samplingRate);
        } else if (msg.type === 'item-error') {
          cleanup(); setStatus('❌ พูดคำตอบไม่สำเร็จ: ' + msg.message, 'err');
        }
      }
      function onErr(e) { cleanup(); setStatus('❌ Web Worker error: ' + (e.message || ''), 'err'); }
      function cleanup() { w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); }
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage({ type: 'synthesize-batch', jobId: jobId, items: [{ i: 0, text: text }], modelId: pickTtsModel(text) });
    }

    /* ── ส่งข้อความแชท (ใช้ทั้งตอนพิมพ์และตอนถอดเสียงจากไมค์เสร็จ) ───────────────────────── */
    function sendMessage(forceSpeak) {
      if (isBusy) return;
      var text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = '';
      appendBubble('user', text);
      messages.push({ role: 'user', content: text });

      setBusy(true);
      setStatus('กำลังเตรียมคำตอบ… (ครั้งแรกอาจต้องโหลดโมเดล ~350MB ก่อน)', '');

      /* โมเดลเล็ก (0.5B) เชื่อฟัง system prompt ตัวเดียวตอนต้นบทสนทนาได้ไม่แน่นอน — เจอจริงว่าถามเป็นไทย
         แล้วยังตอบอังกฤษกลับบ่อยๆ แก้ด้วยการ "ย้ำ" คำสั่งภาษาแทรกไว้ท้ายสุดก่อน generate ทุกรอบ (ไม่บันทึก
         ลง messages ถาวร แค่ใช้ครั้งเดียวตอนส่งคำขอนี้) โมเดลเล็กมักเชื่อฟังคำสั่งที่อยู่ใกล้จุดเริ่มตอบ
         มากกว่าคำสั่งจากตอนต้นบทสนทนาที่ไกลออกไปแล้ว (recency bias) */
      var wantThai = /[฀-๿]/.test(text);
      var langHint = wantThai
        ? 'ย้ำ: ตอบข้อความล่าสุดนี้เป็นภาษาไทยเท่านั้น ห้ามตอบเป็นภาษาอังกฤษเด็ดขาด'
        : 'Reminder: respond to this latest message in English only.';
      var payloadMessages = messages.concat([{ role: 'system', content: langHint }]);

      var jobId = ++jobSeq;
      var replyBubble = null, replyText = '';
      var w = getChatWorker();

      function onMsg(e) {
        var msg = e.data;
        if (!msg || msg.jobId !== jobId) return;
        if (msg.type === 'model-progress') {
          var pct = msg.progress != null ? Math.round(msg.progress) + '%' : '';
          setStatus('กำลังโหลดโมเดล (ครั้งแรกเท่านั้น) ' + msg.file + ' ' + pct, '');
        } else if (msg.type === 'fallback') {
          setStatus('⚠️ ' + msg.message, ''); // จะถูกทับด้วยสถานะถัดไปเองเมื่อโหลดตัวสำรองเสร็จ
        } else if (msg.type === 'model-info') {
          console.info('[ai-chat] ใช้โมเดล', msg.modelId, 'บน', msg.device);
        } else if (msg.type === 'token') {
          if (!replyBubble) { setStatus('', ''); replyBubble = appendBubble('assistant', ''); }
          replyText += msg.token;
          replyBubble.textContent = replyText;
          scrollBottom();
        } else if (msg.type === 'done') {
          cleanup();
          if (replyText) {
            messages.push({ role: 'assistant', content: replyText });
            if (forceSpeak || speakChk.checked) speakText(replyText);
          } else setStatus('ไม่ได้คำตอบกลับมา ลองอีกครั้ง', 'err');
          setBusy(false); inputEl.focus();
        } else if (msg.type === 'error') {
          cleanup();
          if (replyBubble) replyBubble.remove();
          messages.pop();
          setStatus('❌ ตอบไม่สำเร็จ: ' + msg.message, 'err');
          setBusy(false); inputEl.focus();
        }
      }
      function onErr(e) {
        cleanup();
        if (replyBubble) replyBubble.remove();
        messages.pop();
        setStatus('❌ Web Worker error: ' + (e.message || 'ไม่ทราบสาเหตุ'), 'err');
        setBusy(false); inputEl.focus();
      }
      function cleanup() { w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); }
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage({ type: 'chat', jobId: jobId, messages: payloadMessages });
    }
    sendBtn.addEventListener('click', function () { unlockAudioCtx(); sendMessage(false); });
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); unlockAudioCtx(); sendMessage(false); }
    });

    /* ── โหมดเปิดไมค์คุย: แตะเริ่มอัด แตะอีกทีหยุด → ถอดเสียงเป็นข้อความ → ส่งอัตโนมัติ →
       บังคับพูดคำตอบกลับด้วยเสียงเสมอ (ไม่ต้องพึ่ง checkbox) ให้ความรู้สึกเหมือนคุยด้วยเสียงจริง ── */
    function resampleTo16kMono(audioBuffer) {
      var targetRate = 16000;
      var OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var offlineCtx = new OfflineCtx(1, Math.ceil(audioBuffer.duration * targetRate), targetRate);
      var source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);
      return offlineCtx.startRendering().then(function (rendered) { return rendered.getChannelData(0); });
    }
    function decodeBlobToPcm(blob) {
      return blob.arrayBuffer().then(function (buf) {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        var ctx = new AudioCtx();
        return ctx.decodeAudioData(buf).then(function (audioBuffer) {
          ctx.close();
          return resampleTo16kMono(audioBuffer);
        }, function () { ctx.close(); throw new Error('ถอดเสียงที่อัดไม่ได้ ลองอัดใหม่อีกครั้ง'); });
      });
    }
    function transcribe(pcm) {
      return new Promise(function (resolve, reject) {
        var w = getAsrWorker();
        var jobId = ++jobSeq;
        function onMsg(e) {
          var msg = e.data;
          if (!msg || msg.jobId !== jobId) return;
          if (msg.type === 'model-progress') {
            var pct = msg.progress != null ? Math.round(msg.progress) + '%' : '';
            setStatus('⏳ กำลังโหลดโมเดลถอดเสียง (ครั้งแรกเท่านั้น) ' + msg.file + ' ' + pct, '');
          } else if (msg.type === 'result') { cleanup(); resolve(msg.text); }
          else if (msg.type === 'error') { cleanup(); reject(new Error(msg.message)); }
        }
        function onErr(e) { cleanup(); reject(new Error(e.message || 'Web Worker error')); }
        function cleanup() { w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); }
        w.addEventListener('message', onMsg);
        w.addEventListener('error', onErr);
        /* บังคับ lang: 'thai' ตรงๆ ไม่ปล่อยให้ Whisper เดาภาษาเอง (lang: 'auto') — เจอจริงว่า
           whisper-tiny (โมเดลเล็กสุด) เดาภาษาผิดง่ายโดยเฉพาะเสียงพูดสั้นๆ พอเดาว่าเป็นอังกฤษ จะถอด
           เสียงไทยออกมาเป็นข้อความอังกฤษเพี้ยนแทน ทำให้แชทเข้าใจผิดว่าถามเป็นอังกฤษแล้วตอบอังกฤษกลับ
           ตามไปด้วย — โหมดไมค์ของหน้านี้ตั้งใจไว้สำหรับพูดไทยอยู่แล้ว บังคับเลยตัดปัญหาการเดาผิดทิ้งไปเลย */
        w.postMessage({ type: 'transcribe', jobId: jobId, pcm: pcm, lang: 'thai' }, [pcm.buffer]);
      });
    }
    function startRecording() {
      return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        mediaStream = stream;
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.addEventListener('dataavailable', function (e) { if (e.data && e.data.size) recordedChunks.push(e.data); });
        mediaRecorder.start();
      });
    }
    function stopRecording() {
      return new Promise(function (resolve) {
        mediaRecorder.addEventListener('stop', function () {
          mediaStream.getTracks().forEach(function (t) { t.stop(); });
          resolve(new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' }));
        }, { once: true });
        mediaRecorder.stop();
      });
    }
    micBtn.addEventListener('click', function () {
      unlockAudioCtx();
      if (isBusy && !isRecording) return;
      if (!isRecording) {
        if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices) {
          setStatus('❌ เบราว์เซอร์นี้ไม่รองรับการอัดเสียงผ่านไมค์', 'err'); return;
        }
        isRecording = true;
        micBtn.classList.add('recording'); micBtn.textContent = '⏹️';
        inputEl.disabled = true; sendBtn.disabled = true; // เว้น micBtn ไว้ให้กดหยุดได้ (setBusy จะปิดหมดรวม mic)
        setStatus('🎙️ กำลังฟัง… แตะไมค์อีกครั้งเพื่อหยุด', '');
        startRecording().catch(function (err) {
          isRecording = false;
          micBtn.classList.remove('recording'); micBtn.textContent = '🎤';
          inputEl.disabled = false; sendBtn.disabled = false;
          setStatus('❌ เปิดไมค์ไม่สำเร็จ: ' + (err && err.message ? err.message : 'ตรวจสอบสิทธิ์ไมโครโฟน'), 'err');
        });
      } else {
        isRecording = false;
        micBtn.classList.remove('recording'); micBtn.textContent = '🎤';
        setBusy(true);
        setStatus('⏳ กำลังถอดเสียงเป็นข้อความ…', '');
        stopRecording().then(decodeBlobToPcm).then(transcribe).then(function (text) {
          text = (text || '').trim();
          setBusy(false);
          if (!text) { setStatus('⚠️ ไม่ได้ยินคำพูด ลองพูดใหม่อีกครั้ง', 'err'); return; }
          setStatus('', '');
          inputEl.value = text;
          sendMessage(true); // true = บังคับพูดคำตอบกลับด้วยเสียงเสมอในโหมดไมค์
        }).catch(function (err) {
          setBusy(false);
          setStatus('❌ ถอดเสียงไม่สำเร็จ: ' + (err && err.message ? err.message : String(err)), 'err');
        });
      }
    });

    newBtn.addEventListener('click', function () {
      messages = buildInitialMessages(); // ดึงเนื้อหาหน้าเว็บใหม่ด้วย เผื่อเปลี่ยนหน้า/เนื้อหาเปลี่ยนไปแล้ว
      logEl.innerHTML = '';
      setStatus('', '');
      inputEl.focus();
      /* ไม่ terminate() worker ทิ้ง — ปล่อย pipeline ที่แคชไว้แล้วอยู่ต่อ กันต้องโหลดโมเดลใหม่ทุกครั้งที่
         กดเริ่มแชทใหม่ (messages array รีเซ็ตพอแล้ว ไม่มี state อื่นค้างอยู่ใน worker) */
    });
  }
})();
