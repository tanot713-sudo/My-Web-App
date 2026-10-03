/* /api/files — เก็บไฟล์แนบใน R2 (bucket tanot-files, binding FILES) + ดัชนีใน D1 ตาราง files (migrations/0001_init.sql)
   POST   /api/files?ns=<ns>&ref=<รหัสรายการเจ้าของ>&name=<ชื่อไฟล์>   body = ไบต์ของไฟล์ (Content-Type = mime)  → { id, name, size, mime }
   GET    /api/files?id=<id>                                          → ตัวไฟล์ (?download=1 บังคับดาวน์โหลด)
   DELETE /api/files?id=<id>                                          → { ok:true }  (ลบจาก R2 + ตั้ง deleted=1)
   ns ที่รองรับ: insurance, maintenance, health, receipts, compare, slides, recipes, car · ชนิดไฟล์: PDF และรูปภาพ · ขนาดสูงสุด 15 MiB
   ด่าน Access JWT อยู่ที่ _middleware.js แล้ว — ที่นี่ไม่เชื่อชื่อไฟล์/ชนิดจากผู้ใช้เกินจำเป็น:
   key ใน R2 สร้างจาก ns + uuid เอง (ไม่เอาชื่อไฟล์ไปต่อเป็นพาธ), ชนิดต้องอยู่ใน allowlist, ตอนส่งกลับใส่ nosniff + CSP sandbox */

const MAX_BYTES = 15 * 1024 * 1024;
const NAMESPACES = ['insurance', 'maintenance', 'health', 'receipts', 'compare', 'slides', 'recipes', 'car'];
const MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function cleanName(s) {
  // ตัดตัวควบคุม/ตัวคั่นพาธ และจำกัดความยาว — ใช้เป็นข้อความแสดงผลเท่านั้น ไม่เคยเป็นพาธ
  const n = String(s || '').replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim().slice(0, 200);
  return n || 'file';
}

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function ready(env, request) {
  // คำขอเขียน/ลบต้องมาจากหน้าของเราเอง (Origin ตรงโดเมน) — กัน CSRF จากเว็บอื่นที่อาศัยคุกกี้ Access ของผู้ใช้
  const origin = request.headers.get('Origin');
  if (request.method !== 'GET' && origin && origin !== new URL(request.url).origin) return json(403, { error: 'Forbidden origin' });
  if (!env.FILES) return json(500, { error: 'R2 binding FILES missing' });
  if (!env.DB) return json(500, { error: 'D1 binding DB missing' });
  return null;
}

export async function onRequestPost({ request, env }) {
  const bad = ready(env, request);
  if (bad) return bad;
  const url = new URL(request.url);
  const ns = url.searchParams.get('ns') || '';
  const ref = (url.searchParams.get('ref') || '').slice(0, 128);
  if (!NAMESPACES.includes(ns)) return json(400, { error: 'ns ไม่ถูกต้อง' });
  if (!ref) return json(400, { error: 'ต้องระบุ ref' });
  const mime = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!MIMES.includes(mime)) return json(415, { error: 'รองรับเฉพาะ PDF และรูปภาพ' });
  const declared = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (declared > MAX_BYTES) return json(413, { error: 'ไฟล์ใหญ่เกิน 15 MB' });

  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return json(400, { error: 'ไฟล์ว่าง' });
  if (bytes.byteLength > MAX_BYTES) return json(413, { error: 'ไฟล์ใหญ่เกิน 15 MB' });

  const id = crypto.randomUUID();
  const key = ns + '/' + id;
  const name = cleanName(url.searchParams.get('name'));
  const sha = hex(await crypto.subtle.digest('SHA-256', bytes));
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await env.DB.prepare(
      'INSERT INTO files (id, r2_key, name, mime, size, sha256, ns, ref_id, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)'
    ).bind(id, key, name, mime, bytes.byteLength, sha, ns, ref, Date.now()).run();
  } catch (e) {
    await env.FILES.delete(key); // ไม่ให้มีไฟล์กำพร้าใน R2 ที่ไม่มีดัชนี
    return json(500, { error: 'บันทึกดัชนีไฟล์ไม่สำเร็จ' });
  }
  return json(200, { id, name, size: bytes.byteLength, mime });
}

async function findRow(env, id) {
  if (!id) return null;
  return env.DB.prepare('SELECT id, r2_key, name, mime, size FROM files WHERE id = ?1 AND deleted = 0').bind(id).first();
}

export async function onRequestGet({ request, env }) {
  const bad = ready(env, request);
  if (bad) return bad;
  const url = new URL(request.url);
  const row = await findRow(env, url.searchParams.get('id'));
  if (!row) return json(404, { error: 'ไม่พบไฟล์' });
  const obj = await env.FILES.get(row.r2_key);
  if (!obj) return json(404, { error: 'ไม่พบไฟล์' });
  const disp = url.searchParams.get('download') === '1' ? 'attachment' : 'inline';
  return new Response(obj.body, {
    headers: {
      'Content-Type': row.mime || 'application/octet-stream',
      'Content-Length': String(row.size),
      'Content-Disposition': disp + "; filename*=UTF-8''" + encodeURIComponent(row.name),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'sandbox',
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}

export async function onRequestDelete({ request, env }) {
  const bad = ready(env, request);
  if (bad) return bad;
  const row = await findRow(env, new URL(request.url).searchParams.get('id'));
  if (!row) return json(404, { error: 'ไม่พบไฟล์' });
  await env.FILES.delete(row.r2_key);
  await env.DB.prepare('UPDATE files SET deleted = 1 WHERE id = ?1').bind(row.id).run();
  return json(200, { ok: true });
}
