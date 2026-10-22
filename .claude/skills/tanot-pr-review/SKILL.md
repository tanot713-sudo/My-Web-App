---
name: tanot-pr-review
description: เช็กลิสต์ก่อนเปิดหรือรีวิว PR ของเว็บ Tanot (repo นี้) — secret, โมเดล Tanotfin, bump CACHE/PRECACHE, data-registry, i18n ไทย/อังกฤษ, token ธีม, problem log, เทสต์, visual baseline, credits และเงื่อนไข merge. ใช้ทุกครั้งก่อนเปิด PR, ตอนรีวิว PR, หรือก่อนบอกว่างานเสร็จ
---

# เช็กลิสต์ PR — เว็บ Tanot

กฎของเว็บ (CLAUDE.md, tanot-design, skill นี้) ชนะ skill ภายนอกเสมอ

## ความปลอดภัย
- [ ] ไม่มี secret ในไฟล์ใดๆ — `OCR_PIN`, `ANTHROPIC_API_KEY`, `VAPID_PRIVATE_KEY`, `HF_TOKEN` อยู่ใน Cloudflare dashboard เท่านั้น (repo เป็น **public**) · ไม่ใส่ hash ของ secret ด้วย
- [ ] ไม่มี root `package.json` · Functions เรียก API ด้วย `fetch` ธรรมดา
- [ ] problem log (`tanot:media:log`) ไม่มีเนื้อหาผู้ใช้ (ข้อความ ชื่อไฟล์ เสียง)

## โมเดลและไลบรารี
- [ ] โมเดล `Tanotfin/*` โหลดผ่าน `/api/hf/` เท่านั้น (`useHfProxy`) และมีได้แค่ 4 ตัวตาม guard `tanotfin-models` ใน `tests/repo-guards.mjs`: `mms-thai-jori-f5-onnx`, `mms-thai-riko-f5-onnx`, `distill-whisper-th-small-onnx`, `distill-whisper-th-medium-onnx`
- [ ] ไม่มีทางถอยไปเสียง/โมเดลอื่นเมื่อโหลด Jori/Riko ไม่ได้
- [ ] ไลบรารี vendor ไว้เอง ไม่โหลดจาก CDN เพิ่ม; ไลบรารี/โมเดล/API ใหม่ลง `credits.html` (ไทย/อังกฤษ)

## ไฟล์เว็บ
- [ ] แก้ไฟล์ที่ cache-first → bump `CACHE` ใน `sw.js` · ไฟล์ใหม่ที่ต้องใช้ออฟไลน์ใส่ `PRECACHE`
- [ ] แก้ `.jsx` / `.html` ของ 4 หน้า React → รัน `./build-react.sh` แล้ว commit `*.compiled.js` + `react-pages.css`
- [ ] คีย์เก็บข้อมูลใหม่ → กฎใน `data-registry.js` (เหนือ `{prefix:'tanot:'}`); ไม่เปลี่ยนรูปแบบคีย์เดิม
- [ ] แตะ workflow → `name:` ไม่มี `: ` และ `yaml.safe_load` ผ่าน

## UI
- [ ] ข้อความใน UI มีทั้งไทยและอังกฤษ (`i18n.js`) · แปลเฉพาะ UI ไม่แปลเนื้อหาผู้ใช้
- [ ] ใช้ token/คอมโพเนนต์ตาม `tanot-design` (ไม่มี hex/rgb ตรงๆ ไม่นิยามปุ่มเอง) · ไม่มีข้อความอธิบายเพิ่มตามกฎ no-explainer
- [ ] ผ่านกฎหน้าตา (`tanot-design` หัวข้อ 6) · `ui-inspect.sh` (taste-skill `inspect.mjs --app`) 0 FAIL ทุกหน้าที่แก้ สว่าง/มืด และเปิดดูภาพทุกไฟล์แล้ว (`tanot-design` หัวข้อ 0 ข้อ 6)

## เทสต์
- [ ] `node repo-guards.mjs` ผ่าน (ใน `tests/`) และ spec ของส่วนที่แตะผ่าน
- [ ] เทสต์ห้ามโหลดโมเดลจริง (ใช้ transformers.js หลอก)
- [ ] visual baseline เปลี่ยน → ติดป้าย `update-snapshots` → **รอให้บอท commit ภาพเสร็จก่อน** แล้วค่อย push commit (commit เปล่าก็ได้) เพื่อให้ CI รันใหม่ — commit ของบอทไม่ทำให้ CI รันเอง · push ก่อนบอทเสร็จจะชนกับ commit ของบอท

## PR
- [ ] คำอธิบาย PR ตรงกับสิ่งที่แก้จริง บอกสิ่งที่ผู้ใช้ต้องตรวจเองหลัง deploy
- [ ] **merge แบบ squash เฉพาะเมื่อ CI เขียวครบ และเจ้าของพิมพ์ "merge ได้" เท่านั้น** — ไม่ merge เอง
