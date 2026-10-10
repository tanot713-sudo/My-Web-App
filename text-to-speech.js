/* ══════════════════════════════════════════════════════════════════
   แปลงข้อความเป็นเสียง — 2 โหมด:
   1) ฟังทันที: Web Speech API ของเบราว์เซอร์ (เล่นสดเท่านั้น ดาวน์โหลดไม่ได้)
   2) สร้างไฟล์เสียง: eSpeak NG (WASM, ฝังในเว็บเอง) → .wav ตรงๆ จาก virtual FS
      แล้วเข้ารหัสเป็น .mp3 ด้วย lamejs ฝั่งเบราว์เซอร์ล้วนๆ ไม่มีเซิร์ฟเวอร์
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var T = OME_I18N.scope('tts', {
    th: {
      title: 'แปลงเสียง ↔ ข้อความ | Tanot', crumbHome: 'หน้าหลัก', crumb: 'แปลงข้อความเป็นเสียง', h1: 'แปลงเสียง ↔ ข้อความ',
      cardText: 'ข้อความ', attach: 'แนบไฟล์', useOcr: 'ใช้ OCR อ่านหน้า/รูปที่เป็นภาพสแกน (ช้ากว่าปกติ)',
      textPh: 'พิมพ์หรือวางข้อความที่นี่ (ไทยหรืออังกฤษก็ได้) หรือกด แนบไฟล์ด้านบน', textLabel: 'ข้อความ',
      cardLive: 'ฟังทันที (เสียงจากเบราว์เซอร์)', voice: 'เสียง', rate: 'ความเร็ว', play: 'เล่น', pause: 'หยุดชั่วคราว', stop: 'หยุด',
      cardMake: 'สร้างไฟล์เสียงดาวน์โหลดได้ (.wav / .mp3)', badgeAi: 'เสียง AI (MMS-TTS)', lang: 'ภาษา', langTh: 'ไทย', langEn: 'อังกฤษ', make: 'สร้างไฟล์เสียง', dlWav: 'ดาวน์โหลด .wav', dlMp3: 'ดาวน์โหลด .mp3',
      cardAsr: 'เสียง/วิดีโอ → ข้อความ', asrFile: 'ไฟล์เสียง/วิดีโอ', asrAuto: 'ตรวจจับอัตโนมัติ', modelSize: 'ขนาดโมเดล',
      mTiny: 'เล็ก (เร็ว, ~75MB)', mBase: 'กลาง (แม่นขึ้น, ~145MB)', mSmall: 'ใหญ่ (แม่นขึ้นมาก, ~250MB, โหลด/รันช้ากว่า)', mMedium: 'ใหญ่มาก (แม่นสุด, ~750MB-1GB, โหลด/รันช้ามาก อาจหนักเกินไปสำหรับมือถือ/เครื่องสเปกต่ำ)',
      engineLabel: 'ถอดเสียงด้วย', engineLocal: 'ในเบราว์เซอร์ (ฟรี)', engineCloud: 'คลาวด์ (แม่นกว่า)', asrGo: 'ถอดเสียงเป็นข้อความ', copy: 'คัดลอกข้อความ', sumMeeting: 'สรุปประชุมด้วย AI', dlDocx: 'ดาวน์โหลดเป็น Word (.docx)',
      chars: '{n} ตัวอักษร', reading: 'กำลังอ่านไฟล์…', readingOcr: 'กำลังอ่านด้วย OCR หน้า/รูป {page}/{total} (อาจใช้เวลาสักครู่ต่อหน้า)…', readingPdf: 'กำลังอ่าน PDF หน้า {page}/{total}…',
      noReader: 'โหลดตัวอ่านไฟล์ไม่สำเร็จ (อาจเป็นเพราะเน็ตช้า/ถูกบล็อก) ลองรีเฟรชหน้าใหม่', readingFile: 'กำลังอ่านไฟล์ {name}…', noText: 'ไม่พบข้อความในไฟล์นี้',
      imported: 'นำเข้าข้อความจาก {name} แล้ว ({n} ตัวอักษร) — ตรวจทานก่อนกด "สร้างไฟล์เสียง" ได้', readFail: 'อ่านไฟล์ไม่สำเร็จ: {msg}',
      noWebSpeech: '(เบราว์เซอร์นี้ไม่รองรับ Web Speech API)', noVoices: '(ยังไม่พบเสียง — บางเบราว์เซอร์โหลดช้า ลองรอสักครู่)', defaultVoice: ' — ค่าเริ่มต้น',
      typeFirst: 'พิมพ์ข้อความก่อน', playing: 'กำลังเล่น…', played: 'เล่นจบแล้ว', playFail: 'เล่นไม่สำเร็จ: {msg}', paused: 'หยุดชั่วคราว',
      v_default: 'ค่าเริ่มต้น', v_podcast: 'หญิง (โทนพอดแคสต์)', v_female: 'หญิง (ทั่วไป)', v_male: 'ชาย (ทั่วไป)',
      etaFew: 'อีกไม่กี่วินาที', etaSec: 'อีกประมาณ {s} วินาที', etaMin: 'อีกประมาณ {m} นาที', etaMinSec: 'อีกประมาณ {m} นาที {s} วินาที',
      emptyAfterFilter: 'ข้อความหลังตัดอักขระที่โมเดลไม่รู้จักออกแล้วว่างเปล่า ลองพิมพ์เป็นภาษาไทยดู',
      prepTh: 'กำลังเตรียมโมเดลเสียง (ครั้งแรกต้องดาวน์โหลดจาก Hugging Face — ครั้งต่อไปจะเร็วขึ้นเพราะแคชไว้แล้ว)…',
      prepEn: 'กำลังเตรียมโมเดลเสียง (ครั้งแรกอาจต้องดาวน์โหลดจาก Hugging Face หลายสิบ MB — ครั้งต่อไปจะเร็วขึ้นเพราะแคชไว้แล้ว)…',
      dlModel: 'กำลังดาวน์โหลดโมเดล: {file}', dlModelPct: 'กำลังดาวน์โหลดโมเดล: {file} ({pct}%)', chunksDone: 'สร้างเสียงแล้ว {done}/{total} ท่อน', creating: 'กำลังสร้างเสียง… (อาจใช้เวลาถึงหลายนาทีถ้าเครื่องไม่แรงมาก)',
      assembling: 'กำลังประกอบไฟล์เสียง…', made: 'สร้างไฟล์เสียงเสร็จแล้ว — เล่นฟังหรือดาวน์โหลดได้ด้านล่าง', makeFail: 'สร้างไฟล์เสียงไม่สำเร็จ: {msg} [model={model}, dtype={dtype}]',
      dtypeDefault: 'ดีฟอลต์ของเบราว์เซอร์ (มักเป็น q8)', cantDecode: 'ถอดเสียงจากไฟล์นี้ไม่ได้ — ลองไฟล์เสียง/วิดีโอชนิดอื่น (mp3/wav/mp4/webm)',
      noAudioCtx: 'เบราว์เซอร์นี้ไม่รองรับ Web Audio API สำหรับแปลงเป็น mp3', wavFail: 'ถอดรหัสไฟล์ .wav ไม่สำเร็จ', noAudioData: 'ไม่ได้ข้อมูลเสียงกลับมา', noWorker: 'สร้าง Web Worker ไม่ได้',
      neuronUse: 'ใช้ไปแล้ววันนี้ {used} / {limit} Neurons (เหลือฟรี ~{hours} ชม.เสียง)',
      costConfirm: 'เสียงไฟล์นี้ยาว ~{min} นาที ต้องใช้ ~{need} Neurons แต่วันนี้เหลือโควตาฟรีแค่ {left} Neurons (ใช้ไปแล้ว {used}/{limit}) — ส่วนที่เกิน ~{over} Neurons จะมีค่าใช้จ่ายจริง (~${cost}) กดตกลงเพื่อทำต่อ หรือยกเลิกเพื่อหยุด',
      mcTiny: 'เล็ก · รุ่นใหม่ (รองรับ WebGPU)', mcBase: 'กลาง · รุ่นใหม่ (รองรับ WebGPU)', mcSmall: 'ใหญ่ · รุ่นใหม่ (รองรับ WebGPU, แม่นขึ้นมาก)', mcLarge: 'ใหญ่มาก · large-v3-turbo (เฉพาะ WebGPU, ดาวน์โหลดใหญ่)',
      mtThSmall: 'ไทยแม่นยำ (Thonburian) small', mtThMedium: 'ไทยแม่นยำ (Thonburian) medium', thaiModelNote: 'รุ่น Thonburian ฝึกมาสำหรับภาษาไทยเป็นหลัก — ถ้าเสียงเป็นภาษาอังกฤษ ควรเลือกรุ่นอื่น',
      domainLabel: 'ประเภทเนื้อหา (คำศัพท์เฉพาะ)', domGeneral: 'ทั่วไป', domLaw: 'กฎหมาย', domEng: 'ไฟฟ้า / วิศวกรรม', domInvest: 'การลงทุน',
      showTime: 'แสดงเวลา [hh:mm:ss]', gpuFallback: 'WebGPU ใช้ไม่ได้ ใช้ WASM แทน', modelFallback: 'โหลดโมเดลรุ่นใหม่ไม่ได้ ใช้รุ่นเดิมแทน',
      cancelledQuota: 'ยกเลิกแล้ว (เกินโควตาฟรีวันนี้)', cloudChunk: 'กำลังถอดเสียงผ่านคลาวด์… ท่อน {i}/{n}', pickAudio: 'เลือกไฟล์เสียง/วิดีโอก่อน',
      longConfirm: 'ไฟล์นี้ยาว ~{min} นาที การถอดเสียงไฟล์ยาวขนาดนี้บนมือถืออาจทำให้เบราว์เซอร์ค้างหรือแครชกลางทาง (หน่วยความจำจำกัดกว่าคอม) แนะนำให้ใช้คอมพิวเตอร์แทน หรือตัดไฟล์ให้สั้นลงก่อน — กดตกลงถ้าต้องการลองต่อบนมือถือนี้เลย',
      cancelled: 'ยกเลิกแล้ว', decoding: 'กำลังถอดรหัสไฟล์เสียง…', doneCloud: 'ถอดเสียงเสร็จแล้ว (คลาวด์)', doneEmpty: 'ถอดเสียงเสร็จแต่ไม่พบคำพูดในไฟล์นี้', asrFail: 'ถอดเสียงไม่สำเร็จ: {msg}',
      prepAsr: 'กำลังเตรียมโมเดล AI (ครั้งแรกอาจต้องดาวน์โหลดจาก Hugging Face หลายสิบ MB — ครั้งต่อไปจะเร็วขึ้นเพราะแคชไว้แล้ว)…', transcribing: 'กำลังถอดเสียงเป็นข้อความ…', asrDone: 'ถอดเสียงเสร็จแล้ว', copied: 'คัดลอกข้อความแล้ว',
      noTranscript: 'ยังไม่มีข้อความที่ถอดเสียงไว้', noIos: 'โหมดนี้ไม่รองรับบน iPhone/iPad (เบราว์เซอร์มือถือรุ่นนี้รันโมเดล AI แบบนี้ไม่เสถียร) — ใช้คอมพิวเตอร์แทน', noDocx: 'โหลดไลบรารีสร้างไฟล์ Word ไม่สำเร็จ ลองรีเฟรชหน้านี้ใหม่',
      sumCloud: 'กำลังสรุปด้วย AI บนคลาวด์…', sumLocalPrep: 'กำลังเตรียมโมเดล AI…', sumFallback: '{msg} — สลับไปใช้โมเดลในเบราว์เซอร์แทน…', sumEmpty: 'สรุปไม่สำเร็จ ไม่ได้คำตอบจากโมเดล', sumDone: 'สรุปเสร็จแล้ว ตรวจทานก่อนดาวน์โหลดได้เลย', sumFail: 'สรุปไม่สำเร็จ: {msg}',
      sumPart: 'กำลังสรุปช่วงที่ {i}/{n}…', sumMerge: 'กำลังรวมเป็นสรุปฉบับเดียว…', sumPartCloud: 'กำลังสรุปช่วงที่ {i}/{n} (คลาวด์)…',
      asrSegment: 'กำลังถอดเสียงช่วงที่ {i}/{n}…', offlineLocal: 'ออฟไลน์ — ถอดเสียงในเบราว์เซอร์แทน', asrCancel: 'ยกเลิก', useCloud: 'ใช้โหมดคลาวด์แทน',
      mobileNote: 'บนมือถือใช้ได้เฉพาะโมเดลเล็ก/กลาง — โหมดคลาวด์แม่นกว่าและไม่ใช้หน่วยความจำของเครื่อง'
    },
    en: {
      title: 'Speech ↔ text | Tanot', crumbHome: 'Home', crumb: 'Text to speech', h1: 'Speech ↔ text',
      cardText: 'Text', attach: 'Attach file', useOcr: 'Use OCR on scanned pages/images (slower)',
      textPh: 'Type or paste text here (Thai or English), or use Attach file above', textLabel: 'Text',
      cardLive: 'Listen now (browser voice)', voice: 'Voice', rate: 'Speed', play: 'Play', pause: 'Pause', stop: 'Stop',
      cardMake: 'Create a downloadable audio file (.wav / .mp3)', badgeAi: 'AI voice (MMS-TTS)', lang: 'Language', langTh: 'Thai', langEn: 'English', make: 'Create audio file', dlWav: 'Download .wav', dlMp3: 'Download .mp3',
      cardAsr: 'Audio/video → text', asrFile: 'Audio/video file', asrAuto: 'Auto-detect', modelSize: 'Model size',
      mTiny: 'Small (fast, ~75MB)', mBase: 'Medium (more accurate, ~145MB)', mSmall: 'Large (much more accurate, ~250MB, slower to load/run)', mMedium: 'Extra large (most accurate, ~750MB-1GB, very slow to load/run — may be too heavy for phones/low-end devices)',
      engineLabel: 'Transcribe with', engineLocal: 'In browser (free)', engineCloud: 'Cloud (more accurate)', asrGo: 'Transcribe to text', copy: 'Copy text', sumMeeting: 'Summarize meeting with AI', dlDocx: 'Download as Word (.docx)',
      chars: '{n} characters', reading: 'Reading file…', readingOcr: 'Reading with OCR, page/image {page}/{total} (may take a moment per page)…', readingPdf: 'Reading PDF page {page}/{total}…',
      noReader: 'Could not load the file reader (slow or blocked network?). Try reloading the page', readingFile: 'Reading {name}…', noText: 'No text found in this file',
      imported: 'Imported text from {name} ({n} characters) — review it before pressing "Create audio file"', readFail: 'Could not read the file: {msg}',
      noWebSpeech: '(This browser does not support the Web Speech API)', noVoices: '(No voices found yet — some browsers load slowly, wait a moment)', defaultVoice: ' — default',
      typeFirst: 'Type some text first', playing: 'Playing…', played: 'Finished playing', playFail: 'Playback failed: {msg}', paused: 'Paused',
      v_default: 'Default', v_podcast: 'Female (podcast tone)', v_female: 'Female (general)', v_male: 'Male (general)',
      etaFew: 'a few seconds left', etaSec: 'about {s} seconds left', etaMin: 'about {m} min left', etaMinSec: 'about {m} min {s} s left',
      emptyAfterFilter: 'Nothing is left after removing characters the model does not know. Try typing in Thai',
      prepTh: 'Preparing the voice model (the first time it downloads from Hugging Face — later runs are faster because it is cached)…',
      prepEn: 'Preparing the voice model (the first time it may download tens of MB from Hugging Face — later runs are faster because it is cached)…',
      dlModel: 'Downloading model: {file}', dlModelPct: 'Downloading model: {file} ({pct}%)', chunksDone: 'Generated {done}/{total} segments', creating: 'Generating audio… (may take several minutes on a slow device)',
      assembling: 'Assembling the audio file…', made: 'Audio file ready — play it or download it below', makeFail: 'Could not create the audio file: {msg} [model={model}, dtype={dtype}]',
      dtypeDefault: 'browser default (usually q8)', cantDecode: 'Could not decode this file — try another audio/video type (mp3/wav/mp4/webm)',
      noAudioCtx: 'This browser does not support the Web Audio API needed to convert to mp3', wavFail: 'Could not decode the .wav file', noAudioData: 'No audio data came back', noWorker: 'Could not create a Web Worker',
      neuronUse: 'Used today {used} / {limit} Neurons (~{hours} h of audio left free)',
      costConfirm: 'This audio is ~{min} min long and needs ~{need} Neurons, but only {left} Neurons of the free quota are left today ({used}/{limit} used) — the extra ~{over} Neurons will cost real money (~${cost}). Press OK to continue or Cancel to stop',
      mcTiny: 'Small · newer build (WebGPU-ready)', mcBase: 'Medium · newer build (WebGPU-ready)', mcSmall: 'Large · newer build (WebGPU-ready, much more accurate)', mcLarge: 'Extra large · large-v3-turbo (WebGPU only, big download)',
      mtThSmall: 'Thai-tuned (Thonburian) small', mtThMedium: 'Thai-tuned (Thonburian) medium', thaiModelNote: 'Thonburian models are trained mainly for Thai — for English audio, pick another model',
      domainLabel: 'Content type (domain terms)', domGeneral: 'General', domLaw: 'Law', domEng: 'Electrical / engineering', domInvest: 'Investing',
      showTime: 'Show timestamps [hh:mm:ss]', gpuFallback: 'WebGPU unavailable, using WASM', modelFallback: 'Could not load the newer model, using the previous one',
      cancelledQuota: 'Cancelled (over today\'s free quota)', cloudChunk: 'Transcribing in the cloud… segment {i}/{n}', pickAudio: 'Choose an audio/video file first',
      longConfirm: 'This file is ~{min} min long. Transcribing something this long on a phone may freeze or crash the browser (less memory than a computer). We recommend a computer, or trimming the file first — press OK to try anyway on this phone',
      cancelled: 'Cancelled', decoding: 'Decoding the audio file…', doneCloud: 'Transcription finished (cloud)', doneEmpty: 'Transcription finished but no speech was found in this file', asrFail: 'Transcription failed: {msg}',
      prepAsr: 'Preparing the AI model (the first time it may download tens of MB from Hugging Face — later runs are faster because it is cached)…', transcribing: 'Transcribing to text…', asrDone: 'Transcription finished', copied: 'Text copied',
      noTranscript: 'There is no transcribed text yet', noIos: 'This mode is not supported on iPhone/iPad (mobile browsers cannot run this AI model reliably) — use a computer instead', noDocx: 'Could not load the Word file library. Try reloading this page',
      sumCloud: 'Summarizing with AI in the cloud…', sumLocalPrep: 'Preparing the AI model…', sumFallback: '{msg} — switching to the in-browser model…', sumEmpty: 'Could not summarize — the model returned no answer', sumDone: 'Summary ready — review it before downloading', sumFail: 'Summary failed: {msg}',
      sumPart: 'Summarizing part {i}/{n}…', sumMerge: 'Merging into one summary…', sumPartCloud: 'Summarizing part {i}/{n} (cloud)…',
      asrSegment: 'Transcribing part {i}/{n}…', offlineLocal: 'Offline — transcribing in the browser instead', asrCancel: 'Cancel', useCloud: 'Use cloud mode instead',
      mobileNote: 'Phones can only use the small/medium models — cloud mode is more accurate and does not use this device\'s memory'
    }
  });
  /* บรรทัดสถานะ: st(id, fn, cls?) — fn คืนข้อความตามภาษาปัจจุบัน (วาดซ้ำเองตอนสลับภาษา) · fn=null ล้างข้อความ */
  function st(id, fn, cls) {
    var el = $(id); if (!el) return;
    if (cls !== undefined) el.className = 'status' + (cls ? ' ' + cls : '');
    OME_I18N.live(el, typeof fn === 'function' ? fn : null);
    if (typeof fn !== 'function') el.textContent = fn || '';
  }
  function mediaErrText(e) {
    if (e && e.name === 'AiError' && window.AiClient) return AiClient.friendlyMessage(e); // โควตาเต็ม/ล็อกอินหมดอายุ/ออฟไลน์ ฯลฯ — ข้อความกลางเดียวกับทุกหน้า
    return window.TanotMedia && e && e.code ? TanotMedia.errorText(e) : errText(e);
  }
  function errText(e) { return window.TanotFileReader && TanotFileReader.errorText ? TanotFileReader.errorText(e) : (e && e.message ? e.message : String(e)); }

  /* ══════════════════ ตั้งค่า path ไฟล์ WASM ของ onnxruntime-web (ใช้ร่วมกันทั้ง TTS/ASR) ══════════════════
     แก้บั๊ก 2 ชั้นที่เจอจริงในโปรดักชัน:
     1) ตั้ง wasmPaths เป็น string เฉยๆ ('./vendor/transformers/') ทำให้ path ที่เบราว์เซอร์ขอจริง
        กลายเป็น .../vendor/transformers/vendor/transformers/ort-wasm-....mjs (ซ้ำโฟลเดอร์) เพราะ
        transformers.js จะเอา string นี้ไปประกอบกับชื่อไฟล์ default ของมันเองอีกที — ต้องตั้งเป็น
        object {mjs, wasm} ชี้ path เต็มตรงๆ แทน ถึงจะข้ามตรรกะประกอบ path ที่มีบั๊กนี้ไปได้
     2) เว็บนี้ไม่มี header COOP/COEP (GitHub/Cloudflare Pages ธรรมดาไม่ส่งให้) ทำให้ SharedArrayBuffer
        ใช้ไม่ได้ — ไฟล์ .wasm รุ่น "threaded" ปกติ (ที่ฝังไว้แต่แรก) คอมไพล์มาแบบ pthread ต้องพึ่ง
        SharedArrayBuffer เสมอไม่ว่าจะตั้ง numThreads=1 หรือไม่ก็ตาม จึงโหลดไม่ได้จริง — ต้องใช้รุ่น
        "asyncify" (คอมไพล์แบบ single-thread ล้วนๆ ไม่พึ่ง pthread/SharedArrayBuffer) แทน ยกเว้น Safari
        ที่ตัว onnxruntime-web เองแนะนำให้ใช้รุ่น threaded ปกติ (ตรรกะเดียวกับ default ของไลบรารี
        เอง แค่ชี้ไปไฟล์ที่ฝังในเว็บนี้แทน jsdelivr)
     ⚠️ ไฟล์ vendor onnxruntime-web ทั้งชุด pin ไว้ที่ 1.24.3 ตั้งใจ ห้ามอัปเดตเฉยๆ — ดูเหตุผลเต็มที่
        คอมเมนต์เหนือ configureOnnxWasmPaths ใน tts-worker.js (บั๊ก TransposeDQWeightsForMatMulNBits
        ในเวอร์ชัน 1.25+ ที่ทำให้สร้าง session พังกับโมเดล quantized บางตัวรวมถึง Whisper)
     ⚠️ 2026-09-28: ort-wasm-simd-threaded.asyncify.wasm หนัก 25.93 MiB เกินลิมิตไฟล์เดียว 25 MiB ของ
        Cloudflare Pages จึงย้ายกลับไปโหลดจาก jsDelivr (pin @1.24.3 เดียวกัน ห้ามใช้ "latest") แทนการ
        ฝังในเครื่อง — ไฟล์ .mjs (glue script) ยังฝังในเครื่องเหมือนเดิม (เล็ก ไม่ติดลิมิต) ส่วนไฟล์
        .wasm แบบ threaded ปกติ (เฉพาะ Safari) ~12 MiB ไม่เกินลิมิต ยังฝังในเครื่องต่อไป */
  var ONNX_ASYNCIFY_WASM_CDN_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.asyncify.wasm';
  function configureOnnxWasmPaths(env) {
    var isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
    env.backends.onnx.wasm.wasmPaths = isSafari
      ? { mjs: './vendor/transformers/ort-wasm-simd-threaded.mjs', wasm: './vendor/transformers/ort-wasm-simd-threaded.wasm' }
      : { mjs: './vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs', wasm: ONNX_ASYNCIFY_WASM_CDN_URL };
    env.backends.onnx.wasm.numThreads = 1; // ไม่มี SharedArrayBuffer อยู่แล้ว บังคับ single-thread กันค้าง
  }

  /* ══════════════════ ตัวนับตัวอักษร ══════════════════ */
  function updateCharCount() {
    OME_I18N.live($('ttsCharCount'), function () { return T('chars', { n: OME_I18N.number($('ttsText').value.length) }); });
  }

  /* ══════════════════ แนบไฟล์ → นำเข้าข้อความ (file-reader.js) ══════════════════
     รองรับ .txt/.docx/.xlsx/.xls/.csv/.pptx/.pdf/รูปภาพ — ดูรายละเอียดการอ่านแต่ละชนิดไฟล์ใน
     file-reader.js (ไฟล์กลาง ใช้ร่วมกับหน้าอื่นได้ในอนาคต ไม่ผูกกับ UI ของหน้านี้โดยเฉพาะ) */
  function formatImportProgress(p) {
    if (!p) return T('reading');
    if (p.stage === 'ocr') return T('readingOcr', { page: p.page, total: p.total });
    if (p.stage === 'pdf') return T('readingPdf', { page: p.page, total: p.total });
    return T('reading');
  }
  function importFileChange(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = ''; // เคลียร์ค่า input ไว้ กันเลือกไฟล์เดิมซ้ำแล้ว change event ไม่ยิง
    if (!file) return;
    if (!window.TanotFileReader) {
      $('importStatus').className = 'status err';
      st('importStatus', function () { return T('noReader'); });
      return;
    }
    $('importFileBtn').disabled = true;
    $('importStatus').className = 'status';
    st('importStatus', function () { return T('readingFile', { name: file.name }); });
    window.TanotFileReader.readAnyFile(file, {
      ocr: $('importOcrChk').checked,
      onProgress: function (p) { st('importStatus', function () { return formatImportProgress(p); }); }
    }).then(function (text) {
      text = (text || '').trim();
      if (!text) {
        $('importStatus').className = 'status err';
        st('importStatus', function () { return T('noText'); });
        return;
      }
      $('ttsText').value = text;
      updateCharCount();
      $('importStatus').className = 'status ok';
      st('importStatus', function () { return T('imported', { name: file.name, n: text.length }); });
    }).catch(function (err) {
      $('importStatus').className = 'status err';
      st('importStatus', function () { return T('readFail', { msg: errText(err) }); });
    }).finally(function () {
      $('importFileBtn').disabled = false;
    });
  }

  /* ══════════════════ โหมด 1: Web Speech API (เล่นสด) ══════════════════ */
  var wsVoices = [];
  function loadWsVoices() {
    wsVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    renderWsVoiceOptions();
  }
  function renderWsVoiceOptions() {
    var sel = $('wsVoice');
    var keep = sel.value;
    if (!window.speechSynthesis) {
      sel.innerHTML = '<option value="">' + T('noWebSpeech') + '</option>';
      $('wsPlayBtn').disabled = true;
      return;
    }
    if (!wsVoices.length) {
      sel.innerHTML = '<option value="">' + T('noVoices') + '</option>';
      return;
    }
    sel.innerHTML = wsVoices.map(function (v, i) {
      return '<option value="' + i + '">' + v.name + ' (' + v.lang + ')' + (v.default ? T('defaultVoice') : '') + '</option>';
    }).join('');
    var defaultIdx = wsVoices.findIndex(function (v) { return v.default; });
    if (keep !== '' && wsVoices[+keep]) sel.value = keep;
    else if (defaultIdx >= 0) sel.value = String(defaultIdx);
  }
  function wsPlay() {
    var text = $('ttsText').value;
    if (!text.trim()) { $('wsStatus').className = 'status err'; st('wsStatus', function () { return T('typeFirst'); }); return; }
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var idx = parseInt($('wsVoice').value, 10);
    if (wsVoices[idx]) { u.voice = wsVoices[idx]; u.lang = wsVoices[idx].lang; }
    u.rate = parseFloat($('wsRate').value) || 1;
    u.onstart = function () { $('wsStatus').className = 'status ok'; st('wsStatus', function () { return T('playing'); }); };
    u.onend = function () { $('wsStatus').className = 'status'; st('wsStatus', function () { return T('played'); }); };
    u.onerror = function (e) {
      if (e && e.error === 'interrupted') return; // ผู้ใช้กดหยุด/เล่นใหม่เอง ไม่ใช่ข้อผิดพลาดจริง
      $('wsStatus').className = 'status err'; st('wsStatus', function () { return T('playFail', { msg: e && e.error }); });
    };
    window.speechSynthesis.speak(u);
  }
  function wsPauseToggle() {
    if (!window.speechSynthesis) return;
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      $('wsStatus').className = 'status'; st('wsStatus', function () { return T('paused'); });
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      $('wsStatus').className = 'status ok'; st('wsStatus', function () { return T('playing'); });
    }
  }
  function wsStop() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    $('wsStatus').className = 'status'; st('wsStatus', null);
  }

  /* ══════════════════ โหมด 2: สร้างไฟล์เสียง (MMS-TTS ผ่าน transformers.js → wav → mp3) ══════════════════
     เดิมใช้ eSpeak NG แต่พบว่าโมดูลแปลภาษาไทยเป็นหน่วยเสียงของ eSpeak NG (ทั้งรุ่นที่ฝังไว้และรุ่นล่าสุด
     ที่คอมไพล์จากซอร์สทางการเองสดๆ) แปลผิดตั้งแต่ต้นทาง ฟังไม่รู้เรื่อง — เป็นข้อจำกัดของตัวเอนจินเอง
     ไม่ใช่เรื่องความเร็ว/พิทช์ จึงเปลี่ยนมาใช้ MMS-TTS (โมเดล AI จาก Meta รองรับ 1,100+ ภาษา) ผ่าน
     transformers.js แทน — เป็นโมเดลเสียงประสาทเทียมจริง (เสียงเป็นธรรมชาติกว่ามาก) แต่ละภาษาเป็นคนละ
     โมเดล ต้องดาวน์โหลดจาก Hugging Face ตอนใช้ครั้งแรกเหมือนโหมดถอดเสียงเป็นข้อความ */
  var ttsPipelinePromiseByModel = {};
  /* dtype ต่อโมเดล (เช่น "หญิง (โทนพอดแคสต์)" = fp32 เพราะไม่มีไฟล์ quantized) อยู่ใน media-models.js ที่เดียว —
     tts-worker.js อ่านไฟล์เดียวกัน (เดิมตารางซ้ำ 2 ชุดแล้วเคยลืมแก้คู่กันจนเกิดบั๊กแรมพุ่ง — ประวัติเต็มที่หัวไฟล์ media-models.js) */
  function ttsDtype(modelId) { return window.TanotMediaModels ? TanotMediaModels.ttsDtype(modelId) : null; }
  function loadTtsPipeline(modelId, onProgress) {
    if (!ttsPipelinePromiseByModel[modelId]) {
      ttsPipelinePromiseByModel[modelId] = import('./vendor/transformers/transformers.web.min.js').then(function (mod) {
        var env = mod.env;
        configureOnnxWasmPaths(env);
        var opts = { progress_callback: onProgress };
        if (ttsDtype(modelId)) opts.dtype = ttsDtype(modelId);
        return mod.pipeline('text-to-speech', modelId, opts);
      });
    }
    return ttsPipelinePromiseByModel[modelId];
  }
  function synthesizeMmsTts(text, modelId, onProgress) {
    return loadTtsPipeline(modelId, onProgress).then(function (synthesizer) {
      return synthesizer(text);
    }).then(function (output) {
      if (!output || !output.audio || !output.audio.length) throw new Error(T('noAudioData'));
      return output;
    });
  }
  /* ══════════════════ ตัดข้อความยาวเป็นท่อนสั้นๆ ก่อนสังเคราะห์เสียง ══════════════════
     เจอจริงในโปรดักชัน: วางข้อความยาว (เช่นย่อหน้ากฎหมายหลายพันตัวอักษร) แล้วทั้งแท็บค้าง/แครช
     (ไม่ใช่แค่ช้า) — โมเดล VITS คำนวณ attention แบบ O(n²) กับความยาวข้อความทั้งก้อน ยิ่งข้อความยาว
     หน่วยความจำ/เวลาคำนวณยิ่งพุ่งแบบทวีคูณ ไม่ใช่เชิงเส้น ตัดขนาดโมเดลให้เล็กลง (quantize) ก็ช่วย
     ได้แค่ความเร็วต่อท่อน ไม่ได้ช่วยเรื่องนี้เลยเพราะเป็นคนละสาเหตุกัน ทางแก้ที่ถูกต้องคือตัดข้อความ
     เป็นท่อนสั้นๆ ก่อนเสมอ แล้วสังเคราะห์ทีละท่อนต่อกัน (เรียงตามลำดับ ไม่ขนาน กันแย่งหน่วยความจำ) */
  var MAX_TTS_CHUNK_CHARS = 60;
  function splitIntoTtsChunks(text, maxLen) {
    maxLen = maxLen || MAX_TTS_CHUNK_CHARS;
    var lines = text.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    var chunks = [];
    lines.forEach(function (line) {
      while (line.length > maxLen) {
        var head = line.slice(0, maxLen);
        var punctIdx = Math.max(head.lastIndexOf('.'), head.lastIndexOf('ๆ'), head.lastIndexOf('ฯ'));
        var spaceIdx = head.lastIndexOf(' ');
        var cut = punctIdx > 10 ? punctIdx + 1 : (spaceIdx > 10 ? spaceIdx : maxLen);
        chunks.push(line.slice(0, cut).trim());
        line = line.slice(cut).trim();
      }
      if (line) chunks.push(line);
    });
    return chunks;
  }
  function concatFloat32Arrays(arrays, gapSamples) {
    gapSamples = gapSamples || 0;
    var total = arrays.reduce(function (sum, a) { return sum + a.length; }, 0) + gapSamples * Math.max(0, arrays.length - 1);
    var out = new Float32Array(total);
    var offset = 0;
    arrays.forEach(function (a, i) {
      out.set(a, offset);
      offset += a.length + (i < arrays.length - 1 ? gapSamples : 0);
    });
    return out;
  }
  /* สังเคราะห์เสียงทีละท่อนเรียงลำดับบนเธรดหลัก — ทางสำรองเฉพาะเบราว์เซอร์ที่ไม่มี Web Worker / โหลด Worker แบบ module
     ไม่ได้เลย (บล็อกหน้าระหว่างคำนวณ) · ไม่ใช้เป็นทางถอยเมื่อ Worker หน่วยความจำไม่พอ (ย้ายงานหนักเดิมมาเธรดหลักมีแต่จะแครชทั้งแท็บ)
     pipeline ถูกแคชไว้แล้วหลังท่อนแรก (ดู loadTtsPipeline) · onProgress(done, total) เรียกหลังแต่ละท่อนเสร็จ (ความหมายเดียวกับพูล)
     คืน { parts: Float32Array[], sampling_rate } — ต่อรวมทีหลังใน encodeAudio() */
  function synthesizeMmsTtsChunks(chunks, modelId, onModelProgress, onProgress) {
    var audioParts = [], samplingRate = null, done = 0;
    return chunks.reduce(function (p, chunk) {
      return p.then(function () {
        return synthesizeMmsTts(chunk, modelId, onModelProgress);
      }).then(function (output) {
        samplingRate = output.sampling_rate;
        audioParts.push(output.audio);
        done++;
        if (onProgress) onProgress(done, chunks.length);
      });
    }, Promise.resolve()).then(function () {
      return { parts: audioParts, sampling_rate: samplingRate };
    });
  }
  /* ══════════════════ พูล Web Worker สังเคราะห์เสียง (tts-worker.js) ══════════════════
     Worker หลายตัวคำนวณท่อนข้อความขนานกัน (หน้าเว็บไม่ค้าง + ใช้หลาย core) — แต่ละ Worker โหลดโมเดลเป็นสำเนาของตัวเอง
     (WASM linear memory แยกก้อน) เดิมปล่อยงานให้ตัวที่เหลือ "พร้อมกันทั้งหมด" ทันทีที่ตัวแรกโหลดเสร็จ → ทุกตัวโหลด/คำนวณ
     พร้อมกัน หน่วยความจำพีคตอน "โหลดเสร็จ" (สาเหตุแท็บแครช) · 2026-10 เปลี่ยนเป็น:
     1) ทยอยสร้าง: ตัวแรกโหลด + อุ่นเครื่อง (ท่อนแรกเสร็จ) ก่อน แล้วค่อยสร้างตัวถัดไปทีละตัว — ตัวที่ k+1 เริ่มหลังตัวที่ k
        สร้างท่อนแรกเสร็จ (ครั้งแรกสุดไม่มีแคช = ดาวน์โหลดโมเดลครั้งเดียว ตัวหลังๆ อ่านจากแคช)
     2) คิวกลาง: Worker ที่ว่างดึงท่อนถัดไปเอง (ทีละ 1 ท่อน) — ตัวที่เริ่มช้ากว่าไม่ต้องรอส่วนแบ่งตายตัวแบบ round-robin เดิม
     3) จำนวน Worker: iOS = 1 เสมอ · โมเดล fp32 (ไฟล์ใหญ่กว่า q8 หลายเท่า) = 1 เสมอทุกเครื่อง · อื่นๆ ตาม ttsPoolSize()
     4) ว่างเกิน 2 นาที → ปิดทั้งพูลคืนแรม (ครั้งหน้าสร้างใหม่ โหลดโมเดลจากแคช) · เปลี่ยนโมเดล/ผิดพลาด → ปิดทั้งพูล
     5) ลงทะเบียนกับงบหน่วยความจำกลาง (TanotMedia.budget) — บนมือถือโหลดโมเดลอื่นจะปิดพูลนี้ก่อน */
  var TTS_IDLE_MS = 120000;
  var ttsPool = { workers: [], model: null, idleTimer: null, job: null };
  var ttsJobSeq = 0;
  function ttsPoolSize(modelId) {
    if (window.TanotMedia && TanotMedia.isIOS()) return 1; // iPhone/iPad: เพดานแรมต่อแท็บของ WebKit ต่ำ — เคยเจอ RangeError: Out of memory ตอน 4 Worker
    if (modelId && ttsDtype(modelId) === 'fp32') return 1;
    var cores = navigator.hardwareConcurrency || 2;
    var mem = navigator.deviceMemory; // GB — มีเฉพาะ Chrome/Edge เท่านั้น เบราว์เซอร์อื่น (รวม Safari/iOS
    // ทั้งหมด ไม่มีข้อยกเว้น) เป็น undefined เสมอ — เจอจริงว่า iPhone ทุกรุ่นจะได้ mem=undefined ไม่ว่า
    // เครื่องนั้นจะแรมเยอะแค่ไหนก็ตาม พลาดจากเดิมที่ตั้งดีฟอลต์เป็น "สันนิษฐานว่าแรมเยอะ" (cap=4) เมื่อ
    // ไม่รู้ค่า — กลับด้านลอจิกใหม่: ไม่รู้ค่า = ระมัดระวังไว้ก่อน (cap=2 เหมือนเครื่องแรมน้อยที่ยืนยันแล้ว)
    // ค่อยขยับเป็น cap=4 เฉพาะตอนที่ "ยืนยันแล้วจริง" ว่าแรมเยอะพอ (mem>=4, มีแค่ Chrome/Edge ที่รายงานได้)
    // เหตุผล: แต่ละ Worker โหลดโมเดลเป็นสำเนาของตัวเอง (WASM linear memory แยกก้อนกันคนละ Worker) ยิ่ง
    // ขนานเยอะยิ่งใช้แรมพร้อมกันเยอะขึ้นเป็นทวีคูณ — เจอจริงว่า iPhone (deviceMemory เป็น undefined จึง
    // เคยได้ cap=4 มาตลอด) รัน 4 Worker ขนานพร้อมกันจนได้ "RangeError: Out of memory" จาก WASM รันไทม์
    var cap = 2;
    if (mem && mem >= 4) cap = 4;
    return Math.max(1, Math.min(cores, cap));
  }
  function ttsPoolKill(code) {
    clearTimeout(ttsPool.idleTimer); ttsPool.idleTimer = null;
    ttsPool.workers.forEach(function (w) { try { w.terminate(); } catch (e) {} });
    ttsPool.workers = []; ttsPool.model = null;
    if (window.TanotMedia) TanotMedia.budget.release('tts');
    var job = ttsPool.job; ttsPool.job = null;
    if (job) job.fail(TanotMedia.error(code || 'evicted'));
  }
  function ttsPoolIdle() {
    clearTimeout(ttsPool.idleTimer);
    ttsPool.idleTimer = setTimeout(function () { if (!ttsPool.job) ttsPoolKill(); }, TTS_IDLE_MS);
  }
  function synthesizeMmsTtsChunksInWorkerPool(chunks, modelId, onModelProgress, onProgress) {
    return new Promise(function (resolve, reject) {
      clearTimeout(ttsPool.idleTimer);
      if (ttsPool.job || (ttsPool.workers.length && ttsPool.model !== modelId)) ttsPoolKill('abort');
      TanotMedia.budget.acquire('tts', function () { ttsPoolKill('evicted'); });
      TanotMedia.persistOnce();
      ttsPool.model = modelId;
      var jobId = ++ttsJobSeq, total = chunks.length, size = Math.max(1, Math.min(ttsPoolSize(modelId), total));
      var queue = chunks.map(function (c, i) { return i; }), results = new Array(total), samplingRate = null, doneCount = 0, settled = false;
      var job = { fail: fail };
      ttsPool.job = job;
      function fail(err) {
        if (settled) return; settled = true;
        if (ttsPool.job === job) ttsPool.job = null;
        reject(err);
      }
      function finish() {
        settled = true; ttsPool.job = null;
        ttsPoolIdle();
        resolve({ parts: results, sampling_rate: samplingRate });
      }
      function feed(w) {
        if (settled || !queue.length) { w._busy = false; return; }
        var i = queue.shift();
        w._busy = true;
        w.postMessage({ type: 'synthesize-batch', jobId: jobId, items: [{ i: i, text: chunks[i] }], modelId: modelId });
      }
      function spawnNext() {
        if (settled || ttsPool.workers.length >= size || !queue.length) return;
        var w;
        try { w = new Worker('./tts-worker.js', { type: 'module' }); }
        catch (e) { if (!ttsPool.workers.length) { var ne = TanotMedia.error('noWorker'); ne.workerLoad = true; fail(ne); } return; }
        w._heard = false; w._warm = false; w._busy = false;
        ttsPool.workers.push(w);
        w.addEventListener('message', function (e) {
          var msg = e.data;
          w._heard = true;
          if (!msg || msg.jobId !== jobId || settled) return;
          if (msg.type === 'model-progress') { if (onModelProgress) onModelProgress({ status: 'progress', file: msg.file, progress: msg.progress }); }
          else if (msg.type === 'item-done') {
            results[msg.i] = msg.audio;
            samplingRate = msg.samplingRate;
            doneCount++;
            if (onProgress) onProgress(doneCount, total);
            if (!w._warm) { w._warm = true; spawnNext(); } // ตัวนี้โหลด + อุ่นเครื่องเสร็จแล้ว → ค่อยเริ่มตัวถัดไป
            if (doneCount === total) finish();
          } else if (msg.type === 'batch-done') { feed(w); }
          else if (msg.type === 'item-error') {
            var cause = { name: msg.name || 'Error', message: msg.message || '' };
            var oom = TanotMedia.isMemoryError(cause);
            ttsPool.job = null; ttsPoolKill(); // หน่วยความจำของพูลอาจเสียแล้ว — ทิ้งทั้งชุด
            fail(TanotMedia.error(oom ? 'oom' : 'tts', oom ? null : msg.message, cause));
          }
        });
        w.addEventListener('error', function (e) {
          if (e && e.preventDefault) e.preventDefault();
          if (settled) return;
          var heard = w._heard;
          ttsPool.job = null; ttsPoolKill();
          var err = TanotMedia.error('crash', null, { name: 'WorkerError', message: (e && e.message) || 'worker crashed' });
          err.workerLoad = !heard && doneCount === 0; // Worker ไม่เคยตอบอะไรเลย = โหลดสคริปต์ไม่ได้ (เบราว์เซอร์ไม่รองรับ module worker)
          fail(err);
        });
        feed(w);
      }
      spawnNext();
    });
  }
  function synthesizeMmsTtsChunksResponsive(chunks, modelId, onModelProgress, onProgress) {
    if (typeof Worker === 'undefined' || !window.TanotMedia) return synthesizeMmsTtsChunks(chunks, modelId, onModelProgress, onProgress);
    return synthesizeMmsTtsChunksInWorkerPool(chunks, modelId, onModelProgress, onProgress).catch(function (err) {
      if (!err || !err.workerLoad) throw err; // หน่วยความจำไม่พอ/โมเดลผิดพลาด — ไม่ย้ายงานหนักมาเธรดหลัก (จะแครชทั้งแท็บ)
      console.warn('สร้าง Web Worker ไม่ได้ กลับไปรันในหน้าเว็บโดยตรงแทน (หน้าอาจค้างชั่วคราวระหว่างคำนวณ):', err);
      return synthesizeMmsTtsChunks(chunks, modelId, onModelProgress, onProgress);
    });
  }
  /* ต่อเสียง + ทำ .wav/.mp3 ใน audio-encode-worker.js (เดิมทำบนเธรดหลัก — หน้าค้างตอนท้าย) → { wav: Blob, mp3: Blob }
     ส่ง Float32Array แต่ละท่อนแบบ transfer (ไม่ copy) · ไม่มี Worker = ทำบนเธรดหลักแบบเดิม */
  var TTS_GAP_SEC = 0.3;
  function encodeAudio(parts, sampleRate) {
    var w = null;
    if (typeof Worker !== 'undefined') { try { w = new Worker('./audio-encode-worker.js'); } catch (e) { w = null; } }
    if (!w) {
      var audio = concatFloat32Arrays(parts, Math.round(sampleRate * TTS_GAP_SEC));
      var wavBlob = float32ToWavBlob(audio, sampleRate);
      return wavBlob.arrayBuffer().then(function (buf) {
        return wavBytesToMp3Blob(new Uint8Array(buf)).then(function (mp3) { return { wav: wavBlob, mp3: mp3 }; });
      });
    }
    return new Promise(function (resolve, reject) {
      w.onmessage = function (e) {
        var m = e.data; w.terminate();
        if (m && m.type === 'done') resolve({ wav: new Blob([m.wav], { type: 'audio/wav' }), mp3: new Blob([m.mp3], { type: 'audio/mpeg' }) });
        else reject(TanotMedia.error('encode', m && m.message, m));
      };
      w.onerror = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        w.terminate();
        reject(TanotMedia.error('crash', null, { name: 'WorkerError', message: (e && e.message) || 'encode worker crashed' }));
      };
      w.postMessage({ type: 'encode', parts: parts, sampleRate: sampleRate, gapSec: TTS_GAP_SEC, kbps: 128 }, parts.map(function (p) { return p.buffer; }));
    });
  }
  /* ห่อ Float32Array ตัวอย่างเสียงดิบเป็นไฟล์ .wav มาตรฐาน (mono, PCM 16-bit) — MMS-TTS คืนมาเป็น
     ตัวเลขดิบล้วนๆ ไม่ใช่ไฟล์สำเร็จรูปแบบที่ eSpeak NG เคยให้ ต้องประกอบ WAV header เอง */
  function float32ToWavBlob(samples, sampleRate) {
    var pcm = floatTo16BitPCM(samples);
    var buf = new ArrayBuffer(44 + pcm.length * 2);
    var view = new DataView(buf);
    function writeStr(offset, s) { for (var i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); }
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); writeStr(8, 'WAVE');
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeStr(36, 'data'); view.setUint32(40, pcm.length * 2, true);
    for (var i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);
    return new Blob([buf], { type: 'audio/wav' });
  }
  function floatTo16BitPCM(floatArr) {
    var out = new Int16Array(floatArr.length);
    for (var i = 0; i < floatArr.length; i++) {
      var s = Math.max(-1, Math.min(1, floatArr[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }
  function wavBytesToMp3Blob(wavBytes) {
    return new Promise(function (resolve, reject) {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) { reject(new Error(T('noAudioCtx'))); return; }
      var audioCtx = new AudioCtx();
      var ab = wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength);
      audioCtx.decodeAudioData(ab, function (audioBuffer) {
        try {
          var channels = audioBuffer.numberOfChannels;
          var sampleRate = audioBuffer.sampleRate;
          var encoder = new window.lamejs.Mp3Encoder(channels, sampleRate, 128);
          var mp3Chunks = [];
          var left = floatTo16BitPCM(audioBuffer.getChannelData(0));
          var right = channels > 1 ? floatTo16BitPCM(audioBuffer.getChannelData(1)) : null;
          var blockSize = 1152;
          for (var i = 0; i < left.length; i += blockSize) {
            var leftChunk = left.subarray(i, i + blockSize);
            var buf;
            if (right) { buf = encoder.encodeBuffer(leftChunk, right.subarray(i, i + blockSize)); }
            else { buf = encoder.encodeBuffer(leftChunk); }
            if (buf.length > 0) mp3Chunks.push(new Int8Array(buf));
          }
          var endBuf = encoder.flush();
          if (endBuf.length > 0) mp3Chunks.push(new Int8Array(endBuf));
          resolve(new Blob(mp3Chunks, { type: 'audio/mpeg' }));
        } catch (e) { reject(e); }
        finally { audioCtx.close(); }
      }, function (err) { audioCtx.close(); reject(err || new Error(T('wavFail'))); });
    });
  }
  var lastWavUrl = null, lastMp3Url = null;
  function showResult(wavUrl, mp3Url) {
    if (lastWavUrl) URL.revokeObjectURL(lastWavUrl);
    if (lastMp3Url) URL.revokeObjectURL(lastMp3Url);
    lastWavUrl = wavUrl; lastMp3Url = mp3Url;
    $('dlPlayerWrap').style.display = 'block';
    $('dlAudio').src = mp3Url;
    $('dlWavLink').href = wavUrl;
    $('dlMp3Link').href = mp3Url;
  }
  var TTS_VOICES = {
    th: [
      { id: 'Tanotfin/mms-tts-2081-onnx', label: 'ค่าเริ่มต้น', k: 'v_default' },
      { id: 'phlebotomy1996/mms-thai-female-podcast-spk0', label: 'หญิง (โทนพอดแคสต์)', k: 'v_podcast' },
      { id: 'Tanotfin/mms-tts-2081-FM-onnx', label: 'หญิง (ทั่วไป)', k: 'v_female' },
      { id: 'Tanotfin/mms-tts-2081-M-onnx', label: 'ชาย (ทั่วไป)', k: 'v_male' }
    ],
    en: [
      { id: 'Xenova/mms-tts-eng', label: 'ค่าเริ่มต้น', k: 'v_default' }
    ]
  };
  function renderVoiceOptions() {
    var lang = $('dlLang').value, keep = $('dlVoice').value;
    var voices = TTS_VOICES[lang] || TTS_VOICES.th;
    $('dlVoice').innerHTML = voices.map(function (v) { return '<option value="' + v.id + '">' + T(v.k) + '</option>'; }).join('');
    if (keep) $('dlVoice').value = keep;
  }

  /* ══════════════════ ปรับข้อความก่อนส่งเข้าโมเดลเสียงไทย (Tanotfin/mms-tts-2081-onnx) ══════════════════
     เจอจริงในโปรดักชัน: โมเดลนี้เทรนมาด้วยอักษรไทยล้วนๆ (vocab แค่ 71 ตัวอักษร ไม่รวม <unk>) ตัวเลข
     อารบิกมีอยู่ในนั้นแค่บางส่วน (0,1,2,4 เท่านั้น ไม่มี 3,5,6,7,8,9) — เจอเลขที่ไม่อยู่ใน vocab
     (เช่น "9" ใน "149") จะโดนแมปเป็น <unk> ซึ่งเป็น id ที่ตาราง embedding ของโมเดลไม่มีจริง (bug เดิม
     ที่ติดมาจากโมเดลต้นฉบับของ Meta เอง ไม่ใช่ที่เราทำพลาด) ทำให้พังกลางคัน (ONNX Runtime error:
     Gather node index out of bounds) จึงต้องแปลงตัวเลขทุกตัวเป็นคำอ่านภาษาไทยก่อนเสมอ (กันปัญหาทั้ง
     เลขที่มีจริงและไม่มีใน vocab ให้พฤติกรรมสม่ำเสมอ) แล้วกรองอักขระอื่นที่ไม่อยู่ใน vocab ทิ้ง (แทนที่
     ด้วยช่องว่าง) กันพังจากตัวอักษรแปลกอื่นๆ ที่อาจพิมพ์ปนมา (อังกฤษ, อีโมจิ, สัญลักษณ์แปลกๆ) */
  var THAI_DIGIT_WORDS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  var THAI_PLACE_WORDS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  function thaiNumberToWords(numStr) {
    numStr = numStr.replace(/^0+(?=\d)/, '');
    if (numStr === '' || numStr === '0') return THAI_DIGIT_WORDS[0];
    if (numStr.length > 7) return numStr.split('').map(function (c) { return THAI_DIGIT_WORDS[+c]; }).join(''); // เลขยาวเกินหลักล้าน อ่านทีละตัวกันซับซ้อนเกินจำเป็น
    var digits = numStr.split('').map(Number), n = digits.length, words = '';
    for (var i = 0; i < n; i++) {
      var place = n - 1 - i, d = digits[i];
      if (d === 0) continue;
      if (place === 0) words += (d === 1 && n > 1) ? 'เอ็ด' : THAI_DIGIT_WORDS[d];
      else if (place === 1) words += (d === 1) ? 'สิบ' : (d === 2) ? 'ยี่สิบ' : THAI_DIGIT_WORDS[d] + 'สิบ';
      else words += THAI_DIGIT_WORDS[d] + THAI_PLACE_WORDS[place];
    }
    return words;
  }
  var THAI_TTS_VALID_CHARS = 'าน่รเ้อกงวะัมทพยลจีคตดหขิแสบปไูใ็ื์ชุึํโผถญซธศณษฟภฉฝฐฤฏฮฆ๋ฎ\'0๊ฑ142-ฬฒฌ ';
  function normalizeForThaiTts(text) {
    var withWords = text.replace(/\d+/g, thaiNumberToWords);
    var out = '';
    for (var i = 0; i < withWords.length; i++) {
      var ch = withWords[i];
      out += THAI_TTS_VALID_CHARS.indexOf(ch) !== -1 ? ch : ' ';
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  /* แปลงวินาทีเป็นข้อความอ่านง่าย ใช้โชว์เวลาที่เหลือโดยประมาณ (ETA) ระหว่างสร้างเสียง */
  function formatEta(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 5) return T('etaFew');
    if (sec < 60) return T('etaSec', { s: sec });
    var m = Math.floor(sec / 60), s = sec % 60;
    return s > 0 ? T('etaMinSec', { m: m, s: s }) : T('etaMin', { m: m });
  }
  function generateDownloadable() {
    var rawText = $('ttsText').value;
    if (!rawText.trim()) { $('dlStatus').className = 'status err'; st('dlStatus', function () { return T('typeFirst'); }); return; }
    var lang = $('dlLang').value;
    var modelId = $('dlVoice').value;
    var chunks = splitIntoTtsChunks(rawText);
    if (lang === 'th') {
      chunks = chunks.map(normalizeForThaiTts).filter(Boolean);
      if (!chunks.length) { $('dlStatus').className = 'status err'; st('dlStatus', function () { return T('emptyAfterFilter'); }); return; }
    }
    $('dlGenerateBtn').disabled = true;
    $('dlStatus').className = 'status';
    st('dlStatus', function () { return T(lang === 'th' ? 'prepTh' : 'prepEn'); });
    var startedAt = Date.now(), stage = 'synth';
    synthesizeMmsTtsChunksResponsive(chunks, modelId, function (p) {
      if (p && p.status === 'progress' && p.file) {
        var pct = p.progress != null ? Math.round(p.progress) : null;
        st('dlStatus', function () { return pct != null ? T('dlModelPct', { file: p.file, pct: pct }) : T('dlModel', { file: p.file }); });
      }
    }, function (done, total) {
      /* นับความคืบหน้าหลังท่อนเสร็จ (ไม่ใช่ก่อนเริ่ม) — ใช้ตัวเลขเดียวกันคำนวณ ETA ได้ทั้งตอนรันขนาน
         หลาย Worker พร้อมกันและตอน fallback รันทีละท่อนในหน้าเว็บตรงๆ เพราะเป็นอัตราความเร็วรวมจริง
         ไม่ผูกกับว่ามีกี่ Worker ทำงานอยู่ */
      var elapsed = (Date.now() - startedAt) / 1000;
      var eta = (done > 0 && done < total) ? (elapsed / done) * (total - done) : null;
      st('dlStatus', function () {
        return total > 1
          ? T('chunksDone', { done: done, total: total }) + (eta != null ? ' — ' + formatEta(eta) : '')
          : T('creating');
      });
    })
      .then(function (output) {
        stage = 'encode';
        st('dlStatus', function () { return T('assembling'); });
        return encodeAudio(output.parts, output.sampling_rate).then(function (files) {
          showResult(URL.createObjectURL(files.wav), URL.createObjectURL(files.mp3));
          $('dlStatus').className = 'status ok';
          st('dlStatus', function () { return T('made'); });
        });
      })
      .catch(function (e) {
        $('dlStatus').className = 'status err';
        if (window.TanotMedia) TanotMedia.logError('tts', e, { stage: stage, engine: 'local', model: modelId, lang: lang });
        /* ใส่ modelId + dtype ที่ใช้จริงต่อท้าย error เสมอ (เพิ่มเข้ามาเพื่อวินิจฉัยปัญหา cache เก่า
           ค้าง vs. ปัญหาโมเดลจริง — ถ้า error หน้าเว็บบอก dtype ไม่ตรงกับที่โค้ดล่าสุดควรใช้ แปลว่า
           browser/service worker ยังไม่ได้โหลดโค้ดใหม่จริง ไม่ใช่โมเดลพัง) */
        var usedDtype = ttsDtype(modelId);
        st('dlStatus', function () { return T('makeFail', { msg: mediaErrText(e), model: modelId, dtype: usedDtype || T('dtypeDefault') }); });
      })
      .finally(function () { $('dlGenerateBtn').disabled = false; });
  }

  /* ══════════════════ เสียง/วิดีโอ → ข้อความ ══════════════════
     ในเบราว์เซอร์: Whisper (transformers.js) ใน asr-worker.js ผ่าน TanotMedia.transcribeLocal (media-core.js)
     2026-10 แก้สาเหตุที่หน้าค้าง/แครช:
     (1) เดิมรัน pipeline Whisper บนเธรดหลัก (loadAsrPipeline) — WASM เธรดเดียวบล็อกหน้าทั้งหน้า แล้วแครชหลังโหลดโมเดลเสร็จ → ย้ายไป Worker
     (2) เดิมถอดรหัสทั้งไฟล์ที่ความถี่เดิมแล้ว resample (decodeFileToPcm) — ไฟล์ยาวใช้แรมมหาศาล → TanotMedia.decode16k (16kHz ตั้งแต่แรก)
         แล้วส่งเข้า Worker ทีละช่วง ~5 นาที (transfer ไม่ copy) · ใช้ฟังก์ชันเดียวกันทั้งโหมดคลาวด์และในเบราว์เซอร์
     (3) มือถือ (iOS/Android) ไม่มีตัวเลือก small/medium (ดู TanotMediaModels.asrHeavy)
     หน่วยความจำไม่พอ/Worker พัง → ข้อความอ่านเข้าใจ + ปุ่มสลับไปคลาวด์ (บน pages.dev) · ปุ่มยกเลิก = terminate Worker
     ตัวไลบรารี + ตัวรันไทม์ ONNX ฝังในเว็บเอง (vendor/transformers/) แต่ตัวโมเดล AI เอง (หลายสิบ MB)
     ต้องดาวน์โหลดจาก Hugging Face ตอนใช้ครั้งแรกเสมอ — ไม่มีทางเลี่ยงได้เพราะโมเดลใหญ่เกินจะฝังในเว็บ */
  function decodeFileToPcm(file) {
    return file.arrayBuffer().then(TanotMedia.decode16k).then(function (dec) { return dec.mono(); });
  }
  function isMobileUA() { return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || ''); }
  /* หาความยาวไฟล์เสียง/วิดีโอแบบเบาๆ ผ่าน metadata ของ <audio>/<video> element (ไม่ต้องถอดเสียงทั้งไฟล์
     เหมือน decodeAudioData) ใช้แค่เช็คว่าไฟล์ยาวเกินไปสำหรับมือถือไหมก่อนเริ่มถอดเสียงจริง */
  function getMediaDuration(file) {
    return new Promise(function (resolve) {
      try {
        var isVideo = /^video\//.test(file.type) || /\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name || '');
        var el = document.createElement(isVideo ? 'video' : 'audio');
        var url = URL.createObjectURL(file);
        el.preload = 'metadata';
        el.onloadedmetadata = function () { URL.revokeObjectURL(url); resolve(isFinite(el.duration) ? el.duration : null); };
        el.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
        el.src = url;
      } catch (e) { resolve(null); }
    });
  }
  /* ══════════════════ ถอดเสียงผ่านคลาวด์ (Whisper Large v3 Turbo บน Cloudflare Workers AI) ══════════════════
     ทางเลือกแม่นกว่า/เร็วกว่าโหมดในเบราว์เซอร์ด้านบนมาก (รันบนเซิร์ฟเวอร์ ไม่ใช่เครื่องผู้ใช้) แต่มี
     ค่าใช้จ่ายจริงเมื่อเกินโควตาฟรี (10,000 Neurons/วัน ≈ 3.5 ชม.เสียง, whisper-large-v3-turbo กิน
     46.63 Neurons/นาทีเสียง) — เรียก functions/api/asr.js สิทธิ์ตรวจฝั่งเซิร์ฟเวอร์ด้วย Cloudflare Access +
     _middleware.js (เดิมล็อกด้วยรหัสผ่านฝั่งเบราว์เซอร์) — /api/* มีเฉพาะบนโดเมน Pages บน GitHub Pages
     จึงซ่อนตัวเลือกคลาวด์และถอดเสียงในเบราว์เซอร์อย่างเดียว · บน pages.dev คลาวด์เป็นค่าเริ่มต้น (ไม่ใช้หน่วยความจำเครื่อง)
     ถ้าผู้ใช้ไม่เคยเลือกเอง — ในเบราว์เซอร์เป็นทางสำรองตอนออฟไลน์ */
  var ASR_API_URL = '/api/asr';
  var ASR_CLOUD_AVAILABLE = window.AiClient ? AiClient.available() : /\.pages\.dev$/.test(location.hostname);
  var ASR_ENGINE_KEY = 'tanot:asr:engine';
  var NEURON_USAGE_KEY = 'tanot:asrcloud:neuronUsage'; // { date: 'YYYY-MM-DD' (UTC), used: number }
  var DAILY_NEURON_LIMIT = 10000;
  var NEURONS_PER_AUDIO_MINUTE = 46.63;

  function getAsrEngine() {
    if (!ASR_CLOUD_AVAILABLE) return 'local';
    try { return localStorage.getItem(ASR_ENGINE_KEY) === 'local' ? 'local' : 'cloud'; } catch (e) { return 'cloud'; }
  }
  function setAsrEngine(engine) {
    try { localStorage.setItem(ASR_ENGINE_KEY, engine); } catch (e) {}
  }
  function todayUTC() { return new Date().toISOString().slice(0, 10); }
  /* บน pages.dev ยอดจริงอยู่ที่เซิร์ฟเวอร์ (ai_usage — รวมแชท/สรุป/Whisper ที่ใช้โควตา 10,000 Neurons ร่วมกัน) ดึงมาทับตัวนับในเครื่อง */
  var serverNeuronUsage = null;
  function refreshServerNeuronUsage() {
    if (!(window.AiClient && AiClient.available())) return;
    AiClient.usage().then(function (u) {
      serverNeuronUsage = u.used;
      if (u.limit) DAILY_NEURON_LIMIT = u.limit;
      updateNeuronStatusUI();
    }, function () {});
  }
  function getNeuronUsage() {
    if (serverNeuronUsage != null) return serverNeuronUsage;
    try {
      var raw = JSON.parse(localStorage.getItem(NEURON_USAGE_KEY) || 'null');
      if (raw && raw.date === todayUTC()) return raw.used;
    } catch (e) {}
    return 0;
  }
  function addNeuronUsage(n) {
    if (!n || n < 0) return;
    try { localStorage.setItem(NEURON_USAGE_KEY, JSON.stringify({ date: todayUTC(), used: getNeuronUsage() + n })); } catch (e) {}
  }
  function remainingNeurons() { return Math.max(0, DAILY_NEURON_LIMIT - getNeuronUsage()); }
  function updateNeuronStatusUI() {
    var el = $('asrNeuronStatus');
    if (!el) return;
    OME_I18N.live(el, function () {
      return T('neuronUse', { used: Math.round(getNeuronUsage()), limit: DAILY_NEURON_LIMIT, hours: (remainingNeurons() / NEURONS_PER_AUDIO_MINUTE / 60).toFixed(1) });
    });
  }

  /* ถอดเสียงไฟล์ผ่านคลาวด์ (asr-cloud.js): ท่อนเหลื่อม 1.5 วิ ส่งขนาน ≤ 3 ท่อน ลองใหม่ 1 ครั้ง หยุดทั้งชุดเมื่อโควตาเต็ม/ยกเลิก
     ตัดคำซ้ำที่รอยต่อ ประกอบตามลำดับเดิม → { text, segments } · ค่าใช้จ่ายส่งเสียงเกินจริงแค่ส่วนเหลื่อม (~+5%, AsrCalc.sentSeconds)
     langOpt: auto|thai|english · domain: ชุดคำศัพท์เฉพาะที่เซิร์ฟเวอร์ใส่เป็น initial_prompt (/api/asr) */
  async function runAsrCloud(dec, langOpt, signal, domain) {
    var langMap = { thai: 'th', english: 'en' };
    var language = langOpt !== 'auto' ? langMap[langOpt] : undefined;
    var plan = TanotAsrCloud.plan(dec);
    var estimatedNeurons = AsrCalc.neuronsFor(AsrCalc.sentSeconds(plan)), totalMinutes = dec.duration / 60;

    if (estimatedNeurons > remainingNeurons()) {
      /* คิดค่าใช้จ่ายจากเฉพาะส่วนที่เกินโควตาฟรี ไม่ใช่ยอดรวมทั้งไฟล์ (โควตาฟรี 10,000 Neurons/วัน
         ไม่เสียเงินอยู่แล้ว เสียเฉพาะส่วนเกิน) */
      var overageNeurons = estimatedNeurons - remainingNeurons();
      var estCost = (overageNeurons / 1000 * 0.011).toFixed(3);
      var proceed = window.confirm(T('costConfirm', { min: totalMinutes.toFixed(1), need: Math.round(estimatedNeurons), left: Math.round(remainingNeurons()),
        used: Math.round(getNeuronUsage()), limit: DAILY_NEURON_LIMIT, over: Math.round(overageNeurons), cost: estCost }));
      if (!proceed) { var q = TanotMedia.error('abort'); q.quota = true; throw q; }
    }
    st('asrStatus', function () { return T('cloudChunk', { i: 0, n: plan.length }); });
    return TanotAsrCloud.transcribe({
      dec: dec, chunks: plan, language: language, domain: domain, signal: signal,
      onProgress: function (p) { st('asrStatus', function () { return T('cloudChunk', { i: p.done, n: p.total }); }); },
      /* บันทึก Neurons จริงจาก response ถ้ามี (แม่นกว่าประมาณจากความยาวเสียงเอง) ไม่มีก็ใช้ค่าประมาณของท่อนนี้แทน */
      onChunk: function (c) { addNeuronUsage(c.neurons); updateNeuronStatusUI(); refreshServerNeuronUsage(); }
    });
  }

  /* โมเดลที่ใช้ได้บนเครื่องนี้ — มือถือตัด small/medium ออกจากตัวเลือก · ตัวใหญ่ที่รันได้เฉพาะ WebGPU (gpuOnly) โชว์เมื่อ WebGPU ใช้ได้จริง
     · Thonburian (thai) โชว์บนคอมทุกเครื่อง: WebGPU (ถ้ารุ่นต้อง shader-f16 ก็ต้องมี f16) หรือ WASM เมื่อแรมพอ (medium ต้อง deviceMemory ≥ 8 หรือไม่รู้ค่า)
     · ผู้ใช้ยังไม่เลือกเอง → ตั้งโมเดลเริ่มต้นตามเครื่อง + ภาษา (TanotMedia.asrDefaultModel) */
  var ASR_SAFE_MODEL = 'Xenova/whisper-base';
  var gpuPlan = { ok: false, f16: false }, gpuPlanDone = false;
  function asrModelAllowed(modelId) {
    var M = window.TanotMediaModels;
    if (TanotMedia.isMobile() && M && M.asrHeavy(modelId)) return false;
    var info = M && M.asrInfo(modelId);
    if (info && info.thai) return !!(gpuPlan.ok && (!info.f16 || gpuPlan.f16)) || M.asrWasmOk(modelId, navigator.deviceMemory);
    if (M && M.asrGpuOnly(modelId)) return !!(gpuPlan.ok && (!info.f16 || gpuPlan.f16));
    return true;
  }
  var asrModelPicked = false;
  /* มือถือ: เอาตัวหนักออกจากรายการ */
  function applyAsrModelGate() {
    var sel = $('asrModel');
    if (!sel) return;
    var M = window.TanotMediaModels;
    Array.prototype.slice.call(sel.options).forEach(function (o) { if (TanotMedia.isMobile() && M && M.asrHeavy(o.value)) o.remove(); });
    if (!asrModelAllowed(sel.value) || !sel.value) sel.value = ASR_SAFE_MODEL;
  }
  /* รุ่นใหม่ (onnx-community) เพิ่มเข้ารายการเฉพาะเครื่องที่ WebGPU ใช้ได้จริง (มี adapter จริงบนคอม) · Thonburian เพิ่มบนคอมทุกเครื่องที่รันไหว
     — เครื่องที่ใช้ WASM เห็น Xenova เดิม 4 ตัว (+ Thonburian) (ชื่อ repo/ไฟล์ dtype ของรุ่นใหม่ยังตรวจกับ Hugging Face จากที่นี่ไม่ได้ — ดู media-models.js) */
  var COMMUNITY_OPTS = [['onnx-community/whisper-tiny', 'mcTiny'], ['onnx-community/whisper-base', 'mcBase'], ['onnx-community/whisper-small', 'mcSmall'], ['onnx-community/whisper-large-v3-turbo', 'mcLarge']];
  var THAI_OPTS = [['Tanotfin/distill-whisper-th-small-onnx', 'mtThSmall'], ['Tanotfin/distill-whisper-th-medium-onnx', 'mtThMedium']];
  function addModelOptions(sel, list) {
    list.forEach(function (c) {
      if (!asrModelAllowed(c[0]) || Array.prototype.some.call(sel.options, function (o) { return o.value === c[0]; })) return;
      var o = document.createElement('option');
      o.value = c[0]; o.setAttribute('data-i18n', 'tts.' + c[1]); o.textContent = T(c[1]);
      sel.appendChild(o);
    });
  }
  /* คำแนะนำสั้นๆ (ไม่บล็อก) เฉพาะตอนที่ผู้ใช้เลือกภาษาอังกฤษคู่กับรุ่น Thonburian บนโหมดในเบราว์เซอร์ */
  function updateAsrThaiNote() {
    var note = $('asrThaiNote'), sel = $('asrModel'), lang = $('asrLang');
    if (!note || !sel || !lang) return;
    var M = window.TanotMediaModels;
    note.hidden = !(getAsrEngine() === 'local' && lang.value === 'english' && M && M.asrThai(sel.value));
  }
  /* โมเดลเริ่มต้นตามเครื่อง + ภาษา — ไม่ทับที่ผู้ใช้เลือกเอง (asrModelPicked) · รอตรวจ adapter เสร็จก่อน (ไม่งั้นรายการยังไม่ครบ) */
  function applyAsrDefaultModel() {
    var sel = $('asrModel');
    if (!sel || asrModelPicked || !gpuPlanDone) return;
    var d = TanotMedia.asrDefaultModel(gpuPlan, $('asrLang') ? $('asrLang').value : 'auto');
    if (asrModelAllowed(d) && Array.prototype.some.call(sel.options, function (o) { return o.value === d; })) sel.value = d;
    updateAsrThaiNote();
  }
  function initAsrModels() {
    var sel = $('asrModel');
    if (!sel) return;
    sel.addEventListener('change', function () { asrModelPicked = true; updateAsrThaiNote(); });
    if ($('asrLang')) $('asrLang').addEventListener('change', function () { applyAsrDefaultModel(); updateAsrThaiNote(); });
    applyAsrModelGate();
    TanotMedia.webgpuPlan().then(function (p) {
      gpuPlan = p; gpuPlanDone = true;
      if (p.ok) addModelOptions(sel, COMMUNITY_OPTS);
      addModelOptions(sel, THAI_OPTS);
      applyAsrDefaultModel();
    });
  }
  var asrAbort = null;
  function asrRunning(on) {
    $('asrGoBtn').disabled = on;
    $('asrCancelBtn').hidden = !on;
    if (on) $('asrUseCloudBtn').hidden = true;
  }
  /* ปุ่ม "ใช้โหมดคลาวด์แทน": หลังเครื่องรับไม่ไหว (หน่วยความจำ/Worker พัง) หรือบนมือถือที่ยังเลือกโหมดในเบราว์เซอร์ */
  function updateCloudOffer(afterDeviceLimit) {
    var local = getAsrEngine() === 'local';
    var mobileNote = ASR_CLOUD_AVAILABLE && local && TanotMedia.isMobile();
    $('asrMobileNote').hidden = !mobileNote;
    $('asrUseCloudBtn').hidden = !(ASR_CLOUD_AVAILABLE && local && (afterDeviceLimit || mobileNote));
  }

  /* ── ผลลัพธ์: ช่วงคำพูด (เวลา+ข้อความ) → ย่อหน้าตามช่วงเงียบ → ข้อความ (สวิตช์ "แสดงเวลา" วาดใหม่ทันที ไม่ถอดซ้ำ) ── */
  var TIME_KEY = 'tanot:asr:timestamps', DOMAIN_KEY = 'tanot:asr:domain';
  var asrParas = null; // [{start,end,text}] ของผลล่าสุด
  function getTimeSwitch() { try { return localStorage.getItem(TIME_KEY) === '1'; } catch (e) { return false; } }
  function setTimeSwitch(on) { try { localStorage.setItem(TIME_KEY, on ? '1' : '0'); } catch (e) {} }
  function getAsrDomain() {
    try { var v = localStorage.getItem(DOMAIN_KEY); if (v && /^(general|law|engineering|invest)$/.test(v)) return v; } catch (e) {}
    return 'general';
  }
  function renderAsrResult() {
    if (!asrParas) return;
    $('asrResult').value = AsrCalc.render(asrParas, { timestamps: getTimeSwitch() });
  }
  /* ข้อความล้วน (ไม่มีเวลา) — ใช้กับสรุปประชุม/ไฟล์ Word */
  function asrPlainText() { return asrParas ? AsrCalc.render(asrParas, { timestamps: false }) : ($('asrResult').value || ''); }
  function setAsrResult(segments, text) {
    asrParas = AsrCalc.paragraphs(segments && segments.length ? segments : (text ? [{ start: 0, end: 0, text: text }] : []));
    renderAsrResult();
    return $('asrResult').value;
  }

  function runAsr() {
    var fileInput = $('asrFile');
    var file = fileInput.files && fileInput.files[0];
    if (!file) { $('asrStatus').className = 'status err'; st('asrStatus', function () { return T('pickAudio'); }); return; }
    var langOpt = $('asrLang').value;
    var engine = getAsrEngine();
    asrRunning(true);
    $('asrResultWrap').style.display = 'none';
    $('asrStatus').className = 'status';

    /* มือถือมีหน่วยความจำแท็บเบราว์เซอร์จำกัดกว่าคอมมาก — ถอดเสียงไฟล์ยาวมาก (เช่นอัดประชุมทั้งวัน)
       เสี่ยงทำให้แท็บแครชกลางทาง (เสียหมด ไม่เหลือผลลัพธ์บางส่วนให้เลย) เช็คความยาวไฟล์แบบเบาๆ ก่อน
       (ไม่ถอดเสียงทั้งไฟล์) แล้วเตือนถ้ายาวเกินไปบนมือถือ ให้ผู้ใช้เลือกเองว่าจะเสี่ยงต่อหรือไม่ */
    if (!isMobileUA()) { proceedRunAsr(file, langOpt, engine); return; }
    getMediaDuration(file).then(function (durSec) {
      var mins = durSec ? Math.round(durSec / 60) : null;
      if (mins && mins > 45 && engine === 'local') {
        var proceed = window.confirm(T('longConfirm', { min: mins }));
        if (!proceed) { asrRunning(false); st('asrStatus', function () { return T('cancelled'); }); return; }
      }
      proceedRunAsr(file, langOpt, engine);
    });
  }
  function proceedRunAsr(file, langOpt, engine) {
    var offlineFallback = engine === 'cloud' && navigator.onLine === false;
    if (offlineFallback) engine = 'local';
    var modelId = $('asrModel').value;
    if (!asrModelAllowed(modelId)) modelId = ASR_SAFE_MODEL;
    var domain = $('asrDomain') ? $('asrDomain').value : 'general';
    var ctrl = new AbortController();
    asrAbort = ctrl;
    var meta = { type: file.type, name: file.name, size: file.size, dur: null }, stage = 'decode';
    var devTag = '', fallbackNote = null;
    var segStatus = function () { return T('transcribing') + devTag; };
    st('asrStatus', function () { return offlineFallback ? T('offlineLocal') + ' ' + T('decoding') : T('decoding'); });
    file.arrayBuffer().then(TanotMedia.decode16k).then(function (dec) {
      meta.dur = dec.duration;
      if (ctrl.signal.aborted) throw TanotMedia.error('abort');
      if (engine === 'cloud') { stage = 'cloud'; return runAsrCloud(dec, langOpt, ctrl.signal, domain); }
      stage = 'transcribe';
      st('asrStatus', function () { return T('prepAsr'); });
      return TanotMedia.transcribeLocalDetailed({
        dec: dec, modelId: modelId, lang: langOpt, signal: ctrl.signal, device: 'auto', timestamps: true,
        onProgress: function (p) {
          if (p.stage === 'model' && p.file) {
            var pct = p.progress != null ? Math.round(p.progress) : null;
            st('asrStatus', function () { return pct != null ? T('dlModelPct', { file: p.file, pct: pct }) : T('dlModel', { file: p.file }); });
          } else if (p.stage === 'segment') {
            segStatus = p.n > 1 ? function () { return T('asrSegment', { i: p.i, n: p.n }) + devTag; } : function () { return T('transcribing') + devTag; };
            st('asrStatus', segStatus);
          } else if (p.stage === 'ready') {
            devTag = p.device === 'webgpu' ? ' · WebGPU' : '';
            st('asrStatus', segStatus);
          } else if (p.stage === 'fallback') {
            fallbackNote = p.what === 'device' ? 'gpuFallback' : 'modelFallback';
            devTag = '';
            st('asrStatus', function () { return T(fallbackNote) + ' ' + segStatus(); });
          }
        }
      });
    }).then(function (res) {
      var text = setAsrResult(res.segments, res.text).trim();
      $('asrResultWrap').style.display = 'block';
      $('asrStatus').className = 'status ok';
      var gpu = engine === 'local' && res.device === 'webgpu' ? ' · WebGPU' : '';
      st('asrStatus', function () { return (!text ? T('doneEmpty') : engine === 'cloud' ? T('doneCloud') : T('asrDone')) + gpu + (fallbackNote ? ' · ' + T(fallbackNote) : ''); });
      if (engine === 'cloud') updateNeuronStatusUI();
      updateCloudOffer(false);
    }, function (e) {
      if (TanotMedia.classify(e) === 'abort') {
        $('asrStatus').className = 'status';
        st('asrStatus', function () { return e.quota ? T('cancelledQuota') : T('cancelled'); });
        return;
      }
      TanotMedia.logError('asr', e, { stage: stage, engine: engine, model: engine === 'local' ? modelId : 'whisper-large-v3-turbo', lang: langOpt, file: meta });
      e.mediaLogged = true;
      $('asrStatus').className = 'status err';
      st('asrStatus', function () { return T('asrFail', { msg: mediaErrText(e) }); });
      updateCloudOffer(engine === 'local' && TanotMedia.isDeviceLimit(e));
    }).finally(function () {
      if (asrAbort === ctrl) asrAbort = null;
      asrRunning(false);
    });
  }
  function cancelAsr() { if (asrAbort) asrAbort.abort(); }
  function copyAsrResult() {
    var text = $('asrResult').value;
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      $('asrStatus').className = 'status ok'; st('asrStatus', function () { return T('copied'); });
    }).catch(function () {
      $('asrResult').select();
      document.execCommand('copy');
    });
  }

  /* ══════════════════ สรุปประชุมด้วย AI (คลาวด์ก่อน สำรองด้วยโมเดลในเบราว์เซอร์) → ส่งออกเป็นไฟล์ Word (.docx) ══════════════════
     ทางสำรอง (localMeetingSummary) ใช้ ai-chat-worker.js ตัวเดียวกับที่หน้าลงทุนใช้สรุปข่าว (โมเดลเล็ก/ใหญ่แข่งกันหาโหลดได้ก่อนใน worker
     คนละตัวกัน กันปัญหาหน่วยความจำ WASM ปนกันที่เคยเจอมาก่อน) — บทถอดเสียงประชุมมักยาวเกินกว่าโมเดลเล็ก
     (context window จำกัด) จะสรุปทีเดียวจบได้ดี จึงตัดเป็นท่อนๆ สรุปย่อทีละท่อนก่อน (map) แล้วเอาสรุปย่อย
     ทั้งหมดมาสังเคราะห์เป็นสรุปเดียวอีกที (reduce) — ข้อจำกัดตามจริง: (1) ไม่แยกผู้พูด เพราะ Whisper ถอด
     ได้แค่เนื้อความ ไม่บอกว่าใครพูด (2) โมเดลเล็กฟรีที่รันบนเบราว์เซอร์ได้ คุณภาพสรุปภาษาไทยสู้โมเดลใหญ่
     ระดับเซิร์ฟเวอร์ไม่ได้ ต้องตรวจทานก่อนใช้จริงเสมอ */
  function isIOS() {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }
  /* โมเดลเล็กบางครั้ง "พูดตาม" ข้อความ system/reminder ที่สั่งห้ามออกมาเป็นเนื้อหาจริง แทนที่จะทำตามคำสั่ง
     เงียบๆ — กรองทิ้งบรรทัดที่ขึ้นต้นด้วย "ห้าม"/"Never" (ปัญหาเดียวกับที่เจอในหน้าสรุปข่าวหุ้น) */
  function stripLeakedInstructions(text) {
    return (text || '').split('\n').filter(function (line) {
      return !/^\s*(ห้าม|Never\b)/i.test(line);
    }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function chunkText(text, maxChars) {
    var paras = text.split(/\n+/), chunks = [], cur = '';
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      if (cur && (cur.length + p.length + 1) > maxChars) { chunks.push(cur); cur = p; }
      else cur = cur ? cur + '\n' + p : p;
    }
    if (cur) chunks.push(cur);
    return chunks;
  }

  var meetingSumWorker = null, meetingSumWorkerRacePromise = null;
  function spawnProbedWorkerForMeeting(modelKind) {
    return new Promise(function (resolve, reject) {
      var w = new Worker('./ai-chat-worker.js', { type: 'module' });
      var probeId = 'probe-' + modelKind + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      function onMsg(e) {
        var msg = e.data;
        if (!msg || msg.jobId !== probeId || msg.type !== 'probe-result') return;
        w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr);
        if (msg.ok) resolve(w);
        else { try { w.terminate(); } catch (err) {} reject(new Error(msg.message || 'probe failed')); }
      }
      function onErr(e) {
        w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr);
        try { w.terminate(); } catch (err) {}
        reject(e);
      }
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage({ type: 'probe', jobId: probeId, modelId: modelKind });
    });
  }
  /* ใช้ key เดียวกับหน้าลงทุน (tanot:aiChat:noBigModel) — เบราว์เซอร์เดียวกัน ถ้าเคยรู้แล้วว่าโมเดลใหญ่
     พังบนเครื่องนี้ ไม่ต้องลองซ้ำอีกไม่ว่าจะเข้าหน้าไหนของเว็บ */
  var AI_BIG_MODEL_BLOCKLIST_KEY = 'tanot:aiChat:noBigModel';
  function getMeetingSumWorkerAsync() {
    if (meetingSumWorker) return Promise.resolve(meetingSumWorker);
    if (meetingSumWorkerRacePromise) return meetingSumWorkerRacePromise;
    /* งบหน่วยความจำกลาง: บนมือถือปิดโมเดลอื่นในหน้านี้ก่อน (ถอดเสียง/เสียงพูด/แชท) และไม่แข่ง 2 โมเดลพร้อมกัน */
    TanotMedia.budget.acquire('meeting-chat', function () {
      if (meetingSumWorker) { try { meetingSumWorker.terminate(); } catch (e) {} }
      meetingSumWorker = null;
    });
    TanotMedia.persistOnce();
    var mem = (typeof navigator !== 'undefined') ? navigator.deviceMemory : undefined;
    var noBig = false;
    try { noBig = localStorage.getItem(AI_BIG_MODEL_BLOCKLIST_KEY) === '1'; } catch (e) {}
    var canTryBig = !noBig && !TanotMedia.isMobile() && typeof navigator !== 'undefined' && !!navigator.gpu && mem && mem >= 4;
    var candidates = canTryBig
      ? [spawnProbedWorkerForMeeting('big').catch(function (err) {
          try { localStorage.setItem(AI_BIG_MODEL_BLOCKLIST_KEY, '1'); } catch (e2) {}
          throw err;
        }), spawnProbedWorkerForMeeting('small')]
      : [spawnProbedWorkerForMeeting('small')];
    meetingSumWorkerRacePromise = Promise.any(candidates).then(function (winner) {
      meetingSumWorker = winner; meetingSumWorkerRacePromise = null;
      candidates.forEach(function (p) { p.then(function (w) { if (w !== winner) { try { w.terminate(); } catch (err) {} } }, function () {}); });
      return winner;
    }, function () {
      meetingSumWorkerRacePromise = null;
      var w = new Worker('./ai-chat-worker.js', { type: 'module' });
      meetingSumWorker = w;
      return w;
    });
    return meetingSumWorkerRacePromise;
  }
  /* ส่ง messages ไปคุยกับ worker ทีละครั้ง คืนข้อความตอบกลับแบบเต็ม (รอจน 'done') — ใช้ซ้ำได้หลายครั้ง
     กับ worker ตัวเดิม (map แล้ว reduce ต้องคุยหลายรอบ ไม่อยากสร้าง/โหลดโมเดลใหม่ทุกรอบ) */
  function runChatOnce(worker, messages, maxNewTokens) {
    return new Promise(function (resolve, reject) {
      var jobId = 'ms-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      var replyText = '';
      function onMsg(e) {
        var msg = e.data;
        if (!msg || msg.jobId !== jobId) return;
        if (msg.type === 'token') replyText += msg.token;
        else if (msg.type === 'done') { cleanup(); resolve(stripLeakedInstructions(replyText)); }
        else if (msg.type === 'error') { cleanup(); reject(new Error(msg.message || 'chat failed')); }
      }
      function onErr(e) { cleanup(); reject(e); }
      function cleanup() { worker.removeEventListener('message', onMsg); worker.removeEventListener('error', onErr); }
      worker.addEventListener('message', onMsg);
      worker.addEventListener('error', onErr);
      worker.postMessage({ type: 'chat', jobId: jobId, messages: messages, maxNewTokens: maxNewTokens });
    });
  }

  var MEETING_CHUNK_SYSTEM = 'คุณเป็นผู้ช่วยสรุปการประชุม อ่านข้อความถอดเสียงประชุมส่วนหนึ่งด้านล่าง แล้วสรุปประเด็นสำคัญที่พูดถึงเป็นข้อๆ สั้นๆ เท่านั้น (ขึ้นต้นแต่ละข้อด้วย "- ") ห้ามทักทาย ห้ามใส่ความเห็นส่วนตัว ห้ามเดาสิ่งที่ไม่ได้พูดถึงในข้อความ';
  /* โครงหัวข้อสรุปฉบับสมบูรณ์ใช้ร่วมกัน 2 ทาง: จากบันทึกย่อหลายช่วง (โมเดลในเบราว์เซอร์ ที่บทถอดเสียงยาวเกิน context) หรือจากบทถอดเสียงตรงๆ (คลาวด์) */
  function meetingFinalSystem(source) {
    return 'คุณเป็นผู้ช่วยเขียนสรุปการประชุมฉบับสมบูรณ์ จาก' + source + 'ด้านล่าง ให้เขียนตามโครงสร้างหัวข้อนี้เป๊ะๆ' + MEETING_FINAL_STRUCTURE;
  }
  var MEETING_FINAL_STRUCTURE = ' (แต่ละหัวข้อขึ้นบรรทัดใหม่ จบด้วย ":" ตามด้วยเนื้อหา):\n\nภาพรวมการประชุม:\n(ย่อหน้าสั้นๆ 2-3 ประโยค)\n\nประเด็นสำคัญที่พูดคุย:\n(รายการ ขึ้นต้นแต่ละข้อด้วย "- ")\n\nการตัดสินใจ:\n(รายการ หรือถ้าไม่มีการตัดสินใจชัดเจนให้เขียนว่า "ไม่มีการตัดสินใจที่ชัดเจนในบันทึกนี้")\n\nงานที่ต้องติดตาม:\n(รายการ หรือถ้าไม่มีให้เขียนว่า "ไม่มีงานที่ต้องติดตามที่ระบุชัดเจน")';
  var MEETING_FINAL_SYSTEM = meetingFinalSystem('บันทึกย่อหลายช่วงของการประชุมเดียวกัน');
  var MEETING_FINAL_REMINDER = 'ตอบตามโครงสร้างหัวข้อด้านบนเท่านั้น เริ่มตอบด้วย "ภาพรวมการประชุม:" ทันที ไม่ต้องมีคำนำ ไม่ต้องอธิบายว่ากำลังทำอะไร';

  function setMeetingSumStatus(text, cls) {
    var el = $('meetingSumStatus'); if (!el) return;
    OME_I18N.live(el, typeof text === 'function' ? text : null);
    if (typeof text !== 'function') el.textContent = text || '';
    el.className = 'status' + (cls ? ' ' + cls : '');
  }

  var meetingSumBusy = false;
  function doMeetingSummary() {
    if (meetingSumBusy) return;
    var transcript = asrPlainText().trim();
    if (!transcript) { setMeetingSumStatus(function () { return T('noTranscript'); }, 'err'); return; }
    var cloudOk = !!(window.AiClient && AiClient.available());
    if (!cloudOk && isIOS()) { setMeetingSumStatus(function () { return T('noIos'); }, 'err'); return; }
    if (typeof window.docx === 'undefined') { setMeetingSumStatus(function () { return T('noDocx'); }, 'err'); return; }

    meetingSumBusy = true;
    $('meetingSumBtn').disabled = true;
    $('meetingSumWrap').style.display = 'none';
    setMeetingSumStatus(function () { return cloudOk ? T('sumCloud') : T('sumLocalPrep'); }, '');

    var chunks = chunkText(transcript, 1800);

    /* คลาวด์ก่อน ถอยมาโมเดลในเบราว์เซอร์เมื่อออฟไลน์/โควตาเต็ม/ล็อกอินหมดอายุ (ไม่ถอยบน iPhone — โมเดลในเครื่องรันไม่ได้) */
    var summaryP = cloudOk
      ? cloudMeetingSummary(transcript).catch(function (err) {
          if (!AiClient.canFallback(err) || isIOS()) throw new Error(AiClient.friendlyMessage(err));
          setMeetingSumStatus(function () { return T('sumFallback', { msg: AiClient.friendlyMessage(err) }); }, '');
          return localMeetingSummary(chunks);
        })
      : localMeetingSummary(chunks);

    summaryP.then(function (finalSummary) {
      finalSummary = (finalSummary || '').trim();
      if (!finalSummary) { setMeetingSumStatus(function () { return T('sumEmpty'); }, 'err'); return; }
      $('meetingSumResult').value = finalSummary;
      $('meetingSumWrap').style.display = 'block';
      setMeetingSumStatus(function () { return T('sumDone'); }, 'ok');
      return buildMeetingDocxBlob(finalSummary, transcript).then(function (blob) {
        var link = $('meetingDocxLink');
        if (link.dataset.prevUrl) URL.revokeObjectURL(link.dataset.prevUrl);
        var url = URL.createObjectURL(blob);
        link.href = url;
        link.dataset.prevUrl = url;
      });
    }).catch(function (e) {
      setMeetingSumStatus(function () { return T('sumFail', { msg: errText(e) }); }, 'err');
    }).finally(function () {
      meetingSumBusy = false;
      $('meetingSumBtn').disabled = false;
      refreshServerNeuronUsage();
    });
  }

  /* สรุปด้วยโมเดลในเบราว์เซอร์ (แผนสำรอง): ตัดท่อนสั้นๆ สรุปย่อทีละท่อนแล้วรวมอีกที ตามข้อจำกัด context ของโมเดลเล็ก */
  function localMeetingSummary(chunks) {
    return getMeetingSumWorkerAsync().then(function (worker) {
      var chunkSummaries = [];
      function summarizeNextChunk(i) {
        if (i >= chunks.length) return Promise.resolve();
        (function (idx) { setMeetingSumStatus(function () { return T('sumPart', { i: idx + 1, n: chunks.length }); }, ''); })(i);
        return runChatOnce(worker, [
          { role: 'system', content: MEETING_CHUNK_SYSTEM },
          { role: 'user', content: chunks[i] }
        ], 180).then(function (summary) {
          chunkSummaries.push(summary);
          return summarizeNextChunk(i + 1);
        });
      }
      return summarizeNextChunk(0).then(function () {
        if (chunks.length === 1) return chunkSummaries[0];
        setMeetingSumStatus(function () { return T('sumMerge'); }, '');
        return runChatOnce(worker, [
          { role: 'system', content: MEETING_FINAL_SYSTEM },
          { role: 'user', content: chunkSummaries.join('\n\n') },
          { role: 'system', content: MEETING_FINAL_REMINDER }
        ], 350);
      });
    });
  }

  /* สรุปด้วยคลาวด์ (Workers AI): context ของ SEA-LION ใหญ่พอให้สรุปบทถอดเสียงทั้งก้อนในคำขอเดียว (ผลแคชใน D1 — สรุปซ้ำบทเดิมไม่เสียโควตา)
     เฉพาะบทที่ยาวมากจริงๆ (> 40,000 ตัวอักษร ≈ ประชุมหลายชั่วโมง) ค่อยแบ่งท่อนละ ~12,000 ตัวอักษร สรุปย่อด้วยโมเดลเร็วก่อนแล้วรวมด้วยโมเดลหลัก
     ⚠️ บทถอดเสียงถูกส่งไปประมวลผลที่ Workers AI (Cloudflare) — ต่างจากโมเดลในเบราว์เซอร์ที่ไม่ส่งข้อมูลออกไปไหน */
  var MEETING_CLOUD_DIRECT_MAX = 40000;
  function cloudMeetingSummary(transcript) {
    var reminder = { role: 'system', content: MEETING_FINAL_REMINDER };
    if (transcript.length <= MEETING_CLOUD_DIRECT_MAX) {
      return AiClient.summarize({
        task: 'meeting', maxTokens: 1000,
        messages: [{ role: 'system', content: meetingFinalSystem('ข้อความถอดเสียงการประชุม') }, { role: 'user', content: transcript }, reminder]
      }).then(function (r) { return stripLeakedInstructions(r.text); });
    }
    var parts = chunkText(transcript, 12000), notes = [];
    function next(i) {
      if (i >= parts.length) return Promise.resolve();
      (function (idx) { setMeetingSumStatus(function () { return T('sumPartCloud', { i: idx + 1, n: parts.length }); }, ''); })(i);
      return AiClient.summarize({
        task: 'meeting-part', model: 'fast', maxTokens: 600,
        messages: [{ role: 'system', content: MEETING_CHUNK_SYSTEM }, { role: 'user', content: parts[i] }]
      }).then(function (r) { notes.push(stripLeakedInstructions(r.text)); return next(i + 1); });
    }
    return next(0).then(function () {
      setMeetingSumStatus(function () { return T('sumMerge'); }, '');
      return AiClient.summarize({
        task: 'meeting', maxTokens: 1000,
        messages: [{ role: 'system', content: MEETING_FINAL_SYSTEM }, { role: 'user', content: notes.join('\n\n') }, reminder]
      }).then(function (r) { return stripLeakedInstructions(r.text); });
    });
  }

  /* แปลงสรุป (ข้อความมีโครงหัวข้อ "...:" / บูลเล็ต "- ") + บทถอดเสียงเต็ม (เก็บเป็นภาคผนวก) เป็นไฟล์ .docx
     จริง ใช้ไลบรารี docx.js ตัวเดียวกับหน้า "พิมพ์และแก้ไขเอกสาร" (word.js) แต่สร้างแบบง่ายตรงๆ ไม่ผ่าน
     กลไกแปลง HTML เต็มรูปแบบของหน้านั้น เพราะที่นี่มีแค่ข้อความล้วนที่มีโครงสร้างชัดเจนอยู่แล้ว */
  function buildMeetingDocxBlob(summaryText, transcriptText) {
    var docx = window.docx;
    var FONT = 'TH Sarabun New', SIZE = 32; // 16pt — ขนาดมาตรฐานเอกสารไทย เดียวกับ word.js
    function titleP(text) { return new docx.Paragraph({ children: [new docx.TextRun({ text: text, bold: true, font: FONT, size: 48 })], spacing: { after: 60 } }); }
    function metaP(text) { return new docx.Paragraph({ children: [new docx.TextRun({ text: text, italics: true, font: FONT, size: 24, color: '727C93' })], spacing: { after: 200 } }); }
    function headingP(text) { return new docx.Paragraph({ children: [new docx.TextRun({ text: text, bold: true, font: FONT, size: 36 })], spacing: { before: 200, after: 100 } }); }
    function bodyP(text) { return new docx.Paragraph({ children: [new docx.TextRun({ text: text, font: FONT, size: SIZE })], spacing: { after: 80 } }); }
    function bulletP(text) { return new docx.Paragraph({ children: [new docx.TextRun({ text: text, font: FONT, size: SIZE })], bullet: { level: 0 }, spacing: { after: 40 } }); }

    var children = [
      titleP('สรุปการประชุม'),
      metaP('สร้างโดย AI จากข้อความถอดเสียง — ' + new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }))
    ];
    summaryText.split('\n').forEach(function (line) {
      var s = line.trim();
      if (!s) return;
      if (/^[-•]\s+/.test(s)) children.push(bulletP(s.replace(/^[-•]\s+/, '')));
      else if (/:$/.test(s) && s.length < 60) children.push(headingP(s.replace(/:$/, '')));
      else children.push(bodyP(s));
    });
    if (transcriptText) {
      children.push(new docx.Paragraph({ children: typeof docx.PageBreak === 'function' ? [new docx.PageBreak()] : [] }));
      children.push(headingP('ภาคผนวก: ข้อความที่ถอดเสียงได้ทั้งหมด'));
      transcriptText.split('\n').forEach(function (line) { if (line.trim()) children.push(bodyP(line.trim())); });
    }

    var doc = new docx.Document({
      sections: [{ children: children }],
      styles: { default: { document: { run: { font: FONT, size: SIZE } } } }
    });
    return docx.Packer.toBlob(doc);
  }

  /* ══════════════════ init ══════════════════ */
  function init() {
    window.OME_PAGE_LIVE_LANG = true;
    /* สลับภาษาสด: ข้อความใน HTML แปลผ่าน data-i18n · บรรทัดสถานะผ่าน OME_I18N.live · เหลือส่วนที่ JS สร้างเอง (ตัวเลือกเสียง) — ภาษาของเสียง/ถอดเสียง (ไทย/อังกฤษ) เป็นตัวเลือกเนื้อหา ไม่เกี่ยวกับภาษา UI */
    OME_LANG.onChange(function () { renderVoiceOptions(); renderWsVoiceOptions(); });
    $('ttsText').addEventListener('input', updateCharCount);
    updateCharCount();
    $('importFileBtn').addEventListener('click', function () { $('importFileInput').click(); });
    $('importFileInput').addEventListener('change', importFileChange);

    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadWsVoices;
      loadWsVoices();
    } else {
      renderWsVoiceOptions();
    }
    $('wsPlayBtn').addEventListener('click', wsPlay);
    $('wsPauseBtn').addEventListener('click', wsPauseToggle);
    $('wsStopBtn').addEventListener('click', wsStop);
    $('wsRate').addEventListener('input', function () { $('wsRateVal').textContent = parseFloat($('wsRate').value).toFixed(1) + 'x'; });

    renderVoiceOptions();
    $('dlLang').addEventListener('change', renderVoiceOptions);
    $('dlGenerateBtn').addEventListener('click', generateDownloadable);

    $('asrGoBtn').addEventListener('click', runAsr);
    $('asrCancelBtn').addEventListener('click', cancelAsr);
    $('asrUseCloudBtn').addEventListener('click', function () { setAsrEngine('cloud'); applyAsrEngineUI(); });
    initAsrModels();
    $('asrCopyBtn').addEventListener('click', copyAsrResult);

    /* ประเภทเนื้อหา (ชุดคำศัพท์เฉพาะของคลาวด์) + สวิตช์แสดงเวลา — จำค่าไว้ในเครื่อง */
    var asrDomainSel = $('asrDomain');
    if (asrDomainSel) {
      asrDomainSel.value = getAsrDomain();
      asrDomainSel.addEventListener('change', function () { try { localStorage.setItem(DOMAIN_KEY, asrDomainSel.value); } catch (e) {} });
    }
    var asrTimeChk = $('asrTimeChk');
    if (asrTimeChk) {
      asrTimeChk.checked = getTimeSwitch();
      asrTimeChk.addEventListener('change', function () { setTimeSwitch(asrTimeChk.checked); renderAsrResult(); });
    }
    $('meetingSumBtn').addEventListener('click', doMeetingSummary);

    /* ══ เลือกโหมดถอดเสียง (ในเบราว์เซอร์ฟรี / คลาวด์แม่นกว่า) ══ */
    var asrEngineToggle = $('asrEngineToggle'), asrEngineNote = $('asrEngineNote'),
      asrModelField = $('asrModelField'), asrDomainField = $('asrDomainField');

    function applyAsrEngineUI() {
      if (!asrEngineToggle) return;
      var engine = getAsrEngine();
      asrEngineToggle.querySelectorAll('[data-ae]').forEach(function (span) {
        span.classList.toggle('active', span.getAttribute('data-ae') === engine);
      });
      if (asrEngineNote) asrEngineNote.style.display = engine === 'cloud' ? 'block' : 'none';
      if (asrModelField) asrModelField.style.display = engine === 'cloud' ? 'none' : '';
      if (asrDomainField) asrDomainField.style.display = engine === 'cloud' ? '' : 'none';
      updateAsrThaiNote();
      if (engine === 'cloud') { updateNeuronStatusUI(); refreshServerNeuronUsage(); }
      updateCloudOffer(false);
    }
    if (asrEngineToggle) {
      if (!ASR_CLOUD_AVAILABLE) asrEngineToggle.parentNode.style.display = 'none';
      asrEngineToggle.addEventListener('click', function (e) {
        var span = e.target.closest('[data-ae]');
        if (!span) return;
        setAsrEngine(span.getAttribute('data-ae'));
        applyAsrEngineUI();
      });
    }
    applyAsrEngineUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__tts = {
    synthesizeMmsTts: synthesizeMmsTts, float32ToWavBlob: float32ToWavBlob,
    wavBytesToMp3Blob: wavBytesToMp3Blob, floatTo16BitPCM: floatTo16BitPCM,
    decodeFileToPcm: decodeFileToPcm, encodeAudio: encodeAudio, ttsPool: ttsPool, TTS_IDLE_MS: function (ms) { if (ms != null) TTS_IDLE_MS = ms; return TTS_IDLE_MS; },
    isMobileUA: isMobileUA, getMediaDuration: getMediaDuration,
    splitIntoTtsChunks: splitIntoTtsChunks, ttsPoolSize: ttsPoolSize, formatEta: formatEta,
    synthesizeMmsTtsChunks: synthesizeMmsTtsChunks,
    synthesizeMmsTtsChunksInWorkerPool: synthesizeMmsTtsChunksInWorkerPool,
    synthesizeMmsTtsChunksResponsive: synthesizeMmsTtsChunksResponsive,
    chunkText: chunkText, buildMeetingDocxBlob: buildMeetingDocxBlob, isIOS: isIOS
  };
})();
