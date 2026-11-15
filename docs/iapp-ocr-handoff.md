# ส่งต่อ: ใช้โมเดล iApp OCR (OpenThai2.0-OCR-Markdown) ในแอปอื่น

เอกสารนี้ให้ session/แอปอื่น (เช่นแอปบนคอม) เริ่มงานได้โดยไม่ต้องไล่บทสนทนา · รายละเอียดการวัดทั้งหมดอยู่ที่ `ROADMAP.md` แถว 3d · ไม่มีข้อมูลส่วนตัว/ภาพ/เฉลยของเจ้าของในไฟล์นี้ (อยู่ใน Drive ของเจ้าของ)

## เริ่มบนเครื่อง local (session ที่รันบนคอมของเจ้าของ)
1. เอาโค้ดมา: ใน clone ของ repo `tanot713-sudo/My-Web-App` รัน `git fetch origin claude/ocr-iapp-memknobs` แล้ว `git checkout claude/ocr-iapp-memknobs` (branch นี้ยังไม่ merge เข้า main; ไฟล์ที่เกี่ยวอยู่ใน `tools/ocr-eval/` และ `docs/iapp-ocr-handoff.md`)
2. ไฟล์โมเดลและภาพใน Drive: ใช้ Google Drive for desktop ซิงก์โฟลเดอร์ `Tanot หนังสือเสียง/_OCR-iApp/` และ `…/_ผลวัด-OCR/` มาไว้ในเครื่อง แล้วชี้พาธในสคริปต์ (สคริปต์เดิมเขียนให้รันบน Colab ที่ mount ที่ `/content/drive/MyDrive/…` — แก้ค่า `DRIVE_DIR` ที่หัวไฟล์)
3. ทางที่ง่ายสุดบนเครื่อง local ที่มี GPU NVIDIA (VRAM ≥ 4 GB): PyTorch ตรง — `tanot_iapp_runner.py` (ตอนนี้บังคับ CUDA: `R.load()` ล้มถ้าไม่เจอ GPU) ติดตั้งตาม `PINS` ที่หัวไฟล์ (transformers 5.14–5.19, timm 1.0.22, einops 0.8.1, beautifulsoup4 4.13.3, accelerate) · โมเดลดาวน์โหลดจาก Hugging Face (public ด้วย commit ที่ล็อกไว้ ~2.5 GB) · ไม่มี GPU: ต้องแก้ตัวรันให้รัน CPU (ช้ามาก) หรือใช้ทาง ONNX + onnxruntime
4. ห้ามนำภาพ เฉลย หรือผลที่มีข้อความของเจ้าของเข้า repo/PR (repo เป็น public) · session local ไม่ต้องเปิด PR เว้นแต่เจ้าของสั่ง

## โมเดล
- `iapp/OpenThai2.0-OCR-Markdown` ล็อก commit **`7a153712e5b50fac7e4a9d42ccf9ec41fb4202f0`** · สถาปัตยกรรม `nemotron_parse` (ViT SO400M 27 ชั้น → decoder 10 ชั้น, vocab 72,512, ~0.63B พารามิเตอร์) · ไลเซนส์ **OpenMDW-1.1** (ต้องเก็บ LICENSE/NOTICE และระบุที่มา; โมเดลเป็นของ iApp/NVIDIA — ดู `credits.html` และไฟล์ `LICENSE`, `THIRD_PARTY_NOTICES.md` ใน repo โมเดล)
- ใช้ผ่านโค้ดของ repo โมเดล: `nemotron_parse.inference.DocumentParser` + `TransformersBackend` (transformers `>=5.14.1,<5.20`, timm 1.0.22, einops 0.8.1) · prompt: `</s><s><predict_bbox><predict_classes><output_markdown><predict_text_in_pic>` · ค่า generate ปกติ: temperature 0.2, repetition_penalty 1.05, max_tokens 8744 (วัดแบบ greedy ที่ temperature 0)
- ผลดิบของโมเดล = ข้อความที่มี `<x_0.27><y_0.03>…<class_Text>` คั่น → ต้องผ่าน `nemotron_parse.postprocessing` (Python) ถึงจะได้ Markdown/ตาราง · สำหรับข้อความล้วน ตัดแท็กออกแล้วเรียงตามลำดับที่โมเดลสร้างก็พอ

## ความแม่นที่วัดแล้ว (20 ภาพของเจ้าของ: จอ/ถ่าย/ลายมือ/สแกน/ใบเสร็จ; CER ยิ่งต่ำยิ่งดี)
- bf16 เต็มที่ภาพไม่ย่อ: **13.8%** · ย่อด้านยาว 896: 13.5% · ส่วนอ่านภาพ 4-bit (จำลอง): 15.5% · ย่อเป็น 640: **32.4%** (ใช้ไม่ได้ — ห้ามย่อต่ำกว่า ~896) · ความแปรปรวนราว ±2 จุด
- เทียบ: PaddleOCR+unwarp 20.4%, Tesseract 45.5%, OpenThai2.0-OCR-Text 40.2% (ไม่ผ่าน)

## ทางรันที่มีให้เลือก
1. **PyTorch ตรง (ง่ายสุด)**: โมดูล `tools/ocr-eval/tanot_iapp_runner.py` (โหลดโมเดลที่ commit ข้างบน, `Runner.ocr(img, tables=True)` → `(markdown, tables, warnings)`) · ต้องมี GPU ~1.3 GB VRAM (bf16) หรือทดสอบ CPU ช้า · สคริปต์ตัวอย่างที่รันจริงบน Colab T4: `tanot_ocr_iapp.py` (โฟลเดอร์รูป/PDF → `.md` + `.xlsx`)
2. **ONNX (ที่เราส่งออกเอง ทำงานบน WebGPU ในเบราว์เซอร์ และใช้ onnxruntime ปกติได้)** — สคริปต์: `tanot_iapp_onnx_vit.py` (ส่วนอ่านภาพ), `tanot_iapp_onnx_dec.py` + `tanot_iapp_decoder_graph.py` (decoder) · ตัวถอดรหัสโทเค็น `iapp-tok.js` + `make_iapp_vocab.py` · หน้าทดสอบ `iapp-vit-test.html`, `iapp-dec-test.html` (ใช้เป็นตัวอย่างลำดับเรียกใช้งาน)
   - ViT: 9 ก้อน 4-bit (MatMulNBits บล็อก 32) `model-q4-p0..p8.onnx`, อินพุต `patches [2464,768]` + `pos [1,2464,1152]` (คำนวณนอกกราฟ), N คงที่ = 2464 (canvas 896×704 หรือ 704×896), เอาต์พุตก้อนท้าย `[1,617,1024]` · optimize=disabled บน iPhone
   - prefill (`vision [1,617,1024]` → KV 20 ก้อน, prompt ฝังเป็นค่าคงที่) + decode 3 ส่วน (`decode-a` ชั้น 0–4, `decode-b` ชั้น 5–9, `head`) fp16 หรือ 8-bit · ตารางคำ `embed.f16.bin` อ่านทีละแถว (2048 ไบต์/แถว, ยังไม่คูณ scale 32) · token สุดท้ายของ prompt เป็นก้าวแรกของ decode
   - ผลทดสอบบนคอม (Chrome WebGPU): 200 โทเค็น เสถียร ~36–42 โทเค็น/วินาที · บน iPhone ViT ผ่านครบแต่ลูป decode เด้งหลัง 3–9 ก้าว (ยังไม่แก้)
3. ยังไม่มีสำหรับ ONNX: preprocessing (resize/ใส่ canvas/patch/คำนวณ `pos` ด้วยการสอดแทรกตารางตำแหน่ง 128×128), postprocess → Markdown, ตาราง → xlsx

## ไฟล์ที่ต้องส่งให้ session นั้น (อยู่ใน Drive ของเจ้าของ ไม่อยู่ใน repo)
- `Tanot หนังสือเสียง/_OCR-iApp/onnx-vit-k9-q128/model-q4-p0..p8.onnx` (ViT 9 ก้อน, รวม ~270 MiB)
- `…/_OCR-iApp/onnx-dec/` : `prefill-fp16.onnx` 202 MiB · `decode-a/b-fp16.onnx` 110 MiB · `head-fp16.onnx` 142 MiB · `embed.f16.bin` 142 MiB · `q8/` (decode แบบ 8-bit รวม ~197 MiB) · `tokens.json` (โทเค็นอ้างอิง) · `vision-ref.f32.bin` (ฟีเจอร์ภาพอ้างอิง)
- `tokenizer.json` จาก repo โมเดล ที่ commit ข้างบน → `python3 tools/ocr-eval/make_iapp_vocab.py tokenizer.json iapp-vocab.json`
- ภาพ + เฉลยสำหรับวัดซ้ำ: `_ผลวัด-OCR/ภาพ/` (ห้ามนำเข้า repo)

## ข้อควรระวัง (เรียนรู้มาแล้ว)
- repo เป็น public: ห้ามใส่ภาพ/เฉลย/ผลที่มีข้อความของเจ้าของ, token หรือ secret ใน repo · โมเดล Tanotfin บนเว็บต้องผ่าน `/api/hf/` (ดู `CLAUDE.md`)
- onnxruntime-web ของเว็บล็อก 1.24.3 · ไฟล์ ONNX ที่ node คำนวณ shape จะตกไป CPU (ใช้บน WebGPU แบบห้ามถอยไม่ได้) → กราฟที่ส่งออกจึงเป็น static shape ทั้งหมด
- ตัวเทียบข้อความวัด CER = `tanot_ocr_eval.py` (`norm`: NFC, ตัดวรรคตอน, ไม่นับช่องว่าง) อย่าใช้ `isalnum()` (ตัดสระ/วรรณยุกต์ไทยทิ้ง)
- ภาพต้องไม่ย่อต่ำกว่าด้านยาว ~896; ความต่าง CER ต่ำกว่า ~2–3 จุดไม่ถือเป็นนัยสำคัญ
- tokenizer: added token ที่ `normalized=true` ต้อง NFKC ตอนถอดรหัส (`ำ` → `ํา`) — `make_iapp_vocab.py` ทำให้แล้ว
