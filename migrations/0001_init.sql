-- Tanot D1 schema v1 (database: tanot-db)
-- วางทั้งไฟล์ใน D1 console ได้เลย — ทุกคำสั่งเป็น IF NOT EXISTS รันซ้ำได้ไม่พัง
-- เวลาทั้งหมดเป็น epoch milliseconds (INTEGER), JSON เก็บเป็น TEXT

-- ข้อมูลซิงก์ local-first ทุกหน้า (Phase 1): 1 แถว = 1 เอกสารใน namespace
-- rev = ลำดับการเขียนแบบเพิ่มขึ้นเรื่อยๆ ทั้งตาราง ไคลเอนต์ดึงเฉพาะ rev > ค่าล่าสุดที่เคยเห็น (ห้ามอ่านทั้งตาราง)
-- ลบ = ตั้ง deleted=1 (tombstone) ไม่ลบแถวจริง เพื่อให้เครื่องอื่นรู้ว่าต้องลบตาม
CREATE TABLE IF NOT EXISTS docs (
  ns         TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  data       TEXT,
  updated_at INTEGER NOT NULL,
  rev        INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  device     TEXT,
  PRIMARY KEY (ns, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS docs_rev ON docs (rev);

-- การแจ้งเตือน (scheduler ตรวจทุก 15 นาที)
CREATE TABLE IF NOT EXISTS reminders (
  id         TEXT    PRIMARY KEY,
  title      TEXT    NOT NULL,
  body       TEXT,
  url        TEXT,
  due_at     INTEGER NOT NULL,
  repeat     TEXT,               -- NULL | 'daily' | 'weekly' | 'monthly' | 'yearly'
  source     TEXT,               -- เช่น 'insurance:<id>', 'car:tax'
  sent_at    INTEGER,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reminders_pending ON reminders (done, due_at);

-- Web Push subscriptions (1 แถวต่อเบราว์เซอร์/เครื่อง)
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint   TEXT    PRIMARY KEY,
  p256dh     TEXT    NOT NULL,
  auth       TEXT    NOT NULL,
  device     TEXT,
  created_at INTEGER NOT NULL,
  last_ok_at INTEGER,
  fail_count INTEGER NOT NULL DEFAULT 0
);

-- การ์ดทบทวนรวมทุกวิชา (FSRS) — area: 'law' | 'lang' | 'eng' | 'book' | ...
CREATE TABLE IF NOT EXISTS learn_cards (
  id          TEXT    PRIMARY KEY,
  area        TEXT    NOT NULL,
  source      TEXT,
  front       TEXT    NOT NULL,
  back        TEXT,
  data        TEXT,
  due         INTEGER,
  stability   REAL,
  difficulty  REAL,
  reps        INTEGER NOT NULL DEFAULT 0,
  lapses      INTEGER NOT NULL DEFAULT 0,
  state       INTEGER NOT NULL DEFAULT 0,  -- FSRS: 0 new, 1 learning, 2 review, 3 relearning
  last_review INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS learn_cards_due ON learn_cards (deleted, due);
CREATE INDEX IF NOT EXISTS learn_cards_area ON learn_cards (area);

-- บันทึกการทบทวน + XP (1 แถวต่อเหตุการณ์ append-only) — card_id เป็น NULL ได้ถ้าเป็น XP จากกิจกรรมอื่น
CREATE TABLE IF NOT EXISTS learn_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id     TEXT,
  area        TEXT    NOT NULL,
  source      TEXT,
  rating      INTEGER,            -- FSRS: 1 again, 2 hard, 3 good, 4 easy
  xp          INTEGER NOT NULL DEFAULT 0,
  at          INTEGER NOT NULL,
  device      TEXT
);
CREATE INDEX IF NOT EXISTS learn_log_at ON learn_log (at);
CREATE INDEX IF NOT EXISTS learn_log_card ON learn_log (card_id);

-- แคชผลลัพธ์ AI (key = hash ของ task+model+input)
CREATE TABLE IF NOT EXISTS ai_cache (
  key        TEXT    PRIMARY KEY,
  task       TEXT    NOT NULL,
  model      TEXT    NOT NULL,
  result     TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  hits       INTEGER NOT NULL DEFAULT 0
);

-- โควตา/การใช้งาน AI รายวัน (day = 'YYYY-MM-DD' ตาม UTC เพราะโควตา Workers AI ตัดรอบ UTC)
CREATE TABLE IF NOT EXISTS ai_usage (
  day        TEXT    NOT NULL,
  kind       TEXT    NOT NULL,    -- 'chat' | 'summarize' | 'embed' | 'asr' | 'ocr'
  requests   INTEGER NOT NULL DEFAULT 0,
  neurons    REAL    NOT NULL DEFAULT 0,
  tokens_in  INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);

-- ดัชนีไฟล์ใน R2 (bucket tanot-files) — ตัวไฟล์อยู่ใน R2 ที่ r2_key, ตารางนี้เก็บแค่ข้อมูลกำกับ
CREATE TABLE IF NOT EXISTS files (
  id         TEXT    PRIMARY KEY,
  r2_key     TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  mime       TEXT,
  size       INTEGER NOT NULL,
  sha256     TEXT,
  ns         TEXT,                -- เจ้าของไฟล์ เช่น 'insurance', 'receipts'
  ref_id     TEXT,
  created_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS files_ref ON files (ns, ref_id);
