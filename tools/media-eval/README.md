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
  tts/
    นิยาย-ตอน1.txt       ← ข้อความสำหรับวัดเสียงพูด (Section 5) — ไม่ต้องมีไฟล์เฉลย · ใช้ข้อความจริงยาวๆ (หลายหมื่นตัวอักษรขึ้นไป) จะได้ตัวเลขที่เชื่อถือได้
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
| `asr:th-small` `asr:th-medium` | **Thonburian Whisper** (Whisper ที่ฝึกภาษาไทย — `Tanotfin/distill-whisper-th-small\|medium-onnx`) บน **WASM** ผ่านหน้าเดียวกัน (Section 3 ข้อ 3) · หน้าบังคับ `language:'thai'` อยู่แล้ว แต่ใส่ `--lang thai` ให้ชัด · medium ต้อง `navigator.deviceMemory` ≥ 8 (ไม่งั้นตัวเลือกไม่ขึ้น → แถวนั้นขึ้น ERROR) |
| `asr:gpu-th-small` `asr:gpu-th-medium` | Thonburian บน **WebGPU** จริง (`--headed` เหมือน `asr:gpu-*`) · medium ใช้ encoder fp16 จึงต้องมี `shader-f16` · ถ้าหน้าถอยเป็น WASM แถวนั้นขึ้น ERROR |
| `asr:cloud` | ปุ่มคลาวด์ของหน้าเดียวกันบน pages.dev (Whisper large-v3-turbo) = **โหมดใหม่**: ท่อนเหลื่อม 1.5 วิ ส่งขนาน ≤ 3 + `vad_filter` + ชุดคำศัพท์ตาม `--cloud-domain general\|law\|engineering\|invest` |
| `asr:cloud-seq` | เหมือน `asr:cloud` แต่ทีละท่อนไม่เหลื่อม (พฤติกรรมก่อน Section 3) — เทียบเวลา/Neurons/CER กับ `asr:cloud` ด้วยไฟล์ชุดเดียวกัน |
| `tts:wasm-60` `tts:wasm-100` `tts:webgpu-100` | **สร้างไฟล์เสียง** ผ่านการ์ด "สร้างไฟล์เสียง" ของหน้า `text-to-speech.html` จริง (Section 5) · วัด **วินาทีต่อ 1,000 ตัวอักษร** ของทุกไฟล์ใน `local/tts/*.txt` (ไม่มีเฉลย/CER) + จำนวนท่อน/Worker จากแถวสถิติที่หน้าบันทึกเอง · `wasm-60` / `wasm-100` = WASM (ปิดตัวเลือก WebGPU) เพดานท่อน 60 / 100 ตัวอักษร (ตัวแปรทดสอบ `window.TANOT_TTS.maxChunk` — ใช้งานจริงใช้ `MAX_CHUNK` ค่าเดียวใน `tts-normalize.js`) · `webgpu-100` = WebGPU (`--headed` เหมือน `asr:gpu-*`; ถ้าหน้าถอย WASM แถวนั้นขึ้น ERROR) · เอาเลขไปเลือก `MAX_CHUNK` + ตัดสินว่าเปิด WebGPU เป็นค่าเริ่มต้นต่อไปไหม · ฟังเสียงเองด้วยว่าท่อนยาวไม่ทำให้เสียงเพี้ยน |
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

รายการ `Tanotfin/distill-whisper-th-*-onnx` (Thonburian) แปลงโดยเจ้าของ (transformers.js 3.8.1 `scripts/convert.py --quantize`) และทดสอบถอดเสียงไทยกับ transformers.js 4.2.0 แล้ว แต่สคริปต์นี้ควรผ่านก่อนปล่อยเสมอ (ตรวจไฟล์ `encoder_model{,_fp16}` / `decoder_model_merged{,_quantized,_q4}` + config/tokenizer)

### วัด Thonburian เทียบรุ่นอื่น (Section 5)

```bash
node tools/media-eval/run.mjs --engines asr:small,asr:th-small,asr:medium,asr:th-medium,asr:cloud --lang thai
node tools/media-eval/run.mjs --engines asr:gpu-small,asr:gpu-th-small,asr:gpu-th-medium --lang thai --headed   # WebGPU จริง
```

ใช้ไฟล์เสียงภาษาไทยชุดเดียวกันทุกเอนจิน — ตารางสรุปให้ CER/เวลาต่อเอนจิน

รายการ `onnx-community/whisper-*` ใน `media-models.js` เขียนตามตัวอย่างทางการของ transformers.js แต่ตรวจกับ Hugging Face ตอนเขียนโค้ดไม่ได้ — รันสคริปต์นี้ก่อนเชื่อ/ก่อนเปลี่ยนค่าเริ่มต้นบน WASM เป็นรุ่นใหม่

### วัดเสียงพูด: เพดานท่อน + WebGPU (Section 5)

```bash
node tools/media-eval/run.mjs --engines tts:wasm-60,tts:wasm-100                    # รวมบรรทัดในย่อหน้า: 60 เทียบ 100 ตัวอักษรต่อท่อน (WASM)
node tools/media-eval/run.mjs --engines tts:wasm-100,tts:webgpu-100 --headed        # WASM เทียบ WebGPU จริง (ต้องมี GPU)
node tools/media-eval/run.mjs --engines tts:wasm-100 --only นิยาย                    # --only = regex ชื่อไฟล์ใน local/tts/
```

ตารางสรุปมีคอลัมน์ **วิ/1,000 ตัวอักษร** (ต่ำ = เร็ว) · อุ่นเครื่องด้วยข้อความสั้นก่อนจับเวลา (ไม่นับเวลาดาวน์โหลดโมเดล) · งานยาวใช้เวลาหลายนาทีต่อไฟล์ — ปรับ `--timeout-min` · `check-models.mjs` ตรวจไฟล์ fp32 (`onnx/model.onnx`) ของทุกเสียงที่ WebGPU ต้องใช้ด้วย

### วัดคลาวด์แบบใหม่เทียบแบบเดิม

```bash
node tools/media-eval/run.mjs --engines asr:cloud,asr:cloud-seq --cloud-domain law --only ประชุม
```

ตารางสรุปมีคอลัมน์ **Neurons รวม** (อ่านจากบรรทัด "ใช้ไปแล้ววันนี้" ของหน้า ก่อน/หลังแต่ละไฟล์) — ท่อนเหลื่อมควรใช้มากกว่า `asr:cloud-seq` ไม่เกิน ~5% (เกณฑ์ ≤ 10%) แต่เวลารวมน้อยกว่าเพราะส่งขนาน

## ผลลัพธ์

พิมพ์ทีละไฟล์ + ตารางสรุปต่อเอนจิน แล้วเขียน `local/results-<เวลา>.json` (ทุกแถว) และ `.md` (ตารางสรุป)
