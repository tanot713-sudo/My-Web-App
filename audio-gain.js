/* ══════════════════════════════════════════════════════════════════
   audio-gain.js — ปรับความดังอัตโนมัติของเสียงพูด (UMD, window/self.TanotAudioGain, ไม่มี DOM — require() ได้ใน test)
   เหตุผล: เสียงไทยแต่ละตัวดังไม่เท่ากัน (ไฟล์จริง: mean −28 / −27.4 / −21.4 / −21.9 dB ต่างกัน ~6–7 dB)
   กฎ: วัด RMS เฉพาะ "ช่วงมีเสียง" (เฟรม 20 ms ที่ RMS < −50 dBFS ถือว่าเงียบ ไม่นับ) →
       gain = min( max(1, เป้า RMS −20 dBFS / RMS), −1 dBFS / peak )
   • ไม่ลดเสียงที่ดังพออยู่แล้ว (gain ≥ 1) ยกเว้น peak เกิน −1 dBFS ซึ่งลดให้พอดี −1 dBFS
   • ใช้ gain เดียวทั้งก้อน (ไม่บีบอัดไดนามิก) ช่วงเงียบจึงไม่ถูกขยายเป็นเสียงรบกวนมากกว่าสัดส่วนเดิม
   • ก้อนไม่มีช่วงมีเสียงเลย (เงียบสนิท) → gain 1

   ลดเสียงแหลม (lowpass / process): MMS-TTS หญิง ทั่วไป (22.05 kHz) มี "เสียงแหลมจนมีเสียงรบกวนเล็กน้อย" (เจ้าของฟังจริง) → ตัวกรอง low-pass 2nd-order (biquad RBJ, Q 0.707 = Butterworth)
   ที่ ~7 kHz ใช้กับเสียงที่ sampleRate > 16 kHz เท่านั้น (โมเดล 16 kHz ไม่มีย่านเหนือ 8 kHz ให้กรอง → ไม่แตะ) · ทำ "ก่อน" ปรับความดังเสมอ (process) เพื่อให้ gain/peak วัดจากเสียงที่กรองแล้ว
   • คำนวณด้วย float64 ใน-place (Direct Form I) · สถานะตัวกรองเริ่มที่ 0 ทุกครั้งที่เรียก — เรียกกับก้อนที่ต่อกันแล้ว (ทั้งไฟล์/ทั้งตอน) ไม่ใช่รายท่อน เพื่อไม่ให้มีรอยสะดุดที่ขอบท่อน */
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

  var LOWPASS_HZ = 7000, LOWPASS_Q = Math.SQRT1_2, LOWPASS_MIN_RATE = 16000;
  /* ตัวกรองจะมีผลไหมที่ rate นี้ (ต้อง > 16 kHz และ fc ต่ำกว่า Nyquist พอสมควร) */
  function lowpassApplies(rate, hz) {
    hz = hz > 0 ? hz : LOWPASS_HZ;
    return rate > LOWPASS_MIN_RATE && hz < rate * 0.45;
  }
  /* biquad low-pass ใน-place · คืน true ถ้ากรองจริง (false = rate ≤ 16 kHz / ไม่ได้ขอ → samples ไม่เปลี่ยน) · opts: { hz, q } */
  function lowpass(samples, rate, opts) {
    var o = opts || {}, hz = o.hz > 0 ? o.hz : LOWPASS_HZ, q = o.q > 0 ? o.q : LOWPASS_Q;
    if (!lowpassApplies(rate, hz)) return false;
    var w0 = 2 * Math.PI * hz / rate, cs = Math.cos(w0), alpha = Math.sin(w0) / (2 * q), a0 = 1 + alpha;
    var b0 = (1 - cs) / 2 / a0, b1 = (1 - cs) / a0, b2 = b0, a1 = -2 * cs / a0, a2 = (1 - alpha) / a0;
    var x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < samples.length; i++) {
      var x = samples[i];
      if (x !== x) x = 0; // NaN ไม่ปล่อยให้ค้างอยู่ในสถานะตัวกรอง
      var y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      samples[i] = y;
    }
    return true;
  }
  /* ลดเสียงแหลม (ถ้าขอ: opts.lowpass = true | Hz) → ปรับความดัง (opts.normalize !== false) · คืน { gain, rms, peak, lowpass } */
  function process(samples, rate, opts) {
    var o = opts || {}, lp = false;
    if (o.lowpass) lp = lowpass(samples, rate, { hz: typeof o.lowpass === 'number' ? o.lowpass : undefined });
    var r = o.normalize === false ? { gain: 1, rms: 0, peak: 0 } : apply(samples, rate, o);
    r.lowpass = lp;
    return r;
  }
  return { measure: measure, gainFor: gainFor, apply: apply, lowpass: lowpass, lowpassApplies: lowpassApplies, process: process,
    TARGET_RMS_DB: TARGET_RMS_DB, PEAK_DB: PEAK_DB, GATE_DB: GATE_DB, LOWPASS_HZ: LOWPASS_HZ, LOWPASS_Q: LOWPASS_Q };
});
