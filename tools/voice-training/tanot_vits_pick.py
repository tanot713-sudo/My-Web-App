# Tanot — สคริปต์ 13: เทียบทุก checkpoint ของสคริปต์ 12 แล้วเลือกตัวที่อ่านชัดที่สุด → ONNX
#
# ทำไม
#   ฝึก VITS จากศูนย์ด้วย lr คงที่ น้ำหนักแกว่งไปมา: checkpoint ติดกันอ่านชัดไม่เท่ากัน (76k CER 0.074 · 85k 0.183)
#   สคริปต์ 12 ทำโมเดลจาก checkpoint "ล่าสุด" เท่านั้น → อาจได้ตัวที่แย่ · สคริปต์นี้วัดทุกตัวแล้วเลือก
#
# ทำอะไร
#   1) หา checkpoint ใน ckpt-v2/ บน Drive ผ่าน Drive API — รวมตัวที่ถูกลบไปอยู่ในถังขยะ (save_total_limit)
#      ดาวน์โหลดเฉพาะ model.safetensors ของแต่ละตัวมาไว้ในเครื่อง Colab · ไม่ย้าย ไม่กู้คืน ไม่ลบอะไรใน Drive
#   2) ทุก checkpoint: สร้างเสียง 87 ท่อน (ชุดทดสอบ 40 + ประโยคกลางๆ 7 + ประโยคใหม่ที่ไม่เคยฝึก 40) → Whisper วัด CER
#      คะแนน = (CER ชุดทดสอบ + CER ประโยคนอกชุด) / 2 · ประโยคนอกชุดช่วยกันไม่ให้เลือกตัวที่บังเอิญถนัดแค่ 40 ท่อนเดิม
#   3) ลองเฉลี่ยน้ำหนักของตัวที่ดีที่สุด 3 และ 5 ตัว (checkpoint averaging มักนิ่งกว่าตัวเดียว)
#   4) ตัวที่คะแนนดีที่สุด → ONNX ลง จากศูนย์/voice-เลือกแล้ว/ + ตัวอย่างฟัง-เลือกแล้ว/ + report-เลือก.txt
#      (ไม่ทับ voice/ ของสคริปต์ 12)
#
# วิธีใช้ (Colab → Runtime → Change runtime type → L4 GPU (T4 ก็ได้) → วางทั้งไฟล์ใน cell เดียว → Run)
#   ตอนเริ่มจะมีหน้าต่างขอสิทธิ์ Google Drive 2 ครั้ง (mount + Drive API สำหรับอ่านถังขยะ) → อนุญาต
#   ราว 1 ชม. บน L4 สำหรับ 26 checkpoint (~2–3 units) · ถังขยะ Drive เก็บไฟล์ 30 วัน — รันก่อนหมดอายุ

SPEAKER = "หญิง-ใหม่"  # ต้องตรงกับสคริปต์ 12
VOICE = {"หญิง-ใหม่": "หญิง-V012-22k", "ชาย-ใหม่": "ชาย-V003-22k"}[SPEAKER]
MIN_STEP = 60_000  # วัดตั้งแต่ step นี้ (60k = รุ่นที่ใช้อยู่ตอนนี้ ใช้เป็นเส้นฐาน)
MAX_STEP = 85_000
AVERAGE_TOP = (3, 5)  # ลองเฉลี่ยน้ำหนักของตัวที่ดีที่สุดกี่ตัว · () = ไม่ลอง
SPEED = 0.85  # ต้องตรงกับสคริปต์ 12
NOISE = (0.1, 0.0)
AUTO_DISCONNECT = True
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง"
RAW = "https://raw.githubusercontent.com/tanot713-sudo/My-Web-App/main/"
NEUTRAL = [  # ชุดเดียวกับสคริปต์ 12
    "สวัสดีครับ วันนี้อากาศดีมาก เหมาะกับการออกไปเดินเล่นที่สวนสาธารณะ",
    "ราคาสินค้าชิ้นนี้อยู่ที่ 1,250 บาท ลดเหลือ 999 บาทถึงวันที่ 15 ตุลาคม",
    "เด็กๆ วิ่งเล่นกันอย่างสนุกสนาน ส่วนผู้ใหญ่นั่งคุยกันใต้ต้นไม้ใหญ่",
    "กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนกดปุ่มบันทึก",
    "เขาเปิดคอมพิวเตอร์ แล้วส่งอีเมลถึงทีมงานทุกคนก่อนเที่ยง",
    "ถนนสายนี้รถติดมากในช่วงเย็น ควรออกจากบ้านเร็วขึ้นสักครึ่งชั่วโมง",
    "ขอบคุณครับ",
]
# ประโยคแต่งใหม่ ไม่อยู่ในชุดฝึก (สคริปต์ตัดทิ้งเองถ้าบังเอิญซ้ำ) — หลายหัวข้อ ตัวเลข คำยาว พยัญชนะที่ใช้น้อย
HELDOUT = [
    "พรุ่งนี้เช้าคุณยายจะไปตลาดน้ำกับหลานสาวสองคน",
    "ช่างซ่อมแอร์โทรมาบอกว่าจะมาถึงประมาณบ่ายสามโมงครึ่ง",
    "รายงานฉบับนี้มีทั้งหมด 48 หน้า แบ่งเป็นหกบท",
    "เครื่องบินเที่ยวสุดท้ายออกจากสนามบินตอนสี่ทุ่มสิบห้านาที",
    "หมอแนะนำให้ดื่มน้ำวันละแปดแก้วและพักผ่อนให้เพียงพอ",
    "ร้านกาแฟหัวมุมถนนเปิดใหม่ มีขนมปังอบสดทุกเช้า",
    "นักเรียนชั้นมัธยมปีที่สามต้องส่งโครงงานวิทยาศาสตร์ภายในวันศุกร์",
    "ฝนตกหนักทำให้น้ำท่วมขังบนถนนหลายสายในเขตเมือง",
    "โปรดเก็บใบเสร็จไว้เป็นหลักฐานสำหรับการเปลี่ยนหรือคืนสินค้า",
    "ทีมฟุตบอลของโรงเรียนชนะการแข่งขันระดับจังหวัดเป็นปีที่สอง",
    "แม่ครัวกำลังเคี่ยวแกงเขียวหวานไก่ในหม้อใบใหญ่",
    "ธนาคารจะปิดปรับปรุงระบบตั้งแต่เที่ยงคืนถึงตีสี่",
    "พี่ชายของฉันทำงานเป็นวิศวกรอยู่ที่บริษัทผลิตรถยนต์",
    "ห้องประชุมชั้นเจ็ดถูกจองไว้สำหรับการสัมภาษณ์งานทั้งวัน",
    "ชาวนาเริ่มเกี่ยวข้าวกันตั้งแต่ปลายเดือนพฤศจิกายน",
    "กรุณาปิดเสียงโทรศัพท์มือถือระหว่างการแสดง",
    "เด็กหญิงตัวเล็กยิ้มกว้างเมื่อได้รับตุ๊กตาหมีเป็นของขวัญ",
    "ค่าไฟเดือนนี้สูงกว่าเดือนก่อนเกือบสองร้อยบาท",
    "ภูเขาลูกนั้นมีหมอกปกคลุมเกือบตลอดทั้งปี",
    "ผู้โดยสารที่ต้องการต่อเครื่องโปรดติดต่อเจ้าหน้าที่ที่เคาน์เตอร์",
    "เธอฝึกเล่นเปียโนทุกเย็นหลังเลิกเรียนเป็นเวลาหนึ่งชั่วโมง",
    "สำนักงานเขตเปิดให้บริการทำบัตรประชาชนในวันเสาร์",
    "คุณตาเล่าเรื่องสมัยสงครามให้หลานๆ ฟังอย่างตั้งใจ",
    "ระบบจะส่งรหัสยืนยันไปที่หมายเลขโทรศัพท์ที่ลงทะเบียนไว้",
    "ฤดูหนาวปีนี้อากาศเย็นกว่าทุกปีที่ผ่านมา",
    "ห้างสรรพสินค้าลดราคาเสื้อผ้าสูงสุดเจ็ดสิบเปอร์เซ็นต์",
    "นักท่องเที่ยวต่างชาตินิยมมาดำน้ำดูปะการังที่เกาะแห่งนี้",
    "ผมลืมกุญแจบ้านไว้ในรถ ต้องโทรเรียกช่างมาเปิดให้",
    "ครูประจำชั้นนัดผู้ปกครองมาประชุมในวันจันทร์หน้า",
    "ฟ้าร้องเสียงดังจนแมวตกใจวิ่งไปซ่อนใต้เตียง",
    "โรงพยาบาลเปิดรับบริจาคโลหิตทุกวันตั้งแต่แปดโมงเช้า",
    "เขาออมเงินได้สามหมื่นบาทภายในหนึ่งปี",
    "ทางเดินริมแม่น้ำเหมาะสำหรับการปั่นจักรยานในวันหยุด",
    "เจ้าหน้าที่ดับเพลิงใช้เวลาไม่ถึงครึ่งชั่วโมงในการควบคุมไฟ",
    "ฉันชอบอ่านนิยายสืบสวนก่อนนอนทุกคืน",
    "ศูนย์บริการลูกค้าเปิดตลอดยี่สิบสี่ชั่วโมง",
    "ต้นมะม่วงหลังบ้านออกผลเต็มต้นในหน้าร้อน",
    "การประชุมสุดยอดผู้นำจะจัดขึ้นที่กรุงเทพฯ ในเดือนหน้า",
    "น้องชายสอบได้คะแนนเต็มในวิชาคณิตศาสตร์",
    "เรือประมงออกจากท่าตั้งแต่ตีห้าเพื่อหาปลา",
]

import json
import os
import pathlib
import re
import shutil
import subprocess
import time
import urllib.request

os.environ["MPLBACKEND"] = "Agg"
os.environ["WANDB_DISABLED"] = "true"


def run(cmd):
    """รันคำสั่ง พิมพ์ผลทีละบรรทัด · ล้ม = หยุดสคริปต์"""
    print("$", cmd, flush=True)
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in p.stdout:
        print(line, end="", flush=True)
    if p.wait():
        raise SystemExit(f"❌ คำสั่งล้ม (code {p.returncode}) — คัดลอกข้อความด้านบนส่งกลับมา")


# ── 0) GPU + Drive ──
gpu = subprocess.run(
    "nvidia-smi --query-gpu=name --format=csv,noheader", shell=True, capture_output=True, text=True, check=False
).stdout.strip()
print("GPU:", gpu or "ไม่มี")
if not gpu:
    raise SystemExit("❌ ยังไม่ได้เปิด GPU — Runtime → Change runtime type → L4 GPU → Save แล้วรัน cell นี้ใหม่")
from google.colab import auth, drive

drive.mount("/content/drive")
SRC = pathlib.Path(DRIVE_DIR) / "_ชุดฝึก-MMS" / VOICE
OUT = SRC / "จากศูนย์"
START = OUT / "start"
if not (START / "config.json").exists():
    raise SystemExit(f"❌ ไม่พบ {START} — สคริปต์นี้ใช้หลังสคริปต์ 12 เท่านั้น")

# ── 1) สภาพแวดล้อม (เหมือนสคริปต์ 12) ──
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

# ── 2) หา checkpoint ทั้งหมด (รวมในถังขยะ) ผ่าน Drive API แล้วดาวน์โหลด model.safetensors ──
auth.authenticate_user()
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload

svc = build("drive", "v3", cache_discovery=False)
FOLDER = "application/vnd.google-apps.folder"


def ls(q):
    out, tok = [], None
    while True:
        r = svc.files().list(q=q, fields="nextPageToken, files(id,name,parents,trashed,size,createdTime)",
                             pageSize=1000, pageToken=tok).execute()
        out += r.get("files", [])
        tok = r.get("nextPageToken")
        if not tok:
            return out


def name_of(fid):
    return svc.files().get(fileId=fid, fields="name,parents").execute()


ck_ids = []
for f in ls(f"name = 'ckpt-v2' and mimeType = '{FOLDER}' and trashed = false"):
    p = name_of(f["parents"][0])
    if p["name"] == "จากศูนย์" and name_of(p["parents"][0])["name"] == VOICE:
        ck_ids.append(f["id"])
if len(ck_ids) != 1:
    raise SystemExit(f"❌ หาโฟลเดอร์ ckpt-v2 ของ {VOICE} ใน Drive ได้ {len(ck_ids)} อัน (ต้องเป็น 1)")
CKD = W / "pick" / "ck"
CKD.mkdir(parents=True, exist_ok=True)
found = {}
for d in ls(f"'{ck_ids[0]}' in parents and mimeType = '{FOLDER}'"):
    m = re.fullmatch(r"checkpoint-(\d+)", d["name"])
    if not m or not MIN_STEP <= int(m.group(1)) <= MAX_STEP:
        continue
    files = [x for x in ls(f"'{d['id']}' in parents and name = 'model.safetensors'") if int(x.get("size", 0)) > 1e8]
    if files:  # step เดียวกันมีหลายโฟลเดอร์ (บันทึกซ้ำ) → เอาอันใหม่สุด
        step = int(m.group(1))
        if step not in found or d["createdTime"] > found[step][0]["createdTime"]:
            found[step] = (d, files[0])
if not found:
    raise SystemExit("❌ ไม่พบ checkpoint เลย — ถังขยะ Drive อาจถูกล้างแล้ว (เก็บ 30 วัน)")
print(f"พบ {len(found)} checkpoint: " + ", ".join(f"{s // 1000}k{'*' if found[s][0]['trashed'] else ''}" for s in sorted(found)))
print("(* = อยู่ในถังขยะ — อ่านอย่างเดียว ไม่กู้คืน)")
for step in sorted(found):
    dst = CKD / f"{step}.safetensors"
    if dst.exists() and dst.stat().st_size == int(found[step][1]["size"]):
        continue
    tmp = dst.with_suffix(".part")
    try:
        with open(tmp, "wb") as fh:
            req = svc.files().get_media(fileId=found[step][1]["id"])
            dl = MediaIoBaseDownload(fh, req, chunksize=64 * 1024 * 1024)
            done = False
            while not done:
                _, done = dl.next_chunk()
    except HttpError as e:
        tmp.unlink(missing_ok=True)
        print(f"  ⚠️ ดาวน์โหลด {step // 1000}k ไม่ได้ ({e.status_code}) — ข้าม · ถ้าข้ามทุกตัว: กู้โฟลเดอร์จากถังขยะแล้วรันซ้ำ")
        continue
    tmp.rename(dst)
    print(f"  ดาวน์โหลด {step // 1000}k แล้ว", flush=True)

# ── 3) ข้อความทดสอบ: ชุดทดสอบ 40 ท่อน (test-ids.json ของสคริปต์ 12) + ประโยคนอกชุด ──
rows = []
for idx in sorted(SRC.glob("shard-*.json")):
    rows += json.loads(idx.read_text(encoding="utf-8"))
keep = set(json.loads((SRC / "test-ids.json").read_text(encoding="utf-8")))
test = [r["text"] for r in rows if r["id"] in keep]
trained = {r["text"] for r in rows if r["id"] not in keep}
urllib.request.urlretrieve(RAW + "tts-normalize.js", W / "tts-normalize.js")
PLAN_JS = (
    "const N=require(process.argv[1]);let s='';process.stdin.on('data',d=>s+=d).on('end',"
    "()=>process.stdout.write(JSON.stringify(JSON.parse(s).map(t=>N.plan(t,{max:200}).chunks.join(' ')))))"
)
r = subprocess.run(["node", "-e", PLAN_JS, str(W / "tts-normalize.js")], input=json.dumps(NEUTRAL + HELDOUT),
                   capture_output=True, text=True, check=False)
if r.returncode:
    raise SystemExit("❌ แปลงข้อความไม่ได้:\n" + r.stderr[-1000:])
norm = json.loads(r.stdout)
extra = [t for t in norm if t not in trained]
print(f"ข้อความวัดผล: ชุดทดสอบ {len(test)} · นอกชุด {len(extra)} (ตัดที่ซ้ำกับชุดฝึก {len(norm) - len(extra)})")

# ── 4) สร้างเสียง + Whisper ทุก checkpoint แล้วลองเฉลี่ยน้ำหนัก (process เดียว โหลด Whisper ครั้งเดียว) ──
PICK_PY = r"""
import glob, json, os, re, shutil, sys, torch, soundfile as sf
from safetensors.torch import load_file, save_file
c = json.load(open(sys.argv[1], encoding="utf-8"))
sys.path.insert(0, c["ft"])
from utils import VitsModelForPreTraining
from transformers import VitsModel, VitsTokenizer, pipeline
tk = VitsTokenizer.from_pretrained(c["start"])
asr = pipeline("automatic-speech-recognition", model="biodatlab/whisper-th-medium-combined", device=0, torch_dtype=torch.float16)
texts, n_test = c["texts"], c["n_test"]
def clean(t): return re.sub(r"[^ก-๎a-z]", "", t.replace("ํา", "ำ").lower())
def cer(a, b):
    d = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, y in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (x != y))
    return d[-1] / max(1, len(a))
def plain(path):   # checkpoint ของ accelerate (มี weight norm) → state dict ของ generator ที่ถอด weight norm แล้ว
    m = VitsModelForPreTraining.from_pretrained(c["start"])
    m.decoder.apply_weight_norm()
    for f in m.flow.flows:
        torch.nn.utils.weight_norm(f.conv_pre); torch.nn.utils.weight_norm(f.conv_post)
    res = m.load_state_dict(load_file(path), strict=False)
    bad = [k for k in res.missing_keys if not k.startswith("discriminator.")] + res.unexpected_keys
    if bad: raise SystemExit("missing: " + ", ".join(bad[:8]))
    m.decoder.remove_weight_norm()
    for f in m.flow.flows:
        torch.nn.utils.remove_weight_norm(f.conv_pre); torch.nn.utils.remove_weight_norm(f.conv_post)
    return {k: v.detach().clone() for k, v in m.state_dict().items() if not k.startswith("discriminator.")}
cfg = VitsModelForPreTraining.from_pretrained(c["start"]).config
cfg.noise_scale, cfg.noise_scale_duration = c["noise"]
cfg.speaking_rate = c["speed"]
cfg.architectures = ["VitsModel"]
g = VitsModel(cfg).to("cuda").eval()
g.noise_scale, g.noise_scale_duration, g.speaking_rate = c["noise"][0], c["noise"][1], c["speed"]
def synth(sd, out):
    g.load_state_dict(sd, strict=True)
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    for i, text in enumerate(texts):
        torch.manual_seed(0)
        ids = tk(" " + text + " ", return_tensors="pt").to("cuda")
        try:
            with torch.no_grad():
                w = g(**ids).waveform[0].float().cpu().numpy()
        except torch.OutOfMemoryError:
            torch.cuda.empty_cache(); w = torch.zeros(1600).numpy()
        sf.write(f"{out}/{i:03d}.wav", w, cfg.sampling_rate)
def score(sd, tag):
    out = c["work"] + "/wav"
    synth(sd, out)
    files = sorted(glob.glob(out + "/*.wav"))
    hyps = asr(files, batch_size=16, generate_kwargs={"language": "th", "task": "transcribe"})
    per = [cer(clean(texts[i]), clean(h["text"])) for i, h in enumerate(hyps)]
    t, e = sum(per[:n_test]) / n_test, sum(per[n_test:]) / max(1, len(per) - n_test)
    r = {"tag": tag, "test": t, "extra": e, "score": (t + e) / 2, "hyp": [h["text"] for h in hyps], "per": per}
    print(f"  {tag:>12}  ชุดทดสอบ {t:.3f} · นอกชุด {e:.3f} · คะแนน {r['score']:.3f}", flush=True)
    return r
res, sds = [], {}
for path in sorted(glob.glob(c["ck"] + "/*.safetensors"), key=lambda p: int(os.path.basename(p).split(".")[0])):
    step = int(os.path.basename(path).split(".")[0])
    sd = plain(path); torch.save(sd, f'{c["work"]}/{step}.pt')
    res.append(dict(score(sd, f"{step // 1000}k"), step=step))
ranked = sorted(res, key=lambda r: r["score"])
for n in c["avg"]:
    if n > len(ranked): continue
    pick = [r["step"] for r in ranked[:n]]
    sds = [torch.load(f'{c["work"]}/{s}.pt') for s in pick]
    avg = {k: (sum(sd[k].float() for sd in sds) / n).to(sds[0][k].dtype) if sds[0][k].is_floating_point() else sds[0][k] for k in sds[0]}
    torch.save(avg, f'{c["work"]}/avg{n}.pt')
    res.append(dict(score(avg, f"เฉลี่ย{n}ตัว"), step=-n, of=pick))
best = min(res, key=lambda r: r["score"])
key = f'avg{-best["step"]}' if best["step"] < 0 else str(best["step"])
synth(torch.load(f'{c["work"]}/{key}.pt'), c["work"] + "/best_wav")   # เสียงฟังเทียบของตัวที่ดีที่สุด
g.cpu().save_pretrained(c["save"]); tk.save_pretrained(c["save"])
json.dump({"res": res, "best": best["tag"]}, open(c["work"] + "/pick.json", "w", encoding="utf-8"), ensure_ascii=False)
print("PICK OK", best["tag"])
"""
PW = W / "pick"
SAVE = PW / "model"
shutil.rmtree(SAVE, ignore_errors=True)
texts = test + extra
(PW / "pick.py").write_text(PICK_PY)
(PW / "pick.json").write_text(json.dumps({
    "ft": str(FT), "start": str(START), "ck": str(CKD), "work": str(PW), "save": str(SAVE), "texts": texts,
    "n_test": len(test), "noise": list(NOISE), "speed": SPEED, "avg": list(AVERAGE_TOP),
}, ensure_ascii=False))
t0 = time.time()
print(f"วัดผล {len(found)} checkpoint × {len(texts)} ท่อน", flush=True)
run(f"{TPY} {PW}/pick.py {PW}/pick.json")
pick = json.loads((PW / "pick.json").read_text(encoding="utf-8"))
res = pick["res"]
best = next(r for r in res if r["tag"] == pick["best"])

# ── 5) ONNX ของตัวที่ดีที่สุด (โค้ดเดียวกับสคริปต์ 12) ──
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
ONX = PW / "voice"
shutil.rmtree(ONX, ignore_errors=True)
ONX.mkdir()
(PW / "exp.py").write_text(EXP_PY)
(PW / "exp.json").write_text(
    json.dumps({"model": str(SAVE), "onx": str(ONX), "noise": list(NOISE), "text": extra[0]}, ensure_ascii=False)
)
r = subprocess.run([TPY, str(PW / "exp.py"), str(PW / "exp.json")], capture_output=True, text=True, check=False)
print(r.stdout[-1500:])
export_line = next((ln for ln in r.stdout.splitlines() if ln.startswith("EXPORT")), None)
if not export_line:
    print("⚠️ แปลง ONNX ไม่สำเร็จ:\n" + r.stderr[-1500:])

# ── 6) เก็บลง Drive + รายงาน ──
VB, LS = OUT / "voice-เลือกแล้ว", OUT / "ตัวอย่างฟัง-เลือกแล้ว"
for p in (VB, LS):
    shutil.rmtree(p, ignore_errors=True)
if export_line:
    shutil.copytree(ONX, VB)
LS.mkdir()
for i in [*range(min(5, len(test))), *range(len(test), len(texts))][:20]:
    shutil.copy(PW / "best_wav" / f"{i:03d}.wav", LS / f"{i:03d}-{best['tag']}.wav")
L = [
    f"Tanot · เลือก checkpoint · {VOICE} · {time.strftime('%Y-%m-%d %H:%M')} · GPU {gpu} · {(time.time() - t0) / 60:.0f} นาที",
    f"ข้อความวัดผล: ชุดทดสอบ {len(test)} ท่อน · นอกชุด {len(extra)} ท่อน (ประโยคกลางๆ 7 + ประโยคใหม่) · speaking_rate {SPEED}",
    "คะแนน = (ชุดทดสอบ + นอกชุด) / 2 · ยิ่งต่ำยิ่งดี",
    "",
    "        รุ่น   ชุดทดสอบ   นอกชุด   คะแนน",
]
L += [f"  {r['tag']:>10}   {r['test']:.3f}     {r['extra']:.3f}   {r['score']:.3f}"
      + (f"  ← {', '.join(str(s // 1000) + 'k' for s in r['of'])}" if r.get("of") else "")
      + ("  ★" if r is best else "") for r in res]
L += ["", f"ดีที่สุด: {best['tag']}", "", "ประโยคนอกชุดที่ยังอ่านผิด (ตัวที่ดีที่สุด):"]
bad = sorted(range(len(test), len(texts)), key=lambda i: -best["per"][i])[:10]
L += [f"  {texts[i][:40]} · {best['per'][i]:.3f} · {best['hyp'][i][:60]}" for i in bad if best["per"][i] > 0]
L += ["", f"ONNX: {export_line or 'ไม่สำเร็จ'}", f"โฟลเดอร์เสียง: {VB} → คัดลอกไปที่ E:\\TanotPDF\\voices\\<ชื่อเสียง>\\"]
rep = "\n".join(L)
(OUT / "report-เลือก.txt").write_text(rep + "\n", encoding="utf-8")
(OUT / "เลือก-checkpoint.json").write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
print("\n" + rep)
print(f"\n✅ เสร็จ — ส่ง report-เลือก.txt และโฟลเดอร์ voice-เลือกแล้ว จาก {OUT} กลับมา")
if AUTO_DISCONNECT:
    from google.colab import runtime

    print("คืนเครื่อง GPU แล้ว (ไฟล์อยู่ใน Drive)")
    runtime.unassign()
