/* /api/craft/<ชื่อโฟลเดอร์>/<ไฟล์> — ไฟล์ของไลบรารี *Craft ที่เก็บใน R2 ("store": "r2" ใน vendor/craft/manifest.json)
   อยู่หลัง _middleware.js (JWT ของ Cloudflare Access + อีเมลเจ้าของ) · กติกา/เหตุผลทั้งหมดอยู่ที่ functions/_lib/craft.js */
import { serveCraft } from '../../_lib/craft.js';

export function onRequest(context) {
  return serveCraft(context.request, context.env);
}
