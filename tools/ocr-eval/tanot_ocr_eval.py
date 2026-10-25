# Tanot — สคริปต์ 11: วัดความแม่นของ OCR ทุกตัวด้วยภาพจริง + เฉลยที่แก้แล้ว (ขั้น 0 ของแผน OCR)
#
# ใช้ภาพใน Drive "Tanot หนังสือเสียง/_ผลวัด-OCR/ภาพ/" ที่มี "<ชื่อ>.txt" (เฉลย) คู่กัน · ประเภท = คำแรกของชื่อ (ใบเสร็จ สแกน ถ่าย จอ ตาราง ลายมือ)
# ตัวที่วัด (เลือกได้ที่ ENGINES)
#   tesseract       = โหมดฟรีของเว็บ (file-reader.js ตัวจริง: เตรียมภาพ + Tesseract.js tha+eng) เปิดหน้าเว็บใน Chromium
#   tesseract-best  = เหมือนกันแต่ติ๊ก "โหมดแม่นยำ" (tessdata_best)
#   paddle          = PaddleOCR PP-OCRv5 รุ่นภาษาไทย (th_PP-OCRv5_mobile_rec) — ตัวเลือกที่จะเอาเข้าเบราว์เซอร์ได้ (PaddleOCR.js)
#   paddle-unwarp   = เหมือนกัน + ตัวหมุน/คลี่หน้ากระดาษโค้ง (UVDoc) ก่อนอ่าน
#   typhoon         = Typhoon OCR 1.5 (2B) บน GPU — โมเดลไทยเฉพาะทาง ใหญ่เกินเบราว์เซอร์ (ไว้ดูเพดานของโมเดลเปิด)
#   claude-*        = /api/ocr ของเว็บจริง (ย่อรูปแบบเดียวกับเว็บ) — เสียค่า Claude API (20 ภาพ × 3 รุ่น ≈ 1–3 USD) · ต้องตั้ง Secret 2 ตัว (ด้านล่าง)
# ผล: "_ผลวัด-OCR/report-OCR.txt" (CER รวม/ตามประเภท/รายภาพ + จำนวนครั้งที่วนซ้ำ) · ข้อความที่แต่ละตัวอ่านได้ "_ผลวัด-OCR/ผล/<ตัว>/<ชื่อ>.txt"
#
# วิธีใช้ (Colab → L4 GPU → วางทั้งไฟล์ → Run) · ราว 40–70 นาที (Tesseract ในเบราว์เซอร์ช้าสุด) · รันซ้ำได้ ผลที่ได้แล้วเก็บใน Drive ไม่ทำซ้ำ
#   Claude: Colab 🔑 Secrets เพิ่ม OCR_PIN (รหัสเดียวกับในเว็บ) และ TANOT_COOKIE (= "CF_Authorization=<ค่า>" จากคอมพิวเตอร์ที่ล็อกอินเว็บแล้ว:
#           DevTools → Application → Cookies → my-web-app-5w2.pages.dev → CF_Authorization) · ไม่ตั้ง = ข้าม Claude · ห้ามวางค่าลงโค้ด/แชท
#   ข้อควรรู้: เฉลยส่วนใหญ่แก้จากร่างของ Typhoon (ถ่าย 1 จากร่างของ Claude) → ถ้ามีจุดที่หลุดตาไม่ได้แก้ ตัวนั้นจะได้เปรียบเล็กน้อย

ENGINES = ["typhoon", "paddle", "paddle-unwarp", "tesseract", "tesseract-best", "claude-sonnet-5", "claude-sonnet-5-5", "claude-haiku-5-5"]
SITE = "https://my-web-app-5w2.pages.dev"
REPO = "https://github.com/tanot713-sudo/My-Web-App"
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง"
TYPHOON = "typhoon-ai/typhoon-ocr1.5-2b"

import base64, html, io, json, os, pathlib, re, shutil, subprocess, time, unicodedata

def run(cmd, env=None):
    print("$", cmd, flush=True)
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
    tail = []
    for line in p.stdout: print(line, end="", flush=True); tail = (tail + [line.rstrip()])[-12:]
    if p.wait(): raise RuntimeError(f"คำสั่งล้ม (code {p.returncode}): {cmd[:120]}\n" + "\n".join(tail))

# ── ตัววัด (เหมือน tools/media-eval/metrics.mjs: NFC · ตัวพิมพ์เล็ก · เลขไทย→อารบิก · ตัดวรรคตอน/สัญลักษณ์ · CER ไม่นับช่องว่าง) ──
def norm(s):
    s = unicodedata.normalize("NFC", s or "").lower()
    s = "".join(str("๐๑๒๓๔๕๖๗๘๙".index(c)) if c in "๐๑๒๓๔๕๖๗๘๙" else (" " if unicodedata.category(c)[0] in "PS" else c) for c in s)
    return re.sub(r"\s+", " ", s).strip()
try:
    from rapidfuzz.distance import Levenshtein   # เร็วกว่า Python ล้วนหลายร้อยเท่า (ข้อความที่วนซ้ำยาวหลายหมื่นตัวอักษร)
except ImportError:
    subprocess.run("pip -q install rapidfuzz", shell=True); from rapidfuzz.distance import Levenshtein
def edits(a, b):
    return Levenshtein.distance(a, b)
def edits_py(a, b):   # ตัวอ้างอิง (ผลเท่ากัน)
    if len(a) < len(b): a, b = b, a
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1): cur.append(min(prev[j - 1] + (x != y), prev[j] + 1, cur[j - 1] + 1))
        prev = cur
    return prev[-1]
def cer_parts(ref, hyp):
    r, h = norm(ref).replace(" ", ""), norm(hyp).replace(" ", "")
    return edits(r, h), max(1, len(r))
def looped(t):   # วลี 4–60 ตัวอักษรซ้ำติดกัน ≥ 6 รอบ = อาการวนซ้ำ
    return bool(re.search(r"(\S.{3,59}?)(?:\s*\1){5,}", t or "", flags=re.S))

def to_plain(md):   # Markdown/HTML → ข้อความล้วน (เหมือนสคริปต์ 10)
    t = re.sub(r"<figure>.*?</figure>", "", md or "", flags=re.S)
    t = re.sub(r"</?page_number>", "", t)
    t = re.sub(r"</t[dh]>\s*<t[dh][^>]*>", " | ", t)
    t = re.sub(r"</tr>|<br\s*/?>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", "", t))
    t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.M)
    t = re.sub(r"(\*\*|__)(.+?)\1", r"\2", t)
    t = re.sub(r"^\s*[-*+]\s+", "", t, flags=re.M)
    return re.sub(r"\n{3,}", "\n\n", t).strip()

# ── 0) Drive + ภาพ/เฉลย ──
from google.colab import drive
drive.mount("/content/drive")
EV = pathlib.Path(DRIVE_DIR) / "_ผลวัด-OCR"; IMG = EV / "ภาพ"; OUTD = EV / "ผล"; OUTD.mkdir(exist_ok=True)
CACHE = EV / "ผล-ทั้งหมด.json"
res = json.loads(CACHE.read_text()) if CACHE.exists() else {}   # {ตัว: {ชื่อ: {text, sec, err}}}
def save(): CACHE.write_text(json.dumps(res, ensure_ascii=False))

from PIL import Image, ImageOps
try:
    import pillow_heif
except ImportError:
    subprocess.run("pip -q install pillow-heif", shell=True); import pillow_heif
pillow_heif.register_heif_opener()
W = pathlib.Path("/content/tanot_ocr11"); (W / "img").mkdir(parents=True, exist_ok=True); (W / "small").mkdir(exist_ok=True)
IMG_EXT = re.compile(r"\.(jpe?g|png|heic|heif|webp|bmp|tiff?|gif)$", re.I)
items = []   # (ชื่อ, ประเภท, เฉลย, ภาพเต็ม .jpg, ภาพย่อแบบเว็บ .jpg)
for p in sorted(IMG.iterdir()):
    if p.is_dir() or re.search(r"\.(txt|xlsx?|csv|docx?|pdf)$", p.name, re.I): continue
    key = IMG_EXT.sub("", p.name).strip()
    ref = IMG / (key + ".txt")
    if not ref.exists(): print(f"ข้าม {p.name} — ไม่มีเฉลย {ref.name}"); continue
    try: im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")   # หมุนตาม EXIF (เว็บก็หมุน)
    except Exception as e: print(f"ข้าม {p.name} — เปิดเป็นภาพไม่ได้ ({type(e).__name__})"); continue
    i = len(items); full, small = W / "img" / f"{i:02d}.jpg", W / "small" / f"{i:02d}.jpg"
    im.save(full, quality=95)
    s = im.copy(); s.thumbnail((2000, 2000)); s.save(small, quality=85)   # = TanotOcr.shrinkImage (ด้านยาว ≤ 2000, JPEG 0.85) ก่อนส่ง Claude
    refs = re.sub(r"^\[\[หน้า \d+\]\]\s*$", "", ref.read_text(encoding="utf-8-sig"), flags=re.M)
    items.append((key, re.split(r"[\s\-_]+", key)[0], refs, str(full), str(small)))
print(f"ภาพที่มีเฉลย {len(items)}: " + ", ".join(k for k, *_ in items))
if not items: raise SystemExit("❌ ไม่มีภาพที่มีเฉลย <ชื่อ>.txt")
def todo(engine): return [it for it in items if it[0] not in res.get(engine, {}) or res[engine][it[0]].get("err")]   # ที่ล้มรอบก่อน = ทำใหม่
FAIL = {}   # ตัวที่ล้มทั้งตัว (ติดตั้ง/โหลดไม่ได้) → ลงรายงาน
def put(engine, key, text=None, sec=0.0, err=None):
    res.setdefault(engine, {})[key] = {"text": text, "sec": round(sec, 1), "err": err}; save()
    print(f"  {engine:<18} {key:<12} {sec:5.0f} วิ  " + (f"ERROR {err[:120]}" if err else (text or "").replace("\n", " ")[:90]), flush=True)

# ── 1) Typhoon OCR 1.5 (GPU) ──
if "typhoon" in ENGINES and todo("typhoon"):
    try:
        run('pip -q install "transformers>=4.57" accelerate typhoon-ocr==0.4.1')
        import torch
        from transformers import AutoModelForImageTextToText, AutoProcessor
        from typhoon_ocr import prepare_ocr_messages
        model = AutoModelForImageTextToText.from_pretrained(TYPHOON, dtype=torch.bfloat16, device_map="cuda").eval()
        proc = AutoProcessor.from_pretrained(TYPHOON)
        for key, cat, ref, full, small in todo("typhoon"):
            t0 = time.time()
            try:
                msg = prepare_ocr_messages(full, task_type="v1.5", target_image_dim=1800, figure_language="Thai")[0]["content"]
                prompt = next(c["text"] for c in msg if c["type"] == "text")
                img = Image.open(io.BytesIO(base64.b64decode(next(c["image_url"]["url"] for c in msg if c["type"] == "image_url").split(",", 1)[1]))).convert("RGB")
                conv = [{"role": "user", "content": [{"type": "text", "text": prompt}, {"type": "image", "image": img}]}]
                inp = proc.apply_chat_template(conv, tokenize=True, add_generation_prompt=True, return_dict=True, return_tensors="pt").to(model.device)
                with torch.no_grad(): out = model.generate(**inp, max_new_tokens=6144, do_sample=False, repetition_penalty=1.1)
                put("typhoon", key, to_plain(proc.batch_decode(out[:, inp["input_ids"].shape[1]:], skip_special_tokens=True)[0]), time.time() - t0)
            except Exception as e: put("typhoon", key, None, time.time() - t0, f"{type(e).__name__}: {e}")
        del model; torch.cuda.empty_cache()
    except Exception as e: FAIL["typhoon"] = str(e)[-600:]; print(f"⚠️ ข้าม typhoon: {e}")

# ── 2) PaddleOCR รุ่นไทย (CPU · venv แยก Python 3.11 กันชนกับ Colab) ──
PADDLE_CFG = "mobile_det+th_PP-OCRv5_mobile_rec · 2000px"   # เปลี่ยนค่านี้ = วัด PaddleOCR ใหม่ทั้งหมด
for e in ("paddle", "paddle-unwarp"):   # รอบก่อนล้มทั้งชุด หรือใช้ค่าตั้งเก่า → ล้างผลเก่าให้รายงานแสดงแต่รอบนี้
    if res.get(e) and (all(r.get("err") for r in res[e].values()) or res.get("_cfg", {}).get(e) != PADDLE_CFG): del res[e]
    res.setdefault("_cfg", {})[e] = PADDLE_CFG
PD = [e for e in ("paddle", "paddle-unwarp") if e in ENGINES and todo(e)]
for old in (W / "paddle.py", W / "paddle-out.json"):   # ของรอบที่ล้ม (ชื่อไฟล์ทับแพ็กเกจ)
    if old.exists(): old.unlink()
if PD:
    try:
        PENV = W / "penv"; PPY = f"{PENV}/bin/python"
        if not (PENV / ".ok").exists():
            run("pip -q install uv"); run(f"uv venv {PENV} --python 3.11 -q")
            run(f'uv pip install -q --python {PPY} paddlepaddle==3.3.1 paddleocr==3.7.0')
            (PENV / ".ok").write_text("ok")
        PADDLE_PY = r'''
import json, sys, time
from paddleocr import PaddleOCR
c = json.load(open(sys.argv[1])); out = {}
def lines(texts, boxes):   # เรียงเป็นบรรทัด: กล่องที่จุดกึ่งกลางแนวตั้งใกล้กัน = บรรทัดเดียว แล้วเรียงซ้าย→ขวา
    b = sorted(((float(y1 + y2) / 2, float(y2 - y1), float(x1), t) for t, (x1, y1, x2, y2) in zip(texts, boxes) if t.strip()), key=lambda r: r[0])
    rows = []
    for r in b:
        if rows and abs(r[0] - rows[-1][0][0]) < 0.5 * max(r[1], rows[-1][0][1]): rows[-1].append(r)
        else: rows.append([r])
    return "\n".join(" ".join(t for *_, t in sorted(row, key=lambda r: r[2])) for row in rows)
for eng in c["engines"]:
    unwarp = eng == "paddle-unwarp"
    ocr = PaddleOCR(text_detection_model_name="PP-OCRv5_mobile_det",   # ตัวหาบรรทัดรุ่นมือถือ = ตัวที่จะใช้ในเบราว์เซอร์ (รุ่น server กินแรมจนถูก Killed)
                    text_recognition_model_name="th_PP-OCRv5_mobile_rec",   # ต้องระบุเอง: ใส่ชื่อตัวหาบรรทัดแล้ว lang="th" ถูกเมิน → ได้ตัวอ่านจีน/อังกฤษ (ไทยออกมาเป็นตัวละตินมั่ว)
                    use_doc_orientation_classify=unwarp, use_doc_unwarping=unwarp, use_textline_orientation=False, device="cpu",
                    enable_mkldnn=False)   # oneDNN ของ paddlepaddle 3.3 บน CPU ล้ม "ConvertPirAttribute2RuntimeAttribute not support"
    for key, path in c["items"][eng]:
        t0 = time.time()
        try:
            r = ocr.predict(path)[0]
            out.setdefault(eng, {})[key] = {"text": lines(r["rec_texts"], r["rec_boxes"].tolist()), "sec": time.time() - t0, "err": None}
        except Exception as e:
            out.setdefault(eng, {})[key] = {"text": None, "sec": time.time() - t0, "err": f"{type(e).__name__}: {e}"[:300]}
        print(eng, key, f"{time.time() - t0:.0f}s", flush=True)
        json.dump(out, open(c["out"], "w"), ensure_ascii=False)
'''
        (W / "run_paddle.py").write_text(PADDLE_PY)   # ห้ามตั้งชื่อ paddle.py — Python จะ import ไฟล์นี้แทนแพ็กเกจ paddle
        (W / "paddle.json").write_text(json.dumps({"engines": PD, "out": str(W / "paddle-out.json"),
                                                   "items": {e: [(k, small) for k, _, _, _, small in todo(e)] for e in PD}}, ensure_ascii=False))   # ภาพย่อ 2000px (เท่าที่เว็บส่ง) — ภาพเต็ม 12 ล้านพิกเซลทำแรมหมด
        run(f"{PPY} {W}/run_paddle.py {W}/paddle.json", env=dict(os.environ, DISABLE_MODEL_SOURCE_CHECK="True", FLAGS_use_mkldnn="0"))
    except Exception as e: FAIL["paddle"] = str(e)[-600:]; print(f"⚠️ PaddleOCR ล้ม: {e}")
    if (W / "paddle-out.json").exists():
        for eng, d in json.loads((W / "paddle-out.json").read_text()).items():
            for key, r in d.items(): put(eng, key, r["text"], r["sec"], r["err"])

# ── 3) Tesseract ของเว็บจริง (file-reader.js ในหน้า text-to-speech.html บน Chromium) ──
TS = [e for e in ("tesseract", "tesseract-best") if e in ENGINES and todo(e)]
if TS:
    try:
        v = subprocess.run("node -v", shell=True, capture_output=True, text=True).stdout.strip()
        if not re.match(r"v(1[89]|[2-9]\d)\.", v):
            run("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null && apt-get install -y -qq nodejs > /dev/null")
        APP = W / "My-Web-App"
        if not APP.exists(): run(f"git clone -q --depth 1 {REPO} '{APP}'")
        if not (APP / "tests" / "node_modules" / "@playwright").exists():
            run(f"apt-get -qq update > /dev/null; cd '{APP}/tests' && npm ci --silent && npx playwright install --with-deps chromium > /dev/null")
        srv = subprocess.Popen(f"python3 -m http.server 8151 --bind 127.0.0.1 --directory '{APP}'", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(2)
        TESS_JS = r'''
const { chromium } = require(process.argv[2]);
const fs = require('fs');
const c = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
(async () => {
  const b = await chromium.launch();
  const out = {};
  for (const eng of c.engines) {
    const page = await (await b.newContext()).newPage();
    await page.goto('http://127.0.0.1:8151/text-to-speech.html');
    await page.waitForFunction(() => window.TanotFileReader && window.Tesseract, null, { timeout: 180000 });
    for (const [key, path] of c.items[eng]) {
      const t0 = Date.now();
      try {
        const text = await page.evaluate(async ({ b64, acc }) => {
          const bin = atob(b64), u = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          return window.TanotFileReader.readAnyFile(new File([u], 'x.jpg', { type: 'image/jpeg' }), { ocr: true, accurate: acc });
        }, { b64: fs.readFileSync(path).toString('base64'), acc: eng === 'tesseract-best' });
        (out[eng] = out[eng] || {})[key] = { text, sec: (Date.now() - t0) / 1000, err: null };
      } catch (e) { (out[eng] = out[eng] || {})[key] = { text: null, sec: (Date.now() - t0) / 1000, err: String(e && e.message || e).slice(0, 300) }; }
      console.log(eng, key, ((Date.now() - t0) / 1000).toFixed(0) + 's');
      fs.writeFileSync(c.out, JSON.stringify(out));
    }
  }
  await b.close();
})();
'''
        (W / "tess.js").write_text(TESS_JS)
        (W / "tess.json").write_text(json.dumps({"engines": TS, "out": str(W / "tess-out.json"),
                                                 "items": {e: [(k, full) for k, _, _, full, _ in todo(e)] for e in TS}}, ensure_ascii=False))
        run(f"node {W}/tess.js '{APP}/tests/node_modules/@playwright/test' {W}/tess.json")
        srv.terminate()
    except Exception as e: FAIL["tesseract"] = str(e)[-600:]; print(f"⚠️ Tesseract ล้ม: {e}")
    if (W / "tess-out.json").exists():
        for eng, d in json.loads((W / "tess-out.json").read_text()).items():
            for key, r in d.items(): put(eng, key, r["text"], r["sec"], r["err"])

# ── 4) Claude ผ่าน /api/ocr ของเว็บจริง (เสียเงิน · ต้องมี Secret OCR_PIN + TANOT_COOKIE) ──
CL = [e for e in ENGINES if e.startswith("claude-") and todo(e)]
if CL:
    from google.colab import userdata
    try: PIN, COOKIE = userdata.get("OCR_PIN"), userdata.get("TANOT_COOKIE")
    except Exception: PIN = COOKIE = None
    if not PIN or not COOKIE: FAIL["claude"] = "ยังไม่ได้ตั้ง Secret OCR_PIN / TANOT_COOKIE"; print("⚠️ ข้าม Claude — ยังไม่ได้ตั้ง Secret OCR_PIN / TANOT_COOKIE (หรือยังไม่เปิด Notebook access)")
    else:
        import requests
        stop = None
        for eng in CL:
            for key, cat, ref, full, small in todo(eng):
                if stop: break
                t0 = time.time()
                try:
                    r = requests.post(SITE + "/api/ocr", allow_redirects=False, timeout=300,
                                      headers={"Content-Type": "application/json", "Cookie": COOKIE, "Origin": SITE, "X-OCR-Pin": PIN},
                                      json={"imageBase64": base64.b64encode(open(small, "rb").read()).decode(), "mediaType": "image/jpeg", "model": eng})
                    if 300 <= r.status_code < 400: stop = "คุกกี้ Access หมดอายุ/ไม่ถูก (ถูกส่งไปหน้าล็อกอิน) — เอาค่าใหม่ใส่ TANOT_COOKIE"; break
                    d = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
                    if str(d.get("code", "")).startswith("pin_"): stop = f"รหัส OCR_PIN ไม่ผ่าน ({d.get('code')}) — หยุดเรียก Claude กันล็อก 15 นาที"; break
                    if r.ok: put(eng, key, d.get("text", ""), time.time() - t0)
                    else: put(eng, key, None, time.time() - t0, str(d.get("error") or f"HTTP {r.status_code}"))
                except Exception as e: put(eng, key, None, time.time() - t0, type(e).__name__)
        if stop: FAIL["claude"] = stop; print("⚠️ " + stop)

# ── 5) รายงาน ──
cats = list(dict.fromkeys(c for _, c, *_ in items))
L = [f"Tanot · สคริปต์ 11 · OCR {len(items)} ภาพ · CER = อัตราตัวอักษรผิด (ยิ่งต่ำยิ่งดี; ไม่นับช่องว่าง/วรรคตอน · เกิน 100% ได้ถ้าอ่านเกิน/วนซ้ำ)", "",
     f"{'ตัว':<18} {'รวม':>7} " + " ".join(f"{c:>8}" for c in cats) + f" {'วนซ้ำ':>6} {'ล้ม':>4} {'วิ/ภาพ':>7}"]
per = {}
for eng in ENGINES:
    d = res.get(eng, {})
    if not d: continue
    tot = [0, 0]; bycat = {c: [0, 0] for c in cats}; loops = errs = 0; secs = []
    for key, cat, ref, *_ in items:
        r = d.get(key)
        if not r: continue
        if r["err"]: errs += 1; continue
        e, n = cer_parts(ref, r["text"]); tot[0] += e; tot[1] += n; bycat[cat][0] += e; bycat[cat][1] += n
        loops += looped(r["text"]); secs.append(r["sec"]); per.setdefault(key, {})[eng] = e / n
        f = OUTD / eng; f.mkdir(exist_ok=True); (f / f"{key}.txt").write_text(r["text"] or "", encoding="utf-8")
    pc = lambda a: f"{a[0] / a[1] * 100:6.1f}%" if a[1] else "      —"
    L.append(f"{eng:<18} {pc(tot):>7} " + " ".join(f"{pc(bycat[c]):>8}" for c in cats) + f" {loops:>6} {errs:>4} {sum(secs) / max(1, len(secs)):7.0f}")
L += ["", "รายภาพ (CER):", f"{'ภาพ':<12} " + " ".join(f"{e[:10]:>10}" for e in ENGINES if res.get(e))]
for key, *_ in items:
    L.append(f"{key:<12} " + " ".join((f"{per[key][e] * 100:9.1f}%" if e in per.get(key, {}) else f"{'—':>10}") for e in ENGINES if res.get(e)))
errs = [(e, k, r["err"]) for e in ENGINES for k, r in res.get(e, {}).items() if r["err"]]
if FAIL: L += ["", "ตัวที่ไม่ได้รัน/ล้มทั้งตัว:"] + [f"  {e}: {m}" for e, m in FAIL.items()]
if errs: L += ["", "ที่ล้ม:"] + [f"  {e} · {k}: {m[:200]}" for e, k, m in errs]
L += ["", "หมายเหตุ: tesseract = หน้าเว็บจริง (เตรียมภาพ + Tesseract.js) · claude-* ส่งรูปย่อ 2000px แบบเว็บ · เฉลยส่วนใหญ่แก้จากร่าง Typhoon (ถ่าย 1 จาก Claude)",
      f"ข้อความที่แต่ละตัวอ่านได้: {OUTD}/<ตัว>/<ภาพ>.txt (ไว้เปิดดูว่าผิดแบบไหน — ห้ามใส่ GitHub)"]
rep = "\n".join(L); (EV / "report-OCR.txt").write_text(rep, encoding="utf-8"); print("\n" + rep)
print(f"\n✅ เสร็จ — ส่ง {EV}/report-OCR.txt กลับมา (รันซ้ำได้: ตัวที่ได้ผลแล้วไม่ทำซ้ำ · อยากวัดใหม่ทั้งหมดให้ลบ ผล-ทั้งหมด.json)")
