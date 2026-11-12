# Tanot — สคริปต์ 12: OCR ไทยด้วย iapp/OpenThai2.0-OCR-Markdown บน Colab → ไฟล์ .md + ตารางเป็น .xlsx (แถว 3a ของแผน)
#
# เข้าใช้: Colab → รันไทม์ T4 GPU (ฟรี) → วางทั้งไฟล์ → Run · ครั้งแรกจะ "หยุดหลังพิมพ์ README ของโมเดล" ถ้า PROBE_ONLY = True
#   ขั้น 1: ตั้ง PROBE_ONLY = True รันดู README/config/วิธีโหลด (ไม่ประมวลผลไฟล์) — ส่งข้อความที่พิมพ์กลับมาถ้าโหลดไม่ผ่าน
#   ขั้น 2: ตั้ง PROBE_ONLY = False แล้วรันซ้ำ → อ่านทุกรูป/PDF ในโฟลเดอร์ IN_DIR
# อินพุต : Drive "Tanot หนังสือเสียง/_OCR-iApp/เข้า/" (รูป .jpg .png .heic .webp … และ .pdf)
# เอาต์พุต: "_OCR-iApp/ออก/<ชื่อ>.md" + "<ชื่อ>.xlsx" (1 ตารางในเอกสาร = 1 ชีต; ไม่มีตาราง = ชีต "ข้อความ") — ของที่ทำแล้วข้ามเมื่อรันซ้ำ
# ข้อมูลทั้งหมดอยู่ใน Drive ของเจ้าของ — ห้ามคัดลอกเอกสารจริง/ผลลัพธ์ลง repo · ไม่เรียก API ของ iApp (โมเดลรันในเครื่อง Colab)
PROBE_ONLY = True
REF = "main"     # branch/tag ของ repo ที่มี tools/ocr-eval/tanot_iapp_runner.py (ก่อน merge ให้ใส่ชื่อ branch)
REPO = "https://github.com/tanot713-sudo/My-Web-App"
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง/_OCR-iApp"
PDF_DPI = 200

import pathlib, re, subprocess, sys, time

W = pathlib.Path("/content/tanot_iapp")
if not (W / "repo").exists():
    subprocess.run(f"git clone -q --depth 1 --branch {REF} {REPO} {W / 'repo'}", shell=True, check=True)
sys.path.insert(0, str(W / "repo" / "tools" / "ocr-eval"))
import tanot_iapp_runner as R

if PROBE_ONLY:
    R.load()   # พิมพ์ README/config + ลองโหลดทุกวิธี
    print(f"\nVRAM สูงสุดตอนโหลด {R.peak_vram():.1f} GiB · ตั้ง PROBE_ONLY = False แล้วรันซ้ำเพื่อประมวลผลไฟล์")
    raise SystemExit(0)

from google.colab import drive
drive.mount("/content/drive")
IN, OUT = pathlib.Path(DRIVE_DIR) / "เข้า", pathlib.Path(DRIVE_DIR) / "ออก"
IN.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
files = sorted(p for p in IN.iterdir() if p.is_file() and re.search(r"\.(jpe?g|png|heic|heif|webp|bmp|tiff?|pdf)$", p.name, re.I))
if not files: raise SystemExit(f"❌ ไม่มีไฟล์ใน {IN}")

subprocess.run("pip -q install pillow-heif pymupdf openpyxl lxml", shell=True)
from PIL import Image, ImageOps
import pillow_heif; pillow_heif.register_heif_opener()
import fitz, pandas as pd

def pages_of(p):
    if p.suffix.lower() == ".pdf":
        doc = fitz.open(p)
        for i, pg in enumerate(doc, 1):
            px = pg.get_pixmap(dpi=PDF_DPI, alpha=False)
            yield i, Image.frombytes("RGB", (px.width, px.height), px.samples)
    else:
        im = ImageOps.exif_transpose(Image.open(p)).convert("RGB"); im.thumbnail((2400, 2400)); yield 1, im

runner = R.load()
for p in files:
    if (OUT / (p.stem + ".md")).exists(): print("ข้าม", p.name); continue
    t0, md_parts, tables, trunc = time.time(), [], [], False
    multi = p.suffix.lower() == ".pdf"
    for n, im in pages_of(p):
        try: text, tr = runner.ocr(im)
        except Exception as e: text, tr = f"[ล้ม: {type(e).__name__}: {str(e)[:200]}]", False
        trunc |= tr; md_parts.append((f"[[หน้า {n}]]\n" if multi else "") + text); tables += R.tables_from_md(text)
    (OUT / (p.stem + ".md")).write_text("\n\n".join(md_parts), encoding="utf-8")
    with pd.ExcelWriter(OUT / (p.stem + ".xlsx"), engine="openpyxl") as xw:
        if tables:
            for i, df in enumerate(tables, 1): df.to_excel(xw, sheet_name=f"ตาราง{i}"[:31], index=False, header=False)
        else: pd.DataFrame(["\n\n".join(md_parts)]).to_excel(xw, sheet_name="ข้อความ", index=False, header=False)
    print(f"{p.name}: {time.time() - t0:.0f} วิ · ตาราง {len(tables)}" + (" · ⚠️ ถูกตัดที่ MAX_NEW_TOKENS" if trunc else ""))
print(f"\n✅ เสร็จ — ผลอยู่ที่ {OUT} · VRAM สูงสุด {R.peak_vram():.1f} GiB (ส่งตัวเลขนี้กลับมาเพื่อยืนยันว่า T4 พอ)")
