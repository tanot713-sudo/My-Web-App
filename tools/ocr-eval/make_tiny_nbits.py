# Tanot — สร้างโมเดลจิ๋วที่มี MatMulNBits 1 node (4 บิต / 8 บิต) + ค่าคาดหวัง ไว้ทดสอบว่า WebGPU ของ onnxruntime-web รองรับกี่บิต (แถว 3d)
# ใช้บนเครื่องไหนก็ได้ที่มี onnx + onnxruntime + numpy: python3 make_tiny_nbits.py · ผล: tiny-nbits4.onnx, tiny-nbits8.onnx, tiny-nbits.json (ไม่กี่ KB)
# ก่อนเขียนไฟล์ ตรวจด้วย onnxruntime CPU ว่าให้ค่าตรงกับที่คำนวณเอง (ตรวจแล้วว่าไฟล์ถูกต้อง ไม่ใช่ตรวจว่า WebGPU รองรับ)
import json, pathlib
import numpy as np, onnx, onnxruntime as ort
from onnx import TensorProto as T, helper as h, numpy_helper as nh

M, K, N, BLOCK = 2, 64, 8, 32
KB = K // BLOCK
M32 = 0xFFFFFFFF
def mulberry32(seed):   # ตัวสุ่มเดียวกับในหน้าทดสอบ (เลขจำนวนเต็มล้วน ได้ค่าเหมือนกันทุกเครื่อง)
    a = seed & M32
    def nxt():
        nonlocal a
        a = (a + 0x6D2B79F5) & M32
        t = ((a ^ (a >> 15)) * (1 | a)) & M32
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & M32)) & M32) ^ t
        return ((t ^ (t >> 14)) & M32) / 4294967296
    return nxt

rnd = mulberry32(12345)
A = np.array([(rnd() * 2 - 1) for _ in range(M * K)], dtype=np.float32).reshape(M, K)
scales = np.array([0.01 + 0.04 * rnd() for _ in range(N * KB)], dtype=np.float32)
out = {"M": M, "K": K, "N": N, "block": BLOCK, "A": A.reshape(-1).tolist(), "expected": {}}
here = pathlib.Path(__file__).parent
for bits in (4, 8):
    qmax = 2 ** bits
    q = np.array([int(rnd() * qmax) for _ in range(N * K)], dtype=np.uint8).reshape(N, KB, BLOCK)
    zp = 2 ** (bits - 1)   # ไม่ใส่ zero_points = ค่าเริ่มต้น 2^(bits-1)
    w = (q.astype(np.float64) - zp) * scales.reshape(N, KB, 1).astype(np.float64)   # [N,KB,BLOCK]
    expected = A.astype(np.float64) @ w.reshape(N, K).T                              # [M,N]
    packed = q if bits == 8 else (q[..., 0::2] | (q[..., 1::2] << 4)).astype(np.uint8)   # 4 บิต: ตัวคู่อยู่ nibble ล่าง
    node = h.make_node("MatMulNBits", ["A", "B", "scales"], ["Y"], domain="com.microsoft", K=K, N=N, bits=bits, block_size=BLOCK)
    g = h.make_graph([node], f"tiny{bits}", [h.make_tensor_value_info("A", T.FLOAT, [M, K])], [h.make_tensor_value_info("Y", T.FLOAT, [M, N])],
                     [nh.from_array(np.ascontiguousarray(packed), "B"), nh.from_array(scales, "scales")])
    m = h.make_model(g, opset_imports=[h.make_opsetid("", 17), h.make_opsetid("com.microsoft", 1)]); m.ir_version = 8
    onnx.checker.check_model(m)
    path = here / f"tiny-nbits{bits}.onnx"; onnx.save(m, path)
    got = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"]).run(None, {"A": A})[0]
    diff = float(np.abs(got - expected).max())
    print(f"{bits} บิต: ORT {ort.__version__} CPU เทียบค่าคำนวณเอง max|ต่าง| = {diff:.2e}")
    assert diff < 1e-4, "ไฟล์โมเดลจิ๋วไม่ตรงกับค่าที่คำนวณ"
    out["expected"][str(bits)] = expected.astype(np.float32).reshape(-1).tolist()
(here / "tiny-nbits.json").write_text(json.dumps(out))
