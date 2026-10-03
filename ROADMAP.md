# แผนพัฒนาเว็บแอป Tanot — ทุกหน้า + ธีมกลาง + ระบบหลังบ้าน

## Context
เจ้าของต้องการให้ Tanot (repo `tanot713-sudo/my-web-app`, 45 ไฟล์ HTML) เป็นเว็บแอปส่วนตัวที่ใช้ได้จริงใน 4 ด้าน: การทำงาน, การใช้ชีวิต, การศึกษา, งานอดิเรก ไม่จำเป็นต้องเป็น static อีกต่อไป และต้องการธีมที่ดูเป็นมืออาชีพ เหมาะกับแต่ละประเภทหน้า โดยควบคุมจากศูนย์กลางที่เดียว

**ตัดสินใจแล้ว (จาก Q&A):** ใช้คนเดียว (ซิงก์คอม + มือถือ) · หลังบ้านบน Cloudflare · ธีมลดเหลือชุดคัดสรร · ทั้ง 4 ด้านสำคัญเท่ากัน (สลับทำ)

**สภาพปัจจุบันที่สำคัญ (ตรวจแล้ว):**
- **Cloudflare Pages build ล้มเหลวมาตั้งแต่ ~11 ก.ย.** เพราะ `vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm` มีขนาด 25.93 MiB ซึ่งเกินลิมิตไฟล์เดียว 25 MiB → `my-web-app-5w2.pages.dev` ค้างเป็นเวอร์ชันเก่า
- ไม่มีโค้ดฝั่งเซิร์ฟเวอร์ใน repo; Worker 3 ตัวต้อง deploy เองด้วยมือ (มีโค้ด CORS proxy และ Whisper proxy แต่**โค้ด OCR proxy ไม่อยู่ใน repo**); endpoint ที่เสียเงินป้องกันด้วยรหัสผ่านฝั่ง client เท่านั้น
- `auth-gate.js` ไม่ใช่ความปลอดภัยจริง; ~12 หน้าก๊อป DriveSync แยกกัน; budget ใช้ Firebase; ไม่มีตัวตนผู้ใช้ร่วมกันทั้งเว็บ
- `theme.css` มีแค่ tokens + shell **ไม่มีชั้นคอมโพเนนต์กลาง**: `.btn` นิยามซ้ำ 33 ไฟล์, `.card` 25, border-radius 32 ค่า, theme-color 11 ค่า, ไอคอนปนกัน emoji/SVG/Lucide, สีกราฟ hardcode ใน JS, จอกะพริบสว่างก่อนเข้าโหมดมืด (FOUC)
- หน้าที่ยังไม่ทำ (SOON): รวบรวมข้อมูล, เปรียบเทียบข้อมูล, จำลองคน, เกม · ห้องเรียนกฎหมายมีวิชาเดียว
- invest มี 16 หน้า (set50-scanner, trade-journal ไม่อยู่ในเมนู)

---

## Phase 0 — ฐานราก (ต้องทำก่อนทุกอย่าง)

### 0a. แพลตฟอร์ม Cloudflare (M)
1. ✅ **เสร็จแล้ว (commit 9950e92)** — **แก้ build พัง**: ไม่เก็บ `.wasm` ตัว 25.93 MiB ใน repo แล้ว ให้โหลดจาก jsDelivr แบบ pin `onnxruntime-web@1.24.3` (หรือจาก R2) ส่วนไฟล์ `.mjs` ยังเก็บในเครื่องเหมือนเดิม — ไฟล์ที่ต้องแก้: `text-to-speech.js`, `tts-worker.js`, `asr-worker.js`, `ai-chat-worker.js` + เพิ่ม `credits.html` และเพิ่มการตรวจกันไฟล์เกิน 25 MiB ใน `tests/repo-guards.mjs`
2. ✅ **เสร็จแล้ว (2026-09-28)** — `wrangler.toml` ที่ root: `pages_build_output_dir="."` + binding `DB` (D1), `FILES` (R2), `AI` — **ไม่มี `package.json` ที่ root** (ถ้ามี Cloudflare จะรัน npm install ทุก build)
3. ✅ **เสร็จแล้ว (2026-09-28)** — ย้าย Worker 3 ตัวมาเป็น Pages Functions (เก็บเวอร์ชันใน repo) + `functions/api/session.js` (ให้ `sw.js` ใช้เช็กว่าเซสชัน Access หมดหรือยัง) · โค้ด Worker เดิมเก็บไว้ที่ `docs/*-original.js` · ปุ่มโหมดคลาวด์ (OCR/ถอดเสียง) แสดงเฉพาะบน `*.pages.dev` เพราะ GitHub Pages ไม่มี `/api/*`:
   - `functions/api/_middleware.js` ตรวจ JWT ของ Access (header `Cf-Access-Jwt-Assertion`) ว่า aud ถูก + เป็นอีเมลเจ้าของ
   - `functions/api/proxy.js` (แทน cors-proxy, ยังคง allowlist เดิม), `asr.js` (Whisper), `ocr.js` (กู้โค้ดมา, คีย์เก็บเป็น secret)
   - ลบ hash รหัสผ่านฝั่ง client ใน `text-to-speech.js:603`, `doc-check.js:57`
4. ✅ **เสร็จแล้ว (2026-09-28)** — ต่างจากแผนเดิม 1 จุด: `auth-gate.js` ข้ามตัวเองบน `*.pages.dev` แทนการลบทิ้งทั้ง 42 หน้า เพราะ GitHub Pages ยังเปิดอยู่จนถึงข้อ 7 (ลบจริงตอนเปลี่ยน GitHub Pages เป็น redirect) — **Cloudflare Access** (Zero Trust ฟรี) ครอบ `my-web-app-5w2.pages.dev` ทั้งโดเมน โดยไม่ต้องซื้อโดเมน (ใช้วิธีลบ `*` ที่ subdomain ตามเอกสาร Known issues) → เลิกใช้ `auth-gate.js` ทั้ง 42 หน้า; `<link rel="manifest" crossorigin="use-credentials">`; ใน `sw.js` ถ้าคำตอบถูก redirect ไปหน้าล็อกอิน ให้แสดงหน้าจากแคช + ลิงก์ล็อกอินใหม่
5. ✅ **เสร็จแล้ว (2026-09-28, วางใน D1 แล้ว 2026-09-30)** — **D1 schema** `migrations/0001_init.sql`: `docs(ns,id,data,updated_at,rev,deleted,device)` + index `rev`, `reminders`, `push_subs`, `learn_cards`, `learn_log`, `ai_cache`, `ai_usage`, `files`
6. ✅ **เสร็จแล้ว (2026-10-02, PR รอตรวจ — เจ้าของต้องตั้งคีย์ VAPID + ต่อ Workers Builds เอง ดู "สิ่งที่เจ้าของต้องทำเอง" ข้อ 7)** — **Scheduler Worker** แยก `workers/scheduler/` (Pages Functions ตั้ง cron ไม่ได้): `index.js` + `wrangler.toml` (ชื่อ `tanot-scheduler`, D1 `tanot-db` / R2 `tanot-files` ตัวเดียวกับ Pages, `workers_dev = false` ไม่มี URL สาธารณะ) · cron `*/15 * * * *` ส่ง Web Push ของรายการที่ถึงเวลา, `0 0 * * *` (= 07:00 เวลาไทย) ส่งสรุปประจำวัน + ล้างแถวเก่า + สำรอง D1 → R2 `backups/d1/<วันที่ไทย>.json.gz` (gzip, เก็บ 30 วัน, ไม่สำรอง `ai_cache` เพราะสร้างใหม่ได้) · ตรรกะทั้งหมดอยู่ใน `functions/_lib/scheduler.js` (+ `reminders.js` ตรรกะล้วนเวลาไทย, `push.js` งาน D1, `webpush.js` VAPID + aes128gcm ด้วย WebCrypto ไม่ใช้ไลบรารี) ใช้ร่วมกับ Pages Functions และเทสต์ · ต่างจากแผน: ตาราง `reminders` เพิ่มคอลัมน์ `kind` ('push' ส่งทีละรายการ / 'digest' บรรทัดในสรุป 07:00) ด้วย `migrations/0002_push.sql` · **ต้องดูหลังต่อใช้งานจริง:** Workers ฟรีจำกัด CPU 10 ms ต่อครั้ง — การเข้ารหัส push ใช้ WebCrypto (เร็ว) แต่ `JSON.stringify` + gzip ของตาราง `docs` ตอนสำรองอาจเกินเมื่อข้อมูลโตขึ้น ถ้า log ของ Worker ขึ้น "exceeded CPU" ให้แยกการสำรองเป็นทีละตาราง/หลาย cron หรืออัปเกรด Workers Paid
7. ✅ **เสร็จแล้ว (2026-10-02)** — GitHub Pages เป็น redirect ไป pages.dev อย่างเดียว (`.github/scripts/github-pages-redirect.mjs`) เก็บ `migrate-export.html` ไว้ใช้ย้ายข้อมูลซ้ำได้ · ✅ ถอด `auth-gate.js` ออกจากทุกหน้า + ลบไฟล์แล้ว (2026-10-02)

### 0b. ✅ ชุดทดสอบอัตโนมัติ (M) — เสร็จแล้ว (2026-09-30) — ทำก่อนแตะธีม
- `tests/` (มี `package.json` ของตัวเอง ไม่ใช่ที่ root)
- `smoke.spec.js`: ทุกหน้าในเมนูโหลดได้ด้วย storage จำลอง + ปิดเน็ต, ไม่มี console error, nav แสดงผล, จอกว้าง 390px ไม่ล้นแนวนอน
- `visual.spec.js`: ภาพ baseline ที่ 390/1100px × สว่าง/มืด ไว้เทียบตอนย้ายธีม
- `repo-guards.mjs` ตรวจ: bump `CACHE` แล้ว, ไฟล์ใน PRECACHE มีจริง, ไม่มีไฟล์เกิน 25 MiB, `languages.compiled.js` ตรงกับ `.jsx`, CDN/vendor ใหม่มีใน `credits.html`
- ต่อเข้า `.github/workflows/deploy-pages.yml` ให้รันบน PR

### 0c. ✅ ธีม v2 — แกนกลาง (M) — เสร็จแล้ว (2026-09-30) · รอเจ้าของเลือกฟอนต์หลักที่ `theme-preview.html`
ต่างจากแผนเดิม: (1) กฎ compat **ไม่ได้อยู่ใน `@layer`** — กฎรีแมป/nav ของ shell ต้องชนะ `<style>` ของหน้าเอง ถ้าใส่ layer จะกลับแพ้ จึงเป็นส่วนท้ายไฟล์ที่ไม่มี layer แทน (ลบทีละส่วนตอน Phase 2) · (2) base/components/layouts ทำงานเฉพาะหน้าที่มี `body[data-layout]` (ครอบ `:where()`) หน้าเดิมจึงไม่เปลี่ยนสักพิกเซล (ภาพ baseline ผ่านครบ) · (3) โทเคนใหม่ขึ้นต้น `--ome-` ทั้งหมด (`--ome-chart-1..8` แทน `--chart-1..8`) กันชนกับตัวแปรของแต่ละหน้า · (4) ใส่ `theme-boot.js` ใน `<head>` ครบทั้ง 42 หน้าแล้ว (ไม่ถือเป็นการย้ายหน้า — แค่ย้ายค่าตั้งธีมจาก `shell.js` มาไว้ที่เดียว) · (5) สีเน้นใช้ชื่อใหม่ `teal/blue/violet/orange/graphite` (แปลงจาก mint/coach→teal, skypastel/crypto→blue, finset/bubblegum→violet, construct/flooks/gymes→orange) · สไตล์ glass/neumorph/clay/mica/aurora→soft, neubrutal→outline · ฟอนต์ kanit/mitr→Prompt, sarabun/notosans→IBM Plex Sans Thai · (6) `theme-color` = สีพื้น nav ตามสีเน้น/โหมด แทนสีแบรนด์ 11 ค่าเดิม
- **จัด `theme.css` เป็น `@layer tokens, base, components, layouts, compat`** เพื่อให้ style เดิมของแต่ละหน้ายังชนะได้โดยไม่ต้องใช้ `!important` → ย้ายทีละหน้าได้อย่างปลอดภัย
- **Tokens ใหม่**: พื้นผิว 0/1/2, ตัวอักษร 1/2/3, เส้น, สีเน้น + สีตัวอักษรบนสีเน้น, สีสถานะ ok/warn/err/info (+ แบบจาง), radius 4 ขั้น (6/10/14/999), เงา 3 ขั้น, z-index, motion, สีกราฟ `--chart-1..8` / `--chart-up/down` / grid / axis — และเริ่มใช้ `--ome-sp-*` / `--ome-fs-*` ที่มีอยู่แล้วจริงจัง
- **คอมโพเนนต์กลาง**: btn (4 แบบ × 3 ขนาด), card, field/input/select, table, badge/chip, tabs, segmented, kpi, toolbar, empty-state, toast, dialog, list-row
- **เลย์เอาต์ตามประเภทหน้า** `body[data-layout]`: `tool` (เครื่องมือทั่วไป), `app` (editor เต็มจอ: Word/Excel/CAD), `reader` (บทเรียน อ่านสบาย ~72 ตัวอักษรต่อบรรทัด, ฟอนต์ Sarabun), `dashboard` (KPI + กราฟ), `hub` (หน้ารวมไทล์)
- `chart-theme.js`: อ่านสีจาก CSS vars แล้วส่งให้ Lightweight Charts/Chart.js/ECharts ให้เปลี่ยนตามธีมอัตโนมัติ
- ไอคอนชุดเดียว: Lucide SVG sprite `icons.svg` (ISC) แทน emoji ใน UI
- `theme-boot.js` (~1KB โหลดใน `<head>` แบบไม่ defer) ตั้งธีม/สี/ฟอนต์ + `theme-color` ก่อนวาดจอ → หายกะพริบ
- **ชุดคัดสรร** (แปลงค่าที่ผู้ใช้เลือกไว้เดิมให้อัตโนมัติ): สีเน้น 9 → 5 (teal ค่าเริ่มต้น, blue, violet, orange, graphite) · สไตล์พื้นผิว 8 → 3 (flat ค่าเริ่มต้น, soft, outline) · ฟอนต์ 6 → 2 (จะทำหน้าตัวอย่างให้เลือกระหว่าง IBM Plex Sans Thai กับ Prompt ตอนลงมือ)

### 0d. ✅ จัดเมนูใหม่ตาม 4 ด้านของชีวิต (S) — เสร็จแล้ว (2026-09-30) · ฟอนต์หลัก = Prompt (ค่าเริ่มต้นของ `theme-boot.js`; IBM Plex Sans Thai ยังเลือกได้ในตั้งค่า) · `documents.html` เหลือเป็นหน้า redirect ไป `area.html?a=work`
`MENU` ใน `shell.js` เพิ่มฟิลด์ `area/icon/keywords/status`; หน้า `area.html?a=` แสดงไทล์ของแต่ละด้าน (รวม `documents.html` เข้าไป)
- **วันนี้** (หน้าแรก)
- **งาน**: เอกสาร (Word, Excel, PowerPoint, ดึงข้อความ, ตรวจเอกสาร, เปรียบเทียบข้อมูล) · วิศวกรรม (CAD, ประเมินราคา PM/CM, บันทึกงานบำรุงรักษา, เครื่องคำนวณไฟฟ้า) · ข้อมูล/รายงาน (รวบรวมข้อมูล, นำเสนอรายงาน) · กฎหมาย · แปลงเสียง↔ข้อความ
- **ชีวิตประจำวัน**: การเงิน (รายรับรายจ่าย, ภาษี, ประกัน, การลงทุน) · สุขภาพ · คลังใบเสร็จ/ประกันสินค้า
- **การศึกษา**: ทบทวนวันนี้ · ห้องเรียน 3 ห้อง · ภาษา · หนังสือ
- **งานอดิเรก/ทักษะ**: ดนตรี, กีฬา, ทำอาหาร, เขียนโค้ด, พิมพ์ดีด, เกม, 3D
- **ตั้งค่า/ข้อมูล**

---

## Phase 1 — ชั้นข้อมูลกลาง local-first (L)
**สถานะ (2026-09-30, PR รอตรวจ):** ✅ `tanot-data.js` + `data-registry.js` + `functions/api/sync.js` + `migrate.html`/`migrate-export.html` + `drive-backup.js` + หน้า `data.html` (สถานะซิงก์/สำรอง/กู้คืน/ค่าที่ถูกแทน) · ต่างจากแผน: ข้อมูลยังอยู่ที่ localStorage/IndexedDB เดิมของแต่ละหน้า (tanot-data เก็บแค่ shadow + คิวใน IndexedDB `tanot-data`) · คีย์ budget จริงคือ `budget:*` · ข้อมูล budget ใน Firebase ไม่ได้ดึงแยก — budget.html เขียนค่าจาก Firebase ลง localStorage ของ github.io อยู่แล้ว จึงมากับการย้าย · **ยังไม่ทำ (รอย้ายครบ 2 เครื่อง เพราะ GitHub Pages ยังใช้อยู่):** ลบ DriveSync รายหน้า 12 ชุด, `firebase-sync.js`, `ai-summary-cache.js`, `vendor/firebase` · ✅ cron สำรอง D1 → R2 ทำแล้วใน Scheduler Worker (0a ข้อ 6, 2026-10-02) · ไฟล์ 3D (ไบนารี) ย้าย/สำรองได้ แต่ไม่ซิงก์ขึ้น D1 (รอ R2) · คลังรายงาน `report-dashboard` (id แบบ autoIncrement ชนกันข้ามเครื่อง) ย้าย/สำรองเท่านั้น จนกว่าหน้าจะเปลี่ยนไปใช้ id ที่ไม่ซ้ำข้ามเครื่อง · budget.html บน pages.dev ไม่เปิด Firebase แล้ว (ส่งทั้งก้อนมาเขียนทับจะลบรายการจาก D1) — ก่อนย้ายข้อมูล ให้เปิด budget.html บน github.io ที่เชื่อม Firebase ไว้ 1 ครั้ง ข้อมูลใน localStorage จะได้เป็นชุดล่าสุด
- `tanot-data.js`: เก็บใน IndexedDB + คิวรอส่ง → `GET /api/sync?since=rev` / `POST /api/sync` (≤40 รายการต่อครั้ง เพราะ D1 จำกัด 50 query ต่อ request), รายการที่แก้ทีหลังชนะ (last-write-wins); ข้อมูลที่เพิ่มจากหลายเครื่องพร้อมกัน (รายการบัญชี, บันทึกเทรด, การ์ดทบทวน) เก็บเป็นรายการย่อยแยกกันจะได้ไม่ทับกัน
- `data-registry.js`: รายชื่อ prefix ที่ต้องซิงก์ (`tanot:*`, `lang-practice:*`, `lbe:*`, `tanot-budget*`, `tanot:barprep` + IndexedDB 3 ตัว) กับรายชื่อที่ไม่ซิงก์ (แคช, ค่าเฉพาะเครื่อง); ดักจับ `localStorage.setItem` → หน้าเดิมไม่ต้องแก้ แล้วยิง event `tanot:data` หลังดึงข้อมูลใหม่
- **ย้ายข้อมูลข้ามโดเมน**: `migrate.html` บน pages.dev เปิด popup `github.io/.../migrate-export.html` (ต้องเป็น popup ไม่ใช่ iframe ถึงจะอ่าน storage ของ github.io ได้) → ส่งกลับผ่าน `postMessage` แบบระบุ origin; ทำครั้งเดียวต่อเครื่อง; ข้อมูล budget ดึงจาก Firebase ครั้งเดียว แล้วลบ `firebase-sync.js`, `ai-summary-cache.js`, `vendor/firebase` (แคชสรุป AI ปัจจุบันเขียนได้สาธารณะ เสี่ยงโดนสแปม)
- ✅ ถอด Firebase ออกแล้ว (2026-10-02): ลบ `firebase-sync.js`, `ai-summary-cache.js`, `vendor/firebase`, การ์ดซิงก์ใน `budget.html` และรายการใน `credits.html` (ข้อมูล budget อยู่ใน D1)
- สำรองข้อมูล: DriveSync 12 ชุด → `drive-backup.js` ตัวเดียว (ส่งออก snapshot ทั้งหมด) + cron สำรอง D1 → R2 ทุกวัน

## Phase 2 — ย้ายทุกหน้าเข้าธีมกลาง (L, ทยอยเป็นรอบ)
**สิ่งที่ทำกับทุกหน้า:** เทียบกับภาพ baseline → ลบ `.btn/.card/.field` ของหน้าเอง → เปลี่ยน radius/สีเป็น token → เปลี่ยน emoji ใน UI เป็นไอคอน → ลบ `:root` ที่ไม่ได้ใช้ → ลบข้อความอธิบายที่เจอ (กฎใน CLAUDE.md) → bump `sw.js` · จบแต่ละรอบให้ลบกฎ compat ที่ไม่ใช้แล้ว
1. หน้ารวม: `soon`, `credits`, `run`, `404`, `area` ✅ ย้ายแล้ว (2026-09-30, รอบ 1 — `soon` เป็นต้นแบบ: `data-layout="tool"` + `.page`/`.empty`; `credits` ใช้ `.card`/`.badge`; `run` ใช้ `.card`/`.btn`/`.table`/`.list-row` + ตัดข้อความอธิบายทั้งหมด (desc/inputHint/notes/sub-note); `404` โหลดธีมด้วย `document.write` เพราะถูกเสิร์ฟจากพาธไหนก็ได้; ลบกฎ compat `.tcard`/`.cmp-table`/`.btn.drive` ที่ไม่มีหน้าไหนใช้แล้ว; เพิ่ม baseline `credits`/`area`) · `index` ✅ ย้ายแล้วใน Phase 3 (2026-09-30)
2. ตระกูล invest ✅ ย้ายแล้ว 16 หน้า (2026-09-30, รอบ 2 — ย้ายธีมอย่างเดียว ยังไม่ยุบรวมหน้า ดู Phase 6; คีย์ localStorage/ข้อมูลไม่เปลี่ยน): `invest-thai-stock` เป็นต้นแบบ (`data-layout="tool"` + `.page`/`.stack`/`.card`/`.subnav`/`.tabs`/`.segmented`/`.chip`/`.callout`/`.table`/`.kpi`) · `invest.html` เป็น `data-layout="dashboard"` · เพิ่มคอมโพเนนต์กลางใน `theme.css`: `callout`, `kv`, `status`, `step`, `disclosure`, `crumb`, `subnav`, `chk-list`/`yn-row`, `table.right`, `mini`/`log-*`, `chart-wrap`/`chart-cap`, `cmp`, `tranche`, `light`, `badge.wrap`, `kpi .sub`/`.grow` (จังหวะแนวตั้งในการ์ด `.card > * + *` จำกัดเฉพาะ `body[data-invest-key]` กันหน้ารอบก่อนเปลี่ยน) · สีกราฟทุกหน้าใช้ `chart-theme.js` (Lightweight Charts อ่านผ่าน `lightweight()`/`candles()`, SVG DCA/สปาร์กไลน์/โดนัทอ่าน `get()` แล้ววาดใหม่เมื่อ `onChange`) · ลบพื้นหลังลาย SVG ของโซนลงทุน (`shell.js` `injectInvestBgMotif` + กฎ `.bgmotif`/`body.ome-tool-page[data-invest-key]` ใน `theme.css`) · ตัดข้อความอธิบายตามกฎ CLAUDE.md (การ์ด "อ่านก่อนเอาเงินมาลงทุน", hint ใต้ช่องวางราคา/ตัวเลือกแปลงบาท/เช็กลิสต์, คำศัพท์ที่ควรรู้, disclaimer ท้ายผลย่อ/สัดส่วน/หมายเหตุทองรูปพรรณ) · เพิ่ม baseline ภาพครบ 16 หน้า · **ยังเหลือ:** emoji ธงชาติ/สัญลักษณ์ในไอคอนสินทรัพย์ของ `invest-commodities` (ข้อมูลระบุตัวตน ไม่ใช่ UI)
3. `classroom-law`, `music`, `sports`, `cooking`, `coding`, `typing` ✅ ย้ายแล้ว 6 หน้า (2026-10-02, รอบ 3 — ย้ายธีมอย่างเดียว คีย์ localStorage/ข้อมูลความคืบหน้าไม่เปลี่ยน): ทุกหน้าเป็น `data-layout="reader"` (เนื้อหาบทเรียนใช้ `.prose` ฟอนต์ Sarabun ≤72 ตัวอักษร; หน้าที่มีแถบข้าง/แถบเกมขยาย `.page` เองเป็น 880–1160px ใน `<style>` ของหน้า) · `classroom-law` เป็นต้นแบบ: `details.disclosure` แทน accordion เดิม, `callout` แทนกล่องผลสรุป/เส้นทางอาชีพ, กล่องยืนยันเป็น `<dialog class="dialog">`, ตารางใช้ `.table-wrap`/`.table` · `music`/`sports`/`cooking`/`coding` เป็นโค้ดโคลนกัน (คลาสนำหน้า mx-/sp-/ck-/cx-) → CSS แถบเกม/เมนูบทเรียน/แถบข้างรายการ/ปุ่มตอบ/แบนเนอร์ผลใช้โทเคนชุดเดียวกัน ไม่มี gradient/เงาสีฮาร์ดโค้ด; `typing` เขียน CSS เอง (โซนสีนิ้ว 8 โซนผสมจาก `--ome-chart-1..8`) · เพิ่มคอมโพเนนต์กลาง `.lang-toggle` + `.crumb .sep` ใน `theme.css` · ไอคอนสถานะบทเรียน (เสร็จ/ล็อก/อ่าน/ดนตรี), ปุ่มเสียงอ่าน, ปุ่มลบ/แก้ไข, ดาวเลเวลอัป เปลี่ยนจาก emoji เป็น sprite Lucide · ตัดข้อความอธิบายตามกฎ CLAUDE.md (head-sub, hint ใต้การ์ด/ปุ่ม, disclaimer ท้ายหน้า, การ์ด "เรียนรู้" ของ `classroom-law`, ย่อหน้าชี้แจงในผลข้อสอบจำลอง, คำบรรยาย `pageDesc` ของ `typing`) · เพิ่ม baseline ภาพ `music`/`sports`/`coding` และอัปเดต `classroom-law`/`cooking`/`typing` · **ยังเหลือ:** emoji ของเหรียญตรา (`badges[].icon`) และ emoji ในไดอะแกรม/ข้อมูลบทเรียน (ข้อมูลระบุตัวตน ไม่ใช่ UI), สีฮาร์ดโค้ดในภาพประกอบ SVG ของบทเรียน (สนามกีฬา/เครื่องดนตรี/มีด ฯลฯ), ฟอนต์ Sarabun โหลดจาก Google Fonts (ออฟไลน์จะ fallback เป็น Prompt)
4. `budget`, `text-to-speech`, `doc-check`/`doc-check-file`, `extract-text` ✅ ย้ายแล้ว 5 หน้า (2026-10-02, รอบ 4 — ย้ายธีมอย่างเดียว คีย์ localStorage/IndexedDB และโครงข้อมูล (`budget:*`) ไม่เปลี่ยน, ไม่แตะตัวเรียก `/api/ocr`, `/api/asr`, `ai-client`, `tanot-data.js`): `budget` เป็นต้นแบบ `data-layout="dashboard"` — ลิ้นชักเมนู Money Planner ของหน้าเองเปลี่ยนเป็น `.tabs` 6 แท็บ (ยังใช้ hash `#dashboard|calendar|record|categories|budget|settings` เดิม), การ์ดสรุปไล่สีเป็น `.kpi-grid`/`.kpi`, การ์ดกราฟบน `.grid` + `.span-6`, ตาราง `.table-wrap`/`.table`, ฟอร์ม `.field`/`.frow`, `confirm()`/`alert()` เป็น `<dialog class="dialog">` + `.toast` · กราฟโดนัทและแท่งรายเดือนใช้สีจาก `chart-theme.js` (`get()` + วาดใหม่เมื่อ `onChange`) — โดนัทระบายตามลำดับยอดสูงสุดด้วย `--ome-chart-1..7` และรวมหมวดที่เกิน 8 เป็น "อื่นๆ"; จุดสีหมวดหมู่ในรายการ/ตารางยังเป็นสีที่ผู้ใช้เลือกเอง (ข้อมูล) · `text-to-speech`/`doc-check`/`doc-check-file`/`extract-text` เป็น `data-layout="tool"`: ตัวสลับโหมดถอดเสียง/OCR ใช้ `.lang-toggle` กลาง (JS เดิมสลับ `.active` ไม่ต้องแก้), แท็บพิมพ์/แนบไฟล์ของ `doc-check` เป็น `.tabs`, แถบเครื่องมือ `.toolbar`, ป้ายชนิดจุดที่พบ `.badge`, ตัวเลือกคำแนะนำ `.chip`, ไฟล์ที่แนบ `.badge.accent` · เพิ่มคอมโพเนนต์กลาง `.dropzone` ใน `theme.css` (ใช้ใน `extract-text`, `doc-check-file`) · ไอคอน ▶️⏸⏹⬇️📝 และ ⏳/☁️ ในข้อความสถานะ เปลี่ยนเป็นไอคอน Lucide หรือตัดออก · ตัดข้อความอธิบายตามกฎ CLAUDE.md (การ์ด "เรียนรู้ / ความต่างของโหมดต่างๆ" 6 หัวข้อของ `text-to-speech`, คำบรรยายใต้หัวของ `doc-check`, hint ในโซนวางไฟล์, รายการนามสกุลไฟล์ของ `extract-text`, แถบ "บันทึกอัตโนมัติ" และคำอธิบายสีปฏิทินของ `budget`) · ลบกฎ compat ที่ไม่มีหน้าไหนใช้แล้วใน `theme.css`: `body.ome-tool-page` ของ `.hero`/`.drop`/`.note`/`.info` และกฎ `.hero` ตามสีเน้น · เพิ่ม baseline ภาพ `doc-check-file`/`extract-text`/`text-to-speech` และอัปเดต `budget`/`doc-check` · `tests/today.spec.js` ที่ใช้ `budget.html` เป็นตัวแทน "หน้าเดิมที่ยังไม่ย้าย" เปลี่ยนไปใช้ `word.html` · **ยังเหลือ:** สีเริ่มต้นของหมวดหมู่ใน `DEFAULT_CATEGORIES` ของ `budget` (ข้อมูลระบุตัวตนที่บันทึกลงเครื่อง) — หมวดสีเข้มมาก เช่น ค่าบุหรี่ `#14251C` มองยากในโหมดมืด (วงขอบบางช่วยไว้)
5. `word`, `excel` (เฉพาะกรอบหน้า), `cad`, `sim-objects` ✅ ย้ายแล้ว 4 หน้า (2026-10-02, รอบ 5A — **เฉพาะกรอบหน้า**: ไม่แตะพื้นที่แก้ไขเอกสาร/กริด/ภาพวาด/ฉาก 3D, สีที่เป็นข้อมูลผู้ใช้ (สีเส้น CAD, สีเซลล์, สีวัตถุ, สีฟอนต์/ไฮไลต์), คีย์ localStorage/IndexedDB, รูปแบบไฟล์ที่บันทึก/ส่งออก และตรรกะ CAD) · ทุกหน้าเป็น `data-layout="app"` (หน้าสูงเท่าจอ `.page` เป็น flex คอลัมน์ ไม่มีสกรอลล์ของ body): `word` เป็นต้นแบบ — หัวหน้า `.page-head` + `.lang-toggle`, แถบไฟล์ `.toolbar` + `.btn.sm`, ริบบิ้น 6 แท็บเป็น `.tabs`/`.tab` (JS สลับ `.on` + `aria-selected`) ใต้ลงมาเป็น `.toolbar` ที่มีปุ่ม `.btn.ghost.sm` ไอคอน Lucide (B/I/U/S, จัดชิด, รายการ ฯลฯ แทนตัวอักษร/SVG ฝังเดิม), ตัวเลือก `.select`, กระดาษ A4 + หัว-ท้ายกระดาษ + หน้าต่างนำทางยังเป็นของเดิม (แค่สลับ `var(--card|ink|muted|sky…)` ที่เคยประกาศใน `:root` ของหน้าเป็นโทเคนกลาง — `:root` ของหน้าลบแล้ว) · จอ ≥1301px: กระดาษ / แผง "จุดที่พบ" / หน้าต่างนำทางเลื่อนแยกกัน ริบบิ้นตรึงบน แถบสถานะ (นับคำ/บันทึกอัตโนมัติ) ตรึงล่าง · จอ ≤1300px: ทั้งหน้าเลื่อนรวม (แผงข้างไหลลงใต้กระดาษ นำทางเป็นลิ้นชัก) · 6 กล่อง modal ทำมือ (`.wd-modal*`) → `<dialog class="dialog">` (`showModal()`; Esc/คลิกนอกกล่องปิดเอง, ล้างไฮไลต์ค้นหาตอน `close`) + `confirm()` ของ "หน้าใหม่" → dialog ยืนยัน — **สิ่งที่เปลี่ยนตาม**: `restoreSelectionRange()` ปิด dialog ก่อนแทรกเนื้อหา (dialog แบบ modal ทำให้ editor โฟกัสไม่ได้) ทำให้กล่อง "สัญลักษณ์" ปิดหลังเลือกตัวเดียว; ตอนสร้าง PDF ใส่ `body.wd-cap` (ปลดสกรอลล์/ความสูงคงที่ให้ html2canvas เห็นกระดาษครบ) และให้กระดาษใช้สีสว่างเสมอ (เดิมโหมดมืดได้ PDF พื้นดำ) · `excel`: ริบบอน Luckysheet (ย้ายปุ่มจริงมาเรียงใน `.toolbar` เดิม) ใช้ `.tabs`, กริดยืดเต็มพื้นที่ที่เหลือ (`applyGridHeight` วัดจาก `.xl-sheetwrap` แทนสูตร 70% ของจอ), ป็อปอัพวิเคราะห์ข้อมูล (`.di-popover`) ใช้โทเคน, `confirm()` ไฟล์ใหม่ → dialog; **ข้อควรระวัง**: `luckysheet.css` มี `.btn{…}` แบบ bootstrap ที่ไม่อยู่ใน layer ทับปุ่มกลาง และตั้งสีไอคอนริบบอนเป็น `#333` ตายตัว — หน้านี้จึงมีกฎแก้ทั้งสองใน `<style>` ของหน้า · `cad`: เมนู ไฟล์/แก้ไข/มุมมอง + แท็บ 2D/3D (`.tabs`), แถบเครื่องมือซ้าย/แผงขวา (คุณสมบัติ/เลเยอร์/ข้อจำกัด/พิมพ์) เลื่อนแยก วิวพอร์ตวาดยืดตามพื้นที่ (สคริปต์ท้ายหน้ายิง `resize` ผ่าน `ResizeObserver` ให้ `cad.js`/`cad3d.js` วัดใหม่ — ไม่แก้ตรรกะ CAD), ไอคอนอักขระ Unicode/emoji (／▭○⌇◜∿⧉⤢▦⤴◠∥⌀∠▤ + 🗑 + เมนู ✕↥↧⎙↩↪⛶⌖⊥ + ◯ ในแท็บ 3D) เปลี่ยนเป็น Lucide หรือ SVG ฝังสไตล์เดียวกับไอคอนเครื่องมือเดิม; ตัวเลือก/ช่องกรอกในแถบ/แผงใช้หน้าตาเดียวกับ `.input`/`.select` กลางผ่านกฎของหน้า (label ครอบ input เพราะ i18n เขียนทับแค่ text node แรก) · `sim-objects`: วิวพอร์ต 3D ยืดเต็มพื้นที่ซ้าย คลังของ/วัตถุที่เลือกเลื่อนแยกทางขวา, กล่องยืนยัน/แจ้งเตือนทำมือ (`.s3-modal*`) → `<dialog class="dialog">`, ไอคอนคลังของสำเร็จรูป 15 ชิ้นเป็น Lucide (เดิมว่าง), ปุ่มขยับ/หมุน/ลบ/อัปโหลด/⏳ เปลี่ยนเป็นไอคอนหรือสปินเนอร์ · เพิ่มคอมโพเนนต์กลางใน `theme.css`: สถานะกดของปุ่ม `.btn.on`/`.active`/`[aria-pressed=true]`, `.spinner`, วงโฟกัสของ `.btn`/`.tab`/`.chip` · ตัดข้อความอธิบายตามกฎ CLAUDE.md (crumb + คำบรรยายหัวเรื่อง `pageTitle` ของ word/excel, `pageDesc`/`toolHint`, หมายเหตุเลขหน้า/คำใบ้ "กดตรวจคำผิด…" ของ word, คำอธิบายในหัวป็อปอัปวิเคราะห์ข้อมูลของ excel, การ์ด "เรียนรู้ / วิธีใช้" + disclaimer + head-sub + แถบ "บันทึกอัตโนมัติ" ที่แสดงตลอดของ sim-objects, ลิงก์ท้ายหน้าของ cad) · เทสต์: `tests/today.spec.js` ที่ใช้ `word.html` เป็นตัวแทน "หน้าเดิมที่ยังไม่ย้าย" เปลี่ยนไปใช้ `report-dashboard.html` · เพิ่ม baseline ภาพ `cad`/`sim-objects` และอัปเดต `word`/`excel` (excel ในเทสต์ออฟไลน์เห็นแค่สถานะโหลด เพราะ Luckysheet มาจาก CDN) · **ยังเหลือ:** กล่องยืนยัน/แจ้งเตือนกลางของ CAD (`window.tanotConfirm/tanotAlert` ใน `shell.js` + `.tanot-modal` ใน `theme.css` — ใช้ร่วมทุกหน้า รอเปลี่ยนเป็น `<dialog>` พร้อมกันทั้งเว็บ), ไอคอนเลเยอร์ใน `cad.js` ที่สร้างเป็น SVG ฝัง, สีฮาร์ดโค้ดของฉาก 3D/ผืนวาด (ข้อมูลระบุตัวตน), กฎ compat `body.ome-tool-page` ใน `theme.css` ที่ `report-dashboard` ยังใช้อยู่ (ลบพร้อมรอบ 5B)
   `report-dashboard` ✅ ย้ายแล้ว (2026-10-02, รอบ 5B — ย้ายธีมอย่างเดียว ไม่แตะ IndexedDB `tanot-report-dashboard`, คีย์ localStorage ของหน้า, ตรรกะอ่านไฟล์/จับคอลัมน์ (`roleCol`/`scoreHeaderRow`/Smart Import), `report-dashboard.mntsrc.js` และเส้นทาง `?src=maintenance`; ยังไม่เปลี่ยนชื่อไฟล์ final43/62): ทำทีละโมดูล 1 commit — กรอบหน้า/แถบเครื่องมือ/นำเข้าไฟล์ → ตารางข้อมูล → แดชบอร์ดหลัก (Chart.js ใช้สีจาก `chart-theme.js`) → มุมมองกำหนดเอง + `bi-plus` (ECharts) → โมดูลโดเมน 10 ตัว (Safety, HR, IT/DevOps, งานซ่อมบำรุง, สำนักงานกฎหมาย, Risk, Finance, Reading, KPI, Organizational) → Project Control. สิ่งที่ต้องรู้ก่อนแก้: (1) กราฟ SVG ที่โมดูลสร้างเองเรียกสีผ่าน `TanotReportUtils.palette()` แบบ lazy ตอน render (สคริปต์โมดูลโหลดก่อน `chart-theme.js`/utils จึงห้ามเรียกตอนโหลดไฟล์) แล้วลงทะเบียน `TanotReportUtils.onTheme(schedule)` ใน `init` เพื่อวาดใหม่ตอนสลับสว่าง/มืด — ห้ามใช้ `var()` ใน fill ของ SVG ที่ถูกส่งออกเป็นรูป · (2) สีสถานะ (เสร็จ/ล่าช้า/เสี่ยง) ใช้ `--ome-ok/warn/err`, สีอนุกรมใช้ `series[0..7]` · (3) สี design ของ Project Control เก็บเฉพาะที่ผู้ใช้เลือกเอง (ค่าว่าง = ใช้สีตามธีม; ค่าเดิมที่เท่ากับดีฟอลต์เก่าถูกมองว่าไม่ได้ตั้ง) · (4) modal/popover/toast/confirm ของหน้าใช้ `<dialog class="dialog">` และ toast กลางผ่าน `TanotReportUtils` · (5) `shell.js` `tanotConfirm`/`tanotAlert` เป็น `<dialog class="dialog">` (API เดิม, หน้าที่ยังไม่ย้ายธีมใช้ confirm/alert ของเบราว์เซอร์แทน) · (6) ลบกฎ compat `body.ome-tool-page` ออกจาก `theme.css` แล้ว (ไม่มีหน้าไหนใช้) · (7) กราฟยอดสะสมของโมดูลการเงินที่เป็นค่าติดลบแสดงไม่ออกมาก่อน — แก้แล้ว. `tests/today.spec.js` ใช้ `languages.html` เป็นตัวแทน "หน้าที่ยังไม่ย้ายธีม" แทน report-dashboard; baseline ภาพ `report-dashboard` อยู่ใน `tests/__screenshots__`.
6. หน้า React 4 หน้า (`languages`, `legal`, `classroom-business`, `classroom-engineering`) ✅ ย้ายแล้ว (2026-10-03, รอบ 6 — **Phase 2 เสร็จครบทุกหน้า**; คีย์ `lang-practice:*`, `lbe:*`, `legal:*`, `tanot:learn:faces:*`, `course-data` (ลำดับข้อสอบ) และพฤติกรรม `LearnCore.award`/การเขียน SRS ไม่เปลี่ยน): เลิกพึ่ง CDN ตอนรันทั้งหมด — React/ReactDOM 18.3.1 production UMD อยู่ `vendor/react/`, lucide 1.49.0 อยู่ `vendor/lucide/`, ไม่ใช้ Babel ในเบราว์เซอร์ (JSX ของ legal/business/engineering แยกเป็น `<page>.jsx` → `<page>.compiled.js` เหมือน `languages`), Tailwind คอมไพล์ล่วงหน้าเป็น `react-pages.css` ไฟล์เดียวใช้ร่วม 4 หน้า (config + input อยู่ `tests/react-build/`, สีทุกค่าอ้าง `--ome-*` จึงสลับสว่าง/มืด/สีเน้น/ฟอนต์ได้เอง) ด้วย `./build-react.sh` (เครื่องมือ pin ใน `tests/package.json`) · ลบกฎ `.ome-app-page … !important` ~160 บรรทัดใน `theme.css` (บล็อกสีหน้า React + `data-style` ของหน้ากลุ่มนี้) · body เป็น `data-layout="reader"` (2 ห้องเรียน) / `"tool"` (languages, legal) · ตัดข้อความอธิบายที่เหลือ (ประกาศ/เคล็ดลับ/หมายเหตุข้อสอบ/คำใบ้พิมพ์-ลากเขียน/แถบชี้แจง Markdown/disclaimer ท้ายเช็กลิสต์ ฯลฯ) · เพิ่ม guard ใน `repo-guards.mjs` (compiled ตรงกับ jsx ทั้ง 4 หน้า, `react-pages.css` ตรงกับ Tailwind, ไม่อ้าง Tailwind CDN/unpkg/Babel) + baseline visual ของทั้ง 4 หน้า · `credits.html` เติม React/Tailwind/esbuild และปิดช่องโหว่ baseline เดิม · **ยังโหลดจากเน็ตอยู่ (ตั้งใจ เป็นฟีเจอร์เสริมที่ไม่ขัดการเปิดหน้า):** `tesseract.js` + `hanzi-writer` (jsDelivr, เฉพาะโหมดฝึกเขียนของ languages), Google Identity (ซิงก์ Drive), ฟอนต์ Google

## Phase 3 — หน้าแรก "วันนี้" + ค้นหาด่วน (M)
**สถานะ (2026-09-30, PR รอตรวจ):** ✅ `index.html` + `index.js` (`data-layout="dashboard"`) · ✅ `palette.js` + `quick-add.js` · ✅ API อ่านใน `tanot-data.js` (`TanotData.read/raw/readIdb/onChange`) · ✅ `tests/today.spec.js` · ✅ Web Push (VAPID) + การแจ้งเตือน (2026-10-02, PR รอตรวจ — ดูหัวข้อ Web Push ด้านล่าง) · **ยังไม่ทำ:** นัดหมายบนหน้าวันนี้ (ยังไม่มีข้อมูลต้นทาง) · ✅ การ์ดสุขภาพ (2026-10-03)
- `index.html` เป็นแดชบอร์ดส่วนตัว: ใช้จ่ายเดือนนี้เทียบงบ (เทียบช่วงเดียวกันเดือนก่อน), การ์ดที่ต้องทบทวน (ภาษา/กฎหมาย/ธุรกิจ/วิศวกรรม) + วันติดต่อกัน, หุ้นที่ติดตาม (พอร์ตหุ้นไทย/ต่างประเทศ + ราคาล่าสุดจากแคชของหน้าหุ้น — ไม่ยิงเครือข่ายเอง), ไฟล์ล่าสุด (ฉบับร่าง Word/Excel/CAD + รายงาน 5 ฉบับท้าย — Excel/CAD/3D ไม่มีเวลาบันทึกให้เรียงหรือจัดรายการได้ถูก จึงยังไม่ครบ ถ้าจะให้ครบต้องมีรายการ `tanot:recent` ที่ทุกเครื่องมือเขียนตอนบันทึก), ปุ่มเพิ่มด่วน (รายจ่าย/รายรับ/Word/Excel/ค้นหา/เมนู) · ตัดนาฬิกา Nixie และไทล์ทางลัดเดิมออก (เมนูอยู่ที่ลิ้นชัก/palette/`area.html`)
- `palette.js` (⌘/Ctrl+K หรือปุ่มค้นหาบน nav — `shell.js` โหลดไฟล์นี้ตอนใช้ครั้งแรก): ค้นหาเมนูจาก `OME_MENU` (คำค้นไทย/อังกฤษ ใช้ label + keywords + ชื่อกลุ่ม) + คำสั่ง (เพิ่มรายจ่าย/รายรับผ่าน `quick-add.js`, สลับโหมดสว่าง/มืด) + จำหน้าที่เปิดล่าสุด · ต่างจากแผน: ยังไม่ค้น "ข้อมูลในเครื่อง" และยังไม่มีคำสั่ง "ตั้งการแจ้งเตือน" (รอ Web Push)
- ✅ **Web Push (VAPID)** (2026-10-02, PR รอตรวจ) — หน้า `notifications.html` (เมนู ตั้งค่า/ข้อมูล → การแจ้งเตือน): เปิด/ปิด/ส่งทดสอบของเครื่องนี้ + รายการกำหนดการทั้งหมด · `tanot-push.js` (`window.TanotPush`): สมัคร/ยกเลิก (`/api/push/subscribe|unsubscribe`, ตาราง `push_subs`) + `setReminders(scope, items)` ให้หน้าต่างๆ ลงทะเบียน "ชุดทั้งหมด" ของตัวเองทุกครั้งที่ข้อมูลเปลี่ยน (`/api/push/reminders` แทนที่ทั้ง scope, เขียนเฉพาะแถวที่เปลี่ยน, ส่งแล้วไม่ส่งซ้ำถ้าวันเดิม) · ตัวสร้างรายการอยู่ในไฟล์ calc ของแต่ละหน้า: `InsuranceCalc.reminders` (ก่อนต่ออายุ 30/7 วัน + วันครบกำหนด 08:00), `TaxCalc.reminders` (กำหนดยื่นออนไลน์จาก `tax-rules/*.json` ก่อน 30/7/1 วัน + วันสุดท้าย 08:00), `MntCalc.digest` (สรุปงาน PM ถึงกำหนด/เลยกำหนด 1 รายการต่อวัน 14 วันข้างหน้า → บรรทัดในสรุป 07:00) · `sw.js` รับ push → แสดงการแจ้งเตือน → กดแล้วโฟกัส/เปิดหน้าที่เกี่ยวข้อง (เฉพาะหน้าในเว็บนี้) + `pushsubscriptionchange` · iPhone/iPad: ซ่อนปุ่มสมัครจนกว่าจะเปิดจากแอปบนหน้าจอโฮม (iOS 16.4+) · `tests/push.spec.js` (23 เคส: ถอดรหัส aes128gcm + ตรวจลายเซ็น VAPID จริง, scheduler ตามเวลาไทย, หน้า ประกัน/ภาษี/บำรุงรักษา, sw ใน Chromium จริงผ่าน CDP) · ต่างจากแผน: ลงทะเบียนเกิดเมื่อเปิดหน้านั้นๆ (หน้าวันนี้ยังเป็นแบบอ่านอย่างเดียว ไม่ยิงเครือข่าย) — ถ้าไม่ได้เปิดหน้าบำรุงรักษาเกิน 14 วัน สรุปรายวันจะหยุดจนกว่าจะเปิดอีกครั้ง · ยังไม่มีคำสั่ง "ตั้งการแจ้งเตือน" ใน palette

## Phase 4 — AI บนคลาวด์ (M) — แก้ปัญหา iPhone ใช้ AI ไม่ได้
**สถานะ (2026-09-30, PR รอตรวจ):** ✅ `ai-client.js` + `functions/api/ai/{chat,summarize,embed,usage}.js` + `functions/_lib/ai.js` · ✅ นับโควตาใน `ai_usage` (Whisper `asr.js` เขียนลงตารางเดียวกัน, เพดาน `AI_DAILY_NEURONS` ใน `wrangler.toml`) · ✅ แคชสรุปใน `ai_cache` แทน Firebase บน pages.dev (`ai-summary-cache.js` เหลือใช้เฉพาะ GitHub Pages) · ✅ ต่อคลาวด์ก่อนแล้ว: วิดเจ็ตแชท (พิมพ์/สรุปหน้า/ไมค์ผ่าน Whisper บนคลาวด์ — iPhone ใช้ได้, เสียงตอบบน iPhone ใช้เสียงของระบบ), สรุปหุ้นไทย/หุ้นต่างประเทศ/ทอง/บิตคอยน์/โภคภัณฑ์, สรุปประชุมในหน้าแปลงเสียง; ทุกจุดถอยไปโมเดลในเบราว์เซอร์เมื่อออฟไลน์/โควตาเต็ม/ล็อกอินหมดอายุ (ยกเว้น iPhone) · ✅ `tests/ai.spec.js` (12+1 เคส, ต่อเข้า CI) · ต่างจากแผน: `ai-client.js` มี `asr`/`ocr` เป็นตัวห่อบางๆ แต่หน้า OCR (`doc-check.js`) และถอดเสียงไฟล์ (`text-to-speech.js`) ยังเรียก `/api/ocr`, `/api/asr` ตรงเหมือนเดิม · แคชคีย์จากเนื้อหาที่ป้อน (ไม่ใช่ "หุ้น+วัน" แบบ Firebase เดิม) · **ยังไม่ทำ/ยังไม่ยืนยัน:** อัตรา Neurons ต่อโทเค็นใน `MODELS` (ตัวเลขจากผลค้นหา ขัดกันเองที่ output ของ qwen3 — เลือกค่าสูงไว้ก่อน) และรูปแบบสตรีมจริงของ SEA-LION/Qwen3 (ตัวแยกวิเคราะห์รองรับทั้ง `response` และ `choices[].delta.content` แต่ยังไม่เคยยิงโมเดลจริง) — ตรวจหลัง deploy ที่ `/api/ai/usage` · `embed` ยังไม่มีหน้าไหนเรียกใช้ (ไว้ใช้ค้นตามความหมายใน Phase ถัดไป) · หน้า `languages`/`classroom-*` ยังเรียก `ai-chat-worker.js` ในเครื่องตรงๆ
- `ai-client.js` เรียกคลาวด์ก่อน: `/api/ai/chat` (ตอบแบบ stream), `summarize`, `embed`, `asr`, `ocr`
- โมเดลภาษาไทยบน Workers AI: `@cf/aisingapore/gemma-sea-lion-v4-27b-it` (ฝึกภาษาไทยมาโดยตรง คุณภาพดีที่สุด) / `@cf/qwen/qwen3-30b-a3b-fp8` (ถูกและเร็ว) / `@cf/baai/bge-m3` (ค้นหาภาษาไทยตามความหมาย)
- นับโควตาฝั่งเซิร์ฟเวอร์ใน `ai_usage` — โควตาฟรีวันละ 10,000 Neurons **ใช้ร่วมกับ Whisper**; แคชสรุปย้ายมาเก็บใน `ai_cache`
- โมเดลในเบราว์เซอร์คงไว้เป็นตัวสำรองตอนออฟไลน์บนคอม

## Phase 5 — ระบบการเรียนรวมศูนย์ (M) ✅
**สถานะ (2026-10-02, PR รอตรวจ):** ✅ เสร็จ
- `learn-core.js`: XP ชุดเดียว `tanot:learn:xp` (sync list — 1 แถวต่อ วัน × เครื่อง × ที่มา: `{d, dev, area, src, xp, n, ts}` สองเครื่องไม่เคยเขียนแถวเดียวกัน), วันติดต่อกันแบบมีวันพัก (ขาดได้ 0/1/2 วันในทุกช่วง 7 วัน ค่าเริ่มต้น 1), เป้ารายวัน (`tanot:learn:settings`, เริ่ม 50 XP) · หน้าเรียนเรียก `LearnCore.award(src, xp)` ก่อนบันทึกคีย์ของตัวเอง: กฎหมาย (ทบทวนการ์ด 5), ภาษา/ธุรกิจ/วิศวะ (ส่วนที่ XP ของหน้าเพิ่ม ไม่นับตอนรวมค่าจาก Drive), ดนตรี/กีฬา/ทำอาหาร/โค้ด (ผ่านแบบฝึก 20 + จบชุด 50), พิมพ์ดีด (จบบทที่แม่น ≥75% = 5, จับเวลา = 10)
- `fsrs.js`: แยกตัวจัดตารางทบทวนจาก `classroom-law.js` (UMD ไม่มี DOM) — กฎหมาย/ภาษา/หน้าทบทวนใช้ไฟล์เดียวกัน ผลตรงกับโค้ดก่อนแยกทุกบิต (`tests/fixtures/fsrs-original.js`)
- `review.html` "ทบทวนวันนี้" (`data-layout="reader"`, เมนูการศึกษา): การ์ดที่ถึงกำหนดของกฎหมาย (IndexedDB) / ภาษา / ธุรกิจ / วิศวะ รวมเป็นกองเดียว ให้คะแนนแล้วเขียนผลกลับที่เดิมในรูปแบบเดิมของหน้านั้น · หน้าวันนี้: การ์ด "ทบทวนวันนี้" ลิงก์มาหน้านี้ + การ์ด "ติดต่อกัน" ใช้ learn-core พร้อมแถบเป้ารายวัน
- XP เดิมของแต่ละหน้ารวมเป็นยอด legacy ครั้งเดียว (`tanot:learn:legacy` เครื่องละแถว ใช้ค่าต่ำสุดข้ามเครื่อง — รันซ้ำ/ย้ายทีหลังไม่นับซ้ำ; ธุรกิจ/วิศวะหักค่าเริ่มต้น 1250 ที่หน้าแจกให้ทุกคน) · วันติดต่อกันใช้ของหน้าที่ให้ค่าสูงสุด · คีย์ความคืบหน้าเดิมทุกหน้าไม่ถูกลบ/เปลี่ยนชื่อ (ถอดระบบใหม่ออกได้)
- `tests/learn.spec.js` (อยู่ใน CI)
- ✅ การ์ดจากวิศวะ (2026-10-02) — ห้องเรียนวิศวะมีข้อสอบใน `course-data` แล้ว `review.js` อ่านได้โดยไม่ต้องแก้ (ดูแถว "เนื้อหาห้องเรียนวิศวกรรม")
- ✅ หนังสือ (2026-10-03) — เพิ่มเป็นแหล่งใหม่ `books` ใน `learn-core.js`/`review.js` แล้ว (ดูแถว "หนังสือ")
- **ยังไม่ทำ:** ซ่อนตัวนับ XP/streak เดิมในแต่ละหน้า (ตอนนี้ยังแสดงของเดิมคู่กัน)

## Phase 6+ — ฟีเจอร์ใหม่และหน้าที่ยังไม่ทำ (สลับด้าน; P1 = ทำก่อน … P4 = ความสำคัญต่ำ)

**การทำงาน**
| รายการ | ขอบเขต | ลำดับ | ขนาด |
|---|---|---|---|
| บันทึกงานบำรุงรักษา (ใหม่, ใช้แทนช่อง "รวบรวมข้อมูล") ✅ (2026-10-02, PR รอตรวจ) | ทะเบียนอุปกรณ์ + QR, แผน PM นำเข้าจาก sheet `PM_PLAN` ของ est-cost, ใบสั่งงาน/บันทึกความผิดปกติ, ฟอร์มตรวจเช็กออฟไลน์ + รูปเก็บ R2, ส่งออก Excel, ป้อนข้อมูลเข้าโมดูล maintenance ของ report-dashboard · ✅ สรุปงาน PM ถึงกำหนด/เลยกำหนดรายวัน 07:00 ผ่าน Web Push (2026-10-02 — `MntCalc.digest`, กดแล้วเปิด `maintenance.html#tab=calendar`) — `maintenance.html` + `maintenance.js` (หน้า) + `mnt-calc.js` (ตรรกะล้วน) + `mnt-qr.js` + `tests/maintenance.spec.js` · ออกแบบที่ `docs/maintenance-design.md` · **ต้องตรวจเองหลัง deploy:** หัวข้อ 11 ของเอกสารนั้น (สแกนบน iPhone, พิมพ์ป้าย, นำเข้าไฟล์ est-cost จริง, ผัง Maintenance Control) | P1 | L |
| เครื่องคำนวณไฟฟ้า (ใหม่) ✅ (2026-10-01, PR รอตรวจ) | แรงดันตก/ขนาดสาย, กระแสลัดวงจร, คาปาซิเตอร์แก้ PF, ค่าความเป็นฉนวน PI/DAR, ระบบกราวด์, protective margin ของกับดักฟ้าผ่า (residual voltage เทียบ BIL) — `electrical.html` + `electrical.js` (หน้า) + `electrical-calc.js` (สูตร/ตาราง/มาตรฐานอ้างอิง ไม่มี DOM) + `tests/electrical.spec.js` · **ต้องตรวจทาน:** ตารางพิกัดกระแสใช้ IEC 60364-5-52 วิธี B1 (BS 7671 4D1A) × 0.87 ที่ 40°C — ตรงกับตาราง 5-20 ของ วสท. ที่ 2.5/4 mm² ส่วนขนาดอื่นยังไม่ได้เทียบกับเล่มจริง; ยังไม่มีตาราง XLPE/อะลูมิเนียม (ตรวจแค่แรงดันตก) | P1 | M |
| เสียงบรรยาย → โน้ต | ข้อความที่ถอดเสียง → สรุปด้วย AI → โน้ตวิศวกรรม + การ์ดทบทวน | P1 | M |
| เปรียบเทียบข้อมูล ✅ (2026-10-03, PR รอตรวจ) | หน้า `compare.html` (`compare.js` + `compare-calc.js` ไม่มี DOM) 3 แท็บ: ① เทียบตาราง Excel/CSV — เลือกไฟล์ A/B + ชีต + แถวหัวตาราง, จับคู่คอลัมน์ตามชื่อหัวอัตโนมัติ (แก้เองได้), คีย์หลัก ≥ 1 คอลัมน์, ตัวเลือก ไม่สนตัวพิมพ์/ช่องว่างหัวท้าย/ตัวเลขคลาดเคลื่อน ±/ไม่เทียบบางคอลัมน์ → KPI เพิ่ม·หาย·เปลี่ยน·เหมือน, กรองรายกลุ่ม, ไฮไลต์เฉพาะเซลล์ที่ต่าง (เก่า → ใหม่), เตือนคีย์ซ้ำในไฟล์เดียวกัน, ส่งออก .xlsx (ชีตสรุป + ชีตต่อกลุ่ม พร้อมสี) · เทียบด้วย Map ตามคีย์ + แสดงผลทีละ 50 แถว (ทดสอบ 20,000 แถว) ② เทียบเอกสาร — วางข้อความ/เลือก .txt .docx .pdf (`file-reader.js`) → diff Myers ระดับบรรทัดเขียนเอง + ไฮไลต์คำ (ไทยตัดด้วย `Intl.Segmenter('th')`), ซ้าย-ขวา/รวม, ไม่สนช่องว่าง, กระโดดจุดที่ต่างถัดไป/ก่อนหน้า, พับบรรทัดที่เหมือนกัน ③ ให้คะแนนใบเสนอราคา — เกณฑ์+น้ำหนัก % (ค่าเริ่มต้น 50/20/15/15 รวมต้อง 100), คะแนนราคาอัตโนมัติ (ต่ำสุดได้เต็ม), เกณฑ์อื่นกรอก 0–10, จัดอันดับ + ส่งออก .xlsx, ไฟล์แนบ R2 `ns=compare`, หลายงาน ซิงก์ข้ามเครื่อง (`tanot:compare:quotes` sync list) · ไฟล์ที่เทียบในแท็บ 1–2 ไม่อัปโหลด/ไม่เก็บ · ใช้ xlsx-js-style (ฟอร์ก SheetJS) โหลดจาก CDN ตอนใช้ เพื่อเขียนสีเซลล์ · `tests/compare.spec.js` · **ยังไม่ได้ทดสอบ:** อ่าน .pdf จริง (pdf.js โหลดจาก CDN — เทสต์ครอบแค่ .txt/.docx) | P2 | M |
| PowerPoint ✅ (2026-10-03, PR รอตรวจ) | หน้า `slides.html` (`slides.js` + `slides-calc.js` ไม่มี DOM) · พิมพ์โครงเรื่อง (`# ` สไลด์ใหม่, `- ` bullet 2 ระดับ, `> ` โน้ตผู้บรรยาย, `---` คอลัมน์ที่ 2, วางตารางจาก Excel แบบ TSV) → ตัวอย่างสไลด์อัปเดตทันที · 6 แบบ (หน้าปก/หัวข้อ+bullet/2 คอลัมน์/รูป+ข้อความ/ตาราง/หัวข้อตอน) เลือกอัตโนมัติจากเนื้อหา เปลี่ยนต่อสไลด์ได้ (เขียนเป็นบรรทัด `@layout` ในโครงเรื่อง) · 4 ธีม (สว่าง/มืด/สีเน้น/เรียบ) สีเน้นตาม `--ome-accent` ตอนนั้น · AI ช่วยร่างจากข้อความยาว/ไฟล์ .docx .txt ผ่าน `/api/ai/chat` (Workers AI ฟรีเท่านั้น ไม่เรียก `/api/ocr`/Claude; ซ่อนเมื่อไม่ใช่ pages.dev) · รูปต่อสไลด์ย่อ ≤1600px → R2 `ns=slides` (ออฟไลน์เก็บใน outbox ในเครื่องก่อน) · ส่งออก .pptx ด้วย PptxGenJS 3.12.0 (`vendor/pptxgenjs/`, โหลดตอนกดส่งออก; ข้อความแก้ไขได้ + โน้ตผู้บรรยาย + ฟอนต์ Tahoma สำรองจาก Prompt) · PDF = โหมดพิมพ์ 16:9 · โหมดนำเสนอเต็มจอ (ลูกศร/แตะ) · หลายชุดซิงก์ข้ามเครื่อง `tanot:slides:decks` (sync list, ค้นหา/ทำซ้ำ/ลบ; ลบชุด = DELETE รูปที่ไม่มีชุดอื่นใช้) · `tests/slides.spec.js` · **ต้องตรวจเองหลัง deploy:** เปิดไฟล์ .pptx ใน PowerPoint/Keynote จริง (ตำแหน่งข้อความ/ตัวอักษรไทยกับ Tahoma/ตารางยาว) · พิมพ์ PDF จากเบราว์เซอร์ (ปิดหัว-ท้ายกระดาษ) · สีเน้นบนสไลด์ธีม 'สีเน้น' กับสีเน้นอื่นนอกเหนือจาก teal | P2 | M |
| ปรับหน้าเดิม | doc-check: OCR ไฟล์ PDF สแกน (S) · CAD_ROADMAP ข้อ 2.1, 2.2, 2.4 (S), 2.5 fillet/chamfer (L) · report-dashboard: เปลี่ยนชื่อไฟล์ `final43/62`, โหลดโมดูลเมื่อใช้, ใช้ token (M) | P1–P2 | — |

**การใช้ชีวิต**
| รายการ | ขอบเขต | ลำดับ | ขนาด |
|---|---|---|---|
| ภาษี ✅ (2026-10-01, merge แล้ว — PR #14) | `tax.html` + `tax.js` (หน้า) + `tax-calc.js` (ลำดับคำนวณ ไม่มี DOM) + กฎแยกปี `tax-rules/2568.json`, `2569.json` (+ `index.json`) · ดึงเงินได้จาก budget (จับคู่หมวดรายรับ → 40(1)/40(2)/40(8), โหมด "ทั้งปี (ประมาณ)" คูณเงินเดือนเฉลี่ยเป็น 12 เดือน), เบี้ยประกันจาก `InsuranceCalc.taxSummary`/`tanot:insurance:taxsummary`, RMF/SSF/ThaiESG จากสมุดซื้อในหน้ากองทุนไทย · พิมพ์ทับค่าที่ดึงมาได้ทุกช่อง (`tanot:tax:years` sync map) · เพดานกลุ่มเกษียณ 500,000, บำนาญใช้โควตาประกันชีวิตที่เหลือจาก 100,000 ก่อน, ThaiESG/ThaiESGX แยกเพดาน, เงินบริจาคคิดหลังสุด, ภาษีขั้นต่ำ 0.5% · แท็บ "ถ้าซื้อเพิ่ม": สิทธิที่เหลือ + ยอดที่ภาษียังลด + ภาษีที่ประหยัดได้ · KPI กำหนดยื่น (นับถอยหลัง) · `tests/tax.spec.js` · **ต้องตรวจทาน:** ตัวเลขทุกตัวในไฟล์กฎ (รายการ `review` ในแต่ละไฟล์) โดยเฉพาะปี 2569 ที่ยกมาจาก 2568 แล้วตัด Easy e-Receipt/ค่าสร้างบ้าน/ThaiESGX เงินใหม่ออก — มาตรการท้ายปีที่ประกาศภายหลังต้องเพิ่มเอง · ✅ แจ้งเตือนกำหนดยื่นผ่าน Web Push (2026-10-02 — `TaxCalc.reminders` อ่านวันที่จาก `deadlines` ในไฟล์กฎ ปีใหม่ไม่ต้องแก้ JS) · **ยังไม่ทำ:** เงินได้ 40(3)–40(7) แยกประเภท (e-Receipt/บริจาคจากคลังใบเสร็จ ✅ แล้ว) | P1 | M |
| ประกัน ✅ (2026-10-01, merge แล้ว — PR #13) | ทะเบียนกรมธรรม์ ชีวิต/สุขภาพ/รถ/บ้าน (`insurance.html` + `insurance.js` + `insurance-calc.js` ไม่มี DOM) ซิงก์ผ่าน `tanot-data.js` (`tanot:insurance:policies`, list, idField `id`) · ไฟล์กรมธรรม์เก็บ R2 ผ่าน `functions/api/files.js` (PDF/รูป ≤15 MB, ดัชนีใน D1 `files`; แสดงเฉพาะ `*.pages.dev`) · วันต่ออายุแสดงบนหน้าวันนี้ (การ์ด "ต่ออายุประกัน" ภายใน 60 วัน รวมเลยกำหนด) · เบี้ยลดหย่อนภาษีแยกไว้ใน `tanot:insurance:taxsummary` (`{v:1, years:{ปี ค.ศ.:{raw, ded, annuityCap}}}`) ให้หน้าภาษีอ่าน หรือเรียก `InsuranceCalc.taxSummary(policies, year, {income})` เอง · `tests/insurance.spec.js` · **ต้องตรวจทาน:** เพดานลดหย่อนใน `insurance-calc.js` (ชีวิต 100,000 / สุขภาพ 25,000 / รวม 100,000 / บิดามารดา 15,000 / คู่สมรส 10,000 / บำนาญ min(15% เงินได้, 200,000)) เขียนจากความรู้ทั่วไป ยังไม่ได้เทียบประกาศกรมสรรพากรปีล่าสุด · ✅ วันต่ออายุ → ตาราง `reminders` / Web Push (2026-10-02 — `InsuranceCalc.reminders`) · **ยังไม่ทำ:** เบี้ย → รายการใน budget | P1 | M |
| คลังใบเสร็จ/ประกันสินค้า ✅ (2026-10-03, PR รอตรวจ) | หน้า `receipts.html` (`receipts.js` + `receipts-calc.js` ไม่มี DOM): ถ่ายรูป/เลือกไฟล์ (รูป/PDF) → ย่อรูป ≤1600px → R2 `/api/files?ns=receipts` · **อ่านฟรีเสมอ**: Tesseract.js (tha+eng, pin เวอร์ชันเดียวกับ doc-check, โหลดตอนอ่านครั้งแรก) → แยกช่อง (ร้าน/วันที่/ยอดรวม/VAT/เลขผู้เสียภาษี/ใบกำกับเต็มรูป/รายการ) ด้วย `/api/ai/chat` โมเดล fast → AI ใช้ไม่ได้ใช้ regex หายอดรวม/วันที่ · ช่องที่อ่านไม่ได้ไฮไลต์ warn · ป้าย "ฟรี"/"Claude" · **Claude (`/api/ocr`) เรียกได้เฉพาะจากปุ่ม "อ่านด้วย Claude" ที่ผู้ใช้กดเอง** (เฉพาะ pages.dev, prompt ใหม่ตอบ JSON, ไม่จำตัวเลือก) · "บันทึกเป็นรายจ่าย" → แถวใน `budget:records` รูปแบบเดิมผ่าน `TanotData.update` (id ตายตัวต่อใบเสร็จ กันซ้ำ/2 เครื่อง) · ประกันสินค้า (เดือน → วันหมด) → `TanotPush.setReminders('receipts')` ก่อนหมด 30 วัน + วันหมด + การ์ด "ประกันสินค้าใกล้หมด" บนหน้าวันนี้ (60 วัน) · ป้ายลดหย่อน (e-Receipt/OTOP/บริจาค) → `tanot:receipts:taxsummary` → หน้าภาษีเติมช่องอัตโนมัติ (พิมพ์ทับได้, ปีที่กฎเป็น null ไม่เติม) · ค้นหา/กรอง/ดูรูปเต็ม/แก้/ลบ (ลบ = DELETE ไฟล์ R2, รายการ budget ไม่ลบ) · `tests/receipts.spec.js` · ไม่มี migration D1 | P2 | M |
| สุขภาพ ✅ (2026-10-03, PR รอตรวจ) | หน้า `health.html` (`health.js` + `health-calc.js` ไม่มี DOM): สัญญาณชีพ (น้ำหนัก/ความดัน/ชีพจร/น้ำตาล/รอบเอว) กรอกเร็ว แก้/ลบได้ · ผลตรวจประจำปี (รายการแล็บ + ช่วงปกติ + แนบ PDF/รูปใน R2 `/api/files?ns=health`) · กราฟแนวโน้มสีจาก `chart-theme.js` + KPI เทียบครั้งก่อน + badge นอกช่วง (ช่วงเริ่มต้นแก้ได้) · ยา/อาหารเสริมหลายเวลาต่อวัน กด 'กินแล้ว' + เตือนผ่าน `TanotPush.setReminders('health')` (ซ่อนชื่อยาในแจ้งเตือนเป็นค่าเริ่มต้น) · การ์ด 'สุขภาพ' บนหน้าวันนี้ · คีย์ `tanot:health:*` (sync list, 1 บันทึก = 1 แถว) · `tests/health.spec.js` · **ต้องตรวจทาน:** ช่วงอ้างอิงเริ่มต้นใน `health-calc.js` เขียนจากความรู้ทั่วไป · หน้ากีฬาส่งข้อมูลออกกำลังกายเข้า `tanot:health:workouts` แล้ว (ดูแถวกีฬา) | P2 | M |
| ยุบรวมหน้าลงทุน · ออกแบบแล้ว (2026-10-03) | 17 → 10 หน้า + หน้า redirect 9 หน้า: หน้าหุ้นเดียวแยกแท็บ ไทย/ต่างประเทศ/สแกนเนอร์/พอร์ตจำลอง, กองทุน ไทย/ต่างประเทศ, ทอง + ค่าเงิน & วัตถุดิบ, สลาก ออมสิน/ธ.ก.ส./สลากกินแบ่ง, สมุดเทรดรวมทุกตลาด · `invest-calc.js` + `invest-core.js` ใช้ร่วมกัน (`/api/proxy` อย่างเดียว, AI คลาวด์อย่างเดียว, เลิก Drive รายหน้า) · การ์ด "สินทรัพย์ลงทุน" บนหน้าวันนี้ + snapshot วันละครั้ง · คีย์ข้อมูลเดิมไม่เปลี่ยนชื่อ/รูปแบบ ไม่มีการย้ายข้อมูล · แบบ + ลำดับ 13 ขั้น + เทสต์: `docs/invest-consolidation-design.md` | P2 | M |
| บันทึกรถ ✅ (2026-10-03, PR รอตรวจ) | หน้า `car.html` (`car.js` + `car-calc.js` ไม่มี DOM) — ทะเบียนรถหลายคัน (ทะเบียน/จังหวัด/ยี่ห้อ/รุ่น/ปี/เลขไมล์) · กำหนดต่ออายุ พ.ร.บ./ภาษีรถ/ประกันภาคสมัครใจ/ตรวจสภาพ (ตรอ.: รถเกิน 7 ปีต้องมีใบตรวจที่ไม่หมดก่อนวันครบกำหนดภาษี ไม่งั้นขึ้นเตือน) · ประกัน: อ่านกรมธรรม์ประเภทรถจาก `tanot:insurance:policies` อย่างเดียว (จับจากทะเบียนหรือเลือกเอง → ใช้วันของกรมธรรม์ + ปุ่มไปหน้าประกัน, ไม่ลงเตือนซ้ำ) · แนบเล่มทะเบียน/ใบเสร็จ R2 `ns=car` · เข้าศูนย์/ซ่อมบำรุง (วันที่/ไมล์/รายการ/ค่าใช้จ่าย + นัดถัดไปตามไมล์หรือวันที่ อย่างใดถึงก่อน) + ปุ่มบันทึกเข้า budget (id `car-<id>` กันซ้ำ) · เตือน `TanotPush.setReminders('car')` ก่อนหมด 30/7 วัน + วันหมด 08:00 ไทย + นัดเข้าศูนย์ 7 วัน/วันนัด · การ์ด "รถ" หน้าวันนี้ (ซ่อนจนกว่ามีกำหนดภายใน 60 วัน) · คีย์ `tanot:car:vehicles|services` (sync list) · `tests/car.spec.js` · **ยังไม่ได้ทดสอบ:** การเตือนจริงบนเครื่อง/iPhone (เทสต์ครอบแค่การลงทะเบียนชุดเตือนที่เซิร์ฟเวอร์) · นัดตามเลขไมล์อย่างเดียวไม่มีวันให้เตือน แสดงในหน้า/การ์ดเท่านั้น | P3 | S |

**การศึกษา**
| รายการ | ขอบเขต | ลำดับ | ขนาด |
|---|---|---|---|
| เนื้อหาห้องเรียนวิศวกรรม ✅ (2026-10-02, PR รอตรวจ) | `classroom-engineering.html` `course-data` 2 หมวด: **วิศวกรรม** 13 สาขาเดิม (id เดิมทุกตัว — ภาพรวม + ประเด็นสำคัญ + ข้อสอบ 4 ข้อ) และ **บำรุงรักษาระบบไฟฟ้า** (`elec-maint`) 12 หัวข้อ — ความปลอดภัย (LOTO/อาร์กแฟลช), หม้อแปลง, สวิตช์เกียร์/เบรกเกอร์, รีเลย์ป้องกัน, ต่อลงดิน, กับดักฟ้าผ่า/BIL, ทดสอบฉนวน IR/PI/DAR, สายเคเบิล/แรงดันตก, คุณภาพไฟฟ้า/แก้ PF, UPS/แบตเตอรี่/เครื่องกำเนิดไฟฟ้า, เทอร์โมกราฟี, กลยุทธ์ PM/CM/PdM + KPI — แต่ละหัวข้อมีบทเรียนสั้น (ฟิลด์ `lesson` Markdown) + ข้อสอบ 6–8 ข้อ ตัวเลข/สูตรตรงกับ `electrical-calc.js` · ข้อสอบเข้าคิวทบทวน `lbe:engineering:srs` (`<หมวด>:<หัวข้อ>:<ข้อ>`) และ `review.html` อ่านหน้าการ์ดได้เอง — **เพิ่มข้อสอบได้เฉพาะต่อท้าย** · `tests/learn.spec.js` · **ต้องตรวจทาน:** รายการตัวเลข/ข้อเท็จจริงในคำอธิบาย PR (แยกตามหัวข้อ) | P1 | L |
| วิชากฎหมายเพิ่ม | ทำจากเอกสารประกอบการเรียนของเจ้าของ ตามขั้นตอนใน `internal-notes/` | P2 | L (ทำต่อเนื่อง) |
| พิมพ์ดีด ✅ (2026-10-03, PR รอตรวจ) | ผังแป้นเกษมณี (มอก. 820-2538) ครบ 2 ชั้นทุกปุ่ม (`KB_ROWS` = `[en, th, enShift, thShift]`, เพิ่มปุ่ม `\` = ฃ/ฅ; ตารางผังอยู่ในคอมเมนต์หัว `typing.js` และเทสต์อ่านมาเทียบ) · track ใหม่ 6 ชุด id ใหม่ทั้งหมด: `th-shift-letters` (7 บท) `th-shift-numbers` (4) `th-shift-words` (4) `th-shift-sentences` (6) `en-shift` (6) `en-shift-sentences` (5) — บทเดิมไม่เปลี่ยน (เทสต์เทียบแฮช) · คีย์บอร์ดบนจอ: ตัวถัดไปชั้น Shift = ป้ายทุกปุ่มสลับเป็นอักษรชั้น Shift + ไฮไลต์ปุ่มอักษรและ Shift ฝั่งตรงข้ามมือ (สีโซนนิ้วเดิม) · ตรวจจากตัวอักษรที่ได้จริง (ไม่ใช้ keyCode); บทไทยที่ได้ตัวละตินขึ้นสถานะเตือนแป้นไม่ใช่ภาษาไทย (แทนข้อความคงที่เดิม) · รอบจับเวลาไม่รวมคำบทชั้น Shift · XP/ความคืบหน้าใช้ของเดิม · `tests/typing.spec.js` · **ต้องตรวจทาน:** ผังชั้น Shift (เขียนจากความรู้ทั่วไป ยังไม่ได้เทียบแป้นจริง) และการสะกดคำในบทไทยใหม่ · **พบระหว่างทำ:** บทเดิมบางบทมีอักษรชั้น Shift อยู่แล้ว (ประโยคอังกฤษขึ้นต้นตัวใหญ่, ู ใน th-words, ศ ์ ็ ฉ ใน th-sentences) ซึ่งคอมเมนต์เดิมอ้างว่าไม่มี — ไม่แก้เนื้อหา แต่ตอนนี้ไฮไลต์ Shift ให้ถูกต้อง | P2 | S–M |
| หนังสือ ✅ (2026-10-03, PR รอตรวจ) | หน้า `books.html` (`data-layout="reader"`; `books.js` + `books-calc.js` ไม่มี DOM) — ชั้น อยากอ่าน/กำลังอ่าน/อ่านจบ (ชื่อ ผู้แต่ง ปก จำนวนหน้า หน้าที่อ่านถึง วันเริ่ม/จบ คะแนน รีวิวสั้น), ค้น Open Library (`search.json` + `covers.openlibrary.org` ส่งเฉพาะคำค้น ไม่มีคุกกี้/referrer; ออฟไลน์/ไม่พบ = กรอกเอง), บันทึกการอ่านรายวัน (หน้า/นาที/ถึงหน้า) → สถิติหน้าต่อสัปดาห์ 8 สัปดาห์ + เป้าเล่มต่อปี, ไฮไลต์ (ข้อความ+หน้า) → ปุ่ม "ทำเป็นการ์ดทบทวน" → การ์ดเข้ากองรวมใน `review.html` (FSRS เดียวกับกฎหมาย/ภาษา เขียนผลกลับที่ `tanot:books:cards`) · คีย์ `tanot:books:items|logs|notes|cards` sync list, `settings` blob · XP แหล่งใหม่ `books` (area edu ต่อท้าย `SOURCES`): บันทึกการอ่าน 5 / อ่านจบครั้งแรก 20 / ทบทวนการ์ด 5 — แถว legacy เดิมไม่มีคีย์ books = 0 ยอดเดิมไม่เปลี่ยน · เมนู/sw.js/การ์ดทบทวนหน้าวันนี้นับการ์ดหนังสือ · `tests/books.spec.js` (พอร์ต 8137) | P3 | S–M |

**งานอดิเรก**
| รายการ | ขอบเขต | ลำดับ | ขนาด |
|---|---|---|---|
| ทำอาหาร stage 2 ✅ (2026-10-03, PR รอตรวจ) | 3 แท็บใหม่ในหน้า cooking (`cooking-plan.js` + `cooking-plan-calc.js`): **สูตร** (ชื่อ/จำนวนที่/วัตถุดิบ+หมวด ผัก·เนื้อสัตว์·ของแห้ง·เครื่องปรุง·อื่นๆ/ขั้นตอน/แท็ก/รูป R2 ns `recipes`, สูตรตั้งต้นอาหารไทย 12 เมนูแก้/ลบได้, วางสูตรเป็นข้อความ → Workers AI `/api/ai/chat` แยกให้ — ไม่เรียก `/api/ocr`/Claude, ใช้ AI ไม่ได้ = ใส่เป็นขั้นตอนให้กรอกเอง) · **แผนสัปดาห์** (7 วัน × เช้า/กลางวัน/เย็น, จำนวนที่ต่อมื้อ, คัดลอกสัปดาห์ก่อน, สุ่มเติมช่องว่าง, "ทำแล้ว" → `LearnCore.award('cooking', 10)` ครั้งเดียวต่อมื้อ) · **ซื้อของ** (รวมวัตถุดิบจากแผน แปลงกรัม↔กก./มล.↔ลิตร/ช้อนชา↔ช้อนโต๊ะ ต่างหน่วยแยกบรรทัด, ปรับตามจำนวนที่, จัดกลุ่มตามหมวด, ติ๊กซื้อแล้ว+ราคาจริงต่อรายการ ซิงก์ข้ามเครื่อง, เพิ่มรายการเอง, "บันทึกค่าซื้อของ" → 1 แถวใน `budget:records` id `cook-<shop id>`) · คีย์ใหม่ `tanot:cooking:recipes|plans|shopping` (sync list) · ไม่มี migration D1 · `tests/cooking-plan.spec.js` · **ยังไม่ทำ:** แบบทดสอบ/สูตรแยกตามประเทศ (stage 3) · **ข้อจำกัด:** น้ำหนักต่อช้อน/ถ้วยไม่แปลงเป็นกรัม (ช้อนนับเป็นปริมาตร 5/15 มล.) | P2 | M |
| กีฬา ✅ (2026-10-03, PR รอตรวจ) | ส่วน 'บันทึกออกกำลังกาย' ในหน้ากีฬา (`sports-log.js`): เลือกกิจกรรม (วิ่ง/เดิน/ปั่นจักรยาน/ว่ายน้ำ/เวท/โยคะ/ฟุตบอล/แบดมินตัน/พิมพ์เอง) + วันเวลา + นาที + ระยะ + kcal (ว่าง = ประมาณ MET × น้ำหนักล่าสุดในหน้าสุขภาพ ไม่มีน้ำหนักก็เว้นว่าง) · แก้/ลบได้ · เขียนตรงเข้า `tanot:health:workouts` id `sports:<uid>` ผ่าน `TanotData.update` · XP `LearnCore.award('sports', 10)` เฉพาะบันทึกใหม่ · หน้าสุขภาพมีการ์ดนาที/สัปดาห์เทียบเป้า 150 (ตั้งค่าได้) + กราฟรายสัปดาห์ + รายการล่าสุด, หน้าวันนี้มีบรรทัด 'ออกกำลังกายสัปดาห์นี้' · ตรรกะใน `health-calc.js` (`cleanWorkout/estimateKcal/workoutSummary`) · `tests/health.spec.js` · **ยังไม่ทำ:** แบบทดสอบความรู้กีฬา · MET เป็นค่าประมาณทั่วไป | P2 | S–M |
| เกมฝึกทักษะ · พักไว้ก่อน (2026-10-03) | จับคู่/แข่งเวลาคำศัพท์จากชุดภาษา, จับคู่มาตรากฎหมาย, แข่งพิมพ์ — XP เข้าระบบการเรียนรวม | P3 | M |
| จำลองคน | แนะนำตัดทิ้ง หรือทำเป็นหุ่นในหน้า sim-objects | P4 | — |

**ทำทีหลัง**
- **เกมแข่งรถแนว RayCity** (เล่นบนมือถือ, Three.js, เล่นคนเดียว + รถ AI) และ **เกม RPG เก็บเลเวลแนว Tree of Savior** (เล่นคนเดียว, เซฟผ่านซิงก์) — งานออกแบบของเราเอง ห้ามใช้ชื่อ/ภาพ/เสียงจากเกมต้นฉบับ · เริ่มด้วยเอกสารออกแบบ (Opus) แล้วแบ่งรอบสร้าง · ทำหลังงานอื่นเสร็จ
- หมายเหตุ: เกมฝึกทักษะ (จับคู่คำศัพท์/มาตรา/แข่งพิมพ์ — แถว "เกมฝึกทักษะ" ในงานอดิเรก) พักไว้ก่อน
- **Lamport clock ใน `tanot-data.js` `push()`** — ตั้ง `updated_at = max(now, shadow.updated_at + 1)` กันการแก้/ลบที่ทำหลังเห็นฉบับล่าสุดแพ้เพราะนาฬิกาเครื่องเหลื่อมกัน (ดู [PR #33](https://github.com/tanot713-sudo/My-Web-App/pull/33)) · ต้องจัดการกฎเซิร์ฟเวอร์ที่ตัดเวลาล้ำอนาคตเกิน 5 นาทีด้วย · ทำเมื่อเจออาการข้อมูลที่ลบ/แก้แล้วกลับมาเอง

**ลำดับที่เสนอ (สลับด้าน):** Phase 0 (ครบทุกข้อ) → 1 → 2 รอบ 1–2 + 3 → 4 → งาน P1 (เครื่องคำนวณไฟฟ้า) + ชีวิต P1 (ภาษี, ประกัน) → 2 รอบ 3–4 + 5 → งาน P1 (บันทึกงานบำรุงรักษา) + ศึกษา P1 (ห้องเรียนวิศวกรรม) → 2 รอบ 5–6 → งานอดิเรก P2 → ที่เหลือ P2/P3

---

## สิ่งที่เจ้าของต้องทำเอง (ผมทำแทนไม่ได้)
1. เปิด build log ของ Cloudflare Pages ยืนยันว่าล้มเพราะไฟล์เกิน 25 MiB
2. ✅ **เสร็จแล้ว (2026-09-28)** — Zero Trust ตั้งค่าเสร็จ, สร้างแอป `my-web-app-5w2.pages.dev` แยกจาก preview app แล้ว, policy "Allow me only" (Allow + email tanot713@gmail.com) ทดสอบผ่านจริงบน production domain แล้ว
   - **Team domain**: `tanot.cloudflareaccess.com` (ยืนยันจาก Zero Trust → Settings → Team name and domain เมื่อ 2026-09-30 — ค่า `fancy-cherry-f763.cloudflareaccess.com` ที่เคยจดไว้ผิด; ชื่อนี้ยังโผล่เป็นหัวการ์ดหน้าล็อกอินเพราะเป็น Organization name เดิม แก้ได้ที่ Settings → Custom Pages)
   - **AUD tag** (ของแอป `my-web-app-5w2.pages.dev`): `f84ccc66f4b1de1e0919624581c1e41569102662e535e5f76e39a077e1e9b830`
   - ใช้ 2 ค่านี้ใน `functions/api/_middleware.js` (Phase 0a ข้อ 3) ตอนตรวจ JWT — endpoint ดึง public key: `https://tanot.cloudflareaccess.com/cdn-cgi/access/certs`
3. ✅ **เสร็จแล้ว (2026-09-28)** — D1 database ชื่อ `tanot-db` (id: `5b56b7fa-8eed-453b-8c2d-81b5004d7b7b`), R2 bucket ชื่อ `tanot-files` (Public Access: Disabled) — ยังไม่ได้วาง schema (`0001_init.sql`) รอเขียนใน Phase 0a ข้อ 5
   - ✅ วาง schema `0001_init.sql` ใน D1 console แล้ว (2026-09-30) — ยืนยันครบ 8 ตาราง: docs, reminders, push_subs, learn_cards, learn_log, ai_cache, ai_usage, files
4. ✅ **เสร็จแล้ว (2026-09-28)** — ตั้งค่าใน Pages → Variables and secrets ครบ: `OWNER_EMAIL` (Text), `ACCESS_AUD` (Text), `TEAM_DOMAIN` (Text), `ANTHROPIC_API_KEY` (Secret, คีย์ใหม่ชื่อ `tanot-cf-pages` ไม่มีวันหมดอายุ แยกจากคีย์เก่า `tanot-api-key` ที่ Worker OCR เดิมยังใช้อยู่) — คีย์ VAPID ดูข้อ 7
5. ✅ **เสร็จแล้ว (2026-09-28)** — กู้โค้ด `tanot-ocr-proxy` มาได้ครบแล้ว บันทึกไว้ที่ `docs/ocr-worker-original.js` (สร้างไฟล์นี้ในขั้นแรกของ Phase 0a ข้อ 3 ก่อนเริ่มพอร์ตเป็น `functions/api/ocr.js`) — จุดที่ต้องแก้ตอนพอร์ต: (1) `MODEL = 'claude-sonnet-4-5'` เป็นรุ่นเก่าที่ retired แล้ว ต้องเปลี่ยนเป็นรุ่นปัจจุบัน เช่น `claude-sonnet-5` (2) เพิ่มการตรวจ Access JWT (ใช้ `ACCESS_AUD`/`TEAM_DOMAIN` ที่ตั้งไว้แล้ว) แทนการพึ่ง CORS origin allowlist อย่างเดียว (3) `ALLOWED_ORIGINS` เดิมชี้ไป `tanot713-sudo.github.io` เท่านั้น ต้องเพิ่ม `my-web-app-5w2.pages.dev`
   - prompt ถอดข้อความ (ห้ามแก้คำผิด, เรียงลำดับตามภาพ, ห้ามแปล/สรุป, ใส่ `[อ่านไม่ออก]` ตรงจุดที่อ่านไม่ออก) เป็นของดีอยู่แล้ว **คงไว้เหมือนเดิมไม่ต้องแก้**

   **โค้ดต้นฉบับที่กู้มา (สำหรับสร้างเป็น `docs/ocr-worker-original.js` ตอนเริ่ม Phase 0a ข้อ 3):**
   ```js
   /* ══════════════════════════════════════════════════════════════════
      Tanot OCR Proxy — Cloudflare Worker
      คั่นระหว่างเว็บ (doc-check.html) กับ Anthropic API เพื่อไม่ให้ API key
      หลุดไปอยู่ในโค้ดฝั่งเบราว์เซอร์ — รับรูปภาพจากเว็บ ส่งต่อไป Claude Vision
      อ่านข้อความในรูป แล้วส่งข้อความที่อ่านได้กลับไป

      วิธี deploy: ดูคำแนะนำที่แชทแยกต่างหาก (ไม่ต้องใช้ CLI ก็ได้ ใช้ dashboard
      ของ Cloudflare วาง code นี้ตรงๆ ได้เลย)
      ══════════════════════════════════════════════════════════════════ */

   // ตรวจรุ่นโมเดลล่าสุดได้ที่ https://docs.claude.com/en/docs/about-claude/models
   // ถ้า deploy แล้วขึ้น error ว่าไม่รู้จักโมเดล ให้เปลี่ยนบรรทัดนี้เป็นชื่อรุ่นปัจจุบัน
   const MODEL = 'claude-sonnet-4-5';

   // จำกัดให้เรียกได้เฉพาะจาก origin ของเว็บตัวเอง กัน key ถูกคนอื่นแอบใช้ผ่าน worker
   // เปลี่ยนเป็นโดเมนจริงของเว็บคุณ (ดูจาก URL บนแถบที่อยู่ตอนเปิดเว็บ) — ใส่ได้หลายโดเมน
   const ALLOWED_ORIGINS = [
     'https://tanot713-sudo.github.io',
     'http://localhost:8000', // สำหรับทดสอบในเครื่องตัวเอง (ปรับพอร์ตตามจริง)
   ];

   function corsHeaders(origin) {
     const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
     return {
       'Access-Control-Allow-Origin': allow,
       'Access-Control-Allow-Methods': 'POST, OPTIONS',
       'Access-Control-Allow-Headers': 'Content-Type',
     };
   }

   export default {
     async fetch(request, env) {
       const origin = request.headers.get('Origin') || '';

       if (request.method === 'OPTIONS') {
         return new Response(null, { headers: corsHeaders(origin) });
       }
       if (request.method !== 'POST') {
         return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
       }

       let body;
       try {
         body = await request.json();
       } catch (e) {
         return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
           status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
         });
       }

       const { imageBase64, mediaType, prompt } = body;
       if (!imageBase64 || !mediaType) {
         return new Response(JSON.stringify({ error: 'missing imageBase64 or mediaType' }), {
           status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
         });
       }

       // Prompt นี้ปรับตามแนวทางจาก claude-cookbooks (multimodal/best_practices_for_vision.ipynb,
       // how_to_transcribe_text.ipynb): (1) role assignment ช่วยลด hallucination บนงานภาพ
       // (2) กฎ "ห้ามแก้คำผิด" คือส่วนสำคัญที่สุดของ prompt นี้ — ปกติโมเดลมักจะ "ช่วย" แก้คำสะกด/
       // ไวยากรณ์ที่มันเห็นว่าผิดโดยอัตโนมัติ (คล้าย hallucination ที่ cookbook พูดถึง) ซึ่งจะทำลาย
       // จุดประสงค์ของเครื่องมือนี้ทันที เพราะขั้นตอนถัดไปคือส่งข้อความที่ถอดได้ไปตรวจคำผิดต่อ —
       // ถ้า Claude แอบแก้คำผิดให้ตั้งแต่ตอน OCR ผู้ใช้จะไม่มีทางเห็นคำผิดตัวจริงในเอกสารเลย
       const userPrompt = prompt ||
         'คุณเป็นระบบถอดข้อความ (OCR) มืออาชีพ ทำหน้าที่อ่านข้อความในภาพนี้ให้ตรงกับต้นฉบับที่สุด\n' +
         'กฎสำคัญ:\n' +
         '1. ถอดข้อความทุกตัวอักษรตามที่ปรากฏจริงในภาพ (รวมลายมือเขียนถ้ามี) ห้ามแก้คำผิด ไวยากรณ์ ' +
         'หรือการสะกดใดๆ แม้จะรู้ว่าผิด — ให้คงคำผิดนั้นไว้ตรงๆ เพราะข้อความนี้จะถูกนำไปตรวจคำผิดต่อในขั้นตอนถัดไป\n' +
         '2. เรียงข้อความตามลำดับที่ปรากฏในภาพจากบนลงล่าง ซ้ายไปขวา คงการขึ้นบรรทัดใหม่/ย่อหน้าตามต้นฉบับ\n' +
         '3. ห้ามแปล ห้ามสรุป ห้ามใส่คำอธิบายหรือความเห็นใดๆ ห้ามใส่ markdown หรือเครื่องหมายคำพูดครอบ\n' +
         '4. ถ้าบางจุดอ่านไม่ออกจริงๆ ให้ใส่ [อ่านไม่ออก] แทนที่จุดนั้นแล้วอ่านต่อ\n' +
         '5. ถ้าในภาพไม่มีข้อความเลยให้ตอบว่า "ไม่พบข้อความในภาพ" คำเดียว\n' +
         'พิมพ์เฉพาะข้อความที่ถอดได้เท่านั้น ไม่ต้องมีหัวข้อหรือคำนำใดๆ ก่อนเริ่มถอดข้อความ';

       try {
         const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
           method: 'POST',
           headers: {
             'x-api-key': env.ANTHROPIC_API_KEY,
             'anthropic-version': '2023-06-01',
             'content-type': 'application/json',
           },
           body: JSON.stringify({
             model: MODEL,
             max_tokens: 4096,
             messages: [{
               role: 'user',
               content: [
                 { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
                 { type: 'text', text: userPrompt },
               ],
             }],
           }),
         });

         const data = await anthropicRes.json();
         if (!anthropicRes.ok) {
           return new Response(JSON.stringify({ error: data.error?.message || 'Anthropic API error', raw: data }), {
             status: anthropicRes.status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
           });
         }

         const text = (data.content || []).map((c) => c.text || '').join('');
         return new Response(JSON.stringify({ text }), {
           status: 200, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
         });
       } catch (e) {
         return new Response(JSON.stringify({ error: String(e) }), {
           status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
         });
       }
     },
   };
   ```
6. ✅ (2026-10-02 — ไม่ต้องทำแล้ว: Firebase ถูกถอดออกจากเว็บ) เพิ่ม origin ของ pages.dev ใน Google OAuth client (Drive) และใน Authorized domains ของ Firebase Auth (ใช้ตอนดึงข้อมูล budget ครั้งเดียว)
7. ✅ **เสร็จแล้ว (2026-10-02)** — รัน `migrations/0002_push.sql` แล้ว, สร้างคีย์ VAPID + ตั้ง `VAPID_PRIVATE_KEY` ใน Pages และ Worker แล้ว (public key อยู่ใน `wrangler.toml`), ต่อ Workers Builds `tanot-scheduler` (root `/workers/scheduler`) แล้ว, ทดสอบ Web Push บน iPhone ผ่าน — **Web Push + Scheduler Worker (Phase 3 / 0a ข้อ 6)** ขั้นตอนเดิมเก็บไว้อ้างอิง:
   1. **D1:** เปิด Cloudflare → D1 → `tanot-db` → Console วางทั้งไฟล์ `migrations/0002_push.sql` แล้วรัน (ครั้งเดียว — รันซ้ำจะขึ้น `duplicate column name: kind` ไม่เสียหาย) · ตรวจ: `SELECT kind FROM reminders LIMIT 1` ต้องไม่ error
   2. **สร้างคีย์ VAPID ในเครื่องตัวเอง** (ห้ามสร้างผ่านเว็บ/แชต): ในโฟลเดอร์ที่ clone repo ไว้ รัน `node workers/scheduler/gen-vapid.mjs` (Node 18 ขึ้นไป ไม่ต้อง npm install — สคริปต์ไม่เขียนไฟล์ แค่พิมพ์ 2 บรรทัด) จะได้ `VAPID_PUBLIC_KEY = …` และ `VAPID_PRIVATE_KEY = …` · หรือใช้ `npx web-push generate-vapid-keys` ก็ได้ (รูปแบบเดียวกัน) · **private key ห้าม commit / ห้ามวางในแชต / ห้ามใส่ใน wrangler.toml** — เก็บไว้ใน password manager
   3. **Public key ใส่ใน repo:** แก้ `VAPID_PUBLIC_KEY = ""` ใน `wrangler.toml` (root) **และ** `workers/scheduler/wrangler.toml` ให้เป็นค่าเดียวกัน แล้ว commit เข้า main (public key เปิดเผยได้) — หรือส่งเฉพาะ public key มาให้ผมใส่
   4. **Secret ใน Pages:** Workers & Pages → `my-web-app` → Settings → Variables and secrets → Add → Type **Secret**, ชื่อ `VAPID_PRIVATE_KEY`, ค่า = private key (Production) → Save แล้ว deploy ใหม่ 1 ครั้ง (Deployments → Retry deployment หรือ push อะไรก็ได้) — secret ใหม่มีผลกับ deploy ถัดไป
   5. **ต่อ Workers Builds:** Workers & Pages → Create → Workers → **Import a repository** → เลือก `tanot713-sudo/My-Web-App` → Project name `tanot-scheduler` (ต้องตรง `name` ใน `workers/scheduler/wrangler.toml`) → Advanced settings: **Root directory** `workers/scheduler`, Build command เว้นว่าง, Deploy command `npx wrangler deploy`, Production branch `main` → Deploy · ถ้ามีช่อง Build watch paths ให้ใส่ `workers/scheduler/*` และ `functions/_lib/*` (Worker import โค้ดจาก `functions/_lib/` — แก้ไฟล์นั้นต้อง deploy Worker ใหม่ด้วย) หรือปล่อยว่างให้ build ทุก push
   6. **Secret ใน Worker:** Workers & Pages → `tanot-scheduler` → Settings → Variables and secrets → Add → Secret `VAPID_PRIVATE_KEY` = ค่าเดียวกับข้อ 4 · ตรวจ Settings → Trigger events ต้องมี cron 2 ตัว (`*/15 * * * *`, `0 0 * * *`) · Worker นี้ไม่มี URL (`workers_dev = false`) ตั้งใจ
   7. **ทดสอบ:** เปิด `https://my-web-app-5w2.pages.dev/notifications.html` → "เปิดการแจ้งเตือน" → "ส่งทดสอบ" ต้องเด้งการแจ้งเตือนบนเครื่องนั้น · **iPhone:** Safari → ปุ่มแชร์ → "เพิ่มไปยังหน้าจอโฮม" → เปิดจากไอคอนบนหน้าจอโฮม (ไม่ใช่ Safari) → หน้าการแจ้งเตือน → เปิด → อนุญาต (iOS 16.4 ขึ้นไป; ใน Safari ปกติปุ่มจะไม่ขึ้น) · ทำซ้ำทุกเครื่องที่อยากได้รับ
   8. **ตรวจ scheduler:** หลัง 15 นาที ดู `tanot-scheduler` → Logs (เปิด observability ไว้แล้ว) ต้องเห็นบรรทัด `*/15 * * * * {"due":…}` · เช้าวันถัดไปหลัง 07:00 ดู R2 `tanot-files` → `backups/d1/` ต้องมีไฟล์ของวันนั้น · เปิดหน้า ประกัน / ภาษี / บำรุงรักษา อย่างน้อยครั้งละ 1 รอบ แล้วดูรายการที่หน้าการแจ้งเตือน (การลงทะเบียนเกิดตอนเปิดหน้านั้น)
8. ✅ ย้ายข้อมูลครบทั้ง 2 เครื่องแล้ว (2026-09-30) · ✅ GitHub Pages เป็น redirect แล้ว (2026-10-02) · ✅ เจ้าของลบ Worker เก่า 3 ตัว (`tanot-cors-proxy`, `tanot-whisper-proxy`, `tanot-ocr-proxy`) + คีย์ Anthropic เก่า `tanot-api-key` แล้ว (2026-10-02) · ⏳ ภายหลังลบโปรเจกต์ Firebase `tanot-budget`

## ความเสี่ยง
- **ข้อมูลหาย** ถ้าปิด GitHub Pages ก่อนย้ายข้อมูลครบทั้ง 2 เครื่อง (storage ผูกกับโดเมน)
- หน้าล็อกอินของ Access อาจทำให้แอปบนหน้าจอโฮม iPhone ค้างตอนหมดเวลาล็อกอิน → ตั้งให้ล็อกอินค้างนานๆ + ให้ service worker แสดงหน้าจากแคชแทน
- ลิมิตฟรีเป็นแบบตัดทันทีเมื่อเกิน: D1 (อ่าน 5M แถว / เขียน 100k แถวต่อวัน → ซิงก์ต้องไล่ตาม `rev` ห้ามอ่านทั้งตาราง), Workers AI (10k Neurons/วัน ใช้ร่วมกับ Whisper; ถ้าไม่พอ อัปเกรด Workers Paid $5/เดือน), Workers ฟรีจำกัด CPU 10 ms ต่อครั้ง
- repo เป็นสาธารณะ (GitHub Pages ฟรีบังคับ) → ห้าม commit secret; Access ป้องกันข้อมูลและ endpoint ได้ แต่ไม่ได้ซ่อนโค้ด
- การดักจับ `localStorage.setItem` ต้องทดสอบให้ละเอียด + มีรายชื่อแคชที่ไม่ซิงก์ และต้องไม่เกิน ~5MB
- เนื้อหากฎหมาย/วิศวกรรม และกฎภาษีแต่ละปี ต้องให้เจ้าของตรวจทานความถูกต้อง
- ทุกหน้าใหม่ต้องไม่มีข้อความอธิบายใน UI (กฎใน CLAUDE.md)

## การตรวจสอบ (Verification)
- ทุก commit: `node --check` ไฟล์ JS ที่แก้, `tests/repo-guards.mjs` ผ่าน, bump `sw.js` แล้ว
- ทุกการแก้ UI: `smoke.spec.js` + `visual.spec.js` ที่ 390/1100px × สว่าง/มืด — ไม่มี console error, ไม่มีเนื้อหาล้นแนวนอน, ภาพเปลี่ยนเฉพาะจุดที่ตั้งใจ
- แพลตฟอร์ม: เช็ก GitHub check "Cloudflare Pages" ว่า build ผ่านหลังแก้ไฟล์ wasm; เรียก `/api/*` แบบไม่ล็อกอินต้องได้ 401/403 และเมื่อล็อกอินต้องได้ 200; ติดตั้ง PWA บนมือถือแล้วเปิดใช้ได้
- ข้อมูล: ทดสอบย้ายข้อมูลด้วยข้อมูลจำลอง; แก้ไขบนเครื่อง A แล้วต้องเห็นบนเครื่อง B (Playwright 2 context); ออฟไลน์ → คิวรอส่ง → กลับมาออนไลน์แล้วซิงก์ครบ
- ทำงานบน branch `claude/web-app-ui-colors-99x34a` แล้ว push

## โมเดล Claude + ระดับ effort ที่แนะนำต่อ phase (เน้นประหยัด token)
ราคาต่อ 1M token (input/output): Haiku 4.5 $1/$5 · Sonnet 5 $2/$10 · Opus 5.5 $4/$20 · Fable 5.1 $10/$50 (เก่งที่สุด แพงสุด)
ระดับ effort: low → medium → high → xhigh → max (ยิ่งสูงยิ่งคิดนาน ใช้ token มากขึ้น)

**หลักการ:** ใช้ Sonnet 5 เป็นค่าเริ่มต้น → ขยับขึ้นเป็น Opus 5.5 เฉพาะงานที่ออกแบบโครงสร้าง / ถ้าพลาดแล้วข้อมูลหาย / ต้องการความถูกต้องสูง → Fable 5.1 ใช้เฉพาะรีวิวงานเสี่ยงสูงครั้งเดียว ไม่ใช้เขียนงานทั้ง phase · ใช้ Haiku 4.5 กับ subagent ที่แค่ค้นไฟล์ (Explore) · max ไม่จำเป็นสำหรับ roadmap นี้

| งาน | โมเดล | effort | เหตุผล |
|---|---|---|---|
| 0a-1 แก้ build (ไฟล์ wasm) | Sonnet 5 | medium | งานเล็ก ชัดเจน |
| 0a-2..7 Functions + Access middleware + D1 schema + scheduler | Opus 5.5 | high | ความปลอดภัยและสถาปัตยกรรม พลาดแล้วแก้ยาก |
| 0b ชุดทดสอบ Playwright | Sonnet 5 | medium | รูปแบบตรงไปตรงมา |
| 0c ธีม v2 แกนกลาง (tokens/คอมโพเนนต์/layout) | Opus 5.5 | high | กำหนดมาตรฐานที่ทุกหน้าจะใช้ต่อ ต้องคิดรอบด้าน |
| 0d จัดเมนูใหม่ | Sonnet 5 | low | แก้โครงข้อมูลเมนู |
| Phase 1 ชั้นข้อมูล + ซิงก์ + ย้ายข้อมูลข้ามโดเมน | Opus 5.5 | xhigh | เสี่ยงข้อมูลหายที่สุดในทั้งแผน |
| └ รีวิวโค้ดซิงก์/ย้ายข้อมูลก่อนใช้จริง (ครั้งเดียว) | Fable 5.1 | high | ตาที่สองสำหรับจุดที่ผิดไม่ได้ |
| Phase 2 ย้ายธีม — หน้าแรกของแต่ละรอบ (ทำเป็นต้นแบบ) | Sonnet 5 | high | วางแบบให้หน้าที่เหลือในรอบนั้นทำตาม |
| Phase 2 ย้ายธีม — หน้าที่เหลือในรอบ | Sonnet 5 | low–medium | ทำซ้ำตามต้นแบบ |
| Phase 2 รอบ 6 (คอมไพล์ Tailwind ของหน้า React) | Sonnet 5 | high | มีขั้นตอน build ใหม่ |
| Phase 3 หน้าวันนี้ + ค้นหาด่วน | Sonnet 5 | high | UI หลายส่วน แต่ไม่ซับซ้อนเชิงสถาปัตยกรรม |
| Phase 3 Web Push (VAPID) | Opus 5.5 | medium | มีรายละเอียดด้านความปลอดภัย/iOS |
| Phase 4 AI บนคลาวด์ | Sonnet 5 | high | ต่อ API + โควตา |
| Phase 5 ระบบการเรียนรวม (แยก FSRS + รวม XP เดิม) | Opus 5.5 | high | ยุ่งกับข้อมูลความคืบหน้าเดิมหลายหน้า |
| เครื่องคำนวณไฟฟ้า, ภาษี | Opus 5.5 | high | สูตร/กฎต้องถูกต้อง |
| บันทึกงานบำรุงรักษา (L) | Opus 5.5 high ออกแบบ → Sonnet 5 medium ลงมือ | — | แยกคิดกับทำ ประหยัดกว่า |
| เนื้อหาห้องเรียนวิศวกรรม / วิชากฎหมาย | Opus 5.5 | high | เนื้อหาเทคนิคภาษาไทยต้องแม่น (เจ้าของยังต้องตรวจ) |
| CAD fillet/chamfer (L) | Opus 5.5 | xhigh | เรขาคณิตยาก |
| ประกัน, สุขภาพ, PowerPoint, เปรียบเทียบข้อมูล, หนังสือ, เกม, ทำอาหาร, กีฬา, พิมพ์ดีด, CAD ข้อเล็ก, บันทึกรถ | Sonnet 5 | medium | ฟีเจอร์ทั่วไปตามแบบแผนที่วางไว้แล้ว |
| แก้บั๊กทั่วไปหลัง deploy | Sonnet 5 | medium | ถ้า 2 รอบยังไม่หาย → Opus 5.5 high |

**เมื่อไหร่ควรเปิด session ใหม่:** ไม่ต้องเปิดใหม่ทุกขั้นย่อย — ขั้นย่อยใน phase เดียวกันต่อกันและใช้ไฟล์ชุดเดิม ทำต่อใน session เดิมคุ้มกว่า · เปิดใหม่เมื่อ (1) ขึ้น phase / รอบใหม่ (2) เปลี่ยนโมเดล (แคชผูกกับโมเดล เปลี่ยนกลางทางต้องอ่านบทสนทนาทั้งหมดใหม่ราคาเต็ม) (3) session ยาวมากหรือเริ่มหลงเรื่อง · ก่อนปิดทุก session ต้อง commit + push (เครื่อง cloud ถูกลบเมื่อไม่ได้ใช้งาน)

**วิธีประหยัด token เพิ่ม:** 1 phase ต่อ 1 session (เริ่มใหม่/`/clear` ระหว่าง phase) แล้วบอกให้อ่านไฟล์แผนนี้ + CLAUDE.md แทนการเล่าซ้ำ · สั่งงานเป็นก้อนชัดเจน (เช่น "ทำ Phase 2 รอบ 3 หน้า music") · รัน visual test เฉพาะหน้าที่แก้ ไม่ต้องทั้งเว็บทุกครั้ง · ส่งภาพหน้าจอ/ข้อความ error มาพร้อมรายงานบั๊กเสมอ

## เริ่มลงมือได้ทันทีหลังอนุมัติ (ไม่ต้องรอเจ้าของตั้งค่า Cloudflare)
0a-1 แก้ build (ไฟล์ wasm) → 0b ชุดทดสอบ → 0c ธีม v2 แกนกลาง + หน้าตัวอย่างให้เลือกฟอนต์ → 0d จัดเมนูใหม่ — ระหว่างนี้เจ้าของทำ "สิ่งที่ต้องทำเอง" ข้อ 1–5 คู่ขนานไปได้ เพื่อให้เริ่ม 0a ข้อ 2–7 และ Phase 1 ต่อได้
