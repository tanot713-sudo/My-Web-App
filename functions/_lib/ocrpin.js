/* รหัสก่อนใช้ Claude Vision (/api/ocr) — ไฟล์นี้ไม่ export onRequest* จึงไม่ใช่ route
   OCR_PIN เป็น Secret ใน Cloudflare dashboard เท่านั้น (Pages → Settings → Variables and secrets) ห้ามใส่ค่าหรือ hash ของรหัสในไฟล์ใดๆ ของ repo (repo สาธารณะ)
   - ไม่มี env.OCR_PIN = ปฏิเสธทุกคำขอ (503 pin_unset) — fail closed
   - ต้องมี header X-OCR-Pin ตรงกับ OCR_PIN (เทียบ SHA-256 ของสองฝั่งแบบ constant-time) ก่อนเรียก Anthropic
   - กันเดา: นับ "ครั้งที่ลองรหัส" ใน D1 (ocr_pin_attempts, migrations/0003_ocr_pin.sql) — ลองได้ 5 ครั้งใน 10 นาที ครั้งที่ 6 เป็นต้นไป
     ล็อก 15 นาที (429 pin_locked) · นับ "ก่อน" เทียบรหัส จึงยิงพร้อมกันหลายคำขอก็ผ่านการเทียบได้ไม่เกิน 5 ครั้ง · รหัสถูก = ล้างตัวนับ
   - ไม่ log/ไม่ส่งคืนตัวรหัสที่กรอกมาที่ไหนเลย (ไม่มีการเรียก log ใดๆ, ข้อความ error ไม่ยกค่ามา) */

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_WINDOW_MS = 10 * 60 * 1000;
export const PIN_LOCK_MS = 15 * 60 * 1000;

function reply(status, body, extra) {
  return new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, extra || {}) });
}

async function sha256(s) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))));
}
async function sameSecret(given, expected) {
  const a = await sha256(given), b = await sha256(expected);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* คืน null เมื่อรหัสถูก, ไม่งั้นคืน Response ที่ต้องส่งกลับทันที */
export async function checkPin(env, request, now) {
  now = now || Date.now();
  if (typeof env.OCR_PIN !== 'string' || !env.OCR_PIN) {
    return reply(503, { error: 'ยังไม่ได้ตั้งรหัส OCR_PIN ใน Cloudflare — Claude Vision ปิดอยู่', code: 'pin_unset' });
  }
  const given = request.headers.get('X-OCR-Pin');
  if (!given) return reply(401, { error: 'ต้องกรอกรหัสก่อนใช้ Claude Vision', code: 'pin_required' });
  if (!env.DB) return reply(503, { error: 'ไม่พบฐานข้อมูลสำหรับนับการลองรหัส', code: 'pin_store' });

  try {
    const lock = await env.DB.prepare('SELECT locked_until FROM ocr_pin_lock WHERE id = 1').first();
    if (lock && Number(lock.locked_until) > now) {
      const wait = Math.ceil((Number(lock.locked_until) - now) / 1000);
      return reply(429, { error: 'ลองรหัสผิดหลายครั้ง ล็อกชั่วคราว', code: 'pin_locked', retryAfter: wait }, { 'Retry-After': String(wait) });
    }
    await env.DB.prepare('DELETE FROM ocr_pin_attempts WHERE at <= ?').bind(now - PIN_WINDOW_MS).run();
    await env.DB.prepare('INSERT INTO ocr_pin_attempts (at) VALUES (?)').bind(now).run();
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM ocr_pin_attempts WHERE at > ?').bind(now - PIN_WINDOW_MS).first();
    const n = row ? Number(row.n) || 0 : 0;
    if (n > PIN_MAX_ATTEMPTS) {
      await env.DB.prepare('INSERT INTO ocr_pin_lock (id, locked_until) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET locked_until = excluded.locked_until').bind(now + PIN_LOCK_MS).run();
      return reply(429, { error: 'ลองรหัสผิดหลายครั้ง ล็อกชั่วคราว', code: 'pin_locked', retryAfter: Math.ceil(PIN_LOCK_MS / 1000) }, { 'Retry-After': String(Math.ceil(PIN_LOCK_MS / 1000)) });
    }
    if (await sameSecret(given, env.OCR_PIN)) {
      await env.DB.prepare('DELETE FROM ocr_pin_attempts').run();
      await env.DB.prepare('DELETE FROM ocr_pin_lock').run();
      return null;
    }
    return reply(401, { error: 'รหัสไม่ถูกต้อง', code: 'pin_wrong', remaining: Math.max(0, PIN_MAX_ATTEMPTS - n) });
  } catch (e) {
    // ตารางยังไม่มี (ยังไม่ได้รัน migrations/0003_ocr_pin.sql) หรือ D1 ล่ม → ปิดตาย ไม่ปล่อยผ่านโดยไม่นับ
    return reply(503, { error: 'ตรวจรหัสไม่ได้ — ยังไม่ได้รัน migrations/0003_ocr_pin.sql ใน D1 console?', code: 'pin_store' });
  }
}
