# Tanot — ตัวรัน iapp/OpenThai2.0-OCR-Markdown บน Colab (โมดูลกลาง: ใช้ร่วมโดย tanot_ocr_iapp.py และ tanot_ocr_eval.py)
#
# สถานะ: ยังไม่ได้รันจริง (ไม่มี GPU ตอนเขียน) — วิธีเรียกโมเดลมาจากโค้ดใน repo โมเดลที่ REVISION ด้านล่าง
#   (config.json auto_map มีแค่ AutoModel/AutoProcessor, model_type nemotron_parse · ตัวช่วย nemotron_parse/inference.py:
#    DocumentParser + TransformersBackend ใส่ prompt "</s><s><predict_bbox><predict_classes><output_markdown><predict_text_in_pic>",
#    add_special_tokens=False ให้เอง · ค่า generate = GenerationSettings เริ่มต้นใน nemotron_parse/inference.py: temperature 0.2 (สุ่ม seed 0), repetition_penalty 1.05, max_tokens 8744 — คงค่านี้ไว้ (ทางที่ model card ทดสอบแล้ว) · postprocessing.py แปลง LaTeX ของตารางเป็น HTML/CSV)
# trust_remote_code รันโค้ดจาก repo โมเดลในเครื่องที่ mount Drive → ล็อก commit ด้วย REVISION (เปลี่ยนเลข = ตรวจโค้ดใหม่ก่อน)
import csv, io, re, subprocess, sys

MODEL = "iapp/OpenThai2.0-OCR-Markdown"
REVISION = "7a153712e5b50fac7e4a9d42ccf9ec41fb4202f0"
PINS = ['transformers>=5.14.1,<5.20', "timm==1.0.22", "einops==0.8.1", "beautifulsoup4==4.13.3", "accelerate"]   # ตาม pyproject.toml ของโมเดล
TF_RANGE = ((5, 14, 1), (5, 20, 0))

def _vt(v):
    return tuple(int("".join(c for c in x if c.isdigit()) or 0) for x in v.split(".")[:3])

def install():
    """ติดตั้งไลบรารีตามที่โมเดลกำหนด (ไม่ใช้ -U) — ต้องเรียกก่อน import transformers ครั้งแรกใน kernel
    transformers ถูก import ไปแล้วและรุ่นไม่อยู่ในช่วง = หยุดพร้อมข้อความให้ restart runtime"""
    if "transformers" in sys.modules:
        import transformers
        if not TF_RANGE[0] <= _vt(transformers.__version__) < TF_RANGE[1]:
            raise RuntimeError(f"transformers {transformers.__version__} ถูกโหลดใน kernel แล้วและอยู่นอกช่วง {PINS[0]} — Runtime → Restart session แล้วรันใหม่ (สคริปต์นี้ต้องติดตั้งก่อน import transformers)")
        return
    subprocess.run([sys.executable, "-m", "pip", "-q", "install", *PINS], check=True)

class Runner:
    def __init__(self, parser, torch, GenerationError):
        self.parser, self.torch, self.GenerationError = parser, torch, GenerationError

    def ocr(self, img, tables=True):
        """PIL.Image → (markdown, tables, warnings) · tables = list ของตาราง (list ของแถว = list ของข้อความ ขยายช่องที่ merge แล้ว)
        tables=False = ข้ามการแปลงตาราง (ใช้ตอนวัด CER) · ตารางที่แปลงไม่ได้ (span ผิด / ตัวช่วยคืน LaTeX เดิม) = ข้าม + เพิ่มคำเตือน ไม่ทำให้ทั้งหน้าล้ม
        หน้าถูกตัด/สร้างไม่ได้ = raise GenerationError (ผู้เรียกต้องนับว่าล้ม ห้ามเขียนผลครึ่งๆ)"""
        doc = None
        for attempt in range(4):   # GPU เต็ม (T4 15 GiB กับภาพความละเอียดสูง) = ย่อภาพ 30% แล้วลองใหม่ สูงสุด 3 ครั้ง
            try:
                doc = self.parser.parse(img, mode="single"); break
            except self.torch.cuda.OutOfMemoryError:
                if attempt == 3: raise
                print(f"  ⚠️ GPU เต็มที่ภาพ {img.width}×{img.height} — ย่อแล้วลองใหม่")
            import gc; gc.collect(); self.torch.cuda.empty_cache()   # ปล่อยหลังออกจาก except (traceback ยังถือหน่วยความจำอยู่ข้างใน)
            img = img.resize((int(img.width * 0.7), int(img.height * 0.7)))
        out, warns = [], []
        if tables:
            from postprocessing import postprocess_text
            for i, b in enumerate(x for x in doc.get("blocks", []) if x.get("class") == "Table"):
                try:
                    csv_text = postprocess_text(b["text"], cls="Table", table_format="csv")
                    if "\\begin{tabular}" in csv_text or "\\begin{tabular}" in (b.get("content") or ""):
                        raise ValueError("ตัวช่วยคืน LaTeX เดิม (แปลงตารางไม่ได้)")
                    rows = [row for row in csv.reader(io.StringIO(csv_text))]
                    if rows and all(re.fullmatch(r"column_\d+", c) for c in rows[0]): rows = rows[1:]   # แถวหัวปลอมที่ตัวช่วยเติมเมื่อตารางไม่มีหัว
                    out.append(rows)
                except Exception as e: warns.append(f"ตาราง {i + 1}: {type(e).__name__}: {str(e)[:120]}")
        return doc["markdown"], out, warns

def peak_vram():
    import torch
    return torch.cuda.max_memory_allocated() / 2**30

def load(selftest=True):
    """โหลดตามตัวช่วยของ repo โมเดล แล้ว "อ่านภาพทดสอบ 1 ภาพจริง" ก่อนบอกว่าสำเร็จ (ไม่ใช่แค่โหลดน้ำหนักได้)"""
    install()
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError("ไม่พบ GPU — Runtime → Change runtime type → T4 GPU → Save แล้วรันใหม่ (รันไทม์ปัจจุบันเป็น CPU)")
    from huggingface_hub import snapshot_download
    d = snapshot_download(MODEL, revision=REVISION)   # มี postprocessing.py, latex2html.py, nemotron_parse/**
    if d not in sys.path: sys.path.insert(0, d)
    from transformers import AutoModel, AutoProcessor, GenerationConfig
    from nemotron_parse.inference import DocumentParser, TransformersBackend, GenerationError
    torch.cuda.reset_peak_memory_stats()
    model = AutoModel.from_pretrained(d, trust_remote_code=True, dtype=torch.bfloat16).to("cuda").eval()
    proc = AutoProcessor.from_pretrained(d, trust_remote_code=True)
    r = Runner(DocumentParser(backend=TransformersBackend(model, proc, GenerationConfig.from_pretrained(d))), torch, GenerationError)
    print(f"โหลดน้ำหนักแล้ว (commit {REVISION[:7]}) · VRAM จอง {torch.cuda.memory_allocated() / 2**30:.1f} GiB")
    if selftest:
        from PIL import Image, ImageDraw, ImageFont
        import glob
        fonts = glob.glob("/usr/share/fonts/**/*Thai*.ttf", recursive=True) + glob.glob("/usr/share/fonts/**/Loma*.ttf", recursive=True)
        im = Image.new("RGB", (900, 260), "white"); dr = ImageDraw.Draw(im)
        f = ImageFont.truetype(fonts[0], 44) if fonts else ImageFont.load_default(size=44)
        dr.text((40, 40), "Tanot OCR test 12345" + ("  ทดสอบการอ่านภาษาไทย" if fonts else ""), fill="black", font=f)
        md = r.ocr(im, tables=False)[0]
        print(f"ภาพทดสอบ → {md.strip()[:200]!r}")
        if "12345" not in md: raise RuntimeError("อ่านภาพทดสอบไม่ได้ (ไม่พบ '12345' ในผล) — โหลดผ่านแต่ผลใช้ไม่ได้ ส่งข้อความด้านบนกลับมาให้แก้")
        print("✅ โมเดลอ่านภาพทดสอบได้")
    return r
