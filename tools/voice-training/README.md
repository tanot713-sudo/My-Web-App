# tools/voice-training — สคริปต์ฝึกเสียงไทย Jori / Riko

รันใน **Google Colab** (ไม่ใช่ CI, ไม่ถูก deploy) ขั้นตอนเต็มและบทเรียนอยู่ใน `.claude/skills/tanot-voice-training/SKILL.md`

| ไฟล์ | หน้าที่ | อุปกรณ์ |
|---|---|---|
| `tanot_mms_dataset.py` (สคริปต์ 6) | สร้างชุดข้อมูลเสียง/ข้อความด้วย F5-TTS-THAI ลง Drive `_ชุดฝึก-MMS/<เสียง>/` | GPU L4 |
| `tanot_mms_train.py` (สคริปต์ 7) | fine-tune MMS/VITS → วัด CER → ONNX fp32 → อัปโหลด (เมื่อ CER ต่ำกว่า `UP_BELOW`) | GPU L4 |
| `tanot_mms_upload.py` (สคริปต์ 7b) | อัปโหลดผลของสคริปต์ 7 ที่ถูกข้าม | CPU |
| `tanot_mms_speed.py` (สคริปต์ 9) | ปรับความเร็วพูด (speaking_rate ฝังใน ONNX) โดยไม่ฝึกใหม่: Jori 0.8 · Riko 0.75 | CPU |

> ⚠️ ONNX ที่สคริปต์ 7b อัปโหลดจากผลเก่า (ก่อนเพิ่ม `SPEED` ในสคริปต์ 7) มีความเร็ว 1.0 → ต้องรันสคริปต์ 9 ซ้ำ แล้วเปลี่ยน `TTS_REVISION`

วางทั้งไฟล์ใน cell เดียวของ Colab แล้วแก้ค่าที่หัวไฟล์ (`SPEAKER`, `RUN`, `EPOCHS`, `UP_BELOW`, `TARGET_MIN`)

- `HF_TOKEN` (Write) ใส่ใน Colab Secrets เท่านั้น ห้ามใส่ในโค้ด
- ห้าม commit ข้อความนิยาย ไฟล์เสียง หรือโมเดล ลง repo นี้
- ได้ commit ใหม่แล้ว → PR เปลี่ยน `TTS_REVISION` ใน `media-models.js` + bump `CACHE` ใน `sw.js`
