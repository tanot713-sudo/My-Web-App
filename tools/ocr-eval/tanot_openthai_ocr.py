# Tanot — สคริปต์ 12: OpenThai 2.0 OCR Markdown (iApp, 0.63B) บน Colab → ไฟล์ .md + ตารางเป็น .xlsx + วัด CER กับ 20 ภาพเดิม
#
# โมเดล: iapp/OpenThai2.0-OCR-Markdown (ต่อยอด NVIDIA Nemotron 3.5 Parse · license OpenMDW-1.1) — รันบน Colab เอง ไม่ส่งรูปไป API ของ iApp
# วิธีรัน = ตาม model card + run_transformers_inference.py + nemotron_parse/inference.py ของ repo โมเดลเอง (ตรวจแล้ว 2026-11-12, commit ที่ล็อกไว้ด้านล่าง):
#   transformers>=5.14.1 · torch>=2.11 · trust_remote_code · prompt "</s><s><predict_bbox><predict_classes><output_markdown><predict_text_in_pic>"
#   ถอดแบบ greedy + repetition_penalty 1.1 + max_new_tokens 8744 · ภาพ 1 หน้าต่อ 1 คำขอ (โมเดลปรับภาพเป็น 1664×2048 เอง) · ผลตาราง = HTML (rowspan/colspan)
#   ผ่าน DocumentParser(backend=TransformersBackend(...)).parse(ภาพ, mode="single") → doc["markdown"], doc["blocks"]
#
# ⚠️ สคริปต์นี้ยังไม่เคยรันบน Colab จริง (sandbox ที่เขียนเข้า GPU/ไฟล์น้ำหนัก 2.5 GB ไม่ได้) — ตรวจแล้วเฉพาะตัวแปลงตาราง→xlsx และตัววัด CER ด้วยข้อมูลจำลอง
#   ส่วนที่ต้องดูตอนรันครั้งแรก: (1) โหลดโมเดลผ่านบน T4 ไหม และ VRAM สูงสุดเท่าไร (รายงานบอกให้) (2) ตารางที่ได้เป็น <table> ใน Markdown จริงไหม (รายงานนับจำนวนตารางต่อไฟล์)
#
# ทำอะไร
#   A) แปลง: รูป/PDF ใน Drive "Tanot หนังสือเสียง/_OCR-iApp/เข้า/" → "…/ออก/<ชื่อ>.md" (+ "<ชื่อ>.xlsx" เมื่อเจอตาราง: 1 ตาราง = 1 ชีต, เซลล์ที่ผสานคงไว้)
#   B) วัด CER: ภาพ + เฉลย "<ชื่อ>.txt" ใน "_ผลวัด-OCR/ภาพ/" (ชุด 20 ภาพของสคริปต์ 11) → "_ผลวัด-OCR/report-OpenThai.txt" เทียบ PaddleOCR/Tesseract ที่วัดไว้แล้ว
#      (ตัววัดเดียวกับสคริปต์ 11: NFC · ตัวพิมพ์เล็ก · เลขไทย→อารบิก · ตัดวรรคตอน · CER ไม่นับช่องว่าง · Markdown/HTML → ข้อความล้วนก่อนวัด)
#
# วิธีใช้ (Colab → GPU T4 ฟรีหรือ L4 → วางทั้งไฟล์ใน cell เดียว → Run) · ราว 15–40 นาที (ดาวน์โหลดโมเดล ~2.5 GB + อ่านภาพละไม่กี่วินาที)
#   ถ้ารายงานว่า torch/transformers เก่า สคริปต์จะติดตั้งให้แล้วบอกให้ Runtime → Restart session แล้วรันใหม่
#   ไม่ใช้ token/secret ใดๆ (repo โมเดลเป็น public) · ห้ามวางภาพ/ข้อความจริงลง repo หรือแชท

DO_CONVERT = True        # A) แปลงไฟล์ใน _OCR-iApp/เข้า
DO_MEASURE = True        # B) วัด CER กับ _ผลวัด-OCR/ภาพ
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง"
MODEL = "iapp/OpenThai2.0-OCR-Markdown"
REVISION = "7a153712e5b50fac7e4a9d42ccf9ec41fb4202f0"   # commit ที่อ่าน model card แล้ว (2026-11-12) — เปลี่ยนเมื่อตั้งใจอัปรุ่น
MAX_NEW_TOKENS = 8744    # ค่าของ run_transformers_inference.py
REP_PENALTY = 1.1
PDF_SCALE = 2.5          # A4 → ~1490×2105 px (ใกล้ 1664×2048 ที่โมเดลใช้)
MAX_PDF_PAGES = 100
# ตัวเลขอ้างอิงที่วัดไว้แล้วกับ 20 ภาพเดิม (README ของ tools/ocr-eval) — ใช้เทียบเมื่อไม่มีผลใน ผล-ทั้งหมด.json
KNOWN_CER = {"PaddleOCR + คลี่หน้า": 20.4, "PaddleOCR ไม่คลี่": 42.9, "Tesseract (เว็บ)": 45.5}

import html, io, json, pathlib, re, subprocess, sys, time, unicodedata


# ───────────────────────── ตัวช่วยล้วน (ไม่แตะ Colab/GPU — ทดสอบแยกได้) ─────────────────────────
def norm(s):   # = สคริปต์ 11
    s = unicodedata.normalize("NFC", s or "").lower()
    s = "".join(str("๐๑๒๓๔๕๖๗๘๙".index(c)) if c in "๐๑๒๓๔๕๖๗๘๙" else (" " if unicodedata.category(c)[0] in "PS" else c) for c in s)
    return re.sub(r"\s+", " ", s).strip()

def edits(a, b):
    try:
        from rapidfuzz.distance import Levenshtein
        return Levenshtein.distance(a, b)
    except ImportError:
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

def to_plain(md):   # Markdown/HTML → ข้อความล้วน (= สคริปต์ 11)
    t = re.sub(r"<figure>.*?</figure>", "", md or "", flags=re.S)
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    t = re.sub(r"</?page_number>", "", t)
    t = re.sub(r"</t[dh]>\s*<t[dh][^>]*>", " | ", t)
    t = re.sub(r"</tr>|<br\s*/?>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", "", t))
    t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.M)
    t = re.sub(r"(\*\*|__)(.+?)\1", r"\2", t)
    t = re.sub(r"^\s*[-*+]\s+", "", t, flags=re.M)
    return re.sub(r"\n{3,}", "\n\n", t).strip()

def html_tables(md):
    """Markdown → รายการตาราง; แต่ละตาราง = {rows: [[{text, rs, cs}]]} จาก <table> ใน Markdown (โมเดลเขียนตารางเป็น HTML)"""
    from bs4 import BeautifulSoup
    out = []
    for tb in BeautifulSoup(md or "", "html.parser").find_all("table"):
        rows = []
        for tr in tb.find_all("tr"):
            row = []
            for c in tr.find_all(["td", "th"], recursive=False):
                def span(k):
                    try: return max(1, int(str(c.get(k, 1)).strip()))
                    except ValueError: return 1
                row.append({"text": c.get_text("\n", strip=True), "rs": span("rowspan"), "cs": span("colspan")})
            if row: rows.append(row)
        if rows: out.append({"rows": rows})
    return out

def place(rows):
    """วางเซลล์ลงตารางตาม rowspan/colspan → [(r, c, rs, cs, text)] (ดัชนีเริ่ม 1) — เซลล์ที่ซ้อนทับกันข้ามไปช่องว่างถัดไป ไม่ทับกัน"""
    used, cells = set(), []
    for ri, row in enumerate(rows, 1):
        ci = 1
        for cell in row:
            while (ri, ci) in used: ci += 1
            rs, cs = min(cell["rs"], 1000), min(cell["cs"], 100)
            for dr in range(rs):
                for dc in range(cs): used.add((ri + dr, ci + dc))
            cells.append((ri, ci, rs, cs, cell["text"]))
            ci += cs
    return cells

def sheet_name(page, k, taken):
    base = f"p{page}-t{k}"
    n, i = base, 2
    while n in taken: n, i = f"{base}_{i}", i + 1
    taken.add(n); return n

def write_xlsx(path, tables_by_page):
    """tables_by_page = [(หน้า, [ตาราง…])…] → .xlsx 1 ตาราง/ชีต · คืนจำนวนตาราง (0 = ไม่เขียนไฟล์)"""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment
    n = sum(len(ts) for _, ts in tables_by_page)
    if not n: return 0
    wb, taken = Workbook(), set()
    wb.remove(wb.active)
    for page, ts in tables_by_page:
        for k, t in enumerate(ts, 1):
            ws = wb.create_sheet(sheet_name(page, k, taken))
            for r, c, rs, cs, text in place(t["rows"]):
                cell = ws.cell(row=r, column=c, value=text)
                cell.alignment = Alignment(wrap_text=True, vertical="top")
                if rs > 1 or cs > 1: ws.merge_cells(start_row=r, start_column=c, end_row=r + rs - 1, end_column=c + cs - 1)
            from openpyxl.utils import get_column_letter
            for ci in range(1, ws.max_column + 1):   # กว้างตามข้อความ (เพดาน 60) — ใช้เลขคอลัมน์ เพราะเซลล์ที่ผสานไม่มี column_letter
                w = max((len(l) for r in range(1, ws.max_row + 1) for l in str(ws.cell(row=r, column=ci).value or "").split("\n")), default=8)
                ws.column_dimensions[get_column_letter(ci)].width = min(60, max(8, w + 2))
    wb.save(path); return n

def join_pages(md_pages):
    if len(md_pages) == 1: return md_pages[0].strip() + "\n"
    return "\n\n".join(f"<!-- หน้า {i} -->\n\n{m.strip()}" for i, m in enumerate(md_pages, 1)) + "\n"

def report_table(rows):   # rows: [(ป้าย, ค่า)] → ข้อความจัดคอลัมน์
    w = max(len(a) for a, _ in rows)
    return "\n".join(f"  {a:<{w}}  {b}" for a, b in rows)


# ───────────────────────── ส่วนที่รันบน Colab ─────────────────────────
def run(cmd):
    print("$", cmd, flush=True)
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    tail = []
    for line in p.stdout: print(line, end="", flush=True); tail = (tail + [line.rstrip()])[-12:]
    if p.wait(): raise RuntimeError(f"คำสั่งล้ม (code {p.returncode}): {cmd[:120]}\n" + "\n".join(tail))

def ver_lt(have, need):
    def t(v): return tuple(int(x) for x in re.findall(r"\d+", v.split("+")[0])[:3])
    return t(have) < t(need)

def main():
    from importlib import metadata
    # 1) ติดตั้ง (เวอร์ชันตาม reference/parse_3_5/transformers.constraints.txt + pyproject ของ repo โมเดล)
    need = {"torch": "2.11.0", "torchvision": "0.26.0", "transformers": "5.14.1", "huggingface-hub": "1.24.0"}
    old = []
    for pkg, v in need.items():
        try:
            if ver_lt(metadata.version(pkg), v): old.append(pkg)
        except metadata.PackageNotFoundError: old.append(pkg)
    if old:
        run('pip -q install "torch>=2.11.0,<2.14" "torchvision>=0.26.0,<0.29" "transformers>=5.14.1,<5.20" "huggingface-hub>=1.24.0,<2"')
        if any(m in sys.modules for m in ("torch", "transformers")):
            raise SystemExit(f"⚠️ อัปเดต {', '.join(old)} แล้ว — เมนู Runtime → Restart session แล้วรันสคริปต์นี้ใหม่ (ไม่ต้องติดตั้งซ้ำ)")
    run('pip -q install accelerate==1.12.0 timm==1.0.22 einops==0.8.1 beautifulsoup4 openpyxl pypdfium2 pillow-heif rapidfuzz')

    import torch
    if not torch.cuda.is_available(): raise SystemExit("❌ ต้องใช้ GPU: Runtime → Change runtime type → T4 GPU (หรือ L4)")
    from google.colab import drive
    from huggingface_hub import snapshot_download
    from PIL import Image, ImageOps
    import pillow_heif; pillow_heif.register_heif_opener()
    drive.mount("/content/drive")

    # 2) โหลดโมเดล (ไม่เอา dflash2/reference/assets/tests ที่ไม่ได้ใช้ ~หลาย GB)
    t0 = time.time()
    mdir = snapshot_download(MODEL, revision=REVISION, ignore_patterns=[
        "dflash2/*", "reference/*", "assets/*", "tests/*", "docs/*", "model-cards/*", "vllm_tied_patch/*", "logitsprocs/*",
        "Dockerfile", "docker-compose.yaml", "vllm_example.py", "*.md"])
    print(f"โมเดลอยู่ที่ {mdir} ({time.time() - t0:.0f} วิ)")
    sys.path.insert(0, mdir)   # nemotron_parse/, postprocessing.py, latex2html.py ใน repo โมเดล (ไม่ต้อง pip install)
    from transformers import AutoModel, AutoProcessor, GenerationConfig
    from nemotron_parse.inference import DocumentParser, GenerationError, GenerationSettings, TransformersBackend

    cap = torch.cuda.get_device_capability()[0]
    dtype = torch.bfloat16 if cap >= 8 else torch.float32   # T4 (7.5) ไม่มี bf16 จริง → fp32 (2.5 GB พอดีใน 15 GB; ช้ากว่า) · fp16 ไม่ได้ทดสอบกับโมเดลนี้ จึงไม่ใช้
    print(f"GPU {torch.cuda.get_device_name(0)} · dtype {dtype}")
    model = AutoModel.from_pretrained(mdir, trust_remote_code=True, dtype=dtype).to("cuda").eval()
    processor = AutoProcessor.from_pretrained(mdir, trust_remote_code=True)
    gen = GenerationConfig.from_pretrained(mdir, trust_remote_code=True)
    parser = DocumentParser(backend=TransformersBackend(model, processor, gen),
                            fullpage=GenerationSettings(temperature=0.0, repetition_penalty=REP_PENALTY, max_tokens=MAX_NEW_TOKENS))

    def page_to_md(img):   # → (markdown, วินาที) · ถูกตัดที่เพดานโทเคน = GenerationError (ตามที่ model card บอก)
        t = time.time()
        doc = parser.parse(img, mode="single")
        return doc["markdown"], time.time() - t

    def load_pages(path):   # ไฟล์ → [PIL RGB…]
        if path.suffix.lower() == ".pdf":
            import pypdfium2 as pdfium
            pdf = pdfium.PdfDocument(str(path))
            n = len(pdf)
            if n > MAX_PDF_PAGES: raise RuntimeError(f"PDF {n} หน้า เกิน MAX_PDF_PAGES={MAX_PDF_PAGES}")
            return [pdf[i].render(scale=PDF_SCALE).to_pil().convert("RGB") for i in range(n)]
        return [ImageOps.exif_transpose(Image.open(path)).convert("RGB")]   # หมุนตาม EXIF เหมือนเว็บ

    def convert(path, out_dir, stem):
        """ไฟล์เดียว → .md (+ .xlsx) · คืน dict สรุป"""
        info = {"name": path.name, "pages": 0, "tables": 0, "sec": 0.0, "err": None, "md": ""}
        try:
            pages = load_pages(path); info["pages"] = len(pages)
            mds, by_page = [], []
            for i, im in enumerate(pages, 1):
                try: md, sec = page_to_md(im)
                except GenerationError as e:
                    md, sec = f"<!-- หน้า {i}: ถูกตัดที่เพดานโทเคน ({e.stage}) — ผลอาจไม่ครบ -->\n" + (e.response.get("raw_out") or ""), 0.0
                    info["err"] = (info["err"] or "") + f"หน้า {i} ถูกตัดที่เพดานโทเคน; "
                mds.append(md); info["sec"] += sec
                by_page.append((i, html_tables(md)))
            info["md"] = join_pages(mds)
            (out_dir / f"{stem}.md").write_text(info["md"], encoding="utf-8")
            info["tables"] = write_xlsx(out_dir / f"{stem}.xlsx", by_page)
        except Exception as e:
            info["err"] = f"{type(e).__name__}: {e}"
        print(f"  {path.name:<28} หน้า {info['pages']} ตาราง {info['tables']} {info['sec']:5.0f} วิ  " + (f"⚠️ {info['err'][:100]}" if info["err"] else "✓"), flush=True)
        return info

    EXT = re.compile(r"\.(jpe?g|png|heic|heif|webp|bmp|tiff?|gif|pdf)$", re.I)
    lines = [f"OpenThai2.0-OCR-Markdown @ {REVISION[:7]} · {torch.cuda.get_device_name(0)} · dtype {dtype}"]

    # A) แปลงโฟลเดอร์
    if DO_CONVERT:
        din = pathlib.Path(DRIVE_DIR) / "_OCR-iApp" / "เข้า"; dout = pathlib.Path(DRIVE_DIR) / "_OCR-iApp" / "ออก"
        din.mkdir(parents=True, exist_ok=True); dout.mkdir(parents=True, exist_ok=True)
        files = [p for p in sorted(din.iterdir()) if p.is_file() and EXT.search(p.name)]
        print(f"\nA) แปลง {len(files)} ไฟล์จาก {din}")
        if not files: print(f"   (ไม่มีไฟล์ — วางรูป/PDF ใน {din} แล้วรันใหม่)")
        res = [convert(p, dout, EXT.sub("", p.name)) for p in files]
        lines += ["", f"A) แปลงไฟล์: {len(res)} ไฟล์ → {dout}"]
        lines += [f"  {r['name']}: หน้า {r['pages']} · ตาราง {r['tables']} · {r['sec']:.0f} วิ" + (f" · ⚠️ {r['err']}" if r["err"] else "") for r in res]
        if res and not any(r["tables"] for r in res): lines.append("  ⚠️ ไม่เจอ <table> ในผลเลย — ถ้ามีตารางในภาพ ให้ดูไฟล์ .md ว่าตารางออกมาเป็นรูปแบบไหน (สคริปต์อ่านเฉพาะ <table>)")

    # B) วัด CER กับ 20 ภาพเดิม
    if DO_MEASURE:
        EV = pathlib.Path(DRIVE_DIR) / "_ผลวัด-OCR"; IMG = EV / "ภาพ"; OUT = EV / "ผล" / "openthai-md"; OUT.mkdir(parents=True, exist_ok=True)
        items = []   # (ชื่อ, ประเภท = คำแรกของชื่อ, เฉลย, path)
        for p in sorted(IMG.iterdir()) if IMG.exists() else []:
            if p.is_dir() or not EXT.search(p.name) or p.suffix.lower() == ".pdf": continue
            key = EXT.sub("", p.name).strip(); ref = IMG / (key + ".txt")
            if not ref.exists(): print(f"ข้าม {p.name} — ไม่มีเฉลย"); continue
            refs = re.sub(r"^\[\[หน้า \d+\]\]\s*$", "", ref.read_text(encoding="utf-8-sig"), flags=re.M)
            items.append((key, re.split(r"[\s\-_]+", key)[0], refs, p))
        print(f"\nB) วัด CER {len(items)} ภาพ")
        cache_p = EV / "ผล-openthai.json"
        cache = json.loads(cache_p.read_text()) if cache_p.exists() else {}
        for key, cat, ref, p in items:
            if key in cache and not cache[key].get("err"): continue
            r = convert(p, OUT, key)
            cache[key] = {"text": to_plain(r["md"]), "sec": round(r["sec"], 1), "tables": r["tables"], "err": r["err"]}
            cache_p.write_text(json.dumps(cache, ensure_ascii=False))
        def agg(get):   # get(key) → ข้อความหรือ None · CER รวม = ผลรวมการแก้ ÷ ผลรวมความยาวเฉลย (ไม่เฉลี่ยรายภาพ)
            tot = {"all": [0, 0]}; per = {}
            for key, cat, ref, _ in items:
                h = get(key)
                if h is None: continue
                e, n = cer_parts(ref, h)
                for k in ("all", cat): tot.setdefault(k, [0, 0]); tot[k][0] += e; tot[k][1] += n
                per[key] = (cat, e / n)
            return tot, per
        mine, per = agg(lambda k: cache.get(k, {}).get("text") if not cache.get(k, {}).get("err") else None)
        lines += ["", f"B) CER กับเฉลยที่แก้แล้ว ({len(per)}/{len(items)} ภาพอ่านได้)"]
        if mine["all"][1]:
            lines.append(f"  OpenThai2.0-OCR-Markdown  CER รวม {100 * mine['all'][0] / mine['all'][1]:.1f}%")
        loops = [k for k, *_ in items if looped(cache.get(k, {}).get("text"))]
        fails = [k for k, *_ in items if cache.get(k, {}).get("err")]
        if loops: lines.append(f"  วนซ้ำ: {', '.join(loops)}")
        if fails: lines.append(f"  ล้ม/ถูกตัด: {', '.join(fails)}")
        # เทียบกับตัวที่วัดไว้ในผล-ทั้งหมด.json ของสคริปต์ 11 (ชุดภาพเดียวกัน) — ถ้ามี
        allp = EV / "ผล-ทั้งหมด.json"
        others = json.loads(allp.read_text()) if allp.exists() else {}
        cmp = []
        for eng in ("paddle-unwarp", "paddle", "tesseract"):
            if eng in others:
                t, _ = agg(lambda k: (others[eng].get(k) or {}).get("text") if not (others[eng].get(k) or {}).get("err") else None)
                if t["all"][1]: cmp.append((eng, f"{100 * t['all'][0] / t['all'][1]:.1f}%"))
        lines += ["", "  เทียบ (ชุดภาพเดียวกัน จาก ผล-ทั้งหมด.json):"] + (["  " + report_table(cmp)] if cmp else ["    (ไม่มีผลเก่า — ใช้ตัวเลขใน README ของ tools/ocr-eval:"] + [f"    {a} {b}%" for a, b in KNOWN_CER.items()] + ["    )"])
        cats = sorted({c for _, c, *_ in items})
        if cats:
            lines += ["", "  ตามประเภท (OpenThai)"] + [f"    {c:<10} {100 * mine[c][0] / mine[c][1]:5.1f}%  ({sum(1 for k, v in per.items() if v[0] == c)} ภาพ)" for c in cats if c in mine]
        lines += ["", "  รายภาพ"] + [f"    {k:<14} {c:<8} {100 * v:5.1f}%  {cache[k].get('sec', 0):.0f} วิ" + (f"  ตาราง {cache[k].get('tables', 0)}" if cache[k].get("tables") else "") for k, (c, v) in per.items()]

    lines += ["", f"VRAM สูงสุด {torch.cuda.max_memory_allocated() / 2**30:.1f} GiB (จองจริง {torch.cuda.max_memory_reserved() / 2**30:.1f} GiB)"]
    rep = "\n".join(lines)
    rp = pathlib.Path(DRIVE_DIR) / "_ผลวัด-OCR" / "report-OpenThai.txt"; rp.parent.mkdir(parents=True, exist_ok=True); rp.write_text(rep, encoding="utf-8")
    print("\n" + rep + f"\n\n✅ เสร็จ — ส่ง {rp} กลับมา (ผลที่ได้แล้วเก็บใน Drive ไม่ทำซ้ำ · อยากวัดใหม่ให้ลบ ผล-openthai.json)")


if __name__ == "__main__":
    main()
