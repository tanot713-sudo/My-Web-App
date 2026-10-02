// สร้างคู่คีย์ VAPID (P-256) ในเครื่องตัวเอง — รัน: node workers/scheduler/gen-vapid.mjs  (Node 18+ ไม่ต้อง npm install)
// พิมพ์คีย์ออกทางหน้าจอเท่านั้น ไม่เขียนไฟล์ — Public key ใส่ใน wrangler.toml [vars] ได้ (ทั้ง root และ workers/scheduler),
// Private key ตั้งเป็น Secret ชื่อ VAPID_PRIVATE_KEY ใน dashboard (Pages + Worker tanot-scheduler) ห้าม commit / ห้ามวางในแชต
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));
const jwk = await crypto.subtle.exportKey('jwk', privateKey);
const b64u = (u8) => Buffer.from(u8).toString('base64url');
console.log('VAPID_PUBLIC_KEY  = ' + b64u(raw));
console.log('VAPID_PRIVATE_KEY = ' + jwk.d);
