# แผนพัฒนาเว็บแอป Tanot — ทุกหน้า + ธีมกลาง + ระบบหลังบ้าน

## Context
เจ้าของต้องการให้ Tanot (repo `tanot713-sudo/my-web-app`, 45 ไฟล์ HTML) เป็นเว็บแอปส่วนตัวที่ใช้ได้จริงใน 4 ด้าน: การทำงาน, การใช้ชีวิต, การศึกษา, งานอดิเรก ไม่จำเป็นต้องเป็น static อีกต่อไป และต้องการธีมที่ดูเป็นมืออาชีพ เหมาะกับแต่ละประเภทหน้า โดยควบคุมจากศูนย์กลางที่เดียว

**ตัดสินใจแล้ว (จาก Q&A):** ใช้คนเดียว (ซิงก์คอม + มือถือ) · หลังบ้านบน Cloudflare · ธีมลดเหลือชุดคัดสรร · ทั้ง 4 ด้านสำคัญเท่ากัน (สลับทำ)

**สภาพปัจจุบันที่สำคัญ (ตรวจแล้ว):**
- **Cloudflare Pages build ล้มเหลวมาตั้งแต่ ~11 ก.ย.** เพราะ `vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm` มีขนาด 25.93 MiB ซึ่งเกินลิมิตไฟล์เดียว 25 MiB → `my-web-app-5w2.pages.dev` ค้างเป็นเวอร์ชันเก่า
- ไม่มีโค้ดฝั่งเซิร์ฟเวอร์ใน repo; Worker 3 ตัวต้อง deploy เองด้วยมือ (มีโค้ด CORS proxy และ Whisper proxy แต่**โค้ด OCR proxy ไม่อยู่ใน repo**); endpoint ที่เสียเงินป้องกันด้วยรหัสผ่านฝั่ง client เท่านั้น
- `auth-gate.js` ไม่ใช่ความปลอดภัยจริง; ~12 หน้าก๊อป DriveSync แยกกัน; budget ใช้ Firebase; ไม่มีตัวตนผู้ใช้ร่วมกันทั้งเว็บ
- `theme.css` มีแค่ tokens + shell **ไม่มีชั้นคอมโพเนนต์กลาง**: `.btn` นิยามซ้ำ 33 ไฟล์, `.card` 25, border-radius 32 ค่า, theme-color 11 ค่า, ไอคอนปนกัน emoji/SVG/Lucide, สีกราฟ hardcode ใน JS, จอกะพริบสว่างก่อนเข้าโหมดมืด (FOUC)
- หน้าที่ยังไม่ทำ (SOON): PowerPoint, รวบรวมข้อมูล, เปรียบเทียบข้อมูล, ภาษี, สุขภาพ, จำลองคน, เกม, หนังสือ · ห้องเรียนวิศวกรรมยังว่าง · ห้องเรียนกฎหมายมีวิชาเดียว
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
6. **Scheduler Worker** แยก `workers/scheduler/` (Pages Functions ตั้ง cron ไม่ได้): ทุก 15 นาทีส่งการแจ้งเตือน (Web Push), 07:00 เวลาไทยทำสรุปประจำวัน + สำรอง D1 → R2
7. GitHub Pages คงไว้แบบอ่านอย่างเดียวจนย้ายข้อมูลครบทั้ง 2 เครื่อง แล้วค่อยเปลี่ยนเป็น redirect

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
**สถานะ (2026-09-30, PR รอตรวจ):** ✅ `tanot-data.js` + `data-registry.js` + `functions/api/sync.js` + `migrate.html`/`migrate-export.html` + `drive-backup.js` + หน้า `data.html` (สถานะซิงก์/สำรอง/กู้คืน/ค่าที่ถูกแทน) · ต่างจากแผน: ข้อมูลยังอยู่ที่ localStorage/IndexedDB เดิมของแต่ละหน้า (tanot-data เก็บแค่ shadow + คิวใน IndexedDB `tanot-data`) · คีย์ budget จริงคือ `budget:*` · ข้อมูล budget ใน Firebase ไม่ได้ดึงแยก — budget.html เขียนค่าจาก Firebase ลง localStorage ของ github.io อยู่แล้ว จึงมากับการย้าย · **ยังไม่ทำ (รอย้ายครบ 2 เครื่อง เพราะ GitHub Pages ยังใช้อยู่):** ลบ DriveSync รายหน้า 12 ชุด, `firebase-sync.js`, `ai-summary-cache.js`, `vendor/firebase` · cron สำรอง D1 → R2 ไปทำพร้อม Scheduler Worker (0a ข้อ 6) · ไฟล์ 3D (ไบนารี) ย้าย/สำรองได้ แต่ไม่ซิงก์ขึ้น D1 (รอ R2) · คลังรายงาน `report-dashboard` (id แบบ autoIncrement ชนกันข้ามเครื่อง) ย้าย/สำรองเท่านั้น จนกว่าหน้าจะเปลี่ยนไปใช้ id ที่ไม่ซ้ำข้ามเครื่อง · budget.html บน pages.dev ไม่เปิด Firebase แล้ว (ส่งทั้งก้อนมาเขียนทับจะลบรายการจาก D1) — ก่อนย้ายข้อมูล ให้เปิด budget.html บน github.io ที่เชื่อม Firebase ไว้ 1 ครั้ง ข้อมูลใน localStorage จะได้เป็นชุดล่าสุด
- `tanot-data.js`: เก็บใน IndexedDB + คิวรอส่ง → `GET /api/sync?since=rev` / `POST /api/sync` (≤40 รายการต่อครั้ง เพราะ D1 จำกัด 50 query ต่อ request), รายการที่แก้ทีหลังชนะ (last-write-wins); ข้อมูลที่เพิ่มจากหลายเครื่องพร้อมกัน (รายการบัญชี, บันทึกเทรด, การ์ดทบทวน) เก็บเป็นรายการย่อยแยกกันจะได้ไม่ทับกัน
- `data-registry.js`: รายชื่อ prefix ที่ต้องซิงก์ (`tanot:*`, `lang-practice:*`, `lbe:*`, `tanot-budget*`, `tanot:barprep` + IndexedDB 3 ตัว) กับรายชื่อที่ไม่ซิงก์ (แคช, ค่าเฉพาะเครื่อง); ดักจับ `localStorage.setItem` → หน้าเดิมไม่ต้องแก้ แล้วยิง event `tanot:data` หลังดึงข้อมูลใหม่
- **ย้ายข้อมูลข้ามโดเมน**: `migrate.html` บน pages.dev เปิด popup `github.io/.../migrate-export.html` (ต้องเป็น popup ไม่ใช่ iframe ถึงจะอ่าน storage ของ github.io ได้) → ส่งกลับผ่าน `postMessage` แบบระบุ origin; ทำครั้งเดียวต่อเครื่อง; ข้อมูล budget ดึงจาก Firebase ครั้งเดียว แล้วลบ `firebase-sync.js`, `ai-summary-cache.js`, `vendor/firebase` (แคชสรุป AI ปัจจุบันเขียนได้สาธารณะ เสี่ยงโดนสแปม)
- สำรองข้อมูล: DriveSync 12 ชุด → `drive-backup.js` ตัวเดียว (ส่งออก snapshot ทั้งหมด) + cron สำรอง D1 → R2 ทุกวัน

## Phase 2 — ย้ายทุกหน้าเข้าธีมกลาง (L, ทยอยเป็นรอบ)
**สิ่งที่ทำกับทุกหน้า:** เทียบกับภาพ baseline → ลบ `.btn/.card/.field` ของหน้าเอง → เปลี่ยน radius/สีเป็น token → เปลี่ยน emoji ใน UI เป็นไอคอน → ลบ `:root` ที่ไม่ได้ใช้ → ลบข้อความอธิบายที่เจอ (กฎใน CLAUDE.md) → bump `sw.js` · จบแต่ละรอบให้ลบกฎ compat ที่ไม่ใช้แล้ว
1. หน้ารวม: `soon`, `credits`, `run`, `404`, `area` ✅ ย้ายแล้ว (2026-09-30, รอบ 1 — `soon` เป็นต้นแบบ: `data-layout="tool"` + `.page`/`.empty`; `credits` ใช้ `.card`/`.badge`; `run` ใช้ `.card`/`.btn`/`.table`/`.list-row` + ตัดข้อความอธิบายทั้งหมด (desc/inputHint/notes/sub-note); `404` โหลดธีมด้วย `document.write` เพราะถูกเสิร์ฟจากพาธไหนก็ได้; ลบกฎ compat `.tcard`/`.cmp-table`/`.btn.drive` ที่ไม่มีหน้าไหนใช้แล้ว; เพิ่ม baseline `credits`/`area`) · `index` ✅ ย้ายแล้วใน Phase 3 (2026-09-30)
2. ตระกูล invest ✅ ย้ายแล้ว 16 หน้า (2026-09-30, รอบ 2 — ย้ายธีมอย่างเดียว ยังไม่ยุบรวมหน้า ดู Phase 6; คีย์ localStorage/ข้อมูลไม่เปลี่ยน): `invest-thai-stock` เป็นต้นแบบ (`data-layout="tool"` + `.page`/`.stack`/`.card`/`.subnav`/`.tabs`/`.segmented`/`.chip`/`.callout`/`.table`/`.kpi`) · `invest.html` เป็น `data-layout="dashboard"` · เพิ่มคอมโพเนนต์กลางใน `theme.css`: `callout`, `kv`, `status`, `step`, `disclosure`, `crumb`, `subnav`, `chk-list`/`yn-row`, `table.right`, `mini`/`log-*`, `chart-wrap`/`chart-cap`, `cmp`, `tranche`, `light`, `badge.wrap`, `kpi .sub`/`.grow` (จังหวะแนวตั้งในการ์ด `.card > * + *` จำกัดเฉพาะ `body[data-invest-key]` กันหน้ารอบก่อนเปลี่ยน) · สีกราฟทุกหน้าใช้ `chart-theme.js` (Lightweight Charts อ่านผ่าน `lightweight()`/`candles()`, SVG DCA/สปาร์กไลน์/โดนัทอ่าน `get()` แล้ววาดใหม่เมื่อ `onChange`) · ลบพื้นหลังลาย SVG ของโซนลงทุน (`shell.js` `injectInvestBgMotif` + กฎ `.bgmotif`/`body.ome-tool-page[data-invest-key]` ใน `theme.css`) · ตัดข้อความอธิบายตามกฎ CLAUDE.md (การ์ด "อ่านก่อนเอาเงินมาลงทุน", hint ใต้ช่องวางราคา/ตัวเลือกแปลงบาท/เช็กลิสต์, คำศัพท์ที่ควรรู้, disclaimer ท้ายผลย่อ/สัดส่วน/หมายเหตุทองรูปพรรณ) · เพิ่ม baseline ภาพครบ 16 หน้า · **ยังเหลือ:** emoji ธงชาติ/สัญลักษณ์ในไอคอนสินทรัพย์ของ `invest-commodities` (ข้อมูลระบุตัวตน ไม่ใช่ UI)
3. `classroom-law`, `music`, `sports`, `cooking`, `coding`, `typing`
4. `budget`, `text-to-speech`, `doc-check`/`doc-check-file`, `extract-text`
5. `word`, `excel` (เฉพาะกรอบหน้า), `cad`, `sim-objects`, `report-dashboard` (ทีละโมดูล)
6. หน้า React 4 หน้า (`languages`, `legal`, `classroom-business`, `classroom-engineering`): คอมไพล์ Tailwind ล่วงหน้าเป็น CSS ที่ผูกกับ token ด้วย `build-react.sh` (แบบเดียวกับ `build-languages.sh`) → เลิกโหลด Tailwind CDN ตอนรันและลบกฎ `!important` ~125 บรรทัดใน `theme.css`

## Phase 3 — หน้าแรก "วันนี้" + ค้นหาด่วน (M)
**สถานะ (2026-09-30, PR รอตรวจ):** ✅ `index.html` + `index.js` (`data-layout="dashboard"`) · ✅ `palette.js` + `quick-add.js` · ✅ API อ่านใน `tanot-data.js` (`TanotData.read/raw/readIdb/onChange`) · ✅ `tests/today.spec.js` · **ยังไม่ทำ:** Web Push (VAPID) + นัดหมาย/การแจ้งเตือน + สุขภาพบนหน้าวันนี้ (ยังไม่มีข้อมูลต้นทาง)
- `index.html` เป็นแดชบอร์ดส่วนตัว: ใช้จ่ายเดือนนี้เทียบงบ (เทียบช่วงเดียวกันเดือนก่อน), การ์ดที่ต้องทบทวน (ภาษา/กฎหมาย/ธุรกิจ/วิศวกรรม) + วันติดต่อกัน, หุ้นที่ติดตาม (พอร์ตหุ้นไทย/ต่างประเทศ + ราคาล่าสุดจากแคชของหน้าหุ้น — ไม่ยิงเครือข่ายเอง), ไฟล์ล่าสุด (ฉบับร่าง Word/Excel/CAD + รายงาน 5 ฉบับท้าย — Excel/CAD/3D ไม่มีเวลาบันทึกให้เรียงหรือจัดรายการได้ถูก จึงยังไม่ครบ ถ้าจะให้ครบต้องมีรายการ `tanot:recent` ที่ทุกเครื่องมือเขียนตอนบันทึก), ปุ่มเพิ่มด่วน (รายจ่าย/รายรับ/Word/Excel/ค้นหา/เมนู) · ตัดนาฬิกา Nixie และไทล์ทางลัดเดิมออก (เมนูอยู่ที่ลิ้นชัก/palette/`area.html`)
- `palette.js` (⌘/Ctrl+K หรือปุ่มค้นหาบน nav — `shell.js` โหลดไฟล์นี้ตอนใช้ครั้งแรก): ค้นหาเมนูจาก `OME_MENU` (คำค้นไทย/อังกฤษ ใช้ label + keywords + ชื่อกลุ่ม) + คำสั่ง (เพิ่มรายจ่าย/รายรับผ่าน `quick-add.js`, สลับโหมดสว่าง/มืด) + จำหน้าที่เปิดล่าสุด · ต่างจากแผน: ยังไม่ค้น "ข้อมูลในเครื่อง" และยังไม่มีคำสั่ง "ตั้งการแจ้งเตือน" (รอ Web Push)
- Web Push (VAPID) — บน iPhone ต้องติดตั้งเป็นแอปลงหน้าจอโฮมก่อน

## Phase 4 — AI บนคลาวด์ (M) — แก้ปัญหา iPhone ใช้ AI ไม่ได้
**สถานะ (2026-09-30, PR รอตรวจ):** ✅ `ai-client.js` + `functions/api/ai/{chat,summarize,embed,usage}.js` + `functions/_lib/ai.js` · ✅ นับโควตาใน `ai_usage` (Whisper `asr.js` เขียนลงตารางเดียวกัน, เพดาน `AI_DAILY_NEURONS` ใน `wrangler.toml`) · ✅ แคชสรุปใน `ai_cache` แทน Firebase บน pages.dev (`ai-summary-cache.js` เหลือใช้เฉพาะ GitHub Pages) · ✅ ต่อคลาวด์ก่อนแล้ว: วิดเจ็ตแชท (พิมพ์/สรุปหน้า/ไมค์ผ่าน Whisper บนคลาวด์ — iPhone ใช้ได้, เสียงตอบบน iPhone ใช้เสียงของระบบ), สรุปหุ้นไทย/หุ้นต่างประเทศ/ทอง/บิตคอยน์/โภคภัณฑ์, สรุปประชุมในหน้าแปลงเสียง; ทุกจุดถอยไปโมเดลในเบราว์เซอร์เมื่อออฟไลน์/โควตาเต็ม/ล็อกอินหมดอายุ (ยกเว้น iPhone) · ✅ `tests/ai.spec.js` (12+1 เคส, ต่อเข้า CI) · ต่างจากแผน: `ai-client.js` มี `asr`/`ocr` เป็นตัวห่อบางๆ แต่หน้า OCR (`doc-check.js`) และถอดเสียงไฟล์ (`text-to-speech.js`) ยังเรียก `/api/ocr`, `/api/asr` ตรงเหมือนเดิม · แคชคีย์จากเนื้อหาที่ป้อน (ไม่ใช่ "หุ้น+วัน" แบบ Firebase เดิม) · **ยังไม่ทำ/ยังไม่ยืนยัน:** อัตรา Neurons ต่อโทเค็นใน `MODELS` (ตัวเลขจากผลค้นหา ขัดกันเองที่ output ของ qwen3 — เลือกค่าสูงไว้ก่อน) และรูปแบบสตรีมจริงของ SEA-LION/Qwen3 (ตัวแยกวิเคราะห์รองรับทั้ง `response` และ `choices[].delta.content` แต่ยังไม่เคยยิงโมเดลจริง) — ตรวจหลัง deploy ที่ `/api/ai/usage` · `embed` ยังไม่มีหน้าไหนเรียกใช้ (ไว้ใช้ค้นตามความหมายใน Phase ถัดไป) · หน้า `languages`/`classroom-*` ยังเรียก `ai-chat-worker.js` ในเครื่องตรงๆ
- `ai-client.js` เรียกคลาวด์ก่อน: `/api/ai/chat` (ตอบแบบ stream), `summarize`, `embed`, `asr`, `ocr`
- โมเดลภาษาไทยบน Workers AI: `@cf/aisingapore/gemma-sea-lion-v4-27b-it` (ฝึกภาษาไทยมาโดยตรง คุณภาพดีที่สุด) / `@cf/qwen/qwen3-30b-a3b-fp8` (ถูกและเร็ว) / `@cf/baai/bge-m3` (ค้นหาภาษาไทยตามความหมาย)
- นับโควตาฝั่งเซิร์ฟเวอร์ใน `ai_usage` — โควตาฟรีวันละ 10,000 Neurons **ใช้ร่วมกับ Whisper**; แคชสรุปย้ายมาเก็บใน `ai_cache`
- โมเดลในเบราว์เซอร์คงไว้เป็นตัวสำรองตอนออฟไลน์บนคอม

## Phase 5 — ระบบการเรียนรวมศูนย์ (M)
- `learn-core.js`: XP ชุดเดียว (ด้าน, ที่มา, xp), วันติดต่อกันแบบมีวันพัก, เป้ารายวัน
- `fsrs.js`: แยกตัวจัดตารางทบทวนออกมาจาก `classroom-law.js`
- การ์ดจากกฎหมาย/ภาษา/วิศวะ/หนังสือรวมเป็นกองเดียว → หน้าใหม่ `review.html` "ทบทวนวันนี้"
- XP เดิมของแต่ละหน้ารวมเข้าเป็นยอด legacy; วันติดต่อกันใช้ค่าสูงสุดที่มี

## Phase 6+ — ฟีเจอร์ใหม่และหน้าที่ยังไม่ทำ (สลับด้าน; P1 = ทำก่อน … P4 = ความสำคัญต่ำ)

**การทำงาน**
| รายการ | ขอบเขต | ลำดับ | ขนาด |
|---|---|---|---|
| บันทึกงานบำรุงรักษา (ใหม่, ใช้แทนช่อง "รวบรวมข้อมูล") | ทะเบียนอุปกรณ์ + QR, แผน PM นำเข้าจาก sheet `PM_PLAN` ของ est-cost, ใบสั่งงาน/บันทึกความผิดปกติ, ฟอร์มตรวจเช็กออฟไลน์ + รูปเก็บ R2, ส่งออก Excel, ป้อนข้อมูลเข้าโมดูล maintenance ของ report-dashboard | P1 | L |
| เครื่องคำนวณไฟฟ้า (ใหม่) ✅ (2026-10-01, PR รอตรวจ) | แรงดันตก/ขนาดสาย, กระแสลัดวงจร, คาปาซิเตอร์แก้ PF, ค่าความเป็นฉนวน PI/DAR, ระบบกราวด์, protective margin ของกับดักฟ้าผ่า (residual voltage เทียบ BIL) — `electrical.html` + `electrical.js` (หน้า) + `electrical-calc.js` (สูตร/ตาราง/มาตรฐานอ้างอิง ไม่มี DOM) + `tests/electrical.spec.js` · **ต้องตรวจทาน:** ตารางพิกัดกระแสใช้ IEC 60364-5-52 วิธี B1 (BS 7671 4D1A) × 0.87 ที่ 40°C — ตรงกับตาราง 5-20 ของ วสท. ที่ 2.5/4 mm² ส่วนขนาดอื่นยังไม่ได้เทียบกับเล่มจริง; ยังไม่มีตาราง XLPE/อะลูมิเนียม (ตรวจแค่แรงดันตก) | P1 | M |
| เสียงบรรยาย → โน้ต | ข้อความที่ถอดเสียง → สรุปด้วย AI → โน้ตวิศวกรรม + การ์ดทบทวน | P1 | M |
| เปรียบเทียบข้อมูล | เทียบ Excel/CSV ตามคอลัมน์หลัก, เทียบข้อความเอกสาร, ตารางให้คะแนนใบเสนอราคา | P2 | M |
| PowerPoint | โครงเรื่อง/เอกสาร/สรุปประชุม → สไลด์ (PptxGenJS) ตามธีม, ส่งออก pptx/pdf | P2 | M |
| ปรับหน้าเดิม | doc-check: OCR ไฟล์ PDF สแกน (S) · CAD_ROADMAP ข้อ 2.1, 2.2, 2.4 (S), 2.5 fillet/chamfer (L) · report-dashboard: เปลี่ยนชื่อไฟล์ `final43/62`, โหลดโมดูลเมื่อใช้, ใช้ token (M) | P1–P2 | — |

**การใช้ชีวิต**
| รายการ | ขอบเขต | ลำดับ | ขนาด |
|---|---|---|---|
| ภาษี | ดึงรายได้จาก budget + เบี้ยประกัน + SSF/RMF/ThaiESG จากหน้ากองทุน + e-Receipt, กฎภาษีเก็บเป็นไฟล์ JSON แยกปี, จำลอง "ถ้าซื้อเพิ่ม" ช่วงปลายปี, เตือนกำหนดยื่น | P1 | M |
| ประกัน ✅ (2026-10-01, PR รอตรวจ) | ทะเบียนกรมธรรม์ ชีวิต/สุขภาพ/รถ/บ้าน (`insurance.html` + `insurance.js` + `insurance-calc.js` ไม่มี DOM) ซิงก์ผ่าน `tanot-data.js` (`tanot:insurance:policies`, list, idField `id`) · ไฟล์กรมธรรม์เก็บ R2 ผ่าน `functions/api/files.js` (PDF/รูป ≤15 MB, ดัชนีใน D1 `files`; แสดงเฉพาะ `*.pages.dev`) · วันต่ออายุแสดงบนหน้าวันนี้ (การ์ด "ต่ออายุประกัน" ภายใน 60 วัน รวมเลยกำหนด) · เบี้ยลดหย่อนภาษีแยกไว้ใน `tanot:insurance:taxsummary` (`{v:1, years:{ปี ค.ศ.:{raw, ded, annuityCap}}}`) ให้หน้าภาษีอ่าน หรือเรียก `InsuranceCalc.taxSummary(policies, year, {income})` เอง · `tests/insurance.spec.js` · **ต้องตรวจทาน:** เพดานลดหย่อนใน `insurance-calc.js` (ชีวิต 100,000 / สุขภาพ 25,000 / รวม 100,000 / บิดามารดา 15,000 / คู่สมรส 10,000 / บำนาญ min(15% เงินได้, 200,000)) เขียนจากความรู้ทั่วไป ยังไม่ได้เทียบประกาศกรมสรรพากรปีล่าสุด · **ยังไม่ทำ (รอตัวส่งแจ้งเตือนของ Phase 5):** วันต่ออายุ → ตาราง `reminders` / Web Push, เบี้ย → รายการใน budget | P1 | M |
| คลังใบเสร็จ/ประกันสินค้า (ใหม่) | ถ่ายรูป → OCR → รายการใน budget, เตือนวันหมดประกันสินค้า, ติดป้ายลดหย่อนภาษี | P2 | M |
| สุขภาพ | บันทึกสัญญาณชีพ/ผลตรวจสุขภาพเป็นกราฟ, เตือนกินยา, ดึงการออกกำลังกายจากกีฬา | P2 | M |
| ยุบรวมหน้าลงทุน | 16 → ~9 หน้า: หน้าหุ้นเดียวแยกแท็บตลาด, รวมสลากออมสิน/ธ.ก.ส.เป็นหน้าเดียว, `invest-core.js` ใช้ร่วมกัน, มูลค่าสินทรัพย์สุทธิแสดงบนหน้าวันนี้ | P2 | M |
| บันทึกรถ (ใหม่) | พ.ร.บ., ภาษีรถ, นัดเข้าศูนย์ → การแจ้งเตือน | P3 | S |

**การศึกษา**
| รายการ | ขอบเขต | ลำดับ | ขนาด |
|---|---|---|---|
| เนื้อหาห้องเรียนวิศวกรรม | หลักสูตรงานบำรุงรักษาระบบไฟฟ้า ใส่ใน 13 หัวข้อที่มีอยู่ — AI ร่างให้ เจ้าของตรวจทาน | P1 | L |
| วิชากฎหมายเพิ่ม | ทำจากเอกสารประกอบการเรียนของเจ้าของ ตามขั้นตอนใน `internal-notes/` | P2 | L (ทำต่อเนื่อง) |
| พิมพ์ดีด | แป้นเกษมณีชั้น Shift | P2 | S–M |
| หนังสือ | บันทึกการอ่าน, ค้นข้อมูลหนังสือจาก Open Library, ข้อความที่ไฮไลต์ → การ์ดทบทวน | P3 | S–M |

**งานอดิเรก**
| รายการ | ขอบเขต | ลำดับ | ขนาด |
|---|---|---|---|
| ทำอาหาร stage 2 | วางแผนเมนู → รายการซื้อของ → budget | P2 | M |
| กีฬา | แบบทดสอบ + บันทึกการออกกำลังกาย → สุขภาพ | P2 | S–M |
| เกม | จับคู่/แข่งเวลาคำศัพท์จากชุดภาษา, จับคู่มาตรากฎหมาย, แข่งพิมพ์ — XP เข้าระบบการเรียนรวม | P3 | M |
| จำลองคน | แนะนำตัดทิ้ง หรือทำเป็นหุ่นในหน้า sim-objects | P4 | — |

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
4. ✅ **เสร็จแล้ว (2026-09-28)** — ตั้งค่าใน Pages → Variables and secrets ครบ: `OWNER_EMAIL` (Text), `ACCESS_AUD` (Text), `TEAM_DOMAIN` (Text), `ANTHROPIC_API_KEY` (Secret, คีย์ใหม่ชื่อ `tanot-cf-pages` ไม่มีวันหมดอายุ แยกจากคีย์เก่า `tanot-api-key` ที่ Worker OCR เดิมยังใช้อยู่) — ยังไม่ได้สร้างคีย์ VAPID (รอ Phase 3 ตอนทำ Web Push ค่อยทำ ไม่ต้องรีบตอนนี้)
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
6. เพิ่ม origin ของ pages.dev ใน Google OAuth client (Drive) และใน Authorized domains ของ Firebase Auth (ใช้ตอนดึงข้อมูล budget ครั้งเดียว)
7. ต่อ Workers Builds เข้ากับ `workers/scheduler` · ติดตั้งแอปลงหน้าจอโฮม iPhone
8. หลังย้ายข้อมูลครบทั้ง 2 เครื่อง: ลบ Worker เก่า 3 ตัว → เปลี่ยน GitHub Pages เป็น redirect → ภายหลังค่อยลบโปรเจกต์ Firebase

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
