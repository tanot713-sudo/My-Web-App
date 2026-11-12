# Tanot — สคริปต์ 12: OCR ไทยด้วย iapp/OpenThai2.0-OCR-Markdown บน Colab → ไฟล์ .md + ตารางเป็น .xlsx (แถว 3a ของแผน)
#
# เข้าใช้: Colab → รันไทม์ T4 GPU (ฟรี) → วางทั้งไฟล์ → Run
#   ขั้น 1: PROBE_ONLY = True → โหลดโมเดล + อ่านภาพทดสอบ 1 ภาพ + พิมพ์ VRAM แล้วหยุด (ไม่ประมวลผลไฟล์) — ผ่านแล้วค่อยขั้น 2
#   ขั้น 2: ตั้ง PROBE_ONLY = False แล้วรันซ้ำ → อ่านทุกรูป/PDF ในโฟลเดอร์ "เข้า"
# อินพุต : Drive "Tanot หนังสือเสียง/_OCR-iApp/เข้า/" (รูป .jpg .png .heic .webp … และ .pdf)
# เอาต์พุต: "_OCR-iApp/ออก/<ชื่อไฟล์เต็ม>.md" + ".xlsx" เช่น a.jpg.md (1 ตารางในเอกสาร = 1 ชีต; ไม่มีตาราง = ชีต "ข้อความ") — ไฟล์ที่ทำเสร็จแล้วข้ามเมื่อรันซ้ำ ไฟล์ที่ล้มทำใหม่
# ข้อมูลทั้งหมดอยู่ใน Drive ของเจ้าของ — ห้ามคัดลอกเอกสารจริง/ผลลัพธ์ลง repo · ไม่เรียก API ของ iApp (โมเดลรันในเครื่อง Colab)
PROBE_ONLY = True
REF = "main"     # branch/tag ของ repo ที่มี tools/ocr-eval/tanot_iapp_runner.py (ก่อน merge ให้ใส่ชื่อ branch)
REPO = "https://github.com/tanot713-sudo/My-Web-App"
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง/_OCR-iApp"
PDF_DPI = 200

import importlib, pathlib, re, shutil, subprocess, sys, time

W = pathlib.Path("/content/tanot_iapp")
shutil.rmtree(W / "repo", ignore_errors=True)   # clone ใหม่ทุกครั้ง — กันได้ตัวรันเก่าเมื่อรันซ้ำใน runtime เดิม
subprocess.run(f"git clone -q --depth 1 --branch {REF} {REPO} {W / 'repo'}", shell=True, check=True)
sys.path.insert(0, str(W / "repo" / "tools" / "ocr-eval"))
import tanot_iapp_runner as R
importlib.reload(R)

if PROBE_ONLY:
    R.load()
    print(f"\nVRAM สูงสุด {R.peak_vram():.1f} GiB · ตั้ง PROBE_ONLY = False แล้วรันซ้ำเพื่อประมวลผลไฟล์")
    raise SystemExit(0)

from google.colab import drive
drive.mount("/content/drive")
IN, OUT = pathlib.Path(DRIVE_DIR) / "เข้า", pathlib.Path(DRIVE_DIR) / "ออก"
IN.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
files = sorted(p for p in IN.iterdir() if p.is_file() and re.search(r"\.(jpe?g|png|heic|heif|webp|bmp|tiff?|pdf)$", p.name, re.I))
if not files: raise SystemExit(f"❌ ไม่มีไฟล์ใน {IN}")

subprocess.run("pip -q install pillow-heif pymupdf openpyxl", shell=True)
from PIL import Image, ImageOps
import pillow_heif; pillow_heif.register_heif_opener()
import fitz
from openpyxl import Workbook
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE

def pages_of(p):
    if p.suffix.lower() == ".pdf":
        for i, pg in enumerate(fitz.open(p), 1):
            px = pg.get_pixmap(dpi=PDF_DPI, alpha=False)
            yield i, Image.frombytes("RGB", (px.width, px.height), px.samples)
    else:
        im = ImageOps.exif_transpose(Image.open(p)).convert("RGB"); im.thumbnail((2400, 2400)); yield 1, im

def put(ws, r, c, v):   # ทุกช่องเป็นข้อความตรงๆ: ไม่แปลงเป็นเลข (กันเลข 0 นำหน้าหาย) และไม่ให้ "=…" กลายเป็นสูตร
    cell = ws.cell(r, c, ILLEGAL_CHARACTERS_RE.sub("", v)); cell.data_type = "s"

runner = R.load(selftest=False)
failed = []   # (ไฟล์, หน้า/สาเหตุ)
for p in files:
    md_path = OUT / (p.name + ".md")
    if md_path.exists(): print("ข้าม", p.name); continue
    t0, md_parts, sheets, nwarn, multi = time.time(), [], [], 0, p.suffix.lower() == ".pdf"
    try:
        for n, im in pages_of(p):
            try: md, tables, warns = runner.ocr(im)
            except Exception as e: raise RuntimeError(f"หน้า {n}: {type(e).__name__}: {str(e)[:200]}")   # หน้าล้ม/ถูกตัด = ไม่เขียนผลของไฟล์นี้
            nwarn += len(warns)
            md_parts.append((f"[[หน้า {n}]]\n" if multi else "") + md)
            sheets += [((f"หน้า{n}-" if multi else "") + f"ตาราง{i}", t) for i, t in enumerate(tables, 1)]
        wb = Workbook(); wb.remove(wb.active)
        if sheets:
            for name, rows in sheets:
                ws = wb.create_sheet(name[:31])
                for r, row in enumerate(rows, 1):
                    for c, v in enumerate(row, 1): put(ws, r, c, v)
        else:
            ws = wb.create_sheet("ข้อความ")
            for r, line in enumerate("\n\n".join(md_parts).splitlines(), 1): put(ws, r, 1, line)
        wb.save(OUT / (p.name + ".xlsx"))
        md_path.write_text("\n\n".join(md_parts), encoding="utf-8")   # .md เป็นขั้นสุดท้าย = ตัวบอกว่าไฟล์นี้เสร็จจริง
        print(f"{p.name}: {time.time() - t0:.0f} วิ · ตาราง {len(sheets)}" + (f" · ⚠️ ตารางแปลงไม่ได้ {nwarn} (ต้นฉบับของตารางนั้นยังอยู่ใน .md)" if nwarn else ""))
    except Exception as e:
        failed.append((p.name, f"{type(e).__name__}: {str(e)[:200]}")); print(f"⚠️ {p.name} ล้ม — {failed[-1][1]} (จะทำใหม่ในรอบหน้า)")
print(f"\nเสร็จ {len(files) - len(failed)}/{len(files)} ไฟล์ · ผลอยู่ที่ {OUT} · VRAM สูงสุด {R.peak_vram():.1f} GiB (ส่งตัวเลขนี้ + เวลาต่อหน้ากลับมาเพื่อยืนยันว่า T4 พอ)")
if failed: print("ล้ม:\n" + "\n".join(f"  {n}: {m}" for n, m in failed))
