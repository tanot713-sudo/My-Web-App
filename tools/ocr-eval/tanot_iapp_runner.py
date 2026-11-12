# Tanot — ตัวรัน iapp/OpenThai2.0-OCR-Markdown บน Colab (โมดูลกลาง: ใช้ร่วมโดย tanot_ocr_iapp.py และ tanot_ocr_eval.py)
#
# สถานะ: ยังไม่ได้รันจริง (ไม่มี GPU ตอนเขียน) — วิธีเรียกโมเดลมาจากโค้ดใน repo โมเดลที่ REVISION ด้านล่าง
#   (config.json auto_map มีแค่ AutoModel/AutoProcessor, model_type nemotron_parse · ตัวช่วย nemotron_parse/inference.py:
#    DocumentParser + TransformersBackend ใส่ prompt "</s><s><predict_bbox><predict_classes><output_markdown><predict_text_in_pic>",
#    add_special_tokens=False, repetition_penalty 1.1, max_new_tokens 8744 ให้เอง · postprocessing.py แปลง LaTeX ของตารางเป็น HTML/CSV)
# trust_remote_code รันโค้ดจาก repo โมเดลในเครื่องที่ mount Drive → ล็อก commit ด้วย REVISION (เปลี่ยนเลข = ตรวจโค้ดใหม่ก่อน)
import csv, io, pathlib, subprocess, sys

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

    def ocr(self, img):
        """PIL.Image → (markdown, tables) · tables = list ของตาราง (แต่ละตาราง = list ของแถว = list ของข้อความ, ขยายช่องที่ merge แล้ว)
        หน้าถูกตัด/สร้างไม่ได้ = raise GenerationError (ผู้เรียกต้องนับว่าล้ม ห้ามเขียนผลครึ่งๆ)"""
        from postprocessing import postprocess_text
        doc = self.parser.parse(img, mode="single")
        tables = []
        for b in doc.get("blocks", []):
            if b.get("class") == "Table":
                csv_text = postprocess_text(b["text"], cls="Table", table_format="csv")
                tables.append([row for row in csv.reader(io.StringIO(csv_text))])
        return doc["markdown"], tables

def peak_vram():
    import torch
    return torch.cuda.max_memory_allocated() / 2**30

def load(selftest=True):
    """โหลดตามตัวช่วยของ repo โมเดล แล้ว "อ่านภาพทดสอบ 1 ภาพจริง" ก่อนบอกว่าสำเร็จ (ไม่ใช่แค่โหลดน้ำหนักได้)"""
    install()
    import torch
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
        f = ImageFont.truetype(fonts[0], 44) if fonts else ImageFont.load_default()
        dr.text((40, 40), "Tanot OCR test 12345" + ("  ทดสอบการอ่านภาษาไทย" if fonts else ""), fill="black", font=f)
        md, _ = r.ocr(im)
        print(f"ภาพทดสอบ → {md.strip()[:200]!r}")
        if "12345" not in md: raise RuntimeError("อ่านภาพทดสอบไม่ได้ (ไม่พบ '12345' ในผล) — โหลดผ่านแต่ผลใช้ไม่ได้ ส่งข้อความด้านบนกลับมาให้แก้")
        print("✅ โมเดลอ่านภาพทดสอบได้")
    return r
