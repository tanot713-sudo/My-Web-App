# Tanot — สคริปต์ 7: ฝึก MMS (VITS) ต่อด้วยชุดข้อมูลจาก F5 (สคริปต์ 6) → วัดผลเทียบเสียงเดิม → ONNX สำหรับเว็บ
#
# ทำอะไร
#   1) แตกชุดข้อมูลจาก Drive (_ชุดฝึก-MMS/<เสียง>/shard-*.tar) → แยกชุดทดสอบ EVAL_N ท่อน (ไม่ใช้ฝึก)
#   2) จุดเริ่ม = ตัวสร้างเสียง (generator) ของ MMS ไทยตัวแรกที่มีใน BASE_CANDIDATES + ตัวแยกแยะ (discriminator) ต้นฉบับของ
#      facebook/mms-tts (tha) — ด้วย convert_original_discriminator_checkpoint.py ของ ylacombe/finetune-hf-vits
#   3) ฝึกต่อด้วย run_vits_finetuning.py (ค่าเริ่มต้นตามตัวอย่าง finetune_mms.json ของ repo นั้น)
#   4) วัดผลบนชุดทดสอบ + 7 ประโยคกลางๆ: Whisper (Thonburian) ฟังกลับ → CER ของ F5 (ต้นแบบ) / MMS ก่อนฝึก / MMS หลังฝึก
#      + ไฟล์ให้ฟังเทียบ 10 ประโยค (ความสุ่มแบบ stable2: noise_scale 0.1 / noise_scale_duration 0.0 เหมือนเสียงในเว็บ)
#   5) แปลงเป็น ONNX (optimum, fp32 → onnx/model.onnx) + tokenizer.json แบบเดียวกับเสียงเดิมในเว็บ → ทดลองรันด้วย onnxruntime
#   6) (UPLOAD) อัปโหลดเป็น repo **private** บน Hugging Face — เว็บยังไม่ใช้จนกว่าจะมี PR เพิ่มเสียง
#   ผล: My Drive/Tanot หนังสือเสียง/_ชุดฝึก-MMS/<เสียง>/ฝึกแล้ว-<RUN>/ (model/ · onnx-repo/ · ตัวอย่างฟัง/ · report.txt) — รอบแรกอยู่ใน ฝึกแล้ว/
#
# วิธีใช้ (Colab → Runtime → Change runtime type → L4 GPU → วางทั้งไฟล์ใน cell เดียว → Run)
#   ก่อนรัน: Colab แถบซ้าย 🔑 Secrets → HF_TOKEN = token แบบ "Write" ของ Tanotfin (เปิด Notebook access) — ใช้อ่าน tokenizer จาก
#            repo เสียงเดิม (private) + อัปโหลดผล · ไม่มี token = ข้ามสองอย่างนี้ (ยังฝึก/วัดผลได้)
#   ใช้เวลาราว 60–100 นาที (ติดตั้ง ~10 · ฝึก ~40–70 · วัดผล+ONNX ~10) ≈ 3–5 compute units · เปิดแท็บค้างไว้
#   ⚠️ ใช้ส่วนตัวเท่านั้น (MMS / F5 = CC-BY-NC) · ไม่ commit เสียง/ข้อความนิยายลง repo

SPEAKER = "ชาย"            # "หญิง" = Jori · "ชาย" = Riko — ต้องตรงกับที่รันสคริปต์ 6
P = {"หญิง": dict(VOICE="หญิง-F-C-22k", BASE=["VIZINTZOR/MMS-TTS-THAI-FEMALEV2", "VIZINTZOR/MMS-TTS-THAI-FEMALE", "facebook/mms-tts-tha"],
                  TOK="Tanotfin/mms-thai-jori-f5-onnx", REPO="Tanotfin/mms-thai-jori-f5-onnx", RUN="รอบ2", R1_ROWS=1675, UP_BELOW=0.034, EPOCHS=25),
     "ชาย": dict(VOICE="ชาย-M-C-22k", BASE=["VIZINTZOR/MMS-TTS-THAI-MALEV2", "facebook/mms-tts-tha"],
                 TOK="Tanotfin/mms-thai-riko-f5-onnx", REPO="Tanotfin/mms-thai-riko-f5-onnx", RUN="รอบ2", R1_ROWS=None, UP_BELOW=0.048, EPOCHS=40)}[SPEAKER]
# ชาย รอบแรก 25 epoch: CER ทดสอบ 0.112 → 0.048 (F5 0.022) ยังห่าง → รอบสอง 40 epoch ชุดข้อมูลเดิม (ชุดทดสอบเดิมจาก test-ids.json)
VOICE = P["VOICE"]        # โฟลเดอร์จากสคริปต์ 6 — อัตราเสียงของชุดข้อมูลต้องตรงกับจุดเริ่ม (เลือกให้อัตโนมัติ)
BASE_CANDIDATES = P["BASE"]
TOKENIZER_FROM = P["TOK"]  # tokenizer.json ของเสียงที่เว็บใช้อยู่ (vocab เดียวกับฐาน VIZINTZOR · repo FM/M เดิมถูกลบแล้ว) — ไม่มี/ไม่ตรง = สร้างเอง
EVAL_N = 40
MAX_TRAIN_CER = "auto"      # ฝึกเฉพาะท่อนที่ F5 อ่านชัด (Whisper ฟังกลับผิด ≤ ค่านี้) · ชุดทดสอบไม่กรอง · None = ใช้ทุกท่อน (รอบแรกใช้ทุกท่อน ≤ 0.08)
TRAIN_MIN_TARGET = 180      # "auto" = เข้มสุดเท่าที่ยังเหลือเสียงฝึก ≥ กี่นาที (ไล่ 0.03 → 0.04 → 0.05 → 0.06 → ทุกท่อน) — กรองเข้มจนข้อมูลน้อยกว่ารอบแรกไม่คุ้ม
EPOCHS = P["EPOCHS"]        # หญิง 25 × ~3,000 ท่อน ≈ 4,800 step (~50 นาทีบน L4) · ชาย 40 × ~3,300 ท่อน ≈ 8,300 step (~85 นาที)
BATCH = 16
LR = 2e-5
NOISE = (0.1, 0.0)          # (noise_scale, noise_scale_duration) = ชุด stable2 ในเว็บ
RUN = P["RUN"]             # ชื่อโฟลเดอร์ผลใน Drive (ไม่ทับรอบก่อน)
R1_ROWS = P["R1_ROWS"]      # จำนวนท่อนในชุดข้อมูลรอบแรก (เสียงใหม่ = None) → สร้างชุดทดสอบเดิมซ้ำได้ (เทียบผลข้ามรอบตรงกัน) ถ้ายังไม่มี test-ids.json
UPLOAD = True
UPLOAD_IF_BELOW = P["UP_BELOW"]  # อัปโหลดทับ HF เฉพาะเมื่อ CER ชุดทดสอบต่ำกว่านี้ (= ผลรอบก่อน) · None = อัปโหลดเสมอ (เสียงใหม่)
HF_REPO = P["REPO"]
AUTO_DISCONNECT = True
SEED = 456
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง"
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
RAW = "https://raw.githubusercontent.com/tanot713-sudo/My-Web-App/main/"

import csv, json, os, pathlib, random, shutil, subprocess, tarfile, time, urllib.request
os.environ["MPLBACKEND"] = "Agg"
os.environ["WANDB_DISABLED"] = "true"

def run(cmd, env=None):
    print("$", cmd, flush=True)
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
    for line in p.stdout: print(line, end="", flush=True)
    if p.wait(): raise SystemExit(f"❌ คำสั่งล้ม (code {p.returncode}) — คัดลอกข้อความด้านบนส่งกลับมา")

# ── 0) GPU + Drive + token ──
gpu = subprocess.run("nvidia-smi --query-gpu=name --format=csv,noheader", shell=True, capture_output=True, text=True).stdout.strip()
print("GPU:", gpu or "ไม่มี")
if not gpu:
    raise SystemExit("❌ ยังไม่ได้เปิด GPU — Runtime → Change runtime type → L4 GPU → Save แล้วรัน cell นี้ใหม่")
from google.colab import drive
drive.mount("/content/drive")
SRC = pathlib.Path(DRIVE_DIR) / "_ชุดฝึก-MMS" / VOICE
if not list(SRC.glob("shard-*.tar")):
    raise SystemExit(f"❌ ไม่พบชุดข้อมูลใน {SRC} — รันสคริปต์ 6 ก่อน")
OUT = SRC / f"ฝึกแล้ว-{RUN}"; OUT.mkdir(exist_ok=True)
TOKEN = None
try:
    from google.colab import userdata
    TOKEN = userdata.get("HF_TOKEN")
except Exception:
    print("⚠️ ไม่มี Secret HF_TOKEN — จะสร้าง tokenizer.json เอง และไม่อัปโหลด")
ENVV = dict(os.environ)
if TOKEN: ENVV["HF_TOKEN"] = TOKEN   # ส่งให้โปรแกรมลูกทาง environment (ไม่พิมพ์ออกจอ)

# ── 1) สภาพแวดล้อม: TENV = ฝึก/ONNX · REF = Whisper + ตัวปรับข้อความของ f5-tts-th (เหมือนสคริปต์ 4–6) ──
W = pathlib.Path("/content/tanot_mms"); W.mkdir(exist_ok=True)
TENV = f"{W}/tenv"; TPY = f"{TENV}/bin/python"
if not os.path.exists(f"{TENV}/.ok"):
    run("pip -q install uv")
    run(f"uv venv {TENV} --python 3.11 -q")
    run(f"uv pip install -q --python {TPY} torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu121")
    run(f'uv pip install -q --python {TPY} "transformers==4.46.3" "datasets[audio]==3.1.0" "accelerate==1.1.1" "optimum[exporters]==1.23.3" '
        f'"numpy<2" soundfile librosa tensorboard matplotlib Cython setuptools onnx onnxruntime huggingface_hub')
    pathlib.Path(f"{TENV}/.ok").write_text("ok")
run(f'uv pip install -q --python {TPY} "pyarrow==17.0.0" "pandas<3" "matplotlib<3.10"')   # pyarrow ใหม่ต้องใช้ NumPy 2 · pandas 3 อ่าน csv เป็น large_string ที่ datasets 3.1 ไม่รับ · matplotlib 3.10 ตัด tostring_rgb ที่กราฟตอน validation ใช้
FT = W / "finetune-hf-vits"
if not (FT / "monotonic_align" / ".built").exists():
    if not FT.exists(): run(f"git clone -q --depth 1 https://github.com/ylacombe/finetune-hf-vits.git {FT}")
    run(f'cd "{FT}/monotonic_align" && mkdir -p monotonic_align && {TPY} setup.py build_ext --inplace')
    (FT / "monotonic_align" / ".built").write_text("ok")
BASE = "/content/tanot_f5"; ENV = f"{BASE}/env"; PY = f"{ENV}/bin/python"
if not os.path.exists(f"{ENV}/.ok"):
    os.makedirs(BASE, exist_ok=True)
    run("pip -q install uv")
    run(f"uv venv {ENV} --python 3.11 -q")
    run(f"uv pip install -q --python {PY} torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu121")
    run(f'uv pip install -q --python {PY} f5-tts-th==1.0.9 "numpy==1.26.4" soundfile "transformers>=4.40,<4.50"')
    pathlib.Path(f"{ENV}/.ok").write_text("ok")

# ── 2) ชุดข้อมูล → audiofolder (train/ test/ + metadata.csv) ──
DS = W / "mmsds"
if DS.exists(): shutil.rmtree(DS)
(DS / "train").mkdir(parents=True); (DS / "test").mkdir(parents=True)
rows = []
for idx in sorted(SRC.glob("shard-*.json")):
    tar = idx.with_suffix(".tar")
    if not tar.exists(): continue
    with tarfile.open(tar) as tf: tf.extractall(W / "wavs_raw")
    rows += json.loads(idx.read_text(encoding="utf-8"))
import wave
with wave.open(str(W / "wavs_raw" / "wavs" / f"{rows[0]['id']}.wav")) as wf: DS_SR = wf.getframerate()
# ชุดทดสอบคงที่ข้ามรอบ (เพิ่มข้อมูลทีหลังแล้วเทียบผลกับรอบก่อนได้) → จำ id ไว้ใน Drive ครั้งแรก
TEST_IDS = SRC / "test-ids.json"
if TEST_IDS.exists():
    keep = set(json.loads(TEST_IDS.read_text(encoding="utf-8")))
    test = [r for r in rows if r["id"] in keep]; rest = [r for r in rows if r["id"] not in keep]
else:   # รอบแรกสุ่มจากทุกท่อนตอนนั้น (R1_ROWS ท่อนแรกตามลำดับก้อน — ก้อนเดิมไม่เปลี่ยน ก้อนใหม่ต่อท้าย)
    first = rows[:R1_ROWS] if R1_ROWS and len(rows) >= R1_ROWS else list(rows)
    rnd = random.Random(SEED); rnd.shuffle(first)
    keep = {r["id"] for r in first[:EVAL_N]}
    test = [r for r in first if r["id"] in keep]; rest = [r for r in rows if r["id"] not in keep]
    TEST_IDS.write_text(json.dumps([r["id"] for r in test]))
if MAX_TRAIN_CER == "auto":
    for MAX_TRAIN_CER in (0.03, 0.04, 0.05, 0.06, None):
        if MAX_TRAIN_CER is None or sum(r["dur"] for r in rest if r.get("cer", 0) <= MAX_TRAIN_CER) >= TRAIN_MIN_TARGET * 60: break
train = [r for r in rest if MAX_TRAIN_CER is None or r.get("cer", 0) <= MAX_TRAIN_CER]
dropped = len(rest) - len(train)
print(f"กรองท่อนฝึก CER ≤ {MAX_TRAIN_CER}: ใช้ {len(train):,} · ตัดออก {dropped:,}")
for split, rs in (("train", train), ("test", test)):
    with open(DS / split / "metadata.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f); w.writerow(["file_name", "text"])
        for r in rs:
            shutil.move(str(W / "wavs_raw" / "wavs" / f"{r['id']}.wav"), DS / split / f"{r['id']}.wav")
            w.writerow([f"{r['id']}.wav", r["text"]])
print(f"ชุดข้อมูล: ฝึก {len(train):,} ท่อน ({sum(r['dur'] for r in train) / 60:.1f} นาที) · ทดสอบ {len(test)} ท่อน · {DS_SR} Hz")

# ── 3) จุดเริ่ม: generator ไทย + discriminator ต้นฉบับ ──
START = W / "start"
PREP_PY = r'''
import os, sys, json
from huggingface_hub import hf_hub_download
from transformers import VitsConfig
cands = json.loads(sys.argv[1]); sr = int(sys.argv[2]); tok = os.environ.get("HF_TOKEN")
base = None
for c in cands:   # อัตราเสียงของจุดเริ่มต้องตรงกับชุดข้อมูล (ไม่งั้นต้องแปลงอัตรา = เสียงทึบ/ข้อมูลหาย)
    try:
        cfg = VitsConfig.from_pretrained(c, token=tok)
    except Exception as e:
        print("ข้าม", c, "-", type(e).__name__); continue
    if cfg.sampling_rate != sr: print("ข้าม", c, "- อัตรา", cfg.sampling_rate, "Hz ไม่ตรงชุดข้อมูล", sr, "Hz"); continue
    base = c; print("ผู้พูดในโมเดล:", cfg.num_speakers); break
if not base: raise SystemExit("ไม่พบ generator เริ่มต้นที่อัตรา " + str(sr) + " Hz")
d = hf_hub_download(repo_id="facebook/mms-tts", subfolder="full_models/tha", filename="D_100000.pth")
print("BASE=" + base); print("DISC=" + d)
'''
(W / "prep.py").write_text(PREP_PY)
r = subprocess.run([TPY, str(W / "prep.py"), json.dumps(BASE_CANDIDATES), str(DS_SR)], capture_output=True, text=True, env=ENVV)
print(r.stdout[-1500:])
if r.returncode: raise SystemExit("❌ หา generator/discriminator ไม่ได้:\n" + r.stderr[-2000:])
kv = dict(l.split("=", 1) for l in r.stdout.splitlines() if l.startswith(("BASE=", "DISC=")))
BASE_GEN = kv["BASE"]
print("จุดเริ่ม:", BASE_GEN)
if (START / "base.txt").exists() and (START / "base.txt").read_text() != BASE_GEN: shutil.rmtree(START)
if not (START / "config.json").exists():
    run(f'cd "{FT}" && {TPY} convert_original_discriminator_checkpoint.py --checkpoint_path "{kv["DISC"]}" '
        f'--generator_checkpoint_path "{BASE_GEN}" --pytorch_dump_folder_path "{START}"', env=ENVV)
    (START / "base.txt").write_text(BASE_GEN)
# จุดเริ่มแบบหลายผู้พูด (VIZINTZOR หญิง v2 = 6 ผู้พูด) → แปลงเป็นผู้พูดเดียว: ตัด embed_speaker + ชั้น cond ทิ้ง
# เว็บเรียกโมเดลโดยไม่ระบุผู้พูดอยู่แล้ว (ชั้นเหล่านี้ถูกข้ามตอนรัน) → พฤติกรรมเท่าเดิม และเครื่องมือฝึกไม่บังคับ speaker_id อีก
SINGLE_PY = r'''
import sys, json
sys.path.insert(0, sys.argv[2])
from utils import VitsModelForPreTraining
start = sys.argv[1]
m = VitsModelForPreTraining.from_pretrained(start)
cfg = m.config
if cfg.num_speakers <= 1 and not cfg.speaker_embedding_size:
    print("SINGLE already"); sys.exit(0)
sd = m.state_dict()
cfg.num_speakers, cfg.speaker_embedding_size = 1, 0
n = VitsModelForPreTraining(cfg)
res = n.load_state_dict(sd, strict=False)
if res.missing_keys: raise SystemExit("missing keys: " + ", ".join(res.missing_keys[:10]))
bad = [k for k in res.unexpected_keys if "embed_speaker" not in k and "cond" not in k]
if bad: raise SystemExit("unexpected keys: " + ", ".join(bad[:10]))
n.save_pretrained(start)
print("SINGLE dropped", len(res.unexpected_keys), "tensors")
'''
(W / "single.py").write_text(SINGLE_PY)
run(f'{TPY} {W}/single.py "{START}" "{FT}"', env=ENVV)

# ── 4) ฝึก ──
MODEL_OUT = W / "out"
cfg = {
    "project_name": "tanot_mms_" + VOICE, "push_to_hub": False, "report_to": ["tensorboard"], "overwrite_output_dir": True,
    "output_dir": str(MODEL_OUT), "dataset_name": str(DS), "audio_column_name": "audio", "text_column_name": "text",
    "train_split_name": "train", "eval_split_name": "test", "full_generation_sample_text": SAMPLE_TEXT,
    "max_duration_in_seconds": 20, "min_duration_in_seconds": 0.5, "max_tokens_length": 500,
    "model_name_or_path": str(START), "preprocessing_num_workers": 4,
    "do_train": True, "num_train_epochs": EPOCHS, "gradient_accumulation_steps": 1, "gradient_checkpointing": False,
    "per_device_train_batch_size": BATCH, "learning_rate": LR, "adam_beta1": 0.8, "adam_beta2": 0.99, "warmup_ratio": 0.01,
    "group_by_length": False, "do_eval": True, "eval_steps": 500, "per_device_eval_batch_size": 16, "max_eval_samples": 25,
    "do_step_schedule_per_epoch": True, "save_steps": 10 ** 9,
    "weight_disc": 3, "weight_fmaps": 1, "weight_gen": 1, "weight_kl": 1.5, "weight_duration": 1, "weight_mel": 35,
    "fp16": True, "seed": SEED,
}
(W / "train.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=1))
# transformers 4.46: BatchEncoding.to(device) ทิ้งค่าที่ไม่ใช่ tensor → speaker_id=None (ผู้พูดเดียว) หายจาก batch → KeyError
_rv = FT / "run_vits_finetuning.py"; _src = _rv.read_text()
if 'speaker_id=batch["speaker_id"]' in _src:   # เฉพาะจุดที่อ่าน (จุดที่กำหนดค่าไม่แตะ)
    _rv.write_text(_src.replace('speaker_id=batch["speaker_id"]', 'speaker_id=batch.get("speaker_id")')); print("แก้ run_vits_finetuning.py: speaker_id=batch.get(...)")
# matplotlib 3.10 ตัด tostring_rgb (ใช้ตอนวาดกราฟ validation ทุก 500 step) → ใช้ buffer_rgba แทน (สำรองเผื่อ pin ไม่ติด)
_pl = FT / "utils" / "plot.py"; _ps = _pl.read_text()
if "tostring_rgb()" in _ps:
    _pl.write_text(_ps.replace("np.frombuffer(fig.canvas.tostring_rgb(), dtype=np.uint8)",
                               "np.ascontiguousarray(np.asarray(fig.canvas.buffer_rgba())[..., :3]).reshape(-1)")); print("แก้ utils/plot.py: buffer_rgba")
t_train = time.time()
stamp = f"{VOICE}|{BASE_GEN}|{EPOCHS}|{LR}|{BATCH}|{MAX_TRAIN_CER}|{len(train)}"
if (MODEL_OUT / "stamp.txt").exists() and (MODEL_OUT / "stamp.txt").read_text() != stamp: shutil.rmtree(MODEL_OUT)
if not (MODEL_OUT / "model.safetensors").exists() and not (MODEL_OUT / "pytorch_model.bin").exists():
    run(f'cd "{FT}" && {TPY} run_vits_finetuning.py "{W}/train.json"', env=ENVV)
    (MODEL_OUT / "stamp.txt").write_text(stamp)
t_train = (time.time() - t_train) / 60

# ── 5) เก็บโมเดล (generator) ลง Drive + สร้างเสียงทดสอบ ──
GEN_PY = r'''
import json, sys, os, torch, numpy as np, soundfile as sf
from transformers import VitsModel, VitsTokenizer
c = json.load(open(sys.argv[1])); tok = os.environ.get("HF_TOKEN")
def load(path):
    m = VitsModel.from_pretrained(path, token=tok).to("cuda").eval()
    m.noise_scale, m.noise_scale_duration = c["noise"]
    return m, VitsTokenizer.from_pretrained(path, token=tok)
new, tk = load(c["new"])
new.config.noise_scale, new.config.noise_scale_duration = c["noise"]
new.save_pretrained(c["save"]); tk.save_pretrained(c["save"])   # generator อย่างเดียว (ไม่มี discriminator)
vocab = set(tk.get_vocab())
miss = {}
for t in c["all_texts"]:
    for ch in t:
        if ch not in vocab and ch.lower() not in vocab: miss[ch] = miss.get(ch, 0) + 1
json.dump({"vocab": sorted(vocab), "missing": miss}, open(c["out"] + "/vocab.json", "w"), ensure_ascii=False)
base, tb = load(c["base"])
for tag, m, t in (("new", new, tk), ("base", base, tb)):
    os.makedirs(f'{c["out"]}/{tag}', exist_ok=True)
    for i, text in enumerate(c["texts"]):
        torch.manual_seed(0)
        ids = t(" " + text + " ", return_tensors="pt").to("cuda")   # เว้นขอบท่อนแบบเว็บ (padMms)
        with torch.no_grad(): w = m(**ids).waveform[0].float().cpu().numpy()
        sf.write(f'{c["out"]}/{tag}/{i:03d}.wav', w, m.config.sampling_rate)
print("GEN OK")
'''
EV = W / "eval"
if EV.exists(): shutil.rmtree(EV)
EV.mkdir()
urllib.request.urlretrieve(RAW + "tts-normalize.js", W / "tts-normalize.js")
r = subprocess.run(["node", "-e", "const N=require(process.argv[1]);let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s).map(t=>N.plan(t,{max:200}).chunks.join(' ')))))",
                    str(W / "tts-normalize.js")], input=json.dumps(NEUTRAL), capture_output=True, text=True)
if r.returncode: raise SystemExit("❌ แปลงข้อความไม่ได้:\n" + r.stderr[-1000:])
neutral_mms = json.loads(r.stdout)
texts = [x["text"] for x in test] + neutral_mms
SAVE = W / "model"
(W / "gen.json").write_text(json.dumps({"new": str(MODEL_OUT), "base": BASE_GEN, "save": str(SAVE), "out": str(EV), "texts": texts,
                                        "noise": list(NOISE), "all_texts": [x["text"] for x in rows]}, ensure_ascii=False))
(W / "gen.py").write_text(GEN_PY)
run(f"{TPY} {W}/gen.py {W}/gen.json", env=ENVV)
# F5 ต้นแบบของชุดทดสอบ (มีในชุดข้อมูลอยู่แล้ว)
(EV / "f5").mkdir()
for i, x in enumerate(test): shutil.copy(DS / "test" / f"{x['id']}.wav", EV / "f5" / f"{i:03d}.wav")

# ── 6) Whisper วัด CER ──
QA_PY = r'''
import json, sys, re, glob, os, torch
from transformers import pipeline
from f5_tts_th.normalize import normalize_text
c = json.load(open(sys.argv[1]))
asr = pipeline("automatic-speech-recognition", model="biodatlab/whisper-th-medium-combined", device=0, torch_dtype=torch.float16)
def clean(t): return re.sub(r"[^ก-๎a-z]", "", normalize_text(t.replace("ํา", "ำ")).lower())
def cer(a, b):
    d = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, y in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (x != y))
    return d[-1] / max(1, len(a))
out = {}
for tag in ("f5", "base", "new"):
    files = sorted(glob.glob(f'{c["dir"]}/{tag}/*.wav'))
    hyps = asr(files, batch_size=16, generate_kwargs={"language": "th", "task": "transcribe"})
    out[tag] = [{"i": int(os.path.basename(f)[:3]), "cer": cer(clean(c["texts"][int(os.path.basename(f)[:3])]), clean(h["text"])), "hyp": h["text"]} for f, h in zip(files, hyps)]
json.dump(out, open(c["dir"] + "/qa.json", "w"), ensure_ascii=False)
'''
(W / "qa.py").write_text(QA_PY)
(W / "qa.json").write_text(json.dumps({"dir": str(EV), "texts": texts}, ensure_ascii=False))
run(f"{PY} {W}/qa.py {W}/qa.json")
qa = json.loads((EV / "qa.json").read_text())

# ── 7) ONNX (fp32) + tokenizer.json แบบที่เว็บใช้ ──
ONX = W / "onnx-repo"
if ONX.exists(): shutil.rmtree(ONX)
EXP_PY = r'''
import json, sys, os, shutil, numpy as np, onnxruntime as ort
from transformers import VitsTokenizer, VitsConfig
c = json.load(open(sys.argv[1])); tok = os.environ.get("HF_TOKEN"); out = c["onx"]
from optimum.exporters.onnx import main_export   # ความสุ่มของ VITS ฝังใน graph (noise_scale จาก config) → ตรวจเทียบ PyTorch ไม่ได้ จึงปิด validation
main_export(model_name_or_path=c["model"], output=out + "/_exp", task="text-to-audio", do_validation=False)
os.makedirs(out + "/onnx", exist_ok=True)
shutil.move(out + "/_exp/model.onnx", out + "/onnx/model.onnx")
for f in os.listdir(out + "/_exp"):
    if f.endswith(".json"): shutil.copy(out + "/_exp/" + f, out + "/" + f)
shutil.rmtree(out + "/_exp")
tk = VitsTokenizer.from_pretrained(c["model"]); vocab = tk.get_vocab()
src = None
if tok:
    try:
        from huggingface_hub import hf_hub_download
        p = hf_hub_download(c["tok_from"], "tokenizer.json", token=tok)
        tj = json.load(open(p))
        if tj.get("model", {}).get("vocab") == vocab: shutil.copy(p, out + "/tokenizer.json"); src = "copied"
        else: src = "vocab-differs"
    except Exception as e:
        src = "download-failed:" + type(e).__name__
if src != "copied":   # สร้างแบบเดียวกับสคริปต์แปลง VITS ของ transformers.js
    norms = []
    if tk.normalize: norms.append({"type": "Lowercase"})
    norms.append({"type": "Strip", "strip_left": True, "strip_right": True})
    if tk.add_blank: norms.append({"type": "Replace", "pattern": {"Regex": "(?=.)"}, "content": tk.pad_token})
    tj = {"version": "1.0", "truncation": None, "padding": None,
          "added_tokens": [{"id": vocab[t], "content": t, "single_word": False, "lstrip": False, "rstrip": False, "normalized": False, "special": True} for t in vocab if t.startswith("<") and t.endswith(">")],
          "normalizer": norms[0] if len(norms) == 1 else {"type": "Sequence", "normalizers": norms},
          "pre_tokenizer": {"type": "Split", "pattern": {"Regex": ""}, "behavior": "Isolated", "invert": False},
          "post_processor": None, "decoder": None, "model": {"vocab": vocab}}
    json.dump(tj, open(out + "/tokenizer.json", "w"), ensure_ascii=False)
cfg = json.load(open(out + "/config.json")); cfg["noise_scale"], cfg["noise_scale_duration"] = c["noise"]; json.dump(cfg, open(out + "/config.json", "w"), ensure_ascii=False, indent=2)
s = ort.InferenceSession(out + "/onnx/model.onnx", providers=["CPUExecutionProvider"])
ids = tk(" " + c["text"] + " ", return_tensors="np")
feed = {i.name: ids[i.name].astype(np.int64) for i in s.get_inputs() if i.name in ids}
w = s.run(None, feed)[0].reshape(-1)
print("EXPORT tokenizer=" + str(src) + " inputs=" + ",".join(i.name for i in s.get_inputs()) + f" sec={len(w) / cfg.get('sampling_rate', 16000):.2f}")
'''
(W / "exp.py").write_text(EXP_PY)
(W / "exp.json").write_text(json.dumps({"model": str(SAVE), "onx": str(ONX), "tok_from": TOKENIZER_FROM, "noise": list(NOISE), "text": neutral_mms[0]}, ensure_ascii=False))
ONX.mkdir()
r = subprocess.run([TPY, str(W / "exp.py"), str(W / "exp.json")], capture_output=True, text=True, env=ENVV)
print(r.stdout[-2000:])
export_line = next((l for l in r.stdout.splitlines() if l.startswith("EXPORT")), None)
export_err = None if r.returncode == 0 else r.stderr[-1500:]
if export_err: print("⚠️ แปลง ONNX ไม่สำเร็จ:\n" + export_err)

# ── 8) เก็บลง Drive + อัปโหลด ──
for sub in ("model", "onnx-repo"):
    if (OUT / sub).exists(): shutil.rmtree(OUT / sub)
shutil.copytree(SAVE, OUT / "model")
if export_line: shutil.copytree(ONX, OUT / "onnx-repo")
LS = OUT / "ตัวอย่างฟัง"
if LS.exists(): shutil.rmtree(LS)
LS.mkdir()
for i in list(range(min(5, len(test)))) + list(range(len(test), len(texts))):
    for tag, label in (("f5", "1-F5ต้นแบบ"), ("base", "2-MMSเดิม"), ("new", "3-MMSใหม่")):
        f = EV / tag / f"{i:03d}.wav"
        if f.exists(): shutil.copy(f, LS / f"{i:03d}-{label}.wav")
uploaded = None
_v = [x["cer"] for x in qa["new"] if x["i"] < len(test)]; new_cer = sum(_v) / max(1, len(_v))
if UPLOAD and TOKEN and export_line and UPLOAD_IF_BELOW is not None and new_cer >= UPLOAD_IF_BELOW:
    uploaded = f"ข้าม — CER ชุดทดสอบ {new_cer:.3f} ไม่ต่ำกว่า {UPLOAD_IF_BELOW} (ของบน HF ยังเป็นรุ่นก่อน)"
elif UPLOAD and TOKEN and export_line:
    UP_PY = ("import os, sys; from huggingface_hub import HfApi; a = HfApi(token=os.environ['HF_TOKEN']); "
             "a.create_repo(sys.argv[1], private=True, exist_ok=True); a.upload_folder(folder_path=sys.argv[2], repo_id=sys.argv[1])")
    r = subprocess.run([TPY, "-c", UP_PY, HF_REPO, str(ONX)], env=ENVV, capture_output=True, text=True)
    uploaded = "ok" if r.returncode == 0 else "ล้ม: " + r.stderr[-400:].replace(TOKEN, "***")

# ── 9) รายงาน ──
def avg(tag, sel): v = [x["cer"] for x in qa[tag] if sel(x["i"])]; return (sum(v) / len(v)) if v else float("nan")
is_test = lambda i: i < len(test)
is_neu = lambda i: i >= len(test)
voc = json.loads((EV / "vocab.json").read_text())
L = [f"Tanot · ฝึก MMS · {VOICE} · {RUN}", f"GPU: {gpu} · จุดเริ่ม: {BASE_GEN} · ฝึก {EPOCHS} epoch, batch {BATCH}, lr {LR} · ใช้เวลาฝึก {t_train:.0f} นาที",
     f"ชุดข้อมูล: ฝึก {len(train):,} ท่อน ({sum(r['dur'] for r in train) / 60:.1f} นาที, CER ≤ {MAX_TRAIN_CER}, ตัดออก {dropped:,}) · ทดสอบ {len(test)} ท่อน (ชุดเดิมจาก test-ids.json)",
     f"ตัวอักษรที่ tokenizer ไม่รู้จัก (ถูกทิ้งตอนฝึก): {voc['missing'] or 'ไม่มี'}", "",
     "CER (ยิ่งต่ำยิ่งดี)          ชุดทดสอบ   ประโยคกลางๆ 7",
     f"  F5 ต้นแบบ             {avg('f5', is_test):.3f}       -",
     f"  MMS เดิม ({BASE_GEN.split('/')[-1]})  {avg('base', is_test):.3f}       {avg('base', is_neu):.3f}",
     f"  MMS ใหม่ (ฝึกแล้ว)      {avg('new', is_test):.3f}       {avg('new', is_neu):.3f}", "",
     "ประโยคกลางๆ (MMS เดิม → ใหม่):"]
for x_b, x_n in zip([x for x in qa["base"] if is_neu(x["i"])], [x for x in qa["new"] if is_neu(x["i"])]):
    L.append(f"  {texts[x_n['i']][:50]} · {x_b['cer']:.3f} → {x_n['cer']:.3f} · ได้ยิน(ใหม่): {x_n['hyp'][:60]}")
L += ["", f"ONNX: {export_line or 'ไม่สำเร็จ — ' + (export_err or '')[-300:]}",
      f"อัปโหลด: {uploaded or ('ข้าม (ไม่มี HF_TOKEN)' if not TOKEN else 'ข้าม')} · repo: {HF_REPO} (private)",
      f"ไฟล์ฟังเทียบ: {LS} (1-F5ต้นแบบ / 2-MMSเดิม / 3-MMSใหม่)"]
rep = "\n".join(L); (OUT / "report.txt").write_text(rep, encoding="utf-8"); print("\n" + rep)
print(f"\n✅ เสร็จ — ส่ง report.txt จาก {OUT} กลับมา แล้วลองฟังไฟล์ใน ตัวอย่างฟัง/")
if AUTO_DISCONNECT:
    from google.colab import runtime
    print("คืนเครื่อง GPU แล้ว (ไฟล์อยู่ใน Drive)"); runtime.unassign()
