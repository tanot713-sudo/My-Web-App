# Tanot — สคริปต์ 7b: อัปโหลดโมเดล MMS ที่ฝึกแล้ว (ONNX จากสคริปต์ 7) ขึ้น Hugging Face เอง
#   ใช้เมื่อสคริปต์ 7 "ข้าม" การอัปโหลด (CER ชุดทดสอบไม่ต่ำกว่ารอบก่อน) แต่ฟังแล้วชอบรอบนี้มากกว่า
#
# วิธีใช้ (Colab → ไม่ต้องใช้ GPU: Runtime → Change runtime type → CPU → วางทั้งไฟล์ใน cell เดียว → Run)
#   ใช้ Secret HF_TOKEN (แบบ Write) ตัวเดิมที่สคริปต์ 7 ใช้ · ห้ามวาง token ลงในโค้ด/แชท
#   ราว 1–2 นาที · ทับไฟล์เดิมใน repo (รุ่นก่อนยังอยู่ในประวัติ commit ของ Hugging Face ย้อนกลับได้)

SPEAKER = "ชาย"                                # "หญิง" = Jori · "ชาย" = Riko
RUN = "รอบ2"                                  # โฟลเดอร์ ฝึกแล้ว-<RUN> · Jori รอบแรก = "" (โฟลเดอร์ ฝึกแล้ว) · Riko รอบแรก = "รอบแรก"
VOICE, HF_REPO = {"หญิง": ("หญิง-F-C-22k", "Tanotfin/mms-thai-jori-f5-onnx"), "ชาย": ("ชาย-M-C-22k", "Tanotfin/mms-thai-riko-f5-onnx")}[SPEAKER]
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง"

import pathlib
from google.colab import drive, userdata
drive.mount("/content/drive")
src = pathlib.Path(DRIVE_DIR) / "_ชุดฝึก-MMS" / VOICE / (f"ฝึกแล้ว-{RUN}" if RUN else "ฝึกแล้ว") / "onnx-repo"
if not (src / "onnx" / "model.onnx").exists():
    raise SystemExit(f"❌ ไม่พบ {src}/onnx/model.onnx — สคริปต์ 7 ของรอบนี้แปลง ONNX ไม่สำเร็จหรือยังไม่ได้รัน")
try:
    token = userdata.get("HF_TOKEN")
except Exception:
    raise SystemExit("❌ ยังไม่ได้ตั้ง Secret HF_TOKEN (แถบซ้าย 🔑) หรือยังไม่เปิด Notebook access")

from huggingface_hub import HfApi
api = HfApi(token=token)
api.create_repo(HF_REPO, private=True, exist_ok=True)
info = api.upload_folder(folder_path=str(src), repo_id=HF_REPO, commit_message=f"{VOICE} {RUN or 'รอบแรก'}")
sha = api.model_info(HF_REPO).sha
print(f"✅ อัปโหลดแล้ว: {HF_REPO} (private) จาก {src}")
print(f"   commit: {sha}  ← ส่งเลขนี้กลับมา (ใช้ล็อกรุ่นโมเดลในเว็บ)")
