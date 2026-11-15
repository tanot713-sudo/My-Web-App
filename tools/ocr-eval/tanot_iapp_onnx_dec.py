# Tanot — สคริปต์ 14: export decoder ของ iApp OCR เป็น ONNX fp16 (prefill + decode พร้อม KV cache) แล้วตรวจว่าสร้างโทเค็นตรงกับโมเดลเดิม (แถว 3d ด่าน 2)
#
# สถานะ: เขียนและทดสอบโครงกราฟ/ความเท่ากับโค้ดต้นฉบับด้วยน้ำหนักสุ่มในเครื่องที่ไม่มี GPU แล้ว (torch และ ORT CPU fp32 ต่างจากโค้ดโมเดลเดิม ~4e-6, argmax ตรงทุกก้าว) ·
#   **ยังไม่เคยรันกับน้ำหนักจริงบน Colab** — ถ้าล้ม ส่งข้อความ error ทั้งก้อนกลับมา
# ใช้บน Colab T4 (High-RAM ช่วยได้ ไม่บังคับ) · วางทั้งไฟล์ → Run · ผล: Drive "Tanot หนังสือเสียง/_OCR-iApp/onnx-dec/" (prefill-fp16.onnx, decode-fp16.onnx, vision-ref.f32.bin, tokens.json, report.txt)
#
# ทำอะไร (พิมพ์ผลทุกขั้น):
#   1 โหลดโมเดล + ภาพทดสอบ 1 ภาพ (ถ่าย 1, ด้านยาว ≤ CAP) · prompt = PROMPT ของ nemotron_parse (คงที่ → ฝัง embedding ของ prompt ลงกราฟ prefill)
#   2 ค่าอ้างอิง: model.generate greedy (bf16 บน GPU) NTOK โทเค็น + features ของ encoder ตัวจริง (vision-ref.f32.bin — ใช้ทดสอบ decoder แยกจาก ViT 4-bit)
#   3 กราฟของเรา (tanot_iapp_decoder_graph.py) ใน torch fp32 → ต้องได้โทเค็นเดียวกับข้อ 2 (ต่างได้บ้างตอนปลายเพราะ bf16 vs fp32 — พิมพ์ตำแหน่งแรกที่ต่าง)
#   4 export ONNX fp32 → ORT CPU greedy → เทียบกับข้อ 3 (ต้องตรงทุกโทเค็น)
#   5 แปลงเป็น fp16 (onnxconverter-common) → ตรวจใน torch half บน GPU (โทเค็นตรงข้อ 3? logits ไม่เป็น NaN/Inf?) → บันทึกลง Drive
#   8 decode ขนาดคงที่ (KV เต็ม LMAX ทุกก้าว, one-hot เขียนตำแหน่งใหม่ + mask) fp16 และ 8-bit+fp16 → static-L<LMAX>/ (หวังแก้การเด้งบน iPhone)
#   7 decode 8-bit (MatMulNBits) + fp16 → โฟลเดอร์ q8/ (ลดน้ำหนักบน GPU จาก 362 เหลือ ~197 MiB)
#   6 decode แบบแบ่ง 3 session (decode-a/-b/head, fp16) + ตารางคำ embed.f16.bin → ตรวจโซ่ใน ORT CPU fp32 ว่าตรงข้อ 3
# ไม่ครอบคลุม: รันบน WebGPU/iPhone (ทำต่อด้วยหน้าทดสอบ), ตัวคำนวณ repetition_penalty/tokenizer ใน JS, canvas คงที่ (N ของภาพทดสอบ = N ที่ export)
CAP = 896
IMAGE = "ถ่าย 1"            # ชื่อไฟล์ใน Drive "_ผลวัด-OCR/ภาพ/" (ไม่ต้องมีนามสกุล) — N ของภาพนี้คือ N ที่ prefill ส่งออก
NTOK = 48                   # จำนวนโทเค็นที่สร้างเทียบ (เร็ว: 48 ก้าว)
LMAX = 1536                 # ความจุ KV ของ decode แบบขนาดคงที่ (ตำแหน่ง prompt+vision 622 + โทเค็นที่สร้าง) — เพิ่มได้ แต่ KV บน GPU = 20 ก้อน × 8×LMAX×64×2 ไบต์ ×2 (เข้า+ออก)
REF = "main"
REPO = "https://github.com/tanot713-sudo/My-Web-App"
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง"

import copy, importlib, json, pathlib, shutil, subprocess, sys, time

W = pathlib.Path("/content/tanot_iapp_dec"); W.mkdir(exist_ok=True)
shutil.rmtree(W / "repo", ignore_errors=True)
subprocess.run(f"git clone -q --depth 1 --branch {REF} {REPO} {W / 'repo'}", shell=True, check=True)
sys.path.insert(0, str(W / "repo" / "tools" / "ocr-eval"))
import tanot_iapp_runner as R
importlib.reload(R)
R.install()
subprocess.run([sys.executable, "-m", "pip", "-q", "install", "onnx", "onnx-ir", "onnxruntime", "onnxconverter-common", "pillow-heif"], check=True)

from google.colab import drive
drive.mount("/content/drive")
OUT = pathlib.Path(DRIVE_DIR) / "_OCR-iApp" / "onnx-dec"; OUT.mkdir(parents=True, exist_ok=True)
LOG = []
def say(*a):
    t = " ".join(str(x) for x in a); print(t, flush=True); LOG.append(t)

import numpy as np, torch, onnx, onnxruntime as ort
from PIL import Image, ImageOps
import pillow_heif; pillow_heif.register_heif_opener()
import tanot_iapp_decoder_graph as G
importlib.reload(G)

# ── 1) โหลด ──
runner = R.load(selftest=False, greedy=True)
model = runner.model
proc = runner.parser.backend.processor
from nemotron_parse.inference import PROMPT
IMGDIR = pathlib.Path(DRIVE_DIR) / "_ผลวัด-OCR" / "ภาพ"
p = next((x for x in sorted(IMGDIR.iterdir()) if x.name.rsplit(".", 1)[0].strip() == IMAGE and not x.name.endswith(".txt")), None)
if not p: raise SystemExit(f"❌ ไม่พบภาพ {IMAGE} ใน {IMGDIR}")
im = ImageOps.exif_transpose(Image.open(p)).convert("RGB"); im.thumbnail((CAP, CAP))
inputs = proc(images=[im], text=PROMPT, return_tensors="pt", add_special_tokens=False).to(model.device)
ids = inputs["input_ids"][0].cpu()
say(f"ภาพ {IMAGE} · prompt {len(ids)} โทเค็น {ids.tolist()}")

# ── 2) ค่าอ้างอิง ──
with torch.no_grad():
    vision, vmask = model.encoder(inputs["pixel_values"], inputs["image_sizes"], inputs["content_sizes"])
    out = model.generate(**inputs, max_new_tokens=NTOK, do_sample=False, num_beams=1, repetition_penalty=1.0)
assert bool(vmask.all()), "vision mask ไม่ใช่ True ทั้งหมด — สมมติฐานของกราฟ (ไม่มี mask) ใช้ไม่ได้"
vision = vision.float().cpu(); NV = vision.shape[1]
seq = out[0].cpu()
assert torch.equal(seq[:len(ids)], ids), "ลำดับที่ได้ไม่ขึ้นต้นด้วย prompt"
ref_tokens = seq[len(ids):].tolist()
say(f"vision {tuple(vision.shape)} · อ้างอิง (HF greedy bf16) {len(ref_tokens)} โทเค็น: {ref_tokens}")
vision.numpy().astype("<f4").tofile(OUT / "vision-ref.f32.bin")

# ── 3) กราฟของเราใน torch fp32 ──
dec = copy.deepcopy(model.decoder).float().cpu().eval()
for q in dec.parameters(): q.requires_grad_(False)
T = len(ids) - 1
with torch.no_grad():
    pe = dec.embed_tokens(ids[:T][None])
pf = G.Prefill(dec, pe, NV).eval(); dc = G.Decode(dec).eval()
EOS = 2

def greedy_torch(prefill, decode, vis, first, n, dtype=torch.float32, dev="cpu"):
    toks, ranges = [], []
    with torch.no_grad():
        kv = prefill(vis.to(dev, dtype))
        t = torch.tensor([first], dtype=torch.long, device=dev)
        for _ in range(n):
            r = decode(t, *kv); logit = r[0].float(); kv = r[1:]
            ranges.append(float(logit.abs().max()))
            nxt = int(logit.argmax()); toks.append(nxt)
            if not np.isfinite(ranges[-1]): break
            if nxt == EOS: break
            t = torch.tensor([nxt], dtype=torch.long, device=dev)
    return toks, ranges

def first_diff(a, b):
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y: return i
    return None if len(a) == len(b) else min(len(a), len(b))

t0 = time.time(); my_tokens, _ = greedy_torch(pf, dc, vision, int(ids[-1]), NTOK)
d = first_diff(ref_tokens, my_tokens)
say(f"\n[3] torch fp32 (กราฟของเรา) vs HF bf16: {'ตรงทุกโทเค็น' if d is None else f'ต่างครั้งแรกที่ตำแหน่ง {d}'} · {len(my_tokens)}/{len(ref_tokens)} โทเค็น · {time.time() - t0:.0f} วิ")
if d is not None: say(f"   HF {ref_tokens[max(0, d - 2):d + 4]} · เรา {my_tokens[max(0, d - 2):d + 4]} (bf16 เทียบ fp32 ต่างได้เมื่อ logits ใกล้กัน — ไม่ใช่บั๊กถ้าต่างปลายๆ)")

# ── 4) ONNX fp32 + ORT CPU ──
say("\n[4] export ONNX fp32")
G.export_prefill(dec, pe, W / "prefill-fp32.onnx", NV)
G.export_decode(dec, W / "decode-fp32.onnx")
for f in ("prefill", "decode"):
    ops, sz = G.op_report(W / f"{f}-fp32.onnx")
    shp = {k: v for k, v in ops.items() if k in ("Shape", "Slice", "Tile", "Range", "Expand", "Where", "Equal", "NonZero", "ConstantOfShape")}
    say(f"  {f}: initializer fp32 {sz / 2**20:.0f} MiB · op {ops} · node ที่เสี่ยงตกไป CPU: {shp or 'ไม่มี'}")
sp = ort.InferenceSession(str(W / "prefill-fp32.onnx"), providers=["CPUExecutionProvider"])
sd = ort.InferenceSession(str(W / "decode-fp32.onnx"), providers=["CPUExecutionProvider"])
names = [i.name for i in sd.get_inputs()]
t0 = time.time(); kv = sp.run(None, {"vision": vision.numpy()}); tp = time.time() - t0
cur, toks = int(ids[-1]), []
t0 = time.time()
for _ in range(NTOK):
    o = sd.run(None, dict(zip(names, [np.array([cur], np.int64)] + kv)))
    kv = o[1:]; cur = int(o[0].argmax()); toks.append(cur)
    if cur == EOS: break
d = first_diff(my_tokens, toks)
say(f"  ORT CPU fp32 vs torch fp32: {'ตรงทุกโทเค็น' if d is None else f'ต่างครั้งแรกที่ตำแหน่ง {d}'} · prefill {tp:.1f} วิ · decode {(time.time() - t0) / max(1, len(toks)):.2f} วิ/โทเค็น (CPU ไม่ใช่ตัวเลขของ iPhone)")

# ── 5) fp16 ──
say("\n[5] แปลง fp16")
from onnxconverter_common import float16
for f in ("prefill", "decode"):
    m16 = float16.convert_float_to_float16(onnx.load(str(W / f"{f}-fp32.onnx")), keep_io_types=False)
    onnx.save(m16, str(W / f"{f}-fp16.onnx"))
    say(f"  {f}-fp16.onnx {(W / f'{f}-fp16.onnx').stat().st_size / 2**20:.0f} MiB")
dev = "cuda"
pfh = G.Prefill(copy.deepcopy(dec), pe, NV).half().to(dev).eval(); dch = G.Decode(copy.deepcopy(dec)).half().to(dev).eval()
h_tokens, ranges = greedy_torch(pfh, dch, vision, int(ids[-1]), NTOK, torch.float16, dev)
d = first_diff(my_tokens, h_tokens)
say(f"  torch half (GPU) vs torch fp32: {'ตรงทุกโทเค็น' if d is None else f'ต่างครั้งแรกที่ตำแหน่ง {d}'} · logits ใหญ่สุด {max(ranges):.1f} · {'มี NaN/Inf!' if not all(np.isfinite(ranges)) else 'ไม่มี NaN/Inf'}")
say("  (ORT WebGPU fp16 ต้องตรวจในหน้าทดสอบต่อ — torch half ไม่ใช่ตัวรันเดียวกัน)")

# ── 6) decode แบบแบ่ง 3 session (a: ชั้น 0–4 · b: ชั้น 5–9 · head) + ตารางคำ — ลดหน่วยความจำช่วงสร้าง session บน iPhone (decode เดี่ยว 362 MiB เด้งตอน create) ──
say("\n[6] decode แบบแบ่ง 3 ก้อน + ตารางคำสำหรับ JS")
parts = G.export_decode_parts(dec, W, split=5)
sess = [ort.InferenceSession(str(f), providers=["CPUExecutionProvider"]) for f in parts]
table = dec.embed_tokens.weight.detach().float().numpy()   # [72512,1024] — JS อ่านแถวจากไฟล์ (embed.f16.bin) ไม่เก็บในกราฟ
kv0 = sp.run(None, {"vision": vision.numpy()}); kva, kvb = kv0[:10], kv0[10:]
cur, toks3 = int(ids[-1]), []
for _ in range(NTOK):
    na = [i.name for i in sess[0].get_inputs()]; nb = [i.name for i in sess[1].get_inputs()]
    oa = sess[0].run(None, dict(zip(na, [table[cur][None, None, :]] + kva))); kva = oa[1:]
    ob = sess[1].run(None, dict(zip(nb, [oa[0]] + kvb))); kvb = ob[1:]
    cur = int(sess[2].run(None, {"x": ob[0]})[0].argmax()); toks3.append(cur)
    if cur == EOS: break
d = first_diff(my_tokens, toks3)
say(f"  แบ่ง 3 ก้อน (ORT CPU fp32) vs torch fp32: {'ตรงทุกโทเค็น' if d is None else f'ต่างครั้งแรกที่ตำแหน่ง {d}'}")
for f in parts:
    m16 = float16.convert_float_to_float16(onnx.load(str(f)), keep_io_types=False)
    out16 = W / f"{f.stem}-fp16.onnx"; onnx.save(m16, str(out16)); shutil.copy(out16, OUT / out16.name)
    say(f"  {out16.name} {out16.stat().st_size / 2**20:.0f} MiB")
table.astype("<f2").tofile(OUT / "embed.f16.bin")
say(f"  embed.f16.bin {(OUT / 'embed.f16.bin').stat().st_size / 2**20:.0f} MiB (แถวละ 2048 ไบต์, fp16, ยังไม่คูณ scale — กราฟ decode-a คูณเอง)")

# ── 7) decode แบบ 8-bit (MatMulNBits 8 บิต บล็อก 32 asymmetric) + แปลง fp16 — น้ำหนักบน GPU ~197 MiB (fp16 ล้วน 362) เพราะ 3 session fp16 ล้วนยังเด้งบน iPhone หลังไม่กี่ก้าว ──
say("\n[7] decode 8-bit + fp16")
(W / "quant8.py").write_text("""import sys
from onnxruntime.quantization.matmul_nbits_quantizer import MatMulNBitsQuantizer
q = MatMulNBitsQuantizer(sys.argv[1], bits=8, block_size=32, is_symmetric=False)
q.process(); q.model.save_model_to_file(sys.argv[2], False)
""")
q8s = []
for f in parts:
    q8 = W / f"{f.stem}-q8.onnx"
    r = subprocess.run([sys.executable, str(W / "quant8.py"), str(f), str(q8)], capture_output=True, text=True)
    if r.returncode != 0 or not q8.exists(): say(f"  ❌ บีบ 8 บิตไม่สำเร็จ {f.stem}: {r.stderr[-400:]}"); q8s = []; break
    m16 = float16.convert_float_to_float16(onnx.load(str(q8)), keep_io_types=False)
    o16 = W / f"{f.stem}-q8-fp16.onnx"; onnx.save(m16, str(o16)); q8s.append(o16)
    say(f"  {o16.name} {o16.stat().st_size / 2**20:.0f} MiB · MatMulNBits {sum(1 for n in m16.graph.node if n.op_type == 'MatMulNBits')} node")
if q8s:
    sq = [ort.InferenceSession(str(f), providers=["CPUExecutionProvider"]) for f in q8s]
    kvq = [k.astype(np.float16) for k in sp.run(None, {"vision": vision.numpy()})]; kqa, kqb = kvq[:10], kvq[10:]
    cur, toks8 = int(ids[-1]), []
    for _ in range(NTOK):
        na = [i.name for i in sq[0].get_inputs()]; nb = [i.name for i in sq[1].get_inputs()]
        oa = sq[0].run(None, dict(zip(na, [table[cur][None, None, :].astype(np.float16)] + kqa))); kqa = oa[1:]
        ob = sq[1].run(None, dict(zip(nb, [oa[0]] + kqb))); kqb = ob[1:]
        cur = int(sq[2].run(None, {"x": ob[0]})[0].argmax()); toks8.append(cur)
        if cur == EOS: break
    d = first_diff(my_tokens, toks8)
    same = sum(1 for x, y in zip(my_tokens, toks8) if x == y)
    say(f"  8-bit+fp16 (ORT CPU) vs torch fp32: ตรงกัน {same}/{min(len(my_tokens), len(toks8))} ตำแหน่ง · {'ตรงทุกโทเค็น' if d is None else f'ต่างครั้งแรกที่ตำแหน่ง {d}'}")
    (OUT / "q8").mkdir(exist_ok=True)
    for f in q8s: shutil.copy(f, OUT / "q8" / f.name.replace("-q8-fp16", "-fp16"))   # ชื่อเดียวกับชุด fp16 (decode-a-fp16.onnx ฯลฯ) ในโฟลเดอร์ q8/ — หน้าทดสอบเลือกได้เหมือนเดิม
    say(f"  บันทึกที่ {OUT / 'q8'} (ใช้ embed.f16.bin / prefill-fp16.onnx ชุดเดิม)")

# ── 8) decode แบบขนาดคงที่ (KV เต็ม LMAX ทุกก้าว) — แก้การเด้งบน iPhone ที่ KV โตทีละก้าว (สมมติฐาน: บัฟเฟอร์ขนาดใหม่สะสม) · head.onnx เดิมใช้ต่อได้ ──
say(f"\n[8] decode ขนาดคงที่ LMAX={LMAX}")
sfiles = G.export_decode_parts_static(dec, W, LMAX, split=5)
ssess = [ort.InferenceSession(str(f), providers=["CPUExecutionProvider"]) for f in sfiles]
M = kv0[0].shape[2]
def padkv(a):
    o = np.zeros((1, 8, LMAX, 64), np.float32); o[:, :, :M] = a; return o
ka, kb = [padkv(x) for x in kv0[:10]], [padkv(x) for x in kv0[10:]]
cur, toks_s = int(ids[-1]), []
for i in range(NTOK):
    pos = M + i
    oh = np.zeros((1, 1, LMAX, 1), np.float32); oh[0, 0, pos, 0] = 1
    mk = np.full((1, 1, 1, LMAX), -1e4, np.float32); mk[..., :pos + 1] = 0
    na = [x.name for x in ssess[0].get_inputs()]; nb = [x.name for x in ssess[1].get_inputs()]
    oa = ssess[0].run(None, dict(zip(na, [table[cur][None, None, :], oh, mk] + ka))); ka = oa[1:]
    ob = ssess[1].run(None, dict(zip(nb, [oa[0], oh, mk] + kb))); kb = ob[1:]
    cur = int(sess[2].run(None, {"x": ob[0]})[0].argmax()); toks_s.append(cur)
    if cur == EOS: break
d = first_diff(my_tokens, toks_s)
say(f"  static fp32 (ORT CPU) vs torch fp32: {'ตรงทุกโทเค็น' if d is None else f'ต่างครั้งแรกที่ตำแหน่ง {d}'}")
(OUT / f"static-L{LMAX}").mkdir(exist_ok=True)
for f in sfiles:
    ops = {n.op_type for n in onnx.load(str(f), load_external_data=False).graph.node}
    say(f"  {f.name}: op ที่เสี่ยง {sorted(ops & {'Shape', 'Slice', 'Tile', 'Range', 'Expand', 'Where', 'ConstantOfShape', 'Concat'}) or 'ไม่มี'}")
    # fp16 ล้วน
    m16 = float16.convert_float_to_float16(onnx.load(str(f)), keep_io_types=False)
    o16 = W / f"{f.stem}-fp16.onnx"; onnx.save(m16, str(o16)); shutil.copy(o16, OUT / f"static-L{LMAX}" / f"{f.stem}-fp16.onnx")
    # 8 บิต + fp16
    q8 = W / f"{f.stem}-q8.onnx"
    r = subprocess.run([sys.executable, str(W / "quant8.py"), str(f), str(q8)], capture_output=True, text=True)
    if r.returncode == 0 and q8.exists():
        mq = float16.convert_float_to_float16(onnx.load(str(q8)), keep_io_types=False)
        oq = W / f"{f.stem}-q8-fp16.onnx"; onnx.save(mq, str(oq)); shutil.copy(oq, OUT / f"static-L{LMAX}" / f"{f.stem}-q8-fp16.onnx")
        say(f"  {f.stem}: fp16 {o16.stat().st_size / 2**20:.0f} MiB · 8-bit+fp16 {oq.stat().st_size / 2**20:.0f} MiB")
    else: say(f"  ❌ บีบ 8 บิตไม่สำเร็จ {f.stem}: {r.stderr[-300:]}")
say(f"  บันทึกที่ {OUT / f'static-L{LMAX}'} (ใช้ head-fp16.onnx / embed.f16.bin / prefill-fp16.onnx ชุดเดิม)")

(OUT / "tokens.json").write_text(json.dumps({"prompt_ids": ids.tolist(), "n_vision": NV, "ref_hf_bf16": ref_tokens, "torch_fp32": my_tokens, "ort_cpu_fp32": toks, "torch_half": h_tokens}), encoding="utf-8")
for f in ("prefill", "decode"): shutil.copy(W / f"{f}-fp16.onnx", OUT / f"{f}-fp16.onnx")
(OUT / "report.txt").write_text("\n".join(LOG), encoding="utf-8")
say(f"\n✅ เสร็จ — ไฟล์อยู่ที่ {OUT} · ส่งข้อความด้านบนทั้งหมดกลับมา")
