# Tanot — สคริปต์ 4: สร้างหนังสือเสียงทั้งเรื่องด้วย F5-TTS-THAI → MP3 แยกตามตอน เก็บใน Google Drive (หลุดแล้วทำต่อได้)
#
# ทำอะไร
#   1) แบ่งตอนแบบเดียวกับเว็บ (tts-long.js: บรรทัดขึ้นต้น "เลข." / "เลข)" = หัวตอน) · ไม่พบหัวตอน → ตัดทุก ~30 นาทีที่ขอบย่อหน้า
#   2) แปลงข้อความด้วยตัวแปลงของเว็บ (tts-normalize.js: ตัวเลข/ตัวย่อ/ๆ/อังกฤษ → คำไทย) + ตัดท่อน + ช่วงเงียบแบบเดียวกับเว็บ
#   3) สร้างเสียงทีละท่อน (ค่าที่ทดสอบแล้วดีสุด: step 32, speed 1.0) → ต่อเป็นตอน → ปรับความดัง (−20 dBFS) → MP3 ลง Drive
#   ตอนที่มีไฟล์ MP3 ใน Drive แล้ว = เสร็จ → รันใหม่จะข้าม (ทำต่อจากตอนที่ค้าง) · เสียได้มากสุดแค่ตอนที่กำลังทำ
#
# วิธีใช้: เว็บ Tanot หน้า "แปลงเสียง ↔ ข้อความ" → การ์ด "หนังสือเสียงคุณภาพสูง (Google Colab)" → บันทึกข้อความเป็น .txt → เปิดใน Colab
#   (ลิงก์ตรง https://colab.research.google.com/github/tanot713-sudo/My-Web-App/blob/main/tools/colab/tanot-audiobook-f5.ipynb)
#   → Runtime → Change runtime type → L4 GPU → Save → Run (หรือวางทั้งไฟล์นี้ใน cell เดียวของ notebook ใดก็ได้)
#   ไฟล์ .ipynb สร้างจากไฟล์นี้ด้วย `node tools/colab/build-notebook.js` — แก้ไฟล์นี้แล้วต้องรันซ้ำ (tests/colab.spec.js ตรวจ)
#   ครั้งแรก: อนุญาตให้เข้าถึง Google Drive → อัปโหลด นิยาย (.txt) + ref-F-C.wav + ref-M-C.wav
#   เสียงตัวอย่างถูกเก็บไว้ที่ My Drive/Tanot หนังสือเสียง/_เสียงตัวอย่าง — เรื่องถัดไปอัปโหลดแค่นิยาย
#   Colab หลุด/ปิดไป: เปิดใหม่ เลือก L4 แล้วรัน cell เดิม — สคริปต์จำเรื่องล่าสุดที่ยังไม่เสร็จ ทำต่อเองโดยไม่ต้องอัปโหลดซ้ำ
#   เปิดแท็บ Colab ค้างไว้ระหว่างทำ (ปิดแท็บ/คอมหลับนาน → Colab ตัดการเชื่อมต่อ)
#   ไฟล์อยู่ที่ My Drive/Tanot หนังสือเสียง/<ชื่อเรื่อง>/<เสียง>/ — ฟังจาก Drive บนมือถือได้เลย
#   ⚠️ ใช้เสียงตัวอย่างที่สร้างเอง/ได้รับอนุญาตเท่านั้น (ชุดนี้สร้างจาก Gemini TTS: หญิง = Jori, ชาย = Riko)

# (ชื่อโฟลเดอร์, รุ่น, เสียงตัวอย่าง) — ผลทดสอบ tts-test-th: หญิง v1 สั่นน้อยสุด · ชาย v2 อ่านชัดกว่า v1
VOICES = [("หญิง-v1", "v1", "F-C"), ("ชาย-v2", "v2", "M-C")]
STEP, CFG, SPEED = 32, 2.0, 1.0   # step 64 ช้าลงเท่าตัวแต่ไม่ดีขึ้น · speed 0.9 แย่ลง (วัดแล้ว)
MAX_CHUNK = 100                   # ความยาวท่อน (ตัวอักษรหลังแปลง)
TIME_SPLIT_CHARS = 25000          # ไม่พบหัวตอน: ตัดส่วนละ ~25,000 ตัวอักษร (~30 นาทีเสียง) ที่ขอบย่อหน้า
LEXICON = ""                      # "คำอ่านของฉัน" (บรรทัดละ "คำ = คำอ่าน") — ว่าง = ไม่ใช้ (คำอ่านที่ทดสอบกับ MMS ใช้กับ F5 ไม่ได้ตรงๆ)
MP3_KBPS = 64                     # เสียงพูดโมโน 64 kbps ชัดพอ (~29 MB/ชั่วโมง)
AUTO_DISCONNECT = True            # เสร็จแล้วคืนเครื่อง GPU ทันที (Colab คิด compute units ตลอดที่เชื่อมต่อ แม้ไม่ได้ทำงาน) — ไฟล์อยู่ใน Drive ไม่หาย
NEW_BOOK = False                  # True = เริ่มเรื่องใหม่ (อัปโหลดใหม่) แม้เรื่องล่าสุดยังไม่เสร็จ
SEED = 1234
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง"

REF_TEXT = {
    "A": "เช้าวันนั้นท้องฟ้าแจ่มใส ลมเย็นพัดผ่านหน้าต่างบานเล็ก เธอหยิบหนังสือเล่มเก่าขึ้นมา แล้วเปิดอ่านต่ออย่างตั้งใจ",
    "B": "ชายหนุ่มก้าวเข้าไปในห้องโถงกว้าง แสงไฟสีทองส่องประกาย เขาหยุดนิ่งครุ่นคิดอยู่ครู่หนึ่ง ก่อนจะตัดสินใจเดินต่อไป",
    "C": "ถ้าเราไม่ลองตอนนี้ ก็ไม่มีวันรู้หรอกว่าผลจะออกมาเป็นอย่างไร พรุ่งนี้เช้าค่อยมาคุยกันใหม่นะ",
}
RAW = "https://raw.githubusercontent.com/tanot713-sudo/My-Web-App/main/"

import json, os, pathlib, re, shutil, subprocess, sys, time, urllib.request

def run(cmd):
    print("$", cmd, flush=True)
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in p.stdout: print(line, end="", flush=True)
    if p.wait(): raise SystemExit(f"❌ คำสั่งล้ม (code {p.returncode}) — คัดลอกข้อความด้านบนส่งกลับมา")

# ── 0) GPU + Drive ──
gpu = subprocess.run("nvidia-smi --query-gpu=name --format=csv,noheader", shell=True, capture_output=True, text=True).stdout.strip()
print("GPU:", gpu or "ไม่มี")
if not gpu:
    raise SystemExit("❌ ยังไม่ได้เปิด GPU — Runtime → Change runtime type → L4 GPU → Save แล้วรัน cell นี้ใหม่")
from google.colab import drive, files
drive.mount("/content/drive")
ROOT = pathlib.Path(DRIVE_DIR); ROOT.mkdir(parents=True, exist_ok=True)
VOICE_DIR = ROOT / "_เสียงตัวอย่าง"; VOICE_DIR.mkdir(exist_ok=True)   # เสียงตัวอย่างใช้ซ้ำทุกเรื่อง

# ── 1) สภาพแวดล้อมแยก (เหมือนสคริปต์ 3) ──
BASE = "/content/tanot_f5"; ENV = f"{BASE}/env"; PY = f"{ENV}/bin/python"
os.makedirs(BASE, exist_ok=True)
if not os.path.exists(f"{ENV}/.ok"):
    run("pip -q install uv")
    run(f"uv venv {ENV} --python 3.11 -q")
    run(f"uv pip install -q --python {PY} torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu121")
    run(f'uv pip install -q --python {PY} f5-tts-th==1.0.9 "numpy==1.26.4" soundfile "transformers>=4.40,<4.50"')
    pathlib.Path(f"{ENV}/.ok").write_text("ok")

# ── 2) เรื่องที่จะทำ: ทำต่อเรื่องล่าสุดที่ยังไม่เสร็จ หรืออัปโหลดเรื่องใหม่ ──
last = ROOT / ".last_book"
book = None
if not NEW_BOOK and last.exists():
    b = ROOT / last.read_text(encoding="utf-8").strip()
    st = b / "status.json"
    if (b / "input").exists() and not (st.exists() and json.loads(st.read_text(encoding="utf-8")).get("done")):
        book = b; print(f"▶ ทำต่อเรื่องเดิม: {b.name} (ตั้ง NEW_BOOK = True ถ้าจะเริ่มเรื่องใหม่)")
if book is None:
    have = {p.stem[4:] for p in VOICE_DIR.glob("ref-*.wav")}
    need0 = sorted({r for _, _, r in VOICES} - have)
    print("อัปโหลด นิยาย (.txt)" + (" + " + " + ".join(f"ref-{r}.wav" for r in need0) + " (เลือกพร้อมกันได้)" if need0 else " (ใช้เสียงตัวอย่างที่เก็บไว้ใน Drive)"))
    up = files.upload()
    txts = [n for n in up if n.lower().endswith(".txt")]
    if len(txts) != 1: raise SystemExit("❌ ต้องมีไฟล์นิยาย .txt 1 ไฟล์")
    name = re.sub(r"\s*\(\d+\)$", "", pathlib.Path(txts[0]).stem)
    name = re.sub(r'[\\/:*?"<>|]', " ", name).strip() or "นิยาย"
    book = ROOT / name; inp = book / "input"; inp.mkdir(parents=True, exist_ok=True)
    (inp / "book.txt").write_bytes(up[txts[0]])
    for n, data in up.items():
        m = re.search(r"ref-([MF])-([ABC])", n, re.I)
        if m and n.lower().endswith(".wav"): (VOICE_DIR / f"ref-{m.group(1).upper()}-{m.group(2).upper()}.wav").write_bytes(data)
    last.write_text(book.name, encoding="utf-8")
inp = book / "input"
for p in inp.glob("ref-*.wav"):   # เรื่องที่ทำด้วยสคริปต์รุ่นก่อน (เก็บเสียงตัวอย่างไว้ในโฟลเดอร์เรื่อง)
    if not (VOICE_DIR / p.name).exists(): shutil.copy(p, VOICE_DIR / p.name)
need = sorted({r for _, _, r in VOICES} - {p.stem[4:] for p in VOICE_DIR.glob("ref-*.wav")})
if need:
    print("อัปโหลดเสียงตัวอย่างที่ขาด:", ", ".join(f"ref-{r}.wav" for r in need))
    for n, data in files.upload().items():
        m = re.search(r"ref-([MF])-([ABC])", n, re.I)
        if m and n.lower().endswith(".wav"): (VOICE_DIR / f"ref-{m.group(1).upper()}-{m.group(2).upper()}.wav").write_bytes(data)
    need = sorted({r for _, _, r in VOICES} - {p.stem[4:] for p in VOICE_DIR.glob("ref-*.wav")})
    if need: raise SystemExit(f"❌ ยังไม่มีเสียงตัวอย่าง {need} (ชื่อไฟล์ต้องมี ref-F-C / ref-M-C)")
TEXT = (inp / "book.txt").read_bytes().decode("utf-8-sig")
print(f"เรื่อง: {book.name} · {len(TEXT):,} ตัวอักษร")

# ── 3) แบ่งตอน + แปลงข้อความ + ตัดท่อน ด้วยโค้ดของเว็บ ──
for f in ("tts-normalize.js", "tts-long.js"):
    urllib.request.urlretrieve(RAW + f, f"{BASE}/{f}")
PLAN_JS = r"""
const N = require(process.argv[1]), L = require(process.argv[2]); let s = '';
process.stdin.on('data', d => s += d).on('end', () => {
  const j = JSON.parse(s), opt = { max: j.max, lexicon: j.lexicon || undefined }, used = {}, out = [];
  const ch = L.splitChapters(j.text);
  if (ch) ch.forEach(c => { const p = N.plan(c.text, opt); if (p.chunks.length) out.push({ name: L.chapterFileName(c, used), title: c.title || ('ตอน ' + c.num), chunks: p.chunks, gaps: p.gaps }); });
  else {   // ไม่พบหัวตอน: ตัดตามความยาวที่ขอบย่อหน้า
    const p = N.plan(j.text, opt); let cur = null, n = 0;
    p.chunks.forEach((c, i) => {
      if (!cur || (n >= j.split && p.paras[i] !== p.paras[i - 1])) { cur = { name: L.timeFileName(out.length, used), title: 'ส่วนที่ ' + (out.length + 1), chunks: [], gaps: [] }; out.push(cur); n = 0; }
      cur.chunks.push(c); cur.gaps.push(p.gaps[i]); n += c.length;
    });
  }
  process.stdout.write(JSON.stringify(out));
});"""
r = subprocess.run(["node", "-e", PLAN_JS, f"{BASE}/tts-normalize.js", f"{BASE}/tts-long.js"],
                   input=json.dumps({"text": TEXT, "max": MAX_CHUNK, "lexicon": LEXICON, "split": TIME_SPLIT_CHARS}), capture_output=True, text=True)
if r.returncode: raise SystemExit("❌ แปลงข้อความไม่ได้:\n" + r.stderr[-1500:])
parts = json.loads(r.stdout)
for p in parts:
    p["chunks"] = [c.replace("ํา", "ำ") for c in p["chunks"]]   # เว็บแตก ำ ให้ MMS — F5 ใช้ ำ
    if p["gaps"]: p["gaps"][-1] = 0
total_chars = sum(len(c) for p in parts for c in p["chunks"])
print(f"{len(parts)} ตอน · {sum(len(p['chunks']) for p in parts):,} ท่อน · ประมาณ {total_chars / 13.8 / 3600:.1f} ชั่วโมงเสียงต่อ 1 เสียง")

jobs = []
for folder, model, ref in VOICES:
    out = book / folder; out.mkdir(exist_ok=True)
    for i, p in enumerate(parts):
        mp3 = out / f"{p['name']}.mp3"
        if not mp3.exists():
            jobs.append({"model": model, "ref": str(VOICE_DIR / f"ref-{ref}.wav"), "ref_text": REF_TEXT[ref.split("-")[1]], "voice": folder,
                         "chunks": p["chunks"], "gaps": p["gaps"], "mp3": str(mp3), "title": p["title"], "track": i + 1, "of": len(parts)})
left = sum(len(c) for j in jobs for c in j["chunks"])
print(f"ค้างอยู่ {len(jobs)} ไฟล์ (≈ {left / 13.8 / 3600:.1f} ชั่วโมงเสียง · ใช้เวลาสร้างราว {left / 13.8 / 3.7 / 60:.0f} นาทีบน L4)")
if not jobs:
    (book / "status.json").write_text(json.dumps({"done": True}), encoding="utf-8")
    raise SystemExit(f"✅ เสร็จครบแล้ว — ไฟล์อยู่ที่ {book}")
pathlib.Path(BASE, "jobs4.json").write_text(json.dumps({"jobs": jobs, "step": STEP, "cfg": CFG, "speed": SPEED, "seed": SEED,
    "kbps": MP3_KBPS, "album": book.name, "problems": str(book / "problems.txt")}, ensure_ascii=False), encoding="utf-8")

# ── 4) สร้างเสียง ──
WORKER = r'''
import contextlib, io, json, os, subprocess, sys, time, numpy as np, soundfile as sf, torch
cfg = json.load(open(sys.argv[1], encoding="utf-8"))
from f5_tts_th.tts import TTS
SR = 24000; loaded = {}
def trim(x, db=-45, keep=0.05):   # ตัดความเงียบหัว/ท้ายท่อนที่ F5 ใส่มาเอง → ช่วงเงียบระหว่างท่อนเท่าเว็บ
    fr = int(SR * 0.02); th = 10 ** (db / 20)
    e = [float(np.sqrt(np.mean(x[i:i + fr] ** 2))) for i in range(0, max(1, len(x) - fr + 1), fr)]
    on = [i for i, v in enumerate(e) if v > th]
    if not on: return x
    return x[max(0, on[0] * fr - int(SR * keep)):min(len(x), (on[-1] + 1) * fr + int(SR * keep))]
def loud(x):   # RMS −20 dBFS, จุดดังสุดไม่เกิน −1 dBFS (เหมือนเว็บ)
    x = x * (10 ** (-20 / 20) / (float(np.sqrt(np.mean(x ** 2))) or 1e-9))
    return x * min(1.0, 10 ** (-1 / 20) / (float(np.max(np.abs(x))) or 1e-9))
def problem(msg):
    with open(cfg["problems"], "a", encoding="utf-8") as f: f.write(time.strftime("%Y-%m-%d %H:%M ") + msg + "\n")
all_chars = sum(len(c) for j in cfg["jobs"] for c in j["chunks"]); done_chars = 0; t_start = time.time()
for j in cfg["jobs"]:
    if j["model"] not in loaded:
        loaded.clear(); torch.cuda.empty_cache()
        t = time.time(); loaded[j["model"]] = TTS(model=j["model"]); print(f"โหลดรุ่น {j['model']} ({time.time()-t:.0f} วิ)", flush=True)
    tts = loaded[j["model"]]; torch.manual_seed(cfg["seed"])
    name = os.path.basename(j["mp3"]); parts = []; t0 = time.time()
    print(f"\n▶ {j['voice']} · {name} ({len(j['chunks'])} ท่อน)", flush=True)
    for i, (c, g) in enumerate(zip(j["chunks"], j["gaps"])):
        if c.strip():
            w = None
            for attempt in range(2):
                try:
                    # F5 พิมพ์ข้อความทุกท่อน + แถบความคืบหน้า — หลายพันท่อนทำให้หน้า Colab ค้าง → เก็บเงียบ
                    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                        w = tts.infer(ref_audio=j["ref"], ref_text=j["ref_text"], gen_text=c, step=cfg["step"], cfg=cfg["cfg"], speed=cfg["speed"], max_chars=1000)
                    break
                except Exception as e:
                    torch.manual_seed(cfg["seed"] + attempt + 1)
                    if attempt: problem(f"{j['voice']}/{name} ท่อน {i+1}: {type(e).__name__}: {str(e)[:120]} → ใส่ช่วงเงียบแทน")
            parts.append(trim(np.asarray(w, dtype=np.float32).reshape(-1)) if w is not None else np.zeros(int(SR * 0.3), dtype=np.float32))
        if g: parts.append(np.zeros(int(SR * g), dtype=np.float32))
        done_chars += len(c)
        if (i + 1) % 25 == 0:
            el = time.time() - t_start; eta = el / max(done_chars, 1) * (all_chars - done_chars)
            print(f"  {i+1}/{len(j['chunks'])} ท่อน · ทั้งหมด {100*done_chars/all_chars:.0f}% · เหลือราว {eta/60:.0f} นาที", flush=True)
    x = loud(np.concatenate(parts))
    wav = "/content/tanot_f5/part.wav"; sf.write(wav, x, SR, subtype="PCM_16")
    tmp = j["mp3"] + ".partial.mp3"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-codec:a", "libmp3lame", "-b:a", f"{cfg['kbps']}k",
                    "-metadata", f"title={j['title']}", "-metadata", f"album={cfg['album']}", "-metadata", f"artist=Tanot F5 ({j['voice']})",
                    "-metadata", f"track={j['track']}/{j['of']}", tmp], check=True)
    os.replace(tmp, j["mp3"])   # ไฟล์ .mp3 ปรากฏเมื่อเสร็จสมบูรณ์เท่านั้น → รันใหม่ข้ามได้ถูก
    print(f"✅ {j['voice']}/{name} · {len(x)/SR/60:.1f} นาทีเสียง · ใช้ {(time.time()-t0)/60:.1f} นาที", flush=True)
'''
wk = pathlib.Path(BASE, "worker4.py"); wk.write_text(WORKER, encoding="utf-8")
for f in book.glob("*/*.partial.mp3"): f.unlink()   # เศษจากรอบที่หลุดกลางทาง
t0 = time.time()
run(f"MPLBACKEND=Agg {PY} {wk} {BASE}/jobs4.json")
(book / "status.json").write_text(json.dumps({"done": True, "minutes": round((time.time() - t0) / 60, 1)}), encoding="utf-8")
print("\n════════ สรุป (คัดลอกส่งกลับมา) ════════")
for folder, _, _ in VOICES:
    fs = sorted((book / folder).glob("*.mp3"))
    print(f"{folder}: {len(fs)} ไฟล์ · {sum(f.stat().st_size for f in fs) / 1e6:.0f} MB")
print(f"ใช้เวลารอบนี้ {(time.time() - t0) / 60:.0f} นาที · ไฟล์อยู่ที่ Google Drive: {book}")
pr = book / "problems.txt"
print("ท่อนที่มีปัญหา:", pr.read_text(encoding="utf-8")[-1500:] if pr.exists() else "ไม่มี")
print("ดาวน์โหลด: เปิด drive.google.com → Tanot หนังสือเสียง → คลิกขวาที่โฟลเดอร์เรื่อง → ดาวน์โหลด (ได้ .zip) · ลบใน Drive ทีหลังได้เลย")
if AUTO_DISCONNECT:
    print("คืนเครื่อง GPU แล้ว (หยุดคิด compute units) — ผลด้านบนยังอยู่ให้คัดลอก")
    time.sleep(3)
    from google.colab import runtime
    runtime.unassign()
