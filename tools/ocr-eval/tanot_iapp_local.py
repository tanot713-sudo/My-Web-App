# Tanot — รัน iapp/OpenThai2.0-OCR-Markdown บนเครื่อง local (Windows/Linux + GPU NVIDIA) · ไม่ใช้ Colab/Drive
#
# ใช้: python tanot_iapp_local.py <โฟลเดอร์รูป/PDF> <โฟลเดอร์ผลลัพธ์> [--cap 896]
#   ผล: <ผลลัพธ์>/<ชื่อไฟล์เต็ม>.md (PDF = ทุกหน้าต่อกัน คั่นด้วย [[หน้า N]]) · ไฟล์ที่มี .md อยู่แล้วข้าม · ไฟล์ที่ล้มทำใหม่รอบหน้า
# ก่อนใช้ (ครั้งเดียว): ติดตั้ง PyTorch ที่ตรงกับการ์ด แล้วไลบรารีของโมเดล
#   RTX 50xx (Blackwell): pip install torch --index-url https://download.pytorch.org/whl/cu128   (ต้อง CUDA 12.8 ขึ้นไป)
#   แล้ว: pip install pillow pillow-heif pymupdf        (ไลบรารีของโมเดลที่ล็อกรุ่นไว้ — transformers/timm/einops/bs4/accelerate — ติดตั้งให้เองตอนรันครั้งแรก)
#   ตรวจ GPU: python -c "import torch;print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
# ดาวน์โหลดโมเดลจาก Hugging Face ครั้งแรก ~2.5 GB (ล็อก commit ใน tanot_iapp_runner.py) · ข้อมูลทั้งหมดอยู่ในเครื่อง ไม่เรียก API ใดๆ นอกจากดาวน์โหลดโมเดล
# ห้ามนำภาพ/ผลลัพธ์ที่มีข้อความของเจ้าของเข้า repo
import argparse, pathlib, re, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import tanot_iapp_runner as R

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("out")
ap.add_argument("--cap", type=int, default=896, help="ด้านยาวสูงสุดของภาพ (ค่าที่วัดแล้วดีที่สุด = 896; ต่ำกว่า ~800 ความแม่นตกมาก)")
ap.add_argument("--dpi", type=int, default=200, help="PDF: ความละเอียดเรนเดอร์ก่อนย่อ")
a = ap.parse_args()
SRC, OUT = pathlib.Path(a.src), pathlib.Path(a.out); OUT.mkdir(parents=True, exist_ok=True)

from PIL import Image, ImageOps
try:
    import pillow_heif; pillow_heif.register_heif_opener()
except ImportError: pass

def kind(p):   # ดูจากเนื้อไฟล์ ไม่ใช่นามสกุล
    if not p.is_file() or re.search(r"\.(xlsx?|csv|txt|md|docx?|json|zip)$", p.name, re.I): return None
    if p.open("rb").read(5) == b"%PDF-": return "pdf"
    try:
        with Image.open(p) as im: im.verify()
        return "image"
    except Exception: return None

def pages(p, k):
    if k == "pdf":
        import fitz
        for i, pg in enumerate(fitz.open(p), 1):
            px = pg.get_pixmap(dpi=a.dpi, alpha=False)
            yield i, Image.frombytes("RGB", (px.width, px.height), px.samples)
    else: yield 1, ImageOps.exif_transpose(Image.open(p)).convert("RGB")

def shrink(im):   # ย่อเท่านั้น ไม่ขยาย (เหมือน im.thumbnail ในสคริปต์วัด)
    im = im.copy(); im.thumbnail((a.cap, a.cap)); return im

files = [(p, k) for p in sorted(SRC.iterdir()) if (k := kind(p))]
if not files: raise SystemExit(f"❌ ไม่พบรูป/PDF ใน {SRC}")
runner = R.load(selftest=False)
failed = []
for p, k in files:
    dst = OUT / (p.name + ".md")
    if dst.exists(): print("ข้าม", p.name); continue
    t0, parts = time.time(), []
    try:
        for n, im in pages(p, k):
            md, _, _ = runner.ocr(shrink(im), tables=False)
            parts.append((f"[[หน้า {n}]]\n" if k == "pdf" else "") + md)
        dst.write_text("\n\n".join(parts), encoding="utf-8")   # .md เป็นขั้นสุดท้าย = ตัวบอกว่าไฟล์นี้เสร็จจริง
        print(f"{p.name}: {time.time() - t0:.0f} วิ · {len(parts)} หน้า")
    except Exception as e:
        failed.append(p.name); print(f"⚠️ {p.name} ล้ม — {type(e).__name__}: {str(e)[:200]} (จะทำใหม่รอบหน้า)")
print(f"\nเสร็จ {len(files) - len(failed)}/{len(files)} ไฟล์ · ผลที่ {OUT} · VRAM สูงสุด {R.peak_vram():.1f} GiB")
