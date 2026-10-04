---
name: tanot-design
description: กฎการออกแบบ UI ของเว็บ Tanot (repo นี้) — token สี/ระยะ/มุม, คอมโพเนนต์กลางใน theme.css, data-layout แต่ละแบบ, ระบบภาพพื้นหลังรายหน้า, ระบบภาษาไทย/อังกฤษ (i18n.js) และวิธีรันตัวตรวจธีม/ภาษา + อัปเดต baseline. โหลดทุกครั้งก่อนแก้หรือสร้าง UI ในไฟล์ .html/.css/.js/.jsx ของหน้าใดๆ (ปุ่ม การ์ด สี ฟอร์ม เลย์เอาต์ ข้อความในหน้า ไอคอน) หรือเมื่อแก้ theme.css / theme-boot.js / shell.js / i18n.js
---

# Tanot design — กฎ UI ของทั้งเว็บ

ทุกหน้าใช้ธีมกลางชุดเดียว: `theme-boot.js` (ตั้งธีม/ภาษา/ภาพพื้นหลังก่อนวาดจอ) → `theme.css` (token + คอมโพเนนต์ + layout) → `i18n.js` (ภาษา) → `shell.js` (เมนู/nav/แผงตั้งค่า). `theme-preview.html` แสดงคอมโพเนนต์ทั้งหมด — เปิดดูก่อนสร้างของใหม่

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
- ratchet: `tests/theme-baseline.json` — CI ล้มเฉพาะเมื่อตัวเลขของหน้า/ชุดไหน **เพิ่มขึ้น**; หน้าใหม่ต้องเป็น 0
- แก้หน้าแล้วตัวเลขลด → อัปเดต baseline ใน PR เดียวกัน:
  - static: `node theme-guards.mjs --update`
  - runtime: `THEME_AUDIT_UPDATE=1 npx playwright test theme-audit.spec.js` (ลดอย่างเดียว)
  - ตั้งใจให้เพิ่ม (หายาก ต้องเขียนเหตุผลใน PR): `--accept` / `THEME_AUDIT_UPDATE=accept`
- ภาพ baseline เปลี่ยน → `npm run test:update` แล้วเปิดดูด้วยตา 390/1100 × สว่าง/มืด

## 8. ขั้นตอนแก้ 1 หน้า (checklist — จากรอบ 2: index, budget, health, car, receipts, insurance)

ทำตามลำดับ ทีละหน้า แล้ว commit แยกต่อหน้า:
1. **ดูตัวเลขของหน้า**: `tests/theme-report/report.html` (หรือ `node` อ่าน `report.json` → `pages['x.html'].configs[...].samples`) — ตัวตรวจ runtime วัดหน้าที่ "ว่าง" เท่านั้น จึงต้องตรวจหน้าที่มีข้อมูลและกล่องที่เปิดอยู่ด้วย: seed `localStorage` แล้วเรียก `window.__tanotAudit.audit()` (ฉีด `tests/theme-audit-page.js`) ที่ 390/1100 × สว่าง/มืด ในทุกสถานะ (ลิสต์มีข้อมูล, dialog ทุกใบ, แท็บทุกอัน)
2. **อ่าน `.html` + `.js` ทั้งไฟล์** แล้วทำรายการ: ปุ่ม/ช่องกรอก/แท็บ/chip ที่ไม่ใช่คอมโพเนนต์กลาง · สี hex/rgb ใน `<style>` · คลาสที่ซ้ำกับคอมโพเนนต์กลาง (`.xx-file`, `.xx-msg`, `.xx-list .list-row .end`, `.xx-dialog` → `.file-row`, `.form-msg`, `.end`, `.dialog-form`) · `.btn` ใน selector ของหน้า (นับเป็นปุ่มนิยามเอง — ใช้ `button` หรือคลาสห่อ) · input ที่ห่มด้วย chip/ไม่มี `.input` · ข้อความอธิบายที่ห้ามมี (หัวรอง, hint ข้างปุ่ม)
3. **ภาษา** (ทำก่อนแก้ธีม ไฟล์เดียวกัน): ทำพจนานุกรม th/en ทีเดียวจากรายการข้อความทั้งหมด — HTML ใส่ `data-i18n` / `data-i18n-attr` (ข้อความที่ปนกับไอคอนให้ห่อ `<span data-i18n>`) · JS ใช้ `T()` · ชื่อเดือน/วัน/วันที่/ตัวเลข/เงิน ใช้ `OME_I18N.months/weekdays/date/number` · ภาษาไทยในพจนานุกรม `th` ต้องเหมือนข้อความเดิมทุกตัวอักษร (spec เดิมค้นข้อความไทย) · ข้อมูลผู้ใช้/ชื่อที่ผู้ใช้ตั้ง/ชื่อเฉพาะ ไม่ต้องแปล
4. **ห้ามแตะรูปแบบข้อมูลที่ซิงก์** (คีย์, ฟิลด์, id) — ถ้าต้องเพิ่มค่าเริ่มต้นในข้อมูลให้เก็บค่าไทย/รหัสเดิม แปลตอนแสดง
5. **ตรวจภาษา**: เปิดหน้าด้วย `ome:lang=en` + ข้อมูลตัวอย่าง เปิดทุกกล่อง/แท็บ แล้วไล่หา text node ภาษาไทยที่มองเห็น (ไม่รวมข้อมูลผู้ใช้) ต้องเหลือ 0 · สลับ en→th→en จากแผงตั้งค่าโดยไม่โหลดหน้าใหม่ — หน้าเปลี่ยนทันที (รวมกราฟ/รายการ/ตัวเลือก)
6. **รัน spec ของหน้านั้น** (ปรับ selector ที่เปลี่ยนคลาสแล้ว — ปรับให้ตรวจพฤติกรรมเดิม ห้ามลบเทสต์), `today.spec.js` ถ้าหน้านั้นมีการ์ดในหน้าวันนี้, `smoke.spec.js`
7. **ตัวตรวจ**: `node repo-guards.mjs` → `npx playwright test theme-audit.spec.js` → ลด baseline (`node theme-guards.mjs --update`, `THEME_AUDIT_UPDATE=1 …`) — ตัวเลขลดอย่างเดียว
8. **visual**: `npm run test:update -- -g "<หน้า>"` แล้วเปิดดูภาพ 390/1100 × สว่าง/มืด ด้วยตา · bump `CACHE` ใน `sw.js`
9. ในรายงาน PR: ตารางตัวเลขก่อน/หลัง + เหตุผลรายจุดของค่าที่ยังไม่เป็น 0 (เช่น ปุ่มที่ไลบรารีสร้าง)
