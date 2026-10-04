/* ตัวช่วยร่วมของ /api/files และ endpoint ที่เก็บไฟล์ลง R2 เอง (เช่น /api/ai/image) — ไฟล์นี้ไม่ export onRequest* จึงไม่ใช่ route
   key ใน R2 สร้างจาก ns + uuid เอง (ไม่เอาชื่อไฟล์ไปต่อเป็นพาธ) และต้องมีแถวดัชนีใน D1 ตาราง files เสมอ */

export function cleanName(s) {
  // ตัดตัวควบคุม/ตัวคั่นพาธ และจำกัดความยาว — ใช้เป็นข้อความแสดงผลเท่านั้น ไม่เคยเป็นพาธ
  const n = String(s || '').replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim().slice(0, 200);
  return n || 'file';
}

export function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* เก็บไบต์ลง R2 + ดัชนี D1 → { id, name, size, mime }; ดัชนีพลาด = ลบไฟล์ใน R2 ทิ้ง (ไม่ให้มีไฟล์กำพร้า) แล้ว throw */
export async function putFile(env, { ns, ref, name, mime, bytes }) {
  const id = crypto.randomUUID();
  const key = ns + '/' + id;
  const cleaned = cleanName(name);
  const sha = hex(await crypto.subtle.digest('SHA-256', bytes));
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await env.DB.prepare(
      'INSERT INTO files (id, r2_key, name, mime, size, sha256, ns, ref_id, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)'
    ).bind(id, key, cleaned, mime, bytes.byteLength, sha, ns, ref, Date.now()).run();
  } catch (e) {
    await env.FILES.delete(key);
    throw e;
  }
  return { id, name: cleaned, size: bytes.byteLength, mime };
}
