-- Tanot D1 schema v3 — กันเดารหัส OCR_PIN ของ /api/ocr (Claude Vision)
-- วางทั้งไฟล์ใน D1 console ของ tanot-db หลัง 0001/0002 (รันซ้ำได้ ทุกคำสั่งเป็น IF NOT EXISTS)
-- ไม่เก็บตัวรหัส (ทั้งที่กรอกและค่าจริง) — เก็บแค่เวลาที่มีการลองรหัส และเวลาที่ล็อกถึง
-- ลองได้ 5 ครั้งใน 10 นาที ครั้งที่ 6 เป็นต้นไป = ล็อก 15 นาที (รหัสถูกก็ไม่ผ่านระหว่างล็อก) · รหัสถูก = ล้างตัวนับ
CREATE TABLE IF NOT EXISTS ocr_pin_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ocr_pin_attempts_at ON ocr_pin_attempts (at);
CREATE TABLE IF NOT EXISTS ocr_pin_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  locked_until INTEGER NOT NULL DEFAULT 0
);
