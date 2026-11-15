# สร้างข้อมูลตรวจ iapp-pre.js จากตัวจริง: PIL (resize), torch (unfold/normalize ตามตัวประมวลผลของโมเดล) และ _normalized_2d_position_pages จาก repo โมเดล
# ใช้: python3 make_iapp_pre_fixtures.py <hf_prefix_geometry.py ของโมเดล @7a15371> <โฟลเดอร์ผลลัพธ์> · ข้อมูลเป็นภาพสุ่ม/ตารางสุ่ม ไม่มีข้อมูลผู้ใช้ ไม่ใส่ใน repo
import importlib.util, json, pathlib, sys
import numpy as np, torch
from PIL import Image
spec = importlib.util.spec_from_file_location("geo", sys.argv[1]); geo = importlib.util.module_from_spec(spec); spec.loader.exec_module(geo)
out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)
MEAN, STD = [0.48145466, 0.4578275, 0.40821073], [0.26862954, 0.26130258, 0.27577711]
cases = []
def smooth_image(w, h):   # ภาพสุ่มที่มีทั้งขอบคมและพื้นเรียบ
    base = rng.integers(0, 256, (h // 8 + 1, w // 8 + 1, 3), dtype=np.uint8)
    im = np.kron(base, np.ones((8, 8, 1), np.uint8))[:h, :w]
    noise = rng.integers(0, 30, (h, w, 3), dtype=np.uint8)
    return np.clip(im.astype(int) + noise, 0, 255).astype(np.uint8)
# 1) resize ตรงกับ PIL
for (w, h, ow, oh, f) in [(1241, 877, 896, 633, "bilinear"), (600, 1000, 422, 704, "bilinear"), (1241, 877, 896, 633, "bicubic"), (301, 203, 150, 101, "bilinear"), (300, 200, 450, 300, "bilinear"), (997, 640, 704, 452, "bicubic")]:
    im = smooth_image(w, h); res = np.asarray(Image.fromarray(im).resize((ow, oh), {"bilinear": Image.Resampling.BILINEAR, "bicubic": Image.Resampling.BICUBIC}[f]))
    n = f"rs{len(cases)}"; im.tofile(out / f"{n}.in"); res.tofile(out / f"{n}.out")
    cases.append({"kind": "resize", "name": n, "w": w, "h": h, "ow": ow, "oh": oh, "filter": f})
# 2) patch + 3) pos ผ่านทาง canvas คงที่ (ตามสัญญาใน iapp-pre.js) — ใช้โค้ดตัวจริงของโมเดลสำหรับ unfold/normalize และ pos
def canvas_ref(im):
    h, w = im.shape[:2]; ch, cw = (704, 896) if w > h else (896, 704); asp = w / h; nh, nw = h, w
    if nh > ch: nh = ch; nw = int(nh * asp)
    if nw > cw: nw = cw; nh = int(nw / asp)
    img = im if (nh == h and nw == w) else np.asarray(Image.fromarray(im).resize((nw, nh), Image.Resampling.BILINEAR))
    c = np.full((ch, cw, 3), 255, np.uint8); c[:nh, :nw] = img
    return c, ch, cw, nh, nw
C = int(sys.argv[3]) if len(sys.argv) > 3 else 16
table = rng.standard_normal((1, 128 * 128, C)).astype(np.float32); table.tofile(out / "pos_table.f32")
for (w, h) in [(1241, 877), (600, 1000), (300, 200), (50, 900), (703, 1200), (10, 900), (900, 12), (16, 16)]:
    im = smooth_image(w, h); c, ch, cw, nh, nw = canvas_ref(im)
    page = torch.from_numpy(c).permute(2, 0, 1).contiguous().float().div_(255.0)
    page = (page - torch.tensor(MEAN).view(-1, 1, 1)) / torch.tensor(STD).view(-1, 1, 1)
    patches = page.unfold(1, 16, 16).unfold(2, 16, 16).permute(1, 2, 0, 3, 4).reshape(-1, 768)
    pos = geo._normalized_2d_position_pages(torch, patches=torch.zeros(1, patches.shape[0], C), pos_embed=torch.from_numpy(table), source_rows=128, source_cols=128,
                                            image_sizes=[(ch, cw)], patch_size=16, content_sizes=[(nh, nw)], content_normalized=True)[0]
    n = f"cv{len(cases)}"; im.tofile(out / f"{n}.in"); patches.numpy().astype("<f4").tofile(out / f"{n}.patches"); pos.numpy().astype("<f4").tofile(out / f"{n}.pos")
    cases.append({"kind": "canvas", "name": n, "w": w, "h": h, "canvasH": ch, "canvasW": cw, "contentH": nh, "contentW": nw, "C": C})
json.dump({"cases": cases, "C": C}, open(out / "manifest.json", "w"))
print(len(cases), "cases →", out)
