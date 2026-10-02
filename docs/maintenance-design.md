# บันทึกงานบำรุงรักษา — เอกสารออกแบบ (ROADMAP Phase 6 · การทำงาน · P1 · L)

เอกสารนี้เขียนให้ session ที่ลงมือ (Sonnet 5 medium ตาม ROADMAP) ทำตามได้ทันทีโดยไม่ต้องตัดสินใจเชิงสถาปัตยกรรมเพิ่ม
อ่านคู่กับ `CLAUDE.md` (กฎทั้งหมดในนั้นยังใช้ โดยเฉพาะ **ห้ามมีข้อความอธิบายใน UI**, bump `sw.js` `CACHE`, ลง `credits.html`)
จุดที่ยังไม่ชัดในเอกสาร → เลือกทางที่ง่ายและไม่ทำให้ข้อมูลหาย แล้วจดไว้ในข้อความ commit อย่าเปลี่ยนโครงข้อมูลในหัวข้อ 3 เอง

---

## 0. สิ่งที่เจ้าของตัดสินใจแล้ว (2026-10-02)

| เรื่อง | ตัดสินใจ |
|---|---|
| รหัสอุปกรณ์ | แตกรายตัวตาม `qty` ตอนนำเข้า รหัสอัตโนมัติ `<ตัวย่อสถานที่>-<code>-<เลข 2 หลัก>` เช่น `RN05-ESC-01` แก้เป็นรหัสป้ายจริงทีหลังได้ · ภายในใช้ `id` ถาวรแยกจากรหัส — **QR ผูกกับ `id`** แก้รหัสแล้ว QR ที่ติดไปแล้วไม่เสีย |
| รอบ PM | **ปฏิทินคงที่**: แต่ละรอบมีช่วงเวลาตายตัว ทำช้าไม่เลื่อนรอบถัดไป (ตรงกับสัญญา MA และ PM Compliance) |
| ช่องใบสั่งงาน | ครบทุกกลุ่ม: downtime + ความสำคัญ, ค่าอะไหล่ + ค่าแรง, ผู้รับผิดชอบ/ช่าง, สาเหตุ + วิธีแก้ + อะไหล่ที่ใช้ (นอกเหนือจาก อุปกรณ์/อาการ/สถานะ/วันเวลาแจ้ง-เริ่ม-เสร็จ) |
| ระดับผลตรวจ | ทุกรอบ รายข้อ (ผ่าน/ไม่ผ่าน/ไม่มี หรือค่าที่วัด) · ทะเบียนไม่เกิน ~500 ตัว |

ตัดสินใจเพิ่มในเอกสารนี้ (เหตุผลอยู่ในหัวข้อที่เกี่ยวข้อง): QR เก็บ URL เต็ม · ผลตรวจเก็บเป็น "ใบตรวจรอบ" ต่อ สถานที่×ความถี่×รอบ×เครื่อง ใน IndexedDB แยกฐานข้อมูลรายปี · ใบสั่งงานเป็น header ที่ไม่แก้ + event log ต่อท้ายอย่างเดียว · ไม่แก้ `tanot-data.js` / `functions/api/sync.js` เลย

---

## 1. สำรวจของที่มีอยู่ (ตรวจแล้ว ณ commit `6e252c1`)

### 1.1 est-cost (`tool/est-cost/`, เปิดผ่าน `run.html?tool=est-cost`)
- เป็นสคริปต์ Python รันใน Pyodide (`run.html`) — **ไม่เก็บอะไรใน localStorage/IndexedDB เลย** ข้อมูลอยู่ในไฟล์ input ของผู้ใช้ `input_data_*.xlsx` เท่านั้น → "นำเข้า PM_PLAN" = ให้ผู้ใช้เลือกไฟล์ input เดียวกันนั้นในหน้าใหม่ แล้วอ่านด้วย SheetJS
- สัญญาคอลัมน์ต้องตรงกับ `generate_v5.load_input()` (`tool/est-cost/generate_v5.py` บรรทัด ~247–371) ทุกชีตข้อมูลเริ่ม **แถว 3** (แถว 1–2 เป็นหัวตาราง) ข้ามแถวที่คอลัมน์แรกว่าง:

| ชีต | คอลัมน์ (index เริ่ม 0) |
|---|---|
| `EQUIPMENT` | 0 location (ชื่อสถานี/สถานที่) · 1 system · 2 name_th · 3 name_en · 4 **code** (รหัสประเภทอุปกรณ์ ไม่ใช่รายตัว) · 5 qty · 6 workers · 7 old_code |
| `PM_PLAN` | 0 **code** · 1 (ไม่ได้ใช้) · 2 Daily · 3 Weekly · 4 M1 · 5 M3 · 6 M6 · 7 Annually — ค่าคือ ชม./รอบ/หน่วย ใช้เฉพาะตัวเลข > 0 |
| `PM_ACTIVITY` | 0 code · 3 freq (รหัสภายใน `Daily/Weekly/M1/M3/M6/Annually`) · 4 ข้อความกิจกรรม · 5 กะ (`D`/`N`) · 6 ชม./รอบ สำรอง (งาน CM) |
| `ROUTE` | 0 name (ชื่อสถานี) · 1 lat · 2 lng · 3 circuit · 4 order · 5 km_override · 6 min_override |
| `PROJECT` | คีย์ในคอลัมน์ 0 ค่าในคอลัมน์ 2 — ใช้แค่ `project_name`, `project_short_name` |

- ความถี่ภายใน est-cost: `Daily, Weekly, M1, M3, M6, Annually` (`FREQ_SPEC` บรรทัด ~157) — **หน้าใหม่ใช้รหัสชุดนี้ตรงๆ** ไม่ตั้งรหัสใหม่ (กันแปลงผิด)
- `balance_months()` ของ est-cost กระจายงาน M3/M6/รายปี ให้ชั่วโมงแต่ละเดือนใกล้กัน — หน้าใหม่ทำแบบเดียวกันในระดับอุปกรณ์รายตัว (`MntCalc.assignPhases`, หัวข้อ 4)

### 1.2 report-dashboard โมดูล maintenance
- `report-dashboard.html` รับข้อมูลจาก **ไฟล์ที่อัปโหลด** เท่านั้น: `handleFile()` → `XLSX.read(...,{cellDates:true})` → `onWorkbookParsed(wb, name)` (`report-dashboard.complete.final43.local.js` ~บรรทัด 699) เก็บงานค้างใน IndexedDB `tanot-report-dashboard` (store `current`, `reports` แบบ autoIncrement → registry ตั้ง `sync: []`)
- โมดูล `report-dashboard.maintenance.final1.js` จับคอลัมน์จาก**ชื่อหัวคอลัมน์** (`roleCol`: ตัวพิมพ์เล็กแล้ว `===` หรือ `indexOf`, เอาคอลัมน์แรกที่ตรง) ต้องมี `equipmentno` + (`downtime` หรือ `actstart`/`actend`) และอย่างน้อย 2 แถวที่มีวันที่ ถึงจะแสดงผัง Maintenance Control
- คำที่ใช้แยก PM/CM และสถานะ: `PM_KW` (`pm`, `preventive`, `ตามแผน`…), `CM_KW` (`cm`, `corrective`, `ซ่อมฉุกเฉิน`, `เสีย`…), `DONE_KW` (`เสร็จ`, `ปิดงาน`, `done`…), `LATE_KW` (`ล่าช้า`, `เกินกำหนด`…), `AWAIT_PARTS_KW` (`รออะไหล่`…)
- → ทางเชื่อม: หน้าใหม่ส่งออกชีต `WorkOrders` ที่หัวคอลัมน์ตรงกับคำเหล่านี้ (หัวข้อ 7.2) และ (ขั้นสุดท้าย) ปุ่มเปิดตรงใน report-dashboard ผ่านเส้นทางเดียวกับการอัปโหลดไฟล์ (หัวข้อ 7.3)

### 1.3 ชั้นข้อมูล `data-registry.js` / `tanot-data.js`
- localStorage แบบ `list` = 1 รายการ 1 doc (last-write-wins **ทั้งรายการ**), merge 3 ทางตอน `setItem` กันหน้าที่ถือค่าเก่าลบรายการจากเครื่องอื่น, ค่าที่ถูกแทนด้วยของเครื่องอื่นเก็บใน history (กู้ได้ที่ `data.html`)
- IndexedDB ที่อยู่ใน `IDB[].sync` = 1 record 1 doc · **ข้อสังเกตสำคัญ**: ทุกครั้งที่โหลดหน้าใดก็ได้ในเว็บ `reconcile()` จะใส่ทุก store ที่ซิงก์ลงคิวตรวจ แล้ว `idbDocs()` อ่าน**ทั้ง store** + shadow มาเทียบ (`tanot-data.js` ~บรรทัด 406, 671) และตอนดึงจากเซิร์ฟเวอร์ `applyRemote` ก็อ่านทั้ง store ต่อหน้า 200 docs → store ที่โตไม่หยุดจะทำให้ทุกหน้าช้าลงเรื่อยๆ → ออกแบบให้ store ผลตรวจแบ่งรายปี และซิงก์แค่ปีปัจจุบัน ±1 (หัวข้อ 3.3)
- Blob/ไบนารีไม่ซิงก์ (`encodeSync` โยน error) → รูปต้องไป R2 แล้วเก็บแค่ ref
- `openOrCreate` จะสร้างฐานข้อมูลของหน้าเองเมื่อข้อมูลจากเครื่องอื่นมาถึงก่อนเคยเปิดหน้า โดยใช้ schema ใน registry — **schema ในหน้ากับใน registry ต้องตรงกันทุกตัวอักษร** ถ้าฐานข้อมูลมีอยู่แต่ store ไม่ครบ มันจะไม่แตะเลย
- ห้ามแก้ `tanot-data.js` และ `functions/api/sync.js` ในงานนี้

### 1.4 `functions/api/files.js` (R2)
- `POST /api/files?ns=&ref=&name=` body = ไบต์ไฟล์ → `{id,name,size,mime}` · `GET ?id=` · `DELETE ?id=` · PDF/รูป ≤ 15 MiB · `ns` ต้องอยู่ใน `NAMESPACES` (ตอนนี้มีแค่ `insurance`) · คำขอเขียนที่ `Origin` ไม่ตรงโดเมนถูกปฏิเสธ
- ตาราง D1 `files` มีคอลัมน์ `ns` อยู่แล้ว → **ไม่ต้องมี migration ใหม่** แค่เพิ่ม `'maintenance'` ใน `NAMESPACES`
- ตัวอย่างฝั่ง client ที่ใช้ซ้ำได้: `insurance.js` (`filesAvailable()`, `uploadOne()`)

### 1.5 หน้าวันนี้ (`index.html` / `index.js`) + `learn-core.js`, `insurance-calc.js`
- รูปแบบที่ใช้ต่อ: ไฟล์ตรรกะล้วนแบบ UMD (เช่น `insurance-calc.js`) โหลดใน `index.html` แบบ `defer` ก่อน `index.js` → `index.js` อ่านข้อมูลผ่าน `TanotData.read` / `readIdb` เท่านั้น (ไม่นับเป็น "หน้าถือคีย์") แล้วเรียกฟังก์ชันคำนวณ → วาดการ์ด `section.card.span-6` ด้วย `.list-row` / `emptyHtml(...)` และวาดใหม่เมื่อ `TanotData.onChange`
- ต้องอัปเดตคอมเมนต์หัวไฟล์ `index.js` (รายชื่อคีย์ที่อ่าน) ทุกครั้งที่เพิ่มการ์ด

### 1.6 เมนู
- `shell.js` มีรายการ `maintenance` (หมวดวิศวกรรม, `status: 'soon'`) อยู่แล้ว และ `data-collect` "รวบรวมข้อมูล" (หมวดข้อมูล/รายงาน, soon) ซึ่ง ROADMAP ให้หน้านี้ใช้แทน

---

## 2. ไฟล์ที่จะมี

| ไฟล์ | บทบาท |
|---|---|
| `maintenance.html` | หน้าเดียว `data-layout="app"` 4 แท็บ + มุมมองอุปกรณ์ (เปิดจาก QR) |
| `maintenance.js` | DOM + อ่าน/เขียน storage + คิวรูป (ห้ามมีสูตรวันครบรอบในไฟล์นี้) |
| `mnt-calc.js` | ตรรกะล้วน UMD ไม่มี DOM/storage — `window.MntCalc` ในหน้า, `require()` ใน test · ใช้ร่วมกับ `index.js` และ report-dashboard |
| `mnt-qr.js` | สร้าง QR (SVG) + สแกน (กล้อง/รูป) — `window.MntQR` · โหลด jsQR แบบ lazy |
| `vendor/qrcode-generator/qrcode.js` | qrcode-generator 2.0.4 (MIT) — `dist/qrcode.js` จาก npm tarball ไม่แก้ไฟล์ |
| `vendor/jsqr/jsQR.js` | jsQR 1.4.0 (Apache-2.0) — `dist/jsQR.js` จาก npm tarball ไม่แก้ไฟล์ |
| `tests/maintenance.spec.js` | หัวข้อ 9 |

ชื่อโฟลเดอร์ใต้ `vendor/` ต้องเป็นชื่อแพ็กเกจ เพราะ `tests/repo-guards.mjs` เอาชื่อโฟลเดอร์ไปหาใน `credits.html`

---

## 3. โครงข้อมูล

ทั่วไป: วันที่ = `'YYYY-MM-DD'` เวลาท้องถิ่น · เวลา = ms epoch (`Date.now()`) · id สร้างด้วย `MntCalc.uid(prefix)` = `prefix + Date.now().toString(36) + 4 ตัวสุ่ม base36` เว้นแต่ระบุว่าเป็น id แบบกำหนดได้ (deterministic)

### 3.1 คีย์ localStorage ใหม่ (ทั้งหมดขึ้นต้น `tanot:mnt:` — ตรวจแล้วไม่ชนคีย์เดิม)

| คีย์ | registry | รูปแบบ |
|---|---|---|
| `tanot:mnt:sites` | sync · `list` · idField `id` | สถานที่/สถานี |
| `tanot:mnt:assets` | sync · `list` · idField `id` | ทะเบียนอุปกรณ์รายตัว |
| `tanot:mnt:plans` | sync · `list` · idField `id` | แผน PM ต่อ ประเภท × ความถี่ + รายการตรวจ |
| `tanot:mnt:settings` | sync · blob | ค่าตั้งของโครงการ |
| `tanot:mnt:device` | **cache** | รหัสเครื่องสำหรับ id ของใบตรวจ/event — ต้องเป็น cache (ไม่ย้าย ไม่สำรอง) ไม่งั้นกู้ backup ลงอีกเครื่องแล้วได้รหัสเดียวกัน → doc ชนกัน |
| `tanot:mnt:ui` | local | แท็บ/ตัวกรองที่เปิดค้าง |
| `tanot:mnt:draft` | local | ฟอร์มตรวจที่กรอกค้าง (iOS ปิด PWA ที่อยู่เบื้องหลังบ่อย) |

กฎใน `data-registry.js` ต้องอยู่**เหนือ** `{ prefix: 'tanot:', kind: 'sync' }` (กฎแรกที่ตรงชนะ):
```js
{ key: 'tanot:mnt:device', kind: 'cache' },
{ key: 'tanot:mnt:ui', kind: 'local' },
{ key: 'tanot:mnt:draft', kind: 'local' },
{ key: 'tanot:mnt:sites', kind: 'sync', mode: 'list', idField: 'id' },
{ key: 'tanot:mnt:assets', kind: 'sync', mode: 'list', idField: 'id' },
{ key: 'tanot:mnt:plans', kind: 'sync', mode: 'list', idField: 'id' },
{ key: 'tanot:mnt:settings', kind: 'sync' },
```

**site**
```js
{ id: 's-<hash>',          // deterministic: 's-' + fnv1a36(ชื่อที่ trim + lower) — 2 เครื่องนำเข้าไฟล์เดียวกันได้ id เดียวกัน
  name: 'สถานีบางซื่อ', abbr: 'BSS',   // abbr ใช้ประกอบรหัสอุปกรณ์ (แก้ได้ ไม่เปลี่ยนรหัสอุปกรณ์ที่มีอยู่)
  lat: 13.80, lng: 100.54,           // จาก ROUTE (null ถ้าไม่มี)
  circuit: '', order: null, updatedAt }
```
ตัวย่อเริ่มต้น: ถ้าชื่อขึ้นต้นด้วยโทเคนตัวอักษรอังกฤษ/ตัวเลข 2–6 ตัว (เช่น `RN05 บางซื่อ`) ใช้โทเคนนั้น ไม่งั้น `S` + ลำดับที่พบ 2 หลัก (`S01`) · ต้องไม่ซ้ำกันในทะเบียน

**asset**
```js
{ id: 'e-<hash>' | 'e<uid>',  // นำเข้า: 'e-' + fnv1a36(srcKey) (ชนกันให้เติม '-2'); เพิ่มเอง: MntCalc.uid('e')
  code: 'BSS-ESC-01',          // ไม่ซ้ำ (ไม่สนตัวพิมพ์) — แก้ได้
  name: 'บันไดเลื่อน', type: 'ESC',   // type = code ของ est-cost (ผูกกับแผน PM)
  system: 'E&M', site: 's-…',
  serial: '', brand: '', model: '', installed: '',          // 'YYYY-MM-DD' หรือ ''
  lat: null, lng: null,        // null = ใช้พิกัดของ site
  phase: { M3: 2, M6: 5, Annually: 9 },   // เดือนที่ครบรอบ นับจาก settings.startMonth (1..step) — มีเฉพาะความถี่ที่ type มีแผน
  status: 'active' | 'retired',
  srcKey: 'สถานีบางซื่อ|E&M|ESC|1' | '',   // location|system|code|ลำดับ — ใช้จับคู่ตอนนำเข้าซ้ำ
  missing: false,              // true = ไม่อยู่ในไฟล์ที่นำเข้าล่าสุด (ไม่ลบเอง ให้ผู้ใช้เลือกปลด)
  note: '', updatedAt }
```

**plan** (1 รายการต่อ ประเภท × ความถี่)
```js
{ id: 'ESC|M3',                // deterministic = type + '|' + freq
  type: 'ESC', typeName: 'บันไดเลื่อน', freq: 'M3',
  hours: 2.5,                  // ชม./รอบ/หน่วย จาก PM_PLAN
  shift: 'D' | 'N' | '',
  items: [ { id: 'i1', text: 'ตรวจสภาพราวจับ', kind: 'check' },
           { id: 'i2', text: 'วัดกระแสมอเตอร์', kind: 'num', unit: 'A', min: null, max: 32 } ],
  // id ของ item ห้ามนำกลับมาใช้ใหม่หลังลบ (ผลตรวจเก่าอ้าง id นี้) — สร้างถัดไปด้วย 'i' + (max+1)
  edited: false,               // true = ผู้ใช้แก้แล้ว — นำเข้าซ้ำจะไม่ทับ เว้นแต่ติ๊กเลือก
  updatedAt }
```

**settings**
```js
{ v: 1, startMonth: '2026-10',   // เดือนเริ่มสัญญา — ฐานของรอบ M1/M3/M6/รายปี
  project: '', line: '',          // line → คอลัมน์ Line ใน WorkOrders (report-dashboard แยกตามสาย)
  inspector: '',                  // ชื่อผู้ตรวจเริ่มต้นในฟอร์ม
  labelSize: '3x8' }              // ขนาดป้าย QR ต่อแผ่น A4: '3x8' | '2x5'
```

### 3.2 IndexedDB `tanot-mnt` (version 1) — ใบสั่งงาน
```js
// ใน data-registry.js IDB[]
{ db: 'tanot-mnt', version: 1, stores: { wo: { keyPath: 'id' }, woev: { keyPath: 'id' } }, sync: ['wo', 'woev'] },
```

**wo** — สร้างครั้งเดียว **ไม่แก้อีกเลย** (ทุกการเปลี่ยนแปลงเป็น event)
```js
{ id: MntCalc.uid('w'),
  no: 'CM-261002-K7Q',          // 'CM'|'PM' + '-' + yymmdd + '-' + 3 ตัวสุ่ม base32 (ไม่มีตัวนับต่อเครื่อง จึงไม่ชนข้ามเครื่อง)
  kind: 'cm' | 'pm',
  asset: 'e-…', site: 's-…',
  reportedAt: ms, reportedBy: '',
  symptom: '',                  // อาการที่แจ้ง
  priority: 'high' | 'normal' | 'low',
  fromInsp: { year: 2026, id: '<round id>', items: ['i3'] } | null,
  dev: '<device>', createdAt: ms }
```

**woev** — ต่อท้ายอย่างเดียว · แต่ละเครื่องเขียนแต่ event ของตัวเอง
```js
{ id: woId + '|' + at.toString(36) + '|' + dev,
  wo: woId, at: ms, dev: '<device>',
  set: {                        // เฉพาะช่องที่เปลี่ยนในการบันทึกครั้งนี้
    status: 'open'|'progress'|'parts'|'done'|'cancel',
    assignee, priority, symptom, planFinish /* 'YYYY-MM-DD' */,
    startAt, endAt /* ms */, downtimeH,
    failureMode, cause, action,
    parts: [ { name, qty, unitCost } ],    // ทั้งชุด (แทนที่ชุดเดิม)
    laborCost, otherCost },
  note: '',                     // บันทึกในไทม์ไลน์ (ไม่บังคับ)
  photos: [ PhotoRef ] }
```
สถานะปัจจุบัน = `MntCalc.foldWo(wo, events)`: เรียง event ตาม `at` (เท่ากันตัดสินด้วย `dev`) แต่ละช่องใน `set` ค่าหลังสุดชนะ · `note`/`photos` สะสมเป็นไทม์ไลน์ · `matCost` = Σ qty×unitCost · ลบใบงาน = event `status:'cancel'` (ไม่ลบ doc)

### 3.3 IndexedDB `tanot-mnt-<ปี ค.ศ.>` (version 1) — ผลตรวจเช็ก แยกฐานข้อมูลรายปี

ใน `data-registry.js` (ต่อท้าย `IDB` ด้วยลูป — หน้าเว็บกับ registry ต้องได้ชื่อ/สคีมาเดียวกัน):
```js
// ผลตรวจบำรุงรักษา: 1 ฐานข้อมูลต่อปีของรอบ — ซิงก์เฉพาะปีปัจจุบัน ±1 เพราะ tanot-data อ่านทั้ง store ทุกครั้งที่โหลดหน้า
// ปีที่เก่ากว่านั้นเป็นย้าย/สำรองเท่านั้น (ทั้ง 2 เครื่องมีครบแล้วตอนที่ยังเป็นปีปัจจุบัน) และหน้าเว็บล็อกให้แก้ไม่ได้
var MNT_Y = new Date().getFullYear();
for (var y = 2026; y <= MNT_Y + 1; y++) {
  IDB.push({ db: 'tanot-mnt-' + y, version: 1, stores: { insp: { keyPath: 'id' } }, sync: y >= MNT_Y - 1 ? ['insp'] : [] });
}
```

**insp** = "ใบตรวจรอบ" 1 doc ต่อ สถานที่ × ความถี่ × รอบ × เครื่อง
```js
{ id: site + '|' + freq + '|' + period + '|' + dev,     // deterministic → บันทึกซ้ำในรอบเดิมบนเครื่องเดิม = แก้ doc เดิม
  site: 's-…', freq: 'M3', period: '2026-11', dev: '<device>',
  by: 'ชื่อผู้ตรวจ', at: ms,                              // บันทึกล่าสุด
  rows: {
    'e-…': { start: ms, at: ms,                         // เปิดฟอร์ม / กดบันทึก
             res: { i1: 'ok', i2: 28.4, i3: 'ng', i4: 'na' },   // check → 'ok'|'ng'|'na' ; num → number|null
             note: '', photos: [ PhotoRef ], wo: 'w…' | null } } }
```
- ฐานข้อมูลที่ใช้ = ปีของ `period` (`MntCalc.periodYear`) ไม่ใช่ปีที่กดบันทึก → ทำรอบธันวาคมย้อนหลังในเดือนมกราคมยังลงปีเดิมซึ่งยังซิงก์อยู่
- รอบที่ปี < ปีปัจจุบัน − 1 = อ่านอย่างเดียว (ปุ่มบันทึกถูกปิด)
- ทำไมเป็นใบต่อรอบไม่ใช่ต่ออุปกรณ์: งานรายวันของ 500 ตัวจะเป็น 180,000 doc/ปี — รวมเป็นใบต่อสถานที่ลดลงราว 20 เท่า และตรงกับใบตรวจกระดาษจริง · ทำไมมี `dev` ใน id: 2 เครื่องตรวจรอบเดียวกันได้คนละ doc ไม่ทับกัน — ตอนอ่านรวม `rows` ทุก doc ของรอบนั้น ต่ออุปกรณ์เอาแถวที่ `at` ล่าสุด
- ขนาดโดยประมาณ: แถวละ ~200 B → M1 ขึ้นไปทั้ง 500 ตัว ≈ 2 MB/ปี; ถ้าตรวจรายวันทุกตัวจะ ~35 MB/ปี — เกินที่ออกแบบไว้ ถ้าเจ้าของเริ่มบันทึกรายวันจำนวนมากให้แจ้งก่อน

**PhotoRef**
```js
{ item: 'i3' | null,   // รูปของข้อตรวจนั้น หรือรูปรวม
  id, name, size, mime }        // อัปโหลดแล้ว (R2)
| { item, pending: '<outbox id>' }   // ยังรอส่ง
```

### 3.4 IndexedDB `tanot-mnt-outbox` (version 1, store `q` keyPath `id`) — **ไม่ลง registry**
คิวรูปที่ถ่ายตอนออฟไลน์ (Blob) — ไม่ซิงก์และไม่อยู่ใน snapshot/backup โดยตั้งใจ (ไบนารีทำ backup บวม และเป็นของชั่วคราว) ถ้าล้างข้อมูลเครื่องก่อนส่งรูปจะหายเฉพาะรูปที่ยังไม่ส่ง
```js
{ id: MntCalc.uid('p'), op: 'upload' | 'delete',
  blob, name, mime,                          // upload
  fileId,                                    // delete
  owner: { db: 'tanot-mnt-2026', store: 'insp', id: '<doc id>', asset: 'e-…' }   // หรือ { db:'tanot-mnt', store:'woev', id }
  tries: 0, createdAt }
```

### 3.5 กันสองเครื่องเขียนทับกัน — สรุป
| ข้อมูล | กลไก |
|---|---|
| ผลตรวจ | doc แยกต่อเครื่อง (`dev` ใน id) → ไม่มีวันชน |
| ใบสั่งงาน | header ไม่แก้ + event ต่อท้ายแยกต่อเครื่อง → ชนกันไม่ได้, รวมรายช่องด้วย `foldWo` |
| รูป | รายการที่ถือ PhotoRef ถูกแก้ (pending → id) โดยเครื่องที่สร้าง doc นั้นเท่านั้น |
| sites/assets/plans/settings | list/blob ของ tanot-data: แก้รายการเดียวกันพร้อมกัน 2 เครื่องก่อนซิงก์ → ทีหลังชนะทั้งรายการ ฉบับที่แพ้อยู่ใน history (`data.html`) — ยอมรับได้เพราะทะเบียนแก้นานๆ ครั้ง · id ที่นำเข้าเป็น deterministic จึงนำเข้าไฟล์เดียวกันจาก 2 เครื่องแล้วไม่ซ้ำ |
| การเขียน localStorage | อ่านค่าล่าสุดจาก localStorage ทันทีก่อนเขียนทุกครั้ง (read → แก้ → write) ห้ามถืออาร์เรย์ค้างในหน่วยความจำแล้วเขียนทับทีหลัง |

หน้าตั้ง `window.TANOT_NO_RELOAD_BAR = true` (แบบ `review.js`) แล้ววาดรายการ/ปฏิทินใหม่เองเมื่อ `TanotData.onChange` — ห้ามรีเซ็ตช่องในฟอร์มที่เปิดอยู่

---

## 4. `mnt-calc.js` — API (ตรรกะล้วน)

```
FREQS = ['Daily','Weekly','M1','M3','M6','Annually']
FREQ_LABEL = { Daily:'รายวัน', Weekly:'รายสัปดาห์', M1:'รายเดือน', M3:'ราย 3 เดือน', M6:'ราย 6 เดือน', Annually:'รายปี' }
STEP = { M3:3, M6:6, Annually:12 }

uid(prefix) · fnv1a36(str) · uniqueCode(base, takenSetLowercase) → base | base-2 | base-3 …
periodOf(freq, date)            → period key ของช่วงที่ date ตกอยู่ (ไม่สนว่ารอบนั้นครบกำหนดไหม)
                                   Daily 'YYYY-MM-DD' · Weekly = วันจันทร์ของสัปดาห์ 'YYYY-MM-DD' · ที่เหลือ 'YYYY-MM'
window(freq, period)            → { start:'YYYY-MM-DD', end:'YYYY-MM-DD' }  (M* = ทั้งเดือน)
periodYear(period)              → Number(period.slice(0,4))
dueMonths(freq, phase, startMonth, fromMonth, toMonth) → ['YYYY-MM', …]
                                   M1 ทุกเดือน ≥ startMonth · M3/M6/Annually = startMonth + (phase−1) + k·step, k ≥ 0
periods(asset, plan, settings, fromDate, toDate) → period ที่ครบรอบในช่วง (Daily/Weekly ทุกช่วง ตั้งแต่ startMonth)
assignPhases(assets, plans)     → { [assetId]: { M3, M6, Annually } } แบบโลภ: เรียง (asset,freq) ตามชั่วโมงมาก→น้อย แล้ว id
                                   ให้เดือนที่ชั่วโมงสะสมน้อยสุดในช่วง 1..step (เสมอกันเอาเลขน้อย) — ผลต้องคงที่ทุกครั้ง
                                   ใช้เฉพาะอุปกรณ์ที่ยังไม่มี phase ของความถี่นั้น
doneIndex(inspDocs)             → Map 'assetId|freq|period' → { at, dev, res, late }  (รวมทุกเครื่อง เอา at ล่าสุด)
status(asset, plan, period, done, today) → 'done' | 'late-done' | 'due' | 'overdue' | 'upcoming'
dueList({ assets, plans, settings, done, today, ahead: 7 }) → [{ asset, plan, period, window, state, daysLate }]
     - due      : today อยู่ในช่วงและยังไม่ทำ
     - overdue  : ช่วงล่าสุดที่จบไปแล้วและยังไม่ทำ — เฉพาะ M1 ขึ้นไป (รายวัน/สัปดาห์ที่พลาดไม่ขึ้นเป็นงานค้าง แต่นับใน compliance)
     - upcoming : ช่วงเริ่มภายใน `ahead` วัน
     ข้าม asset ที่ status 'retired' · เรียง overdue (ช้ามากก่อน) → due → upcoming
compliance({ … , from, to, freqs })  → [{ month, site, freq, due, onTime, late, missed }]
                                   นับตามเดือนที่ช่วงรอบจบ · onTime = บันทึกภายในช่วง · late = หลังช่วงจบ
foldWo(wo, events)              → สถานะรวม (หัวข้อ 3.2) + timeline + matCost
splitChecklist(text)            → ['ข้อ 1', …] ตัดตามขึ้นบรรทัดใหม่และ ';' ลบเลขนำหน้า (1. 1) - • ) ตัดช่องว่าง ทิ้งบรรทัดว่าง
                                   ข้อความว่าง → [] (หน้าใส่ข้อเดียว = ชื่อแผน)
fromEstCost(sheets, existing)   → { sites, assets, plans, settingsPatch, report:{ added, updated, missing, skipped }, warnings }
     sheets = { EQUIPMENT, PM_PLAN, PM_ACTIVITY, ROUTE, PROJECT } แต่ละตัวเป็น array of arrays (sheet_to_json header:1)
     existing = { sites, assets, plans } ปัจจุบัน — ไม่ลบอะไร, asset ที่ไม่อยู่ในไฟล์ → missing:true,
     plan ที่ edited:true → ไม่ทับ (ใส่ใน report.skipped), asset เดิมเก็บ code/phase/ช่องที่ผู้ใช้กรอกไว้
reportRows({ assets, sites, plans, settings, inspDocs, wos, woEvents, from, to, pmFreqs }) → { headers, rows }  (หัวข้อ 7.2)
```
`fromEstCost` ไม่เรียก SheetJS เอง (หน้าแปลงไฟล์เป็น array ก่อน) → test ป้อน array ตรงๆ ได้โดยไม่ต้องมีไลบรารี

---

## 5. หน้า `maintenance.html`

โครงตาม `insurance.html` (หัว `<head>`: `theme-boot.js` → `data-registry.js` → `tanot-data.js` → `theme.css`; `shell.js` defer; `auth-gate.js`) · `<body data-layout="app">` · ใช้คอมโพเนนต์กลางของ `theme.css` เท่านั้น (`.tabs`, `.card`, `.list-row`, `.btn`, `.field`, `.segmented`, `.badge`, `<dialog class="dialog">`, `.empty`, `.toast`) ไม่สร้าง `.btn/.card` ของตัวเอง · ไอคอนจาก `icons.svg` — ที่ยังไม่มีให้รัน `node tests/build-icons.mjs qr-code,scan-line,clipboard-check,calendar-clock` (ตรวจชื่อใน lucide-static ก่อน)

**ห้ามมี**: บรรทัดใต้ `<h1>`, การ์ดอธิบาย, ข้อความแนะนำข้างปุ่ม, ขั้นตอนการใช้ — มีได้แค่ empty state, error, คำเตือนค่านอกช่วง, สถานะ "รอส่งรูป N" "ออฟไลน์"

### แท็บ (จำแท็บล่าสุดใน `tanot:mnt:ui`)
1. **อุปกรณ์** — ค้นหา (รหัส/ชื่อ/serial) + ตัวกรอง สถานที่/ระบบ/ประเภท/สถานะ · แถว: รหัส · ชื่อ · สถานที่ · badge งานค้าง · ปุ่ม: เพิ่มอุปกรณ์, สแกน, พิมพ์ป้าย QR (ตามตัวกรองปัจจุบัน หรือที่ติ๊กเลือก)
   - dialog เพิ่ม/แก้: ช่องตาม 3.1 · รหัสซ้ำ = error · "ตำแหน่งปัจจุบัน" (`navigator.geolocation`) · phase เป็น select 1..step เฉพาะความถี่ที่ประเภทนั้นมีแผน · ลบได้เฉพาะอุปกรณ์ที่ยังไม่มีผลตรวจ/ใบงาน ไม่งั้นมีแต่ "ปลดใช้งาน"
   - ส่วนย่อย **สถานที่** (ชื่อ/ตัวย่อ/พิกัด) และ **แผน PM** (ต่อประเภท: ชั่วโมง, กะ, รายการตรวจ — เพิ่ม/ลบ/เรียง/สลับ check↔num + unit/min/max) อยู่ในแท็บนี้แบบ `details.disclosure` หรือ segmented
2. **ปฏิทิน PM** — เลือกเดือน (ค่าเริ่มต้นเดือนนี้) · กลุ่ม: เลยกำหนด / ถึงกำหนด / ภายใน 7 วัน / ทั้งเดือน จัดกลุ่มตามสถานที่ · แถวกดแล้วเปิดฟอร์มตรวจ · ปุ่ม "ตรวจทั้งสถานที่" (เลือกสถานที่ + ความถี่ → ไล่ฟอร์มทีละตัวที่ครบรอบ ถัดไป/ก่อนหน้า บันทึกลงใบตรวจรอบเดียวกัน) · แถบ compliance 12 เดือน (`.kpi` เปอร์เซ็นต์ตรงเวลา/ช้า/พลาด)
3. **ใบสั่งงาน** — ตัวกรองสถานะ (ค่าเริ่มต้น: เปิด/กำลังทำ/รออะไหล่), สถานที่, ความสำคัญ · แถว: เลขใบงาน · รหัสอุปกรณ์ · อาการ · badge สถานะ · อายุงาน · ปุ่ม "แจ้งซ่อม"
   - รายละเอียด: ช่องทั้งหมดจาก `foldWo` + ไทม์ไลน์ · บันทึก = 1 event ที่มีเฉพาะช่องที่เปลี่ยน · ปิดงานแนะนำ downtime = `endAt − reportedAt` (ชม., แก้ได้) · ตารางอะไหล่ (ชื่อ/จำนวน/ราคาต่อหน่วย) รวมเป็นค่าอะไหล่
4. **นำเข้า/ส่งออก** — นำเข้าไฟล์ input ของ est-cost (หัวข้อ 7.1) · ส่งออก Excel (7.2) · เปิดใน "นำเสนอรายงาน" (7.3) · ค่าตั้ง (`settings`)

### มุมมองอุปกรณ์ (`maintenance.html#asset=<id>`)
เปิดจาก QR/รายการ/การ์ดหน้าวันนี้ — แผงเต็มจอบนมือถือ: รหัส ชื่อ สถานที่ ลิงก์แผนที่ (`https://www.google.com/maps?q=<lat>,<lng>` เปิดแท็บใหม่) · รอบที่ครบ/ค้างของอุปกรณ์นี้ + ปุ่ม "ตรวจเช็ก" ต่อความถี่ · ผลตรวจ 10 ครั้งล่าสุด · ใบงานที่ยังเปิด · ปุ่ม "แจ้งซ่อม" · ป้าย QR ของตัวนี้ · `id` ไม่พบ → empty state + ปุ่มสแกนใหม่ · ฟัง `hashchange`

### ฟอร์มตรวจเช็ก (ต้องใช้ได้ออฟไลน์บนมือถือ)
- หัว: รหัส/ชื่อ · select ความถี่ · select รอบ (ค่าเริ่มต้น = รอบค้างเก่าสุด ไม่งั้นรอบปัจจุบัน) · ชื่อผู้ตรวจ (จาก settings)
- รายการ: `check` → `.segmented` ผ่าน/ไม่ผ่าน/ไม่มี · `num` → `input type=number inputmode=decimal` + หน่วย และเตือนทันทีถ้านอก min/max · ปุ่มกล้องต่อข้อ · หมายเหตุ · รูปรวม
- กรอกแล้วเก็บร่างลง `tanot:mnt:draft` ทุกการเปลี่ยน (debounce 400 ms) เปิดฟอร์มเดิมแล้วถามกู้ร่าง · บันทึกสำเร็จแล้วลบร่าง
- บันทึก: read-modify-write doc `insp` ของ (site, freq, period, dev) ในฐานข้อมูลปีนั้น ใส่/แทนที่ `rows[assetId]` · มีข้อ "ไม่ผ่าน" → dialog ถาม "สร้างใบสั่งงาน" (ค่าเริ่มต้น อาการ = รายชื่อข้อที่ไม่ผ่าน, `fromInsp`) แล้วเก็บ `wo` id กลับใน row
- รอบที่ปีถูกล็อก → ช่องทั้งหมด disabled

### รูป → R2
- `<input type="file" accept="image/*" capture="environment">` → ย่อด้วย canvas ด้านยาว ≤ 1600 px, JPEG คุณภาพ 0.8 (แปลง HEIC ของ iPhone ไปด้วย) → ใส่ outbox + PhotoRef `pending` ใน doc → thumbnail จาก `URL.createObjectURL`
- ตัวส่ง (`flushOutbox`): ทำงานเมื่อโหลดหน้า, `online`, หลังบันทึก และทุก 60 วิขณะเปิดหน้า · ทีละรายการ · เฉพาะเมื่อ `filesAvailable()` (คัดลอกจาก `insurance.js`) และ `navigator.onLine` · `POST /api/files?ns=maintenance&ref=<doc id>&name=<รหัสอุปกรณ์>_<itemId>_<เวลา>.jpg` → แก้ PhotoRef ใน doc เจ้าของเป็น `{item,id,name,size,mime}` (read-modify-write ฐานข้อมูลเดียวกัน) → ลบจาก outbox · ล้มเหลว → `tries++` ลองใหม่รอบหน้า (ไม่แสดง error ถ้าแค่ออฟไลน์)
- ลบรูป: pending → ลบจาก outbox · อัปโหลดแล้ว → ใส่ outbox `op:'delete'` แล้ว `DELETE /api/files?id=`
- แสดงรูปที่อัปโหลดแล้วด้วย `/api/files?id=` (ต้องออนไลน์) — ออฟไลน์แสดงไอคอนรูปแทน

### QR
- เนื้อ QR = `location.origin + '/maintenance.html#asset=' + id` (URL เต็ม: สแกนในแอปก็ได้ กล้องมือถือก็เปิดได้ — แต่บน iPhone กล้องระบบจะเปิดใน Safari ซึ่งแยก storage กับแอปบนหน้าจอโฮม ใช้งานออฟไลน์ต้องสแกนจากปุ่มในหน้านี้)
- `MntQR.svg(text, {cell, margin})` = `qrcode(0,'M')` → `addData` → `make` → `createSvgTag({cellSize, margin, scalable:true})` (ทดสอบแล้วกับ 2.0.4: URL ยาว ~70 ตัวอักษร = 37×37 โมดูล) — ไฟล์ `vendor/qrcode-generator/qrcode.js` สร้าง global `qrcode` เมื่อโหลดเป็น `<script>` ธรรมดา
- พิมพ์ป้าย: มุมมองพิมพ์ใน `maintenance.html` (`@media print` ซ่อน nav/แท็บ, `@page { size: A4; margin: 8mm }`) ตาราง 3×8 หรือ 2×5 ต่อแผ่น แต่ละป้าย = QR + รหัสตัวใหญ่ + ชื่อ + สถานที่ → `window.print()`
- สแกน (`MntQR.scan(videoEl)` → Promise<text>): `getUserMedia({video:{facingMode:'environment'}})` (`playsinline muted`) · ถ้ามี `BarcodeDetector` และ `getSupportedFormats()` มี `qr_code` ใช้ตัวนั้น ไม่งั้นโหลด `vendor/jsqr/jsQR.js` ครั้งแรกที่สแกน แล้ววาดเฟรมลง canvas ~8 ครั้ง/วิ เรียก `jsQR(data, w, h, { inversionAttempts: 'dontInvert' })` · ปิดกล้องทุกทางออก · ทางสำรอง: "ถ่ายรูป QR" (`input capture`) แล้วถอดจากภาพนิ่ง · ช่องพิมพ์รหัสเอง
- แปลผล: มี `#asset=` → id · ไม่งั้นเทียบกับ `code`/`id` ตรงตัว (ไม่สนตัวพิมพ์) · ไม่พบ → แสดงข้อความ + สแกนต่อ

---

## 6. เมนู, service worker, ไฟล์ร่วม

- `shell.js`: รายการ `maintenance` → `href: 'maintenance.html'` ลบ `status: 'soon'` เติม keywords `'บำรุงรักษา maintenance pm cm ใบสั่งงาน แจ้งซ่อม ตรวจเช็ก qr อุปกรณ์'` · **ลบ** รายการ `data-collect` (ROADMAP: หน้านี้ใช้แทน)
- `sw.js`: PRECACHE `./maintenance.html`, `./maintenance.js`, `./mnt-calc.js`, `./mnt-qr.js`, `./vendor/qrcode-generator/qrcode.js`, `./vendor/jsqr/jsQR.js` (jsQR ต้อง precache เพราะการสแกนต้องใช้ออฟไลน์) + bump `CACHE` ทุก commit ที่แก้ไฟล์เหล่านี้
- `functions/api/files.js`: `NAMESPACES = ['insurance', 'maintenance']` + แก้คอมเมนต์หัวไฟล์
- `credits.html` (การ์ดแบบเดียวกับ SheetJS):
  - **qrcode-generator** 2.0.4 · MIT · Kazuhiko Arase · ใช้ใน บันทึกงานบำรุงรักษา · github.com/kazuhikoarase/qrcode-generator
  - **jsQR** 1.4.0 · Apache-2.0 · Cosmo Wolfe · ใช้ใน บันทึกงานบำรุงรักษา · github.com/cozmo/jsQR
  - SheetJS มีอยู่แล้ว — เติม "บันทึกงานบำรุงรักษา" ในบรรทัดหน้าที่ใช้
- ดาวน์โหลดไลบรารีจาก npm registry (`https://registry.npmjs.org/qrcode-generator/-/qrcode-generator-2.0.4.tgz`, `…/jsqr/-/jsqr-1.4.0.tgz`) แตกแล้วคัดลอกเฉพาะ `package/dist/qrcode.js` และ `package/dist/jsQR.js` ไม่แก้เนื้อไฟล์ · ใส่คอมเมนต์เวอร์ชันไว้ที่ `<script>`/จุดโหลด ไม่แทรกในไฟล์ vendor

---

## 7. การเชื่อมต่อ

### 7.1 นำเข้าจาก est-cost
- แท็บนำเข้า → เลือก `.xlsx` → โหลด SheetJS แบบ lazy จาก `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js` (URL เดียวกับ report-dashboard จะได้ใช้แคชร่วม; ออฟไลน์ = แสดงสถานะว่าต้องต่อเน็ต) → `XLSX.read(buf, {type:'array'})` → ชีตที่มีแปลงเป็น array of arrays ด้วย `sheet_to_json(ws, {header:1, defval:null})` → `MntCalc.fromEstCost(sheets, existing)`
- ไม่มีชีต `EQUIPMENT` หรือ `PM_PLAN` = error ไม่เขียนอะไร · ไม่มี `PM_ACTIVITY` = รายการตรวจข้อเดียวต่อแผน (warning) · ไม่มี `ROUTE` = พิกัดว่าง
- แสดงพรีวิว: สถานที่/อุปกรณ์/แผน ใหม่ · แก้ · ไม่อยู่ในไฟล์ · ข้าม (แผนที่แก้เอง พร้อม checkbox "ทับ") → กด "นำเข้า" ค่อยเขียน → `assignPhases` เฉพาะอุปกรณ์ใหม่ → ตั้ง `settings.startMonth` (ถ้ายังว่าง = เดือนปัจจุบัน), `project`, `line` (= `project_short_name`) เฉพาะช่องที่ว่าง
- จับคู่ซ้ำ: อุปกรณ์ด้วย `srcKey` (qty เพิ่ม = เพิ่มตัวใหม่ลำดับถัดไป, qty ลด = `missing:true`) · แผนด้วย `type|freq` · สถานที่ด้วย id จากชื่อ
- อ่านไฟล์ของผู้ใช้อย่างเดียว ไม่แก้/ไม่บันทึกไฟล์ และไม่แตะ `tool/est-cost/*`

### 7.2 ส่งออก Excel
dialog: ช่วงวันที่ (ค่าเริ่มต้น 1 ม.ค. ปีนี้ – วันนี้) + ความถี่ที่รวมในแถว PM (ค่าเริ่มต้น M1 ขึ้นไป) → `MntCalc.reportRows` → SheetJS `aoa_to_sheet` (วันที่เป็น `Date` จริง) → `XLSX.writeFile(wb, 'maintenance_<line|project>_<YYYY-MM-DD>.xlsx')`

ชีต — report-dashboard `onWorkbookParsed` ให้คะแนนหัวตารางทุกชีต (`scoreHeaderRow`: คำ `start`, `finish`/`end`, `actual`, `plan`, `task`, `wbs` หลังตัดช่องว่าง) ถ้าคะแนนสูงสุด ≥ 8 จะเปิดชีตนั้นเอง (เสมอกันเอาชีตที่มาก่อน) ไม่งั้นไฟล์หลายชีตจะเด้งตัวเลือก "รวมทุกชีต" → `WorkOrders` ต้องเป็นชีตแรก และ**หัวคอลัมน์ของชีต 2–4 เป็นภาษาไทยทั้งหมด** (คำอังกฤษอย่าง "Pending", "Plan", "Start" จะดันคะแนนชีตอื่นขึ้นมา):
1. **`WorkOrders`** หัวคอลัมน์ **ตามลำดับนี้เป๊ะ** (`Work Order` ต้องมาก่อน `Work Order Type` เพราะ `roleCol` เอาคอลัมน์แรกที่มีคำว่า "work order"):

   | หัวคอลัมน์ | CM | PM (1 แถวต่อ อุปกรณ์×ความถี่×รอบ ที่ครบกำหนดในช่วง) |
   |---|---|---|
   | `Work Order` | `wo.no` | `PM-<code>-<freq>-<period>` |
   | `Work Order Type` | `CM` | `PM` |
   | `Equipment No` | รหัสอุปกรณ์ | รหัสอุปกรณ์ |
   | `Equipment Type` | ชื่อประเภท | ชื่อประเภท |
   | `Subsystem` | system | system |
   | `Location` | ชื่อสถานที่ | ชื่อสถานที่ |
   | `Line` | `settings.line` | `settings.line` |
   | `Priority` | สูง/ปกติ/ต่ำ | ปกติ |
   | `Status` | เปิด / กำลังดำเนินการ / รออะไหล่ / เสร็จ / ยกเลิก — ยังเปิดและเลย `planFinish` = `ล่าช้า` | เสร็จ (ทำในช่วง) / เสร็จ ล่าช้า / ล่าช้า (เลยช่วงยังไม่ทำ) / เปิด |
   | `Failure Mode` | failureMode | ข้อที่ไม่ผ่านคั่นด้วย `; ` |
   | `Plan Start` | reportedAt | ต้นช่วงรอบ |
   | `Plan Finish` | planFinish | ปลายช่วงรอบ |
   | `Actual Start` | startAt | row.start |
   | `Actual End` | endAt | row.at |
   | `Downtime (h)` | downtimeH | 0 |
   | `Material Cost` | matCost | 0 |
   | `Labor Cost` | laborCost | 0 |
   | `Other Cost` | otherCost | 0 |
   | `Assignee` | assignee | ผู้ตรวจ |
   | `Cause` | cause | — |
   | `Action` | action | — |

   ใบงานที่ `status:'cancel'` ไม่ส่งออก · ช่องว่างเป็นเซลล์ว่าง (ไม่ใช่ `'—'`)
2. **`Inspections`** — 1 แถวต่อข้อ: วันที่บันทึก · สถานที่ · รหัส · ชื่อ · ความถี่ · รอบ · ข้อ · ผล (ผ่าน/ไม่ผ่าน/ไม่มี) · ค่า · หน่วย · ผู้ตรวจ · หมายเหตุ · จำนวนรูป
3. **`Assets`** — ทุกช่องของ asset + ชื่อสถานที่ + พิกัดที่ใช้จริง
4. **`Compliance`** — ผล `MntCalc.compliance` รายเดือน × สถานที่ × ความถี่

### 7.3 เปิดตรงใน report-dashboard (ขั้นสุดท้าย, เพิ่มโค้ดแบบ additive)
- ปุ่มในแท็บนำเข้า/ส่งออก → `report-dashboard.html?src=maintenance&from=YYYY-MM-DD&to=YYYY-MM-DD`
- report-dashboard: เพิ่ม `loadWorkbook: onWorkbookParsed` ใน `window.TanotDashboard` · ตอนบูต ถ้ามี `src=maintenance`: โหลด `mnt-calc.js` → อ่านข้อมูลด้วย `TanotData.read` / `TanotData.readIdb` (อ่านอย่างเดียว) → `reportRows` → สร้าง workbook ชีต `WorkOrders` → ถ้ามีข้อมูลเปิดค้างอยู่ให้ถามก่อนแทนที่ → `loadWorkbook(wb, 'maintenance.xlsx')` → ลบ query ออกจาก URL (`history.replaceState`)
- ทั้งหมดผ่านทางเดียวกับการอัปโหลดไฟล์ — ไม่มีคีย์/ฐานข้อมูลใหม่ใน report-dashboard และหน้า maintenance ไม่เปิด `tanot-report-dashboard` เลย

### 7.4 การ์ดบนหน้าวันนี้
- `index.html`: `<script src="mnt-calc.js" defer></script>` ก่อน `index.js` · การ์ดใหม่ `section.card.span-6` หัว "งานบำรุงรักษา" + ปุ่ม `btn ghost sm` ไป `maintenance.html` · body `#mntBody`
- `index.js` `renderMaintenance()` (async): `rd('tanot:mnt:assets'|'plans'|'settings')` + `rdIdb('tanot-mnt-'+Y,'insp')` + `rdIdb('tanot-mnt-'+(Y-1),'insp')` + `rdIdb('tanot-mnt','wo'|'woev')` → `dueList` + `foldWo`
  - แถวสรุปตัวเลข: เลยกำหนด (badge err) · ถึงกำหนด (warn) · ใบงานเปิด
  - รายการ ≤ 5: เลยกำหนดก่อน → ถึงกำหนด: `รหัส · ชื่อ` + `ความถี่ · เลย N วัน / ภายใน dd MMM` → ลิงก์ `maintenance.html#asset=<id>`
  - ไม่มีอุปกรณ์ → `emptyHtml('wrench', 'ยังไม่มีทะเบียนอุปกรณ์', 'maintenance.html', 'บันทึกงานบำรุงรักษา')` · มีอุปกรณ์แต่ไม่มีงาน → empty state "ไม่มีงานค้าง"
  - เรียกใน `renderAll` และเมื่อ `onChange` ที่มีคีย์ `tanot:mnt:*` หรือ `idb:tanot-mnt*`
- แก้คอมเมนต์หัวไฟล์ `index.js` ให้มีคีย์/ฐานข้อมูลที่อ่านเพิ่ม

---

## 8. ลำดับงาน (1 ขั้น = 1 commit, ทุกขั้นต้องผ่านเช็กก่อน commit)

เช็กทุกขั้น: `node --check` ทุกไฟล์ JS ที่แก้ · `cd tests && node repo-guards.mjs` · spec ที่เกี่ยวข้อง · ถ้าแตะหน้า/เมนู → `smoke.spec.js` · ห้ามแตะ test fixture ของคนอื่น

1. **ฐาน** — กฎ registry + IDB ลูปรายปี (3.1–3.3) · `files.js` NAMESPACES · `tests/package.json` เพิ่ม devDependency `"xlsx": "0.18.5"` (ให้ test เสิร์ฟ SheetJS แทน CDN และอ่านไฟล์ที่ส่งออก) แล้ว `npm install` อัปเดต lockfile · `playwright.config.js` เพิ่ม webServer `sync-server.mjs 8129` · รัน `sync.spec.js migrate.spec.js insurance.spec.js` ให้ผ่าน (registry ใหม่ต้องไม่ทำของเดิมพัง)
2. **`mnt-calc.js`** + test หน่วยกลุ่ม A ในหัวข้อ 9
3. **QR** — vendor 2 ไลบรารี + `mnt-qr.js` + `credits.html` + ไอคอนที่ขาด
4. **หน้า + ทะเบียน** — `maintenance.html/js` แท็บอุปกรณ์ (สถานที่, แผน PM), มุมมอง `#asset=`, พิมพ์ป้าย, สแกน · `shell.js` เมนู · `sw.js` PRECACHE + CACHE · ภาพ baseline ใหม่ของหน้านี้ (`npm run test:update` แล้วตรวจภาพก่อน commit — อัปเดตเฉพาะภาพที่เปลี่ยนเพราะงานนี้)
5. **ฟอร์มตรวจ + รูป** — ใบตรวจรอบ, ตรวจทั้งสถานที่, ร่าง, outbox + ตัวส่ง · test กลุ่ม B1–B3
6. **ปฏิทิน + compliance**
7. **ใบสั่งงาน** — wo/woev, foldWo ในหน้า, ไม่ผ่าน → ใบงาน · test B4–B5
8. **นำเข้า/ส่งออก** — 7.1 + 7.2 · test B6–B7
9. **การ์ดหน้าวันนี้** — 7.4 + `today.spec.js` + baseline หน้า index
10. **report-dashboard** — 7.3 + test B8
11. **เอกสาร** — `CLAUDE.md` เพิ่มหัวข้อ "Maintenance log" (คีย์, ฐานข้อมูลรายปี, กฎ dev-in-id, อย่าแก้ schema โดยไม่ bump version ทั้งหน้าและ registry) + บรรทัดคำสั่ง test ใน Commands · `ROADMAP.md` แถวบันทึกงานบำรุงรักษา ✅ · `.github/workflows/deploy-pages.yml` เพิ่ม `maintenance.spec.js` ในขั้น test

push branch แล้วเปิด PR เข้า `main` — ไม่ merge เอง

---

## 9. เทสต์ที่ต้องเขียน — `tests/maintenance.spec.js` (พอร์ต 8129, ทั้งไฟล์ `serial` เพราะ `/__reset`)

**A. `mnt-calc.js` (require ตรง, known-answer)**
1. `periodOf`/`window`: Daily · Weekly เริ่มวันจันทร์ รวมสัปดาห์ข้ามปี (2026-12-28 → `2026-12-28`, ช่วงถึง 2027-01-03) · M1/M3/M6/Annually = ทั้งเดือน · กุมภาพันธ์ปีอธิกสุรทิน
2. `dueMonths`: startMonth `2026-10`, M3 phase 2 → `2026-11, 2027-02, 2027-05…` · M6 phase 6 · Annually phase 12 → `2027-09` · ก่อน startMonth ไม่มีรอบ
3. `assignPhases`: ESC 4 ตัว M3 ชั่วโมงเท่ากัน → 1,2,3,1 · ผสมชั่วโมงต่างกันได้ผลคงที่ · ไม่แตะ phase ที่มีอยู่
4. `dueList` ที่ `today` คงที่: due / overdue (M3 ช่วงก่อนไม่ทำ, `daysLate` ถูก) / upcoming 7 วัน / ทำช้าแล้ว = ไม่อยู่ในรายการ / รายวันที่พลาดเมื่อวานไม่ขึ้นเป็น overdue / asset retired ไม่ขึ้น
5. `doneIndex`: 2 doc คนละเครื่องรอบเดียวกัน → เอา `at` ล่าสุด
6. `compliance`: onTime / late / missed ของเดือนตัวอย่าง
7. `foldWo`: event สลับลำดับ → ผลตาม `at` · `at` เท่ากันตัดด้วย `dev` · parts → matCost · note เรียงเวลา · cancel
8. `splitChecklist`: เลขนำหน้า/บูลเล็ต/บรรทัดว่าง/`;`
9. `fromEstCost` (array ตามคอลัมน์ 1.1): สร้าง site/asset/plan ถูกจำนวน · รหัส `ABBR-CODE-01..n` · id คงที่เมื่อรันซ้ำ · นำเข้าซ้ำ qty+1 เพิ่ม 1 ตัว, qty−1 ตั้ง missing ไม่ลบ · แผน edited ไม่ถูกทับ · code ใน PM_PLAN ที่ไม่มีใน EQUIPMENT → warning · ชีต PM_ACTIVITY ไม่มี → ข้อเดียว
10. `reportRows`: หัวคอลัมน์ตรงตามตาราง 7.2 ทั้งชื่อและลำดับ · แถว CM/PM ค่าตามตัวอย่าง · ช่องว่างเป็นค่าว่าง · ตรวจกับตรรกะ `roleCol` (คัดลอกฟังก์ชัน + รายการคำจาก `report-dashboard.maintenance.final1.js` พร้อมคอมเมนต์อ้างบรรทัด) ว่าทุก role ได้คอลัมน์ที่ตั้งใจ และมีแถวที่มีวันที่ ≥ 2 · คัดลอก `scoreHeaderRow`/`findBestAutoImport` (`report-dashboard.complete.final43.local.js` ~บรรทัด 723–756) มาตรวจ workbook ทั้ง 4 ชีตว่าได้ `WorkOrders` คะแนน ≥ 8 และชีตอื่นคะแนนต่ำกว่า

**B. หน้า (Playwright, `prepare()` จาก helpers, `window.TANOT_SYNC`/`TANOT_FILES` = enabled กับเซิร์ฟเวอร์ 8129, เสิร์ฟ SheetJS ด้วย `page.route` จาก `tests/node_modules/xlsx/dist/xlsx.full.min.js`)**
1. ออฟไลน์: เปิดหน้า → `context.setOffline(true)` → `#asset=<id>` → กรอกทุกข้อ + แนบรูป (`setInputFiles` PNG เล็ก) → บันทึก → reload ยังเห็นผล (doc อยู่ใน `tanot-mnt-<ปี>`, PhotoRef pending, outbox 1 รายการ)
2. กลับออนไลน์ → รูปขึ้น R2 ปลอม (`GET /api/files?id=` ได้ไบต์เดิม), PhotoRef เป็น `{id,…}`, outbox ว่าง · ลบรูป → `DELETE` ถูกเรียก
3. ร่างฟอร์ม: กรอกครึ่งหนึ่ง → reload → กู้ร่างได้ · บันทึกแล้วร่างหาย
4. 2 เครื่อง (2 context): ตรวจอุปกรณ์เดียวกันรอบเดียวกันทั้งคู่ตอนออฟไลน์ → ออนไลน์ซิงก์ → ทั้ง 2 doc อยู่ทั้ง 2 เครื่อง สถานะรอบ = ทำแล้ว · ใบงานเดียวกัน เครื่อง A เปลี่ยนสถานะ เครื่อง B เพิ่มบันทึก → ทั้ง 2 เครื่องเห็นทั้งสองอย่าง · แก้ asset เดียวกันพร้อมกัน → ฉบับหลังชนะ และอีกฉบับอยู่ใน `TanotData.history()`
5. ข้อไม่ผ่าน → dialog สร้างใบงาน → ใบงานมี `fromInsp` และขึ้นในแท็บใบสั่งงาน
6. นำเข้า: สร้าง `.xlsx` ตัวอย่างใน Node ด้วยแพ็กเกจ `xlsx` (5 ชีตตาม 1.1, 2 สถานี, 3 ประเภท) → นำเข้า → จำนวนอุปกรณ์/แผน/รายการตรวจตรง · นำเข้าซ้ำไม่เพิ่มซ้ำ
7. ส่งออก: ดาวน์โหลด (`page.waitForEvent('download')`) → อ่านด้วย `xlsx` ใน Node → มี 4 ชีต, หัว `WorkOrders` ตรง, จำนวนแถว PM/CM ตรงกับข้อมูลที่ seed
8. QR: สร้างป้ายของอุปกรณ์ → ถอดภาพ SVG ที่ render (วาดลง canvas ในหน้าแล้ว `jsQR`) ได้ URL ที่มี `#asset=<id>` · "ถ่ายรูป QR" ด้วยไฟล์ PNG ของ QR → เปิดมุมมองอุปกรณ์นั้น
9. ปีที่ล็อก: seed doc ปี ปัจจุบัน−2 → ฟอร์มรอบนั้น disabled · `TanotRegistry.idbSynced('tanot-mnt-<ปี−2>','insp') === false`, ปีปัจจุบัน `=== true`
10. report-dashboard (ขั้น 10): `report-dashboard.html?src=maintenance` กับข้อมูล seed → `TanotDashboard.getState().columns` มีหัวตาม 7.2 และจำนวนแถวตรง (ไลบรารีกราฟจาก CDN ถูกบล็อกในเทสต์ — ตรวจที่ state ไม่ต้องตรวจกราฟ)

**C. ชุดเดิมที่ต้องผ่าน/อัปเดต**: `smoke.spec.js` (หน้าใหม่เข้าเมนูอัตโนมัติ — ออฟไลน์ ไม่มี console error ไม่ล้นที่ 390px) · `visual.spec.js` baseline ใหม่ของ `maintenance.html` + `index.html` · `today.spec.js` การ์ดใหม่ (seed อุปกรณ์ 3 ตัว: เลยกำหนด/ถึงกำหนด/ทำแล้ว) · `sync.spec.js`, `migrate.spec.js` (registry เปลี่ยน)

---

## 10. ข้อห้าม

- **ห้ามเขียน/ลบ/เปลี่ยนชื่อข้อมูลเดิมของ est-cost และ report-dashboard** — อ่านอย่างเดียว: ไม่เปิด IndexedDB `tanot-report-dashboard`, ไม่แตะ `tanot:tableSizes:v2`/`tanot:dashboardDensity`/คีย์ภาษาของ report-dashboard, ไม่แก้ `tool/est-cost/*` และไม่แก้รายการ `tanot-report-dashboard` ใน registry (est-cost ไม่มีคีย์ในเบราว์เซอร์ — แหล่งข้อมูลคือไฟล์ที่ผู้ใช้เลือก อ่านอย่างเดียว) · การแก้โค้ด report-dashboard ในขั้น 10 ต้องเป็นการเพิ่มเท่านั้น
- ห้ามแก้ `tanot-data.js`, `functions/api/sync.js`, `migrations/*`
- ห้ามใส่ store ผลตรวจ/ใบงานแบบ `autoIncrement` · ห้ามเก็บ Blob ในฐานข้อมูลที่ซิงก์ · ห้ามเปลี่ยน schema IDB โดยไม่ bump `version` ทั้งในหน้าและ registry พร้อมกัน
- ห้ามเก็บรหัสเครื่องใน `local`/`sync` (ต้อง `cache`)
- ห้ามโหลดไลบรารีจาก CDN สำหรับสิ่งที่ต้องใช้ออฟไลน์ (QR) · SheetJS ใช้เฉพาะนำเข้า/ส่งออก
- ห้ามข้อความอธิบายใน UI ทุกรูปแบบ (กฎใน `CLAUDE.md`)
- ห้ามใส่ secret ในไฟล์ใดๆ · ห้ามเพิ่ม `package.json` ที่ root

## 11. สิ่งที่เจ้าของต้องตรวจเองหลัง deploy
1. iPhone (แอปบนหน้าจอโฮม): อนุญาตกล้องแล้วสแกนป้ายที่พิมพ์ได้ · ถ่ายรูปตอนเปิดโหมดเครื่องบินแล้วรูปขึ้นเองเมื่อต่อเน็ต
2. พิมพ์ป้าย QR 1 แผ่นจริง ขนาด/ระยะสแกนใช้ได้
3. นำเข้าไฟล์ input ของ est-cost ตัวจริง 1 ไฟล์ แล้วดูรหัส/ตัวย่อสถานที่ — แก้ตัวย่อให้ตรงกับที่ใช้หน้างานก่อนพิมพ์ป้าย
4. ส่งออกแล้วเปิดใน report-dashboard ได้ผัง Maintenance Control
5. ไม่มีอะไรต้องตั้งใน Cloudflare (ใช้ D1/R2 เดิม ไม่มี migration ใหม่)
