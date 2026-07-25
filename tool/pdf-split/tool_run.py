# -*- coding: utf-8 -*-
"""
tool_run.py — เครื่องมือ "แยกหน้า PDF + ดึงข้อความ"

รับไฟล์ .pdf 1 ไฟล์ แล้วสร้าง
  1) pages_<ชื่อไฟล์>.zip   — PDF แยกทีละหน้า (page_001.pdf, page_002.pdf, ...)
  2) text_<ชื่อไฟล์>.txt    — ข้อความที่ดึงได้จากทุกหน้า (ถ้าเป็นสแกนภาพจะว่าง)

ทำงานในเบราว์เซอร์ทั้งหมดผ่าน Pyodide + pypdf — ไฟล์ไม่ถูกส่งขึ้นเซิร์ฟเวอร์
"""

import os
import zipfile
from pypdf import PdfReader, PdfWriter


def run(input_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(input_path))[0]

    reader = PdfReader(input_path)
    n = len(reader.pages)
    if n == 0:
        print("❌ ไฟล์ PDF ไม่มีหน้าเลย")
        return []
    print(f"อ่าน PDF สำเร็จ — {n} หน้า")

    # 1) แยกทีละหน้า → zip
    zip_path = os.path.join(out_dir, f"pages_{base}.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, page in enumerate(reader.pages, start=1):
            writer = PdfWriter()
            writer.add_page(page)
            page_path = os.path.join(out_dir, f"page_{i:03d}.pdf")
            with open(page_path, "wb") as f:
                writer.write(f)
            zf.write(page_path, f"page_{i:03d}.pdf")
            os.remove(page_path)
    print(f"✅ แยกเป็น {n} ไฟล์ อยู่ใน pages_{base}.zip")

    # 2) ดึงข้อความ
    txt_path = os.path.join(out_dir, f"text_{base}.txt")
    chunks, empty_pages = [], 0
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = (page.extract_text() or "").strip()
        except Exception:
            text = ""
        if not text:
            empty_pages += 1
        chunks.append(f"───── หน้า {i}/{n} ─────\n{text}\n")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(chunks))
    if empty_pages == n:
        print("⚠️ ดึงข้อความไม่ได้เลย — น่าจะเป็น PDF สแกนภาพ (ต้องใช้ OCR ซึ่งยังไม่รองรับ)")
    else:
        print(f"✅ ดึงข้อความได้ {n - empty_pages}/{n} หน้า")

    return [zip_path, txt_path]
