/* ══════════════════════════════════════════════════════════════════
   audio-gain.js — ปรับความดังอัตโนมัติของเสียงพูด (UMD, window/self.TanotAudioGain, ไม่มี DOM — require() ได้ใน test)
   เหตุผล: เสียงไทยแต่ละตัวดังไม่เท่ากัน (ไฟล์จริง: mean −28 / −27.4 / −21.4 / −21.9 dB ต่างกัน ~6–7 dB)
   กฎ: วัด RMS เฉพาะ "ช่วงมีเสียง" (เฟรม 20 ms ที่ RMS < −50 dBFS ถือว่าเงียบ ไม่นับ) →
       gain = min( max(1, เป้า RMS −20 dBFS / RMS), −1 dBFS / peak )
   • ไม่ลดเสียงที่ดังพออยู่แล้ว (gain ≥ 1) ยกเว้น peak เกิน −1 dBFS ซึ่งลดให้พอดี −1 dBFS
   • ใช้ gain เดียวทั้งก้อน (ไม่บีบอัดไดนามิก) ช่วงเงียบจึงไม่ถูกขยายเป็นเสียงรบกวนมากกว่าสัดส่วนเดิม
   • ก้อนไม่มีช่วงมีเสียงเลย (เงียบสนิท) → gain 1 */
(function (g, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g) g.TanotAudioGain = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null), function () {
  'use strict';
  var TARGET_RMS_DB = -20, PEAK_DB = -1, GATE_DB = -50, FRAME_SEC = 0.02;
  function db(x) { return Math.pow(10, x / 20); }

  /* → { rms (ของช่วงมีเสียง), peak, active (จำนวน sample ที่นับ) } */
  function measure(samples, rate) {
    var frame = Math.max(1, Math.round((rate || 16000) * FRAME_SEC)), gate2 = db(GATE_DB) * db(GATE_DB);
    var peak = 0, sum = 0, n = 0;
    for (var s = 0; s < samples.length; s += frame) {
      var e = Math.min(samples.length, s + frame), fs = 0;
      for (var i = s; i < e; i++) {
        var v = samples[i];
        if (v !== v) continue; // NaN
        fs += v * v;
        var a = v < 0 ? -v : v;
        if (a > peak) peak = a;
      }
      var len = e - s;
      if (len > 0 && fs / len >= gate2) { sum += fs; n += len; }
    }
    return { rms: n ? Math.sqrt(sum / n) : 0, peak: peak, active: n };
  }
  function gainFor(m, opts) {
    var o = opts || {};
    if (!m || !m.active || !(m.rms > 0) || !(m.peak > 0)) return 1;
    var target = db(o.targetDb != null ? o.targetDb : TARGET_RMS_DB), limit = db(o.peakDb != null ? o.peakDb : PEAK_DB);
    return Math.min(Math.max(1, target / m.rms), limit / m.peak);
  }
  /* คูณ gain ลงใน samples ตรงๆ (Float32Array) · คืน { gain, rms, peak } ของก่อนปรับ */
  function apply(samples, rate, opts) {
    var m = measure(samples, rate), gain = gainFor(m, opts);
    if (gain !== 1) for (var i = 0; i < samples.length; i++) samples[i] *= gain;
    return { gain: gain, rms: m.rms, peak: m.peak };
  }
  return { measure: measure, gainFor: gainFor, apply: apply, TARGET_RMS_DB: TARGET_RMS_DB, PEAK_DB: PEAK_DB, GATE_DB: GATE_DB };
});
