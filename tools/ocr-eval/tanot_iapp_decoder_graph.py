# Tanot — กราฟ decoder ของ iapp/OpenThai2.0-OCR-Markdown สำหรับส่งออก ONNX (แถว 3d ด่าน 2) — โมดูลล้วน ไม่โหลดโมเดล/ไม่แตะ Drive
# ใช้โดย tanot_iapp_onnx_dec.py (Colab) · ทดสอบความเท่ากับโค้ดต้นฉบับด้วยน้ำหนักสุ่มได้ในเครื่องที่ไม่มี GPU
#
# โครงสร้างต้นฉบับ (hf_nemotron_parse_modeling.py @7a15371): decoder-only 10 ชั้น d=1024, attention 16 หัว / KV 8 หัว (GQA), ไม่มี positional embedding,
# ไม่มี cross-attention · embedding ×sqrt(1024) แล้ว layernorm_embedding · แต่ละชั้นแบบ pre-LN: x += attn(LN(x)); x += fc2(gelu(fc1(LN(x)))) · ท้ายสุด layer_norm
# แล้ว lm_head (ผูกน้ำหนักกับตารางคำ) · vision prefix (617 token) ต่อหน้า token ข้อความ (embedding ไม่ ×scale) เข้าไปทั้งก้อนแล้ว attention เป็น causal ทั้งหมด
# (ภาพเดียว/แบตช์ 1: mask ของ prefix กับข้อความเป็น True ทั้งหมด → เหลือแค่ causal)
#
# ที่ส่งออก 2 กราฟ:
#   prefill = vision [1,617,1024] → KV ของ 10 ชั้น (vision + prompt ทุก token ยกเว้นตัวสุดท้าย) · prompt embedding ฝังเป็นค่าคงที่ในกราฟ (prompt คงที่) → ไม่ต้องมีตารางคำ
#   decode  = token id [1] + KV เดิม → logits [1,72512] + KV ใหม่ (ต่อท้ายด้วย Concat) · token แรกที่ decode = token สุดท้ายของ prompt (ได้ logits ของ token ที่สร้างตัวแรก)
# เลี่ยง node ที่คำนวณ shape (ซึ่งตกไป CPU และใช้ไม่ได้เมื่อห้ามถอย CPU — บทเรียนจากไฟล์ ViT แบบ N เปลี่ยนได้): decode ไม่มี mask (token เดียวเห็นทุกตัว),
# GQA ทำโดยจัดกลุ่มหัว query คู่ละ 1 หัว KV (reshape [1,8,2,64]) แทน repeat_interleave, ทุก reshape เป็นค่าคงที่
import math
import torch, torch.nn as nn, torch.nn.functional as F

D, H, KVH, HD, NL = 1024, 16, 8, 64, 10
VOCAB = 72512


class Prefill(nn.Module):
    def __init__(self, dec, prompt_emb, n_vision=617):
        """dec = NemotronParseDecoder ต้นฉบับ · prompt_emb = [1,T,1024] ของ embed(ids)*scale (T = prompt ไม่รวม token สุดท้าย)"""
        super().__init__()
        self.dec, self.n_vision = dec, n_vision
        self.register_buffer("prompt_emb", prompt_emb.detach().clone())
        m = n_vision + prompt_emb.shape[1]
        self.m = m
        causal = torch.triu(torch.full((m, m), -1e4), 1)   # -1e4 (ไม่ใช่ -inf) ให้ fp16 ปลอดภัย; softmax ให้ ~0 เท่ากัน
        self.register_buffer("mask", torch.cat((causal, causal), 0)[None, None])   # หัว query 2 หัวต่อ 1 หัว KV วางต่อกันในแกนแถว → mask ซ้อน 2 ชุด

    def forward(self, vision):
        x = self.dec.layernorm_embedding(torch.cat((vision, self.prompt_emb), dim=1))
        m, ks, vs = self.m, [], []
        for layer in self.dec.layers:
            a = layer.self_attn
            h = layer.self_attn_layer_norm(x)
            q = a.q_proj(h).view(1, m, H, HD).transpose(1, 2).reshape(1, KVH, 2 * m, HD)   # GQA: หัว query 2j,2j+1 รวมเป็นแถวของหัว KV j (ไม่ใช้ repeat_interleave → ไม่มี node shape)
            k = a.k_proj(h).view(1, m, KVH, HD).transpose(1, 2)
            v = a.v_proj(h).view(1, m, KVH, HD).transpose(1, 2)
            ks.append(k); vs.append(v)
            p = ((q * HD ** -0.5) @ k.transpose(-1, -2) + self.mask).softmax(-1)          # [1,8,2m,m]
            o = (p @ v).reshape(1, KVH, 2, m, HD).permute(0, 3, 1, 2, 4).reshape(1, m, D)
            x = x + a.out_proj(o)
            x = x + layer.fc2(F.gelu(layer.fc1(layer.final_layer_norm(x))))
        out = []
        for k, v in zip(ks, vs): out += [k, v]
        return tuple(out)


class Decode(nn.Module):
    def __init__(self, dec):
        super().__init__()
        self.dec = dec
        self.scale = dec.embed_tokens.embed_scale
        self.register_buffer("wt", dec.embed_tokens.weight.detach().t().contiguous())   # [1024, 72512] ตารางเดียว: Gather(axis=1) ทำ embedding, MatMul ทำ lm_head (ผูกน้ำหนัก) — ไม่มีสำเนาที่สอง

    def forward(self, token, *past):
        d = self.dec
        x = d.layernorm_embedding(self.wt.index_select(1, token).reshape(1, 1, D) * self.scale)   # token = [1] (int64)
        out = []
        for i, layer in enumerate(d.layers):
            a = layer.self_attn
            h = layer.self_attn_layer_norm(x)
            q = a.q_proj(h).reshape(1, KVH, H // KVH, HD)          # หัว query 2j, 2j+1 ใช้ KV หัว j (เหมือน repeat_interleave)
            k = torch.cat((past[2 * i], a.k_proj(h).reshape(1, KVH, 1, HD)), dim=2)
            v = torch.cat((past[2 * i + 1], a.v_proj(h).reshape(1, KVH, 1, HD)), dim=2)
            out += [k, v]
            p = ((q * HD ** -0.5) @ k.transpose(-1, -2)).softmax(-1)   # [1,8,2,L+1]
            x = x + a.out_proj((p @ v).reshape(1, 1, D))
            x = x + layer.fc2(F.gelu(layer.fc1(layer.final_layer_norm(x))))
        logits = d.layer_norm(x).reshape(1, D) @ self.wt
        return (logits,) + tuple(out)


def export_prefill(dec, prompt_emb, path, n_vision=617):
    pf = Prefill(dec, prompt_emb, n_vision).eval()
    vision = torch.zeros(1, n_vision, D)
    with torch.no_grad():
        torch.onnx.export(pf, (vision,), str(path), dynamo=False, input_names=["vision"],
                          output_names=[f"{n}{i}" for i in range(NL) for n in ("k", "v")], opset_version=17)
    return pf


def export_decode(dec, path, past_len=8):
    dc = Decode(dec).eval()
    tok = torch.zeros(1, dtype=torch.long)
    past = tuple(torch.zeros(1, KVH, past_len, HD) for _ in range(2 * NL))
    names_in = ["token"] + [f"past_{n}{i}" for i in range(NL) for n in ("k", "v")]
    names_out = ["logits"] + [f"present_{n}{i}" for i in range(NL) for n in ("k", "v")]
    dyn = {nm: {2: "L"} for nm in names_in[1:]}
    dyn.update({nm: {2: "L1"} for nm in names_out[1:]})
    with torch.no_grad():
        torch.onnx.export(dc, (tok,) + past, str(path), dynamo=False, input_names=names_in, output_names=names_out,
                          dynamic_axes=dyn, opset_version=17)
    return dc


def op_report(path):
    """ชนิด op + จำนวน และ node ที่คำนวณ shape (Shape/Gather บน shape ฯลฯ) — ต้องไม่มี (ตกไป CPU บน WebGPU)"""
    import onnx
    from collections import Counter
    m = onnx.load(str(path), load_external_data=False)
    c = Counter(n.op_type for n in m.graph.node)
    size = sum(int(__import__("numpy").prod(i.dims)) * 4 for i in m.graph.initializer if i.data_type == 1)
    return dict(c), size
