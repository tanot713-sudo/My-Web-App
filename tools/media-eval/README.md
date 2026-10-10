# media-eval — วัดความแม่น/ความเร็วของการถอดเสียงและ OCR

สคริปต์ Node สำหรับรัน **ในเครื่องเจ้าของ** (ไม่อยู่ใน CI — เอนจินในเบราว์เซอร์ต้องดาวน์โหลดโมเดลจาก Hugging Face และเอนจินคลาวด์มีค่าใช้จ่าย)
ใช้เทียบผลก่อน/หลังเปลี่ยนโมเดลหรือการตั้งค่า (Section 3 ของ "ปรับปรุงเสียง/OCR" ใน ROADMAP — ตอนนี้วัดโหมดใหม่ได้: WebGPU/WASM ในเบราว์เซอร์ และคลาวด์แบบขนาน+เหลื่อม)

- **CER** (character error rate) — ตัดช่องว่างทิ้งก่อนเทียบ (ภาษาไทยไม่เว้นวรรคระหว่างคำ แต่ละเอนจินเว้นวรรคไม่เหมือนกัน)
- **WER** (word error rate) — ตัดคำด้วย `Intl.Segmenter('th')`
- ทั้งคู่ normalize ก่อน: ตัวพิมพ์เล็ก, ตัดเครื่องหมายวรรคตอน, เลขไทย = เลขอารบิก — ดู `metrics.mjs` (`node tools/media-eval/metrics.mjs --self-test`)
- **เวลา** ต่อไฟล์ และ **เวลา/ความยาวเสียง** (real-time factor — ต่ำกว่า 1 = เร็วกว่าเวลาจริง) · เอนจินในเบราว์เซอร์อุ่นเครื่องด้วยไฟล์เงียบ 1 วินาทีก่อนจับเวลา (ไม่นับเวลาดาวน์โหลดโมเดล)

## วางไฟล์

โฟลเดอร์ `tools/media-eval/local/` อยู่ใน `.gitignore` — ไฟล์เสียง/ภาพจริงและผลลัพธ์ไม่ถูก commit

```
tools/media-eval/local/
  asr/
    ประชุม-01.m4a        ← ไฟล์เสียง/วิดีโอ (wav mp3 m4a aac ogg opus flac webm mp4 mov m4v)
    ประชุม-01.txt        ← ข้อความเฉลย ชื่อเดียวกัน (UTF-8) — พิมพ์ตามที่พูดจริง ไม่ต้องสนช่องว่าง/วรรคตอน
  ocr/
    ใบเสร็จ-01.jpg       ← รูป (png jpg webp bmp) หรือ pdf
    ใบเสร็จ-01.txt
```

ไฟล์ที่ไม่มี `.txt` คู่กันจะถูกข้าม

## รัน

```bash
cd tests && npm ci && npx playwright install chromium   # ครั้งแรก (ใช้ Playwright ของชุดทดสอบ)
cd ..
node tools/media-eval/run.mjs                                   # ทุกเอนจินที่ใช้ได้
node tools/media-eval/run.mjs --engines asr:tiny,asr:base       # เลือกเอนจิน
node tools/media-eval/run.mjs --engines ocr:tesseract --only ใบเสร็จ   # --only = regex ชื่อไฟล์
node tools/media-eval/run.mjs --lang thai                       # ตัวเลือก "ภาษา" ของหน้าถอดเสียง: auto (ค่าเริ่มต้น) | thai | english
```

ตัวเลือกอื่น: `--headed` (เห็นเบราว์เซอร์), `--timeout-min 60` (เวลาสูงสุดต่อไฟล์)

| เอนจิน | ทางที่รัน |
|---|---|
| `asr:tiny` `asr:base` `asr:small` `asr:medium` | Whisper ในเบราว์เซอร์ ผ่านหน้า `text-to-speech.html` จริง (เซิร์ฟเวอร์ static ในเครื่อง) — กดปุ่มเหมือนผู้ใช้ |
| `asr:gpu-tiny` `asr:gpu-base` `asr:gpu-small` `asr:gpu-large` | Whisper รุ่นใหม่ `onnx-community/whisper-*` บน **WebGPU** ผ่านหน้าเดียวกัน (Section 3) — ต้องมี GPU จริง รันด้วย `--headed`; สคริปต์เปิด Chromium อีกตัวพร้อมแฟล็ก WebGPU · ถ้าหน้าถอยเป็น WASM (หรือไม่มี WebGPU) แถวนั้นขึ้น ERROR ไม่ปนเป็นผล WebGPU · `asr:gpu-large` = large-v3-turbo (ต้องมี `shader-f16`) |
| `asr:cloud` | ปุ่มคลาวด์ของหน้าเดียวกันบน pages.dev (Whisper large-v3-turbo) = **โหมดใหม่**: ท่อนเหลื่อม 1.5 วิ ส่งขนาน ≤ 3 + `vad_filter` + ชุดคำศัพท์ตาม `--cloud-domain general\|law\|engineering\|invest` |
| `asr:cloud-seq` | เหมือน `asr:cloud` แต่ทีละท่อนไม่เหลื่อม (พฤติกรรมก่อน Section 3) — เทียบเวลา/Neurons/CER กับ `asr:cloud` ด้วยไฟล์ชุดเดียวกัน |
| `ocr:tesseract` | แนบไฟล์ (เปิด "ใช้ OCR") ในหน้า `text-to-speech.html` → `file-reader.js` |
| `ocr:claude` | `POST /api/ocr` (prompt เริ่มต้นของเซิร์ฟเวอร์ โมเดลค่าเริ่มต้นของเซิร์ฟเวอร์ = `claude-sonnet-5`) — รูปและ PDF · **เสียเงินค่า Claude API ทุกครั้ง** |
| `ocr:claude-sonnet-5` `ocr:claude-sonnet-5-5` `ocr:claude-haiku-5-5` | เหมือน `ocr:claude` แต่ระบุโมเดลเอง (allowlist ฝั่งเซิร์ฟเวอร์) — วัด CER/เวลา/ความล้มเหลวของแต่ละรุ่นด้วยไฟล์ชุดเดียวกันก่อนเลือกค่าเริ่มต้น (ยังไม่เปลี่ยนค่าเริ่มต้นในรอบ Section 2) |

### เอนจินคลาวด์ (`asr:cloud`, `ocr:claude*`)

ข้ามอัตโนมัติถ้าไม่ได้ตั้ง env ที่ต้องใช้ (`ocr:claude*` ต้องมี `MEDIA_EVAL_OCR_PIN` ด้วย):

```bash
export MEDIA_EVAL_URL=https://my-web-app-5w2.pages.dev
export MEDIA_EVAL_COOKIE='CF_Authorization=<ค่าคุกกี้>'   # เปิดเว็บที่ล็อกอิน Access แล้ว → DevTools → Application → Cookies
export MEDIA_EVAL_OCR_PIN='<รหัส OCR_PIN ที่ตั้งใน Cloudflare>'   # ใส่ในเทอร์มินัลเท่านั้น ห้ามเขียนลงไฟล์
node tools/media-eval/run.mjs --engines asr:cloud,ocr:claude
node tools/media-eval/run.mjs --engines ocr:claude-sonnet-5,ocr:claude-sonnet-5-5,ocr:claude-haiku-5-5 --only ใบเสร็จ
```

- สคริปต์ไม่พิมพ์/ไม่บันทึกรหัส · ถ้าเซิร์ฟเวอร์ตอบว่ารหัสผิด/ล็อก/ยังไม่ได้ตั้ง สคริปต์**หยุดเรียก Claude ที่เหลือทันที** (กันผิดซ้ำจนล็อก 15 นาที)
- สคริปต์ส่งไฟล์ตามที่เป็น (ไม่ย่อรูป) — รูปใหญ่เกิน 5 MB (base64) จะขึ้น error `too_large` ให้ย่อไฟล์ทดสอบเอง

- `asr:cloud` ใช้โควตา Neurons ฟรีรายวันร่วมกับแชท/สรุป — ถ้าไฟล์ยาวเกินโควตาที่เหลือ หน้าเว็บจะถามยืนยันค่าใช้จ่าย สคริปต์**ตอบยกเลิก**เสมอ (ไฟล์นั้นขึ้นว่าล้มเหลว) เว้นแต่ตั้ง `MEDIA_EVAL_ALLOW_PAID=1`
- คุกกี้ Access มีอายุ — หมดแล้วจะได้ error "redirected to login"

### ตรวจชื่อโมเดล (Hugging Face)

```bash
node tools/media-eval/check-models.mjs     # ตรวจว่า repo + ไฟล์ dtype ของทุกโมเดลใน media-models.js มีจริง (ต้องออกเน็ตได้) · exit 1 ถ้าขาด
```

รายการ `onnx-community/whisper-*` ใน `media-models.js` เขียนตามตัวอย่างทางการของ transformers.js แต่ตรวจกับ Hugging Face ตอนเขียนโค้ดไม่ได้ — รันสคริปต์นี้ก่อนเชื่อ/ก่อนเปลี่ยนค่าเริ่มต้นบน WASM เป็นรุ่นใหม่

### วัดคลาวด์แบบใหม่เทียบแบบเดิม

```bash
node tools/media-eval/run.mjs --engines asr:cloud,asr:cloud-seq --cloud-domain law --only ประชุม
```

ตารางสรุปมีคอลัมน์ **Neurons รวม** (อ่านจากบรรทัด "ใช้ไปแล้ววันนี้" ของหน้า ก่อน/หลังแต่ละไฟล์) — ท่อนเหลื่อมควรใช้มากกว่า `asr:cloud-seq` ไม่เกิน ~5% (เกณฑ์ ≤ 10%) แต่เวลารวมน้อยกว่าเพราะส่งขนาน

## ผลลัพธ์

พิมพ์ทีละไฟล์ + ตารางสรุปต่อเอนจิน แล้วเขียน `local/results-<เวลา>.json` (ทุกแถว) และ `.md` (ตารางสรุป)
