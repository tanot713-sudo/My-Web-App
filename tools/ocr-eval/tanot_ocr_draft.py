# Tanot — สคริปต์ 10: ร่าง "เฉลย" ของภาพทดสอบ OCR ให้ไปแก้เอง (ขั้น 0 ของแผน OCR · แบบเดียวกับสคริปต์ 8a ของไฟล์ประชุม)
#
# ทำอะไร
#   1) อ่านภาพจาก Drive "Tanot หนังสือเสียง/_ผลวัด-OCR/ภาพ/" (jpg png heic webp pdf ฯลฯ · ชื่อขึ้นต้นด้วยประเภท เช่น ใบเสร็จ-01.jpg)
#   2) อ่านด้วย Typhoon OCR 1.5 (typhoon-ai/typhoon-ocr1.5-2b — โมเดล OCR ไทยของ SCB10X, Apache-2.0) บน GPU ของ Colab
#      — ไม่ได้อยู่ในเว็บ และไม่ใช่ Claude จึงไม่ลำเอียงเข้าข้างตัวที่จะวัด · prompt/ขนาดภาพ/ค่าการสร้างข้อความตามแพ็กเกจ typhoon-ocr ทางการ
#   3) แปลงผล (Markdown/ตาราง HTML) เป็นข้อความล้วน → "<ชื่อภาพ>.ร่าง.txt" ข้างภาพ
#   ต่อจากนั้น (ทำเอง): เปิดภาพคู่กับร่าง แก้ให้ตรงกับที่เขียนในภาพทุกตัวอักษร → บันทึกเป็น "<ชื่อภาพ>.txt" (ตัด ".ร่าง" ออก)
#
# วิธีใช้ (Colab → Runtime → Change runtime type → L4 GPU → วางทั้งไฟล์ → Run) · ราว 10–20 นาที (ติดตั้ง ~5 · ภาพละ ~10–40 วิ)
#   ไม่ต้องใช้ token (โมเดลเปิดสาธารณะ) · ภาพอยู่ใน Drive/Colab ของคุณเท่านั้น ไม่ส่งไปที่อื่น · ห้ามใส่ภาพ/ข้อความลง GitHub
#   รันซ้ำได้: ภาพที่มี .txt หรือ .ร่าง.txt แล้วจะข้าม (เพิ่มภาพทีหลังแล้วรันใหม่ได้)

MODEL = "typhoon-ai/typhoon-ocr1.5-2b"
MAX_SIDE = 1800                 # ด้านยาวของภาพที่ส่งให้โมเดล = ค่าเริ่มต้นของแพ็กเกจ typhoon-ocr
MAX_PDF_PAGES = 3               # PDF อ่านไม่เกินกี่หน้าแรก (ชุดทดสอบไม่ต้องยาว)
MAX_NEW_TOKENS = 8192
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง"

import base64, html, io, pathlib, re, subprocess, time

def run(cmd):
    print("$", cmd, flush=True)
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in p.stdout: print(line, end="", flush=True)
    if p.wait(): raise SystemExit(f"❌ คำสั่งล้ม (code {p.returncode}) — คัดลอกข้อความด้านบนส่งกลับมา")

gpu = subprocess.run("nvidia-smi --query-gpu=name --format=csv,noheader", shell=True, capture_output=True, text=True).stdout.strip()
print("GPU:", gpu or "ไม่มี")
if not gpu: raise SystemExit("❌ ยังไม่ได้เปิด GPU — Runtime → Change runtime type → L4 GPU → Save แล้วรัน cell นี้ใหม่")

from google.colab import drive
drive.mount("/content/drive")
IMG = pathlib.Path(DRIVE_DIR) / "_ผลวัด-OCR" / "ภาพ"
if not IMG.exists(): raise SystemExit(f"❌ ไม่พบโฟลเดอร์ {IMG}")
EXT = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".bmp", ".tif", ".tiff", ".gif", ".pdf"}
files = sorted(p for p in IMG.iterdir() if p.suffix.lower() in EXT)
todo = [p for p in files if not p.with_suffix(".txt").exists() and not p.with_name(p.stem + ".ร่าง.txt").exists()]
print(f"ภาพทั้งหมด {len(files)} · ต้องร่าง {len(todo)}")
if not files: raise SystemExit(f"❌ ยังไม่มีภาพใน {IMG}")

# ── ติดตั้ง: Qwen3-VL (ฐานของ Typhoon OCR 1.5) ต้องใช้ transformers ≥ 4.57 · poppler สำหรับ PDF · pillow-heif สำหรับ HEIC จาก iPhone ──
if todo:
    run('pip -q install "transformers>=4.57" accelerate typhoon-ocr==0.4.1 pillow-heif')
    if any(p.suffix.lower() == ".pdf" for p in todo) and subprocess.run("command -v pdftoppm", shell=True).returncode:
        run("apt-get -qq update > /dev/null && apt-get -qq install -y poppler-utils > /dev/null")   # รายการแพ็กเกจของ Colab เก่า → ต้อง update ก่อน (ไม่งั้น 404)

from PIL import Image, ImageOps
import pillow_heif
pillow_heif.register_heif_opener()

W = pathlib.Path("/content/tanot_ocr10"); W.mkdir(exist_ok=True)

def pages_of(p):
    """คืนรายการ (ป้าย, ไฟล์ภาพ/PDF, หน้า) ที่ส่งให้ prepare_ocr_messages — ภาพหมุนตาม EXIF ก่อน (รูปจาก iPhone มักตะแคง)"""
    if p.suffix.lower() == ".pdf":
        from pypdf import PdfReader
        n = min(MAX_PDF_PAGES, len(PdfReader(str(p)).pages))
        return [(f"หน้า {i}", str(p), i) for i in range(1, n + 1)]
    im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
    out = W / (p.stem + ".png"); im.save(out)
    return [("", str(out), 1)]

def to_plain(md):
    """Markdown/HTML ของ Typhoon → ข้อความล้วนตามลำดับอ่าน: ตัดคำบรรยายภาพ (<figure> ไม่ใช่ข้อความในภาพ) · ตาราง = แถวละบรรทัด ช่องคั่นด้วย " | " """
    t = re.sub(r"<figure>.*?</figure>", "", md, flags=re.S)
    t = re.sub(r"</?page_number>", "", t)
    t = re.sub(r"</t[dh]>\s*<t[dh][^>]*>", " | ", t)
    t = re.sub(r"</tr>|<br\s*/?>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t)
    t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.M)        # หัวข้อ
    t = re.sub(r"(\*\*|__)(.+?)\1", r"\2", t)                  # ตัวหนา
    t = re.sub(r"^\s*[-*+]\s+", "", t, flags=re.M)             # หัวรายการ
    t = re.sub(r"[ \t]+\n", "\n", t)
    return re.sub(r"\n{3,}", "\n\n", t).strip()

if todo:
    import torch
    from transformers import AutoModelForImageTextToText, AutoProcessor
    from typhoon_ocr import prepare_ocr_messages
    model = AutoModelForImageTextToText.from_pretrained(MODEL, dtype=torch.bfloat16, device_map="cuda").eval()
    proc = AutoProcessor.from_pretrained(MODEL)

    def ocr(path, page):
        msg = prepare_ocr_messages(path, task_type="v1.5", target_image_dim=MAX_SIDE, page_num=page, figure_language="Thai")[0]["content"]
        prompt = next(c["text"] for c in msg if c["type"] == "text")
        b64 = next(c["image_url"]["url"] for c in msg if c["type"] == "image_url").split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
        conv = [{"role": "user", "content": [{"type": "text", "text": prompt}, {"type": "image", "image": img}]}]   # ลำดับเดียวกับแพ็กเกจ (ข้อความก่อนภาพ)
        inp = proc.apply_chat_template(conv, tokenize=True, add_generation_prompt=True, return_dict=True, return_tensors="pt").to(model.device)
        with torch.no_grad():   # แพ็กเกจใช้ temperature 0.1 · ที่นี่ greedy (ผลเหมือนเดิมทุกรอบ) + repetition_penalty 1.1 ตามแพ็กเกจ
            out = model.generate(**inp, max_new_tokens=MAX_NEW_TOKENS, do_sample=False, repetition_penalty=1.1)
        return proc.batch_decode(out[:, inp["input_ids"].shape[1]:], skip_special_tokens=True)[0]

    for p in todo:
        t0 = time.time()
        try:
            parts = []
            for label, path, page in pages_of(p):
                txt = to_plain(ocr(path, page))
                parts.append(f"[[{label}]]\n{txt}" if label else txt)
            draft = "\n\n".join(parts)
            p.with_name(p.stem + ".ร่าง.txt").write_text(draft + "\n", encoding="utf-8")
            print(f"\n— {p.name} ({time.time() - t0:.0f} วิ, {len(draft):,} ตัวอักษร)\n{draft[:300]}…", flush=True)
        except Exception as e:
            print(f"\n⚠️ {p.name} ล้ม: {type(e).__name__}: {str(e)[:300]}", flush=True)

done = [p for p in files if p.with_name(p.stem + ".ร่าง.txt").exists() or p.with_suffix(".txt").exists()]
print(f"""
✅ เสร็จ — มีร่าง/เฉลยแล้ว {len(done)}/{len(files)} ภาพ ที่ {IMG}
ต่อไป (ทำเอง): เปิดภาพคู่กับ <ชื่อ>.ร่าง.txt → แก้ให้ตรงกับในภาพทุกตัวอักษร → บันทึกเป็น <ชื่อ>.txt (ตัด ".ร่าง" ออก)
  · ลำดับ: บนลงล่าง ซ้ายไปขวา ทีละบรรทัด · ตาราง = แถวละบรรทัด · ช่องว่าง/วรรคตอน/ขึ้นบรรทัดไม่ต้องเป๊ะ (ตัววัดไม่นับ)
  · ข้อความที่อ่านไม่ออกแม้ด้วยตาคน → ลบทิ้งจากเฉลย · PDF มีป้าย [[หน้า N]] คั่น เก็บไว้ได้
แก้ครบแล้วบอกผม → สคริปต์ 11 วัดทุกตัว (Tesseract ในเว็บ · Claude · PaddleOCR ไทย · Typhoon)
""")
