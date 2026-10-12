/* /api/hf/Tanotfin/<repo>/resolve/<rev>/<ไฟล์> — ไฟล์โมเดลของ Tanotfin จาก Hugging Face ผ่าน HF_TOKEN (Secret)
   อยู่หลัง _middleware.js (JWT ของ Cloudflare Access + อีเมลเจ้าของ) · กติกา/เหตุผลทั้งหมดอยู่ที่ functions/_lib/hf.js */
import { proxyHf } from '../../_lib/hf.js';

export function onRequest(context) {
  return proxyHf(context.request, context.env);
}
