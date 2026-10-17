# Tanot — สคริปต์ 9: ปรับ "ความเร็วพูด" ของ Jori/Riko ให้ช้าลง (ไม่ต้องฝึกใหม่) → ONNX ใหม่ → อัปโหลดทับ repo เดิมบน HF
#
# ทำไมทำได้โดยไม่ฝึกใหม่: VITS คำนวณความยาวแต่ละเสียงแล้วคูณด้วย 1/speaking_rate ซึ่งถูกฝังเป็นค่าคงที่ใน ONNX ตอนแปลง
#   → ตั้ง speaking_rate = 0.8 แล้วแปลงใหม่ = ทุกท่อนยาวขึ้น ~1.25 เท่า เสียงสูงต่ำเหมือนเดิม (ไม่ใช่เร่ง/หน่วงไฟล์เสียง)
#
# ทำอะไร (ต่อเสียง ใน SPEAKERS)
#   1) โหลดโมเดลรอบ 2 จาก Drive (_ชุดฝึก-MMS/<เสียง>/ฝึกแล้ว-รอบ2/model/ — ตัวเดียวกับที่เว็บใช้อยู่)
#   2) ไฟล์ให้ฟังเทียบที่ LISTEN_SPEEDS (เผื่ออยากได้ 0.75/0.85 แทน) → Drive "_ชุดฝึก-MMS/ทดลองความเร็ว/"
#   3) แปลง ONNX ใหม่ที่ SPEED (optimum ชุดเดียวกับสคริปต์ 7 · noise 0.1/0.0) · ไฟล์อื่นใน repo (tokenizer.json ฯลฯ) ใช้ของเดิมบน HF
#   4) ตรวจ: รัน ONNX เดิม (บน HF) กับใหม่ด้วยข้อความเดียวกัน → ความยาวต้องเพิ่ม ≈ 1/SPEED เท่า (ยืนยันว่าเป็นโมเดลเดียวกัน แค่ช้าลง)
#   5) อัปโหลดทับ repo private เดิม → พิมพ์ commit sha ใหม่ (เว็บยังใช้รุ่นเดิมจนกว่าจะมี PR เปลี่ยน TTS_REVISION — อัปโหลดก่อนได้ ไม่กระทบเว็บ)
#
# วิธีใช้ (Colab → CPU ธรรมดาพอ ไม่ต้อง GPU → วางทั้งไฟล์ → Run) · ราว 10–15 นาที (ติดตั้ง ~5 · ต่อเสียง ~3)
#   ใช้ Secret HF_TOKEN ตัวเดิม (Write) · ห้ามวาง token ลงในโค้ด/แชท
#   ผล: report-ความเร็ว.txt ใน "_ชุดฝึก-MMS/ทดลองความเร็ว/" — ส่งกลับมาพร้อม commit sha ที่พิมพ์ท้ายสุด

SPEED = {"หญิง": 0.8, "ชาย": 0.75}       # ความเร็วใหม่ที่จะเป็น ×1 ในเว็บ ต่อเสียง (1.0 = เท่าเดิม · น้อยกว่า 1 = ช้าลง)
# ความยาวจริงเพิ่มน้อยกว่า 1/SPEED เล็กน้อย: VITS ปัดความยาวของแต่ละตัวอักษรขึ้นเป็นเฟรมเต็ม (ceil) ตัวที่สั้นมากจึงยาว 1 เฟรมเท่าเดิม
#   — เสียงที่พูดเร็ว (Riko) โดนผลนี้มากกว่า · ไฟล์ฟัง x<ความเร็ว> ปัดแบบเดียวกับ ONNX จึงฟังเทียบได้ตรง
LISTEN_SPEEDS = [1.0, 0.75, 0.8, 0.85]   # ไฟล์ให้ฟังเทียบ (ไม่อัปโหลด)
SPEAKERS = ["หญิง", "ชาย"]              # ทำเฉพาะเสียงที่ต้องการได้ เช่น ["ชาย"] · ถ้าบน HF ช้าอยู่แล้ว (ONNX เดิม = ความเร็วนี้) ผลตรวจจะไม่ผ่านเพราะความยาวไม่เพิ่ม
P = {"หญิง": dict(NAME="Jori", VOICE="หญิง-F-C-22k", REPO="Tanotfin/mms-thai-jori-f5-onnx", RUN="รอบ2"),
     "ชาย": dict(NAME="Riko", VOICE="ชาย-M-C-22k", REPO="Tanotfin/mms-thai-riko-f5-onnx", RUN="รอบ2")}
NOISE = (0.1, 0.0)                       # (noise_scale, noise_scale_duration) = ชุดเดียวกับที่เว็บใช้ (สคริปต์ 7)
UPLOAD = True
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง"
NEUTRAL = [
    "สวัสดีครับ วันนี้อากาศดีมาก เหมาะกับการออกไปเดินเล่นที่สวนสาธารณะ",
    "ราคาสินค้าชิ้นนี้อยู่ที่ 1,250 บาท ลดเหลือ 999 บาทถึงวันที่ 15 ตุลาคม",
    "กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนกดปุ่มบันทึก",
    "ถนนสายนี้รถติดมากในช่วงเย็น ควรออกจากบ้านเร็วขึ้นสักครึ่งชั่วโมง",
]
RAW = "https://raw.githubusercontent.com/tanot713-sudo/My-Web-App/main/"

import json, os, pathlib, re, shutil, subprocess, urllib.request

def run(cmd, env=None):
    print("$", cmd, flush=True)
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
    for line in p.stdout: print(line, end="", flush=True)
    if p.wait(): raise SystemExit(f"❌ คำสั่งล้ม (code {p.returncode}) — คัดลอกข้อความด้านบนส่งกลับมา")

# ── 0) Drive + token ──
from google.colab import drive, userdata
drive.mount("/content/drive")
try:
    TOKEN = userdata.get("HF_TOKEN")
except Exception:
    raise SystemExit("❌ ยังไม่ได้ตั้ง Secret HF_TOKEN (แถบซ้าย 🔑) หรือยังไม่เปิด Notebook access")
MMS = pathlib.Path(DRIVE_DIR) / "_ชุดฝึก-MMS"
for s in SPEAKERS:
    m = MMS / P[s]["VOICE"] / f"ฝึกแล้ว-{P[s]['RUN']}" / "model"
    if not (m / "config.json").exists(): raise SystemExit(f"❌ ไม่พบโมเดล {m}")
OUTD = MMS / "ทดลองความเร็ว"; OUTD.mkdir(exist_ok=True)
ENVV = dict(os.environ, HF_TOKEN=TOKEN)   # ส่งให้โปรแกรมลูกทาง environment (ไม่พิมพ์ออกจอ)

# ── 1) สภาพแวดล้อม (ชุดเดียวกับสคริปต์ 7 แต่ torch แบบ CPU) ──
W = pathlib.Path("/content/tanot_speed"); W.mkdir(exist_ok=True)
TENV = f"{W}/tenv"; TPY = f"{TENV}/bin/python"
if not os.path.exists(f"{TENV}/.ok"):
    run("pip -q install uv")
    run(f"uv venv {TENV} --python 3.11 -q")
    run(f"uv pip install -q --python {TPY} torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu")
    run(f'uv pip install -q --python {TPY} "transformers==4.46.3" "optimum[exporters]==1.23.3" "numpy<2" soundfile onnx onnxruntime huggingface_hub')
    pathlib.Path(f"{TENV}/.ok").write_text("ok")
# torchvision (ติดมากับ optimum → timm) จาก PyPI เป็นรุ่น GPU ไม่เข้ากับ torch แบบ CPU → import transformers ล้ม ("torchvision::nms does not exist")
run(f"uv pip install -q --python {TPY} torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu --reinstall-package torchvision")

# ── 2) ข้อความทดสอบ: แปลงด้วยโค้ดของเว็บ (ตัวเลข → คำอ่าน แบบเดียวกับที่เว็บส่งให้โมเดล) ──
v = subprocess.run("node -v", shell=True, capture_output=True, text=True).stdout.strip()
if not re.match(r"v(1[89]|[2-9]\d)\.", v):
    run("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null && apt-get install -y -qq nodejs > /dev/null")
urllib.request.urlretrieve(RAW + "tts-normalize.js", W / "tts-normalize.js")
r = subprocess.run(["node", "-e", "const N=require(process.argv[1]);let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s).map(t=>N.plan(t,{max:200}).chunks.join(' ')))))",
                    str(W / "tts-normalize.js")], input=json.dumps(NEUTRAL), capture_output=True, text=True)
if r.returncode: raise SystemExit("❌ แปลงข้อความไม่ได้:\n" + r.stderr[-1000:])
texts = json.loads(r.stdout)

# ── 3) ต่อเสียง: ฟังเทียบ → ONNX ใหม่ → ตรวจกับของเดิมบน HF ──
SPD_PY = r'''
import json, sys, os, shutil, torch, numpy as np, soundfile as sf, onnxruntime as ort
from transformers import VitsModel, VitsTokenizer
from huggingface_hub import snapshot_download
c = json.load(open(sys.argv[1])); tok = os.environ["HF_TOKEN"]; w = c["work"]
m = VitsModel.from_pretrained(c["model"]).eval(); tk = VitsTokenizer.from_pretrained(c["model"])
m.noise_scale, m.noise_scale_duration = c["noise"]
sr = m.config.sampling_rate
def ids_of(t, kind): return tk(" " + t + " ", return_tensors=kind)   # เว้นขอบท่อนแบบเว็บ (padMms)
# ฟังเทียบ (PyTorch) — speaking_rate เปลี่ยนได้ตอนรัน
for sp in c["listen"]:
    m.speaking_rate = sp
    for i, t in enumerate(c["texts"]):
        torch.manual_seed(0)
        with torch.no_grad(): wav = m(**ids_of(t, "pt")).waveform[0].numpy()
        sf.write(f'{c["listen_dir"]}/{c["name"]}-x{sp:.2f}-{i + 1}.wav', wav, sr)
# ONNX ใหม่: ค่าใน config ถูกฝังลง graph ตอนแปลง
src = w + "/src"; shutil.rmtree(src, ignore_errors=True)
m.config.speaking_rate = c["speed"]; m.config.noise_scale, m.config.noise_scale_duration = c["noise"]
m.save_pretrained(src); tk.save_pretrained(src)
from optimum.exporters.onnx import main_export   # ความสุ่มของ VITS อยู่ใน graph → ตรวจเทียบ PyTorch ไม่ได้ จึงปิด validation (เหมือนสคริปต์ 7)
shutil.rmtree(w + "/_exp", ignore_errors=True)
main_export(model_name_or_path=src, output=w + "/_exp", task="text-to-audio", do_validation=False)
old = w + "/old"; shutil.rmtree(old, ignore_errors=True)
snapshot_download(c["repo"], local_dir=old, token=tok)
new = w + "/repo"; shutil.rmtree(new, ignore_errors=True)
shutil.copytree(old, new, ignore=shutil.ignore_patterns(".cache", ".git*"))   # tokenizer.json/README ฯลฯ ของเดิมทุกไฟล์
extra = [f for f in os.listdir(new + "/onnx") if f != "model.onnx" and not f.endswith(".onnx_data")]
if extra: raise SystemExit("repo มีไฟล์ ONNX อื่น (จะค้างเป็นรุ่นเก่า): " + ", ".join(extra))
shutil.copy(w + "/_exp/model.onnx", new + "/onnx/model.onnx")
cfg = json.load(open(new + "/config.json")); cfg["speaking_rate"] = c["speed"]; cfg["noise_scale"], cfg["noise_scale_duration"] = c["noise"]
json.dump(cfg, open(new + "/config.json", "w"), ensure_ascii=False, indent=2)
tj = json.load(open(new + "/tokenizer.json"))
tok_same = tj.get("model", {}).get("vocab") == tk.get_vocab()
# ตรวจ: ONNX เดิม vs ใหม่ (ความยาวคุมด้วย noise_scale_duration = 0 → ไม่สุ่ม เทียบตรงได้)
def lens(path):
    s = ort.InferenceSession(path, providers=["CPUExecutionProvider"]); out = []
    for t in c["texts"]:
        ids = ids_of(t, "np"); feed = {i.name: ids[i.name].astype(np.int64) for i in s.get_inputs() if i.name in ids}
        out.append(s.run(None, feed)[0].reshape(-1))
    return out
o, n = lens(old + "/onnx/model.onnx"), lens(new + "/onnx/model.onnx")
for i, x in enumerate(n): sf.write(f'{c["listen_dir"]}/{c["name"]}-ONNXใหม่-{i + 1}.wav', x, sr)
ratio = sum(len(x) for x in n) / sum(len(x) for x in o)
print("RESULT " + json.dumps({"sr": sr, "tok_same": tok_same, "ratio": ratio, "old_sec": [len(x) / sr for x in o], "new_sec": [len(x) / sr for x in n]}))
'''
(W / "spd.py").write_text(SPD_PY)
res = {}
for s in SPEAKERS:
    p = P[s]; wk = W / p["NAME"]; wk.mkdir(exist_ok=True)
    cfgj = {"model": str(MMS / p["VOICE"] / f"ฝึกแล้ว-{p['RUN']}" / "model"), "repo": p["REPO"], "name": p["NAME"], "work": str(wk),
            "listen": LISTEN_SPEEDS, "speed": SPEED[s], "noise": list(NOISE), "texts": texts, "listen_dir": str(OUTD)}
    (wk / "c.json").write_text(json.dumps(cfgj, ensure_ascii=False))
    r = subprocess.run([TPY, str(W / "spd.py"), str(wk / "c.json")], capture_output=True, text=True, env=ENVV)
    line = next((l for l in r.stdout.splitlines() if l.startswith("RESULT ")), None)
    if r.returncode or not line: raise SystemExit(f"❌ {p['NAME']} ล้ม:\n" + (r.stdout[-1500:] + r.stderr[-2500:]).replace(TOKEN, "***"))
    res[s] = json.loads(line[7:])
    want = 1 / SPEED[s]; got = res[s]["ratio"]
    res[s]["ok"] = res[s]["tok_same"] and (got > 1.0 if SPEED[s] < 1 else got <= 1.0) and got <= want * 1.02   # ปัดเฟรมทำให้ได้ ≤ 1/SPEED เสมอ (ดูหมายเหตุที่ SPEED)
    print(f"{p['NAME']}: ยาวขึ้น {got:.3f} เท่า (ควร ≈ {want:.3f}) · tokenizer ตรง: {res[s]['tok_same']} → {'ผ่าน' if res[s]['ok'] else 'ไม่ผ่าน'}", flush=True)
    shutil.rmtree(OUTD / f"onnx-repo-{p['NAME']}", ignore_errors=True)
    shutil.copytree(wk / "repo", OUTD / f"onnx-repo-{p['NAME']}")   # สำรองใน Drive

# ── 4) อัปโหลด (เฉพาะเสียงที่ผ่านการตรวจ) ──
UP_PY = ("import os, sys; from huggingface_hub import HfApi; a = HfApi(token=os.environ['HF_TOKEN']); "
         "ci = a.upload_folder(folder_path=sys.argv[2], repo_id=sys.argv[1], commit_message=sys.argv[3]); print('SHA ' + ci.oid)")
for s in SPEAKERS:
    p = P[s]
    if not UPLOAD: res[s]["up"] = "ข้าม (UPLOAD = False)"; continue
    if not res[s]["ok"]: res[s]["up"] = "ข้าม — ไม่ผ่านการตรวจ (ของบน HF ยังเป็นรุ่นเดิม)"; continue
    r = subprocess.run([TPY, "-c", UP_PY, p["REPO"], str(W / p["NAME"] / "repo"), f"speaking_rate {SPEED[s]} (ช้าลงให้เป็น ×1 ใหม่)"],
                       env=ENVV, capture_output=True, text=True)
    sha = next((l[4:] for l in r.stdout.splitlines() if l.startswith("SHA ")), None)
    res[s]["up"] = f"ok · commit {sha}" if r.returncode == 0 and sha else "ล้ม: " + r.stderr[-400:].replace(TOKEN, "***")

# ── 5) รายงาน ──
L = [f"Tanot · สคริปต์ 9 · ความเร็วพูด " + " · ".join(f"{P[s]['NAME']} {SPEED[s]}" for s in SPEAKERS) + f" · noise {NOISE[0]}/{NOISE[1]}", ""]
for s in SPEAKERS:
    p, x = P[s], res[s]
    L += [f"{p['NAME']} ({p['REPO']})",
          f"  ความเร็ว {SPEED[s]} · ยาวขึ้นจริง {x['ratio']:.3f} เท่า (สูงสุด {1 / SPEED[s]:.3f}) · tokenizer เดิมตรงกับโมเดล: {x['tok_same']} · ตรวจ: {'ผ่าน' if x['ok'] else 'ไม่ผ่าน'}",
          "  วินาทีต่อประโยค เดิม → ใหม่: " + " · ".join(f"{a:.1f}→{b:.1f}" for a, b in zip(x["old_sec"], x["new_sec"])),
          f"  อัปโหลด: {x['up']}", ""]
L.append(f"ไฟล์ฟัง: {OUTD} (<ชื่อ>-x<ความเร็ว>-<ข้อ>.wav = PyTorch · <ชื่อ>-ONNXใหม่-<ข้อ>.wav = ตัวที่จะใช้ในเว็บ)")
rep = "\n".join(L); (OUTD / "report-ความเร็ว.txt").write_text(rep, encoding="utf-8"); print("\n" + rep)
print("\n✅ เสร็จ — ฟังไฟล์ ONNXใหม่ ถ้าพอใจส่ง report-ความเร็ว.txt (มี commit sha) กลับมา · ถ้าอยากเร็ว/ช้ากว่านี้ แก้ SPEED แล้วรันใหม่")
