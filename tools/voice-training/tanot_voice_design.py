# Tanot — สคริปต์ 10: สร้าง "เสียงอ้างอิง" ใหม่จากคำบรรยาย ด้วย VoxCPM2 (voice design) — รันในเครื่อง (GPU 8 GB)
#
# ทำไม
#   Jori / Riko ติด CC-BY-NC (ฐาน MMS + F5-TTS-THAI + เสียงตัวอย่างจาก Gemini) → ใช้ได้แค่ส่วนตัว
#   สคริปต์นี้สร้างเสียงที่ไม่ใช่ของใคร จากคำบรรยายลักษณะเสียงอย่างเดียว (ไม่ใช้คลิปของใคร)
#   VoxCPM2 = Apache-2.0 (weights + code) · รองรับภาษาไทย · ห้ามใช้ปลอมตัวเป็นคนจริง / ฉ้อโกง / ข่าวปลอม
#
# ทำอะไร
#   สร้างเสียงหลายแบบ (คนละ seed) อ่านประโยคอ้างอิงเดียวกัน → ตัดเงียบหัวท้าย → ปรับความดัง −20 dBFS
#   → <out>/<ชื่อ>-<seed>.wav (48 kHz) + <ชื่อ>-<seed>.txt (ข้อความที่อ่าน = prompt_text ตอนเลียนเสียง)
#   + candidates.tsv (seed, ความยาว, คำบรรยาย) → ฟังแล้วเลือกไฟล์ที่ชอบ = เสียงอ้างอิงของเสียงใหม่
#
# ขั้นต่อไป (Colab): ใช้ไฟล์ที่เลือกเป็น reference ให้ VoxCPM2 อ่านข้อความหลายพันประโยค → คัดด้วย Whisper → ฝึก VITS
#
# ติดตั้ง (PowerShell ปกติ ไม่ใช่ในแอป Claude) — ดู README.md หัวข้อ "สร้างเสียงอ้างอิงในเครื่อง"
# วิธีใช้
#   python tanot_voice_design.py --voice หญิง
#   python tanot_voice_design.py --voice ชาย --n 8
#   python tanot_voice_design.py --desc "A Thai man in his forties, deep and calm voice" --name ชาย-ลึก
#   python tanot_voice_design.py --voice หญิง --lora E:\voxcpm\SiangTTS   (LoRA ภาษาไทย CC-BY-SA — ไม่บังคับ)
# ครั้งแรกจะดาวน์โหลด openbmb/VoxCPM2 (~5 GB) ลง Hugging Face cache

import argparse
import csv
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

# คำบรรยายเสียง (ภาษาอังกฤษ ตามตัวอย่างของ VoxCPM2) — แก้ได้ หรือใช้ --desc
PRESETS = {
    "หญิง": (
        "หญิง",
        "A Thai woman in her late twenties, warm, clear and gentle voice, calm natural pace, studio quality",
    ),
    "ชาย": (
        "ชาย",
        "A Thai man in his early thirties, warm, clear and friendly voice, calm natural pace, studio quality",
    ),
}
# ประโยคอ้างอิง: ~10–15 วินาที มีวรรณยุกต์ครบ สระสั้น/ยาว ตัวสะกดหลายแบบ ไม่มีตัวเลข/ตัวย่อ
REF_TEXT = "ถ้าเราไม่ลองตอนนี้ ก็ไม่มีวันรู้หรอกว่าผลจะออกมาเป็นอย่างไร เช้าวันพรุ่งนี้ค่อยมานั่งคุยกันใหม่ ที่ร้านกาแฟหลังเล็กใกล้สะพานข้ามแม่น้ำนะ"
TARGET_DBFS = -20.0
SILENCE_DB = -45.0


def trim_and_level(wav: np.ndarray, sr: int) -> np.ndarray:
    """ตัดเงียบหัวท้าย (เหลือขอบ 0.1 วินาที) แล้วปรับความดังเฉลี่ยเป็น TARGET_DBFS"""
    wav = wav.astype(np.float32)
    frame = max(1, sr // 100)
    n = len(wav) // frame
    if n == 0:
        return wav
    rms = np.sqrt(np.mean(wav[: n * frame].reshape(n, frame) ** 2, axis=1) + 1e-12)
    loud = np.nonzero(20 * np.log10(rms) > SILENCE_DB)[0]
    if len(loud):
        pad = sr // 10
        wav = wav[max(0, loud[0] * frame - pad) : min(len(wav), (loud[-1] + 1) * frame + pad)]
    level = 20 * np.log10(np.sqrt(np.mean(wav**2)) + 1e-12)
    wav = wav * 10 ** ((TARGET_DBFS - level) / 20)
    peak = np.max(np.abs(wav))
    return wav / peak * 0.98 if peak > 0.98 else wav


def load_model(lora: Path | None):
    from voxcpm import VoxCPM

    if lora is None:
        return VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False)
    from voxcpm.model.voxcpm2 import LoRAConfig

    cfg = json.loads((lora / "lora_config.json").read_text(encoding="utf-8"))["lora_config"]
    return VoxCPM.from_pretrained(
        "openbmb/VoxCPM2", load_denoiser=False, lora_config=LoRAConfig(**cfg), lora_weights_path=str(lora)
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="สร้างเสียงอ้างอิงใหม่จากคำบรรยาย ด้วย VoxCPM2")
    ap.add_argument("--voice", choices=sorted(PRESETS), default="หญิง", help="คำบรรยายสำเร็จรูป")
    ap.add_argument("--desc", help="คำบรรยายเสียงเอง (แทน --voice)")
    ap.add_argument("--name", help="ชื่อไฟล์ (ค่าเริ่ม = ชื่อของ --voice)")
    ap.add_argument("--text", default=REF_TEXT, help="ประโยคที่ให้อ่าน")
    ap.add_argument("--n", type=int, default=6, help="จำนวนแบบที่สร้าง (คนละ seed)")
    ap.add_argument("--seed", type=int, default=1, help="seed แรก")
    ap.add_argument("--cfg", type=float, default=2.0, help="cfg_value (สูง = ตามคำบรรยายมากขึ้น)")
    ap.add_argument("--steps", type=int, default=10, help="inference_timesteps (สูง = ช้าลง ละเอียดขึ้น)")
    ap.add_argument("--lora", type=Path, help="โฟลเดอร์ LoRA (lora_config.json + lora_weights.safetensors) เช่น SiangTTS")
    ap.add_argument("--out", type=Path, default=Path(r"E:\voxcpm\เสียงอ้างอิง"), help="โฟลเดอร์ผล (นอก repo)")
    a = ap.parse_args()

    name, desc = PRESETS[a.voice]
    if a.desc:
        desc, name = a.desc, a.name or "เสียงใหม่"
    elif a.name:
        name = a.name
    if a.lora:
        name += "-lora"
    a.out.mkdir(parents=True, exist_ok=True)

    print(f"โหลด VoxCPM2{' + LoRA ' + str(a.lora) if a.lora else ''} ...", flush=True)
    model = load_model(a.lora)
    sr = model.tts_model.sample_rate

    rows = []
    for seed in range(a.seed, a.seed + a.n):
        # voxcpm 2.0.x ไม่มี seed ใน generate() → ตั้ง seed ของ torch/numpy เอง (ได้เสียงเดิมเมื่อ seed เดิม)
        torch.manual_seed(seed)
        np.random.seed(seed)
        wav = model.generate(text=f"({desc}){a.text}", cfg_value=a.cfg, inference_timesteps=a.steps)
        wav = trim_and_level(np.asarray(wav), sr)
        path = a.out / f"{name}-{seed:03d}.wav"
        sf.write(path, wav, sr)
        path.with_suffix(".txt").write_text(a.text + "\n", encoding="utf-8")
        secs = len(wav) / sr
        rows.append((path.name, seed, f"{secs:.1f}", a.cfg, a.steps, desc))
        print(f"  {path.name}  {secs:.1f} s", flush=True)

    tsv = a.out / "candidates.tsv"
    new = not tsv.exists()
    with tsv.open("a", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t")
        if new:
            w.writerow(["file", "seed", "seconds", "cfg", "steps", "description"])
        w.writerows(rows)
    print(f"เสร็จ: {a.out} — ฟังแล้วเลือกไฟล์ที่ชอบ (ยาว 8–20 วินาที ไม่มีเสียงแตก/อ่านข้าม)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
