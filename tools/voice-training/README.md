# tools/voice-training — สคริปต์ฝึกเสียงไทย Jori / Riko

รันใน **Google Colab** (ไม่ใช่ CI, ไม่ถูก deploy) ขั้นตอนเต็มและบทเรียนอยู่ใน `.claude/skills/tanot-voice-training/SKILL.md`

| ไฟล์ | หน้าที่ | อุปกรณ์ |
|---|---|---|
| `tanot_mms_dataset.py` (สคริปต์ 6) | สร้างชุดข้อมูลเสียง/ข้อความด้วย F5-TTS-THAI ลง Drive `_ชุดฝึก-MMS/<เสียง>/` | GPU L4 |
| `tanot_mms_train.py` (สคริปต์ 7) | fine-tune MMS/VITS → วัด CER → ONNX fp32 → อัปโหลด (เมื่อ CER ต่ำกว่า `UP_BELOW`) | GPU L4 |
| `tanot_mms_upload.py` (สคริปต์ 7b) | อัปโหลดผลของสคริปต์ 7 ที่ถูกข้าม | CPU |
| `tanot_mms_speed.py` (สคริปต์ 9) | ปรับความเร็วพูด (speaking_rate ฝังใน ONNX) โดยไม่ฝึกใหม่: Jori 0.8 · Riko 0.75 | CPU |
| `tanot_voice_design.py` (สคริปต์ 10) | สร้างเสียงอ้างอิงใหม่จากคำบรรยาย (VoxCPM2 voice design, Apache-2.0) — ไม่ใช้เสียงของใคร | **ในเครื่อง** GPU 8 GB |
| `tanot_vits_scratch.py` (สคริปต์ 12) | ฝึก VITS **จากศูนย์** (ไม่ใช้ MMS) ด้วยชุดข้อมูล VoxCPM2 → ONNX แบบเดียวกับ Jori/Riko · ทีละ session ฝึกต่อได้ | GPU L4 / A100 |
| `tanot_vits_pick.py` (สคริปต์ 13) | วัด CER ทุก checkpoint ของสคริปต์ 12 (รวมในถังขยะ Drive) + ลองเฉลี่ยน้ำหนัก → ONNX ของตัวที่ดีที่สุดใน `voice-เลือกแล้ว/` · lr คงที่ทำให้ checkpoint ล่าสุดไม่ใช่ตัวที่ดีที่สุดเสมอ | GPU L4 / T4 |

> ⚠️ ONNX ที่สคริปต์ 7b อัปโหลดจากผลเก่า (ก่อนเพิ่ม `SPEED` ในสคริปต์ 7) มีความเร็ว 1.0 → ต้องรันสคริปต์ 9 ซ้ำ แล้วเปลี่ยน `TTS_REVISION`

วางทั้งไฟล์ใน cell เดียวของ Colab แล้วแก้ค่าที่หัวไฟล์ (`SPEAKER`, `RUN`, `EPOCHS`, `UP_BELOW`, `TARGET_MIN`)

- `HF_TOKEN` (Write) ใส่ใน Colab Secrets เท่านั้น ห้ามใส่ในโค้ด
- ห้าม commit ข้อความนิยาย ไฟล์เสียง หรือโมเดล ลง repo นี้
- ได้ commit ใหม่แล้ว → PR เปลี่ยน `TTS_REVISION` ใน `media-models.js` + bump `CACHE` ใน `sw.js`

## สร้างเสียงอ้างอิงในเครื่อง (สคริปต์ 10)

ต้องการ Python 3.10–3.12 + NVIDIA GPU 8 GB (RTX 50xx ต้องใช้ PyTorch CUDA 12.8) · venv และผลอยู่นอก repo ที่ `E:\voxcpm\`

```powershell
py -3.12 -m venv E:\voxcpm\.venv
E:\voxcpm\.venv\Scripts\python.exe -m pip install voxcpm soundfile
E:\voxcpm\.venv\Scripts\python.exe -m pip install --force-reinstall torch torchaudio --index-url https://download.pytorch.org/whl/cu128
E:\voxcpm\.venv\Scripts\python.exe -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0))"
E:\voxcpm\.venv\Scripts\python.exe tools\voice-training\tanot_voice_design.py --voice หญิง
```

ผล: `E:\voxcpm\เสียงอ้างอิง\หญิง-001.wav` … + `candidates.tsv` → ฟังแล้วเลือก 1 ไฟล์ต่อเสียง · ไม่ชอบทั้งหมด = `--seed 7` (ชุดใหม่) หรือแก้คำบรรยายด้วย `--desc`

License (เช็ก 2026-11-22): VoxCPM2 = Apache-2.0 (ห้ามปลอมตัวเป็นคนจริง) · SiangTTS LoRA = CC-BY-SA-4.0 (ใช้เชิงการค้าได้ ต้องให้เครดิต + share-alike) ·
VachanaTTS ติดป้าย MIT แต่ fine-tune จาก facebook/mms-tts-tha (CC-BY-NC) → **ใช้เป็นฐานไม่ได้** ถ้าจะให้พ้น NC (ต้องฝึก VITS จากศูนย์)

## เสียงใหม่ที่ไม่ติด NC (สคริปต์ 10 → 6 → 12)

1. สคริปต์ 10 (ในเครื่อง): สร้างเสียงอ้างอิงจากคำบรรยาย → เลือกได้ `หญิง-012`, `ชาย-003`
2. อัปโหลด `หญิง-012.wav` + `หญิง-012.txt` ลง Drive `Tanot หนังสือเสียง/_เสียงตัวอย่าง/` โดยเปลี่ยนชื่อเป็น `ref-หญิง-012.wav` / `ref-หญิง-012.txt` (ชายเหมือนกัน)
3. สคริปต์ 6 ตั้ง `SPEAKER = "หญิง-ใหม่"`: VoxCPM2 อ่านข้อความ → Whisper คัด → `_ชุดฝึก-MMS/หญิง-V012-22k/` (เป้า `TARGET_MIN_NEW` = 12 ชม. · รันซ้ำ = ทำต่อ)
4. สคริปต์ 12 ตั้ง `SPEAKER = "หญิง-ใหม่"`: ฝึกจากน้ำหนักสุ่ม + tokenizer ของเราเอง (ช่องว่างระหว่างตัว = `_`) ทีละ `SESSION_HOURS` → ทุก session ได้ `จากศูนย์/voice/` + `ตัวอย่างฟัง/` + `report.txt`
5. คัดลอก `จากศูนย์/voice/` ไปที่ `E:\TanotPDF\voices\<ชื่อเสียง>\`

เวลาโดยประมาณ (ยังไม่ได้วัดจริง): สคริปต์ 6 ≈ 25–35 ชม. L4 ต่อเสียง 12 ชม. · สคริปต์ 12 ≈ 23 ชม. L4 ต่อ 100k step · A100 เร็วกว่าราว 2 เท่า
