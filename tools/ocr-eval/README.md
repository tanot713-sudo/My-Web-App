# tools/ocr-eval — วัดความแม่นของ OCR ด้วยภาพจริง (Colab)

ภาพและเฉลยอยู่ใน Drive ของเจ้าของ `Tanot หนังสือเสียง/_ผลวัด-OCR/ภาพ/` เท่านั้น — **ห้าม commit ภาพหรือข้อความเฉลยลง repo**

| ไฟล์ | หน้าที่ | อุปกรณ์ |
|---|---|---|
| `tanot_ocr_draft.py` (สคริปต์ 10) | ร่างเฉลยด้วย Typhoon OCR 1.5 → `<ชื่อ>.ร่าง.txt` ให้เจ้าของแก้แล้วบันทึกเป็น `<ชื่อ>.txt` | GPU L4 |
| `tanot_ocr_eval.py` (สคริปต์ 11) | วัด CER: Tesseract ของเว็บจริง, PaddleOCR (th_PP-OCRv5_mobile_rec ± UVDoc), Typhoon, Claude (`/api/ocr`, ต้องมี Secret `OCR_PIN` + `TANOT_COOKIE`) → `report-OCR.txt` | GPU L4 |
| `tanot_ocr_iapp.py` (สคริปต์ 12) | อ่านรูป/PDF ทั้งโฟลเดอร์ `_OCR-iApp/เข้า/` ด้วย iApp OpenThai2.0-OCR-Markdown → `ออก/<ชื่อไฟล์>.md` + `.xlsx` (ตาราง 1 ตาราง = 1 ชีต) · `PROBE_ONLY=True` ก่อน · รันจริงบน T4 แล้ว (2026-11-12): อ่านภาพ/ตารางได้, ภาพใหญ่ย่อเองเมื่อ GPU เต็ม | GPU T4 |
| `tanot_iapp_runner.py` | ตัวรันกลางของ iApp (ล็อก commit โมเดล `REVISION`, ติดตั้งไลบรารีตามที่โมเดลกำหนด) ใช้โดยสคริปต์ 12, สคริปต์ 13 และ engine `iapp*` ของ `tanot_ocr_eval.py` (ย่อภาพก่อนส่ง, จำลองบีบ 4–8 บิตด้วย `set_quant`, greedy) | — |
| `tanot_iapp_onnx_vit.py` (สคริปต์ 13) | export ส่วนอ่านภาพของ iApp (ViT + neck) เป็น ONNX 4-bit (MatMulNBits บล็อก 32) + ไฟล์แบบแบ่ง query (N คงที่ 2464) → Drive `_OCR-iApp/onnx-vit/` ตรวจเทียบ torch/ORT CPU/ONNX ครบทาง และพิมพ์ค่าอ้างอิงของอินพุตสุ่มแบบมี seed · รันจริงแล้ว (ขั้น 3–5) ขั้น 6–8 ต้องรันใหม่ · **ต้อง High-RAM** | GPU T4 High-RAM |
| `iapp-vit-test.html` | หน้าทดสอบ (ไม่อยู่ในเมนู) โหลดไฟล์ `.onnx` ที่เลือกจากเครื่อง รันด้วย onnxruntime-web 1.24.3 (WebGPU/WASM) พิมพ์ผลรวม + 8 ค่าแรกของอินพุตสุ่ม seed เดียวกับสคริปต์ 13 + ปุ่มทดสอบ MatMulNBits 4/8 บิต + ตรวจ `navigator.gpu`/limits/`shader-f16` · ผู้ตรวจรันกับ WASM แล้ว ทาง WebGPU ยังไม่มีใครรัน | เบราว์เซอร์ (คอม/iPhone) |
| `make_tiny_nbits.py` → `tiny-nbits4.onnx`, `tiny-nbits8.onnx`, `tiny-nbits.json` | โมเดลจิ๋ว MatMulNBits 1 node (4 และ 8 บิต) + ค่าคาดหวัง ไว้ให้หน้าทดสอบตรวจว่า WebGPU รองรับกี่บิต (ไฟล์ตรวจกับ ORT CPU แล้ว) | CPU |

ผลล่าสุด (2026-11-12): iApp OpenThai2.0-OCR-Markdown (T4, ภาพย่ออัตโนมัติเมื่อ GPU เต็ม) CER รวม 13.8% — ถ่าย 11.8 · ใบเสร็จ 7.2 · ลายมือ 6.6 · สแกน 15.9 · จอ 22.7 · VRAM สูงสุด 11.3 GiB · เทียบตัวอื่นด้านล่าง

ผลก่อนหน้า (2026-10, 20 ภาพ, CER รวม): PaddleOCR + คลี่หน้า 20.4% · PaddleOCR ไม่คลี่ 42.9% · Tesseract 45.5% (โหมดแม่นยำ tessdata_best 45.5% — เอาออกแล้ว #80)
· ตัวเลข Typhoon สูงเกินจริงเพราะเฉลยแก้จากร่างของ Typhoon · บทเรียน: ใน Python ถ้าระบุชื่อตัวหาบรรทัดของ PaddleOCR เอง ต้องระบุ
`text_recognition_model_name="th_PP-OCRv5_mobile_rec"` ด้วย ไม่งั้น `lang="th"` ถูกเมิน · ภาพเต็ม 12 MP + ตัวหาบรรทัดรุ่น server บน CPU = แรมหมด (ใช้ภาพ 2000px + mobile_det)
