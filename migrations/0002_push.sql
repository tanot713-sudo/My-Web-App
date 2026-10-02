-- Tanot D1 schema v2 — Web Push + การแจ้งเตือน (Phase 3 / 0a ข้อ 6)
-- วางใน D1 console ของ tanot-db หลัง 0001 (ครั้งเดียว — ALTER TABLE รันซ้ำจะขึ้น "duplicate column name: kind" ซึ่งไม่เสียหาย)
-- kind: 'push'   = ส่งทีละรายการเมื่อถึง due_at (ต่ออายุประกัน, กำหนดยื่นภาษี)
--       'digest' = บรรทัดในสรุปประจำวัน 07:00 เวลาไทยของวันที่ due_at ตกอยู่ (งาน PM: 1 แถวต่อวัน ไม่ใช่ทีละเครื่อง)
ALTER TABLE reminders ADD COLUMN kind TEXT NOT NULL DEFAULT 'push';
-- หน้าเว็บลงทะเบียนแบบ "แทนที่ทั้ง scope" (source = scope) → ค้นตาม source
CREATE INDEX IF NOT EXISTS reminders_source ON reminders (source);
