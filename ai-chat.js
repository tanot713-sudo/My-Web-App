/* ══════════════════════════════════════════════════════════════════
   ผู้ช่วย AI ถาม-ตอบ — แชทกับโมเดลภาษาเล็ก (onnx-community/Qwen2.5-0.5B-Instruct) รันในเบราว์เซอร์
   ล้วนๆ ผ่าน transformers.js (WASM) ไม่มีเซิร์ฟเวอร์ ไม่มีค่าใช้จ่ายต่อการใช้งาน ไม่ส่งข้อความออก
   จากเครื่องเลย — แลกกับความฉลาด: โมเดลนี้เล็กมาก (0.5 พันล้านพารามิเตอร์ เทียบกับ Claude/GPT ที่มี
   เป็นแสนล้าน-ล้านล้าน) จึงตอบผิด/สับสนได้ง่ายกว่ามาก โดยเฉพาะคำถามซับซ้อน/ต้องใช้เหตุผลหลายขั้น
   ไม่ใช่ agent ที่เรียกใช้เครื่องมือ/ค้นเว็บได้ เป็นแค่แชทบอทตอบคำถามพื้นฐานเท่านั้น

   สถาปัตยกรรมเดียวกับ text-to-speech.js/tts-worker.js: รันโมเดลใน Web Worker แยกเธรด กันหน้าเว็บค้าง
   ระหว่างคำนวณ ต่างกันตรงที่แชทใช้ Worker ตัวเดียว (ไม่ใช่พูลหลายตัวขนานแบบเสียง) เพราะเป็นงานต่อเนื่อง
   ทีละคำตอบ ไม่ได้ตัดเป็นท่อนขนานกันได้ — คง Worker เดิมไว้ข้ามคำถามในเซสชันเดียวกัน (ไม่ terminate)
   เพื่อให้ pipeline ที่โหลด/แคชไว้แล้วถูกใช้ซ้ำได้ทันทีโดยไม่ต้องโหลดโมเดลใหม่ทุกครั้ง */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var SYSTEM_PROMPT = 'คุณเป็นผู้ช่วย AI ที่ตอบเป็นภาษาไทยเสมอ (เว้นแต่ผู้ใช้ถามเป็นภาษาอื่นชัดเจน) ' +
    'ตอบให้กระชับ ตรงประเด็น สุภาพ ถ้าไม่แน่ใจคำตอบให้บอกตามตรงว่าไม่แน่ใจ แทนที่จะเดาส่ง';

  var worker = null;
  var jobSeq = 0;
  var isGenerating = false;
  var messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  function getWorker() {
    if (!worker) worker = new Worker('./ai-chat-worker.js', { type: 'module' });
    return worker;
  }
  function resetWorker() {
    if (worker) { worker.terminate(); worker = null; }
  }

  function scrollToBottom() {
    var log = $('chatLog');
    log.scrollTop = log.scrollHeight;
  }

  function appendBubble(role, text) {
    var log = $('chatLog');
    var row = document.createElement('div');
    row.className = 'chat-row ' + (role === 'user' ? 'me' : 'bot');
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    log.appendChild(row);
    scrollToBottom();
    return bubble;
  }

  function setStatus(text, cls) {
    var el = $('chatStatus');
    el.textContent = text || '';
    el.className = 'status' + (cls ? ' ' + cls : '');
  }

  function setInputEnabled(enabled) {
    $('chatInput').disabled = !enabled;
    $('chatSendBtn').disabled = !enabled;
  }

  function sendMessage() {
    if (isGenerating) return;
    var text = $('chatInput').value.trim();
    if (!text) return;

    $('chatInput').value = '';
    appendBubble('user', text);
    messages.push({ role: 'user', content: text });

    isGenerating = true;
    setInputEnabled(false);
    setStatus('กำลังเตรียมคำตอบ… (ครั้งแรกอาจต้องโหลดโมเดล ~350MB ก่อน)', '');

    var jobId = ++jobSeq;
    var replyBubble = null;
    var replyText = '';
    var w = getWorker();

    function onMsg(e) {
      var msg = e.data;
      if (!msg || msg.jobId !== jobId) return;
      if (msg.type === 'model-progress') {
        var pct = msg.progress != null ? Math.round(msg.progress) + '%' : '';
        setStatus('กำลังโหลดโมเดล (ครั้งแรกเท่านั้น) ' + msg.file + ' ' + pct, '');
      } else if (msg.type === 'token') {
        if (!replyBubble) { setStatus('', ''); replyBubble = appendBubble('assistant', ''); }
        replyText += msg.token;
        replyBubble.textContent = replyText;
        scrollToBottom();
      } else if (msg.type === 'done') {
        cleanup();
        if (replyText) messages.push({ role: 'assistant', content: replyText });
        else setStatus('ไม่ได้คำตอบกลับมา ลองอีกครั้ง', 'err');
        finish();
      } else if (msg.type === 'error') {
        cleanup();
        if (replyBubble) replyBubble.remove();
        messages.pop(); // เอาคำถามที่ตอบไม่สำเร็จออกจากประวัติ กันโมเดลสับสนตอนถามต่อ
        setStatus('❌ ตอบไม่สำเร็จ: ' + msg.message, 'err');
        finish();
      }
    }
    function onErr(e) {
      cleanup();
      if (replyBubble) replyBubble.remove();
      messages.pop();
      setStatus('❌ Web Worker error: ' + (e.message || 'ไม่ทราบสาเหตุ'), 'err');
      finish();
    }
    function cleanup() {
      w.removeEventListener('message', onMsg);
      w.removeEventListener('error', onErr);
    }
    function finish() {
      isGenerating = false;
      setInputEnabled(true);
      $('chatInput').focus();
    }

    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    w.postMessage({ type: 'chat', jobId: jobId, messages: messages });
  }

  function newChat() {
    resetWorker();
    isGenerating = false;
    messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    $('chatLog').innerHTML = '';
    setStatus('', '');
    setInputEnabled(true);
    $('chatInput').focus();
  }

  function init() {
    if (typeof Worker === 'undefined') {
      setStatus('เบราว์เซอร์นี้ไม่รองรับ Web Worker ใช้ฟีเจอร์นี้ไม่ได้', 'err');
      setInputEnabled(false);
      return;
    }
    $('chatSendBtn').addEventListener('click', sendMessage);
    $('chatNewBtn').addEventListener('click', newChat);
    $('chatInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
