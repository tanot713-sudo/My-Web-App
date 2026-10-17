---
name: tanot-voice-training
description: ฝึกหรืออัปเดตเสียงไทย Jori (หญิง) / Riko (ชาย) ของหน้า text-to-speech — สร้างชุดข้อมูลด้วย F5-TTS-THAI, fine-tune MMS/VITS, แปลง ONNX, อัปโหลดขึ้น Hugging Face (private) แล้วเปิด PR เปลี่ยน TTS_REVISION. ใช้เมื่อผู้ใช้ขอฝึกเสียงใหม่ ปรับปรุงคุณภาพเสียง เพิ่มข้อความฝึก หรือถามเรื่อง tools/voice-training/
---

# ฝึกเสียงไทย Jori / Riko

สคริปต์อยู่ใน `tools/voice-training/` (รันใน Google Colab ไม่ใช่ใน repo/CI) — อ่าน `tools/voice-training/README.md` ประกอบ

## ภาพรวม

1. **F5-TTS-THAI** เลียนเสียงอ้างอิงที่สร้างจาก Gemini TTS (`ref-F-C` = Jori, `ref-M-C` = Riko; ข้อความอ้างอิงชุด C) สร้างชุดข้อมูลเสียง+ข้อความ
2. **Whisper (Thonburian)** ฟังกลับ คัดท่อนที่ F5 อ่านเพี้ยนออก
3. **fine-tune MMS/VITS** ต่อจาก VIZINTZOR `MMS-TTS-THAI-FEMALEV2` / `MALEV2` (22050 Hz) ด้วย `ylacombe/finetune-hf-vits`
4. แปลง **ONNX fp32** (ฝัง `noise_scale` 0.1 / `noise_scale_duration` 0.0 แบบ stable2) → อัปโหลดเป็น repo **private** บน Hugging Face (`Tanotfin/mms-thai-jori-f5-onnx`, `Tanotfin/mms-thai-riko-f5-onnx`)
5. เว็บโหลดผ่าน `/api/hf/` ตามเลข commit ใน `TTS_REVISION` (`media-models.js`)

## ขั้นตอน (Colab, GPU L4)

1. สคริปต์ 6 `tanot_mms_dataset.py` — ตั้ง `SPEAKER` = `"หญิง"` / `"ชาย"` และ `TARGET_MIN` → สร้างชุดข้อมูลลง Drive `_ชุดฝึก-MMS/<เสียง>/`
2. สคริปต์ 7 `tanot_mms_train.py` — ตั้ง `RUN` เป็นชื่อรอบใหม่ (เช่น `รอบ3`), `EPOCHS`, และ `UP_BELOW` = CER ชุดทดสอบของรอบก่อน (สคริปต์อัปโหลดเองเฉพาะเมื่อ CER ต่ำกว่า)
3. ฟังไฟล์ใน Drive `_ชุดฝึก-MMS/<เสียง>/ฝึกแล้ว-<RUN>/ตัวอย่างฟัง/`
4. ถ้าดีกว่าแต่สคริปต์ข้ามอัปโหลด → สคริปต์ 7b `tanot_mms_upload.py` (CPU พอ ทับไฟล์ใน repo HF; รุ่นก่อนย้อนได้จากประวัติ commit)
5. ได้เลข commit (40 hex) ของ repo → เปิด PR เปลี่ยน `TTS_REVISION` ใน `media-models.js` **เลขเดียว** + bump `CACHE` ใน `sw.js` (เปลี่ยนเลข = ทุกเครื่องโหลดรุ่นใหม่เอง)
6. ให้เจ้าของฟังจริงบนหน้า text-to-speech ก่อน merge

## Secret

`HF_TOKEN` แบบ **Write** อยู่ใน **Colab Secrets** เท่านั้น (เปิด Notebook access) — ห้ามใส่ในโค้ด แชท PR หรือไฟล์ใน repo (repo เป็น public) · token ฝั่งเว็บ (`HF_TOKEN` Read ใน Cloudflare) เป็นคนละตัวกัน

## ข้อมูลข้อความ

- นิยายของเจ้าของใน Drive + ข้อความใน `_ชุดฝึก-MMS/ข้อความเพิ่ม/` (เช่นไฟล์ "ส่งออกสำหรับฝึก" จากบันทึกคำอ่านผิดในหน้า text-to-speech)
- Common Voice (CC0) / Wikipedia (CC BY-SA) เก็บใน `_ชุดฝึก-MMS/แหล่งข้อความ/`
- **ห้าม commit ข้อความนิยายหรือไฟล์เสียงลง repo** (เทสต์ใช้ข้อความตัวอย่างแต่งเอง)

## ผลล่าสุด (CER ชุดทดสอบ 40 ท่อน ยิ่งต่ำยิ่งดี)

| เสียง | รอบ | CER | commit (ความเร็ว) |
|---|---|---|---|
| Jori | รอบ 2 | 0.039 (ประโยคทั่วไป 0.000) | `b9b254f86dfdf0c3ea4b49d8a6c92c4da5d4b913` (speaking_rate 0.8; ก่อนหน้า `9a95f85…` ความเร็วเดิม) |
| Riko | รอบ 2 (40 epoch) | 0.044 (ฐานเดิม 0.112, F5 0.022) | `d61cbf24ee518b31cbaa29c8a9eb8f251d5f4451` (speaking_rate 0.75; ก่อนหน้า `55d6042…` ความเร็วเดิม) |

## บทเรียน

- บันทึกเสียงที่อัตราของโมเดลฐาน (22050 Hz; สคริปต์อ่าน config ให้อัตโนมัติ)
- pin: `pyarrow` 17 · `pandas<3` · `matplotlib<3.10` · `transformers` 4.46
- `BatchEncoding.to()` ทิ้ง `speaker_id=None` (สคริปต์ patch แล้ว)
- เพิ่มรอบฝึก 25→40 epoch ได้เพิ่มน้อยมาก (ใกล้เพดานโมเดลฐาน) — ข้อมูลที่หลากหลายช่วยมากกว่า
- **ไม่มีทางถอยในเว็บ**: โหลดเสียงไม่ได้ = แจ้ง error ห้ามเพิ่ม fallback ไปเสียง/โมเดลอื่น (guard `tanotfin-models` ใน `tests/repo-guards.mjs`)
- โมเดล MMS / F5 เป็น CC-BY-NC — ใช้ส่วนตัวเท่านั้น
- **speaking_rate ถูกฝังใน ONNX ตอน export** (สคริปต์ 9 ปรับโดยไม่ฝึกใหม่; สคริปต์ 7 ตั้งจาก `SPEED` ใน preset: หญิง 0.8 · ชาย 0.75) — ความยาวจริงเพิ่มน้อยกว่า 1/speed เพราะ VITS ปัดความยาวต่อตัวอักษรขึ้นเป็นเฟรมเต็ม (วัดได้ Jori 0.8 → 1.18 เท่า · Riko 0.75 → 1.20 เท่า)
