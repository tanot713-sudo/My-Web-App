# tools/ocr-eval — วัดความแม่นของ OCR ด้วยภาพจริง (Colab)

ภาพและเฉลยอยู่ใน Drive ของเจ้าของ `Tanot หนังสือเสียง/_ผลวัด-OCR/ภาพ/` เท่านั้น — **ห้าม commit ภาพหรือข้อความเฉลยลง repo**

| ไฟล์ | หน้าที่ | อุปกรณ์ |
|---|---|---|
| `tanot_ocr_draft.py` (สคริปต์ 10) | ร่างเฉลยด้วย Typhoon OCR 1.5 → `<ชื่อ>.ร่าง.txt` ให้เจ้าของแก้แล้วบันทึกเป็น `<ชื่อ>.txt` | GPU L4 |
| `tanot_ocr_eval.py` (สคริปต์ 11) | วัด CER: Tesseract ของเว็บจริง, PaddleOCR (th_PP-OCRv5_mobile_rec ± UVDoc), Typhoon, Claude (`/api/ocr`, ต้องมี Secret `OCR_PIN` + `TANOT_COOKIE`) → `report-OCR.txt` | GPU L4 |

ผลล่าสุด (2026-10, 20 ภาพ, CER รวม): PaddleOCR + คลี่หน้า 20.4% · PaddleOCR ไม่คลี่ 42.9% · Tesseract 45.5% (โหมดแม่นยำ tessdata_best 45.5% — เอาออกแล้ว #80)
· ตัวเลข Typhoon สูงเกินจริงเพราะเฉลยแก้จากร่างของ Typhoon · บทเรียน: ใน Python ถ้าระบุชื่อตัวหาบรรทัดของ PaddleOCR เอง ต้องระบุ
`text_recognition_model_name="th_PP-OCRv5_mobile_rec"` ด้วย ไม่งั้น `lang="th"` ถูกเมิน · ภาพเต็ม 12 MP + ตัวหาบรรทัดรุ่น server บน CPU = แรมหมด (ใช้ภาพ 2000px + mobile_det)
