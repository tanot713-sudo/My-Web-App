# Tanot — สคริปต์ 12: ฝึก VITS จากศูนย์ (ไม่ใช้ MMS) ด้วยชุดข้อมูล VoxCPM2 จากสคริปต์ 6 → ONNX แบบเดียวกับ Jori/Riko
#
# ทำไม
#   Jori/Riko ฝึกต่อจาก MMS (CC-BY-NC) → โมเดลติด NC แม้เปลี่ยนข้อมูล · สคริปต์นี้เริ่มจากน้ำหนักสุ่ม:
#   ไม่ใช้ generator / discriminator / tokenizer ของ MMS เลย (สถาปัตยกรรม VITS เป็นแค่ตัวเลขขนาดชั้น)
#   ที่มา: เสียงตัวอย่าง = VoxCPM2 voice design (Apache-2.0) · ชุดข้อมูล = VoxCPM2 · ข้อความ = นิยายของเจ้าของ + ประโยคแต่งเอง
#   + Common Voice (CC0) + Wikipedia (CC BY-SA) · เครื่องมือฝึก ylacombe/finetune-hf-vits
#
# ทำอะไร
#   1) ชุดข้อมูลจาก Drive _ชุดฝึก-MMS/<VOICE>/ (สคริปต์ 6 SPEAKER "หญิง-ใหม่"/"ชาย-ใหม่") → train/test (test 40 ท่อนคงที่)
#   2) จุดเริ่มสุ่ม + tokenizer ตัวอักษรไทยของเราเอง (ช่องว่างระหว่างตัว = "_" ไม่ใช่ "า" แบบ MMS)
#   3) ฝึกทีละ session ได้สูงสุด SESSION_HOURS ชม. → checkpoint ทุก SAVE_EVERY step ลง Drive → รันซ้ำ = ฝึกต่อ
#   4) ทุกครั้งที่จบ session: ทำโมเดลจาก checkpoint ล่าสุด → เสียงทดสอบ + Whisper วัด CER → ONNX ลง Drive (ฟังความคืบหน้าได้)
#   ผล: _ชุดฝึก-MMS/<VOICE>/จากศูนย์/ (ckpt-v2/ · voice/ = โฟลเดอร์เสียงสำหรับ TanotPDF · ตัวอย่างฟัง/ · report.txt)
#
# วิธีใช้ (Colab → Runtime → Change runtime type → L4 GPU (หรือ A100) → วางทั้งไฟล์ใน cell เดียว → Run)
#   ราว 1.2 step/วินาที บน L4 (batch 24) → 100,000 step ≈ 23 ชม. = 2–3 session · A100 เร็วกว่าราว 2 เท่า
#   CER ลดเร็วช่วง 20k–40k step แรก แล้วค่อยๆ ดีขึ้น — ฟังไฟล์ใน ตัวอย่างฟัง/ หลังแต่ละ session แล้วตัดสินใจว่าพอหรือยัง
#   ใช้กับ TanotPDF: คัดลอก voice/ ทั้งโฟลเดอร์ไปที่ E:\TanotPDF\voices\<ชื่อเสียง>\

SPEAKER = "หญิง-ใหม่"  # "หญิง-ใหม่" · "ชาย-ใหม่" — ต้องตรงกับที่รันสคริปต์ 6
VOICE = {"หญิง-ใหม่": "หญิง-V012-22k", "ชาย-ใหม่": "ชาย-V003-22k"}[SPEAKER]
MAX_STEPS = 85_000  # รวมทุก session · รอบแรก 60k (ข้อมูล 4.8 ชม.) → รอบ 2 ฝึกต่อถึง 85k ด้วยข้อมูล ~10 ชม. (~6 ชม. L4)
SESSION_HOURS = 5.0  # ฝึกรอบนี้นานสุดกี่ชั่วโมง แล้วหยุดทำโมเดลตัวอย่าง (Colab Pro ตัดที่ ~24 ชม.)
SAVE_EVERY = 1000  # checkpoint ลง Drive ทุกกี่ step (หลุดกลางทาง = เสียไม่เกินเท่านี้)
BATCH = 24
LR = 2e-4  # ค่ามาตรฐาน VITS ฝึกจากศูนย์ (สคริปต์ 7 ที่ฝึกต่อใช้ 2e-5)
GAN_WARMUP = 4000  # step แรกที่ generator เรียนแค่ mel/kl/duration ก่อนเริ่มสู้กับ discriminator
MAX_GRAD_NORM = 5.0  # ตัด gradient ที่ใหญ่ผิดปกติ
EVAL_N = 40
MAX_TRAIN_CER = 0.05  # ฝึกเฉพาะท่อนที่ Whisper ฟังกลับผิด ≤ ค่านี้
SPEED = 0.85  # speaking_rate ฝังใน ONNX — ช้าลงนิดฟังชัดขึ้น (Jori 0.8 · Riko 0.75) · ปรับภายหลังได้ด้วยสคริปต์ 9
NOISE = (0.1, 0.0)  # (noise_scale, noise_scale_duration) เหมือนเสียงเดิม
AUTO_DISCONNECT = True
SEED = 789
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง"
RAW = "https://raw.githubusercontent.com/tanot713-sudo/My-Web-App/main/"
SAMPLE_TEXT = "สวัสดีครับ วันนี้อากาศดีมาก เหมาะกับการออกไปเดินเล่นที่สวนสาธารณะ"
NEUTRAL = [
    "สวัสดีครับ วันนี้อากาศดีมาก เหมาะกับการออกไปเดินเล่นที่สวนสาธารณะ",
    "ราคาสินค้าชิ้นนี้อยู่ที่ 1,250 บาท ลดเหลือ 999 บาทถึงวันที่ 15 ตุลาคม",
    "เด็กๆ วิ่งเล่นกันอย่างสนุกสนาน ส่วนผู้ใหญ่นั่งคุยกันใต้ต้นไม้ใหญ่",
    "กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนกดปุ่มบันทึก",
    "เขาเปิดคอมพิวเตอร์ แล้วส่งอีเมลถึงทีมงานทุกคนก่อนเที่ยง",
    "ถนนสายนี้รถติดมากในช่วงเย็น ควรออกจากบ้านเร็วขึ้นสักครึ่งชั่วโมง",
    "ขอบคุณครับ",
]
# ตัวอักษรที่โมเดลรู้จัก: ข้อความที่ตัวแปลงของเว็บ/TanotPDF ส่งให้ (ตัวเลขเป็นคำแล้ว · ำ แยกเป็น ํ + า · ไม่มี ๆ ฯ)
# id 0 = "_" ช่องว่างระหว่างตัวอักษร (add_blank) · ไม่ใช้ตารางของ MMS
THAI = [chr(c) for c in range(0x0E01, 0x0E2F)] + [chr(c) for c in range(0x0E30, 0x0E3B) if c != 0x0E33]
THAI += [chr(c) for c in range(0x0E40, 0x0E4E) if c != 0x0E46]
VOCAB = {ch: i for i, ch in enumerate(["_", " ", "'", "-", *THAI])}
VOCAB["<unk>"] = len(VOCAB)
# ขนาดชั้นของ VITS (เท่ากับเสียงเดิม — ONNX เข้ากับ TanotPDF/เว็บแน่นอน) · น้ำหนักสุ่มทั้งหมด
ARCH = {
    "hidden_size": 192,
    "num_hidden_layers": 6,
    "num_attention_heads": 2,
    "window_size": 4,
    "use_bias": True,
    "ffn_dim": 768,
    "layerdrop": 0.1,
    "ffn_kernel_size": 3,
    "flow_size": 192,
    "spectrogram_bins": 513,
    "hidden_act": "relu",
    "hidden_dropout": 0.1,
    "attention_dropout": 0.1,
    "activation_dropout": 0.1,
    "initializer_range": 0.02,
    "layer_norm_eps": 1e-5,
    "use_stochastic_duration_prediction": True,
    "num_speakers": 1,
    "speaker_embedding_size": 0,
    "upsample_initial_channel": 512,
    "upsample_rates": [8, 8, 2, 2],
    "upsample_kernel_sizes": [16, 16, 4, 4],
    "resblock_kernel_sizes": [3, 7, 11],
    "resblock_dilation_sizes": [[1, 3, 5], [1, 3, 5], [1, 3, 5]],
    "leaky_relu_slope": 0.1,
    "depth_separable_channels": 2,
    "depth_separable_num_layers": 3,
    "duration_predictor_flow_bins": 10,
    "duration_predictor_tail_bound": 5.0,
    "duration_predictor_kernel_size": 3,
    "duration_predictor_dropout": 0.5,
    "duration_predictor_num_flows": 4,
    "duration_predictor_filter_channels": 256,
    "prior_encoder_num_flows": 4,
    "prior_encoder_num_wavenet_layers": 4,
    "posterior_encoder_num_wavenet_layers": 16,
    "wavenet_kernel_size": 5,
    "wavenet_dilation_rate": 1,
    "wavenet_dropout": 0.0,
    "speaking_rate": 1.0,
    "noise_scale": 0.667,
    "noise_scale_duration": 0.8,
    "sampling_rate": 22050,
    "segment_size": 8192,
    "hop_length": 256,
    "discriminator_kernel_size": 5,
    "discriminator_stride": 3,
    "discriminator_periods": [2, 3, 5, 7, 11],
    "discriminator_period_channels": [1, 32, 128, 512, 1024],
    "discriminator_scale_channels": [1, 16, 64, 256, 1024],
}

import csv
import json
import os
import pathlib
import random
import shutil
import signal
import subprocess
import tarfile
import time
import urllib.request

os.environ["MPLBACKEND"] = "Agg"
os.environ["WANDB_DISABLED"] = "true"


def run(cmd, env=None, seconds=None):
    """รันคำสั่ง พิมพ์ผลทีละบรรทัด · seconds = หยุดเมื่อครบเวลา (คืน False) · ล้ม = หยุดสคริปต์"""
    print("$", cmd, flush=True)
    p = subprocess.Popen(
        cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env, start_new_session=True
    )
    end = time.time() + seconds if seconds else None
    for line in p.stdout:
        print(line, end="", flush=True)
        if end and time.time() > end:
            print(f"⏱️ ครบ {SESSION_HOURS} ชม. — หยุดฝึกรอบนี้ (ฝึกต่อจาก checkpoint ล่าสุดเมื่อรันซ้ำ)", flush=True)
            os.killpg(p.pid, signal.SIGTERM)
            p.wait()
            return False
    if p.wait():
        raise SystemExit(f"❌ คำสั่งล้ม (code {p.returncode}) — คัดลอกข้อความด้านบนส่งกลับมา")
    return True


# ── 0) GPU + Drive ──
gpu = subprocess.run(
    "nvidia-smi --query-gpu=name --format=csv,noheader", shell=True, capture_output=True, text=True, check=False
).stdout.strip()
print("GPU:", gpu or "ไม่มี")
if not gpu:
    raise SystemExit("❌ ยังไม่ได้เปิด GPU — Runtime → Change runtime type → L4 GPU → Save แล้วรัน cell นี้ใหม่")
from google.colab import drive

drive.mount("/content/drive")
SRC = pathlib.Path(DRIVE_DIR) / "_ชุดฝึก-MMS" / VOICE
if not list(SRC.glob("shard-*.tar")):
    raise SystemExit(f"❌ ไม่พบชุดข้อมูลใน {SRC} — รันสคริปต์ 6 (SPEAKER = {SPEAKER!r}) ก่อน")
OUT = SRC / "จากศูนย์"
CK = OUT / "ckpt-v2"  # รอบแรก (ckpt/) พังเป็น NaN — ลบทิ้งใน Drive ได้
CK.mkdir(parents=True, exist_ok=True)

# ── 1) สภาพแวดล้อม (เหมือนสคริปต์ 7) ──
W = pathlib.Path("/content/tanot_vits")
W.mkdir(exist_ok=True)
TENV = f"{W}/tenv"
TPY = f"{TENV}/bin/python"
if not os.path.exists(f"{TENV}/.ok"):
    run("pip -q install uv")
    run(f"uv venv {TENV} --python 3.11 -q")
    run(
        f"uv pip install -q --python {TPY} torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu121"
    )
    run(
        f'uv pip install -q --python {TPY} "transformers==4.46.3" "datasets[audio]==3.1.0" "accelerate==1.1.1" '
        f'"optimum[exporters]==1.23.3" "numpy<2" soundfile librosa tensorboard Cython setuptools onnx onnxruntime '
        f'"pyarrow==17.0.0" "pandas<3" "matplotlib<3.10"'
    )
    pathlib.Path(f"{TENV}/.ok").write_text("ok")
FT = W / "finetune-hf-vits"
if not (FT / "monotonic_align" / ".built").exists():
    if not FT.exists():
        run(f"git clone -q --depth 1 https://github.com/ylacombe/finetune-hf-vits.git {FT}")
    run(f'cd "{FT}/monotonic_align" && mkdir -p monotonic_align && {TPY} setup.py build_ext --inplace')
    (FT / "monotonic_align" / ".built").write_text("ok")
_rv = FT / "run_vits_finetuning.py"
_src = _rv.read_text()
if 'speaker_id=batch["speaker_id"]' in _src:  # transformers 4.46: BatchEncoding.to() ทิ้ง speaker_id=None (สคริปต์ 7)
    _src = _src.replace('speaker_id=batch["speaker_id"]', 'speaker_id=batch.get("speaker_id")')
    _rv.write_text(_src)
# ฝึกจากศูนย์ให้เสถียร (รอบแรกพังเป็น NaN ที่ ~14k step):
#   a) discriminator ไม่ได้ zero_grad ก่อน backward → gradient จากฝั่ง generator ไหลมาปน → GAN แกว่งจน loss หลักพัน
#   b) GAN_WARMUP step แรก generator เรียนแค่ mel/kl/duration (ยังไม่สู้กับ discriminator) ให้เสียงเป็นรูปเป็นร่างก่อน
#   c) step ที่ loss / grad ไม่ใช่ตัวเลข (NaN/inf) → ข้าม ไม่ให้น้ำหนักเสีย · เจอติดกัน 200 step → หยุด (checkpoint ก่อนหน้ายังดี)
_TANOT = [
    (
        "    global_step = 0\n",
        "    global_step = 0\n    tanot_bad = 0\n",
    ),
    (
        """                # backpropagate
                accelerator.backward(loss_disc * training_args.weight_disc)
                if accelerator.sync_gradients:
                    accelerator.clip_grad_norm_(discriminator.parameters(), training_args.max_grad_norm)
                disc_optimizer.step()
""",
        """                # backpropagate (tanot: zero_grad ก่อน + warmup + ข้าม NaN)
                gan_on = global_step >= int(os.environ.get("TANOT_GAN_WARMUP", "0"))
                disc_optimizer.zero_grad()
                if gan_on and bool(torch.isfinite(loss_disc)):
                    accelerator.backward(loss_disc * training_args.weight_disc)
                    gn = accelerator.clip_grad_norm_(discriminator.parameters(), training_args.max_grad_norm)
                    if gn is None or bool(torch.isfinite(gn)):
                        disc_optimizer.step()
""",
    ),
    (
        """                    + loss_fmaps * training_args.weight_fmaps
                    + loss_gen * training_args.weight_gen
                )
""",
        """                    + (loss_fmaps * training_args.weight_fmaps + loss_gen * training_args.weight_gen) * float(gan_on)
                )
""",
    ),
    (
        """                accelerator.backward(total_generator_loss)
                if accelerator.sync_gradients:
                    accelerator.clip_grad_norm_(model.parameters(), training_args.max_grad_norm)
                gen_optimizer.step()
""",
        """                gen_ok = bool(torch.isfinite(total_generator_loss))
                if gen_ok:
                    accelerator.backward(total_generator_loss)
                    gn = accelerator.clip_grad_norm_(model.parameters(), training_args.max_grad_norm)
                    gen_ok = gn is None or bool(torch.isfinite(gn))
                    if gen_ok:
                        gen_optimizer.step()
                tanot_bad = 0 if gen_ok else tanot_bad + 1
                if tanot_bad >= 200:
                    raise SystemExit("TANOT_NAN: loss เป็น NaN ติดกัน 200 step")
""",
    ),
]
if "tanot_bad" not in _src:
    for _a, _b in _TANOT:
        if _src.count(_a) != 1:
            raise SystemExit("❌ แก้ run_vits_finetuning.py ไม่ได้ (โค้ดต้นทางเปลี่ยน): " + _a.strip()[:60])
        _src = _src.replace(_a, _b)
    _rv.write_text(_src)
_pl = FT / "utils" / "plot.py"
_ps = _pl.read_text()
if "tostring_rgb()" in _ps:  # matplotlib 3.10 ตัด tostring_rgb (สคริปต์ 7)
    _pl.write_text(
        _ps.replace(
            "np.frombuffer(fig.canvas.tostring_rgb(), dtype=np.uint8)",
            "np.ascontiguousarray(np.asarray(fig.canvas.buffer_rgba())[..., :3]).reshape(-1)",
        )
    )

# ── 2) ชุดข้อมูล → audiofolder (train/ test/ + metadata.csv) ──
DS = W / "ds"
if DS.exists():
    shutil.rmtree(DS)
(DS / "train").mkdir(parents=True)
(DS / "test").mkdir(parents=True)
rows = []
for idx in sorted(SRC.glob("shard-*.json")):
    tar = idx.with_suffix(".tar")
    if not tar.exists():
        continue
    with tarfile.open(tar) as tf:
        tf.extractall(W / "wavs_raw")
    rows += json.loads(idx.read_text(encoding="utf-8"))
TEST_IDS = SRC / "test-ids.json"
if TEST_IDS.exists():
    keep = set(json.loads(TEST_IDS.read_text(encoding="utf-8")))
else:
    pick = list(rows)
    random.Random(SEED).shuffle(pick)
    keep = {r["id"] for r in pick[:EVAL_N]}
    TEST_IDS.write_text(json.dumps(sorted(keep)))
test = [r for r in rows if r["id"] in keep]
train = [r for r in rows if r["id"] not in keep and r.get("cer", 0) <= MAX_TRAIN_CER]
unknown = sorted({ch for r in rows for ch in r["text"] if ch not in VOCAB})
for split, rs in (("train", train), ("test", test)):
    with open(DS / split / "metadata.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file_name", "text"])
        for r in rs:
            shutil.move(str(W / "wavs_raw" / "wavs" / f"{r['id']}.wav"), DS / split / f"{r['id']}.wav")
            w.writerow([f"{r['id']}.wav", r["text"]])
train_min = sum(r["dur"] for r in train) / 60
print(f"ชุดข้อมูล: ฝึก {len(train):,} ท่อน ({train_min:.1f} นาที, CER ≤ {MAX_TRAIN_CER}) · ทดสอบ {len(test)} ท่อน")
if unknown:
    print("⚠️ ตัวอักษรที่ไม่อยู่ในตาราง (ถูกข้าม):", "".join(unknown))
if train_min < 180:
    print("⚠️ ข้อมูลฝึกน้อยกว่า 3 ชม. — ฝึกจากศูนย์มักออกเสียงไม่ชัด ควรรันสคริปต์ 6 เพิ่มก่อน (เป้า 10–12 ชม.)")

# ── 3) จุดเริ่มสุ่ม (ครั้งแรกเท่านั้น — เก็บใน Drive เพื่อให้ทุก session เริ่มจากน้ำหนักชุดเดียวกัน) ──
START = OUT / "start"
INIT_PY = r"""
import json, sys, torch
sys.path.insert(0, sys.argv[2])
from utils import VitsConfig, VitsFeatureExtractor, VitsModelForPreTraining
from transformers import VitsTokenizer
start, c = sys.argv[1], json.loads(open(sys.argv[3], encoding="utf-8").read())
torch.manual_seed(c["seed"])
json.dump(c["vocab"], open(start + "/vocab.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
tk = VitsTokenizer(start + "/vocab.json", pad_token="_", unk_token="<unk>", language="tha", add_blank=True,
                   normalize=True, phonemize=False, is_uroman=False)
cfg = VitsConfig(vocab_size=len(c["vocab"]), pad_token_id=0, **c["arch"])
m = VitsModelForPreTraining(cfg)
for d in m.discriminator.discriminators:
    d.apply_weight_norm()   # เหมือนตอนแปลง discriminator ของ MMS (สคริปต์ฝึกคาดว่ามี weight norm แล้ว)
m.save_pretrained(start)
tk.save_pretrained(start)
VitsFeatureExtractor(sampling_rate=cfg.sampling_rate, feature_size=80).save_pretrained(start)
ids = tk("สวัสดี ครับ").input_ids
print("INIT ok params=%.1fM ids=%s" % (sum(p.numel() for p in m.parameters()) / 1e6, ids[:12]))
"""
if not (START / "config.json").exists():
    START.mkdir(parents=True, exist_ok=True)
    (W / "init.py").write_text(INIT_PY)
    (W / "init.json").write_text(json.dumps({"vocab": VOCAB, "arch": ARCH, "seed": SEED}, ensure_ascii=False))
    run(f'{TPY} {W}/init.py "{START}" "{FT}" {W}/init.json')


# ── 4) ฝึก (ต่อจาก checkpoint ใน Drive ถ้ามี) ──
def checkpoints():
    """checkpoint ที่บันทึกครบ เรียงตาม step · ที่ค้างครึ่งทาง (ถูกหยุดตอนกำลังบันทึก) ลบทิ้ง"""
    good = []
    for d in CK.glob("checkpoint-*"):
        if not d.is_dir():
            continue
        if (
            (d / "model.safetensors").exists()
            and (d / "model_1.safetensors").exists()
            and list(d.glob("random_states_*.pkl"))
        ):
            good.append(d)
        else:
            print("ลบ checkpoint ที่บันทึกไม่ครบ:", d.name)
            shutil.rmtree(d)
    return sorted(good, key=lambda d: int(d.name.split("-")[1]))


cks = checkpoints()
# จบแล้ว = มีโมเดลสุดท้าย และ checkpoint ล่าสุดถึง MAX_STEPS (เพิ่ม MAX_STEPS = ฝึกต่อจาก checkpoint ได้)
done = (CK / "model.safetensors").exists() and bool(cks) and int(cks[-1].name.split("-")[1]) >= MAX_STEPS
if not done and not cks:  # ไม่มี checkpoint → ล้างโฟลเดอร์ (สคริปต์ฝึกไม่ยอมเริ่มในโฟลเดอร์ที่มีของ)
    for x in CK.iterdir():
        shutil.rmtree(x) if x.is_dir() else x.unlink()
cfg = {
    "project_name": "tanot_vits_" + VOICE,
    "push_to_hub": False,
    "report_to": ["tensorboard"],
    "overwrite_output_dir": False,
    "output_dir": str(CK),
    "resume_from_checkpoint": "latest" if cks else None,
    "dataset_name": str(DS),
    "audio_column_name": "audio",
    "text_column_name": "text",
    "train_split_name": "train",
    "eval_split_name": "test",
    "full_generation_sample_text": SAMPLE_TEXT,
    "max_duration_in_seconds": 20,
    "min_duration_in_seconds": 0.5,
    "max_tokens_length": 500,
    "model_name_or_path": str(START),
    "preprocessing_num_workers": 4,
    "do_train": True,
    "max_steps": MAX_STEPS,
    "gradient_accumulation_steps": 1,
    "gradient_checkpointing": False,
    "per_device_train_batch_size": BATCH,
    "learning_rate": LR,
    "adam_beta1": 0.8,
    "adam_beta2": 0.99,
    "warmup_ratio": 0.0,
    "group_by_length": False,
    "do_eval": True,
    "eval_steps": 5000,
    "per_device_eval_batch_size": 16,
    "max_eval_samples": 25,
    "do_step_schedule_per_epoch": True,
    "lr_decay": 0.999875,
    "save_steps": SAVE_EVERY,
    "save_total_limit": 3,
    "weight_disc": 1,
    "weight_fmaps": 1,
    "weight_gen": 1,
    "weight_kl": 1,
    "weight_duration": 1,
    "weight_mel": 45,
    "fp16": False,  # สคริปต์ฝึกไม่ได้ส่ง mixed precision ให้ Accelerator อยู่แล้ว (ฝึก fp32)
    "max_grad_norm": MAX_GRAD_NORM,
    "seed": SEED,
}
(W / "train.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=1))
t_train = time.time()
finished = done
if not done:
    print(f"ฝึก: {'ต่อจาก ' + cks[-1].name if cks else 'เริ่มใหม่'} → เป้า {MAX_STEPS:,} step · รอบนี้สูงสุด {SESSION_HOURS} ชม.")
    os.environ["TANOT_GAN_WARMUP"] = str(GAN_WARMUP)
    try:
        finished = run(f'cd "{FT}" && {TPY} run_vits_finetuning.py "{W}/train.json"', seconds=SESSION_HOURS * 3600)
    except SystemExit:
        if not checkpoints():
            raise
        print("⚠️ ฝึกหยุดกลางทาง (ดูข้อความด้านบน) — ทำเสียงทดสอบจาก checkpoint ล่าสุดแทน", flush=True)
        finished = False
t_train = (time.time() - t_train) / 60
cks = checkpoints()
step = MAX_STEPS if finished else (int(cks[-1].name.split("-")[1]) if cks else 0)
if not finished and not cks:
    raise SystemExit("❌ ยังไม่มี checkpoint (ฝึกไม่ถึง SAVE_EVERY step) — รันใหม่ หรือเพิ่ม SESSION_HOURS")

# ── 5) generator จากโมเดลสุดท้าย หรือ checkpoint ล่าสุด → เสียงทดสอบ ──
GEN_PY = r"""
import json, os, sys, torch, soundfile as sf
from safetensors.torch import load_file
c = json.load(open(sys.argv[1], encoding="utf-8"))
sys.path.insert(0, c["ft"])
from utils import VitsModelForPreTraining
from transformers import VitsModel, VitsTokenizer
tk = VitsTokenizer.from_pretrained(c["start"])
if c["final"]:
    m = VitsModelForPreTraining.from_pretrained(c["ck"])
else:   # checkpoint ของ accelerate: generator มี weight norm (แบบตอนฝึก) → ใส่ให้ตรง โหลด แล้วถอดออก
    m = VitsModelForPreTraining.from_pretrained(c["start"])
    m.decoder.apply_weight_norm()
    for f in m.flow.flows:
        torch.nn.utils.weight_norm(f.conv_pre); torch.nn.utils.weight_norm(f.conv_post)
    sd = load_file(os.path.join(c["ckpt"], "model.safetensors"))
    res = m.load_state_dict(sd, strict=False)
    bad = [k for k in res.missing_keys if not k.startswith("discriminator.")] + res.unexpected_keys
    if bad: raise SystemExit("missing: " + ", ".join(bad[:8]))
    m.decoder.remove_weight_norm()
    for f in m.flow.flows:
        torch.nn.utils.remove_weight_norm(f.conv_pre); torch.nn.utils.remove_weight_norm(f.conv_post)
m.config.noise_scale, m.config.noise_scale_duration = c["noise"]
m.config.speaking_rate = c["speed"]
m.config.architectures = ["VitsModel"]
g = VitsModel(m.config)
g.load_state_dict({k: v for k, v in m.state_dict().items() if not k.startswith("discriminator.")}, strict=True)
g.save_pretrained(c["save"]); tk.save_pretrained(c["save"])
g = g.to("cuda").eval()
g.noise_scale, g.noise_scale_duration, g.speaking_rate = c["noise"][0], c["noise"][1], c["speed"]
os.makedirs(c["out"], exist_ok=True)
for i, text in enumerate(c["texts"]):
    torch.manual_seed(0)
    ids = tk(" " + text + " ", return_tensors="pt").to("cuda")
    try:
        with torch.no_grad():
            w = g(**ids).waveform[0].float().cpu().numpy()
    except torch.OutOfMemoryError:   # ความยาวที่โมเดลทายพัง (ยาวเกินจริงมาก) = โมเดลยังใช้ไม่ได้
        torch.cuda.empty_cache()
        print("⚠️ ท่อน", i, "ยาวผิดปกติจน GPU เต็ม — ข้าม")
        w = torch.zeros(1600).numpy()
    sf.write(f'{c["out"]}/{i:03d}.wav', w, g.config.sampling_rate)
print("GEN OK")
"""
EV = W / "eval"
if EV.exists():
    shutil.rmtree(EV)
urllib.request.urlretrieve(RAW + "tts-normalize.js", W / "tts-normalize.js")
PLAN_JS = (
    "const N=require(process.argv[1]);let s='';process.stdin.on('data',d=>s+=d).on('end',"
    "()=>process.stdout.write(JSON.stringify(JSON.parse(s).map(t=>N.plan(t,{max:200}).chunks.join(' ')))))"
)
r = subprocess.run(
    ["node", "-e", PLAN_JS, str(W / "tts-normalize.js")],
    input=json.dumps(NEUTRAL),
    capture_output=True,
    text=True,
    check=False,
)
if r.returncode:
    raise SystemExit("❌ แปลงข้อความไม่ได้:\n" + r.stderr[-1000:])
neutral = json.loads(r.stdout)
texts = [x["text"] for x in test] + neutral
SAVE = W / "model"
if SAVE.exists():
    shutil.rmtree(SAVE)
(W / "gen.json").write_text(
    json.dumps(
        {
            "ft": str(FT),
            "start": str(START),
            "ck": str(CK),
            "final": finished,
            "ckpt": str(cks[-1]) if cks and not finished else None,
            "save": str(SAVE),
            "out": str(EV / "new"),
            "texts": texts,
            "noise": list(NOISE),
            "speed": SPEED,
        },
        ensure_ascii=False,
    )
)
(W / "gen.py").write_text(GEN_PY)
run(f"{TPY} {W}/gen.py {W}/gen.json")

# ── 6) Whisper วัด CER (ต้นแบบ VoxCPM2 ของชุดทดสอบ vs โมเดลใหม่) ──
(EV / "ref").mkdir()
for i, x in enumerate(test):
    shutil.copy(DS / "test" / f"{x['id']}.wav", EV / "ref" / f"{i:03d}.wav")
QA_PY = r"""
import glob, json, os, re, sys, torch
from transformers import pipeline
c = json.load(open(sys.argv[1], encoding="utf-8"))
asr = pipeline("automatic-speech-recognition", model="biodatlab/whisper-th-medium-combined", device=0, torch_dtype=torch.float16)
def clean(t): return re.sub(r"[^ก-๎a-z]", "", t.replace("ํา", "ำ").lower())
def cer(a, b):
    d = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, y in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (x != y))
    return d[-1] / max(1, len(a))
out = {}
for tag in ("ref", "new"):
    files = sorted(glob.glob(f'{c["dir"]}/{tag}/*.wav'))
    hyps = asr(files, batch_size=16, generate_kwargs={"language": "th", "task": "transcribe"})
    out[tag] = [{"i": int(os.path.basename(f)[:3]), "cer": cer(clean(c["texts"][int(os.path.basename(f)[:3])]), clean(h["text"])),
                 "hyp": h["text"]} for f, h in zip(files, hyps)]
json.dump(out, open(c["dir"] + "/qa.json", "w", encoding="utf-8"), ensure_ascii=False)
"""
(W / "qa.py").write_text(QA_PY)
(W / "qa.json").write_text(json.dumps({"dir": str(EV), "texts": texts}, ensure_ascii=False))
run(f"{TPY} {W}/qa.py {W}/qa.json")
qa = json.loads((EV / "qa.json").read_text(encoding="utf-8"))

# ── 7) ONNX + tokenizer.json → โฟลเดอร์เสียงสำหรับ TanotPDF / เว็บ ──
ONX = W / "voice"
if ONX.exists():
    shutil.rmtree(ONX)
EXP_PY = r"""
import json, os, shutil, sys, numpy as np, onnxruntime as ort
from transformers import VitsTokenizer
from optimum.exporters.onnx import main_export
c = json.load(open(sys.argv[1], encoding="utf-8")); out = c["onx"]
main_export(model_name_or_path=c["model"], output=out + "/_exp", task="text-to-audio", do_validation=False)
os.makedirs(out + "/onnx", exist_ok=True)
shutil.move(out + "/_exp/model.onnx", out + "/onnx/model.onnx")
for f in os.listdir(out + "/_exp"):
    if f.endswith(".json"): shutil.copy(out + "/_exp/" + f, out + "/" + f)
shutil.rmtree(out + "/_exp")
tk = VitsTokenizer.from_pretrained(c["model"]); vocab = tk.get_vocab()
# เหมือน tokenizer.json ของ Jori/Riko: ตัดตัวอักษรนอก vocab ทิ้ง + blank ระหว่างทุกตัวและท้ายข้อความ (= VitsTokenizer add_blank ตอนฝึก)
chars = "".join(ch for ch in sorted(vocab, key=vocab.get) if len(ch) == 1)
cls = "".join(chr(92) + ch if ch in "]^-[" + chr(92) else ch for ch in chars)  # chr(92) = backslash
norms = [{"type": "Lowercase"}, {"type": "Replace", "pattern": {"Regex": "[^" + cls + "]"}, "content": ""},
         {"type": "Strip", "strip_left": True, "strip_right": True},
         {"type": "Replace", "pattern": {"Regex": "(?=.)|(?<!^)$"}, "content": tk.pad_token}]
tj = {"version": "1.0", "truncation": None, "padding": None,
      "added_tokens": [{"id": vocab[t], "content": t, "single_word": False, "lstrip": False, "rstrip": False, "normalized": False, "special": True}
                       for t in vocab if t.startswith("<") and t.endswith(">")],
      "normalizer": {"type": "Sequence", "normalizers": norms},
      "pre_tokenizer": {"type": "Split", "pattern": {"Regex": ""}, "behavior": "Isolated", "invert": False},
      "post_processor": None, "decoder": None, "model": {"vocab": vocab}}
json.dump(tj, open(out + "/tokenizer.json", "w", encoding="utf-8"), ensure_ascii=False)
cfg = json.load(open(out + "/config.json")); cfg["noise_scale"], cfg["noise_scale_duration"] = c["noise"]
json.dump(cfg, open(out + "/config.json", "w"), ensure_ascii=False, indent=2)
s = ort.InferenceSession(out + "/onnx/model.onnx", providers=["CPUExecutionProvider"])
ids = tk(" " + c["text"] + " ", return_tensors="np")
w = s.run(None, {i.name: ids[i.name].astype(np.int64) for i in s.get_inputs() if i.name in ids})[0].reshape(-1)
print("EXPORT inputs=" + ",".join(i.name for i in s.get_inputs()) + f" sec={len(w) / cfg.get('sampling_rate', 22050):.2f}")
"""
(W / "exp.py").write_text(EXP_PY)
(W / "exp.json").write_text(
    json.dumps({"model": str(SAVE), "onx": str(ONX), "noise": list(NOISE), "text": neutral[0]}, ensure_ascii=False)
)
ONX.mkdir()
r = subprocess.run([TPY, str(W / "exp.py"), str(W / "exp.json")], capture_output=True, text=True, check=False)
print(r.stdout[-1500:])
export_line = next((ln for ln in r.stdout.splitlines() if ln.startswith("EXPORT")), None)
export_err = None if r.returncode == 0 else r.stderr[-1500:]
if export_err:
    print("⚠️ แปลง ONNX ไม่สำเร็จ:\n" + export_err)

# ── 8) เก็บลง Drive ──
for sub in ("voice", "ตัวอย่างฟัง"):
    if (OUT / sub).exists():
        shutil.rmtree(OUT / sub)
if export_line:
    shutil.copytree(ONX, OUT / "voice")
LS = OUT / "ตัวอย่างฟัง"
LS.mkdir()
for i in list(range(min(5, len(test)))) + list(range(len(test), len(texts))):
    for tag, label in (("ref", "1-VoxCPM2ต้นแบบ"), ("new", f"2-VITS-{step // 1000}k")):
        f = EV / tag / f"{i:03d}.wav"
        if f.exists():
            shutil.copy(f, LS / f"{i:03d}-{label}.wav")


# ── 9) รายงาน (ต่อท้ายประวัติทุก session) ──
def avg(tag, sel):
    v = [x["cer"] for x in qa[tag] if sel(x["i"])]
    return (sum(v) / len(v)) if v else float("nan")


is_test = lambda i: i < len(test)
is_neu = lambda i: i >= len(test)
L = [
    f"Tanot · VITS จากศูนย์ · {VOICE} · {time.strftime('%Y-%m-%d %H:%M')}",
    f"GPU: {gpu} · step {step:,}/{MAX_STEPS:,} ({'จบแล้ว' if finished else 'ยังไม่จบ — รันซ้ำเพื่อฝึกต่อ'}) · รอบนี้ฝึก {t_train:.0f} นาที",
    f"ชุดข้อมูล: ฝึก {len(train):,} ท่อน ({train_min:.1f} นาที) · ทดสอบ {len(test)} ท่อน · batch {BATCH} · lr {LR}",
    f"ตัวอักษรนอกตาราง: {''.join(unknown) or 'ไม่มี'}",
    "",
    "CER (ยิ่งต่ำยิ่งดี)        ชุดทดสอบ   ประโยคกลางๆ 7",
    f"  VoxCPM2 ต้นแบบ      {avg('ref', is_test):.3f}       -",
    f"  VITS ใหม่           {avg('new', is_test):.3f}       {avg('new', is_neu):.3f}",
    "",
    "ประโยคกลางๆ (ได้ยิน):",
]
L += [f"  {texts[x['i']][:40]} · {x['cer']:.3f} · {x['hyp'][:60]}" for x in qa["new"] if is_neu(x["i"])]
L += [
    "",
    f"ONNX: {export_line or 'ไม่สำเร็จ — ' + (export_err or '')[-300:]}",
    f"โฟลเดอร์เสียง: {OUT / 'voice'} → คัดลอกไปที่ E:\\TanotPDF\\voices\\<ชื่อเสียง>\\",
    f"ไฟล์ฟังเทียบ: {LS}",
]
rep = "\n".join(L)
with open(OUT / "report.txt", "a", encoding="utf-8") as f:
    f.write(rep + "\n\n" + "─" * 60 + "\n\n")
print("\n" + rep)
print(f"\n✅ เสร็จรอบนี้ — ส่ง report.txt จาก {OUT} กลับมา แล้วลองฟังไฟล์ใน ตัวอย่างฟัง/")
if AUTO_DISCONNECT:
    from google.colab import runtime

    print("คืนเครื่อง GPU แล้ว (ไฟล์อยู่ใน Drive)")
    runtime.unassign()
