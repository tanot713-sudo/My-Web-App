# Tanot — ตัวรัน iapp/OpenThai2.0-OCR-Markdown บน Colab (โมดูลกลาง: ใช้ร่วมโดย tanot_ocr_iapp.py และ tanot_ocr_eval.py)
#
# สถานะ: รันจริงบน Colab T4 แล้วหลายรอบ (2026-11-13) · วิธีเรียกโมเดลมาจากโค้ดใน repo โมเดลที่ REVISION ด้านล่าง
#   (config.json auto_map มีแค่ AutoModel/AutoProcessor, model_type nemotron_parse · ตัวช่วย nemotron_parse/inference.py:
#    DocumentParser + TransformersBackend ใส่ prompt "</s><s><predict_bbox><predict_classes><output_markdown><predict_text_in_pic>",
#    add_special_tokens=False ให้เอง · ค่า generate = GenerationSettings เริ่มต้นใน nemotron_parse/inference.py: temperature 0.2 (สุ่ม seed 0), repetition_penalty 1.05, max_tokens 8744 — คงค่านี้ไว้ (ทางที่ model card ทดสอบแล้ว) · postprocessing.py แปลง LaTeX ของตารางเป็น HTML/CSV)
# trust_remote_code รันโค้ดจาก repo โมเดลในเครื่องที่ mount Drive → ล็อก commit ด้วย REVISION (เปลี่ยนเลข = ตรวจโค้ดใหม่ก่อน)
import csv, io, re, subprocess, sys

MODEL = "iapp/OpenThai2.0-OCR-Markdown"
REVISION = "7a153712e5b50fac7e4a9d42ccf9ec41fb4202f0"
PINS = ['transformers>=5.14.1,<5.20', "timm==1.0.22", "einops==0.8.1", "beautifulsoup4==4.13.3", "accelerate"]   # ตาม pyproject.toml ของโมเดล
TF_RANGE = ((5, 14, 1), (5, 20, 0))

def _vt(v):
    return tuple(int("".join(c for c in x if c.isdigit()) or 0) for x in v.split(".")[:3])

def install():
    """ติดตั้งไลบรารีตามที่โมเดลกำหนด (ไม่ใช้ -U) — ต้องเรียกก่อน import transformers ครั้งแรกใน kernel
    transformers ถูก import ไปแล้วและรุ่นไม่อยู่ในช่วง = หยุดพร้อมข้อความให้ restart runtime"""
    if "transformers" in sys.modules:
        import transformers
        if not TF_RANGE[0] <= _vt(transformers.__version__) < TF_RANGE[1]:
            raise RuntimeError(f"transformers {transformers.__version__} ถูกโหลดใน kernel แล้วและอยู่นอกช่วง {PINS[0]} — Runtime → Restart session แล้วรันใหม่ (สคริปต์นี้ต้องติดตั้งก่อน import transformers)")
        return
    subprocess.run([sys.executable, "-m", "pip", "-q", "install", *PINS], check=True)

def _fake_nbits(w, block=32, sym=False, bits=4):
    """quantize→dequantize น้ำหนัก Linear [out, in] แบบบล็อกตามแกน in (แกน K ของ MatMul) — จำลอง MatMulNBits ของ onnxruntime
    asym (ค่าเริ่มต้นของ matmul_nbits_quantizer: is_symmetric=False, ตรวจจากไฟล์ใน onnxruntime 1.31.1): scale=(max-min)/(2^b-1), zero-point ปัดเป็นจำนวนเต็ม
    sym: scale=absmax/(2^(b-1)) zero-point = 2^(b-1) · ค่าเริ่มต้นของ ORT คือบล็อก 128 — ที่นี่ใช้ 32 ตามแผน 3d (ปรับ block= ได้)
    shortcut: เป็นการจำลองด้วยการปัดค่า ไม่ใช่ตัวเข้ารหัสจริง ผลอาจต่างจาก ONNX 4-bit จริงเล็กน้อย (ลำดับปัดค่า/ขอบบล็อก) · ด่าน 2 ต้องวัดซ้ำกับ ONNX จริง"""
    import torch
    out_f, in_f = w.shape
    pad = (-in_f) % block
    x = w.float()
    if pad: x = torch.nn.functional.pad(x, (0, pad))
    x = x.reshape(out_f, -1, block)
    qmax = 2 ** bits - 1
    if sym:
        scale = (x.abs().amax(-1, keepdim=True) / (2 ** (bits - 1))).clamp_min(1e-8)
        zp = float(2 ** (bits - 1))
    else:
        mn, mx = x.amin(-1, keepdim=True), x.amax(-1, keepdim=True)
        scale = ((mx - mn) / qmax).clamp_min(1e-8)
        zp = torch.round(-mn / scale).clamp(0, qmax)
    q = torch.clamp(torch.round(x / scale) + zp, 0, qmax)
    deq = ((q - zp) * scale).reshape(out_f, -1)[:, :in_f]
    return deq.to(w.dtype)

class Runner:
    def __init__(self, parser, torch, GenerationError, model=None):
        self.parser, self.torch, self.GenerationError, self.model = parser, torch, GenerationError, model
        self._orig = None   # {ชื่อโมดูล: น้ำหนักเดิมบน CPU} เก็บครั้งแรกที่เรียก set_quant

    def _linears(self, part):
        """Linear ที่ ONNX จะกลายเป็น MatMul (MatMulNBits รับเฉพาะ MatMul/Gemm — Conv ของ neck ไม่ถูกบีบ ตารางคำ Gather ไม่ถูกบีบ)
        part: 'vit' = encoder ทั้งหมด · 'dec' = ชั้น decoder + extra heads · 'lm' = lm_head (แยกเพราะผูกน้ำหนักกับตารางคำ และอาจไวต่อการบีบกว่า)"""
        import torch.nn as nn
        m = self.model
        roots = {"vit": [("encoder", m.encoder)], "dec": [("decoder", m.decoder)], "lm": [("lm_head", m.lm_head)]}[part]
        out = []
        for pre, root in roots:
            for name, mod in root.named_modules():
                if isinstance(mod, nn.Linear): out.append((pre + ("." + name if name else ""), mod))
        return out

    def set_quant(self, spec, block=32, sym=False):
        """spec: None (bf16 เดิม) หรือสตริงโทเค็นต่อด้วย + เช่น "vit4+dec8+lm4" (vit/dec/lm × 2–8 บิต — ช่วง 2–3 ไว้หาขีดจำกัดเท่านั้น ยังไม่ได้ตรวจว่า onnxruntime-web WebGPU รองรับกี่บิต; ส่วนที่ไม่ใส่ = ไม่บีบ)
        เรียกซ้ำได้ — คืนน้ำหนักเดิมก่อนบีบใหม่ทุกครั้ง · lm_head ผูกน้ำหนักกับ embed_tokens: ถ้าบีบตรงๆ จะบีบตารางคำไปด้วย
        (ซึ่งใน ONNX ไม่ถูกบีบ) → แยกสำเนาให้ lm_head ก่อน · คืน {ส่วน: (บิต, จำนวน Linear)} ไว้พิมพ์ตรวจ"""
        import re, torch.nn as nn
        plan = {}
        for tok in (spec.split("+") if spec else []):
            mt = re.fullmatch(r"(vit|dec|lm)([2-8])", tok)
            if not mt: raise ValueError(f"โทเค็นบีบไม่ถูกต้อง: {tok!r} (ใช้ vit|dec|lm ตามด้วย 2–8)")
            plan[mt.group(1)] = int(mt.group(2))
        m = self.model
        if self._orig is None:   # เก็บของเดิมครั้งเดียว (bf16 ~1.3 GB บน CPU)
            self._orig = {n: mod.weight.detach().cpu().clone() for part in ("vit", "dec", "lm") for n, mod in self._linears(part)}
        embed = m.decoder.embed_tokens.weight
        if m.lm_head.weight is embed: m.lm_head.weight = nn.Parameter(embed.detach().clone(), requires_grad=False)
        for part in ("vit", "dec", "lm"):
            for n, mod in self._linears(part):
                mod.weight.data.copy_(self._orig[n].to(mod.weight.device))
        for part, bits in plan.items():
            for n, mod in self._linears(part):
                mod.weight.data.copy_(_fake_nbits(mod.weight.data, block, sym, bits))
        self.torch.cuda.empty_cache()
        return {part: (bits, len(self._linears(part))) for part, bits in plan.items()}

    def ocr(self, img, tables=True):
        """PIL.Image → (markdown, tables, warnings) · tables = list ของตาราง (list ของแถว = list ของข้อความ ขยายช่องที่ merge แล้ว)
        tables=False = ข้ามการแปลงตาราง (ใช้ตอนวัด CER) · ตารางที่แปลงไม่ได้ (span ผิด / ตัวช่วยคืน LaTeX เดิม) = ข้าม + เพิ่มคำเตือน ไม่ทำให้ทั้งหน้าล้ม
        หน้าถูกตัด/สร้างไม่ได้ = raise GenerationError (ผู้เรียกต้องนับว่าล้ม ห้ามเขียนผลครึ่งๆ)"""
        doc = None
        for attempt in range(4):   # GPU เต็ม (T4 15 GiB กับภาพความละเอียดสูง) = ย่อภาพ 30% แล้วลองใหม่ สูงสุด 3 ครั้ง
            try:
                doc = self.parser.parse(img, mode="single"); break
            except self.torch.cuda.OutOfMemoryError:
                if attempt == 3: raise
                print(f"  ⚠️ GPU เต็มที่ภาพ {img.width}×{img.height} — ย่อแล้วลองใหม่")
            import gc; gc.collect(); self.torch.cuda.empty_cache()   # ปล่อยหลังออกจาก except (traceback ยังถือหน่วยความจำอยู่ข้างใน)
            img = img.resize((int(img.width * 0.7), int(img.height * 0.7)))
        out, warns = [], []
        self.last_size = (img.width, img.height)   # ขนาดภาพที่ใช้จริง (อาจถูกย่อ 30% ต่อรอบเมื่อ GPU เต็ม)
        if tables:
            from postprocessing import postprocess_text
            for i, b in enumerate(x for x in doc.get("blocks", []) if x.get("class") == "Table"):
                try:
                    csv_text = postprocess_text(b["text"], cls="Table", table_format="csv")
                    if "\\begin{tabular}" in csv_text or "\\begin{tabular}" in (b.get("content") or ""):
                        raise ValueError("ตัวช่วยคืน LaTeX เดิม (แปลงตารางไม่ได้)")
                    rows = [row for row in csv.reader(io.StringIO(csv_text))]
                    if rows and all(re.fullmatch(r"column_\d+", c) for c in rows[0]): rows = rows[1:]   # แถวหัวปลอมที่ตัวช่วยเติมเมื่อตารางไม่มีหัว
                    out.append(rows)
                except Exception as e: warns.append(f"ตาราง {i + 1}: {type(e).__name__}: {str(e)[:120]}")
        return fix_sara_am(doc["markdown"]), [[[fix_sara_am(c) for c in row] for row in t] for t in out], warns

def fix_sara_am(t):
    """โมเดลให้ "ํา" (นิคหิต U+0E4D + สระอา) แทน "ำ" (U+0E33) — แก้กลับ ให้ค้น/เทียบข้อความได้ (วรรณยุกต์ที่คั่นย้ายไปอยู่หน้า ำ แบบ file-reader.js fixThaiOcr)"""
    return re.sub("\u0E4D([\u0E48-\u0E4B]?)\u0E32", lambda m: m.group(1) + "\u0E33", t)

def peak_vram():
    import torch
    return torch.cuda.max_memory_allocated() / 2**30

def load(selftest=True, greedy=False):
    """โหลดตามตัวช่วยของ repo โมเดล แล้ว "อ่านภาพทดสอบ 1 ภาพจริง" ก่อนบอกว่าสำเร็จ (ไม่ใช่แค่โหลดน้ำหนักได้)"""
    install()
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError("ไม่พบ GPU — Runtime → Change runtime type → T4 GPU → Save แล้วรันใหม่ (รันไทม์ปัจจุบันเป็น CPU)")
    from huggingface_hub import snapshot_download
    d = snapshot_download(MODEL, revision=REVISION)   # มี postprocessing.py, latex2html.py, nemotron_parse/**
    if d not in sys.path: sys.path.insert(0, d)
    from transformers import AutoModel, AutoProcessor, GenerationConfig
    from nemotron_parse.inference import DocumentParser, TransformersBackend, GenerationError, GenerationSettings
    torch.cuda.reset_peak_memory_stats()
    model = AutoModel.from_pretrained(d, trust_remote_code=True, dtype=torch.bfloat16).to("cuda").eval()
    proc = AutoProcessor.from_pretrained(d, trust_remote_code=True)
    fullpage = GenerationSettings(temperature=0.0) if greedy else None   # greedy = ตัดความสุ่ม (ด่าน 0 ของแถว 3d)
    r = Runner(DocumentParser(backend=TransformersBackend(model, proc, GenerationConfig.from_pretrained(d)), fullpage=fullpage), torch, GenerationError, model)
    print(f"โหลดน้ำหนักแล้ว (commit {REVISION[:7]}) · VRAM จอง {torch.cuda.memory_allocated() / 2**30:.1f} GiB")
    if selftest:
        from PIL import Image, ImageDraw, ImageFont
        import glob
        fonts = glob.glob("/usr/share/fonts/**/*Thai*.ttf", recursive=True) + glob.glob("/usr/share/fonts/**/Loma*.ttf", recursive=True)
        im = Image.new("RGB", (900, 260), "white"); dr = ImageDraw.Draw(im)
        f = ImageFont.truetype(fonts[0], 44) if fonts else ImageFont.load_default(size=44)
        dr.text((40, 40), "Tanot OCR test 12345" + ("  ทดสอบการอ่านภาษาไทย" if fonts else ""), fill="black", font=f)
        md = r.ocr(im, tables=False)[0]
        print(f"ภาพทดสอบ → {md.strip()[:200]!r}")
        if "12345" not in md: raise RuntimeError("อ่านภาพทดสอบไม่ได้ (ไม่พบ '12345' ในผล) — โหลดผ่านแต่ผลใช้ไม่ได้ ส่งข้อความด้านบนกลับมาให้แก้")
        print("✅ โมเดลอ่านภาพทดสอบได้")
    return r
