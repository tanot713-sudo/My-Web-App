/* ══════════════════════════════════════════════════════════════════
   audio-encode-worker.js — ต่อเสียงหลายท่อน + สร้างไฟล์ .wav / .mp3 นอกเธรดหลัก (Worker แบบ classic)
   ใช้โดย text-to-speech.js หลังสังเคราะห์เสียงครบทุกท่อน — เดิมต่อ Float32Array, ห่อ WAV, decodeAudioData แล้ว
   เข้ารหัส MP3 ด้วย lamejs บนเธรดหลักทั้งหมด ข้อความยาวๆ (หลายนาที) หน้าเว็บค้างไปหลายวินาทีตอน "กำลังประกอบไฟล์เสียง…"
   ที่นี่เข้ารหัส MP3 จาก PCM โดยตรงที่ความถี่ของโมเดล (MMS-TTS = 16kHz mono) ไม่ต้องผ่าน decodeAudioData
   (ใช้ใน Worker ไม่ได้) — เนื้อเสียงเท่าเดิม (PCM 16-bit ชุดเดียวกับไฟล์ .wav)

   ข้อความเข้า: { type:'encode', jobId, parts: Float32Array[] (transfer), sampleRate, gapSec, kbps }
   ข้อความออก: { type:'done', jobId, wav: ArrayBuffer, mp3: ArrayBuffer } (transfer) | { type:'error', jobId, name, message } */
'use strict';
importScripts('vendor/lamejs/lamejs.iife.js');

function toInt16(f) {
  var out = new Int16Array(f.length);
  for (var i = 0; i < f.length; i++) {
    var s = Math.max(-1, Math.min(1, f[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
}
function concat(parts, gap) {
  var total = 0;
  parts.forEach(function (p, i) { total += p.length + (i < parts.length - 1 ? gap : 0); });
  var out = new Float32Array(total), o = 0;
  parts.forEach(function (p, i) { out.set(p, o); o += p.length + (i < parts.length - 1 ? gap : 0); });
  return out;
}
function wavBuffer(pcm, rate) {
  var buf = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(buf);
  function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
  str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return buf;
}
function mp3Buffer(pcm, rate, kbps) {
  var enc = new self.lamejs.Mp3Encoder(1, rate, kbps || 128), chunks = [], size = 0;
  for (var i = 0; i < pcm.length; i += 1152) {
    var b = enc.encodeBuffer(pcm.subarray(i, i + 1152));
    if (b.length) { chunks.push(new Uint8Array(b.buffer, b.byteOffset, b.length).slice()); size += b.length; }
  }
  var end = enc.flush();
  if (end.length) { chunks.push(new Uint8Array(end.buffer, end.byteOffset, end.length).slice()); size += end.length; }
  var out = new Uint8Array(size), o = 0;
  chunks.forEach(function (c) { out.set(c, o); o += c.length; });
  return out.buffer;
}

self.onmessage = function (e) {
  var m = e.data;
  if (!m || m.type !== 'encode') return;
  try {
    var rate = m.sampleRate || 16000;
    var pcm = toInt16(concat(m.parts || [], Math.round(rate * (m.gapSec || 0))));
    var wav = wavBuffer(pcm, rate);
    var mp3 = mp3Buffer(pcm, rate, m.kbps);
    self.postMessage({ type: 'done', jobId: m.jobId, wav: wav, mp3: mp3, sampleRate: rate, samples: pcm.length }, [wav, mp3]);
  } catch (err) {
    self.postMessage({ type: 'error', jobId: m.jobId, name: (err && err.name) || 'Error', message: err && err.message ? err.message : String(err) });
  }
};
