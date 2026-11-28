# Tanot — สคริปต์ 14: อัปโหลดเสียง VITS จากศูนย์ (voice-เลือกแล้ว/ จากสคริปต์ 13) ขึ้น Hugging Face แบบ private
#
# วิธีใช้ (Colab → ไม่ต้องใช้ GPU: Runtime → Change runtime type → CPU → วางทั้งไฟล์ใน cell เดียว → Run)
#   ใช้ Secret HF_TOKEN (แบบ Write) ตัวเดิมของสคริปต์ 7 · ห้ามวาง token ลงในโค้ด/แชท
#   ราว 1–2 นาที · repo สร้างเป็น private ตั้งแต่แรก · อัปซ้ำ = ทับไฟล์เดิม (รุ่นก่อนอยู่ในประวัติ commit ย้อนได้)
#   จบแล้วส่งเลข commit (40 ตัว) กลับมา → ใช้ล็อกรุ่นโมเดลใน media-models.js (TTS_REVISION)

SPEAKER = "หญิง-ใหม่"  # "หญิง-ใหม่" · "ชาย-ใหม่" — ตรงกับสคริปต์ 12/13
VOICE, HF_REPO, NAME = {
    "หญิง-ใหม่": ("หญิง-V012-22k", "Tanotfin/vits-thai-nat-onnx", "Nat"),  # Nat = หญิง-V012
    "ชาย-ใหม่": ("ชาย-V003-22k", "Tanotfin/vits-thai-v003-onnx", "ชาย-V003"),
}[SPEAKER]
FOLDER = "voice-เลือกแล้ว"  # ผลของสคริปต์ 13 · ใช้ "voice" ถ้าจะอัปตัวล่าสุดของสคริปต์ 12 แทน
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง"

import json
import pathlib
import re

from google.colab import drive, userdata

drive.mount("/content/drive")
OUT = pathlib.Path(DRIVE_DIR) / "_ชุดฝึก-MMS" / VOICE / "จากศูนย์"
src = OUT / FOLDER
need = ["config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "onnx/model.onnx"]
miss = [f for f in need if not (src / f).exists()]
if miss:
    raise SystemExit(f"❌ ไม่พบใน {src}: {', '.join(miss)} — รันสคริปต์ 13 ให้จบก่อน")
cfg = json.loads((src / "config.json").read_text())
size = (src / "onnx" / "model.onnx").stat().st_size / 1e6
print(f"ต้นทาง: {src}")
print(f"  model.onnx {size:.0f} MB · speaking_rate {cfg.get('speaking_rate')} · {cfg.get('sampling_rate')} Hz")
if size < 50:
    raise SystemExit("❌ model.onnx เล็กผิดปกติ — ไฟล์อาจเสีย")
picked = ""
rep = OUT / "report-เลือก.txt"
if FOLDER == "voice-เลือกแล้ว" and rep.exists():
    m = re.search(r"ดีที่สุด: (\S+)", rep.read_text(encoding="utf-8"))
    picked = m.group(1) if m else ""

try:
    token = userdata.get("HF_TOKEN")
except Exception:  # noqa: BLE001 — userdata โยนได้หลายแบบ (ไม่มี secret / ไม่เปิด access)
    raise SystemExit("❌ ยังไม่ได้ตั้ง Secret HF_TOKEN (แถบซ้าย 🔑) หรือยังไม่เปิด Notebook access") from None

CARD = f"""---
language: th
pipeline_tag: text-to-speech
library_name: transformers.js
tags: [vits, onnx, thai]
---
# {NAME} — Thai VITS voice (ONNX)

- VITS trained **from random initialization** (no MMS / F5 weights) with a tokenizer of Thai letters.
- Training audio: synthesized with VoxCPM2 (Apache-2.0) from a designed reference voice (not a real person).
- Text: owner's own writing, self-written sentences, Common Voice (CC0) and Wikipedia (CC BY-SA).
- Checkpoint {picked or '-'} chosen by CER (Thonburian Whisper) · speaking_rate {cfg.get('speaking_rate')} embedded.
- Input text must be normalized like `tts-normalize.js` (numbers as words, ำ split to ํ + า).
"""
(src / "README.md").write_text(CARD, encoding="utf-8")

from huggingface_hub import HfApi

api = HfApi(token=token)
api.create_repo(HF_REPO, private=True, exist_ok=True)
api.upload_folder(
    folder_path=str(src),
    repo_id=HF_REPO,
    allow_patterns=[*need, "vocab.json", "README.md"],
    commit_message=f"{NAME} {picked or FOLDER}",
)
info = api.model_info(HF_REPO)
print(f"\n✅ อัปโหลดแล้ว: {HF_REPO} ({'private' if info.private else '⚠️ PUBLIC — ตั้งเป็น private ใน Settings ของ repo'})")
print(f"   ไฟล์: {', '.join(sorted(s.rfilename for s in info.siblings))}")
print(f"   commit: {info.sha}  ← ส่งเลขนี้กลับมา (ใช้ล็อกรุ่นโมเดลในเว็บ)")
