# Tanot — สคริปต์ 6: สร้างชุดข้อมูลฝึก MMS ด้วย F5-TTS-THAI (ให้ F5 "สอน" MMS — เสียงหญิง Jori ก่อน)
#
# ทำอะไร
#   1) ข้อความ: นิยายเรื่องล่าสุดใน Drive (.last_book → input/book.txt) + ไฟล์ .txt เพิ่มเติมใน _ชุดฝึก-MMS/ข้อความเพิ่ม/ (ถ้ามี)
#      + ประโยคตัวเลข/วันที่/เงิน/เวลา ~300 ประโยคที่สคริปต์แต่งเอง (ให้ MMS อ่านตัวเลขในเว็บได้)
#      → แปลงด้วยตัวแปลงของเว็บ (tts-normalize.js plan) = ข้อความแบบเดียวกับที่เว็บส่งให้ MMS จริง → ท่อนยาว 15–110 ตัวอักษร
#   2) F5 อ่านทีละท่อนด้วยเสียงตัวอย่าง (SPEAKER: หญิง = ref-F-C Jori · ชาย = ref-M-C Riko) → ตัดเงียบหัวท้าย → ปรับความดัง −20 dBFS → SR (อัตราของ MMS ที่จะฝึกต่อ)
#   3) Whisper (Thonburian) ฟังกลับ → ทิ้งท่อนที่อ่านเพี้ยน (CER > MAX_CER) หรือเร็ว/ช้าผิดปกติ
#   4) เก็บลง Drive เป็นก้อนละ 250 ท่อน (shard-XXXX.tar) — Colab หลุดแล้วรันใหม่ = ทำต่อจากก้อนที่ค้าง (เสียได้มากสุด 1 ก้อน)
#   ผล: My Drive/Tanot หนังสือเสียง/_ชุดฝึก-MMS/หญิง-F-C/  (shard-*.tar + report.txt) → ใช้ต่อในสคริปต์ 7 (ฝึก MMS)
#
# วิธีใช้ (Colab → Runtime → Change runtime type → L4 GPU → วางทั้งไฟล์ใน cell เดียว → Run)
#   ใช้เสียงตัวอย่าง ref-F-C.wav ที่อยู่ใน Drive แล้ว (หาเองใน _เสียงตัวอย่าง หรือ <เรื่อง>/input/)
#   ราว 25–35 นาทีบน L4 ต่อเสียงที่ผ่านการคัด 1 ชั่วโมง (รอบสอง +3 ชม. ≈ 75–105 นาที) · เปิดแท็บค้างไว้
#   ⚠️ ข้อมูลนี้ใช้ส่วนตัวเท่านั้น: F5-TTS (CC-BY-NC) + เสียงตัวอย่างจาก Gemini TTS · ไม่ commit ข้อความนิยาย/เสียงลง repo
#
# เสียงใหม่ที่ไม่ติด NC ("หญิง-ใหม่" / "ชาย-ใหม่"): อ่านด้วย VoxCPM2 (Apache-2.0) แทน F5 · เสียงตัวอย่างสร้างจากคำบรรยายด้วยสคริปต์ 10
#   วาง ref-หญิง-012.wav + ref-หญิง-012.txt (หรือ ref-ชาย-003.*) ลง Drive _เสียงตัวอย่าง/ ก่อนรัน
#   (ไฟล์จาก E:\voxcpm\เสียงอ้างอิง\หญิง-012.wav/.txt → เปลี่ยนชื่อให้ขึ้นต้นด้วย ref-)
#   ข้อมูลมากกว่าเดิม (TARGET_MIN_NEW) เพราะสคริปต์ 12 ฝึก VITS จากศูนย์ · หลาย session ได้ (รันซ้ำ = ทำต่อ)
#   VoxCPM2 ช้ากว่า F5: ประมาณ 2–3 นาที L4 ต่อเสียงที่ผ่าน 1 นาที → 12 ชม. ≈ 25–35 ชม. L4 (A100 เร็วกว่าราว 2 เท่า)

SPEAKER = "หญิง-ใหม่"                 # "หญิง" = Jori (ref-F-C) · "ชาย" = Riko (ref-M-C) · "หญิง-ใหม่" / "ชาย-ใหม่" = VoxCPM2 (ไม่ติด NC)
# (ชื่อโฟลเดอร์, รุ่น F5 หรือ "voxcpm2", เสียงตัวอย่าง, MMS ที่จะฝึกต่อ — ใช้อ่านอัตราเสียง · None = ฝึกจากศูนย์ 22050 Hz)
# F5 หญิง v1 สั่นน้อยสุด · ชาย v2 อ่านชัดกว่า v1 (ผลทดสอบ tts-test-th)
PRESETS = {"หญิง": ("หญิง-F-C-22k", "v1", "F-C", "VIZINTZOR/MMS-TTS-THAI-FEMALEV2"),
           "ชาย": ("ชาย-M-C-22k", "v2", "M-C", "VIZINTZOR/MMS-TTS-THAI-MALEV2"),
           "หญิง-ใหม่": ("หญิง-V012-22k", "voxcpm2", "หญิง-012", None),
           "ชาย-ใหม่": ("ชาย-V003-22k", "voxcpm2", "ชาย-003", None)}
VOICE, SR_FROM = PRESETS[SPEAKER][:3], PRESETS[SPEAKER][3]
VOX = VOICE[1] == "voxcpm2"
SR = "auto"                           # อัตราของ MMS ที่จะฝึกต่อ — อ่านจาก config.json ของ SR_FROM (VIZINTZOR v2 = 22050 · facebook/mms-tts-tha = 16000) · ไม่มี SR_FROM = 22050
REF_TEXT = "ถ้าเราไม่ลองตอนนี้ ก็ไม่มีวันรู้หรอกว่าผลจะออกมาเป็นอย่างไร พรุ่งนี้เช้าค่อยมาคุยกันใหม่นะ"   # VoxCPM2: อ่านจาก ref-<ชื่อ>.txt แทน
TARGET_MIN = 300                      # นาทีเสียงที่ผ่านการคัด (รอบแรก 120 → รอบสอง 300 · รันซ้ำ = ทำต่อจากของเดิม ไม่ทำซ้ำ)
TARGET_MIN_NEW = 600                  # เสียงใหม่ (ฝึกจากศูนย์): รอบแรก 360 (CER 0.107) → 600 = 10 ชม. (เติม ~4.5 ชม. ≈ 20 หน่วย L4 · รันซ้ำ = ทำต่อ)
if VOX: TARGET_MIN = TARGET_MIN_NEW
MIN_CHARS, MAX_CHARS = 15, 110        # ความยาวท่อน (ตัวอักษรหลังแปลง) ≈ 1–8 วินาที
MAX_CER = 0.08                        # Whisper อ่านกลับผิดเกินนี้ = ทิ้ง
CPS_RANGE = (6.0, 24.0)               # ตัวอักษรต่อวินาทีที่ยอมรับ (นอกช่วง = เร็ว/ช้า/ค้างผิดปกติ)
SHARD = 250
WEB_SOURCES = True                    # เพิ่มข้อความหลากหัวข้อ (วิศวกรรม ธุรกิจ ประชุม กฎหมาย ชีวิตประจำวัน) — ดูส่วน 2b
CV_N, WIKI_CHARS = 2500, 150_000      # Common Voice (CC0): จำนวนประโยค · Wikipedia ไทย (CC BY-SA): ตัวอักษรจากบทความหัวข้อที่เลือก
WIKI_KEYS = ["วิศวกรรม", "เครื่องยนต์", "ไฟฟ้า", "อิเล็กทรอนิกส์", "คอมพิวเตอร์", "ซอฟต์แวร์", "การก่อสร้าง", "เครื่องจักร",
             "ธุรกิจ", "บริษัท", "การตลาด", "เศรษฐกิจ", "การเงิน", "ธนาคาร", "การบัญชี", "ภาษี", "การลงทุน",
             "กฎหมาย", "พระราชบัญญัติ", "ศาล", "สัญญา", "คดี", "รัฐธรรมนูญ", "ประมวลกฎหมาย",
             "อาหาร", "สุขภาพ", "การเดินทาง", "ครอบครัว", "โรงเรียน"]
STEP, CFG, SPEED = (10, 2.0, 1.0) if VOX else (32, 2.0, 1.0)   # VoxCPM2: inference_timesteps, cfg_value (SPEED ไม่ใช้)
if VOX: CV_N, WIKI_CHARS = 12000, 900_000   # ข้อความมากพอสำหรับ 12 ชม.
if VOX: SHARD = 100   # VoxCPM2 ช้า: ก้อนเล็กลง → Colab หลุดเสียไม่เกิน ~15 นาที
AUTO_DISCONNECT = True
SEED = 1234
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง"
RAW = "https://raw.githubusercontent.com/tanot713-sudo/My-Web-App/main/"

import hashlib
import json
import os
import pathlib
import random
import re
import shutil
import subprocess
import time
import urllib.request

os.environ["MPLBACKEND"] = "Agg"
if VOX: os.environ["TQDM_DISABLE"] = "1"; os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"   # VoxCPM2 พิมพ์แถบความคืบหน้าทุกประโยค → ท่วมหน้าจอจนหาบรรทัดสรุปไม่เจอ

def run(cmd):
    print("$", cmd, flush=True)
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in p.stdout: print(line, end="", flush=True)
    if p.wait(): raise SystemExit(f"❌ คำสั่งล้ม (code {p.returncode}) — คัดลอกข้อความด้านบนส่งกลับมา")

# ── 0) GPU + Drive + เสียงตัวอย่าง ──
gpu = subprocess.run("nvidia-smi --query-gpu=name --format=csv,noheader", shell=True, capture_output=True, text=True, check=False).stdout.strip()
print("GPU:", gpu or "ไม่มี")
if not gpu:
    raise SystemExit("❌ ยังไม่ได้เปิด GPU — Runtime → Change runtime type → L4 GPU → Save แล้วรัน cell นี้ใหม่")
from google.colab import drive

drive.mount("/content/drive")
if SR == "auto" and SR_FROM is None:
    SR = 22050
elif SR == "auto":
    from huggingface_hub import hf_hub_download
    with open(hf_hub_download(SR_FROM, "config.json"), encoding="utf-8") as f:
        SR = int(json.load(f)["sampling_rate"])
print(f"เสียง: {SPEAKER} {VOICE} · บันทึกที่ {SR} Hz (ตาม {SR_FROM or 'ฝึกจากศูนย์'})")
ROOT = pathlib.Path(DRIVE_DIR)
name, model, ref = VOICE
REF_WAV = ROOT / "_เสียงตัวอย่าง" / f"ref-{ref}.wav"
if not REF_WAV.exists():
    found = sorted(ROOT.glob(f"*/input/ref-{ref}.wav"))
    if not found: raise SystemExit(f"❌ ไม่พบ ref-{ref}.wav ใน {ROOT}/_เสียงตัวอย่าง หรือ <เรื่อง>/input/")
    REF_WAV.parent.mkdir(exist_ok=True); shutil.copy(found[0], REF_WAV)
if VOX:   # ข้อความที่เสียงตัวอย่างอ่าน (สคริปต์ 10 เขียนไว้คู่กัน)
    if not REF_WAV.with_suffix(".txt").exists(): raise SystemExit(f"❌ ไม่พบ {REF_WAV.with_suffix('.txt').name} คู่กับ {REF_WAV.name} ใน _เสียงตัวอย่าง/")
    REF_TEXT = REF_WAV.with_suffix(".txt").read_text(encoding="utf-8-sig").strip()
DS = ROOT / "_ชุดฝึก-MMS"; OUT = DS / name; OUT.mkdir(parents=True, exist_ok=True)
EXTRA = DS / "ข้อความเพิ่ม"; EXTRA.mkdir(exist_ok=True)

# ── 1) สภาพแวดล้อม (เหมือนสคริปต์ 4) ──
BASE = "/content/tanot_vox" if VOX else "/content/tanot_f5"; ENV = f"{BASE}/env"; PY = f"{ENV}/bin/python"
os.makedirs(BASE, exist_ok=True)
if not os.path.exists(f"{ENV}/.ok"):
    run("pip -q install uv")
    run(f"uv venv {ENV} --python 3.11 -q")
    if VOX:   # torch CUDA 12.6 (ตรงกับ driver ของ Colab) ล็อกไว้ ไม่ให้ voxcpm ดึง torch ที่ต้องใช้ CUDA ใหม่กว่า
        run(f'uv pip install -q --python {PY} "torch==2.7.1" "torchaudio==2.7.1" voxcpm soundfile '
            f'--extra-index-url https://download.pytorch.org/whl/cu126 --index-strategy unsafe-best-match')
        run(f'{PY} -c "import torch, voxcpm; print(torch.__version__, torch.cuda.is_available())"')
    else:
        run(f"uv pip install -q --python {PY} torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu121")
        run(f'uv pip install -q --python {PY} f5-tts-th==1.0.9 "numpy==1.26.4" soundfile "transformers>=4.40,<4.50"')
    pathlib.Path(f"{ENV}/.ok").write_text("ok")

DOMAIN_TEXT = """
วิศวกรตรวจสอบโครงสร้างอาคารก่อนอนุมัติให้เปิดใช้งาน

คานคอนกรีตเสริมเหล็กต้องรับน้ำหนักได้ไม่น้อยกว่าที่ออกแบบไว้

ทีมงานติดตั้งเซนเซอร์วัดอุณหภูมิไว้ที่ห้องเครื่องทั้งหมดสี่จุด

มอเตอร์ตัวนี้กินกระแสสูงผิดปกติ ควรหยุดเครื่องเพื่อตรวจเช็กทันที

ระบบปรับอากาศของโรงงานต้องได้รับการบำรุงรักษาทุกสามเดือน

แรงดันในท่อลดลงเพราะมีรอยรั่วบริเวณข้อต่อ

การออกแบบวงจรควรเผื่อค่าความปลอดภัยไว้อย่างน้อยยี่สิบเปอร์เซ็นต์

เราต้องเปลี่ยนตลับลูกปืนของปั๊มน้ำก่อนสิ้นเดือนนี้

หม้อแปลงไฟฟ้าร้อนเกินไป อาจเกิดจากการใช้ไฟเกินพิกัด

ผลการทดสอบแรงดึงของเหล็กเส้นผ่านเกณฑ์มาตรฐานทุกตัวอย่าง

ฐานรากของสะพานทรุดตัวลงเล็กน้อยหลังฝนตกหนัก

โปรแกรมควบคุมเครื่องจักรต้องอัปเดตให้เป็นรุ่นล่าสุด

ช่างไฟกำลังเดินสายใหม่ในตู้ควบคุมหลัก

ความชื้นในห้องเซิร์ฟเวอร์ไม่ควรเกินหกสิบเปอร์เซ็นต์

แบบแปลนชุดนี้ยังขาดรายละเอียดของระบบระบายน้ำ

กรุณาสวมหมวกนิรภัยและรองเท้าเซฟตี้ทุกครั้งที่เข้าพื้นที่ก่อสร้าง

เครื่องกำเนิดไฟฟ้าสำรองจะทำงานอัตโนมัติภายในสิบวินาทีเมื่อไฟดับ

เราใช้แผงโซลาร์เซลล์ผลิตไฟฟ้าได้ประมาณครึ่งหนึ่งของที่โรงงานใช้

ค่าความต้านทานของสายดินต้องต่ำกว่าห้าโอห์ม

การสั่นสะเทือนของเครื่องจักรสูงขึ้นเรื่อยๆ ตั้งแต่สัปดาห์ที่แล้ว

ทีมซอฟต์แวร์กำลังแก้ข้อผิดพลาดที่ทำให้ระบบค้างตอนเริ่มต้น

ฐานข้อมูลสำรองจะถูกบันทึกทุกคืนเวลาตีสอง

หน่วยความจำของเครื่องแม่ข่ายใกล้เต็มแล้ว ต้องเพิ่มพื้นที่โดยด่วน

ก่อนปล่อยระบบใหม่ เราต้องทดสอบกับผู้ใช้จริงอย่างน้อยหนึ่งสัปดาห์

สายพานลำเลียงหยุดทำงานเพราะเซนเซอร์ตรวจจับวัตถุสกปรก

งานเชื่อมโลหะชิ้นนี้ต้องตรวจด้วยคลื่นเสียงความถี่สูงก่อนส่งมอบ

อัตราการผลิตเพิ่มขึ้นหลังจากปรับตั้งค่าความเร็วของเครื่องจักร

ควรเปลี่ยนน้ำมันไฮดรอลิกเมื่อครบสองพันชั่วโมงการทำงาน

คอมเพรสเซอร์ตัวที่สองมีเสียงดังผิดปกติ ฝากช่างไปดูหน่อย

การคำนวณแรงลมต้องใช้ค่าความเร็วลมสูงสุดในรอบห้าสิบปี

ผู้รับเหมาส่งรายงานความคืบหน้าของงานก่อสร้างทุกวันศุกร์

วาล์วนิรภัยจะเปิดเองเมื่อแรงดันสูงเกินค่าที่ตั้งไว้

ระบบดับเพลิงอัตโนมัติผ่านการทดสอบเรียบร้อยแล้ว

เราวางแผนเปลี่ยนหลอดไฟทั้งอาคารเป็นแบบประหยัดพลังงาน

เครื่องมือวัดทุกชิ้นต้องสอบเทียบอย่างน้อยปีละครั้ง

ความคลาดเคลื่อนของชิ้นงานต้องไม่เกินศูนย์จุดศูนย์ห้ามิลลิเมตร

บริษัทตั้งเป้ายอดขายปีนี้เพิ่มขึ้นสิบห้าเปอร์เซ็นต์จากปีที่แล้ว

ต้นทุนวัตถุดิบสูงขึ้นมาก ทำให้กำไรขั้นต้นลดลง

ฝ่ายการตลาดเสนอให้ทำโปรโมชันช่วงปลายปี

ลูกค้ารายใหญ่ขอเลื่อนการชำระเงินออกไปอีกสามสิบวัน

เราควรกระจายความเสี่ยงด้วยการหาซัพพลายเออร์เพิ่มอีกหนึ่งราย

งบประมาณไตรมาสหน้าต้องส่งให้ฝ่ายบัญชีภายในวันพุธ

ส่วนแบ่งการตลาดของเราในภาคเหนือยังค่อนข้างต่ำ

กระแสเงินสดของบริษัทยังอยู่ในระดับที่ดี

ผู้ถือหุ้นจะได้รับเงินปันผลในเดือนพฤษภาคม

สินค้าคงคลังมีมากเกินไป ควรลดการสั่งซื้อในเดือนหน้า

เราได้รับใบสั่งซื้อใหม่จากลูกค้าต่างประเทศเมื่อเช้านี้

ราคาขายต้องครอบคลุมต้นทุนและค่าขนส่งด้วย

ทีมขายทำยอดได้เกินเป้าติดต่อกันสามเดือนแล้ว

แผนธุรกิจฉบับนี้ยังขาดการวิเคราะห์คู่แข่ง

บริษัทกำลังพิจารณาขยายสาขาไปยังจังหวัดขอนแก่น

ค่าใช้จ่ายในการดำเนินงานลดลงหลังเปลี่ยนมาใช้ระบบออนไลน์

ลูกค้าส่วนใหญ่พอใจกับบริการหลังการขายของเรา

การเจรจาต่อรองราคากับคู่ค้ายังไม่ได้ข้อสรุป

กรุณาออกใบแจ้งหนี้ให้ลูกค้าภายในวันนี้

ผลประกอบการไตรมาสแรกดีกว่าที่นักวิเคราะห์คาดการณ์ไว้

เราต้องปรับกลยุทธ์ให้ทันกับพฤติกรรมผู้บริโภคที่เปลี่ยนไป

อัตราดอกเบี้ยที่สูงขึ้นทำให้ต้นทุนการกู้ยืมเพิ่มขึ้น

ฝ่ายบุคคลเปิดรับสมัครพนักงานขายเพิ่มอีกห้าตำแหน่ง

สัญญาเช่าสำนักงานจะหมดอายุในอีกสองเดือน

ยอดสั่งซื้อผ่านเว็บไซต์เพิ่มขึ้นเกือบเท่าตัว

ควรตรวจสอบเครดิตของลูกค้ารายใหม่ก่อนให้เครดิตเทอม

ผู้บริหารอนุมัติงบลงทุนสำหรับเครื่องจักรใหม่แล้ว

แบรนด์ของเราเป็นที่รู้จักมากขึ้นในกลุ่มคนรุ่นใหม่

รายได้จากการส่งออกคิดเป็นสามสิบเปอร์เซ็นต์ของรายได้ทั้งหมด

ราคาน้ำมันที่ผันผวนส่งผลต่อค่าขนส่งสินค้าโดยตรง

เราควรเก็บข้อมูลความคิดเห็นของลูกค้าอย่างเป็นระบบ

การควบรวมกิจการครั้งนี้ต้องได้รับอนุญาตจากหน่วยงานกำกับดูแล

เริ่มการประชุมได้เลยครับ วันนี้มีวาระทั้งหมดห้าเรื่อง

ขอสรุปมติที่ประชุมครั้งที่แล้วก่อนเข้าสู่วาระใหม่

ใครมีความเห็นเพิ่มเติมในประเด็นนี้ เชิญได้เลยครับ

ขอเลื่อนการประชุมไปเป็นบ่ายสามโมงนะคะ

ผู้เข้าร่วมประชุมครบองค์ประชุมแล้ว

ที่ประชุมมีมติเห็นชอบตามที่ฝ่ายบริหารเสนอ

ช่วยจดบันทึกการประชุมแล้วส่งให้ทุกคนภายในวันพรุ่งนี้ด้วยนะ

ประเด็นนี้ขอให้ไปศึกษาข้อมูลเพิ่มเติมแล้วนำกลับมาเสนอใหม่

ขอบคุณทุกท่านที่สละเวลามาร่วมประชุมในวันนี้

ขอเชิญหัวหน้าฝ่ายผลิตรายงานความคืบหน้าค่ะ

เราจะประชุมติดตามงานทุกเช้าวันจันทร์เวลาเก้าโมง

ตอนนี้ได้ยินเสียงชัดไหมครับ ถ้าไม่ชัดช่วยบอกด้วย

ขอแชร์หน้าจอเพื่อนำเสนอตัวเลขสักครู่นะคะ

ผมขอเสนอให้ตั้งคณะทำงานขึ้นมาดูแลเรื่องนี้โดยเฉพาะ

เรื่องนี้ยังไม่มีข้อสรุป ขอยกไปคุยต่อในการประชุมครั้งหน้า

ใครจะเป็นผู้รับผิดชอบงานนี้ และจะเสร็จเมื่อไร

ขอให้ทุกฝ่ายส่งแผนงานภายในสิ้นสัปดาห์นี้

ฉันเห็นด้วยกับข้อเสนอ แต่อยากให้ทบทวนเรื่องงบประมาณอีกครั้ง

ช่วยปิดไมโครโฟนระหว่างที่ไม่ได้พูดด้วยนะครับ

วาระต่อไปเป็นเรื่องการปรับโครงสร้างองค์กร

ขอบคุณสำหรับการนำเสนอที่ชัดเจนมากครับ

มีคำถามจากผู้เข้าร่วมทางออนไลน์สองข้อค่ะ

เรามีเวลาอีกสิบนาที ขอให้กระชับประเด็นด้วยนะครับ

ขอเปิดให้ลงคะแนนเสียงในวาระนี้ครับ

ที่ประชุมรับทราบรายงานผลการดำเนินงานประจำเดือน

ขอปิดการประชุมเพียงเท่านี้ ขอบคุณครับ

ฝ่ายไอทีขอแจ้งว่าระบบจะปิดปรับปรุงคืนวันเสาร์

ผมจะส่งเอกสารประกอบการประชุมทางอีเมลก่อนเริ่มประชุมหนึ่งวัน

เราต้องตัดสินใจเรื่องนี้ให้ได้ภายในวันนี้

ขอสรุปสิ่งที่ต้องทำต่อก่อนแยกย้ายกันนะคะ

สัญญาฉบับนี้มีผลบังคับใช้ตั้งแต่วันที่ลงนาม

คู่สัญญาฝ่ายใดผิดสัญญา อีกฝ่ายมีสิทธิบอกเลิกสัญญาได้

ผู้เช่าต้องแจ้งล่วงหน้าไม่น้อยกว่าสามสิบวันก่อนย้ายออก

ศาลนัดสืบพยานโจทก์ในวันที่สิบห้าของเดือนหน้า

จำเลยให้การปฏิเสธตลอดข้อกล่าวหา

ผู้ใดกระทำละเมิดต่อผู้อื่น ต้องรับผิดชดใช้ค่าสินไหมทดแทน

หนังสือมอบอำนาจต้องมีลายมือชื่อของผู้มอบและพยานสองคน

ข้อมูลส่วนบุคคลจะถูกเก็บรักษาเป็นความลับตามกฎหมาย

ทนายความยื่นคำร้องขอเลื่อนคดีต่อศาลแล้ว

คำพิพากษาของศาลชั้นต้นยังไม่ถึงที่สุด

ลูกจ้างมีสิทธิลาป่วยได้เท่าที่ป่วยจริง

นายจ้างต้องจ่ายค่าชดเชยเมื่อเลิกจ้างโดยไม่มีความผิด

การโอนกรรมสิทธิ์ที่ดินต้องจดทะเบียนต่อพนักงานเจ้าหน้าที่

ผู้ค้ำประกันต้องรับผิดเมื่อลูกหนี้ไม่ชำระหนี้

คดีนี้มีอายุความสิบปีนับแต่วันที่ผิดสัญญา

พินัยกรรมต้องทำเป็นหนังสือและลงลายมือชื่อต่อหน้าพยาน

กฎหมายฉบับใหม่จะมีผลบังคับใช้หลังประกาศในราชกิจจานุเบกษา

ห้ามมิให้ผู้ใดเปิดเผยข้อมูลที่ได้มาจากการปฏิบัติหน้าที่

โจทก์ขอให้ศาลสั่งคุ้มครองชั่วคราวก่อนพิพากษา

ข้อตกลงนี้อยู่ภายใต้บังคับของกฎหมายไทย

ผู้ซื้อมีสิทธิตรวจสอบสินค้าก่อนรับมอบ

การแก้ไขสัญญาต้องทำเป็นลายลักษณ์อักษรและลงนามทั้งสองฝ่าย

พยานเบิกความว่าเห็นเหตุการณ์ตั้งแต่ต้นจนจบ

ตำรวจออกหมายเรียกให้ไปให้ปากคำที่สถานีตำรวจ

เจ้าของลิขสิทธิ์มีสิทธิแต่เพียงผู้เดียวในการทำซ้ำงานของตน

บริษัทต้องยื่นงบการเงินภายในห้าเดือนนับแต่วันปิดบัญชี

ผู้เสียหายสามารถยื่นคำร้องขอค่าสินไหมทดแทนในคดีอาญาได้

ศาลอุทธรณ์พิพากษายืนตามศาลชั้นต้น

เช้านี้รถติดมาก กว่าจะถึงที่ทำงานก็เกือบเก้าโมง

เย็นนี้กินอะไรดี อยากกินต้มยำกุ้งร้อนๆ

อย่าลืมซื้อนม ไข่ไก่ และขนมปังตอนกลับบ้านนะ

พรุ่งนี้ฝนน่าจะตก พกร่มไปด้วยก็ดี

ลูกมีการบ้านคณิตศาสตร์ต้องส่งวันจันทร์

แม่โทรมาบอกว่าวันอาทิตย์จะแวะมาหา

ช่วยรดน้ำต้นไม้หน้าบ้านให้หน่อยได้ไหม

ร้านกาแฟเปิดใหม่ตรงหัวมุมถนนรสชาติดีมาก

วันนี้รู้สึกเหนื่อยมาก ขอนอนเร็วหน่อยนะ

ค่าไฟเดือนนี้แพงกว่าเดือนที่แล้วเกือบสองร้อยบาท

แมวที่บ้านไม่ยอมกินข้าวมาสองวันแล้ว

สุดสัปดาห์นี้ไปเที่ยวทะเลกันไหม

หมอนัดตรวจสุขภาพประจำปีวันพฤหัสบดีหน้า

เครื่องซักผ้าเสีย ต้องเรียกช่างมาซ่อม

เดินออกกำลังกายวันละครึ่งชั่วโมงช่วยให้นอนหลับดีขึ้น

ตลาดนัดแถวบ้านมีผลไม้สดราคาถูก

อย่าลืมล็อกประตูและปิดไฟก่อนออกจากบ้าน

ฉันชอบอ่านหนังสือก่อนนอนทุกคืน

ข้าวผัดจานนี้เค็มไปหน่อย แต่ก็อร่อยดี

หลานสาวสอบเข้ามหาวิทยาลัยได้แล้ว ทุกคนดีใจมาก

วันหยุดยาวนี้คนกลับต่างจังหวัดกันเยอะ

รถเมล์สายนี้ผ่านหน้าโรงพยาบาลไหมคะ

ขอโทษนะครับ ห้องน้ำอยู่ทางไหน

ช่วยลดเสียงโทรทัศน์ลงหน่อย ลูกกำลังหลับ

อากาศช่วงนี้เปลี่ยนแปลงบ่อย ระวังเป็นหวัดด้วยนะ

บ้านเราต้องทาสีใหม่ก่อนหน้าฝนจะมา

ไปส่งพัสดุที่ไปรษณีย์ให้หน่อยได้ไหม

เมื่อวานดูหนังจนดึก วันนี้เลยตื่นสาย

ร้านนี้รับชำระเงินผ่านการสแกนคิวอาร์โค้ดด้วย

คุณยายชอบปลูกผักสวนครัวไว้กินเองหลังบ้าน

ยาแก้ปวดต้องกินหลังอาหารทันที

คืนนี้ท้องฟ้าโปร่ง มองเห็นดาวชัดมาก

พรุ่งนี้มีประชุมผู้ปกครองที่โรงเรียนตอนแปดโมงครึ่ง

ห้องนั่งเล่นรกมาก ช่วยกันเก็บหน่อยนะ

ฉันลืมกระเป๋าสตางค์ไว้ที่ร้านอาหาร

น้ำประปาไม่ไหลตั้งแต่เช้า ไม่รู้ว่าจะมาเมื่อไร

ถ้าว่างแวะมากินข้าวด้วยกันนะ
"""

# ชุดที่ 2 (รอบ 2 ของเสียงใหม่): คำที่ VITS จากศูนย์ยังอ่านผิด (กรุณา ปุ่ม ถนน) + คำสั่งในแอป ราชการ สุขภาพ การเดินทาง
# บทพูด/อารมณ์ และพยัญชนะที่พบน้อย (ฆ ฌ ฎ ฐ ณ ศ ษ ฤ) — ประโยคแต่งเอง
DOMAIN_TEXT_2 = """
กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนกดปุ่มบันทึก

กรุณารอสักครู่ ระบบกำลังประมวลผลคำขอของคุณ

กดปุ่มยืนยันอีกครั้งเพื่อดำเนินการต่อ

หากต้องการยกเลิก กรุณากดปุ่มย้อนกลับที่มุมซ้ายบน

ระบบจะส่งรหัสยืนยันไปที่หมายเลขโทรศัพท์ของท่าน

รหัสผ่านต้องมีความยาวอย่างน้อยแปดตัวอักษร

ไฟล์ที่เลือกมีขนาดใหญ่เกินไป กรุณาเลือกไฟล์ใหม่

การเชื่อมต่อขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง

บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว

คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้

ถนนสายนี้รถติดมากในช่วงเย็น ควรออกจากบ้านเร็วขึ้นสักครึ่งชั่วโมง

ทางด่วนขาเข้าเมืองปิดซ่อมผิวจราจรตั้งแต่สี่ทุ่มถึงตีห้า

กรุณาชิดซ้ายและลดความเร็วเมื่อขับผ่านเขตโรงเรียน

รถโดยสารประจำทางสายนี้จอดทุกป้ายจนถึงสถานีขนส่ง

สะพานข้ามแยกเปิดให้ใช้งานแล้วตั้งแต่เช้าวันนี้

ผู้โดยสารโปรดตรวจสอบสัมภาระก่อนลงจากรถไฟฟ้า

ฝนตกหนักทำให้น้ำท่วมขังบนถนนหลายสาย

ตำรวจจราจรเตือนให้หลีกเลี่ยงเส้นทางผ่านตัวเมืองในวันหยุดยาว

คุณหมอแนะนำให้ดื่มน้ำมากๆ และพักผ่อนให้เพียงพอ

ผู้ป่วยต้องงดน้ำงดอาหารหลังเที่ยงคืนก่อนวันผ่าตัด

โรงพยาบาลเปิดรับนัดตรวจสุขภาพประจำปีทางโทรศัพท์

อาการไอเรื้อรังเกินสองสัปดาห์ควรไปพบแพทย์

เภสัชกรอธิบายวิธีใช้ยาพ่นอย่างละเอียด

คุณครูมอบหมายการบ้านให้นักเรียนส่งภายในวันศุกร์

มหาวิทยาลัยประกาศผลการสอบคัดเลือกทางเว็บไซต์

นักศึกษาต้องลงทะเบียนเรียนให้เสร็จก่อนสิ้นสัปดาห์

ห้องสมุดขยายเวลาเปิดบริการในช่วงสอบปลายภาค

เด็กๆ ตื่นเต้นมากที่ได้ไปทัศนศึกษาที่พิพิธภัณฑ์

สำนักงานเขตเปิดให้บริการทำบัตรประชาชนในวันเสาร์

กรุณานำสำเนาทะเบียนบ้านมาด้วยในวันยื่นเอกสาร

หนังสือรับรองจะออกให้ภายในสามวันทำการ

เจ้าหน้าที่จะติดต่อกลับเมื่อพิจารณาคำร้องเสร็จสิ้น

ประชาชนสามารถยื่นแบบแสดงรายการภาษีทางออนไลน์ได้

คณะกรรมการมีมติเห็นชอบโครงการปรับปรุงสวนสาธารณะ

ร้านค้าลดราคาสินค้าทุกชิ้นในช่วงปลายปี

ลูกค้าสามารถเปลี่ยนสินค้าได้ภายในเจ็ดวันพร้อมใบเสร็จ

แม่ค้าในตลาดสดเริ่มขายของตั้งแต่ตีสี่

ราคาผักสดปรับตัวสูงขึ้นเพราะฝนตกต่อเนื่อง

ขอใบกำกับภาษีเต็มรูปแบบด้วยนะคะ

เขารู้สึกภูมิใจที่ได้ช่วยเหลือเพื่อนบ้านในยามลำบาก

เธอยิ้มอย่างมีความสุขเมื่อได้ยินข่าวดี

ความผิดหวังครั้งนั้นทำให้เขาเข้มแข็งขึ้น

คุณยายเล่านิทานให้หลานฟังทุกคืนก่อนนอน

ฆ้องใหญ่ดังกังวานไปทั่วบริเวณวัด

ฤดูฝนปีนี้มาเร็วกว่าทุกปี

ฤๅษีนั่งบำเพ็ญเพียรอยู่ในถ้ำกลางป่าลึก

เณรน้อยตื่นแต่เช้ามืดเพื่อออกบิณฑบาต

ศิลปินแห่งชาติได้รับเชิญมาเป็นวิทยากรพิเศษ

ฤกษ์งามยามดีสำหรับงานมงคลสมรสคือเก้าโมงเช้า

ภูเขาสูงตระหง่านปกคลุมด้วยหมอกขาวโพลน

แม่น้ำเจ้าพระยาไหลผ่านกรุงเทพมหานคร

กฎหมายฉบับใหม่มีผลบังคับใช้ตั้งแต่ต้นเดือนหน้า

ศาลนัดฟังคำพิพากษาในวันพฤหัสบดี

ทนายความยื่นคำร้องขอเลื่อนการพิจารณาคดี

ข้อตกลงนี้ต้องได้รับความยินยอมจากทั้งสองฝ่าย

ผู้ถือหุ้นเข้าร่วมประชุมสามัญประจำปีอย่างพร้อมเพรียง

รายงานผลประกอบการไตรมาสสามจะเผยแพร่สัปดาห์หน้า

ฝ่ายบัญชีขอให้ส่งใบเสร็จค่าเดินทางภายในวันที่ยี่สิบห้า

การประชุมทีมย้ายไปเป็นบ่ายสองโมงตรง

โปรดแจ้งยืนยันการเข้าร่วมงานสัมมนาล่วงหน้า

ช่างไฟมาตรวจสอบสายไฟที่ชำรุดในห้องครัว

เครื่องซักผ้าส่งเสียงดังผิดปกติตอนปั่นแห้ง

ตู้เย็นไม่เย็นเพราะน้ำยาแอร์รั่ว

อย่าลืมปิดแก๊สและถอดปลั๊กก่อนออกจากบ้าน

หลังคารั่วตรงมุมห้องนอน ต้องเรียกช่างมาซ่อม

เชฟแนะนำให้หมักไก่ด้วยกระเทียมและพริกไทยหนึ่งคืน

ต้มยำกุ้งน้ำข้นรสจัดจ้านเป็นที่ชื่นชอบของนักท่องเที่ยว

ข้าวเหนียวมะม่วงเป็นของหวานที่ขายดีที่สุดในร้าน

อย่าใส่น้ำตาลมากเกินไป เดี๋ยวจะหวานจนกลบรสชาติ

นักกีฬาทีมชาติซ้อมหนักเพื่อเตรียมตัวแข่งขันซีเกมส์

ผู้รักษาประตูกระโดดปัดลูกโทษได้อย่างสวยงาม

สนามแข่งขันเต็มไปด้วยกองเชียร์ที่ส่งเสียงดังกึกก้อง

พยากรณ์อากาศแจ้งว่าจะมีพายุฝนฟ้าคะนองในช่วงบ่าย

อุณหภูมิลดลงฉับพลันทำให้หลายคนป่วยเป็นไข้หวัด

ลมหนาวพัดมาถึงภาคเหนือแล้ว

ทะเลมีคลื่นสูงประมาณสองถึงสามเมตร เรือเล็กควรงดออกจากฝั่ง

นักวิทยาศาสตร์ค้นพบแบคทีเรียชนิดใหม่ในทะเลลึก

ดาวเทียมดวงนี้ใช้สำหรับสำรวจทรัพยากรธรรมชาติ

ปัญญาประดิษฐ์ช่วยให้แพทย์วินิจฉัยโรคได้แม่นยำขึ้น

แบตเตอรี่ของโทรศัพท์เสื่อมเร็วถ้าชาร์จทิ้งไว้ข้ามคืน

ควรสำรองข้อมูลสำคัญไว้อย่างน้อยสองที่

อย่าคลิกลิงก์แปลกๆ ที่ส่งมาทางข้อความ

ใครมาเคาะประตูตอนดึกขนาดนี้

ทำไมวันนี้กลับบ้านช้าจังเลย

ช่วยปิดไฟให้หน่อยได้ไหม

พรุ่งนี้จะไปไหนกันดี

ว้าว สวยมากเลย ซื้อมาจากที่ไหนเหรอ

โอ้โห ไม่น่าเชื่อเลยว่าจะทำได้สำเร็จ

ขอโทษนะคะ ไม่ได้ตั้งใจจะทำให้เสียใจ

ขอบคุณมากครับที่ช่วยเหลือกันมาตลอด

ยินดีด้วยนะ ในที่สุดก็สอบผ่านแล้ว

เสียใจด้วยจริงๆ กับเรื่องที่เกิดขึ้น

ฉันเชื่อว่าพรุ่งนี้ทุกอย่างจะดีขึ้น

เขาค่อยๆ เปิดประตูออกอย่างระมัดระวัง

เสียงฝีเท้าดังใกล้เข้ามาเรื่อยๆ

แสงจันทร์ส่องลอดผ่านหน้าต่างเข้ามาในห้อง

นกน้อยร้องเพลงเจื้อยแจ้วอยู่บนกิ่งไม้

กลิ่นดอกมะลิหอมฟุ้งไปทั่วสวน

"""

# ── 2) ข้อความ → ท่อนแบบที่เว็บส่งให้ MMS ──
texts = []
last = ROOT / ".last_book"
if last.exists():
    bk = ROOT / last.read_text(encoding="utf-8").strip() / "input" / "book.txt"
    if bk.exists(): texts.append(("novel", bk.read_bytes().decode("utf-8-sig")))
for f in sorted(EXTRA.glob("*.txt")):
    texts.append(("extra:" + f.stem, f.read_bytes().decode("utf-8-sig")))
# ── 2b) ข้อความหลากหัวข้อ — ดาวน์โหลดครั้งแรกแล้วเก็บใน Drive (_ชุดฝึก-MMS/แหล่งข้อความ/) รอบต่อไปใช้ไฟล์เดิม (ชุดข้อความคงที่)
#   • ประโยคที่แต่งไว้ในสคริปต์ (วิศวกรรม/ธุรกิจ/ประชุม/กฎหมาย/ชีวิตประจำวัน ~180 ประโยค)
#   • Common Voice ภาษาไทย (Mozilla, CC0 — ประโยคพูดทั่วไปหลากหัวข้อ)
#   • Wikipedia ไทย (CC BY-SA) เฉพาะบทความที่ชื่อ/ต้นเรื่องมีคำใน WIKI_KEYS · ตัดวงเล็บ · ย่อหน้าที่มีคำอังกฤษเกิน 3 คำไม่เก็บ
#   คำอังกฤษ: ใช้ประโยคได้ถ้าตัวแปลงของเว็บอ่านได้ทุกคำ (ทับศัพท์ในพจนานุกรม / สะกดตัวย่อ เช่น ATM → เอ ที เอ็ม) — มีคำที่เว็บข้าม = ไม่ใช้ประโยคนั้น
#   (คัดตอนใช้ ไม่ใช่ตอนเก็บ → พจนานุกรมของเว็บโตขึ้น รอบต่อไปได้ประโยคเพิ่มเอง)
def readable(lines):
    if not os.path.exists(f"{BASE}/tts-normalize.js"): urllib.request.urlretrieve(RAW + "tts-normalize.js", f"{BASE}/tts-normalize.js")
    js = r"""const N = require(process.argv[1]); let s = '';
process.stdin.on('data', d => s += d).on('end', () => process.stdout.write(JSON.stringify(JSON.parse(s).map(t => !/[A-Za-z]/.test(t) || N.skippedWords(t, {}).length === 0))));"""
    r = subprocess.run(["node", "-e", js, f"{BASE}/tts-normalize.js"], input=json.dumps(lines), capture_output=True, text=True, check=False)
    if r.returncode: raise SystemExit("❌ ตรวจคำอังกฤษไม่ได้:\n" + r.stderr[-1500:])
    ok = json.loads(r.stdout); keep = [l for l, k in zip(lines, ok) if k]
    print(f"  ใช้ได้ {len(keep):,}/{len(lines):,} (มีคำอังกฤษที่อ่านได้ {sum(1 for l, k in zip(lines, ok) if k and re.search('[A-Za-z]', l)):,})")
    return keep
# ไฟล์ใน ข้อความเพิ่ม/ (เช่น tts-misread-*.txt ที่ส่งออกจากหน้าเว็บ) → คัดย่อหน้าที่มีคำอังกฤษที่เว็บอ่านไม่ได้ออกเหมือนกัน
for _i, (_lab, _t) in enumerate(texts):
    if _lab.startswith("extra:"):
        print(f"{_lab}:", end=""); texts[_i] = (_lab, "\n\n".join(readable([p.strip() for p in re.split(r"\n\s*\n", _t) if p.strip()])))
if WEB_SOURCES:
    texts.append(("domain", DOMAIN_TEXT))
    texts.append(("domain:2", DOMAIN_TEXT_2))
    SRCD = DS / "แหล่งข้อความ"; SRCD.mkdir(exist_ok=True)
    cvf = SRCD / "commonvoice-th.txt"
    if not cvf.exists():
        try:
            raw = urllib.request.urlopen("https://raw.githubusercontent.com/common-voice/common-voice/main/server/data/th/sentence-collector.txt", timeout=120).read().decode("utf-8")
            ls = sorted({l.strip() for l in raw.splitlines() if 20 <= len(l.strip()) <= 110})
            random.Random(SEED).shuffle(ls); cvf.write_text("\n".join(ls[:CV_N]), encoding="utf-8")
        except Exception as e: print("⚠️ ดาวน์โหลด Common Voice ไม่ได้ (ข้าม):", str(e)[:200])  # noqa: BLE001 — เน็ต/ไฟล์พังได้หลายแบบ ข้ามแหล่งนี้แล้วทำต่อ
    if cvf.exists(): print("Common Voice:", end=""); texts.append(("web:cv", "\n\n".join(readable(cvf.read_text(encoding="utf-8").splitlines()))))
    wkf = SRCD / "wikipedia-th.txt"
    if not wkf.exists():
        try:
            import pyarrow.parquet as pq
            from huggingface_hub import HfApi, hf_hub_download
            fs = sorted(f for f in HfApi().list_repo_files("wikimedia/wikipedia", repo_type="dataset") if f.startswith("20231101.th/") and f.endswith(".parquet"))
            paras = []
            for f in fs:
                t = pq.read_table(hf_hub_download("wikimedia/wikipedia", f, repo_type="dataset"), columns=["title", "text"]).to_pydict()
                for ti, tx in zip(t["title"], t["text"]):
                    if not any(k in ti or k in tx[:300] for k in WIKI_KEYS): continue
                    for p in tx.split("\n"):
                        p = re.sub(r"\s*[(（][^)）]*[)）]", "", p).strip()
                        if 40 <= len(p) <= 600 and len(re.findall(r"[A-Za-z]+", p)) <= 3 and re.search(r"[ก-ฮ]", p): paras.append(p)
            random.Random(SEED).shuffle(paras); out, n = [], 0
            for p in paras:
                if n >= WIKI_CHARS: break
                out.append(p); n += len(p)
            wkf.write_text("\n".join(out), encoding="utf-8"); print(f"Wikipedia: {len(out):,} ย่อหน้า ({n:,} ตัวอักษร) จาก {len(paras):,} ที่ตรงหัวข้อ")
        except Exception as e: print("⚠️ ดาวน์โหลด Wikipedia ไม่ได้ (ข้าม):", str(e)[:200])  # noqa: BLE001 — เน็ต/ไฟล์พังได้หลายแบบ ข้ามแหล่งนี้แล้วทำต่อ
    if wkf.exists(): print("Wikipedia:", end=""); texts.append(("web:wiki", "\n\n".join(readable(wkf.read_text(encoding="utf-8").splitlines()))))
# นิยายเรื่องอื่นทุกเรื่องใน Drive (<เรื่อง>/input/book.txt) — รอบสองข้อความจากเรื่องล่าสุดเรื่องเดียวหมด
cur = last.read_text(encoding="utf-8").strip() if last.exists() else None
for bk in sorted(ROOT.glob("*/input/book.txt")):
    d = bk.parent.parent.name
    if d == cur or d.startswith("_"): continue
    texts.append(("novel:" + d, bk.read_bytes().decode("utf-8-sig")))
if not texts: raise SystemExit("❌ ไม่พบนิยาย (.last_book) และไม่มีไฟล์ใน _ชุดฝึก-MMS/ข้อความเพิ่ม/")

rnd = random.Random(SEED)
MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
CATS = ["ค่าอาหาร", "ค่าน้ำมัน", "ค่าไฟ", "ค่าน้ำ", "ค่าเน็ตบ้าน", "ค่าโทรศัพท์", "ค่าเดินทาง", "ซื้อของใช้", "ค่าเช่าบ้าน", "ค่ารักษาพยาบาล"]
def money(): return f"{rnd.choice([rnd.randint(5, 999), rnd.randint(1000, 99999)]):,}"
TEMPLATES = [
    lambda: f"วันที่ {rnd.randint(1, 31)} {rnd.choice(MONTHS)} {rnd.randint(2560, 2575)} มีนัดตอน {rnd.randint(6, 21)}.{rnd.choice(['00', '15', '30', '45'])} น.",
    lambda: f"ยอดเงินคงเหลือ {money()} บาท",
    lambda: f"วันนี้ใช้จ่ายไป {money()} บาท เป็น{rnd.choice(CATS)} {money()} บาท",
    lambda: f"{rnd.choice(CATS)}เดือน{rnd.choice(MONTHS)} {money()} บาท เกินงบไป {rnd.randint(1, 40)} เปอร์เซ็นต์",
    lambda: f"อุณหภูมิตอนนี้ {rnd.randint(18, 40)} องศา ความชื้น {rnd.randint(30, 95)} เปอร์เซ็นต์",
    lambda: f"ระยะทาง {rnd.randint(2, 500)} กิโลเมตร ใช้เวลาประมาณ {rnd.randint(5, 59)} นาที",
    lambda: f"ราคาปิดวันนี้ {rnd.randint(1, 300)}.{rnd.randint(0, 99):02d} บาท {rnd.choice(['เพิ่มขึ้น', 'ลดลง'])} {rnd.randint(1, 9)}.{rnd.randint(0, 9)} เปอร์เซ็นต์",
    lambda: f"เหลืออีก {rnd.randint(2, 90)} วันจะถึงกำหนดต่อภาษีรถ",
    lambda: f"กินยาครั้งละ {rnd.randint(1, 3)} เม็ด หลังอาหาร วันละ {rnd.randint(1, 4)} ครั้ง",
    lambda: f"เลขไมล์ล่าสุด {rnd.randint(1000, 250000):,} กิโลเมตร ควรเปลี่ยนน้ำมันเครื่องที่ {rnd.randint(1000, 250000):,} กิโลเมตร",
    lambda: f"อ่านหนังสือไปแล้ว {rnd.randint(1, 600)} หน้า จากทั้งหมด {rnd.randint(100, 900)} หน้า",
    lambda: f"เวลา {rnd.randint(0, 23)} นาฬิกา {rnd.randint(1, 59)} นาที",
]
cover = "\n\n".join(rnd.choice(TEMPLATES)() for _ in range(300))   # ย่อหน้าละประโยค = ท่อนละประโยค
texts.append(("cover", cover))
r2 = random.Random(SEED + 1); _r = rnd; rnd = r2   # ชุดตัวเลขเพิ่ม 500 ประโยค (ตัวสุ่มแยก → ลำดับของรอบก่อนไม่เปลี่ยน)
texts.append(("cover:2", "\n\n".join(rnd.choice(TEMPLATES)() for _ in range(500))))
rnd = _r

for f in ("tts-normalize.js",):
    urllib.request.urlretrieve(RAW + f, f"{BASE}/{f}")
PLAN_JS = r"""
const N = require(process.argv[1]); let s = '';
process.stdin.on('data', d => s += d).on('end', () => {
  const j = JSON.parse(s);
  process.stdout.write(JSON.stringify(j.texts.map(t => N.plan(t, { max: j.max }).chunks)));
});"""
r = subprocess.run(["node", "-e", PLAN_JS, f"{BASE}/tts-normalize.js"], input=json.dumps({"texts": [t for _, t in texts], "max": MAX_CHARS}),
                   capture_output=True, text=True, check=False)
if r.returncode: raise SystemExit("❌ แปลงข้อความไม่ได้:\n" + r.stderr[-1500:])
CHUNKS = json.loads(r.stdout)
def build(keep):
    items, seen = [], set()
    for (src, _), cs in zip(texts, CHUNKS):
        if not keep(src): continue
        for c in cs:
            c = re.sub(r"\s+", " ", c).strip()
            if not (MIN_CHARS <= len(c) <= MAX_CHARS) or c in seen: continue
            if not re.search(r"[ก-ฮ]", c): continue
            seen.add(c); items.append({"mms": c, "f5": c.replace("ํา", "ำ"), "src": src.split(":")[0]})
    return items
st = rnd.getstate()
items = build(lambda s: True)
rnd.shuffle(items)
for i, it in enumerate(items): it["id"] = f"{i:06d}"
# ชุดข้อความของรอบแรก/รอบสอง (นิยายเรื่องล่าสุด + ตัวเลข 300) → แปลง id ท่อนที่ถูกทิ้ง (บันทึกรุ่นแรกไม่มีข้อความ) กลับเป็นข้อความ
legacy = build(lambda s: s in ("novel", "cover")); _lr = random.Random(); _lr.setstate(st); _lr.shuffle(legacy)
LEGACY_TEXT = {f"{i:06d}": it["mms"] for i, it in enumerate(legacy)}
print(f"ท่อนที่ใช้ได้ {len(items):,} ท่อน (นิยาย {sum(it['src'] == 'novel' for it in items):,} จาก {sum(1 for s, _ in texts if s.startswith('novel'))} เรื่อง · ตัวเลข {sum(it['src'] == 'cover' for it in items):,} · เพิ่มเติม {sum(it['src'] == 'extra' for it in items):,} · หลากหัวข้อ {sum(it['src'] == 'domain' for it in items):,} · Common Voice/Wikipedia {sum(it['src'] == 'web' for it in items):,})")

# ── 3) ทำต่อจากที่ค้าง ──
done_ids, rej_ids, acc_sec = set(), set(), 0.0
done_rows = [row for idx in sorted(OUT.glob("shard-*.json")) for row in json.loads(idx.read_text(encoding="utf-8"))]
for row in done_rows:
    done_ids.add(row["id"]); acc_sec += row["dur"]
rej = OUT / "rejected.jsonl"
rej_texts = set()
if rej.exists():
    for line in rej.read_text(encoding="utf-8").splitlines():
        if line.strip():
            x = json.loads(line); rej_ids.add(x["id"])
            t = x.get("text") or LEGACY_TEXT.get(x["id"])
            if t: rej_texts.add(t)
# ชุดข้อความเปลี่ยน (เพิ่มไฟล์ใน ข้อความเพิ่ม/ · นิยายเรื่องใหม่ · ตัวแปลงของเว็บเปลี่ยน) → ลำดับเลข id เดิมใช้ไม่ได้ (ชื่อไฟล์เสียงจะชนกัน)
# → ใช้ id จากเนื้อข้อความแทน (x + sha1) · ท่อนที่ทำแล้วจับคู่ด้วยข้อความ
_old = [r for r in done_rows if re.fullmatch(r"\d{6}", r["id"])]
if _old: print(f"ตรวจชุดข้อความรอบก่อน: ตรง {sum(LEGACY_TEXT.get(r['id']) == r['text'] for r in _old):,}/{len(_old):,} ท่อน")
by_idx = {it["id"]: it["mms"] for it in items}
if not all(by_idx.get(r["id"]) == r["text"] for r in done_rows):
    done_by_text = {r["text"]: r["id"] for r in done_rows}
    for it in items:
        it["id"] = done_by_text.get(it["mms"]) or "x" + hashlib.sha1(it["mms"].encode("utf-8")).hexdigest()[:10]
    print("ชุดข้อความต่างจากรอบก่อน → ใช้ id จากเนื้อข้อความ (ท่อนที่ทำแล้วไม่ทำซ้ำ)")
todo = [it for it in items if it["id"] not in done_ids and it["id"] not in rej_ids and it["mms"] not in rej_texts]
print(f"ท่อนที่ยังไม่ได้ทำ {len(todo):,} ท่อน")
print(f"ผ่านแล้ว {len(done_ids):,} ท่อน ({acc_sec / 60:.1f} นาที) · ทิ้งแล้ว {len(rej_ids):,} · เป้าหมาย {TARGET_MIN} นาที")
if acc_sec >= TARGET_MIN * 60:
    print("✅ ครบเป้าหมายแล้ว — เพิ่ม TARGET_MIN ถ้าต้องการข้อมูลมากขึ้น")
else:
    JOB = {"out": str(OUT), "ref": str(REF_WAV), "ref_text": REF_TEXT, "model": model, "vox": VOX, "todo": todo, "need_sec": TARGET_MIN * 60 - acc_sec,
           "sr": SR, "shard": SHARD, "max_cer": MAX_CER, "cps": CPS_RANGE, "step": STEP, "cfg": CFG, "speed": SPEED, "seed": SEED,
           "next_shard": len(list(OUT.glob("shard-*.json")))}
    (pathlib.Path(BASE) / "ds_job.json").write_text(json.dumps(JOB, ensure_ascii=False))
    WORK_PY = r'''
import json, sys, os, re, io, time, tarfile, shutil, numpy as np, soundfile as sf, torch, torchaudio
from transformers import pipeline
J = json.load(open(sys.argv[1])); OUT = J["out"]
if J["vox"]:   # VoxCPM2 (Apache-2.0): เลียนเสียงตัวอย่างแบบเต็ม = prompt (เสียง+ข้อความ) + reference เสียงเดียวกัน
    from voxcpm import VoxCPM
    vox = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False); GEN_SR = vox.tts_model.sample_rate
    def normalize_text(t): return t
    def synth(text):
        return vox.generate(text=text, prompt_wav_path=J["ref"], prompt_text=J["ref_text"], reference_wav_path=J["ref"],
                            cfg_value=J["cfg"], inference_timesteps=J["step"])
else:
    from f5_tts_th.tts import TTS
    from f5_tts_th.normalize import normalize_text
    tts = TTS(model=J["model"]); GEN_SR = 24000
    def synth(text):
        return tts.infer(ref_audio=J["ref"], ref_text=J["ref_text"], gen_text=text, step=J["step"], cfg=J["cfg"], speed=J["speed"], max_chars=1000)
import transformers   # transformers 5 เปลี่ยนชื่อ torch_dtype → dtype (env ของ VoxCPM2 อาจได้รุ่น 5)
_dt = {"dtype" if int(transformers.__version__.split(".")[0]) >= 5 else "torch_dtype": torch.float16}
asr = pipeline("automatic-speech-recognition", model="biodatlab/whisper-th-medium-combined", device=0, **_dt)
SR = J["sr"]; rs = torchaudio.transforms.Resample(GEN_SR, SR)
def trim(x, db=-45.0, keep=0.05, sr=GEN_SR):
    fr = int(sr * 0.02); n = len(x) // fr
    if n == 0: return x
    e = np.array([np.sqrt(np.mean(x[i * fr:(i + 1) * fr] ** 2) + 1e-12) for i in range(n)])
    on = np.where(20 * np.log10(e) > db)[0]
    if len(on) == 0: return x[:0]
    a = max(0, on[0] * fr - int(sr * keep)); b = min(len(x), (on[-1] + 1) * fr + int(sr * keep))
    return x[a:b]
def loud(x, target=-20.0):
    rms = np.sqrt(np.mean(x ** 2) + 1e-12); y = x * (10 ** (target / 20) / rms)
    pk = np.max(np.abs(y)) + 1e-9; lim = 10 ** (-1 / 20)
    return y * (lim / pk) if pk > lim else y
def clean(t): return re.sub(r"[^ก-๎a-z]", "", normalize_text(t).lower())
def cer(a, b):
    d = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, y in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (x != y))
    return d[-1] / max(1, len(a))
need, shard_no, buf, t0, gen_sec = J["need_sec"], J["next_shard"], [], time.time(), 0.0
rejf = open(os.path.join(OUT, "rejected.jsonl"), "a", encoding="utf-8")
def flush_shard(rows):
    global shard_no
    if not rows: return
    name = f"shard-{shard_no:04d}"; tmp = f"/content/{name}.tar"
    with tarfile.open(tmp, "w") as tf:
        for r in rows:
            bio = io.BytesIO(); sf.write(bio, r.pop("_wav"), SR, subtype="PCM_16", format="WAV")
            ti = tarfile.TarInfo(f"wavs/{r['id']}.wav"); ti.size = bio.tell(); bio.seek(0); tf.addfile(ti, bio)
    part = os.path.join(OUT, name + ".tar.partial")   # คัดลอกลง Drive ให้ครบก่อนค่อยเปลี่ยนชื่อ (หลุดกลางทาง = ไม่มีก้อนครึ่งๆ)
    shutil.copy(tmp, part); os.replace(part, os.path.join(OUT, name + ".tar"))
    with open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8") as f: json.dump(rows, f, ensure_ascii=False)
    os.remove(tmp); shard_no += 1
batch = []
def judge(batch):
    global need, buf
    # VoxCPM2 จอง GPU ไว้มาก → Whisper ทีละน้อย + greedy (ไม่ใช้ beam) · หน่วยความจำไม่พอ = ล้างแคชแล้วทำทีละท่อน
    gk = {"language": "th", "task": "transcribe", **({"num_beams": 1} if J["vox"] else {})}
    inp = [{"raw": b["_wav"], "sampling_rate": SR} for b in batch]
    torch.cuda.empty_cache()
    try:
        hyps = asr(inp, batch_size=4 if J["vox"] else 16, generate_kwargs=gk)
    except torch.OutOfMemoryError:
        torch.cuda.empty_cache()
        hyps = [asr(x, generate_kwargs=gk) for x in inp]
    for b, h in zip(batch, hyps):
        c = cer(clean(b["f5"]), clean(h["text"])); cps = len(b["mms"]) / max(b["dur"], 1e-3)
        ok = c <= J["max_cer"] and J["cps"][0] <= cps <= J["cps"][1]
        if ok:
            buf.append({"id": b["id"], "text": b["mms"], "f5_text": b["f5"], "dur": round(b["dur"], 3), "cer": round(c, 4), "src": b["src"], "sr": SR, "_wav": b["_wav"]})
            need -= b["dur"]
        else:
            rejf.write(json.dumps({"id": b["id"], "text": b["mms"], "cer": round(c, 4), "cps": round(cps, 1), "hyp": h["text"][:200]}, ensure_ascii=False) + "\n"); rejf.flush()
    while len(buf) >= J["shard"]:
        flush_shard(buf[:J["shard"]]); buf = buf[J["shard"]:]
for k, it in enumerate(J["todo"]):
    if need <= 0: break
    torch.manual_seed(J["seed"] + (int(it["id"]) if it["id"].isdigit() else int(it["id"][1:], 16) % 1_000_000))   # id แบบ x+sha1 (ชุดข้อความเปลี่ยน) ไม่ใช่ตัวเลข
    try:
        w = synth(it["f5"])
    except Exception as e:
        rejf.write(json.dumps({"id": it["id"], "text": it["mms"], "error": str(e)[:200]}, ensure_ascii=False) + "\n"); continue
    x = loud(trim(np.asarray(w, dtype=np.float32)))
    if len(x) < GEN_SR // 10: rejf.write(json.dumps({"id": it["id"], "text": it["mms"], "error": "empty"}, ensure_ascii=False) + "\n"); continue
    y = rs(torch.from_numpy(x)[None])[0].numpy().astype(np.float32)
    dur = len(y) / SR; gen_sec += dur
    batch.append(dict(it, _wav=y, dur=dur))
    if len(batch) >= 32:
        judge(batch); batch = []
        el = time.time() - t0
        print(f"[{k + 1:,}/{len(J['todo']):,}] สร้าง {gen_sec / 60:.1f} นาที · เหลือต้องการอีก {max(need, 0) / 60:.1f} นาที · {el / 60:.1f} นาทีที่ผ่านไป", flush=True)
if batch: judge(batch)
flush_shard(buf)   # ก้อนสุดท้าย (อาจไม่ครบ 250)
print("DONE", flush=True)
'''
    (pathlib.Path(BASE) / "ds_work.py").write_text(WORK_PY)
    t = time.time()
    run(f"{PY} {BASE}/ds_work.py {BASE}/ds_job.json")
    print(f"รอบนี้ใช้เวลา {(time.time() - t) / 60:.0f} นาที")

# ── 4) สรุป ──
rows = [r for idx in sorted(OUT.glob("shard-*.json")) for r in json.loads(idx.read_text(encoding="utf-8"))]
rejs = [json.loads(l) for l in (OUT / "rejected.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()] if (OUT / "rejected.jsonl").exists() else []
tot = sum(r["dur"] for r in rows)
L = [f"Tanot · ชุดฝึก MMS · {name} ({'VoxCPM2' if VOX else 'F5 ' + model}, ref {ref})",
     f"ผ่าน {len(rows):,} ท่อน · {tot / 60:.1f} นาที · ทิ้ง {len(rejs):,} ท่อน ({len(rejs) / max(1, len(rows) + len(rejs)) * 100:.1f}%)",
     f"ที่มา: นิยาย {sum(r['src'] == 'novel' for r in rows):,} · ตัวเลข {sum(r['src'] == 'cover' for r in rows):,} · เพิ่มเติม {sum(r['src'] == 'extra' for r in rows):,} · หลากหัวข้อ {sum(r['src'] == 'domain' for r in rows):,} · Common Voice/Wikipedia {sum(r['src'] == 'web' for r in rows):,}",
     f"CER เฉลี่ยของที่ผ่าน {sum(r['cer'] for r in rows) / max(1, len(rows)):.3f} · ความยาวเฉลี่ย {tot / max(1, len(rows)):.1f} วิ",
     f"CER ≤ 0.03 (ใช้ฝึกในสคริปต์ 7): {sum(r['cer'] <= 0.03 for r in rows):,} ท่อน · {sum(r['dur'] for r in rows if r['cer'] <= 0.03) / 60:.1f} นาที",
     *([f"⚠️ ข้อความหมดก่อนถึงเป้าหมาย {TARGET_MIN} นาที — วางไฟล์ .txt เพิ่มใน {EXTRA} แล้วรันซ้ำ (ทำต่อจากของเดิม)"] if tot < TARGET_MIN * 60 - 60 else []),
     f"ไฟล์: {len(list(OUT.glob('shard-*.tar')))} ก้อน ใน {OUT}", "", "ตัวอย่างที่ทิ้ง (สูงสุด 15):"]
L += [f"  {x.get('id')} cer={x.get('cer', '-')} cps={x.get('cps', '-')} {x.get('error', '')}" for x in rejs[:15]]
rep = "\n".join(L); (OUT / "report.txt").write_text(rep, encoding="utf-8"); print("\n" + rep)
print(f"\n✅ เสร็จ — ส่ง report.txt จาก {OUT} กลับมา (ไม่ต้องส่งไฟล์เสียง)")
if AUTO_DISCONNECT:
    from google.colab import runtime
    print("คืนเครื่อง GPU แล้ว (ไฟล์อยู่ใน Drive)"); runtime.unassign()
