# Tanot — ดึงตารางตำแหน่ง (pos_embed 128×128×1152) ออกจากน้ำหนักของ iapp/OpenThai2.0-OCR-Markdown เป็น pos_embed.f16.bin สำหรับ iapp-pre.js
# ใช้บน Colab (ไม่ต้องมี GPU) หรือเครื่อง local: โหลดเฉพาะ tensor นี้จาก model.safetensors (ดาวน์โหลดไฟล์ ~2.5 GB ครั้งแรก) · ผลลัพธ์: <OUT>/pos_embed.f16.bin (37.7 MiB, float16 little-endian, [16384,1152] เรียงแถว (y,x) × ช่อง)
import pathlib, subprocess, sys
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/content/drive/MyDrive/Tanot หนังสือเสียง/_OCR-iApp/pre"); OUT.mkdir(parents=True, exist_ok=True)
REV = "7a153712e5b50fac7e4a9d42ccf9ec41fb4202f0"
subprocess.run([sys.executable, "-m", "pip", "-q", "install", "safetensors", "huggingface_hub", "numpy"], check=True)
import numpy as np
from huggingface_hub import hf_hub_download
from safetensors import safe_open
f = hf_hub_download("iapp/OpenThai2.0-OCR-Markdown", "model.safetensors", revision=REV)
with safe_open(f, "pt") as sf:
    keys = [k for k in sf.keys() if "pos_embed" in k]
    print("พบคีย์:", keys, [tuple(sf.get_slice(k).get_shape()) for k in keys])
    key = next(k for k in keys if tuple(sf.get_slice(k).get_shape()) == (1, 16384, 1152))
    t = sf.get_tensor(key).float().numpy().reshape(16384, 1152)
h = t.astype("<f2")
err = float(np.abs(h.astype(np.float32) - t).max()); rel = float((np.abs(h.astype(np.float32) - t) / (np.abs(t) + 1e-6)).max())
print(f"{key} · min {t.min():.4f} max {t.max():.4f} · fp16 คลาดสูงสุด {err:.2e} (สัมพัทธ์ {rel:.2e}) · มี NaN/Inf: {not np.isfinite(h.astype(np.float32)).all()}")
h.tofile(OUT / "pos_embed.f16.bin")
print("เขียน", OUT / "pos_embed.f16.bin", (OUT / "pos_embed.f16.bin").stat().st_size / 2**20, "MiB")
