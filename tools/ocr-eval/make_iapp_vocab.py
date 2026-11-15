# สร้าง iapp-vocab.json จาก tokenizer.json ของ iapp/OpenThai2.0-OCR-Markdown (ByteLevel BPE 50,000 + added tokens) สำหรับถอดรหัสโทเค็น → ข้อความใน JS (iapp-tok.js)
# ใช้: python3 make_iapp_vocab.py <tokenizer.json> <ปลายทาง iapp-vocab.json> — ไฟล์ผลลัพธ์เป็นข้อมูลของโมเดล (ไม่ใส่ใน repo; ไปอยู่กับไฟล์โมเดลที่ Tanotfin ภายหลัง)
import json, sys, unicodedata
t = json.load(open(sys.argv[1], encoding="utf-8"))
vocab = t["model"]["vocab"]                       # token → id (BPE)
n = 1 + max(max(vocab.values()), max(a["id"] for a in t["added_tokens"]))
tokens = [None] * n
for tok, i in vocab.items(): tokens[i] = tok
for a in t["added_tokens"]:   # added tokens (<x_…> <y_…> <class_…> ฯลฯ) เป็นข้อความตรงๆ · ตัวที่ normalized=true ถูก NFKC ตอนถอดรหัส (เช่น "ำ" U+0E33 → "ํา") ตามที่ tokenizers ทำ
    tokens[a["id"]] = unicodedata.normalize("NFKC", a["content"]) if a.get("normalized") else a["content"]
json.dump({"v": 1, "tokens": tokens}, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("tokens", n, "null", sum(1 for x in tokens if x is None))
