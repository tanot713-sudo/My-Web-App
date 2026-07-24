# -*- coding: utf-8 -*-
"""
tool_run.py — สัญญาเชื่อมต่อ (plugin contract) ของเครื่องมือ "ประมาณราคางาน MA"

ทุกเครื่องมือในหมวดงานเอกสารต้องมีไฟล์นี้ และต้องมีฟังก์ชันเดียวคือ

    run(input_path: str, out_dir: str) -> list[str]
        รับ path ไฟล์ที่ผู้ใช้อัป + โฟลเดอร์ปลายทาง
        คืน list ของ path ไฟล์ผลลัพธ์ (ไฟล์แรก = ไฟล์หลักที่จะดาวน์โหลดอัตโนมัติ)

หน้าเว็บ (run.html) เรียกแค่ฟังก์ชันนี้ ไม่รู้จักรายละเอียดภายในของเครื่องมือ
→ เพิ่มเครื่องมือใหม่ = สร้างโฟลเดอร์ + tool_run.py + เพิ่ม 1 บรรทัดใน tools.json
"""

import os, glob
import generate_v5

TEMPLATE = "Est_Cost_MA_v5_clean.xlsx"


def run(input_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    main_file = generate_v5.main(TEMPLATE, input_path, out_dir)
    if not main_file:
        return []
    svgs = sorted(glob.glob(os.path.join(out_dir, "route_svg_*", "*.svg")))
    return [main_file] + svgs


def check(input_path):
    """ตรวจข้อมูลก่อนรัน — คืน (errors, warnings)"""
    cfg = generate_v5.load_input(input_path)
    return generate_v5.validate(cfg)


def compare(input_path, history_files, threshold=0.25):
    """
    เทียบชั่วโมง PM/ปี ของอุปกรณ์ในไฟล์ input กับไฟล์ input เก่า (history_files)
    history_files: list ของ (name, path) ไฟล์ .xlsx เก่า (เช่นที่ดาวน์โหลดมาจาก Google Drive)
    """
    return generate_v5.compare_history(input_path, history_files, threshold)
