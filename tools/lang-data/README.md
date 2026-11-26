# lang-data — สร้างชุดข้อมูลคำ/ประโยคของหน้าเรียนภาษา

เครื่องมือ Node ล้วน (ไม่มี dependency, ไม่รันใน CI, ไม่เรียกเครือข่าย/AI) ที่**เจ้าของรันเอง** ออกแบบใน `docs/languages-design.md` L0 (ROADMAP แถว 21)
ผลลัพธ์ = `lang-packs/<lang>-<hash8>.json` + `lang-packs/index.json` (ชื่อไฟล์มี hash ของเนื้อหา — เปลี่ยนเนื้อแล้วชื่อเปลี่ยน ไม่ต้อง bump `CACHE`)

## ดาวน์โหลดไฟล์ดิบ (ทำเอง — sandbox ของ session ที่เขียนสคริปต์เข้า tatoeba.org / kaikki.org ไม่ได้)
ใส่ไว้นอก repo เช่น `~/lang-raw/` แล้วแตก `.bz2` ด้วย `bunzip2`

| ไฟล์ | จาก | หมายเหตุ |
|---|---|---|
| ความถี่คำ | `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/<path>` — path ต่อภาษาอยู่ใน `lib.js` `LANGS[...].freq` (เช่น `content/2018/en/en_50k.txt`) | ตรวจแล้วว่ามีไฟล์ของ en zh_cn ko de fr it vi ms ar es pt ru (2018) และ ja hi (2016) · **ไม่มี**: yue, my(พม่า), km, lo |
| ประโยค | `https://downloads.tatoeba.org/exports/per_language/<tat>/<tat>_sentences.tsv.bz2` ของภาษาเป้าหมาย + `eng` + `tha` (ส่ง `--sentences` ซ้ำได้หลายไฟล์; ไฟล์รวม `sentences.tsv.bz2` ก็ได้) | คอลัมน์ `id⇥lang⇥text` |
| ลิงก์คำแปล | `https://downloads.tatoeba.org/exports/links.tar.bz2` → `links.csv` | คอลัมน์ `id⇥id` |
| เสียง (ไม่บังคับ) | `https://downloads.tatoeba.org/exports/sentences_with_audio.tar.bz2` | ใช้ติดธง `au` เฉพาะ license CC BY / BY-SA / CC0 |
| Wiktionary (ไม่บังคับ) | `https://kaikki.org/dictionary/rawdata.html` → ไฟล์ JSONL ของภาษาเป้าหมาย (ฉบับ en.wiktionary) | ให้ IPA, gloss อังกฤษ และ `translations` ภาษาไทย |

**license**: ตาราง `docs/languages-design.md` §2 ยืนยันแล้วจากหน้าจริง (Tatoeba, FrequencyWords) · kaikki.org หน้าเว็บไม่ระบุ license ของข้อมูล จึงใช้เงื่อนไข CC BY-SA 4.0 ของ Wiktionary · หัวคอลัมน์ Tatoeba ตรวจกับไฟล์จริงแล้ว 2026-11-26

## รัน
```bash
node tools/lang-data/build.mjs --lang lang-en \
  --freq ~/lang-raw/en_50k.txt \
  --sentences ~/lang-raw/eng_sentences.tsv --sentences ~/lang-raw/tha_sentences.tsv \
  --links ~/lang-raw/links.csv --audio ~/lang-raw/sentences_with_audio.csv \
  --kaikki ~/lang-raw/kaikki.org-dictionary-English.jsonl \
  --freq-commit <sha7 ของ FrequencyWords ที่ดาวน์โหลด> --tatoeba-date YYYY-MM-DD --wikt-date YYYY-MM-DD
```
`--out <โฟลเดอร์>` เปลี่ยนที่เขียน (ค่าเริ่มต้น `lang-packs/` ที่รากของ repo) · รันซ้ำภาษาเดิม = ไฟล์เก่าของภาษานั้นถูกแทนที่ ภาษาอื่นใน `index.json` ไม่ถูกแตะ

## กติกา
- ไฟล์ความถี่เรียงมากไปน้อย อันดับ = ลำดับบรรทัด · ระดับ 1–6 จากอันดับ (`LEVEL_BANDS` ใน `lib.js`: ≤500, ≤1200, ≤2500, ≤5000, ≤8000, อื่นๆ) — **ต้องตรงกับ `LangCalc.LEVEL_BANDS` ที่ L1 เพิ่มใน `lang-calc.js`**
- คำ: ตัวอักษรล้วน (ไม่มีตัวเลข), ไม่อยู่ใน `stop/<code>.txt` (ชื่อคน/คำหยาบ — เพิ่มได้เอง), ถ้ามี `--kaikki` ต้องมีคำแปลไทยหรือ gloss อังกฤษ (ไม่มีไทย → ช่อง `g` = gloss ให้หน้าเว็บแปลตอนใช้) · เพดาน 3,000 คำ
- ประโยค: ละติน ≤ 12 คำ / ญี่ปุ่น-จีน-กวางตุ้ง ≤ 25 ตัวอักษร · **ทุกคำต้องอยู่ในรายการคำที่เก็บ** · ข้อความไม่ซ้ำ · ต้องมีคำแปลอังกฤษหรือไทย (ภาษาอังกฤษ `en` = ข้อความเอง) · เลือกวนทีละระดับ ประโยคสั้นก่อน · เพดาน 3,000 ประโยค · `th` = คำแปลไทยจากลิงก์ Tatoeba ถ้ามี ไม่งั้นว่าง
- สคริปต์ไม่เรียก AI และไม่แต่งข้อมูล: ภาษาที่ไม่มีแหล่ง (ตอนนี้ yue, พม่า, เขมร, ลาว) = ออกรหัส 2 พร้อมข้อความ ไม่สร้างไฟล์ — หน้าเว็บไม่แสดงชุดใหม่ของภาษานั้น
- ขนาดเป้า ≤ ~600 KB/ไฟล์ (เตือนเมื่อเกิน 700 KB) · ตรวจจำนวนที่ได้จริงจากบรรทัดสรุปที่สคริปต์พิมพ์ แล้วจดลงตารางในแถว 21 ของ ROADMAP

## เทสต์
`cd tests && npx playwright test lang-data.spec.js` — known-answer ของตัวแปลงด้วยไฟล์ดิบจำลองที่สร้างในเทสต์ (ไม่มีข้อมูลจริงของแหล่งใดใน repo)
