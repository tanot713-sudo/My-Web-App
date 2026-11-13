# Tanot — สคริปต์ 13: export ส่วนอ่านภาพของ iApp OCR (ViT + neck) เป็น ONNX 4-bit แล้วตรวจว่าผลตรงกับ torch (แถว 3c ขั้น 1 + 3d ด่าน 1 ขั้นเตรียม)
#
# สถานะ: รันจริงบน Colab T4 แล้วหลายรอบ (2026-11-13) — ขั้น 3–5 ผ่าน · ขั้น 6 เดิมใช้ตัวเทียบข้อความที่ตัดสระ/วรรณยุกต์ไทยทิ้ง (บั๊ก) แก้แล้ว ต้องรันใหม่
#   โค้ดเขียนตามไฟล์ใน repo โมเดลที่ commit 7a15371 · ถ้าล้ม ส่งข้อความ error ทั้งก้อนกลับมา
# ใช้บน Colab T4 **High-RAM** (ตัวบีบใช้ RAM สูงสุดราว 9–13 GB) · วางทั้งไฟล์ → Run · ผล: Drive "Tanot หนังสือเสียง/_OCR-iApp/onnx-vit/" (model-q4.onnx + model-q4-n2464-q512.onnx ไฟล์เดียวไม่แยก .data + report.txt)
#
# ทำอะไร (ทีละขั้น พิมพ์ผลทุกขั้น ล้มขั้นไหนหยุดขั้นนั้น):
#   1 โหลดโมเดล (ตัวรันกลาง) · เตรียมภาพ 4 ภาพจากชุดวัด (ด้านยาว ≤ CAP)
#   2 ห่อส่วนอ่านภาพเป็นกราฟที่ "ไม่มี position embedding ข้างใน": รับ patches [N,768] + pos [1,N,1152] (คำนวณด้วยฟังก์ชันของโมเดลเอง
#     นอกกราฟ — ต่อไปต้องพอร์ตเป็น JS) · conv (1,4) ของ neck เขียนใหม่เป็น matmul ของ 4 token ติดกัน (เท่ากันเมื่อความกว้างกริดหารด้วย 4
#     ซึ่งตัวประมวลผลบังคับอยู่แล้ว: ความกว้างปัดขึ้นเป็นพหุคูณของ 64) → ไม่ต้องใช้ h,w ในกราฟ รองรับภาพหลายขนาด (แกน N เปลี่ยนได้)
#   3 ตรวจ wrapper (fp32, CPU) เทียบ encoder ต้นฉบับ (bf16, GPU): cosine ต่อ token
#   4 export fp32 ONNX · ตรวจ onnxruntime CPU เทียบ wrapper
#   5 บีบ 4 บิต (MatMulNBits บล็อก 32 asymmetric — ตรงกับที่จำลองในด่าน 0) · ตรวจ onnxruntime CPU เทียบ wrapper · นับ op/ขนาดไฟล์
#   6 ครบทาง (ตัววัดตัวเดียวกับ tanot_ocr_eval.py: NFC, ตัดเฉพาะหมวด P/S, ไม่นับช่องว่าง): เอา ONNX 4-bit ไปแทน encoder ในโมเดลจริง แล้วอ่านภาพเดิมด้วย decoder เดิม เทียบข้อความกับ torch bf16 (ต่างกันกี่ %)
#   7 พิมพ์ค่าอ้างอิงของอินพุตสุ่มแบบมี seed (เทียบกับหน้า iapp-vit-test.html: คอม-WASM / คอม-WebGPU / iPhone)
#   8 ตรวจกับ onnxruntime 1.24.3 (รุ่นเดียวกับเว็บ) ในโปรเซสย่อย — รุ่นของตัวบีบ (ฝั่ง Python) ไม่ล็อก จึงต้องตรวจว่ารุ่นเว็บอ่านไฟล์ได้และให้ค่าเท่ากัน
# ไม่ครอบคลุม (ยังไม่ได้ทำ): fp16 + attention แบบรวมสำหรับ WebGPU, รันใน onnxruntime-web, iPhone, decoder
CAP = 896
TEST_IMAGES = ["ถ่าย 1", "ใบเสร็จ 1", "สแกน 1", "ถ่าย 3"]   # ชื่อไฟล์ใน Drive "_ผลวัด-OCR/ภาพ/" (ไม่ต้องมีนามสกุล)
BLOCK = 32
STEP3 = True        # False = ข้ามขั้น [3] — รอบ 2026-11-13 ผ่านแล้ว: wrapper ≡ ต้นฉบับ fp32 (cosine 1.00000, ต่าง 0.0000)
CHUNK_Q = 512       # >0 = ส่งออกอีกไฟล์ที่ attention แบ่ง query ทีละ CHUNK_Q (ขนาด N คงที่ = N ของภาพทดสอบแรก) กัน buffer ของคะแนน attention ใหญ่เกินบน WebGPU/iPhone · 0 = ไม่ทำ
REEXPORT = False    # False = ใช้ไฟล์ fp32 ที่ export ไว้แล้วในรันไทม์นี้ (/content/tanot_iapp_onnx/vit-fp32.onnx) ถ้ามี — รอบ 2026-11-13 export ผ่านและตรงกับ wrapper (ORT cosine 1.000000)
REF = "main"     # branch/tag ของ repo ที่มี tools/ocr-eval/tanot_iapp_runner.py (ก่อน merge ให้ใส่ชื่อ branch)
REPO = "https://github.com/tanot713-sudo/My-Web-App"
DRIVE_DIR = "/content/drive/MyDrive/Tanot หนังสือเสียง"

import copy, importlib, pathlib, shutil, subprocess, sys, time
from collections import Counter

W = pathlib.Path("/content/tanot_iapp_onnx"); W.mkdir(exist_ok=True)
shutil.rmtree(W / "repo", ignore_errors=True)
subprocess.run(f"git clone -q --depth 1 --branch {REF} {REPO} {W / 'repo'}", shell=True, check=True)
sys.path.insert(0, str(W / "repo" / "tools" / "ocr-eval"))
import tanot_iapp_runner as R
importlib.reload(R)
R.install()   # ต้องก่อน import transformers (ถ้าเจอข้อความให้ Restart session ให้ทำตาม)
subprocess.run([sys.executable, "-m", "pip", "-q", "install", "onnx", "onnx-ir", "onnxruntime", "rapidfuzz", "pillow-heif"], check=True)

from google.colab import drive
drive.mount("/content/drive")
OUT = pathlib.Path(DRIVE_DIR) / "_OCR-iApp" / "onnx-vit"; OUT.mkdir(parents=True, exist_ok=True)
LOG = []
def say(*a):
    t = " ".join(str(x) for x in a); print(t, flush=True); LOG.append(t)

import numpy as np, torch, onnx, onnxruntime as ort
from PIL import Image, ImageOps
import pillow_heif; pillow_heif.register_heif_opener()

# ── 1) โหลดโมเดล + ภาพ ──
runner = R.load(selftest=False, greedy=True)
model, dev = runner.model, next(runner.model.parameters()).device
proc = runner.parser.backend.processor
IMGDIR = pathlib.Path(DRIVE_DIR) / "_ผลวัด-OCR" / "ภาพ"
imgs = []
for name in TEST_IMAGES:
    p = next((x for x in sorted(IMGDIR.iterdir()) if x.name.rsplit(".", 1)[0].strip() == name and not x.name.endswith(".txt")), None)
    if not p: say(f"⚠️ ไม่พบภาพ {name} ใน {IMGDIR}"); continue
    im = ImageOps.exif_transpose(Image.open(p)).convert("RGB"); im.thumbnail((CAP, CAP)); imgs.append((name, im))
if not imgs: raise SystemExit("❌ ไม่มีภาพทดสอบ")
say(f"ภาพทดสอบ {[n for n, _ in imgs]} · ด้านยาว ≤ {CAP}")

# ── 2) wrapper ──
from hf_prefix_geometry import _normalized_2d_position_pages
enc32 = copy.deepcopy(model.encoder).float().cpu().eval()
for _p in enc32.parameters(): _p.requires_grad_(False)   # ไม่เก็บกราฟ autograd — รอบแรก export กิน RAM เกิน 12 GB เพราะลืมข้อนี้
radio = enc32.model_encoder.radio_model; vit = radio.model; pg = vit.patch_generator
POS_EMBED = pg.pos_embed.detach().float().clone()   # ตารางตำแหน่ง 128×128 (75 MiB) แยกเก็บ เพื่อปล่อย enc32 ก่อนขั้นบีบ

def positions(h, w, ch, cw, n):   # position embedding ที่โมเดลบวกเข้า patch (คำนวณด้วยฟังก์ชันของโมเดลเอง กับ patch เป็นศูนย์) — ต้องพอร์ตเป็น JS ภายหลัง
    with torch.no_grad():
        return _normalized_2d_position_pages(torch, patches=torch.zeros(1, n, 1152), pos_embed=POS_EMBED, source_rows=128, source_cols=128,
                                             image_sizes=[[h, w]], patch_size=16, content_sizes=[[ch, cw]], content_normalized=True)

class VitOnnx(torch.nn.Module):
    """ViT 27 ชั้น + neck ของ RadioWithNeck แบบไม่มี position embedding และไม่มี h,w (ดูหัวไฟล์)"""
    def __init__(self, enc):
        super().__init__()
        self.enc, self.vit, self.pg, self.radio = enc, enc.model_encoder.radio_model.model, enc.model_encoder.radio_model.model.patch_generator, enc.model_encoder.radio_model
        w2 = enc.conv2.weight.detach()[:, :, 0, :]                      # [out, in, 4]
        self.register_buffer("w2", w2.permute(0, 2, 1).reshape(w2.shape[0], -1).contiguous())   # [out, 4*in] ลำดับ k แล้ว c
    def forward(self, patches, pos):
        e = self.enc
        x = self.pg.embedder(patches).unsqueeze(0) + pos
        hidden = torch.cat((self.pg.cls_token.token.unsqueeze(0), x), dim=1)
        for block in self.vit.blocks: hidden = block(hidden)
        summary = hidden[:, self.radio.summary_idxs].flatten(1)
        f = e.layer_norm1(e.conv1(hidden[:, 10:].transpose(1, 2)).transpose(1, 2))      # [1,N,1024]
        f = e.layer_norm2(f.reshape(1, -1, 4 * f.shape[-1]) @ self.w2.T)                # conv (1,4) stride (1,4) = matmul ของ 4 token ติดกัน
        s = e.layer_norm3(e.sum_proj(summary)).unsqueeze(1)
        return torch.cat((f, s), dim=1)
wrap = VitOnnx(enc32).eval()

def prep(im):
    d = proc.image_processor(im, return_tensors="pt")
    pv, (h, w), (ch, cw) = d["pixel_values"], d["image_sizes"][0].tolist(), d["content_sizes"][0].tolist()
    assert w % 64 == 0 and h % 16 == 0, (h, w)
    return pv, h, w, ch, cw

def cos(a, b):
    a, b = np.asarray(a, np.float32).reshape(-1, a.shape[-1]), np.asarray(b, np.float32).reshape(-1, b.shape[-1])
    c = (a * b).sum(1) / (np.linalg.norm(a, axis=1) * np.linalg.norm(b, axis=1) + 1e-9)
    return float(c.mean()), float(c.min())

ref = {}   # {ชื่อ: (patches, h, w, ch, cw)}
for name, im in imgs: ref[name] = prep(im)
MINE = {}
HOLD = {"wrap": wrap}   # ถือ wrapper ไว้ที่เดียว เพื่อปล่อยทิ้งได้ก่อนขั้นบีบ
def wrapper_out(name):   # ผลของ wrapper fp32 (CPU) เก็บไว้ใช้ซ้ำ
    if name not in MINE:
        pv, h, w, ch, cw = ref[name]
        with torch.no_grad(): MINE[name] = HOLD["wrap"](pv.float(), positions(h, w, ch, cw, pv.shape[0])).numpy()
    return MINE[name]

# ── 3) wrapper vs ต้นฉบับ ──
if STEP3:
    say("\n[3] แยกสาเหตุความต่าง: ต้นฉบับ bf16 (GPU) · ต้นฉบับ fp32 (CPU, โครงสร้างเดิมของโมเดล) · wrapper fp32 (CPU) — cosine ต่อ token เฉลี่ย / ต่ำสุด")
    for name, im in imgs:
        pv, h, w, ch, cw = ref[name]; n = pv.shape[0]
        with torch.no_grad():
            o16 = model.encoder(pv.to(dev), torch.tensor([[h, w]]).to(dev), torch.tensor([[ch, cw]]).to(dev))[0].float().cpu().numpy()
            o32 = enc32(pv.float(), torch.tensor([[h, w]]), torch.tensor([[ch, cw]]))[0].numpy()
        mine = wrapper_out(name)
        say(f"  {name}: patch {n} ({h//16}×{w//16}) → token {mine.shape[1]}")
        say(f"     bf16↔fp32(ต้นฉบับ)   {cos(o16, o32)[0]:.5f} / {cos(o16, o32)[1]:.5f}   ← ความรบกวนของ bf16 เอง")
        say(f"     wrapper↔fp32(ต้นฉบับ) {cos(mine, o32)[0]:.5f} / {cos(mine, o32)[1]:.5f} · max|ต่าง| {np.abs(mine - o32).max():.4f}   ← ต้อง ≈ 1.0000 ถ้า wrapper ถูก")
    del o16, o32

# ── 4) export fp32 ──
say("\n[4] export fp32 ONNX")
fp32 = W / "vit-fp32.onnx"
reused = fp32.exists() and not REEXPORT
if reused:
    say(f"  ใช้ไฟล์เดิม {sum(f.stat().st_size for f in W.glob('vit-fp32*')) / 2**20:.0f} MiB (ตั้ง REEXPORT = True เพื่อ export ใหม่)")
else:
    h0, w0 = 256, 256   # ตัวอย่างสำหรับ trace ขนาดเล็ก (16×16 = 256 patch) กัน RAM เต็ม — แกน N เปลี่ยนได้ ตรวจกับภาพจริงขนาดใหญ่ด้านล่าง
    pv0 = torch.randn(h0 // 16 * (w0 // 16), 768)
    for f in W.glob("vit-fp32*"): f.unlink()
    args = (pv0, positions(h0, w0, h0, w0, pv0.shape[0]))
    kw = dict(input_names=["patches", "pos"], output_names=["features"], dynamic_axes={"patches": {0: "n"}, "pos": {1: "n"}, "features": {1: "m"}}, opset_version=17)
    t0 = time.time()
    with torch.no_grad():
        try: torch.onnx.export(wrap, args, str(fp32), dynamo=False, **kw)
        except Exception as e:
            say(f"  ❌ export ล้ม ({type(e).__name__}: {str(e)[:600]}) — ไม่มีทางสำรอง (ตัว dynamo ไม่รับชื่ออินพุต/แกนเปลี่ยนได้แบบเดียวกัน) ส่ง error ทั้งก้อนกลับมา"); raise SystemExit(1)
    say(f"  export {time.time() - t0:.0f} วิ · ไฟล์ {sum(f.stat().st_size for f in W.glob('vit-fp32*')) / 2**20:.0f} MiB")

def session(path):
    so = ort.SessionOptions(); so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    return ort.InferenceSession(str(path), so, providers=["CPUExecutionProvider"])
def run_ort(sess, name):
    pv, h, w, ch, cw = ref[name]
    return sess.run(None, {"patches": pv.float().numpy(), "pos": positions(h, w, ch, cw, pv.shape[0]).numpy()})[0]
if not reused:   # ตรวจ ORT fp32 เทียบ wrapper เฉพาะภาพแรก (รอบ 2026-11-13 ตรวจครบ 4 ภาพผ่านแล้ว)
    n0 = imgs[0][0]; t0 = time.time(); o = run_ort(session(fp32), n0); m0 = wrapper_out(n0)
    say(f"  {n0}: ORT fp32 เทียบ wrapper cosine {cos(m0, o)[0]:.6f} / {cos(m0, o)[1]:.6f} · max|ต่าง| {np.abs(m0 - o).max():.4f} · {time.time() - t0:.0f} วิ (CPU)")

# ── 4b) attention แบบแบ่ง query (ขนาด N คงที่) ──
CHUNK_FILE = None
if CHUNK_Q:
    import types
    n1 = imgs[0][0]; pvc, hc, wc, chc, cwc = ref[n1]; Nc = pvc.shape[0]
    def _chunked(self, x, *a, **k):
        B, N, C = x.shape; H = self.num_heads
        q, kk, v = self.qkv(x).reshape(B, N, 3, H, C // H).permute(2, 0, 3, 1, 4).unbind(0)
        q, kk = getattr(self, "q_norm", torch.nn.Identity())(q), getattr(self, "k_norm", torch.nn.Identity())(kk)
        sc = (C // H) ** -0.5
        o = torch.cat([((q[:, :, i:i + CHUNK_Q] * sc) @ kk.transpose(-2, -1)).softmax(-1) @ v for i in range(0, N, CHUNK_Q)], 2)
        o = getattr(self, "norm", torch.nn.Identity())(o.transpose(1, 2).reshape(B, N, C))
        return self.proj_drop(self.proj(o))
    say(f"\n[4b] attention แบ่ง query ทีละ {CHUNK_Q} · N คงที่ = {Nc} (ภาพ {n1}) → buffer คะแนนต่อก้อน {16 * CHUNK_Q * Nc * 4 / 2 ** 20:.0f} MiB (fp32) เทียบ {16 * Nc * Nc * 4 / 2 ** 20:.0f} MiB ของแบบเต็ม")
    blocks = HOLD["wrap"].vit.blocks
    for b in blocks: b.attn.forward = types.MethodType(_chunked, b.attn)
    try:
        with torch.no_grad():
            posc = positions(hc, wc, chc, cwc, Nc)
            co = HOLD["wrap"](pvc.float(), posc).numpy()
            say(f"  wrapper แบบแบ่ง เทียบแบบเต็ม cosine {cos(wrapper_out(n1), co)[0]:.6f} / {cos(wrapper_out(n1), co)[1]:.6f}")
            CHUNK_FILE = W / f"vit-fp32-n{Nc}-q{CHUNK_Q}.onnx"
            for f in W.glob("vit-fp32-n*"): f.unlink()
            torch.onnx.export(HOLD["wrap"], (pvc.float(), posc), str(CHUNK_FILE), dynamo=False, input_names=["patches", "pos"], output_names=["features"], opset_version=17)
    except Exception as e:
        say(f"  ❌ export แบบแบ่ง query ล้ม: {type(e).__name__}: {str(e)[:400]}"); CHUNK_FILE = None
    finally:
        for b in blocks: del b.attn.forward

# ── 5) 4 บิต ──
say(f"\n[5] MatMulNBits 4 บิต บล็อก {BLOCK} asymmetric")
for name, _ in imgs: wrapper_out(name)     # เก็บผลอ้างอิงไว้ก่อน แล้วปล่อย encoder fp32 ออกจากหน่วยความจำ (รอบ 2026-11-13 ตัวบีบทำ RAM 12.7 GB เต็ม)
HOLD.clear(); del wrap, enc32, vit, pg, radio
import gc; gc.collect(); torch.cuda.empty_cache()
q4 = W / "model-q4.onnx"
for f in W.glob("model-q4*"): f.unlink()
(W / "quant_q4.py").write_text("""import sys, resource
from onnxruntime.quantization.matmul_nbits_quantizer import MatMulNBitsQuantizer
src, dst, block = sys.argv[1], sys.argv[2], int(sys.argv[3])
q = MatMulNBitsQuantizer(src, bits=4, block_size=block, is_symmetric=False)
q.process(); q.model.save_model_to_file(dst, False)
import onnxruntime
print("ort", onnxruntime.__version__, "peak_rss_mb", int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024))
""")
def quantize(src, dst):
    # แยกเป็นโปรเซสย่อย: ถ้า RAM ไม่พอ โปรเซสย่อยถูกฆ่า แต่สมุดบันทึก (kernel) ไม่ดับ
    t0 = time.time()
    r = subprocess.run([sys.executable, str(W / "quant_q4.py"), str(src), str(dst), str(BLOCK)], capture_output=True, text=True)
    if r.returncode != 0 or not pathlib.Path(dst).exists():
        say(f"  ❌ บีบไม่สำเร็จ (code {r.returncode}) — {r.stderr[-600:] or 'ไม่มีข้อความ (น่าจะถูกฆ่าเพราะ RAM เต็ม: Runtime → Change runtime type → เปิด High-RAM แล้วรันใหม่)'}")
        raise SystemExit(1)
    say(f"  บีบ {pathlib.Path(dst).name} {time.time() - t0:.0f} วิ · ตัวบีบ {r.stdout.strip()[-80:]} MiB (RAM สูงสุดของโปรเซสบีบ)")
quantize(fp32, q4)
ops = Counter(n.op_type for n in onnx.load(str(q4), load_external_data=False).graph.node)
say(f"  ไฟล์ {q4.stat().st_size / 2**20:.0f} MiB · op: {dict(ops.most_common(12))}")
say(f"  MatMulNBits {ops.get('MatMulNBits', 0)} node (คาด ~111 = 27×4 + embedder + conv2-เป็น-matmul + sum_proj) · MatMul/Gemm ที่เหลือ {ops.get('MatMul', 0)}/{ops.get('Gemm', 0)} (รวม attention QKᵀ/AV ซึ่งไม่มีน้ำหนัก)")
s4 = session(q4)
for name, _ in imgs:
    t0 = time.time(); o = run_ort(s4, name); m = wrapper_out(name)
    say(f"  {name}: ORT 4-bit เทียบ wrapper fp32 cosine {cos(m, o)[0]:.4f} / {cos(m, o)[1]:.4f} · {time.time() - t0:.0f} วิ (CPU)")

if CHUNK_FILE:
    qc = W / f"model-q4-n{Nc}-q{CHUNK_Q}.onnx"; quantize(CHUNK_FILE, qc)
    t0 = time.time(); oc = session(qc).run(None, {"patches": pvc.float().numpy(), "pos": positions(hc, wc, chc, cwc, Nc).numpy()})[0]
    ou = run_ort(s4, n1)
    say(f"  {n1}: 4-bit แบบแบ่ง query เทียบ 4-bit แบบเต็ม cosine {cos(ou, oc)[0]:.6f} / {cos(ou, oc)[1]:.6f} · {qc.stat().st_size / 2**20:.0f} MiB · {time.time() - t0:.0f} วิ (CPU)")

# ── 6) ครบทางด้วย decoder เดิม ──
say("\n[6] ครบทาง: encoder = ONNX 4-bit, decoder = torch เดิม → ข้อความเทียบ torch bf16 (greedy ทั้งคู่)")
from rapidfuzz.distance import Levenshtein as Lev
import re, unicodedata
def norm(s):   # ตัวเดียวกับ tanot_ocr_eval.py: NFC · ตัวพิมพ์เล็ก · เลขไทย→อารบิก · หมวด P/S เป็นช่องว่าง · ไม่นับช่องว่าง (รุ่นก่อนใช้ isalnum ซึ่งตัดสระบน/ล่างและวรรณยุกต์ไทยทิ้ง)
    s = unicodedata.normalize("NFC", s or "").lower()
    s = "".join(str("๐๑๒๓๔๕๖๗๘๙".index(c)) if c in "๐๑๒๓๔๕๖๗๘๙" else (" " if unicodedata.category(c)[0] in "PS" else c) for c in s)
    return re.sub(r"\s+", "", s)
base = {name: runner.ocr(im, tables=False)[0] for name, im in imgs}
orig_forward = model.encoder.forward
def onnx_forward(pixel_values, image_sizes, content_sizes):
    pv = pixel_values[0] if pixel_values.ndim == 3 else pixel_values
    h, w = image_sizes[0].tolist(); ch, cw = content_sizes[0].tolist()
    o = s4.run(None, {"patches": pv.float().cpu().numpy(), "pos": positions(h, w, ch, cw, pv.shape[0]).numpy()})[0]
    out = torch.from_numpy(o).to(dev, dtype=torch.bfloat16)
    return out, torch.ones(out.shape[:2], dtype=torch.bool, device=dev)
model.encoder.forward = onnx_forward
try:
    for name, im in imgs:
        t0 = time.time(); md = runner.ocr(im, tables=False)[0]
        a, b = norm(base[name]), norm(md)
        say(f"  {name}: ต่างจาก torch bf16 {Lev.distance(a, b) / max(1, len(a)) * 100:.1f}% ของตัวอักษร ({'เหมือนทุกตัว' if a == b else 'ไม่เหมือน'}) · {time.time() - t0:.0f} วิ")
finally:
    model.encoder.forward = orig_forward
say("  (ต่าง ≤ ~2–3% = เข้าเกณฑ์สมเหตุสมผลเทียบการจำลอง 4-bit ในด่าน 0 ที่เสีย CER ราว +2 จุด; มากกว่านั้น = ดูว่ากราฟ/position ผิดหรือบีบเกินไป)")

# ── 7) ค่าอ้างอิงสำหรับหน้าทดสอบ (อินพุตสุ่ม seed 20251113 · uniform ล้วน ได้ค่าเท่ากับ JS ทุกบิต) ──
M32 = 0xFFFFFFFF
def mulberry32(seed):   # ต้องตรงกับในหน้า iapp-vit-test.html
    a = seed & M32
    def nxt():
        nonlocal a
        a = (a + 0x6D2B79F5) & M32
        t = ((a ^ (a >> 15)) * (1 | a)) & M32
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & M32)) & M32) ^ t
        return ((t ^ (t >> 14)) & M32) / 4294967296
    return nxt
NREF = 2464
rg = mulberry32(20251113)
pin = np.array([rg() * 2 - 1 for _ in range(NREF * 768)], dtype=np.float32).reshape(NREF, 768)
pos_in = np.array([(rg() * 2 - 1) * 0.1 for _ in range(NREF * 1152)], dtype=np.float32).reshape(1, NREF, 1152)
say(f"\n[7] ค่าอ้างอิงจาก onnxruntime {ort.__version__} (CPU) ของอินพุตสุ่ม N={NREF} — เทียบกับหน้า iapp-vit-test.html ด้วยตา (ผลรวม + 8 ค่าแรก ควรเท่ากันถึงทศนิยม ~3 ตำแหน่ง; WebGPU ต่างได้เล็กน้อย)")
refs = {}
for f in [q4] + ([qc] if CHUNK_FILE else []):
    o = session(f).run(None, {"patches": pin, "pos": pos_in})[0]; refs[f.name] = o
    say(f"  {f.name}: ผลรวม {float(o.sum()):.3f} · 8 ค่าแรก {' '.join(f'{x:.4f}' for x in o.reshape(-1)[:8])}")

# ── 8) onnxruntime 1.24.3 (รุ่นเดียวกับเว็บ) ──
say("\n[8] ตรวจกับ onnxruntime 1.24.3 ในโปรเซสย่อย")
T = W / "ort1243"
ins = subprocess.run([sys.executable, "-m", "pip", "-q", "install", "--no-deps", "--target", str(T), "onnxruntime==1.24.3"], capture_output=True, text=True)
if ins.returncode != 0: say(f"  ⚠️ ติดตั้ง onnxruntime==1.24.3 ไม่ได้: {ins.stderr[-300:]}")
else:
    np.savez(W / "seed_in.npz", patches=pin, pos=pos_in)
    for name, o in refs.items(): np.save(W / f"ref_{name}.npy", o)
    (W / "check_ort.py").write_text("""import sys, numpy as np, onnxruntime as ort
d = np.load(sys.argv[2]); ref = np.load(sys.argv[3])
o = ort.InferenceSession(sys.argv[1], providers=["CPUExecutionProvider"]).run(None, {"patches": d["patches"], "pos": d["pos"]})[0]
print(ort.__version__, float(o.sum()), float(np.abs(o - ref).max()), " ".join(f"{x:.4f}" for x in o.reshape(-1)[:8]))
""")
    for f in [q4] + ([qc] if CHUNK_FILE else []):
        r = subprocess.run([sys.executable, str(W / "check_ort.py"), str(f), str(W / "seed_in.npz"), str(W / f"ref_{f.name}.npy")], capture_output=True, text=True, env={**__import__("os").environ, "PYTHONPATH": str(T)})
        say(f"  {f.name}: " + (f"ort {r.stdout.split()[0]} ผลรวม {float(r.stdout.split()[1]):.3f} · max|ต่างจาก ort {ort.__version__}| {float(r.stdout.split()[2]):.2e}" if r.returncode == 0 else f"❌ {r.stderr[-300:]}"))

# ── เก็บผล ──
for f in W.glob("model-q4*"): shutil.copy(f, OUT / f.name)
(OUT / "report.txt").write_text("\n".join(LOG), encoding="utf-8")
say(f"\n✅ เสร็จ — ไฟล์ 4-bit + report.txt อยู่ที่ {OUT} · ส่งข้อความด้านบนทั้งหมดกลับมา")
