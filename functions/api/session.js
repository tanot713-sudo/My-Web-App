/* sw.js เรียก endpoint นี้แบบ redirect:'manual' เพื่อแยกว่า redirect ของหน้าเว็บมาจาก Access (เซสชันหมดอายุ)
   หรือจาก Pages เอง (ตัด .html ออกจาก URL) — ถ้าผ่าน _middleware.js มาถึงตรงนี้ได้ แปลว่ายังล็อกอินอยู่ */
export function onRequestGet(context) {
  return new Response(JSON.stringify({ email: context.data.user.email }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
