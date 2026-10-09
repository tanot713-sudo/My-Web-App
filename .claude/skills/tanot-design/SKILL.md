---
name: tanot-design
description: กฎการออกแบบ UI ของเว็บ Tanot (repo นี้) — token สี/ระยะ/มุม, คอมโพเนนต์กลางใน theme.css, data-layout แต่ละแบบ, ระบบภาพพื้นหลังรายหน้า, ระบบภาษาไทย/อังกฤษ (i18n.js) และวิธีรันตัวตรวจธีม/ภาษา + อัปเดต baseline. โหลดทุกครั้งก่อนแก้หรือสร้าง UI ในไฟล์ .html/.css/.js/.jsx ของหน้าใดๆ (ปุ่ม การ์ด สี ฟอร์ม เลย์เอาต์ ข้อความในหน้า ไอคอน) หรือเมื่อแก้ theme.css / theme-boot.js / shell.js / i18n.js
---

# Tanot design — กฎ UI ของทั้งเว็บ

ทุกหน้าใช้ธีมกลางชุดเดียว: `theme-boot.js` (ตั้งธีม/ภาษา/ภาพพื้นหลังก่อนวาดจอ) → `theme.css` (token + คอมโพเนนต์ + layout) → `i18n.js` (ภาษา) → `shell.js` (เมนู/nav/แผงตั้งค่า). คอมโพเนนต์ทั้งหมดอยู่ใน `theme.css` — ดูที่นั่นก่อนสร้างของใหม่

## 1. Token ที่ต้องใช้ (ห้ามเขียนสี hex/rgb ตรงๆ ในหน้า)

| ใช้ทำอะไร | token |
|---|---|
| พื้นหน้า / การ์ด / พื้นรอง (ในการ์ด, หัวตาราง) | `--ome-surface-0` / `--ome-surface-1` / `--ome-surface-2` |
| ตัวอักษรหลัก / รอง (≥ 4.5:1 ทุกพื้น) | `--ome-text-1` / `--ome-text-2` |
| ตัวอักษรจาง (placeholder, ไอคอนประดับ) — **ไม่ใช้กับข้อความที่ต้องอ่าน** (~3:1) | `--ome-text-3` |
| เส้นขอบการ์ด/เส้นคั่น (ตกแต่ง) | `--ome-border` |
| ขอบ control (input/select/ปุ่ม outline/segmented) ≥ 3:1 | `--ome-border-strong` |
| พื้นปุ่มหลัก/แถบเลือก/วงโฟกัส + ตัวอักษรบนพื้นนั้น | `--ome-accent` + `--ome-on-accent` |
| ตัวอักษรสีเน้น (ลิงก์ ป้าย แท็บที่เลือก) / พื้นอ่อน | `--ome-accent-strong` / `--ome-accent-soft` |
| สถานะ: พื้นอ่อน + ตัวอักษร | `--ome-ok|warn|err|info-soft` + `--ome-ok|warn|err|info-ink` (ห้ามใช้ `--ome-ok/--ome-warn` เป็นสีตัวอักษร) |
| ปุ่มลบ | `--ome-err-fill` + `--ome-on-err` |
| มุม | `--ome-radius-sm|md|lg|pill` · การ์ด `--ome-card-r` |
| เงา (ระดับความสูง) | `--ome-shadow-1` การ์ด/กล่องบนพื้น · `-2` เมนู/ป๊อปโอเวอร์ · `-3` dialog |
| ระยะ / ตัวอักษร | `--ome-sp-1..7` (ฐาน 4px) · `--ome-fs-xs..3xl` |
| สีกราฟ | `--ome-chart-1..8` เรียงตายตัว ห้ามวนเกิน 8 + `chart-theme.js` (ห้าม hardcode สีกราฟใน JS) |

ค่าทุกสีเน้น (teal/blue/violet/orange/graphite) × สว่าง/มืด ถูกตั้งให้ผ่านเกณฑ์ข้างบนแล้ว — ถ้าแก้ค่าใน `theme.css` ต้องรัน `theme-audit.spec.js` ซ้ำ และอัปเดตตารางคอนทราสต์ในคอมเมนต์หัวบล็อก tokens

## 2. คอมโพเนนต์กลาง (ใช้คลาสนี้ ห้ามนิยามเอง)

- ปุ่ม: `.btn` (+ `.primary` / `.ghost` / `.danger`, ขนาด `.sm` / `.lg`, `.icon`; สถานะกด `.on`/`.active`/`aria-pressed="true"`) — **ห้ามสร้าง `.xxx-btn` หรือนิยาม `.btn` ใหม่ใน `<style>` ของหน้า**
- ฟอร์ม: `.field` (label + input/select/textarea) / `.frow` · ช่องเดี่ยว `.input` `.select` `.textarea`
- กล่อง: `.card` + `.card-head` · `.kpi-grid`/`.kpi` · `.list`/`.list-row` · `.table-wrap`/`.table` (`.num` = ชิดขวา+tabular-nums) · `.callout` · `.kv` · `details.disclosure`
- แถวรายการ: `.list-row` มี `.lead` (ไอคอน) · `.grow` (`.title` + `.meta`) · **`.end`** (ป้าย/จำนวนเงิน/ปุ่มชิดขวา — จอ ≤ 640px ตัดลงบรรทัดใหม่เอง) · `.amt` (จำนวนเงินชิดขวา) — ห้ามเขียน `.xxx-list .list-row .end` เอง
- ฟอร์มใน dialog: `<dialog class="dialog dialog-form">` (กว้าง 600px + เลื่อนในกล่อง + ระยะระหว่างช่อง) · `label.check` (กล่องติ๊กในบรรทัด) · `.form-msg` (ข้อความ error ใต้ฟอร์ม `role="alert"` ว่าง = ซ่อน) · `.file-list` > `.file-row` (`a` + `.sz` + ปุ่มเอาออก) · `.sub-head` (หัวรองในการ์ด) · `.kpi-value small` (หน่วยท้ายตัวเลข KPI)
- แดชบอร์ดรวม/หน้าหมวด (รอบ 3): `.pill` (ป้ายสถานะตามความเร่ง `.err/.warn/.info/.ok` กว้างขั้นต่ำเท่ากัน) · `.meter` (+ `.ok/.warn/.err`, `.sm`) + `.meter-row`/`.meter-list` · `.card.fill` + `.card-fill-body` + `.card-foot` (กล่องคู่ที่ใส่ `margin-top:auto` ให้ส่วนท้ายชิดล่างเท่ากัน; ใส่ใน `.grid` + `.span-6` ซึ่ง stretch สูงเท่ากันที่ ≥ 900px) · `.strip` (`.two/.three/.four`) > `.strip-cell` (`.k/.v/.s`) · `.dots` > `.dotcol` > `.dot.done/.rest/.miss/.today` · `.spark` (SVG เส้นเล็ก path.spark-area/.spark-line + i.spark-dot สีจาก `--ome-chart-1`) · `.list.plain` (+ `.cols-2`) · `.todo-row` (`.pill` | `.grow` | `.end`) · `.empty.compact` (ข้อความชวนเริ่ม 1 บรรทัด + ปุ่มเดียว จัดกลางแนวตั้งในกล่อง) · hub: `.tile.row` + `.tile-ic` + `.tile-text`, `.tile-group` ใน `.tile-cols`, `.tile-latest`
- เลือก/สลับ: `.tabs`/`.tab` · `.segmented > button` · `.chip` · `.lang-toggle` · `.subnav`
- อื่นๆ: `.badge` · `.empty` · `.toolbar` · `.dropzone` · `.spinner` · `.status` · `.crumb` · `<dialog class="dialog">`
- JS กลาง: `tanotConfirm(msg, {danger})` · `tanotConfirmDelete(what)` · `tanotAlert(msg)` · `tanotToast(msg, 'ok'|'err')`
- ไอคอน: `<svg class="ome-icon"><use href="icons.svg#i-ชื่อ"/></svg>` จาก `icons.svg` (เพิ่มด้วย `node tests/build-icons.mjs a,b`) — **ไม่ใช้ emoji เป็นไอคอน/หัวข้อ**
- เป้ากดบนจอแคบ ≥ 40px (คอมโพเนนต์กลางขยายให้เองที่ ≤ 700px)

## 3. data-layout (ใส่ที่ `<body>`, เนื้อหาอยู่ใน `<main class="page">`)

| ค่า | ใช้กับ | หมายเหตุ |
|---|---|---|
| `tool` | เครื่องมือทั่วไป | คอลัมน์เดียว max 960px |
| `app` | editor เต็มจอ (word/excel/cad/slides/maintenance/sim-objects) | สูงเท่าจอ เลื่อนภายใน · ภาพพื้นหลังเป็นแถบหัวหน้า |
| `reader` | บทเรียน/เนื้อหายาว | ~72ch, `.prose` |
| `dashboard` | หน้าวันนี้/budget/health/invest | กริด 12 คอลัมน์ `.grid` + `.span-N` · ภาพพื้นหลังเป็นแถบหัวหน้า |
| `hub` | หน้ารวมไทล์ | `.tiles`/`.tile` |

## 4. ภาพพื้นหลังรายหน้า

- แผนที่หน้า → กลุ่มภาพอยู่ที่ `BG_GROUPS` ใน `theme-boot.js` ที่เดียว (หน้าใหม่ = เพิ่มชื่อหน้าในกลุ่มที่เหมาะ; `invest*.html` เข้ากลุ่ม invest อัตโนมัติ; ไม่อยู่ในแผนที่ = ไม่มีภาพ)
- ไฟล์ `assets/backgrounds/<กลุ่ม>-light.webp` / `-dark.webp` — เปลี่ยนภาพ = แทนไฟล์อย่างเดียว (ภาพควรว่างฝั่งซ้าย วัตถุชิดขวา); กลุ่มใหม่ = เพิ่มไฟล์ 2 ไฟล์ + กฎ 2 บรรทัดใน `theme.css` (repo-guards ตรวจ)
- ภาพอยู่ชั้นหลังสุด (`html::before` ภาพ, `html::after` scrim) — **ห้ามตั้ง background ให้ `<html>`** และอย่าใส่พื้นทึบเต็มจอให้ wrapper ของหน้า (ภาพจะหาย) · ตัวอักษรที่อยู่บนพื้นโดยตรงต้องผ่าน 4.5:1 (ตัวตรวจวัดจากพิกเซลจริง) ถ้าไม่ผ่านให้ย้ายเข้า `.card` หรือใช้ `--ome-text-1/2` ไม่ใช่ลด scrim
- **ความเข้มภาพ 4 ระดับ** ที่แผงตั้งค่า "ความเข้มภาพพื้นหลัง": ปิด / อ่อน / **กลาง (ค่าเริ่มต้น)** / ชัด — `OmeTheme.set('bg', 'off'|'soft'|'mid'|'strong')` เก็บใน `ome:bg` (ค่าเดิม on → กลาง) · `theme-boot.js` ตั้ง `html[data-bg-level]` ก่อนวาดจอ · แต่ละระดับคุม `--ome-bg-scrim-m` / `--ome-bg-scrim` (ความทึบ scrim ที่ 40% / ขอบขวา) และ `--ome-bg-filter` (saturate/contrast/brightness บนภาพ) แยกสว่าง/มืด/จอแคบ ใน `theme.css` · ปรับความชัดต้องแก้ที่ตัวแปรของระดับ ไม่ใช่รายหน้า
- **ตัวอักษรบนพื้นหน้าโดยตรงไม่พึ่ง scrim ทึบ**: ชื่อหน้า (`.page-head > h1` / `.head-text`), `.crumb`, `.tabs` และ `.btn.ghost` นอกการ์ดได้ "พื้นรอง" โปร่ง (`--ome-bg-plate` ของ surface-0 + blur) อัตโนมัติ เมื่อมีภาพ — ถ้าหน้าไหนมีตัวอักษรอื่นวางบนพื้นหน้าโดยตรงแล้วตัวตรวจ "ตัวอักษรบนภาพ" ไม่ผ่านที่ระดับ "ชัด" ให้ย้ายเข้า `.card` หรือเพิ่มตัวเลือกใน rule พื้นรอง ไม่ใช่เพิ่ม scrim
- จอ ≤ 700px: แถบภาพหัวหน้าสูง 300px (เห็นภาพทั้งความสูง) · หน้า dashboard/app บนจอกว้าง 280px ครอปที่ `--ome-bg-pos-y`
- ตัวตรวจทดสอบทุกกลุ่มภาพที่ระดับ "อ่อน" และ "ชัด" ด้วย (`bg-level:` ใน `theme-audit.spec.js`) · รันชุดเต็มที่ระดับเดียว: `THEME_AUDIT_BG=strong npx playwright test theme-audit.spec.js`
- ไม่แสดงตอนพิมพ์ · sw.js แคชแยก (`ome-bg-v1`)

## 5. ภาษาไทย/อังกฤษ (`i18n.js`)

```js
OME_I18N.add('mypage', { th: { save: 'บันทึก', hi: 'สวัสดี {name}' }, en: { save: 'Save', hi: 'Hello {name}' } });
OME_I18N.t('mypage.hi', { name: 'Tan' });        // ไม่มีคำแปลอังกฤษ → ไทย; ไม่มีคีย์เลย → '' (ไม่แสดงชื่อคีย์)
OME_LANG.onChange(function (lang) { render(); }); // หลาย listener ได้ + event 'ome:langchange'
OME_I18N.date(d) / .number(n) / .money(n)          // th = พ.ศ. (th-TH) · en = ค.ศ. (en-GB)
OME_I18N.label(menuNode)                           // label / labelEn ของ MENU
var T = OME_I18N.scope('mypage', { th: {…}, en: {…} }); T('hi', { name })   // add() + ฟังก์ชัน t ผูก ns (ใช้ใน JS ของหน้า)
OME_I18N.months('long'|'short') / .weekdays('short') // ชื่อเดือน (0 = ม.ค.) / วัน (0 = อาทิตย์) ตามภาษา — ห้ามเขียนอาร์เรย์เดือนไทยเอง
OME_I18N.catName(cat)                              // ชื่อหมวด budget: หมวดตั้งต้นที่ไม่ได้แก้ชื่อแปลตามภาษา · หมวดที่ผู้ใช้ตั้งคืนชื่อเดิม
```
- HTML: `<h2 data-i18n="mypage.title">หัวข้อ</h2>` · `<input data-i18n-attr="placeholder:mypage.q,aria-label:mypage.q">` — แปลใหม่เองตอนสลับ (`OME_I18N.apply(root)` หลังวาด DOM ใหม่) และแตะเฉพาะคีย์ที่ `add()` แล้ว
- ส่วนกลาง (shell/palette/วิดเจ็ต AI) ใช้ `data-ome-t` แทน `data-i18n` เพราะ 15 หน้าเดิม (word, excel, cad, doc-check, electrical, tax, report-dashboard, music, sports, cooking, coding, typing, invest-*) วน `[data-i18n]` ทั้งหน้าด้วยพจนานุกรมของตัวเอง — หน้าเหล่านี้ยังใช้ `window.omeApplyLang` ได้เหมือนเดิม (OME_LANG.set เรียกให้)
- JS สร้าง HTML เอง: ทุกข้อความผ่าน `T('key')` (รวม toast/confirm/ข้อความว่าง/หัวคอลัมน์/ตัวเลือกใน select/aria-label/title) แล้วลงทะเบียน `OME_LANG.onChange(fn)` ให้วาดส่วนนั้นใหม่ — กล่องที่เปิดค้างอยู่ไม่ต้องวาดใหม่ · ป้ายที่มาจากไฟล์ `*-calc.js` (ชนิดกรมธรรม์ ความถี่ ฯลฯ) แปลที่หน้าตามรหัสโดยไม่แก้ calc (known-answer test ผูกกับค่าไทยเดิม) · ค่าที่เก็บลง storage ห้ามเปลี่ยนตามภาษา แปลเฉพาะตอนแสดง
- **ข้อความสถานะ/ข้อความแจ้งที่ค้างบนจอ** (บรรทัดสถานะ, จำนวนตัวอักษร, error ของการอ่านไฟล์): ตั้งผ่าน `OME_I18N.live(el, fn)` — `fn()` คืนข้อความตามภาษาปัจจุบัน แล้ววาดซ้ำเองตอนสลับภาษาสด (`live(el, null)` = เลิกตาม) · error จาก `file-reader.js` พก key (`err.frKey`) → ใช้ `TanotFileReader.errorText(err)` ในฟังก์ชันที่ส่งให้ `live` (ห้ามเก็บ `err.message` ที่แปลแล้วไว้) · หน้าที่มีพจนานุกรมเดิม (word/excel/doc-check) จำ `t()` ล่าสุดใน `setStatus` แล้วแปลซ้ำ (`refreshStatus`)
- **ฟังการสลับภาษา**: หน้าใหม่/ที่ย้ายแล้วใช้ `OME_LANG.onChange(fn)` เท่านั้น (ไม่กำหนด `window.omeApplyLang` เอง) + ปุ่มสลับของหน้าเรียก `OME_LANG.set(next)` + ตั้ง `window.OME_PAGE_LIVE_LANG = true` (ตัวตรวจ "สลับภาษาสด" ใช้ธงนี้) · `aria-label` ของ `.lang-toggle` ใช้ `data-i18n-attr="aria-label:lang.toggle"` + `data-i18n-skip` (ชื่อภาษา "ไทย" คือชื่อเฉพาะ) · **ภาษาของ UI แยกจากภาษาของเนื้อหา**: ตัวเลือกภาษาตรวจคำผิด/OCR/ถอดเสียง/เสียงอ่าน, prompt ที่ส่ง AI, ไฟล์ที่ส่งออก (docx/xlsx/pptx) ไม่เปลี่ยนตาม `ome:lang` — สลับ UI แล้วค่าที่ผู้ใช้เลือกไว้ต้องคงเดิม (`docs-audit.spec.js` ตรวจ)
- `฿` (U+0E3F) ไม่นับเป็นภาษาไทยในตัวตรวจ (สัญลักษณ์สกุลเงิน)
- เมนูใหม่ใน `shell.js` ต้องมีทั้ง `label` และ `labelEn`
- แปลเฉพาะ UI (ปุ่ม ป้าย หัวข้อ เมนู ข้อความแจ้ง placeholder) — เนื้อหาบทเรียน/ตัวบทกฎหมาย/ข้อมูลผู้ใช้/ข่าว/ชื่อเฉพาะ ใส่ `data-i18n-skip` ที่กล่องที่ครอบ

## 6. กฎที่ห้ามละเมิด

- ห้ามสี hex/rgb ตรงๆ ใน `<style>` ของหน้า (ใช้ token) · ห้ามนิยามปุ่มเอง · ไอคอนจาก `icons.svg` ไม่ใช้ emoji
- **ห้ามข้อความอธิบายใน UI** (กฎเด็ดขาดใน CLAUDE.md): ไม่มีบรรทัดใต้ h1, การ์ด "เรียนรู้", hint ข้างปุ่ม, cheat-sheet คีย์ลัด, ย่อหน้า "วิธีใช้" — เว้นแต่ผู้ใช้ขอในข้อความนั้น
- กันหน้าตา "แบบ AI":
  - ไม่ใช้ gradient ม่วง-น้ำเงิน (หรือ gradient ประดับใดๆ) เป็นพื้นการ์ด/หัวข้อ/ปุ่ม
  - ไม่ใส่เงา + มุมโค้งเท่ากันทุกกล่อง — ใช้ระดับความสูง (shadow-1/2/3) ตามหน้าที่ กล่องซ้อนในการ์ดใช้ `--ome-surface-2` ไม่มีเงา
  - ไม่ใช้ emoji เป็นหัวข้อ/ไอคอน
  - ไม่จัดทุกอย่างกึ่งกลาง — ข้อความและฟอร์มชิดซ้าย กึ่งกลางเฉพาะสถานะว่าง (`.empty`)
  - ไม่ใช้แถบสีแปะข้างการ์ด (border-left หนาสีเน้น) — ใช้ `.badge`/`.callout` แทน
  - ตัวเลขที่เรียงเป็นคอลัมน์ใช้ `font-variant-numeric: tabular-nums` (`.num` / `.table.right` / `.kv .v` มีให้แล้ว)

## 7. ตัวตรวจ (รันก่อน commit ทุกครั้งที่แตะ UI)

```bash
cd tests && npm ci && npx playwright install chromium   # ครั้งแรก
node repo-guards.mjs                                     # รวม theme-guards.mjs (static): สี hex + ปุ่มนิยามเองต่อหน้า
npx playwright test theme-audit.spec.js                  # runtime: axe คอนทราสต์, ตัวอักษร/ขอบ control, คอมโพเนนต์กลาง,
                                                         # เป้ากด 390px, ตัวอักษรบนภาพพื้นหลัง, กดสำรวจไม่มี error, ไทยหลุดโหมด EN, สลับภาษาสด
```
- รายงาน: `tests/theme-report/report.html` (เปิดในเบราว์เซอร์ — ตารางต่อหน้า + selector + ค่าคอนทราสต์ของทุกจุด), `report.json`, `summary.md` (15 หน้าที่แย่ที่สุด) — ไม่ commit (CI อัปโหลดเป็น artifact `theme-report`)
- **ตอนมีข้อมูล**: ตัวตรวจแยกต่อกลุ่ม (เป้า = 0 ไม่ใช้ ratchet) — ลงทุน `invest-audit.spec.js` · เอกสาร `docs-audit.spec.js` (word/excel/slides/extract-text/doc-check/doc-check-file/compare/text-to-speech: seed ข้อมูล + mock `/api` ทุกตัว + CDN → `tests/node_modules` (luckysheet ฯลฯ) · เปิดทุกแท็บ/dialog/ผลลัพธ์ × 360/390/1100 × สว่าง/มืด · EN ไทยหลุด 0 · สลับสด th→en→th) — `DOCS_AUDIT_ONLY=<regex หน้า>` เลือกหน้า · `DOCS_AUDIT_DUMP=<โฟลเดอร์>` เขียนผลทุกจุดแทนการล้ม (⚠️ เทสต์ "live switch" ยังล้มจริงในโหมดนี้) · `DOCS_AUDIT_NOALLOW=1` ดูจุดที่ `ALLOW` ซ่อนไว้ (ปุ่ม/ช่องที่ Luckysheet สร้างเอง) · modal/ลิ้นชัก/ป็อปอัพที่ทับหน้าจะวัดเฉพาะในกล่อง
- **ตอนมีข้อมูล — กลุ่มวิศวกรรม/รายงาน/ภาษี** (รอบ 6): `tests/eng-audit.spec.js` + `tests/eng-fixtures.js` (cad · electrical · maintenance · run (ประเมินราคา) · report-dashboard · tax; seed ข้อมูลทุกหน้า, mock `/api` ทุกตัว (ocr/ai ถูกเรียก = ล้ม), Pyodide/Google ปลอม, CDN → `tests/node_modules` (chart.js/echarts/frappe-gantt/gridstack/html2canvas/jspdf เป็น devDependency ไว้ให้ report-dashboard) · report-dashboard อัปโหลด xlsx ทุกแม่แบบ (11 ตัว) ผ่าน `#fileInput` แล้วเปิดทุกส่วน/โหมด/เมนู/dialog/ป็อปโอเวอร์/มุมมองกำหนดเอง/บันทึก-รีโหลด-ดำเนินการต่อ/ตัวเลือกชีต) — ตัวแปร `ENG_AUDIT_ONLY` · `ENG_AUDIT_DUMP` · `ENG_AUDIT_NOALLOW` · `ENG_AUDIT_TRACE=1` · ใส่ `overlay: '<selector>'` ให้ fixture ที่มีแผงลอย/ลิ้นชักที่ทับหน้าเพื่อวัดเฉพาะในแผง · รีโหลดหน้ากลางสถานะต้อง `addScriptTag` ตัวตรวจใหม่
- **ตอนมีข้อมูล — กลุ่มการศึกษา** (รอบ 7A): `tests/edu-audit.spec.js` + `tests/edu-fixtures.js` (review · books · classroom-law · classroom-business · classroom-engineering; seed การ์ดถึงรอบจากทุกแหล่ง/หนังสือ/ความคืบหน้าห้องเรียน/สมุดโน้ตกฎหมาย, mock `/api` ทุกตัว + Open Library ปลอม, เปิดทุกแท็บ/บท/dialog + ทำทบทวน/ข้อสอบ/Mock/Drill จนจบ) — ตัวแปร `EDU_AUDIT_ONLY` · `EDU_AUDIT_DUMP` · `EDU_AUDIT_NOALLOW` · selector ของสถานะห้ามพึ่งข้อความไทย (spec รันซ้ำด้วย `ome:lang=en`) ใช้ id / `data-k` · **หน้า React**: คลาสกลางใช้ได้เพราะ `tests/react-build/input.css` คืนค่าด้วย `all: revert-layer` (preflight ของ Tailwind ไม่อยู่ใน layer) — เพิ่มชื่อคลาสกลางใหม่ที่หน้า React ใช้ต้องเพิ่มในลิสต์นั้น (เฉพาะตัวเลือกคลาสเดี่ยว) แล้วรัน `./build-react.sh`
- **ช่องกรอก/ปุ่มที่ประกอบด้วย `innerHTML`** (ป็อปโอเวอร์/กล่องโต้ตอบของ report-dashboard): เรียก `TanotReportUtils.controls(root)` ใส่ `.input/.select/.textarea` ให้ทีเดียวแทนแก้ทีละสตริง · กลุ่มปุ่มเลือกค่า (ปีเดือน/มาตราส่วน) = `.segmented` (`.active` นับเป็นสถานะกดเหมือน `.on`/`aria-pressed`) · การ์ดกดได้ (`role=button`) = `.stat-card` · ปุ่มเล็กในตาราง/หัวกล่อง = `.btn.ghost.icon.sm` (CSS ของหน้ากำหนดแค่ขนาด/ตำแหน่ง ไม่กำหนดสี/ขอบ) แล้วที่ ≤ 700px ขยายเป็น 40px ในบล็อกมือถือของหน้า · สีข้อความสถานะใช้ `--ome-*-ink` (ไม่ใช่ `--ome-ok/warn/err/info` ที่เป็นสีเติม) · `.btn` ปรากฏใน selector ของ CSS หน้าถือเป็น "ปุ่มนิยามเอง" ของ theme-guards (เขียนเป็น `> button`)
- **หน้าที่มีพจนานุกรมของตัวเองต้องไม่ทับของส่วนกลาง**: ลูป `[data-i18n-attr]` ของหน้า ต้องแตะเฉพาะคีย์ที่อยู่ในพจนานุกรมหน้า (shell ใช้ `data-i18n-attr="aria-label:shell.…"` บนปุ่มเมนู — ถ้าหน้าเขียนทับด้วยคีย์ที่ไม่มี จะได้ `aria-label="shell.openMenu"`)
- ratchet: `tests/theme-baseline.json` — CI ล้มเฉพาะเมื่อตัวเลขของหน้า/ชุดไหน **เพิ่มขึ้น**; หน้าใหม่ต้องเป็น 0
- แก้หน้าแล้วตัวเลขลด → อัปเดต baseline ใน PR เดียวกัน:
  - static: `node theme-guards.mjs --update`
  - runtime: `THEME_AUDIT_UPDATE=1 npx playwright test theme-audit.spec.js` (ลดอย่างเดียว)
  - ตั้งใจให้เพิ่ม (หายาก ต้องเขียนเหตุผลใน PR): `--accept` / `THEME_AUDIT_UPDATE=accept`
- ภาพ baseline เปลี่ยน → `npm run test:update` แล้วเปิดดูด้วยตา 390/1100 × สว่าง/มืด

## 8. มือถือ (กฎตรวจรอบ 3 — ใช้ทุกรอบหลังจากนี้)

**กฎมือถือเป็นของกลางตั้งแต่รอบ 5** (`theme.css` บล็อก `@media (max-width:700px)` ท้ายกลุ่ม "จังหวะแนวตั้งภายในการ์ด"): ทุก `body[data-layout]` ได้ `--ome-fs-xs/sm` = 14px, ช่องว่างของ `.tabs/.subnav-*/.card-head/.toolbar` ≥ 8px, `.segmented > button` ไม่ตัดบรรทัด, ตารางใน `.table-wrap` ตรึงคอลัมน์แรก, `.lang-toggle` สูง ≥ 40px · **พื้นที่แก้เอกสารของหน้า app/เนื้อหาที่ผู้ใช้แก้ใส่ `data-doc-area`** (กระดาษของ word, กริดของ excel, ภาพสไลด์ `.sl-s`): ในกล่องนั้นคืนค่า token เดิม และตัวตรวจ `mobileFont` ไม่นับ (ขนาดตัวอักษรเป็นส่วนของไฟล์ ไม่ใช่กรอบหน้า)

ตรวจที่ **360px และ 390px ทุกหน้า** (รอบ 9 เลิก `NARROW_360` — ค่าเริ่มต้นของ `theme-audit.spec.js`) ทั้งสว่าง/มืด · 6 ตัวชี้วัด (ratchet + รายงานแบบเดียวกับกฎเดิม; หน้าที่แก้ในรอบนั้นต้องเป็น 0):

| ตัวชี้วัด | ผิดเมื่อ |
|---|---|
| `mobileFont` | ข้อความเนื้อหา (p, li, td, label, span ในเนื้อหา) < **14px** · ข้อความรอง/ป้าย/ปุ่ม < **12px** · h1 > **28px** · h2 > **22px** |
| `mobileOverflow` | ตัวหน้าเลื่อนแนวนอน หรือ element เลยขอบจอ (ยกเว้นอยู่ใน container ที่ตั้ง `overflow-x:auto/scroll/hidden` เอง เช่น `.table-wrap`, `pre`) |
| `mobileClip` | ข้อความถูกตัด (`scrollWidth > clientWidth` ในกล่องที่ overflow ไม่ visible) โดยไม่มี `text-overflow:ellipsis` ที่ตั้งใจ และไม่มี `title`/`aria-label` · **และตัวเลขที่ถูกตัดกลางตัวข้ามบรรทัด** (เช่น "118/7 \| 6" — ตรวจด้วย `Range.getClientRects` ของแต่ละก้อนตัวเลข ต้องอยู่บรรทัดเดียว) |
| `mobileRowBreak` | ปุ่มท้ายแถว (`.list-row`/`.todo-row` ที่มี `.end`) ตกลงไปอยู่ใต้เนื้อหา — ปุ่มต้องอยู่บรรทัดเดียวกับเนื้อหา ชิดขวา |
| `mobileCrowd` | เป้ากด 2 อันขอบห่างกัน < **8px** (ไม่นับ: ปุ่ม AI ลอย, ลิงก์ในบรรทัด, ตัวควบคุมติดกันโดยออกแบบ `.segmented`/`.lang-toggle`, แถวกว้าง ≥ 60% ของจอและสูง ≥ 44px เรียงซ้อนกัน) — เสริมกฎเป้ากด ≥ 40px เดิม (`targetSize`) |
| `mobileAlign` | พี่น้อง `.card` / `.grid > *` / `.list-row` / `.tile` / `.kpi` / `.todo-row` ที่เรียงซ้อนแล้วขอบซ้าย-ขวาไม่ตรง (> 2px) หรือวางแถวเดียวกันแล้วกว้างไม่เท่ากัน (> 2px) |

ขนาดตัวอักษรที่ใช้ (token มีให้แล้ว — อย่า hardcode px): **เนื้อหา 15px** (`--ome-fs-base`) · **ข้อความรอง 13–13.5px** (`--ome-fs-sm` 13.5; `--ome-fs-xs` 12.5 ใช้กับป้าย/หัวคอลัมน์เท่านั้น) · **ต่ำสุด 12px** (ไม่มีข้อความที่อ่านได้ต่ำกว่านี้ — `.badge` 12px คือเพดานล่าง) · **หัวข้อบนจอแคบ h1 22–24px, h2 ≤ 20px**
- **ตัวเลข + หน่วยห้ามขาดกลางตัว**: ห่อก้อนตัวเลขด้วย `<span class="n">118/76</span> <small>mmHg</small>` (`.n` = `white-space:nowrap`) — หน่วยขึ้นบรรทัดใหม่ทั้งก้อนได้ · **ห้ามใช้ `overflow-wrap:anywhere` กับตัวเลข** (ตัวการที่ทำให้ขาดกลางตัว) · ตัวเลขใหญ่ใน `.strip-cell .v` ลดขนาดด้วย `clamp()`/container query และถ้ายาวเกินช่อง ให้เรียงช่องเป็นแถว (`.strip.three.long`) ไม่ใช่ตัด/ล้น
- **แถวรายการที่มีปุ่มท้าย (หน้าแรก/กล่องที่ใช้ `.list.plain` และ `.todo-row`)**: ปุ่มอยู่บรรทัดเดียวกับเนื้อหาชิดขวาเสมอ (คอลัมน์ `[เนื้อหา minmax(0,1fr)] [ปุ่ม auto]`, ไม่ `flex-wrap`) ข้อความตัดบรรทัดในคอลัมน์ของมันเอง · pill สถานะอยู่บรรทัดบนของข้อความ (`grid-template-areas:"pill act" "body act"`) · ปุ่มบนมือถือใช้ขนาด sm (สูง 32px) แต่พื้นที่กดต้อง ≥ 40px ด้วย `::after{content:"";position:absolute;inset:-5px -2px}` (ตัวตรวจ `targetSize` นับขนาด `::after` ให้) · ข้อความรองในแถวที่ต้องคุมความสูง: `.meta.one` (บรรทัดเดียว ellipsis) + `title` ของเต็ม + `data-i18n-skip` ถ้าเป็นข้อมูลบทเรียน
- **ความยาวหน้า**: หน้าแรก 390px ตอนมีข้อมูล seed ชุด `tests/home-fixtures.js` ต้อง ≤ 3,200px (`home.spec.js` ตรวจ) — รายการยาวให้ตัดแสดงก่อน + ปุ่ม "ดูทั้งหมด (n)" กางในที่ (`.todo-toggle`) แทนการเรียงยาว
- ตัวเลขใหญ่ (`.big`, `.kpi-value`) ไม่ใช่หัวข้อ แต่ที่ 360px ต้องไม่ทำให้ล้นกล่อง — ลดขนาดด้วย `clamp()` + `white-space:nowrap` ไม่ใช่ปล่อยให้ล้น/ขาด
- กล่องที่มีปุ่มหลายอัน: ระยะระหว่างปุ่ม ≥ 8px (`gap:var(--ome-sp-2)` ขึ้นไป) · แถวรายการที่มีปุ่มท้าย (`.list-row .end`) ตัดลงบรรทัดใหม่เองที่ ≤ 640px — ห้ามบีบปุ่มให้ชิดกัน
- จอแคบวางเป็นคอลัมน์เดียว: การ์ดพี่น้องต้องกว้างเท่ากัน ขอบซ้าย-ขวาตรงกัน (อย่าใช้ `align-self:flex-start`/`width:fit-content` กับ `.card`)
- **กฎมือถือรอบ 9 (รอบสุดท้าย — ใช้กับทุกหน้า/ทุกงานใหม่)**:
  - **ปุ่มแชท AI ลอย (`.ome-ai-fab`, `ai-chat-widget.js`) ห้ามบังปุ่มท้ายหน้า**: วิดเจ็ตเว้นที่ท้ายหน้าให้เอง (ฟุตเตอร์กลางได้ padding-bottom = `--ome-fab-space` ที่ ≤ 700px · body ถูก `theme.css` บังคับ padding-bottom:0 จึงเว้นที่ที่ฟุตเตอร์) และหลบลงเมื่อเลื่อนลง/โผล่เมื่อเลื่อนขึ้นหรืออยู่ใกล้บนสุด (ฟัง scroll แบบ capture ทุกตัวเลื่อน รวมกล่องที่เลื่อนในตัวของหน้า app) · หน้า `data-layout="app"` (สูงเท่าจอ ซ่อนฟุตเตอร์) ที่มีปุ่ม/แถบสถานะชิดมุมขวาล่างต้องเว้นมุมนั้นเอง (padding-right/ขนาด `--ome-fab-space`) — `mobileFabOverlap` เลื่อนทุกตัวเลื่อนไปท้ายสุดแล้วบังคับให้ปุ่มโผล่ ห้ามมี element กดได้ทับปุ่ม · ปุ่มนี้นับใน `mobileCrowd` ด้วย (เอาข้อยกเว้นออกแล้ว) · ห้ามเพิ่มปุ่ม/แถบลอยตัวที่สองมุมขวาล่างโดยไม่เว้นที่ให้กัน
  - **ช่องกรอก**: `font-size ≥ 16px` ที่ ≤ 700px (iOS ซูมหน้าเองตอนแตะช่องที่เล็กกว่า 16px) — `theme.css` ท้ายไฟล์บังคับให้ทุก `input/select/textarea` (ยกเว้น `[data-doc-area]`, Luckysheet, `#xlCellEditor`, แผงแชท) ด้วย `max(16px,1em)!important` จึงไม่ต้องกำหนดเอง · ใช้ชนิดให้ถูก: อีเมล `type=email`, เบอร์ `type=tel`, จำนวนเงิน/ตัวเลข `inputmode="decimal"` (หรือ `numeric` ถ้าเป็นจำนวนเต็ม) บน `type=text` ที่ต้องการจุดทศนิยม/เลขนำหน้า 0, `autocomplete` ให้ email/tel/password/url (ใช้ `off` ได้ถ้าไม่ใช่ข้อมูลส่วนตัวของผู้ใช้) — ตัวตรวจ `mobileInput`
  - **กล่อง/ลิ้นชัก/เมนู**: ต้องปิดได้ทั้งปุ่มปิดและแตะนอกกล่อง (`shell.js` ผูกให้ทุก `<dialog class="dialog">` — กล่องที่ห้ามปิดโดยไม่ตั้งใจใส่ `data-keep-open`), Esc ปิด, ไม่ล้นจอ, เนื้อหายาวเลื่อนในกล่อง (ไม่ใช่ทั้งหน้า), ปุ่มท้ายกล่อง (`.dialog-foot`) ไม่ตกขอบ/ไม่ถูกตัด — ตัวตรวจ `mobileDialog` (วัดทุกกล่องที่เปิดอยู่ตอนวัด) + ใน `theme-audit.spec.js` เทสต์ `dialogs:` กดปุ่มปลอดภัยทีละปุ่มแล้วแตะนอกกล่อง (`dialogClose`) · ลิ้นชัก/กล่องที่ทำเอง (`role=dialog`) ใช้ `max-height:calc(100dvh - …)` + `overflow:auto` ไม่ใช่ `100vh` (แถบ URL ของ Safari)
  - **safe-area** (รอยบาก/แถบโฮมของ iPhone): ทุกหน้าต้องมี `viewport-fit=cover` (repo-guards ตรวจ) · element `position:fixed` ที่ติดขอบ (top:0 / bottom / left / right) ต้องมี `env(safe-area-inset-*)` ในกฎเดียวกัน · แถบ sticky ล่างต้องมี `padding-bottom` ที่รวม `env(safe-area-inset-bottom)` · แถบหัวกลาง/ลิ้นชัก/แผงตั้งค่า/palette รวมแล้ว · `html` ได้ padding ซ้าย/ขวา = inset แนวนอนอัตโนมัติ — ข้อยกเว้นของ guard เป็นรายชื่อพร้อมเหตุผลใน `tests/repo-guards.mjs` (บล็อก "safe-area")
  - **แนวนอน (844×390)**: ทุกหน้าไม่ล้นแนวนอน · แถบหัว/ลิ้นชักเมนู/แผงตั้งค่าอยู่ในจอและเลื่อนถึงรายการสุดท้ายได้ (แผงตั้งค่าเลื่อนในกล่อง `max-height:calc(100dvh - …)`) · dialog เลื่อนได้ไม่หลุดจอ — เทสต์ `landscape:` ใน `theme-audit.spec.js` (ตัวชี้วัด `landscape`)
  - **ขนาดจอที่ตรวจ**: 360 + 390 ทุกหน้า (ค่าเริ่มต้นของ `theme-audit.spec.js` ตั้งแต่รอบ 9 — ไม่มี `NARROW_360` แล้ว) + 412 (Android ทั่วไป) / 430 (iPhone Pro Max) ด้วย `THEME_AUDIT_WIDTHS=412,430` · ชุด `*-audit.spec.js` ตอนมีข้อมูลตรวจที่ 360/390
- รันเฉพาะส่วนมือถือของหน้าเดียว: เปิดหน้าที่ viewport 390/360 แล้วเรียก `window.__tanotAudit.mobile({shell:false})` (ฉีด `tests/theme-audit-page.js`) — คืน sample ของทั้ง 6 ตัวชี้วัดพร้อม selector
- เพิ่มกฎใหม่ในอนาคต: เติม baseline เฉพาะตัวชี้วัดที่ยังไม่มีด้วย `THEME_AUDIT_UPDATE=seed npx playwright test theme-audit.spec.js` (ไม่แตะค่าเดิม)

## 9. ขั้นตอนแก้ 1 หน้า (checklist — จากรอบ 2: index, budget, health, car, receipts, insurance · ขั้น "มือถือ" เพิ่มรอบ 3)

ทำตามลำดับ ทีละหน้า แล้ว commit แยกต่อหน้า:
1. **ดูตัวเลขของหน้า**: `tests/theme-report/report.html` (หรือ `node` อ่าน `report.json` → `pages['x.html'].configs[...].samples`) — ตัวตรวจ runtime วัดหน้าที่ "ว่าง" เท่านั้น จึงต้องตรวจหน้าที่มีข้อมูลและกล่องที่เปิดอยู่ด้วย: seed `localStorage` แล้วเรียก `window.__tanotAudit.audit()` (ฉีด `tests/theme-audit-page.js`) ที่ 390/1100 × สว่าง/มืด ในทุกสถานะ (ลิสต์มีข้อมูล, dialog ทุกใบ, แท็บทุกอัน)
2. **อ่าน `.html` + `.js` ทั้งไฟล์** แล้วทำรายการ: ปุ่ม/ช่องกรอก/แท็บ/chip ที่ไม่ใช่คอมโพเนนต์กลาง · สี hex/rgb ใน `<style>` · คลาสที่ซ้ำกับคอมโพเนนต์กลาง (`.xx-file`, `.xx-msg`, `.xx-list .list-row .end`, `.xx-dialog` → `.file-row`, `.form-msg`, `.end`, `.dialog-form`) · `.btn` ใน selector ของหน้า (นับเป็นปุ่มนิยามเอง — ใช้ `button` หรือคลาสห่อ) · input ที่ห่มด้วย chip/ไม่มี `.input` · ข้อความอธิบายที่ห้ามมี (หัวรอง, hint ข้างปุ่ม)
3. **ภาษา** (ทำก่อนแก้ธีม ไฟล์เดียวกัน): ทำพจนานุกรม th/en ทีเดียวจากรายการข้อความทั้งหมด — HTML ใส่ `data-i18n` / `data-i18n-attr` (ข้อความที่ปนกับไอคอนให้ห่อ `<span data-i18n>`) · JS ใช้ `T()` · ชื่อเดือน/วัน/วันที่/ตัวเลข/เงิน ใช้ `OME_I18N.months/weekdays/date/number` · ภาษาไทยในพจนานุกรม `th` ต้องเหมือนข้อความเดิมทุกตัวอักษร (spec เดิมค้นข้อความไทย) · ข้อมูลผู้ใช้/ชื่อที่ผู้ใช้ตั้ง/ชื่อเฉพาะ ไม่ต้องแปล
4. **ห้ามแตะรูปแบบข้อมูลที่ซิงก์** (คีย์, ฟิลด์, id) — ถ้าต้องเพิ่มค่าเริ่มต้นในข้อมูลให้เก็บค่าไทย/รหัสเดิม แปลตอนแสดง
5. **ตรวจภาษา**: เปิดหน้าด้วย `ome:lang=en` + ข้อมูลตัวอย่าง เปิดทุกกล่อง/แท็บ แล้วไล่หา text node ภาษาไทยที่มองเห็น (ไม่รวมข้อมูลผู้ใช้) ต้องเหลือ 0 · สลับ en→th→en จากแผงตั้งค่าโดยไม่โหลดหน้าใหม่ — หน้าเปลี่ยนทันที (รวมกราฟ/รายการ/ตัวเลือก)
6. **รัน spec ของหน้านั้น** (ปรับ selector ที่เปลี่ยนคลาสแล้ว — ปรับให้ตรวจพฤติกรรมเดิม ห้ามลบเทสต์), `today.spec.js` ถ้าหน้านั้นมีการ์ดในหน้าวันนี้, `smoke.spec.js`
7. **ตัวตรวจ**: `node repo-guards.mjs` → `npx playwright test theme-audit.spec.js` → ลด baseline (`node theme-guards.mjs --update`, `THEME_AUDIT_UPDATE=1 …`) — ตัวเลขลดอย่างเดียว
8. **มือถือ** (รอบ 3 + รอบ 9): ดูตัวชี้วัด `mobile*` ทั้ง 9 ตัว (6 ตัวเดิม + `mobileInput/mobileDialog/mobileFabOverlap`) ที่ 390 และ 360 (+ แนวนอน `landscape:`) × สว่าง/มืด ทั้งตอนว่างและตอนมีข้อมูล (seed) + ทุกกล่อง/แท็บที่เปิดอยู่ — แก้จนเป็น 0 (ขนาดตัวอักษร/ระยะ/การเรียงตามหัวข้อ 8) · เปิดดูภาพ 390/360 ด้วยตา
9. **visual**: `npm run test:update -- -g "<หน้า>"` แล้วเปิดดูภาพ 390/1100 × สว่าง/มืด ด้วยตา — ถ้าเครื่องที่ทำงานเรนเดอร์ฟอนต์ไม่ตรง CI (visual ใน CI ล้มเฉพาะหน้าที่แก้) ให้ติดป้าย `update-snapshots` ที่ PR ให้ CI สร้างภาพเอง (`.github/workflows/update-visual.yml`) · bump `CACHE` ใน `sw.js`
10. ในรายงาน PR: ตารางตัวเลขก่อน/หลัง **ต้องมีคอลัมน์มือถือ** (`mobileFont/Overflow/Clip/Crowd/Align/RowBreak` ที่ 390 และ 360 + ความสูงหน้าที่ 390 ถ้าเป็นหน้ายาว) + เหตุผลรายจุดของค่าที่ยังไม่เป็น 0 (เช่น ปุ่มที่ไลบรารีสร้าง)
