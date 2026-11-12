# Tanot — ตัวรัน iapp/OpenThai2.0-OCR-Markdown บน Colab (โมดูลกลาง: ใช้ร่วมโดย tanot_ocr_iapp.py และ tanot_ocr_eval.py)
#
# ⚠️ ยังไม่ได้ยืนยันกับ model card จริง (sandbox ที่เขียนไฟล์นี้เข้า huggingface.co ไม่ได้) — ห้ามเชื่อชื่อ class/prompt ในไฟล์นี้จนกว่ารอบแรกใน Colab จะผ่าน
# วิธีที่ไฟล์นี้ไม่เดา: probe() ดึง README.md + config.json จาก repo แล้วพิมพ์ให้เห็น + หา prompt จาก README เอง
# แล้วลองโหลดตามลำดับ (ดู load()) พิมพ์ว่าสำเร็จด้วยวิธีไหน · ล้มทุกวิธี = พิมพ์ README + config ให้เจ้าของส่งกลับ แล้วแก้ที่นี่ที่เดียว
import os, re, time, pathlib

MODEL = "iapp/OpenThai2.0-OCR-Markdown"
MAX_NEW_TOKENS = 4096          # หน้าเดียวที่มีตารางยาวอาจเกิน → ดู `truncated` ในผล

def _pip(*pk):
    import subprocess
    subprocess.run("pip -q install " + " ".join(pk), shell=True, check=False)

def probe(local_dir="/content/iapp_model_card"):
    """ดึงไฟล์เล็กๆ ของ repo (README, config, processor/generation config) แล้วพิมพ์ — ไม่โหลดน้ำหนักโมเดล"""
    from huggingface_hub import snapshot_download
    d = snapshot_download(MODEL, local_dir=local_dir, allow_patterns=["*.md", "*.json", "*.txt", "*.py", "*.jinja", "LICENSE*"])
    p = pathlib.Path(d)
    print("ไฟล์ใน repo (ที่ดึงมา):", sorted(x.name for x in p.iterdir()))
    cfg = p / "config.json"
    if cfg.exists():
        import json
        c = json.loads(cfg.read_text())
        print("architectures:", c.get("architectures"), "· model_type:", c.get("model_type"), "· auto_map:", c.get("auto_map"), "· dtype:", c.get("torch_dtype") or c.get("dtype"))
    rd = p / "README.md"
    txt = rd.read_text(encoding="utf-8") if rd.exists() else ""
    print("\n===== README.md (ส่วนต้น 6,000 ตัวอักษร) =====\n" + txt[:6000] + "\n===== จบ =====")
    return p, txt

def find_prompt(readme):
    """หา prompt แบบ Nemotron Parse จาก README (เช่น </s><s><predict_bbox>…<output_markdown>) — ไม่เจอ = None"""
    m = re.search(r"(</s>)?<s>(?:<[a-z_]+>)+", readme or "")
    return m.group(0) if m else None

class Runner:
    def __init__(self, mode, model, proc, torch, prompt):
        self.mode, self.model, self.proc, self.torch, self.prompt = mode, model, proc, torch, prompt

    def ocr(self, img):
        """PIL.Image → ข้อความ Markdown (ตารางเป็น HTML/Markdown ตามที่โมเดลให้มา) · คืน (text, truncated)"""
        torch, t = self.torch, self.proc
        if self.mode == "chat":
            conv = [{"role": "user", "content": [{"type": "image", "image": img}, {"type": "text", "text": self.prompt}]}]
            inp = t.apply_chat_template(conv, tokenize=True, add_generation_prompt=True, return_dict=True, return_tensors="pt")
        else:
            inp = t(images=img, text=self.prompt, return_tensors="pt")
        inp = {k: (v.to(self.model.device) if hasattr(v, "to") else v) for k, v in inp.items()}
        if "pixel_values" in inp and inp["pixel_values"].is_floating_point():
            inp["pixel_values"] = inp["pixel_values"].to(self.model.dtype)
        with torch.no_grad():
            out = self.model.generate(**inp, max_new_tokens=MAX_NEW_TOKENS, do_sample=False)
        n_in = inp["input_ids"].shape[1] if "input_ids" in inp else 0
        gen = out[:, n_in:] if out.shape[1] > n_in else out
        text = (t.batch_decode(gen, skip_special_tokens=False) if self.mode == "raw" else t.batch_decode(gen, skip_special_tokens=True))[0]
        return text, gen.shape[1] >= MAX_NEW_TOKENS

def load():
    """ลองตามลำดับ: (1) ImageTextToText + chat template (2) AutoModel trust_remote_code + processor(images, text=prompt จาก README)
    พิมพ์ VRAM ที่ใช้จริงหลังโหลด · ล้มทุกวิธี = raise พร้อมรายการข้อผิดพลาดของแต่ละวิธี"""
    _pip("-U", "transformers", "accelerate", "huggingface_hub", "einops", "timm")
    import torch
    from transformers import AutoProcessor
    card, readme = probe()
    prompt = find_prompt(readme)
    print(f"\nprompt จาก README: {prompt!r}" if prompt else "\n⚠️ ไม่พบ prompt แบบ <predict_…> ใน README — ใช้ chat template + คำสั่งทั่วไป (ถ้าผลว่าง/มั่ว ให้ดู README ข้างบนแล้วแก้ PROMPT_OVERRIDE)")
    prompt_chat = os.environ.get("PROMPT_OVERRIDE") or "Convert this document image to markdown. Use HTML tables."
    errs = []
    for mode in ("chat", "raw"):
        try:
            torch.cuda.reset_peak_memory_stats()
            proc = AutoProcessor.from_pretrained(MODEL, trust_remote_code=True)
            if mode == "chat":
                from transformers import AutoModelForImageTextToText
                model = AutoModelForImageTextToText.from_pretrained(MODEL, dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16, device_map="cuda", trust_remote_code=True).eval()
                pr = os.environ.get("PROMPT_OVERRIDE") or prompt_chat
            else:
                from transformers import AutoModel
                model = AutoModel.from_pretrained(MODEL, dtype=torch.float16, device_map="cuda", trust_remote_code=True).eval()
                pr = os.environ.get("PROMPT_OVERRIDE") or prompt or prompt_chat
            r = Runner(mode, model, proc, torch, pr)
            print(f"✅ โหลดสำเร็จด้วยวิธี '{mode}' · VRAM ที่จอง {torch.cuda.memory_allocated() / 2**30:.1f} GiB (ยอดสูงสุดจะพิมพ์ตอนจบ)")
            return r
        except Exception as e:
            errs.append(f"{mode}: {type(e).__name__}: {str(e)[:300]}")
            print(f"⚠️ วิธี '{mode}' ล้ม — {errs[-1]}")
            import gc; gc.collect(); torch.cuda.empty_cache()
    raise RuntimeError("โหลดโมเดลไม่ได้ทุกวิธี — ส่งข้อความด้านบน (README/config/ข้อผิดพลาด) กลับมาให้แก้ตัวรัน\n" + "\n".join(errs))

def peak_vram():
    import torch
    return torch.cuda.max_memory_allocated() / 2**30

# ── Markdown/HTML → ตาราง (ใช้กับ xlsx) ──
def tables_from_md(md):
    """คืน list ของ DataFrame: ตาราง HTML (<table>) และตาราง Markdown แบบ | a | b | ในข้อความ"""
    import io, pandas as pd
    out = []
    for m in re.finditer(r"<table.*?</table>", md or "", flags=re.S | re.I):
        try: out += pd.read_html(io.StringIO(m.group(0)), header=None)
        except Exception: pass
    md2 = re.sub(r"<table.*?</table>", "", md or "", flags=re.S | re.I)
    block = []
    for line in md2.splitlines() + [""]:
        if line.strip().startswith("|"): block.append(line.strip())
        elif block:
            rows = [[c.strip() for c in l.strip("|").split("|")] for l in block if not re.fullmatch(r"\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?", l)]
            if rows: out.append(pd.DataFrame(rows))
            block = []
    return out
